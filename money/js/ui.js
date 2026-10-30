// מאזן — DOM helpers & shared UI components.
// No innerHTML anywhere: user data always goes through textContent / text nodes.

import { fmtMoney, fmtDate, PAYMENTS } from './format.js';
import { catById } from './model.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const PROP_ATTRS = new Set(['value', 'checked', 'selected', 'indeterminate', 'muted']);

export const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------------ */
/* h() — hyperscript                                                   */
/* ------------------------------------------------------------------ */

function appendChildren(el, children) {
  for (const c of children) {
    if (c == null || c === false || c === true) continue;
    if (Array.isArray(c)) appendChildren(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}

function classString(v) {
  if (Array.isArray(v)) return v.flat(Infinity).filter(Boolean).join(' ');
  if (v && typeof v === 'object') return Object.keys(v).filter((k) => v[k]).join(' ');
  return String(v);
}

export function h(tag, attrs = {}, ...children) {
  const isSvg = tag.startsWith('svg:');
  const name = isSvg ? tag.slice(4) : tag;
  const el = isSvg ? document.createElementNS(SVG_NS, name) : document.createElement(name);

  // Allow h('div', 'text') / h('div', node) / h('div', [..]) shorthand.
  if (attrs != null && (typeof attrs !== 'object' || Array.isArray(attrs) || attrs instanceof Node)) {
    children.unshift(attrs);
    attrs = {};
  }

  const late = [];
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null) continue;
    if (k === 'class' || k === 'className') {
      if (v === false) continue;
      const cls = classString(v).trim();
      if (cls) el.setAttribute('class', cls);
    } else if (k === 'style') {
      if (v === false) continue;
      if (typeof v === 'string') el.setAttribute('style', v);
      else for (const [sk, sv] of Object.entries(v)) {
        if (sv == null || sv === false) continue;
        if (sk.startsWith('--') || sk.includes('-')) el.style.setProperty(sk, String(sv));
        else el.style[sk] = String(sv);
      }
    } else if (k === 'dataset') {
      for (const [dk, dv] of Object.entries(v)) if (dv != null && dv !== false) el.dataset[dk] = String(dv);
    } else if (k === 'on') {
      for (const [ev, fn] of Object.entries(v)) if (typeof fn === 'function') el.addEventListener(ev, fn);
    } else if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === 'ref') {
      if (typeof v === 'function') late.push(() => v(el));
    } else if (k.startsWith('aria-') && typeof v === 'boolean') {
      el.setAttribute(k, String(v)); // aria-pressed={false} must render "false"
    } else if (v === false) {
      continue;
    } else if (!isSvg && PROP_ATTRS.has(k)) {
      late.push(() => { el[k] = v; }); // after children (e.g. <select> options)
    } else if (v === true) {
      el.setAttribute(k, '');
    } else {
      el.setAttribute(k, String(v));
    }
  }
  appendChildren(el, children);
  for (const fn of late) fn();
  return el;
}

/* ------------------------------------------------------------------ */
/* Icons & categories                                                   */
/* ------------------------------------------------------------------ */

export function icon(name, { size, cls = '' } = {}) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', cls ? `ic ${cls}` : 'ic');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  if (size != null) {
    // explicit size wins over contextual CSS sizes
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.style.width = `${size}px`;
    svg.style.height = `${size}px`;
  } else {
    svg.setAttribute('width', 20);
    svg.setAttribute('height', 20);
  }
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `#i-${name || 'dots'}`);
  svg.appendChild(use);
  return svg;
}

export function catColor(cat) {
  const n = Number(cat?.color);
  return `var(--cat-${n >= 1 && n <= 12 ? n : 12})`;
}

export function catBadge(cat, { size = 'md' } = {}) {
  const cls = size === 'sm' ? 'cat-badge is-sm' : size === 'lg' ? 'cat-badge is-lg' : 'cat-badge';
  return h('span', { class: cls, style: { '--c': catColor(cat) }, 'aria-hidden': 'true' }, icon(cat?.icon || 'dots'));
}

