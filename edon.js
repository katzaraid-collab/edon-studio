/* EDON · scroll engine + site logic */
(() => {
'use strict';
const root = document.documentElement;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const map = (v, a, b) => clamp((v - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;
const eio = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const eout = t => 1 - Math.pow(1 - t, 3);
const ils = n => '₪' + Math.round(n).toLocaleString('en-US');
const mqRM = matchMedia('(prefers-reduced-motion: reduce)');
const mqDesk = matchMedia('(min-width: 900px)');
const FINE = matchMedia('(hover:hover) and (pointer:fine)').matches;
const safe = fn => { try { fn(); } catch (e) { console.error(e); } };
const replay = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

/* ---------- motion preference ---------- */
const store = {
  get(k, s = localStorage) { try { return s.getItem(k); } catch (e) { return null; } },
  set(k, v, s = localStorage) { try { s.setItem(k, v); } catch (e) {} }
};
let motion = root.classList.contains('motion');
const S = [];
const msw = $('#msw');
function setMotion(on, save) {
  motion = on;
  root.classList.toggle('motion', on);
  msw.setAttribute('aria-pressed', String(on));
  if (save) store.set('edon-m', on ? 'full' : 'calm');
  for (const s of S) s.fresh = true;
  layout(); kick();
}
msw.addEventListener('click', () => { setMotion(!motion, true); hideNote(); });
const note = $('#mnote');
function hideNote() { note.hidden = true; store.set('edon-note', '1', sessionStorage); }
const showNote = () => setTimeout(() => { note.hidden = false; }, 1600);
if (mqRM.matches && !store.get('edon-m') && !store.get('edon-note', sessionStorage)) {
  if (window.edonConsent && !window.edonConsent.get()) document.addEventListener('edon:consent-decided', showNote, { once: true }); else showNote();
}
$('#mn-on').addEventListener('click', hideNote);
$('#mn-off').addEventListener('click', () => { setMotion(false, true); hideNote(); });

/* ---------- scenes ---------- */
function scene(sel, fn, init) {
  const el = $(sel); if (!el) return;
  const s = { el, stick: $('.stick', el), fn, v: 0, fresh: true, flow: el.dataset.calm === 'flow' };
  if (init) init(s);
  S.push(s);
}

/* 1 · power */
scene('#top', (p, s) => {
  const el = s.el;
  const on = motion ? eio(map(p, .05, .38)) : (p > .08 ? 1 : 0);
  const m = motion ? eio(map(p, .28, .6)) : 1;
  el.style.setProperty('--on', on.toFixed(4));
  el.style.setProperty('--m', m.toFixed(4));
  el.style.setProperty('--cue', (1 - map(p, 0, .07)).toFixed(3));
  el.toggleAttribute('data-on', on > .55);
  s.words.forEach((w, i) => {
    const a = motion ? eout(map(p, .48 + i * .04, .66 + i * .04)) : map(p, .1 + i * .02, .24 + i * .02);
    w.style.setProperty('--a', a.toFixed(4));
  });
  el.style.setProperty('--b', (motion ? eout(map(p, .7, .86)) : map(p, .26, .4)).toFixed(4));
  const c = motion ? eout(map(p, .78, .93)) : map(p, .32, .46);
  el.style.setProperty('--c', c.toFixed(4));
  el.toggleAttribute('data-cta', c > .05);
}, s => {
  s.words = $$('.hero-h .w', s.el);
  s.btn = $('#power-btn');
  s.btn.addEventListener('click', () => {
    const total = s.el.offsetHeight - s.stick.offsetHeight;
    scrollTo({ top: s.el.offsetTop + total * (motion ? .96 : .6), behavior: motion ? 'smooth' : 'auto' });
  });
  s.layout = () => {
    let y = 0, n = s.btn;
    while (n && n !== s.stick) { y += n.offsetTop; n = n.offsetParent; }
    s.el.style.setProperty('--off', (s.stick.clientHeight / 2 - (y + s.btn.offsetHeight / 2)).toFixed(1) + 'px');
  };
});

/* 2 · manifesto: words light up as you read */
function splitWords(el) {
  const out = [];
  const walk = node => {
    for (const n of [...node.childNodes]) {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(t => {
          if (!t) return;
          if (/^\s+$/.test(t)) { frag.appendChild(document.createTextNode(t)); return; }
          const sp = document.createElement('span'); sp.className = 'wd'; sp.textContent = t; frag.appendChild(sp); out.push(sp);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) walk(n);
    }
  };
  walk(el); return out;
}
scene('#manifesto', (p, s) => {
  const lit = map(p, -.08, .78) * (s.words.length + 2);
  s.words.forEach((w, i) => w.style.setProperty('--l', clamp(lit - i).toFixed(3)));
  s.sign.style.setProperty('--sg', map(p, .74, .9).toFixed(3));
}, s => { s.words = splitWords($('#mani-t')); s.sign = $('.mani-sign', s.el); });

/* 3 · the phone */
scene('#app', (p, s) => {
  const vh = s.stick.clientHeight;
  const enter = eout(map(p, -.1, .13));
  const T1 = map(p, .3, .42), T2 = map(p, .6, .72), X = map(p, .9, 1);
  const e1 = eio(T1), e2 = eio(T2), ex = eio(X);
  const lift = Math.sin(Math.PI * T1) + Math.sin(Math.PI * T2);
  if (motion) {
    const spin = e1 * 360 - e2 * 360 + ex * 180;
    const wob = Math.sin(Math.PI * 2 * T1) * 7 - Math.sin(Math.PI * 2 * T2) * 7;
    const ry = -16 + spin, rx = 7 + (1 - enter) * 50 - lift * 5, rz = -4 - (1 - enter) * 26 + wob;
    const ty = (1 - enter) * vh * .75 - lift * vh * .025 - ex * vh * .04;
    const sc = 1 + lift * .06 - ex * .1;
    s.ph.style.transform = `translate3d(0,${ty.toFixed(1)}px,0) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg) scale(${sc.toFixed(4)})`;
    s.ph.style.opacity = '';
    s.ph.style.setProperty('--gl', (.45 + Math.abs(Math.sin((ry * Math.PI) / 180)) * .55).toFixed(3));
    s.wrap.style.setProperty('--shs', (1 - lift * .12 + (1 - enter) * .5).toFixed(3));
    s.wrap.style.setProperty('--sho', (enter * (1 - ex * .5)).toFixed(3));
  } else {
    s.ph.style.transform = '';
    s.ph.style.opacity = map(p, -.12, .02).toFixed(3);
    s.wrap.style.setProperty('--sho', '1');
  }
  const idx = motion ? (p < .36 ? 0 : p < .66 ? 1 : 2) : (p < .34 ? 0 : p < .64 ? 1 : 2);
  if (idx !== s.idx) { s.idx = idx; s.screens.forEach((el, i) => el.classList.toggle('on', i === idx)); }
  s.screens[1].classList.toggle('picked', p > .49);
  s.screens[1].style.setProperty('--nt', (motion ? eout(map(p, .52, .57)) : (p > .52 ? 1 : 0)).toFixed(3));
  s.screens[2].style.setProperty('--g', (motion ? eout(map(p, .7, .8)) : 1).toFixed(3));
  const win = motion
    ? [[map(p, -.15, .04), map(p, .3, .36)], [map(p, .37, .47), map(p, .6, .66)], [map(p, .67, .77), map(p, .96, 1.01)]]
    : [[1, map(p, .3, .34)], [map(p, .34, .38), map(p, .6, .64)], [map(p, .64, .68), 0]];
  s.chaps.forEach((c, i) => {
    const [a, o] = win[i];
    c.lines.forEach((l, j) => {
      const aj = eout(map(a, j * .25, .75 + j * .25)), oj = eio(map(o, j * .2, .8 + j * .2));
      l.style.transform = `translate3d(0,${(motion ? (1 - aj) * 110 - oj * 110 : 0).toFixed(2)}%,0)`;
      l.style.opacity = (aj * (1 - oj)).toFixed(3);
    });
    const v = eout(map(a, .35, 1)) * (1 - eio(o));
    c.meta.forEach(m => { m.style.opacity = v.toFixed(3); m.style.transform = motion ? `translate3d(0,${((1 - v) * 14).toFixed(1)}px,0)` : ''; });
  });
}, s => {
  s.ph = $('#ph'); s.wrap = $('.phwrap', s.el); s.idx = 0;
  s.screens = $$('.screen', s.el);
  s.chaps = $$('.chap', s.el).map(el => ({ el, lines: $$('.ln>span', el), meta: [$('.cnum', el), $('.cdesc', el)] }));
});

/* 4 · inside */
scene('#inside', (p, s) => {
  s.panel.style.setProperty('--r', (motion ? eio(map(p, -.12, .08)) : map(p, -.1, 0)).toFixed(4));
  const idx = Math.min(5, Math.floor(map(p, .1, .97) * 6));
  if (idx !== s.idx) {
    s.idx = idx;
    s.items.forEach((el, i) => el.classList.toggle('on', i === idx));
    s.vis.forEach((el, i) => el.classList.toggle('on', i === idx));
    const n = String(idx + 1).padStart(2, '0');
    s.pidx.textContent = n; s.pcount.textContent = n;
  }
}, s => {
  s.panel = $('.panel', s.el); s.items = $$('.ft', s.el); s.vis = $$('.pv', s.el);
  s.pidx = $('.pidx', s.el); s.pcount = $('.pcount b', s.el); s.idx = 0;
});

/* 5 · before / after */
scene('#ba', (p, s) => {
  const w = motion ? 1 - eio(map(p, .16, .8)) : 1 - map(p, .38, .58);
  s.stage.style.setProperty('--w', w.toFixed(4));
  s.stage.style.setProperty('--edge', (w < .005 || w > .995) ? '1' : '0');
}, s => { s.stage = $('.ba-stage', s.el); });

/* 6 · process */
scene('#process', (p, s) => {
  s.el.style.setProperty('--f1', eio(map(p, -.1, .12)).toFixed(4));
  s.el.style.setProperty('--f2', eio(map(p, .02, .24)).toFixed(4));
  const k = eio(map(p, .28, .95));
  s.track.style.transform = `translate3d(${(k * s.max).toFixed(1)}px,0,0)`;
  s.meter.style.setProperty('--k', k.toFixed(4));
  const d = String(1 + Math.round(k * 6));
  if (d !== s.d) { s.d = d; s.day.textContent = d; }
}, s => {
  s.track = $('#track'); s.meter = $('.b-meter', s.el); s.day = $('#dayn');
  s.layout = () => { s.max = Math.max(0, s.track.scrollWidth - s.stick.clientWidth); };
});

/* 7 · work */
scene('#work', (p, s) => {
  const st = eout(map(p, -.18, .55));
  const drift = Math.max(0, p - .55);
  s.items.forEach(it => {
    const x = (1 - st) * it.dx, y = (1 - st) * it.dy;
    const r = lerp(it.r0, it.r1, st), sc = lerp(.55, 1, st);
    const dy = -drift * it.d * 55;
    it.el.style.transform = `translate3d(${x.toFixed(2)}vw,calc(${y.toFixed(2)}vh + ${dy.toFixed(1)}px),0) rotate(${r.toFixed(2)}deg) scale(${sc.toFixed(3)})`;
    it.el.style.opacity = map(st, 0, .35).toFixed(3);
  });
  s.title.style.setProperty('--ts', lerp(1.2, 1, eout(map(p, -.18, .45))).toFixed(4));
}, s => {
  s.title = $('.w-title', s.el);
  s.items = $$('.fl', s.el).map(el => ({ el, dx: +el.dataset.dx, dy: +el.dataset.dy, r0: +el.dataset.r0, r1: parseFloat(getComputedStyle(el).getPropertyValue('--r')) || 0, d: +el.dataset.d }));
});

/* ---------- loop ---------- */
let raf = 0, last = 0;
const bar = $('.prog');
function frame(now) {
  raf = 0;
  const dt = last ? Math.min(64, now - last) : 16.7; last = now;
  const k = motion ? 1 - Math.pow(1 - .15, dt / 16.7) : 1;
  const vh = innerHeight; let moving = false;
  for (const s of S) {
    if (!motion && s.flow) { s.fresh = true; continue; }
    const r = s.el.getBoundingClientRect();
    if (r.bottom < -vh * .25 || r.top > vh * 1.25) { s.fresh = true; continue; }
    const total = s.el.offsetHeight - s.stick.offsetHeight;
    const p = total > 0 ? clamp(-r.top / total, -1, 1) : 0;
    if (s.fresh) { s.v = p; s.fresh = false; }
    else { s.v += (p - s.v) * k; if (Math.abs(p - s.v) < .0003) s.v = p; else moving = true; }
    s.fn(s.v, s);
  }
  const dh = root.scrollHeight - vh;
  bar.style.setProperty('--sp', dh > 0 ? (scrollY / dh).toFixed(4) : '0');
  if (moving) raf = requestAnimationFrame(frame); else last = 0;
}
function kick() { if (!raf) raf = requestAnimationFrame(frame); }
function layout() { for (const s of S) if (s.layout) s.layout(); }
addEventListener('scroll', kick, { passive: true });
let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { layout(); for (const s of S) s.fresh = true; kick(); }, 120); });
mqDesk.addEventListener && mqDesk.addEventListener('change', () => { layout(); kick(); });

/* ---------- reveals & counters ---------- */
function count(b) {
  const to = +b.dataset.to; if (!to) return;
  const t0 = performance.now(), dur = 1100 + to * 18;
  const tick = now => { const t = clamp((now - t0) / dur); b.textContent = String(Math.round(eout(t) * to)); if (t < 1) requestAnimationFrame(tick); };
  b.textContent = '0'; requestAnimationFrame(tick);
}
const io = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  e.target.classList.add('in'); io.unobserve(e.target);
  const b = $('b[data-to]', e.target);
  if (b && motion) count(b);
}), { rootMargin: '0px 0px -10% 0px', threshold: .01 });
$$('[data-rv]').forEach(el => io.observe(el));
// keyboard users: reveal a section the moment focus lands inside it
document.addEventListener('focusin', e => { const r = e.target.closest && e.target.closest('[data-rv]'); if (r) r.classList.add('in'); });

