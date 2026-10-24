> **Note, 24.10.2026:** historical draft, not maintained. On 24.10.2026 the owner removed haofeapp.com from the site's scope, so the /order, order-app and OrderAction parts below (section 3, "Add only after the app launches") are superseded by `seo/plan.md` and `site-plan/plan.md`. The current JSON-LD is `seo/jsonld.json`. Ordering on the site is by phone only (1700-55-22-55).

# HaOfe JSON-LD: brand Organization plus 3 active branches (as of 2026-10-24)

The core graph below contains only verified fields. Netivot, Sderot and Kiryat Gat are the branches marked `ok_to_show_as_active`, and nothing in it points to haofeapp.com. I parsed both files and every `@id` reference resolves.

**Placeholder:** `https://haofe.example` stands in for the marketing site's domain, which I could not find. Replace every occurrence before deploying. `.example` is a reserved name, so a forgotten placeholder will be obvious.

**Where it goes:** on the home page, in `<head>` or at the end of `<body>`. Google's site-names doc (updated 2025-12-10) says WebSite markup must be on the home page. If each branch later gets its own page, move that branch's `Bakery` node to its page, keep the same `@id`, and change its `url`.

## 1. Core markup (use now)

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://haofe.example/#organization",
      "name": "האופה - בוטיק לחם",
      "alternateName": "האופה",
      "url": "https://haofe.example/",
      "logo": "https://haofe.example/brand/haofe-logo-512.png",
      "description": "רשת מאפיות ובית ייצור למאפים",
      "sameAs": [
        "https://www.instagram.com/haofe_bakery/",
        "https://www.tiktok.com/@haofe_bakery1"
      ],
      "contactPoint": {
        "@type": "ContactPoint",
        "telephone": "+972-1-700-55-22-55",
        "contactType": "orders"
      },
      "subOrganization": [
        { "@id": "https://haofe.example/#bakery-netivot" },
        { "@id": "https://haofe.example/#bakery-sderot" },
        { "@id": "https://haofe.example/#bakery-kiryat-gat" }
      ]
    },
    {
      "@type": "WebSite",
      "@id": "https://haofe.example/#website",
      "name": "האופה - בוטיק לחם",
      "alternateName": "האופה",
      "url": "https://haofe.example/",
      "inLanguage": "he",
      "publisher": { "@id": "https://haofe.example/#organization" }
    },
    {
      "@type": "Bakery",
      "@id": "https://haofe.example/#bakery-netivot",
      "name": "האופה - בוטיק לחם נתיבות",
      "url": "https://haofe.example/#netivot",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "שדרות ירושלים 136",
        "addressLocality": "נתיבות",
        "addressCountry": "IL"
      },
      "telephone": "+972-8-975-2093",
      "hasMap": "https://www.google.com/maps?cid=11794734948161764260",
      "parentOrganization": { "@id": "https://haofe.example/#organization" }
    },
    {
      "@type": "Bakery",
      "@id": "https://haofe.example/#bakery-sderot",
      "name": "האופה - בוטיק לחם שדרות",
      "url": "https://haofe.example/#sderot",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "יגאל אלון 4",
        "addressLocality": "שדרות",
        "addressCountry": "IL"
      },
      "hasMap": "https://www.google.com/maps?cid=10594881781052471767",
      "sameAs": ["https://www.instagram.com/haofe_sderot/"],
      "parentOrganization": { "@id": "https://haofe.example/#organization" }
    },
    {
      "@type": "Bakery",
      "@id": "https://haofe.example/#bakery-kiryat-gat",
      "name": "האופה - בוטיק לחם קריית גת",
      "url": "https://haofe.example/#kiryat-gat",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "הרימון 70",
        "addressLocality": "קריית גת",
        "addressCountry": "IL"
      },
      "hasMap": "https://www.google.com/maps?cid=4460162658001013556",
      "sameAs": ["https://www.instagram.com/haofe_kiryatgat/"],
      "parentOrganization": { "@id": "https://haofe.example/#organization" }
    }
  ]
}
</script>
```

If the site is rendered by a JS framework rather than static HTML, escape every `<` in the serialized JSON as `\u003c`, as the skill's Next.js example does. The data contains no `<` today.

### Where each field comes from

| Field | Value | Source (what it says), date |
|---|---|---|
| Org `name` | האופה - בוטיק לחם | TikTok profile `nickname`, fetched 2026-10-24 01:47 UTC (https://www.tiktok.com/@haofe_bakery1). Instagram @haofe_bakery display name, per earlier research 2026-10-24 |
| Org `alternateName` | האופה | haofeapp.com PWA manifest `name: "האופה"` (viewed 2026-10-24) and the logo wordmark |
| Org `description` | רשת מאפיות ובית ייצור למאפים | TikTok bio, word for word, fetched 2026-10-24 01:47 UTC |
| Org `contactPoint` | 1700-55-22-55, orders | TikTok bio "להזמנות: 1700-55-22-55", fetched 2026-10-24. Also on Google Maps and in Badatz (Kiryat Gat entry), 2026-10-24 |
| Org `sameAs` | Instagram, TikTok | Own accounts. Instagram post DegS23RIAJ- (2026-10-15) and the TikTok bio (2026-10-24) |
| Org `logo` | 512×512 PNG | `clients/haofe/brand/png/haofe-logo-512.png`, traced from https://haofeapp.com/brand/icon-512.png. I checked the size today. It must be hosted at that path on the site |
| Netivot address and phone | שדרות ירושלים 136, 08-9752093 | Owner's own page https://haofeapp.com/order (viewed 2026-10-24), Google Maps cid 11794734948161764260 (2026-10-24), https://netivotonline.com/haofe/ (modified 2024-11-05) |
| Sderot address | יגאל אלון 4 | Branch's own post https://www.instagram.com/p/DeghqXvtZje/ (2026-10-15), Google Maps cid 10594881781052471767 (2026-10-24), Badatz search (2026-10-24) |
| Sderot `sameAs` | @haofe_sderot | The account that published DeghqXvtZje (2026-10-15) and DetORsxtzJW (2026-10-20) |
| Kiryat Gat address | הרימון 70 | Branch's own post https://www.instagram.com/p/DeJXIltIyeh/ (2026-10-06), branch Instagram bio (2026-10-24), Google Maps cid 4460162658001013556, Badatz (2026-10-24) |
| Kiryat Gat `sameAs` | @haofe_kiryatgat | Branch profile JSON (2026-10-24) and post DeJXIltIyeh |
| `hasMap` (all 3) | Google cid URLs | Each listing was viewed 2026-10-24 with no closure flag, and its address matches |
| Branch `name` | brand + city | My own construction (inference). It follows the app's "האופה · בוטיק לחם נתיבות" and Badatz's "האופה בוטיק לחם – <עיר>" |

### How the branches are linked (and why not `department`)

The schema skill and its references do not say which property should link branches to a brand. I followed the primary docs instead:

- **Each branch** is its own `Bakery` node. Bakery is a subtype of `FoodEstablishment` and `LocalBusiness`. Google's LocalBusiness doc (updated 2026-09-08) says to "define each local business location as a `LocalBusiness` type".
- **The links:** each Bakery has `parentOrganization` pointing to the brand, and the brand has `subOrganization` listing the branches. schema.org V30.1 defines `parentOrganization` as the inverse of `subOrganization` and says it supersedes the old `branchOf`.
- **Why not `department`:** Google describes it as "a nested item for a single department" inside one store, named "`{store name} {department name}`" (for example "gMart Pharmacy"). That describes a counter inside a shop, not a separate branch.

## 2. Fields left out, and why

| Left out | Why |
|---|---|
| `openingHoursSpecification` (all branches) | Four sources disagree for every branch: the owner's app, Google, zips.co.il and bakerias. The owner has to confirm |
| `telephone` for Sderot | Google Maps and Badatz (page last modified 2022) show 08-6491122, but no 2026 first-party source does. Waiting for the owner |
| `telephone` for Kiryat Gat | Three conflicting numbers: 08-6669750, 1700-55-22-55 and 054-4306123 |
| `geo` | Left out as you instructed. The coordinates are only Google's pins and the owner has not confirmed them |
| `priceRange` | No published prices anywhere. The app shows none |
| `aggregateRating`, `review` | Google (LocalBusiness doc, 2026-09-08) allows these only "for sites that capture reviews about other local businesses". Reviews of your own business don't qualify |
| `servesCuisine`, any kashrut claim | Not verified. Kashrut differs by branch: Sderot is חלבי + פרווה, Kiryat Gat is פרווה only, and the Netivot store has no Badatz record. No schema property is appropriate, so don't encode one |
| `image` | No real branch photos exist. The concept images are labelled AI and temporary, and Google requires images to "represent the marked up content" |
| `postalCode`, `addressRegion` | No source gives them |
| Netivot "מרכז מסחרי טדי קולק" and Kiryat Gat "בנין תיקשוב" | Respectively, only Google Maps says the first, and only a 2022 post says the second |
| Org `address` (factory at הסוללים 1) | Last confirmed on a Badatz page from 2023. It is not a place for customers, and the owner must confirm it |
| `legalName`, `taxID`/`vatID`, `email`, `foundingDate`, `founder` | Not verified, or the text isn't approved on the site yet (the story draft is still pending). Legal name and ח.פ. are also needed for the app's disclosures under section 14ג |
| Facebook in `sameAs` | Login-walled. Only page titles could be read, and it's unclear which page is the brand and which is a branch |
| English name (e.g. "HaOfe") | The business doesn't use it in any source I saw |
| Beit Shemesh (both entries), production plant | One is closed, one is unknown, and the plant is not a retail branch. They are not marked up |
| `hasMenu`, `potentialAction`, any haofeapp.com URL | The app is not launched (section 3). The core file contains 0 occurrences of "haofeapp" |

Values ready to add once the owner confirms them:
- **Sderot:** add `"telephone": "+972-8-649-1122"`.
- **Kiryat Gat:** add `"telephone"` with whichever of the three numbers the owner picks.
- **Hours:** add `openingHoursSpecification` only with the owner's own weekly hours. Saturday entries should cover Motzei Shabbat only.

## 3. Add only after the app launches (Netivot only)

Merge this into the existing Netivot node (same `@id`). Don't add it as a second Bakery.

```json
{
  "@context": "https://schema.org",
  "@type": "Bakery",
  "@id": "https://haofe.example/#bakery-netivot",
  "hasMenu": "https://haofeapp.com/order",
  "potentialAction": {
    "@type": "OrderAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://haofeapp.com/order",
      "inLanguage": "he",
      "actionPlatform": [
        "https://schema.org/DesktopWebPlatform",
        "https://schema.org/MobileWebPlatform"
      ]
    },
    "deliveryMethod": "https://schema.org/OnSitePickup"
  }
}
```

- **Conditions:**
  - The owner confirms the launch and has placed a test order themselves.
  - The site's `orderApp.status` is switched to `'live'`.
  - The URL is exactly `https://haofeapp.com/order`: https, no trailing slash (the slash form returns a 308), and not `www` (it has no DNS record).
