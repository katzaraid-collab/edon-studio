// מאזן — pure calculations over State. No DOM, no storage; `today` is
// injectable everywhere so everything is deterministic under test.
//
// Results are memoized per `state.transactions` array identity (the store
// replaces arrays immutably on every mutation), so repeated calls from
// several views during one render are cheap.

import { addDays, addMonths, diffDays, fmtDate, fmtMoney, fmtMonth, fmtPct, makeISO, MONTHS, normalizeText, todayISO, weekdayOf, WEEKDAYS } from './format.js';

function clampStartDay(startDay) {
  const n = Math.trunc(Number(startDay));
  return Number.isFinite(n) ? Math.min(28, Math.max(1, n)) : 1;
}

const startDayOf = (state) => clampStartDay(state?.settings?.monthStartDay ?? 1);

// ---------------------------------------------------------------------------
// Periods
// ---------------------------------------------------------------------------

/**
 * Budget period (month key) a date belongs to. A period is labeled by the
 * calendar month it STARTS in: with startDay 10, 2026-10-09 → '2026-09' and
 * 2026-10-10 → '2026-10'.
 */
export function periodOf(iso, startDay = 1) {
  const sd = clampStartDay(startDay);
  const key = iso.slice(0, 7);
  if (sd === 1) return key;
  return +iso.slice(8, 10) >= sd ? key : addMonths(key, -1);
}

/** Inclusive date range of a period: {from, to, days}. */
export function periodRange(key, startDay = 1) {
  const sd = clampStartDay(startDay);
  const [y, m] = [+key.slice(0, 4), +key.slice(5, 7)];
  const from = makeISO(y, m, sd);
  const next = addMonths(key, 1);
  const to = addDays(makeISO(+next.slice(0, 4), +next.slice(5, 7), sd), -1);
  return { from, to, days: diffDays(to, from) + 1 };
}

