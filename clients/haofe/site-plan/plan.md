# האופה · front-end plan for the production site

Front-end architect, 24.10.2026. Direction B "השקית", chosen by the owner.

This plan turns the approved prototype (`concepts/b.html` + `b.css` + `b.js` + `b-motion-*` + `shell.js`) into a static multi-page site. It builds on the other agents' work and does not repeat it. The information architecture (IA) is in `research/site-architecture.md`, SEO in `seo/plan.md` with `seo/head-meta.json`, performance in `audit/perf/report.md`, accessibility in `audit/a11y/README.md`, legal texts in `legal/`, the product data in `data/products.json` and `data/menu.md`.

A working skeleton is in `site-plan/skeleton/`. It is the real home page, running on the window scroll with the prototype's three motion modules, the theme handling and the production CSP, and Playwright tests it at 23 of 23 passing (section 10; files in section 13).

**Owner decision, 24.10.2026:** haofeapp.com, the bakery's ordering app, is not part of the site. The site has no link to it, no online ordering and no "coming soon" state, no `/order` page, no launch-day plan and no build switch for it (`orderApp.status`, `data-order`, `.when-soon`/`.when-live`, `.chip-soon`, `data-live-href` are all gone). Ordering is by phone only: the home page's order receipt "מזמינים בטלפון" shows the ordering line 1700-55-22-55, the line "הסניפים: כתובות, טלפונים ושעות בהמשך העמוד" and a "לסניפים" button to the branches. This plan and the skeleton were updated to match; removed items are marked "cancelled" where they had a number or a section.

---

## 0. Decisions at a glance

| Topic | Decision | Why, in one line |
|---|---|---|
| Stack | Static HTML, CSS and JS, built by one **zero-dependency Node 22 script** (`site/build/build.mjs`). No framework. | The build exists for three jobs plain files can't do safely: shared header, footer and bar; the menu from `products.json`; checks such as the CSP hash and the guard that the ordering app's domain is in no output file. See section 3. |
| Hosting | A **separate Vercel project** from the same repo. Its Root Directory is `clients/haofe`, it has its own `vercel.json` and `.vercelignore`, and its own domain. | The studio project ignores `clients/` and serves a CSP that would block the bakery's boot script. See section 9. |
| Root element | **`<html class="pb rm">`** is the prototype's `.proto.pb`. It carries the tokens, `data-mode`, `.anim`/`.rm`, and it is the query container. | The theme can then be applied before the first paint by a 1-line inline script, with no CSS changes. Tested. |
| Layout queries | **Keep the container queries.** | The hero module decides layout with `root.offsetWidth >= 1000`, so CSS and JS keep the same breakpoint. `html` as the container does not break `position: fixed` or `sticky` (tested). |
| Theme | Light on a first visit, whatever the OS setting. A toggle. The choice is saved in `localStorage["haofe:theme"]`, wrapped in try/catch. An inline `<head>` script prevents a flash. | As the owner asked. Tested with storage that throws, with `theme.js` delayed by 2.5 s, and in another tab. |
| Motion on a page | A runtime adapter (`runtime.js`) passes **ctx contract 2**: `scroller = document.scrollingElement`, `ioRoot = null`, `scrollEvents = window`, `vtHost = document`, `view()`. It boots only modules that declare `contract: 2`. | The prototype modules assume a scrolling `<div>`. On a page, 14 of 17 entrances fire at load and the ticker never idles (measured, section 6.6). |
| Module changes | 5 mechanical changes common to all three modules, plus 1 or 2 per module (section 6.3). `skeleton/tools/port-modules.mjs` applies them today. Each change falls back to the old behaviour, so module owners can adopt them upstream without breaking `shell.js`. | It survived two live edits of `b-motion-scroll.js` and one of `b-motion-micro.js` while I worked. |
| Images | `<picture>` with AVIF and WebP `srcset` from `concepts/assets/ai/r/manifest.json`. The build generates them from the manifest, never by hand. | The perf agent already sized every slot (`audit/perf/recommended-markup.html`). |
| Fonts | Self-hosted woff2 subsets (perf "option B"). Secular One and Rubik are preloaded. | 116.8 KB from our own origin instead of 317.8 KB from two Google origins (perf §7). Allows `font-src 'self'`. |
| CSP | `script-src 'self' 'sha256-…'`. Everything else is `'self'` or `data:` for images. `style-src-attr 'unsafe-inline'` only until the build emits the LQIP placeholders as CSS. | Tested: 0 violations over a full scroll. A negative control proves the policy is enforced. |

---

## 1. What I read (inputs, with versions)

| Input | State used | Notes |
|---|---|---|
| `concepts/b.html` (template `#proto`, lines 179-420), `b.js`, `shell.js`, `b.css` (header "HOOKS MOTION MODULES MAY RELY ON") | as of 24.10.2026, about 03:50 | `b.css` was also being edited, so line numbers below are approximate. Selectors are exact. |
| `concepts/b-motion-hero.js` / `-scroll.js` / `-micro.js` (+ `.css`) | md5 at the last test run: hero.js `ae175f2…`, scroll.js `8679c78…`, micro.js `4860f1a…`, micro.css `2cbd8f0…` | Other agents are editing these. My snapshot is in `scratchpad/agents4/archsnap/`. The port runs on the live files and was re-run after their edits. |
| `concepts/assets/ai/r/manifest.json` | generated 2026-10-24 by `audit/perf/tools/gen.py` | Widths, bytes, LQIP. All images are AI renders and must carry "הדמיית AI". |
| `research/site-architecture.md`, `seo/plan.md`, `seo/head-meta.json` | 24.10.2026 | URL list, publish conditions. The order "soon/live" rules of the IA draft are superseded: the owner removed the ordering app from the site on 24.10.2026. |
| `audit/perf/report.md`, `recommended-markup.html` | 24.10.2026 | Fonts (§7), image markup (§6), P2 (plate fade hides the LCP). |
| `audit/a11y/README.md` | snap2 / live | A11Y-02, -03, -07, -08, -09, -10, -15, -21 and -22 shape the page template. |
| `legal/privacy-policy.md`, `legal/checklist.md` | 24.10.2026 | D3 (preference in localStorage), C4 (no third-party embeds or scripts without updating the policy). |
| `data/products.json`, `data/menu.md` | retrieved 2026-10-24T03:30:36Z | 49 products, Netivot only, no prices, photos or descriptions. |
| `scratchpad/agents4/research.json` | 7 keys | Branches, kashrut, app domain, ordering law. |
| Repo root `vercel.json`, `.vercelignore` | as committed | The studio site. `.vercelignore` lists `clients`. |