/* ---------- menu ---------- */
safe(() => {
  const btn = $('#mbtn'), menu = $('#menu'), links = $$('a', menu);
  const open = (on, refocus = true) => {
    btn.setAttribute('aria-expanded', String(on));
    btn.setAttribute('aria-label', on ? 'סגירת התפריט' : 'תפריט');
    root.classList.toggle('menu-open', on);
    if (on) { menu.hidden = false; requestAnimationFrame(() => menu.classList.add('open')); setTimeout(() => links[0].focus(), 60); }
    else { menu.classList.remove('open'); menu.hidden = true; if (refocus) btn.focus(); }
  };
  btn.addEventListener('click', () => open(btn.getAttribute('aria-expanded') !== 'true'));
  links.forEach(a => a.addEventListener('click', () => { if (a.getAttribute('href').startsWith('#')) open(false, false); }));
  document.addEventListener('keydown', e => {
    if (menu.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); open(false); return; }
    if (e.key === 'Tab') {
      const f = [btn, ...links], i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });
});

/* ---------- pricing ---------- */
const CFG = { page: { n: 'דף עסק', p: 990 }, app: { n: 'אפליקציית תורים', p: 2490 }, brand: { n: 'מיתוג ואינסטגרם', p: 1490 }, care: { n: 'ליווי חודשי', p: 99 } };
const sel = new Set(['app']);
let cfgState = { items: ['app'], total: 2490, care: false };
function tweenNum(el, to) {
  const from = +(el.dataset.v || to); el.dataset.v = to;
  if (!motion || from === to) { el.textContent = ils(to); return; }
  const t0 = performance.now(), dur = 650;
  cancelAnimationFrame(el._r);
  const tick = now => { const t = clamp((now - t0) / dur); el.textContent = ils(lerp(from, to, eout(t))); if (t < 1) el._r = requestAnimationFrame(tick); };
  el._r = requestAnimationFrame(tick);
}
safe(() => {
  const lines = $('#lines'), total = $('#total'), promo = $('#promo'), live = $('#bill-live'), total2 = $('#total2');
  total.dataset.v = 2490; promo.dataset.v = 1740; total2.dataset.v = 2490;
  let lt;
  function calc(announce) {
    const items = ['page', 'app', 'brand'].filter(k => sel.has(k));
    const sub = items.reduce((a, k) => a + CFG[k].p, 0), bundle = sel.has('app') && sel.has('brand') ? 490 : 0, tot = sub - bundle;
    cfgState = { items, bundle, total: tot, care: sel.has('care') };
    let html = items.map(k => '<li><span>' + CFG[k].n + '</span><b>' + ils(CFG[k].p) + '</b></li>').join('');
    if (bundle) html += '<li class="sv"><span>חבילה מלאה · אפליקציה + מיתוג</span><b>−' + ils(bundle) + '</b></li>';
    if (sel.has('care')) html += '<li><span>ליווי חודשי</span><b>' + ils(CFG.care.p) + ' / חודש</b></li>';
    if (!items.length) html += '<li class="em"><span>הדליקו לפחות שירות אחד כדי לראות מחיר. ליווי חודשי מצטרף לכל חבילה.</span></li>';
    lines.innerHTML = html;
    const pr = Math.round(tot * .7 / 10) * 10;
    tweenNum(total, tot); tweenNum(promo, pr); tweenNum(total2, tot);
    if (announce) { clearTimeout(lt); lt = setTimeout(() => { live.textContent = 'סה״כ חד־פעמי ' + ils(tot) + ', במבצע השקה ' + ils(pr) + '.'; }, 400); }
  }
  $$('.plan').forEach(card => {
    const k = card.dataset.plan, b = $('.psw', card);
    const toggle = () => { sel.has(k) ? sel.delete(k) : sel.add(k); const on = sel.has(k); b.setAttribute('aria-pressed', String(on)); card.classList.toggle('on', on); calc(true); };
    b.addEventListener('click', e => { e.stopPropagation(); toggle(); });
    card.addEventListener('click', e => { if (e.target.closest('a,button')) return; toggle(); });
  });
  calc(false);
  $('#quote').addEventListener('click', () => prefill(true));
  // mobile: a small total bar while the cards are on screen and the summary is not
  const pb = $('#pbar2'), plans = $('.plans'), bill = $('#bill');
  let inPlans = false, inBill = false;
  const upd = () => pb.classList.toggle('show', inPlans && !inBill);
  new IntersectionObserver(es => es.forEach(e => { inPlans = e.isIntersecting; upd(); }), { rootMargin: '-25% 0px -25% 0px' }).observe(plans);
  new IntersectionObserver(es => es.forEach(e => { inBill = e.isIntersecting; upd(); }), { rootMargin: '0px 0px -10% 0px' }).observe(bill);
});

