import test from 'node:test';
import assert from 'node:assert/strict';
import { makeLex } from './fixture.mjs';
import { emptyState, importJson, exportJson, validateState, exportTsv } from '../../src/core/store.js';
import { startSession, submitAnswer, advance, currentTask, finishSession, isSessionOver, grade } from '../../src/core/engine.js';
import { addDays } from '../../src/core/dates.js';
import { newlyUnlocked, ACHIEVEMENTS } from '../../src/core/achievements.js';
import { MECHANICS } from '../../src/core/tasks.js';

const TODAY = '2026-04-10';

function correctResponse(task) {
  if (task.mech === 'match') return { mistakes: [] };
  if (task.mech === 'fixit') return { token: task.wrongIndex, text: task.answer };
  if (task.options && task.answerIndex !== undefined) return { choice: task.answerIndex };
  return { text: task.accepted[0] };
}
function wrongResponse(task) {
  if (task.mech === 'match') return { mistakes: [task.wordIds[0]] };
  if (task.mech === 'fixit') return { token: (task.wrongIndex + 1) % task.tokens.length };
  if (task.options && task.answerIndex !== undefined) return { choice: (task.answerIndex + 1) % task.options.length };
  return { text: 'zzzzzz' };
}

function playAll(state, lex, session, respond, today = TODAY) {
  let guard = 0;
  while (!isSessionOver(session) && guard++ < 100) {
    const t = currentTask(session);
    submitAnswer(state, lex, session, t.id, respond(t), { today });
    advance(session);
  }
}

test('first Daily Mix introduces words and asks for each one again a few tasks later', () => {
  const lex = makeLex(40);
  const state = emptyState();
  const s = startSession(state, lex, { mode: 'daily', length: 10, today: TODAY, seed: 7 });
  assert.equal(s.tasks.length, 10);
  const intros = s.tasks.map((t, i) => [t, i]).filter(([t]) => t.role === 'intro');
  assert.ok(intros.length >= 3);
  for (const [t, i] of intros) {
    const j = s.tasks.findIndex((x, k) => k > i && x.wordId === t.wordId && x.role === 'recall-new');
    if (j >= 0) assert.ok(j - i >= 2, 'recall comes after other tasks');
  }
  assert.ok(s.tasks.filter((t) => t.role === 'recall-new').every((t) => MECHANICS[t.mech].active || t.variant === 'typed'));
});

test('new words respect the daily allowance', () => {
  const lex = makeLex(40);
  const state = emptyState();
  state.settings.newPerDay = 2;
  const s = startSession(state, lex, { mode: 'daily', length: 10, today: TODAY, seed: 3 });
  const introsInAllowance = s.tasks.filter((t) => t.role === 'intro').length;
  assert.ok(introsInAllowance >= 2);
  // with nothing else to study, extra new words fill the session instead of leaving it empty
  assert.equal(s.tasks.length, 10);
});

test('mechanics vary: no five identical exercises in a row', () => {
  const lex = makeLex(40);
  const state = emptyState();
  // make 30 words due for review
  let s0 = startSession(state, lex, { mode: 'daily', length: 20, today: TODAY, seed: 1 });
  playAll(state, lex, s0, correctResponse);
  for (const id of Object.keys(state.words)) state.words[id].due = TODAY;
  const s = startSession(state, lex, { mode: 'daily', length: 20, today: addDays(TODAY, 1), seed: 99 });
  const mechs = s.tasks.map((t) => (t.mech === 'intro' ? 'quickpick' : t.mech));
  for (let i = 0; i + 4 < mechs.length; i++) {
    assert.ok(new Set(mechs.slice(i, i + 5)).size > 1, 'five in a row at ' + i);
  }
  assert.ok(new Set(mechs).size >= 5, 'several different mechanics: ' + [...new Set(mechs)].join(','));
});

test('a task can be graded once: double taps and re-submits change nothing', () => {
  const lex = makeLex(20);
  const state = emptyState();
  const s = startSession(state, lex, { mode: 'daily', length: 10, today: TODAY, seed: 5 });
  const t = currentTask(s);
  const r1 = submitAnswer(state, lex, s, t.id, correctResponse(t), { today: TODAY });
  const xp1 = state.stats.xp;
  const graded1 = state.stats.graded;
  const r2 = submitAnswer(state, lex, s, t.id, correctResponse(t), { today: TODAY });
  assert.equal(r2.events.duplicate, true);
  assert.equal(state.stats.xp, xp1);
  assert.equal(state.stats.graded, graded1);
  assert.deepEqual(r2.result, r1.result);
});

