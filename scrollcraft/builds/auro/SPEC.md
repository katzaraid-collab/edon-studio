# AURO landing page: build contract

Read BRIEF.md first. This file is the contract every agent builds against. Do not edit the engine (`scrollcraft.js`, `scrollcraft.css`). Do not edit files another agent owns.

## Files and owners

| Path | Owner | What |
|---|---|---|
| `index.html` | Shell agent | Whole document: head, chrome, act 1 (hero), act 5 (close), and the markers `<!--ACT2-->`, `<!--ACT3-->`, `<!--ACT4-->` where the lead pastes the middle acts |
| `css/site.css` | Shell agent | Tokens, type, split-stage chrome (divider), columns, hero, close, mobile, reduced motion |
| `js/page.js` | Shell agent | Global state (`window.AURO`), divider choreography, collapse, fallbacks, join link |
| `partials/act2.html`, `act3.html`, `act4.html` | Acts agent | Markup for the three middle acts, each one `<section>` |
| `css/acts.css` | Acts agent | Styles for acts 2 to 4 only, scoped under `.act2`, `.act3`, `.act4` |
| `js/acts.js` | Acts agent | Any act-local behaviour (chart line draw etc.), scoped, no globals except reading `window.AURO` |
| `js/mark3d.js` | 3D agent | The live three.js gold mark (ES module) |
| `assets/3d/*` (new files) | 3D agent | Posters and fallbacks |
| `lab/` | QA agent | Screenshots and reports |

Load order in `index.html`: Google Fonts, `scrollcraft.css`, `css/site.css`, `css/acts.css`; at the end of body `scrollcraft.js`, `ScrollCraft.mount(document.body)`, `js/page.js`, `js/acts.js`, then `<script type="module" src="js/mark3d.js">`.

Everything must also run as a published claude.ai Artifact: external scripts only from `cdn.jsdelivr.net/npm/` (three.js: `https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js` and addons under `.../three@0.169.0/examples/jsm/`), stylesheets only from Google Fonts, everything else local and relative. No `alert`, no `window.open`, no forms that submit anywhere.

## Tokens (site.css owns them; everyone uses them)

```css
:root {
  --sc-canvas: #07070A;  --sc-surface: #111114;
  --sc-ink: #EDEBE6;     --sc-ink-soft: #A39F97;
  --sc-accent: #E7B64F;  --sc-accent-ink: #140E04;
  --sc-font-display: "Heebo", system-ui, sans-serif;
  --sc-font-text: "Heebo", system-ui, sans-serif;
  --au-latin: "Archivo", system-ui, sans-serif;      /* font-stretch: 125%; Latin wordmark/labels only */
  --au-mono: "Geist Mono", ui-monospace, monospace;  /* prices, tickers, levels only */
  --au-alone: #8E8B85;       /* the alone side's ink: cooler, quieter */
  --au-line: #2A2A30;        /* hairlines */
  --au-mint: #3DDC97;  --au-coral: #FF5A5F;          /* signal card only */
}
```

Google Fonts URL: `https://fonts.googleapis.com/css2?family=Heebo:wght@200..900&family=Archivo:wdth,wght@125,600..900&family=Geist+Mono:wght@400..600&display=swap`

Type: Hebrew display uses **weight contrast**: the alone side in Heebo 200–300, the together side in Heebo 700–800, tracking about −0.03em at display sizes. Body Heebo 400, line-height 1.6, measure ≤ 62ch. Flat gold `--sc-accent` for emphasis. **No gradient text, no glows, no glass blur, no em dashes, no section counters, no scroll cue, no eyebrow above every heading.**

## The split stage (the page's grammar)

- RTL. The **right** column is **לבד** (alone). The **left** column is **ביחד** (together).
- A vertical **divider** is the only chrome: a 1px line, fixed, full height, at `--split` (fraction of viewport width measured from the right edge; starts at 0.5). It carries the two side labels at its top ("לבד" to its right, "ביחד" to its left, small, Heebo 500, letter-spacing 0.04em) and a gold progress fill that grows down the line with page progress, with a small tick where each act begins. In the comparison act the divider also carries each row's topic label (see act 2).
- The divider is a **price level**: the label "LEVEL" is never shown, but the line style matches the brand's level line (bone at 35% opacity, dashed `3px 9px` when idle, solid gold under the progress fill).
- `--split` story across the page: act 1 = 0.50; act 2 eases to 0.44; act 3 to 0.40; act 4 to 0.34; act 5 sweeps from 0.34 to 0.00 (the line reaches the right edge and the alone column is gone). Columns are laid out from `--split`, so the together side visibly gains ground.
- **Mobile (< 760px):** the divider is **horizontal**. Alone is the **top** band, together the **bottom** band; `--split` becomes the fraction of viewport height for the top band (0.5 → 0.44 → 0.4 → 0.34 → 0). Side labels sit at the divider's right end.
- Wordmark (`assets/logo/auro-wordmark-dark.svg`, height ~22px) sits at the top of the together column, with a small text link "הצטרפות לקהילה" next to it that jumps to `#join`. No other nav.

