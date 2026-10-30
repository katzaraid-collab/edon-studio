// מאזן — charts.js (Agent C)
// Zero-dependency SVG charts. Every builder returns a <div class="chart …"> that
// wraps the SVG, an HTML tooltip (.chart-tip) and an sr-only data table.
// Colors are CSS custom-property strings (e.g. 'var(--cat-3)'), applied via
// inline style so var() always resolves. Text is always rendered at real pixel
// size: bar/line charts redraw on resize (ResizeObserver) instead of scaling.

import { fmtMoney } from './format.js';

const NS = 'http://www.w3.org/2000/svg';
const FONT_PX = 11;
const CHAR_W = 6.4; // approx. advance of an 11px tabular digit / Hebrew glyph
const DOW_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const ANIM_MS = 1100;

let uidSeq = 0;
const nextId = (p) => `ch${++uidSeq}-${p}`;

/* ------------------------------------------------------------------ helpers */

const stripMarks = (v) => String(v ?? '').replace(/[‎‏‪-‮⁦-⁩]/g, '');
const fullMoney = (a) => fmtMoney(a);
const compactMoney = (a) => fmtMoney(a, { compact: true });
const num = (v) => (Number.isFinite(+v) ? +v : 0);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const r1 = (v) => Math.round(v * 10) / 10;

function svgEl(tag, attrs, parent) {
  const n = document.createElementNS(NS, tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
      else if (k === 'text') n.textContent = v;
      else n.setAttribute(k, v);
    }
  }
  if (parent) parent.append(n);
  return n;
}

function htmlEl(tag, attrs, ...kids) {
  const n = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'style' && typeof v === 'object') {
        for (const [sk, sv] of Object.entries(v)) {
          if (sk.startsWith('--')) n.style.setProperty(sk, sv);
          else n.style[sk] = sv;
        }
      } else if (k === 'class') n.className = v;
      else n.setAttribute(k, v);
    }
  }
  for (const c of kids.flat()) {
    if (c == null || c === false) continue;
    n.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return n;
}

const bdi = (text, cls = 'num') => htmlEl('bdi', { class: cls }, stripMarks(text));
// HTML money keeps format.js's bidi marks verbatim so it matches ui.money() elsewhere.
const moneyBdi = (text, cls = 'num') => htmlEl('bdi', { class: cls }, String(text ?? ''));

function reducedMotion() {
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

/** Mark the wrapper as animating for its first ~second of life (covers the
 *  first ResizeObserver redraw), then go static so resizes never re-animate. */
function armAnimation(root) {
  if (reducedMotion()) return;
  root.classList.add('is-anim');
  setTimeout(() => root.classList.remove('is-anim'), ANIM_MS);
}

/** Nice tick generation over [min, max] in agorot (step never below ₪1). */
function niceScale(min, max, count = 4) {
  if (!(max > min)) {
    if (max === 0 && min === 0) return { lo: 0, hi: 1, ticks: [0] };
    const v = Math.abs(max || min);
    min = Math.min(0, min); max = Math.max(0, max);
    if (max === min) max = min + v;
  }
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  let step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
  step = Math.max(step, 100);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let t = lo; t <= hi + step / 2; t += step) ticks.push(Math.round(t));
  return { lo, hi, ticks };
}

/** Indices that get an x label, thinned so at most `max` show; the newest
 *  (last) label is always kept and the rest are spaced evenly back from it. */
function labelIndices(n, max) {
  const keep = new Set();
  if (n <= 0) return keep;
  max = Math.max(1, Math.floor(max));
  const step = Math.max(1, Math.ceil(n / max));
  for (let i = n - 1; i >= 0; i -= step) keep.add(i);
  return keep;
}

/** Path for a bar between baseline yb and value yv with a rounded data-end. */
function barPath(x, w, yb, yv, r = 4) {
  const h = Math.abs(yb - yv);
  r = Math.min(r, w / 2, h);
  const X = r1(x), W = r1(w), B = r1(yb), V = r1(yv), R = r1(r);
  if (yv <= yb) {
    return `M${X},${B}V${r1(V + R)}A${R},${R} 0 0 1 ${r1(X + R)},${V}H${r1(X + W - R)}A${R},${R} 0 0 1 ${r1(X + W)},${r1(V + R)}V${B}Z`;
  }
  return `M${X},${B}V${r1(V - R)}A${R},${R} 0 0 0 ${r1(X + R)},${V}H${r1(X + W - R)}A${R},${R} 0 0 0 ${r1(X + W)},${r1(V - R)}V${B}Z`;
}

