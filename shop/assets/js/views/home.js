import { BASE, html, money, icon, $, copyText, fill } from '../lib.js';
import { grid, catUrl, productUrl, productMedia, soldOut, setMeta, toast } from '../ui.js';
import { PAGES } from '../pages.js';

export default function home({ catalog }) {
  const st = catalog.store;
  const live = catalog.products.filter(p => !soldOut(p));
  const featured = live.filter(p => p.featured).slice(0, 8);
  const sale = live.filter(p => p.compareAt > p.price).slice(0, 10);
  const heroPicks = (featured.length >= 3 ? featured : live).slice(0, 3);
  const count = slug => catalog.products.filter(p => p.cat === slug).length;
  const welcome = (st.coupons || [])[0];
  const faq = ((PAGES.faq && PAGES.faq.faq) || []).slice(0, 4);
  const hero = st.hero || {};

  setMeta({
    title: '',
    description: `${st.name}: ${catalog.categories.map(c => c.name).join(', ')}. ${st.announcement || ''}`.trim(),
    ld: {
      '@context': 'https://schema.org', '@type': 'OnlineStore', name: st.name, url: location.origin + BASE + '/',
      ...(st.contact && st.contact.email ? { email: st.contact.email } : {}),
      ...(st.contact && st.contact.phone ? { telephone: st.contact.phone } : {}),
    },
  });

  const body = html`
  <section class="hero" aria-labelledby="hero-h">
    <div class="wrap hero-in">
      <div class="hero-copy">
        ${hero.kicker ? html`<p class="kicker">${icon('spark')}${hero.kicker}</p>` : ''}
        <h1 id="hero-h">${hero.title || st.tagline}</h1>
        ${hero.text ? html`<p class="hero-text">${hero.text}</p>` : ''}
        <div class="hero-cta">
          <a class="btn lg" href="${BASE}/all">${hero.cta || 'לכל המוצרים'} ${icon('arrow')}</a>
          ${sale.length ? html`<a class="btn ghost lg" href="${BASE}/all?f=sale">למבצעים</a>` : ''}
        </div>
      </div>
      <div class="hero-art" aria-hidden="true">
        ${heroPicks.map((p, i) => html`<a class="ha ha-${i + 1}" href="${productUrl(p)}" tabindex="-1">${productMedia(p, { eager: i === 0 })}<span class="ha-tag"><b>${p.name}</b><span>${money(p.price)}</span></span></a>`)}
      </div>
    </div>
  </section>

  ${(st.benefits || []).length ? html`<section class="benefits" aria-label="למה לקנות אצלנו">
    <div class="wrap"><ul class="ben-list" role="list">
      ${st.benefits.map(b => html`<li>${icon(b.icon)}<div><h2>${b.title}</h2><p>${b.text}</p></div></li>`)}
    </ul></div>
  </section>` : ''}

  <section class="sec" aria-labelledby="cats-h">
    <div class="wrap">
      <div class="sec-hd"><h2 id="cats-h">חמש קטגוריות, חנות אחת</h2><a class="more" href="${BASE}/all">לכל המוצרים ${icon('arrow')}</a></div>
      <ul class="cat-tiles" role="list">
        ${catalog.categories.map((c, i) => {
          const pick = catalog.products.find(p => p.cat === c.slug && p.featured) || catalog.products.find(p => p.cat === c.slug);
          return html`<li class="tile t-${i + 1}" style="--h:${c.hue}">
            <a href="${catUrl(c)}">
              <span class="tile-media">${pick ? productMedia(pick) : ''}</span>
              <span class="tile-body">
                <span class="tile-ic">${icon(c.icon)}</span>
                <span class="tile-name">${c.name}</span>
                <span class="tile-blurb">${c.blurb}</span>
                <span class="tile-count">${count(c.slug)} מוצרים ${icon('arrow')}</span>
              </span>
            </a>
          </li>`;
        })}
      </ul>
    </div>
  </section>

  ${featured.length ? html`<section class="sec" aria-labelledby="feat-h">
    <div class="wrap">
      <div class="sec-hd"><h2 id="feat-h">הנבחרים שלנו</h2><a class="more" href="${BASE}/all">לכל המוצרים ${icon('arrow')}</a></div>
      ${grid(featured)}
    </div>
  </section>` : ''}

  ${sale.length ? html`<section class="sec sale-sec" aria-labelledby="sale-h">
    <div class="wrap">
      <div class="sec-hd"><h2 id="sale-h">במבצע עכשיו</h2><a class="more" href="${BASE}/all?f=sale">לכל המבצעים ${icon('arrow')}</a></div>
      <div class="rail" tabindex="0" role="region" aria-label="מוצרים במבצע, אפשר לגלול לצדדים">${grid(sale)}</div>
    </div>
  </section>` : ''}

  ${welcome ? html`<section class="sec" aria-labelledby="news-h">
    <div class="wrap">
      <div class="news" id="news">
        <div class="news-copy">
          <p class="kicker">${icon('tag')}להזמנה הראשונה</p>
          <h2 id="news-h">${welcome.label}</h2>
          <p class="news-text" id="news-text">הקוד נכנס בקופה, בשדה „קוד קופון”.</p>
        </div>
        <div class="news-act" id="news-act">
          <div class="code-box"><span class="vh">קוד הקופון: </span><code>${welcome.code}</code><button type="button" class="btn sm" data-copy="${welcome.code}">${icon('copy')}העתקה</button></div>
        </div>
      </div>
    </div>
  </section>` : ''}

  ${faq.length ? html`<section class="sec" aria-labelledby="faq-h">
    <div class="wrap narrow">
      <div class="sec-hd"><h2 id="faq-h">שאלות שחוזרות אלינו</h2><a class="more" href="${BASE}/info/faq">לכל השאלות ${icon('arrow')}</a></div>
      <div class="faq">${faq.map(f => html`<details><summary>${f.q}${icon('down')}</summary><div class="faq-a"><p>${fill(f.a, st)}</p></div></details>`)}</div>
    </div>
  </section>` : ''}`;

  return {
    name: 'home', body,
    mount(root) {
      root.addEventListener('click', onCopy);
      if (welcome) upgradeNewsletter(root, welcome);
      return () => root.removeEventListener('click', onCopy);
    },
  };
}

