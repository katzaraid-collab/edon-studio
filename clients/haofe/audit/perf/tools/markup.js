// The recommended markup for every image slot in b.html, built from r/manifest.json.
// Used by harness.js (to measure it) and by report.js (to print it), so both are identical.
const fs = require('fs');
const CONCEPTS = process.env.CONCEPTS || '/home/user/edon-studio/clients/haofe/concepts';
const MANIFEST = CONCEPTS + '/assets/ai/r/manifest.json';

// sizes: derived from b.css (see report: .in padding 20/48px, max-width 1240px, grid gap 22px,
// .box border 1.5px, .prod width 84%, hero planes as % of a 100%-wide scene) and verified by
// measuring the rendered slot widths at 360..1920px in measure.js
const SIZES = {
  plate: '100vw',
  'plate-m': '100vw',
  bag: '(min-width: 1000px) 25vw, 46vw',
  // .sc-wheat has no CSS height, so its height="1000" attribute applies and the render is squeezed into
  // 24vw x 1000px (34vw on phones). Width-based selection would then under-serve the 1000 px of height,
  // so while the stretch stays the slot needs the largest file: 842px (= always the 800w variant).
  // If b.css gets `.pb .sc-wheat { height: auto; }`, switch to WHEAT_UNSTRETCHED.
  wheat: '842px',
  prod: '(min-width: 1240px) 306px, (min-width: 1000px) calc(28vw - 40px), (min-width: 700px) calc(42vw - 27px), calc(84vw - 35px)'
};

const PRODUCTS = ['frena', 'challah', 'baguette', 'dairy', 'rugelach', 'sufganiyot'];

function load() { return JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); }

function srcset(img, fmt) {
  return img.files.filter(f => f.format === fmt).sort((a, b) => a.width - b.width)
    .map(f => f.src + ' ' + f.width + 'w').join(', ');
}
function fallback(img) {           // <img src>: the WebP closest to 800w; only used by a browser that ignores srcset/<source>
  const w = img.files.filter(f => f.format === 'webp').sort((a, b) => Math.abs(a.width - 800) - Math.abs(b.width - 800))[0];
  return w;
}
// emit the AVIF <source> only when, summed over the widths, it is at least 5% smaller than the WebP set
function useAvif(img) {
  const t = fmt => img.files.filter(f => f.format === fmt).reduce((a, f) => a + f.bytes, 0);
  return t('avif') < 0.95 * t('webp');
}
exports.useAvif = useAvif;
function lqipAttr(img, on) { return on ? ` data-lqip style="--lqip:url(${img.lqip})"` : ''; }


// Option B: self-hosted subsets (tools/fonts.py, tools/fonts2.py). Hebrew + digits + punctuation for the display and
// note faces (their Latin letters fall to Rubik through the b.css stacks); Rubik keeps Basic Latin (body + fallback).
const UR_P = 'U+0020-0040, U+005B-0060, U+007B-007E, U+00A0, U+00B7, U+0590-05FF, U+200C-2011, U+2013-2014, U+2018-201A, U+201C-201E, U+2026, U+20AA, U+25CC, U+FB1D-FB4F';
const UR_L = 'U+0020-007E, U+00A0, U+00B7, U+0590-05FF, U+200C-2011, U+2013-2014, U+2018-201A, U+201C-201E, U+2026, U+20AA, U+25CC, U+FB1D-FB4F';
exports.fontFaceB = (base = '/fonts/') => [
  `@font-face { font-family: "Secular One"; src: url("${base}SecularOne-hebp.woff2") format("woff2"); font-weight: 400; font-display: swap; unicode-range: ${UR_P}; }`,
  `@font-face { font-family: "Rubik"; src: url("${base}Rubik-400-700-heb.woff2") format("woff2"); font-weight: 400 700; font-display: swap; unicode-range: ${UR_L}; }`,
  `@font-face { font-family: "Playpen Sans Hebrew"; src: url("${base}PlaypenSansHebrew-600-hebp.woff2") format("woff2"); font-weight: 600; font-display: swap; unicode-range: ${UR_P}; }`,
  `@font-face { font-family: "Playpen Sans Hebrew"; src: url("${base}PlaypenSansHebrew-400-hebp.woff2") format("woff2"); font-weight: 400; font-display: swap; unicode-range: ${UR_P}; }`
].join('\n');
exports.fontPreloadB = (base = '/fonts/') =>
  `<link rel="preload" href="${base}SecularOne-hebp.woff2" as="font" type="font/woff2" crossorigin>\n<link rel="preload" href="${base}Rubik-400-700-heb.woff2" as="font" type="font/woff2" crossorigin>`;

