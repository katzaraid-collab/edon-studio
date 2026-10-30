// מאזן — application state, persistence, mutations, recurring & demo data.
//
// • Single source of truth: `store.state` (treat as read-only). Every mutation
//   produces a NEW state object with new arrays for what changed (so model.js
//   memoization keyed on array identity stays correct), then notifies
//   subscribers with (state, change).
// • Persistence: localStorage key `maazan:v1`, debounced (~150ms) and flushed
//   on pagehide / visibilitychange→hidden. Cross-tab sync via the `storage`
//   event. Corrupted data is backed up under `maazan:backup:<ts>`.
// • Node-safe: nothing touches window/localStorage at import time; when no
//   storage is available an in-memory fallback is used.

import { addMonths, isISODate, isMonthKey, makeISO, monthOf, PAYMENT_IDS, todayISO, uid, fromISO } from './format.js';

export const STATE_VERSION = 1;
export const STORAGE_KEY = 'maazan:v1';
export const BACKUP_PREFIX = 'maazan:backup:';
const SAVE_DELAY = 150;

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const EXPENSE_DEFAULTS = [
  ['groceries', 'מזון וסופר', 'cart', 1],
  ['dining', 'מסעדות ומשלוחים', 'food', 2],
  ['coffee', 'קפה ומאפים', 'coffee', 3],
  ['transport', 'תחבורה ודלק', 'car', 4],
  ['housing', 'דיור', 'home', 5],
  ['utilities', 'חשבונות הבית', 'bolt', 6],
  ['telecom', 'תקשורת', 'phone', 7],
  ['health', 'בריאות', 'health', 8],
  ['clothing', 'ביגוד והנעלה', 'shirt', 9],
  ['leisure', 'בילויים ופנאי', 'party', 10],
  ['subscriptions', 'מנויים', 'repeat', 11],
  ['education', 'חינוך וקורסים', 'book', 1],
  ['gifts', 'מתנות ואירועים', 'gift', 2],
  ['insurance', 'ביטוחים', 'shield', 3],
  ['pets', 'חיות מחמד', 'paw', 4],
  ['grooming', 'טיפוח', 'sparkle', 5],
  ['kids', 'ילדים', 'baby', 6],
  ['travel', 'חופשות', 'plane', 7],
  ['misc', 'שונות', 'dots', 12],
];
const INCOME_DEFAULTS = [
  ['salary', 'משכורת', 'briefcase', 4],
  ['side', 'עבודה נוספת', 'tools', 1],
  ['refunds', 'החזרים וזיכויים', 'undo', 7],
  ['gifts-in', 'מתנות', 'gift', 2],
  ['other-in', 'הכנסה אחרת', 'wallet', 12],
];

export const DEFAULT_CATEGORIES = Object.freeze(
  [...EXPENSE_DEFAULTS.map((c) => [...c, 'expense']), ...INCOME_DEFAULTS.map((c) => [...c, 'income'])].map(([id, name, icon, color, type], order) =>
    Object.freeze({ id, name, type, icon, color, budget: 0, archived: false, order }),
  ),
);

export const DEFAULT_SETTINGS = Object.freeze({ name: '', monthStartDay: 1, savingsGoal: 0, theme: 'system', onboarded: false });

