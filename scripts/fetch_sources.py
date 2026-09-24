#!/usr/bin/env python3
"""Download every third-party source used to build the Crux lexicon.

Reproducible: each file is pinned to a URL (official first, then a pinned
GitHub mirror when the official host is unreachable) and checked against a
SHA-256 digest where an independent digest exists.  Results are written to
data/sources/MANIFEST.json.

Usage:  python3 scripts/fetch_sources.py
"""
import csv
import datetime as dt
import hashlib
import io
import json
import os
import sys
import urllib.request
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "sources", "raw")
MANIFEST = os.path.join(ROOT, "data", "sources", "MANIFEST.json")

# --- Source definitions -----------------------------------------------------

EFLLEX = {
    "id": "efllex",
    "name": "EFLLex (NLP4J POS) - CEFRLex project, CENTAL UCLouvain",
    "license": "CC BY-NC-SA 4.0",
    "citation": "Dürlich, L. and François, T. (2018). EFLLex: A Graded Lexical Resource for "
                "Learners of English as a Foreign Language. LREC 2018, Miyazaki, Japan.",
    "landing": "https://cental.uclouvain.be/cefrlex/efllex/download/",
    "urls": [
        "https://cental.uclouvain.be/cefrlex/static/resources/en/EFLLex.tsv",
        # Byte-identical copy (same SHA-256 as recorded from the official URL).
        "https://raw.githubusercontent.com/mo1ein/BeforePlay/edcdd9df3c0356f139fb9ed4110167fcde8fc461/EFLLex.tsv",
    ],
    # Digest recorded independently by GliteTech/research-ace-cefr when it
    # downloaded the official URL on 2026-04-17 (files/checksums.json).
    "sha256": "d046ce406ce1dbe23292b2d7e0a18e36c6d2f490b7e09edf3173ca8b5f019645",
    "sha256_origin": "https://raw.githubusercontent.com/GliteTech/research-ace-cefr/9bfb46a582dfd8df62e4db0c7e5382594a735d64/"
                     "tasks/t0010_download_efllex_lexicon/assets/dataset/efllex-2018/files/checksums.json",
    "dest": "efllex/EFLLex.tsv",
}

OXFORD_MIRRORS = [
    {
        "id": "oxford5000_nalgeon",
        "url": "https://raw.githubusercontent.com/nalgeon/words/8321a7a12cc56dffc4ef5bc3b69fdc31256a74f7/data/oxford-5k.csv",
        "dest": "oxford/nalgeon_oxford-5k.csv",
        "cols": ("word", "pos", "level"),
    },
    {
        "id": "oxford5000_tyypgzl",
        "url": "https://raw.githubusercontent.com/tyypgzl/Oxford-5000-words/aac2d2a195f4659c7ec3899252c8b9092ceb41a0/full-word.json",
        "dest": "oxford/tyypgzl_full-word.json",
        "cols": ("word", "type", "level"),
    },
    {
        "id": "oxford5000_winterdl",
        "url": "https://raw.githubusercontent.com/winterdl/oxford-5000-vocabulary-audio-definition/37a976d918b36db66510cfa0b1244de2de7bcf1c/data/oxford_5000.csv",
        "dest": "oxford/winterdl_oxford_5000.csv",
        "cols": ("word", "type", "cefr"),
    },
]

OLP = {
    "id": "olp_en_cefrj",
    "commit": "d4e45b75b38f27b30dfc5c44d8c571aec7e7092f",
    "base": "https://raw.githubusercontent.com/openlanguageprofiles/olp-en-cefrj/",
    "files": {
        "octanove-vocabulary-profile-c1c2-1.0.csv": "CC BY-SA 4.0 (Octanove Labs)",
        "cefrj-vocabulary-profile-1.5.csv": "CEFR-J terms: free for research and commercial use with citation (Tono Laboratory, TUFS)",
        "README.md": "repository README (terms of use)",
    },
}

CATVAR = {
    "id": "catvar21",
    "base": "https://raw.githubusercontent.com/nizarhabash1/catvar/849925e11458ee59c77175759a21d023698d2255/",
    "files": ["catvar21.signed", "LICENSE.txt", "README.md"],
    "license": "Open Software License 1.1 (University of Maryland); cite Habash & Dorr, NAACL 2003",
}

WORDNET = {
    "id": "wordnet30",
    "url": "https://raw.githubusercontent.com/nltk/nltk_data/550b6625bcef1f2abff2ff770a5a0d272c9c6b2a/packages/corpora/wordnet.zip",
    "dest": "wordnet/wordnet.zip",
    "license": "WordNet 3.0 license (Princeton University), permissive",
}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def get(url: str, timeout: int = 120) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "crux-data-fetch/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def save(rel: str, data: bytes) -> str:
    path = os.path.join(RAW, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)
    return path


def now() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


def fetch_first(urls, expected=None):
    errors = []
    for u in urls:
        try:
            data = get(u)
        except Exception as e:  # network policy, 404, ...
            errors.append(f"{u}: {e}")
            continue
        if expected and sha256(data) != expected:
            errors.append(f"{u}: sha256 mismatch {sha256(data)}")
            continue
        return u, data, errors
    raise RuntimeError("all URLs failed:\n  " + "\n  ".join(errors))


