// מאזן — formatting & parsing helpers.
// Pure module: no DOM, no storage. Safe to import in Node.
//
// Conventions
//   • Money is ALWAYS integer agorot (₪12.50 → 1250).
//   • Dates are local calendar strings 'YYYY-MM-DD'. We never call
//     `new Date('YYYY-MM-DD')` (that parses as UTC midnight and shifts the day
//     in negative offsets); date math is done on parts / Date.UTC instead.
//   • Month keys are 'YYYY-MM'.

export const PAYMENTS = [
  { id: 'card', label: 'כרטיס אשראי', icon: 'card' },
  { id: 'cash', label: 'מזומן', icon: 'cash' },
  { id: 'transfer', label: 'העברה בנקאית', icon: 'bank' },
  { id: 'bit', label: 'ביט / פייבוקס', icon: 'phone' },
  { id: 'other', label: 'אחר', icon: 'dots' },
];

export const PAYMENT_IDS = PAYMENTS.map((p) => p.id);

export function paymentLabel(id) {
  return (PAYMENTS.find((p) => p.id === id) || PAYMENTS[PAYMENTS.length - 1]).label;
}

export const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
export const MONTHS_SHORT = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];
/** Sunday first, as in Israel. */
export const WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
export const WEEKDAYS_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

const NBSP = ' ';
const MINUS = '−';
const SHEKEL = '₪';

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

const nfCache = new Map();
function nf(minFrac, maxFrac) {
  const k = minFrac + ':' + maxFrac;
  let f = nfCache.get(k);
  if (!f) {
    try {
      f = new Intl.NumberFormat('he-IL', { minimumFractionDigits: minFrac, maximumFractionDigits: maxFrac, useGrouping: true });
    } catch {
      f = new Intl.NumberFormat('en-US', { minimumFractionDigits: minFrac, maximumFractionDigits: maxFrac, useGrouping: true });
    }
    nfCache.set(k, f);
  }
  return f;
}

/** Strip bidi control marks Intl may inject, so output is predictable. */
function clean(s) {
  return s.replace(/[‎‏؜‪-‮⁦-⁩]/g, '');
}

/** Format a plain number with he-IL grouping ("1,234.5"). */
export function fmtNumber(n, { decimals = 0 } = {}) {
  return clean(nf(decimals, decimals).format(Number.isFinite(n) ? n : 0));
}

/**
 * Format agorot as shekels.
 *   fmtMoney(123400)                  → "1,234 ₪"
 *   fmtMoney(123450)                  → "1,234.50 ₪"
 *   fmtMoney(-5000, {sign:true})      → "−50 ₪"
 *   fmtMoney(5000, {sign:true})       → "+50 ₪"
 *   fmtMoney(1240000, {compact:true}) → "12.4K ₪"
 * The space before ₪ is a no-break space. Negative values always get "−"
 * (U+2212); `sign` additionally prefixes positives with "+". Zero is unsigned.
 * decimals: 'auto' (agorot only when non-zero) | 0 | 2.
 */
export function fmtMoney(agorot, { sign = false, compact = false, decimals = 'auto' } = {}) {
  let v = Number(agorot);
  if (!Number.isFinite(v)) v = 0;
  v = Math.round(v);
  const abs = Math.abs(v);
  let body;

  if (compact && abs >= 100000) {
    // ≥ 1,000 ₪ → K / M with at most one decimal (dropped from 100 up).
    const shekels = abs / 100;
    const units = [
      [1e6, 'M'],
      [1e3, 'K'],
    ];
    let [div, suffix] = shekels >= 1e6 ? units[0] : units[1];
    let scaled = shekels / div;
    let digits = scaled < 100 ? 1 : 0;
    let rounded = roundTo(scaled, digits);
    if (suffix === 'K' && rounded >= 1000) {
      // 999,960 ₪ would read "1000K" — promote to M.
      div = 1e6;
      suffix = 'M';
      scaled = shekels / div;
      digits = 1;
      rounded = roundTo(scaled, digits);
    }
    body = fmtNumber(rounded, { decimals: Number.isInteger(rounded) ? 0 : digits }) + suffix;
  } else if (compact) {
    body = fmtNumber(Math.round(abs / 100));
  } else {
    let d = decimals === 'auto' ? (abs % 100 ? 2 : 0) : Number(decimals) > 0 ? 2 : 0;
    body = d ? fmtNumber(abs / 100, { decimals: 2 }) : fmtNumber(Math.round(abs / 100));
  }

  const isZero = body.replace(/[^1-9]/g, '') === '';
  const prefix = isZero ? '' : v < 0 ? MINUS : sign ? '+' : '';
  return prefix + body + NBSP + SHEKEL;
}

