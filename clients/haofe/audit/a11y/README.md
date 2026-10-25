# האופה · direction B "השקית" · accessibility audit

Auditor role: accessibility, against WCAG 2.2 AA and ת"י 5568. Date: 24.10.2026. Status: prototype audit, before build.

**Scope.** The direction B prototype inside the full-screen overlay of `concepts/b.html` (the `[data-full]` button), at 1440×900 and 390×844, light and dark, motion on and reduced motion (8 configurations). Also `concepts/index.html` at 1440 and 390, light and dark. The presentation page around the overlay (`b.html` frames, `shell.js`) is covered only where it changes what a keyboard or screen-reader user meets inside the overlay.

**Files.** Other agents were editing the motion files while this audit ran, so it was run on two snapshots and then spot-checked on the live folder:

| run | time (UTC) | notes |
|---|---|---|
| snap1 | 01:47 | first full run; fix pack first verified here |
| **snap2** | **02:27** | **full re-run; every number in this report is from snap2 unless marked "snap1"**. Since snap1, `b-motion-hero.*` and `b-motion-scroll.*` were rewritten (scroll depth, pointer lean, flour dust, wheat sway, the bread "leaping" into the boxes, ticker surge), `b.html` got `aria-label`s on the branch links, and `b.js` writes the app URL only in "live" mode |
| live | 02:48 | motion files changed again (geometry and compositing only). Re-checked the motion-dependent results (hero contrast, ongoing motion, reduced motion): **same as snap2** |

SHA-256 of every audited file at snap2 and at 02:48 is in the scratch folder (`hashes-snap2.txt`, `hashes-live-final.txt`). `b.css`, `b.html`, `b.js`, `shell.css`, `shell.js` and `index.html` did not change between snap2 and 02:48. Line numbers below refer to those files. For the motion files the report names selectors and keyframes, because their lines keep moving.

**Standard.** Regulation 35א of the accessibility regulations requires internet services to meet ת"י 5568 at level AA. The current edition of ת"י 5568 part 1 was published 28.09.2023, and the Standards Institution page does not say which WCAG version it is based on (source: `research.json` → `research:ordering-law`, from nevo.co.il and sii.org.il, read 24.10.2026). The brief calls it WCAG 2.0 based. This audit tests WCAG 2.2 AA and tags criteria that are new in WCAG 2.1 or 2.2 with **(2.1)** or **(2.2)**: those may not be required by ת"י 5568. Everything untagged is a WCAG 2.0 A/AA criterion, required under either reading.

---

## 1. Verdict

The structure is good. The lids are real buttons with `aria-expanded`. There is one `h1`, a clean heading outline and named regions. Product images have Hebrew alt text that includes "הדמיית AI". The ticker has a pause button. Reduced motion is complete (0 running animations, measured). The dialog returns focus, and no target is smaller than allowed. axe-core finds one real violation in the overlay.

**It is not yet AA.** Seven problems would fail an audit today. All of them are fixable in CSS or a few lines of JS, and every fix below was injected into the running prototype and re-measured on snap2:

1. **Focus is invisible on all six product lids**: `.box { overflow: hidden }` clips the ring. 0% of the ring is visible, in all 8 configurations.
2. **Focus hides under the sticky mobile bar**, and at 200% and 400% zoom under the header too. **(2.2)**
3. **The mobile menu stays open over the page after focus leaves it.** The next three focused controls are under the panel, and Esc does nothing from there. **(2.2)**
4. **"לעסקים ולרשתות"** (`.b2b-copy .hand`) fails text contrast in both modes: 4.05:1 light, 2.15:1 dark.
5. **The dark desktop hero subtitle** fails contrast over the photo: 3.39:1. The light one passes only by 0.02 with motion off and fails at 4.43:1 with motion on.
6. **The caramel focus ring is under 3:1** on kraft and on the dark-mode cream bands (2.15:1 to 2.62:1). **(2.1)**
7. **Ambient motion never stops and cannot be stopped**: wheat sway, flour dust, the "בקרוב" dot. The ticker pause button covers only the ticker.

| severity | count | meaning |
|---|---|---|
| high | 7 | fails AA for many users or on a main path |
| medium | 8 | fails AA in a limited place, a legal item, or a presentation-shell issue that affects the demo |
| low | 8 | best practice, AAA, "at risk", or production checklist |

Evidence images are in `evidence/`, and the CSS part of the fixes is in `fix-pack.css`.

---

## 2. Method (what was actually run)

