"""Motion-design version: pull source frames and write the shot timeline.

The browser compositor (motion/index.html) builds every output frame from
these JPEGs, so speed ramps, reverse, holds and camera moves all happen there.
The music runs at 120 BPM with the drop at 4.0 s; shot starts match the
earlier cut. The end card is 6 s.

Usage: python3 -I motion_prep.py RAW_DIR MOTION_DIR
"""
import json
import subprocess
import sys
from pathlib import Path

RAW = Path(sys.argv[1])
MOTION = Path(sys.argv[2])
FRAMES = MOTION / "frames"
FPS = 30

# key: (clip, start s, length s) -- native 30 fps, upright, 1080x1920
SOURCES = {
    "hook": ("IMG_0440", 17.1, 3.2),
    "hook2": ("IMG_2093", 5.6, 1.3),
    "oven": ("IMG_0440", 0.0, 6.6),
    "mix": ("IMG_0417", 0.3, 4.3),
    "divide": ("IMG_0413", 2.0, 3.3),
    "braid": ("IMG_1611", 8.6, 10.6),
    "sesame": ("IMG_0452", 8.0, 4.3),
    "proof": ("IMG_0431", 2.0, 2.6),
    "round": ("IMG_2093", 3.6, 1.95),
    "wrap": ("IMG_2102", 0.0, 3.2),
    "stack": ("IMG_1195", 0.0, 1.4),
    "label": ("IMG_1194", 5.75, 1.95),
    "box": ("IMG_2105", 2.0, 1.35),
    "shelf": ("IMG_3189", 4.6, 1.95),
    "store": ("IMG_3191", 0.2, 4.0),
}

# speed: [[t_rel, speed], ...] linear between keys; every key is >= 1.25x.
# kb: Ken Burns [scale0, scale1, x0, x1, y0, y1] (x/y in % of frame).
# cut: how the shot comes in -- "push" (whip push, chapter change),
# "punch" (hard cut + settle), "impact" (punch + flash), "hard".
SHOTS = [
    dict(name="hook", t0=0.0, t1=2.5, src="hook", speed=[[0, 1.25]], kb=[1.04, 1.12, 0, 0, 0, -1], cut="hard"),
    dict(name="hook2", t0=2.5, t1=3.5, src="hook2", speed=[[0, 1.25]], kb=[1.1, 1.02, 0, 0, 0, 0], cut="punch"),
    dict(name="rewind", t0=3.5, t1=4.0, src="oven", reverse=[3.6, 7.2], kb=[1, 1, 0, 0, 0, 0], cut="hard"),
    dict(name="mix", t0=4.0, t1=7.0, src="mix", speed=[[0, 1.4]], kb=[1.0, 1.06, 0, 0, 0, 0], cut="impact"),
    dict(name="divide", t0=7.0, t1=9.0, src="divide", speed=[[0, 1.6]], kb=[1.02, 1.08, 0, 0, 0, 0], cut="push"),
    dict(name="braid", t0=9.0, t1=15.0, src="braid", speed=[[0, 1.75]], kb=[1.0, 1.08, 0, -1, 0, 0], cut="push"),
    dict(name="sesame", t0=15.0, t1=18.0, src="sesame", speed=[[0, 1.4]], kb=[1.0, 1.06, 0, 0, 0, 0], cut="push"),
    dict(name="proof", t0=18.0, t1=20.0, src="proof", speed=[[0, 1.25]], kb=[1.08, 1.0, 0, 0, 0, 0], cut="push"),
    dict(name="oven", t0=20.0, t1=23.5, src="oven",
         speed=[[0, 1.25], [0.9, 1.25], [1.3, 3.2], [2.0, 3.2], [2.4, 1.25], [3.5, 1.25]],
         kb=[1.0, 1.06, 0, 0, 0, 0], cut="impact"),
    dict(name="round", t0=23.5, t1=25.0, src="round", speed=[[0, 1.25]], kb=[1.02, 1.1, 0, 0, 0, 0], cut="punch"),
    dict(name="photo", t0=25.0, t1=27.0, src="@photo", kb=[1.22, 1.0, 0, 0, -2, 0], cut="punch"),
    dict(name="wrap", t0=27.0, t1=29.5, src="wrap", speed=[[0, 1.25]], kb=[1.0, 1.05, 0, 0, 0, 0], cut="push"),
    dict(name="stack", t0=29.5, t1=30.5, src="stack", speed=[[0, 1.3]], kb=[1.04, 1.0, 0, 0, 0, 0], cut="punch"),
    dict(name="label", t0=30.5, t1=32.0, src="label", speed=[[0, 1.25]], kb=[1.0, 1.06, 0, 0, 0, 0], cut="punch"),
    dict(name="box", t0=32.0, t1=33.0, src="box", speed=[[0, 1.25]], kb=[1.06, 1.0, 0, 0, 0, 0], cut="punch"),
    dict(name="shelf", t0=33.0, t1=34.5, src="shelf", speed=[[0, 1.25]], kb=[1.0, 1.06, 0, 0, 0, 0], cut="push"),
    dict(name="store", t0=34.5, t1=36.0, src="store", speed=[[0, 1.25]], kb=[1.0, 1.04, 0, 0, 0, 0], cut="punch"),
    # carries on from the store shot (offset 1.875 s) and holds its last frame under the end card
    dict(name="end", t0=36.0, t1=42.0, src="store", offset=1.875, speed=[[0, 1.25]], kb=[1.04, 1.1, 0, 0, 0, 0], cut="hard"),
]

CHAPTERS = [
    dict(t0=4.0, t1=7.0, title="לישה", fx="knead"),
    dict(t0=7.0, t1=9.0, title="חלוקה", fx="divide"),
    dict(t0=9.0, t1=15.0, title="קליעה ביד", fx="braid"),
    dict(t0=15.0, t1=18.0, title="שומשום", fx="sesame"),
    dict(t0=18.0, t1=20.0, title="התפחה", fx="rise"),
    dict(t0=20.0, t1=27.0, title="אפייה", fx="heat", sub="זהובה, ישר מהתנור", subAt=21.0),
    dict(t0=27.0, t1=33.0, title="אריזה", fx="box"),
    dict(t0=33.0, t1=36.0, title="על המדף", fx="shelf"),
]


def main():
    counts = {}
    for key, (clip, ss, dur) in SOURCES.items():
        out = FRAMES / key
        out.mkdir(parents=True, exist_ok=True)
        if not any(out.iterdir()):
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(ss), "-t", str(dur),
                            "-i", RAW / f"{clip}.mov", "-vf", "scale=1080:1920:flags=lanczos",
                            "-q:v", "2", "-start_number", "0", out / "%04d.jpg"], check=True)
        counts[key] = len(list(out.glob("*.jpg")))
        print(key, counts[key], flush=True)
    timeline = dict(fps=FPS, duration=42.0, drop=4.0, endAt=36.0,
                    sources=counts, shots=SHOTS, chapters=CHAPTERS)
    (MOTION / "timeline.js").write_text(
        "window.TIMELINE = " + json.dumps(timeline, ensure_ascii=False, indent=1) + ";\n",
        encoding="utf-8")


if __name__ == "__main__":
    main()
