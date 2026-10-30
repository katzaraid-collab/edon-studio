// Boot, hash router and the glue between the store, the shell and the views.
import { store } from './store.js';
import { currentPeriod } from './model.js';
import { addMonths, fmtMonth, todayISO } from './format.js';
import { toast } from './ui.js';
import dashboard from './views/dashboard.js';
import transactions from './views/transactions.js';
import insights from './views/insights.js';
import settings from './views/settings.js';
import { openEntry as openEntrySheet } from './views/entry.js';

const VIEWS = { dashboard, tx: transactions, insights, settings };
const ROUTES = { '': 'dashboard', tx: 'tx', insights: 'insights', settings: 'settings' };
const $ = (sel) => document.querySelector(sel);

const root = $('#view');
let today = todayISO();
let period = currentPeriod(store.state, today);
let route = { id: 'dashboard', params: {} };
let cleanup = null;
let queued = false;

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  const id = ROUTES[path] ?? 'dashboard';
  return { id, params: Object.fromEntries(new URLSearchParams(query)) };
}

function hashFor(id, params = {}) {
  const path = id === 'dashboard' ? '' : id;
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '')).toString();
  return `#/${path}${q ? `?${q}` : ''}`;
}

function navigate(id, params = {}) {
  const next = hashFor(id, params);
  if (location.hash === next) render({ scroll: 'top' });
  else location.hash = next;
}

function setPeriod(key) {
  const max = currentPeriod(store.state, today);
  period = key > max ? max : key;
  render();
}

function openEntry(tx = null, defaults = {}) {
  return openEntrySheet(makeCtx(), tx, defaults);
}

function makeCtx() {
  return { store, state: store.state, period, setPeriod, navigate, openEntry, today, params: route.params, rerender: scheduleRender };
}

function render({ scroll = 'keep' } = {}) {
  const view = VIEWS[route.id];
  const y = window.scrollY;
  if (typeof cleanup === 'function') { try { cleanup(); } catch (e) { console.error(e); } }
  cleanup = null;
  root.replaceChildren();
  root.dataset.view = route.id;
  try {
    cleanup = view.render(root, makeCtx()) || null;
  } catch (err) {
    console.error(err);
    const box = document.createElement('div');
    box.className = 'page';
    const card = document.createElement('div');
    card.className = 'card empty';
    const t = document.createElement('p');
    t.className = 'empty-title';
    t.textContent = 'משהו השתבש בטעינת המסך';
    const s = document.createElement('p');
    s.className = 'empty-text';
    s.textContent = 'הנתונים שלך שמורים. נסו לרענן את הדף.';
    card.append(t, s);
    box.append(card);
    root.append(box);
  }
  updateChrome(view);
  if (scroll === 'top') window.scrollTo(0, 0);
  else window.scrollTo(0, y);
}

function scheduleRender() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; render(); });
}

function updateChrome(view) {
  document.title = `${view.title} · המאזן של אורי`;
  document.querySelectorAll('[data-route]').forEach((a) => {
    a.href = hashFor(a.dataset.route);
    if (a.dataset.route === route.id) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  const max = currentPeriod(store.state, today);
  const label = $('#period-label');
  if (label) {
    label.textContent = fmtMonth(period);
    label.setAttribute('aria-label', period === max ? `${fmtMonth(period)} (החודש הנוכחי)` : `${fmtMonth(period)} – חזרה לחודש הנוכחי`);
    label.classList.toggle('is-current', period === max);
  }
  const next = $('#period-next');
  if (next) next.disabled = period >= max;
}

function applyTheme() {
  const theme = store.state.settings.theme;
  const html = document.documentElement;
  if (theme === 'light' || theme === 'dark') html.dataset.theme = theme;
  else delete html.dataset.theme;
  const btn = $('#theme-toggle');
  if (btn) {
    const dark = theme === 'dark' || (theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
    btn.setAttribute('aria-label', dark ? 'מעבר לערכה בהירה' : 'מעבר לערכה כהה');
    btn.setAttribute('aria-pressed', String(dark));
    const use = btn.querySelector('use');
    if (use) use.setAttribute('href', dark ? '#i-sun' : '#i-moon');
  }
}

function toggleTheme() {
  const theme = store.state.settings.theme;
  const dark = theme === 'dark' || (theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  store.updateSettings({ theme: dark ? 'light' : 'dark' });
}

// A new day (app left open overnight, or resumed from the background) can open a new period and due recurring items.
function refreshDay() {
  const now = todayISO();
  if (now === today) return;
  const wasCurrent = period === currentPeriod(store.state, today);
  today = now;
  store.applyRecurring(today);
  if (wasCurrent) period = currentPeriod(store.state, today);
  scheduleRender();
}

function isTyping(el) {
  return el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}

function wire() {
  $('#period-prev')?.addEventListener('click', () => setPeriod(addMonths(period, -1)));
  $('#period-next')?.addEventListener('click', () => setPeriod(addMonths(period, 1)));
  $('#period-label')?.addEventListener('click', () => setPeriod(currentPeriod(store.state, today)));
  $('#theme-toggle')?.addEventListener('click', toggleTheme);
  document.querySelectorAll('#fab-add, [data-action="add"]').forEach((b) =>
    b.addEventListener('click', () => openEntry(null, { type: 'expense' })));

  window.addEventListener('hashchange', () => {
    route = parseHash();
    render({ scroll: 'top' });
    root.focus({ preventScroll: true });
  });

  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
    if (document.querySelector('[aria-modal="true"]')) return;
    if (e.key === 'n' || e.key === 'מ' || e.key === '+') { e.preventDefault(); openEntry(null, { type: 'expense' }); }
  });

  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshDay(); });
  setInterval(refreshDay, 60_000);

  let lastStartDay = store.state.settings.monthStartDay;
  store.subscribe((state, change) => {
    applyTheme();
    // Changing the salary day moves period boundaries; stay on the period that contains today.
    if (state.settings.monthStartDay !== lastStartDay) {
      lastStartDay = state.settings.monthStartDay;
      period = currentPeriod(state, today);
    }
    if (change?.type === 'replace' || change?.type === 'reset' || change?.type === 'demo') {
      period = currentPeriod(state, today);
    }
    scheduleRender();
  });
}

function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol !== 'https:') return;
  navigator.serviceWorker.register('./sw.js', { scope: './' }).then((reg) => {
    reg.addEventListener('updatefound', () => {
      const sw = reg.installing;
      sw?.addEventListener('statechange', () => {
        if (sw.state === 'installed' && navigator.serviceWorker.controller) {
          toast('גרסה חדשה של מאזן זמינה', { actionLabel: 'רענון', onAction: () => location.reload(), timeout: 10000 });
        }
      });
    });
  }).catch(() => {});
}

function boot() {
  store.applyRecurring(today);
  period = currentPeriod(store.state, today);
  route = parseHash();
  applyTheme();
  wire();
  render({ scroll: 'top' });
  document.documentElement.classList.add('is-ready');
  registerSW();
}

boot();
