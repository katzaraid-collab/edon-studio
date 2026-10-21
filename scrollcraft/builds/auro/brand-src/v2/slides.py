"""AURO client presentation: 16:9 slides rendered to one PDF."""
import os, sys, re
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import mark, brand2
OUT = os.path.join(HERE, 'slides'); os.makedirs(OUT, exist_ok=True)
LOGO = '../out/logo/svg/'; BN = '../../build/book/auro/banners/'; D3 = '../out/3d/'

def construction():
    k = 2.6; Bk, Hk = mark.B * k, mark.H * k
    ox, oy = 170, 70
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
    g.append(f'<text class="lab dimtxt" x="{ox+Bk+66:.1f}" y="{cy+mark.GAP*k/2+5:.1f}">LEVEL</text>')
    g.append(h(ox + Bk / 2 - mark.T * k / 2, ox + Bk / 2 + mark.T * k / 2, oy - 18, '0.22'))
    g.append(h(ox, ox + Bk, oy + Hk + 34, '1', 30))
    g.append(h(ox + Bk / 2 - mark.NB * k / 2, ox + Bk / 2 + mark.NB * k / 2, oy + Hk + 8, '0.30', 26))
    g.append(v(ox - 40, oy, cy, '0.382', 'l'))
    g.append(v(ox - 40, gy, oy + Hk, '0.618', 'l'))
    g.append(v(ox + Bk + 30, oy, oy + Hk, '0.85', 'r'))
    w, hh = ox + Bk + 160, oy + Hk + 90
    return f'<svg viewBox="0 0 {w:.0f} {hh:.0f}" class="construct"><defs>{brand2.grad("cg")}</defs>{"".join(g)}</svg>'

def slide(inner, cls=''):
    return f'<section class="slide {cls}">{inner}<div class="folio"><img src="{LOGO}auro-wordmark-dark.svg" alt=""><span>זהות מותג · 2026</span></div></section>'

def head(label, h_light, h_bold, lede=''):
    return (f'<header class="sh"><span class="label">{label}</span><h2><span class="lt">{h_light}</span> <span class="bd">{h_bold}</span></h2>'
            + (f'<p class="lede">{lede}</p>' if lede else '') + '</header>')

def tile(img, bg, cap, light=False):
    return f'<figure class="tile" style="background:{bg}"><div class="ta"><img src="{LOGO}{img}" alt=""></div><figcaption class="{"onl" if light else ""}">{cap}</figcaption></figure>'

def sw(he, en, hx, role, dark_text=False):
    return f'<div class="sw"><div class="chip" style="background:{hx}"></div><div class="swm"><b>{he}</b><span class="en">{en}</span><span class="mono">{hx}</span><p>{role}</p></div></div>'

def fig(src, cap, size, cls=''):
    return f'<figure class="bn {cls}"><img src="{BN}{src}.webp" alt=""><figcaption><span>{cap}</span><span class="mono">{size}</span></figcaption></figure>'

slides = []
# 1 cover
slides.append(f'''<section class="slide cover">
  <div class="dots"></div><div class="halo" style="width:1100px;height:1000px;left:-120px;top:40px"></div>
  <img class="cover-a" src="{D3}a-hero.png" alt="">
  <div class="cover-copy">
    <img class="cover-wm" src="{LOGO}auro-wordmark-dark.svg" alt="AURO">
    <h1><span class="lt">סוחרים בזהב.</span><br><span class="bd">צומחים ביחד.</span></h1>
    <p class="lede">זהות מותג לקהילת מסחר בזהב: שם, סמל, לוגו, צבעים, טיפוגרפיה, שפה גרפית ובאנרים מוכנים להעלאה.</p>
    <p class="credit">אוקטובר 2026 · הוכן על ידי EDON</p>
  </div>
</section>''')
# 2 name
slides.append(slide(head('השם', 'למה', '<span class="lat">AURO</span>?', 'ארבע אותיות שמתחילות בסמל הכימי של זהב. קל להגיד, נראה טוב באנגלית ובעברית, ולא קשור לשום אדם.') + f'''
  <div class="trio">
    <div class="card"><span class="tok lat">Au</span><h3>זהב, בכימיה</h3><p>הסמל של זהב בטבלה המחזורית, היסוד ה־79. שתי האותיות הראשונות בשם.</p></div>
    <div class="card"><span class="tok lat">Oro</span><h3>זהב, בעולם</h3><p>כך קוראים לזהב בספרדית ובאיטלקית. השם נשמע מוכר גם למי שלא יודע למה.</p></div>
    <div class="card"><span class="tok he">אור</span><h3>אור, בעברית</h3><p>ככה קהילה טובה מרגישה: ברורה, פתוחה, ומאירה את הדרך למי שמצטרף.</p></div>
  </div>'''))
