// Local persistence. Progress is saved to localStorage after every answer.
// If storage is unavailable (private mode, blocked site data, quota), the app
// keeps working in memory and tells the learner that progress will not be kept.

import { isValidDay } from './dates.js';

export const STORAGE_KEY = 'crux:v1';
export const SCHEMA = 1;

export function defaultSettings() {
  return { sound: true, volume: 0.6, newPerDay: 10, length: 10, voice: '', quickDir: 'mixed' };
}

export function emptyState(now = new Date()) {
  return {
    app: 'Crux',
    schema: SCHEMA,
    createdAt: now.toISOString(),
    settings: defaultSettings(),
    words: {},
    favorites: {},
    days: {},
    stats: { xp: 0, graded: 0, correct: 0, sessions: 0, mech: {}, sprintBest: 0, bossPassed: 0, bossBest: 0, perfect: 0, longReviews: 0, comeback: 0, lastSessionDay: null, bestStreak: 0 },
    achievements: {},
    ledger: [],
    awards: { day: null, counts: {} },
    session: null,
  };
}

export function storageAvailable(ls = globalThis.localStorage) {
  try {
    if (!ls) return false;
    const k = '__crux_probe__';
    ls.setItem(k, '1');
    const ok = ls.getItem(k) === '1';
    ls.removeItem(k);
    return ok;
  } catch {
    return false;
  }
}

// ---------- validation ------------------------------------------------------------

const REC_NUM = ['step', 'ok', 'fail', 'hints', 'typos', 'maxInt', 'lapses', 'err', 'fixed'];

function validRecord(r) {
  if (!r || typeof r !== 'object') return false;
  for (const k of REC_NUM) if (r[k] !== undefined && typeof r[k] !== 'number') return false;
  if (typeof r.step !== 'number' || r.step < -1 || r.step > 5) return false;
  if (!isValidDay(r.due) || !isValidDay(r.intro)) return false;
  if (!Array.isArray(r.okDays) || !Array.isArray(r.rclDays)) return false;
  if (![...r.okDays, ...r.rclDays].every(isValidDay)) return false;
  if (!r.sk || typeof r.sk !== 'object') return false;
  return true;
}

/**
 * Check an object that claims to be Crux progress. Returns {ok, state?, errors[]}.
 * Unknown word ids are dropped (the dictionary may have changed), not fatal.
 */
export function validateState(obj, knownIds) {
  const errors = [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, errors: ['Not a JSON object.'] };
  if (obj.app !== 'Crux') errors.push('This file was not exported from Crux.');
  if (typeof obj.schema !== 'number' || obj.schema > SCHEMA) errors.push('Unsupported file version.');
  if (!obj.words || typeof obj.words !== 'object') errors.push('Missing word progress.');
  if (!obj.days || typeof obj.days !== 'object') errors.push('Missing study days.');
  if (!obj.stats || typeof obj.stats !== 'object') errors.push('Missing statistics.');
  if (errors.length) return { ok: false, errors };
  const base = emptyState();
  const state = {
    ...base,
    createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : base.createdAt,
    settings: { ...base.settings, ...(obj.settings && typeof obj.settings === 'object' ? obj.settings : {}) },
    stats: { ...base.stats, ...obj.stats, mech: { ...(obj.stats.mech || {}) } },
    achievements: {},
    favorites: {},
    days: {},
    words: {},
    ledger: Array.isArray(obj.ledger) ? obj.ledger.filter((x) => typeof x === 'string').slice(-3000) : [],
    awards: { day: null, counts: {} },
    session: null,
  };
  let dropped = 0;
  let bad = 0;
  for (const [id, r] of Object.entries(obj.words)) {
    if (knownIds && !knownIds.has(id)) {
      dropped += 1;
      continue;
    }
    if (!validRecord(r)) {
      bad += 1;
      continue;
    }
    state.words[id] = r;
  }
  if (bad) errors.push(`${bad} word records are damaged.`);
  for (const [k, d] of Object.entries(obj.days)) {
    if (isValidDay(k) && d && typeof d === 'object') state.days[k] = { graded: +d.graded || 0, correct: +d.correct || 0, xp: +d.xp || 0, sessions: +d.sessions || 0, newWords: +d.newWords || 0 };
  }
  for (const [k, v] of Object.entries(obj.achievements || {})) if (typeof v === 'string') state.achievements[k] = v;
  for (const [k, v] of Object.entries(obj.favorites || {})) if (v === true && (!knownIds || knownIds.has(k))) state.favorites[k] = true;
  for (const k of ['xp', 'graded', 'correct', 'sessions']) {
    if (typeof state.stats[k] !== 'number' || state.stats[k] < 0 || !Number.isFinite(state.stats[k])) errors.push(`Invalid statistic: ${k}.`);
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, state, dropped };
}

// ---------- load / save ---------------------------------------------------------------

export function loadState(ls, knownIds) {
  if (!storageAvailable(ls)) return { state: emptyState(), status: 'unavailable' };
  let raw;
  try {
    raw = ls.getItem(STORAGE_KEY);
  } catch {
    return { state: emptyState(), status: 'unavailable' };
  }
  if (!raw) return { state: emptyState(), status: 'fresh' };
  try {
    const parsed = JSON.parse(raw);
    const v = validateState(parsed, knownIds);
    if (!v.ok) throw new Error(v.errors.join(' '));
    v.state.session = parsed.session && typeof parsed.session === 'object' ? parsed.session : null;
    v.state.awards = parsed.awards && typeof parsed.awards === 'object' ? parsed.awards : { day: null, counts: {} };
    return { state: v.state, status: 'loaded' };
  } catch (e) {
    try {
      ls.setItem(STORAGE_KEY + ':damaged:' + Date.now(), raw);
    } catch {
      /* ignore */
    }
    return { state: emptyState(), status: 'damaged', error: String(e.message || e) };
  }
}

export function saveState(ls, state) {
  try {
    ls.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function exportJson(state) {
  const out = { ...state, session: null, exportedAt: new Date().toISOString() };
  return JSON.stringify(out, null, 1);
}

export function importJson(text, knownIds) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['The file is not valid JSON.'] };
  }
  return validateState(obj, knownIds);
}

// ---------- TSV for Anki / Quizlet -------------------------------------------------------

function clean(s) {
  return String(s || '').replace(/[\t\r\n]+/g, ' ').replace(/\[\[([^\]]+)\]\]/g, '$1').trim();
}

export function exportTsv(words, format = 'anki') {
  const lines = [];
  for (const w of words) {
    const term = w.lemma;
    const back = `${w.translationsRu.join(', ')} — ${w.definitionEn}`;
    if (format === 'quizlet') lines.push(`${clean(term)}\t${clean(back)}`);
    else lines.push(`${clean(term)}\t${clean(back)}\t${clean(w.examples[0]?.text)}\t${clean(w.partOfSpeech)}`);
  }
  return lines.join('\n') + '\n';
}