| check | how | raw data (scratch folder) |
|---|---|---|
| axe-core 4.10.2 | fetched from `https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js`, run on `.fs` (the overlay root) with the tags wcag2a/aa, wcag21a/aa, wcag22aa and best-practice, after scrolling the whole page so every `[data-rv]` entrance has run | `out2/axe.json` |
| text contrast | **pixel based**: every visible text line is located, all text is made transparent, the real background pixels behind each line are screenshotted, and the text colour (with opacity) is compared against every pixel. Pass = 5th percentile ≥ 4.5:1 (3:1 for large text); the minimum is reported too. States: default, all boxes open, order "live", mobile menu open | `out2/contrast-rows.json` |
| token contrast | every text/background token pair and every focus-ring/background pair, both modes | `out/tokens.json`, section 7 |
| keyboard | Tab from the overlay's close button through every stop until it wraps. Per stop: name, role, state, rectangle, whether anything covers it (5 sample points through `elementFromPoint`), and a screenshot | `out2/keyboard.json`, `out2/kb/*/NN.png` |
| focus ring | from each screenshot: sample the outline's centre line, count how much of it shows, and measure its contrast against the pixels just inside and outside it | `out2/ring.json` |
| behaviour | lid Enter/Space; ticker pause Enter/Space; theme toggle; the 5 in-page jump links; mobile menu (open, Tab past the end, Esc inside and outside); overlay Esc and focus return | `out2/behaviors.json` |
| accessibility tree | Chrome DevTools Protocol `Accessibility.getFullAXTree` and Playwright `ariaSnapshot()`. `page.accessibility.snapshot` no longer exists in Playwright 1.63 | `out2/aria-*.yaml`, `out2/ax-*.json` |
| target size 2.5.8 | every link and button; anything under 24×24 checked against the spacing and inline exceptions | `out2/targets.json` |
| reflow and zoom | 320×640; 1440×900 at 200% (= 720×450 CSS px) and at 400% (= 360×225); 1280×1024 at 400% (= 320×256). The presentation bar is hidden so the viewport matches a real page | `out2/reflow.json`, `zoomkb.js` |
| text spacing 1.4.12 | the WCAG bookmarklet values (line-height 1.5, letter-spacing .12em, word-spacing .16em, paragraph spacing 2em) at 1440, 390 and 320, every box open; looks for clipped and off-screen text | `out2/reflow.json` |
| motion 2.2.2 / 2.3.3 | `document.getAnimations()` at 2, 4 and 8 s; two hero screenshots 1.5 s apart with the pointer away; ticker play state and rate while scrolling, paused and unpaused; the same in reduced motion | `out2/motion2.json`, `out-live/motion2.json` |
| bidi | for every text node, the measured x position of `@` against the next letter, and of the first and last character of number ranges and domains | `out2/bidi.json` |
| forced colours | Chromium `forcedColors: 'active'` screenshots | `out/forced-*.png` |

**Not done** (needs a person or a device): listening with NVDA, JAWS, VoiceOver and TalkBack; iOS and Android zoom and switch access; Windows High Contrast on a real machine. The accessibility tree is the closest proxy available here.

Scripts and raw data are in `/tmp/claude-0/-home-user-edon-studio/39250604-ba72-5066-b62c-771f07ec61a3/scratchpad/agents4/a11y/`, which is scratch space outside the project.

---

## 3. Findings

Each finding gives what fails, the measurement and the exact change. "Verified" means the change was injected into the running prototype (snap2) and the same measurement re-run.

### High

**A11Y-01 · Focus ring invisible on all six product lids** · 2.4.7 Focus Visible (AA)
- Where: `b.css` line 120, `.pb :focus-visible { outline: 3px solid var(--caramel); outline-offset: 3px; border-radius: 6px; }`, combined with line 221, `.pb .box { … overflow: hidden; … }`. The lid (`.lid`, line 230) spans the full width of the bottom of its box. An outline drawn 3px outside it lies wholly outside the box, so the box clips it.
- Measured: 0% of the ring visible on every lid in all 8 configurations (`evidence/lid-focus-before-after.png`). The only change on focus is the 6px lift from `.box:focus-within` (`b-motion-micro.css`). That is not an identifiable focus indicator, and in reduced motion it is the same 6px jump.
- Fix (`b.css`, after line 120): `.pb .lid:focus-visible { outline-offset: -6px; }`, which draws the ring inside the lid. Use it with the focus token from A11Y-06.
- Verified: ring 100% visible, at 11.8:1 against the lid in light mode and 12.4:1 in dark mode.

**A11Y-02 · Focus hidden under the sticky bar and header** · 2.4.11 Focus Not Obscured (Minimum) (AA) **(2.2)**
- Where: `b.css` line 147, `.pb .hd { position: sticky; top: 0 }`, and line 307, `.pb .bar { position: sticky; bottom: 0 }`. When Tab moves to a control below the fold, the browser scrolls only far enough to show it at the bottom edge, which is exactly where the 65px bar sits. Nothing tells the scroller about the sticky areas.
- Measured (snap2):
  - 390×844: the lids "חלות", "מאפים חלביים" and "סופגניות" are **fully** covered by `.bar` (5 of 5 sample points), in light, dark, motion and reduced; "ניווט/חיוג לסניף שדרות" are 3/5 covered (`evidence/bar-covers-lid.png`).
  - 1440×900 at 400% (360×225): going forward, "הצהרת נגישות" and "מדיניות פרטיות" are fully under the bar; going backward, "ניווט/חיוג לסניף קריית גת" are fully under the header.
  - 1280×1024 at 400% (320×256): the footer links "אינסטגרם" and "טיקטוק" are fully under the bar.
  - 1440×900 at 200% (720×450): "לכל הפוסטים באינסטגרם" is fully under the bar.
  - Which control lands under the bar depends on the viewport height, so the problem appears at many sizes.
- Fix, prototype: the scroller is the shell's `.vp`, so in `shell.css` add `.vp:has(> .pb) { scroll-padding-block: 84px 76px; }`. That is the header (74px) + 10 and the bar (65px) + 11.
- Fix, real site, where the window scrolls: `html { scroll-padding-top: 84px; }`. On phones add `scroll-padding-bottom: calc(76px + env(safe-area-inset-bottom))`. Un-stick both bars on short screens with `@media (max-height: 500px) { .pb .hd, .pb .bar { position: relative; } }`. At 400% zoom the two bars take 128 of 225 CSS px, which is 57% of the screen (A11Y-19).
- Verified: 0 fully covered stops at 390×844, 360×225, 320×256 and 720×450, forward and backward, and in all 8 configurations of the overlay walk.

