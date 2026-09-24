#!/usr/bin/env python3
"""Select C1 candidate lemmas: corpus first (EFLLex), then CEFR verification.

Step 1  Corpus pool: every EFLLex row (noun/verb/adjective/adverb/preposition/
        conjunction) that is attested in the B2 or C1 sub-corpus.  EFLLex
        frequencies are NOT treated as CEFR labels.
Step 2  Verification by a CEFR-labelled resource at word+POS granularity:
          * Oxford 5000 label C1 for the same lemma and POS  -> "oxford5000"
          * otherwise Octanove C1/C2 profile label C1 for the same lemma and
            POS, with no A1-B2 label for that lemma+POS in Oxford 3000/5000 or
            CEFR-J                                             -> "octanove"
Step 3  Conflict filters (sense-level ambiguity):
          * Oxford also labels the same lemma+POS at A1-B1  -> excluded
          * CEFR-J labels the same lemma+POS at A1-A2        -> excluded
          * CEFR-J B1/B2 labels are kept but recorded as a disagreement.
Step 4  Editorial exclusions (listed in EDITORIAL_EXCLUDE with reasons).

Neither Oxford nor Octanove labels individual senses; the output keeps that
granularity explicit ("granularity": "word+pos").  Sense choice happens later
in content authoring and is recorded as an editorial decision.

Output: data/candidates/candidates.csv and data/candidates/selection_report.json
"""
import csv
import collections
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "sources", "raw")
OUT = os.path.join(ROOT, "data", "candidates")

TAG2POS = {"NN": "noun", "VB": "verb", "JJ": "adjective", "RB": "adverb",
           "IN": "preposition", "CC": "conjunction"}
LEVELS = ["a1", "a2", "b1", "b2", "c1"]

# Words removed for editorial reasons (not level reasons).  Kept short and explicit.
EDITORIAL_EXCLUDE = {
    # distressing topics that do not suit short game-like drills
    "rape": "distressing topic", "genocide": "distressing topic", "massacre": "distressing topic",
    "suicide": "distressing topic", "abortion": "distressing topic", "torture": "distressing topic",
    "atrocity": "distressing topic", "assassination": "distressing topic", "hanging": "execution sense, distressing",
    "sexuality": "sensitive topic, low value for drills", "lesbian": "identity term, unsuitable for drills",
    "lust": "sexual connotation, low value", "gunman": "violent news vocabulary", "bomber": "violent news vocabulary",
    # US-specific institutional vocabulary with little general use
    "congressional": "US-specific", "senator": "US-specific", "gallon": "US unit, low value",
    "acre": "imperial unit, low value", "auto": "US informal for 'car', low value",
    # homographs whose Oxford C1 label belongs to a rarer homograph of an A1-B1 word
    "bass": "homograph (music vs fish)", "bow": "homograph (bend vs weapon)", "buck": "slang/animal homograph",
    "well": "homograph of A1 adverb", "minute": "homograph of A1 noun", "content": "homograph of B1 noun",
    "fine": "homograph of A1 adjective", "fit": "homograph of A2/B1 words", "sound": "homograph of A2 noun",
    "just": "homograph of A1 adverb", "top": "homograph of A1 noun", "total": "homograph of A2 adjective",
    "say": "homograph of A1 verb", "spell": "homograph of A1 verb", "march": "homograph of month name",
    "grave": "noun/adjective homographs", "net": "homograph of A2 noun", "rock": "homograph of A2 noun",
    "pop": "homograph of A2 noun", "log": "homograph (wood/record)", "shoot": "homograph of B1 verb",
    "bat": "sports homograph of animal noun", "screw": "vulgar informal senses dominate",
    "con": "informal homograph ('pros and cons')", "bald": "verb use is marginal",
    "repute": "used almost only as 'reputed', marginal as a verb",
    # international words with no learning challenge for Russian speakers
    "casino": "transparent cognate", "cocktail": "transparent cognate", "laser": "transparent cognate",
    "radar": "transparent cognate",
    # Octanove-only entries judged below C1 or of very low value for the target learner
    "aboard": "level doubtful: common word", "pigeon": "level doubtful: common word",
    "carpenter": "level doubtful: common word", "tailor": "level doubtful: common word",
    "hostess": "level doubtful: common word", "chilly": "level doubtful: common word",
    "gourmet": "low value", "midwife": "low value", "munch": "low value", "unoccupied": "low value",
    "unmanned": "low value", "wooded": "low value", "stiffen": "low value", "tangle": "low value",
    "rustle": "low value", "domesticate": "low value", "hibernate": "low value", "hibernation": "low value",
    "geological": "low value", "mythological": "low value (see mythology)", "anthropologist": "see anthropology",
    "acidic": "see acid", "cleverness": "low value", "closeness": "low value", "paternalistic": "low value",
    "pastor": "narrow religious term", "parish": "narrow religious term",
    # -ly adverbs whose adjective is already taught, or with very low value
    "aimlessly": "low value", "ethically": "low value", "conscientiously": "adjective taught",
    "intuitively": "adjective taught", "phenomenally": "adjective taught", "prohibitively": "adjective taught",
    "victoriously": "adjective taught", "fiercely": "adjective taught", "profoundly": "adjective taught",
    "structurally": "adjective taught", "marginally": "adjective taught", "reluctantly": "adjective taught",
}

