# How Crux schedules and scores learning

This is a transparent **starting heuristic**, chosen to be easy to understand and
test. It is not presented as a scientifically optimal schedule. All rules live in
`src/core/` and are covered by unit tests in `tests/unit/`.

## Days
All dates are the device's **local calendar date** (`YYYY-MM-DD`, `src/core/dates.js`).
An answer is credited to the local day on which it was given, so a session that
crosses midnight counts towards both days.

## Word record (`src/core/srs.js`)
Each word the learner has met has a record with:

* `step` — position on the interval ladder (−1 = introduced, not yet recalled);
* `due` — local date of the next review;
* `okDays` — distinct days with a correct unaided answer;
* `rclDays` — distinct days with a correct unaided **production** answer (typing);
* `maxInt` — the longest gap in days bridged by a successful review;
* skill tallies for **recognition** (`rec`), **recall** (`rcl`) and **use in
  context** (`ctx`);
* open mistakes (`err`, 0–3) for the Mistake Lab, `fixed`, `lapses`, recent
  exercise types and recent sentences (to vary contexts).

## Ladder and outcomes
Intervals: **1 → 3 → 7 → 14 → 30 → 60 days**.

| Outcome | Meaning | Effect |
|---|---|---|
| good | correct without hints (a small typo is fine) | first time today: one step up, `due = today + interval` |
| hint | correct after a hint, an acceptable alternative word, or right word in the wrong form | keeps the step, due tomorrow; never counted as recall |
| bad | wrong, or answer revealed | two steps down (not below 0), due tomorrow, +1 open mistake; applied once per day |

* Only the **first** successful answer of a day moves a word up, so repeating a word
  many times in one day cannot inflate its progress.
* A correct answer after a mistake on the same day does not extend the interval
  (the word is due tomorrow anyway) but closes the open mistake.
* **Practice** answers (Sprint, Match) only update skill tallies; they never change
  review dates, success days or mistakes.

## In-session repetition
* A new word is shown as a card with a quick check (recognition). It is asked again as a
  production task (Recall, typed Context Gap, One Word Three Contexts or Listen & Type)
  after at least two other tasks; at most three introduced words are "in the air".
* After a mistake the word comes back **once** in the same session, 3–4 tasks later,
  with a **different exercise type** and, where possible, a different sentence. A second
  mistake does not create a third attempt (no loops). Sprint and Boss Round do not
  repeat words.

## States shown to the learner
* **New** — never answered.
* **Learning** — seen; not yet in Review.
* **Review** — step ≥ 2 (7-day interval reached) and correct on ≥ 2 different days.
* **Established** — correct on **≥ 3 different days**, typed from memory on **≥ 2
  different days**, a successful review after a gap of **≥ 7 days**, step ≥ 3, and the
  last answer was correct. A later mistake drops the word back.

## Choosing exercises (`src/core/session.js`)
Exercise type and session mode are independent. For every task the planner scores the
exercise types that exist for the word:

* production types are preferred once a word has been seen (and until it has been typed
  from memory on two days);
* context types are preferred when the word's context accuracy is below 70 %;
* the type used last time for this word is strongly avoided, as is the type of the
  previous task; frequently used types in the session get lower weights;
* in Mistake Lab the type in which the mistake happened is avoided and a new sentence is
  chosen.

Result: sessions alternate between choosing and typing; unit tests check that five
identical exercises never follow each other when other types are available.

## Session modes
* **Daily Mix** (10 or 20 tasks) — due reviews first, then new words within the daily
  limit (default 10), each new word taking two slots (card + later recall); a warm-up
  Match when several words are due; remaining slots are filled with practice of known
  words or, if nothing else is available, more new words.
* **Sprint** — 60 seconds of quick choice tasks on known words; practice only.
* **Mistake Lab** — words with open mistakes, in new contexts and exercise types;
  then words with the weakest record, then due words.
* **Boss Round** — mixed production/context check of learned words, no hints.
* **Free Practice** — topics, exercise types and length chosen by the learner.

## XP, levels, streaks (`src/core/xp.js`, `src/core/streak.js`)
* Typed from memory 10 XP (8 with a typo), correct choice 6, after a hint or an
  acceptable alternative 3, wrong or revealed 0. Correcting a previously missed word +4.
* Every task id pays out once (a ledger of rewarded ids is saved), so double taps,
  re-submits and reloads cannot farm XP. The same word pays full XP twice a day, then 1.
* Finishing a session of 10+ tasks: +20 once. Sprint: 2 XP per correct answer, max 40.
* Levels: level *n* needs 50·(n−1)·n XP in total (100, 300, 600, 1000…). A game level is
  a practice counter, not a CEFR level.
* A **study day** needs a finished session or ≥ 10 graded answers on that local date.
  The streak counts consecutive study days; it stays visible until the end of the next
  day and simply restarts afterwards (no penalties, no guilt messages).
