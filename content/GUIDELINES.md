# Crux content guidelines (authoring + review)

You write learning content for **Crux**, a vocabulary app for adult Russian-speaking
learners of English at C1. The interface is English; translations and error explanations
are Russian. Everything you write is original. **Never copy definitions, examples or
notes from any dictionary** (Oxford, Cambridge, Longman, Collins, Macmillan, Merriam-Webster,
Wiktionary, etc.) and never present your sentences as corpus quotations.

Quality bar: a careful ELT editor would sign off every line. Natural, modern, adult
English (work, study, news, relationships, culture, everyday life). No childish or
exotic contexts, no real living people, no brands, no politics that takes sides, no
violence for its own sake. British or American spelling is fine, but be consistent inside
one entry (the app accepts both spellings through `acceptedAnswers`).

## Your assignment

You receive `content/assignments/bNNN.json`: a list of `{lemma, pos, ...evidence}`.
Write one entry per assigned lemma **for the given part of speech** (`pos`). Evidence
fields tell you why the word is C1 (label from Oxford 5000 or Octanove, at word+POS
level; no source labels individual senses). Choose the **one sense** that is most useful
for a C1 learner and most likely to be the reason for the C1 label. If the word also has a
basic, lower-level sense (the assignment may show `cefrj_level` B1/B2 = a lower label for the
same POS in another list), prefer the advanced sense and explain the choice in `senseNote`
(Russian or English, one short sentence). If the lemma is unusable (offensive, meaningless
without a basic sense, or you cannot write good content), put it in `skipped` with a reason
instead of forcing it.

Write files as `content/words/bNNN/p1.json`, `p2.json`, ... (about 10 entries per file,
each file = JSON array of entries). Then run:

    python3 scripts/validate_batch.py content/words/bNNN --assignment content/assignments/bNNN.json

Fix every ERROR. Read every WARNING and fix it unless you are sure it is a false alarm
(then leave it). Repeat until there are no errors.

## Entry schema (all fields required unless marked optional)

```json
{
  "lemma": "abolish",
  "pos": "verb",
  "definitionEn": "to officially end a law, system or practice",
  "translationsRu": ["отменять", "упразднять"],
  "acceptedAnswers": ["abolish"],
  "register": "formal",
  "topic": "society",
  "ambiguous": false,
  "senseNote": "",
  "situation": "A government decides that a law, tax or custom will officially no longer exist.",
  "examples": [
    {"text": "Many countries [[abolished]] the death penalty during the twentieth century.",
     "distractors": ["resigned", "demolished", "evacuated"],
     "alternatives": ["abandoned", "banned", "outlawed", "ended", "scrapped"]},
    {"text": "Our school [[abolished]] its strict uniform rules, so students can now wear jeans.",
     "distractors": ["absorbed", "provoked", "acquired"],
     "alternatives": ["scrapped", "dropped", "removed", "ended"]},
    {"text": "Critics argue that the tax should be [[abolished]] rather than simply reduced.",
     "distractors": ["exhausted", "deprived", "compelled"],
     "alternatives": ["scrapped", "removed", "eliminated"]}
  ],
  "trio": {
    "texts": ["The party has promised to [[abolish]] tuition fees if it wins.",
              "It took decades of protest to [[abolish]] slavery in the colonies.",
              "Some teachers want to [[abolish]] homework for younger children."],
    "alternatives": ["end", "eliminate"]
  },
  "collocations": ["[[abolish]] the death penalty", "[[abolish]] slavery", "[[abolish]] a tax",
                   "[[abolish]] tuition fees", "calls to [[abolish]] something"],
  "badCollocation": {"text": "[[abolish]] a meeting",
                     "noteRu": "Встречи и мероприятия не abolish, а cancel: abolish — про законы, системы и обычаи."},
  "collocationTask": {"prompt": "___ the death penalty", "answer": "abolish",
                      "distractors": ["cancel", "delete", "dismiss"],
                      "explanationRu": "Смертную казнь, законы и налоги отменяют глаголом abolish. Cancel — про встречи и заказы, delete — про файлы."},
  "nuance": {
    "rival": "cancel",
    "text": "Slavery was [[abolished]] in the British Empire in 1833.",
    "rivalForm": "cancelled",
    "explanationRu": "Abolish — официально упразднить закон или систему. Cancel — отменить событие или заказ, к рабству не подходит.",
    "reverse": {"text": "Our flight was [[cancelled]] because of the storm.", "targetForm": "abolished",
                "explanationRu": "Рейс, встречу, заказ отменяют через cancel. Abolish — только законы, системы и обычаи."}
  },
  "fixIt": {"text": "In 1965 the country decided to [[cancel]] the death penalty for murder.",
            "answer": ["abolish"],
            "explanationRu": "Смертную казнь как систему не cancel, а abolish — официально упразднить."},
  "wordFormation": {"base": "abolish", "text": "The [[abolition]] of slavery changed the economy of the region.",
                    "answer": ["abolition"]},
  "reply": {"context": "A friend texts: \"Did you hear? The city is getting rid of parking fees in the centre.\"",
            "options": ["Finally! I didn't think they'd ever abolish them.",
                        "Finally! They've abolished all the traffic in the centre.",
                        "Your message is acknowledged; the abolition is hereby noted."],
            "answer": 0,
            "explanationRu": "Abolish подходит к сборам и правилам, а не к пробкам. Третий вариант звучит как официальное письмо, а не как ответ другу."},
  "rewrite": {"original": "The government officially ended the tax on books last year.",
              "frame": "The tax on books ____ last year.",
              "accepted": ["was abolished", "got abolished", "was officially abolished"],
              "explanationRu": "Нужен пассив: the tax was abolished."}
}
```

