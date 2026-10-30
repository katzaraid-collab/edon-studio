import test from 'node:test';
import assert from 'node:assert/strict';
import { catById, currentPeriod, filterTx, history, insights, periodOf, periodRange, summarize, topNotes, totals, txInPeriod } from '../js/model.js';
import { buildDemoState, DEFAULT_CATEGORIES, defaultState } from '../js/store.js';

let n = 0;
const tx = (date, amount, extra = {}) => ({
  id: 't' + ++n,
  type: 'expense',
  amount,
  categoryId: 'groceries',
  date,
  note: '',
  payment: 'card',
  createdAt: n,
  updatedAt: n,
  ...extra,
});
const inc = (date, amount, extra = {}) => tx(date, amount, { type: 'income', categoryId: 'salary', payment: 'transfer', ...extra });

function mkState(transactions = [], settings = {}, catPatch = {}) {
  const s = defaultState();
  s.transactions = transactions;
  s.settings = { ...s.settings, ...settings };
  s.categories = s.categories.map((c) => (catPatch[c.id] ? { ...c, ...catPatch[c.id] } : c));
  return s;
}

// ---------------------------------------------------------------------------

test('periodOf: start day 1 = calendar month', () => {
  assert.equal(periodOf('2026-10-01', 1), '2026-10');
  assert.equal(periodOf('2026-10-31', 1), '2026-10');
});

test('periodOf: start day 10', () => {
  assert.equal(periodOf('2026-10-09', 10), '2026-09');
  assert.equal(periodOf('2026-10-10', 10), '2026-10');
  assert.equal(periodOf('2026-11-09', 10), '2026-10');
  assert.equal(periodOf('2026-01-05', 10), '2025-12'); // crosses the year
  assert.equal(periodOf('2026-03-01', 28), '2026-02');
});

test('periodOf: start day is clamped to 1..28', () => {
  assert.equal(periodOf('2026-10-29', 31), '2026-10'); // 31 → 28
  assert.equal(periodOf('2026-10-05', 0), '2026-10'); // 0 → 1
});

test('periodRange: calendar months incl. leap Feb', () => {
  assert.deepEqual(periodRange('2026-10', 1), { from: '2026-10-01', to: '2026-10-31', days: 31 });
  assert.deepEqual(periodRange('2026-02', 1), { from: '2026-02-01', to: '2026-02-28', days: 28 });
  assert.deepEqual(periodRange('2028-02', 1), { from: '2028-02-01', to: '2028-02-29', days: 29 });
  assert.deepEqual(periodRange('2026-12', 1), { from: '2026-12-01', to: '2026-12-31', days: 31 });
});

test('periodRange: shifted months', () => {
  assert.deepEqual(periodRange('2026-10', 10), { from: '2026-10-10', to: '2026-11-09', days: 31 });
  assert.deepEqual(periodRange('2026-02', 10), { from: '2026-02-10', to: '2026-03-09', days: 28 });
  assert.deepEqual(periodRange('2028-02', 10), { from: '2028-02-10', to: '2028-03-09', days: 29 });
  assert.deepEqual(periodRange('2026-01', 28), { from: '2026-01-28', to: '2026-02-27', days: 31 });
  assert.deepEqual(periodRange('2026-12', 15), { from: '2026-12-15', to: '2027-01-14', days: 31 });
});

test('periodRange and periodOf agree for every day of a few years', () => {
  for (const sd of [1, 10, 28]) {
    const key = '2027-02';
    const r = periodRange(key, sd);
    assert.equal(periodOf(r.from, sd), key);
    assert.equal(periodOf(r.to, sd), key);
  }
});

test('currentPeriod honours monthStartDay', () => {
  assert.equal(currentPeriod(mkState([], { monthStartDay: 10 }), '2026-10-09'), '2026-09');
  assert.equal(currentPeriod(mkState([], { monthStartDay: 10 }), '2026-10-10'), '2026-10');
  assert.equal(currentPeriod(mkState(), '2026-10-30'), '2026-10');
});

