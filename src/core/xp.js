// XP and levels. XP rewards learning actions, never raw clicks:
//   * wrong answers, revealed answers and intro cards give 0 XP;
//   * every task instance can be rewarded once (ledger of task ids), so
//     re-submitting or reloading the page cannot farm XP;
//   * the same word gives full XP at most twice per day, then 1 XP;
//   * Sprint gives a small, capped amount.
// The game level is a motivation counter only; it is NOT a CEFR level.

export const XP = {
  typed: 10, // correct unaided production (typing)
  typo: 8, // correct but with a small spelling slip
  choice: 6, // correct choice / recognition
  hinted: 3, // correct after a hint
  alternative: 3, // acceptable alternative word, not the target
  fixBonus: 4, // correcting a word that was previously missed
  session: 20, // finishing a Daily Mix / Mistake Lab / Boss / Free session (>= 10 tasks)
  sprint: 2, // per correct Sprint answer
  sprintCap: 40,
  perWordFullDaily: 2,
};

export function answerXp({ outcome, active, typo, alternative, wordAwardsToday = 0, fixedMistake, mode }) {
  if (outcome === 'bad' || outcome === 'revealed') return 0;
  if (mode === 'sprint') return outcome === 'good' ? XP.sprint : 0;
  let base;
  if (alternative) base = XP.alternative;
  else if (outcome === 'hint') base = XP.hinted;
  else if (active) base = typo ? XP.typo : XP.typed;
  else base = XP.choice;
  if (wordAwardsToday >= XP.perWordFullDaily) base = 1;
  if (fixedMistake && outcome === 'good') base += XP.fixBonus;
  return base;
}

// Cumulative XP needed to reach level n: 0, 100, 300, 600, 1000, 1500, ...
export function levelThreshold(n) {
  return 50 * (n - 1) * n;
}

export function levelInfo(xp) {
  let level = 1;
  while (xp >= levelThreshold(level + 1)) level += 1;
  const from = levelThreshold(level);
  const to = levelThreshold(level + 1);
  return { level, from, to, into: xp - from, span: to - from, pct: (xp - from) / (to - from) };
}

// Bounded ledger of rewarded task ids.
export function ledgerHas(ledger, id) {
  return Array.isArray(ledger) && ledger.includes(id);
}

export function ledgerAdd(ledger, id, max = 3000) {
  const next = Array.isArray(ledger) ? ledger.slice() : [];
  if (!next.includes(id)) next.push(id);
  if (next.length > max) next.splice(0, next.length - max);
  return next;
}
