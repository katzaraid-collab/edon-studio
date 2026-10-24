# Alt-text review: every image in concepts/b.html

Reviewed 2026-10-24 by the SEO step. File: `/home/user/edon-studio/clients/haofe/concepts/b.html` (read-only; nothing in `concepts/` was edited).

**How I checked:**
- I rendered b.html with Playwright and opened the full-screen prototype (`[data-full]`) in light and dark mode. I then scrolled it to the end so lazy and JS-created images load, and listed every `<img>`, `[role="img"]`, exposed `<svg>`, `<canvas>` and CSS background image. Script: `/tmp/claude-0/-home-user-edon-studio/39250604-ba72-5066-b62c-771f07ec61a3/scratchpad/agents4/seo/inventory.js`, output `inventory.json` next to it.
- I looked at each AI render myself (contact sheet `ai-sheet.png` in the same folder) to check that the alt describes what the picture actually shows.

**Count:** the page has no images outside the prototype. The prototype `<template id="proto">` holds 13 `<img>`, 3 `role="img"` placeholders and 16 inline SVG icons. Two more images come from JS: one canvas (`b-motion-hero.js` line 217) and the flying product copies (`b-motion-scroll.js` line 431). shell.js mounts the template 4 times (desktop frame, two phone frames, full screen), so the DOM shows 52 `<img>`, but every copy is identical. Light and dark give the same result, except which header logo is visible.

**Verdict:**
- **Wrong alt (2):** #9 says "ג׳בטה", but the render shows a round country loaf. #8 names a "צמה ירושלמית" that the picture can't prove.
- **Could describe more (3):** #7, #10 and #12.
- **Correct as is:** everything else, including all the decorative `alt=""` images.
- **Missing for production:** a favicon set, an og:image, and a hosted logo file for the JSON-LD.

## 1. `<img>` elements (inside `<template id="proto">`)