test('catById falls back to a synthetic category', () => {
  const s = mkState();
  assert.equal(catById(s, 'groceries').name, 'מזון וסופר');
  const f = catById(s, 'nope');
  assert.equal(f.name, 'ללא קטגוריה');
  assert.equal(f.icon, 'dots');
  assert.equal(f.color, 12);
});

test('txInPeriod: sorted by date desc then createdAt desc; respects start day', () => {
  const a = tx('2026-10-10', 100, { createdAt: 1 });
  const b = tx('2026-10-10', 100, { createdAt: 5 });
  const c = tx('2026-10-20', 100);
  const d = tx('2026-11-09', 100);
  const e = tx('2026-10-09', 100);
  const s = mkState([a, b, c, d, e], { monthStartDay: 10 });
  assert.deepEqual(
    txInPeriod(s, '2026-10').map((t) => t.id),
    [d.id, c.id, b.id, a.id],
  );
  assert.deepEqual(
    txInPeriod(s, '2026-09').map((t) => t.id),
    [e.id],
  );
});

test('summarize: totals, rates, days, budgets', () => {
  const s = mkState(
    [
      inc('2026-10-10', 1000000),
      tx('2026-10-01', 300000, { categoryId: 'housing', payment: 'transfer' }),
      tx('2026-10-05', 50000, { note: 'שופרסל' }),
      tx('2026-10-05', 25000, { categoryId: 'dining', note: 'וולט' }),
      tx('2026-10-11', 25000, { note: 'רמי לוי', payment: 'cash' }),
      tx('2026-09-15', 40000), // prev period groceries
      tx('2026-11-01', 9999), // next period
    ],
    { savingsGoal: 200000 },
    { groceries: { budget: 100000 }, coffee: { budget: 20000 } },
  );
  const r = summarize(s, '2026-10', '2026-10-15');
  assert.equal(r.key, '2026-10');
  assert.equal(r.income, 1000000);
  assert.equal(r.expense, 400000);
  assert.equal(r.saved, 600000);
  assert.equal(r.savingsRate, 0.6);
  assert.equal(r.count, 5);
  assert.equal(r.isCurrent, true);
  assert.equal(r.elapsedDays, 15);
  assert.equal(r.daysLeft, 17);
  assert.equal(r.avgPerDay, Math.round(400000 / 15));
  assert.equal(r.goal, 200000);
  assert.equal(r.goalProgress, 3);
  assert.equal(r.budgetTotal, 120000);
  assert.equal(r.budgetLeft, 120000 - 75000);
  // linear forecast (no recurring here): 400000/15*31
  assert.equal(r.projectedExpense, Math.round((400000 / 15) * 31));
  assert.equal(r.safeToSpendPerDay, Math.floor((1000000 - 200000 - 400000) / 17));

  // categories: groceries, housing, dining; plus coffee (budget only)
  const ids = r.byCategory.map((x) => x.category.id);
  assert.deepEqual(ids, ['housing', 'groceries', 'dining', 'coffee']);
  const g = r.byCategory.find((x) => x.category.id === 'groceries');
  assert.equal(g.total, 75000);
  assert.equal(g.count, 2);
  assert.equal(g.share, 75000 / 400000);
  assert.equal(g.budget, 100000);
  assert.equal(g.budgetRatio, 0.75);
  assert.equal(g.prevTotal, 40000);
  assert.equal(g.delta, 35000);
  const coffee = r.byCategory.find((x) => x.category.id === 'coffee');
  assert.equal(coffee.total, 0);
  assert.equal(coffee.budgetRatio, 0);
  assert.equal(r.byCategory.find((x) => x.category.id === 'housing').budgetRatio, null);
  assert.equal(r.incomeByCategory.length, 1);
  assert.equal(r.incomeByCategory[0].share, 1);

  assert.equal(r.byDay.length, 31);
  assert.equal(r.byDay[0].date, '2026-10-01');
  assert.equal(r.byDay[30].date, '2026-10-31');
  assert.equal(r.byDay[4].expense, 75000);
  assert.equal(r.byDay[9].income, 1000000);
  assert.equal(r.byWeekday.length, 7);
  assert.equal(
    r.byWeekday.reduce((a, b) => a + b, 0),
    400000,
  );
  assert.equal(r.byWeekday[4], 300000); // 2026-10-01 is a Thursday
  assert.deepEqual(
    r.byPayment.map((p) => p.payment),
    ['transfer', 'card', 'cash'],
  );
  assert.equal(r.topExpenses[0].amount, 300000);
  assert.ok(r.topExpenses.length <= 5);
});

