#!/usr/bin/env python3
"""One-time asset setup for the AI Video Editor skill.

Creates everything the pipeline needs, and NOTHING that is not free to redistribute:

  assets/fonts/   an OFL variable caption face (Rubik by default) — Latin + Hebrew +
                  Cyrillic + Greek, weights 300-900. Override with --font-dir.
  assets/sfx/     risers, booms, whooshes, shutters, impacts, pops, clicks, a cash cue
                  and three tier cues — all SYNTHESISED here, normalised to -6 dBFS peak.
                  No licence, no attribution, no takedown risk.
  assets/flares/  two vertical anamorphic lens-flare clips for the hook transition,
                  generated procedurally, ready to screen-blend.
  assets/vendor/  gsap.min.js, fetched at setup time (never redistributed with the skill).

Pure standard library apart from ffmpeg (used only for the flare clips). Run once:

    python3 scripts/setup_assets.py
    python3 scripts/setup_assets.py --font-dir ~/Library/Fonts --only fonts
"""
import argparse
import math
import os
import random
import shutil
import struct
import subprocess
import sys
import urllib.error
import urllib.request
import wave
import zlib

SKILL_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(SKILL_DIR, "assets")
SR = 48000
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"}

# Google Fonts, SIL Open Font License 1.1 — free to use, embed and redistribute.
FONTS = {
    "Rubik": [
        "https://raw.githubusercontent.com/google/fonts/main/ofl/rubik/Rubik%5Bwght%5D.ttf",
        "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/rubik/Rubik%5Bwght%5D.ttf",
    ],
    "Inter": [
        "https://raw.githubusercontent.com/google/fonts/main/ofl/inter/Inter%5Bopsz,wght%5D.ttf",
        "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/inter/Inter%5Bopsz,wght%5D.ttf",
    ],
}
GSAP = ["https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js",
        "https://unpkg.com/gsap@3/dist/gsap.min.js"]


def say(msg):
    print(msg, flush=True)


def fetch(urls, dest):
    for u in urls:
        try:
            req = urllib.request.Request(u, headers=UA)
            with urllib.request.urlopen(req, timeout=45) as r:
                data = r.read()
            if len(data) < 2048:
                continue
            with open(dest, "wb") as f:
                f.write(data)
            return True
        except (urllib.error.URLError, TimeoutError, OSError):
            continue
    return False


# ============================================================== audio synthesis
#
# Everything below is built from noise, sines and one-pole filters. It is not
# trying to be a sample library — it is trying to be a set of cues that sit
# correctly in a mix and that nobody owns.

def _env(n, attack, decay, curve=2.0):
    """Percussive envelope: fast attack, exponential decay."""
    a = max(1, int(attack * SR))
    out = []
    for i in range(n):
        if i < a:
            out.append((i / a) ** 0.6)
        else:
            t = (i - a) / max(1, decay * SR)
            out.append(math.exp(-curve * t))
    return out


def _noise(n, seed=0):
    rng = random.Random(seed)
    return [rng.uniform(-1.0, 1.0) for _ in range(n)]


def _lowpass_sweep(x, f0, f1, res=0.0):
    """One-pole lowpass whose cutoff sweeps f0 -> f1 across the buffer."""
    n = len(x)
    out = [0.0] * n
    y = 0.0
    prev = 0.0
    for i in range(n):
        t = i / max(1, n - 1)
        f = f0 * (f1 / f0) ** t
        a = 1.0 - math.exp(-2.0 * math.pi * f / SR)
        y += a * (x[i] - y)
        out[i] = y + res * (y - prev)
        prev = y
    return out


def _highpass(x, f):
    a = math.exp(-2.0 * math.pi * f / SR)
    out = [0.0] * len(x)
    prev_x = prev_y = 0.0
    for i, v in enumerate(x):
        y = a * (prev_y + v - prev_x)
        out[i] = y
        prev_x, prev_y = v, y
    return out