function roundTo(n, digits) {
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}

/**
 * Parse a user / bank amount string into integer agorot.
 *   "1,234.5" → 123450   "1234,50" → 123450   "₪ 12" → 1200
 *   "-45.90" / "−45.90" / "(45.90)" / "45.90-" → -4590
 * Returns NaN when no number can be read. Numbers are taken as shekels.
 */
export function parseMoney(str) {
  if (typeof str === 'number') return Number.isFinite(str) ? Math.round(str * 100) : NaN;
  if (str == null) return NaN;
  let s = String(str).trim();
  if (!s) return NaN;
  s = s.replace(/[‎‏‪-‮⁦-⁩]/g, '');

  let negative = false;
  if (/^\(.*\)$/.test(s)) negative = true;
  if (/^[^\d]*[-−–]/.test(s) || /[-−–]\s*$/.test(s)) negative = true;

  // keep digits and separators only (drops ₪, ש"ח, ILS, NIS, spaces, apostrophes)
  let n = s.replace(/[^\d.,]/g, '');
  if (!/\d/.test(n)) return NaN;
  n = n.replace(/^[.,]+|[.,]+$/g, (m, off) => (off === 0 ? '0' + m : '')); // ".5" → "0.5"; trailing seps dropped

  let intPart;
  let fracPart = '';
  const lastDot = n.lastIndexOf('.');
  const lastComma = n.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    const dec = lastDot > lastComma ? '.' : ',';
    const i = n.lastIndexOf(dec);
    intPart = n.slice(0, i).replace(/[.,]/g, '');
    fracPart = n.slice(i + 1).replace(/[.,]/g, '');
  } else if (lastComma >= 0 || lastDot >= 0) {
    const sep = lastComma >= 0 ? ',' : '.';
    const parts = n.split(sep);
    if (parts.length > 2) {
      intPart = parts.join(''); // "1,234,567" / "1.234.567" → grouping
    } else if (sep === ',' && parts[1].length === 3 && parts[0].length > 0 && parts[0] !== '0') {
      intPart = parts.join(''); // "1,234" → thousands
    } else {
      intPart = parts[0];
      fracPart = parts[1];
    }
  } else {
    intPart = n;
  }
  if (!intPart) intPart = '0';
  if (!/^\d+$/.test(intPart) || !/^\d*$/.test(fracPart)) return NaN;

  const f3 = (fracPart + '000').slice(0, 3);
  let agorot = Number(intPart) * 100 + Number(f3.slice(0, 2)) + (Number(f3[2]) >= 5 ? 1 : 0);
  if (!Number.isFinite(agorot)) return NaN;
  return negative && agorot ? -agorot : agorot;
}

/** 0.234 → "23%". null / NaN → "—". `sign` → "+23%" / "−23%". */
export function fmtPct(ratio, { sign = false } = {}) {
  if (ratio == null || !Number.isFinite(Number(ratio))) return '—';
  const pct = Math.round(Number(ratio) * 100);
  const abs = Math.abs(pct);
  const prefix = pct < 0 ? MINUS : sign && pct > 0 ? '+' : '';
  return prefix + fmtNumber(abs) + '%';
}

// ---------------------------------------------------------------------------
// Dates (local, TZ-safe)
// ---------------------------------------------------------------------------

const pad2 = (n) => String(n).padStart(2, '0');

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const KEY_RE = /^(\d{4})-(\d{2})$/;

/** True for a real calendar date 'YYYY-MM-DD'. */
export function isISODate(s) {
  if (typeof s !== 'string') return false;
  const m = ISO_RE.exec(s);
  if (!m) return false;
  const y = +m[1];
  const mo = +m[2];
  const d = +m[3];
  return mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo);
}

export function isMonthKey(s) {
  if (typeof s !== 'string') return false;
  const m = KEY_RE.exec(s);
  return !!m && +m[2] >= 1 && +m[2] <= 12;
}

/** Split 'YYYY-MM-DD' → [y, m, d] numbers (m is 1-based). */
export function isoParts(iso) {
  return [+iso.slice(0, 4), +iso.slice(5, 7), +iso.slice(8, 10)];
}

