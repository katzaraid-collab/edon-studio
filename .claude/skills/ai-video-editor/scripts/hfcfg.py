#!/usr/bin/env python3
"""Config loading shared by every script in this skill.

Everything project- or creator-specific lives in config.json. Nothing personal is
ever hardcoded in a script — that is what makes the skill portable.

Lookup order for config.json:
  1. --config <path>
  2. ./config.json
  3. $AI_VIDEO_EDITOR_CONFIG
  4. config.example.json next to the skill (defaults only)
"""
import argparse
import json
import os
import shutil
import subprocess
import sys

SKILL_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DEFAULTS = {
    "project": {"name": "reel", "topic": "reel", "fps": 25, "width": 1080, "height": 1920},
    "language": {"code": "en", "direction": "ltr",
                 "whisper_model": "mlx-community/whisper-large-v3-turbo",
                 "typos": {}, "merge_next": {}, "locked_phrases": [], "clause_openers": []},
    "brand": {"font_family": "Rubik", "font_dir": "assets/fonts",
              "accent": "#4fe6d8", "accent_alt": "#3d8bff", "accent_warm": "#D97757",
              "good": "#35e06b", "caption_size": 70,
              "caption_plate": "rgba(255,255,255,0.82)", "caption_ink": "#0a0a0a"},
    "cutting": {"onset_db": -26.0, "speech_lead": 0.04, "gap_ratio": 0.60,
                "gap_min": 0.15, "gap_max": 0.32, "gap_topic_boundary": 0.26,
                "lead": 0.06, "tail_min": 0.09, "tail_last": 0.45,
                "fade_in": 0.02, "fade_out": 0.055, "drop": [], "merge": []},
    "matting": {"backbone": "resnet50", "downsample_ratio": 0.45, "crf": 10,
                "alpha_floor": 0.06, "alpha_span": 0.88},
    "audio": {"bgm_under_voice": 0.056, "bgm_after_flare": 0.135,
              "sfx_target_db_below_voice": 7.0, "music_dir": "", "sfx_dir": "assets/sfx"},
    "render": {"video_bitrate": "32M", "target_peak_db": -1.5},
    "paths": {"archive_root": "", "exports": "", "projects": "", "assets": ""},
}


def _deep_merge(base, over):
    out = dict(base)
    for k, v in (over or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _deep_merge(out[k], v)
        else:
            out[k] = v
    return out


def load(path=None):
    """Return the merged config dict."""
    candidates = [path, "config.json", os.environ.get("AI_VIDEO_EDITOR_CONFIG")]
    for c in candidates:
        if c and os.path.exists(c):
            with open(c, encoding="utf-8") as f:
                user = json.load(f)
            cfg = _deep_merge(DEFAULTS, user)
            cfg["_source"] = os.path.abspath(c)
            return cfg
    cfg = dict(DEFAULTS)
    cfg["_source"] = "(defaults — no config.json found)"
    return cfg


def arg_parser(description):
    """An ArgumentParser pre-wired with --config."""
    ap = argparse.ArgumentParser(description=description)
    ap.add_argument("--config", help="path to config.json")
    return ap


# ---------------------------------------------------------------- environment

def ffmpeg_env():
    """PATH with ~/.local/bin prepended — static ffmpeg builds commonly live there."""
    env = dict(os.environ)
    local = os.path.expanduser("~/.local/bin")
    if os.path.isdir(local) and local not in env.get("PATH", ""):
        env["PATH"] = local + os.pathsep + env["PATH"]
    return env


def which(name):
    return shutil.which(name, path=ffmpeg_env().get("PATH"))


def require(*tools):
    """Exit with a clear message if a required binary is missing."""
    missing = [t for t in tools if not which(t)]
    if missing:
        sys.exit(f"missing required tool(s): {', '.join(missing)}\n"
                 f"install them, or add their directory to PATH")


def run(args, **kw):
    """subprocess.run with the ffmpeg-aware PATH and captured output by default."""
    kw.setdefault("env", ffmpeg_env())
    kw.setdefault("capture_output", True)
    kw.setdefault("text", True)
    return subprocess.run(args, **kw)


def probe(path, entries="format=duration", stream=None):
    """One ffprobe value (or CSV row) as a string."""
    cmd = ["ffprobe", "-v", "error"]
    if stream:
        cmd += ["-select_streams", stream]
    cmd += ["-show_entries", entries, "-of", "csv=p=0", path]
    return run(cmd).stdout.strip()


def frames(path):
    """Exact video frame count — the only trustworthy measure of a clip's length."""
    out = run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-count_packets",
               "-show_entries", "stream=nb_read_packets", "-of", "csv=p=0", path]).stdout
    return int(out.strip() or 0)


def require_python(*mods):
    """Exit with an actionable message if an OPTIONAL python dep is missing.

    Cutting, captions, building, validating and QA are stdlib-only on purpose. Only
    rotoscoping and the two pixel-measurement scripts need numpy/torch, so they check
    here rather than failing on an import at the top of the file.
    """
    import importlib
    missing = []
    for m in mods:
        try:
            importlib.import_module(m)
        except ImportError:
            missing.append(m)
    if not missing:
        return
    hint = {"numpy": "pip install numpy",
            "torch": "pip install torch   # see pytorch.org for your platform/accelerator",
            "pyte": "pip install pyte"}
    lines = "\n".join(f"    {hint.get(m, 'pip install ' + m)}" for m in missing)
    sys.exit(
        f"missing optional dependency: {', '.join(missing)}\n\n"
        f"  this script needs it; the rest of the pipeline does not.\n"
        f"  in a venv:\n"
        f"    python3 -m venv .venv && source .venv/bin/activate\n{lines}\n")


def load_beats():
    """Import THE beat map, preferring the PROJECT's copy over the skill's stub.

    beats.py is meant to be copied into each project and edited. If the skill's own
    scripts/ directory won the import (it is first on sys.path, because every script
    inserts its own directory), every project would silently build against the empty
    stub — and the failure looks like "my beats did nothing", with no error.

    Search order: ./scripts/beats.py, ./beats.py, then the skill's own.
    Returns (module, path) or (None, None).
    """
    import importlib.util
    here = os.path.dirname(os.path.abspath(__file__))
    for cand in (os.path.join(os.getcwd(), "scripts", "beats.py"),
                 os.path.join(os.getcwd(), "beats.py"),
                 os.path.join(here, "beats.py")):
        if not os.path.exists(cand):
            continue
        spec = importlib.util.spec_from_file_location("beats", cand)
        mod = importlib.util.module_from_spec(spec)
        try:
            spec.loader.exec_module(mod)
        except SystemExit:                 # beats.py run as a script needs bounds.json
            continue
        return mod, cand
    return None, None


def chrome_path():
    """Path to a Chrome/Chromium binary for headless rendering."""
    env = os.environ.get("CHROME_PATH")
    if env and os.path.exists(env):
        return env
    for p in (
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        "/usr/bin/google-chrome",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
    ):
        if os.path.exists(p):
            return p
    found = shutil.which("google-chrome") or shutil.which("chromium")
    if found:
        return found
    sys.exit("Chrome/Chromium not found. Set CHROME_PATH to the binary.")


if __name__ == "__main__":
    cfg = load(sys.argv[1] if len(sys.argv) > 1 else None)
    print(f"config source: {cfg.pop('_source')}")
    print(json.dumps(cfg, indent=2, ensure_ascii=False))
