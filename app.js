(() => {
'use strict';
const $ = id => document.getElementById(id), $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const H = document.documentElement;
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = matchMedia('(hover:hover) and (pointer:fine)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const safe = fn => { try { fn(); } catch (e) { console.error(e); } };
const GLYPHS = 'אבגדהוזחטיכלמנסעפצקרשת0123456789';
const ils = n => '₪' + n.toLocaleString('en-US');
const easeOut = k => 1 - Math.pow(1 - k, 3);
const easeBack = k => { const c = .7, c3 = c + 1; return 1 + c3 * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
const replay = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

/* ---------- text scramble ---------- */
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
// decode in place while the box width tweens to the new word, so the line never jumps mid-scramble
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

/* ---------- intro: power switch ---------- */
let site = false;
function powerOn(fast) {
  if (site) return; site = true;
  try { sessionStorage.setItem('edon-on' + (H.dataset.theme ? '-' + H.dataset.theme : ''), '1'); } catch (e) {}
  const intro = $('intro');
  if (intro) { intro.classList.add('out'); setTimeout(() => intro.remove(), 900); }
  const enter = () => { H.classList.remove('lock'); H.classList.add('on'); startHero(); };
  if (!fast && !RM && $('stories')) { try { startStories(enter); return; } catch (e) { console.error(e); } }
  enter();
}
safe(() => {
  const intro = $('intro');
  if (!intro) return;
  if (H.classList.contains('on')) { intro.remove(); return; }
  // boot: typed character by character, ~1s in total, cursor rides the active line
  const LINES = [[['EDON.STUDIO '], ['v2.0', 1]], [['> loading interface .......... '], ['ok', 1]], [['> booking engine ............. '], ['ok', 1]], [['> hebrew typography .......... '], ['ok', 1]], [['> waiting for input']]];
  const boot = $('boot');
  const seq = []; LINES.forEach((l, li) => l.forEach(s => Array.from(s[0]).forEach(ch => seq.push([li, ch, !!s[1]]))));
  const rows = LINES.map(() => document.createElement('div'));
  let bi = 0, cur = -1, node = null; const bt0 = performance.now() + 140, per = 950 / seq.length;
  const type = now => {
    const n = RM ? seq.length : Math.min(seq.length, Math.floor((now - bt0) / per));
    while (bi < n) {
      const [li, ch, b] = seq[bi++];
      if (li !== cur) { if (cur >= 0) rows[cur].classList.remove('cu'); cur = li; boot.appendChild(rows[li]); rows[li].classList.add('cu'); node = null; }
      if (b) { if (!node || node.nodeType !== 1) { node = document.createElement('b'); rows[li].appendChild(node); } }
      else if (!node || node.nodeType !== 3) { node = document.createTextNode(''); rows[li].appendChild(node); }
      node.textContent += ch;
    }
    if (bi < seq.length) requestAnimationFrame(type);
  };
  requestAnimationFrame(type);

  const pw = $('pw'), knob = pw.querySelector('.knob'), ist = $('ist'), pwr = intro.querySelector('.bl b');
  let travel = 0, p = 0, dragging = false, sx = 0, sp = 0, moved = false, det = false;
  const measure = () => { travel = pw.clientWidth - knob.offsetWidth - knob.offsetLeft * 2; };
  const set = v => { p = clamp(v, 0, 1); pw.style.setProperty('--p', p.toFixed(3)); pw.style.setProperty('--tx', (p * travel).toFixed(1) + 'px'); pwr.textContent = Math.round(p * 100) + '%'; };
  measure(); addEventListener('resize', measure);
  // beats: snap → bloom from the knob → scanline/glitch flash → surge wipe → hero enters (short = skip/auto-on)
  const seqOn = short => {
    if (pw.classList.contains('on')) return;
    measure(); set(1); pw.classList.add('on'); pw.classList.remove('press', 'det'); pw.setAttribute('aria-checked', 'true'); ist.textContent = 'ONLINE'; click(220);
    const r = knob.getBoundingClientRect(), s = $('surge'), bl = $('bloom');
    const x = short ? innerWidth / 2 : r.left + r.width / 2, y = short ? innerHeight / 2 : r.top + r.height / 2;
    [s, bl].forEach(el => { el.style.setProperty('--x', x + 'px'); el.style.setProperty('--y', y + 'px'); });
    if (RM) { powerOn(true); return; }
    const T = short ? .5 : 1;
    if (!short) bl.classList.add('go');
    setTimeout(() => intro.classList.add('flash'), 160 * T);
    setTimeout(() => s.classList.add('go'), 340 * T);
    setTimeout(() => powerOn(short), 700 * T);
  };
  const on = () => seqOn(false);
  pw.addEventListener('pointerdown', e => { if (pw.classList.contains('on')) return; dragging = true; moved = false; det = false; sx = e.clientX; sp = p; pw.classList.add('drag', 'press'); pw.setPointerCapture(e.pointerId); measure(); });
  pw.addEventListener('pointermove', e => {
    if (!dragging) return;
    let v = sp + (e.clientX - sx) / travel; if (Math.abs(e.clientX - sx) > 4) moved = true;
    // soft detent: past 82% the knob is pulled home and ticks once
    if (v > .82) { v = .82 + (v - .82) * 1.6; if (!det) { det = true; click(90); pw.classList.add('det'); } }
    else if (det) { det = false; pw.classList.remove('det'); }
    set(v);
  });
  const end = () => { if (!dragging) return; dragging = false; pw.classList.remove('drag', 'press', 'det'); if (!moved || p > .5) on(); else set(0); };
  pw.addEventListener('pointerup', end); pw.addEventListener('pointercancel', end);
  pw.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); on(); } });
  $('skip').addEventListener('click', () => seqOn(true));
  addEventListener('wheel', () => { if (!site) on(); }, { passive: true, once: true });
  let ty = null;
  intro.addEventListener('touchstart', e => { ty = e.target.closest('.pw') ? null : e.touches[0].clientY; }, { passive: true });
  intro.addEventListener('touchmove', e => { if (ty !== null && Math.abs(e.touches[0].clientY - ty) > 60 && !site) on(); }, { passive: true });
  setTimeout(() => { if (!site) seqOn(true); }, 14000);
  setTimeout(() => pw.focus({ preventScroll: true }), 1200);
});