test('XP ledger survives a "reload": re-created session objects cannot pay twice for the same task id', () => {
  const lex = makeLex(20);
  const state = emptyState();
  const s = startSession(state, lex, { mode: 'daily', length: 10, today: TODAY, seed: 11 });
  const t = currentTask(s);
  submitAnswer(state, lex, s, t.id, correctResponse(t), { today: TODAY });
  const xp = state.stats.xp;
  const reloaded = JSON.parse(JSON.stringify(s));
  reloaded.results = {}; // even if results were lost, the ledger still blocks XP
  submitAnswer(state, lex, reloaded, t.id, correctResponse(t), { today: TODAY });
  assert.equal(state.stats.xp, xp);
});

test('a mistake brings the word back once, with another exercise', () => {
  const lex = makeLex(30);
  const state = emptyState();
  let s0 = startSession(state, lex, { mode: 'daily', length: 20, today: TODAY, seed: 2 });
  playAll(state, lex, s0, correctResponse);
  for (const id of Object.keys(state.words)) state.words[id].due = addDays(TODAY, 1);
  const s = startSession(state, lex, { mode: 'daily', length: 10, today: addDays(TODAY, 1), seed: 4 });
  while (currentTask(s).mech === 'match') {
    const m = currentTask(s);
    submitAnswer(state, lex, s, m.id, correctResponse(m), { today: addDays(TODAY, 1) });
    advance(s);
  }
  const t = currentTask(s);
  const before = s.tasks.length;
  const { events } = submitAnswer(state, lex, s, t.id, wrongResponse(t), { today: addDays(TODAY, 1) });
  assert.ok(events.followUp);
  const fu = s.tasks.find((x) => x.id === events.followUp);
  assert.equal(fu.wordId, t.wordId);
  assert.notEqual(fu.mech, t.mech);
  assert.ok(s.tasks.length <= before + 1);
  advance(s);
  // failing the follow-up does not create yet another follow-up
  let guard = 0;
  while (currentTask(s) && currentTask(s).id !== fu.id && guard++ < 30) advance(s);
  const r = submitAnswer(state, lex, s, fu.id, wrongResponse(fu), { today: addDays(TODAY, 1) });
  assert.equal(r.events.followUp, null);
});

test('answers are credited to the local day on which they were given', () => {
  const lex = makeLex(20);
  const state = emptyState();
  const s = startSession(state, lex, { mode: 'daily', length: 10, today: TODAY, seed: 8 });
  const t1 = currentTask(s);
  submitAnswer(state, lex, s, t1.id, correctResponse(t1), { today: TODAY });
  advance(s);
  const t2 = currentTask(s);
  const tomorrow = addDays(TODAY, 1);
  submitAnswer(state, lex, s, t2.id, correctResponse(t2), { today: tomorrow });
  assert.equal(state.days[TODAY].graded, 1);
  assert.equal(state.days[tomorrow].graded, 1);
});

test('finishing a session counts a study day and pays the bonus once', () => {
  const lex = makeLex(20);
  const state = emptyState();
  const s = startSession(state, lex, { mode: 'daily', length: 10, today: TODAY, seed: 12 });
  playAll(state, lex, s, correctResponse);
  const before = state.stats.xp;
  const sum = finishSession(state, lex, s, { today: TODAY });
  assert.equal(state.stats.sessions, 1);
  assert.equal(state.days[TODAY].sessions, 1);
  assert.equal(sum.events.bonus, 20);
  assert.equal(state.stats.xp, before + 20);
  finishSession(state, lex, s, { today: TODAY });
  assert.equal(state.stats.sessions, 1, 'finishing twice is ignored');
  assert.ok(state.achievements['first-session']);
});

test('perfect session and hard-word list', () => {
  const lex = makeLex(20);
  const state = emptyState();
  const s = startSession(state, lex, { mode: 'daily', length: 10, today: TODAY, seed: 12 });
  playAll(state, lex, s, correctResponse);
  const sum = finishSession(state, lex, s, { today: TODAY });
  assert.equal(sum.hard.length, 0);
  assert.equal(state.stats.perfect, 1);
});

test('sprint: answers after the time limit are ignored and never schedule reviews', () => {
  const lex = makeLex(20);
  const state = emptyState();
  const s0 = startSession(state, lex, { mode: 'daily', length: 10, today: TODAY, seed: 21 });
  playAll(state, lex, s0, correctResponse);
  const snapshot = JSON.stringify(Object.fromEntries(Object.entries(state.words).map(([k, v]) => [k, v.due])));
  const now = Date.now();
  const sp = startSession(state, lex, { mode: 'sprint', today: TODAY, seed: 5, now });
  const t = currentTask(sp);
  submitAnswer(state, lex, sp, t.id, correctResponse(t), { today: TODAY, now: now + 1000 });
  assert.equal(JSON.stringify(Object.fromEntries(Object.entries(state.words).map(([k, v]) => [k, v.due]))), snapshot);
  advance(sp);
  const late = currentTask(sp) || null;
  if (late) {
    const r = submitAnswer(state, lex, sp, late.id, correctResponse(late), { today: TODAY, now: now + 70000 });
    assert.equal(r.result, null);
    assert.equal(r.events.timeUp, true);
  }
});

