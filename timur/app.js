/* הרשות לפיקוח על פייסלים — all data stays in this browser (localStorage). */
(function () {
  "use strict";

  var KEY = "timur-faisal-v1";
  var DAY = 864e5;
  var DAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
  var MUNCHIES = [
    { k: "bamba", n: "במבה" },
    { k: "bisli", n: "ביסלי גריל" },
    { k: "shoko", n: "שוקו בשקית" },
    { k: "pizza", n: "משולש פיצה" },
    { k: "ice", n: "גלידה מהקופסה" },
    { k: "burekas", n: "בורקס גבינה" },
    { k: "malawach", n: "מלאווח ב־3 לילה" },
    { k: "cereal", n: "קורנפלקס יבש" }
  ];
  var QUIPS = [
    "<b>נרשם.</b> משרד הבריאות מודה לך על שיתוף הפעולה.",
    "<b>בוצע.</b> הספה קיבלה הודעה ומתכוננת.",
    "<b>אושר.</b> זה טיפול רפואי. ככה תגיד לאמא.",
    "<b>נקלט במערכת.</b> הפקיד שאחראי עליך יצא להפסקת במבה.",
    "<b>מצוין.</b> הרופא אמר פעמיים ביום. הוא לא אמר כמה ימים יש ביום.",
    "<b>נרשם.</b> שים מוזיקה טובה, זה חלק מהפרוטוקול.",
    "<b>תיעוד הושלם.</b> המקרר כבר יודע מה הולך לקרות.",
    "<b>אחלה.</b> תזכורת: מים זה גם משקה.",
    "<b>נשמר.</b> תעודת הרישיון שלך מחייכת עכשיו.",
    "<b>יאללה.</b> סדרה חדשה בנטפליקס? לא נעים לפספס.",
    "<b>נספר.</b> הפייסל הזה מוקדש לפקיד בקופת חולים.",
    "<b>רשום אצלנו.</b> נא לא להפעיל מכונות כבדות. גם לא את המיקרוגל."
  ];
  var HALF_QUIPS = [
    "<b>חצי נרשם.</b> שם החבר הועבר לרשויות. סתם. אולי.",
    "<b>חצי חצי.</b> שיתוף זה אכפתיות. גם הדיווח עליו.",
    "<b>נרשם חצי.</b> אלעזר לא מלשין, אלעזר רק מתעד. יש הבדל.",
    "<b>חצי עם חבר.</b> החבר לא יודע שהוא בדו״ח. עכשיו הוא יודע.",
    "<b>אושר.</b> חצי מהפייסל, חצי מהאשמה."
  ];
  var LEVELS = [
    { max: 0, t: "פיכח לגמרי. חשוד.", c: "var(--ink-2)" },
    { max: 0.5, t: "במינון. הרופא היה גאה", c: "var(--ok)" },
    { max: 1, t: "רגוע ממלכתי", c: "var(--ok)" },
    { max: 1.5, t: "חרגת מהמרשם. הספה שמחה", c: "var(--warn)" },
    { max: Infinity, t: "רשמית: אתה הספה", c: "var(--hot)" }
  ];

  /* ---------- storage ---------- */
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var s = JSON.parse(raw);
        if (s && Array.isArray(s.j)) {
          if (!Array.isArray(s.h)) s.h = [];
          if (s.cfg && s.cfg.name === "טימור") s.cfg.name = "אלעזר המלשין";
          return s;
        }
      }
    } catch (e) { /* storage blocked: run in memory */ }
    return seed();
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ }
  }
  function blank() {
    return { j: [], m: [], demo: false, cfg: { name: "אלעזר המלשין", grams: 40, gpj: 0.35 }, h: [] };
  }
  function seed() {
    var s = blank();
    s.demo = true;
    var today = startOfDay(Date.now());
    var counts = [3, 2, 4, 5, 3, 2];
    counts.forEach(function (c, i) {
      var day = today - (6 - i) * DAY;
      for (var x = 0; x < c; x++) s.j.push(day + (14 + x * 2.5) * 36e5);
    });
    var now = Date.now();
    var h = new Date(now).getHours();
    if (h >= 11) s.j.push(today + 11 * 36e5);
    if (h >= 16) s.j.push(today + 16 * 36e5);
    s.m.push({ t: today - DAY + 22 * 36e5, k: "bamba" });
    s.m.push({ t: today - DAY + 23 * 36e5, k: "shoko" });
    if (h >= 12) s.m.push({ t: today + 12 * 36e5, k: "bisli" });
    return s;
  }

  /* ---------- helpers ---------- */
  function startOfDay(t) { var d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function sameDay(a, b) { return startOfDay(a) === startOfDay(b); }
  function fmt(n, d) { return Number(n).toLocaleString("he-IL", { maximumFractionDigits: d == null ? 1 : d, minimumFractionDigits: 0 }); }
  function hhmm(t) { return new Date(t).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function daysInMonth(t) { var d = new Date(t); return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); }
  function monthStart(t) { var d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); }
  function countOn(day) {
    var full = S.j.filter(function (t) { return sameDay(t, day); }).length;
    var half = S.h.filter(function (t) { return sameDay(t, day); }).length;
    return full + half / 2;
  }
  function allTimes() { return S.j.concat(S.h); }
  function lastTime() { var a = allTimes(); return a.length ? Math.max.apply(null, a) : null; }
  function allowance() { return S.cfg.grams / daysInMonth(Date.now()) / S.cfg.gpj; }
  function level(ratio, count) {
    if (count === 0) return LEVELS[0];
    for (var i = 1; i < LEVELS.length; i++) if (ratio <= LEVELS[i].max) return LEVELS[i];
    return LEVELS[LEVELS.length - 1];
  }
  function since(t) {
    var m = Math.floor((Date.now() - t) / 6e4);
    if (m < 1) return "ממש עכשיו";
    if (m < 60) return m + " דק׳";
    var h = Math.floor(m / 60);
    if (h < 48) return h + ":" + String(m % 60).padStart(2, "0") + " שע׳";
    return Math.floor(h / 24) + " ימים";
  }

  /* ---------- joint meter (SVG) ---------- */
  function jointSVG(frac) {
    frac = Math.max(0, Math.min(1, frac));
    var x0 = 44, x1 = 304;               // paper from filter edge to tip
    var tip = x1 - frac * (x1 - x0);       // burns from the right tip toward the filter
    var y = function (x) { return 7 + ((x - x0) / (x1 - x0)) * 6; }; // half-height grows toward tip
    var hTip = y(tip);
    var parts = [];
    parts.push('<svg viewBox="0 -34 320 76" role="img" aria-label="פייסל המכסה היומית: נשרפו ' + Math.round(frac * 100) + ' אחוז">');
    // shadow
    parts.push('<ellipse cx="170" cy="36" rx="140" ry="3" fill="var(--line)"/>');
    // filter / crutch
    parts.push('<rect x="10" y="12" width="34" height="16" rx="3" fill="var(--paper-roll)" stroke="var(--ink)" stroke-width="1.5"/>');
    parts.push('<path d="M16 15 v10 M22 15 v10 M28 15 v10 M34 15 v10" stroke="var(--line)" stroke-width="1.5"/>');
    if (frac < 1) {
      // remaining paper (cone)
      parts.push('<path d="M' + x0 + ' ' + (20 - 7) + ' L' + tip + ' ' + (20 - hTip) + ' L' + tip + ' ' + (20 + hTip) + ' L' + x0 + ' ' + (20 + 7) + ' Z" fill="var(--paper-roll)" stroke="var(--ink)" stroke-width="1.5" stroke-linejoin="round"/>');
      // seam
      parts.push('<path d="M' + (x0 + 6) + ' 18 L' + (tip - 4) + ' ' + (20 - hTip * 0.3) + '" stroke="var(--line)" stroke-width="1" fill="none"/>');
      // ash + ember
      parts.push('<rect x="' + (tip - 1) + '" y="' + (20 - hTip) + '" width="8" height="' + hTip * 2 + '" rx="3" fill="var(--ink-2)" opacity=".55"/>');
      parts.push('<rect class="ember-glow" x="' + (tip - 3) + '" y="' + (20 - hTip + 1) + '" width="4" height="' + (hTip * 2 - 2) + '" rx="2" fill="var(--ember)"/>');
      // smoke
      var sx = tip + 4;
      ["s1", "s2", "s3"].forEach(function (c, i) {
        var o = (i - 1) * 7;
        parts.push('<path class="smoke ' + c + '" d="M' + (sx + o) + ' ' + (18 - hTip) + ' c -6 -6 6 -10 0 -16 c -6 -6 4 -8 2 -12"/>');
      });
    } else {
      parts.push('<rect x="40" y="13" width="8" height="14" rx="3" fill="var(--ink-2)" opacity=".55"/>');
      parts.push('<text x="180" y="25" text-anchor="middle" font-family="var(--f-display)" font-size="15" fill="var(--hot)">נגמרה המכסה היומית. המשך על אחריותך</text>');
    }
    parts.push("</svg>");
    return parts.join("");
  }

  /* ---------- render ---------- */
  var S = load();
  var app = document.getElementById("app");
  var lastQuip = "";
  var resetArmed = false;

  function render() {
    var now = Date.now();
    var today = startOfDay(now);
    var todayCount = countOn(now);
    var allow = allowance();
    var ratio = allow > 0 ? todayCount / allow : 0;
    var lv = level(ratio, todayCount);
    var last = lastTime();

    // month
    var mStart = monthStart(now);
    var monthJ = S.j.filter(function (t) { return t >= mStart; }).length + S.h.filter(function (t) { return t >= mStart; }).length / 2;
    var usedG = monthJ * S.cfg.gpj;
    var leftG = Math.max(0, S.cfg.grams - usedG);
    var dim = daysInMonth(now);
    var daysLeft = dim - new Date(now).getDate() + 1;
    var perDayLeft = leftG / S.cfg.gpj / daysLeft;

    // week
    var week = [];
    for (var i = 6; i >= 0; i--) {
      var d = today - i * DAY;
      week.push({ d: d, c: countOn(d) });
    }
    var weekTotal = week.reduce(function (a, b) { return a + b.c; }, 0);
    var weekMax = Math.max.apply(null, week.map(function (w) { return w.c; }).concat([Math.ceil(allow), 1]));
    var avg = weekTotal / 7;
    var record = Math.max.apply(null, week.map(function (w) { return w.c; }));

    // munchies today
    var munchToday = S.m.filter(function (x) { return sameDay(x.t, now); });
    var munchCount = {};
    munchToday.forEach(function (x) { munchCount[x.k] = (munchCount[x.k] || 0) + 1; });

    // log: today's joints + munchies
    var logItems = S.j.filter(function (t) { return sameDay(t, now); }).map(function (t) { return { t: t, k: "🌿 פייסל" }; })
      .concat(S.h.filter(function (t) { return sameDay(t, now); }).map(function (t) { return { t: t, k: "🤝 חצי עם חבר" }; }))
      .concat(munchToday.map(function (x) {
        var item = MUNCHIES.find(function (m) { return m.k === x.k; });
        return { t: x.t, k: "פינוק: " + (item ? item.n : x.k) };
      }))
      .sort(function (a, b) { return b.t - a.t; });

    var licNo = "THC-" + String(4200 + (S.cfg.name.length * 7) % 100).padStart(4, "0");
    var name = esc(S.cfg.name || "אלעזר המלשין");

    app.innerHTML =
      '<header class="licence">' +
        '<div class="licence-top">' +
          '<div>' +
            '<div class="eyebrow">הרשות לפיקוח על פייסלים · רישיון רפואי</div>' +
            '<h1>הפייסלים של ' + name + '</h1>' +
            '<p class="sub">מעקב יומי, ממלכתי ורגוע. הכל מתועד, אז אין טעם להסתיר.</p>' +
          '</div>' +
          '<div class="stamp" aria-hidden="true">מאושר<small>' + licNo + '</small></div>' +
        '</div>' +
        '<dl>' +
          '<div><dt>מכסה חודשית</dt><dd>' + fmt(S.cfg.grams) + ' גר׳</dd></div>' +
          '<div><dt>גרם לפייסל</dt><dd>' + fmt(S.cfg.gpj, 2) + '</dd></div>' +
          '<div><dt>מכסה יומית</dt><dd>' + fmt(allow) + ' פייסלים</dd></div>' +
        '</dl>' +
      '</header>' +

      (S.demo ? '<div class="demo" role="note"><span>אלה נתוני דוגמה כדי שתראה איך זה נראה.</span><button type="button" data-act="clear-demo">מחק דוגמה והתחל</button></div>' : "") +

      '<section class="today" aria-label="היום">' +
        '<div class="count-row">' +
          '<div>' +
            '<div class="count" id="count">' + fmt(todayCount) + '</div>' +
          '</div>' +
          '<div style="flex:1;min-width:0">' +
            '<p class="count-label">פייסלים היום</p>' +
            '<p class="count-meta">' + (last ? 'מאז האחרון: <span id="since">' + since(last) + '</span>' : "עוד לא הודלק אף אחד") + '</p>' +
            '<p style="margin:8px 0 0"><span class="status" style="--sc:' + lv.c + '"><i></i>' + lv.t + '</span></p>' +
          '</div>' +
        '</div>' +
        '<div class="joint-box">' + jointSVG(allow > 0 ? todayCount / allow : 0) +
          '<div class="joint-legend"><span>מד המכסה היומית</span><span class="mono">' + fmt(todayCount) + ' / ' + fmt(allow) + '</span></div>' +
        '</div>' +
        '<div class="actions">' +
          '<button type="button" class="btn-light" data-act="light">הדלקתי אחד 🔥</button>' +
          '<button type="button" class="btn-half" data-act="half">עישנתי חצי עם חבר 🤝</button>' +
          '<button type="button" class="btn-undo" data-act="undo"' + (todayCount ? "" : " disabled") + '>ביטול</button>' +
        '</div>' +
        '<p class="quip" aria-live="polite">' + lastQuip + '</p>' +
      '</section>' +

      '<section class="card" aria-labelledby="h-week">' +
        '<div class="card-head"><h2 id="h-week">השבוע האחרון</h2><p>הקו המקווקו = המכסה היומית</p></div>' +
        '<div class="week-wrap">' +
          '<div class="week">' + week.map(function (w) {
            var h = Math.max(2, (w.c / weekMax) * 100);
            var cls = "bar" + (w.c > allow ? " over" : "") + (w.d === today ? " is-today" : "");
            return '<div class="' + cls + '"><span class="v">' + fmt(w.c) + '</span><span class="col" style="height:calc((150px - 40px) * ' + (h / 100).toFixed(3) + ')"></span><span class="d">' + DAYS[new Date(w.d).getDay()] + '</span></div>';
          }).join("") + '</div>' +
          '<div class="quota-line" style="bottom:calc(20px + (150px - 40px) * ' + (allow / weekMax).toFixed(3) + ')"><span>' + fmt(allow) + '</span></div>' +
        '</div>' +
        '<div class="stats">' +
          '<div class="stat"><b>' + fmt(avg) + '</b><span>ממוצע ליום</span></div>' +
          '<div class="stat"><b>' + weekTotal + '</b><span>סה״כ בשבוע</span></div>' +
          '<div class="stat"><b>' + fmt(record) + '</b><span>שיא שבועי</span></div>' +
        '</div>' +
      '</section>' +

      '<section class="card" aria-labelledby="h-month">' +
        '<div class="card-head"><h2 id="h-month">המלאי החודשי</h2><p>' + (daysLeft === 1 ? "מחר מתחדש המרשם" : daysLeft + " ימים עד חידוש המרשם") + '</p></div>' +
        '<div class="stats">' +
          '<div class="stat"><b>' + fmt(usedG) + '</b><span>גרם עלו בעשן</span></div>' +
          '<div class="stat"><b>' + fmt(leftG) + '</b><span>גרם נשארו</span></div>' +
          '<div class="stat"><b>' + fmt(perDayLeft) + '</b><span>פייסלים ליום שנשארו</span></div>' +
        '</div>' +
        '<p class="empty">' + (perDayLeft < allow * 0.7
          ? "קצב מסוכן: בסוף החודש תצטרך לגלגל אוויר."
          : "בקצב הזה המלאי מחזיק עד החידוש. כל הכבוד על המשמעת.") + '</p>' +
      '</section>' +

      '<section class="card" aria-labelledby="h-munch">' +
        '<div class="card-head"><h2 id="h-munch">פינוקים (מאנצ׳יז)</h2><p>לחיצה = עוד אחד נכנס</p></div>' +
        '<div class="munch-grid">' + MUNCHIES.map(function (m) {
          var n = munchCount[m.k] || 0;
          return '<button type="button" class="munch" data-act="munch" data-k="' + m.k + '"><span>' + m.n + '</span><span class="n' + (n ? "" : " zero") + '">' + n + '</span></button>';
        }).join("") + '</div>' +
        '<p class="munch-total">' + (munchToday.length
          ? "היום: " + (munchToday.length === 1 ? "פינוק אחד" : munchToday.length + " פינוקים") + ". יחס פינוקים לפייסל: " + (todayCount ? fmt(munchToday.length / todayCount) : "∞")
          : "עוד אין פינוקים היום. המקרר מחכה.") + '</p>' +
      '</section>' +

      '<section class="card" aria-labelledby="h-log">' +
        '<div class="card-head"><h2 id="h-log">יומן היום</h2><p>' + new Date(now).toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" }) + '</p></div>' +
        (logItems.length
          ? '<ul class="log">' + logItems.map(function (it) { return '<li><span class="k">' + it.k + '</span><span class="t">' + hhmm(it.t) + '</span></li>'; }).join("") + '</ul>'
          : '<p class="empty">היומן ריק. יום נקי או שעוד מוקדם.</p>') +
      '</section>' +

      '<section class="card settings" id="settings" hidden aria-labelledby="h-set">' +
        '<h2 id="h-set">הגדרות המרשם</h2>' +
        '<form id="cfg">' +
          '<label class="full">שם בעל הרישיון<input id="f-name" name="name" maxlength="20" value="' + name + '"></label>' +
          '<label>מכסה חודשית (גרם)<input id="f-grams" name="grams" type="number" inputmode="decimal" min="1" max="500" step="1" value="' + S.cfg.grams + '"></label>' +
          '<label>גרם לפייסל<input id="f-gpj" name="gpj" type="number" inputmode="decimal" min="0.05" max="3" step="0.05" value="' + S.cfg.gpj + '"></label>' +
          '<div class="row-btns full"><button class="btn-save" type="submit">שמור</button><button class="btn-danger" type="button" data-act="reset">' + (resetArmed ? "בטוח? לחץ שוב למחיקה" : "מחק את כל הנתונים") + '</button></div>' +
        '</form>' +
      '</section>' +

      '<div class="row-btns" style="justify-content:center"><button type="button" class="icon-btn" data-act="toggle-settings">⚙︎ הגדרות מרשם</button></div>' +
      '<p class="fine">הנתונים נשמרים רק בטלפון הזה. האפליקציה סאטירית ולא מחליפה ייעוץ רפואי. שתה מים, אל תנהג אחרי.</p>' +
      '<div class="toast" id="toast" role="status"></div>';
  }

  function bump() {
    var c = document.getElementById("count");
    if (c) { c.classList.remove("bump"); void c.offsetWidth; c.classList.add("bump"); }
  }

  function toast(msg) {
    var el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove("show"); }, 1800);
  }

  function pickQuip() {
    var q;
    do { q = QUIPS[Math.floor(Math.random() * QUIPS.length)]; } while (q === lastQuip && QUIPS.length > 1);
    return q;
  }

  app.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]");
    if (!b) return;
    var act = b.getAttribute("data-act");
    var settingsOpen = !document.getElementById("settings").hidden;

    if (act === "light") {
      S.j.push(Date.now());
      lastQuip = pickQuip();
      save(); render();
      bump();
    } else if (act === "half") {
      S.h.push(Date.now());
      lastQuip = HALF_QUIPS[Math.floor(Math.random() * HALF_QUIPS.length)];
      save(); render();
      bump();
    } else if (act === "undo") {
      var now = Date.now();
      var idx = -1, best = -1;
      var arr = null;
      [S.j, S.h].forEach(function (a) {
        a.forEach(function (t, i) { if (sameDay(t, now) && t > best) { best = t; idx = i; arr = a; } });
      });
      if (arr) { arr.splice(idx, 1); lastQuip = "בוטל. נעשה כאילו זה לא קרה."; save(); render(); }
    } else if (act === "munch") {
      S.m.push({ t: Date.now(), k: b.getAttribute("data-k") });
      save(); render();
      toast("נרשם פינוק. בתיאבון");
    } else if (act === "clear-demo") {
      var cfg = S.cfg;
      S = blank(); S.cfg = cfg;
      lastQuip = "";
      save(); render();
      toast("הדוגמה נמחקה. מעכשיו זה אמיתי");
    } else if (act === "toggle-settings") {
      resetArmed = false;
      render();
      document.getElementById("settings").hidden = settingsOpen;
      if (!settingsOpen) document.getElementById("f-grams").focus();
      return;
    } else if (act === "reset") {
      if (!resetArmed) {
        resetArmed = true;
        b.textContent = "בטוח? לחץ שוב למחיקה";
        return;
      }
      resetArmed = false;
      S = blank();
      lastQuip = "";
      save(); render();
      toast("הכל נמחק. דף חדש");
      return;
    }
    if (settingsOpen) document.getElementById("settings").hidden = false;
  });

  app.addEventListener("submit", function (e) {
    if (e.target.id !== "cfg") return;
    e.preventDefault();
    var g = parseFloat(document.getElementById("f-grams").value);
    var p = parseFloat(document.getElementById("f-gpj").value);
    var n = document.getElementById("f-name").value.trim();
    if (!(g > 0) || !(p > 0)) { toast("צריך מספרים חיוביים בשני השדות"); return; }
    S.cfg = { name: n || "אלעזר המלשין", grams: g, gpj: p };
    save(); render();
    toast("המרשם עודכן");
  });

  render();

  // keep "time since last" fresh and roll over at midnight
  var renderedDay = startOfDay(Date.now());
  setInterval(function () {
    if (startOfDay(Date.now()) !== renderedDay) {
      renderedDay = startOfDay(Date.now());
      var open = !document.getElementById("settings").hidden;
      render();
      document.getElementById("settings").hidden = !open;
      return;
    }
    var el = document.getElementById("since");
    if (el && lastTime()) el.textContent = since(lastTime());
  }, 30000);
})();
