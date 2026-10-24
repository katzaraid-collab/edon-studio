// Chromium trace of one cold load (no network throttle, CPU throttle as given) and a summary of
// where renderer time goes: main thread by event name, raster/decode threads by event name.
// Usage: node trace.js <page> <w> <h> <dpr> <cpuRate> <label>
const { chromium } = require('playwright');
const fs = require('fs');
const [pg = 'perf-full.html', w = '1280', h = '820', dpr = '1', cpu = '1', label = 'trace'] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } });
  const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dpr });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  if (+cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: +cpu });
  const file = `${__dirname}/results/${label}.trace.json`;
  await b.startTracing(p, { path: file, categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'blink', 'cc', 'gpu', 'loading', 'disabled-by-default-devtools.timeline.frame'] });
  await p.goto('http://127.0.0.1:8765/' + pg, { waitUntil: 'load' });
  await p.waitForTimeout(3000);
  await b.stopTracing();
  await b.close();

  const ev = JSON.parse(fs.readFileSync(file, 'utf8')).traceEvents;
  const threads = {};
  ev.filter(e => e.ph === 'M' && e.name === 'thread_name').forEach(e => { threads[e.pid + ':' + e.tid] = e.args.name; });
  const rendererPid = (ev.find(e => e.ph === 'M' && e.name === 'thread_name' && e.args.name === 'CrRendererMain' && ev.some(x => x.pid === e.pid && x.name === 'ParseHTML')) || {}).pid;
  const sum = {};
  for (const e of ev) {
    if (e.ph !== 'X' || !e.dur || e.pid !== rendererPid) continue;
    const t = threads[e.pid + ':' + e.tid] || String(e.tid);
    const k = t.replace(/\d+$/, '') + ' | ' + e.name;
    sum[k] = sum[k] || { n: 0, ms: 0, max: 0 };
    sum[k].n++; sum[k].ms += e.dur / 1000; sum[k].max = Math.max(sum[k].max, e.dur / 1000);
  }
  const keep = /\| (Layout|UpdateLayoutTree|Paint|PaintImage|PrePaint|Layerize|Commit|ParseHTML|EvaluateScript|FunctionCall|v8\.compile|ParseAuthorStyleSheet|RasterTask|ImageDecodeTask|Decode Image|DecodeImage|Decode LazyPixelRef|ScrollLayer|HitTest|RunTask|ThreadControllerImpl::RunTask|EventDispatch|TimerFire|FireAnimationFrame|IntersectionObserverController::computeIntersections|UpdateLayer|CompositeLayers)$/;
  const rows = Object.entries(sum).filter(([k]) => keep.test(k)).sort((a, b) => b[1].ms - a[1].ms).slice(0, 30)
    .map(([k, v]) => ({ k, n: v.n, ms: +v.ms.toFixed(1), max: +v.max.toFixed(1) }));
  fs.writeFileSync(`${__dirname}/results/${label}.summary.json`, JSON.stringify(rows, null, 1));
  fs.unlinkSync(file);
  for (const r of rows) console.log(r.ms.toFixed(1).padStart(8), String(r.n).padStart(5), r.max.toFixed(1).padStart(7), r.k);
})();
