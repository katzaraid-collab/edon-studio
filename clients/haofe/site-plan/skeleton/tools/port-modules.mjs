// האופה · port the prototype's motion modules (concepts/b-motion-*.js/.css) to page contract 2.
//
// Usage
//   node tools/port-modules.mjs [conceptsDir] [outDir]     write ported copies (default out: ../.ported)
//   node tools/port-modules.mjs --check [conceptsDir]      only report what would change; exit 1 on a miss
//   import { port } from './port-modules.mjs'              used by tools/serve.mjs on every request
//
// What it does (site-plan/plan.md section 6.3 lists the same changes per module, with reasons):
//   every module   1 inject the contract-2 helpers right after `var scroller = ...ctx.scroller;`
//                     ioRoot (IntersectionObserver root), scrollEvents (where 'scroll' fires),
//                     vtHost (startViewTransition host), view() (visible scroll area + frame scale).
//                     Each falls back to the old behaviour when shell.js does not pass the key, so a
//                     ported file still runs unchanged inside the prototype frames.
//                  2 `root: scroller`                   -> `root: ioRoot`
//                  3 `on|listen(scroller, 'scroll'`     -> `...(scrollEvents, 'scroll'`
//                  4 `scroller.getBoundingClientRect()` -> `view()`, and the frame-scale formula
//                     `(vr.height / (scroller.offsetHeight ...)) || 1` -> `vr.scale`
//                  5 `name: 'b-…',` gets `contract: 2,` (runtime.js skips modules without it)
//   b-hero         6 also re-measure on window resize (the viewport height changes without <html>
//                     changing size, e.g. a phone's address bar), page only
//   b-scroll       6 the same for the product-drift cache and the scroll range, page only
//                  7 the flying copies' layer goes into <body>, not into <html>, when root is <html>
//   b-micro        6 `scroller.startViewTransition` -> `vtHost.startViewTransition` (on a page the
//                     document, so the swap covers the whole page)
//   b-micro.css    7 the four `:has(> .pb.mi-vt)::view-transition-*(root)` rules also match
//                     `:root.pb.mi-vt` (on a page .pb IS the root, so it has no parent to :has() from)
// Every required anchor must be found, or the port fails and names it: when a module author
// changes the code the port must be updated (or, better, the author adopts contract 2 upstream;
// a source that already says `contract: 2` is passed through untouched).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_CONCEPTS = resolve(HERE, '../../../concepts');

const HELPERS = `
      /* ---- page contract 2 (clients/haofe/site-plan/plan.md section 6): on a real page the window
         scrolls. Each key falls back to the prototype behaviour when the shell does not pass it. ---- */
      var ioRoot = ctx && 'ioRoot' in ctx ? ctx.ioRoot : scroller;          // IntersectionObserver root (null = viewport)
      var scrollEvents = (ctx && ctx.scrollEvents) || scroller;              // where 'scroll' fires (window on a page)
      var vtHost = (ctx && ctx.vtHost) || scroller;                          // startViewTransition host (document on a page)
      var view = ctx && typeof ctx.view === 'function' ? ctx.view : function () {
        var r = scroller.getBoundingClientRect();
        return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height,
          scale: (r.height / (scroller.offsetHeight || r.height || 1)) || 1 };
      };
`;

