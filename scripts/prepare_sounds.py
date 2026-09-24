#!/usr/bin/env python3
"""Fetch and prepare the UI sound effects (Kenney "Interface Sounds", CC0).

kenney.nl and opengameart.org are not reachable from the build environment, so the
files come from Calinou/kenney-interface-sounds (a CC0 redistribution of the same
pack, losslessly converted from Kenney's OGG files to WAV, with Kenney's License.txt).
Fidelity check: two original OGG files of the pack, found in an unrelated repository
(frederickjjoubert/bevy-ball-game), are decoded and compared with the WAV copies.

Processing per file: mono downmix, leading-silence trim, peak normalisation to -3 dBFS,
6 ms fade-out, 16-bit PCM WAV at the original 44.1 kHz. Loudness is lowered further at
playback time by the app's volume setting.
"""
import datetime as dt
import hashlib
import io
import json
import os
import urllib.request

import numpy as np
import soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "sources", "raw", "sounds")
OUT = os.path.join(ROOT, "assets", "sounds")

MIRROR = "https://raw.githubusercontent.com/Calinou/kenney-interface-sounds/4596a49eaf5a533948d49a47467f606bcdea70ff/"
ORIG_OGG = "https://raw.githubusercontent.com/frederickjjoubert/bevy-ball-game/04aa6181f419db4cfd4f84b8d82200c9a2cb918a/assets/audio/"

SELECTION = {
    # app name   : original file in the pack (Audio/<name>.ogg)
    "tap": "select_002",
    "correct": "confirmation_001",
    "incorrect": "question_004",
    "complete": "confirmation_004",
    "achievement": "confirmation_002",
    "levelup": "confirmation_003",
}


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "crux-build"}), timeout=60) as r:
        return r.read()


def sha(b):
    return hashlib.sha256(b).hexdigest()


def fidelity_check():
    out = {}
    for n in ("pluck_001", "pluck_002"):
        ogg = get(ORIG_OGG + n + ".ogg")
        wav = get(MIRROR + "addons/kenney_interface_sounds/" + n + ".wav")
        a, _ = sf.read(io.BytesIO(ogg), dtype="float64")
        b, _ = sf.read(io.BytesIO(wav), dtype="float64")
        m = min(len(a), len(b))
        corr = float(np.corrcoef(a[:m].ravel(), b[:m].ravel())[0, 1])
        out[n] = {"original_ogg_sha256": sha(ogg), "mirror_wav_sha256": sha(wav), "correlation": round(corr, 6)}
    return out


def process(data):
    x, sr = sf.read(io.BytesIO(data), dtype="float64")
    if x.ndim > 1:
        x = x.mean(axis=1)
    thr = 10 ** (-50 / 20)
    idx = np.flatnonzero(np.abs(x) > thr)
    if len(idx):
        x = x[max(0, idx[0] - int(0.001 * sr)): idx[-1] + 1]
    peak = np.abs(x).max() or 1.0
    x = x / peak * (10 ** (-3 / 20))
    fade = int(0.006 * sr)
    if len(x) > fade:
        x[-fade:] *= np.linspace(1, 0, fade)
    buf = io.BytesIO()
    sf.write(buf, x, sr, subtype="PCM_16", format="WAV")
    return buf.getvalue(), sr, len(x) / sr


def main():
    os.makedirs(RAW, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    lic = get(MIRROR + "addons/kenney_interface_sounds/LICENSE.txt")
    open(os.path.join(RAW, "Kenney_License.txt"), "wb").write(lic)
    open(os.path.join(OUT, "Kenney_License.txt"), "wb").write(lic)
    meta = {"pack": "Interface Sounds 1.0 by Kenney (www.kenney.nl)", "license": "CC0 1.0 Universal",
            "official_pages": ["https://kenney.nl/assets/interface-sounds",
                               "https://opengameart.org/content/interface-sounds"],
            "official_archives": ["https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip",
                                  "https://opengameart.org/sites/default/files/kenney_interfaceSounds.zip"],
            "downloaded_from": MIRROR, "retrieved_at": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
            "license_file_sha256": sha(lic), "fidelity_check": fidelity_check(), "files": {}}
    for app_name, orig in SELECTION.items():
        src = get(MIRROR + "addons/kenney_interface_sounds/" + orig + ".wav")
        open(os.path.join(RAW, orig + ".wav"), "wb").write(src)
        wav, sr, dur = process(src)
        path = os.path.join(OUT, app_name + ".wav")
        open(path, "wb").write(wav)
        meta["files"][app_name] = {"original_name": f"Audio/{orig}.ogg", "mirror_file": f"addons/kenney_interface_sounds/{orig}.wav",
                                   "source_sha256": sha(src), "output": f"assets/sounds/{app_name}.wav",
                                   "output_sha256": sha(wav), "sample_rate": sr, "duration_ms": round(dur * 1000),
                                   "bytes": len(wav)}
        print(f"{app_name:12s} <- {orig:18s} {dur*1000:5.0f} ms {len(wav):6d} B")
    json.dump(meta, open(os.path.join(OUT, "SOURCES.json"), "w"), indent=2)
    print("fidelity:", meta["fidelity_check"])


if __name__ == "__main__":
    main()
