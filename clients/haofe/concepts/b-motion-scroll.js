/* ==========================================================================
   Direction B · השקית — motion module: scroll (reveals, ticker, section entrances)
   Pairs with b-motion-scroll.css. Owner: scroll motion module.

   OWNS: [data-rv] scroll reveals (Shell.reveal adds .rv-in), the ticker loop, section entrances.

   CONTRACT
     init(root, ctx) runs for every mounted copy, after PROTO.init (b.js) and before Shell.reveal.
     ctx = { scroller, reduced, frame }  frame: 'desktop' | 'phone' | 'full'
     Return a cleanup function for anything outside root (listeners on ctx.scroller or document,
     timers, observers, rAF loops); shell.js calls it before the copy is rebuilt or the overlay closes.
     Inside a prototype: no position: fixed, no window scroll (listen to scroll on ctx.scroller),
     IntersectionObserver root is ctx.scroller, no document-level ids. When ctx.reduced is true
     (root has .rm), add no motion.
     Hooks: see "hooks motion modules may rely on" at the top of b.css.
   ========================================================================== */
(window.ProtoModules = window.ProtoModules || []).push({
  name: 'b-scroll',
  init: function (root, ctx) {
    /* nothing yet: reveals run through Shell.reveal, the ticker is pure CSS (b-motion-scroll.css) */
  }
});
