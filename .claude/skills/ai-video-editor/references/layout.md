# Layout system

All geometry below is for a **1080 x 1920** frame at 25 fps. Numbers marked *landed* are real
values that survived review — good starting points, not constants. Solve them per shoot.

---

## The platform safe zone — this constrains framing, not just graphics

**Nothing that must be read may sit above y≈200, below y≈1430, or right of x≈950.**

Instagram / TikTok / YouTube chrome covers the top status bar, the entire bottom
caption-and-button strip, and the right-hand action rail. A card row whose labels sat at y=22
gets cropped away on all three platforms.

Every logo card, label and caption slab goes inside **y 200–1430, x 0–950**. Within that band,
keep the caption plate well clear of the mouth: measure the chin and leave **≥200 px**.

---

## The hook

The hook is the whole video's audition. Three designs, in order of how often they are right.

### A. Cut-out on a blurred version of the same shot (the default)

> *"Cut me down from the background. Add a slight blue and teal gradient into the background.
> Blur the background, but don't scale the video up or down. Don't adjust my position. Add the
> animations behind me."*

- **Backdrop** = the same hook clip, `gblur=sigma=32` **only**. No scale, no crop, no eq.
- **Over it**, a CSS wash: two soft radial gradients (teal `rgba(46,196,214,.34)` upper-left,
  blue `rgba(48,110,232,.36)` upper-right) over a `linear-gradient(168deg, …)` navy base.
- **`#matte` gets no transform** *unless the hook carries a graphics cluster*. A bare hook =
  native size and position.
- **A hook with a logo/graphics cluster** = `transform-origin: 50% 100%` +
  `tl.set(scale 0.80, y 24)`. That shrinks the speaker and drops the hairline from ~340 to
  ~656, opening a clean 200–650 band for graphics. Bottom-anchored is the only correct origin —
  anchoring anywhere else slides the chin around.
- **Never scale below ~0.78.** The speaker is the channel, not an inset.
- **Graphics go BEHIND the matte** (z-index below `#matte`) and are simply occluded where the
  body covers them — that *is* the look. Measure the union of the alpha across the hook to
  find the free bands (typically **x 0–185 left and x 740–950 right, between y 230–760** at
  native scale). Park the brand tile in one band and the app tiles in the other; wires run
  behind the head and re-emerge, which reads as "connected through them."
- **Cut out of the blurred hook onto plain A-roll at the first segment boundary after the hook
  sentence** — a blurred backdrop under a step graphic is confusing.

#### Matte a WIDER source than the frame whenever you intend to scale the roto down

If the subject touches the frame edge in the source — and a gesturing arm almost always does
at the bottom left — the alpha has a dead-straight cut at x=0. At native scale that cut *is*
the frame edge and is invisible. At scale 0.80 it lands at x=108 and reads as **"a hard mask
crop instead of a clean rotoscoped mask."**

Cut the matte source from the high-res raw with the crop widened to the left (e.g. raw
x 0–1996 instead of 328–1996 → a 1292x1920 source), matte *that*, and hang it at:

```css
#matte { left: -212px; width: 1292px; inset: auto; object-fit: fill;
         transform-origin: 58.2% 100%; }   /* (540 + 212) / 1292 */
```

The `transform-origin` must be the **frame's** bottom-centre expressed in **element**
coordinates, not `50%`, or the scale pivots off-centre and the subject slides sideways.
Verify by reading the alpha at element x=0: it must be 0 on every row.

#### Clearance is the thing that gets judged

Not either element's absolute position — raising both by the same amount changes nothing.
Work it as an equation:

```
head_top = 1920 − (1920 − src_head_top) × scale + y
```

then place the graphics tile so its bottom clears that by 20–40 px.
*Landed:* scale 0.80, y −31 → head_top 625; tile top 205, 400 px tall → bottom 605.

### B. Cut-out over B-roll (product / demo hooks)

RVM matte cutout anchored bottom-left (`transform-origin: 0% 100%`), B-roll full-frame behind.
Set the transform **only** via a GSAP `fromTo` — a CSS transform plus a GSAP tween is a lint
error and a conflict.

- **Sit the speaker LOW and LEFT so the B-roll breathes.** The hook B-roll is what sells the
  video; the speaker must never crowd or cover the product. Anything near `y: 20` buries it.
- **Hold them CONSTANT for the whole hook** — `tl.set`, never a `fromTo` scale drift. A
  0.74→0.77 creep reads as *"you changed my position on the third second."* One static
  transform, period.
