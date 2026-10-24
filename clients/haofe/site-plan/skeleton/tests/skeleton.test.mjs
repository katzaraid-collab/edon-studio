// האופה · skeleton tests (Playwright, Chromium). No test framework: node tests/skeleton.test.mjs
// Starts tools/serve.mjs on a free port (CSP from vercel.json enforced, motion modules ported on
// the fly from the live concepts/ files), runs every case, prints a table, exits 1 on any failure.
// Writes screenshots and results.json to tests/out/.

import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { start } from '../tools/serve.mjs';
import { bootSnippet, inlineBoot, sha256 } from '../tools/csp-hash.mjs';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = createRequire('/opt/node22/lib/node_modules/')('playwright'); }
const { chromium } = playwright;

const SK = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(SK, 'tests', 'out');
mkdirSync(OUT, { recursive: true });
const LIGHT_BG = 'rgb(247, 241, 230)';   // --bg light, b.css section 1
const DARK_BG = 'rgb(23, 16, 11)';       // --bg dark

const { server, url: ORIGIN } = await start(0);
const PAGE = ORIGIN + '/site-plan/skeleton/';
const browser = await chromium.launch();
const results = [];

function assert(cond, msg) { if (!cond) throw new Error(msg); }

/* a fresh context per case; collects console errors, page errors and CSP violations */
async function open(opts = {}) {
  const ctx = await browser.newContext({
    viewport: opts.viewport || { width: 1280, height: 820 },
    colorScheme: opts.colorScheme || 'light',
    reducedMotion: opts.reducedMotion || 'no-preference',
    javaScriptEnabled: opts.js !== false
  });
  const page = await ctx.newPage();
  const log = { errors: [], warnings: [] };
  page.on('console', (m) => { if (m.type() === 'error') log.errors.push(m.text()); if (m.type() === 'warning') log.warnings.push(m.text()); });
  page.on('pageerror', (e) => log.errors.push('pageerror: ' + e.message));
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ' + (e.blockedURI || e.sample || '')));
  });
  if (opts.init) await page.addInitScript(opts.init.fn, opts.init.arg);
  if (opts.route) await opts.route(page);
  return { ctx, page, log };
}
async function scrollThrough(page, step = 300, pause = 90) {
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y <= h; y += step) {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y);
    await page.waitForTimeout(pause);
  }
}
async function test(name, fn) {
  const t0 = Date.now();
  try {
    const note = await fn();
    results.push({ name, ok: true, ms: Date.now() - t0, note: note || '' });
  } catch (err) {
    results.push({ name, ok: false, ms: Date.now() - t0, note: err.message.split('\n')[0] });
  }
}
const blockScripts = (except = []) => async (page) => {
  await page.route(/\.js(\?.*)?$/, (r) => (except.some((e) => r.request().url().includes(e)) ? r.continue() : r.abort()));
};

/* ---------- static checks ---------- */

await test('inline boot == theme.js boot, and its hash is in the CSP', async () => {
  const html = readFileSync(join(SK, 'index.html'), 'utf8');
  const vercel = readFileSync(join(SK, 'vercel.json'), 'utf8');
  const boot = bootSnippet();
  assert(inlineBoot(html) === boot, 'index.html inline script differs from theme.js boot');
  assert(vercel.includes(sha256(boot)), 'vercel.json CSP lacks ' + sha256(boot));
  return sha256(boot);
});

await test('order "soon": no app URL and no live-only markup in the HTML', async () => {
  const raw = readFileSync(join(SK, 'index.html'), 'utf8');
  assert(!/haofeapp/i.test(raw), 'found "haofeapp"');
  const html = raw.replace(/<!--[\s\S]*?-->/g, '');   // the markup, not the comments that explain it
  assert(!/when-live|data-live-href/.test(html), 'found live-only markup');
  return 'grep haofeapp: 0';
});

/* ---------- theme ---------- */

