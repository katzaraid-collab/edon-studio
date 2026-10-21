/* AURO · act-local behaviour for acts 2 to 4.
   Act 3: the example price path draws itself across the pin, and the entry dot
   lands when the line reaches it. Reads the act's own --sc-p (written inline by
   the engine), touches nothing global. Runs only while act 3 is near view. */
(function () {
  'use strict';

  var act3 = document.querySelector('.act3');
  if (!act3) return;
  var path = act3.querySelector('.act3__path');
  var touch = act3.querySelector('.act3__touch');
  if (!path) return;

  var reduceMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var near = false, raf = 0, last = -1;

  // Draw window inside the pin: the card is mostly wiped in by 0.3, the line
  // runs 0.22 to 0.72, and the entry dot sits about 70% along the path.
  var DRAW_FROM = 0.22, DRAW_TO = 0.72, TOUCH_AT = 0.67, TOUCH_RAMP = 0.06;

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function reduced() {
    return (reduceMq && reduceMq.matches) || !!(window.AURO && window.AURO.reduced);
  }

  function paint() {
    raf = 0;
    var p = parseFloat(act3.style.getPropertyValue('--sc-p')) || 0;
    var d = reduced() ? 1 : easeOut(clamp01((p - DRAW_FROM) / (DRAW_TO - DRAW_FROM)));
    if (Math.abs(d - last) > 0.0005) {
      last = d;
      path.style.strokeDashoffset = (1 - d).toFixed(4);
      if (touch) touch.style.opacity = clamp01((d - TOUCH_AT) / TOUCH_RAMP).toFixed(3);
    }
    if (near) raf = requestAnimationFrame(paint);
  }

  act3.classList.add('act3--js');

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      near = entries[0].isIntersecting;
      if (near && !raf) raf = requestAnimationFrame(paint);
    }, { rootMargin: '25% 0px 25% 0px' }).observe(act3);
  } else {
    near = true;
    raf = requestAnimationFrame(paint);
  }
  paint();
})();
