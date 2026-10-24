# Concept B "השקית": design and motion recheck after iteration 3

Independent check, 24.10.2026. I changed nothing in `concepts/`. My scripts and screenshots are in
`/tmp/claude-0/-home-user-edon-studio/39250604-ba72-5066-b62c-771f07ec61a3/scratchpad/agents4/qa/`
(the screenshots are under `out/`). I also patched a copy of the scroll module in `qa/cc/` to test fix 1.

**Setup:** Playwright with Chromium 153 on `file:///home/user/edon-studio/clients/haofe/concepts/b.html`, opened with `[data-full]`.
- Sizes: 1440x900 and 390x844, light and dark, motion on and reduced (`#rm`, then `[data-replay]`).
- I also checked 17 other widths from 320 to 1920. "Reload mid-page" cannot happen inside the prototype frame, so I tested it on a real-page copy built from the live concept files (`qa/page/page.html`, page contract 2).
- Scroll patterns: normal wheel scrolling, a fast fling to the end, a fling that stops in the middle of the boxes, nav, menu, footer and bottom-bar jumps, a fling during the opening, scrolling back up, reload mid-page, and a theme change in the middle of the peak and of the map.

## What passes

- **Errors:** 0 console errors, 0 page errors and 0 failed requests in every run (8 main configurations plus about 60 others). No horizontal page scroll at any width from 320 to 1920.
- **No content left hidden.** This held after a normal scroll, a fling (also one during the opening), every jump (nav, menu, footer cities, bottom-bar ניווט), scrolling back up, a reload mid-page on the real page, and a theme change mid-sequence.
  - The remaining items at opacity below 1 are all intended: the theme logos, the static `.out` path at 0.7, the scroll-linked fade of the hero text, and labels that sit under the phone bar.
  - In the phone feed rail, the card beyond the edge appears once the visitor swipes to it.
- **Owner overrides O1 to O6:**
  - O1: "הזמנה אונליין" with its "בקרוב" chip, the phone-first receipt, the status line, and the launch-day switch. Live mode adds `href` and the button; soon mode has no URL in the link.
  - O2: the production house and "לחמים לסופרים בכל הארץ" are on the map; the business contact is marked pending.
  - O3: the route Ofakim → Netivot → Sderot → Kiryat Gat is marked as a draft; there is no AI image of the Ofakim bakery.
  - O4: the pending markers are worded plainly.
  - O5: the only infinite animation is the ticker (`b-scroll-tick`), and it keeps its pause button. The dust canvas is `display:none` after about 4.7 s, the wheat sways once, and every other animation still running at 6 s is scroll-driven.
  - O6: there is no geolocation button, and the OSM credit is present.
- **AI labels** are visible in every configuration, mid-animation too: the hero `.ai-note` and 5 `.ai-tag` on the boxes. The 6 product alts end with "הדמיית AI".
- **RTL and bidi:** every phone number, opening-hours line, date, handle, "10 ק״מ" and "(2021)" renders in the right order.
- **Computed contrast on solid grounds:** nothing fails in light or dark. The lowest is 4.54:1, the footer `.tbd` notes in light.
- **The peak on phones:** at 390 and 768 the frena, challah and baguette leap out of the bag into their windows at slow, medium and fast scroll speeds.
- **The map:** at rest it completes by itself in about 3.4 to 4.3 s, at every width.

## Remaining problems, ranked

### 1. HIGH: the peak (bread out of the bag) does not happen on laptops and desktops
- **What happens:** on desktop the frena and challah fall into their box from just above it instead of leaping out of the bag. At 1440, the falling frena also crosses the "מה יש בקופסה" heading.
- **Evidence:** I recorded which breads leapt in `qa/leap.js`, using real wheel input with no screenshots so the timing is real.

  | viewport | slow | medium | fast |
  |---|---|---|---|
  | 1280x800 | none | none | none |
  | 1440x900 | baguette, frena | frena | none |
  | 1100x800 | baguette, frena | baguette, frena | frena |
  | 1920x1080 | baguette, frena | baguette | frena |
  | 768x1024, 390x844 | all 3 | all 3 or frena + challah | frena + challah |

  The challah never leaps at 1000px or wider. Frames: `out/peak/1440-light/` (frames 8 and 9).