await test('first visit is light even when the OS is dark (inline boot only, all external JS blocked)', async () => {
  const { ctx, page, log } = await open({ colorScheme: 'dark', route: blockScripts() });
  await page.goto(PAGE, { waitUntil: 'load' });
  const s = await page.evaluate(() => ({ mode: document.documentElement.dataset.mode, cls: document.documentElement.className, bg: getComputedStyle(document.documentElement).backgroundColor, theme: typeof window.HaofeTheme }));
  await ctx.close();
  assert(s.mode === 'light', 'mode ' + s.mode);
  assert(s.bg === LIGHT_BG, 'bg ' + s.bg);
  assert(/\banim\b/.test(s.cls) && !/\brm\b/.test(s.cls), 'classes ' + s.cls);
  assert(s.theme === 'undefined', 'theme.js should be blocked in this case');
  return `mode=${s.mode} bg=${s.bg} classes="${s.cls}"`;
});

await test('saved dark is applied before <body> exists (no flash), external JS blocked', async () => {
  const { ctx, page } = await open({
    route: blockScripts(),
    init: { fn: () => {
      try { localStorage.setItem('haofe:theme', 'dark'); } catch (e) {}
      new MutationObserver((list, obs) => {
        if (document.body && !window.__atBody) { window.__atBody = document.documentElement.getAttribute('data-mode'); obs.disconnect(); }
      }).observe(document, { childList: true, subtree: true });
    } }
  });
  await page.goto(PAGE, { waitUntil: 'load' });
  const s = await page.evaluate(() => ({ atBody: window.__atBody, mode: document.documentElement.dataset.mode, bg: getComputedStyle(document.documentElement).backgroundColor }));
  await ctx.close();
  assert(s.atBody === 'dark', 'data-mode when <body> was inserted: ' + s.atBody);
  assert(s.bg === DARK_BG, 'bg ' + s.bg);
  return `data-mode at <body> insertion = ${s.atBody}; bg ${s.bg}`;
});

await test('first paint is already dark while theme.js is still downloading (2.5 s delay)', async () => {
  const { ctx, page } = await open({
    init: { fn: () => { try { localStorage.setItem('haofe:theme', 'dark'); } catch (e) {} } },
    route: async (p) => p.route(/theme\.js/, async (r) => { await new Promise((ok) => setTimeout(ok, 2500)); r.continue(); })
  });
  await page.goto(PAGE, { waitUntil: 'commit' });
  await page.waitForFunction(() => document.body && document.fonts && performance.getEntriesByType('paint').length > 0, null, { timeout: 5000 });
  const pending = await page.evaluate(() => typeof window.HaofeTheme === 'undefined');
  const shot = await page.screenshot({ path: join(OUT, 'paint-while-theme-js-pending.png'), clip: { x: 600, y: 10, width: 40, height: 20 } });
  await ctx.close();
  assert(pending, 'theme.js had already run, the delay did not hold');
  // the header paper over the dark page: decode the PNG's first pixel roughly through a canvas
  const p2 = await browser.newPage();
  const lum = await p2.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(1, 1, 1, 1).data; return 0.2126 * d[0] + 0.7152 * d[1] + 0.0722 * d[2];
  }, shot.toString('base64'));
  await p2.close();
  assert(lum < 80, 'header pixel luminance ' + lum.toFixed(0) + ' (light page painted)');
  return `theme.js pending, header luminance ${lum.toFixed(0)} (dark)`;
});

await test('toggle on desktop: flips once, aria-pressed follows, choice saved and restored on reload', async () => {
  const { ctx, page, log } = await open();
  await page.goto(PAGE, { waitUntil: 'load' });
  await page.click('.theme-btn');
  await page.waitForTimeout(200);
  const a = await page.evaluate(() => ({ mode: document.documentElement.dataset.mode, pressed: document.querySelector('.theme-btn').getAttribute('aria-pressed'), saved: localStorage.getItem('haofe:theme') }));
  await page.reload({ waitUntil: 'load' });
  const b = await page.evaluate(() => ({ mode: document.documentElement.dataset.mode, pressed: document.querySelector('.theme-btn').getAttribute('aria-pressed') }));
  await page.click('.theme-btn');
  const c = await page.evaluate(() => localStorage.getItem('haofe:theme'));
  await ctx.close();
  assert(a.mode === 'dark' && a.pressed === 'true' && a.saved === 'dark', 'after click ' + JSON.stringify(a));
  assert(b.mode === 'dark' && b.pressed === 'true', 'after reload ' + JSON.stringify(b));
  assert(c === 'light', 'second click saved ' + c);
  assert(!log.errors.length, log.errors.join(' | '));
  return JSON.stringify({ a, b, c });
});

