import { BASE, html, raw, money, icon, session, copyText } from '../lib.js';
import { setMeta, toast, say } from '../ui.js';
import * as S from '../state.js';
import { LAST, waLink } from './checkout.js';

/* order numbers are Latin letters and digits: keep "#MWYW…" reading left to right inside Hebrew */
const num = id => html`<bdi dir="ltr">#${id}</bdi>`;

export default function thanks({ catalog, go }) {
  const st = catalog.store;
  const o = session.get(LAST, null);
  setMeta({ title: o ? 'תודה על ההזמנה' : 'תודה' });

  if (!o) {
    return {
      name: 'thanks',
      body: html`<div class="wrap page narrow center"><h1>אין כאן הזמנה פתוחה</h1><p>פרטי ההזמנה נשמרים רק בלשונית שבה היא נשלחה. אם שלחתם הזמנה, אישור יגיע אליכם במייל או בוואטסאפ.</p><a class="btn" href="${BASE}/">לדף הבית</a></div>`,
    };
  }

  const c = st.contact || {};
  const wa = c.whatsapp ? waLink(st, o.wa) : '';
  const viaWa = o.status === 'whatsapp';

  const body = html`<div class="wrap page narrow thanks">
    <div class="th-hd">
      <span class="th-ic${viaWa ? ' wa' : ''}" aria-hidden="true">${icon(viaWa ? 'wa' : 'check')}</span>
      <h1>${viaWa ? 'עוד צעד אחד: שליחה בוואטסאפ' : `תודה${o.first ? ', ' + o.first : ''}! ההזמנה אצלנו`}</h1>
      <p class="lead">${viaWa
        ? 'ההזמנה מוכנה כהודעה בוואטסאפ, ומגיעה אלינו ברגע שתלחצו שם „שליחה”. אם וואטסאפ כבר נפתח, אפשר לשלוח משם.'
        : html`מספר ההזמנה ${num(o.id)}. שלחנו את הפרטים, ונחזור אליכם בטלפון או בוואטסאפ לאישור ולתשלום${c.hours ? ` (${c.hours})` : ''}.`}</p>
      ${viaWa && wa ? html`<a class="btn lg wa-btn" href="${wa}" target="_blank" rel="noopener">${icon('wa')}${o.opened ? 'פתיחת וואטסאפ שוב' : 'פתיחת ההזמנה בוואטסאפ'}<span class="vh"> (נפתח בחלון חדש)</span></a>` : ''}
      ${viaWa ? html`<div class="th-alt">
        <p class="muted small">אין וואטסאפ במכשיר הזה?</p>
        <div class="row">
          <button type="button" class="btn ghost sm" data-copy-order>${icon('copy')}העתקת פרטי ההזמנה</button>
          ${c.phone ? html`<a class="btn ghost sm" href="tel:${c.phone.replace(/[^\d+]/g, '')}">${icon('phone')}<span dir="ltr">${c.phone}</span></a>` : ''}
          ${c.email ? html`<a class="btn ghost sm" href="mailto:${c.email}?subject=${encodeURIComponent('הזמנה ' + o.id)}&body=${encodeURIComponent(o.wa)}">${icon('mail')}שליחה במייל</a>` : ''}
        </div>
        ${(o.lines || []).length ? html`<p class="muted small">התחרטתם, או שההודעה לא נשלחה? <button type="button" class="link-btn" data-restore>להחזיר את הפריטים לסל</button></p>` : ''}
      </div>` : ''}
    </div>

    <ol class="steps" aria-label="מה קורה עכשיו">
      <li class="${viaWa ? 'now' : 'done'}"><b>${viaWa ? 'שולחים לנו את ההזמנה' : 'ההזמנה התקבלה'}</b><span>${viaWa ? 'בוואטסאפ, בטלפון או במייל' : html`מספר ${num(o.id)}`}</span></li>
      <li class="${viaWa ? '' : 'now'}"><b>מאשרים ומשלמים</b><span>${o.payment || 'נתאם איתכם את התשלום'}</span></li>
      <li><b>${o.method || 'משלוח'}</b><span>נעדכן כשההזמנה יוצאת אליכם</span></li>
    </ol>

    <section class="panel" aria-labelledby="ord-h">
      <h2 id="ord-h">סיכום ההזמנה <span class="muted">${num(o.id)}</span></h2>
      <ul class="mini plain" role="list">${o.items.map(i => html`<li><span class="mini-name">${i.qty} × ${i.name}${i.opt ? html`<span class="muted">${i.optName}: ${i.opt}</span>` : ''}</span><span class="mini-total">${money(i.total)}</span></li>`)}</ul>
      <dl class="sum">
        <div><dt>סכום ביניים</dt><dd>${money(o.subtotal)}</dd></div>
        ${o.discount ? html`<div class="disc"><dt>הנחה · ${o.coupon}</dt><dd>−${money(o.discount)}</dd></div>` : ''}
        <div><dt>משלוח · ${o.method}</dt><dd>${o.shipping ? money(o.shipping) : 'חינם'}</dd></div>
        <div class="total"><dt>סה״כ</dt><dd>${money(o.total)}</dd></div>
      </dl>
    </section>

    <p class="center"><a class="btn ghost" href="${BASE}/">${icon('arrow', 'flip')}חזרה לחנות</a></p>
    <p class="muted small center">שאלה על ההזמנה? <a href="${BASE}/info/contact">כאן כל הדרכים לדבר איתנו</a>.</p>
  </div>`;

  return {
    name: 'thanks', body,
    mount(root) {
      root.addEventListener('click', e => {
        if (e.target.closest('[data-copy-order]')) {
          copyText(o.wa).then(ok => {
            toast(ok ? 'פרטי ההזמנה הועתקו. אפשר להדביק אותם בהודעה או במייל אלינו.' : 'לא הצלחנו להעתיק. אפשר לשלוח לנו במייל או להתקשר.');
          });
        }
        if (e.target.closest('[data-restore]')) {
          for (const l of o.lines || []) S.addToCart(l.id, l.qty, l.opt);
          say('הפריטים חזרו לסל');
          go(`${BASE}/cart`);
        }
      });
    },
  };
}
