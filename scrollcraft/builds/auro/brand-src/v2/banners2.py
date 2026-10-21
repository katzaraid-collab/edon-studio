"""AURO banners: every file at its platform's exact pixels. render.js turns the pages into PNGs."""
import os, json, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import chart2, brand2, mark
OUT = os.path.join(HERE, 'html'); os.makedirs(OUT, exist_ok=True)
L = '../out/logo/svg/'; D3 = '../out/3d/'
DISC = 'מסחר בזהב כרוך בסיכון. התוכן בקהילה אינו ייעוץ השקעות ואינו מבטיח רווח.'
jobs = []

def page(name, w, h, inner, css=''):
    open(f'{OUT}/{name}.html', 'w').write(
        f'<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><link rel="stylesheet" href="../kit.css"><style>{css}</style></head>'
        f'<body><div class="art grain" style="width:{w}px;height:{h}px">{inner}</div></body></html>')
    jobs.append([f'html/{name}.html', f'out/banners/{name}.png', w, h])

def sym(hpx, gid):
    return (f'<svg viewBox="0 0 {mark.B} {mark.H}" height="{hpx}" width="{hpx*mark.B/mark.H:.1f}"><defs>{brand2.grad(gid)}</defs>'
            f'<path d="{mark.d()}" fill="url(#{gid})"/></svg>')

def footer(extra=''):
    return f'''<div style="display:flex;justify-content:space-between;align-items:center;gap:30px">
      <img src="{L}auro-wordmark-dark.svg" style="height:34px">
      <p class="disc" style="font-size:18px;text-align:left;max-width:600px">{extra}{DISC}</p></div>'''

# 1 ── WhatsApp group icon
page('whatsapp-group-icon', 1080, 1080, f'''
<div class="halo" style="width:980px;height:980px;left:50px;top:40px"></div>
<div class="abs" style="inset:0;display:grid;place-items:center"><img src="{D3}a-front.png" style="width:700px;margin-top:-10px"></div>''')

# 2 ── Launch post
chips = ''.join(f'<span class="chip"><span class="dot"></span>{t}</span>' for t in ['רעיונות לעסקאות', 'ניתוחי שוק', 'למידה משותפת'])
page('post-launch', 1080, 1350, f'''
<div class="dots"></div>
<div class="halo" style="width:900px;height:760px;left:90px;top:40px"></div>
<div class="abs" style="top:64px;right:72px;left:72px;display:flex;justify-content:space-between;align-items:center">
  <img src="{L}auro-wordmark-dark.svg" style="height:38px"><span class="label">GOLD · XAU/USD</span></div>
<img class="abs" src="{D3}a-hero.png" style="width:540px;left:270px;top:150px">
<div class="abs" style="right:72px;left:72px;bottom:64px;display:flex;flex-direction:column;gap:30px">
  <h1 class="h" style="font-size:136px"><span class="hl">סוחרים בזהב.</span><br><span class="gold">צומחים ביחד.</span></h1>
  <p style="font-size:33px;line-height:1.45;color:#CFCBC2;max-width:860px;font-weight:400">קהילת וואטסאפ לסוחרי זהב. רעיונות לעסקאות, ניתוחי שוק ולמידה משותפת, עם משמעת ובלי רעש.</p>
  <div style="display:flex;gap:14px;flex-wrap:wrap">{chips}</div>
  <div class="rule"></div>
  <p class="disc" style="font-size:19px">{DISC}</p>
</div>''')

# 3 ── Why the name
def why(token, title, body, lat=True):
    tok = (f'<span class="lat gold" style="font-size:118px;font-weight:800;line-height:1;direction:ltr">{token}</span>' if lat else
           f'<span class="h gold" style="font-size:132px;line-height:1">{token}</span>')
    return f'''<div class="glass" style="display:grid;grid-template-columns:1fr 290px;align-items:center;gap:28px;padding:34px 40px">
      <div><h3 class="h" style="font-size:48px">{title}</h3><p style="font-size:28px;line-height:1.45;color:#CFCBC2;margin-top:10px;font-weight:400">{body}</p></div>
      <div style="text-align:left">{tok}</div></div>'''