export const ICONS_FOR_CATEGORIES = [
  'cart', 'food', 'coffee', 'car', 'fuel', 'bus', 'home', 'bolt', 'phone', 'health', 'shirt', 'party',
  'repeat', 'book', 'gift', 'shield', 'paw', 'sparkle', 'baby', 'plane', 'briefcase', 'tools', 'undo',
  'wallet', 'dots', 'game', 'dumbbell', 'music', 'heart', 'tree', 'cash', 'card',
];

/* ------------------------------------------------------------------ */
/* Money                                                                */
/* ------------------------------------------------------------------ */

export function money(agorot, opts = {}) {
  const { tone, cls, ...fmt } = opts || {};
  const classes = ['num'];
  if (tone === 'income') classes.push('is-income');
  else if (tone === 'expense') classes.push('is-expense');
  if (cls) classes.push(cls);
  return h('bdi', { class: classes.join(' ') }, fmtMoney(agorot, fmt));
}

/* ------------------------------------------------------------------ */
/* Transaction row                                                      */
/* ------------------------------------------------------------------ */

export function txRow(tx, state, { onClick, showDate = false } = {}) {
  const cat = catById(state, tx.categoryId);
  const pay = PAYMENTS.find((p) => p.id === tx.payment);
  const note = (tx.note || '').trim();
  const title = note || cat.name;
  const income = tx.type === 'income';

  const parts = [];
  if (note) parts.push(cat.name);
  if (pay) parts.push(pay.label);
  if (showDate && tx.date) parts.push(fmtDate(tx.date));

  const sub = h('div', { class: 'tx-sub' },
    tx.recurringId ? h('span', { class: 'tx-recur', title: 'תנועה חוזרת' }, icon('repeat', { size: 13 }), h('span', { class: 'sr-only' }, 'חוזרת, ')) : null,
    h('span', { class: 'tx-sub-text' }, parts.join(' · ')),
  );

  const amt = h('div', { class: income ? 'tx-amt is-income' : 'tx-amt' },
    h('bdi', { class: 'num' }, fmtMoney(income ? tx.amount : -tx.amount, { sign: true })),
    h('span', { class: 'sr-only' }, income ? ' הכנסה' : ' הוצאה'),
  );

  const btn = h('button', {
    type: 'button',
    class: 'tx-row',
    dataset: { id: tx.id },
    on: { click: () => onClick?.(tx) },
  },
    catBadge(cat),
    h('div', { class: 'tx-main' }, h('div', { class: 'tx-title' }, title), sub),
    amt,
  );
  return h('li', { dataset: { id: tx.id } }, btn);
}

/* ------------------------------------------------------------------ */
/* Toasts                                                               */
/* ------------------------------------------------------------------ */

const TOAST_ICONS = { info: 'info', good: 'check', success: 'check', warn: 'alert', bad: 'alert', error: 'alert' };
const MAX_TOASTS = 3;

function toastHost() {
  let host = document.getElementById('toasts');
  if (!host) {
    host = h('div', { id: 'toasts', class: 'toasts', 'aria-live': 'polite' });
    document.body.appendChild(host);
  }
  return host;
}

export function toast(message, { actionLabel, onAction, timeout = 4500, tone = 'info' } = {}) {
  const host = toastHost();
  const t = tone === 'success' ? 'good' : tone === 'error' ? 'bad' : tone;
  let closed = false;
  let timer = 0;
  let remaining = timeout;
  let started = 0;

  const close = () => {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    el.classList.add('is-leaving');
    const done = () => el.remove();
    if (prefersReducedMotion()) done();
    else { el.addEventListener('animationend', done, { once: true }); setTimeout(done, 320); }
  };

  const el = h('div', { class: `toast is-${t}`, role: t === 'bad' ? 'alert' : 'status' },
    h('span', { class: 'toast-icon', 'aria-hidden': 'true' }, icon(TOAST_ICONS[t] || 'info')),
    h('span', { class: 'toast-msg' }, message),
    actionLabel ? h('button', {
      type: 'button', class: 'toast-action',
      on: { click: () => { close(); onAction?.(); } },
    }, actionLabel) : null,
    h('button', { type: 'button', class: 'toast-close', 'aria-label': 'סגירת ההודעה', on: { click: close } }, icon('close')),
  );

  const start = () => {
    if (closed || !(remaining > 0) || !Number.isFinite(remaining)) return;
    started = Date.now();
    clearTimeout(timer);
    timer = setTimeout(close, remaining);
  };
  const pause = () => {
    if (!started) return;
    clearTimeout(timer);
    remaining -= Date.now() - started;
    remaining = Math.max(remaining, 1200);
    started = 0;
  };
  el.addEventListener('pointerenter', pause);
  el.addEventListener('pointerleave', start);
  el.addEventListener('focusin', pause);
  el.addEventListener('focusout', (e) => { if (!el.contains(e.relatedTarget)) start(); });

  // keep the stack short: drop the oldest
  const live = [...host.querySelectorAll('.toast:not(.is-leaving)')];
  if (live.length >= MAX_TOASTS) live.slice(0, live.length - MAX_TOASTS + 1).forEach((n) => n._close?.());
  el._close = close;
  host.appendChild(el);
  start();
  return { close, el };
}

