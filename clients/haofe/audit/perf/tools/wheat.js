const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const out = [];
  for (const [w, h] of [[1280, 820], [390, 780]]) for (const fix of [false, true]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    await p.goto('http://127.0.0.1:8765/perf-full.html', { waitUntil: 'load' });
    if (fix) await p.addStyleTag({ content: '.pb .sc-wheat { height: auto; }' });
    await p.waitForTimeout(800);
    const r = await p.evaluate(() => { const i = document.querySelector('.fs .sc-wheat'); return [i.offsetWidth, i.offsetHeight, i.naturalWidth, i.naturalHeight]; });
    const hero = await p.$('.fs .hero');
    await hero.screenshot({ path: `${__dirname}/visual/wheat-${w}-${fix ? 'auto' : 'now'}.png` });
    out.push({ w, fix, box: r });
    await ctx.close();
  }
  console.log(JSON.stringify(out));
  await b.close();
})();