# 3 symbol
slides.append(slide(head('הסמל', 'מטיל', 'על פסגה', 'ה־A בנוי משני חלקים: למעלה מטיל זהב, למטה פסגה של גרף. הרווח ביניהם הוא רמת מחיר. הפסגה מחזיקה את המטיל, כמו שהקהילה מחזיקה כל סוחר.') + f'''
  <div class="sym-row">{construction()}<div class="sym-3d"><img src="{D3}a-left.png" alt=""></div></div>''', 'symbol'))
# 4 logo versions
slides.append(slide(head('הלוגו', 'וורדמרק אחד,', 'בלי קישוטים', 'ה־A בזהב, ושאר האותיות ב־Archivo Expanded. כל הטקסט בקבצים הומר לצורות, כך שהלוגו זהה בכל מחשב ובכל תוכנה.') + f'''
  <div class="tiles">
    {tile('auro-wordmark-dark.svg', '#07070A', 'ראשי · רקע כהה')}
    {tile('auro-wordmark-light.svg', '#EDEBE6', 'ראשי · רקע בהיר', True)}
    {tile('auro-lockup-dark.svg', '#111114', 'עם תיאור בעברית')}
    {tile('auro-symbol-dark.svg', '#07070A', 'סמל')}
    {tile('auro-app-icon.svg', '#17171B', 'אייקון')}
    {tile('auro-wordmark-gold.svg', '#07070A', 'צבע אחד · זהב')}
    {tile('auro-wordmark-black.svg', '#EDEBE6', 'צבע אחד · שחור', True)}
    {tile('auro-wordmark-white.svg', '#B07A1E', 'צבע אחד · לבן')}
  </div>''', 'logos'))
# 5 usage
slides.append(slide(head('שימוש בלוגו', 'מרווח,', 'גודל ומה לא עושים') + f'''
  <div class="usage">
    <div class="cs"><div class="cs-box"><img src="{LOGO}auro-wordmark-dark.svg" alt=""></div>
      <p>מסביב ללוגו נשאר מרווח ריק בגובה המטיל, מכל צד. לא מצמידים אליו טקסט, תמונות או קצה של מסך.</p>
      <div class="mins"><div><img src="{LOGO}auro-wordmark-dark.svg" style="width:96px" alt=""><span>לוגו · מינימום 96px / 20 מ״מ</span></div><div><img src="{LOGO}auro-symbol-dark.svg" style="height:18px" alt=""><span>סמל · 16px</span></div></div></div>
    <div class="donts">
      <figure><div class="da"><img src="{LOGO}auro-wordmark-dark.svg" style="transform:scaleX(1.5)" alt=""></div><figcaption><b>לא</b> למתוח</figcaption></figure>
      <figure><div class="da"><img src="{LOGO}auro-wordmark-dark.svg" style="filter:hue-rotate(180deg) saturate(2.5)" alt=""></div><figcaption><b>לא</b> לשנות צבעים</figcaption></figure>
      <figure><div class="da" style="background:url({BN}facebook-cover.webp) 20% 50%/cover"><img src="{LOGO}auro-wordmark-light.svg" alt=""></div><figcaption><b>לא</b> על רקע עמוס</figcaption></figure>
      <figure><div class="da"><img src="{LOGO}auro-wordmark-dark.svg" style="filter:drop-shadow(6px 6px 0 #FF5A5F)" alt=""></div><figcaption><b>לא</b> צללים ואפקטים</figcaption></figure>
    </div>
  </div>'''))
