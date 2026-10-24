#!/usr/bin/env node
/* ==========================================================================
   האופה · site build. Node 22, built-ins only. Run from anywhere:

     node clients/haofe/site/build.mjs            the site, clean URLs (/accessibility), for Vercel
     node clients/haofe/site/build.mjs --preview  the same pages with file links (accessibility.html),
                                                  so the folder also works as a private preview
     node clients/haofe/site/build.mjs --launch   refuses to build while anything is unconfirmed

   WHAT IT DOES
     1 Reads the approved page from the prototype: the <template id="proto"> in concepts/b.html.
       The prototype stays the single source of the design; this script only turns it into pages:
         - the template's root <div class="proto pb"> becomes <html class="pb rm">: the boot
           script swaps rm for anim before the first paint and sets data-mode (src/theme.js)
         - data-id / data-labelledby / data-controls (made unique by shell.js in the prototype)
           become real id / aria-labelledby / aria-controls; data-section="x" also gets id="x"
         - <a href="#" data-jump="x"> becomes a real link: #x on the home page, /#x elsewhere;
           the skip link goes to #main, the logo to the home page, and the footer and menu links
           to the accessibility statement and the privacy policy go to those pages
     2 Writes the home page and the text pages (src/pages/*.html), all with the same header,
       footer and bar, one <head> per page (site.json), and JSON-LD built from site.json's
       verified facts only.
     3 Copies the CSS and JS from concepts/ (b.css, the three motion modules) and src/ (theme,
       site, runtime, page.css, fonts), and only the image files the pages reference.
     4 Writes the security headers (the boot script's sha256 in the Content-Security-Policy) twice:
       vercel.json for Vercel and dist/_headers for Cloudflare Pages or Netlify; robots.txt and,
       once site.json has an origin, sitemap.xml.
     5 Checks the output and stops on: a duplicate id, a link to a missing #id or page, an <img>
       without alt/width/height, a page without exactly one <h1>, "haofeapp" anywhere, and with
       --launch: any .tbd marker (a detail still waiting for the owner) or a null origin.
   ========================================================================== */
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { menuPage, branchPage, branchLd } from './src/pages.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CONCEPT = join(HERE, '..', 'concepts');
const SRC = join(HERE, 'src');
const OUT = join(HERE, 'dist');
const PREVIEW = process.argv.includes('--preview');
const LAUNCH = process.argv.includes('--launch');
const site = JSON.parse(readFileSync(join(HERE, 'site.json'), 'utf8'));
const catalogue = JSON.parse(readFileSync(join(HERE, '..', 'data', 'products.json'), 'utf8'));

const problems = [];
function fail(msg) { problems.push(msg); }

/* a link to another page: clean URLs on the site, file names in a preview. In a preview the home
   page is home.html, so a host that keeps index.html for its own launcher page can serve it too */
const HOME_FILE = PREVIEW ? 'home.html' : 'index.html';
function page(name) {
  if (PREVIEW) return name === 'index' ? HOME_FILE : name + '.html';
  return name === 'index' ? '/' : '/' + name;
}
/* replace exactly `count` occurrences, or report that the prototype changed under us */
function swap(html, from, to, count = 1) {
  const n = html.split(from).length - 1;
  if (n !== count) fail(`expected ${count}× ${JSON.stringify(from.slice(0, 70))} in the template, found ${n}`);
  return html.split(from).join(to);
}
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }

/* ---------- 1 the prototype's page ---------- */
const proto = readFileSync(join(CONCEPT, 'b.html'), 'utf8');
const tpl = proto.slice(proto.indexOf('<template id="proto">') + 21, proto.indexOf('</template>'));
const rootOpen = tpl.indexOf('<div class="proto pb"');
let body = tpl.slice(tpl.indexOf('>', rootOpen) + 1, tpl.lastIndexOf('</div>')).trim();

