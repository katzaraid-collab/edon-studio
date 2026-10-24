// Builds /home/user/edon-studio/clients/haofe/audit/perf/{report.md, recommended-markup.html, metrics.json}
// from metrics.json, the r/ manifest, fonts*.json, sizes.json, svgo.json, visual.json. Numbers are read from data.
process.env.CONCEPTS = __dirname + '/snap';
const fs = require('fs');
const path = require('path');
const OUT = '/home/user/edon-studio/clients/haofe/audit/perf';
const J = f => JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8'));
const M = J('metrics.json');
const MAN = JSON.parse(fs.readFileSync('/home/user/edon-studio/clients/haofe/concepts/assets/ai/r/manifest.json', 'utf8'));
const FONTS = J('fonts.json'), FONTS2 = J('fonts2.json'), SIZESV = J('sizes.json'), CHARS = J('charset.json');
const SVGO = fs.existsSync(__dirname + '/svgo.json') ? J('svgo.json') : null;
const VIS = fs.existsSync(__dirname + '/visual.json') ? J('visual.json') : null;
const markup = require('./markup.js');
const slots = markup.slots({ lqip: true });
const SNAPTIME = fs.readFileSync(__dirname + '/snap.time', 'utf8').trim();
const SNAPSHA = fs.readFileSync(__dirname + '/snap.sha1', 'utf8').trim();

