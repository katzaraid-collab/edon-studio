# B-roll and graphics

---

## Editorial rules — these matter more than polish

- **Every B-roll clip must have a direct, obvious reason tied to the sentence being said.** No
  abstract filler: no bokeh water, no empty walls, no wide drone scenery, no amateur phone
  footage. Premium tight closeups and medium shots.
- **The claim must be PROVEN on screen.** If the line is "beat the competitor" or "15 seconds
  faster" or "cheaper than X", the B-roll or a graphic must **show** the comparison with the
  real figures. An assertion with generic footage under it reads as hype; a comparison card
  reads as proof — and comparison frames are what people screenshot and share.
- **Never crop away the proof.** When using footage that contains a result card or a number,
  verify at full frame that it survives the 9:16 crop. Losing it turns evidence into decoration.
- **The payoff shot must be the product.** When a curiosity loop pays off (especially a price),
  the frame must be the clearest, most unmistakable full shot of the subject in the whole edit
  — never an abstract closeup, light streak or texture. The viewer has to connect number →
  object.
- **The visual must never contradict the voiceover.** Do not show a dash reading 45 km/h under
  "0–100 in 2.5 seconds." Check every stat beat for this.
- **Never invent a number** to make a receipt look good. If the source publishes no figure,
  show the *relationship* (equal bars, "no difference"), never a made-up one. Verify the
  claim's facts and flag mismatches to the creator — but design the graphic so nothing on
  screen contradicts what they said.
- **No other people in the B-roll.** Any shot standing in for the speaker must *be* them, and
  generic lifestyle shots must be people-free (an empty fitting room, a car POV with no driver,
  a returns box with no hands). Stock clips with strangers' faces are out.
- **Never generate AI stand-ins for identifiable real people.** If a specific named team or
  person has no public footage, do not generate fake people and label them as that team — that
  fabricates a record. Generate an unattributed generic scene (figures from behind, in
  silhouette), keep the on-screen text about the organisation, and say what you did.
- **All on-screen graphics are in the audience's language.** Comparison cards, labels, tags.
  See the exception below.

### Exception: technical terms of art stay in English, as a designed wordmark

> *"Instead of writing [the translated phrase], write it in English in a styled font."*

A term of art (`pre-training`, `context window`) is treated as a **designed wordmark**, not as
body copy:

```css
direction: ltr; font-weight: 900; font-size: 62px;
letter-spacing: 6px; text-transform: uppercase;
background: linear-gradient(92deg,#7ff0e4,#4fe6d8 38%,#6fa8ff);
background-clip: text; color: transparent;
text-shadow: soft teal;
```

Animate with **transform only** (`scaleX 1.28 → 1` + `opacity`). Tweening `letterSpacing`
trips the `gsap_non_transform_motion` lint, because layout properties snap to integer device
pixels.

**Delete any kicker that repeats the caption.** A card explains what the caption cannot; it
never says the same thing twice.

---

## Sourcing B-roll

### Screenshot / product B-roll — shoot it yourself with headless Chrome

The best option for any software or AI topic: no downloads, no strangers, always on-topic.

Drive Chrome with `puppeteer-core`
(`executablePath: /Applications/Google Chrome.app/Contents/MacOS/Google Chrome`).

- **Set the viewport to the panel aspect** — `1080x1015` at `deviceScaleFactor: 2`, clip
  `y:45, h:900` — so the app lays itself out to fill a 1080x900 top panel and the sidebar
  auto-collapses. Do **not** hide nav via JS; that blanks most SPAs.
- **Type a real prompt into the product** before the shot. It shows the audience actually using
  it.
- As a panel background, `center 25% / 112%`. 100% reads sparse; ≥146% clips UI chips mid-word.
- **Never sign up or log in** to get a better screen.

### CLI / terminal topics — capture the REAL program in a PTY

Do not mock a terminal. `pty.fork()` + `pyte` gives you the actual TUI with keystrokes injected
on a timer; render the emulator's screen buffer to HTML and screenshot it with Chrome
(`scripts/pty_capture.py`, `scripts/render_term.py`). Everything on screen is then genuinely
what the tool printed.

Rules learned the hard way:

- **Capture NARROW.** 96 columns renders as unreadable 13 px type on a vertical frame. Use
  **76 cols** for a 1080x900 panel, **68** for full-frame, **52** when the shot is the payoff
  and must be big. Auto-size the font from the capture's column count (Menlo advance =
  `.6015em`).
- **`line-height: 1.16` max** — box-drawing characters (`╭─│╰`) break into dashes at 1.45.
- A TUI needs **~10–13 s** to finish first paint. Typing at 3 s captures a blank screen.
- Run it in a **clean folder with no MCP config**, or it opens on a trust prompt. Many TUIs
  show a **trust-folder prompt on a new directory** — send `\r` before anything else or every
  snapshot is that dialog.
- **Redact at the emulator buffer level, not in the HTML.** Colour changes split a line across
  spans, so a string replace on the markup misses. Pad the replacement to the original length
  or you leave a stray tail character. Redact any email address, rewrite the cwd to something
  clean, and blank transient error/status lines.
- **Type the prompt one chunk at a time and snapshot each step** → a real typing animation
  (`scripts/shoot_typing.py`). This is content motion, not a B-roll entrance, so the transition
  ban does not apply. A **progressive** terminal (prompt → tool call → result, same window,
  hard cuts) is the best hook B-roll there is: it grows in place like the real thing.
- **The permission dialog is the money shot** — a real tool call plus "Do you want to proceed?"
  is simultaneously the receipt for "it'll ask you a few things" and proof the tool is real.
  Capture it by sending a prompt and simply not answering.
- **`--help` output of the actual script** is a free, honest receipt for a capabilities claim.
- **Two consecutive panels must not look the same.** A boot screen followed by a
  boot-screen-with-typing reads as a frozen frame. Start the typing clip several frames in so
  text is already visible at the cut, or make one of them a different surface.

### Downloaded footage

- **Always ask for approval with the exact URL list first.** Download with `yt-dlp` at 1080p
  mp4.
- **Detect scene cuts** (`select='gt(scene,0.30)'`) across the exact window before cutting — a
  hidden cut inside a "clean" stretch reads as a mistake.
- **Cropping 16:9 to 9:16: MEASURE the face x, never estimate it.** Render one source frame
  through `scale=960:540,drawgrid=w=96:h=540` with labelled columns, read the face centre off
  the ruler, then `crop=607:1080:(face_x−303):0,scale=1080:1920:flags=lanczos`. Guessing puts
  people half — or entirely — out of frame. The same crop usually drops a broadcaster bug in
  the top-right; confirm that it does.
- **Letterboxed sources** (2.39:1 promos, telemetry layouts) have black bars baked in. Crop
  *inside the active image area* first — for 2.39:1 in 1920x1080 the active area is 1920x803 at
  y=138 — or the vertical frame inherits the bars. If a source's own overlay contradicts your
  graphic, pick different footage; do not scrim over it.
- **Tutorial / reaction B-roll has a webcam PIP** (usually bottom-right, ~630x480 of 1920x1080)
  and browser chrome. Choose crop rects that exclude both. If the subject only exists inside
  the PIP's rect, use that source as a 1080x900 **top panel** (cropping above the PIP) rather
  than forcing a full-screen vertical.
- **Check the FIRST frame of every cut** — pages mid-scroll or mid-transition look broken;
  nudge the in-point ~0.4 s later.
- **A B-roll in-point must include the payoff.** If a shot exists to prove a click, a menu
  choice or a transition, the action must be **on screen**. Scan the source for it — a
  Laplacian-variance sharpness scan doubles as a "what is happening when" map — and set the
  in-point so the payoff lands inside the window.

### Broadcast / reality TV sources have three baked-in layers

Measure them **once per source at full res** before cutting. Typical values for a 1920x1080
broadcast master: burned-in subtitles at **y 880–980**, a channel bug **top-right
(x>1650, y<200)**, and on "best of" montages a reaction **PIP bottom-left** plus a decorative
border.

- **Top panel** = `crop=1044:870:X:0,scale=1080:900` — the 870 height crops the subtitle band
  away and `X ≤ 606` drops the bug. This is the safe default; use panels wherever possible.
