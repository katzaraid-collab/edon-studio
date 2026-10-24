/* ==========================================================================
   האופה · site behaviour (no motion: that is the three motion modules, booted by runtime.js).
   The page-level port of the prototype's b.js plus the part of shell.js a real page still needs.
   Loaded with defer, before the motion modules and runtime.js. Runs once, on the real DOM.

     - ticker: the pause button (WCAG 2.2.2) toggles .ticker.paused and its label
     - feed rail (phones): a polaroid that receives keyboard focus is centred in the rail
     - menu: the mobile menu disclosure. Esc closes it from anywhere and returns focus to the button,
       Shift+Tab on the first item goes back to the button, choosing a link closes it, and it closes
       when focus leaves the panel (audit A11Y-03).
   Not needed on a page: shell.js ids/anchors (real ids and href="#id"), frames and the overlay.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;

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

  /* under 700px the polaroids scroll sideways (b.css). When Tab lands on a card, centre it in the
     rail; only the rail scrolls, never the page */
  function feedRail() {
    var rail = document.querySelector('.polas');
    if (!rail) return;
    rail.addEventListener('focusin', function (e) {
      var card = e.target && e.target.closest && e.target.closest('.pola');
      if (!card || rail.scrollWidth <= rail.clientWidth + 1) return;
      var r = rail.getBoundingClientRect();
      var c = card.getBoundingClientRect();
      var dx = (c.left + c.width / 2) - (r.left + r.width / 2);
      if (Math.abs(dx) < 2) return;
      rail.scrollBy({ left: dx, behavior: root.classList.contains('rm') ? 'auto' : 'smooth' });
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
      root.classList.toggle('menu-open', open);   // b.css hook ".menu-open"
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
    function onFocusOut(e) {
      if (!isOpen()) return;
      var next = e.relatedTarget;
      if (!next) return;   // the window lost focus: keep the menu as it was
      if (panel.contains(next) || button.contains(next)) return;
      setOpen(false, false);
    }
    panel.addEventListener('focusout', onFocusOut);
    button.addEventListener('focusout', onFocusOut);
    panel.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () { setOpen(false, false); });
    });
  }

  ticker();
  feedRail();
  menu();
})();
