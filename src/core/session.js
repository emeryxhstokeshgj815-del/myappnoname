// Session planning: which words, in which order, with which exercise.
// Exercise type (mechanic) and session mode are independent: every mode picks
// mechanics from its allowed set, balancing variety and the learner's weakest skill.

import { MECHANICS, PRODUCTION, hasMechanic, buildTask, CORE_MECHANICS } from './tasks.js';
import { skillAccuracy } from './srs.js';
import { makeRng } from './rng.js';

export const MODES = {
  daily: { label: 'Daily Mix', hints: true, lengths: [10, 20] },
  sprint: { label: 'Sprint', hints: false, seconds: 60 },
  mistakes: { label: 'Mistake Lab', hints: true, lengths: [10, 20] },
  boss: { label: 'Boss Round', hints: false, lengths: [10, 20] },
  free: { label: 'Free Practice', hints: true, lengths: [10, 20] },
  word: { label: 'Word practice', hints: true },
};

const ALL = [...CORE_MECHANICS, 'listen'];
const BOSS = ['recall', 'gap', 'trio', 'wordform', 'rewrite', 'fixit', 'nuance', 'collocation', 'reply', 'listen'];
const SPRINT = ['quickpick', 'gap', 'collocation', 'nuance'];

export const MIN_KNOWN = { sprint: 4, boss: 10 };

// ---------- word pools ----------------------------------------------------

export function dueIds(state, today) {
  return Object.entries(state.words)
    .filter(([, r]) => r.due <= today)
    .sort(([, a], [, b]) => (a.due < b.due ? -1 : a.due > b.due ? 1 : b.err - a.err || a.step - b.step))
    .map(([id]) => id);
}

export function knownIds(state) {
  return Object.entries(state.words)
    .filter(([, r]) => r.ok >= 1)
    .sort(([, a], [, b]) => ((a.last || '') < (b.last || '') ? -1 : 1))
    .map(([id]) => id);
}

export function mistakeIds(state) {
  return Object.entries(state.words)
    .filter(([, r]) => r.err > 0)
    .sort(([, a], [, b]) => ((a.errAt || '') > (b.errAt || '') ? -1 : 1))
    .map(([id]) => id);
}

export function newIds(lex, state, topics) {
  return lex.words
    .filter((w) => !state.words[w.id] && (!topics || topics.includes(w.topic)))
    .sort((a, b) => a.rank - b.rank)
    .map((w) => w.id);
}

// ---------- mechanic choice -------------------------------------------------