function onCopy(e) {
  const b = e.target.closest('[data-copy]');
  if (!b) return;
  copyText(b.dataset.copy).then(ok => toast(ok ? `הקוד ${b.dataset.copy} הועתק` : `הקוד הוא ${b.dataset.copy}`));
}

/* With a mail provider set up (api/subscribe answers ready), the code is handed out in exchange for an email.
   Without one the page just shows the code: an address nobody will ever receive mail at is not collected. */
async function upgradeNewsletter(root, welcome) {
  let ready = false;
  try { const r = await fetch('/api/subscribe', { headers: { Accept: 'application/json' } }); ready = r.ok && (await r.json()).ready === true; } catch (e) {}
  const act = $('#news-act', root);
  if (!ready || !act || !document.contains(act)) return;
  $('#news-text', root).textContent = 'השאירו מייל ונשלח לכם את הקוד, ומדי פעם גם חדשות ומבצעים. אפשר להסיר את עצמכם בכל רגע.';
  act.innerHTML = `<form class="news-form" novalidate>
    <div class="field"><label for="news-email">כתובת מייל</label>
      <div class="news-row"><input id="news-email" name="email" type="email" inputmode="email" autocomplete="email" required aria-describedby="news-err">
      <button class="btn" type="submit">קבלת הקוד</button></div>
      <p class="err" id="news-err" hidden></p></div>
    <label class="check"><input type="checkbox" name="consent" required><span>אני מסכים/ה לקבל עדכונים במייל לפי <a href="${BASE}/info/privacy">מדיניות הפרטיות</a></span></label>
    <input type="text" name="hp" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true">
  </form>`;
  const form = act.querySelector('form'), err = act.querySelector('#news-err'), email = act.querySelector('#news-email');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(form);
    const bad = msg => { err.textContent = msg; err.hidden = false; email.setAttribute('aria-invalid', 'true'); email.focus(); };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(fd.get('email')).trim())) return bad('נראה שחסר משהו בכתובת המייל');
    if (!fd.get('consent')) { err.textContent = 'כדי לשלוח את הקוד צריך לאשר קבלת עדכונים'; err.hidden = false; form.consent.focus(); return; }
    err.hidden = true; email.removeAttribute('aria-invalid');
    const btn = form.querySelector('button'); btn.disabled = true; btn.textContent = 'שולחים…';
    try {
      const r = await fetch('/api/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: String(fd.get('email')).trim(), consent: true, hp: String(fd.get('hp') || '') }) });
      if (!r.ok) throw new Error(r.status);
      act.innerHTML = `<div class="code-box"><span class="vh">קוד הקופון: </span><code>${welcome.code}</code><button type="button" class="btn sm" data-copy="${welcome.code}">העתקה</button></div>`;
      $('#news-text', root).textContent = 'נרשמתם. הנה הקוד שלכם, הוא נכנס בקופה בשדה „קוד קופון”.';
      act.querySelector('button').focus();
    } catch (e2) {
      btn.disabled = false; btn.textContent = 'קבלת הקוד';
      bad('לא הצלחנו לרשום כרגע. אפשר לנסות שוב בעוד רגע.');
    }
  });
}
