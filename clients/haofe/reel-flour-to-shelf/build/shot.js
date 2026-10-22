// Screenshot one HTML page at 1080x1920. Usage: node shot.js PAGE OUT
const path = require("path");
const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto("file://" + path.resolve(process.argv[2]));
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: process.argv[3], type: "jpeg", quality: 92 });
  await browser.close();
})();
