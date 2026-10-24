// Which characters does each (family, weight) render in the prototype? Walks every text node
// of the mounted overlay (hidden states included: menu, "live" order copy, open boxes) and
// records the first family of the computed font-family stack and the computed weight.
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } });
  const out = {};
  for (const vp of [[1280, 820], [390, 780]]) {
    const p = await b.newPage({ viewport: { width: vp[0], height: vp[1] } });
    await p.goto('http://127.0.0.1:8765/perf-full.html', { waitUntil: 'load' });
    await p.waitForTimeout(1500);
    const r = await p.evaluate(() => {
      const res = {};
      const root = document.querySelector('.fs .pb');
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = w.nextNode())) {
        const t = n.textContent.replace(/\s+/g, '');
        if (!t) continue;
        const cs = getComputedStyle(n.parentElement);
        const fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
        const k = fam + '|' + cs.fontWeight;
        res[k] = (res[k] || '') + t;
      }
      return res;
    });
    for (const [k, v] of Object.entries(r)) out[k] = [...new Set((out[k] || '') + v)].sort().join('');
    await p.close();
  }
  await b.close();
  fs.writeFileSync(__dirname + '/charset.json', JSON.stringify(out, null, 1));
  for (const [k, v] of Object.entries(out)) {
    const latin = [...v].filter(c => c.codePointAt(0) < 0x0590 || c.codePointAt(0) > 0x05FF);
    console.log(k.padEnd(28), 'chars', v.length, 'non-Hebrew:', JSON.stringify(latin.join('')));
  }
})();
