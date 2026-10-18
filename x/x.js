/* EDON X — "משמרת לילה". One IIFE, one safe() per feature. Never throws without THREE, WebGL or gsap. */
(() => {
'use strict';
const $ = id => document.getElementById(id), $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const H = document.documentElement;
const RM = H.classList.contains('rm') || matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = matchMedia('(hover:hover) and (pointer:fine)').matches;
const TOUCH = !FINE;
const SEEN = H.classList.contains('seen');
const GS = typeof gsap !== 'undefined';
const ST = GS && typeof ScrollTrigger !== 'undefined';
if (!GS) H.classList.add('nogs');
if (ST) { try { gsap.registerPlugin(ScrollTrigger); ScrollTrigger.config({ ignoreMobileResize: true }); } catch (e) {} }
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const safe = fn => { try { fn(); } catch (e) { console.warn('[edon-x]', e); } };
const GLYPHS = 'אבגדהוזחטיכלמנסעפצקרשת0123456789';
const ils = n => '₪' + n.toLocaleString('en-US');
const easeOut = k => 1 - Math.pow(1 - k, 3);
const easeBack = k => { const c = .7, c3 = c + 1; return 1 + c3 * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
const expoOut = k => k >= 1 ? 1 : 1 - Math.pow(2, -10 * k);
const replay = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
const SCRUB = TOUCH ? true : .6;
const ARR_BACK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true" style="width:14px;height:14px;vertical-align:-2px;margin-inline-end:6px"><path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
// tiny bus between features (menu ↔ scene loop, demo ↔ scene)
const X = { hold: {}, onHold: null, setHold(k, v) { X.hold[k] = !!v; if (X.onHold) X.onHold(); }, held() { return Object.values(X.hold).some(Boolean); } };
// enter-once observer (IO: reliable for elements already passed, hash loads, back-scroll)
function onEnter(target, cb, opts = {}) {
  const els = typeof target === 'string' ? $$(target) : [].concat(target).filter(Boolean);
  if (!els.length) return;
  const io = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; io.unobserve(e.target); cb(e.target); }), { threshold: opts.threshold || .08, rootMargin: opts.margin || '0px 0px -8% 0px' });
  els.forEach(el => io.observe(el));
}

/* ---------- text scramble (ported) ---------- */
function scramble(el, text, dur = 700) {
  return new Promise(res => {
    if (RM) { el.textContent = text; return res(); }
    const from = el.textContent, len = Math.max(from.length, text.length);
    const q = Array.from({ length: len }, (_, i) => ({ to: text[i] || '', from: from[i] || '', s: Math.random() * dur * .35, e: dur * .45 + Math.random() * dur * .55 }));
    const t0 = performance.now();
    const tick = now => {
      const t = now - t0; let out = '', done = 0;
      for (const c of q) {
        if (t >= c.e) { out += c.to; done++; }
        else if (t >= c.s) out += (c.to === ' ' || c.to === '') ? c.to : GLYPHS[Math.random() * GLYPHS.length | 0];
        else out += c.from;
      }
      el.textContent = out;
      done < len ? requestAnimationFrame(tick) : res();
    };
    requestAnimationFrame(tick);
  });
}
function swapWord(el, text, dur) {
  if (RM) { el.textContent = text; return Promise.resolve(); }
  const old = el.textContent, w0 = el.offsetWidth;
  el.textContent = text; const w1 = el.offsetWidth; el.textContent = old;
  el.style.width = w0 + 'px'; el.style.transition = 'width ' + dur + 'ms var(--e-out)';
  requestAnimationFrame(() => { el.style.width = w1 + 'px'; });
  return scramble(el, text, dur).then(() => { el.style.width = ''; el.style.transition = ''; });
}

/* ---------- audio click (user-initiated only) ---------- */
function click(freq = 180) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ac = click.ac || (click.ac = new AC());
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'square'; o.frequency.setValueAtTime(freq, ac.currentTime); o.frequency.exponentialRampToValueAtTime(60, ac.currentTime + .08);
    g.gain.setValueAtTime(.08, ac.currentTime); g.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + .09);
    o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + .1);
  } catch (e) {}
}
function countUp(el) {
  if (el.dataset.done) return; el.dataset.done = 1;
  const to = +el.dataset.count; if (RM || !isFinite(to)) { el.textContent = to; return; }
  const t0 = performance.now(), dur = 1000 + to * 4;
  const tick = now => { const k = clamp((now - t0) / dur, 0, 1); el.textContent = Math.max(0, Math.round(to * easeBack(k))); if (k < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}
// odometer: one rolling strip per digit; assistive tech reads the plain value in .sr
function odometer(el) {
  let last = null;
  const shape = s => s.replace(/\d/g, '0');
  const build = s => { el.classList.add('od'); el.innerHTML = '<span class="sr"></span><span class="strips" aria-hidden="true">' + Array.from(s).map((ch, i) => /\d/.test(ch) ? '<span class="dg" style="--i:' + i + ';--d:' + ch + '"><span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span><span>9</span></span>' : '<span class="ch">' + ch + '</span>').join('') + '</span>'; };
  return v => {
    const s = ils(v); if (RM) { el.textContent = s; return; }
    const digits = s.replace(/\D/g, '');
    if (last === null) { build(s); el.querySelector('.sr').textContent = s; last = s; return; }
    if (shape(last) !== shape(s)) { build(s); el.querySelectorAll('.dg').forEach(d => d.style.setProperty('--d', 0)); void el.offsetWidth; }
    el.querySelectorAll('.dg').forEach((d, i) => d.style.setProperty('--d', digits[i]));
    el.querySelector('.sr').textContent = s;
    last = s;
  };
}

/* ---------- preloader: 19:00 → 02:00, then the shutters split ---------- */
let heroStarted = false;
safe(() => {
  if (RM) { startHero(); return; }
  const pre = document.createElement('div'); pre.id = 'xpre'; pre.setAttribute('aria-hidden', 'true');
  if (SEEN) {
    pre.innerHTML = '<div class="half t" style="height:100%"><div class="lay"></div></div>';
    document.body.appendChild(pre); H.classList.add('ready'); startHero();
    requestAnimationFrame(() => requestAnimationFrame(() => { pre.classList.add('fade'); setTimeout(() => pre.remove(), 320); }));
    return;
  }
  const PC = Math.max(1, Math.floor((innerWidth + 6) / 50)), PN = Math.min(300, PC * Math.max(3, Math.floor((innerHeight + 6) / 50))), PR = Math.ceil(PN / PC);
  const lay = '<div class="lay"><div class="cells">' + '<i></i>'.repeat(PN) + '</div><span class="lbl s mono">EDON X</span><span class="lbl e mono st">STATUS · CLOSED</span><div class="clock">19:00</div><i class="hair"></i><span class="he">העסק סגר ב־19:00</span></div>';
  pre.innerHTML = '<div class="half t">' + lay + '</div><div class="half b">' + lay + '</div><i class="fl"></i>';
  document.body.appendChild(pre);
  const clocks = $$('.clock', pre), hairs = $$('.hair', pre), sts = $$('.st', pre), hes = $$('.he', pre), cells = $$('.cells', pre).map(c => $$('i', c)), fl = pre.querySelector('.fl');
  const t0 = performance.now();
  requestAnimationFrame(() => { clocks.forEach(c => c.classList.add('go')); hairs.forEach(h => h.classList.add('go')); });
  const blink = (i, at) => setTimeout(() => { cells.forEach(cs => cs[i] && cs[i].classList.add('on')); setTimeout(() => cells.forEach(cs => cs[i] && cs[i].classList.remove('on')), 160); }, at);
  blink(PC + 2, 260); blink(Math.max(0, (PR - 2) * PC + PC - 3), 470);
  const fmt = m => String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  let done = false;
  const snap = () => {
    if (done) return; done = true;
    clocks.forEach(c => c.textContent = '02:00'); sts.forEach(s => s.textContent = 'STATUS · OPEN'); hes.forEach(h => h.textContent = 'האפליקציה פתוחה');
    H.classList.add('ready'); fl.classList.add('go');
    setTimeout(() => { pre.classList.add('split'); startHero(); }, 20);
    setTimeout(() => pre.remove(), 480);
  };
  const tick = now => {
    const t = now - t0;
    if (t >= 120) { const m = 19 * 60 + Math.round(420 * expoOut(clamp((t - 120) / 560, 0, 1))); clocks.forEach(c => c.textContent = fmt(m)); }
    if (t < 680) requestAnimationFrame(tick); else snap();
  };
  requestAnimationFrame(tick);
  setTimeout(snap, 700); // hard ceiling, whatever the frame rate
});

/* ---------- hero: masks → decode, rotating word, counters, recede on scroll ---------- */
function startHero() {
  if (heroStarted) return; heroStarted = true;
  safe(() => {
    const lines = $$('.hero h1 .ln > span'), hs = $$('.hero [data-h]'), inner = document.querySelector('.screen1 .inner');
    if (GS && !RM) {
      gsap.fromTo(inner, { scale: 1.04 }, { scale: 1, duration: .9, ease: 'power3.out', clearProps: 'scale' });
      gsap.to(lines, { y: 0, duration: .7, ease: 'power4.out', stagger: .09, delay: .02 });
      gsap.fromTo(hs, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: .7, ease: 'power4.out', stagger: .08, delay: .2 });
    } else { lines.forEach(l => { l.style.transform = 'none'; }); hs.forEach(h => { h.style.opacity = 1; }); }
  });
  safe(() => {
    const l1 = $('l1'), rot = $('rot');
    const t1 = l1.textContent;
    setTimeout(() => scramble(l1, t1, 800), 380);
    const words = ['ב־2 בלילה', 'כשאתם ישנים', 'באמצע תספורת', 'במוצאי שבת', 'בלי שיחת טלפון'];
    let i = 0;
    setTimeout(() => scramble(rot, words[0], 900), 560);
    if (!RM) setInterval(() => { if (document.hidden) return; i = (i + 1) % words.length; swapWord(rot, words[i], 650); }, 2800);
  });
  safe(() => setTimeout(() => $$('.hero [data-count]').forEach(countUp), 500));
}
safe(() => {
  if (!ST || RM) return;
  const inner = document.querySelector('.screen1 .inner'); if (!inner) return;
  const desk = innerWidth >= 900;
  gsap.to(inner, desk ? { z: -320, opacity: .2, ease: 'none', scrollTrigger: { trigger: '.screen1', start: 'top top', end: 'bottom top', scrub: SCRUB } }
                       : { scale: .92, opacity: .25, ease: 'none', scrollTrigger: { trigger: '.screen1', start: 'top top', end: 'bottom top', scrub: SCRUB } });
});

/* ---------- clock + header + progress + nav highlight ---------- */
safe(() => {
  const tick = () => { const t = new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }); ['clock2', 'sbt'].forEach(id => { const el = $(id); if (el) el.textContent = t; }); };
  tick(); setInterval(tick, 20000);
  const hdr = $('hdr'), prog = $('prog');
  let raf = 0;
  const onScroll = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; const y = scrollY; hdr.classList.toggle('sc', y > 20); const max = H.scrollHeight - innerHeight; prog.style.transform = 'scaleX(' + (max > 0 ? y / max : 0) + ')'; }); };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  const links = $$('#hdr nav a'), secs = links.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  const spy = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) links.forEach(a => a.classList.toggle('cur', a.getAttribute('href') === '#' + e.target.id)); }), { rootMargin: '-40% 0px -55% 0px' });
  secs.forEach(s => spy.observe(s));
});

