// Static server for the perf audit. READ-ONLY on the concepts folder.
//   /                 -> /home/user/edon-studio/clients/haofe/concepts (as-is)
//   /perf-full.html   -> b.html rewritten at request time: presentation frames removed,
//                        overlay opened at DOMContentLoaded, .fs-bar hidden (= "the site")
//   /perf-opt.html    -> same, plus the recommended <picture>/srcset/sizes markup and font link
// COMPRESS=1 serves brotli for text types (what a production host/CDN would do).
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const url = require('url');

const ROOT = process.env.ROOT || '/home/user/edon-studio/clients/haofe/concepts';
process.env.CONCEPTS = ROOT;
const PORT = +process.env.PORT || 8765;
const COMPRESS = process.env.COMPRESS === '1';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.json': 'application/json', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8'
};
const TEXT = /^(text\/|image\/svg|application\/json)/;

function send(req, res, body, type) {
  const headers = { 'Content-Type': type, 'Cache-Control': 'no-store' };
  if (COMPRESS && TEXT.test(type) && /\bbr\b/.test(req.headers['accept-encoding'] || '')) {
    body = zlib.brotliCompressSync(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } });
    headers['Content-Encoding'] = 'br';
  }
  headers['Content-Length'] = body.length;
  res.writeHead(200, headers);
  res.end(body);
}

http.createServer((req, res) => {
  const p = decodeURIComponent(url.parse(req.url).pathname);
  try {
    const V = { '/perf-full.html': 'full', '/perf-opt.html': 'opt', '/perf-opt-nolqip.html': 'opt-nolqip', '/perf-opt-img.html': 'opt-img', '/perf-opt-nf.html': 'opt-nf', '/perf-opt-b.html': 'opt-b', '/perf-opt-bnf.html': 'opt-bnf', '/perf-opt-bnf-p1.html': 'opt-bnf-p1', '/perf-opt-bnf-p0.html': 'opt-bnf-p0' };
    if (V[p]) {
      const src = fs.readFileSync(path.join(ROOT, 'b.html'), 'utf8');
      const variant = V[p];
      for (const m of ['./harness.js', './markup.js']) delete require.cache[require.resolve(m)];
      const harness = require('./harness.js');
      return send(req, res, Buffer.from(harness.build(src, variant)), TYPES['.html']);
    }
    const file = path.normalize(path.join(ROOT, p === '/' ? '/b.html' : p));
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    const body = fs.readFileSync(file);
    send(req, res, body, TYPES[path.extname(file)] || 'application/octet-stream');
  } catch (e) {
    res.writeHead(404); res.end('not found');
  }
}).listen(PORT, '127.0.0.1', () => console.log('serving on', PORT, 'compress', COMPRESS));