- **Cause:** a bread leaps only when two things are true at its trigger:
  - the bread's spot in the bag is less than half a visible height above the view (`g.effH * .5`, `b-motion-scroll.js:546`);
  - the product is 60% visible (`need: .6`, line 254).

  With the 16:9 hero plus the tape and the heading, the bag is already further up than that when the window qualifies.
- **Fix (tested on a scratch copy, `qa/cc/b-motion-scroll.js`):**
  ```js
  // b-motion-scroll.js:254
  spot: name ? BAG_SPOTS[name[1]] : null, kind: name ? 'leap' : 'drop', need: name ? .3 : .6
  // b-motion-scroll.js:546
  if (sy + toScreen > g.visTop - g.effH * 1.1 && sy < ey - 60) {
  ```
  - **Result:** all three breads leap at 1100, 1440 and 1920 at every speed, and at 1280 slow and medium. At 1280 fast, the frena and baguette leap and the challah falls in.
  - **Look:** at 1280 the copies come out from under the header and arc down into their windows. This is the flight path's own "hidden stretch" weighting, and it looks right. Frames: `out/peakfix/1280-light/`.
- **Optional:** on wide screens, start the challah together with the frena when the Friday box enters, lower slot first. Then it never lands alone later.

### 2. HIGH: the footer phone number is cut off on small phones, and the receipt number spills out of the receipt at 320
- **Evidence:** `.ft-num` sits in a column of `auto minmax(0,1fr)` next to the 76px sticker, at 40px minimum.

  | width | footer number spans (px) | result |
  |---|---|---|
  | 375 | -5 to 263 | cut by 5px |
  | 360 | -20 to 248 | cut by 20px |
  | 320 | -60 to 208 | "170" is cut off |

  - The `.ft-b2b` line overflows the same way.
  - At 320 the receipt's `.order-num` starts at x=3 while the slip starts at x=17.
  - Screenshots: `out/spots/ft-320.png`, `ft-360.png`, `slip-320.png`. Measurements: `qa/ftnum.js`.
- **Fix (b.css):**
  ```css
  @container pb (max-width: 419.98px) {
    .pb .ft .in { grid-template-columns: minmax(0, 1fr); }   /* sticker on its own row */
    .pb .ft-sticker { width: 64px; height: 64px; }
    .pb .order-num { font-size: 10.5cqi; }                     /* 33.6px at 320, 41px at 390 */
  }
  ```

### 3. HIGH (tablet): footer text overlaps from 700 to about 830px
- **What happens:** the 3-column footer starts at 700px (`b.css:592-593`). `.ft-side` (`auto`) takes its max-content width, so `.ft-main` (`minmax(0,1fr)`) overflows under it. Text lands on text:
  - "קריית גת" and "שדרות" over "אינסטגרם" and "טיקטוק";
  - "איש קשר לאישורכם" over "הצהרת נגישות".
- **Evidence:** `out/spots/ft-700.png`, `ft-760.png`, `ft-820.png`.
- **Fix:** move the two lines `.pb .ft .in { grid-template-columns: auto minmax(0,1fr) auto; … }` and `.pb .ft-side { grid-column: auto; }` from `@container pb (min-width: 700px)` to `(min-width: 1000px)`. Below 1000 the existing 2-column layout, with the side row spanning the full width, has no collisions. The 120px sticker rule can stay at 700.

### 4. MEDIUM: jumps to a branch label land with its title under the sticky header (1000px and wider)
- **What happens:** shell.js stops a jump `JUMP_OFFSET = 64` px from the top, but the header is 75px tall at 1000px and wider. The footer city links and nav "לעסקים" land with the label top at 64px. The label's h3 ("נתיבות", "בית הייצור") starts right at the header's bottom edge, and its letters are clipped.
- **Evidence:** `out/crop-b2b-jump.png`, `out/crop-netivot-jump.png`, `qa/hd.js`. The logo jump to the top also stops at `scrollTop` 11 instead of 0.
- **Fix (shell.js `scrollViewportTo`, line 97):**
  ```js
  var proto = target.closest('.proto'), hd = proto && proto.querySelector('.hd');
  var offset = hd ? hd.getBoundingClientRect().height / scale + 12 : JUMP_OFFSET;
  scroller.scrollTo({ top: Math.max(0, scroller.scrollTop + distance - offset), behavior: … });
  ```

