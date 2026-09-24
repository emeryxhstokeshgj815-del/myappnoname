// Session runtime: grading answers and applying them to progress, XP,
// statistics and achievements. Pure functions over a state object (the UI
// layer persists it). Every answer is tied to a task id; a task can be graded
// only once, which makes double taps, re-submits and reloads harmless.

import { checkTyped } from './answer.js';
import { applyAnswer } from './srs.js';
import { answerXp, levelInfo, ledgerAdd, ledgerHas, XP } from './xp.js';
import { MECHANICS } from './tasks.js';
import { newlyUnlocked } from './achievements.js';
import { makeTask, makeFollowUp, planDaily, planMistakes, planBoss, planFree, planWord, sessionSeed, MODES } from './session.js';
import { makeRng } from './rng.js';
import { diffDays } from './dates.js';
import { streakInfo } from './streak.js';

// ---------- session lifecycle -------------------------------------------------------

export function startSession(state, lex, { mode, length = 10, today, voice = false, config = {}, wordId = null, seed = sessionSeed(), now = Date.now() }) {
  const rng = makeRng(seed);
  let specs;
  if (mode === 'daily') specs = planDaily({ lex, state, today, length, rng });
  else if (mode === 'mistakes') specs = planMistakes({ state, today, length });
  else if (mode === 'boss') specs = planBoss({ state, length, rng });
  else if (mode === 'free') specs = planFree({ lex, state, today, length, rng, config });
  else if (mode === 'word') specs = planWord({ wordId, state });
  else if (mode === 'sprint') specs = [];
  else throw new Error('unknown mode ' + mode);
  const session = {
    id: 's' + now.toString(36) + '-' + (seed % 1e6).toString(36),
    seed,
    mode,
    length,
    day: today,
    startedAt: now,
    endsAt: mode === 'sprint' ? now + (MODES.sprint.seconds || 60) * 1000 : null,
    config,
    voice,
    tasks: [],
    counter: 0,
    pos: 0,
    results: {},
    requeued: [],
    usage: {},
    usedEx: {},
    xp: 0,
    graded: 0,
    correct: 0,
    hints: 0,
    mistakes: [],
    finished: false,
    rngState: seed,
  };
  const env = envFor(state, lex, session, rng);
  let prev = null;
  for (const spec of specs) {
    const t = makeTask(spec, { ...env, prev });
    addTask(session, t);
    prev = t.mech;
  }
  if (mode === 'sprint') addSprintTask(state, lex, session);
  return session;
}

function envFor(state, lex, session, rng) {
  return {
    lex,
    state,
    rng: rng || makeRng((session.seed + session.counter * 7919) >>> 0),
    mode: session.mode,
    voice: session.voice,
    usage: session.usage,
    usedEx: session.usedEx || (session.usedEx = {}),
    config: session.config,
    pool: Object.keys(state.words),
  };
}

function addTask(session, t, at = null) {
  t.id = `${session.id}:${session.counter++}`;
  const key = t.mech === 'intro' ? 'quickpick' : t.mech;
  session.usage[key] = (session.usage[key] || 0) + 1;
  if (at === null || at >= session.tasks.length) session.tasks.push(t);
  else session.tasks.splice(at, 0, t);
  return t;
}

export function addSprintTask(state, lex, session) {
  const known = Object.entries(state.words).filter(([, r]) => r.ok >= 1).map(([id]) => id);
  const pool = known.length >= 4 ? known : Object.keys(state.words);
  const rng = makeRng((session.seed + session.counter * 104729) >>> 0);
  const recent = session.tasks.slice(-4).map((t) => t.wordId);
  const choices = pool.filter((id) => !recent.includes(id));
  const wordId = rng.pick(choices.length ? choices : pool);
  const prev = session.tasks.length ? session.tasks[session.tasks.length - 1].mech : null;
  const t = makeTask({ role: 'sprint', wordId }, { ...envFor(state, lex, session, rng), prev });
  t.practice = true;
  return addTask(session, t);
}

export function currentTask(session) {
  return session.tasks[session.pos] || null;
}

export function isSessionOver(session, now = Date.now()) {
  if (session.mode === 'sprint') return now >= session.endsAt;
  return session.pos >= session.tasks.length;
}

// ---------- grading -------------------------------------------------------------------

/**
 * Grade a response without touching state.
 * response: {choice} | {text, hint} | {token, text, hint} | {mistakes: [ids]}
 */
