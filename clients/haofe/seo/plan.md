# SEO, local SEO and AI search plan: האופה - בוטיק לחם

Draft 2026-10-24 · SEO step · output folder `/home/user/edon-studio/clients/haofe/seo/`

**Owner decision, 24.10.2026:** haofeapp.com, the bakery's ordering app, is not part of the site. The site has no link to it, no online ordering or "coming soon", no `/order` page and no launch-day switch. Ordering is by phone only, on the ordering line 1700-55-22-55. This plan was updated to match: `/order` is gone from the IA, titles, robots, status codes and link map; T15, L15, section 11 and owner item 17 are cancelled.

## סיכום לבעלים (בעברית)

- **שם אחד בכל מקום:** "האופה - בוטיק לחם". היום שלושת הפרופילים בגוגל רשומים בשלוש צורות שונות. להאחיד אותם, בלי גרשיים ובלי שם העיר.
- **פרופיל קריית גת בגוגל:** נראה שאף אחד לא תבע עליו בעלות, ואין בו קישור לאתר. זו הסקה שלנו: מופיע בו "תביעת בעלות על עסק זה". כדאי לתבוע אותו מאותו חשבון גוגל שמנהל את נתיבות ושדרות.
- **שעות פתיחה:** בכל סניף ארבעה מקורות סותרים. זה הדבר שהכי פוגע בגוגל ובתשובות של צ׳אטבוטים. צריך מכם שעות שבועיות לכל סניף, ואז נעדכן אותן בגוגל ובאתר באותו יום.
- **טלפונים:** בשדרות צריך לאשר את 08-6491122. בקריית גת צריך לבחור מספר אחד מתוך שלושה.
- **האתר ייבנה כ־HTML רגיל, לא כמו האב־טיפוס.** באב־טיפוס כל התוכן נטען ב־JavaScript, ולכן מנועי חיפוש וצ׳אטבוטים לא רואים אותו.
- **הזמנות:** באתר מזמינים בטלפון בלבד, בקו ההזמנות 1700-55-22-55. לפי ההחלטה שלכם מ־24.10.2026, אפליקציית ההזמנות אינה חלק מהאתר, והאתר לא מקשר אליה.
- **קבצים:** כל הקבצים מוכנים בתיקייה הזו: מבנה האתר, כותרות ותיאורים לכל דף, נתונים מובנים (JSON-LD), llms.txt, robots.txt, sitemap.xml ובדיקת טקסט חלופי לכל תמונה.

## Contents
1. Sources and rules
2. Site map and URL slugs
3. Titles, meta descriptions, OG and Twitter, per page
4. Share image and head markup
5. Heading outlines (and what to change from b.html)
6. Technical SEO checklist for the build
7. Internal links
8. Local SEO: the three Google Business Profiles
9. NAP consistency: every source's current values
10. AI search (AEO/GEO)
11. Launch day of the ordering app: cancelled (24.10.2026)
12. Owner decisions and missing data
13. Files in this folder

---

## 1. Sources and rules

- **Where facts come from.** Facts come only from `/tmp/claude-0/-home-user-edon-studio/39250604-ba72-5066-b62c-771f07ec61a3/scratchpad/agents4/research.json`, cited by section, e.g. `verify:branches` or `research:kashrut`. There are three additions, each first-party:
  - The TikTok bio of @haofe_bakery1, saved 2026-10-24 01:47 UTC at `/tmp/claude-0/-home-user-edon-studio/39250604-ba72-5066-b62c-771f07ec61a3/scratchpad/agents/schema/dl/tiktok.html`. It reads: "רשת מאפיות ובית ייצור למאפים / שדרות • נתיבות • קריית גת / להזמנות: 1700-55-22-55", with display name "האופה - בוטיק לחם".
  - The product names in the owner's own ordering app (saved app files under `scratchpad/agents/app/raw`).
  - Two owner statements recorded on the research page `concepts/index.html` (24.10.2026): the production house sells bread to supermarkets nationwide, and @haofe_bakery is the verified Instagram account.
- **Unknowns are marked MISSING.** Values that conflict are never shown, and the wording "pending owner" marks them.
- **Placeholder domain.** The marketing domain is not known, so `https://haofe.example` stands in for it everywhere. `.example` is reserved, so a forgotten placeholder will be obvious.
- **Earlier drafts.** This plan builds on the earlier site-architecture draft (`clients/haofe/research/site-architecture.md`) and schema draft (`clients/haofe/research/schema.md`), and keeps their slugs. Their `/order` page, `orderApp.status` switch and OrderAction block are superseded by the owner's decision of 24.10.2026 (top of this file).

**Verified facts used in this plan**

| Fact | Value | Source |
|---|---|---|
| Active branches | נתיבות, שדרות, קריית גת (only these three) | `verify:branches`: own post https://www.instagram.com/p/DegS23RIAJ-/ (2026-10-15), IG bio |
| Netivot | שדרות ירושלים 136, נתיבות · 08-9752093 | the branch panel of the owner's ordering system, viewed 24.10.2026; Google cid 11794734948161764260 |
| Sderot | יגאל אלון 4, שדרות | branch post DeghqXvtZje (2026-10-15); Google cid 10594881781052471767; Badatz |
| Kiryat Gat | הרימון 70, קריית גת; opened 22.8.2022; seating, coffee, pastries, cakes, sandwiches | branch post DeJXIltIyeh (2026-10-06); FB opening post 2022-08-22; Google cid 4460162658001013556 |
| Ordering line | 1700-55-22-55 ("להזמנות") | IG and TikTok bios |
| Brand description | "רשת מאפיות ובית ייצור למאפים, לחמים ודברי פרימיום" | IG bio (`research:social`) |
| Sderot balcony and coffee | "לשתות קפה במרפסת היפה שלנו", "wifi חינם" | owner description on the Sderot Google listing; post DetORsxtzJW (2026-10-20) |
| Products | באגט, ג׳בטה, פיתה, חלה, צמה ירושלמית, פרנה, מיני פרנה, בורקס גבינה, גביניות, רוגלאך, קוראסון שוקולד, בייגל רומני, גאלט, and others | owner's app catalogue (49 items, no prices); sufganiyot from IG posts of 11, 18 and 20.10.2026 |
| Supermarkets | the production house sells bread to supermarkets nationwide (no chain names) | owner statement 24.10.2026 (research page). The Victory "בוטיק האופה" link is rejected in `verify:branches` |
| Online ordering | not on the site: ordering is by phone only | owner decision, 24.10.2026 |

**Not used.** These are rejected or unresolved in `verify:branches`:
- opening hours (all branches);
- the Sderot phone (pending owner);
- the Kiryat Gat phone (three numbers);
- kashrut, on the site or in schema, until the owner confirms it against certificates;
- "מרכז מסחרי טדי קולק" (Google only);
- Beit Shemesh (closed or unknown);
- the factory at הסוללים 1 as a visitable place;
- "main/flagship branch".

---

## 2. Site map and URL slugs

```
/                        דף הבית                       index · sitemap · launch day
├── /branches            סניפים (hub)                   index · sitemap · launch day
│   ├── /branches/netivot      סניף נתיבות              index · sitemap · launch day (address + phone verified)
│   ├── /branches/sderot       סניף שדרות               index · sitemap · when owner confirms phone
│   └── /branches/kiryat-gat   סניף קריית גת            index · sitemap · when owner picks phone
├── /products            מה יש בקופסה (catalogue)       index · sitemap · when owner approves the list
├── /business            לעסקים ולסופרמרקטים            index · sitemap · when owner approves wording + contact
├── /about               הסיפור שלנו                    index · sitemap · when owner approves the story
├── /accessibility       הצהרת נגישות                   index · sitemap · launch day
├── /privacy             מדיניות פרטיות                 index · sitemap · launch day
└── 404                                                 noindex · HTTP 404
```

