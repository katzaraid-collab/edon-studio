/* EDON X · scroll engine */
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
const mqRM = matchMedia('(prefers-reduced-motion: reduce)');
const mqDesk = matchMedia('(min-width: 900px)');
const FINE = matchMedia('(hover:hover) and (pointer:fine)').matches;

/* ---------- motion preference ---------- */
const store = {
  get(k, s = localStorage) { try { return s.getItem(k); } catch (e) { return null; } },
  set(k, v, s = localStorage) { try { s.setItem(k, v); } catch (e) {} }
};
let motion = root.classList.contains('motion');
const msw = $('#msw');
function setMotion(on, save) {
  motion = on;
  root.classList.toggle('motion', on);
  msw.setAttribute('aria-pressed', String(on));
  if (save) store.set('edonx-motion', on ? 'full' : 'calm');
  for (const s of S) s.fresh = true;
  layout(); kick();
}
msw.addEventListener('click', () => { setMotion(!motion, true); hideNote(); });
mqRM.addEventListener && mqRM.addEventListener('change', e => { if (!store.get('edonx-motion')) setMotion(!e.matches, false); });

const note = $('#mnote');
function hideNote() { note.hidden = true; store.set('edonx-note', '1', sessionStorage); }
if (mqRM.matches && !store.get('edonx-motion') && !store.get('edonx-note', sessionStorage)) {
  setTimeout(() => { note.hidden = false; }, 1400);
}
$('#mn-on').addEventListener('click', () => { setMotion(true, true); hideNote(); });
$('#mn-off').addEventListener('click', () => { setMotion(false, true); hideNote(); });

/* ---------- scenes ---------- */
const S = [];
function scene(sel, fn, init) {
  const el = $(sel); if (!el) return;
  const s = { el, stick: $('.stick', el), fn, v: 0, fresh: true, flow: el.dataset.calm === 'flow' };
  if (init) init(s);
  S.push(s);
}

/* 1 · power */
scene('#power', (p, s) => {
  const el = s.el;
  const on = motion ? eio(map(p, .05, .4)) : (p > .12 ? 1 : 0);
  const m = motion ? eio(map(p, .3, .62)) : 1;
  el.style.setProperty('--on', on.toFixed(4));
  el.style.setProperty('--m', m.toFixed(4));
  el.style.setProperty('--cue', (1 - map(p, 0, .08)).toFixed(3));
  el.toggleAttribute('data-on', on > .55);
  s.words.forEach((w, i) => {
    const a = motion ? eout(map(p, .5 + i * .045, .68 + i * .045)) : map(p, .14 + i * .02, .3 + i * .02);
    w.style.setProperty('--a', a.toFixed(4));
  });
  el.style.setProperty('--b', (motion ? eout(map(p, .72, .9)) : map(p, .3, .45)).toFixed(4));
}, s => {
  s.words = $$('.hero-h .w', s.el);
  s.btn = $('#power-btn');
  s.btn.addEventListener('click', () => {
    const total = s.el.offsetHeight - s.stick.offsetHeight;
    const target = s.el.offsetTop + total * (motion ? .9 : .5);
    scrollTo({ top: target, behavior: motion ? 'smooth' : 'auto' });
  });
  s.layout = () => {
    const pw = s.btn; let y = 0, n = pw;
    while (n && n !== s.stick) { y += n.offsetTop; n = n.offsetParent; }
    const off = s.stick.clientHeight / 2 - (y + pw.offsetHeight / 2);
    s.el.style.setProperty('--off', off.toFixed(1) + 'px');
  };
});