await test('toggle on a phone: b-motion-micro swaps inside a document view transition and the choice is still saved', async () => {
  const { ctx, page, log } = await open({
    viewport: { width: 390, height: 780 },
    init: { fn: () => {
      window.__vt = 0;
      const orig = Document.prototype.startViewTransition;
      if (orig) Document.prototype.startViewTransition = function (cb) { window.__vt++; return orig.call(this, cb); };
    } }
  });
  await page.goto(PAGE, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  await page.click('.theme-btn');
  await page.waitForTimeout(900);
  const s = await page.evaluate(() => ({ mode: document.documentElement.dataset.mode, saved: localStorage.getItem('haofe:theme'), vt: window.__vt, pressed: document.querySelector('.theme-btn').getAttribute('aria-pressed') }));
  await ctx.close();
  assert(s.vt === 1, 'document.startViewTransition calls: ' + s.vt);
  assert(s.mode === 'dark' && s.saved === 'dark' && s.pressed === 'true', JSON.stringify(s));
  assert(!log.errors.length, log.errors.join(' | '));
  return JSON.stringify(s);
});

await test('localStorage that throws on access: page stays light, toggle works for the visit, no errors', async () => {
  const { ctx, page, log } = await open({
    init: { fn: () => { Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('blocked', 'SecurityError'); } }); } }
  });
  await page.goto(PAGE, { waitUntil: 'load' });
  const a = await page.evaluate(() => document.documentElement.dataset.mode);
  await page.click('.theme-btn');
  const b = await page.evaluate(() => document.documentElement.dataset.mode);
  await page.reload({ waitUntil: 'load' });
  const c = await page.evaluate(() => document.documentElement.dataset.mode);
  await ctx.close();
  assert(a === 'light' && b === 'dark' && c === 'light', `modes ${a} -> ${b} -> reload ${c}`);
  assert(!log.errors.length, log.errors.join(' | '));
  return `light -> dark (click) -> light (reload, nothing saved)`;
});

await test('theme follows a change made in another tab (storage event)', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 } });
  const p1 = await ctx.newPage(); const p2 = await ctx.newPage();
  await p1.goto(PAGE, { waitUntil: 'load' }); await p2.goto(PAGE, { waitUntil: 'load' });
  await p1.click('.theme-btn');
  await p2.waitForFunction(() => document.documentElement.dataset.mode === 'dark', null, { timeout: 3000 });
  await ctx.close();
  return 'second tab switched to dark';
});

/* ---------- CSP ---------- */

await test('CSP from vercel.json: zero violations over a full scroll at 1280 and 390', async () => {
  const notes = [];
  for (const vp of [{ width: 1280, height: 820 }, { width: 390, height: 780 }]) {
    const { ctx, page, log } = await open({ viewport: vp });
    const resp = await page.goto(PAGE, { waitUntil: 'load' });
    const csp = resp.headers()['content-security-policy'] || '';
    await scrollThrough(page);
    const v = await page.evaluate(() => window.__csp);
    await ctx.close();
    assert(csp.includes("script-src 'self' 'sha256-"), 'no CSP header served');
    assert(!v.length, vp.width + ': ' + v.join(' | '));
    assert(!log.errors.length, log.errors.join(' | '));
    notes.push(vp.width + ': 0');
  }
  return notes.join(', ');
});

await test('CSP is really enforced: an edited inline boot is blocked (negative control)', async () => {
  const { ctx, page } = await open({
    route: async (p) => p.route(/\/site-plan\/skeleton\/(index\.html)?$/, async (r) => {
      const res = await r.fetch();
      const body = (await res.text()).replace("var r=d.documentElement;", "var r=d.documentElement; ");
      r.fulfill({ response: res, body });
    })
  });
  await page.goto(PAGE, { waitUntil: 'domcontentloaded' });
  const v = await page.evaluate(() => window.__csp);
  await ctx.close();
  assert(v.some((x) => /script-src/.test(x)), 'expected a script-src violation, got ' + JSON.stringify(v));
  return v[0];
});