- **They must never be small in the hook.** Too small reads as a stock clip.
- Cropping a shoulder off-frame is fine. Hook captions move up (`top: 470–560`) to clear them.

*Landed examples:* `x −185, y 330, scale 0.76`; `y 215, scale 0.70`; `x −170, y 225,
scale 0.84`.

### C. Three-band hook (text-heavy B-roll: a terminal, an app, a document)

Captions may not sit on the source's own text, and scaling the matte up raises the hairline —
the two constraints fight. Solve it by stacking:

| band | content |
|---|---|
| top | the source's text, window pinned to the top, content ending ~410 |
| middle | the caption, `top: 470` |
| bottom | the speaker, hairline ~650 |

Make the window itself **fill the frame** (`height: 100%` + a large `padding-bottom`) so the
area behind the speaker is dark app surface, not dead black — they then read as standing in
front of a screen rather than floating on a void.

Solve scale **from the caption**, not the other way round:

```
scale = (caption_bottom + 45 − y) / (1920 − matte_head_top)
```

*Landed:* matte head_top 259, `scale 0.765, x −190, y 0` → hairline 649.

### Hook rules that apply to all three

- **A hook spanning two takes with different framing needs two transforms.** One static matte
  transform cannot serve both — measure `head_top` per take and hard-`set` on each sentence
  cut. (A 386 px vs 90 px difference between takes crops the head clean off.)
- **The hook ends where the NEXT SENTENCE starts, not at the retention line.** The retention
  line ("and that's not even the craziest part") is still hook. Whatever timestamp you pick,
  the matte, the riser, the flare/impact and the music handoff must **all** land on it — and
  the matte has to be re-run to cover the longer hook.
- **Cut away to the full A-roll on the curiosity question.** The rhetorical question that
  closes a hook wants the speaker full-frame and nothing else — no card, no matte, no panel,
  just plain A-roll with a slow push. It reads as the camera leaning in, and it gives the
  graphic that answers the question something to land against.

---

## Matting (RVM)

Use **Robust Video Matting** via `scripts/matte.py`. Never use a generic
`remove-background` / u2net path — it bleeds on hair and beard.

Parameters that matter, all in the matte script rather than the model choice:

| Parameter | Wrong | Right | Why |
|---|---|---|---|
| `downsample_ratio` | 0.25 | **0.45** | 0.25 runs the network at 270 px wide on a 1080 frame and chews the hair edge. RVM wants the downsampled short side near 512 px. |
| VP9 `crf` | 18 | **10** | crf 18 re-quantises the alpha edge away. |
| backbone | `mobilenetv3` | **`resnet50`** | ~3× slower, visibly cleaner hair. |

Tighten the alpha **without hard-thresholding**, which kills the gauzy halo but keeps a real
soft ramp for hair:

```python
pha = smoothstep(clip((pha - 0.06) / 0.88, 0, 1))
```

**Verify it, don't assume.** Composite one frame over magenta and zoom the hairline —
individual strands must resolve. Log the `partial-alpha / solid` pixel ratio: **~0.017 is a
good sharp matte**; a much larger number means the edge is still mushy.

Only matte the span you actually show, and **re-matte whenever the hook's in/out points move.**

**Reading a matte's alpha needs the explicit decoder:**
```bash
ffmpeg -c:v libvpx-vp9 -i matte.webm -pix_fmt rgba ...
```
Without `-c:v libvpx-vp9`, ffmpeg flattens alpha to 255 and every head-detector returns row 0.

---

## After the hook: no matting, ever

Plain A-roll, speaker in the lower half.

**Split state** = `scale 1.02, y <N>` with `transform-origin: 50% 30%`, under a **900 px top
panel**. Full head visible below the seam, never cropped, and scale ≥1.02 so no black side
bars appear.

**`y` is per-shoot, not a constant.** Solve it, don't guess:

1. Measure the top of the hair in the raw A-roll — sample ~12 frames, mask
   `luma < 62 & |g − b| < 40` over the central columns, take the **minimum** (the tightest
   framing).
2. With `transform-origin: 50% 30%` on a 1920-tall frame:
   `screen_y = 576 + (raw_head_y − 576) × scale + y`

**Aim the hairline at ~870–900** — tucked just under the panel. 950–980 sits them too low.
Hair may be cropped a little; **eyes, forehead and the whole face must be clear of the seam.**

**The hook matte and the body A-roll are usually framed differently — measure the matte itself,
never reuse the body's `head_y`.** For the matte:
`screen_y = 1920 − scale × (1920 − matte_head_top) + y`, keep **y ≥ 0** so the cutout stays
grounded at the frame bottom (a negative y exposes a hard horizontal cut across the torso),
and aim the hairline at ~660 so a hook card sits above them.

