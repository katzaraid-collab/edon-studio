"""AURO brand book page (published to the same Artifact as before)."""
import os, sys, re
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import mark, brand2, chart2
A = 'auro/'
OUTFILE = os.path.join(HERE, '..', 'build', 'book', 'golden-ratio-brand-book.html')

def construction():
    k = 2.2; Bk, Hk = mark.B * k, mark.H * k
    ox, oy = 150, 60
    bar, base = mark.pieces(ox, oy, k)
    poly = lambda p: 'M' + ' L'.join(f'{x:.1f},{y:.1f}' for x, y in p) + 'Z'
    g = [f'<path d="{poly(bar)} {poly(base)}" fill="url(#cg)"/>']
    def h(x1, x2, y, lab, dy=-14):
        return (f'<line class="dim" x1="{x1:.1f}" x2="{x2:.1f}" y1="{y:.1f}" y2="{y:.1f}"/><line class="dim" x1="{x1:.1f}" x2="{x1:.1f}" y1="{y-7:.1f}" y2="{y+7:.1f}"/>'
                f'<line class="dim" x1="{x2:.1f}" x2="{x2:.1f}" y1="{y-7:.1f}" y2="{y+7:.1f}"/><text class="lab" x="{(x1+x2)/2:.1f}" y="{y+dy:.1f}" text-anchor="middle">{lab}</text>')
    def v(x, y1, y2, lab, side):
        tx = x + (14 if side == 'r' else -14); anc = 'start' if side == 'r' else 'end'
        return (f'<line class="dim" x1="{x:.1f}" x2="{x:.1f}" y1="{y1:.1f}" y2="{y2:.1f}"/><line class="dim" x1="{x-7:.1f}" x2="{x+7:.1f}" y1="{y1:.1f}" y2="{y1:.1f}"/>'
                f'<line class="dim" x1="{x-7:.1f}" x2="{x+7:.1f}" y1="{y2:.1f}" y2="{y2:.1f}"/><text class="lab" x="{tx:.1f}" y="{(y1+y2)/2+6:.1f}" text-anchor="{anc}">{lab}</text>')
    cy = oy + mark.C * k; gy = cy + mark.GAP * k
    g.append(f'<line class="guide" x1="{ox-60}" x2="{ox+Bk+60}" y1="{cy+mark.GAP*k/2:.1f}" y2="{cy+mark.GAP*k/2:.1f}"/>')
    g.append(f'<text class="lab dimtxt" x="{ox+Bk+64:.1f}" y="{cy+mark.GAP*k/2+5:.1f}">LEVEL</text>')
    g.append(h(ox + Bk / 2 - mark.T * k / 2, ox + Bk / 2 + mark.T * k / 2, oy - 18, '0.22'))
    g.append(h(ox, ox + Bk, oy + Hk + 30, '1', 30))
    g.append(h(ox + Bk / 2 - mark.NB * k / 2, ox + Bk / 2 + mark.NB * k / 2, oy + Hk + 8, '0.30', 26))
    g.append(v(ox - 40, oy, cy, '0.382', 'l'))
    g.append(v(ox - 40, gy, oy + Hk, '0.618', 'l'))
    g.append(v(ox + Bk + 30, oy, oy + Hk, '0.85', 'r'))
    w, hh = ox + Bk + 150, oy + Hk + 80
    return f'<svg viewBox="0 0 {w:.0f} {hh:.0f}" role="img" aria-label="שרטוט בניית הסמל"><defs>{brand2.grad("cg")}</defs>{"".join(g)}</svg>'

def clearspace():
    s = open(os.path.join(HERE, 'out/logo/svg/auro-wordmark-dark.svg')).read()
    w = float(re.search(r'width="([\d.]+)"', s).group(1)); h = float(re.search(r'height="([\d.]+)"', s).group(1))
    m = h * mark.C / mark.H  # one bar height
    W, H = w + 2 * m, h + 2 * m
    bars = ''.join(f'<rect class="bar" x="{x:.1f}" y="{y:.1f}" width="{m:.1f}" height="{m:.1f}"/>' for x, y in [(0, 0), (W - m, 0), (0, H - m), (W - m, H - m)])
    return (f'<svg viewBox="0 0 {W:.1f} {H:.1f}" role="img" aria-label="שטח מוגן סביב הלוגו"><rect class="zone" width="{W:.1f}" height="{H:.1f}"/>{bars}'
            f'<rect class="dash" x="{m:.1f}" y="{m:.1f}" width="{w:.1f}" height="{h:.1f}"/><image href="{A}logo/auro-wordmark-dark.svg" x="{m:.1f}" y="{m:.1f}" width="{w:.1f}" height="{h:.1f}"/></svg>')