# Spelling variants listed as separate entries in a source are merged into one lemma.
MERGE_VARIANTS = {"characterisation": "characterization", "maneuver": "manoeuvre",
                  "scrutinise": "scrutinize"}

SPELLING_PAIRS = [("our", "or"), ("ise", "ize"), ("isation", "ization"), ("ising", "izing"),
                  ("tre", "ter"), ("ogue", "og"), ("lling", "ling"), ("lled", "led"),
                  ("ence", "ense"), ("aeo", "eo"), ("oe", "e")]
SPECIAL_VARIANTS = {"aluminium": ["aluminum"], "sceptical": ["skeptical"], "sceptic": ["skeptic"],
                    "scepticism": ["skepticism"], "counselling": ["counseling"],
                    "fulfil": ["fulfill"], "enrol": ["enroll"], "instalment": ["installment"],
                    "judgement": ["judgment"], "grey": ["gray"], "programme": ["program"],
                    "cheque": ["check"], "manoeuvre": ["maneuver"], "mould": ["mold"],
                    "plough": ["plow"], "tyre": ["tire"], "kerb": ["curb"], "pyjamas": ["pajamas"],
                    "ageing": ["aging"], "worshipper": ["worshiper"]}


def variants(word):
    out = {word}
    for a, b in SPELLING_PAIRS:
        for x, y in ((a, b), (b, a)):
            if word.endswith(x):
                out.add(word[: -len(x)] + y)
    for k, vs in SPECIAL_VARIANTS.items():
        if word == k or word in vs:
            out.add(k)
            out.update(vs)
    return out


def load_efllex():
    rows = {}
    with open(os.path.join(RAW, "efllex", "EFLLex.tsv"), encoding="utf-8") as f:
        r = csv.reader(f, delimiter="\t")
        header = next(r)
        idx = {h: i for i, h in enumerate(header)}
        for row in r:
            w, t = row[0].strip().lower(), row[1].strip()
            if t not in TAG2POS or not re.fullmatch(r"[a-z][a-z\-' ]*", w):
                continue
            freqs = [float(row[idx[f"level_freq@{l}"]]) for l in LEVELS]
            docs = [int(float(row[idx[f"nb_doc@{l}"]])) for l in LEVELS]
            rows[(w, TAG2POS[t])] = {
                "tag": t, "freq": freqs, "total": float(row[idx["total_freq@total"]]),
                "nb_doc": docs, "nb_doc_total": int(float(row[idx["nb_doc@total"]])),
            }
    return rows


