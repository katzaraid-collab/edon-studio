---
name: ai-video-editor
description: Build a finished 9:16 short-form reel (Instagram Reels, TikTok, YouTube Shorts) from a talking-head take plus B-roll, composed and rendered with HyperFrames — onset-precise cutting, AI matting, split-screen layout, burned-in single-line caption plates, sound design, motion graphics, 32 Mbps master. Use when the deliverable is a vertical short-form video COMPOSITION. Not for long-form or horizontal video, podcast/YouTube episode edits, or plain timeline trimming of a single clip.
---

# AI Video Editor — vertical reel pipeline

Turn a raw talking-head recording plus B-roll into a finished 1080x1920 reel: cut to the
speech, lay out the frame, caption every word, score it, and master it.

Built for **HyperFrames** (an HTML/CSS/GSAP video composition renderer) driven from
**Claude Code**. The composition is an `index.html`; every clip is an element with
`data-start` / `data-duration`; animation is a single paused GSAP timeline.

**Scope:** raw footage → finished master.
**Not in scope:** scripting, ideation, publishing.

---

## Read this first

This skill is a **quality bar, not a menu.** Every rule here exists because a real editor
rejected the alternative. The single most common failure is doing 90% of it — a reel that
is "almost right" reads as low effort to a viewer who cannot say why.

Three habits matter more than any individual rule:

1. **Measure, don't eyeball.** Nearly every rule below has a number attached. Get the number
   from the file (ffprobe, an RMS scan, a pixel mask), not from a guess or a screenshot.
2. **A note names a symptom; find the systematic cause.** "You cut into the next sentence"
   is frame-quantisation drift. "The rotoscoping is sloppy" is a downsample ratio. Patch the
   instance and the same class of bug comes back next round. Fix the class, then say the root
   cause out loud with the measurement that proves it.
3. **Prefer a gate over a rule.** A rule can be missed; a failing check cannot. When a note
   repeats, encode it in `scripts/preflight_qa.py` or as an `assert` in the build script. Run
   the negative test when you add one — a check you have never seen fail is not a check.

**Re-read this file at the start of every round, including revision rounds inside a session
you already started.** The reviewer's notes get folded back into it between turns; the copy
you loaded an hour ago may be stale. When the file and the live conversation disagree, ask
which wins **per item**, not globally.

---

## Scope — when NOT to use this skill

This builds a **9:16 short-form composition**. If the request is a long-form or horizontal
edit, a podcast/YouTube episode, or "just trim this clip", it is the wrong tool — say so and
hand off rather than forcing a reel pipeline onto it. If another editing skill is installed
and both look plausible, the split is: **vertical short-form composition → here; everything
else → there.**

---

## 0. Setup — run once

```bash
python3 scripts/setup_assets.py
```

This creates `assets/` next to the skill with everything the pipeline needs and nothing that
is not free to redistribute:

- **Fonts** — a variable OFL caption face (Rubik by default; Hebrew + Latin + digits, weights
  300–900). Swap in your own brand font with `--font-dir /path/to/ttfs`.
- **SFX** — risers, booms, whooshes, shutters, impacts, pops, clicks and a cash cue, all
  **synthesised** at build time, normalised to −6 dBFS peak. No licence, no attribution.
- **Lens flares** — two vertical anamorphic flare clips for the hook transition, generated
  procedurally, ready to screen-blend.
- **gsap.min.js** — vendored locally (a CDN load times the renderer out).

**Network is needed once**, for the font and GSAP only. The SFX and the flares are generated
locally and always work offline. If the download fails, `setup_assets.py` says exactly which
piece is missing and how to supply it yourself (`--font-dir` points at any `.ttf`/`.otf`
folder you already have).

### Per project, once

```bash
cp config.example.json      <project>/config.json      # brand, language, paths, levels
mkdir -p <project>/scripts
cp scripts/beats.py         <project>/scripts/beats.py # THE beat map — edit this per reel
```

`beats.py` ships as a deliberate stub: `BEATS` holds one hook beat and nothing else, because
the beat map *is* the edit and cannot be guessed. **Every script prefers the project's copy
over the skill's** — `build_index.py` prints which file it loaded and how many beats it found,
so a stub that never got filled in is visible rather than silent.