- **Netivot only:** the app shows only Netivot, pickup only ("איסוף עצמי בלבד"), hence `OnSitePickup`. Nothing goes on Sderot or Kiryat Gat.
- **`hasMenu`:** the page lists 49 products with no prices. Use it only if the owner is happy for the order page to serve as the menu. schema.org says `hasMenu` supersedes `menu`, but Google's LocalBusiness doc still lists `menu` (URL). Either one validates; use one, not both.
- **What it won't do:** Google does not document `OrderAction`, so this markup won't create an order button in Search. Google's LocalBusiness doc points to the Maps Booking API for orders. In the Rich Results Test, only check that it adds no errors.

## 4. Rich Results Test checklist

- [ ] **Domain swapped:** `https://haofe.example` replaced everywhere with the real canonical https domain.
- [ ] **Logo reachable:** the logo URL returns 200, is a PNG of at least 112×112, isn't blocked by robots.txt, and looks right on white.
- [ ] **Before deploy:** paste the whole `<script>` into the Code tab at https://search.google.com/test/rich-results.
  - Expect an Organization item and 3 Local business items, with 0 errors.
  - No item for WebSite is normal: "Site names aren't supported in the Rich Results Test" (Google site-names doc, 2025-12-10).
- [ ] **Warnings are expected:** missing `openingHoursSpecification`, `geo`, `priceRange`, `image`, and `telephone` on 2 branches are deliberate. Don't fill them with unverified values.
- [ ] **Vocabulary check:** run https://validator.schema.org/ and confirm the `parentOrganization`/`subOrganization` links, `hasMap` and `sameAs` parse with no unknown properties.
- [ ] **Matches the page:** every branch card shows the same name, street and city, and Netivot shows 08-9752093. Nothing is marked up that isn't visible.
- [ ] **After deploy:** re-test by URL in the Rich Results Test, check the rendered HTML includes the script, then use Search Console's URL Inspection to see the detected items.
- [ ] **While the app isn't live:** search the built HTML for `haofeapp` and expect 0 hits.
- [ ] **After launch:** merge the section 3 snippet and re-run both tools. The aim is no new errors, not a new rich result.

**Two problems in the current concept.** The integration notes say the order URL should appear nowhere while the app isn't live, and concept B breaks that in two places:
- **Live order link:** `clients/haofe/concepts/b.html` line 311 already contains `href="https://haofeapp.com/order"` (the `.when-live` button). It is in the HTML even if CSS hides it.
- **Sderot phone:** line 386 shows the Sderot call link `tel:+97286491122`, a number the owner hasn't confirmed.

**Couldn't access:** Facebook pages (login-walled), so they're left out of `sameAs`. I only fetched the TikTok bio myself (2026-10-24 01:47 UTC); the other facts come from the verifier's report of the same day. I did not log in, submit anything, or contact anyone.

Files are in /tmp/claude-0/-home-user-edon-studio/39250604-ba72-5066-b62c-771f07ec61a3/scratchpad/agents/schema:
- haofe-graph.jsonld
- after-launch-netivot.jsonld
- dl/tiktok.html