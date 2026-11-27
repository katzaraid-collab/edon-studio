import { BASE, html, money, icon, session } from '../lib.js';
import { setMeta } from '../ui.js';
import { LAST, waLink } from './checkout.js';

export default function thanks({ catalog }) {
  const st = catalog.store;
  const o = session.get(LAST, null);
  setMeta({ title: o ? 'תודה על ההזמנה' : 'תודה' });

  if (!o) {
    return {
      name: 'thanks',
      body: html`<div class="wrap page narrow center"><h1>אין כאן הזמנה פתוחה</h1><p>פרטי ההזמנה נשמרים רק בלשונית שבה היא נשלחה. אם שלחתם הזמנה, אישור יגיע אליכם במייל או בוואטסאפ.</p><a class="btn" href="${BASE}/">לדף הבית</a></div>`,
    };
  }

  const wa = st.contact && st.contact.whatsapp ? waLink(st, o.wa) : '';
  const viaWa = o.status === 'whatsapp';

  const body = html`<div class="wrap page narrow thanks">
    <div class="th-hd">
      <span class="th-ic${viaWa ? ' wa' : ''}" aria-hidden="true">${icon(viaWa ? 'wa' : 'check')}</span>
      <h1>${viaWa ? 'עוד צעד אחד: שליחה בוואטסאפ' : `תודה${o.first ? ', ' + o.first : ''}! ההזמנה אצלנו`}</h1>
      <p class="lead">${viaWa
        ? (o.opened ? 'פתחנו לכם וואטסאפ עם כל פרטי ההזמנה. ההזמנה מגיעה אלינו ברגע שתלחצו שם „שליחה”.' : 'ההזמנה מוכנה כהודעה בוואטסאפ. היא מגיעה אלינו ברגע שתשלחו אותה.')
        : `מספר ההזמנה ${o.id}. שלחנו את הפרטים, ונחזור אליכם בטלפון או בוואטסאפ לאישור ולתשלום${st.contact && st.contact.hours ? ` (${st.contact.hours})` : ''}.`}</p>
      ${viaWa && wa ? html`<a class="btn lg wa-btn" href="${wa}" target="_blank" rel="noopener">${icon('wa')}${o.opened ? 'וואטסאפ לא נפתח? לחצו כאן' : 'פתיחת ההזמנה בוואטסאפ'}<span class="vh"> (נפתח בחלון חדש)</span></a>` : ''}
    </div>

    <ol class="steps" aria-label="מה קורה עכשיו">
      <li class="${viaWa ? 'now' : 'done'}"><b>${viaWa ? 'שולחים לנו את ההזמנה' : 'ההזמנה התקבלה'}</b><span>${viaWa ? 'בהודעת הוואטסאפ שנפתחה' : 'מספר ' + o.id}</span></li>
      <li class="${viaWa ? '' : 'now'}"><b>מאשרים ומשלמים</b><span>${o.payment || 'נתאם איתכם את התשלום'}</span></li>
      <li><b>${o.method || 'משלוח'}</b><span>נעדכן כשההזמנה יוצאת אליכם</span></li>
    </ol>

    <section class="panel" aria-labelledby="ord-h">
      <h2 id="ord-h">סיכום ההזמנה <span class="muted">#${o.id}</span></h2>
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

  return { name: 'thanks', body };
}