body = swap(body, '<a class="skip" href="#" data-jump="top">', '<a class="skip" href="#main">');
body = swap(body, '<a class="mark" href="#" data-jump="top"', `<a class="mark" href="${page('index')}"`);
body = swap(body, '<a class="menu-small" href="#" data-jump="top">הצהרת נגישות <span class="tbd">תיכתב אחרי הבדיקה</span></a>',
  `<a class="menu-small" href="${page('accessibility')}">הצהרת נגישות</a>`);
body = swap(body, '<li><a href="#" data-jump="top">הצהרת נגישות</a> <span class="tbd">תיכתב אחרי הבדיקה</span></li>',
  `<li><a href="${page('accessibility')}">הצהרת נגישות</a></li>`);
body = swap(body, '<li><a href="#" data-jump="top">מדיניות פרטיות</a> <span class="tbd">לפי מה שהאתר אוסף</span></li>',
  `<li><a href="${page('privacy')}">מדיניות פרטיות</a></li>`);
body = body.replace(/href="#" data-jump="([\w-]+)"/g, 'href="@HOME@#$1"');
if (/data-jump=/.test(body)) fail('a data-jump link was not converted');
body = body.replace(/data-section="([\w-]+)"/g, 'id="$1" data-section="$1"');
body = body.replace(/\bdata-id="/g, 'id="').replace(/\bdata-labelledby="/g, 'aria-labelledby="').replace(/\bdata-controls="/g, 'aria-controls="');
body = swap(body, '<main class="pg-main" id="main">', '<main class="pg-main" id="main" tabindex="-1">');

/* the site has more pages than the one-page prototype: the header, the map labels and the footer
   link to them (the prototype keeps its in-page links) */
body = swap(body, '        <a href="@HOME@#boxes">מה יש בקופסה</a>\n', `        <a href="${page('menu')}">התפריט</a>\n`);
body = swap(body, '        <a href="@HOME@#feed">מהפיד</a>\n', `        <a href="${page('about')}">הסיפור</a>\n`);
body = swap(body, '        <a href="@HOME@#b2b">לעסקים</a>\n', `        <a href="${page('business')}">לעסקים</a>\n`);
body = swap(body, '      <a href="@HOME@#boxes">מה יש בקופסה</a>\n', `      <a href="${page('menu')}">התפריט</a>\n`);
body = swap(body, '      <a href="@HOME@#feed">מהפיד</a>\n', `      <a href="${page('about')}">הסיפור שלנו</a>\n`);
body = swap(body, '      <a href="@HOME@#b2b">לעסקים ולרשתות</a>\n', `      <a href="${page('business')}">לעסקים ולרשתות</a>\n`);
for (const b of site.branches) {
  const at = body.indexOf(`<li class="place" data-place="${b.id}"`), dl = body.indexOf('</dl>', at) + 5;   // the label, not the pin
  if (at < 0) { fail('map label missing for ' + b.id); continue; }
  body = body.slice(0, dl) + `\n            <p class="lbl-more"><a href="${page(b.id)}">לעמוד הסניף ${b.inCity}</a></p>` + body.slice(dl);
  body = swap(body, `<a href="@HOME@#${b.id}">`, `<a href="${page(b.id)}">`);
}
{
  const at = body.indexOf('<li class="place place--fac" data-place="factory"'), dl = body.indexOf('</dl>', at) + 5;
  if (at < 0) fail('map label missing for the production house');
  body = body.slice(0, dl) + `\n            <p class="lbl-more"><a href="${page('business')}">לעסקים ולרשתות</a></p>` + body.slice(dl);
}
body = swap(body, '<nav class="ft-cities" aria-label="הסניפים במפה">', '<nav class="ft-cities" aria-label="הסניפים">');
body = swap(body, '<p class="ft-b2b">לעסקים ולרשתות: <span class="tbd">איש קשר לאישורכם</span></p>',
  `<p class="ft-b2b"><a href="${page('business')}">לעסקים ולרשתות</a> · <a href="${page('about')}">הסיפור שלנו</a> · <a href="${page('menu')}">התפריט</a></p>`);
{ /* a way from the six boxes to the whole menu, at the end of the boxes section */
  const order = body.indexOf('<section class="order-sec"');
  const close = body.lastIndexOf('</section>', order), div = body.lastIndexOf('</div>', close);
  body = body.slice(0, div) + `  <p class="boxes-more"><a class="btn-b" href="${page('menu')}">לתפריט המלא, ${catalogue.counts.products} מוצרים</a></p>\n    ` + body.slice(div);
}

