/* One view for every list of products: a category, all products, search results and favourites.
   Filters and sort live in the address (?f=sale,new&sort=price-asc&cat=home) so a filtered page can be shared. */
import { BASE, html, str, icon, $ } from '../lib.js';
import { grid, crumbs, setMeta, breadcrumbLd, catUrl, soldOut, pctOff, absUrl } from '../ui.js';
import { favs, subscribe } from '../state.js';
import { searchProducts } from '../app.js';

const SORTS = [
  ['', 'מומלצים'],
  ['price-asc', 'מחיר: מהנמוך לגבוה'],
  ['price-desc', 'מחיר: מהגבוה לנמוך'],
  ['new', 'חדשים קודם'],
  ['sale', 'הנחה גדולה קודם'],
];
const FILTERS = [['sale', 'במבצע'], ['new', 'חדשים'], ['stock', 'במלאי בלבד']];

export default function listing({ catalog, params, query, go }) {
  const mode = params.mode;
  const cat = params.cat;
  let base, title, intro = '', crumbItems = [], empty;

  if (mode === 'cat') {
    base = catalog.products.filter(p => p.cat === cat.slug);
    title = cat.name; intro = cat.intro || cat.blurb;
    crumbItems = [{ name: cat.name, url: catUrl(cat) }];
    empty = 'עוד אין מוצרים בקטגוריה הזו.';
  } else if (mode === 'search') {
    base = searchProducts(params.q);
    title = params.q ? `תוצאות חיפוש: „${params.q}”` : 'חיפוש';
    crumbItems = [{ name: 'חיפוש', url: `${BASE}/search` }];
    empty = params.q ? `לא מצאנו מוצרים עבור „${params.q}”. כדאי לנסות מילה אחרת, או לעבור על הקטגוריות.` : 'מה תרצו למצוא? כתבו בשדה החיפוש למעלה.';
  } else if (mode === 'fav') {
    const ids = favs();
    base = ids.map(id => catalog.products.find(p => p.id === id)).filter(Boolean);
    title = 'המועדפים שלי';
    intro = 'המוצרים ששמרתם נשמרים בדפדפן הזה בלבד.';
    crumbItems = [{ name: title, url: `${BASE}/favorites` }];
    empty = 'עוד לא שמרתם מוצרים. לחיצה על הלב שבכל מוצר שומרת אותו כאן.';
  } else {
    base = catalog.products.slice();
    title = 'כל המוצרים';
    intro = `${catalog.products.length} מוצרים בחמש קטגוריות.`;
    crumbItems = [{ name: title, url: `${BASE}/all` }];
    empty = 'לא נמצאו מוצרים.';
  }

  setMeta({
    title,
    description: mode === 'cat' ? `${cat.name}: ${cat.intro || cat.blurb}` : `${title} · ${catalog.store.name}`,
    ld: [breadcrumbLd(crumbItems), ...(mode === 'cat' ? [{
      '@context': 'https://schema.org', '@type': 'CollectionPage', name: cat.name, description: cat.intro || cat.blurb, url: absUrl(catUrl(cat)),
    }] : [])],
  });

  const showCatChips = mode === 'all' || mode === 'search' || mode === 'fav';
  const body = html`
  <div class="wrap page listing">
    ${crumbs(crumbItems)}
    <header class="list-hd">
      <h1>${title}</h1>
      ${intro ? html`<p class="lead">${intro}</p>` : ''}
      ${mode === 'search' ? html`<form class="search-form page-search" role="search" action="${BASE}/search" id="page-search">
        <label class="vh" for="page-q">חיפוש מוצרים</label>
        ${icon('search')}
        <input id="page-q" name="q" type="search" value="${params.q}" placeholder="מה מחפשים?" autocomplete="off" enterkeyhint="search">
        <button class="btn sm" type="submit">חיפוש</button>
      </form>` : ''}
    </header>
    ${mode === 'cat' || mode === 'all' ? html`<nav class="cat-chips" aria-label="מעבר בין קטגוריות"><ul role="list">
      <li><a href="${BASE}/all" ${mode === 'all' ? html`aria-current="page"` : ''}>הכל</a></li>
      ${catalog.categories.map(c => html`<li><a href="${catUrl(c)}" ${cat && cat.slug === c.slug ? html`aria-current="page"` : ''}>${c.name}</a></li>`)}
    </ul></nav>` : ''}
    ${base.length ? html`<form class="toolbar" id="toolbar" aria-label="סינון ומיון">
      <fieldset class="filters"><legend class="vh">סינון</legend>
        ${FILTERS.map(([k, v]) => html`<label class="chip"><input type="checkbox" name="f" value="${k}"><span>${v}</span></label>`)}
        ${showCatChips && mode !== 'all' ? html`<label class="sel"><span class="vh">קטגוריה</span><select name="cat"><option value="">כל הקטגוריות</option>${catalog.categories.map(c => html`<option value="${c.slug}">${c.name}</option>`)}</select></label>` : ''}
      </fieldset>
      <label class="sel sort"><span>מיון</span><select name="sort">${SORTS.map(([k, v]) => html`<option value="${k}">${v}</option>`)}</select></label>
    </form>
    <p class="count" id="count" role="status"></p>
    <div id="results"></div>` : html`<div class="empty">${icon(mode === 'fav' ? 'heart' : 'search', 'xl')}<p>${empty}</p><a class="btn" href="${BASE}/all">לכל המוצרים</a></div>`}
  </div>`;

  return {
    name: 'listing', body,
    mount(root) {
      const ps = $('#page-search', root);
      if (ps) ps.addEventListener('submit', e => {
        e.preventDefault();
        const q = ps.q.value.trim();
        if (q) go(`${BASE}/search?q=${encodeURIComponent(q)}`);
      });
      const form = $('#toolbar', root);
      if (!form) return;
      // restore the controls from the address
      const f = new Set((query.get('f') || '').split(',').filter(Boolean));
      for (const cb of form.querySelectorAll('input[name="f"]')) cb.checked = f.has(cb.value);
      form.sort.value = SORTS.some(s => s[0] === query.get('sort')) ? query.get('sort') : '';
      if (form.cat) form.cat.value = catalog.categories.some(c => c.slug === query.get('cat')) ? query.get('cat') : '';

      const paint = (first) => {
        const on = new Set([...form.querySelectorAll('input[name="f"]:checked')].map(i => i.value));
        const catSel = form.cat ? form.cat.value : '';
        let list = base.filter(p =>
          (!on.has('sale') || pctOff(p) > 0) &&
          (!on.has('new') || (p.tags || []).includes('new')) &&
          (!on.has('stock') || !soldOut(p)) &&
          (!catSel || p.cat === catSel));
        const s = form.sort.value;
        const idx = new Map(base.map((p, i) => [p.id, i]));
        if (s === 'price-asc') list.sort((a, b) => a.price - b.price);
        else if (s === 'price-desc') list.sort((a, b) => b.price - a.price);
        else if (s === 'new') list.sort((a, b) => ((b.tags || []).includes('new') - (a.tags || []).includes('new')) || idx.get(a.id) - idx.get(b.id));
        else if (s === 'sale') list.sort((a, b) => pctOff(b) - pctOff(a));
        else if (mode !== 'search' && mode !== 'fav') list.sort((a, b) => (soldOut(a) - soldOut(b)) || ((b.featured ? 1 : 0) - (a.featured ? 1 : 0)) || idx.get(a.id) - idx.get(b.id));

        $('#count', root).textContent = list.length === 1 ? 'מוצר אחד' : `${list.length} מוצרים`;
        $('#results', root).innerHTML = str(list.length ? grid(list, { eager: first })
          : html`<div class="empty small"><p>אין מוצרים שמתאימים לסינון הזה.</p><button type="button" class="btn ghost" id="clear">ניקוי הסינון</button></div>`);

        // keep the address in step without adding history entries
        const u = new URL(location.href);
        on.size ? u.searchParams.set('f', [...on].join(',')) : u.searchParams.delete('f');
        s ? u.searchParams.set('sort', s) : u.searchParams.delete('sort');
        catSel ? u.searchParams.set('cat', catSel) : u.searchParams.delete('cat');
        if (!first) history.replaceState(history.state, '', u.pathname + u.search);
      };
      form.addEventListener('change', () => paint(false));
      form.addEventListener('submit', e => e.preventDefault());
      root.addEventListener('click', e => {
        if (e.target.closest('#clear')) {
          for (const cb of form.querySelectorAll('input[name="f"]')) cb.checked = false;
          if (form.cat) form.cat.value = '';
          paint(false);
          form.querySelector('input').focus();
        }
      });
      paint(true);

      if (mode !== 'fav') return;
      return subscribe(w => {
        if (w !== 'fav') return;
        const ids = favs();
        if (!ids.length) {
          go(location.pathname, { replace: true });
          const h1 = document.querySelector('main h1');
          if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus(); }
          return;
        }
        // keep the keyboard on the neighbouring card's heart
        const hearts = [...root.querySelectorAll('#results [data-fav]')];
        const at = hearts.indexOf(document.activeElement);
        base = ids.map(id => catalog.products.find(p => p.id === id)).filter(Boolean);
        paint(false);
        if (at >= 0) {
          const next = root.querySelectorAll('#results [data-fav]');
          const el = next[Math.min(at, next.length - 1)] || root.querySelector('h1');
          if (el) el.focus();
        }
      });
    },
  };
}
