const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const path = require('path');
(async () => {
  const [inp, out, w] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +w, height: 900 } });
  const html = require('fs').readFileSync(inp, 'utf8');
  await p.goto('file://' + path.resolve(inp));
  await p.waitForTimeout(1500);
  const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  console.log('scrollWidth', sw);
  await p.screenshot({ path: out, fullPage: true });
  await b.close();
})();
