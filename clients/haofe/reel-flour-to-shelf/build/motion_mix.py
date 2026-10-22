"""Sound for the motion-design cut: music, bakery ambience, sound design, optional voiceover.

Every effect is placed so its peak lands on the visual event. With a voiceover
the music ducks under the voice (sidechain).

Usage: python3 -I motion_mix.py MUSIC.mp3 AMBIENT.wav SFX_DIR OUT.wav [--no-music] [--vo VO.wav]
"""
import subprocess
import sys
from pathlib import Path

args = sys.argv[1:]
music, ambient, sfx_dir, out = args[:4]
no_music = "--no-music" in args
vo = args[args.index("--vo") + 1] if "--vo" in args else None
SFX = Path(sfx_dir)
DUR = 44.0
MUSIC_START = 4.505   # the track's drop (8.505 s) lands on the 4.0 s cut

# (file, event time, peak offset inside the file, volume, trim [start, end] or None)
EVENTS = [
    ("790.mp3", 4.0, 2.49, 0.35, None),            # riser into the drop
    *[("3005.mp3", t, 0.02, 0.35, None) for t in (0.0, 0.5, 1.0, 1.5)],  # hook words land
    ("1092.mp3", 3.5, 0.0, 0.6, (0.19, 0.75)),     # tape rewind
    ("772.mp3", 4.0, 0.51, 0.7, None),             # drop impact
    ("168.mp3", 7.0, 0.32, 0.5, None),             # whip pushes between chapters
    ("1490.mp3", 9.0, 0.72, 0.45, None),
    ("2350.mp3", 15.05, 0.45, 0.25, None),         # sesame sparkle
    ("168.mp3", 15.0, 0.32, 0.5, None),
    ("1490.mp3", 18.0, 0.72, 0.45, None),
    ("1143.mp3", 20.0, 0.63, 0.55, None),          # oven impact
    ("168.mp3", 27.0, 0.32, 0.5, None),
    ("1490.mp3", 33.0, 0.72, 0.45, None),
    ("2902.mp3", 36.15, 1.27, 0.5, None),          # logo
    ("2350.mp3", 37.1, 0.14, 0.4, None),           # glint across the logo
    *[("2357.mp3", t, 0.04, 0.45, None) for t in (38.5, 39.0, 39.5, 40.0)],  # chain pills
]


def main():
    inputs, chains, labels = [], [], []
    idx = 0
    if not no_music:
        inputs += ["-i", music]
        chains.append(f"[{idx}:a]aresample=48000,atrim=start={MUSIC_START}:duration={DUR},asetpts=PTS-STARTPTS,"
                      f"afade=t=in:d=0.04,afade=t=out:st={DUR - 1.8}:d=1.8[m]")
        idx += 1
    inputs += ["-i", ambient]
    amb_vol = 0.10 if not no_music else 0.5
    chains.append(f"[{idx}:a]aresample=48000,apad,atrim=0:{DUR},highpass=f=140,lowpass=f=9000,"
                  f"acompressor=threshold=0.1:ratio=4:attack=5:release=120,"
                  f"volume='if(between(t,3.5,4.0),0.45,{amb_vol})':eval=frame,afade=t=out:st=35.5:d=1.0[amb]")
    labels.append("[amb]")
    idx += 1
    for k, (f, t, peak, vol, trim) in enumerate(EVENTS):
        inputs += ["-i", str(SFX / f)]
        start = max(0.0, t - peak)
        pre = f"atrim={trim[0]}:{trim[1]},asetpts=PTS-STARTPTS,afade=t=out:st={trim[1]-trim[0]-0.08:.2f}:d=0.08," if trim else ""
        cut = max(0.0, peak - t)  # an effect whose peak sits before 0 s gets its head trimmed
        if cut and not trim:
            pre = f"atrim=start={cut},asetpts=PTS-STARTPTS,"
        ms = int(round(start * 1000))
        chains.append(f"[{idx}:a]aresample=48000,aformat=channel_layouts=stereo,{pre}volume={vol},adelay={ms}|{ms}[s{k}]")
        labels.append(f"[s{k}]")
        idx += 1
    if vo:
        inputs += ["-i", vo]
        chains.append(f"[{idx}:a]aresample=48000,aformat=channel_layouts=stereo,apad,atrim=0:{DUR},"
                      f"highpass=f=80,acompressor=threshold=0.125:ratio=3:attack=5:release=80,volume=1.6"
                      + (",asplit=2[vo][vok]" if not no_music else "[vo]"))
        idx += 1
        if not no_music:
            chains.append("[m][vok]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=350:makeup=1[md]")
            labels.insert(0, "[md]")
        labels.append("[vo]")
    elif not no_music:
        labels.insert(0, "[m]")
    target = -14 if not no_music else -16
    chains.append(f"{''.join(labels)}amix=inputs={len(labels)}:normalize=0:duration=longest,atrim=0:{DUR},"
                  f"loudnorm=I={target}:TP=-1.5:LRA=9[out]")
    subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(chains),
                    "-map", "[out]", "-ar", "48000", "-c:a", "pcm_s16le", out], check=True)


if __name__ == "__main__":
    main()
