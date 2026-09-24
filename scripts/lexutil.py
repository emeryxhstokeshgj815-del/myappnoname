"""Shared helpers for content validation and dataset building."""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_WN_DIR = os.path.join(ROOT, "data", "sources", "raw", "nltk_data")

UPOS = {"noun": "NOUN", "verb": "VERB", "adjective": "ADJ", "adverb": "ADV",
        "preposition": "ADP", "conjunction": "CCONJ"}
TOPICS = ["thinking", "people", "work", "society", "science", "education", "culture", "world"]
REGISTERS = ["neutral", "formal", "informal", "literary", "technical"]
CYR = re.compile(r"[А-Яа-яЁё]")
MARK = re.compile(r"\[\[([^\[\]]+)\]\]")
TOKEN = re.compile(r"[A-Za-z][A-Za-z'\-]*")
GAP = re.compile(r"_{3,}")


def tokens(text):
    return [t.lower().strip("'-") for t in TOKEN.findall(text or "")]


def marks(text):
    return MARK.findall(text or "")


def unmark(text):
    return MARK.sub(lambda m: m.group(1), text or "")


def strip_marked(text):
    return MARK.sub(" ", text or "")


_inflect_cache = {}


def inflections(lemma, pos):
    """{penn_tag: set(forms)} for a lemma (lower case)."""
    key = (lemma, pos)
    if key in _inflect_cache:
        return _inflect_cache[key]
    from lemminflect import getAllInflections, getAllInflectionsOOV, getInflection
    upos = UPOS.get(pos)
    res = {}
    if upos in ("NOUN", "VERB", "ADJ", "ADV") and re.fullmatch(r"[a-z]+", lemma):
        inf = getAllInflections(lemma, upos=upos) or getAllInflectionsOOV(lemma, upos=upos)
        for tag, forms in inf.items():
            res.setdefault(tag, set()).update(f.lower() for f in forms)
        tagset = {"VERB": ["VBD", "VBN", "VBG", "VBZ"], "NOUN": ["NNS"]}.get(upos, [])
        for tag in tagset:
            if tag not in res:
                got = getInflection(lemma, tag=tag, inflect_oov=True)
                if got:
                    res.setdefault(tag, set()).update(f.lower() for f in got)
    for tag in list(res):
        keep = {f for f in res[tag] if " " not in f and ("-" not in f or "-" in lemma)}
        if tag == "NNS" and lemma in keep and len(keep) > 1:
            keep.discard(lemma)
        res[tag] = keep
    base_tag = {"NOUN": "NN", "VERB": "VB", "ADJ": "JJ", "ADV": "RB"}.get(upos, "X")
    res.setdefault(base_tag, set()).add(lemma)
    if upos == "VERB":
        res.setdefault("VBP", set()).add(lemma)
    if upos == "NOUN" and "-" in lemma and not lemma.endswith("s"):
        res.setdefault("NNS", set()).add(lemma + "s")
    _inflect_cache[key] = res
    return res


def forms(lemma, pos, extra=()):
    out = set()
    for w in [lemma, *extra]:
        for fs in inflections(w.lower(), pos).values():
            out |= fs
    return out


def tags_of(form, lemma, pos, extra=()):
    form = form.lower()
    tags = set()
    for w in [lemma, *extra]:
        for tag, fs in inflections(w.lower(), pos).items():
            if form in fs:
                tags.add(tag)
    if "VBP" in tags:
        tags.add("VB")
    if "VB" in tags:
        tags.add("VBP")
    return tags


def lemmas_of(word, pos):
    from lemminflect import getAllLemmas, getAllLemmasOOV
    upos = UPOS.get(pos)
    if upos not in ("NOUN", "VERB", "ADJ", "ADV"):
        return {word.lower()}
    word = word.lower()
    found = getAllLemmas(word, upos=upos)
    if not found:
        found = getAllLemmasOOV(word, upos=upos)
    out = set()
    for ls in found.values():
        out |= {l.lower() for l in ls}
    return out or {word}


