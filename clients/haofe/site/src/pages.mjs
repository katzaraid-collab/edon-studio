/* ==========================================================================
   האופה · pages built from data: the menu (../data/products.json) and one page per branch
   (site.json "branches"). Each function returns the inside of <main>; build.mjs adds the head,
   header, footer and bar. page(name) gives the link to another page (clean URL or file name).
   Pending details are wrapped in <span class="tbd">, like everywhere else on the site.
   ========================================================================== */

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
const NEW_WINDOW = '<span class="sr-only"> (נפתח בחלון חדש)</span>';
const DASH = '<span aria-hidden="true">—</span><span class="sr-only">בבדיקה</span>';

/* AI images already made for the home page boxes, reused on the menu cards (labelled as such) */
const CARD_IMAGES = {
  'מוצרי שישי': { src: 'challah-480', w: 480, h: 331, alt: 'שתי חלות קלועות, הדמיית AI' },
  'רגיל': { src: 'baguette-480', w: 480, h: 298, alt: 'שני באגטים על כיכר לחם כפרי, הדמיית AI' },
  'חלבי': { src: 'dairy-480', w: 480, h: 240, alt: 'בורקס משולשים עם שומשום ומאפים עגולים במילוי גבינה, הדמיית AI' },
  'פרווה': { src: 'rugelach-480', w: 480, h: 211, alt: 'רוגלאך וקוראסון שוקולד, הדמיית AI' }
};
const CARD_TITLES = { 'רגיל': 'לחמים ולחמניות', 'מלא': 'חיטה מלאה', 'מזונות': 'מזונות', 'מוצרי שישי': 'לשישי', 'חלבי': 'מאפים חלביים', 'פרווה': 'מאפים פרווה' };

export function menuPage(catalogue, page) {
  const cats = catalogue.categories.map(cat => {
    const items = catalogue.products.filter(p => p.category === cat.name).sort((a, b) => a.page_order - b.page_order);
    const subs = cat.subcategories && cat.subcategories.length ? cat.subcategories.map(s => s.name) : [null];
    const cards = subs.map(sub => {
      const list = items.filter(p => (sub ? p.subcategory === sub : true));
      if (!list.length) return '';
      const img = sub && CARD_IMAGES[sub];
      const title = sub ? (CARD_TITLES[sub] || sub) : cat.name;
      return `<section class="menu-card" aria-labelledby="m-${list[0].slug}">
  ${img ? `<figure><img src="assets/ai/r/${img.src}.webp" alt="${esc(img.alt)}" width="${img.w}" height="${img.h}" loading="lazy" decoding="async"><figcaption class="ai-tag" aria-hidden="true">הדמיית AI</figcaption></figure>\n  ` : ''}<h3 id="m-${list[0].slug}">${esc(title)} <span class="n">${list.length} מוצרים</span></h3>
  <ul>${list.map(p => `<li>${esc(p.name)}</li>`).join('')}</ul>
</section>`;
    }).join('\n');
    return `<h2>${esc(cat.name)}</h2>\n<div class="menu-cats">\n${cards}\n</div>`;
  }).join('\n');
  return `<h1>התפריט</h1>
<p class="lead">${catalogue.counts.products} מוצרים מהתנור שלנו: לחמים, חלות לשישי, מאפים ומוצרים יבשים.</p>
<p class="meta"><span class="tbd">הרשימה של סניף נתיבות, ממתינה לאישורכם (מבחר וכתיב)</span>. המבחר בסניפים יכול להשתנות, וכדאי להתקשר לפני שמגיעים. מחירים לא מוצגים באתר.</p>
${cats}
<div class="info-card">
  <p><strong>להזמנה בטלפון:</strong> <a href="tel:1700552255"><bdi dir="ltr">1700-55-22-55</bdi></a></p>
  <p><a href="${page('index')}#visit">כתובות, שעות וניווט לסניפים</a></p>
</div>`;
}

export function branchPage(b, all, page) {
  const phone = b.telephone
    ? `<a href="tel:${b.telephone.replace(/-/g, '')}"><bdi dir="ltr">${esc(b.phoneDisplay)}</bdi></a>`
    : DASH;
  const hours = b.hours
    ? `<ul class="hrs">${b.hours.map(([d, h]) => `<li><span>${esc(d)}</span><bdi dir="ltr">${esc(h)}</bdi></li>`).join('')}</ul>`
    : DASH;
  const notes = b.notes.map(n => `<p>${n.tbd ? `<span class="tbd">${esc(n.text)}</span>` : esc(n.text)}</p>`).join('\n');
  const others = all.filter(o => o.id !== b.id)
    .map(o => `<li><a href="${page(o.id)}">האופה ${esc(o.inCity)}</a> · ${esc(o.addressLine)}</li>`).join('');
  return `<p class="crumbs"><a href="${page('index')}">דף הבית</a> › <a href="${page('index')}#visit">סניפים</a></p>
<h1>האופה ${esc(b.inCity)}</h1>
<p class="lead">${esc(b.addressLine)}</p>
${b.since ? `<p class="meta">${esc(b.since)}</p>\n` : ''}<div class="branch-acts">
  <a class="btn-b btn-b--main" href="${esc(b.maps)}" target="_blank" rel="noopener">ניווט ב־Google Maps${NEW_WINDOW}</a>
  ${b.telephone ? `<a class="btn-b" href="tel:${b.telephone.replace(/-/g, '')}">חיוג לסניף <bdi dir="ltr">${esc(b.phoneDisplay)}</bdi></a>` : `<a class="btn-b" href="tel:1700552255">קו ההזמנות <bdi dir="ltr">1700-55-22-55</bdi></a>`}
</div>
<dl class="branch-dl">
  <dt>כתובת</dt><dd>${esc(b.addressLine)}</dd>
  <dt>טלפון</dt><dd>${phone}</dd>
  <dt>שעות</dt><dd>${hours}</dd>
  <dt>כשרות</dt><dd>${b.kashrut ? esc(b.kashrut) : DASH}</dd>
</dl>
<p class="meta"><span class="tbd">${esc(b.pending)}</span>. לפני שמגיעים, כדאי להתקשר.</p>
${notes}
<h2>הזמנה בטלפון</h2>
<p>קו ההזמנות של האופה: <a href="tel:1700552255"><bdi dir="ltr">1700-55-22-55</bdi></a>. מה אופים? <a href="${page('menu')}">לתפריט המלא</a>.</p>
<h2>סניפים נוספים</h2>
<ul>${others}</ul>`;
}

/* one Bakery for a branch page's JSON-LD, verified fields only */
export function branchLd(b, site) {
  const p = {
    '@context': 'https://schema.org', '@type': 'Bakery', name: b.name,
    address: { '@type': 'PostalAddress', streetAddress: b.street, addressLocality: b.city, addressCountry: 'IL' },
    geo: { '@type': 'GeoCoordinates', latitude: b.geo[0], longitude: b.geo[1] },
    parentOrganization: { '@type': 'Organization', name: site.name, telephone: site.orderLine.tel, sameAs: site.sameAs }
  };
  if (b.telephone) p.telephone = b.telephone;
  if (site.origin) p.url = site.origin + '/' + b.id;
  return JSON.stringify(p);
}
