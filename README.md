# Crux — C1 English vocabulary for Russian speakers

Crux is a small, offline vocabulary trainer for adult learners at C1 level. It is a
single file, `index.html`: open it in a browser and study. No account, no server, no
paid API, no network requests.

* **Words:** __WORDS__ C1 words (unique lemmas), each confirmed as C1 for the same part of
  speech by a CEFR-labelled list and backed by corpus evidence — see `CONTENT_AUDIT.md`.
* **12 exercise types:** Quick Pick, Recall, Context Gap, Collocation Builder, Word
  Formation, Nuance Duel, Fix It, One Word Three Contexts, Real-Life Reply, Match,
  Rewrite, and Listen & Type (needs an offline English voice on the device).
* **Sessions:** Daily Mix (10 or 20 tasks), Sprint (60 s), Mistake Lab, Boss Round,
  Free Practice.
* **Spaced repetition** with a documented, tested schedule (1, 3, 7, 14, 30, 60 days),
  separate tracking of recognition, recall and use in context, and transparent word
  states: New, Learning, Review, Established — see `docs/LEARNING.md`.
* **Motivation without pressure:** XP, levels, study-day streaks and 27 achievements;
  no lives, no fake rivals.
* **Sound:** six short CC0 interface sounds by Kenney, embedded in the file, with an
  on/off switch and volume.

The interface is in English; translations and error explanations are in Russian.

## Run it

Open `index.html` in a current browser (Chrome, Edge, Firefox or Safari). Everything is
inside the file, so it works without internet.

To use it on a phone, put the file on the phone or on any static web host and open it in
the phone's browser. Progress is stored by the browser for that file location.

## Your progress

* Saved automatically in the browser (`localStorage`) after every answer. If the browser
  blocks storage (private mode), Crux says so and keeps working for the current tab.
* **Settings → Export progress (JSON)** downloads everything (words, XP, streaks,
  achievements, settings). **Import progress** restores it; damaged or foreign files are
  rejected and your current progress is left untouched.
* **Settings → Anki TSV / Quizlet TSV** exports all words, studied words or favourites.
* **Settings → Reset progress** deletes progress after an inline confirmation.

## Rebuild from source

Requirements: Python 3.11 with `pip install lemminflect nltk wordfreq numpy soundfile`,
Node.js 22.

```bash
python3 scripts/fetch_sources.py        # download EFLLex, Oxford labels, Octanove, CEFR-J, WordNet, CatVar (checksummed)
python3 scripts/select_candidates.py    # corpus candidates -> CEFR verification -> data/candidates/
python3 scripts/make_assignments.py     # split into authoring batches (content/assignments/)
python3 scripts/validate_batch.py --all # check authored content (content/words/)
python3 scripts/build_dataset.py        # compile data/build/lexicon.json + app-data.json
python3 scripts/validate_dataset.py     # dataset requirements (>= 1000 words, >= 2000 contexts, ...)
python3 scripts/prepare_sounds.py       # fetch and trim the six sound effects
npm install && npm run build            # bundle everything into index.html
npm test                                # unit tests (scheduling, XP, streaks, sessions, import)
npm run test:e2e                        # browser scenarios (Playwright + Chromium)
python3 scripts/audit_report.py         # regenerate CONTENT_AUDIT.md
```

## Repository map

| Path | What |
|---|---|
| `index.html` | the finished app |
| `src/core/` | learning engine: scheduling, sessions, exercises, XP, streaks, achievements, storage |
| `src/ui/` | screens, exercise renderers, sounds, speech |
| `content/` | authoring and review guidelines, batches, review logs |
| `data/` | source manifest, candidate selection, compiled dataset |
| `scripts/` | data pipeline and build |
| `tests/` | unit tests and browser scenarios |
| `docs/` | learning rules, screenshots |
| `CREDITS.md` | sources and licences |
| `CONTENT_AUDIT.md` | real counts, selection method, limitations |
| `QA.md` | what was tested and what remains |
