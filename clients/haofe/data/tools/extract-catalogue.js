#!/usr/bin/env node
/*
 * extract-catalogue.js — READ-ONLY extractor for the HaOfe order page catalogue.
 *
 *   node extract-catalogue.js [outDir]        (outDir defaults to the folder above this script)
 *
 * Writes  outDir/products.json  and  outDir/menu.md.
 *
 * What it does (and only this):
 *   1. Opens https://haofeapp.com/order in headless Chromium. Every non-GET request is aborted,
 *      so nothing can be submitted even by accident.
 *   2. Reads the rendered list as first shown (to record which items sit behind "הצג עוד").
 *   3. Clicks every "הצג עוד …" button and the "פרטי סניף נתיבות" disclosure. No other clicks;
 *      it never types into a field, never presses a +/- stepper and never submits.
 *   4. Reads the structured `products` prop the server sends to the order component
 *      (the RSC payload inside the HTML) and checks it against the rendered DOM:
 *      same 49 names, same category, same subgroup, same order. A mismatch stops the run.
 *   5. Merges the editorial layer kept in this file (derived slugs, notes) and writes the outputs.
 *
 * Nothing here invents product facts. Fields the page does not provide are written as null and
 * listed under "missing". Slugs are derived by hand from the Hebrew name and flagged as such.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = 'https://haofeapp.com/order';
const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..'));

/* ---------- editorial layer (not from the page) ---------- */
// Latin slugs, transliterated from the Hebrew name (not translated). Derived, safe to change.
const SLUGS = {
  88: 'baget', 91: 'baget-hita-mlea', 86: 'jabata', 87: 'jabata-hita-mlea', 1: 'hala', 89: 'hala-baget',
  13: 'hala-gdola', 95: 'hala-mezonot', 97: 'hala-ktana', 90: 'lahmaniya-hita-mlea', 92: 'lahmaniya-kafri-agol',
  84: 'lahmaniya-mezonot', 98: 'lahmaniya-klua', 94: 'lahmaniya-kesher-merubaat', 2: 'lahmaniya',
  85: 'lahmaniya-hamburger', 93: 'lahmaniya-kesher', 53: 'mini-hamburger', 114: 'mini-frena', 4: 'pita',
  14: 'frena', 96: 'tzama-yerushalmit', 74: 'burikitas', 6: 'burekas-gvina', 116: 'burekas-mini',
  17: 'burekas-pitriyot', 66: 'burekas-pizza', 5: 'burekas-tapua', 106: 'burekas-tapua-gadol', 99: 'bis-hemaa',
  103: 'bis-shkedim', 100: 'gviniyot', 102: 'kis-shamenet', 115: 'lehem-shum', 113: 'maafe-tapuhim',
  111: 'mini-hemaa', 110: 'mini-rugelach', 67: 'maklot-vanil', 104: 'maklot-hemaa', 112: 'maklot-shokolad-halva',
  22: 'filo-gvina', 105: 'filo-pizza', 101: 'flan-gvina', 18: 'pralin-shokolad', 107: 'kruason-shokolad',
  108: 'kruason-nugat', 109: 'rugelach', 83: 'beigel-romani', 63: 'galet',
};
const FRIDAY = 'Subgroup "מוצרי שישי" is the app\'s label. The same page says Friday orders are not taken online ("אין הזמנות רגילות ליום שישי"), so a menu must not suggest ordering these online for Friday.';
const NOTES = {
  92: ['Spelling: the app has "לחמניה כפרי עגול"; concepts/b.html line 279 (.det[data-id="d3"] p) writes "לחמניה כפרי עגולה".'],
  93: ['Spelling: the app has "לחמנייה קשר"; concepts/b.html line 279 writes "לחמניית קשר".', 'The app spells the word both ways: "לחמניה" (ids 90, 92, 84, 98, 94) and "לחמנייה" (ids 2, 85, 93). Owner to choose one.'],
  95: ['Spelling: the app has "חלה מזונות"; concepts/b.html line 274 (.det[data-id="d2"] p) writes "חלת מזונות".', 'Sits under "מוצרי שישי", not under "מזונות", exactly as on the page.'],
  107: ['Spelling: "קוראסון" here, but id 108 is spelled "קורסאון". Owner to choose one.'],
  108: ['Spelling: the app has "קורסאון נוגט" while id 107 is "קוראסון שוקולד"; concepts/b.html line 289 (.det[data-id="d5"] p) writes "קוראסון נוגט". Owner to choose one spelling.'],
  111: ['The name contains "חמאה" but the app lists it under "פרווה". Confirm with the owner before showing a pareve label next to it.'],
  115: ['Listed under מאפים (sold by weight), not under לחמים, exactly as on the page.'],
};