export function defaultState() {
  return {
    version: STATE_VERSION,
    transactions: [],
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    recurring: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

// ---------------------------------------------------------------------------
// Validation / migration
// ---------------------------------------------------------------------------

const TYPES = ['expense', 'income'];
const THEMES = ['system', 'light', 'dark'];
const str = (v, max = 500) => (v == null ? '' : String(v)).trim().slice(0, max);
const intIn = (v, lo, hi, dflt) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
};
const toAgorot = (v) => {
  const n = Math.round(Math.abs(Number(v)));
  return Number.isFinite(n) ? n : 0;
};

function fallbackCategoryId(categories, type) {
  const pref = type === 'income' ? 'other-in' : 'misc';
  const live = categories.filter((c) => c.type === type && !c.archived);
  return (live.find((c) => c.id === pref) || live[live.length - 1] || categories.find((c) => c.type === type) || categories[0])?.id;
}

function normCategory(c, i) {
  if (!c || typeof c !== 'object') return null;
  const id = str(c.id, 64);
  if (!id) return null;
  const type = TYPES.includes(c.type) ? c.type : 'expense';
  return {
    id,
    name: str(c.name, 60) || 'קטגוריה',
    type,
    icon: str(c.icon, 32) || 'dots',
    color: intIn(c.color, 1, 12, 12),
    budget: type === 'expense' ? toAgorot(c.budget || 0) : 0,
    archived: !!c.archived,
    order: Number.isFinite(+c.order) ? +c.order : i,
  };
}

function normTransaction(t, categories, now) {
  if (!t || typeof t !== 'object') return null;
  const amount = toAgorot(t.amount);
  if (!(amount > 0) || !isISODate(t.date)) return null;
  const type = TYPES.includes(t.type) ? t.type : 'expense';
  const categoryId = str(t.categoryId, 64) || fallbackCategoryId(categories, type);
  const tx = {
    id: str(t.id, 64) || uid(),
    type,
    amount,
    categoryId,
    date: t.date,
    note: str(t.note, 300),
    payment: PAYMENT_IDS.includes(t.payment) ? t.payment : 'other',
    createdAt: Number.isFinite(+t.createdAt) && +t.createdAt > 0 ? +t.createdAt : now,
    updatedAt: Number.isFinite(+t.updatedAt) && +t.updatedAt > 0 ? +t.updatedAt : now,
  };
  if (t.recurringId) tx.recurringId = str(t.recurringId, 64);
  if (t.recurKey) tx.recurKey = str(t.recurKey, 80);
  return tx;
}

function normRecurring(r, categories, today) {
  if (!r || typeof r !== 'object') return null;
  const amount = toAgorot(r.amount);
  if (!(amount > 0)) return null;
  const type = TYPES.includes(r.type) ? r.type : 'expense';
  const startMonth = isMonthKey(r.startMonth) ? r.startMonth : monthOf(today);
  const endMonth = isMonthKey(r.endMonth) && r.endMonth >= startMonth ? r.endMonth : null;
  return {
    id: str(r.id, 64) || uid(),
    type,
    amount,
    categoryId: str(r.categoryId, 64) || fallbackCategoryId(categories, type),
    note: str(r.note, 300),
    payment: PAYMENT_IDS.includes(r.payment) ? r.payment : 'card',
    day: intIn(r.day, 1, 31, 1),
    startMonth,
    endMonth,
    active: r.active !== false,
    done: Array.isArray(r.done) ? [...new Set(r.done.filter(isMonthKey))].sort() : [],
  };
}

function normSettings(s) {
  s = s && typeof s === 'object' ? s : {};
  return {
    name: str(s.name, 40),
    monthStartDay: intIn(s.monthStartDay, 1, 28, 1),
    savingsGoal: toAgorot(s.savingsGoal || 0),
    theme: THEMES.includes(s.theme) ? s.theme : 'system',
    onboarded: !!s.onboarded,
  };
}

/** Per-version migrations: MIGRATIONS[n] upgrades a v(n) object to v(n+1). */
const MIGRATIONS = {
  // 0: unversioned early drafts — same shape as v1.
  0: (raw) => ({ ...raw, version: 1 }),
};

/**
 * Validate & migrate any object into a well-formed State. Throws only when
 * the input is not an object at all; individual bad records are dropped.
 */
export function normalizeState(raw, { today = todayISO(), now = Date.now() } = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new TypeError('מבנה הנתונים אינו תקין');
  let v = Number.isInteger(raw.version) ? raw.version : 0;
  while (v < STATE_VERSION && MIGRATIONS[v]) {
    raw = MIGRATIONS[v](raw);
    v++;
  }

  // categories
  let categories = Array.isArray(raw.categories) ? raw.categories.map(normCategory).filter(Boolean) : [];
  const seenCat = new Set();
  categories = categories.filter((c) => (seenCat.has(c.id) ? false : seenCat.add(c.id)));
  for (const type of TYPES) {
    if (!categories.some((c) => c.type === type)) {
      for (const d of DEFAULT_CATEGORIES) if (d.type === type && !seenCat.has(d.id)) categories.push({ ...d });
    }
  }
  categories.sort((a, b) => a.order - b.order).forEach((c, i) => (c.order = i));

  // transactions
  const seenTx = new Set();
  const transactions = [];
  for (const t of Array.isArray(raw.transactions) ? raw.transactions : []) {
    const tx = normTransaction(t, categories, now);
    if (!tx) continue;
    while (seenTx.has(tx.id)) tx.id = uid();
    seenTx.add(tx.id);
    transactions.push(tx);
  }

  const seenRec = new Set();
  const recurring = [];
  for (const r of Array.isArray(raw.recurring) ? raw.recurring : []) {
    const rec = normRecurring(r, categories, today);
    if (!rec) continue;
    while (seenRec.has(rec.id)) rec.id = uid();
    seenRec.add(rec.id);
    recurring.push(rec);
  }

  return { version: STATE_VERSION, transactions, categories, recurring, settings: normSettings(raw.settings) };
}

// ---------------------------------------------------------------------------
// Recurring materialization (pure)
// ---------------------------------------------------------------------------

const MAX_BACKFILL_MONTHS = 120;

/**
 * Create the transactions recurring rules owe up to `today`. Idempotent: a
 * month is materialized once and recorded in rec.done, so deleting a
 * generated transaction does not bring it back.
 * Returns {state, created} — state is the same object when nothing changed.
 */
export function materializeRecurring(state, today = todayISO(), { now = Date.now(), makeId = uid } = {}) {
  const thisMonth = monthOf(today);
  const existingKeys = new Set(state.transactions.filter((t) => t.recurKey).map((t) => t.recurKey));
  const newTx = [];
  let changedRecs = false;
  const recurring = state.recurring.map((r) => {
    if (!r.active) return r;
    let last = r.endMonth && r.endMonth < thisMonth ? r.endMonth : thisMonth;
    let first = r.startMonth;
    if (addMonths(first, MAX_BACKFILL_MONTHS) < last) first = addMonths(last, -MAX_BACKFILL_MONTHS);
    const done = new Set(r.done);
    let added = false;
    for (let mk = first; mk <= last; mk = addMonths(mk, 1)) {
      if (done.has(mk)) continue;
      const date = makeISO(+mk.slice(0, 4), +mk.slice(5, 7), r.day);
      if (date > today) continue;
      const recurKey = `${r.id}:${mk}`;
      done.add(mk);
      added = true;
      if (existingKeys.has(recurKey)) continue; // e.g. done[] lost in an import
      existingKeys.add(recurKey);
      const ts = fromISO(date).getTime() + 8 * 3600e3;
      newTx.push({
        id: makeId(),
        type: r.type,
        amount: r.amount,
        categoryId: r.categoryId,
        date,
        note: r.note,
        payment: r.payment,
        recurringId: r.id,
        recurKey,
        createdAt: Math.min(ts, now),
        updatedAt: Math.min(ts, now),
      });
    }
    if (!added) return r;
    changedRecs = true;
    return { ...r, done: [...done].sort() };
  });
  if (!changedRecs) return { state, created: 0 };
  return {
    state: { ...state, recurring, transactions: newTx.length ? [...state.transactions, ...newTx] : state.transactions },
    created: newTx.length,
  };
}

// ---------------------------------------------------------------------------
// Storage adapters
// ---------------------------------------------------------------------------

export function memoryStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    key: (i) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  };
}

