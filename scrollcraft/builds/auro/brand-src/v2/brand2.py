"""AURO logo system. Wordmark = the Ingot A (symbol) + URO set in Archivo Expanded 800, all outlined."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import outline; outline.FONTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fonts')
from outline import face, text_path
import mark

C = dict(onyx='#07070A', carbon='#111114', steel='#2A2A30', bone='#EDEBE6', ash='#8E8B85',
         aurum='#E7B64F', deep='#9C6A16', mint='#3DDC97', coral='#FF5A5F')
LAT = ('Archivo.ttf', 800, {'wdth': 125})
HEB = ('Heebo.ttf', 400, {})

def grad(gid, deep=False):
    stops = ([('0', '#F3D27A'), ('.35', '#C8901F'), ('.62', '#8A5A0E'), ('.82', '#D9A93E'), ('1', '#6E4508')] if deep else
             [('0', '#FFF1C9'), ('.32', '#F2C14E'), ('.6', '#B07A1E'), ('.8', '#F7D98B'), ('1', '#8A5A12')])
    return f'<linearGradient id="{gid}" x1="0" y1="0" x2="1" y2="1">' + ''.join(f'<stop offset="{o}" stop-color="{c}"/>' for o, c in stops) + '</linearGradient>'

def svg(w, h, body, defs='', title='AURO'):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.2f} {h:.2f}" width="{w:.0f}" height="{h:.0f}">'
            f'<title>{title}</title><defs>{defs}</defs>{body}</svg>')

CAP = 100.0
def wordmark_parts():
    f = face(LAT[0], LAT[1], **LAT[2])
    size = CAP / (f.cap / f.upem)
    k = CAP / mark.H
    a_w = mark.B * k
    gap = .075 * size
    d_txt, adv, bb = text_path(f, 'URO', size, 0, 0, .035)
    x0 = a_w + gap - bb[0]
    d_txt, adv, bb = text_path(f, 'URO', size, x0, CAP, .035)
    return bb[2], CAP, [(mark.d(0, 0, k), 'sym'), (d_txt, 'word')]

def lockup_desc():
    W, H, parts = wordmark_parts()
    h = face(HEB[0], HEB[1], **HEB[2])
    size = 30
    _, _, bb = text_path(h, 'קהילת מסחר בזהב', size, 0, 0, .02)
    tw = bb[2] - bb[0]
    y = H + 46
    d, _, _ = text_path(h, 'קהילת מסחר בזהב', size, W - tw - bb[0], y, .02)
    return W, y + 8, parts + [(d, 'desc')]

def symbol():
    return mark.B, mark.H, [(mark.d(), 'sym')]

def paint(spec, theme, gid='g', pad=0):
    W, H, parts = spec
    if theme == 'dark':   fills, defs = dict(sym=f'url(#{gid})', word=C['bone'], desc=C['ash']), grad(gid)
    elif theme == 'light': fills, defs = dict(sym=f'url(#{gid})', word=C['onyx'], desc='#5E5B55'), grad(gid, True)
    elif theme == 'gold':  fills, defs = dict(sym=C['aurum'], word=C['aurum'], desc=C['aurum']), ''
    elif theme == 'black': fills, defs = dict(sym=C['onyx'], word=C['onyx'], desc=C['onyx']), ''
    elif theme == 'white': fills, defs = dict(sym='#FFFFFF', word='#FFFFFF', desc='#FFFFFF'), ''
    body = ''.join(f'<path d="{d}" fill="{fills[r]}"/>' for d, r in parts)
    if pad:
        body = f'<g transform="translate({pad} {pad})">{body}</g>'
    return svg(W + 2 * pad, H + 2 * pad, body, defs)

if __name__ == '__main__':
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    specs = {'auro-wordmark': wordmark_parts(), 'auro-lockup': lockup_desc(), 'auro-symbol': symbol()}
    for n, sp in specs.items():
        for th in ['dark', 'light', 'gold', 'black', 'white']:
            open(f'{out}/{n}-{th}.svg', 'w').write(paint(sp, th, pad=0))
    # flat app icon
    S_ = 1080; k = 560 / mark.H
    d = mark.d(S_ / 2 - mark.B * k / 2, S_ / 2 - mark.H * k / 2 - 10, k)
    defs = grad('g') + '<radialGradient id="glow" cx="50%" cy="42%" r="62%"><stop offset="0" stop-color="#2A2112"/><stop offset=".5" stop-color="#121014"/><stop offset="1" stop-color="#07070A"/></radialGradient>'
    open(f'{out}/auro-app-icon.svg', 'w').write(svg(S_, S_, f'<rect width="{S_}" height="{S_}" rx="240" fill="url(#glow)"/><path d="{d}" fill="url(#g)"/>', defs))
    print('ok')
