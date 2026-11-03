#!/usr/bin/env python3
"""THE beat map — the single source of truth for layout state and caption slot.

Copy this into your project as `scripts/beats.py` and edit BEATS. Both the
composition builder and the caption-layer builder import it, so a cut point can
never move in one without moving in the other.

The failure this prevents: a hand-written `SLOTS = [(start, end, class)]` table kept
alongside a separate visual beat map. They drift, and the symptom lands on the
speaker's face — a caption plate sitting on their mouth because the slot table still
said "panel" across a stretch where the beat map had them full-screen. Nothing is
wrong with the slot VALUES; the two tables simply disagree.
"""
import json
import os
import sys

# ---------------------------------------------------------------- slot table
# Vertical position of the caption plate, per layout state. See references/captions.md.
SLOT = {
    "hook":  1310,   # matte hook — below the chin, above the y1430 safe line
    "std":   1300,   # speaker full-screen — below the face
    "panel":  780,   # 900px top panel — at/above the seam, over B-roll
    "ctr":    930,   # full-frame B-roll or graphic — CENTRED, never lower third
    "hi":     520,   # B-roll whose ACTION is dead centre — lifted clear of it
}

# ------------------------------------------------------------------- the map
# (start_seconds, kind, tag).  `kind` must be a key of SLOT.
# `tag` is free-text for humans and for the validator's error messages.
BEATS = [
    (0.00, "hook", "hook — matte over blurred backdrop"),
    # (8.28,  "std",   "plain A-roll"),
    # (11.56, "ctr",   "full-frame B-roll: step 1"),
    # (17.50, "hi",    "the click happens dead centre — lift the caption"),
    # (21.22, "std",   "A-roll, steady push"),
]

END = 0.0          # composition duration — set from the A-roll's REAL duration
FRAME = 0.04       # 25 fps


def slot_at(t):
    """The caption slot class active at time t."""
    kind = BEATS[0][1]
    for start, k, _ in BEATS:
        if t >= start - 1e-6:
            kind = k
    return kind


def top_at(t):
    return SLOT[slot_at(t)]


def beat_starts():
    return [b[0] for b in BEATS]


def panels():
    """Contiguous `panel` beats merged into (start, end) ranges — the gradient panels."""
    out = []
    for i, (start, kind, _) in enumerate(BEATS):
        end = BEATS[i + 1][0] if i + 1 < len(BEATS) else END
        if kind != "panel":
            continue
        if out and abs(out[-1][1] - start) < 1e-6:
            out[-1] = (out[-1][0], end)
        else:
            out.append((start, end))
    return out


def assert_on_boundaries(bounds, tol=1e-3):
    """Every beat start must be a real segment boundary. Run this before building
    anything — a beat that sits mid-sentence is a cut that fires early."""
    bad = [(t, tag) for t, _, tag in BEATS
           if not any(abs(t - b) < tol for b in bounds)]
    if bad:
        lines = "\n".join(f"    {t:7.2f}  {tag}" for t, tag in bad)
        raise AssertionError(
            "beat start(s) are not segment boundaries — every layout cut must land on a "
            f"sentence start:\n{lines}")
    return True


def load_bounds(path="src/bounds.json"):
    """Segment boundaries as written by cut_aroll.py."""
    if not os.path.exists(path):
        sys.exit(f"{path} not found — run scripts/cut_aroll.py first")
    d = json.load(open(path, encoding="utf-8"))
    return d["bounds"], d["total"]


if __name__ == "__main__":
    bounds, total = load_bounds()
    globals()["END"] = total
    assert_on_boundaries(bounds)
    print(f"{len(BEATS)} beats over {total:.2f}s — every start is a segment boundary")
    for start, kind, tag in BEATS:
        print(f"  {start:7.2f}  {kind:6s} top={SLOT[kind]:4d}  {tag}")