export function daysInMonth(year, month1) {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

/** Build an ISO date from parts, clamping the day to the month's length. */
export function makeISO(year, month1, day) {
  const d = Math.min(Math.max(1, day), daysInMonth(year, month1));
  return `${String(year).padStart(4, '0')}-${pad2(month1)}-${pad2(d)}`;
}

export function toISO(dateObj) {
  return `${String(dateObj.getFullYear()).padStart(4, '0')}-${pad2(dateObj.getMonth() + 1)}-${pad2(dateObj.getDate())}`;
}

/** Local Date at 00:00 of the given day (never parsed as UTC). */
export function fromISO(iso) {
  const [y, m, d] = isoParts(iso);
  const dt = new Date(y, m - 1, d);
  if (y < 100) dt.setFullYear(y);
  return dt;
}

export function todayISO(now = new Date()) {
  return toISO(now);
}

/** Pure calendar arithmetic, independent of the host time zone / DST. */
export function addDays(iso, n) {
  const [y, m, d] = isoParts(iso);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${String(t.getUTCFullYear()).padStart(4, '0')}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}`;
}

/** a − b in whole days. */
export function diffDays(a, b) {
  const [y1, m1, d1] = isoParts(a);
  const [y2, m2, d2] = isoParts(b);
  return Math.round((Date.UTC(y1, m1 - 1, d1) - Date.UTC(y2, m2 - 1, d2)) / 86400000);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(iso) {
  const [y, m, d] = isoParts(iso);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** 'YYYY-MM' arithmetic. */
export function addMonths(key, n) {
  const y = +key.slice(0, 4);
  const m = +key.slice(5, 7);
  const idx = y * 12 + (m - 1) + Math.trunc(n);
  const ny = Math.floor(idx / 12);
  const nm = idx - ny * 12 + 1;
  return `${String(ny).padStart(4, '0')}-${pad2(nm)}`;
}

/** Number of months from a to b (b − a). */
export function monthDiff(a, b) {
  return (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7));
}

/** Calendar month of a date. */
export function monthOf(iso) {
  return iso.slice(0, 7);
}

/**
 * "30 באוק׳" ; {weekday:true} → "יום ה׳, 30 באוקטובר".
 * year: 'auto' (shown only when not the current year) | true | false.
 */
export function fmtDate(iso, { weekday = false, year = 'auto', now = new Date() } = {}) {
  if (!isISODate(iso)) return '';
  const [y, m, d] = isoParts(iso);
  const showYear = year === true || (year === 'auto' && y !== now.getFullYear());
  const month = weekday ? MONTHS[m - 1] : MONTHS_SHORT[m - 1];
  let s = `${d} ב${month}`;
  if (showYear) s += ` ${y}`;
  if (weekday) s = `יום ${WEEKDAYS_SHORT[weekdayOf(iso)]}, ${s}`;
  return s;
}

/** "היום" / "אתמול" / "מחר" / "יום ראשון, 26 באוקטובר" (+ year when not this year). */
export function fmtDayHeader(iso, today = todayISO()) {
  if (!isISODate(iso)) return '';
  const diff = diffDays(iso, today);
  if (diff === 0) return 'היום';
  if (diff === -1) return 'אתמול';
  if (diff === 1) return 'מחר';
  const [y, m, d] = isoParts(iso);
  let s = `יום ${WEEKDAYS[weekdayOf(iso)]}, ${d} ב${MONTHS[m - 1]}`;
  if (y !== +today.slice(0, 4)) s += ` ${y}`;
  return s;
}

/** "אוקטובר 2026" ; {short:true} → "אוק׳". */
export function fmtMonth(key, { short = false } = {}) {
  if (!isMonthKey(key)) return '';
  const y = +key.slice(0, 4);
  const m = +key.slice(5, 7);
  return short ? MONTHS_SHORT[m - 1] : `${MONTHS[m - 1]} ${y}`;
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

let uidCounter = 0;
/** Short, collision-resistant id (time + counter + randomness), e.g. "lq3k9x2a7f1c". */
export function uid() {
  const t = Date.now().toString(36);
  uidCounter = (uidCounter + 1) % 1296;
  let r = '';
  const c = globalThis.crypto;
  if (c && typeof c.getRandomValues === 'function') {
    const buf = new Uint32Array(2);
    c.getRandomValues(buf);
    r = buf[0].toString(36) + buf[1].toString(36);
  } else {
    r = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  }
  return t + uidCounter.toString(36).padStart(2, '0') + r.slice(0, 6).padStart(6, '0');
}

/** Normalize free text for grouping / searching (merchant names etc.). */
export function normalizeText(s) {
  return String(s ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[֑-ׇ]/g, '') // Hebrew niqqud / cantillation
    .replace(/["'״׳`´’‘“”]/g, '')
    .replace(/[\-–—_.,:;!?()[\]{}/\\|*#+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
