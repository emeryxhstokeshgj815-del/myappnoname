# Content audit

Generated from the build of **2026-09-29** by `scripts/audit_report.py`. All numbers are counted from `data/build/lexicon.json`; nothing is estimated.

## Headline numbers

| Measure | Count |
|---|---|
| Unique words (lemmas) in the app | **469** |
| …confirmed C1 by a CEFR-labelled list for the same part of speech | **469** |
| Taught senses (one per lemma) | 469 |
| Example sentences (3 per word) | 1407 |
| "One word, three contexts" sentences | 1407 |
| Collocations listed | 2319 |
| Unique context sentences in the exercise bank | **5068** |
| Russian translations (average per word) | 2.69 |

Counting rules: one lemma = one word; inflected forms, plural forms and British/American spellings are stored as accepted forms of the same lemma and never counted separately (the dataset validator fails if a form belongs to two entries). Phrasal verbs and idioms are not counted.

## How the words were selected

1. **Corpus candidates — EFLLex.** Every EFLLex lemma+POS (nouns, verbs, adjectives, adverbs, prepositions, conjunctions) was considered. EFLLex frequencies were used as corpus evidence and to require B2/C1 attestation for the weaker verification source; they were **not** used as level labels.
2. **CEFR verification at word+POS level.** A candidate counts as C1 only if a CEFR-labelled list gives **C1 for the same lemma and part of speech**:
   * Oxford 5000 (C1 label): **421** words;
   * Octanove C1/C2 profile (C1 label; only for words that Oxford does not list at any level and that EFLLex attests in B2/C1 materials): **48** words.
3. **Conflict filters.** Excluded when Oxford also gives the same lemma+POS an A1–B1 label, or CEFR-J gives it A1/A2 (a basic sense dominates).
4. **Editorial filters.** Distressing or offensive items, homographs whose C1 label belongs to a rare homograph of an elementary word, transparent international words, and very low-value items were removed (list with reasons in `scripts/select_candidates.py` and `data/candidates/selection_report.json`).

Corpus evidence of the words in the app:

| Source | Words |
|---|---|
| EFLLex, same lemma and part of speech | 315 |
| not in EFLLex; general frequency from wordfreq (Oxford-verified words only) | 149 |
| EFLLex, same lemma (other part of speech) | 5 |

Words where CEFR-J gives a **lower** label (B1/B2) for the same word+POS: **220**. These are kept (Oxford/Octanove label C1) and shown on the word page as a disagreement; the taught sense was chosen to be the advanced one where a basic sense exists.

Exclusions during selection:

* editorial: 90 entries
* cefrj_lower_label_same_pos: 23 entries
* oxford_lower_label_same_pos: 1 entries

## Granularity: word, part of speech and sense

Oxford 5000, Octanove and CEFR-J label a **word with a part of speech**, not individual senses. Crux stores this as `granularity: "word+pos"` in `cefrEvidence` and never claims that a source labelled the sense. The sense taught for each word (`senseId`) was chosen by the editor; where a lower-level sense exists this is noted in `senseNote`. No sense-level CEFR check against the English Vocabulary Profile was possible (see `CREDITS.md`).

## Exercise bank

| Exercise | Items |
|---|---|
| Quick Pick (EN→RU / RU→EN) | every word (469), options drawn at run time |
| Recall (definition + translation + situation) | 469 |
| Context Gap (choice with authored distractors / typing) | 1407 sentences |
| Collocation Builder — complete | 469 |
| Collocation Builder — odd one out | 469 |
| Word Formation (verified in CatVar 2.1 / WordNet 3.0) | 299 |
| Nuance Duel (incl. reverse items) | 910 |
| Fix It | 469 |
| One Word, Three Contexts | 469 |
| Real-Life Reply | 345 |
| Match | every word, 4 per round |
| Rewrite (prepared accepted answers) | 231 |
| Listen & Type | every example sentence, when an offline English voice exists |

Every word takes part in at least **9** exercise types (average 10.87), always including typed recall and context work.

## Distribution

| Topic | Words |
|---|---|
| thinking | 57 |
| people | 81 |
| work | 84 |
| society | 134 |
| science | 38 |
| education | 7 |
| culture | 34 |
| world | 34 |

| Part of speech | Words |
|---|---|
| noun | 239 |
| verb | 121 |
| adjective | 96 |
| adverb | 10 |
| preposition | 2 |
| conjunction | 1 |

| Register | Words |
|---|---|
| neutral | 325 |
| formal | 122 |
| informal | 11 |
| technical | 7 |
| literary | 4 |

## Checks

Structural (automatic, `scripts/validate_batch.py` + `scripts/validate_dataset.py`): schema, one marked target per sentence, the marked word is a form of the lemma, the word never appears twice in a sentence, definitions do not contain the word, distractors distinct and of the same grammatical form, alternatives not listed as distractors, identical form in all three trio sentences, fix-it answers are forms of the target, rewrite answers contain the target, derivations verified, no duplicate sentences across the whole bank, no placeholders, sources and evidence present for every word.

Editorial (language) review by a second editor: **not done**. The planned second pass (`content/REVIEW.md`) could not be run before delivery; every entry was only self-checked by its author and by the automatic validators.

Build: 469 entries compiled; 1 dropped by the build, 0 skipped by authors, 0 removed in review, 5 optional items removed for failing checks (details: `data/build/build_report.json`).

**Failed checks:**
* only 469 confirmed C1 lemmas (< 1000)
* 'blessing' is a form/variant of both bless and blessing
* 'compelling' is a form/variant of both compel and compelling
* 'diagnoses' is a form/variant of both diagnose and diagnosis

## Limitations

* CEFR evidence is at word+POS level; no source available here labels senses. Sense choice is an editorial decision.
* The English Vocabulary Profile could not be used (no bulk access; blocked from the build environment).
* 48 words rely on the Octanove list, whose compilation method is not documented in detail.
* 149 Oxford-verified words are absent from EFLLex's small textbook corpus; their corpus evidence is general frequency (wordfreq).
* 220 words have a lower label in CEFR-J for the same word+POS (list disagreement, usually because of a basic sense).
* All learning content was written with AI assistance and checked by automatic validators and the author's own self-review (no independent second editorial pass was run); it has not been reviewed by a human native-speaker editor. Some sentences may still sound less natural than a professional course book, and a few distractors may be arguable.
* Translations cover the taught sense only.
