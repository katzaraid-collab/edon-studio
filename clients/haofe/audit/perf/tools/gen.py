"""Responsive variants for concepts/assets/ai -> concepts/assets/ai/r (+ manifest.json).

Rules
  widths   480, 800, 1200 kept only when <= source width; the source width itself is added when the
           largest kept width is < 85% of it (bag 748). plate also gets 1920 (= its source width)
           because its slot is 100vw on desktop. plate-m is an art-direction crop of plate.webp:
           exactly the region object-fit:cover + object-position:50% 100% shows in the 4/4.4
           mobile scene (.pb .scene below the 1000px container query).
  quality  per variant, the lowest quality on a fixed ladder whose SSIM (luma, 7x7) against the
           Lanczos-resized source reaches TARGET, scored on the worse of two composites
           (light #FFFCF6 and dark #221812 slot backgrounds), so cutout edges count in both modes.
  alpha    kept. WebP alpha lossless (alpha_quality 100) unless alpha_quality 70 or 50 is smaller AND still
           meets TARGET with mean alpha error <= 0.6/255. AVIF alpha at the same quality; for alpha
           images the encoder also tries a push-pull colour bleed under alpha==0 and keeps the
           smaller file (pixels under alpha 0 are invisible either way).
  lqip     longest side 16 px, Lanczos, WebP q40 (alpha kept), base64 data URI.
"""
import sys, os, json, base64, io, hashlib
sys.path.insert(0, os.path.dirname(__file__))
from PIL import Image, features
import PIL
import numpy as np
from imgq import resize, encode, decode, score, bleed

SRC = '/home/user/edon-studio/clients/haofe/concepts/assets/ai'
OUT = os.path.join(SRC, 'r')
TARGET = 0.975
WEBP_Q = [72, 75, 78, 80, 82, 85, 88, 90]
AVIF_Q = [40, 45, 50, 55, 60, 65, 70, 75]
os.makedirs(OUT, exist_ok=True)

USE = {
    'plate': 'hero background plane (.sc-plate), desktop >=1000px container',
    'plate-m': 'hero background plane (.sc-plate), mobile/tablet <1000px container (art-direction crop)',
    'bag': 'hero subject plane (.sc-bag-img)',
    'wheat': 'hero foreground plane (.sc-wheat)',
}


def widths_for(name, w):
    ws = [x for x in (480, 800, 1200) if x <= w]
    if not ws or ws[-1] < 0.85 * w:
        ws.append(w)
    if name == 'plate' and w not in ws:
        ws.append(w)
    return ws


def pick(ref, fmt, ladder, cand=None):
    """binary search on the ladder for the lowest q with ssim >= TARGET."""
    lo, hi, best = 0, len(ladder) - 1, None
    cache = {}

    def trial(i):
        if i in cache:
            return cache[i]
        q = ladder[i]
        b = encode(ref, fmt, q)
        variant = 'plain'
        if fmt == 'avif' and ref.mode == 'RGBA':
            b2 = encode(cand, fmt, q)
            if len(b2) < len(b):
                b, variant = b2, 'bleed'
        s, ae = score(ref, decode(b))
        if fmt == 'webp' and ref.mode == 'RGBA':
            for aq in (70, 50):                       # lossy alpha: keep only if still on target
                b2 = encode(ref, fmt, q, alpha_quality=aq)
                if len(b2) < len(b):
                    s2, ae2 = score(ref, decode(b2))
                    if s2 >= TARGET and ae2 <= 0.6:
                        b, s, ae, variant = b2, s2, ae2, 'alpha_quality=%d' % aq
        cache[i] = (q, b, s, ae, variant)
        return cache[i]

    while lo <= hi:
        mid = (lo + hi) // 2
        r = trial(mid)
        if r[2] >= TARGET:
            best = r; hi = mid - 1
        else:
            lo = mid + 1
    return best or trial(len(ladder) - 1)


def lqip(im):
    s = 16 / max(im.size)
    small = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    buf = io.BytesIO()
    small.save(buf, 'WEBP', quality=40, method=6, alpha_quality=40)
    b = buf.getvalue()
    return 'data:image/webp;base64,' + base64.b64encode(b).decode(), len(b), small.size