**URL rules** (these match the earlier architecture draft):
- **Latin slugs.** Hebrew slugs turn into `%D7…` strings when shared in WhatsApp, in print or in QR codes.
- **Lowercase, no trailing slash.** `/branches/` gets a 301 to `/branches`. Uppercase gets a 301 to lowercase.
- **One host.** Use one https origin, www or apex but not both. Everything else gets a 301 to it, including http to https.
- **Until a branch page exists,** its links and JSON-LD `url` point to `/branches#sderot` or `/branches#kiryat-gat`. The anchors are the `id` of each branch card on the hub. When the page goes live, change the links in one data file. Don't add redirects from fragments; there is nothing to redirect.
- **No pages for:** a city without a branch, Beit Shemesh, the factory, single products, or a blog. None of them has real content yet, and swapping city names into copied text is doorway content.
- **Branch pages are not doorways:** each of the three has its own Google listing, phone, Instagram account, kashrut level (per Badatz) and features. Kiryat Gat has seating, and Sderot has the balcony.

**Hub or one long page?** Both: the home page keeps the three branch cards (as in b.html `.visit`), and each card links to its branch page. A local search ("מאפייה בשדרות") should land on a page whose title, H1, address and schema are about that one branch. The page set is small enough for every page to be written by hand.

---

## 3. Titles, meta descriptions, OG and Twitter, per page

**Checks:**
- **Lengths** were counted by script (`meta.py` in the scratch folder): title ≤ 60, description ≤ 155. Every title and every description is unique.
- **Machine-readable copy:** the same values are in `head-meta.json`, which also holds canonical, robots and OG.
- **Brand name in full:** titles always use the whole name "האופה - בוטיק לחם", never bare "האופה". At least nine unrelated businesses are called "האופה" (`verify:branches` rejected_claims), so the full name is what tells search engines and AI which bakery this is.

| Page | Title (chars) | Meta description (chars) |
|---|---|---|
| `/` | האופה - בוטיק לחם \| מאפייה בנתיבות, שדרות וקריית גת (51) | לחמים, חלות לשישי, פרנה, בורקס ורוגלאך מהתנור של האופה. שלושה סניפים: שדרות ירושלים 136 נתיבות, יגאל אלון 4 שדרות והרימון 70 קריית גת. (134) |
| `/branches` | סניפי האופה - בוטיק לחם: נתיבות, שדרות וקריית גת (48) | שלושה סניפים של האופה - בוטיק לחם: שדרות ירושלים 136 בנתיבות, יגאל אלון 4 בשדרות והרימון 70 בקריית גת. כתובת וניווט לכל סניף. (125) |
| `/branches/netivot` | מאפייה בנתיבות: האופה - בוטיק לחם, שדרות ירושלים 136 (52) | סניף האופה בנתיבות, שדרות ירושלים 136: לחמים, חלות ומאפים חלביים ופרווה מהתנור שלנו. טלפון לסניף 08-9752093. כתובת, ניווט ופרטי הסניף. (134) |
| `/branches/sderot` | מאפייה בשדרות: האופה - בוטיק לחם, יגאל אלון 4 (45) | סניף האופה בשדרות, ברחוב יגאל אלון 4: מאפים וקפה במרפסת של הסניף. כתובת, ניווט ופרטי הסניף, ועדכונים מהסניף באינסטגרם @haofe_sderot. (132) |
| `/branches/kiryat-gat` | מאפייה בקריית גת: האופה - בוטיק לחם, הרימון 70 (46) | סניף האופה בקריית גת, הרימון 70: מקום לעצור בו באמצע היום, עם ישיבה במקום, קפה, מאפים, עוגות וכריכים. כתובת, ניווט ופרטי הסניף. (127) |
| `/products` | לחמים, חלות ומאפים \| האופה - בוטיק לחם (38) | מה אופים בהאופה: באגט, ג׳בטה ופיתה, חלות וצמה ירושלמית לשישי, פרנה, מאפים חלביים ופרווה כמו בורקס גבינה ורוגלאך, וסופגניות בעונה. (129) |
| `/business` | לחם לסופרמרקטים ולעסקים \| האופה - בוטיק לחם (43) | בית הייצור של האופה - בוטיק לחם מספק לחמים לסופרמרקטים ברחבי הארץ. מידע לסופרים, לרשתות ולעסקים שרוצים את הלחם שלנו על המדף. (124) |
| `/about` | הסיפור שלנו \| האופה - בוטיק לחם (31) | איך מאפייה אחת בנתיבות הפכה לשלושה סניפים ולבית ייצור: הסיפור של האופה - בוטיק לחם, מנתיבות דרך שדרות ועד קריית גת. (115) |
| `/accessibility` | הצהרת נגישות \| האופה - בוטיק לחם (32) | הצהרת הנגישות של אתר האופה - בוטיק לחם: מה הונגש באתר, מה עוד בטיפול, ואיך פונים אלינו בנושא נגישות. (100) |
| `/privacy` | מדיניות פרטיות \| האופה - בוטיק לחם (34) | מדיניות הפרטיות של אתר האופה - בוטיק לחם: איזה מידע האתר אוסף, למה, ואיך מבקשים לעיין בו או לתקן אותו. (102) |
| 404 (noindex) | העמוד לא נמצא \| האופה - בוטיק לחם (33) | העמוד שחיפשתם לא נמצא. אפשר לחזור לדף הבית או לבחור סניף: נתיבות, שדרות או קריית גת. (84) |

**Open Graph and Twitter texts.** The share texts are shorter, because WhatsApp shows about 110 characters. They use the brand's own lines where possible. Twitter tags repeat the OG text.

| Page | og:title / twitter:title | og:description / twitter:description |
|---|---|---|
| `/` | האופה - בוטיק לחם | האופה מחכה לכם בנתיבות, בשדרות ובקריית גת. תבחרו את הסניף שלכם ובואו לבקר! *(quote from post DegS23RIAJ-, 15.10.2026)* |
| `/branches` | סניפי האופה: נתיבות, שדרות וקריית גת | תבחרו את הסניף שלכם ובואו לבקר! כתובת וניווט לכל אחד משלושת הסניפים. |
| `/branches/netivot` | האופה בנתיבות · שדרות ירושלים 136 | לחמים, חלות ומאפים מהתנור שלנו. שדרות ירושלים 136, נתיבות · 08-9752093 |
| `/branches/sderot` | האופה בשדרות · יגאל אלון 4 | מחכים לכם ביגאל אלון 4, שדרות. מאפים, קפה והמרפסת שלנו. |
| `/branches/kiryat-gat` | האופה בקריית גת · הרימון 70 | קריית גת, אנחנו מחכים לכם: קפה, מאפים ומקום נעים לשבת. הרימון 70. |
| `/products` | מה יש בקופסה · האופה - בוטיק לחם | לחמים, חלות לשישי, פרנה, בורקס, רוגלאך וסופגניות בעונה. מהתנור של האופה. |
| `/business` | הלחם של האופה, גם על המדף בסופר | בית הייצור של האופה מספק לחמים לסופרמרקטים ברחבי הארץ. |
| `/about` | הסיפור של האופה | מאפייה אחת בנתיבות, שלושה סניפים ובית ייצור. |
| `/accessibility` | הצהרת נגישות · האופה | מה הונגש באתר האופה ואיך פונים אלינו בנושא נגישות. |
| `/privacy` | מדיניות פרטיות · האופה | איזה מידע אתר האופה אוסף ולמה. |

**Wording that depends on the owner:**
- **When hours are confirmed,** append "שעות פתיחה" to each branch description, e.g. "כתובת, שעות פתיחה וניווט". Until then, no description promises hours.
- **When a branch phone is confirmed,** add it to that branch's description in the same form as Netivot ("טלפון לסניף 0X-XXXXXXX").
- **Kashrut** never goes in a title, description or OG text until the owner gives the certificate wording for that branch.

---

## 4. Share image and head markup

- **og:image:** use one brand card for all pages, `/og/haofe-1200x630.png`: the logo on cream `#F7F1E6`, plus the line "נתיבות · שדרות · קריית גת". Spec and alt are in `alt-text.md` §3.
  - **No AI render** goes in any og:image.
  - **Per-branch images** come only once real branch photos exist.
- **Twitter/X handle:** none was found, so `twitter:site` is MISSING. Leave it out.
- **Example `<head>` for `/`** (other pages: same pattern, values from `head-meta.json`):