export function grade(task, response, lex) {
  const known = lex.known;
  const out = { outcome: 'bad', correct: false, typo: false, alternative: false, formSlip: false, expected: task.answer ?? null };
  if (task.mech === 'match') {
    const missed = new Set(response.mistakes || []);
    out.perWord = Object.fromEntries(task.wordIds.map((id) => [id, missed.has(id) ? 'bad' : 'good']));
    out.correct = missed.size === 0;
    out.outcome = out.correct ? 'good' : 'bad';
    return out;
  }
  if (task.mech === 'collocation' && task.variant === 'build') {
    const built = (response.tiles || []).map((i) => task.tiles[i]).join(' ').toLowerCase();
    out.built = built;
    out.correct = built === task.answer.toLowerCase();
    out.outcome = out.correct ? 'good' : 'bad';
    out.expected = task.answer;
    return out;
  }
  if (task.options && response.choice !== undefined && task.mech !== 'fixit') {
    out.correct = response.choice === task.answerIndex;
    out.outcome = out.correct ? 'good' : 'bad';
    out.chosen = response.choice;
    out.expected = task.options[task.answerIndex];
    return out;
  }
  if (task.mech === 'fixit') {
    if (response.token !== task.wrongIndex) {
      out.wrongToken = true;
      out.expected = task.answer;
      return out;
    }
  }
  const hint = response.hint || 0;
  if (hint >= 3) {
    out.revealed = true;
    return out;
  }
  const r = checkTyped(response.text || '', task.accepted || [], { alternatives: task.alternatives, forms: task.forms, known });
  out.check = r.result;
  if (r.result === 'exact' || r.result === 'typo') {
    out.correct = true;
    out.typo = r.result === 'typo';
    out.outcome = hint > 0 ? 'hint' : 'good';
  } else if (r.result === 'alternative') {
    out.alternative = true;
    out.outcome = 'hint';
  } else if (r.result === 'form') {
    out.formSlip = true;
    out.outcome = 'hint';
  }
  return out;
}

// ---------- applying an answer ----------------------------------------------------------

/**
 * Grade and apply. Returns {result, events}; mutates state and session.
 * Calling it twice for the same task returns the stored result and changes nothing.
 */
export function submitAnswer(state, lex, session, taskId, response, { today, now = Date.now() } = {}) {
  if (session.results[taskId]) return { result: session.results[taskId], events: { duplicate: true } };
  const task = session.tasks.find((t) => t.id === taskId);
  if (!task) return { result: null, events: { unknownTask: true } };
  if (session.mode === 'sprint' && now > session.endsAt + 1500) {
    return { result: null, events: { timeUp: true } };
  }
  const g = grade(task, response, lex);
  const events = { unlocked: [], levelUp: null, xp: 0, fixedMistake: false, longReview: 0, followUp: null };
  const levelBefore = levelInfo(state.stats.xp).level;
  const practice = !!(task.practice || MECHANICS[task.mech]?.practice || session.mode === 'sprint');
  const mechKey = task.mech === 'intro' ? 'quickpick' : task.mech;

  if (state.awards.day !== today) state.awards = { day: today, counts: {} };
  const day = (state.days[today] = state.days[today] || { graded: 0, correct: 0, xp: 0, sessions: 0, newWords: 0 });

  const touched = task.mech === 'match' ? task.wordIds : [task.wordId];
  let fixedAny = false;
  for (const id of touched) {
    const outcome = task.mech === 'match' ? g.perWord[id] : g.outcome;
    const before = state.words[id];
    if (!before && practice) continue;
    const { rec, events: ev } = applyAnswer(before || null, {
      outcome,
      skills: task.skills,
      active: task.active,
      mechanic: mechKey,
      contextKey: task.contextKey,
      today,
      practice,
      typo: g.typo,
    });
    state.words[id] = rec;
    if (!before) day.newWords += 1;
    if (ev.fixedMistake) fixedAny = true;
    if (ev.longReview >= 7) {
      state.stats.longReviews = (state.stats.longReviews || 0) + 1;
      events.longReview = ev.longReview;
    }
  }
  events.fixedMistake = fixedAny;

  // XP (once per task id)
  let xp = 0;
  if (!ledgerHas(state.ledger, taskId)) {
    const wordAwardsToday = state.awards.counts[task.wordId] || 0;
    if (session.mode === 'sprint') {
      const earned = session.xp;
      xp = g.outcome === 'good' ? Math.min(XP.sprint, Math.max(0, XP.sprintCap - earned)) : 0;
    } else {
      xp = answerXp({ outcome: g.outcome, active: task.active, typo: g.typo, alternative: g.alternative, wordAwardsToday, fixedMistake: fixedAny, mode: session.mode });
    }
    if (g.revealed) xp = 0;
    state.ledger = ledgerAdd(state.ledger, taskId);
    if (xp > 0 && session.mode !== 'sprint') state.awards.counts[task.wordId] = wordAwardsToday + 1;
  }
  state.stats.xp += xp;
  day.xp += xp;
  events.xp = xp;

  // statistics
  state.stats.graded += 1;
  day.graded += 1;
  session.graded += 1;
  if (g.outcome === 'good') {
    state.stats.correct += 1;
    day.correct += 1;
    session.correct += 1;
    state.stats.mech[mechKey] = (state.stats.mech[mechKey] || 0) + 1;
  }
  if (g.outcome === 'hint') session.hints += 1;
  if (g.outcome === 'bad') {
    for (const id of touched) if ((task.mech !== 'match' || g.perWord[id] === 'bad') && !session.mistakes.includes(id)) session.mistakes.push(id);
  }
  session.xp += xp;

  // one follow-up per word per session after a mistake (never in Sprint / Boss)
  if (g.outcome === 'bad' && task.mech !== 'match' && !['sprint', 'boss'].includes(session.mode) && !session.requeued.includes(task.wordId)) {
    session.requeued.push(task.wordId);
    const hasLaterTask = session.tasks.slice(session.pos + 1).some((t) => t.wordId === task.wordId);
    if (!hasLaterTask) {
      const rng = makeRng((session.seed + session.counter * 31337) >>> 0);
      const fu = makeFollowUp(task, { ...envFor(state, lex, session, rng), rng });
      const at = Math.min(session.pos + 4, session.tasks.length);
      const later = session.tasks.slice(session.pos + 1);
      const fillerIdx = later.findIndex((t) => t.filler && !session.results[t.id]);
      if (fillerIdx >= 0) session.tasks.splice(session.pos + 1 + fillerIdx, 1);
      addTask(session, fu, fillerIdx >= 0 ? Math.min(at, session.tasks.length) : at);
      events.followUp = fu.id;
    }
  } else if (task.role === 'intro') {
    session.requeued.push(task.wordId);
  }

  const result = { ...g, xp, taskId, mech: task.mech, wordId: task.wordId };
  session.results[taskId] = result;

  const levelAfter = levelInfo(state.stats.xp).level;
  if (levelAfter > levelBefore) events.levelUp = levelAfter;
  events.unlocked = unlock(state, lex, today, now);
  return { result, events };
}