Everything creator-specific lives in those two files, never in the skill.

### Environment checklist (verify at the start of every session)

| Need | Check | Notes |
|---|---|---|
| ffmpeg / ffprobe | `ffmpeg -version` | A static build in `~/.local/bin` is fine; `export PATH="$HOME/.local/bin:$PATH"` |
| Chrome / Chromium | `--version`, or set `CHROME_PATH` | Caption rendering and screenshot B-roll. **No Node or puppeteer needed.** |
| HyperFrames | `npx hyperframes --help` | Node is needed for this, not for the Python scripts |
| Transcription | `uvx --from mlx-whisper mlx_whisper --help` (Apple Silicon) or `whisper` | |
| numpy | `python3 -c "import numpy"` | `matte.py`, `reframe.py`, `check_ghosting.py` |
| torch | `python3 -c "import torch"` | `matte.py` only. MPS/CUDA strongly preferred; CPU works but is minutes per second of footage. |

**The Python deps are optional and lazily imported** — cutting, captions, the caption layer,
building, validating and QA all run on the standard library alone. Only rotoscoping and the
two pixel-measurement scripts need more:

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install numpy torch                 # torch: see pytorch.org for your platform
```

`matte.py` pulls the RobustVideoMatting weights via `torch.hub` on first run (one download,
then cached in `~/.cache/torch`). It tells you this before it starts.

**File access:** if reads fail with "Operation not permitted" on macOS, the host app has lost
Full Disk Access → re-grant in System Settings → Privacy & Security → Full Disk Access and
fully restart the app.

**Work locally.** Copy footage to a local project dir, edit there, sync back to the archive
drive at the end. Preview and render over a network/external volume are painfully slow, and
losing the volume mid-edit loses the edit.

### Known-hostile tooling (these cost real hours to rediscover)

- **`ffmpeg -v error` silently kills `volumedetect` / `silencedetect` / `astats` output.**
  A level probe then returns empty and looks like a missing file.
- **ffmpeg stderr vanishes inside shell `for` loops** in some agent harnesses. Drive
  multi-clip probing from Python with `subprocess(capture_output=True)`, never a bash loop.
- **`mlx_whisper` names its output from the FIRST dot in the filename.** A slice called
  `r_0.0_4.3.wav` writes `r_0.json`, so batch transcription silently returns nothing. Use
  dot-free names (`r00.wav`).
- **Never batch many files into ONE `mlx_whisper` CLI call** — it writes every result to the
  first file's json name, so you keep the LAST clip's text and silently lose the rest.
  Transcribe in-process with the model loaded once instead.

---

## The pipeline

Eight phases. Each links to the reference that carries its detail — **read that file before
doing the phase**, not after.

| # | Phase | Reference | Gate before moving on |
|---|---|---|---|
| 1 | Cut the A-roll to the speech | `references/cutting.md` | Zero dead space; segments frame-exact |
| 2 | Map the beats | `references/captions.md` §beat map | Every beat start is a real segment boundary |
| 3 | Lay out the frame | `references/layout.md` | Nothing readable outside the safe zone |
| 4 | Caption every word | `references/captions.md` | Zero gaps, zero overlaps, one line, 3–4 words |
| 5 | Source / build B-roll and graphics | `references/graphics.md` | Every clip has a reason tied to its sentence |
| 6 | Score it | `references/sound.md` | Music from frame 1; SFX ~7 dB under the voice |
| 7 | Build and render | `references/hyperframes.md` | Validator passes; encoded file sampled, not just snapshots |
| 8 | Master and deliver | `references/delivery.md` | SDR bt709, 30–35 Mbps, peak −1 to −2 dBFS |

Before showing **any** cut to the reviewer:

```bash
python3 scripts/preflight_qa.py <project> --aroll assets/aroll.mp4 \
        --transcript src/aroll.json --render renders/final.mp4
