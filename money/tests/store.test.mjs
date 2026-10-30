import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDemoState, BACKUP_PREFIX, createStore, defaultState, materializeRecurring, memoryStorage, normalizeState, store, STORAGE_KEY } from '../js/store.js';
import { currentPeriod, history, summarize } from '../js/model.js';

const fresh = (opts = {}) => {
  const storage = opts.storage || memoryStorage();
  return { s: createStore({ storage, win: null, saveDelay: 5, ...opts }), storage };
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('default singleton imports in Node with an in-memory fallback', () => {
  assert.equal(store.state.version, 1);
  assert.equal(store.state.transactions.length, 0);
  assert.ok(store.state.categories.length > 20);
});

test('transactions: add / update / delete / restore + notifications', () => {
  const { s } = fresh();
  const changes = [];
  const off = s.subscribe((state, ch) => changes.push([ch.type, state.transactions.length]));
  const t = s.addTransaction({ amount: 4590, categoryId: 'coffee', note: '  ארומה ', date: '2026-10-30' });
  assert.equal(t.type, 'expense');
  assert.equal(t.payment, 'card');
  assert.equal(t.note, 'ארומה');
  assert.ok(t.id && t.createdAt && t.updatedAt);
  const before = s.state;
  const u = s.updateTransaction(t.id, { amount: 5000, note: 'קפה קפה' });
  assert.equal(u.amount, 5000);
  assert.notEqual(s.state, before, 'state is replaced immutably');
  assert.notEqual(s.state.transactions, before.transactions);
  assert.equal(before.transactions[0].amount, 4590, 'old snapshot untouched');
  assert.equal(s.updateTransaction('nope', { amount: 1 }), null);
  const removed = s.deleteTransaction(t.id);
  assert.equal(removed.id, t.id);
  assert.equal(s.state.transactions.length, 0);
  assert.equal(s.deleteTransaction(t.id), null);
  s.restoreTransaction(removed);
  assert.equal(s.state.transactions[0].id, t.id);
  assert.equal(s.restoreTransaction(removed), null, 'no duplicate restore');
  off();
  s.addTransaction({ amount: 1, date: '2026-10-30' });
  assert.deepEqual(
    changes.map((c) => c[0]),
    ['tx:add', 'tx:update', 'tx:delete', 'tx:restore'],
  );
});

test('transactions: validation', () => {
  const { s } = fresh();
  assert.throws(() => s.addTransaction({ amount: 0 }), RangeError);
  assert.throws(() => s.addTransaction({ amount: -5 }), RangeError);
  assert.throws(() => s.addTransaction({ amount: 'x' }), RangeError);
  assert.throws(() => s.addTransaction({ amount: 100, date: '2026-02-30' }), RangeError);
  const inc = s.addTransaction({ type: 'income', amount: 100, date: undefined });
  assert.equal(inc.payment, 'transfer');
  assert.equal(inc.categoryId, 'other-in');
  assert.match(inc.date, /^\d{4}-\d{2}-\d{2}$/);
  const x = s.addTransaction({ amount: 99.6, payment: 'weird' });
  assert.equal(x.amount, 100);
  assert.equal(x.payment, 'other');
  assert.equal(x.categoryId, 'misc');
});

test('categories: add / update / reorder / delete-or-archive', () => {
  const { s } = fresh();
  const c = s.addCategory({ name: ' קניות אונליין ', icon: 'cart', budget: 50000 });
  assert.equal(c.name, 'קניות אונליין');
  assert.equal(c.type, 'expense');
  assert.equal(c.order, s.state.categories.length - 1);
  assert.equal(s.updateCategory(c.id, { budget: 70000, name: '' }).budget, 70000);
  assert.equal(s.state.categories.find((x) => x.id === c.id).name, 'קניות אונליין');

  // unused → deleted
  assert.equal(s.deleteCategory(c.id), 'deleted');
  assert.ok(!s.state.categories.some((x) => x.id === c.id));

  // used → archived
  const d = s.addCategory({ name: 'זמני' });
  s.addTransaction({ amount: 100, categoryId: d.id });
  assert.equal(s.deleteCategory(d.id), 'archived');
  assert.equal(s.state.categories.find((x) => x.id === d.id).archived, true);

  // reassign → moves tx, then deletes
  const e = s.addCategory({ name: 'עוד' });
  const t = s.addTransaction({ amount: 100, categoryId: e.id });
  assert.equal(s.deleteCategory(e.id, 'groceries'), 'deleted');
  assert.equal(s.state.transactions.find((x) => x.id === t.id).categoryId, 'groceries');

  const ids = s.state.categories.map((x) => x.id);
  s.reorderCategories(['misc', 'groceries']);
  assert.deepEqual(
    s.state.categories.slice(0, 2).map((x) => x.id),
    ['misc', 'groceries'],
  );
  assert.equal(s.state.categories.length, ids.length);
  assert.deepEqual(
    s.state.categories.map((x) => x.order),
    s.state.categories.map((_, i) => i),
  );
});

test('recurring: materializes due months only, idempotent, day clamped', () => {
  const { s } = fresh();
  const rec = s.addRecurring({ amount: 480000, categoryId: 'housing', note: 'שכר דירה', day: 31, startMonth: '2026-01' }, '2026-03-15');
  // Jan 31, Feb 28 (clamped); Mar 31 is in the future
  let gen = s.state.transactions.filter((t) => t.recurringId === rec.id).map((t) => t.date).sort();
  assert.deepEqual(gen, ['2026-01-31', '2026-02-28']);
  assert.deepEqual(rec.done, ['2026-01', '2026-02']);
  assert.equal(s.applyRecurring('2026-03-15'), 0);
  assert.equal(s.applyRecurring('2026-03-31'), 1);
  assert.equal(s.applyRecurring('2026-03-31'), 0);
  // leap year Feb
  const r2 = s.addRecurring({ amount: 100, day: 30, startMonth: '2028-02' }, '2028-03-01');
  assert.deepEqual(
    s.state.transactions.filter((t) => t.recurringId === r2.id).map((t) => t.date),
    ['2028-02-29'],
  );
  // each generated tx carries recurKey
  for (const t of s.state.transactions.filter((t) => t.recurringId)) assert.equal(t.recurKey, `${t.recurringId}:${t.date.slice(0, 7)}`);
});

test('recurring: a deleted generated tx is not re-created', () => {
  const { s } = fresh();
  const rec = s.addRecurring({ amount: 5490, categoryId: 'subscriptions', note: 'נטפליקס', day: 5, startMonth: '2026-09' }, '2026-10-10');
  const oct = s.state.transactions.find((t) => t.recurKey === `${rec.id}:2026-10`);
  s.deleteTransaction(oct.id);
  assert.equal(s.applyRecurring('2026-10-20'), 0);
  assert.ok(!s.state.transactions.some((t) => t.recurKey === `${rec.id}:2026-10`));
});

test('recurring: start/end months and active flag', () => {
  const { s } = fresh();
  const r = s.addRecurring({ amount: 100, day: 1, startMonth: '2026-01', endMonth: '2026-03', active: false }, '2026-06-01');
  assert.equal(s.state.transactions.length, 0, 'inactive creates nothing');
  s.updateRecurring(r.id, { active: true }, '2026-06-01');
  assert.deepEqual(
    s.state.transactions.map((t) => t.date).sort(),
    ['2026-01-01', '2026-02-01', '2026-03-01'],
  );
  assert.equal(s.applyRecurring('2026-12-01'), 0, 'endMonth respected');
  const r2 = s.addRecurring({ amount: 100, day: 15, startMonth: '2026-08' }, '2026-06-01');
  assert.equal(s.state.transactions.filter((t) => t.recurringId === r2.id).length, 0, 'future start');
  assert.equal(s.applyRecurring('2026-08-15'), 1);
});

test('recurring: lost done[] does not duplicate (recurKey check)', () => {
  const st = defaultState();
  st.recurring = [{ id: 'r', type: 'expense', amount: 100, categoryId: 'misc', note: '', payment: 'card', day: 1, startMonth: '2026-10', endMonth: null, active: true, done: [] }];
  st.transactions = [{ id: 'x', type: 'expense', amount: 100, categoryId: 'misc', date: '2026-10-01', note: '', payment: 'card', recurringId: 'r', recurKey: 'r:2026-10', createdAt: 1, updatedAt: 1 }];
  const { state, created } = materializeRecurring(st, '2026-10-20');
  assert.equal(created, 0);
  assert.deepEqual(state.recurring[0].done, ['2026-10']);
  assert.equal(state.transactions.length, 1);
});

test('recurring: delete rule keeps history; removeFuture drops future-dated ones', () => {
  const { s } = fresh();
  const r = s.addRecurring({ amount: 100, day: 1, startMonth: '2026-09' }, '2026-10-05');
  s.addTransaction({ amount: 100, date: '2026-12-01', recurringId: r.id });
  s.deleteRecurring(r.id, { removeFuture: true }, '2026-10-05');
  assert.equal(s.state.recurring.length, 0);
  assert.deepEqual(
    s.state.transactions.map((t) => t.date).sort(),
    ['2026-09-01', '2026-10-01'],
  );
});

test('settings are sanitized', () => {
  const { s } = fresh();
  s.updateSettings({ monthStartDay: 31, savingsGoal: -250000, theme: 'neon', name: 'נועה' });
  assert.deepEqual(s.state.settings, { name: 'נועה', monthStartDay: 28, savingsGoal: 250000, theme: 'system', onboarded: false, demo: false });
  s.updateSettings({ monthStartDay: 10, theme: 'dark', onboarded: true });
  assert.equal(s.state.settings.monthStartDay, 10);
  assert.equal(s.state.settings.theme, 'dark');
});

test('demo data is flagged, and reset clears it but keeps the name', () => {
  const { s } = fresh();
  s.updateSettings({ name: 'אורי', theme: 'dark' });
  s.loadDemo('2026-10-30');
  assert.equal(s.state.settings.demo, true);
  assert.ok(s.state.transactions.length > 50);
  s.reset();
  assert.equal(s.state.settings.demo, false);
  assert.equal(s.state.transactions.length, 0);
  assert.equal(s.state.settings.name, 'אורי');
  assert.equal(s.state.settings.theme, 'dark');
});

test('demo data saved before the flag existed is still recognized', () => {
  const old = buildDemoState('2026-10-30');
  delete old.settings.demo;
  assert.equal(normalizeState(old).settings.demo, true);
  const real = { ...defaultState(), transactions: [{ id: 'abc', type: 'expense', amount: 100, categoryId: 'groceries', date: '2026-10-01', note: '', payment: 'card' }] };
  delete real.settings.demo;
  assert.equal(normalizeState(real).settings.demo, false);
});

test('persistence: debounced write, reload, corrupted backup', async () => {
  const storage = memoryStorage();
  const a = createStore({ storage, win: null, saveDelay: 5 });
  a.addTransaction({ amount: 1234, date: '2026-10-01' });
  a.addTransaction({ amount: 5678, date: '2026-10-02' });
  assert.equal(storage.getItem(STORAGE_KEY), null, 'not yet written (debounced)');
  await wait(20);
  const saved = JSON.parse(storage.getItem(STORAGE_KEY));
  assert.equal(saved.transactions.length, 2);

  const b = createStore({ storage, win: null });
  assert.equal(b.state.transactions.length, 2);
  assert.equal(b.loadIssue, null);

  storage.setItem(STORAGE_KEY, '{not json');
  const c = createStore({ storage, win: null });
  assert.equal(c.state.transactions.length, 0);
  assert.equal(c.loadIssue.type, 'corrupted');
  assert.ok(c.loadIssue.backupKey.startsWith(BACKUP_PREFIX));
  assert.equal(storage.getItem(c.loadIssue.backupKey), '{not json');
});

test('persistence: flush() writes immediately; quota error is reported', () => {
  const storage = memoryStorage();
  const a = createStore({ storage, win: null, saveDelay: 10000 });
  a.addTransaction({ amount: 100 });
  assert.equal(a.flush(), true);
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).transactions.length, 1);

  const broken = { ...memoryStorage(), setItem() {
    const e = new Error('full');
    e.name = 'QuotaExceededError';
    throw e;
  } };
  const b = createStore({ storage: broken, win: null });
  const seen = [];
  b.subscribe((_, ch) => seen.push(ch));
  b.addTransaction({ amount: 100 });
  assert.equal(b.flush(), false);
  assert.deepEqual(seen.at(-1), { type: 'persist-error', error: 'quota' });
});