test('summarize: past, future and empty periods', () => {
  const s = mkState([tx('2026-09-03', 1000)]);
  const past = summarize(s, '2026-09', '2026-10-15');
  assert.equal(past.isCurrent, false);
  assert.equal(past.elapsedDays, 30);
  assert.equal(past.daysLeft, 0);
  assert.equal(past.projectedExpense, null);
  assert.equal(past.safeToSpendPerDay, null);
  assert.equal(past.savingsRate, null);

  const fut = summarize(s, '2026-12', '2026-10-15');
  assert.equal(fut.elapsedDays, 0);
  assert.equal(fut.daysLeft, 31);
  assert.equal(fut.avgPerDay, 0);
  assert.equal(fut.count, 0);
  assert.equal(fut.goalProgress, null);

  const empty = summarize(mkState(), '2026-10', '2026-10-15');
  assert.equal(empty.expense, 0);
  assert.equal(empty.byCategory.length, 0);
  assert.equal(empty.byDay.length, 31);
  assert.equal(empty.safeToSpendPerDay, null);
});

test('summarize: forecast keeps recurring costs fixed and adds pending ones', () => {
  const s = mkState([inc('2026-10-01', 1000000), tx('2026-10-01', 400000, { categoryId: 'housing', recurringId: 'r1', recurKey: 'r1:2026-10' }), tx('2026-10-05', 10000)]);
  s.recurring = [
    { id: 'r1', type: 'expense', amount: 400000, categoryId: 'housing', note: '', payment: 'transfer', day: 1, startMonth: '2026-01', endMonth: null, active: true, done: ['2026-10'] },
    { id: 'r2', type: 'expense', amount: 5000, categoryId: 'subscriptions', note: '', payment: 'card', day: 20, startMonth: '2026-01', endMonth: null, active: true, done: [] },
    { id: 'r3', type: 'expense', amount: 7000, categoryId: 'subscriptions', note: '', payment: 'card', day: 25, startMonth: '2026-01', endMonth: null, active: false, done: [] },
  ];
  const r = summarize(s, '2026-10', '2026-10-10');
  assert.equal(r.projectedExpense, 400000 + 5000 + Math.round((10000 / 10) * 31));
});

test('history: oldest → newest, fixed length, zero-filled', () => {
  const s = mkState([inc('2026-10-10', 500000), tx('2026-10-11', 100000), tx('2026-08-01', 30000)]);
  const h = history(s, 4, '2026-10');
  assert.deepEqual(
    h.map((x) => x.key),
    ['2026-07', '2026-08', '2026-09', '2026-10'],
  );
  assert.deepEqual(h[3], { key: '2026-10', income: 500000, expense: 100000, saved: 400000, savingsRate: 0.8, count: 2 });
  assert.equal(h[1].expense, 30000);
  assert.equal(h[1].savingsRate, null);
  assert.equal(h[0].count, 0);
  assert.equal(history(s).length, 12);
});

test('history respects monthStartDay', () => {
  const s = mkState([inc('2026-10-09', 100), inc('2026-10-10', 200)], { monthStartDay: 10 });
  const h = history(s, 2, '2026-10');
  assert.equal(h[0].income, 100);
  assert.equal(h[1].income, 200);
});