page('post-why-the-name', 1080, 1350, f'''
<div class="dots" style="-webkit-mask-image:radial-gradient(ellipse 80% 50% at 50% 10%,#000,transparent 70%)"></div>
<div class="halo" style="width:800px;height:700px;left:-260px;top:-240px"></div>
<div class="abs" style="inset:72px;display:flex;flex-direction:column;gap:22px">
  <span class="label">THE NAME</span>
  <h1 class="h" style="font-size:118px;margin:4px 0 22px"><span class="hl">למה</span> <span class="lat gold" style="font-weight:800;font-size:.86em;letter-spacing:0">AURO</span>?</h1>
  {why('Au', 'זהב, בכימיה', 'הסמל של זהב בטבלה המחזורית. היסוד ה־79.')}
  {why('Oro', 'זהב, בעולם', 'כך קוראים לזהב בספרדית ובאיטלקית.')}
  {why('אור', 'אור, בעברית', 'ככה קהילה צריכה להרגיש: ברורה, פתוחה ומאירה את הדרך.', False)}
  <div style="display:flex;align-items:center;gap:30px;padding:26px 8px 0">
    {sym(110, 'wn')}<p style="font-size:28px;line-height:1.45;color:#CFCBC2;font-weight:400"><b style="color:var(--bone);font-weight:600">וה־A?</b> מטיל זהב שיושב על פסגה. הקו שביניהם הוא רמת מחיר, והפסגה מחזיקה את המטיל, כמו קהילה.</p></div>
  <div style="margin-top:auto">{footer()}</div>
</div>''')

# 4 ── Welcome + rules
rules = ['כבוד הדדי. ביקורת עניינית, בלי עלבונות ובלי ויכוחים אישיים.',
         'בלי פרסום, קישורים זרים או פניות פרטיות שלא ביקשו.',
         'כל עסקה היא החלטה שלך. בודקים, מחשבים סיכון ורק אז נכנסים.',
         'אין שאלה טיפשית. מי ששואל לומד, ומי שעונה מתחזק.',
         'משתפים גם הפסדים. ככה כולנו לומדים מהר יותר.']
lis = ''.join(f'''<li style="display:grid;grid-template-columns:80px 1fr;gap:18px;align-items:baseline;padding:30px 0;{'border-top:1.5px solid rgba(255,255,255,.08)' if i else ''}">
  <span class="mono gold" style="font-size:32px;font-weight:600">0{i+1}</span><span style="font-size:33px;line-height:1.42;text-wrap:balance">{r}</span></li>''' for i, r in enumerate(rules))
page('post-welcome-rules', 1080, 1350, f'''
<div class="halo" style="width:900px;height:800px;right:-380px;top:-300px"></div>
<img class="abs" src="{D3}a-left.png" style="width:200px;left:66px;top:58px;opacity:.95">
<div class="abs" style="inset:72px;display:flex;flex-direction:column">
  <span class="label">WELCOME</span>
  <h1 class="h" style="font-size:132px;margin:34px 0 46px"><span class="hl">ברוכים הבאים</span><br><span class="gold">ל־<span class="lat" style="font-weight:800;font-size:.8em">AURO</span></span></h1>
  <div class="glass" style="padding:14px 40px"><ol style="list-style:none">{lis}</ol></div>
  <div style="margin-top:auto">{footer()}</div>
</div>''')

