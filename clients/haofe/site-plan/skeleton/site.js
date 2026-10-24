/* ==========================================================================
   האופה · site behaviour (no motion). The page-level port of the prototype's b.js plus the parts
   of shell.js a real page still needs. Loaded with defer, before runtime.js.

   FROM b.js (PROTO.init)
     - product boxes: the lid <button> opens and closes its details (.box.open, aria-expanded)
     - ticker: the pause button (WCAG 2.2.2) toggles .ticker.paused and its label
     - NOT ported: orderSwitch(). On the site the order module is rendered for one state at build
       time (site.config.json orderApp.status), so the "soon" HTML never contains the app URL.
   FROM shell.js
     - Shell.menu: the mobile menu disclosure (Esc returns focus to the button, Shift+Tab on the
       first item goes back to the button, choosing a link closes it), plus the audit fix A11Y-03:
       it also closes when focus leaves the panel, and Esc works from anywhere.
     - NOT ported: Shell.ids (real ids are written in the HTML), Shell.anchors (real href="#id"
       links + html { scroll-padding-top } in page.css), Shell.themeButtons (theme.js),
       Shell.reveal (runtime.js), the frames and the overlay (presentation only).
   It runs once, on the real DOM, and is not rebuilt when the motion modules restart.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;

  function boxes() {
    document.querySelectorAll('.box .lid').forEach(function (lid) {
      lid.addEventListener('click', function () {
        var open = lid.getAttribute('aria-expanded') !== 'true';
        lid.setAttribute('aria-expanded', open ? 'true' : 'false');
        lid.closest('.box').classList.toggle('open', open);
      });
    });
  }

  function ticker() {
    document.querySelectorAll('[data-ticker]').forEach(function (tk) {
      var btn = tk.querySelector('.tk-pause');
      if (!btn) return;
      btn.addEventListener('click', function () {
        var paused = tk.classList.toggle('paused');
        btn.setAttribute('aria-label', paused ? 'הפעלת הסרט הנע' : 'עצירת הסרט הנע');
      });
    });
  }

  function menu() {
    var button = document.querySelector('[data-menu-btn]');
    var panel = document.querySelector('[data-menu]');
    if (!button || !panel) return;

    function isOpen() { return button.getAttribute('aria-expanded') === 'true'; }
    function first() { return panel.querySelector('a,button'); }
    function setOpen(open, returnFocus) {
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
      panel.hidden = !open;
      root.classList.toggle('menu-open', open);   // hook in b.css: ".menu-open (set by Shell.menu)"
      if (open) {
        var f = first();
        if (f) f.focus();
      } else if (returnFocus) {
        button.focus();
      }
    }

    button.addEventListener('click', function () { setOpen(!isOpen(), false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen()) {
        e.preventDefault();
        setOpen(false, true);
      }
    });
    panel.addEventListener('keydown', function (e) {
      if (e.key === 'Tab' && e.shiftKey && document.activeElement === first()) {
        e.preventDefault();
        button.focus();
      }
    });
    function onFocusOut(e) {   // A11Y-03
      if (!isOpen()) return;
      var next = e.relatedTarget;
      if (next && (panel.contains(next) || button.contains(next))) return;
      setOpen(false, false);
    }
    panel.addEventListener('focusout', onFocusOut);
    button.addEventListener('focusout', onFocusOut);
    panel.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () { setOpen(false, false); });
    });
  }

  boxes();
  ticker();
  menu();
})();