def _normalise(x, peak_db=-6.0):
    p = max(abs(v) for v in x) or 1.0
    target = 10 ** (peak_db / 20.0)
    g = target / p
    return [v * g for v in x]


def _write_wav(path, mono, peak_db=-6.0):
    mono = _normalise(mono, peak_db)
    frames = bytearray()
    for v in mono:
        s = int(max(-1.0, min(1.0, v)) * 32767)
        frames += struct.pack("<hh", s, s)      # stereo, identical channels
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(bytes(frames))


def sfx_riser(dur=1.7, seed=1):
    """Rising noise sweep + rising sine + accelerating tremolo. Silent tail: none —
    the audible tail ends exactly at the end of the file, which is what makes
    `start = cut - duration` correct for this cue."""
    n = int(dur * SR)
    noise = _noise(n, seed)
    swept = _lowpass_sweep(noise, 260.0, 9000.0)
    out = [0.0] * n
    phase = 0.0
    for i in range(n):
        t = i / n
        f = 110.0 * (7.5 ** t)
        phase += 2 * math.pi * f / SR
        trem = 1.0 - 0.35 * (0.5 + 0.5 * math.cos(2 * math.pi * (6 + 34 * t) * i / SR))
        amp = t ** 1.7
        out[i] = (swept[i] * 0.85 + math.sin(phase) * 0.45) * amp * trem
    # short fade-in so it does not click in
    fi = int(0.02 * SR)
    for i in range(fi):
        out[i] *= i / fi
    return out


def sfx_boom(dur=1.1):
    n = int(dur * SR)
    env = _env(n, 0.002, 0.26, curve=3.2)
    out = [0.0] * n
    p1 = p2 = 0.0
    for i in range(n):
        t = i / n
        f = 62.0 * math.exp(-2.4 * t) + 28.0        # pitch drop
        p1 += 2 * math.pi * f / SR
        p2 += 2 * math.pi * (f * 1.5) / SR
        out[i] = (math.sin(p1) + 0.28 * math.sin(p2)) * env[i]
    click = _lowpass_sweep(_noise(int(0.03 * SR), 7), 4000.0, 400.0)
    for i, v in enumerate(click):
        out[i] += v * 0.25 * (1 - i / len(click))
    return out


def sfx_whoosh(dur=0.5, low=True, seed=3):
    """Bass-heavy whoosh — the reveal cue. Spectral tilt is what makes it read as
    'low whoosh' rather than 'camera click'."""
    n = int(dur * SR)
    noise = _noise(n, seed)
    if low:
        body = _lowpass_sweep(noise, 1800.0, 180.0)
    else:
        body = _highpass(_lowpass_sweep(noise, 900.0, 5200.0), 400.0)
    out = []
    for i, v in enumerate(body):
        t = i / n
        amp = math.sin(math.pi * min(1.0, t * 1.15)) ** 1.4
        out.append(v * amp)
    if low:                                        # add a sub thump under it
        p = 0.0
        env = _env(n, 0.01, 0.16, 3.0)
        for i in range(n):
            p += 2 * math.pi * (70.0 - 26.0 * i / n) / SR
            out[i] += math.sin(p) * env[i] * 0.5
    return out


def sfx_shutter(dur=0.20):
    """Mechanical two-part click — mirror up, mirror down."""
    n = int(dur * SR)
    out = [0.0] * n
    for offset, gain, bright in ((0.0, 1.0, 6500.0), (0.055, 0.72, 4200.0)):
        s = int(offset * SR)
        seg = _highpass(_lowpass_sweep(_noise(int(0.035 * SR), 11 + s), bright, 900.0), 700.0)
        e = _env(len(seg), 0.0005, 0.012, 5.0)
        for i, v in enumerate(seg):
            if s + i < n:
                out[s + i] += v * e[i] * gain
    return out


