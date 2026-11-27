/* runs before first paint: language + direction, and whether the 18+ gate is needed */
(function () {
  var d = document.documentElement, lang = null, ok = null;
  try { lang = localStorage.getItem('mz.lang'); ok = localStorage.getItem('mz.18'); } catch (e) {}
  if (lang === 'en') { d.lang = 'en'; d.dir = 'ltr'; }
  if (ok === '1') d.classList.add('ok18');
  d.classList.add('js');
})();
