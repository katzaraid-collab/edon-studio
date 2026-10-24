/* ==========================================================================
   Direction B · השקית — motion module: the hero scene. Version 3, 24.10.2026 (plan.md 2.5)
   Pairs with b-motion-hero.css (read its "WHO MOVES WHAT"). Owner: hero motion module.

   OWNS (all inside .hero)
     - word masks for the headline (brand line and headline), so its lines rise out of them (the
       rise itself is CSS); the .sr-only separator is left as it is
     - .b-hold: the scene's opening waits until the bag and the sticker are decoded (at most
       HOLD_MAX). The plate (the LCP image) and the text never wait (perf P2)
     - depth: hero scroll progress (0 at the top, 1 once the hero is under the header) moves the
       planes at different rates, as one camera pushing in toward the bag. Every plane scales about
       the bag's contact point, so the bag stays on the counter. Runs as Web Animations on a
       ScrollTimeline of ctx.scroller (compositor, no per-frame script); without ScrollTimeline the
       loop below writes the same values. Phones get their own, gentler travel, in which the wheat
       moves away from the bag and never across it
     - pointer lean per plane and a sunlight shift (fine pointers only, eased, idle when settled)
     - flour dust: one small canvas of motes drifting in the beam (brighter where the light is),
       stirred a little by the pointer, slower and amber in the evening. It lives for the opening
       only (O5 / R5 option b): the CSS fades it out by 3.65 s, then the script stops drawing it,
       hides the canvas and lets the loop go idle for good
     - .b-off: offscreen or behind the full-screen overlay, the dust and the lean stop

   CONTRACT (shell.js today, page contract 2 from site-plan/plan.md section 6.2)
     init(root, ctx) runs for every mounted copy. ctx = { scroller, reduced, frame } in the
     prototype; contract 2 adds { contract: 2, page, ioRoot, scrollEvents, vtHost, view }. On a page
     root = <html class="pb">, scroller = document.scrollingElement, ioRoot = null (the viewport) and
     scroll events come from window; each key falls back to the prototype value when missing, so the
     same file runs in both. On a page the window's resize also re-measures (the viewport height
     changes without <html> resizing, e.g. a phone's address bar).
     If the CSS opening has already started when init runs (a deferred script on a page that has
     painted), the module does not hold the scene or re-split the headline (either would restart
     motion that is already on screen) and skips the dust.
     Under reduced motion (ctx.reduced / .rm) it does nothing: the static scene from the CSS stays.
     One rAF loop, only while something moves and the scene is on screen. Layout is read in init,
     in measure() (ResizeObserver, window resize) and at most every 400ms inside the loop, never in
     scroll/pointer handlers. The returned cleanup removes every listener, observer, timer,
     animation, the canvas, the word masks and the inline styles.
   ========================================================================== */
