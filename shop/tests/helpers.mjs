// Shared bits for the shop tests: loading the CommonJS API files, fake req/res objects, a fetch stub
// that records what would have gone to Resend, and an env scope that puts process.env back afterwards.
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';

const require = createRequire(import.meta.url);

// catalog.json may be mid-write in an editor; a read that fails to parse is retried for a while
export async function load(spec) {
  for (let i = 0; ; i++) {
    try { return require(spec); } catch (e) {
      if (i >= 40 || !(e instanceof SyntaxError)) throw e;
      await new Promise(r => setTimeout(r, 250));
    }
  }
}

// every request gets its own address unless the test names one, so the rate limit stays out of the way
let ip = 0;
export function fakeReq({ method = 'POST', body, raw, headers = {} } = {}) {
  ip++;
  const h = { host: 'shop.test', 'content-type': 'application/json', 'x-real-ip': '10.9.' + ((ip >> 8) & 255) + '.' + (ip & 255), ...headers };
  for (const k of Object.keys(h)) if (h[k] === undefined) delete h[k];
  if (raw !== undefined) return Object.assign(Readable.from([Buffer.from(raw)]), { method, headers: h });
  return { method, headers: h, body, socket: {} };
}

export function fakeRes() {
  return {
    statusCode: 200, headers: {}, raw: '',
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(s) { this.raw = s || ''; this.ended = true; },
    get json() { return this.raw ? JSON.parse(this.raw) : undefined; },
  };
}

// responder(call, n) returns { status, body } or an Error to throw (as fetch does when the network fails)
export function stubFetch(responder = () => ({ status: 200, body: { id: 'em_test' } })) {
  const calls = [], prev = globalThis.fetch;
  globalThis.fetch = async (url, opts = {}) => {
    const call = { url, method: opts.method, headers: opts.headers || {}, signal: opts.signal, payload: JSON.parse(opts.body) };
    calls.push(call);
    const r = await responder(call, calls.length);
    if (r instanceof Error) throw r;
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body || {} };
  };
  calls.restore = () => { globalThis.fetch = prev; };
  return calls;
}

export function captureErrors() {
  const lines = [], prev = console.error;
  console.error = (...a) => { lines.push(a.map(String).join(' ')); };
  lines.restore = () => { console.error = prev; };
  return lines;
}

const KEYS = ['RESEND_API_KEY', 'ORDER_TO', 'CONTACT_TO', 'ORDER_FROM', 'CONTACT_FROM', 'ORDER_CUSTOMER_COPY', 'ORDER_REPLY_TO'];
export function setEnv(vals = {}) {
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, vals);
}
// sets the given variables (and clears the other mail ones); returns a function that restores the old values
export function envScope(vals) {
  const saved = Object.fromEntries(KEYS.map(k => [k, process.env[k]]));
  setEnv(vals);
  return () => { for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } };
}

// the shekel format the API writes in subjects and emails
export const ils = n => '₪' + (Number.isInteger(n) ? String(n) : n.toFixed(2)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
