import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAnswer, wordState, LADDER, isDue } from '../../src/core/srs.js';
import { addDays, diffDays, dayKey, isValidDay } from '../../src/core/dates.js';

const D0 = '2026-03-02';
const ans = (rec, outcome, today, extra = {}) => applyAnswer(rec, { outcome, today, skills: ['rcl'], active: true, mechanic: 'recall', ...extra }).rec;

test('ladder is 1, 3, 7, 14, 30, 60 days', () => {
  assert.deepEqual(LADDER, [1, 3, 7, 14, 30, 60]);
});

test('new word: first correct answer schedules tomorrow', () => {
  const r = ans(null, 'good', D0);
  assert.equal(r.step, 0);
  assert.equal(r.due, addDays(D0, 1));
  assert.equal(wordState(r), 'learning');
});

test('successful reviews climb the ladder once per day', () => {
  let r = ans(null, 'good', D0);
  // a second correct answer the same day does not move the word again
  r = ans(r, 'good', D0);
  assert.equal(r.step, 0);
  let day = D0;
  const expected = [3, 7, 14, 30, 60, 60];
  for (const gap of expected) {
    day = r.due;
    r = ans(r, 'good', day);
    assert.equal(diffDays(day, r.due), gap);
  }
});

test('a mistake returns the word to a shorter interval and tomorrow', () => {
  let r = ans(null, 'good', D0); // step 0
  r = ans(r, 'good', addDays(D0, 1)); // step 1 (3 days)
  r = ans(r, 'good', addDays(D0, 4)); // step 2 (7 days)
  r = ans(r, 'good', addDays(D0, 11)); // step 3 (14 days)
  assert.equal(r.step, 3);
  r = ans(r, 'bad', addDays(D0, 25));
  assert.equal(r.step, 1);
  assert.equal(r.due, addDays(D0, 26));
  assert.equal(r.lapses, 1);
  assert.equal(r.err, 1);
});

test('mistake penalty is applied at most once a day', () => {
  let r = ans(null, 'good', D0);
  r = ans(r, 'good', addDays(D0, 1));
  r = ans(r, 'good', addDays(D0, 4)); // step 2
  r = ans(r, 'bad', addDays(D0, 11));
  const afterFirst = r.step;
  r = ans(r, 'bad', addDays(D0, 11));
  assert.equal(r.step, afterFirst);
  assert.equal(r.err, 2);
});

test('a correct answer after a mistake on the same day does not extend the interval', () => {
  let r = ans(null, 'good', D0);
  r = ans(r, 'bad', addDays(D0, 1));
  r = ans(r, 'good', addDays(D0, 1));
  assert.equal(r.due, addDays(D0, 2));
  assert.equal(r.fixed, 1);
  assert.equal(r.err, 0);
});

test('hinted answers never count as recall and keep the interval', () => {
  let r = ans(null, 'good', D0, { active: false });
  r = ans(r, 'hint', addDays(D0, 1));
  assert.equal(r.step, 0);
  assert.equal(r.due, addDays(D0, 2));
  assert.equal(r.rclDays.length, 0);
  assert.equal(r.hints, 1);
});

test('practice answers (Sprint/Match) do not touch the schedule', () => {
  const r0 = ans(null, 'good', D0);
  const r1 = applyAnswer(r0, { outcome: 'bad', today: addDays(D0, 1), skills: ['rec'], practice: true, mechanic: 'quickpick' }).rec;
  assert.equal(r1.due, r0.due);
  assert.equal(r1.step, r0.step);
  assert.equal(r1.err, 0);
  assert.deepEqual(r1.sk.rec, [0, 1]);
});

test('established requires several days, active recall and a 7+ day gap', () => {
  let r = ans(null, 'good', D0, { active: false }); // recognition only
  r = ans(r, 'good', addDays(D0, 1));
  r = ans(r, 'good', addDays(D0, 4));
  assert.equal(wordState(r), 'review');
  r = ans(r, 'good', addDays(D0, 11));
  assert.ok(r.maxInt >= 7);
  assert.equal(wordState(r), 'established');
});

test('guessing many times on one day never makes a word established', () => {
  let r = null;
  for (let i = 0; i < 20; i++) r = ans(r, 'good', D0);
  assert.equal(wordState(r), 'learning');
  assert.equal(r.okDays.length, 1);
});

test('recognition-only success does not satisfy the recall requirement', () => {
  let r = null;
  let day = D0;
  for (let i = 0; i < 6; i++) {
    r = ans(r, 'good', day, { active: false });
    day = r.due;
  }
  assert.equal(r.rclDays.length, 0);
  assert.notEqual(wordState(r), 'established');
});

test('isDue and date helpers', () => {
  const r = ans(null, 'good', D0);
  assert.equal(isDue(r, D0), false);
  assert.equal(isDue(r, addDays(D0, 1)), true);
  assert.equal(diffDays('2026-03-28', '2026-03-30'), 2); // across a DST change in Europe
  assert.equal(isValidDay('2026-02-30'), false);
  assert.equal(isValidDay(dayKey(new Date(2026, 0, 5))), true);
});

test('practising a word before it is due does not move it up the ladder', () => {
  let r = ans(null, 'good', D0); // due D0+1
  r = ans(r, 'good', addDays(D0, 1)); // step 1, due D0+4
  const before = { step: r.step, due: r.due };
  r = ans(r, 'good', addDays(D0, 2)); // early practice
  assert.equal(r.step, before.step);
  assert.equal(r.due, before.due);
  assert.equal(r.okDays.length, 3, 'still a successful day');
  r = ans(r, 'bad', addDays(D0, 3)); // but a mistake still brings it back
  assert.equal(r.due, addDays(D0, 4));
  assert.equal(r.step, 0);
});
