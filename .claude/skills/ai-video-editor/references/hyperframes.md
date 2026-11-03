# HyperFrames — renderer gotchas, colour, and scale

---

## Composition basics

- **Videos are direct children of root**, `muted playsinline`, with a separate `<audio>` for
  sound. **Audio elements REQUIRE an `id`** or they render silent.
- Same track index = no overlap. Alternate track indices for adjacent clips.
- Every visual clip needs `class="clip"`. Captions and graphics animate via the single paused
  timeline registered on `window.__timelines["main"]`.
- **Vendor GSAP locally** (`assets/vendor/gsap.min.js`) — a CDN load times the renderer out.
- **Pad short video clips ~0.3 s past their window** (`tpad=stop_mode=clone`); the renderer's
  coverage gate aborts below 95% coverage. For intentional fade-to-zero overlays (flares),
  render with `HF_VIDEO_COVERAGE_THRESHOLD=0`.
- **GSAP exits that end at a clip boundary need a `tl.set` hard kill**
  (lint: `gsap_exit_missing_hard_kill`).

---

## Element and CSS traps

### A `.clip` div still needs its STYLE class

`class="clip"` + `id="x"` picks up `#x` rules only — every `.someclass` rule (position,
z-index, opacity, filter) is silently skipped, so the element lands in normal flow behind
everything. Write `class="clip rival"`, never `class="clip"` alone.

### Inline `<svg>` does NOT respect the `.clip` visibility contract

A timed `<svg class="clip">` renders its strokes across the **whole** video — stray wires over
a face 40 seconds later. Always give the svg `opacity: 0` in CSS and drive it from the
timeline:

```js
tl.set(sel, {opacity: 1}, start);
tl.set(sel, {opacity: 0}, end);
```

Same for any absolutely-positioned div you animate.

### Any `position: absolute` element you only move with GSAP still needs a base `left`/`top`

Without them it anchors at 0,0 and your `x`/`y` tweens fly it off-frame.

### A sibling of a full-frame card must out-rank it

Moving an element **out** of a `.fullcard` (e.g. to escape the nested-media freeze) drops it
behind that card unless you also raise its z-index above the card's. Check z-order whenever you
re-parent.

### Video nested inside another timed element FREEZES

You cannot wrap a matte in a timed div to animate it. Animate the matte element itself.

### Specificity: a `.toppanel` height rule loses to the global media rule

`video, img.bimg { inset:0; height:1920px }` is (0,1,1) and `.toppanel { height:900px }` is
(0,1,0) — so every panel renders full-frame. Write:

```css
img.bimg.toppanel, video.toppanel { height: 900px; top: 0; }   /* (0,2,1) */
```

and set `left`/`top` explicitly rather than `inset: 0`, which also pins `bottom`.

### EVERY card surface must set `font-family` itself

`.cap` sets the brand face, but a new `.toppanel` / `.full` class does **not** inherit it — the
whole card silently renders in the default **serif** and looks cheap.

Always `font-family: "<BrandFont>", "Inter", Arial, sans-serif` — and name **Inter**, not
Helvetica/Arial. The renderer aliases `'Helvetica Neue'` / `'Helvetica'` / `'Arial'` → Inter
anyway, so naming Inter is what makes preview match render.

### A CSS `filter: blur()` LEAKS at the frame edge — always scale the element up with it

The blur samples past the element's bounds, so the layer underneath shows as a bright rim down
the sides. Tween `scale: 1.16` in the **same** tween as the blur
(`transformOrigin: 50% 50%`), so sharp shots stay native and only the blurred state is cropped.

Verify numerically: mean pixel gradient across the outer ~12 columns should be **< 3** on a
blurred frame.

### Never leave a live `filter: blur()` on a full-frame video

Chrome re-blurs 1080x1920 every frame and the capture crawls — a 34 px blur on an 11 s backdrop
took a 10-minute render past 90 minutes. **Bake it into an asset instead:**

```bash
ffmpeg -i src.mp4 -vf "scale=1350:2400,crop=1080:1920:135:240,gblur=sigma=34,\
eq=brightness=-0.16:saturation=0.8" out.mp4
```

(scale-then-crop reproduces the `transform: scale(1.25)` you would have done in CSS), then
point the `<video>` at it and drop the filter. Same for heavy `backdrop-filter` and large
`box-shadow` stacks on animated elements.

