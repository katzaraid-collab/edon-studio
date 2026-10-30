// Dashboard ("סקירה") — where the money went this period and how much was saved.
import { h, icon, catColor, catBadge, money, txRow, emptyState, animateNumber } from '../ui.js';
import { fmtMoney, fmtPct, fmtDate, fmtMonth } from '../format.js';
import { summarize, insights, txInPeriod, currentPeriod } from '../model.js';
import { donut, barsSimple, meter } from '../charts.js';

const compact = (v) => fmtMoney(v, { compact: true });
const DONUT_MAX = 6; // slices before grouping the rest into "שאר"

// Remember the last hero value so re-renders (store changes) don't replay the count-up.
let lastHero = null;

function greeting(name, now = new Date()) {
  const hr = now.getHours();
  const g = hr < 5 ? 'לילה טוב' : hr < 12 ? 'בוקר טוב' : hr < 17 ? 'צהריים טובים' : hr < 21 ? 'ערב טוב' : 'לילה טוב';
  return name ? `${g}, ${name}` : g;
}

function card({ title, action, cls = '', body }) {
  return h('section', { class: `card ${cls}`.trim() },
    h('div', { class: 'card-hd' }, h('h2', { class: 'card-title' }, title), action || null),
    h('div', { class: 'card-bd' }, body),
  );
}

function actionBtn(label, onClick) {
  return h('button', { type: 'button', class: 'card-action', on: { click: onClick } }, label);
}

export function insightCard(ins) {
  return h('div', { class: `insight is-${ins.tone || 'info'}` },
    h('div', { class: 'insight-icon' }, icon(ins.icon || 'info')),
    h('div', { class: 'insight-main' },
      h('div', { class: 'insight-title' }, ins.title),
      ins.text ? h('div', { class: 'insight-text' }, ins.text) : null,
    ),
  );
}

function miniStat(label, valueNode, cls = '') {
  return h('div', { class: `mini-stat ${cls}`.trim() },
    h('div', { class: 'mini-label' }, label),
    h('div', { class: 'mini-value' }, valueNode),
  );
}

/* ---------- sections ---------- */

function heroCard(s, ctx, isCurrent) {
  const { saved, income, expense } = s;
  const negative = saved < 0;
  const valueEl = h('bdi', { class: 'num' });
  const prev = lastHero;
  lastHero = { key: s.key, saved };
  if (prev && prev.key === s.key && prev.saved === saved) valueEl.textContent = fmtMoney(saved);
  else animateNumber(valueEl, saved, { from: prev && prev.key === s.key ? prev.saved : 0 });

  let sub;
  if (income === 0 && expense === 0) sub = 'עדיין אין תנועות בתקופה הזו';
  else if (income === 0) sub = isCurrent ? 'עוד לא נרשמה הכנסה החודש' : 'לא נרשמה הכנסה בחודש הזה';
  else if (negative) sub = h('span', null, 'חריגה: הוצאת ', money(-saved), ' יותר ממה שנכנס');
  else sub = `שיעור חיסכון ${fmtPct(s.savingsRate ?? 0)} מההכנסות`;

  let goalBlock = null;
  const goal = s.goal || 0;
  if (goal > 0) {
    const reached = saved >= goal;
    let text;
    if (reached) text = h('span', null, 'הגעת ליעד החיסכון של ', money(goal));
    else if (saved <= 0) text = h('span', null, 'יעד החיסכון: ', money(goal));
    else text = h('span', null, 'עוד ', money(goal - saved), ' ליעד של ', money(goal));
    goalBlock = h('div', { class: 'stack gap-sm', style: { marginTop: '14px' } },
      h('div', { class: 'spread text-sm' },
        h('span', null, icon('target', { size: 16 }), ' ', text),
        h('span', { class: 'num' }, fmtPct(Math.max(0, Math.min(saved / goal, 9.99)))),
      ),
      meter(Math.max(0, saved), goal, { tone: 'good', label: 'התקדמות ליעד החיסכון' }),
    );
  } else if (isCurrent) {
    goalBlock = h('button', {
      type: 'button', class: 'btn btn-ghost btn-sm', style: { marginTop: '12px' },
      on: { click: () => ctx.navigate('settings') },
    }, icon('target', { size: 16 }), 'הגדרת יעד חיסכון חודשי');
  }

  const stats = [
    miniStat('הכנסות', money(income, { tone: 'income' })),
    miniStat('הוצאות', money(expense)),
  ];
  if (isCurrent && s.safeToSpendPerDay != null && s.daysLeft > 0) {
    const safe = s.safeToSpendPerDay;
    stats.push(miniStat('אפשר להוציא ביום', money(Math.max(0, safe)), safe > 0 ? '' : 'is-bad'));
  }
  if (isCurrent && s.projectedExpense != null && s.elapsedDays >= 3) {
    stats.push(miniStat('צפי הוצאות לחודש', money(s.projectedExpense),
      income > 0 && s.projectedExpense > income ? 'is-bad' : ''));
  } else if (!isCurrent && expense > 0) {
    stats.push(miniStat('ממוצע הוצאה ליום', money(s.avgPerDay)));
  }

  return h('section', { class: `card hero span-2 ${negative ? 'is-bad' : 'is-good'}` },
    h('div', { class: 'hero-label' }, negative ? 'חריגה החודש' : (isCurrent ? 'נחסך החודש' : `נחסך ב${fmtMonth(s.key)}`)),
    h('div', { class: `hero-value ${negative ? 'tone-bad' : 'tone-good'}` }, valueEl),
    h('div', { class: 'hero-sub' }, sub),
    goalBlock,
    h('div', { class: 'hero-stats' }, stats),
  );
}

