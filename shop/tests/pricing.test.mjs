import test from 'node:test';
import assert from 'node:assert/strict';
import { quote, maxQty, MAX_QTY, findCoupon, lineKey, round } from '../assets/js/pricing.js';
import { load } from './helpers.mjs';

// a small, fixed catalog for the rules; the real one is used below for parity with the server
const fixture = () => ({
  store: {
    name: 'בדיקה',
    freeShippingFrom: 299,
    shipping: [{ id: 'courier', label: 'שליח', price: 29 }, { id: 'pickup', label: 'איסוף', price: 0 }],
    payments: [{ id: 'phone', label: 'טלפון' }, { id: 'bit', label: 'ביט' }],
    coupons: [
      { code: 'TEN', type: 'percent', value: 10, min: 0 },
      { code: 'FIFTY', type: 'fixed', value: 50, min: 200 },
      { code: 'HUGE', type: 'fixed', value: 1000, min: 0 },
    ],
  },
  products: [
    { id: 'plain', name: 'רגיל', price: 100 },
    { id: 'few', name: 'מעט במלאי', price: 49.9, stock: 3 },
    { id: 'color', name: 'בצבעים', price: 120, stock: 5, options: { name: 'צבע', values: ['red', 'blue'] } },
    { id: 'gone', name: 'אזל', price: 80, stock: 0 },
    { id: 'size', name: 'במידות', price: 15, options: { name: 'מידה', values: ['S', 'M', 'L'] } },
    { id: 'exact', name: 'בדיוק הסף', price: 299 },
  ],
});
const C = fixture();

test('empty cart costs nothing, shipping included', () => {
  for (const lines of [[], undefined, null]) {
    const q = quote(C, lines, { shipping: 'courier' });
    assert.deepEqual(q.items, []);
    assert.equal(q.count, 0);
    assert.equal(q.subtotal, 0);
    assert.equal(q.shipping, 0);
    assert.equal(q.total, 0);
    assert.equal(q.freeShippingLeft, 299);
  }
});

test('helpers: lineKey, maxQty, round, findCoupon', () => {
  assert.equal(lineKey('a', ''), 'a');
  assert.equal(lineKey('a', 'red'), 'a|red');
  assert.equal(maxQty(null), 0);
  assert.equal(maxQty({ price: 1 }), MAX_QTY);
  assert.equal(maxQty({ stock: 3 }), 3);
  assert.equal(maxQty({ stock: 500 }), MAX_QTY);
  assert.equal(maxQty({ stock: -2 }), 0);
  assert.equal(round(149.70000000000002), 149.7);
  assert.equal(round('x'), 0);
  assert.equal(findCoupon(C.store, ' ten ').code, 'TEN');
  assert.equal(findCoupon(C.store, ''), null);
  assert.equal(findCoupon(C.store, 'NOPE'), null);
});

test('quantity is capped by stock and by MAX_QTY', () => {
  let q = quote(C, [{ id: 'few', qty: 10 }]);
  assert.equal(q.items[0].qty, 3);
  assert.equal(q.items[0].capped, true);
  assert.equal(q.items[0].total, 149.7);
  q = quote(C, [{ id: 'plain', qty: 50 }]);
  assert.equal(q.items[0].qty, MAX_QTY);
  assert.equal(q.items[0].capped, true);
  q = quote(C, [{ id: 'plain', qty: 2 }]);
  assert.equal(q.items[0].capped, false);
});

test('quantities are whole; zero, negative and junk lines are dropped', () => {
  const q = quote(C, [{ id: 'plain', qty: '2' }, { id: 'size', opt: 'S', qty: 0 }, { id: 'size', opt: 'M', qty: 2.7 }, { id: 'size', opt: 'L', qty: 'abc' }, { id: 'size', opt: 'L', qty: -3 }]);
  assert.deepEqual(q.items.map(i => i.qty), [2, 2]);
  assert.equal(q.dropped.length, 3);
});

test('the same product and option in two lines becomes one line', () => {
  const q = quote(C, [{ id: 'plain', qty: 2 }, { id: 'plain', qty: 3 }]);
  assert.equal(q.items.length, 1);
  assert.equal(q.items[0].qty, 5);
  assert.equal(q.items[0].total, round(q.items[0].unit * 5));
});

test('a product without a real price is never sold', () => {
  const bad = { ...C, products: [...C.products, { id: 'free', price: 0 }, { id: 'txt', price: 'TODO' }, { id: 'neg', price: -5 }] };
  const q = quote(bad, [{ id: 'free', qty: 1 }, { id: 'txt', qty: 1 }, { id: 'neg', qty: 1 }]);
  assert.equal(q.items.length, 0);
  assert.equal(q.dropped.length, 3);
});

