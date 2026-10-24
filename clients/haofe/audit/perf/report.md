# Performance audit · Direction B "השקית"

Role: performance engineer. Scope: direction B as the full-screen overlay (`[data-full]` in `b.html`), its images and its fonts.
Measured 2026-10-24T02:25:37Z on a frozen copy of `concepts/` (sha1 list at the end), Chromium 153.0.8010.12 via Playwright + CDP, cold cache on every run.
Everything below is measured or computed from files. Where data is missing it says MISSING.

In this folder: `report.md` (this file), `recommended-markup.html` (copy-paste markup for every image slot, the font links and the CSS), `metrics.json` (every aggregated number), `playpen-calt-compare.png`, `wheat-aspect.png`, `tools/` (the scripts behind every number; `tools/README.txt`).
Image variants: `concepts/assets/ai/r/` (46 image files + `manifest.json`). Font subsets were built in scratch only; `tools/fonts.py` and `tools/fonts2.py` rebuild them.

## 1. Method

- **"Site" load** = `b.html` rewritten at request time by `tools/harness.js`: presentation chrome removed, overlay opened at `DOMContentLoaded`, `.fs-bar` hidden, so the viewport holds exactly one mount of `<template id="proto">` (frame `full`). Files in `concepts/` were never modified.
- **Desktop** 1280x820 @1x, 40 ms RTT, 10 Mbit/s, no CPU throttle. **Mobile** 390x780 @3x, Lighthouse "Slow 4G" DevTools values (562.5 ms latency, 1.47 Mbit/s) + 4x CPU. 3 runs per variant (medians; every run in `metrics.json`). Extra single runs: 1440x900 @2x, brotli server, presentation page.
- Bytes = CDP `Network.loadingFinished.encodedDataLength`. LCP/CLS/long tasks/long animation frames = PerformanceObserver. Decoded vs displayed = drawn box x DPR vs the file's real pixel size (manifest values for srcset images, because `naturalWidth` is density-corrected there).
- The local server sends no compression; `br` rows come from the same files on a brotli-11 server, i.e. what a production host sends for HTML/CSS/JS/SVG.
- Google Fonts are fetched live through this sandbox's egress proxy: byte counts are exact, timings are not Israeli-user timings.
- **Prototype caveat:** the page content is inside `<template>` and cloned by `shell.js` at `DOMContentLoaded`, so the preload scanner cannot see any image and every image request starts after DCL. The static production site will not have this delay. The option A/B harnesses add a `<link rel=preload>` for the hero wall to compensate.

## 2. Results at a glance

| variant | what | desktop LCP | mobile LCP | desktop bytes | mobile bytes | brotli desktop / mobile | fonts | CLS d / m | TBT d / m |
|---|---|---|---|---|---|---|---|---|---|
| **today** | b.html as it is (overlay only) | 1648 ms | 5672 ms | 1597.3 KB | 1597.3 KB | 1395.0 KB / 1395.0 KB | 360.5 KB, 8 files | 0.008 / 0.026 | 134 ms / 212 ms |
| **images only** | new `<picture>` markup + `r/` variants, old font link | 1136 ms | 3664 ms | 881.5 KB (-45%) | 1079.0 KB (-32%) | – / – | 360.5 KB, 8 files | 0.007 / 0.027 | 153 ms / 111 ms |
| **option A** | images + LQIP + trimmed Google Fonts link + hero preload | 964 ms | 3920 ms | 841.6 KB (-47%) | 1039.1 KB (-35%) | 652.4 KB / 849.9 KB | 317.8 KB, 6 files | 0.008 / 0.026 | 214 ms / 278 ms |
| **option B** | option A with self-hosted Hebrew subset fonts instead of Google | 664 ms | 2996 ms | 638.6 KB (-60%) | 836.1 KB (-48%) | – / – | 117.5 KB, 4 files | 0.000 / 0.000 | 0 ms / 0 ms |
| **all** | option B + the plate-fade fix (P2) | 520 ms | 3080 ms | 638.7 KB (-60%) | 836.2 KB (-48%) | 448.4 KB / 645.9 KB | 117.5 KB, 4 files | 0.000 / 0.000 | 0 ms / 0 ms |
| **all, no font preload** | "all" without the two font preloads | 636 ms | 2828 ms | 638.5 KB (-60%) | 836.0 KB (-48%) | – / – | 117.5 KB, 4 files | 0.000 / 0.026 | 85 ms / 155 ms |

LCP element per variant (run 1): today: desktop img.sc-plate [plate.webp], mobile img.sc-plate [plate.webp]; images only: desktop img.sc-plate [plate-1920.avif], mobile img.sc-plate [plate-m-981.avif]; option A: desktop img.sc-wheat [wheat-800.avif], mobile img.sc-plate [plate-m-981.avif]; option B: desktop img.sc-wheat [wheat-800.avif], mobile section.hero.paper.b-hold "הדמיית AI · לא צולם בהאו…"; all: desktop img.sc-plate [plate-1920.avif], mobile img.sc-plate [plate-m-981.avif]; all, no font preload: desktop img.sc-plate [plate-1920.avif], mobile img.sc-plate [plate-m-981.avif].

Read with P2: while the plate still fades in, a fast-loading wall is painted at `opacity: 0` and is not reported, so in some runs (images only, option A) or every run (option B) the LCP entry falls on the wheat or the hero background. With the fade removed (`optnf`, `all` in section 8) the wall is the LCP element in every run (`allp0`: 2 of 3 on mobile, explained in section 7). The wheat rows use `sizes="842px"` (finding P4).

## 3. Findings, most important first

### P1 · Every image is served at one size (900-1920 px) to every screen; the 6 "lazy" product cutouts load at startup anyway
Severity: high.

**Evidence.** Today the overlay downloads 1061.4 KB of images (desktop and mobile alike). All six `.prod` images have `loading="lazy"` but sit within Chrome's lazy-load distance (the box grid starts right under the hero), so they are fetched during the initial load in every run. Decoded vs displayed (section 5): products are 900 px files drawn at 306 px on desktop (ratio 2.9), `.sc-sticker` is a 512 px SVG drawn at 128 px, and on phones the 1920x1079 wall is decoded although only a 981x1079 slice of it is visible.

**Fix.** Use the `r/` variants with the `<picture>`/`srcset`/`sizes` markup of section 6 (sizes verified against the rendered layout at 14 widths). Measured: images 1061.4 KB → 341.3 KB on desktop, 1061.4 KB → 538.8 KB on mobile @3x. Phones get `plate-m`, an art-direction crop of exactly the visible slice.

### P2 · The hero opening hides the LCP image: `.sc-plate` fades in from `opacity: 0` and the fade is paused until all four scene images decode
Severity: high.

**Evidence.** `b-motion-hero.css:109` gives `.pb.anim .hero .sc-plate` the animation `b-hero-fade .32s` (`from { opacity: 0 }`), `b-motion-hero.css:200` pauses every scene animation while `.hero.b-hold` is set, and `b-motion-hero.js` keeps `.b-hold` until plate, bag, wheat and sticker have all decoded (or `HOLD_MAX = 900` ms). The wall is therefore invisible until the slowest of four images is ready. Measured, same markup and fonts with only the fade removed. Desktop, option A: 948 ms wheat, 964 ms wheat, 1268 ms wall (the wall is the LCP element in 1 of 3 runs); with the fix (`optnf`): 740 ms wall, 528 ms wall, 672 ms wall (3 of 3). Mobile, option A: 4044 ms wall, 3800 ms wall, 3920 ms wall; with the fix: 2924 ms wall, 2824 ms wall, 2832 ms wall. Option B with the fade: the wall is never reported (648 ms wheat, 664 ms wheat, 672 ms wheat / 3012 ms hero-bg, 2992 ms hero-bg, 2996 ms hero-bg); option B with the fix (`all`): 524 ms wall, 520 ms wall, 492 ms wall / 3128 ms wall, 3052 ms wall, 3080 ms wall. When the wall is painted at opacity 0 it is not an LCP candidate, so LCP lands on whatever paints visibly later; without the fade the wall paints in the first contentful frame (FCP = LCP). On mobile the hold usually runs to its timeout: with the fade, LCP ≈ DCL + 900 ms hold + 320 ms fade (option A: median DCL 2733 ms, LCP 3920 ms), because `bag-748.avif` (Low priority) is still downloading behind the font files when the page mounts. That is also why option A is not faster than images-only on mobile until P2 is fixed.

**Fix.** For the owner of the motion files (read-only for me): in `b-motion-hero.css:109` drop `b-hero-fade` from the plate: `.pb.anim .hero .sc-plate { transform-origin: 40% 62%; animation: b-hero-push 1.35s var(--ease-out) both; }`. In `b-motion-hero.js` let `.b-hold` wait for `.sc-bag-img` and `.sc-sticker` only. The wall shows as soon as it decodes; the bag still arrives with its animation.