/* ---------- hero: line masks → decode, rotating word, counters, device tilt ---------- */
let heroStarted = false;
function startHero() {
  if (heroStarted) return; heroStarted = true;
  safe(() => {
    const l1 = $('l1'), rot = $('rot');
    const t1 = l1.textContent;
    setTimeout(() => scramble(l1, t1, 800), 420);
    const words = ['דיגיטל', 'אתר', 'אפליקציה', 'תורים', 'מיתוג', 'אינסטגרם'];
    let i = 0;
    setTimeout(() => scramble(rot, words[0], 900), 600);
    if (!RM) setInterval(() => { if (document.hidden) return; i = (i + 1) % words.length; swapWord(rot, words[i], 650); }, 2800);
  });
  safe(() => $$('.hero [data-count]').forEach(countUp));
}
if (H.classList.contains('on')) { site = true; addEventListener('DOMContentLoaded', startHero); if (document.readyState !== 'loading') startHero(); }

function countUp(el) {
  if (el.dataset.done) return; el.dataset.done = 1;
  const to = +el.dataset.count; if (RM || !isFinite(to)) { el.textContent = to; return; }
  const t0 = performance.now(), dur = 1000 + to * 4;
  const tick = now => { const k = clamp((now - t0) / dur, 0, 1); el.textContent = Math.max(0, Math.round(to * easeBack(k))); if (k < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}

/* ---------- clock + header + progress + nav highlight ---------- */
safe(() => {
  const tick = () => { const t = new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }); ['clock', 'clock2', 'sbt'].forEach(id => { const el = $(id); if (el) el.textContent = t; }); };
  tick(); setInterval(tick, 20000);
  const hdr = $('hdr'), prog = $('prog');
  let raf = 0;
  const onScroll = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; const y = scrollY; hdr.classList.toggle('sc', y > 20); const max = H.scrollHeight - innerHeight; prog.style.transform = 'scaleX(' + (max > 0 ? y / max : 0) + ')'; }); };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  const links = $$('nav a'), secs = links.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  const spy = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) links.forEach(a => a.classList.toggle('cur', a.getAttribute('href') === '#' + e.target.id)); }), { rootMargin: '-40% 0px -55% 0px' });
  secs.forEach(s => spy.observe(s));
});

/* ---------- mobile menu ---------- */
safe(() => {
  const b = $('burger'), m = $('menu');
  const close = () => { H.classList.remove('menu'); b.setAttribute('aria-expanded', 'false'); m.setAttribute('aria-hidden', 'true'); };
  b.addEventListener('click', () => { const o = !H.classList.contains('menu'); H.classList.toggle('menu', o); b.setAttribute('aria-expanded', o); m.setAttribute('aria-hidden', !o); });
  $$('#menu a').forEach(a => a.addEventListener('click', close));
  addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
});

