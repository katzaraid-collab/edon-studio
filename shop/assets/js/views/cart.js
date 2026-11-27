import { BASE, html, str, money, icon, $ } from '../lib.js';
import { crumbs, setMeta, grid, soldOut, say } from '../ui.js';
import * as S from '../state.js';
import { shipBar, lineRow, handleLineEvents } from '../app.js';

export const COUPON_ERR = { unknown: 'הקוד לא מוכר. כדאי לבדוק שאין רווח או אות חסרה.', min: 'הקוד תקף בהזמנה גדולה יותר' };

/* A code that doesn't exist is shown with its error once and then forgotten, so it doesn't greet the
   visitor in red on every later visit. A real code that needs a bigger cart is kept: it switches on by
   itself once the cart is big enough. */
let flash = null;
export const resetCouponFlash = () => { flash = null; };

/* What changed in the cart because of stock since the visitor last saw it, by name.
   q0 is the quote from before tidyCart() (it still has the dropped lines and the capped flags). */
export function stockNote(q0) {
  const cat = S.getCatalog();
  const gone = q0.dropped.map(l => (cat.products.find(p => p.id === (l && l.id)) || {}).name).filter(Boolean);
  const unknown = q0.dropped.length - gone.length;
  const capped = q0.items.filter(i => i.capped);
  if (!gone.length && !unknown && !capped.length) return '';
  return html`<div class="note warn" role="status">${icon('alert')}<div>
    ${gone.length ? html`<p>${gone.length === 1 ? `${gone[0]} אזל מהמלאי והוסר מהסל.` : `אזלו מהמלאי והוסרו מהסל: ${gone.join(', ')}.`}</p>` : ''}
    ${unknown ? html`<p>${unknown === 1 ? 'מוצר אחד כבר לא נמכר והוסר מהסל.' : `${unknown} מוצרים כבר לא נמכרים והוסרו מהסל.`}</p>` : ''}
    ${capped.map(i => html`<p>מ${i.product.name} ${i.qty === 1 ? 'נשאר רק אחד במלאי' : `נשארו רק ${i.qty} במלאי`}, אז עדכנו את הכמות.</p>`)}
  </div></div>`;
}

/* the order summary box, shared by the cart page and the checkout */
export function summary(q, { coupon = true, shipKnown = false } = {}) {
  return html`
    ${coupon ? couponForm(q) : ''}
    <dl class="sum">
      <div><dt>סכום ביניים (${q.count === 1 ? 'פריט אחד' : q.count + ' פריטים'})</dt><dd>${money(q.subtotal)}</dd></div>
      ${q.discount ? html`<div class="disc"><dt>הנחה · ${q.coupon.code}</dt><dd>−${money(q.discount)}</dd></div>` : ''}
      <div><dt>משלוח${shipKnown ? html` · ${q.method.label}` : ''}</dt><dd>${q.shipping ? money(q.shipping) : 'חינם'}</dd></div>
      <div class="total"><dt>סה״כ לתשלום</dt><dd>${money(q.total)}</dd></div>
    </dl>
    <p class="muted small">כל המחירים כוללים מע״מ.</p>`;
}

export function couponForm(q) {
  const code = S.getCoupon();
  if (q.coupon) {
    return html`<div class="coupon on"><p>${icon('tag')}<span>הקוד <b>${q.coupon.code}</b> הופעל: ${q.coupon.label}</span></p><button type="button" class="link-btn" data-coupon-off aria-label="${'הסרת הקוד ' + q.coupon.code}">הסרה</button></div>`;
  }
  let err = '', value = code;
  if (flash) { err = COUPON_ERR.unknown; value = flash.code; }
  else if (code && q.couponError === 'min') {
    const cp = S.getCatalog().store.coupons.find(c => c.code.toUpperCase() === code);
    err = `${COUPON_ERR.min} (מ־${money(cp.min)}). הוא יופעל לבד כשהסל יגיע לסכום.`;
  }
  // tucked away until asked for, so the field doesn't send people hunting for codes
  return html`<details class="coupon-box" ${err || code ? html`open` : ''}>
    <summary>יש לכם קוד קופון?${icon('down')}</summary>
    <form class="coupon" data-coupon novalidate>
      <label for="coupon-in">קוד קופון</label>
      <div class="coupon-row">
        <input id="coupon-in" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" value="${value}" ${err ? html`aria-invalid="true" aria-describedby="coupon-err"` : ''}>
        <button type="submit" class="btn ghost">הפעלה</button>
      </div>
      ${err ? html`<p class="err" id="coupon-err">${err}</p>` : ''}
    </form>
  </details>`;
}