test('cross-tab sync via storage events and flush on pagehide', async () => {
  const storage = memoryStorage();
  const listeners = {};
  const win = { addEventListener: (t, fn) => ((listeners[t] ||= []).push(fn)), document: null };
  const a = createStore({ storage, win, saveDelay: 10000 });
  const seen = [];
  a.subscribe((st, ch) => seen.push(ch.type));
  assert.equal(a.state.transactions.length, 0); // triggers init → listeners
  assert.ok(listeners.storage && listeners.pagehide);

  const other = defaultState();
  other.transactions.push({ id: 'o1', type: 'expense', amount: 999, categoryId: 'misc', date: '2026-10-01', note: 'מטאב אחר', payment: 'card', createdAt: 1, updatedAt: 1 });
  const json = JSON.stringify(other);
  storage.setItem(STORAGE_KEY, json);
  listeners.storage.forEach((fn) => fn({ key: STORAGE_KEY, newValue: json }));
  assert.equal(a.state.transactions[0].note, 'מטאב אחר');
  assert.deepEqual(seen, ['sync']);
  // garbage from another tab is ignored
  listeners.storage.forEach((fn) => fn({ key: STORAGE_KEY, newValue: '{oops' }));
  assert.equal(a.state.transactions.length, 1);
  // unrelated keys ignored
  listeners.storage.forEach((fn) => fn({ key: 'other', newValue: '{}' }));
  assert.deepEqual(seen, ['sync']);

  a.addTransaction({ amount: 5 });
  listeners.pagehide.forEach((fn) => fn());
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).transactions.length, 2);
});

