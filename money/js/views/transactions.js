// Transactions: search, filter, day-grouped list, CSV export.
import { h, icon, money, txRow, toast, emptyState, segmented } from '../ui.js';
import { PAYMENTS, fmtMoney, fmtMonth, fmtDayHeader, todayISO } from '../format.js';
import { filterTx, txInPeriod } from '../model.js';
import { exportCSV, download } from '../io.js';

const PAGE = 200;
const TYPES = [{ value: 'all', label: 'הכל' }, { value: 'expense', label: 'הוצאות' }, { value: 'income', label: 'הכנסות' }];

// UI state kept across re-renders.
const F = { scope: 'month', query: '', type: 'all', categoryId: null, payment: null };
let limit = PAGE;
let appliedParams = '';

function applyParams(params = {}) {
  const sig = JSON.stringify(params || {});
  if (sig === appliedParams) return;
  appliedParams = sig;
  const { cat, type, q, pay, scope } = params || {};
  if (!cat && !type && !q && !pay && !scope) return;
  F.query = q || '';
  F.type = type === 'expense' || type === 'income' ? type : 'all';
  F.categoryId = cat || null;
  F.payment = pay || null;
  F.scope = scope === 'all' ? 'all' : 'month';
  limit = PAGE;
}

const hasFilters = () => !!(F.query.trim() || F.type !== 'all' || F.categoryId || F.payment);

function sumTx(list) {
  let income = 0, expense = 0;
  for (const t of list) { if (t.type === 'income') income += t.amount; else expense += t.amount; }
  return { income, expense, net: income - expense, count: list.length };
}

function sortDesc(list) {
  return list.slice().sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
}

