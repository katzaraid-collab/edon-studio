/* EDON accessibility menu: text size, high contrast, underlined links, a readable font, calm motion.
   Load it in <head> so saved choices apply before the first paint; the menu is wired to .a11y-btn once the page parses.
   data-motion="reload" on the script tag: the page reads its motion setting at load (the homepage), so toggling it reloads. */
(function () {
  var H = document.documentElement, KEY = 'edon-a11y', CALM = 'edon-x-calm';
  var me = document.currentScript, RELOAD = !!(me && me.getAttribute('data-motion') === 'reload');
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function put(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  var st = { t: 0, c: 0, l: 0, f: 0 };
  try { var s = JSON.parse(get(KEY)); if (s && typeof s === 'object') { st.t = Math.max(0, Math.min(2, s.t | 0)); st.c = s.c ? 1 : 0; st.l = s.l ? 1 : 0; st.f = s.f ? 1 : 0; } } catch (e) {}
  function apply() {
    H.classList.toggle('a11y-t1', st.t === 1); H.classList.toggle('a11y-t2', st.t === 2);
    H.classList.toggle('a11y-c', !!st.c); H.classList.toggle('a11y-l', !!st.l); H.classList.toggle('a11y-f', !!st.f);
  }
  function calmOn() {
    var p = get(CALM);
    if (p === '1') return true;
    if (p === '0') return false;
    try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }
  H.classList.add('a11y-js'); apply();
  if (!RELOAD && calmOn()) H.classList.add('a11y-still');

  var SIZES = ['רגיל', 'גדול', 'גדול מאוד'];
  var ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="4.5" r="2"/><path d="M5 8.5l7 1.5 7-1.5M12 10v5M8.5 21l3.5-6 3.5 6"/></svg>';
  var X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  function build() {
    var btn = document.querySelector('.a11y-btn'); if (!btn || btn.dataset.wired) return; btn.dataset.wired = '1';
    var p = document.createElement('div');
    p.id = 'a11y-panel'; p.className = 'a11y-panel'; p.hidden = true;
    p.setAttribute('role', 'dialog'); p.setAttribute('aria-labelledby', 'a11y-h');
    p.innerHTML =
      '<div class="a11y-hd"><h2 id="a11y-h">נגישות</h2><button type="button" class="a11y-x" data-a="close" aria-label="סגירת תפריט הנגישות">' + X + '</button></div>' +
      '<div class="a11y-size" role="group" aria-labelledby="a11y-sz"><span id="a11y-sz">גודל טקסט</span>' +
      '<div class="a11y-step"><button type="button" data-a="dec" aria-label="הקטנת הטקסט">א−</button><output id="a11y-out" aria-live="polite"></output><button type="button" data-a="inc" aria-label="הגדלת הטקסט">א+</button></div></div>' +
      '<button type="button" class="a11y-tg" data-k="c" aria-pressed="false"><span>ניגודיות גבוהה</span><i aria-hidden="true"></i></button>' +
      '<button type="button" class="a11y-tg" data-k="l" aria-pressed="false"><span>הדגשת קישורים</span><i aria-hidden="true"></i></button>' +
      '<button type="button" class="a11y-tg" data-k="f" aria-pressed="false"><span>גופן קריא</span><i aria-hidden="true"></i></button>' +
      '<button type="button" class="a11y-tg" data-k="m" aria-pressed="false"><span>עצירת אנימציות</span><i aria-hidden="true"></i></button>' +
      '<div class="a11y-ft"><button type="button" class="a11y-reset" data-a="reset">איפוס ההגדרות</button><a href="/accessibility.html">הצהרת הנגישות</a></div>';
    document.body.appendChild(p);
    btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', 'a11y-panel');
    var out = p.querySelector('#a11y-out');
    function paint() {
      out.textContent = SIZES[st.t];
      p.querySelector('[data-a="dec"]').disabled = st.t === 0;
      p.querySelector('[data-a="inc"]').disabled = st.t === 2;
      var tg = p.querySelectorAll('.a11y-tg');
      for (var i = 0; i < tg.length; i++) { var k = tg[i].dataset.k; tg[i].setAttribute('aria-pressed', String(k === 'm' ? calmOn() : !!st[k])); }
    }
    function save() { put(KEY, JSON.stringify(st)); apply(); paint(); try { dispatchEvent(new Event('resize')); } catch (e) {} }
    function open() { p.hidden = false; btn.setAttribute('aria-expanded', 'true'); paint(); var h = p.querySelector('[data-a="dec"]'); (st.t === 0 ? p.querySelector('[data-a="inc"]') : h).focus(); }
    function close(back) { if (p.hidden) return; p.hidden = true; btn.setAttribute('aria-expanded', 'false'); if (back) btn.focus(); }
    btn.addEventListener('click', function () { if (p.hidden) open(); else close(true); });
    p.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button') : null; if (!b) return;
      var a = b.dataset.a, k = b.dataset.k;
      if (a === 'close') close(true);
      else if (a === 'dec') { st.t = Math.max(0, st.t - 1); save(); }
      else if (a === 'inc') { st.t = Math.min(2, st.t + 1); save(); }
      else if (a === 'reset') { st = { t: 0, c: 0, l: 0, f: 0 }; put(KEY, null); var wasCalm = calmOn(); put(CALM, null); apply(); paint(); if (wasCalm !== calmOn()) motionChanged(); else try { dispatchEvent(new Event('resize')); } catch (e) {} }
      else if (k === 'm') { put(CALM, calmOn() ? '0' : '1'); motionChanged(); }
      else if (k) { st[k] = st[k] ? 0 : 1; save(); }
    });
    function motionChanged() {
      if (RELOAD) { location.reload(); return; }
      H.classList.toggle('a11y-still', calmOn()); paint();
    }
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !p.hidden) { e.preventDefault(); close(true); } });
    document.addEventListener('pointerdown', function (e) { if (!p.hidden && !p.contains(e.target) && !btn.contains(e.target)) close(false); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
