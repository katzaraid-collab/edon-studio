# האופה · direction B "השקית" · accessibility re-audit after the v3 iteration

Auditor role: independent accessibility verifier, against WCAG 2.2 AA (plan R15: WCAG 2.2 AA plus 4.1.1 and the Israeli changes). Date: 24.10.2026, 07:57 to 08:37 UTC. Read-only on `concepts/`: nothing there was edited.

**Scope.** The same as the first audit (`README.md`): the direction B prototype inside the full-screen overlay of `concepts/b.html` (`[data-full]`), in 8 configurations: 1440×900 and 390×844, light and dark (frame radios `label[for=b-l]` / `label[for=b-d]`), motion on and reduced (`#rm`, then `[data-replay]`; the system setting was checked too). Opened from `file:///home/user/edon-studio/clients/haofe/concepts/b.html`. Also a quick pass over `index.html` and over the presentation page around the overlay.

**Files.** SHA-256 of `b.html b.css b.js b-motion-* shell.* index.*` was taken before the first run and after the last one; no file changed during the audit (`…/scratchpad/agents4/a11y-hashes-recheck-start.txt` and `…-end.txt`). Line numbers below refer to those files.

---

## 1. Verdict

The iteration fixed or removed every high finding of the first audit. Of the 23 findings: **14 fixed, 4 closed because the component was removed, 3 open on purpose (owner, legal or build), 1 advisory unchanged, and 1 not fixed: A11Y-12 moved to new components.**

| status | findings |
|---|---|
| fixed | A11Y-02, 03, 05, 06, 07, 09, 10, 11, 14, 15, 18, 19, 21, 23 |
| closed by removal (the lid and the business band are gone) | A11Y-01, 04, 08, 17 |
| open, waiting for the owner, legal or the build | A11Y-13 (statement), 16 (post URLs, Q27), 22 (production checklist) |
| advisory, unchanged | A11Y-20 (AAA) |
| not fixed: the same failure moved to the new receipt, footer and map | A11Y-12, see N1 and N2 |

What was measured: axe finds no violation in the prototype itself. Every one of 2,310 text-line measurements passes on the pixels. Every focus ring is 5.2:1 or more, apart from a measurement artefact on the rotated polaroids, where the screenshots show the whole ring. No focus stop is hidden under the sticky bars at any size. Every motion stops within 5 s, apart from the ticker, which has its pause button. Reduced motion has 0 animations.

**It is still not AA, because of two new layout failures.** Both come from v3 components, and the CSS for both was injected and verified (`recheck-fix.css`):

1. **N1 (high): the footer.**
   - At 300 to 370 px wide, the display number "1700-55-22-55" is cut off: 60 px at 320, which shows "0-55-22-55". This fails 1.4.10 Reflow.
   - At 700 to 870 px wide, the side column is drawn over the main column: "אינסטגרם" over "קריית גת", and the legal links over the business line. At 720×450 (1440 at 200 %), "קריית גת" is fully covered when it has focus, which fails 2.4.11. Tablets at 768 are inside this range.
2. **N2 (medium): text spacing (1.4.12).**
   - With the WCAG spacing values at 1280 and 1440, the map labels on the map cover each other: the Kiryat Gat label hides the "נתיבות" heading, and the production-house label runs into the Ofakim label.
   - At 320 and 390, the receipt's number and the footer are clipped.

New low items: the map leaders are 2.95:1 (N3). Four presentation-shell or page issues follow (N4, N5, N7), plus N6 (the map entrance is about 5 s long) and N8 (an English phrase without `lang`).

---

## 2. Method (what was run)

The first audit's method, with the scripts adapted to the v3 markup. Scripts, raw data and screenshots are in `/tmp/claude-0/-home-user-edon-studio/39250604-ba72-5066-b62c-771f07ec61a3/scratchpad/agents4/a11y-re/`, in `out/`.