colors = [('Onyx', 'אוניקס', '#07070A', '7 7 10', 'רקע ראשי. שחור קר ועמוק.'),
          ('Carbon', 'קרבון', '#111114', '17 17 20', 'משטחים וכרטיסים.'),
          ('Steel', 'פלדה', '#2A2A30', '42 42 48', 'קווים, גבולות ומפרידים.'),
          ('Bone', 'עצם', '#EDEBE6', '237 235 230', 'טקסט ראשי והגרסה הבהירה.'),
          ('Ash', 'אפר', '#8E8B85', '142 139 133', 'טקסט משני ותוויות.'),
          ('Aurum', 'אורום', '#E7B64F', '231 182 79', 'הזהב השטוח: אייקונים, הדגשות וגרסת צבע אחד.')]

banners = [('whatsapp-group-icon', 'תמונת קבוצה בוואטסאפ', '1080×1080'), ('post-launch', 'פוסט פתיחה', '1080×1350'),
           ('post-why-the-name', 'פוסט: למה AURO', '1080×1350'), ('post-welcome-rules', 'ברוכים הבאים וכללים', '1080×1350'),
           ('signal-buy-example', 'כרטיס איתות, דוגמה', '1080×1350'), ('signal-buy-blank', 'כרטיס איתות ריק, קנייה', '1080×1350'),
           ('signal-sell-blank', 'כרטיס איתות ריק, מכירה', '1080×1350'), ('story-join', 'סטורי / סטטוס', '1080×1920')]
covers = [('facebook-cover', 'קאבר לפייסבוק', '1640×624'), ('youtube-banner', 'באנר ליוטיוב', '2560×1440'), ('link-preview-og', 'תצוגה מקדימה לקישור', '1200×630')]
highlights = [('about', 'אודות'), ('signals', 'איתותים'), ('analysis', 'ניתוחים'), ('community', 'קהילה'), ('faq', 'שאלות')]

GROUP_TEXT = '''AURO | קהילת מסחר בזהב
קהילה של סוחרי זהב שמשתפים רעיונות לעסקאות, ניתוחי שוק וידע.
לומדים ביחד, פועלים במשמעת ומפרגנים אחד לשני.
מסחר בזהב כרוך בסיכון. התוכן בקבוצה אינו ייעוץ השקעות ואינו מבטיח רווח. כל עסקה היא החלטה אישית.'''

def tile(img, bg, label, cls=''):
    return f'<figure class="tile {cls}" style="--tile:{bg}"><div class="tile-art"><img src="{A}logo/{img}" alt="{label}"></div><figcaption>{label}</figcaption></figure>'