/* the shared frame of every page: everything around <main> */
const mainAt = body.indexOf('<main'), mainEnd = body.indexOf('</main>') + 7;
const frameTop = body.slice(0, mainAt), frameBottom = body.slice(mainEnd);
const homeMain = body.slice(mainAt, mainEnd);

/* ---------- 2 pages ---------- */
const BOOT = (() => {
  const t = readFileSync(join(SRC, 'theme.js'), 'utf8');
  return t.slice(t.indexOf('/*! boot:start */') + 17, t.indexOf('/*! boot:end */')).trim();
})();
const BOOT_HASH = 'sha256-' + createHash('sha256').update(BOOT).digest('base64');

const CSS = ['b.css', 'b-motion-hero.css', 'b-motion-scroll.css', 'b-motion-micro.css', 'page.css'];
const TEXT_CSS = ['b.css', 'b-motion-micro.css', 'page.css'];
const JS = ['theme.js', 'site.js', 'b-motion-hero.js', 'b-motion-scroll.js', 'b-motion-micro.js', 'runtime.js'];
const TEXT_JS = ['theme.js', 'site.js', 'b-motion-micro.js', 'runtime.js'];

function jsonld() {
  const org = {
    '@type': 'Organization', '@id': '#org', name: site.name,
    telephone: site.orderLine.tel, sameAs: site.sameAs
  };
  if (site.origin) { org.url = site.origin + '/'; org.logo = site.origin + '/assets/logo/haofe-logo-512.png'; }
  const places = site.branches.map(b => {
    const p = {
      '@type': 'Bakery', name: b.name, parentOrganization: { '@id': '#org' },
      address: { '@type': 'PostalAddress', streetAddress: b.street, addressLocality: b.city, addressCountry: 'IL' },
      geo: { '@type': 'GeoCoordinates', latitude: b.geo[0], longitude: b.geo[1] }
    };
    if (b.telephone) p.telephone = b.telephone;
    if (site.origin) p.url = site.origin + '/#' + b.id;
    return p;
  });
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': [org, ...places] });
}

function head(name, { css, js, ld }) {
  const m = site.pages[name];
  const url = site.origin ? site.origin + (name === 'index' ? '/' : '/' + name) : null;
  return `<!doctype html>
<html lang="he" dir="rtl" class="pb rm">
<head>
<meta charset="utf-8">
<script>${BOOT}</script>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(m.title)}</title>
<meta name="description" content="${esc(m.description)}">
${site.origin && name !== '404' ? '' : '<meta name="robots" content="noindex">\n'}${url ? `<link rel="canonical" href="${url}">\n<meta property="og:url" content="${url}">\n` : ''}<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:locale" content="he_IL">
<meta property="og:title" content="${esc(m.title)}">
<meta property="og:description" content="${esc(m.description)}">
<meta name="theme-color" content="#F7F1E6">
<link rel="icon" href="assets/logo/haofe-logo-badge.svg" type="image/svg+xml">
<link rel="preload" href="fonts/SecularOne-hebp.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="fonts/Rubik-400-700-heb.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="fonts/fonts.css">
${css.map(f => `<link rel="stylesheet" href="assets/${f}">`).join('\n')}
${js.map(f => `<script defer src="assets/${f}"></script>`).join('\n')}
${ld ? `<script type="application/ld+json">${ld}</script>\n` : ''}</head>
<body>
`;
}

const PREVIEW_NOTE = site.origin ? '' :
  '<aside class="preview-note" aria-label="תצוגה מקדימה"><p>תצוגה מקדימה של האתר החדש. פרטים בקו מקווקו ממתינים לאישור.</p></aside>\n';

