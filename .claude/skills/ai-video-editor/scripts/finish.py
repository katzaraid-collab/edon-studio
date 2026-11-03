#!/usr/bin/env python3
"""Composite the caption layer onto the render and write the SDR master.

Two jobs:
  1. overlay assets/captions.webm (VP9 + alpha) onto the HyperFrames render
  2. force the master to 8-bit bt709 SDR H.264 — and ASSERT it

(2) matters because phone B-roll is HLG/bt2020, and when any HDR media is in the
composition HyperFrames renders HEVC 10-bit bt2020/HLG. Every player then applies an
HDR→SDR transform and the whole video looks washed out. The B-roll is tone-mapped at
build time (prep_broll.py) and this pass pins the container tags so nothing can
reintroduce it.
"""
import glob
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hfcfg  # noqa: E402

HDR_TAGS = ("bt2020", "arib-std-b67", "smpte2084")


def newest_render(d="renders"):
    c = [f for f in glob.glob(os.path.join(d, "*.mp4"))
         if os.path.basename(f) not in ("final.mp4", "base.mp4", "proof.mp4")]
    if not c:
        sys.exit(f"no HyperFrames render found in {d}/")
    return max(c, key=os.path.getmtime)


def main():
    ap = hfcfg.arg_parser(__doc__)
    ap.add_argument("base", nargs="?", help="the HyperFrames render (default: newest in renders/)")
    ap.add_argument("--captions", default="assets/captions.webm")
    ap.add_argument("--out", default="renders/final.mp4")
    ap.add_argument("--no-captions", action="store_true",
                    help="captions already live in the composition (verified non-ghosting)")
    a = ap.parse_args()
    cfg = hfcfg.load(a.config)
    hfcfg.require("ffmpeg", "ffprobe")

    base = a.base or newest_render()
    br = cfg["render"]["video_bitrate"]
    print(f"  base: {base}")

    cmd = ["ffmpeg", "-v", "error", "-y", "-i", base]
    if not a.no_captions:
        if not os.path.exists(a.captions):
            sys.exit(f"{a.captions} not found — run scripts/caption_layer.py "
                     f"(or pass --no-captions)")
        cmd += ["-c:v", "libvpx-vp9", "-i", a.captions,
                "-filter_complex",
                "[0:v]format=yuv420p[b];[1:v]format=yuva420p[c];"
                "[b][c]overlay=0:0:format=auto,format=yuv420p[v]",
                "-map", "[v]", "-map", "0:a"]
    else:
        cmd += ["-vf", "format=yuv420p", "-map", "0:v", "-map", "0:a"]

    maxrate = str(int(float(br.rstrip("Mm")) * 1.125)) + "M"
    bufsize = str(int(float(br.rstrip("Mm")) * 2)) + "M"
    cmd += ["-c:v", "libx264", "-preset", "slow", "-b:v", br,
            "-maxrate", maxrate, "-bufsize", bufsize, "-pix_fmt", "yuv420p",
            "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
            "-color_range", "tv", "-c:a", "copy", "-movflags", "+faststart", a.out]

    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    r = hfcfg.run(cmd)
    if r.returncode:
        sys.exit(f"master encode failed:\n{r.stderr}")

    q = hfcfg.run(["ffprobe", "-v", "error", "-select_streams", "v:0",
                   "-show_entries",
                   "stream=codec_name,pix_fmt,color_space,color_transfer,color_primaries",
                   "-show_entries", "format=duration,bit_rate",
                   "-of", "default=noprint_wrappers=1", a.out]).stdout
    print("\n" + q.strip())

    bad = [k for k in HDR_TAGS if k in q]
    if bad:
        sys.exit(f"\n  ✗ MASTER IS STILL HDR-TAGGED: {bad}")

    vol = hfcfg.run(["ffmpeg", "-nostdin", "-i", a.out, "-af", "volumedetect",
                     "-f", "null", "-"]).stderr
    m = re.search(r"max_volume: ([-0-9.]+) dB", vol)
    peak = float(m.group(1)) if m else None
    bit = re.search(r"bit_rate=(\d+)", q)
    mbps = int(bit.group(1)) / 1e6 if bit else 0

    print(f"\n  ✓ SDR bt709 — {a.out}")
    print(f"  bitrate {mbps:.1f} Mbps"
          f"{'' if mbps >= 28 else '   ← LOW, render with --video-bitrate ' + br}")
    if peak is not None:
        ok = -3.0 <= peak <= -0.6
        print(f"  audio peak {peak:+.1f} dBFS"
              f"{'' if ok else '   ← target -1 to -2 dB'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
