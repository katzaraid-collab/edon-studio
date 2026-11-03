#!/usr/bin/env python3
"""Cut the A-roll to the speech — onset-precise, frame-exact.

This is the quality gate everything downstream inherits. It implements
references/cutting.md:

  * map speech islands with silencedetect (NOT with the transcript — the transcript
    smears aborted takes)
  * find each chunk's true onset at SPEECH level (-26 dB), not silence level
  * bound the onset search on BOTH sides so it cannot lock onto a neighbour's tail
  * land true speech exactly one frame into every segment
  * derive the edited gap from the ORIGINAL pause so the speaker's rhythm survives
  * quantise every segment to whole frames, then PROVE it by counting packets

Usage
  python3 scripts/cut_aroll.py --src raw.mp4 --plan                 # inspect the islands
  python3 scripts/cut_aroll.py --src raw.mp4 --chunks chunks.json   # do the cut

`chunks.json` is a list of the chunks you want, in order:
  [{"name":"c01","start":12.44,"end":15.02}, ...]
Produce it from --plan output, dropping false starts and keeping the LAST take of any
repeated line. Merges and drops come from config.json → cutting.merge / cutting.drop.
"""
import json
import math
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hfcfg  # noqa: E402

FRAME = 0.04


# ------------------------------------------------------------------ probing

def islands(src, noise_db=-33.0, min_sil=0.30):
    """Speech islands, from silencedetect. Never pass -v error: it suppresses the
    silencedetect output entirely and the probe comes back looking like a missing file."""
    r = hfcfg.run(["ffmpeg", "-nostdin", "-i", src,
                   "-af", f"silencedetect=noise={noise_db}dB:d={min_sil}", "-f", "null", "-"])
    txt = r.stderr
    starts = [float(x) for x in re.findall(r"silence_start: ([0-9.]+)", txt)]
    ends = [float(x) for x in re.findall(r"silence_end: ([0-9.]+)", txt)]
    total = float(hfcfg.probe(src, "format=duration") or 0)
    marks = sorted([(s, "s") for s in starts] + [(e, "e") for e in ends])
    out, cur = [], 0.0
    for t, kind in marks:
        if kind == "s":
            if t - cur > 0.12:
                out.append((round(cur, 3), round(t, 3)))
        else:
            cur = t
    if total - cur > 0.12:
        out.append((round(cur, 3), round(total, 3)))
    return out, total


def rms_onset(src, lo, hi, thresh_db=-26.0, window=480):
    """First 10 ms window above `thresh_db` inside [lo, hi] — the true speech onset.

    silencedetect at -33/-40 dB stops at breath and room tone, which sit 40-150 ms
    BEFORE the first consonant. Cutting there leaves an audible beat of nothing.
    """
    if hi <= lo:
        return None
    tmp = "/tmp/_onset.txt"
    if os.path.exists(tmp):
        os.remove(tmp)
    hfcfg.run(["ffmpeg", "-nostdin", "-y", "-ss", f"{lo:.4f}", "-t", f"{hi - lo:.4f}", "-i", src,
               "-af", f"asetnsamples={window},astats=metadata=1:reset=1,"
                      f"ametadata=print:key=lavfi.astats.Overall.RMS_level:file={tmp}",
               "-f", "null", "-"])
    if not os.path.exists(tmp):
        return None
    t = None
    for line in open(tmp):
        m = re.match(r"frame:\d+\s+pts:\d+\s+pts_time:([0-9.]+)", line)
        if m:
            t = float(m.group(1))
        elif t is not None and "RMS_level=" in line:
            try:
                v = float(line.split("=")[1])
            except ValueError:
                continue
            if v > thresh_db:
                return lo + t
    return None