export function wireCoupon(root, after) {
  root.addEventListener('submit', e => {
    const f = e.target.closest('[data-coupon]');
    if (!f) return;
    e.preventDefault();
    const typed = String(f.code.value || '').trim().toUpperCase();
    flash = null;
    S.setCoupon(typed);
    const q = S.cartQuote();
    if (typed && !q.coupon && q.couponError === 'unknown') { flash = { code: typed }; S.setCoupon(''); }
    say(q.coupon ? `הקוד ${q.coupon.code} הופעל: ${q.coupon.label}` : typed ? (COUPON_ERR[q.couponError] || 'הקוד לא הופעל') : 'לא הוזן קוד');
    after && after('coupon');
  });
  root.addEventListener('click', e => {
    if (e.target.closest('[data-coupon-off]')) { flash = null; S.setCoupon(''); say('הקוד הוסר'); after && after('coupon-off'); }
  });
}

export default function cart({ catalog }) {
  setMeta({ title: 'סל הקניות', description: 'סל הקניות שלכם' });
  resetCouponFlash();
  const q0 = S.cartQuote();
  S.tidyCart();

  const body = html`<div class="wrap page cart-page">
    ${crumbs([{ name: 'סל הקניות', url: `${BASE}/cart` }])}
    <h1>סל הקניות</h1>
    ${stockNote(q0)}
    <div id="cart-view"></div>
  </div>`;

  function draw(root, focusSel) {
    const q = S.cartQuote();
    const view = $('#cart-view', root);
    if (!q.items.length) {
      const picks = catalog.products.filter(p => p.featured && !soldOut(p)).slice(0, 4);
      view.innerHTML = str(html`<div class="empty">${icon('cart', 'xl')}<p class="empty-t">הסל ריק</p><p>כל מה שתוסיפו יחכה לכם כאן, גם אם תסגרו את הדף.</p><a class="btn" href="${BASE}/all">לכל המוצרים</a></div>
        ${picks.length ? html`<section class="sec" aria-labelledby="pk-h"><div class="sec-hd"><h2 id="pk-h">אולי תאהבו</h2></div>${grid(picks)}</section>` : ''}`);
      return;
    }
    view.innerHTML = str(html`<div class="cart-grid">
      <section aria-label="המוצרים בסל">
        ${shipBar(q)}
        <ul class="lines big" role="list">${q.items.map(i => lineRow(i))}</ul>
        <a class="back" href="${BASE}/all">${icon('arrow', 'flip')}להמשיך בקניות</a>
      </section>
      <aside class="panel" aria-labelledby="sum-h">
        <h2 id="sum-h">סיכום</h2>
        ${summary(q)}
        <a class="btn lg block" href="${BASE}/checkout">להשלמת ההזמנה ${icon('arrow')}</a>
        <ul class="assure small" role="list">
          <li>${icon('lock')}<span>לא נשמרים פרטי כרטיס באתר. משלמים רק אחרי אישור ההזמנה.</span></li>
          <li>${icon('return')}<span>החזרה עד 14 יום</span></li>
        </ul>
      </aside>
    </div>`);
    if (focusSel) { const n = root.querySelector(focusSel); if (n) n.focus(); }
  }

  return {
    name: 'cart', body,
    mount(root) {
      draw(root);
      handleLineEvents(root);
      wireCoupon(root, kind => {
        draw(root, kind === 'coupon-off' ? '#coupon-in' : (S.cartQuote().coupon ? '[data-coupon-off]' : '#coupon-in'));
      });
      return S.subscribe(w => {
        if (w !== 'cart' && w !== 'ship' && w !== 'coupon') return;
        // redraw but keep focus on the same control
        const a = document.activeElement;
        const line = a && a.closest && a.closest('[data-line]');
        const sel = line ? `[data-line="${CSS.escape(line.dataset.line)}"] ${a.dataset.step ? `[data-step="${a.dataset.step}"]` : 'input'}` : null;
        draw(root, sel);
        if (sel && !root.querySelector(sel)) { const f = root.querySelector('.line [data-step]') || root.querySelector('h1'); if (f) f.focus(); }
      });
    },
  };
}
