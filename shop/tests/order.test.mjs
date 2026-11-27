import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { quote as browserQuote, maxQty } from '../assets/js/pricing.js';
import { load, fakeReq, fakeRes, stubFetch, captureErrors, envScope, ils } from './helpers.mjs';

// the catalog is read at run time (another editor may be changing it), and it is the very object the API holds
const order = await load('../../api/order.js');
const catalog = await load('../assets/catalog.json');
const store = catalog.store;

const optsOf = p => p.options && Array.isArray(p.options.values) ? p.options.values : null;
const products = catalog.products.filter(p => maxQty(p) > 0 && !(optsOf(p) && !optsOf(p).length));
const lineOf = (p, qty = 1) => optsOf(p) ? { id: p.id, qty, opt: optsOf(p)[0] } : { id: p.id, qty };
const priced = (lines, opts) => browserQuote(catalog, lines, opts);

let seq = 0;
const newId = () => 'test-order-' + String(++seq).padStart(4, '0');

function body(over = {}, customer = {}) {
  return {
    id: newId(),
    items: [lineOf(products[0])],
    shipping: 'courier', payment: 'phone', coupon: '',
    customer: { first: 'דנה', last: 'כהן', phone: '050-1234567', email: 'dana@example.com', city: 'תל אביב', street: 'הרצל', house: '12', apt: '3', zip: '6100000', notes: '', ...customer },
    consent: true, news: false, hp: '',
    ...over,
  };
}

async function call(opts) { const res = fakeRes(); await order(fakeReq(opts), res); return res; }
const post = (b, extra) => call({ body: b, ...extra });

describe('catalog.json has what the order API relies on', () => {
  it('shipping, payments, ids and prices', () => {
    assert.ok(products.length > 0, 'at least one product can be ordered');
    for (const id of ['courier', 'pickup']) assert.ok(store.shipping.some(m => m.id === id), 'shipping ' + id);
    assert.equal(store.shipping.find(m => m.id === 'pickup').price, 0, 'pickup is free');
    for (const id of ['phone', 'bit']) assert.ok(store.payments.some(m => m.id === id), 'payment ' + id);
    const ids = catalog.products.map(p => p.id);
    assert.equal(new Set(ids).size, ids.length, 'product ids are unique');
    for (const p of catalog.products) {
      assert.ok(typeof p.price === 'number' && p.price > 0, p.id + ' has a price');
      assert.ok(!String(p.id).includes('|'), p.id + ' has no | (it separates the option in a line key)');
    }
  });
});