**A11Y-03 · Mobile menu stays open after focus leaves it** · 2.4.11 (AA) **(2.2)**; 2.1.1 Keyboard
- Where: `shell.js`, `Shell.menu`, lines 173 to 225 (returns on line 224). The panel closes on Esc only while focus is in the panel or on the button (`onPanelKey`, `onButtonKey`), or when a link is clicked. Tab from the last item ("טיקטוק") leaves it open.
- Measured (390×844, snap2): after "טיקטוק", Tab moves to "בחרו סניף", "מה יש היום" and the first lid while `aria-expanded="true"`. Each of them is under the open panel: `elementFromPoint` returns the menu (`evidence/menu-covers-focus.png`). Esc pressed there does nothing, because the menu handler does not see it and the overlay handler returns early while `.menu-open` exists. The user has to find the way back with Shift+Tab.
- Fix, in `shell.js` inside `Shell.menu`:
  ```js
  function onFocusOut(e) {
    if (!isOpen()) return;
    var next = e.relatedTarget;
    if (next && (panel.contains(next) || button.contains(next))) return;
    setOpen(false, false);
  }
  // add to the cleanups array:
  listen(panel, 'focusout', onFocusOut), listen(button, 'focusout', onFocusOut)
  ```
  Also listen for Esc on `root` instead of `panel`, so it closes the open menu from anywhere.
- Verified: after Tab past "טיקטוק", `aria-expanded` is `"false"`, the panel is hidden and "בחרו סניף" is in view.

**A11Y-04 · "לעסקים ולרשתות" fails contrast in both modes** · 1.4.3 Contrast (Minimum) (AA)
- Where: `b.css` line 283, `.pb .b2b-copy .hand { …; color: var(--caramel); }`. The comment on the token itself (line 64) says caramel is for "graphics only, never small text". The band background is `var(--btn)`: dark brown in light mode, cream in dark mode.
- Measured: light, `#B0702A` on `#2A1D14` = **4.05:1**; dark, `#D99A52` on `#F7F1E6` = **2.15:1**. The text is 18px at weight 600, so it needs 4.5:1. axe reports it in 7 of 8 configurations, and the pixel check confirms all 8.
- Fix (`b.css` tokens): add `--on-btn-accent: #E6AE6C;` to `.pb` and `--on-btn-accent: #7A4520;` to `.pb[data-mode="dark"]`. Then set line 283 to `color: var(--on-btn-accent);`.
- Verified: 8.28:1 light, 6.92:1 dark.

**A11Y-05 · Desktop hero subtitle over the photo** · 1.4.3 (AA)
- Where: `.hero .sub` (`b.css` line 199, `color: var(--ink2)`) sits on the AI photo at container width ≥ 1000px.
- Measured (pixels, 1440):

  | text | dark (snap2 and live) | light, motion off | light, motion on |
  |---|---|---|---|
  | `.sub` line 1 `#CDBBA3` / `#5F4E3B` | **3.39:1** (min 3.28), needs 4.5 | 4.79:1 (min 3.74) | 4.78:1 |
  | `.sub` line 2 | 5.21:1 | 4.52:1 (min 4.29) | **4.43:1** (min 4.20) |
  | `h1 em` (large) | 3.90:1 | 4.36:1 (min **2.57**) | n/a |
  | `.note-hand` (large at 28px) | 4.30:1 | 4.82:1 | 4.96:1 |
  | `h1` (large) | 4.10 to 4.46:1 | 8.9 to 11.6:1 | n/a |

  snap1, before the hero module added its evening dim layer, was worse in dark: `.sub` 2.31:1, `h1 em` 2.16:1, `.note-hand` 2.19:1. The hero module's dim layer (`.pb .hero .sc-back::after`, `b-motion-hero.css` section 1) lifted dark mode a long way, but it is centred on the lamp, not on the text.
- Fix: a scrim behind the text column only, at ≥1000px, above the scene planes. It belongs in `b-motion-hero.css` section 1, because the hero module owns the scene layers:
  ```css
  @container (min-width: 1000px) {
    .pb .hero .scene::after { content: ""; position: absolute; inset: 0; pointer-events: none;
      background: linear-gradient(to left, rgba(247,241,230,.55) 0%, rgba(247,241,230,.4) 38%, rgba(247,241,230,0) 60%); }
    .pb[data-mode="dark"] .hero .scene::after {
      background: linear-gradient(to left, rgba(23,16,11,.72) 0%, rgba(23,16,11,.6) 38%, rgba(23,16,11,0) 62%); }
  }
  ```
  In RTL, `to left` starts at the text side. The bag stands at 27% from the left, outside the gradient.
- Verified (snap2, every state at 1440): no failing text line. Dark: `.sub` 6.83 and 8.38:1, `h1 em` 7.24:1, `.note-hand` 7.43:1, `h1` 7.9 to 9.4:1. Light: `.sub` 5.81 and 5.66:1, `h1 em` 5.53:1. Before and after: `evidence/hero-dark-before-after.png`.
- The real photo that will replace the AI render has to be re-measured. The scrim gives margin, but it is not a guarantee.