/* ---------- menu as a scene: masks, breathing width, cells, focus trap ---------- */
safe(() => {
  const b = $('burger'), m = $('menu'), cellsBox = m.querySelector('.cells');
  cellsBox.innerHTML = '<i class="cell"></i>'.repeat(63);
  const cells = $$('.cell', cellsBox); let timer = 0, open = false;
  const focusables = () => $$('a[href],button:not([disabled])', m);
  const close = () => { if (!open) return; open = false; H.classList.remove('menu'); b.setAttribute('aria-expanded', 'false'); m.setAttribute('aria-hidden', 'true'); clearInterval(timer); X.setHold('menu', false); b.focus({ preventScroll: true }); };
  const show = () => {
    open = true; H.classList.add('menu'); b.setAttribute('aria-expanded', 'true'); m.setAttribute('aria-hidden', 'false'); X.setHold('menu', true); click(220);
    cells.forEach(c => c.classList.remove('lit'));
    if (!RM) timer = setInterval(() => { const c = cells[Math.random() * cells.length | 0]; c.classList.add('lit'); setTimeout(() => c.classList.remove('lit'), 900); }, 1200);
    setTimeout(() => { const f = focusables()[0]; if (f) f.focus({ preventScroll: true }); }, RM ? 0 : 420);
  };
  b.addEventListener('click', () => open ? close() : show());
  $$('a', m).forEach(a => a.addEventListener('click', close));
  addEventListener('keydown', e => {
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    const f = focusables(); if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
});

/* ---------- calm toggle (html.rm + localStorage) ---------- */
safe(() => {
  const on = H.classList.contains('rm');
  $$('.calm').forEach(btn => {
    btn.setAttribute('aria-pressed', String(on));
    btn.addEventListener('click', () => { try { localStorage.setItem('edon-x-calm', on ? '0' : '1'); } catch (e) {} location.reload(); });
  });
});

/* ---------- reveals: [data-x] batch, [data-reveal] counters, process --prog ---------- */
safe(() => {
  const xs = $$('[data-x]');
  if (!RM && GS) {
    const io = new IntersectionObserver(es => {
      const els = es.filter(e => e.isIntersecting).map(e => { io.unobserve(e.target); return e.target; });
      if (els.length) gsap.fromTo(els, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: .7, ease: 'power4.out', stagger: .07, overwrite: true });
    }, { rootMargin: '0px 0px -6% 0px', threshold: .04 });
    xs.forEach(el => io.observe(el));
  } else xs.forEach(el => { el.style.opacity = 1; });
  const rio = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('on'); rio.unobserve(e.target);
    $$('[data-count]', e.target).forEach(countUp);
    if (e.target.id === 'hours') { const n = document.querySelector('.nums'); if (n && !n.classList.contains('on')) { rio.unobserve(n); setTimeout(() => { n.classList.add('on'); $$('[data-count]', n).forEach(countUp); }, RM ? 0 : 1100); } }
  }), { threshold: .12, rootMargin: '0px 0px -8% 0px' });
  $$('.hours .hrow').forEach(t => $$('i', t).forEach((c, i) => c.style.setProperty('--i', i)));
  $$('[data-reveal]').forEach(el => rio.observe(el));
  const proc = $('process'), steps = $$('#steps li');
  let raf = 0;
  const upd = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; const r = proc.getBoundingClientRect(); const p = clamp((innerHeight * .8 - r.top - 120) / (r.height - 120), 0, 1); proc.style.setProperty('--prog', p.toFixed(3)); steps.forEach((li, i) => li.classList.toggle('lit', p >= (i + .5) / steps.length - .12)); }); };
  addEventListener('scroll', upd, { passive: true }); addEventListener('resize', upd); upd();
  if (RM) { proc.style.setProperty('--prog', '1'); steps.forEach(li => li.classList.add('lit')); }
});

/* ---------- type that powers on: h2 letters from wdth 62.5 / wght 300 to 75 / 900 ---------- */
safe(() => {
  $$('h2.split').forEach(h => {
    const text = h.textContent.trim(); h.dataset.t = text; h.setAttribute('aria-label', text);
    if (RM || !GS) return;
    const phone = innerWidth < 700; let n = 0; const MAX = 14;
    const frag = document.createDocumentFragment();
    text.split(/(\s+)/).forEach((part, pi) => {
      if (!part) return;
      if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
      const w = document.createElement('span'); w.className = 'wd'; w.setAttribute('aria-hidden', 'true');
      const anim = !phone || pi === 0;
      for (const ch of part) {
        if (anim && n < MAX) { const s = document.createElement('span'); s.className = 'ch'; s.textContent = ch; s.style.setProperty('--w', '62.5'); s.style.setProperty('--g', '300'); w.appendChild(s); n++; }
        else w.appendChild(document.createTextNode(ch));
      }
      frag.appendChild(w);
    });
    h.textContent = ''; h.appendChild(frag);
    const wrap = document.createElement('div'); wrap.className = 'h2w'; h.parentNode.insertBefore(wrap, h); wrap.appendChild(h);
    gsap.set(h, { yPercent: 110 });
    onEnter(wrap, () => {
      gsap.to(h, { yPercent: 0, duration: .7, ease: 'power4.out' });
      gsap.to($$('.ch', h), { '--w': 75, '--g': 900, duration: .7, ease: 'power2.out', stagger: .028, delay: .05 });
      setTimeout(() => { h.classList.add('hit'); setTimeout(() => h.classList.remove('hit'), 600); }, 700);
    }, { threshold: .2, margin: '0px 0px -10% 0px' });
  });
});

/* ---------- rail: velocity-aware marquee (ported) ---------- */
safe(() => {
  const row = document.querySelector('.tick .row'); if (!row || RM) return;
  row.classList.add('js');
  let x = 0, half = 0, vel = 0, last = scrollY, lt = performance.now(), vis = false;
  const measure = () => { half = row.scrollWidth / 2; }; measure(); addEventListener('resize', measure);
  new IntersectionObserver(es => es.forEach(e => { vis = e.isIntersecting; })).observe(row.parentElement);
  addEventListener('scroll', () => { const now = performance.now(), dt = Math.max(16, now - lt); vel = vel * .5 + ((scrollY - last) / dt) * 8; last = scrollY; lt = now; }, { passive: true });
  (function loop() {
    if (vis && half && !document.hidden) { vel *= .94; x -= .9 + clamp(Math.abs(vel), 0, 40) * .12; if (x <= -half) x += half; row.style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,0)'; }
    requestAnimationFrame(loop);
  })();
});

