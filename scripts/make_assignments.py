#!/usr/bin/env python3
"""Split data/candidates/candidates.csv into authoring batches content/assignments/bNNN.json."""
import csv
import json
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
N_BATCHES = 36

rows = list(csv.DictReader(open(os.path.join(ROOT, "data", "candidates", "candidates.csv"), encoding="utf-8")))
size = math.ceil(len(rows) / N_BATCHES)
os.makedirs(os.path.join(ROOT, "content", "assignments"), exist_ok=True)
for b in range(N_BATCHES):
    chunk = rows[b * size:(b + 1) * size]
    if not chunk:
        break
    words = []
    for r in chunk:
        hint = {
            "lemma": r["lemma"], "pos": r["pos"],
            "c1_label_source": "Oxford 5000 (word+POS)" if r["verified_by"] == "oxford5000" else "Octanove C1/C2 profile (word+POS)",
        }
        if r["other_verified_pos"]:
            hint["also_c1_as"] = r["other_verified_pos"]
        if r["oxford_entry"] and r["oxford_entry"] not in (r["lemma"], r["lemma"] + "_1"):
            hint["oxford_homograph_entry"] = r["oxford_entry"]
        if r["cefrj_level"]:
            hint["lower_label_elsewhere"] = "CEFR-J lists this word+POS at " + r["cefrj_level"] + \
                " (probably a more basic sense): prefer the advanced sense"
        words.append(hint)
    name = f"b{b + 1:03d}"
    json.dump({"batch": name, "words": words}, open(os.path.join(ROOT, "content", "assignments", name + ".json"), "w",
              encoding="utf-8"), ensure_ascii=False, indent=1)
    print(name, len(words), words[0]["lemma"], "..", words[-1]["lemma"])
