/* Shop newsletter sign-up: emails the owner each new subscriber through Resend, so the list can be kept
   wherever the owner sends from. Same setup as api/order.js: RESEND_API_KEY and ORDER_TO (or CONTACT_TO);
   ORDER_FROM / CONTACT_FROM are optional. Until both are set, GET answers {ready:false} and the page
   can hide the form. Nothing the visitor typed is logged or stored here. */
'use strict';

const crypto = require('node:crypto');

let STORE = 'Shop';
try { STORE = String(require('../shop/assets/catalog.json').store.name || STORE); } catch (e) { /* the name is only cosmetic */ }

const MAX_BODY = 4096, MAX_EMAIL = 120;
const WINDOW = 10 * 60 * 1000, PER_WINDOW = 5;
const hits = new Map();

const env = k => String(process.env[k] || '').trim();
const inbox = () => env('ORDER_TO') || env('CONTACT_TO');
const ready = () => !!(env('RESEND_API_KEY') && inbox());
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clean = v => typeof v === 'string' ? v.replace(/[\u0000-\u001F\u007F\u202a-\u202e\u2066-\u2069]/g, ' ').replace(/\s+/g, ' ').trim() : '';
const EMAIL = /^[A-Za-z0-9._+'-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
const redact = s => String(s || '').replace(/[^\s@'"`<>]+@[^\s@'"`<>]+/g, '[address]');

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

function check(b) {
  const email = clean(b.email);
  if (email.length < 3 || email.length > MAX_EMAIL || !EMAIL.test(email)) return { field: 'email' };
  if (b.consent !== true) return { field: 'consent' };
  return { email };
}

// the calendar day in Israel, so "the same day" means what the owner would expect
function today(now = new Date()) {
  try { return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }); } catch (e) { return now.toISOString().slice(0, 10); }
}

// one key per address per day: a double submit is answered from the first send instead of mailing twice.
// It is a hash so the address itself never sits in the provider's request metadata.
const keyFor = (email, day) => 'shop-sub-' + crypto.createHash('sha256').update(email.toLowerCase() + '|' + day).digest('hex').slice(0, 40);

function compose(email) {
  const footer = 'נרשם/ה בטופס הניוזלטר בחנות ' + STORE + ' ואישר/ה קבלת דיוור שיווקי באימייל. אפשר להסיר מהרשימה בכל רגע, לפי בקשה או בקישור ההסרה שבכל דיוור.';
  const html = '<div dir="rtl" lang="he" style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#111">'
    + '<p style="margin:0 0 14px;font-size:18px"><b>מנוי/ה חדש/ה לניוזלטר</b></p>'
    + '<p style="margin:0"><a href="mailto:' + esc(email) + '" dir="ltr">' + esc(email) + '</a></p>'
    + '<p style="margin:20px 0 0;font-size:13px;color:#666">' + esc(footer) + '</p></div>';
  const text = 'מנוי/ה חדש/ה לניוזלטר\n\n' + email + '\n\n' + footer;
  const subject = ('מנוי/ה חדש/ה לניוזלטר: ' + email).slice(0, 150);
  return { subject, html, text };
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
  if (typeof body.hp === 'string' && body.hp.trim()) return reply(res, 200, { ok: true });
  const { email, field } = check(body);
  if (!email) return reply(res, 400, { ok: false, error: 'invalid', field });
  if (limited(req)) return reply(res, 429, { ok: false, error: 'rate' });

  const mail = compose(email);
  const to = inbox().split(',').map(s => s.trim()).filter(Boolean).slice(0, 5);
  const headers = { Authorization: 'Bearer ' + env('RESEND_API_KEY'), 'Content-Type': 'application/json', 'Idempotency-Key': keyFor(email, today()) };
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers, signal: ctl.signal,
      body: JSON.stringify({ from: env('ORDER_FROM') || env('CONTACT_FROM') || STORE + ' <onboarding@resend.dev>', to, reply_to: email, subject: mail.subject, html: mail.html, text: mail.text }),
    });
    if (r.ok) return reply(res, 200, { ok: true });
    // the provider's reason helps with setup (a wrong key, an unverified address); addresses are cut out of it
    const why = await r.json().catch(() => ({}));
    console.error('subscribe: mail provider refused', r.status, String(why.name || ''), redact(why.message).slice(0, 300));
  } catch (e) {
    console.error('subscribe: mail provider unreachable', e && e.name);
  } finally {
    clearTimeout(timer);
  }
  return reply(res, 502, { ok: false, error: 'send_failed' });
};

module.exports._check = check;
module.exports._keyFor = keyFor;
module.exports._today = today;
module.exports._reset = () => hits.clear();
