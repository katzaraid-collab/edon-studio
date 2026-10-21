const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto('file://' + path.resolve(__dirname, 'index.html'));
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(400);
  const n = await p.evaluate(() => document.querySelectorAll('.slide').length);
  for (let i = 0; i < n; i++) {
    const el = (await p.$$('.slide'))[i];
    await el.screenshot({ path: path.resolve(__dirname, `s${String(i + 1).padStart(2, '0')}.png`) });
  }
  await p.pdf({ path: path.resolve(__dirname, 'AURO-Brand-Presentation.pdf'), width: '1920px', height: '1080px', printBackground: true, preferCSSPageSize: true });
  await b.close();
})();