- **Full-screen 9:16** = `crop=607:1080:X:0,scale=1080:1920:flags=lanczos` **keeps** the
  subtitle band, so it is only safe in subtitle-free windows. **Find them programmatically** —
  sample the band at 5 fps, score bright-edge energy, keep runs under threshold.
  Dialogue-heavy clips often have **zero** clean 2.5 s windows; the clean ones live in
  finale/celebration/graphics segments.
- A leftover subtitle from the *previous* shot bleeds over the next one, and scene cuts land
  mid-clip. Always detect cuts and keep each B-roll clip inside **one** shot, then sample
  start / mid / end — not just the middle — to prove it.
- Never crop so a burned-in graphic is **clipped mid-word**. Include it whole or crop above it
  entirely.

### AI-generated B-roll of the speaker

The default when the product is unavailable locally or the creator is not on camera for it.
Use whichever image/video generation MCP or API is configured — the workflow, not the vendor,
is what matters:

1. Upload the creator's source photo.
2. Generate at **9:16, 2k**, one call per variation, 2 options each. Prompt for *"the SAME
   person as in the reference image — keep their exact face, hair and physique… full body,
   plain light grey studio background…"*. Identity holds well; verify by cropping the face next
   to the source.
3. **Composite shots:** feed BOTH the generated result and a reference for the framing, and
   describe the UI. Then **lock every later shot to the FIRST good one**: *"Recreate the
   reference EXACTLY — identical hand, phone position and lighting — change ONLY what is on the
   screen."* Skipping this gives you a different hand in every shot, which reads as a different
   person.
4. **Animate** with an image-to-video model at 9:16, 5 s, sound off. `start_image` +
   `end_image` does a clean morph — that is how a "before → after" hook reveal is built. Fix
   the output to the timeline: e.g. `scale=1080:1936,crop=1080:1920:0:8` and `-r 25`.
5. **Still → panel clips get NO motion.** Static is correct (see the transition ban).

### News-article B-roll — the documentary device

> *"Cut away to B-roll of the articles that report it. Download as many articles as possible,
> add a click shutter effect, and overlay an old newspaper texture — documentary-style."*

The default way to pay off any hard news claim.

- **Capture, don't download.** Headless Chrome screenshots the live article — no files, no
  licences. Viewport `1280x1400 @ deviceScaleFactor 2`, clip `1280x1100`.
- **Launch a FRESH browser per URL with its own `userDataDir`.** One shared browser dies partway
  through (`Target.createTarget: Session with given id not found`) and every capture after it
  silently fails. Use `headless: 'shell'` + `--no-sandbox`.
- **Strip consent walls gently.** Removing every `position: fixed|sticky` element blanks whole
  sites. Remove only `[id*=onetrust]`, `[class*=consent]`, `[id*=gdpr]`,
  `[class*=cookie-banner]`, `[role=dialog]`, then scroll to top.
- **Expect ~30% duds** — 404s, JS walls, paywalls. Capture 10–12 to keep 7–8. **Always eyeball
  the contact sheet**: a blank white card and a "page does not exist" card both look like
  successes in the log.
- **Card build:** find the headline row (densest run of large dark glyphs below the masthead),
  crop a 1.516:1 window at `headline_y − 0.42 × h` so masthead *and* headline are legible at
  940x620. Then desaturate ~58%, cool it (`× [0.94, 0.97, 1.06]`), and multiply a procedural
  **newsprint** layer — 3.4 px halftone lattice + fibre grain (σ 0.045) + low-frequency age
  blotches + vignette. Auto-detection latches onto mastheads and ad slots, so keep a
  per-article `Y_NUDGE` override and check every card.
- **Rhythm:** one article per caption card (~1.2–1.7 s each) with a **shutter click on every
  cut**. Order them claim-first, receipt-second.
- Article cards are also the answer to "find other clips instead of repeating the same ones"
  when stock is unavailable — 8 article cards add far more variety than 2 more low-res clips.

> **Free stock sites without a login are usually a trap.** Search pages often only expose
> ~360p `*_tiny.mp4` previews, and their SFX need a player API. Do not burn time there; build
> the sound from your own library instead (e.g. a guillotine = metal swish → low impact 0.16 s
> later → paper rip 0.05 s after that, ×3 hits, `alimiter=limit=0.89`).