function whereCard(s, ctx) {
  const cats = s.byCategory.filter((c) => c.total > 0);
  if (!cats.length) {
    return card({ title: 'לאן הלך הכסף', body: h('p', { class: 'muted text-sm' }, 'אין הוצאות בתקופה הזו.') });
  }
  const shown = cats.slice(0, DONUT_MAX);
  const rest = cats.slice(DONUT_MAX);
  const items = shown.map((c) => ({ label: c.category.name, value: c.total, color: catColor(c.category), id: c.category.id, share: c.share, count: c.count }));
  if (rest.length) {
    const total = rest.reduce((a, c) => a + c.total, 0);
    items.push({ label: `שאר הקטגוריות (${rest.length})`, value: total, color: 'var(--text-3)', id: null, share: s.expense ? total / s.expense : 0 });
  }
  const go = (i) => {
    const it = items[i];
    if (it && it.id) ctx.navigate('tx', { cat: it.id });
    else ctx.navigate('tx', { type: 'expense' });
  };
  const chart = donut(items.map(({ label, value, color }) => ({ label, value, color })), {
    centerTitle: 'הוצאות', centerValue: fmtMoney(s.expense), onSelect: go,
  });
  const legend = h('ul', { class: 'legend' }, items.map((it, i) => h('li', null,
    h('button', { type: 'button', class: 'legend-item', on: { click: () => go(i) } },
      h('span', { class: 'cat-dot', style: { '--c': it.color } }),
      h('span', { class: 'legend-label grow' }, it.label),
      h('span', { class: 'legend-value' }, money(it.value)),
      h('span', { class: 'legend-pct muted num' }, fmtPct(it.share || 0)),
    ),
  )));
  return card({
    title: 'לאן הלך הכסף',
    action: actionBtn('כל ההוצאות', () => ctx.navigate('tx', { type: 'expense' })),
    body: h('div', { class: 'stack gap-lg' }, h('div', { style: { maxWidth: '240px', marginInline: 'auto', width: '100%' } }, chart), legend),
  });
}

function budgetsCard(s, ctx) {
  const rows = s.byCategory.filter((c) => c.budget > 0);
  const toSettings = () => ctx.navigate('settings', { section: 'budgets' });
  if (!rows.length) {
    return card({
      title: 'תקציבים',
      body: h('div', { class: 'stack gap-sm' },
        h('p', { class: 'muted text-sm', style: { margin: 0 } }, 'הגדרת תקציב חודשי לכמה קטגוריות עיקריות תעזור לדעת מתי לעצור.'),
        h('div', null, h('button', { type: 'button', class: 'btn btn-sm', on: { click: toSettings } }, icon('plus', { size: 16 }), 'הגדרת תקציבים')),
      ),
    });
  }
  rows.sort((a, b) => (b.budgetRatio ?? 0) - (a.budgetRatio ?? 0));
  const list = h('div', { class: 'stack' }, rows.map((c) => {
    const left = c.budget - c.total;
    const over = left < 0;
    return h('div', { class: 'budget-row' },
      catBadge(c.category, { size: 'sm' }),
      h('div', { class: 'grow stack gap-sm', style: { minWidth: 0 } },
        h('div', { class: 'spread' },
          h('span', { class: 'budget-name' }, c.category.name),
          h('span', { class: 'text-sm muted' }, money(c.total), ' מתוך ', money(c.budget)),
        ),
        meter(c.total, c.budget, { label: `תקציב ${c.category.name}` }),
        h('div', { class: `text-sm ${over ? 'tone-bad' : (c.budgetRatio >= 0.8 ? 'tone-warn' : 'muted')}` },
          over ? h('span', null, 'חריגה של ', money(-left)) : h('span', null, 'נשארו ', money(left))),
      ),
    );
  }));
  const totalLeft = s.budgetLeft;
  return card({
    title: 'תקציבים',
    action: actionBtn('עריכה', toSettings),
    body: h('div', { class: 'stack' },
      h('div', { class: 'text-sm muted' }, 'סה״כ ', money(s.budgetTotal), ' · ',
        totalLeft >= 0 ? h('span', null, 'נשארו ', money(totalLeft)) : h('span', { class: 'tone-bad' }, 'חריגה של ', money(-totalLeft))),
      list,
    ),
  });
}

function insightsCard(list, ctx) {
  if (!list.length) return null;
  return h('section', { class: 'section span-2', style: { marginTop: 0 } },
    h('div', { class: 'spread' },
      h('h2', { class: 'section-title' }, 'תובנות'),
      actionBtn('לכל התובנות', () => ctx.navigate('insights')),
    ),
    h('div', { class: 'grid grid-3' }, list.slice(0, 3).map(insightCard)),
  );
}

