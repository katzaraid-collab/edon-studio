/* Small helpers every view uses. Nothing here touches the DOM outside what it is handed. */

export const BASE = '/shop';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ESC[c]);

/* Tagged template that escapes every interpolated value, except values wrapped in raw(). Arrays are joined. */
const RAW = Symbol('raw');
export const raw = s => ({ [RAW]: String(s) });
export function html(strings, ...vals) {
  let out = strings[0];
  for (let i = 0; i < vals.length; i++) out += flat(vals[i]) + strings[i + 1];
  return raw(out);
}
function flat(v) {
  if (v == null || v === false) return '';
  if (Array.isArray(v)) return v.map(flat).join('');
  if (typeof v === 'object' && RAW in v) return v[RAW];
  return esc(v);
}
export const str = v => flat(v);

const NUM = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 });
const NUM_AG = new Intl.NumberFormat('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/* "₪149", the sign first as the store's copy writes it ("משלוח חינם מ־₪299"), kept as one left-to-right
   unit inside Hebrew text (LRI ... PDI). Whole shekels print bare, agorot always print both digits (₪297.20). */
export const money = n => {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return '\u2066' + (v < 0 ? '\u2212' : '') + '₪' + (Number.isInteger(v) ? NUM : NUM_AG).format(Math.abs(v)) + '\u2069';
};
export const plural = (n, one, many) => n === 1 ? one : n + ' ' + many;

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const icon = (id, cls = '') => raw('<svg class="i ' + cls + '" aria-hidden="true" focusable="false"><use href="#i-' + id + '"/></svg>');

export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/* localStorage that never throws: private windows, blocked storage and full quotas just mean nothing is remembered */
export const store = {
  get(k, fallback) { try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
};
export const session = {
  get(k, fallback) { try { const v = sessionStorage.getItem(k); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; } },
  set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { sessionStorage.removeItem(k); } catch (e) {} },
};

export const reducedMotion = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

/* Hebrew-friendly search normalising: drops niqqud and punctuation, folds final letters, lower-cases Latin */
const FINALS = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
export const norm = s => String(s || '').toLowerCase()
  .replace(/\u05BE/g, ' ')                       // maqaf (Hebrew hyphen) separates words
  .replace(/[\u0591-\u05C7]/g, '')               // niqqud and cantillation marks
  .replace(/[\u05DA\u05DD\u05DF\u05E3\u05E5]/g, c => FINALS[c])   // ך ם ן ף ץ → כ מ נ פ צ
  .replace(/[\u05F3\u05F4"'`\u201C\u201D\u201E\-\u2013\u2014_.,:;!?()[\]{}]/g, ' ')  // geresh, gershayim, quotes, dashes, punctuation
  .replace(/\s+/g, ' ').trim();

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* Placeholder product art, drawn until real photos are added to a product's `images`.
   Each product gets its own composition from its id, in its category's hue, so a grid never looks repeated. */
export function art(seed, hue, iconId, { label = '' } = {}) {
  const h = hash(String(seed));
  const v = h % 4, r = (h >> 3) % 360, x = 30 + (h >> 7) % 40, y = 28 + (h >> 11) % 30, s = 0.92 + ((h >> 15) % 20) / 100;
  const hh = ((hue + ((h >> 19) % 24) - 12) + 360) % 360;
  const bg1 = `hsl(${hh} 38% 91%)`, bg2 = `hsl(${(hh + 18) % 360} 32% 84%)`;
  const mid = `hsl(${hh} 30% 74%)`, deep = `hsl(${hh} 32% 30%)`, soft = `hsl(${hh} 40% 96%)`;
  const id = 'g' + h.toString(36);
  const shapes = [
    `<circle cx="${x}" cy="${y + 8}" r="30" fill="${mid}" opacity=".55"/>`,
    `<path d="M${x - 24} 92V${y + 14}a24 24 0 0 1 48 0V92z" fill="${mid}" opacity=".55"/>`,
    `<rect x="${x - 26}" y="${y - 10}" width="52" height="52" rx="14" transform="rotate(${r % 30 - 15} ${x} ${y + 16})" fill="${mid}" opacity=".5"/>`,
    `<ellipse cx="${x + 6}" cy="${y + 10}" rx="36" ry="24" transform="rotate(${r % 40 - 20} ${x} ${y})" fill="${mid}" opacity=".5"/>`,
  ];
  return raw(`<svg class="art" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" ${label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true"'} focusable="false">`
    + `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></linearGradient></defs>`
    + `<rect width="100" height="100" fill="url(#${id})"/>`
    + `<circle cx="${100 - x}" cy="${100 - y / 2}" r="14" fill="${soft}" opacity=".7"/>`
    + shapes[v]
    + `<ellipse cx="50" cy="78" rx="${17 * s}" ry="3" fill="${deep}" opacity=".12"/>`
    + `<g transform="translate(${50 - 18 * s} ${52 - 22 * s}) scale(${1.5 * s})" fill="none" stroke="${deep}" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round"><use href="#i-${esc(iconId)}" width="24" height="24"/></g>`
    + `</svg>`);
}

export const uid = () => Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();

export function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).then(() => true, () => false);
  return Promise.resolve(false);
}

/* Page and FAQ text may carry {{tokens}} from the store config (see pages.js); unknown or empty tokens stay visible so they get noticed */
export function fill(text, st) {
  const c = st.contact || {}, courier = (st.shipping || []).find(s => s.id === 'courier') || st.shipping[0] || {};
  const map = {
    name: st.name, email: c.email, phone: c.phone, whatsapp: c.whatsapp, address: c.address, pickup: c.pickup, hours: c.hours,
    freeShippingFrom: st.freeShippingFrom, courierPrice: courier.price, courierEta: courier.eta, updated: st.updated, accessibilityContact: c.accessibilityContact,
  };
  return String(text || '').replace(/\{\{(\w+)\}\}/g, (m, k) => (map[k] != null && map[k] !== '' ? String(map[k]) : m));
}