describe('api/order.js', () => {
  let restoreEnv, mails, errors;
  beforeEach(() => {
    restoreEnv = envScope({ RESEND_API_KEY: 're_test_key', ORDER_TO: 'owner@shop.test' });
    mails = stubFetch();
    errors = captureErrors();
    order._reset();
  });
  afterEach(() => { mails.restore(); errors.restore(); restoreEnv(); });

  it('GET says ready only with a key and an inbox', async () => {
    const get = async () => { const r = await call({ method: 'GET' }); assert.equal(r.statusCode, 200); return r; };
    let r = await get();
    assert.deepEqual(r.json, { ready: true });
    assert.match(r.headers['cache-control'], /s-maxage=300/);
    delete process.env.ORDER_TO;
    assert.deepEqual((await get()).json, { ready: false });
    process.env.CONTACT_TO = 'studio@shop.test';
    assert.deepEqual((await get()).json, { ready: true }, 'CONTACT_TO is the fallback inbox');
    delete process.env.RESEND_API_KEY;
    assert.deepEqual((await get()).json, { ready: false });
    process.env.RESEND_API_KEY = '   ';
    assert.deepEqual((await get()).json, { ready: false }, 'blank values do not count');
    assert.equal(mails.length, 0);
  });

  it('refuses other methods', async () => {
    const r = await call({ method: 'PUT', body: body() });
    assert.equal(r.statusCode, 405);
    assert.equal(r.headers.allow, 'GET, POST');
    assert.deepEqual(r.json, { ok: false, error: 'method' });
    assert.equal(mails.length, 0);
  });

  it('503 until the mail settings exist', async () => {
    delete process.env.RESEND_API_KEY;
    const r = await post(body());
    assert.equal(r.statusCode, 503);
    assert.deepEqual(r.json, { ok: false, error: 'not_configured' });
  });

  it('403 for a post from another site', async () => {
    let r = await post(body(), { headers: { origin: 'https://evil.example' } });
    assert.equal(r.statusCode, 403);
    assert.deepEqual(r.json, { ok: false, error: 'origin' });
    r = await post(body(), { headers: { origin: 'not a url' } });
    assert.equal(r.statusCode, 403);
    assert.equal(mails.length, 0);
    r = await post(body(), { headers: { origin: 'https://shop.test' } });
    assert.equal(r.statusCode, 200);
    r = await post(body(), { headers: { origin: 'https://www.shop.example', host: 'internal:3000', 'x-forwarded-host': 'www.shop.example' } });
    assert.equal(r.statusCode, 200, 'the forwarded host is the one the browser saw');
  });

  it('415 for anything but JSON', async () => {
    const r = await post(JSON.stringify(body()), { headers: { 'content-type': 'text/plain' } });
    assert.equal(r.statusCode, 415);
    assert.deepEqual(r.json, { ok: false, error: 'type' });
  });

  it('400 for broken or oversized bodies; a streamed body is read', async () => {
    let r = await post('{"id": "abc');
    assert.equal(r.statusCode, 400);
    assert.deepEqual(r.json, { ok: false, error: 'invalid' });
    r = await call({ raw: JSON.stringify(body({ pad: 'x'.repeat(33000) })) });
    assert.equal(r.statusCode, 400, 'over 32 KB');
    r = await post(body(), { headers: { 'content-length': '40000' } });
    assert.equal(r.statusCode, 400, 'declared over 32 KB');
    r = await call({ raw: JSON.stringify(body({ pad: 'x'.repeat(20000) })) });
    assert.equal(r.statusCode, 200, 'a 20 KB body is fine');
    assert.equal(mails.length, 1);
  });

  it('a filled honeypot gets a quiet success and no email', async () => {
    const b = body({ hp: 'http://spam.example' });
    const r = await post(b);
    assert.equal(r.statusCode, 200);
    assert.equal(r.json.ok, true);
    assert.equal(r.json.number, b.id);
    assert.equal(typeof r.json.total, 'number');
    assert.equal(mails.length, 0);
  });

  it('names the first field to fix', async () => {
    const p = products[0], long = n => 'א'.repeat(n);
    const soldOut = catalog.products.find(x => maxQty(x) === 0);
    const withOpts = products.find(x => optsOf(x));
    const cases = [
      [{ id: 'short' }, 'id'],
      [{ id: 'has spaces in it' }, 'id'],
      [{ id: undefined }, 'id'],
      [{ items: [] }, 'items'],
      [{ items: 'p101' }, 'items'],
      [{ items: [null] }, 'items'],
      [{ items: Array.from({ length: 31 }, () => lineOf(p)) }, 'items'],
      [{ items: [{ id: 'no-such-product', qty: 1 }] }, 'items'],
      ...(soldOut ? [[{ items: [{ id: soldOut.id, qty: 1 }] }, 'items']] : []),
      ...(withOpts ? [[{ items: [{ id: withOpts.id, qty: 1, opt: 'no-such-option' }] }, 'items']] : []),
      [{ shipping: 'drone' }, 'shipping'],
      [{ shipping: undefined }, 'shipping'],
      [{ payment: 'cash' }, 'payment'],
      [{}, 'first', { first: 'ד' }],
      [{}, 'first', { first: long(41) }],
      [{}, 'last', { last: '' }],
      [{}, 'phone', { phone: '123' }],
      [{}, 'phone', { phone: 'call me 0501234567' }],
      [{}, 'phone', { phone: '0501234567890123' }],
      [{}, 'email', { email: '' }],
      [{}, 'email', { email: 'dana@' }],
      [{}, 'email', { email: 'dana@example' }],
      [{}, 'email', { email: 'da na@example.com' }],
      [{}, 'email', { email: 'a'.repeat(110) + '@example.com' }],
      [{}, 'city', { city: '' }],
      [{}, 'city', { city: long(61) }],
      [{}, 'street', { street: 'א' }],
      [{}, 'house', { house: '' }],
      [{}, 'house', { house: '12345678901' }],
      [{}, 'apt', { apt: '12345678901' }],
      [{}, 'zip', { zip: '12345678901' }],
      [{}, 'notes', { notes: long(601) }],
      [{ consent: false }, 'consent'],
      [{ consent: 'true' }, 'consent'],
      [{ consent: undefined }, 'consent'],
      [{ customer: undefined }, 'first'],
      [{ payment: 'cash' }, 'first', { first: '' }, 'payment'],
      [{}, 'first', { first: 'x', email: 'bad' }],
    ];
    for (const [over, field, customer, expect = field] of cases) {
      const r = await post(body(over, customer));
      assert.equal(r.statusCode, 400, JSON.stringify(over) + JSON.stringify(customer || {}));
      assert.deepEqual(r.json, { ok: false, error: 'invalid', field: expect }, JSON.stringify(over) + JSON.stringify(customer || {}));
    }
    assert.equal(mails.length, 0);
  });

  it('multi-line notes up to 600 characters are kept', async () => {
    const notes = 'קומה 3\r\nלהתקשר לפני\n\n\n\nתודה';
    const r = await post(body({}, { notes }));
    assert.equal(r.statusCode, 200);
    assert.match(mails[0].payload.html, /קומה 3<br>להתקשר לפני<br><br>תודה/);
    assert.match(mails[0].payload.text, /קומה 3\nלהתקשר לפני\n\nתודה/);
    assert.equal((await post(body({}, { notes: 'א'.repeat(600) }))).statusCode, 200);
  });

  it('a courier needs an address, a pickup does not', async () => {
    const pickup = store.shipping.find(m => m.id === 'pickup');
    let r = await post(body({ shipping: 'courier' }, { city: '', street: '', house: '' }));
    assert.deepEqual(r.json, { ok: false, error: 'invalid', field: 'city' });
    const b = body({ shipping: 'pickup' }, { city: '', street: '', house: '', apt: 'x'.repeat(50), zip: 'leftover' });
    r = await post(b);
    assert.equal(r.statusCode, 200);
    const q = priced(b.items, { shipping: 'pickup' });
    assert.equal(q.shipping, 0);
    assert.deepEqual(r.json, { ok: true, number: b.id, total: q.total });
    const { html, text } = mails[0].payload;
    assert.ok(html.includes(pickup.label));
    assert.ok(!html.includes('כתובת') && !text.includes('כתובת'), 'no address block for a pickup');
    assert.ok(!text.includes('leftover'), 'hidden address fields are left out');
    // and a courier order shows the address
    r = await post(body());
    assert.match(mails[1].payload.text, /כתובת: הרצל 12, דירה 3, תל אביב, מיקוד 6100000/);
  });

  it('prices come from the catalog, never from the request', async () => {
    const picks = products.slice(0, 3);
    const lines = picks.map(p => lineOf(p, 2));
    const tampered = lines.map(l => ({ ...l, price: 0.01, unit: 0.01, total: 0.01 }));
    tampered.push({ ...lineOf(products[0], 999), price: 0 });
    const b = body({ items: tampered, total: 1, subtotal: 1, discount: 999, shippingPrice: 0 });
    const r = await post(b);
    assert.equal(r.statusCode, 200);
    const expected = priced(lines.concat([lineOf(products[0], 999)]), { shipping: 'courier' });
    assert.ok(expected.total > 1);
    assert.deepEqual(r.json, { ok: true, number: b.id, total: expected.total });
    assert.equal(order.quote(catalog, b.items, { shipping: 'courier' }).total, expected.total, 'extra fields change nothing');
    const { subject, html, text } = mails[0].payload;
    assert.equal(subject, 'הזמנה חדשה #' + b.id + ' · דנה כהן · ' + ils(expected.total));
    for (const i of expected.items) assert.ok(html.includes(ils(i.unit)) && html.includes(ils(i.total)), 'line ' + i.key);
    assert.ok(text.includes('סה״כ לתשלום: ' + ils(expected.total)));
    assert.ok(!html.includes('₪0.01'));
    // 999 is always over the cap, unless the stock was already used up by the first line for that product
    if (expected.items.some(i => i.capped)) assert.match(text, /הוגבלה ל־\d+ לפי המלאי/, 'a capped line is pointed out to the owner');
    if (expected.dropped.length) assert.match(text, /שורות שהוסרו/, 'a dropped line is pointed out to the owner');
  });

  it('escapes what the customer typed in the HTML', async () => {
    const b = body({}, { first: '<b>דנה</b>', street: '"><img src=x onerror=alert(1)>', notes: '<script>alert(1)</script>\nשורה 2' });
    const r = await post(b);
    assert.equal(r.statusCode, 200);
    const { html, text } = mails[0].payload;
    assert.ok(!/<script|<img|<b>דנה/i.test(html));
    assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;<br>שורה 2'));
    assert.ok(html.includes('&quot;&gt;&lt;img src=x onerror=alert(1)&gt;'));
    assert.ok(text.includes('<script>alert(1)</script>'), 'the plain-text part stays as typed');
  });

  it('strips control and bidi-override characters', async () => {
    const r = await post(body({}, { first: 'דנה‮\u0007', last: 'כ⁦הן' }));
    assert.equal(r.statusCode, 200);
    const { subject, html } = mails[0].payload;
    assert.ok(!/[\u0000-\u001F‪-‮⁦-⁩]/.test(subject + html.replace(/\n/g, '')));
  });

  it('sends one Resend request with the Idempotency-Key, recipients and reply_to', async () => {
    process.env.ORDER_TO = 'a@shop.test, b@shop.test,c@shop.test,,d@shop.test,e@shop.test,f@shop.test';
    const b = body({ payment: 'bit' }, { email: 'Dana.K+shop@Example.co.il' });
    const r = await post(b);
    assert.equal(r.statusCode, 200);
    assert.equal(mails.length, 1);
    const m = mails[0];
    assert.equal(m.url, 'https://api.resend.com/emails');
    assert.equal(m.method, 'POST');
    assert.equal(m.headers.Authorization, 'Bearer re_test_key');
    assert.equal(m.headers['Idempotency-Key'], 'shop-order-' + b.id);
    assert.ok(m.signal, 'the call can time out');
    assert.deepEqual(m.payload.to, ['a@shop.test', 'b@shop.test', 'c@shop.test', 'd@shop.test', 'e@shop.test']);
    assert.equal(m.payload.reply_to, 'Dana.K+shop@Example.co.il');
    assert.equal(m.payload.from, store.name + ' <onboarding@resend.dev>');
    assert.match(m.payload.html, /^<div dir="rtl" lang="he"/);
    assert.ok(m.payload.html.includes('href="tel:+972501234567"') && m.payload.html.includes('href="https://wa.me/972501234567"'));
    assert.ok(m.payload.html.includes('href="mailto:Dana.K+shop@Example.co.il"'));
    assert.ok(m.payload.html.includes(store.payments.find(x => x.id === 'bit').label));
    assert.ok(m.payload.text.length > 50);
    assert.equal(r.json.number, b.id);
  });

  it('a retry of the same order sends the same payload under the same key', async () => {
    const b = body();
    await post(b);
    await post(structuredClone(b));
    assert.equal(mails.length, 2);
    assert.equal(mails[0].headers['Idempotency-Key'], mails[1].headers['Idempotency-Key']);
    assert.deepEqual(mails[0].payload, mails[1].payload);
  });

  it('sender and inbox fallbacks', async () => {
    process.env.CONTACT_FROM = 'Studio <studio@shop.test>';
    await post(body());
    assert.equal(mails[0].payload.from, 'Studio <studio@shop.test>');
    process.env.ORDER_FROM = 'Orders <orders@shop.test>';
    delete process.env.ORDER_TO;
    process.env.CONTACT_TO = 'studio@shop.test';
    await post(body());
    assert.equal(mails[1].payload.from, 'Orders <orders@shop.test>');
    assert.deepEqual(mails[1].payload.to, ['studio@shop.test']);
  });

  it('an unknown coupon is ignored and pointed out in the email', async () => {
    const b = body({ coupon: 'NOPE-123' });
    const r = await post(b);
    assert.equal(r.statusCode, 200);
    assert.equal(r.json.total, priced(b.items, { shipping: 'courier' }).total);
    assert.ok(mails[0].payload.html.includes('קוד קופון לא תקף: NOPE-123'));
    assert.ok(mails[0].payload.text.includes('קוד קופון לא תקף: NOPE-123'));
  });

  it('a catalog coupon is applied like the cart applies it', async () => {
    for (const cp of store.coupons || []) {
      // enough of the product to pass the coupon's minimum, if the stock allows
      const p = products[0], unit = p.price, need = Math.max(1, Math.ceil((cp.min || 0) / unit));
      const items = [lineOf(p, Math.min(need, maxQty(p)))];
      const b = body({ items, coupon: ' ' + String(cp.code).toLowerCase() });
      const r = await post(b);
      const q = priced(items, { shipping: 'courier', coupon: b.coupon });
      assert.equal(r.json.total, q.total, cp.code);
      const { html } = mails[mails.length - 1].payload;
      if (q.coupon) assert.ok(html.includes('הנחה (' + cp.code + ')') && html.includes('−' + ils(q.discount)), cp.code);
      else assert.ok(html.includes('קוד קופון לא תקף'), cp.code);
    }
  });

  it('a coupon under its minimum is noted with the minimum', () => {
    const cat = {
      store: { ...store, coupons: [{ code: 'BIG', type: 'fixed', value: 50, min: 1000, label: '' }] },
      products: [{ id: 'x1', name: 'מוצר', price: 100 }],
    };
    const { order: o } = order._check(body({ items: [{ id: 'x1', qty: 1 }], coupon: 'big' }), cat);
    assert.equal(o.q.discount, 0);
    assert.equal(o.q.couponError, 'min');
    const mail = order._compose(o, cat.store);
    assert.ok(mail.text.includes('קוד קופון לא תקף: big (מינימום הזמנה ₪1,000)'));
  });

  it('shows the marketing opt-in either way', async () => {
    await post(body({ news: true }));
    await post(body({ news: 'yes' }));
    assert.ok(mails[0].payload.html.includes('כן, אישר/ה קבלת דיוור'));
    assert.ok(mails[0].payload.text.includes('דיוור שיווקי: כן'));
    assert.ok(mails[1].payload.text.includes('דיוור שיווקי: לא'), 'only true counts');
  });

  it('502 when the provider fails, and the logs hold no customer details', async () => {
    mails.restore();
    mails = stubFetch(() => ({ status: 500, body: { name: 'internal_server_error', message: 'could not send to dana@example.com' } }));
    let r = await post(body());
    assert.equal(r.statusCode, 502);
    assert.deepEqual(r.json, { ok: false, error: 'send_failed' });
    mails.restore();
    mails = stubFetch(() => Object.assign(new Error('aborted'), { name: 'AbortError' }));
    r = await post(body());
    assert.equal(r.statusCode, 502);
    assert.equal(errors.length, 2);
    const logged = errors.join('\n');
    assert.match(logged, /500/);
    assert.match(logged, /AbortError/);
    for (const s of ['dana@example.com', '050-1234567', '972501234567', 'דנה', 'כהן', 'הרצל', 'תל אביב']) assert.ok(!logged.includes(s), 'log has ' + s);
  });

  it('mails the customer only with ORDER_CUSTOMER_COPY=1', async () => {
    await post(body());
    assert.equal(mails.length, 1);
    process.env.ORDER_CUSTOMER_COPY = 'true';
    await post(body());
    assert.equal(mails.length, 2, 'only the exact value 1 turns it on');

    process.env.ORDER_CUSTOMER_COPY = '1';
    const b = body();
    const r = await post(b);
    assert.equal(r.statusCode, 200);
    assert.equal(mails.length, 4);
    const [owner, copy] = mails.slice(2);
    assert.deepEqual(owner.payload.to, ['owner@shop.test']);
    assert.deepEqual(copy.payload.to, ['dana@example.com']);
    assert.equal(copy.headers['Idempotency-Key'], 'shop-order-' + b.id + '-c');
    assert.notEqual(copy.payload.reply_to, 'dana@example.com');
    assert.match(copy.payload.html, /^<div dir="rtl" lang="he"/);
    assert.ok(copy.payload.html.includes('קיבלנו את ההזמנה #' + b.id + ', נחזור אליכם לאישור ולתשלום'));
    assert.ok(copy.payload.text.includes(ils(r.json.total)));
    assert.ok(copy.payload.subject.includes('#' + b.id));

    process.env.ORDER_REPLY_TO = 'orders@shop.test';
    await post(body());
    assert.equal(mails[5].payload.reply_to, 'orders@shop.test');
  });

  it('a failed customer copy does not fail the order; a failed owner email sends no copy', async () => {
    process.env.ORDER_CUSTOMER_COPY = '1';
    mails.restore();
    mails = stubFetch((c, n) => n === 2 ? { status: 422, body: { name: 'validation_error', message: 'dana@example.com is not allowed' } } : { status: 200 });
    const b = body();
    let r = await post(b);
    assert.equal(r.statusCode, 200);
    assert.deepEqual(r.json, { ok: true, number: b.id, total: r.json.total });
    assert.equal(mails.length, 2);
    assert.equal(errors.length, 1);
    assert.ok(!errors[0].includes('dana@example.com'));

    mails.restore();
    mails = stubFetch(() => ({ status: 500 }));
    r = await post(body());
    assert.equal(r.statusCode, 502);
    assert.equal(mails.length, 1);
  });

  it('limits one address to five orders in ten minutes', async () => {
    const headers = { 'x-real-ip': '203.0.113.9' };
    for (let i = 0; i < 5; i++) assert.equal((await post(body(), { headers })).statusCode, 200);
    const r = await post(body(), { headers });
    assert.equal(r.statusCode, 429);
    assert.deepEqual(r.json, { ok: false, error: 'rate' });
    assert.equal(mails.length, 5);
    assert.equal((await post(body(), { headers: { 'x-real-ip': '203.0.113.10' } })).statusCode, 200, 'others are not affected');
    order._reset();
    assert.equal((await post(body(), { headers })).statusCode, 200);
  });
});