function dailyCard(s, ctx) {
  if (!s.expense) return null;
  const todayIdx = s.byDay.findIndex((d) => d.date === ctx.today);
  const items = s.byDay.map((d) => ({ label: String(Number(d.date.slice(8))), value: d.expense }));
  const chart = barsSimple(items, { height: 150, format: compact, highlightIndex: todayIdx >= 0 ? todayIdx : undefined, maxLabels: 8 });
  return card({
    title: 'הוצאות לפי יום',
    action: h('span', { class: 'text-sm muted' }, 'ממוצע ', money(s.avgPerDay), ' ליום'),
    body: chart,
  });
}

function recentCard(txs, state, ctx) {
  if (!txs.length) return null;
  return card({
    title: 'תנועות אחרונות',
    action: actionBtn('לכל התנועות', () => ctx.navigate('tx')),
    body: h('ul', { class: 'tx-list' }, txs.map((tx) => txRow(tx, state, { onClick: () => ctx.openEntry(tx), showDate: true }))),
  });
}

function onboarding(ctx) {
  return emptyState({
    icon: 'piggy',
    title: 'ברוכים הבאים למאזן',
    text: 'רושמים כל הוצאה והכנסה, ורואים בדיוק לאן הלך כל שקל וכמה נחסך בכל חודש. הכול נשמר רק במכשיר שלך.',
    actions: [
      h('button', { type: 'button', class: 'btn btn-primary btn-lg', on: { click: () => ctx.openEntry(null, { type: 'expense' }) } }, icon('plus'), 'הוספת הוצאה ראשונה'),
      h('button', { type: 'button', class: 'btn', on: { click: () => ctx.openEntry(null, { type: 'income' }) } }, icon('briefcase'), 'הוספת משכורת'),
      h('button', { type: 'button', class: 'btn btn-ghost', on: { click: () => ctx.store.loadDemo() } }, icon('sparkle'), 'טעינת נתוני דוגמה'),
    ],
  });
}

/* ---------- view ---------- */

function render(root, ctx) {
  const { state, period: key, today } = ctx;
  const settings = state.settings || {};
  const page = h('div', { class: 'page' });
  root.append(page);

  const curKey = currentPeriod(state, today);
  const isCurrent = key === curKey;
  const s = summarize(state, key, today);

  // Header: greeting + period range
  const r = s.range;
  const rangeText = (settings.monthStartDay || 1) !== 1
    ? `${fmtDate(r.from)} – ${fmtDate(r.to)}`
    : fmtMonth(key);
  const subBits = [rangeText];
  if (isCurrent && s.daysLeft > 0) subBits.push(s.daysLeft === 1 ? 'יום אחרון לתקופה' : `עוד ${s.daysLeft} ימים לסוף התקופה`);
  page.append(h('div', { class: 'page-hd' },
    h('div', null,
      h('h1', { class: 'page-title' }, greeting(settings.name)),
      h('p', { class: 'page-sub' }, subBits.join(' · ')),
    ),
  ));

  if (!state.transactions.length) {
    page.append(onboarding(ctx));
    page.append(h('div', { class: 'cluster text-sm muted', style: { justifyContent: 'center', textAlign: 'center', marginTop: '16px' } },
      h('span', null, 'המשכורת לא נכנסת ב־1 לחודש? אפשר לקבוע יום תחילת חודש ויעד חיסכון.'),
      h('button', { type: 'button', class: 'btn btn-ghost btn-sm', on: { click: () => ctx.navigate('settings') } }, icon('settings', { size: 16 }), 'להגדרות'),
    ));
    return;
  }

  if (!s.count) {
    const future = key > curKey;
    page.append(h('div', { class: 'card' }, emptyState({
      icon: 'calendar',
      title: future ? 'התקופה הזו עוד לא התחילה' : `אין תנועות ב${fmtMonth(key)}`,
      text: future ? 'אפשר לחזור לחודש הנוכחי או לרשום מראש הוצאה מתוכננת.' : 'אפשר להוסיף תנועות לחודש הזה או לחזור לחודש הנוכחי.',
      actions: [
        h('button', { type: 'button', class: 'btn btn-primary', on: { click: () => ctx.openEntry(null, { type: 'expense', date: isCurrent ? today : r.from }) } }, icon('plus'), 'הוספת תנועה'),
        isCurrent ? null : h('button', { type: 'button', class: 'btn btn-ghost', on: { click: () => ctx.setPeriod(curKey) } }, 'לחודש הנוכחי'),
      ].filter(Boolean),
    })));
    return;
  }

  const ins = insights(state, key, today) || [];
  const recent = txInPeriod(state, key).slice(0, 6);

  const grid = h('div', { class: 'grid grid-2' },
    heroCard(s, ctx, isCurrent),
    whereCard(s, ctx),
    budgetsCard(s, ctx),
    insightsCard(ins, ctx),
    dailyCard(s, ctx),
    recentCard(recent, state, ctx),
  );
  page.append(grid);
}

export default { id: 'dashboard', title: 'סקירה', render };
