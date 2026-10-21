// SVG logo files → transparent PNGs, longest side 2400px.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const [src, dst] = process.argv.slice(2);
  fs.mkdirSync(dst, { recursive: true });
  const b = await chromium.launch();
  for (const f of fs.readdirSync(src).filter(f => f.endsWith('.svg'))) {
    const s = fs.readFileSync(path.join(src, f), 'utf8');
    const w = +s.match(/<svg[^>]*?width="([\d.]+)"/)[1], h = +s.match(/<svg[^>]*?height="([\d.]+)"/)[1];
    const target = f.startsWith('app-icon') ? 1080 : 2400;
    const k = target / Math.max(w, h);
    const p = await b.newPage({ viewport: { width: Math.ceil(w), height: Math.ceil(h) }, deviceScaleFactor: k });
    await p.setContent(`<style>html,body{margin:0;background:transparent}</style>${s}`);
    await p.screenshot({ path: path.join(dst, f.replace('.svg', '.png')), omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
    await p.close();
  }
  await b.close();
})();
