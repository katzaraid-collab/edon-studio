// CDP load measurement. Usage: node measure.js <scenario> <runs> <outdir>
//   scenarios: see SCEN below. Each run = fresh browser context (cold cache).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8765';
const PROXY = { server: process.env.HTTPS_PROXY || 'http://127.0.0.1:43903', bypass: '127.0.0.1,localhost' };

// Lighthouse "Slow 4G" devtools values (150 ms RTT x3.75, 1.6 Mbps x0.9) + 4x CPU; desktop: 40 ms, 10 Mbps
const NET = {
  mobile: { offline: false, latency: 562.5, downloadThroughput: 1474.56 * 1024 / 8, uploadThroughput: 675 * 1024 / 8 },
  desktop: { offline: false, latency: 40, downloadThroughput: 10240 * 1024 / 8, uploadThroughput: 5120 * 1024 / 8 },
  none: null
};
const SCEN = {
  'page-desktop':      { url: '/b.html',        vp: [1440, 900], dpr: 1, net: 'desktop', cpu: 1, clickFull: true },
  'full-desktop':      { url: '/perf-full.html', vp: [1280, 820], dpr: 1, net: 'desktop', cpu: 1 },
  'full-desktop-2x':   { url: '/perf-full.html', vp: [1440, 900], dpr: 2, net: 'desktop', cpu: 1 },
  'full-mobile':       { url: '/perf-full.html', vp: [390, 780],  dpr: 3, net: 'mobile',  cpu: 4, mobile: true },
  'opt-desktop':       { url: '/perf-opt.html',  vp: [1280, 820], dpr: 1, net: 'desktop', cpu: 1 },
  'opt-desktop-2x':    { url: '/perf-opt.html',  vp: [1440, 900], dpr: 2, net: 'desktop', cpu: 1 },
  'opt-mobile':        { url: '/perf-opt.html',  vp: [390, 780],  dpr: 3, net: 'mobile',  cpu: 4, mobile: true },
  'optnf-desktop':     { url: '/perf-opt-nf.html', vp: [1280, 820], dpr: 1, net: 'desktop', cpu: 1 },
  'optnf-mobile':      { url: '/perf-opt-nf.html', vp: [390, 780], dpr: 3, net: 'mobile', cpu: 4, mobile: true },
  'optb-desktop':      { url: '/perf-opt-b.html', vp: [1280, 820], dpr: 1, net: 'desktop', cpu: 1 },
  'optb-mobile':       { url: '/perf-opt-b.html', vp: [390, 780], dpr: 3, net: 'mobile', cpu: 4, mobile: true },
  'all-desktop':       { url: '/perf-opt-bnf.html', vp: [1280, 820], dpr: 1, net: 'desktop', cpu: 1 },
  'all-mobile':        { url: '/perf-opt-bnf.html', vp: [390, 780], dpr: 3, net: 'mobile', cpu: 4, mobile: true },
  'allp1-mobile':      { url: '/perf-opt-bnf-p1.html', vp: [390, 780], dpr: 3, net: 'mobile', cpu: 4, mobile: true },
  'allp0-mobile':      { url: '/perf-opt-bnf-p0.html', vp: [390, 780], dpr: 3, net: 'mobile', cpu: 4, mobile: true },
  'allp1-desktop':     { url: '/perf-opt-bnf-p1.html', vp: [1280, 820], dpr: 1, net: 'desktop', cpu: 1 },
  'allp0-desktop':     { url: '/perf-opt-bnf-p0.html', vp: [1280, 820], dpr: 1, net: 'desktop', cpu: 1 },
  'img-desktop':       { url: '/perf-opt-img.html', vp: [1280, 820], dpr: 1, net: 'desktop', cpu: 1 },
  'img-mobile':        { url: '/perf-opt-img.html', vp: [390, 780], dpr: 3, net: 'mobile', cpu: 4, mobile: true },
  'optnl-mobile':      { url: '/perf-opt-nolqip.html', vp: [390, 780], dpr: 3, net: 'mobile', cpu: 4, mobile: true },
};