**A11Y-06 · The focus ring colour is under 3:1 on several backgrounds** · 1.4.11 Non-text Contrast (AA) **(2.1)**; it also weakens 2.4.7
- Where: `b.css` line 120 uses `var(--caramel)` for every focus ring on every background.
- Measured from screenshots (snap2; the ring against the pixels next to it, 10th percentile):

  | control | light | dark |
  |---|---|---|
  | hero "בחרו סניף", desktop (ring merges with the caramel hard shadow) | 2.21:1 | passes |
  | hero "מה יש היום", desktop | 2.78:1 | passes |
  | both hero buttons on the kraft mobile hero | 2.62:1 | passes |
  | feed polaroids `.pola` on kraft | 2.23 to 2.45:1 | passes |
  | "לכל הפוסטים באינסטגרם" on kraft | 2.52:1 | passes |
  | ticker pause `.tk-pause` on the cream ticker | passes | 2.15:1 |
  | "קו ההזמנות" in the cream business band | passes | 2.15:1 |

  On solid tokens: caramel `#B0702A` on kraft `#EADBC2` is 2.97:1, and `#D99A52` on cream `#F7F1E6` is 2.15:1. On snap1 the dark desktop hero buttons also failed (1.84:1); the new dim layer fixed those. `evidence/pola-focus-ring-before.png` shows the polaroid case.
- Fix (`b.css`): a focus token that follows the surroundings, plus inset rings where an edge clips:
  ```css
  .pb { --focus: var(--head); }                         /* #4A1D0B light, #F6E3C4 dark */
  .pb .ticker, .pb .b2b-band, .pb .bar { --focus: var(--on-btn); }
  .pb[data-mode="dark"] .bar { --focus: var(--head); }  /* in dark mode the bar is paper, not cream */
  .pb :focus-visible { outline: 3px solid var(--focus); outline-offset: 3px; }   /* line 120, without border-radius */
  .pb .lid:focus-visible, .pb .tk-pause:focus-visible, .pb .bar a:focus-visible { outline-offset: -6px; }
  ```
  Drop `border-radius: 6px` from line 120. It changes the element's own shape on focus (the square lid grows rounded corners), and outlines already follow each element's radius.
- Verified (snap2, all 8 configurations): every ring at 7.86:1 or more at the 10th percentile (lowest pixel 7.05:1, on a polaroid). `.tk-pause` and the `.bar` links are now 100% visible; before, half of the `.tk-pause` ring was cut by the viewport edge and the bottom of the bar-link rings was cut too.

**A11Y-07 · Ambient motion that never stops, with no control** · 2.2.2 Pause, Stop, Hide (A)
- Measured (snap2 and live, 4 s after load, nothing touched; `motion2.json`):
  - wheat sway on `.sc-wheat`: the 8 s cycle loops `infinite` (keyframes `b-hero-sway`, renamed `b-hero-sway-l`/`-r` on the live files, `b-motion-hero.css` section 3);
  - flour dust, the `.b-motes` canvas: redrawn continuously while the hero is on screen (`b-motion-hero.js`, the `tick` loop sets `busy = true` whenever motes exist). It changed 0.03 to 0.15% of the hero's pixels in 1.5 s;
  - the "בקרוב" dot `.soon i`: `b-micro-blink` 2.4 s, `infinite` (`b-motion-micro.css` line 38);
  - the ticker `b-scroll-tick`, 38 s, `infinite`, **has** a pause button. Paused, it stays paused through scrolling (checked), and it also pauses while its button has keyboard focus.

  2.2.2 asks for a way to pause, stop or hide anything that moves or blinks on its own for more than 5 s alongside other content. The ticker button pauses only the ticker.
- Fix, pick one:
  - (a) Make the ticker button the page's single motion control. In `b.js` `ticker()`, also run `root.classList.toggle('still', paused)`. Add `.pb.still .sc-wheat, .pb.still .soon i { animation-play-state: paused; }` to the owning motion files. In `b-motion-hero.js`, skip `stepMotes` while `root.classList.contains('still')`. Relabel the button "עצירת התנועה בעמוד" / "הפעלת התנועה בעמוד".
  - (b) Let each loop end on its own within 5 s. `.soon i`: `animation-iteration-count: 2` (4.8 s). Wheat sway: `1` (all its movement is in the first 46% of the cycle, so it is still from about 5.1 s; trim the delay to land under 5 s). Fade the dust out after 5 s.
- Reduced motion is already correct: 0 animations, no canvas, no injected layers, no `.sx` classes (`rm-anims-*`, `rm-injected-*`).

### Medium

**A11Y-08 · Closed box details are read by screen readers** · 1.3.1 Info and Relationships; 4.1.2 Name, Role, Value
- Where: `b.css` lines 235 and 236 hide closed details with `grid-template-rows: 0fr` plus `overflow: hidden`. That hides them on screen but not in the accessibility tree.
- Measured: with every lid at `aria-expanded="false"`, the AX tree still holds every box's text, for example "פרנה ומיני פרנה, עם כתמי התנור מבחוץ…". A screen-reader user hears "collapsed" and then the content anyway.
- Fix (`b.css`, after line 237): `.pb .box:not(.open) .det > div { visibility: hidden; }`. To keep the close animation visible, in `b-motion-micro.css` (next to `.pb .det { transition: … }`) add `.pb .det > div { transition: visibility 0s .35s; } .pb .box.open .det > div { transition-delay: 0s; }`.
- Verified: closed-box text is gone from the AX tree; opening a box exposes it again.

**A11Y-09 · "@haofe_bakery" is displayed as "haofe_bakery@"** · 1.3.2 Meaningful Sequence (A)
- Where: `b.html` line 331, `<p class="hand">@haofe_bakery</p>` (the feed eyebrow, inside the overlay). Also `b.html` line 130 (the type card) and 7 places in `index.html` (section 8).
- Measured: in an RTL paragraph the `@` takes the paragraph's direction and is drawn to the right of the Latin name (`evidence/handle-bidi.png`). Screen readers read the right order. Sighted users see the wrong handle, and people type it into Instagram.
- Fix: `<p class="hand"><bdi dir="ltr">@haofe_bakery</bdi></p>`. Do the same for every handle, including the TikTok `@haofe_bakery1`.

