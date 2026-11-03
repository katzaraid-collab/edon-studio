# The pre-review checklist

Run this against the cut **before showing anyone anything.** Every line is a note that somebody
has already had to give once — which means every line is a note you get to not receive.

Grouped by phase. The section reference tells you where the fix lives.

---

## Cutting and timing

- [ ] **Dead air before a sentence.** Onset measured at −26 dB, not −33/−40. `cutting.md §3`
- [ ] **Frame drift between planned and real segment boundaries.** Every segment quantised to
      whole frames; packet counts asserted. `cutting.md §5`
- [ ] **A false start hiding INSIDE a chosen take.** Every take audited chunk-by-chunk, each
      chunk transcribed in isolation. `cutting.md §2`
- [ ] **A word clipped at a segment head.** The transcript dropping a leading letter is the
      tell — merge into the predecessor, don't nudge the in-point. `cutting.md §2`
- [ ] **Gaps crushed to the floor** so phrases run together. Gap derived from the original
      pause. `cutting.md §2`
- [ ] **The closing word clipped by a body-length tail.** Last segment gets ~0.45 s.
      `cutting.md §2`
- [ ] **The last word flush with the composition end.** ~0.6 s of tail after the final
      syllable. `cutting.md §6`
- [ ] **A cut placed on the transcript's timestamp instead of the real speech onset.** Whisper
      runs early; cutting on it lands on silence. `cutting.md §3`
- [ ] **A master peaking at 0.0 dBFS**, inherited from the raw recording. `cutting.md §7`

## Layout and framing

- [ ] **The subject's head cropped at the 900 px seam.** `y` is per-shoot — snapshot and
      measure. `layout.md`
- [ ] **The hook matte sized off the BODY's head position.** Measure the matte itself.
      `layout.md`
- [ ] **The hook matte drifting during the hook.** One static `tl.set`, never a scale tween.
      `layout.md`
- [ ] **The subject too small in the hook.** They are the channel, not an inset. `layout.md`
- [ ] **The hook matte scaled or repositioned** when the source was the thing off-centre —
      recentre with a crop on the raw, then leave the matte alone. `layout.md`
- [ ] **The hook backdrop scaled.** Blur only; no scale, no crop, no eq. `layout.md`
- [ ] **A hook spanning TWO takes with different framing.** One transform cannot serve both.
      `layout.md`
- [ ] **A roto scaled down without re-matting a wider source.** The alpha's straight edge at
      x=0 becomes a visible hard mask crop the moment scale < 1. `layout.md`
- [ ] **A `transform-origin` left at 50% on an element wider than the frame.** The pivot must
      be the frame's centre in element coordinates. `layout.md`
- [ ] **The subject sitting right of centre.** Recentre with a per-segment crop on the raw.
      `layout.md`
- [ ] **A per-segment crop measured only once.** Re-audit the framing on the OUTPUT and fold
      the residual back — hands fool the face detector. `layout.md`
- [ ] **Two takes at different camera framings back-to-back at native scale.** The wider one
      exposes the lap/desk — tighten the crop for that segment only. `layout.md`
- [ ] **A CSS transform used to reframe**, risking black edges. Bake the crop. `layout.md`
- [ ] **A crop box or a `scale` on phone B-roll.** Native scale, always. `hyperframes.md`
- [ ] **A split panel where the B-roll IS the instruction.** Full frame. `layout.md`
- [ ] **The gag / reveal shot split instead of full-screen.** `layout.md`
- [ ] **A B-roll run interrupted by a bounce back to the face.** A demo sentence holds the shot
      end to end. `layout.md`
- [ ] **A transition on a B-roll clip.** Panels and full-frame B-roll hard-cut, never
      zoom/whip/slide. `layout.md`
- [ ] **B-roll starting on the second frame instead of the first.** The opening card is
      `data-start="0"`. `layout.md`
- [ ] **Logos or text too small to read on a phone.** The card row is a budget — solve it and
      state the trade-off. `layout.md`

## Captions

- [ ] **Blank frames between captions.** One track; each card runs to the next start.
      `captions.md`
- [ ] **A stroked white caption, two lines, or 5+ words.** Black on a white plate, ONE line,
      3–4 words. `captions.md`
- [ ] **A caption dropped to the lower third over full-frame B-roll.** Centre it at ~930.
      `captions.md`
- [ ] **A caption plate on the eyes or mouth.** An opaque plate is far less forgiving than
      stroked type — measure the face bottom and place below it (≥200 px). `captions.md`
- [ ] **A caption sitting on the B-roll's own on-screen text.** Re-crop or re-place the shot
      first. `graphics.md`
- [ ] **A caption parked over the B-roll's own ACTION** — when the click or menu choice happens
      dead centre, lift the slot to ~520. `captions.md`
- [ ] **A caption slot table that disagrees with the beat map, or kept in two places.** Derive
      the slot from the beat; one module, imported by both builders. `captions.md`
- [ ] **A readable element outside y 200–1430 or right of x 950.** Platform chrome eats it.
      `captions.md` / `layout.md`
- [ ] **A headline reordered by RTL bidi** because it contains Latin or `$` / `%`.
      `captions.md`

## Graphics

