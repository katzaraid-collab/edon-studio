// Add / edit transaction sheet. Goal: an expense in ~3 seconds (amount → Enter).
import { h, icon, catBadge, toast, openSheet, confirmDialog, segmented, ICONS_FOR_CATEGORIES } from '../ui.js';
import { PAYMENTS, fmtMoney, parseMoney, todayISO, toISO, fromISO, fmtDate } from '../format.js';
import { catById } from '../model.js';
import { store as defaultStore } from '../store.js';

const LAST_KEY = 'maazan:last';
const GRID_LIMIT = 11;
let seq = 0;

export function readLast() {
  try { return JSON.parse(localStorage.getItem(LAST_KEY)) || {}; } catch { return {}; }
}
function writeLast(patch) {
  try { localStorage.setItem(LAST_KEY, JSON.stringify({ ...readLast(), ...patch })); } catch { /* private mode */ }
}

const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const pressed = (b) => String(!!b);

function shiftDays(iso, n) {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

function amountToInput(agorot) {
  if (!(agorot > 0)) return '';
  return agorot % 100 ? (agorot / 100).toFixed(2) : String(agorot / 100);
}

/** Non-archived categories of a type, most used in the last 90 days first, then by manual order. */
export function rankedCategories(state, type, today = todayISO()) {
  const from = shiftDays(today, -90);
  const counts = new Map();
  for (const t of state.transactions) {
    if (t.type === type && t.date >= from) counts.set(t.categoryId, (counts.get(t.categoryId) || 0) + 1);
  }
  return state.categories
    .filter((c) => c.type === type && !c.archived)
    .sort((a, b) => (counts.get(b.id) || 0) - (counts.get(a.id) || 0) || (a.order ?? 0) - (b.order ?? 0));
}

function recentNotes(state, type, categoryId) {
  const list = state.transactions
    .filter((t) => t.type === type && t.note && (!categoryId || t.categoryId === categoryId))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
  const seen = new Set();
  const out = [];
  for (const t of list) {
    const k = norm(t.note);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t.note.trim());
    if (out.length >= 15) break;
  }
  return out;
}

function usualCategory(state, type, note) {
  const k = norm(note);
  if (!k) return null;
  const counts = new Map();
  for (const t of state.transactions) {
    if (t.type === type && norm(t.note) === k) counts.set(t.categoryId, (counts.get(t.categoryId) || 0) + 1);
  }
  let best = null, max = 0;
  for (const [id, n] of counts) if (n > max) { best = id; max = n; }
  const cat = best && state.categories.find((c) => c.id === best && !c.archived);
  return cat ? cat.id : null;
}

/** Small inline "new category" creator. Calls onCreate(cat) or onCancel(). */
export function categoryCreator(st, type, { onCreate, onCancel }) {
  const n = ++seq;
  let iconName = type === 'income' ? 'wallet' : 'dots';
  let color = (st.state.categories.length % 12) + 1;
  const err = h('p', { class: 'field-hint tone-bad', role: 'alert', hidden: true });
  const name = h('input', { class: 'input', id: `newcat-name-${n}`, maxlength: '30', autocomplete: 'off', placeholder: type === 'income' ? 'למשל: שכר דירה מהשוכר' : 'למשל: חוגים' });
  const icons = h('div', { class: 'icon-pick-grid', role: 'group', 'aria-label': 'סמל', style: 'display:flex;flex-wrap:wrap;gap:6px' });
  const colors = h('div', { class: 'color-pick-grid', role: 'group', 'aria-label': 'צבע', style: 'display:flex;flex-wrap:wrap;gap:6px' });
  const paint = () => {
    icons.replaceChildren(...ICONS_FOR_CATEGORIES.map((ic) => h('button', {
      type: 'button', class: 'icon-btn', 'aria-label': `סמל ${ic}`, 'aria-pressed': pressed(ic === iconName),
      style: ic === iconName ? `color:var(--cat-${color});box-shadow:inset 0 0 0 2px var(--cat-${color})` : '',
      on: { click: () => { iconName = ic; paint(); } },
    }, icon(ic))));
    colors.replaceChildren(...Array.from({ length: 12 }, (_, i) => i + 1).map((c) => h('button', {
      type: 'button', class: 'swatch', 'aria-label': `צבע ${c}`, 'aria-pressed': pressed(c === color),
      style: `width:32px;height:32px;border-radius:50%;border:2px solid ${c === color ? 'var(--text)' : 'transparent'};background:var(--cat-${c});cursor:pointer;outline-offset:2px`,
      on: { click: () => { color = c; paint(); } },
    })));
  };
  paint();
  const create = () => {
    const v = name.value.trim();
    if (!v) { err.textContent = 'נא לתת שם לקטגוריה'; err.hidden = false; name.focus(); return; }
    if (st.state.categories.some((c) => c.type === type && !c.archived && norm(c.name) === norm(v))) {
      err.textContent = 'כבר יש קטגוריה בשם הזה'; err.hidden = false; name.focus(); return;
    }
    const cat = st.addCategory({ name: v, type, icon: iconName, color, budget: 0 });
    onCreate?.(cat);
  };
  name.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); create(); }
  });
  const box = h('div', { class: 'card is-flat stack', style: 'padding:14px' },
    h('div', { class: 'field' },
      h('label', { class: 'field-label', for: name.id }, type === 'income' ? 'שם קטגוריית הכנסה' : 'שם הקטגוריה'),
      name, err),
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'סמל'), icons),
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'צבע'), colors),
    h('div', { class: 'cluster' },
      h('button', { type: 'button', class: 'btn btn-primary btn-sm', on: { click: create } }, icon('check'), 'יצירה'),
      h('button', { type: 'button', class: 'btn btn-ghost btn-sm', on: { click: () => onCancel?.() } }, 'ביטול')),
  );
  setTimeout(() => name.focus(), 30);
  return box;
}