/* ---------- live demo: four business types, one booking engine (ported) ---------- */
safe(() => {
  const body = $('appBody'), toast = $('toast'), owner = $('owner'), cnt = $('cnt'), olist = $('olist'), stage = $('demo'), dsw = $('dsw'), scr = document.querySelector('.dev .scr');
  const DN = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const today = new Date(); const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(today); d.setDate(today.getDate() + i); return d; });
  const nowMin = today.getHours() * 60 + today.getMinutes();
  const toMin = t => +t.slice(0, 2) * 60 + +t.slice(3);
  const toT = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  const past = (di, t) => di === 0 && toMin(t) <= nowMin + 30;
  const openDay = di => days[di].getDay() !== 6;
  const dayName = di => di === 0 ? 'היום' : di === 1 ? 'מחר' : 'יום ' + DN[days[di].getDay()];
  const grid = (a, b, step) => { const out = []; for (let m = toMin(a); m + step <= toMin(b) + 1; m += step) out.push(toT(m)); return out; };
  const hash = s => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
  const BELL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>';
  const OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M6.5 6.5l11 11"/></svg>';

  // one config per business type; the engine below is shared
  const DEMOS = [
    { key: 'barber', chip: '✂️ ברברשופ', biz: 'ברברשופ', bizForm: 'מספרה / ברברשופ', name: 'ברברשופ אלון', sub: 'פתוח עכשיו · סוגר ב־19:00', letter: 'א', acc: '#C8FF2E', accFg: '#0B0B10', rgb: '200,255,46',
      services: [{ n: 'תספורת', d: 35, p: 80, i: '✂️' }, { n: 'עיצוב זקן', d: 20, p: 40, i: '🪒' }, { n: 'תספורת + זקן', d: 50, p: 110, i: '🔥' }, { n: 'תספורת ילד', d: 25, p: 60, i: '🧒' }],
      extra: { kind: 'staff', title: 'אצל מי?', opts: [{ n: 'אלון', s: 'ספר ראשי · 12 שנה', i: 'א' }, { n: 'דניאל', s: 'ספר · מתמחה בפייד', i: 'ד' }] },
      slots: grid('09:00', '19:00', 40), seats: [{ n: 'דני', s: 'תספורת אצל אלון', t: '14:20' }, { n: 'רועי', s: 'עיצוב זקן אצל דניאל', t: '13:40' }] },
    { key: 'wash', chip: '🚗 שטיפת רכב', biz: 'שטיפת רכב', bizForm: 'שטיפת רכב / דיטיילינג', name: 'שטיפה ודיטיילינג רועי', sub: 'פתוח עכשיו · סוגר ב־17:30', letter: 'ר', acc: '#F2C14E', accFg: '#141008', rgb: '242,193,78',
      services: [{ n: 'שטיפה חיצונית', d: 30, p: 60, i: '🫧' }, { n: 'פנים + חוץ', d: 60, p: 140, i: '✨' }, { n: 'פוליש והגנה', d: 120, p: 450, i: '💎' }],
      extra: { kind: 'vehicle', title: 'איזה רכב?', opts: [{ n: 'פרטי', s: 'עד 5 מקומות', add: 0, addMin: 0, i: '🚗' }, { n: 'ג׳יפ / SUV', s: '+10 דק׳ לטיפול', add: 20, addMin: 10, i: '🚙' }, { n: 'מסחרי', s: '+15 דק׳ לטיפול', add: 40, addMin: 15, i: '🚐' }] },
      slots: grid('08:00', '17:30', 30), seats: [{ n: 'מיכל', s: 'פנים + חוץ', t: '12:30' }, { n: 'יוסי', s: 'שטיפה חיצונית', t: '12:00' }] },
    { key: 'nails', chip: '💅 ציפורניים', biz: 'סטודיו ציפורניים', bizForm: 'קוסמטיקה / ציפורניים', name: 'סטודיו מאיה', sub: 'פתוח עכשיו · סוגר ב־20:00', letter: 'מ', acc: '#FF7AB6', accFg: '#1A0812', rgb: '255,122,182',
      services: [{ n: 'לק ג׳ל', d: 45, p: 120, i: '💅' }, { n: 'בניית ציפורניים', d: 90, p: 220, i: '✨' }, { n: 'פדיקור', d: 60, p: 150, i: '🦶' }],
      extra: { kind: 'design', title: 'בוחרים צבע וסגנון', colors: ['#FF7AB6', '#C8102E', '#F4E4D6', '#2B2B2B', '#7FB7FF', '#B8F28B'], styles: ['קלאסי', 'צרפתי', 'אומברה'] },
      slots: grid('10:00', '20:00', 45), seats: [{ n: 'נועה', s: 'לק ג׳ל', t: '13:30' }, { n: 'שיר', s: 'פדיקור', t: '12:15' }] },
    { key: 'fit', chip: '🏋️ סטודיו כושר', biz: 'סטודיו כושר', bizForm: 'מאמן / סטודיו לכושר', name: 'סטודיו FIT', sub: 'שיעורים קבוצתיים · מקומות מוגבלים', letter: 'F', acc: '#5EF2FF', accFg: '#06161A', rgb: '94,242,255',
      services: [{ n: 'יוגה', d: 60, p: 45, i: '🧘', times: ['07:00', '19:00'], cap: 8 }, { n: 'פילאטיס מכשירים', d: 55, p: 70, i: '🤸', times: ['09:00', '17:00'], cap: 6 }, { n: 'HIIT', d: 45, p: 50, i: '🔥', times: ['18:00', '20:00'], cap: 12 }],
      classes: true, seats: [{ n: 'עדי', s: 'HIIT 18:00', t: '18:00' }, { n: 'תום', s: 'יוגה 07:00', t: '07:00' }] },
  ];

  const S = {};
  DEMOS.forEach(D => {
    const s = S[D.key] = { seeded: new Set(), taken: new Set(), caps: new Map(), userRev: {}, userBk: {}, list: D.seats.map(x => ({ ...x, cls: '' })), step: 0, sv: null, ex: null, slot: null, name: '', color: 0, style: 0, booking: null };
    days.forEach((d, di) => {
      if (D.classes) D.services.forEach((v, vi) => v.times.forEach(t => { const h = hash(D.key + di + vi + t); s.caps.set(di + '-' + vi + '-' + t, h % 7 === 0 ? 0 : 1 + h % (v.cap - 1)); }));
      else D.slots.forEach(t => { if (hash(D.key + di + t) % 100 < 34) { s.seeded.add(di + '-' + t); s.taken.add(di + '-' + t); } });
    });
    s.di = days.findIndex((d, i) => openDay(i) && (i > 0 || nowMin < 16 * 60)); if (s.di < 0) s.di = 1;
  });
  let cur = DEMOS[0], s = S[cur.key], setRev = null;
  const stepsOf = D => ['svc'].concat(D.extra ? ['extra'] : []).concat(['when', 'confirm', 'done', 'cancelled']);
  const idx = name => stepsOf(cur).indexOf(name);
  const stepOf = D => toMin(D.slots[1]) - toMin(D.slots[0]);
  const exOpt = () => (cur.extra && cur.extra.opts && s.ex != null) ? cur.extra.opts[s.ex] : null;
  const curSvc = () => cur.services[s.sv];
  const curDur = () => curSvc().d + ((exOpt() || {}).addMin || 0);
  const curPrice = () => curSvc().p + ((exOpt() || {}).add || 0);
  const covered = (D, i, dur) => { const n = Math.max(1, Math.ceil(dur / stepOf(D))); return i + n > D.slots.length ? null : D.slots.slice(i, i + n); };
  const freeAt = (di, i) => { const c = covered(cur, i, curDur()); return !!c && !past(di, cur.slots[i]) && c.every(t => !s.taken.has(di + '-' + t)); };
  const crumbs = () => { const st = stepsOf(cur), n = st.indexOf('confirm') + 1; return '<div class="crumbs">' + Array.from({ length: n }, (_, i) => '<i class="' + (i <= s.step ? 'on' : '') + '"></i>').join('') + '</div>'; };
  const dayStrip = () => '<div class="days">' + days.map((d, i) => '<button class="day ' + (i === s.di ? 'on' : '') + (openDay(i) ? '' : ' x') + '" type="button" data-di="' + i + '" ' + (openDay(i) ? '' : 'disabled') + '><span>' + (i < 2 ? dayName(i) : DN[d.getDay()]) + '</span><b>' + d.getDate() + '</b></button>').join('') + '</div>';
  const BACK = '<button class="back" type="button">' + ARR_BACK + ' חזרה</button>';

  let navT = 0, pend = '';
  function nav(step, dir) {
    s.step = step;
    if (RM) { render(); return; }
    clearTimeout(navT); body.classList.remove('out-f', 'out-b'); body.classList.add(dir > 0 ? 'out-f' : 'out-b');
    navT = setTimeout(() => { body.classList.remove('out-f', 'out-b'); pend = dir > 0 ? ' in-f' : ' in-b'; render(); }, 150);
  }
  function render() {
    const D = cur, kind = stepsOf(D)[s.step]; let html = '';
    if (kind === 'svc') {
      html = crumbs() + '<h4>' + (D.classes ? 'בחרו שיעור' : 'בחרו שירות') + '</h4>' + D.services.map((v, i) => '<button class="row" type="button" data-sv="' + i + '"><span class="ic">' + v.i + '</span><div><b>' + v.n + '</b><small>' + v.d + ' דק׳' + (D.classes ? ' · ' + v.times.join(' / ') : '') + '</small></div><span class="pr">₪' + v.p + '</span></button>').join('');
    } else if (kind === 'extra') {
      const Xx = D.extra;
      if (Xx.kind === 'design') {
        html = crumbs() + BACK + '<h4>' + Xx.title + '</h4><div class="sw">' + Xx.colors.map((c, i) => '<button type="button" class="swb" data-c="' + i + '" style="--c:' + c + '" aria-pressed="' + (i === s.color) + '" aria-label="צבע ' + (i + 1) + '"></button>').join('') + '</div><div class="styles">' + Xx.styles.map((n, i) => '<button type="button" class="stl" data-s="' + i + '" aria-pressed="' + (i === s.style) + '">' + n + '</button>').join('') + '</div><div class="nails ' + ['', 'fr', 'om'][s.style] + '" style="--c:' + Xx.colors[s.color] + '" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div><button class="cta" type="button" id="exgo">המשך לבחירת מועד</button>';
      } else {
        html = crumbs() + BACK + '<h4>' + Xx.title + '</h4>' + Xx.opts.map((o, i) => '<button class="row" type="button" data-ex="' + i + '"><span class="ic' + (Xx.kind === 'staff' ? ' av2' : '') + '">' + o.i + '</span><div><b>' + o.n + '</b><small>' + o.s + '</small></div>' + (o.add ? '<span class="pr">+₪' + o.add + '</span>' : '') + '</button>').join('');
      }
    } else if (kind === 'when') {
      if (D.classes) {
        const v = curSvc();
        html = crumbs() + BACK + '<h4>מתי מתאים לכם?</h4>' + dayStrip() + '<div class="cls">' + v.times.map(t => { const rem = s.caps.get(s.di + '-' + s.sv + '-' + t), x = rem === 0 || past(s.di, t); return '<button class="row' + (x ? ' x' : '') + '" type="button" data-t="' + t + '" ' + (x ? 'disabled' : '') + '><span class="ic tm">' + t + '</span><div><b>' + v.n + '</b><small>' + v.d + ' דק׳ · ' + (rem === 0 ? 'אין מקום' : 'נשארו ' + rem + ' מקומות') + '</small></div><span class="capc' + (rem === 0 ? ' full' : rem <= 3 ? ' low' : '') + '">' + (rem === 0 ? 'מלא' : rem) + '</span></button>'; }).join('') + '</div><p class="hint">שיעור מלא נסגר לבד. אף אחד לא נרשם מעבר למקומות.</p>';
      } else {
        const n = Math.ceil(curDur() / stepOf(D));
        html = crumbs() + BACK + '<h4>בחרו יום ושעה</h4>' + dayStrip() + (n > 1 ? '<p class="hint">' + curSvc().n + ' לוקח ' + curDur() + ' דק׳, אז הוא תופס ' + n + ' חלונות ברצף. שעות שלא מספיקות כבר אפורות.</p>' : '') + '<div class="slots">' + D.slots.map((t, i) => { const ok = freeAt(s.di, i); return '<button class="slot' + (ok ? '' : ' x') + '" type="button" data-t="' + t + '" ' + (ok ? '' : 'disabled') + '>' + t + '</button>'; }).join('') + '</div>';
      }
    } else if (kind === 'confirm') {
      const v = curSvc(), d = days[s.di], ex = exOpt(), Xx = D.extra;
      let rows = '<div><span>' + (D.classes ? 'שיעור' : 'שירות') + '</span><b>' + v.n + '</b></div>';
      if (Xx && Xx.kind === 'staff') rows += '<div><span>אצל</span><b>' + ex.n + '</b></div>';
      if (Xx && Xx.kind === 'vehicle') rows += '<div><span>רכב</span><b>' + ex.n + '</b></div>';
      if (Xx && Xx.kind === 'design') rows += '<div><span>עיצוב</span><b><i class="dotc" style="--c:' + Xx.colors[s.color] + '"></i>' + Xx.styles[s.style] + '</b></div>';
      rows += '<div><span>מתי</span><b>' + dayName(s.di) + ' · ' + d.getDate() + '.' + (d.getMonth() + 1) + ' · ' + s.slot + '</b></div><div><span>משך</span><b>' + curDur() + ' דק׳</b></div><div><span>מחיר</span><b>₪' + curPrice() + '</b></div>';
      html = crumbs() + BACK + '<h4>' + (D.classes ? 'אישור ההרשמה' : 'אישור התור') + '</h4><div class="sum">' + rows + '</div><input class="nm" type="text" id="nm" maxlength="24" autocomplete="off" placeholder="השם שלכם (לא חובה)" value="' + esc(s.name) + '"><button class="cta" type="button" id="confirm">' + (D.classes ? 'הרשמה לשיעור' : 'אישור התור') + '</button><p class="note2">בלי הרשמה, בלי הורדה. ביטול חינם עד 3 שעות לפני.</p>';
    } else if (kind === 'done') {
      const b = s.booking;
      html = '<div class="ok"><svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="35"/><path d="M24 41l11 11 21-23"/></svg><b>' + (D.classes ? 'נרשמתם לשיעור!' : 'התור נקבע!') + '</b><p>' + b.when + ' · ' + b.v.n + '</p><span class="chip">' + (D.classes ? 'נשארו ' + s.caps.get(b.key) + ' מקומות בשיעור' : (b.cov.length > 1 ? b.cov.length + ' חלונות נחסמו לשאר הלקוחות' : 'השעה נחסמה לשאר הלקוחות')) + '</span><p class="note2">העסק קיבל התראה. תזכורת תישלח אליכם יום לפני.</p><div class="acts"><button type="button" id="cal">+ הוספה ליומן</button><button type="button" id="cancel">ביטול</button></div></div><button class="cta" type="button" id="again">' + (D.classes ? 'להירשם לשיעור נוסף' : 'לקבוע תור נוסף') + '</button>';
    } else {
      html = '<div class="ok cancel"><span class="big" aria-hidden="true">' + OFF + '</span><b>' + (D.classes ? 'ההרשמה בוטלה' : 'התור בוטל') + '</b><p>' + (D.classes ? 'המקום חזר להיות פנוי למי שמחכה.' : 'השעה חזרה להיות פנויה לשאר הלקוחות.') + ' העסק קיבל עדכון, בלי שיחת טלפון.</p></div><button class="cta" type="button" id="again">' + (D.classes ? 'להירשם לשיעור אחר' : 'לקבוע תור חדש') + '</button>';
    }
    body.innerHTML = '<div class="scn' + pend + '">' + html + '</div>'; pend = ''; body.scrollTop = 0;
    const bk = body.querySelector('.back'); if (bk) bk.addEventListener('click', () => nav(s.step - 1, -1));
    $$('[data-sv]', body).forEach(b => b.addEventListener('click', () => { s.sv = +b.dataset.sv; s.ex = null; click(260); nav(s.step + 1, 1); }));
    $$('[data-ex]', body).forEach(b => b.addEventListener('click', () => { s.ex = +b.dataset.ex; click(260); nav(s.step + 1, 1); }));
    $$('[data-c]', body).forEach(b => b.addEventListener('click', () => { s.color = +b.dataset.c; click(300); render(); }));
    $$('[data-s]', body).forEach(b => b.addEventListener('click', () => { s.style = +b.dataset.s; click(300); render(); }));
    const exgo = $('exgo'); if (exgo) exgo.addEventListener('click', () => { click(260); nav(s.step + 1, 1); });
    $$('[data-di]', body).forEach(b => b.addEventListener('click', () => { s.di = +b.dataset.di; render(); ownerPaint(false); if (X.onDay) X.onDay(s.di); }));
    $$('[data-t]', body).forEach(b => b.addEventListener('click', () => { s.slot = b.dataset.t; b.classList.add('pick'); click(260); nav(s.step + 1, 1); }));
    const nm = $('nm'); if (nm) nm.addEventListener('input', () => { s.name = nm.value; });
    const cf = $('confirm'); if (cf) cf.addEventListener('click', () => { cf.classList.add('busy'); cf.innerHTML = '<span class="spin"></span>' + (D.classes ? 'שומרים לכם מקום…' : 'שומרים את התור…'); setTimeout(() => { commit(); click(330); nav(s.step + 1, 1); setTimeout(burst, 560); }, RM ? 0 : 700); });
    const cal = $('cal'); if (cal) cal.addEventListener('click', () => { cal.innerHTML = CHECK + 'נוסף ליומן'; cal.disabled = true; click(300); });
    const cn = $('cancel'); if (cn) cn.addEventListener('click', () => { const acts = cn.parentElement; acts.innerHTML = '<span class="q">לבטל את ' + (D.classes ? 'ההרשמה' : 'התור') + '?</span><button type="button" id="cy" class="danger">כן, לבטל</button><button type="button" id="cno">לא</button>'; $('cy').addEventListener('click', cancelBooking); $('cno').addEventListener('click', () => render()); });
    const ag = $('again'); if (ag) ag.addEventListener('click', () => { s.slot = null; s.booking = null; nav(0, 1); });
  }
  function burst() {
    if (RM) return; const svg = body.querySelector('.ok svg'); if (!svg) return;
    const r = svg.getBoundingClientRect(), hr = stage.getBoundingClientRect();
    const cx = r.left + r.width / 2 - hr.left, cy = r.top + r.height / 2 - hr.top;
    for (let i = 0; i < 12; i++) {
      const d = document.createElement('i'); d.className = 'pt';
      const a = i / 12 * Math.PI * 2 + Math.random() * .4, dist = 48 + Math.random() * 34;
      d.style.cssText = 'left:' + cx + 'px;top:' + cy + 'px;--dx:' + (Math.cos(a) * dist).toFixed(1) + 'px;--dy:' + (Math.sin(a) * dist).toFixed(1) + 'px;--s:' + (.6 + Math.random() * .7).toFixed(2);
      stage.appendChild(d); d.addEventListener('animationend', () => d.remove());
    }
  }
  function commit() {
    const D = cur, v = curSvc(), ex = exOpt(), d = days[s.di], name = (s.name || '').trim() || 'לקוח חדש', price = curPrice(), dur = curDur();
    const b = { di: s.di, t: s.slot, v, price, dur, name, when: dayName(s.di) + ' · ' + s.slot };
    if (D.classes) { b.key = s.di + '-' + s.sv + '-' + s.slot; s.caps.set(b.key, s.caps.get(b.key) - 1); }
    else { b.cov = covered(D, D.slots.indexOf(s.slot), dur) || [s.slot]; b.cov.forEach(t => s.taken.add(s.di + '-' + t)); s.userRev[s.di] = (s.userRev[s.di] || 0) + price; s.userBk[s.di] = (s.userBk[s.di] || 0) + 1; }
    s.booking = b;
    s.list.unshift({ n: name, s: v.n + (ex && D.extra.kind === 'staff' ? ' אצל ' + ex.n : ''), t: (s.di > 0 ? DN[d.getDay()] + ' ' : '') + s.slot, cls: 'new' });
    s.list = s.list.slice(0, 3); b.li = s.list[0];
    ownerPaint(true);
    notify(D.classes ? 'הרשמה חדשה לשיעור' : 'תור חדש נקבע', name + ' · ' + b.when + ' · ' + v.n + ' · ₪' + price);
  }
  function cancelBooking() {
    const D = cur, b = s.booking; if (!b) return;
    if (D.classes) s.caps.set(b.key, s.caps.get(b.key) + 1);
    else { b.cov.forEach(t => s.taken.delete(b.di + '-' + t)); s.userRev[b.di] = (s.userRev[b.di] || 0) - b.price; s.userBk[b.di] = (s.userBk[b.di] || 0) - 1; }
    if (b.li) b.li.cls = 'x';
    s.booking = null; click(180); ownerPaint(true);
    notify(D.classes ? 'ביטול הרשמה' : 'תור בוטל', b.name + ' · ' + b.when + ' · ' + (D.classes ? 'המקום התפנה' : 'השעה התפנתה'), 'cancel');
    nav(idx('cancelled'), 1);
  }
  let toastT = 0;
  function notify(title, sub, kind) {
    toast.innerHTML = '<span class="ic">' + (kind === 'cancel' ? OFF : BELL) + '</span><div><b>' + esc(title) + '</b><small>' + esc(sub) + '</small></div><span class="t">עכשיו</span>';
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('show'), RM ? 0 : 350);
    clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove('show'), 4600);
  }
  function ownerPaint(flash) {
    const D = cur, di = s.di; let booked = 0, used = 0, total = 0, rev = 0;
    if (D.classes) { D.services.forEach((v, vi) => v.times.forEach(t => { const rem = s.caps.get(di + '-' + vi + '-' + t); booked += v.cap - rem; total += v.cap; rev += (v.cap - rem) * v.p; })); used = booked; }
    else { total = D.slots.length; D.slots.forEach(t => { const k = di + '-' + t; if (s.taken.has(k)) used++; if (s.seeded.has(k)) { booked++; rev += D.services[hash(D.key + k + 'p') % D.services.length].p; } }); booked += s.userBk[di] || 0; rev += s.userRev[di] || 0; }
    $('oname').textContent = D.name; $('olabel').textContent = (D.classes ? 'נרשמים' : 'תורים') + ' · ' + dayName(di);
    if (cnt.textContent !== String(booked)) { cnt.textContent = booked; replay(cnt, 'bump'); }
    if (!setRev) setRev = odometer($('rev')); setRev(rev);
    $('occ').style.setProperty('--w', Math.round(used / total * 100) + '%'); $('occt').textContent = used + ' מתוך ' + total + (D.classes ? ' מקומות' : ' חלונות') + ' תפוסים';
    olist.innerHTML = s.list.map(x => '<li class="' + (x.cls || '') + '"><span>' + esc(x.n) + ' · ' + esc(x.s) + '</span><i>' + x.t + '</i></li>').join('');
    if (flash) { replay(owner, 'flash'); setTimeout(() => owner.classList.remove('flash'), 700); }
  }
  // dock light bar follows the selected chip
  const setBar = () => { const c = dsw.querySelector('.dchip[aria-selected="true"]'); if (!c) return; dsw.style.setProperty('--bx', c.offsetLeft + 'px'); dsw.style.setProperty('--bw', c.offsetWidth + 'px'); };
  function select(key, first) {
    const D = DEMOS.find(x => x.key === key); if (!D || (D === cur && !first)) return;
    cur = D; s = S[D.key];
    stage.style.setProperty('--acc', D.acc); stage.style.setProperty('--acc-fg', D.accFg); stage.style.setProperty('--acc-rgb', D.rgb);
    const top = $('top'); if (top) { top.style.setProperty('--acc', D.acc); top.style.setProperty('--acc-rgb', D.rgb); }
    $$('.dchip', dsw).forEach((b, i) => b.setAttribute('aria-selected', DEMOS[i] === D));
    $('aav').textContent = D.letter; $('aname').textContent = D.name; $('asub').textContent = D.sub; $('ctaBiz').textContent = D.biz;
    if (first) $('capBiz').textContent = D.biz; else scramble($('capBiz'), D.biz, 450);
    toast.classList.remove('show');
    if (!first && !RM) replay(scr, 'swap');
    pend = ''; render(); ownerPaint(false);
    if (!first) click(260);
    requestAnimationFrame(setBar);
    if (!first) { const c = dsw.querySelector('.dchip[aria-selected="true"]'); if (c) dsw.scrollTo({ left: c.offsetLeft - (dsw.clientWidth - c.offsetWidth) / 2, behavior: RM ? 'auto' : 'smooth' }); }
  }
  DEMOS.forEach(D => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'dchip'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', 'false');
    b.style.setProperty('--acc', D.acc); b.style.setProperty('--acc-fg', D.accFg); b.textContent = D.chip; b.dataset.demo = D.key;
    b.addEventListener('click', () => select(D.key)); dsw.appendChild(b);
  });
  select(DEMOS[0].key, true);
  const more = () => { const max = dsw.scrollWidth - dsw.clientWidth; dsw.classList.toggle('more', max > 4 && Math.abs(dsw.scrollLeft) < max - 4); };
  dsw.addEventListener('scroll', more, { passive: true }); more();
  addEventListener('resize', () => { setBar(); more(); }); if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { setBar(); more(); });
  $('demoCta').addEventListener('click', () => { const fb = $('fb'); if (fb && !fb.value) fb.value = cur.bizForm; const r = $$('input[name=svc]').find(i => i.value === 'אפליקציית תורים'); if (r) r.checked = true; });
  $('tryDemo').addEventListener('click', e => { if (innerWidth > 1000) { e.preventDefault(); stage.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'center' }); } });
  // desktop: the device leans toward the pointer (max 4°); the wrapper is posed by scroll, .dev by the pointer
  if (FINE && !RM) {
    const hero = $('top'), dev = document.querySelector('.dev'); let raf = 0, rx = 0, ry = 0;
    hero.addEventListener('pointermove', e => {
      const r = dev.getBoundingClientRect(); ry = clamp((e.clientX - (r.left + r.width / 2)) / innerWidth * 12, -4, 4); rx = clamp((e.clientY - (r.top + r.height / 2)) / innerHeight * 12, -4, 4);
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; dev.style.transform = 'perspective(1200px) rotateY(' + ry.toFixed(2) + 'deg) rotateX(' + (-rx).toFixed(2) + 'deg)'; });
    }, { passive: true });
    hero.addEventListener('pointerleave', () => { dev.style.transform = ''; });
  }
});

