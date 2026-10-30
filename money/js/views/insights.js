// Insights ("תובנות") — long-term savings, month-over-month changes, patterns.
import { h, icon, catBadge, money, txRow, emptyState, segmented, openSheet } from '../ui.js';
import { fmtMoney, fmtPct, fmtMonth, fmtDate, fmtDayHeader, PAYMENTS } from '../format.js';
import { summarize, insights, history, totals, topNotes, txInPeriod, currentPeriod } from '../model.js';
import { barsCompare, barsSimple, lineArea, calendarHeat, meter } from '../charts.js';
import { insightCard } from './dashboard.js';

const compact = (v) => fmtMoney(v, { compact: true });
const WEEKDAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const WEEKDAYS_LONG = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

// UI state kept across re-renders
let months = 6;

function card({ title, action, cls = '', body }) {
  return h('section', { class: `card ${cls}`.trim() },
    h('div', { class: 'card-hd' }, h('h2', { class: 'card-title' }, title), action || null),
    h('div', { class: 'card-bd' }, body),
  );
}

function stat(label, valueNode, sub, tone = '') {
  return h('div', { class: `card stat ${tone}`.trim() },
    h('div', { class: 'stat-label' }, label),
    h('div', { class: 'stat-value' }, valueNode),
    sub ? h('div', { class: 'stat-sub' }, sub) : null,
  );
}

function emptyNote(text) {
  return h('p', { class: 'muted text-sm', style: { margin: 0 } }, text);
}

/* ---------- sections ---------- */

function totalsRow(t) {
  const best = t.bestMonth;
  return h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' } },
    stat('נחסך מאז שהתחלת', money(t.allTimeSaved), t.monthsTracked ? `ב־${t.monthsTracked} חודשים` : null,
      t.allTimeSaved >= 0 ? 'is-good' : 'is-bad'),
    stat('חיסכון חודשי ממוצע', money(t.avgMonthlySaved), null, t.avgMonthlySaved >= 0 ? '' : 'is-bad'),
    stat('הוצאה חודשית ממוצעת', money(t.avgMonthlyExpense)),
    stat('החודש הטוב ביותר', best ? money(best.saved) : '—', best ? fmtMonth(best.key) : null, best ? 'is-good' : ''),
  );
}

function savingsOverTime(hist, ctx, rerender) {
  const hi = hist.findIndex((m) => m.key === ctx.period);
  const chart = barsCompare(
    hist.map((m) => ({ label: fmtMonth(m.key, { short: true }), a: m.income, b: m.expense })),
    { format: compact, highlightIndex: hi >= 0 ? hi : undefined },
  );
  const seg = segmented(
    [{ value: 6, label: '6 חודשים' }, { value: 12, label: '12 חודשים' }],
    months,
    (v) => { months = Number(v); rerender(); },
    { label: 'טווח זמן' },
  );
  const rows = h('ul', { class: 'tx-list' }, hist.slice().reverse().map((m) => {
    const sel = m.key === ctx.period;
    return h('li', null,
      h('button', {
        type: 'button', class: 'tx-row', 'aria-current': sel ? 'true' : null,
        style: sel ? { background: 'var(--accent-soft)' } : null,
        on: { click: () => ctx.setPeriod(m.key) },
      },
        h('div', { class: 'tx-main' },
          h('div', { class: 'tx-title' }, fmtMonth(m.key)),
          h('div', { class: 'tx-sub' }, 'הכנסות ', money(m.income), ' · הוצאות ', money(m.expense)),
        ),
        h('div', { class: 'tx-amt', style: { textAlign: 'end' } },
          h('div', { class: m.saved < 0 ? 'tone-bad' : 'tone-good' }, money(m.saved, { sign: true })),
          h('div', { class: 'text-sm muted' }, m.savingsRate == null ? '—' : `${fmtPct(m.savingsRate)} חיסכון`),
        ),
      ),
    );
  }));
  return card({
    title: 'חיסכון לאורך זמן', cls: 'span-2', action: seg,
    body: h('div', { class: 'stack gap-lg' }, chart, rows),
  });
}

