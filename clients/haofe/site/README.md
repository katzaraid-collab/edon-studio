# האתר של האופה

אתר סטטי: ארבעה דפים (ראשי, הצהרת נגישות, מדיניות פרטיות, 404), בלי שרת, בלי מסד נתונים ובלי עוגיות. העיצוב והקוד נבנים מאב־הטיפוס של כיוון ב׳ ״השקית״ (`../concepts/b.html` וקובצי התנועה).

## בנייה

```
node clients/haofe/site/build.mjs            # האתר, לתיקייה dist/
node clients/haofe/site/build.mjs --preview  # אותו אתר עם קישורים לקבצים, לתצוגה מקדימה
node clients/haofe/site/build.mjs --launch   # נכשל אם נשאר פרט שממתין לאישור, או אם אין דומיין
```

צריך רק Node 22. אין חבילות להתקין. התיקייה `dist/` נשמרת בגיט, כך שהאירוח לא צריך להריץ בנייה.

## מה משנים ואיפה

| מה | איפה |
|---|---|
| טקסטים, מוצרים, סניפים, עיצוב | `../concepts/b.html` (התבנית), `../concepts/b.css`. אחר כך מריצים את הבנייה. |
| כתובת האתר, פרטי העסק ל־Google (JSON-LD), כותרות הדפים | `site.json` |
| הצהרת הנגישות, מדיניות הפרטיות, דף 404 | `src/pages/*.html` |
| התנהגות (תפריט, סרט נע), תצוגה בהירה/כהה, הפעלת התנועה | `src/site.js`, `src/theme.js`, `src/runtime.js` |

פרט שממתין לאישור מסומן בקוד ב־`class="tbd"` (קו מקווקו באתר). לפני העלייה לאוויר מחליפים כל אחד מהם בפרט המאושר, או מוחקים אותו, ומריצים `--launch`.

## העלאה לאוויר

### אפשרות 1 (מומלצת): Cloudflare Pages, חינם, מותר לשימוש מסחרי
1. נרשמים ב־https://dash.cloudflare.com (חינם).
2. Workers & Pages ← Create ← Pages ← Connect to Git, ומחברים את חשבון GitHub.
3. בוחרים את המאגר `katzaraid-collab/edon-studio` ואת הענף שעליו האתר.
4. Build command: משאירים ריק. Build output directory: `clients/haofe/site/dist`.
5. Save and Deploy. אחרי דקה יש כתובת זמנית `*.pages.dev`.
6. Custom domains ← מוסיפים את הדומיין של העסק.

כותרות האבטחה נמצאות ב־`dist/_headers`, ו־Cloudflare קורא אותן לבד.

### אפשרות 2: Vercel
החבילה החינמית של Vercel (Hobby) מיועדת לשימוש לא מסחרי. לאתר של עסק צריך חבילת Pro בתשלום.
1. ב־https://vercel.com: Add New ← Project ← בוחרים את המאגר.
2. Root Directory: `clients/haofe/site`. Framework: Other. Build command: ריק. הגדרות הכותרות נמצאות ב־`vercel.json`.

### ביום העלייה
1. ב־`site.json` כותבים את הכתובת ב־`origin`, למשל `"https://www.example.co.il"`. כך נוספים canonical ו־sitemap, ומנועי החיפוש מורשים לסרוק.
2. מריצים `node clients/haofe/site/build.mjs --launch`, שומרים בגיט ודוחפים.
3. בודקים שהכתובת עובדת ב־https, ומגישים את `sitemap.xml` ב־Google Search Console.

כל עוד `origin` ריק, האתר מסומן noindex ו־robots.txt חוסם סורקים, כדי שגרסה שעוד לא אושרה לא תופיע בגוגל.
