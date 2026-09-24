// Study days and streaks. A day counts only when real learning happened on
// the device's local date: a finished session (any mode) or at least
// MIN_ANSWERS graded answers. Opening the app does not count.

import { addDays } from './dates.js';

export const MIN_ANSWERS = 10;

export function isStudyDay(d) {
  return !!d && ((d.sessions || 0) >= 1 || (d.graded || 0) >= MIN_ANSWERS);
}

export function streakInfo(days, today) {
  const done = isStudyDay(days[today]);
  let cur = 0;
  let d = done ? today : addDays(today, -1);
  while (isStudyDay(days[d])) {
    cur += 1;
    d = addDays(d, -1);
  }
  return { current: cur, todayDone: done, best: bestStreak(days), studyDays: countStudyDays(days) };
}

export function countStudyDays(days) {
  return Object.keys(days).filter((k) => isStudyDay(days[k])).length;
}

export function bestStreak(days) {
  const keys = Object.keys(days).filter((k) => isStudyDay(days[k])).sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const k of keys) {
    run = prev && addDays(prev, 1) === k ? run + 1 : 1;
    if (run > best) best = run;
    prev = k;
  }
  return best;
}
