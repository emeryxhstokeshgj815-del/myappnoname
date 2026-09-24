import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize, checkTyped, editDistance, firstLetterHint } from '../../src/core/answer.js';
import { answerXp, levelInfo, ledgerAdd, ledgerHas, XP } from '../../src/core/xp.js';
import { streakInfo, bestStreak, isStudyDay } from '../../src/core/streak.js';

test('normalisation: case, spaces, typographic apostrophes, contractions', () => {
  assert.equal(normalize('  Abolished.  '), 'abolished');
  assert.equal(normalize('it wasn’t   abolished'), 'it was not abolished');
  assert.equal(normalize('They’ve'), 'they have');
  assert.equal(normalize('can’t'), 'cannot');
});

test('exact, alternative, form slip, typo and wrong answers', () => {
  const known = new Set(['adapt', 'adopt', 'abolishes', 'abolish']);
  assert.equal(checkTyped('Abolished', ['abolished']).result, 'exact');
  assert.equal(checkTyped('banned', ['abolished'], { alternatives: ['banned'] }).result, 'alternative');
  assert.equal(checkTyped('abolishes', ['abolished'], { forms: ['abolishes', 'abolish'] }).result, 'form');
  assert.equal(checkTyped('abolsihed', ['abolished'], { known }).result, 'typo');
  assert.equal(checkTyped('adapt', ['adopt'], { known }).result, 'wrong', 'a different real word is not a typo');
  assert.equal(checkTyped('xyz', ['abolished'], { known }).result, 'wrong');
  assert.equal(checkTyped('   ', ['abolished']).result, 'empty');
  assert.equal(checkTyped('cat', ['cot']).result, 'wrong', 'short words get no typo tolerance');
});

test('multi-word answers are matched as whole phrases, not substrings', () => {
  const acc = ['was abolished', 'got abolished'];
  assert.equal(checkTyped('was abolished', acc).result, 'exact');
  assert.equal(checkTyped('abolished', acc).result, 'wrong');
  assert.equal(checkTyped('was abolished last year', acc).result, 'wrong');
  assert.equal(checkTyped('was abolishd', acc, { known: new Set() }).result, 'typo');
});

test('edit distance counts transpositions as one edit', () => {
  assert.equal(editDistance('abolish', 'aoblish'), 1);
  assert.equal(editDistance('abc', 'abc'), 0);
});

test('first-letter hint', () => {
  assert.match(firstLetterHint('abolish'), /^a /);
});

test('XP: wrong and revealed answers give nothing; hints give less', () => {
  assert.equal(answerXp({ outcome: 'bad', active: true }), 0);
  assert.equal(answerXp({ outcome: 'good', active: true }), XP.typed);
  assert.equal(answerXp({ outcome: 'good', active: false }), XP.choice);
  assert.equal(answerXp({ outcome: 'hint', active: true }), XP.hinted);
  assert.equal(answerXp({ outcome: 'good', active: true, wordAwardsToday: 2 }), 1, 'diminishing returns for the same word');
  assert.equal(answerXp({ outcome: 'good', active: true, fixedMistake: true }), XP.typed + XP.fixBonus);
});

test('XP ledger rejects the same task twice', () => {
  let l = [];
  l = ledgerAdd(l, 's1:0');
  assert.equal(ledgerHas(l, 's1:0'), true);
  assert.equal(ledgerAdd(l, 's1:0').length, 1);
});

test('levels', () => {
  assert.equal(levelInfo(0).level, 1);
  assert.equal(levelInfo(99).level, 1);
  assert.equal(levelInfo(100).level, 2);
  assert.equal(levelInfo(1000).level, 5);
});

test('streak counts only real study days on consecutive local dates', () => {
  const days = {
    '2026-05-01': { sessions: 1 },
    '2026-05-02': { graded: 12 },
    '2026-05-03': { graded: 3 }, // opened the app, not enough
    '2026-05-04': { sessions: 1 },
    '2026-05-05': { sessions: 2 },
  };
  assert.equal(isStudyDay(days['2026-05-03']), false);
  const s = streakInfo(days, '2026-05-05');
  assert.equal(s.current, 2);
  assert.equal(s.todayDone, true);
  const s2 = streakInfo(days, '2026-05-06');
  assert.equal(s2.current, 2, 'still alive until the end of the next day');
  assert.equal(s2.todayDone, false);
  assert.equal(streakInfo(days, '2026-05-07').current, 0);
  assert.equal(bestStreak(days), 2);
});
