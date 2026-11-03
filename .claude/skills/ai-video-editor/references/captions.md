# Captions and the beat map

---

## The spec

- **Every word spoken, verbatim.** Never drop or paraphrase. Fix the transcriber's typos
  (keep a per-project `TYPOS` map — every language has a set of words Whisper reliably
  mangles).
- **One line, 3–4 words. Never two lines.**
- **Black text on a translucent white plate — no stroke, ever.**

```css
.cap  { position:absolute; left:0; right:0; top:<slot>px; text-align:center;
        direction:<rtl|ltr>; font-family:"<BrandFont>", "Inter", sans-serif;
        font-weight:800; line-height:1.0; }
.cap .p { display:inline-block; color:#0a0a0a; font-size:70px;
          background:rgba(255,255,255,0.82); border-radius:22px;
          padding:20px 34px 26px; box-shadow:0 10px 34px rgba(0,0,0,0.42);
          white-space:nowrap; }
```

**The plate must HUG the text.** Wrap the line in an `inline-block` span inside the centred
`.cap` div; never style the full-width div, or you get a band across the frame.

A ~56 s reel lands around **48 cards**.

---

## Generating the cards

Generate them, never hand-write them. `scripts/captions.py` implements the splitter, in order:

1. **Merge the transcriber's split tokens** — cases where one spoken word or one visual unit
   comes back as two (a prefix particle plus a hyphenated Latin word; a brand name split in
   half). Keep the pairs in a per-project `MERGE_NEXT` map.
2. **Hard break after any sentence-ending word** (`.`, `?`, `!`) — a card must never carry the
   tail of one sentence and the head of the next.
3. **Soft break** after a comma, or before a clause opener (keep a small per-language
   `CLAUSE_OPENERS` set), once the card already has ≥2 words.
4. **4-word ceiling.**
5. **No 1-word orphans.** Fold back if the previous card has room; otherwise lend it the
   previous card's last word — **3+2 beats 4+1**.
6. **Never split a locked phrase** (a two-token brand name, a compound term).

### Measure every plate's WIDTH at build time

`white-space: nowrap` plus a long 4-word card can exceed the frame. Render each caption in the
real brand face with headless Chrome (`getBoundingClientRect`) and fail or downsize anything
over **~980 px** — `scripts/fit_captions.js`.

**Do not try to read overflow off a snapshot.** A white sofa or a bright logo trips a pixel
detector and sends you chasing a caption bug that is not there.

---

## The five slots

| beat | top | note |
|---|---|---|
| hook (matte) | 1310 | below the chin, above the y1430 safe line |
| split (900 px panel) | 780 | at or above the seam, over B-roll — never on eyes/forehead |
| speaker full-screen | 1300 | below the face |
| **full-frame B-roll / graphic** | **930 (centred)** | see below |
| B-roll whose ACTION is dead centre | **520 (lifted)** | see below |

**On a full-frame B-roll shot the caption goes in the MIDDLE (~930), never dropped to the
lower third.** A caption that dives to the bottom for one beat and jumps back reads as a bug.
The white plate is legible straight over a graphic, so centring costs nothing. The only
exception is a card you built yourself around a low caption — if in doubt, centre it.

**When the thing the shot exists to prove happens in the middle of the frame, lift the slot to
~520.** The plate makes text-on-text survivable; it does not make a caption sitting on the
click survivable. Pull ruler-overlaid frames from the **encoded** file across the whole
stretch — a handheld shot drifts, so pick the slot that clears the action at **both** ends, not
just at the in-point.

**The plate makes text-on-text survivable.** A caption over a screenshot's own text no longer
reads as sloppy the way stroked white type did — so on a text-dense B-roll shot, prefer keeping
the slot honest over re-cropping the source.

**Keep the slot table in ONE module** (`scripts/beats.py`), imported by both the composition
builder and the caption-layer builder. Two hand-maintained copies **will** drift the moment a
cut point moves, and the drift is invisible until the encode.