```html
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>האופה - בוטיק לחם | מאפייה בנתיבות, שדרות וקריית גת</title>
<meta name="description" content="לחמים, חלות לשישי, פרנה, בורקס ורוגלאך מהתנור של האופה. שלושה סניפים: שדרות ירושלים 136 נתיבות, יגאל אלון 4 שדרות והרימון 70 קריית גת.">
<link rel="canonical" href="https://haofe.example/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="האופה - בוטיק לחם">
<meta property="og:locale" content="he_IL">
<meta property="og:url" content="https://haofe.example/">
<meta property="og:title" content="האופה - בוטיק לחם">
<meta property="og:description" content="האופה מחכה לכם בנתיבות, בשדרות ובקריית גת. תבחרו את הסניף שלכם ובואו לבקר!">
<meta property="og:image" content="https://haofe.example/og/haofe-1200x630.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="הלוגו של האופה - בוטיק לחם על רקע שמנת, ומתחתיו: נתיבות · שדרות · קריית גת">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="האופה - בוטיק לחם">
<meta name="twitter:description" content="האופה מחכה לכם בנתיבות, בשדרות ובקריית גת. תבחרו את הסניף שלכם ובואו לבקר!">
<meta name="twitter:image" content="https://haofe.example/og/haofe-1200x630.png">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="theme-color" content="#F7F1E6">
<script type="application/ld+json">/* jsonld.json → pages["/"].jsonld */</script>
</head>
```

- **Robots meta:** the 404 page gets `noindex`. No other page gets a robots meta.

---

## 5. Heading outlines (and what to change from b.html)

### 5.1 Home `/`
**Fixes to b.html** (the file is read-only for me; these are for the production build):

1. **H1 has no entity.** `.hero h1` (b.html line 230) reads "הטעם שתמיד כיף לחזור אליו", with no brand, place or category. Keep the slogan and add a small kicker inside the H1, so the first heading says what and where:
   ```html
   <h1><span class="h1-kicker">האופה - בוטיק לחם · נתיבות, שדרות וקריית גת</span><span class="sr-only">: </span>הטעם שתמיד <em>כיף לחזור</em> אליו</h1>
   ```
   - **Style:** `.h1-kicker` is a block, styled like the existing `.hand`/eyebrow text: small, `--stamp` colour.
   - **Why the hidden colon:** the `sr-only` colon keeps the extracted text readable ("…וקריית גת: הטעם שתמיד…").
   - **Alternative if design rejects the kicker:** keep the H1 and start `.sub` (line 231) with "האופה - בוטיק לחם, מאפייה בנתיבות, בשדרות ובקריית גת:". It is weaker, because headings carry more weight than body text.
