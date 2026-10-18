/* EDON X boot: sets the html classes the stylesheet and x.js branch on, before first paint. */
(function () {
  var h = document.documentElement, c = 'js on', q = location.search;
  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function ss(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  try { if (matchMedia('(prefers-reduced-motion: reduce)').matches || ls('edon-x-calm') === '1') c += ' rm'; } catch (e) {}
  try {
    var n = navigator, low = (n.deviceMemory && n.deviceMemory <= 2) || (n.hardwareConcurrency && n.hardwareConcurrency <= 3);
    if (/[?&]nogl=1/.test(q) || (low && !/[?&]gl=1/.test(q))) c += ' nogl';
  } catch (e) {}
  if (ss('edon-x-seen') === '1') c += ' seen'; else { try { sessionStorage.setItem('edon-x-seen', '1'); } catch (e) {} }
  h.className = c;
})();