A batch file may also contain skipped words as separate objects:
`{"skipped": "lemma", "pos": "noun", "reason": "..."}`.

## Field rules

**definitionEn** — your own learner definition, 4–16 words, starting like a dictionary
(`to ...` for verbs, `a/an/the ...` or a noun phrase for nouns, a description for
adjectives/adverbs). It must NOT contain the word itself or an obvious family member
(no "abolition" in the definition of "abolish") — the Recall exercise shows it as a clue.

**translationsRu** — 1–4 accurate Russian equivalents of THIS sense, most natural first,
lower case, no long explanations. A short clarifying word in brackets is allowed:
`"выдвигать (обвинение)"`. Do not list translations of other senses.

**acceptedAnswers** — dictionary forms accepted when the learner types the word:
the lemma plus real spelling variants only (`["judgement", "judgment"]`,
`["sceptical", "skeptical"]`). Never synonyms. Inflected forms are generated automatically.

**register** — one of `neutral`, `formal`, `informal`, `literary`, `technical`.

**topic** — exactly one of:
`thinking` (thinking, arguing, language of opinion and logic), `people` (people,
character, feelings, relationships), `work` (work, business, money), `society`
(society, law, politics, media), `science` (science, technology, health, the body),
`education` (study, learning, research), `culture` (arts, entertainment, history,
religion, sport), `world` (nature, environment, places, travel, everyday physical world).

**ambiguous** — `true` if the English lemma has another common meaning a learner could
think of (e.g. "yield": crops vs give way; "tackle"). The app then shows a context sentence
next to the word in translation drills.

**situation** — one English sentence (8–25 words) describing when you would use the word,
without using the word or its family. It is a Recall clue.

**examples** — exactly 3 sentences, 7–24 words each, in 3 different situations
(e.g. news, work, conversation, study). Each has exactly one `[[target]]` in the form the
sentence needs (inflect as needed: `[[abolished]]`, `[[crises]]`). The rest of the
sentence must not contain the word again. Each sentence must make the meaning clear.
- `distractors`: exactly 3 real English words, **same part of speech and same grammatical
  form** as the marked target (past participle for past participle, plural for plural),
  grammatically possible in the slot but clearly wrong in meaning. They must NOT be
  synonyms or anything a teacher would accept. Aim for similar length to the target; avoid
  one obviously absurd option. Do not reuse the same three distractors across examples.
- `alternatives`: other words (in the same form) that would be acceptable in that gap —
  honest list, may be empty. The app accepts them as "also possible" in typed mode.

