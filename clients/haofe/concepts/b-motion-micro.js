/* ==========================================================================
   Direction B · השקית — motion module: micro-interactions. Version 3, 24.10.2026.
   Pairs with b-motion-micro.css (read its header: what it owns, who moves what, the classes).

   OWNS (the parts CSS cannot do alone)
     - boxes, fine pointers: while the cursor is over a box this module owns the box's transform.
       Springs lift and straighten it and tilt it in 3D toward the cursor (a few degrees), and a
       soft glare follows the cursor inside the box's window. On leave the springs settle back to
       exactly the state the CSS rules describe, then hand the transform back to CSS. (The boxes
       have no lid any more, plan R1: there is nothing to open; the bread's small rise on hover
       is CSS.)
     - map pairing: pointing at a pin or at its label, or moving keyboard focus into a label,
       marks both .mi-pair (and .here.mi-fac for the production house); the CSS lifts the label
       and flares the oven. This part also runs under reduced motion: it is a highlight, not motion.
     - enter-once accents, each played to the end: the nav chip wobbles, a box's tag wobbles, a map
       label sways on its nail, the pin in the main button hops, the tape's pause icon pops
     - the mobile menu: panel unfolds and links slide in one after another (--stagger) when
       Shell.menu shows it; it folds away when Shell.menu hides it (kept painted and inert while it
       leaves, so nothing in it can be focused or clicked). Focus handling stays Shell.menu's.
     - theme: on phone layouts the in-page toggle swaps the mode inside a view transition on vtHost
       (the mount's own viewport in a frame, the document on a page), so the cross-fade runs on the
       compositor; wide layouts and switches from outside (the page's radios) use the CSS token
       fade. A short bloom around the toggle at every switch. The icon morph is CSS.
     - order receipt (owner override O1): when data-order flips to "live" the status line is
       stamped on, the order button prints in and the nav chip is stamped; back to "soon" the
       status line and the chip fade in. The "בקרוב:" mark gives two oven-timer beats the first
       time the printed receipt is on screen: once per mount, over about 3 s after it starts (O5,
       plan R5 option b: nothing ambient runs past 5 s). It never repeats and never loops.
     - the header's scroll shadow where CSS scroll timelines are missing (.mi-lift)
     - .mi-scrolling on the root while the page scrolls (and ~160ms after): hover reactions wait,
       a tilted box settles back, a pointer pairing drops, so nothing reacts to merely passing
       under the pointer

   CONTRACT 2 (site-plan/plan.md 6.2; shell.js passes { scroller, reduced, frame } today, the site's
   runtime.js passes all of it)
     init(root, ctx) runs for every mounted copy, after PROTO.init (b.js) and before Shell.reveal.
     ctx = { scroller, reduced, frame, [contract, page, ioRoot, scrollEvents, vtHost, view()] }
       scroller      scroll position, sizes, ResizeObserver (a frame's .vp; on a page <html>)
       ioRoot        IntersectionObserver root (the .vp; on a page null = the viewport)
       scrollEvents  where 'scroll' fires (the .vp; on a page window)
       vtHost        startViewTransition host (the .vp; on a page document)
       view()        { top, left, width, height, scale } of the visible scroll area in client px
     Each key falls back to the prototype frame when the shell does not pass it. On a page root is
     <html class="pb">. No window resize listener is needed here: nothing caches the viewport
     height; the box sizes and the phone/wide switch come from ResizeObservers, which also fire
     on a page (<html> changes width with the window), and every hover measures afresh.
     Under reduced motion (ctx.reduced / .rm) only the map pairing runs: the CSS gives instant,
     calm states and nothing moves or is injected.
     The returned cleanup removes every listener, observer, rAF, timer, animation, injected node,
     class and inline style it added.
     Inside a prototype: no position: fixed, no window scroll. Pointer and scroll handlers only
     store numbers or flip a flag and wake the loop: layout is read inside the rAF loop, before
     anything is written, and only when a hover starts or the size changed under a hovered box;
     sizes come from ResizeObservers.
     One rAF loop, running only while a box is being tilted or settling (or the header fallback
     has a change to write); asleep otherwise, and so asleep whenever the mount is off screen.
     Timers: the two timer beats (only while the receipt is on screen) and the scroll-end timeout.
     Hooks: see "hooks motion modules may rely on" at the top of b.css.
   ========================================================================== */