def main():
    manifest = {"generated_at": now(), "sources": []}

    # EFLLex -------------------------------------------------------------------
    used, data, errors = fetch_first(EFLLEX["urls"], EFLLEX["sha256"])
    save(EFLLEX["dest"], data)
    manifest["sources"].append({
        "id": EFLLEX["id"], "name": EFLLEX["name"], "license": EFLLEX["license"],
        "citation": EFLLEX["citation"], "landing_page": EFLLEX["landing"],
        "official_url": EFLLEX["urls"][0], "downloaded_from": used,
        "retrieved_at": now(), "bytes": len(data), "sha256": sha256(data),
        "sha256_matches_independent_record": True, "sha256_record": EFLLEX["sha256_origin"],
        "unreachable_urls": errors, "path": "data/sources/raw/" + EFLLEX["dest"],
    })
    print("EFLLex ok via", used)

    # Oxford 5000 labels (three independent scrapes, cross-checked) ------------
    tables = {}
    for m in OXFORD_MIRRORS:
        data = get(m["url"])
        save(m["dest"], data)
        rows = set()
        if m["dest"].endswith(".json"):
            for item in json.loads(data.decode("utf-8")):
                v = item["value"]
                if v.get("level", "").strip():
                    rows.add((v["word"].strip().lower(), v["type"].strip(), v["level"].strip().lower()))
        else:
            w, p, l = m["cols"]
            for r in csv.DictReader(io.StringIO(data.decode("utf-8"))):
                if (r.get(l) or "").strip():
                    rows.add((r[w].strip().lower(), r[p].strip(), r[l].strip().lower()))
        tables[m["id"]] = rows
        manifest["sources"].append({
            "id": m["id"], "name": "Oxford 3000/5000 word list with CEFR labels (scraped copy)",
            "license": "Word list (c) Oxford University Press. Used only to check word+POS CEFR labels; "
                       "definitions, examples and audio in some mirrors are NOT used.",
            "official_url": "https://www.oxfordlearnersdictionaries.com/wordlists/oxford3000-5000",
            "downloaded_from": m["url"], "retrieved_at": now(), "bytes": len(data),
            "sha256": sha256(data), "path": "data/sources/raw/" + m["dest"],
        })
    ids = list(tables)
    agree = all(tables[ids[0]] == tables[i] for i in ids[1:])
    c1 = {(w, p) for (w, p, l) in tables[ids[0]] if l == "c1"}
    check = {"mirrors": ids, "identical_word_pos_level_sets": agree,
             "c1_entries": len(c1), "c1_unique_lemmas": len({w for w, _ in c1})}
    # Spot check against the official PDF excerpt stored in the repo.
    excerpt = os.path.join(ROOT, "data", "sources", "oxford5000_pdf_excerpt.txt")
    if os.path.exists(excerpt):
        check["official_pdf_excerpt"] = spot_check(excerpt, tables[ids[0]])
    manifest["oxford_crosscheck"] = check
    print("Oxford mirrors agree:", agree, check.get("official_pdf_excerpt"))

    # Open Language Profiles (CEFR-J + Octanove) ------------------------------
    for fname, lic in OLP["files"].items():
        url = OLP["base"] + OLP["commit"] + "/" + fname
        data = get(url)
        save("olp/" + fname, data)
        manifest["sources"].append({
            "id": "olp:" + fname, "license": lic, "downloaded_from": url,
            "official_url": "https://github.com/openlanguageprofiles/olp-en-cefrj",
            "retrieved_at": now(), "bytes": len(data), "sha256": sha256(data),
            "path": "data/sources/raw/olp/" + fname,
        })
    print("OLP ok")

    # WordNet 3.0 (derivational links for Word Formation) ----------------------
    data = get(WORDNET["url"])
    save(WORDNET["dest"], data)
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        z.extractall(os.path.join(RAW, "nltk_data", "corpora"))
    manifest["sources"].append({
        "id": WORDNET["id"], "license": WORDNET["license"], "downloaded_from": WORDNET["url"],
        "retrieved_at": now(), "bytes": len(data), "sha256": sha256(data),
        "path": "data/sources/raw/" + WORDNET["dest"],
    })
    print("WordNet ok")

    # CatVar 2.1 (derivational word families for Word Formation) -------------
    for fname in CATVAR["files"]:
        data = get(CATVAR["base"] + fname)
        save("catvar/" + fname, data)
        manifest["sources"].append({
            "id": CATVAR["id"] + ":" + fname, "license": CATVAR["license"],
            "downloaded_from": CATVAR["base"] + fname, "official_url": "https://github.com/nizarhabash1/catvar",
            "retrieved_at": now(), "bytes": len(data), "sha256": sha256(data), "path": "data/sources/raw/catvar/" + fname,
        })
    print("CatVar ok")

    with open(MANIFEST, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print("wrote", os.path.relpath(MANIFEST, ROOT))


def spot_check(path, rows):
    """Compare 'word pos.' tokens from the official PDF excerpt with a mirror."""
    import re
    pos_map = {"n": "noun", "v": "verb", "adj": "adjective", "adv": "adverb",
               "prep": "preposition", "conj": "conjunction"}
    labels = {}
    for w, p, l in rows:
        labels.setdefault((w, p), set()).add(l)
    ok, bad = 0, []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            lvl, text = line.split("|", 1)
            for m in re.finditer(r"([a-z][a-z\-']*)\s+((?:(?:n|v|adj|adv|prep|conj)\.(?:,\s*)?)+)", text):
                for p in re.findall(r"(n|v|adj|adv|prep|conj)\.", m.group(2)):
                    if lvl.lower() in labels.get((m.group(1), pos_map[p]), set()):
                        ok += 1
                    else:
                        bad.append([lvl, m.group(1), p])
    return {"checked": ok + len(bad), "matched": ok, "mismatched": bad}


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("ERROR:", e, file=sys.stderr)
        sys.exit(1)
