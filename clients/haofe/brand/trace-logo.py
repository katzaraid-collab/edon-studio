"""Vectorize the HaOfe logo: rings as exact circles, wheat/letters traced per colour with potrace."""
import sys, numpy as np
from PIL import Image, ImageFilter
import potrace
from scipy import ndimage as ndi

SRC, OUT = sys.argv[1], sys.argv[2]
UP = 4                                   # trace at 2048px for smoother curves
CAR, CHO = '#B0702A', '#451804'
CX, CY = 254.75, 255.0                   # measured ring centre (in 512 space)
RINGS = [(229.2, 9.2), (240.0, 3.4)]     # (radius, stroke width)

im = Image.open(SRC).convert('RGB').resize((512*UP, 512*UP), Image.LANCZOS)
a = np.asarray(im).astype(float)
L = 0.2126*a[...,0] + 0.7152*a[...,1] + 0.0722*a[...,2]
fg = L < 205
centres = np.array([[183,124,61],[76,30,6]], float)
d = ((a[...,None,:]-centres[None,None])**2).sum(-1)
lab = d.argmin(-1)
car = fg & (lab == 0); cho = fg & (lab == 1)

yy, xx = np.mgrid[0:512*UP, 0:512*UP]
r = np.hypot(xx/UP - CX, yy/UP - CY)
car &= r < 219                           # rings are drawn as circles instead
car &= ~ndi.binary_dilation(cho, iterations=2*UP)   # drop the light anti-aliased fringe around the chocolate letters

def clean(mask, hole_px, speck_px):
    mask = ndi.binary_fill_holes(mask) & ~ (ndi.binary_fill_holes(mask) & ~mask & (lambda l: np.isin(l, [i for i, s in enumerate(ndi.sum(np.ones_like(l), l, range(l.max()+1))) if s > hole_px]))(ndi.label(ndi.binary_fill_holes(mask) & ~mask)[0]))
    lab_, n = ndi.label(mask); sizes = ndi.sum(mask, lab_, range(1, n+1))
    return np.isin(lab_, [i+1 for i, s in enumerate(sizes) if s >= speck_px])