def load_oxford():
    labels = collections.defaultdict(set)
    slugs = {}
    with open(os.path.join(RAW, "oxford", "nalgeon_oxford-5k.csv"), encoding="utf-8") as f:
        for r in csv.DictReader(f):
            lvl = (r["level"] or "").strip().lower()
            if not lvl:
                continue
            key = (r["word"].strip().lower(), r["pos"].strip())
            labels[key].add(lvl)
            if lvl == "c1":
                m = re.search(r"/english/([^/?#]+)$", r["definition_url"] or "")
                slugs[key] = m.group(1) if m else ""
    return labels, slugs


def load_olp(fname):
    labels = collections.defaultdict(set)
    with open(os.path.join(RAW, "olp", fname), encoding="utf-8") as f:
        for r in csv.DictReader(f):
            pos = r["pos"].strip().replace("vern", "verb")
            for hw in r["headword"].split("/"):
                labels[(hw.strip().lower(), pos)].add(r["CEFR"].strip().upper())
    return labels


def zipf(word):
    try:
        from wordfreq import zipf_frequency
    except ImportError:  # pragma: no cover
        return None
    return zipf_frequency(word, "en")


def main():
    eff = load_efllex()
    ox, slugs = load_oxford()
    cj = load_olp("cefrj-vocabulary-profile-1.5.csv")
    octa = load_olp("octanove-vocabulary-profile-c1c2-1.0.csv")
    eff_by_word = collections.defaultdict(list)
    for (w, pos) in eff:
        eff_by_word[w].append(pos)

    def find(table, word, pos):
        for v in variants(word):
            if (v, pos) in table:
                return v, table[(v, pos)]
        return None, None

    def efllex_for(word, pos):
        """Same-POS attestation first, then lemma-level attestation (other POS)."""
        v, e = find(eff, word, pos)
        if e:
            return v, pos, e, "lemma+pos"
        for v in variants(word):
            if eff_by_word.get(v):
                best = max(eff_by_word[v], key=lambda p: eff[(v, p)]["total"])
                return v, best, eff[(v, best)], "lemma"
        return None, None, None, None

    stats = collections.Counter()
    excluded = []
    entries = []

    # (1) Oxford 5000 C1 entries -------------------------------------------------
    for (w, pos), lv in sorted(ox.items()):
        if "c1" not in lv:
            continue
        stats["oxford_c1_entries"] += 1
        entries.append((w, pos, "oxford5000"))
    # (2) Octanove C1 entries, only when EFLLex attests them in B2/C1 materials ---
    for (w, pos), lv in sorted(octa.items()):
        if "C1" not in lv:
            continue
        stats["octanove_c1_entries"] += 1
        oxw, oxl = find(ox, w, pos)
        cjw, cjl = find(cj, w, pos)
        if oxl or cjl:
            stats["octanove_skipped_labelled_elsewhere"] += 1
            continue
        ew, epos, e, gran = efllex_for(w, pos)
        if not e or gran != "lemma+pos" or (e["freq"][3] <= 0 and e["freq"][4] <= 0):
            stats["octanove_skipped_no_B2C1_corpus_attestation"] += 1
            continue
        entries.append((w, pos, "octanove"))

    selected = {}
    merged = []
    for w, pos, source in entries:
        if w in MERGE_VARIANTS:
            merged.append({"variant": w, "kept": MERGE_VARIANTS[w], "pos": pos})
            continue
        oxw, oxl = find(ox, w, pos)
        cjw, cjl = find(cj, w, pos)
        ocw, ocl = find(octa, w, pos)
        reason = None
        if oxl and oxl & {"a1", "a2", "b1"}:
            reason = "oxford_lower_label_same_pos:" + ",".join(sorted(oxl))
        elif cjl and cjl & {"A1", "A2"}:
            reason = "cefrj_lower_label_same_pos:" + ",".join(sorted(cjl))
        elif w in EDITORIAL_EXCLUDE:
            reason = "editorial:" + EDITORIAL_EXCLUDE[w]
        if reason:
            excluded.append({"lemma": w, "pos": pos, "verified_by": source, "reason": reason})
            stats["excluded_" + reason.split(":")[0]] += 1
            continue
        ew, epos, e, gran = efllex_for(w, pos)
        rec = {
            "lemma": w, "pos": pos, "verified_by": source,
            "oxford_levels_same_pos": ",".join(sorted(oxl)) if oxl else "",
            "oxford_entry": slugs.get((w, pos), ""),
            "octanove_level": ",".join(sorted(ocl)) if ocl else "",
            "cefrj_level": ",".join(sorted(cjl)) if cjl else "",
            "disagreement": ("cefrj:" + ",".join(sorted(cjl))) if cjl else "",
            "corpus": "efllex" if e else "wordfreq",
            "efllex_word": ew or "", "efllex_pos": epos or "", "efllex_match": gran or "",
            "zipf": round(zipf(w) or 0, 2),
        }
        if e:
            f = e["freq"]
            tot = sum(f)
            rec.update({
                "efllex_a1": f[0], "efllex_a2": f[1], "efllex_b1": f[2], "efllex_b2": f[3], "efllex_c1": f[4],
                "efllex_total": e["total"], "efllex_nb_doc": e["nb_doc_total"],
                "efllex_first_level": LEVELS[next(i for i, x in enumerate(f) if x > 0)].upper() if tot else "",
                "efllex_b2c1_share": round((f[3] + f[4]) / tot, 3) if tot else 0,
            })
        prev = selected.get(w)
        better = prev is None or (
            (prev["corpus"] != "efllex" and rec["corpus"] == "efllex") or
            (prev["corpus"] == rec["corpus"] and prev.get("efllex_match") != "lemma+pos" and rec.get("efllex_match") == "lemma+pos") or
            (prev["corpus"] == rec["corpus"] and prev.get("efllex_match") == rec.get("efllex_match") and
             rec.get("efllex_total", 0) > prev.get("efllex_total", 0)))
        if better:
            if prev is not None:
                rec["other_verified_pos"] = ";".join(filter(None, [prev["pos"], prev.get("other_verified_pos", "")]))
            selected[w] = rec
        else:
            prev["other_verified_pos"] = ";".join(filter(None, [prev.get("other_verified_pos", ""), pos]))

    rows = sorted(selected.values(), key=lambda r: r["lemma"])
    os.makedirs(OUT, exist_ok=True)
    fields = ["lemma", "pos", "other_verified_pos", "verified_by", "oxford_levels_same_pos", "oxford_entry",
              "octanove_level", "cefrj_level", "disagreement", "corpus", "efllex_word", "efllex_pos",
              "efllex_match", "efllex_a1", "efllex_a2", "efllex_b1", "efllex_b2", "efllex_c1", "efllex_total",
              "efllex_nb_doc", "efllex_first_level", "efllex_b2c1_share", "zipf"]
    with open(os.path.join(OUT, "candidates.csv"), "w", newline="", encoding="utf-8") as f:
        wr = csv.DictWriter(f, fieldnames=fields)
        wr.writeheader()
        for r in rows:
            wr.writerow({k: r.get(k, "") for k in fields})
    report = {
        "stats": dict(stats),
        "selected_unique_lemmas": len(rows),
        "selected_by_source": dict(collections.Counter(r["verified_by"] for r in rows)),
        "selected_by_corpus": dict(collections.Counter(r["corpus"] + ":" + r.get("efllex_match", "") for r in rows)),
        "selected_by_pos": dict(collections.Counter(r["pos"] for r in rows)),
        "cefrj_disagreements": sum(1 for r in rows if r["disagreement"]),
        "merged_spelling_variants": merged,
        "excluded": excluded,
    }
    with open(os.path.join(OUT, "selection_report.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=1)
    print(json.dumps({k: v for k, v in report.items() if k != "excluded"}, indent=1))
    print("excluded:", len(excluded))


if __name__ == "__main__":
    main()
