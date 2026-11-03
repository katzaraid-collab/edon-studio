#!/usr/bin/env python3
"""Validate the BUILT index.html against the beat map — every element, not a hand-picked few.

The bug this exists for: when you drop a line or re-cut, every downstream time moves.
Captions, panels and the A-roll get regenerated from the beat map and are correct — but
anything HARDCODED in the HTML template (a hero card, a panel B-roll, an SFX cue) is
left at the old second, and a snapshot at the old time looks fine.

It has bitten twice in one session: first a card's START, then a card's DURATION (still
carrying a pre-recut value, so it hung 1.84 s into the next shot). A validator that only
checks starts on a hand-picked id list passes both times.

Asserts:
  1. nothing runs past END
  2. every beat-map-defined element matches start AND duration
  3. bgm1.duration == MUSIC_STOP, bgm2 starts on resume and its media-start is in phase
  4. captions have zero gaps, end exactly at END, and each card's class == slot_at(start)
  5. every beat start is a real segment boundary
  6. no stranded numbers from a previous timeline

Exit code is non-zero on any failure. Run it before EVERY render.
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hfcfg  # noqa: E402

beatmap, BEATS_PATH = hfcfg.load_beats()   # project copy wins over the skill's stub

CLIP_RE = re.compile(
    r'<(?P<tag>video|audio|img|div|svg)\b[^>]*?'
    r'(?:id="(?P<id>[^"]*)")?[^>]*?'
    r'data-start="(?P<start>[\d.]+)"[^>]*?'
    r'data-duration="(?P<dur>[\d.]+)"[^>]*?>', re.S)


def parse_clips(html):
    out = []
    for m in re.finditer(r'<(video|audio|img|div|svg)\b([^>]*)>', html, re.S):
        attrs = m.group(2)
        s = re.search(r'data-start="([\d.]+)"', attrs)
        d = re.search(r'data-duration="([\d.]+)"', attrs)
        if not s:
            continue
        i = re.search(r'id="([^"]*)"', attrs)
        c = re.search(r'class="([^"]*)"', attrs)
        ms = re.search(r'data-media-start="([\d.]+)"', attrs)
        out.append({"tag": m.group(1),
                    "id": i.group(1) if i else "",
                    "cls": c.group(1) if c else "",
                    "start": float(s.group(1)),
                    "dur": float(d.group(1)) if d else None,
                    "media_start": float(ms.group(1)) if ms else None})
    return out


def main():
    ap = hfcfg.arg_parser(__doc__)
    ap.add_argument("--html", default="index.html")
    ap.add_argument("--captions", default="captions.json")
    ap.add_argument("--bounds", default="src/bounds.json")
    ap.add_argument("--expect", help="JSON of {id: [start, duration]} the build script emitted")
    ap.add_argument("--music-stop", type=float, help="expected bgm1 duration")
    ap.add_argument("--stale", nargs="*", default=[],
                    help="numbers from a previous timeline — a hit is a stranded element")
    a = ap.parse_args()
    hfcfg.load(a.config)

    if not os.path.exists(a.html):
        sys.exit(f"{a.html} not found")
    html = open(a.html, encoding="utf-8").read()
    clips = parse_clips(html)
    fails, notes = [], []

    bounds, end = [], None
    if os.path.exists(a.bounds):
        d = json.load(open(a.bounds, encoding="utf-8"))
        bounds, end = d["bounds"], d["total"]
    if beatmap and getattr(beatmap, "END", 0):
        end = beatmap.END or end
    if end is None:
        fails.append("no END available (need src/bounds.json or beats.END)")
        end = 1e9

    # 1 ----------------------------------------------------- nothing past END
    over = [c for c in clips if c["dur"] is not None and c["start"] + c["dur"] > end + 0.001]
    for c in over:
        fails.append(f"{c['id'] or c['tag']} runs to "
                     f"{c['start'] + c['dur']:.3f}s, past END {end:.3f}s")
    if not over:
        notes.append(f"{len(clips)} timed elements, none past END ({end:.3f}s)")

    # 2 -------------------------------------- expected starts AND durations
    if a.expect and os.path.exists(a.expect):
        expect = json.load(open(a.expect, encoding="utf-8"))
        by_id = {c["id"]: c for c in clips if c["id"]}
        for eid, val in expect.items():
            want_s, want_d = (list(val) + [None])[:2]
            got = by_id.get(eid)
            if not got:
                fails.append(f"expected element '{eid}' is not in the built html")
                continue
            if abs(got["start"] - float(want_s)) > 0.001:
                fails.append(f"{eid}: start {got['start']:.3f} != expected {float(want_s):.3f}")
            if want_d is not None and got["dur"] is not None \
                    and abs(got["dur"] - float(want_d)) > 0.001:
                fails.append(f"{eid}: DURATION {got['dur']:.3f} != expected {float(want_d):.3f} "
                             f"— stranded from a previous cut")
        notes.append(f"checked {len(expect)} beat-map ids (start AND duration)")

    # 3 ---------------------------------------------------------------- music
    bgms = sorted([c for c in clips if c["tag"] == "audio" and c["id"].startswith("bgm")],
                  key=lambda c: c["start"])
    if a.music_stop is not None and bgms:
        if abs((bgms[0]["dur"] or 0) - a.music_stop) > 0.001:
            fails.append(f"bgm1 duration {bgms[0]['dur']} != MUSIC_STOP {a.music_stop}")
    if len(bgms) >= 2 and bgms[0]["media_start"] is not None \
            and bgms[1]["media_start"] is not None:
        drift = bgms[1]["media_start"] - (bgms[0]["media_start"] +
                                          (bgms[1]["start"] - bgms[0]["start"]))
        if abs(drift) > 0.02:
            fails.append(f"bgm2 media-start is {drift:+.3f}s out of phase — the track rewinds "
                         f"instead of continuing where it would have been")
        else:
            notes.append("music resume is in phase")

    # 4 -------------------------------------------------------------- captions
    caps = [c for c in clips if "cap" in c["cls"].split()]
    external = os.path.exists(a.captions) and not caps
    if external:
        caps = [{"start": r["start"], "dur": r["dur"], "cls": "", "id": f"c{r['i']}"}
                for r in json.load(open(a.captions, encoding="utf-8"))]
        notes.append(f"captions are an external layer ({len(caps)} cards)")
    if caps:
        caps.sort(key=lambda c: c["start"])
        gaps = ov = 0
        for x, y in zip(caps, caps[1:]):
            e = x["start"] + (x["dur"] or 0)
            if y["start"] - e > 0.0055:
                gaps += 1
            if e - y["start"] > 0.0055:
                ov += 1
        if gaps:
            fails.append(f"{gaps} caption GAP(s) — blank frames with no caption")
        if ov:
            fails.append(f"{ov} caption OVERLAP(s) — two plates stacked")
        last = caps[-1]["start"] + (caps[-1]["dur"] or 0)
        if abs(last - end) > 0.06:
            fails.append(f"last caption ends at {last:.3f}s, END is {end:.3f}s")
        if beatmap and beatmap.BEATS and not external:
            wrong = [c for c in caps
                     if beatmap.slot_at(c["start"]) not in c["cls"].split()]
            if wrong:
                fails.append(f"{len(wrong)} caption(s) carry a class that is not "
                             f"slot_at(start) — the slot table and the beat map disagree")
        if not (gaps or ov):
            notes.append(f"captions: {len(caps)} cards, no gaps, no overlaps")

    # 5 ------------------------------------------- beats land on real boundaries
    if beatmap and beatmap.BEATS and bounds:
        try:
            beatmap.assert_on_boundaries(bounds)
            notes.append(f"all {len(beatmap.BEATS)} beat starts are segment boundaries")
        except AssertionError as e:
            fails.append(str(e))

    # 6 ---------------------------------------------------- stranded numbers
    for s in a.stale:
        if s in html:
            fails.append(f"stale timeline value '{s}' still present in {a.html} "
                         f"— a stranded element")

    print("== VALIDATE ==")
    for n in notes:
        print(f"  ✓ {n}")
    for f in fails:
        print(f"  ✗ {f}")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