**A11Y-10 · No skip link and no `main` landmark in the site itself** · 2.4.1 Bypass Blocks (A)
- Where: the `b.html` template, lines 179 to 420. It has a banner, named regions and a contentinfo, but no `main`. A keyboard user passes 8 stops before the first content control on desktop (logo, 5 nav links, theme, phone) and 3 on mobile.
- Fix: make the first child of `.proto` `<a class="skip" href="#" data-jump="top">דילוג לתוכן</a>` (on the real site, `href="#main"`), visible on focus. Wrap the sections from `.hero` to `.visit` in `<main data-id="main">`. The existing `data-jump` behaviour moves focus to the target.

**A11Y-11 · Overlay: Shift+Tab reaches an invisible skip link behind it** · 2.4.3 Focus Order; 2.4.7 (presentation shell)
- Where: `shell.js` line 382, `setPageBehindInert()`, makes only `#main` and `.topbar` inert. The `<a class="skip">` on `b.html` line 18 stays focusable. When it has focus it shows at `top: 12px; z-index: 50`, under the overlay (`z-index: 100`).
- Measured: from "סגירה (Esc)", Shift+Tab lands on "דילוג לתוכן", and the element on top at its centre is the overlay's title. Focus is invisible and has left the dialog.
- Fix: `document.querySelectorAll('body > :not(.fs):not(script):not(template)').forEach(function (el) { el.inert = inert; });`.
- Verified: Shift+Tab from the close button no longer lands on anything on the page behind.

**A11Y-12 · Text spacing at 320px pushes two blocks off screen** · 1.4.12 Text Spacing (AA) **(2.1)**, at risk
- Measured: with the 1.4.12 spacing at 320px, the business band and the Kiryat Gat label grow to 348px, and their start edge (28px) is cut off by `.vp { overflow-x: hidden }`. The cause is `b.css` line 256, `white-space: nowrap` on whole `a[href^="tel:"]` and `p[dir="ltr"]` elements, for example "קו ההזמנות 1700-55-22-55" and "1700-55-22-55 איזה מספר להציג?". The same spacing passes at 390 and 1440, which is where 1.4.12 is normally tested.
- Fix: keep only the number unbreakable with `.pb a[href^="tel:"] { white-space: normal; } .pb bdi[dir="ltr"] { white-space: nowrap; }`. Mark up mixed lines as `<p><bdi dir="ltr">08-6491122</bdi> <span class="tbd">לאישור</span></p>` instead of `p[dir="ltr"]`.

**A11Y-13 · The accessibility statement is a placeholder** · regulation 35ה (legal, not a WCAG criterion)
- Where: `b.html` line 410, `<a href="#" data-jump="top">הצהרת נגישות <span class="tbd">תיכתב אחרי הבדיקה</span></a>`.
- Under regulation 35ה (as summarised in `research.json`), the site and any app must show a statement in a prominent place. It must list the adjustments made, the accessibility coordinator's details if one is required, and contact details for reporting problems. Exemptions: an עוסק פטור, or average annual turnover up to NIS 100,000 (35ו(ז)). Whether the business is exempt or needs a coordinator is **missing**; it is an open lawyer question in `research.json`.
- Fix: a real page (for example `/accessibility`) linked from the footer and the menu, written after these fixes land, with a working contact channel (phone and email).

**A11Y-14 · `.vp` scroll areas have `aria-label` but no role** · 4.1.2; axe `aria-prohibited-attr` (presentation shell)
- Where: `shell.js` line 379 (`OVERLAY_HTML`) and `b.html` lines 62, 69 and 73.
- Fix: add `role="region"` to each `.vp`.

**A11Y-15 · Links that open a new window do not say so** · advisory (technique G201; 3.2.5 is AAA)
- snap2 already added "(נפתח בחלון חדש)" to the three branch "ניווט" links and the live order link. These still lack it: the three `.pola` links (`b.html` lines 333, 336 and 339), "לכל הפוסטים באינסטגרם" (343), Instagram and TikTok in the menu (208, 209) and in the footer (407, 408), and ניווט and Instagram in the bar (lines 415 and 417).
- Fix: append `<span class="sr-only"> (נפתח בחלון חדש)</span>`, after adding a `.pb .sr-only` visually-hidden utility to `b.css`.

### Low

**A11Y-16 · Polaroid links have long names, and all three go to the profile** · 2.4.4 Link Purpose (In Context) passes; advisory
- The first card's name reads "צילום זמני: פרנה הפרנה המושלמת שלנו, יש דברים שפשוט כיף שיש קרוב לבית פוסט · 15.10.2026". The caption promises a post, but the `href` is the profile.
- Fix: link each card to its own post. The post URLs are **missing**: the owner has to supply them; do not guess. Then name each card like `aria-label="פוסט באינסטגרם מ־15.10.2026: הפרנה המושלמת שלנו… (נפתח בחלון חדש)"`.

**A11Y-17 · The lid label stays "פתחו" when the box is open** · advisory (cognitive)
- `aria-expanded` gives screen readers the state, but on screen an open box still says "open". Fix (`b.js` `boxes()`): switch the `.open` label to "סגרו" while the box is open.

**A11Y-18 · Sticky bars fill most of the screen when zoomed** · 1.4.10 Reflow (AA) **(2.1)**, at risk
- At 1440×900 zoomed to 400% (360×225), the header (63px) and the bar (65px) take 57% of the height. Content still reflows, with no horizontal scrolling at 320, 360 or 720, so 1.4.10 passes, but reading is hard. Fix: the `max-height` media query in A11Y-02.

