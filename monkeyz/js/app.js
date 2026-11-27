/* Monkeyz Boutique menu: 18+ gate, Hebrew/English, the menu itself, item sheet, opening hours. */
(() => {
  'use strict';

  const D = window.MZ_DATA;
  const EN = window.MZ_EN || {};
  const root = document.documentElement;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get: k => { try { return localStorage.getItem('mz.' + k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem('mz.' + k, v); } catch (e) { /* private mode: fine */ } }
  };

  // Hebrew is the page's own text; keep a copy so switching back is lossless
  const HE = {}, HE_LABEL = {};
  $$('[data-i18n]').forEach(el => { HE[el.dataset.i18n] = el.innerHTML; });
  $$('[data-i18n-label]').forEach(el => { HE_LABEL[el.dataset.i18nLabel] = el.getAttribute('aria-label'); });
  const HE_TITLE = document.title;

  const UI = {
    he: {
      all: 'הכל', sativa: 'סאטיבה', indica: 'אינדיקה', hybrid: 'היבריד',
      perG: 'לגרם', perPc: 'ליחידה', atTill: 'בקופה',
      soldOut: 'אזל', empty: 'אין כרגע פריטים שמתאימים לסינון.',
      updated: 'עודכן ב-{d}. המלאי משתנה, והתפריט בחנות הוא הקובע.',
      rate: 'המחירים בשקלים הם הערכה לפי {r}. בקופה משלמים באירו.',
      genetics: 'גנטיקה', aroma: 'ארומה', type: 'סוג',
      fineG: 'עד 5 גרם לאדם ביום · נמכר רק בחנות',
      finePc: 'נמכר רק בחנות · מתחילים מחצי',
      openUntil: 'פתוח עכשיו · עד {t}', opensAt: 'סגור עכשיו · נפתח ב-{t}', opensDay: 'סגור עכשיו · נפתח ביום {d} ב-{t}',
      closed: 'סגור', today: 'היום',
      days: ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'],
      photo: 'תמונה {n}',
      langBtn: 'EN', langLabel: 'Switch to English', gateLang: 'English',
      locale: 'he-IL', dateFmt: { day: 'numeric', month: 'numeric', year: 'numeric' }
    },
    en: {
      all: 'All', sativa: 'Sativa', indica: 'Indica', hybrid: 'Hybrid',
      perG: 'per gram', perPc: 'each', atTill: 'at the counter',
      soldOut: 'Sold out', empty: 'Nothing matches this filter right now.',
      updated: 'Updated {d}. Stock changes, and the in-shop menu is final.',
      rate: 'Shekel prices are estimates at {r}. You pay in euros at the counter.',
      genetics: 'Genetics', aroma: 'Aroma', type: 'Type',
      fineG: 'Up to 5 g per person a day · sold in the shop only',
      finePc: 'Sold in the shop only · start with half',
      openUntil: 'Open now · until {t}', opensAt: 'Closed now · opens at {t}', opensDay: 'Closed now · opens {d} at {t}',
      closed: 'Closed', today: 'Today',
      days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      photo: 'Photo {n}',
      langBtn: 'עב', langLabel: 'מעבר לעברית', gateLang: 'עברית',
      locale: 'en-GB', dateFmt: { day: 'numeric', month: 'short', year: 'numeric' }
    }
  };

  let lang = root.lang === 'en' ? 'en' : 'he';
  const t = (k, vars) => {
    let s = UI[lang][k];
    if (vars) for (const v in vars) s = s.split('{' + v + '}').join(vars[v]);
    return s;
  };
  const L = o => (o && typeof o === 'object') ? (o[lang] != null ? o[lang] : o.he) : (o || '');
  const state = { cat: 'all', type: 'all' };

  /* ---------- money ---------- */
  const ils = eur => new Intl.NumberFormat(t('locale'), { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(Math.round(eur * D.ilsPerEur));
  const eur = n => new Intl.NumberFormat(t('locale'), { style: 'currency', currency: 'EUR', minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(n);
  const rateText = () => D.ilsPerEur.toFixed(2);

  /* ---------- age gate ---------- */
  const page = $('#page');
  function gateOpen() { return !root.classList.contains('ok18'); }
  function syncGate() {
    page.inert = gateOpen();
    if (gateOpen()) $('#gate-yes').focus({ preventScroll: true });
  }
  $('#gate-yes').addEventListener('click', () => {
    store.set('18', '1');
    root.classList.add('ok18');
    syncGate();
    const back = location.hash && D.items.some(i => i.id === location.hash.slice(1));
    if (back) openItem(location.hash.slice(1)); else $('#top').focus({ preventScroll: true });
  });
  $('#gate-no').addEventListener('click', () => {
    $('#gate-actions').hidden = true;
    $('#gate-sorry').hidden = false;
  });

  /* ---------- language ---------- */
  function applyLang() {
    root.lang = lang;
    root.dir = lang === 'he' ? 'rtl' : 'ltr';
    $$('[data-i18n]').forEach(el => {
      const k = el.dataset.i18n, v = lang === 'he' ? HE[k] : EN[k];
      if (v != null) el.innerHTML = v;
    });
    $$('[data-i18n-label]').forEach(el => {
      const k = el.dataset.i18nLabel, v = lang === 'he' ? HE_LABEL[k] : EN[k];
      if (v != null) el.setAttribute('aria-label', v);
    });
    document.title = lang === 'he' ? HE_TITLE : 'Monkeyz Boutique · Amsterdam · Menu';
    $$('[data-lang-toggle]').forEach(b => {
      if (b.classList.contains('gate-lang')) { b.textContent = t('gateLang'); }
      else { b.textContent = t('langBtn'); b.setAttribute('aria-label', t('langLabel')); }
    });
    fillShop();
    renderFilters();
    renderMenu();
    renderHours();
    renderStatus();
    if (dlg.open && current) fillItem(current);
    root.classList.add('ready');
  }
  $$('[data-lang-toggle]').forEach(b => b.addEventListener('click', () => {
    lang = lang === 'he' ? 'en' : 'he';
    store.set('lang', lang);
    applyLang();
  }));

  /* ---------- shop details ---------- */
  function fillShop() {
    const s = D.shop;
    $$('[data-shop]').forEach(el => { el.textContent = L(s[el.dataset.shop]); });
    $$('[data-rate]').forEach(el => { el.textContent = rateText(); });
    $('#company').innerHTML = [s.legalName, 'KvK ' + s.kvk, L(s.address)].map(x => `<bdi>${esc(x)}</bdi>`).join(' · ');
    const maps = $('#maps');
    if (s.mapsQuery) {
      maps.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(s.mapsQuery);
      maps.hidden = false;
    } else maps.hidden = true;
    $('#demo').hidden = !D.demo;
    const d = new Date(D.updated + 'T12:00:00');
    $('#menu-note').textContent = t('updated', { d: d.toLocaleDateString(t('locale'), t('dateFmt')) });
    $('#rate-note').innerHTML = esc(t('rate', { r: '\u0000' })).replace('\u0000', `<bdi dir="ltr">€1 = ₪${rateText()}</bdi>`);
  }

  /* ---------- filters ---------- */
  const tabs = $('#tabs'), chips = $('#chips');
  const hasTypes = cat => D.items.some(i => i.type && (cat === 'all' || i.cat === cat));

  function renderFilters() {
    const cats = [{ id: 'all' }].concat(D.cats);
    tabs.innerHTML = cats.map(c => {
      const n = c.id === 'all' ? D.items.length : D.items.filter(i => i.cat === c.id).length;
      return `<button type="button" class="tab" data-cat="${c.id}" aria-pressed="${state.cat === c.id}">${esc(c.id === 'all' ? t('all') : L(c))}<span>${n}</span></button>`;
    }).join('');
    const types = ['all', 'sativa', 'indica', 'hybrid'];
    chips.innerHTML = types.map(x =>
      `<button type="button" class="chip${x === 'all' ? '' : ' t-' + x}" data-type="${x}" aria-pressed="${state.type === x}">${x === 'all' ? '' : '<i aria-hidden="true"></i>'}${esc(t(x))}</button>`
    ).join('');
    chips.hidden = !hasTypes(state.cat);
  }
  tabs.addEventListener('click', e => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    state.cat = b.dataset.cat;
    if (!hasTypes(state.cat)) state.type = 'all';
    renderFilters();
    renderMenu();
  });
  chips.addEventListener('click', e => {
    const b = e.target.closest('[data-type]');
    if (!b) return;
    state.type = b.dataset.type;
    renderFilters();
    renderMenu();
  });

  /* ---------- menu ---------- */
  const list = $('#menu-list');
  const unit = i => t(i.unit === 'pc' ? 'perPc' : 'perG');
  const meta = i => i.thc ? `<bdi dir="ltr">THC ${esc(i.thc)}</bdi>` : esc(L(i.short));

  function card(i) {
    return `<li><button type="button" class="card${i.soldOut ? ' is-out' : ''}" data-id="${esc(i.id)}" aria-haspopup="dialog">
      <span class="card-img"><img src="/monkeyz/img/menu/${esc(i.id)}-sm.webp" alt="" width="420" height="420" loading="lazy" decoding="async">
        ${i.type ? `<span class="tag t-${i.type}"><i aria-hidden="true"></i>${esc(t(i.type))}</span>` : ''}
        ${i.soldOut ? `<span class="out">${esc(t('soldOut'))}</span>` : ''}</span>
      <span class="card-body">
        <span class="card-name">${esc(i.name)}</span>
        <span class="card-meta">${meta(i)}</span>
        <span class="card-price"><b>${ils(i.eur)}</b><small>${eur(i.eur)} ${esc(unit(i))}</small></span>
      </span></button></li>`;
  }

  function renderMenu() {
    const show = D.cats.filter(c => state.cat === 'all' || c.id === state.cat);
    let html = '';
    show.forEach(c => {
      const items = D.items.filter(i => i.cat === c.id && (state.type === 'all' || i.type === state.type));
      if (!items.length) return;
      html += `<section class="group" aria-labelledby="g-${c.id}">
        <div class="group-head"><h3 id="g-${c.id}">${esc(L(c))}</h3>${c.note ? `<p>${esc(L(c.note))}</p>` : ''}</div>
        <ul class="grid" role="list">${items.map(card).join('')}</ul></section>`;
    });
    list.innerHTML = html || `<p class="empty">${esc(t('empty'))}</p>`;
  }
  list.addEventListener('click', e => {
    const b = e.target.closest('.card');
    if (b) openItem(b.dataset.id, b);
  });

  /* ---------- item sheet ---------- */
  const dlg = $('#item'), gal = $('#gal'), dots = $('#dots');
  let current = null, opener = null;

  function fillItem(i) {
    const cat = D.cats.find(c => c.id === i.cat);
    $('#item-cat').textContent = [L(cat), i.type ? t(i.type) : ''].filter(Boolean).join(' · ');
    $('#item-name').textContent = i.name;
    const lin = $('#item-lineage');
    lin.textContent = i.lineage || L(i.short);
    lin.hidden = !lin.textContent;
    const stats = [];
    if (i.thc) stats.push(['THC', i.thc, 1]);
    if (i.cbd) stats.push(['CBD', i.cbd, 1]);
    if (i.aroma) stats.push([t('aroma'), L(i.aroma)]);
    $('#item-stats').innerHTML = stats.map(([k, v, num]) => `<div><dt>${esc(k)}</dt><dd>${num ? `<bdi dir="ltr">${esc(v)}</bdi>` : esc(v)}</dd></div>`).join('');
    $('#item-desc').textContent = L(i.desc);
    $('#item-price').innerHTML = `<b>${ils(i.eur)}</b><span>${esc(unit(i))}</span><small>${eur(i.eur)} ${esc(t('atTill'))}</small>`;
    $('#item-fine').textContent = i.soldOut ? t('soldOut') : t(i.unit === 'pc' ? 'finePc' : 'fineG');
    const n = Math.max(1, i.photos || 1);
    gal.innerHTML = Array.from({ length: n }, (_, k) =>
      `<img src="/monkeyz/img/menu/${esc(i.id)}-${k + 1}.webp" alt="${esc(i.name + (n > 1 ? ' · ' + t('photo', { n: k + 1 }) : ''))}" width="800" height="800" decoding="async">`).join('');
    dots.innerHTML = n > 1 ? Array.from({ length: n }, (_, k) =>
      `<button type="button" data-k="${k}" aria-label="${esc(t('photo', { n: k + 1 }))}" aria-current="${k === 0}"></button>`).join('') : '';
    gal.scrollLeft = 0;
  }

  function openItem(id, from) {
    const i = D.items.find(x => x.id === id);
    if (!i || gateOpen()) return;
    current = i;
    opener = from || null;
    fillItem(i);
    if (!dlg.open) dlg.showModal();
    $('#item-close').focus({ preventScroll: true });
    if (location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
  }
  $('#item-close').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => {
    current = null;
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
  });
  dots.addEventListener('click', e => {
    const b = e.target.closest('[data-k]');
    if (b) gal.scrollTo({ left: gal.clientWidth * +b.dataset.k, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });
  gal.addEventListener('scroll', () => {
    const k = Math.round(gal.scrollLeft / Math.max(1, gal.clientWidth));
    $$('button', dots).forEach((b, j) => b.setAttribute('aria-current', String(j === k)));
  }, { passive: true });

  /* ---------- hours ---------- */
  function amsNow() {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Amsterdam', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date());
    const g = k => (p.find(x => x.type === k) || {}).value;
    return { wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(g('weekday')), min: (+g('hour') % 24) * 60 + +g('minute') };
  }
  const toMin = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };

  function openState() {
    const H = D.shop.hours, now = amsNow();
    const y = H[(now.wd + 6) % 7];
    if (y && toMin(y[1]) <= toMin(y[0]) && now.min < toMin(y[1])) return { open: true, until: y[1] };
    const d = H[now.wd];
    if (d) {
      const o = toMin(d[0]), c = toMin(d[1]);
      if (now.min >= o && (c <= o || now.min < c)) return { open: true, until: d[1] };
      if (now.min < o) return { open: false, at: d[0], day: now.wd, today: true };
    }
    for (let k = 1; k <= 7; k++) {
      const wd = (now.wd + k) % 7;
      if (H[wd]) return { open: false, at: H[wd][0], day: wd, today: false };
    }
    return { open: false };
  }

  function renderStatus() {
    const s = openState(), el = $('#status');
    el.classList.toggle('is-open', s.open);
    $('span', el).textContent = s.open ? t('openUntil', { t: s.until })
      : s.at ? (s.today ? t('opensAt', { t: s.at }) : t('opensDay', { d: t('days')[s.day], t: s.at }))
      : t('closed');
  }

  function renderHours() {
    const H = D.shop.hours, today = amsNow().wd;
    const order = lang === 'he' ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 0];
    $('#hours').innerHTML = '<tbody>' + order.map(wd => {
      const h = H[wd], cur = wd === today;
      return `<tr${cur ? ' class="is-today"' : ''}><th scope="row">${esc(t('days')[wd])}${cur ? ` <span>${esc(t('today'))}</span>` : ''}</th>
        <td><bdi dir="ltr">${h ? esc(h[0]) + '–' + esc(h[1]) : esc(t('closed'))}</bdi></td></tr>`;
    }).join('') + '</tbody>';
  }

  /* ---------- start ---------- */
  applyLang();
  syncGate();
  setInterval(renderStatus, 60 * 1000);
  const deep = location.hash.slice(1);
  if (deep && D.items.some(i => i.id === deep)) openItem(deep);
})();