export function currentPeriod(state, today = todayISO()) {
  return periodOf(today, startDayOf(state));
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export const UNCATEGORIZED = Object.freeze({
  id: '__none__',
  name: 'ללא קטגוריה',
  type: 'expense',
  icon: 'dots',
  color: 12,
  budget: 0,
  archived: false,
  order: 9999,
});

const catIndex = new WeakMap();
function catMap(state) {
  const cats = state.categories || [];
  let m = catIndex.get(cats);
  if (!m) {
    m = new Map(cats.map((c) => [c.id, c]));
    catIndex.set(cats, m);
  }
  return m;
}

/** Category by id; falls back to a synthetic "ללא קטגוריה". */
export function catById(state, id) {
  return catMap(state).get(id) || { ...UNCATEGORIZED, id: id ?? UNCATEGORIZED.id };
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

function byDateDesc(a, b) {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return (b.createdAt || 0) - (a.createdAt || 0);
}

function inRange(tx, range) {
  return tx.date >= range.from && tx.date <= range.to;
}

/** Transactions of a period, newest first (date desc, then createdAt desc). */
export function txInPeriod(state, key) {
  const range = periodRange(key, startDayOf(state));
  return (state.transactions || []).filter((t) => inRange(t, range)).sort(byDateDesc);
}

/** Per-period income/expense totals for all transactions (memoized). */
const aggMemo = new WeakMap();
function aggregate(state) {
  const txs = state.transactions || [];
  const sd = startDayOf(state);
  const hit = aggMemo.get(txs);
  if (hit && hit.sd === sd) return hit.map;
  const map = new Map();
  for (const t of txs) {
    const k = periodOf(t.date, sd);
    let a = map.get(k);
    if (!a) map.set(k, (a = { income: 0, expense: 0, count: 0 }));
    a[t.type === 'income' ? 'income' : 'expense'] += t.amount;
    a.count++;
  }
  aggMemo.set(txs, { sd, map });
  return map;
}

function periodTotals(state, key) {
  return aggregate(state).get(key) || { income: 0, expense: 0, count: 0 };
}

function sumBy(list, fn) {
  let s = 0;
  for (const x of list) s += fn(x);
  return s;
}

/** Per-category totals for a list of transactions of one type. */
function totalsByCategory(list, type) {
  const m = new Map();
  for (const t of list) {
    if (t.type !== type) continue;
    const e = m.get(t.categoryId) || { total: 0, count: 0 };
    e.total += t.amount;
    e.count++;
    m.set(t.categoryId, e);
  }
  return m;
}

/** Recurring rules expected to post in [from, to] that haven't materialized yet. */
function pendingRecurring(state, range, today) {
  const out = [];
  for (const r of state.recurring || []) {
    if (!r.active) continue;
    // calendar months touched by the range
    const firstMonth = range.from.slice(0, 7);
    const lastMonth = range.to.slice(0, 7);
    for (let mk = firstMonth; mk <= lastMonth; mk = addMonths(mk, 1)) {
      if (mk < r.startMonth || (r.endMonth && mk > r.endMonth)) continue;
      if ((r.done || []).includes(mk)) continue;
      const date = makeISO(+mk.slice(0, 4), +mk.slice(5, 7), r.day);
      if (date > today && date >= range.from && date <= range.to) out.push({ ...r, date });
    }
  }
  return out;
}

/**
 * Everything a dashboard needs about one period.
 * Days: `elapsedDays` counts days up to and including today (all days for a
 * past period, 0 for a future one); `daysLeft` counts today through the end
 * (0 for a past period), so for the current period they overlap on today.
 */
export function summarize(state, key, today = todayISO()) {
  const sd = startDayOf(state);
  const range = periodRange(key, sd);
  const list = txInPeriod(state, key);
  const expenses = list.filter((t) => t.type === 'expense');
  const incomes = list.filter((t) => t.type === 'income');
  const income = sumBy(incomes, (t) => t.amount);
  const expense = sumBy(expenses, (t) => t.amount);
  const saved = income - expense;

  const isCurrent = today >= range.from && today <= range.to;
  const isPast = today > range.to;
  const elapsedDays = isPast ? range.days : isCurrent ? diffDays(today, range.from) + 1 : 0;
  const daysLeft = isPast ? 0 : isCurrent ? diffDays(range.to, today) + 1 : range.days;

  // Forecast: fixed (recurring) costs as-is + known pending recurring, and the
  // variable part extrapolated linearly over the whole period.
  let projectedExpense = null;
  if (isCurrent) {
    const fixed = sumBy(expenses, (t) => (t.recurringId ? t.amount : 0));
    const variable = expense - fixed;
    const pending = sumBy(
      pendingRecurring(state, range, today).filter((r) => r.type === 'expense'),
      (r) => r.amount,
    );
    projectedExpense = Math.round(fixed + pending + (variable / Math.max(1, elapsedDays)) * range.days);
  }

  const goal = Math.max(0, Math.round(state.settings?.savingsGoal || 0));

  // categories
  const prevKey = addMonths(key, -1);
  const prevList = txInPeriod(state, prevKey);
  const curExp = totalsByCategory(list, 'expense');
  const curInc = totalsByCategory(list, 'income');
  const prevExp = totalsByCategory(prevList, 'expense');
  const prevInc = totalsByCategory(prevList, 'income');

  const build = (type, cur, prev, base) => {
    const ids = new Set(cur.keys());
    if (type === 'expense') {
      for (const c of state.categories || []) {
        if (c.type === 'expense' && !c.archived && c.budget > 0) ids.add(c.id);
      }
    }
    const rows = [];
    for (const id of ids) {
      const category = catById(state, id);
      const { total = 0, count = 0 } = cur.get(id) || {};
      const budget = type === 'expense' ? Math.max(0, category.budget || 0) : 0;
      const prevTotal = prev.get(id)?.total || 0;
      rows.push({
        category,
        total,
        count,
        share: base > 0 ? total / base : 0,
        budget,
        budgetRatio: budget > 0 ? total / budget : null,
        prevTotal,
        delta: total - prevTotal,
        deltaRatio: prevTotal > 0 ? (total - prevTotal) / prevTotal : null,
      });
    }
    rows.sort((a, b) => b.total - a.total || b.budget - a.budget || (a.category.order ?? 0) - (b.category.order ?? 0));
    return rows;
  };
  const byCategory = build('expense', curExp, prevExp, expense);
  const incomeByCategory = build('income', curInc, prevInc, income);

  const budgetTotal = sumBy(byCategory, (r) => r.budget);
  const budgetSpent = sumBy(byCategory, (r) => (r.budget > 0 ? r.total : 0));

  // by day / weekday / payment
  const dayMap = new Map();
  for (let d = range.from; d <= range.to; d = addDays(d, 1)) dayMap.set(d, { date: d, expense: 0, income: 0 });
  const byWeekday = [0, 0, 0, 0, 0, 0, 0];
  const payMap = new Map();
  for (const t of list) {
    const row = dayMap.get(t.date);
    if (row) row[t.type === 'income' ? 'income' : 'expense'] += t.amount;
    if (t.type === 'expense') {
      byWeekday[weekdayOf(t.date)] += t.amount;
      payMap.set(t.payment, (payMap.get(t.payment) || 0) + t.amount);
    }
  }
  const byPayment = [...payMap.entries()]
    .map(([payment, total]) => ({ payment, total, share: expense > 0 ? total / expense : 0 }))
    .sort((a, b) => b.total - a.total);

  const topExpenses = [...expenses].sort((a, b) => b.amount - a.amount || byDateDesc(a, b)).slice(0, 5);

  let safeToSpendPerDay = null;
  if (income > 0 && daysLeft > 0) safeToSpendPerDay = Math.floor((income - goal - expense) / daysLeft);

  return {
    key,
    range,
    isCurrent,
    income,
    expense,
    saved,
    savingsRate: income > 0 ? saved / income : null,
    count: list.length,
    avgPerDay: elapsedDays > 0 ? Math.round(expense / elapsedDays) : 0,
    elapsedDays,
    daysLeft,
    projectedExpense,
    goal,
    goalProgress: goal > 0 ? saved / goal : null,
    budgetTotal,
    budgetLeft: budgetTotal - budgetSpent,
    byCategory,
    incomeByCategory,
    byDay: [...dayMap.values()],
    byWeekday,
    byPayment,
    topExpenses,
    safeToSpendPerDay,
  };
}

/** Last `n` periods ending at endKey, oldest → newest. */
export function history(state, n = 12, endKey = currentPeriod(state)) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const key = addMonths(endKey, -i);
    const { income, expense, count } = periodTotals(state, key);
    const saved = income - expense;
    out.push({ key, income, expense, saved, savingsRate: income > 0 ? saved / income : null, count });
  }
  return out;
}