**A11Y-19 · The ticker speeds up while the page scrolls** · 2.3.3 Animation from Interactions (AAA) **(2.1)**
- snap2: the ticker's playback rate rises to 3.68× while scrolling (`ticker-rate-while-scrolling-1440`). It stays paused if the visitor paused it (checked), and it does not move under reduced motion. Not an AA failure. Consider capping the surge at 1.5×.

**A11Y-20 · Scroll-linked depth, pointer lean and the "leap"** · 2.3.3 (AAA) **(2.1)**
- snap2 runs:
  - scroll-timeline animations on every hero plane and on the hero text;
  - view-timeline drift on 12 product layers;
  - a pointer lean on fine pointers;
  - flying copies of three products from the bag into the boxes.
- All of it is skipped under `prefers-reduced-motion` (0 animations measured), which is all AA asks. Many people with vestibular disorders never set the OS option, so a visible "הפחתת תנועה" switch in the footer that adds `.rm` would go beyond the standard.

**A11Y-21 · The hero's "הדמיית AI" note is read before the headline** · 1.3.2, advisory
- `b.html` line 227: `.ai-note` comes before `.in` in the source, so the hero region starts with "הדמיית AI · לא צולם בהאופה". Keeping the label visible is right, and the brief requires it. Fix: move it after `.hero-text` in the source. It is absolutely positioned, so nothing moves on screen.

**A11Y-22 · Production checklist items the prototype cannot show**
- Real anchors with ids (`href="#boxes"`) instead of `href="#"` plus `data-jump`. Without JS, every nav link goes to the top today.
- `<title>` per page and `lang="he" dir="rtl"` on `<html>`. `b.html` already has them; keep them.
- Remember the visitor's motion pause. localStorage is enough, since it is a per-visitor convenience.
- The ordering app (haofeapp.com/order, not launched) is a separate service under regulation 35א. Its forms, errors and time picker need their own audit before launch.

**A11Y-23 · The feed eyebrow is on the contrast edge** · 1.4.3, at risk
- `@haofe_bakery` (`#7A4520`, 18px/600) on the kraft feed: 4.58:1 at the 5th percentile, minimum 4.26:1. It passes only because the wheat texture (`.pb .paper`, `opacity='.16'`) is faint. If the texture gets stronger, it fails.

---

## 4. Verified fix pack

These were all injected together into the running prototype (`fix-pack.css` plus the two JS patches in A11Y-03 and A11Y-11) and re-measured on snap2. Nothing in `concepts/` was edited. `fix-pack.css` names the target file for each block.

| measurement (snap2) | before | after |
|---|---|---|
| lid focus ring visible | 0% (all 8 configs) | 100% |
| lowest focus-ring contrast, any control, any config (10th percentile) | 2.14:1 | 7.86:1 |
| "לעסקים ולרשתות" | 4.05:1 light / 2.15:1 dark | 8.28:1 / 6.92:1 |
| dark desktop hero `.sub` | 3.39:1 | 6.83:1 |
| light desktop hero `.sub` (motion on) | 4.43:1 | 5.66:1 |
| failing text elements at 1440, all states | 2 (`.b2b-copy .hand`, hero `.sub`) | 0 |
| fully hidden focus stops at 390×844 / 360×225 (forward + backward) / 320×256 / 720×450 | 3 / 2 + 4 / 2 / 1 | 0 / 0 / 0 / 0 |
| focus under the open mobile menu | 3 stops | 0 (the menu closes) |
| closed-box text in the AX tree | 6 boxes | 0 |
| Shift+Tab from the overlay close button | invisible skip link | stays out of the page behind |

The motion fix (A11Y-07) and the markup fixes (A11Y-09, -10, -15, -17, -21) were not injected; they are straightforward edits.

---

## 5. What passes (no need to re-test unless the markup changes)