### 5. MEDIUM: after "בחרו סניף" or "סניפים", the branch details take about 4 s to appear
- **What happens:** the hero's main CTA and the nav "סניפים" jump to the map. The map then plays its draw sequence only once the scroll has rested 0.5 s.
  - 2 s after the jump, these are still hidden at 1440, 1280 and 390: the Kiryat Gat pin and label, the production house, "לסופרים בכל הארץ", and the leaders.
  - Everything is visible at about 3.8 to 4.3 s (`out/mapseq.json`, `qa/patterns.js` jump results).
  - A visitor who asked to choose a branch waits for an animation before seeing branch details.
- **Why only this jump is slow:** shell.js focuses the jump target. For the city links that is a label, and focus inside a label already finishes the map (`b-motion-scroll.js:988`). For "visit" focus lands on `section.here` itself, so nothing finishes.
- **Fix (b-motion-scroll.js:988), minimal:**
  ```js
  if (mapS && !mapS.done && (t === mapS.here || (mapS.places && mapS.places.contains(t)))) finishMap();
  ```
  The better version keeps the beat: on that focus, set a fast flag that arms the dwell at 150ms and plays the stops 120ms apart, so the sequence ends within about 1.2 s.

### 6. MEDIUM (tablet 700 to 999px): the phone hero is scaled up to a 1,100px-plus scene
- **What happens:** below 1000 the scene keeps the phone ratio (about 4/4.6), so it grows with the width.

  | width | hero height | bag | page height |
  |---|---|---|---|
  | 768 | 1,103px | 384px wide, base under the bar | |
  | 999 | about 1,150px | first screen is the text plus empty wall | 6,578px |
  | 1000 (for comparison) | | | 4,739px |

- **Evidence:** `out/spots/hero-768.png`, `out/sheet-layout-wide.png`.
- **Fix (b.css, inside `@container pb (min-width: 700px)`; the 1000px block already overrides these):**
  ```css
  .pb .scene { aspect-ratio: 16 / 10; margin-top: -120px; }
  .pb .sc-bag { width: 36%; bottom: 12%; }
  ```
  Then rerun the hero owner's wheat/bag overlap check (`overlap.js`) at 768 and 999.

### 7. MEDIUM: at desktop sizes the map is taller than the visible area, so the pride beat is never seen whole
- **Measurements:**

  | viewport | map height | visible area under the header |
  |---|---|---|
  | 1440x900 | 872px | 767px |
  | 1280x800 | 765px | 668px |

  Both ends of the route are on screen together for only about 184px of scroll. "לסופרים בכל הארץ" arrives at the top edge.
- **Cause:** the label overlay needs a map of at least 760px (`@container map (min-width: 760px)`), and `.map-art` is square, so the map is at least 760px tall.
- **Fix:** the content spans y 52 to 792 of the 800-unit box, and below Ofakim (y 563) there is only the Ofakim label and the scale bar. Make the art 800x660:
  - `aspect-ratio: 800/660` and `viewBox="0 20 800 660"`;
  - move `.north`, `.scale` and the Ofakim label (`--ly`) up to about y 600;
  - rerun the implementer's label-collision check (`b3/mapcheck.js`).

  The other route is to lower the overlay threshold to about 680px, after the same check.

### 8. MEDIUM: the map at 1180 to about 1260px has a two-column layout with a list, and a large empty corner
- **What happens:** at 1180 or wider `.here .in` becomes two columns, but the map column is under 760px, so the labels fall back to a list under the map. The section is then 1,509px tall, and the copy column (`align-items:center`) starts about 530px down next to an empty dark corner.
- **Evidence:** `out/spots/here-1180.png`, `here-1250.png`.
- **Fix:** in b.css, move the four `.here` rules (lines 636-639) out of `@container pb (min-width: 1180px)` (line 633) into a new `(min-width: 1280px)` block. `.order-n` stays at 1180. At 1280 the map is wide enough for the overlay. The alternative is `align-items: start` plus `.here-copy { position: sticky; top: 96px }`.

