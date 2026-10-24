/* ==========================================================================
   Direction B · השקית — prototype behaviour (no motion here: see b-motion-*.css/js)

   shell.js mounts <template id="proto"> several times at once (desktop frame, two phone
   frames, the full-screen overlay) and calls PROTO.init(root, ctx) for each copy, so
   everything below is scoped to root. Listeners on elements inside root go away with the
   copy; anything outside root is removed by the cleanup function init returns, which
   shell.js calls before the copy is rebuilt or the overlay closes.

   OWNS
     - product boxes: the lid button opens and closes its details (.box.open, aria-expanded)
     - ticker: the pause button (WCAG 2.2.2) toggles .ticker.paused and its label
     - online ordering: root[data-order] follows the page's "הדמיית יום ההשקה" checkbox
   ========================================================================== */
(function () {
  'use strict';

  /* product boxes: a real <button>, so Enter and Space work without extra code */
  function boxes(root) {
    root.querySelectorAll('.lid').forEach(function (lid) {
      lid.addEventListener('click', function () {
        var open = lid.getAttribute('aria-expanded') !== 'true';
        lid.setAttribute('aria-expanded', open ? 'true' : 'false');
        lid.closest('.box').classList.toggle('open', open);
      });
    });
  }

  /* ticker pause; hovering also pauses it, in b-motion-scroll.css */
  function ticker(root) {
    var tk = root.querySelector('[data-ticker]');
    var btn = tk && tk.querySelector('.tk-pause');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var paused = tk.classList.toggle('paused');
      btn.setAttribute('aria-label', paused ? 'הפעלת הסרט הנע' : 'עצירת הסרט הנע');
    });
  }

  /* online ordering: data-order="soon" | "live" flips the whole module on launch day */
  function orderSwitch(root) {
    var box = document.getElementById('order-live');
    /* the app URL is written into the link only when the switch says live, so the "soon" page never contains it */
    var links = root.querySelectorAll('[data-live-href]');
    function apply() {
      var live = !!(box && box.checked);
      root.setAttribute('data-order', live ? 'live' : 'soon');
      links.forEach(function (a) {
        if (live) a.setAttribute('href', a.getAttribute('data-live-href'));
        else a.removeAttribute('href');
      });
    }
    apply();
    if (!box) return;
    box.addEventListener('change', apply);
    return function () { box.removeEventListener('change', apply); };
  }

  window.PROTO = {
    init: function (root) {
      boxes(root);
      ticker(root);
      return orderSwitch(root);
    }
  };
})();