def sfx_shutter_impact(dur=0.62):
    """Shutter + flash + boom, layered — the hook-transition impact."""
    n = int(dur * SR)
    out = [0.0] * n
    sh = sfx_shutter(0.20)
    for i, v in enumerate(sh):
        out[i] += v * 0.85
    bm = sfx_boom(0.55)
    for i, v in enumerate(bm):
        if i < n:
            out[i] += v * 0.9
    flash = _highpass(_noise(int(0.09 * SR), 21), 2500.0)
    fe = _env(len(flash), 0.001, 0.03, 4.0)
    for i, v in enumerate(flash):
        out[i] += v * fe[i] * 0.5
    return out


def sfx_pop(dur=0.24):
    """Cartoon pop — a fast upward pitch bend with a wet body."""
    n = int(dur * SR)
    env = _env(n, 0.004, 0.055, 4.5)
    out = [0.0] * n
    p = 0.0
    for i in range(n):
        t = i / n
        f = 220.0 + 900.0 * (t ** 0.45)
        p += 2 * math.pi * f / SR
        out[i] = (math.sin(p) + 0.25 * math.sin(2 * p)) * env[i]
    return out


def sfx_click(dur=0.05):
    n = int(dur * SR)
    seg = _highpass(_noise(n, 33), 1400.0)
    env = _env(n, 0.0003, 0.006, 6.0)
    return [v * e for v, e in zip(seg, env)]


def sfx_cash(dur=0.95):
    """Register cue: a bell cluster over a drawer thunk."""
    n = int(dur * SR)
    out = [0.0] * n
    for k, (f, g, d) in enumerate(((1180.0, 1.0, 0.42), (1567.0, 0.66, 0.36),
                                   (2350.0, 0.42, 0.28), (3140.0, 0.24, 0.20))):
        s = int(k * 0.012 * SR)
        env = _env(n - s, 0.001, d, 2.2)
        p = 0.0
        for i in range(n - s):
            p += 2 * math.pi * f / SR
            out[s + i] += math.sin(p) * env[i] * g * 0.5
    thunk = sfx_boom(0.42)
    for i, v in enumerate(thunk):
        if i < n:
            out[i] += v * 0.35
    return out


def sfx_tier(level, dur=0.42):
    """Three list cues: down / mid / up. Same timbre, different melodic direction,
    so no tier jumps out of the mix (they are all normalised to the same peak)."""
    steps = {"down": (660.0, 440.0), "mid": (550.0, 550.0), "up": (523.0, 784.0)}[level]
    n = int(dur * SR)
    out = [0.0] * n
    for k, f in enumerate(steps):
        s = int(k * 0.11 * SR)
        env = _env(n - s, 0.004, 0.13, 3.0)
        p = 0.0
        for i in range(n - s):
            p += 2 * math.pi * f / SR
            out[s + i] += (math.sin(p) + 0.2 * math.sin(3 * p)) * env[i] * 0.6
    return out


SFX = {
    "riser_long.wav":     lambda: sfx_riser(1.70, 1),
    "riser_short.wav":    lambda: sfx_riser(0.90, 5),
    "boom.wav":           lambda: sfx_boom(1.10),
    "whoosh_low.wav":     lambda: sfx_whoosh(0.50, True),
    "whoosh_high.wav":    lambda: sfx_whoosh(0.42, False),
    "shutter.wav":        lambda: sfx_shutter(0.20),
    "shutter_impact.wav": lambda: sfx_shutter_impact(0.62),
    "pop.wav":            lambda: sfx_pop(0.24),
    "click.wav":          lambda: sfx_click(0.05),
    "cash.wav":           lambda: sfx_cash(0.95),
    "tier_down.wav":      lambda: sfx_tier("down"),
    "tier_mid.wav":       lambda: sfx_tier("mid"),
    "tier_up.wav":        lambda: sfx_tier("up"),
}


# ================================================================= flare clips

def _png(path, w, h, rgb):
    """Minimal PNG writer — no PIL dependency. rgb is a flat bytearray of w*h*3."""
    raw = bytearray()
    for y in range(h):
        raw.append(0)                                   # filter type 0
        raw += rgb[y * w * 3:(y + 1) * w * 3]

    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    hdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", hdr))
        f.write(chunk(b"IDAT", zlib.compress(bytes(raw), 6)))
        f.write(chunk(b"IEND", b""))