/**
 * All-time numbers. Periods are counted from the first period with data up
 * to the current one. Averages use completed periods when there are any.
 */
export function totals(state, today = todayISO()) {
  const agg = aggregate(state);
  const cur = currentPeriod(state, today);
  const keys = [...agg.keys()].filter((k) => k <= cur).sort();
  if (!keys.length) return { allTimeSaved: 0, monthsTracked: 0, avgMonthlySaved: 0, avgMonthlyExpense: 0, bestMonth: null };

  const span = [];
  for (let k = keys[0]; k <= cur; k = addMonths(k, 1)) {
    const a = agg.get(k) || { income: 0, expense: 0 };
    span.push({ key: k, saved: a.income - a.expense, expense: a.expense });
  }
  const allTimeSaved = sumBy(span, (p) => p.saved);
  const completed = span.filter((p) => p.key < cur);
  const base = completed.length ? completed : span;
  let bestMonth = null;
  for (const p of span) {
    if ((agg.get(p.key)?.count || 0) === 0) continue;
    if (!bestMonth || p.saved > bestMonth.saved) bestMonth = { key: p.key, saved: p.saved };
  }
  return {
    allTimeSaved,
    monthsTracked: span.length,
    avgMonthlySaved: Math.round(sumBy(base, (p) => p.saved) / base.length),
    avgMonthlyExpense: Math.round(sumBy(base, (p) => p.expense) / base.length),
    bestMonth,
  };
}

// ---------------------------------------------------------------------------
// Search & grouping
// ---------------------------------------------------------------------------

function amountText(agorot) {
  const sh = agorot / 100;
  return Number.isInteger(sh) ? String(sh) : sh.toFixed(2);
}

/**
 * Filter transactions. `query` matches the note, the category name and the
 * amount ("48", "48.5", "1,200"). min/max are agorot. key = period or null.
 */
