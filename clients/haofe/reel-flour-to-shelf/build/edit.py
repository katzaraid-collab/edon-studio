"""HaOfe "from flour to shelf" reel: cut, grade and assemble the footage.

Every cut sits on the 120 BPM grid of the music (one beat = 0.5 s). The
groove drops at 4.0 s, right after the hook and the rewind. Every clip runs
at 1.25x or faster.

Usage: python3 -I edit.py RAW_DIR OUT_DIR [SHOT ...]
"""
import json
import subprocess
import sys
from pathlib import Path

RAW = Path(sys.argv[1])
OUT = Path(sys.argv[2])
SEGS = OUT / "segs"
SEGS.mkdir(parents=True, exist_ok=True)

FPS = 30
W, H = 1080, 1920
BEAT = 0.5
DROP = 4.0

# No grade: the footage plays in its original colours ("null" is ffmpeg's pass-through).
GRADE = "null"

# (name, start beat, length in beats, source, src_start, speed, options)
# Beat b of the grid sits at DROP + 0.5*b; the hook and rewind use negative beats.
SHOTS = [
    # hook: golden close-ups, slow push in
    ("01_hook", -8, 5, "IMG_0440", 17.1, 1.25, {"zoom": (1.0, 1.08)}),
    ("02_hook2", -3, 2, "IMG_2093", 5.6, 1.25, {"zoom": (1.05, 1.0)}),
    # rewind: the rack slides back into the oven at 7.2x
    ("03_rewind", -1, 1, "IMG_0440", 0.0, 7.2, {"reverse": 3.6}),
    ("04_mix", 0, 6, "IMG_0417", 0.3, 1.4, {}),
    ("05_divide", 6, 4, "IMG_0413", 2.0, 1.6, {}),
    ("06_braid", 10, 12, "IMG_1611", 8.6, 1.75, {}),
    ("07_sesame", 22, 6, "IMG_0452", 8.0, 1.4, {}),
    ("08_proof", 28, 4, "IMG_0431", 2.0, 1.25, {"zoom": (1.06, 1.0)}),
    ("09_oven", 32, 7, "IMG_0440", 0.0, 1.25, {}),
    ("10_round", 39, 3, "IMG_2093", 3.6, 1.25, {"zoom": (1.0, 1.06)}),
    ("11_photo", 42, 4, "IMG_0448.jpg", 0, 1.0, {"still": (1.2, 1.0)}),
    ("12_wrap", 46, 5, "IMG_2102", 0.0, 1.25, {}),
    ("13_stack", 51, 2, "IMG_1195", 0.0, 1.3, {}),
    ("14_label", 53, 3, "IMG_1194", 5.75, 1.25, {}),
    ("15_box", 56, 2, "IMG_2105", 2.0, 1.25, {}),
    ("16_shelf", 58, 3, "IMG_3189", 4.6, 1.25, {"zoom": (1.0, 1.04)}),
    ("17_store", 61, 3, "IMG_3191", 0.2, 1.25, {}),
    # the store shot carries on under the end card, blurred, then holds its last frame
    ("18_end", 64, 12, "IMG_3191", 2.075, 1.25, {"endcard_blur_at": 0.0, "hold": True}),
]


def t_of(beat):
    return round(DROP + BEAT * beat, 3)


def run(cmd):
    print(" ".join(str(c) for c in cmd[:12]), "...", flush=True)
    subprocess.run(cmd, check=True)


def zoom_filter(z0, z1, frames):
    # Upscale 2x first so zoompan's integer crop offsets don't visibly jitter.
    return (
        f"scale={W*2}:{H*2}:flags=lanczos,"
        f"zoompan=z='{z0}+({z1}-{z0})*on/{max(frames-1,1)}':"
        f"x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={W}x{H}:fps={FPS}"
    )