def _flare_png(path, w, h, variant):
    """A near-white anamorphic flare on black, ready to screen-blend and hue-rotate.

    Both axes are normalised by WIDTH so the geometry is isotropic in pixels — normalising
    dy by height is what turns an anamorphic streak into a four-point star.
    """
    cx = w * 0.5
    cy = h * (0.42 if variant == 1 else 0.55)
    buf = bytearray(w * h * 3)
    # (offset along the streak axis, vertical drift, size) — lens ghosts
    ghosts = ([(0.34, 0.010, 0.052), (-0.27, -0.008, 0.038), (0.55, 0.018, 0.028)]
              if variant == 2 else [(0.38, 0.012, 0.046), (-0.31, -0.006, 0.032)])
    for y in range(h):
        dy = (y - cy) / w                       # width units on BOTH axes
        for x in range(w):
            dx = (x - cx) / w
            r2 = dx * dx + dy * dy
            # wide thin anamorphic streak + a brighter thinner core
            streak = math.exp(-(dx * dx) / 0.115) * math.exp(-(dy * dy) / 0.00022)
            core = math.exp(-(dx * dx) / 0.030) * math.exp(-(dy * dy) / 0.00005) * 0.9
            bloom = math.exp(-r2 / 0.0026) * 1.10
            halo = math.exp(-r2 / 0.030) * 0.26
            v = streak + core + bloom + halo
            for gx, gy, gs in ghosts:
                g2 = (dx - gx) ** 2 + (dy - gy) ** 2
                v += math.exp(-g2 / (gs * gs)) * 0.20
            v = min(1.0, v)
            i = (y * w + x) * 3
            buf[i] = int(255 * min(1.0, v * 1.00))       # slightly warm, tints cleanly
            buf[i + 1] = int(255 * min(1.0, v * 0.955))
            buf[i + 2] = int(255 * min(1.0, v * 0.90))
    _png(path, w, h, buf)


def build_flares(outdir, env):
    os.makedirs(outdir, exist_ok=True)
    ok = True
    for variant in (1, 2):
        png = os.path.join(outdir, f"_flare{variant}.png")
        mp4 = os.path.join(outdir, f"flare{variant}_v.mp4")
        _flare_png(png, 540, 960, variant)
        # scale sweep 1.6 -> 1.0 with a fade-out, exactly what the hook turn wants.
        # zoompan pans from the TOP-LEFT unless x/y are given — without them the flare
        # slides out of frame as it scales.
        vf = ("scale=1080:1920:flags=lanczos,"
              "zoompan=z='1.62-0.62*on/29'"
              ":x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
              ":d=30:s=1080x1920:fps=25,"
              "gblur=sigma=2.0,fade=t=out:st=0.60:d=0.60,format=yuv420p")
        r = subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-loop", "1", "-i", png, "-t", "1.2",
             "-vf", vf, "-r", "25", "-c:v", "libx264", "-crf", "16", "-preset", "medium",
             "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
             "-color_range", "tv", mp4],
            env=env, capture_output=True, text=True)
        if r.returncode != 0:
            say(f"  ! flare{variant} failed: {r.stderr.strip().splitlines()[-1:]}")
            ok = False
        os.remove(png)
    return ok


# ======================================================================= main

