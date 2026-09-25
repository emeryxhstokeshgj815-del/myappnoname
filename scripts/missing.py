#!/usr/bin/env python3
"""List assigned words that have no entry yet: python3 scripts/missing.py b004"""
import glob, json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
b = sys.argv[1]
want = [(w["lemma"], w["pos"]) for w in json.load(open(os.path.join(ROOT, "content", "assignments", b + ".json")))["words"]]
have = set()
files = sorted(glob.glob(os.path.join(ROOT, "content", "words", b, "*.json")))
for f in files:
    for e in json.load(open(f)):
        have.add((e.get("skipped") or e.get("lemma"), e.get("pos")))
miss = [f"{l} ({p})" for l, p in want if (l, p) not in have]
nxt = 1 + max([int(os.path.basename(f)[1:-5]) for f in files] or [0])
print(f"{b}: {len(miss)} missing; next file p{nxt}.json: " + ", ".join(miss))
