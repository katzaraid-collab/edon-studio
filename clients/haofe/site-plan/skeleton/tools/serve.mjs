// האופה · dev server for the skeleton: static files from clients/haofe/, the response headers of
// skeleton/vercel.json (so the CSP is enforced exactly as it will be on Vercel), and the motion
// modules ported to page contract 2 on every request (so edits in concepts/ show up at once).
//
//   node tools/serve.mjs [port]        then open http://localhost:<port>/site-plan/skeleton/
//   PORT=0 for a free port; the chosen URL is printed as "listening <url>".
//   ?raw on a b-motion-* URL serves the untouched prototype file.
//
// Read-only on everything it serves. No dependencies (Node 22 built-ins).

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { port as portModule, FILES } from './port-modules.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SK = resolve(HERE, '..');
const ROOT = resolve(SK, '../..');   // clients/haofe
const VERCEL = JSON.parse(readFileSync(join(SK, 'vercel.json'), 'utf8'));

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.jpg': 'image/jpeg', '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json'
};

/* vercel.json "source" patterns used here are plain paths with (.*) groups */
function headersFor(path) {
  const out = {};
  for (const rule of VERCEL.headers || []) {
    const re = new RegExp('^' + rule.source.split('(.*)').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('(.*)') + '$');
    if (re.test(path)) rule.headers.forEach((h) => { out[h.key] = h.value; });
  }
  // plain http on localhost: an upgrade-insecure-requests directive would try https for every subresource
  if (out['Content-Security-Policy']) out['Content-Security-Policy'] = out['Content-Security-Policy'].replace(/;\s*upgrade-insecure-requests/, '');
  return out;
}

export function start(port = Number(process.env.PORT ?? process.argv[2] ?? 8790)) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    let path = decodeURIComponent(url.pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = normalize(join(ROOT, path));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    const headers = headersFor(url.pathname);
    try {
      const st = await stat(file);
      if (!st.isFile()) throw new Error('not a file');
      let body = await readFile(file);
      const name = basename(file);
      if (FILES.includes(name) && file.startsWith(join(ROOT, 'concepts')) && !url.searchParams.has('raw')) {
        body = Buffer.from(portModule(name, body.toString('utf8')).code);
        headers['X-Ported'] = 'contract-2';
      }
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', ...headers });
      res.end(body);
    } catch (err) {
      const msg = err && /\[port\]/.test(err.message) ? err.message : null;
      res.writeHead(msg ? 500 : 404, { 'Content-Type': 'text/html; charset=utf-8', ...headers });
      res.end(msg ? msg : '<!doctype html><meta charset="utf-8"><title>404</title><p lang="he" dir="rtl">העמוד לא קיים בשלד. דפים מלבד דף הבית נוצרים בבנייה (site-plan/plan.md, סעיף 3).</p>');
    }
  });
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${server.address().port}`;
    ok({ server, url });
  }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  start().then(({ url }) => console.log('listening', url + '/site-plan/skeleton/'));
}
