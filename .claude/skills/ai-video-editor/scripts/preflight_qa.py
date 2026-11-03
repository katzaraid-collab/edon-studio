#!/usr/bin/env python3
"""Preflight QA — run BEFORE showing anyone anything.

Catches the mistake classes that actually come back as notes: dead space, frame drift,
caption gaps and overlaps, two-line captions, missing spoken words, low bitrate, audio
clipping, an HDR-tagged master.

A gate beats a rule. When a note repeats, add a check here rather than another line of
prose — and run the negative test when you add one. A check you have never seen fail is
not a check.

Usage
  python3 scripts/preflight_qa.py <project_dir> \
      [--aroll assets/aroll.mp4] [--transcript src/aroll.json] [--render renders/final.mp4]
"""
import glob
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hfcfg  # noqa: E402

FRAME = 0.04
issues, ok = [], []


def check_dead_space(aroll):
    """Never pass -v error here — it suppresses silencedetect output entirely and the
    probe comes back looking like a missing file."""
    out = hfcfg.run(["ffmpeg", "-nostdin", "-i", aroll,
                     "-af", "silencedetect=noise=-33dB:d=0.3", "-f", "null", "-"]).stderr
    starts = [float(x) for x in re.findall(r"silence_start: ([0-9.]+)", out)]
    durs = [float(x) for x in re.findall(r"silence_duration: ([0-9.]+)", out)]
    total = float(hfcfg.probe(aroll, "format=duration") or 0)
    hits = list(zip(starts, durs))
    # The CLOSING tail (~0.45 s) is deliberate — without it the final word reads as
    # clipped. Any silence run that reaches the end of the file is that tail, not a gap.
    bad = [(t, d) for t, d in hits if d > 0.42 and (total - (t + d)) > 0.10]
    tail = [(t, d) for t, d in hits if (total - (t + d)) <= 0.10]
    if bad:
        issues.append("DEAD SPACE in %s: %s" % (
            os.path.basename(aroll),
            ", ".join(f"{t:.2f}s ({d:.2f}s long)" for t, d in bad)))
    else:
        note = f"dead space: clean ({len(hits) - len(tail)} short breaths ≤0.42s)"
        if tail:
            note += f", closing tail {tail[-1][1]:.2f}s"
        ok.append(note)
    if tail and tail[-1][1] < 0.30:
        issues.append(f"CLOSING TAIL only {tail[-1][1]:.2f}s — the last word will read as "
                      f"clipped; the closing segment takes ~0.45s")


def check_drift(segments_dir="segments"):
    """Frame-quantisation drift is the cause of the most-repeated note in this pipeline:
    a segment whose duration is not a whole frame encodes LONGER than planned, so every
    later layout beat fires early. Count PACKETS, not seconds — format=duration reports
    the AAC tail and makes a perfect concat look 0.02s long."""
    segs = sorted(glob.glob(os.path.join(segments_dir, "*.mp4")))
    segs = [s for s in segs if not s.endswith("list.txt")]
    if not segs:
        return
    total_frames, bad = 0, []
    for f in segs:
        n = hfcfg.frames(f)
        total_frames += n
        d = float(hfcfg.probe(f, "stream=duration", "v:0") or 0)
        if abs(d / FRAME - round(d / FRAME)) > 1e-3:
            bad.append(f"{os.path.basename(f)} is {d:.4f}s — not a whole {FRAME}s frame")
    if bad:
        issues.append("SEGMENT NOT FRAME-ALIGNED (causes cut drift): " + "; ".join(bad[:3]))
    cum = round(total_frames * FRAME, 4)
    if os.path.exists("src/bounds.json"):
        planned = json.load(open("src/bounds.json"))
        if abs(planned.get("total", cum) - cum) > 0.001:
            issues.append(f"TIMELINE DRIFT: planned {planned['total']:.3f}s vs real {cum:.3f}s "
                          f"— every layout beat after the first is off")
        else:
            ok.append(f"segment timing: frame-exact, planned == real ({cum:.3f}s)")
    elif not bad:
        ok.append(f"segment timing: all frame-aligned ({cum:.3f}s)")


def _caption_rows(index_html, captions_json):
    """Captions may be composited as an external alpha layer instead of living in the
    composition — fall back to captions.json so these checks still run."""
    rows = []
    if os.path.exists(index_html):
        html = open(index_html, encoding="utf-8").read()
        for m in re.finditer(r'class="([^"]*\bcap\b[^"]*)"[^>]*data-start="([\d.]+)"'
                             r'[^>]*data-duration="([\d.]+)"[^>]*>(.*?)</div>', html, re.S):
            rows.append({"cls": m.group(1), "start": float(m.group(2)),
                         "dur": float(m.group(3)), "text": m.group(4)})
    if not rows and os.path.exists(captions_json):
        for r in json.load(open(captions_json, encoding="utf-8")):
            rows.append({"cls": "", "start": r["start"], "dur": r["dur"], "text": r["text"]})
    return sorted(rows, key=lambda r: r["start"])


