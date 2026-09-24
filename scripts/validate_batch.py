#!/usr/bin/env python3
"""Validate authored word entries (content/words/bNNN/*.json).

usage: python3 scripts/validate_batch.py content/words/b001 [--assignment content/assignments/b001.json]
       python3 scripts/validate_batch.py --all      (every batch directory)

ERROR   = must be fixed (the build drops entries/items with errors)
WARNING = probably a problem; fix unless it is a false alarm
"""
import argparse
import glob
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lexutil as L  # noqa: E402

PLACEHOLDER = re.compile(r"\b(TODO|TBD|lorem|placeholder|xxx)\b|\.\.\.|…|\betc\b", re.I)


class Report:
    def __init__(self):
        self.items = []

    def err(self, where, msg):
        self.items.append(("ERROR", where, msg))

    def warn(self, where, msg):
        self.items.append(("WARNING", where, msg))

    @property
    def errors(self):
        return [i for i in self.items if i[0] == "ERROR"]

    @property
    def warnings(self):
        return [i for i in self.items if i[0] == "WARNING"]


def load_dir(path):
    entries, skipped, bad = [], [], []
    for f in sorted(glob.glob(os.path.join(path, "*.json"))):
        try:
            data = json.load(open(f, encoding="utf-8"))
        except Exception as e:  # noqa: BLE001
            bad.append((f, str(e)))
            continue
        if not isinstance(data, list):
            bad.append((f, "file must contain a JSON array"))
            continue
        for e in data:
            if isinstance(e, dict) and "skipped" in e:
                skipped.append(e)
            else:
                entries.append((f, e))
    return entries, skipped, bad


def is_en(text):
    return isinstance(text, str) and text.strip() and not L.CYR.search(text)


def is_ru(text):
    return isinstance(text, str) and L.CYR.search(text)


def check_english(r, where, text, lo=None, hi=None, name="text"):
    if not is_en(text):
        r.err(where, f"{name} must be non-empty English text")
        return False
    if PLACEHOLDER.search(text):
        r.err(where, f"{name} contains a placeholder/ellipsis/etc: {text!r}")
    n = len(L.tokens(L.unmark(text)))
    if lo and n < lo:
        r.warn(where, f"{name} is short ({n} words)")
    if hi and n > hi:
        r.warn(where, f"{name} is long ({n} words)")
    if L.unmark(text).strip()[-1:] not in ".?!\"'”)" and lo:
        r.warn(where, f"{name} should end with punctuation: {text!r}")
    return True


def check_ru(r, where, text, maxlen, name="explanationRu"):
    if not is_ru(text):
        r.err(where, f"{name} must be Russian text")
        return
    if len(text) > maxlen:
        r.warn(where, f"{name} is long ({len(text)} chars > {maxlen})")
    if PLACEHOLDER.search(text):
        r.err(where, f"{name} contains a placeholder/ellipsis")


def one_mark(r, where, text, name="text"):
    m = L.marks(text)
    if len(m) != 1:
        r.err(where, f"{name} needs exactly one [[...]] mark, found {len(m)}: {text!r}")
        return None
    return m[0].strip()


