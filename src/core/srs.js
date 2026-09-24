// Spaced repetition for Crux — a documented starting heuristic, not an
// "optimal" algorithm. See docs/LEARNING.md for the rules in plain words.
//
// Every word has an interval ladder position `step`:
//   step -1  introduced today, not yet successfully recalled on a later day
//   step 0..5  next interval = LADDER[step] days  (1, 3, 7, 14, 30, 60)
//
// One scheduling decision per word per local day:
//   * the first successful unaided answer of the day moves the word one step
//     up the ladder (due = today + LADDER[step]);
//   * a hinted answer keeps the step and brings the word back tomorrow;
//   * a wrong answer moves the word two steps down (never below 0) and brings
//     it back tomorrow; this penalty is applied at most once per day;
//   * after a mistake the word also returns later in the same session with a
//     different exercise and context (handled by the session engine, once).
// Sprint and Match answers are "practice": they update skill tallies only and
// never change the schedule, success days or the mistake list.

import { addDays, diffDays } from './dates.js';

export const LADDER = [1, 3, 7, 14, 30, 60];
export const SKILLS = ['rec', 'rcl', 'ctx']; // recognition, recall (production), context use
const KEEP_DAYS = 12;

export function newRecord(today) {
  return {
    step: -1,
    due: today,
    intro: today,
    last: null, // last day with any graded answer
    sched: null, // last day the interval moved up (or was reset by a hint)
    pen: null, // last day a mistake penalty was applied
    lastOk: null, // last day with a successful scheduled review
    ok: 0,
    fail: 0,
    hints: 0,
    typos: 0,
    sk: { rec: [0, 0], rcl: [0, 0], ctx: [0, 0] },
    okDays: [], // distinct days with a correct unaided answer
    rclDays: [], // distinct days with a correct unaided *production* answer
    maxInt: 0, // longest gap (days) bridged by a successful review
    lapses: 0, // mistakes on words that had reached a 7+ day interval
    err: 0, // open mistakes (0..3) -> Mistake Lab
    errAt: null,
    fixed: 0, // mistakes later answered correctly
    mech: [], // recent mechanics (newest first)
    ctx: [], // recent context keys (newest first)
    lastOutcome: null,
  };
}

function pushDay(list, day) {
  if (!list.includes(day)) list.push(day);
  if (list.length > KEEP_DAYS) list.splice(0, list.length - KEEP_DAYS);
}

/**
 * Apply one graded answer.
 * @param {object|null} rec  current record (null for a new word)
 * @param {object} a  { outcome: 'good'|'hint'|'bad', skills: [...], active: bool,
 *                      mechanic, contextKey, today, practice: bool, typo: bool }
 * @returns {{rec: object, events: object}}
 */
export function applyAnswer(rec, a) {
  const today = a.today;
  const r = rec ? structuredCloneSafe(rec) : newRecord(today);
  const ev = { scheduled: false, fixedMistake: false, longReview: 0, penalty: false, firstSeen: !rec };
  r.last = today;
  r.lastOutcome = a.outcome;
  for (const s of a.skills || []) {
    if (!r.sk[s]) r.sk[s] = [0, 0];
    r.sk[s][a.outcome === 'good' ? 0 : 1] += 1;
  }
  if (a.mechanic) r.mech = [a.mechanic, ...r.mech.filter((m) => m !== a.mechanic)].slice(0, 4);
  if (a.contextKey) r.ctx = [a.contextKey, ...r.ctx.filter((k) => k !== a.contextKey)].slice(0, 6);
  if (a.typo) r.typos += 1;

  // Practice answers (Sprint, Match) only feed the skill tallies.
  if (a.practice) return { rec: r, events: ev };

  if (a.outcome === 'good') {
    r.ok += 1;
    pushDay(r.okDays, today);
    if (a.active) pushDay(r.rclDays, today);
    if (r.err > 0) {
      r.err -= 1;
      r.fixed += 1;
      ev.fixedMistake = true;
    }
  } else if (a.outcome === 'hint') {
    r.hints += 1;
  } else {
    r.fail += 1;
    r.err = Math.min(3, r.err + 1);
    r.errAt = today;
  }

  {
    if (a.outcome === 'bad') {
      if (r.pen !== today) {
        if (r.step >= 2) r.lapses += 1;
        r.step = Math.max(0, r.step - 2);
        r.due = addDays(today, 1);
        r.pen = today;
        ev.penalty = true;
        ev.scheduled = true;
      }
    } else if (r.sched !== today && r.pen !== today) {
      if (a.outcome === 'good') {
        if (r.lastOk) {
          const gap = diffDays(r.lastOk, today);
          if (gap > r.maxInt) r.maxInt = gap;
          ev.longReview = gap;
        }
        r.step = Math.min(r.step + 1, LADDER.length - 1);
        r.due = addDays(today, LADDER[r.step]);
        r.lastOk = today;
      } else {
        r.step = Math.max(r.step, 0);
        r.due = addDays(today, 1);
      }
      r.sched = today;
      ev.scheduled = true;
    }
  }
  return { rec: r, events: ev };
}

export function wordState(rec) {
  if (!rec) return 'new';
  if (
    rec.okDays.length >= 3 &&
    rec.rclDays.length >= 2 &&
    rec.maxInt >= 7 &&
    rec.step >= 3 &&
    rec.lastOutcome === 'good'
  ) {
    return 'established';
  }
  if (rec.step >= 2 && rec.okDays.length >= 2) return 'review';
  return 'learning';
}

export function isDue(rec, today) {
  return !!rec && rec.due <= today;
}

export function skillAccuracy(rec, skill) {
  if (!rec || !rec.sk[skill]) return null;
  const [ok, fail] = rec.sk[skill];
  return ok + fail ? ok / (ok + fail) : null;
}

function structuredCloneSafe(o) {
  return JSON.parse(JSON.stringify(o));
}
