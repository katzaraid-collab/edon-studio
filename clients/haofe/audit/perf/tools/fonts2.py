"""Second subset strategy: Hebrew + digits + punctuation, no Latin letters (Latin letters fall to the next family)."""
import os, io, json, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.varLib import instancer
HERE = os.path.dirname(os.path.abspath(__file__))
DL, OUT = os.path.join(HERE, 'fonts-dl'), os.path.join(HERE, 'fonts-out')
HEB = list(range(0x0590, 0x0600)) + list(range(0xFB1D, 0xFB50))
PUNCT = list(range(0x20, 0x41)) + list(range(0x5B, 0x61)) + list(range(0x7B, 0x7F)) + [0xA0, 0xB7, 0x200C, 0x200D, 0x200E, 0x200F, 0x2010, 0x2011, 0x2013, 0x2014, 0x2018, 0x2019, 0x201A, 0x201C, 0x201D, 0x201E, 0x2026, 0x20AA, 0x25CC]
URANGE = 'U+0020-0040, U+005B-0060, U+007B-007E, U+00A0, U+00B7, U+0590-05FF, U+200C-2011, U+2013-2014, U+2018-201A, U+201C-201E, U+2026, U+20AA, U+25CC, U+FB1D-FB4F'
def sub(raw, uni, name, nocalt=False):
    o = subset.Options(); o.flavor = 'woff2'; o.hinting = False; o.desubroutinize = True; o.notdef_outline = True
    if nocalt: o.layout_features = [x for x in o.layout_features if x != 'calt']
    s = subset.Subsetter(o); s.populate(unicodes=uni); f = TTFont(io.BytesIO(raw)); s.subset(f); f.flavor = 'woff2'
    p = os.path.join(OUT, name); f.save(p); return os.path.getsize(p)
def raw(fn, w=None):
    f = TTFont(os.path.join(DL, fn))
    if w is not None: f = instancer.instantiateVariableFont(f, {'wght': w})
    b = io.BytesIO(); f.save(b); return b.getvalue()
res = {'unicodeRange': URANGE, 'files': {}}
r = res['files']
r['Secular One · static · Hebrew only'] = sub(raw('SecularOne-Regular.ttf'), HEB, 'SecularOne-hebonly.woff2')
r['Secular One · static · Hebrew+digits+punct'] = sub(raw('SecularOne-Regular.ttf'), HEB + PUNCT, 'SecularOne-hebp.woff2')
r['Rubik · 400..700 · Hebrew only'] = sub(raw('Rubik[wght].ttf', (400, 700)), HEB, 'Rubik-hebonly.woff2')
r['Rubik · 400..700 · Hebrew+digits+punct'] = sub(raw('Rubik[wght].ttf', (400, 700)), HEB + PUNCT, 'Rubik-400-700-hebp.woff2')
for w in (600, 400):
    r[f'Playpen · static {w} · Hebrew only'] = sub(raw('PlaypenSansHebrew[wght].ttf', w), HEB, f'PlaypenSansHebrew-{w}-hebonly.woff2')
    r[f'Playpen · static {w} · Hebrew+digits+punct'] = sub(raw('PlaypenSansHebrew[wght].ttf', w), HEB + PUNCT, f'PlaypenSansHebrew-{w}-hebp.woff2')
    r[f'Playpen · static {w} · Hebrew+digits+punct, no calt'] = sub(raw('PlaypenSansHebrew[wght].ttf', w), HEB + PUNCT, f'PlaypenSansHebrew-{w}-hebp-nocalt.woff2', True)
r['Playpen · variable 400..600 · Hebrew+digits+punct'] = sub(raw('PlaypenSansHebrew[wght].ttf', (400, 600)), HEB + PUNCT, 'PlaypenSansHebrew-400-600-hebp.woff2')
json.dump(res, open(os.path.join(HERE, 'fonts2.json'), 'w'), ensure_ascii=False, indent=1)
for k, v in r.items(): print(f'{v:8}  {k}')