### 9. MEDIUM: the order band has a lone receipt pushed to the far left
- **What happens:** at 1000px or wider, `.slip { max-width:520px; margin-inline-start:auto }` pushes the receipt to the end side (left in RTL). That leaves about 60% of a 550px band empty, at the side where every heading starts reading.
- **Evidence:** `out/spots/order-1440.png`.
- **Fix:** `.pb .slip { margin-inline: auto; }` and `.pb .order-sec { padding-block: calc(var(--sec) * .65); }`. If the design keeps the offset, give the band a second object at the start side.

### 10. MEDIUM: frame times; on a throttled phone the scroll runs at about 30 fps
Measured with a rAF interval loop and the longtask observer, light mode, 2 runs each (`qa/perf.js`, `perf2.js`, `perf3.js`, `trace.js`). These are headless software-raster numbers; recheck on a real device.

| phase | phone 390, CPU x4: motion | phone: reduced | desktop 1440, x1: motion | desktop: reduced |
|---|---|---|---|---|
| opening, 0 to 4.8 s | mean 19.5, p95 33.4, 1 long task of 50 to 70ms | 16.7, 0 | mean 27 to 28, **p50 33**, p95 50 to 67, 16 to 25 slow frames | 16.7 |
| scroll through, about 10 s | mean 30.4 to 31.3, **p50 33.3**, p95 50, 18 to 23% frames over 34ms, **3 to 9 long tasks of 50 to 84ms** (181 to 550ms in total) | mean 17.5 to 17.8, p50 16.7, 1 to 1.5% slow, 0 or 1 long task | mean 24.3, p50 16.7, p95 50, 8 to 9% slow, 0 long tasks | 16.8 to 17.0 |
| settled | 16.7 | 16.7 | 16.7 | 16.7 |

At 1280 with CPU x2, the scroll had a mean of 26.4 to 29.2 ms, p95 50, 14 to 19% slow frames and 0 or 1 long task.

- **Which module costs what:** on the phone at x4, leaving out `b-scroll` gives p50 16.7, 8 to 11% slow frames and 2 to 4 long tasks. Leaving out `b-hero` or `b-micro`, or pausing the ticker, changes nothing.
- **Where:** the long tasks cluster in the boxes (the peak) and the map (`perf3.js`).
- **What they are** (trace): rendering-lifecycle work inside `BeginMainFrame`, not script. Layerize 6 to 12ms, Commit 4 to 11ms and style recalc 3 to 19ms per long frame; FunctionCall is 11ms or less.
- **Composited layers** for the whole document: about 100 with motion against about 47 reduced (`qa/layers.js`).
- **Fix candidates for b-motion-scroll:**
  - drop the scroll-timeline drift on products and boxes (`.sx-dr`; products keep a 1 to 7px `translate` at rest);
  - promote only elements that are actually in flight, and release the layer right after impact;
  - stamp the map pins with `opacity`/`scale` on the badge only, not on `.pin` plus `::before` together;
  - measure the gain against the numbers above.

### 11. LOW: theme switch on wide screens, the hero goes dark before the text turns light
- **What happens:** at about 80ms the evening dim and the bag filter are already applied, while the H1 and subtitle are still dark brown on the darkened photo. For about 150ms the hero text has low contrast. The header logo is blank for a frame because both logo images are at opacity 0.
- **Evidence:** `out/sheet-theme1440.png`.
- **Fix:** put the hero's dim and filter transitions on the same 450ms `--ease-in-out` as the ink tokens, with about 120ms delay. Overlap the crossfade of `img.for-light` and `img.for-dark`.

### 12. LOW: the footer's serrated edge is almost invisible
- **What happens:** the tooth colour (`--ft-bg`) is almost the feed's kraft, and `.ft`'s `box-shadow: inset 0 10px 14px -12px` draws a straight line under the teeth. The "folded bag bottom" reads as a flat seam. The feed's edge on the map is crisp.
- **Evidence:** `out/crop-ftedge.png` against `out/crop-feededge.png`.
- **Fix:** add `filter: drop-shadow(0 -1px 0 rgba(60,35,12,.22))` on `.ft::before`, and start the inset shadow below 8px. Or deepen `--ft-bg` to about 75% kraft and 25% caramel, then recheck contrast for `.ft-legal` and `.tbd` (currently 4.54).