(function () {
  'use strict';

  var FINE_POINTER = '(hover: hover) and (pointer: fine)';
  var TILT = 4.5;       // degrees of 3D tilt with the cursor at a box's edge (gentle: past ~9 it is a toy)
  var LIFT = -6;        // px, the hover lift in b-motion-micro.css
  var PERSPECTIVE = 1000;
  var BEATS = 2;        // the "בקרוב:" timer beats, once per mount (O5: all of it inside 5 s)
  var BEAT_GAP = 1500;  // ms from one beat's start to the next; a beat lasts 1100ms
  var BEAT_WAIT = 450;  // ms after the printed receipt is in view before the first beat

  function noop() {}
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function f2(n) { return (Math.round(n * 100) / 100).toString(); }

  /* a damped spring toward .t; stiffness k and damping c per unit mass. step(dt in s) integrates
     in small fixed substeps (stable at any frame rate) and returns true while it is still moving */
  function Spring(k, c, eps) { this.k = k; this.c = c; this.eps = eps || .01; this.x = 0; this.v = 0; this.t = 0; }
  Spring.prototype.step = function (dt) {
    var n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
    for (var i = 0; i < n; i++) {
      this.v += (-this.k * (this.x - this.t) - this.c * this.v) * h;
      this.x += this.v * h;
    }
    if (Math.abs(this.x - this.t) < this.eps && Math.abs(this.v) < this.eps * 4) { this.x = this.t; this.v = 0; return false; }
    return true;
  };
  Spring.prototype.jump = function (x) { this.x = this.t = x; this.v = 0; };

  /* ===== map pairing: a pin and its label light up together (any motion setting) =====
     Delegated on the map section. The pointer side ignores touch (a tap would leave a pairing
     behind) and, while the page scrolls, the caller drops it (scrollingNow). Writes classes only
     when the paired set changes. Returns { drop, off }. */
  function mapPairs(root, scrollingNow) {
    var here = root.querySelector('.here');
    if (!here) return { drop: noop, off: noop };
    var parts = Array.prototype.slice.call(here.querySelectorAll('.pin[data-place], .place[data-place]'));
    var offs = [];
    var byPointer = null, byFocus = null, shown = '';
    function on(el, type, fn, opts) { el.addEventListener(type, fn, opts); offs.push(function () { el.removeEventListener(type, fn, opts); }); }
    function placeOf(node) {
      var el = node && node.closest ? node.closest('.pin[data-place], .place[data-place]') : null;
      return el && here.contains(el) ? el.getAttribute('data-place') : null;
    }
    function render() {
      var key = (byPointer || '') + '|' + (byFocus || '');
      if (key === shown) return;
      shown = key;
      parts.forEach(function (el) {
        var p = el.getAttribute('data-place');
        el.classList.toggle('mi-pair', p === byPointer || p === byFocus);
      });
      here.classList.toggle('mi-fac', byPointer === 'factory' || byFocus === 'factory');
    }
    on(here, 'pointerover', function (e) {
      if (e.pointerType === 'touch' || scrollingNow()) return;
      var p = placeOf(e.target);
      if (p !== byPointer) { byPointer = p; render(); }
    }, { passive: true });
    on(here, 'pointerleave', function () { if (byPointer) { byPointer = null; render(); } }, { passive: true });
    /* keyboard: focus on a link inside a label (its phone or Google Maps link) points at its pin */
    on(here, 'focusin', function (e) {
      var label = e.target && e.target.closest ? e.target.closest('.place[data-place]') : null;
      byFocus = label ? label.getAttribute('data-place') : null;
      render();
    });
    on(here, 'focusout', function (e) {
      var next = e.relatedTarget;
      var label = next && next.closest ? next.closest('.place[data-place]') : null;
      byFocus = label && here.contains(label) ? label.getAttribute('data-place') : null;
      render();
    });
    return {
      drop: function () { if (byPointer) { byPointer = null; render(); } },
      off: function () {
        offs.forEach(function (f) { f(); });
        parts.forEach(function (el) { el.classList.remove('mi-pair'); });
        here.classList.remove('mi-fac');
      }
    };
  }

  (window.ProtoModules = window.ProtoModules || []).push({
    name: 'b-micro',
    contract: 2,
    init: function (root, ctx) {
      ctx = ctx || {};
      var scroller = ctx.scroller;
      if (!scroller) return noop;

      /* ---- page contract 2: each key falls back to the prototype frame (shell.js contract 1) ---- */
      var ioRoot = 'ioRoot' in ctx ? ctx.ioRoot : scroller;   // IntersectionObserver root (null = viewport)
      var scrollEvents = ctx.scrollEvents || scroller;         // where 'scroll' fires (window on a page)
      var vtHost = ctx.vtHost || scroller;                     // startViewTransition host (document on a page)
      var view = typeof ctx.view === 'function' ? ctx.view : function () {
        var r = scroller.getBoundingClientRect();
        return { top: r.top, left: r.left, width: r.width, height: r.height,
          scale: (r.height / (scroller.offsetHeight || r.height || 1)) || 1 };
      };

      var scrolling = false;
      var pairs = mapPairs(root, function () { return scrolling; });
      var motion = !ctx.reduced && root.classList.contains('anim') && !root.classList.contains('rm');
      if (!motion || typeof root.animate !== 'function') return pairs.off;

      var dead = false;
      var offs = [];             // listener removers
      var observers = [];
      var live = new Set();      // every Animation this module started
      var injected = new Set();  // every node this module added
      var raf = 0, lastFrame = 0;

      function on(el, type, fn, opts) {
        el.addEventListener(type, fn, opts);
        offs.push(function () { el.removeEventListener(type, fn, opts); });
      }
      function q(sel) { return root.querySelector(sel); }
      function qa(sel, from) { return Array.prototype.slice.call((from || root).querySelectorAll(sel)); }
      function play(el, frames, opts) {
        if (!el) return null;
        var a;
        try { a = el.animate(frames, opts); } catch (e) { return null; }
        live.add(a);
        a.finished.then(function () { live.delete(a); }, function () { live.delete(a); });
        return a;
      }
      function busy(el) {   // something (this module or another one) is animating el right now
        try { return el.getAnimations().some(function (a) { return a.playState === 'running'; }); } catch (e) { return false; }
      }
      var fine = window.matchMedia ? window.matchMedia(FINE_POINTER) : { matches: false };
      var pointerFx = ctx.frame !== 'phone';   // a phone frame previews a phone: no hover-only extras

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
      var BOUNCE = easing(tok('--spring-bounce'), E_SPRING);
      var D_BOUNCE = ms('--dur-spring-bounce', 550);
      var STAG = ms('--stagger', 40);

      root.classList.add('mi');
      /* arm the theme cross-fade after the mount's first style, so a dark mount never fades in */
      var armRaf = requestAnimationFrame(function () { armRaf = 0; if (!dead) root.classList.add('mi-ready'); });
      /* iOS only applies :active (the press states) when a touch listener exists */
      on(root, 'touchstart', noop, { passive: true });

      /* ===== the one rAF loop ===== */
      function wake() {
        if (raf || dead) return;
        lastFrame = performance.now();
        raf = requestAnimationFrame(frame);
      }
      function frame(t) {
        raf = 0;
        if (dead) return;
        var dt = clamp((t - lastFrame) / 1000, .001, .05);
        lastFrame = t;
        var more = tiltFrame(dt);
        headerFrame();
        if (more) raf = requestAnimationFrame(frame);
      }

      /* ===== scrolling: things passing under a still pointer do not react ===== */
      /* .mi-scrolling for the gesture and a moment after; a tilted box settles back, a pointer
         pairing on the map drops. The handler only flips a flag and a timer: it reads nothing. */
      var scrollT = 0, scrollEndAt = 0;
      function scrollEnd() {
        scrollT = 0;
        scrolling = false;
        scrollEndAt = performance.now();
        if (!dead) root.classList.remove('mi-scrolling');
      }
      on(scrollEvents, 'scroll', function () {
        if (!scrolling) {
          scrolling = true;
          root.classList.add('mi-scrolling');
          if (hot) leave(hot);
          pairs.drop();
        }
        if (scrollT) clearTimeout(scrollT);
        scrollT = setTimeout(scrollEnd, 160);
      }, { passive: true });

      /* ===== boxes: tilt toward the cursor (fine pointers) ===== */

      var boxes = qa('.box-grid .box');
      var states = new Map();     // box -> spring state (fine pointers only)
      var tilting = new Set();    // states whose transform this module currently owns
      var hot = null;             // the state under the cursor
      var scale = 1;              // screen px per prototype px (the desktop frame is scaled down)

      /* built once at init; the box's size comes from the ResizeObserver (its first callback runs
         before the first paint), never from a pointer handler */
      function makeState(box) {
        var tilt = parseFloat(getComputedStyle(box).getPropertyValue('--tilt'));
        return {
          el: box, shot: box.querySelector('.shot'), sheen: null, glare: null,
          tilt: isFinite(tilt) ? tilt : -1,         // b.css: rotate(var(--tilt, -1deg))
          w: 0, h: 0, gw: 0, gh: 0,
          cx: 0, cy: 0, rect: null, measure: true, snapSheen: true, hot: false, on: false, last: '',
          lift: new Spring(260, 24), rz: new Spring(300, 34, .005),
          rx: new Spring(300, 32, .005), ry: new Spring(300, 32, .005),
          sx: new Spring(170, 26, .2), sy: new Spring(170, 26, .2)
        };
      }
      /* the transform the CSS rules give this box right now (what the springs settle to on leave) */
      function restOf(st) {
        var held = st.el.matches(':focus-within');
        return { lift: held ? LIFT : 0, rz: held ? 0 : st.tilt };
      }
      function write(st) {
        var tf = 'perspective(' + PERSPECTIVE + 'px) translateY(' + f2(st.lift.x) + 'px) rotate(' + f2(st.rz.x) +
          'deg) rotateX(' + f2(st.rx.x) + 'deg) rotateY(' + f2(st.ry.x) + 'deg)';
        if (tf !== st.last) { st.last = tf; st.el.style.transform = tf; }
        if (st.glare) st.glare.style.translate = f2(st.sx.x) + 'px ' + f2(st.sy.x) + 'px';
      }
      function release(st) {
        st.on = false;
        st.last = '';
        tilting.delete(st);
        st.el.style.removeProperty('transform');
        st.el.classList.remove('mi-tilt');
      }
      /* fromMove: the cursor was already resting on the box (a scroll just ended under it), so the
         CSS hover lift has had time to apply: start the springs from there, not from rest */
      function enter(box, e, fromMove) {
        var st = states.get(box);
        if (!st) return;
        if (hot && hot !== st) leave(hot);
        hot = st;
        st.hot = true;
        st.cx = e.clientX;
        st.cy = e.clientY;
        st.measure = true;
        if (!st.on) {
          var r = restOf(st);
          if (fromMove) {
            /* how far the CSS hover lift (--dur-slow, --spring-settle) has got since the scroll ended */
            var p = clamp((performance.now() - scrollEndAt) / 400, 0, 1), k = 1 - Math.pow(1 - p, 3);
            r = { lift: r.lift + (LIFT - r.lift) * k, rz: r.rz * (1 - k) };
          }
          st.lift.jump(r.lift); st.rz.jump(r.rz); st.rx.jump(0); st.ry.jump(0);
          st.on = true;
          tilting.add(st);
          box.classList.add('mi-tilt');
          write(st);   // same task as the class: the CSS hover state never shows without its spring
          st.snapSheen = true;
        }
        if (!st.sheen && st.shot) {
          /* the glare's window: same shape as the window b.css cuts into the box (.shot::before) */
          st.sheen = document.createElement('span');
          st.sheen.className = 'mi-sheen';
          st.sheen.setAttribute('aria-hidden', 'true');
          st.glare = document.createElement('i');
          st.sheen.appendChild(st.glare);
          st.shot.appendChild(st.sheen);
          injected.add(st.sheen);
        }
        box.classList.add('mi-hot');
        wake();
      }
      function leave(st) {
        st.hot = false;
        st.el.classList.remove('mi-hot');
        if (hot === st) hot = null;
        wake();
      }
      function tiltFrame(dt) {
        if (!tilting.size) return false;
        /* reads first (nothing has been written yet this frame) */
        if (hot && hot.measure) {
          scale = view().scale || 1;
          hot.rect = hot.el.getBoundingClientRect();
          if (hot.sheen) { hot.gw = hot.sheen.offsetWidth; hot.gh = hot.sheen.offsetHeight; }
          hot.measure = false;
        }
        var more = false;
        tilting.forEach(function (st) {
          if (st.hot && st.rect) {
            /* the rect's centre is stable under the box's own small rotation; its size comes from
               the untransformed box times the frame scale */
            var hw = st.w * scale / 2 || 1, hh = st.h * scale / 2 || 1;
            var u = clamp((st.cx - (st.rect.left + st.rect.width / 2)) / hw, -1, 1);
            var v = clamp((st.cy - (st.rect.top + st.rect.height / 2)) / hh, -1, 1);
            st.lift.t = LIFT; st.rz.t = 0;
            st.ry.t = u * TILT; st.rx.t = -v * TILT * .8;   // the box turns to face the cursor
            /* the glare crosses the window as the cursor crosses the box (a reflection moves with
               the viewer's eye; it need not sit under the cursor). Its centre stays one radius
               (a quarter of the window's width, b-motion-micro.css) inside the window's box, so
               the glare never leaves the window: no clip needed */
            var gr = st.gw * .25;
            st.sx.t = st.gw > 2 * gr ? gr + (u + 1) / 2 * (st.gw - 2 * gr) : st.gw / 2;
            st.sy.t = st.gh > 2 * gr ? gr + (v + 1) / 2 * (st.gh - 2 * gr) : st.gh / 2;
            if (st.snapSheen) { st.sx.jump(st.sx.t); st.sy.jump(st.sy.t); st.snapSheen = false; }
          } else if (!st.hot) {
            var r = restOf(st);
            st.lift.t = r.lift; st.rz.t = r.rz; st.rx.t = 0; st.ry.t = 0;
          }
          var moving = st.lift.step(dt);
          moving = st.rz.step(dt) || moving;
          moving = st.rx.step(dt) || moving;
          moving = st.ry.step(dt) || moving;
          if (st.hot) { moving = st.sx.step(dt) || moving; moving = st.sy.step(dt) || moving; }
          if (!moving && !st.hot) { release(st); return; }
          write(st);
          if (moving) more = true;
        });
        return more;
      }
      if (pointerFx) {
        boxes.forEach(function (box) {
          states.set(box, makeState(box));
          on(box, 'pointerenter', function (e) { if (e.pointerType === 'mouse' && fine.matches && !scrolling) enter(box, e); });
          on(box, 'pointermove', function (e) {
            if (e.pointerType !== 'mouse' || scrolling) return;
            var st = hot;
            if (!st || st.el !== box) { if (fine.matches) enter(box, e, true); return; }
            st.cx = e.clientX;
            st.cy = e.clientY;
            wake();
          }, { passive: true });
          on(box, 'pointerleave', function () { var st = states.get(box); if (st && st.hot) leave(st); });
        });
        if (window.ResizeObserver) {
          var ro = new ResizeObserver(function (entries) {
            entries.forEach(function (en) {
              var st = states.get(en.target);
              if (!st) return;
              st.w = st.el.clientWidth;
              st.h = st.el.clientHeight;
              st.measure = true;
            });
            if (hot) wake();
          });
          boxes.forEach(function (box) { ro.observe(box); });
          observers.push(ro);
        }
      }

      /* ===== enter-once accents (played to the end, never restarted while running) ===== */

      function wobble(el, delay) {
        if (!el || busy(el)) return;
        play(el, [
          { rotate: '0deg', easing: E_OUT },
          { rotate: '7deg', offset: .22, easing: E_INOUT },
          { rotate: '-4.5deg', offset: .48, easing: E_INOUT },
          { rotate: '1.6deg', offset: .74, easing: E_INOUT },
          { rotate: '0deg' }
        ], { duration: 640, delay: delay || 0 });
      }
      /* a map label brushed by the pointer swings a little on its nail (b-motion-micro.css sets its
         transform-origin there); never while its swing-in entrance (scroll module) is running */
      function sway(label) {
        if (!label || busy(label)) return;
        play(label, [
          { rotate: '0deg', easing: E_OUT },
          { rotate: '1deg', offset: .18, easing: E_INOUT },
          { rotate: '-.55deg', offset: .44, easing: E_INOUT },
          { rotate: '.2deg', offset: .68, easing: E_INOUT },
          { rotate: '0deg' }
        ], { duration: 1100 });
      }
      function hop(btn) {
        var pin = btn && btn.querySelector('svg');
        if (!pin || busy(pin)) return;
        play(pin, [
          { translate: '0 0', easing: E_OUT },
          { translate: '0 -4px', offset: .28, easing: E_IN },
          { translate: '0 0', offset: .52, easing: E_OUT },
          { translate: '0 -1.5px', offset: .7, easing: E_IN },
          { translate: '0 0', offset: .86 },
          { translate: '0 0' }
        ], { duration: 620 });
      }
      function popIcon(btn) {
        var tk = btn.closest('[data-ticker]');
        var icon = btn.querySelector(tk && tk.classList.contains('paused') ? '.play' : '.pause');
        play(icon, [{ scale: .45, rotate: '-40deg', opacity: .2 }, { scale: 1, rotate: '0deg', opacity: 1 }], { duration: D_BOUNCE, easing: BOUNCE });
      }
      function accent(el, kind) {
        if (kind === 'nav') wobble(el.querySelector('.chip-soon'));
        else if (kind === 'box') wobble(el.querySelector('.tag'), 60);
        else if (kind === 'place') sway(el);
        else if (kind === 'btn') hop(el);
      }
      var ACCENTS = [['.nav a', 'nav'], ['.box', 'box'], ['.place', 'place'], ['.btn-b', 'btn']];
      if (pointerFx) {
        on(root, 'pointerover', function (e) {
          if (e.pointerType !== 'mouse' || !fine.matches || scrolling || !e.target.closest) return;
          ACCENTS.forEach(function (pair) {
            var el = e.target.closest(pair[0]);
            /* an entry, not a move between the element's own children */
            if (el && root.contains(el) && !(e.relatedTarget && el.contains(e.relatedTarget))) accent(el, pair[1]);
          });
        }, { passive: true });
      }
      /* keyboard gets the same accents when focus arrives (not the label sway: focus should not move
         the text it lands in; the label lifts and pairs with its pin in CSS instead) */
      on(root, 'focusin', function (e) {
        var t = e.target;
        if (!t || !t.matches) return;
        var visible = false;
        try { visible = t.matches(':focus-visible'); } catch (err) { visible = false; }
        if (!visible) return;
        if (t.matches('.nav a')) accent(t, 'nav');
        else if (t.matches('.btn-b')) accent(t, 'btn');
      });
      on(root, 'click', function (e) {
        var tp = e.target && e.target.closest && e.target.closest('.tk-pause');
        if (tp && root.contains(tp)) popIcon(tp);   // b.js has already toggled .paused
      });

      /* ===== the mobile menu ===== */

      var panel = q('[data-menu]');
      var menuRun = [], menuInert = false, menuHidden = panel ? panel.hidden : true;
      function menuStop() {
        menuRun.forEach(function (a) { if (a) { try { a.cancel(); } catch (e) { /* gone */ } } });
        menuRun = [];
        if (!panel) return;
        panel.classList.remove('mi-closing');
        if (menuInert) { panel.inert = false; menuInert = false; }
      }
      var FOLD_OPEN = 'inset(0 -40px -64px -40px)', FOLD_SHUT = 'inset(0 -40px 100% -40px)';
      function menuOpen() {
        var wasClosing = menuInert;
        menuStop();
        /* Shell.menu focused the first item before this ran; if the panel was still inert from
           folding away, that focus was refused, so give it the focus Shell.menu meant to */
        if (wasClosing) {
          var first = panel.querySelector('a,button');
          if (first && document.activeElement !== first) first.focus();
        }
        menuRun.push(play(panel, [{ clipPath: FOLD_SHUT }, { clipPath: FOLD_OPEN }], { duration: 440, easing: E_OUT }));
        qa('a', panel).forEach(function (a, i) {
          menuRun.push(play(a, [{ opacity: 0, translate: '22px 0' }, { opacity: 1, translate: '0 0' }],
            { duration: 420, delay: 60 + i * STAG, easing: E_OUT, fill: 'backwards' }));
        });
      }
      function menuClose() {
        menuStop();
        panel.classList.add('mi-closing');
        if (!panel.inert) { panel.inert = true; menuInert = true; }
        qa('a', panel).forEach(function (a) {
          menuRun.push(play(a, [{ opacity: 1 }, { opacity: 0 }], { duration: 140, easing: E_OUT, fill: 'forwards' }));
        });
        var fold = play(panel, [{ clipPath: FOLD_OPEN }, { clipPath: FOLD_SHUT }], { duration: 280, delay: 40, easing: E_IN, fill: 'forwards' });
        menuRun.push(fold);
        var end = function () { if (!dead && panel.hidden) menuStop(); };
        if (fold) fold.finished.then(end, noop); else end();
      }
      if (panel && window.MutationObserver) {
        var menuWatch = new MutationObserver(function () {
          var h = panel.hidden;
          if (h === menuHidden) return;
          menuHidden = h;
          if (h) menuClose(); else menuOpen();
        });
        menuWatch.observe(panel, { attributes: true, attributeFilter: ['hidden'] });
        observers.push(menuWatch);
      }

      /* ===== theme switch ===== */

      function bloom() {
        qa('[data-theme-toggle]').forEach(function (btn) {
          play(btn, [{ opacity: 1, scale: .7 }, { opacity: 0, scale: 2.8 }], { duration: 700, easing: E_OUT, pseudoElement: '::after' });
        });
      }

      /* Phone layouts: the in-page toggle swaps the theme inside a view transition on vtHost (the
         CSS fades the morning snapshot off the live evening frame on the compositor). Measured at
         4x CPU throttle this removes ~2s of main-thread work per four switches. Wide layouts keep
         the CSS token fade, which is cheaper there than compositing two full-size frames, and so
         does any switch made from outside (the page's radios). */
      var narrow = scroller.clientWidth < 700;   // b.css: the phone composition lives below 700px
      var vtRun = null;
      function canSwap() {
        return narrow && typeof vtHost.startViewTransition === 'function' && !!window.Shell && typeof window.Shell.setMode === 'function';
      }
      function swapTheme(next) {
        root.classList.remove('mi-ready');   // the token fade must not run under the snapshot
        root.classList.add('mi-vt');
        var vt = null;
        try { vt = vtHost.startViewTransition(function () { window.Shell.setMode(root, next); }); } catch (err) { vt = null; }
        if (!vt) {
          root.classList.remove('mi-vt');
          root.classList.add('mi-ready');
          window.Shell.setMode(root, next);
          return;
        }
        vtRun = vt;
        var end = function () {
          if (vtRun !== vt) return;   // a newer switch took over
          vtRun = null;
          if (dead) return;
          root.classList.remove('mi-vt');
          root.classList.add('mi-ready');
        };
        vt.finished.then(end, end);
      }
      /* capture phase, so it runs before the toggle's own listener (Shell.themeButtons on the
         button in a frame, theme.js on document on a page), which would change the mode before the
         old frame could be captured; the same Shell.setMode call then happens inside the
         transition (radios, aria-pressed and the saved choice follow exactly as before) */
      on(root, 'click', function (e) {
        var btn = e.target && e.target.closest && e.target.closest('[data-theme-toggle]');
        if (!btn || !root.contains(btn) || !canSwap()) return;
        e.stopPropagation();
        swapTheme(root.getAttribute('data-mode') === 'dark' ? 'light' : 'dark');
      }, true);
      if (window.ResizeObserver) {
        var vpRO = new ResizeObserver(function () { narrow = scroller.clientWidth < 700; });
        vpRO.observe(scroller);
        observers.push(vpRO);
      }

      /* ===== the order receipt: launch day, and the "בקרוב:" timer ===== */

      var slip = q('.slip');
      var soonLine = slip && slip.querySelector('.order-status.when-soon');
      var mark = soonLine && soonLine.querySelector('.st');
      var chip = q('.nav .chip-soon');

      /* the stamp on the status line: the same device the scroll module uses when the receipt
         prints, so launch day reads as the receipt being stamped again */
      function stampLine(el, delay) {
        if (!el || busy(el)) return;
        play(el, [{ scale: 1.3, rotate: '-2.5deg' }, { scale: 1, rotate: '0deg' }], { duration: D_BOUNCE + 120, delay: delay, easing: BOUNCE, fill: 'backwards' });
        play(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 160, delay: delay, easing: E_OUT, fill: 'backwards' });
      }
      /* the chip: comes down large and turned, the spring's overshoot is the squash on impact */
      function stampChip(el, delay) {
        if (!el) return;
        play(el, [{ scale: 1.6, rotate: '-10deg' }, { scale: 1, rotate: '0deg' }], { duration: D_BOUNCE, delay: delay, easing: BOUNCE, fill: 'backwards' });
        play(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 110, delay: delay, easing: 'linear', fill: 'backwards' });
      }
      /* the print: the button feeds out downward while it is revealed top to bottom */
      function print(el, delay, pad) {
        if (!el) return;
        play(el, [
          { clipPath: 'inset(' + pad[0] + ' ' + pad[1] + ' 100% ' + pad[3] + ')', translate: '0 -8px' },
          { clipPath: 'inset(' + pad.join(' ') + ')', translate: '0 0' }
        ], { duration: 480, delay: delay, easing: E_OUT, fill: 'backwards' });
      }
      function orderLive() {
        stopBeats(true);
        stampLine(slip && slip.querySelector('.order-status.when-live'), 0);
        var btn = slip && slip.querySelector('.btn-b.when-live');
        if (btn) {
          print(btn, 300, ['-4px', '-24px', '-28px', '-24px']);
          play(btn, [{ scale: .92 }, { scale: 1 }], { duration: D_BOUNCE, delay: 420, easing: BOUNCE, fill: 'backwards' });
        }
        stampChip(chip, 60);
      }
      function orderSoon() {
        [soonLine, chip].forEach(function (el, i) {
          play(el, [{ opacity: 0, translate: '0 4px' }, { opacity: 1, translate: '0 0' }], { duration: 320, delay: i * STAG, easing: E_OUT, fill: 'backwards' });
        });
      }
      var mode = root.getAttribute('data-mode'), order = root.getAttribute('data-order');
      if (window.MutationObserver) {
        var stateWatch = new MutationObserver(function () {
          var m = root.getAttribute('data-mode'), o = root.getAttribute('data-order');
          if (m !== mode) { mode = m; bloom(); }
          if (o !== order) { order = o; if (o === 'live') orderLive(); else orderSoon(); syncBeats(); }
        });
        stateWatch.observe(root, { attributes: true, attributeFilter: ['data-mode', 'data-order'] });
        observers.push(stateWatch);
      }

      /* the oven timer, limited (O5, plan R5 option b): two beats on "בקרוב:", the first BEAT_WAIT
         after the printed receipt's status line is fully on screen, the second BEAT_GAP later; then
         nothing, for the life of this mount. If the line leaves the screen between the beats, the
         second is dropped (it never comes back later as a stray beat). Between beats no animation
         exists, so nothing ticks. */
      var lineOn = false, mountOn = true, beatT = 0, beats = 0, beatDone = !mark, slipWatch = null;
      function printed() {   // the receipt is not waiting for, or still in, its print entrance
        return !root.classList.contains('sx') || !slip.hasAttribute('data-rv') || slip.classList.contains('rv-done');
      }
      function beat() {
        beatT = 0;
        if (dead || beatDone) return;
        beats++;
        play(mark, [
          { scale: 1, easing: E_OUT },
          { scale: 1.16, offset: .14, easing: E_INOUT },
          { scale: .96, offset: .3, easing: E_INOUT },
          { scale: 1.07, offset: .46, easing: E_INOUT },
          { scale: 1, offset: .66 },
          { scale: 1 }
        ], { duration: 1100 });
        if (beats < BEATS) beatT = setTimeout(beat, BEAT_GAP);
        else stopBeats(true);
      }
      function stopBeats(forGood) {
        if (beatT) { clearTimeout(beatT); beatT = 0; }
        if (!forGood) return;
        beatDone = true;
        if (slipWatch) { slipWatch.disconnect(); slipWatch = null; }
      }
      function syncBeats() {
        if (beatDone) return;
        var want = lineOn && mountOn && order !== 'live' && printed();
        if (want && !beatT) beatT = setTimeout(beat, beats ? BEAT_GAP : BEAT_WAIT);
        else if (!want && beatT) stopBeats(beats > 0);   // started and interrupted: done for good
      }
      if (mark && 'IntersectionObserver' in window) {
        var lineIO = new IntersectionObserver(function (entries) {
          var en = entries[entries.length - 1];
          lineOn = en.isIntersecting && en.intersectionRatio > .98;
          syncBeats();
        }, { root: ioRoot, threshold: [0, 1] });
        lineIO.observe(soonLine);
        observers.push(lineIO);
        /* the whole mount on the presentation page (on a real page the root always intersects) */
        var mountIO = new IntersectionObserver(function (entries) {
          mountOn = entries[entries.length - 1].isIntersecting;
          syncBeats();
        }, { threshold: 0 });
        mountIO.observe(scroller);
        observers.push(mountIO);
        /* the scroll module marks the receipt .rv-done when its print has finished */
        if (!printed() && window.MutationObserver) {
          slipWatch = new MutationObserver(function () { if (printed()) { slipWatch.disconnect(); slipWatch = null; syncBeats(); } });
          slipWatch.observe(slip, { attributes: true, attributeFilter: ['class'] });
        }
      } else {
        beatDone = true;
      }

      /* ===== header shadow without scroll timelines ===== */

      var hd = q('.hd');
      var timelines = !!(window.CSS && CSS.supports && CSS.supports('animation-timeline: scroll()'));
      var lifted = false, liftWant = false;
      function headerFrame() {
        if (!hd || liftWant === lifted) return;
        lifted = liftWant;
        hd.classList.toggle('mi-lift', lifted);
      }
      if (hd && !timelines) {
        on(scrollEvents, 'scroll', function () {
          liftWant = scroller.scrollTop > 6;   // scroll handler: scrollTop only, the class is written in the loop
          if (liftWant !== lifted) wake();
        }, { passive: true });
      }

      return function cleanup() {
        dead = true;
        if (vtRun) { try { vtRun.skipTransition(); } catch (e) { /* done */ } vtRun = null; }
        offs.forEach(function (off) { off(); });
        observers.forEach(function (o) { o.disconnect(); });
        if (slipWatch) slipWatch.disconnect();
        pairs.off();
        if (raf) cancelAnimationFrame(raf);
        if (armRaf) cancelAnimationFrame(armRaf);
        raf = armRaf = 0;
        live.forEach(function (a) { try { a.cancel(); } catch (e) { /* gone */ } });
        live.clear();
        injected.forEach(function (n) { n.remove(); });
        injected.clear();
        states.forEach(function (st) {
          st.el.style.removeProperty('transform');
          st.el.classList.remove('mi-tilt', 'mi-hot');
        });
        states.clear();
        tilting.clear();
        if (panel) {
          panel.classList.remove('mi-closing');
          if (menuInert) panel.inert = false;
        }
        if (hd) hd.classList.remove('mi-lift');
        if (beatT) clearTimeout(beatT);
        if (scrollT) clearTimeout(scrollT);
        beatT = scrollT = 0;
        root.classList.remove('mi', 'mi-ready', 'mi-vt', 'mi-scrolling');
      };
    }
  });
})();