/* ---------- the lamp hand-off: pose scrub + owner card float ---------- */
safe(() => {
  if (!ST || RM) return;
  const desk = innerWidth >= 1100;
  const st = { trigger: '#demo', start: 'top bottom', end: 'bottom top', scrub: SCRUB };
  gsap.fromTo('.pose3d', { rotateY: desk ? -12 : -4, rotateX: desk ? 3 : 0, y: 40 }, { rotateY: 0, rotateX: 0, y: -40, ease: 'none', scrollTrigger: st });
  if (desk) gsap.fromTo('#owner', { '--oz': '60px' }, { '--oz': '0px', ease: 'none', scrollTrigger: st });
});

/* ---------- configurator (ported) + cell strips + the wire ---------- */
const CFG = { page: { n: 'דף עסק', p: 990 }, app: { n: 'אפליקציית תורים', p: 2490 }, brand: { n: 'מיתוג ואינסטגרם', p: 1490 }, care: { n: 'ליווי חודשי', p: 99 } };
const sel = new Set(['app']);
let cfgState = { total: 2490 };
safe(() => {
  const lines = $('lines'), promo = $('promo'), sel2 = $('sel2');
  const setA = odometer($('total')), setB = odometer($('total2'));
  $$('.plan .strip').forEach(st => $$('i', st).forEach((c, i) => c.style.setProperty('--i', i)));
  const lat = $('lat'); if (lat) lat.innerHTML = '<i></i>'.repeat(112); const latI = lat ? $$('i', lat) : []; latI.forEach((c, i) => c.style.setProperty('--i', i));
  function calc() {
    const items = ['page', 'app', 'brand'].filter(k => sel.has(k));
    let sub = items.reduce((a, k) => a + CFG[k].p, 0), bundle = sel.has('app') && sel.has('brand') ? 490 : 0, tot = sub - bundle;
    cfgState = { items, bundle, total: tot, care: sel.has('care') };
    let html = items.map(k => '<li><span>' + CFG[k].n + '</span><b>' + ils(CFG[k].p) + '</b></li>').join('');
    if (bundle) html += '<li class="sv"><span>חבילה מלאה · אפליקציה + מיתוג</span><b>−' + ils(bundle) + '</b></li>';
    if (sel.has('care')) html += '<li><span>ליווי חודשי</span><b>' + ils(CFG.care.p) + ' / חודש</b></li>';
    if (!items.length) html += '<li class="em"><span>הדליקו לפחות שירות אחד כדי לראות מחיר. ליווי חודשי מצטרף לכל חבילה.</span></li>';
    lines.innerHTML = html; setA(tot); setB(tot);
    const nl = Math.min(latI.length, Math.round(tot / 64)); latI.forEach((c, i) => c.classList.toggle('on', i < nl));
    promo.textContent = ils(Math.round(tot * .7 / 10) * 10);
    sel2.textContent = items.length ? items.map(k => CFG[k].n).join(' + ') + (sel.has('care') ? ' + ליווי' : '') : 'בחרו שירות';
  }
  $$('.plan').forEach(b => b.addEventListener('click', () => { const k = b.dataset.plan; sel.has(k) ? sel.delete(k) : sel.add(k); b.setAttribute('aria-pressed', sel.has(k)); replay(b, 'pop'); click(sel.has(k) ? 300 : 180); calc(); }));
  calc();
  const bar = $('cfgbar'), sec = $('services'), bill = $('bill');
  let inSec = false, inBill = false;
  const updBar = () => bar.classList.toggle('show', inSec && !inBill);
  new IntersectionObserver(es => es.forEach(e => { inSec = e.isIntersecting; updBar(); }), { rootMargin: '-30% 0px -20% 0px' }).observe(sec);
  new IntersectionObserver(es => es.forEach(e => { inBill = e.isIntersecting; updBar(); }), { rootMargin: '0px 0px -15% 0px' }).observe(bill);
  $('quote').addEventListener('click', () => prefill(true));
  const wire = sec.querySelector('.wire');
  if (wire) { if (RM || !GS) wire.style.transform = 'scaleX(1)'; else onEnter(sec, () => gsap.to(wire, { scaleX: 1, duration: 1, ease: 'power3.inOut' }), { threshold: .02, margin: '0px 0px -2% 0px' }); }
});