# 6 colour
slides.append(slide(head('צבע', 'שחור עמוק,', 'זהב מותך', 'כמעט הכול שחור, אפור ולבן. הזהב מופיע בסמל, ברנדרים בתלת־ממד ובמילה אחת בכותרת. ככה הוא נשאר יקר.') + f'''
  <div class="sws">
    {sw('אוניקס', 'Onyx', '#07070A', 'רקע ראשי')}{sw('קרבון', 'Carbon', '#111114', 'משטחים וכרטיסים')}{sw('פלדה', 'Steel', '#2A2A30', 'קווים ומפרידים')}
    {sw('עצם', 'Bone', '#EDEBE6', 'טקסט ראשי')}{sw('אפר', 'Ash', '#8E8B85', 'טקסט משני')}{sw('אורום', 'Aurum', '#E7B64F', 'זהב שטוח והדגשות')}
  </div>
  <div class="molten"><span>MOLTEN GRADIENT · לסמל ולרנדרים בלבד</span><span class="mono">#FFF1C9 · #F2C14E · #B07A1E · #F7D98B</span></div>
  <div class="sig"><span><i style="background:#3DDC97"></i>מנטה #3DDC97 · קנייה ויעדים</span><span><i style="background:#FF5A5F"></i>אלמוג #FF5A5F · מכירה וסטופ</span><span class="note">רק בכרטיסי איתות</span></div>''', 'colour'))
# 7 type
slides.append(slide(head('טיפוגרפיה', 'קל מול', 'כבד', 'Heebo בשני משקלים מנוגדים נותן לכל כותרת קצב: שורה ראשונה דקה ושקטה, שורה שנייה כבדה ובזהב.') + f'''
  <div class="specs">
    <div class="spec"><div class="who"><b>Heebo</b><span>עברית · כותרות 200–300 מול 800</span></div><div class="s-he"><span class="lt">סוחרים בזהב.</span> <span class="bd">צומחים ביחד.</span></div></div>
    <div class="spec"><div class="who"><b>Heebo</b><span>טקסט רץ · 400</span></div><p class="s-body">רעיונות לעסקאות, ניתוחי שוק ולמידה משותפת. כל עסקה היא החלטה אישית.</p></div>
    <div class="spec"><div class="who"><b>Archivo Expanded</b><span>לוגו ואנגלית · 800</span></div><div class="s-lat">GOLD, TOGETHER.</div></div>
    <div class="spec"><div class="who"><b>Geist Mono</b><span>מחירים, טיקרים ורמות</span></div><div class="s-mono">XAU/USD 4,108.50 · 0.618</div></div>
  </div>
  <p class="free">כל הגופנים חינמיים (Google Fonts, רישיון OFL) ומצורפים לחבילה.</p>'''))
# 8 graphic language
slides.append(slide(head('שפה גרפית', 'זהב, משטחים', 'וקו אחד', 'ארבעה רכיבים שחוזרים בכל באנר. הקו מספר את אותו סיפור בכל מקום: עלייה, תיקון שנוגע ברמת 0.618, והמשך עלייה.') + f'''
  <div class="gl">
    <div class="gl-hero"><img src="{BN}facebook-cover.webp" alt=""></div>
    <div class="gl-list">
      <div><h3>זהב בתלת־ממד</h3><p>הסמל ומטילי זהב מותך, מוארים כמו בסטודיו.</p></div>
      <div><h3>משטחים כהים</h3><p>כרטיסים עם קו אור עליון. ככה בנויים כרטיסי האיתות והרשימות.</p></div>
      <div><h3>קו הזהב</h3><p>גרף אחד, דק, עם נקודת סיום בוהקת. בלי רעש.</p></div>
      <div><h3>רשת נקודות</h3><p>רשת עדינה שנעלמת לקצוות, כמו מסך מסחר.</p></div>
    </div>
  </div>'''))