| check | how | raw data |
|---|---|---|
| axe-core 4.10.2 | from `https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js`. The local copy was re-downloaded, and its sha256 `b511cd9d…` is identical. Run on `.fs` after scrolling the whole page so every entrance has run. Tags wcag2a/aa, 21a/aa, 22aa and best-practice; `preload:false` because the page is opened from file://. 8 configurations + 2 launch-day runs + the phone menu open (4). Repeated with the shell's dialog/region roles removed. | `axe.json`, `axe-bare.json` |
| text contrast | pixel based: every visible text line is located, all text is made transparent, the real background is screenshotted, and the text colour is compared with every pixel. Pass = 5th percentile ≥ 4.5:1 (3:1 large). States: default (8 configurations), launch day (4 motion configurations), phone menu open (2). `color(srgb …)` values from `color-mix()` are read from the computed style. | `contrast-items.json`, `contrast-rows.json`, `hero-colors.json` |
| keyboard walk | Tab from the overlay's close button until it wraps, in all 8 configurations. Per stop: name, rectangle, 5 rotation-aware points through `elementFromPoint`, and a screenshot. | `keyboard.json`, `kb/<config>/NN.png` |
| focus ring | from each screenshot: the outline's centre line on the element's own rotated box, the visible share, and contrast against the pixels just inside and outside it (10th percentile) | `ring.json` |
| behaviour | skip link; theme Enter/Space; every in-page jump (5 nav, 2 hero, 3 footer cities, the bar's ניווט), measured after the smooth scroll settles; mobile menu (open, Tab past the end, Esc on the button and in the panel, choose a link, Shift+Tab); overlay Esc; launch-day switch; feed rail focus | `behaviors.json` |
| accessibility tree | CDP `Accessibility.getFullAXTree` in reading order, and Playwright `ariaSnapshot()` (1440 and 390, motion and reduced) | `ax-order-*.json`, `aria-*.yaml`, `tree.json` |
| target size 2.5.8 | every link and button in the overlay at 1440, 1100, 390 and 320, and the open menu | `targets.json` |
| reflow and zoom | 320×640, 360×225 (1440×900 at 400 %), 320×256 (1280×1024 at 400 %), 480×300 (300 %), 720×450 (200 %), 640×512 (1280×1024 at 200 %), 390×844. The overlay bar is hidden so the viewport equals the window. A keyboard walk forward and backward at each size, plus a 300 to 1200 px width scan of the footer. | `reflow.json`, `ftscan.json`, `reflow/*.png` |
| text spacing 1.4.12 | line-height 1.5, letter-spacing .12em, word-spacing .16em and paragraph spacing 2em on `p`, at 320, 390, 1100, 1280 and 1440 | `reflow.json`, `sec/*.png`, `verify-fix.json` |
| motion | `document.getAnimations()` at 1 to 8 s after the overlay opens. A pixel diff of the whole overlay between 8.0 and 9.5 s (the ticker band masked). A `requestAnimationFrame` counter at 10 s. Ticker pause under 24 wheel steps, and its playback rate while scrolling. The receipt's "בקרוב:" pulse. For the boxes, the map and the feed: screenshots every ~200 ms for 8 s after the section comes to rest. Reduced motion from the page switch and from the system setting. | `motion.json`, `seq.json` |
| bidi | measured x positions of `@` handles, number runs, dates, domains and Latin phrases | `bidi.json` |
| forced colours | Chromium `forcedColors: 'active'`, sections plus a keyboard-focused control | `forced/*.png` |
| fixes | `recheck-fix.css` injected and the failing measurements re-run | `verify-fix.json`, `fix/*.png` |

**Not done** (needs a person or a device): NVDA, JAWS, VoiceOver and TalkBack; real iOS and Android zoom; Windows High Contrast on a real machine; Firefox and WebKit.

---

## 3. The 23 findings of the first audit

| ID | first audit | status | evidence (this run) |
|---|---|---|---|
| A11Y-01 | lid focus ring 0 % visible | **closed by removal** | No `.lid` or `.det` is left (0 in the DOM), and nothing inside a box is focusable (0). The product list is printed on the box (plan R1). |
| A11Y-02 | focus under the sticky bar and header | **fixed** | 0 stops fully or partly covered in all 8 overlay walks. Forward and backward walks at 320×640, 360×225, 320×256, 480×300, 640×512 and 390×844: 0 fully covered. At 640×512, two polaroids are 2/5 under the header, which passes 2.4.11. `shell.css` line 174: `.vp:has(> .pb) { scroll-padding-block: 84px 76px }`. The one full cover at 720×450 is the new footer overlap (N1), not a sticky bar. |
| A11Y-03 | menu stays open after focus leaves | **fixed** | 390, reduced and motion: Tab past "הצהרת נגישות" closes the panel (`aria-expanded=false`), and focus lands on "בחרו סניף" with 0 stops under the panel. Esc with focus on the button closes it. Esc in the panel closes it, focus returns to "תפריט" and the overlay stays open. Choosing a link closes the panel and focuses its section. Shift+Tab from the first item goes to the button and the menu stays open. |
| A11Y-04 | "לעסקים ולרשתות" 4.05 / 2.15:1 | **closed by removal** | `.b2b-copy .hand` is gone. Its successors pass: the map quote `.here-q` (caramel text on the evening ground) is 6.11:1 or more, `.order-status .st` 7.60, and the menu's "לעסקים ולרשתות" 5.92. |
| A11Y-05 | dark desktop subtitle 3.39:1 | **fixed** | `.hero .sub`, 5th percentile: dark 1440 **5.47:1** (min 5.24) with motion and reduced; light 1440 **6.80** (motion) / **6.63** (reduced); phones 8.55 light, 12.11 dark. Kicker 7.14 or more everywhere. `h1 em` (large) 4.48 or more. The scrim is drawn by the hero module on `.sc-back::after`, and the copy in b.css is switched off. |
| A11Y-06 | caramel ring under 3:1 | **fixed** | `--focus` follows the ground (`b.css` lines 152-153, 233-235, 455, 509). Lowest ring at the 10th percentile per configuration, polaroids aside: 5.23 (light 1440, motion, the hero "בחרו סניף" over the photo), 6.14 to 9.62 elsewhere. Token pairs: light 12.69 / 13.93 / 10.47 (bg / paper / kraft), dark 14.98 / 12.90 / 14.19; tape and bar (`--on-band`) 14.97 / 12.69; footer 9.16 / 11.24; map 14.98. The polaroid readings (1.77 to 4.07 at p10) are an artefact: dark stripes of the placeholder photos match the ring colour. The screenshots show a whole ring lifted above the neighbours (`evidence/recheck-focus-polaroid-dark.png`). The ticker pause ring is inset and fully visible (`evidence/recheck-ticker-pause-focus-390-dark.png`). |
| A11Y-07 | ambient motion that never stops | **fixed** (owner override O5, option b) | Every CSS animation on a document timeline has ended by 5 s in all 4 motion runs (the last, the wheat stir, is still running at 4 s on 1440 light and gone at 5 s). The dust canvas is `display:none` and `hidden`. 0 `requestAnimationFrame` callbacks per second at 10 s. **0.0 %** of overlay pixels changed between 8.0 and 9.5 s (ticker masked). The receipt's "בקרוב:" pulse last runs 2.8 to 3.1 s after the receipt enters the view. The only loop is the ticker: Enter pauses it, the label flips to "הפעלת הסרט הנע", the position is unchanged after 24 wheel steps, and Space resumes it. |
| A11Y-08 | closed box details read by screen readers | **closed by removal** | No collapsible content is left. In the "soon" state, 0 `.when-live` elements are exposed. Visually hidden text is only `.sr-only` (the h1 separator, "(נפתח בחלון חדש)", "בבדיקה" behind "—") and `.order-n` (part of the header link's name, by design). |
| A11Y-09 | "@haofe_bakery" drawn as "haofe_bakery@" | **fixed** | `<bdi dir="ltr">` in the feed eyebrow (b.html line 484) and the type card (line 142). The bidi scan finds 0 problems in the overlay at 1440 and 390, the launch-day receipt and the presentation page (checked: @haofe_bakery, 1700-55-22-55, 08-9752093, the three opening-hour ranges, 7.10.2026, 22.8.2022, the post dates, haofeapp.com/order, "Google Maps", "OpenStreetMap contributors"). |
| A11Y-10 | no skip link, no `main` | **fixed** | `a.skip` is the first child of `.proto` (line 198). Inside the overlay it is the 2nd Tab stop, after the shell's scroll region (N4). It is visible on focus, inside the viewport and on top. Enter focuses the hero, and the next Tab is "בחרו סניף". `main.pg-main` (lines 232-499) holds the hero to the feed; the footer and the bar are outside it. |
| A11Y-11 | Shift+Tab reaches the invisible skip link | **fixed** | While the overlay is open, `a.skip`, `header.topbar` and `main` are all `inert:true` (`shell.js` lines 408-412). Shift+Tab from "סגירה (Esc)" goes to `body`, which in a real browser is the browser UI, and never to the page behind. Tab after the last control does the same, then wraps to the close button. |
| A11Y-12 | text spacing at 320 pushes blocks off screen | **not fixed: moved** | The old cause is fixed: `a[href^="tel:"]` wraps, and only `bdi[dir=ltr]` is `nowrap` (lines 285-286). The business band and the Kiryat Gat label it named are gone. The same failure is back in v3 components. At 320 with spacing, the receipt (`h2`, `.order-num`, the status line) runs 60 px past the start edge, and the footer runs 123 px past. At 390 with spacing, the footer runs 53 px past. See N1 and N2. |
| A11Y-13 | accessibility statement is a placeholder | **open** (legal, owner; BL-5) | Still `href="#" data-jump="top"` with `.tbd` "תיכתב אחרי הבדיקה". It is now also in the mobile menu (line 228). Expected at the concept stage; it must be a real page before launch. |
| A11Y-14 | `.vp` with `aria-label` but no role | **fixed** | `role="region"` is in `OVERLAY_HTML` (`shell.js` line 404) and on the three frames (b.html lines 70, 77, 81). `aria-prohibited-attr` is gone. axe now reports `landmark-banner/contentinfo/main-is-top-level` (best-practice, moderate, 1 node each), because the shell's region wraps the site. With the shell's dialog and region roles removed, axe reports **0** violations (1440 light motion, 390 dark motion). This is a presentation artefact and does not exist on the real site. |
| A11Y-15 | new-window links do not say so | **fixed** | 12 of 12 `target="_blank"` links with an `href` carry "(נפתח בחלון חדש)" (13 of 13 on launch day, with the order button). `.pb .sr-only` is defined in `b.css` lines 240-243. |
| A11Y-16 | polaroid links: long names, all to the profile | **open** (owner, Q27) | All three still go to `instagram.com/haofe_bakery/`. The name is still the placeholder label + caption + "פוסט · 15.10.2026 (נפתח בחלון חדש)", so it still promises a post. Waiting for the post URLs; do not guess. |
| A11Y-17 | lid label stays "פתחו" | **closed by removal** | No lid. |
| A11Y-18 | sticky bars fill the screen when zoomed | **fixed** | `@media (max-height:500px)` makes `.hd` and `.bar` `position: relative` (b.css lines 671-673). Measured relative at 360×225, 320×256, 480×300 and 720×450; still sticky at 640×512 and 390×844, where scroll-padding keeps focus clear. |
| A11Y-19 | ticker surges to 3.68× while scrolling | **fixed** | Highest playback rate while wheel-scrolling: 1.41 / 1.36 / 1.45 / 1.46 (1440 light, 1440 dark, 390 light, 390 dark), under the 1.5× cap. It stays paused when paused. |
| A11Y-20 | scroll-linked depth, pointer lean, the leap (AAA) | **unchanged, advisory** | Still present with motion on: hero scroll timelines, the header shadow and the box leap. Under reduced motion (the page switch and the system setting): 0 animations, no canvas, no flying layer, no module classes, the route drawn complete (`stroke-dashoffset: 0`), 0 hidden pins or labels. There is still no visible "הפחתת תנועה" switch on the site; that would go beyond AA. |
| A11Y-21 | "הדמיית AI" note read before the headline | **fixed** | `.ai-note` now follows `.hero-text` in the source (line 271). The hero region starts with the h1 in the AX tree. The label stays visible in every configuration at 5.53:1 or more. |
| A11Y-22 | production checklist | **open, for the build** | The prototype still uses `href="#"` + `data-jump` (expected inside the shell). `lang="he" dir="rtl"` and `<title>` are kept. A remembered motion pause is not needed under option (b). The ordering app (haofeapp.com/order) still needs its own audit before launch. |
| A11Y-23 | feed eyebrow on the contrast edge (4.58:1) | **fixed** | `@haofe_bakery` is now Rubik 600 in `--head`: 8.54:1 (390 light) to 11.59:1 (1440 dark) at the 5th percentile. |

---

## 4. New findings

### N1 · Footer: the number is cut off at 300 to 370 px, and the columns overlap at 700 to 870 px · high
1.4.10 Reflow (AA) **(2.1)**; 2.4.11 Focus Not Obscured (Minimum) (AA) **(2.2)**

- **Where.** `b.css`:
  - `.pb .ft .in { grid-template-columns: auto minmax(0, 1fr) }` (line 556);
  - `.pb .ft-num` uses `font: 400 clamp(40px, 4.6cqi, 60px)`, and its `bdi` is `white-space: nowrap` (lines 563 and 286);
  - from 700 px the footer has three columns, `auto minmax(0,1fr) auto` with a 40 px gap (line 592).
- **Why.** The 40 px number is 268 px wide. Next to the sticker at 320 px the column is 188 px wide. The number overflows to the end side and `.pb { overflow-x: clip }` cuts it. From 700 px, the number and the city links overflow the shrinking middle column into the side column.
- **Measured.**
  - Width scan, 10 px steps. The number is clipped by 80 / 60 / 20 / 10 px at 300 / 320 / 360 / 370 px; at 320 it reads "0-55-22-55" (`evidence/recheck-footer-320-number-cut.png`). The `.tbd` business line is clipped too.
  - Side over main: 6,651 px² at 700, 5,612 at 720, 3,658 at 768, 220 at 860, 0 from 880 (`evidence/recheck-footer-720-overlap.png`).
  - At 720×450, the focused "קריית גת" link is covered at 5 of 5 sample points by `ul.ft-social`, going forward and backward.
- **Fix** (`recheck-fix.css`, N1 block):
  - below 420 px, the sticker goes above the text (`grid-template-columns: minmax(0,1fr)`);
  - from 700 to 879 px, two columns, with `.ft-side` spanning the whole row;
  - `.ft-num bdi` and `.order-num bdi` get `white-space: normal; overflow-wrap: anywhere`, so at extreme widths the number wraps instead of being cut.
- **Verified.** 0 px² overlap at 700, 720, 768 and 860. Nothing clipped at 320 and 360. The 720 and 1440 layouts are otherwise unchanged (`evidence/recheck-footer-receipt-after-fix.png`).

### N2 · Text spacing: the map labels cover each other; the receipt and footer clip · medium
1.4.12 Text Spacing (AA) **(2.1)**

- **Where.**
  - From a map width of 760 px, the labels are absolute boxes at fixed `--lx/--ly` (b.css lines 645-655), so a label that grows cannot push its neighbour.
  - The receipt number (`.order-num`, line 444) and the footer number are unbreakable.
- **Measured** (WCAG values; paragraph spacing on `p` only).
  - 1440×900:
    - the Kiryat Gat label covers the Netivot label's heading, so "נתיבות" reads "בות";
    - the production-house label runs into the Ofakim label;
    - label overlap totals 8,747 px² (`evidence/recheck-map-text-spacing-1440.png`).
  - 1280×900:
    - the label overlap totals 18,746 px²;
    - the production-house label covers the "אופקים" heading.
  - The footer also overlaps at 1280 and 1440 (381 and 525 px²).
  - At 320, the receipt heading, number and status line run 60 px past the edge, and the footer runs 123 px past.
  - At 390, the footer runs 53 px past.
  - Default spacing at the same sizes is fine.
- **Fix.**
  - The two number rules of N1.
  - For the map, either:
    - lay the labels out in flow (for example two stacked columns at the map's edges), so a taller label pushes the next one down; or
    - use the list layout that phones already have, at every width.
  - The second is the N2 block of `recheck-fix.css`.
- **Verified** (list fallback + the N1 rules): label overlap 0 at 1280 and 1440 with spacing; nothing clipped at 320, 390, 1280 or 1440 with spacing. If the design keeps the labels on the map, re-run `verify-fix.js` after the change.

### N3 · Map leaders 2.95 to 2.99:1 · low
1.4.11 Non-text Contrast (AA) **(2.1)**, at risk

- On the wide map the pin numbers and pin names are hidden (`.pin-n, .pin-tag { display:none }`, line 654). The 1 px leaders, and how close each label sits to its pin, are then the only link between a label and its pin.
- `rgba(247,241,230,.35)` on `#17100B` is 2.99:1, and on `#110B07` (dark) 2.95:1.
- **Fix:** `.pb .leaders { stroke: rgba(247,241,230,.5) }` gives 4.83 / 4.86:1, and .45 gives 4.15. Only needed if the labels stay on the map.

### N4 · Overlay: the scroll region is a Tab stop with no visible focus · low (presentation shell)
2.4.7 Focus Visible

- `OVERLAY_HTML` gives `.vp` `tabindex="0"` (`shell.js` line 404). It is the 1st Tab stop after the close button, in every configuration.
- Its outline (`#23408C`, offset -4px) is painted under the prototype's own content: 0 % visible (`evidence/recheck-shell-vp-focus-invisible.png`).
- **Fix:** either:
  - drop `tabindex="0"` from the overlay's `.vp`: the prototype has focusable content, and arrow keys scroll the region once focus is inside; or
  - show a ring in the overlay bar, e.g. `.fs:has(> .vp:focus-visible) .fs-bar { box-shadow: 0 3px 0 #23408C }`.
- The real site has no such element.

### N5 · In-page jumps stop 64 px from the top, but the desktop header is 75 px · low (presentation shell)
- `JUMP_OFFSET = 64` (`shell.js` line 61).
- For sections this is hidden by their top padding. After a jump to a map label at 1440 (footer city links, "לעסקים"), the label's top 10 to 15 px is under the header, and its h3 0 to 5 px.
- Focus is not hidden (2.4.11 passes), but the heading is cramped.
- **Fix:** 84, the value already used by `scroll-padding`. Every other jump lands with its heading clear of the header and above the bar, in all 4 runs.

### N6 · The map entrance runs about 5 s · low, advisory
- After the map comes to rest in view with motion on, the last frame with movement is between 4.85 and 5.4 s at 1440, and at 3.9 s at 390 (`evidence/recheck-map-sequence-1440.png`).
- The production-house label, with the ordering line, appears last.
- For comparison, the boxes take 1.7 to 2.2 s and the feed 1.4 to 2.2 s.
- It is a one-shot entrance started by scrolling, not an ambient loop, so 2.2.2 does not fail. Focus in a label finishes it at once, and reduced motion shows it complete.
- It sits at the edge of the owner's 5-second rule (O5). Consider compressing it to 4 s or less.

### N7 · Presentation page (b.html around the frames) · low
axe on `b.html` without the overlay:
- `landmark-main-is-top-level` (3), `landmark-no-duplicate-main` (1) and `landmark-unique` (8): the site is mounted three times inside the page's `main`. This is an artefact.
- At 390, `scrollable-region-focusable` (serious) on the presentation page's own motion table, `<div class="tbl-wrap">` on b.html line 156. It scrolls sideways with no `tabindex`. index.html got this fix (IDX-02); b.html did not. **Fix:** `<div class="tbl-wrap" role="region" tabindex="0" aria-labelledby="mot-b">`.
- At 390, `target-size` (4) inside the desktop frame, which is scaled down to about 0.27. This is an artefact of the preview.

### N8 · An English phrase without `lang` · advisory
- 3.1.2: "© OpenStreetMap contributors" (`.here-src`, b.html line 396) is read with a Hebrew voice.
- **Fix:** `<span lang="en" dir="ltr">© OpenStreetMap contributors</span>`. This also draws the © to the left, the usual form.
- "Google Maps" and "AI" are names or common terms and need nothing.

---

## 5. What passes (this run)

- **axe-core**, overlay, 14 runs (8 configurations, 2 launch-day, 4 with the phone menu open): no violation apart from the three landmark-nesting items caused by the shell (A11Y-14). The 54 to 73 "incomplete" contrast items per configuration (photo, gradient and texture backgrounds) were all settled by the pixel check.
- **Text contrast**: 2,310 line measurements, 0 below the requirement at the 5th percentile. The smallest margins, all passing:

  | text | contrast |
  |---|---|
  | footer secondary text (`.ft-label`, `.ft-b2b`, the legal `.tbd`), light | 5.10:1 |
  | dark desktop hero subtitle | 5.47 |
  | Ofakim label `dt` on the evening ground | 5.47 |
  | desktop "הדמיית AI" caption | 5.53 |
  | map scale "10 ק״מ" | 5.62 |

  The printed `.ai-tag` on the boxes is 5.84 (light) and 9.54 (dark). The tape is 12.69 to 14.97. The "בקרוב" chip is 7.49 or more.
- **Keyboard**: every control is reachable, in the RTL reading order, and works with Enter (and Space where it is a button). The prototype has 30 stops at 1440 with motion and 29 reduced (the reduced ticker has no pause button); 28 and 27 at 390, including the 3 bar links. In order:
  - skip link and logo;
  - the 5 nav links;
  - theme and the header phone;
  - the 2 hero buttons and the ticker pause;
  - the receipt number and the Netivot phone;
  - 3 × Google Maps and the production-house phone;
  - the 3 polaroids and "לכל הפוסטים";
  - the footer number and the 3 cities;
  - Instagram and TikTok, then the statement and privacy links.

  Every stop shows `:focus-visible`. On phones, focusing the 2nd and 3rd polaroid centres each one fully inside the rail.
- **Names and states**:
  - theme "מצב כהה" with `aria-pressed`, focus kept on toggle;
  - "תפריט" with `aria-expanded`;
  - the ticker label switches;
  - the branch phone links name the number, and their `dt` gives the context;
  - "Google Maps, ניווט לסניף … (נפתח בחלון חדש)" starts with its visible label (2.5.3);
  - the launch-day button is "להזמנה אונליין (נפתח בחלון חדש)";
  - in the "soon" state the app link has no `href` and is `display:none`.
- **Structure**:
  - one h1 with the full sentence: kicker, separator and slogan. With motion it is split into words and carries a matching `aria-label`.
  - 4 h2 and 10 h3 (5 boxes, 5 places), with no skipped level.
  - Landmarks: banner, main, 5 named regions, contentinfo; nav "ראשי" on desktop; "הסניפים במפה"; "פעולות מהירות" on phones.
  - The map is `role="img"` with a full `aria-label`, followed by a list of labels as `dl` term/definition pairs. Missing values read "בבדיקה".
  - Six product alts end with "הדמיית AI"; the placeholders are "צילום זמני: …".
- **Target size 2.5.8**: the only targets under 24 px pass on spacing:
  - the Netivot phone (86.7×17);
  - the production-house phone (183.8×16 at 1100 and 390);
  - the footer legal links (76.7×15, 79×15).

  Header buttons are 44 px, bar links 64.8 px and menu links 37 to 49 px tall.
- **Reflow**: no horizontal scroll at any width tested (`scrollWidth = clientWidth` from 320 to 1440). Exceptions: the footer (N1), and the phone feed rail, which scrolls sideways on purpose with a scrollbar-less snap.
- **Reduced motion**: complete with the page switch and with the system setting (section 3, A11Y-20). Jumps are instant.
- **Forced colours**: text, buttons, map labels, the route and the pins stay visible. The keyboard focus ring shows (system colour) on the Google Maps chip and the footer number.
- **index.html**: 0 axe violations at 1440 and 390, light and dark. `lang="he" dir="rtl"`, viewport meta, `main tabindex="-1"`, 6 tables with 6 captions, 0 empty `th`, no horizontal scroll at 390. It still renders in quirks mode when opened from file:// (no doctype, by design, as the shell agent noted).
- **Console**: 0 console errors, 0 page errors and 0 failed requests in every run.

---

## 6. Open questions and what remains

- N1 and N2 need a b.css change (the `recheck-fix.css` blocks, or the design's own layout). After that, re-run `reflow.js`, `ftscan.js` and `verify-fix.js` without the injection.
- A11Y-13 (statement), A11Y-16 (post URLs, Q27) and the pending owner facts (`.tbd`) stay open by design. The `.tbd` markers are plain and readable (dashed underline + tint, read as text).
- Not done: screen readers, real devices, Firefox and WebKit.

---

## How to reproduce

From the scratch folder `…/scratchpad/agents4/a11y-re/` (the scripts open `file:///home/user/edon-studio/clients/haofe/concepts/b.html`):

```
node smoke.js; node axe-run.js; node axe-bare.js
node contrast-collect.js && node heroColors.js && python3 -I contrast-analyze.py out
node keyboard.js && python3 -I ring.py out keyboard.json
node behaviors.js; node tree.js; node targets.js; node bidi.js
node motion.js; node mapseq.js
node reflow.js; node ftscan.js; node verify-fix.js      # verify-fix.js injects fix-recheck.css (= recheck-fix.css)
node forced.js; node forced2.js; node index-check.js; node axe-page.js
```

---

## Round 2 · independent verification of iteration 3.1 · 24.10.2026, 12:36 to 13:35 UTC

Verifier role: independent and read-only on `concepts/` and `site-plan/`. SHA-256 of `b.html b.css b.js b-motion-* shell.* index.*`, the skeleton `page.css` and its test file were the same at the start and at the end (`…/scratchpad/agents4/verify5/hashes-start.txt`, `hashes-end.txt`).

**Method.** I copied this audit's scripts to `…/scratchpad/agents4/verify5/a11y/` and changed only one thing: the concepts path became an environment variable. Then I ran each script twice:
- on an exact copy of iteration 3, to reproduce the failure. The copy is `verify5/base/`, rebuilt from `qa/cc` plus the original scroll module from `shell5/cc0`. Every file matches the hashes in `a11y-hashes-recheck-start.txt`.
- on the live files, to show the fix.

`behaviors.js` got one tolerance: the first Tab stop may now be the skip link. Raw output is in `verify5/a11y/out` (live files) and `out-base` (iteration 3). The logs are `*-now.log` and `*-base.log`.

### R2.1 Verdict

Iteration 3.1 fixes all eight new findings, N1 to N8, and nothing regressed. One new medium issue came with the in-flow map labels: with WCAG text spacing on a wide map, the Netivot opening hours run past their label (R2.4, N9). Apart from that, the prototype passes every check I ran in this round. The open items A11Y-13, 16 and 22 are still waiting for the owner, legal or the build, as expected.

### R2.2 N1 to N8

| ID | status | iteration 3 (reproduced) | iteration 3.1 |
|---|---|---|---|
| N1 footer reflow and overlap | **fixed** | `ftscan.js`: the number was clipped by 80, 70, 60, 50, 40, 30, 20 and 10 px at 300 to 370. The side column covered the main one by 6,651 px² at 700, falling to 71 at 870. `reflow.js` at 720×450: "קריית גת" fully covered (5/5 points) by `ul.ft-social`, forward and backward. | `ftscan.js`: no failing width from 300 to 1200. `reflow.js` at 720×450: 0 fully covered stops (one polaroid is partly covered at 1 of 5 points, as in iteration 3). QA `ftnum.js`: footer number 74..300 inside a 20..300 column at 320, and the receipt number 51..279 inside a 18..302 slip. |
| N2 text spacing | **fixed** (but see N9) | `verify-fix.js`, no injection: label overlap 18,746 px² at 1280 and 8,747 at 1440. Footer overlap 381 and 525. At 320, 9 clipped items (receipt h2, number, status, footer). At 390, 5. | Every case 0: footer overlap, clipped items and label overlap, at 320, 360, 720, 768, 860 and 1440, and with spacing at 320, 390, 1280 and 1440. `verify5/qa/mapcol5.js`: no label touches a pin, chip, tag, the route, the arrow north, "לסופרים בכל הארץ", the north arrow or the scale, at 13 widths, in dark and with spacing at 1000, 1280, 1440 and 1920. |
| N3 leader contrast | **fixed** (the leaders were removed) | leaders 2.95 to 2.99:1 | No leaders are drawn (`.leaders` has no geometry). Pins and labels are tied by the same mark, checked at every width: 1/2/3, the square, the dotted ring. Pixel contrast: pin chips 7.80:1 (#17100B on caramel), label chips 7.49:1 (#FFFAF2 on #7A4520). |
| N4 overlay `.vp` Tab stop | **fixed** | 1st stop after "סגירה" was the `.vp`, with 0% of its ring visible | The overlay `.vp` has no `tabindex`, and the first Tab goes to the skip link (1440 and 390). PageDown, ArrowDown, End and Home still scroll it from focus inside (scrollTop 0 → 596 → 636 → 3963 → 0, `verify5/qa/kbscroll.js`). The keyboard walk has one stop fewer (32 against 33 at 1440 motion). A page frame's focused `.vp` now shows a 3px #23408C ring on the frame box (`verify5/shots/frame-ring.png`). |
| N5 jump offset | **fixed** | QA `hd.js`: label top 64 to 65 under a 75px header at 1440 and 1280. `behaviors.js`: "לעסקים" and the footer cities had their heading at 128 to 133, under a header bottom of 133. Skip and logo jumps stopped at scrollTop 11. | Label top at 87 to 88 under 75 (1440, 1280) and 75 to 76 under 63 (390). Every jump, in 4 runs (1440 and 390, motion and reduced), lands with its heading clear of the header (gap 8 to 13px) and above the bar. Skip and logo jumps reach scrollTop 0. |
| N6 map entrance length | **fixed** | `mapseq.js` (screenshot diff after rest): last moving frame at 5,392 ms (1440) and 4,039 ms (390) | 3,059 ms (1440) and 3,044 ms (390). The QA probe: complete at 2.5 s, against 3.5 to 3.6 s before. |
| N7 presentation-page table | **fixed** | `axe-page.js` 390: `scrollable-region-focusable` (serious) on `.tbl-wrap` | Gone. `.tbl-wrap` has `role=region tabindex=0 aria-labelledby` pointing to a hidden caption. The remaining items are the known artefacts of three mounted copies: landmark ×3, ×1 and ×8, and `target-size` ×4 in the scaled desktop frame. |
| N8 English phrase | **fixed** | no `lang` | `<span lang="en" dir="ltr">© OpenStreetMap contributors</span>`. The bidi scan finds 0 problems in the overlay at 1440 and 390 and on the presentation page. |

Still open by design: A11Y-13 (the statement link is still `href="#"` with "תיכתב אחרי הבדיקה"), A11Y-16 (all 7 Instagram links still go to the profile) and A11Y-22. A11Y-20 is advisory and unchanged.

### R2.3 Fresh regression sweep (live files)

| check | result |
|---|---|
| axe-core 4.10.2 (cdnjs copy, sha256 `b511cd9d…`), overlay, 14 runs (8 configurations, 2 launch-day, 4 with the phone menu open) | only `landmark-banner/contentinfo/main-is-top-level`, 1 node each, the shell-wrapper artefact, the same as before. `axe-bare.js` with the shell roles removed: **0** at 1440 light and 390 dark. |
| pixel text contrast, 8 configurations plus launch-day and menu states (2,428 text lines) | 0 real failures. One measured group is below 4.5 at the 5th percentile: the first caption line of the 1st polaroid, 390 dark, p05 3.55 (median 14.42). It is a line-box artefact. The caption's axis-aligned line box clips the corner of the photo on the rotated card. The card geometry is the same as in iteration 3 within 1px (`verify5/qa/polacmp.js`), and the glyphs clear the photo (`verify5/shots/pola-now-dark.png`). The smallest real margin is unchanged: footer `.ft-b2b` / `.tbd` in light at 1.13× the requirement. |
| keyboard walk, focus visibility under sticky bars (8 configurations, `keyboard.js` + `ring.py`) | 32/31 stops at 1440 and 30/29 at 390 (motion/reduced), all `:focus-visible`. Ring visibility and contrast are identical to the iteration-3 run, apart from the removed `.vp` stop. The only "covered" stop is the production-house phone at 1 of 5 points, already in iteration 3: a sample point falls in the gap of the wrapped inline link. Shift+Tab from "סגירה" goes to `body` with the page behind inert. |
| behaviour (`behaviors.js`, 4 runs) | Skip link visible and on top. Theme Enter/Space keeps focus. Menu: open, Tab past the end closes it, Esc on the button and in the panel, choosing a link, and Shift+Tab all pass. Phone rail polaroids fully inside. Overlay Esc returns focus. Soon state: the live link is `display:none` with no `href`, and no app URL is shown. |
| text spacing | see N2, plus N9 below |
| reflow 320 and zoom 200/300/400 % (`reflow.js`, 7 sizes, Tab forward and back) | no horizontal scroll, and 0 fully covered stops at any size. The only items "past the viewport" are the phone feed rail's off-screen cards, a sideways rail by design. The visually hidden `.order-n` is reported as "clipped", as before. |
| motion (`motion.js`) | Every document-timeline animation has ended by 4 to 5 s; after that only scroll-linked ones remain. The dust canvas is `display:none`. 0 rAF callbacks per second at 10 s. 0.0% of pixels change between 8.0 and 9.5 s (ticker masked). The ticker pauses with Enter, stays still while scrolling, and its top rate while scrolling is 1.36 to 1.45 (under the 1.5 cap). Reduced motion, from the switch and the system setting: 0 animations, no module classes, route complete, 0 hidden pins. |
| content left hidden after scroll patterns (QA `patterns.js` at 1440 light, 390 dark, 1280 dark; QA matrix at 20 configurations) | 0 hidden after a fling to the end, scrolling back up, and every nav, menu, footer, bar and logo jump (at 2 s). A stop mid-boxes clears by 500 to 800 ms. After the full scroll-through, nothing is hidden in any configuration. |
| console | 0 console errors, 0 page errors and 0 failed requests in every run. |
| horizontal scroll | none at 17 widths from 320 to 1920 (QA `layout.js`, light and dark). |
| skeleton suite (run on a scratch copy, `verify5/sk`, so `site-plan/` was not written) | 23/23 passed, including "skip link first", "lands below the sticky header", "no horizontal scroll at 320/390/768/1280" and the contract-2 module checks. |

### R2.4 New finding

**N9 · Text spacing: the Netivot opening hours run past their label on a wide map · medium**
1.4.12 Text Spacing (AA) **(2.1)**

- **Where.** The labels now stand in grid tracks. Netivot's track is 26% of the map (it was a 29% absolute box). Each row of `ul.hrs li` is `display:flex` with no wrap, and its `bdi[dir=ltr]` is `nowrap`.
- **Measured** (`verify5/qa/lblover.js`, text-node rectangles against the label box). With the WCAG spacing values, "20:00–23:00" runs past the label's start edge by:

  | width | overflow |
  |---|---|
  | 1000 and 1100 | 3.9 px |
  | 1280 | 6.6 px |
  | 1366 | 4.6 px |
  | 1440 and 1920 | 1.1 px |

  "05:00–15:00" and "05:00–22:00" run into the padding. Past the box the dark text sits on the dark map, so at 1280 the leading "2" disappears and the time reads "0:00–23:00" (`verify5/shots/netivot-hrs-1280sp.png`). Iteration 3 was clean at the same sizes. Default spacing is clean.
- **Fix** (b.css): `.pb .hrs li { flex-wrap: wrap; column-gap: 10px; }`, so the time drops under its day when the row cannot fit. The other option is a slightly wider Netivot track (`minmax(26%, max-content)`). After either change, rerun `lblover.js` and `mapcol5.js`.

### R2.5 How to reproduce

From `…/scratchpad/agents4/verify5/a11y/` (prefix `A11Y_OUT=out-base CONCEPTS=…/verify5/base` for iteration 3):
```
node ftscan.js; node verify-fix.js; node reflow.js; node axe-run.js; node axe-page.js; node axe-bare.js
node behaviors.js; node keyboard.js && python3 -I ring.py out keyboard.json
node contrast-collect.js && node heroColors.js && python3 -I contrast-analyze.py out
node mapseq.js; node motion.js; node bidi.js; node targets.js; node tree.js
```
From `…/verify5/qa/` (prefix `QA_OUT=out-base QA_URL=file://…/verify5/base/b.html` for iteration 3): `node ftnum.js; node hd.js; node layout.js; node patterns.js; node matrix5.js; node mapcol5.js; node lblover.js; node kbscroll.js; node polacmp.js`.