def validate_entry(r, e, lemma_forms_all):
    lemma = str(e.get("lemma", "")).strip().lower()
    pos = e.get("pos")
    w = f"{lemma}/{pos}"
    if not lemma or pos not in L.UPOS:
        r.err(w, "lemma/pos missing or invalid")
        return
    acc = [a.lower() for a in e.get("acceptedAnswers", []) if isinstance(a, str)]
    if lemma not in acc:
        r.err(w, "acceptedAnswers must include the lemma")
    for a in acc:
        if a != lemma and (a[:3] != lemma[:3] or abs(len(a) - len(lemma)) > 3):
            r.warn(w, f"acceptedAnswers should only hold spelling variants, got {a!r}")
    F = L.forms(lemma, pos, [a for a in acc if a != lemma])
    lemma_forms_all[w] = F

    def has_form(text):
        toks = set(L.tokens(text))
        return bool(toks & F)

    # definition / translations / meta ---------------------------------------
    d = e.get("definitionEn", "")
    if check_english(r, w, d, name="definitionEn"):
        n = len(L.tokens(d))
        if n < 3 or n > 18:
            r.warn(w, f"definitionEn has {n} words (aim for 4-16)")
        if has_form(d):
            r.err(w, "definitionEn contains the word itself")
        stem = lemma[:5]
        if len(lemma) >= 6 and any(t.startswith(stem) for t in L.tokens(d)):
            r.warn(w, f"definitionEn may contain a family member of the word (starts with {stem!r})")
    tr = e.get("translationsRu")
    if not isinstance(tr, list) or not (1 <= len(tr) <= 5) or not all(is_ru(t) for t in tr):
        r.err(w, "translationsRu must be a list of 1-4 Russian strings")
    else:
        if len(set(t.strip().lower() for t in tr)) != len(tr):
            r.err(w, "translationsRu has duplicates")
        for t in tr:
            if len(t) > 45:
                r.warn(w, f"translation is long: {t!r}")
    if e.get("register") not in L.REGISTERS:
        r.err(w, f"register must be one of {L.REGISTERS}")
    if e.get("topic") not in L.TOPICS:
        r.err(w, f"topic must be one of {L.TOPICS}")
    if not isinstance(e.get("ambiguous"), bool):
        r.err(w, "ambiguous must be true/false")
    s = e.get("situation", "")
    if check_english(r, w, s, 6, 28, "situation") and has_form(s):
        r.err(w, "situation contains the word itself")

    # examples -----------------------------------------------------------------
    ex = e.get("examples")
    texts = []
    if not isinstance(ex, list) or len(ex) != 3:
        r.err(w, "examples must be a list of exactly 3 items")
        ex = ex if isinstance(ex, list) else []
    triples = []
    for i, x in enumerate(ex):
        wi = f"{w} examples[{i}]"
        t = x.get("text", "") if isinstance(x, dict) else ""
        if not check_english(r, wi, t, 6, 26):
            continue
        texts.append(L.unmark(t).lower())
        m = one_mark(r, wi, t)
        if not m:
            continue
        if m.lower() not in F:
            r.err(wi, f"marked word {m!r} is not a form of {lemma!r}")
        if has_form(L.strip_marked(t)):
            r.err(wi, "the word appears again outside the mark")
        tags = L.tags_of(m, lemma, pos, [a for a in acc if a != lemma])
        ds = x.get("distractors")
        if not isinstance(ds, list) or len(ds) != 3 or not all(isinstance(q, str) and q.strip() for q in ds):
            r.err(wi, "distractors must be 3 non-empty strings")
            continue
        low = [q.strip().lower() for q in ds]
        alts = [a.strip().lower() for a in x.get("alternatives", []) if isinstance(a, str)]
        if len(set(low)) != 3:
            r.err(wi, "distractors must be distinct")
        for q in low:
            if q == m.lower() or q in F:
                r.err(wi, f"distractor {q!r} is a form of the target")
            if q in alts:
                r.err(wi, f"distractor {q!r} is also listed as acceptable alternative")
            if L.CYR.search(q):
                r.err(wi, "distractor must be English")
            if not L.same_form(q, tags, pos):
                r.warn(wi, f"distractor {q!r} may not match the target form {m!r} ({','.join(sorted(tags))})")
            if " " not in q and L.zipf(q) < 1.5:
                r.warn(wi, f"distractor {q!r} looks rare or non-existent")
        triples.append(tuple(sorted(low)))
    if len(triples) != len(set(triples)):
        r.warn(w, "examples reuse the same distractor set")
    if len(set(texts)) != len(texts):
        r.err(w, "duplicate example sentences")

    # trio -----------------------------------------------------------------------
    trio = e.get("trio")
    if not isinstance(trio, dict) or not isinstance(trio.get("texts"), list) or len(trio["texts"]) != 3:
        r.err(w, "trio.texts must hold 3 sentences")
    else:
        ms = []
        for i, t in enumerate(trio["texts"]):
            wi = f"{w} trio[{i}]"
            if not check_english(r, wi, t, 5, 20):
                continue
            m = one_mark(r, wi, t)
            if m:
                ms.append(m.lower())
                if m.lower() not in F:
                    r.err(wi, f"marked word {m!r} is not a form of {lemma!r}")
                if has_form(L.strip_marked(t)):
                    r.err(wi, "the word appears again outside the mark")
            if L.unmark(t).lower() in texts:
                r.err(wi, "trio sentence duplicates an example")
        if len(set(ms)) > 1:
            r.err(w, f"trio must use the identical form in all three sentences, got {sorted(set(ms))}")

    # collocations ------------------------------------------------------------
    col = e.get("collocations")
    if not isinstance(col, list) or not (3 <= len(col) <= 6):
        r.err(w, "collocations must hold 3-6 items")
    else:
        for c in col:
            m = one_mark(r, w, c, "collocation")
            if m and m.lower() not in F:
                r.err(w, f"collocation mark {m!r} is not a form of {lemma!r}")
            if L.CYR.search(c):
                r.err(w, "collocation must be English")
        if len(set(c.lower() for c in col)) != len(col):
            r.err(w, "duplicate collocations")
    bc = e.get("badCollocation")
    if not isinstance(bc, dict):
        r.err(w, "badCollocation missing")
    else:
        m = one_mark(r, w, bc.get("text", ""), "badCollocation.text")
        if m and m.lower() not in F:
            r.err(w, "badCollocation mark is not a form of the word")
        if isinstance(col, list) and L.unmark(bc.get("text", "")).lower() in [L.unmark(c).lower() for c in col]:
            r.err(w, "badCollocation is also listed as a good collocation")
        check_ru(r, w, bc.get("noteRu"), 220, "badCollocation.noteRu")
    ct = e.get("collocationTask")
    if not isinstance(ct, dict):
        r.err(w, "collocationTask missing")
    else:
        p = ct.get("prompt", "")
        if len(L.GAP.findall(p)) != 1:
            r.err(w, "collocationTask.prompt needs exactly one ___ gap")
        a = str(ct.get("answer", "")).strip()
        ds = [str(x).strip().lower() for x in ct.get("distractors", [])]
        if not a or len(ds) != 3 or len(set(ds)) != 3 or a.lower() in ds:
            r.err(w, "collocationTask needs an answer and 3 distinct different distractors")
        full = L.GAP.sub(a, p)
        if not has_form(full):
            r.err(w, "collocationTask phrase must contain the target word")
        if L.CYR.search(p + a + " ".join(ds)):
            r.err(w, "collocationTask prompt/options must be English")
        check_ru(r, w, ct.get("explanationRu"), 240)

    # nuance ---------------------------------------------------------------------
    nu = e.get("nuance")
    if not isinstance(nu, dict):
        r.err(w, "nuance missing")
    else:
        rv = str(nu.get("rival", "")).strip().lower()
        if not rv or rv in F:
            r.err(w, "nuance.rival must be a different word")
        t = nu.get("text", "")
        if check_english(r, w + " nuance", t, 5, 26):
            m = one_mark(r, w + " nuance", t)
            if m and m.lower() not in F:
                r.err(w, "nuance mark must be a form of the target")
            if has_form(L.strip_marked(t)):
                r.err(w, "nuance: the word appears again outside the mark")
        rf = str(nu.get("rivalForm", "")).strip().lower()
        if not rf or rf in F:
            r.err(w, "nuance.rivalForm must be the rival in the same form")
        check_ru(r, w + " nuance", nu.get("explanationRu"), 280)
        rev = nu.get("reverse")
        if rev is not None:
            if not isinstance(rev, dict):
                r.err(w, "nuance.reverse must be an object")
            else:
                t2 = rev.get("text", "")
                if check_english(r, w + " nuance.reverse", t2, 5, 26):
                    m2 = one_mark(r, w + " nuance.reverse", t2)
                    if m2 and m2.lower() in F:
                        r.err(w, "nuance.reverse mark must be the rival, not the target")
                    if has_form(L.strip_marked(t2)):
                        r.err(w, "nuance.reverse: the target appears in the sentence")
                tf = str(rev.get("targetForm", "")).strip().lower()
                if tf not in F:
                    r.err(w, "nuance.reverse.targetForm must be a form of the target")
                check_ru(r, w + " nuance.reverse", rev.get("explanationRu"), 280)

    # fixIt ----------------------------------------------------------------------
    fx = e.get("fixIt")
    if not isinstance(fx, dict):
        r.err(w, "fixIt missing")
    else:
        t = fx.get("text", "")
        if check_english(r, w + " fixIt", t, 5, 26):
            m = one_mark(r, w + " fixIt", t)
            if m and m.lower() in F:
                r.err(w, "fixIt: the marked (wrong) word must not be the target")
            if has_form(L.strip_marked(t)):
                r.err(w, "fixIt: the target appears elsewhere in the sentence")
        ans = fx.get("answer")
        if not isinstance(ans, list) or not ans:
            r.err(w, "fixIt.answer must be a non-empty list")
        else:
            for a in ans:
                if not (set(L.tokens(a)) & F):
                    r.err(w, f"fixIt answer {a!r} must be a form of the target")
        check_ru(r, w + " fixIt", fx.get("explanationRu"), 240)

    # wordFormation (optional) -----------------------------------------------------
    wf = e.get("wordFormation")
    if wf:
        base = str(wf.get("base", "")).strip().lower()
        ans = [str(a).strip().lower() for a in wf.get("answer", [])]
        t = wf.get("text", "")
        if check_english(r, w + " wordFormation", t, 5, 26):
            m = one_mark(r, w + " wordFormation", t)
            if m and ans and m.lower() != ans[0]:
                r.err(w, "wordFormation: marked word must equal answer[0]")
            if base and base in L.tokens(L.strip_marked(t)):
                r.warn(w, "wordFormation: base word appears in the sentence")
        if not base or not ans:
            r.err(w, "wordFormation needs base and answer")
        elif base == ans[0]:
            r.err(w, "wordFormation: answer must differ from base")
        else:
            ans_lemmas = set()
            for p2 in ("noun", "verb", "adjective", "adverb"):
                ans_lemmas |= L.lemmas_of(ans[0], p2)
            if lemma != base and lemma not in ans_lemmas and ans[0] not in F:
                r.err(w, "wordFormation: base or answer must be the target word")
            if not L.derivation_source(base, ans[0]):
                r.err(w, f"wordFormation: {base!r} -> {ans[0]!r} is not a verified derivation in CatVar 2.1 or WordNet 3.0 (drop or change it)")

    # reply (optional) -------------------------------------------------------------
    rp = e.get("reply")
    if rp:
        if not is_en(rp.get("context", "")):
            r.err(w, "reply.context must be English")
        opts = rp.get("options")
        if not isinstance(opts, list) or len(opts) != 3 or len({str(o).strip().lower() for o in opts}) != 3:
            r.err(w, "reply.options must be 3 distinct replies")
        else:
            for o in opts:
                check_english(r, w + " reply", o, None, 30, "reply option")
            a = rp.get("answer")
            if a not in (0, 1, 2):
                r.err(w, "reply.answer must be 0, 1 or 2")
            elif not has_form(opts[a]):
                r.err(w, "reply: the correct option must use the target word")
        check_ru(r, w + " reply", rp.get("explanationRu"), 260)

    # rewrite (optional) -------------------------------------------------------------
    rw = e.get("rewrite")
    if rw:
        o = rw.get("original", "")
        if check_english(r, w + " rewrite", o, 4, 26, "rewrite.original") and has_form(o):
            r.err(w, "rewrite.original must not contain the target word")
        fr = rw.get("frame", "")
        if len(L.GAP.findall(fr)) != 1:
            r.err(w, "rewrite.frame needs exactly one ____ gap")
        acc2 = rw.get("accepted")
        if not isinstance(acc2, list) or not acc2:
            r.err(w, "rewrite.accepted must be a non-empty list")
        else:
            for a in acc2:
                if not (set(L.tokens(a)) & F):
                    r.err(w, f"rewrite accepted answer {a!r} must contain the target word")
                if len(L.tokens(a)) > 6:
                    r.warn(w, f"rewrite answer {a!r} is long")
            if len({a.strip().lower() for a in acc2}) != len(acc2):
                r.err(w, "rewrite.accepted has duplicates")
        if rw.get("explanationRu"):
            check_ru(r, w + " rewrite", rw.get("explanationRu"), 200)


