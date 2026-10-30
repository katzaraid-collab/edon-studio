// מאזן — export / import (JSON backup + CSV).
// exportJSON / exportCSV / importFile / parseCSV are pure (Node-safe; Blob is
// global in Node 18+). Only download() touches the DOM.

import { isISODate, normalizeText, parseMoney, PAYMENTS, todayISO, uid } from './format.js';
import { periodRange } from './model.js';
import { normalizeState, STATE_VERSION } from './store.js';

const BOM = '﻿';
export const CSV_HEADERS = ['תאריך', 'סוג', 'קטגוריה', 'סכום', 'אמצעי תשלום', 'הערה'];
const TYPE_LABEL = { expense: 'הוצאה', income: 'הכנסה' };

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/** Full backup as pretty JSON (re-importable with importFile). */
export function exportJSON(state) {
  const payload = { app: 'maazan', exportedAt: new Date().toISOString(), ...state, version: state.version ?? STATE_VERSION };
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
}

/** Quote a CSV field when needed and neutralize spreadsheet formulas. */
export function csvField(value, { text = false } = {}) {
  let s = value == null ? '' : String(value);
  // Excel/Sheets execute cells starting with = + - @ (CSV injection).
  if (text && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
  if (/[",\r\n]/.test(s) || /^\s|\s$/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function amountPlain(agorot) {
  return agorot % 100 ? (agorot / 100).toFixed(2) : String(agorot / 100);
}

/**
 * CSV of transactions (all, or one period with {key}), oldest first.
 * UTF-8 with BOM + CRLF so Excel opens Hebrew correctly.
 */
export function exportCSV(state, { key = null } = {}) {
  const cats = new Map(state.categories.map((c) => [c.id, c]));
  const pay = new Map(PAYMENTS.map((p) => [p.id, p.label]));
  let list = [...state.transactions];
  if (key) {
    const r = periodRange(key, state.settings?.monthStartDay ?? 1);
    list = list.filter((t) => t.date >= r.from && t.date <= r.to);
  }
  list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.createdAt || 0) - (b.createdAt || 0)));
  const rows = [CSV_HEADERS.join(',')];
  for (const t of list) {
    rows.push(
      [
        t.date,
        TYPE_LABEL[t.type] || TYPE_LABEL.expense,
        csvField(cats.get(t.categoryId)?.name ?? '', { text: true }),
        amountPlain(t.amount),
        csvField(pay.get(t.payment) ?? '', { text: true }),
        csvField(t.note ?? '', { text: true }),
      ].join(','),
    );
  }
  return new Blob([BOM + rows.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
}

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

function detectDelimiter(text) {
  const sample = text.split(/\r?\n/).slice(0, 15).join('\n');
  let best = ',';
  let bestCount = -1;
  for (const d of [',', ';', '\t', '|']) {
    // count outside quotes
    let n = 0;
    let q = false;
    for (const ch of sample) {
      if (ch === '"') q = !q;
      else if (ch === d && !q) n++;
    }
    if (n > bestCount) [best, bestCount] = [d, n];
  }
  return best;
}

/** RFC-4180-ish parser: quotes, escaped quotes, CRLF/LF, embedded newlines. */
export function parseCSV(text, delimiter = null) {
  text = String(text ?? '').replace(/^﻿/, '');
  const d = delimiter || detectDelimiter(text);
  const rows = [];
  let row = [];
  let field = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else q = false;
      } else field += ch;
    } else if (ch === '"' && field === '') q = true;
    else if (ch === d) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const norm = (s) =>
  normalizeText(s)
    .replace(/[₪$€]/g, '')
    .replace(/\b(ils|nis)\b/g, '')
    .replace(/ש ?ח/g, '')
    .trim();

// Ordered synonyms: earlier = preferred.
const COLS = {
  date: ['תאריך', 'תאריך עסקה', 'תאריך רכישה', 'תאריך ערך', 'תאריך התנועה', 'תאריך חיוב', 'date', 'transaction date', 'posting date', 'booking date'],
  amount: ['סכום', 'סכום חיוב', 'סכום החיוב', 'סכום בשקלים', 'סכום עסקה', 'סכום העסקה', 'סכום מקורי', 'amount', 'sum', 'value', 'total'],
  debit: ['חובה', 'בחובה', 'חיוב', 'הוצאה', 'debit', 'withdrawal', 'withdrawals', 'money out', 'paid out'],
  credit: ['זכות', 'בזכות', 'זיכוי', 'הכנסה', 'credit', 'deposit', 'deposits', 'money in', 'paid in'],
  type: ['סוג', 'סוג תנועה', 'סוג עסקה', 'type', 'transaction type'],
  category: ['קטגוריה', 'ענף', 'category'],
  note: ['הערה', 'תיאור', 'פירוט', 'שם בית העסק', 'שם בית עסק', 'בית עסק', 'בית העסק', 'תיאור התנועה', 'תאור', 'פרטים', 'description', 'note', 'notes', 'memo', 'payee', 'merchant', 'details', 'name'],
  payment: ['אמצעי תשלום', 'אמצעי', 'payment', 'payment method', 'method'],
};

function mapColumns(header) {
  const cells = header.map(norm);
  const used = new Set();
  const out = {};
  const find = (syns, exact) => {
    for (const syn of syns.map(norm)) {
      const i = cells.findIndex((c, idx) => !used.has(idx) && (exact ? c === syn : c.startsWith(syn + ' ')));
      if (i >= 0) return i;
    }
    return -1;
  };
  // Exact matches first for every field, then prefix matches ("תאריך עסקה
  // מקורי"). Debit/credit/type are exact-only: "חיוב" must not grab
  // "תאריך חיוב".
  for (const pass of [true, false]) {
    for (const [field, syns] of Object.entries(COLS)) {
      if (field in out) continue;
      if (!pass && (field === 'debit' || field === 'credit' || field === 'type')) continue;
      const i = find(syns, pass);
      if (i >= 0) {
        out[field] = i;
        used.add(i);
      }
    }
  }
  return out;
}

/** dd/mm/yyyy, d.m.yy, dd-mm-yyyy, yyyy-mm-dd, yyyy/mm/dd (+ optional time) → ISO or null. */
export function parseDateLoose(s) {
  s = String(s ?? '').trim().replace(/[‎‏]/g, '');
  if (!s) return null;
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(s);
  if (m) {
    let y = +m[3];
    if (m[3].length === 2) y += 2000;
    return valid(y, +m[2], +m[1]); // Israeli order: day first
  }
  return null;
}
function valid(y, mo, d) {
  const iso = `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return isISODate(iso) ? iso : null;
}

function parseType(s) {
  const n = norm(s);
  if (!n) return null;
  if (/^(הכנסה|זכות|זיכוי|income|credit|deposit|in)$/.test(n)) return 'income';
  if (/^(הוצאה|חובה|חיוב|expense|debit|withdrawal|out)$/.test(n)) return 'expense';
  return null;
}

function parsePayment(s) {
  const n = norm(s);
  if (!n) return null;
  for (const p of PAYMENTS) if (norm(p.label) === n || p.id === n) return p.id;
  if (/אשראי|כרטיס|card|visa|ויזה|מאסטר|ישראכרט|אמריקן/.test(n)) return 'card';
  if (/מזומן|cash/.test(n)) return 'cash';
  if (/העברה|transfer|בנק|הוראת קבע/.test(n)) return 'transfer';
  if (/ביט|פייבוקס|bit|paybox/.test(n)) return 'bit';
  return 'other';
}

/** Undo the CSV-injection guard we add on export. */
const unguard = (s) => String(s ?? '').trim().replace(/^'(?=[=+\-@])/, '');

/**
 * Merge CSV rows into `state` (immutable). Returns {state, added, skipped}.
 * Categories are matched by name (same type first); missing ones are created.
 * Rows identical to existing transactions (date+type+amount+note) are skipped
 * so re-importing an export doesn't duplicate.
 */
export function importCSVText(text, state, { now = Date.now() } = {}) {
  const rows = parseCSV(text);
  if (!rows.length) throw new Error('הקובץ ריק');

  // header: first row (within the first 15) that has a date + amount-ish column
  let headerIdx = -1;
  let cols = null;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const c = mapColumns(rows[i]);
    if (c.date != null && (c.amount != null || c.debit != null || c.credit != null)) {
      headerIdx = i;
      cols = c;
      break;
    }
  }
  if (!cols) throw new Error('לא זוהו בקובץ עמודות של תאריך וסכום');

  const body = rows.slice(headerIdx + 1);
  const get = (r, f) => (cols[f] != null ? r[cols[f]] ?? '' : '');

  // Single signed amount column without a type column: if any value is
  // negative, the file is a bank statement (− = expense, + = income);
  // otherwise (credit-card style) everything is an expense.
  const signed = cols.amount != null && cols.type == null && cols.debit == null && cols.credit == null;
  const hasNegative = signed && body.some((r) => parseMoney(get(r, 'amount')) < 0);

  const categories = state.categories.map((c) => ({ ...c }));
  const byName = new Map();
  for (const c of categories) {
    const k = c.type + ':' + norm(c.name);
    if (!byName.has(k) || (byName.get(k).archived && !c.archived)) byName.set(k, c);
  }
  const fallback = (type) => {
    const pref = type === 'income' ? 'הכנסה אחרת' : 'שונות';
    return byName.get(type + ':' + norm(pref)) || categories.find((c) => c.type === type && !c.archived) || categories.find((c) => c.type === type);
  };
  let order = categories.reduce((m, c) => Math.max(m, c.order ?? 0), -1);
  const resolveCategory = (name, type) => {
    const n = norm(name);
    if (!n) return fallback(type).id;
    const hit = byName.get(type + ':' + n);
    if (hit) return hit.id;
    const sameTypeCount = categories.filter((c) => c.type === type).length;
    const cat = { id: uid(), name: unguard(name).slice(0, 60), type, icon: type === 'income' ? 'wallet' : 'dots', color: (sameTypeCount % 12) + 1, budget: 0, archived: false, order: ++order };
    categories.push(cat);
    byName.set(type + ':' + n, cat);
    return cat.id;
  };

  const sig = (t) => `${t.date}|${t.type}|${t.amount}|${norm(t.note)}`;
  const existing = new Map();
  for (const t of state.transactions) existing.set(sig(t), (existing.get(sig(t)) || 0) + 1);

  const added = [];
  let skipped = 0;
  for (const r of body) {
    const date = parseDateLoose(get(r, 'date'));
    let type = null;
    let amount = NaN;
    if (cols.debit != null || cols.credit != null) {
      const deb = parseMoney(get(r, 'debit'));
      const cre = parseMoney(get(r, 'credit'));
      if (Math.abs(deb) > 0) [type, amount] = ['expense', Math.abs(deb)];
      else if (Math.abs(cre) > 0) [type, amount] = ['income', Math.abs(cre)];
      else if (cols.amount != null) amount = parseMoney(get(r, 'amount'));
    } else {
      amount = parseMoney(get(r, 'amount'));
    }
    if (!type) {
      const explicit = parseType(get(r, 'type'));
      if (explicit) type = explicit;
      else if (signed && hasNegative) type = amount < 0 ? 'expense' : 'income';
      else type = 'expense';
      amount = Math.abs(amount);
    }
    if (!date || !(amount > 0)) {
      skipped++;
      continue;
    }
    const note = unguard(get(r, 'note')).replace(/\s+/g, ' ').slice(0, 300);
    const tx = {
      id: uid(),
      type,
      amount: Math.round(amount),
      categoryId: resolveCategory(unguard(get(r, 'category')), type),
      date,
      note,
      payment: parsePayment(unguard(get(r, 'payment'))) || (type === 'income' ? 'transfer' : 'card'),
      createdAt: now,
      updatedAt: now,
    };
    const k = sig(tx);
    const left = existing.get(k) || 0;
    if (left > 0) {
      existing.set(k, left - 1);
      skipped++;
      continue;
    }
    added.push(tx);
  }

  const next = normalizeState({ ...state, categories, transactions: [...state.transactions, ...added] });
  return { state: next, added: added.length, skipped };
}

async function readText(file) {
  if (typeof file === 'string') return file;
  if (file && typeof file.text === 'function') return file.text();
  if (file && typeof file.arrayBuffer === 'function') return new TextDecoder('utf-8').decode(await file.arrayBuffer());
  throw new TypeError('קובץ לא נתמך');
}

/**
 * Import a File/Blob.
 *   JSON → full backup, replaces everything: {state, added: tx count, kind:'json'}
 *   CSV  → transactions appended to `state`:  {state, added, kind:'csv', skipped}
 * The caller commits with store.replaceAll(result.state).
 */
export async function importFile(file, state) {
  let text = await readText(file);
  text = text.replace(/^﻿/, '');
  const name = String(file?.name || '').toLowerCase();
  const looksJSON = name.endsWith('.json') || /^\s*\{/.test(text);
  if (looksJSON) {
    let raw;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new Error('קובץ הגיבוי פגום ולא ניתן לקרוא אותו');
    }
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.transactions)) throw new Error('זה לא נראה כמו קובץ גיבוי של מאזן');
    const next = normalizeState(raw);
    return { state: next, added: next.transactions.length, kind: 'json' };
  }
  if (!state) throw new TypeError('state is required for CSV import');
  const res = importCSVText(text, state);
  return { ...res, kind: 'csv' };
}

/** Suggested file name, e.g. "maazan-2026-10-30.csv". */
export function exportFilename(ext, key = null) {
  return `maazan-${key || todayISO()}.${ext}`;
}

/** Trigger a browser download of a Blob. */
export function download(blob, filename) {
  if (typeof document === 'undefined') throw new Error('download() requires a browser');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}
