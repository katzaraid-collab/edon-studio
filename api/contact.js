/* EDON contact: takes the homepage form and emails it to the studio through Resend.
   Needs RESEND_API_KEY and CONTACT_TO (CONTACT_FROM is optional). Until both are set, GET answers
   {ready:false} and the page keeps composing an Instagram message instead, so no inquiry is lost.
   Nothing the visitor typed is logged or stored here. */
'use strict';

const SERVICES = ['אפליקציית תורים', 'דף עסק', 'מיתוג ואינסטגרם', 'הכל ביחד'];
const MAX = { name: 80, biz: 120, phone: 24, note: 1500 };
const WINDOW = 10 * 60 * 1000, PER_WINDOW = 5;
const hits = new Map();

const env = k => String(process.env[k] || '').trim();
const ready = () => !!(env('RESEND_API_KEY') && env('CONTACT_TO'));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// control and bidi-override characters have no place in a name or a phone number
const clean = v => typeof v === 'string' ? v.replace(/[\u0000-\u001F\u007F‪-‮⁦-⁩]/g, ' ').replace(/\s+/g, ' ').trim() : '';
const cleanNote = v => typeof v === 'string' ? v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000B-\u001F\u007F‪-‮⁦-⁩]/g, ' ').replace(/\n{3,}/g, '\n\n').trim() : '';

function reply(res, code, body, cache) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cache || 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  let b;
  try { b = req.body; } catch (e) { return null; } // the platform's parser throws on broken JSON
  if (b && typeof b === 'object' && !Buffer.isBuffer(b)) return b;
  let raw = typeof b === 'string' ? b : Buffer.isBuffer(b) ? b.toString('utf8') : null;
  if (raw === null) {
    raw = await new Promise((resolve, reject) => {
      const parts = []; let size = 0;
      req.on('data', c => { size += c.length; if (size > 16384) { reject(new Error('too large')); req.destroy(); } else parts.push(c); });
      req.on('end', () => resolve(Buffer.concat(parts).toString('utf8')));
      req.on('error', reject);
    }).catch(() => null);
  }
  if (raw === null || raw.length > 16384) return null;
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

function check(b) {
  const lead = { name: clean(b.name), biz: clean(b.biz), phone: clean(b.phone), svc: clean(b.svc), note: cleanNote(b.note) };
  if (lead.name.length < 2 || lead.name.length > MAX.name) return { field: 'name' };
  if (lead.biz.length < 2 || lead.biz.length > MAX.biz) return { field: 'biz' };
  const digits = lead.phone.replace(/\D/g, '').length;
  if (!/^\+?[0-9()\-. ]+$/.test(lead.phone) || lead.phone.length > MAX.phone || digits < 9 || digits > 15) return { field: 'phone' };
  if (!SERVICES.includes(lead.svc)) return { field: 'svc' };
  if (lead.note.length > MAX.note) return { field: 'note' };
  if (b.consent !== true) return { field: 'consent' };
  return { lead };
}

function compose({ name, biz, phone, svc, note }) {
  const num = intl(phone);
  const rows = [
    ['שם', esc(name)],
    ['העסק ותחום', esc(biz)],
    ['טלפון', '<a href="tel:+' + num + '" dir="ltr">' + esc(phone) + '</a> · <a href="https://wa.me/' + num + '">וואטסאפ</a>'],
    ['מה מעניין אותם', esc(svc)],
  ];
  if (note) rows.push(['עוד פרטים', esc(note).replace(/\n/g, '<br>')]);
  const footer = 'נשלח מהטופס באתר EDON. הפונה אישר/ה שימוש בפרטים כדי לחזור אליו/ה ולהכין הצעת מחיר, לפי מדיניות הפרטיות (גרסת 19.10.2026). פנייה שלא הבשילה לעבודה נמחקת אחרי 12 חודשים.';
  const html = '<div dir="rtl" lang="he" style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#111">'
    + '<p style="margin:0 0 14px;font-size:18px"><b>פנייה חדשה מהאתר</b></p>'
    + '<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse">'
    + rows.map(([k, v]) => '<tr><td style="padding:6px 0 6px 20px;color:#666;vertical-align:top;white-space:nowrap">' + k + '</td><td style="padding:6px 0;vertical-align:top">' + v + '</td></tr>').join('')
    + '</table><p style="margin:20px 0 0;font-size:13px;color:#666">' + footer + '</p></div>';
  const text = 'פנייה חדשה מהאתר\n\nשם: ' + name + '\nהעסק ותחום: ' + biz + '\nטלפון: ' + phone + '\nוואטסאפ: https://wa.me/' + num
    + '\nמה מעניין אותם: ' + svc + (note ? '\nעוד פרטים:\n' + note : '') + '\n\n' + footer;
  const subject = ('פנייה חדשה: ' + name + ' · ' + biz).slice(0, 150);
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
  const { lead, field } = check(body);
  if (!lead) return reply(res, 400, { ok: false, error: 'invalid', field });
  if (limited(req)) return reply(res, 429, { ok: false, error: 'rate' });

  const mail = compose(lead);
  const to = env('CONTACT_TO').split(',').map(s => s.trim()).filter(Boolean).slice(0, 5);
  const headers = { Authorization: 'Bearer ' + env('RESEND_API_KEY'), 'Content-Type': 'application/json' };
  // the page reuses its id when the same details are sent again, so a retry after a lost answer is not a second email
  if (typeof body.id === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(body.id)) headers['Idempotency-Key'] = 'edon-' + body.id;
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers, signal: ctl.signal,
      body: JSON.stringify({ from: env('CONTACT_FROM') || 'EDON Website <onboarding@resend.dev>', to, subject: mail.subject, html: mail.html, text: mail.text }),
    });
    if (r.ok) return reply(res, 200, { ok: true });
    // the provider's reason helps with setup (a wrong key, an unverified address); it never carries the visitor's details
    const why = await r.json().catch(() => ({}));
    console.error('contact: mail provider refused', r.status, String(why.name || ''), String(why.message || '').slice(0, 300));
  } catch (e) {
    console.error('contact: mail provider unreachable', e && e.name);
  } finally {
    clearTimeout(timer);
  }
  return reply(res, 502, { ok: false, error: 'send_failed' });
};
