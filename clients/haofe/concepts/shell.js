/* האופה · מצגת כיווני עיצוב — מנגנון המסגרות המשותף.
   Each direction page holds <template id="proto"> and defines window.PROTO.init(root, ctx).
   The shell clones the prototype into every [data-frame], scales it, and wires the controls. */
(function () {
  'use strict';
  var sysReduced = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var forceReduced = false;
  var seq = 0;

  var Shell = {
    reduced: function () { return forceReduced || sysReduced.matches; },

    /* unique ids inside a clone: data-id / data-for / data-controls / data-labelledby / data-describedby */
    ids: function (root) {
      var p = 'p' + (++seq) + '-';
      root.querySelectorAll('[data-id]').forEach(function (el) { el.id = p + el.getAttribute('data-id'); });
      root.querySelectorAll('[data-for]').forEach(function (el) { el.setAttribute('for', p + el.getAttribute('data-for')); });
      root.querySelectorAll('[data-controls]').forEach(function (el) { el.setAttribute('aria-controls', p + el.getAttribute('data-controls')); });
      root.querySelectorAll('[data-labelledby]').forEach(function (el) { el.setAttribute('aria-labelledby', p + el.getAttribute('data-labelledby')); });
      root.querySelectorAll('[data-describedby]').forEach(function (el) { el.setAttribute('aria-describedby', p + el.getAttribute('data-describedby')); });
      return p;
    },

    setMode: function (root, mode) {
      root.setAttribute('data-mode', mode);
      root.querySelectorAll('[data-theme-toggle]').forEach(function (b) {
        var dark = mode === 'dark';
        b.setAttribute('aria-pressed', dark ? 'true' : 'false');
        var l = b.querySelector('[data-theme-label]');
        if (l) l.textContent = dark ? (b.getAttribute('data-label-dark') || 'כהה') : (b.getAttribute('data-label-light') || 'בהיר');
      });
      root.dispatchEvent(new CustomEvent('protomode', { bubbles: true, detail: mode }));
    },

    themeButtons: function (root) {
      root.querySelectorAll('[data-theme-toggle]').forEach(function (b) {
        b.addEventListener('click', function () {
          Shell.setMode(root, root.getAttribute('data-mode') === 'dark' ? 'light' : 'dark');
        });
      });
    },

    /* scroll reveals: content is visible by default; .anim only adds the entry motion */
    reveal: function (root, scroller) {
      var els = root.querySelectorAll('[data-rv]');
      if (!root.classList.contains('anim') || !('IntersectionObserver' in window)) {
        els.forEach(function (el) { el.classList.add('rv-in'); });
        return;
      }
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add('rv-in'); io.unobserve(e.target); }
        });
      }, { root: scroller, rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
      els.forEach(function (el) { io.observe(el); });
    },

    /* disclosure menu for the mobile header: Esc closes, focus returns, Tab stays inside */
    menu: function (root) {
      var btn = root.querySelector('[data-menu-btn]');
      var panel = root.querySelector('[data-menu]');
      if (!btn || !panel) return;
      function set(open, focusBack) {
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        panel.hidden = !open;
        root.classList.toggle('menu-open', open);
        if (open) { var f = panel.querySelector('a,button'); if (f) f.focus(); }
        else if (focusBack) btn.focus();
      }
      btn.addEventListener('click', function () { set(btn.getAttribute('aria-expanded') !== 'true', false); });
      panel.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { e.preventDefault(); set(false, true); }
        if (e.key === 'Tab') {
          var f = panel.querySelectorAll('a,button');
          if (!f.length) return;
          if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); btn.focus(); }
        }
      });
      btn.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') set(false, true);
      });
      panel.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { set(false, false); }); });
    },

    /* in-prototype anchor links scroll their own viewport, not the presentation page */
    anchors: function (root, scroller) {
      root.querySelectorAll('a[data-jump]').forEach(function (a) {
        a.addEventListener('click', function (e) {
          var t = root.querySelector('[data-section="' + a.getAttribute('data-jump') + '"]');
          if (!t) return;
          e.preventDefault();
          var top = t.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
          var scale = scroller.getBoundingClientRect().height / scroller.offsetHeight || 1;
          scroller.scrollTo({ top: scroller.scrollTop + top / scale - 64, behavior: Shell.reduced() ? 'auto' : 'smooth' });
          t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true });
        });
      });
    }
  };
  window.Shell = Shell;

  function build(vp, mode) {
    var tpl = document.getElementById('proto');
    vp.innerHTML = '';
    vp.scrollTop = 0;
    vp.appendChild(tpl.content.cloneNode(true));
    var root = vp.querySelector('.proto');
    root.classList.toggle('anim', !Shell.reduced());
    root.classList.toggle('rm', Shell.reduced());
    Shell.ids(root);
    Shell.setMode(root, mode);
    Shell.themeButtons(root);
    Shell.menu(root);
    Shell.anchors(root, vp);
    if (window.PROTO && window.PROTO.init) window.PROTO.init(root, { scroller: vp, reduced: Shell.reduced() });
    Shell.reveal(root, vp);
    return root;
  }

  var frames = [];
  function fit(f) {
    var w = +f.el.getAttribute('data-w'), h = +f.el.getAttribute('data-h');
    var cs = getComputedStyle(f.box);
    var bw = parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
    var bh = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
    var avail = f.box.parentElement.clientWidth - bw;
    var s = Math.min(1, avail / w);
    f.vp.style.width = w + 'px';
    f.vp.style.height = h + 'px';
    f.vp.style.transform = s < 1 ? 'scale(' + s + ')' : 'none';
    f.box.style.width = Math.floor(w * s + bw) + 'px';
    f.box.style.height = Math.floor(h * s + bh) + 'px';
  }
  function modeOf(f) {
    var r = f.el.querySelector('input[type=radio]:checked');
    return r ? r.value : (f.el.getAttribute('data-mode') || 'light');
  }
  function rebuildAll() { frames.forEach(function (f) { f.root = build(f.vp, f.root ? f.root.getAttribute('data-mode') : modeOf(f)); }); }

  function openFull(mode) {
    var opener = document.activeElement;
    var fs = document.createElement('div');
    fs.className = 'fs';
    fs.setAttribute('role', 'dialog');
    fs.setAttribute('aria-modal', 'true');
    fs.setAttribute('aria-label', 'אב־טיפוס במסך מלא');
    fs.innerHTML = '<div class="fs-bar"><strong>מסך מלא · ' + (document.querySelector('h1') ? document.querySelector('h1').textContent : '') +
      '</strong><button type="button" class="btn btn--solid" data-close>סגירה (Esc)</button></div><div class="vp" tabindex="0" aria-label="תצוגת האתר"></div>';
    var main = document.getElementById('main');
    var top = document.querySelector('.topbar');
    document.body.appendChild(fs);
    if (main) main.inert = true;
    if (top) top.inert = true;
    document.documentElement.style.overflow = 'hidden';
    build(fs.querySelector('.vp'), mode);
    var close = fs.querySelector('[data-close]');
    function done() {
      fs.remove();
      if (main) main.inert = false;
      if (top) top.inert = false;
      document.documentElement.style.overflow = '';
      if (opener && opener.focus) opener.focus();
    }
    close.addEventListener('click', done);
    fs.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !fs.querySelector('.menu-open')) { e.preventDefault(); done(); }
    });
    close.focus();
  }

  function init() {
    document.querySelectorAll('[data-frame]').forEach(function (el) {
      var f = { el: el, box: el.querySelector('.frame-box'), vp: el.querySelector('.vp') };
      frames.push(f);
      f.root = build(f.vp, modeOf(f));
      fit(f);
      el.querySelectorAll('input[type=radio]').forEach(function (r) {
        r.addEventListener('change', function () { if (r.checked) Shell.setMode(f.root, r.value); });
      });
      el.addEventListener('protomode', function (e) {
        var r = el.querySelector('input[type=radio][value="' + e.detail + '"]');
        if (r) r.checked = true;
      });
    });
    var ro = new ResizeObserver(function () { frames.forEach(fit); });
    frames.forEach(function (f) { ro.observe(f.box.parentElement); });

    var rm = document.getElementById('rm');
    if (rm) {
      rm.checked = sysReduced.matches;
      rm.addEventListener('change', function () { forceReduced = rm.checked; rebuildAll(); });
    }
    document.querySelectorAll('[data-replay]').forEach(function (b) { b.addEventListener('click', rebuildAll); });
    document.querySelectorAll('[data-full]').forEach(function (b) {
      b.addEventListener('click', function () { openFull(frames[0] && frames[0].root ? frames[0].root.getAttribute('data-mode') : 'light'); });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
