#!/usr/bin/env python3
"""Write CONTENT_AUDIT.md from the build outputs (real counts only)."""
import collections
import glob
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = os.path.join(ROOT, "data", "build")


def load(p):
    return json.load(open(p, encoding="utf-8"))


def main():
    lex = load(os.path.join(B, "lexicon.json"))
    rep = load(os.path.join(B, "dataset_report.json"))
    build = load(os.path.join(B, "build_report.json"))
    sel = load(os.path.join(ROOT, "data", "candidates", "selection_report.json"))
    words = lex["words"]
    n = len(words)

    reviews = sorted(glob.glob(os.path.join(ROOT, "content", "reviews", "b*.md")))
    rv = collections.Counter()
    for f in reviews:
        head = open(f, encoding="utf-8").read()
        m = re.search(r"Reviewed:\s*(\d+).*?changed:\s*(\d+).*?fixed:\s*(\d+).*?deleted:\s*(\d+).*?removed:\s*(\d+)", head, re.S | re.I)
        if m:
            for k, v in zip(["reviewed", "changed", "fixed", "deleted", "removed"], map(int, m.groups())):
                rv[k] += v
    excl = collections.Counter(x["reason"].split(":")[0] for x in sel["excluded"])
    tr_per = sum(len(w["translationsRu"]) for w in words) / max(1, n)
    items = rep["items"]
    by_topic = rep["by_topic"]
    topics = ["thinking", "people", "work", "society", "science", "education", "culture", "world"]

    L = []
    w = L.append
    w("# Content audit")
    w("")
    w(f"Generated from the build of **{lex['meta']['version']}** by `scripts/audit_report.py`. All numbers are counted from `data/build/lexicon.json`; nothing is estimated.")
    w("")
    w("## Headline numbers")
    w("")
    w("| Measure | Count |")
    w("|---|---|")
    w(f"| Unique words (lemmas) in the app | **{rep['unique_lemmas']}** |")
    w(f"| …confirmed C1 by a CEFR-labelled list for the same part of speech | **{rep['confirmed_c1_lemmas']}** |")
    w(f"| Taught senses (one per lemma) | {rep['senses']} |")
    w(f"| Example sentences (3 per word) | {rep['examples']} |")
    w(f"| \"One word, three contexts\" sentences | {rep['trio_sentences']} |")
    w(f"| Collocations listed | {rep['collocations']} |")
    w(f"| Unique context sentences in the exercise bank | **{rep['unique_context_sentences']}** |")
    w(f"| Russian translations (average per word) | {tr_per:.2f} |")
    w("")
    w("Counting rules: one lemma = one word; inflected forms, plural forms and British/American spellings are stored as accepted forms of the same lemma and never counted separately (the dataset validator fails if a form belongs to two entries). Phrasal verbs and idioms are not counted.")
    w("")
    w("## How the words were selected")
    w("")
    w("1. **Corpus candidates — EFLLex.** Every EFLLex lemma+POS (nouns, verbs, adjectives, adverbs, prepositions, conjunctions) was considered. EFLLex frequencies were used as corpus evidence and to require B2/C1 attestation for the weaker verification source; they were **not** used as level labels.")
    w("2. **CEFR verification at word+POS level.** A candidate counts as C1 only if a CEFR-labelled list gives **C1 for the same lemma and part of speech**:")
    by_ver = rep["by_verification"]
    w(f"   * Oxford 5000 (C1 label): **{by_ver.get('oxford-5000', 0)}** words;")
    w(f"   * Octanove C1/C2 profile (C1 label; only for words that Oxford does not list at any level and that EFLLex attests in B2/C1 materials): **{by_ver.get('octanove-c1c2-1.0', 0)}** words.")
    w("3. **Conflict filters.** Excluded when Oxford also gives the same lemma+POS an A1–B1 label, or CEFR-J gives it A1/A2 (a basic sense dominates).")
    w("4. **Editorial filters.** Distressing or offensive items, homographs whose C1 label belongs to a rare homograph of an elementary word, transparent international words, and very low-value items were removed (list with reasons in `scripts/select_candidates.py` and `data/candidates/selection_report.json`).")
    w("")
    w("Corpus evidence of the words in the app:")
    w("")
    w("| Source | Words |")
    w("|---|---|")
    for k, v in sorted(rep["by_corpus"].items(), key=lambda x: -x[1]):
        label = {"efllex-2018:lemma+pos": "EFLLex, same lemma and part of speech", "efllex-2018:lemma": "EFLLex, same lemma (other part of speech)", "wordfreq": "not in EFLLex; general frequency from wordfreq (Oxford-verified words only)"}.get(k, k)
        w(f"| {label} | {v} |")
    w("")
    w(f"Words where CEFR-J gives a **lower** label (B1/B2) for the same word+POS: **{rep['lower_label_elsewhere']}**. These are kept (Oxford/Octanove label C1) and shown on the word page as a disagreement; the taught sense was chosen to be the advanced one where a basic sense exists.")
    w("")
    w("Exclusions during selection:")
    w("")
    for k, v in excl.most_common():
        w(f"* {k}: {v} entries")
    w("")
    w("## Granularity: word, part of speech and sense")
    w("")
    w("Oxford 5000, Octanove and CEFR-J label a **word with a part of speech**, not individual senses. Crux stores this as `granularity: \"word+pos\"` in `cefrEvidence` and never claims that a source labelled the sense. The sense taught for each word (`senseId`) was chosen by the editor; where a lower-level sense exists this is noted in `senseNote`. No sense-level CEFR check against the English Vocabulary Profile was possible (see `CREDITS.md`).")
    w("")
    w("## Exercise bank")
    w("")
    w("| Exercise | Items |")
    w("|---|---|")
    w(f"| Quick Pick (EN→RU / RU→EN) | every word ({items['quickpick_words']}), options drawn at run time |")
    w(f"| Recall (definition + translation + situation) | {items['recall_words']} |")
    w(f"| Context Gap (choice with authored distractors / typing) | {items['gap_sentences']} sentences |")
    w(f"| Collocation Builder — complete | {items['collocation_tasks']} |")
    w(f"| Collocation Builder — odd one out | {items['odd_one_out_tasks']} |")
    w(f"| Word Formation (verified in CatVar 2.1 / WordNet 3.0) | {items['word_formation']} |")
    w(f"| Nuance Duel (incl. reverse items) | {items['nuance_duels']} |")
    w(f"| Fix It | {items['fix_it']} |")
    w(f"| One Word, Three Contexts | {items['trio']} |")
    w(f"| Real-Life Reply | {items['real_life_reply']} |")
    w(f"| Match | every word, 4 per round |")
    w(f"| Rewrite (prepared accepted answers) | {items['rewrite']} |")
    w(f"| Listen & Type | every example sentence, when an offline English voice exists |")
    w("")
    w(f"Every word takes part in at least **{rep['mechanics_per_word_min']}** exercise types (average {rep['mechanics_per_word_avg']}), always including typed recall and context work.")
    w("")
    w("## Distribution")
    w("")
    w("| Topic | Words |")
    w("|---|---|")
    for t in topics:
        w(f"| {t} | {by_topic.get(t, 0)} |")
    w("")
    w("| Part of speech | Words |")
    w("|---|---|")
    for k, v in sorted(rep["by_pos"].items(), key=lambda x: -x[1]):
        w(f"| {k} | {v} |")
    w("")
    w("| Register | Words |")
    w("|---|---|")
    for k, v in sorted(rep["by_register"].items(), key=lambda x: -x[1]):
        w(f"| {k} | {v} |")
    w("")
    w("## Checks")
    w("")
    w("Structural (automatic, `scripts/validate_batch.py` + `scripts/validate_dataset.py`): schema, one marked target per sentence, the marked word is a form of the lemma, the word never appears twice in a sentence, definitions do not contain the word, distractors distinct and of the same grammatical form, alternatives not listed as distractors, identical form in all three trio sentences, fix-it answers are forms of the target, rewrite answers contain the target, derivations verified, no duplicate sentences across the whole bank, no placeholders, sources and evidence present for every word.")
    w("")
    if reviews:
        w(f"Editorial (language) review: {len(reviews)} batch reviews by a second editor; {rv['reviewed']} entries reviewed, {rv['changed']} entries changed, {rv['fixed']} items fixed, {rv['deleted']} optional items deleted, {rv['removed']} entries removed. Logs: `content/reviews/`.")
    w("")
    w(f"Build: {build['counts']['words']} entries compiled; {build['counts']['dropped']} dropped by the build, {build['counts']['skipped']} skipped by authors, {build['counts']['removed_in_review']} removed in review, {build['counts']['optional_items_removed']} optional items removed for failing checks (details: `data/build/build_report.json`).")
    w("")
    if rep["failures"]:
        w("**Failed checks:**")
        for f in rep["failures"]:
            w(f"* {f}")
    else:
        w("All structural checks pass.")
    w("")
    w("## Limitations")
    w("")
    w("* CEFR evidence is at word+POS level; no source available here labels senses. Sense choice is an editorial decision.")
    w("* The English Vocabulary Profile could not be used (no bulk access; blocked from the build environment).")
    w(f"* {by_ver.get('octanove-c1c2-1.0', 0)} words rely on the Octanove list, whose compilation method is not documented in detail.")
    w(f"* {rep['by_corpus'].get('wordfreq', 0)} Oxford-verified words are absent from EFLLex's small textbook corpus; their corpus evidence is general frequency (wordfreq).")
    w(f"* {rep['lower_label_elsewhere']} words have a lower label in CEFR-J for the same word+POS (list disagreement, usually because of a basic sense).")
    w("* All learning content was written with AI assistance and checked by automatic validators and a second AI editorial pass; it has not been reviewed by a human native-speaker editor. Some sentences may still sound less natural than a professional course book, and a few distractors may be arguable.")
    w("* Translations cover the taught sense only.")
    w("")
    open(os.path.join(ROOT, "CONTENT_AUDIT.md"), "w", encoding="utf-8").write("\n".join(L))
    print("wrote CONTENT_AUDIT.md")


if __name__ == "__main__":
    main()