export function filterTx(state, { query = '', type = 'all', categoryId = null, payment = null, key = null, min = null, max = null } = {}) {
  let list = key ? txInPeriod(state, key) : [...(state.transactions || [])].sort(byDateDesc);
  if (type === 'expense' || type === 'income') list = list.filter((t) => t.type === type);
  if (categoryId) list = list.filter((t) => t.categoryId === categoryId);
  if (payment) list = list.filter((t) => t.payment === payment);
  if (min != null && Number.isFinite(+min)) list = list.filter((t) => t.amount >= +min);
  if (max != null && Number.isFinite(+max)) list = list.filter((t) => t.amount <= +max);

  const q = normalizeText(query);
  if (q) {
    const numeric = /^[\d\s.,₪]+$/.test(String(query).trim()) ? String(query).replace(/[^\d.]/g, '').replace(/\.$/, '') : null;
    const tokens = q.split(' ');
    list = list.filter((t) => {
      if (numeric && amountText(t.amount).includes(numeric)) return true;
      const hay = normalizeText(`${t.note} ${catById(state, t.categoryId).name}`);
      return tokens.every((tok) => hay.includes(tok));
    });
  }
  return list;
}

/** "Where it went": expenses grouped by normalized note (merchant). */
export function topNotes(state, key, n = 5) {
  const list = key ? txInPeriod(state, key) : state.transactions || [];
  const groups = new Map();
  for (const t of list) {
    if (t.type !== 'expense') continue;
    const norm = normalizeText(t.note);
    if (!norm) continue;
    let g = groups.get(norm);
    if (!g) groups.set(norm, (g = { total: 0, count: 0, forms: new Map() }));
    g.total += t.amount;
    g.count++;
    const form = String(t.note).trim().replace(/\s+/g, ' ');
    g.forms.set(form, (g.forms.get(form) || 0) + 1);
  }
  return [...groups.values()]
    .map((g) => {
      let note = '';
      let best = -1;
      for (const [form, c] of g.forms) if (c > best) [note, best] = [form, c];
      return { note, total: g.total, count: g.count };
    })
    .sort((a, b) => b.total - a.total || b.count - a.count)
    .slice(0, n);
}

// ---------------------------------------------------------------------------
// Insights
// ---------------------------------------------------------------------------

// Insight texts read better in whole shekels.
const money = (a) => fmtMoney(Math.round(a / 100) * 100, { decimals: 0 });
const pct = (r) => fmtPct(r);

function joinHe(items) {
  if (items.length <= 1) return items.join('');
  return items.slice(0, -1).join(', ') + ' וגם ' + items[items.length - 1];
}

function countLabel(n, one, many) {
  return n === 1 ? one : `${n} ${many}`;
}

/** Average per-category expense over the `n` periods before `key` that have data. */
function categoryBaseline(state, key, n = 3) {
  const periods = [];
  for (let i = 1; i <= n; i++) {
    const k = addMonths(key, -i);
    if (periodTotals(state, k).count > 0) periods.push(k);
  }
  const per = new Map(); // id → totals per baseline period (0 when absent)
  periods.forEach((k, i) => {
    for (const [id, { total }] of totalsByCategory(txInPeriod(state, k), 'expense')) {
      if (!per.has(id)) per.set(id, new Array(periods.length).fill(0));
      per.get(id)[i] = total;
    }
  });
  const stats = new Map();
  for (const [id, arr] of per) {
    stats.set(id, {
      avg: arr.reduce((a, b) => a + b, 0) / arr.length,
      min: Math.min(...arr),
      max: Math.max(...arr),
      present: arr.filter((x) => x > 0).length,
    });
  }
  return { periods: periods.length, stats };
}

/**
 * 2–6 short Hebrew observations about a period, most important first.
 * Each: {id, tone:'good'|'warn'|'bad'|'info', icon, title, text}.
 */