/* ---------- torch (flashlight) mode ---------- */
safe(() => {
  const t = $('torch'), d = $('dark'), hint = $('hint');
  let ht, raf = 0, px = 0, py = 0;
  const showHint = s => { hint.textContent = s; hint.classList.add('show'); clearTimeout(ht); ht = setTimeout(() => hint.classList.remove('show'), 2600); };
  const move = e => { const p = e.touches ? e.touches[0] : e; px = p.clientX; py = p.clientY; if (!raf) raf = requestAnimationFrame(() => { raf = 0; d.style.setProperty('--x', px + 'px'); d.style.setProperty('--y', py + 'px'); }); };
  t.addEventListener('click', () => {
    const on = !H.classList.contains('torch'); H.classList.toggle('torch', on); t.setAttribute('aria-checked', on); click(on ? 140 : 220);
    if (on) { d.style.setProperty('--x', innerWidth / 2 + 'px'); d.style.setProperty('--y', innerHeight / 2 + 'px'); showHint('כיבינו את האור. הזיזו את האצבע או העכבר. לחיצה נוספת על המתג מדליקה.'); }
  });
  addEventListener('pointermove', move, { passive: true }); addEventListener('touchmove', move, { passive: true });
  addEventListener('keydown', e => { if (e.key === 'Escape' && H.classList.contains('torch')) t.click(); });
});

/* ---------- reveal + glitch + counters + process ---------- */
safe(() => {
  $$('.gl').forEach(h => h.dataset.t = h.textContent.trim());
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('on'); io.unobserve(e.target);
    $$('[data-count]', e.target).forEach(countUp);
    const g = e.target.matches('.gl') ? e.target : e.target.querySelector('.gl');
    if (g && !RM) { g.classList.add('hit'); setTimeout(() => g.classList.remove('hit'), 600); }
  }), { threshold: .12, rootMargin: '0px 0px -8% 0px' });
  $$('[data-reveal]').forEach(el => io.observe(el));
  const proc = $('process'), steps = $$('#steps li');
  let raf = 0;
  const upd = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; const r = proc.getBoundingClientRect(); const p = clamp((innerHeight * .8 - r.top - 120) / (r.height - 120), 0, 1); proc.style.setProperty('--prog', p.toFixed(3)); steps.forEach((li, i) => li.classList.toggle('lit', p >= (i + .5) / steps.length - .12)); }); };
  addEventListener('scroll', upd, { passive: true }); addEventListener('resize', upd); upd();
});

/* ---------- ticker: velocity-aware marquee ---------- */
safe(() => {
  const row = document.querySelector('.tick .row'); if (!row || RM) return;
  row.classList.add('js');
  let x = 0, half = 0, vel = 0, last = scrollY, lt = performance.now(), vis = false;
  const measure = () => { half = row.scrollWidth / 2; }; measure(); addEventListener('resize', measure);
  new IntersectionObserver(es => es.forEach(e => { vis = e.isIntersecting; })).observe(row.parentElement);
  addEventListener('scroll', () => { const now = performance.now(), dt = Math.max(16, now - lt); vel = vel * .5 + ((scrollY - last) / dt) * 8; last = scrollY; lt = now; }, { passive: true });
  (function loop() {
    if (vis && half) { vel *= .94; x -= .9 + clamp(Math.abs(vel), 0, 40) * .12; if (x <= -half) x += half; row.style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,0)'; }
    requestAnimationFrame(loop);
  })();
});