/* ---------- contact form (ported) ---------- */
function prefill(fromCfg) {
  safe(() => {
    const { items = [], care, total } = cfgState;
    const pick = items.includes('app') && items.includes('brand') ? 'הכל ביחד' : items.includes('app') ? 'אפליקציית תורים' : items.includes('brand') ? 'מיתוג ואינסטגרם' : items.includes('page') ? 'דף עסק' : null;
    if (pick) { const r = $$('input[name=svc]').find(i => i.value === pick); if (r) r.checked = true; }
    if (fromCfg && items.length) {
      $('fm').value = 'הרכבתי באתר: ' + items.map(k => CFG[k].n).join(' + ') + (care ? ' + ליווי חודשי' : '') + ' (בערך ' + ils(total) + ').';
      goStep(2);
    }
  });
}
function goStep(n) { $('s1').hidden = n !== 1; $('s2').hidden = n !== 2; $('stepl').textContent = 'שלב ' + n + ' מתוך 2'; $('pbar').style.setProperty('--p', n === 1 ? '50%' : '100%'); const f = $('f'); f.dataset.step = n; if (!RM) replay(f, 'swap'); if (n === 2) setTimeout(() => $('fn').focus({ preventScroll: true }), 350); }
safe(() => {
  $('next').addEventListener('click', () => goStep(2));
  $('back').addEventListener('click', () => goStep(1));
  const msg = () => $('out').textContent;
  $('f').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('fn').value.trim(), biz = $('fb').value.trim();
    if (name.length < 2 || biz.length < 2) { $('st').textContent = 'נא למלא שם ושם עסק כדי שנוכל לחזור אליכם.'; const bad = $(name.length < 2 ? 'fn' : 'fb'); bad.focus(); if (!RM) replay(bad, 'nudge'); return; }
    const svc = document.querySelector('input[name=svc]:checked').value, note = $('fm').value.trim();
    $('out').textContent = 'היי EDON, אני ' + name + ' מ' + biz + '.\nמעניין אותי: ' + svc + '.' + (note ? '\n' + note : '');
    const dmt = $('dmt'); if (dmt) dmt.textContent = new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    $('done').hidden = false; $('st').textContent = 'ההודעה מוכנה. העתיקו, פתחו את הדיירקט והדביקו.'; click(330);
    if (!RM) replay($('done'), 'swap');
    $('done').scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'nearest' });
  });
  const copy = async () => { try { await navigator.clipboard.writeText(msg()); $('st').textContent = 'הועתק. אפשר להדביק ולשלוח.'; return true; } catch (err) { const r = document.createRange(); r.selectNodeContents($('out')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); $('st').textContent = 'סימנו את ההודעה. העתיקו ידנית (לחיצה ארוכה).'; return false; } };
  $('cp').addEventListener('click', copy);
  $('openig').addEventListener('click', () => { copy(); });
});