function cumulativeCard(fullHist) {
  if (fullHist.length < 2) return null;
  let run = 0;
  const pts = fullHist.map((m) => { run += m.saved; return { label: fmtMonth(m.key, { short: true }), value: run }; });
  return card({
    title: 'חיסכון מצטבר',
    action: h('span', { class: `text-sm ${run < 0 ? 'tone-bad' : 'tone-good'}` }, money(run, { sign: true })),
    body: lineArea(pts, { format: compact, color: run < 0 ? 'var(--expense)' : 'var(--accent)' }),
  });
}

function compareCard(s, ctx) {
  const rows = s.byCategory.filter((c) => (c.delta || 0) !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 8);
  const body = !rows.length
    ? emptyNote('אין שינויים לעומת החודש הקודם.')
    : h('ul', { class: 'tx-list' }, rows.map((c) => {
      const up = c.delta > 0;
      const pct = c.prevTotal > 0 ? fmtPct(Math.abs(c.delta) / c.prevTotal) : 'חדש';
      return h('li', null,
        h('button', { type: 'button', class: 'tx-row', on: { click: () => ctx.navigate('tx', { cat: c.category.id }) } },
          catBadge(c.category, { size: 'sm' }),
          h('div', { class: 'tx-main' },
            h('div', { class: 'tx-title' }, c.category.name),
            h('div', { class: 'tx-sub' }, money(c.prevTotal), ' ← ', money(c.total)),
          ),
          h('div', { class: 'tx-amt' },
            h('span', { class: `delta ${up ? 'is-up is-bad' : 'is-down is-good'}` },
              icon(up ? 'arrow-up' : 'arrow-down', { size: 14 }),
              money(Math.abs(c.delta)),
              h('span', { class: 'sr-only' }, up ? ' יותר' : ' פחות'),
            ),
            h('div', { class: 'text-sm muted', style: { textAlign: 'end' } }, pct),
          ),
        ),
      );
    }));
  return card({ title: 'השוואה לחודש הקודם', body });
}

function merchantsCard(state, key, ctx) {
  const list = topNotes(state, key, 6) || [];
  const max = list.reduce((m, x) => Math.max(m, x.total), 0) || 1;
  const body = !list.length
    ? emptyNote('הוסיפו הערה לתנועות (למשל "שופרסל") כדי לראות כאן לאן הולך הכסף.')
    : h('ul', { class: 'tx-list' }, list.map((n) => h('li', null,
      h('button', { type: 'button', class: 'tx-row', on: { click: () => ctx.navigate('tx', { q: n.note }) } },
        h('div', { class: 'tx-main' },
          h('div', { class: 'tx-title' }, n.note),
          h('div', { class: 'tx-sub' }, n.count === 1 ? 'פעם אחת' : `${n.count} פעמים`),
          h('div', { style: { marginTop: '6px' } }, meter(n.total, max, { tone: 'ok', label: n.note })),
        ),
        h('div', { class: 'tx-amt' }, money(n.total)),
      ),
    )));
  return card({ title: 'לאן הלך הכסף — לפי בית עסק', body });
}

function openDay(date, state, key, ctx) {
  const txs = txInPeriod(state, key).filter((t) => t.date === date);
  let sheet;
  const total = txs.reduce((a, t) => a + (t.type === 'expense' ? t.amount : 0), 0);
  const content = txs.length
    ? h('div', { class: 'stack' },
      h('div', { class: 'muted text-sm' }, 'הוצאות ביום הזה: ', money(total)),
      h('ul', { class: 'tx-list' }, txs.map((tx) => txRow(tx, state, { onClick: () => { sheet.close(); ctx.openEntry(tx); } }))),
    )
    : emptyState({ icon: 'calendar', title: 'יום בלי הוצאות', text: 'לא נרשמו תנועות ביום הזה.' });
  sheet = openSheet({
    title: fmtDayHeader(date, ctx.today),
    content,
    footer: h('button', {
      type: 'button', class: 'btn btn-primary btn-block',
      on: { click: () => { sheet.close(); ctx.openEntry(null, { type: 'expense', date }); } },
    }, icon('plus'), 'הוספת הוצאה ליום הזה'),
  });
}