def check_caption_continuity(index_html="index.html", captions_json="captions.json"):
    rows = _caption_rows(index_html, captions_json)
    if not rows:
        issues.append("NO CAPTIONS FOUND in the composition and no captions.json to fall back on")
        return
    gaps = ov = 0
    for x, y in zip(rows, rows[1:]):
        e = x["start"] + x["dur"]
        if y["start"] - e > 0.0055:
            gaps += 1
        if e - y["start"] > 0.0055:
            ov += 1
    if gaps:
        issues.append(f"CAPTION GAP on {gaps} boundaries — blank frames with no caption")
    if ov:
        issues.append(f"CAPTION OVERLAP on {ov} boundaries — two plates stacked for a frame")
    multi = [r for r in rows if r["text"].count("<br") or r["text"].count('class="l"') > 1]
    if multi:
        issues.append(f"{len(multi)} caption card(s) have TWO LINES — one line only, always")
    words = [len(re.sub(r"<[^>]+>", " ", r["text"]).split()) for r in rows]
    fat = [n for n in words if n > 4]
    if fat:
        issues.append(f"{len(fat)} caption card(s) over 4 words (max seen: {max(words)})")
    if not (gaps or ov or multi or fat):
        ok.append(f"captions: {len(rows)} cards, no gaps, no overlaps, single-line, ≤4 words")


def check_words_covered(captions_json, transcript_json, typos=None):
    """Every spoken word must appear in a caption — verbatim is the rule."""
    if not (os.path.exists(captions_json) and os.path.exists(transcript_json)):
        return
    typos = typos or {}
    caps = json.load(open(captions_json, encoding="utf-8"))
    cap_text = " ".join(re.sub(r"<[^>]+>", " ", c["text"]) for c in caps)

    # strip punctuation but keep letters from any script (\w plus the Hebrew and Arabic
    # blocks, which some Python builds do not fold into \w for these locales)
    PUNCT = re.compile(r"[^\w֐-׿؀-ۿ]", re.UNICODE)

    def norm(w):
        return typos.get(PUNCT.sub("", w), PUNCT.sub("", w))

    cap_words = {norm(w) for w in cap_text.split() if norm(w)}
    d = json.load(open(transcript_json, encoding="utf-8"))
    spoken = []
    if isinstance(d, dict) and "segments" in d:
        for s in d["segments"]:
            for w in s.get("words", []):
                spoken.append(norm(str(w.get("word", ""))))
    else:
        spoken = [norm(str(x[2])) for x in d]
    missing = [w for w in spoken if w and w not in cap_words]
    # tolerate transliteration/typo mismatches via a prefix check
    real = [w for w in missing if not any(len(w) >= 4 and w[:4] in cw for cw in cap_words)]
    if real:
        issues.append(f"CAPTION WORDS possibly missing (check against transcriber typos): "
                      f"{real[:12]}")
    else:
        ok.append(f"captions: all {len(spoken)} spoken words covered")


def check_render(render, cfg):
    br_s = hfcfg.probe(render, "format=bit_rate")
    if br_s:
        br = int(br_s)
        if br < 28_000_000:
            issues.append(f"RENDER BITRATE {br/1e6:.1f} Mbps < 30-35 target — render with "
                          f"--video-bitrate {cfg['render']['video_bitrate']}")
        else:
            ok.append(f"render bitrate: {br/1e6:.1f} Mbps")
    vol = hfcfg.run(["ffmpeg", "-nostdin", "-i", render, "-af", "volumedetect",
                     "-f", "null", "-"]).stderr
    m = re.search(r"max_volume: ([-0-9.]+) dB", vol)
    if m:
        peak = float(m.group(1))
        if peak > -0.3:
            issues.append(f"AUDIO CLIPPING risk: max {peak} dB — fix with volume=-2dB on the "
                          f"A-roll (never alimiter: its makeup gain puts the peak straight back)")
        elif peak < -4.0:
            issues.append(f"AUDIO TOO QUIET: max {peak} dB (target -1 to -2)")
        else:
            ok.append(f"audio peak: {peak} dB")
    colours = hfcfg.probe(render, "stream=color_space,color_transfer,color_primaries", "v:0")
    bad = [t for t in ("bt2020", "arib-std-b67", "smpte2084") if t in colours]
    if bad:
        issues.append(f"MASTER IS HDR-TAGGED {bad} — every player will apply an HDR→SDR "
                      f"transform and it will look washed out. Run scripts/finish.py")
    else:
        ok.append("colour: SDR bt709")


def main():
    ap = hfcfg.arg_parser(__doc__)
    ap.add_argument("project", nargs="?", default=".")
    ap.add_argument("--aroll")
    ap.add_argument("--transcript")
    ap.add_argument("--render")
    ap.add_argument("--captions", default="captions.json")
    ap.add_argument("--html", default="index.html")
    a = ap.parse_args()
    cfg = hfcfg.load(a.config)
    hfcfg.require("ffmpeg", "ffprobe")
    os.chdir(a.project)

    check_drift()
    check_caption_continuity(a.html, a.captions)
    if a.transcript:
        check_words_covered(a.captions, a.transcript, cfg["language"].get("typos"))
    if a.aroll:
        check_dead_space(a.aroll)
    if a.render:
        check_render(a.render, cfg)

    print("== PREFLIGHT QA ==")
    for o in ok:
        print(f"  ✓ {o}")
    for i in issues:
        print(f"  ✗ {i}")
    if not issues:
        print("\n  clean — now walk references/checklist.md before you show it to anyone")
    return 1 if issues else 0


if __name__ == "__main__":
    sys.exit(main())
