/* האופה · מצגת כיווני עיצוב — the shared presentation shell (EDON studio).
 *
 * WHAT THIS FILE DOES
 *   Every direction page (a.html, b.html, c.html) holds one <template id="proto">.
 *   This file copies ("mounts") that template into:
 *     - every <figure data-frame> on the page (desktop 1280px, two phones 390px),
 *       scaled down with a CSS transform so it fits the column, and
 *     - a full-screen overlay opened by the [data-full] button.
 *   It also wires the frame controls: the light/dark radios, the reduced-motion
 *   checkbox (#rm), the replay button [data-replay] and the overlay's close button.
 *   Every .vp is a named region (role="region" + aria-label). While the overlay is open,
 *   every other child of <body> is inert.
 *
 * CONTRACT WITH THE DIRECTION PAGES
 *   1. The direction's own behaviour:
 *        window.PROTO = { init: function (root, ctx) { ...; return cleanup; } };
 *   2. Optional extra modules (motion etc.), started in the order they were pushed:
 *        (window.ProtoModules = window.ProtoModules || []).push({
 *          name: 'b-hero', init: function (root, ctx) { ...; return cleanup; } });
 *   3. ctx = { contract: 2, page: false, frame, reduced, scroller, ioRoot, scrollEvents, vtHost, view() }
 *        frame        'desktop' | 'phone' | 'full'
 *        reduced      true when motion should be reduced (system setting or #rm checkbox)
 *        scroller     the scrolling .vp element that holds this mount (scroll position, sizes,
 *                     ScrollTimeline source, ResizeObserver)
 *        ioRoot       IntersectionObserver root       } all three are the same .vp here; on the site
 *        scrollEvents target for 'scroll' listeners   } (site-plan/skeleton/runtime.js) they are null,
 *        vtHost       startViewTransition host        } window and document, so use the right one
 *        view()       { top, left, right, bottom, width, height, scale } of the visible scroll area
 *                     in client px; scale = screen px per prototype px (the frames are scaled down)
 *      This is page contract 2 (site-plan/plan.md 6.2). A contract-1 module, which only reads
 *      scroller, reduced and frame, keeps working: the shell runs every module, with or without the
 *      `contract: 2` marker (only the site's runtime.js requires it).
 *   4. Returning a cleanup function is optional. The shell calls it before the mount
 *      is thrown away: replay, reduced-motion toggle, or the overlay closing.
 *   5. If a module throws, the error is logged with console.warn and the page carries on.
 *
 * LIFECYCLE OF ONE MOUNT (see build())
 *   run the old mount's cleanups → clone the template → classes, ids, mode
 *   → shell helpers (theme button, menu, anchors) → PROTO.init → each module → reveal
 *
 * RULES FOR PROTOTYPE CODE (the same template is mounted up to four times at once)
 *   - no position:fixed and no window scrolling: use sticky/absolute inside the root
 *   - listen to scroll on ctx.scroller, and use it as the IntersectionObserver root
 *   - no document-level ids: write data-id / data-for / data-controls / ... (see Shell.ids)
 *   - the root has class "anim" when motion is allowed and "rm" when it is reduced,
 *     and data-mode="light" | "dark"
 */
