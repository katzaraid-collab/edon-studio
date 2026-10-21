// Renders every page listed in jobs.json at its exact pixel size.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const path = require('path');
(async () => {
  const jobs = require(path.resolve(process.argv[2] || 'jobs.json'));
  const only = process.argv[3];
  const b = await chromium.launch();
  for (const [html, png, w, h] of jobs) {
    if (only && !html.includes(only)) continue;
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.goto('file://' + path.resolve(html));
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(100);
    await p.screenshot({ path: png, clip: { x: 0, y: 0, width: w, height: h } });
    await p.close();
  }
  await b.close();
})();
