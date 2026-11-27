/* Shared pieces of markup and behaviour: product cards, prices, breadcrumbs, toasts, dialogs, page meta. */
import { BASE, html, raw, str, esc, money, icon, art, $, $$, reducedMotion } from './lib.js';
import { getCatalog, isFav } from './state.js';
import { maxQty } from './pricing.js';

export const TAGS = { new: 'חדש', sale: 'מבצע', best: 'רב מכר' };

export const catOf = p => getCatalog().categories.find(c => c.slug === p.cat) || { hue: 30, icon: 'bag', name: '', slug: '' };
export const productUrl = p => `${BASE}/${p.cat}/${p.slug}`;
export const catUrl = c => `${BASE}/${c.slug}`;
export const soldOut = p => maxQty(p) === 0;
export const lowStock = p => typeof p.stock === 'number' && p.stock > 0 && p.stock <= 3;
export const pctOff = p => p.compareAt > p.price ? Math.round((1 - p.price / p.compareAt) * 100) : 0;

/* product image: the first real photo when there is one, otherwise the drawn placeholder */
export function media(p, { eager = false, index = 0, label = false } = {}) {
  const img = (p.images || [])[index];
  if (img) {
    const src = typeof img === 'string' ? img : img.src;
    const alt = typeof img === 'string' ? p.name : (img.alt || p.name);
    return html`<img src="${src}" alt="${label ? alt : ''}" width="800" height="1000" ${raw(eager ? 'fetchpriority="high"' : 'loading="lazy" decoding="async"')}>`;
  }
  const c = catOf(p);
  return art(p.id + ':' + index, c.hue, c.icon, { label: label ? 'איור להמחשה של ' + p.name : '' });
}

export function price(p, { big = false } = {}) {
  const off = pctOff(p);
  return html`<p class="price${big ? ' big' : ''}">
    <span class="now">${off ? raw('<span class="vh">מחיר מבצע: </span>') : ''}${money(p.price)}</span>
    ${off ? html`<s class="was"><span class="vh">במקום </span>${money(p.compareAt)}</s>` : ''}
  </p>`;
}

export function badges(p) {
  const list = [];
  if (soldOut(p)) list.push(['out', 'אזל מהמלאי']);
  else {
    const off = pctOff(p);
    if (off) list.push(['sale', '−' + off + '%']);
    for (const t of p.tags || []) if (t !== 'sale' && TAGS[t]) list.push([t, TAGS[t]]);
  }
  return list.length ? html`<ul class="badges" aria-label="תגיות">${list.map(([k, v]) => html`<li class="b-${k}">${v}</li>`)}</ul>` : '';
}

export function favBtn(p, cls = '') {
  const on = isFav(p.id);
  return html`<button type="button" class="fav ${cls}" data-fav="${p.id}" aria-pressed="${String(on)}" aria-label="${'שמירה במועדפים: ' + p.name}">${icon('heart')}</button>`;
}

export function card(p, { eager = false } = {}) {
  const out = soldOut(p);
  const opts = p.options && p.options.values && p.options.values.length;
  return html`<li class="card${out ? ' is-out' : ''}">
    <a class="card-link" href="${productUrl(p)}">
      <span class="card-media">${media(p, { eager })}</span>
      <span class="card-body">
        <span class="card-cat">${catOf(p).name}</span>
        <span class="card-name">${p.name}</span>
        <span class="card-short">${p.short}</span>
      </span>
    </a>
    ${badges(p)}
    ${favBtn(p, 'on-media')}
    <div class="card-foot">
      ${price(p)}
      ${out ? html`<span class="card-note">אזל</span>`
        : opts ? html`<a class="quick" href="${productUrl(p)}" tabindex="-1" aria-hidden="true">בחירת ${p.options.name}</a>`
        : html`<button type="button" class="quick" data-add="${p.id}" aria-label="${'הוספה לסל: ' + p.name}">${icon('plus')}<span>לסל</span></button>`}
    </div>
  </li>`;
}

export const grid = (list, opts) => html`<ul class="grid" role="list">${list.map((p, i) => card(p, { eager: opts && opts.eager && i < 4 }))}</ul>`;

export function crumbs(items) {
  return html`<nav class="crumbs" aria-label="פירורי לחם"><ol>
    <li><a href="${BASE}/">דף הבית</a></li>
    ${items.map((it, i) => i === items.length - 1
      ? html`<li><span aria-current="page">${it.name}</span></li>`
      : html`<li><a href="${it.url}">${it.name}</a></li>`)}
  </ol></nav>`;
}

/* ---------- page meta ---------- */
export function setMeta({ title, description, ld }) {
  const name = getCatalog().store.name;
  document.title = title ? `${title} · ${name}` : `${name} · ${getCatalog().store.tagline}`;
  const d = $('meta[name="description"]');
  if (d && description) d.setAttribute('content', description);
  const og = $('meta[property="og:title"]'); if (og) og.setAttribute('content', document.title);
  $$('script[data-ld]').forEach(s => s.remove());
  for (const obj of [].concat(ld || [])) {
    const s = document.createElement('script');
    s.type = 'application/ld+json'; s.dataset.ld = '';
    s.textContent = JSON.stringify(obj).replace(/</g, '\\u003c');
    document.head.appendChild(s);
  }
}
export const absUrl = path => location.origin + path;
export function breadcrumbLd(items) {
  return {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [{ name: 'דף הבית', url: BASE + '/' }, ...items].map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: absUrl(it.url) })),
  };
}