# 5 ── Signal cards (app widget)
def mini(side, filled):
    w, h = 856, 250
    buy = side == 'buy'
    ys = dict(tp2=40, tp1=92, entry=150, sl=212) if buy else dict(sl=40, entry=100, tp1=158, tp2=210)
    col = dict(tp2='#3DDC97', tp1='#3DDC97', entry='#EDEBE6', sl='#FF5A5F')
    lab = dict(tp2='TP2', tp1='TP1', entry='ENTRY', sl='SL')
    lines = ''.join(f'<line x1="0" x2="{w-90}" y1="{y}" y2="{y}" stroke="{col[k]}" stroke-opacity="{.75 if k=="entry" else .55}" stroke-width="2" stroke-dasharray="{"0" if k=="entry" else "4 8"}"/>'
                    f'<text x="{w}" y="{y+6}" text-anchor="end" font-family="GMono" font-size="17" fill="{col[k]}" letter-spacing="2">{lab[k]}</text>' for k, y in ys.items())
    e = ys['entry']
    if buy:
        path = f'M0,{e-70} C70,{e-80} 110,{e-30} 170,{e-20} S260,{e+28} 330,{e+10} S420,{e-6} 470,{e} S560,{e-40} 620,{e-60} S700,{ys["tp1"]-10} 740,{ys["tp1"]+4}'
    else:
        path = f'M0,{e+70} C70,{e+80} 110,{e+30} 170,{e+20} S260,{e-28} 330,{e-10} S420,{e+6} 470,{e} S560,{e+40} 620,{e+60} S700,{ys["tp1"]+10} 740,{ys["tp1"]-4}'
    pl = f'<path d="{path}" fill="none" stroke="#F2C14E" stroke-width="3.5" stroke-linecap="round"/><circle cx="470" cy="{e}" r="9" fill="#07070A" stroke="#EDEBE6" stroke-width="2.5"/>' if filled else ''
    return f'<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}" style="direction:ltr;overflow:visible">{lines}{pl}</svg>'

def signal(name, side, vals, note, stamp, example):
    buy = side == 'buy'
    col = 'var(--mint)' if buy else 'var(--coral)'
    tint = 'rgba(61,220,151,.12)' if buy else 'rgba(255,90,95,.12)'
    def tile(he, en, v, c):
        val = (f'<div class="mono" style="font-size:46px;font-weight:500;color:{c};margin-top:10px">{v}</div>' if v else
               '<div style="height:2px;margin-top:44px;background:repeating-linear-gradient(90deg,rgba(255,255,255,.3) 0 10px,transparent 10px 18px)"></div>')
        return f'<div class="glass" style="border-radius:24px;padding:22px 26px;box-shadow:none"><div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-size:27px;font-weight:600">{he}</span><span class="label" style="font-size:14px">{en}</span></div>{val}</div>'
    tiles = (tile('כניסה', 'ENTRY', vals[0], 'var(--bone)') + tile('סטופ לוס', 'STOP', vals[1], 'var(--coral)') +
             tile('יעד ראשון', 'TP1', vals[2], 'var(--mint)') + tile('יעד שני', 'TP2', vals[3], 'var(--mint)'))
    ex = '<span class="chip" style="font-size:16px;padding:6px 14px;font-family:GMono;letter-spacing:.14em">EXAMPLE · דוגמה</span>' if example else ''
    rr = (f'<span class="mono gold" style="font-size:38px;font-weight:600">{vals[4]}</span>' if vals[4] else
          '<span style="display:inline-block;width:160px;height:2px;background:repeating-linear-gradient(90deg,rgba(255,255,255,.3) 0 10px,transparent 10px 18px)"></span>')
    notes = (f'<p style="font-size:26px;line-height:1.45;color:#CFCBC2;font-weight:400">{note}</p>' if note else
             '<div style="height:2px;margin-top:30px;background:repeating-linear-gradient(90deg,rgba(255,255,255,.22) 0 10px,transparent 10px 18px)"></div>')
    page(name, 1080, 1350, f'''
<div class="halo" style="width:900px;height:700px;left:-300px;top:-260px;opacity:.8"></div>
<div class="abs" style="inset:60px 64px 56px;display:flex;flex-direction:column;gap:26px">
  <div style="display:flex;justify-content:space-between;align-items:center">
    <img src="{L}auro-wordmark-dark.svg" style="height:36px">
    <div style="display:flex;gap:14px;align-items:center">{ex}<span class="mono" style="font-size:22px;color:var(--ash)">{stamp}</span></div>
  </div>
  <div class="glass" style="padding:40px 44px;display:flex;flex-direction:column;gap:26px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div><span class="label" style="font-size:16px">איתות · SIGNAL</span>
        <div class="lat" style="font-size:96px;font-weight:800;line-height:1;margin-top:14px;direction:ltr;letter-spacing:-.01em">XAU/USD</div>
        <div style="font-size:26px;color:var(--ash);margin-top:8px">זהב מול דולר</div></div>
      <div style="text-align:center;border-radius:26px;padding:18px 30px;background:{tint};border:2px solid {col};color:{col}">
        <div class="lat" style="font-size:44px;font-weight:800;letter-spacing:.04em;direction:ltr">{'BUY' if buy else 'SELL'}</div>
        <div style="font-size:24px;font-weight:600;margin-top:2px">{'קנייה' if buy else 'מכירה'}</div></div>
    </div>
    {mini(side, example)}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">{tiles}</div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 6px 0">
      <span style="font-size:27px;font-weight:600">סיכון מול סיכוי</span>{rr}</div>
  </div>
  <div style="padding:0 6px"><span class="label" style="font-size:15px">הערות · NOTES</span><div style="margin-top:10px">{notes}</div></div>
  <div style="margin-top:auto;display:flex;align-items:center;gap:18px">{sym(40, 'sg'+side)}<p class="disc" style="font-size:17.5px">כל עסקה היא החלטה אישית. נהלו סיכון לפי התיק שלכם. {DISC}</p></div>
</div>''')
signal('signal-buy-example', 'buy', ['4,108.50', '4,092.00', '4,125.00', '4,141.50', '1 : 2.0'],
       'כניסה אחרי סגירת נר שעה מעל 4,105. ביעד הראשון מזיזים את הסטופ לנקודת הכניסה.', '21.10 · 14:30', True)