/**
 * Open the add/edit sheet.
 * defaults: {type, categoryId, date, amount (agorot), note, payment}
 */
export function openEntry(ctx = {}, tx = null, defaults = {}) {
  const st = ctx.store || defaultStore;
  const today = ctx.today || todayISO();
  const editing = !!tx;
  const n = ++seq;
  const last = readLast();

  let type = tx?.type || defaults.type || 'expense';
  let date = tx?.date || defaults.date || today;
  let payment = tx?.payment || defaults.payment || last.payment || 'card';
  let catId = tx?.categoryId || defaults.categoryId || null;
  let catExplicit = !!catId;
  let showAll = false;
  let creating = false;

  const pickDefaultCat = () => {
    const ranked = rankedCategories(st.state, type, today);
    const remembered = last[type] && ranked.find((c) => c.id === last[type]);
    catId = remembered ? remembered.id : ranked[0]?.id || null;
    catExplicit = false;
  };
  if (!catId) pickDefaultCat();

  // --- Amount -----------------------------------------------------------
  const amountErr = h('p', { class: 'field-hint tone-bad', id: `amt-err-${n}`, role: 'alert', hidden: true });
  const amount = h('input', {
    class: 'input', id: `amt-${n}`, type: 'text', inputmode: 'decimal', autocomplete: 'off', enterkeyhint: 'done',
    placeholder: '0', 'aria-describedby': amountErr.id, dir: 'ltr',
  });
  amount.value = amountToInput(tx?.amount ?? defaults.amount);
  const amountWrap = h('div', { class: 'amount-input' }, amount, h('span', { class: 'affix', 'aria-hidden': 'true' }, '₪'));
  const amountLabel = h('label', { class: 'sr-only', for: amount.id });
  amount.addEventListener('input', () => {
    if (!amountErr.hidden) validateAmount(false);
  });

  function validateAmount(show = true) {
    const raw = amount.value.trim();
    const v = parseMoney(raw);
    let msg = '';
    if (!raw) msg = 'נא להזין סכום';
    else if (!Number.isFinite(v)) msg = 'הסכום לא תקין — למשל 45 או 12.90';
    else if (v <= 0) msg = 'הסכום צריך להיות גדול מאפס';
    else if (v > 99_999_999_99) msg = 'הסכום גדול מדי';
    if (show || !msg) {
      amountErr.textContent = msg;
      amountErr.hidden = !msg;
      amount.setAttribute('aria-invalid', String(!!msg));
    }
    return msg ? null : v;
  }

  // --- Type -------------------------------------------------------------
  const typeSeg = segmented(
    [{ value: 'expense', label: 'הוצאה', icon: 'arrow-down' }, { value: 'income', label: 'הכנסה', icon: 'arrow-up' }],
    type,
    (v) => {
      if (v === type) return;
      type = v;
      showAll = false;
      creating = false;
      const keep = catId && st.state.categories.find((c) => c.id === catId && c.type === type);
      if (!keep) pickDefaultCat();
      paintType();
      paintCats();
      paintNotes();
    },
    { label: 'סוג התנועה' },
  );

  // --- Categories ---------------------------------------------------------
  const catErr = h('p', { class: 'field-hint tone-bad', role: 'alert', hidden: true });
  const catGrid = h('div', { class: 'cat-grid', role: 'group', 'aria-labelledby': `cat-lbl-${n}` });
  const creatorSlot = h('div');

  function selectCat(id, explicit) {
    catId = id;
    catExplicit = explicit;
    catErr.hidden = true;
    paintCats();
    paintNotes();
  }

  function paintCats() {
    const state = st.state;
    let cats = rankedCategories(state, type, today);
    if (catId && !cats.some((c) => c.id === catId)) {
      const cur = state.categories.find((c) => c.id === catId && c.type === type);
      if (cur) cats = [...cats, cur];
    }
    let visible = cats;
    if (!showAll && cats.length > GRID_LIMIT + 1) {
      visible = cats.slice(0, GRID_LIMIT);
      if (catId && !visible.some((c) => c.id === catId)) visible = [...visible.slice(0, GRID_LIMIT - 1), cats.find((c) => c.id === catId)];
    }
    const nodes = visible.map((c) => h('button', {
      type: 'button', class: 'cat-pick', 'aria-pressed': pressed(c.id === catId), dataset: { id: c.id },
      on: { click: () => selectCat(c.id, true) },
    }, catBadge(c, { size: 'sm' }), h('span', { class: 'cat-pick-name' }, c.name)));
    if (visible.length < cats.length) {
      nodes.push(h('button', {
        type: 'button', class: 'cat-pick is-more', 'aria-label': `הצגת כל ${cats.length} הקטגוריות`,
        on: { click: () => { showAll = true; paintCats(); catGrid.querySelectorAll('.cat-pick')[GRID_LIMIT]?.focus(); } },
      }, h('span', { class: 'cat-badge is-sm', style: '--c:var(--text-3)' }, icon('dots')), h('span', { class: 'cat-pick-name' }, `עוד ${cats.length - visible.length}`)));
    }
    nodes.push(h('button', {
      type: 'button', class: 'cat-pick is-new', 'aria-expanded': String(creating),
      on: { click: () => { creating = !creating; paintCreator(); paintCats(); } },
    }, h('span', { class: 'cat-badge is-sm', style: '--c:var(--accent)' }, icon('plus')), h('span', { class: 'cat-pick-name' }, 'קטגוריה חדשה')));
    catGrid.replaceChildren(...nodes);
  }

  function paintCreator() {
    if (!creating) { creatorSlot.replaceChildren(); return; }
    creatorSlot.replaceChildren(categoryCreator(st, type, {
      onCreate: (cat) => {
        creating = false;
        paintCreator();
        selectCat(cat.id, true);
        toast(`נוצרה קטגוריה: ${cat.name}`);
        amount.focus();
      },
      onCancel: () => { creating = false; paintCreator(); paintCats(); },
    }));
  }

  // --- Note ---------------------------------------------------------------
  const listId = `notes-${n}`;
  const datalist = h('datalist', { id: listId });
  const note = h('input', {
    class: 'input', id: `note-${n}`, type: 'text', list: listId, autocomplete: 'off', maxlength: '120', enterkeyhint: 'done',
    placeholder: type === 'income' ? 'למשל: משכורת אוקטובר' : 'שופרסל, ארוחת צהריים…',
  });
  note.value = tx?.note ?? defaults.note ?? '';
  function paintNotes() {
    const notes = recentNotes(st.state, type, catExplicit ? catId : null);
    datalist.replaceChildren(...notes.map((v) => h('option', { value: v })));
    note.placeholder = type === 'income' ? 'למשל: משכורת, החזר מס…' : 'שופרסל, ארוחת צהריים…';
  }
  const autoPick = () => {
    if (catExplicit) return;
    const id = usualCategory(st.state, type, note.value);
    if (id && id !== catId) { catId = id; paintCats(); }
  };
  note.addEventListener('change', autoPick);
  note.addEventListener('input', (e) => {
    // Picking from the datalist fires an input event without a key (inputType is missing / "insertReplacementText").
    if (!e.inputType || e.inputType === 'insertReplacementText') autoPick();
  });

  // --- Date -----------------------------------------------------------------
  const dateInput = h('input', { class: 'input', type: 'date', id: `date-${n}`, max: shiftDays(today, 366), style: 'width:auto;min-width:0;flex:1 1 140px' });
  dateInput.value = date;
  const chipToday = h('button', { type: 'button', class: 'chip', on: { click: () => setDate(today) } }, 'היום');
  const chipYesterday = h('button', { type: 'button', class: 'chip', on: { click: () => setDate(shiftDays(today, -1)) } }, 'אתמול');
  function setDate(v) {
    date = v || today;
    dateInput.value = date;
    paintDate();
  }
  function paintDate() {
    chipToday.setAttribute('aria-pressed', pressed(date === today));
    chipYesterday.setAttribute('aria-pressed', pressed(date === shiftDays(today, -1)));
    recurHint.textContent = `ב־${fromISO(date).getDate()} בכל חודש, החל מ${fmtDate(date)}`;
  }
  dateInput.addEventListener('change', () => setDate(dateInput.value));

  // --- Payment -----------------------------------------------------------
  const payChips = h('div', { class: 'chips', role: 'group', 'aria-labelledby': `pay-lbl-${n}` });
  function paintPay() {
    payChips.replaceChildren(...PAYMENTS.map((p) => h('button', {
      type: 'button', class: 'chip', 'aria-pressed': pressed(p.id === payment),
      on: { click: () => { payment = p.id; paintPay(); } },
    }, icon(p.icon, { size: 16 }), p.label)));
  }

  // --- Recurring ------------------------------------------------------------
  const recurHint = h('span', { class: 'field-hint', id: `rec-hint-${n}` });
  const recur = h('input', { type: 'checkbox', role: 'switch', id: `rec-${n}`, 'aria-describedby': recurHint.id });
  const recurField = editing
    ? (tx.recurringId ? h('p', { class: 'field-hint' }, icon('repeat', { size: 16 }), ' תנועה שנוצרה מהוצאה/הכנסה קבועה. שינוי כאן חל רק על החודש הזה.') : null)
    : h('div', { class: 'field' },
        h('label', { class: 'switch' }, recur, h('span', { class: 'switch-track', 'aria-hidden': 'true' }), h('span', { class: 'switch-label' }, 'חוזר כל חודש')),
        recurHint);

  function paintType() {
    amountWrap.classList.toggle('is-income', type === 'income');
    amountWrap.classList.toggle('is-expense', type === 'expense');
    amountLabel.textContent = type === 'income' ? 'סכום ההכנסה בשקלים' : 'סכום ההוצאה בשקלים';
    const t = sheet?.el?.querySelector('.sheet-title');
    if (t) t.textContent = titleText();
  }
  const titleText = () => editing ? 'עריכת תנועה' : (type === 'income' ? 'הכנסה חדשה' : 'הוצאה חדשה');

  // --- Form -------------------------------------------------------------------
  const form = h('form', { class: 'entry-form stack', novalidate: true, autocomplete: 'off' },
    typeSeg,
    h('div', { class: 'field' }, amountLabel, amountWrap, amountErr),
    h('div', { class: 'field' },
      h('span', { class: 'field-label', id: `cat-lbl-${n}` }, 'קטגוריה'),
      catGrid, catErr, creatorSlot),
    h('div', { class: 'field' },
      h('label', { class: 'field-label', for: note.id }, 'על מה?'),
      note, datalist),
    h('div', { class: 'field' },
      h('label', { class: 'field-label', for: dateInput.id }, 'תאריך'),
      h('div', { class: 'quick-dates cluster' }, chipToday, chipYesterday, dateInput)),
    h('div', { class: 'field' },
      h('span', { class: 'field-label', id: `pay-lbl-${n}` }, 'אמצעי תשלום'),
      payChips),
    recurField,
  );
  form.addEventListener('submit', (e) => { e.preventDefault(); save(false); });
  form.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.isComposing) return;
    const t = e.target;
    if (t.tagName === 'TEXTAREA' || t.tagName === 'BUTTON' || t.closest('.card.is-flat')) return;
    if (t.tagName === 'INPUT' && t.type === 'checkbox') return;
    e.preventDefault();
    save(!editing && (e.shiftKey || e.ctrlKey || e.metaKey));
  });

  // --- Footer -----------------------------------------------------------------
  const saveBtn = h('button', { type: 'button', class: 'btn btn-primary btn-lg grow', on: { click: () => save(false) } }, icon('check'), editing ? 'שמירת שינויים' : 'שמירה');
  const againBtn = editing ? null : h('button', {
    type: 'button', class: 'btn btn-ghost', title: 'Shift+Enter', on: { click: () => save(true) },
  }, icon('plus'), 'שמירה והוספה נוספת');
  const delBtn = editing ? h('button', { type: 'button', class: 'btn btn-ghost btn-danger', on: { click: remove } }, icon('trash'), 'מחיקה') : null;
  const footer = h('div', { class: 'cluster', style: 'width:100%;flex-wrap:wrap' }, saveBtn, againBtn, delBtn);

  paintCats();
  paintNotes();
  paintPay();
  let sheet = null;
  paintDate();

  sheet = openSheet({ title: titleText(), content: form, footer, size: 'md' });
  paintType();
  requestAnimationFrame(() => { amount.focus(); if (editing) amount.select(); });

  // --- Actions --------------------------------------------------------------
  function save(again) {
    const v = validateAmount(true);
    if (v == null) { amount.focus(); return; }
    const state = st.state;
    if (!catId || !state.categories.some((c) => c.id === catId)) {
      catErr.textContent = 'נא לבחור קטגוריה';
      catErr.hidden = false;
      catGrid.querySelector('.cat-pick')?.focus();
      return;
    }
    date = dateInput.value || date || today;
    const data = { type, amount: v, categoryId: catId, date, note: note.value.trim(), payment };
    const cat = catById(state, catId);
    const label = `${fmtMoney(v)} · ${cat.name}`;

    if (editing) {
      st.updateTransaction(tx.id, data);
      toast(`עודכן: ${label}`, { tone: 'good' });
      writeLast({ [type]: catId, payment });
      sheet.close();
      return;
    }

    let created;
    if (!editing && recur?.checked) created = createRecurring(st, data, today);
    else created = st.addTransaction(data);
    writeLast({ [type]: catId, payment });
    toast(`נשמר: ${label}${recur?.checked ? ' · כל חודש' : ''}`, {
      tone: 'good',
      actionLabel: 'ביטול',
      onAction: () => {
        if (created?.rec) st.deleteRecurring(created.rec.id, { removeFuture: true });
        const id = created?.tx?.id || created?.id;
        if (id && st.state.transactions.some((t) => t.id === id)) st.deleteTransaction(id);
      },
    });

    if (again) {
      amount.value = '';
      note.value = '';
      if (recur) recur.checked = false;
      amountErr.hidden = true;
      catExplicit = true; // keep the chosen category for the batch
      paintCats();
      paintNotes();
      amount.focus();
    } else {
      sheet.close();
    }
  }

  async function remove() {
    const ok = await confirmDialog({
      title: 'למחוק את התנועה?',
      text: `${fmtMoney(tx.amount)} · ${catById(st.state, tx.categoryId).name}${tx.note ? ` · ${tx.note}` : ''}`,
      confirmLabel: 'מחיקה',
      danger: true,
    });
    if (!ok) return;
    const removed = st.deleteTransaction(tx.id) || tx;
    sheet.close();
    toast('התנועה נמחקה', { actionLabel: 'ביטול', onAction: () => st.restoreTransaction(removed) });
  }

  return sheet;
}