## Global state contract (`window.AURO`, written by page.js every frame, read by mark3d.js and acts.js)

```js
window.AURO = {
  split: 0.5,          // current divider fraction (see above)
  mobile: false,       // true when the divider is horizontal
  hero: 0,             // act 1 progress 0..1 (its --sc-p)
  close: 0,            // act 5 progress 0..1 (its --sc-p)
  velocity: 0,         // smoothed scroll velocity, px per frame, signed
  pointer: {x: 0, y: 0}, // -1..1, only on (hover:hover) and (pointer:fine), else 0
  reduced: false,      // prefers-reduced-motion
  webgl: true          // mark3d.js sets false if it cannot start
};
```

Anchors the 3D scene follows (page.js/the shell provides them as empty, sized, `aria-hidden` boxes):

- `[data-anchor="bar"]` in act 1, inside the alone column: where the gold bar floats.
- `[data-anchor="base"]` in act 1, inside the together column: where the peak base stands.
- `[data-anchor="land"]` in act 5, centred in the together column: where the completed A ends up.
- `[data-anchor="bar-close"]` in act 5, inside the (shrinking) alone column: where the bar starts its crossing.

## Acts (copy is final; use it verbatim)

### Act 1 · hero · `data-sc-act="pin"` span 1.6 · device: pin + kinetic greet + live 3D
- Alone (right): label stays in the divider. Display line, Heebo 200–300, `--au-alone`: **סוחרים בזהב.** Sub: **עשר קבוצות, אלף איתותים, ואף אחד לשאול.**
- Together (left): display line, Heebo 800, accent: **צומחים ביחד.** Sub: **קהילה אחת שמשתפת רעיונות לעסקאות, ניתוחי שוק, וגם טעויות.**
- The two display lines are ONE `<h1>` (two spans placed in the two columns). Greet cue (`"0 0.8 0"`), kinetic `lines`.
- 3D: the bar floats in the alone column, tilted ~8°, slowly bobbing, slightly lower contrast lighting; the base stands upright in the together column under warm light. Fine pointer tilts both a little.

### Act 2 · comparison · flow + `data-sc-in` (no pin) · device: flow/in
- Intro line across the top of both columns: **אותו שוק. שתי דרכים לעבוד בו.**
- Four rows. Topic label sits on the divider (small pill on the line); alone line on the right in `--au-alone`, Heebo 300; together line on the left in ink, Heebo 500.
  1. **רעיון לעסקה** · alone: **צילום מסך מקבוצה שלישית. בלי סטופ, בלי הסבר.** · together: **כניסה, סטופ ויעד, עם הסבר למה דווקא שם.**
  2. **לפני שנכנסים** · alone: **תחושת בטן, והרבה תקווה.** · together: **רמות, תרחישים, וסיכון שמחושב מראש.**
  3. **כשזה לא הולך** · alone: **סוגרים את המסך ומנסים לשכוח.** · together: **מפרקים את העסקה ביחד, ולומדים ממנה.**
  4. **כשיש שאלה** · alone: **גוגל, פורום, ניחוש.** · together: **שואלים בקבוצה. מישהו כבר היה שם.**
- Rows enter staggered (alone line first, together line 80ms later). Reduced padding after the pinned hero.

### Act 3 · the trade idea · `data-sc-act="pin"` span 1.6 · device: reveal (+ line draw)
- Alone (right): a shouted message set as type, not a fake screenshot: **״זהב עכשיו!! קונים!!!״** (Heebo 800, large, `--au-alone`, slightly rotated −2°). Caption: **ככה נראה איתות בלי מבנה.**
- Together (left): the AURO signal card as real markup, wiped in with `data-sc-reveal="up"` across the act. Card content (all values are an example; show a small tag **דוגמה**): ticker **XAU/USD** (Archivo, 125% width) · **זהב מול דולר** · direction pill **BUY · קנייה** (mint) · rows: **כניסה 4,108.50** · **סטופ לוס 4,092.00** (coral) · **יעד ראשון 4,125.00** (mint) · **יעד שני 4,141.50** (mint) · **סיכון מול סיכוי 1 : 2.0** · note: **כניסה אחרי סגירת נר שעה מעל 4,105. ביעד הראשון מזיזים את הסטופ לנקודת הכניסה.** · a mini chart (SVG) with the entry/SL/TP level lines whose price path draws itself (stroke-dashoffset from `--sc-p`).
- Caption under the card (the one place the page says "you"): **ככה נראה רעיון לעסקה אצלנו: כל המספרים וההסבר, לפני שאתם מחליטים.**
- Mono (Geist Mono) for prices only. Card: surface `--sc-surface`, 1px top edge light, radius 20px, shadow with offset. No blur.