/* ---------- runtime adapter ---------- */

await test('runtime boots the three ported modules with contract-2 ctx', async () => {
  const { ctx, page, log } = await open();
  const ported = [];
  page.on('response', (r) => { if (/b-motion-.*\.js/.test(r.url())) ported.push(r.headers()['x-ported']); });
  await page.goto(PAGE, { waitUntil: 'load' });
  const s = await page.evaluate(() => {
    const c = window.HaofeRuntime.ctx(false);
    return { status: window.__haofeRuntime, ioRoot: c.ioRoot, scrollEvents: c.scrollEvents === window, scroller: c.scroller === document.scrollingElement, vtHost: c.vtHost === document, view: c.view(), cls: document.documentElement.className };
  });
  await ctx.close();
  assert(JSON.stringify(s.status.ran) === JSON.stringify(['b-hero', 'b-scroll', 'b-micro']), 'ran ' + s.status.ran);
  assert(!s.status.failed.length && !s.status.skipped.length, JSON.stringify(s.status));
  assert(s.ioRoot === null && s.scrollEvents && s.scroller && s.vtHost && s.view.top === 0 && s.view.scale === 1, JSON.stringify(s));
  assert(ported.length === 3 && ported.every((x) => x === 'contract-2'), 'X-Ported ' + ported);
  assert(!log.errors.length, log.errors.join(' | '));
  return `ran ${s.status.ran.join(', ')}; root classes "${s.cls}"`;
});

await test('IntersectionObserver uses the viewport: ticker and hero idle off screen and wake on return', async () => {
  const { ctx, page } = await open();
  await page.goto(PAGE, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  const top = await page.evaluate(() => ({ tk: document.querySelector('.ticker').classList.contains('sx-off'), hero: document.querySelector('.hero').classList.contains('b-off') }));
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  await page.waitForTimeout(400);
  const bottom = await page.evaluate(() => ({ tk: document.querySelector('.ticker').classList.contains('sx-off'), hero: document.querySelector('.hero').classList.contains('b-off') }));
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(400);
  const back = await page.evaluate(() => ({ tk: document.querySelector('.ticker').classList.contains('sx-off'), hero: document.querySelector('.hero').classList.contains('b-off') }));
  await ctx.close();
  assert(!top.tk && !top.hero, 'at top ' + JSON.stringify(top));
  assert(bottom.tk && bottom.hero, 'at bottom ' + JSON.stringify(bottom));
  assert(!back.tk && !back.hero, 'back at top ' + JSON.stringify(back));
  return 'top: on, bottom: off, top again: on';
});

await test('window scroll drives the hero depth (ScrollTimeline on document.scrollingElement)', async () => {
  const { ctx, page } = await open();
  await page.goto(PAGE, { waitUntil: 'load' });
  await page.waitForTimeout(1600);   // the opening is done by ~1.4 s
  const read = () => page.evaluate(() => getComputedStyle(document.querySelector('.sc-front')).transform);
  const t0 = await read();
  await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'instant' }));
  await page.waitForTimeout(300);
  const t1 = await read();
  await ctx.close();
  assert(t0 !== t1, 'front plane transform did not change with scroll: ' + t0);
  return `${t0} -> ${t1}`;
});