(function () {
  'use strict';

  /* ===== State ===== */

  var systemReduced = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false };
  var forcedReduced = false; // set by the "הדמיית הפחתת תנועה" checkbox (#rm)
  var idCounter = 0;         // makes every mount's id prefix unique
  var frames = [];           // one entry per <figure data-frame> on the page

  /* Shell.ids turns each template attribute (left) into the real attribute (right). */
  var ID_ATTRIBUTES = [
    ['data-id', 'id'],
    ['data-for', 'for'],
    ['data-controls', 'aria-controls'],
    ['data-labelledby', 'aria-labelledby'],
    ['data-describedby', 'aria-describedby']
  ];

  /* In-page jumps land this far below the mount's sticky header (prototype px), so the target's heading
     never touches it (design recheck #4, a11y recheck N5: a fixed 64px left map labels under the 75px
     desktop header). */
  var JUMP_GAP = 12;
  /* Used only when the mount has no header to measure. */
  var JUMP_OFFSET = 64;

  /* ===== Small helpers ===== */

  function noop() {}

  /* addEventListener that returns a function which removes the same listener again. */
  function listen(el, type, handler) {
    el.addEventListener(type, handler);
    return function () { el.removeEventListener(type, handler); };
  }

  /* Calls every cleanup, newest first. One failing cleanup does not stop the others. */
  function runCleanups(cleanups) {
    for (var i = cleanups.length - 1; i >= 0; i--) {
      try {
        cleanups[i]();
      } catch (err) {
        console.warn('[shell] a cleanup function failed:', err);
      }
    }
  }

  /* Wraps a list of cleanups into a single cleanup function. */
  function combine(cleanups) {
    return function () { runCleanups(cleanups); };
  }

  /* How much of the viewport's top the mount's header covers, in prototype px: its real height while
     it is sticky, 0 when it scrolls away with the page (b.css unsticks it on short screens), null when
     the mount has no header. Measured at jump time, so it follows the header's own breakpoints. */
  function headerCover(root, scale) {
    var header = root && root.querySelector('.hd, header');
    if (!header) return null;
    var position = getComputedStyle(header).position;
    if (position !== 'sticky' && position !== 'fixed') return 0;
    return header.getBoundingClientRect().height / scale;
  }

  /* Scrolls a (possibly CSS-scaled) viewport so that `target` sits JUMP_GAP below the sticky header.
     A target that starts right under the header (the hero, data-jump="top") lands on scrollTop 0. */
  function scrollViewportTo(scroller, target, root) {
    var box = scroller.getBoundingClientRect();
    // getBoundingClientRect() measures scaled screen pixels; dividing by the
    // frame's scale converts the distance back to the prototype's own pixels.
    var scale = box.height / scroller.offsetHeight || 1;
    var distance = (target.getBoundingClientRect().top - box.top) / scale;
    var cover = headerCover(root || target.closest('.proto'), scale);
    var offset = cover === null ? JUMP_OFFSET : cover + JUMP_GAP;
    scroller.scrollTo({
      top: Math.max(0, scroller.scrollTop + distance - offset),
      behavior: Shell.reduced() ? 'auto' : 'smooth'
    });
  }

  /* ===== Public API: window.Shell ===== */

  var Shell = {
    /* True when motion should be reduced: the system setting or the #rm checkbox. */
    reduced: function () {
      return forcedReduced || systemReduced.matches;
    },

    /* Gives one mount its own ids. Templates write data-id="menu" instead of id="menu";
       this sets id="p3-menu" (and data-for → for="p3-…", etc.). Returns the prefix. */
    ids: function (root) {
      var prefix = 'p' + (++idCounter) + '-';
      ID_ATTRIBUTES.forEach(function (pair) {
        var from = pair[0];
        var to = pair[1];
        root.querySelectorAll('[' + from + ']').forEach(function (el) {
          el.setAttribute(to, prefix + el.getAttribute(from));
        });
      });
      return prefix;
    },

    /* Switches one mount to 'light' or 'dark', updates its theme buttons, and fires a
       bubbling 'protomode' event so the frame's radios can follow along. */
    setMode: function (root, mode) {
      var dark = mode === 'dark';
      root.setAttribute('data-mode', mode);
      root.querySelectorAll('[data-theme-toggle]').forEach(function (button) {
        button.setAttribute('aria-pressed', dark ? 'true' : 'false');
        var label = button.querySelector('[data-theme-label]');
        if (!label) return;
        label.textContent = dark
          ? (button.getAttribute('data-label-dark') || 'כהה')
          : (button.getAttribute('data-label-light') || 'בהיר');
      });
      root.dispatchEvent(new CustomEvent('protomode', { bubbles: true, detail: mode }));
    },

    /* The light/dark button inside the prototype's own header. Returns a cleanup. */
    themeButtons: function (root) {
      var cleanups = [];
      root.querySelectorAll('[data-theme-toggle]').forEach(function (button) {
        cleanups.push(listen(button, 'click', function () {
          var next = root.getAttribute('data-mode') === 'dark' ? 'light' : 'dark';
          Shell.setMode(root, next);
        }));
      });
      return combine(cleanups);
    },

    /* Scroll reveals. Content is visible by default. When motion is allowed (.anim),
       each [data-rv] gets .rv-in the first time it scrolls into view. Returns a cleanup. */
    reveal: function (root, scroller) {
      var items = root.querySelectorAll('[data-rv]');
      var canAnimate = root.classList.contains('anim') && 'IntersectionObserver' in window;
      if (!canAnimate) {
        items.forEach(function (el) { el.classList.add('rv-in'); });
        return noop;
      }
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('rv-in');
          observer.unobserve(entry.target); // reveal once, then stop watching it
        });
      }, { root: scroller, rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
      items.forEach(function (el) { observer.observe(el); });
      return function () { observer.disconnect(); };
    },

    /* Mobile header menu (disclosure pattern). The button toggles the panel; Esc anywhere in
       the mount closes it and returns focus to the button; Shift+Tab on the first item goes
       back to the button; choosing a link closes the panel; and the panel closes as soon as
       focus leaves both the panel and the button (audit A11Y-03: before, Tab past the last
       item left the open panel covering the next controls). Returns a cleanup. */
    menu: function (root) {
      var button = root.querySelector('[data-menu-btn]');
      var panel = root.querySelector('[data-menu]');
      if (!button || !panel) return noop;

      function isOpen() {
        return button.getAttribute('aria-expanded') === 'true';
      }

      function setOpen(open, returnFocus) {
        button.setAttribute('aria-expanded', open ? 'true' : 'false');
        panel.hidden = !open;
        root.classList.toggle('menu-open', open);
        if (open) {
          var first = panel.querySelector('a,button');
          if (first) first.focus();
        } else if (returnFocus) {
          button.focus();
        }
      }

      // Esc is heard on the whole mount, not only on the panel and the button.
      // preventDefault() tells the full-screen overlay "already handled, stay open".
      function onRootKey(e) {
        if (e.key === 'Escape' && isOpen()) {
          e.preventDefault();
          setOpen(false, true);
        }
      }

      function onPanelKey(e) {
        if (e.key === 'Tab' && e.shiftKey) {
          var first = panel.querySelector('a,button');
          if (first && document.activeElement === first) {
            e.preventDefault();
            button.focus();
          }
        }
      }

      // Safari does not focus a button on click, so pressing the button while focus is in
      // the panel looks like "focus left" (relatedTarget null). Ignore that one focusout and
      // let the click toggle the panel. The flag only lives for the current input event.
      var pressingButton = false;
      function onButtonPress() {
        pressingButton = true;
        setTimeout(function () { pressingButton = false; }, 0);
      }

      function onFocusOut(e) {
        if (!isOpen()) return;
        var next = e.relatedTarget;
        if (next && (panel.contains(next) || button.contains(next))) return;
        if (!next && (pressingButton || !document.hasFocus())) return; // button press, or the window lost focus
        setOpen(false, false);
      }

      var cleanups = [
        listen(button, 'click', function () { setOpen(!isOpen(), false); }),
        listen(button, 'pointerdown', onButtonPress),
        listen(root, 'keydown', onRootKey),
        listen(panel, 'keydown', onPanelKey),
        listen(panel, 'focusout', onFocusOut),
        listen(button, 'focusout', onFocusOut)
      ];
      panel.querySelectorAll('a').forEach(function (link) {
        cleanups.push(listen(link, 'click', function () { setOpen(false, false); }));
      });
      return combine(cleanups);
    },

    /* Links with data-jump="x" scroll their own viewport to [data-section="x"]
       instead of scrolling the presentation page. Returns a cleanup. */
    anchors: function (root, scroller) {
      var cleanups = [];
      root.querySelectorAll('a[data-jump]').forEach(function (link) {
        cleanups.push(listen(link, 'click', function (e) {
          var name = link.getAttribute('data-jump');
          var target = root.querySelector('[data-section="' + name + '"]');
          if (!target) return;
          e.preventDefault();
          scrollViewportTo(scroller, target, root);
          target.setAttribute('tabindex', '-1');
          target.focus({ preventScroll: true });
        }));
      });
      return combine(cleanups);
    }
  };
  window.Shell = Shell;

  /* ===== Mounting the prototype ===== */

  /* Runs one init function and keeps its cleanup if it returned one. If it throws, the
     error is logged and the build carries on. PROTO failures are logged as errors
     (a real bug in the direction); module failures as warnings (per the contract). */
  function runStep(label, start, cleanups, isCritical) {
    try {
      var cleanup = start();
      if (typeof cleanup === 'function') cleanups.push(cleanup);
    } catch (err) {
      if (isCritical) console.error('[shell] ' + label + ' failed:', err);
      else console.warn('[shell] ' + label + ' failed and was skipped:', err);
    }
  }

  /* The registered modules, read fresh on every build. Bad entries are skipped. */
  function registeredModules() {
    var list = Array.isArray(window.ProtoModules) ? window.ProtoModules : [];
    return list.filter(function (mod) {
      var valid = !!mod && typeof mod.init === 'function';
      if (!valid) console.warn('[shell] skipped a ProtoModules entry without init():', mod);
      return valid;
    });
  }

  /* Throws away whatever is mounted in `vp`: runs its cleanups, then empties it.
     The cleanups are stored on the vp itself (vp.protoCleanups) by build(). */
  function unmount(vp) {
    runCleanups(vp.protoCleanups || []);
    vp.protoCleanups = [];
    vp.innerHTML = '';
  }

  /* Builds (or rebuilds) one mount inside `vp` and returns its .proto root.
     mode: 'light' | 'dark'.  frame: 'desktop' | 'phone' | 'full'. */
  function build(vp, mode, frame) {
    unmount(vp);
    vp.scrollTop = 0;
    vp.appendChild(document.getElementById('proto').content.cloneNode(true));

    var root = vp.querySelector('.proto');
    var reduced = Shell.reduced();
    root.classList.toggle('anim', !reduced);
    root.classList.toggle('rm', reduced);
    Shell.ids(root);
    Shell.setMode(root, mode);

    // contract 2 (site-plan/plan.md 6.2): inside a frame the one scrolling .vp is every one of these;
    // the site's runtime.js passes the page's objects under the same names
    var ctx = {
      contract: 2,
      page: false,
      frame: frame,
      reduced: reduced,
      scroller: vp,
      ioRoot: vp,
      scrollEvents: vp,
      vtHost: vp,
      view: function () {
        var r = vp.getBoundingClientRect();
        return {
          top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height,
          scale: (r.height / (vp.offsetHeight || r.height || 1)) || 1
        };
      }
    };
    var cleanups = [
      Shell.themeButtons(root),
      Shell.menu(root),
      Shell.anchors(root, vp)
    ];
    if (window.PROTO && typeof window.PROTO.init === 'function') {
      runStep('PROTO.init', function () { return window.PROTO.init(root, ctx); }, cleanups, true);
    }
    registeredModules().forEach(function (mod) {
      var label = 'module "' + (mod.name || 'unnamed') + '"';
      runStep(label, function () { return mod.init(root, ctx); }, cleanups, false);
    });
    cleanups.push(Shell.reveal(root, vp));

    vp.protoCleanups = cleanups;
    return root;
  }

  /* ===== Frames on the page ===== */

  /* Scales a frame's 1280px / 390px viewport down to the column width (never up). */
  function fitFrame(f) {
    var width = +f.el.getAttribute('data-w');
    var height = +f.el.getAttribute('data-h');
    var style = getComputedStyle(f.box);
    var borderX = parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
    var borderY = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    var available = f.box.parentElement.clientWidth - borderX;
    var scale = Math.min(1, available / width);

    f.vp.style.width = width + 'px';
    f.vp.style.height = height + 'px';
    f.vp.style.transform = scale < 1 ? 'scale(' + scale + ')' : 'none';
    f.box.style.width = Math.floor(width * scale + borderX) + 'px';
    f.box.style.height = Math.floor(height * scale + borderY) + 'px';
  }

  /* A frame's current mode: its mounted prototype, else its checked radio,
     else its data-mode attribute, else light. */
  function currentMode(f) {
    if (f.root) return f.root.getAttribute('data-mode');
    var checked = f.el.querySelector('input[type=radio]:checked');
    if (checked) return checked.value;
    return f.el.getAttribute('data-mode') || 'light';
  }

  /* Replay button and reduced-motion toggle: rebuild every frame in its current mode. */
  function rebuildAllFrames() {
    frames.forEach(function (f) {
      f.root = build(f.vp, currentMode(f), f.kind);
    });
  }

  /* Registers one <figure data-frame>, mounts the prototype and connects its radios. */
  function setupFrame(el) {
    var f = {
      el: el,
      box: el.querySelector('.frame-box'),
      vp: el.querySelector('.vp'),
      kind: el.classList.contains('frame--phone') ? 'phone' : 'desktop',
      root: null
    };
    frames.push(f);
    // Every scroll viewport is a named region (audit A11Y-14: aria-label without a role is
    // not allowed on a div). The direction pages should write role="region" themselves;
    // this only fills the gap when a page has not been updated yet.
    if (f.vp.hasAttribute('aria-label') && !f.vp.hasAttribute('role')) f.vp.setAttribute('role', 'region');
    f.root = build(f.vp, currentMode(f), f.kind);
    fitFrame(f);

    // radio → prototype
    el.querySelectorAll('input[type=radio]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        if (radio.checked) Shell.setMode(f.root, radio.value);
      });
    });
    // prototype's own theme button → radio
    el.addEventListener('protomode', function (e) {
      var radio = el.querySelector('input[type=radio][value="' + e.detail + '"]');
      if (radio) radio.checked = true;
    });
  }

  /* ===== Full-screen overlay ===== */

  /* The overlay's .vp is a named region but not a Tab stop (a11y recheck N4: as one it took focus with
     no visible ring, its outline painted under the prototype). The prototype always has focusable
     content, so Tab goes from the close button straight to its skip link, and from any focus inside
     it the arrow keys, PageUp/PageDown, Space, Home and End scroll this .vp, the focused element's
     nearest scroller. The frames on the page keep their own tabindex (shell.css shows their ring on
     the frame box). */
  var OVERLAY_HTML =
    '<div class="fs-bar"><strong></strong>' +
    '<button type="button" class="btn btn--solid" data-close>סגירה (Esc)</button></div>' +
    '<div class="vp" role="region" aria-label="תצוגת האתר"></div>';

  /* While the overlay is open nothing behind it can be focused or scrolled: every direct
     child of <body> except the overlay itself (audit A11Y-11: before, only #main and
     .topbar were inert, and Shift+Tab from the close button reached the page's skip link). */
  var BEHIND_OVERLAY = 'body > :not(.fs):not(script):not(template)';
  function setPageBehindInert(inert) {
    document.querySelectorAll(BEHIND_OVERLAY).forEach(function (el) { el.inert = inert; });
    document.documentElement.style.overflow = inert ? 'hidden' : '';
  }

  function openFullScreen(mode) {
    var opener = document.activeElement;
    var heading = document.querySelector('h1');

    var overlay = document.createElement('div');
    overlay.className = 'fs';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'אב־טיפוס במסך מלא');
    overlay.innerHTML = OVERLAY_HTML;
    overlay.querySelector('strong').textContent = 'מסך מלא · ' + (heading ? heading.textContent : '');
    document.body.appendChild(overlay);
    setPageBehindInert(true);

    var vp = overlay.querySelector('.vp');
    var closeButton = overlay.querySelector('[data-close]');
    build(vp, mode, 'full');

    // Esc closes the overlay, unless something inside already used it (e.g. the menu).
    // Heard on the document, so it also works when focus has left the dialog for <body>
    // (Shift+Tab from the close button: everything else on the page is inert).
    function onKey(e) {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (overlay.querySelector('.menu-open')) return;
      e.preventDefault();
      close();
    }

    function close() {
      document.removeEventListener('keydown', onKey);
      unmount(vp); // runs this mount's cleanups before the overlay disappears
      overlay.remove();
      setPageBehindInert(false);
      if (opener && opener.focus) opener.focus();
    }

    closeButton.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    // Focus after the first frame, so the browser does not have to lay out the freshly
    // built mount synchronously just to place the focus (perf).
    requestAnimationFrame(function () {
      if (overlay.isConnected) closeButton.focus();
    });
  }

  /* The overlay opens in whatever mode the desktop frame is showing. */
  function desktopMode() {
    return frames[0] && frames[0].root ? frames[0].root.getAttribute('data-mode') : 'light';
  }

  /* ===== Start ===== */

  function init() {
    if (!document.getElementById('proto')) return; // nothing to mount on this page

    document.querySelectorAll('[data-frame]').forEach(setupFrame);

    // re-fit the frames whenever their column changes width
    var resizeObserver = new ResizeObserver(function () { frames.forEach(fitFrame); });
    frames.forEach(function (f) { resizeObserver.observe(f.box.parentElement); });

    var reducedCheckbox = document.getElementById('rm');
    if (reducedCheckbox) {
      reducedCheckbox.checked = systemReduced.matches;
      reducedCheckbox.addEventListener('change', function () {
        forcedReduced = reducedCheckbox.checked;
        rebuildAllFrames();
      });
    }

    document.querySelectorAll('[data-replay]').forEach(function (button) {
      button.addEventListener('click', rebuildAllFrames);
    });
    document.querySelectorAll('[data-full]').forEach(function (button) {
      button.addEventListener('click', function () { openFullScreen(desktopMode()); });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
