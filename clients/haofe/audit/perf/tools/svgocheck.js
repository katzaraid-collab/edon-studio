const { chromium } = require('playwright');
const fs = require('fs'); const zlib = require('zlib');
const D = __dirname + '/svgo/';
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 700, height: 512 }, deviceScaleFactor: 2 });
  const out = [];
  for (const f of ['haofe-logo-badge', 'haofe-logo-clean', 'haofe-logo-mono-cream']) {
    const shots = [];
    for (const v of ['in', 'out']) {
      const svg = fs.readFileSync(D + `${v}-${f}.svg`);
      await p.setContent(`<body style="margin:0;background:#7f7f7f"><img src="data:image/svg+xml;base64,${svg.toString('base64')}" width="44" height="44"><img src="data:image/svg+xml;base64,${svg.toString('base64')}" width="128" height="128"><img src="data:image/svg+xml;base64,${svg.toString('base64')}" width="512" height="512">`);
      await p.waitForTimeout(200);
      shots.push(await p.screenshot());
    }
    fs.writeFileSync(D + f + '-in.png', shots[0]); fs.writeFileSync(D + f + '-out.png', shots[1]);
    const br = x => zlib.brotliCompressSync(x, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }).length;
    const i = fs.readFileSync(D + `in-${f}.svg`), o = fs.readFileSync(D + `out-${f}.svg`);
    out.push({ file: f + '.svg', in: i.length, out: o.length, inBr: br(i), outBr: br(o) });
  }
  fs.writeFileSync(__dirname + '/svgo.json', JSON.stringify(out, null, 1));
  await b.close();
})();