export function insights(state, key = currentPeriod(state), today = todayISO()) {
  const s = summarize(state, key, today);
  const monthName = fmtMonth(key).split(' ')[0];
  const isCurrent = s.isCurrent;
  const isFuture = s.range.from > today;
  const isPast = !isCurrent && !isFuture;
  const out = [];
  const add = (score, id, tone, icon, title, text) => out.push({ score, id, tone, icon, title, text });

  const prevHist = history(state, 6, addMonths(key, -1)).filter((p) => p.count > 0);

  // --- empty period --------------------------------------------------------
  if (s.count === 0) {
    if (isFuture) {
      add(50, 'future', 'info', 'calendar', 'החודש הזה עוד לא התחיל', `הוא מתחיל ב-${+s.range.from.slice(8, 10)} ב${MONTHS[+s.range.from.slice(5, 7) - 1]}, והוצאות קבועות יירשמו בו אוטומטית כשיגיע מועדן.`);
    } else {
      add(
        50,
        'empty',
        'info',
        'info',
        `עוד אין תנועות ב${monthName}`,
        isCurrent ? 'הוסיפו הוצאה או הכנסה ראשונה, ותוך כמה ימים יופיעו כאן תובנות על ההרגלים שלכם.' : 'לא נרשמו הוצאות או הכנסות בחודש הזה, אז אין עדיין מה לנתח.',
      );
    }
    const last = prevHist[prevHist.length - 1];
    if (last) {
      add(
        40,
        'prev-summary',
        'info',
        'chart',
        last.saved >= 0 ? `ב${fmtMonth(last.key).split(' ')[0]} חסכתם ${money(last.saved)}` : `${fmtMonth(last.key).split(' ')[0]} נסגר במינוס`,
        last.saved >= 0
          ? `נכנסו ${money(last.income)} ויצאו ${money(last.expense)}, כך שנשארו ${money(last.saved)} בצד.`
          : `נכנסו ${money(last.income)} ויצאו ${money(last.expense)}: חודש שנסגר במינוס של ${money(-last.saved)}.`,
      );
    } else if (!s.goal) {
      add(30, 'tip-goal', 'info', 'target', 'כדאי להגדיר יעד חיסכון', 'עם יעד חודשי (למשל 1,000 ₪) נוכל להראות כמה בדיוק אפשר להוציא בכל יום.');
    } else {
      add(30, 'tip-recurring', 'info', 'repeat', 'הוסיפו הוצאות קבועות', 'שכר דירה, מנויים וחשבונות יירשמו לבד בכל חודש, כדי שלא תצטרכו לזכור.');
    }
    return finalize(out, s, monthName);
  }

  // --- budgets -------------------------------------------------------------
  const budgeted = s.byCategory.filter((r) => r.budget > 0);
  const over = budgeted.filter((r) => r.total > r.budget).sort((a, b) => b.total - b.budget - (a.total - a.budget));
  const flagged = new Set();
  if (over.length >= 3) {
    const sumOver = sumBy(over, (r) => r.total - r.budget);
    add(100, 'budget-over', 'bad', 'alert', `חריגה ב-${over.length} תקציבים`, `${joinHe(over.map((r) => r.category.name))} עברו את התקרה, ויחד הן ${money(sumOver)} מעל התכנון.`);
    over.forEach((r) => flagged.add(r.category.id));
  } else {
    for (const r of over) {
      flagged.add(r.category.id);
      add(
        96 + Math.min(4, r.budgetRatio - 1),
        `budget-over:${r.category.id}`,
        'bad',
        'alert',
        `חריגה בתקציב ${r.category.name}`,
        `הוצאתם ${money(r.total)} מתוך ${money(r.budget)}, כלומר ${money(r.total - r.budget)} מעל התקציב (${pct(r.budgetRatio - 1)}).`,
      );
    }
  }
  if (isCurrent) {
    const elapsedFrac = s.elapsedDays / s.range.days;
    const near = budgeted
      .filter((r) => !flagged.has(r.category.id))
      .map((r) => ({ r, pace: r.budgetRatio - elapsedFrac }))
      .filter(({ r, pace }) => r.budgetRatio >= 0.8 || (r.budgetRatio >= 0.5 && pace >= 0.25))
      .sort((a, b) => b.r.budgetRatio - a.r.budgetRatio)
      .slice(0, 2);
    for (const { r } of near) {
      flagged.add(r.category.id);
      const left = r.budget - r.total;
      if (r.budgetRatio >= 0.8) {
        add(
          80 + r.budgetRatio * 10,
          `budget-near:${r.category.id}`,
          'warn',
          'alert',
          `מתקרבים לתקרה ב${r.category.name}`,
          `נוצלו ${pct(r.budgetRatio)} מהתקציב ונשארו ${money(left)} ל-${countLabel(s.daysLeft, 'יום אחד', 'הימים')} שנותרו.`,
        );
      } else {
        add(
          74,
          `budget-pace:${r.category.id}`,
          'warn',
          'trend-up',
          `קצב מהיר ב${r.category.name}`,
          `כבר נוצלו ${pct(r.budgetRatio)} מהתקציב, אף שעברו רק ${pct(elapsedFrac)} מהחודש.`,
        );
      }
    }
  } else if (isPast && budgeted.length >= 2 && over.length === 0) {
    add(58, 'budgets-kept', 'good', 'check', 'כל התקציבים נשמרו', `כל ${budgeted.length} הקטגוריות המתוקצבות נשארו מתחת לתקרה, עם ${money(s.budgetLeft)} שלא נוצלו.`);
  }

  // --- category spikes / drops vs 3-period average -------------------------
  const base = categoryBaseline(state, key, 3);
  if (base.periods >= 2) {
    const spikes = [];
    const drops = [];
    // Require a category to be a regular (present in ≥2 baseline periods) and
    // to beat the baseline's max/min, so one-offs and bi-monthly bills don't
    // read as trends.
    for (const r of s.byCategory) {
      const st = base.stats.get(r.category.id);
      if (!st || st.avg <= 0 || st.present < 2) continue;
      const { avg } = st;
      const diff = r.total - avg;
      if (r.total / avg >= 1.3 && r.total > st.max * 1.15 && diff >= Math.max(15000, avg * 0.3)) spikes.push({ r, avg, diff });
      if ((isPast || s.elapsedDays / s.range.days >= 0.9) && r.total / avg <= 0.7 && r.total < st.min * 0.85 && -diff >= 20000) drops.push({ r, avg, diff });
    }
    spikes.sort((a, b) => b.diff - a.diff);
    for (const { r, avg, diff } of spikes.filter((x) => !flagged.has(x.r.category.id)).slice(0, 2)) {
      add(
        70 + Math.min(15, (r.total / avg) * 3),
        `spike:${r.category.id}`,
        'warn',
        'trend-up',
        `עלייה בהוצאות על ${r.category.name}`,
        `${isCurrent ? 'כבר ' : ''}${money(r.total)} ב${monthName}, לעומת ממוצע של ${money(Math.round(avg))} בחודשים הקודמים (${fmtPct(diff / avg, { sign: true })}).`,
      );
    }
    drops.sort((a, b) => a.diff - b.diff);
    for (const { r, avg, diff } of drops.slice(0, 1)) {
      add(
        54,
        `drop:${r.category.id}`,
        'good',
        'trend-down',
        `ירידה בהוצאות על ${r.category.name}`,
        `${money(r.total)} לעומת ממוצע של ${money(Math.round(avg))}, חיסכון של ${money(Math.round(-diff))} בקטגוריה הזאת.`,
      );
    }
  }

  // --- savings -------------------------------------------------------------
  const avgRates = prevHist.slice(-3).filter((p) => p.savingsRate != null);
  const avgRate = avgRates.length >= 2 ? sumBy(avgRates, (p) => p.savingsRate) / avgRates.length : null;
  if (isPast) {
    if (s.income > 0 || s.expense > 0) {
      if (s.saved < 0) {
        add(95, 'overspent', 'bad', 'alert', `${monthName} נסגר במינוס`, `ההוצאות (${money(s.expense)}) עלו על ההכנסות (${money(s.income)}) ב-${money(-s.saved)}.`);
      } else if (s.goal > 0 && s.saved >= s.goal) {
        add(76, 'goal-met', 'good', 'target', 'עמדתם ביעד החיסכון', `חסכתם ${money(s.saved)}${s.saved > s.goal ? `, ${money(s.saved - s.goal)} מעל היעד של ${money(s.goal)}` : ', בדיוק לפי היעד'}.`);
      } else if (s.goal > 0) {
        add(72, 'goal-missed', 'warn', 'target', `חסרו ${money(s.goal - s.saved)} ליעד`, `חסכתם ${money(s.saved)} מתוך יעד של ${money(s.goal)} (${pct(s.saved / s.goal)}).`);
      }
    }
    if (avgRate != null && s.savingsRate != null && s.saved >= 0) {
      const d = s.savingsRate - avgRate;
      if (d >= 0.05) add(62, 'rate-up', 'good', 'piggy', 'שיעור חיסכון גבוה מהרגיל', `${pct(s.savingsRate)} מההכנסה נשארו בצד, לעומת ממוצע של ${pct(avgRate)} בחודשים שלפני.`);
      else if (d <= -0.05) add(64, 'rate-down', 'warn', 'piggy', 'נחסך פחות מהרגיל', `${pct(s.savingsRate)} מההכנסה נשארו בצד, לעומת ממוצע של ${pct(avgRate)} בחודשים שלפני.`);
    }
  } else if (isCurrent) {
    const soFar = s.income - s.expense;
    if (s.income > 0 && soFar < 0) {
      add(94, 'over-income', 'bad', 'alert', 'ההוצאות כבר עברו את ההכנסות', `יצאו ${money(s.expense)} מול הכנסות של ${money(s.income)} עד עכשיו, מינוס של ${money(-soFar)}.`);
    } else if (s.income > 0 && s.projectedExpense != null && s.elapsedDays >= 5) {
      const ps = s.income - s.projectedExpense;
      if (ps < 0) {
        add(92, 'forecast-negative', 'bad', 'alert', 'בקצב הזה החודש ייסגר במינוס', `התחזית היא הוצאות של כ-${money(s.projectedExpense)} מול הכנסות של ${money(s.income)}, פער של ${money(-ps)}.`);
      } else if (s.goal > 0 && ps < s.goal) {
        add(78, 'forecast-goal', 'warn', 'target', 'יעד החיסכון בסכנה', `בקצב הנוכחי תחסכו כ-${money(ps)}, ${money(s.goal - ps)} פחות מהיעד של ${money(s.goal)}.`);
      } else if (s.goal > 0) {
        add(66, 'forecast-goal-ok', 'good', 'target', 'בדרך ליעד החיסכון', `בקצב הנוכחי תחסכו כ-${money(ps)}, מעל היעד של ${money(s.goal)}.`);
      } else {
        add(56, 'forecast-ok', 'good', 'piggy', 'צפוי חודש חיובי', `בקצב הנוכחי יישארו לכם כ-${money(ps)} בסוף החודש (${pct(ps / s.income)} מההכנסה).`);
      }
    }
    if (s.income > 0 && s.safeToSpendPerDay != null && s.daysLeft > 1 && s.safeToSpendPerDay >= 100) {
      add(
        59,
        'safe-to-spend',
        'info',
        'wallet',
        `אפשר להוציא כ-${money(s.safeToSpendPerDay)} ביום`,
        s.goal > 0
          ? `כך תעמדו ביעד החיסכון של ${money(s.goal)} עד סוף החודש (${countLabel(s.daysLeft, 'נותר יום אחד', 'ימים נותרו')}).`
          : `כך תסיימו את החודש בלי מינוס (${countLabel(s.daysLeft, 'נותר יום אחד', 'ימים נותרו')}).`,
      );
    }
    if (s.income === 0 && s.expense > 0) {
      add(44, 'no-income', 'info', 'wallet', 'עוד לא נרשמה הכנסה החודש', 'הוסיפו את המשכורת כדי לראות כמה נשאר להוציא ולחסוך עד סוף החודש.');
    }
  }

  // --- streak of saving months ---------------------------------------------
  {
    const endKey = isPast ? key : addMonths(key, -1);
    const hist = history(state, 24, endKey);
    let streak = 0;
    let sum = 0;
    for (let i = hist.length - 1; i >= 0; i--) {
      const p = hist[i];
      if (p.income > 0 && p.saved > 0) {
        streak++;
        sum += p.saved;
      } else break;
    }
    if (streak >= 2) {
      const start = addMonths(endKey, -(streak - 1));
      add(50 + Math.min(streak, 8), 'streak', 'good', 'star', `${streak} חודשים ברצף של חיסכון`, `מאז ${fmtMonth(start)} כל חודש נסגר ביתרה חיובית, ובסך הכול נחסכו ${money(sum)}.`);
    }
  }

  // --- no-spend days -------------------------------------------------------
  if (s.elapsedDays >= 7) {
    const lastDay = isCurrent ? today : s.range.to;
    const zero = s.byDay.filter((d) => d.date <= lastDay && d.expense === 0).length;
    if (zero >= 3) {
      add(46, 'no-spend', 'good', 'check', `${zero} ימים בלי הוצאות`, `${isCurrent ? 'עד עכשיו היו' : `ב${monthName} היו`} ${zero} ימים שבהם לא יצא אף שקל. כל יום כזה מצטבר.`);
    }
  }

  // --- where it went -------------------------------------------------------
  if (s.expense > 0) {
    const [top] = topNotes(state, key, 1);
    if (top && top.count >= 3 && top.total >= s.expense * 0.08) {
      add(40, 'top-merchant', 'info', 'cart', `הכי הרבה עסקאות ב${top.note}`, `${top.count} עסקאות בסך ${money(top.total)}, שהם ${pct(top.total / s.expense)} מכלל ההוצאות ב${monthName}.`);
    }
    const oneOff = s.topExpenses.filter((t) => !t.recurringId);
    const big = oneOff[0];
    if (big && big.amount >= s.expense * 0.1) {
      const label = big.note || catById(state, big.categoryId).name;
      add(36, 'biggest', 'info', 'arrow-up', 'ההוצאה הגדולה ביותר', `${label} ב-${fmtDate(big.date, { year: false })}: ${money(big.amount)}, ${pct(big.amount / s.expense)} מההוצאות ב${monthName}.`);
    }
  }

  // --- weekday pattern (variable spend only) -------------------------------
  {
    const wd = [0, 0, 0, 0, 0, 0, 0];
    let n = 0;
    for (const t of txInPeriod(state, key)) {
      if (t.type !== 'expense' || t.recurringId) continue;
      wd[weekdayOf(t.date)] += t.amount;
      n++;
    }
    const total = sumBy(wd, (x) => x);
    if (n >= 15 && total > 0) {
      const maxIdx = wd.indexOf(Math.max(...wd));
      const share = wd[maxIdx] / total;
      if (share >= 0.25) {
        const name = WEEKDAYS[maxIdx];
        add(30, 'weekday', 'info', 'calendar', maxIdx === 6 ? 'שבת היא יום ההוצאות שלכם' : `יום ${name} הוא יום ההוצאות שלכם`, `${pct(share)} מההוצאות המשתנות נעשו ב${maxIdx === 6 ? 'שבתות' : `ימי ${name}`}, בסך ${money(wd[maxIdx])}.`);
      }
    }
  }

  return finalize(out, s, monthName);
}