/* ---------- screen-reader status ----------
   Quantity changes, coupon results, search counts: said once, politely, without moving focus. */
let sayTimer;
export function say(msg) {
  const n = $('#sr-status'); if (!n) return;
  clearTimeout(sayTimer);
  n.textContent = '';
  sayTimer = setTimeout(() => { n.textContent = msg; }, 80);
}

/* ---------- toasts ---------- */
export function toast(msg, { action, onAction, ms = 4200 } = {}) {
  const box = $('#toasts');
  for (const old of [...box.children]) if (old.dataset.msg === msg) old.remove();
  const t = document.createElement('div');
  t.dataset.msg = msg;
  t.className = 'toast';
  t.innerHTML = str(html`<span>${msg}</span>${action ? html`<button type="button">${action}</button>` : ''}`);
  if (action) t.querySelector('button').addEventListener('click', () => { onAction && onAction(); kill(); });
  box.appendChild(t);
  while (box.children.length > 2) box.firstElementChild.remove();
  let timer = setTimeout(kill, action ? ms + 2000 : ms);
  const hold = () => clearTimeout(timer), resume = () => { clearTimeout(timer); timer = setTimeout(kill, 2400); };
  t.addEventListener('mouseenter', hold); t.addEventListener('focusin', hold);
  t.addEventListener('mouseleave', resume); t.addEventListener('focusout', resume);
  function kill() { clearTimeout(timer); t.classList.add('out'); setTimeout(() => t.remove(), reducedMotion() ? 0 : 260); }
}

/* ---------- dialogs (menu, cart drawer) ----------
   Opening makes the rest of the page inert, moves focus in, and Escape / the scrim / any [data-close] closes it.
   Focus goes back to whatever opened it. */
const open = [];
const OUTSIDE = ['#hdr', '#main', '#ftr', '#announce', '.skip'];
export function openSheet(id, opener) {
  const el = document.getElementById(id);
  if (!el || (!el.hidden && !el._closing)) return;
  clearTimeout(el._t); el._closing = false; el.inert = false;
  el.hidden = false;
  el._opener = opener || document.activeElement;
  if (!open.includes(el)) open.push(el);
  for (const s of OUTSIDE) { const n = $(s); if (n) n.inert = true; }
  document.documentElement.classList.add('locked');
  requestAnimationFrame(() => el.classList.add('in'));
  const first = el.querySelector('[data-autofocus]') || el.querySelector('.sheet-hd [data-close]');
  if (first) first.focus();
  if (el._opener && el._opener.setAttribute && el._opener.hasAttribute('aria-expanded')) el._opener.setAttribute('aria-expanded', 'true');
}
/* The page behind is released immediately, so focus can move there right away (to the opener, or to the
   next page's heading after a link inside the sheet); only hiding the panel waits for its slide-out. */
export function closeSheet(id, { restore = true } = {}) {
  const el = typeof id === 'string' ? document.getElementById(id) : id;
  if (!el || el.hidden || el._closing) return;
  el._closing = true;
  el.classList.remove('in');
  el.inert = true;
  const i = open.indexOf(el); if (i >= 0) open.splice(i, 1);
  if (!open.length) {
    for (const s of OUTSIDE) { const n = $(s); if (n) n.inert = false; }
    document.documentElement.classList.remove('locked');
  }
  const opener = el._opener;
  if (opener && opener.hasAttribute && opener.hasAttribute('aria-expanded')) opener.setAttribute('aria-expanded', 'false');
  if (restore && opener && document.contains(opener)) opener.focus();
  const done = () => { el.hidden = true; el.inert = false; el._closing = false; };
  if (reducedMotion()) done(); else el._t = setTimeout(done, 280);
}
export const sheetOpen = id => { const el = document.getElementById(id); return !!el && !el.hidden; };
export function wireSheets() {
  for (const el of $$('.sheet')) {
    el.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeSheet(el); });
  }
  document.addEventListener('keydown', e => {
    const top = open[open.length - 1];
    if (!top) return;
    if (e.key === 'Escape') { e.preventDefault(); closeSheet(top); return; }
    if (e.key !== 'Tab') return;
    const f = $$('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])', top.querySelector('.sheet-panel')).filter(n => n.offsetParent !== null);
    if (!f.length) return;
    const a = f[0], z = f[f.length - 1];
    if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
    else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
  });
}

/* a quantity stepper; the caller handles [data-step] clicks and the input's change */
export function stepper({ value, max, key = '', label }) {
  return html`<div class="stepper" role="group" aria-label="${label}">
    <button type="button" data-step="-1" data-key="${key}" aria-label="${value <= 1 && key ? 'הסרה מהסל' : 'הפחתת כמות'}" aria-disabled="${String(value <= 1 && !key)}">${icon(value <= 1 && key ? 'trash' : 'minus')}</button>
    <input type="number" inputmode="numeric" min="1" max="${max}" value="${value}" data-qty="${key}" aria-label="כמות">
    <button type="button" data-step="1" data-key="${key}" aria-label="הוספת כמות" aria-disabled="${String(value >= max)}">${icon('plus')}</button>
  </div>`;
}

export { esc, str, html, raw, money, icon, media as productMedia };
