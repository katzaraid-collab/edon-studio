# AI Video Editor

A Claude Code skill that turns a raw talking-head recording plus B-roll into a finished
vertical reel — cut to the speech, laid out for the platform, captioned verbatim, scored,
and mastered at 32 Mbps.

It is not a template. It is the accumulated set of rules, measurements and gates from
editing premium short-form video: onset-precise cutting, frame-exact segments, AI
rotoscoping, split-screen geometry that never crops the face, single-line caption plates
with zero blank frames, sound design levelled against the voice, and an HDR trap that
silently ruins one in three phone-shot videos.

Renders with **[HyperFrames](https://www.npmjs.com/package/hyperframes)** — an
HTML/CSS/GSAP video composition renderer. The composition is an `index.html`; every clip
is an element with `data-start` / `data-duration`; animation is one paused GSAP timeline.

**Scope:** 9:16 short-form compositions. Not for long-form or horizontal edits, podcast /
YouTube episode cuts, or plain trimming of a single clip. If you also run a long-form
editing skill, the split is: vertical short-form composition → this one; everything else →
that one.

---

## Install

```bash
git clone <this-repo> ~/.claude/skills/ai-video-editor
cd ~/.claude/skills/ai-video-editor
python3 scripts/setup_assets.py
```

Or drop the folder into `~/.claude/skills/` (global) or `<project>/.claude/skills/`
(one project). Claude Code picks it up on the next session — ask it to "edit my video"
or invoke `/ai-video-editor`.

`setup_assets.py` creates `assets/` with a free OFL caption font, 13 synthesised SFX
cues, two generated lens flares, and a local copy of GSAP. Nothing licensed is shipped
in the package — see `LICENSE`.

**Network is needed once**, for the font and GSAP only — the SFX and flares are generated
locally and always work offline. If a download fails, the script prints exactly what is
missing and how to supply it yourself (`--font-dir` takes any folder of `.ttf`/`.otf`).

Optional Python deps, only for rotoscoping and the two pixel-measurement scripts:

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install numpy torch          # torch: see pytorch.org for your platform
```

### Per project

```bash
cp config.example.json  <project>/config.json       # brand, language, paths, levels
mkdir -p <project>/scripts
cp scripts/beats.py     <project>/scripts/beats.py  # THE beat map — edit per reel
```

`beats.py` ships as a deliberate stub — the beat map *is* the edit and cannot be guessed.
Every script prefers the project's copy over the skill's, and `build_index.py` prints which
file it loaded and how many beats it found, so a stub that was never filled in is visible
rather than silent.

### Requirements

| | | |
|---|---|---|
| **ffmpeg / ffprobe** | required | a static build in `~/.local/bin` is fine |
| **Google Chrome or Chromium** | required | caption rendering, screenshot B-roll. No Node, no puppeteer. Set `CHROME_PATH` if it is somewhere unusual. |
| **HyperFrames** | required | `npx hyperframes --help` |
| **Python 3.9+** | required | **standard library only** for the whole core pipeline |
| `numpy` | optional | `matte.py`, `reframe.py`, `check_ghosting.py` |
| `torch` | optional | `matte.py` only — pulls RVM weights via `torch.hub` on first run (~100 MB, then cached) |
| `pyte` | optional | terminal B-roll capture |
| **Whisper** | recommended | `mlx-whisper` on Apple Silicon, or any Whisper with word timestamps |


---

## Use it

```
Edit this into a reel: ~/footage/2026-08-09/raw.mp4
```

Claude reads `SKILL.md`, then the reference file for whichever phase it is in, and
works the eight phases:

| # | Phase | Gate |
|---|---|---|
| 1 | Cut the A-roll to the speech | zero dead space; segments frame-exact |
| 2 | Map the beats | every beat start is a real segment boundary |
| 3 | Lay out the frame | nothing readable outside the platform safe zone |
| 4 | Caption every word | zero gaps, one line, 3–4 words |
| 5 | Source B-roll and graphics | every clip has a reason tied to its sentence |
| 6 | Score it | music from frame 1; SFX ~7 dB under the voice |
| 7 | Build and render | `build_index.py` → `validate.py` passes; the encoded file sampled, not just snapshots |
| 8 | Master and deliver | SDR bt709, 30–35 Mbps, peak −1 to −2 dBFS |

### The scripts

Every one runs standalone with `--help`.

| Script | Does |
|---|---|
| `setup_assets.py` | one-time: fonts, SFX, flares, GSAP |
| `cut_aroll.py` | speech islands → onset-precise, frame-exact segments (with an iterative refine pass that converges the onset to a single frame) |
| `reframe.py` | per-segment face-centred crop on the high-res raw |
| `matte.py` | RVM rotoscoping, tuned; `--verify` measures whether the edge is actually sharp |
| `prep_broll.py` | HDR → SDR tone-map in the correct order; native-scale fit |
| `captions.py` | transcript → one-line 3–4-word cards, zero gaps |
| `fit_captions.py` | measures every plate's real width in the real font |
| `caption_layer.py` | cards → transparent VP9 layer, composited outside the renderer |
| `check_ghosting.py` | decides whether you actually need that layer on this project |
| `beats.py` | THE beat map — copied into each project and edited; every script prefers the project's copy |
| `build_index.py` | **the composition builder** — generates `index.html` from the beat map + `media.json`, and emits `build/expected.json` for the validator |
| `validate.py` | built HTML vs beat map: starts **and** durations, music phase, caption continuity |
| `preflight_qa.py` | run before showing anyone anything |
| `finish.py` | composite captions, pin the master to SDR bt709, assert it |
| `pty_capture.py` / `render_term.py` | shoot a real terminal as B-roll |

---

## What's in the box

```
SKILL.md                          the spine — read first, re-read every round
references/
  cutting.md                      onset detection, frame quantisation, merges
  layout.md                       hook designs, matting, split-screen, crops, safe zones
  captions.md                     caption spec, the five slots, the beat map, RTL/bidi
  sound.md                        music alignment, risers, ducking, SFX levels
  graphics.md                     B-roll sourcing, terminal capture, motion cards, logos
  hyperframes.md                  renderer gotchas, caption ghosting, the HDR trap
  delivery.md                     render settings, verification, file placement, A/B hooks
  checklist.md                    every mistake to check before a review
reference-composition/
  index-reference.html            annotated composition — the reasoning behind what
                                  build_index.py emits
scripts/                          the pipeline
config.example.json               everything creator-specific (copy to <project>/config.json)
```

---

## Languages

Language-agnostic, with right-to-left fully supported. Set `language.code` and
`language.direction` in `config.json`. The bundled font (Rubik) covers Latin, Hebrew,
Cyrillic and Greek at weights 300–900; point `brand.font_dir` at your own face for
anything else.

The RTL bidi rules in `references/captions.md` are the hard-won part: a headline mixing
right-to-left text with Latin or `$` reorders itself at render time, the HTML source
looks fine either way, and in a caption you cannot rewrite the Latin away because the
verbatim rule wins. The fix is isolation, and it is documented.

---

## Extending it

When a note comes back:

1. Fix the instance.
2. Find the **class** it belongs to and fix every other occurrence.
3. Add a line to `references/checklist.md` and the rule to the relevant reference.
4. If it can be expressed as a check, put it in `preflight_qa.py` **instead** — a gate
   beats a rule. Run the negative test when you add one; a check you have never seen
   fail is not a check.

---

Copyright © 2026 Omer Yaron. MIT licensed — see `LICENSE`.
