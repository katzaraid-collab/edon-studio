const { chromium } = require('playwright');
const fs = require('fs');
const d = f => 'data:font/woff2;base64,' + fs.readFileSync(__dirname + '/fonts-out/' + f).toString('base64');
const lines = ['תבחרו סניף ובואו לבקר!', 'מהמדפים שלנו · הסיפור שלנו', 'הפרנה המושלמת שלנו, יש דברים שפשוט כיף שיש קרוב לבית', 'רגע לפני שהן הופכות לסופגניות שאתם כל כך אוהבים…'];
const html = `<!doctype html><html dir="rtl" lang="he"><meta charset="utf-8"><style>
@font-face{font-family:A;font-weight:600;src:url(${d('PlaypenSansHebrew-600-heb-calt.woff2')})}
@font-face{font-family:A;font-weight:400;src:url(${d('PlaypenSansHebrew-400-heb-calt.woff2')})}
@font-face{font-family:B;font-weight:600;src:url(${d('PlaypenSansHebrew-600-heb-nocalt.woff2')})}
@font-face{font-family:B;font-weight:400;src:url(${d('PlaypenSansHebrew-400-heb-nocalt.woff2')})}
body{margin:0;padding:20px 24px;background:#F7F1E6;color:#7A4520;font:14px/1.4 sans-serif;width:760px}
h2{font:700 14px sans-serif;color:#24180F;margin:14px 0 6px}
.r{display:grid;grid-template-columns:1fr 1fr;gap:20px}.c{background:#FFFCF6;border:1px solid #e4d6c0;border-radius:10px;padding:10px 14px}
.s{font-size:22px;line-height:1.3;font-weight:600}.q{font-size:18px;line-height:1.35;font-weight:400;color:#24180F}
small{display:block;color:#5F4E3B;font:12px sans-serif;margin-bottom:4px}</style>
<h2>Playpen Sans Hebrew, static instances, Hebrew + Basic Latin subset</h2>
<div class="r"><div class="c"><small>with calt (default features) · 600: 86 KB · 400: see report</small>${lines.map((l,i)=>`<div class="${i<2?'s':'q'}" style="font-family:A">${l}</div>`).join('')}</div>
<div class="c"><small>without calt · 600: 22 KB</small>${lines.map((l,i)=>`<div class="${i<2?'s':'q'}" style="font-family:B">${l}</div>`).join('')}</div></div>`;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 808, height: 400 }, deviceScaleFactor: 2 });
  await p.setContent(html); await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: '/home/user/edon-studio/clients/haofe/audit/perf/playpen-calt-compare.png', fullPage: true }); await b.close();
})();
