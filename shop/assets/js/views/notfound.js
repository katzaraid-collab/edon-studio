import { BASE, html, icon } from '../lib.js';
import { setMeta, catUrl } from '../ui.js';

export default function notFound({ catalog, error }) {
  setMeta({ title: error ? 'משהו השתבש' : 'העמוד לא נמצא' });
  const body = html`<div class="wrap page narrow center nf">
    <p class="nf-code" aria-hidden="true">${error ? '!' : '404'}</p>
    <h1>${error ? 'משהו השתבש בעמוד הזה' : 'לא מצאנו את העמוד'}</h1>
    <p class="lead">${error ? 'אפשר לרענן, או להמשיך מאחת הקטגוריות.' : 'ייתכן שהקישור ישן או שהמוצר כבר לא נמכר. אולי תמצאו אותו כאן:'}</p>
    <ul class="nf-cats" role="list">${catalog.categories.map(c => html`<li><a class="chip-link" href="${catUrl(c)}">${icon(c.icon)}${c.name}</a></li>`)}</ul>
    <p><a class="btn" href="${BASE}/">לדף הבית</a></p>
  </div>`;
  return { name: 'notfound', body };
}
