// Render the overlay page to a transparent PNG sequence, one screenshot per frame.
// Usage: node render_overlay.js PAGE_DIR OUT_DIR TOTAL_SECONDS [t1 t2 ...]
// With explicit times it renders only those (for review stills).
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

const [pageDir, outDir, total, ...only] = process.argv.slice(2);
const FPS = 30;
const WORKERS = 6;

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const url = "file://" + path.resolve(pageDir, "index.html");

  const jobs = only.length
    ? only.map((t, i) => ({ t: Number(t), file: `still_${String(i).padStart(2, "0")}_${t}.png` }))
    : Array.from({ length: Math.round(Number(total) * FPS) },
        (_, i) => ({ t: i / FPS, file: `${String(i).padStart(5, "0")}.png` }));

  const worker = async (w) => {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
    await page.goto(url);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => [...document.images].every(i => i.complete));
    for (let j = w; j < jobs.length; j += WORKERS) {
      await page.evaluate((t) => window.seek(t), jobs[j].t);
      await page.screenshot({ path: path.join(outDir, jobs[j].file), omitBackground: true });
    }
    await page.close();
  };
  await Promise.all(Array.from({ length: WORKERS }, (_, w) => worker(w)));
  await browser.close();
  console.log("rendered", jobs.length);
})();
