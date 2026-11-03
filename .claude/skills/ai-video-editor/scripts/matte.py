#!/usr/bin/env python3
"""Rotoscope the speaker with Robust Video Matting → a VP9 alpha webm.

NEVER use a generic remove-background / u2net path — it bleeds on hair and beard.

The three settings that decide whether the matte looks professional or "lacking", all
in this script rather than in the model choice (references/layout.md §matting):

  downsample_ratio 0.25 → 0.45   0.25 runs the network at 270px wide on a 1080 frame
                                 and chews the hair edge. RVM wants the downsampled
                                 short side near 512px.
  crf 18 → 10                    crf 18 re-quantises the alpha edge away.
  mobilenetv3 → resnet50         ~3x slower, visibly cleaner hair.

Plus an alpha tighten that is NOT a hard threshold — it kills the gauzy halo but keeps
a real soft ramp for hair:  pha = smoothstep(clip((pha - floor) / span, 0, 1))

MATTE A WIDER SOURCE THAN THE FRAME whenever you intend to scale the roto down. If the
subject touches the frame edge in the source — a gesturing arm almost always does at
the bottom left — the alpha has a dead-straight cut at x=0. At native scale that cut IS
the frame edge and is invisible; at scale 0.80 it lands at x=108 and reads as a hard
mask crop. Pass --width 1292 (etc.) and hang it with a negative `left`.

Verify, don't assume:
    python3 scripts/matte.py --verify matte.webm
composites a frame over magenta (zoom the hairline: individual strands must resolve)
and reports the partial-alpha/solid ratio. ~0.017 is a good sharp matte; much larger
means the edge is still mushy.

Only matte the span you actually SHOW, and re-matte whenever the hook's in/out points move.
"""
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hfcfg  # noqa: E402


def verify(path, at=0.5):
    hfcfg.require_python("numpy")
    import numpy as np
    env = hfcfg.ffmpeg_env()
    # Reading a matte's alpha needs the EXPLICIT decoder — without -c:v libvpx-vp9
    # ffmpeg flattens alpha to 255 and every head-detector returns row 0.
    p = subprocess.run(["ffmpeg", "-v", "error", "-c:v", "libvpx-vp9", "-ss", str(at),
                        "-i", path, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgba", "-"],
                       capture_output=True, env=env)
    w = int(hfcfg.probe(path, "stream=width", "v:0") or 0)
    h = int(hfcfg.probe(path, "stream=height", "v:0") or 0)
    if not (w and h) or len(p.stdout) < w * h * 4:
        sys.exit("could not read a frame — is this a VP9 alpha webm?")
    fr = np.frombuffer(p.stdout[:w * h * 4], np.uint8).reshape(h, w, 4)
    a = fr[:, :, 3].astype(np.float32) / 255.0
    solid = (a > 0.95).sum()
    partial = ((a > 0.02) & (a <= 0.95)).sum()
    ratio = partial / max(1, solid)
    edge_col = a[:, 0]
    print(f"  {os.path.basename(path)}  {w}x{h}")
    print(f"  solid {solid}  partial {partial}  ratio {ratio:.4f}"
          f"   ({'sharp' if ratio < 0.030 else 'MUSHY — raise downsample_ratio, lower crf'})")
    print(f"  alpha at element x=0: max {edge_col.max():.3f}"
          f"   ({'clean' if edge_col.max() < 0.02 else 'SUBJECT TOUCHES THE EDGE — matte a wider source'})")
    out = os.path.splitext(path)[0] + "_check.png"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"color=c=magenta:s={w}x{h}",
                    "-c:v", "libvpx-vp9", "-ss", str(at), "-i", path,
                    "-filter_complex", "[0:v][1:v]overlay=0:0[v]", "-map", "[v]",
                    "-frames:v", "1", out], env=env, capture_output=True)
    print(f"  wrote {out} — zoom the hairline, individual strands must resolve")


def main():
    ap = hfcfg.arg_parser(__doc__)
    ap.add_argument("src", nargs="?", help="input video (the span you will actually show)")
    ap.add_argument("dst", nargs="?", help="output .webm")
    ap.add_argument("--width", type=int, help="source width (widen it if you will scale down)")
    ap.add_argument("--height", type=int)
    ap.add_argument("--verify", metavar="MATTE.WEBM")
    a = ap.parse_args()
    cfg = hfcfg.load(a.config)

    if a.verify:
        return verify(a.verify) or 0
    if not (a.src and a.dst):
        ap.error("src and dst are required (or use --verify)")
    if not os.path.exists(a.src):
        sys.exit(f"input not found: {a.src}")
    hfcfg.require("ffmpeg", "ffprobe")
    hfcfg.require_python("numpy", "torch")
    import numpy as np
    import torch

    m = cfg["matting"]
    W = a.width or cfg["project"]["width"]
    H = a.height or cfg["project"]["height"]
    fps = cfg["project"]["fps"]
    N = W * H * 3
    env = hfcfg.ffmpeg_env()

    dev = ("mps" if torch.backends.mps.is_available()
           else "cuda" if torch.cuda.is_available() else "cpu")
    print(f"  device={dev}  backbone={m['backbone']}  "
          f"downsample={m['downsample_ratio']}  crf={m['crf']}  {W}x{H}")
    if dev == "cpu":
        print("  ! CPU matting is very slow — expect minutes per second of footage")
    print(f"  loading RobustVideoMatting weights via torch.hub "
          f"(first run downloads ~100 MB to ~/.cache/torch, then cached)…", flush=True)
    model = torch.hub.load("PeterL1n/RobustVideoMatting", m["backbone"]).eval().to(dev)

    rd = subprocess.Popen(["ffmpeg", "-v", "error", "-i", a.src, "-vf", f"fps={fps}",
                           "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                          stdout=subprocess.PIPE, env=env)
    wr = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgba",
                           "-s", f"{W}x{H}", "-r", str(fps), "-i", "-",
                           "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "0",
                           "-crf", str(m["crf"]), "-auto-alt-ref", "0", a.dst],
                          stdin=subprocess.PIPE, env=env)

    floor, span = m["alpha_floor"], m["alpha_span"]
    rec, n = [None] * 4, 0
    with torch.no_grad():
        while True:
            buf = rd.stdout.read(N)
            if len(buf) < N:
                break
            frame = np.frombuffer(buf, np.uint8).reshape(H, W, 3).astype(np.float32) / 255.0
            src = torch.from_numpy(frame).permute(2, 0, 1)[None].to(dev)
            fgr, pha, *rec = model(src, *rec, downsample_ratio=m["downsample_ratio"])
            fgr = fgr[0].permute(1, 2, 0).float().cpu().numpy()
            pha = pha[0, 0].float().cpu().numpy()
            # tighten WITHOUT hard-thresholding: kills the gauzy halo, keeps a soft
            # ramp for hair
            t = np.clip((pha - floor) / span, 0.0, 1.0)
            pha = t * t * (3.0 - 2.0 * t)
            rgba = (np.clip(np.dstack([fgr, pha]), 0, 1) * 255).astype(np.uint8)
            wr.stdin.write(rgba.tobytes())
            n += 1
            if n % 50 == 0:
                print(f"  frame {n}", flush=True)
    wr.stdin.close()
    wr.wait()
    rd.wait()
    if n == 0:
        sys.exit(f"no frames decoded from {a.src}.\n"
                 f"  the source must be {W}x{H} — pass --width/--height if you matted a "
                 f"wider-than-frame source, and check the file actually has video.")
    print(f"  done {n} frames → {a.dst}")
    verify(a.dst)
    return 0


if __name__ == "__main__":
    sys.exit(main())