def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--font", default="Rubik", choices=sorted(FONTS),
                    help="which OFL face to fetch (default: Rubik — has Hebrew)")
    ap.add_argument("--font-dir", help="use your own .ttf/.otf files from this directory instead")
    ap.add_argument("--only", choices=["fonts", "sfx", "flares", "vendor"],
                    help="build only one group")
    ap.add_argument("--force", action="store_true", help="rebuild assets that already exist")
    a = ap.parse_args()

    env = dict(os.environ)
    local = os.path.expanduser("~/.local/bin")
    if os.path.isdir(local):
        env["PATH"] = local + os.pathsep + env["PATH"]

    groups = [a.only] if a.only else ["fonts", "sfx", "flares", "vendor"]
    os.makedirs(ASSETS, exist_ok=True)
    problems = []

    # ---------------------------------------------------------------- fonts
    if "fonts" in groups:
        fdir = os.path.join(ASSETS, "fonts")
        os.makedirs(fdir, exist_ok=True)
        if a.font_dir:
            src = os.path.expanduser(a.font_dir)
            n = 0
            for f in sorted(os.listdir(src)):
                if f.lower().endswith((".ttf", ".otf")):
                    shutil.copy2(os.path.join(src, f), os.path.join(fdir, f))
                    n += 1
            say(f"fonts   : copied {n} face(s) from {src}")
            if not n:
                problems.append(f"no .ttf/.otf found in {src}")
        else:
            dest = os.path.join(fdir, f"{a.font}.ttf")
            if os.path.exists(dest) and not a.force:
                say(f"fonts   : {a.font}.ttf already present")
            elif fetch(FONTS[a.font], dest):
                kb = os.path.getsize(dest) // 1024
                say(f"fonts   : {a.font}.ttf ({kb} KB, OFL 1.1) — variable, weights 300-900")
            else:
                problems.append(f"could not download {a.font}; use --font-dir with your own face")

    # ------------------------------------------------------------------ sfx
    if "sfx" in groups:
        sdir = os.path.join(ASSETS, "sfx")
        os.makedirs(sdir, exist_ok=True)
        made = 0
        for name, fn in SFX.items():
            path = os.path.join(sdir, name)
            if os.path.exists(path) and not a.force:
                continue
            _write_wav(path, fn(), peak_db=-6.0)
            made += 1
        say(f"sfx     : {made} synthesised, {len(SFX)} total in assets/sfx (peak -6 dBFS)")

    # --------------------------------------------------------------- flares
    if "flares" in groups:
        fldir = os.path.join(ASSETS, "flares")
        have = os.path.exists(os.path.join(fldir, "flare2_v.mp4"))
        if have and not a.force:
            say("flares  : already present")
        elif not shutil.which("ffmpeg", path=env["PATH"]):
            problems.append("ffmpeg not found — skipped flare generation")
        elif build_flares(fldir, env):
            say("flares  : flare1_v.mp4 + flare2_v.mp4 (1080x1920, 1.2s, screen-blend)")
        else:
            problems.append("flare generation failed")

    # --------------------------------------------------------------- vendor
    if "vendor" in groups:
        vdir = os.path.join(ASSETS, "vendor")
        os.makedirs(vdir, exist_ok=True)
        dest = os.path.join(vdir, "gsap.min.js")
        if os.path.exists(dest) and not a.force:
            say("vendor  : gsap.min.js already present")
        elif fetch(GSAP, dest):
            say(f"vendor  : gsap.min.js ({os.path.getsize(dest)//1024} KB)")
        else:
            problems.append("could not download gsap.min.js — fetch it manually into "
                            "assets/vendor/ (a CDN load times the renderer out)")

    say("")
    say(f"assets root: {ASSETS}")
    if problems:
        say("\nnot everything landed:")
        for p in problems:
            say(f"  ! {p}")
        say("\nNetwork is only needed for the FONT and GSAP. The SFX and the flares are")
        say("generated locally and are already done. To finish offline:")
        say(f"  fonts : python3 {os.path.basename(__file__)} --only fonts "
            f"--font-dir ~/Library/Fonts")
        say("          (any .ttf/.otf folder; the caption face wants weights 700-900)")
        say("  gsap  : download gsap.min.js from https://gsap.com/docs/v3/Installation")
        say(f"          into {os.path.join(ASSETS, 'vendor')}/")
        say("          (it must be local — a CDN load times the renderer out)")
        return 1
    say("setup complete.")
    say("\nnext, per project:")
    say("  cp config.example.json  <project>/config.json")
    say("  cp scripts/beats.py     <project>/scripts/beats.py    # THE beat map — edit it")
    return 0


if __name__ == "__main__":
    sys.exit(main())