(function () {
  'use strict';

  var FINE_POINTER = '(hover: hover) and (pointer: fine)';
  var WIDE_AT = 1000;   // b.css section 5 (fallback only: the CSS publishes its choice as --b-wide)
  var HOLD_MAX = 900;   // ms the bag waits for its images before it plays anyway
  var DUST_RES = 0.5;   // canvas pixels per CSS pixel: flour dust is soft, and a quarter of the pixels to upload
  var DUST_STEP = 30;   // ms between dust frames while it only drifts (<0.4px per step); every frame while stirred
  var DUST_OUT = 'b-hero-dust-out';   // the CSS fade that ends the dust (b-motion-hero.css section 2)
  var DUST_LIFE = 4000; // ms after the scene starts: fallback end, should that animation never report
  var OPENED_AFTER = 50; // ms: a CSS opening animation further along than this was already painted

  /* Scroll travel at hero progress 1. s: scale about the bag's contact point, x/y: share of the
     hero's width/height, o: opacity. Back and subject share y so the bag stays on the counter;
     depth comes from scale (the bag grows faster than the wall) and from the wheat overtaking both.
     Phone: the wheat stands to the right of the bag; its plane grows about the bag's base, so it
     moves out to the right and never toward the bag. */
  var TRAVEL = {
    wide: {
      back:    { s: 1.08, y: 0.18 },
      light:   { s: 1.08, y: 0.18, x: -0.035 },
      subject: { s: 1.16, y: 0.18 },
      motes:   { s: 1.22, y: 0.1 },
      front:   { s: 1.4,  y: -0.14, x: -0.04 },
      text:    { s: 0.93, y: 0.14, o: 0.5 }
    },
    narrow: {
      back:    { s: 1.05 },
      light:   { s: 1.05, x: -0.03 },
      subject: { s: 1.1 },
      motes:   { s: 1.12 },
      front:   { s: 1.24, y: -0.08, x: 0.04 },
      text:    { s: 0.98, o: 0.72 }
    }
  };

  /* Pointer lean in px with the pointer at the hero's edge. The scene leans away from the pointer,
     nearer planes further; the light follows it. Back and subject share y (bag on the counter).
     Narrow layouts lean at half strength (see stepLean). */
  var LEAN = {
    back:    { x: -5,  y: -3 },
    light:   { x: 22,  y: 9 },
    subject: { x: -10, y: -3 },
    motes:   { x: -15, y: -7 },
    front:   { x: -28, y: -12 }
  };

  /* Where the light is, in scene fractions. Day: a diagonal shaft (a, b, half-width w of the scene
     width) matching the plate's own sunlight. Evening: the lamp's pool on the bag (radius r),
     the point the CSS glow is centred on (--b-pool-l, given here in scene fractions). */
  var LIGHT = {
    wide:   { a: [0.8, 0], b: [0.36, 0.8], w: 0.19, lamp: [0.34, 0.52], r: 0.42, count: 48 },
    narrow: { a: [1.05, 0], b: [0.25, 0.8], w: 0.3, lamp: [0.6, 0.52], r: 0.6, count: 28 }
  };

  function noop() {}
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function smooth(v) { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); }
  function listen(el, type, fn, opts) {
    el.addEventListener(type, fn, opts);
    return function () { el.removeEventListener(type, fn, opts); };
  }

  /* ---------- has the CSS opening already been on screen? (a page whose deferred scripts ran
     after the first paint, or anything that mounts late) ---------- */
  function openingStarted(hero) {
    if (typeof hero.getAnimations !== 'function') return false;
    try {
      return hero.getAnimations({ subtree: true }).some(function (a) {
        return a.animationName && a.currentTime != null && a.currentTime > OPENED_AFTER;
      });
    } catch (err) { return false; }
  }

  /* ---------- headline: one mask per word, grouped into lines ---------- */
  function splitHeadline(h1) {
    var original = h1.innerHTML;
    var words = [];
    function wrap(textNode) {
      var frag = document.createDocumentFragment();
      textNode.nodeValue.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
        var mask = document.createElement('span');
        var word = document.createElement('span');
        mask.className = 'b-w';
        word.className = 'b-wi';
        word.textContent = part;
        mask.appendChild(word);
        frag.appendChild(mask);
        words.push(mask);
      });
      textNode.parentNode.replaceChild(frag, textNode);
    }
    (function walk(el) {
      Array.prototype.slice.call(el.childNodes).forEach(function (node) {
        if (node.nodeType === 3) wrap(node);
        // the separator for screen readers (": ") is not seen, so it gets no mask
        else if (node.nodeType === 1 && !node.classList.contains('sr-only')) walk(node);
      });
    })(h1);
    // the words are now inline blocks: give the heading its sentence back as one name
    h1.setAttribute('aria-label', h1.textContent.replace(/\s+/g, ' ').trim());
    h1.classList.add('b-split');
    // line index and index within the line drive the CSS delay (read once, here). Positions are
    // compared in the viewport, so the brand line and the headline share one reference
    var line = -1, top = null, inLine = 0;
    words.forEach(function (mask) {
      var t = mask.getBoundingClientRect().top;
      if (top === null || t > top + 4) { line++; inLine = 0; top = t; }
      mask.firstChild.style.setProperty('--l', line);
      mask.firstChild.style.setProperty('--wi', inLine++);
    });
    return function () {
      h1.innerHTML = original;
      h1.removeAttribute('aria-label');
      h1.classList.remove('b-split');
    };
  }

  /* ---------- scroll keyframes for one plane ---------- */
  function travelFrames(t, w, h, end) {
    var first = { offset: 0, transform: 'translate(0px, 0px) scale(1)' };
    var last = {
      offset: end,
      transform: 'translate(' + ((t.x || 0) * w).toFixed(1) + 'px, ' + ((t.y || 0) * h).toFixed(1) + 'px) scale(' + t.s + ')'
    };
    var frames = [first];
    if (t.o != null) {
      first.opacity = 1;
      last.opacity = t.o;
      frames.push({ offset: end * 0.3, opacity: 1 });   // the headline stays fully readable for a while
    }
    frames.push(last);
    if (end < 1) {
      var hold = { offset: 1, transform: last.transform };
      if (t.o != null) hold.opacity = t.o;
      frames.push(hold);
    }
    return frames;
  }

  function travelAt(t, w, h, p) {
    return {
      transform: 'translate(' + ((t.x || 0) * w * p).toFixed(2) + 'px, ' + ((t.y || 0) * h * p).toFixed(2) + 'px) scale(' + (1 + (t.s - 1) * p).toFixed(4) + ')',
      opacity: t.o == null ? null : String(1 - (1 - t.o) * clamp((p - 0.3) / 0.7, 0, 1))
    };
  }

  /* ---------- a soft round sprite for the motes ---------- */
  function sprite(r, g, b) {
    var c = document.createElement('canvas');
    c.width = c.height = 32;
    var x = c.getContext('2d');
    var grad = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(' + r + ',' + g + ',' + b + ',1)');
    grad.addColorStop(0.24, 'rgba(' + r + ',' + g + ',' + b + ',.92)');
    grad.addColorStop(0.5, 'rgba(' + r + ',' + g + ',' + b + ',.26)');
    grad.addColorStop(1, 'rgba(' + r + ',' + g + ',' + b + ',0)');
    x.fillStyle = grad;
    x.fillRect(0, 0, 32, 32);
    return c;
  }

  (window.ProtoModules = window.ProtoModules || []).push({
    name: 'b-hero',
    contract: 2,
    init: function (root, ctx) {
      ctx = ctx || {};
      var hero = root.querySelector('.hero');
      var scene = hero && hero.querySelector('.scene');
      if (!scene || ctx.reduced || !root.classList.contains('anim')) return noop;

      /* page contract 2: each key falls back to the prototype frame's single scrolling element */
      var scroller = ctx.scroller || document.scrollingElement || document.documentElement;
      var ioRoot = 'ioRoot' in ctx ? ctx.ioRoot : scroller;   // IntersectionObserver root (null = viewport)
      var scrollEvents = ctx.scrollEvents || scroller;         // where 'scroll' fires (window on a page)

      var cleanups = [];
      var destroyed = false;
      var planes = {
        back: scene.querySelector('.sc-back'),
        light: scene.querySelector('.sc-light'),
        subject: scene.querySelector('.sc-subject'),
        front: scene.querySelector('.sc-front'),
        motes: null,
        text: hero.querySelector('.hero-text')
      };

      function cleanup() {
        if (destroyed) return;
        destroyed = true;
        for (var i = cleanups.length - 1; i >= 0; i--) {
          try { cleanups[i](); } catch (err) { console.warn('[b-hero] cleanup failed:', err); }
        }
        cleanups = [];
      }

      try {
        // only a page can mount late: in the prototype shell.js clones a fresh copy right before
        // init, so the check (a style flush of the whole mount) is skipped there
        var opened = ctx.page ? openingStarted(hero) : false;

        /* --- shared state --- */
        var geo = { wide: null, w: 0, h: 0, sceneTop: 0, sceneW: 0, sceneH: 0, cvL: 0, cvT: 0, cvW: 0, cvH: 0, max: 1 };
        var visible = true, inert = false;
        var night = root.getAttribute('data-mode') === 'dark' ? 1 : 0, nightTo = night;
        var motes = [];
        var clock = 0, dustDue = 0, stirred = false;
        var released = false, dustDone = false, dustTimer = 0;
        var raf = 0, last = 0;
        var fine = window.matchMedia ? window.matchMedia(FINE_POINTER).matches : false;
        var ptr = { in: false, cx: 0, cy: 0, moved: false, rect: null, rectAt: -1e9, mx: null, my: 0, wx: 0, wy: 0 };
        var lean = { x: 0, y: 0, tx: 0, ty: 0, still: true };
        var useTimeline = typeof window.ScrollTimeline === 'function' && typeof Element.prototype.animate === 'function';
        var anims = {};
        var timeline = null;
        var scrollDirty = true, lastP = -1;
        var stats = window.__bHeroStats;   // optional probe used by the verification scripts

        function wake() {
          if (raf || destroyed) return;
          last = performance.now();
          raf = requestAnimationFrame(tick);
        }
        cleanups.push(function () { if (raf) cancelAnimationFrame(raf); raf = 0; });

        /* --- flour-dust canvas (always mounted while the module runs; hidden once its time is up) --- */
        var canvas = document.createElement('canvas');
        canvas.className = 'b-motes';
        canvas.setAttribute('aria-hidden', 'true');
        scene.insertBefore(canvas, planes.front);
        cleanups.push(function () { clearTimeout(dustTimer); canvas.remove(); });
        var g2 = opened ? null : canvas.getContext('2d');
        var dayDot = g2 && sprite(255, 249, 236);
        var nightDot = g2 && sprite(255, 194, 118);
        if (g2) planes.motes = canvas;
        else endDust();

        /* the dust is the opening's: when its CSS fade has run (or, failing that, after DUST_LIFE)
           it is over. The loop stops drawing, the canvas leaves the render tree, and its scroll
           animation goes, so nothing of it costs a frame again */
        function endDust() {
          if (dustDone) return;
          dustDone = true;
          clearTimeout(dustTimer);
          motes = [];
          canvas.hidden = true;
          if (anims.motes) { anims.motes.cancel(); delete anims.motes; }
          canvas.style.removeProperty('transform');
          canvas.style.removeProperty('translate');
          planes.motes = null;
        }
        if (g2) {
          cleanups.push(listen(canvas, 'animationend', function (e) {
            if (e.animationName === DUST_OUT) endDust();
          }));
        }

        /* --- the bag waits for its images (the wall and the text do not) --- */
        var holdTimer = 0;
        function release() {
          if (released || destroyed) return;
          released = true;
          clearTimeout(holdTimer);
          hero.classList.remove('b-hold');
          if (!dustDone) dustTimer = setTimeout(endDust, DUST_LIFE);
          wake();
        }
        if (opened) {
          release();
        } else {
          hero.classList.add('b-hold');
          holdTimer = setTimeout(release, HOLD_MAX);
          Promise.all(Array.prototype.map.call(scene.querySelectorAll('.sc-bag-img, .sc-sticker'), function (img) {
            return img.decode ? img.decode().catch(noop) : null;
          })).then(release, release);
        }
        cleanups.push(function () { clearTimeout(holdTimer); hero.classList.remove('b-hold'); });

        /* --- headline masks (not when its one-piece rise is already playing) --- */
        var h1 = hero.querySelector('h1');
        if (h1 && !opened) cleanups.push(splitHeadline(h1));

        /* --- motes --- */
        function seed(m, anywhere) {
          var z = Math.random();
          m.z = z;
          m.x = Math.random() * geo.cvW;
          m.y = anywhere ? Math.random() * geo.cvH : geo.cvH + 8;
          m.vx = (Math.random() - 0.5) * 7;
          m.vy = -(2.5 + Math.random() * 6) * (0.6 + z * 0.7);
          m.amp = 4 + Math.random() * 10;
          m.f = 0.25 + Math.random() * 0.5;
          m.tw = 0.6 + Math.random() * 1.6;
          m.ph = Math.random() * 6.283;
          m.r = 0.8 + z * 2;
          m.a = 0.55 + z * 0.45;
          m.ix = 0;
          m.iy = 0;
          return m;
        }
        function reseed() {
          var n = LIGHT[geo.wide ? 'wide' : 'narrow'].count;
          motes = [];
          for (var i = 0; i < n; i++) motes.push(seed({}, true));
        }

        function lightAt(sx, sy, L) {
          // day: distance from the shaft's centre line, in px of the scene
          var ax = L.a[0] * geo.sceneW, ay = L.a[1] * geo.sceneH;
          var bx = L.b[0] * geo.sceneW - ax, by = L.b[1] * geo.sceneH - ay;
          var len = Math.sqrt(bx * bx + by * by) || 1;
          var d = Math.abs((sx - ax) * by - (sy - ay) * bx) / len;
          var day = 0.25 + 0.75 * smooth(1 - d / (L.w * geo.sceneW));
          if (night < 0.01) return day;
          var dx = sx - L.lamp[0] * geo.sceneW, dy = sy - L.lamp[1] * geo.sceneH;
          var eve = 0.12 + 0.88 * smooth(1 - Math.sqrt(dx * dx + dy * dy) / (L.r * geo.sceneW));
          return day + (eve - day) * night;
        }

        function stepMotes(dt) {
          var s = dt / 1000;
          night += (nightTo - night) * (1 - Math.exp(-dt / 200));   // settles in ~600ms
          if (Math.abs(nightTo - night) < 0.002) night = nightTo;
          var speed = 1 - 0.62 * night;
          clock += s * speed;
          var L = LIGHT[geo.wide ? 'wide' : 'narrow'];
          var W = geo.cvW, H = geo.cvH;
          var drag = Math.exp(-dt / 420);
          var wind = ptr.in && (ptr.wx || ptr.wy);
          var push = 0;
          g2.setTransform(DUST_RES, 0, 0, DUST_RES, 0, 0);
          g2.clearRect(0, 0, W, H);
          for (var i = 0; i < motes.length; i++) {
            var m = motes[i];
            if (wind) {
              var dx = m.x - ptr.mx, dy = m.y - ptr.my;
              var f = 1 - (dx * dx + dy * dy) / 12100;   // 110px radius
              if (f > 0) { m.ix += ptr.wx * f * 0.05; m.iy += ptr.wy * f * 0.05; }
            }
            m.ix = clamp(m.ix * drag, -60, 60);
            m.iy = clamp(m.iy * drag, -60, 60);
            push = Math.max(push, Math.abs(m.ix) + Math.abs(m.iy));
            m.x += (m.vx * speed + m.ix) * s;
            m.y += (m.vy * speed + m.iy) * s;
            if (m.y < -10 || m.x < -16 || m.x > W + 16 || m.y > H + 12) seed(m, false);
            var x = m.x + Math.sin(clock * m.f + m.ph) * m.amp;
            var glint = 0.7 + 0.3 * Math.sin(clock * m.tw * 3 + m.ph);
            var a = m.a * glint * lightAt(x + geo.cvL, m.y + geo.cvT, L);
            var size = m.r * 4;
            if (night < 0.99) {
              g2.globalAlpha = a * (1 - night);
              g2.drawImage(dayDot, x - size / 2, m.y - size / 2, size, size);
            }
            if (night > 0.01) {
              g2.globalAlpha = a * night;
              g2.drawImage(nightDot, x - size / 2, m.y - size / 2, size, size);
            }
          }
          g2.globalAlpha = 1;
          ptr.wx = ptr.wy = 0;
          stirred = push > 4 || nightTo !== night;
        }

        /* --- pointer lean (eased toward the target, idle once settled) --- */
        function stepLean(dt, now) {
          if (ptr.moved) {
            ptr.moved = false;
            if (!ptr.rect || now - ptr.rectAt > 400) { ptr.rect = hero.getBoundingClientRect(); ptr.rectAt = now; }
            var r = ptr.rect;
            var nx = clamp((ptr.cx - r.left) / (r.width || 1), 0, 1);
            var ny = clamp((ptr.cy - r.top) / (r.height || 1), 0, 1);
            if (ptr.in) {
              lean.tx = nx * 2 - 1;
              lean.ty = ny * 2 - 1;
              // pointer position and velocity in canvas px, for the dust
              var mx = nx * geo.w - geo.cvL, my = ny * geo.h - geo.sceneTop - geo.cvT;
              if (ptr.mx != null) {
                ptr.wx = clamp((mx - ptr.mx) / dt * 1000, -900, 900);
                ptr.wy = clamp((my - ptr.my) / dt * 1000, -900, 900);
              }
              ptr.mx = mx;
              ptr.my = my;
            }
          }
          var dx = lean.tx - lean.x, dy = lean.ty - lean.y;
          if (Math.abs(dx) < 0.0008 && Math.abs(dy) < 0.0008) {
            if (lean.still) return false;
            lean.x = lean.tx;
            lean.y = lean.ty;
            lean.still = true;
          } else {
            var k = 1 - Math.exp(-dt / 150);
            lean.x += dx * k;
            lean.y += dy * k;
            lean.still = false;
          }
          var soft = geo.wide ? 1 : 0.5;
          for (var name in LEAN) {
            var el = planes[name];
            if (el) el.style.translate = (LEAN[name].x * lean.x * soft).toFixed(2) + 'px ' + (LEAN[name].y * lean.y * soft).toFixed(2) + 'px';
          }
          return !lean.still;
        }

        /* --- scroll depth --- */
        function buildTravel() {
          var set = TRAVEL[geo.wide ? 'wide' : 'narrow'];
          var span = Math.max(1, geo.h);
          if (useTimeline) {
            var end = clamp(span / geo.max, 0.001, 1);
            if (!timeline) timeline = new window.ScrollTimeline({ source: scroller, axis: 'block' });
            Object.keys(set).forEach(function (name) {
              var el = planes[name];
              if (!el) return;
              var frames = travelFrames(set[name], geo.w, geo.h, end);
              if (anims[name]) anims[name].effect.setKeyframes(frames);
              else anims[name] = el.animate(frames, { timeline: timeline, fill: 'both', easing: 'linear' });
            });
          } else {
            lastP = -1;
            scrollDirty = true;
            wake();
          }
        }
        function applyScroll() {
          var p = clamp(scroller.scrollTop / Math.max(1, geo.h), 0, 1);
          if (p === lastP) return;
          lastP = p;
          var set = TRAVEL[geo.wide ? 'wide' : 'narrow'];
          for (var name in set) {
            var el = planes[name];
            if (!el) continue;
            var v = travelAt(set[name], geo.w, geo.h, p);
            el.style.transform = v.transform;
            if (v.opacity !== null) el.style.opacity = v.opacity;
          }
        }
        cleanups.push(function () {
          Object.keys(anims).forEach(function (name) { anims[name].cancel(); });
          anims = {};
          [planes.back, planes.light, planes.subject, planes.front, canvas, planes.text].forEach(function (el) {
            if (!el) return;
            el.style.removeProperty('transform');
            el.style.removeProperty('translate');
            el.style.removeProperty('opacity');
          });
        });

        /* --- geometry: read here only (init, ResizeObserver, window resize on a page) --- */
        function isWide() {
          // the composition the container query picked (b-motion-hero.css section 0)
          var v = getComputedStyle(hero).getPropertyValue('--b-wide').trim();
          return v ? v === '1' : root.offsetWidth >= WIDE_AT;
        }
        function measure() {
          if (destroyed) return;
          var wide = isWide();
          var layoutChanged = wide !== geo.wide;
          geo.wide = wide;
          geo.w = hero.offsetWidth;
          geo.h = hero.offsetHeight;
          geo.sceneTop = scene.offsetTop;
          geo.sceneW = scene.offsetWidth;
          geo.sceneH = scene.offsetHeight;
          geo.max = Math.max(1, scroller.scrollHeight - scroller.clientHeight);
          ptr.rect = null;
          if (planes.motes) {
            var w = canvas.offsetWidth, h = canvas.offsetHeight;
            geo.cvL = canvas.offsetLeft;
            geo.cvT = canvas.offsetTop;
            if (w !== geo.cvW || h !== geo.cvH || layoutChanged) {
              geo.cvW = w;
              geo.cvH = h;
              canvas.width = Math.max(1, Math.round(w * DUST_RES));
              canvas.height = Math.max(1, Math.round(h * DUST_RES));
              reseed();
            }
          }
          buildTravel();
          wake();
        }
        measure();
        var measureQueued = 0;
        function queueMeasure() {
          if (measureQueued || destroyed) return;
          measureQueued = requestAnimationFrame(function () { measureQueued = 0; measure(); });
        }
        var ro = new ResizeObserver(queueMeasure);
        [root, hero, scroller].forEach(function (el) { ro.observe(el); });
        cleanups.push(function () { ro.disconnect(); if (measureQueued) cancelAnimationFrame(measureQueued); measureQueued = 0; });
        // a page's viewport can change height without <html> changing size (H6)
        if (ctx.page) cleanups.push(listen(window, 'resize', queueMeasure, { passive: true }));

        /* --- the loop: dust, pointer lean, and the scroll fallback; idle otherwise --- */
        function tick(now) {
          raf = 0;
          if (destroyed) return;
          var dt = clamp(now - last, 1, 64);
          last = now;
          var t0 = stats ? performance.now() : 0;
          var busy = false;
          if (!useTimeline && scrollDirty) { scrollDirty = false; applyScroll(); }
          if (visible && !inert) {
            if (fine && stepLean(dt, now)) busy = true;
            if (planes.motes && released) {
              dustDue += dt;
              if (stirred || ptr.wx || ptr.wy || dustDue >= DUST_STEP) { stepMotes(dustDue); dustDue = 0; }
              busy = true;
            }
          }
          if (stats) { var t = performance.now() - t0; stats.n++; stats.sum += t; if (t > stats.max) stats.max = t; }
          if (busy) raf = requestAnimationFrame(tick);
        }

        /* --- scroll: only flags; the loop or the compositor does the work --- */
        cleanups.push(listen(scrollEvents, 'scroll', function () {
          ptr.rect = null;
          if (!useTimeline) { scrollDirty = true; wake(); }
        }, { passive: true }));

        /* --- pointer (fine pointers only) --- */
        if (fine) {
          var onMove = function (e) {
            ptr.cx = e.clientX;
            ptr.cy = e.clientY;
            ptr.moved = true;
            wake();
          };
          cleanups.push(listen(hero, 'pointerenter', function (e) { ptr.in = true; ptr.mx = null; ptr.rect = null; onMove(e); }, { passive: true }));
          cleanups.push(listen(hero, 'pointermove', onMove, { passive: true }));
          cleanups.push(listen(hero, 'pointerleave', function () {
            ptr.in = false;
            lean.tx = 0;
            lean.ty = 0;
            wake();
          }, { passive: true }));
        }

        /* --- on screen inside its viewport (with a 25% lead, so everything is running again
           before the scene shows), and not behind the full-screen overlay. Offscreen, the dust and
           the lean stop and the scroll animations are held, so scrolling the rest of the page costs
           nothing here; played again, a scroll-driven animation re-aligns with the scroll. --- */
        function setOff() {
          var on = visible && !inert;
          hero.classList.toggle('b-off', !on);
          if (!useTimeline) hero.classList.toggle('b-live', on);
          Object.keys(anims).forEach(function (name) {
            var a = anims[name];
            if (on && a.playState === 'paused') a.play();
            else if (!on && a.playState !== 'paused') a.pause();
          });
          if (on) wake();
        }
        var io = new IntersectionObserver(function (entries) {
          visible = entries[entries.length - 1].isIntersecting;
          setOff();
        }, { root: ioRoot, rootMargin: '25% 0px', threshold: 0 });
        io.observe(scene);
        // the page behind the overlay is made inert by shell.js; its frames stop while it is open
        function checkInert() {
          var now = !!(scroller.closest && scroller.closest('[inert]'));
          if (now !== inert) { inert = now; setOff(); }
        }
        checkInert();
        var inertWatch = new MutationObserver(checkInert);
        inertWatch.observe(document.body, { attributes: true, attributeFilter: ['inert'], subtree: true });
        cleanups.push(function () {
          io.disconnect();
          inertWatch.disconnect();
          hero.classList.remove('b-off', 'b-live');
        });

        /* --- day and evening: the CSS cross-fades the light, the dust follows here --- */
        var modeWatch = new MutationObserver(function () {
          nightTo = root.getAttribute('data-mode') === 'dark' ? 1 : 0;
          wake();
        });
        modeWatch.observe(root, { attributes: true, attributeFilter: ['data-mode'] });
        cleanups.push(function () { modeWatch.disconnect(); });

        setOff();
      } catch (err) {
        cleanup();
        throw err;
      }

      return cleanup;
    }
  });
})();