---

## Logos

### Download the real thing — never draw your own

Fifteen hand-built SVG approximations get one note back: *"all the logos are wrong — download
transparent PNG logos."*

Pipeline that works:

1. **Icon-only, never a wordmark** — the card already prints the name, so a wordmark says it
   twice. Try, in order: Wikimedia Commons `File:… icon ….svg`; the brand's own
   `<link rel="apple-touch-icon">`; `google.com/s2/favicons?domain=…&sz=256`.
   *Google sub-products return the generic Google "G" from the favicon service — use Commons
   for those.*
2. **Rasterise SVG with headless Chrome** (`--default-background-color=00000000`), 512 px.
3. **Key out a flat background only if it is LIGHT** (median > 210) and flood **from the
   border**, so white inside a mark survives. Dark backgrounds are the app-icon tile itself —
   keying those destroys the mark.
4. **Autocrop to content, centre on a square transparent canvas**, so every card reads the
   same.
5. **Eyeball a contact sheet of all of them on white BEFORE building.** That is what catches
   wrong-brand favicons.

Some sites (notably a few large AI vendors) return **403 to curl and a JS wall to headless
Chrome** — you get an HTML document with a `.png` filename. Do not keep retrying; render the
mark as inline SVG on a dark rounded chip instead.

### Show logos, don't write names

> *"Don't write the product names. Show their logos."*

A text chip with a product name reads as a placeholder. Any card naming products uses their
real marks.

**A logo on a dark card needs its own tile background**, not a bare cutout — a transparent PNG
on a teal gradient loses its silhouette. Give every mark a chip.

*Landed chip styling:* 152x152, `border-radius 36px`,
`box-shadow: 0 16px 44px rgba(0,0,0,.6), 0 0 0 2px rgba(255,255,255,.10)`, in a
`display:flex; gap:54px` row, popped in staggered 0.16 s, `back.out(2.4)`.

---

## Motion-graphic cards you build yourself

> *"Level the production up — more motion graphics and effects, but use your wisdom, don't just
> add stuff."*

### The card system

A plain white-text-on-dark card is a fail. What landed:

```css
background:
  radial-gradient(96% 90% at 50% 0%, rgba(38,168,190,.30), transparent),
  linear-gradient(163deg, rgba(14,56,78,.96), rgba(6,26,40,.97) 55%, rgba(3,14,22,.98));
border-radius: 34px;
border: 2px solid rgba(64,214,222,.30);
/* + inner top highlight, + outer teal glow */
```

Type ramp: `.kicker` 34 px `#4fe6d8` / `.huge` 168 px white with a 46 px teal text-shadow /
`.mid` 76 px `#eafcff` / `.sub` 40 px `#7fd4e8`. Accents: teal `#4fe6d8`, blue `#3d8bff`.
*(All of this is themeable — put your palette in `config.json → brand`.)*

**Every card animates.** Chips pop `back.out(2)` staggered 0.14 s; bars rise `scaleY 0→1`
staggered 0.17 s; big numbers pop `scale .42 → 1.09 → 1.0` `power4.out`. A static card reads
cheap. Give each animated element a `tl.set(...)` hard kill at the card's out-point (lint rule).

**Leave the caption band empty.** A card is a *background* for a caption, not a competitor.
- Panel card (1080x900): keep content out of **760–900** (`padding-bottom: 200px`).
- Full-frame card: it shares the frame with a centred caption at ~930 — build content above and
  below that line.

**A card must never repeat its own caption word for word.** A card that says the same thing as
the caption underneath reads as a bug. Reframe it (kicker "the price" → huge "free") or drop
its text to a label and let the caption carry the line.

**A frozen graphic card reads as a dead frame** — *"it's too frozen, I want it alive."* Cheap
and shallow beats flashy: a breathing radial glow (yoyo scale/opacity ~1.2 s), a dot lattice
drifting via `backgroundPosition`, and a tiled grain PNG whose `backgroundPosition` jumps every
2 frames so it boils. Keep it under ~12% of pixels changing per frame; prove it by diffing
consecutive snapshots of a background-only region.