def smooth(mask, rad=1.2):
    im_ = Image.fromarray((mask*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(rad))
    return np.asarray(im_) > 127

def trace(mask):
    bm = potrace.Bitmap(~mask)   # potracer fills pixels below its black level, so the shape must be 0
    path = bm.trace(turdsize=6, turnpolicy=potrace.POTRACE_TURNPOLICY_MINORITY, alphamax=1.0, opticurve=True, opttolerance=0.25)
    f = lambda p: f'{p.x/UP:.2f} {p.y/UP:.2f}'
    parts = []
    for curve in path:
        s = [f'M{f(curve.start_point)}']
        for seg in curve:
            s.append(f'L{f(seg.c)} L{f(seg.end_point)}' if seg.is_corner else f'C{f(seg.c1)} {f(seg.c2)} {f(seg.end_point)}')
        parts.append(' '.join(s) + 'Z')
    return ' '.join(parts)

def rings(colour):
    return '\n    '.join(f'<circle cx="{CX}" cy="{CY}" r="{rr}" fill="none" stroke="{colour}" stroke-width="{w}"/>' for rr, w in RINGS)

def svg(car_d, cho_d, car_fill=CAR, cho_fill=CHO, ring=CAR, bg=None, title='האופה · בוטיק לחם'):
    bgel = f'\n  <circle id="disc" cx="{CX}" cy="{CY}" r="{RINGS[1][0]+RINGS[1][1]/2+6:.1f}" fill="{bg}"/>' if bg else ''
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="{title}">
  <title>{title}</title>{bgel}
  <g id="rings">
    {rings(ring)}
  </g>
  <g id="wheat-and-tagline" fill="{car_fill}" fill-rule="evenodd">
    <path d="{car_d}"/>
  </g>
  <g id="wordmark" fill="{cho_fill}" fill-rule="evenodd">
    <path d="{cho_d}"/>
  </g>
</svg>
'''

variants = {}
# faithful: keep the printed texture (holes) but drop single-pixel noise
car_t, cho_t = trace(smooth(clean(car, 0, 5*UP*UP), 1.0)), trace(smooth(clean(cho, 0, 5*UP*UP), 1.0))
# clean: fill texture holes for small sizes and easy editing
# the tagline (below y=390) has real letter counters, e.g. the final mem, so holes are filled only in the wheat area
car_clean = np.where(yy < 390*UP, clean(car, 99999999, 5*UP*UP), clean(car, 0, 5*UP*UP))
car_c, cho_c = trace(smooth(car_clean, 1.6)), trace(smooth(clean(cho, 99999999, 5*UP*UP), 1.6))
open(f'{OUT}/haofe-logo.svg', 'w').write(svg(car_t, cho_t))
open(f'{OUT}/haofe-logo-clean.svg', 'w').write(svg(car_c, cho_c))
open(f'{OUT}/haofe-logo-badge.svg', 'w').write(svg(car_t, cho_t, bg='#FFFFFF'))
open(f'{OUT}/haofe-logo-mono-chocolate.svg', 'w').write(svg(car_c, cho_c, CHO, CHO, CHO))
open(f'{OUT}/haofe-logo-mono-cream.svg', 'w').write(svg(car_c, cho_c, '#F7F1E6', '#F7F1E6', '#F7F1E6'))
for n in ['haofe-logo', 'haofe-logo-clean', 'haofe-logo-badge', 'haofe-logo-mono-chocolate', 'haofe-logo-mono-cream']:
    import os; print(n, os.path.getsize(f'{OUT}/{n}.svg')//1024, 'KB')

# ---------- animated version: each element in its own group so it can be choreographed ----------
car_f = smooth(clean(car, 0, 5*UP*UP), 1.0)
cho_f = smooth(clean(cho, 0, 5*UP*UP), 1.0)
Y, X = yy/UP, xx/UP
parts = {
    'stalk-1': car_f & (Y < 236) & (X < 205),
    'stalk-2': car_f & (Y < 236) & (X >= 205) & (X < 300),
    'stalk-3': car_f & (Y < 236) & (X >= 300),
    'hill':    car_f & (Y >= 236) & (Y < 280),
    'tagline': car_f & (Y >= 380),
}
paths = {k: trace(v) for k, v in parts.items()}
word = trace(cho_f)
circ = lambda i, rr, w: f'<circle class="ring ring-{i}" cx="{CX}" cy="{CY}" r="{rr}" fill="none" stroke="{CAR}" stroke-width="{w}" pathLength="1" transform="rotate(-90 {CX} {CY})"/>'
anim = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="האופה · בוטיק לחם">
  <title>האופה · בוטיק לחם</title>
  <style>
    /* 4.8s loop: rings draw, wheat grows from the hill, the wordmark is stamped, the tagline settles, hold, fade, repeat */
    svg {{ --loop: 4.8s; }}
    .ring {{ stroke-dasharray: 1 1; animation: draw var(--loop) cubic-bezier(.65,0,.35,1) infinite; }}
    .ring-1 {{ animation-name: draw1; }}
    .stalk, .hill, .word, .tag {{ transform-box: fill-box; animation-duration: var(--loop); animation-iteration-count: infinite; animation-fill-mode: both; }}
    .hill {{ transform-origin: 50% 50%; animation-name: hill; animation-timing-function: cubic-bezier(.16,1,.3,1); }}
    .stalk {{ transform-origin: 50% 100%; animation-name: grow; animation-timing-function: cubic-bezier(.34,1.3,.64,1); }}
    #stalk-3 {{ animation-name: grow3; }} #stalk-1 {{ animation-name: grow1; }}
    .word {{ transform-origin: 50% 50%; animation-name: stamp; animation-timing-function: cubic-bezier(.34,1.3,.64,1); }}
    .tag {{ transform-origin: 50% 50%; animation-name: tag; animation-timing-function: cubic-bezier(.16,1,.3,1); }}
    @keyframes draw  {{ 0% {{ stroke-dashoffset: 1; opacity: 1 }} 18% {{ stroke-dashoffset: 0 }} 90% {{ stroke-dashoffset: 0; opacity: 1 }} 100% {{ stroke-dashoffset: 0; opacity: 0 }} }}
    @keyframes draw1 {{ 0%, 4% {{ stroke-dashoffset: -1; opacity: 1 }} 22% {{ stroke-dashoffset: 0 }} 90% {{ stroke-dashoffset: 0; opacity: 1 }} 100% {{ stroke-dashoffset: 0; opacity: 0 }} }}
    @keyframes hill  {{ 0%, 12% {{ opacity: 0; transform: scaleX(.2) }} 24% {{ opacity: 1; transform: none }} 90% {{ opacity: 1 }} 100% {{ opacity: 0 }} }}
    @keyframes grow  {{ 0%, 18% {{ opacity: 0; transform: scaleY(0) }} 21% {{ opacity: 1 }} 34% {{ transform: none }} 62% {{ transform: rotate(-1.5deg) }} 78% {{ transform: rotate(1deg) }} 90% {{ opacity: 1; transform: none }} 100% {{ opacity: 0 }} }}
    @keyframes grow3 {{ 0%, 22% {{ opacity: 0; transform: scaleY(0) }} 25% {{ opacity: 1 }} 38% {{ transform: none }} 64% {{ transform: rotate(-1.5deg) }} 80% {{ transform: rotate(1deg) }} 90% {{ opacity: 1; transform: none }} 100% {{ opacity: 0 }} }}
    @keyframes grow1 {{ 0%, 26% {{ opacity: 0; transform: scaleY(0) }} 29% {{ opacity: 1 }} 42% {{ transform: none }} 66% {{ transform: rotate(-1.5deg) }} 82% {{ transform: rotate(1deg) }} 90% {{ opacity: 1; transform: none }} 100% {{ opacity: 0 }} }}
    @keyframes stamp {{ 0%, 36% {{ opacity: 0; transform: scale(1.35) rotate(-3deg) }} 44% {{ opacity: 1; transform: scale(.97) }} 48% {{ transform: none }} 90% {{ opacity: 1 }} 100% {{ opacity: 0 }} }}
    @keyframes tag   {{ 0%, 46% {{ opacity: 0; transform: translateY(8px) }} 56% {{ opacity: 1; transform: none }} 90% {{ opacity: 1 }} 100% {{ opacity: 0 }} }}
    @media (prefers-reduced-motion: reduce) {{ * {{ animation: none !important; stroke-dasharray: none !important; }} }}
  </style>
  <g id="rings">{circ(0, *RINGS[0])}{circ(1, *RINGS[1])}</g>
  <g fill="{CAR}" fill-rule="evenodd">
    <path id="hill" class="hill" d="{paths['hill']}"/>
    <path id="stalk-2" class="stalk" d="{paths['stalk-2']}"/>
    <path id="stalk-3" class="stalk" d="{paths['stalk-3']}"/>
    <path id="stalk-1" class="stalk" d="{paths['stalk-1']}"/>
    <path id="tagline" class="tag" d="{paths['tagline']}"/>
  </g>
  <path id="wordmark" class="word" fill="{CHO}" fill-rule="evenodd" d="{word}"/>
</svg>
'''
open(f'{OUT}/haofe-logo-animated.svg', 'w').write(anim)
print('haofe-logo-animated', os.path.getsize(f'{OUT}/haofe-logo-animated.svg')//1024, 'KB')