/** Monotone cubic interpolation (Fritsch–Carlson, same as d3.curveMonotoneX). */
function monotonePath(pts) {
  const n = pts.length;
  if (!n) return '';
  if (n === 1) return `M${r1(pts[0][0])},${r1(pts[0][1])}`;
  if (n === 2) return `M${r1(pts[0][0])},${r1(pts[0][1])}L${r1(pts[1][0])},${r1(pts[1][1])}`;
  const dx = [], s = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1][0] - pts[i][0];
    s[i] = dx[i] ? (pts[i + 1][1] - pts[i][1]) / dx[i] : 0;
  }
  m[0] = s[0]; m[n - 1] = s[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (s[i - 1] * s[i] <= 0) m[i] = 0;
    else {
      const w1 = 2 * dx[i] + dx[i - 1], w2 = dx[i] + 2 * dx[i - 1];
      m[i] = (w1 + w2) / (w1 / s[i - 1] + w2 / s[i]);
    }
  }
  let d = `M${r1(pts[0][0])},${r1(pts[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += `C${r1(pts[i][0] + h)},${r1(pts[i][1] + m[i] * h)} ${r1(pts[i + 1][0] - h)},${r1(pts[i + 1][1] - m[i + 1] * h)} ${r1(pts[i + 1][0])},${r1(pts[i + 1][1])}`;
  }
  return d;
}

function srTable(caption, headers, rows) {
  return htmlEl('table', { class: 'chart-sr' },
    htmlEl('caption', null, caption),
    htmlEl('thead', null, htmlEl('tr', null, headers.map((t) => htmlEl('th', { scope: 'col' }, t)))),
    htmlEl('tbody', null, rows.map((r) => htmlEl('tr', null, r.map((c, i) => (i === 0 ? htmlEl('th', { scope: 'row' }, c) : htmlEl('td', null, bdi(c, '')))))))
  );
}

function emptyChart(kind, text = 'אין נתונים להצגה', height) {
  const root = htmlEl('div', { class: `chart chart-${kind} is-empty`, role: 'img', 'aria-label': text },
    htmlEl('div', { class: 'chart-empty', style: height ? { minHeight: `${height}px` } : null }, text));
  return root;
}

function legend(entries, shape = 'bar') {
  return htmlEl('ul', { class: 'chart-legend', 'aria-hidden': 'true' },
    entries.map((e) => htmlEl('li', null,
      htmlEl('span', { class: `chart-key is-${shape}`, style: { '--c': e.color } }),
      e.label)));
}

/* --------------------------------------------------------- tooltip + focus */

let openTip = null;
let outsideBound = false;
function bindOutside() {
  if (outsideBound) return;
  outsideBound = true;
  document.addEventListener('pointerdown', (e) => {
    if (openTip && !openTip.host.contains(e.target)) openTip.hide();
  }, true);
  document.addEventListener('scroll', () => { if (openTip && openTip.touch) openTip.hide(); }, { passive: true, capture: true });
}

/** One tooltip per chart, positioned inside `host` (position:relative). */
function makeTip(host) {
  const tip = htmlEl('div', { class: 'chart-tip', 'aria-hidden': 'true', dir: 'rtl' });
  host.append(tip);
  const api = {
    host, touch: false,
    /** rows: [{label, value, color?, strong?}] ; foot: string|null */
    set(title, rows, foot) {
      tip.replaceChildren(...[
        title ? htmlEl('div', { class: 'chart-tip-title' }, title) : null,
        ...rows.map((r) => htmlEl('div', { class: `chart-tip-row${r.strong ? ' is-strong' : ''}` },
          r.color ? htmlEl('span', { class: 'chart-tip-key', style: { '--c': r.color } }) : null,
          htmlEl('span', { class: 'chart-tip-label' }, r.label),
          r.value ? moneyBdi(r.value, 'chart-tip-value num') : null)),
        foot ? htmlEl('div', { class: 'chart-tip-foot' }, foot) : null,
      ].filter(Boolean));
    },
    /** Beside a vertical band [x0,x1] (bar/line charts): never covers the mark. */
    placeBeside(x0, x1, top = 4) {
      tip.classList.add('is-on');
      const W = host.clientWidth, w = tip.offsetWidth;
      let left = x1 + 10;
      if (left + w > W) left = x0 - 10 - w;
      if (left < 0) left = clamp((x0 + x1) / 2 - w / 2, 0, Math.max(0, W - w));
      tip.style.left = `${Math.round(left)}px`;
      tip.style.top = `${Math.round(top)}px`;
      openTip = api;
    },
    /** Above a point (falls below if there is no room). */
    placeAbove(cx, y0, y1) {
      tip.classList.add('is-on');
      const W = host.clientWidth, w = tip.offsetWidth, h = tip.offsetHeight;
      const left = clamp(cx - w / 2, -4, Math.max(-4, W - w + 4));
      let top = y0 - h - 8;
      if (top + host.getBoundingClientRect().top < 4) top = y1 + 8;
      tip.style.left = `${Math.round(left)}px`;
      tip.style.top = `${Math.round(top)}px`;
      openTip = api;
    },
    hide() {
      tip.classList.remove('is-on');
      if (openTip === api) openTip = null;
      api.onHide?.();
    },
    onHide: null,
  };
  bindOutside();
  return api;
}

/**
 * Hover / focus / tap wiring with a roving tabindex (one Tab stop per chart).
 * nav: 'h'  → ArrowRight = next (charts run left→right)
 *      'rtl-grid' → ArrowLeft = next day, Up/Down = ∓7 (calendar, dir=rtl)
 *      'ring' → Right/Down next, Left/Up previous (donut)
 */
function interact(host, marks, { show, hide, activate, nav = 'h', initial = 0 }) {
  const n = marks.length;
  let tabbed = clamp(initial | 0, 0, Math.max(0, n - 1));
  let cur = -1;
  const setTab = (i) => { tabbed = i; marks.forEach((m, j) => m.setAttribute('tabindex', j === i ? '0' : '-1')); };
  setTab(tabbed);
  const doShow = (i, how) => { cur = i; show(i, how); };
  const doHide = () => { cur = -1; hide(); };

  marks.forEach((m, i) => {
    m.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') doShow(i, 'hover'); });
    m.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      if (cur === i && openTip) { doHide(); return; }
      doShow(i, 'tap');
    });
    m.addEventListener('focus', () => { setTab(i); doShow(i, 'focus'); });
    m.addEventListener('blur', (e) => { if (!host.contains(e.relatedTarget)) doHide(); });
    if (activate) m.addEventListener('click', () => activate(i));
    m.addEventListener('keydown', (e) => {
      let d = 0;
      const k = e.key;
      if (nav === 'h') d = k === 'ArrowRight' ? 1 : k === 'ArrowLeft' ? -1 : 0;
      else if (nav === 'ring') d = (k === 'ArrowRight' || k === 'ArrowDown') ? 1 : (k === 'ArrowLeft' || k === 'ArrowUp') ? -1 : 0;
      else d = k === 'ArrowLeft' ? 1 : k === 'ArrowRight' ? -1 : k === 'ArrowDown' ? 7 : k === 'ArrowUp' ? -7 : 0;
      let to = -1;
      if (d) to = clamp(i + d, 0, n - 1);
      else if (k === 'Home') to = 0;
      else if (k === 'End') to = n - 1;
      else if (k === 'Escape') { doHide(); return; }
      else if ((k === 'Enter' || k === ' ') && activate && m.tagName.toLowerCase() !== 'button') {
        e.preventDefault(); activate(i); return;
      }
      if (to >= 0) { e.preventDefault(); marks[to].focus(); }
    });
  });

  // Re-wired on every responsive redraw: replace (never stack) the host listener.
  if (host.__chartLeave) host.removeEventListener('pointerleave', host.__chartLeave);
  host.__chartLeave = (e) => {
    if (e.pointerType !== 'mouse') return;
    const f = marks.indexOf(document.activeElement);
    if (f >= 0) doShow(f, 'focus'); else doHide();
  };
  host.addEventListener('pointerleave', host.__chartLeave);
  return { get focused() { return marks.indexOf(document.activeElement); }, get tabbed() { return tabbed; } };
}

/** Width-driven redraw. draw(width) must rebuild and return the new <svg>. */
function responsive(plot, draw, fallback = 340) {
  let w = 0;
  const render = (width) => {
    const hadFocus = plot.contains(document.activeElement);
    const st = draw(width, hadFocus);
    return st;
  };
  render(fallback);
  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver((entries) => {
      const nw = Math.round(entries[0].contentRect.width);
      if (!nw || nw === w) return;
      w = nw;
      render(nw);
    });
    ro.observe(plot);
  }
}

/** Shared cartesian frame: y gridlines + tick labels, returns scale info. */
function yFrame(svg, { width, height, lo, hi, ticks, tickFmt, mt, mb, zeroLine }) {
  const tickLabels = ticks.map((t) => stripMarks(tickFmt(t)));
  const gutter = Math.ceil(Math.max(...tickLabels.map((s) => s.length), 1) * CHAR_W) + 10;
  const x0 = gutter, x1 = width - 4;
  const top = mt, bot = height - mb;
  const y = (v) => top + ((hi - v) / (hi - lo || 1)) * (bot - top);
  const g = svgEl('g', { class: 'axis', 'aria-hidden': 'true' }, svg);
  ticks.forEach((t, i) => {
    const yy = r1(y(t)) + 0.5;
    svgEl('line', { class: `gridline${t === 0 && (zeroLine || lo < 0) ? ' is-zero' : ''}`, x1: x0, x2: x1, y1: yy, y2: yy }, g);
    svgEl('text', { class: 'tick', x: x0 - 8, y: yy, dy: '0.35em', 'text-anchor': 'end', text: tickLabels[i] }, g);
  });
  return { x0, x1, top, bot, y };
}

function newSvg(width, height, label) {
  return svgEl('svg', {
    xmlns: NS, viewBox: `0 0 ${width} ${height}`, width, height,
    role: 'group', 'aria-label': label, focusable: 'false',
    style: { height: `${height}px` },
  });
}

/* ==================================================================== donut */

export function donut(items, { size = 220, thickness = 26, centerTitle, centerValue, onSelect, format, label } = {}) {
  const fmt = format || fullMoney;
  const all = (items || []).map((it) => ({ ...it, value: Math.max(0, num(it.value)) }));
  const total = all.reduce((a, b) => a + b.value, 0);
  const shown = all.map((it, i) => ({ ...it, index: i })).filter((it) => it.value > 0);
  const pct = (v) => (total ? `${Math.round((v / total) * 100)}%` : '0%');

  const summary = label || (centerTitle ? `תרשים טבעת: ${centerTitle}` : 'תרשים טבעת');
  const root = htmlEl('div', { class: 'chart chart-donut' });
  const plot = htmlEl('div', { class: 'chart-plot donut-plot', style: { maxWidth: `${size}px` } });
  root.append(plot);

  const pad = 6; // room for the hover lift
  const ro = size / 2 - pad, ri = ro - thickness, rm = (ro + ri) / 2;
  const c = size / 2;
  const svg = svgEl('svg', { xmlns: NS, viewBox: `0 0 ${size} ${size}`, role: 'group', 'aria-label': summary, focusable: 'false' }, plot);
  svgEl('circle', { class: 'donut-track', cx: c, cy: c, r: rm, style: { strokeWidth: `${thickness}px` } }, svg);

  const centerEl = htmlEl('div', { class: 'donut-center', 'aria-hidden': 'true', style: { '--inner': `${((ri * 2 - 16) / size) * 100}%` } });
  const cTitle = htmlEl('div', { class: 'donut-title' });
  const cValue = htmlEl('div', { class: 'donut-value' });
  const cSub = htmlEl('div', { class: 'donut-sub' });
  centerEl.append(cTitle, cValue, cSub);
  plot.append(centerEl);
  const setCenter = (t, v, sub) => {
    cTitle.textContent = t || '';
    cValue.replaceChildren(v ? moneyBdi(v) : '');
    cSub.textContent = sub || '';
    cSub.hidden = !sub;
  };
  const resetCenter = () => setCenter(centerTitle ?? (total ? 'סה״כ' : ''), centerValue ?? (total ? fmt(total) : 'אין נתונים'), '');
  resetCenter();

  const pt = (r, a) => [r1(c + r * Math.cos(a)), r1(c + r * Math.sin(a))];
  const gapPx = shown.length > 1 ? 3 : 0;
  const cr = Math.min(6, thickness / 2);
  const g = svgEl('g', { class: 'donut-segs' }, svg);
  const marks = [];
  let a = -Math.PI / 2;
  shown.forEach((it, k) => {
    const span = (it.value / total) * Math.PI * 2;
    const a0 = a, a1 = a + span;
    a = a1;
    let seg;
    if (shown.length === 1) {
      seg = svgEl('circle', { class: 'donut-seg', cx: c, cy: c, r: rm, style: { stroke: it.color, strokeWidth: `${thickness}px`, fill: 'none' } }, g);
    } else {
      const p = gapPx / 2 / rm;
      const s0 = a0 + p, s1 = a1 - p;
      const sw = Math.max(s1 - s0, 0.8 / rm);
      const e0 = sw === s1 - s0 ? s0 : (a0 + a1) / 2 - sw / 2;
      const e1 = e0 + sw;
      const rc = Math.min(cr, (sw * ri) / 2, thickness / 2);
      const dO = rc / ro, dI = rc / ri;
      const large = (sw > Math.PI) ? 1 : 0;
      const P = (r, ang) => pt(r, ang).join(',');
      const d = [
        `M${P(ro, e0 + dO)}`,
        `A${ro},${ro} 0 ${large} 1 ${P(ro, e1 - dO)}`,
        `Q${P(ro, e1)} ${P(ro - rc, e1)}`,
        `L${P(ri + rc, e1)}`,
        `Q${P(ri, e1)} ${P(ri, e1 - dI)}`,
        `A${ri},${ri} 0 ${large} 0 ${P(ri, e0 + dI)}`,
        `Q${P(ri, e0)} ${P(ri + rc, e0)}`,
        `L${P(ro - rc, e0)}`,
        `Q${P(ro, e0)} ${P(ro, e0 + dO)}`, 'Z',
      ].join('');
      seg = svgEl('path', { class: 'donut-seg', d, style: { fill: it.color } }, g);
    }
    seg.style.setProperty('--i', k);
    seg.setAttribute('role', onSelect ? 'button' : 'img');
    seg.setAttribute('aria-label', `${it.label}: ${stripMarks(fmt(it.value))} (${pct(it.value)})`);
    marks.push(seg);
  });

  if (marks.length) {
    interact(plot, marks, {
      nav: 'ring',
      show(i) {
        const it = shown[i];
        marks.forEach((m, j) => m.classList.toggle('is-active', j === i));
        svg.classList.add('has-active');
        setCenter(it.label, fmt(it.value), pct(it.value));
      },
      hide() {
        marks.forEach((m) => m.classList.remove('is-active'));
        svg.classList.remove('has-active');
        resetCenter();
      },
      activate: onSelect ? (i) => onSelect(shown[i].index) : null,
    });
  }
  if (onSelect) root.classList.add('is-selectable');

  root.append(srTable(summary, ['פריט', 'סכום', 'אחוז'], all.map((it) => [it.label, stripMarks(fmt(it.value)), pct(it.value)])));
  armAnimation(root);
  return root;
}

/* ============================================================== barsCompare */

export function barsCompare(items, { aLabel = 'הכנסות', bLabel = 'הוצאות', aColor = 'var(--income)', bColor = 'var(--expense)', height = 200, format, tipFormat, highlightIndex, maxLabels, label } = {}) {
  const data = (items || []).map((it) => ({ ...it, a: num(it.a), b: num(it.b) }));
  if (!data.length) return emptyChart('bars', 'אין נתונים להצגה', height);
  const tickFmt = format || compactMoney;
  const tFmt = tipFormat || fullMoney;
  const titleOf = (it) => it.title || it.label;
  const summary = label || `${aLabel} מול ${bLabel}, ${data.length} תקופות`;
  const hi = Number.isInteger(highlightIndex) && highlightIndex >= 0 && highlightIndex < data.length ? highlightIndex : -1;

  const root = htmlEl('div', { class: 'chart chart-bars chart-compare' });
  root.append(legend([{ label: aLabel, color: aColor }, { label: bLabel, color: bColor }]));
  const plot = htmlEl('div', { class: 'chart-plot' });
  root.append(plot);
  const tip = makeTip(plot);
  let svg = null;
  const ariaFor = (it) => `${titleOf(it)}: ${aLabel} ${stripMarks(tFmt(it.a))}, ${bLabel} ${stripMarks(tFmt(it.b))}`;

  responsive(plot, (W, hadFocus) => {
    const keepFocus = hadFocus ? Math.max(0, [...plot.querySelectorAll('.hit')].indexOf(document.activeElement)) : -1;
    const nsvg = newSvg(W, height, summary);
    const max = Math.max(0, ...data.map((d) => Math.max(d.a, d.b)));
    const min = Math.min(0, ...data.map((d) => Math.min(d.a, d.b)));
    const sc = niceScale(min, max);
    const f = yFrame(nsvg, { width: W, height, ...sc, tickFmt, mt: 8, mb: 24, zeroLine: true });
    const n = data.length, bw = (f.x1 - f.x0) / n;
    const barW = clamp(Math.floor((bw * 0.72 - 2) / 2), 2, 20);
    const groupW = barW * 2 + 2;
    const y0 = f.y(0);
    const bgs = svgEl('g', { class: 'bands' }, nsvg);
    const bars = svgEl('g', { class: 'marks' }, nsvg);
    const xl = svgEl('g', { class: 'axis x-axis', 'aria-hidden': 'true' }, nsvg);
    const maxLab = maxLabels || Math.floor((f.x1 - f.x0) / (Math.max(...data.map((d) => String(d.label).length)) * CHAR_W + 12));
    const show = labelIndices(n, maxLab);
    const bandBg = [], hits = [];
    data.forEach((d, i) => {
      const bx = f.x0 + i * bw, cx = bx + bw / 2, gx = cx - groupW / 2;
      bandBg.push(svgEl('rect', { class: 'band-bg', x: r1(bx + 1), y: f.top - 4, width: r1(bw - 2), height: r1(f.bot - f.top + 4), rx: 6 }, bgs));
      const grp = svgEl('g', { class: `bar-group${hi >= 0 && i !== hi ? ' is-muted' : ''}${i === hi ? ' is-hl' : ''}` }, bars);
      [[d.a, aColor, gx], [d.b, bColor, gx + barW + 2]].forEach(([v, col, x]) => {
        let yv = f.y(v);
        let cls = 'bar';
        if (v === 0) { yv = y0 - 2; cls += ' is-zero'; } else if (Math.abs(yv - y0) < 2) yv = v > 0 ? y0 - 2 : y0 + 2;
        if (v < 0) cls += ' is-neg';
        const p = svgEl('path', { class: cls, d: barPath(x, barW, y0, yv, 4) }, grp);
        if (v !== 0) p.style.fill = col;
        p.style.setProperty('--i', i);
      });
      if (show.has(i)) svgEl('text', { class: `tick x${i === hi ? ' is-hl' : ''}`, x: r1(cx), y: height - 7, 'text-anchor': 'middle', text: stripMarks(d.label) }, xl);
      const hit = svgEl('rect', { class: 'hit', x: r1(bx), y: 0, width: r1(bw), height, role: 'img', 'aria-label': ariaFor(d) }, nsvg);
      hits.push(hit);
    });
    if (svg) svg.replaceWith(nsvg); else plot.prepend(nsvg);
    svg = nsvg;
    const ctl = interact(plot, hits, {
      initial: hi >= 0 ? hi : n - 1,
      show(i) {
        bandBg.forEach((b, j) => b.classList.toggle('is-on', j === i));
        const d = data[i];
        const saved = d.a - d.b;
        tip.set(titleOf(d), [
          { label: aLabel, value: tFmt(d.a), color: aColor },
          { label: bLabel, value: tFmt(d.b), color: bColor },
        ], `${saved >= 0 ? 'נחסכו' : 'גירעון'} ${stripMarks(tFmt(Math.abs(saved)))}`);
        const bx = f.x0 + i * bw;
        tip.placeBeside(bx + bw / 2 - groupW / 2, bx + bw / 2 + groupW / 2, f.top);
      },
      hide() { bandBg.forEach((b) => b.classList.remove('is-on')); tip.hide(); },
    });
    if (keepFocus >= 0) hits[Math.min(keepFocus, hits.length - 1)].focus();
    return ctl;
  });

  root.append(srTable(summary, ['תקופה', aLabel, bLabel], data.map((d) => [titleOf(d), stripMarks(tFmt(d.a)), stripMarks(tFmt(d.b))])));
  armAnimation(root);
  return root;
}

/* =============================================================== barsSimple */

export function barsSimple(items, { height = 140, format, tipFormat, highlightIndex, maxLabels, color = 'var(--accent)', valueLabel = 'הוצאות', label, labelMax = true } = {}) {
  const data = (items || []).map((it) => ({ ...it, value: num(it.value) }));
  if (!data.length) return emptyChart('bars', 'אין נתונים להצגה', height);
  const tickFmt = format || compactMoney;
  const tFmt = tipFormat || fullMoney;
  const titleOf = (it) => it.title || it.label;
  const summary = label || `תרשים עמודות: ${valueLabel}, ${data.length} עמודות`;
  const hi = Number.isInteger(highlightIndex) && highlightIndex >= 0 && highlightIndex < data.length ? highlightIndex : -1;

  const root = htmlEl('div', { class: 'chart chart-bars chart-simple' });
  const plot = htmlEl('div', { class: 'chart-plot' });
  root.append(plot);
  const tip = makeTip(plot);
  let svg = null;

  let maxI = -1;
  data.forEach((d, i) => { if (d.value > 0 && (maxI < 0 || d.value > data[maxI].value)) maxI = i; });

  responsive(plot, (W, hadFocus) => {
    const keepFocus = hadFocus ? Math.max(0, [...plot.querySelectorAll('.hit')].indexOf(document.activeElement)) : -1;
    const nsvg = newSvg(W, height, summary);
    const max = Math.max(0, ...data.map((d) => d.value));
    const min = Math.min(0, ...data.map((d) => d.value));
    const sc = niceScale(min, max, height < 120 ? 2 : 3);
    const showMax = labelMax && maxI >= 0 && data.length > 1;
    const f = yFrame(nsvg, { width: W, height, ...sc, tickFmt, mt: showMax ? 18 : 8, mb: 24, zeroLine: true });
    const n = data.length, bw = (f.x1 - f.x0) / n;
    let barW = clamp(Math.round(bw * 0.62), 2, 24);
    if (bw - barW < 2) barW = Math.max(1, bw - 2);
    const y0 = f.y(0);
    const bgs = svgEl('g', { class: 'bands' }, nsvg);
    const bars = svgEl('g', { class: 'marks' }, nsvg);
    const xl = svgEl('g', { class: 'axis x-axis', 'aria-hidden': 'true' }, nsvg);
    const longest = Math.max(...data.map((d) => String(d.label).length));
    const fit = Math.floor((f.x1 - f.x0) / (longest * CHAR_W + 10));
    const show = labelIndices(n, Math.min(maxLabels || Infinity, fit));
    if (hi >= 0 && !show.has(hi) && fit >= 3) {
      // keep the highlighted label; drop its nearest neighbour(s) to avoid overlap
      const minGap = Math.ceil((longest * CHAR_W + 10) / bw);
      for (const j of [...show]) if (Math.abs(j - hi) < minGap) show.delete(j);
      show.add(hi);
    }
    const bandBg = [], hits = [];
    data.forEach((d, i) => {
      const bx = f.x0 + i * bw, cx = bx + bw / 2, x = cx - barW / 2;
      bandBg.push(svgEl('rect', { class: 'band-bg', x: r1(bx + 0.5), y: f.top - 4, width: r1(Math.max(1, bw - 1)), height: r1(f.bot - f.top + 4), rx: Math.min(6, bw / 3) }, bgs));
      let yv = f.y(d.value);
      let cls = `bar${hi >= 0 && i !== hi ? ' is-muted' : ''}${i === hi ? ' is-hl' : ''}`;
      if (d.value === 0) { yv = y0 - 2; cls += ' is-zero'; } else if (Math.abs(yv - y0) < 2) yv = d.value > 0 ? y0 - 2 : y0 + 2;
      if (d.value < 0) cls += ' is-neg';
      const p = svgEl('path', { class: cls, d: barPath(x, barW, y0, yv, Math.min(4, barW / 2)) }, bars);
      if (d.value !== 0) p.style.fill = d.color || color;
      p.style.setProperty('--i', i);
      if (show.has(i)) svgEl('text', { class: `tick x${i === hi ? ' is-hl' : ''}`, x: r1(cx), y: height - 7, 'text-anchor': 'middle', text: stripMarks(d.label) }, xl);
      if (showMax && i === maxI) {
        const t = stripMarks(tickFmt(d.value));
        const tw = t.length * CHAR_W;
        svgEl('text', { class: 'value-label', x: r1(clamp(cx, f.x0 + tw / 2, f.x1 - tw / 2)), y: r1(yv - 6), 'text-anchor': 'middle', text: t }, nsvg);
      }
      hits.push(svgEl('rect', { class: 'hit', x: r1(bx), y: 0, width: r1(bw), height, role: 'img', 'aria-label': `${titleOf(d)}: ${valueLabel} ${stripMarks(tFmt(d.value))}` }, nsvg));
    });
    if (svg) svg.replaceWith(nsvg); else plot.prepend(nsvg);
    svg = nsvg;
    const ctl = interact(plot, hits, {
      initial: hi >= 0 ? hi : n - 1,
      show(i) {
        bandBg.forEach((b, j) => b.classList.toggle('is-on', j === i));
        const d = data[i];
        tip.set(titleOf(d), [{ label: valueLabel, value: tFmt(d.value), color: d.value ? (d.color || color) : null }]);
        const cx = f.x0 + i * bw + bw / 2;
        tip.placeBeside(cx - barW / 2, cx + barW / 2, f.top);
      },
      hide() { bandBg.forEach((b) => b.classList.remove('is-on')); tip.hide(); },
    });
    if (keepFocus >= 0) hits[Math.min(keepFocus, hits.length - 1)].focus();
    return ctl;
  });

  root.append(srTable(summary, ['פריט', valueLabel], data.map((d) => [titleOf(d), stripMarks(tFmt(d.value))])));
  armAnimation(root);
  return root;
}

/* ================================================================= lineArea */

export function lineArea(points, { height = 180, format, tipFormat, color = 'var(--accent)', zeroLine = true, valueLabel = 'חיסכון מצטבר', label, maxLabels } = {}) {
  const data = (points || []).map((p) => ({ ...p, value: num(p.value) }));
  if (!data.length) return emptyChart('line', 'אין נתונים להצגה', height);
  const tickFmt = format || compactMoney;
  const tFmt = tipFormat || fullMoney;
  const titleOf = (it) => it.title || it.label;
  const first = data[0], last = data[data.length - 1];
  const summary = label || `תרשים קו: ${valueLabel}, מ־${titleOf(first)} (${stripMarks(tFmt(first.value))}) עד ${titleOf(last)} (${stripMarks(tFmt(last.value))})`;

  const root = htmlEl('div', { class: 'chart chart-line' });
  const plot = htmlEl('div', { class: 'chart-plot' });
  root.append(plot);
  const tip = makeTip(plot);
  let svg = null;
  const gid = nextId('g');

  responsive(plot, (W, hadFocus) => {
    const keepFocus = hadFocus ? Math.max(0, [...plot.querySelectorAll('.hit')].indexOf(document.activeElement)) : -1;
    const nsvg = newSvg(W, height, summary);
    const vals = data.map((d) => d.value);
    let mn = Math.min(...vals), mx = Math.max(...vals);
    if (zeroLine || mn < 0) { mn = Math.min(0, mn); mx = Math.max(0, mx); }
    if (mn === mx) { mx = mn === 0 ? 1 : mx + Math.abs(mx) * 0.5; mn = mn === 0 ? 0 : mn - Math.abs(mn) * 0.5; }
    const sc = niceScale(mn, mx, 4);
    const f = yFrame(nsvg, { width: W, height, ...sc, tickFmt, mt: 22, mb: 24, zeroLine });
    const n = data.length;
    const padX = 6;
    const xs = (i) => (n === 1 ? (f.x0 + f.x1) / 2 : f.x0 + padX + (i * (f.x1 - f.x0 - padX * 2)) / (n - 1));
    const pts = data.map((d, i) => [xs(i), f.y(d.value)]);
    const hasZero = sc.lo < 0 && sc.hi > 0 || sc.lo === 0 || sc.hi === 0;
    const base = hasZero ? f.y(0) : f.bot;
    const y0 = base;

    // defs: gradients + clip above / below the zero baseline
    const defs = svgEl('defs', null, nsvg);
    const gUp = svgEl('linearGradient', { id: `${gid}u${W}`, x1: 0, y1: f.top, x2: 0, y2: y0, gradientUnits: 'userSpaceOnUse' }, defs);
    svgEl('stop', { offset: '0', style: { stopColor: color, stopOpacity: 0.24 } }, gUp);
    svgEl('stop', { offset: '1', style: { stopColor: color, stopOpacity: 0.02 } }, gUp);
    const gDn = svgEl('linearGradient', { id: `${gid}d${W}`, x1: 0, y1: y0, x2: 0, y2: f.bot, gradientUnits: 'userSpaceOnUse' }, defs);
    svgEl('stop', { offset: '0', style: { stopColor: 'var(--expense)', stopOpacity: 0.03 } }, gDn);
    svgEl('stop', { offset: '1', style: { stopColor: 'var(--expense)', stopOpacity: 0.26 } }, gDn);
    const cUp = svgEl('clipPath', { id: `${gid}cu${W}` }, defs);
    svgEl('rect', { x: 0, y: -50, width: W, height: Math.max(0, y0 + 50) }, cUp);
    const cDn = svgEl('clipPath', { id: `${gid}cd${W}` }, defs);
    svgEl('rect', { x: 0, y: y0, width: W, height: Math.max(0, height - y0 + 50) }, cDn);

    const xl = svgEl('g', { class: 'axis x-axis', 'aria-hidden': 'true' }, nsvg);
    const longest = Math.max(...data.map((d) => String(d.label).length));
    const fit = Math.floor((f.x1 - f.x0) / (longest * CHAR_W + 12));
    const show = labelIndices(n, Math.min(maxLabels || Infinity, fit));
    data.forEach((d, i) => {
      if (!show.has(i)) return;
      const tw = String(d.label).length * CHAR_W;
      svgEl('text', { class: `tick x${i === n - 1 ? ' is-hl' : ''}`, x: r1(clamp(xs(i), f.x0 + tw / 2, f.x1 - tw / 2 + 4)), y: height - 7, 'text-anchor': 'middle', text: stripMarks(d.label) }, xl);
    });

    const cross = svgEl('line', { class: 'crosshair', x1: 0, x2: 0, y1: f.top - 6, y2: f.bot }, nsvg);
    const marks = svgEl('g', { class: 'marks' }, nsvg);
    if (n > 1) {
      const line = monotonePath(pts);
      const area = `${line}L${r1(pts[n - 1][0])},${r1(y0)}L${r1(pts[0][0])},${r1(y0)}Z`;
      const ag = svgEl('g', { class: 'area' }, marks);
      svgEl('path', { d: area, 'clip-path': `url(#${gid}cu${W})`, style: { fill: `url(#${gid}u${W})` } }, ag);
      svgEl('path', { d: area, 'clip-path': `url(#${gid}cd${W})`, style: { fill: `url(#${gid}d${W})` } }, ag);
      svgEl('path', { class: 'line', d: line, pathLength: 1, 'clip-path': `url(#${gid}cu${W})`, style: { stroke: color } }, marks);
      svgEl('path', { class: 'line', d: line, pathLength: 1, 'clip-path': `url(#${gid}cd${W})`, style: { stroke: 'var(--expense)' } }, marks);
    }
    const lastCol = last.value < 0 ? 'var(--expense)' : color;
    const [lx, ly] = pts[n - 1];
    svgEl('circle', { class: 'end-dot', cx: r1(lx), cy: r1(ly), r: 4, style: { fill: lastCol } }, marks);
    const lt = stripMarks(tickFmt(last.value));
    const below = ly - 12 < 10;
    svgEl('text', { class: 'value-label', x: r1(Math.min(lx + 4, f.x1)), y: r1(below ? ly + 18 : ly - 10), 'text-anchor': 'end', text: lt }, nsvg);
    const hoverDot = svgEl('circle', { class: 'hover-dot', r: 4, cx: 0, cy: 0 }, nsvg);

    const hits = data.map((d, i) => {
      const xa = i === 0 ? f.x0 : (xs(i - 1) + xs(i)) / 2;
      const xb = i === n - 1 ? f.x1 + 4 : (xs(i) + xs(i + 1)) / 2;
      return svgEl('rect', { class: 'hit', x: r1(xa), y: 0, width: r1(Math.max(1, xb - xa)), height, role: 'img', 'aria-label': `${titleOf(d)}: ${valueLabel} ${stripMarks(tFmt(d.value))}` }, nsvg);
    });
    if (svg) svg.replaceWith(nsvg); else plot.prepend(nsvg);
    svg = nsvg;
    const ctl = interact(plot, hits, {
      initial: n - 1,
      show(i) {
        const [x, y] = pts[i];
        const col = data[i].value < 0 ? 'var(--expense)' : color;
        cross.setAttribute('x1', r1(x) + 0.5); cross.setAttribute('x2', r1(x) + 0.5);
        hoverDot.setAttribute('cx', r1(x)); hoverDot.setAttribute('cy', r1(y));
        hoverDot.style.fill = col;
        nsvg.classList.add('has-active');
        const rows = [{ label: valueLabel, value: tFmt(data[i].value), color: col }];
        let foot = null;
        if (i > 0) {
          const dlt = data[i].value - data[i - 1].value;
          foot = `${dlt >= 0 ? '+' : '−'}${stripMarks(tFmt(Math.abs(dlt)))} לעומת ${titleOf(data[i - 1])}`;
        }
        tip.set(titleOf(data[i]), rows, foot);
        tip.placeBeside(x - 4, x + 4, f.top);
      },
      hide() { nsvg.classList.remove('has-active'); tip.hide(); },
    });
    if (keepFocus >= 0) hits[Math.min(keepFocus, hits.length - 1)].focus();
    return ctl;
  });

  root.append(srTable(summary, ['תקופה', valueLabel], data.map((d) => [titleOf(d), stripMarks(tFmt(d.value))])));
  armAnimation(root);
  return root;
}