function unlock(state, lex, today, now) {
  const ids = newlyUnlocked(state, lex, today);
  for (const id of ids) state.achievements[id] = new Date(now).toISOString();
  return ids;
}

export function advance(session) {
  if (session.pos < session.tasks.length) session.pos += 1;
  return currentTask(session);
}

// ---------- finishing ---------------------------------------------------------------------

export function finishSession(state, lex, session, { today, now = Date.now() } = {}) {
  if (session.finished) return session.summary;
  session.finished = true;
  const events = { unlocked: [], levelUp: null, bonus: 0 };
  const levelBefore = levelInfo(state.stats.xp).level;
  const answered = Object.keys(session.results).length;
  const day = (state.days[today] = state.days[today] || { graded: 0, correct: 0, xp: 0, sessions: 0, newWords: 0 });
  const counts = answered >= (session.mode === 'sprint' ? 5 : Math.min(5, session.tasks.length));
  if (counts) {
    const last = state.stats.lastSessionDay;
    if (last && diffDays(last, today) >= 3) state.stats.comeback = (state.stats.comeback || 0) + 1;
    state.stats.sessions += 1;
    state.stats.lastSessionDay = today;
    day.sessions += 1;
  }
  const bonusId = session.id + ':bonus';
  const bonusEligible = session.mode === 'sprint' ? session.correct >= 10 : answered >= 10;
  if (bonusEligible && !ledgerHas(state.ledger, bonusId)) {
    const bonus = session.mode === 'sprint' ? 10 : XP.session;
    state.ledger = ledgerAdd(state.ledger, bonusId);
    state.stats.xp += bonus;
    day.xp += bonus;
    session.xp += bonus;
    events.bonus = bonus;
  }
  const accuracy = session.graded ? session.correct / session.graded : 0;
  if (session.mode === 'sprint') state.stats.sprintBest = Math.max(state.stats.sprintBest || 0, session.correct);
  if (session.mode === 'boss' && answered >= 10) {
    state.stats.bossBest = Math.max(state.stats.bossBest || 0, Math.round(accuracy * 100));
    if (accuracy >= 0.8) state.stats.bossPassed = (state.stats.bossPassed || 0) + 1;
  }
  if (session.mode !== 'sprint' && answered >= 10 && session.mistakes.length === 0 && session.hints === 0 && session.correct === session.graded) {
    state.stats.perfect = (state.stats.perfect || 0) + 1;
  }
  state.stats.bestStreak = Math.max(state.stats.bestStreak || 0, streakInfo(state.days, today).best);
  const levelAfter = levelInfo(state.stats.xp).level;
  if (levelAfter > levelBefore) events.levelUp = levelAfter;
  events.unlocked = unlock(state, lex, today, now);
  const hard = [...new Set(session.mistakes)];
  session.summary = {
    mode: session.mode,
    answered,
    graded: session.graded,
    correct: session.correct,
    hints: session.hints,
    accuracy,
    xp: session.xp,
    hard,
    events,
  };
  return session.summary;
}