/* ---------- helpers ---------- */
function readBalanced(s, start) { // returns the JSON text starting at s[start] ('{' or '[')
  const open = s[start], close = open === '{' ? '}' : ']';
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') { depth--; if (depth === 0) return s.slice(start, i + 1); }
  }
  throw new Error('unbalanced JSON');
}
function jsLiteralToJson(src) { // for the small constant objects in the app's JS chunk
  return src.replace(/`([^`]*)`/g, (_, t) => JSON.stringify(t)).replace(/([{,])([^\s"{}\[\],:]+):/g, '$1"$2":');
}
const readDom = () => [...document.querySelectorAll('section.pub-group')].map((sec) => {
  const h = sec.querySelector('h3');
  const rows = []; let kind = null;
  sec.querySelectorAll('.pub-list > p.pub-kind, .pub-list > .pub-item').forEach((el) => {
    if (el.matches('p.pub-kind')) { kind = el.textContent.trim(); return; }
    const copy = el.querySelector('.pub-copy');
    rows.push({ kind, name: copy.querySelector('strong').textContent.trim(), unitLabel: copy.querySelector('span') ? copy.querySelector('span').textContent.trim() : null });
  });
  return { category: h.firstChild.textContent.trim(), countText: h.querySelector('span') ? h.querySelector('span').textContent.trim() : null, rows,
    more: (sec.querySelector('button.public-more') || {}).textContent || null };
});

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ locale: 'he-IL', viewport: { width: 1280, height: 900 } })).newPage();
  const blocked = []; const scripts = {};
  await page.route('**/*', (r) => (['GET', 'HEAD'].includes(r.request().method()) ? r.continue() : (blocked.push(r.request().method() + ' ' + r.request().url()), r.abort())));
  page.on('response', async (res) => { if (/javascript/.test(res.headers()['content-type'] || '')) { try { scripts[res.url()] = await res.text(); } catch (e) { /* ignore */ } } });

  const retrievedAt = new Date().toISOString();
  const resp = await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  const html = await resp.text();
  await page.waitForTimeout(1000);
  const domInitial = await page.evaluate(readDom);

  const clicks = [];
  for (let i = 0; i < 10; i++) { // only buttons whose text starts with "הצג עוד"
    const more = page.locator('button.public-more:visible', { hasText: 'הצג עוד' });
    if (!(await more.count())) break;
    clicks.push((await more.first().innerText()).trim());
    await more.first().click(); await page.waitForTimeout(400);
  }
  const disc = page.locator('details.branch-details > summary');
  let branchText = null;
  if (await disc.count()) { clicks.push((await disc.first().innerText()).trim()); await disc.first().click(); await page.waitForTimeout(400);
    branchText = await page.locator('details.branch-details').innerText(); }
  const domFull = await page.evaluate(readDom);
  const title = await page.title();
  const metaDesc = await page.locator('meta[name="description"]').getAttribute('content', { timeout: 2000 }).catch(() => null);
  const header = await page.locator('main h1').first().innerText({ timeout: 2000 }).catch(() => null);
  const headerSub = await page.locator('main h1 + p').first().innerText({ timeout: 2000 }).catch(() => null);
  await browser.close();

  /* server data: products prop in the RSC payload */
  const payload = [...html.matchAll(/\.rsc\.push\(("(?:[^"\\]|\\.)*")\)/g)].map((m) => JSON.parse(m[1])).join('');
  const at = payload.indexOf('{"products":[');
  if (at < 0) throw new Error('products prop not found in RSC payload; the page structure changed');
  const serverProducts = JSON.parse(readBalanced(payload, at)).products;

  /* app constants from the JS chunks (category order, subgroup order, category blurbs, kg step) */
  const allJs = Object.entries(scripts);
  const findJs = (re) => { for (const [u, t] of allJs) { const m = t.match(re); if (m) return { url: u, m }; } return null; };
  const cats = findJs(/=\[(`לחמים`,`מאפים`[^\]]*)\]/);
  const kinds = findJs(/=(\{לחמים:\[[^\]]*\],מאפים:\[[^\]]*\],[^}]*\})/);
  const blurbs = findJs(/=(\{לחמים:`[^`]*`,מאפים:`[^`]*`,[^}]*\})/);
  const kgStep = findJs(/unit===`ק״ג`,c=[^,]+,l=s\?(\.?\d+):1/);
  const appConstants = {
    source_chunks: [...new Set([cats, kinds, blurbs, kgStep].filter(Boolean).map((x) => x.url))],
    category_order: cats ? JSON.parse('[' + jsLiteralToJson(cats.m[1]) + ']') : null,
    subcategory_order: kinds ? JSON.parse(jsLiteralToJson(kinds.m[1])) : null,
    category_blurbs_in_code_not_shown_on_page: blurbs ? JSON.parse(jsLiteralToJson(blurbs.m[1])) : null,
    kg_quantity_step: kgStep ? Number(kgStep.m[1]) : null,
  };

  /* cross-check server data against the rendered DOM */
  const domRows = domFull.flatMap((s) => s.rows.map((r) => ({ ...r, category: s.category })));
  const initialNames = new Set(domInitial.flatMap((s) => s.rows.map((r) => s.category + '|' + r.name)));
  const byName = new Map(serverProducts.map((p) => [p.category + '|' + p.name, p]));
  const problems = [];
  if (domRows.length !== serverProducts.length) problems.push(`DOM has ${domRows.length} rows, server data has ${serverProducts.length}`);
  const products = domRows.map((r, i) => {
    const p = byName.get(r.category + '|' + r.name);
    if (!p) { problems.push('not in server data: ' + r.category + ' / ' + r.name); return null; }
    if ((p.type || null) !== (r.kind || null)) problems.push(`subgroup mismatch for ${r.name}: DOM ${r.kind} vs data ${p.type}`);
    const kg = p.unit === 'ק״ג';
    const kashrut = p.category === 'מאפים' && ['חלבי', 'פרווה'].includes(p.type) ? p.type : null;
    const notes = [...(NOTES[p.id] || [])];
    if (p.type === 'מוצרי שישי') notes.push(FRIDAY);
    if (!SLUGS[p.id]) notes.push('NEW since 2026-10-24: no slug assigned yet; add one to SLUGS in tools/extract-catalogue.js.');
    return {
      id: p.id,
      slug: SLUGS[p.id] || null,
      name: p.name,
      category: p.category,
      subcategory: p.type || null,
      unit: p.unit,
      sold_by: kg ? 'weight_kg' : p.unit === 'יחידה' ? 'unit' : p.unit,
      unit_label_on_page: r.unitLabel,
      quantity_step: kg ? appConstants.kg_quantity_step : 1,
      kashrut_type: kashrut,
      kashrut_type_basis: kashrut ? `app subgroup label "${kashrut}" under מאפים (Netivot order page); not a kashrut certificate` : 'not stated on the page',
      options: p.options || [],
      search_aliases: p.aliases || [],
      page_order: i + 1,
      visible_before_show_more: initialNames.has(r.category + '|' + r.name),
      price: null, description: null, image: null, ingredients: null, allergens: null, unit_weight: null,
      notes,
    };
  }).filter(Boolean);
  const slugs = products.map((p) => p.slug).filter(Boolean);
  if (new Set(slugs).size !== slugs.length) problems.push('duplicate slugs');
  if (problems.length) { console.error('CROSS-CHECK FAILED:\n' + problems.join('\n')); process.exit(2); }

  const categories = domFull.map((s) => {
    const subs = [];
    s.rows.forEach((r) => { const k = r.kind || null; const last = subs[subs.length - 1]; if (last && last.name === k) last.count++; else subs.push({ name: k, count: 1 }); });
    return { name: s.category, count_shown_on_page: s.countText, product_count: s.rows.length, subcategories: subs.filter((x) => x.name !== null), show_more_button_initial: (domInitial.find((d) => d.category === s.category) || {}).more || null };
  });
  const emptyInCode = appConstants.subcategory_order ? Object.entries(appConstants.subcategory_order).flatMap(([c, ks]) => {
    const cat = categories.find((x) => x.name === c);
    if (!cat) return [{ category: c, subcategory: null, note: 'category defined in app code, no products on the page' }];
    return ks.filter((k) => !cat.subcategories.some((x) => x.name === k)).map((k) => ({ category: c, subcategory: k, note: 'subcategory defined in app code, no products on the page' }));
  }) : null;

  const doc = {
    about: 'HaOfe product catalogue as listed on the public order page of the owner\'s ordering app. Generated by tools/extract-catalogue.js. Do not hand-edit product rows; re-run the script.',
    source: {
      url: URL,
      final_url: resp.url(),
      http_status: resp.status(),
      page_title: title,
      meta_description: metaDesc,
      page_header: [header, headerSub].filter(Boolean),
      retrieved_at: retrievedAt,
      method: 'Playwright Chromium, read-only. All non-GET requests aborted (' + blocked.length + ' blocked). Clicked only: ' + clicks.map((c) => '"' + c + '"').join(', ') + '. Product rows come from the server-rendered "products" prop of the order component and were cross-checked against the rendered DOM (names, category, subgroup, order).',
      scope: 'Netivot branch, self-pickup only. The page says "לאיסוף מסניף נתיבות" and "שדרות ירושלים 136, נתיבות · איסוף עצמי בלבד". Sderot and Kiryat Gat do not appear in the app.',
      app_status: 'Not launched, according to the owner. The page is publicly reachable (HTTP 200). This catalogue describes what the page lists, not what is on the shelves today.',
      branch_panel_text: branchText,
    },
    counts: { products: products.length, by_category: Object.fromEntries(categories.map((c) => [c.name, c.product_count])) },
    categories,
    app_constants: appConstants,
    defined_in_app_code_but_empty_on_page: emptyInCode,
    id_note: 'ids are the app\'s own numeric product ids (max ' + Math.max(...products.map((p) => p.id)) + ', ' + products.length + ' listed). The gaps mean other products exist in the app that the public page does not list; what they are is unknown.',
    kashrut_note: 'kashrut_type copies the app\'s "חלבי" / "פרווה" subgroup label for pastries on the Netivot order page. It is not a certification. Breads and dry goods carry no label on the page (null). Badatz Beit Yosef lists Sderot (יגאל אלון 4) as מהדרין חלבי + מהדרין פרווה, Kiryat Gat (הרימון 70) as מהדרין פרווה only, and the Netivot factory (הסוללים 1) as מהדרין חלבי + פרווה; no Badatz record was found for the Netivot store (research.json "research:kashrut" and "verify:branches", viewed 2026-10-24).',
    missing: {
      price: 'Not shown on the page and not present in the page data.',
      description: 'No product descriptions on the page.',
      image: 'No product photos on the page (generic icon only).',
      ingredients_allergens: 'Not on the page.',
      unit_weight: 'Not on the page (e.g. weight of a challah or a pita).',
      availability_by_branch: 'The app covers Netivot only. The ranges at Sderot and Kiryat Gat are unknown.',
      availability_by_day: 'Not per product. The page only says Friday orders are by phone.',
      option_display: 'Options (e.g. שומשום עם / בלי) are in the page data. How they appear was not checked, because that requires selecting a product.',
      seasonal_items: 'Seasonal items (e.g. סופגניות) are not in the app. They appear only in social posts; see menu.md.',
      wholesale_range: 'The production house sells bread to supermarkets; that range is not on this page and is unknown.',
    },
    products,
  };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'products.json'), JSON.stringify(doc, null, 2) + '\n');
  fs.writeFileSync(path.join(OUT, 'menu.md'), renderMenu(doc));
  console.log(`ok: ${products.length} products, ${categories.length} categories -> ${OUT}`);
})().catch((e) => { console.error(e); process.exit(1); });

/* ---------- menu.md ---------- */
function renderMenu(doc) {
  const d = new Date(doc.source.retrieved_at);
  const il = new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'numeric', year: 'numeric' }).format(d).replace(/\//g, '.');
  const L = [];
  L.push('<!-- Generated by data/tools/extract-catalogue.js from ' + doc.source.url + ' (the owner\'s ordering app, not launched; do not link it) at ' + doc.source.retrieved_at + '. Do not edit the lists by hand; re-run the script. -->');
  L.push('<!-- Render inside an element with lang="he" dir="rtl". Everything above the "Notes for the site team" rule is publishable text; everything below it is not. -->');
  L.push('');
  L.push('# המוצרים שלנו');
  L.push('');
  L.push(`הרשימה של סניף נתיבות, מעודכנת ל־${il}. ${doc.counts.products} מוצרים בשלוש קטגוריות.`);
  for (const cat of doc.categories) {
    const items = doc.products.filter((p) => p.category === cat.name);
    L.push('');
    L.push(`## ${cat.name} (${items.length} מוצרים)`);
    L.push('');
    const units = [...new Set(items.map((p) => p.sold_by))];
    if (units.length === 1) L.push(units[0] === 'weight_kg' ? 'נמכרים לפי משקל · ק״ג.' : 'נמכרים לפי יחידה.');
    if (cat.subcategories.length) {
      for (const sub of cat.subcategories) {
        const subItems = items.filter((p) => p.subcategory === sub.name);
        L.push('');
        L.push(`### ${sub.name} (${subItems.length} מוצרים)`);
        L.push('');
        subItems.forEach((p) => L.push(`- ${p.name}`));
      }
    } else {
      L.push('');
      items.forEach((p) => L.push(`- ${p.name}`));
    }
  }
  L.push('');
  L.push('---');
  L.push('');
  L.push(NOTES_MD(doc));
  return L.join('\n') + '\n';
}

