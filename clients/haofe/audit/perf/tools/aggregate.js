// Aggregates results/*.json into metrics.json (medians across runs) for the report.
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, 'results');
const RB = path.join(__dirname, 'results-br');
const man = JSON.parse(fs.readFileSync('/home/user/edon-studio/clients/haofe/concepts/assets/ai/r/manifest.json', 'utf8'));
const dims = {};
for (const i of man.images) for (const f of i.files) dims[f.src] = [f.width, f.height, f.bytes];

const med = a => { const s = a.filter(x => x != null).sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
const host = u => { try { return new URL(u).host; } catch (e) { return 'local'; } };

function one(o) {
  const fcp = (o.perf.paint.find(p => p.name === 'first-contentful-paint') || {}).t;
  const lcpE = o.perf.lcp[o.perf.lcp.length - 1] || {};
  const cls = o.perf.cls.filter(s => !s.input).reduce((a, s) => a + s.v, 0);
  const tbt = o.perf.lt.filter(t => t.t + t.dur > fcp).reduce((a, t) => a + Math.max(0, t.dur - 50), 0);
  const byType = {};
  const loadReq = o.requests.filter(r => r.phase === 'load' && !/^data:/.test(r.url));
  for (const r of loadReq) {
    const k = r.type || 'Other';
    byType[k] = byType[k] || { n: 0, transfer: 0, decoded: 0 };
    byType[k].n++; byType[k].transfer += r.transfer || 0; byType[k].decoded += r.decoded || 0;
  }
  const total = loadReq.reduce((a, r) => a + (r.transfer || 0), 0);
  const origins = [...new Set(loadReq.map(r => host(r.url)))];
  const audit = o.audit.map(a => {
    const d = dims[a.src];
    const nat = d ? [d[0], d[1]] : a.natural;
    const ratio = nat[0] && a.drawn[0] ? +(nat[0] / (a.drawn[0] * a.dpr)).toFixed(2) : null;
    return { ...a, natural: nat, ratio, decodedBytes: a.rendered || a.complete ? nat[0] * nat[1] * 4 : 0 };
  });
  return {
    fcp, lcp: lcpE.t, lcpEl: lcpE.el, lcpUrl: lcpE.url, lcpLoad: lcpE.load, lcpSize: lcpE.size, cls, tbt,
    longtasks: o.perf.lt.map(t => Math.round(t.dur)), loaf: o.perf.loaf.filter(l => l.dur > 50).map(l => ({ t: Math.round(l.t), dur: Math.round(l.dur), block: Math.round(l.block), scripts: l.scripts })),
    dcl: o.nav.dcl, load: o.nav.load, total, requests: loadReq.length, byType, origins,
    renderBlocking: o.res.filter(r => r.rbs === 'blocking').map(r => ({ url: r.url.slice(0, 90), end: Math.round(r.end) })),
    fonts: loadReq.filter(r => r.type === 'Font').map(r => ({ url: r.url.split('/').slice(-3).join('/'), transfer: r.transfer, ms: r.ms })),
    images: loadReq.filter(r => r.type === 'Image').map(r => ({ url: r.url.replace(/^https?:\/\/[^/]+\//, ''), transfer: r.transfer, prio: r.prio, start: r.t0, ms: r.ms })),
    clsSources: o.perf.cls.filter(s => !s.input && s.v > 0.0005).map(s => ({ t: Math.round(s.t), v: +s.v.toFixed(4), src: s.src.map(x => x.el).filter(Boolean).slice(0, 4) })),
    audit, overlay: o.overlay
  };
}

const out = {};
for (const dir of [R, RB]) {
  if (!fs.existsSync(dir)) continue;
  const groups = {};
  for (const f of fs.readdirSync(dir).filter(f => /-\d+\.json$/.test(f))) {
    const o = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    (groups[o.scenario] = groups[o.scenario] || []).push(one(o));
  }
  for (const [s, runs] of Object.entries(groups)) {
    const k = (dir === RB ? 'br:' : '') + s;
    out[k] = {
      runs: runs.length,
      median: { fcp: med(runs.map(r => r.fcp)), lcp: med(runs.map(r => r.lcp)), cls: med(runs.map(r => r.cls)), tbt: med(runs.map(r => r.tbt)), dcl: med(runs.map(r => r.dcl)), load: med(runs.map(r => r.load)) },
      all: { el: runs.map(r => /sc-plate/.test(r.lcpEl || '') ? 'wall' : /sc-wheat/.test(r.lcpEl || '') ? 'wheat' : /hero/.test(r.lcpEl || '') ? 'hero-bg' : (r.lcpEl || '').split(' ')[0]), lcp: runs.map(r => Math.round(r.lcp)), fcp: runs.map(r => Math.round(r.fcp)), cls: runs.map(r => +r.cls.toFixed(4)), tbt: runs.map(r => Math.round(r.tbt)) },
      first: runs[0]
    };
  }
}
for (const t of ['trace-full-desktop', 'trace-opt-desktop', 'trace-full-mobile', 'trace-opt-mobile', 'trace-all-mobile']) {
  const p = path.join(R, t + '.summary.json');
  if (fs.existsSync(p)) out[t] = JSON.parse(fs.readFileSync(p, 'utf8'));
}
fs.writeFileSync(path.join(__dirname, 'metrics.json'), JSON.stringify(out, null, 1));
for (const [k, v] of Object.entries(out)) {
  if (!v.median) continue;
  const f = v.first;
  console.log(k.padEnd(22), 'LCP', v.all.lcp.join('/'), 'FCP', v.all.fcp.join('/'), 'CLS', v.all.cls.join('/'), 'TBT', v.all.tbt.join('/'), '| bytes', f.total, 'req', f.requests, '| img', f.byType.Image && f.byType.Image.transfer, 'font', f.byType.Font && f.byType.Font.transfer, 'css', f.byType.Stylesheet && f.byType.Stylesheet.transfer, 'js', f.byType.Script && f.byType.Script.transfer, '|', f.lcpEl);
}
