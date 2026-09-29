# QA report

Date: 2026-09-29. Build: `index.html` (469 words). Everything below was run in this
repository's cloud container; results are copied from the tools' output.

## Test environment — what was and was not tested

* Browser: headless **Chromium** driven by Playwright 1.56.1, desktop and emulated mobile
  viewports (320, 390, 768, 1280 px; touch emulation for the mobile runs).
* **Not tested:** Safari/iOS, Firefox, real phones or tablets, real screen readers. The
  mobile results are emulation only.
* Listen & Type: the container has no offline English voice, so only the "mode disabled
  with an explanation" path was tested; speech playback itself was not heard.
* Sounds: playback calls were exercised (and the "sound off persists" setting), but no
  one listened to the output.

## Results

| Check | Command | Result |
|---|---|---|
| Unit tests (SRS, answer checking, XP, streak, engine, sessions) | `npm test` | 38 passed, 0 failed |
| Browser scenarios | `npm run test:e2e` | 27/27 passed (`docs/e2e-report.json`) |
| Accessibility (axe-core 4.10, WCAG A/AA) | `npm run test:a11y` | no violations (one `<dl>` structure issue on the word page was found and fixed) |
| Dataset validation | `python3 scripts/validate_dataset.py` | **fails**: 469 confirmed C1 lemmas (< 1000 required); 3 shared-form warnings (see below). ≥2000 unique contexts: passed (5068). ≥3 mechanics per word: passed (min 9). |
| Screenshots | `npm run screenshots` | `docs/screenshots/` (mobile, desktop, 320 px) |

### Browser scenarios (27)

- pass: first launch: home renders, no errors, no network requests
- pass: daily mix: new word card, correct answer, wrong answer with Russian explanation and example
- pass: hints: first letter, then half; hinted answer is not counted as recall
- pass: mistake: the word comes back later in the session with a different exercise
- pass: all exercise types render and can be answered
- pass: session end, summary with one clear next action, and a new session starts
- pass: progress survives reload; an unfinished session can be resumed
- pass: no duplicate XP: double taps and reload after answering
- pass: achievement unlocks with a short non-blocking toast
- pass: study day follows the local date across midnight
- pass: streak needs real study, not app opening
- pass: library: search English and Russian, filters, empty result
- pass: favorites and Anki/Quizlet export
- pass: export JSON, corrupted import is rejected without losing progress, valid import restores
- pass: reset asks for confirmation inline (no modal)
- pass: sound: switch off stops effects; settings persist
- pass: works offline (network disabled)
- pass: sprint: 60-second timer ends the round; old timers never touch the next session
- pass: leaving the task page and coming back keeps the same task
- pass: keyboard: digits choose, Enter checks and continues, focus is visible
- pass: listen & type is switched off without an offline English voice
- pass: layout at 320px: no horizontal scroll, touch targets, readable text
- pass: layout at 390px: no horizontal scroll, touch targets, readable text
- pass: layout at 768px: no horizontal scroll, touch targets, readable text
- pass: layout at 1280px: no horizontal scroll, touch targets, readable text
- pass: reduced motion is respected
- pass: storage unavailable: clear warning, learning still works

## Known problems (not fixed)

1. **Dictionary size: 469 words, not the required 1000+.** 1384 verified C1 candidates
   were selected (`data/candidates/candidates.csv`) and split into 36 batches; content was
   written for 469 of them before work stopped. Batches b019–b036 have no content, b001,
   b006–b009 and b011–b018 are partial. The app only shows finished words.
2. **No independent editorial review.** The planned second-editor pass
   (`content/REVIEW.md`) was not run; content is AI-written, validator-checked and
   author-self-reviewed only. No human native speaker has checked it.
3. **Shared forms:** `blessing` (bless/blessing), `compelling` (compel/compelling),
   `diagnoses` (diagnose/diagnosis) are forms of two entries. Effect: typing one of these
   forms can be accepted as a form of the other word in typed exercises.
4. Partially written batches contain entries with validator errors (e.g. Russian
   explanations missing in some b013 rewrites); the build drops broken optional items
   and broken entries automatically (1 entry and 5 optional items dropped).
5. Phrases / phrasal verbs extension was not built.
6. Not tested on Safari or real devices (see above).