/* ------------------------------------------------------------------ */
/* Sheets / dialogs                                                     */
/* ------------------------------------------------------------------ */

const sheetStack = [];
let sheetSeq = 0;
let savedScrollbar = '';

const FOCUSABLE = [
  'a[href]', 'area[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', 'iframe', 'audio[controls]', 'video[controls]',
  '[contenteditable]:not([contenteditable="false"])', '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusables(root) {
  return [...root.querySelectorAll(FOCUSABLE)].filter((n) =>
    !n.closest('[inert]') && !n.hidden && (n.offsetWidth || n.offsetHeight || n.getClientRects().length));
}

function lockScroll() {
  const html = document.documentElement;
  const sbw = window.innerWidth - html.clientWidth;
  savedScrollbar = document.body.style.paddingInlineEnd;
  if (sbw > 0) document.body.style.paddingInlineEnd = `${sbw}px`;
  html.classList.add('is-locked');
  const app = document.querySelector('.app');
  if (app) app.inert = true;
}

function unlockScroll() {
  document.documentElement.classList.remove('is-locked');
  document.body.style.paddingInlineEnd = savedScrollbar;
  const app = document.querySelector('.app');
  if (app) app.inert = false;
}

export function openSheet({ title, content, footer = null, onClose, size = 'md' } = {}) {
  const id = `sheet-title-${++sheetSeq}`;
  const prevFocus = document.activeElement;
  let closed = false;

  const titleEl = h('h2', { class: 'sheet-title', id }, title ?? '');
  const closeBtn = h('button', { type: 'button', class: 'icon-btn sheet-close', 'aria-label': 'סגירה' }, icon('close'));
  const grab = h('div', { class: 'sheet-grab', 'aria-hidden': 'true' });
  const hd = h('div', { class: 'sheet-hd' }, titleEl, closeBtn);
  const bd = h('div', { class: 'sheet-bd' }, content ?? null);
  const ft = footer ? h('div', { class: 'sheet-ft' }, footer) : null;
  const sheet = h('div', {
    class: `sheet is-${size}`,
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': id,
    tabindex: '-1',
  }, grab, hd, bd, ft);
  const backdrop = h('div', { class: 'sheet-backdrop' }, sheet);

  const entry = { backdrop, sheet, close: null };
  const under = sheetStack[sheetStack.length - 1];
  if (sheetStack.length === 0) lockScroll();
  if (under) { under.backdrop.inert = true; under.backdrop.classList.add('is-under'); }
  sheetStack.push(entry);
  backdrop.style.zIndex = String(100 + sheetStack.length * 2);

  function close(reason = 'close') {
    if (closed) return;
    closed = true;
    const i = sheetStack.indexOf(entry);
    if (i >= 0) sheetStack.splice(i, 1);
    const top = sheetStack[sheetStack.length - 1];
    if (top) { top.backdrop.inert = false; top.backdrop.classList.remove('is-under'); }
    else unlockScroll();

    backdrop.classList.add('is-closing');
    let removed = false;
    const remove = () => { if (removed) return; removed = true; backdrop.remove(); };
    if (prefersReducedMotion()) remove();
    else {
      sheet.addEventListener('animationend', (e) => { if (e.target === sheet) remove(); });
      setTimeout(remove, 320);
    }

    // restore focus to the opener (or the sheet below)
    const target = prevFocus && prevFocus.isConnected && prevFocus !== document.body ? prevFocus : (top ? top.sheet : null);
    try { target?.focus?.({ preventScroll: true }); } catch { /* ignore */ }
    try { onClose?.(reason); } catch (err) { console.error(err); }
  }
  entry.close = close;

  closeBtn.addEventListener('click', () => close('button'));

  // backdrop click (only when both press and release happen on the backdrop)
  let downOnBackdrop = false;
  backdrop.addEventListener('pointerdown', (e) => { downOnBackdrop = e.target === backdrop; });
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop && downOnBackdrop) close('backdrop');
    downOnBackdrop = false;
  });

  // keyboard: Esc + focus trap (only the top-most sheet reacts)
  backdrop.addEventListener('keydown', (e) => {
    if (sheetStack[sheetStack.length - 1] !== entry) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close('escape');
    } else if (e.key === 'Tab') {
      const list = focusables(sheet);
      if (!list.length) { e.preventDefault(); sheet.focus(); return; }
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === sheet || !sheet.contains(active))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (active === last || !sheet.contains(active))) { e.preventDefault(); first.focus(); }
    }
  });

  // drag-down to dismiss (mobile bottom sheet; grab handle + header)
  let drag = null;
  const onDown = (e) => {
    if (e.button !== 0 || e.target.closest('button, a, input, select, textarea')) return;
    if (matchMedia('(min-width: 720px)').matches) return;
    drag = { y: e.clientY, t: Date.now(), dy: 0, id: e.pointerId };
    sheet.classList.add('is-dragging');
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag.dy = Math.max(0, e.clientY - drag.y);
    sheet.style.transform = `translateY(${drag.dy}px)`;
  };
  const onUp = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { dy, t } = drag;
    drag = null;
    sheet.classList.remove('is-dragging');
    const fast = dy > 40 && dy / Math.max(1, Date.now() - t) > 0.6;
    if (dy > Math.min(140, sheet.offsetHeight * 0.3) || fast) {
      sheet.style.setProperty('--drag', `${dy}px`);
      sheet.style.transform = '';
      close('drag');
    } else {
      sheet.style.transition = 'transform 220ms cubic-bezier(0.32, 0.72, 0, 1)';
      sheet.style.transform = '';
      setTimeout(() => { sheet.style.transition = ''; }, 240);
    }
  };
  for (const zone of [grab, hd]) {
    zone.addEventListener('pointerdown', onDown);
    zone.addEventListener('pointermove', onMove);
    zone.addEventListener('pointerup', onUp);
    zone.addEventListener('pointercancel', onUp);
  }

  // once the entry animation is done, drop it so later class changes never replay it
  sheet.addEventListener('animationend', (e) => {
    if (e.target === sheet && !closed) sheet.classList.add('is-open');
  });
  document.body.appendChild(backdrop);

  // initial focus: [autofocus] inside the sheet, else the dialog itself
  const auto = sheet.querySelector('[autofocus]');
  requestAnimationFrame(() => {
    if (closed) return;
    try { (auto || sheet).focus({ preventScroll: true }); } catch { /* ignore */ }
  });

  return { close, el: sheet, body: bd };
}