await test('scroll entrances: every [data-rv] finishes, the leap flies from the bag inside <body>', async () => {
  const { ctx, page, log } = await open({
    init: { fn: () => {
      window.__fly = { max: 0, parent: null };
      new MutationObserver(() => {
        const n = document.querySelectorAll('.sx-fly').length;
        if (n > window.__fly.max) window.__fly.max = n;
        const layer = document.querySelector('.sx-layer');
        if (layer) window.__fly.parent = layer.parentElement.tagName;
      }).observe(document, { childList: true, subtree: true });
    } }
  });
  await page.goto(PAGE, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await scrollThrough(page, 120, 60);
  await page.waitForTimeout(2500);
  const s = await page.evaluate(() => ({ rv: document.querySelectorAll('[data-rv]').length, done: document.querySelectorAll('[data-rv].rv-done, .box[data-rv]:not(.sx-hold)').length, hold: document.querySelectorAll('.sx-hold').length, fly: window.__fly, left: document.querySelectorAll('.sx-fly').length }));
  await page.screenshot({ path: join(OUT, 'after-scroll-1280.png'), fullPage: true });
  await ctx.close();
  assert(s.hold === 0, s.hold + ' boxes still waiting for their product');
  assert(s.done === s.rv, `${s.done}/${s.rv} entrances finished`);
  assert(s.fly.max > 0 && s.fly.parent === 'BODY', 'leap copies ' + JSON.stringify(s.fly));
  assert(s.left === 0, s.left + ' flying copies left behind');
  assert(!log.errors.length, log.errors.join(' | '));
  return `${s.done}/${s.rv} entrances, up to ${s.fly.max} copies in flight, layer in <${s.fly.parent.toLowerCase()}>`;
});

await test('a jump past content (nav link, End key) never leaves entrances hidden above the view', async () => {
  const { ctx, page, log } = await open();
  await page.goto(PAGE, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  await page.waitForTimeout(1200);
  const s = await page.evaluate(() => {
    const hidden = [...document.querySelectorAll('[data-rv]:not(.box)')].filter((el) => el.getBoundingClientRect().bottom <= 0 && getComputedStyle(el).opacity === '0');
    return { hidden: hidden.map((el) => el.className), above: [...document.querySelectorAll('[data-rv]')].filter((el) => el.getBoundingClientRect().bottom <= 0).length };
  });
  await ctx.close();
  assert(!s.hidden.length, 'still hidden above the view: ' + s.hidden.join(', '));
  assert(!log.errors.length, log.errors.join(' | '));
  return `${s.above} entrances above the view after the jump, 0 hidden`;
});

await test('reduced motion: html.rm, modules do nothing, static ticker', async () => {
  const { ctx, page, log } = await open({ reducedMotion: 'reduce' });
  await page.goto(PAGE, { waitUntil: 'load' });
  await page.waitForTimeout(500);
  const s = await page.evaluate(() => ({
    cls: document.documentElement.className, motes: !!document.querySelector('.b-motes'), split: !!document.querySelector('.b-split'),
    copies: [...document.querySelectorAll('.tk-list[aria-hidden]')].every((l) => getComputedStyle(l).display === 'none'),
    anims: document.getAnimations().length
  }));
  await ctx.close();
  assert(/\brm\b/.test(s.cls) && !/\b(anim|sx|mi)\b/.test(s.cls), 'classes ' + s.cls);
  assert(!s.motes && !s.split && s.copies, JSON.stringify(s));
  assert(!log.errors.length, log.errors.join(' | '));
  return `classes "${s.cls}", running animations ${s.anims}`;
});

await test('reduced-motion setting changes mid-visit: modules clean up and boot again', async () => {
  const { ctx, page, log } = await open();
  await page.goto(PAGE, { waitUntil: 'load' });
  await page.waitForTimeout(600);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(400);
  const a = await page.evaluate(() => ({ boots: window.__haofeRuntime.boots, cls: document.documentElement.className, motes: !!document.querySelector('.b-motes'), split: !!document.querySelector('.b-split'), sxNodes: document.querySelectorAll('[class*="sx-"], .mi-sheen').length }));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForTimeout(400);
  const b = await page.evaluate(() => ({ boots: window.__haofeRuntime.boots, cls: document.documentElement.className, motes: !!document.querySelector('.b-motes') }));
  await ctx.close();
  assert(a.boots === 2 && /\brm\b/.test(a.cls) && !/\b(sx|mi)\b/.test(a.cls) && !a.motes && !a.split && a.sxNodes === 0, 'reduced ' + JSON.stringify(a));
  assert(b.boots === 3 && /\bsx\b/.test(b.cls) && b.motes, 'restored ' + JSON.stringify(b));
  assert(!log.errors.length, log.errors.join(' | '));
  return `boots 1 -> ${a.boots} (reduce, clean) -> ${b.boots} (motion back)`;
});

await test('unported prototype modules are skipped with a warning; the site behaviour still works', async () => {
  // The untouched prototype files (?raw, no port). A module is ported when its own registration says
  // `contract: 2` next to its name (plan.md 6.2); only the modules WITHOUT that marker may be skipped,
  // and every module with it must run. Since 24.10.2026 all three prototype modules carry the marker,
  // so a probe module without it is appended to one of them: the guard itself stays under test.
  const MODULES = [['b-hero', 'b-motion-hero.js'], ['b-scroll', 'b-motion-scroll.js'], ['b-micro', 'b-motion-micro.js']];
  const CONCEPTS = resolve(SK, '../../concepts');
  const marked = (file, name) => new RegExp(`name:\\s*'${name}',\\s*contract:\\s*2\\b`).test(readFileSync(join(CONCEPTS, file), 'utf8'));
  const PROBE = "\n;(window.ProtoModules = window.ProtoModules || []).push({ name: 'legacy-probe', init: function () { window.__legacyProbeRan = true; } });\n";
  const expectRan = MODULES.filter(([name, file]) => marked(file, name)).map(([name]) => name);
  const expectSkipped = MODULES.filter(([name, file]) => !marked(file, name)).map(([name]) => name).concat('legacy-probe');
  const { ctx, page, log } = await open({
    viewport: { width: 390, height: 780 },
    route: async (p) => p.route(/b-motion-(hero|scroll|micro)\.js$/, async (r) => {
      const res = await r.fetch({ url: r.request().url() + '?raw' });
      const body = await res.text();
      r.fulfill({ response: res, body: /b-motion-micro\.js$/.test(r.request().url()) ? body + PROBE : body });
    })
  });
  await page.goto(PAGE, { waitUntil: 'load' });
  const st = await page.evaluate(() => ({ ...window.__haofeRuntime, seen: window.ProtoModules.map((m) => [m.name, m.contract >= 2]), probeRan: !!window.__legacyProbeRan }));
  await page.click('.menu-btn');
  const menuOpen = await page.evaluate(() => !document.getElementById('menu').hidden);
  await page.keyboard.press('Escape');
  await page.locator('.box .lid').first().click();
  const lid = await page.evaluate(() => document.querySelector('.box .lid').getAttribute('aria-expanded'));
  await ctx.close();
  // what the runtime saw agrees with the sources' markers
  const seenRan = st.seen.filter(([, ok]) => ok).map(([name]) => name);
  assert(JSON.stringify(seenRan) === JSON.stringify(expectRan), `markers in the sources ${expectRan} vs on the page ${seenRan}`);
  assert(JSON.stringify(st.ran) === JSON.stringify(expectRan), `ran ${st.ran}, expected ${expectRan}: ${JSON.stringify(st)}`);
  assert(JSON.stringify([...st.skipped].sort()) === JSON.stringify([...expectSkipped].sort()), `skipped ${st.skipped}, expected only the unmarked ${expectSkipped}`);
  assert(!st.failed.length && !st.probeRan, JSON.stringify(st));
  const warned = log.warnings.filter((w) => /contract: 2/.test(w));
  assert(warned.length === expectSkipped.length, `warnings: ${warned.length}, expected ${expectSkipped.length}: ` + log.warnings.join(' | '));
  assert(menuOpen && lid === 'true', `menu ${menuOpen}, lid ${lid}`);
  assert(!log.errors.length, log.errors.join(' | '));
  return `ran ${st.ran.join(', ') || '-'}; skipped only the unmarked: ${st.skipped.join(', ')}; menu and lids still work`;
});

/* ---------- page basics ---------- */

await test('keyboard: skip link first, menu closes when focus leaves it (A11Y-03) and on Esc', async () => {
  const { ctx, page } = await open({ viewport: { width: 390, height: 780 } });
  await page.goto(PAGE, { waitUntil: 'load' });
  await page.keyboard.press('Tab');
  const first = await page.evaluate(() => ({ cls: document.activeElement.className, top: document.activeElement.getBoundingClientRect().top }));
  await page.click('.menu-btn');
  const opened = await page.evaluate(() => ({ exp: document.querySelector('.menu-btn').getAttribute('aria-expanded'), focus: document.activeElement.textContent.trim() }));
  const links = await page.locator('#menu a').count();
  for (let i = 0; i < links; i++) await page.keyboard.press('Tab');
  const afterTab = await page.evaluate(() => document.querySelector('.menu-btn').getAttribute('aria-expanded'));
  await page.click('.menu-btn');
  await page.keyboard.press('Escape');
  const esc = await page.evaluate(() => ({ exp: document.querySelector('.menu-btn').getAttribute('aria-expanded'), focusIsBtn: document.activeElement === document.querySelector('.menu-btn') }));
  await ctx.close();
  assert(first.cls === 'skip' && first.top >= 0, 'first Tab ' + JSON.stringify(first));
  assert(opened.exp === 'true' && opened.focus === 'מה יש בקופסה', 'open ' + JSON.stringify(opened));
  assert(afterTab === 'false', 'menu still open after tabbing out');
  assert(esc.exp === 'false' && esc.focusIsBtn, 'Esc ' + JSON.stringify(esc));
  return 'skip link visible on focus; tab-out and Esc close the menu';
});

await test('in-page link lands below the sticky header (scroll-padding)', async () => {
  const { ctx, page } = await open({ reducedMotion: 'reduce' });
  await page.goto(PAGE, { waitUntil: 'load' });
  await page.click('.ctas .btn-b--main');
  await page.waitForTimeout(300);
  const s = await page.evaluate(() => ({ hd: document.querySelector('.hd').getBoundingClientRect().bottom, target: document.getElementById('visit').getBoundingClientRect().top, hash: location.hash }));
  await ctx.close();
  assert(s.hash === '#visit' && s.target >= s.hd - 1, JSON.stringify(s));
  return `header bottom ${s.hd.toFixed(0)}px, #visit top ${s.target.toFixed(0)}px`;
});

await test('no horizontal scroll at 320, 390, 768, 1280; landmarks present', async () => {
  const notes = [];
  for (const w of [320, 390, 768, 1280]) {
    const { ctx, page } = await open({ viewport: { width: w, height: 800 } });
    await page.goto(PAGE, { waitUntil: 'load' });
    if (w === 390 || w === 1280) await page.waitForTimeout(1800);
    const s = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, main: document.querySelectorAll('main#main').length, banner: document.querySelectorAll('body > header').length, info: document.querySelectorAll('body > footer').length }));
    if (w === 390) await page.screenshot({ path: join(OUT, 'home-390.png') });
    if (w === 1280) await page.screenshot({ path: join(OUT, 'home-1280.png') });
    await ctx.close();
    assert(s.sw <= s.cw, `${w}: scrollWidth ${s.sw} > ${s.cw}`);
    assert(s.main === 1 && s.banner === 1 && s.info === 1, JSON.stringify(s));
    notes.push(`${w}:${s.sw}`);
  }
  return notes.join(' ');
});

