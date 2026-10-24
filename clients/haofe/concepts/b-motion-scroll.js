/* ==========================================================================
   Direction B · השקית — motion module: scroll (the peak, entrances, ticker, product drift)
   Pairs with b-motion-scroll.css (read its header for the device list and the classes used).

   THE PEAK  the bread jumps out of the bag into the boxes. When the first row of boxes is in
   view, copies of the frena, challah and baguette leave the hero bag (.sc-bag) where it sits on
   screen right now and fly an arc into their boxes; at the moment of impact the copy is swapped
   for the real image, which squashes and springs back (--spring-bounce) while its box rocks. If
   the bag is far away (the visitor jumped down), no copy crosses the page: the real image drops in
   from just above its box, through the rim, spinning, with the same bounce. The other three
   products fall into their boxes from above and plop softly (--spring-settle).
   Everything runs as Web Animations the compositor can play by itself (transform / individual
   transform properties / opacity / clip-path, composite 'replace'), so a busy main thread cannot
   make it stutter.

   CONTRACT
     init(root, ctx) runs for every mounted copy, after PROTO.init (b.js) and before Shell.reveal.
     ctx = { scroller, reduced, frame }  frame: 'desktop' | 'phone' | 'full'
     The returned cleanup removes every listener, observer, timer, rAF, animation and injected node.
     Inside a prototype: no position: fixed, no window scroll; scroll and IntersectionObserver use
     ctx.scroller. The one observer without a root watches the scroller itself, to idle the
     module while the whole mount is off screen. Under reduced motion it does nothing at all.
     Layout is read only once per entrance (inside an IntersectionObserver callback) or in a
     ResizeObserver. The scroll handler reads no layout: it takes the position from a ScrollTimeline
     (sampled by the browser once per frame) and a cached scroll range. The one rAF loop (ticker
     easing; product drift on browsers without scroll timelines) sleeps when nothing moves.
     Hooks: see "hooks motion modules may rely on" at the top of b.css.
   ========================================================================== */
