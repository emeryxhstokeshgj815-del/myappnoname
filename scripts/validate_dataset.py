#!/usr/bin/env python3
"""Structural checks of the compiled dataset (data/build/lexicon.json).

Structure is not language quality: see content/reviews/ for the editorial review.
Writes data/build/dataset_report.json and exits 1 if a hard requirement fails.
"""
import collections
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lexutil as L  # noqa: E402

ROOT = L.ROOT
MIN_WORDS = 1000
MIN_CONTEXTS = 2000

PLACEHOLDER = re.compile(r"\b(TODO|TBD|lorem|placeholder|xxx)\b|\.\.\.|…", re.I)


def main():
    lex = json.load(open(os.path.join(ROOT, "data", "build", "lexicon.json"), encoding="utf-8"))
    words = lex["words"]
    fails, warns = [], []

    # ---- counting -------------------------------------------------------------
    lemmas = [w["lemma"] for w in words]
    unique = set(lemmas)
    senses = len(words)
    confirmed = {w["lemma"] for w in words if any(e["label"] == "C1" or "C1" in e["label"].split(",")
                                                   for e in w["cefrEvidence"] if e["source"] in ("oxford-5000", "octanove-c1c2-1.0"))}
    if len(confirmed) < MIN_WORDS:
        fails.append(f"only {len(confirmed)} confirmed C1 lemmas (< {MIN_WORDS})")
    # forms/spelling variants must not create extra "words"
    form_owner = {}
    for w in words:
        for f in set(w["forms"]) | {a.lower() for a in w["acceptedAnswers"]}:
            if f in form_owner and form_owner[f] != w["lemma"]:
                fails.append(f"'{f}' is a form/variant of both {form_owner[f]} and {w['lemma']}")
            form_owner[f] = w["lemma"]
    ids = [w["id"] for w in words]
    if len(set(ids)) != len(ids):
        fails.append("duplicate ids")

    # ---- per word -------------------------------------------------------------------
    contexts = set()
    mech_counts = collections.Counter()
    per_word_mechs = []
    defs = collections.Counter(w["definitionEn"].strip().lower() for w in words)
    for d, n in defs.items():
        if n > 1:
            warns.append(f"definition used {n} times: {d!r}")
    for w in words:
        wid = w["id"]
        if len(w["examples"]) < 2:
            fails.append(f"{wid}: fewer than 2 examples")
        if not w["sourceReferences"] or not w["cefrEvidence"] or not w["corpusEvidence"]:
            fails.append(f"{wid}: missing source/evidence")
        for field in ("definitionEn", "situation"):
            if PLACEHOLDER.search(w[field]):
                fails.append(f"{wid}: placeholder in {field}")
        for t in w["translationsRu"]:
            if not L.CYR.search(t):
                fails.append(f"{wid}: non-Russian translation {t!r}")
        for ex in w["examples"]:
            m = L.marks(ex["text"])
            if len(m) != 1 or m[0].lower() not in w["forms"] and m[0].lower() not in {a.lower() for a in w["acceptedAnswers"]}:
                fails.append(f"{wid}: bad example mark in {ex['text']!r}")
            opts = [m[0].lower() if m else ""] + [d.lower() for d in ex["distractors"]]
            if len(set(opts)) != len(opts):
                fails.append(f"{wid}: duplicate options in example {ex['text']!r}")
            contexts.add(L.unmark(ex["text"]).lower())
        for t in w["trio"]["texts"]:
            contexts.add(L.unmark(t).lower())
        ct = w["collocationTask"]
        if len({ct["answer"].lower(), *[d.lower() for d in ct["distractors"]]}) != 4:
            fails.append(f"{wid}: collocation options not distinct")
        nu = w["nuance"]
        contexts.add(L.unmark(nu["text"]).lower())
        if nu["rivalForm"].lower() == L.marks(nu["text"])[0].lower():
            fails.append(f"{wid}: nuance options identical")
        if nu.get("reverse"):
            contexts.add(L.unmark(nu["reverse"]["text"]).lower())
        contexts.add(L.unmark(w["fixIt"]["text"]).lower())
        mechs = ["quickpick", "recall", "gap", "match", "collocation", "nuance", "fixit", "trio"]
        if w.get("wordFormation"):
            mechs.append("wordform")
            contexts.add(L.unmark(w["wordFormation"]["text"]).lower())
            if not w["wordFormation"].get("verifiedBy"):
                fails.append(f"{wid}: word formation without verified derivation")
        if w.get("reply"):
            mechs.append("reply")
            if len({o.lower() for o in w["reply"]["options"]}) != 3:
                fails.append(f"{wid}: reply options not distinct")
            contexts.add(w["reply"]["context"].lower())
        if w.get("rewrite"):
            mechs.append("rewrite")
            contexts.add(w["rewrite"]["original"].lower())
        mechs.append("listen")  # needs an offline voice at runtime
        per_word_mechs.append(len(mechs))
        mech_counts.update(mechs)
        # activity requirements: active production + context use
        if not {"recall", "gap"} <= set(mechs):
            fails.append(f"{wid}: lacks production/context mechanics")

    if len(contexts) < MIN_CONTEXTS:
        fails.append(f"only {len(contexts)} unique context sentences (< {MIN_CONTEXTS})")
    if min(per_word_mechs or [0]) < 3:
        fails.append("a word takes part in fewer than 3 exercise types")

    report = {
        "unique_lemmas": len(unique),
        "confirmed_c1_lemmas": len(confirmed),
        "senses": senses,
        "by_verification": collections.Counter(
            "oxford-5000" if any(e["source"] == "oxford-5000" for e in w["cefrEvidence"]) else "octanove-c1c2-1.0" for w in words),
        "by_corpus": collections.Counter(w["corpusEvidence"]["source"] + (":" + w["corpusEvidence"].get("match", "") if w["corpusEvidence"]["source"] == "efllex-2018" else "") for w in words),
        "lower_label_elsewhere": sum(1 for w in words if w["levelStatus"] != "confirmed"),
        "by_pos": collections.Counter(w["partOfSpeech"] for w in words),
        "by_topic": collections.Counter(w["topic"] for w in words),
        "by_register": collections.Counter(w["register"] for w in words),
        "examples": sum(len(w["examples"]) for w in words),
        "trio_sentences": sum(len(w["trio"]["texts"]) for w in words),
        "collocations": sum(len(w["collocations"]) for w in words),
        "unique_context_sentences": len(contexts),
        "items": {
            "quickpick_words": len(words), "recall_words": len(words), "gap_sentences": sum(len(w["examples"]) for w in words),
            "collocation_tasks": sum(1 for w in words if w.get("collocationTask")),
            "odd_one_out_tasks": sum(1 for w in words if w.get("badCollocation")),
            "nuance_duels": sum(1 + (1 if w["nuance"].get("reverse") else 0) for w in words),
            "fix_it": sum(1 for w in words if w.get("fixIt")),
            "trio": sum(1 for w in words if w.get("trio")),
            "word_formation": sum(1 for w in words if w.get("wordFormation")),
            "real_life_reply": sum(1 for w in words if w.get("reply")),
            "rewrite": sum(1 for w in words if w.get("rewrite")),
        },
        "mechanics_per_word_min": min(per_word_mechs or [0]),
        "mechanics_per_word_avg": round(sum(per_word_mechs) / max(1, len(per_word_mechs)), 2),
        "failures": fails,
        "warnings": warns[:200],
        "warning_count": len(warns),
    }
    json.dump(report, open(os.path.join(ROOT, "data", "build", "dataset_report.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(json.dumps({k: v for k, v in report.items() if k not in ("warnings",)}, ensure_ascii=False, indent=1)[:4000])
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
