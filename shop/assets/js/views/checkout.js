/* Checkout: one page, four short groups (details, delivery, payment, confirm).
   When the server can email orders (GET /api/order answers ready) the order is posted there.
   Otherwise the same order is handed to WhatsApp as a ready-to-send message, so the store works
   from day one without a mail provider. Either way no card details ever touch this site. */
import { BASE, html, str, raw, money, icon, $, $$, session, uid } from '../lib.js';
import { crumbs, setMeta, productMedia, toast, say } from '../ui.js';
import * as S from '../state.js';
import { summary, wireCoupon } from './cart.js';

const DRAFT = 'shop-checkout-draft';
export const LAST = 'shop-last-order';
const DOMAINS = ['gmail.com', 'walla.co.il', 'walla.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'live.com', 'bezeqint.net', 'netvision.net.il', 'zahav.net.il'];

let apiReady = null; // cached per page load: true, false, or a pending promise
function checkApi() {
  if (apiReady !== null) return Promise.resolve(apiReady);
  return fetch('/api/order', { headers: { Accept: 'application/json' } })
    .then(r => r.ok ? r.json() : { ready: false })
    .then(j => (apiReady = j.ready === true), () => (apiReady = false));
}

const RULES = {
  first: v => v.length < 2 ? 'צריך למלא שם פרטי' : v.length > 40 ? 'השם ארוך מדי' : '',
  last: v => v.length < 2 ? 'צריך למלא שם משפחה' : v.length > 40 ? 'השם ארוך מדי' : '',
  phone: v => {
    const d = v.replace(/\D/g, '');
    if (!d) return 'צריך מספר טלפון כדי שנוכל לאשר את ההזמנה';
    if (!/^\+?[0-9()\-. ]+$/.test(v) || d.length < 9 || d.length > 15) return 'מספר הטלפון לא נראה תקין, למשל 050-123-4567';
    return '';
  },
  email: v => !v ? 'צריך כתובת מייל לאישור ההזמנה' : (v.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) ? 'כתובת המייל לא נראית תקינה, למשל name@gmail.com' : '',
  city: v => v.length < 2 ? 'צריך למלא עיר או יישוב' : v.length > 60 ? 'ארוך מדי' : '',
  street: v => v.length < 2 ? 'צריך למלא רחוב' : v.length > 60 ? 'ארוך מדי' : '',
  house: v => !v ? 'צריך מספר בית' : v.length > 10 ? 'ארוך מדי' : '',
  apt: v => v.length > 10 ? 'ארוך מדי' : '',
  zip: v => v && !/^\d{5}(\d{2})?$/.test(v.replace(/\s/g, '')) ? 'מיקוד הוא 7 ספרות' : '',
  notes: v => v.length > 600 ? `עד 600 תווים (כרגע ${v.length})` : '',
};
const ADDRESS = ['city', 'street', 'house', 'apt', 'zip'];

function field(name, label, { type = 'text', auto = 'off', mode = '', req = true, hint = '', cls = '', max = 60, dir = '' } = {}) {
  const desc = [hint ? 'h-' + name : '', 'e-' + name].filter(Boolean).join(' ');
  return html`<div class="field ${cls}" data-field="${name}">
    <label for="f-${name}">${label}${req ? '' : html` <span class="optional">(לא חובה)</span>`}</label>
    <input id="f-${name}" name="${name}" type="${type}" autocomplete="${auto}" maxlength="${max}" ${mode ? html`inputmode="${mode}"` : ''} ${dir ? html`dir="${dir}"` : ''} ${req ? raw('required aria-required="true"') : ''} aria-describedby="${desc}">
    ${hint ? html`<p class="hint" id="h-${name}">${hint}</p>` : ''}
    <p class="err" id="e-${name}" hidden></p>
  </div>`;
}

export default function checkout({ catalog, go }) {
  const st = catalog.store;
  setMeta({ title: 'קופה', description: 'השלמת ההזמנה' });
  const q0 = S.tidyCart();

  if (!q0.items.length) {
    return {
      name: 'checkout',
      body: html`<div class="wrap page narrow">${crumbs([{ name: 'קופה', url: `${BASE}/checkout` }])}<h1>קופה</h1>
        <div class="empty">${icon('cart', 'xl')}<p class="empty-t">הסל ריק</p><p>כדי להזמין צריך קודם להוסיף מוצרים לסל.</p><a class="btn" href="${BASE}/all">לכל המוצרים</a></div></div>`,
    };
  }

  const draft = session.get(DRAFT, {}) || {};
  const ship = S.getShip();
  const pay = draft.payment && st.payments.some(p => p.id === draft.payment) ? draft.payment : (st.payments[0] || {}).id;

  const body = html`<div class="wrap page co">
    ${crumbs([{ name: 'סל הקניות', url: `${BASE}/cart` }, { name: 'קופה', url: `${BASE}/checkout` }])}
    <h1>השלמת ההזמנה</h1>
    <p class="lead">כמה פרטים ואנחנו מסודרים. אחרי שליחת ההזמנה נחזור אליכם לאישור ולתשלום, ורק אז היא יוצאת לדרך.</p>

    <details class="co-mob-sum only-m" id="mob-sum"><summary><span>${icon('cart')}סיכום ההזמנה</span><b id="mob-total">${money(q0.total)}</b>${icon('down')}</summary><div class="co-mob-bd" id="mob-sum-bd"></div></details>

    <div class="co-grid">
      <form class="co-form" id="co-form" novalidate>
        <div class="err-sum" id="err-sum" tabindex="-1" hidden></div>

        <fieldset class="co-step">
          <legend><span class="n" aria-hidden="true">1</span>פרטים ליצירת קשר</legend>
          <div class="fields">
            ${field('first', 'שם פרטי', { auto: 'given-name', max: 40, cls: 'half' })}
            ${field('last', 'שם משפחה', { auto: 'family-name', max: 40, cls: 'half' })}
            ${field('phone', 'טלפון נייד', { type: 'tel', auto: 'tel', mode: 'tel', max: 24, cls: 'half', dir: 'ltr', hint: 'נתקשר או נכתוב לכם רק לגבי ההזמנה' })}
            ${field('email', 'מייל', { type: 'email', auto: 'email', mode: 'email', max: 120, cls: 'half', dir: 'ltr', hint: 'לשם נשלח את אישור ההזמנה' })}
          </div>
        </fieldset>

        <fieldset class="co-step">
          <legend><span class="n" aria-hidden="true">2</span>איך למסור לכם?</legend>
          <div class="radios" id="ship-radios">
            ${st.shipping.map(s => html`<label class="radio-card"><input type="radio" name="shipping" value="${s.id}" ${s.id === ship ? raw('checked') : ''}>
              <span class="rc-main"><b>${s.label}</b><span class="muted">${s.eta}</span></span>
              <span class="rc-price" data-ship-price="${s.id}"></span></label>`)}
          </div>
          <div class="fields" id="addr">
            ${field('city', 'עיר או יישוב', { auto: 'address-level2', cls: 'half' })}
            ${field('street', 'רחוב', { auto: 'address-line1', cls: 'half' })}
            ${field('house', 'מספר בית', { auto: 'off', max: 10, cls: 'third', mode: 'numeric' })}
            ${field('apt', 'דירה / כניסה', { req: false, max: 10, cls: 'third' })}
            ${field('zip', 'מיקוד', { req: false, auto: 'postal-code', mode: 'numeric', max: 10, cls: 'third', dir: 'ltr' })}
          </div>
          <p class="note" id="pickup-note" hidden>${icon('pin')}<span>${st.contact && st.contact.pickup ? st.contact.pickup : 'נשלח לכם את כתובת האיסוף'}. נתאם איתכם מועד אחרי אישור ההזמנה.</span></p>
        </fieldset>

        <fieldset class="co-step">
          <legend><span class="n" aria-hidden="true">3</span>איך תרצו לשלם?</legend>
          <div class="radios">
            ${st.payments.map(p => html`<label class="radio-card"><input type="radio" name="payment" value="${p.id}" ${p.id === pay ? raw('checked') : ''}>
              <span class="rc-main"><b>${p.label}</b><span class="muted">${p.note}</span></span></label>`)}
          </div>
        </fieldset>

        <fieldset class="co-step">
          <legend><span class="n" aria-hidden="true">4</span>עוד משהו?</legend>
          <div class="field" data-field="notes">
            <label for="f-notes">הערות להזמנה <span class="optional">(לא חובה)</span></label>
            <textarea id="f-notes" name="notes" rows="3" maxlength="600" aria-describedby="h-notes e-notes"></textarea>
            <p class="hint" id="h-notes">ברכה למתנה, שעה נוחה לשליח, קוד לבניין</p>
            <p class="err" id="e-notes" hidden></p>
          </div>
          <div class="field" data-field="consent">
            <label class="check"><input type="checkbox" name="consent" id="f-consent" required aria-required="true" aria-describedby="e-consent"><span>קראתי ואני מסכים/ה ל<a href="${BASE}/info/terms" target="_blank">תקנון<span class="vh"> (נפתח בחלון חדש)</span></a> ול<a href="${BASE}/info/privacy" target="_blank">מדיניות הפרטיות<span class="vh"> (נפתח בחלון חדש)</span></a></span></label>
            <p class="err" id="e-consent" hidden></p>
          </div>
          <label class="check"><input type="checkbox" name="news"><span>אשמח לקבל במייל עדכונים על מוצרים חדשים ומבצעים (לא חובה)</span></label>
          <input type="text" name="hp" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true">
        </fieldset>

        <div class="co-submit">
          <button class="btn lg block" type="submit" id="co-btn"><span id="co-btn-t">שליחת ההזמנה</span> · <span id="co-btn-sum">${money(q0.total)}</span></button>
          <p class="muted small center" id="co-how">${icon('lock')} אין צורך בכרטיס אשראי באתר. נאשר איתכם את ההזמנה ואז נגבה.</p>
          <div id="co-fail" role="alert"></div>
        </div>
      </form>

      <aside class="panel co-side only-d" aria-labelledby="co-sum-h">
        <h2 id="co-sum-h">ההזמנה שלכם</h2>
        <div id="side-sum"></div>
      </aside>
    </div>
  </div>`;

  return {
    name: 'checkout', body,
    mount(root) {
      const form = $('#co-form', root);
      const touched = new Set();
      let sending = false;

      // restore the draft from this tab (sessionStorage: it is gone once the tab closes)
      for (const [k, v] of Object.entries(draft)) {
        const el = form.elements[k];
        if (!el || k === 'hp' || k === 'consent' || k === 'shipping' || k === 'payment') continue;
        if (el.type === 'checkbox') el.checked = !!v; else if (typeof v === 'string') el.value = v;
      }

      const val = n => String((form.elements[n] && form.elements[n].value) || '').trim();
      const courier = () => (form.querySelector('input[name="shipping"]:checked') || {}).value !== 'pickup';

      function setErr(name, msg) {
        const box = root.querySelector(`[data-field="${name}"]`);
        if (!box) return;
        const e = $('#e-' + name, root), input = form.elements[name];
        e.innerHTML = msg ? str(html`${icon('alert')}<span>${msg}</span>`) : '';
        e.hidden = !msg;
        box.classList.toggle('bad', !!msg);
        if (input && input.setAttribute) msg ? input.setAttribute('aria-invalid', 'true') : input.removeAttribute('aria-invalid');
      }
      function check(name) {
        if (name === 'consent') return form.consent.checked ? '' : 'כדי להזמין צריך לאשר את התקנון ואת מדיניות הפרטיות';
        if (ADDRESS.includes(name) && !courier()) return '';
        const rule = RULES[name];
        return rule ? rule(val(name)) : '';
      }
      const NAMES = ['first', 'last', 'phone', 'email', ...ADDRESS, 'notes', 'consent'];

      // email typo hint ("gmial.com" → "gmail.com")
      function emailHint() {
        const v = val('email'), h = $('#h-email', root);
        const m = v.match(/^([^@\s]+)@([^@\s]+)$/);
        const sug = m && !DOMAINS.includes(m[2].toLowerCase()) ? DOMAINS.find(d => near(m[2].toLowerCase(), d)) : null;
        if (sug && h.dataset.sug !== sug) say(`התכוונתם ל־${m[1]}@${sug}?`);
        h.dataset.sug = sug || '';
        h.innerHTML = sug ? str(html`התכוונתם ל־<button type="button" class="link-btn" data-fix-email="${m[1]}@${sug}" dir="ltr">${m[1]}@${sug}</button>?`) : 'לשם נשלח את אישור ההזמנה';
      }

      function paintShip() {
        const isCourier = courier();
        $('#addr', root).hidden = !isCourier;
        $('#pickup-note', root).hidden = isCourier;
        for (const n of ADDRESS) { const i = form.elements[n]; if (!i) continue; i.disabled = !isCourier; if (!isCourier) setErr(n, ''); }
      }

      function paintSummary() {
        const q = S.cartQuote();
        for (const s of st.shipping) {
          const t = $(`[data-ship-price="${s.id}"]`, root);
          const free = !s.price || (q.freeShippingFrom && q.subtotal - q.discount >= q.freeShippingFrom);
          if (t) t.innerHTML = str(free ? html`<b class="free">חינם</b>${s.price ? html`<s><span class="vh">במקום </span>${money(s.price)}</s>` : ''}` : money(s.price));
        }
        const items = html`<ul class="mini" role="list">${q.items.map(i => html`<li>
          <span class="mini-media">${productMedia(i.product)}<span class="mini-q" aria-hidden="true">${i.qty}</span></span>
          <span class="mini-name">${i.product.name}${i.opt ? html`<span class="muted">${i.product.options.name}: ${i.opt}</span>` : ''}<span class="vh">, כמות ${i.qty}</span></span>
          <span class="mini-total">${money(i.total)}</span></li>`)}</ul>
          ${q.freeShippingLeft && courier() ? html`<p class="note small">${icon('truck')}<span>עוד ${money(q.freeShippingLeft)} למשלוח חינם. <a href="${BASE}/all">להוספת מוצרים</a></span></p>` : ''}`;
        const content = str(html`${items}${summary(q, { shipKnown: true })}<a class="link-btn small" href="${BASE}/cart">עריכת הסל</a>`);
        const side = $('#side-sum', root), mob = $('#mob-sum-bd', root);
        // only one copy holds the coupon form at a time, so ids stay unique
        if (matchMedia('(min-width: 960px)').matches) { side.innerHTML = content; mob.innerHTML = ''; }
        else { mob.innerHTML = content; side.innerHTML = ''; }
        $('#mob-total', root).textContent = money(q.total);
        $('#co-btn-sum', root).textContent = money(q.total);
      }

      function saveDraft() {
        const d = {};
        for (const n of ['first', 'last', 'phone', 'email', ...ADDRESS, 'notes', 'payment', 'news']) {
          const el = form.elements[n];
          if (!el) continue;
          d[n] = el.type === 'checkbox' ? el.checked : (el instanceof RadioNodeList ? el.value : el.value);
        }
        session.set(DRAFT, d);
      }

      form.addEventListener('input', e => {
        const n = e.target.name;
        if (n === 'email') emailHint();
        if (touched.has(n)) setErr(n, check(n));
        saveDraft();
      });
      form.addEventListener('focusout', e => {
        const n = e.target.name;
        if (!n || !NAMES.includes(n)) return;
        if (n === 'phone') e.target.value = prettyPhone(e.target.value);
        if (val(n) || touched.has(n)) { touched.add(n); setErr(n, check(n)); }
      });
      form.addEventListener('change', e => {
        if (e.target.name === 'shipping') { S.setShip(e.target.value); paintShip(); paintSummary(); }
        if (e.target.name === 'consent') { touched.add('consent'); setErr('consent', check('consent')); }
        saveDraft();
      });
      root.addEventListener('click', e => {
        const fix = e.target.closest('[data-fix-email]');
        if (fix) { form.email.value = fix.dataset.fixEmail; emailHint(); setErr('email', check('email')); form.email.focus(); saveDraft(); }
        const jump = e.target.closest('[data-jump]');
        if (jump) { e.preventDefault(); const el = form.elements[jump.dataset.jump]; if (el) el.focus(); }
      });
      wireCoupon(root, () => { paintSummary(); const n = root.querySelector('[data-coupon-off]') || root.querySelector('#coupon-in'); if (n) n.focus(); });

      checkApi().then(ready => {
        if (!document.contains(form)) return;
        if (!ready) {
          $('#co-btn-t', root).textContent = 'שליחת ההזמנה בוואטסאפ';
          $('#co-how', root).innerHTML = str(html`${icon('wa')} ההזמנה תיפתח כהודעה מוכנה בוואטסאפ, רק ללחוץ „שליחה”. אין צורך בכרטיס אשראי באתר.`);
        }
      });

      form.addEventListener('submit', async e => {
        e.preventDefault();
        if (sending) return;
        // validate everything, then point at the first problem
        const bad = [];
        for (const n of NAMES) { touched.add(n); const m = check(n); setErr(n, m); if (m) bad.push([n, m]); }
        const sumBox = $('#err-sum', root);
        if (bad.length) {
          sumBox.innerHTML = str(html`<p><b>${bad.length === 1 ? 'נשאר דבר אחד לתקן:' : `נשארו ${bad.length} דברים לתקן:`}</b></p><ul>${bad.map(([n, m]) => html`<li><a href="#f-${n}" data-jump="${n}">${m}</a></li>`)}</ul>`);
          sumBox.hidden = false; sumBox.focus();
          return;
        }
        sumBox.hidden = true;
        if (val('hp')) return; // a bot filled the hidden field

        const q = S.tidyCart();
        if (!q.items.length) { toast('הסל התרוקן בינתיים'); go(`${BASE}/cart`); return; }
        const customer = {};
        for (const n of ['first', 'last', 'phone', 'email', 'notes', ...ADDRESS]) customer[n] = courier() || !ADDRESS.includes(n) ? val(n) : '';
        const payment = (form.querySelector('input[name="payment"]:checked') || {}).value;
        const order = {
          id: '',
          items: q.items.map(i => ({ id: i.id, qty: i.qty, opt: i.opt })),
          shipping: q.method.id, payment, coupon: q.coupon ? q.coupon.code : '',
          customer, consent: true, news: !!form.news.checked, hp: '',
        };
        // a retry of exactly the same order keeps its id, so a lost answer never becomes a second email;
        // any change (cart, details, coupon) is a new order with a new id
        const sig = JSON.stringify(order);
        const pending = session.get('shop-pending-id', null);
        order.id = pending && pending.sig === sig ? pending.id : uid();
        session.set('shop-pending-id', { id: order.id, sig });
        const receipt = {
          id: order.id, at: new Date().toISOString(), first: customer.first,
          items: q.items.map(i => ({ name: i.product.name, opt: i.opt, optName: i.opt ? i.product.options.name : '', qty: i.qty, total: i.total })),
          subtotal: q.subtotal, discount: q.discount, coupon: order.coupon, shipping: q.shipping, total: q.total,
          method: q.method.label, payment: (st.payments.find(p => p.id === payment) || {}).label || '',
          wa: waText(st, q, customer, order, payment),
        };

        const btn = $('#co-btn', root), fail = $('#co-fail', root);
        fail.innerHTML = '';
        // WhatsApp opens in the same tick as the click when we already know there is no server,
        // because Safari blocks windows opened after an await; the thanks page has the button too
        if (apiReady === false) {
          window.open(waLink(st, receipt.wa), '_blank', 'noopener');
          finish({ ...receipt, status: 'whatsapp', opened: true });
          return;
        }
        const ready = apiReady === true ? true : await checkApi();
        if (!ready) { finish({ ...receipt, status: 'whatsapp' }); return; }
        sending = true; btn.disabled = true; btn.classList.add('busy');
        $('#co-btn-t', root).textContent = 'שולחים את ההזמנה…';
        try {
          const r = await fetch('/api/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(order) });
          const j = await r.json().catch(() => ({}));
          if (r.ok && j.ok) { finish({ ...receipt, total: typeof j.total === 'number' ? j.total : receipt.total, status: 'sent' }); return; }
          if (r.status === 400 && j.field && NAMES.includes(j.field)) {
            setErr(j.field, check(j.field) || 'כדאי לבדוק את השדה הזה');
            form.elements[j.field] && form.elements[j.field].focus();
            throw Object.assign(new Error('field'), { quiet: true });
          }
          throw new Error(String(r.status));
        } catch (err) {
          if (!err.quiet) {
            fail.innerHTML = str(html`<div class="note warn">${icon('alert')}<div><p><b>ההזמנה לא נשלחה.</b> ${err.message === '429' ? 'נשלחו הרבה הזמנות ברצף, אפשר לנסות שוב בעוד כמה דקות.' : 'משהו השתבש בחיבור. אפשר לנסות שוב, או לשלוח לנו אותה בוואטסאפ.'}</p>
              <p class="row"><button type="submit" class="btn sm" form="co-form">לנסות שוב</button>${st.contact && st.contact.whatsapp ? html`<a class="btn ghost sm" href="${waLink(st, receipt.wa)}" target="_blank" rel="noopener">${icon('wa')}שליחה בוואטסאפ<span class="vh"> (נפתח בחלון חדש)</span></a>` : ''}</p></div></div>`);
          }
        } finally {
          sending = false; btn.disabled = false; btn.classList.remove('busy');
          if (document.contains(btn)) $('#co-btn-t', root).textContent = apiReady === false ? 'שליחת ההזמנה בוואטסאפ' : 'שליחת ההזמנה';
        }
      });

      function finish(rec) {
        session.set(LAST, rec);
        session.del(DRAFT); session.del('shop-pending-id');
        S.clearCart();
        go(`${BASE}/thanks`);
      }

      paintShip(); paintSummary(); emailHint();
      const mq = matchMedia('(min-width: 960px)');
      const onMq = () => paintSummary();
      mq.addEventListener('change', onMq);
      const unsub = S.subscribe(w => { if (w === 'cart' || w === 'coupon') { if (!S.cartQuote().items.length) go(`${BASE}/cart`, { replace: true }); else paintSummary(); } });
      return () => { unsub(); mq.removeEventListener('change', onMq); };
    },
  };
}

/* one edit (or a swap of two neighbours) away */
function near(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  if (i === a.length && i === b.length) return false;
  return a.slice(i + 1) === b.slice(i + 1) || a.slice(i) === b.slice(i + 1) || a.slice(i + 1) === b.slice(i)
    || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
}

function prettyPhone(v) {
  const d = v.replace(/\D/g, '');
  if (/^05\d{8}$/.test(d)) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  if (/^0[2-489]\d{7}$/.test(d)) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
  return v.trim();
}

const plain = n => money(n).replace(/[\u2066\u2069]/g, '');
export function waText(st, q, c, order, payment) {
  const lines = [
    `היי ${st.name}, אשמח להזמין:`,
    `הזמנה מספר ${order.id}`,
    '',
    ...q.items.map(i => `• ${i.qty} × ${i.product.name}${i.opt ? ` (${i.product.options.name}: ${i.opt})` : ''} = ${plain(i.total)}`),
    '',
    `סכום ביניים: ${plain(q.subtotal)}`,
    ...(q.discount ? [`הנחה (${q.coupon.code}): −${plain(q.discount)}`] : []),
    `משלוח (${q.method.label}): ${q.shipping ? plain(q.shipping) : 'חינם'}`,
    `סה״כ: ${plain(q.total)}`,
    '',
    `שם: ${c.first} ${c.last}`,
    `טלפון: ${c.phone}`,
    `מייל: ${c.email}`,
    ...(q.method.id === 'pickup' ? ['איסוף עצמי'] : [`כתובת: ${c.street} ${c.house}${c.apt ? ', ' + c.apt : ''}, ${c.city}${c.zip ? ' ' + c.zip : ''}`]),
    `תשלום: ${(st.payments.find(p => p.id === payment) || {}).label || ''}`,
    ...(c.notes ? ['', `הערות: ${c.notes}`] : []),
  ];
  return lines.join('\n');
}
export const waLink = (st, text) => `https://wa.me/${(st.contact && st.contact.whatsapp) || ''}?text=${encodeURIComponent(text)}`;