- [ ] **Hand-drawn logo approximations** instead of real downloaded marks. `graphics.md`
- [ ] **A container resized without resizing the mark inside it.** `graphics.md`
- [ ] **A pop-out offset that doesn't scale with the element it pops from.** Offsets, emoji
      travel and rings are fractions of the tile size. `graphics.md`
- [ ] **A pop/scale entrance where an un-blur was wanted.** `graphics.md`
- [ ] **Multi-colour tier labels.** One colour: white, no stroke. `graphics.md`
- [ ] **A motion-graphic card that repeats its own caption word for word.** `graphics.md`
- [ ] **A frozen full-frame graphic.** Add a shallow pulse / drift / grain. `graphics.md`
- [ ] **A panel sitting empty while it waits for its pop.** Fire on the cut. `graphics.md`
- [ ] **A step badge with the number on the left, or split into a white label + coloured
      circle.** Number RIGHT, description LEFT, one fused shape, white text. `graphics.md`
- [ ] **A graphic that never clears the silhouette.** Measure the matte alpha bounds per row
      band before deciding where it travels. `graphics.md`
- [ ] **A timed inline `<svg>` bleeding across the whole video.** `.clip` does not hide svg —
      drive `opacity` from the timeline. `hyperframes.md`
- [ ] **A "blur him" beat done as a cut to a pre-blurred clip.** Ease the blur in on one
      continuous shot. `graphics.md`
- [ ] **A blurred layer leaking the layer beneath at the frame edge.** Scale it up in the same
      tween. `hyperframes.md`
- [ ] **A blank-white or 404 article card shipped** because the capture log said "ok".
      `graphics.md`
- [ ] **A speaker crop that misses the speaker.** Measure the face x on a ruler-overlaid frame
      before cropping 16:9 → 9:16. `graphics.md`
- [ ] **A terminal / app B-roll captured too WIDE.** 96 cols is unreadable on a phone — use
      76 / 68 / 52. `graphics.md`
- [ ] **Two consecutive B-roll panels that look identical.** An invisible cut reads as a stuck
      frame. `graphics.md`
- [ ] **A B-roll in-point that stops just before the payoff.** The click must be on screen.
      `graphics.md`
- [ ] **Strangers' faces in B-roll.** Must be the subject, or people-free. `graphics.md`
- [ ] **A fabricated number on a receipt card.** Show the relationship, never an invented
      figure. `graphics.md`

## Sound

- [ ] **Silent music under the hook.** Check the track's opening RMS. `sound.md`
- [ ] **A technically-correct but BORING music bed.** Legal is not the bar. `sound.md`
- [ ] **Track B swapped in at the flare instead of after the retention line.** `sound.md`
- [ ] **A riser aligned by file length instead of by its audible tail.** `sound.md`
- [ ] **A camera click where a low whoosh belongs.** `sound.md`
- [ ] **SFX that are technically present but ~15 dB under the voice.** Measure dB-below-voice;
      target ~7. `sound.md`
- [ ] **A brand-logo pop fired on the card boundary instead of on the spoken word.** `sound.md`
- [ ] **A silent numbered chain.** Every number gets its own pop. `sound.md`

## Build and render

- [ ] **A card rendering in the default serif.** Every card class sets `font-family` itself.
      `hyperframes.md`
- [ ] **A `class="clip"` div missing its style class.** `#id` rules apply, `.class` rules
      don't. `hyperframes.md`
- [ ] **A CSS rule silently dropped in a rewrite.** Grep the *generated* html for the rule
      before re-rendering. `hyperframes.md`
- [ ] **A panel edit that never landed because the preview server rewrote `index.html`.**
      `hyperframes.md`
- [ ] **A hardcoded time left stranded after a re-cut.** Validate the built html against the
      beat map — starts AND durations. `hyperframes.md`
- [ ] **A graphic card's DURATION left at its pre-recut value.** `hyperframes.md`
- [ ] **One frame of the hook surviving the cut** — videos take `cut − 0.04`, overlay divs take
      `cut`. `hyperframes.md`
- [ ] **Ghost caption plates in the encode that snapshots don't show.** Run the band check on
      the encoded master. `hyperframes.md`
- [ ] **An HDR-tagged master.** Tone-map at build time and pin the master to bt709.
      `hyperframes.md`
- [ ] **A tone-map done in the wrong order.** Primaries → bt709 in LINEAR light, *before* the
      tonemap. `hyperframes.md`
- [ ] **Any unauthorised creative grade.** No eq/brightness/contrast/saturation on any clip
      except the two documented exceptions. `hyperframes.md`
- [ ] **Delivering on the strength of a snapshot.** Always sample the encoded mp4.
      `hyperframes.md`
- [ ] **A render at the default ~7 Mbps.** 30–35 Mbps. `delivery.md`

---

## How to extend this list

When a new note comes in:

1. Fix the instance.
2. **Find the class it belongs to** and fix every other occurrence in the video.
3. Add a line here, and put the rule in the relevant reference file.
4. If it can be expressed as a check, put it in `scripts/preflight_qa.py` **instead of** relying
   on this list — a gate beats a rule.
5. Append; don't renumber. Concurrent sessions also append, so keep every entry
   self-describing.