### Act 4 · how we behave · flow + kinetic lines, no pin · device: kinetic (quiet act, authored silence)
- Together (left, wide): heading **חמישה כללים שעושים את הקבוצה טובה לכולם.** Then the five rules as an ordered list, small numerals in mono gold:
  1. **כבוד הדדי. ביקורת עניינית, בלי עלבונות ובלי ויכוחים אישיים.**
  2. **בלי פרסום, קישורים זרים או פניות פרטיות שלא ביקשו.**
  3. **כל עסקה היא החלטה שלך. בודקים, מחשבים סיכון ורק אז נכנסים.**
  4. **אין שאלה טיפשית. מי ששואל לומד, ומי שעונה מתחזק.**
  5. **משתפים גם הפסדים. ככה כולנו לומדים מהר יותר.**
- Alone (right, narrow): one quiet line at the bottom of the column: **לבד אין כללים. וגם אין מי שיזכיר אותם.**
- No 3D, no reveal, nothing pinned. Text arrives and the act breathes.

### Act 5 · close (THE PEAK) · `data-sc-act="pin"` span 2.6 · id `join` · device: pin + live 3D signature move
- Choreography by `close` progress:
  - 0.00–0.25: the bar appears at `bar-close` (alone side), wobbling.
  - 0.20–0.70: `--split` sweeps 0.34 → 0; the bar travels across the level line on a shallow arc toward `land`; the base rises into place at `land`.
  - 0.70–0.80: the bar settles onto the base with a short damped bounce; the gap between them reads as the level line and catches one bright hairline of light for 300ms equivalent of scroll.
  - 0.80–1.00: the assembled A turns slowly to its hero angle and holds. Copy is fully visible from 0.72 and **holds to the end** (one-value cue).
- Copy (together column, now full width), placed beside the landed A, not over it:
  - h2: **ביחד, זה מחזיק.**
  - Sub: **AURO היא קהילת וואטסאפ לסוחרי זהב. רעיונות לעסקאות, ניתוחי שוק ולמידה משותפת.**
  - CTA button (solid gold, accent-ink text, pill radius 999px, one line): **הצטרפות לקהילה** → `JOIN_URL` constant in page.js (placeholder `https://chat.whatsapp.com/`; the client must supply the real invite).
  - Under it, small: **מסחר בזהב כרוך בסיכון. התוכן בקהילה אינו ייעוץ השקעות ואינו מבטיח רווח. כל עסקה היא החלטה אישית.**
  - Wordmark at the bottom of the screen, small.
- The final screen stands still with the A, the h2, the CTA and the disclaimer on it.

## Fallbacks

- `prefers-reduced-motion: reduce`: no pinned travel beyond what the engine keeps; the split stays at its act value without animating; the hero shows the bar and base posters as images in their columns; the close shows the assembled A poster (`assets/3d/a-hero.webp`) with the copy. Nothing essential hidden.
- WebGL unavailable or failing: identical to the reduced-motion posters (`window.AURO.webgl = false` and `document.documentElement.classList.add('no-webgl')`).
- Phone: separate art direction, never a shrunken desktop. Hero headline steps down; 3D pieces sit in the bands; the close stacks A over copy. Check 390×844 and 360×640.

## Taste floor

taste.md applies in full: contrast measured (body ≥ 4.5:1), focus-visible on every control in the accent, hover only under `(hover:hover) and (pointer:fine)`, transforms and opacity only, `--sc-ease-out` for UI, no `transition: all`, tabular numerals in prices, selection and caret colours themed.

## Shared layout primitive (shell defines it in site.css; acts use it)

page.js writes `--split` (unitless fraction) and `--split-x` (the divider's distance from the right edge, as a length: `calc(var(--split) * 100vw)` on desktop) on `:root` every frame. Every act's content row uses:

```html
<div class="split-row">
  <div class="col-alone">…</div>      <!-- right column, width = --split-x -->
  <div class="col-together">…</div>   <!-- left column, takes the rest -->
</div>
```

```css
.split-row { display: grid; grid-template-columns: var(--split-x) 1fr; }   /* RTL: first track is on the right */
@media (max-width: 759px) { .split-row { grid-template-columns: 1fr; } }   /* bands stack: alone above, together below */
```

Columns get inner padding `clamp(20px, 4vw, 72px)` on the inline sides so text never touches the divider. An element that must sit ON the divider (act 2 topic pills) is absolutely positioned at `inset-inline-start: var(--split-x)` with `translate: 50% 0` (RTL: inline-start is the right edge). On mobile those pills sit at the start of each row instead.