test('a throwing subscriber does not break the store', () => {
  const { s } = fresh();
  const origError = console.error;
  console.error = () => {};
  try {
    let got = 0;
    s.subscribe(() => {
      throw new Error('boom');
    });
    s.subscribe(() => got++);
    s.addTransaction({ amount: 1 });
    assert.equal(got, 1);
  } finally {
    console.error = origError;
  }
});

test('normalizeState: validation & migration', () => {
  assert.throws(() => normalizeState(null));
  assert.throws(() => normalizeState([]));
  const st = normalizeState({
    transactions: [
      { id: 'a', type: 'expense', amount: 100.4, categoryId: 'misc', date: '2026-10-01' },
      { id: 'a', type: 'income', amount: -500, date: '2026-10-02', payment: 'bit' }, // dup id, negative amount
      { id: 'b', amount: 0, date: '2026-10-01' }, // dropped
      { id: 'c', amount: 100, date: '01/10/2026' }, // dropped
      'garbage',
    ],
    categories: [{ id: 'x', name: 'רק הוצאה', type: 'expense', color: 99 }],
    recurring: [{ amount: 100, day: 45, startMonth: 'bad', done: ['2026-01', 'x', '2026-01'] }],
    settings: { monthStartDay: '10', savingsGoal: '250000' },
  });
  assert.equal(st.version, 1);
  assert.equal(st.transactions.length, 2);
  assert.notEqual(st.transactions[0].id, st.transactions[1].id);
  assert.equal(st.transactions[0].amount, 100);
  assert.equal(st.transactions[1].amount, 500);
  assert.equal(st.transactions[1].categoryId, 'other-in'); // income defaults were added
  assert.equal(st.categories[0].color, 12);
  assert.ok(st.categories.some((c) => c.type === 'income'));
  assert.equal(st.recurring[0].day, 31);
  assert.deepEqual(st.recurring[0].done, ['2026-01']);
  assert.equal(st.settings.monthStartDay, 10);
  assert.equal(st.settings.savingsGoal, 250000);
});