html = f'''<title>AURO Brand Book</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..900&family=Geist+Mono:wght@400;500;600&family=Heebo:wght@200..900&display=swap">
<style>
/* Layout: one 1160px column on onyx; each chapter opens with a mono label and a condensed Hebrew headline; gold appears only in 3D renders, the symbol and one word per headline. */
:root {{
  --bg: #07070A; --surface: #111114; --surface-2: #17171B; --line: #24242A; --fg: #EDEBE6; --muted: #8E8B85; --soft: #CFCBC2;
  --aurum: #E7B64F; --mint: #3DDC97; --coral: #FF5A5F;
  --molten: linear-gradient(100deg,#FFF1C9 0%,#F2C14E 28%,#B07A1E 58%,#F7D98B 80%,#C9922E 100%);
  --f-he: "Heebo", "Noto Sans Hebrew", Arial, sans-serif;
  --f-lat: "Archivo", "Helvetica Neue", Arial, sans-serif;
  --f-mono: "Geist Mono", ui-monospace, Menlo, Consolas, monospace;
  color-scheme: dark;
}}
* {{ box-sizing: border-box }}
body {{ background: var(--bg); color: var(--fg); font-family: var(--f-he); font-size: 17px; line-height: 1.6; margin: 0 }}
main {{ max-width: 1160px; margin: 0 auto; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 0 96px }}
h1, h2, h3 {{ font-family: var(--f-he); font-weight: 800; text-wrap: balance; margin: 0; line-height: 1.04; letter-spacing: -.03em }}
h1, h2 {{ font-weight: 250 }}
h1 .gold, h2 .gold {{ font-weight: 800 }}
p {{ margin: 0 }}
img {{ max-width: 100%; display: block }}
.lat {{ font-family: var(--f-lat); font-stretch: 125%; font-weight: 800; letter-spacing: 0 }}
.mono {{ font-family: var(--f-mono); direction: ltr; unicode-bidi: isolate; font-variant-numeric: tabular-nums }}
.gold {{ color: var(--aurum) }}
.label {{ font-family: var(--f-mono); font-size: 12px; letter-spacing: .2em; text-transform: uppercase; color: var(--muted) }}
.lede {{ color: var(--soft); font-size: 19px; max-width: 60ch; font-weight: 400 }}
.glass {{ background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.015)); border: 1px solid rgba(255,255,255,.09); border-radius: 22px; box-shadow: inset 0 1px 0 rgba(255,255,255,.07) }}

.hero {{ position: relative; padding-block: 40px 56px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 24px; align-items: center }}
.hero::before {{ content: ""; position: absolute; inset: 0; pointer-events: none;
  background-image: radial-gradient(rgba(237,235,230,.11) 1px, transparent 1.4px); background-size: 26px 26px;
  -webkit-mask-image: radial-gradient(ellipse 60% 70% at 25% 45%, #000, transparent 70%); mask-image: radial-gradient(ellipse 60% 70% at 25% 45%, #000, transparent 70%) }}
.hero-copy {{ display: grid; gap: 26px; position: relative; min-width: 0 }}
.hero-copy img.wm {{ width: min(420px, 100%) }}
.hero h1 {{ font-size: clamp(40px, 6vw, 76px) }}
.hero-art {{ position: relative; min-width: 0 }}
.hero-art::before {{ content: ""; position: absolute; inset: 5% 0 0; background: radial-gradient(closest-side, rgba(242,193,78,.28), transparent); }}
.hero-art img {{ position: relative; width: 100% }}
.hero-meta {{ display: flex; gap: 18px; flex-wrap: wrap }}

.chapter {{ border-top: 1px solid var(--line); padding-block: 64px; display: grid; gap: 34px }}
.ch-head {{ display: grid; gap: 14px; max-width: 760px }}
.ch-head h2 {{ font-size: clamp(36px, 5vw, 60px) }}

.trio {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px }}
.trio .glass {{ padding: 26px; display: grid; gap: 12px; align-content: start; min-width: 0 }}
.trio .tok {{ font-size: 64px; line-height: 1; direction: ltr; text-align: right }}
.trio .tok.he {{ font-family: var(--f-he); font-weight: 800; letter-spacing: -.03em; direction: rtl }}
.trio h3 {{ font-size: 24px; letter-spacing: -.02em }}
.trio p {{ color: var(--soft); font-size: 16px }}

.split {{ display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 32px; align-items: center }}
.split svg {{ width: 100%; height: auto; display: block; direction: ltr }}
.construct .dim {{ stroke: var(--muted); stroke-width: 1.2 }}
.construct .guide {{ stroke: var(--fg); stroke-opacity: .3; stroke-dasharray: 3 7 }}
.construct .lab {{ fill: var(--fg); font-family: var(--f-mono); font-size: 16px }}
.construct .dimtxt {{ fill: var(--muted); font-size: 12px; letter-spacing: 2px }}
.facts {{ list-style: none; margin: 0; padding: 0 }}
.facts li {{ display: grid; grid-template-columns: 96px 1fr; gap: 16px; padding: 15px 0; border-top: 1px solid var(--line); align-items: baseline }}
.facts li:last-child {{ border-bottom: 1px solid var(--line) }}
.facts .mono {{ color: var(--aurum); font-size: 15px }}
.render {{ position: relative; border-radius: 22px; overflow: hidden; background: radial-gradient(ellipse at 50% 40%, #1d1810, #07070A 70%); border: 1px solid var(--line); display: grid; place-items: center; padding: 40px }}
.render img {{ width: min(560px, 80%) }}

.tiles {{ display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px }}
.tile {{ margin: 0; grid-column: span 3; background: var(--tile); border: 1px solid var(--line); border-radius: 18px; overflow: hidden; display: grid; grid-template-rows: 1fr auto; min-width: 0 }}
.tile.third {{ grid-column: span 2 }}
.tile-art {{ min-height: 230px; display: grid; place-items: center; padding: 36px }}
.tile-art img {{ max-height: 110px; width: auto; max-width: 100% }}
.tile.third .tile-art img {{ max-height: 96px }}
.tile figcaption {{ font-size: 13.5px; padding: 10px 16px; border-top: 1px solid rgba(140,140,140,.2); color: var(--muted) }}
.tile.on-light figcaption {{ color: #5E5B55 }}
.tile.on-gold figcaption {{ color: #FFF6E0; border-top-color: rgba(255,255,255,.25) }}
.cs svg {{ width: 100%; height: auto; display: block; border-radius: 18px }}
.cs .zone {{ fill: var(--surface) }} .cs .bar {{ fill: rgba(231,182,79,.14) }}
.cs .dash {{ fill: none; stroke: var(--aurum); stroke-opacity: .5; stroke-dasharray: 5 6; stroke-width: 1.2 }}
.minsz {{ display: flex; gap: 28px; align-items: flex-end; flex-wrap: wrap; padding: 24px; border-radius: 18px }}
.minsz figure {{ margin: 0; display: grid; gap: 8px; justify-items: center }}
.minsz figcaption {{ font-size: 12.5px; color: var(--muted) }}
.dont {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px }}
.dont figure {{ margin: 0; border: 1px solid var(--line); border-radius: 18px; overflow: hidden; background: var(--surface); min-width: 0 }}
.dont .art {{ height: 120px; display: grid; place-items: center; padding: 22px; overflow: hidden }}
.dont .art img {{ max-height: 48px; width: auto }}
.dont figcaption {{ font-size: 13.5px; padding: 10px 14px; border-top: 1px solid var(--line); color: var(--soft) }}
.dont b {{ color: var(--coral); font-weight: 600 }}

.swatches {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px }}
.swatch {{ border: 1px solid var(--line); border-radius: 18px; overflow: hidden; background: var(--surface); min-width: 0 }}
.chip {{ height: 110px; border-bottom: 1px solid var(--line) }}
.sw-meta {{ padding: 14px 16px 18px; display: grid; gap: 6px }}
.sw-name {{ display: flex; justify-content: space-between; gap: 8px; align-items: baseline }}
.sw-name b {{ font-size: 19px; font-weight: 700 }}
.sw-name span {{ font-family: var(--f-lat); font-stretch: 125%; font-size: 12px; font-weight: 700; color: var(--muted); letter-spacing: .08em; text-transform: uppercase }}
.sw-code {{ font-size: 12.5px; color: var(--aurum); text-align: right }}
.swatch p {{ font-size: 14.5px; color: var(--soft) }}
.molten {{ height: 96px; border-radius: 18px; background: var(--molten); display: flex; align-items: flex-end; justify-content: space-between; padding: 12px 16px; color: #140E04; font-family: var(--f-mono); font-size: 12px; direction: ltr }}
.signal-row {{ display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px }}
.signal-row .chip {{ height: 56px }}

.specimens {{ display: grid; gap: 12px }}
.spec {{ display: grid; grid-template-columns: 230px minmax(0, 1fr); gap: 24px; padding: 28px; align-items: center }}
.spec .who b {{ display: block; font-size: 17px }}
.spec .who span {{ font-size: 13.5px; color: var(--muted) }}
.s-he {{ font-family: var(--f-he); font-weight: 250; letter-spacing: -.03em; font-size: clamp(36px, 5.6vw, 68px); line-height: 1.02 }}
.s-he .gold {{ font-weight: 800 }}
.s-he-light {{ font-family: var(--f-he); font-weight: 400; font-size: clamp(22px, 3vw, 30px); line-height: 1.35; color: var(--soft) }}
.s-lat {{ font-family: var(--f-lat); font-stretch: 125%; font-weight: 800; font-size: clamp(30px, 5vw, 56px); direction: ltr; text-align: right; line-height: 1 }}
.s-mono {{ font-family: var(--f-mono); font-size: clamp(20px, 3vw, 30px); color: var(--aurum); direction: ltr; text-align: right }}

.chart-box {{ border-radius: 22px; overflow: hidden; border: 1px solid var(--line); background: radial-gradient(ellipse at 70% 0%, rgba(242,193,78,.08), transparent 60%), var(--bg); padding-top: 30px }}
.chart-box svg {{ width: 100%; height: auto; display: block }}
.points {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px }}
.points .glass {{ padding: 22px; min-width: 0 }}
.points h3 {{ font-size: 21px; letter-spacing: -.02em; margin-bottom: 8px }}
.points p {{ font-size: 15px; color: var(--soft) }}

.voice {{ display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px }}
.vcard {{ padding: 22px 24px; min-width: 0 }}
.vcard h3 {{ font-size: 21px; letter-spacing: -.02em; margin-bottom: 12px; display: flex; gap: 10px; align-items: center }}
.vcard ul {{ margin: 0; padding: 0; list-style: none; display: grid; gap: 8px }}
.vcard li {{ padding-inline-start: 18px; position: relative; font-size: 16px }}
.vcard li::before {{ content: ""; position: absolute; inset-inline-start: 0; top: .65em; width: 7px; height: 7px; border-radius: 50%; background: var(--mint) }}
.vcard.no li::before {{ background: var(--coral) }}
.tag {{ font-family: var(--f-mono); font-size: 11px; letter-spacing: .14em; padding: 3px 10px; border: 1px solid currentColor; border-radius: 99px }}
.yes .tag {{ color: var(--mint) }} .no .tag {{ color: var(--coral) }}
.copybox {{ padding: 22px 24px; display: grid; gap: 14px }}
.copybox pre {{ margin: 0; white-space: pre-wrap; font-family: var(--f-he); font-size: 16px; line-height: 1.7 }}
.copybox .bar {{ display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap }}
button {{ font: 600 14px var(--f-he); color: #140E04; background: var(--molten); border: 0; border-radius: 99px; padding: 10px 20px; cursor: pointer }}
button:focus-visible {{ outline: 2px solid var(--fg); outline-offset: 3px }}
.note {{ border-inline-start: 2px solid var(--aurum); padding: 4px 18px; color: var(--soft); font-size: 16px; max-width: 72ch }}

.apps {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; align-items: start }}
.apps figure, .covers figure {{ margin: 0; display: grid; gap: 8px; min-width: 0 }}
.apps img, .covers img {{ width: 100%; height: auto; border-radius: 14px; border: 1px solid var(--line) }}
figcaption.cap {{ display: flex; justify-content: space-between; gap: 8px; font-size: 13.5px; color: var(--soft) }}
figcaption.cap .mono {{ color: var(--muted); font-size: 12px }}
.covers {{ display: grid; gap: 18px }}
.hl {{ display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px }}
.hl figure {{ margin: 0; display: grid; gap: 8px; justify-items: center; font-size: 13.5px; color: var(--soft) }}
.hl img {{ border-radius: 50%; aspect-ratio: 1; object-fit: cover; width: 100% }}
.files {{ columns: 2; column-gap: 32px; font-size: 14.5px; color: var(--soft); padding: 0; margin: 0; list-style: none }}
.files li {{ break-inside: avoid; padding: 8px 0; border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; gap: 12px }}
.files .mono {{ color: var(--aurum); font-size: 12.5px }}
footer {{ border-top: 1px solid var(--line); padding-top: 28px; display: flex; justify-content: space-between; gap: 20px; flex-wrap: wrap; align-items: center; color: var(--muted); font-size: 13.5px }}

@media (max-width: 900px) {{
  .hero, .split {{ grid-template-columns: 1fr }}
  .hero-art {{ order: -1; max-width: 520px }}
  .apps, .dont, .swatches, .points {{ grid-template-columns: repeat(2, 1fr) }}
  .trio {{ grid-template-columns: 1fr }}
}}
@media (max-width: 640px) {{
  .voice, .signal-row, .swatches {{ grid-template-columns: 1fr }}
  .tile, .tile.third {{ grid-column: span 6 }}
  .spec {{ grid-template-columns: 1fr; gap: 12px }}
  .files {{ columns: 1 }}
  .hl {{ grid-template-columns: repeat(3, 1fr) }}
}}
@media (prefers-reduced-motion: no-preference) {{
  .hero-art img {{ animation: float 7s ease-in-out infinite }}
  @keyframes float {{ 50% {{ transform: translateY(-10px) }} }}
}}
</style>

<main dir="rtl" lang="he">
  <header class="hero">
    <div class="hero-copy">
      <span class="label">Brand book · 2026</span>
      <img class="wm" src="{A}logo/auro-wordmark-dark.svg" alt="AURO">
      <h1>זהות מותג לקהילת<br>מסחר <span class="gold">בזהב.</span></h1>
      <p class="lede">שם, סמל, לוגו, צבעים, גופנים ושפה גרפית, וכל הבאנרים מוכנים להעלאה. זהב בתלת־ממד, זכוכית, קווים זוהרים וטיפוגרפיה עברית מודרנית.</p>
      <div class="hero-meta"><span class="label">XAU/USD</span><span class="label">Au · 79</span><span class="label">Gold trading community</span></div>
    </div>
    <div class="hero-art"><img src="{A}3d/a-hero.webp" alt="הסמל של AURO בזהב תלת־ממדי"></div>
  </header>

  <section class="chapter" id="name">
    <div class="ch-head"><span class="label">01 · השם</span><h2>למה <span class="lat gold" style="font-size:.86em">AURO</span>?</h2>
      <p class="lede">ארבע אותיות שמתחילות בסמל הכימי של זהב. קל להגיד, נראה טוב באנגלית ובעברית, ולא קשור לשום אדם.</p></div>
    <div class="trio">
      <div class="glass"><span class="tok lat gold">Au</span><h3>זהב, בכימיה</h3><p>הסמל של זהב בטבלה המחזורית. היסוד ה־79. שתי האותיות הראשונות בשם.</p></div>
      <div class="glass"><span class="tok lat gold">Oro</span><h3>זהב, בעולם</h3><p>כך קוראים לזהב בספרדית ובאיטלקית. השם נשמע מוכר גם למי שלא יודע למה.</p></div>
      <div class="glass"><span class="tok he gold">אור</span><h3>אור, בעברית</h3><p>ככה קהילה טובה מרגישה: ברורה, פתוחה, ומאירה את הדרך למי שמצטרף.</p></div>
    </div>
  </section>

  <section class="chapter" id="symbol">
    <div class="ch-head"><span class="label">02 · הסמל</span><h2>מטיל על <span class="gold">פסגה</span></h2>
      <p class="lede">ה־A של AURO בנוי משני חלקים. למעלה מטיל זהב, למטה פסגה של גרף. הרווח ביניהם הוא רמת מחיר. הפסגה מחזיקה את המטיל, כמו שהקהילה מחזיקה כל סוחר.</p></div>
    <div class="split construct">
      {construction()}
      <ul class="facts">
        <li><span class="mono">0.382</span><span>גובה המטיל מתוך גובה הסמל. החלק הקטן של יחס הזהב.</span></li>
        <li><span class="mono">0.618</span><span>גובה הפסגה. החלק הגדול של אותו יחס.</span></li>
        <li><span class="mono">LEVEL</span><span>הרווח בין החלקים: קו רמה, כמו בגרף. עוביו 5% מרוחב הסמל.</span></li>
        <li><span class="mono">0.22</span><span>רוחב הקצה השטוח. ה־A שטוח למעלה כמו מטיל, ולא מחודד.</span></li>
        <li><span class="mono">0.30</span><span>רוחב החריץ בבסיס. מספיק רחב כדי שהסמל ייקרא גם בגודל 16 פיקסלים.</span></li>
      </ul>
    </div>
    <div class="render"><img src="{A}3d/a-left.webp" alt="הסמל בזהב תלת־ממדי, מבט מהצד"></div>
  </section>

  <section class="chapter" id="logo">
    <div class="ch-head"><span class="label">03 · הלוגו</span><h2>וורדמרק אחד, <span class="gold">בלי קישוטים</span></h2>
      <p class="lede">ה־A בזהב, ושאר האותיות ב־Archivo Expanded. כל הטקסט בקבצים הומר לצורות, כך שהלוגו זהה בכל מחשב ובכל תוכנה.</p></div>
    <div class="tiles">
      {tile('auro-wordmark-dark.svg', '#07070A', 'ראשי · רקע כהה')}
      {tile('auro-wordmark-light.svg', '#EDEBE6', 'ראשי · רקע בהיר', 'on-light')}
      {tile('auro-lockup-dark.svg', '#111114', 'עם תיאור בעברית', 'third')}
      {tile('auro-symbol-dark.svg', '#07070A', 'סמל', 'third')}
      {tile('auro-app-icon.svg', '#17171B', 'אייקון', 'third')}
      {tile('auro-wordmark-gold.svg', '#07070A', 'צבע אחד · זהב', 'third')}
      {tile('auro-wordmark-black.svg', '#EDEBE6', 'צבע אחד · שחור', 'third on-light')}
      {tile('auro-wordmark-white.svg', '#B07A1E', 'צבע אחד · לבן', 'third on-gold')}
    </div>
    <div class="split">
      <div class="cs">{clearspace()}</div>
      <div style="display:grid;gap:16px">
        <h3 style="font-size:27px">שטח מוגן וגודל מינימלי</h3>
        <p style="color:var(--soft)">מסביב ללוגו נשאר מרווח ריק בגובה המטיל, מכל צד. לא מצמידים אליו טקסט, תמונות או קצה של מסך.</p>
        <div class="minsz glass">
          <figure><img src="{A}logo/auro-wordmark-dark.svg" style="width:96px" alt=""><figcaption>לוגו · מינימום 96px / 20 מ״מ</figcaption></figure>
          <figure><img src="{A}logo/auro-symbol-dark.svg" style="height:18px;width:auto" alt=""><figcaption>סמל · 16px</figcaption></figure>
        </div>
      </div>
    </div>
    <div class="dont">
      <figure><div class="art"><img src="{A}logo/auro-wordmark-dark.svg" style="transform:scaleX(1.5)" alt=""></div><figcaption><b>לא</b> למתוח</figcaption></figure>
      <figure><div class="art"><img src="{A}logo/auro-wordmark-dark.svg" style="filter:hue-rotate(180deg) saturate(2.5)" alt=""></div><figcaption><b>לא</b> לשנות צבעים</figcaption></figure>
      <figure><div class="art" style="background:url({A}banners/facebook-cover.webp) 20% 50%/cover"><img src="{A}logo/auro-wordmark-light.svg" alt=""></div><figcaption><b>לא</b> על רקע עמוס</figcaption></figure>
      <figure><div class="art"><img src="{A}logo/auro-wordmark-dark.svg" style="filter:drop-shadow(5px 5px 0 #FF5A5F)" alt=""></div><figcaption><b>לא</b> צללים ואפקטים</figcaption></figure>
    </div>
  </section>

  <section class="chapter" id="color">
    <div class="ch-head"><span class="label">04 · צבע</span><h2>שחור עמוק, <span class="gold">זהב מותך</span></h2>
      <p class="lede">כמעט הכול שחור, אפור ולבן. הזהב מופיע רק בסמל, ברנדרים בתלת־ממד ובמילה אחת בכותרת. ככה הוא נשאר יקר.</p></div>
    <div class="swatches">{''.join(f'<div class="swatch"><div class="chip" style="background:{hx}"></div><div class="sw-meta"><div class="sw-name"><b>{he}</b><span>{en}</span></div><div class="mono sw-code">{hx} · RGB {rgb}</div><p>{role}</p></div></div>' for en, he, hx, rgb, role in colors)}</div>
    <div class="molten"><span>#FFF1C9</span><span>#F2C14E</span><span>#B07A1E</span><span>#F7D98B</span><span>MOLTEN GRADIENT · 100°</span></div>
    <div class="signal-row">
      <div class="swatch"><div class="chip" style="background:#3DDC97"></div><div class="sw-meta"><div class="sw-name"><b>מנטה</b><span>Mint</span></div><div class="mono sw-code">#3DDC97</div><p>קנייה ויעדים. רק בכרטיסי איתות.</p></div></div>
      <div class="swatch"><div class="chip" style="background:#FF5A5F"></div><div class="sw-meta"><div class="sw-name"><b>אלמוג</b><span>Coral</span></div><div class="mono sw-code">#FF5A5F</div><p>מכירה וסטופ לוס. רק בכרטיסי איתות.</p></div></div>
    </div>
  </section>

  <section class="chapter" id="type">
    <div class="ch-head"><span class="label">05 · טיפוגרפיה</span><h2>גופנים <span class="gold">חדשים</span></h2>
      <p class="lede">עברית ב־Heebo, עם ניגוד משקלים: שורה דקה מול שורה כבדה בזהב, כמו בסלוגן. אנגלית רחבה ונקייה ב־Archivo Expanded, ומונו למספרים בלבד. כולם חינמיים ב־Google Fonts.</p></div>
    <div class="specimens">
      <div class="spec glass"><div class="who"><b>Heebo</b><span>כותרות · 250 מול 800</span></div><div class="s-he">סוחרים בזהב. <span class="gold">צומחים ביחד.</span></div></div>
      <div class="spec glass"><div class="who"><b>Heebo</b><span>טקסט · 400–500</span></div><p class="s-he-light">רעיונות לעסקאות, ניתוחי שוק ולמידה משותפת. כל עסקה היא החלטה אישית.</p></div>
      <div class="spec glass"><div class="who"><b>Archivo Expanded</b><span>אנגלית ולוגו · 800</span></div><div class="s-lat">GOLD, TOGETHER.</div></div>
      <div class="spec glass"><div class="who"><b>Geist Mono</b><span>מספרים, מחירים וטיקרים</span></div><div class="s-mono">XAU/USD 4,108.50 · 0.618</div></div>
    </div>
  </section>

  <section class="chapter" id="graphics">
    <div class="ch-head"><span class="label">06 · שפה גרפית</span><h2>זהב, זכוכית <span class="gold">ואור</span></h2>
      <p class="lede">ארבעה רכיבים חוזרים בכל באנר. הקו הזוהר מספר את אותו סיפור בכל מקום: עלייה, תיקון שנוגע ברמת 0.618, והמשך עלייה.</p></div>
    <div class="chart-box">{chart2.svg(1160, 360, gid='bk', font=14)}</div>
    <div class="points">
      <div class="glass"><h3>זהב בתלת־ממד</h3><p>הסמל ומטילי זהב מותך, מוארים כמו בסטודיו. הם הגיבורים של כל באנר.</p></div>
      <div class="glass"><h3>זכוכית</h3><p>כרטיסים שקופים למחצה עם קו אור עליון. ככה בנויים כרטיסי האיתות והרשימות.</p></div>
      <div class="glass"><h3>קו זוהר</h3><p>גרף אחד, דק, עם הילה ונקודת סיום בוהקת. בלי נרות ובלי רעש.</p></div>
      <div class="glass"><h3>רשת נקודות</h3><p>רשת עדינה שנעלמת לקצוות. נותנת עומק של מסך מסחר.</p></div>
    </div>
  </section>

  <section class="chapter" id="voice">
    <div class="ch-head"><span class="label">07 · טון דיבור</span><h2>ביטחון <span class="gold">שקט</span></h2>
      <p class="lede">משפטים קצרים, מספרים מדויקים, ואחריות. מדברים כמו סוחר מנוסה ולא כמו מוכר.</p></div>
    <div class="voice">
      <div class="vcard glass yes"><h3><span class="tag">כן</span> אומרים</h3><ul><li>רעיון לעסקה</li><li>ניהול סיכון לפני הכול</li><li>הנה מה שלמדנו מהעסקה הזו</li><li>כל עסקה היא החלטה אישית</li></ul></div>
      <div class="vcard glass no"><h3><span class="tag">לא</span> אומרים</h3><ul><li>רווח מובטח</li><li>עסקה בטוחה</li><li>מכפילים את הכסף</li><li>אחוזי הצלחה בלי מקור ותקופה</li></ul></div>
    </div>
    <div class="copybox glass">
      <div class="bar"><span class="label">תיאור הקבוצה בוואטסאפ</span><button type="button" id="copy-desc">העתקת הטקסט</button></div>
      <pre id="group-desc">{GROUP_TEXT}</pre>
    </div>
    <p class="note">במותג אין שם פרטי של אף אחד. אחוז הפגיעה לא מופיע בבאנרים. אם רוצים לפרסם אותו, מצרפים תקופה, מספר עסקאות ואיך נמדד, יחד עם ההסתייגות.</p>
  </section>

  <section class="chapter" id="applications">
    <div class="ch-head"><span class="label">08 · באנרים</span><h2>מוכנים <span class="gold">להעלאה</span></h2>
      <p class="lede">כל קובץ במידות המדויקות של הפלטפורמה, עם הסתייגות סיכון קטנה.</p></div>
    <div class="apps">{''.join(f'<figure><img src="{A}banners/{n}.webp" alt="{t}"><figcaption class="cap"><span>{t}</span><span class="mono">{d}</span></figcaption></figure>' for n, t, d in banners)}</div>
    <div class="covers">{''.join(f'<figure><img src="{A}banners/{n}.webp" alt="{t}"><figcaption class="cap"><span>{t}</span><span class="mono">{d}</span></figcaption></figure>' for n, t, d in covers)}</div>
    <div class="hl">{''.join(f'<figure><img src="{A}banners/highlight-{k}.webp" alt="{t}">{t}</figure>' for k, t in highlights)}</div>
    <p style="font-size:14px;color:var(--muted)">כיסויים להיילייטס באינסטגרם · <span class="mono">1080×1920</span></p>
  </section>

  <section class="chapter" id="files">
    <div class="ch-head"><span class="label">09 · קבצים</span><h2>מה יש <span class="gold">בחבילה</span></h2></div>
    <ul class="files">
      <li><span>וורדמרק, וורדמרק עם תיאור וסמל · 5 צבעים לכל אחד</span><span class="mono">SVG + PNG</span></li>
      <li><span>אייקון אפליקציה</span><span class="mono">SVG + PNG</span></li>
      <li><span>רנדרים בתלת־ממד של הסמל וטיפות זהב</span><span class="mono">PNG</span></li>
      <li><span>תמונת קבוצה לוואטסאפ</span><span class="mono">1080×1080</span></li>
      <li><span>3 פוסטים</span><span class="mono">1080×1350</span></li>
      <li><span>3 כרטיסי איתות</span><span class="mono">1080×1350</span></li>
      <li><span>סטורי וסטטוס</span><span class="mono">1080×1920</span></li>
      <li><span>5 כיסויי היילייטס</span><span class="mono">1080×1920</span></li>
      <li><span>קאבר לפייסבוק</span><span class="mono">1640×624</span></li>
      <li><span>באנר ליוטיוב</span><span class="mono">2560×1440</span></li>
      <li><span>תצוגה מקדימה לקישור</span><span class="mono">1200×630</span></li>
      <li><span>גופנים (רישיון OFL חופשי) וטקסטים מוכנים</span><span class="mono">TTF + TXT</span></li>
    </ul>
  </section>

  <footer>
    <img src="{A}logo/auro-wordmark-dark.svg" alt="AURO" style="height:26px;width:auto">
    <span>מסחר בזהב כרוך בסיכון. התוכן בקהילה אינו ייעוץ השקעות ואינו מבטיח רווח.</span>
  </footer>
</main>
<script>
document.getElementById('copy-desc').addEventListener('click', function (e) {{
  var btn = e.currentTarget, el = document.getElementById('group-desc');
  function done(msg) {{ btn.textContent = msg; setTimeout(function () {{ btn.textContent = 'העתקת הטקסט'; }}, 1800); }}
  function select() {{ var r = document.createRange(); r.selectNodeContents(el); var s = getSelection(); s.removeAllRanges(); s.addRange(r); done('הטקסט סומן. העתיקו עם Ctrl+C'); }}
  try {{ navigator.clipboard.writeText(el.textContent).then(function () {{ done('הועתק'); }}, select); }} catch (err) {{ select(); }}
}});
</script>
'''
open(OUTFILE, 'w').write(html)
print('ok', len(html) // 1024, 'KB')