/* ---------- live demo: four business types, one booking engine ---------- */
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

  // runtime state per business: seeded availability, bookings, where the customer is in the flow
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
  const BACK = '<button class="back" type="button">→ חזרה</button>';

  // native-feeling navigation: current screen slides out along the reading direction, next one slides in
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
      const X = D.extra;
      if (X.kind === 'design') {
        html = crumbs() + BACK + '<h4>' + X.title + '</h4><div class="sw">' + X.colors.map((c, i) => '<button type="button" class="swb" data-c="' + i + '" style="--c:' + c + '" aria-pressed="' + (i === s.color) + '" aria-label="צבע ' + (i + 1) + '"></button>').join('') + '</div><div class="styles">' + X.styles.map((n, i) => '<button type="button" class="stl" data-s="' + i + '" aria-pressed="' + (i === s.style) + '">' + n + '</button>').join('') + '</div><div class="nails ' + ['', 'fr', 'om'][s.style] + '" style="--c:' + X.colors[s.color] + '" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div><button class="cta" type="button" id="exgo">המשך לבחירת מועד</button>';
      } else {
        html = crumbs() + BACK + '<h4>' + X.title + '</h4>' + X.opts.map((o, i) => '<button class="row" type="button" data-ex="' + i + '"><span class="ic' + (X.kind === 'staff' ? ' av2' : '') + '">' + o.i + '</span><div><b>' + o.n + '</b><small>' + o.s + '</small></div>' + (o.add ? '<span class="pr">+₪' + o.add + '</span>' : '') + '</button>').join('');
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
      const v = curSvc(), d = days[s.di], ex = exOpt(), X = D.extra;
      let rows = '<div><span>' + (D.classes ? 'שיעור' : 'שירות') + '</span><b>' + v.n + '</b></div>';
      if (X && X.kind === 'staff') rows += '<div><span>אצל</span><b>' + ex.n + '</b></div>';
      if (X && X.kind === 'vehicle') rows += '<div><span>רכב</span><b>' + ex.n + '</b></div>';
      if (X && X.kind === 'design') rows += '<div><span>עיצוב</span><b><i class="dotc" style="--c:' + X.colors[s.color] + '"></i>' + X.styles[s.style] + '</b></div>';
      rows += '<div><span>מתי</span><b>' + dayName(s.di) + ' · ' + d.getDate() + '.' + (d.getMonth() + 1) + ' · ' + s.slot + '</b></div><div><span>משך</span><b>' + curDur() + ' דק׳</b></div><div><span>מחיר</span><b>₪' + curPrice() + '</b></div>';
      html = crumbs() + BACK + '<h4>' + (D.classes ? 'אישור ההרשמה' : 'אישור התור') + '</h4><div class="sum">' + rows + '</div><input class="nm" type="text" id="nm" maxlength="24" autocomplete="off" placeholder="השם שלכם (לא חובה)" value="' + esc(s.name) + '"><button class="cta" type="button" id="confirm">' + (D.classes ? 'הרשמה לשיעור' : 'אישור התור') + '</button><p class="note2">בלי הרשמה, בלי הורדה. ביטול חינם עד 3 שעות לפני.</p>';
    } else if (kind === 'done') {
      const b = s.booking;
      html = '<div class="ok"><svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="35"/><path d="M24 41l11 11 21-23"/></svg><b>' + (D.classes ? 'נרשמתם לשיעור!' : 'התור נקבע!') + '</b><p>' + b.when + ' · ' + b.v.n + '</p><span class="chip">' + (D.classes ? 'נשארו ' + s.caps.get(b.key) + ' מקומות בשיעור' : (b.cov.length > 1 ? b.cov.length + ' חלונות נחסמו לשאר הלקוחות' : 'השעה נחסמה לשאר הלקוחות')) + '</span><p class="note2">העסק קיבל התראה. תזכורת תישלח אליכם יום לפני.</p><div class="acts"><button type="button" id="cal">＋ הוספה ליומן</button><button type="button" id="cancel">ביטול</button></div></div><button class="cta" type="button" id="again">' + (D.classes ? 'להירשם לשיעור נוסף' : 'לקבוע תור נוסף') + '</button>';
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
    $$('[data-di]', body).forEach(b => b.addEventListener('click', () => { s.di = +b.dataset.di; render(); ownerPaint(false); }));
    $$('[data-t]', body).forEach(b => b.addEventListener('click', () => { s.slot = b.dataset.t; b.classList.add('pick'); click(260); nav(s.step + 1, 1); }));
    const nm = $('nm'); if (nm) nm.addEventListener('input', () => { s.name = nm.value; });
    const cf = $('confirm'); if (cf) cf.addEventListener('click', () => { cf.classList.add('busy'); cf.innerHTML = '<span class="spin"></span>' + (D.classes ? 'שומרים לכם מקום…' : 'שומרים את התור…'); setTimeout(() => { commit(); click(330); nav(s.step + 1, 1); setTimeout(burst, 560); }, RM ? 0 : 700); });
    const cal = $('cal'); if (cal) cal.addEventListener('click', () => { cal.textContent = '✓ נוסף ליומן'; cal.disabled = true; click(300); });
    const cn = $('cancel'); if (cn) cn.addEventListener('click', () => { const acts = cn.parentElement; acts.innerHTML = '<span class="q">לבטל את ' + (D.classes ? 'ההרשמה' : 'התור') + '?</span><button type="button" id="cy" class="danger">כן, לבטל</button><button type="button" id="cno">לא</button>'; $('cy').addEventListener('click', cancelBooking); $('cno').addEventListener('click', () => render()); });
    const ag = $('again'); if (ag) ag.addEventListener('click', () => { s.slot = null; s.booking = null; nav(0, 1); });
  }
  // ≤12 accent particles from the check mark; transform/opacity only, removed when done
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
  // the owner's dashboard follows the day the customer is looking at
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
  function select(key, first) {
    const D = DEMOS.find(x => x.key === key); if (!D || (D === cur && !first)) return;
    cur = D; s = S[D.key];
    stage.style.setProperty('--acc', D.acc); stage.style.setProperty('--acc-fg', D.accFg); stage.style.setProperty('--acc-rgb', D.rgb);
    $$('.dchip', dsw).forEach((b, i) => b.setAttribute('aria-selected', DEMOS[i] === D));
    $('aav').textContent = D.letter; $('aname').textContent = D.name; $('asub').textContent = D.sub; $('ctaBiz').textContent = D.biz;
    if (first) $('capBiz').textContent = D.biz; else scramble($('capBiz'), D.biz, 450);
    toast.classList.remove('show');
    if (!first && !RM) replay(scr, 'swap');
    pend = ''; render(); ownerPaint(false);
    if (!first) click(260);
  }
  DEMOS.forEach(D => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'dchip'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', 'false');
    b.style.setProperty('--acc', D.acc); b.style.setProperty('--acc-fg', D.accFg); b.textContent = D.chip; b.dataset.demo = D.key;
    b.addEventListener('click', () => select(D.key)); dsw.appendChild(b);
  });
  select(DEMOS[0].key, true);
  $('demoCta').addEventListener('click', () => { const fb = $('fb'); if (fb && !fb.value) fb.value = cur.bizForm; const r = $$('input[name=svc]').find(i => i.value === 'אפליקציית תורים'); if (r) r.checked = true; });
  $('tryDemo').addEventListener('click', e => { if (innerWidth > 1000) { e.preventDefault(); stage.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'center' }); } });
  // desktop: the device leans toward the pointer (max 4°)
  if (FINE && !RM) {
    const hero = $('top'), dev = document.querySelector('.dev'); let raf = 0, rx = 0, ry = 0;
    hero.addEventListener('pointermove', e => {
      const r = dev.getBoundingClientRect(); ry = clamp((e.clientX - (r.left + r.width / 2)) / innerWidth * 12, -4, 4); rx = clamp((e.clientY - (r.top + r.height / 2)) / innerHeight * 12, -4, 4);
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; dev.style.transform = 'perspective(1200px) rotateY(' + ry.toFixed(2) + 'deg) rotateX(' + (-rx).toFixed(2) + 'deg)'; });
    }, { passive: true });
    hero.addEventListener('pointerleave', () => { dev.style.transform = ''; });
  }
});