### Screenshot B-roll built in headless Chrome must inline its assets as `data:` URIs

A page set with `page.setContent()` has an `about:blank` origin, so `file://` fonts and images
silently fail to load (`--allow-file-access-from-files` does not help) — you get a broken-image
glyph and the fallback font. Base64 the `.ttf` and `.png` into the HTML string.

### The one-frame boundary rule

HyperFrames ends a `<video>` clip **inclusive** of the frame at `start + duration`, but a timed
`<div>` **exclusive** of it.

So `duration = cut` leaves one frame of video past the cut, and `duration = cut − 0.04` on
*everything* kills the overlay div one frame before its videos — you swap one one-frame bug for
a different one.

**Give the hook's videos `cut − 0.04` and its overlay divs `cut`.** Both then land their last
paint on the same frame. Prove it on the **encoded** file at `cut−0.08 / −0.04 / cut / +0.04`,
never on snapshots.

---

## `npx hyperframes preview` REWRITES `index.html` while it runs

It injects `data-hf-id="…"` on every timed element and normalises `<img … />` to `<img …>`. Any
exact-string edit you make against the pre-preview text then silently matches nothing, and your
change is lost.

**Kill the preview server before editing the composition**, and after any scripted edit, `grep`
the file to prove it landed.

More generally: **`str.replace` on a build script is a no-op when the pattern is gone**, so an
"applied" edit can change nothing. After any styling edit, grep the *generated* html for the
rule before you re-render.

---

## The caption-ghosting bug

**The renderer can leave the LAST clip of each CSS slot painted for the whole video when a
composition has ~48 text clips — and snapshots do NOT show it.** An encoded file carried 2–3
stale caption plates stacked on top of the live one for the entire video while every
`hyperframes snapshot` came back clean.

Adding `class="clip"`, alternating tracks, and giving all 48 captions unique tracks all failed
to fix it.

**The fix that works: composite the captions OUTSIDE the renderer** (`scripts/caption_layer.py`)
— draw each card to a transparent 1080x1920 PNG with headless Chrome (same CSS, same brand
font, correct complex-script shaping), concat the stills into a VP9 `yuva420p` webm on the
caption timings, and overlay in the final ffmpeg pass:

```bash
ffmpeg -i base.mp4 -c:v libvpx-vp9 -i captions.webm \
  -filter_complex "[0:v][1:v]overlay=0:0:format=auto[v]" \
  -map "[v]" -map 0:a -c:v libx264 -b:v 32M -c:a copy final.mp4
```

### But the bug is NOT deterministic above 48 clips — VERIFY, don't assume

A 53-caption composition rendered perfectly clean straight from the renderer, so paying the
external-layer cost blindly is waste.

**The check, on the ENCODED master:** sample ~15 frames, mask `min(rgb) > 190 & (max−min) < 30`,
keep rows where that spans > 240 px, merge bands separated by < 70 px, then count only bands
whose top row sits within 4 px of a caption slot.

- Exactly one band per frame = clean.
- Two or more = ghosting → switch to the external caption layer.

> **A single plate splits into two bands at its own dark glyphs** — a naive count reports 2
> plates on every healthy frame, which is why the merge and the slot-top match both matter.
> Article cards and CTA pills also read as bright bands.

---

## Validate the built HTML against the beat map — EVERY element

The stranded-time bug bites repeatedly: first a hero card's **start**, then a graphic card's
**duration** (still carrying a pre-recut value, so the card hangs 1.84 s into the next shot).
A validator that only checks starts on a hand-picked id list passes both times.

**When you drop a line or re-cut, every downstream time moves.** Removing one sentence shifts
everything after it. Captions, panels and the A-roll get regenerated from the beat map and are
correct — but anything **hardcoded in the HTML template** (a hero card, a panel B-roll, an SFX
cue) is left at the old second, and a snapshot at the old time looks fine.

Ship `scripts/validate.py` in every project and run it before every render. It parses the built
html and asserts:

1. nothing runs past `END`;
2. every beat-map-defined element matches **start AND duration**;
3. `bgm1.duration == MUSIC_STOP`, `bgm2` starts on resume and its `media-start` is in phase;
4. captions have zero gaps, end exactly at `END`, and each card's class equals
   `slot_at(start)`;
5. every beat start is a real segment boundary.

