const { chromium } = require('playwright');
const fs = require('fs');
const d = f => 'data:font/woff2;base64,' + fs.readFileSync(__dirname + '/fonts-out/' + f).toString('base64');
const lines = ['תבחרו סניף ובואו לבקר!', 'מהמדפים שלנו', 'הסיפור שלנו', 'לעסקים ולרשתות', 'תבחרו את הסניף שלכם ובואו לבקר!', 'הפרנה המושלמת שלנו, יש דברים שפשוט כיף שיש קרוב לבית', 'רגע לפני שהן הופכות לסופגניות שאתם כל כך אוהבים…', 'העובדת שיודעת לעשות הכל', 'פתחו', 'אאאא בבבב לללל וווו ננננ', '@haofe_bakery'];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 900, height: 60 }, deviceScaleFactor: 2 });
  for (const w of [600, 400]) for (const l of lines) {
    const shots = [];
    for (const fam of ['calt', 'nocalt']) {
      await p.setContent(`<!doctype html><html dir="rtl"><meta charset="utf-8"><style>@font-face{font-family:X;src:url(${d(`PlaypenSansHebrew-${w}-heb-${fam}.woff2`)})}body{margin:0;padding:8px;font:22px/1.3 X;background:#fff;color:#000}</style><div>${l}</div>`);
      await p.evaluate(() => document.fonts.ready);
      shots.push(await p.screenshot({ path: __dirname + `/fontdiff/${w}-${lines.indexOf(l)}-${fam}.png` }));
    }
    console.log(w, shots[0].equals(shots[1]) ? 'IDENTICAL' : 'DIFFERENT', l);
  }
  await b.close();
})();
