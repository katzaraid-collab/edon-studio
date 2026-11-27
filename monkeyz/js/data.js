/* Monkeyz Boutique, Amsterdam: everything the menu shows comes from this file.
   Prices are in euros (what the till charges); the site shows shekels next to them using ilsPerEur.
   Photos live in /monkeyz/img/menu/<id>-sm.webp (card) and <id>-1.webp, <id>-2.webp (detail view). */
window.MZ_DATA = {
  // true shows the "preview: sample prices" ribbon. Set to false once prices and details are real.
  demo: true,

  // date the menu was last checked, shown under the menu (YYYY-MM-DD)
  updated: '2026-11-27',

  // shekels per euro, used only for the shekel estimate. Update when the rate moves.
  ilsPerEur: 3.80,

  shop: {
    name: 'Monkeyz Boutique',
    legalName: '[Registered company name]',
    kvk: '[KvK no.]',
    address: { he: '[רחוב ומספר], אמסטרדם', en: '[Street and number], Amsterdam' },
    // text searched in Google Maps for the directions button; leave empty to hide the button
    mapsQuery: '',
    payment: { he: 'מזומן או כרטיס, באירו בלבד', en: 'cash or card, euros only' },
    // Sunday first. [open, close] in Amsterdam time; a close earlier than open means after midnight. null = closed.
    hours: [
      ['09:00', '01:00'], // Sunday
      ['09:00', '01:00'], // Monday
      ['09:00', '01:00'], // Tuesday
      ['09:00', '01:00'], // Wednesday
      ['09:00', '01:00'], // Thursday
      ['09:00', '01:00'], // Friday
      ['09:00', '01:00']  // Saturday
    ]
  },

  cats: [
    { id: 'flower', he: 'פרחים', en: 'Flower' },
    { id: 'smalls', he: 'סמולס', en: 'Smalls', note: { he: 'תפרחות קטנות (פופקורן) מאותם זנים, במחיר נמוך יותר.', en: 'Small "popcorn" buds of the same strains, for less.' } },
    { id: 'hash', he: 'חשיש', en: 'Hash' },
    { id: 'edible', he: 'מאפים', en: 'Edibles' }
  ],

  // type: sativa | indica | hybrid (flower only). unit: g (per gram) | pc (per piece). photos: how many large photos exist.
  // soldOut: true keeps the item on the menu, greyed out.
  items: [
    {
      id: 'fullmoon-purp', cat: 'flower', name: 'FullMoon Purp', type: 'sativa',
      thc: '27–29%', lineage: 'Purple Haze × Lemon Tree', eur: 16, unit: 'g', photos: 2,
      aroma: { he: 'לבנדר, דבש, לימון', en: 'Lavender, honey, lemon' },
      desc: {
        he: 'סאטיבה דומיננטית מבית Haze. ריח פרחוני של לבנדר ודבש עם סיומת לימונית. בדרך כלל מתוארת כמרוממת וצלולה. היא חזקה, אז מתחילים לאט.',
        en: 'A sativa-dominant strain from the Haze family. Floral lavender and honey with a lemon finish. Usually described as uplifting and clear-headed. It is strong, so start slow.'
      }
    },
    {
      id: 'gelato', cat: 'flower', name: 'Gelato', type: 'hybrid',
      thc: '25–27%', lineage: 'Sunset Sherbet × Thin Mint GSC', eur: 15, unit: 'g', photos: 2,
      aroma: { he: 'פירות יער, וניל, שמנת', en: 'Berries, vanilla, cream' },
      desc: {
        he: 'קלאסיקה ממשפחת ה-Cookies. מתוקה ושמנתית, פירות יער ווניל עם נגיעה פלפלית. מאוזנת: מתחילה בראש ונרגעת אל הגוף.',
        en: 'A classic from the Cookies family. Sweet and creamy, berries and vanilla with a peppery edge. Balanced: it starts in the head and settles into the body.'
      }
    },
    {
      id: 'narnia', cat: 'flower', name: 'Narnia', type: 'sativa',
      thc: '26–28%', lineage: 'Jack Herer × Trainwreck', eur: 16, unit: 'g', photos: 2,
      aroma: { he: 'הדרים, אורן, תבלינים', en: 'Citrus, pine, spice' },
      desc: {
        he: 'מפגש של Jack Herer ו-Trainwreck. הדרים חדים ואורן עם קצת תבלין. אנרגטית ומהירה, ולקוחות מספרים שהיא מרגישה חזקה יותר ממה שהמספרים אומרים.',
        en: 'Jack Herer meets Trainwreck. Sharp citrus and pine with a little spice. Energetic and quick, and people often say it feels stronger than the numbers suggest.'
      }
    },
    {
      id: 'guard-dawg', cat: 'flower', name: 'Guard Dawg', type: 'indica',
      thc: '25–27%', lineage: 'Abusive OG × TreStardawg', eur: 15, unit: 'g', photos: 2,
      aroma: { he: 'דיזל, אדמה, קפה', en: 'Diesel, earth, coffee' },
      desc: {
        he: 'אינדיקה בסגנון של פעם: דיזל, אדמה לחה, פולי קפה ותבלין של קוש. כבדה וארוכה, זן של ערב.',
        en: 'Old-school indica: diesel, damp earth, coffee beans and kush spice. Heavy and long-lasting, an evening strain.'
      }
    },
    {
      id: 'mango-tango', cat: 'flower', name: 'Mango Tango', type: 'hybrid',
      thc: '25–28%', lineage: 'Tangie × Peaches × True OG', eur: 16, unit: 'g', photos: 2,
      aroma: { he: 'מנגו, אפרסק, מנדרינה', en: 'Mango, peach, tangerine' },
      desc: {
        he: 'טרופית: מנגו בשל, אפרסק ומנדרינה על בסיס של אורן. מתחילה במצב רוח טוב ומרפה את הגוף בהדרגה.',
        en: 'Tropical: ripe mango, peach and tangerine over a piney base. It starts upbeat and relaxes the body gradually.'
      }
    },

    {
      id: 'vanilla-lime-smalls', cat: 'smalls', name: 'Vanilla Lime', type: 'sativa',
      thc: '26–28%', lineage: 'XJ-13 × Jack Herer', eur: 10, unit: 'g', photos: 2,
      aroma: { he: 'ליים, וניל, אורן', en: 'Lime, vanilla, pine' },
      desc: {
        he: 'קליפת ליים ווניל רך עם שכבה של אורן ותבלין. אנרגטית, זן של יום.',
        en: 'Lime zest and soft vanilla with a layer of pine and spice. Energetic, a daytime strain.'
      }
    },
    {
      id: 'gelato-smalls', cat: 'smalls', name: 'Gelato', type: 'hybrid',
      thc: '25–27%', lineage: 'Sunset Sherbet × Thin Mint GSC', eur: 11, unit: 'g', photos: 2,
      aroma: { he: 'פירות יער, וניל, שמנת', en: 'Berries, vanilla, cream' },
      desc: {
        he: 'התפרחות הקטנות של ה-Gelato: אותו פרופיל מתוק של פירות יער ושמנת, במחיר נמוך יותר.',
        en: 'The small buds of our Gelato: the same sweet berries-and-cream profile for less.'
      }
    },
    {
      id: 'wappa-smalls', cat: 'smalls', name: 'Wappa', type: 'indica',
      thc: '25–26%', lineage: 'Paradise Seeds', eur: 11, unit: 'g', photos: 2,
      aroma: { he: 'פירות, תה ירוק, דבש', en: 'Fruit, green tea, honey' },
      desc: {
        he: 'פירותית, עם תה ירוק ודבש. קלילה בראש בהתחלה, ואחר כך הרפיה חמה בגוף.',
        en: 'Fruity, with green tea and honey. Light in the head at first, then a warm body relaxation.'
      }
    },
    {
      id: 'layer-cake-smalls', cat: 'smalls', name: 'Layer Cake', type: 'hybrid',
      thc: '24–28%', lineage: 'Wedding Cake × GMO', eur: 10, unit: 'g', photos: 2,
      aroma: { he: 'סקאנק, וניל, בצק עוגה', en: 'Skunk, vanilla, cake batter' },
      desc: {
        he: 'Wedding Cake ו-GMO: סקאנק חריף באף ועוגת חמאה בטעם. מרגיעה וחזקה מהממוצע.',
        en: 'Wedding Cake crossed with GMO: pungent skunk on the nose, buttery cake on the palate. Relaxing and stronger than average.'
      }
    },

    {
      id: 'royal-gorilla-hash', cat: 'hash', name: 'Royal Gorilla Hash',
      thc: '~38%', cbd: '~5%', lineage: 'Royal Gorilla', eur: 14, unit: 'g', photos: 2,
      aroma: { he: 'אדמה, אורן, שוקולד מריר', en: 'Earth, pine, dark chocolate' },
      desc: {
        he: 'חשיש כהה ורך מגנטיקת Royal Gorilla. אדמה, אורן ודיזל עם קפה ושוקולד מריר. השפעה כבדה בגוף.',
        en: 'Soft, dark hash from Royal Gorilla genetics. Earth, pine and diesel with coffee and dark chocolate. A heavy body effect.'
      }
    },
    {
      id: 'icc-bubble-hash', cat: 'hash', name: 'Ice Cream Cake Bubble Hash',
      thc: '~63%', cbd: '~10%', lineage: 'Wedding Cake × Gelato', eur: 28, unit: 'g', photos: 1,
      aroma: { he: 'שמנת מתוקה, וניל, עוגיות', en: 'Sweet cream, vanilla, cookies' },
      desc: {
        he: 'באבל האש של Ice Cream Cake, מופק במים וקרח בלבד, בלי ממיסים. שמנת מתוקה ווניל. חזק מאוד: כמות קטנה מספיקה.',
        en: 'Ice Cream Cake bubble hash, made with ice and water only, no solvents. Sweet cream and vanilla. Very strong: a little goes a long way.'
      }
    },
    {
      id: 'gs-bubble-hash', cat: 'hash', name: 'Galactic Sherbet Bubble Hash',
      thc: '~65%', cbd: '~12%', lineage: 'Sunset Sherbet × Wedding Cake', eur: 28, unit: 'g', photos: 2,
      aroma: { he: 'פירות, שמנת, רעננות', en: 'Fruit, cream, fresh' },
      desc: {
        he: 'באבל האש של Galactic Sherbet, במים וקרח בלבד. פירותי ושמנתי, השפעה רגועה בלי כבדות. חזק מאוד, משתמשים במשורה.',
        en: 'Galactic Sherbet bubble hash, ice and water only. Fruity and creamy, a calm effect without the heaviness. Very strong, use sparingly.'
      }
    },

    {
      id: 'space-cookie', cat: 'edible', name: 'Space Cookie',
      eur: 8, unit: 'pc', photos: 2,
      short: { he: 'עוגיית שוקולד צ׳יפס', en: 'Chocolate chip cookie' },
      aroma: { he: 'שוקולד, חמאה', en: 'Chocolate, butter' },
      desc: {
        he: 'עוגיית שוקולד צ׳יפס שנאפתה עם חמאת קנאביס. ההשפעה מתחילה אחרי 30 עד 90 דקות ונמשכת 5 עד 6 שעות. מתחילים מחצי עוגייה ומחכים לפחות שעתיים לפני עוד. מכילה גלוטן, חלב וביצים.',
        en: 'A chocolate chip cookie baked with cannabis butter. It kicks in after 30 to 90 minutes and lasts 5 to 6 hours. Start with half a cookie and wait at least two hours before more. Contains gluten, milk and egg.'
      }
    }
  ]
};