def rms_offset(src, lo, hi, thresh_db=-26.0):
    """Last window above threshold — where speech actually stops."""
    tmp = "/tmp/_offset.txt"
    if os.path.exists(tmp):
        os.remove(tmp)
    hfcfg.run(["ffmpeg", "-nostdin", "-y", "-ss", f"{lo:.4f}", "-t", f"{hi - lo:.4f}", "-i", src,
               "-af", f"asetnsamples=480,astats=metadata=1:reset=1,"
                      f"ametadata=print:key=lavfi.astats.Overall.RMS_level:file={tmp}",
               "-f", "null", "-"])
    if not os.path.exists(tmp):
        return None
    t, last = None, None
    for line in open(tmp):
        m = re.match(r"frame:\d+\s+pts:\d+\s+pts_time:([0-9.]+)", line)
        if m:
            t = float(m.group(1))
        elif t is not None and "RMS_level=" in line:
            try:
                v = float(line.split("=")[1])
            except ValueError:
                continue
            if v > thresh_db:
                last = lo + t
    return last


# -------------------------------------------------------------------- cutting

def plan_chunks(src, chunks, cfg):
    """Resolve every chunk's real onset/offset, with the search window bounded on
    BOTH sides. An unbounded search catches the previous chunk's tail (or the next
    chunk's head) and silently glues neighbouring sentences together.

    A shift that comes back as exactly -0.600 is always this bug, never a real onset.
    """
    c = cfg["cutting"]
    db = c["onset_db"]
    out = []
    for i, ch in enumerate(chunks):
        s, e = float(ch["start"]), float(ch["end"])
        prev_end = float(chunks[i - 1]["end"]) if i else 0.0
        next_start = float(chunks[i + 1]["start"]) if i + 1 < len(chunks) else s + 1e6
        # explicit floor after a DROPPED false start: a discarded take is not in the
        # list, so nothing else stops the search locking onto its tail
        floor = max(prev_end + 0.005, float(ch.get("floor", 0.0)))
        lo = max(s - 0.60, floor)
        hi = min(e + 0.50, next_start - 0.005)
        on = rms_onset(src, lo, min(hi, s + 1.20), db)
        off = rms_offset(src, max(lo, e - 1.50), hi, db)
        if on is None:
            on = s
            print(f"  ! {ch['name']}: no onset above {db} dB in [{lo:.2f},{hi:.2f}] — using {s:.3f}")
        if off is None:
            off = e
        shift = on - s
        if abs(shift + 0.600) < 0.002:
            print(f"  ! {ch['name']}: shift is exactly -0.600 — that is the search-window "
                  f"edge, not an onset. Raise the floor for this chunk.")
        out.append({**ch, "onset_raw": round(on, 4), "offset_raw": round(off, 4),
                    "orig_gap": round(s - prev_end, 4) if i else 0.0})
    return out


def apply_merges(plan, merges):
    """A word clipped at its own segment head is fixed by MERGING, not by nudging the
    in-point: the -26 dB gate fires on a loud voiced consonant and drops the quieter
    fricative in front of it. A transcript missing a leading letter is the tell.
    Merging makes the audio continuous across the join — mid-segment audio is never
    gated — and the natural pause survives, which is what 'sounds like a complete
    sentence' means."""
    if not merges:
        return plan
    by_name = {p["name"]: p for p in plan}
    drop = set()
    for a, b in merges:
        if a in by_name and b in by_name:
            by_name[a]["offset_raw"] = by_name[b]["offset_raw"]
            by_name[a]["merged_with"] = b
            drop.add(b)
            print(f"  merged {a} + {b} → one continuous segment")
    return [p for p in plan if p["name"] not in drop]


