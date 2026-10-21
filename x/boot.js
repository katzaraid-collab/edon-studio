/* EDON boot: sets the html classes the stylesheet and x.js branch on, before first paint. */
(function () {
  var h = document.documentElement, c = 'js on', q = location.search;
  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function ss(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  // calm motion: the visitor's own choice wins; without one, follow the system's reduced-motion setting
  try { var pref = ls('edon-x-calm'); if (pref === '1' || (pref !== '0' && matchMedia('(prefers-reduced-motion: reduce)').matches)) c += ' rm'; } catch (e) {}
  try {
    var n = navigator, low = (n.deviceMemory && n.deviceMemory <= 2) || (n.hardwareConcurrency && n.hardwareConcurrency <= 3);
    if (/[?&]nogl=1/.test(q) || (low && !/[?&]gl=1/.test(q))) c += ' nogl';
  } catch (e) {}
  // the intro world needs motion and WebGL; without them it renders as one still screen
  if (!/\b(rm|nogl)\b/.test(c) && window.WebGLRenderingContext && document.getElementById) c += ' idyn';
  if (ss('edon-x-seen') === '1') c += ' seen'; else { try { sessionStorage.setItem('edon-x-seen', '1'); } catch (e) {} }
  h.className = c;
})();
