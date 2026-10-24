/* ==========================================================================
   Direction B · השקית — motion module: scroll (the peak, entrances, the map, ticker, drift)
   Pairs with b-motion-scroll.css (its header lists the devices and every class this file adds).
   Version 3, 24.10.2026: rebuilt for the v3 page (boxes without lids, the "אנחנו כאן." map,
   the pinned feed board / phone rail) and for page contract 2.

   THE PEAK  the bread jumps out of the bag into the boxes. When a product's window is in view,
   copies of the frena, challah and baguette leave the hero bag (.sc-bag) where it sits on screen
   right now and fly an arc into their windows; at impact the copy gives way to the real image,
   which squashes and springs back (--spring-bounce) while its box rocks once. The Friday box gets
   two loaves (the lower slot fills first). If the bag is far away (the visitor jumped down), no copy
   crosses the page: the real image drops in from just above its box, spinning, with the same
   bounce. The dairy, parve and sufganiyot products fall in from above and plop (--spring-settle).
   The boxes themselves, their names and lists are never hidden: only the product images wait.

   THE MAP  ("אנחנו כאן.", the page's peak of pride) the dotted route Ofakim > Netivot > Sderot >
   Kiryat Gat draws itself as the visitor scrolls (stroke-dashoffset on a mask over the dotted
   path, so the dots stay dots). The scroll only ever adds to it, and a short catch-up keeps the line
   smooth between wheel steps. The range is measured so the line starts when Ofakim is on screen
   and ends while Kiryat Gat still is. Each stop stamps its logo pin when the line reaches it and
   its oven lights up (the pin's glow); on wide maps its label swings in on its nail right after.
   When the route is complete the production house is stamped, its bread leaves the map northward
   (the dashed arrow draws) and "לסופרים בכל הארץ" arrives last, with its label. On narrow maps the
   labels are a list under the map and enter as they scroll in. Pause with part of the map in view
   and the rest plays by itself; jump past it and it is complete.

   CONTRACT 2 (site-plan/plan.md 6.2; shell.js passes contract 1 today, runtime.js passes 2)
     init(root, ctx) runs for every mounted copy, after PROTO.init (b.js) and before Shell.reveal.
     ctx = { scroller, reduced, frame, [contract, page, ioRoot, scrollEvents, vtHost, view()] }
       scroller      scroll position, sizes, ScrollTimeline source, ResizeObserver
       ioRoot        IntersectionObserver root (the frame's .vp; on a page null = the viewport)
       scrollEvents  where 'scroll' fires (the .vp; on a page window)
       view()        { top, left, width, height, scale } of the visible scroll area in client px
     Each key falls back to the prototype frame when the shell does not pass it. On a page the
     flying copies go into <body> (root is <html>) and a window resize re-measures (the viewport
     height changes without <html> changing size).
     Inside a prototype: no position: fixed, no window scroll. Under reduced motion it does nothing.
     The returned cleanup removes every listener, observer, timer, rAF, animation, injected node and
     sx- class. .rv-done stays as a record (harmless without .sx), so a reboot on a page does not
     replay entrances that already finished.

   SMOOTHNESS
     transform / individual transform properties / opacity / clip-path first, composite 'replace'
     (the compositor plays them alone). Layout is read only in IntersectionObserver callbacks, in
     ResizeObserver callbacks and in timers after scrolling settles, never in the scroll handler,
     which takes the position from a ScrollTimeline (sampled once per frame) and cached sizes.
     One rAF loop (ticker easing, the route's catch-up, drift without scroll timelines) that sleeps
     when nothing moves; the ticker pauses off screen.

   NO CONTENT STAYS HIDDEN (the safety net)
     - already on screen at load (even partly): shown at once, no entrance
     - jumped past (a nav link, End): after scrolling settles, anything waiting entirely above the
       visible area is shown at once (and once shortly after start, for a page that loads scrolled)
     - stopped short of a trigger: when scrolling has rested 0.5 s, anything waiting that is partly
       in view gets its entrance (and the map plays the rest of its sequence)
     - keyboard focus inside waiting content finishes that entrance at once
     Hooks: see "hooks motion modules may rely on" at the top of b.css.
   ========================================================================== */