/* ---------- manifesto: words light up as you scroll ---------- */
safe(() => {
  const sec = $('manifesto'), t = $('mtext'); if (!sec || !t) return;
  let n = 0;
  const wrap = node => Array.from(node.childNodes).forEach(c => {
    if (c.nodeType !== 3) { wrap(c); return; }
    const frag = document.createDocumentFragment();
    c.textContent.split(/(\s+)/).forEach(part => {
      if (!part) return;
      if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
      const s = document.createElement('span'); s.className = 'w'; s.style.setProperty('--i', n++); s.textContent = part; frag.appendChild(s);
    });
    node.replaceChild(frag, c);
  });
  wrap(t);
  let raf = 0;
  const upd = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; const r = sec.getBoundingClientRect(); const p = clamp(-r.top / (r.height - innerHeight), 0, 1); t.style.setProperty('--k', (p * (n + 1)).toFixed(2)); sec.style.setProperty('--mp', p.toFixed(3)); }); };
  addEventListener('scroll', upd, { passive: true }); addEventListener('resize', upd); upd();
});

/* ---------- showreel: vertical scroll drives the horizontal track on desktop, native snap on mobile ---------- */
safe(() => {
  const sec = $('reel'), track = $('reeltrack'), dots = $('reeldots'); if (!sec || !track) return;
  const figs = $$('figure', track);
  dots.innerHTML = figs.map((_, i) => '<i' + (i ? '' : ' class="on"') + '></i>').join('');
  const ds = $$('i', dots);
  const setDot = i => ds.forEach((d, j) => d.classList.toggle('on', j === i));
  const desk = matchMedia('(min-width: 900px)');
  let raf = 0;
  const upd = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; if (!desk.matches) { track.style.transform = ''; return; } const r = sec.getBoundingClientRect(); const p = clamp(-r.top / (r.height - innerHeight), 0, 1); const max = Math.max(0, track.scrollWidth - innerWidth); track.style.transform = 'translate3d(' + (p * max).toFixed(1) + 'px,0,0)'; setDot(Math.round(p * (figs.length - 1))); }); };
  addEventListener('scroll', upd, { passive: true }); addEventListener('resize', upd); upd();
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting && !desk.matches) setDot(figs.indexOf(e.target)); }), { root: track, threshold: .6 });
  figs.forEach(f => io.observe(f));
});

/* ---------- journey: the line draws as the story unfolds ---------- */
safe(() => {
  const line = $('jline'); if (!line) return;
  const items = $$('li', line); let raf = 0;
  const upd = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; const r = line.getBoundingClientRect(); const p = clamp((innerHeight * .78 - r.top) / r.height, 0, 1); line.style.setProperty('--jp', p.toFixed(3)); items.forEach((li, i) => { const lr = li.getBoundingClientRect(); li.classList.toggle('on', lr.top < innerHeight * .78); }); }); };
  addEventListener('scroll', upd, { passive: true }); addEventListener('resize', upd); upd();
});