await test('without JavaScript: light, static (rm), menu hidden, ticker static', async () => {
  const { ctx, page } = await open({ js: false, viewport: { width: 390, height: 780 } });
  await page.goto(PAGE, { waitUntil: 'load' });
  const s = await page.evaluate(() => ({ cls: document.documentElement.className, mode: document.documentElement.getAttribute('data-mode'), bg: getComputedStyle(document.documentElement).backgroundColor, menu: getComputedStyle(document.getElementById('menu')).display, copies: [...document.querySelectorAll('.tk-list[aria-hidden]')].every((l) => getComputedStyle(l).display === 'none') }));
  await page.screenshot({ path: join(OUT, 'no-js-390.png') });
  await ctx.close();
  assert(s.cls === 'pb rm' && s.mode === null && s.bg === LIGHT_BG && s.menu === 'none' && s.copies, JSON.stringify(s));
  return JSON.stringify(s);
});

/* ---------- report ---------- */

await browser.close();
server.close();
writeFileSync(join(OUT, 'results.json'), JSON.stringify({ when: new Date().toISOString(), chromium: chromium.name(), results }, null, 2));
const w = Math.max(...results.map((r) => r.name.length));
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name.padEnd(w)}  ${String(r.ms).padStart(5)}ms  ${r.note}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