function browserStorage() {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return null;
    const probe = '__maazan_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return null; // Safari private mode, blocked cookies, Node…
  }
}

// ---------------------------------------------------------------------------
// Store factory
// ---------------------------------------------------------------------------

/**
 * createStore({storage, win}) — `storage` defaults to localStorage (or an
 * in-memory fallback), `win` to globalThis.window when present.
 * The app uses the default `store` singleton below; tests create their own.
 */
export function createStore({ storage = null, win = undefined, saveDelay = SAVE_DELAY } = {}) {
  let st = null; // lazily loaded State
  let backend = storage;
  let saveTimer = null;
  let dirty = false;
  let persistAsked = false;
  let lastWritten = null;
  let loadIssue = null;
  const subs = new Set();

  const getBackend = () => (backend ||= browserStorage() || memoryStorage());
  const getWin = () => (win === undefined ? (typeof window !== 'undefined' ? window : null) : win);

  function readStored() {
    const be = getBackend();
    let raw = null;
    try {
      raw = be.getItem(STORAGE_KEY);
    } catch {
      return defaultState();
    }
    if (raw == null) return defaultState();
    try {
      const parsed = JSON.parse(raw);
      const s = normalizeState(parsed);
      lastWritten = raw;
      return s;
    } catch (err) {
      loadIssue = { type: 'corrupted', backupKey: BACKUP_PREFIX + Date.now(), error: String(err?.message || err) };
      try {
        be.setItem(loadIssue.backupKey, raw);
      } catch {
        loadIssue.backupKey = null;
      }
      return defaultState();
    }
  }

  function init() {
    if (st) return;
    st = readStored();
    const w = getWin();
    if (w && typeof w.addEventListener === 'function') {
      w.addEventListener('pagehide', flush);
      w.addEventListener('beforeunload', flush);
      const doc = w.document;
      if (doc && typeof doc.addEventListener === 'function') {
        doc.addEventListener('visibilitychange', () => {
          if (doc.visibilityState === 'hidden') flush();
        });
      }
      w.addEventListener('storage', onStorage);
    }
  }

  function onStorage(e) {
    if (e.key !== STORAGE_KEY && e.key !== null) return;
    if (e.key === STORAGE_KEY && e.newValue === lastWritten) return;
    // Another tab wrote (or cleared) our data — adopt it.
    let next;
    try {
      next = e.newValue == null ? defaultState() : normalizeState(JSON.parse(e.newValue));
    } catch {
      return; // ignore garbage from elsewhere; our own copy stays authoritative
    }
    clearTimeout(saveTimer);
    saveTimer = null;
    dirty = false;
    lastWritten = e.newValue;
    st = next;
    emit({ type: 'sync' });
  }

  function emit(change) {
    for (const fn of [...subs]) {
      try {
        fn(st, change);
      } catch (err) {
        // A broken subscriber must not break the store or other subscribers.
        (globalThis.console || {}).error?.('[maazan] subscriber failed', err);
      }
    }
  }

  function scheduleSave() {
    dirty = true;
    if (saveTimer) return;
    saveTimer = setTimeout(flush, saveDelay);
    saveTimer?.unref?.();
  }

  function flush() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = null;
    if (!dirty || !st) return true;
    dirty = false;
    const json = JSON.stringify(st);
    try {
      getBackend().setItem(STORAGE_KEY, json);
      lastWritten = json;
    } catch (err) {
      dirty = true;
      emit({ type: 'persist-error', error: err?.name === 'QuotaExceededError' ? 'quota' : 'write' });
      return false;
    }
    if (!persistAsked) {
      persistAsked = true;
      try {
        globalThis.navigator?.storage?.persist?.()?.catch?.(() => {});
      } catch {
        /* not supported */
      }
    }
    return true;
  }

  function commit(next, change) {
    st = next;
    scheduleSave();
    emit(change);
  }

  const now = () => Date.now();
  /** Drop keys whose value is undefined so `{date: undefined}` means "default". */
  const defined = (o) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v !== undefined));
  const S = () => (init(), st);

  // ---- helpers ------------------------------------------------------------
  function sanitizeTx(base, patch) {
    const s = S();
    const out = { ...base };
    if ('type' in patch) out.type = TYPES.includes(patch.type) ? patch.type : out.type || 'expense';
    if ('amount' in patch) {
      const a = Math.round(Number(patch.amount));
      if (!(Number.isFinite(a) && a > 0)) throw new RangeError('הסכום חייב להיות גדול מאפס');
      out.amount = a;
    }
    if ('date' in patch) {
      if (!isISODate(patch.date)) throw new RangeError('תאריך לא תקין');
      out.date = patch.date;
    }
    if ('categoryId' in patch) out.categoryId = str(patch.categoryId, 64);
    if ('note' in patch) out.note = str(patch.note, 300);
    if ('payment' in patch) out.payment = PAYMENT_IDS.includes(patch.payment) ? patch.payment : 'other';
    if (!out.categoryId) out.categoryId = fallbackCategoryId(s.categories, out.type);
    return out;
  }

  function sanitizeRec(base, patch) {
    const s = S();
    const out = { ...base };
    if ('type' in patch) out.type = TYPES.includes(patch.type) ? patch.type : out.type;
    if ('amount' in patch) {
      const a = Math.round(Number(patch.amount));
      if (!(Number.isFinite(a) && a > 0)) throw new RangeError('הסכום חייב להיות גדול מאפס');
      out.amount = a;
    }
    if ('categoryId' in patch) out.categoryId = str(patch.categoryId, 64);
    if ('note' in patch) out.note = str(patch.note, 300);
    if ('payment' in patch) out.payment = PAYMENT_IDS.includes(patch.payment) ? patch.payment : 'other';
    if ('day' in patch) out.day = intIn(patch.day, 1, 31, out.day || 1);
    if ('startMonth' in patch && isMonthKey(patch.startMonth)) out.startMonth = patch.startMonth;
    if ('endMonth' in patch) out.endMonth = isMonthKey(patch.endMonth) ? patch.endMonth : null;
    if (out.endMonth && out.endMonth < out.startMonth) out.endMonth = out.startMonth;
    if ('active' in patch) out.active = !!patch.active;
    if (!out.categoryId) out.categoryId = fallbackCategoryId(s.categories, out.type);
    return out;
  }

  function withRecurringApplied(state, today) {
    return materializeRecurring(state, today, { now: now() });
  }

  // ---- public API ---------------------------------------------------------
  const api = {
    get state() {
      return S();
    },

    /** Info about a recovered corrupted load: {type:'corrupted', backupKey, error} or null. */
    get loadIssue() {
      return (init(), loadIssue);
    },

    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },

    /** Write pending changes now. Returns false if the write failed. */
    flush,

    // transactions
    addTransaction(partial = {}) {
      const s = S();
      partial = defined(partial);
      const type = TYPES.includes(partial.type) ? partial.type : 'expense';
      const t = now();
      const tx = sanitizeTx(
        { id: uid(), type, amount: 0, categoryId: '', date: todayISO(), note: '', payment: type === 'income' ? 'transfer' : 'card', createdAt: t, updatedAt: t },
        { date: todayISO(), ...partial, type },
      );
      if (!(tx.amount > 0)) throw new RangeError('הסכום חייב להיות גדול מאפס');
      if (partial.recurringId) tx.recurringId = str(partial.recurringId, 64);
      if (partial.recurKey) tx.recurKey = str(partial.recurKey, 80);
      commit({ ...s, transactions: [...s.transactions, tx] }, { type: 'tx:add', id: tx.id });
      return tx;
    },

    updateTransaction(id, patch = {}) {
      const s = S();
      patch = defined(patch);
      const i = s.transactions.findIndex((t) => t.id === id);
      if (i < 0) return null;
      const tx = { ...sanitizeTx(s.transactions[i], patch), updatedAt: now() };
      const transactions = s.transactions.slice();
      transactions[i] = tx;
      commit({ ...s, transactions }, { type: 'tx:update', id });
      return tx;
    },

    deleteTransaction(id) {
      const s = S();
      const removed = s.transactions.find((t) => t.id === id);
      if (!removed) return null;
      commit({ ...s, transactions: s.transactions.filter((t) => t.id !== id) }, { type: 'tx:delete', id });
      return removed;
    },

    /** Undo for deleteTransaction: re-inserts the exact transaction. */
    restoreTransaction(tx) {
      const s = S();
      const norm = normTransaction(tx, s.categories, now());
      if (!norm || s.transactions.some((t) => t.id === norm.id)) return null;
      commit({ ...s, transactions: [...s.transactions, norm] }, { type: 'tx:restore', id: norm.id });
      return norm;
    },

    // categories
    addCategory(partial = {}) {
      const s = S();
      const type = TYPES.includes(partial.type) ? partial.type : 'expense';
      const sameType = s.categories.filter((c) => c.type === type);
      const cat = normCategory(
        {
          color: (sameType.length % 12) + 1,
          icon: 'dots',
          ...partial,
          id: uid(),
          type,
          name: str(partial.name, 60) || 'קטגוריה חדשה',
          archived: false,
          order: s.categories.reduce((m, c) => Math.max(m, c.order), -1) + 1,
        },
        0,
      );
      commit({ ...s, categories: [...s.categories, cat] }, { type: 'cat:add', id: cat.id });
      return cat;
    },

    updateCategory(id, patch = {}) {
      const s = S();
      const i = s.categories.findIndex((c) => c.id === id);
      if (i < 0) return null;
      const cur = s.categories[i];
      const merged = { ...cur, ...patch, id: cur.id, type: TYPES.includes(patch.type) ? patch.type : cur.type };
      if ('name' in patch && !str(patch.name, 60)) merged.name = cur.name;
      const cat = normCategory(merged, cur.order);
      const categories = s.categories.slice();
      categories[i] = cat;
      commit({ ...s, categories }, { type: 'cat:update', id });
      return cat;
    },

    /**
     * Delete a category. With reassignToId, its transactions & recurring rules
     * move there first. Without one, a category still in use is archived
     * instead (history keeps its name). Returns 'deleted' | 'archived' | null.
     */
    deleteCategory(id, reassignToId = null) {
      const s = S();
      const cat = s.categories.find((c) => c.id === id);
      if (!cat) return null;
      const target = reassignToId && reassignToId !== id ? s.categories.find((c) => c.id === reassignToId) : null;
      let { transactions, recurring } = s;
      if (target) {
        transactions = transactions.map((t) => (t.categoryId === id ? { ...t, categoryId: target.id, updatedAt: now() } : t));
        recurring = recurring.map((r) => (r.categoryId === id ? { ...r, categoryId: target.id } : r));
      }
      const inUse = transactions.some((t) => t.categoryId === id) || recurring.some((r) => r.categoryId === id);
      if (inUse) {
        const categories = s.categories.map((c) => (c.id === id ? { ...c, archived: true, budget: 0 } : c));
        commit({ ...s, categories, transactions, recurring }, { type: 'cat:archive', id });
        return 'archived';
      }
      commit({ ...s, categories: s.categories.filter((c) => c.id !== id), transactions, recurring }, { type: 'cat:delete', id });
      return 'deleted';
    },

    reorderCategories(ids = []) {
      const s = S();
      const pos = new Map(ids.map((id, i) => [id, i]));
      const sorted = [...s.categories].sort((a, b) => (pos.has(a.id) ? pos.get(a.id) : 1e6 + a.order) - (pos.has(b.id) ? pos.get(b.id) : 1e6 + b.order));
      const categories = sorted.map((c, i) => (c.order === i ? c : { ...c, order: i }));
      commit({ ...s, categories }, { type: 'cat:reorder' });
    },

    // recurring
    addRecurring(partial = {}, today = todayISO()) {
      const s = S();
      partial = defined(partial);
      const type = TYPES.includes(partial.type) ? partial.type : 'expense';
      const rec = sanitizeRec(
        { id: uid(), type, amount: 0, categoryId: '', note: '', payment: type === 'income' ? 'transfer' : 'card', day: 1, startMonth: monthOf(today), endMonth: null, active: true, done: [] },
        { ...partial, type },
      );
      if (!(rec.amount > 0)) throw new RangeError('הסכום חייב להיות גדול מאפס');
      rec.done = [];
      const { state: next } = withRecurringApplied({ ...s, recurring: [...s.recurring, rec] }, today);
      commit(next, { type: 'rec:add', id: rec.id });
      return next.recurring.find((r) => r.id === rec.id);
    },

    updateRecurring(id, patch = {}, today = todayISO()) {
      const s = S();
      patch = defined(patch);
      const i = s.recurring.findIndex((r) => r.id === id);
      if (i < 0) return null;
      const rec = sanitizeRec(s.recurring[i], patch);
      const recurring = s.recurring.slice();
      recurring[i] = rec;
      const { state: next } = withRecurringApplied({ ...s, recurring }, today);
      commit(next, { type: 'rec:update', id });
      return next.recurring.find((r) => r.id === id);
    },

    /**
     * Remove a rule. Transactions it already generated stay (they happened).
     * removeFuture: also delete generated transactions dated after today.
     */
    deleteRecurring(id, { removeFuture = false } = {}, today = todayISO()) {
      const s = S();
      if (!s.recurring.some((r) => r.id === id)) return null;
      const transactions = removeFuture ? s.transactions.filter((t) => !(t.recurringId === id && t.date > today)) : s.transactions;
      commit({ ...s, recurring: s.recurring.filter((r) => r.id !== id), transactions }, { type: 'rec:delete', id });
      return true;
    },

    applyRecurring(today = todayISO()) {
      const s = S();
      const { state: next, created } = withRecurringApplied(s, today);
      if (next !== s) commit(next, { type: 'recurring:apply', created });
      return created;
    },

    // settings
    updateSettings(patch = {}) {
      const s = S();
      const settings = normSettings({ ...s.settings, ...patch });
      commit({ ...s, settings }, { type: 'settings', keys: Object.keys(patch) });
      return settings;
    },

    // whole-state
    replaceAll(raw) {
      const next = normalizeState(raw);
      commit(next, { type: 'replace' });
      flush();
      return next;
    },

    /** Back to defaults (keeps only the theme preference). */
    reset() {
      const s = S();
      const next = defaultState();
      next.settings.theme = s.settings.theme;
      commit(next, { type: 'reset' });
      flush();
    },

    /** Replace data with ~6 months of demo data. Leaves `onboarded`/theme/name as they are. */
    loadDemo(today = todayISO()) {
      const s = S();
      const demo = buildDemoState(today);
      demo.settings = { ...demo.settings, theme: s.settings.theme, onboarded: s.settings.onboarded, name: s.settings.name };
      commit(demo, { type: 'demo' });
      flush();
      return demo;
    },
  };
  return api;
}