/* ---------- before / after: the power cut (ported drag engine + threshold flash) ---------- */
safe(() => {
  const w = $('baw'), r = $('bar'), sw = $('baflip'), fl = w.querySelector('.bflash'); let drag = false, p = 100, raf = 0, touched = false, powered = false;
  const check = () => { const now = p < 50; if (now === powered) return; powered = now; w.classList.toggle('pw', now); if (now && !RM) { replay(fl, 'go'); click(330); } };
  const paint = () => { w.style.setProperty('--p', p + '%'); r.value = Math.round(p); w.style.setProperty('--hdo', (p < 2 || p > 98) ? 0 : 1); sw.setAttribute('aria-checked', p < 50); check(); };
  const to = (v, dur = 900) => { cancelAnimationFrame(raf); if (RM) { p = v; paint(); return; } const f = p, t0 = performance.now(); const tick = now => { const k = clamp((now - t0) / dur, 0, 1); p = f + (v - f) * easeOut(k); paint(); if (k < 1) raf = requestAnimationFrame(tick); }; raf = requestAnimationFrame(tick); };
  const at = e => { cancelAnimationFrame(raf); p = clamp((e.clientX - w.getBoundingClientRect().left) / w.clientWidth * 100, 0, 100); paint(); };
  w.addEventListener('pointerdown', e => { if (e.target.closest('.bsw')) return; touched = true; drag = true; w.classList.add('drag'); try { w.setPointerCapture(e.pointerId); } catch (err) {} at(e); });
  w.addEventListener('pointermove', e => { if (drag) at(e); });
  const end = () => { if (!drag) return; drag = false; w.classList.remove('drag'); if (p < 12) to(0, 400); else if (p > 88) to(100, 400); };
  w.addEventListener('pointerup', end); w.addEventListener('pointercancel', end);
  sw.addEventListener('click', () => { touched = true; const on = p >= 50; click(on ? 300 : 180); to(on ? 0 : 100); });
  r.addEventListener('input', () => { touched = true; cancelAnimationFrame(raf); p = +r.value; paint(); });
  paint();
  if (!RM) new IntersectionObserver((es, io) => es.forEach(e => { if (!e.isIntersecting) return; io.disconnect(); setTimeout(() => { if (!touched) { click(300); to(0, 1200); } }, 1400); }), { threshold: .45 }).observe(w);
});

/* ---------- faq ---------- */
safe(() => $$('#faqs .q').forEach(q => { const b = q.querySelector('button'); b.addEventListener('click', () => { const o = q.dataset.open !== 'true'; $$('#faqs .q').forEach(x => { x.dataset.open = 'false'; x.querySelector('button').setAttribute('aria-expanded', 'false'); }); q.dataset.open = o; b.setAttribute('aria-expanded', o); click(o ? 260 : 180); }); }));

/* ---------- press ripple on primary buttons ---------- */
safe(() => {
  if (RM) return;
  document.addEventListener('pointerdown', e => {
    const b = e.target.closest && e.target.closest('.btn.main'); if (!b) return;
    const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2, s = document.createElement('i');
    s.className = 'rip'; s.style.cssText = 'width:' + d + 'px;height:' + d + 'px;left:' + (e.clientX - r.left - d / 2) + 'px;top:' + (e.clientY - r.top - d / 2) + 'px';
    b.appendChild(s); s.addEventListener('animationend', () => s.remove());
  }, { passive: true });
});

/* ---------- desktop: cursor, magnetic, tilt, glow ---------- */
safe(() => {
  if (!FINE || RM) return;
  H.classList.add('cur');
  const cur = $('cur'); let cx = innerWidth / 2, cy = innerHeight / 2, tx = cx, ty = cy, vis = false;
  addEventListener('pointermove', e => {
    tx = e.clientX; ty = e.clientY; if (!vis) { vis = true; cur.style.opacity = 1; }
    const t = e.target.closest ? e.target : null; if (!t) return;
    const view = t.closest('.case .shot'), hide = t.closest('.dev .scr'), drag = !view && !hide && t.closest('.ba,.track,#dsw'), act = !view && !hide && !drag && t.closest('a,button,[role=switch],.case,.slot,.plan,.ba');
    cur.classList.toggle('view', !!view); cur.classList.toggle('hide', !!hide); cur.classList.toggle('drag', !!drag); cur.classList.toggle('act', !!act);
  }, { passive: true });
  document.addEventListener('pointerleave', () => { cur.style.opacity = 0; vis = false; });
  const glow = $('glow'), hero = $('top');
  hero.addEventListener('pointermove', e => { const r = hero.getBoundingClientRect(); glow.style.setProperty('--gx', (e.clientX - r.left) + 'px'); glow.style.setProperty('--gy', (e.clientY - r.top) + 'px'); }, { passive: true });
  (function loop() { cx += (tx - cx) * .16; cy += (ty - cy) * .16; cur.style.transform = 'translate(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px)'; requestAnimationFrame(loop); })();
  $$('.btn.main, .ig').forEach(b => {
    b.addEventListener('pointermove', e => { const r = b.getBoundingClientRect(); const x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2, f = clamp(1 - Math.hypot(x, y) / r.width, .4, 1); b.style.transition = 'transform 0s'; b.style.transform = 'translate(' + (x * .2 * f).toFixed(1) + 'px,' + (y * .26 * f).toFixed(1) + 'px)'; b.style.setProperty('--mx', (e.clientX - r.left) + 'px'); b.style.setProperty('--my', (e.clientY - r.top) + 'px'); });
    b.addEventListener('pointerleave', () => { b.style.transition = 'transform var(--t-4) var(--e-spring)'; b.style.transform = ''; });
  });
  $$('.case').forEach(c => {
    c.addEventListener('pointermove', e => { const r = c.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height; c.style.setProperty('--ry', ((px - .5) * 6).toFixed(2) + 'deg'); c.style.setProperty('--rx', ((.5 - py) * 6).toFixed(2) + 'deg'); c.style.setProperty('--sx', px * 100 + '%'); c.style.setProperty('--sy', py * 100 + '%'); });
    c.addEventListener('pointerleave', () => { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); });
  });
});