(function () {
  'use strict';

  /* where each leaping bread sits in the bag photo (fractions of .sc-bag), how it is turned there,
     and its width there as a fraction of the bag's width: frena, challah, baguette (box order) */
  var BAG_SPOTS = [
    { x: .49, y: .24, r: -10, f: .8 },
    { x: .83, y: .22, r: 22, f: .55 },
    { x: .11, y: .18, r: -74, f: .62 }
  ];

  function noop() {}
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function px(n) { return n.toFixed(2) + 'px'; }
  function tf(x, y, r, s) {
    return 'translate(' + px(x) + ',' + px(y) + ') rotate(' + r.toFixed(2) + 'deg) scale(' + s.toFixed(4) + ')';
  }

  /* the same move as individual properties, which stack on an element's own `transform` (a static
     tilt, a hover lift) without composite: 'add', so the compositor can run it */
  function ip(x, y, r, s) {
    return { translate: px(x) + ' ' + px(y), rotate: r.toFixed(2) + 'deg', scale: s.toFixed(4) };
  }

  /* a flight path as a cubic Bezier S -> C1 -> C2 -> E, sampled into keyframes by "cost": each
     stretch takes time in proportion to its length times a weight, so a stretch the visitor cannot
     see (under the sticky header) passes quickly and the visible part gets the time. weight(p, y)
     receives the path progress 0..1 and the point's y (content coordinates). Returns N + 1 points
     { x, y, s } where s is the path parameter reached. */
  function flightPath(S, C1, C2, E, N, weight) {
    var M = 160, pts = [], cost = [0];
    function at(t, a, b, c, d) { var m = 1 - t; return m * m * m * a + 3 * m * m * t * b + 3 * m * t * t * c + t * t * t * d; }
    for (var i = 0; i <= M; i++) {
      var t = i / M;
      pts.push({ x: at(t, S.x, C1.x, C2.x, E.x), y: at(t, S.y, C1.y, C2.y, E.y), t: t });
      if (i) {
        var a = pts[i - 1], b = pts[i];
        cost.push(cost[i - 1] + Math.sqrt((b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y)) * weight(t, b.y));
      }
    }
    var total = cost[M] || 1, out = [], j = 1;
    for (var k = 0; k <= N; k++) {
      var c = total * k / N;
      while (j < M && cost[j] < c) j++;
      var c0 = cost[j - 1], f = cost[j] > c0 ? clamp((c - c0) / (cost[j] - c0), 0, 1) : 1;
      var p0 = pts[j - 1], p1 = pts[j];
      out.push({ x: p0.x + (p1.x - p0.x) * f, y: p0.y + (p1.y - p0.y) * f, s: p0.t + (p1.t - p0.t) * f });
    }
    return out;
  }

  (window.ProtoModules = window.ProtoModules || []).push({
    name: 'b-scroll',
    init: function (root, ctx) {
      var scroller = ctx && ctx.scroller;
      var motion = !(ctx && ctx.reduced) && root.classList.contains('anim') && !root.classList.contains('rm');
      if (!motion || !scroller || !('IntersectionObserver' in window) || typeof root.animate !== 'function') return noop;

      var dead = false;
      var t0 = performance.now();
      var offs = [];             // listener removers
      var observers = [];
      var live = new Set();      // every Animation this module started
      var raf = 0, lastFrame = 0;

      function on(el, type, fn, opts) {
        el.addEventListener(type, fn, opts);
        offs.push(function () { el.removeEventListener(type, fn, opts); });
      }
      function observe(cb, opts) { var o = new IntersectionObserver(cb, opts); observers.push(o); return o; }
      function play(el, frames, opts) {
        var a;
        try { a = el.animate(frames, opts); } catch (e) { return null; }
        live.add(a);
        a.finished.then(function () { live.delete(a); }, function () { live.delete(a); });
        return a;
      }
      /* fn runs once every animation in the list has finished (never after cleanup) */
      function settled(list, fn) {
        var ps = list.filter(Boolean).map(function (a) { return a.finished; });
        Promise.all(ps).then(function () { if (!dead) fn(); }, noop);
      }
      function q(sel) { return root.querySelector(sel); }
      function qa(sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); }

      /* ---- motion tokens from .pb (b.css) ---- */
      var tokens = getComputedStyle(root);
      function tok(name) { return tokens.getPropertyValue(name).trim(); }
      function easing(value, fallback) {
        if (!value) return fallback;
        try { root.animate(null, { duration: 1, easing: value }).cancel(); return value; } catch (e) { return fallback; }
      }
      function ms(name, fallback) {
        var v = tok(name), n = parseFloat(v);
        if (!isFinite(n)) return fallback;
        return /ms$/.test(v) ? n : n * 1000;
      }
      var E_OUT = easing(tok('--ease-out'), 'cubic-bezier(.16,1,.3,1)');
      var E_IN = easing(tok('--ease-in'), 'cubic-bezier(.4,0,1,1)');
      var E_INOUT = easing(tok('--ease-in-out'), 'cubic-bezier(.65,0,.35,1)');
      var E_SPRING = easing(tok('--ease-spring'), 'cubic-bezier(.34,1.3,.64,1)');
      var SETTLE = easing(tok('--spring-settle'), E_OUT);
      var BOUNCE = easing(tok('--spring-bounce'), E_SPRING);
      var D_BOUNCE = ms('--dur-spring-bounce', 550);
      var STAG = ms('--stagger', 40);
      var SWAY = 'cubic-bezier(.37,0,.63,1)';   // a pendulum between its extremes (sine in-out)
      var IMPACT = 'cubic-bezier(.2,.7,.4,1)';  // the few frames of a squash

      /* ---- the page parts this module moves ---- */
      var hd = q('.hd'), bar = q('.bar'), bag = q('.sc-bag');
      var ticker = q('[data-ticker]'), track = ticker && ticker.querySelector('.tk-track');
      var boxes = qa('.box-grid .box');
      var polas = qa('.pola[data-rv]');
      var timelines = !!(window.CSS && CSS.supports && CSS.supports('animation-timeline: view()') && CSS.supports('timeline-scope: --sx'));

      /* the part of the scroller not covered by the sticky header (top) or the mobile bar (bottom),
         in the prototype's own pixels; k converts screen pixels of a scaled frame back to them */
      function geo() {
        var vr = scroller.getBoundingClientRect();
        var k = (vr.height / (scroller.offsetHeight || vr.height || 1)) || 1;
        var h = scroller.clientHeight;
        var top = hd ? hd.offsetHeight : 0;
        var bottom = bar && bar.offsetParent !== null ? bar.offsetHeight : 0;
        return { vr: vr, k: k, h: h, visTop: top, visBot: h - bottom, effH: Math.max(1, h - bottom - top) };
      }

      /* ---- entrance bookkeeping ---- */
      var meta = new Map();     // observed element -> info
      var byEl = new Map();     // [data-rv] element -> info
      var order = 0, nth = {};
      function addInfo(target, info) {
        info.order = order++;
        info.nth = nth[info.kind] = (nth[info.kind] === undefined ? 0 : nth[info.kind] + 1);
        info.started = false;
        info.anims = [];
        meta.set(target, info);
        byEl.set(info.el, info);
      }

      qa('[data-rv]').forEach(function (el) {
        if (el.classList.contains('box')) return;               // boxes enter through their products
        var c = el.classList, kind = 'fade', need = .3;
        if (c.contains('sec-head')) { kind = 'head'; need = .5; }
        else if (c.contains('slip')) { kind = 'print'; need = .3; }
        else if (c.contains('story-card')) { kind = 'lines'; need = .35; }
        else if (c.contains('pola')) { kind = 'deal'; need = .25; }
        else if (c.contains('b2b-band')) { kind = 'unroll'; need = .3; }
        else if (c.contains('label')) { kind = 'swing'; need = .35; }
        /* the waiting slip is clipped away, and an observer never sees a fully clipped target:
           watch its wrapper, which has the same box */
        addInfo(kind === 'print' && el.parentElement ? el.parentElement : el, { el: el, kind: kind, need: need });
      });
      boxes.forEach(function (box, i) {
        var prod = box.querySelector('.prod');
        if (!prod) return;
        addInfo(prod, { el: box, prod: prod, shot: prod.parentElement, idx: i, kind: i < 3 ? 'leap' : 'drop', need: .6 });
      });

      function go(el) { el.classList.add('sx-go'); }
      function done(el) {
        el.classList.add('rv-done');
        el.classList.remove('sx-go', 'sx-hold');
        if (el.parentElement) el.parentElement.classList.remove('sx-slot');
        if (el.classList.contains('pola')) el.style.zIndex = '';
      }
      function follow(info, anims) {
        info.anims = anims.filter(Boolean);
        settled(info.anims, function () { done(info.el); });
      }
      /* no animation: content that was already on screen at load, or that keyboard focus reached */
      function instant(info) {
        info.started = true;
        info.anims.forEach(function (a) { try { a.finish(); } catch (e) { /* already gone */ } });
        if (!info.el.classList.contains('rv-done')) done(info.el);
      }

      /* ===== the entrance devices ===== */

      /* heading: the label slides in from the start side, the title rises out of a mask at its
         own baseline, the rest follows */
      function head(info, delay) {
        var el = info.el, hand = el.querySelector('.hand'), h2 = el.querySelector('h2');
        go(el);
        var a = [];
        if (hand) a.push(play(hand, [{ opacity: 0, translate: '14px 0' }, { opacity: 1, translate: '0 0' }],
          { duration: 460, delay: delay, easing: E_OUT, fill: 'backwards' }));
        if (h2) a.push(play(h2, [
          { translate: '0 105%', clipPath: 'inset(-0.3em -0.3em calc(105% - 0.28em) -0.3em)' },
          { translate: '0 0', clipPath: 'inset(-0.3em -0.3em -0.28em -0.3em)' }
        ], { duration: 720, delay: delay + 2 * STAG, easing: E_OUT, fill: 'backwards' }));
        Array.prototype.forEach.call(el.children, function (kid) {
          if (kid === hand || kid === h2) return;
          a.push(play(kid, [{ opacity: 0, translate: '0 10px' }, { opacity: 1, translate: '0 0' }],
            { duration: 520, delay: delay + 6 * STAG, easing: E_OUT, fill: 'backwards' }));
        });
        follow(info, a);
      }

      /* order slip: printed top to bottom like a receipt. A cover in the page colour over the slip's
         wrapper (::after, it also hides the slip's border and shadow) shrinks toward the bottom while
         the paper feeds down a little; then the logo is stamped. Transforms only, no mask redrawn. */
      function print(info, delay) {
        var el = info.el, logo = el.querySelector('.logo-s'), slot = el.parentElement, T = 1000;
        go(el);
        var a = [play(el, [{ translate: '0 -18px' }, { translate: '0 0' }], { duration: T, delay: delay, easing: E_OUT, fill: 'backwards' })];
        if (slot) {
          slot.classList.add('sx-slot');
          a.push(play(slot, [{ scale: '1 1' }, { scale: '1 0' }], { duration: T, delay: delay, easing: E_INOUT, fill: 'both', pseudoElement: '::after' }));
        }
        if (logo) {
          a.push(play(logo, [{ scale: 1.45 }, { scale: 1 }], { duration: D_BOUNCE + 120, delay: delay + 760, easing: BOUNCE, fill: 'backwards' }));
          a.push(play(logo, [{ opacity: 0 }, { opacity: 1 }], { duration: 160, delay: delay + 760, easing: E_OUT, fill: 'backwards' }));
        }
        follow(info, a);
      }

      /* story: one line after another */
      function lines(info, delay) {
        var el = info.el;
        go(el);
        var a = Array.prototype.map.call(el.children, function (kid, i) {
          return play(kid, [{ opacity: 0, translate: '0 18px' }, { opacity: 1, translate: '0 0' }],
            { duration: 680, delay: delay + i * 3 * STAG, easing: E_OUT, fill: 'backwards' });
        });
        follow(info, a);
      }

      /* business band: unrolled from the start side (right). A page-coloured cover (::before)
         shrinks toward the left edge while the paper roll (::after) rides its edge, then lies flat.
         Both are transforms on pseudo-elements: nothing is re-masked per frame. */
      function unroll(info, delay) {
        var el = info.el, T = 1100;
        go(el);
        var a = [play(el, [{ scale: '1 1' }, { scale: '0 1' }],
          { duration: T, delay: delay, easing: E_INOUT, fill: 'both', pseudoElement: '::before' })];
        a.push(play(el, [{ translate: '100% 0' }, { translate: '0% 0' }],
          { duration: T, delay: delay, easing: E_INOUT, fill: 'both', pseudoElement: '::after' }));
        a.push(play(el, [{ opacity: 1 }, { opacity: 0 }],
          { duration: 220, delay: delay + T - 200, easing: E_OUT, fill: 'both', pseudoElement: '::after' }));
        follow(info, a);
      }

      /* branch labels: hanging tags swinging to rest on a nail above them */
      function swing(info, delay) {
        var el = info.el, a0 = (info.nth % 2 ? -1 : 1) * 12;
        go(el);
        follow(info, [
          play(el, [
            { rotate: a0 + 'deg', translate: '0 -18px', easing: SWAY },
            { rotate: (-a0 * .46).toFixed(2) + 'deg', translate: '0 0', offset: .34, easing: SWAY },
            { rotate: (a0 * .2).toFixed(2) + 'deg', offset: .58, easing: SWAY },
            { rotate: (-a0 * .07).toFixed(2) + 'deg', offset: .8, easing: SWAY },
            { rotate: '0deg', translate: '0 0' }
          ], { duration: 1300, delay: delay, fill: 'backwards' }),
          play(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 280, delay: delay, easing: E_OUT, fill: 'backwards' })
        ]);
      }

      /* anything else marked [data-rv]: a plain rise */
      function fade(info, delay) {
        go(info.el);
        follow(info, [play(info.el, [{ opacity: 0, translate: '0 14px' }, { opacity: 1, translate: '0 0' }],
          { duration: 560, delay: delay, easing: E_OUT, fill: 'backwards' })]);
      }

      /* polaroids: a row of two or more is dealt from one stack below its middle; a lone card
         (phone) is tossed onto its place from alternating sides */
      function deal(list) {
        var g = geo();
        var pend = polas.map(function (el) { return byEl.get(el); }).filter(function (info) { return info && !info.started; });
        var rects = new Map();
        pend.forEach(function (info) { rects.set(info, info.el.getBoundingClientRect()); });
        var rows = [];
        pend.forEach(function (info) {
          var top = rects.get(info).top / g.k, row = null;
          for (var i = 0; i < rows.length; i++) if (Math.abs(rows[i].top - top) < 14) { row = rows[i]; break; }
          if (!row) { row = { top: top, items: [] }; rows.push(row); }
          row.items.push(info);
        });
        rows.forEach(function (row) {
          var hit = row.items.some(function (info) { return list.indexOf(info) !== -1; });
          if (!hit) return;
          row.items.forEach(function (info) { info.started = true; go(info.el); });
          if (row.items.length < 2) { toss(row.items[0]); return; }
          var cs = row.items.map(function (info) {
            var r = rects.get(info);
            return { x: (r.left + r.width / 2) / g.k, y: (r.top + r.height / 2) / g.k };
          });
          var ox = cs.reduce(function (s, c) { return s + c.x; }, 0) / cs.length;
          var oy = cs.reduce(function (s, c) { return s + c.y; }, 0) / cs.length + 34;
          var tIn = 320, gap = 3 * STAG, dealT = 700;
          row.items.forEach(function (info, i) {
            var c = cs[i], dx = ox - c.x, dy = oy - c.y, rot = [-7, 5, -2.5, 4][i % 4];
            var start = tIn + i * gap, T = start + dealT;
            info.el.style.zIndex = String(row.items.length - i);   // the first card is the top of the stack
            follow(info, [
              play(info.el, [
                Object.assign(ip(dx, dy + 48, rot, .92), { offset: 0, easing: E_OUT }),
                Object.assign(ip(dx, dy, rot, .94), { offset: tIn / T, easing: 'linear' }),
                Object.assign(ip(dx, dy, rot, .94), { offset: start / T, easing: SETTLE }),
                Object.assign(ip(0, 0, 0, 1), { offset: 1 })
              ], { duration: T, fill: 'backwards' }),
              play(info.el, [{ opacity: 0 }, { opacity: 1 }], { duration: tIn, easing: E_OUT, fill: 'backwards' })
            ]);
          });
        });
      }
      function toss(info) {
        var s = info.nth % 2 ? -1 : 1;   // first from the start side (right)
        follow(info, [
          play(info.el, [ip(58 * s, 42, 9 * s, 1.04), ip(0, 0, 0, 1)],
            { duration: 760, easing: SETTLE, fill: 'backwards' }),
          play(info.el, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: E_OUT, fill: 'backwards' })
        ]);
      }

      /* ===== the peak ===== */

      var layer = null, flying = 0;
      function ensureLayer() {
        if (!layer) {
          layer = document.createElement('div');
          layer.className = 'sx-layer';
          layer.setAttribute('aria-hidden', 'true');
          root.appendChild(layer);
        }
        return layer;
      }
      function releaseLayer() {
        if (layer && flying === 0) { layer.remove(); layer = null; }
      }
      function tiltOf(el) {
        var cs = getComputedStyle(el), deg = 0, m = /matrix\(([^)]+)\)/.exec(cs.transform || '');
        if (m) { var v = m[1].split(','); deg = Math.atan2(parseFloat(v[1]), parseFloat(v[0])) * 180 / Math.PI; }
        var r = parseFloat(cs.rotate);
        return isFinite(r) ? deg + r : deg;
      }
      function driftOf(el) {
        var t = getComputedStyle(el).translate;
        if (!t || t === 'none') return 0;
        return parseFloat(t.split(/\s+/)[1]) || 0;
      }
      /* the contact shadow grows from nothing while the product approaches, spreads at impact and
         settles. transform only: the micro module owns its scale and opacity (open state). */
      function shadow(shot, delay, approach, after) {
        var T = approach + after;
        return play(shot, [
          { transform: 'scale(0)' },
          { transform: 'scale(.55)', offset: approach * .6 / T },
          { transform: 'scale(1)', offset: approach / T, easing: IMPACT },
          { transform: 'scale(1.16,1.05)', offset: (approach + 90) / T, easing: SETTLE },
          { transform: 'scale(1)' }
        ], { duration: T, delay: delay, fill: 'backwards', pseudoElement: '::after' });
      }
      /* the micro module owns the product's transform while its box is open (the product rises):
         a landing never starts on an open box, and opening a lid finishes a landing at once */
      function landing(box, prod, frames, opts) {
        if (box.classList.contains('open')) return null;
        return play(prod, frames, opts);
      }
      on(root, 'click', function (e) {
        var lid = e.target && e.target.closest && e.target.closest('.lid');
        var prod = lid && lid.closest('.box') && lid.closest('.box').querySelector('.prod');
        if (!prod) return;
        live.forEach(function (a) { if (a.effect && a.effect.target === prod && !a.effect.pseudoElement) { try { a.finish(); } catch (err) { /* gone */ } } });
      });

      /* frena, challah, baguette: out of the bag and into their boxes */
      function leap(list) {
        var g = geo(), L = ensureLayer(), lr = L.getBoundingClientRect();
        var br = bag ? bag.getBoundingClientRect() : null;
        list.forEach(function (info, n) {
          var box = info.el, prod = info.prod;
          var w = prod.offsetWidth, h = prod.offsetHeight;
          info.started = true;
          if (!w || !h || (!prod.currentSrc && !prod.src)) { done(box); return; }
          var pr = prod.getBoundingClientRect();
          var ex = (pr.left + pr.width / 2 - lr.left) / g.k;
          var ey = (pr.top + pr.height / 2 - lr.top) / g.k - driftOf(prod);
          var th = tiltOf(box), side = n % 2 ? -1 : 1;
          var spot = BAG_SPOTS[info.idx] || BAG_SPOTS[0];
          var bagMode = false, sx, sy, r0, s0, C1, C2, T, weight;
          var toScreen = (lr.top - g.vr.top) / g.k;   // content y + toScreen = y on screen (at launch)
          if (br && br.width > 0) {
            var bx = br.left + br.width * spot.x, by = br.top + br.height * spot.y;
            sy = (by - lr.top) / g.k;
            /* the bag counts as near while the bread's spot is at most half a screen above the view */
            if (sy + toScreen > g.visTop - g.effH * .5 && sy < ey - 60) {
              bagMode = true;
              sx = (bx - lr.left) / g.k;
              r0 = spot.r;
              s0 = clamp(br.width / g.k * spot.f / w, .3, 1);
            }
          }
          var delay = n * 3 * STAG;
          /* the bag is far away (the visitor jumped down): no copy flies across the page; the real
             image falls into its own box through the rim, spinning, and lands with the same bounce.
             Inside the box it can never cover another box's lid. */
          if (!bagMode) { fallIn(info, side, delay, h); return; }
          var hidden = function (y) { return y + toScreen < g.visTop; };
          /* up out of the bag almost vertically (a real hop only when the bag is in sight), the
             sideways travel in the visible stretch, and down into the box from above */
          var dx = ex - sx, drop = ey - sy;
          var hop = hidden(sy) ? 16 : clamp(drop * .12, 40, 140);
          var kick = Math.abs(dx) < 140 ? side * clamp(drop * .12, 30, 90) : 0;
          C1 = { x: sx + dx * .04 + kick, y: sy - hop };
          C2 = { x: ex - dx * .22 + kick * .8, y: ey - drop * .4 };
          weight = function (p, y) { return (hidden(y) ? .3 : 1) * (1 + .7 * p); };   // eases into the box
          var path = flightPath({ x: sx, y: sy }, C1, C2, { x: ex, y: ey }, 26, weight);
          var seen = 0, unseen = 0;
          for (var i = 1; i < path.length; i++) {
            var d = Math.sqrt(Math.pow(path[i].x - path[i - 1].x, 2) + Math.pow(path[i].y - path[i - 1].y, 2));
            if (hidden(path[i].y)) unseen += d; else seen += d;
          }
          T = clamp(340 + .5 * seen + .15 * unseen, 520, 940);
          var frames = path.map(function (pt, i) {
            var u = i / (path.length - 1), m = 1 - pt.s;
            var r = r0 + (th - r0) * (1 - Math.pow(1 - u, 1.7));
            var sc = s0 + (1 - s0) * (1 - m * m);
            return { offset: u, transform: tf(pt.x - ex, pt.y - ey, r, sc), opacity: u < .08 ? u / .08 : 1 };
          });
          var img = document.createElement('img');
          img.className = 'sx-fly';
          img.alt = '';
          img.decoding = 'async';
          img.src = prod.currentSrc || prod.src;
          img.style.left = px(ex - w / 2);
          img.style.top = px(ey - h / 2);
          img.style.width = px(w);
          img.style.height = px(h);
          if (timelines) { img.classList.add('sx-ride'); img.style.setProperty('--sx-tl', '--sxb' + (info.idx + 1)); }
          info.clone = img;
          flying++;
          var launch = function () {
            if (dead) return;
            L.appendChild(img);
            if (!timelines) pfSync();
            var flight = play(img, frames, { duration: T, delay: delay, easing: 'linear', fill: 'both' });
            var sh = shadow(info.shot, delay, T, 640);
            if (!flight) { impact(info, side, h, sh); return; }
            info.anims = [flight];
            flight.finished.then(function () { if (!dead) impact(info, side, h, sh); }, noop);
          };
          var ready = img.decode ? img.decode() : Promise.resolve();
          ready.then(launch, launch);
        });
        releaseLayer();   // nothing took off (all fell in from just above): no layer left behind
      }
      function fallIn(info, side, delay, h) {
        var prod = info.prod, fall = 460;
        info.el.classList.remove('sx-hold');
        var a = landing(info.el, prod, [
          { transform: 'translateY(' + px(-(prod.offsetTop + h * .92 + 12)) + ') rotate(' + (18 * side) + 'deg) scale(.9,.9)' },
          { transform: 'translateY(0px) rotate(0deg) scale(1,1)' }
        ], { duration: fall, delay: delay, easing: E_IN, fill: 'backwards' });
        var sh = shadow(info.shot, delay, fall, 640);
        if (!a) { impact(info, side, h, sh); return; }
        info.anims = [a];
        a.finished.then(function () { if (!dead) impact(info, side, h, sh); }, noop);
      }
      /* impact: the copy (if any) gives way to the real image, which squashes and springs back */
      function impact(info, side, h, sh) {
        var box = info.el, prod = info.prod;
        box.classList.remove('sx-hold');
        if (info.clone) { info.clone.remove(); info.clone = null; flying--; releaseLayer(); }
        var sq = landing(box, prod, [
          { transform: 'translateY(0px) scale(1,1)', easing: IMPACT },
          { transform: 'translateY(' + px((1 - .86) * .35 * h) + ') scale(1.08,.86)', offset: .12, easing: BOUNCE },
          { transform: 'translateY(0px) scale(1,1)' }
        ], { duration: Math.round(D_BOUNCE / .88) });
        follow(info, [sq, wobble(box, side), sh]);
      }
      /* the box rocks on its bottom edge, away from where the bread came from (rotate + translate
         properties: they stack on the box's own tilt and hover transform) */
      function wobble(box, side) {
        var hh = box.offsetHeight / 2, deg = 1.5 * side;
        function k(f) { var a = deg * f; return { translate: px(a * Math.PI / 180 * hh) + ' ' + px(f === 1 ? 3 : 0), rotate: a.toFixed(3) + 'deg' }; }
        return play(box, [
          { translate: '0px 0px', rotate: '0deg', easing: IMPACT },
          Object.assign(k(1), { offset: .16, easing: E_INOUT }),
          Object.assign(k(-.5), { offset: .42, easing: E_INOUT }),
          Object.assign(k(.2), { offset: .68, easing: E_INOUT }),
          { translate: '0px 0px', rotate: '0deg' }
        ], { duration: 680 });
      }

      /* dairy, rugelach, sufganiyot: dropped in from above the box and plopped down softly (the box
         itself stays still: only the peak's boxes rock, and a still box needs no layer of its own) */
      function drop(list) {
        list.forEach(function (info, n) {
          var box = info.el, prod = info.prod;
          var top = prod.offsetTop, h = prod.offsetHeight;
          var delay = n * 3 * STAG, fall = 420, squashT = 80, settleT = Math.round(D_BOUNCE * 1.15);
          var T = fall + squashT + settleT, f1 = fall / T, f2 = (fall + squashT) / T;
          var rd = [5, -6, 4][n % 3];
          info.started = true;
          box.classList.remove('sx-hold');
          follow(info, [
            landing(box, prod, [
              { transform: 'translateY(' + px(-(top + h + 16)) + ') rotate(' + rd + 'deg) scale(1,1)', easing: E_IN },
              { transform: 'translateY(0px) rotate(0deg) scale(1,1)', offset: f1, easing: IMPACT },
              { transform: 'translateY(' + px((1 - .84) * .35 * h) + ') rotate(0deg) scale(1.1,.84)', offset: f2, easing: SETTLE },
              { transform: 'translateY(0px) rotate(0deg) scale(1,1)' }
            ], { duration: T, delay: delay, fill: 'backwards' }),
            shadow(info.shot, delay, fall, T - fall)
          ]);
        });
      }

      /* ===== triggering ===== */

      var HANDLERS = { head: head, print: print, lines: lines, unroll: unroll, swing: swing, fade: fade };
      var GAP = { head: 0, print: 0, lines: 0, unroll: 0, fade: 2 * STAG, swing: 3 * STAG };
      function start(kind, list) {
        list.sort(function (a, b) { return a.order - b.order; });
        var early = performance.now() - t0 < 260;   // already on screen at load: no entrance
        if (kind === 'leap') { leap(list); return; }
        if (kind === 'drop') { drop(list); return; }
        if (early) { list.forEach(instant); return; }
        if (kind === 'deal') { deal(list); return; }
        list.forEach(function (info, n) {
          info.started = true;
          (HANDLERS[kind] || fade)(info, n * (GAP[kind] || 0));
        });
      }

      /* the frames get their size right after init (shell.js fitFrame), so the trigger margins,
         which keep the sticky header and the mobile bar out of "in view", are measured a moment later */
      var trig = null;
      function onTrigger(entries) {
        if (dead) return;
        var batch = {};
        entries.forEach(function (en) {
          var info = meta.get(en.target);
          if (!info || info.started || !en.isIntersecting) return;
          var rb = en.rootBounds;
          if (en.intersectionRatio < info.need && !(rb && en.intersectionRect.height >= rb.height * .4)) return;
          (batch[info.kind] = batch[info.kind] || []).push(info);
        });
        Object.keys(batch).forEach(function (kind) {
          var list = batch[kind];
          try { start(kind, list); } catch (err) {
            list.forEach(function (info) { info.started = true; done(info.el); });
            console.warn('[b-scroll] an entrance failed and was skipped:', err);
          }
        });
        meta.forEach(function (info, target) { if (info.started) { trig.unobserve(target); meta.delete(target); } });
      }
      Promise.resolve().then(function () {
        if (dead) return;
        var g = geo(), h = g.h || 1;
        trig = observe(onTrigger, {
          root: scroller,
          rootMargin: '-' + clamp(g.visTop / h * 100, 0, 40).toFixed(2) + '% 0px -' + clamp((g.h - g.visBot) / h * 100 + 2, 0, 40).toFixed(2) + '% 0px',
          threshold: [0, .25, .3, .35, .5, .6, .75, 1]
        });
        meta.forEach(function (info, target) { trig.observe(target); });

        /* safety net: an entrance that never got its turn (the visitor jumped past it with a nav link,
           or stopped just short of the trigger) must not leave content hidden. A jump can carry an element
           from below the view to above it without ever intersecting, which an observer does not report, so
           after scrolling settles (at most every 200ms, only while something is still waiting) any waiting
           element that is entirely above the visible area is shown at once, without animation. */
        var sweepT = 0;
        function sweep() {
          sweepT = 0;
          if (dead || !meta.size) return;
          var top = scroller.getBoundingClientRect().top;
          meta.forEach(function (info, target) {
            if (info.started || target.getBoundingClientRect().bottom > top) return;
            info.started = true;
            done(info.el);
            if (trig) trig.unobserve(target);
            meta.delete(target);
          });
        }
        on(scroller, 'scroll', function () { if (!sweepT && meta.size) sweepT = setTimeout(sweep, 200); }, { passive: true });
        offs.push(function () { if (sweepT) clearTimeout(sweepT); });
      });

      /* keyboard focus never lands on faded content: finish that entrance at once */
      on(root, 'focusin', function (e) {
        var el = e.target && e.target.closest && e.target.closest('[data-rv]');
        if (!el || el.classList.contains('rv-done') || el.classList.contains('box')) return;
        var info = byEl.get(el);
        if (!info) return;
        if (!info.started) {
          info.started = true;
          meta.forEach(function (v, target) { if (v === info) { if (trig) trig.unobserve(target); meta.delete(target); } });
        }
        instant(info);
      });

      /* ===== the ticker: a CSS loop; scroll speed surges it, a hovering pointer brakes it ===== */

      var mountOn = true, tickerOn = false;
      var tick = null;
      if (track) {
        var tickAnim = null;
        try {
          tickAnim = track.getAnimations().filter(function (a) { return a.animationName === 'b-scroll-tick'; })[0] || null;
        } catch (e) { tickAnim = null; }
        if (tickAnim) {
          tick = { anim: tickAnim, hover: false, boost: 0, smooth: 0, brake: 1, applied: 1 };
          ticker.classList.add('sx-tk');
          var fine = window.matchMedia ? window.matchMedia('(hover: hover) and (pointer: fine)') : { matches: false };
          on(ticker, 'pointerenter', function (e) { if (e.pointerType === 'mouse' && fine.matches) { tick.hover = true; wake(); } });
          on(ticker, 'pointerleave', function () { if (tick.hover) { tick.hover = false; wake(); } });
          observe(function (entries) {
            tickerOn = entries[entries.length - 1].isIntersecting;
            syncTicker();
          }, { root: scroller }).observe(ticker);
        }
      }
      function syncTicker() { if (ticker) ticker.classList.toggle('sx-off', !(tickerOn && mountOn)); }
      function setRate(r) {
        tick.applied = r;
        try { if (tick.anim.updatePlaybackRate) tick.anim.updatePlaybackRate(r); else tick.anim.playbackRate = r; } catch (e) { /* gone */ }
      }
      function tickerStep(dt) {
        var target = tick.hover ? 0 : 1;
        tick.brake += (target - tick.brake) * (1 - Math.exp(-dt / (tick.hover ? 120 : 200)));
        tick.smooth += (tick.boost - tick.smooth) * (1 - Math.exp(-dt / 80));
        tick.boost *= Math.exp(-dt / 340);
        var rate = tick.brake * (1 + tick.smooth);
        var busy = Math.abs(tick.brake - target) > .004 || tick.boost > .01 || tick.smooth > .01;
        if (!busy) { tick.brake = target; tick.boost = tick.smooth = 0; if (tick.applied !== target) setRate(target); return false; }
        if (Math.abs(rate - tick.applied) > .015) setRate(rate);
        return true;
      }

      /* ===== product drift without scroll timelines: one cached measure, then scrollTop only ===== */

      var pf = timelines ? null : { items: [], vh: 0 };
      function pfMeasure() {
        if (!pf) return;
        var vr = scroller.getBoundingClientRect(), k = (vr.height / (scroller.offsetHeight || 1)) || 1, st = scroller.scrollTop;
        pf.vh = scroller.clientHeight;
        pf.items.forEach(function (it) {
          var r = it.box.getBoundingClientRect();
          it.top = (r.top - vr.top) / k + st;
          it.h = r.height / k;
        });
      }
      function pfSync() {
        if (!pf) return;
        var st = scroller.scrollTop;
        pf.items.forEach(function (it) {
          if (!it.vis && !it.info.clone) return;
          var p = clamp((st + pf.vh - it.top) / (pf.vh + it.h), 0, 1);
          var y = px(7 - 14 * p);
          var clone = it.info.clone;
          if (clone && clone.style.getPropertyValue('--sx-par') !== y) clone.style.setProperty('--sx-par', y);
          if (y === it.last) return;
          it.last = y;
          it.shot.style.setProperty('--sx-par', y);
        });
      }
      if (pf) {
        root.classList.add('sx-pf');
        boxes.forEach(function (box) {
          var prod = box.querySelector('.prod');
          if (prod && meta.get(prod)) pf.items.push({ box: box, shot: prod.parentElement, info: meta.get(prod), vis: false, last: '' });
        });
        pfMeasure();
        var pfIO = observe(function (entries) {
          entries.forEach(function (en) { pf.items.forEach(function (it) { if (it.box === en.target) it.vis = en.isIntersecting; }); });
          pfSync();
        }, { root: scroller });
        pf.items.forEach(function (it) { pfIO.observe(it.box); });
        if (window.ResizeObserver) {
          var ro = new ResizeObserver(function () { pfMeasure(); pfSync(); });
          ro.observe(scroller);
          ro.observe(root);
          observers.push(ro);
        }
      }

      /* ===== one rAF loop for the module, asleep unless something is easing ===== */

      function wake() {
        if (raf || dead) return;
        lastFrame = performance.now();
        raf = requestAnimationFrame(frame);
      }
      function frame(t) {
        raf = 0;
        if (dead) return;
        var dt = Math.min(Math.max(t - lastFrame, 1), 64);
        lastFrame = t;
        var more = false;
        if (tick) more = tickerStep(dt) || more;
        if (pf) pfSync();
        if (more) raf = requestAnimationFrame(frame);
      }
      /* the surge follows scroll speed without reading layout in the scroll handler: the position
         comes from a ScrollTimeline, which the browser samples once per frame (reading it forces
         nothing), times the scroll range, which is cached and refreshed only when sizes change.
         Each pixel of travel adds a little speed, which the loop lets ebb away. */
      if (tick) {
        var tl = null, range = 0, lastPos = null;
        try { tl = window.ScrollTimeline ? new ScrollTimeline({ source: scroller, axis: 'block' }) : null; } catch (e) { tl = null; }
        var measureRange = function () { range = Math.max(0, scroller.scrollHeight - scroller.clientHeight); };
        Promise.resolve().then(function () { if (!dead) measureRange(); });
        if (window.ResizeObserver) {
          var rangeRO = new ResizeObserver(function () { measureRange(); });
          rangeRO.observe(root);
          rangeRO.observe(scroller);
          observers.push(rangeRO);
        }
        var position = function () {
          if (!tl) return scroller.scrollTop;   // no scroll timelines: the plain read
          var t = tl.currentTime;
          return t && typeof t.value === 'number' ? t.value / 100 * range : null;
        };
        on(scroller, 'scroll', function () {
          var pos = position();
          if (pos === null) return;
          var dist = lastPos === null ? 0 : Math.abs(pos - lastPos);
          lastPos = pos;
          if (!tickerOn || !mountOn || tick.hover || !dist || dist > 2000) return;
          tick.boost = Math.min(tick.boost + dist * .008, 4.5);
          wake();
        }, { passive: true });
      }
      if (pf) on(scroller, 'scroll', wake, { passive: true });

      /* the product images are decoded before they are needed: once the boxes are within a screen,
         lazy ones are switched to eager and decoded off the main thread, so a leap or drop never
         starts with a decode */
      var grid = q('.box-grid');
      if (grid) {
        var warm = observe(function (entries) {
          if (!entries[entries.length - 1].isIntersecting) return;
          warm.disconnect();
          boxes.forEach(function (box) {
            var img = box.querySelector('.prod');
            if (!img) return;
            if (img.loading === 'lazy') img.loading = 'eager';
            if (img.decode) img.decode().catch(noop);
          });
        }, { root: scroller, rootMargin: '100% 0px 100% 0px' });
        warm.observe(grid);
      }

      /* product drift only on boxes within 15% of the view (CSS .sx-dr; none on phones, see the CSS) */
      if (timelines && boxes.length) {
        var drIO = observe(function (entries) {
          entries.forEach(function (en) { en.target.classList.toggle('sx-dr', en.isIntersecting); });
        }, { root: scroller, rootMargin: '15% 0px 15% 0px' });
        boxes.forEach(function (box) { drIO.observe(box); });
      }

      /* the whole mount off screen (frame scrolled away on the page): let the loop idle */
      observe(function (entries) {
        mountOn = entries[entries.length - 1].isIntersecting;
        syncTicker();
      }, { threshold: 0 }).observe(scroller);

      /* start: products wait in their boxes, entrances wait for their turn */
      boxes.forEach(function (box) { if (box.querySelector('.prod')) box.classList.add('sx-hold'); });
      root.classList.add('sx');

      return function cleanup() {
        dead = true;
        offs.forEach(function (off) { off(); });
        observers.forEach(function (o) { o.disconnect(); });
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        live.forEach(function (a) { try { a.cancel(); } catch (e) { /* gone */ } });
        live.clear();
        if (tick) setRate(1);
        if (layer) layer.remove();
        layer = null;
        root.classList.remove('sx', 'sx-pf');
        boxes.forEach(function (box) { box.classList.remove('sx-hold', 'sx-dr'); });
        qa('.sx-go').forEach(function (el) { el.classList.remove('sx-go'); });
        qa('.sx-slot').forEach(function (el) { el.classList.remove('sx-slot'); });
        polas.forEach(function (el) { el.style.zIndex = ''; });
        qa('.shot').forEach(function (el) { el.style.removeProperty('--sx-par'); });
        if (ticker) ticker.classList.remove('sx-tk', 'sx-off');
      };
    }
  });
})();
