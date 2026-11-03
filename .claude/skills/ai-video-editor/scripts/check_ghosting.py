#!/usr/bin/env python3
"""Detect caption GHOSTING in an encoded master — the bug snapshots do not show.

HyperFrames can leave the LAST clip of each CSS slot painted for the whole render once
a composition carries ~48 text clips. Every `hyperframes snapshot` comes back clean
while the encoded file carries 2-3 stale caption plates stacked on top of the live one
for the entire video.

But it is NOT deterministic above 48 clips — a 53-caption composition has rendered
perfectly clean — so paying the external-caption-layer cost blindly is waste. Run this
on a draft proof render and let it decide.

The check: sample N frames, mask near-white low-saturation pixels, keep rows where that
spans >240px, merge bands separated by <70px, then count only bands whose top row sits
within 4px of a caption slot.

  exactly one band per frame = clean, keep captions in the composition
  two or more                = ghosting, switch to scripts/caption_layer.py

A single plate splits into two bands at its own dark glyphs, so a naive count reports
2 plates on every healthy frame — the merge and the slot-top match are both load-bearing.
Article cards and CTA pills also read as bright bands, which is why the slot match matters.
"""
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hfcfg  # noqa: E402

beatmap, BEATS_PATH = hfcfg.load_beats()   # project copy wins over the skill's stub


def bands_at(path, t, w, h, env):
    import numpy as np
    p = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", path,
                        "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                       capture_output=True, env=env)
    need = w * h * 3
    if len(p.stdout) < need:
        return None
    fr = np.frombuffer(p.stdout[:need], np.uint8).reshape(h, w, 3).astype(np.int16)
    mn = fr.min(axis=2)
    rng = fr.max(axis=2) - mn
    mask = (mn > 190) & (rng < 30)                    # near-white, low saturation
    rows = np.where(mask.sum(axis=1) > 240)[0]        # a plate spans >240px
    if not len(rows):
        return []
    bands, start, prev = [], rows[0], rows[0]
    for r in rows[1:]:
        if r - prev > 70:                             # merge across dark glyph rows
            bands.append((start, prev))
            start = r
        prev = r
    bands.append((start, prev))
    return bands


def main():
    ap = hfcfg.arg_parser(__doc__)
    ap.add_argument("render")
    ap.add_argument("--n", type=int, default=15, help="frames to sample")
    ap.add_argument("--slots", type=int, nargs="*",
                    help="caption slot tops (default: from beats.SLOT)")
    a = ap.parse_args()
    cfg = hfcfg.load(a.config)
    hfcfg.require("ffmpeg", "ffprobe")
    hfcfg.require_python("numpy")
    env = hfcfg.ffmpeg_env()

    slots = a.slots or (sorted(beatmap.SLOT.values()) if beatmap else
                        [520, 780, 930, 1300, 1310])
    w = int(hfcfg.probe(a.render, "stream=width", "v:0"))
    h = int(hfcfg.probe(a.render, "stream=height", "v:0"))
    dur = float(hfcfg.probe(a.render, "format=duration") or 0)
    if not dur:
        sys.exit("could not read duration")

    print(f"  {os.path.basename(a.render)}  {w}x{h}  {dur:.2f}s")
    print(f"  slots: {slots}\n")
    worst, bad_frames = 0, []
    for i in range(a.n):
        t = dur * (i + 0.5) / a.n
        bands = bands_at(a.render, t, w, h, env)
        if bands is None:
            continue
        # only count bands whose TOP sits on a caption slot
        on_slot = [b for b in bands if any(abs(b[0] - s) <= 4 for s in slots)]
        n = len(on_slot)
        worst = max(worst, n)
        mark = "" if n <= 1 else "   ← GHOST"
        if n > 1:
            bad_frames.append(t)
        print(f"    t={t:6.2f}s  bands {len(bands):2d}  on-slot {n}"
              f"  tops {[b[0] for b in on_slot]}{mark}")

    print()
    if worst <= 1:
        print("  ✓ clean — captions may stay in the composition")
        return 0
    print(f"  ✗ GHOSTING: up to {worst} plates on one frame "
          f"({len(bad_frames)}/{a.n} frames affected)")
    print("    switch to the external layer:  python3 scripts/caption_layer.py")
    print("    then composite it with:        python3 scripts/finish.py")
    return 1


if __name__ == "__main__":
    sys.exit(main())
