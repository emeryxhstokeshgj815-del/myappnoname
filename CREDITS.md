# Credits, sources and licences

Crux was built from openly available resources. This file records where every
external input came from, when it was obtained, under which terms it is used and
what exactly was taken. Machine-readable details (URLs, byte sizes, SHA-256) are in
`data/sources/MANIFEST.json` and `assets/sounds/SOURCES.json`; both are produced by
the scripts that download the data (`scripts/fetch_sources.py`,
`scripts/prepare_sounds.py`).

All downloads were made on **2026-09-24**.

> **Network note.** The build environment's egress policy blocked
> `cental.uclouvain.be`, `oxfordlearnersdictionaries.com`, `englishprofile.org`,
> `kenney.nl` and `opengameart.org` (HTTP 403 on CONNECT). The pages were read
> through a server-side reader to check the licence terms, and the files were taken
> from public GitHub copies. Each copy was verified independently, as described below.

## Vocabulary selection

### EFLLex (corpus basis for candidates)
* Dürlich, L. and François, T. (2018). *EFLLex: A Graded Lexical Resource for Learners
  of English as a Foreign Language.* LREC 2018, Miyazaki, Japan.
  <http://www.lrec-conf.org/proceedings/lrec2018/pdf/439.pdf>
* Project: CEFRLex, CENTAL, UCLouvain — <https://cental.uclouvain.be/cefrlex/efllex/>
* File: `EFLLex.tsv` (NLP4J POS; 15,280 lemmas; A1–C1 normalised frequencies),
  official URL <https://cental.uclouvain.be/cefrlex/static/resources/en/EFLLex.tsv>.
* Licence: **CC BY-NC-SA 4.0** (stated on the download page).
* How it was obtained: byte-identical copy from `mo1ein/BeforePlay` (commit
  `edcdd9d`). SHA-256 `d046ce40…9645` (7,155,559 bytes) is the same value that
  another project (`GliteTech/research-ace-cefr`) recorded when downloading the
  official URL on 2026-04-17.
* What Crux uses: per-level frequencies for the selected lemmas only (shown as
  "corpus evidence" on each word page and stored in `data/candidates/candidates.csv`).
  EFLLex frequencies are **never** treated as CEFR labels.
* Terms for the derived data: attribution (this section), **non-commercial use**, and
  share-alike: the Crux dataset (`data/build/*.json`, `data/candidates/*`) is released
  under CC BY-NC-SA 4.0. The raw TSV is not committed; `scripts/fetch_sources.py`
  downloads it and checks the digest.
* Observation: the example rows on the EFLLex landing page differ from the values in
  the downloadable file (e.g. *cat* NN). The downloadable file was used as published.

### The Oxford 3000 and Oxford 5000 (CEFR verification)
* © Oxford University Press. <https://www.oxfordlearnersdictionaries.com/wordlists/oxford3000-5000>
* Used **only** to check the CEFR label of a word and part of speech. No Oxford
  definitions, examples or audio are used. Some copies of the list also contain Oxford
  definitions and audio links; those columns were ignored.
* Obtained from three independent GitHub copies (`nalgeon/words@8321a7a`,
  `tyypgzl/Oxford-5000-words@aac2d2a`, `winterdl/oxford-5000-vocabulary-audio-definition@37a976d`).
  All three agree on every word+POS+level triple (5,943 entries, 1,404 of them C1).
  In addition, 261 of 261 word+POS+level triples in an excerpt of the official PDF
  *The Oxford 5000 by CEFR level* (read server-side, stored as
  `data/sources/oxford5000_pdf_excerpt.txt`) match the copies.
* Crux records, for each word, a citation of the form "Oxford 5000: C1 (word+POS)".
  The list is not redistributed.

### Octanove Vocabulary Profile C1/C2 1.0 (secondary verification)
* Octanove Labs, via Open Language Profiles:
  <https://github.com/openlanguageprofiles/olp-en-cefrj> (commit `d4e45b7`).
* Licence: **CC BY-SA 4.0**.
* Used only for words that the Oxford lists do not label at any level and that EFLLex
  attests in B2/C1 materials. The creation method of this list is not documented in
  detail; it is treated as the weaker of the two verification sources and reported
  separately in `CONTENT_AUDIT.md`.

