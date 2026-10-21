// node r3d.js out.png "query" w h
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const [out, query, w, h] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: +w, height: +h } });
  p.on('console', m => m.type() === 'error' && console.log('console:', m.text()));
  p.on('pageerror', e => console.log('pageerror:', e.message));
  await p.goto(`http://127.0.0.1:8765/r3d.html?w=${w}&h=${h}&${query}`);
  await p.waitForFunction(() => window.__done === true, null, { timeout: 240000 });
  await p.screenshot({ path: out, omitBackground: true });
  await b.close();
})();