/* ---------- work: the showroom rail (pinned horizontal travel on desktop) ---------- */
safe(() => {
  const rail = $('rail'), track = $('track'); if (!rail || !track) return;
  rail.setAttribute('data-reveal', ''); // the ported observer lights the concept capacity bars
  if (!ST || RM || innerWidth < 1100) return;
  const dist = () => Math.max(0, track.scrollWidth - innerWidth);
  gsap.to(track, { x: () => dist(), ease: 'none', scrollTrigger: { trigger: rail, pin: true, start: 'top top', end: () => '+=' + dist(), scrub: SCRUB, invalidateOnRefresh: true, anticipatePin: 1 } });
});
safe(() => {
  const rail = $('rail'), pg = $('pager'); if (!rail || !pg) return;
  const cases = $$('.case', rail); if (!cases.length) return; pg.innerHTML = '<i></i>'.repeat(cases.length); const dots = $$('i', pg);
  let t = 0; const upd = () => { const w = cases[0].offsetWidth + 16, i = Math.min(cases.length - 1, Math.round(Math.abs(rail.scrollLeft) / w)); dots.forEach((d, k) => d.classList.toggle('on', k === i)); };
  rail.addEventListener('scroll', () => { clearTimeout(t); t = setTimeout(upd, 120); }, { passive: true }); upd();
});
safe(() => {
  if (!ST) return;
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
  addEventListener('orientationchange', () => setTimeout(() => ScrollTrigger.refresh(), 300));
  addEventListener('load', () => ScrollTrigger.refresh());
});