def avg_color(im):
    a = np.asarray(im.convert('RGBA'), dtype=np.float64)
    w = a[..., 3] / 255.0
    c = (a[..., :3] * w[..., None]).sum((0, 1)) / max(w.sum(), 1e-6)
    return '#%02X%02X%02X' % tuple(int(round(v)) for v in c)


sources = []
for f in sorted(os.listdir(SRC)):
    if f.endswith('.webp'):
        im = Image.open(os.path.join(SRC, f)); im.load()
        sources.append((f[:-5], f, im, None))
        if f == 'plate.webp':
            vis_w = round(im.height * 4 / 4.4)               # 4/4.4 scene, height-limited cover
            x0 = round((im.width - vis_w) * 0.5)             # object-position x 50%
            crop = im.crop((x0, 0, x0 + vis_w, im.height))
            sources.append(('plate-m', f, crop, [x0, 0, x0 + vis_w, im.height]))

only = set(sys.argv[1:])
manifest = {
    'generated': '2026-10-24',
    'generator': 'agents4/perf/gen.py (Pillow %s, libavif %s, libwebp %s)' % (PIL.__version__, features.version('avif'), features.version('webp')),
    'rules': __doc__.strip(),
    'ssimTarget': TARGET,
    'note': 'AI renders (הדמיית AI), temporary; regenerate with gen.py when real photography replaces them. Paths in "src" are relative to concepts/.',
    'images': []
}
prev = {}
mp = os.path.join(OUT, 'manifest.json')
if only and os.path.exists(mp):
    prev = {i['name']: i for i in json.load(open(mp))['images']}

for name, fname, im, crop in sources:
    if only and name not in only:
        if name in prev:
            manifest['images'].append(prev[name])
        continue
    alpha = im.mode == 'RGBA'
    ws = widths_for(name, im.width)
    entry = {
        'name': name, 'source': 'assets/ai/' + fname, 'sourceBytes': os.path.getsize(os.path.join(SRC, fname)),
        'intrinsic': {'width': im.width, 'height': im.height}, 'aspect': round(im.width / im.height, 4),
        'alpha': alpha, 'use': USE.get(name, 'product box (.box .shot .prod)'),
        'widths': ws, 'formats': ['avif', 'webp'], 'files': []
    }
    if crop:
        entry['crop'] = {'from': 'assets/ai/plate.webp', 'box': crop,
                         'why': 'object-fit:cover; object-position:50% 100% in a 4/4.4 box shows only this region'}
    for w in ws:
        ref = resize(im, w)
        cand = bleed(ref) if alpha else None
        for fmt, ladder in (('avif', AVIF_Q), ('webp', WEBP_Q)):
            q, b, s, ae, variant = pick(ref, fmt, ladder, cand)
            fn = f'{name}-{w}.{fmt}'
            with open(os.path.join(OUT, fn), 'wb') as fh:
                fh.write(b)
            entry['files'].append({'file': fn, 'src': 'assets/ai/r/' + fn, 'format': fmt, 'width': ref.width,
                                   'height': ref.height, 'bytes': len(b), 'quality': q, 'ssim': round(s, 4),
                                   'alphaMeanErr': round(ae, 3) if alpha else None, 'fill': variant if alpha and fmt == 'avif' else None, 'alpha': variant if alpha and fmt == 'webp' else None,
                                   'sha1': hashlib.sha1(b).hexdigest()[:12]})
            print(name, w, fmt, 'q', q, len(b), 'B', 'ssim %.4f' % s, variant, flush=True)
    uri, lb, lsize = lqip(im)
    entry['lqip'] = uri
    entry['lqipBytes'] = lb
    entry['lqipSize'] = {'width': lsize[0], 'height': lsize[1]}
    entry['color'] = avg_color(im)
    manifest['images'].append(entry)

order = [s[0] for s in sources]
manifest['images'].sort(key=lambda e: order.index(e['name']))
with open(mp, 'w') as fh:
    json.dump(manifest, fh, ensure_ascii=False, indent=1)
print('wrote', mp)