Verify on a rendered snapshot. A detector that returns exactly 900 is a false positive — it
latched onto the panel's own dark bottom edge. Eyeball that frame full-size.

**Scale is the only lever for "bigger."** Lowering `y` moves them down; it does not enlarge
them.

**Full-screen state** = `scale 1.02, y 0` with a slow push (→ ~1.08–1.09) held to the next cut.

---

## Reframing: bake the crop, never a CSS transform

When the layout needs the speaker lower or bigger — to clear a graphics row, or because the
top of frame is dead space — crop the 9:16 window straight out of the original 2160x3840 (or
whatever the raw is). Full resolution, and a crop is *physically incapable* of exposing a
black edge. A CSS scale/translate can, and it gets caught: *"make sure there are no dark spots
or space."*

Solve the crop with `hair_top` measured in the **original** frame:

```
hair_out = (hair_top_orig − Y) × 1920 / H_crop
W_crop   = H_crop × 9/16
X        = centred on the face (measure it — people are rarely centred)
```

**Hard limit:** `hair_out_max = hair_top_orig × 1920 / 3840` at zoom 1. Pushing them lower
**always** costs zoom — there is no footage above the head to borrow.

### Recentre in the SOURCE, not in the composition

The standing note is *"I'm about 10% too far to the right — scale me up a tiny bit and put me
in the middle."* Measure it, don't eyeball it: a facial-skin mask
(`r>95 & r>g+16 & g>b+6 & 40 < r−b < 130`) over rows 150–820, take the largest column run, and
its centre is the face x.

**A composition-level x-shift cannot fix it.** Shifting by *d* requires
`scale ≥ 540 / (540 − d)` or you expose black at the frame edge — so centring 123 px *forces*
a 1.295× punch-in. Do it as a crop on the raw instead:

```
crop=1668:2964:x0:0,scale=1080:1920
x0 = clamp(face_x_raw − 834, 0, 492)     # measured PER SEGMENT — people drift across a shoot
```

Same in/out points → every caption and layout timing stays valid. Bonus: the vertical crop
drops the legs out of frame, which is usually what the hook wants anyway.

**Guard the measurement:** when someone reads off their phone the skin blob becomes their
hands. Reject samples outside a plausible band and fall back to the shoot median.

**Re-audit the framing on the OUTPUT and fold the residual back.** A single measurement pass
is not enough.

**Two takes at different camera framings shown back-to-back at native scale** will expose the
wider one's lap/desk. Fix it as a tighter crop on the raw **for that segment only** (a
`VF_OVERRIDE` map keyed by segment name) — same in/out points, so no timing changes and no
upscale.

### A section with no graphics gets its own tighter framing

When the speaker stops listing and just talks to camera (the CTA), an empty top reads as a
mistake. Punch in and put the hairline back near the top — their normal framing — **plus a
constant 3% push** (`tl.fromTo("#aroll", {scale:1}, {scale:1.03, ease:"none"})`; scaling up
from a centre origin can never expose an edge). Change it on a hard cut that already exists.

When they fill the frame like this there is no headroom for a top-anchored graphic: move the
follow/CTA chip **down below the chin** (landed y≈1010), which also reads more like the real
platform button.

---

## Raising the subject and enlarging a top graphics row are the SAME budget

The centre column of any card row sits over the head, so:

```
row_height (label + card) ≤ hair_out − top_safe_margin − clearance
```

and raising the speaker lowers `hair_out` one-for-one. "Make the logos 2× bigger" and "raise
me a bit" arriving together usually cannot both be met.

**Say so, pick a compromise, and state the trade-off.** *Landed:* raised 35 px (hair 470→435),
top margin 150, and let the **centre** card overlap the very top of the crown by ~20 px (within
the stated hair tolerance) to buy back height — logo 108→200 px (1.85× linear, 3.4× area), tier
text 42→56 px.

Note the logo is **height**-limited inside the card, never width-limited: widening cards buys
nothing.

---

## The gradient-card treatment

Use this whenever the B-roll is watermarked, soft, or carries burned-in foreign-language text.

> *"Crop the video so only the B-roll is shown, and put a blue, dark and teal gradient behind
> it. Make it very dark and contrasty, and crop the video from all four sides with the gradient
> behind it."*

The gradient is the **background of the whole frame**; each B-roll clip is a rounded card
floating on it, inset on all four sides. This kills watermarks and headlines (they crop away)
and hides softness (a smaller on-screen rect = less upscale), which makes it the default
rescue for reposted social footage.