export default {
  id: 'tx',
  title: 'תנועות',
  render(root, ctx) {
    applyParams(ctx.params);
    const store = ctx.store;
    const state = store.state;
    const today = ctx.today || todayISO();
    const key = () => (F.scope === 'month' ? ctx.period : null);
    let timer = 0;

    // ---------------- Header ----------------
    const scopeTx = () => (key() ? txInPeriod(state, key()) : state.transactions);
    const headStats = h('div', { class: 'grid grid-3 tx-stats' });
    function paintHead() {
      const s = sumTx(scopeTx());
      headStats.replaceChildren(
        h('div', { class: 'stat is-income' }, h('div', { class: 'stat-label' }, 'הכנסות'), h('div', { class: 'stat-value' }, money(s.income, { tone: 'income' }))),
        h('div', { class: 'stat is-expense' }, h('div', { class: 'stat-label' }, 'הוצאות'), h('div', { class: 'stat-value' }, money(s.expense, { tone: 'expense' }))),
        h('div', { class: `stat ${s.net >= 0 ? 'is-good' : 'is-bad'}` },
          h('div', { class: 'stat-label' }, 'נשאר'),
          h('div', { class: 'stat-value' }, money(s.net, { sign: true })),
          h('div', { class: 'stat-sub' }, `${s.count.toLocaleString('he-IL')} תנועות`)),
      );
      sub.textContent = key() ? fmtMonth(key()) : 'כל התנועות';
    }

    const sub = h('p', { class: 'page-sub' });
    const exportBtn = h('button', {
      type: 'button', class: 'btn btn-ghost btn-sm', on: { click: doExport },
      'aria-label': 'ייצוא התנועות המסוננות לקובץ CSV',
    }, icon('download'), h('span', { class: 'hide-mobile' }, 'ייצוא CSV'));
    const addBtn = h('button', { type: 'button', class: 'btn btn-primary btn-sm', on: { click: () => ctx.openEntry(null, addDefaults()) } }, icon('plus'), 'הוספה');

    const addDefaults = () => {
      const d = {};
      if (F.type !== 'all') d.type = F.type;
      if (F.categoryId) {
        const c = state.categories.find((x) => x.id === F.categoryId);
        if (c && !c.archived) { d.categoryId = c.id; d.type = c.type; }
      }
      if (!d.type) d.type = 'expense';
      return d;
    };

    // ---------------- Controls ----------------
    const scopeSeg = segmented(
      [{ value: 'month', label: 'החודש' }, { value: 'all', label: 'הכל' }],
      F.scope,
      (v) => { F.scope = v; limit = PAGE; paintHead(); refresh(); },
      { label: 'טווח' },
    );

    const search = h('input', {
      class: 'input', type: 'search', id: 'tx-search', placeholder: 'חיפוש לפי הערה, קטגוריה או סכום', autocomplete: 'off', enterkeyhint: 'search',
    });
    search.value = F.query;
    search.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => { F.query = search.value; limit = PAGE; refresh(); }, 160);
    });
    search.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && search.value) { e.stopPropagation(); search.value = ''; F.query = ''; refresh(); }
    });

    const typeChips = h('div', { class: 'chips', role: 'group', 'aria-label': 'סוג' });
    function paintTypeChips() {
      typeChips.replaceChildren(...TYPES.map((t) => h('button', {
        type: 'button', class: 'chip', 'aria-pressed': String(F.type === t.value),
        on: {
          click: () => {
            F.type = t.value;
            const c = F.categoryId && state.categories.find((x) => x.id === F.categoryId);
            if (c && F.type !== 'all' && c.type !== F.type) F.categoryId = null;
            limit = PAGE;
            paintTypeChips(); paintCatSelect(); refresh();
          },
        },
      }, t.label)));
    }

    const catSelect = h('select', { class: 'select', id: 'tx-cat' });
    function paintCatSelect() {
      const cats = state.categories
        .filter((c) => F.type === 'all' || c.type === F.type)
        .sort((a, b) => (a.type === b.type ? 0 : a.type === 'expense' ? -1 : 1) || (a.archived - b.archived) || (a.order ?? 0) - (b.order ?? 0));
      const opts = [h('option', { value: '' }, 'כל הקטגוריות')];
      const groups = F.type === 'all' ? ['expense', 'income'] : [F.type];
      for (const g of groups) {
        const items = cats.filter((c) => c.type === g).map((c) => h('option', { value: c.id }, c.archived ? `${c.name} (בארכיון)` : c.name));
        if (!items.length) continue;
        opts.push(groups.length > 1 ? h('optgroup', { label: g === 'expense' ? 'הוצאות' : 'הכנסות' }, items) : items);
      }
      catSelect.replaceChildren(...opts.flat());
      catSelect.value = F.categoryId || '';
    }
    catSelect.addEventListener('change', () => { F.categoryId = catSelect.value || null; limit = PAGE; refresh(); });

    const paySelect = h('select', { class: 'select', id: 'tx-pay' },
      h('option', { value: '' }, 'כל אמצעי התשלום'),
      PAYMENTS.map((p) => h('option', { value: p.id }, p.label)));
    paySelect.value = F.payment || '';
    paySelect.addEventListener('change', () => { F.payment = paySelect.value || null; limit = PAGE; refresh(); });

    const summary = h('div', { class: 'spread tx-filter-summary', role: 'status', 'aria-live': 'polite', style: 'min-height:32px;gap:8px;flex-wrap:wrap' });
    const listBox = h('div', { class: 'tx-days' });

    // ---------------- List ----------------
    function filtered() {
      return sortDesc(filterTx(state, {
        query: F.query.trim(), type: F.type, categoryId: F.categoryId, payment: F.payment, key: key(),
      }));
    }

    function clearFilters() {
      F.query = ''; F.type = 'all'; F.categoryId = null; F.payment = null; limit = PAGE;
      search.value = ''; paySelect.value = '';
      paintTypeChips(); paintCatSelect(); refresh();
      search.focus();
    }

    function paintSummary(list) {
      const s = sumTx(list);
      const parts = [`${s.count.toLocaleString('he-IL')} תנועות`];
      let amountNode;
      if (F.type === 'income' || (s.expense === 0 && s.income > 0)) amountNode = money(s.income, { tone: 'income' });
      else if (F.type === 'expense' || s.income === 0) amountNode = money(s.expense);
      else amountNode = h('span', {}, 'הוצאות ', money(s.expense), ' · הכנסות ', money(s.income, { tone: 'income' }));
      summary.replaceChildren(
        h('span', { class: 'text-sm muted' }, parts.join(''), list.length ? ' · ' : '', list.length ? amountNode : null),
        hasFilters() ? h('button', { type: 'button', class: 'btn btn-ghost btn-sm', on: { click: clearFilters } }, icon('close', { size: 16 }), 'ניקוי סינון') : null,
      );
    }

    function paintList(list) {
      if (!state.transactions.length) {
        listBox.replaceChildren(emptyState({
          icon: 'list',
          title: 'עוד אין תנועות',
          text: 'כל הוצאה שתרשמו תופיע כאן. רישום לוקח שלוש שניות: סכום, קטגוריה, שמירה.',
          actions: [
            h('button', { type: 'button', class: 'btn btn-primary', on: { click: () => ctx.openEntry(null, { type: 'expense' }) } }, icon('plus'), 'הוספת הוצאה'),
            h('button', { type: 'button', class: 'btn btn-ghost', on: { click: () => ctx.navigate('settings') } }, 'ייבוא או נתוני הדגמה'),
          ],
        }));
        return;
      }
      if (!list.length) {
        const actions = [];
        if (hasFilters()) actions.push(h('button', { type: 'button', class: 'btn btn-ghost', on: { click: clearFilters } }, 'ניקוי סינון'));
        if (F.scope === 'month') actions.push(h('button', { type: 'button', class: 'btn btn-ghost', on: { click: () => { F.scope = 'all'; limit = PAGE; paintHead(); refresh(); syncScope(); } } }, 'חיפוש בכל החודשים'));
        if (!hasFilters()) actions.push(h('button', { type: 'button', class: 'btn btn-primary', on: { click: () => ctx.openEntry(null, addDefaults()) } }, icon('plus'), 'הוספה'));
        listBox.replaceChildren(emptyState({
          icon: hasFilters() ? 'search' : 'calendar',
          title: hasFilters() ? 'לא נמצאו תנועות' : `אין תנועות ב${fmtMonth(ctx.period)}`,
          text: hasFilters() ? 'נסו מילת חיפוש אחרת או הסירו חלק מהמסננים.' : 'אפשר להוסיף תנועה או לעבור לחודש אחר.',
          actions,
        }));
        return;
      }

      const shown = list.slice(0, limit);
      const dayTotals = new Map();
      for (const t of list) if (t.type === 'expense') dayTotals.set(t.date, (dayTotals.get(t.date) || 0) + t.amount);

      const groups = [];
      let cur = null;
      for (const t of shown) {
        if (!cur || cur.date !== t.date) { cur = { date: t.date, items: [] }; groups.push(cur); }
        cur.items.push(t);
      }
      const frag = groups.map((g) => {
        const total = dayTotals.get(g.date) || 0;
        const hdId = `day-${g.date}`;
        return h('section', { class: 'day-group', 'aria-labelledby': hdId },
          h('h3', { class: 'day-hd', id: hdId },
            h('span', {}, fmtDayHeader(g.date, today)),
            total ? h('span', { class: 'muted' }, h('span', { class: 'sr-only' }, 'הוצאות ביום: '), money(total)) : null),
          h('ul', { class: 'tx-list' }, g.items.map((t) => txRow(t, state, { onClick: () => ctx.openEntry(t) }))));
      });
      if (list.length > limit) {
        frag.push(h('div', { class: 'cluster', style: 'justify-content:center;padding:16px 0' },
          h('button', {
            type: 'button', class: 'btn btn-ghost',
            on: { click: (e) => { limit += PAGE; const y = window.scrollY; refresh(); window.scrollTo(0, y); e.currentTarget?.blur?.(); } },
          }, `הצגת עוד (${(list.length - limit).toLocaleString('he-IL')} נוספות)`)));
      }
      listBox.replaceChildren(...frag);
    }

    let lastList = [];
    function refresh() {
      lastList = filtered();
      paintSummary(lastList);
      paintList(lastList);
    }

    function syncScope() {
      scopeSeg.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-pressed', String((i === 0) === (F.scope === 'month'))));
    }

    function doExport() {
      const list = lastList.length || hasFilters() ? lastList : filtered();
      if (!list.length) { toast('אין תנועות לייצוא'); return; }
      const blob = exportCSV({ ...state, transactions: list }, {});
      const name = `maazan-${key() || 'all'}${hasFilters() ? '-filtered' : ''}.csv`;
      download(blob, name);
      toast(`יוצאו ${list.length.toLocaleString('he-IL')} תנועות`);
    }

    // ---------------- Layout ----------------
    paintTypeChips();
    paintCatSelect();
    paintHead();

    root.append(h('div', { class: 'page' },
      h('div', { class: 'page-hd' },
        h('div', {}, h('h1', { class: 'page-title' }, 'תנועות'), sub),
        h('div', { class: 'cluster' }, exportBtn, addBtn)),
      h('div', { class: 'section' }, headStats),
      h('div', { class: 'card tx-filters' }, h('div', { class: 'card-bd stack' },
        h('div', { class: 'cluster', style: 'flex-wrap:wrap;gap:12px' },
          scopeSeg,
          h('div', { class: 'input-group grow', style: 'min-width:220px' },
            h('label', { for: search.id, class: 'sr-only' }, 'חיפוש תנועות'),
            h('span', { class: 'affix', 'aria-hidden': 'true' }, icon('search', { size: 18 })),
            search)),
        h('div', { class: 'cluster', style: 'flex-wrap:wrap;gap:12px' },
          typeChips,
          h('div', { class: 'field', style: 'flex:1 1 160px;margin:0' }, h('label', { class: 'sr-only', for: catSelect.id }, 'סינון לפי קטגוריה'), catSelect),
          h('div', { class: 'field', style: 'flex:1 1 160px;margin:0' }, h('label', { class: 'sr-only', for: paySelect.id }, 'סינון לפי אמצעי תשלום'), paySelect)),
        summary)),
      h('div', { class: 'section' }, listBox),
    ));
    refresh();

    return () => clearTimeout(timer);
  },
};