### P3 · Fonts: 246.9 KB of the 317.8 KB of site fonts are the Latin subset files, pulled in by punctuation, digits and one handle
Severity: high.

**Evidence.** Google splits each family by script. For this Hebrew site the Latin files are the big ones: Playpen Sans Hebrew Latin 192.0 KB vs Hebrew 52.4 KB; Rubik Latin 35.3 KB vs Hebrew 9.9 KB; Secular One Latin 19.6 KB vs Hebrew 8.6 KB. The Latin files load because U+0000-00FF (digits, comma, colon, !, @) is only in the Latin unicode-range (table in section 7). Playpen's emoji chunk also claims `U+30-39`, so a digit inside any Playpen note would fetch an emoji font file.

**Fix.** Option B, section 7: self-host one file per face. Secular One and Playpen: Hebrew + digits + punctuation (their rare Latin letters fall through the b.css stacks to Rubik); Rubik: Hebrew + Basic Latin (body text and the fallback). 116.8 KB in 4 files instead of 317.8 KB in 6 (measured: 117.5 KB transferred), no third-party origin, no emoji chunk.

### P4 · The hero wheat is drawn squeezed 2.7x (desktop) / 6.3x (phones) because `.sc-wheat` has no CSS height
Severity: medium.

**Evidence.** `b.css:191` sets only `width: 34%` (`width: 24%` at ≥1000px, `b.css:330`) on `.sc-wheat`, so the `height="1000"` attribute in `b.html` applies: measured box 307x1000 css px at 1280 px and 133x1000 at 390 px, from an 842x1000 render (aspect 0.84 drawn at 0.31 / 0.13). The tall stalks in today's hero come from this (`wheat-aspect.png`: today vs `height: auto`). It also matters for `srcset`: the browser picks by width, so a 480 px file would be stretched to 1000 px of height and look softer than today.

**Fix.** Designer decision (open question). If the tall look is wanted: keep it, and keep `sizes="842px"` in the wheat markup (always the 800w file, 40.4 KB AVIF instead of 170.5 KB WebP); better still, export a wheat render that is tall by design so nothing is squeezed. If not: add `height: auto;` to `.pb .sc-wheat` in `b.css:191` and switch the wheat `sizes` to `(min-width: 1000px) 24vw, 34vw` (480w on most screens, 20.5 KB).

### P5 · The font link requests families and weights the site does not use, and misses one it does
Severity: medium.

**Evidence.** The link in `b.html:10` requests Heebo (5 weights) and IBM Plex Mono for the presentation page; in the overlay Heebo 400/600 still download (42.7 KB) because the presentation `.skip` link uses Heebo. Rubik is requested as 400;500;700 but b.css also asks for 600 (`font: 600 …` on `.chip-soon`, `.soon`, `.ai-tag`, `.ai-note`, `.phone-line` and more), which today renders as 700.

**Fix.** Option A (keep Google): `https://fonts.googleapis.com/css2?family=Rubik:wght@400..700&family=Secular+One&family=Playpen+Sans+Hebrew:wght@400;600&display=swap`. `Rubik:wght@400..700` returns one variable face covering 400/500/600/700 from the same two files. Side effect: `font-weight: 600` now renders as real 600, narrower than today's 700 (the mobile page became 27 px shorter in the visual check). Keep `display=swap` and both preconnects. Option B (P3) supersedes this.

### P6 · Logo SVGs: 114 KB raw, and the dark-mode copy downloads in light mode
Severity: medium.