```

and walk `references/checklist.md` — every line on it is a note somebody has already had to
give once.

---

## 1. Cut the A-roll — the number one quality gate

**Never cut on Whisper word-starts.** Whisper folds leading silence into a sentence's first
word — up to 1.2 s of dead air. A single second of nothing before a sentence is the most
frequently caught mistake in this whole pipeline.

The short version (full method, including the traps, in `references/cutting.md`):

1. Transcribe the raw once with word timestamps to find the takes. **The last take of a
   repeated line wins.**
2. Map structure with `silencedetect`, **not** with Whisper — Whisper smears aborted takes.
   Then re-transcribe **each speech island separately** to see which one is the complete take.
3. Cut at **speech-chunk** level, not take level: split each chosen take on internal silences
   and transcribe each chunk in isolation. This is what exposes a false start hiding *inside*
   an otherwise-good take.
4. Find the onset at **speech level (−26 dB)**, not silence level (−33/−40 dB). Breath and
   room tone sit 40–150 ms before the first consonant.
5. Land true speech **exactly one frame (0.04 s) into the segment.** Iterate: measure, shift
   by `(onset − 0.04)`, re-cut, re-measure until every segment reads 0.02–0.05 s.
6. **Quantise every segment to whole frames.** A non-frame-aligned duration encodes longer
   than requested, so planned boundaries drift later than the real concat — and every layout
   cut then fires before its sentence starts. Prove it by counting packets, not seconds.
7. Derive the edited gap from the **original** pause so the speaker's rhythm survives:
   `gap = clamp(0.60 × original_pause, 0.15, 0.32)`. Crushing every gap to the floor makes
   phrases run into each other.
8. **The closing segment takes a ~0.45 s tail** (the body takes ~0.03 s). Without it the final
   word reads as clipped even though every syllable is present.

```bash
python3 scripts/cut_aroll.py --config config.json      # islands → chunks → onsets → segments
python3 scripts/reframe.py  --config config.json       # optional: per-segment face-centred crop
```

**Composition duration = the A-roll's real duration**, measured from the encoded file — never
the sum of planned durations.

---

## 2. Layout, captions, graphics, sound

These four are where taste lives, and each has its own reference file. The rules that are
non-negotiable regardless of style:

**Layout** (`references/layout.md`)
- **Nothing readable above y≈200, below y≈1430, or right of x≈950.** Platform chrome covers
  the top bar, the whole bottom caption/button strip and the right action rail. This
  constrains the *framing*, not just the graphics.
- **The speaker is on screen nearly always.** Two or three short full-frame B-roll stretches
  per reel, maximum — retention dies otherwise.
- **No transition on any B-roll. Ever.** No whip-pan, no scale-in, no slide, no zoom. B-roll
  hard-cuts in and sits there. (The hook flare and a slow push on full-frame A-roll are fine.)
- **A B-roll run holds.** If one sentence explains one action, the whole sentence stays on the
  shot — chain clips rather than bouncing back to the face mid-demonstration.
- **Reframe with a crop on the original high-res raw, never a CSS transform.** A crop is
  physically incapable of exposing a black edge; a transform is not.

**Captions** (`references/captions.md`)
- **Every word, verbatim.** Fix transcription typos, never paraphrase.
- **One line, 3–4 words. Never two lines.** Black text on a translucent white plate that hugs
  the text — no stroke.
- **Zero dead space**: one track, each card runs to the next card's start minus 0.005 s.
- **Five vertical slots, derived from one beat map** imported by both the composition builder
  and the caption-layer builder. Two hand-maintained copies always drift.

**Graphics** (`references/graphics.md`)
- **Every B-roll clip needs a direct, obvious reason tied to the sentence being said.** No
  abstract filler — no bokeh, no drone scenery, no empty walls.
- **A hard claim needs its receipt in frame.** An assertion over generic footage reads as
  hype; a comparison card reads as proof.
- **Never invent a number** to make a receipt look good. If the source has no number, show the
  relationship, not a fabricated figure.
- **Real logos, downloaded — never hand-drawn approximations.**
- **Never generate AI stand-ins for identifiable real people.**

**Sound** (`references/sound.md`)
- **Music from frame 1**, starting on the track's actual first beat (measure it; most files
  carry 100–150 ms of silence).
- **Duck the bed under every riser, don't cut it** — unless a cut-out was asked for by name.
- **Level SFX by how far under the voice they land (~7 dB), not by copying a previous number.**
  A cue 15 dB down is measurably present and completely inaudible.

---

## 3. Build, render, master

The composition is **generated, never hand-edited.** Every timed value is derived from
`scripts/beats.py` plus a `media.json` manifest of the layers, so a re-cut cannot leave a
stranded time behind. Start the manifest with `--example`:

```bash
python3 scripts/build_index.py --example > media.json   # commented starting point
python3 scripts/captions.py                             # caption cards from the transcript
python3 scripts/fit_captions.py                         # no plate wider than the frame
python3 scripts/build_index.py                          # → index.html + build/expected.json
python3 scripts/validate.py --expect build/expected.json  # must pass before every render
python3 scripts/caption_layer.py                        # → assets/captions.webm (alpha)
npm run check
npx hyperframes snapshot --at <every beat and boundary time>
HF_VIDEO_COVERAGE_THRESHOLD=0 npx hyperframes render --quality high --video-bitrate 32M
python3 scripts/finish.py                               # composite captions + pin SDR bt709
python3 scripts/preflight_qa.py . --aroll assets/aroll.mp4 --render renders/final.mp4
```

`build_index.py` applies the rules that are easiest to forget by hand: the one-frame
boundary rule (hook videos take `cut − 0.04`, hook overlay divs take `cut`), alternating
track indices, caption classes from `slot_at()`, caption durations of `next − this − 0.005`,
`font-family` on every card surface, and a `tl.set` hard kill at every animated element's
out-point. It refuses to emit anything that runs past `END`, and asserts every beat start is
a real segment boundary before it writes a line.

Five things that will bite (all of them, with the rest, in `references/hyperframes.md`):

- **A passing snapshot is not proof the encode is correct.** The renderer has a separate
  frame-capture path with its own bugs. Always sample the encoded mp4 — that is the only
  artifact anyone watches.
- **Debug with a draft proof render** (`--quality draft --fps 5 --crf 34`): a 60 s reel in
  ~3 minutes instead of an hour, and it reproduces compositing bugs faithfully.
- **HDR is the silent killer.** Modern phones shoot HLG/bt2020. One HDR clip in the
  composition renders the *entire* video as 10-bit bt2020, every player applies an HDR→SDR
  transform, and the result looks milky and desaturated — indistinguishable from a bad grade,
  except nothing was graded. Tone-map at build time, pin the master, and assert on the probe.
- **`npx hyperframes preview` rewrites `index.html` while it runs.** Kill the preview server
  before editing the composition, and grep the file afterwards to prove your edit landed.
  (Another reason to rebuild with `build_index.py` rather than hand-edit.)
- **A hand-edit to `index.html` is lost on the next build.** If a value is wrong, it is wrong
  in `beats.py` or `media.json` — fix it there.

---

## 4. Review etiquette

Present contact sheets at every milestone. When notes come back with timecodes: **fix all of
them, then re-scan the whole video for the same class of mistake elsewhere.** The expectation
is that the pattern is fixed, not the instance.

After every round, fold new notes back into this skill as permanent rules — and where a note
can be expressed as a check, put it in `preflight_qa.py` instead of in prose.

Ask only about things this file cannot decide: music choice, B-roll download approval (with
the exact URLs), the final filename, and taste calls not covered here.

---

## References

| File | Covers |
|---|---|
| `references/cutting.md` | Onset detection, island mapping, chunk-level tightening, frame quantisation, merges |
| `references/layout.md` | Hook designs, matting, split-screen, per-segment crops, safe zones, punch-ins |
| `references/captions.md` | Caption spec, the five slots, the beat map, RTL/bidi, plate geometry |
| `references/sound.md` | Music selection and alignment, risers, ducking, SFX levels, cut-outs |
| `references/graphics.md` | B-roll sourcing, screenshot/terminal capture, motion-graphic cards, logos, news cards |
| `references/hyperframes.md` | Renderer gotchas, the caption-ghosting bug, HDR handling, scale rules |
| `references/delivery.md` | Render settings, verification, file placement, A/B hook variants |
| `references/checklist.md` | The full list of mistakes to check before every review |
| `reference-composition/index-reference.html` | Annotated composition — the patterns `build_index.py` emits, with the reasoning inline |

---

Copyright © 2026 Omer Yaron. Licensed under the MIT License — see `LICENSE`.