export function confirmDialog({ title, text, confirmLabel = 'אישור', cancelLabel = 'ביטול', danger = false } = {}) {
  return new Promise((resolve) => {
    let result = false;
    let sheet = null;
    const cancel = h('button', { type: 'button', class: 'btn', on: { click: () => { result = false; sheet.close('cancel'); } } }, cancelLabel);
    const ok = h('button', {
      type: 'button',
      class: danger ? 'btn btn-danger' : 'btn btn-primary',
      on: { click: () => { result = true; sheet.close('confirm'); } },
    }, confirmLabel);
    (danger ? cancel : ok).setAttribute('autofocus', '');
    const content = text ? h('p', { class: 'confirm-text' }, text) : null;
    sheet = openSheet({
      title, content, footer: [cancel, ok], size: 'sm',
      onClose: () => resolve(result),
    });
    sheet.el.setAttribute('role', 'alertdialog');
    if (content) {
      content.id = `${sheet.el.getAttribute('aria-labelledby')}-desc`;
      sheet.el.setAttribute('aria-describedby', content.id);
    }
  });
}

/* ------------------------------------------------------------------ */
/* Empty state                                                          */
/* ------------------------------------------------------------------ */

export function emptyState({ icon: iconName = 'sparkle', title, text, actions = [] } = {}) {
  return h('div', { class: 'empty' },
    h('div', { class: 'empty-icon', 'aria-hidden': 'true' }, icon(iconName)),
    title ? h('h3', { class: 'empty-title' }, title) : null,
    text ? h('p', { class: 'empty-text' }, text) : null,
    actions && actions.length ? h('div', { class: 'empty-actions' }, actions) : null,
  );
}