### Reveals are an UN-BLUR, not a pop

> *"The animation should be an un-blur, not a pop jump animation."*

Put the element on screen from the start of its beat group with its **contents** frosted
(`filter: blur(20px)` on an inner wrapper, so the card's own rounded edge stays crisp), then:

```js
tl.to(inner, { filter: "blur(0px)", duration: 0.34, ease: "power2.out" }, beat)
```

Bonus: one element per slot instead of placeholder + card, so there is no same-track handoff to
get wrong.

**A panel must never sit empty waiting for its pop.** Fire the graphic on the cut, not on a
later word, or the panel is a blank rectangle for a beat.

### The device kit

- **Brand tile + glow** — a rounded square in the product's own colour with its real mark
  inside, popped `scale .35 → 1.10 → 1.0` `power4.out` over a radial-gradient glow that blooms
  and settles. Get the real mark by scraping the site's own SVG with puppeteer
  (`document.querySelectorAll('svg')`) and keeping the path; far better than redrawing it.
- **Connection / trim-path wires** — an `<svg>` of `<path>`s, `strokeDasharray = L;
  strokeDashoffset L → 0` over 0.46 s `power2.inOut`. Draw one per target, staggered on the word
  that names it. **Anchor the start point at the tile's POST-slide position**, not its layout
  position, or the wires float in empty space.
  **`strokeDasharray` must be ≈ the real path length.** With a dasharray far longer than the
  path, the stroke finishes drawing early and the rest of the tween is a no-op — the wire snaps
  in and then sits still. Set it per path (`[300, 190, 300]` for a 3-wire fan), never one
  blanket value.
- **Cursor + click** — an SVG arrow rising `y 700 → 0` `power2.inOut` over ~0.7 s, then a 0.07 s
  scale-down/up, a punch on the target (`scale .90 → back.out(3) 1.04`) and an expanding click
  ring (`scale .55 → 1.5`, `opacity .95 → 0`).
- **Numbered step chain** — circles popping `scale .25 → 1.12 → 1.0` with eased connector
  segments drawn between them (same trim-path device, so the video has ONE visual language).
  Every number gets its own pop cue.
- **Drifting emoji** — a device that works, but it has to be BIG, nearly opaque, and it must
  fully clear the tile. Two ways it fails: *"too transparent"* and *"I can't even see it."* It
  also has to **end hugging the tile** — a wide resting place gets rejected too. Travel just far
  enough to clear the tile's half-width plus the emoji's, and no further.
  *Landed against a 400 px tile:* a text div at `font-size: 210px`, `opacity .88`, travelling
  `x +292, y −20` — clears the tile's right edge with a ~15 px gap and stays inside the x950
  rail. z-index **below** the tile so it genuinely hides behind it.

### The step badge

Its anatomy is fixed: **the number on the RIGHT, the description on the LEFT, fused into ONE
shape**, both on the same accent colour with **white** text throughout — not a white label next
to a coloured circle.

- Build it as `display: flex` with the label first in the DOM (and `direction: rtl` on the
  label span only, for RTL languages).
- Put the drop shadow on the **container** (`filter: drop-shadow(...)`), never on the two
  children — per-child shadows draw a visible seam down the join.
- **The circle must be BIGGER than the bar.** Same colour + same height reads as one flat
  lozenge, and the note comes back: *"I just want the number to have its own circle, seamlessly
  integrated into the rounded square that wraps the description."*

*Landed:* bar `height 84px; border-radius 24px 0 0 24px; padding 0 82px 6px 32px;
margin-right -54px`, circle `108px`. The circle bulges 12 px above and below the bar so the
silhouette is unmistakably circle-joined-to-rounded-square, and the bar tucks exactly one
radius (54 px) under it so the join is invisible. **Label right-padding must exceed the tuck**
(82 > 54) or the text slides under the circle.

*Position:* `top: 224px; right: 134px`, sliding in `x +70 → 0` on the step's first frame. The
right edge must land inside the x950 rail.

### Scaling rules that are easy to get wrong

- **When you scale a container, scale the MARK inside it too.** Doubling a tile from 200 → 400
  while leaving the inner `<svg>` at 126 px makes the logo look *smaller* than before. The mark
  should fill ~80% of the tile (316 inside 400). Any glyph, icon or wordmark nested in a
  container is a second number that has to move when the container does.
- **Anything that "pops out from behind" an element must clear that element's HALF-WIDTH.**
  Dollar offsets, emoji travel, ring diameters — all of them scale with the tile; they are not
  fixed numbers. When a tile doubles to 400 px, old ±150 offsets land the coins *inside* the
  tile, and a 260 px click ring expanded 1.5× is still smaller than the tile.
  *Landed:* offsets ±270–300, click ring 380 px.
- **Size for a phone, not for a desktop preview.** A 200 px brand tile gets rejected as too
  small; **400 px** landed, with satellite tiles at **190 px**.
- **The whole cluster must sit inside the frame with real margins.** 34 px from the edge gets
  flagged: *"Instagram is going to cut that away with its crop."*
  *Landed cluster geometry:* satellite tiles `left 170` (x 170–360, tops 200/400/600); brand
  tile side pose `left 540, top 300` (x 540–940, comfortably inside the x950 rail); centre pose
  `CX = −200`. Wires run from the brand tile's left edge to each satellite's right edge.
- **A graphic that never clears the silhouette is invisible.** Measure the matte's alpha bounds
  per row band before deciding where a graphic travels; anything below `z(matte)` that stops
  inside the outline simply cannot be seen.

### Choreography order matters and gets judged

A running order that survived review, for a "tool connects to platforms" sequence:

1. the brand tile **pops in the MIDDLE, behind the speaker** (pop cue on the same frame)
2. the emoji beat plays there
3. the tile **slides out to the side**
4. the wires draw to the platform tiles (whoosh per connection)
5. the platform tiles clear, and the tile **comes back to the middle**
6. only **then** the cursor rises and clicks it, and the payoff pops

Author the tile at the **side** pose in CSS and treat the centre pose as one constant
(`const CX`), so the two `x` tweens can never drift apart. Everything that only ever happens at
the centre — emoji, cursor, click ring, payoff — is authored at the centre coordinates
directly, never as an offset.

### Colour and type on graphics

- **Tier/label text is ONE colour: white, no stroke.** Red/amber/green labels read cheap —
  "toy-ish". Use white with a soft shadow (`0 3px 14px rgba(0,0,0,.75)`) for legibility; a
  shadow is not a stroke.
- **Blurred price teaser** in the hook: accent green (`#35e06b`), blur ~15 px (must be
  genuinely unreadable), mid-upper frame, gentle rise + fade. Spikes curiosity without
  revealing.
- **Price reveal**: white, 168 px, fast pop (0.14 s `power4.out` overshoot → settle), **no
  rotation**.
- **CTA pill**: white rounded, an action phrase plus a share glyph, slides up + gentle pulse,
  ~top 1350.
- **Comparison card**: dark rounded rows, winner outlined green `#35e06b`, loser dimmed. Build
  it in HTML rather than relying on a crop of the source's own graphics.

### Never let a caption land on the B-roll's own text

Screen-recording and keynote B-roll carries its own headlines. Text-on-text reads as sloppy
even when legible. Fix in this order:

1. re-crop so the source text sits well clear of the caption band,
2. move that shot to a beat where it does not collide (a top panel puts its text at ~y300, far
   from a panel caption at 780),
3. **only then** move the caption.

Crop **out** foreign-language text rather than clipping it mid-word.

### Blur a speaker with an eased filter tween on ONE continuous shot

Never cut to a second, pre-blurred clip — that reads as lazy. The person should be seen
*speaking*, then the lens blur ramps in (`blur(0 → 21px) brightness(1 → 0.78)`, `power2.inOut`,
~0.7 s) while the card pops over it. Cut the source long enough to cover the whole beat (sharp
+ blurred) in one clip.

**If you delete a CSS class during a rewrite, grep for its users.** A dropped `blurbroll` class
leaves the subject perfectly sharp under the "blur him" graphics.

**A CSS `filter: blur()` leaks at the frame edge** — see `references/hyperframes.md`.