signal('signal-buy-blank', 'buy', [''] * 5, '', '__.__ · __:__', False)
signal('signal-sell-blank', 'sell', [''] * 5, '', '__.__ · __:__', False)

# 6 ── Story / status
feats = ''.join(f'<div style="display:flex;align-items:center;gap:22px;padding:24px 30px;{"border-top:1.5px solid rgba(255,255,255,.08)" if i else ""}"><span class="dot" style="width:14px;height:14px"></span><span style="font-size:38px">{t}</span></div>'
                for i, t in enumerate(['רעיונות לעסקאות בזהב', 'ניתוחי שוק ולמידה', 'קהילה שמפרגנת']))
page('story-join', 1080, 1920, f'''
<div class="dots" style="-webkit-mask-image:radial-gradient(ellipse 80% 40% at 50% 25%,#000,transparent 70%)"></div>
<div class="halo" style="width:1100px;height:950px;left:-10px;top:160px"></div>
<img class="abs" src="{D3}a-hero.png" style="width:540px;left:270px;top:215px">
<div class="abs" style="top:720px;right:84px;left:84px;display:flex;flex-direction:column;gap:28px">
  <h1 class="h" style="font-size:156px"><span class="gold">הצטרפו</span><br><span class="hl">לקהילה</span></h1>
  <p style="font-size:38px;line-height:1.4;color:#CFCBC2;font-weight:400">סוחרי זהב שלומדים, מנתחים ומתקדמים ביחד.</p>
  <div class="glass" style="padding:6px 0;border-radius:30px">{feats}</div>
</div>
<div class="abs" style="top:1478px;left:0;right:0;display:flex;justify-content:center">
  <span class="cta" style="font-size:40px;padding:28px 60px">הקישור לקבוצה בביו</span></div>
<p class="abs disc" style="top:1600px;left:90px;right:90px;text-align:center;font-size:21px">{DISC}</p>''')

# 7 ── Facebook cover 1640×624
page('facebook-cover', 1640, 624, f'''
<div class="dots"></div>
<div class="abs" style="left:0;right:0;bottom:-10px">{chart2.svg(1640, 330, rm=0, label=False, dim=.55, gid='fb', end_dot=False)}</div>
<img class="abs" src="{D3}drop-1.png" style="width:190px;left:120px;top:70px;opacity:.9;transform:rotate(-12deg)">
<img class="abs" src="{D3}drop-2.png" style="width:120px;right:150px;top:330px;opacity:.85">
<div class="abs" style="inset:0;background:radial-gradient(ellipse 600px 260px at 50% 46%,rgba(7,7,10,.92) 40%,transparent)"></div>
<div class="abs" style="inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:30px;padding-bottom:20px">
  <img src="{L}auro-wordmark-dark.svg" style="height:120px">
  <div class="h" style="font-size:50px"><span class="hl">סוחרים בזהב.</span> <span class="gold">צומחים ביחד.</span></div>
</div>''')