function finalize(out, s, monthName) {
  if (out.length < 2 && s.count > 0) {
    out.push({
      score: 10,
      id: 'summary',
      tone: 'info',
      icon: 'chart',
      title: `סיכום ${monthName}`,
      text: `נכנסו ${money(s.income)} ויצאו ${money(s.expense)} ב-${s.count === 1 ? 'תנועה אחת' : `${s.count} תנועות`}.`,
    });
  }
  if (out.length < 2 && !s.goal) {
    out.push({ score: 5, id: 'tip-goal', tone: 'info', icon: 'target', title: 'כדאי להגדיר יעד חיסכון', text: 'עם יעד חודשי (למשל 1,000 ₪) נוכל להראות כמה בדיוק אפשר להוציא בכל יום.' });
  }
  if (out.length < 2) {
    out.push({ score: 4, id: 'tip-recurring', tone: 'info', icon: 'repeat', title: 'הוסיפו הוצאות קבועות', text: 'שכר דירה, מנויים וחשבונות יירשמו לבד בכל חודש, כדי שלא תצטרכו לזכור.' });
  }
  const seen = new Set();
  return out
    .sort((a, b) => b.score - a.score)
    .filter((x) => (seen.has(x.id) ? false : seen.add(x.id)))
    .slice(0, 6)
    .map(({ score, ...rest }) => rest);
}