test('grading: fix-it needs the right word first, then the right correction', () => {
  const lex = makeLex(10);
  const state = emptyState();
  const s = startSession(state, lex, { mode: 'word', wordId: lex.words[0].id, today: TODAY, seed: 1 });
  const w = lex.words[0];
  const { buildTask } = { buildTask: null };
  const task = {
    mech: 'fixit', wordId: w.id, tokens: [{ text: 'This' }, { text: 'thing', wrong: true }], wrongIndex: 1, accepted: [w.lemma], answer: w.lemma, forms: w.forms,
  };
  assert.equal(grade(task, { token: 0 }, lex).wrongToken, true);
  assert.equal(grade(task, { token: 1, text: w.lemma }, lex).outcome, 'good');
  assert.equal(grade(task, { token: 1, text: w.lemma, hint: 1 }, lex).outcome, 'hint');
  assert.equal(grade(task, { token: 1, text: '', hint: 3 }, lex).revealed, true);
  assert.ok(s.tasks.length >= 1);
});

test('import: damaged or foreign files are rejected and never replace progress', () => {
  const lex = makeLex(10);
  const ids = new Set(lex.words.map((w) => w.id));
  assert.equal(importJson('{not json', ids).ok, false);
  assert.equal(importJson(JSON.stringify({ hello: 1 }), ids).ok, false);
  const bad = emptyState();
  bad.words[lex.words[0].id] = { step: 99 };
  assert.equal(importJson(JSON.stringify(bad), ids).ok, false);
  // round trip works
  const state = emptyState();
  const s = startSession(state, lex, { mode: 'daily', length: 10, today: TODAY, seed: 12 });
  playAll(state, lex, s, correctResponse);
  const back = importJson(exportJson(state), ids);
  assert.equal(back.ok, true);
  assert.deepEqual(Object.keys(back.state.words).sort(), Object.keys(state.words).sort());
  assert.equal(back.state.stats.xp, state.stats.xp);
  // unknown word ids are skipped, not fatal
  const extra = JSON.parse(exportJson(state));
  extra.words['ghost-n'] = extra.words[Object.keys(extra.words)[0]];
  const r = validateState(extra, ids);
  assert.equal(r.ok, true);
  assert.equal(r.dropped, 1);
});

test('TSV export for Anki and Quizlet', () => {
  const lex = makeLex(3);
  const anki = exportTsv(lex.words, 'anki').trim().split('\n');
  assert.equal(anki.length, 3);
  assert.equal(anki[0].split('\t').length, 4);
  const q = exportTsv(lex.words, 'quizlet').trim().split('\n');
  assert.equal(q[0].split('\t').length, 2);
  assert.ok(!q.join('').includes('[['));
});

test('achievements have unique ids, 20+ entries and derive from state', () => {
  assert.ok(ACHIEVEMENTS.length >= 20);
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, ACHIEVEMENTS.length);
  const lex = makeLex(5);
  const state = emptyState();
  assert.deepEqual(newlyUnlocked(state, lex, TODAY), []);
  state.stats.sessions = 1;
  assert.deepEqual(newlyUnlocked(state, lex, TODAY), ['first-session']);
});

test('free practice uses only the chosen exercise types and topics', () => {
  const lex = makeLex(40);
  const state = emptyState();
  const s0 = startSession(state, lex, { mode: 'daily', length: 20, today: TODAY, seed: 31 });
  playAll(state, lex, s0, correctResponse);
  const s = startSession(state, lex, { mode: 'free', length: 10, today: TODAY, seed: 32, config: { topics: ['work', 'people'], mechanics: ['reply'] } });
  assert.ok(s.tasks.length > 0);
  for (const t of s.tasks) {
    assert.ok(['work', 'people'].includes(lex.get(t.wordId).topic), 'topic filter');
    assert.ok(t.mech === 'reply' || t.mech === 'intro', 'unexpected ' + t.mech);
  }
  const m = startSession(state, lex, { mode: 'free', length: 10, today: TODAY, seed: 33, config: { topics: [], mechanics: ['match'] } });
  assert.ok(m.tasks.some((t) => t.mech === 'match'), 'match chosen');
});

test('within one session a word never shows the same example sentence twice', () => {
  const lex = makeLex(40);
  for (let seed = 1; seed <= 20; seed++) {
    const state = emptyState();
    const s = startSession(state, lex, { mode: 'daily', length: 20, today: TODAY, seed });
    const seen = {};
    for (const t of s.tasks) {
      if (t.exIndex === undefined) continue;
      const k = t.wordId + '#' + t.exIndex;
      assert.ok(!seen[k], `seed ${seed}: ${k} used twice`);
      seen[k] = true;
    }
  }
});
