// Settings: profile & month, appearance, categories & budgets, recurring, data.
import { h, icon, catBadge, money, toast, openSheet, confirmDialog, segmented, emptyState, ICONS_FOR_CATEGORIES } from '../ui.js';
import { PAYMENTS, fmtMoney, parseMoney, fmtMonth, todayISO } from '../format.js';
import { catById, history } from '../model.js';
import { exportJSON, exportCSV, importFile, download } from '../io.js';

const VERSION = '1.0.0';
const ICON_LABELS = {
  cart: 'עגלת קניות', food: 'אוכל', coffee: 'קפה', car: 'רכב', fuel: 'דלק', bus: 'אוטובוס', home: 'בית', bolt: 'חשמל',
  phone: 'טלפון', health: 'בריאות', shirt: 'ביגוד', party: 'בילוי', repeat: 'מנוי', book: 'ספר', gift: 'מתנה', shield: 'ביטוח',
  paw: 'חיית מחמד', sparkle: 'טיפוח', baby: 'תינוק', plane: 'טיסה', briefcase: 'עבודה', tools: 'כלים', undo: 'החזר',
  wallet: 'ארנק', dots: 'אחר', game: 'משחקים', dumbbell: 'כושר', music: 'מוזיקה', heart: 'לב', tree: 'טבע', cash: 'מזומן', card: 'כרטיס',
};

// UI state kept across re-renders
let catTab = 'expense';
let showArchived = false;
let seq = 0;

const pressed = (b) => String(!!b);
const frag = (...nodes) => { const f = document.createDocumentFragment(); f.append(...nodes.filter(Boolean)); return f; };
const amountToInput = (a) => (!(a > 0) ? '' : a % 100 ? (a / 100).toFixed(2) : String(a / 100));
const uidLocal = (p) => `${p}-${++seq}`;

function field(labelText, control, hint) {
  const id = control.id || (control.id = uidLocal('f'));
  const hintEl = hint ? h('p', { class: 'field-hint', id: `${id}-hint` }, hint) : null;
  if (hintEl) control.setAttribute('aria-describedby', hintEl.id);
  return h('div', { class: 'field' }, h('label', { class: 'field-label', for: id }, labelText), control, hintEl);
}

function moneyInput(value, attrs = {}) {
  const input = h('input', { class: 'input', type: 'text', inputmode: 'decimal', autocomplete: 'off', dir: 'ltr', placeholder: '0', ...attrs });
  input.value = amountToInput(value);
  return h('div', { class: 'input-group' }, input, h('span', { class: 'affix', 'aria-hidden': 'true' }, '₪'));
}

function switchEl(checked, labelText, onChange, { hideLabel = false } = {}) {
  const input = h('input', { type: 'checkbox', role: 'switch' });
  input.checked = !!checked;
  input.addEventListener('change', () => onChange(input.checked));
  return h('label', { class: 'switch' }, input, h('span', { class: 'switch-track', 'aria-hidden': 'true' }),
    h('span', { class: hideLabel ? 'sr-only' : 'switch-label' }, labelText));
}

function card(title, ...body) {
  const id = uidLocal('sec');
  return h('section', { class: 'card', 'aria-labelledby': id },
    h('div', { class: 'card-hd' }, h('h2', { class: 'card-title', id }, title)),
    h('div', { class: 'card-bd stack' }, ...body));
}

function errEl() { return h('p', { class: 'field-hint tone-bad', role: 'alert', hidden: true }); }
function showErr(el, msg) { el.textContent = msg || ''; el.hidden = !msg; }

