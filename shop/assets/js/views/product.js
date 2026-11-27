import { BASE, html, str, raw, money, icon, $, $$ } from '../lib.js';
import { crumbs, setMeta, breadcrumbLd, catOf, catUrl, productUrl, productMedia, price, badges, favBtn, grid, soldOut, lowStock, pctOff, stepper, toast, say, absUrl } from '../ui.js';
import * as S from '../state.js';
import { openCart } from '../app.js';

export default function product({ catalog, params }) {
  const p = params.product;
  const st = catalog.store;
  const c = catOf(p);
  const out = soldOut(p);
  const opts = p.options && Array.isArray(p.options.values) && p.options.values.length ? p.options : null;
  const imgs = (p.images || []).length ? p.images.length : 3; // placeholders: three drawn views
  const related = [
    ...catalog.products.filter(x => x.cat === p.cat && x.id !== p.id && !soldOut(x)),
    ...catalog.products.filter(x => x.cat !== p.cat && x.featured && !soldOut(x)),
  ].slice(0, 4);
  const courier = (st.shipping || []).find(s => s.id === 'courier') || (st.shipping || [])[0];
  const off = pctOff(p);
  const crumbItems = [{ name: c.name, url: catUrl(c) }, { name: p.name, url: productUrl(p) }];

  setMeta({
    title: p.name,
    description: `${p.name}: ${p.short} ${money(p.price).replace(/[\u2066\u2069]/g, '')}.`,
    ld: [breadcrumbLd(crumbItems), {
      '@context': 'https://schema.org', '@type': 'Product',
      name: p.name, description: p.desc || p.short, sku: p.id, category: c.name,
      ...((p.images || []).length ? { image: p.images.map(i => absUrl(typeof i === 'string' ? i : i.src)) } : {}),
      brand: { '@type': 'Brand', name: st.name },
      offers: {
        '@type': 'Offer', url: absUrl(productUrl(p)), priceCurrency: 'ILS', price: String(p.price),
        availability: out ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
        itemCondition: 'https://schema.org/NewCondition',
      },
    }],
  });

  const body = html`
  <div class="wrap page pdp">
    ${crumbs(crumbItems)}
    <div class="pdp-grid">
      <div class="gallery">
        <div class="g-main" id="g-main">${productMedia(p, { eager: true, label: true })}${badges(p)}</div>
        ${imgs > 1 ? html`<ul class="g-thumbs" role="list" aria-label="תמונות נוספות">
          ${Array.from({ length: imgs }, (_, i) => html`<li><button type="button" data-img="${i}" aria-pressed="${String(i === 0)}" aria-label="${'תמונה ' + (i + 1) + ' מתוך ' + imgs}">${productMedia(p, { index: i })}</button></li>`)}
        </ul>` : ''}
      </div>

      <div class="buy">
        <a class="buy-cat" href="${catUrl(c)}">${icon(c.icon)}${c.name}</a>
        <h1>${p.name}</h1>
        ${price(p, { big: true })}
        ${off ? html`<p class="save">חוסכים ${money(p.compareAt - p.price)} (${off}%)</p>` : ''}
        <p class="buy-short">${p.short}</p>

        <form class="buy-form" id="buy-form" novalidate>
          ${opts ? html`<fieldset class="opts"><legend>${opts.name}: <b id="opt-now">${opts.values[0]}</b></legend>
            <div class="opt-list">${opts.values.map((v, i) => html`<label class="opt"><input type="radio" name="opt" value="${v}" ${i === 0 ? raw('checked') : ''} ${out ? raw('disabled') : ''}><span>${v}</span></label>`)}</div>
          </fieldset>` : ''}
          ${out ? html`<p class="stock out">${icon('alert')} המוצר אזל מהמלאי כרגע</p>`
            : lowStock(p) ? html`<p class="stock low">${icon('alert')} ${p.stock === 1 ? 'נשאר רק אחד במלאי' : `נשארו רק ${p.stock} במלאי`}</p>`
            : html`<p class="stock ok">${icon('check')} במלאי, יוצא ${courier ? 'תוך ' + courier.eta : 'בקרוב'}</p>`}
          <div class="buy-row">
            ${out ? '' : stepper({ value: 1, max: Math.max(1, S.roomFor(p.id)), label: 'כמות' })}
            <button class="btn lg grow" type="submit" id="add-btn" ${out ? raw('disabled') : ''}>${out ? 'אזל מהמלאי' : html`${icon('cart')}הוספה לסל<span class="add-sum"> · <span id="add-sum">${money(p.price)}</span></span>`}</button>
            ${favBtn(p, 'big')}
          </div>
          ${out && st.contact && st.contact.whatsapp ? html`<a class="btn ghost block" href="https://wa.me/${st.contact.whatsapp}?text=${encodeURIComponent(`היי, אשמח לדעת מתי ${p.name} יחזור למלאי`)}" target="_blank" rel="noopener">${icon('wa')}עדכנו אותי כשיחזור<span class="vh"> (וואטסאפ, נפתח בחלון חדש)</span></a>` : ''}
          <p class="room" id="room" role="status"></p>
        </form>

        <ul class="assure" role="list">
          ${st.freeShippingFrom ? html`<li>${icon('truck')}<span>משלוח חינם בהזמנה מ־${money(st.freeShippingFrom)}${courier ? html`, אחרת ${money(courier.price)}` : ''}</span></li>` : ''}
          <li>${icon('return')}<span>אפשר להחזיר תוך 14 יום. <a href="${BASE}/info/shipping">פרטים</a></span></li>
          <li>${icon('lock')}<span>משלמים רק אחרי שאישרנו את ההזמנה איתכם</span></li>
        </ul>

        <div class="acc">
          <details open><summary>תיאור המוצר${icon('down')}</summary><div class="acc-bd"><p>${p.desc}</p></div></details>
          ${(p.details || []).length ? html`<details><summary>פרטים ומידות${icon('down')}</summary><div class="acc-bd"><ul>${p.details.map(d => html`<li>${d}</li>`)}</ul></div></details>` : ''}
          <details><summary>משלוח והחזרות${icon('down')}</summary><div class="acc-bd">
            <ul>${(st.shipping || []).map(s => html`<li><b>${s.label}</b>: ${s.price ? money(s.price) : 'חינם'}, ${s.eta}</li>`)}</ul>
            <p>אפשר לבטל עסקה ולהחזיר מוצר תוך 14 יום מקבלתו, לפי חוק הגנת הצרכן. <a href="${BASE}/info/shipping">כל הפרטים</a></p>
          </div></details>
        </div>
      </div>
    </div>

    ${related.length ? html`<section class="sec" aria-labelledby="rel-h"><div class="sec-hd"><h2 id="rel-h">אולי יתאים לכם גם</h2><a class="more" href="${catUrl(c)}">עוד ב${c.name} ${icon('arrow')}</a></div>${grid(related)}</section>` : ''}
  </div>

  ${out ? '' : html`<div class="sticky-buy" id="sticky-buy" aria-hidden="true">
    <div class="wrap sb-in"><div class="sb-info"><b>${p.name}</b>${price(p)}</div><button type="button" class="btn" id="sticky-add" tabindex="-1">${opts ? `בחירת ${opts.name}` : 'הוספה לסל'}</button></div>
  </div>`}`;

  return {
    name: 'product', body,
    mount(root) {
      const form = $('#buy-form', root);
      const qtyIn = $('input[data-qty]', root);
      const room = $('#room', root);
      const qty = () => Math.max(1, parseInt(qtyIn ? qtyIn.value : '1', 10) || 1);
      const max = () => Math.max(1, S.roomFor(p.id));

      const paintQty = () => {
        if (!qtyIn) return;
        const m = max();
        qtyIn.max = String(m);
        if (qty() > m) qtyIn.value = String(m);
        // aria-disabled, not disabled: a disabled button drops the keyboard focus that just pressed it
        $('[data-step="-1"]', root).setAttribute('aria-disabled', String(qty() <= 1));
        $('[data-step="1"]', root).setAttribute('aria-disabled', String(qty() >= m));
        const sum = $('#add-sum', root); if (sum) sum.textContent = money(p.price * qty());
        const left = S.roomFor(p.id);
        const add = $('#add-btn', root);
        if (add && !out) add.setAttribute('aria-disabled', String(left === 0));
        room.textContent = left === 0 && !out ? 'כל הכמות שבמלאי כבר בסל שלכם' : '';
      };

      form.addEventListener('click', e => {
        const b = e.target.closest('[data-step]');
        if (!b || b.dataset.key) return;
        if (b.getAttribute('aria-disabled') === 'true') { say(Number(b.dataset.step) > 0 ? 'זו כל הכמות שיש במלאי' : 'הכמות המינימלית היא 1'); return; }
        qtyIn.value = String(Math.min(max(), Math.max(1, qty() + Number(b.dataset.step))));
        paintQty();
        say(`כמות ${qty()}, ${money(p.price * qty())}`);
      });
      if (qtyIn) qtyIn.addEventListener('input', paintQty);
      form.addEventListener('change', e => {
        if (e.target.name === 'opt') $('#opt-now', root).textContent = e.target.value;
      });
      const add = (opener) => {
        if (out) return;
        const opt = form.opt ? (form.querySelector('input[name="opt"]:checked') || {}).value || '' : '';
        const n = S.addToCart(p.id, qty(), opt);
        if (!n) { toast('כל הכמות שבמלאי כבר בסל שלכם'); return; }
        if (n < qty()) toast(`נוספו ${n} בלבד, זה מה שנשאר במלאי`);
        if (qtyIn) qtyIn.value = '1';
        paintQty();
        openCart(opener);
      };
      form.addEventListener('submit', e => { e.preventDefault(); add($('#add-btn', root)); });

      // gallery thumbnails
      const gMain = $('#g-main', root);
      root.addEventListener('click', e => {
        const t = e.target.closest('[data-img]');
        if (!t) return;
        const i = Number(t.dataset.img);
        for (const b of $$('[data-img]', root)) b.setAttribute('aria-pressed', String(b === t));
        const badge = gMain.querySelector('.badges');
        gMain.innerHTML = str(productMedia(p, { index: i, label: true }));
        if (badge) gMain.appendChild(badge);
      });

      // on phones, a slim add-to-cart bar appears once the main button has scrolled away above.
      // A scroll check rather than an IntersectionObserver: a fast flick can jump the button from
      // below the screen to above it in one frame, and the observer would never fire.
      const sticky = $('#sticky-buy', root);
      let onScroll = null, frame = 0;
      if (sticky) {
        const sAdd = $('#sticky-add', root), row = $('.buy-row', root);
        let shown = false;
        const check = () => {
          frame = 0;
          const show = row.getBoundingClientRect().bottom < 0;
          if (show === shown) return;
          shown = show;
          sticky.classList.toggle('on', show);
          sticky.setAttribute('aria-hidden', String(!show));
          sAdd.tabIndex = show ? 0 : -1;
        };
        onScroll = () => { if (!frame) frame = requestAnimationFrame(check); };
        addEventListener('scroll', onScroll, { passive: true });
        check();
        sAdd.addEventListener('click', () => {
          // with options, bring the choice into view instead of guessing it
          if (opts) { form.scrollIntoView({ block: 'center' }); form.querySelector('input[name="opt"]:checked').focus(); return; }
          add(sAdd);
        });
      }
      const unsub = S.subscribe(w => { if (w === 'cart') paintQty(); });
      paintQty();
      return () => { unsub(); if (onScroll) removeEventListener('scroll', onScroll); if (frame) cancelAnimationFrame(frame); };
    },
  };
}