def build_segments(src, plan, cfg, outdir="segments", trim=None):
    """trim maps segment name -> extra seconds to shave off src_start. The AAC encoder
    adds ~21 ms of priming delay, so a segment cut at exactly (onset - 0.04) measures
    ~0.065 s in the encoded file. The refine pass measures that residual and feeds it
    back here. The frame COUNT never changes, so no boundary moves."""
    c = cfg["cutting"]
    trim = trim or {}
    lead = c["speech_lead"]                    # true speech lands here inside the segment
    os.makedirs(outdir, exist_ok=True)
    segs, cum = [], 0.0
    for i, p in enumerate(plan):
        last = i == len(plan) - 1
        if last:
            tail = c["tail_last"]              # the closing word needs decay + a beat of air
        elif p.get("topic_boundary"):
            tail = c["gap_topic_boundary"] - c["lead"]
        else:
            gap = min(max(c["gap_ratio"] * max(p["orig_gap"], 0.0), c["gap_min"]), c["gap_max"])
            tail = max(gap - c["lead"], c["tail_min"])

        src_start = max(p["onset_raw"] - lead + trim.get(p["name"], 0.0), 0.0)
        src_end = p["offset_raw"] + tail
        dur = src_end - max(p["onset_raw"] - lead, 0.0)

        # QUANTISE TO WHOLE FRAMES. A non-frame-aligned duration encodes LONGER than
        # requested, so planned boundaries drift later than the real concat and every
        # layout cut fires before its sentence starts.
        nframes = int(math.ceil(dur / FRAME - 1e-9))
        dur = round(nframes * FRAME, 4)

        fo = max(0.0, dur - c["fade_out"])
        if fo <= p["offset_raw"] - src_start + 0.035:
            fo = max(0.0, dur - min(c["fade_out"], 0.03))
        out = os.path.join(outdir, f"{p['name']}.mp4")
        vf = p.get("vf") or "scale=1080:1920:flags=lanczos,fps=25,setsar=1"
        r = hfcfg.run([
            "ffmpeg", "-v", "error", "-y", "-ss", f"{src_start:.4f}", "-i", src,
            "-t", f"{dur:.4f}", "-frames:v", str(nframes),
            "-vf", vf,
            "-af", f"afade=t=in:st=0:d={c['fade_in']},afade=t=out:st={fo:.4f}:d={c['fade_out']}",
            "-c:v", "libx264", "-crf", "16", "-preset", "medium", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-ac", "2", out])
        if r.returncode:
            sys.exit(f"encode failed for {p['name']}:\n{r.stderr}")
        segs.append({"name": p["name"], "file": out, "src_start": round(src_start, 4),
                     "src_end": round(src_start + dur, 4), "dur": dur,
                     "frames": nframes, "start": round(cum, 4)})
        cum = round(cum + dur, 4)
    return segs, cum


def concat_and_prove(segs, planned_total, out="assets/aroll.mp4"):
    """Concat, then PROVE frame-exactness by counting PACKETS, not seconds.
    format=duration reports the AAC tail (~20 ms past the last video frame) and makes a
    perfect concat look 0.02 s long."""
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    lst = "segments/list.txt"
    with open(lst, "w") as f:
        for s in segs:
            f.write(f"file '{os.path.basename(s['file'])}'\n")
    r = hfcfg.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0",
                   "-i", lst, "-c", "copy", out])
    if r.returncode:
        sys.exit(f"concat failed:\n{r.stderr}")

    seg_frames = sum(hfcfg.frames(s["file"]) for s in segs)
    cat_frames = hfcfg.frames(out)
    real = round(cat_frames * FRAME, 4)
    print(f"\n  segment frames {seg_frames}  concat frames {cat_frames}  → {real:.3f}s")
    if seg_frames != cat_frames:
        sys.exit(f"  ✗ FRAME DRIFT: segments sum to {seg_frames}, concat holds {cat_frames}")
    if abs(real - planned_total) > 0.001:
        sys.exit(f"  ✗ TIMELINE DRIFT: planned {planned_total:.3f}s vs real {real:.3f}s")
    print("  ✓ frame-exact: planned == real")
    return real


def measure_onsets(segs, db=-26.0):
    """Where speech actually lands inside each ENCODED segment.

    Measure in the segment file, from 0 forward. Do NOT onset-detect in the finished
    A-roll from `start - 0.25`: segments are butt-joined with only ~0.03 s of tail, so
    that window is still inside the PREVIOUS sentence and every boundary falsely reads
    as ~0.25 s of drift.
    """
    out = {}
    for s in segs:
        t = rms_onset(s["file"], 0.0, 0.60, db)
        out[s["name"]] = t if t is not None else float("nan")
    return out