// ----------------------------------------------------------------------------
// Category editor
// ----------------------------------------------------------------------------
function iconPicker(current, color, onPick) {
  const grid = h('div', { class: 'icon-pick-grid', role: 'group', 'aria-label': 'סמל', style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(44px,1fr));gap:6px' });
  let value = current;
  let tint = color;
  const paint = () => grid.replaceChildren(...ICONS_FOR_CATEGORIES.map((ic) => h('button', {
    type: 'button', class: 'icon-btn', 'aria-label': ICON_LABELS[ic] || ic, title: ICON_LABELS[ic] || ic, 'aria-pressed': pressed(ic === value),
    style: ic === value ? `color:var(--cat-${tint});background:color-mix(in srgb, var(--cat-${tint}) 16%, transparent);box-shadow:inset 0 0 0 2px var(--cat-${tint})` : '',
    on: { click: () => { value = ic; paint(); onPick(ic); } },
  }, icon(ic))));
  paint();
  grid.setColor = (c) => { tint = c; paint(); };
  return grid;
}

function colorPicker(current, onPick) {
  const grid = h('div', { class: 'color-pick-grid', role: 'group', 'aria-label': 'צבע', style: 'display:flex;flex-wrap:wrap;gap:8px' });
  let value = current;
  const paint = () => grid.replaceChildren(...Array.from({ length: 12 }, (_, i) => i + 1).map((c) => h('button', {
    type: 'button', class: 'swatch', 'aria-label': `צבע ${c}`, 'aria-pressed': pressed(c === value),
    style: `width:36px;height:36px;border-radius:50%;cursor:pointer;background:var(--cat-${c});border:3px solid ${c === value ? 'var(--surface)' : 'transparent'};box-shadow:${c === value ? `0 0 0 2px var(--cat-${c})` : 'none'};outline-offset:3px`,
    on: { click: () => { value = c; paint(); onPick(c); } },
  })));
  paint();
  return grid;
}

function openCategorySheet(store, cat, type) {
  const isNew = !cat;
  const state = store.state;
  type = cat?.type || type;
  const draft = { name: cat?.name || '', icon: cat?.icon || (type === 'income' ? 'wallet' : 'dots'), color: cat?.color || ((state.categories.length % 12) + 1), budget: cat?.budget || 0 };

  const preview = h('div', { class: 'cluster' });
  const paintPreview = () => preview.replaceChildren(catBadge({ ...draft, name: draft.name || 'קטגוריה', id: 'preview' }, { size: 'lg' }),
    h('strong', { class: 'text-lg' }, draft.name || 'קטגוריה חדשה'));

  const nameErr = errEl();
  const name = h('input', { class: 'input', maxlength: '30', autocomplete: 'off', placeholder: 'למשל: חוגים' });
  name.value = draft.name;
  name.addEventListener('input', () => { draft.name = name.value; paintPreview(); showErr(nameErr, ''); });

  const icons = iconPicker(draft.icon, draft.color, (ic) => { draft.icon = ic; paintPreview(); });
  const colors = colorPicker(draft.color, (c) => { draft.color = c; icons.setColor(c); paintPreview(); });

  const budgetErr = errEl();
  const budgetWrap = moneyInput(draft.budget);
  const budget = budgetWrap.querySelector('input');

  // Delete / archive area (existing categories only)
  let dangerZone = null;
  if (!isNew) {
    const count = state.transactions.filter((t) => t.categoryId === cat.id).length;
    const others = state.categories.filter((c) => c.type === cat.type && c.id !== cat.id && !c.archived);
    const reassign = h('select', { class: 'select' },
      h('option', { value: '' }, count ? 'לא להעביר — להעביר את הקטגוריה לארכיון' : 'ללא'),
      others.map((c) => h('option', { value: c.id }, c.name)));
    dangerZone = h('div', { class: 'stack', style: 'border-top:1px solid var(--border);padding-top:16px' },
      h('h3', { class: 'section-title', style: 'margin:0' }, 'מחיקה וארכיון'),
      h('p', { class: 'text-sm muted' }, count
        ? `בקטגוריה יש ${count.toLocaleString('he-IL')} תנועות. אפשר להעביר אותן לקטגוריה אחרת ולמחוק, או להעביר את הקטגוריה לארכיון (התנועות יישמרו, והיא לא תופיע ברישום).`
        : 'אין תנועות בקטגוריה הזו, אפשר למחוק אותה בבטחה.'),
      count ? field('העברת התנועות אל', reassign) : null,
      h('div', { class: 'cluster', style: 'flex-wrap:wrap' },
        h('button', {
          type: 'button', class: 'btn btn-ghost btn-sm', on: {
            click: () => {
              store.updateCategory(cat.id, { archived: !cat.archived });
              toast(cat.archived ? `${cat.name} הוחזרה מהארכיון` : `${cat.name} הועברה לארכיון`, {
                actionLabel: 'ביטול', onAction: () => store.updateCategory(cat.id, { archived: !!cat.archived }),
              });
              sheet.close();
            },
          },
        }, icon(cat.archived ? 'undo' : 'lock', { size: 18 }), cat.archived ? 'החזרה מהארכיון' : 'העברה לארכיון'),
        h('button', {
          type: 'button', class: 'btn btn-danger btn-sm', on: {
            click: async () => {
              const target = reassign.value || null;
              const targetName = target ? catById(store.state, target).name : '';
              const ok = await confirmDialog({
                title: `למחוק את "${cat.name}"?`,
                text: count
                  ? (target ? `${count} התנועות יועברו אל "${targetName}" והקטגוריה תימחק.` : 'הקטגוריה תועבר לארכיון כי יש בה תנועות.')
                  : 'הפעולה לא ניתנת לביטול.',
                confirmLabel: count && !target ? 'העברה לארכיון' : 'מחיקה',
                danger: true,
              });
              if (!ok) return;
              store.deleteCategory(cat.id, target);
              toast(count && !target ? `${cat.name} הועברה לארכיון` : `${cat.name} נמחקה`);
              sheet.close();
            },
          },
        }, icon('trash', { size: 18 }), 'מחיקה')));
  }

  const content = h('form', { class: 'stack', novalidate: true },
    preview,
    field('שם', name), nameErr,
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'סמל'), icons),
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'צבע'), colors),
    type === 'expense' ? h('div', {}, field('תקציב חודשי', budgetWrap, 'השאירו ריק אם אין תקציב לקטגוריה הזו.'), budgetErr) : null,
    dangerZone);
  content.addEventListener('submit', (e) => { e.preventDefault(); save(); });
  content.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); save(); }
  });

  function save() {
    const v = name.value.trim();
    if (!v) { showErr(nameErr, 'נא לתת שם לקטגוריה'); name.focus(); return; }
    const dup = store.state.categories.some((c) => c.type === type && c.id !== cat?.id && !c.archived && c.name.trim() === v);
    if (dup) { showErr(nameErr, 'כבר יש קטגוריה בשם הזה'); name.focus(); return; }
    let b = 0;
    if (type === 'expense' && budget.value.trim()) {
      b = parseMoney(budget.value);
      if (!Number.isFinite(b) || b < 0) { showErr(budgetErr, 'סכום לא תקין'); budget.focus(); return; }
    }
    const patch = { name: v, icon: draft.icon, color: draft.color, budget: type === 'expense' ? b : 0 };
    if (isNew) { store.addCategory({ ...patch, type }); toast(`נוספה קטגוריה: ${v}`, { tone: 'good' }); }
    else { store.updateCategory(cat.id, patch); toast('הקטגוריה עודכנה', { tone: 'good' }); }
    sheet.close();
  }

  paintPreview();
  const footer = frag(
    h('button', { type: 'button', class: 'btn btn-ghost', on: { click: () => sheet.close() } }, 'ביטול'),
    h('button', { type: 'button', class: 'btn btn-primary', on: { click: save } }, icon('check'), isNew ? 'הוספת קטגוריה' : 'שמירה'));
  const sheet = openSheet({ title: isNew ? (type === 'income' ? 'קטגוריית הכנסה חדשה' : 'קטגוריית הוצאה חדשה') : 'עריכת קטגוריה', content, footer });
  // Fix label target for the money input (field() labeled the wrapper)
  const lbl = content.querySelector(`label[for="${budgetWrap.id}"]`);
  if (lbl) { budget.id = uidLocal('budget'); lbl.setAttribute('for', budget.id); budget.setAttribute('aria-describedby', `${budgetWrap.id}-hint`); }
  setTimeout(() => name.focus(), 40);
}