test('a discount never goes below zero or above the subtotal', () => {
  const st = { ...C.store, coupons: [{ code: 'HUGE', type: 'percent', value: 150 }, { code: 'NEG', type: 'fixed', value: -40 }, { code: 'BIG', type: 'fixed', value: 99999 }] };
  const cat = { ...C, store: st };
  const lines = [{ id: 'plain', qty: 1 }];
  for (const code of ['HUGE', 'BIG']) {
    const q = quote(cat, lines, { coupon: code });
    assert.equal(q.discount, q.subtotal);
    assert.ok(q.total >= 0);
  }
  assert.equal(quote(cat, lines, { coupon: 'NEG' }).discount, 0);
});

test('a very large stock number is not read as sold out', () => {
  assert.equal(maxQty({ stock: 3e9 }), MAX_QTY);
});

test('options of one product share its stock', () => {
  const q = quote(C, [{ id: 'color', opt: 'red', qty: 4 }, { id: 'color', opt: 'blue', qty: 4 }, { id: 'color', opt: 'red', qty: 1 }]);
  assert.deepEqual(q.items.map(i => [i.key, i.qty, i.capped]), [['color|red', 4, false], ['color|blue', 1, true]]);
  assert.equal(q.dropped.length, 1);
  assert.equal(q.count, 5);
  assert.equal(q.subtotal, 600);
});

test('sold-out, unknown and bad-option lines are dropped', () => {
  const lines = [{ id: 'gone', qty: 1 }, { id: 'nope', qty: 1 }, { id: 'color', opt: 'green', qty: 1 }, { id: 'color', qty: 1 }, null, { id: 'plain', qty: 1 }];
  const q = quote(C, lines);
  assert.deepEqual(q.items.map(i => i.id), ['plain']);
  assert.equal(q.dropped.length, 5);
  // a product without options ignores any option sent with it
  assert.equal(quote(C, [{ id: 'plain', opt: 'red', qty: 1 }]).items[0].key, 'plain');
});

test('percent coupon, case and spaces ignored', () => {
  const q = quote(C, [{ id: 'plain', qty: 2 }], { shipping: 'courier', coupon: '  ten ' });
  assert.equal(q.subtotal, 200);
  assert.equal(q.discount, 20);
  assert.equal(q.coupon.code, 'TEN');
  assert.equal(q.couponError, '');
  assert.equal(q.shipping, 29);
  assert.equal(q.total, 209);
});

test('fixed coupon, never above the subtotal', () => {
  let q = quote(C, [{ id: 'plain', qty: 2 }], { coupon: 'FIFTY' });
  assert.equal(q.discount, 50);
  assert.equal(q.total, 150 + 29);
  q = quote(C, [{ id: 'size', opt: 'S', qty: 2 }], { coupon: 'HUGE' });
  assert.equal(q.discount, 30);
  assert.equal(q.total, 0 + 29);
});

test('coupon minimum and unknown codes', () => {
  let q = quote(C, [{ id: 'plain', qty: 1 }], { coupon: 'FIFTY' });
  assert.equal(q.couponError, 'min');
  assert.equal(q.discount, 0);
  assert.equal(q.coupon, null);
  q = quote(C, [{ id: 'plain', qty: 1 }], { coupon: 'NOPE' });
  assert.equal(q.couponError, 'unknown');
  assert.equal(q.total, 129);
  // exactly the minimum is enough
  q = quote(C, [{ id: 'plain', qty: 2 }], { coupon: 'fifty' });
  assert.equal(q.couponError, '');
});

test('free shipping is judged on the goods before the coupon', () => {
  let q = quote(C, [{ id: 'plain', qty: 3 }], { shipping: 'courier' });
  assert.equal(q.shipping, 0);
  assert.equal(q.total, 300);
  // a coupon that takes the total under the threshold does not bring the shipping fee back
  q = quote(C, [{ id: 'plain', qty: 3 }], { shipping: 'courier', coupon: 'TEN' });
  assert.equal(q.subtotal, 300);
  assert.equal(q.discount, 30);
  assert.equal(q.shipping, 0);
  assert.equal(q.freeShippingLeft, 0);
  assert.equal(q.total, 270);
  q = quote(C, [{ id: 'plain', qty: 2 }], { shipping: 'courier', coupon: 'TEN' });
  assert.equal(q.shipping, 29);
  assert.equal(q.freeShippingLeft, 99);
  q = quote(C, [{ id: 'exact', qty: 1 }], { shipping: 'courier' });
  assert.equal(q.shipping, 0, 'the threshold itself ships free');
  assert.equal(q.freeShippingLeft, 0);
  q = quote({ ...C, store: { ...C.store, freeShippingFrom: 0 } }, [{ id: 'plain', qty: 5 }], { shipping: 'courier' });
  assert.equal(q.shipping, 29, 'no threshold means always paid');
});

