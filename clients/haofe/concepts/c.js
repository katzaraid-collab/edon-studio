/* Direction C · המדף החם — prototype behaviour.
 *
 * shell.js mounts the <template id="proto"> of c.html up to four times at once and
 * calls PROTO.init(root, ctx) for each mount (see the contract at the top of shell.js).
 * Everything here works inside `root`; scrolling is observed on ctx.scroller.
 *
 *   1. Rack: previous/next buttons and arrow keys move the horizontal track by one
 *      item (the alternative to dragging), and the progress bar follows the track.
 *   2. Process: the step nearest the middle of the viewport is lit, and the caption
 *      on the reel names it. With reduced motion every step stays lit.
 *
 * Returns a cleanup that stops the step observer and any pending frame.
 */
(function () {
  'use strict';

  var TRACK_GAP = 14;           // must match the .track gap in c.css
  var MIN_PROGRESS = 0.08;      // the progress bar never looks empty
  var EDGE = 4;                 // px of slack before a rack button counts as "at the end"
  var STEP_NAMES = ['בצק', 'התפחה', 'תנור', 'מדף'];

  /* 1. Rack. In RTL the track scrolls towards negative scrollLeft, so "next" is a
     negative scrollBy and the position is Math.abs(scrollLeft). */
  function setupRack(root, ctx) {
    var track = root.querySelector('[data-track]');
    var prev = root.querySelector('[data-prev]');
    var next = root.querySelector('[data-next]');
    var progress = root.querySelector('[data-prog]');

    // one item plus the gap, in the track's own pixels (the frame may be scaled down)
    function itemStep() {
      var item = track.querySelector('.item');
      if (!item) return 300;
      var scale = track.getBoundingClientRect().width / track.clientWidth;
      return item.getBoundingClientRect().width / scale + TRACK_GAP;
    }

    function update() {
      var max = track.scrollWidth - track.clientWidth;
      var pos = Math.abs(track.scrollLeft);
      var ratio = max > 0 ? pos / max : 1;
      progress.style.setProperty('--p', Math.max(MIN_PROGRESS, ratio).toFixed(3));
      prev.disabled = pos < EDGE;
      next.disabled = pos > max - EDGE;
    }

    function go(direction) {
      track.scrollBy({ left: -direction * itemStep(), behavior: ctx.reduced ? 'auto' : 'smooth' });
    }

    next.addEventListener('click', function () { go(1); });
    prev.addEventListener('click', function () { go(-1); });
    track.addEventListener('scroll', update, { passive: true });
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(1); }   // RTL: left = next
      if (e.key === 'ArrowRight') { e.preventDefault(); go(-1); }
    });

    var frame = requestAnimationFrame(update);
    return function () { cancelAnimationFrame(frame); };
  }

  /* 2. Process. A thin band across the middle of the scroller decides the active step. */
  function setupSteps(root, ctx) {
    if (ctx.reduced || !('IntersectionObserver' in window)) return null;
    var steps = [].slice.call(root.querySelectorAll('[data-step]'));
    var caption = root.querySelector('[data-cap]');

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var active = +entry.target.getAttribute('data-step');
        steps.forEach(function (step, i) { step.classList.toggle('on', i === active); });
        caption.textContent = 'שלב ' + (active + 1) + ': ' + STEP_NAMES[active];
      });
    }, { root: ctx.scroller, rootMargin: '-45% 0px -45% 0px' });

    steps.forEach(function (step) { observer.observe(step); });
    return function () { observer.disconnect(); };
  }

  window.PROTO = {
    init: function (root, ctx) {
      var cleanups = [setupRack(root, ctx), setupSteps(root, ctx)].filter(Boolean);
      return function () {
        cleanups.forEach(function (cleanup) { cleanup(); });
      };
    }
  };
})();