const INIT = () => {
  const P = window.__perf = { lcp: [], cls: [], lt: [], loaf: [], paint: [] };
  const d = el => {
    if (!el || !el.tagName) return null;
    const c = el.getAttribute('class');
    let s = el.tagName.toLowerCase() + (c ? '.' + c.trim().split(/\s+/).join('.') : '');
    if (el.currentSrc) s += ' [' + el.currentSrc.replace(location.origin + '/', '') + ']';
    else if (el.textContent) s += ' "' + el.textContent.trim().slice(0, 40) + '"';
    return s;
  };
  const ob = (type, fn) => { try { new PerformanceObserver(l => l.getEntries().forEach(fn)).observe({ type, buffered: true }); } catch (e) {} };
  ob('largest-contentful-paint', e => P.lcp.push({ t: e.startTime, render: e.renderTime, load: e.loadTime, size: e.size, url: e.url ? e.url.replace(location.origin + '/', '') : '', el: d(e.element) }));
  ob('layout-shift', e => P.cls.push({ t: e.startTime, v: e.value, input: e.hadRecentInput, src: (e.sources || []).map(s => ({ el: d(s.node), prev: s.previousRect && [s.previousRect.x, s.previousRect.y, s.previousRect.width, s.previousRect.height].map(Math.round), cur: s.currentRect && [s.currentRect.x, s.currentRect.y, s.currentRect.width, s.currentRect.height].map(Math.round) })) }));
  ob('longtask', e => P.lt.push({ t: e.startTime, dur: e.duration, name: e.name }));
  ob('long-animation-frame', e => P.loaf.push({ t: e.startTime, dur: e.duration, block: e.blockingDuration, render: e.renderStart ? e.startTime + e.duration - e.renderStart : 0, style: e.styleAndLayoutStart ? e.startTime + e.duration - e.styleAndLayoutStart : 0, scripts: (e.scripts || []).map(s => ({ src: (s.sourceURL || '').replace(location.origin + '/', ''), fn: s.sourceFunctionName, inv: s.invoker, dur: Math.round(s.duration), layout: Math.round(s.forcedStyleAndLayoutDuration) })) }));
  ob('paint', e => P.paint.push({ name: e.name, t: e.startTime }));
};

const AUDIT = () => {
  const dpr = devicePixelRatio;
  const root = document.querySelector('.fs .pb') || document.querySelector('.pb');
  const imgs = [...document.querySelectorAll('.fs .pb img')].length ? [...document.querySelectorAll('.fs .pb img')] : [...root.querySelectorAll('img')];
  const vpH = innerHeight;
  return imgs.map(img => {
    const cs = getComputedStyle(img);
    const rendered = img.getClientRects().length > 0 && cs.display !== 'none' && cs.visibility !== 'hidden';
    const bw = img.offsetWidth, bh = img.offsetHeight, nw = img.naturalWidth, nh = img.naturalHeight;
    let dw = bw, dh = bh;
    if (nw && nh && bw && bh && (cs.objectFit === 'contain' || cs.objectFit === 'cover')) {
      const s = cs.objectFit === 'contain' ? Math.min(bw / nw, bh / nh) : Math.max(bw / nw, bh / nh);
      dw = nw * s; dh = nh * s;
    }
    const r = img.getBoundingClientRect();
    return {
      cls: img.className, src: (img.currentSrc || img.src).replace(location.origin + '/', ''), srcset: !!img.srcset, loading: img.loading, fetchpriority: img.getAttribute('fetchpriority'),
      rendered, complete: img.complete, natural: [nw, nh], box: [bw, bh], drawn: [Math.round(dw), Math.round(dh)], dpr,
      neededW: Math.round(dw * dpr), ratio: nw && dw ? +(nw / (dw * dpr)).toFixed(2) : null,
      decodedBytes: nw * nh * 4, neededBytes: Math.round(dw * dpr * dh * dpr * 4), aboveFold: r.top < vpH && r.bottom > 0, top: Math.round(r.top), fit: cs.objectFit
    };
  });
};