def same_form(distractor, target_tags, pos):
    """True if the distractor can carry one of the target's grammatical tags."""
    if not target_tags or UPOS.get(pos) not in ("NOUN", "VERB", "ADJ", "ADV"):
        return True
    d = distractor.lower()
    if " " in d:
        return True
    for l in lemmas_of(d, pos):
        infl = inflections(l, pos)
        for t in target_tags:
            if d in infl.get(t, set()):
                return True
    return False


_wf = None


def zipf(word):
    global _wf
    try:
        if _wf is None:
            from wordfreq import zipf_frequency
            _wf = zipf_frequency
        return _wf(word, "en")
    except Exception:
        return 0.0


_wn = None


def wordnet():
    global _wn
    if _wn is None:
        import nltk
        for p in (_WN_DIR, os.path.expanduser("~/nltk_data")):
            if p not in nltk.data.path:
                nltk.data.path.append(p)
        from nltk.corpus import wordnet as wn
        wn.ensure_loaded()
        _wn = wn
    return _wn


def derivational_links(word):
    """Words linked to `word` in WordNet by derivation or pertainymy (both directions)."""
    wn = wordnet()
    out = set()
    for syn in wn.synsets(word.replace(" ", "_")):
        for lem in syn.lemmas():
            if lem.name().lower() != word.lower():
                continue
            for rel in lem.derivationally_related_forms() + lem.pertainyms():
                name = rel.name().lower().replace("_", " ")
                out.add(name)
                # spelling/morphological twins in the same synset (ironic/ironical)
                for mate in rel.synset().lemmas():
                    m = mate.name().lower().replace("_", " ")
                    if m[:4] == name[:4]:
                        out.add(m)
    return out


_catvar = None


def catvar_clusters():
    """word -> set of cluster ids (CatVar 2.1, University of Maryland, OSL 1.1)."""
    global _catvar
    if _catvar is None:
        _catvar = {}
        path = os.path.join(ROOT, "data", "sources", "raw", "catvar", "catvar21.signed")
        if os.path.exists(path):
            with open(path, encoding="latin-1") as f:
                for i, line in enumerate(f):
                    for item in line.strip().split("#"):
                        w = item.split("_")[0].lower()
                        if w:
                            _catvar.setdefault(w, set()).add(i)
    return _catvar


def derivation_source(base, derived):
    """'catvar-2.1' / 'wordnet-3.0' if base and derived are recorded as one word family, else None."""
    base, derived = base.lower(), derived.lower()
    cands = {derived}
    for pos in ("noun", "verb", "adjective", "adverb"):
        cands |= lemmas_of(derived, pos)
    bases = {base}
    for pos in ("noun", "verb", "adjective", "adverb"):
        bases |= lemmas_of(base, pos)
    cv = catvar_clusters()
    bc = set().union(*[cv.get(b, set()) for b in bases])
    if bc and any(cv.get(c, set()) & bc for c in cands):
        return "catvar-2.1"
    if derivation_verified(base, derived):
        return "wordnet-3.0"
    # two WordNet hops through a shared relative (aggression <- aggress -> aggressive)
    for b in bases:
        for mid in derivational_links(b):
            if cands & derivational_links(mid):
                return "wordnet-3.0"
    return None


def derivation_verified(base, derived):
    base, derived = base.lower(), derived.lower()
    cands = {derived}
    for pos in ("noun", "verb", "adjective", "adverb"):
        cands |= lemmas_of(derived, pos)
    bases = {base}
    for pos in ("noun", "verb", "adjective", "adverb"):
        bases |= lemmas_of(base, pos)
    for b in bases:
        links = derivational_links(b)
        if cands & links:
            return True
    for c in cands:
        if bases & derivational_links(c):
            return True
    return False


WN_POS = {"noun": "n", "verb": "v", "adjective": "a", "adverb": "r"}


def wn_synonyms(lemma, pos):
    """All WordNet synonyms (same synset) of a lemma for a part of speech."""
    wn = wordnet()
    p = WN_POS.get(pos)
    if not p:
        return set()
    out = set()
    for syn in wn.synsets(lemma.replace(" ", "_"), pos=p) + (wn.synsets(lemma, pos="s") if p == "a" else []):
        for l in syn.lemma_names():
            out.add(l.lower().replace("_", " "))
    out.discard(lemma.lower())
    return out