/* ================================================================ sparkline */

export function sparkline(values, { width = 96, height = 28, color = 'var(--accent)', label } = {}) {
  const v = (values || []).map(num);
  const svg = svgEl('svg', {
    xmlns: NS, class: 'sparkline', viewBox: `0 0 ${width} ${height}`, width, height, focusable: 'false',
    role: label ? 'img' : null, 'aria-label': label || null, 'aria-hidden': label ? null : 'true',
  });
  if (!v.length) return svg;
  const pad = 3;
  const mn = Math.min(...v), mx = Math.max(...v);
  const span = mx - mn || 1;
  const xs = (i) => (v.length === 1 ? width - pad : pad + (i * (width - pad * 2)) / (v.length - 1));
  const ys = (x) => (mx === mn ? height / 2 : pad + ((mx - x) / span) * (height - pad * 2));
  const pts = v.map((x, i) => [xs(i), ys(x)]);
  if (v.length > 1) {
    const d = monotonePath(pts);
    const gid = nextId('s');
    const defs = svgEl('defs', null, svg);
    const gr = svgEl('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    svgEl('stop', { offset: '0', style: { stopColor: color, stopOpacity: 0.18 } }, gr);
    svgEl('stop', { offset: '1', style: { stopColor: color, stopOpacity: 0 } }, gr);
    svgEl('path', { class: 'spark-area', d: `${d}L${r1(pts[pts.length - 1][0])},${height}L${r1(pts[0][0])},${height}Z`, style: { fill: `url(#${gid})` } }, svg);
    svgEl('path', { class: 'spark-line', d, pathLength: 1, style: { stroke: color } }, svg);
  }
  const [lx, ly] = pts[pts.length - 1];
  svgEl('circle', { class: 'spark-dot', cx: r1(lx), cy: r1(ly), r: 2.25, style: { fill: color } }, svg);
  if (!reducedMotion()) svg.classList.add('is-anim');
  return svg;
}

/* ============================================================= calendarHeat */

const parseISO = (iso) => { const [y, m, d] = String(iso).split('-').map(Number); return new Date(y, m - 1, d); };
const toISO = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
let dayFmt = null;
const longDay = (dt) => {
  try { dayFmt ??= new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long' }); return dayFmt.format(dt); } catch { return toISO(dt); }
};

export function calendarHeat(byDay, { format, tipFormat, startWeekday = 0, onSelect, today, label } = {}) {
  const tFmt = tipFormat || fullMoney;
  void format; // axis-free: cells show day numbers, values live in tooltip/labels
  const days = (byDay || []).filter((d) => d && d.date).map((d) => ({ ...d, expense: Math.max(0, num(d.expense)), income: num(d.income) }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (!days.length) return emptyChart('heat');
  const todayIso = today || toISO(new Date());

  // Fill gaps so the range is contiguous.
  const first = parseISO(days[0].date), lastD = parseISO(days[days.length - 1].date);
  const map = new Map(days.map((d) => [d.date, d]));
  const all = [];
  for (let dt = new Date(first); dt <= lastD; dt.setDate(dt.getDate() + 1)) {
    const iso = toISO(dt);
    all.push(map.get(iso) || { date: iso, expense: 0, income: 0 });
  }
  const crossesMonth = first.getMonth() !== lastD.getMonth();

  // Quantile buckets over past/present spend days.
  const spend = all.filter((d) => d.expense > 0).map((d) => d.expense).sort((a, b) => a - b);
  const q = (p) => spend[Math.min(spend.length - 1, Math.floor(p * spend.length))];
  const cuts = spend.length >= 4 ? [q(0.25), q(0.5), q(0.75)] : spend.length ? [spend[0], spend[Math.floor(spend.length / 2)], spend[spend.length - 1]] : [];
  const level = (v) => {
    if (!v) return 0;
    if (spend.length < 4) return spend.length === 1 ? 3 : (v >= cuts[2] ? 4 : v > cuts[0] ? 3 : 2);
    return v <= cuts[0] ? 1 : v <= cuts[1] ? 2 : v <= cuts[2] ? 3 : 4;
  };

  const total = all.reduce((a, d) => a + d.expense, 0);
  const noSpend = all.filter((d) => d.date <= todayIso && d.expense === 0).length;
  const summary = label || `לוח הוצאות יומי, ${longDay(first)} עד ${longDay(lastD)}: סה״כ ${stripMarks(tFmt(total))}, ${noSpend} ימים ללא הוצאות`;

  const root = htmlEl('div', { class: 'chart chart-heat' });
  const plot = htmlEl('div', { class: 'chart-plot heat-plot', dir: 'rtl' });
  root.append(plot);
  const grid = htmlEl('div', { class: 'heat-grid', role: 'group', 'aria-label': summary });
  plot.append(grid);
  for (let k = 0; k < 7; k++) grid.append(htmlEl('div', { class: 'heat-dow', 'aria-hidden': 'true' }, DOW_SHORT[(startWeekday + k) % 7]));
  const lead = (first.getDay() - startWeekday + 7) % 7;
  for (let k = 0; k < lead; k++) grid.append(htmlEl('div', { class: 'heat-pad', 'aria-hidden': 'true' }));

  const tip = makeTip(plot);
  const cells = all.map((d, i) => {
    const dt = parseISO(d.date);
    const future = d.date > todayIso;
    const lv = future ? 0 : level(d.expense);
    const isToday = d.date === todayIso;
    const good = !future && d.expense === 0;
    const cls = ['heat-cell', `l${lv}`, future && 'is-future', isToday && 'is-today', good && 'is-nospend'].filter(Boolean).join(' ');
    const dayNum = dt.getDate();
    const txt = crossesMonth && (dayNum === 1 || i === 0) ? `${dayNum}.${dt.getMonth() + 1}` : String(dayNum);
    const aria = `${longDay(dt)}${isToday ? ' (היום)' : ''}: ${future ? 'עוד לא הגיע' : d.expense ? `הוצאות ${stripMarks(tFmt(d.expense))}` : 'ללא הוצאות'}`;
    const b = htmlEl('button', { type: 'button', class: cls, 'aria-label': aria, 'aria-current': isToday ? 'date' : null },
      htmlEl('span', { class: 'heat-num', 'aria-hidden': 'true' }, txt));
    b.style.setProperty('--i', i);
    grid.append(b);
    return b;
  });
  const trail = (7 - ((lead + all.length) % 7)) % 7;
  for (let k = 0; k < trail; k++) grid.append(htmlEl('div', { class: 'heat-pad', 'aria-hidden': 'true' }));

  const ti = all.findIndex((d) => d.date === todayIso);
  interact(plot, cells, {
    nav: 'rtl-grid',
    initial: ti >= 0 ? ti : 0,
    show(i) {
      const d = all[i], dt = parseISO(d.date);
      const rows = [];
      if (d.date > todayIso) rows.push({ label: 'עוד לא הגיע', value: '' });
      else if (d.expense) rows.push({ label: 'הוצאות', value: tFmt(d.expense), color: 'var(--expense)', strong: true });
      else rows.push({ label: 'יום ללא הוצאות', value: '', color: 'var(--good)' });
      if (d.income > 0) rows.push({ label: 'הכנסות', value: tFmt(d.income), color: 'var(--income)' });
      tip.set(longDay(dt), rows);
      const pr = plot.getBoundingClientRect(), cr = cells[i].getBoundingClientRect();
      tip.placeAbove(cr.left - pr.left + cr.width / 2, cr.top - pr.top, cr.bottom - pr.top);
    },
    hide() { tip.hide(); },
    activate: onSelect ? (i) => onSelect(all[i].date) : null,
  });
  if (onSelect) root.classList.add('is-selectable');

  const scale = htmlEl('div', { class: 'heat-legend', 'aria-hidden': 'true', dir: 'rtl' },
    htmlEl('span', { class: 'heat-legend-group' }, 'פחות',
      [1, 2, 3, 4].map((l) => htmlEl('span', { class: `heat-swatch l${l}` })), 'יותר'),
    htmlEl('span', { class: 'heat-legend-group' }, htmlEl('span', { class: 'heat-swatch is-nospend' }), 'ללא הוצאות'));
  root.append(scale);
  armAnimation(root);
  return root;
}

/* ==================================================================== meter */

export function meter(value, max, { tone, label } = {}) {
  const v = num(value), m = num(max);
  const ratio = m > 0 ? v / m : (v > 0 ? 1 : 0);
  const pct = Math.round(clamp(ratio, 0, 1) * 1000) / 10;
  const t = tone || (ratio >= 1 ? 'bad' : ratio >= 0.8 ? 'warn' : 'ok');
  const cls = ['meter', t === 'warn' && 'is-warn', t === 'bad' && 'is-bad', t === 'good' && 'is-good', ratio > 1 && 'is-over'].filter(Boolean).join(' ');
  const shown = Math.round(Math.max(0, ratio) * 100);
  const el = htmlEl('div', {
    class: cls, role: 'progressbar',
    'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(clamp(shown, 0, 100)),
    'aria-valuetext': `${shown}%`, 'aria-label': label || null,
  }, htmlEl('div', { class: 'meter-fill', style: { '--v': `${pct}%` } }));
  return el;
}