| # | b.html line · selector | File | Current alt | Verdict | Exact change (prototype) | For production with real photos |
|---|---|---|---|---|---|---|
| 1 | 183 · `.hd .mark .mark-logo img.for-light` | `assets/logo/haofe-logo-clean.svg` | `""` | Correct. The parent `<a class="mark">` already has the name: `aria-label="האופה, בוטיק לחם. לראש העמוד"` plus visible `<b>האופה</b>`. | None | Keep `alt=""`. Point the link to `href="/"` and set `aria-label="האופה - בוטיק לחם, לדף הבית"`. The visible word "האופה" stays at the start of the name, so it still matches what users see. |
| 2 | 183 · `.mark-logo img.for-dark` | `assets/logo/haofe-logo-mono-cream.svg` | `""` | Correct. Same link as #1. Only one of the two logos shows at a time. | None | Same as #1. Add `loading="lazy"` as perf `recommended-markup.html` line 112 says. |
| 3 | 216 · `.scene .sc-plate` | `assets/ai/plate.webp` | `""` | Correct. The scene is `aria-hidden="true"` and the AI disclosure is real text (`.ai-note`). | None | Keep `alt=""`: a wall and a counter carry no information. Use perf's `srcset` markup. Give the real photo a descriptive ASCII file name, e.g. `/images/hero-counter.webp`. |
| 4 | 221 · `.sc-bag .sc-bag-img` | `assets/ai/bag.webp` | `""` | Correct for an AI render. It shows a plain kraft bag with a baguette, a round flatbread and a challah. | None | **One change:** if a real photo of an actual האופה bag replaces it, take that one image out of the `aria-hidden` scene and describe only what the photo shows, e.g. `alt="שקית נייר של האופה עם באגט, פרנה וחלה"`. It becomes the page's key brand image for Google Images and AI readers. While it is a render, keep `alt=""`. |
| 5 | 222 · `.sc-bag .sc-sticker` | `assets/logo/haofe-logo-badge.svg` | `""` | Correct. It is decoration on the bag, and the brand is named in the header and (after plan.md §5.1) in the H1. | None | Keep `alt=""`. |
| 6 | 225 · `.sc-front .sc-wheat` | `assets/ai/wheat.webp` | `""` | Correct (decorative). | None | Keep `alt=""`. |
| 7 | 267 · `.box .shot img.prod` (frena) | `assets/ai/frena.webp` | `פרנה, הדמיית AI` | Accurate. It could say more: the render shows two frena breads with dark oven spots and a flour dusting. | `alt="שתי פרנות עם כתמי צריבה מהתנור, הדמיית AI"` | Describe the real photo, e.g. `alt="פרנה של האופה, [what the photo shows]"`. Drop "הדמיית AI". |
| 8 | 272 · `.box .shot img.prod` (challah) | `assets/ai/challah.webp` | `חלה וצמה ירושלמית, הדמיית AI` | **Fix.** The render shows two braided challahs, one of them topped with sesame. Nothing in a render proves either one is a "צמה ירושלמית" (a real product in the app's catalogue). The alt names a product the picture can't show. | `alt="שתי חלות קלועות, אחת מהן עם שומשום, הדמיית AI"` | Name the product only if the photo really is that product, e.g. `alt="צמה ירושלמית של האופה"`. |
| 9 | 277 · `.box .shot img.prod` (baguette) | `assets/ai/baguette.webp` | `באגטים וג׳בטה, הדמיית AI` | **Fix: wrong.** The render shows two baguettes lying across a round, floured country loaf. There is no ciabatta. | `alt="שני באגטים על כיכר לחם כפרי, הדמיית AI"` | Describe the real photo. |
| 10 | 282 · `.box .shot img.prod` (dairy) | `assets/ai/dairy.webp` | `בורקס גבינה וגביניות, הדמיית AI` | Acceptable. A render can't show what is inside the bourekas. Visually: sesame-topped triangle bourekas and round pastries with a white filling. | Optional, more exact: `alt="בורקס משולשים עם שומשום ומאפים עגולים במילוי גבינה, הדמיית AI"` | Describe the real photo. The box heading already says "חלבי", so the alt doesn't need to repeat it. |
| 11 | 287 · `.box .shot img.prod` (rugelach) | `assets/ai/rugelach.webp` | `רוגלאך וקוראסון שוקולד, הדמיית AI` | Correct. The render shows chocolate rugelach and chocolate-filled croissants. | None | Describe the real photo. |
| 12 | 292 · `.box .shot img.prod` (sufganiyot) | `assets/ai/sufganiyot.webp` | `סופגניות, הדמיית AI` | Accurate. It could say more: four sufganiyot with a cream swirl, a chocolate drizzle and powdered sugar. That matches the box text "שוקולד, קרם ואבקת סוכר". | `alt="ארבע סופגניות עם קצפת, זילוף שוקולד ואבקת סוכר, הדמיית AI"` | Describe the real photo. |
| 13 | 303 · `.order-sec .slip img.logo-s` | `assets/logo/haofe-logo-badge.svg` | `""` | Correct (decorative, next to the H2). **Removed from b.html on 24.10.2026:** the order module is now the phone receipt "מזמינים בטלפון", with no badge. | None | Nothing to do. |

**Rules for the product alts above:**
- **The AI note stays in the alt.** "הדמיית AI" at the end lets screen-reader users get the disclosure that sighted users see on `.ai-tag`. `.ai-tag` is `aria-hidden`, so without it in the alt they would miss it.
- **Name only what the picture shows.** Don't put a product name in the alt unless the image shows that product (this is why #8 and #9 fail).
- **No keyword stuffing.** Don't add the brand name or a city to every product alt. Repeated keywords in alt text are a spam signal, and they make screen readers read the same words over and over.

## 2. Non-`<img>` images

| # | Where | What | Current | Verdict | Change |
|---|---|---|---|---|---|
| 14 | b.html 334 · `.feed .pola .ph.ph--frena` | CSS placeholder, `role="img"` | `aria-label="צילום זמני: פרנה"` | Fine for the prototype. | **In production:** use a real `<img>` with the owner's permission. Write its alt from the actual photo, e.g. `alt="פרנה על מגש, מתוך פוסט של האופה באינסטגרם"`. Point `a.pola` to that post's own URL, not to the profile; research ties the 15.10.2026 caption to https://www.instagram.com/p/DegS23RIAJ-/, so confirm before using. Add hidden text to the link: `<span class="sr-only"> (פוסט באינסטגרם, נפתח בחלון חדש)</span>`. Do not embed Instagram, because that loads third-party cookies. |
| 15 | b.html 337 · `.ph.ph--sufgania` | same | `aria-label="צילום זמני: סופגניות על מגש"` | Fine for the prototype. | Same as #14, linked to the 18.10.2026 reel's own URL (owner supplies it). |
| 16 | b.html 340 · `.ph.ph--pastry` | same | `aria-label="צילום זמני: מגש מאפים מהייצור"` | Fine for the prototype. | Same as #14, linked to the 20.10.2026 reel. If the real image shows an employee, it needs her consent before use. |
| 17 | `b-motion-hero.js` 217 · `canvas.b-motes` | dust particles | `aria-hidden="true"` | Correct. | None |
| 18 | `b-motion-scroll.js` 431 · `img.sx-fly` | flying copy of a product image | `alt=""` inside `.sx-layer[aria-hidden="true"]` (line 352) | Correct. It duplicates #7–12. | None |
| 19 | b.html 193, 194, 198, 234, 238, 245, 246, 268, 273, 278, 283, 288, 293, 415, 416, 417 | 16 inline SVG icons | all `aria-hidden="true"` | Correct. Each parent button or link has visible text or an `aria-label`. | None |
| 20 | `.hero.paper`, `.menu.paper`, `.feed.paper` (paper grain, data-URI SVG), `.sc-shadow`, `.shot` (gradients) | CSS backgrounds | none | Correct. They are decorative and stay in CSS. | None |

## 3. Missing images the production site needs

| Asset | Path on the site | Make it from | Spec |
|---|---|---|---|
| Favicon set | `/favicon.ico` (48×48), `/icon.svg`, `/apple-touch-icon.png` (180×180) | `clients/haofe/brand/svg/haofe-logo-clean.svg` and `brand/png/haofe-logo-512.png` | Google's favicon rules: square, a multiple of 48 px, a stable URL that crawlers can fetch. Use the clean logo, because the textured one turns to mush at 16–48 px. Markup: `<link rel="icon" href="/favicon.ico" sizes="48x48">`, `<link rel="icon" href="/icon.svg" type="image/svg+xml">`, `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`. |
| Organization logo (JSON-LD) | `/brand/haofe-logo-512.png` | `brand/png/haofe-logo-512.png` | Must return 200 and must not be blocked by robots.txt. |
| Share image (og:image) | `/og/haofe-1200x630.png` | the logo on the cream background `#F7F1E6`, with "נתיבות · שדרות · קריית גת" set in Secular One | 1200×630, under about 300 KB. **No AI render:** WhatsApp and Facebook previews would show invented bread as the bakery's own. Alt: `og:image:alt` in `head-meta.json`. Make one image per branch only once real photos of that branch exist. |

## 4. Image SEO notes for the build

- **Search engines can't see the prototype's images.** They are all inside `<template id="proto">` and appear only after shell.js clones them. Crawlers that don't run JS (most AI crawlers) see no images and no text. The production site must ship the content as plain server-rendered HTML (plan.md §6, item T1).
- **Keep the existing dimension and loading attributes.** `width` and `height` are already set on every `<img>`, and below-the-fold images already have `loading="lazy" decoding="async"`. Keep both.
- **Use perf's responsive markup.** The perf step's `srcset`/AVIF markup is in `/home/user/edon-studio/clients/haofe/audit/perf/recommended-markup.html`. The alts there match b.html, so apply the two alt fixes above (#8, #9) to that markup too.
- **Block the renders from image search.** While any AI render is live, robots.txt blocks `/assets/ai/` for `Googlebot-Image` and `msnbot-media`. This keeps them out of image search, where they could be mistaken for HaOfe products. Delete that group once only real photos remain.
- **Give real photos descriptive names.** Use lowercase ASCII with hyphens, e.g. `netivot-storefront.webp`, `sderot-balcony.webp`, `kiryat-gat-seating.webp`, `frena.webp`.
- **Never use AI renders in schema or on Google.** No AI render goes into JSON-LD `image`, the Google Business Profiles or the og:image.