def report_onsets(onsets, target, lo=0.015, hi=0.055):
    print(f"\n  onset inside each segment (target {target:.2f}s, accept {lo}-{hi}s):")
    bad = 0
    for name, d in onsets.items():
        ok = d == d and lo <= d <= hi
        if not ok:
            bad += 1
        print(f"    {name:>6s}  {d:+.3f}s{'' if ok else '   ← out of range'}")
    return bad


def main():
    ap = hfcfg.arg_parser(__doc__)
    ap.add_argument("--src", required=True, help="raw recording")
    ap.add_argument("--chunks", help="chunks.json — the takes you are keeping, in order")
    ap.add_argument("--plan", action="store_true", help="print the speech islands and exit")
    ap.add_argument("--noise", type=float, default=-33.0)
    ap.add_argument("--refine", type=int, default=2,
                    help="onset refinement passes (0 disables). Each pass re-cuts with "
                         "the measured residual folded in; the frame count never changes.")
    ap.add_argument("--out", default="assets/aroll.mp4")
    a = ap.parse_args()
    cfg = hfcfg.load(a.config)
    hfcfg.require("ffmpeg", "ffprobe")

    if a.plan or not a.chunks:
        isl, total = islands(a.src, a.noise)
        print(f"{len(isl)} speech islands in {total:.2f}s at {a.noise} dB\n")
        print("  copy the ones you want into chunks.json, dropping false starts.")
        print("  the LAST take of a repeated line wins.")
        print("  cross-check at -40 dB too: a quietly-spoken take can read as silence\n")
        for i, (s, e) in enumerate(isl):
            print(f'    {{"name":"c{i+1:02d}", "start":{s:.3f}, "end":{e:.3f}}},'
                  f'    # {e - s:5.2f}s')
        return 0

    chunks = json.load(open(a.chunks, encoding="utf-8"))
    print(f"planning {len(chunks)} chunks…")
    plan = plan_chunks(a.src, chunks, cfg)
    plan = apply_merges(plan, cfg["cutting"].get("merge") or [])
    drop = set(cfg["cutting"].get("drop") or [])
    plan = [p for p in plan if p["name"] not in drop]

    db = cfg["cutting"]["onset_db"]
    target = cfg["cutting"]["speech_lead"]

    # ITERATE: measure, shift the start by (onset - target), re-cut, re-measure.
    # The frame COUNT is held constant across passes, so no boundary ever moves —
    # only the framing of the audio inside each segment changes.
    trim, segs, total = {}, None, None
    for it in range(a.refine + 1):
        segs, total = build_segments(a.src, plan, cfg, trim=trim)
        onsets = measure_onsets(segs, db)
        residual = {n: (d - target) for n, d in onsets.items() if d == d}
        worst = max((abs(v) for v in residual.values()), default=0.0)
        if it == 0 and worst > 0.008:
            print(f"\n  pass 0: worst residual {worst*1000:.0f} ms "
                  f"(AAC priming delay is ~21 ms) — refining")
        if worst <= 0.008 or it == a.refine:
            break
        for n, v in residual.items():
            trim[n] = round(trim.get(n, 0.0) + v, 4)

    real = concat_and_prove(segs, total, a.out)
    bad = report_onsets(measure_onsets(segs, db), target)

    os.makedirs("src", exist_ok=True)
    json.dump({"bounds": [s["start"] for s in segs], "total": real,
               "segments": segs},
              open("src/bounds.json", "w"), indent=1)
    json.dump(plan, open("cuts.json", "w"), ensure_ascii=False, indent=1)

    print(f"\n  {a.out}  {real:.3f}s  ({len(segs)} segments)")
    print("  src/bounds.json written — beats.py and the caption builder read it")
    if bad:
        print(f"\n  ✗ {bad} segment(s) outside the onset target — re-check those chunks")
        return 1
    print("\n  next: re-transcribe the FINAL A-roll for caption timings (final timebase!)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
