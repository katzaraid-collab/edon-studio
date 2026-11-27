/* Store entry point: loads the catalogue, draws the frame (header, menu, footer, cart drawer, search)
   and routes /shop/... addresses to views without full page loads. Vercel rewrites every /shop/* path
   that isn't under /shop/assets/ to this page, so deep links and refreshes land here too. */
import { BASE, html, str, raw, money, icon, $, $$, debounce, norm, reducedMotion } from './lib.js';
import * as S from './state.js';
import { toast, say, openSheet, closeSheet, sheetOpen, wireSheets, productUrl, catUrl, productMedia, stepper, soldOut } from './ui.js';
import home from './views/home.js';
import listing from './views/listing.js';
import product from './views/product.js';
import cart from './views/cart.js';
import checkout from './views/checkout.js';
import thanks from './views/thanks.js';
import info from './views/info.js';
import notFound from './views/notfound.js';

const main = $('#main');
let catalog, cleanup = null, lastPath = null;

/* ---------- routing ---------- */
const RESERVED = { all: 1, search: 1, favorites: 1, cart: 1, checkout: 1, thanks: 1, info: 1, assets: 1 };
function resolve(url) {
  const rest = url.pathname.replace(/\/+$/, '').slice(BASE.length).split('/').filter(Boolean).map(decodeURIComponent);
  const q = url.searchParams;
  const [a, b] = rest;
  if (!a) return { view: home };
  if (rest.length === 1 && a === 'all') return { view: listing, params: { mode: 'all' } };
  if (rest.length === 1 && a === 'search') return { view: listing, params: { mode: 'search', q: q.get('q') || '' } };
  if (rest.length === 1 && a === 'favorites') return { view: listing, params: { mode: 'fav' } };
  if (rest.length === 1 && a === 'cart') return { view: cart };
  if (rest.length === 1 && a === 'checkout') return { view: checkout };
  if (rest.length === 1 && a === 'thanks') return { view: thanks };
  if (rest.length === 2 && a === 'info') return { view: info, params: { slug: b } };
  if (!RESERVED[a]) {
    const cat = catalog.categories.find(c => c.slug === a);
    if (cat && rest.length === 1) return { view: listing, params: { mode: 'cat', cat } };
    if (cat && rest.length === 2) {
      const p = catalog.products.find(x => x.slug === b && x.cat === cat.slug);
      if (p) return { view: product, params: { product: p } };
      // an old link to a product that moved category still lands on it
    }
    if (rest.length === 2) {
      const p = catalog.products.find(x => x.slug === b);
      if (p) return { redirect: productUrl(p) };
    }
  }
  return { view: notFound };
}

export function go(href, { replace = false } = {}) {
  const url = new URL(href, location.href);
  if (url.origin !== location.origin || !url.pathname.startsWith(BASE)) { location.href = url.href; return; }
  const key = Math.random().toString(36).slice(2);
  saveScroll();
  history[replace ? 'replaceState' : 'pushState']({ key }, '', url.pathname + url.search + url.hash);
  render({ fresh: true });
}

const scrolls = new Map();
function saveScroll() { const k = history.state && history.state.key; if (k) scrolls.set(k, scrollY); }

function render({ fresh = false, pop = false } = {}) {
  const url = new URL(location.href);
  const r = resolve(url);
  if (r.redirect) { history.replaceState(history.state, '', r.redirect); return render({ fresh }); }
  if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
  const pageKey = url.pathname + url.search;
  const samePage = lastPath === pageKey;
  lastPath = pageKey;
  // a link inside the menu or the cart drawer leads to a new page: the dialog closes with it
  closeSheet('menu', { restore: false });
  closeSheet('drawer', { restore: false });
  closeSearch(false);

  let out;
  try { out = r.view({ catalog, params: r.params || {}, query: url.searchParams, url, go }); }
  catch (e) { console.error(e); out = notFound({ catalog, error: true }); }
  main.innerHTML = str(out.body);
  main.dataset.view = out.name || '';
  document.body.dataset.view = out.name || '';
  if (out.mount) cleanup = out.mount(main) || null;
  markNav(url);

  // scroll: back/forward restores where the visitor was; a new page starts at the top or at its #anchor
  const k = history.state && history.state.key;
  if (pop && k && scrolls.has(k)) scrollTo(0, scrolls.get(k));
  else if (url.hash && document.getElementById(url.hash.slice(1))) document.getElementById(url.hash.slice(1)).scrollIntoView();
  else if (fresh && !samePage) scrollTo(0, 0);

  // keyboard and screen-reader users land on the new page's heading (not on the very first load);
  // focusing the h1 already reads it, so the title is announced only on a page without one
  if ((fresh || pop) && !samePage) {
    const h1 = main.querySelector('h1');
    if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
    else { const ann = $('#route-announcer'); ann.textContent = ''; setTimeout(() => { ann.textContent = document.title; }, 60); }
  }
}