def build_shot(name, start_b, len_b, src, ss, speed, opt):
    dur = round(len_b * BEAT, 3)
    frames = round(dur * FPS)
    vout = SEGS / f"{name}.mp4"
    aout = SEGS / f"{name}.wav"
    src_dur = dur * speed

    if "still" in opt:
        z0, z1 = opt["still"]
        vf = (
            f"scale={W*3}:{H*3}:flags=lanczos,"
            f"zoompan=z='{z0}+({z1}-{z0})*on/{frames-1}':"
            f"x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s={W}x{H}:fps={FPS},"
            f"{GRADE},format=yuv420p"
        )
        run(["ffmpeg", "-v", "error", "-y", "-i", RAW / src, "-vf", vf,
             "-frames:v", str(frames), "-c:v", "libx264", "-crf", "14", "-preset", "medium",
             "-r", str(FPS), vout])
        run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i",
             f"anullsrc=r=48000:cl=stereo", "-t", str(dur), aout])
        return dur

    vin = RAW / f"{src}.mov"
    if "reverse" in opt:
        span = opt["reverse"]
        vf = (f"trim=0:{span},setpts=PTS-STARTPTS,reverse,setpts=PTS/{speed},"
              f"fps={FPS},scale={W}:{H},{GRADE},format=yuv420p")
        af = (f"atrim=0:{span},asetpts=PTS-STARTPTS,areverse,atempo=2,atempo=2,atempo=1.8,"
              f"apad,atrim=0:{dur},afade=t=in:d=0.02,afade=t=out:st={dur-0.03}:d=0.03")
        run(["ffmpeg", "-v", "error", "-y", "-i", vin, "-vf", vf, "-af", af,
             "-frames:v", str(frames), "-c:v", "libx264", "-crf", "14", "-preset", "medium",
             "-an", vout])
        run(["ffmpeg", "-v", "error", "-y", "-i", vin, "-vn", "-af", af, "-ar", "48000",
             "-ac", "2", aout])
        return dur

    chain = f"setpts=(PTS-STARTPTS)/{speed}"
    if speed < 1:
        chain += f",framerate=fps={FPS}"
    chain += f",fps={FPS},scale={W}:{H}:flags=lanczos"
    if opt.get("hold"):
        chain += f",tpad=stop_mode=clone:stop_duration={dur}"
    if "zoom" in opt:
        chain += "," + zoom_filter(*opt["zoom"], frames)
    chain += f",{GRADE}"

    if "endcard_blur_at" in opt:
        b = opt["endcard_blur_at"]
        vf = (f"{chain},split[s][b];[b]gblur=sigma=28,eq=brightness=-0.04,format=yuva420p,"
              f"fade=t=in:st={b}:d=0.6:alpha=1[bb];[s][bb]overlay=format=auto,format=yuv420p")
    else:
        vf = f"{chain},format=yuv420p"

    tempo = []
    s = speed
    while s > 2.0:
        tempo.append("atempo=2.0")
        s /= 2.0
    while s < 0.5:
        tempo.append("atempo=0.5")
        s /= 0.5
    tempo.append(f"atempo={s:.5f}")
    af = (",".join(tempo) + f",apad,atrim=0:{dur},"
          f"afade=t=in:d=0.02,afade=t=out:st={dur-0.03:.3f}:d=0.03")

    run(["ffmpeg", "-v", "error", "-y", "-ss", str(ss), "-t", f"{src_dur + 0.5:.3f}",
         "-i", vin, "-filter_complex", vf, "-frames:v", str(frames),
         "-c:v", "libx264", "-crf", "14", "-preset", "medium", "-an", vout])
    run(["ffmpeg", "-v", "error", "-y", "-ss", str(ss), "-t", f"{src_dur + 0.5:.3f}",
         "-i", vin, "-vn", "-af", af, "-ar", "48000", "-ac", "2", aout])
    return dur


def main():
    only = set(sys.argv[3:])
    timeline = []
    cursor = 0.0
    for shot in SHOTS:
        name, start_b, len_b = shot[0], shot[1], shot[2]
        start = t_of(start_b)
        assert abs(start - cursor) < 1e-6, (name, start, cursor)
        if not only or name in only:
            build_shot(*shot)
        dur = round(len_b * BEAT, 3)
        timeline.append({"name": name, "start": start, "dur": dur})
        cursor = round(start + dur, 3)

    (OUT / "timeline.json").write_text(json.dumps(timeline, indent=1))
    with open(OUT / "vlist.txt", "w") as f:
        for t in timeline:
            f.write(f"file '{SEGS / (t['name'] + '.mp4')}'\n")
    with open(OUT / "alist.txt", "w") as f:
        for t in timeline:
            f.write(f"file '{SEGS / (t['name'] + '.wav')}'\n")
    run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", OUT / "vlist.txt",
         "-c", "copy", OUT / "base.mp4"])
    run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", OUT / "alist.txt",
         "-c:a", "pcm_s16le", OUT / "ambient.wav"])
    print("total", cursor)


if __name__ == "__main__":
    main()