**trio** — "One word, three contexts": 3 NEW short sentences (6–18 words) where the
target appears in **the identical form** (e.g. all `[[abolish]]`), in clearly different
situations. `alternatives`: words that would fit all three gaps equally well (may be empty).
Make the three sentences together point to your word.

**collocations** — 3–5 frequent natural collocations/patterns, target marked `[[...]]`
(`"[[raise]] concerns about"`, `"a [[compelling]] argument"`, `"[[reluctant]] to do something"`).

**badCollocation** — one tempting but unnatural combination with the target (typical
Russian-speaker mistake), target marked; `noteRu` explains briefly what is used instead.

**collocationTask** — complete a collocation. `prompt` contains `___` exactly once;
`answer` fills it; the full phrase must contain the target word (either the target is
the answer, or the prompt contains it and the answer is its partner, e.g.
`{"prompt": "___ a consensus", "answer": "reach", "distractors": ["make", "do", "get"]}` —
careful: every distractor must be really unnatural). `explanationRu` ≤ 220 chars: why the
answer is right and what the distractors are used for.

**nuance** — the target vs one close word (near-synonym, false friend or commonly
confused word; it may be any level). `text`: a sentence where the target is clearly the
best choice and the rival is wrong or clearly worse, target marked. `rivalForm`: the rival
in the same grammatical form. `explanationRu` ≤ 260 chars: the difference in meaning,
situation, register or collocation, and why the rival is worse HERE.
Optional `reverse`: a sentence where the rival is right and the target is wrong
(`[[rival form]]` marked, `targetForm` = target in that grammatical form).

**fixIt** — a natural sentence with exactly ONE lexical mistake, marked `[[...]]`,
that must be replaced by the target word in the right form (`answer`: list of accepted
corrections, forms of the target only). The mistake should be realistic for a Russian
speaker (near-synonym, false friend, wrong collocation, wrong register). Everything else
must be correct and natural so that nothing else could reasonably be "fixed". The target
word must not appear elsewhere in the sentence. Optional `alternatives`: other corrections
that would also be acceptable in that slot (accepted as "also possible").

**wordFormation** (optional; only with a genuine, dictionary-established derivational
link) — classic exam item: `base` is shown in capitals, `text` has `[[answer]]`.
Either `base` or the answer's lemma must be the target lemma (e.g. base `abolish` →
`abolition`, or base `decide` → `decisive` when the target is `decisive`). The link is
checked against CatVar 2.1 word families and WordNet 3.0 by the validator; never invent a derived word.

**reply** (optional, write it for roughly 60% of words where a natural short exchange
exists) — "Real-Life Reply": `context` = a short situation (chat message, email, meeting,
debate, job interview, request, film/book discussion). `options` = exactly 3 replies:
one natural and appropriate reply using the target word correctly; one that misuses the
target's meaning; one with the wrong register or an unnatural combination. `answer` =
index of the correct one (vary it: 0, 1 or 2). `explanationRu` ≤ 240 chars. Vary the
register mistakes across entries — too casual or slangy, too blunt or rude, too emotional,
too formal/bureaucratic — instead of always using the same "hereby" style.

**rewrite** (optional, write it for roughly 40% of words where it works naturally) —
`original`: a sentence WITHOUT the target word; `frame`: the same meaning rewritten with a
gap `____` (four underscores) that needs 1–5 words including the target word; `accepted`:
all reasonable completions (think hard: articles, contractions, word order variants);
`explanationRu`: one short sentence (optional). Only use frames with a small, closed set of
correct answers.

## Russian style

Short, clear, friendly, no lecture: 1–2 sentences. English words in Latin letters.
Use «ёлочки» or no quotes. Example: `«Abolish» — официально упразднить закон или систему;
«cancel» — отменить встречу или заказ.`

## Self-check before finishing

- Would a C1 learner learn the real, current use of the word from these sentences?
- Is every distractor clearly wrong and every alternative honestly listed?
- Could any fixIt sentence be corrected in two different places? Rewrite it if so.
- Is the Russian translation right for this sense (not another sense)?
- No copied dictionary text. No placeholders, no "etc.", no "...".