- **axe-core**: in the overlay, the only violation is A11Y-04 (contrast). No ARIA, name, list, heading-order, landmark or image-alt violations in any of the 8 configurations. The "incomplete" contrast items (51 to 65 per configuration: photo and gradient backgrounds, sticky overlap) were all settled by the pixel check. Apart from A11Y-04, A11Y-05 and A11Y-23, every text line passes at the 5th percentile in every state, including all boxes open, order "live" and the mobile menu.
- **Headings**: one `h1` ("הטעם שתמיד כיף לחזור אליו"), then an `h2` per section and an `h3` per box and per branch, with no skipped level. On snap2 the hero module splits the `h1` into word masks and sets an `aria-label` with the full text, so it is still read as one heading.
- **Names and roles**: every button and link has a name. Theme is "מצב כהה" with `aria-pressed` (and keeps focus when pressed). Menu is "תפריט" with `aria-expanded` and `aria-controls`. Ticker switches between "עצירת הסרט הנע" and "הפעלת הסרט הנע". Every `aria-label` contains the visible text (2.5.3 Label in Name), including the new "ניווט לסניף נתיבות (נפתח בחלון חדש)", "חיוג לסניף נתיבות" and "הזמנה בטלפון, 1700-55-22-55".
- **Images**: product images have Hebrew alt text ending "הדמיית AI". The hero scene, the dust canvas and the flying copies are `aria-hidden`. Logo images are `alt=""` inside a named link. Placeholders are `role="img"` with "צילום זמני: …".
- **Keyboard**: every control is reachable and works with Enter and Space (lids, theme, ticker, menu). The focus order follows the RTL reading order: 34 stops in the prototype on desktop and 32 on mobile (section 6). The 5 jump links move focus to their section, the heading clears the header, and the next Tab goes to that section's first control. Esc inside the menu closes it and returns focus to "תפריט"; Esc closes the overlay and returns focus to "מסך מלא". On snap2, content still waiting for its entrance animation finishes at once when focus reaches it (`focusin` in `b-motion-scroll.js`).
- **Target size (2.5.8)**: the only targets under 24×24 are five footer links (22.4px tall) and the inline phone number in the order module. All of them pass on spacing or as inline text. Header buttons are 44px, lids 64px, bar links 56px or more, menu links 54px.
- **Reflow (1.4.10)**: no horizontal scrolling and no clipped text at 320, 360 or 720 CSS px.
- **Text spacing (1.4.12)**: nothing lost at 390 or 1440 (320: A11Y-12).
- **Reduced motion**: both `prefers-reduced-motion` and the page's "הדמיית הפחתת תנועה" give `.rm`, with 0 running animations. The ticker becomes a static wrapping list without its copies or pause button. Jump links scroll instantly, and the snap2 modules inject nothing.
- **The opening** ends in about 1.4 s, under 5 s. Nothing flashes (2.3.1).
- **Forced colours**: text, buttons, borders and the `currentColor` SVG icons stay visible; only decorative dots vanish. The lid focus ring is still clipped there (A11Y-01).
- **Language and direction**: `<html lang="he" dir="rtl">` on `b.html`. Phone numbers and opening hours are isolated as LTR (`<bdi dir="ltr">`), so "1700-55-22-55" and "05:00–22:00" display correctly. Only the `@` handle is wrong (A11Y-09). "AI" in "הדמיית AI" is a common term and needs no `lang`.
- **Non-text contrast of controls**: button borders 16:1. Bar icons 4.05:1 light and 7.2:1 dark. The theme button's faint border does not matter, because its icon (16:1) identifies it.

---

## 6. Keyboard path (snap2, 1440×900, light, motion on)

"ring visible" under 100% on round or pill-shaped controls (nav pills, theme) is a measurement artefact: the sampler walks a rectangle around a rounded outline. The screenshots show those rings whole.

| # | element | name | covered | ring visible | ring contrast |
|---|---|---|---|---|---|
| 1 | `a.mark` | האופה, בוטיק לחם. לראש העמוד | no | 100% | 3.95:1 |
| 2–6 | nav `a` | מה יש בקופסה · הזמנה אונליין בקרוב · מהפיד · לעסקים · סניפים | no | pill | 3.95:1 |
| 7 | `button.theme-btn` | מצב כהה (pressed=false) | no | round | 3.95:1 |
| 8 | `a.order` | הזמנה טלפונית, 1700-55-22-55 | no | 73% | 3.95:1 |
| 9 | `a.btn-b--main` | בחרו סניף | no | 93% | **2.21:1** |
| 10 | `a.btn-b` | מה יש היום | no | 96% | **2.78:1** |
| 11 | `button.tk-pause` | עצירת הסרט הנע | no | **50%** (viewport edge) | 3.59:1 |
| 12–17 | `button.lid` ×6 | פרנה ומיני פרנה לשישי פתחו … סופגניות בעונה פתחו (expanded=false) | no | **0%** | n/a |
| 18 | `a` | 1700-55-22-55 (order module) | no | 100% | 3.95:1 |
| 19–21 | `a.pola` ×3 | צילום זמני: … (opens a new window) | no | 100% | **2.23:1** |
| 22 | `a.btn-b` | לכל הפוסטים באינסטגרם | no | 96% | **2.52:1** |
| 23 | `a.btn-b` | קו ההזמנות 1700-55-22-55 | no | 96% | 4.05:1 |
| 24–29 | branch `a` ×6 | ניווט/חיוג לסניף נתיבות, שדרות, קריית גת | no | 88–95% | 3.95:1 |
| 30–34 | footer `a` ×5 | אינסטגרם · טיקטוק · הזמנות · הצהרת נגישות · מדיניות פרטיות | no | 100% | 3.59:1 |

At 390×844 the order is logo, theme, menu, hero buttons, ticker pause, lids, … , footer, then the 3 bar links. The 2nd, 4th and 6th lids are fully covered by the bar, and the Sderot branch links are 3/5 covered (A11Y-02).

---

## 7. Token contrast

Computed from the hex values in `b.css` section 1 on solid backgrounds. Photo and texture backgrounds were measured from pixels (section 3).

| pair | light | dark |
|---|---|---|
| body text `--ink` on `--bg` | 15.41 | 16.75 |
| secondary `--ink2` on `--bg` | 7.08 | 10.07 |
| nav links on the header | 16.80 | 15.51 |
| `.chip-soon` 11px `--stamp` on the header | 7.55 | 8.83 |
| buttons `--on-btn` on `--btn` | 14.97 | 16.41 |
| mobile hero `.sub` on kraft | 5.84 | 8.67 |
| `.note-hand` 22px/600 on kraft (mobile) | 5.71 | 8.21 |
| `.sec-head .hand` on kraft (feed) | 5.71 (pixels: 4.58, A11Y-23) | 8.21 |
| "פתחו" 15px/600 on the lid | 6.44 | 7.90 |
| `.tag` on `--stamp` | 7.49 | 9.51 |
| `.pola small` 13px | 7.77 | 9.30 |
| `.b2b-copy p` at opacity .86 | 11.37 | 11.29 |
| **`.b2b-copy .hand`** | **4.05** | **2.15** |
| focus ring caramel on `--bg` | 3.59 | 7.80 |
| **focus ring caramel on kraft** | **2.97** | 6.71 |
| **focus ring caramel on the `--btn` band** | 4.05 | **2.15** |
| proposed `--focus` on kraft / lid / band | 10.47 / 11.82 / 14.97 | 12.90 / 12.40 / 16.41 |