function frame(main, home) {
  const fix = s => s.split('@HOME@').join(home);
  return fix(frameTop).replace('<header class="hd">', PREVIEW_NOTE + '<header class="hd">') + main + fix(frameBottom);
}

const TEXT = { css: TEXT_CSS, js: TEXT_JS };
const fill = html => html.split('@HOME@').join(page('index')).replace(/@P:([\w-]+)@/g, (_, n) => page(n));
function textPage(name, inner, opts = {}) {
  const main = `<main class="doc${opts.wide ? ' doc--wide' : ''}" id="main" tabindex="-1"><div class="in">\n${inner}\n</div></main>`;
  let html = head(name, { ...TEXT, ld: opts.ld }) + frame(main, page('index')) + '\n</body>\n</html>\n';
  /* the current page in the header nav */
  html = html.split(`<a href="${page(name)}">`).join(`<a href="${page(name)}" aria-current="page">`);
  /* the 404 page is served at any missing path, so its files are addressed from the root */
  if (name === '404' && !PREVIEW) html = html.replace(/(src|href)="(assets|fonts)\//g, '$1="/$2/');
  return html;
}
const fragment = name => fill(readFileSync(join(SRC, 'pages', name + '.html'), 'utf8').trim());

const pages = {};
pages[HOME_FILE] = head('index', { css: CSS, js: JS, ld: jsonld() }) + frame(homeMain.split('@HOME@').join(''), '') + '\n</body>\n</html>\n';
pages['menu.html'] = textPage('menu', menuPage(catalogue, page), { wide: true });
for (const b of site.branches) pages[b.id + '.html'] = textPage(b.id, branchPage(b, site.branches, page), { ld: branchLd(b, site) });
for (const name of ['about', 'business', 'accessibility', 'privacy', '404']) pages[name + '.html'] = textPage(name, fragment(name));

/* ---------- 3 files ---------- */
rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'assets'), { recursive: true });
mkdirSync(join(OUT, 'fonts'), { recursive: true });
for (const f of ['b.css', 'b-motion-hero.css', 'b-motion-scroll.css', 'b-motion-micro.css', 'b-motion-hero.js', 'b-motion-scroll.js', 'b-motion-micro.js']) {
  copyFileSync(join(CONCEPT, f), join(OUT, 'assets', f));
}
for (const f of ['theme.js', 'site.js', 'runtime.js', 'page.css']) copyFileSync(join(SRC, f), join(OUT, 'assets', f));
for (const f of ['fonts.css', 'SecularOne-hebp.woff2', 'Rubik-400-700-heb.woff2', 'PlaypenSansHebrew-600-hebp.woff2', 'OFL-secularone.txt', 'OFL-rubik.txt', 'OFL-playpensanshebrew.txt']) {
  copyFileSync(join(SRC, 'fonts', f), join(OUT, 'fonts', f));
}
const assets = new Set();
for (const html of Object.values(pages)) {
  for (const m of html.matchAll(/assets\/(?:ai|logo)\/[\w./-]+?\.(?:avif|webp|png|svg|jpg)/g)) assets.add(m[0]);
}
for (const a of assets) {
  const from = join(CONCEPT, a);
  if (!existsSync(from)) { fail('missing image ' + a); continue; }
  mkdirSync(dirname(join(OUT, a)), { recursive: true });
  copyFileSync(from, join(OUT, a));
}
mkdirSync(join(OUT, 'assets', 'logo'), { recursive: true });
copyFileSync(join(HERE, '..', 'brand', 'png', 'haofe-logo-512.png'), join(OUT, 'assets', 'logo', 'haofe-logo-512.png'));
for (const [file, html] of Object.entries(pages)) writeFileSync(join(OUT, file), html);

writeFileSync(join(OUT, 'robots.txt'), site.origin
  ? `User-agent: *\nAllow: /\n\nSitemap: ${site.origin}/sitemap.xml\n`
  : '# Preview: no address yet, so search engines are kept out (site.json "origin" is null).\nUser-agent: *\nDisallow: /\n');