# 9 voice
slides.append(slide(head('טון דיבור', 'ביטחון', 'שקט', 'משפטים קצרים, מספרים מדויקים, ואחריות. מדברים כמו סוחר מנוסה ולא כמו מוכר.') + '''
  <div class="voice">
    <div class="vc yes"><h3>כן אומרים</h3><ul><li>רעיון לעסקה</li><li>ניהול סיכון לפני הכול</li><li>הנה מה שלמדנו מהעסקה הזו</li><li>כל עסקה היא החלטה אישית</li></ul></div>
    <div class="vc no"><h3>לא אומרים</h3><ul><li>רווח מובטח</li><li>עסקה בטוחה</li><li>מכפילים את הכסף</li><li>אחוזי הצלחה בלי מקור ותקופה</li></ul></div>
    <div class="vc desc"><h3>תיאור הקבוצה בוואטסאפ</h3><p>AURO | קהילת מסחר בזהב<br>קהילה של סוחרי זהב שמשתפים רעיונות לעסקאות, ניתוחי שוק וידע.<br>לומדים ביחד, פועלים במשמעת ומפרגנים אחד לשני.<br><span class="small">מסחר בזהב כרוך בסיכון. התוכן בקבוצה אינו ייעוץ השקעות ואינו מבטיח רווח. כל עסקה היא החלטה אישית.</span></p></div>
  </div>'''))
# 10 posts
slides.append(slide(head('באנרים', 'פוסטים', 'לאינסטגרם ולוואטסאפ') + f'''
  <div class="row4">{fig('post-launch', 'פוסט פתיחה', '1080×1350')}{fig('post-why-the-name', 'למה AURO', '1080×1350')}{fig('post-welcome-rules', 'ברוכים הבאים וכללים', '1080×1350')}{fig('whatsapp-group-icon', 'תמונת קבוצה', '1080×1080', 'sq')}</div>'''))
# 11 signals + story
slides.append(slide(head('באנרים', 'כרטיסי איתות', 'וסטורי', 'כרטיס האיתות בנוי כמו מסך באפליקציית מסחר. יש דוגמה מלאה ותבניות ריקות לקנייה ולמכירה.') + f'''
  <div class="row4">{fig('signal-buy-example', 'איתות · דוגמה', '1080×1350')}{fig('signal-buy-blank', 'תבנית קנייה', '1080×1350')}{fig('signal-sell-blank', 'תבנית מכירה', '1080×1350')}{fig('story-join', 'סטורי / סטטוס', '1080×1920', 'tall')}</div>''', 'signals'))
# 12 covers + highlights
hl = ''.join(f'<figure class="hl"><img src="{BN}highlight-{k}.webp" alt=""><figcaption>{t}</figcaption></figure>' for k, t in [('about', 'אודות'), ('signals', 'איתותים'), ('analysis', 'ניתוחים'), ('community', 'קהילה'), ('faq', 'שאלות')])
slides.append(slide(head('באנרים', 'קאברים', 'והיילייטס') + f'''
  <div class="covers">{fig('facebook-cover', 'קאבר לפייסבוק', '1640×624', 'fb')}{fig('youtube-banner', 'באנר ליוטיוב', '2560×1440', 'yt')}{fig('link-preview-og', 'תצוגה מקדימה לקישור', '1200×630', 'og')}</div>
  <div class="hls">{hl}</div>'''))
# 12b landing page
LP = 'lp/'
slides.append(slide(head('דף נחיתה', 'לבד מול', 'ביחד', 'המסך מחולק בקו מחיר. ככל שגוללים, הצד של ״ביחד״ גדל. בסוף מטיל הזהב חוצה את הקו, ננעל על הפסגה והלוגו נשלם. ברקע נופלים מטילי זהב בתלת־ממד.') + f'''
  <div class="lp">
    <figure class="lp-d"><img src="{LP}d-hero.jpg" alt=""><figcaption>פתיחה</figcaption></figure>
    <figure class="lp-d"><img src="{LP}d-signal.jpg" alt=""><figcaption>רעיון לעסקה</figcaption></figure>
    <figure class="lp-d"><img src="{LP}d-close.jpg" alt=""><figcaption>הסוף: הלוגו נשלם</figcaption></figure>
    <figure class="lp-m"><img src="{LP}m-hero.jpg" alt=""><figcaption>טלפון</figcaption></figure>
    <figure class="lp-m"><img src="{LP}m-close.jpg" alt=""><figcaption>טלפון · סוף</figcaption></figure>
  </div>''', 'landing'))