Browser facts in this plan were checked in **Chromium 153 (Playwright)** only. Firefox and Safari behaviour was **not tested**: MISSING. Run the skeleton tests in both before launch (checklist step 15).

---

## 2. Pages

The URLs follow the IA and the SEO plan: Latin slugs, no trailing slash, publish only when the condition is met. "Sections reused" names the prototype pieces each page is built from.

| URL | Output file | Content source | Sections reused from the template | Publish when (per `seo/head-meta.json`) |
|---|---|---|---|---|
| `/` | `index.html` | the skeleton's `index.html` | header, hero, ticker, boxes (6 category boxes linking to `/products`), order receipt (phone), feed, b2b band, branch labels, footer, bar | launch day |
| `/products` (the menu) | `products.html` | **`data/products.json`**, rendered by the build (section 2.1) | `.sec-head`; category chips; plain lists, **not** the box disclosure (find-in-page and SEO need the text open) | when the owner approves the list |
| `/branches` | `branches.html` | `site/data/branches.json` (new, section 2.2) | `.labels` / `.label` with `id="netivot|sderot|kiryat-gat"` anchors | launch day |
| `/branches/netivot`, `/sderot`, `/kiryat-gat` | `branches/<slug>.html` | the same JSON | one `.label` enlarged, plus "סניפים נוספים" | Netivot at launch; the others once the owner confirms the phone (IA §5) |
| `/business` (wholesale) | `business.html` | copy from the owner | `.b2b-band` as the page hero, plus a contact block | when the owner approves the wording and a business contact |
| `/about` (story) | `about.html` | owner-approved story (the prototype's draft from Walla 2021 is pending) | `.story-card` | when the owner approves the story |
| `/accessibility` | `accessibility.html` | `legal/accessibility-statement.md`, converted once by hand after the bracketed variants are resolved | text page template (section 4.4) | launch day |
| `/privacy` | `privacy.html` | `legal/privacy-policy.md`, the **"עם העדפה, לפי D3"** variant, because the theme choice is stored | text page template | launch day |
| ~~`/order`~~ | — | — | — | **Cancelled (24.10.2026):** no order page. Ordering is by phone only, on the home page's receipt (`#order`). |
| 404 | `404.html` | `seo/plan.md` §3 copy | text page template, with links to `/` and `/branches` | launch day; Vercel serves `404.html` from the output root with status 404 ([Vercel guide](https://vercel.com/kb/guide/custom-404-page)) |

### 2.1 `/products` from `data/products.json`

The build follows the rules the data agent wrote in `data/menu.md`, "Notes for the site team":

- One `<h2>` per category, in `app_constants.category_order`. One `<h3>` per subgroup, in `subcategory_order`, with the count in the heading. One `<ul>` per subgroup. Items are sorted by `page_order`, each with `id="p-{slug}"`.
- Groups listed in `defined_in_app_code_but_empty_on_page` are skipped: לחמים/כוסמין and עוגות.
- Units are stated once per category: "נמכרים לפי יחידה." for breads and dry goods. For pastries, "לפי משקל" is **not** written as a shop-wide rule until the owner answers (menu.md).
- `options` are shown only after the owner confirms them (menu.md, "Options").
- The build never prints `price`, `description`, `image` or allergens. They are `null` for every row, and the build fails if any is non-null without a `source` field. The page never shows a kashrut level above the list.
- Scope line: "הרשימה של סניף נתיבות, מעודכנת ל־{source.retrieved_at as dd.mm.yyyy}". Do not present it as the chain-wide range.
- The seasonal סופגניות block is only an HTML comment until the owner approves it.

### 2.2 `site/data/branches.json` (new; one file feeds the hub, the branch pages, the footer NAP and the JSON-LD)

```json
{ "slug": "netivot", "city": "נתיבות",
  "address":  { "value": "שדרות ירושלים 136, נתיבות", "confirmed": true,  "source": "verify:branches (research.json); the owner's ordering system, viewed 24.10.2026" },
  "phone":    { "value": "08-9752093",               "confirmed": true,  "source": "verify:branches" },
  "hours":    { "value": null, "confirmed": false, "source": "4 sources disagree (verify:branches)" },
  "kashrut":  { "value": null, "confirmed": false, "source": "no Badatz record for the store (research:kashrut)" },
  "mapsUrl": "https://www.google.com/maps/search/?api=1&query=…", "page": true }
```

The rule in the build: a field with `confirmed: false` is never rendered. `page: false` means links go to `/branches#<slug>` (SEO plan §2). The build fails if any output contains "לאישור", "[[חסר" or `class="tbd"`.

---

## 3. Repository structure and the build step

```
clients/haofe/                       Vercel Root Directory of the new project "haofe-site"
├── vercel.json                      from site-plan/skeleton/vercel.json (headers, cleanUrls, build)
├── .vercelignore                    allowlist: /*  !site  !data  !seo
├── data/products.json, menu.md      already here (data agent)
├── seo/head-meta.json, jsonld.json  already here (SEO agent)
└── site/
    ├── package.json                 { "type": "module", "scripts": { "build": "node build/build.mjs",
    │                                  "test": "node tests/site.test.mjs" }, "engines": { "node": "22.x" } }
    ├── site.config.json             { origin: "https://haofe.example", pages: { "/products": { publish: false }, … } }
    ├── data/branches.json           section 2.2
    ├── src/
    │   ├── partials.mjs             head(meta), header(page), footer(), bar(), orderSlip() (the phone receipt): template-literal functions
    │   ├── pages/                   index.mjs, products.mjs, branches.mjs, branch.mjs, business.mjs, about.mjs,
    │   │                            accessibility.mjs, privacy.mjs, notfound.mjs  (each: export render(data) => html)
    │   ├── css/  base.css (= promoted concepts/b.css), motion-hero.css, motion-scroll.css, motion-micro.css (ported),
    │   │         page.css (= skeleton/page.css), fonts.css
    │   └── js/   theme.js, site.js, runtime.js (= skeleton), motion/hero.js, scroll.js, micro.js (ported)
    ├── public/   fonts/*.woff2 + OFL-*.txt, img/ai/*.avif|webp (from concepts/assets/ai/r), img/logo/*.svg (svgo, perf P6),
    │             robots.txt, llms.txt (seo/), favicon
    ├── tools/promote.mjs            copies approved files from concepts/ and runs port-modules (section 3.2)
    ├── build/build.mjs              section 3.1
    ├── tests/site.test.mjs          the skeleton tests, pointed at dist/ (section 13)
    └── dist/                        build output, git-ignored, the Vercel Output Directory
```

### 3.1 What `build.mjs` does (about 250 lines, Node built-ins only)

1. Read `site.config.json`, `data/branches.json`, `../data/products.json` and `../seo/head-meta.json`. Validate them, for example `products.length === counts.products`.
2. For each page whose `publish` is true, call `render()`. The page is wrapped in `head(meta) + header + <main id="main" tabindex="-1">…</main> + footer + bar`. The inline boot script is copied **byte for byte** from `src/js/theme.js` between `/*! boot:start */` and `/*! boot:end */`, exactly as `skeleton/tools/csp-hash.mjs` does.
3. Fingerprint CSS and JS into `dist/assets/<name>.<sha256-8>.<ext>` and rewrite the references, so `/assets/*` can be cached as `immutable` (section 9.3). Fonts get a version in the file name (`rubik-400-700-heb.v1.woff2`).
4. Generate every `<picture>` from `manifest.json` (section 8) and emit the LQIP placeholders as a generated CSS file of classes instead of `style=""` attributes. Then `style-src-attr 'unsafe-inline'` can go.
5. Write `sitemap.xml` from the published, indexable pages (not 404). Copy `public/`.
6. **Fail the build** if any of these is true:
   - The ordering app's domain appears anywhere in `dist/` (a guard after the owner's decision of 24.10.2026; the skeleton test "guard: …" does the same check).
   - The sha256 of the boot snippet is not in `vercel.json`'s CSP.
   - Any of "לאישור", "[[חסר", `class="tbd"`, `data-live-href` or `style="` appears.
   - An internal `href` points to a page that was not written, or to an `#id` that does not exist.
   - An `<img>` has no `alt`, `width` or `height`.
   - A page has more or fewer than one `<h1>`.
   - `<html>` is missing `lang="he" dir="rtl"`.

**Why not a framework.** Ten pages, one data file, and one designer's CSS that already works. The duplication a build removes is three partials, the per-page `<head>` and the picture markup. A framework would add a dependency tree and its own conventions for CSS, images and inline scripts, and each of those would have to be bent back to the CSP and to the prototype's hooks. **Escape hatch:** if the build grows past about 400 lines, or Markdown pages become frequent, move to Eleventy. Vercel lists it as a preset ([Vercel docs](https://vercel.com/docs/builds/configure-a-build)), and the template-literal pages port to it as-is.

### 3.2 Promote, don't link

Production never reads `concepts/` at build time. `site/tools/promote.mjs` is run by a person when a design change is approved. It copies `b.css`, runs `port-modules.mjs` on `b-motion-*` (or copies them as they are once they declare `contract: 2`), copies `assets/ai/r/*` and the logos, and the result is committed. The live site then never changes because someone experimented in `concepts/`. The diff of the commit is the review.

---

## 4. Turning the prototype template into real pages

### 4.1 Mechanical conversion (the skeleton shows every row)

| In the prototype (template `#proto` in `b.html`) | On the site | Where in the skeleton |
|---|---|---|
| `<div class="proto pb" data-mode="light">` | `<html lang="he" dir="rtl" class="pb rm">`. Static `rm` = the calm, static page without JS. The boot script swaps it for `anim` or `rm` and sets `data-mode`. | `index.html` line 2 |
| `data-id="x"` / `data-for` / `data-controls` / `data-labelledby` (made unique by `Shell.ids`) | `id="x"` / `for` / `aria-controls` / `aria-labelledby` written in the HTML; the build checks uniqueness | all sections |
| `<a href="#" data-jump="boxes">` (`Shell.anchors` scrolls the frame) | `<a href="#boxes">` in-page, or `/products` across pages. `html { scroll-padding-top: 84px }` plus `scroll-padding-bottom` on phones (A11Y-02). `html.anim { scroll-behavior: smooth }`. | `page.css` |
| no `<main>`, no skip link (A11Y-10) | `<a class="skip" href="#main">` first in `<body>`, then `<main id="main" tabindex="-1">` around hero to branches | `index.html`, `page.css` |
| The order module (its `.when-soon` / `.when-live` pairs, `data-live-href` and b.js `orderSwitch` were removed from the prototype on 24.10.2026) | Ordering is by phone only. `#order` is the receipt "מזמינים בטלפון": the ordering line 1700-55-22-55 as a `tel:` link, "הסניפים: כתובות, טלפונים ושעות בהמשך העמוד", and "לסניפים" → `#visit`. No online-ordering state, no app link. | `index.html` `#order`; test "guard: …" |
| `<img src="assets/ai/plate.webp">` | `<picture>` with AVIF and WebP `srcset`/`sizes` and LQIP (section 8) | hero, 6 boxes |
| `<p class="hand">@haofe_bakery</p>` | `<bdi dir="ltr">@haofe_bakery</bdi>` (A11Y-09) | feed |
| `.ai-note` before the `<h1>` in DOM order (A11Y-21) | moved after `.in`; the CSS still pins it to the scene corner | hero |
| `target="_blank"` links | `<span class="sr">(נפתח בחלון חדש)</span>` (A11Y-15) | menu |
| bar "ניווט" goes to Netivot only (IA §10) | "סניפים" goes to `/branches` | bar |
| Branch cards with "לאישור" placeholders | only confirmed fields (section 2.2) | `#visit` |
| Sufganiyot flavours, "נמכרים לפי משקל", "כתמי התנור" in box copy | removed: no source (`data/menu.md` notes); names copied exactly from `products.json` | `#boxes` |
| Heebo and IBM Plex Mono in the font link (presentation page only, perf P5) | dropped | `fonts/fonts.css` |
| `style="--i:n"` on boxes | Unused: no CSS or JS reads `--i` (grep of `b-motion-*.css/js`, 24.10.2026). Drop it in the build. | kept in the skeleton for parity |

### 4.2 Container queries vs media queries: keep the container queries

- `b.css` (`.pb { container-type: inline-size }`, about line 111) and all three motion CSS files use `@container (min-width: 700px | 1000px)`. `b-motion-hero.js` decides "wide" with `root.offsetWidth >= WIDE_AT` (1000). With `<html>` as the container, the CSS width (the html content box) and `root.offsetWidth` are the same number, scrollbar excluded. A `@media (min-width: 1000px)` includes the scrollbar, so for window widths from 1000 to about 1015 px on Windows, CSS and JS would disagree.
- Verified in Chromium 153 (`scratchpad/agents4/arch/exp1.js`): `container-type: inline-size` on `<html>` or `<body>` leaves `position: fixed` (top 10 → 10 after scrolling 1000 px) and `position: sticky` working, and `@container` rules match.
- The one limit: an element cannot query itself. MDN: "An element's size container is the nearest ancestor with containment" ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_size_and_style_queries)). So the few rules that style `<html>` itself (scroll padding) use `@media` in `page.css`.
- The hero plate's `<source media="(min-width: 1000px)">` is a media query by necessity (the `<picture>` element has no container query). It is the same threshold within a scrollbar's width. Acceptable: both crops cover the scene.

### 4.3 Shell responsibilities on a page

| `shell.js` API | On the site |
|---|---|
| `Shell.setMode` / `themeButtons` | `theme.js` (`HaofeTheme.set`). `runtime.js` defines `window.Shell.setMode` → `HaofeTheme.set`, because `b-motion-micro.js` calls it inside its view transition. |
| `Shell.menu` | `site.js` `menu()`, the same behaviour plus A11Y-03 (closes on focusout; Esc from anywhere). Tested. |
| `Shell.anchors`, `Shell.ids` | gone (real links and ids) |
| `Shell.reveal` (`.rv-in`) | `runtime.js` `reveal()` with `root: null`. No CSS uses `.rv-in` today; kept only because `b.css`'s hook list promises it. |
| `PROTO.init` (`b.js`) | `site.js`: boxes and the ticker pause. Runs once on the real DOM and is not rebuilt when the modules reboot. |
| frames, overlay, `#rm`, replay | presentation only, dropped |

### 4.4 Text pages (accessibility, privacy, 404)

Same header, footer and bar. The body is `<main class="doc"><div class="in">`, with headings in `--display` and body copy at 60ch. Legal pages have no motion modules (do not load the `b-motion-*` files). `theme.js` and `site.js` still load.

---

## 5. Theme handling

**Requirement → implementation** (`skeleton/theme.js`; the boot part is inline in `index.html`):

| Requirement | How |
|---|---|
| Light on a first visit | The boot script reads only `localStorage["haofe:theme"]`. **No `prefers-color-scheme`.** `page.css` sets `color-scheme` from `data-mode`, so form controls and scrollbars follow the site, not the OS. There is deliberately no `<meta name="color-scheme" content="light dark">`: it would let the browser paint a dark canvas before the CSS on dark-OS phones. |
| No flash of the wrong theme | One inline `<script>` placed right after `<meta charset>`, before any stylesheet. It sets `data-mode` and `anim`/`rm` on `<html>` (the `.pb` root), so `b.css`'s `.pb[data-mode="dark"]` tokens apply to the first frame. Tested 3 ways: (1) all external JS blocked → saved dark still applied; (2) `data-mode` is already `dark` when `<body>` is inserted (MutationObserver probe); (3) `theme.js` delayed 2.5 s → first paint is dark (header luminance 26 of 255). |
| A toggle | `[data-theme-toggle]` button, as in the template. `aria-label="מצב כהה"` + `aria-pressed`. A delegated click listener on `document` in the **bubble** phase. On phone layouts `b-motion-micro` captures the click on `<html>`, stops it, and switches inside a document view transition by calling `Shell.setMode`, which `runtime.js` routes to `HaofeTheme.set`, so the choice is still saved. Tested: exactly 1 `document.startViewTransition` call and `localStorage = "dark"`. |
| Saved choice, try/catch | `load()` and `store()` in try/catch. With `window.localStorage` throwing a `SecurityError` on access, the page stays light, the toggle works for the visit, nothing is saved, and there are no errors. Tested. |
| Other tabs, back/forward cache | A `storage` event updates other tabs (tested). On `pageshow` with `persisted`, the saved choice is read again. |
| Privacy | One per-device preference that never leaves the browser. Publish the D3 variant of the privacy policy paragraph (`legal/privacy-policy.md` line 68, with the bracket filled with "מצב התצוגה, בהיר או כהה"). |
| CSP | The boot snippet's sha256 is the only script hash. Edit it in `theme.js`, then run `node tools/csp-hash.mjs --fix` (the site build will refuse a mismatch). |

The boot snippet is also the place for the page-wide motion pause, if A11Y-07 option (a) is chosen. It would be one more key, `haofe:motion = "paused"`, read the same way, adding a `.still` class before first paint. That changes the hash.

---

## 6. Motion modules on a real page

### 6.1 What breaks when `ctx.scroller` is the document (measured, Chromium 153, `arch/exp1.js`)

| Use in the modules | With a scrolling `<div class="vp">` (prototype) | With the window scrolling | Conclusion |
|---|---|---|---|
| `new IntersectionObserver(cb, { root: X })` | `X = vp` | `X = document.documentElement`: an element 3000 px down reports **`isIntersecting: true`**. `X = null` → `false` (correct). `X = document` → `false` (correct). | `ioRoot = null` |
| `X.addEventListener('scroll', …)` | `X = vp` | `<html>` gets **0** events; `document` and `window` get 1 each | `scrollEvents = window` |
| `new ScrollTimeline({ source: X })` | `vp` | `document.scrollingElement` / `<html>`: works (20.1 % after a 500 px scroll). `document`: **TypeError**. `body`: `currentTime` null. | `scroller = document.scrollingElement` |
| `X.getBoundingClientRect()` as "the visible area" | vp rect | `<html>` rect has `top = -scrollY`, `height` = whole document. Every "content y + offset = screen y" calculation shifts by the scroll, and the frame-scale formula `vr.height / X.offsetHeight` stops being the scale. | `view()` returns `{ top: 0, left: 0, width: clientWidth, height: clientHeight, scale: 1 }` |
| `X.scrollTop`, `scrollHeight`, `clientHeight`, `clientWidth`, `closest()`, `ResizeObserver.observe(X)` | vp | `document.scrollingElement` works (`clientHeight` = viewport height 600, `offsetHeight` = document 3088) | no change |
| `X.startViewTransition` (scoped view transition) | vp | `Element.prototype.startViewTransition` exists in Chromium 153, but a page should transition the document | `vtHost = document` |
| ResizeObserver on the scroller to catch viewport height changes | vp resizes with its frame | `<html>` does not resize when only the viewport height changes (a phone's address bar) | add a `window` `resize` listener, page only |

### 6.2 Contract 2: what `ctx` holds

```js
ctx = {
  contract: 2, page: true|false, frame: 'page'|'desktop'|'phone'|'full', reduced: boolean,
  scroller,      // element: scroll position, sizes, ScrollTimeline source, ResizeObserver, closest()
  ioRoot,        // IntersectionObserver root (page: null)
  scrollEvents,  // target for 'scroll' listeners (page: window)
  vtHost,        // startViewTransition host (page: document)
  view()         // { top, left, width, height, scale } of the visible scroll area, client px
}
```

On a page, `root` = `document.documentElement` (`html.pb`). A module opts in by writing `contract: 2` next to its `name`. **`shell.js` should pass the same keys** so the modules can drop their fallbacks. This is a recommended change for the shell owner. I am read-only there. In `build()`:

```js
var ctx = { contract: 2, page: false, reduced: reduced, frame: frame, scroller: vp, ioRoot: vp, scrollEvents: vp, vtHost: vp,
  view: function () { var r = vp.getBoundingClientRect(); return { top: r.top, left: r.left, width: r.width, height: r.height,
    scale: (r.height / (vp.offsetHeight || r.height || 1)) || 1 }; } };
```

### 6.3 The exact changes, per module

`skeleton/tools/port-modules.mjs` applies these to the live files and fails, naming the rule, if an anchor disappears. Line numbers are from the live files at my last run and will drift; the anchors are exact.

**All three modules (common rules 1-5)**

1. Right after `var scroller = ctx.scroller;` (hero.js ~177) or `var scroller = ctx && ctx.scroller;` (scroll.js ~83, micro.js ~75), insert:
   ```js
   var ioRoot = ctx && 'ioRoot' in ctx ? ctx.ioRoot : scroller;
   var scrollEvents = (ctx && ctx.scrollEvents) || scroller;
   var vtHost = (ctx && ctx.vtHost) || scroller;
   var view = ctx && typeof ctx.view === 'function' ? ctx.view : function () { /* scroller rect + frame scale */ };
   ```
2. Every `{ root: scroller` → `{ root: ioRoot`.
3. Every `on(scroller, 'scroll'` / `listen(scroller, 'scroll'` → `(scrollEvents, 'scroll'`.
4. Every `scroller.getBoundingClientRect()` → `view()`, and the frame-scale formula `(vr.height / (scroller.offsetHeight || vr.height || 1)) || 1` → `vr.scale`.
5. `name: 'b-…',` → add `contract: 2,` on the next line.

**`b-motion-hero.js`**
- Rule 2: the visibility observer, ~line 517 `}, { root: scroller, rootMargin: '25% 0px', threshold: 0 });`
- Rule 3: ~line 476 `cleanups.push(listen(scroller, 'scroll', …`
- Unchanged and correct: `new window.ScrollTimeline({ source: scroller })` (~378), `scroller.scrollTop`, `scrollHeight - clientHeight`, `scroller.closest('[inert]')`.
- **H6** after `[root, hero, scroller].forEach(function (el) { ro.observe(el); });` (~451): `if (ctx.page) cleanups.push(listen(window, 'resize', /* rAF-queued */ measure, { passive: true }));`. Otherwise `geo.max`, the end of the scroll-depth timeline, goes stale when the phone's address bar collapses.

**`b-motion-scroll.js`**
- Rule 2, six observers: entrance trigger ~581 (`root: scroller,` multi-line), ~601, ticker ~640, product drift fallback ~697, image warm-up ~770 (`rootMargin: '100% 0px 100% 0px'`), drift ~778 (`rootMargin: '15% 0px 15% 0px'`).
- Rule 3, three listeners: entrance sweep ~605, ticker surge ~744, drift fallback ~754.
- Rule 4, three places: `geo()` ~147-148 (header and bar insets, and `vr.top` in the leap's `toScreen`), the sweep ~596 (`var top = scroller.getBoundingClientRect().top` would be `-scrollY`, so jumped-past content would **stay hidden**), and `pfMeasure()` ~665 (`it.top = (r.top - vr.top)/k + st` would count the scroll twice).
- **S7** ~353 `root.appendChild(layer);` → `(root.tagName === 'HTML' ? document.body : root).appendChild(layer);` keeps the flying copies inside `<body>`. A `<div>` after `<body>` renders, but it is not valid HTML structure.
- **S6** before `root.classList.add('sx');` (~790): `if (ctx.page) on(window, 'resize', function () { if (pf) { pfMeasure(); pfSync(); } if (tick && measureRange) measureRange(); }, { passive: true });`
- Unchanged: `new ScrollTimeline({ source: scroller })` (~730), and `observe(…, { threshold: 0 }).observe(scroller)` (~786). The latter always intersects on a page, which is correct, because the page is the mount.

**`b-motion-micro.js`**
- Rule 2: the slip observer ~650.
- Rule 3: the `.mi-scrolling` listener ~159 and the header-lift fallback ~616.
- Rule 4: the tilt measure ~254-255 (`var vr = view(); scale = vr.scale;`).
- **M6** ~520 and ~526 `scroller.startViewTransition` → `vtHost.startViewTransition`, so on a page the swap covers the whole document.
- Unchanged: `scroller.clientWidth < 700` (~489) and `vpRO.observe(scroller)` (~554) work with `<html>`. `pointerFx = ctx.frame !== 'phone'` is `true` with `'page'`, and the hover effects are still gated by `(hover: hover) and (pointer: fine)`.

**`b-motion-micro.css`**
- **C7** ~lines 119-122: each `:has(> .pb.mi-vt)::view-transition-X(root)` gets a second selector `, :root.pb.mi-vt::view-transition-X(root)`. On a page `.pb` is the root, which has no parent element for `:has()` to match from.

`b-motion-hero.css` and `b-motion-scroll.css` need no change. `timeline-scope` on `.pb.anim` and the boxes' `view-timeline` resolve to the root scroller by themselves.

### 6.4 The runtime adapter (`skeleton/runtime.js`)

- Loaded with `defer` after the module files. It boots at once, because the DOM is parsed and the modules have registered.
- It builds ctx (section 6.2) and runs each `ProtoModules` entry in order. An entry without `init` or without `contract >= 2` is **skipped with a `console.warn`** (tested: 3 skipped, the page still works). A throwing module is logged and skipped (the same rule as `shell.js`).
- When `prefers-reduced-motion` changes, it runs every cleanup (newest first), sets `anim`/`rm`, and boots again. Tested: boot 1 → 2 (clean: no `.sx`, `.mi`, `.b-motes` or `.b-split` left) → 3.
- Status for tests: `window.__haofeRuntime = { boots, ran, skipped, failed, reduced }`.

### 6.5 Load order and first paint

```html
<head>
  <meta charset="utf-8">
  <script>/* boot: data-mode, anim|rm, LQIP removal (inline, hashed) */</script>
  …preload 2 fonts, fonts.css, base.css, motion-hero.css, motion-scroll.css, motion-micro.css, page.css…
  <script defer src="theme.js"></script> <script defer src="site.js"></script>
  <script defer src="motion/hero.js"></script> <script defer src="motion/scroll.js"></script> <script defer src="motion/micro.js"></script>
  <script defer src="runtime.js"></script>
</head>
```

- The hero opening is CSS keyed on `.pb.anim`, and the boot sets `.anim` before the first paint, so the opening starts with the first frame. It does not wait for JS.
- The scroll module's waiting states (`.pb.sx [data-rv] { opacity: 0 }`) apply only after it runs. Content painted before that is visible. Content in view at boot is finished at once, through the module's own "already on screen" rule. Content below the fold is never painted visible first. So there is no hide-then-show flash for content below the fold. A brief one is possible for a `[data-rv]` already on screen if the browser paints between parsing and the deferred scripts. MISSING: not measured on a throttled phone. Checklist step 16 measures it.
- The perf agent's P2 must be fixed before launch. The plate's opacity fade makes the hero wall invisible until four images decode, so the LCP moves to about 3-4 s on mobile (`audit/perf/report.md` P2).

### 6.6 Evidence: ported vs unported on the same page (`arch/unported.mjs`, 1280×820)

| | entrances already started at load, before any scroll | ticker idles off screen | hero idles off screen | errors |
|---|---|---|---|---|
| unported (guard bypassed) | **14 of 17** (all the products "land" unseen) | no | no | 0 |
| ported (contract 2) | 0 of 17 (6 boxes waiting) | yes | yes | 0 |

### 6.7 Findings for the module and shell owners (read-only for me)

1. `shell.css` line 55 `[hidden] { display: none !important; }` beats `b-motion-micro.css` `.pb .menu.mi-closing[hidden] { display: grid; }`, so in the prototype the menu's fold-away animation never paints. The skeleton's `page.css` uses `[hidden]:not(.mi-closing) { display: none !important; }` instead.
2. Adopt contract 2 upstream: section 6.3, plus `contract: 2` and the `shell.js` ctx keys (section 6.2). Then `promote.mjs` copies the files unchanged and the port script can be retired.
3. A11Y-07: the wheat sway and the flour dust move for more than 5 s with no control (the "soon" dot left the page with the online-ordering state, 24.10.2026). Choose option (a) or (b) before launch.

---

## 7. Accessibility items that are architecture, not styling

The skeleton covers A11Y-02 (scroll padding; unsticking the bars at `max-height: 500px`), A11Y-03 (menu focus-out), A11Y-08 (closed details get `visibility: hidden`), A11Y-09 (`bdi`), A11Y-10 (skip link, `main`), A11Y-15 (new-window text), A11Y-21 (AI note order) and A11Y-22 (real anchors, `lang`/`dir`). Still open, for the CSS owner: A11Y-01 and -06 (focus ring colour, `--focus` token), A11Y-04 (`.b2b-copy .hand` contrast: `--on-btn-accent` token), A11Y-05 (hero subtitle over the photo), A11Y-07 (motion control). The fixes are in `audit/a11y/README.md` and `audit/a11y/fix-pack.css`.

---

## 8. Image delivery

- **Source of truth:** `concepts/assets/ai/r/manifest.json` gives, for each image, its widths, formats, intrinsic size and LQIP. `promote.mjs` copies `r/*.avif|webp` to `site/public/img/ai/`. The build's `picture(name, { cls, alt, sizes, loading, fetchpriority })` helper writes `<source type="image/avif">` before `<img srcset=webp>` with `width`/`height` from the manifest. The art-directed hero plate (`plate` ≥1000 px, `plate-m` below) uses `media`.
- **`sizes` per slot:** copy from `audit/perf/recommended-markup.html`. The perf agent's `tools/sizes.js` checked them at 14 widths. Products: `(min-width: 1240px) 306px, (min-width: 1000px) calc(28vw - 40px), (min-width: 700px) calc(42vw - 27px), calc(84vw - 35px)`. Bag: `(min-width: 1000px) 25vw, 46vw`. Plate: `100vw`. The wheat's `842px` waits for the P4 fix (it is drawn squeezed because `.sc-wheat` has no CSS height).
- **Priorities:** the plate gets `fetchpriority="high"` and is not lazy. Bag and wheat are eager, `decoding="async"`. Products are `loading="lazy"`; `b-motion-scroll` switches them to eager and decodes them one screen ahead, so a leap never waits for a decode. The dark-mode header logo is `loading="lazy"` (perf P6: otherwise it downloads in light mode).
- **LQIP:** in the skeleton, `data-lqip` + `style="--lqip:url(data:…)"`. The boot script removes `data-lqip` on `load`, in the capture phase. In the build, emit `img-lqip.css` with one class per image, which removes every `style=""` attribute from the HTML and lets the CSP drop `style-src-attr 'unsafe-inline'`.
- **The "הדמיית AI" rule:** every AI image keeps its visible label (`.ai-note`, `.ai-tag`). When real photography arrives, re-run `audit/perf/tools/gen.py` (same SSIM ladder), then `promote.mjs`, and remove the labels for the replaced images only.
- **Logos:** svgo with `audit/perf/tools/svgo.config.js` after the designer checks them (P6: badge 58.2 → 19.9 KB).
- **Fonts:** `skeleton/fonts/` holds the 4 subsets from perf option B (`SecularOne-hebp`, `Rubik-400-700-heb`, `PlaypenSansHebrew-400-hebp`, `-600-hebp`) and their OFL licences. Preload Secular One and Rubik only (perf §7: without the Rubik preload, the LCP jumps to the wheat at about 5 s).

---

## 9. Hosting, CSP and headers

### 9.1 A separate Vercel project, not a path in the studio site

- The studio project serves the repo root, and its `.vercelignore` lists `clients`, so nothing under `clients/` is deployed or served there. Its CSP is `script-src 'self'` (no hash) and `font-src 'self'`. The bakery's inline boot would be blocked. A path on the studio domain would also share an origin (and `localStorage`) with the studio, and would give the bakery no domain of its own for local SEO.
- **New project "haofe-site"**, imported from the same Git repo. **Root Directory = `clients/haofe`.** Vercel creates one project per directory ([monorepos](https://vercel.com/docs/monorepos)). With a Root Directory, "your app will not be able to access files outside of that directory" ([configure a build](https://vercel.com/docs/builds/configure-a-build)). That is why the root is `clients/haofe` and not `clients/haofe/site`: the build reads `data/` and `seo/`.
- **`clients/haofe/.vercelignore` is required.** "If there is no .vercelignore to be found at the project level, Vercel will use the .vercelignore at the root level" ([.vercelignore](https://vercel.com/docs/deployments/vercel-ignore)), and the root one ignores `clients`. Use an allowlist:
  ```
  /*
  !site
  !data
  !seo
  !vercel.json
  ```
  `concepts/`, `audit/`, `legal/` and `research/` stay out of the upload. Only `site/dist` is served in any case ("Only the contents of this Output Directory will be served").
- **Build settings:** Framework Preset "Other". The build command and output come from `vercel.json` (`node site/build/build.mjs`, `site/dist`). Node 22.
- **Builds per commit:** the automatic "skip unaffected projects" needs npm/yarn/pnpm/Bun workspaces ([monorepos](https://vercel.com/docs/monorepos)), which this repo does not have. Use the **Ignored Build Step**: `git diff --quiet HEAD^ HEAD -- .` (exit 0 = skip) in the bakery project, so studio commits do not rebuild it. Optionally do the same in the studio project for commits that touch only `clients/`.
- **Domain:** MISSING. The marketing domain is not decided. The SEO plan uses the placeholder `https://haofe.example`. Until a domain is chosen, use the `*.vercel.app` URL with password protection or noindex.

### 9.2 Content-Security-Policy (in `skeleton/vercel.json`, tested)

```
default-src 'self'; script-src 'self' 'sha256-JlKEa1zbkwouf3M2XVeqKqMeshmacDoo4DOZ37W6xjQ='; style-src 'self';
style-src-attr 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; manifest-src 'self';
media-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
```

| Directive | Why this value |
|---|---|
| `script-src 'self' 'sha256-…'` | The only inline script is the boot. JSON-LD (`<script type="application/ld+json">`) is a data block and was not blocked (0 violations with it on the page). No third-party scripts (legal checklist C4). |
| `style-src 'self'` | Fonts are self-hosted: no Google stylesheet. |
| `style-src-attr 'unsafe-inline'` | Temporary, for the LQIP `style="--lqip:…"` (and the unused `--i`). JS writes through `element.style.prop` and Web Animations, which `style-src-attr` does not block. MDN: "Style properties that are set directly on the element's style property will not be blocked" ([MDN style-src-attr](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/style-src-attr)). **Remove it** once the build emits LQIP as CSS (section 8). |
| `img-src 'self' data:` | `data:` is for `b.css`'s `.paper` SVG backgrounds and the LQIP. The hero dust is drawn on a canvas. |
| `connect-src 'self'` | Nothing fetches at runtime: the menu is rendered at build time. |
| `frame-ancestors 'none'` + `X-Frame-Options: DENY` | Nothing embeds the site. Google Maps, Instagram and TikTok are plain links: no iframes and no third-party cookies (privacy policy). |
| `upgrade-insecure-requests` | Production is HTTPS. `tools/serve.mjs` strips it on `http://127.0.0.1`. |
| Not adopted: Trusted Types | `b-motion-hero.js` restores the headline with `h1.innerHTML = original` in its cleanup. Under `require-trusted-types-for 'script'` that throws. |

Workflow: edit the boot in `theme.js` → `node tools/csp-hash.mjs --fix` → commit. The build refuses a mismatch. The skeleton test "CSP is really enforced" adds one space to the inline script and expects a `script-src-elem` violation, and gets one.

### 9.3 Other headers (`skeleton/vercel.json`)

- On every route: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()` and `Cross-Origin-Opener-Policy: same-origin`. These are the studio's own values from the repo-root `vercel.json`.
- `Cache-Control: public, max-age=31536000, immutable` on `/assets/(.*)` (fingerprinted) and `/fonts/(.*)` (versioned names). HTML keeps Vercel's default revalidation.
- **Given by Vercel, not set by us:** HSTS `max-age=63072000`, and `x-robots-tag: noindex` on preview and outdated production deployments ([Vercel response headers](https://vercel.com/docs/headers/response-headers)). Do not add HSTS `preload` until the domain is final.
- `cleanUrls: true` (`/about.html` → 308 to `/about`) and `trailingSlash: false` (`/about/` → 308 to `/about`) ([vercel.json](https://vercel.com/docs/project-configuration/vercel-json)). The SEO plan says "301". These are 308s, also permanent. Uppercase URLs are not redirected; they 404. No middleware just for that.

### 9.4 Ordering launch day: cancelled (24.10.2026)

The owner removed the ordering app from the site's scope. The site has no `orderApp` switch, no `/order` page or redirect, and nothing changes on the site when the app launches. `vercel.json` keeps `"redirects": []`, and its `/order` `X-Robots-Tag` block was removed.

---

## 10. Testing

- `skeleton/tests/skeleton.test.mjs` (Playwright, Chromium) starts `tools/serve.mjs`. That server serves `clients/haofe/` with `vercel.json`'s headers and ports the motion modules from the live `concepts/` files on each request. Result on 24.10.2026: **23 of 23 pass** (`tests/out/results.json`, plus screenshots).
- The guard test checks every text file of the skeleton and every text response the page loads for the ordering app's domain, checks the markup for the old online-order hooks (`.when-soon`, `.when-live`, `.chip-soon`, `.btn-soon`, `data-order`, `data-live-href`, `href="/order"`), and checks that `#order` is the phone receipt. When `site/dist/` exists it scans that folder too.
- The site keeps the same suite, pointed at `dist/`, and adds: one h1 per page, link integrity, an axe run with `scratchpad/agents4/a11y/axe-run.js` (the a11y agent's harness), and Firefox and WebKit projects (MISSING today).

---

## 11. Missing data that blocks pages (do not fill in)

From the IA §9, the SEO plan and research: phones for Sderot and Kiryat Gat (Kiryat Gat has three conflicting numbers); opening hours for every branch (four sources disagree); kashrut per branch from certificates (no Badatz record for the Netivot store); owner approval of the product list and the per-branch ranges; the story text; the business wording and a business contact; the legal entity name and company number and the accessibility coordinator (regulation 35ה); the marketing domain; whether the header's "הזמנה טלפונית" should dial 1700-55-22-55 (IA decision 1); real photography and feed-photo permission.

---

## 12. Ordered build checklist, with effort estimates

Estimates are mine, in hours, for one front-end developer who knows this code. Owner and legal tasks are not counted.

| # | Step | Output | Est. |
|---|---|---|---|
| 1 | Create the Vercel project "haofe-site": Root Directory `clients/haofe`, preset Other, Node 22, Ignored Build Step. Add `clients/haofe/.vercelignore` (allowlist) and `clients/haofe/vercel.json` (from the skeleton). Put a password on previews. | a preview URL serving a placeholder `dist/index.html` | 1 |
| 2 | Scaffold `site/` (section 3), `site.config.json`, `data/branches.json` (confirmed fields only) | folders, config | 1.5 |
| 3 | `tools/promote.mjs`: copy `b.css` and `assets/ai/r` and the logos, run `port-modules.mjs`, copy the skeleton's `theme.js`, `site.js`, `runtime.js`, `page.css` and fonts | `site/src`, `site/public` committed | 2.5 |
| 4 | `build.mjs` core: partials, page loop, head from `head-meta.json`, boot inlining, fingerprinting, `public/` copy, sitemap | `dist/` for `/` | 7 |
| 5 | Build checks (section 3.1, step 6) + the CSP hash assert | the build fails on violations | 3 |
| 6 | Home page: move the skeleton markup into `pages/index.mjs` + partials; `picture()` helper from the manifest; LQIP as CSS, then drop `style-src-attr` | `/` matching the skeleton | 4 |
| 7 | `/products` from `products.json` (section 2.1), category chips, `abbr` for תפו״א | `/products` (unpublished until approved) | 4 |
| 8 | `/branches` hub from `branches.json`; JSON-LD from `seo/jsonld.json`; `/branches/netivot` | 2 pages | 4 |
| 9 | 404 and the text-page template (`/order` cancelled on 24.10.2026) | 1 page | 2 (not re-estimated after the `/order` cut) |
| 10 | `/accessibility`, `/privacy` from `legal/*.md` after the owner and lawyer resolve the brackets | 2 pages | 3 |
| 11 | `/business`, `/about` once their copy is approved; `/branches/sderot` and `/kiryat-gat` once the phones are confirmed | up to 4 pages | 2 each |
| 12 | Accessibility fixes not yet in the skeleton: A11Y-01/-06 focus token, A11Y-04 token, A11Y-05 hero scrim, A11Y-07 motion control (needs a boot change → new hash) | CSS and JS edits | 4 |
| 13 | Perf fixes P2 (plate fade), P4 (wheat height), P6 (svgo). P2 and P4 are motion and CSS owner changes, then a promote | LCP on the wall | 2 |
| 14 | Port the skeleton tests to `dist/` + an axe run + link checks | `site/tests` | 4 |
| 15 | Cross-browser: run the suite on Firefox and WebKit (Playwright projects); fix any difference in container queries, view transitions or ScrollTimeline fallbacks | green on 3 engines | 3 |
| 16 | Mobile perf pass (throttled CDP, as in `audit/perf/tools/measure.js`): LCP, CLS, and the possible first-paint flash in section 6.5 | numbers in the PR | 2 |
| 17 | Launch: domain, apex/www redirect, Search Console and Bing, sitemap submit (SEO T4, T16) | live | 2 |
| | **Total (pages from steps 1-10 and 12-17; step 11 adds 2 per page)** | | **about 49 h + 2 h per gated page** |

Order of work: steps 1-6 make a deployable home page; 7-10 add the pages that have content; 12-16 make it launch-ready; 11 follows the owner's approvals.

---

## 13. Files in this folder

| Path | What it is |
|---|---|
| `site-plan/plan.md` | this file |
| `skeleton/index.html` | The home page as a real page. `html.pb` root, inline boot, `<picture>` markup (generated from the perf agent's recommended markup), the phone-order receipt (as `concepts/b.html` `.order-sec`), only confirmed branch fields. Loads `b.css` and the motion files from `../../concepts/`. |
| `skeleton/theme.js` | The boot snippet (between markers; copied inline) and the toggle (`window.HaofeTheme`) |
| `skeleton/runtime.js` | The page adapter: ctx contract 2, the `Shell` shim, the contract guard, reboot on a reduced-motion change |
| `skeleton/site.js` | `b.js` boxes and ticker + `Shell.menu`, with the A11Y-03 fix |
| `skeleton/page.css` | Page-level rules: `color-scheme`, `[hidden]`, scroll padding, skip link, `<picture>`, A11Y-08, `.sr` |
| `skeleton/fonts/` | 4 woff2 subsets (perf option B) + 3 OFL licences + `fonts.css` |
| `skeleton/vercel.json` | The proposed production config: CSP with the boot hash, headers, cleanUrls, trailingSlash |
| `skeleton/tools/port-modules.mjs` | Applies section 6.3 to the live `b-motion-*` files; `--check` lists every rule and its match count |
| `skeleton/tools/serve.mjs` | Dev server: `clients/haofe/` + `vercel.json` headers + modules ported on the fly. `node tools/serve.mjs`, then open `/site-plan/skeleton/` |
| `skeleton/tools/csp-hash.mjs` | Prints and checks the boot hash; `--fix` syncs `index.html` and `vercel.json` |
| `skeleton/tests/skeleton.test.mjs` | 23 Playwright cases; `node tests/skeleton.test.mjs`. Output in `tests/out/`. |

Scratch evidence (not deliverables): `scratchpad/agents4/arch/exp1.js` (the browser facts in section 6.1), `arch/unported.mjs` (section 6.6), `arch/gen-index.py` + `index.tpl.html` (how `index.html` was assembled), `archsnap/` (module snapshot).
