"""Shape text with HarfBuzz and return it as outlined SVG path data."""
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
import os
FONTS = os.path.join(os.path.dirname(__file__), 'fonts')
_cache = {}

class Face:
    def __init__(self, file, wght=None, axes=None):
        path = os.path.join(FONTS, file)
        data = open(path, 'rb').read()
        self.font = hb.Font(hb.Face(data))
        self.tt = TTFont(path)
        loc = dict(axes or {})
        if wght: loc['wght'] = wght
        if loc and 'fvar' in self.tt:
            self.font.set_variations(loc)
            self.gs = self.tt.getGlyphSet(location=loc)
        else:
            self.gs = self.tt.getGlyphSet()
        self.upem = self.tt['head'].unitsPerEm
        self.order = self.tt.getGlyphOrder()
        os2 = self.tt['OS/2']
        self.cap = getattr(os2, 'sCapHeight', 700) or 700
        self.xh = getattr(os2, 'sxHeight', 500) or 500

def face(file, wght=None, **axes):
    k = (file, wght, tuple(sorted(axes.items())))
    if k not in _cache:
        _cache[k] = Face(file, wght, axes)
    return _cache[k]

def layout(f, text, size, tracking=0.0, features=None):
    """Return list of (glyphname, x, y) in px (baseline y=0, y down) and total advance."""
    buf = hb.Buffer(); buf.add_str(text); buf.guess_segment_properties()
    hb.shape(f.font, buf, features or {'kern': True, 'liga': True})
    s = size / f.upem
    x = 0.0; out = []
    n = len(buf.glyph_infos)
    for i, (gi, gp) in enumerate(zip(buf.glyph_infos, buf.glyph_positions)):
        out.append((f.order[gi.codepoint], x + gp.x_offset * s, -gp.y_offset * s))
        x += gp.x_advance * s
        if i < n - 1:
            x += tracking * size
    return out, x

def text_path(f, text, size, x=0, y=0, tracking=0.0, features=None):
    """SVG path d for text with its baseline-left at (x, y). Returns (d, advance, bbox)."""
    glyphs, adv = layout(f, text, size, tracking, features)
    s = size / f.upem
    spen = SVGPathPen(f.gs, ntos=lambda v: ('%.2f' % v).rstrip('0').rstrip('.'))
    bpen = BoundsPen(f.gs)
    for name, gx, gy in glyphs:
        t = (s, 0, 0, -s, x + gx, y + gy)
        f.gs[name].draw(TransformPen(spen, t))
        f.gs[name].draw(TransformPen(bpen, t))
    return spen.getCommands(), adv, bpen.bounds