### 13. LOW: in dark mode the map loses its edge
`--map-bg` (#17100B) is the dark page background, so the order→map seam disappears, and the "one dark section" only shows at the feed's teeth.
- **Fix:** in dark, `--map-bg: #100B07` plus `border-block-start: 1px solid var(--line)` on `.here`.

### 14. LOW: the phone map's number chips cover the logo
At 390 the cream chips "1", "2" and "3" sit over about 40% of the 22px cream badge, so the badge is unreadable (`out/map-390-2x.png`).
- **Fix:** move the chip outside with `inset-inline-start: -16px`, on `--map-accent` with `--map-bg` text.

### 15. LOW: in reduced motion, the ticker separators hang at line starts
At 390, 4 of the 5 wrapped lines start with a wheat mark (`out/spots/tk-390-rm.png`). Finding 17 moved the separators to `li + li::before`, which moved the dangling mark from the line end to the line start.
- **Fix:** the clipped-separator technique. Give the list `margin-inline-start: -1.4em; overflow: hidden` inside the tape, and give each `li::before` the 1.4em it needs, so the mark at each line start falls outside the clip.

### 16. LOW: housekeeping in b.css
- **Stale header notes:** "NOTES FOR THE MOTION FILES" in the b.css header is out of date. `BAG_SPOTS` and `info.shot`, micro's `.soon` stamp and the lines/unroll/swing devices are all resolved, and "plate fades in from the top (mask)" is wrong: the hero css fades the whole back plane. Update or delete the section.
- **Dead rule:** `.pb[data-mode="dark"] .hero::before` (b.css, 1000px block) is switched off by `b-motion-hero.css:129` (`content:none`). Delete both.
- **Duplicate comment:** the dark `.ai-note` line inside the 1000px block (b.css, right after line 609) has the same comment twice.

### 17. LOW: phone length and one orphan word
- The phone page is 5,432px with motion and 5,580px reduced, against the design target of about 5,000. The reduced-motion tape alone is 208px tall.
- The hero subtitle leaves "בעונה." alone on its own line at 390. Add `text-wrap: pretty` on `.hero .sub`.

## Notes on the earlier "open issues"

- **Confirmed fixed:** the hero loops end within 5 s; the scroll and micro modules no longer touch the removed structure; the jump-past safety net, the dwell rule, and the late boot on a real page all work.
- **Not reproduced:** "content left hidden after a jump" does not happen in any of the patterns I tried.
- **Still open from the implementers:** the skeleton tests (`unported modules skipped` and the 327px overflow at 320) belong to the site owner. The real-device and Firefox/WebKit measurements are still missing.

---

## Round 2 · independent verification of iteration 3.1 · 24.10.2026, 12:36 to 13:35 UTC

I am the independent verifier. I was read-only on `concepts/` and `site-plan/`. The file hashes were identical at the start and at the end (`…/scratchpad/agents4/verify5/hashes-start.txt`, `hashes-end.txt`).

**Method.** This review's scripts were copied to `…/scratchpad/agents4/verify5/qa/`. In `common.js` the only change is that the output folder became an environment variable. Each check ran twice, both in Playwright Chromium with `[data-full]`:
- on an exact copy of iteration 3 (`verify5/base/`, with hashes equal to the iteration-3 set), to reproduce the problem;
- on the live files.

Logs: `verify5/qa/*-base.log` and `*-now.log`. Screenshots: `verify5/qa/out`, `out-base` and `verify5/shots` (base/now pairs are in `shots/pair/`).

### R2.1 Verdict

Iteration 3.1 delivers most of this list:
- **14 of 17 findings are fixed**, among them both HIGH items and the peak.
- **#10 (frame times) is not fixed.** Interleaved runs show no change on the throttled phone or on the desktop; the laptop at CPU ×2 improved a little.
- **#13 (dark map edge) is not fixed in effect.** The prescribed values are in, but the result looks the same as iteration 3.
- **#17** is fixed for the orphan word and the tape. The phone page is still above the ~5,000px target.

I found two new problems with the in-flow map labels:
- a text-spacing overflow in the Netivot hours (medium, also N9 in the a11y report);
- the Kiryat Gat and Netivot labels touching edge to edge (low).

There are also some stale comments.

### R2.2 The 17 findings

| # | status | iteration 3 (reproduced) | iteration 3.1 |
|---|---|---|---|
| 1 peak on laptop/desktop | **fixed** | `leap.js` gave the same table as above: 1280 none at any speed, 1440 fast none, and the challah never leapt at 1000px or wider | **18 of 18** runs have the frena, the challah and the baguette leap: 1440, 1280, 1920, 1100, 768 and 390, each slow, medium and fast. Screencast frames (`verify5/qa/out/peak5/`, sheets `shots/peak5-1280.png` and `peak5-1440.png`): on desktop the copies arc in from under the header into their windows, and nothing crosses the "מה יש בקופסה" heading. |
| 2 footer and receipt number on small phones | **fixed** | `ftnum.js` at 320: footer number −60..208 and receipt number 3..273 with the slip at 17 | Footer number 74..300 in a 20..300 column, receipt number 51..279 in an 18..302 slip. Inside at 320, 360, 375, 384, 390 and 412. Sticker on top below 420px (`shots/pair/ft-320.png`, `slip-320.png`). |
| 3 tablet footer overlap | **fixed** | a11y `ftscan.js`: 6,651 px² at 700, falling to 71 at 870 | 0 from 300 to 1200. Three columns only from 1000px (`shots/pair/ft-760.png`). |
| 4 jumps under the header | **fixed** | `hd.js`: label top 64 to 65 under a 75px header. Logo jump stopped at scrollTop 11. | Label top 87 to 88 under 75 (1440, 1280) and 75 to 76 under 63 (390). Logo and skip jumps reach scrollTop 0. Every jump lands its heading 8 to 13px under the header. |
| 5 map late after "בחרו סניף" / "סניפים" | **fixed** | `verify5/qa/jumpmap5.js`: everything in view was visible only 4.0 to 4.3 s after the click (1440 hero and nav, 1280, 390 hero and bar) | Everything in view is visible 1.46 to 1.52 s after the click on desktop and 1.20 to 1.36 s on the phone, about 0.3 s after the smooth scroll rests. The scroll owner's "readable at 0.84 to 0.96 s" is a little optimistic: in my probe 4 to 5 map items are still fading at 1.0 s. |
| 6 tablet hero | **fixed** | hero 1,103px tall at 768 and 1,369px at 999 | 684px at 768 and 829px at 999. The breads stay under the buttons and the AI note (`shots/hero768-zoom.png`). The hero owner's `overlap.js`, run from a copy at 700, 768 and 999: **0** wheat-over-bag pixels through the opening (18 times), the scroll (8 positions) and the pointer lean (5 positions). Residual for the hero owner: `--b-pivot` is still 50% 80% at 700 to 999 while the bag's contact point is 50% 88%, about 1px of drift. At 999×800 the sticker is half under the bottom bar at load (cosmetic). |
| 7 map taller than the screen | **fixed** at the two named sizes | map 872 vs 767 visible (1440×900), 765 vs 668 (1280×800) | 720 vs 767 (1440×900) and 636 vs 667 (1280×800), from `verify5/qa/mapcol5.js`. Still a little taller than the screen: 1366×768 (679 vs 635) and 1000 to 1250 (693 vs 667 to 687). In both cases the route itself (y 40 to 543 of 660) fits. Every pin is still on the route (distance from pin centre to path 0 to 2.5px, the sampling step). |
| 8 1180 to 1260 list beside an empty corner | **fixed** | the section was 1,509px (1180) and 1,567px (1250), with the copy column starting about 530px down | The copy sits above a centred 840px map with the labels on it. The section is 1,285 and 1,301px (`qa/out/mapcol/1250x820-light.png`). |
| 9 lone receipt at the far left | **fixed** | receipt at the end side, band 550px | Receipt centred, band 435px. One `--sec` between the shelf and the receipt (`shots/pair/order-1440.png`, `shelf-order-1440.png`). |
| 10 frame times | **not fixed** | (measured as below) | See R2.4. Phone CPU ×4 scroll mean was 31.8 ms on iteration 3 and is 31.9 ms now, p50 33.3 ms in both. Desktop ×1: 23.7 against 23.5 ms. Laptop ×2: 26.0 against 24.6 ms. Composited layers are unchanged (about 100 with motion, 46 to 48 reduced). The drift was removed and the route mask replaced; the throttled phone still scrolls at about 30 fps. |
| 11 theme switch | **fixed** (the view-transition path checked by structure only) | screencast of the in-page toggle at 1440: the logo is nearly blank at 806 ms (ink share 0.055 against 0.33 at rest, `shots/logo-toggle-base.png`), and 3 frames of dark headline on a darkened wall | The in-page toggle now runs one scoped view transition on the `.vp` (`b-micro-dusk` 450 ms on `::view-transition-old(root)`), with mode, `aria-pressed` and focus correct and 0 errors. No blank logo frame on either path (`shots/logo-toggle-now.png`, `logo-setMode-now.png`). The token-fade path (`Shell.setMode`) shows 1 to 2 low-contrast hero frames, against 3 before (`shots/hero-setMode-*.png`). Headless capture cannot show the view-transition snapshot itself, so a quick look in a headed browser is still worth doing. |
| 12 footer edge | **fixed** | flat seam under a straight inset shadow | Upward teeth with a hairline, visible in light and dark (`shots/ftedge-zoom.png`). |
| 13 dark map edge | **not fixed** (no visible change) | iteration 3 already had `--map-bg #110B07` and a 1px top line in dark | `#100B07` and the same line. Measured on screen at 1440 dark: page ground 23,16,11, map ground 22,17,13 now against 23,17,13 before. The map's texture lifts its ground to the page's colour, so the edge is still only the 1px line (53,47,42), exactly as before (`shots/pair/seam-1440-dark.png`). **Fix:** a perceptible step, for example `--map-bg #0B0705`, or a lighter grain on `.here` in dark, or the line at about 0.22 alpha. Then compare the medians again. |
| 14 phone pin chips over the logo | **fixed** | chips covered about 40% of the badge | The chips sit outside the badge on caramel and the badge is whole (`shots/map390-2x-now-light.png`). Chip text 7.80:1. |
| 15 reduced-motion tape | **fixed** | 4 of 5 lines started with a wheat mark | No line starts with a mark. The tape at 390 is 136px tall (was 208) (`shots/pair/tk-390-rm.png`). |
| 16 b.css housekeeping | **fixed** for the listed items | stale notes, dead scrim, duplicate comment | "NOTES FOR THE MOTION FILES", the dead `.hero::before` scrim and its `content:none`, `.b-hold .sc-shade`, the dark `.sc-bag-img` filter and the duplicate comment are gone. New stale text, because two owners worked in parallel, is listed under R2.3. |
| 17 phone length and orphan | **fixed** for the orphan and the tape; the length stays above target | 5,432 / 5,580px (motion / reduced), "בעונה." alone | Phone page 5,359 / 5,435px, still about 7 to 9% above the ~5,000 target (a design call, not a defect). `text-wrap: pretty`: the subtitle ends with "וסופגניות בעונה." on its second line (`shots/pair/sub-390.png`). |

Owner rules are intact and match iteration 3 exactly:
- the online order is "בקרוב" only, the phone 1700-55-22-55 leads, and no app URL appears in the soon state;
- the production house and "לחמים לסופרים בכל הארץ" are on the map;
- the story is still "טיוטה … לאישורכם";
- the counts in `b.html` are unchanged: 16 `.tbd`, 14 "הדמיית AI", 6 "בקרוב";
- light is the default, and dark is fully styled.

Prototype rules hold: no `position: fixed` and no window scroll in the modules, and the scoped ids are kept.

### R2.3 New problems

1. **MEDIUM · the Netivot hours run past their label with WCAG text spacing (1000 to 1920px).** The Netivot track is now 26% of the map and `.hrs li` does not wrap, so "20:00–23:00" sticks out of the label by 1 to 6.6px. At 1280 its "2" disappears on the dark map (`verify5/shots/netivot-hrs-1280sp.png`, `verify5/qa/lblover.js`). Iteration 3 was clean. **Fix** (b.css): `.pb .hrs li { flex-wrap: wrap; column-gap: 10px; }`.
2. **LOW · the Kiryat Gat and Netivot labels touch.** On wide maps the two columns have no gap (`gap: 2.2cqw 0`), so the cards meet with 0 to 1px between them over 10 to 40px of height at 1280 to 1920 (`verify5/shots/kg-netivot-1440.png`, `kg-netivot-1280d.png`). **Fix:** give `.places` a small column gap, about 1cqw, taking it from the 1fr route track, then rerun `mapcol5.js`.
3. **LOW · stale comments.**
   - b.css lines 124 to 129 still say the scroll module tests `position === 'absolute'` and draws the route through a mask that lights `.pin::before`. It now tests `--map-labels` and draws dot by dot.
   - b-motion-micro.css line 55 says `.pin::before` gets "transform + opacity = scroll".
   - Lines 455 to 460 of the same file still say b.css's `position: absolute` wins on the wide map.
4. **LOW · hero pivot on tablets.** `--b-pivot` is 50% 80% at 700 to 999 while the bag's contact point is 50% 88% (hero owner, about 1px).

### R2.4 Fresh sweep (live files)

- **The peak:** 18 of 18, as in #1.
- **The map route:**
  - It draws dot by dot and is complete after the sequence: no inline visibility or `stroke-dasharray` left, 0 masks.
  - A single instant jump also completes it (a11y `mapseq.js`).
  - Reduced motion shows it whole.
  - The whole map entrance ends 3.04 to 3.06 s after rest (was 4.0 to 5.4 s).
- **Motion within 5 s:** every document-timeline animation has ended by 4 to 5 s. 0 rAF callbacks at 10 s, 0.0% pixel change from 8 to 9.5 s. Only the ticker loops, and it can be paused.
- **Frame times.** Interleaved iteration-3 and live runs, same machine, light mode, `perf.js` method (`verify5/qa/perf5.js`, `perf5l.js`; `out/perf5*.json`):

  | config | runs | scroll mean (ms) | p50 | slow frames over 34 ms | long tasks |
  |---|---|---|---|---|---|
  | phone 390, CPU ×4, iteration 3 | 3 | 33.8 / 30.1 / 31.5 | 33.3 | 25 / 17 / 23 % | 18 / 2 / 10 |
  | phone 390, CPU ×4, 3.1 | 3 | 32.9 / 28.6 / 34.3 | 33.3 | 27 / 14 / 27 % | 6 / 2 / 26 |
  | desktop 1440 ×1, iteration 3 | 3 | 24.0 / 23.2 / 23.8 | 16.7 | 6.9 / 5.7 / 8.2 % | 0 |
  | desktop 1440 ×1, 3.1 | 3 | 23.1 / 24.1 / 23.3 | 16.7 | 5.6 / 7.1 / 7.0 % | 0 |
  | laptop 1280 ×2, iteration 3 | 3 | 25.7 / 25.4 / 26.8 | 16.7 | 10.2 / 10.7 / 12.0 % | 0 |
  | laptop 1280 ×2, 3.1 | 3 | 24.5 / 24.4 / 24.8 | 16.7 | 8.3 / 6.3 / 8.7 % | 0 to 1 |

  Reduced motion is about 16.7 to 17.6 ms in both. The opening is unchanged.
- **Errors:** 0 console errors, page errors and failed requests in every run, including the 20-configuration matrix.
  - Matrix configurations: 1440×900, 1280×800, 768×1024, 390×844 and 320×640, each light and dark, motion and reduced (`#rm` then `[data-replay]`); `verify5/qa/matrix5.js`, sheets `verify5/shots/m5/`.
  - After the scroll-through nothing is hidden, and nothing is left over: no hold, copy or mask.
- **Horizontal scroll:** none at 17 widths from 320 to 1920 (`layout.js`, light and dark).
- **Scroll patterns:** a fling, scrolling back up, a stop mid-boxes, and every nav, menu, footer, bar and logo jump at 1440, 390 and 1280: nothing hidden at 2 s (`patterns.js`).
- **Theme:** see #11.
- **Skeleton suite:** 23/23, run on a scratch copy.
