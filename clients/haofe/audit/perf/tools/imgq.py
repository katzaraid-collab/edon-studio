"""Shared helpers: resize, encode, decode, SSIM against a reference composited on the slot colours."""
import io
import numpy as np
from PIL import Image

PAPER = (255, 252, 246)   # --paper #FFFCF6 (light .shot centre)
DARK = (34, 24, 18)       # --paper dark #221812 (dark .shot centre)


def resize(im, w):
    h = round(im.height * w / im.width)
    if w == im.width:
        return im.copy()
    return im.resize((w, h), Image.LANCZOS)   # Pillow premultiplies RGBA internally for this


def encode(im, fmt, q, **kw):
    buf = io.BytesIO()
    if fmt == 'webp':
        im.save(buf, 'WEBP', quality=q, method=6, **kw)
    else:
        im.save(buf, 'AVIF', quality=q, speed=kw.pop('speed', 4), **kw)
    return buf.getvalue()


def decode(b):
    im = Image.open(io.BytesIO(b))
    im.load()
    return im


def over(im, bg):
    if im.mode != 'RGBA':
        return np.asarray(im.convert('RGB'), dtype=np.float64)
    a = np.asarray(im, dtype=np.float64)
    al = a[..., 3:4] / 255.0
    return a[..., :3] * al + np.array(bg, dtype=np.float64) * (1 - al)


def _box(x, r=3):
    # mean filter (2r+1)^2 via integral image
    k = 2 * r + 1
    c = np.cumsum(np.cumsum(np.pad(x, ((1, 0), (1, 0))), 0), 1)
    return (c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]) / (k * k)


def ssim(a, b):
    """mean SSIM on luma (BT.601), 7x7 window; a, b float RGB arrays."""
    ya = a @ np.array([.299, .587, .114])
    yb = b @ np.array([.299, .587, .114])
    C1, C2 = (0.01 * 255) ** 2, (0.03 * 255) ** 2
    ma, mb = _box(ya), _box(yb)
    va = _box(ya * ya) - ma * ma
    vb = _box(yb * yb) - mb * mb
    cov = _box(ya * yb) - ma * mb
    s = ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2))
    return float(s.mean())


def alpha_err(ref, test):
    if ref.mode != 'RGBA':
        return 0.0
    ra = np.asarray(ref.getchannel('A'), dtype=np.float64)
    ta = np.asarray(test.convert('RGBA').getchannel('A'), dtype=np.float64)
    return float(np.abs(ra - ta).mean())


def score(ref, test):
    """worst SSIM over the light and dark slot backgrounds, plus mean alpha error (0..255)."""
    s = min(ssim(over(ref, PAPER), over(test, PAPER)), ssim(over(ref, DARK), over(test, DARK)))
    return s, alpha_err(ref, test)


def bleed(im):
    """Push-pull fill: RGB under alpha==0 takes the alpha-weighted colour of the nearest
    visible pixels. Invisible on screen (alpha stays 0); removes noisy hidden RGB that AVIF
    would otherwise spend bits on, and keeps 4:2:0 chroma from bleeding dark into the edges."""
    if im.mode != 'RGBA':
        return im
    a = np.asarray(im, dtype=np.float64)
    rgb, al = a[..., :3], a[..., 3] / 255.0
    levels = []
    pm, w = rgb * al[..., None], al.copy()
    while True:
        levels.append((pm, w))
        if min(pm.shape[:2]) <= 2:
            break
        h2, w2 = pm.shape[0] // 2 * 2, pm.shape[1] // 2 * 2
        p = pm[:h2, :w2]; ww = w[:h2, :w2]
        pm = (p[0::2, 0::2] + p[1::2, 0::2] + p[0::2, 1::2] + p[1::2, 1::2]) / 4
        w = (ww[0::2, 0::2] + ww[1::2, 0::2] + ww[0::2, 1::2] + ww[1::2, 1::2]) / 4
    col = None
    for pm, w in reversed(levels):
        c = np.where(w[..., None] > 1e-6, pm / np.maximum(w[..., None], 1e-6), 0)
        if col is not None:
            up = np.repeat(np.repeat(col, 2, 0), 2, 1)
            up = np.pad(up, ((0, max(0, c.shape[0] - up.shape[0])), (0, max(0, c.shape[1] - up.shape[1])), (0, 0)), mode='edge')[:c.shape[0], :c.shape[1]]
            c = np.where(w[..., None] > 1e-6, c, up)
        col = c
    out = np.where((al == 0)[..., None], col, rgb)
    res = np.dstack([np.clip(out, 0, 255), a[..., 3]]).round().astype(np.uint8)
    return Image.fromarray(res, 'RGBA')