---

## ONE beat map — derive the slot from it

Never keep a hand-written `SLOTS = [(start, end, class), …]` table alongside the visual beat
map. They drift, and the symptom lands on the speaker's face: a slot range saying "panel"
(top 780) across a stretch where the beat map actually had them full-screen puts the plate on
their mouth. Nothing is wrong with the slot *values*; the two tables simply disagree.

```python
# scripts/beats.py — the single source of truth
SLOT  = {"hook": 1310, "std": 1300, "ctr": 930, "hi": 520, "panel": 780}
BEATS = [(start, kind, tag), ...]      # kind ∈ SLOT
```

From that one structure, derive:

- `slot_at(t)` → the caption class. No parallel table to forget.
- Gradient panels = merged contiguous `panel` beats.
- The A-roll `y 0` / `y 770` states, emitted per beat.
- **Assert every beat start is a real segment boundary** before building anything.

---

## Timing

### A caption must never still be up once the next sentence has started

Two rules, both required:

**(a)** The **first** card of each sentence starts at the **segment boundary**, not at the
transcriber's first-word stamp. Whisper reports word starts 0.03–0.15 s late, so the previous
card otherwise lingers over the new sentence.

**(b)** Mid-sentence cards get a **0.06 s lead**: `start = word_start − 0.06`, clamped to the
segment boundary.

Measure the lateness per shoot — compare each segment's designed onset (boundary + lead)
against the transcriber's first word and take the mean.

Then **snap every layout beat to a caption start**, so a visual cut and its caption always
change on the same frame. Never the reverse — never move a caption to fit a layout beat.

**Verify:** for each of the N segment boundaries, assert that some caption starts exactly
there.

### Zero dead space between captions — never a single blank frame

Put **all** captions on **one** track index and make each duration exactly
`next_start − this_start` (the last one runs to the composition end). Same track = the renderer
hands off cleanly, so you get no gap and no overlap.

**Do not end captions early to dodge overlap** — that leaves blank frames.

**But subtract 0.005 s from every duration.** The clip window is inclusive at both ends, so at
`t = next_start` both cards render and you get one frame of stacked text. Frame times are
0.04 s apart, so 0.005 s can never open a gap, and the boundary frame belongs to the next card
alone. Verify by snapshotting a boundary at −0.04 / exact / +0.04.

---

## RTL and bidi

If the caption language is right-to-left, set `direction: rtl` on `.cap` and read this section
carefully. If it is left-to-right, only the last bullet applies.

**RTL bidi reorders any line that mixes the script with Latin or symbols.** A headline reading
"build a leading AI model" comes out as "leading AI build a model"; "hundreds of billions $"
becomes "$ hundreds of billions". In **graphics** you can rewrite around it:

1. Write **words, not symbols** — "20 dollars a month", never "$20 a month".
2. Give every Latin token **its own block element** — `OpenAI`, `GPT-5`, `$0.20` each on their
   own `<div>`. Isolated, they render correctly.
3. Drop Latin acronyms from headlines where a native word exists.

**In a CAPTION the verbatim rule wins, so you cannot rewrite the Latin away.** Wrap it instead:

```html
<span style="unicode-bidi: isolate; direction: ltr">DM's</span>
```

That renders in the right order without touching a word that was said.

**Always read the rendered snapshot.** The HTML source looks fine either way — bidi is a
render-time reordering, so source inspection tells you nothing.

**RTL stacking:** a number and its unit go in **separate block divs** ("1.5" / "billion
dollars"), never one mixed line. Same for a card title containing a Latin product name.

---

## Where captions live in the build

Captions are composited **outside** the renderer (`scripts/caption_layer.py` →
`assets/captions.webm`, VP9 with alpha) rather than as clips in the composition — see
`references/hyperframes.md` §caption ghosting for why, and for the check that tells you whether
you actually need to pay that cost on a given project.

Bonus: re-timing a caption then costs an overlay pass instead of a full re-render.