/* ---------- faq ---------- */
$$('.q button').forEach(b => b.addEventListener('click', () => {
  const q = b.closest('.q'), on = !q.classList.contains('open');
  q.classList.toggle('open', on); b.setAttribute('aria-expanded', String(on));
}));

/* ---------- contact form ---------- */
function goStep(n) {
  $('#s1').hidden = n !== 1; $('#s2').hidden = n !== 2;
  $('#stepl').textContent = 'שלב ' + n + ' מתוך 2';
  $('#pbar').style.setProperty('--p', n === 1 ? '50%' : '100%');
  replay($('#f'), 'swap');
  setTimeout(() => (n === 2 ? $('#fn') : $('input[name=svc]:checked')).focus({ preventScroll: true }), 300);
}
function prefill(fromCfg) {
  safe(() => {
    const { items = [], care, total } = cfgState;
    const pick = items.includes('app') && items.includes('brand') ? 'הכל ביחד' : items.includes('app') ? 'אפליקציית תורים' : items.includes('brand') ? 'מיתוג ואינסטגרם' : items.includes('page') ? 'דף עסק' : null;
    if (pick) { const r = $$('input[name=svc]').find(i => i.value === pick); if (r) r.checked = true; }
    if (fromCfg && items.length) {
      $('#fm').value = 'הרכבתי באתר: ' + items.map(k => CFG[k].n).join(' + ') + (care ? ' + ליווי חודשי' : '') + ' (בערך ' + ils(total) + ').';
      goStep(2);
    }
  });
}
safe(() => {
  $('#next').addEventListener('click', () => goStep(2));
  $('#back').addEventListener('click', () => goStep(1));
  const msg = () => $('#out').textContent;
  $('#f').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#fn').value.trim(), biz = $('#fb').value.trim();
    if (name.length < 2 || biz.length < 2) {
      $('#st').textContent = 'נא למלא שם ושם עסק כדי שנוכל לחזור אליכם.';
      const bad = $(name.length < 2 ? '#fn' : '#fb'); bad.focus(); bad.setAttribute('aria-invalid', 'true'); replay(bad, 'nudge'); return;
    }
    $('#fn').removeAttribute('aria-invalid'); $('#fb').removeAttribute('aria-invalid');
    const svc = $('input[name=svc]:checked').value, extra = $('#fm').value.trim();
    $('#out').textContent = 'היי EDON, אני ' + name + ' מ' + biz + '.\nמעניין אותי: ' + svc + '.' + (extra ? '\n' + extra : '');
    $('#done').hidden = false; replay($('#done'), 'swap');
    $('#st').textContent = 'ההודעה מוכנה. העתיקו, פתחו את הדיירקט והדביקו.';
    $('#done').scrollIntoView({ behavior: motion ? 'smooth' : 'auto', block: 'nearest' });
  });
  const copy = async () => {
    try { await navigator.clipboard.writeText(msg()); $('#st').textContent = 'הועתק. אפשר להדביק ולשלוח.'; }
    catch (err) { const r = document.createRange(); r.selectNodeContents($('#out')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); $('#st').textContent = 'סימנו את ההודעה. העתיקו ידנית (לחיצה ארוכה).'; }
  };
  $('#cp').addEventListener('click', copy);
  $('#openig').addEventListener('click', () => { copy(); });
});

/* ---------- magnetic buttons (desktop, full motion) ---------- */
if (FINE) $$('.mag').forEach(el => {
  el.addEventListener('pointermove', e => {
    if (!motion) return;
    const r = el.getBoundingClientRect();
    el.style.transform = `translate3d(${((e.clientX - r.left - r.width / 2) * .2).toFixed(1)}px,${((e.clientY - r.top - r.height / 2) * .3).toFixed(1)}px,0)`;
  });
  el.addEventListener('pointerleave', () => { el.style.transition = 'transform .6s cubic-bezier(.3,1.35,.4,1)'; el.style.transform = ''; setTimeout(() => { el.style.transition = ''; }, 600); });
});

/* ---------- start ---------- */
msw.setAttribute('aria-pressed', String(motion));
const start = () => { layout(); for (const s of S) s.fresh = true; kick(); };
if (document.fonts && document.fonts.ready) document.fonts.ready.then(start);
start();
})();
