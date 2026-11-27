/* Cart, favourites and the coupon live in this browser only (localStorage). Nothing is sent anywhere
   until the visitor places an order. Other open tabs follow along through the storage event. */
import { store } from './lib.js';
import { quote, lineKey, maxQty } from './pricing.js';

const K = { cart: 'shop-cart-v1', fav: 'shop-fav-v1', coupon: 'shop-coupon-v1', ship: 'shop-ship-v1' };
let catalog = null;
const subs = new Set();

const state = {
  cart: sanitizeCart(store.get(K.cart, [])),
  fav: sanitizeFav(store.get(K.fav, [])),
  coupon: String(store.get(K.coupon, '') || ''),
  ship: String(store.get(K.ship, '') || ''),
};

function sanitizeCart(v) {
  return Array.isArray(v) ? v.filter(l => l && typeof l.id === 'string').map(l => ({ id: l.id, qty: Math.max(1, l.qty | 0), opt: typeof l.opt === 'string' ? l.opt : '' })).slice(0, 30) : [];
}
function sanitizeFav(v) { return Array.isArray(v) ? [...new Set(v.filter(x => typeof x === 'string'))].slice(0, 200) : []; }

function emit(what) { for (const fn of subs) { try { fn(what); } catch (e) { console.error(e); } } }
function save(what) {
  if (what === 'cart') store.set(K.cart, state.cart);
  if (what === 'fav') store.set(K.fav, state.fav);
  if (what === 'coupon') store.set(K.coupon, state.coupon);
  if (what === 'ship') store.set(K.ship, state.ship);
  emit(what);
}

addEventListener('storage', e => {
  if (e.key === K.cart) { state.cart = sanitizeCart(store.get(K.cart, [])); emit('cart'); }
  if (e.key === K.fav) { state.fav = sanitizeFav(store.get(K.fav, [])); emit('fav'); }
  if (e.key === K.coupon) { state.coupon = String(store.get(K.coupon, '') || ''); emit('coupon'); }
});

export function init(c) {
  catalog = c;
  // drop favourites of products that left the catalogue; cart lines are kept and reported by quote()
  const ids = new Set(c.products.map(p => p.id));
  const fav = state.fav.filter(id => ids.has(id));
  if (fav.length !== state.fav.length) { state.fav = fav; save('fav'); }
}
export const subscribe = fn => { subs.add(fn); return () => subs.delete(fn); };
export const getCatalog = () => catalog;

/* ---------- cart ---------- */
export const cartLines = () => state.cart.slice();
export const cartQuote = (extra = {}) => quote(catalog, state.cart, { shipping: state.ship, coupon: state.coupon, ...extra });
export const cartCount = () => cartQuote().count;

/* how many more of this product (across all its options) still fit, given the stock */
export function roomFor(id) {
  const p = catalog.products.find(x => x.id === id);
  const inCart = state.cart.filter(l => l.id === id).reduce((s, l) => s + l.qty, 0);
  return Math.max(0, maxQty(p) - inCart);
}

export function addToCart(id, qty = 1, opt = '') {
  const room = roomFor(id);
  const n = Math.min(qty, room);
  if (n <= 0) return 0;
  const key = lineKey(id, opt);
  const line = state.cart.find(l => lineKey(l.id, l.opt) === key);
  if (line) line.qty += n; else state.cart.push({ id, qty: n, opt });
  save('cart');
  return n;
}
export function setQty(key, qty) {
  const line = state.cart.find(l => lineKey(l.id, l.opt) === key);
  if (!line) return;
  if (qty <= 0) return removeLine(key);
  const others = state.cart.filter(l => l !== line && l.id === line.id).reduce((s, l) => s + l.qty, 0);
  const p = catalog.products.find(x => x.id === line.id);
  line.qty = Math.max(1, Math.min(qty, maxQty(p) - others));
  save('cart');
}
export function removeLine(key) {
  const i = state.cart.findIndex(l => lineKey(l.id, l.opt) === key);
  if (i < 0) return null;
  const [gone] = state.cart.splice(i, 1);
  save('cart');
  return { line: gone, index: i };
}
export function restoreLine({ line, index }) {
  state.cart.splice(Math.min(index, state.cart.length), 0, line);
  save('cart');
}
/* keeps only what quote() accepted, at the quantities it accepted */
export function tidyCart() {
  const q = cartQuote();
  const next = q.items.map(i => ({ id: i.id, qty: i.qty, opt: i.opt }));
  if (JSON.stringify(next) !== JSON.stringify(state.cart)) { state.cart = next; save('cart'); }
  return q;
}
export function clearCart() { state.cart = []; state.coupon = ''; save('cart'); save('coupon'); }

export const getCoupon = () => state.coupon;
export function setCoupon(code) { state.coupon = String(code || '').trim().toUpperCase().slice(0, 30); save('coupon'); }
export const getShip = () => state.ship || (catalog.store.shipping[0] || {}).id || '';
export function setShip(id) { state.ship = id; save('ship'); }

/* ---------- favourites ---------- */
export const favs = () => state.fav.slice();
export const isFav = id => state.fav.includes(id);
export function toggleFav(id) {
  const on = !isFav(id);
  state.fav = on ? [id, ...state.fav] : state.fav.filter(x => x !== id);
  save('fav');
  return on;
}