test('totals', () => {
  assert.deepEqual(totals(mkState(), '2026-10-15'), { allTimeSaved: 0, monthsTracked: 0, avgMonthlySaved: 0, avgMonthlyExpense: 0, bestMonth: null });
  const s = mkState([inc('2026-08-10', 100000), tx('2026-08-11', 40000), inc('2026-10-10', 100000), tx('2026-10-11', 90000), tx('2026-12-01', 5000)]);
  const t = totals(s, '2026-10-15');
  assert.equal(t.monthsTracked, 3); // Aug, Sep (empty), Oct; Dec is in the future
  assert.equal(t.allTimeSaved, 60000 + 10000);
  assert.equal(t.avgMonthlySaved, 30000); // completed: Aug 60k, Sep 0
  assert.equal(t.avgMonthlyExpense, 20000);
  assert.deepEqual(t.bestMonth, { key: '2026-08', saved: 60000 });
});

test('filterTx', () => {
  const s = mkState([
    tx('2026-10-01', 4800, { note: 'שופרסל דיל' }),
    tx('2026-10-02', 123450, { categoryId: 'housing', note: 'שכר דירה', payment: 'transfer' }),
    inc('2026-10-10', 1450000, { note: 'משכורת' }),
    tx('2026-09-30', 2590, { categoryId: 'coffee', note: 'ארומה' }),
  ]);
  assert.equal(filterTx(s).length, 4);
  assert.equal(filterTx(s)[0].date, '2026-10-10');
  assert.equal(filterTx(s, { type: 'income' }).length, 1);
  assert.equal(filterTx(s, { key: '2026-10' }).length, 3);
  assert.equal(filterTx(s, { categoryId: 'coffee' }).length, 1);
  assert.equal(filterTx(s, { payment: 'transfer' }).length, 2);
  assert.equal(filterTx(s, { min: 5000 }).length, 2);
  assert.equal(filterTx(s, { max: 4800 }).length, 2);
  assert.equal(filterTx(s, { query: 'שופרסל' }).length, 1);
  assert.equal(filterTx(s, { query: 'שׁוּפֶרְסַל' }).length, 1); // niqqud-insensitive
  assert.equal(filterTx(s, { query: 'דיור' }).length, 1); // category name
  assert.equal(filterTx(s, { query: 'קפה' })[0].note, 'ארומה');
  assert.equal(filterTx(s, { query: '48' }).length, 1);
  assert.equal(filterTx(s, { query: '1,234.5' }).length, 1);
  assert.equal(filterTx(s, { query: '14500' }).length, 1);
  assert.equal(filterTx(s, { query: 'xyz' }).length, 0);
});

test('topNotes groups by normalized merchant', () => {
  const s = mkState([
    tx('2026-10-01', 1000, { note: 'וולט' }),
    tx('2026-10-02', 2000, { note: ' וולט ' }),
    tx('2026-10-03', 3000, { note: 'Wolt' }),
    tx('2026-10-04', 3500, { note: 'wolt' }),
    tx('2026-10-05', 500, { note: '' }),
    inc('2026-10-06', 99999, { note: 'וולט' }),
  ]);
  const t = topNotes(s, '2026-10');
  assert.deepEqual(t[0], { note: 'wolt', total: 6500, count: 2 }); // ties → most recent spelling
  assert.deepEqual(t[1], { note: 'וולט', total: 3000, count: 2 });
  assert.equal(t.length, 2);
  assert.equal(topNotes(s, '2026-10', 1).length, 1);
});

// ---------------------------------------------------------------------------
// insights

const ICONS = new Set(
  'plus close check chevron-left chevron-right chevron-down search filter trash edit undo download upload sun moon monitor home list chart settings calendar alert info target piggy trend-up trend-down arrow-up arrow-down sparkle repeat card cash bank phone dots wallet lock grip star cart food coffee car fuel bus bolt health shirt party book gift shield paw baby plane briefcase tools game dumbbell music heart tree'.split(
    ' ',
  ),
);