2. **The order H2 held both states.** Done in b.html on 24.10.2026: the order module is now the phone receipt with one H2, "מזמינים בטלפון", and the nav chips are gone (the owner removed online ordering from the site).
3. **Product headings run words together.** Each `.box h3` reads e.g. "פרנה ומיני פרנה לשישיפתחו". Put a space between `</span></span>` and `<span class="open">`, so the text reads "…לשישי פתחו". Keep the "פתחו" label visible and inside the button; it is the button's visible label.
4. **Branch headings are just city names.** The branch card `h3` (lines 370, 381, 391) shows only the city. Use "סניף נתיבות", "סניף שדרות" and "סניף קריית גת", so each heading still makes sense when quoted alone.
5. **A CTA promises today's stock.** The anchor "מה יש היום" (line 236) promises a daily-availability view the site doesn't have. Use "מה יש בקופסה" (the section's own H2) and link it to `/products` once that page is live.

**Outline (production):**
```
H1  [האופה - בוטיק לחם · נתיבות, שדרות וקריית גת] הטעם שתמיד כיף לחזור אליו
  H2  מה יש בקופסה
    H3  פרנה ומיני פרנה · H3 חלות · H3 לחמים ולחמניות · H3 מאפים חלביים · H3 מאפים פרווה · H3 סופגניות
  H2  מזמינים בטלפון
  H2  מאפייה אחת בנתיבות, שלושה סניפים ובית ייצור   (only after the story is approved)
  H2  מהפיד
  H2  הלחם שלנו, גם על המדף בסופר            (only after the /business wording is approved)
  H2  שלושה סניפים
    H3  סניף נתיבות · H3 סניף שדרות · H3 סניף קריית גת
```

### 5.2 Branches hub `/branches`
```
H1  סניפי האופה - בוטיק לחם
    p (answer block, §10.2)
  H2  סניף נתיבות      address · phone 08-9752093 · Google Maps · Waze · "לעמוד הסניף"
  H2  סניף שדרות       address · Google Maps · Waze · @haofe_sderot · (phone after owner confirms)
  H2  סניף קריית גת    address · Google Maps · Waze · @haofe_kiryatgat · (phone after owner picks)
  H2  שאלות נפוצות     (only questions whose answers are confirmed, §10.3)
```
Each card gets `id="netivot"`, `id="sderot"` or `id="kiryat-gat"` (the fragment targets in §2).

### 5.3 Branch page, e.g. `/branches/netivot`
```
H1  האופה - בוטיק לחם · סניף נתיבות
    p (answer block, 40–60 words, §10.2)
  H2  כתובת והגעה          שדרות ירושלים 136, נתיבות · Google Maps (place_id link, §6 T11) · Waze
  H2  טלפון                08-9752093 · קו ההזמנות 1700-55-22-55
  H2  שעות פתיחה           MISSING → until confirmed: "לשעות פתיחה התקשרו לסניף"
  H2  מה אופים כאן         product groups (owner confirms the range per branch)
  H2  כשרות                only from the certificate the owner provides; otherwise the section is not rendered
  H2  שאלות נפוצות         §10.3
  H2  סניפים נוספים        links to Sderot and Kiryat Gat with descriptive anchors
```
**Per-branch differences:**
- **Sderot:** add `H2 קפה במרפסת`. Sources: the owner's Google description ("לשתות קפה במרפסת היפה שלנו", "wifi חינם") and post DetORsxtzJW.
- **Kiryat Gat:** add `H2 לשבת אצלנו` (seating, coffee, pastries, cakes, sandwiches; post DeJXIltIyeh). Optionally add "נפתח באוגוסט 2022" (FB post 2022-08-22). "בניין תיקשוב, ליד הארנונה" appears only in the 2022 post; use it only after the owner confirms.

### 5.4 Other pages
- **`/products`:**
  ```
  H1 מה יש בקופסה: לחמים, חלות ומאפים
    H2 לחמים ולחמניות
    H2 חלות ומוצרי שישי
    H2 פרנה
    H2 מאפים חלביים
    H2 מאפים פרווה
    H2 מוצרים יבשים
    H2 בעונה: סופגניות
    H2 איפה קונים → /branches
  ```
  Item names come from the app catalogue. The חלבי/פרווה split follows the app's own labels. Don't imply that every item is sold in every branch.
- ~~`/order`~~: cancelled (24.10.2026). There is no order page; ordering is by phone only, on the home page's receipt.
- **`/business`:** `H1 הלחם של האופה, גם על המדף בסופר` · `H2 בית הייצור` · `H2 יצירת קשר לעסקים`. The business contact is MISSING. Don't publish the page without it. Name no supermarket chains.
- **`/about`:** `H1 הסיפור שלנו` · `H2 מאפייה בנתיבות` · `H2 שדרות` · `H2 קריית גת` · `H2 בית הייצור`. The text is the Walla 2021 draft from b.html line 323 and needs the owner's approval.
- **`/accessibility`, `/privacy`:** one H1 each, with plain H2 sections.

---

## 6. Technical SEO checklist for the build

| # | Item | Exact change | Verify |
|---|---|---|---|
| T1 | **Ship content as HTML** | b.html puts the whole site in `<template id="proto">` (line 179), and shell.js line 285 clones it into the page. Crawlers that don't run JS see no content. AI crawlers such as GPTBot, ClaudeBot and PerplexityBot generally read the raw HTML without running JavaScript. Production pages must be server-rendered or static HTML; motion JS only enhances. | `curl -s https://haofe.example/branches/netivot \| grep -c "שדרות ירושלים 136"` ≥ 1 |
| T2 | **No online-order state** (changed 24.10.2026) | The owner removed the ordering app from the site. b.html's order module is now the phone receipt "מזמינים בטלפון" with 1700-55-22-55, and the `.when-soon`/`.when-live` pairs and `data-live-href` are gone. Keep a guard: the app's domain must not appear anywhere in the build (the skeleton test does this check). | a grep for the app's domain over `dist/` returns nothing |
| T3 | **Head tags per page** | Title, description, canonical, OG and Twitter come from `head-meta.json`. Keep `<html lang="he" dir="rtl">`. The prototype's `<title>האופה · כיוון ב׳ השקית</title>` and its missing description and canonical are presentation-page artefacts. | View source on each page |
| T4 | **One canonical host** | 301 these to the canonical: http→https, www↔apex, trailing slash→none, uppercase→lowercase. Every canonical is self-referencing, and query strings (UTM) are stripped in canonicals. | `curl -sI http://…` shows a 301 to https |
| T5 | **Status codes** | The 404 page returns HTTP 404 with `noindex`. There is no `/order` page or redirect (cancelled 24.10.2026). | `curl -sI` |
| T6 | **Root files** | Serve `/robots.txt`, `/sitemap.xml` and `/llms.txt` from this folder at the canonical host's root. Generate the sitemap from the same page list the router uses. Staging hosts get `Disallow: /` and a password. | Fetch each URL |
| T7 | **JSON-LD** | Server-render `jsonld.json → pages[path].jsonld` in each page. Validate it in the Rich Results Test: expect Organization and Local business items with 0 errors. "Site name" won't show there, which is normal. Also run https://validator.schema.org/. | Both tools, then Search Console URL Inspection |
| T8 | **No placeholder text in production** | Remove every `.tbd` span ("לאישור", "איזה מספר להציג?", "טיוטה…"). Fields that are not confirmed are not rendered at all, rather than hidden with CSS. | `grep -r 'class="tbd"' dist/` returns nothing |
| T9 | **Fonts** | b.html line 10 also loads Heebo and IBM Plex Mono for the presentation chrome. Production loads only Secular One, Rubik and Playpen Sans Hebrew. For LCP and image weight, follow `/home/user/edon-studio/clients/haofe/audit/perf/report.md` and `recommended-markup.html`. | PageSpeed Insights |
| T10 | **Headings** | Make the §5 fixes (H1 kicker, one order state, spaces in product headings, "סניף …" headings). | One H1 per page |
| T11 | **Exact map links** | Replace the `maps/search/?api=1&query=<text>` links (b.html lines 378, 388, 399, 415) with links pinned to each listing's place_id: Netivot `https://www.google.com/maps/search/?api=1&query=%D7%94%D7%90%D7%95%D7%A4%D7%94&query_place_id=ChIJsxSE1GR-AhURpDsRtfFQr6M`, Sderot `…&query_place_id=ChIJoV70uNuBAhUR1_njhNiUCJM`, Kiryat Gat `…&query_place_id=ChIJZ-DXvpGRAhURNMucdk6u5T0` (place_ids from `research:directories`). A text query can land on the wrong pin: Google has an unidentified "האופה, קרית גת" pin, and the closed Beit Shemesh listing. | Each link opens the right listing |
| T12 | **Mobile bar** | `.bar` "ניווט" (b.html line 415) goes to Netivot only. Point it to `/branches`. | Tap test |
| T13 | **Footer NAP** | The footer lists each branch as plain text in one fixed format: "סניף נתיבות · שדרות ירושלים 136, נתיבות · 08-9752093". Phones appear only once confirmed. Use the same string as the branch page and the Google listing. | Text matches §9 canonical record |
| T14 | **Concepts and staging stay out of search** | If `concepts/` (including the research page `index.html`, which holds internal notes and unverified data) is hosted anywhere public, add `<meta name="robots" content="noindex">` and a password. | `site:` check |
| T15 | ~~**The ordering app's search settings**~~ | **Cancelled (24.10.2026):** the ordering app is not part of the site. Its own search and compliance settings are the owner's business, outside the site's scope. | — |
| T16 | **Measurement without cookies** | Verify a Search Console domain property, import it into Bing Webmaster Tools, and submit the sitemap in both. Add GA4 only after the consent decision in the architecture draft. | Both consoles show the sitemap as read |
| T17 | **Accessibility and privacy pages** | These pages are a legal requirement (`research:ordering-law` §7, reg. 35ה, unless exempt) and are indexable. | Linked from every footer |

---

## 7. Internal links

| From | To (anchor text) |
|---|---|
| Header, all pages | logo → `/` · "מה יש בקופסה" → `/products` (until live: `/#boxes`) · "סניפים" → `/branches` · "לעסקים" → `/business` (when live) |
| Footer, all pages | "סניף נתיבות" → `/branches/netivot` · "סניף שדרות" → `/branches/sderot` or `/branches#sderot` · "סניף קריית גת" → `/branches/kiryat-gat` or `/branches#kiryat-gat` · "כל הסניפים" → `/branches` · הצהרת נגישות · מדיניות פרטיות · Instagram, TikTok (external) |
| `/` | hero "בחרו סניף" → `/branches` · "מה יש בקופסה" → `/products` · each branch card → its page ("לעמוד הסניף בנתיבות") · order receipt "לסניפים" → the branch section on the same page |
| `/branches` | each card → its page · breadcrumb → `/` |
| Branch page | breadcrumb `דף הבית › סניפים › סניף נתיבות` · "סניפים נוספים": "סניף האופה בשדרות", "סניף האופה בקריית גת" · "מה אופים כאן" → `/products` |
| `/products` | "איפה קונים" → `/branches` · per group: no per-branch claims |
| `/about` | the city names in the story → the three branch pages · "בית הייצור" → `/business` |
| 404 | `/` and `/branches` |

**Link rules:**
- **No orphan pages.** Links are generated from the branch data file, so a page that is not live is never linked.
- **Descriptive anchors.** Never "לפרטים" or "כאן".
- **External links:** Instagram and TikTok open in a new tab with `rel="noopener"`. No `nofollow` on own accounts.

---

## 8. Local SEO: the three Google Business Profiles

**How the profiles relate.** There are three real, staffed storefronts, each with its own Google listing (`verify:branches`). The production house is not a customer location: it has no public phone or hours, and its only source is a 2023 Badatz page. So it gets no profile unless the owner confirms it serves business customers at that address during set hours. The Beit Shemesh listing (cid 1648196331524428837) is correctly marked "סגור לצמיתות". Leave it closed: don't delete it, and don't reopen it.

### 8.1 Actions, in order

| # | Action | Who | Detail |
|---|---|---|---|
| L1 | **Put all three in one account** | Owner | In Business Profile Manager (business.google.com), check that Netivot and Sderot appear as verified under the owner's Google account. Sderot has an owner-written description, so someone manages it; that is an inference. For Netivot, ownership is unknown. Put all three in one business group and add a second manager, so access isn't tied to one person. |
| L2 | **Claim Kiryat Gat** | Owner | The listing shows "תביעת בעלות על עסק זה" and "הוספת אתר", so it looks unclaimed (`research:kiryat-gat`, inference). Steps below. |
| L3 | **One name** | Owner | Set all three to exactly **האופה - בוטיק לחם**: no quote marks, no city, no keywords. Today they read `"האופה" - בוטיק לחם` (Netivot), `״האופה״ -בוטיק לחם` (Sderot) and `האופה בוטיק לחם` (Kiryat Gat). The proposed name matches the Instagram, TikTok and Facebook names. Google's rules say the name must match the real-world sign, so the owner confirms the storefront signs show it. The city belongs in the address, not the name. |
| L4 | **Categories** | Owner | **Primary:** "מאפייה" (Bakery), which is what all three use today. Keep it. **Additional, only if true:** "בית קפה" for Sderot (owner description: coffee on the balcony) and Kiryat Gat (post: coffee and seating). Add a cake or pastry category only if the owner confirms cakes are sold at that branch (Kiryat Gat's post mentions cakes). Never add wholesale categories to retail profiles. |
| L5 | **Website link** | Owner | Each profile links to its own branch page with UTM tags; the canonical tag strips them. `https://haofe.example/branches/netivot?utm_source=google&utm_medium=organic&utm_campaign=gbp-netivot`. Do the same for `sderot` and `kiryat-gat`. Until those two pages exist, use `https://haofe.example/branches?utm_source=google&utm_medium=organic&utm_campaign=gbp-sderot#sderot` (and the Kiryat Gat equivalent). |
| L6 | **Phones** | Owner | **Netivot:** primary 08-9752093 (verified). **Sderot:** primary 08-6491122, pending owner confirmation. **Kiryat Gat:** today 1-700-552-255; the owner picks one of 08-6669750, 1700-55-22-55 or 054-4306123. **Optional:** add the chain line 1700-55-22-55 as the "additional phone" on all three. Use the same numbers on the site (T13). |
| L7 | **Hours** | Owner | Set regular hours from the owner's own weekly schedule. On the same day, use the same hours on the site (§9.2 shows the conflicts). Saturday means Motzei Shabbat only. Set special hours before each holiday; the owner's ordering system says "לשעות פעילות בחגים יש לפנות לסניף", so holiday hours are a known gap. Don't leave Google's partial hours as they are. |
| L8 | **Description** | Owner | Use the drafts in §8.3: factual, with no links, prices or phone numbers. The Sderot description is already the owner's own; keep it. |
| L9 | **Photos** | Owner | **Real photos only, never AI renders or stock.** Each branch needs at least: the exterior with the sign, in daylight; the entrance (the 2022 opening post places Kiryat Gat in an office building, "בנין תיקשוב"); the counter or display; 5–10 product photos; the seating area (Sderot balcony, Kiryat Gat seating). Add staff only with consent. Logo: `brand/png/haofe-logo-1024.png`. Cover: a real product or storefront photo. Re-use the same real photos on the matching branch page. |
| L10 | **Attributes** | Owner | Set only what the owner confirms. **Sderot:** Wi-Fi and outdoor seating (both in the owner's description). **Kiryat Gat:** dine-in seating; Google already shows wheelchair-accessible parking, so confirm it. **Netivot:** MISSING. |
| L11 | **Opening date** | Owner | Kiryat Gat: August 2022 (Facebook post "קרית גת!! פתחנו!!", 2022-08-22). Netivot and Sderot: MISSING. Walla 2021 gives only approximate years, so don't use them. |
| L12 | **Reviews** | Owner | Use each branch's own review link (from "Ask for reviews" in the profile). Ask in neutral words: "תודה שבחרתם בהאופה. אם תרצו לשתף איך היה, אפשר להשאיר ביקורת כאן: [קישור לסניף]. נשמח לשמוע כל דעה." No incentives, no picking only happy customers, no suggested wording. Reply to each review specifically, about what the reviewer actually wrote, and offer complaints a private contact path. Google review counts seen on zips.co.il (a Google mirror): Netivot 283 (newest 11.11.2025), Sderot 122 (newest shown 21.07.2023), Kiryat Gat 35 (newest 04.07.2025). |
| L13 | **Posts** | Owner | Use profile posts for real updates: the sufganiyot season, already posted on Instagram 11, 18 and 20.10.2026. Google doesn't reward a posting frequency, so post only when there is news. |
| L14 | **Q&A** | — | Google discontinued its Q&A API on 3.11.2025. Answer common questions on the branch pages (§10.3) instead of planning profile Q&A. |
| L15 | ~~**After the app launches**~~ | — | **Cancelled (24.10.2026):** the ordering app is not part of the site, so nothing is added to the profiles for it. |
| L16 | **Other maps** | Owner | **Bing Places:** import from Google after L3–L7 are done. Copilot and ChatGPT search draw on Bing (skill: ai-seo platform reference). **Apple Business Connect:** claim all three for Apple Maps and Siri. **Waze:** check in the app that each branch shows the right name and pin, and report errors through the app. We could not reach Waze (403). |

**Claiming Kiryat Gat (L2), step by step:**
1. Sign in with the same Google account that manages Netivot and Sderot.
2. Open the listing: https://www.google.com/maps?cid=4460162658001013556 ("האופה בוטיק לחם", הרימון 70, קרית גת).
3. Tap "תביעת בעלות על עסק זה" (Own this business?) and then "ניהול עכשיו".
4. Verify with whatever method Google offers: phone or SMS, email, a video, or a postcard.
   - **For a video,** Google typically asks to see three things in one continuous clip: the street and the outside with the name, the inside, and proof you manage the place (for example, opening the register or a staff-only area).
5. If Google shows that someone else already manages the listing, use "בקשת גישה" (request access) and wait for that person's reply. Google gives them a few days. Check first that it isn't a staff member or a former partner.
6. Once verified, do L3–L10 and L5 in one sitting: name, phone, hours, website, categories, description, photos and attributes.

**Possible duplicate pin.** Google Maps also has an unidentified pin "האופה, קרית גת" at 31.5866, 34.7894 with no details (`verify:branches` rejected_claims). After claiming, check whether that pin belongs to the business. If it is a duplicate, request removal with "הצעת עריכה". If it isn't the business, leave it alone.

### 8.2 Field-by-field: current → proposed

| Field | Netivot (cid 11794734948161764260) | Sderot (cid 10594881781052471767) | Kiryat Gat (cid 4460162658001013556) |
|---|---|---|---|
| Ownership | unknown → confirm in L1 | likely managed (owner description) → confirm | appears unclaimed → claim (L2) |
| Name | `"האופה" - בוטיק לחם` → **האופה - בוטיק לחם** | `״האופה״ -בוטיק לחם` → **האופה - בוטיק לחם** | `האופה בוטיק לחם` → **האופה - בוטיק לחם** |
| Address | שדרות ירושלים 136, נתיבות (in "מרכז מסחרי טדי קולק") → keep | יגאל אלון 4, שדרות → keep | הרימון 70, קרית גת → keep. Google spells it "קרית גת"; that is spelling, not a conflict |
| Primary category | מאפייה → keep | מאפייה → keep | מאפייה → keep |
| Phone | +972 8-975-2093 → keep | +972 8-649-1122 → keep once confirmed | +972 1-700-552-255 → owner's pick |
| Website | not shown in research → the branch page URL with UTM | not shown in research → the hub `#sderot`, then its page | none ("הוספת אתר") → the hub `#kiryat-gat`, then its page |
| Hours | partial and conflicting → owner's hours | partial and conflicting → owner's hours | partial and conflicting → owner's hours |
| Description | not seen → §8.3 draft | owner's own → keep | not seen → §8.3 draft |
| Rating seen | 4.7 | 4.4 | 4.6 |

### 8.3 Profile descriptions (Hebrew, factual, under 750 characters)

- **Netivot:**
  > האופה - בוטיק לחם בנתיבות, בשדרות ירושלים 136. אופים כאן לחמים ולחמניות, חלות וצמה ירושלמית, פרנה, ומאפים חלביים ופרווה כמו בורקס גבינה, גביניות ורוגלאך. האופה היא רשת מאפיות ובית ייצור למאפים, עם סניפים גם בשדרות ובקריית גת.

  *Sources: the product catalogue (`data/products.json`, Netivot list), IG bio.*
- **Sderot:** keep the owner's text, which starts "ברוכים הבאים למאפייה הכי יפה בעיר!" and mentions coffee on the balcony and free Wi-Fi. Optionally add one closing line:
  > האופה - בוטיק לחם היא רשת מאפיות עם סניפים גם בנתיבות ובקריית גת.
- **Kiryat Gat:**
  > האופה - בוטיק לחם בקריית גת, ברחוב הרימון 70. מקום לעצור בו באמצע היום: קפה, מאפים, עוגות וכריכים, ויש גם מקום נעים לשבת. האופה היא רשת מאפיות ובית ייצור למאפים, עם סניפים גם בנתיבות ובשדרות.

  *Source: branch post DeJXIltIyeh, 6.10.2026.*

---

## 9. NAP consistency: every source's current values

**What the table records.** All values are as observed on 2026-10-24 by the research agents (`research:social`, `research:directories`, `research:kiryat-gat`, `research:kashrut`, `verify:branches`), unless a source date is given.
- "snippet" means only a search-engine snippet was seen.
- Hours are in §9.2.

### 9.1 Name · address · phone · link

**Netivot**

| Source | Name shown | Address | Phone | Link / website | Data date | Conflict → action |
|---|---|---|---|---|---|---|
| Google Business Profile (cid 11794734948161764260) | "האופה" - בוטיק לחם | שדרות ירושלים 136, נתיבות (in מרכז מסחרי טדי קולק) | +972 8-975-2093 | not recorded | 2026-10-24 | name format → L3; website → L5 |
| The owner's ordering system (branch panel; not part of the site) | האופה · בוטיק לחם נתיבות | שדרות ירושלים 136, נתיבות · איסוף עצמי בלבד | 08-9752093 | links to netivotonline.com/haofe/ as "עמוד הסניף" | 2026-10-24 | none: outside the site's scope (owner decision 24.10.2026) |
| zips.co.il (mirrors Google) | "האופה" - בוטיק לחם | שדרות ירושלים 136, נתיבות | +972 8-975-2093 | — | hours "as of Jan 2026" | follows Google; recheck after L7 |
| bakerias.com (mirrors Facebook page 895926247234370) | האופה - בוטיק לחם | שדרות ירושליים 136 (typo) | +97289752093 | — | posts to 11.12.2025 | fix the address spelling and hours on the Facebook page; the mirror follows |
| netivotonline.com/haofe/ | האופה בוטיק לחם | שד' ירושלים 136, נתיבות | 08-9752093 | Facebook page; email haofebutik@gmail.com | modified 2024-11-05 | ask them to add a link to the site |
| Facebook brand page (/p/האופה-בוטיק-לחם-100063691744585) | האופה - בוטיק לחם | login wall | login wall | login wall | 2026-10-24 | owner: set the website and hours; confirm it is the brand page |
| Walla sponsored article (mumlazim.walla.co.il/item/3476827) | — | שדרות ירושלים 136, נתיבות | 08-9752093 | — | 2021-12-14 | none (old article); the IG bio links here, see below |
| easy.co.il/en/page/26451362 (snippet) | "The Baker" | Sderot Yerushalayim 136 Netivot | 08-9752093 | — | snippet | category "Factories" is wrong → owner asks easy.co.il to fix the category to bakery |
| Moovit (snippet) | האופה - בוטיק לחם | Jerusalem Blvd 136 | — | — | snippet | none |
| Badatz Beit Yosef | no listing for this store (the factory at הסוללים 1 is listed as "האופה בוטיק לחם – נתיבות", category מפעלים) | — | — | — | 2026-10-24 | owner: kashrut certifier for this store is MISSING |
| b144, rest.co.il, d.co.il, Wolt | not listed | — | — | — | 2026-10-24 | optional: add to b144 |

**Sderot**

| Source | Name shown | Address | Phone | Link / website | Data date | Conflict → action |
|---|---|---|---|---|---|---|
| Google Business Profile (cid 10594881781052471767) | ״האופה״ -בוטיק לחם | יגאל אלון 4, שדרות | +972 8-649-1122 | not recorded | 2026-10-24 | name format → L3 |
| Badatz Beit Yosef | האופה בוטיק לחם – שדרות | יגאל אלון 4, שדרות | 08-649-1122 | website = facebook.com/haofesderot | modified 2022-12-11 | owner may ask Badatz to change the website to `/branches/sderot` |
| Instagram @haofe_sderot (post DeghqXvtZje; bio via snippet) | האופה בוטיק לחם שדרות | יגאל אלון 4 שדרות | 08-6491122 (snippet only) | — | 2026-10-15 | owner: add the site link to the bio |
| Instagram @haofe_bakery post DAYEStOClkT | — | **יגאל אלון 6** | — | — | 2024-09-26 | old post; leave it, but never copy the 6 |
| zips.co.il | ״האופה״ -בוטיק לחם | יגאל אלון 4 | +972 8-649-1122 | — | Jan 2026 | follows Google |
| rest.co.il/rest/80331367 | האופה, שדרות | יגאל אלון 4 | 08-6491122 | — | updated 16/12/2025 | OK |
| d.co.il/80331367/22620 (same record) | האופה | יגאל אלון 4, שדרות | 08-6491122 | — | — | its hours look like a default value → owner corrects or removes them (§9.2) |
| easy.co.il/page/10142008 (snippet) | האופה בוטיק לחם | **יגאל אלון 3** | — | — | snippet | duplicate with a wrong number → owner asks easy.co.il to remove it or merge it into page/10085048 |
| easy.co.il/page/10085048 (snippet) | האופה בוטיק לחם | יגאל אלון 4 | — | — | snippet | keep |
| Facebook facebook.com/haofesderot | ״האופה״ בוטיק לחם - שדרות | יגאל אלון 4 (snippet) | +972 8-649-1122 (snippet) | — | 2026-10-24 | owner: set the website and hours |
| Walla 2021 | — | יגאל אלון 4, שדרות | 08-6491122 | — | 2021-12-14 | none |

**Kiryat Gat**

| Source | Name shown | Address | Phone | Link / website | Data date | Conflict → action |
|---|---|---|---|---|---|---|
| Google Business Profile (cid 4460162658001013556) | האופה בוטיק לחם | הרימון 70, קרית גת | +972 1-700-552-255 | none ("הוספת אתר") | 2026-10-24 | claim (L2), name (L3), phone (L6), website (L5) |
| Badatz Beit Yosef | האופה בוטיק לחם – קריית גת | הרימון 70, קריית גת | 1700-552255 | — | modified 2025-04-02 | update if the owner picks a different phone |
| Instagram @haofe_kiryatgat (bio) | האופה קרית גת | רח' הרימון 70 קרית גת | **08-6669750** | — | 2026-10-24 | phone conflict → owner's pick, then the same number everywhere |
| Instagram post DeJXIltIyeh | — | הרימון 70, קריית גת | — | — | 2026-10-06 | OK |
| Facebook opening post (page id 100084744343511) | האופה בוטיק לחם- קרית גת | הרימון 70 בנין תיקשוב (ליד הארנונה…) | — | — | 2022-08-22 | OK |
| zips.co.il | האופה בוטיק לחם | הרימון 70, קרית גת | +972 1-700-552-255 | — | Jan 2026 | follows Google |
| rest.co.il/rest/80387053 and d.co.il/80387053/22620 | האופה, קריית גת | **no street** | **054-4306123** | — | updated 16/12/2025 | owner claims or corrects it: add הרימון 70 and the chosen phone |
| openinghours.co.il (snippet) | — | HaRimon 70 | 1-700-552-255 | — | snippet | follows; recheck |
| easy.co.il/page/27309263 | blocked | — | — | — | — | owner checks |
| Facebook duplicates: facebook.com/h.wph.qryt.gt, facebook.com/people/קרית-גת-מאפייה/61565181882777 (snippets) | האופה קרית גת | — | — | — | snippet | owner: keep one Kiryat Gat page and merge or close the others |
| Instagram @haofekiryatgat | בוטיק האופה קרית גת | — | — | — | removed/inactive | none |

**Chain-level and closed**

| Source | Value | Action |
|---|---|---|
| Instagram @haofe_bakery bio | "רשת מאפיות ובית ייצור למאפים, לחמים ודברי פרימיום · שדרות • קריית גת • נתיבות · להזמנות: 1700-55-22-55". The bio link goes to the 2021 Walla article | **change the bio link to `https://haofe.example/branches`** (or the home page) on launch day |
| TikTok @haofe_bakery1 bio | "רשת מאפיות ובית ייצור למאפים · שדרות • נתיבות • קריית גת · להזמנות: 1700-55-22-55", 21 followers, 18 videos | add the site link if the account type allows it. Note that TikTok @haofe_bakery (no "1") is an empty account not tied to the business |
| Google Business Profile, Beit Shemesh (cid 1648196331524428837) | "סגור לצמיתות", שדרות האמוראים 12, +972 1-700-552-255 | keep closed |
| zips.co.il, Beit Shemesh | still shows hours (Sun–Thu 05:30–22:00, Fri 05:30–17:00) | owner asks zips to mark it closed |

**Canonical record to copy everywhere** (the site, Google, Bing, Apple, Facebook, directories):

| | Name | Address | Phone | Hours | Web |
|---|---|---|---|---|---|
| Netivot | האופה - בוטיק לחם | שדרות ירושלים 136, נתיבות | 08-9752093 | MISSING | https://haofe.example/branches/netivot |
| Sderot | האופה - בוטיק לחם | יגאל אלון 4, שדרות | 08-6491122 (pending owner) | MISSING | https://haofe.example/branches/sderot |
| Kiryat Gat | האופה - בוטיק לחם | הרימון 70, קריית גת | MISSING (owner's pick) | MISSING | https://haofe.example/branches/kiryat-gat |
| Chain | האופה - בוטיק לחם | — | קו הזמנות 1700-55-22-55 | — | https://haofe.example/ |

### 9.2 Opening hours: the conflict to resolve first

| Branch | Source | Sun–Thu | Fri | Motzei Shabbat |
|---|---|---|---|---|
| Netivot | the owner's ordering system (branch panel) | 05:00–22:00 | 05:00–15:00 | 20:00–23:00 |
| Netivot | Google (limited view) | not shown | 05:00–16:00 | 21:00–00:00 |
| Netivot | zips.co.il (as of Jan 2026) | 05:30–22:00 | 05:00–16:00 | 20:00–23:30 |
| Netivot | bakerias (Facebook mirror, undated) | 06:00–22:00 | 06:00–14:00 | 18:30–22:00 |
| Sderot | Google (limited view) | not shown | 05:00–16:00 | 20:00–00:00 |
| Sderot | zips.co.il (as of Jan 2026) | 05:30–22:00 | 05:00–16:00 | 20:00–00:00 |
| Sderot | d.co.il | 07:30–19:30 | 09:00–13:00 | — (default value, rejected in `verify:branches`) |
| Kiryat Gat | Google (limited view) | opens Sun 06:00 | 05:00–14:30 | closed |
| Kiryat Gat | zips.co.il (as of Jan 2026) | 06:00–22:00 | 05:00–17:00 | 20:00–23:00 |

**What the owner sends:** one weekly table per branch, with Friday closing and whether and when the branch opens on Motzei Shabbat.

**Order of updates, same day:**
1. Google Business Profile
2. The site's branch data file
3. Facebook pages
4. d.co.il, rest.co.il and easy.co.il

### 9.3 Citation cleanup, by priority
1. **Google Business Profiles:** L1–L7.
2. **Instagram bio link:** change it from the 2021 Walla article to the site. Also add the site to the TikTok and Facebook pages.
3. **d.co.il/rest.co.il Kiryat Gat record 80387053:** add the street and the right phone.
4. **easy.co.il:** the Sderot duplicate "יגאל אלון 3" and the Netivot "Factories" category.
5. **d.co.il Sderot hours.**
6. **Facebook:** merge the duplicate Kiryat Gat pages.
7. **Badatz:** website link (optional).
8. **zips.co.il:** mark Beit Shemesh closed.
9. **Bing Places and Apple Business Connect:** L16.

**Do this yourselves.** All of these are free edits through each site's own process. A paid listing service is optional, and only worth it if its coverage includes these Israeli directories.

---

## 10. AI search (AEO/GEO)

**Starting point.** Google says AI Overviews and AI Mode need no special files: ordinary SEO and the Business Profiles do the work. ChatGPT search (Bing-based index), Copilot (Bing), Perplexity and Claude (Brave Search) read pages directly, and they cite pages that state facts plainly. For a three-branch bakery, almost every AI question is local and factual: where, when, which phone, is it kosher, can I order ahead. So the work is making those facts consistent and easy to quote.

### 10.1 Entity consistency
- **Same name and line everywhere.** Use the same name, "האופה - בוטיק לחם", and the same one-line description, "רשת מאפיות ובית ייצור למאפים, לחמים ודברי פרימיום". That covers the site, the three Google profiles, Bing, Apple, Instagram, TikTok, Facebook and Badatz.
- **Same branch list everywhere.** Always list the same three branches in the same order. Models look for agreement between sources.
- **Disambiguate by name and cities.** There are at least nine unrelated "האופה" businesses: Kadima @haofe__bakery, "פינת האופה" in Be'er Sheva, "האופה מבגדד", "האופה בית שמש" at מורדי הגטאות 6, and others (`verify:branches`). The full name plus the three cities in every title and profile is what tells them apart. Don't name competitors on the site.

### 10.2 Answer blocks (first paragraph of each page, 40–60 words, verified facts only)
- **`/branches`:**
  > להאופה - בוטיק לחם יש שלושה סניפים פעילים: בשדרות ירושלים 136 בנתיבות, ביגאל אלון 4 בשדרות ובהרימון 70 בקריית גת. קו ההזמנות של הרשת הוא 1700-55-22-55. הפרטים של כל סניף, כמו טלפון ושעות, מופיעים בעמוד שלו.
- **`/branches/netivot`:**
  > סניף האופה - בוטיק לחם בנתיבות נמצא בשדרות ירושלים 136. הטלפון בסניף הוא 08-9752093, וקו ההזמנות של הרשת הוא 1700-55-22-55. בסניף לחמים ולחמניות, חלות, פרנה ומאפים חלביים ופרווה. לרשת יש עוד שני סניפים: ביגאל אלון 4 בשדרות ובהרימון 70 בקריית גת.
- **`/branches/sderot`:**
  > סניף האופה - בוטיק לחם בשדרות נמצא ברחוב יגאל אלון 4. אפשר לשבת לקפה במרפסת של הסניף, ועדכונים מהסניף מתפרסמים באינסטגרם ‎@haofe_sderot. לרשת יש עוד שני סניפים: בשדרות ירושלים 136 בנתיבות ובהרימון 70 בקריית גת.

  Add "הטלפון בסניף הוא 08-6491122." once the owner confirms it.
- **`/branches/kiryat-gat`:**
  > סניף האופה - בוטיק לחם בקריית גת נמצא ברחוב הרימון 70. זה מקום לעצור בו באמצע היום: יש ישיבה במקום, קפה, מאפים, עוגות וכריכים. הסניף נפתח באוגוסט 2022. לרשת יש עוד שני סניפים: בשדרות ירושלים 136 בנתיבות וביגאל אלון 4 בשדרות.

**Last updated.** Show "עודכן לאחרונה: [date]" under the facts on `/branches` and on each branch page. Update it whenever hours or phones change.

### 10.3 Visible FAQ (per branch; publish a question only when its answer is confirmed)

| Question (as people type it) | Answer source | Status |
|---|---|---|
| מה שעות הפתיחה של האופה ב{עיר}? | owner's weekly hours | MISSING |
| האם האופה ב{עיר} פתוח במוצאי שבת? | owner's weekly hours | MISSING |
| איזו כשרות יש בסניף? | the certificate in the branch. Badatz online: Sderot למהדרין חלבי + פרווה; Kiryat Gat למהדרין פרווה; Netivot store: no record | pending owner (per branch, never chain-wide) |
| אפשר להזמין מראש? | By phone: the ordering line 1700-55-22-55, or the Netivot branch 08-9752093. The site has no online ordering | can publish now |
| יש מקום לשבת? | Sderot: balcony (owner's description). Kiryat Gat: yes (post 6.10.2026). Netivot: MISSING | Sderot and Kiryat Gat can publish now |
| יש חניה? | Kiryat Gat: Google shows wheelchair-accessible parking. Others: MISSING | confirm |
| יש משלוחים? | MISSING | don't answer until the owner decides |

**FAQ markup.** Don't add `FAQPage` markup for Google, which stopped showing FAQ rich results in 2026 (owner's schema skill). The visible Q&A text is what AI engines read.

### 10.4 Machine-readable files and crawler access
- **`/llms.txt`** (in this folder): verified facts only, with the date. Update it on the same day as the site.
  - **When `/products` goes live,** add `- [מה יש בקופסה](https://haofe.example/products): …` under a "מוצרים" heading.
  - **When a branch page goes live,** change its link from `/branches#…` to the page.
  - **Pending lines.** Add hours, the Sderot and Kiryat Gat phones and kashrut only after confirmation.
  - **Later, optional:** `llms-full.txt` (the whole site's text in one file) once the site has more than about six pages.
- **`/robots.txt`** (in this folder) states the AI stance. Search discovery is allowed: OAI-SearchBot, PerplexityBot, Claude-SearchBot. Training bots are allowed by default, but that is the owner's choice and the file says how to opt out.
- **Check the CDN as well.** If the site sits behind Cloudflare, check *Security → Bots / AI Crawl Control*. Cloudflare can block AI crawlers at the edge regardless of robots.txt. Search-discovery bots must not be blocked there.
- **Bing Webmaster Tools.** Import from Search Console, submit the sitemap and turn on IndexNow (Cloudflare offers it through Crawler Hints; many hosts and CMSs have a plugin). This feeds Copilot and ChatGPT search.
- **Brave Search.** Search the brand at search.brave.com after launch. Claude's web search uses Brave's index, so if the site is missing there, Claude can't cite it.

### 10.5 Wrong answers to watch for, and where each is fixed

| Risk | Where it comes from | Fix at the source |
|---|---|---|
| A branch in Beit Shemesh | 2024 post DAYEStOClkT; the closed Google listing; zips still shows hours | the closed listing stays closed; zips marks it closed; the site and llms.txt list "שלושה סניפים בלבד" with a date. Whether to say "בית שמש נסגר" is the owner's call (default: don't mention it) |
| Sderot at יגאל אלון 6 or 3 | 2024 post; easy.co.il duplicate | §9.3 item 4; the site and Google say 4 |
| Wrong hours | four conflicting sources; d.co.il default | §9.2 |
| Kiryat Gat phone 054-4306123 | rest.co.il/d.co.il | §9.3 item 3 |
| "Kosher lemehadrin at all branches" | assumption | kashrut per branch, from certificates only |
| "You can order online on the site" | an ordering app exists outside the site | the site says phone ordering only (1700-55-22-55), in the receipt and in llms.txt. The app itself is the owner's business (T15 cancelled) |
| Victory "בוטיק האופה" bread credited to the chain | similar brand name on Wolt | never name chains; the owner decides whether to clarify on `/business` |
| Confused with another "האופה" | similar names | §10.1 |

### 10.6 Prompts to test monthly
**Method:**
- **Engines:** ChatGPT (with search), Perplexity, Google (AI Overview or AI Mode), Copilot and Claude.
- **Runs:** each prompt 3–5 times per engine. Record the rate, e.g. "cited 3/5", not one run.
- **What to log:** whether the brand was mentioned, which URL was cited, and whether address, phone, hours and the branch list were right.
- **Search volumes are MISSING.** Pull them from Search Console after launch, or from Google Ads Keyword Planner if the owner has an account.

| Intent | Prompt |
|---|---|
| Discovery | מאפייה טובה בנתיבות · מאפייה בשדרות · מאפייה בקריית גת עם מקום לשבת |
| Product | איפה קונים פרנה בנתיבות · חלות לשבת בשדרות · סופגניות בקריית גת |
| Constraint | מאפייה פתוחה במוצאי שבת בנתיבות · מאפייה כשרה למהדרין בשדרות |
| Brand facts | האופה בוטיק לחם שעות פתיחה · האופה בוטיק לחם קו הזמנות · כמה סניפים יש להאופה בוטיק לחם · אפשר להזמין אונליין מהאופה? |
| Business | ספק לחם לסופרמרקטים בדרום |

**Baseline.** Take it before launch, then monthly. When an answer is wrong, fix the page or profile that should state that fact (§10.5). When the brand is absent, the sources the engine cites for that prompt become the outreach list: local news sites, directories and Badatz. Real mentions only; no fake reviews or self-made "best of" lists.

---

## 11. Launch day of the ordering app: cancelled (24.10.2026)

The owner removed the ordering app from the site's scope. There are no SEO switches for it: no `orderApp.status`, no `/order` page or redirect, no OrderAction or hasMenu in the JSON-LD, no llms.txt change, and no order link on the Google profiles (L15 cancelled). The sitemap never lists external URLs.

---

## 12. Owner decisions and missing data

| # | Needed | Blocks |
|---|---|---|
| 1 | Weekly opening hours for each branch, including Friday closing and Motzei Shabbat, plus the holiday policy | hours on the site, schema `openingHoursSpecification`, the Google profiles, FAQ, llms.txt |
| 2 | Sderot phone: confirm 08-6491122 | `/branches/sderot`, schema telephone, the Sderot profile |
| 3 | Kiryat Gat phone: pick one of 08-6669750 / 1700-55-22-55 / 054-4306123 | `/branches/kiryat-gat`, the profile, directories |
| 4 | Whether to show 1700-55-22-55 as the chain ordering line in the header and as an additional phone on all profiles | header CTA, L6 |
| 5 | Kashrut certificate wording per branch. The Netivot store has no Badatz record | kashrut sections, FAQ |
| 6 | The marketing domain and a www-or-apex choice | every URL in these files (`https://haofe.example`) |
| 7 | Who manages the Netivot and Sderot Google profiles; claiming Kiryat Gat | L1, L2 |
| 8 | Storefront signage, which must say "האופה - בוטיק לחם" for the unified profile name | L3 |
| 9 | Additional categories (בית קפה for Sderot and Kiryat Gat; cakes) and attributes | L4, L10 |
| 10 | Real photos for each branch: exterior, inside, products | profiles, branch pages, og images, schema `image` |
| 11 | Which Facebook pages are official; merging the Kiryat Gat duplicates | schema `sameAs`, §9.3 |
| 12 | Approval of the product list and whether the range differs by branch | `/products`, product claims on branch pages |
| 13 | Approval of the `/about` story (Walla 2021 draft) and the founders' names in markup | `/about`, schema `founder` |
| 14 | `/business` wording ("לסופרמרקטים ברחבי הארץ", no chain names) and a business contact. The same line is in the llms.txt summary; change both together | `/business`, llms.txt |
| 15 | Whether the site mentions the closed Beit Shemesh branch (default: no) | §10.5 |
| 16 | AI training crawlers: allow (default in robots.txt) or block | robots.txt group 3 |
| 17 | ~~Ask the app developer for `noindex` and http→https~~ Cancelled (24.10.2026): the ordering app is not part of the site | — |
| 18 | Whether the Netivot address line may say "במרכז המסחרי טדי קולק" (Google only), and Kiryat Gat "בניין תיקשוב" (2022 post only) | branch page directions |

---

## 13. Files in this folder

| File | What it is |
|---|---|
| `plan.md` | this plan |
| `head-meta.json` | per-page title, description, canonical, robots, OG and Twitter values, with lengths |
| `jsonld.json` | JSON-LD per page (Organization, WebSite, one Bakery per branch, BreadcrumbList) and the pending fields. Validated: every `@id` reference resolves. The after-launch block (OrderAction, hasMenu) was removed on 24.10.2026, and no ordering-app URL is left in the file |
| `llms.txt` | draft for `/llms.txt` |
| `robots.txt` | draft for `/robots.txt`, tested with Python's robotparser (24.10.2026): Googlebot may fetch every page; Googlebot-Image is blocked from `/assets/ai/` |
| `sitemap.xml` | draft for `/sitemap.xml`, launch-day URLs, with later pages commented out alongside their condition |
| `alt-text.md` | alt-text review of every image in `concepts/b.html` |

Scratch work (scripts, Playwright inventory, image contact sheet) is in `/tmp/claude-0/-home-user-edon-studio/39250604-ba72-5066-b62c-771f07ec61a3/scratchpad/agents4/seo/`.