export function chooseMechanic(word, rec, opt) {
  const { allowed = ALL, usage = {}, prev = null, voice = false, rng, avoid = [] } = opt;
  let cands = allowed.filter((m) => m !== 'match' && hasMechanic(word, m) && (m !== 'listen' || voice));
  if (!cands.length) cands = ['gap'];
  const step = rec ? rec.step : -1;
  const needRecall = !rec || rec.rclDays.length < 2;
  const ctxAcc = skillAccuracy(rec, 'ctx');
  const weights = cands.map((m) => {
    let w = 1;
    if (PRODUCTION.has(m)) w *= step >= 1 || needRecall ? 1.6 : 0.8;
    if (m === 'quickpick') w *= step >= 2 ? 0.35 : 1;
    if (['gap', 'collocation', 'nuance', 'fixit', 'reply', 'trio'].includes(m) && ctxAcc !== null && ctxAcc < 0.7) w *= 1.5;
    if (rec && rec.mech[0] === m) w *= 0.15;
    else if (rec && rec.mech.includes(m)) w *= 0.5;
    if (avoid.includes(m)) w *= 0.05;
    w /= 1 + 0.9 * (usage[m] || 0);
    if (m === prev) w *= 0.02;
    if (m === 'listen') w *= 0.6;
    return w;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let x = rng.next() * total;
  for (let i = 0; i < cands.length; i++) {
    x -= weights[i];
    if (x <= 0) return cands[i];
  }
  return cands[cands.length - 1];
}

// ---------- plans -------------------------------------------------------------

// Intros are spread through the session; each new word is asked again (as a
// production task) once 2+ other tasks have passed, keeping at most three
// introduced-but-not-yet-recalled words "in the air".
function interleave(reviews, fresh, warmup) {
  const out = warmup ? [warmup] : [];
  const pending = [];
  let ri = 0;
  let ni = 0;
  while (ri < reviews.length || ni < fresh.length || pending.length) {
    const pos = out.length;
    const ready = pending.length && pending[0].earliest <= pos;
    if (ready && (pending.length >= 3 || ni >= fresh.length)) {
      out.push({ role: 'recall-new', wordId: pending.shift().wordId });
      continue;
    }
    if (ni < fresh.length && (ri >= reviews.length || pos % 3 === 1)) {
      out.push({ role: 'intro', wordId: fresh[ni] });
      pending.push({ wordId: fresh[ni], earliest: pos + 3 });
      ni += 1;
      continue;
    }
    if (ri < reviews.length) {
      out.push(reviews[ri]);
      ri += 1;
      continue;
    }
    out.push({ role: 'recall-new', wordId: pending.shift().wordId });
  }
  return out;
}

export function planDaily({ lex, state, today, length, rng }) {
  const due = dueIds(state, today);
  const day = state.days[today] || {};
  let allowance = Math.max(0, (state.settings.newPerDay ?? 10) - (day.newWords || 0));
  let slots = length;
  const known = knownIds(state);
  let warmup = null;
  if (known.length >= 6 && due.length >= 2) {
    const around = [...due.slice(0, 4), ...known.slice(0, 8)];
    warmup = { role: 'warmup', mech: 'match', wordId: around[0], pool: [...new Set(around)] };
    slots -= 1;
  }
  const reviews = due.slice(0, slots).map((id) => ({ role: 'review', wordId: id }));
  slots -= reviews.length;
  const unseen = newIds(lex, state);
  const fresh = [];
  while (slots >= 2 && allowance > 0 && fresh.length < unseen.length) {
    fresh.push(unseen[fresh.length]);
    slots -= 2;
    allowance -= 1;
  }
  const inPlan = new Set([...reviews.map((r) => r.wordId), ...fresh]);
  const extra = known.filter((id) => !inPlan.has(id) && state.words[id].due > today);
  while (slots > 0 && extra.length) {
    reviews.push({ role: 'extra', wordId: extra.shift(), filler: true });
    slots -= 1;
  }
  while (slots >= 2 && fresh.length < unseen.length) {
    fresh.push(unseen[fresh.length]);
    slots -= 2;
  }
  if (slots === 1 && fresh.length < unseen.length) {
    // a last intro without a same-session recall (it is due tomorrow anyway)
    reviews.push({ role: 'intro-only', wordId: unseen[fresh.length] });
  }
  return interleave(rng.shuffle(reviews.filter((r) => r.role !== 'intro-only')), fresh, warmup).concat(
    reviews.filter((r) => r.role === 'intro-only').map((r) => ({ role: 'intro', wordId: r.wordId })),
  );
}

export function planMistakes({ state, today, length }) {
  const ids = mistakeIds(state).slice(0, length);
  const specs = ids.map((id) => ({ role: 'mistake', wordId: id }));
  if (specs.length < length) {
    const hard = Object.entries(state.words)
      .filter(([id, r]) => !ids.includes(id) && (r.lapses > 0 || r.fail > r.ok))
      .sort(([, a], [, b]) => b.fail - b.ok - (a.fail - a.ok))
      .map(([id]) => id);
    for (const id of hard.slice(0, length - specs.length)) specs.push({ role: 'hard', wordId: id });
  }
  if (specs.length < length) {
    const used = new Set(specs.map((s) => s.wordId));
    for (const id of dueIds(state, today)) {
      if (specs.length >= length) break;
      if (!used.has(id)) specs.push({ role: 'review', wordId: id });
    }
  }
  return specs;
}

export function planBoss({ state, length, rng }) {
  const ids = knownIds(state);
  const ranked = rng.shuffle(ids).sort((a, b) => (state.words[b].step || 0) - (state.words[a].step || 0));
  return rng.shuffle(ranked.slice(0, Math.max(length * 2, 20))).slice(0, length).map((id) => ({ role: 'boss', wordId: id }));
}

export function planFree({ lex, state, today, length, rng, config }) {
  const topics = config.topics && config.topics.length ? config.topics : null;
  const mechs = config.mechanics && config.mechanics.length ? config.mechanics.filter((m) => m !== 'match') : null;
  const fits = (id) => {
    const w = lex.get(id);
    return (!topics || topics.includes(w.topic)) && (!mechs || !mechs.length || mechs.some((m) => hasMechanic(w, m)));
  };
  const inTopic = fits;
  const due = dueIds(state, today).filter(inTopic);
  const known = knownIds(state).filter((id) => inTopic(id) && !due.includes(id));
  const specs = [];
  for (const id of [...due, ...known]) {
    if (specs.length >= length) break;
    specs.push({ role: 'review', wordId: id });
  }
  const unseen = newIds(lex, state, topics).filter(fits);
  const fresh = [];
  let slots = length - specs.length;
  while (slots >= 2 && fresh.length < unseen.length) {
    fresh.push(unseen[fresh.length]);
    slots -= 2;
  }
  if (slots === 1 && fresh.length < unseen.length) fresh.push(unseen[fresh.length]);
  return interleave(rng.shuffle(specs), fresh, null).slice(0, length + 1);
}

export function planWord({ wordId, state }) {
  const rec = state.words[wordId];
  if (!rec) return [{ role: 'intro', wordId }, { role: 'recall-new', wordId }, { role: 'review', wordId }];
  return [{ role: 'review', wordId }, { role: 'review', wordId }, { role: 'review', wordId }];
}

// ---------- materialise specs into tasks ----------------------------------------

export function allowedFor(mode, config) {
  if (mode === 'boss') return BOSS;
  if (mode === 'sprint') return SPRINT;
  if (mode === 'free' && config?.mechanics?.length) return config.mechanics;
  return ALL;
}

export function makeTask(spec, env) {
  const { lex, state, rng, mode, voice, usage, prev, config } = env;
  const word = lex.get(spec.wordId);
  const rec = state.words[spec.wordId];
  const allowed = allowedFor(mode, config);
  if (spec.role === 'intro') {
    const check = buildTask('quickpick', word, { lex, rng, rec, variant: 'en-ru', showContext: true });
    return { ...check, mech: 'intro', check: true, role: 'intro', skills: ['rec'] };
  }
  if (spec.mech === 'match') {
    return { ...buildTask('match', word, { lex, rng, rec, pool: spec.pool }), role: spec.role };
  }
  const knownPool = Object.keys(state.words).filter((id) => state.words[id].ok >= 1);
  if (mode === 'free' && allowed.includes('match') && spec.role === 'review' && knownPool.length >= 4 &&
      (allowed.length === 1 || rng.next() < 1 / allowed.length)) {
    return { ...buildTask('match', word, { lex, rng, rec, pool: knownPool }), role: spec.role };
  }
  let mech;
  let variant;
  if (spec.role === 'recall-new') {
    const prod = ['recall', 'gap', 'trio', 'listen'].filter((m) => allowed.includes(m) || mode !== 'free');
    mech = chooseMechanic(word, rec, { allowed: prod.length ? prod : allowed, usage, prev, voice, rng });
    if (mech === 'gap') variant = 'typed';
  } else {
    const avoid = spec.role === 'mistake' && rec ? rec.mech.slice(0, 1) : [];
    mech = chooseMechanic(word, rec, { allowed, usage, prev, voice, rng, avoid });
    if (mech === 'gap') {
      const typed = mode === 'boss' || (mode !== 'sprint' && ((rec && rec.step >= 1) || rng.next() < 0.3));
      variant = typed ? 'typed' : 'choice';
      if (mode === 'sprint') variant = 'choice';
      if (mode === 'free' && config?.gapMode) variant = config.gapMode;
    }
  }
  const task = buildTask(mech, word, { lex, rng, rec, variant, pool: env.pool, dirPref: state.settings?.quickDir });
  task.role = spec.role;
  if (spec.filler) task.filler = true;
  return task;
}

// A follow-up after a mistake: same word, different mechanic and context.
export function makeFollowUp(task, env) {
  const { lex, state, rng, voice, mode, config } = env;
  const word = lex.get(task.wordId);
  const rec = state.words[task.wordId];
  const allowed = allowedFor(mode, config).filter((m) => m !== task.mech && m !== 'match');
  const mech = chooseMechanic(word, rec, { allowed, usage: env.usage, prev: task.mech, voice, rng, avoid: [task.mech] });
  const t = buildTask(mech, word, { lex, rng, rec, variant: mech === 'gap' ? (task.variant === 'typed' ? 'choice' : 'typed') : undefined, dirPref: state.settings?.quickDir });
  t.role = 'retry';
  return t;
}

export function sessionSeed() {
  return (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
}

export { makeRng, MECHANICS };
