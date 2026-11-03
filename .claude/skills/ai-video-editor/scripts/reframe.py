#!/usr/bin/env python3
"""Re-cut the A-roll from the high-res raw with a per-segment face-centred crop.

The standing note this answers: "I'm about 10% too far to the right — scale me up a
tiny bit and put me in the middle."

A COMPOSITION-LEVEL X-SHIFT CANNOT FIX IT. Shifting by d requires
scale >= 540/(540-d) or you expose black at the frame edge, so centring 123px *forces*
a 1.295x punch-in. That is arithmetic, not a choice. Do it as a crop on the raw
instead: full resolution, and a crop is physically incapable of exposing a black edge.

Same in/out points as cuts.json — only the framing changes — so every caption and
layout timing stays valid.

Guard the measurement: when someone reads off their phone the skin blob becomes their
hands. Samples outside the plausible band are rejected and the shoot median is used.
Then RE-AUDIT the framing on the OUTPUT and fold the residual back via
src/crop_override.json — a single measurement pass is not enough.

Usage
  python3 scripts/reframe.py --raw raw.mp4 --measure          # where is the face, per segment
  python3 scripts/reframe.py --raw raw.mp4 --zoom 1.295       # do it
"""
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hfcfg  # noqa: E402


def face_x(raw, t, env, probe_w=1080, probe_h=1920):
    """Median x of the facial-skin blob at time t, in RAW pixels."""
    import numpy as np  # guarded in main()
    p = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", raw, "-frames:v", "1",
                        "-vf", f"scale={probe_w}:{probe_h}", "-f", "rawvideo",
                        "-pix_fmt", "rgb24", "-"], capture_output=True, env=env)
    need = probe_w * probe_h * 3
    if len(p.stdout) < need:
        return None
    fr = np.frombuffer(p.stdout[:need], np.uint8).reshape(probe_h, probe_w, 3).astype(np.int16)
    r, g, b = fr[:, :, 0], fr[:, :, 1], fr[:, :, 2]
    skin = (r > 95) & (r > g + 16) & (g > b + 6) & ((r - b) > 40) & ((r - b) < 130)
    cols = skin[150:820].sum(axis=0)                 # head band only
    if cols.max() < 20:
        return None
    idx = np.where(cols > cols.max() * 0.30)[0]
    runs = np.split(idx, np.where(np.diff(idx) > 25)[0] + 1)
    run = max(runs, key=lambda s: cols[s].sum())
    return float((run[0] + run[-1]) / 2)             # in probe-space


def main():
    hfcfg.require_python("numpy")
    import numpy as np
    ap = hfcfg.arg_parser(__doc__)
    ap.add_argument("--raw", required=True, help="the high-res original")
    ap.add_argument("--cuts", default="cuts.json")
    ap.add_argument("--zoom", type=float, default=1.295,
                    help="punch-in factor; 540/(540-shift) is the minimum that avoids black edges")
    ap.add_argument("--measure", action="store_true", help="report face position and exit")
    ap.add_argument("--out", default="assets/aroll.mp4")
    ap.add_argument("--segdir", default="segments_framed")
    a = ap.parse_args()
    cfg = hfcfg.load(a.config)
    hfcfg.require("ffmpeg", "ffprobe")
    env = hfcfg.ffmpeg_env()

    RW = int(hfcfg.probe(a.raw, "stream=width", "v:0"))
    RH = int(hfcfg.probe(a.raw, "stream=height", "v:0"))
    W, H = cfg["project"]["width"], cfg["project"]["height"]
    CH = int(RH / a.zoom) // 2 * 2
    CW = int(CH * W / H) // 2 * 2
    CW = min(CW, RW)
    X_MAX = RW - CW
    scale_raw = RW / 1080.0                          # probe-space → raw

    cuts = json.load(open(a.cuts, encoding="utf-8"))
    override = {}
    if os.path.exists("src/crop_override.json"):
        override = json.load(open("src/crop_override.json"))

    print(f"  raw {RW}x{RH}   crop {CW}x{CH} (zoom {a.zoom:.3f})   x range 0..{X_MAX}")
    plan = []
    for c in cuts:
        s0 = float(c.get("src_start", c.get("onset_raw", 0)))
        e0 = float(c.get("src_end", c.get("offset_raw", s0 + 1)))
        samples = []
        n = max(3, int((e0 - s0) / 0.8))
        for k in range(n):
            t = s0 + (e0 - s0) * (k + 0.5) / n
            fx = face_x(a.raw, t, env)
            if fx is None:
                continue
            fx *= scale_raw
            if 0.30 * RW < fx < 0.78 * RW:           # reject hands / looking down
                samples.append(fx)
        fx = float(np.median(samples)) if samples else RW * 0.55
        x0 = int(round(min(max(fx - CW / 2, 0), X_MAX))) // 2 * 2
        if c["name"] in override:
            x0 = int(override[c["name"]])
        landed = (fx - x0) / CW * W
        plan.append({**c, "crop_x": x0, "face_raw": round(fx), "face_out": round(landed),
                     "n_samples": len(samples)})
        flag = "" if abs(landed - W / 2) < 25 else "   ← still off-centre"
        print(f"    {c['name']:>6s}  face_raw {fx:7.0f}  crop_x {x0:5d}  "
              f"→ lands at {landed:6.0f} / {W//2}  (n={len(samples)}){flag}")

    if a.measure:
        print("\n  --measure only. Re-run without it to encode, or write per-segment "
              "overrides to src/crop_override.json")
        return 0

    os.makedirs(a.segdir, exist_ok=True)
    cc = cfg["cutting"]
    for p in plan:
        s0 = float(p.get("src_start", p.get("onset_raw", 0)))
        dur = float(p.get("dur") or (float(p.get("src_end", s0)) - s0))
        fo = max(0.0, dur - cc["fade_out"])
        out = os.path.join(a.segdir, f"{p['name']}.mp4")
        r = hfcfg.run([
            "ffmpeg", "-v", "error", "-y", "-ss", f"{s0:.4f}", "-i", a.raw, "-t", f"{dur:.4f}",
            "-vf", f"crop={CW}:{CH}:{p['crop_x']}:0,scale={W}:{H}:flags=lanczos,"
                   f"fps={cfg['project']['fps']},setsar=1",
            "-af", f"afade=t=in:st=0:d={cc['fade_in']},afade=t=out:st={fo:.4f}:d={cc['fade_out']}",
            "-c:v", "libx264", "-crf", "16", "-preset", "medium", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-ac", "2", out])
        if r.returncode:
            sys.exit(f"encode failed for {p['name']}:\n{r.stderr}")

    lst = os.path.join(a.segdir, "list.txt")
    with open(lst, "w") as f:
        for p in plan:
            f.write(f"file '{p['name']}.mp4'\n")
    hfcfg.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst,
               "-c", "copy", a.out])
    json.dump(plan, open("cuts_framed.json", "w"), ensure_ascii=False, indent=1)
    print(f"\n  {a.out} rewritten — same in/out points, so no caption or beat needs touching")
    print("  now RE-AUDIT on the output and fold any residual into src/crop_override.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