async function run(name, i, outdir) {
  const S = SCEN[name];
  const browser = await chromium.launch({ proxy: PROXY });
  const ctx = await browser.newContext({ viewport: { width: S.vp[0], height: S.vp[1] }, deviceScaleFactor: S.dpr, isMobile: !!S.mobile, hasTouch: !!S.mobile, locale: 'he-IL' });
  const page = await ctx.newPage();
  await page.addInitScript(INIT);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  if (NET[S.net]) await cdp.send('Network.emulateNetworkConditions', NET[S.net]);
  if (S.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: S.cpu });

  const req = new Map();
  let phase = 'load';
  cdp.on('Network.requestWillBeSent', e => {
    if (!req.has(e.requestId)) req.set(e.requestId, { url: e.request.url, type: e.type, prio: e.request.initialPriority, t0: e.timestamp, phase, decoded: 0 });
  });
  cdp.on('Network.responseReceived', e => { const r = req.get(e.requestId); if (r) { r.status = e.response.status; r.mime = e.response.mimeType; r.enc = (e.response.headers['content-encoding'] || e.response.headers['Content-Encoding'] || ''); r.type = e.type; r.proto = e.response.protocol; } });
  cdp.on('Network.dataReceived', e => { const r = req.get(e.requestId); if (r) r.decoded += e.dataLength; });
  cdp.on('Network.loadingFinished', e => { const r = req.get(e.requestId); if (r) { r.transfer = e.encodedDataLength; r.t1 = e.timestamp; } });
  cdp.on('Network.loadingFailed', e => { const r = req.get(e.requestId); if (r) { r.failed = e.errorText; r.t1 = e.timestamp; } });

  const navStart = Date.now();
  await page.goto(BASE + S.url, { waitUntil: 'load', timeout: 180000 });
  await page.waitForTimeout(S.net === 'mobile' ? 8000 : 4000);   // let lazy images, fonts and the 1.4 s opening settle
  let overlay = null;
  if (S.clickFull) {
    const before = await page.evaluate(() => ({ lt: __perf.lt.length, loaf: __perf.loaf.length }));
    phase = 'overlay';
    const t = await page.evaluate(() => performance.now());
    await page.click('[data-full]');
    await page.waitForTimeout(4000);
    overlay = await page.evaluate(([b, t]) => ({ clickAt: t, lt: __perf.lt.slice(b.lt), loaf: __perf.loaf.slice(b.loaf) }), [before, t]);
  }
  const perf = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const res = performance.getEntriesByType('resource').map(r => ({ url: r.name.replace(location.origin + '/', ''), rbs: r.renderBlockingStatus, start: r.startTime, end: r.responseEnd, transfer: r.transferSize, body: r.encodedBodySize, decoded: r.decodedBodySize, init: r.initiatorType }));
    return { perf: window.__perf, nav: { dcl: nav.domContentLoadedEventEnd, load: nav.loadEventEnd, resp: nav.responseEnd }, res, fonts: [...document.fonts].map(f => ({ family: f.family, weight: f.weight, status: f.status, range: f.unicodeRange.slice(0, 40) })) };
  });
  const audit = await page.evaluate(AUDIT);
  await page.screenshot({ path: path.join(outdir, `${name}-${i}.png`) });
  await browser.close();

  const requests = [...req.values()].map(r => ({ ...r, ms: r.t1 && r.t0 ? Math.round((r.t1 - r.t0) * 1000) : null }));
  const out = { scenario: name, run: i, config: S, requests, ...perf, audit, overlay, wall: Date.now() - navStart };
  fs.writeFileSync(path.join(outdir, `${name}-${i}.json`), JSON.stringify(out, null, 1));
  return out;
}

(async () => {
  const [name, runs = '1', outdir = path.join(__dirname, 'results')] = process.argv.slice(2);
  fs.mkdirSync(outdir, { recursive: true });
  for (let i = 1; i <= +runs; i++) {
    const o = await run(name, i, outdir);
    const lcp = o.perf.lcp[o.perf.lcp.length - 1];
    const cls = o.perf.cls.filter(s => !s.input).reduce((a, s) => a + s.v, 0);
    const bytes = o.requests.reduce((a, r) => a + (r.transfer || 0), 0);
    console.log(name, i, 'LCP', lcp && Math.round(lcp.t), lcp && lcp.el, 'CLS', cls.toFixed(4), 'bytes', bytes, 'longtasks', o.perf.lt.length);
  }
})().catch(e => { console.error(e); process.exit(1); });