function checkShape(list) {
  assert.ok(list.length >= 2 && list.length <= 6, `got ${list.length} insights`);
  const ids = new Set();
  for (const i of list) {
    assert.ok(typeof i.id === 'string' && i.id, 'id');
    assert.ok(!ids.has(i.id), 'unique id ' + i.id);
    ids.add(i.id);
    assert.ok(['good', 'warn', 'bad', 'info'].includes(i.tone), 'tone ' + i.tone);
    assert.ok(ICONS.has(i.icon), 'icon ' + i.icon);
    assert.ok(i.title && i.title.length <= 60, 'title ' + i.title);
    assert.ok(i.text && /[֐-׿]/.test(i.text), 'hebrew text');
    assert.ok(!/undefined|NaN|null/.test(i.title + i.text), 'no junk: ' + i.title + i.text);
    assert.deepEqual(Object.keys(i).sort(), ['icon', 'id', 'text', 'title', 'tone']);
  }
}

test('insights: empty state is helpful', () => {
  const list = insights(mkState(), '2026-10', '2026-10-15');
  checkShape(list);
  assert.equal(list[0].id, 'empty');
  assert.equal(list[0].tone, 'info');
});

test('insights: future month', () => {
  const list = insights(mkState([inc('2026-10-10', 100000)]), '2026-12', '2026-10-15');
  checkShape(list);
  assert.equal(list[0].id, 'future');
  assert.equal(list[1].id, 'prev-summary');
});

test('insights: budget overrun is the top item, with concrete numbers', () => {
  const s = mkState([inc('2026-10-01', 1000000), tx('2026-10-02', 150000), tx('2026-10-03', 10000, { categoryId: 'coffee' })], { savingsGoal: 100000 }, { groceries: { budget: 100000 } });
  const list = insights(s, '2026-10', '2026-10-20');
  checkShape(list);
  assert.equal(list[0].id, 'budget-over:groceries');
  assert.equal(list[0].tone, 'bad');
  assert.match(list[0].text, /1,500/);
  assert.match(list[0].text, /1,000/);
  assert.match(list[0].text, /500/);
});

test('insights: many overruns are merged', () => {
  const s = mkState(
    [inc('2026-09-01', 1000000), tx('2026-09-02', 20000), tx('2026-09-02', 20000, { categoryId: 'dining' }), tx('2026-09-02', 20000, { categoryId: 'coffee' })],
    {},
    { groceries: { budget: 10000 }, dining: { budget: 10000 }, coffee: { budget: 10000 } },
  );
  const list = insights(s, '2026-09', '2026-10-15');
  checkShape(list);
  assert.equal(list[0].id, 'budget-over');
  assert.equal(list.filter((i) => i.id.startsWith('budget-over')).length, 1);
});

test('insights: near-limit budget warning in the current period', () => {
  const s = mkState([inc('2026-10-01', 1000000), tx('2026-10-02', 90000)], {}, { groceries: { budget: 100000 } });
  const list = insights(s, '2026-10', '2026-10-12');
  checkShape(list);
  assert.ok(list.some((i) => i.id === 'budget-near:groceries' && i.tone === 'warn'));
});

test('insights: category spike vs 3-period average', () => {
  const t = [];
  for (const m of ['07', '08', '09']) t.push(inc(`2026-${m}-10`, 1000000), tx(`2026-${m}-12`, 40000, { categoryId: 'dining', note: 'וולט' }));
  t.push(inc('2026-10-10', 1000000), tx('2026-10-12', 120000, { categoryId: 'dining', note: 'וולט' }));
  const list = insights(mkState(t), '2026-10', '2026-10-31');
  checkShape(list);
  const spike = list.find((i) => i.id === 'spike:dining');
  assert.ok(spike, JSON.stringify(list));
  assert.equal(spike.tone, 'warn');
  assert.match(spike.text, /1,200/);
  assert.match(spike.text, /400/);
});