function NOTES_MD(doc) {
  const withOptions = doc.products.filter((p) => p.options.length);
  const optLine = (p) => `- ${p.name} (id ${p.id}): ` + p.options.map((o) => `${o.label}: ${o.choices.join(' / ')}${o.default ? ` (ברירת מחדל: ${o.default})` : ''}`).join('; ');
  const aliases = doc.products.filter((p) => p.search_aliases.length).map((p) => `- ${p.name}: ${p.search_aliases.join(', ')}`);
  const flagged = doc.products.filter((p) => (NOTES[p.id] || []).length).map((p) => `- ${p.name} (id ${p.id}): ${NOTES[p.id].join(' ')}`);
  return `## Notes for the site team (not for publication)

Source: ${doc.source.url}, read ${doc.source.retrieved_at} (UTC) with a read-only browser. Product data: products.json in this folder (same run). Scope: Netivot branch, self-pickup, app not launched.

### How the page groups the list (keep it exactly)
- Category order: ${doc.categories.map((c) => c.name).join(' > ')}. Subgroup order inside לחמים: ${doc.categories[0].subcategories.map((s) => s.name).join(' > ')}; inside מאפים: ${(doc.categories[1] || { subcategories: [] }).subcategories.map((s) => s.name).join(' > ')}. מוצרים יבשים has no subgroups.
- Item order inside a subgroup is the app's order (alphabetical as served). Names are copied character for character, including ׳ (U+05F3) and ״ (U+05F4).
- On the page, breads show no unit text (their data unit is "יחידה"); every pastry shows "לפי משקל · ק״ג" and steps in ${doc.app_constants.kg_quantity_step ?? 'unknown'} kg. Here the unit is stated once per category instead of on every line.
- The app's code also carries a blurb for pastries, "${((doc.app_constants.category_blurbs_in_code_not_shown_on_page || {})['מאפים']) || '?'}", which the public page does not show. Whether the shop also sells pastries per piece is unknown; ask the owner before writing "לפי משקל" as a shop-wide rule.
- The page shows the first 4 items of each category and hides the rest behind "הצג עוד 18 מוצרים" (לחמים) and "הצג עוד 21 מוצרים" (מאפים). A menu page should list all ${doc.counts.products} items open; if it collapses them, use a real <button aria-expanded aria-controls>, as the app does (button.public-more).

### Accessible markup for the menu page
- One <h2> per category and one <h3> per subgroup, with the count inside the heading text, and one <ul> per subgroup. The app marks subgroups as <p class="pub-kind">, so screen-reader users cannot jump between them there; do not copy that.
- Write the unit once: <p>נמכרים לפי משקל · <abbr title="קילוגרם">ק״ג</abbr>.</p>
- "תפו״א" appears in two names (ids 5, 106). Mark it <abbr title="תפוחי אדמה">תפו״א</abbr> and keep the visible text unchanged.
- Give each item a stable anchor from products.json: id="p-{slug}" (for example id="p-baget").
- No prices, no photos, no descriptions: the page has none, so the menu has none. Do not add "AI" product shots to menu rows.

### Unknown (do not fill in)
- Prices: not shown on the page and not in its data.
- Descriptions, ingredients, allergens, unit weights, photos: not on the page.
- Sderot and Kiryat Gat ranges: the app lists Netivot only. Do not present this list as the chain-wide range without the owner's confirmation.
- Kashrut: "חלבי" and "פרווה" are the app's subgroup labels for pastries, not a certificate. Keep them as plain subgroup headings. If the menu page serves all branches, put a branch note on the חלבי subgroup, because Badatz lists Kiryat Gat as מהדרין פרווה only; the wording of that note needs the owner. Breads and dry goods have no label. Certification differs by branch (Badatz Beit Yosef: Sderot מהדרין חלבי + פרווה, Kiryat Gat מהדרין פרווה only, Netivot factory מהדרין חלבי + פרווה, no record found for the Netivot store). Never print one kashrut level above this list.
- Friday: the page says "אין הזמנות רגילות ליום שישי. להזמנות גדולות ומיוחדות יש לפנות ישירות לסניף בטלפון 08-9752093 לתיאום ואישור." The subgroup name "מוצרי שישי" must not be read as "order online for Friday".
- Supermarket / wholesale range: not on this page.
- The app holds more product ids than it lists (max id ${Math.max(...doc.products.map((p) => p.id))}, ${doc.counts.products} listed). The app code also defines empty groups: ${(doc.defined_in_app_code_but_empty_on_page || []).map((e) => e.subcategory ? e.category + ' / ' + e.subcategory : e.category).join(', ') || 'none'}. Its code blurb for מוצרים יבשים reads "${((doc.app_constants.category_blurbs_in_code_not_shown_on_page || {})['מוצרים יבשים']) || '?'}", but the page lists only בייגל רומני and גאלט. Do not publish the blurbs or the empty groups.

### Seasonal and feed-only items (not in the app)
Sufganiyot are not on the order page. Sources that do mention them:
- Instagram @haofe_bakery, post of 11.10.2026: "דואגים לכם לשומר מסך. הסופגניות הכי טעימות זה רק אצלנו!!" The caption names no flavours.
- Instagram @haofe_bakery, reel of 18.10.2026: "רגע לפני שהן הופכות לסופגניות שאתם כל כך אוהבים…"
- Facebook page 895926247234370, post of 30.11.2025 via the bakerias.com mirror: "סניף נתיבות הפצצתם! עונת הסופגניות נפתחה פה בענק".
Instagram dates were calculated from post ids and were read through the public embed on 24.10.2026 (concepts/index.html, section "מה ראיתי באינסטגרם"). Coffee shows up in the feed and is not in the app either. If the owner approves, add one separate block after the three categories, never mixed into them:

<!-- seasonal block, publish only after owner approval
## בעונה
- סופגניות
-->

Do not list flavours, prices or dates for it until the owner supplies them.

### Options and search aliases in the page data
These are in the page's product data. How they display was not checked, because that requires selecting a product. Confirm them before publishing.
${withOptions.map(optLine).join('\n')}

Search aliases (not shown, useful as site-search synonyms):
${aliases.join('\n')}

### Name issues for the owner
${flagged.join('\n')}
`;
}