function markNav(url) {
  for (const a of $$('.cats-nav a, #menu-body a')) {
    const here = new URL(a.href).pathname.replace(/\/+$/, '');
    const now = url.pathname.replace(/\/+$/, '');
    if (here === now || (here !== BASE && now.startsWith(here + '/'))) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
}

document.addEventListener('click', e => {
  if (!catalog || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest && e.target.closest('a[href]');
  if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin || !url.pathname.startsWith(BASE) || url.pathname.startsWith(BASE + '/assets/')) return;
  if (url.pathname === location.pathname && url.search === location.search && url.hash) return; // in-page anchor
  e.preventDefault();
  go(url.href);
});
addEventListener('popstate', () => render({ pop: true }));
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
addEventListener('pagehide', saveScroll);

/* ---------- frame ---------- */
function drawFrame() {
  const st = catalog.store;
  $('#logo-name').textContent = st.name;
  if (st.announcement) { const a = $('#announce'); a.textContent = st.announcement; a.hidden = false; }
  $('#cats-nav').innerHTML = str(html`<ul role="list">${catalog.categories.map(c => html`<li><a href="${catUrl(c)}">${c.name}</a></li>`)}</ul>`);
  $('#menu-body').innerHTML = str(html`
    <ul class="menu-cats" role="list">
      ${catalog.categories.map(c => html`<li><a href="${catUrl(c)}"><span class="mc-ic">${icon(c.icon)}</span><span>${c.name}</span>${icon('chev', 'end')}</a></li>`)}
      <li><a href="${BASE}/all"><span class="mc-ic">${icon('spark')}</span><span>כל המוצרים</span>${icon('chev', 'end')}</a></li>
    </ul>
    <ul class="menu-links" role="list">
      <li><a href="${BASE}/favorites">המועדפים שלי</a></li>
      <li><a href="${BASE}/info/shipping">משלוחים והחזרות</a></li>
      <li><a href="${BASE}/info/faq">שאלות נפוצות</a></li>
      <li><a href="${BASE}/info/contact">יצירת קשר</a></li>
    </ul>`);
  const c = st.contact || {};
  const y = new Date().getFullYear();
  $('#ftr').innerHTML = str(html`<div class="wrap">
    <div class="ftr-grid">
      <div class="ftr-brand">
        <a class="logo" href="${BASE}/"><span class="logo-mark" aria-hidden="true">5</span><span class="logo-name">${st.name}</span></a>
        <p>${st.tagline}</p>
      </div>
      <nav aria-labelledby="f-shop"><h2 id="f-shop">החנות</h2><ul role="list">
        ${catalog.categories.map(c => html`<li><a href="${catUrl(c)}">${c.name}</a></li>`)}
        <li><a href="${BASE}/all">כל המוצרים</a></li>
      </ul></nav>
      <nav aria-labelledby="f-help"><h2 id="f-help">עזרה ומידע</h2><ul role="list">
        <li><a href="${BASE}/info/about">אודות</a></li>
        <li><a href="${BASE}/info/faq">שאלות נפוצות</a></li>
        <li><a href="${BASE}/info/shipping">משלוחים, החזרות וביטולים</a></li>
        <li><a href="${BASE}/info/shipping">ביטול עסקה</a></li>
        <li><a href="${BASE}/info/terms">תקנון</a></li>
        <li><a href="${BASE}/info/privacy">מדיניות פרטיות</a></li>
        <li><a href="${BASE}/info/accessibility">הצהרת נגישות</a></li>
      </ul></nav>
      <div><h2>דברו איתנו</h2><ul role="list" class="ftr-contact">
        ${c.phone ? html`<li><a href="tel:${c.phone.replace(/[^\d+]/g, '')}">${icon('phone')}<span dir="ltr">${c.phone}</span></a></li>` : ''}
        ${c.whatsapp ? html`<li><a href="https://wa.me/${c.whatsapp}" target="_blank" rel="noopener">${icon('wa')}<span>וואטסאפ</span><span class="vh"> (נפתח בחלון חדש)</span></a></li>` : ''}
        ${c.email ? html`<li><a href="mailto:${c.email}">${icon('mail')}<span>${c.email}</span></a></li>` : ''}
        ${c.hours ? html`<li class="muted">${icon('clock')}<span>${c.hours}</span></li>` : ''}
      </ul></div>
    </div>
    <div class="ftr-bottom"><p>© ${y} ${st.name}. כל המחירים כוללים מע״מ.</p><p><a href="${BASE}/info/shipping">ביטול עסקה</a> · <a href="${BASE}/info/accessibility">נגישות</a> · לא נשמרים פרטי כרטיס באתר.</p></div>
  </div>`);
}

function paintCounts() {
  const n = S.cartCount();
  const b = $('#cart-count');
  b.textContent = n > 99 ? '99+' : String(n); b.hidden = n === 0;
  $('#cart-label').textContent = n ? `סל הקניות, ${n === 1 ? 'פריט אחד' : n + ' פריטים'}` : 'סל הקניות, ריק';
  const f = S.favs().length, fb = $('#fav-count');
  fb.textContent = String(f); fb.hidden = f === 0;
  $('#fav-link').setAttribute('aria-label', f ? `המועדפים שלי, ${f}` : 'המועדפים שלי');
}

/* ---------- cart drawer ---------- */
export function shipBar(q) {
  if (!q.freeShippingFrom || !q.count) return '';
  const pct = Math.min(100, Math.round(((q.freeShippingFrom - q.freeShippingLeft) / q.freeShippingFrom) * 100));
  return html`<div class="shipbar${q.freeShippingLeft ? '' : ' done'}">
    <p>${q.freeShippingLeft ? html`עוד <b>${money(q.freeShippingLeft)}</b> ותקבלו משלוח חינם` : html`${icon('check')} יש לכם משלוח חינם`}</p>
    <div class="track" role="progressbar" aria-label="התקדמות למשלוח חינם" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>
  </div>`;
}

export function lineRow(i, { compact = false } = {}) {
  const p = i.product;
  return html`<li class="line" data-line="${i.key}">
    <a class="line-media" href="${productUrl(p)}" tabindex="-1" aria-hidden="true">${productMedia(p)}</a>
    <div class="line-info">
      <a class="line-name" href="${productUrl(p)}">${p.name}</a>
      ${i.opt ? html`<p class="line-opt">${p.options.name}: ${i.opt}</p>` : ''}
      ${!compact ? html`<p class="line-unit">${money(i.unit)} ליחידה</p>` : ''}
      ${i.capped ? html`<p class="line-warn">${icon('alert')} נשארו רק ${i.qty} במלאי</p>` : ''}
      <div class="line-ctl">
        ${stepper({ value: i.qty, max: i.qty + S.roomFor(p.id), key: i.key, label: 'כמות של ' + p.name })}
        ${compact ? '' : html`<button type="button" class="link-btn" data-remove="${i.key}" aria-label="${'הסרה של ' + p.name}">הסרה</button>`}
      </div>
    </div>
    <p class="line-total">${money(i.total)}</p>
  </li>`;
}

function drawDrawer() {
  const q = S.cartQuote();
  const body = $('#drawer-body'), foot = $('#drawer-foot');
  $('#drawer-h').textContent = q.count ? `סל הקניות (${q.count})` : 'סל הקניות';
  if (!q.items.length) {
    body.innerHTML = str(html`<div class="empty">${icon('cart', 'xl')}<p class="empty-t">הסל עוד ריק</p><p>שווה להציץ במוצרים הנבחרים שלנו.</p><a class="btn" href="${BASE}/all">לכל המוצרים</a></div>`);
    foot.innerHTML = '';
    return;
  }
  body.innerHTML = str(html`${shipBar(q)}<ul class="lines" role="list">${q.items.map(i => lineRow(i, { compact: true }))}</ul>`);
  foot.innerHTML = str(html`
    <dl class="sum"><div><dt>סכום ביניים</dt><dd>${money(q.subtotal)}</dd></div>${q.discount ? html`<div class="disc"><dt>הנחה (${q.coupon.code})</dt><dd>−${money(q.discount)}</dd></div>` : ''}</dl>
    <p class="muted small">משלוח ייחושב בקופה. המחירים כוללים מע״מ.</p>
    <a class="btn block" href="${BASE}/checkout">להשלמת ההזמנה · ${money(q.total - q.shipping)}</a>
    <a class="btn ghost block" href="${BASE}/cart">צפייה בסל המלא</a>`);
}

export function openCart(opener) { drawDrawer(); openSheet('drawer', opener || $('#cart-btn')); }

/* quantity steppers and remove buttons work the same in the drawer and on the cart page */
export function handleLineEvents(root) {
  root.addEventListener('click', e => {
    const undo = e.target.closest('[data-undo]');
    if (undo) {
      const li = undo.closest('.line-gone');
      S.restoreLine(li._gone);
      say(`${li._name} חזר לסל`);
      refocus(root, `[data-line="${CSS.escape(li._key)}"] [data-step="1"]`, '.line [data-step="1"]');
      return;
    }
    const st = e.target.closest('[data-step][data-key]');
    if (st && st.dataset.key) {
      const key = st.dataset.key;
      const line = S.cartLines().find(l => (l.opt ? l.id + '|' + l.opt : l.id) === key);
      if (!line) return;
      if (st.getAttribute('aria-disabled') === 'true') { say('זו כל הכמות שיש במלאי'); return; }
      const next = line.qty + Number(st.dataset.step);
      if (next <= 0) return remove(key);
      S.setQty(key, next);
      announceLine(key);
      refocus(root, `[data-line="${CSS.escape(key)}"] [data-step="${st.dataset.step}"]`, `[data-line="${CSS.escape(key)}"] input[data-qty]`);
      return;
    }
    const rm = e.target.closest('[data-remove]');
    if (rm) remove(rm.dataset.remove);
  });
  root.addEventListener('change', e => {
    const inp = e.target.closest('input[data-qty]');
    if (inp && inp.dataset.qty) {
      const v = parseInt(inp.value, 10);
      S.setQty(inp.dataset.qty, isNaN(v) ? 1 : v);
      announceLine(inp.dataset.qty);
      refocus(root, `[data-line="${CSS.escape(inp.dataset.qty)}"] input[data-qty]`, 'h1, h2');
    }
  });
  /* the removed line leaves a note in its place with an undo button, and focus goes to that button:
     reachable by keyboard and by screen reader, and it doesn't time out */
  function remove(key) {
    const item = S.cartQuote().items.find(i => i.key === key);
    const gone = S.removeLine(key);
    if (!gone || !item) return;
    const name = item.product.name;
    const li = document.createElement('li');
    li.className = 'line-gone';
    li.innerHTML = str(html`<span>${name} הוסר מהסל</span><button type="button" class="link-btn" data-undo>ביטול ההסרה<span class="vh">: ${name}</span></button>`);
    Object.assign(li, { _gone: gone, _key: key, _name: name });
    let list = root.querySelector('.lines');
    if (!list) {
      const empty = root.querySelector('.empty');
      if (!empty) return;
      list = document.createElement('ul'); list.className = 'lines'; list.setAttribute('role', 'list');
      empty.before(list);
    }
    list.insertBefore(li, list.children[gone.index] || null);
    li.querySelector('button').focus();
    say(`${name} הוסר מהסל`);
  }
}
function announceLine(key) {
  const i = S.cartQuote().items.find(x => x.key === key);
  if (i) say(`${i.product.name}: כמות ${i.qty}, ${money(i.total)}`);
}
/* after a redraw, put focus back on the equivalent control so keyboard users keep their place */
function refocus(root, sel, fallback) {
  requestAnimationFrame(() => {
    const el = root.querySelector(sel) || root.querySelector(fallback);
    if (el) el.focus();
  });
}

/* ---------- search ---------- */
const searchBox = $('#search'), sInput = $('#search-q'), sResults = $('#search-results');
export function searchProducts(q) {
  const n = norm(q);
  if (!n) return [];
  const words = n.split(' ');
  const scored = [];
  for (const p of catalog.products) {
    const cat = catalog.categories.find(c => c.slug === p.cat);
    const name = norm(p.name), hay = norm([p.name, p.short, p.desc, (p.details || []).join(' '), cat && cat.name, p.options && p.options.values.join(' ')].join(' '));
    if (!words.every(w => hay.includes(w))) continue;
    let s = 0;
    for (const w of words) { if (name.startsWith(w)) s += 6; else if (name.includes(w)) s += 3; else s += 1; }
    if (soldOut(p)) s -= 2;
    scored.push([s, p]);
  }
  return scored.sort((a, b) => b[0] - a[0]).map(x => x[1]);
}
function openSearch() {
  searchBox.hidden = false;
  $('#search-btn').setAttribute('aria-expanded', 'true');
  sInput.focus();
  sInput.select();
}
function closeSearch(restore = true) {
  if (searchBox.hidden) return;
  searchBox.hidden = true;
  $('#search-btn').setAttribute('aria-expanded', 'false');
  if (restore) $('#search-btn').focus();
}
const liveSearch = debounce(() => {
  const q = sInput.value.trim();
  if (!q) { sResults.innerHTML = ''; return; }
  const hits = searchProducts(q);
  say(hits.length ? (hits.length === 1 ? 'נמצא מוצר אחד' : `נמצאו ${hits.length} מוצרים`) : 'לא נמצאו מוצרים');
  sResults.innerHTML = str(hits.length
    ? html`<p class="sr-count">${hits.length === 1 ? 'נמצא מוצר אחד' : `נמצאו ${hits.length} מוצרים`}</p>
      <ul role="list" class="sr-list">${hits.slice(0, 6).map(p => html`<li><a href="${productUrl(p)}"><span class="sr-media">${productMedia(p)}</span><span class="sr-name">${p.name}</span><span class="sr-price">${money(p.price)}</span></a></li>`)}</ul>
      ${hits.length > 6 ? html`<a class="sr-all" href="${BASE}/search?q=${encodeURIComponent(q)}">לכל ${hits.length} התוצאות ${icon('arrow')}</a>` : ''}`
    : html`<p class="sr-count">לא מצאנו מוצרים עבור „${q}”. אפשר לנסות מילה אחרת או <a href="${BASE}/all">לראות את כל המוצרים</a>.</p>`);
}, 120);

/* ---------- global wiring ---------- */
function wire() {
  wireSheets();
  $('#menu-btn').addEventListener('click', e => openSheet('menu', e.currentTarget));
  $('#cart-btn').addEventListener('click', e => openCart(e.currentTarget));
  $('#search-btn').addEventListener('click', () => (searchBox.hidden ? openSearch() : closeSearch()));
  $('#search-close').addEventListener('click', () => closeSearch());
  sInput.addEventListener('input', liveSearch);
  $('#search-form').addEventListener('submit', e => {
    e.preventDefault();
    const q = sInput.value.trim();
    if (q) go(`${BASE}/search?q=${encodeURIComponent(q)}`);
  });
  searchBox.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); closeSearch(); } });
  searchBox.addEventListener('focusout', e => {
    const to = e.relatedTarget;
    if (to && !searchBox.contains(to) && to !== $('#search-btn')) closeSearch(false);
  });
  document.addEventListener('pointerdown', e => {
    if (!searchBox.hidden && !e.target.closest('#search') && !e.target.closest('#search-btn')) closeSearch(false);
  });
  handleLineEvents($('#drawer'));

  // add-to-cart and favourite buttons anywhere on the page
  document.addEventListener('click', e => {
    const add = e.target.closest('[data-add]');
    if (add) {
      const p = catalog.products.find(x => x.id === add.dataset.add);
      if (!p) return;
      const n = S.addToCart(p.id, 1, '');
      if (n) { pulse(add); toast(`${p.name} נוסף לסל`, { action: 'לסל', onAction: () => openCart() }); }
      else toast(`אין עוד ${p.name} במלאי`);
      return;
    }
    const fav = e.target.closest('[data-fav]');
    if (fav) {
      const p = catalog.products.find(x => x.id === fav.dataset.fav);
      if (!p) return;
      const on = S.toggleFav(p.id);
      for (const b of $$(`[data-fav="${CSS.escape(p.id)}"]`)) {
        b.setAttribute('aria-pressed', String(on));
      }
      toast(on ? `${p.name} נשמר במועדפים` : `${p.name} הוסר מהמועדפים`);
    }
  });

  S.subscribe(what => {
    paintCounts();
    if (what === 'cart' || what === 'coupon') {
      if (sheetOpen('drawer')) drawDrawer();
      if (what === 'cart') { const b = $('#cart-btn'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
    }
  });

  // the header gets a shadow once the page scrolls under it
  const hdr = $('#hdr');
  const onScroll = () => hdr.classList.toggle('scrolled', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
}
function pulse(el) { if (reducedMotion()) return; el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); }

/* ---------- boot ---------- */
async function boot() {
  try {
    const r = await fetch(BASE + '/assets/catalog.json', { credentials: 'same-origin' });
    if (!r.ok) throw new Error('catalog ' + r.status);
    catalog = await r.json();
  } catch (e) {
    console.error(e);
    main.innerHTML = '<div class="wrap page"><h1>החנות לא נטענה</h1><p>משהו השתבש בטעינת המוצרים. אפשר לרענן את העמוד בעוד רגע.</p><p><a class="btn" href="">רענון</a></p></div>';
    return;
  }
  S.init(catalog);
  drawFrame();
  wire();
  paintCounts();
  if (!history.state || !history.state.key) history.replaceState({ key: Math.random().toString(36).slice(2) }, '');
  render();
  document.documentElement.classList.add('ready');
}
boot();