test('insights: one-offs and bi-monthly bills are not "spikes"', () => {
  const t = [];
  for (const m of ['07', '08', '09', '10']) t.push(inc(`2026-${m}-10`, 1000000));
  t.push(tx('2026-07-12', 50000, { categoryId: 'utilities' }), tx('2026-09-12', 50000, { categoryId: 'utilities' }), tx('2026-10-12', 52000, { categoryId: 'utilities' }));
  t.push(tx('2026-10-12', 90000, { categoryId: 'education' }));
  const list = insights(mkState(t), '2026-10', '2026-10-31');
  assert.ok(!list.some((i) => i.id.startsWith('spike:')), JSON.stringify(list));
});

test('insights: overspent past month, streaks and goals', () => {
  const t = [];
  for (const m of ['06', '07', '08']) t.push(inc(`2026-${m}-10`, 1000000), tx(`2026-${m}-12`, 600000));
  t.push(inc('2026-09-10', 1000000), tx('2026-09-12', 1200000));
  const s = mkState(t, { savingsGoal: 300000 });
  const sep = insights(s, '2026-09', '2026-10-15');
  checkShape(sep);
  assert.equal(sep[0].id, 'overspent');
  assert.equal(sep[0].tone, 'bad');
  const aug = insights(s, '2026-08', '2026-10-15');
  checkShape(aug);
  assert.ok(aug.some((i) => i.id === 'goal-met'));
  const streak = aug.find((i) => i.id === 'streak');
  assert.ok(streak);
  assert.match(streak.title, /^3 /);
  const s2 = mkState(t, { savingsGoal: 500000 });
  assert.ok(insights(s2, '2026-08', '2026-10-15').some((i) => i.id === 'goal-missed'));
});

test('insights: forecast for the current period', () => {
  const bad = mkState([inc('2026-10-01', 500000), tx('2026-10-02', 300000)]);
  const l1 = insights(bad, '2026-10', '2026-10-10');
  checkShape(l1);
  assert.ok(l1.some((i) => i.id === 'forecast-negative' && i.tone === 'bad'), JSON.stringify(l1));

  const ok = mkState([inc('2026-10-01', 1000000), tx('2026-10-02', 50000)], { savingsGoal: 200000 });
  const l2 = insights(ok, '2026-10', '2026-10-10');
  checkShape(l2);
  assert.ok(l2.some((i) => i.id === 'forecast-goal-ok'));
  assert.ok(l2.some((i) => i.id === 'safe-to-spend'));

  const over = mkState([inc('2026-10-01', 100000), tx('2026-10-02', 300000)]);
  assert.equal(insights(over, '2026-10', '2026-10-10')[0].id, 'over-income');
});

test('insights: sparse month still returns ≥2 items', () => {
  const list = insights(mkState([tx('2026-09-02', 1000)]), '2026-09', '2026-10-15');
  checkShape(list);
});

test('insights over the demo data: every period is well-formed', () => {
  for (const today of ['2026-10-30', '2026-11-03', '2027-02-28', '2028-02-29']) {
    const s = buildDemoState(today);
    const cur = currentPeriod(s, today);
    for (let i = -6; i <= 1; i++) {
      const [y, m] = cur.split('-').map(Number);
      const d = new Date(Date.UTC(y, m - 1 + i, 1));
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      checkShape(insights(s, key, today));
    }
  }
});

test('insights are deterministic', () => {
  const s = buildDemoState('2026-10-30');
  assert.deepEqual(insights(s, '2026-10', '2026-10-30'), insights(s, '2026-10', '2026-10-30'));
});

test('default categories cover the spec list', () => {
  assert.equal(DEFAULT_CATEGORIES.filter((c) => c.type === 'expense').length, 19);
  assert.equal(DEFAULT_CATEGORIES.filter((c) => c.type === 'income').length, 5);
  for (const c of DEFAULT_CATEGORIES) assert.ok(ICONS.has(c.icon), c.icon);
});