# 13 files + close
slides.append(f'''<section class="slide closing">
  <div class="dots"></div><div class="halo" style="width:900px;height:900px;left:-200px;top:120px"></div>
  <img class="close-a" src="{D3}a-front.png" alt="">
  <div class="close-copy">
    <span class="label">מה כולל</span>
    <h2><span class="lt">הכול מוכן</span> <span class="bd">להעלאה.</span></h2>
    <ul class="files">
      <li><span>לוגו: וורדמרק, עם תיאור, סמל ואייקון · 5 צבעים</span><span class="mono">SVG + PNG</span></li>
      <li><span>רנדרים של הסמל בתלת־ממד</span><span class="mono">PNG שקוף</span></li>
      <li><span>16 באנרים במידות המדויקות</span><span class="mono">PNG</span></li>
      <li><span>גופנים עם רישיון</span><span class="mono">TTF</span></li>
      <li><span>טקסטים מוכנים: תיאור קבוצה, הודעת פתיחה, ביו, כללים</span><span class="mono">TXT</span></li>
      <li><span>דף נחיתה מוכן לעלייה לאוויר</span><span class="mono">HTML</span></li>
    </ul>
    <p class="disc">מסחר בזהב כרוך בסיכון. התוכן בקהילה אינו ייעוץ השקעות ואינו מבטיח רווח.</p>
    <img class="close-wm" src="{LOGO}auro-wordmark-dark.svg" alt="AURO">
  </div>
</section>''')