/* ---------- the grid of hours: three.js scene, dynamic import after idle, CSS lattice fallback ---------- */
safe(() => {
  const grid = document.querySelector('.hero .gridcss');
  const watchCount = cb => { const c = $('cnt'); if (!c) return; let last = parseInt(c.textContent, 10) || 0; new MutationObserver(() => { const v = parseInt(c.textContent, 10) || 0; if (v !== last) { cb(v > last ? 1 : -1); last = v; } }).observe(c, { childList: true, characterData: true, subtree: true }); };
  const fallback = () => {
    H.classList.add('nogl'); H.classList.remove('gl');
    if (!grid || grid.dataset.wired) return; grid.dataset.wired = 1;
    const extra = [['38%', '18%'], ['72%', '70%'], ['10%', '44%'], ['86%', '82%']].map(([x, y]) => { const i = document.createElement('i'); i.className = 'cell'; i.style.setProperty('--cx', x); i.style.setProperty('--cy', y); grid.appendChild(i); return i; });
    let n = 0; watchCount(d => { if (d > 0) { extra[n % 4].classList.add('lit'); extra[(n + 1) % 4].classList.add('lit'); n += 2; } else { n = Math.max(0, n - 2); extra[n % 4].classList.remove('lit'); extra[(n + 1) % 4].classList.remove('lit'); } });
  };
  if (RM || H.classList.contains('nogl') || !(window.WebGL2RenderingContext || window.WebGLRenderingContext)) { fallback(); return; }
  const start = () => import('/x/vendor/three.module.min.js').then(init).catch(e => { console.warn('[edon-x] scene fallback', e && e.message); fallback(); });
  const kick = () => ('requestIdleCallback' in window) ? requestIdleCallback(start, { timeout: 300 }) : setTimeout(start, 120);
  setTimeout(kick, SEEN ? 60 : 1160); // after the shutters

  function init(THREE) {
    const canvas = document.createElement('canvas'); canvas.id = 'gl'; canvas.setAttribute('aria-hidden', 'true');
    const attrs = { antialias: false, alpha: true, powerPreference: 'high-performance', premultipliedAlpha: true };
    const ctx = canvas.getContext('webgl2', attrs) || canvas.getContext('webgl', attrs);
    if (!ctx) { fallback(); return; }
    document.body.appendChild(canvas);
    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, antialias: false, alpha: true, powerPreference: 'high-performance' });
    const DPR = Math.min(devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(DPR); renderer.setClearColor(0x000000, 0);
    const PH = innerWidth < 900;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, .1, 80);
    const CAM = PH ? { z0: 12.5, y0: 1.4 } : { z0: 10, y0: 1.6 };
    const COLS = 7, ROWS = 16, LAYERS = PH ? 6 : 10, N = COLS * ROWS * LAYERS;
    const tint = new THREE.Color('#C8FF2E'), tintFrom = tint.clone(), tintTo = tint.clone(); let tintT0 = -1;
    const U = { uTime: { value: 0 }, uTint: { value: tint }, uMoon: { value: new THREE.Color('#8EA2FF') }, uBase: { value: new THREE.Color('#141722') }, uFade: { value: 1 }, uDPR: { value: DPR }, uMax: { value: PH ? 48 : 130 } };
    // lattice
    const lit = new Float32Array(N), base = new Float32Array(N), flash = new Float32Array(N), seed = new Float32Array(N), dist = new Float32Array(N), centers = new Float32Array(N * 3);
    const cell = (c, r, k) => ((LAYERS - 1 - k) * ROWS + r) * COLS + c; // far layers first: back-to-front blending
    const SX = PH ? .56 : .68;
    const ORIGIN = { c: 3, r: 0, k: 0 };
    const hsh = i => { let h = (i * 2654435761) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; };
    const geo = new THREE.BoxGeometry(.2, .2, .06);
    // the cell material: a hairline-framed chip (the CSS .cell, in GLSL). Unlit = moon-tinted frame over a near-empty
    // interior; lit = the frame brightens and the interior fills with the tint. Premultiplied output, fog dissolves alpha.
    const mat = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, extensions: { derivatives: true },
      vertexShader: 'attribute float aLit;attribute float aSeed;varying float vLit;varying float vSeed;varying vec3 vN;varying vec3 vW;varying vec2 vUv;varying float vNear;void main(){vec4 wp=modelMatrix*instanceMatrix*vec4(position,1.0);vN=normalize(mat3(modelMatrix)*mat3(instanceMatrix)*normal);vW=wp.xyz;vUv=uv;vLit=aLit;vSeed=aSeed;vNear=smoothstep(.6,2.6,cameraPosition.z-wp.z);gl_Position=projectionMatrix*viewMatrix*wp;}',
      fragmentShader: 'precision highp float;uniform vec3 uTint;uniform vec3 uMoon;uniform vec3 uBase;uniform float uFade;varying float vLit;varying float vSeed;varying vec3 vN;varying vec3 vW;varying vec2 vUv;varying float vNear;void main(){vec3 n=normalize(vN);vec3 v=normalize(cameraPosition-vW);float d=length(cameraPosition-vW);float side=1.0-step(.5,abs(n.z));float e=min(min(vUv.x,1.0-vUv.x),min(vUv.y,1.0-vUv.y));float aa=fwidth(e)*1.4;float w=min(fwidth(e)*1.2,.12);float frame=1.0-smoothstep(w,w+aa,e);float lit=smoothstep(.02,.6,vLit);vec3 moon=mix(uMoon,uTint,.25);vec3 lineCol=mix(moon*.55+uBase,uTint*1.35,lit);vec3 fillCol=mix(uBase*(.6+vSeed*.5),uTint*(.55+vLit*1.4),lit)*(1.0-e*.7*lit);float rim=pow(1.0-max(dot(n,v),0.0),3.0);vec3 col=mix(fillCol,lineCol,frame)+moon*rim*.2;col=mix(col,uBase*.9+uTint*vLit*.9,side);float fog=smoothstep(5.,18.,d);float nearF=1.0-smoothstep(1.5,5.5,d);float dim=1.0-nearF*.45;float a=mix((.05+.07*vSeed)*dim,.92,lit)*(1.0-frame)+frame*mix(.55*(1.0-fog)*dim,1.0,lit);a=mix(a,(.3+lit*.6)*dim,side);col=mix(col,vec3(.02,.02,.03),fog*.85);a*=(1.0-smoothstep(13.,25.,d))*vNear*uFade;gl_FragColor=vec4(col*a,a);}' });
    const mesh = new THREE.InstancedMesh(geo, mat, N);
    const M = new THREE.Matrix4();
    for (let k = 0; k < LAYERS; k++) for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const i = cell(c, r, k), x = (c - 3) * SX + (k % 2 ? SX / 2 : 0), y = (r - 7.5) * .38 + .2, z = 2 - 2.2 * k;
      M.makeTranslation(x, y, z); mesh.setMatrixAt(i, M);
      centers[i * 3] = x; centers[i * 3 + 1] = y; centers[i * 3 + 2] = z;
      seed[i] = hsh(i + 11); dist[i] = Math.abs(c - ORIGIN.c) + Math.abs(r - ORIGIN.r) + 2 * Math.abs(k - ORIGIN.k);
      base[i] = ((k === 0 && r <= 1) || k >= 5) && hsh(i + 977) < (PH ? .04 : .06) ? .35 : 0; // standing light only low and near, or far in the fog: the copy stays dark
    }
    base[cell(ORIGIN.c, ORIGIN.r, ORIGIN.k)] = 1;
    const litAttr = new THREE.InstancedBufferAttribute(lit, 1); litAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aLit', litAttr); geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1));
    mesh.instanceMatrix.needsUpdate = true; mesh.frustumCulled = false; scene.add(mesh);
    // bloom: additive point sprites on the same centres; only lit cells are visible
    const pgeo = new THREE.BufferGeometry();
    pgeo.setAttribute('position', new THREE.BufferAttribute(centers, 3));
    const plit = new THREE.BufferAttribute(lit, 1); plit.setUsage(THREE.DynamicDrawUsage); pgeo.setAttribute('aLit', plit);
    const pmat = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'attribute float aLit;uniform float uDPR;uniform float uMax;varying float vA;varying float vNear;void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(smoothstep(.05,1.0,aLit)*26.0*uDPR*(60.0/max(-mv.z,1.0)),0.0,uMax);vA=aLit;vNear=smoothstep(.6,2.6,-mv.z)*(1.0-smoothstep(13.,25.,-mv.z));}',
      fragmentShader: 'precision highp float;uniform vec3 uTint;uniform float uFade;varying float vA;varying float vNear;void main(){float d=length(gl_PointCoord-.5)*2.0;float a=smoothstep(1.0,0.0,d);a=a*a*a;float s=smoothstep(.05,.5,vA);float al=a*s*.5*uFade*vNear;gl_FragColor=vec4(uTint*al,al);}' });
    const pts = new THREE.Points(pgeo, pmat); pts.frustumCulled = false; scene.add(pts);
    // dust: GPU-animated motes in a 14×8×16 box around the camera path
    const ND = PH ? 400 : 900, dpos = new Float32Array(ND * 3), dseed = new Float32Array(ND);
    for (let i = 0; i < ND; i++) { dpos[i * 3] = (hsh(i + 5) - .5) * 14; dpos[i * 3 + 1] = (hsh(i + 61) - .5) * 8; dpos[i * 3 + 2] = -9 + hsh(i + 303) * 16; dseed[i] = hsh(i + 909); }
    const dgeo = new THREE.BufferGeometry(); dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3)); dgeo.setAttribute('aSeed', new THREE.BufferAttribute(dseed, 1));
    const dmat = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'attribute float aSeed;uniform float uTime;uniform float uDPR;varying float vNear;void main(){vec3 p=position;p.y=mod(p.y+4.0+uTime*.05+aSeed*16.,8.)-4.;p.x+=sin(uTime*.35+aSeed*6.283)*.35;vec4 mv=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=(1.8+aSeed*1.4)*uDPR;vNear=smoothstep(.4,2.0,-mv.z)*(1.0-smoothstep(14.,22.,-mv.z));}',
      fragmentShader: 'precision highp float;uniform vec3 uTint;uniform vec3 uMoon;uniform float uFade;varying float vNear;void main(){float d=length(gl_PointCoord-.5)*2.0;float a=smoothstep(1.0,.2,d)*.45*vNear*uFade;gl_FragColor=vec4(mix(uMoon,uTint,.5)*a,a);}' });
    const dust = new THREE.Points(dgeo, dmat); dust.frustumCulled = false; scene.add(dust);

    // state: pulses (the night breathes), bursts (a booking lights the room), ripples (a day column)
    const pulses = [], bursts = [], ripples = []; let lastPulse = 0, dirty = true, lastP = -1, prog = 0, progT = 0, yaw = 0, pitch = 0, yawT = 0, pitchT = 0, first = true, fadeDip = 0;
    const safeCell = () => { const far = LAYERS > 5 && Math.random() < .5; return cell(Math.random() * COLS | 0, far ? Math.random() * ROWS | 0 : Math.random() * 2 | 0, far ? 5 + (Math.random() * (LAYERS - 5) | 0) : 0); };
    const neigh = i => { const k = Math.floor(i / (ROWS * COLS)), r = Math.floor((i % (ROWS * COLS)) / COLS), c = i % COLS, out = []; if (c > 0) out.push(i - 1); if (c < COLS - 1) out.push(i + 1); if (r > 0) out.push(i - COLS); if (r < ROWS - 1) out.push(i + COLS); return out; };
    const top = $('top');
    const sizes = () => { const h = canvas.clientHeight || innerHeight, w = innerWidth; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    sizes();
    let rw = innerWidth, rh = innerHeight, rt = 0;
    addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { const dw = innerWidth !== rw, dh = Math.abs(innerHeight - rh); if (!dw && dh < 140) return; rw = innerWidth; rh = innerHeight; sizes(); }, 150); });
    const look = new THREE.Vector3();
    function frame(tms) {
      const now = performance.now(), t = tms * .001; U.uTime.value = t;
      // scroll → camera dolly (smoothed on fine pointers, direct on touch)
      const max = Math.max(1, top.offsetHeight - innerHeight); progT = clamp(scrollY / max, 0, 1); prog = TOUCH ? progT : lerp(prog, progT, .12);
      yaw = lerp(yaw, yawT, .06); pitch = lerp(pitch, pitchT, .06);
      camera.position.set(Math.sin(yaw) * 2, lerp(CAM.y0, .6, prog) + Math.sin(pitch) * 1.2, lerp(CAM.z0, 5.4, prog));
      look.set(0, lerp(.4, -.2, prog), 0); camera.lookAt(look);
      U.uFade.value = lerp(1, .55, prog) * (1 - fadeDip); if (fadeDip > 0) fadeDip = Math.max(0, fadeDip - .05);
      const op = prog < .88 ? 1 : 1 - (prog - .88) / .12; if (Math.abs(op - lastP) > .01) { lastP = op; canvas.style.opacity = first ? 0 : op.toFixed(3); }
      // tint tween (600 ms, power2.out)
      if (tintT0 >= 0) { const k = clamp((now - tintT0) / 600, 0, 1), e = 1 - (1 - k) * (1 - k); tint.copy(tintFrom).lerp(tintTo, e); if (k >= 1) tintT0 = -1; }
      // night pulses
      if (now - lastPulse > 2600) { lastPulse = now; pulses.push({ i: prog < .3 ? safeCell() : Math.random() * N | 0, t0: now }); }
      let any = false;
      for (let i = 0; i < N; i++) if (flash[i] !== 0) { flash[i] *= .962; if (Math.abs(flash[i]) < .004) flash[i] = 0; any = true; }
      for (let q = pulses.length - 1; q >= 0; q--) { const p = pulses[q], tt = now - p.t0; const v = tt < 300 ? tt / 300 : tt < 1500 ? 1 - .65 * (tt - 300) / 1200 : tt < 2500 ? .35 * (1 - (tt - 1500) / 1000) : 0; if (v <= 0) { pulses.splice(q, 1); continue; } flash[p.i] = Math.max(flash[p.i], v); for (const j of neigh(p.i)) flash[j] = Math.max(flash[j], v * .4); any = true; }
      for (let q = bursts.length - 1; q >= 0; q--) { const b = bursts[q], tt = now - b.t0, R = 5 * easeOut(clamp(tt / 900, 0, 1)); for (let i = 0; i < N; i++) if (dist[i] <= R) { const tg = (1 - dist[i] / 5) * (b.dir > 0 ? 1 : -.85); if (b.dir > 0) { if (flash[i] < tg) flash[i] = tg; } else if (flash[i] > tg) flash[i] = tg; } if (tt > 900) bursts.splice(q, 1); any = true; }
      for (let q = ripples.length - 1; q >= 0; q--) { const rp = ripples[q], tt = now - rp.t0, v = .55 * Math.sin(Math.PI * clamp(tt / 400, 0, 1)); for (let k = 0; k < LAYERS; k++) for (let r = 0; r < ROWS; r++) { const i = cell(rp.c, r, k); if (flash[i] < v) flash[i] = v; } if (tt > 400) ripples.splice(q, 1); any = true; }
      if (any || dirty) { for (let i = 0; i < N; i++) lit[i] = clamp(base[i] + flash[i], 0, 1); litAttr.needsUpdate = true; plit.needsUpdate = true; dirty = false; }
      renderer.render(scene, camera);
      if (first) { first = false; H.classList.add('gl'); canvas.style.transition = 'opacity .7s'; requestAnimationFrame(() => { canvas.style.opacity = lastP < 0 ? 1 : Math.max(0, lastP).toFixed(3); setTimeout(() => { canvas.style.transition = 'none'; }, 800); }); }
    }
    // loop only while the hero is on screen, the tab visible and the menu closed
    let vis = true;
    const upd = () => renderer.setAnimationLoop((vis && !document.hidden && !X.held()) ? frame : null);
    new IntersectionObserver(es => { vis = es[0].isIntersecting; upd(); }).observe(top);
    document.addEventListener('visibilitychange', upd); X.onHold = upd; upd();
    // reactions: the contract with the demo
    const readAcc = () => { const v = getComputedStyle($('demo')).getPropertyValue('--acc').trim(); if (!v) return; tintFrom.copy(tint); tintTo.set(v); tintT0 = performance.now(); };
    $('dsw').addEventListener('click', () => requestAnimationFrame(readAcc));
    watchCount(d => {
      bursts.push({ t0: performance.now(), dir: d });
      if (d > 0) { for (let n = 0; n < 14; n++) { const i = Math.random() * N | 0; if (base[i] < .6) base[i] = .6; } dirty = true; }
      else fadeDip = .3;
    });
    X.onDay = di => ripples.push({ c: di % COLS, t0: performance.now() });
    if (FINE) addEventListener('pointermove', e => { yawT = (e.clientX / innerWidth - .5) * 2 * .035; pitchT = (e.clientY / innerHeight - .5) * 2 * .021; }, { passive: true });
    X.scene = { renderer, N, ND, LAYERS, COLS, ROWS };
    try { Object.defineProperty(window, 'EDONX', { value: X, writable: false }); } catch (e) {}
  }
});
})();