(function () {
  'use strict';

  var UID = 0;            // unique mask ids: several mounts share one document
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var SURGE_MAX = 1.5;    // the ticker never runs faster than 1.5x its own speed (plan 2.7, A11Y-19)
  var DWELL = 500;        // ms of resting scroll before waiting content in view plays by itself

  /* where each leaping bread sits in the bag photo (fractions of .sc-bag), how it is turned there,
     and its width there as a fraction of the bag's width; matched by the product image's file name */
  var BAG_SPOTS = {
    frena: { x: .49, y: .24, r: -10, f: .8 },
    challah: { x: .83, y: .22, r: 22, f: .55 },
    baguette: { x: .11, y: .18, r: -74, f: .62 }
  };
  var LEAPER = /(frena|challah|baguette)/;

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
  function cancel(a) { if (a) { try { a.cancel(); } catch (e) { /* gone */ } } }

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
    contract: 2,
    init: function (root, ctx) {
      var scroller = ctx && ctx.scroller;
      /* ---- page contract 2: each key falls back to the prototype frame (shell.js contract 1) ---- */
      var ioRoot = ctx && 'ioRoot' in ctx ? ctx.ioRoot : scroller;
      var scrollEvents = (ctx && ctx.scrollEvents) || scroller;
      var page = !!(ctx && ctx.page);
      var view = ctx && typeof ctx.view === 'function' ? ctx.view : function () {
        var r = scroller.getBoundingClientRect();
        return { top: r.top, left: r.left, width: r.width, height: r.height,
          scale: (r.height / (scroller.offsetHeight || r.height || 1)) || 1 };
      };
      var motion = !(ctx && ctx.reduced) && root.classList.contains('anim') && !root.classList.contains('rm');
      if (!motion || !scroller || !('IntersectionObserver' in window) || typeof root.animate !== 'function') return noop;

      var dead = false;
      var t0 = performance.now();
      var offs = [];             // listener removers
      var observers = [];
      var live = new Set();      // every Animation this module started
      var timers = new Set();
      var raf = 0, lastFrame = 0;

      function on(el, type, fn, opts) {
        el.addEventListener(type, fn, opts);
        offs.push(function () { el.removeEventListener(type, fn, opts); });
      }
      function later(fn, ms) {
        var id = setTimeout(function () { timers.delete(id); if (!dead) fn(); }, ms);
        timers.add(id);
        return id;
      }
      function unlater(id) { if (id) { clearTimeout(id); timers.delete(id); } }
      function observe(cb, opts) { var o = new IntersectionObserver(cb, opts); observers.push(o); return o; }
      function play(el, frames, opts) {
        var a;
        if (!el) return null;
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
      function qa(sel, from) { return Array.prototype.slice.call((from || root).querySelectorAll(sel)); }

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
      var tkView = ticker && ticker.querySelector('.tk-view');
      var tkLists = track ? qa('.tk-list', track) : [];
      var boxes = qa('.box-grid .box');
      var polas = qa('.pola[data-rv]');
      var timelines = !!(window.CSS && CSS.supports && CSS.supports('animation-timeline: view()') && CSS.supports('timeline-scope: --sx'));

      /* the part of the scroller not covered by the sticky header (top) or the mobile bar (bottom),
         in the prototype's own pixels; k converts screen pixels of a scaled frame back to them.
         A bar that stopped sticking (short screens, b.css section 7) covers nothing. */
      function stuck(el) { return !!el && el.offsetParent !== null && getComputedStyle(el).position === 'sticky'; }
      function geo() {
        var vr = view(), k = vr.scale || 1, h = scroller.clientHeight;
        var top = stuck(hd) ? hd.offsetHeight : 0;
        var bottom = stuck(bar) ? bar.offsetHeight : 0;
        return { vr: vr, k: k, h: h, visTop: top, visBot: h - bottom, effH: Math.max(1, h - bottom - top) };
      }
      /* an element's top in content coordinates (scrollTop space) */
      function contentY(r, g) { return (r.top - g.vr.top) / g.k + scroller.scrollTop; }

      /* ===== entrance bookkeeping ===== */

      var meta = new Map();     // observed element -> info (only while waiting)
      var byEl = new Map();     // [data-rv] element (or product image) -> info
      var boxLeft = new Map();  // box -> products still waiting
      var order = 0, nth = {};
      var trig = null;
      function addInfo(target, info) {
        info.order = order++;
        info.nth = nth[info.kind] = (nth[info.kind] === undefined ? 0 : nth[info.kind] + 1);
        info.target = target;
        info.started = false;
        info.vis = false;
        info.anims = [];
        meta.set(target, info);
        byEl.set(info.prod || info.el, info);
      }
      function unwatch(info) {
        if (trig) trig.unobserve(info.target);
        meta.delete(info.target);
      }

      qa('[data-rv]').forEach(function (el) {
        if (el.classList.contains('box') || el.classList.contains('rv-done')) return;   // boxes enter through their products
        var c = el.classList, kind = 'fade', need = .3;
        if (c.contains('here-copy')) { kind = 'lines'; need = .3; }
        else if (c.contains('sec-head')) { kind = 'head'; need = .5; }
        else if (c.contains('slip')) { kind = 'print'; need = .3; }
        else if (c.contains('pola')) { kind = 'deal'; need = .25; }
        else if (c.contains('place')) { kind = 'hang'; need = .35; }
        /* the waiting slip is clipped away, and an observer never sees a fully clipped target:
           watch its wrapper, which has the same box */
        addInfo(kind === 'print' && el.parentElement ? el.parentElement : el, { el: el, kind: kind, need: need });
      });
      boxes.forEach(function (box, bi) {
        if (box.classList.contains('rv-done')) return;
        qa('.prod', box).forEach(function (prod) {
          var name = LEAPER.exec(prod.getAttribute('src') || prod.currentSrc || '');
          boxLeft.set(box, (boxLeft.get(box) || 0) + 1);
          addInfo(prod, {
            el: box, prod: prod, shot: prod.closest('.shot') || prod.parentElement, tl: bi + 1,
            spot: name ? BAG_SPOTS[name[1]] : null, kind: name ? 'leap' : 'drop', need: .6
          });
        });
      });

      function go(el) { el.classList.add('sx-go'); }
      function done(el) {
        if (el.classList.contains('rv-done')) return;
        el.classList.add('rv-done');
        el.classList.remove('sx-go');
        if (el.parentElement) el.parentElement.classList.remove('sx-slot');
      }
      function doneProd(info) {
        if (info.doneP) return;
        info.doneP = true;
        if (info.clone) { info.clone.remove(); info.clone = null; flying--; releaseLayer(); }
        info.prod.classList.remove('sx-hold');
        if (info.shot) info.shot.classList.remove('sx-hold');
        var left = (boxLeft.get(info.el) || 1) - 1;
        boxLeft.set(info.el, left);
        if (left <= 0) info.el.classList.add('rv-done');
      }
      /* the end of an entrance: its animations have played out (they end on the static state), so
         they are dropped, and the entrance rules stop matching */
      function finishInfo(info) {
        if (info.fin) return;
        info.fin = true;
        info.started = true;
        info.anims.forEach(cancel);
        info.anims = [];
        if (info.prod) doneProd(info); else done(info.el);
      }
      function follow(info, anims) {
        info.anims = info.anims.concat(anims.filter(Boolean));
        settled(info.anims.slice(), function () { finishInfo(info); });
      }
      /* no animation: content that was already on screen at load, jumped past, or reached by focus */
      function instant(info) {
        info.started = true;
        info.anims.forEach(function (a) { try { a.finish(); } catch (e) { /* gone */ } });
        finishInfo(info);
      }
      function finishNow(info) {
        if (!info.started) unwatch(info);
        instant(info);
      }

      /* ===== the entrance devices: one per section, never the same in two sections in a row ===== */

      /* products heading, feed heading: the label slides in from the start side, the title rises
         out of a mask at its own baseline, the rest follows */
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

      /* order receipt: printed top to bottom. A cover in the page colour over the receipt's wrapper
         (::after, it also hides the torn edges and the shadow) shrinks toward the bottom while the
         paper feeds down a little; then the status line is stamped on. Transforms only. */
      function print(info, delay) {
        var el = info.el, slot = el.parentElement, T = 1000;
        var stampEl = qa('.order-status', el).filter(function (p) { return p.offsetParent !== null; })[0];
        go(el);
        var a = [play(el, [{ translate: '0 -18px' }, { translate: '0 0' }], { duration: T, delay: delay, easing: E_OUT, fill: 'backwards' })];
        if (slot) {
          slot.classList.add('sx-slot');
          a.push(play(slot, [{ scale: '1 1' }, { scale: '1 0' }], { duration: T, delay: delay, easing: E_INOUT, fill: 'both', pseudoElement: '::after' }));
        }
        if (stampEl) {
          a.push(play(stampEl, [{ scale: 1.3, rotate: '-2.5deg' }, { scale: 1, rotate: '0deg' }], { duration: D_BOUNCE + 120, delay: delay + 820, easing: BOUNCE, fill: 'backwards' }));
          a.push(play(stampEl, [{ opacity: 0 }, { opacity: 1 }], { duration: 160, delay: delay + 820, easing: E_OUT, fill: 'backwards' }));
        }
        follow(info, a);
      }

      /* map copy: the heading rises, the quote (their own words, in handwriting) is written in from
         the start side, the story and the facts follow line by line */
      function lines(info, delay) {
        var el = info.el, a = [], i = 0;
        go(el);
        Array.prototype.forEach.call(el.children, function (kid) {
          var d = delay + i++ * 3 * STAG;
          if (kid.tagName === 'BLOCKQUOTE') {
            var words = kid.firstElementChild || kid, rtl = getComputedStyle(kid).direction === 'rtl';
            a.push(play(words, [
              { clipPath: rtl ? 'inset(-14% 0 -14% 100%)' : 'inset(-14% 100% -14% 0)' },
              { clipPath: 'inset(-14% 0 -14% 0)' }
            ], { duration: 900, delay: d, easing: E_INOUT, fill: 'backwards' }));
            Array.prototype.forEach.call(kid.children, function (part) {
              if (part !== words) a.push(play(part, [{ opacity: 0 }, { opacity: 1 }], { duration: 420, delay: d + 640, easing: E_OUT, fill: 'backwards' }));
            });
            i += 2;   // the writing takes a while: the lines after it wait a little longer
            return;
          }
          a.push(play(kid, [{ opacity: 0, translate: '0 18px' }, { opacity: 1, translate: '0 0' }],
            { duration: 680, delay: d, easing: E_OUT, fill: 'backwards' }));
        });
        follow(info, a);
      }

      /* place labels: tags swinging to rest on a nail above them (on the map with their pins, or
         as the list under a narrow map) */
      function hang(info, delay) {
        var el = info.el, a0 = (info.nth % 2 ? -1 : 1) * (mapS && mapS.overlay ? 7 : 10);
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

      /* feed: on the pinned board the polaroids are dealt from one stack below the middle, each new
         card landing on top of the ones already down (the board's own overlap order); on the phone
         rail the cards in sight slide in along the rail from its far end, and the ones beyond the
         rail's edge are simply ready for the swipe */
      function deal(list) {
        var g = geo();
        var pend = polas.map(function (el) { return byEl.get(el); }).filter(function (info) { return info && !info.started; });
        if (!pend.length) return;
        var rail = pend[0].el.parentElement;
        if (rail && rail.scrollWidth > rail.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(rail).overflowX)) {
          slide(pend, rail, g);
          return;
        }
        var rects = new Map();
        pend.forEach(function (info) { rects.set(info, info.el.getBoundingClientRect()); });
        /* rows: cards whose vertical centres lie within half a card of each other (the board's cards
           differ in size and tilt, so their tops do not line up) */
        var rows = [];
        pend.forEach(function (info) {
          var r = rects.get(info), cy = (r.top + r.height / 2) / g.k, hh = r.height / g.k / 2, row = null;
          for (var i = 0; i < rows.length; i++) if (Math.abs(rows[i].cy - cy) < Math.max(rows[i].hh, hh)) { row = rows[i]; break; }
          if (!row) { row = { cy: cy, hh: hh, items: [] }; rows.push(row); }
          row.items.push(info);
        });
        rows.forEach(function (row) {
          var hit = row.items.some(function (info) { return list.indexOf(info) !== -1; });
          if (!hit) return;
          row.items.forEach(function (info) { info.started = true; unwatch(info); go(info.el); });
          if (row.items.length < 2) { toss(row.items[0]); return; }
          var cs = row.items.map(function (info) {
            var r = rects.get(info);
            return { x: (r.left + r.width / 2) / g.k, y: (r.top + r.height / 2) / g.k };
          });
          var ox = cs.reduce(function (s, c) { return s + c.x; }, 0) / cs.length;
          var oy = cs.reduce(function (s, c) { return s + c.y; }, 0) / cs.length + 34;
          var tIn = 320, gap = 3 * STAG, dealT = 700, n = row.items.length;
          row.items.forEach(function (info, i) {
            var c = cs[i], dx = ox - c.x, dy = oy - c.y, rot = [-7, 5, -2.5, 4][i % 4];
            var start = tIn + i * gap, T = start + dealT, at = start / T;
            /* in the stack the first card is on top; once moving, a card rides above the stack and
               the cards already down, so the board ends in its own order and nothing pops */
            var zStack = String(n - i + 1), zMove = String(6 + i);
            follow(info, [
              play(info.el, [
                Object.assign(ip(dx, dy + 48, rot, .92), { offset: 0, easing: E_OUT }),
                Object.assign(ip(dx, dy, rot, .94), { offset: tIn / T, easing: 'linear' }),
                Object.assign(ip(dx, dy, rot, .94), { offset: at, easing: SETTLE }),
                Object.assign(ip(0, 0, 0, 1), { offset: 1 })
              ], { duration: T, fill: 'backwards' }),
              play(info.el, [{ opacity: 0 }, { opacity: 1 }], { duration: tIn, easing: E_OUT, fill: 'backwards' }),
              play(info.el, [
                { zIndex: zStack, offset: 0 }, { zIndex: zStack, offset: at },
                { zIndex: zMove, offset: Math.min(1, at + .001) }, { zIndex: zMove, offset: 1 }
              ], { duration: T, fill: 'backwards' })
            ]);
          });
        });
      }
      function slide(pend, rail, g) {
        var rr = rail.getBoundingClientRect(), end = getComputedStyle(rail).direction === 'rtl' ? -1 : 1, n = 0;
        pend.forEach(function (info) {
          info.started = true;
          unwatch(info);
          var r = info.el.getBoundingClientRect();
          if (r.right <= rr.left + 2 || r.left >= rr.right - 2) { finishInfo(info); return; }   // beyond the rail's edge
          go(info.el);
          var w = r.width / g.k, d = n++ * 4 * STAG;
          follow(info, [
            play(info.el, [ip(end * w * .55, 14, -end * 6, .96), ip(0, 0, 0, 1)],
              { duration: 820, delay: d, easing: SETTLE, fill: 'backwards' }),
            play(info.el, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: d, easing: E_OUT, fill: 'backwards' })
          ]);
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
          /* on a page root is <html>: the copies stay inside <body> */
          (root.tagName === 'HTML' ? document.body : root).appendChild(layer);
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
      /* the window's contact shadow grows from nothing while the first product approaches, spreads
         at impact and settles (transform only: the micro module may own its scale and opacity).
         One shadow per window, so the Friday box's second loaf does not restart it. */
      var shadowed = new Set();
      function shotShadow(info, delay, approach, after) {
        var shot = info.shot;
        if (!shot || shadowed.has(shot)) return null;
        shadowed.add(shot);
        var T = approach + after;
        var a = play(shot, [
          { transform: 'scale(0)' },
          { transform: 'scale(.55)', offset: approach * .6 / T },
          { transform: 'scale(1)', offset: approach / T, easing: IMPACT },
          { transform: 'scale(1.16,1.05)', offset: (approach + 90) / T, easing: SETTLE },
          { transform: 'scale(1)' }
        ], { duration: T, delay: delay, fill: 'backwards', pseudoElement: '::after' });
        shot.classList.remove('sx-hold');   // the animation holds it at scale(0) until it starts
        return a;
      }

      /* frena, challah, baguette: out of the bag and into their windows */
      function leap(list) {
        var g = geo(), L = ensureLayer(), lr = L.getBoundingClientRect();
        var br = bag ? bag.getBoundingClientRect() : null;
        var items = list.map(function (info) { return { info: info, r: info.prod.getBoundingClientRect() }; });
        /* the lower slot of a box fills first (the challah under the frena on wide screens) */
        items.sort(function (a, b) {
          if (a.info.el === b.info.el && Math.abs(a.r.top - b.r.top) > 20) return b.r.top - a.r.top;
          return a.info.order - b.info.order;
        });
        items.forEach(function (item, n) {
          var info = item.info, box = info.el, prod = info.prod, pr = item.r;
          var w = prod.offsetWidth, h = prod.offsetHeight;
          info.started = true;
          if (!w || !h || (!prod.currentSrc && !prod.src)) { finishInfo(info); return; }
          var ex = (pr.left + pr.width / 2 - lr.left) / g.k;
          var ey = (pr.top + pr.height / 2 - lr.top) / g.k - driftOf(prod);
          var th = tiltOf(box), side = n % 2 ? -1 : 1;
          var spot = info.spot || BAG_SPOTS.frena;
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
             image falls into its own window through the rim, spinning, and lands with the same bounce */
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
          var filter = getComputedStyle(prod).filter;   // the evening dim and the Friday drop shadow
          if (filter && filter !== 'none') img.style.filter = filter;
          if (timelines) { img.classList.add('sx-ride'); img.style.setProperty('--sx-tl', '--sxb' + info.tl); }
          info.clone = img;
          flying++;
          var launch = function () {
            if (dead || info.fin) return;
            L.appendChild(img);
            if (!timelines) pfSync();
            var flight = play(img, frames, { duration: T, delay: delay, easing: 'linear', fill: 'both' });
            var sh = shotShadow(info, delay, T, 640);
            info.anims = [flight, sh].filter(Boolean);
            if (!flight) { impact(info, side, h); return; }
            flight.finished.then(function () { if (!dead) impact(info, side, h); }, noop);
          };
          var ready = img.decode ? img.decode() : Promise.resolve();
          ready.then(launch, launch);
        });
        releaseLayer();   // nothing took off (all fell in from just above): no layer left behind
      }
      function fallIn(info, side, delay, h) {
        var prod = info.prod, fall = 460;
        prod.classList.remove('sx-hold');
        var a = play(prod, [
          { transform: 'translateY(' + px(-(prod.offsetTop + h * .92 + 12)) + ') rotate(' + (18 * side) + 'deg) scale(.9,.9)' },
          { transform: 'translateY(0px) rotate(0deg) scale(1,1)' }
        ], { duration: fall, delay: delay, easing: E_IN, fill: 'backwards' });
        var sh = shotShadow(info, delay, fall, 640);
        info.anims = [a, sh].filter(Boolean);
        if (!a) { impact(info, side, h); return; }
        a.finished.then(function () { if (!dead) impact(info, side, h); }, noop);
      }
      /* impact: the copy (if any) gives way to the real image, which squashes and springs back */
      var rocked = new Set();
      function impact(info, side, h) {
        if (info.fin) return;
        var box = info.el, prod = info.prod;
        prod.classList.remove('sx-hold');
        if (info.clone) { info.clone.remove(); info.clone = null; flying--; releaseLayer(); }
        var sq = play(prod, [
          { transform: 'translateY(0px) scale(1,1)', easing: IMPACT },
          { transform: 'translateY(' + px((1 - .86) * .35 * h) + ') scale(1.08,.86)', offset: .12, easing: BOUNCE },
          { transform: 'translateY(0px) scale(1,1)' }
        ], { duration: Math.round(D_BOUNCE / .88) });
        /* a box rocks once, even when two loaves land in it */
        var wob = rocked.has(box) ? null : wobble(box, side);
        rocked.add(box);
        follow(info, [sq, wob]);
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

      /* dairy, parve, sufganiyot: dropped in from above the window and plopped down softly (the box
         itself stays still: only the peak's boxes rock) */
      function drop(list) {
        list.forEach(function (info, n) {
          var prod = info.prod;
          var top = prod.offsetTop, h = prod.offsetHeight;
          var delay = n * 3 * STAG, fall = 420, squashT = 80, settleT = Math.round(D_BOUNCE * 1.15);
          var T = fall + squashT + settleT, f1 = fall / T, f2 = (fall + squashT) / T;
          var rd = [5, -6, 4][n % 3];
          info.started = true;
          prod.classList.remove('sx-hold');
          follow(info, [
            play(prod, [
              { transform: 'translateY(' + px(-(top + h + 16)) + ') rotate(' + rd + 'deg) scale(1,1)', easing: E_IN },
              { transform: 'translateY(0px) rotate(0deg) scale(1,1)', offset: f1, easing: IMPACT },
              { transform: 'translateY(' + px((1 - .84) * .35 * h) + ') rotate(0deg) scale(1.1,.84)', offset: f2, easing: SETTLE },
              { transform: 'translateY(0px) rotate(0deg) scale(1,1)' }
            ], { duration: T, delay: delay, fill: 'backwards' }),
            shotShadow(info, delay, fall, T - fall)
          ]);
        });
      }

      /* ===== the map: route drawn by scroll, ovens stamped and lit in route order ===== */

      var mapS = setupMap();
      function setupMap() {
        var here = q('.here'), art = here && here.querySelector('.map-art');
        var svg = art && art.querySelector('svg'), route = svg && svg.querySelector('.route');
        if (!route || art.classList.contains('rv-done') || typeof route.getTotalLength !== 'function') return null;
        var m = {
          here: here, art: art, svg: svg, route: route, places: here.querySelector('.places'),
          pins: qa('.pin', art), stops: [], tail: [], anims: [], masks: [],
          p: 0, goal: 0, last: -1, auto: false, done: false, vis: false, tailOn: false, geomOk: false,
          top: 0, h: 0, visTop: 0, s0: 0, s1: 1, y0: .7, y1: .075, overlay: false, mp: null
        };
        here.classList.add('sx-map');
        m.mp = addMask(m, route);
        return m;
      }
      /* the dotted path is revealed by a solid stroke in a mask, so the dots stay round dots while
         the line grows (the mask path keeps user units: vector-effect none) */
      function addMask(m, target) {
        var vb = m.svg.viewBox && m.svg.viewBox.baseVal, W = (vb && vb.width) || 800, H = (vb && vb.height) || 800;
        var id = 'sx-mask-' + (++UID);
        var mask = document.createElementNS(SVG_NS, 'mask');
        mask.setAttribute('id', id);
        mask.setAttribute('maskUnits', 'userSpaceOnUse');
        mask.setAttribute('x', '-40'); mask.setAttribute('y', '-40');
        mask.setAttribute('width', String(W + 80)); mask.setAttribute('height', String(H + 80));
        var p = document.createElementNS(SVG_NS, 'path');
        p.setAttribute('d', target.getAttribute('d'));
        p.setAttribute('pathLength', '1000');
        p.setAttribute('stroke', '#fff');
        p.setAttribute('stroke-width', '18');
        p.setAttribute('stroke-linecap', 'round');
        p.setAttribute('stroke-linejoin', 'round');
        p.setAttribute('stroke-dasharray', '1000 1000');
        p.setAttribute('stroke-dashoffset', '1001');
        p.style.vectorEffect = 'none';
        p.style.fill = 'none';
        mask.appendChild(p);
        m.svg.insertBefore(mask, m.svg.firstChild);
        target.setAttribute('mask', 'url(#' + id + ')');
        m.masks.push({ target: target, mask: mask });
        return p;
      }
      /* once, after the first layout: where the route runs (in map units) and where each pin sits on
         it. Pins on the route are stops, in route order; pins off it (the production house) come last */
      function mapGeometry(m) {
        m.geomOk = true;
        var vb = m.svg.viewBox && m.svg.viewBox.baseVal, W = (vb && vb.width) || 800, H = (vb && vb.height) || 800;
        var pts = [];
        try {
          var len = m.route.getTotalLength();
          for (var i = 0; i <= 200; i++) { var pt = m.route.getPointAtLength(len * i / 200); pts.push({ x: pt.x, y: pt.y }); }
        } catch (e) { pts = []; }
        if (pts.length) { m.y0 = pts[0].y / H; m.y1 = pts[pts.length - 1].y / H; }
        m.pins.forEach(function (pin) {
          var cs = getComputedStyle(pin);
          var x = parseFloat(cs.getPropertyValue('--x')) / 100 * W, y = parseFloat(cs.getPropertyValue('--y')) / 100 * H;
          var best = Infinity, f = 1;
          for (var j = 0; j < pts.length; j++) {
            var dd = (pts[j].x - x) * (pts[j].x - x) + (pts[j].y - y) * (pts[j].y - y);
            if (dd < best) { best = dd; f = j / (pts.length - 1); }
          }
          var place = pin.getAttribute('data-place') || '';
          var label = place ? m.here.querySelector('.place[data-place="' + place + '"]') : null;
          var stop = {
            pin: pin, f: f, on: false, label: label ? byEl.get(label) || null : null,
            past: pin.classList.contains('pin--past'), square: pin.classList.contains('pin--fac')
          };
          if (isFinite(best) && Math.sqrt(best) <= 24) m.stops.push(stop); else m.tail.push(stop);
        });
        m.stops.sort(function (a, b) { return a.f - b.f; });
      }
      /* sizes: the map's place in the content and the scroll range over which the line draws, from
         "Ofakim is on screen" to "Kiryat Gat still is" (a little wider when one screen cannot hold
         both, a little shorter on tall phones) */
      function measureMap() {
        var m = mapS;
        if (!m || m.done) return;
        if (!m.geomOk) mapGeometry(m);
        var g = geo(), r = m.art.getBoundingClientRect();
        m.top = contentY(r, g);
        m.h = r.height / g.k;
        m.visTop = g.visTop;
        /* the end keeps more room: the line trails the scroll a little, and the last oven should
           light below the header, not under it */
        var ys = m.top + m.y0 * m.h, ye = m.top + m.y1 * m.h, mg = g.effH * .05;
        var s0 = ys - g.visBot + mg, s1 = ye - g.visTop - Math.max(mg, g.effH * .14);
        var minR = Math.min(200, g.effH * .28), maxR = g.effH * .7;
        if (s1 - s0 < minR) { var mid = (s0 + s1) / 2; s0 = mid - minR / 2; s1 = mid + minR / 2; }
        else if (s1 - s0 > maxR) s1 = s0 + maxR;
        m.s0 = s0;
        m.s1 = s1;
        var was = m.overlay;
        m.overlay = !!m.places && getComputedStyle(m.places).position === 'absolute';
        /* the map just got wide enough for labels on it: the stops already lit bring theirs */
        if (m.overlay && !was) m.stops.concat(m.tailOn ? m.tail : []).forEach(function (s) { if (s.on) startLabel(s.label, 0); });
        mapScroll(scroller.scrollTop);
      }
      function mapHolds() { return !!(mapS && !mapS.done && mapS.overlay); }   // labels wait for their pins
      /* scroll handler part: cached numbers only */
      function mapScroll(s) {
        var m = mapS;
        if (!m || m.done || m.h < 1) return;
        if (s + m.visTop > m.top + m.h + 4) { finishMap(); return; }   // jumped past: the whole map is above the view
        var pt = clamp((s - m.s0) / Math.max(1, m.s1 - m.s0), 0, 1);
        if (pt > m.goal) { m.goal = pt; wake(); }
      }
      function drawRoute(p) {
        var v = Math.round(1001 * (1 - p) * 10) / 10;
        if (v === mapS.last) return;
        mapS.last = v;
        mapS.mp.style.strokeDashoffset = String(v);
      }
      /* the loop: the line chases the scroll (never back), at least 1/1900 of the route per ms so it
         always arrives, at most a full route in 0.6 s (1.1 s when it plays by itself) */
      function mapStep(dt) {
        var m = mapS;
        if (!m || m.done || !m.geomOk) return false;
        var goal = m.auto ? 1 : m.goal;
        if (m.p < goal) {
          var v = clamp((goal - m.p) / 120, 1 / 1900, m.auto ? 1 / 1100 : 1 / 600);
          m.p = Math.min(goal, m.p + v * dt);
          drawRoute(m.p);
        }
        for (var i = 0; i < m.stops.length; i++) {
          var s = m.stops[i];
          if (!s.on && m.p > 0 && s.f <= m.p + .002) stamp(s, 0);
        }
        /* the last oven lights first; the production house follows a beat later (and in a frame of
           its own, so the two never share one frame's work) */
        if (m.p >= 1 && !m.tailOn) { m.tailOn = true; later(tail, 260); }
        return m.p < goal;
      }
      /* a stop: the logo pin is pressed on like the bag's sticker, then its oven lights; Ofakim, the
         past, is a dotted ring that settles; the production house a square that is stamped */
      function stamp(s, delay, quiet) {
        var m = mapS, pin = s.pin;
        s.on = true;
        pin.classList.add('sx-on');
        if (s.past) {
          m.anims.push(play(pin, [{ transform: 'scale(1.9)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }],
            { duration: 700, delay: delay, easing: E_OUT, fill: 'backwards' }));
        } else {
          m.anims.push(play(pin, [{ transform: 'scale(1.7) rotate(-8deg)' }, { transform: 'scale(1) rotate(0deg)' }],
            { duration: D_BOUNCE + 100, delay: delay, easing: BOUNCE, fill: 'backwards' }));
          m.anims.push(play(pin, [{ opacity: 0 }, { opacity: 1 }], { duration: 160, delay: delay, easing: E_OUT, fill: 'backwards' }));
          if (!s.square) {
            m.anims.push(play(pin, [
              { opacity: 0, transform: 'scale(.35)' },
              { opacity: 1, transform: 'scale(1.08)', offset: .55 },
              { opacity: 1, transform: 'scale(1)' }
            ], { duration: 900, delay: delay + 180, easing: E_OUT, fill: 'backwards', pseudoElement: '::before' }));
          }
        }
        if (s.label && m.overlay && !quiet) startLabel(s.label, delay + 160);
      }
      function fadeIn(el, delay, dur) {
        if (!el) return;
        /* from transparent to the element's own opacity (the arrow is drawn at .7) */
        mapS.anims.push(play(el, [{ opacity: 0, offset: 0 }], { duration: dur, delay: delay, easing: E_OUT, fill: 'backwards' }));
      }
      /* after the route: the production house is stamped, its bread leaves the map northward and
         "לסופרים בכל הארץ" arrives last, with its label */
      function tail() {
        var m = mapS;
        if (!m || m.done) return;
        /* DOM writes first (the arrow's mask, the class that lets the lines show), then the animations */
        var out = m.svg.querySelector('.out'), mp = out ? addMask(m, out) : null;
        m.here.classList.add('sx-tail');
        m.tail.forEach(function (s, i) { stamp(s, i * 120, true); });   // their labels come last
        fadeIn(m.svg.querySelector('.fac-dot'), 60, 360);
        fadeIn(m.svg.querySelector('.fac-lead'), 120, 360);
        if (mp) m.anims.push(play(mp, [{ strokeDashoffset: '1001' }, { strokeDashoffset: '0' }], { duration: 1000, delay: 280, easing: E_INOUT, fill: 'backwards' }));
        fadeIn(m.svg.querySelector('.out-head'), 1180, 260);
        if (m.overlay) fadeIn(m.svg.querySelector('.leaders'), 320, 600);
        var outLabel = m.art.querySelector('.map-out');
        if (outLabel) m.anims.push(play(outLabel, [{ opacity: 0, translate: '0 8px' }, { opacity: 1, translate: '0 0' }],
          { duration: 520, delay: 1220, easing: E_OUT, fill: 'backwards' }));
        if (m.overlay) m.tail.forEach(function (s) { startLabel(s.label, 1300); });
        settled(m.anims.slice(), function () { if (!m.done) { m.done = true; restoreMap(); } });
      }
      function startLabel(info, delay) {
        if (!info || info.started) return;
        info.started = true;
        unwatch(info);
        hang(info, delay);
      }
      /* the map back to its static b.css self: masks, classes and animations gone */
      function restoreMap() {
        var m = mapS;
        m.anims.forEach(cancel);
        m.anims = [];
        m.masks.forEach(function (k) { k.target.removeAttribute('mask'); k.mask.remove(); });
        m.masks = [];
        m.here.classList.remove('sx-map', 'sx-tail');
        m.pins.forEach(function (pin) { pin.classList.remove('sx-on'); });
        m.art.classList.add('rv-done');
      }
      /* no animation: on screen at load, jumped past, or keyboard focus arrived in a label */
      function finishMap() {
        var m = mapS;
        if (!m || m.done) return;
        m.done = true;
        m.p = 1;
        if (m.overlay) m.stops.concat(m.tail).forEach(function (s) { if (s.label) finishNow(s.label); });
        restoreMap();
      }

      /* ===== triggering ===== */

      var HANDLERS = { head: head, print: print, lines: lines, hang: hang, fade: fade };
      var GAP = { head: 0, print: 0, lines: 0, fade: 2 * STAG, hang: 3 * STAG };
      function start(kind, list) {
        list.sort(function (a, b) { return a.order - b.order; });
        if (kind === 'leap') { leap(list); return; }
        if (kind === 'drop') { drop(list); return; }
        if (kind === 'deal') { deal(list); return; }
        list.forEach(function (info, n) {
          info.started = true;
          (HANDLERS[kind] || fade)(info, n * (GAP[kind] || 0));
        });
      }
      function runBatch(batch, early) {
        Object.keys(batch).forEach(function (kind) {
          var list = batch[kind];
          try {
            /* already on screen at load: no entrance (the peak still plays, from the bag in view) */
            if (early && kind !== 'leap' && kind !== 'drop') list.forEach(instant);
            else start(kind, list);
          } catch (err) {
            list.forEach(finishInfo);
            console.warn('[b-scroll] an entrance failed and was skipped:', err);
          }
        });
        meta.forEach(function (info) { if (info.started) unwatch(info); });
      }
      function onTrigger(entries) {
        if (dead) return;
        var early = performance.now() - t0 < 260, batch = {};
        entries.forEach(function (en) {
          var info = meta.get(en.target);
          if (!info || info.started) return;
          info.vis = en.isIntersecting && en.intersectionRatio > 0;
          if (!info.vis) return;
          if (info.kind === 'hang' && mapHolds()) return;   // labels on the map enter with their pins
          var rb = en.rootBounds;
          var enough = en.intersectionRatio >= info.need || (rb && en.intersectionRect.height >= rb.height * .4);
          if (!enough && !(early && !info.prod)) return;
          (batch[info.kind] = batch[info.kind] || []).push(info);
        });
        runBatch(batch, early);
      }

      /* the frames get their size right after init (shell.js fitFrame), so the trigger margins,
         which keep the sticky header and the mobile bar out of "in view", are measured a moment later */
      var sweepT = 0, dwellT = 0, mapIO = null;
      Promise.resolve().then(function () {
        if (dead) return;
        var g = geo(), h = g.h || 1;
        var margin = '-' + clamp(g.visTop / h * 100, 0, 40).toFixed(2) + '% 0px -' + clamp((g.h - g.visBot) / h * 100 + 2, 0, 40).toFixed(2) + '% 0px';
        trig = observe(onTrigger, { root: ioRoot, rootMargin: margin, threshold: [0, .25, .3, .35, .5, .6, .75, 1] });
        meta.forEach(function (info, target) { trig.observe(target); });
        if (mapS) {
          mapIO = observe(function (entries) {
            var en = entries[entries.length - 1];
            mapS.vis = en.isIntersecting && en.intersectionRatio > 0;
            if (mapS.vis && performance.now() - t0 < 260) finishMap();   // on screen at load
          }, { root: ioRoot, rootMargin: margin, threshold: [0] });
          mapIO.observe(mapS.art);
        }
        sweepT = later(sweep, 300);   // a page that loads scrolled down (restored position, #anchor)
        armDwell(900);
      });

      /* safety net 1: an entrance that never got its turn (the visitor jumped past it with a nav link)
         must not leave content hidden. A jump can carry an element from below the view to above it
         without ever intersecting, which an observer does not report, so after scrolling settles (at
         most every 200ms, only while something is still waiting) any waiting element that is
         entirely above the visible area is shown at once, without animation. */
      function sweep() {
        sweepT = 0;
        if (!meta.size && !(mapS && !mapS.done)) return;
        var g = geo(), top = g.vr.top + g.visTop * g.k;
        meta.forEach(function (info, target) {
          if (info.started || target.getBoundingClientRect().bottom > top) return;
          finishNow(info);
        });
        if (mapS && !mapS.done && mapS.art.getBoundingClientRect().bottom <= top) finishMap();
      }
      /* safety net 2: scrolling has rested and something waiting is partly in view (the visitor
         stopped just short of its trigger): it plays now, and the map plays the rest of its sequence */
      function armDwell(msDelay) {
        if (!meta.size && !(mapS && !mapS.done)) return;
        unlater(dwellT);
        dwellT = later(dwell, msDelay || DWELL);
      }
      function dwell() {
        dwellT = 0;
        var batch = {};
        meta.forEach(function (info) {
          if (info.started || !info.vis) return;
          if (info.kind === 'hang' && mapHolds()) return;
          (batch[info.kind] = batch[info.kind] || []).push(info);
        });
        runBatch(batch, false);
        if (mapS && !mapS.done && mapS.vis && mapS.p < 1) { mapS.auto = true; wake(); }
      }

      /* keyboard focus never lands on faded content: finish that entrance at once (focus in a map
         label finishes the whole map) */
      on(root, 'focusin', function (e) {
        var t = e.target;
        if (!t || !t.closest) return;
        if (mapS && !mapS.done && mapS.places && mapS.places.contains(t)) finishMap();
        var el = t.closest('[data-rv]');
        if (!el || el.classList.contains('rv-done') || el.classList.contains('box')) return;
        var info = byEl.get(el);
        if (info) finishNow(info);
      });

      /* ===== the ticker: a CSS loop; scroll speed surges it (at most 1.5x), a hovering pointer
         brakes it, and it pauses off screen ===== */

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
          }, { root: ioRoot }).observe(ticker);
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
        var rate = tick.brake * Math.min(1 + tick.smooth, SURGE_MAX);
        var busy = Math.abs(tick.brake - target) > .004 || tick.boost > .01 || tick.smooth > .01;
        if (!busy) { tick.brake = target; tick.boost = tick.smooth = 0; if (tick.applied !== target) setRate(target); return false; }
        if (Math.abs(rate - tick.applied) > .015) setRate(rate);
        return true;
      }
      /* two copies of the list are enough while one list is wider than the band (plan 2.7, perf):
         the other two leave layout and the track's layer halves. The loop keeps its speed (half the
         travel in half the time) and its place within one list, so the switch does not show. */
      function fitCopies() {
        if (!tick || tkLists.length < 4 || !tkView) return;
        var two = tkLists[0].offsetWidth >= tkView.clientWidth + 8;
        if (two === ticker.classList.contains('sx-tk2')) return;
        var a = tick.anim, c0 = two ? 4 : 2, c1 = two ? 2 : 4;
        try {
          var d0 = a.effect.getComputedTiming().duration, ct = a.currentTime || 0;
          var qn = ((ct % d0) + d0) % d0 / d0, phase = ((c0 / 2) * (1 - qn)) % 1;   // in list widths
          ticker.classList.toggle('sx-tk2', two);
          /* the effect's timing follows the class only after a style recalc: the computed
             duration forces it and is the value the loop will now run with */
          var dv = getComputedStyle(track).animationDuration.split(',')[0].trim();
          var d1 = parseFloat(dv) * (/ms$/.test(dv) ? 1 : 1000);
          if (!(d1 > 0)) d1 = d0 * c1 / c0;
          a.currentTime = (1 - phase / (c1 / 2)) * d1;
        } catch (e) { ticker.classList.toggle('sx-tk2', two); }
      }

      /* ===== product drift without scroll timelines: one cached measure, then scrollTop only ===== */

      var pf = timelines ? null : { items: [], vh: 0 };
      function pfMeasure() {
        if (!pf) return;
        var vr = view(), k = vr.scale || 1, st = scroller.scrollTop;
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
          var aloft = it.infos.filter(function (info) { return info.clone; });
          if (!it.vis && !aloft.length) return;
          var p = clamp((st + pf.vh - it.top) / (pf.vh + it.h), 0, 1);
          var y = px(7 - 14 * p);
          aloft.forEach(function (info) { if (info.clone.style.getPropertyValue('--sx-par') !== y) info.clone.style.setProperty('--sx-par', y); });
          if (y === it.last) return;
          it.last = y;
          it.shot.style.setProperty('--sx-par', y);
        });
      }
      if (pf) {
        root.classList.add('sx-pf');
        boxes.forEach(function (box) {
          var infos = qa('.prod', box).map(function (prod) { return byEl.get(prod); }).filter(Boolean);
          var shot = box.querySelector('.shot');
          if (infos.length && shot) pf.items.push({ box: box, shot: shot, infos: infos, vis: false, last: '' });
        });
        var pfIO = observe(function (entries) {
          entries.forEach(function (en) { pf.items.forEach(function (it) { if (it.box === en.target) it.vis = en.isIntersecting; }); });
          pfSync();
        }, { root: ioRoot });
        pf.items.forEach(function (it) { pfIO.observe(it.box); });
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
        if (mapS) more = mapStep(dt) || more;
        if (pf) pfSync();
        if (more) raf = requestAnimationFrame(frame);
      }

      /* ===== scroll: positions without layout reads ===== */
      /* The position comes from a ScrollTimeline, which the browser samples once per frame (reading
         it forces nothing), times the scroll range, which is cached and refreshed only when sizes
         change. The ticker surge: each pixel of travel adds a little speed, which the loop lets ebb
         away. The map: the route's goal. */
      var tl = null, range = 0, lastPos = null;
      if ((tick || mapS) && window.ScrollTimeline) {
        try { tl = new ScrollTimeline({ source: scroller, axis: 'block' }); } catch (e) { tl = null; }
      }
      function position() {
        if (!tl) return scroller.scrollTop;   // no scroll timelines: the plain read
        var t = tl.currentTime;
        return t && typeof t.value === 'number' ? t.value / 100 * range : null;
      }
      on(scrollEvents, 'scroll', function () {
        if (trig && !sweepT && (meta.size || (mapS && !mapS.done))) sweepT = later(sweep, 200);
        armDwell();
        var pos = (tick || (mapS && !mapS.done)) ? position() : null;
        if (pos !== null && tick) {
          var dist = lastPos === null ? 0 : Math.abs(pos - lastPos);
          lastPos = pos;
          if (tickerOn && mountOn && !tick.hover && dist && dist < 2000) {
            tick.boost = Math.min(tick.boost + dist * .006, SURGE_MAX - 1);
            wake();
          }
        }
        if (pos !== null && mapS && !mapS.done) mapScroll(pos);
        if (pf) wake();
      }, { passive: true });

      /* ===== sizes: one measure for everything cached, on resize (and window resize on a page) ===== */
      var measureQ = 0;
      function measure() {
        if (dead) return;
        range = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
        if (pf) { pfMeasure(); pfSync(); }
        if (mapS && !mapS.done) measureMap();
        fitCopies();
      }
      function queueMeasure() {
        if (measureQ || dead) return;
        measureQ = requestAnimationFrame(function () { measureQ = 0; measure(); });
      }
      if (window.ResizeObserver) {
        var ro = new ResizeObserver(function () { measure(); });
        ro.observe(root);
        ro.observe(scroller);
        if (tkLists[0]) ro.observe(tkLists[0]);   // the list's width changes when the display font arrives
        observers.push(ro);
      } else {
        Promise.resolve().then(measure);
      }
      if (page) on(window, 'resize', queueMeasure, { passive: true });

      /* the product images are decoded before they are needed: once the boxes are within a screen,
         lazy ones are switched to eager and decoded off the main thread, so a leap or drop never
         starts with a decode */
      var grid = q('.box-grid');
      if (grid) {
        var warm = observe(function (entries) {
          if (!entries[entries.length - 1].isIntersecting) return;
          warm.disconnect();
          qa('.prod', grid).forEach(function (img) {
            if (img.loading === 'lazy') img.loading = 'eager';
            if (img.decode) img.decode().catch(noop);
          });
        }, { root: ioRoot, rootMargin: '100% 0px 100% 0px' });
        warm.observe(grid);
      }

      /* product drift only on boxes within 15% of the view (CSS .sx-dr; none on phones, see the CSS) */
      if (timelines && boxes.length) {
        var drIO = observe(function (entries) {
          entries.forEach(function (en) { en.target.classList.toggle('sx-dr', en.isIntersecting); });
        }, { root: ioRoot, rootMargin: '15% 0px 15% 0px' });
        boxes.forEach(function (box) { drIO.observe(box); });
      }

      /* the whole mount off screen (frame scrolled away on the presentation page) or behind the
         full-screen overlay (shell.js makes the page behind it inert; an observer cannot see that a
         frame is covered): the ticker pauses. On a page the mount is the page, so it always counts. */
      var mountVis = true, behind = false;
      function syncMount() { mountOn = mountVis && !behind; syncTicker(); }
      observe(function (entries) {
        mountVis = entries[entries.length - 1].isIntersecting;
        syncMount();
      }, { threshold: 0 }).observe(scroller);
      if (window.MutationObserver && document.body && scroller.closest) {
        var checkBehind = function () {
          var now = !!scroller.closest('[inert]');
          if (now !== behind) { behind = now; syncMount(); }
        };
        var inertWatch = new MutationObserver(checkBehind);
        inertWatch.observe(document.body, { attributes: true, attributeFilter: ['inert'], subtree: true });
        observers.push(inertWatch);
        checkBehind();
      }

      /* start: products wait in their windows, entrances wait for their turn */
      byEl.forEach(function (info) {
        if (!info.prod) return;
        info.prod.classList.add('sx-hold');
        if (info.shot) info.shot.classList.add('sx-hold');
      });
      root.classList.add('sx');

      return function cleanup() {
        dead = true;
        offs.forEach(function (off) { off(); });
        observers.forEach(function (o) { o.disconnect(); });
        timers.forEach(function (id) { clearTimeout(id); });
        timers.clear();
        if (raf) cancelAnimationFrame(raf);
        if (measureQ) cancelAnimationFrame(measureQ);
        raf = measureQ = 0;
        live.forEach(cancel);
        live.clear();
        if (tick) setRate(1);
        if (layer) layer.remove();
        layer = null;
        if (mapS) {
          mapS.masks.forEach(function (k) { k.target.removeAttribute('mask'); k.mask.remove(); });
          mapS.here.classList.remove('sx-map', 'sx-tail');
          mapS.pins.forEach(function (pin) { pin.classList.remove('sx-on'); });
        }
        root.classList.remove('sx', 'sx-pf');
        boxes.forEach(function (box) { box.classList.remove('sx-dr'); });
        qa('.sx-hold').forEach(function (el) { el.classList.remove('sx-hold'); });
        qa('.sx-go').forEach(function (el) { el.classList.remove('sx-go'); });
        qa('.sx-slot').forEach(function (el) { el.classList.remove('sx-slot'); });
        qa('.shot').forEach(function (el) { el.style.removeProperty('--sx-par'); });
        if (ticker) ticker.classList.remove('sx-tk', 'sx-tk2', 'sx-off');
      };
    }
  });
})();
