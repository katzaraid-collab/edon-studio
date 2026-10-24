/* ==========================================================================
   האופה · theme: light on a first visit, a toggle, and the visitor's choice kept in localStorage

   TWO PARTS IN ONE FILE
     1 BOOT, between the two "boot" marker comments below. It must run before the first paint, so
       every page carries it INLINE as the first <script> in <head>, copied byte for byte (the
       build copies it; tests/skeleton.test.mjs fails if the inline copy and this one differ). Its
       sha256 is the only script hash in the CSP (vercel.json), so any edit here means a new hash:
       run `node tools/csp-hash.mjs` and paste the value it prints.
       It does four things and nothing else:
         - <html data-mode="light|dark">: the saved choice, else "light". The system dark setting is
           deliberately NOT followed on a first visit (owner's choice: light by default).
         - <html class="anim"> when motion is allowed, "rm" when the system asks for reduced motion
           (the static HTML says "rm", so a visitor without JavaScript gets the calm, static page).
         - removes data-lqip from an <img> once it has loaded (the blurred placeholder in
           audit/perf/recommended-markup.html); load does not bubble, so it listens in capture.
         - nothing else: no DOM writes besides <html>, no network, no globals.
       It stops at once if <html> already has data-mode, so loading this file again (part 2, with
       defer) never runs it twice.
     2 TOGGLE, the rest. Loaded with <script defer src="theme.js">. Wires every
       [data-theme-toggle] button (aria-pressed follows the mode), saves the choice, follows
       changes made in another tab, and exposes window.HaofeTheme = { get, set, toggle, key }.
       runtime.js maps the prototype's Shell.setMode(root, mode) onto HaofeTheme.set, so the
       micro motion module's view-transition theme swap also saves the choice.

   STORAGE
     One key, "haofe:theme" = "light" | "dark". Every read and write is wrapped in try/catch: in a
     private window, with site data blocked, or in an embedded preview, localStorage can be missing
     or throw on access; then the page stays light and the toggle still works for the visit.
     Privacy: a per-device preference that never leaves the browser (legal/privacy-policy.md, the
     "עם העדפה, לפי D3" variant of the "מה נשמר במכשיר שלכם" paragraph).
   ========================================================================== */

/*! boot:start */
(function(d,w){var r=d.documentElement;if(r.hasAttribute('data-mode'))return;var m='light',q=false;try{var s=w.localStorage.getItem('haofe:theme');if(s==='dark'||s==='light')m=s}catch(e){}try{q=w.matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){}r.setAttribute('data-mode',m);r.classList.remove('rm');r.classList.add(q?'rm':'anim');d.addEventListener('load',function(e){var t=e.target;if(t&&t.tagName==='IMG'&&t.hasAttribute('data-lqip'))t.removeAttribute('data-lqip')},true)})(document,window);
/*! boot:end */

(function () {
  'use strict';

  var KEY = 'haofe:theme';
  var root = document.documentElement;

  function valid(v) { return v === 'dark' || v === 'light'; }

  function load() {
    try {
      var v = window.localStorage.getItem(KEY);
      return valid(v) ? v : null;
    } catch (e) {
      return null;
    }
  }

  function store(mode) {
    try {
      window.localStorage.setItem(KEY, mode);
      return true;
    } catch (e) {
      return false;   // private mode, quota, blocked storage: the choice lasts for this visit only
    }
  }

  function get() { return root.getAttribute('data-mode') === 'dark' ? 'dark' : 'light'; }

  /* every toggle on the page reflects the mode: aria-pressed (the button is labelled "מצב כהה",
     so pressed = dark), and an optional [data-theme-label] text inside it */
  function sync(mode) {
    var dark = mode === 'dark';
    document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
      var label = btn.querySelector('[data-theme-label]');
      if (label) {
        label.textContent = dark
          ? (btn.getAttribute('data-label-dark') || 'כהה')
          : (btn.getAttribute('data-label-light') || 'בהיר');
      }
    });
  }

  /* opts.persist === false: show the mode without saving it (another tab already saved it) */
  function set(mode, opts) {
    if (!valid(mode)) return;
    var changed = mode !== get();
    root.setAttribute('data-mode', mode);
    sync(mode);
    if (!(opts && opts.persist === false)) store(mode);
    if (changed) document.dispatchEvent(new CustomEvent('haofe:theme', { detail: mode }));
  }

  function toggle() { set(get() === 'dark' ? 'light' : 'dark'); }

  /* Bubble phase on document, on purpose: on phone layouts b-motion-micro listens on <html> in the
     capture phase, stops the click and switches inside a view transition via Shell.setMode, which
     runtime.js routes to set(). Capturing here would switch twice. */
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('[data-theme-toggle]');
    if (btn) toggle();
  });

  /* the same choice in every open tab */
  window.addEventListener('storage', function (e) {
    if (e.key === KEY && valid(e.newValue)) set(e.newValue, { persist: false });
  });

  /* a page restored from the back/forward cache keeps the mode it had when it was left */
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    var saved = load();
    if (saved && saved !== get()) set(saved, { persist: false });
  });

  window.HaofeTheme = { get: get, set: set, toggle: toggle, key: KEY };
  sync(get());
})();