# 8 ── Link preview 1200×630
page('link-preview-og', 1200, 630, f'''
<div class="dots" style="-webkit-mask-image:radial-gradient(ellipse 50% 70% at 25% 50%,#000,transparent 75%)"></div>
<div class="halo" style="width:700px;height:640px;left:-60px;top:0"></div>
<img class="abs" src="{D3}a-hero.png" style="width:470px;left:60px;top:110px">
<div class="abs" style="right:72px;top:0;bottom:0;width:560px;display:flex;flex-direction:column;justify-content:center;gap:30px">
  <img src="{L}auro-wordmark-dark.svg" style="height:70px;align-self:flex-start">
  <div class="h" style="font-size:74px"><span class="hl">קהילת מסחר</span><br><span class="gold">בזהב.</span></div>
</div>''')

# 9 ── YouTube 2560×1440 (safe area 1546×423)
page('youtube-banner', 2560, 1440, f'''
<div class="dots" style="background-size:44px 44px"></div>
<div class="abs" style="left:0;right:0;top:720px">{chart2.svg(2560, 560, rm=0, label=False, dim=.5, gid='yt', stroke=5, end_dot=False)}</div>
<img class="abs" src="{D3}drop-1.png" style="width:300px;left:330px;top:300px;transform:rotate(-12deg)">
<img class="abs" src="{D3}drop-2.png" style="width:200px;right:420px;top:860px;opacity:.9">
<img class="abs" src="{D3}a-left.png" style="width:300px;right:300px;top:240px;opacity:.9">
<div class="abs" style="inset:0;background:radial-gradient(ellipse 900px 340px at 50% 50%,rgba(7,7,10,.94) 40%,transparent)"></div>
<div class="abs" style="inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:40px">
  <img src="{L}auro-wordmark-dark.svg" style="height:160px">
  <div class="h" style="font-size:70px"><span class="hl">סוחרים בזהב.</span> <span class="gold">צומחים ביחד.</span></div>
</div>''')

# 10 ── Instagram highlight covers
def icon(kind):
    g = brand2.grad('h' + kind)
    st = f'fill="none" stroke="url(#h{kind})" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"'
    if kind == 'about':
        return sym(380, 'h' + kind)
    body = {
        'signals': '<line x1="70" y1="120" x2="70" y2="270"/><rect x="46" y="160" width="48" height="70" rx="10"/>'
                   '<line x1="150" y1="64" x2="150" y2="236"/><rect x="126" y="96" width="48" height="104" rx="10"/>'
                   '<line x1="230" y1="20" x2="230" y2="196"/><rect x="206" y="46" width="48" height="112" rx="10"/>',
        'analysis': '<line x1="24" y1="196" x2="276" y2="196" stroke-dasharray="4 14"/>'
                    '<path d="M24 250 C70 240 90 120 130 120 C165 120 170 196 196 196 C228 196 240 70 276 40"/><circle cx="196" cy="196" r="12"/>',
        'community': '<circle cx="150" cy="104" r="40"/><path d="M82 252 C82 200 112 176 150 176 C188 176 218 200 218 252"/>'
                     '<circle cx="58" cy="132" r="26" stroke-opacity=".5"/><path d="M14 236 C14 204 32 186 58 186" stroke-opacity=".5"/>'
                     '<circle cx="242" cy="132" r="26" stroke-opacity=".5"/><path d="M286 236 C286 204 268 186 242 186" stroke-opacity=".5"/>',
        'faq': '<path d="M104 104 C104 70 126 48 152 48 C182 48 200 70 200 96 C200 140 150 136 150 182 L150 196"/><circle cx="150" cy="250" r="5" fill="url(#hfaq)"/>',
    }[kind]
    return f'<svg viewBox="0 0 300 300" width="380" height="380"><defs>{g}</defs><g {st}>{body}</g></svg>'
for kind in ['about', 'signals', 'analysis', 'community', 'faq']:
    page(f'highlight-{kind}', 1080, 1920, f'''
<div class="abs" style="inset:0;display:grid;place-items:center">
  <div class="glass" style="width:820px;height:820px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 50% 35%,rgba(242,193,78,.16),rgba(255,255,255,.03) 60%)">{icon(kind)}</div>
</div>''')

os.makedirs(os.path.join(HERE, 'out/banners'), exist_ok=True)
json.dump(jobs, open(os.path.join(HERE, 'jobs.json'), 'w'))
print(len(jobs))
