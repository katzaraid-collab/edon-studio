import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { load, fakeReq, fakeRes, stubFetch, captureErrors, envScope } from './helpers.mjs';

const sub = await load('../../api/subscribe.js');
const catalog = await load('../assets/catalog.json');

async function call(opts) { const res = fakeRes(); await sub(fakeReq(opts), res); return res; }
const post = (b, extra) => call({ body: b, ...extra });
const body = (over = {}) => ({ email: 'noa@example.com', consent: true, hp: '', ...over });

describe('api/subscribe.js', () => {
  let restoreEnv, mails, errors;
  beforeEach(() => {
    restoreEnv = envScope({ RESEND_API_KEY: 're_test_key', ORDER_TO: 'owner@shop.test' });
    mails = stubFetch();
    errors = captureErrors();
    sub._reset();
  });
  afterEach(() => { mails.restore(); errors.restore(); restoreEnv(); });

  it('GET says ready with the same settings as orders', async () => {
    assert.deepEqual((await call({ method: 'GET' })).json, { ready: true });
    delete process.env.ORDER_TO;
    assert.deepEqual((await call({ method: 'GET' })).json, { ready: false });
    process.env.CONTACT_TO = 'studio@shop.test';
    assert.deepEqual((await call({ method: 'GET' })).json, { ready: true });
  });

  it('the same guards as the order form', async () => {
    let r = await call({ method: 'DELETE' });
    assert.equal(r.statusCode, 405);
    assert.equal(r.headers.allow, 'GET, POST');
    r = await post(body(), { headers: { origin: 'https://evil.example' } });
    assert.equal(r.statusCode, 403);
    r = await post(JSON.stringify(body()), { headers: { 'content-type': 'application/x-www-form-urlencoded' } });
    assert.equal(r.statusCode, 415);
    r = await post('not json');
    assert.deepEqual(r.json, { ok: false, error: 'invalid' });
    r = await call({ raw: JSON.stringify(body({ pad: 'x'.repeat(5000) })) });
    assert.equal(r.statusCode, 400, 'over 4 KB');
    delete process.env.RESEND_API_KEY;
    assert.equal((await post(body())).statusCode, 503);
    assert.equal(mails.length, 0);
  });

  it('honeypot: quiet success, no email', async () => {
    const r = await post(body({ hp: 'x' }));
    assert.deepEqual(r.json, { ok: true });
    assert.equal(mails.length, 0);
  });

  it('needs a valid email and consent', async () => {
    for (const [over, field] of [[{ email: '' }, 'email'], [{ email: 'noa@' }, 'email'], [{ email: 'x'.repeat(120) + '@a.co' }, 'email'], [{ email: 'bad', consent: false }, 'email'], [{ consent: false }, 'consent'], [{ consent: 'on' }, 'consent']]) {
      const r = await post(body(over));
      assert.equal(r.statusCode, 400);
      assert.deepEqual(r.json, { ok: false, error: 'invalid', field });
    }
    assert.equal(mails.length, 0);
  });

  it('emails the owner the new subscriber', async () => {
    const r = await post(body({ email: '  Noa.L@Example.com ' }));
    assert.equal(r.statusCode, 200);
    assert.deepEqual(r.json, { ok: true });
    assert.equal(mails.length, 1);
    const m = mails[0];
    assert.equal(m.url, 'https://api.resend.com/emails');
    assert.equal(m.headers.Authorization, 'Bearer re_test_key');
    assert.equal(m.payload.subject, 'מנוי/ה חדש/ה לניוזלטר: Noa.L@Example.com');
    assert.deepEqual(m.payload.to, ['owner@shop.test']);
    assert.equal(m.payload.reply_to, 'Noa.L@Example.com');
    assert.equal(m.payload.from, catalog.store.name + ' <onboarding@resend.dev>');
    assert.match(m.payload.html, /^<div dir="rtl" lang="he"/);
    assert.ok(m.payload.html.includes('href="mailto:Noa.L@Example.com"'));
    assert.ok(m.payload.text.includes('Noa.L@Example.com'));
  });

  it("escapes the address in the HTML", async () => {
    await post(body({ email: "o'neil@example.com" }));
    assert.ok(mails[0].payload.html.includes('o&#39;neil@example.com'));
    assert.ok(!mails[0].payload.html.includes("o'neil"));
  });

  it('one Idempotency-Key per address per day, without the address in it', async () => {
    await post(body({ email: 'noa@example.com' }));
    await post(body({ email: ' NOA@example.com' }));
    const [a, b] = mails.map(m => m.headers['Idempotency-Key']);
    assert.ok(a.startsWith('shop-sub-'));
    assert.ok(!a.includes('noa'));
    assert.equal(a, sub._keyFor('noa@example.com', sub._today()));
    // the address is sent as typed, so a different case is a different payload; the key differs only by day
    assert.equal(sub._keyFor('NOA@example.com', '2026-11-27'), sub._keyFor('noa@example.com', '2026-11-27'));
    assert.notEqual(sub._keyFor('noa@example.com', '2026-11-27'), sub._keyFor('noa@example.com', '2026-11-28'));
    assert.notEqual(sub._keyFor('noa@example.com', '2026-11-27'), sub._keyFor('dan@example.com', '2026-11-27'));
    assert.equal(b.length, a.length);
  });

  it('the day is the Israeli calendar day', () => {
    // 23:30 UTC on 26.11 is already 27.11 in Israel (UTC+2 in winter)
    assert.equal(sub._today(new Date('2026-11-26T23:30:00Z')), '2026-11-27');
    assert.equal(sub._today(new Date('2026-11-26T12:00:00Z')), '2026-11-26');
  });

  it('a double submit sends the same payload under the same key', async () => {
    await post(body());
    await post(body());
    assert.equal(mails[0].headers['Idempotency-Key'], mails[1].headers['Idempotency-Key']);
    assert.deepEqual(mails[0].payload, mails[1].payload);
  });

  it('502 when the provider fails, with the address kept out of the logs', async () => {
    mails.restore();
    mails = stubFetch(() => ({ status: 403, body: { name: 'validation_error', message: 'You can only send testing emails to your own address (noa@example.com).' } }));
    const r = await post(body());
    assert.equal(r.statusCode, 502);
    assert.deepEqual(r.json, { ok: false, error: 'send_failed' });
    assert.equal(errors.length, 1);
    assert.match(errors[0], /403 validation_error/);
    assert.ok(!errors[0].includes('noa@example.com'));
  });

  it('limits one address to five sign-ups in ten minutes', async () => {
    // without x-real-ip the first x-forwarded-for hop is the visitor
    const headers = { 'x-real-ip': undefined, 'x-forwarded-for': '198.51.100.7, 10.0.0.1' };
    for (let i = 0; i < 5; i++) assert.equal((await post(body({ email: 'n' + i + '@example.com' }), { headers })).statusCode, 200);
    assert.equal((await post(body(), { headers })).statusCode, 429);
    assert.equal((await post(body(), { headers: { 'x-real-ip': undefined, 'x-forwarded-for': '198.51.100.8, 10.0.0.1' } })).statusCode, 200);
  });
});
