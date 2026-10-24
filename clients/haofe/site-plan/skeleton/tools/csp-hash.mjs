// האופה · the CSP hash of the inline boot script.
//
//   node tools/csp-hash.mjs          print the hash; exit 1 if index.html or vercel.json disagree
//   node tools/csp-hash.mjs --fix    copy the boot snippet from theme.js into index.html and put
//                                    its hash into vercel.json's Content-Security-Policy
//
// The source of truth is theme.js, between "/*! boot:start */\n" and "\n/*! boot:end */".
// The browser hashes the exact text between <script> and </script>, so the inline copy must be
// byte for byte the same as that snippet (no added newline or indentation).
// The site build does the same check for every page it writes (plan.md section 8).

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SK = join(dirname(fileURLToPath(import.meta.url)), '..');

export function bootSnippet(themeSrc = readFileSync(join(SK, 'theme.js'), 'utf8')) {
  const m = /\/\*! boot:start \*\/\n([\s\S]*?)\n\/\*! boot:end \*\//.exec(themeSrc);
  if (!m) throw new Error('theme.js: boot markers not found');
  return m[1];
}
export function sha256(text) {
  return "'sha256-" + createHash('sha256').update(text, 'utf8').digest('base64') + "'";
}
/* the first <script> without attributes in <head> */
export function inlineBoot(html) {
  const m = /<script>([\s\S]*?)<\/script>/.exec(html);
  return m ? m[1] : null;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const fix = process.argv.includes('--fix');
  const boot = bootSnippet();
  const hash = sha256(boot);
  const indexPath = join(SK, 'index.html');
  const vercelPath = join(SK, 'vercel.json');
  let html = readFileSync(indexPath, 'utf8');
  const vercel = JSON.parse(readFileSync(vercelPath, 'utf8'));
  const cspHeader = vercel.headers.flatMap((h) => h.headers).find((h) => h.key === 'Content-Security-Policy');
  let ok = true;

  if (inlineBoot(html) !== boot) {
    ok = false;
    console.log('index.html: inline boot differs from theme.js');
    if (fix) html = html.replace(/<script>[\s\S]*?<\/script>/, () => '<script>' + boot + '</script>');
  }
  if (!cspHeader.value.includes(hash)) {
    ok = false;
    console.log('vercel.json: CSP lacks', hash);
    if (fix) cspHeader.value = cspHeader.value.replace(/script-src [^;]*/, "script-src 'self' " + hash);
  }
  if (fix) {
    writeFileSync(indexPath, html);
    writeFileSync(vercelPath, JSON.stringify(vercel, null, 2) + '\n');
    console.log('fixed:', hash);
    process.exit(0);
  }
  console.log(hash);
  process.exit(ok ? 0 : 1);
}