/* ---------- stories: a swipeable intro that runs after the switch ---------- */
function startStories(onDone) {
  const root = $('stories'); if (!root) { onDone(); return; }
  const cards = $$('.st', root), bars = $$('.sbars i', root), hint = $('shint'), N = cards.length;
  const DUR = [4200, 5200, 5200, 6500];
  let i = 0, done = false, dx = 0, drag = false, axis = null, sx = 0, sy = 0, t0 = 0, counted = false, wheelT = 0;
  const next = () => cards[i + 1];
  const setClasses = () => cards.forEach((c, k) => { c.classList.toggle('cur', k === i); c.classList.toggle('nxt', k === i + 1); c.classList.toggle('prv', k < i); c.style.transform = ''; c.style.scale = ''; c.style.filter = ''; c.style.opacity = ''; c.style.transition = ''; c.style.setProperty('--dx', '0px'); });
  const paintBars = () => bars.forEach((b, k) => { b.classList.toggle('done', k < i); b.classList.remove('act'); if (k === i) { void b.offsetWidth; b.style.setProperty('--sdur', DUR[i] + 'ms'); b.classList.add('act'); } });
  const countdown = () => {
    if (counted) return; counted = true; const el = $('scount'); if (!el) return;
    if (RM) { el.textContent = '07'; return; }
    const t = performance.now(); const tick = now => { const k = clamp((now - t) / 1500, 0, 1); el.textContent = String(1 + Math.round(6 * easeOut(k))).padStart(2, '0'); if (k < 1) requestAnimationFrame(tick); };
    setTimeout(() => requestAnimationFrame(tick), 350);
  };
  const show = k => { i = clamp(k, 0, N - 1); setClasses(); paintBars(); root.dataset.i = i; if (i === N - 1) countdown(); };
  const finish = () => {
    if (done) return; done = true; click(330);
    root.classList.add('out'); setTimeout(() => root.remove(), 700);
    onDone();
  };
  const go = dir => { if (done) return; hint.classList.add('off'); if (dir > 0 && i === N - 1) { finish(); return; } if (dir < 0 && i === 0) { snap(cards[0]); return; } show(i + dir); click(dir > 0 ? 260 : 200); };
  const snap = c => { c.style.transition = 'transform var(--t-4) var(--e-spring)'; c.style.transform = ''; c.style.setProperty('--dx', '0px'); const n = next(); if (n) { n.style.transition = 'opacity var(--t-3)'; n.style.opacity = ''; n.style.scale = ''; n.style.filter = ''; setTimeout(() => { n.style.transition = ''; }, 400); } setTimeout(() => { c.style.transition = ''; }, 600); };
  const fling = (c, dir) => { c.style.transition = 'transform .32s var(--e-in)'; c.style.transform = 'translateX(' + (dir > 0 ? -120 : 120) + '%) rotate(' + (dir > 0 ? -8 : 8) + 'deg)'; setTimeout(() => go(dir), 230); };
  // the active bar finishing is the auto-advance
  bars.forEach(b => b.addEventListener('animationend', () => { if (!done && b.classList.contains('act') && !drag) go(1); }));
  // drag: the card follows the finger, the next card wakes up underneath (RTL: forward is left)
  root.addEventListener('pointerdown', e => { if (done || e.target.closest('button')) return; drag = true; axis = null; dx = 0; sx = e.clientX; sy = e.clientY; t0 = performance.now(); root.classList.add('hold'); try { root.setPointerCapture(e.pointerId); } catch (err) {} });
  root.addEventListener('pointermove', e => {
    if (!drag) return;
    const mx = e.clientX - sx, my = e.clientY - sy;
    if (!axis) { if (Math.abs(mx) < 6 && Math.abs(my) < 6) return; axis = Math.abs(mx) > Math.abs(my) ? 'x' : 'y'; }
    if (axis !== 'x') return;
    dx = mx;
    const edge = (dx > 0 && i === 0) || (dx < 0 && i === N - 1) ? .3 : 1, v = dx * edge, c = cards[i];
    c.style.transition = 'none'; c.style.transform = 'translateX(' + v.toFixed(1) + 'px) rotate(' + (v / innerWidth * 6).toFixed(2) + 'deg)'; c.style.setProperty('--dx', v.toFixed(1) + 'px');
    const n = next(); if (n && dx < 0) { const k = clamp(-dx / innerWidth, 0, 1); n.style.opacity = Math.min(1, k * 2.2).toFixed(2); n.style.scale = (.94 + .06 * k).toFixed(3); n.style.filter = 'brightness(' + (.6 + .4 * k).toFixed(2) + ')'; }
  });
  const end = e => {
    if (!drag) return; drag = false; root.classList.remove('hold');
    const dt = performance.now() - t0, c = cards[i], vel = Math.abs(dx) / Math.max(1, dt);
    if (axis === 'x') {
      const far = Math.abs(dx) > innerWidth * .22 || (vel > .55 && Math.abs(dx) > 28);
      if (far && dx < 0) fling(c, 1);
      else if (far && dx > 0 && i > 0) fling(c, -1);
      else snap(c);
    } else if (!axis && dt < 320) {
      const x = e.clientX / innerWidth; if (x < .35) go(1); else if (x > .65) go(-1);
    } else snap(c);
    dx = 0;
  };
  root.addEventListener('pointerup', end); root.addEventListener('pointercancel', end);
  addEventListener('keydown', e => { if (done || !root.isConnected) return; if (e.key === 'ArrowLeft' || e.key === ' ' || e.key === 'Enter') { if (e.target.closest && e.target.closest('button')) return; e.preventDefault(); go(1); } else if (e.key === 'ArrowRight') { e.preventDefault(); go(-1); } else if (e.key === 'Escape') finish(); });
  root.addEventListener('wheel', e => { if (done) return; const now = performance.now(); if (now - wheelT < 900) return; const d = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : -e.deltaX; if (d > 18) { wheelT = now; go(1); } else if (d < -18) { wheelT = now; go(-1); } }, { passive: true });
  $('sskip').addEventListener('click', finish);
  $('senter').addEventListener('click', finish);
  root.hidden = false; root.classList.add('show');
  requestAnimationFrame(() => show(0));
}