/* 2 · the phone */
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
    const g = Math.abs(Math.sin((ry * Math.PI) / 180));
    s.ph.style.setProperty('--gl', (.45 + g * .55).toFixed(3));
    s.wrap.style.setProperty('--shs', (1 - lift * .12 + (1 - enter) * .5).toFixed(3));
    s.wrap.style.setProperty('--sho', (enter * (1 - ex * .5)).toFixed(3));
  } else {
    s.ph.style.transform = '';
    s.ph.style.opacity = map(p, -.12, .02).toFixed(3);
    s.wrap.style.setProperty('--sho', '1');
  }

  // which screen faces the viewer
  const idx = motion ? (p < .36 ? 0 : p < .66 ? 1 : 2) : (p < .34 ? 0 : p < .64 ? 1 : 2);
  if (idx !== s.idx) { s.idx = idx; s.screens.forEach((el, i) => el.classList.toggle('on', i === idx)); }
  s.screens[1].classList.toggle('picked', p > .49);
  s.screens[1].style.setProperty('--nt', (motion ? eout(map(p, .52, .57)) : (p > .52 ? 1 : 0)).toFixed(3));
  s.screens[2].style.setProperty('--g', (motion ? eout(map(p, .7, .8)) : 1).toFixed(3));

  // headlines
  const win = [[map(p, -.15, .04), map(p, .3, .36)], [map(p, .37, .47), map(p, .6, .66)], [map(p, .67, .77), map(p, .96, 1.01)]];
  if (!motion) { win[0] = [1, map(p, .3, .34)]; win[1] = [map(p, .34, .38), map(p, .6, .64)]; win[2] = [map(p, .64, .68), 0]; }
  s.chaps.forEach((c, i) => {
    const [a, o] = win[i];
    c.lines.forEach((l, j) => {
      const aj = eout(map(a, j * .25, .75 + j * .25)), oj = eio(map(o, j * .2, .8 + j * .2));
      const y = motion ? ((1 - aj) * 110 - oj * 110) : 0;
      l.style.transform = `translate3d(0,${y.toFixed(2)}%,0)`;
      l.style.opacity = (aj * (1 - oj)).toFixed(3);
    });
    const v = eout(map(a, .35, 1)) * (1 - eio(o));
    c.meta.forEach(m => { m.style.opacity = v.toFixed(3); m.style.transform = motion ? `translate3d(0,${((1 - v) * 14).toFixed(1)}px,0)` : ''; });
    c.el.toggleAttribute('data-vis', a * (1 - o) > .5);
  });
}, s => {
  s.ph = $('#ph'); s.wrap = $('.phwrap', s.el); s.idx = 0;
  s.screens = $$('.screen', s.el);
  s.chaps = $$('.chap', s.el).map(el => ({ el, lines: $$('.ln>span', el), meta: [$('.cnum', el), $('.cdesc', el)] }));
});

/* 3 · inside */
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

/* 4 · process */
scene('#process', (p, s) => {
  s.el.style.setProperty('--f1', eio(map(p, -.1, .12)).toFixed(4));
  s.el.style.setProperty('--f2', eio(map(p, .02, .24)).toFixed(4));
  const k = eio(map(p, .28, .95));
  s.track.style.transform = `translate3d(${(k * s.max).toFixed(1)}px,0,0)`;
  s.meter.style.setProperty('--k', k.toFixed(4));
  const d = String(1 + Math.round(k * 6)).padStart(2, '0');
  if (d !== s.d) { s.d = d; s.day.textContent = d; }
}, s => {
  s.track = $('#track'); s.meter = $('.b-meter', s.el); s.day = $('#dayn');
  s.layout = () => { s.track.style.transform = ''; s.max = Math.max(0, s.track.scrollWidth - s.stick.clientWidth); };
});

/* 5 · work */
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
  s.title.style.setProperty('--ts', lerp(1.22, 1, eout(map(p, -.18, .45))).toFixed(4));
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
  const dh = document.documentElement.scrollHeight - vh;
  bar.style.setProperty('--sp', dh > 0 ? (scrollY / dh).toFixed(4) : '0');
  if (moving) raf = requestAnimationFrame(frame); else last = 0;
}
function kick() { if (!raf) raf = requestAnimationFrame(frame); }
function layout() { for (const s of S) if (s.layout) s.layout(); }
addEventListener('scroll', kick, { passive: true });
let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { layout(); for (const s of S) s.fresh = true; kick(); }, 120); });
mqDesk.addEventListener && mqDesk.addEventListener('change', () => { layout(); kick(); });

/* ---------- reveals & counters ---------- */
const io = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  e.target.classList.add('in'); io.unobserve(e.target);
  const b = $('b[data-to]', e.target);
  if (b && motion) count(b);
}), { rootMargin: '0px 0px -12% 0px', threshold: .01 });
$$('[data-rv]').forEach(el => io.observe(el));
function count(b) {
  const to = +b.dataset.to; if (!to) return;
  const t0 = performance.now(), dur = 1100 + to * 18;
  const tick = now => { const t = clamp((now - t0) / dur); b.textContent = String(Math.round(eout(t) * to)); if (t < 1) requestAnimationFrame(tick); };
  b.textContent = '0'; requestAnimationFrame(tick);
}

/* ---------- magnetic buttons (desktop, full motion) ---------- */
if (FINE) $$('.mag').forEach(el => {
  el.addEventListener('pointermove', e => {
    if (!motion) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left - r.width / 2) * .22, y = (e.clientY - r.top - r.height / 2) * .32;
    el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
  });
  el.addEventListener('pointerleave', () => { el.style.transition = 'transform .5s cubic-bezier(.3,1.4,.4,1)'; el.style.transform = ''; setTimeout(() => { el.style.transition = ''; }, 500); });
});

/* ---------- start ---------- */
msw.setAttribute('aria-pressed', String(motion));
const start = () => { layout(); for (const s of S) s.fresh = true; kick(); };
if (document.fonts && document.fonts.ready) document.fonts.ready.then(start);
start();
})();