Exit non-zero on any failure. Then **grep the file for the old timeline's numbers** — a hit is a
stranded element.

---

## Verification discipline

- **A passing snapshot is not proof the encode is correct.** Snapshots evaluate the
  composition; the render has its own frame-capture path with its own bugs. Always sample the
  encoded mp4 itself before delivering — that is the only artifact anyone watches.
- **Debug render-path bugs with a DRAFT PROOF RENDER**, not the real one:
  `--quality draft --fps 5 --crf 34 -o renders/proof.mp4` renders a 56 s reel in ~3 minutes
  instead of an hour, and reproduces compositing bugs faithfully. Test each hypothesis on a
  proof.
- **QA loop:** `npm run check` → `npx hyperframes snapshot --at <beat times>` → read the contact
  sheets and check them against this skill → fix → re-snapshot. Check **every beat plus
  boundary frames (±0.05 s around cuts)** before rendering. Then verify the encoded mp4 too
  (sample frames + `volumedetect`).

---

## Colour — the HDR trap

**Modern phones shoot HLG/bt2020. Everything filmed on a recent phone is real HDR.**

If you let those tags through, HyperFrames sees HDR media in the composition and renders the
**whole** video as HEVC 10-bit bt2020/arib-std-b67 — including the bt709 A-roll. Every player
then applies an HDR→SDR transform and the result is milky, desaturated and low-contrast. It
reads as *"a weird grade you applied."* Nothing was graded; the file was simply mislabelled.

**1. Check the source before you cut it**

```bash
ffprobe -show_entries stream=color_space,color_transfer,color_primaries
```

`bt2020nc / arib-std-b67` (or `smpte2084`) = HDR.

**2. Tone-map HDR B-roll to SDR at build time — and MIND THE ORDER**

Convert primaries to bt709 **in linear light, before** the tonemap. Tonemapping while still in
bt2020 primaries and converting afterwards leaves everything milky and hue-shifted — a second,
separate bug from the container tags, and it gets caught too.

```
zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,
tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv
```

plus `-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv`.

**3. Pin the master** in the final ffmpeg pass with the same four flags and `-pix_fmt yuv420p`,
then **assert**: fail the build if `bt2020|arib-std-b67|smpte2084` appears in the output's
probe. `scripts/finish.py` does exactly this.

**4. NO CREATIVE GRADING — with one authorised exception**

The standing rule is: *"don't make any colour adjustment to any of the clips; use the raw colour
that comes with them."* That holds for the A-roll and for anything already native bt709 —
**phone screen recordings are native bt709 and correctly exposed; never touch them.**

The exception, which has to be asked for: *"just lower the exposure and raise the contrast a bit
on the phone footage — right now it looks too bright and un-contrasted."* Even a correct
tone-map lands HLG camera footage flat and bright, so **HLG camera clips only** get:

```
eq=contrast=1.20:gamma=0.88:saturation=1.06     # right after the tone-map
```

Use `gamma < 1`, **not** a negative `brightness` — brightness is a straight offset and crushes
the black point (measured: 7–12% of pixels at ≤3). Sanity-check mean/σ/clip stats across five
frames before committing: σ should rise, mean should fall, clipHi should stay under ~5% except
on shots of a genuinely white webpage.

> The gradient-card grade in `references/layout.md` is a separate, explicitly-requested
> treatment for rescued B-roll cards. It does not license grading anything else.

**5. Verify by eye, not by tags alone.** Pull the same timestamp from the master and from the
source and put them side by side. Washed skin tones and a dull background are the tell.

---

## Scale — never punch in on phone footage

> *"All the phone footage is scaled and zoomed in too much. You shouldn't zoom in or out. I shot
> it that way so you wouldn't have to."*

- **No crop boxes on B-roll.** Not to make a UI more readable, not to hide a bezel. A 2160x3840
  `.MOV` is exactly 0.5× to 1080x1920, one to one.
- **No timeline `scale` on full-frame B-roll clips either.** Zoom moves belong on the A-roll
  only.
- **Phone screen recordings** (typically 1180x2556) get
  `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920` — that fills the width
  at native scale and only loses the status bar and home indicator. Do not hand-author a crop
  box "to frame it better."
- **Consequence you must accept:** a wide shot stays wide and its on-screen text stays small.
  That is the creator's call, not yours. **Flag it; do not fix it with a punch-in.**