/* ---------- configurator ---------- */
const CFG = { page: { n: 'דף עסק', p: 1490 }, app: { n: 'אפליקציית תורים', p: 3490 }, brand: { n: 'מיתוג ואינסטגרם', p: 1990 }, care: { n: 'ליווי חודשי', p: 149 } };
const sel = new Set(['app']);
let cfgState = { total: 3490 };
// odometer: one rolling strip per digit, static glyphs for the currency sign and commas
function odometer(el) {
  let last = null;
  const shape = s => s.replace(/\d/g, '0');
  // the strips are decorative; assistive tech reads the plain value in .sr
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
safe(() => {
  const lines = $('lines'), promo = $('promo'), sel2 = $('sel2');
  const setA = odometer($('total')), setB = odometer($('total2'));
  function calc() {
    const items = ['page', 'app', 'brand'].filter(k => sel.has(k));
    let sub = items.reduce((a, k) => a + CFG[k].p, 0), bundle = sel.has('app') && sel.has('brand') ? 490 : 0, tot = sub - bundle;
    cfgState = { items, bundle, total: tot, care: sel.has('care') };
    let html = items.map(k => '<li><span>' + CFG[k].n + '</span><b>' + ils(CFG[k].p) + '</b></li>').join('');
    if (bundle) html += '<li class="sv"><span>חבילה מלאה · אפליקציה + מיתוג</span><b>−' + ils(bundle) + '</b></li>';
    if (sel.has('care')) html += '<li><span>ליווי חודשי</span><b>' + ils(149) + ' / חודש</b></li>';
    if (!items.length) html += '<li class="em"><span>הדליקו לפחות שירות אחד כדי לראות מחיר. ליווי חודשי מצטרף לכל חבילה.</span></li>';
    lines.innerHTML = html; setA(tot); setB(tot);
    promo.textContent = ils(Math.round(tot * .7 / 10) * 10);
    sel2.textContent = items.length ? items.map(k => CFG[k].n).join(' + ') + (sel.has('care') ? ' + ליווי' : '') : 'בחרו שירות';
  }
  $$('.plan').forEach(b => b.addEventListener('click', () => { const k = b.dataset.plan; sel.has(k) ? sel.delete(k) : sel.add(k); b.setAttribute('aria-pressed', sel.has(k)); replay(b, 'pop'); click(sel.has(k) ? 300 : 180); calc(); }));
  calc();
  // mobile sticky bar: visible while the services section is on screen and the quote itself is not
  const bar = $('cfgbar'), sec = $('services'), bill = $('bill');
  let inSec = false, inBill = false;
  const updBar = () => bar.classList.toggle('show', inSec && !inBill);
  new IntersectionObserver(es => es.forEach(e => { inSec = e.isIntersecting; updBar(); }), { rootMargin: '-30% 0px -20% 0px' }).observe(sec);
  new IntersectionObserver(es => es.forEach(e => { inBill = e.isIntersecting; updBar(); }), { rootMargin: '0px 0px -15% 0px' }).observe(bill);
  $('quote').addEventListener('click', () => prefill(true));
});

/* ---------- contact form ---------- */
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
    $('done').hidden = false; $('st').textContent = 'ההודעה מוכנה. העתיקו, פתחו את הדיירקט והדביקו.'; click(330);
    if (!RM) replay($('done'), 'swap');
    $('done').scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'nearest' });
  });
  const copy = async () => { try { await navigator.clipboard.writeText(msg()); $('st').textContent = 'הועתק. אפשר להדביק ולשלוח.'; return true; } catch (err) { const r = document.createRange(); r.selectNodeContents($('out')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); $('st').textContent = 'סימנו את ההודעה. העתיקו ידנית (לחיצה ארוכה).'; return false; } };
  $('cp').addEventListener('click', copy);
  $('openig').addEventListener('click', () => { copy(); });
});

