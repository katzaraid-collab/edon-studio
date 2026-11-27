/* Info and policy pages. The text lives in pages.js; {{tokens}} are filled from the store config,
   so changing the phone number or the shipping price in catalog.json updates every page. */
import { BASE, html, raw, icon, fill } from '../lib.js';
import { crumbs, setMeta, breadcrumbLd } from '../ui.js';
import { PAGES } from '../pages.js';
import notFound from './notfound.js';

const ORDER = ['about', 'contact', 'faq', 'shipping', 'terms', 'privacy', 'accessibility'];
const ALLOWED = /^(h2|h3|p|ul|ol|li|strong|a|br|b|em)$/;

/* pages.js is trusted source code, but keep the output to the tags the pages are meant to use */
function safe(htmlText) {
  const t = document.createElement('template');
  t.innerHTML = htmlText;
  for (const el of [...t.content.querySelectorAll('*')]) {
    if (!ALLOWED.test(el.localName)) { el.replaceWith(...el.childNodes); continue; }
    for (const a of [...el.attributes]) {
      const keep = el.localName === 'a' && a.name === 'href' && /^(\/|https:\/\/|mailto:|tel:)/.test(a.value);
      if (!keep) el.removeAttribute(a.name);
    }
    if (el.localName === 'a' && /^https:\/\//.test(el.getAttribute('href') || '')) { el.target = '_blank'; el.rel = 'noopener'; }
  }
  return t.innerHTML;
}

export default function info(ctx) {
  const { catalog, params } = ctx;
  const page = PAGES[params.slug];
  if (!page) return notFound(ctx);
  const st = catalog.store;
  const url = `${BASE}/info/${params.slug}`;
  const faq = page.faq || [];

  setMeta({
    title: page.title, description: fill(page.description || '', st),
    ld: [breadcrumbLd([{ name: page.title, url }]), ...(faq.length ? [{
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: faq.map(f => ({ '@type': 'Question', name: fill(f.q, st), acceptedAnswer: { '@type': 'Answer', text: fill(f.a, st) } })),
    }] : [])],
  });

  const body = html`<div class="wrap page info">
    ${crumbs([{ name: page.title, url }])}
    <div class="info-grid">
      <nav class="info-nav" aria-label="עמודי מידע"><ul role="list">
        ${ORDER.filter(k => PAGES[k]).map(k => html`<li><a href="${BASE}/info/${k}" ${k === params.slug ? raw('aria-current="page"') : ''}>${PAGES[k].title}</a></li>`)}
      </ul></nav>
      <article class="prose">
        <h1>${page.title}</h1>
        ${page.body ? raw(safe(fill(page.body, st))) : ''}
        ${faq.length ? html`<div class="faq">${faq.map(f => html`<details><summary>${fill(f.q, st)}${icon('down')}</summary><div class="faq-a"><p>${fill(f.a, st)}</p></div></details>`)}</div>` : ''}
      </article>
    </div>
  </div>`;
  return { name: 'info', body };
}