/** Month key a recurring item uses for a date. Recurring months are calendar months ('YYYY-MM' of the date). */
function recurMonth(iso) { return iso.slice(0, 7); }

/**
 * Create a monthly Recurring from an entry and this month's transaction, marked as done
 * so applyRecurring() never duplicates it.
 */
export function createRecurring(st, data, today = todayISO()) {
  const month = recurMonth(data.date);
  const day = fromISO(data.date).getDate();
  const rec = st.addRecurring({
    type: data.type, amount: data.amount, categoryId: data.categoryId, note: data.note, payment: data.payment,
    day, startMonth: month, endMonth: null, active: true, done: [month],
  });
  const recurKey = `${rec.id}:${month}`;
  // If the store already materialized this month (e.g. addRecurring applies immediately), adopt that tx.
  let tx = st.state.transactions.find((t) => t.recurKey === recurKey);
  if (tx) {
    tx = st.updateTransaction(tx.id, { date: data.date, note: data.note }) || tx;
  } else {
    tx = st.addTransaction({ ...data, recurringId: rec.id, recurKey });
  }
  const cur = st.state.recurring.find((r) => r.id === rec.id);
  if (cur && !(cur.done || []).includes(month)) st.updateRecurring(rec.id, { done: [...(cur.done || []), month] });
  st.applyRecurring?.(today);
  return { rec, tx };
}