exports.SIZES = SIZES;
exports.WHEAT_UNSTRETCHED = '(min-width: 1000px) 24vw, 34vw';
exports.NOFADE = '.pb.anim .hero .sc-plate { animation: b-hero-push 1.35s var(--ease-out) both; }';
exports.slots = function ({ lqip = true } = {}) {
  const m = load();
  const by = Object.fromEntries(m.images.map(i => [i.name, i]));
  const list = [];
  const P = by.plate, PM = by['plate-m'];
  const pf = fallback(PM);

  list.push({
    slot: 'hero plate (.sc-plate)',
    find: '<img class="sc-plate" src="assets/ai/plate.webp" alt="" width="1920" height="1079">',
    replace:
`<picture>
          <source media="(min-width: 1000px)" type="image/avif" srcset="${srcset(P, 'avif')}" sizes="${SIZES.plate}" width="${P.intrinsic.width}" height="${P.intrinsic.height}">
          <source media="(min-width: 1000px)" type="image/webp" srcset="${srcset(P, 'webp')}" sizes="${SIZES.plate}" width="${P.intrinsic.width}" height="${P.intrinsic.height}">
          <source type="image/avif" srcset="${srcset(PM, 'avif')}" sizes="${SIZES['plate-m']}" width="${PM.intrinsic.width}" height="${PM.intrinsic.height}">
          <img class="sc-plate" src="${pf.src}" srcset="${srcset(PM, 'webp')}" sizes="${SIZES['plate-m']}" alt="" width="${PM.intrinsic.width}" height="${PM.intrinsic.height}" fetchpriority="high" decoding="async"${lqipAttr(P, lqip)}>
        </picture>`
  });

  for (const [name, cls, attrs] of [['bag', 'sc-bag-img', ''], ['wheat', 'sc-wheat', '']]) {
    const I = by[name];
    const f = fallback(I);
    list.push({
      slot: `hero ${name} (.${cls})`,
      find: `<img class="${cls}" src="assets/ai/${name}.webp" alt="" width="${I.intrinsic.width}" height="${I.intrinsic.height}">`,
      replace:
`<picture>\n${useAvif(I) ? `          <source type="image/avif" srcset="${srcset(I, 'avif')}" sizes="${SIZES[name]}">\n` : ''}          <img class="${cls}" src="${f.src}" srcset="${srcset(I, 'webp')}" sizes="${SIZES[name]}" alt="" width="${I.intrinsic.width}" height="${I.intrinsic.height}" decoding="async"${attrs}${lqipAttr(I, lqip)}>
        </picture>`
    });
  }

  const src = fs.readFileSync(CONCEPTS + '/b.html', 'utf8');
  for (const name of PRODUCTS) {
    const I = by[name];
    const re = new RegExp(`<img class="prod" src="assets/ai/${name}\\.webp" alt="([^"]*)" width="(\\d+)" height="(\\d+)" loading="lazy" decoding="async">`);
    const mm = src.match(re);
    if (!mm) throw new Error('markup: product img not found in b.html: ' + name);
    const f = fallback(I);
    list.push({
      slot: `product ${name} (.box .shot .prod)`,
      find: mm[0],
      replace:
`<picture>\n${useAvif(I) ? `            <source type="image/avif" srcset="${srcset(I, 'avif')}" sizes="${SIZES.prod}">\n` : ''}            <img class="prod" src="${f.src}" srcset="${srcset(I, 'webp')}" sizes="${SIZES.prod}" alt="${mm[1]}" width="${I.intrinsic.width}" height="${I.intrinsic.height}" loading="lazy" decoding="async"${lqipAttr(I, lqip)}>
          </picture>`
    });
  }

  list.push({
    slot: 'header logo, dark-mode copy (.mark-logo .for-dark)',
    find: '<img class="for-dark" src="assets/logo/haofe-logo-mono-cream.svg" alt="" width="44" height="44">',
    replace: '<img class="for-dark" src="assets/logo/haofe-logo-mono-cream.svg" alt="" width="44" height="44" loading="lazy" decoding="async">'
  });

  const fontLink = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Rubik:wght@400..700&family=Secular+One&family=Playpen+Sans+Hebrew:wght@400;600&display=swap">';

  const heroPreload =
`<link rel="preload" as="image" type="image/avif" media="(min-width: 1000px)" imagesrcset="${srcset(P, 'avif')}" imagesizes="${SIZES.plate}" fetchpriority="high">
<link rel="preload" as="image" type="image/avif" media="(max-width: 999.98px)" imagesrcset="${srcset(PM, 'avif')}" imagesizes="${SIZES['plate-m']}" fetchpriority="high">`;

  const lqipCss =
`<style>
.pb picture { display: contents; }
.pb picture > source { display: none; }
.pb img[data-lqip] { background: var(--lqip) 50% 100% / 100% 100% no-repeat; }
.pb .sc-plate[data-lqip] { background-size: cover; }
.pb .prod[data-lqip] { background-size: contain; background-position: 50% 80%; }
</style>`;
  const lqipJs =
`<script>
/* drop the blurred placeholder once the real image has loaded (load does not bubble: capture it) */
document.addEventListener('load', function (e) { var t = e.target; if (t.tagName === 'IMG' && t.hasAttribute('data-lqip')) t.removeAttribute('data-lqip'); }, true);
</script>`;

  return { list, fontLink, heroPreload, lqipCss: lqip ? lqipCss : '<style>.pb picture { display: contents; } .pb picture > source { display: none; }</style>', lqipJs, manifest: m };
};
