/* ==========================================================================
   האופה · page runtime: boots window.ProtoModules (the prototype's b-motion-*.js) on a real page

   WHY AN ADAPTER
     In the prototype, shell.js mounts the template inside a scrolling <div class="vp"> and calls
     init(root, ctx) with ctx.scroller = that div. On the site the WINDOW scrolls, and three things
     the prototype could do with one element need three different objects (checked in Chromium
     153, site-plan/plan.md section 6):
       - IntersectionObserver root: must be null (the viewport). root: document.documentElement
         is accepted but measures against the whole document, so everything "intersects".
       - 'scroll' listener: must be on window (or document). <html> never receives scroll events.
       - scroll position, sizes, ScrollTimeline source, ResizeObserver, closest():
         document.scrollingElement (= <html>) works. new ScrollTimeline({ source: document })
         throws a TypeError.
       - the visible rectangle: the viewport { top: 0, left: 0 }, not <html>'s rect (its top is
         -scrollY, which breaks every "content y + offset = screen y" calculation).

   CONTRACT 2 (what a module gets here; shell.js can pass the same keys, see plan.md 6.2)
     init(root, ctx)  root = <html class="pb">, the element that carries data-mode, .anim/.rm
                      and the theme tokens.
     ctx = {
       contract: 2, page: true, frame: 'page', reduced,
       scroller      document.scrollingElement
       ioRoot        null                          use as IntersectionObserver { root: ctx.ioRoot }
       scrollEvents  window                        addEventListener('scroll', ...)
       vtHost        document                      vtHost.startViewTransition(...)
       view()        { top, left, width, height, scale } of the visible scroll area in client px
     }
     A module must say it understands this with `contract: 2` next to its name. A module without it
     was written for the prototype frame only and is SKIPPED with a console warning (it would
     observe the wrong root and listen on an element that never scrolls). tools/port-modules.mjs
     applies the documented changes to today's b-motion-*.js and adds the marker.

   LIFECYCLE
     Boots once, when this deferred script runs (the DOM is parsed and the module scripts, listed
     before it, have registered). When the system reduced-motion setting changes it runs every
     cleanup (newest first) and boots again, as shell.js does for its #rm checkbox. A module that
     throws is logged with console.warn and the page carries on (same rule as shell.js).
     Status for tests and debugging: window.__haofeRuntime.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var cleanups = [];
  var status = window.__haofeRuntime = { boots: 0, ran: [], skipped: [], failed: [] };

  /* The prototype's Shell API, as far as the modules call it: b-motion-micro uses Shell.setMode
     inside its view-transition theme swap. Routed to theme.js so the choice is saved. */
  if (!window.Shell) {
    window.Shell = {
      reduced: function () { return root.classList.contains('rm'); },
      setMode: function (r, mode) {
        if (window.HaofeTheme) window.HaofeTheme.set(mode);
        else (r || root).setAttribute('data-mode', mode);
      }
    };
  }

  function makeCtx(reduced) {
    var se = document.scrollingElement || root;
    return {
      contract: 2,
      page: true,
      frame: 'page',
      reduced: reduced,
      scroller: se,
      ioRoot: null,
      scrollEvents: window,
      vtHost: document,
      view: function () {
        return { top: 0, left: 0, width: se.clientWidth, height: se.clientHeight, scale: 1 };
      }
    };
  }

  function teardown() {
    for (var i = cleanups.length - 1; i >= 0; i--) {
      try { cleanups[i](); } catch (err) { console.warn('[runtime] a cleanup failed:', err); }
    }
    cleanups = [];
  }

  /* b.css hook "[data-rv] gets .rv-in once it enters view" (Shell.reveal), with the viewport as
     the root. No CSS uses .rv-in on 24.10.2026 (the scroll module has its own .sx/.rv-done), so
     this only keeps the documented hook true. */
  function reveal(ctx) {
    var items = document.querySelectorAll('[data-rv]');
    if (ctx.reduced || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('rv-in'); });
      return null;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('rv-in');
        io.unobserve(en.target);
      });
    }, { root: ctx.ioRoot, rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    items.forEach(function (el) { io.observe(el); });
    return function () { io.disconnect(); };
  }

  function boot() {
    teardown();
    var reduced = !!(mq && mq.matches);
    root.classList.toggle('anim', !reduced);
    root.classList.toggle('rm', reduced);
    var ctx = makeCtx(reduced);
    status.boots++;
    status.ran = [];
    status.skipped = [];
    status.failed = [];
    status.reduced = reduced;

    var list = Array.isArray(window.ProtoModules) ? window.ProtoModules : [];
    list.forEach(function (mod) {
      var name = (mod && mod.name) || 'unnamed';
      if (!mod || typeof mod.init !== 'function') {
        status.skipped.push(name);
        console.warn('[runtime] skipped a ProtoModules entry without init():', mod);
        return;
      }
      if (!(mod.contract >= 2)) {
        status.skipped.push(name);
        console.warn('[runtime] skipped module "' + name + '": it has no `contract: 2`, so it was written for the prototype frame (ctx.scroller = .vp). Port it first (site-plan/plan.md section 6).');
        return;
      }
      try {
        var cleanup = mod.init(root, ctx);
        if (typeof cleanup === 'function') cleanups.push(cleanup);
        status.ran.push(name);
      } catch (err) {
        status.failed.push(name);
        console.warn('[runtime] module "' + name + '" failed and was skipped:', err);
      }
    });
    var off = reveal(ctx);
    if (off) cleanups.push(off);
  }

  if (mq) {
    if (mq.addEventListener) mq.addEventListener('change', boot);
    else if (mq.addListener) mq.addListener(boot);
  }

  window.HaofeRuntime = { boot: boot, teardown: teardown, ctx: makeCtx };
  boot();
})();
