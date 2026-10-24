// Verifies the sizes="" formulas in markup.js against the rendered layout of the overlay.
// For each viewport: the layout width of each image slot (what sizes must describe) vs the formula.
const { chromium } = require('playwright');
const fs = require('fs');
const VW = [360, 390, 414, 600, 768, 820, 999, 1000, 1024, 1180, 1280, 1366, 1440, 1920];

function formula(slot, vw) {
  const v = x => x * vw / 100;
  switch (slot) {
    case 'sc-plate': return vw;
    case 'sc-bag-img': return vw >= 1000 ? v(25) : v(46);
    case 'sc-wheat': return vw >= 1000 ? v(24) : v(34);
    case 'prod': return vw >= 1240 ? 306 : vw >= 1000 ? v(28) - 40 : vw >= 700 ? v(42) - 27 : v(84) - 35;
  }
}

(async () => {
  const b = await chromium.launch();
  const rows = [];
  for (const w of VW) {
    const p = await b.newPage({ viewport: { width: w, height: 900 } });
    await p.goto('http://127.0.0.1:8765/perf-full.html', { waitUntil: 'load' });
    await p.waitForTimeout(300);
    const r = await p.evaluate(() => {
      const pb = document.querySelector('.fs .pb');
      const q = s => pb.querySelector(s);
      const plate = q('.sc-plate'), cs = getComputedStyle(plate);
      // cover: drawn width of the plate (what the browser actually needs pixels for)
      const s = Math.max(plate.offsetWidth / plate.naturalWidth, plate.offsetHeight / plate.naturalHeight);
      return {
        inner: innerWidth, container: pb.clientWidth,
        'sc-plate': plate.offsetWidth, plateDrawn: Math.round(plate.naturalWidth * s), plateBox: [plate.offsetWidth, plate.offsetHeight],
        'sc-bag-img': q('.sc-bag-img').offsetWidth, 'sc-wheat': q('.sc-wheat').offsetWidth, prod: q('.prod').offsetWidth
      };
    });
    const row = { vw: w, ...r };
    for (const k of ['sc-plate', 'sc-bag-img', 'sc-wheat', 'prod']) row[k + ':sizes'] = Math.round(formula(k, r.inner) * 10) / 10;
    rows.push(row);
    await p.close();
  }
  await b.close();
  fs.writeFileSync(__dirname + '/sizes.json', JSON.stringify(rows, null, 1));
  console.log('vw   inner cont | plate box(drawn) sizes | bag lay/sizes | wheat lay/sizes | prod lay/sizes');
  for (const r of rows) console.log(String(r.vw).padEnd(5), String(r.inner).padEnd(5), String(r.container).padEnd(5), '|', r['sc-plate'], `(${r.plateDrawn})`, r['sc-plate:sizes'], '|', r['sc-bag-img'], r['sc-bag-img:sizes'], '|', r['sc-wheat'], r['sc-wheat:sizes'], '|', r.prod, r['prod:sizes']);
})();