---

## 8. index.html

| ID | severity | criterion | finding | fix |
|---|---|---|---|---|
| IDX-01 | medium, depends on the publish skeleton | 3.1.1 Language of Page (A); 1.4.10 | The file has no `<html>`, so the document has no `lang`/`dir`, and there is no `<meta charset>` or `<meta name="viewport">`. This is by design (`index.css`: "a skeleton is added at publish time"). Opened directly, or served without a charset header, the Hebrew turns into mojibake (seen with a plain local server). axe reports `html-has-lang`, and phones render the page at desktop width. | Check the published URL: its skeleton must provide `<html lang="he" dir="rtl">`, `<meta charset="utf-8">` and a viewport meta. If it does not, put `<meta charset="utf-8">` and `<meta name="viewport" content="width=device-width,initial-scale=1">` as the first two lines of `index.html`. |
| IDX-02 | medium | 2.1.1 Keyboard (A) | At 390px the four wide tables (`.tbl-wrap` in `#facts`, `#branches`, `#feed`, `#compare`) scroll sideways. Browsers without keyboard-focusable scrollers give a keyboard user no way to reach the hidden columns (axe `scrollable-region-focusable`, 4 nodes). | `<div class="tbl-wrap" tabindex="0" role="region" aria-labelledby="facts-h">`, each with its own section heading id. |
| IDX-03 | low | 1.3.1 | The first `<th>` of the `#compare` table is empty (axe `empty-table-header`). | `<td></td>`, or `<th scope="col">היבט</th>`. |
| IDX-04 | low | 1.3.2 | `@haofe_bakery` shows as `haofe_bakery@` in 7 places (summary card, verify list, sources list, TikTok links). | `<bdi dir="ltr">@haofe_bakery</bdi>`. |
| IDX-05 | low | 1.3.2, consistency | The opening hours in the branches table ("05:00–22:00") are not isolated, so they display as "22:00–05:00", unlike the prototype. | `<bdi dir="ltr">05:00–22:00</bdi>`. |
| IDX-06 | low | 2.4.1 | The skip link's target `<main id="main">` has no `tabindex`, so `document.activeElement` stays on `body` after activation (Chrome still starts the next Tab inside main). | `<main id="main" tabindex="-1">`. |
| IDX-07 | low | 1.3.1 | The tables have no `<caption>`; only the section heading around each one labels it. | `<caption class="sr-only">…</caption>`, or `aria-labelledby` on each `<table>`. |

Passes on index.html:
- one `h1` and an ordered `h2`/`h3` outline;
- skip link visible on focus;
- sticky top bar with 40px targets;
- focus ring `#23408C` 8.8:1 (light) and `#A8BCFF` 10.0:1 (dark);
- pill colours 5.9 to 7.4:1 on white and 8.3 to 10.1:1 on dark;
- every target passes 2.5.8, on spacing or as inline text;
- the direction-card previews are `aria-hidden`.

---

## 9. Changes between snap1 and snap2 that affect accessibility

- **Better**:
  - the evening dim layer (`.pb .hero .sc-back::after`) lifted the dark hero from 2.31:1 to 3.39:1 for `.sub` and made the dark hero focus rings pass;
  - the branch links gained descriptive `aria-label`s;
  - entrances finish at once when focus arrives;
  - the ticker pauses while its button has focus.
- **New risk**:
  - the infinite wheat sway and flour dust (A11Y-07);
  - the ticker surge while scrolling (A11Y-19);
  - scroll-linked depth and the leaping products (A11Y-20).
  - All of it is correctly switched off under reduced motion.
- **Unchanged**: everything else in section 3. The axe results are identical on both snapshots.

---

## 10. Open questions and missing facts

- **Missing**: which WCAG version the 2023 edition of ת"י 5568 is based on. The Standards Institution page does not say (`research.json`). Until it is known, treat the 2.1/2.2 items (A11Y-02, -03, -06, -12, -18) as required: they are cheap, and a later audit may apply them.
- **Missing**: whether the business is exempt from regulation 35 (עוסק פטור, or turnover up to NIS 100,000) and whether it must name an accessibility coordinator. This is an open lawyer question in `research.json`.
- **Missing**: the post URLs for the three feed cards (A11Y-16). The owner has to supply them.
- **Not done**: screen-reader and real-device testing (section 2).
- The motion files were still changing at 02:48. Re-run `motion2.js` and `contrast-collect.js` once the motion agents have finished.

---

## How to reproduce

All scripts are in the scratch folder `…/scratchpad/agents4/a11y/`. Serve the concepts folder over HTTP with a UTF-8 charset (`python3 -I serve.py <concepts folder> 8734`), then:

```
A11Y_PORT=8734 A11Y_OUT=out2 node axe-run.js
A11Y_PORT=8734 A11Y_OUT=out2 node keyboard.js && python3 -I ring.py out2
A11Y_PORT=8734 A11Y_OUT=out2 node contrast-collect.js && python3 -I contrast-analyze.py out2
A11Y_PORT=8734 A11Y_OUT=out2 node tree.js   # likewise targets.js reflow.js zoomkb.js behaviors.js motion2.js bidi.js index-audit.js
A11Y_FIX=2 A11Y_PORT=8734 A11Y_OUT=out2-fix node keyboard.js   # any script, with the fix pack injected
```