test('replaceAll / reset / loadDemo', () => {
  const { s, storage } = fresh();
  s.updateSettings({ theme: 'dark', onboarded: true, name: 'דנה' });
  const demo = s.loadDemo('2026-10-30');
  assert.ok(demo.transactions.length > 200);
  assert.equal(s.state.settings.theme, 'dark');
  assert.equal(s.state.settings.onboarded, true, 'loadDemo leaves onboarded as is');
  assert.equal(s.state.settings.name, 'דנה');
  assert.equal(s.state.settings.savingsGoal, 250000);
  assert.ok(JSON.parse(storage.getItem(STORAGE_KEY)).transactions.length > 200, 'flushed');

  s.reset();
  assert.equal(s.state.transactions.length, 0);
  assert.equal(s.state.settings.theme, 'dark');
  assert.equal(s.state.settings.onboarded, false);

  s.replaceAll({ transactions: [{ amount: 100, date: '2026-10-01' }] });
  assert.equal(s.state.transactions.length, 1);
});

test('demo data: deterministic, realistic and consistent', () => {
  const today = '2026-10-30';
  const a = buildDemoState(today);
  const b = buildDemoState(today);
  assert.deepEqual(a, b, 'same today → same data');
  assert.notDeepEqual(buildDemoState('2026-10-29').transactions.slice(0, 20), a.transactions.slice(0, 20));

  assert.ok(a.transactions.every((t) => t.date <= today), 'no future transactions');
  assert.ok(a.transactions.every((t) => Number.isInteger(t.amount) && t.amount > 0));
  const ids = new Set(a.transactions.map((t) => t.id));
  assert.equal(ids.size, a.transactions.length, 'unique ids');
  const cats = new Set(a.categories.map((c) => c.id));
  assert.ok(a.transactions.every((t) => cats.has(t.categoryId)), 'valid categories');
  assert.deepEqual(normalizeState(a), a, 'demo already normalized');

  const cur = currentPeriod(a, today);
  const h = history(a, 6, cur);
  assert.ok(h.every((p) => p.count > 0), 'six months of data');
  assert.equal(history(a, 7, cur)[0].count, 0, 'nothing before');
  assert.ok(h.some((p) => p.saved < 0), 'an overspending month');
  assert.ok(h.filter((p) => p.saved >= 250000).length >= 2, 'some months beat the goal');
  for (const p of h) {
    assert.ok(p.income >= 1400000 && p.income < 1900000, 'salary ± freelance: ' + p.income);
    assert.ok(p.expense > 800000 && p.expense < 2200000, 'expense: ' + p.expense);
  }
  assert.ok(a.recurring.length >= 6);
  assert.ok(a.recurring.every((r) => r.done.length === 6), 'recurring done for all 6 months');
  assert.ok(a.categories.filter((c) => c.budget > 0).length >= 4);
  const sum = summarize(a, cur, today);
  assert.ok(sum.byCategory.length >= 8);

  // notes look like real merchants
  const notes = new Set(a.transactions.map((t) => t.note));
  for (const n of ['שופרסל', 'וולט', 'ארומה', 'שכר דירה', 'משכורת', 'נטפליקס', 'ספוטיפיי']) assert.ok(notes.has(n), n);

  // early in the month: only what's already happened
  const early = buildDemoState('2026-11-01');
  assert.ok(early.transactions.every((t) => t.date <= '2026-11-01'));
  assert.ok(early.transactions.some((t) => t.date === '2026-11-01'));
});
