#!/usr/bin/env python3
"""Compile authored content + selection evidence into the app dataset.

Inputs:  content/words/b*/p*.json         (authored entries, see content/GUIDELINES.md)
         data/candidates/candidates.csv   (selection + CEFR/corpus evidence)
         content/reviews/removed.json     (optional: entries removed in editorial review)
Outputs: data/build/lexicon.json          (full dataset, readable)
         data/build/app-data.json         (what the app embeds)
         data/build/build_report.json     (what was dropped and why)
"""
import csv
import glob
import json
import os
import sys
import datetime as dt

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lexutil as L  # noqa: E402
from validate_batch import Report, validate_entry, load_dir  # noqa: E402

ROOT = L.ROOT
BUILD = os.path.join(ROOT, "data", "build")
POS_SHORT = {"noun": "n", "verb": "v", "adjective": "adj", "adverb": "adv", "preposition": "prep", "conjunction": "conj"}

SOURCES = {
    "efllex-2018": "EFLLex (Dürlich & François, LREC 2018), CEFRLex/CENTAL UCLouvain — CC BY-NC-SA 4.0",
    "oxford-5000": "The Oxford 3000 and 5000 word lists (Oxford University Press) — CEFR labels at word+POS level, used for verification only",
    "octanove-c1c2-1.0": "Octanove Vocabulary Profile C1/C2 v1.0 (Octanove Labs, Open Language Profiles) — CC BY-SA 4.0",
    "cefrj-1.5": "CEFR-J Vocabulary Profile v1.5 (Tono Laboratory, TUFS) — free with citation",
    "wordfreq": "wordfreq (Speer, 2022) general-English frequencies — data CC BY-SA 4.0",
    "wordnet-3.0": "Princeton WordNet 3.0 — derivational links for Word Formation",
    "catvar-2.1": "CatVar 2.1 (Habash & Dorr, NAACL 2003; University of Maryland, OSL 1.1) — word families for Word Formation",
    "crux-editorial": "Crux editorial content: definitions, translations, examples and exercises written for this app",
}


def load_candidates():
    rows = {}
    with open(os.path.join(ROOT, "data", "candidates", "candidates.csv"), encoding="utf-8") as f:
        for r in csv.DictReader(f):
            rows[(r["lemma"], r["pos"])] = r
    return rows


def evidence(c, pos):
    ev = []
    if c["verified_by"] == "oxford5000":
        ev.append({"source": "oxford-5000", "label": "C1", "pos": pos, "granularity": "word+pos",
                   "entryRef": c["oxford_entry"] or c["lemma"],
                   "note": "The list labels the headword and part of speech, not individual senses."})
    if c["octanove_level"]:
        ev.append({"source": "octanove-c1c2-1.0", "label": c["octanove_level"], "pos": pos, "granularity": "word+pos"})
    if c["cefrj_level"]:
        ev.append({"source": "cefrj-1.5", "label": c["cefrj_level"], "pos": pos, "granularity": "word+pos",
                   "agreesWithC1": False,
                   "note": "Lower label for the same word+POS in another list (usually a more basic sense)."})
    return ev


def corpus(c):
    if c["corpus"] == "efllex":
        freq = {lvl: round(float(c["efllex_" + lvl.lower()]), 2) for lvl in ["A1", "A2", "B1", "B2", "C1"]}
        return {"source": "efllex-2018", "match": c["efllex_match"], "efllexWord": c["efllex_word"],
                "efllexPos": c["efllex_pos"], "freqPerMillionByLevel": freq,
                "totalFreqPerMillion": round(float(c["efllex_total"]), 2), "documents": int(float(c["efllex_nb_doc"] or 0)),
                "firstLevelAttested": c["efllex_first_level"],
                "note": "Normalised frequency in graded EFL materials; a candidate signal, not a CEFR label."}
    return {"source": "wordfreq", "zipf": float(c["zipf"]),
            "note": "Not attested in EFLLex's textbook corpus; general-English frequency from wordfreq."}


def known_words(extra):
    """Common English word forms, used by the app to tell a typo from a different word."""
    wn = L.wordnet()
    from lemminflect import getAllInflections
    out = set(extra)
    upos = {"n": "NOUN", "v": "VERB", "a": "ADJ", "s": "ADJ", "r": "ADV"}
    for syn in wn.all_synsets():
        for lem in syn.lemmas():
            w = lem.name().lower()
            if not w.isalpha() or len(w) < 3:
                continue
            if L.zipf(w) < 3.0:
                continue
            out.add(w)
            for forms in getAllInflections(w, upos=upos[syn.pos()]).values():
                for f in forms:
                    if f.isalpha():
                        out.add(f.lower())
    return " ".join(sorted(out))


