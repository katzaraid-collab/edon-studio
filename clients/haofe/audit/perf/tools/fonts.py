"""Size a self-hosted Hebrew + Basic Latin subset for the three families (OFL, google/fonts repo).
Inputs are the upstream TTFs in fonts-dl/ (untrusted download dir); outputs go to fonts-out/."""
import os, io, json, sys
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.varLib import instancer

HERE = os.path.dirname(os.path.abspath(__file__))
DL, OUT = os.path.join(HERE, 'fonts-dl'), os.path.join(HERE, 'fonts-out')
os.makedirs(OUT, exist_ok=True)

HEB = list(range(0x0590, 0x0600)) + list(range(0xFB1D, 0xFB50))
LATIN = list(range(0x20, 0x7F)) + [0xA0, 0xB7, 0x200C, 0x200D, 0x200E, 0x200F, 0x2010, 0x2011, 0x2013, 0x2014,
                                   0x2018, 0x2019, 0x201A, 0x201C, 0x201D, 0x201E, 0x2026, 0x20AA, 0x25CC]
UNI = HEB + LATIN
URANGE = 'U+0020-007E, U+00A0, U+00B7, U+0590-05FF, U+200C-2011, U+2013-2014, U+2018-201A, U+201C-201E, U+2026, U+20AA, U+25CC, U+FB1D-FB4F'

used = json.load(open(os.path.join(HERE, 'charset.json')))


def do_subset(font, unicodes, name):
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.hinting = False
    opts.desubroutinize = True
    opts.layout_features = ['*']
    opts.name_IDs = ['*']
    opts.notdef_outline = True
    s = subset.Subsetter(opts)
    s.populate(unicodes=unicodes)
    f = TTFont(io.BytesIO(font)) if isinstance(font, bytes) else font
    s.subset(f)
    p = os.path.join(OUT, name)
    f.flavor = 'woff2'
    f.save(p)
    return os.path.getsize(p)


def ttf_bytes(f):
    b = io.BytesIO(); f.save(b); return b.getvalue()


def metrics(path):
    f = TTFont(path)
    upm = f['head'].unitsPerEm
    os2, hhea = f['OS/2'], f['hhea']
    cmap = f.getBestCmap()
    hm = f['hmtx']
    heb = [hm[cmap[c]][0] for c in range(0x05D0, 0x05EB) if c in cmap]
    return {'upm': upm, 'hheaAscent': hhea.ascent, 'hheaDescent': hhea.descent, 'lineGap': hhea.lineGap,
            'typoAscender': os2.sTypoAscender, 'typoDescender': os2.sTypoDescender, 'winAscent': os2.usWinAscent,
            'winDescent': os2.usWinDescent, 'useTypoMetrics': bool(os2.fsSelection & (1 << 7)),
            'avgHebrewAdvancePerEm': round(sum(heb) / len(heb) / upm, 4) if heb else None,
            'axes': [(a.axisTag, a.minValue, a.maxValue) for a in f['fvar'].axes] if 'fvar' in f else None,
            'glyphs': len(f.getGlyphOrder())}


res = {'unicodeRange': URANGE, 'families': {}}
FAM = {
    'Rubik': ('Rubik[wght].ttf', (400, 700), None),
    'Secular One': ('SecularOne-Regular.ttf', None, None),
    'Playpen Sans Hebrew': ('PlaypenSansHebrew[wght].ttf', (400, 600), (400, 600)),
}
for fam, (fn, rng, statics) in FAM.items():
    path = os.path.join(DL, fn)
    r = {'source': fn, 'sourceBytes': os.path.getsize(path), 'metrics': metrics(path), 'files': {}}
    base = TTFont(path)
    if rng:
        lim = instancer.instantiateVariableFont(TTFont(path), {'wght': rng})
        r['files'][f'variable wght {rng[0]}..{rng[1]}, Hebrew+Basic Latin'] = do_subset(ttf_bytes(lim), UNI, fam.replace(' ', '') + f'-{rng[0]}-{rng[1]}-heb.woff2')
        r['files']['full variable axis, Hebrew+Basic Latin'] = do_subset(ttf_bytes(TTFont(path)), UNI, fam.replace(' ', '') + '-full-heb.woff2')
    else:
        r['files']['static, Hebrew+Basic Latin'] = do_subset(ttf_bytes(base), UNI, fam.replace(' ', '') + '-heb.woff2')
    if statics:
        for w in statics:
            st = instancer.instantiateVariableFont(TTFont(path), {'wght': w})
            r['files'][f'static {w}, Hebrew+Basic Latin'] = do_subset(ttf_bytes(st), UNI, fam.replace(' ', '') + f'-{w}-heb.woff2')
    # floor: only the characters the prototype renders today (fragile for a CMS; reference only)
    chars = ''.join(v for k, v in used.items() if k.split('|')[0] == fam)
    if chars:
        src = ttf_bytes(instancer.instantiateVariableFont(TTFont(path), {'wght': rng})) if rng else ttf_bytes(base)
        r['files']['used characters only (%d)' % len(set(chars))] = do_subset(src, [ord(c) for c in set(chars)] + [0x20], fam.replace(' ', '') + '-used.woff2')
    res['families'][fam] = r
    print(fam, json.dumps(r['files'], ensure_ascii=False), r['metrics'], flush=True)

json.dump(res, open(os.path.join(HERE, 'fonts.json'), 'w'), ensure_ascii=False, indent=1)
