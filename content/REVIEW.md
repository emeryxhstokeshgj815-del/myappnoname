# Editorial review checklist (second pair of eyes)

The validator checks structure. This review checks **language and teaching quality**.
You review a batch written by another editor, fix problems **directly in the batch
files**, and keep a short log. Read `content/GUIDELINES.md` first: the schema and rules
there still apply.

## For every entry, check

1. **Sense and level.** The chosen sense is a real, current, useful sense and plausibly
   the reason the word is C1. If the entry teaches a basic sense of a word that has an
   obvious advanced one, switch to the advanced sense (rewrite what is needed) or explain
   in `senseNote`.
2. **Definition.** Accurate for that sense, own wording, short, no give-away family words.
3. **Russian translations.** Correct for *this* sense, natural Russian, most common first,
   no translations of other senses. Watch false friends.
4. **Examples and trio.** Natural modern English a native editor would write; the marked
   form is grammatical; the sentence makes the meaning clear; no dictionary-sounding or
   childish sentences; varied situations; trio uses one identical form.
5. **Distractors.** Each one is clearly wrong in that sentence. If a distractor could be
   defended by a teacher, replace it. Same grammatical form as the target. Not absurd.
   `alternatives` honestly lists other words that would be accepted in that gap (and in
   all three trio gaps).
6. **Collocations.** Frequent and natural; `badCollocation` really unnatural (not just
   rarer); `noteRu` correct.
7. **collocationTask.** Every distractor really unnatural in the slot; explanation true.
8. **Nuance duel.** In `text` the target is clearly best and the rival wrong or clearly
   worse; `reverse` (if any) the opposite; explanations accurate and short.
9. **Fix It.** Exactly one mistake; realistic for a Russian speaker; nothing else in the
   sentence invites a correction; the answer is the target in the right form. If another
   word would also be a valid correction, list it in the optional `alternatives` array.
10. **Word formation.** Real derived word, correct form for the sentence.
11. **Real-Life Reply.** Only one option is appropriate; the misuse and the register
    mistake are unmistakable; the correct option sounds like a real person.
12. **Rewrite.** Same meaning; the gap forces the target word; `accepted` lists every
    reasonable completion (articles, contractions, word order, tense variants).
13. **Russian explanations.** Accurate, 1–2 short sentences, no lecture, correct grammar.

## What to do with problems

* Fix the text in place (keep the schema). Prefer small, precise edits.
* If an optional item (`reply`, `rewrite`, `wordFormation`, `nuance.reverse`) cannot be
  made unambiguous, delete that item.
* If a whole entry cannot be made good (wrong level, offensive, no usable sense), leave it
  in the batch file but list it in `content/reviews/bNNN.removed.json` as a JSON array of
  `{"lemma": ..., "pos": ..., "reason": ...}` objects (the build excludes these), and
  mention it in your log under **Removed**.
* Re-run `python3 scripts/validate_batch.py content/words/bNNN --assignment content/assignments/bNNN.json`
  until there are no errors.

## Log format — `content/reviews/bNNN.md`

```
# Review bNNN
Reviewed: 39 entries. Entries changed: 17. Items fixed: 31. Items deleted: 3. Entries removed: 0.

## Changes
- aftermath: examples[0] distractor "midst" (defensible) replaced with "outset".
- aggression: fixIt rewritten (two possible corrections).
...
## Removed
(none)
```