**Evidence.** `haofe-logo-badge.svg` 58.2 KB (hero sticker and order slip), `haofe-logo-clean.svg` 28.0 KB (header, light), `haofe-logo-mono-cream.svg` 28.0 KB (header, dark; `display: none` in light mode but fetched anyway). Their paths are written with 2-decimal coordinates. svgo 3.3.2 with `tools/svgo.config.js` (precision 1, multipass, keeps `viewBox`, `<title>`, `role`, which svgo's default preset removed in a first try): `haofe-logo-badge.svg` 58.2 KB → 19.9 KB (brotli 17.5 KB → 7.3 KB), `haofe-logo-clean.svg` 28.0 KB → 10.7 KB (brotli 9.0 KB → 4.1 KB), `haofe-logo-mono-cream.svg` 28.0 KB → 10.7 KB (brotli 9.0 KB → 4.1 KB). Render check at 44, 128 and 512 px (@2x), original vs optimised: badge.svg 0.137% of pixels differ by >64, clean.svg 0.016% of pixels differ by >64, mono-cream.svg 0.05% of pixels differ by >64.

**Fix.** In `b.html`, `.mark-logo`: add `loading="lazy"` to `img.for-dark` (measured: then it is not requested in light mode). Optimise the three SVGs with the svgo command in section 9 (only after the designer checks them at sticker size) and serve them with brotli.

### P7 · Opening the overlay is one long task, mostly a forced layout of the whole page
Severity: medium.

**Evidence.** Desktop: 109 ms frame, the DOMContentLoaded handler 86 ms of which 77 ms forced style/layout. Mobile (4x CPU): 626 ms frame, handler 414 ms, forced layout 332 ms. Cause in the prototype: `shell.js` `openFullScreen()` calls `closeButton.focus()` right after `build()`, forcing style + layout of the freshly cloned page inside the click handler. The real site pays the same first layout, just not inside a script. Trace totals in section 8 (mobile: Layout up to ~290 ms per pass at 4x CPU, several passes as fonts arrive).

**Fix.** For the site: fewer font files means fewer re-layouts (option B loads 4 faces, 2 of them preloaded before first layout; CLS 0.0000 desktop / 0.0001 mobile, and the mobile trace shows Layout 564.7 ms → 278.5 ms in the first 3 s). Keep the ticker at 2 copies of its list instead of 4 if the scroll module can loop with 2 (`b.html`, `.tk-track`: 4 x 12 items are laid out today). Presentation only: in `shell.js` move `closeButton.focus()` into a `requestAnimationFrame` callback.

### P8 · Presentation page (b.html with three frames) shows CLS ~0.23 and ~1.3 s TBT
Severity: low.

**Evidence.** Measured: CLS 0.228, TBT 1338 ms, 21 long tasks (three mounts, each with its own forced layout in `fitFrame()`). The frames are mounted at full size and then scaled by `fitFrame()`, so the content below them moves. This is the presentation, not the site.

**Fix.** Optional, presentation only: give `.frame-box` its final aspect in `shell.css` (`aspect-ratio: 1280 / 820` desktop, `390 / 780` phones) so `fitFrame()` no longer moves the page.

### P9 · Render-blocking third-party CSS and 5 local stylesheets
Severity: low.

**Evidence.** Render-blocking in the overlay load: `https://fonts.googleapis.com/css2?…`, `shell.css`, `b.css`, `b-motion-micro.css`, `b-motion-scroll.css`, `b-motion-hero.css`, `b.js`.

**Fix.** Option B removes the fonts.googleapis.com stylesheet and both third-party origins. In production, concatenate `shell.css`-equivalent base, `b.css` and the three motion CSS files into one file (brotli: 23.7 KB for all CSS today, Google CSS included).

## 4. Measured load today (overlay), per resource type

| type | requests | desktop transferred | decoded | brotli server |
|---|---|---|---|---|
| Image | 12 | 1061.4 KB | 1059.3 KB | 982.9 KB |
| Font | 8 | 360.5 KB | 354.4 KB | 360.5 KB |
| Script | 5 | 81.0 KB | 80.0 KB | 23.2 KB |
| Stylesheet | 6 | 70.3 KB | 113.7 KB | 23.7 KB |
| Document | 1 | 24.1 KB | 24.0 KB | 4.7 KB |
| total | 32 | 1597.3 KB | | 1395.0 KB |

Mobile transfers the same files (no srcset today). Origins: 127.0.0.1:8765, fonts.googleapis.com, fonts.gstatic.com.

Largest requests (desktop, run 1):

| transferred | resource |
|---|---|
| 192.0 KB | `fonts.gstatic.com/s/playpensanshebrew/v8/lJwb-okuj29wT-AN6RvLx8QqjkKhL7eApI7VfQ.woff2` |
| 170.7 KB | `assets/ai/wheat.webp` |
| 132.5 KB | `assets/ai/challah.webp` |
| 109.2 KB | `assets/ai/baguette.webp` |
| 104.9 KB | `assets/ai/sufganiyot.webp` |
| 96.0 KB | `assets/ai/frena.webp` |
| 95.0 KB | `assets/ai/bag.webp` |
| 93.7 KB | `assets/ai/rugelach.webp` |
| 91.9 KB | `assets/ai/dairy.webp` |
| 58.4 KB | `assets/logo/haofe-logo-badge.svg` |
| 52.8 KB | `assets/ai/plate.webp` |
| 52.4 KB | `fonts.gstatic.com/s/playpensanshebrew/v8/lJwb-okuj29wT-AN6RvLx8QqjkKhL7eApIzVfUZX.woff2` |
| 35.3 KB | `fonts.gstatic.com/s/rubik/v31/iJWKBXyIfDnIV7nBrXw.woff2` |
| 30.2 KB | `fonts.gstatic.com/s/heebo/v28/NGS6v5_NC0k9P9H2TbE.woff2` |

CLS sources today (desktop run 1): 0.0034 at 532 ms (ul.tk-list "פרנהחלותצמה ירושלמיתבאגטג׳בטהפיתהבורקס ג"); 0.0085 at 726 ms (ul.tk-list "פרנהחלותצמה ירושלמיתבאגטג׳בטהפיתהבורקס ג", span.b-wi "שתמיד", p.ai-note "הדמיית AI · לא צולם בהאופה", a "לעסקים"); 0.0045 at 888 ms (ul.tk-list "פרנהחלותצמה ירושלמיתבאגטג׳בטהפיתהבורקס ג", span.b-wi "שתמיד"). Mobile: 0.0018 at 3618 ms; 0.001 at 3764 ms; 0.0236 at 4037 ms (::before, div.ctas "בחרו סניף מה יש היום", p.note-hand "תבחרו סניף ובואו לבקר!", a.btn-b "מה יש היום"). All are far below 0.1.

## 5. Decoded image size vs displayed size

`needed` = drawn width x DPR (for `object-fit: contain/cover` the fitted image, not the box). `ratio` > 1 means more pixels decoded than shown. `decoded` = width x height x 4 bytes of memory per image.

**full-desktop** (1280x820 @1x)

| slot | file | file px | drawn css px | needed px | ratio | decoded |
|---|---|---|---|---|---|---|
| for-light | haofe-logo-clean.svg | 512x512 | 44x44 | 44 | 11.64 | 1024.0 KB |
| for-dark | haofe-logo-mono-cream.svg | | hidden | | | fetched (28.0 KB), never drawn |
| sc-plate | plate.webp | 1920x1079 | 1320x742 | 1320 | 1.45 | 8092.5 KB |
| sc-bag-img | bag.webp | 748x1100 | 320x471 | 320 | 2.34 | 3214.1 KB |
| sc-sticker | haofe-logo-badge.svg | 512x512 | 128x128 | 128 | 4 | 1024.0 KB |
| sc-wheat | wheat.webp | 842x1000 | 307x1000 | 307 | 2.74 | 3289.1 KB |
| prod | frena.webp | 900x554 | 306x188 | 306 | 2.94 | 1947.7 KB |
| prod | challah.webp | 900x620 | 306x211 | 306 | 2.94 | 2179.7 KB |
| prod | baguette.webp | 900x559 | 306x190 | 306 | 2.94 | 1965.2 KB |
| prod | dairy.webp | 900x450 | 306x153 | 306 | 2.94 | 1582.0 KB |
| prod | rugelach.webp | 900x395 | 306x134 | 306 | 2.94 | 1388.7 KB |
| prod | sufganiyot.webp | 900x554 | 306x188 | 306 | 2.94 | 1947.7 KB |
| logo-s | haofe-logo-badge.svg | 512x512 | 64x64 | 64 | 8 | 1024.0 KB |
| | | | | | rendered total | 28.0 MB |

**full-desktop-2x** (1440x900 @2x)

| slot | file | file px | drawn css px | needed px | ratio | decoded |
|---|---|---|---|---|---|---|
| for-light | haofe-logo-clean.svg | 512x512 | 44x44 | 88 | 5.82 | 1024.0 KB |
| for-dark | haofe-logo-mono-cream.svg | | hidden | | | fetched (28.0 KB), never drawn |
| sc-plate | plate.webp | 1920x1079 | 1484x834 | 2968 | 0.65 | 8092.5 KB |
| sc-bag-img | bag.webp | 748x1100 | 360x529 | 720 | 1.04 | 3214.1 KB |
| sc-sticker | haofe-logo-badge.svg | 512x512 | 144x144 | 288 | 1.78 | 1024.0 KB |
| sc-wheat | wheat.webp | 842x1000 | 346x1000 | 692 | 1.22 | 3289.1 KB |
| prod | frena.webp | 900x554 | 306x188 | 612 | 1.47 | 1947.7 KB |
| prod | challah.webp | 900x620 | 306x211 | 612 | 1.47 | 2179.7 KB |
| prod | baguette.webp | 900x559 | 306x190 | 612 | 1.47 | 1965.2 KB |
| prod | dairy.webp | 900x450 | 306x153 | 612 | 1.47 | 1582.0 KB |
| prod | rugelach.webp | 900x395 | 306x134 | 612 | 1.47 | 1388.7 KB |
| prod | sufganiyot.webp | 900x554 | 306x188 | 612 | 1.47 | 1947.7 KB |
| logo-s | haofe-logo-badge.svg | 512x512 | 64x64 | 128 | 4 | 1024.0 KB |
| | | | | | rendered total | 28.0 MB |

**full-mobile** (390x780 @3x)

| slot | file | file px | drawn css px | needed px | ratio | decoded |
|---|---|---|---|---|---|---|
| for-light | haofe-logo-clean.svg | 512x512 | 44x44 | 132 | 3.88 | 1024.0 KB |
| for-dark | haofe-logo-mono-cream.svg | | hidden | | | fetched (28.0 KB), never drawn |
| sc-plate | plate.webp | 1920x1079 | 763x429 | 2290 | 0.84 | 8092.5 KB |
| sc-bag-img | bag.webp | 748x1100 | 179x264 | 537 | 1.39 | 3214.1 KB |
| sc-sticker | haofe-logo-badge.svg | 512x512 | 72x72 | 216 | 2.37 | 1024.0 KB |
| sc-wheat | wheat.webp | 842x1000 | 133x1000 | 399 | 2.11 | 3289.1 KB |
| prod | frena.webp | 900x554 | 292x180 | 876 | 1.03 | 1947.7 KB |
| prod | challah.webp | 900x620 | 292x201 | 876 | 1.03 | 2179.7 KB |
| prod | baguette.webp | 900x559 | 292x181 | 876 | 1.03 | 1965.2 KB |
| prod | dairy.webp | 900x450 | 292x146 | 876 | 1.03 | 1582.0 KB |
| prod | rugelach.webp | 900x395 | 292x128 | 876 | 1.03 | 1388.7 KB |
| prod | sufganiyot.webp | 900x554 | 292x180 | 876 | 1.03 | 1947.7 KB |
| logo-s | haofe-logo-badge.svg | 512x512 | 64x64 | 192 | 2.67 | 1024.0 KB |
| | | | | | rendered total | 28.0 MB |

**opt-desktop** (1280x820 @1x)

| slot | file | file px | drawn css px | needed px | ratio | decoded |
|---|---|---|---|---|---|---|
| for-light | haofe-logo-clean.svg | 512x512 | 44x44 | 44 | 11.64 | 1024.0 KB |
| for-dark | haofe-logo-mono-cream.svg | | hidden | | | not fetched |
| sc-plate | plate-1920.avif | 1920x1079 | 1321x742 | 1321 | 1.45 | 8092.5 KB |
| sc-bag-img | bag-480.avif | 480x706 | 320x471 | 320 | 1.5 | 1323.8 KB |
| sc-sticker | haofe-logo-badge.svg | 512x512 | 128x128 | 128 | 4 | 1024.0 KB |
| sc-wheat | wheat-800.avif | 800x950 | 307x1000 | 307 | 2.61 | 2968.8 KB |
| prod | frena-480.avif | 480x295 | 306x188 | 306 | 1.57 | 553.1 KB |
| prod | challah-480.avif | 480x331 | 306x211 | 306 | 1.57 | 620.6 KB |
| prod | baguette-480.webp | 480x298 | 306x189 | 306 | 1.57 | 558.8 KB |
| prod | dairy-480.avif | 480x240 | 306x153 | 306 | 1.57 | 450.0 KB |
| prod | rugelach-480.avif | 480x211 | 306x134 | 306 | 1.57 | 395.6 KB |
| prod | sufganiyot-480.avif | 480x295 | 306x188 | 306 | 1.57 | 553.1 KB |
| logo-s | haofe-logo-badge.svg | 512x512 | 64x64 | 64 | 8 | 1024.0 KB |
| | | | | | rendered total | 18.2 MB |

**opt-desktop-2x** (1440x900 @2x)

| slot | file | file px | drawn css px | needed px | ratio | decoded |
|---|---|---|---|---|---|---|
| for-light | haofe-logo-clean.svg | 512x512 | 44x44 | 88 | 5.82 | 1024.0 KB |
| for-dark | haofe-logo-mono-cream.svg | | hidden | | | not fetched |
| sc-plate | plate-1920.avif | 1920x1079 | 1484x834 | 2969 | 0.65 | 8092.5 KB |
| sc-bag-img | bag-748.avif | 748x1100 | 360x529 | 720 | 1.04 | 3214.1 KB |
| sc-sticker | haofe-logo-badge.svg | 512x512 | 144x144 | 288 | 1.78 | 1024.0 KB |
| sc-wheat | wheat-800.avif | 800x950 | 346x1000 | 692 | 1.16 | 2968.8 KB |
| prod | frena-800.avif | 800x492 | 306x188 | 612 | 1.31 | 1537.5 KB |
| prod | challah-800.avif | 800x551 | 306x210 | 612 | 1.31 | 1721.9 KB |
| prod | baguette-800.webp | 800x497 | 306x190 | 612 | 1.31 | 1553.1 KB |
| prod | dairy-800.avif | 800x400 | 306x153 | 612 | 1.31 | 1250.0 KB |
| prod | rugelach-800.avif | 800x351 | 306x134 | 612 | 1.31 | 1096.9 KB |
| prod | sufganiyot-800.avif | 800x492 | 306x188 | 612 | 1.31 | 1537.5 KB |
| logo-s | haofe-logo-badge.svg | 512x512 | 64x64 | 128 | 4 | 1024.0 KB |
| | | | | | rendered total | 25.4 MB |

**opt-mobile** (390x780 @3x)

| slot | file | file px | drawn css px | needed px | ratio | decoded |
|---|---|---|---|---|---|---|
| for-light | haofe-logo-clean.svg | 512x512 | 44x44 | 132 | 3.88 | 1024.0 KB |
| for-dark | haofe-logo-mono-cream.svg | | hidden | | | not fetched |
| sc-plate | plate-m-981.avif | 981x1079 | 391x429 | 1173 | 0.84 | 4134.8 KB |
| sc-bag-img | bag-748.avif | 748x1100 | 179x264 | 537 | 1.39 | 3214.1 KB |
| sc-sticker | haofe-logo-badge.svg | 512x512 | 72x72 | 216 | 2.37 | 1024.0 KB |
| sc-wheat | wheat-800.avif | 800x950 | 133x1000 | 399 | 2.01 | 2968.8 KB |
| prod | frena-800.avif | 800x492 | 292x179 | 876 | 0.91 | 1537.5 KB |
| prod | challah-800.avif | 800x551 | 292x201 | 876 | 0.91 | 1721.9 KB |
| prod | baguette-800.webp | 800x497 | 292x181 | 876 | 0.91 | 1553.1 KB |
| prod | dairy-800.avif | 800x400 | 292x146 | 876 | 0.91 | 1250.0 KB |
| prod | rugelach-800.avif | 800x351 | 292x128 | 876 | 0.91 | 1096.9 KB |
| prod | sufganiyot-800.avif | 800x492 | 292x179 | 876 | 0.91 | 1537.5 KB |
| logo-s | haofe-logo-badge.svg | 512x512 | 64x64 | 192 | 2.67 | 1024.0 KB |
| | | | | | rendered total | 21.6 MB |

Ratios below 1 in the new markup are deliberate: the browser picks the next-larger `srcset` candidate, so the wall on a 1280 px screen gets the 1920 file (17.8 KB AVIF) and on a 390 px @3x phone the largest `plate-m` (981 px, the full source resolution of that slice).

## 6. Responsive variants and the markup for every slot

Generated by `tools/gen.py` into `concepts/assets/ai/r/`; `r/manifest.json` lists per file format, width, height, bytes, quality, SSIM, and per image the intrinsic size, aspect, alpha, LQIP data URI and average colour. Rules: widths 480/800/1200 up to the source width (bag adds its 748 px source width; the wall adds 1920 because its desktop slot is 100vw). Quality: the lowest step on a fixed ladder whose SSIM against the Lanczos-resized source reaches 0.975, scored on the worse of the light (#FFFCF6) and dark (#221812) slot backgrounds so cutout edges count in both modes. Alpha kept in both formats (WebP lossy alpha only where it still meets the target with mean alpha error ≤ 0.6/255; AVIF tries a colour bleed under alpha 0 and keeps the smaller file). LQIP: longest side 16 px, WebP q40, 80-260 bytes.

`plate-m` is an art-direction crop of `plate.webp`: exactly the region that `object-fit: cover; object-position: 50% 100%` shows in the 4/4.4 mobile scene (box [470,0,1451,1079]), so phones never download or decode the 1920 px wall.

| image | source | variants: AVIF / WebP | LQIP | markup uses |
|---|---|---|---|---|
| bag | bag.webp 748x1100, 94.9 KB, alpha | 480w 35.7 KB / 40.1 KB<br>748w 54.7 KB / 60.4 KB | 202 B | AVIF + WebP |
| baguette | baguette.webp 900x559, 109.1 KB, alpha | 480w 31.5 KB / 28.9 KB<br>800w 77.5 KB / 76.2 KB | 242 B | WebP only (AVIF was not 5% smaller) |
| challah | challah.webp 900x620, 132.3 KB, alpha | 480w 33.6 KB / 37.5 KB<br>800w 64.7 KB / 82.9 KB | 250 B | AVIF + WebP |
| dairy | dairy.webp 900x450, 91.7 KB, alpha | 480w 21.3 KB / 27.8 KB<br>800w 46.3 KB / 54.4 KB | 224 B | AVIF + WebP |
| frena | frena.webp 900x554, 95.8 KB, alpha | 480w 29.0 KB / 29.1 KB<br>800w 56.0 KB / 66.7 KB | 230 B | AVIF + WebP |
| plate | plate.webp 1920x1079, 52.6 KB | 480w 4.3 KB / 7.8 KB<br>800w 7.9 KB / 13.4 KB<br>1200w 11.8 KB / 20.4 KB<br>1920w 17.8 KB / 36.3 KB | 80 B | AVIF + WebP |
| plate-m | crop of plate.webp 981x1079 | 480w 2.7 KB / 4.9 KB<br>800w 5.1 KB / 9.8 KB<br>981w 7.0 KB / 13.6 KB | 86 B | AVIF + WebP |
| rugelach | rugelach.webp 900x395, 93.5 KB, alpha | 480w 23.1 KB / 26.6 KB<br>800w 52.4 KB / 57.4 KB | 226 B | AVIF + WebP |
| sufganiyot | sufganiyot.webp 900x554, 104.7 KB, alpha | 480w 23.4 KB / 24.9 KB<br>800w 53.1 KB / 57.7 KB | 250 B | AVIF + WebP |
| wheat | wheat.webp 842x1000, 170.5 KB, alpha | 480w 20.5 KB / 40.3 KB<br>800w 40.4 KB / 89.8 KB | 260 B | AVIF + WebP |

**`sizes`**, derived from b.css and checked by `tools/sizes.js` (rendered layout width of each slot vs the width formula at 14 viewport widths from 360 to 1920 px; largest difference 1.6 px; for the wheat the width formula is the unsqueezed one):

| slot | sizes | from b.css |
|---|---|---|
| .sc-plate | `100vw` | desktop: the plane spans the hero (the hero motion module now oversizes it by ~3%, still ~100vw); mobile: `plate-m` fills the 100%-wide 4/4.4 scene |
| .sc-bag-img | `(min-width: 1000px) 25vw, 46vw` | `.sc-bag { width: 46% }`; `@container (min-width: 1000px)` → `25%` |
| .sc-wheat | `842px` while the render is squeezed (P4); `(min-width: 1000px) 24vw, 34vw` once `.sc-wheat` gets `height: auto` | `.sc-wheat { width: 34% }`; ≥1000px → `24%`; no height, so `height="1000"` applies |
| .prod | `(min-width: 1240px) 306px, (min-width: 1000px) calc(28vw - 40px), (min-width: 700px) calc(42vw - 27px), calc(84vw - 35px)` | `.in` padding 20px (48px ≥1000), max-width 1240px; grid 1/2/3 columns from 0/700/1000px, gap 22px; `.box` border 1.5px; `.prod { width: 84% }`; every cutout is width-limited in the 84% x 76% box |

The breakpoints are container queries on `.pb`; on the real site `.pb` is the page width, so the `vw` media conditions at 700/1000 px match them (off by the scrollbar width at most).

**Exact markup** (also in `recommended-markup.html`, with the full LQIP data URIs). Replace each `<img>` in `b.html` (inside `<template id="proto">`):

*hero plate (.sc-plate)*. Replaces `<img class="sc-plate" src="assets/ai/plate.webp" alt="…" width="1920" height="1079">`

```html
<picture>
<source media="(min-width: 1000px)" type="image/avif" srcset="assets/ai/r/plate-480.avif 480w, assets/ai/r/plate-800.avif 800w, assets/ai/r/plate-1200.avif 1200w, assets/ai/r/plate-1920.avif 1920w" sizes="100vw" width="1920" height="1079">
<source media="(min-width: 1000px)" type="image/webp" srcset="assets/ai/r/plate-480.webp 480w, assets/ai/r/plate-800.webp 800w, assets/ai/r/plate-1200.webp 1200w, assets/ai/r/plate-1920.webp 1920w" sizes="100vw" width="1920" height="1079">
<source type="image/avif" srcset="assets/ai/r/plate-m-480.avif 480w, assets/ai/r/plate-m-800.avif 800w, assets/ai/r/plate-m-981.avif 981w" sizes="100vw" width="981" height="1079">
<img class="sc-plate" src="assets/ai/r/plate-m-800.webp" srcset="assets/ai/r/plate-m-480.webp 480w, assets/ai/r/plate-m-800.webp 800w, assets/ai/r/plate-m-981.webp 981w" sizes="100vw" alt="" width="981" height="1079" fetchpriority="high" decoding="async" data-lqip style="--lqip:url(data:image/webp;base64,…)">
</picture>
```

*hero bag (.sc-bag-img)*. Replaces `<img class="sc-bag-img" src="assets/ai/bag.webp" alt="…" width="748" height="1100">`

```html
<picture>
<source type="image/avif" srcset="assets/ai/r/bag-480.avif 480w, assets/ai/r/bag-748.avif 748w" sizes="(min-width: 1000px) 25vw, 46vw">
<img class="sc-bag-img" src="assets/ai/r/bag-748.webp" srcset="assets/ai/r/bag-480.webp 480w, assets/ai/r/bag-748.webp 748w" sizes="(min-width: 1000px) 25vw, 46vw" alt="" width="748" height="1100" decoding="async" data-lqip style="--lqip:url(data:image/webp;base64,…)">
</picture>
```

*hero wheat (.sc-wheat)*. Replaces `<img class="sc-wheat" src="assets/ai/wheat.webp" alt="…" width="842" height="1000">`

```html
<picture>
<source type="image/avif" srcset="assets/ai/r/wheat-480.avif 480w, assets/ai/r/wheat-800.avif 800w" sizes="842px">
<img class="sc-wheat" src="assets/ai/r/wheat-800.webp" srcset="assets/ai/r/wheat-480.webp 480w, assets/ai/r/wheat-800.webp 800w" sizes="842px" alt="" width="842" height="1000" decoding="async" data-lqip style="--lqip:url(data:image/webp;base64,…)">
</picture>
```

*product frena (.box .shot .prod)*. Replaces `<img class="prod" src="assets/ai/frena.webp" alt="…" width="900" height="554" loading="lazy" decoding="async">`

```html
<picture>
<source type="image/avif" srcset="assets/ai/r/frena-480.avif 480w, assets/ai/r/frena-800.avif 800w" sizes="(min-width: 1240px) 306px, (min-width: 1000px) calc(28vw - 40px), (min-width: 700px) calc(42vw - 27px), calc(84vw - 35px)">
<img class="prod" src="assets/ai/r/frena-800.webp" srcset="assets/ai/r/frena-480.webp 480w, assets/ai/r/frena-800.webp 800w" sizes="(min-width: 1240px) 306px, (min-width: 1000px) calc(28vw - 40px), (min-width: 700px) calc(42vw - 27px), calc(84vw - 35px)" alt="פרנה, הדמיית AI" width="900" height="554" loading="lazy" decoding="async" data-lqip style="--lqip:url(data:image/webp;base64,…)">
</picture>
```

*product challah (.box .shot .prod)*. Replaces `<img class="prod" src="assets/ai/challah.webp" alt="…" width="900" height="620" loading="lazy" decoding="async">`

```html
<picture>
<source type="image/avif" srcset="assets/ai/r/challah-480.avif 480w, assets/ai/r/challah-800.avif 800w" sizes="(min-width: 1240px) 306px, (min-width: 1000px) calc(28vw - 40px), (min-width: 700px) calc(42vw - 27px), calc(84vw - 35px)">
<img class="prod" src="assets/ai/r/challah-800.webp" srcset="assets/ai/r/challah-480.webp 480w, assets/ai/r/challah-800.webp 800w" sizes="(min-width: 1240px) 306px, (min-width: 1000px) calc(28vw - 40px), (min-width: 700px) calc(42vw - 27px), calc(84vw - 35px)" alt="חלה וצמה ירושלמית, הדמיית AI" width="900" height="620" loading="lazy" decoding="async" data-lqip style="--lqip:url(data:image/webp;base64,…)">
</picture>
```

*product baguette (.box .shot .prod)*. Replaces `<img class="prod" src="assets/ai/baguette.webp" alt="…" width="900" height="559" loading="lazy" decoding="async">`

```html
<picture>
<img class="prod" src="assets/ai/r/baguette-800.webp" srcset="assets/ai/r/baguette-480.webp 480w, assets/ai/r/baguette-800.webp 800w" sizes="(min-width: 1240px) 306px, (min-width: 1000px) calc(28vw - 40px), (min-width: 700px) calc(42vw - 27px), calc(84vw - 35px)" alt="באגטים וג׳בטה, הדמיית AI" width="900" height="559" loading="lazy" decoding="async" data-lqip style="--lqip:url(data:image/webp;base64,…)">
</picture>
```

*product dairy (.box .shot .prod)*. Replaces `<img class="prod" src="assets/ai/dairy.webp" alt="…" width="900" height="450" loading="lazy" decoding="async">`

```html
<picture>
<source type="image/avif" srcset="assets/ai/r/dairy-480.avif 480w, assets/ai/r/dairy-800.avif 800w" sizes="(min-width: 1240px) 306px, (min-width: 1000px) calc(28vw - 40px), (min-width: 700px) calc(42vw - 27px), calc(84vw - 35px)">
<img class="prod" src="assets/ai/r/dairy-800.webp" srcset="assets/ai/r/dairy-480.webp 480w, assets/ai/r/dairy-800.webp 800w" sizes="(min-width: 1240px) 306px, (min-width: 1000px) calc(28vw - 40px), (min-width: 700px) calc(42vw - 27px), calc(84vw - 35px)" alt="בורקס גבינה וגביניות, הדמיית AI" width="900" height="450" loading="lazy" decoding="async" data-lqip style="--lqip:url(data:image/webp;base64,…)">
</picture>
```

*product rugelach (.box .shot .prod)*. Replaces `<img class="prod" src="assets/ai/rugelach.webp" alt="…" width="900" height="395" loading="lazy" decoding="async">`

```html
<picture>
<source type="image/avif" srcset="assets/ai/r/rugelach-480.avif 480w, assets/ai/r/rugelach-800.avif 800w" sizes="(min-width: 1240px) 306px, (min-width: 1000px) calc(28vw - 40px), (min-width: 700px) calc(42vw - 27px), calc(84vw - 35px)">
<img class="prod" src="assets/ai/r/rugelach-800.webp" srcset="assets/ai/r/rugelach-480.webp 480w, assets/ai/r/rugelach-800.webp 800w" sizes="(min-width: 1240px) 306px, (min-width: 1000px) calc(28vw - 40px), (min-width: 700px) calc(42vw - 27px), calc(84vw - 35px)" alt="רוגלאך וקוראסון שוקולד, הדמיית AI" width="900" height="395" loading="lazy" decoding="async" data-lqip style="--lqip:url(data:image/webp;base64,…)">
</picture>
```

*product sufganiyot (.box .shot .prod)*. Replaces `<img class="prod" src="assets/ai/sufganiyot.webp" alt="…" width="900" height="554" loading="lazy" decoding="async">`

```html
<picture>
<source type="image/avif" srcset="assets/ai/r/sufganiyot-480.avif 480w, assets/ai/r/sufganiyot-800.avif 800w" sizes="(min-width: 1240px) 306px, (min-width: 1000px) calc(28vw - 40px), (min-width: 700px) calc(42vw - 27px), calc(84vw - 35px)">
<img class="prod" src="assets/ai/r/sufganiyot-800.webp" srcset="assets/ai/r/sufganiyot-480.webp 480w, assets/ai/r/sufganiyot-800.webp 800w" sizes="(min-width: 1240px) 306px, (min-width: 1000px) calc(28vw - 40px), (min-width: 700px) calc(42vw - 27px), calc(84vw - 35px)" alt="סופגניות, הדמיית AI" width="900" height="554" loading="lazy" decoding="async" data-lqip style="--lqip:url(data:image/webp;base64,…)">
</picture>
```

*header logo, dark-mode copy (.mark-logo .for-dark)*. Replaces `<img class="for-dark" src="assets/logo/haofe-logo-mono-cream.svg" alt="…" width="44" height="44">`

```html
<img class="for-dark" src="assets/logo/haofe-logo-mono-cream.svg" alt="" width="44" height="44" loading="lazy" decoding="async">
```

Required CSS (add to `b.css`, section 3). `display: contents` keeps every existing selector and layout: `.sc-plate`, `.prod` etc. stay the plane/grid children they are today. `<source>` has to be hidden explicitly: Chromium gives it a box, and inside `.shot` (a grid) it became an extra grid row that shrank the product images by up to 27%. The visual check caught it.

```css
.pb picture { display: contents; }
.pb picture > source { display: none; }
.pb img[data-lqip] { background: var(--lqip) 50% 100% / 100% 100% no-repeat; }
.pb .sc-plate[data-lqip] { background-size: cover; }
.pb .prod[data-lqip] { background-size: contain; background-position: 50% 80%; }
```

LQIP removal (in `<head>`; `load` does not bubble, so it is captured on the document; works for template mounts too):

```html
<script>
/* drop the blurred placeholder once the real image has loaded (load does not bubble: capture it) */
document.addEventListener('load', function (e) { var t = e.target; if (t.tagName === 'IMG' && t.hasAttribute('data-lqip')) t.removeAttribute('data-lqip'); }, true);
</script>
```

Prototype only (images live in `<template>`, invisible to the preload scanner), in `<head>` of `b.html`:

```html
<link rel="preload" as="image" type="image/avif" media="(min-width: 1000px)" imagesrcset="assets/ai/r/plate-480.avif 480w, assets/ai/r/plate-800.avif 800w, assets/ai/r/plate-1200.avif 1200w, assets/ai/r/plate-1920.avif 1920w" imagesizes="100vw" fetchpriority="high">
<link rel="preload" as="image" type="image/avif" media="(max-width: 999.98px)" imagesrcset="assets/ai/r/plate-m-480.avif 480w, assets/ai/r/plate-m-800.avif 800w, assets/ai/r/plate-m-981.avif 981w" imagesizes="100vw" fetchpriority="high">
```

On the static site skip the preload: `fetchpriority="high"` on the hero `<img>` is enough because the preload scanner sees it. No `loading="lazy"` on any hero image. The feed placeholders (`.pola .ph`) are CSS today; when real photos arrive use `sizes="(min-width: 1240px) 366px, (min-width: 1000px) calc(33vw - 47px), (min-width: 700px) calc(50vw - 31px), calc(100vw - 60px)"` (same grid as the boxes, `.pola` padding 10px) and widths 480/800.

## 7. Fonts

**What the prototype renders** (computed style of every text node in the overlay, desktop + mobile, hidden states included):

| family / weight | distinct chars | non-Hebrew chars |
|---|---|---|
| Heebo 600 | 8 | `(none)` |
| Playpen Sans Hebrew 400 | 25 | `,…` |
| Playpen Sans Hebrew 600 | 32 | `!@_abefhkory` |
| Rubik 400 | 49 | `(),-.0123456789:?·–` |
| Rubik 500 | 17 | `(none)` |
| Rubik 600 | 30 | `-01257:AI·` |
| Rubik 700 | 31 | `-01257` |
| Secular One 400 | 30 | `,:·` |

Heebo comes from the presentation `.skip` link only.

**What Google sends today** (desktop run 1; unicode ranges from the css2 response):

| family | Hebrew file | Latin file | what triggers the Latin file |
|---|---|---|---|
| Playpen Sans Hebrew | 52.4 KB | 192.0 KB | `@haofe_bakery` (feed `.sec-head .hand`), `!` (`.note-hand`, `.visit .sec-head .hand`), `,` and `…` (`.pola q`) |
| Rubik | 9.9 KB | 35.3 KB | digits, `-`, `:`, `(`, `)`, `?`, `–`, `·`, `AI` (phones, hours, dates, `.ai-tag`) |
| Secular One | 8.6 KB | 19.6 KB | `,` `:` `·` in headings (`.b2b-band h2`, order `h2`, `.menu a`) |
| Heebo (presentation) | 12.5 KB | 30.2 KB | `.skip` link |
| total | | | 360.5 KB in 8 files |

`display=swap` is set and both preconnects are present (good). Rubik and Playpen are variable fonts on Google (Rubik wght 300-900, Playpen 100-800, from the upstream `METADATA.pb`), so all weights of a family come from the same file.

**Option A, keep Google Fonts (smallest change).** `b.html:10`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Rubik:wght@400..700&family=Secular+One&family=Playpen+Sans+Hebrew:wght@400;600&display=swap">
```

Measured: 317.8 KB in 6 files (Heebo gone, the Latin files stay). The presentation page itself still needs Heebo + IBM Plex Mono for `shell.css`; the site does not.

**Option B, self-host a Hebrew subset (recommended for the site).** Sources: the upstream OFL fonts from github.com/google/fonts (`ofl/rubik`, `ofl/secularone`, `ofl/playpensanshebrew`; "OFL" in each `METADATA.pb`). fontTools 4.67, no hinting, default OpenType features unless noted (`tools/fonts.py`, `tools/fonts2.py`). License: all three OFL.txt files are SIL OFL 1.1 and none declares a Reserved Font Name in its copyright header, so the subsets may keep their family names; ship each family's OFL.txt next to the woff2 files:

| file | contents | woff2 |
|---|---|---|
| Secular One | static, Hebrew only | 3.9 KB |
| Secular One | static, Hebrew+digits+punct | 7.1 KB |
| Rubik | 400..700, Hebrew only | 6.8 KB |
| Rubik | 400..700, Hebrew+digits+punct | 16.3 KB |
| Playpen | static 600, Hebrew only | 20.6 KB |
| Playpen | static 600, Hebrew+digits+punct | 39.5 KB |
| Playpen | static 600, Hebrew+digits+punct, no calt | 12.9 KB |
| Playpen | static 400, Hebrew only | 20.4 KB |
| Playpen | static 400, Hebrew+digits+punct | 39.2 KB |
| Playpen | static 400, Hebrew+digits+punct, no calt | 12.6 KB |
| Playpen | variable 400..600, Hebrew+digits+punct | 62.5 KB |
| Rubik | variable wght 400..700, Hebrew+Basic Latin | 31.0 KB |
| Rubik | full variable axis, Hebrew+Basic Latin | 32.5 KB |
| Secular One | static, Hebrew+Basic Latin | 12.7 KB |
| Playpen Sans Hebrew | variable wght 400..600, Hebrew+Basic Latin | 147.6 KB |
| Playpen Sans Hebrew | full variable axis, Hebrew+Basic Latin | 216.0 KB |
| Playpen Sans Hebrew | static 400, Hebrew+Basic Latin | 88.9 KB |
| Playpen Sans Hebrew | static 600, Hebrew+Basic Latin | 90.2 KB |

Chosen set: Secular One and both Playpen weights as Hebrew + digits + punctuation (`U+0020-0040, U+005B-0060, U+007B-007E, U+00A0, U+00B7, U+0590-05FF, U+200C-2011, U+2013-2014, U+2018-201A, U+201C-201E, U+2026, U+20AA, U+25CC, U+FB1D-FB4F`), Rubik 400-700 variable as Hebrew + Basic Latin (`U+0020-007E, U+00A0, U+00B7, U+0590-05FF, U+200C-2011, U+2013-2014, U+2018-201A, U+201C-201E, U+2026, U+20AA, U+25CC, U+FB1D-FB4F`). Latin letters in a heading or a note fall through the existing stacks (`--display` and `--hand` both continue with "Rubik"), so `@haofe_bakery` renders its letters in Rubik and its `@`/`_` in Playpen; either accept that or set `.pb .feed .sec-head .hand { font-family: var(--body); font-weight: 600; }` (open question).

```css
/* b.css, top of section 1. Font files from tools/fonts.py + tools/fonts2.py, served from /fonts/ */
@font-face { font-family: "Secular One"; src: url("/fonts/SecularOne-hebp.woff2") format("woff2"); font-weight: 400; font-display: swap; unicode-range: U+0020-0040, U+005B-0060, U+007B-007E, U+00A0, U+00B7, U+0590-05FF, U+200C-2011, U+2013-2014, U+2018-201A, U+201C-201E, U+2026, U+20AA, U+25CC, U+FB1D-FB4F; }
@font-face { font-family: "Rubik"; src: url("/fonts/Rubik-400-700-heb.woff2") format("woff2"); font-weight: 400 700; font-display: swap; unicode-range: U+0020-007E, U+00A0, U+00B7, U+0590-05FF, U+200C-2011, U+2013-2014, U+2018-201A, U+201C-201E, U+2026, U+20AA, U+25CC, U+FB1D-FB4F; }
@font-face { font-family: "Playpen Sans Hebrew"; src: url("/fonts/PlaypenSansHebrew-600-hebp.woff2") format("woff2"); font-weight: 600; font-display: swap; unicode-range: U+0020-0040, U+005B-0060, U+007B-007E, U+00A0, U+00B7, U+0590-05FF, U+200C-2011, U+2013-2014, U+2018-201A, U+201C-201E, U+2026, U+20AA, U+25CC, U+FB1D-FB4F; }
@font-face { font-family: "Playpen Sans Hebrew"; src: url("/fonts/PlaypenSansHebrew-400-hebp.woff2") format("woff2"); font-weight: 400; font-display: swap; unicode-range: U+0020-0040, U+005B-0060, U+007B-007E, U+00A0, U+00B7, U+0590-05FF, U+200C-2011, U+2013-2014, U+2018-201A, U+201C-201E, U+2026, U+20AA, U+25CC, U+FB1D-FB4F; }
```

```html
<!-- <head>: the two faces the first screen needs (h1, body). Not Playpen: it would compete with the hero image. Remove the Google preconnects and link. -->
<link rel="preload" href="/fonts/SecularOne-hebp.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/Rubik-400-700-heb.woff2" as="font" type="font/woff2" crossorigin>
```

Preload trade-off, measured with the P2 fix in place (3 runs each). Two preloads: mobile 3128 ms wall, 3052 ms wall, 3080 ms wall, CLS 0.0001; desktop 524 ms wall, 520 ms wall, 492 ms wall, CLS 0.0000. No preload: mobile 2796 ms wall, 2828 ms wall, 5028 ms wheat, CLS 0.0264; desktop 636 ms wall, 644 ms wall, 592 ms wall. Only Secular One preloaded: mobile 4880 ms wheat, 5040 ms wheat, 4932 ms wheat. On Slow 4G the 39 KB of preloaded fonts share the link with the render-blocking CSS, so the first paint can come ~0.2 s later than with no preload; in exchange nothing reflows. Without the Rubik preload, Rubik swaps in after first paint, the hero text block changes height, the half-visible mobile scene moves, and the wheat's visible area overtakes the wall's, so the LCP entry jumps to the wheat at ~5 s (3 of 3 runs with only Secular One, 1 of 3 with none). Recommendation: preload both Secular One and Rubik. Option A fonts with the same fix, for comparison: mobile 2924 ms wall, 2824 ms wall, 2832 ms wall, CLS 0.0265.

Option B: 116.8 KB in 4 files from the site's own origin (measured 117.5 KB with headers), versus 317.8 KB in 6 files from two Google origins today. With `.pb .pola q` on weight 600 it is 3 files, 77.6 KB. Without Playpen's `calt` feature each Playpen file drops to ~13 KB, but `calt` changes glyph spacing on every line (`playpen-calt-compare.png`), so that is a design decision.

Fallback metrics: CLS from font swaps is already low (section 2) and 0.000 on desktop with option B. `size-adjust`/`ascent-override` need the metrics of the fallback fonts users actually have (Arial on Windows, Arial Hebrew on Apple, Noto Sans Hebrew on Android), which are not in this container: MISSING. Web-font side, per 1000 em: Secular One ascent 1022 / descent 433, Rubik 935 / 250, Playpen 1070 / 460; average Hebrew letter advance 0.521, 0.519 and 0.548 em.

## 8. All runs, traces, visual check

| scenario | runs | LCP per run (ms) | FCP | CLS | TBT | bytes run 1 | LCP element run 1 |
|---|---|---|---|---|---|---|---|
| all-desktop | 3 | 524 / 520 / 492 | 524 / 520 / 492 | 0 / 0 / 0 | 0 / 0 / 0 | 638.7 KB | img.sc-plate [plate-1920.avif] |
| all-mobile | 3 | 3128 / 3052 / 3080 | 3128 / 3052 / 3080 | 0.0001 / 0.0001 / 0.0001 | 0 / 0 / 8 | 836.2 KB | img.sc-plate [plate-m-981.avif] |
| allp0-desktop | 3 | 636 / 644 / 592 | 636 / 644 / 592 | 0.0001 / 0.0001 / 0.0001 | 147 / 69 / 85 | 638.5 KB | img.sc-plate [plate-1920.avif] |
| allp0-mobile | 3 | 2796 / 2828 / 5028 | 2796 / 2828 / 2932 | 0.0265 / 0.0264 / 0.0234 | 134 / 155 / 171 | 836.0 KB | img.sc-plate [plate-m-981.avif] |
| allp1-desktop | 3 | 612 / 584 / 580 | 612 / 584 / 580 | 0.0001 / 0.0001 / 0.0001 | 81 / 35 / 42 | 638.6 KB | img.sc-plate [plate-1920.avif] |
| allp1-mobile | 3 | 4880 / 5040 / 4932 | 2940 / 2924 / 2928 | 0.0207 / 0.0207 / 0.0207 | 45 / 41 / 34 | 836.1 KB | img.sc-wheat [wheat-800.avif] |
| full-desktop | 3 | 1660 / 1648 / 1604 | 520 / 476 / 460 | 0.0164 / 0.0075 / 0.0074 | 130 / 149 / 134 | 1597.3 KB | img.sc-plate [plate.webp] |
| full-desktop-2x | 1 | 1644 | 560 | 0.0048 | 243 | 1597.3 KB | img.sc-plate [plate.webp] |
| full-mobile | 3 | 5668 / 5672 / 5712 | 3032 / 3028 / 3168 | 0.0265 / 0.0267 / 0.0265 | 179 / 212 / 336 | 1597.3 KB | img.sc-plate [plate.webp] |
| img-desktop | 3 | 1136 / 1112 / 1208 | 456 / 480 / 480 | 0.0073 / 0.0088 / 0.0073 | 170 / 129 / 153 | 881.5 KB | img.sc-plate [plate-1920.avif] |
| img-mobile | 3 | 3664 / 3752 / 3632 | 2860 / 2844 / 2820 | 0.0267 / 0.0267 / 0.0265 | 102 / 156 / 111 | 1079.0 KB | img.sc-plate [plate-m-981.avif] |
| opt-desktop | 3 | 948 / 964 / 1268 | 508 / 516 / 500 | 0.0073 / 0.0076 / 0.0076 | 130 / 219 / 214 | 841.6 KB | img.sc-wheat [wheat-800.avif] |
| opt-desktop-2x | 1 | 1604 | 668 | 0.005 | 332 | 1049.9 KB | img.sc-plate [plate-1920.avif] |
| opt-mobile | 3 | 4044 / 3800 / 3920 | 2784 / 2820 / 3020 | 0.0265 / 0.0265 / 0.0265 | 205 / 278 / 401 | 1039.1 KB | img.sc-plate [plate-m-981.avif] |
| optb-desktop | 3 | 648 / 664 / 672 | 500 / 524 / 508 | 0 / 0 / 0 | 0 / 0 / 0 | 638.6 KB | img.sc-wheat [wheat-800.avif] |
| optb-mobile | 3 | 3012 / 2992 / 2996 | 3012 / 2992 / 2996 | 0.0001 / 0.0001 / 0.0001 | 0 / 4 / 0 | 836.1 KB | section.hero.paper.b-hold "הדמיית AI · לא צולם בהאו…" |
| optnf-desktop | 3 | 740 / 528 / 672 | 740 / 528 / 672 | 0.0076 / 0.0076 / 0.0077 | 264 / 242 / 191 | 841.7 KB | img.sc-plate [plate-1920.avif] |
| optnf-mobile | 3 | 2924 / 2824 / 2832 | 2924 / 2824 / 2832 | 0.0265 / 0.0265 / 0.0265 | 217 / 273 / 256 | 1039.3 KB | img.sc-plate [plate-m-981.avif] |
| optnl-mobile | 1 | 3732 | 2912 | 0.0267 | 283 | 1035.6 KB | img.sc-plate [plate-m-981.avif] |
| page-desktop | 1 | 484 | 484 | 0.2275 | 1338 | 1664.2 KB | p.lead "המותג כמו שהוא מגיע הבית…" |
| br:all-desktop | 1 | 536 | 536 | 0 | 0 | 448.4 KB | img.sc-plate [plate-1920.avif] |
| br:all-mobile | 1 | 2864 | 2864 | 0.0001 | 0 | 645.9 KB | img.sc-plate [plate-m-981.avif] |
| br:full-desktop | 1 | 1716 | 560 | 0.0073 | 121 | 1395.0 KB | img.sc-plate [plate.webp] |
| br:full-mobile | 1 | 5236 | 2580 | 0.0265 | 228 | 1395.0 KB | img.sc-plate [plate.webp] |
| br:opt-desktop | 1 | 972 | 604 | 0.0076 | 81 | 652.4 KB | img.sc-wheat [wheat-800.avif] |
| br:opt-mobile | 1 | 3280 | 2504 | 0.0265 | 217 | 849.9 KB | img.sc-plate [plate-m-981.avif] |

Keys: `full` today, `img` images only, `opt` option A, `optnl` option A without LQIP, `optnf` option A + P2 fix, `optb` option B, `all` option B + P2 fix, `allp0`/`allp1` "all" with no font preload / only Secular One preloaded, `page` the presentation page `b.html`, `br:` brotli server, `-2x` 1440x900 @2x.

**trace-full-desktop** (Chromium trace of one cold load, renderer process; 1280x820 @1x; no network throttle)

| total ms | count | longest ms | thread · event |
|---|---|---|---|
| 1106.4 | 346 | 108.7 | ThreadPoolForegroundWorker · RasterTask |
| 241.8 | 107 | 19.8 | CrRendererMain · Commit |
| 197.2 | 91 | 100.2 | CrRendererMain · EventDispatch |
| 164.8 | 116 | 96.7 | CrRendererMain · FunctionCall |
| 155.3 | 23 | 79.8 | CrRendererMain · Layout |
| 89.6 | 12 | 31.8 | ThreadPoolForegroundWorker · ImageDecodeTask |
| 72 | 3 | 31 | ThreadPoolForegroundWorker · Decode LazyPixelRef |
| 71.8 | 3 | 30.9 | ThreadPoolForegroundWorker · Decode Image |
| 70.4 | 107 | 13.9 | CrRendererMain · FireAnimationFrame |
| 67.9 | 217 | 13.8 | CrRendererMain · Paint |

**trace-opt-desktop** (Chromium trace of one cold load, renderer process; 1280x820 @1x; no network throttle)

| total ms | count | longest ms | thread · event |
|---|---|---|---|
| 1084.8 | 634 | 72.4 | ThreadPoolForegroundWorker · RasterTask |
| 225.9 | 76 | 114.4 | CrRendererMain · EventDispatch |
| 169 | 143 | 110.7 | CrRendererMain · FunctionCall |
| 157.5 | 122 | 8.9 | CrRendererMain · Commit |
| 147.4 | 24 | 92.8 | CrRendererMain · Layout |
| 82.2 | 32 | 38.7 | ThreadPoolForegroundWorker · ImageDecodeTask |
| 76.4 | 4 | 35.6 | ThreadPoolForegroundWorker · Decode LazyPixelRef |
| 70.6 | 4 | 32 | ThreadPoolForegroundWorker · Decode Image |
| 63.1 | 122 | 9.2 | CrRendererMain · Layerize |
| 59.8 | 122 | 4.2 | CrRendererMain · FireAnimationFrame |

**trace-full-mobile** (Chromium trace of one cold load, renderer process; 390x780 @3x, 4x CPU; no network throttle)

| total ms | count | longest ms | thread · event |
|---|---|---|---|
| 745.8 | 87 | 378.7 | CrRendererMain · EventDispatch |
| 596.4 | 185 | 365 | CrRendererMain · FunctionCall |
| 564.7 | 20 | 293 | CrRendererMain · Layout |
| 533.6 | 175 | 24.9 | CrRendererMain · Commit |
| 447.4 | 176 | 11 | CrRendererMain · Layerize |
| 302.9 | 203 | 22.6 | CrRendererMain · UpdateLayoutTree |
| 252.4 | 176 | 8.2 | CrRendererMain · FireAnimationFrame |
| 172.5 | 121 | 28 | ThreadPoolForegroundWorker · RasterTask |
| 171.6 | 197 | 10.1 | CrRendererMain · PrePaint |
| 103.8 | 168 | 24.3 | CrRendererMain · Paint |

**trace-opt-mobile** (Chromium trace of one cold load, renderer process; 390x780 @3x, 4x CPU; no network throttle)

| total ms | count | longest ms | thread · event |
|---|---|---|---|
| 691 | 79 | 349.1 | CrRendererMain · EventDispatch |
| 564.3 | 187 | 338.4 | CrRendererMain · FunctionCall |
| 502.1 | 22 | 233.7 | CrRendererMain · Layout |
| 471.5 | 164 | 13 | CrRendererMain · Commit |
| 361.5 | 164 | 5.7 | CrRendererMain · Layerize |
| 272.2 | 192 | 15 | CrRendererMain · UpdateLayoutTree |
| 244 | 165 | 10.2 | CrRendererMain · FireAnimationFrame |
| 194.9 | 141 | 25.8 | ThreadPoolForegroundWorker · RasterTask |
| 160.9 | 190 | 9.5 | CrRendererMain · PrePaint |
| 106.4 | 201 | 19.7 | CrRendererMain · Paint |

**trace-all-mobile** (Chromium trace of one cold load, renderer process; 390x780 @3x, 4x CPU; no network throttle)

| total ms | count | longest ms | thread · event |
|---|---|---|---|
| 603.9 | 82 | 301.5 | CrRendererMain · EventDispatch |
| 577 | 169 | 11.3 | CrRendererMain · Commit |
| 556.9 | 190 | 295.3 | CrRendererMain · FunctionCall |
| 423.1 | 170 | 5.8 | CrRendererMain · Layerize |
| 278.5 | 20 | 214.8 | CrRendererMain · Layout |
| 277.9 | 170 | 7.1 | CrRendererMain · FireAnimationFrame |
| 265 | 194 | 9.6 | CrRendererMain · UpdateLayoutTree |
| 168.9 | 186 | 9.8 | CrRendererMain · PrePaint |
| 84 | 90 | 13.1 | ThreadPoolForegroundWorker · RasterTask |
| 79.3 | 152 | 24.1 | CrRendererMain · Paint |

Desktop spends over a second of raster-thread time (`RasterTask`) in the first 3 s; the scene is 4 large layers plus a flour-dust canvas and two `feTurbulence` noise textures (`.pb .paper`, `.ph::after`). It is off the main thread, but on low-end GPUs/CPUs it competes with decoding. No change proposed until the motion work settles; re-trace then.

**Visual check** (`tools/visual.js`: reduced motion, page unrolled to full height, every image loaded; pixels differing by more than 64/255 against today):

| page | variant | page height today → variant | pixels changed |
|---|---|---|---|
| 1280 px, light | images only | 4281 → 4281 | 0.021% |
| 1280 px, light | option A (no LQIP) | 4281 → 4281 | 0.115% |
| 1280 px, light | option B | 4281 → 4281 | 0.56% |
| 390 px, light | images only | 8080 → 8080 | 0% |
| 390 px, light | option A (no LQIP) | 8080 → 8053 | 9.517% |
| 390 px, light | option B | 8080 → 8053 | 9.598% |
| 1280 px, dark | images only | 4281 → 4281 | 0.015% |
| 1280 px, dark | option A (no LQIP) | 4281 → 4281 | 0.113% |
| 1280 px, dark | option B | 4281 → 4281 | 0.56% |

Images only: the remaining differences are bread texture (Lanczos pre-scaling vs the browser's own downscale), no layout change, no halos around the cutouts. Option A/B: Rubik 600 now renders as 600 instead of 700, so text widths and on mobile the page height change.

## 9. Open questions, missing data, how to reproduce

- **Motion owner (P2):** remove the opacity fade from `.sc-plate` and shorten what `.b-hold` waits for. I did not touch `b-motion-*`.
- **Design:** Playpen with or without `calt` (~13 KB vs ~40 KB per weight); `.pb .pola q` at 600 to ship one Playpen file; the `@haofe_bakery` handle in Rubik or mixed.
- **Design:** is the tall, squeezed wheat the intended look (P4)? Decides `height: auto` and the wheat `sizes`.
- **Design:** sign-off on the svgo-optimised logos before they replace the originals (pixel check numbers in P5).
- **MISSING:** hosting/CDN (decides brotli, HTTP/2 or 3, cache headers). The `br` rows assume brotli-11 static compression.
- **MISSING:** real-user data (CrUX/RUM); all numbers here are lab numbers from one machine.
- **MISSING:** fallback-font metrics for `size-adjust` (section 7).
- When real photography replaces the AI renders (README in `assets/ai/`), rerun `tools/gen.py`; the markup regenerates from the manifest (`tools/markup.js`).

Reproduce: `tools/README.txt`. Logos: `npx svgo@3.3.2 --config tools/svgo.config.js -i assets/logo/haofe-logo-badge.svg -o assets/logo/haofe-logo-badge.min.svg` (same for `-clean` and `-mono-cream`).

Snapshot measured (sha1):

```
c110f7e5771e613314c46e8b8361ac6b2f469f14  b.html
08951a806bbee931cb4b41299334aba7d065eeaf  b.css
ef803be0b39c5c40760fc8fd55793ca6f893d27f  b.js
b90b0b26608291b31b1b6f37d92afc4b5cad487d  b-motion-hero.css
8befe32b0bab3c0ea04df80cb01ef52526c53eab  b-motion-micro.css
12c909495a31cdd850d4aaf45a55fb73330381ba  b-motion-scroll.css
35a45c6d16f3654d2f7b84ce30aa49d19d441b5b  b-motion-hero.js
912b7ec6d530a1d1fe4f08cd12ca8d5fb38cfa0d  b-motion-micro.js
91ec8694752e58071f2ecc1870d638875822b938  b-motion-scroll.js
3e6be7dd95b71ed018801089dbafe742f4e8f873  shell.css
00bae684639b589558baf860d8bee172f634ff36  shell.js
```
