/* Shop orders: takes the /shop checkout and emails the order to the owner through Resend.
   Needs RESEND_API_KEY and ORDER_TO (or CONTACT_TO); ORDER_FROM / CONTACT_FROM are optional. With
   ORDER_CUSTOMER_COPY=1 the customer also gets a short confirmation (that needs a verified sending domain).
   Until the key and an inbox are set, GET answers {ready:false} so the page can offer another way to order.
   Prices never come from the browser: the order is priced here from catalog.json with the same math as
   shop/assets/js/pricing.js, and shop/tests/pricing.test.mjs checks that the two agree.
   Nothing the customer typed is logged or stored here. */
'use strict';

const CATALOG = require('../shop/assets/catalog.json');

const MAX_LINES = 30, MAX_BODY = 32768;
const MAX = { name: 40, phone: 24, email: 120, place: 60, house: 10, short: 10, notes: 600, coupon: 40 };
const WINDOW = 10 * 60 * 1000, PER_WINDOW = 5;
const hits = new Map();

const env = k => String(process.env[k] || '').trim();
const inbox = () => env('ORDER_TO') || env('CONTACT_TO');
const ready = () => !!(env('RESEND_API_KEY') && inbox());
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// control and bidi-override characters have no place in a name, an address or a phone number
const clean = v => typeof v === 'string' ? v.replace(/[\u0000-\u001F\u007F\u202a-\u202e\u2066-\u2069]/g, ' ').replace(/\s+/g, ' ').trim() : '';
const cleanNote = v => typeof v === 'string' ? v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000B-\u001F\u007F\u202a-\u202e\u2066-\u2069]/g, ' ').replace(/\n{3,}/g, '\n\n').trim() : '';
const ID = /^[A-Za-z0-9_-]{8,64}$/;
const EMAIL = /^[A-Za-z0-9._+'-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
// the provider sometimes quotes an address back in its error; the logs keep none
const redact = s => String(s || '').replace(/[^\s@'"`<>]+@[^\s@'"`<>]+/g, '[address]');

/* ---------- price math: a line-for-line mirror of shop/assets/js/pricing.js. Change both together. ---------- */

const MAX_QTY = 20;
const round = n => Math.round((Number(n) || 0) * 100) / 100;
const lineKey = (id, opt) => opt ? id + '|' + opt : id;

function findCoupon(store, code) {
  const c = String(code || '').trim().toUpperCase();
  if (!c) return null;
  return (store.coupons || []).find(k => String(k.code).toUpperCase() === c) || null;
}

function maxQty(p) {
  if (!p) return 0;
  if (typeof p.stock === 'number') return Math.max(0, Math.min(MAX_QTY, Math.floor(p.stock) || 0));
  return MAX_QTY;
}

function quote(catalog, lines, { shipping, coupon } = {}) {
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
  // free shipping is judged on the goods before any coupon, so a coupon never costs the shipper's fee back
  const free = freeFrom > 0 && subtotal >= freeFrom;
  const shippingCost = count === 0 ? 0 : (free ? 0 : round(method.price || 0));

  return {
    items, dropped, count, subtotal,
    discount, coupon: applied, couponError,
    method, shipping: shippingCost,
    freeShippingFrom: freeFrom,
    freeShippingLeft: freeFrom > 0 ? Math.max(0, round(freeFrom - subtotal)) : 0,
    total: round(afterDiscount + shippingCost),
  };
}

/* ---------- request plumbing, as in api/contact.js ---------- */

function reply(res, code, body, cache) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cache || 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (Number(req.headers['content-length']) > MAX_BODY) return null;
  let b;
  try { b = req.body; } catch (e) { return null; } // the platform's parser throws on broken JSON
  if (b && typeof b === 'object' && !Buffer.isBuffer(b)) return b;
  let raw = typeof b === 'string' ? b : Buffer.isBuffer(b) ? b.toString('utf8') : null;
  if (raw === null) {
    raw = await new Promise((resolve, reject) => {
      const parts = []; let size = 0;
      req.on('data', c => { size += c.length; if (size > MAX_BODY) { reject(new Error('too large')); req.destroy(); } else parts.push(c); });
      req.on('end', () => resolve(Buffer.concat(parts).toString('utf8')));
      req.on('error', reject);
    }).catch(() => null);
  }
  if (raw === null || raw.length > MAX_BODY) return null;
  try { const j = JSON.parse(raw || '{}'); return j && typeof j === 'object' ? j : null; } catch (e) { return null; }
}

// a browser posting from another site carries its own Origin; refuse it
function sameOrigin(req) {
  const o = req.headers.origin;
  if (!o) return true;
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim().toLowerCase();
  try { return new URL(o).host.toLowerCase() === host; } catch (e) { return false; }
}

// best effort: counts per warm instance, enough to stop one visitor flooding the inbox
function limited(req) {
  const ip = String(req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || '').split(',')[0].trim();
  const now = Date.now(), seen = (hits.get(ip) || []).filter(t => now - t < WINDOW);
  if (seen.length >= PER_WINDOW) { hits.set(ip, seen); return true; }
  seen.push(now); hits.set(ip, seen);
  if (hits.size > 500) for (const [k, v] of hits) if (!v.some(t => now - t < WINDOW)) hits.delete(k);
  return false;
}

// Israeli numbers become international for the WhatsApp and call links in the email
function intl(phone) {
  let d = phone.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = '972' + d.slice(1);
  return d;
}

/* ---------- the order ---------- */

const len = (s, lo, hi) => s.length >= lo && s.length <= hi;

// fields are checked in the order the checkout shows them, so `field` names the first one to fix
function check(b, catalog = CATALOG) {
  const store = catalog.store;
  if (typeof b.id !== 'string' || !ID.test(b.id)) return { field: 'id' };
  const lines = b.items;
  if (!Array.isArray(lines) || lines.length < 1 || lines.length > MAX_LINES
    || !lines.every(l => l && typeof l === 'object' && !Array.isArray(l))) return { field: 'items' };
  // only the id, the option and the quantity are read from each line; any price sent along is ignored
  const code = clean(b.coupon);
  const q = quote(catalog, lines.map(l => ({ id: l.id, qty: l.qty, opt: l.opt })), { shipping: b.shipping, coupon: code.slice(0, MAX.coupon) });
  if (!q.items.length) return { field: 'items' };
  const ship = (store.shipping || []).find(m => m.id === b.shipping);
  if (!ship) return { field: 'shipping' };
  const pay = (store.payments || []).find(m => m.id === b.payment);
  if (!pay) return { field: 'payment' };

  const c = b.customer && typeof b.customer === 'object' ? b.customer : {};
  const cu = { first: clean(c.first), last: clean(c.last), phone: clean(c.phone), email: clean(c.email), city: '', street: '', house: '', apt: '', zip: '', notes: cleanNote(c.notes) };
  if (!len(cu.first, 2, MAX.name)) return { field: 'first' };
  if (!len(cu.last, 2, MAX.name)) return { field: 'last' };
  const digits = cu.phone.replace(/\D/g, '').length;
  if (!/^\+?[0-9()\-. ]+$/.test(cu.phone) || cu.phone.length > MAX.phone || digits < 9 || digits > 15) return { field: 'phone' };
  if (!len(cu.email, 3, MAX.email) || !EMAIL.test(cu.email)) return { field: 'email' };
  // a pickup needs no address, and whatever a hidden address field still holds is left out
  const address = ship.id === 'courier';
  if (address) {
    Object.assign(cu, { city: clean(c.city), street: clean(c.street), house: clean(c.house), apt: clean(c.apt), zip: clean(c.zip) });
    if (!len(cu.city, 2, MAX.place)) return { field: 'city' };
    if (!len(cu.street, 2, MAX.place)) return { field: 'street' };
    if (!len(cu.house, 1, MAX.house)) return { field: 'house' };
    if (cu.apt.length > MAX.short) return { field: 'apt' };
    if (cu.zip.length > MAX.short) return { field: 'zip' };
  }
  if (cu.notes.length > MAX.notes) return { field: 'notes' };
  if (b.consent !== true) return { field: 'consent' };
  return { order: { id: b.id, q, ship, pay, address, coupon: code.slice(0, MAX.coupon), customer: cu, news: b.news === true } };
}

const money = n => {
  const v = round(n), s = Number.isInteger(v) ? String(v) : v.toFixed(2);
  return '₪' + s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};
const optLabel = i => i.opt ? (i.product.options && i.product.options.name ? i.product.options.name + ': ' : '') + i.opt : '';
const addressLine = c => [c.street + ' ' + c.house, c.apt ? 'דירה ' + c.apt : '', c.city, c.zip ? 'מיקוד ' + c.zip : ''].filter(Boolean).join(', ');

// what the owner should know about lines the server had to change from what the browser sent
function adjustments(o, store) {
  const out = [];
  if (o.coupon && !o.q.coupon) {
    const cp = o.q.couponError === 'min' ? findCoupon(store, o.coupon) : null;
    out.push('קוד קופון לא תקף: ' + o.coupon + (cp ? ' (מינימום הזמנה ' + money(cp.min) + ')' : ''));
  }
  if (o.q.dropped.length) out.push('שורות שהוסרו כי המוצר לא קיים, אזל או בלי אפשרות תקפה: ' + o.q.dropped.length);
  for (const i of o.q.items) if (i.capped) out.push('הכמות של "' + i.product.name + (i.opt ? ' · ' + i.opt : '') + '" הוגבלה ל־' + i.qty + ' לפי המלאי');
  return out;
}

const TD = 'padding:6px 0 6px 20px;color:#666;vertical-align:top;white-space:nowrap';
const CELL = 'padding:8px 6px;border-bottom:1px solid #e5e5e5;vertical-align:top';
const kv = rows => '<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse">'
  + rows.map(([k, v]) => '<tr><td style="' + TD + '">' + k + '</td><td style="padding:6px 0;vertical-align:top">' + v + '</td></tr>').join('') + '</table>';

function itemsTable(q) {
  const head = ['מוצר', 'אפשרות', 'כמות', 'מחיר', 'סה״כ'].map(h => '<th style="' + CELL + ';text-align:right;color:#666;font-weight:normal">' + h + '</th>').join('');
  const body = q.items.map(i => '<tr><td style="' + CELL + '">' + esc(i.product.name) + ' <span style="color:#999;font-size:12px" dir="ltr">' + esc(i.id) + '</span></td>'
    + '<td style="' + CELL + '">' + esc(optLabel(i)) + '</td><td style="' + CELL + '">' + i.qty + '</td>'
    + '<td style="' + CELL + ';white-space:nowrap">' + money(i.unit) + '</td><td style="' + CELL + ';white-space:nowrap">' + money(i.total) + '</td></tr>').join('');
  return '<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:640px;font-size:15px"><tr>' + head + '</tr>' + body + '</table>';
}

function totalsRows(o) {
  const q = o.q, rows = [['סכום ביניים', money(q.subtotal)]];
  if (q.discount) rows.push(['הנחה' + (q.coupon ? ' (' + esc(q.coupon.code) + ')' : ''), '−' + money(q.discount)]);
  rows.push(['משלוח', q.shipping ? money(q.shipping) : 'חינם']);
  rows.push(['<b>סה״כ לתשלום</b>', '<b>' + money(q.total) + '</b>']);
  return rows;
}

const shell = (title, inner) => '<div dir="rtl" lang="he" style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#111">'
  + '<p style="margin:0 0 14px;font-size:18px"><b>' + title + '</b></p>' + inner + '</div>';
const section = t => '<p style="margin:22px 0 6px;font-size:15px;color:#666">' + t + '</p>';

// No timestamps or random parts: a retry with the same order id must send the very same payload,
// or the provider rejects the reused Idempotency-Key instead of answering with the first send.
function compose(o, store = CATALOG.store) {
  const { id, q, ship, pay, customer: c } = o;
  const num = intl(c.phone), name = c.first + ' ' + c.last, notes = adjustments(o, store);
  const shipText = ship.label + (q.shipping ? ' · ' + money(q.shipping) : ' · חינם');
  const who = [
    ['שם', esc(name)],
    ['טלפון', '<a href="tel:+' + num + '" dir="ltr">' + esc(c.phone) + '</a> · <a href="https://wa.me/' + num + '">וואטסאפ</a>'],
    ['אימייל', '<a href="mailto:' + esc(c.email) + '" dir="ltr">' + esc(c.email) + '</a>'],
    ['משלוח', esc(shipText)],
  ];
  if (o.address) who.push(['כתובת', esc(addressLine(c))]);
  who.push(['תשלום', esc(pay.label)]);
  if (c.notes) who.push(['הערות', esc(c.notes).replace(/\n/g, '<br>')]);
  who.push(['דיוור שיווקי', o.news ? 'כן, אישר/ה קבלת דיוור' : 'לא']);
  const footer = 'נשלח מטופס ההזמנה בחנות ' + store.name + '. המחירים חושבו בשרת לפי הקטלוג וכוללים מע״מ. הלקוח/ה אישר/ה את התקנון ואת מדיניות הפרטיות. התשלום עוד לא נגבה: צריך לחזור ללקוח/ה לאישור ההזמנה ולתשלום.';

  const html = shell('הזמנה חדשה #' + esc(id), kv(who)
    + section('פריטים (' + q.count + ')') + itemsTable(q)
    + '<div style="margin-top:10px">' + kv(totalsRows(o)) + '</div>'
    + (notes.length ? '<div style="margin:18px 0 0;padding:10px 12px;background:#fff6e0;border-radius:6px;font-size:14px">' + notes.map(esc).join('<br>') + '</div>' : '')
    + '<p style="margin:20px 0 0;font-size:13px;color:#666">' + esc(footer) + '</p>');

  const text = ['הזמנה חדשה #' + id, '',
    'שם: ' + name, 'טלפון: ' + c.phone, 'וואטסאפ: https://wa.me/' + num, 'אימייל: ' + c.email,
    'משלוח: ' + shipText]
    .concat(o.address ? ['כתובת: ' + addressLine(c)] : [])
    .concat(['תשלום: ' + pay.label])
    .concat(c.notes ? ['הערות:', c.notes] : [])
    .concat(['דיוור שיווקי: ' + (o.news ? 'כן' : 'לא'), '', 'פריטים (' + q.count + '):'])
    .concat(q.items.map(i => '• ' + i.product.name + (i.opt ? ' · ' + optLabel(i) : '') + ' · ' + i.qty + ' × ' + money(i.unit) + ' = ' + money(i.total)))
    .concat(['', 'סכום ביניים: ' + money(q.subtotal)])
    .concat(q.discount ? ['הנחה' + (q.coupon ? ' (' + q.coupon.code + ')' : '') + ': −' + money(q.discount)] : [])
    .concat(['משלוח: ' + (q.shipping ? money(q.shipping) : 'חינם'), 'סה״כ לתשלום: ' + money(q.total)])
    .concat(notes.length ? [''].concat(notes) : [])
    .concat(['', footer]).join('\n');

  const subject = ('הזמנה חדשה #' + id + ' · ' + name + ' · ' + money(q.total)).slice(0, 150);
  return { subject, html, text };
}

// the short note the customer gets when ORDER_CUSTOMER_COPY=1
function composeCustomer(o, store = CATALOG.store) {
  const { id, q, ship, pay, customer: c } = o;
  const lead = 'קיבלנו את ההזמנה #' + id + ', נחזור אליכם לאישור ולתשלום.';
  const phone = store.contact && store.contact.phone ? String(store.contact.phone) : '';
  const rows = q.items.map(i => [esc(i.product.name + (i.opt ? ' · ' + i.opt : '')) + ' × ' + i.qty, money(i.total)])
    .concat(totalsRows(o)).concat([['אופן המשלוח', esc(ship.label)], ['אופן התשלום', esc(pay.label)]]);
  const tail = 'זה אישור קבלה בלבד, עוד לא חייבנו אתכם.' + (phone ? ' שאלות? ' + phone : '');
  const html = shell('תודה, ' + esc(c.first), '<p style="margin:0 0 16px">' + esc(lead) + '</p>' + kv(rows)
    + '<p style="margin:20px 0 0;font-size:13px;color:#666">' + esc(tail) + ' · ' + esc(store.name) + '</p>');
  const text = ['תודה, ' + c.first, '', lead, '']
    .concat(q.items.map(i => '• ' + i.product.name + (i.opt ? ' · ' + i.opt : '') + ' × ' + i.qty + ' = ' + money(i.total)))
    .concat(['', 'סכום ביניים: ' + money(q.subtotal)])
    .concat(q.discount ? ['הנחה' + (q.coupon ? ' (' + q.coupon.code + ')' : '') + ': −' + money(q.discount)] : [])
    .concat(['משלוח: ' + ship.label + ' · ' + (q.shipping ? money(q.shipping) : 'חינם'), 'סה״כ לתשלום: ' + money(q.total), 'תשלום: ' + pay.label, '', tail, store.name])
    .join('\n');
  const subject = ('קיבלנו את ההזמנה #' + id + ' · ' + store.name).slice(0, 150);
  return { subject, html, text };
}

async function send(mail, key, ms) {
  const headers = { Authorization: 'Bearer ' + env('RESEND_API_KEY'), 'Content-Type': 'application/json', 'Idempotency-Key': key };
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers, signal: ctl.signal, body: JSON.stringify(mail) });
    if (r.ok) return { ok: true };
    // the provider's reason helps with setup (a wrong key, an unverified address); addresses are cut out of it
    const why = await r.json().catch(() => ({}));
    return { ok: false, why: [r.status, String(why.name || ''), redact(why.message).slice(0, 300)] };
  } catch (e) {
    return { ok: false, why: ['unreachable', e && e.name] };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async (req, res) => {
  if (req.method === 'GET') return reply(res, 200, { ready: ready() }, 'public, max-age=0, s-maxage=300');
  if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return reply(res, 405, { ok: false, error: 'method' }); }
  if (!ready()) return reply(res, 503, { ok: false, error: 'not_configured' });
  if (!sameOrigin(req)) return reply(res, 403, { ok: false, error: 'origin' });
  if (!/application\/json/i.test(String(req.headers['content-type'] || ''))) return reply(res, 415, { ok: false, error: 'type' });
  const body = await readBody(req);
  if (!body) return reply(res, 400, { ok: false, error: 'invalid' });
  // the hidden field is left empty by people; a filled one gets a quiet success and no email
  if (typeof body.hp === 'string' && body.hp.trim()) {
    const q = quote(CATALOG, Array.isArray(body.items) ? body.items.slice(0, MAX_LINES) : [], { shipping: body.shipping });
    return reply(res, 200, { ok: true, number: typeof body.id === 'string' && ID.test(body.id) ? body.id : '', total: q.total });
  }
  const { order, field } = check(body);
  if (!order) return reply(res, 400, { ok: false, error: 'invalid', field });
  if (limited(req)) return reply(res, 429, { ok: false, error: 'rate' });

  const store = CATALOG.store;
  const from = env('ORDER_FROM') || env('CONTACT_FROM') || store.name + ' <onboarding@resend.dev>';
  const to = inbox().split(',').map(s => s.trim()).filter(Boolean).slice(0, 5);
  const mail = compose(order);
  // the page keeps its order id while the same order is sent again, so a retry after a lost answer is not a second email
  const sent = await send({ from, to, reply_to: order.customer.email, subject: mail.subject, html: mail.html, text: mail.text }, 'shop-order-' + order.id, 8000);
  if (!sent.ok) {
    console.error('order: mail not sent', ...sent.why);
    return reply(res, 502, { ok: false, error: 'send_failed' });
  }

  if (env('ORDER_CUSTOMER_COPY') === '1') {
    const copy = composeCustomer(order);
    const replyTo = env('ORDER_REPLY_TO') || (store.contact && EMAIL.test(String(store.contact.email || '')) && !/@example\.(com|org|net)$/i.test(store.contact.email) ? store.contact.email : '');
    const msg = { from, to: [order.customer.email], subject: copy.subject, html: copy.html, text: copy.text };
    if (replyTo) msg.reply_to = replyTo;
    // the owner already has the order, so a lost confirmation never fails it
    const c = await send(msg, 'shop-order-' + order.id + '-c', 4000);
    if (!c.ok) console.error('order: customer copy not sent', ...c.why);
  }
  return reply(res, 200, { ok: true, number: order.id, total: order.q.total });
};

module.exports.quote = quote;
module.exports._check = check;
module.exports._compose = compose;
module.exports._composeCustomer = composeCustomer;
module.exports._reset = () => hits.clear();
