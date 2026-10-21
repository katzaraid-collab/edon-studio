/* AURO landing page · shell behaviour.
   Owns window.AURO (the shared state the 3D scene and the acts read), the
   divider's position story across the page, its progress fill and act ticks,
   the join link, and the reduced-motion / no-WebGL classes. */
(function () {
  'use strict';

  // The real WhatsApp invite goes here. Every [data-join] link uses it.
  var JOIN_URL = 'https://chat.whatsapp.com/';

  var root = document.documentElement;
  var mqMobile = matchMedia('(max-width: 759px)');
  var mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  var mqFine = matchMedia('(hover: hover) and (pointer: fine)');

  var A = window.AURO = window.AURO || {};
  A.split = 0.5;
  A.mobile = mqMobile.matches;
  A.hero = 0;
  A.close = 0;
  A.velocity = 0;
  A.pointer = A.pointer || { x: 0, y: 0 };
  A.reduced = mqReduce.matches;
  if (A.webgl !== false) A.webgl = true;

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(t) { t = clamp01(t); return t * t * (3 - 2 * t); }

  // ---- acts ---------------------------------------------------------------
  function pick(n, cls) {
    return document.querySelector('[data-act="' + n + '"]') || document.querySelector('.' + cls);
  }
  var acts = {
    hero: pick(1, 'act1'),
    a2: pick(2, 'act2'),
    a3: pick(3, 'act3'),
    a4: pick(4, 'act4'),
    close: document.getElementById('join') || pick(5, 'act5')
  };
  var geo = {};      // cached top/height per act, in document pixels
  var vh = innerHeight, vw = innerWidth, maxY = 1;

  function isPinned(el) {
    var d = el && el.getAttribute('data-sc-act');
    return d === 'pin' || d === 'scrub' || d === 'pan';
  }

  function measure() {
    vh = innerHeight; vw = innerWidth;
    maxY = Math.max(root.scrollHeight - vh, 1);
    Object.keys(acts).forEach(function (k) {
      var el = acts[k];
      if (!el) { geo[k] = null; return; }
      var r = el.getBoundingClientRect();
      geo[k] = { top: r.top + scrollY, h: r.height, pinned: isPinned(el) };
    });
    buildTicks();
    measureHeroText();
    // Flow acts hold the split value of their midpoint: a live column width would
    // rewrap their text as you scroll and change the document's height under the
    // reader. The moving divider stays inside the column padding (max 3% of width).
    [['a2', 0.47], ['a4', 0.37]].forEach(function (pair) {
      var el = acts[pair[0]];
      if (el) el.style.setProperty('--split-x', (A.mobile ? 0 : Math.round(pair[1] * vw)) + 'px');
    });
    A.mobile = mqMobile.matches;
  }

  // Same formulas as the engine, so a pinned act's progress here equals its --sc-p.
  function progress(k, y) {
    var g = geo[k];
    if (!g) return 0;
    if (g.pinned) return clamp01((y - g.top) / Math.max(g.h - vh, 1));
    return clamp01((y + vh - g.top) / (g.h + vh));
  }

  // ---- the divider's story --------------------------------------------------
  // 0.50 hero · 0.44 comparison · 0.40 trade idea · 0.34 rules · 0 at the close.
  function splitTarget(y) {
    var s = 0.5;
    var p2 = progress('a2', y), p3 = progress('a3', y), p4 = progress('a4', y), pc = progress('close', y);
    if (A.reduced) {
      // no travel: each act holds its own value
      if (p2 > 0.25) s = 0.44;
      if (p3 > 0) s = 0.40;
      if (p4 > 0.25) s = 0.34;
      if (pc > 0.45) s = 0;
      return s;
    }
    if (geo.a2 && p2 > 0) s = lerp(0.5, 0.44, smooth(p2));
    if (geo.a3 && p3 > 0) s = lerp(0.44, 0.40, smooth(p3));
    if (geo.a4 && p4 > 0) s = lerp(0.40, 0.34, smooth(p4));
    if (geo.close && pc > 0) s = 0.34 * (1 - smooth((pc - 0.2) / 0.5));
    return s;
  }

  // ---- divider ticks: one per act, where it begins --------------------------
  var ticksHost = document.querySelector('.divider__ticks');
  var ticks = [];
  function buildTicks() {
    if (!ticksHost) return;
    ticksHost.textContent = '';
    ticks = [];
    ['a2', 'a3', 'a4', 'close'].forEach(function (k) {
      var g = geo[k];
      if (!g) return;
      var t = document.createElement('span');
      t.className = 'divider__tick';
      var at = clamp01(g.top / maxY);
      t.style.setProperty('--t', at.toFixed(4));
      ticksHost.appendChild(t);
      ticks.push({ el: t, at: at, past: false });
    });
  }

  // ---- phone hero: the alone band ends exactly on the divider ----------------
  var heroRow = document.querySelector('.hero-row');
  var heroAloneText = [document.querySelector('.hero-title__alone'), document.querySelector('.hero-sub--alone')];
  function measureHeroText() {
    if (!heroRow) return;
    var h = 0;
    heroAloneText.forEach(function (el) { if (el) h += el.offsetHeight; });
    heroRow.style.setProperty('--hero-a-text', h + 'px');
  }

  // ---- pointer (fine pointers only) -----------------------------------------
  var ptr = { x: 0, y: 0 };
  addEventListener('pointermove', function (e) {
    if (!mqFine.matches || A.reduced || e.pointerType !== 'mouse') return;
    ptr.x = (e.clientX / vw) * 2 - 1;
    ptr.y = (e.clientY / vh) * 2 - 1;
  }, { passive: true });
  document.addEventListener('pointerleave', function () { ptr.x = 0; ptr.y = 0; });

  // ---- classes ----------------------------------------------------------------
  function syncClasses() {
    A.reduced = mqReduce.matches;
    A.mobile = mqMobile.matches;
    root.classList.toggle('reduced', A.reduced);
    root.classList.toggle('is-mobile', A.mobile);
  }

  // ---- the loop ---------------------------------------------------------------
  var chrome = document.querySelector('.chrome');
  var shown = { split: -1, sx: -1, sy: -1, prog: -1, dvo: -1 };
  var split = null, lastY = scrollY, raf = 0, lastT = 0;
  var rest = false, chromeHidden = false;

  function frame(now) {
    raf = 0;
    var y = scrollY;
    // frame-rate independent smoothing: the same feel at 30, 60 or 120 fps
    var dt = lastT ? Math.min(now - lastT, 100) : 16.7;
    lastT = now;
    var k = function (perFrame) { return 1 - Math.pow(1 - perFrame, dt / 16.7); };

    var target = splitTarget(y);
    if (split === null || A.reduced) split = target;
    else split += (target - split) * k(0.16);
    if (Math.abs(target - split) < 0.0004) split = target;

    A.split = split;
    A.hero = progress('hero', y);
    A.close = progress('close', y);
    A.velocity += ((y - lastY) * (16.7 / dt) - A.velocity) * k(0.2);
    if (Math.abs(A.velocity) < 0.01) A.velocity = 0;
    lastY = y;

    if (A.reduced || !mqFine.matches) { A.pointer.x = 0; A.pointer.y = 0; }
    else {
      A.pointer.x += (ptr.x - A.pointer.x) * k(0.08);
      A.pointer.y += (ptr.y - A.pointer.y) * k(0.08);
    }
    if (A.webgl === false && !root.classList.contains('no-webgl')) root.classList.add('no-webgl');

    // write only what changed: every custom-property write is a style recalc
    var sx = Math.round(split * vw * 10) / 10;
    var sy = Math.round(split * vh * 10) / 10;
    var prog = Math.round(clamp01(y / maxY) * 1000) / 1000;
    if (split !== shown.split) { root.style.setProperty('--split', split.toFixed(4)); shown.split = split; }
    if (sx !== shown.sx) { root.style.setProperty('--split-x', sx + 'px'); root.style.setProperty('--split-x-live', sx + 'px'); shown.sx = sx; }
    if (sy !== shown.sy) { root.style.setProperty('--split-y', sy + 'px'); shown.sy = sy; }
    if (prog !== shown.prog) {
      root.style.setProperty('--progress', prog);
      shown.prog = prog;
      for (var i = 0; i < ticks.length; i++) {
        var past = prog >= ticks[i].at;
        if (past !== ticks[i].past) { ticks[i].past = past; ticks[i].el.classList.toggle('is-past', past); }
      }
    }
    // the line leaves with the alone side: the last screen is one page
    var dvo = Math.round(Math.min(smooth(split / 0.06), 1 - smooth((A.close - 0.64) / 0.08)) * 100) / 100;
    if (dvo !== shown.dvo) { root.style.setProperty('--divider-o', dvo); shown.dvo = dvo; }

    // phone: inside the flow acts the rows pair themselves, so the fixed level rests
    var mid = y + vh * 0.5;
    var inFlow = A.mobile && ['a2', 'a4'].some(function (k) {
      var g = geo[k]; return g && mid >= g.top && mid < g.top + g.h;
    });
    if (inFlow !== rest) { rest = inFlow; root.classList.toggle('split-rest', rest); }

    // the top link steps aside once the close has its own call to action
    var hideChrome = A.close > 0.5;
    if (hideChrome !== chromeHidden && chrome) { chromeHidden = hideChrome; chrome.classList.toggle('chrome--hide', hideChrome); }

    if (document.visibilityState === 'visible') raf = requestAnimationFrame(frame);
  }
  function start() { if (!raf && document.visibilityState === 'visible') raf = requestAnimationFrame(frame); }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') { lastY = scrollY; lastT = 0; start(); } else stop();
  });

  // ---- join links --------------------------------------------------------------
  Array.prototype.forEach.call(document.querySelectorAll('[data-join]'), function (a) {
    a.href = JOIN_URL;
    a.target = '_blank';
    a.rel = 'noopener';
  });
  // "#join" lands on the resolved close (its last frame), not on its first screen
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href="#join"], a[href="#top"]');
    if (!a) return;
    var g = a.getAttribute('href') === '#join' ? geo.close : null;
    var to = g ? g.top + Math.max(g.h - vh, 0) : 0;
    e.preventDefault();
    scrollTo({ top: to, behavior: A.reduced ? 'auto' : 'smooth' });
    if (a.getAttribute('href') === '#top' && history.replaceState) history.replaceState(null, '', location.pathname + location.search);
  });

  // ---- setup ---------------------------------------------------------------------
  function onMedia() { syncClasses(); measure(); split = null; }
  [mqMobile, mqReduce, mqFine].forEach(function (mq) {
    if (mq.addEventListener) mq.addEventListener('change', onMedia); else mq.addListener(onMedia);
  });
  var resizeT = 0;
  function relayout() {
    // the engine caches act tops at layout(); a font swap or a rewrap changes
    // them without a resize event, so ask it to measure again, then measure here
    var sc = window.ScrollCraft && window.ScrollCraft.instances;
    if (sc) sc.forEach(function (i) { if (i && i.layout) i.layout(); });
    measure();
  }
  addEventListener('resize', function () { clearTimeout(resizeT); resizeT = setTimeout(measure, 80); });
  if ('ResizeObserver' in window) {
    var lastBodyH = 0;
    var ro = new ResizeObserver(function (entries) {
      var h = Math.round(entries[0].contentRect.height);
      if (h === lastBodyH) return;
      lastBodyH = h;
      clearTimeout(resizeT); resizeT = setTimeout(relayout, 60);
    });
    ro.observe(document.body);
  }
  addEventListener('load', relayout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);

  syncClasses();
  measure();
  start();
})();
