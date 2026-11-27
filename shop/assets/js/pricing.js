/* Shop price math, shared by the cart, the checkout and (mirrored) api/order.js.
   Every price in catalog.json is in shekels and already includes VAT.
   The server never trusts the browser's totals: it runs the same math on the catalog it holds,
   and shop/tests/pricing.test.mjs checks the two give the same answer. */

export const MAX_QTY = 20;

export const round = n => Math.round((Number(n) || 0) * 100) / 100;

export const lineKey = (id, opt) => opt ? id + '|' + opt : id;

export function findCoupon(store, code) {
  const c = String(code || '').trim().toUpperCase();
  if (!c) return null;
  return (store.coupons || []).find(k => String(k.code).toUpperCase() === c) || null;
}

/* The most a product can be ordered in one go: the stock when the catalog tracks it, never above MAX_QTY. */
export function maxQty(p) {
  if (!p) return 0;
  if (typeof p.stock === 'number') return Math.max(0, Math.min(MAX_QTY, Math.floor(p.stock) || 0));
  return MAX_QTY;
}

/* lines: [{ id, qty, opt }]; returns everything the cart and the checkout show.
   Lines for products that no longer exist, are sold out, or carry an option the product
   does not offer are dropped and reported in `dropped`, so the page can say so. */
export function quote(catalog, lines, { shipping, coupon } = {}) {
  const store = catalog.store;
  const byId = new Map(catalog.products.map(p => [p.id, p]));
  const items = [], dropped = [];
  for (const l of lines || []) {
    const p = byId.get(l && l.id);
    const opts = p && p.options && Array.isArray(p.options.values) ? p.options.values : null;
    const opt = opts ? String(l.opt || '') : '';
    const want = Math.floor(Number(l && l.qty));
    // a product without a real price is never sold for ₪0, and a line of 0 (or junk) is no line
    const priced = p && typeof p.price === 'number' && Number.isFinite(p.price) && p.price > 0;
    if (!priced || maxQty(p) === 0 || (opts && !opts.includes(opt)) || !(want >= 1)) { dropped.push(l); continue; }
    const key = lineKey(p.id, opt);
    // the same product in two lines still has one stock to share
    const used = items.filter(i => i.id === p.id).reduce((s, i) => s + i.qty, 0);
    const qty = Math.min(want, maxQty(p) - used);
    if (qty <= 0) { dropped.push(l); continue; }
    const same = items.find(i => i.key === key);
    if (same) { same.qty += qty; same.total = round(p.price * same.qty); same.capped = same.capped || qty < want; continue; }
    items.push({ key, id: p.id, opt, qty, unit: round(p.price), total: round(p.price * qty), product: p, capped: qty < want });
  }
  const count = items.reduce((s, i) => s + i.qty, 0);
  const subtotal = round(items.reduce((s, i) => s + i.total, 0));

  let discount = 0, applied = null, couponError = '';
  if (coupon) {
    const cp = findCoupon(store, coupon);
    if (!cp) couponError = 'unknown';
    else if (subtotal < (cp.min || 0)) couponError = 'min';
    else {
      const raw = cp.type === 'percent' ? round(subtotal * (Number(cp.value) || 0) / 100) : round(cp.value);
      discount = Math.max(0, Math.min(raw, subtotal)); // never below zero, never more than the goods
      applied = cp;
    }
  }
  const afterDiscount = round(subtotal - discount);

  const methods = store.shipping || [];
  const method = methods.find(m => m.id === shipping) || methods[0] || { id: 'none', price: 0 };
  const freeFrom = Number(store.freeShippingFrom) || 0;
  const free = freeFrom > 0 && afterDiscount >= freeFrom;
  const shippingCost = count === 0 ? 0 : (free ? 0 : round(method.price || 0));

  return {
    items, dropped, count, subtotal,
    discount, coupon: applied, couponError,
    method, shipping: shippingCost,
    freeShippingFrom: freeFrom,
    freeShippingLeft: freeFrom > 0 ? Math.max(0, round(freeFrom - afterDiscount)) : 0,
    total: round(afterDiscount + shippingCost),
  };
}
