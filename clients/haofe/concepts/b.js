/* ==========================================================================
   Direction B · השקית — prototype behaviour (no motion here: see b-motion-*.css/js)

   shell.js mounts <template id="proto"> several times at once (desktop frame, two phone
   frames, the full-screen overlay) and calls PROTO.init(root, ctx) for each copy, so
   everything below is scoped to root. Listeners on elements inside root go away with the
   copy; anything outside root is removed by the cleanup function init returns, which
   shell.js calls before the copy is rebuilt or the overlay closes.

   OWNS
     - ticker: the pause button (WCAG 2.2.2) toggles .ticker.paused and its label
     - feed rail (phones): a polaroid that receives keyboard focus is centred in the rail
   The product boxes have no lid any more (plan R1): the list is printed on each box, so
   there is nothing to open. Ordering is by phone only: the site has no online ordering.
   ========================================================================== */
(function () {
  'use strict';

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

  /* feed rail: under 700px the polaroids scroll sideways (b.css). When Tab lands on a card, centre
     it in the rail. Only the rail scrolls (scrollBy on it, not scrollIntoView), so neither the
     prototype's viewport nor the presentation page moves. Frames are scaled with a transform:
     getBoundingClientRect() is in screen pixels, scrollBy in the rail's own, hence k. */
  function feedRail(root, ctx) {
    var rail = root.querySelector('.polas');
    if (!rail) return;
    rail.addEventListener('focusin', function (e) {
      var card = e.target && e.target.closest && e.target.closest('.pola');
      if (!card || rail.scrollWidth <= rail.clientWidth + 1) return;
      var r = rail.getBoundingClientRect();
      var c = card.getBoundingClientRect();
      var k = (r.width / (rail.offsetWidth || r.width)) || 1;
      var dx = ((c.left + c.width / 2) - (r.left + r.width / 2)) / k;
      if (Math.abs(dx) < 2) return;
      var still = (ctx && ctx.reduced) || root.classList.contains('rm');
      rail.scrollBy({ left: dx, behavior: still ? 'auto' : 'smooth' });
    });
  }

  window.PROTO = {
    init: function (root, ctx) {
      ticker(root);
      feedRail(root, ctx);
    }
  };
})();