// ----------------------------------------------------------------------------
// Recurring editor
// ----------------------------------------------------------------------------
function openRecurringSheet(store, rec, today) {
  const isNew = !rec;
  const state = store.state;
  const d = {
    type: rec?.type || 'expense', amount: rec?.amount || 0, categoryId: rec?.categoryId || null, note: rec?.note || '',
    payment: rec?.payment || 'card', day: rec?.day || Number(today.slice(8, 10)), startMonth: rec?.startMonth || today.slice(0, 7),
    endMonth: rec?.endMonth || '', active: rec ? rec.active !== false : true,
  };

  const amountErr = errEl();
  const amountWrap = moneyInput(d.amount, { id: uidLocal('ramt') });
  const amount = amountWrap.querySelector('input');

  const catSel = h('select', { class: 'select', id: uidLocal('rcat') });
  const paintCats = () => {
    const cats = store.state.categories.filter((c) => c.type === d.type && (!c.archived || c.id === d.categoryId)).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    if (!cats.some((c) => c.id === d.categoryId)) d.categoryId = cats[0]?.id || null;
    catSel.replaceChildren(...cats.map((c) => h('option', { value: c.id }, c.name)));
    catSel.value = d.categoryId || '';
  };
  catSel.addEventListener('change', () => { d.categoryId = catSel.value; });

  const typeSeg = segmented([{ value: 'expense', label: 'הוצאה' }, { value: 'income', label: 'הכנסה' }], d.type,
    (v) => { d.type = v; paintCats(); }, { label: 'סוג' });

  const note = h('input', { class: 'input', id: uidLocal('rnote'), maxlength: '120', autocomplete: 'off', placeholder: 'למשל: שכר דירה, נטפליקס, משכורת' });
  note.value = d.note;

  const pay = h('select', { class: 'select', id: uidLocal('rpay') }, PAYMENTS.map((p) => h('option', { value: p.id }, p.label)));
  pay.value = d.payment;

  const day = h('select', { class: 'select', id: uidLocal('rday') }, Array.from({ length: 31 }, (_, i) => h('option', { value: String(i + 1) }, String(i + 1))));
  day.value = String(d.day);

  const start = h('input', { class: 'input', type: 'month', id: uidLocal('rstart') });
  start.value = d.startMonth;
  const end = h('input', { class: 'input', type: 'month', id: uidLocal('rend') });
  end.value = d.endMonth;
  const dateErr = errEl();

  const active = switchEl(d.active, 'פעיל', (v) => { d.active = v; });
  paintCats();

  const content = h('form', { class: 'stack', novalidate: true },
    typeSeg,
    field('סכום', amountWrap), amountErr,
    field('קטגוריה', catSel),
    field('תיאור', note),
    h('div', { class: 'grid grid-2', style: 'gap:12px' },
      field('יום בחודש', day, 'בחודשים קצרים — היום האחרון בחודש.'),
      field('אמצעי תשלום', pay)),
    h('div', { class: 'grid grid-2', style: 'gap:12px' },
      field('החל מחודש', start),
      field('עד חודש (לא חובה)', end)),
    dateErr,
    active);
  content.addEventListener('submit', (e) => { e.preventDefault(); save(); });
  content.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') { e.preventDefault(); save(); }
  });

  function save() {
    const v = parseMoney(amount.value);
    if (!Number.isFinite(v) || v <= 0) { showErr(amountErr, 'נא להזין סכום גדול מאפס'); amount.focus(); return; }
    showErr(amountErr, '');
    if (!catSel.value) { toast('צריך קודם ליצור קטגוריה'); return; }
    if (!/^\d{4}-\d{2}$/.test(start.value)) { showErr(dateErr, 'נא לבחור חודש התחלה'); start.focus(); return; }
    if (end.value && end.value < start.value) { showErr(dateErr, 'חודש הסיום לפני חודש ההתחלה'); end.focus(); return; }
    const data = {
      type: d.type, amount: v, categoryId: catSel.value, note: note.value.trim(), payment: pay.value,
      day: Number(day.value), startMonth: start.value, endMonth: end.value || null, active: d.active,
    };
    const before = store.state.transactions.length;
    if (isNew) store.addRecurring(data, today);
    else store.updateRecurring(rec.id, data, today);
    const created = Math.max(0, store.state.transactions.length - before);
    toast(isNew ? `נוספה ${d.type === 'income' ? 'הכנסה' : 'הוצאה'} קבועה${created ? ` · נוצרו ${created} תנועות` : ''}` : 'עודכן', { tone: 'good' });
    sheet.close();
  }

  async function remove() {
    const ok = await confirmDialog({ title: 'למחוק את ההוראה הקבועה?', text: `${rec.note || catById(store.state, rec.categoryId).name} · ${fmtMoney(rec.amount)} בחודש`, confirmLabel: 'מחיקה', danger: true });
    if (!ok) return;
    const future = store.state.transactions.filter((t) => t.recurringId === rec.id && t.date > today).length;
    let removeFuture = false;
    if (future) {
      removeFuture = await confirmDialog({
        title: 'למחוק גם תנועות עתידיות?',
        text: `כבר נוצרו ${future} תנועות עתידיות מההוראה הזו. תנועות שכבר עברו יישמרו בכל מקרה.`,
        confirmLabel: 'למחוק גם אותן', cancelLabel: 'להשאיר אותן',
      });
    }
    store.deleteRecurring(rec.id, { removeFuture });
    toast('ההוראה הקבועה נמחקה');
    sheet.close();
  }

  const footer = frag(
    isNew ? null : h('button', { type: 'button', class: 'btn btn-ghost btn-danger', on: { click: remove } }, icon('trash'), 'מחיקה'),
    h('button', { type: 'button', class: 'btn btn-primary', on: { click: save } }, icon('check'), isNew ? 'הוספה' : 'שמירה'));
  const sheet = openSheet({ title: isNew ? 'הוצאה / הכנסה קבועה' : 'עריכת תנועה קבועה', content, footer });
  setTimeout(() => amount.focus(), 40);
}