def main():
    cands = load_candidates()
    removed = {}
    rp = os.path.join(ROOT, "content", "reviews", "removed.json")
    if os.path.exists(rp):
        for x in json.load(open(rp, encoding="utf-8")):
            removed[(x["lemma"], x["pos"])] = x["reason"]
    report = {"dropped": [], "skipped_by_authors": [], "removed_in_review": [], "item_errors": []}
    words = []
    seen = set()
    for d in sorted(glob.glob(os.path.join(ROOT, "content", "words", "b*"))):
        entries, skipped, bad = load_dir(d)
        for f, msg in bad:
            report["dropped"].append({"file": os.path.relpath(f, ROOT), "reason": msg})
        for s in skipped:
            report["skipped_by_authors"].append({"lemma": s.get("skipped"), "pos": s.get("pos"), "reason": s.get("reason")})
        for f, e in entries:
            key = (str(e.get("lemma", "")).lower(), e.get("pos"))
            if key in removed:
                report["removed_in_review"].append({"lemma": key[0], "pos": key[1], "reason": removed[key]})
                continue
            if key not in cands:
                report["dropped"].append({"lemma": key[0], "pos": key[1], "reason": "not a selected candidate"})
                continue
            if key[0] in seen:
                report["dropped"].append({"lemma": key[0], "pos": key[1], "reason": "duplicate lemma"})
                continue
            r = Report()
            validate_entry(r, e, {})

            def section(where, msg):
                for opt in ("nuance.reverse", "wordFormation", "reply", "rewrite"):
                    if msg.startswith(opt) or (" " + opt) in where:
                        return opt
                return None

            core_err = [m for (_, wh, m) in r.errors if section(wh, m) is None]
            if core_err:
                report["dropped"].append({"lemma": key[0], "pos": key[1], "reason": "; ".join(core_err[:3])})
                continue
            # optional parts with errors are removed; the word stays
            for (_, wh, m) in r.errors:
                opt = section(wh, m)
                if opt == "nuance.reverse":
                    if e.get("nuance", {}).pop("reverse", None) is not None:
                        report["item_errors"].append({"lemma": key[0], "removed": opt, "reason": m})
                elif opt and e.pop(opt, None) is not None:
                    report["item_errors"].append({"lemma": key[0], "removed": opt, "reason": m})
            seen.add(key[0])
            c = cands[key]
            ps = POS_SHORT[key[1]]
            variants = [a.lower() for a in e["acceptedAnswers"] if a.lower() != key[0]]
            forms = sorted(L.forms(key[0], key[1], variants))
            refs = ["crux-editorial"]
            if c["corpus"] == "efllex":
                refs.append("efllex-2018")
            else:
                refs.append("wordfreq")
            if c["verified_by"] == "oxford5000":
                refs.append("oxford-5000")
            if c["octanove_level"]:
                refs.append("octanove-c1c2-1.0")
            if c["cefrj_level"]:
                refs.append("cefrj-1.5")
            if e.get("wordFormation"):
                refs.append(L.derivation_source(e["wordFormation"]["base"], e["wordFormation"]["answer"][0]) or "wordnet-3.0")
            w = {
                "id": f"{key[0]}-{ps}",
                "lemma": key[0],
                "partOfSpeech": key[1],
                "senseId": f"{key[0]}.{ps}.1",
                "definitionEn": e["definitionEn"].strip(),
                "translationsRu": [t.strip() for t in e["translationsRu"]],
                "acceptedAnswers": [a.strip() for a in e["acceptedAnswers"]],
                "forms": forms,
                "topic": e["topic"],
                "register": e["register"],
                "ambiguous": bool(e["ambiguous"]),
                "senseNote": (e.get("senseNote") or "").strip(),
                "situation": e["situation"].strip(),
                "examples": [{"text": x["text"].strip(), "distractors": x["distractors"],
                              "alternatives": x.get("alternatives", [])} for x in e["examples"]],
                "trio": e["trio"],
                "collocations": e["collocations"],
                "badCollocation": e["badCollocation"],
                "collocationTask": e["collocationTask"],
                "nuance": e["nuance"],
                "fixIt": e["fixIt"],
                "cefrEvidence": evidence(c, key[1]),
                "corpusEvidence": corpus(c),
                "levelStatus": "confirmed" if not c["cefrj_level"] else "confirmed-with-lower-label-elsewhere",
                "sourceReferences": refs,
                "zipf": float(c["zipf"] or 0),
            }
            for opt in ("wordFormation", "reply", "rewrite"):
                if e.get(opt):
                    w[opt] = e[opt]
            if w.get("wordFormation"):
                wf = w["wordFormation"]
                wf["verifiedBy"] = L.derivation_source(wf["base"], wf["answer"][0])
            words.append(w)
    words.sort(key=lambda w: w["lemma"])
    for i, w in enumerate(sorted(words, key=lambda w: -w["zipf"])):
        w["rank"] = i + 1
    os.makedirs(BUILD, exist_ok=True)
    meta = {"app": "Crux", "version": dt.date.today().isoformat(), "builtAt": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
            "sources": SOURCES, "uniqueLemmas": len({w["lemma"] for w in words}), "senses": len(words),
            "license": "Crux editorial content: CC BY-NC-SA 4.0. Evidence fields keep the terms of their sources (see CREDITS.md)."}
    json.dump({"meta": meta, "words": words}, open(os.path.join(BUILD, "lexicon.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    extra = set()
    for w in words:
        extra.update(w["forms"])
    def compact(w):
        """App copy: drop fields the app never reads and repeated boilerplate notes."""
        out = {k: v for k, v in w.items() if k != "zipf"}
        out["cefrEvidence"] = [{k: v for k, v in e.items() if k != "note"} for e in w["cefrEvidence"]]
        out["corpusEvidence"] = {k: v for k, v in w["corpusEvidence"].items() if k != "note"}
        out["examples"] = [{k: v for k, v in x.items() if not (k == "alternatives" and not v)} for x in w["examples"]]
        if not out.get("senseNote"):
            out.pop("senseNote", None)
        return out

    app = {"meta": meta, "words": [compact(w) for w in words], "known": known_words(extra)}
    json.dump(app, open(os.path.join(BUILD, "app-data.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    report["counts"] = {"words": len(words), "dropped": len(report["dropped"]), "skipped": len(report["skipped_by_authors"]),
                        "removed_in_review": len(report["removed_in_review"]), "optional_items_removed": len(report["item_errors"])}
    json.dump(report, open(os.path.join(BUILD, "build_report.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(json.dumps(report["counts"]))


if __name__ == "__main__":
    main()