const kb = b => b == null ? 'n/a' : (b / 1024).toFixed(1) + ' KB';
const ms = v => v == null ? 'n/a' : Math.round(v) + ' ms';
const pct = (a, b) => (a == null || b == null || !b) ? '' : ' (' + ((a - b) / b * 100 >= 0 ? '+' : '') + ((a - b) / b * 100).toFixed(0) + '%)';
const S = k => M[k] || null;
const F = k => (M[k] || {}).first || null;
const T = (f, t) => f && f.byType[t] ? f.byType[t].transfer : 0;
const shortEl = e => (e || 'n/a').replace(/\s*\[.*\]/, m => ' ' + m.trim().replace(/assets\/ai\/(r\/)?/, '')).replace(/\s+/g, ' ').replace(/"(.{0,24}).*/, '"$1…"');
const walls = k => { const a = (M[k] || {}).all; return a ? a.el.filter(e => e === 'wall').length + ' of ' + a.el.length : 'n/a'; };
const runsTxt = k => { const a = (M[k] || {}).all; return a ? a.lcp.map((v, i) => v + ' ms ' + a.el[i]).join(', ') : 'n/a'; };
const fontFile = (f, re) => (f && f.fonts.find(x => re.test(x.url)) || {}).transfer;

// Google subset files (from the css2 response, see fonts-dl/rec.css): which file is Hebrew, which Latin
const GF = {
  'Playpen Sans Hebrew': { heb: /ApIzVfUZX/, lat: /ApI7VfQ/, trig: '`@haofe_bakery` (feed `.sec-head .hand`), `!` (`.note-hand`, `.visit .sec-head .hand`), `,` and `…` (`.pola q`)' },
  'Rubik': { heb: /DrXyi0A/, lat: /BrXw/, trig: 'digits, `-`, `:`, `(`, `)`, `?`, `–`, `·`, `AI` (phones, hours, dates, `.ai-tag`)' },
  'Secular One': { heb: /DgOOhLLA/, lat: /DiOOg/, trig: '`,` `:` `·` in headings (`.b2b-band h2`, order `h2`, `.menu a`)' }
};

const L = [];
const P = (...a) => L.push(a.join(''));

const V = [
  ['today', 'full', 'b.html as it is (overlay only)'],
  ['images only', 'img', 'new `<picture>` markup + `r/` variants, old font link'],
  ['option A', 'opt', 'images + LQIP + trimmed Google Fonts link + hero preload'],
  ['option B', 'optb', 'option A with self-hosted Hebrew subset fonts instead of Google'],
  ['all', 'all', 'option B + the plate-fade fix (P2)'],
  ['all, no font preload', 'allp0', '"all" without the two font preloads']
];

// ---------------------------------------------------------------- header
P('# Performance audit · Direction B "השקית"');
P('');
P('Role: performance engineer. Scope: direction B as the full-screen overlay (`[data-full]` in `b.html`), its images and its fonts.');
P(`Measured ${SNAPTIME} on a frozen copy of \`concepts/\` (sha1 list at the end), Chromium 153.0.8010.12 via Playwright + CDP, cold cache on every run.`);
P('Everything below is measured or computed from files. Where data is missing it says MISSING.');
P('');
P('In this folder: `report.md` (this file), `recommended-markup.html` (copy-paste markup for every image slot, the font links and the CSS), `metrics.json` (every aggregated number), `playpen-calt-compare.png`, `wheat-aspect.png`, `tools/` (the scripts behind every number; `tools/README.txt`).');
P('Image variants: `concepts/assets/ai/r/` (46 image files + `manifest.json`). Font subsets were built in scratch only; `tools/fonts.py` and `tools/fonts2.py` rebuild them.');
P('');

// ---------------------------------------------------------------- method
P('## 1. Method');
P('');
P('- **"Site" load** = `b.html` rewritten at request time by `tools/harness.js`: presentation chrome removed, overlay opened at `DOMContentLoaded`, `.fs-bar` hidden, so the viewport holds exactly one mount of `<template id="proto">` (frame `full`). Files in `concepts/` were never modified.');
P('- **Desktop** 1280x820 @1x, 40 ms RTT, 10 Mbit/s, no CPU throttle. **Mobile** 390x780 @3x, Lighthouse "Slow 4G" DevTools values (562.5 ms latency, 1.47 Mbit/s) + 4x CPU. 3 runs per variant (medians; every run in `metrics.json`). Extra single runs: 1440x900 @2x, brotli server, presentation page.');
P('- Bytes = CDP `Network.loadingFinished.encodedDataLength`. LCP/CLS/long tasks/long animation frames = PerformanceObserver. Decoded vs displayed = drawn box x DPR vs the file\'s real pixel size (manifest values for srcset images, because `naturalWidth` is density-corrected there).');
P('- The local server sends no compression; `br` rows come from the same files on a brotli-11 server, i.e. what a production host sends for HTML/CSS/JS/SVG.');
P('- Google Fonts are fetched live through this sandbox\'s egress proxy: byte counts are exact, timings are not Israeli-user timings.');
P('- **Prototype caveat:** the page content is inside `<template>` and cloned by `shell.js` at `DOMContentLoaded`, so the preload scanner cannot see any image and every image request starts after DCL. The static production site will not have this delay. The option A/B harnesses add a `<link rel=preload>` for the hero wall to compensate.');
P('');

// ---------------------------------------------------------------- summary
P('## 2. Results at a glance');
P('');
P('| variant | what | desktop LCP | mobile LCP | desktop bytes | mobile bytes | brotli desktop / mobile | fonts | CLS d / m | TBT d / m |');
P('|---|---|---|---|---|---|---|---|---|---|');
const base = { d: F('full-desktop'), m: F('full-mobile') };
for (const [name, key, what] of V) {
  const d = S(key + '-desktop'), m = S(key + '-mobile');
  if (!d && !m) continue;
  const fd = F(key + '-desktop'), fm = F(key + '-mobile');
  const bd = F('br:' + (key === 'optb' ? 'x' : key === 'img' ? 'x' : key) + '-desktop'), bm = F('br:' + (key === 'optb' ? 'x' : key === 'img' ? 'x' : key) + '-mobile');
  P(`| **${name}** | ${what} | ${d ? ms(d.median.lcp) : 'n/a'} | ${m ? ms(m.median.lcp) : 'n/a'} | ${fd ? kb(fd.total) + (key !== 'full' ? pct(fd.total, base.d.total) : '') : 'n/a'} | ${fm ? kb(fm.total) + (key !== 'full' ? pct(fm.total, base.m.total) : '') : 'n/a'} | ${bd ? kb(bd.total) : '–'} / ${bm ? kb(bm.total) : '–'} | ${fd ? kb(T(fd, 'Font')) + ', ' + fd.byType.Font.n + ' files' : 'n/a'} | ${d ? d.median.cls.toFixed(3) : '–'} / ${m ? m.median.cls.toFixed(3) : '–'} | ${d ? ms(d.median.tbt) : '–'} / ${m ? ms(m.median.tbt) : '–'} |`);
}
P('');
P('LCP element per variant (run 1): ' + V.map(([n, k]) => F(k + '-desktop') ? `${n}: desktop ${shortEl(F(k + '-desktop').lcpEl)}, mobile ${F(k + '-mobile') ? shortEl(F(k + '-mobile').lcpEl) : 'n/a'}` : '').filter(Boolean).join('; ') + '.');
P('');
P('Read with P2: while the plate still fades in, a fast-loading wall is painted at `opacity: 0` and is not reported, so in some runs (images only, option A) or every run (option B) the LCP entry falls on the wheat or the hero background. With the fade removed (`optnf`, `all` in section 8) the wall is the LCP element in every run (`allp0`: 2 of 3 on mobile, explained in section 7). The wheat rows use `sizes="842px"` (finding P4).');
P('');

// ---------------------------------------------------------------- findings
P('## 3. Findings, most important first');
P('');
const ffd = F('full-desktop'), ffm = F('full-mobile'), fod = F('opt-desktop'), fbd = F('optb-desktop');
const nd = S('all-desktop'), nm = S('all-mobile');
const latTotal = Object.values(GF).reduce((a, g) => a + (fontFile(ffd, g.lat) || 0), 0);
const fontNoHeebo = ffd ? ffd.fonts.filter(f => !/heebo/.test(f.url)).reduce((a, x) => a + x.transfer, 0) : 0;
const B = {
  sec: FONTS2.files['Secular One · static · Hebrew+digits+punct'], rub: FONTS.families['Rubik'].files['variable wght 400..700, Hebrew+Basic Latin'],
  p6: FONTS2.files['Playpen · static 600 · Hebrew+digits+punct'], p4: FONTS2.files['Playpen · static 400 · Hebrew+digits+punct']
};
const sumB = B.sec + B.rub + B.p6 + B.p4;
const findings = [];
findings.push(['P1', 'high', 'Every image is served at one size (900-1920 px) to every screen; the 6 "lazy" product cutouts load at startup anyway',
  `Today the overlay downloads ${kb(T(ffd, 'Image'))} of images (desktop and mobile alike). All six \`.prod\` images have \`loading="lazy"\` but sit within Chrome's lazy-load distance (the box grid starts right under the hero), so they are fetched during the initial load in every run. Decoded vs displayed (section 5): products are 900 px files drawn at 306 px on desktop (ratio 2.9), \`.sc-sticker\` is a 512 px SVG drawn at 128 px, and on phones the 1920x1079 wall is decoded although only a 981x1079 slice of it is visible.`,
  `Use the \`r/\` variants with the \`<picture>\`/\`srcset\`/\`sizes\` markup of section 6 (sizes verified against the rendered layout at 14 widths). Measured: images ${kb(T(ffd, 'Image'))} → ${kb(T(F('img-desktop'), 'Image'))} on desktop, ${kb(T(ffm, 'Image'))} → ${kb(T(F('img-mobile'), 'Image'))} on mobile @3x. Phones get \`plate-m\`, an art-direction crop of exactly the visible slice.`]);
findings.push(['P2', 'high', 'The hero opening hides the LCP image: `.sc-plate` fades in from `opacity: 0` and the fade is paused until all four scene images decode',
  '`b-motion-hero.css:109` gives `.pb.anim .hero .sc-plate` the animation `b-hero-fade .32s` (`from { opacity: 0 }`), `b-motion-hero.css:200` pauses every scene animation while `.hero.b-hold` is set, and `b-motion-hero.js` keeps `.b-hold` until plate, bag, wheat and sticker have all decoded (or `HOLD_MAX = 900` ms). The wall is therefore invisible until the slowest of four images is ready. ' +
  `Measured, same markup and fonts with only the fade removed. Desktop, option A: ${runsTxt('opt-desktop')} (the wall is the LCP element in ${walls('opt-desktop')} runs); with the fix (\`optnf\`): ${runsTxt('optnf-desktop')} (${walls('optnf-desktop')}). Mobile, option A: ${runsTxt('opt-mobile')}; with the fix: ${runsTxt('optnf-mobile')}. Option B with the fade: the wall is never reported (${runsTxt('optb-desktop')} / ${runsTxt('optb-mobile')}); option B with the fix (\`all\`): ${runsTxt('all-desktop')} / ${runsTxt('all-mobile')}. When the wall is painted at opacity 0 it is not an LCP candidate, so LCP lands on whatever paints visibly later; without the fade the wall paints in the first contentful frame (FCP = LCP). On mobile the hold usually runs to its timeout: with the fade, LCP ≈ DCL + 900 ms hold + 320 ms fade (option A: median DCL ${ms(S('opt-mobile').median.dcl)}, LCP ${ms(S('opt-mobile').median.lcp)}), because \`bag-748.avif\` (Low priority) is still downloading behind the font files when the page mounts. That is also why option A is not faster than images-only on mobile until P2 is fixed.`,
  'For the owner of the motion files (read-only for me): in `b-motion-hero.css:109` drop `b-hero-fade` from the plate: `.pb.anim .hero .sc-plate { transform-origin: 40% 62%; animation: b-hero-push 1.35s var(--ease-out) both; }`. In `b-motion-hero.js` let `.b-hold` wait for `.sc-bag-img` and `.sc-sticker` only. The wall shows as soon as it decodes; the bag still arrives with its animation.']);
findings.push(['P3', 'high', `Fonts: ${kb(latTotal)} of the ${kb(fontNoHeebo)} of site fonts are the Latin subset files, pulled in by punctuation, digits and one handle`,
  `Google splits each family by script. For this Hebrew site the Latin files are the big ones: Playpen Sans Hebrew Latin ${kb(fontFile(ffd, GF['Playpen Sans Hebrew'].lat))} vs Hebrew ${kb(fontFile(ffd, GF['Playpen Sans Hebrew'].heb))}; Rubik Latin ${kb(fontFile(ffd, GF.Rubik.lat))} vs Hebrew ${kb(fontFile(ffd, GF.Rubik.heb))}; Secular One Latin ${kb(fontFile(ffd, GF['Secular One'].lat))} vs Hebrew ${kb(fontFile(ffd, GF['Secular One'].heb))}. The Latin files load because U+0000-00FF (digits, comma, colon, !, @) is only in the Latin unicode-range (table in section 7). Playpen's emoji chunk also claims \`U+30-39\`, so a digit inside any Playpen note would fetch an emoji font file.`,
  `Option B, section 7: self-host one file per face. Secular One and Playpen: Hebrew + digits + punctuation (their rare Latin letters fall through the b.css stacks to Rubik); Rubik: Hebrew + Basic Latin (body text and the fallback). ${kb(sumB)} in 4 files instead of ${kb(fontNoHeebo)} in ${ffd ? ffd.fonts.filter(f => !/heebo/.test(f.url)).length : '?'} (measured: ${fbd ? kb(T(fbd, 'Font')) + ' transferred' : 'n/a'}), no third-party origin, no emoji chunk.`]);
findings.push(['P4', 'medium', 'The hero wheat is drawn squeezed 2.7x (desktop) / 6.3x (phones) because `.sc-wheat` has no CSS height',
  '`b.css:191` sets only `width: 34%` (`width: 24%` at ≥1000px, `b.css:330`) on `.sc-wheat`, so the `height="1000"` attribute in `b.html` applies: measured box 307x1000 css px at 1280 px and 133x1000 at 390 px, from an 842x1000 render (aspect 0.84 drawn at 0.31 / 0.13). The tall stalks in today\'s hero come from this (`wheat-aspect.png`: today vs `height: auto`). It also matters for `srcset`: the browser picks by width, so a 480 px file would be stretched to 1000 px of height and look softer than today.',
  'Designer decision (open question). If the tall look is wanted: keep it, and keep `sizes="842px"` in the wheat markup (always the 800w file, 40.4 KB AVIF instead of 170.5 KB WebP); better still, export a wheat render that is tall by design so nothing is squeezed. If not: add `height: auto;` to `.pb .sc-wheat` in `b.css:191` and switch the wheat `sizes` to `' + markup.WHEAT_UNSTRETCHED + '` (480w on most screens, 20.5 KB).']);
findings.push(['P5', 'medium', 'The font link requests families and weights the site does not use, and misses one it does',
  'The link in `b.html:10` requests Heebo (5 weights) and IBM Plex Mono for the presentation page; in the overlay Heebo 400/600 still download (' + kb(ffd ? ffd.fonts.filter(f => /heebo/.test(f.url)).reduce((a, f) => a + f.transfer, 0) : 0) + ') because the presentation `.skip` link uses Heebo. Rubik is requested as 400;500;700 but b.css also asks for 600 (`font: 600 …` on `.chip-soon`, `.soon`, `.ai-tag`, `.ai-note`, `.phone-line` and more), which today renders as 700.',
  'Option A (keep Google): `' + slots.fontLink.replace(/<link rel="stylesheet" href="|">/g, '') + '`. `Rubik:wght@400..700` returns one variable face covering 400/500/600/700 from the same two files. Side effect: `font-weight: 600` now renders as real 600, narrower than today\'s 700 (the mobile page became 27 px shorter in the visual check). Keep `display=swap` and both preconnects. Option B (P3) supersedes this.']);
findings.push(['P6', 'medium', 'Logo SVGs: 114 KB raw, and the dark-mode copy downloads in light mode',
  '`haofe-logo-badge.svg` 58.2 KB (hero sticker and order slip), `haofe-logo-clean.svg` 28.0 KB (header, light), `haofe-logo-mono-cream.svg` 28.0 KB (header, dark; `display: none` in light mode but fetched anyway). Their paths are written with 2-decimal coordinates.' + (SVGO ? ' svgo 3.3.2 with `tools/svgo.config.js` (precision 1, multipass, keeps `viewBox`, `<title>`, `role`, which svgo\'s default preset removed in a first try): ' + SVGO.map(s => '`' + s.file + '` ' + kb(s.in) + ' → ' + kb(s.out) + ' (brotli ' + kb(s.inBr) + ' → ' + kb(s.outBr) + ')').join(', ') + '. Render check at 44, 128 and 512 px (@2x), original vs optimised: ' + SVGO.map(s => s.file.replace('haofe-logo-', '') + ' ' + s.diffPct + '% of pixels differ by >64').join(', ') + '.' : ''),
  'In `b.html`, `.mark-logo`: add `loading="lazy"` to `img.for-dark` (measured: then it is not requested in light mode). Optimise the three SVGs with the svgo command in section 9 (only after the designer checks them at sticker size) and serve them with brotli.']);
findings.push(['P7', 'medium', 'Opening the overlay is one long task, mostly a forced layout of the whole page',
  (() => { const lf = ffm && ffm.loaf.find(l => l.scripts.some(s => /DOMContentLoaded/.test(s.inv))); const ld = ffd && ffd.loaf.find(l => l.scripts.some(s => /DOMContentLoaded/.test(s.inv))); return (ld ? `Desktop: ${ld.dur} ms frame, the DOMContentLoaded handler ${ld.scripts.find(s => /DOMContentLoaded/.test(s.inv)).dur} ms of which ${ld.scripts.find(s => /DOMContentLoaded/.test(s.inv)).layout} ms forced style/layout. ` : '') + (lf ? `Mobile (4x CPU): ${lf.dur} ms frame, handler ${lf.scripts.find(s => /DOMContentLoaded/.test(s.inv)).dur} ms, forced layout ${lf.scripts.find(s => /DOMContentLoaded/.test(s.inv)).layout} ms. ` : ''); })() +
  'Cause in the prototype: `shell.js` `openFullScreen()` calls `closeButton.focus()` right after `build()`, forcing style + layout of the freshly cloned page inside the click handler. The real site pays the same first layout, just not inside a script. Trace totals in section 8 (mobile: Layout up to ~290 ms per pass at 4x CPU, several passes as fonts arrive).',
  'For the site: fewer font files means fewer re-layouts (option B loads 4 faces, 2 of them preloaded before first layout; CLS 0.0000 desktop / 0.0001 mobile, and the mobile trace shows Layout ' + (M['trace-full-mobile'] && M['trace-all-mobile'] ? (M['trace-full-mobile'].find(r => / Layout$/.test(r.k)) || {}).ms + ' ms → ' + (M['trace-all-mobile'].find(r => / Layout$/.test(r.k)) || {}).ms + ' ms' : 'n/a') + ' in the first 3 s). Keep the ticker at 2 copies of its list instead of 4 if the scroll module can loop with 2 (`b.html`, `.tk-track`: 4 x 12 items are laid out today). Presentation only: in `shell.js` move `closeButton.focus()` into a `requestAnimationFrame` callback.']);
findings.push(['P8', 'low', 'Presentation page (b.html with three frames) shows CLS ~0.23 and ~1.3 s TBT',
  (F('page-desktop') ? `Measured: CLS ${F('page-desktop').cls.toFixed(3)}, TBT ${ms(F('page-desktop').tbt)}, ${F('page-desktop').longtasks.length} long tasks (three mounts, each with its own forced layout in \`fitFrame()\`). ` : '') + 'The frames are mounted at full size and then scaled by `fitFrame()`, so the content below them moves. This is the presentation, not the site.',
  'Optional, presentation only: give `.frame-box` its final aspect in `shell.css` (`aspect-ratio: 1280 / 820` desktop, `390 / 780` phones) so `fitFrame()` no longer moves the page.']);
findings.push(['P9', 'low', 'Render-blocking third-party CSS and 5 local stylesheets',
  (ffd ? 'Render-blocking in the overlay load: ' + ffd.renderBlocking.map(r => '`' + r.url.replace(/\?.*/, '?…') + '`').join(', ') + '.' : ''),
  'Option B removes the fonts.googleapis.com stylesheet and both third-party origins. In production, concatenate `shell.css`-equivalent base, `b.css` and the three motion CSS files into one file (brotli: ' + (F('br:full-desktop') ? kb(T(F('br:full-desktop'), 'Stylesheet')) : 'n/a') + ' for all CSS today, Google CSS included).']);
for (const [id, sev, title, ev, fix] of findings) {
  P(`### ${id} · ${title}`);
  P(`Severity: ${sev}.`);
  P('');
  P(`**Evidence.** ${ev}`);
  P('');
  P(`**Fix.** ${fix}`);
  P('');
}
fs.writeFileSync(__dirname + '/findings.json', JSON.stringify(findings.map(([id, sev, title, ev, fix]) => ({ id, sev, title, ev, fix })), null, 1));

// ---------------------------------------------------------------- measured load today
P('## 4. Measured load today (overlay), per resource type');
P('');
P('| type | requests | desktop transferred | decoded | brotli server |');
P('|---|---|---|---|---|');
if (ffd) {
  const br = F('br:full-desktop');
  for (const [t, v] of Object.entries(ffd.byType).sort((a, b) => b[1].transfer - a[1].transfer)) P(`| ${t} | ${v.n} | ${kb(v.transfer)} | ${kb(v.decoded)} | ${br ? kb(T(br, t)) : '–'} |`);
  P(`| total | ${ffd.requests} | ${kb(ffd.total)} | | ${br ? kb(br.total) : '–'} |`);
}
P('');
P('Mobile transfers the same files (no srcset today). Origins: ' + (ffd ? ffd.origins.join(', ') : '') + '.');
P('');
if (ffd) {
  P('Largest requests (desktop, run 1):');
  P('');
  P('| transferred | resource |');
  P('|---|---|');
  [...ffd.images.map(i => ({ u: i.url, t: i.transfer })), ...ffd.fonts.map(x => ({ u: 'fonts.gstatic.com/s/' + x.url, t: x.transfer }))].sort((a, b) => b.t - a.t).slice(0, 14).forEach(r => P(`| ${kb(r.t)} | \`${r.u}\` |`));
  P('');
  const cs = c => c.v + ' at ' + c.t + ' ms' + (c.src.length ? ' (' + c.src.map(x => x.replace(/\s+/g, ' ')).join(', ') + ')' : '');
  P('CLS sources today (desktop run 1): ' + (ffd.clsSources.map(cs).join('; ') || 'none') + '. Mobile: ' + (ffm ? ffm.clsSources.map(cs).join('; ') : '') + '. All are far below 0.1.');
  P('');
}

// ---------------------------------------------------------------- decoded vs displayed
P('## 5. Decoded image size vs displayed size');
P('');
P('`needed` = drawn width x DPR (for `object-fit: contain/cover` the fitted image, not the box). `ratio` > 1 means more pixels decoded than shown. `decoded` = width x height x 4 bytes of memory per image.');
P('');
for (const k of ['full-desktop', 'full-desktop-2x', 'full-mobile', 'opt-desktop', 'opt-desktop-2x', 'opt-mobile']) {
  const f = F(k);
  if (!f) continue;
  P(`**${k}** (${k.includes('2x') ? '1440x900 @2x' : k.includes('mobile') ? '390x780 @3x' : '1280x820 @1x'})`);
  P('');
  P('| slot | file | file px | drawn css px | needed px | ratio | decoded |');
  P('|---|---|---|---|---|---|---|');
  let tot = 0;
  for (const a of f.audit) {
    if (!a.rendered) { P(`| ${a.cls} | ${a.src.split('/').pop() || '(not requested)'} | | hidden | | | ${a.src && a.natural[0] ? 'fetched (28.0 KB), never drawn' : 'not fetched'} |`); continue; }
    tot += a.decodedBytes;
    P(`| ${a.cls} | ${a.src.split('/').pop()} | ${a.natural.join('x')} | ${a.drawn.join('x')} | ${a.neededW} | ${a.ratio} | ${kb(a.decodedBytes)} |`);
  }
  P(`| | | | | | rendered total | ${(tot / 1048576).toFixed(1)} MB |`);
  P('');
}
P('Ratios below 1 in the new markup are deliberate: the browser picks the next-larger `srcset` candidate, so the wall on a 1280 px screen gets the 1920 file (17.8 KB AVIF) and on a 390 px @3x phone the largest `plate-m` (981 px, the full source resolution of that slice).');
P('');

// ---------------------------------------------------------------- variants + markup
P('## 6. Responsive variants and the markup for every slot');
P('');
P('Generated by `tools/gen.py` into `concepts/assets/ai/r/`; `r/manifest.json` lists per file format, width, height, bytes, quality, SSIM, and per image the intrinsic size, aspect, alpha, LQIP data URI and average colour. Rules: widths 480/800/1200 up to the source width (bag adds its 748 px source width; the wall adds 1920 because its desktop slot is 100vw). Quality: the lowest step on a fixed ladder whose SSIM against the Lanczos-resized source reaches ' + MAN.ssimTarget + ', scored on the worse of the light (#FFFCF6) and dark (#221812) slot backgrounds so cutout edges count in both modes. Alpha kept in both formats (WebP lossy alpha only where it still meets the target with mean alpha error ≤ 0.6/255; AVIF tries a colour bleed under alpha 0 and keeps the smaller file). LQIP: longest side 16 px, WebP q40, 80-260 bytes.');
P('');
P('`plate-m` is an art-direction crop of `plate.webp`: exactly the region that `object-fit: cover; object-position: 50% 100%` shows in the 4/4.4 mobile scene (box ' + JSON.stringify(MAN.images.find(i => i.name === 'plate-m').crop.box) + '), so phones never download or decode the 1920 px wall.');
P('');
P('| image | source | variants: AVIF / WebP | LQIP | markup uses |');
P('|---|---|---|---|---|');
for (const i of MAN.images) {
  const v = i.widths.map(w => { const a = i.files.find(f => f.format === 'avif' && Math.abs(f.width - w) < 2); const b = i.files.find(f => f.format === 'webp' && Math.abs(f.width - w) < 2); return `${w}w ${kb(a && a.bytes)} / ${kb(b && b.bytes)}`; }).join('<br>');
  P(`| ${i.name} | ${i.crop ? 'crop of ' : ''}${i.source.split('/').pop()} ${i.intrinsic.width}x${i.intrinsic.height}${i.crop ? '' : ', ' + kb(i.sourceBytes)}${i.alpha ? ', alpha' : ''} | ${v} | ${i.lqipBytes} B | ${markup.useAvif(i) ? 'AVIF + WebP' : 'WebP only (AVIF was not 5% smaller)'} |`);
}
P('');
const maxErr = (() => { let e = 0; for (const r of SIZESV) for (const k of ['sc-bag-img', 'sc-wheat', 'prod']) e = Math.max(e, Math.abs(r[k] - r[k + ':sizes'])); return e; })();
P(`**\`sizes\`**, derived from b.css and checked by \`tools/sizes.js\` (rendered layout width of each slot vs the width formula at 14 viewport widths from 360 to 1920 px; largest difference ${maxErr.toFixed(1)} px; for the wheat the width formula is the unsqueezed one):`);
P('');
P('| slot | sizes | from b.css |');
P('|---|---|---|');
P(`| .sc-plate | \`${markup.SIZES.plate}\` | desktop: the plane spans the hero (the hero motion module now oversizes it by ~3%, still ~100vw); mobile: \`plate-m\` fills the 100%-wide 4/4.4 scene |`);
P(`| .sc-bag-img | \`${markup.SIZES.bag}\` | \`.sc-bag { width: 46% }\`; \`@container (min-width: 1000px)\` → \`25%\` |`);
P(`| .sc-wheat | \`${markup.SIZES.wheat}\` while the render is squeezed (P4); \`${markup.WHEAT_UNSTRETCHED}\` once \`.sc-wheat\` gets \`height: auto\` | \`.sc-wheat { width: 34% }\`; ≥1000px → \`24%\`; no height, so \`height="1000"\` applies |`);
P(`| .prod | \`${markup.SIZES.prod}\` | \`.in\` padding 20px (48px ≥1000), max-width 1240px; grid 1/2/3 columns from 0/700/1000px, gap 22px; \`.box\` border 1.5px; \`.prod { width: 84% }\`; every cutout is width-limited in the 84% x 76% box |`);
P('');
P('The breakpoints are container queries on `.pb`; on the real site `.pb` is the page width, so the `vw` media conditions at 700/1000 px match them (off by the scrollbar width at most).');
P('');
P('**Exact markup** (also in `recommended-markup.html`, with the full LQIP data URIs). Replace each `<img>` in `b.html` (inside `<template id="proto">`):');
P('');
for (const s of slots.list) {
  P(`*${s.slot}*. Replaces \`${s.find.replace(/ alt="[^"]*"/, ' alt="…"')}\``);
  P('');
  P('```html');
  P(s.replace.replace(/ data-lqip style="--lqip:url\(data:image\/webp;base64,[^)]*\)"/, ' data-lqip style="--lqip:url(data:image/webp;base64,…)"').replace(/^\s{8,12}/gm, ''));
  P('```');
  P('');
}
P('Required CSS (add to `b.css`, section 3). `display: contents` keeps every existing selector and layout: `.sc-plate`, `.prod` etc. stay the plane/grid children they are today. `<source>` has to be hidden explicitly: Chromium gives it a box, and inside `.shot` (a grid) it became an extra grid row that shrank the product images by up to 27%. The visual check caught it.');
P('');
P('```css');
P(slots.lqipCss.replace(/<\/?style>/g, '').trim());
P('```');
P('');
P('LQIP removal (in `<head>`; `load` does not bubble, so it is captured on the document; works for template mounts too):');
P('');
P('```html');
P(slots.lqipJs.trim());
P('```');
P('');
P('Prototype only (images live in `<template>`, invisible to the preload scanner), in `<head>` of `b.html`:');
P('');
P('```html');
P(slots.heroPreload);
P('```');
P('');
P('On the static site skip the preload: `fetchpriority="high"` on the hero `<img>` is enough because the preload scanner sees it. No `loading="lazy"` on any hero image. The feed placeholders (`.pola .ph`) are CSS today; when real photos arrive use `sizes="(min-width: 1240px) 366px, (min-width: 1000px) calc(33vw - 47px), (min-width: 700px) calc(50vw - 31px), calc(100vw - 60px)"` (same grid as the boxes, `.pola` padding 10px) and widths 480/800.');
P('');

// ---------------------------------------------------------------- fonts
P('## 7. Fonts');
P('');
P('**What the prototype renders** (computed style of every text node in the overlay, desktop + mobile, hidden states included):');
P('');
P('| family / weight | distinct chars | non-Hebrew chars |');
P('|---|---|---|');
for (const [k, v] of Object.entries(CHARS).sort()) {
  const nonHeb = [...v].filter(c => c.codePointAt(0) < 0x0590 || c.codePointAt(0) > 0x05FF).join('');
  P(`| ${k.replace('|', ' ')} | ${v.length} | \`${nonHeb || '(none)'}\` |`);
}
P('');
P('Heebo comes from the presentation `.skip` link only.');
P('');
P('**What Google sends today** (desktop run 1; unicode ranges from the css2 response):');
P('');
P('| family | Hebrew file | Latin file | what triggers the Latin file |');
P('|---|---|---|---|');
for (const [fam, g] of Object.entries(GF)) P(`| ${fam} | ${kb(fontFile(ffd, g.heb))} | ${kb(fontFile(ffd, g.lat))} | ${g.trig} |`);
P(`| Heebo (presentation) | ${kb(fontFile(ffd, /heebo.*H0TbFzsQ/))} | ${kb(fontFile(ffd, /heebo.*H2TbE/))} | \`.skip\` link |`);
P(`| total | | | ${kb(ffd ? ffd.fonts.reduce((a, x) => a + x.transfer, 0) : 0)} in ${ffd ? ffd.fonts.length : '?'} files |`);
P('');
P('`display=swap` is set and both preconnects are present (good). Rubik and Playpen are variable fonts on Google (Rubik wght 300-900, Playpen 100-800, from the upstream `METADATA.pb`), so all weights of a family come from the same file.');
P('');
P('**Option A, keep Google Fonts (smallest change).** `b.html:10`:');
P('');
P('```html');
P('<link rel="preconnect" href="https://fonts.googleapis.com">');
P('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>');
P(slots.fontLink);
P('```');
P('');
P(`Measured: ${fod ? kb(T(fod, 'Font')) + ' in ' + fod.byType.Font.n + ' files' : 'n/a'} (Heebo gone, the Latin files stay). The presentation page itself still needs Heebo + IBM Plex Mono for \`shell.css\`; the site does not.`);
P('');
P('**Option B, self-host a Hebrew subset (recommended for the site).** Sources: the upstream OFL fonts from github.com/google/fonts (`ofl/rubik`, `ofl/secularone`, `ofl/playpensanshebrew`; "OFL" in each `METADATA.pb`). fontTools 4.67, no hinting, default OpenType features unless noted (`tools/fonts.py`, `tools/fonts2.py`). License: all three OFL.txt files are SIL OFL 1.1 and none declares a Reserved Font Name in its copyright header, so the subsets may keep their family names; ship each family\'s OFL.txt next to the woff2 files:');
P('');
P('| file | contents | woff2 |');
P('|---|---|---|');
for (const [k, v] of Object.entries(FONTS2.files)) P(`| ${k.split(' · ')[0]} | ${k.split(' · ').slice(1).join(', ')} | ${kb(v)} |`);
for (const [fam, r] of Object.entries(FONTS.families)) for (const [k, v] of Object.entries(r.files)) if (!/used characters/.test(k)) P(`| ${fam} | ${k} | ${kb(v)} |`);
P('');
P('Chosen set: Secular One and both Playpen weights as Hebrew + digits + punctuation (`' + FONTS2.unicodeRange + '`), Rubik 400-700 variable as Hebrew + Basic Latin (`' + FONTS.unicodeRange + '`). Latin letters in a heading or a note fall through the existing stacks (`--display` and `--hand` both continue with "Rubik"), so `@haofe_bakery` renders its letters in Rubik and its `@`/`_` in Playpen; either accept that or set `.pb .feed .sec-head .hand { font-family: var(--body); font-weight: 600; }` (open question).');
P('');
P('```css');
P('/* b.css, top of section 1. Font files from tools/fonts.py + tools/fonts2.py, served from /fonts/ */');
P(markup.fontFaceB('/fonts/'));
P('```');
P('');
P('```html');
P('<!-- <head>: the two faces the first screen needs (h1, body). Not Playpen: it would compete with the hero image. Remove the Google preconnects and link. -->');
P(markup.fontPreloadB('/fonts/'));
P('```');
P('');
const pa = S('all-mobile'), p0 = S('allp0-mobile'), p1 = S('allp1-mobile'), pad = S('all-desktop'), p0d = S('allp0-desktop'), oa = S('optnf-mobile');
if (pa && p0) P(`Preload trade-off, measured with the P2 fix in place (3 runs each). Two preloads: mobile ${runsTxt('all-mobile')}, CLS ${pa.median.cls.toFixed(4)}; desktop ${runsTxt('all-desktop')}, CLS ${pad.median.cls.toFixed(4)}. No preload: mobile ${runsTxt('allp0-mobile')}, CLS ${p0.median.cls.toFixed(4)}; desktop ${runsTxt('allp0-desktop')}. Only Secular One preloaded: mobile ${runsTxt('allp1-mobile')}. On Slow 4G the 39 KB of preloaded fonts share the link with the render-blocking CSS, so the first paint can come ~0.2 s later than with no preload; in exchange nothing reflows. Without the Rubik preload, Rubik swaps in after first paint, the hero text block changes height, the half-visible mobile scene moves, and the wheat's visible area overtakes the wall's, so the LCP entry jumps to the wheat at ~5 s (3 of 3 runs with only Secular One, 1 of 3 with none). Recommendation: preload both Secular One and Rubik. Option A fonts with the same fix, for comparison: mobile ${runsTxt('optnf-mobile')}, CLS ${oa.median.cls.toFixed(4)}.`);
P('');
P(`Option B: ${kb(sumB)} in 4 files from the site's own origin (measured ${fbd ? kb(T(fbd, 'Font')) : 'n/a'} with headers), versus ${kb(fontNoHeebo)} in ${ffd ? ffd.fonts.filter(f => !/heebo/.test(f.url)).length : '?'} files from two Google origins today. With \`.pb .pola q\` on weight 600 it is 3 files, ${kb(sumB - B.p4)}. Without Playpen's \`calt\` feature each Playpen file drops to ~13 KB, but \`calt\` changes glyph spacing on every line (\`playpen-calt-compare.png\`), so that is a design decision.`);
P('');
P('Fallback metrics: CLS from font swaps is already low (section 2) and 0.000 on desktop with option B. `size-adjust`/`ascent-override` need the metrics of the fallback fonts users actually have (Arial on Windows, Arial Hebrew on Apple, Noto Sans Hebrew on Android), which are not in this container: MISSING. Web-font side, per 1000 em: Secular One ascent 1022 / descent 433, Rubik 935 / 250, Playpen 1070 / 460; average Hebrew letter advance 0.521, 0.519 and 0.548 em.');
P('');

// ---------------------------------------------------------------- before/after detail
P('## 8. All runs, traces, visual check');
P('');
P('| scenario | runs | LCP per run (ms) | FCP | CLS | TBT | bytes run 1 | LCP element run 1 |');
P('|---|---|---|---|---|---|---|---|');
for (const [k, v] of Object.entries(M)) {
  if (!v.median) continue;
  P(`| ${k} | ${v.runs} | ${v.all.lcp.join(' / ')} | ${v.all.fcp.join(' / ')} | ${v.all.cls.join(' / ')} | ${v.all.tbt.join(' / ')} | ${kb(v.first.total)} | ${shortEl(v.first.lcpEl)} |`);
}
P('');
P('Keys: `full` today, `img` images only, `opt` option A, `optnl` option A without LQIP, `optnf` option A + P2 fix, `optb` option B, `all` option B + P2 fix, `allp0`/`allp1` "all" with no font preload / only Secular One preloaded, `page` the presentation page `b.html`, `br:` brotli server, `-2x` 1440x900 @2x.');
P('');
for (const t of ['trace-full-desktop', 'trace-opt-desktop', 'trace-full-mobile', 'trace-opt-mobile', 'trace-all-mobile']) {
  if (!M[t]) continue;
  P(`**${t}** (Chromium trace of one cold load, renderer process; ${t.includes('mobile') ? '390x780 @3x, 4x CPU' : '1280x820 @1x'}; no network throttle)`);
  P('');
  P('| total ms | count | longest ms | thread · event |');
  P('|---|---|---|---|');
  M[t].filter(r => !/RunTask$/.test(r.k)).slice(0, 10).forEach(r => P(`| ${r.ms} | ${r.n} | ${r.max} | ${r.k.replace(' | ', ' · ')} |`));
  P('');
}
P('Desktop spends over a second of raster-thread time (`RasterTask`) in the first 3 s; the scene is 4 large layers plus a flour-dust canvas and two `feTurbulence` noise textures (`.pb .paper`, `.ph::after`). It is off the main thread, but on low-end GPUs/CPUs it competes with decoding. No change proposed until the motion work settles; re-trace then.');
P('');
if (VIS) {
  P('**Visual check** (`tools/visual.js`: reduced motion, page unrolled to full height, every image loaded; pixels differing by more than 64/255 against today):');
  P('');
  P('| page | variant | page height today → variant | pixels changed |');
  P('|---|---|---|---|');
  VIS.forEach(v => P(`| ${v.key} | ${v.variant} | ${v.hA} → ${v.hB} | ${v.pct}% |`));
  P('');
  P('Images only: the remaining differences are bread texture (Lanczos pre-scaling vs the browser\'s own downscale), no layout change, no halos around the cutouts. Option A/B: Rubik 600 now renders as 600 instead of 700, so text widths and on mobile the page height change.');
  P('');
}

// ---------------------------------------------------------------- open + reproduce
P('## 9. Open questions, missing data, how to reproduce');
P('');
P('- **Motion owner (P2):** remove the opacity fade from `.sc-plate` and shorten what `.b-hold` waits for. I did not touch `b-motion-*`.');
P('- **Design:** Playpen with or without `calt` (~13 KB vs ~40 KB per weight); `.pb .pola q` at 600 to ship one Playpen file; the `@haofe_bakery` handle in Rubik or mixed.');
P('- **Design:** is the tall, squeezed wheat the intended look (P4)? Decides `height: auto` and the wheat `sizes`.');
P('- **Design:** sign-off on the svgo-optimised logos before they replace the originals (pixel check numbers in P5).');
P('- **MISSING:** hosting/CDN (decides brotli, HTTP/2 or 3, cache headers). The `br` rows assume brotli-11 static compression.');
P('- **MISSING:** real-user data (CrUX/RUM); all numbers here are lab numbers from one machine.');
P('- **MISSING:** fallback-font metrics for `size-adjust` (section 7).');
P('- When real photography replaces the AI renders (README in `assets/ai/`), rerun `tools/gen.py`; the markup regenerates from the manifest (`tools/markup.js`).');
P('');
P('Reproduce: `tools/README.txt`. Logos: `npx svgo@3.3.2 --config tools/svgo.config.js -i assets/logo/haofe-logo-badge.svg -o assets/logo/haofe-logo-badge.min.svg` (same for `-clean` and `-mono-cream`).');
P('');
P('Snapshot measured (sha1):');
P('');
P('```');
P(SNAPSHA);
P('```');

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'report.md'), L.join('\n') + '\n');