// ----------------------------------------------------------------------------
// View
// ----------------------------------------------------------------------------
export default {
  id: 'settings',
  title: 'הגדרות',
  render(root, ctx) {
    const store = ctx.store;
    const state = store.state;
    const s = state.settings;
    const today = ctx.today || todayISO();

    // ---- Profile & month ----
    const nameIn = h('input', { class: 'input', id: 'set-name', maxlength: '40', autocomplete: 'given-name', placeholder: 'השם שלך (לא חובה)' });
    nameIn.value = s.name || '';
    nameIn.addEventListener('change', () => store.updateSettings({ name: nameIn.value.trim() }));

    const startSel = h('select', { class: 'select', id: 'set-start' },
      Array.from({ length: 28 }, (_, i) => h('option', { value: String(i + 1) }, i === 0 ? '1 (תחילת החודש הקלנדרי)' : String(i + 1))));
    startSel.value = String(s.monthStartDay || 1);
    startSel.addEventListener('change', () => {
      store.updateSettings({ monthStartDay: Number(startSel.value) });
      toast('החודש התקציבי עודכן');
    });
    const startHint = (() => {
      const d = s.monthStartDay || 1;
      if (d === 1) return 'יום קבלת המשכורת. כרגע כל חודש מתחיל ב־1 לחודש.';
      return `יום קבלת המשכורת. למשל, "${fmtMonth(today.slice(0, 7))}" יימשך מה־${d} בחודש ועד ה־${d - 1} בחודש הבא.`;
    })();

    const goalErr = errEl();
    const goalWrap = moneyInput(s.savingsGoal, { id: 'set-goal' });
    const goalIn = goalWrap.querySelector('input');
    goalIn.addEventListener('change', () => {
      const raw = goalIn.value.trim();
      const v = raw ? parseMoney(raw) : 0;
      if (!Number.isFinite(v) || v < 0) { showErr(goalErr, 'סכום לא תקין'); return; }
      showErr(goalErr, '');
      store.updateSettings({ savingsGoal: v });
      toast(v ? `יעד החיסכון: ${fmtMoney(v)} בחודש` : 'יעד החיסכון הוסר');
    });
    goalIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); goalIn.blur(); } });
    nameIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); nameIn.blur(); } });

    const profile = card('פרופיל וחודש',
      h('div', { class: 'grid grid-2', style: 'gap:16px' },
        field('שם', nameIn),
        h('div', {}, field('יעד חיסכון חודשי', goalWrap, 'כמה תרצו לחסוך בכל חודש. מופיע בסקירה.'), goalErr)),
      field('החודש מתחיל ביום', startSel, startHint));
    // label for money input should point at the input
    goalIn.id = 'set-goal-in';
    profile.querySelector('label[for="set-goal"]')?.setAttribute('for', 'set-goal-in');
    goalIn.setAttribute('aria-describedby', 'set-goal-hint');

    // ---- Appearance ----
    const themeSeg = segmented([
      { value: 'system', label: 'מערכת', icon: 'monitor' },
      { value: 'light', label: 'בהיר', icon: 'sun' },
      { value: 'dark', label: 'כהה', icon: 'moon' },
    ], s.theme || 'system', (v) => store.updateSettings({ theme: v }), { label: 'ערכת צבעים' });
    const appearance = card('מראה', h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'ערכת צבעים'), themeSeg));

    // ---- Categories & budgets ----
    const cats = state.categories.filter((c) => c.type === catTab).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const activeCats = cats.filter((c) => !c.archived);
    const archived = cats.filter((c) => c.archived);
    const usage = new Map();
    for (const t of state.transactions) usage.set(t.categoryId, (usage.get(t.categoryId) || 0) + 1);

    const move = (cat, dir) => {
      const ordered = state.categories.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const peers = ordered.filter((c) => c.type === cat.type && !c.archived);
      const i = peers.findIndex((c) => c.id === cat.id);
      const j = i + dir;
      if (j < 0 || j >= peers.length) return;
      const other = peers[j];
      const ids = ordered.map((c) => c.id);
      const a = ids.indexOf(cat.id), b = ids.indexOf(other.id);
      [ids[a], ids[b]] = [ids[b], ids[a]];
      store.reorderCategories(ids);
      // keep focus on the same control after the re-render
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const same = document.querySelector(`[data-move="${cat.id}:${dir}"]`);
        (same && !same.disabled ? same : document.querySelector(`[data-move="${cat.id}:${-dir}"]`))?.focus();
      }));
    };

    const catRow = (c, i, list) => h('li', { style: 'display:flex;align-items:center;gap:2px;min-width:0' },
      h('button', { type: 'button', class: 'tx-row', style: 'flex:1 1 auto;min-width:0', on: { click: () => openCategorySheet(store, c, c.type) } },
        catBadge(c),
        h('div', { class: 'tx-main' },
          h('div', { class: 'tx-title' }, c.name),
          h('div', { class: 'tx-sub' }, h('span', { class: 'tx-sub-text' },
            c.type === 'expense' ? (c.budget ? h('span', {}, 'תקציב ', money(c.budget)) : 'ללא תקציב') : '',
            c.type === 'expense' ? ' · ' : '', `${(usage.get(c.id) || 0).toLocaleString('he-IL')} תנועות`))),
        h('span', { class: 'sr-only' }, ' – עריכה')),
      c.archived ? null : h('button', { type: 'button', class: 'icon-btn', 'aria-label': `הזזת ${c.name} למעלה`, disabled: i === 0, dataset: { move: `${c.id}:-1` }, on: { click: () => move(c, -1) } }, icon('arrow-up', { size: 18 })),
      c.archived ? null : h('button', { type: 'button', class: 'icon-btn', 'aria-label': `הזזת ${c.name} למטה`, disabled: i === list.length - 1, dataset: { move: `${c.id}:1` }, on: { click: () => move(c, 1) } }, icon('arrow-down', { size: 18 })));

    const budgetTotal = state.categories.filter((c) => c.type === 'expense' && !c.archived).reduce((sum, c) => sum + (c.budget || 0), 0);
    const hist = history(state, 4).filter((m) => m.income > 0);
    const avgIncome = hist.length ? Math.round(hist.reduce((a, m) => a + m.income, 0) / hist.length) : 0;
    let budgetLine;
    if (!budgetTotal) budgetLine = h('p', { class: 'text-sm muted' }, 'עוד לא הוגדרו תקציבים. הגדירו תקציב חודשי לקטגוריות כדי לקבל התראות לפני חריגה.');
    else {
      const over = avgIncome && budgetTotal > avgIncome;
      budgetLine = h('div', { class: 'cluster text-sm', style: 'gap:6px 16px;flex-wrap:wrap' },
        h('span', {}, 'סך התקציבים: ', h('strong', {}, money(budgetTotal))),
        avgIncome ? h('span', { class: 'muted' }, 'הכנסה ממוצעת: ', money(avgIncome, { tone: 'income' })) : null,
        avgIncome ? h('span', { class: over ? 'tone-bad' : 'tone-good' },
          over ? `חריגה של ${fmtMoney(budgetTotal - avgIncome)} מעל ההכנסה` : `נשארים ${fmtMoney(avgIncome - budgetTotal)} לחיסכון`) : null);
    }

    const catTabs = segmented([{ value: 'expense', label: 'הוצאות' }, { value: 'income', label: 'הכנסות' }], catTab,
      (v) => { catTab = v; showArchived = false; ctx.setPeriod(ctx.period); }, { label: 'סוג קטגוריות' });

    const categories = card('קטגוריות ותקציבים',
      h('div', { class: 'spread', style: 'flex-wrap:wrap;gap:12px' }, catTabs,
        h('button', { type: 'button', class: 'btn btn-ghost btn-sm', on: { click: () => openCategorySheet(store, null, catTab) } }, icon('plus', { size: 18 }), 'קטגוריה חדשה')),
      catTab === 'expense' ? budgetLine : null,
      activeCats.length
        ? h('ul', { class: 'tx-list cat-list', role: 'list' }, activeCats.map((c, i) => catRow(c, i, activeCats)))
        : h('p', { class: 'muted' }, 'אין קטגוריות פעילות.'),
      archived.length ? h('div', {},
        h('button', {
          type: 'button', class: 'btn btn-ghost btn-sm', 'aria-expanded': String(showArchived),
          on: { click: () => { showArchived = !showArchived; ctx.setPeriod(ctx.period); } },
        }, icon(showArchived ? 'chevron-down' : 'chevron-left', { size: 18 }), `בארכיון (${archived.length})`),
        showArchived ? h('ul', { class: 'tx-list cat-list', role: 'list', style: 'opacity:.8' }, archived.map((c, i) => catRow(c, i, archived))) : null) : null);

    // ---- Recurring ----
    const recs = state.recurring.slice().sort((a, b) => (a.type === b.type ? 0 : a.type === 'income' ? -1 : 1) || a.day - b.day);
    const recMonthly = recs.filter((r) => r.active !== false && (!r.endMonth || r.endMonth >= today.slice(0, 7)));
    const recExp = recMonthly.filter((r) => r.type === 'expense').reduce((a, r) => a + r.amount, 0);
    const recInc = recMonthly.filter((r) => r.type === 'income').reduce((a, r) => a + r.amount, 0);
    const recRow = (r) => {
      const cat = catById(state, r.categoryId);
      const ended = r.endMonth && r.endMonth < today.slice(0, 7);
      return h('li', { style: 'display:flex;align-items:center;gap:8px;min-width:0' },
        h('button', { type: 'button', class: 'tx-row', style: `flex:1 1 auto;min-width:0;${r.active === false || ended ? 'opacity:.6' : ''}`, on: { click: () => openRecurringSheet(store, r, today) } },
          catBadge(cat),
          h('div', { class: 'tx-main' },
            h('div', { class: 'tx-title' }, r.note || cat.name),
            h('div', { class: 'tx-sub' }, h('span', { class: 'tx-sub-text' },
              `ב־${r.day} בכל חודש${r.note ? ` · ${cat.name}` : ''}`,
              ended ? ` · הסתיים ב${fmtMonth(r.endMonth)}` : r.endMonth ? ` · עד ${fmtMonth(r.endMonth)}` : ''))),
          h('div', { class: r.type === 'income' ? 'tx-amt is-income' : 'tx-amt' }, money(r.type === 'income' ? r.amount : -r.amount, { sign: true })),
          h('span', { class: 'sr-only' }, ' – עריכה')),
        switchEl(r.active !== false, `${r.note || cat.name} פעיל`, (v) => {
          store.updateRecurring(r.id, { active: v }, today);
          toast(v ? 'ההוראה הופעלה' : 'ההוראה הושהתה');
        }, { hideLabel: true }));
    };
    const recurring = card('הוצאות והכנסות קבועות',
      h('div', { class: 'spread', style: 'flex-wrap:wrap;gap:12px' },
        h('p', { class: 'text-sm muted', style: 'margin:0' }, 'שכר דירה, מנויים, משכורת — נרשמים אוטומטית בכל חודש.'),
        h('button', { type: 'button', class: 'btn btn-ghost btn-sm', on: { click: () => openRecurringSheet(store, null, today) } }, icon('plus', { size: 18 }), 'הוספה')),
      recs.length
        ? h('ul', { class: 'tx-list', role: 'list' }, recs.map(recRow))
        : emptyState({ icon: 'repeat', title: 'אין עדיין תנועות קבועות', text: 'הוסיפו כאן הוצאות שחוזרות כל חודש, או סמנו "חוזר כל חודש" בזמן הרישום.' }),
      recs.length ? h('div', { class: 'cluster text-sm', style: 'gap:6px 16px;flex-wrap:wrap' },
        h('span', {}, 'קבועות בחודש: '),
        h('span', {}, 'הוצאות ', money(recExp)),
        recInc ? h('span', {}, 'הכנסות ', money(recInc, { tone: 'income' })) : null) : null);

    // ---- Data ----
    const fileIn = h('input', { type: 'file', accept: '.json,.csv,application/json,text/csv', class: 'sr-only', id: 'set-import', tabindex: '-1', 'aria-hidden': 'true' });
    fileIn.addEventListener('change', async () => {
      const file = fileIn.files?.[0];
      fileIn.value = '';
      if (!file) return;
      try {
        const res = await importFile(file, store.state);
        if (res.kind === 'json') {
          const cur = store.state.transactions.length;
          const ok = await confirmDialog({
            title: 'שחזור מגיבוי',
            text: `הגיבוי מכיל ${res.added.toLocaleString('he-IL')} תנועות.${cur ? ` הוא יחליף את כל הנתונים הנוכחיים (${cur.toLocaleString('he-IL')} תנועות).` : ''}`,
            confirmLabel: 'שחזור', danger: cur > 0,
          });
          if (!ok) return;
          store.replaceAll(res.state);
          toast(`שוחזרו ${res.added.toLocaleString('he-IL')} תנועות`, { tone: 'good' });
        } else {
          const skipped = res.skipped || 0;
          if (!res.added) {
            toast(skipped ? `כל ${skipped.toLocaleString('he-IL')} התנועות בקובץ כבר קיימות` : 'לא נמצאו תנועות בקובץ', { tone: 'warn' });
            return;
          }
          store.replaceAll(res.state);
          toast(`יובאו ${res.added.toLocaleString('he-IL')} תנועות${skipped ? ` (${skipped.toLocaleString('he-IL')} כפולות דולגו)` : ''}`, { tone: 'good' });
        }
      } catch (err) {
        console.error(err);
        toast(`הייבוא נכשל: ${err?.message || 'הקובץ לא תקין'}`, { tone: 'bad', timeout: 7000 });
      }
    });
    const stamp = today;
    const txCount = state.transactions.length;
    const data = card('נתונים',
      h('p', { class: 'text-sm', style: 'margin:0' }, icon('lock', { size: 16 }), ' הנתונים נשמרים רק במכשיר הזה, בדפדפן. כדאי לשמור גיבוי מדי פעם — במיוחד לפני ניקוי נתוני גלישה או החלפת מכשיר.'),
      h('p', { class: 'text-sm muted', style: 'margin:0' }, `${txCount.toLocaleString('he-IL')} תנועות · ${state.categories.length} קטגוריות · ${state.recurring.length} קבועות`),
      h('div', { class: 'cluster', style: 'flex-wrap:wrap;gap:8px' },
        h('button', { type: 'button', class: 'btn', on: { click: () => { download(exportJSON(store.state), `maazan-backup-${stamp}.json`); toast('הגיבוי נשמר'); } } }, icon('download', { size: 18 }), 'גיבוי (JSON)'),
        h('button', { type: 'button', class: 'btn', disabled: !txCount, on: { click: () => { download(exportCSV(store.state), `maazan-${stamp}.csv`); toast('קובץ CSV נשמר'); } } }, icon('download', { size: 18 }), 'ייצוא לאקסל (CSV)'),
        h('button', { type: 'button', class: 'btn', on: { click: () => fileIn.click() } }, icon('upload', { size: 18 }), 'ייבוא מקובץ'),
        fileIn),
      h('p', { class: 'field-hint', style: 'margin:0' }, 'ייבוא JSON משחזר גיבוי מלא. ייבוא CSV מוסיף תנועות (עמודות: תאריך, סוג, קטגוריה, סכום, אמצעי תשלום, הערה).'),
      h('div', { class: 'cluster', style: 'flex-wrap:wrap;gap:8px;border-top:1px solid var(--border);padding-top:16px' },
        h('button', {
          type: 'button', class: 'btn btn-ghost', on: {
            click: async () => {
              if (store.state.transactions.length) {
                const ok = await confirmDialog({ title: 'לטעון נתוני הדגמה?', text: 'נתוני ההדגמה יחליפו את כל הנתונים הקיימים. כדאי לשמור גיבוי קודם.', confirmLabel: 'טעינה', danger: true });
                if (!ok) return;
              }
              store.loadDemo(today);
              toast('נטענו נתוני הדגמה', { tone: 'good' });
            },
          },
        }, icon('sparkle', { size: 18 }), 'טעינת נתוני הדגמה'),
        h('button', {
          type: 'button', class: 'btn btn-danger', on: {
            click: async () => {
              const ok1 = await confirmDialog({ title: 'איפוס כל הנתונים?', text: 'כל התנועות, הקטגוריות וההגדרות יימחקו מהמכשיר.', confirmLabel: 'המשך', danger: true });
              if (!ok1) return;
              const ok2 = await confirmDialog({ title: 'בטוחים?', text: 'אי אפשר לשחזר את הנתונים אחרי האיפוס, אלא מקובץ גיבוי.', confirmLabel: 'מחיקת הכל', danger: true });
              if (!ok2) return;
              store.reset();
              toast('כל הנתונים אופסו');
            },
          },
        }, icon('trash', { size: 18 }), 'איפוס כל הנתונים')));

    root.append(h('div', { class: 'page' },
      h('div', { class: 'page-hd' }, h('div', {}, h('h1', { class: 'page-title' }, 'הגדרות'), h('p', { class: 'page-sub' }, 'התאמה אישית, קטגוריות, תקציבים וגיבוי'))),
      h('div', { class: 'grid grid-2 settings-grid', style: 'align-items:start' },
        h('div', { class: 'stack gap-lg' }, profile, appearance, recurring),
        h('div', { class: 'stack gap-lg' }, categories, data)),
      h('p', { class: 'text-sm muted', style: 'text-align:center;margin:32px 0 8px' }, `מאזן · גרסה ${VERSION}`)));
  },
};