export const store = createStore();

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------

function hashString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — tiny, good-enough seeded PRNG. */
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic (for a given `today`) demo: a single young professional in
 * Tel Aviv. Six calendar months ending in the current one; one vacation
 * month that overspends, a couple of strong saving months with freelance
 * income, and a pricier current month for food delivery.
 */
export function buildDemoState(today = todayISO()) {
  const rand = prng(hashString('maazan-demo:' + today));
  let idn = 0;
  const makeId = () => 'demo' + (++idn).toString(36).padStart(4, '0') + Math.floor(rand() * 1679616).toString(36);
  const r = (lo, hi) => lo + rand() * (hi - lo);
  const ri = (lo, hi) => Math.floor(r(lo, hi + 1));
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const shekels = (lo, hi, step = 0.1) => Math.round(Math.round(r(lo, hi) / step) * step * 100); // agorot
  const chance = (p) => rand() < p;

  const state = defaultState();
  const budgets = { groceries: 220000, dining: 120000, coffee: 35000, transport: 120000, clothing: 50000, leisure: 60000 };
  state.categories = state.categories.map((c) => (budgets[c.id] ? { ...c, budget: budgets[c.id] } : c));
  state.settings = { ...state.settings, savingsGoal: 250000, monthStartDay: 1 };

  const endKey = monthOf(today);
  const firstKey = addMonths(endKey, -5);
  const txs = [];
  const add = (date, type, categoryId, amount, note, payment = 'card') => {
    if (date > today || amount <= 0) return;
    const ts = fromISO(date).getTime() + ri(7, 22) * 3600e3 + ri(0, 59) * 60e3;
    txs.push({ id: makeId(), type, amount, categoryId, date, note, payment, createdAt: ts, updatedAt: ts });
  };

  // Recurring rules (materialized below through the same code path the app uses).
  state.recurring = [
    { type: 'expense', amount: 480000, categoryId: 'housing', note: 'שכר דירה', payment: 'transfer', day: 1 },
    { type: 'expense', amount: 42000, categoryId: 'utilities', note: 'ארנונה – עיריית תל אביב', payment: 'card', day: 2 },
    { type: 'expense', amount: 24900, categoryId: 'health', note: 'הולמס פלייס – מנוי חדר כושר', payment: 'card', day: 3 },
    { type: 'expense', amount: 5490, categoryId: 'subscriptions', note: 'נטפליקס', payment: 'card', day: 5 },
    { type: 'expense', amount: 2190, categoryId: 'subscriptions', note: 'ספוטיפיי', payment: 'card', day: 12 },
    { type: 'expense', amount: 5900, categoryId: 'telecom', note: 'פרטנר – סלולר', payment: 'card', day: 15 },
    { type: 'expense', amount: 10900, categoryId: 'telecom', note: 'HOT – אינטרנט', payment: 'card', day: 15 },
    { type: 'expense', amount: 13800, categoryId: 'insurance', note: 'הראל – ביטוח בריאות', payment: 'card', day: 20 },
  ].map((x) => ({ ...x, id: makeId(), startMonth: firstKey, endMonth: null, active: true, done: [] }));

  const VACATION = 2; // index of the vacation month (0 = oldest)
  const FREELANCE = new Set([1, 4]);
  const spendFactor = [1.0, 0.9, 1.05, 1.0, 0.85, 1.1];

  for (let mi = 0; mi < 6; mi++) {
    const mk = addMonths(firstKey, mi);
    const y = +mk.slice(0, 4);
    const m = +mk.slice(5, 7);
    const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const day = (d) => makeISO(y, m, d);
    const f = spendFactor[mi];
    const isCur = mk === endKey;
    const summer = m >= 6 && m <= 9;

    // income
    add(day(10), 'income', 'salary', shekels(14380, 14620, 1), 'משכורת', 'transfer');
    if (FREELANCE.has(mi)) add(day(ri(18, 26)), 'income', 'side', shekels(1800, 3400, 50), pick(['פרויקט פרילנס – עיצוב אתר', 'פרילנס – דף נחיתה', 'ייעוץ UX – לקוח פרטי']), 'transfer');
    if (mi === 3) add(day(ri(5, 25)), 'income', 'refunds', shekels(120, 260, 1), 'זיכוי – זארה', 'card');

    // groceries: 2–4 per week
    for (let d = 1; d <= dim; d++) {
      const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      const p = (wd === 4 || wd === 5 ? 0.45 : 0.25) * f;
      if (!chance(p)) continue;
      const big = wd === 4 || wd === 5;
      const shop = chance(0.6) ? 'שופרסל' : chance(0.6) ? 'רמי לוי' : pick(['AM:PM', 'יוחננוף', 'טיב טעם']);
      add(day(d), 'expense', 'groceries', big ? shekels(190, 420) : shekels(32, 150), shop, 'card');
    }
    if (chance(0.7)) add(day(ri(1, dim)), 'expense', 'groceries', shekels(60, 140, 1), 'שוק הכרמל', 'cash');

    // food delivery & restaurants (pricier in the current month)
    const woltN = Math.round(ri(4, 7) * (isCur ? 1.8 : f));
    for (let i = 0; i < woltN; i++) add(day(ri(1, dim)), 'expense', 'dining', shekels(58, 145), 'וולט', 'card');
    const restN = ri(1, 3) + (isCur ? 1 : 0);
    for (let i = 0; i < restN; i++) add(day(ri(1, dim)), 'expense', 'dining', shekels(140, 340, 1), pick(['ג׳ירף', 'מסעדת הסושי של אלנבי', 'בורגראנץ׳', 'מקס ברנר', 'פרונטו']), 'card');
    if (chance(0.6)) add(day(ri(1, dim)), 'expense', 'dining', shekels(60, 120, 1), 'ביט – ארוחה עם חברים', 'bit');

    // coffee
    const coffeeN = Math.round(ri(9, 14) * f);
    for (let i = 0; i < coffeeN; i++) add(day(ri(1, dim)), 'expense', 'coffee', shekels(14, 36), chance(0.65) ? 'ארומה' : pick(['קפה קפה', 'לנדוור', 'רולדין']), 'card');

    // transport
    const fuelN = ri(2, 3);
    for (let i = 0; i < fuelN; i++) add(day(ri(1, dim)), 'expense', 'transport', shekels(210, 330), pick(['פז', 'דלק', 'סונול', 'פז – Yellow']), 'card');
    add(day(ri(1, 6)), 'expense', 'transport', 22500, 'רב-קו – חופשי חודשי', 'card');
    for (let i = 0, n = ri(2, 5); i < n; i++) add(day(ri(1, dim)), 'expense', 'transport', shekels(9, 38), 'פנגו – חניה', 'card');

    // bi-monthly bills (odd months)
    if (m % 2 === 1) {
      add(day(ri(8, 14)), 'expense', 'utilities', shekels(summer ? 520 : 330, summer ? 690 : 450), 'חברת החשמל', 'card');
      add(day(ri(16, 22)), 'expense', 'utilities', shekels(110, 175), 'מי אביבים – מים', 'card');
    }

    // health & grooming
    if (chance(0.8)) add(day(ri(1, dim)), 'expense', 'grooming', shekels(45, 160), 'סופר-פארם', 'card');
    if (chance(0.3)) add(day(ri(1, dim)), 'expense', 'health', shekels(30, 90, 1), 'מכבי – השתתפות עצמית', 'card');
    if (chance(0.4)) add(day(ri(1, dim)), 'expense', 'grooming', shekels(70, 120, 10), 'מספרה', 'bit');

    // clothing
    for (let i = 0, n = Math.round(r(0, 2) * f); i < n; i++) add(day(ri(1, dim)), 'expense', 'clothing', shekels(120, 420, 10), pick(['זארה', 'קסטרו', 'H&M', 'נייקי', 'פוקס']), 'card');

    // leisure
    for (let i = 0, n = ri(1, 3); i < n; i++) add(day(ri(1, dim)), 'expense', 'leisure', shekels(60, 260, 1), pick(['סינמה סיטי', 'בר בפלורנטין', 'הופעה – בארבי', 'באולינג', 'כרטיסים – הבימה']), 'card');

    // gifts
    if (mi === 1 || mi === 4) add(day(ri(5, 25)), 'expense', 'gifts', mi === 1 ? 60000 : 50000, 'מתנה לחתונה', 'bit');
    if (chance(0.5)) add(day(ri(1, dim)), 'expense', 'gifts', shekels(90, 220, 10), pick(['מתנת יום הולדת', 'סטימצקי – ספר מתנה', 'פרחים']), 'card');

    // education
    if (mi === 2 || mi === 5) add(day(ri(1, dim)), 'expense', 'education', mi === 2 ? 4990 : 34900, mi === 2 ? 'Udemy – קורס פייתון' : 'סדנת צילום', 'card');

    // vacation
    if (mi === VACATION) {
      add(day(4), 'expense', 'travel', 189000, 'אל על – טיסה לאתונה', 'card');
      add(day(4), 'expense', 'travel', 236000, 'Booking – מלון באתונה', 'card');
      add(day(ri(14, 16)), 'expense', 'travel', shekels(650, 900, 10), 'מסעדות וסיורים ביוון', 'card');
      add(day(ri(14, 16)), 'expense', 'travel', 21000, 'ביטוח נסיעות', 'card');
      add(day(ri(17, 18)), 'expense', 'clothing', 38000, 'מזוודה – סמסונייט', 'card');
    }
  }

  state.transactions = txs;
  return materializeRecurring(state, today, { makeId, now: fromISO(today).getTime() + 20 * 3600e3 }).state;
}