CSS = '''
@font-face{font-family:Heebo;src:url(../fonts/Heebo.ttf);font-weight:100 900}
@font-face{font-family:Arch;src:url(../fonts/Archivo.ttf);font-weight:100 900;font-stretch:62% 125%}
@font-face{font-family:GMono;src:url(../fonts/GeistMono.ttf);font-weight:100 900}
@page{size:1920px 1080px;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#07070A}
body{font-family:Heebo,sans-serif;color:#EDEBE6;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.slide{position:relative;width:1920px;height:1080px;overflow:hidden;background:#07070A;padding:96px 120px 120px;break-after:page;page-break-after:always;display:flex;flex-direction:column;gap:56px}
.slide:last-child{break-after:auto;page-break-after:auto}
.folio{position:absolute;left:120px;right:120px;bottom:48px;display:flex;justify-content:space-between;align-items:center;color:#6E6B66;font-size:18px;letter-spacing:.04em}
.folio img{height:22px}
.label{font-family:GMono,monospace;font-size:18px;letter-spacing:.18em;color:#8E8B85}
.lat{font-family:Arch;font-stretch:125%;font-weight:800;letter-spacing:0;direction:ltr;unicode-bidi:isolate}
.mono{font-family:GMono,monospace;direction:ltr;unicode-bidi:isolate}
.lt{font-weight:250}.bd{font-weight:800;color:#E7B64F}
.sh{display:grid;gap:18px;max-width:1300px}
.sh h2{font-size:92px;line-height:1;letter-spacing:-.03em;font-weight:400}
.lede{font-size:30px;line-height:1.5;color:#CFCBC2;font-weight:300;max-width:1180px}
.dots{position:absolute;inset:0;background-image:radial-gradient(rgba(237,235,230,.11) 1.2px,transparent 1.6px);background-size:32px 32px;-webkit-mask-image:radial-gradient(ellipse 60% 70% at 28% 50%,#000,transparent 72%)}
.halo{position:absolute;border-radius:50%;background:radial-gradient(closest-side,rgba(242,193,78,.26),rgba(176,122,30,.08) 55%,transparent)}
.cover{padding:0}
.cover-a{position:absolute;left:110px;top:170px;width:820px}
.cover-copy{position:absolute;right:120px;top:0;bottom:0;width:820px;display:flex;flex-direction:column;justify-content:center;gap:40px}
.cover-wm{height:84px;align-self:flex-start}
.cover h1{font-size:120px;line-height:.98;letter-spacing:-.035em;font-weight:400}
.credit{font-size:20px;color:#8E8B85;letter-spacing:.03em}
.card{background:#111114;border:1.5px solid #24242A;border-radius:28px;box-shadow:inset 0 1.5px 0 rgba(255,255,255,.07);padding:44px;display:grid;gap:16px;align-content:start}
.trio{display:grid;grid-template-columns:repeat(3,1fr);gap:28px}
.tok{font-size:120px;line-height:1;color:#E7B64F}.tok.he{font-weight:800;letter-spacing:-.03em}
.card h3{font-size:40px;font-weight:700;letter-spacing:-.02em}.card p{font-size:26px;line-height:1.5;color:#CFCBC2;font-weight:300}
.sym-row{display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:center;flex:1;min-height:0}
.construct{width:100%;max-height:600px;direction:ltr}
.construct .dim{stroke:#8E8B85;stroke-width:1.4}.construct .guide{stroke:#EDEBE6;stroke-opacity:.3;stroke-dasharray:3 7}
.construct .lab{fill:#EDEBE6;font-family:GMono;font-size:18px}.construct .dimtxt{fill:#8E8B85;font-size:13px;letter-spacing:2px}
.sym-3d{display:grid;place-items:center;background:radial-gradient(ellipse at 50% 45%,#1d1810,#07070A 70%);border:1.5px solid #24242A;border-radius:28px;height:600px}
.sym-3d img{width:72%}
.tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:20px}
.tile{border:1.5px solid #24242A;border-radius:22px;overflow:hidden;display:grid;grid-template-rows:1fr auto;height:300px}
.ta{display:grid;place-items:center;padding:36px}.ta img{max-height:96px;max-width:100%}
.tile figcaption{font-size:19px;padding:12px 20px;color:#8E8B85;border-top:1px solid rgba(140,140,140,.22)}
.tile figcaption.onl{color:#5E5B55}
.tile[style*="#B07A1E"] figcaption{color:#FFF6E0}
.usage{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:start}
.cs{display:grid;gap:24px}.cs p{font-size:26px;line-height:1.5;color:#CFCBC2;font-weight:300}
.cs-box{padding:40px;background:#111114;border:1.5px dashed rgba(231,182,79,.5);border-radius:22px;display:grid;place-items:center}.cs-box img{height:110px}
.mins{display:flex;gap:48px;align-items:flex-end}.mins div{display:grid;gap:10px;justify-items:center}.mins span{font-size:18px;color:#8E8B85}
.donts{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.donts figure{border:1.5px solid #24242A;border-radius:22px;overflow:hidden;background:#111114}
.da{height:180px;display:grid;place-items:center;overflow:hidden;padding:24px}.da img{max-height:64px}
.donts figcaption{font-size:22px;padding:14px 20px;border-top:1px solid #24242A;color:#CFCBC2}.donts b{color:#FF5A5F}
.sws{display:grid;grid-template-columns:repeat(6,1fr);gap:18px}
.sw{border:1.5px solid #24242A;border-radius:22px;overflow:hidden;background:#111114}
.chip{height:170px;border-bottom:1px solid #24242A}
.swm{padding:18px 20px 22px;display:grid;gap:4px}.swm b{font-size:28px;font-weight:700}.swm .en{font-family:Arch;font-stretch:125%;font-weight:700;font-size:14px;letter-spacing:.1em;color:#8E8B85;text-transform:uppercase}
.swm .mono{font-size:18px;color:#E7B64F;text-align:right}.swm p{font-size:19px;color:#CFCBC2}
.molten{height:110px;border-radius:22px;background:linear-gradient(100deg,#FFF1C9 0%,#F2C14E 28%,#B07A1E 58%,#F7D98B 80%,#C9922E 100%);display:flex;justify-content:space-between;align-items:flex-end;padding:18px 26px;color:#140E04;font-size:18px;font-weight:600}
.sig{display:flex;gap:44px;font-size:22px;color:#CFCBC2;align-items:center}.sig i{display:inline-block;width:22px;height:22px;border-radius:6px;margin-inline-end:12px;vertical-align:-4px}.sig .note{color:#8E8B85}
.specs{display:grid;gap:18px}
.spec{display:grid;grid-template-columns:330px 1fr;gap:30px;align-items:center;background:#111114;border:1.5px solid #24242A;border-radius:22px;padding:26px 34px}
.who b{display:block;font-size:26px}.who span{font-size:19px;color:#8E8B85}
.s-he{font-size:84px;line-height:1;letter-spacing:-.035em}
.s-body{font-size:32px;font-weight:400;color:#CFCBC2}
.s-lat{font-family:Arch;font-stretch:125%;font-weight:800;font-size:64px;direction:ltr;text-align:right}
.s-mono{font-family:GMono;font-size:44px;color:#E7B64F;direction:ltr;text-align:right}
.free{font-size:22px;color:#8E8B85}
.gl{display:grid;grid-template-columns:1.25fr 1fr;gap:44px;align-items:center}
.gl-hero img{width:100%;border-radius:22px;border:1.5px solid #24242A}
.gl-list{display:grid;gap:26px}.gl-list div{border-top:1.5px solid #2A2A30;padding-top:18px}.gl-list h3{font-size:34px;font-weight:700}.gl-list p{font-size:24px;color:#CFCBC2;font-weight:300}
.voice{display:grid;grid-template-columns:1fr 1fr 1.4fr;gap:24px}
.vc{background:#111114;border:1.5px solid #24242A;border-radius:22px;padding:34px}
.vc h3{font-size:32px;margin-bottom:18px;font-weight:700}.vc ul{list-style:none;display:grid;gap:14px}.vc li{font-size:26px;padding-inline-start:26px;position:relative}
.vc li::before{content:"";position:absolute;inset-inline-start:0;top:.55em;width:10px;height:10px;border-radius:50%;background:#3DDC97}
.vc.no li::before{background:#FF5A5F}
.vc.desc p{font-size:24px;line-height:1.6;color:#EDEBE6}.vc .small{font-size:19px;color:#8E8B85}
.row4{display:grid;grid-template-columns:repeat(4,1fr);gap:28px;align-items:start;flex:1;min-height:0}
.bn{display:grid;gap:12px;min-width:0}
.bn img{width:100%;border-radius:18px;border:1.5px solid #24242A;display:block}
.bn figcaption{display:flex;justify-content:space-between;font-size:20px;color:#CFCBC2}.bn figcaption .mono{color:#8E8B85;font-size:17px}
.row4 .bn img{height:560px;object-fit:cover;object-position:top}
.signals .row4 .bn img{height:500px}
.covers{display:flex;gap:28px;align-items:flex-start}.covers .bn img{height:250px;width:auto;max-width:none}
.cv-side{display:grid;gap:24px}
.cv-main .bn img{height:auto}
.hls{display:flex;gap:44px;justify-content:flex-start;margin-top:-8px}
.hl{display:grid;gap:8px;justify-items:center;font-size:18px;color:#CFCBC2}.hl img{width:120px;height:120px;border-radius:50%;object-fit:cover}
.lp{display:grid;grid-template-columns:repeat(3,1fr) 0.42fr 0.42fr;gap:22px;align-items:start}
.lp figure{display:grid;gap:10px}.lp img{width:100%;border-radius:16px;border:1.5px solid #24242A;display:block}
.lp figcaption{font-size:20px;color:#CFCBC2}
.closing{padding:0}
.close-a{position:absolute;left:120px;top:210px;width:720px}
.close-copy{position:absolute;right:120px;top:110px;bottom:100px;width:860px;display:flex;flex-direction:column;gap:30px}
.close-copy h2{font-size:104px;line-height:1;letter-spacing:-.035em;font-weight:400}
.files{list-style:none;display:grid;gap:0;margin-top:8px}
.files li{display:flex;justify-content:space-between;gap:24px;font-size:26px;padding:16px 0;border-bottom:1.5px solid #24242A}.files .mono{color:#E7B64F;font-size:20px}
.disc{font-size:20px;color:#8E8B85}
.close-wm{height:40px;align-self:flex-start;margin-top:auto}
'''
html = f'<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>AURO · זהות מותג</title><style>{CSS}</style></head><body>{"".join(slides)}</body></html>'
open(os.path.join(OUT, 'index.html'), 'w').write(html)
print(len(slides), 'slides')