if (site.origin) {
  const urls = ['/', '/menu', ...site.branches.map(b => '/' + b.id), '/about', '/business', '/accessibility', '/privacy']
    .map(p => `  <url><loc>${site.origin}${p}</loc></url>`).join('\n');
  writeFileSync(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
}

const vercel = {
  $schema: 'https://openapi.vercel.sh/vercel.json',
  outputDirectory: 'dist',
  cleanUrls: true,
  trailingSlash: false,
  headers: [{
    source: '/(.*)',
    headers: [
      { key: 'Content-Security-Policy', value: `default-src 'self'; script-src 'self' '${BOOT_HASH}'; style-src 'self'; style-src-attr 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests` },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' }
    ]
  }, {
    source: '/fonts/(.*)',
    headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }]
  }]
};
if (!site.origin) vercel.headers.push({ source: '/(.*)', headers: [{ key: 'X-Robots-Tag', value: 'noindex' }] });
writeFileSync(join(HERE, 'vercel.json'), JSON.stringify(vercel, null, 2) + '\n');
/* the same headers for Cloudflare Pages or Netlify, which read dist/_headers */
writeFileSync(join(OUT, '_headers'), vercel.headers.map(h =>
  h.source.replace('(.*)', '*') + '\n' + h.headers.map(x => `  ${x.key}: ${x.value}`).join('\n')).join('\n') + '\n');

/* ---------- 4 checks ---------- */
const PAGE_FILES = new Set(Object.keys(pages));
for (const [file, html] of Object.entries(pages)) {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dup.length) fail(`${file}: duplicate id ${[...new Set(dup)].join(', ')}`);
  for (const m of html.matchAll(/\s(?:aria-labelledby|aria-controls|for)="([^"]+)"/g)) {
    for (const id of m[1].split(/\s+/)) if (!ids.includes(id)) fail(`${file}: ${m[0].trim()} points to a missing id`);
  }
  for (const m of html.matchAll(/href="([^"]*)"/g)) {
    const href = m[1];
    if (/^(https?:|tel:|mailto:)/.test(href)) continue;
    const [path, hash] = href.split('#');
    const target = path === '' ? file : PREVIEW ? path : (path === '/' ? HOME_FILE : path.slice(1) + '.html');
    if (/^\/?(assets|fonts)\//.test(path)) continue;
    if (!PAGE_FILES.has(target)) { fail(`${file}: link to a missing page ${href}`); continue; }
    if (hash && PAGE_FILES.has(target)) {
      const tIds = [...pages[target].matchAll(/\sid="([^"]+)"/g)].map(x => x[1]);
      if (!tIds.includes(hash)) fail(`${file}: link to a missing #${hash} (${href})`);
    }
  }
  for (const m of html.matchAll(/<img\b[^>]*>/g)) {
    if (!/\salt="/.test(m[0]) || !/\swidth="/.test(m[0]) || !/\sheight="/.test(m[0])) fail(`${file}: <img> without alt, width or height: ${m[0].slice(0, 90)}`);
  }
  const h1 = (html.match(/<h1\b/g) || []).length;
  if (h1 !== 1) fail(`${file}: ${h1} <h1> elements`);
  if (/haofeapp/i.test(html)) fail(`${file}: mentions haofeapp (the ordering app is not part of the site)`);
  if (LAUNCH && /class="tbd"|class="[^"]*\btbd\b/.test(html)) fail(`${file}: still has details waiting for the owner (.tbd)`);
}
if (LAUNCH && !site.origin) fail('site.json has no origin (the domain is not decided)');

if (problems.length) {
  console.error('build stopped:\n  ' + problems.join('\n  '));
  process.exit(1);
}
const tbd = Object.values(pages).reduce((n, h) => n + (h.match(/\btbd\b/g) || []).length, 0);
console.log(`built ${Object.keys(pages).length} pages and ${assets.size} images into ${OUT}${PREVIEW ? ' (preview links)' : ''}`);
console.log(`boot script ${BOOT_HASH} (written to vercel.json)`);
console.log(`${tbd} details still marked for the owner's confirmation${LAUNCH ? '' : ' (a --launch build refuses while any is left)'}`);