def all_texts(e):
    out = []
    for x in e.get("examples", []) or []:
        if isinstance(x, dict):
            out.append(x.get("text", ""))
    out += (e.get("trio") or {}).get("texts", []) or []
    for k in ("nuance", "fixIt", "wordFormation"):
        if isinstance(e.get(k), dict):
            out.append(e[k].get("text", ""))
    if isinstance((e.get("nuance") or {}).get("reverse"), dict):
        out.append(e["nuance"]["reverse"].get("text", ""))
    return [L.unmark(t).strip().lower() for t in out if t]


def validate_dir(path, assignment=None, global_texts=None):
    r = Report()
    entries, skipped, bad = load_dir(path)
    for f, msg in bad:
        r.err(os.path.basename(f), "invalid file: " + msg)
    seen = {}
    lf = {}
    for f, e in entries:
        key = (str(e.get("lemma", "")).lower(), e.get("pos"))
        if key in seen:
            r.err(f"{key[0]}/{key[1]}", "duplicate entry")
        seen[key] = e
        validate_entry(r, e, lf)
    for s in skipped:
        if not s.get("reason"):
            r.err(str(s.get("skipped")), "skipped word needs a reason")
    if assignment:
        want = {(a["lemma"], a["pos"]) for a in json.load(open(assignment, encoding="utf-8"))["words"]}
        got = set(seen) | {(s.get("skipped"), s.get("pos")) for s in skipped}
        for k in sorted(want - got):
            r.err(f"{k[0]}/{k[1]}", "assigned word has no entry and is not skipped")
        for k in sorted(set(seen) - want):
            r.err(f"{k[0]}/{k[1]}", "entry is not in the assignment")
    # sentence duplicates inside the batch and against other batches
    mine = {}
    for f, e in entries:
        for t in all_texts(e):
            if t in mine:
                r.err(e.get("lemma", "?"), f"sentence used twice in this batch: {t!r}")
            mine[t] = e.get("lemma")
            if global_texts and t in global_texts and global_texts[t][0] != path:
                r.err(e.get("lemma", "?"), f"sentence already used in {global_texts[t][0]}: {t!r}")
    return r, len(entries), len(skipped)


