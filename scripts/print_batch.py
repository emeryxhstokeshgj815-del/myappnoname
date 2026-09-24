#!/usr/bin/env python3
"""Print a batch in a compact, readable form for editorial review.

usage: python3 scripts/print_batch.py content/words/b001 [lemma ...]
"""
import glob
import json
import os
import sys


def show(e, f):
    out = []
    p = out.append
    p(f"=== {e['lemma']} ({e['pos']}) [{os.path.basename(f)}] topic={e.get('topic')} register={e.get('register')} ambiguous={e.get('ambiguous')}")
    if e.get("senseNote"):
        p(f"  senseNote: {e['senseNote']}")
    p(f"  DEF: {e.get('definitionEn')}")
    p(f"  RU: {' | '.join(e.get('translationsRu', []))}    accepted: {e.get('acceptedAnswers')}")
    p(f"  SITUATION: {e.get('situation')}")
    for i, x in enumerate(e.get("examples", [])):
        p(f"  EX{i}: {x.get('text')}")
        p(f"       distractors={x.get('distractors')} alternatives={x.get('alternatives')}")
    t = e.get("trio") or {}
    for i, x in enumerate(t.get("texts", [])):
        p(f"  TRIO{i}: {x}")
    p(f"       trio alternatives={t.get('alternatives')}")
    p(f"  COLL: {' ; '.join(e.get('collocations', []))}")
    b = e.get("badCollocation") or {}
    p(f"  BAD: {b.get('text')} — {b.get('noteRu')}")
    c = e.get("collocationTask") or {}
    p(f"  CTASK: {c.get('prompt')} -> {c.get('answer')} | wrong: {c.get('distractors')} — {c.get('explanationRu')}")
    n = e.get("nuance") or {}
    p(f"  NUANCE vs {n.get('rival')} ({n.get('rivalForm')}): {n.get('text')} — {n.get('explanationRu')}")
    if n.get("reverse"):
        r = n["reverse"]
        p(f"  NUANCE-REV: {r.get('text')} (target form {r.get('targetForm')}) — {r.get('explanationRu')}")
    fx = e.get("fixIt") or {}
    p(f"  FIXIT: {fx.get('text')} -> {fx.get('answer')} — {fx.get('explanationRu')}")
    if e.get("wordFormation"):
        w = e["wordFormation"]
        p(f"  WF: ({w.get('base')}) {w.get('text')} -> {w.get('answer')}")
    if e.get("reply"):
        r = e["reply"]
        p(f"  REPLY: {r.get('context')}")
        for i, o in enumerate(r.get("options", [])):
            p(f"     {'*' if i == r.get('answer') else ' '}{i}: {o}")
        p(f"     — {r.get('explanationRu')}")
    if e.get("rewrite"):
        r = e["rewrite"]
        p(f"  REWRITE: {r.get('original')}  =>  {r.get('frame')}  accepted={r.get('accepted')}")
    return "\n".join(out)


def main():
    d = sys.argv[1]
    only = set(sys.argv[2:])
    for f in sorted(glob.glob(os.path.join(d, "*.json"))):
        for e in json.load(open(f, encoding="utf-8")):
            if "skipped" in e:
                print(f"=== SKIPPED {e.get('skipped')} ({e.get('pos')}): {e.get('reason')}")
                continue
            if only and e.get("lemma") not in only:
                continue
            print(show(e, f))
            print()


if __name__ == "__main__":
    main()
