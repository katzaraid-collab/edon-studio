// Visual regression: perf-full.html (today) vs perf-opt-nolqip.html (recommended markup), reduced
// motion so the ticker and reveals are static, overlay unrolled to full height, all images loaded.
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = __dirname + '/visual';
fs.mkdirSync(OUT, { recursive: true });
const UNROLL = '.fs{position:absolute!important;inset:auto!important;width:100%}.fs .vp{height:auto!important;overflow:visible!important}html{overflow:auto!important}';

(async () => {
  const b = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } });
  for (const [w, h, dpr, mode] of (process.env.ONLY === 'm' ? [[390, 780, 2, 'light']] : [[1280, 820, 1, 'light'], [390, 780, 2, 'light'], [1280, 820, 1, 'dark']])) {
    for (const v of (process.env.V || 'perf-full,perf-opt-nolqip').split(',')) {
      const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, reducedMotion: 'reduce' });
      const p = await ctx.newPage();
      await p.goto(`http://127.0.0.1:8765/${v}.html`, { waitUntil: 'load' });
      await p.addStyleTag({ content: UNROLL });
      if (mode === 'dark') await p.evaluate(() => window.Shell.setMode(document.querySelector('.fs .pb'), 'dark'));
      for (let y = 0; y < 12000; y += 600) { await p.evaluate(y => window.scrollTo(0, y), y); await p.waitForTimeout(60); }
      await p.evaluate(() => window.scrollTo(0, 0));
      await p.waitForLoadState('networkidle').catch(() => {});
      await p.evaluate(() => Promise.race([new Promise(r => setTimeout(r, 8000)), Promise.all([...document.images].filter(i => i.getClientRects().length).map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })))]));
      await p.evaluate(() => document.fonts.ready);
      const info = await p.evaluate(() => [...document.querySelectorAll('.fs .pb img')].map(i => [i.className, i.currentSrc.split('/').pop(), i.complete, i.naturalWidth]));
      fs.writeFileSync(`${OUT}/${v}-${w}-${mode}.json`, JSON.stringify(info));
      await p.screenshot({ path: `${OUT}/${v}-${w}-${mode}.png`, fullPage: true });
      await ctx.close();
    }
  }
  await b.close();
})();