def collect_global(root):
    texts = {}
    for d in sorted(glob.glob(os.path.join(root, "b*"))):
        entries, _, _ = load_dir(d)
        for f, e in entries:
            for t in all_texts(e):
                texts.setdefault(t, (d, e.get("lemma")))
    return texts


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("path", nargs="?")
    ap.add_argument("--assignment")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--quiet", action="store_true", help="only print the summary")
    args = ap.parse_args()
    root = os.path.join(L.ROOT, "content", "words")
    dirs = sorted(glob.glob(os.path.join(root, "b*"))) if args.all else [args.path]
    gtexts = collect_global(root)
    total_e = total_w = 0
    for d in dirs:
        d = d.rstrip("/")
        name = os.path.basename(d)
        asg = args.assignment or (os.path.join(L.ROOT, "content", "assignments", name + ".json") if args.all else None)
        if asg and not os.path.exists(asg):
            asg = None
        # global texts are keyed by directory path relative to root
        rel_g = {t: (os.path.abspath(v[0]), v[1]) for t, v in gtexts.items()}
        r, n, s = validate_dir(os.path.abspath(d), asg, rel_g)
        if not args.quiet:
            for kind, where, msg in r.items:
                print(f"{kind}: {where}: {msg}")
        print(f"== {name}: {n} entries, {s} skipped, {len(r.errors)} errors, {len(r.warnings)} warnings")
        total_e += len(r.errors)
        total_w += len(r.warnings)
    sys.exit(1 if total_e else 0)


if __name__ == "__main__":
    main()
