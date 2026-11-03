#!/usr/bin/env python3
"""Prepare B-roll clips: HDR → SDR, native scale, no punch-ins.

THE HDR TRAP (references/hyperframes.md §colour). Modern phones shoot HLG/bt2020. If
those tags reach the composition, HyperFrames renders the WHOLE video as HEVC 10-bit
bt2020/arib-std-b67 — including the bt709 A-roll. Every player then applies an HDR→SDR
transform and the result is milky and desaturated. It reads as "a weird grade you
applied." Nothing was graded; the file was simply mislabelled.

ORDER MATTERS. Convert primaries to bt709 in LINEAR light, BEFORE the tonemap.
Tonemapping while still in bt2020 primaries and converting afterwards leaves everything
milky and hue-shifted — a second, separate bug from the container tags.

SCALE. No crop boxes on B-roll, no timeline scale on full-frame B-roll clips. A
2160x3840 phone clip is exactly 0.5x to 1080x1920, one to one. A screen recording gets
force_original_aspect_ratio=increase + crop, which fills the width at native scale and
only loses the status bar. Do not hand-author a crop box "to frame it better" — the
shot was framed on purpose.

Usage
  python3 scripts/prep_broll.py --probe  clips/*.mp4          # what is HDR, what is not
  python3 scripts/prep_broll.py --in clip.MOV --out assets/broll/b01.mp4 --start 3.75 --dur 3.28
  ... --camera            # HLG CAMERA footage only: the one authorised exposure fix
"""
import glob
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hfcfg  # noqa: E402

HDR_TAGS = ("bt2020", "arib-std-b67", "smpte2084")

TONEMAP = ("zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,"
           "tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv")

# The ONE authorised creative adjustment, and only for HLG CAMERA clips: even a correct
# tone-map lands them flat and bright. Use gamma<1, NOT negative brightness — brightness
# is a straight offset and crushes the black point (7-12% of pixels at <=3).
CAMERA_FIX = "eq=contrast=1.20:gamma=0.88:saturation=1.06"

SDR_FLAGS = ["-colorspace", "bt709", "-color_primaries", "bt709",
             "-color_trc", "bt709", "-color_range", "tv"]


def colour_of(path):
    out = hfcfg.probe(path, "stream=color_space,color_transfer,color_primaries", "v:0")
    return out.replace("\n", ",")


def is_hdr(path):
    return any(t in colour_of(path) for t in HDR_TAGS)


def dims(path):
    w = hfcfg.probe(path, "stream=width", "v:0")
    h = hfcfg.probe(path, "stream=height", "v:0")
    return int(w or 0), int(h or 0)


def main():
    ap = hfcfg.arg_parser(__doc__)
    ap.add_argument("--probe", nargs="*", help="report colour tags for these files and exit")
    ap.add_argument("--in", dest="src")
    ap.add_argument("--out", dest="dst")
    ap.add_argument("--start", type=float, default=0.0)
    ap.add_argument("--dur", type=float)
    ap.add_argument("--camera", action="store_true",
                    help="HLG CAMERA clip: apply the authorised exposure/contrast fix")
    ap.add_argument("--panel", action="store_true",
                    help="encode as a 1080x900 top panel instead of full frame")
    a = ap.parse_args()
    cfg = hfcfg.load(a.config)
    hfcfg.require("ffmpeg", "ffprobe")

    if a.probe is not None:
        files = a.probe or sorted(glob.glob("*.mp4") + glob.glob("*.MOV") + glob.glob("*.mov"))
        for f in files:
            w, h = dims(f)
            c = colour_of(f)
            tag = "HDR — tone-map it" if is_hdr(f) else "SDR bt709 — leave it alone"
            print(f"  {os.path.basename(f):40s} {w}x{h}  {c:34s} {tag}")
        return 0

    if not (a.src and a.dst):
        ap.error("--in and --out are required (or use --probe)")

    W, H = cfg["project"]["width"], cfg["project"]["height"]
    fps = cfg["project"]["fps"]
    sw, sh = dims(a.src)

    chain = []
    if is_hdr(a.src):
        chain.append(TONEMAP)
        if a.camera:
            chain.append(CAMERA_FIX)
    elif a.camera:
        print("  ! --camera on an SDR source: skipping. Screen recordings are native bt709 "
              "and correctly exposed — never touch them.")

    if a.panel:
        chain.append(f"scale={W}:900:force_original_aspect_ratio=increase,crop={W}:900")
    else:
        # native scale fit — fills the width, loses only the status bar / home indicator
        chain.append(f"scale={W}:{H}:force_original_aspect_ratio=increase:flags=lanczos,"
                     f"crop={W}:{H}")
    chain.append(f"fps={fps},setsar=1")

    cmd = ["ffmpeg", "-v", "error", "-y"]
    if a.start:
        cmd += ["-ss", f"{a.start:.4f}"]
    cmd += ["-i", a.src]
    if a.dur:
        cmd += ["-t", f"{a.dur:.4f}"]
    cmd += ["-vf", ",".join(chain), "-an",
            "-c:v", "libx264", "-crf", "16", "-preset", "medium", "-pix_fmt", "yuv420p"]
    cmd += SDR_FLAGS + [a.dst]

    os.makedirs(os.path.dirname(a.dst) or ".", exist_ok=True)
    r = hfcfg.run(cmd)
    if r.returncode:
        sys.exit(f"encode failed:\n{r.stderr}")

    out_c = colour_of(a.dst)
    bad = [t for t in HDR_TAGS if t in out_c]
    print(f"  {a.dst}  {sw}x{sh} → {W}x{'900' if a.panel else H}  {out_c}")
    if bad:
        sys.exit(f"  ✗ OUTPUT IS STILL HDR-TAGGED: {bad}")
    print("  ✓ SDR bt709")
    return 0


if __name__ == "__main__":
    sys.exit(main())