/* ------------------------------------------------------------------ */
/* Segmented control                                                    */
/* ------------------------------------------------------------------ */

export function segmented(options, value, onChange, { label, cls = '' } = {}) {
  let current = value;
  const buttons = options.map((o) => h('button', {
    type: 'button',
    'aria-pressed': String(o.value) === String(current),
    dataset: { value: String(o.value) },
    on: { click: () => select(o.value, true) },
  }, o.icon ? icon(o.icon) : null, h('span', null, o.label)));

  const el = h('div', { class: cls ? `seg ${cls}` : 'seg', role: 'group', 'aria-label': label || null }, buttons);

  function paint() {
    buttons.forEach((b, i) => {
      const on = String(options[i].value) === String(current);
      b.setAttribute('aria-pressed', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    if (!buttons.some((b) => b.tabIndex === 0) && buttons[0]) buttons[0].tabIndex = 0;
  }
  function select(v, fire) {
    const changed = String(v) !== String(current);
    current = v;
    paint();
    if (fire && changed) onChange?.(v);
  }

  el.addEventListener('keydown', (e) => {
    const i = buttons.indexOf(document.activeElement);
    if (i < 0) return;
    const rtl = getComputedStyle(el).direction === 'rtl';
    let j = -1;
    if (e.key === 'ArrowRight') j = rtl ? i - 1 : i + 1;
    else if (e.key === 'ArrowLeft') j = rtl ? i + 1 : i - 1;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = buttons.length - 1;
    else return;
    e.preventDefault();
    j = (j + buttons.length) % buttons.length;
    buttons[j].focus();
    select(options[j].value, true);
  });

  paint();
  el.setValue = (v) => select(v, false);
  el.getValue = () => current;
  return el;
}

/* ------------------------------------------------------------------ */
/* Count-up numbers                                                     */
/* ------------------------------------------------------------------ */

const easeOutCubic = (t) => 1 - (1 - t) ** 3;

export function animateNumber(el, toAgorot, opts = {}) {
  const { from, duration = 750, format, ...fmt } = opts || {};
  const render = typeof format === 'function' ? format : (v, final) =>
    fmtMoney(v, final ? fmt : { ...fmt, decimals: fmt.decimals === 'auto' || fmt.decimals == null ? 0 : fmt.decimals });
  const to = Math.round(Number(toAgorot) || 0);

  if (el._numRaf) cancelAnimationFrame(el._numRaf);
  const start = Number.isFinite(from) ? from : (Number.isFinite(el._numValue) ? el._numValue : 0);
  el._numValue = to;

  if (prefersReducedMotion() || start === to || duration <= 0 || (typeof document !== 'undefined' && document.hidden)) {
    el.textContent = render(to, true);
    return () => {};
  }

  let t0 = 0;
  const step = (now) => {
    if (!t0) t0 = now;
    const p = Math.min(1, (now - t0) / duration);
    if (p >= 1) {
      el.textContent = render(to, true);
      el._numRaf = 0;
      return;
    }
    const v = start + (to - start) * easeOutCubic(p);
    el.textContent = render(Math.round(v / 100) * 100, false);
    el._numRaf = requestAnimationFrame(step);
  };
  el._numRaf = requestAnimationFrame(step);
  return () => { cancelAnimationFrame(el._numRaf); el._numRaf = 0; el.textContent = render(to, true); };
}

/* ------------------------------------------------------------------ */
/* Small extras                                                         */
/* ------------------------------------------------------------------ */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export function clear(el) { el.replaceChildren(); return el; }