function calendarCard(s, state, ctx) {
  return card({
    title: 'מפת הוצאות חודשית',
    body: calendarHeat(s.byDay.map((d) => ({ date: d.date, expense: d.expense })), {
      format: compact, onSelect: (date) => openDay(date, state, s.key, ctx),
    }),
  });
}

function weekdayCard(s) {
  const vals = s.byWeekday || [0, 0, 0, 0, 0, 0, 0];
  let maxI = 0;
  vals.forEach((v, i) => { if (v > vals[maxI]) maxI = i; });
  const body = !s.expense
    ? emptyNote('אין הוצאות בתקופה הזו.')
    : h('div', { class: 'stack' },
      barsSimple(vals.map((v, i) => ({ label: WEEKDAYS[i], value: v })), { height: 140, format: compact, highlightIndex: maxI }),
      h('p', { class: 'text-sm muted', style: { margin: 0 } }, `הכי הרבה הוצאות ביום ${WEEKDAYS_LONG[maxI]}: `, money(vals[maxI])),
    );
  return card({ title: 'לפי יום בשבוע', body });
}

function paymentCard(s) {
  const list = (s.byPayment || []).filter((p) => p.total > 0);
  const byId = Object.fromEntries(PAYMENTS.map((p) => [p.id, p]));
  const body = !list.length
    ? emptyNote('אין הוצאות בתקופה הזו.')
    : h('div', { class: 'stack' }, list.map((p) => {
      const meta = byId[p.payment] || byId.other;
      return h('div', { class: 'stack gap-sm' },
        h('div', { class: 'spread' },
          h('span', { class: 'cluster' }, icon(meta.icon, { size: 18 }), meta.label),
          h('span', null, money(p.total), ' ', h('span', { class: 'muted text-sm num' }, fmtPct(p.share))),
        ),
        meter(p.share, 1, { tone: 'ok', label: meta.label }),
      );
    }));
  return card({ title: 'לפי אמצעי תשלום', body });
}

/* ---------- view ---------- */

function render(root, ctx) {
  const { state, period: key, today } = ctx;
  const page = h('div', { class: 'page' });
  root.append(page);

  page.append(h('div', { class: 'page-hd' },
    h('div', null,
      h('h1', { class: 'page-title' }, 'תובנות'),
      h('p', { class: 'page-sub' }, `החודש הנבחר: ${fmtMonth(key)}`),
    ),
  ));

  if (!state.transactions.length) {
    page.append(emptyState({
      icon: 'chart', title: 'עוד אין מה לנתח',
      text: 'אחרי כמה הוצאות והכנסות יופיעו כאן מגמות, השוואות וכמה חסכת לאורך זמן.',
      actions: [
        h('button', { type: 'button', class: 'btn btn-primary', on: { click: () => ctx.openEntry(null, { type: 'expense' }) } }, icon('plus'), 'הוספת הוצאה'),
        h('button', { type: 'button', class: 'btn btn-ghost', on: { click: () => ctx.store.loadDemo() } }, icon('sparkle'), 'טעינת נתוני דוגמה'),
      ],
    }));
    return;
  }

  const rerender = () => { root.textContent = ''; render(root, ctx); };
  const curKey = currentPeriod(state, today);
  const endKey = key > curKey ? key : curKey;
  const t = totals(state);
  const s = summarize(state, key, today);
  const hist = history(state, months, endKey);
  const tracked = Math.max(2, Math.min(t.monthsTracked || 0, 60));
  const fullHist = history(state, tracked, curKey);
  const ins = insights(state, key, today) || [];

  page.append(totalsRow(t));

  const grid = h('div', { class: 'grid grid-2', style: { marginTop: 'var(--gap, 16px)' } },
    savingsOverTime(hist, ctx, rerender),
    cumulativeCard(fullHist),
    compareCard(s, ctx),
    merchantsCard(state, key, ctx),
    s.count ? calendarCard(s, state, ctx) : null,
    weekdayCard(s),
    paymentCard(s),
  );
  page.append(grid);

  if (ins.length) {
    page.append(h('section', { class: 'section' },
      h('h2', { class: 'section-title' }, `תובנות ל${fmtMonth(key)}`),
      h('div', { class: 'grid grid-3' }, ins.map(insightCard)),
    ));
  }
}

export default { id: 'insights', title: 'תובנות', render };
