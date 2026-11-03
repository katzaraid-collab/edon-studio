#!/usr/bin/env python3
"""Render the caption cards to a transparent video layer, composited OUTSIDE the renderer.

Why: HyperFrames can leave the LAST clip of each CSS slot painted for the whole render
once a composition carries ~48 text clips — and snapshots do NOT show it, only the
encoded file does. Adding class="clip", alternating tracks and giving every caption its
own track all fail to fix it. See references/hyperframes.md.

The bug is not deterministic above 48 clips, so run `check_ghosting.py` on a draft
render before paying this cost blindly — a 53-caption composition has rendered clean.

Each card is drawn by headless Chrome (same CSS, same brand font, correct complex-script
shaping) into a 1080x1920 RGBA PNG; the stills are concatenated into a VP9 alpha webm on
the exact caption timings. No node, no puppeteer.

Bonus: re-timing a caption then costs an overlay pass instead of a full re-render.
"""
import glob
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hfcfg  # noqa: E402

beatmap, BEATS_PATH = hfcfg.load_beats()   # project copy wins over the skill's stub

PAGE = """<!doctype html><meta charset="utf-8">
<style>
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  html, body {{ width:{W}px; height:{H}px; background:transparent; overflow:hidden; }}
{faces}
  .cap {{ position:absolute; left:0; right:0; top:{top}px; text-align:center;
          direction:{dir}; font-family:"{family}", "Inter", Arial, sans-serif;
          font-weight:800; line-height:1.0; }}
  .cap .p {{ display:inline-block; color:{ink}; font-size:{size}px;
             background:{plate}; border-radius:22px; padding:20px 34px 26px;
             box-shadow:0 10px 34px rgba(0,0,0,0.42); white-space:nowrap; }}
  .ltr {{ unicode-bidi:isolate; direction:ltr; }}
</style>
<div class="cap"><span class="p">{text}</span></div>"""


def font_faces(font_dir, family):
    """@font-face blocks for whatever is in the font dir.

    A single file named after the family is treated as a VARIABLE font and gets the
    full 100-1000 range; without that Chrome clamps it to one instance and every
    weight in the composition renders identically.
    """
    faces, files = [], sorted(glob.glob(os.path.join(font_dir, "*.ttf")) +
                              glob.glob(os.path.join(font_dir, "*.otf")))
    if not files:
        return ""
    variable = [f for f in files
                if os.path.splitext(os.path.basename(f))[0].lower() == family.lower()]
    if variable:
        url = "file://" + os.path.abspath(variable[0])
        faces.append(f'  @font-face {{ font-family:"{family}"; src:url("{url}");'
                     f' font-weight:100 1000; }}')
        return "\n".join(faces)
    weights = {"thin": 100, "extralight": 200, "light": 300, "regular": 400, "medium": 500,
               "semibold": 600, "bold": 700, "extrabold": 800, "black": 900}
    for f in files:
        stem = os.path.splitext(os.path.basename(f))[0]
        suffix = stem.split("-")[-1].replace(" ", "").lower()
        w = weights.get(suffix, 400)
        url = "file://" + os.path.abspath(f)
        faces.append(f'  @font-face {{ font-family:"{family}"; src:url("{url}");'
                     f' font-weight:{w}; }}')
    return "\n".join(faces)


def shoot(chrome, html_path, png_path, w, h):
    r = subprocess.run(
        [chrome, "--headless", "--disable-gpu", "--hide-scrollbars", "--no-sandbox",
         "--allow-file-access-from-files", "--font-render-hinting=none",
         "--default-background-color=00000000", "--virtual-time-budget=1200",
         f"--screenshot={png_path}", f"--window-size={w},{h}",
         "file://" + os.path.abspath(html_path)],
        capture_output=True, text=True)
    if not os.path.exists(png_path):
        sys.exit(f"Chrome produced no screenshot for {html_path}\n{r.stderr[-800:]}")


def main():
    ap = hfcfg.arg_parser(__doc__)
    ap.add_argument("--captions", default="captions.json")
    ap.add_argument("--out", default="assets/captions.webm")
    ap.add_argument("--workdir", default="build/caps")
    a = ap.parse_args()
    cfg = hfcfg.load(a.config)
    hfcfg.require("ffmpeg", "ffprobe")

    W = cfg["project"]["width"]
    H = cfg["project"]["height"]
    fps = cfg["project"]["fps"]
    b = cfg["brand"]
    font_dir = b["font_dir"] if os.path.isdir(b["font_dir"]) else \
        os.path.join(hfcfg.SKILL_DIR, "assets", "fonts")
    faces = font_faces(font_dir, b["font_family"])
    if not faces:
        sys.exit(f"no fonts in {font_dir} — run scripts/setup_assets.py")

    caps = json.load(open(a.captions, encoding="utf-8"))
    html_dir = os.path.join(a.workdir, "html")
    png_dir = os.path.join(a.workdir, "png")
    os.makedirs(html_dir, exist_ok=True)
    os.makedirs(png_dir, exist_ok=True)
    chrome = hfcfg.chrome_path()

    for c in caps:
        # The slot comes from the beat map — never from a second, hand-kept table.
        top = beatmap.top_at(c["start"]) if beatmap and beatmap.BEATS else c.get("top", 1300)
        hp = os.path.join(html_dir, f"c{c['i']:03d}.html")
        with open(hp, "w", encoding="utf-8") as f:
            f.write(PAGE.format(W=W, H=H, faces=faces, top=top,
                                dir=cfg["language"]["direction"], family=b["font_family"],
                                ink=b["caption_ink"], size=b["caption_size"],
                                plate=b["caption_plate"], text=c["text"]))
        shoot(chrome, hp, os.path.join(png_dir, f"c{c['i']:03d}.png"), W, H)
    print(f"  rendered {len(caps)} cards")

    lst = os.path.join(a.workdir, "concat.txt")
    with open(lst, "w") as f:
        for c in caps:
            f.write(f"file '{os.path.abspath(png_dir)}/c{c['i']:03d}.png'\n")
            f.write(f"duration {c['dur']:.3f}\n")
        f.write(f"file '{os.path.abspath(png_dir)}/c{caps[-1]['i']:03d}.png'\n")

    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    r = hfcfg.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst,
                   "-vf", f"fps={fps},format=yuva420p",
                   "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "0", "-crf", "24",
                   "-auto-alt-ref", "0", a.out])
    if r.returncode:
        sys.exit(f"webm encode failed:\n{r.stderr}")

    dur = hfcfg.probe(a.out, "format=duration")
    want = caps[-1]["start"] + caps[-1]["dur"]
    print(f"  {a.out}  {float(dur or 0):.2f}s  ({len(caps)} cards, timeline ends {want:.2f}s)")
    if dur and abs(float(dur) - want) > 0.12:
        print(f"  ! layer length {float(dur):.2f}s vs caption timeline {want:.2f}s — "
              f"the overlay will drift; check captions.json durations")
    return 0


if __name__ == "__main__":
    sys.exit(main())