### CEFR-J Vocabulary Profile 1.5 (conflict check)
* The CEFR-J Wordlist Version 1.5, compiled by Yukio Tono, Tokyo University of Foreign
  Studies (via Open Language Profiles). Free for research and commercial use with citation.
* Used to exclude words whose same part of speech is labelled A1/A2 in CEFR-J (a basic
  sense dominates) and to show "lower label elsewhere" notes for B1/B2 labels.

### wordfreq (general frequency for words missing from EFLLex)
* Robyn Speer, *wordfreq* (v3). <https://github.com/rspeer/wordfreq> — code Apache 2.0,
  data **CC BY-SA 4.0**. Used for the Zipf frequency shown for Oxford-verified words
  that EFLLex's small textbook corpus does not contain, for ordering new words, and to
  build the list of common English word forms used to tell typos from other words.

### English Vocabulary Profile
* <https://englishprofile.org/?menu=english-vocabulary-profile> was checked. It is an
  interactive web application (Cambridge University Press terms of use) without a
  bulk download, and the site was not reachable from the build environment. It was
  **not** used, and no sense-level verification against it was performed.

## Word formation
* **CatVar 2.1** — Habash, N. and Dorr, B. (2003). *A Categorial Variation Database for
  English.* NAACL 2003. © University of Maryland, Open Software License 1.1.
  <https://github.com/nizarhabash1/catvar> (commit `849925e`). Used at build time to
  verify that a base word and its derivative belong to one recorded word family.
* **Princeton WordNet 3.0** (via NLTK data, `nltk/nltk_data@550b662`), WordNet 3.0
  licence. Used for the same check (derivational and pertainym links).
* **LemmInflect** (MIT) — inflected forms of each word (e.g. *undergo → underwent*).

## Learning content
Definitions, Russian translations, example sentences, collocation lists, situations and
all exercise items were written for Crux by AI editor agents (Claude) following
`content/GUIDELINES.md`, checked by validation scripts, and revised in a second, independent
AI editorial pass (`content/REVIEW.md`, logs in `content/reviews/`). No human
native-speaker editor has reviewed them. They are not quotations from dictionaries or
corpora. Licence: **CC BY-NC-SA 4.0** (the non-commercial, share-alike terms follow
EFLLex).

## Sound effects
* **Interface Sounds 1.0** by **Kenney** (<https://www.kenney.nl>), **CC0 1.0 Universal**.
  Official pages: <https://kenney.nl/assets/interface-sounds>,
  <https://opengameart.org/content/interface-sounds>.
* Obtained from `Calinou/kenney-interface-sounds` (commit `4596a49`), a CC0
  redistribution of the same pack converted losslessly from OGG to WAV, including
  Kenney's original `License.txt` (copied to `assets/sounds/Kenney_License.txt`).
  Fidelity check: two original OGG files of the pack found in an unrelated repository
  (`frederickjjoubert/bevy-ball-game`) decode to the same audio as the WAV copies
  (correlation 0.99997 and 1.0).

| App event | Original file in the pack | Output |
|---|---|---|
| Tap / selection | `Audio/select_002.ogg` | `assets/sounds/tap.wav` |
| Correct answer | `Audio/confirmation_001.ogg` | `assets/sounds/correct.wav` |
| Incorrect answer (soft) | `Audio/question_004.ogg` | `assets/sounds/incorrect.wav` |
| Session complete | `Audio/confirmation_004.ogg` | `assets/sounds/complete.wav` |
| Achievement | `Audio/confirmation_002.ogg` | `assets/sounds/achievement.wav` |
| Level up | `Audio/confirmation_003.ogg` | `assets/sounds/levelup.wav` |

Processing: mono, leading silence trimmed, peak normalised to −3 dBFS, 6 ms fade-out,
16-bit PCM WAV. The six files (≈175 KB) are embedded in `index.html`; the rest of the
pack is not included. The harsh buzzer-style error sounds of the pack were rejected in
favour of a soft descending tone.

Listen & Type uses the device's own speech voice (Web Speech API). Those voices are part
of the operating system, not of Crux, and are unrelated to the sound effects.

## Software
* esbuild (MIT) — bundling at build time.
* Playwright (Apache 2.0) — browser tests.
* Crux source code: MIT licence (see `LICENSE.md`).