/* ---------- before / after: switch flips, drag scrubs ---------- */
safe(() => {
  const w = $('baw'), r = $('bar'), sw = $('baflip'); let drag = false, p = 100, raf = 0, touched = false;
  const paint = () => { w.style.setProperty('--p', p + '%'); r.value = Math.round(p); w.style.setProperty('--hdo', (p < 2 || p > 98) ? 0 : 1); sw.setAttribute('aria-checked', p < 50); };
  const to = (v, dur = 900) => { cancelAnimationFrame(raf); if (RM) { p = v; paint(); return; } const f = p, t0 = performance.now(); const tick = now => { const k = clamp((now - t0) / dur, 0, 1); p = f + (v - f) * easeOut(k); paint(); if (k < 1) raf = requestAnimationFrame(tick); }; raf = requestAnimationFrame(tick); };
  const at = e => { cancelAnimationFrame(raf); p = clamp((e.clientX - w.getBoundingClientRect().left) / w.clientWidth * 100, 0, 100); paint(); };
  w.addEventListener('pointerdown', e => { if (e.target.closest('.bsw')) return; touched = true; drag = true; w.classList.add('drag'); w.setPointerCapture(e.pointerId); at(e); });
  w.addEventListener('pointermove', e => { if (drag) at(e); });
  const end = () => { if (!drag) return; drag = false; w.classList.remove('drag'); if (p < 12) to(0, 400); else if (p > 88) to(100, 400); };
  w.addEventListener('pointerup', end); w.addEventListener('pointercancel', end);
  sw.addEventListener('click', () => { touched = true; const on = p >= 50; click(on ? 300 : 180); to(on ? 0 : 100); });
  r.addEventListener('input', () => { touched = true; cancelAnimationFrame(raf); p = +r.value; paint(); });
  paint();
  new IntersectionObserver((es, io) => es.forEach(e => { if (!e.isIntersecting) return; io.disconnect(); setTimeout(() => { if (!touched) { click(300); to(0, 1200); } }, 1400); }), { threshold: .45 }).observe(w);
});

/* ---------- faq ---------- */
safe(() => $$('#faqs .q').forEach(q => { const b = q.querySelector('button'); b.addEventListener('click', () => { const o = q.dataset.open !== 'true'; $$('#faqs .q').forEach(x => { x.dataset.open = 'false'; x.querySelector('button').setAttribute('aria-expanded', 'false'); }); q.dataset.open = o; b.setAttribute('aria-expanded', o); }); }));

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

/* ---------- desktop candy: cursor, magnetic, tilt, glow ---------- */
safe(() => {
  if (!FINE || RM) return;
  const cur = $('cur'); let cx = innerWidth / 2, cy = innerHeight / 2, tx = cx, ty = cy, vis = false;
  addEventListener('pointermove', e => { tx = e.clientX; ty = e.clientY; if (!vis) { vis = true; cur.style.opacity = 1; } const t = e.target.closest && e.target.closest('a,button,[role=switch],.case,.slot,.plan,.ba'); cur.classList.toggle('act', !!t); }, { passive: true });
  document.addEventListener('pointerleave', () => { cur.style.opacity = 0; vis = false; });
  const glow = $('glow'), hero = $('top');
  hero.addEventListener('pointermove', e => { const r = hero.getBoundingClientRect(); glow.style.setProperty('--gx', (e.clientX - r.left) + 'px'); glow.style.setProperty('--gy', (e.clientY - r.top) + 'px'); }, { passive: true });
  (function loop() { cx += (tx - cx) * .16; cy += (ty - cy) * .16; cur.style.transform = 'translate(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px)'; requestAnimationFrame(loop); })();
  // magnetic pull with distance falloff, spring release
  $$('.btn.main, .ig').forEach(b => {
    b.addEventListener('pointermove', e => { const r = b.getBoundingClientRect(); const x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2, f = clamp(1 - Math.hypot(x, y) / r.width, .4, 1); b.style.transition = 'transform 0s'; b.style.transform = 'translate(' + (x * .2 * f).toFixed(1) + 'px,' + (y * .26 * f).toFixed(1) + 'px)'; b.style.setProperty('--mx', (e.clientX - r.left) + 'px'); b.style.setProperty('--my', (e.clientY - r.top) + 'px'); });
    b.addEventListener('pointerleave', () => { b.style.transition = 'transform var(--t-4) var(--e-spring)'; b.style.transform = ''; });
  });
  $$('.case').forEach(c => {
    c.addEventListener('pointermove', e => { const r = c.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height; c.style.setProperty('--ry', ((px - .5) * 6).toFixed(2) + 'deg'); c.style.setProperty('--rx', ((.5 - py) * 6).toFixed(2) + 'deg'); c.style.setProperty('--sx', px * 100 + '%'); c.style.setProperty('--sy', py * 100 + '%'); });
    c.addEventListener('pointerleave', () => { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); });
  });
});
})();