| card | size | top | used for |
|---|---|---|---|
| HOOK | 940 x 620 | 60 | hook beats — sits fully above the head, nothing hidden |
| PANEL | 940 x 620 | 90 | inside a 900 px gradient panel; caption at 780 falls below the card |
| HERO | 980 x 1440 | 250 | full-frame beats; caption centred at 900 lands on the card |

```css
.card { border-radius: 34px;
        box-shadow: 0 34px 92px rgba(0,0,0,.82),
                    0 0 0 2px rgba(64,214,222,.26),
                    0 0 90px rgba(26,140,180,.20);
        inset: auto; }   /* set inset:auto FIRST or the global video rule wins */
```

Gradient: stacked radials (teal top-centre, blue bottom-left, teal right) over
`linear-gradient(168deg,#08202e,#051520 38%,#020a10 72%,#01060a)`, plus an `::after` vignette.

**Do not make the hook card taller than the head position** — a 900-tall hook card puts the
interesting part of the shot behind the speaker and the claim stops reading. Size it so its
bottom edge ≈ the hairline.

Grade — this is what "very dark and contrasty" means in practice; cold but still **readable at
card size**:

```
hue=s=0.26,eq=contrast=1.34:brightness=-0.13,
curves=r='0/0 0.35/0.22 0.75/0.62 1/0.80':
       g='0/0.02 0.35/0.29 0.75/0.72 1/0.90':
       b='0/0.06 0.35/0.38 0.75/0.82 1/0.99',
vignette=PI/4.2
```

Already-dark sources take a harder one: `contrast=1.44:brightness=-0.20`, `vignette=PI/3.8`.

**Tint the lens flares to match** (`filter: hue-rotate(152deg) saturate(0.9)`) — a stock flare
is warm orange and washes the whole frame amber for ~0.3 s against a cold film.

> This grade applies to **B-roll cards only.** The A-roll and anything already correctly
> exposed is never graded — see `references/hyperframes.md` §colour.

---

## Punch-in on the speaker

> *"Zoom in to my body, 30–35%, motion blur, easy ease."*

You **cannot** wrap the matte in a timed div — HyperFrames freezes video nested inside another
timed element. Animate `#matte` itself: raise `scale` **and** `y` together so the
bottom-centre origin keeps the face anchored while they grow.

*Landed:* `scale 1.12 → 1.49`, `y 440 → 1008` held the hairline at 642. Add
`filter: blur(0 → 7px → 0)` across ~0.5 s as the motion smear, `power3.inOut`.

---

## Full-frame vs split — when each wins

- **B-roll plays full-frame, not as a top panel, whenever the B-roll IS the instruction.** For
  a tutorial where each step is a screen recording, drop the 900 px split entirely — the step
  *is* the shot. Keep the speaker full-screen for the talking beats between steps, with a
  constant slow zoom (≈1.02 → 1.16 over the whole beat, `ease: "none"`), never a crash zoom.
- **A B-roll run holds.** If one sentence explains one action, the whole sentence stays on the
  shot, even if that means chaining two or three clips to fill the window. A 1.5 s dip back to
  the face mid-demo reads as a mistake. Chain clips from the same session so the run is
  continuous, and check the caption slot table covers the whole run as one beat.
- **Hold the last B-roll to the next sentence's real audio onset, not to the transcript
  timestamp.** Whisper's start sits ~200 ms early; cutting on it lands the A-roll on silence,
  which reads as cutting away too soon. Gate at −26 dB over a 20 ms window across the boundary
  and quantise the result to a whole frame.
- **The payoff / gag shot goes full-screen, never split.** When the B-roll *is* the joke or the
  reveal, splitting it with a talking head kills it. Run a montage as fast full-frame cuts
  (~0.6–0.8 s each) and put the funniest/strongest shot **last**, right before the CTA.
- **The speaker is on screen nearly always** — two or three short full-screen B-roll stretches
  per reel, maximum. Ending/CTA: speaker full-screen + captions + share pill, no B-roll.

---

## Cut discipline

- Cuts between states are **hard sets** (`tl.set`) exactly on sentence starts. A cut must never
  land mid-silence or before the sentence begins.
- **No transition on any B-roll — ever.** No whip-pan, no pop/scale-in, no slide, no zoom, no
  `scale`/`x` tween on a panel or full-frame B-roll clip. B-roll cuts in and sits there.
  (The flare/bloom at the hook turn and the slow push on full-frame A-roll are the only
  exceptions.)
- The **opening** B-roll or card starts at `data-start="0"` — frame one, not frame two.