// ---------------------------------------------------------------- recommended-markup.html
const H = [];
H.push('<!-- האופה · direction B · recommended image + font markup. Generated by tools/report.js from concepts/assets/ai/r/manifest.json. -->');
H.push('<!-- 1a. <head>, fonts option B (recommended for the site): self-hosted subsets; put the @font-face block at the top of b.css -->\n' + markup.fontPreloadB('/fonts/') + '\n<style>\n' + markup.fontFaceB('/fonts/') + '\n</style>');
H.push('\n<!-- 1b. <head>, fonts option A (keep Google; replaces b.html:10) -->\n<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' + slots.fontLink);
H.push('\n<!-- 2. <head>, PROTOTYPE ONLY (images are inside <template>): preload the hero wall. Not needed on a static site. -->\n' + slots.heroPreload);
H.push('\n<!-- 3. <head>: LQIP removal -->\n' + slots.lqipJs.trim());
H.push('\n<!-- 4. b.css section 3 -->\n' + slots.lqipCss.trim());
for (const s of slots.list) H.push(`\n<!-- ${s.slot}. Replaces:\n     ${s.find.replace(/--/g, '- -')}\n-->\n${s.replace}`);
fs.writeFileSync(path.join(OUT, 'recommended-markup.html'), H.join('\n') + '\n');
fs.copyFileSync(__dirname + '/metrics.json', path.join(OUT, 'metrics.json'));
console.log('report written', L.length, 'lines');
