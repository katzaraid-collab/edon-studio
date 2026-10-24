/* ==========================================================================
   Direction B · השקית — motion module: micro-interactions
   Pairs with b-motion-micro.css. Owner: micro motion module.

   OWNS: hover and press feedback, lid open, theme toggle, the order switch and its "soon" dot.

   CONTRACT
     init(root, ctx) runs for every mounted copy, after PROTO.init (b.js) and before Shell.reveal.
     ctx = { scroller, reduced, frame }  frame: 'desktop' | 'phone' | 'full'
     Return a cleanup function for anything outside root (listeners on ctx.scroller or document,
     timers, observers, rAF loops); shell.js calls it before the copy is rebuilt or the overlay closes.
     Inside a prototype: no position: fixed, no window scroll, IntersectionObserver root is
     ctx.scroller, no document-level ids. When ctx.reduced is true (root has .rm), add no motion.
     State it can react to: root[data-mode] (theme), root[data-order] (launch switch),
     .lid[aria-expanded] / .box.open (boxes), .ticker.paused.
     Hooks: see "hooks motion modules may rely on" at the top of b.css.
   ========================================================================== */
(window.ProtoModules = window.ProtoModules || []).push({
  name: 'b-micro',
  init: function (root, ctx) {
    /* nothing yet: all micro-interactions are pure CSS (b-motion-micro.css) */
  }
});