test('pickup costs its own price, which is 0', () => {
  const q = quote(C, [{ id: 'plain', qty: 1 }], { shipping: 'pickup' });
  assert.equal(q.method.id, 'pickup');
  assert.equal(q.shipping, 0);
  assert.equal(q.total, 100);
});

test('an unknown shipping method falls back to the first one', () => {
  const q = quote(C, [{ id: 'plain', qty: 1 }], { shipping: 'drone' });
  assert.equal(q.method.id, 'courier');
  assert.equal(q.shipping, 29);
});

/* ---------- parity: the browser's quote() and the server's quote() agree ---------- */

const server = await load('../../api/order.js');
const real = await load('../assets/catalog.json');

const view = r => ({
  items: r.items.map(({ product, ...i }) => i), dropped: r.dropped, count: r.count,
  subtotal: r.subtotal, discount: r.discount, coupon: r.coupon && r.coupon.code, couponError: r.couponError,
  method: r.method.id, shipping: r.shipping, freeShippingFrom: r.freeShippingFrom, freeShippingLeft: r.freeShippingLeft, total: r.total,
});

function cartsFor(cat) {
  const ps = cat.products, out = [[]];
  const opts = p => p.options && Array.isArray(p.options.values) ? p.options.values : null;
  const line = (p, qty, i = 0) => opts(p) ? { id: p.id, qty, opt: opts(p)[i % (opts(p).length || 1)] } : { id: p.id, qty };
  for (const p of ps) {
    out.push([line(p, 1)], [line(p, 3)], [line(p, 25)], [line(p, 2), line(p, 2)]);
    if (opts(p)) out.push(opts(p).map((_, i) => line(p, 7, i)), [{ id: p.id, qty: 1, opt: 'no-such-option' }], [{ id: p.id, qty: 1 }]);
  }
  out.push(ps.map((p, i) => line(p, (i % 4) + 1)));
  out.push([{ id: 'no-such-product', qty: 1 }, null, ...ps.slice(0, 2).map(p => line(p, '2'))]);
  // and a few hundred seeded random carts
  let seed = 20261127;
  const rnd = n => (seed = (seed * 48271) % 2147483647) % n;
  for (let k = 0; k < 250 && ps.length; k++) {
    const cart = [];
    for (let j = 1 + rnd(6); j > 0; j--) cart.push(line(ps[rnd(ps.length)], 1 + rnd(25), rnd(5)));
    out.push(cart);
  }
  return out;
}

function parity(cat, label) {
  const coupons = ['', 'NOPE', ...(cat.store.coupons || []).flatMap(c => [String(c.code), ' ' + String(c.code).toLowerCase() + ' '])];
  const ships = [...(cat.store.shipping || []).map(m => m.id), 'unknown'];
  let n = 0;
  for (const lines of cartsFor(cat)) for (const coupon of coupons) for (const shipping of ships) {
    const a = quote(cat, lines, { shipping, coupon }), b = server.quote(cat, lines, { shipping, coupon });
    assert.deepEqual(view(b), view(a), label + ': ' + JSON.stringify({ lines, coupon, shipping }));
    n++;
  }
  return n;
}

test('browser and server price the real catalog the same way', () => {
  assert.ok(real.products.length > 0, 'catalog.json has products');
  assert.ok(parity(real, 'catalog.json') > 100);
});

test('browser and server agree on the edge cases of the fixture catalog', () => {
  assert.ok(parity(fixture(), 'fixture') > 100);
});

test('server pricing exposes the totals the checkout shows', () => {
  const p = real.products.find(x => maxQty(x) > 0);
  const line = p.options && Array.isArray(p.options.values) ? { id: p.id, qty: 2, opt: p.options.values[0] } : { id: p.id, qty: 2 };
  const a = quote(real, [line], { shipping: 'courier' }), b = server.quote(real, [line], { shipping: 'courier' });
  for (const k of ['subtotal', 'discount', 'shipping', 'total']) assert.equal(b[k], a[k], k);
});