// [label, regex or string, replacement, {min, max, optional}]
const COMMON = [
  ['IO root -> ioRoot', /root: scroller\b/g, 'root: ioRoot', { min: 0 }],
  ["scroll listener -> scrollEvents", /\b(on|listen)\(scroller, 'scroll'/g, "$1(scrollEvents, 'scroll'", { min: 1 }],
  ['frame scale formula -> vr.scale', /\(vr\.height \/ \(scroller\.offsetHeight(?: \|\| vr\.height)? \|\| 1\)\) \|\| 1/g, 'vr.scale', { min: 0 }],
  ['scroller rect -> view()', /scroller\.getBoundingClientRect\(\)/g, 'view()', { min: 0 }],
  ['contract marker', /(\n(\s*)name: '(b-[a-z]+)',)/, "$1\n$2contract: 2,", { min: 1, max: 1 }]
];

const PER_FILE = {
  'b-motion-hero.js': [
    ['re-measure on window resize (page)',
      '[root, hero, scroller].forEach(function (el) { ro.observe(el); });',
      "[root, hero, scroller].forEach(function (el) { ro.observe(el); });\n        if (ctx.page) cleanups.push(listen(window, 'resize', function () { if (!measureQueued) measureQueued = requestAnimationFrame(function () { measureQueued = 0; measure(); }); }, { passive: true }));",
      { min: 1, max: 1 }]
  ],
  'b-motion-scroll.js': [
    ['layer into <body> when root is <html>',
      'root.appendChild(layer);',
      "(root.tagName === 'HTML' ? document.body : root).appendChild(layer);",
      { min: 1, max: 1 }],
    ['re-measure on window resize (page)',
      "root.classList.add('sx');",
      "if (ctx.page) on(window, 'resize', function () { if (pf) { pfMeasure(); pfSync(); } if (tick && measureRange) measureRange(); }, { passive: true });\n      root.classList.add('sx');",
      { min: 1, max: 1 }]
  ],
  'b-motion-micro.js': [
    ['view transition host -> vtHost', /scroller\.startViewTransition/g, 'vtHost.startViewTransition', { min: 0 }]
  ],
  'b-motion-micro.css': [
    ['VT pseudo rules also for :root.pb', /:has\(> \.pb\.mi-vt\)::view-transition-([a-z-]+)\(root\)/g,
      ':has(> .pb.mi-vt)::view-transition-$1(root), :root.pb.mi-vt::view-transition-$1(root)', { min: 1 }]
  ]
};

const SCROLLER_DECL = /(\n(\s*)var scroller = (?:ctx && )?ctx\.scroller;\n)/;

function apply(src, rules, file, log) {
  for (const [label, find, repl, lim] of rules) {
    let count = 0;
    if (typeof find === 'string') {
      count = src.split(find).length - 1;
      if (count) src = src.split(find).join(repl);
    } else {
      src = src.replace(find, (...m) => {
        count++;
        // expand $1.. in the replacement by hand (String.replace with a function does not)
        return repl.replace(/\$(\d)/g, (_, i) => m[+i] ?? '');
      });
    }
    const ok = count >= (lim.min ?? 1) && (lim.max === undefined || count <= lim.max);
    log.push({ file, label, count, ok });
    if (!ok) throw new Error(`[port] ${file}: "${label}" matched ${count} time(s), expected ${lim.min ?? 1}${lim.max !== undefined ? '..' + lim.max : '+'}. The module changed: update tools/port-modules.mjs or adopt contract 2 in the module.`);
  }
  return src;
}

/* Returns { code, log }. `name` is the file's basename. */
export function port(name, src) {
  const log = [];
  if (/\bcontract:\s*2\b/.test(src)) {
    log.push({ file: name, label: 'already contract 2: passed through', count: 0, ok: true });
    return { code: src, log };
  }
  if (name.endsWith('.css')) {
    return { code: apply(src, PER_FILE[name] || [], name, log), log };
  }
  if (!PER_FILE[name]) throw new Error(`[port] no rules for ${name}`);
  let out = apply(src, COMMON, name, log);
  out = apply(out, PER_FILE[name], name, log);
  // helpers last, so their own fallback code is not rewritten by the rules above
  let n = 0;
  out = out.replace(SCROLLER_DECL, (m, all, indent) => { n++; return all + HELPERS.replace(/^ {6}/gm, indent); });
  log.push({ file: name, label: 'inject contract-2 helpers', count: n, ok: n === 1 });
  if (n !== 1) throw new Error(`[port] ${name}: could not find "var scroller = ctx.scroller;" to inject the helpers`);
  return { code: `/* PORTED to page contract 2 by site-plan/skeleton/tools/port-modules.mjs. Do not edit: edit the source in concepts/. */\n${out}`, log };
}

export const FILES = ['b-motion-hero.js', 'b-motion-scroll.js', 'b-motion-micro.js', 'b-motion-micro.css'];

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const check = args[0] === '--check';
  if (check) args.shift();
  const from = resolve(args[0] || DEFAULT_CONCEPTS);
  const to = resolve(args[1] || join(HERE, '..', '.ported'));
  let failed = false;
  for (const f of FILES) {
    const p = join(from, f);
    if (!existsSync(p)) { console.error('missing', p); failed = true; continue; }
    try {
      const { code, log } = port(basename(p), readFileSync(p, 'utf8'));
      log.forEach((l) => console.log(`${l.ok ? 'ok  ' : 'MISS'} ${l.file.padEnd(20)} ${l.label} (${l.count})`));
      if (!check) { mkdirSync(to, { recursive: true }); writeFileSync(join(to, f), code); }
    } catch (err) {
      failed = true;
      console.error(err.message);
    }
  }
  if (!check && !failed) console.log('written to', to);
  process.exit(failed ? 1 : 0);
}
