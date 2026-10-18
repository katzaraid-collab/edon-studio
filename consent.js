/* EDON · consent manager
   Non-essential scripts must be added as:
   <script type="text/plain" data-consent="analytics|marketing" data-src="https://..."></script>
   (or with inline code instead of data-src). They run only after the visitor allows that category,
   and a withdrawn consent reloads the page so they stop. */
(() => {
'use strict';
const KEY = 'edon-consent', VER = 1;
const CATS = [
  { id: 'necessary', name: 'חיוניים', desc: 'שומרים את הבחירות שלכם באתר, כמו מצב התנועה והעדפות הפרטיות. הם תמיד פעילים, כי בלעדיהם האתר לא יזכור את הבחירות.', locked: true },
  { id: 'analytics', name: 'מדידה וסטטיסטיקה', desc: 'עוזרים להבין כמה אנשים מבקרים ואילו חלקים באתר מעניינים. כרגע לא פועל באתר שום כלי כזה.' },
  { id: 'marketing', name: 'שיווק ופרסום', desc: 'מאפשרים למדוד מודעות ולהציג פרסום מותאם, למשל באינסטגרם. כרגע לא פועל באתר שום כלי כזה.' }
];
const read = () => { try { const c = JSON.parse(localStorage.getItem(KEY)); return c && c.v === VER ? c : null; } catch (e) { return null; } };
const write = c => { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {} };
const el = (tag, attrs = {}, html = '') => { const n = document.createElement(tag); for (const k in attrs) n.setAttribute(k, attrs[k]); if (html) n.innerHTML = html; return n; };

function apply(c) {
  document.querySelectorAll('script[type="text/plain"][data-consent]').forEach(s => {
    if (s.dataset.on || !c || !c[s.dataset.consent]) return;
    const r = document.createElement('script');
    if (s.dataset.src) { r.src = s.dataset.src; r.async = true; } else r.textContent = s.textContent;
    s.dataset.on = '1'; s.after(r);
  });
  document.dispatchEvent(new CustomEvent('edon:consent', { detail: c }));
}
function save(choice) {
  const prev = read();
  const c = { v: VER, necessary: true, analytics: !!choice.analytics, marketing: !!choice.marketing, ts: new Date().toISOString() };
  write(c); hideBanner(); apply(c);
  document.dispatchEvent(new CustomEvent('edon:consent-decided', { detail: c }));
  if (prev && ((prev.analytics && !c.analytics) || (prev.marketing && !c.marketing))) location.reload();
  return c;
}

/* banner */
const banner = el('section', { class: 'cbar', 'aria-label': 'הסכמה לעוגיות', hidden: '' },
  '<div class="cb-in"><p class="cb-t"><b>עוגיות ופרטיות.</b> באתר פועל רק אחסון חיוני לשמירת הבחירות שלכם. כלי מדידה או פרסום יופעלו רק באישורכם. <a href="/privacy.html">למדיניות</a></p>' +
  '<div class="cb-b"><button type="button" class="cbtn y" data-act="all">אישור הכל</button><button type="button" class="cbtn" data-act="none">רק חיוניים</button><button type="button" class="cbtn ghost" data-act="manage" aria-label="ניהול העדפות עוגיות">ניהול</button></div></div>');
function showBanner() { banner.hidden = false; }
function hideBanner() { banner.hidden = true; }

/* preferences dialog */
const dlg = el('dialog', { class: 'cdlg', 'aria-labelledby': 'cd-h' },
  '<div class="cd-in"><div class="cd-top"><h2 id="cd-h">העדפות פרטיות</h2><button type="button" class="cd-x" data-act="close" aria-label="סגירה">✕</button></div>' +
  '<p class="cd-lead">כאן בוחרים אילו סוגי אחסון ומדידה מותר להפעיל. אפשר לשנות את הבחירה בכל רגע מהקישור "הגדרות עוגיות" בתחתית העמוד.</p>' +
  CATS.map(c => '<div class="cd-row"><div><h3 id="cd-' + c.id + '">' + c.name + '</h3><p>' + c.desc + '</p></div>' +
    '<label class="cd-sw"><input type="checkbox" data-cat="' + c.id + '" aria-labelledby="cd-' + c.id + '"' + (c.locked ? ' checked disabled' : '') + '><span aria-hidden="true"></span><span class="vh">' + (c.locked ? 'תמיד פעיל' : 'הפעלה') + '</span></label></div>').join('') +
  '<div class="cd-b"><button type="button" class="cbtn y" data-act="save">שמירת הבחירה</button><button type="button" class="cbtn" data-act="all">אישור הכל</button><button type="button" class="cbtn" data-act="none">דחיית הלא־חיוניים</button></div>' +
  '<p class="cd-f"><a href="/privacy.html">למדיניות הפרטיות המלאה</a></p></div>');
function openDialog() {
  const c = read() || { analytics: false, marketing: false };
  dlg.querySelectorAll('input[data-cat]').forEach(i => { if (!i.disabled) i.checked = !!c[i.dataset.cat]; });
  if (typeof dlg.showModal === 'function') { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute('open', '');
  const first = dlg.querySelector('input:not([disabled])'); if (first) first.focus();
}
function closeDialog() { if (dlg.open && typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open'); }

function onAct(e) {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const a = b.dataset.act;
  if (a === 'all') { save({ analytics: true, marketing: true }); closeDialog(); }
  else if (a === 'none') { save({ analytics: false, marketing: false }); closeDialog(); }
  else if (a === 'manage') openDialog();
  else if (a === 'close') closeDialog();
  else if (a === 'save') {
    const v = {}; dlg.querySelectorAll('input[data-cat]').forEach(i => { v[i.dataset.cat] = i.checked; });
    save(v); closeDialog();
  }
}
banner.addEventListener('click', onAct);
dlg.addEventListener('click', e => { if (e.target === dlg) closeDialog(); else onAct(e); });

function init() {
  const skip = document.querySelector('.skip');
  if (skip) skip.after(banner); else document.body.prepend(banner);
  document.body.appendChild(dlg);
  document.querySelectorAll('[data-consent-open]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); openDialog(); }));
  const c = read();
  if (c) apply(c); else showBanner();
}
window.edonConsent = { get: read, open: openDialog };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
