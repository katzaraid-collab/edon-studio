"""Brand chart: an impulse leg, a retracement that touches 0.618 exactly, a hammer, and the continuation."""
import random

FIB = [0, .236, .382, .5, .618, .786, 1]

def series(seed=7, n_up=13, n_back=8, n_cont=13, low=100.0, high=200.0, cont_to=226.0):
    rnd = random.Random(seed)
    golden = high - .618 * (high - low)
    out = []
    def leg(start, end, n, vol=1.25):
        drift = (end - start) / n
        inc = [drift + rnd.gauss(0, 1) * abs(drift) * vol for _ in range(n)]
        fix = (end - start - sum(inc)) / n
        inc = [i + fix for i in inc]
        o = start
        for i, d in enumerate(inc):
            c = o + d
            sig = abs(drift)
            hi = max(o, c) + abs(rnd.gauss(0, 1)) * sig * .45
            lo = min(o, c) - abs(rnd.gauss(0, 1)) * sig * .45
            out.append([o, hi, lo, c])
            o = c
        return o
    c = leg(low + 5, high - 4, n_up)
    out[0][2] = low                           # swing low  -> level 1
    k = max(range(len(out)), key=lambda i: out[i][1])
    out[k][1] = high                          # swing high -> level 0
    for d in out[:k] + out[k+1:]:
        d[1] = min(d[1], high - .5)
    c = leg(c, golden + 11, n_back, vol=1.0)
    for d in out[-n_back:]:
        d[2] = max(d[2], golden + 2)
    # the hammer: a long lower wick that tags 0.618 exactly and closes near its high
    out.append([c, golden + 19.5, golden, golden + 18])
    leg(golden + 18, cont_to, n_cont)
    return out, low, high, golden

def svg(w, h, seed=7, pad_top=.08, pad_bot=.08, levels=True, labels=True, label_side='left',
        up='#C9A24B', down='#4A4134', dim=1.0, zone=True, stroke=2.4, extra_right=0, lw=1.4, font=18,
        highlight_hammer=True, cont_to=226.0, n_cont=13):
    data, low, high, golden = series(seed, cont_to=cont_to, n_cont=n_cont)
    pmax = max(d[1] for d in data); pmin = low
    rng = pmax - pmin
    top = pmin + rng * (1 + pad_top) ; bot = pmin - rng * pad_bot
    y = lambda p: (top - p) / (top - bot) * h
    n = len(data)
    step = (w - extra_right) / (n + .5)
    cw = step * .58
    parts = []
    if levels:
        if zone:
            z1, z2 = y(high - .618 * (high - low)), y(high - .65 * (high - low))
            parts.append(f'<rect x="0" y="{min(z1,z2):.1f}" width="{w}" height="{abs(z2-z1):.1f}" fill="#C9A24B" fill-opacity="{.10*dim:.3f}"/>')
        for r in FIB:
            p = high - r * (high - low)
            yy = y(p)
            gold = abs(r - .618) < 1e-6
            col = '#E4C57A' if gold else '#C9A24B'
            op = (.95 if gold else .32) * dim
            dash = '' if gold or r in (0, 1) else ' stroke-dasharray="2 7"'
            parts.append(f'<line x1="0" x2="{w}" y1="{yy:.1f}" y2="{yy:.1f}" stroke="{col}" stroke-opacity="{op:.2f}" stroke-width="{lw*(1.6 if gold else 1)}"{dash}/>')
            if labels:
                tx = 14 if label_side == 'left' else w - 14
                anc = 'start' if label_side == 'left' else 'end'
                lab = ('%.3f' % r).rstrip('0').rstrip('.') if r not in (0, 1) else str(r)
                parts.append(f'<text x="{tx}" y="{yy-9:.1f}" text-anchor="{anc}" font-family="Mono" font-size="{font*(1.15 if gold else 1):.1f}" font-weight="{600 if gold else 400}" fill="{col}" fill-opacity="{min(1,(1 if gold else .6)*dim+.1):.2f}">{lab}</text>')
    for i, (o, hi, lo, c) in enumerate(data):
        cx = step * (i + .75)
        bull = c >= o
        yt, yb = y(max(o, c)), y(min(o, c))
        bh = max(yb - yt, 2)
        r = min(cw * .382, bh / 2)
        is_hammer = abs(lo - golden) < 1e-6
        col = up if bull else down
        op = dim
        wick = f'<line x1="{cx:.1f}" x2="{cx:.1f}" y1="{y(hi):.1f}" y2="{y(lo):.1f}" stroke="{col}" stroke-opacity="{op:.2f}" stroke-width="{stroke}"/>'
        if bull:
            body = f'<rect x="{cx-cw/2:.1f}" y="{yt:.1f}" width="{cw:.1f}" height="{bh:.1f}" rx="{r:.1f}" fill="#0C0B09" stroke="{col}" stroke-opacity="{op:.2f}" stroke-width="{stroke}"/>'
        else:
            body = f'<rect x="{cx-cw/2:.1f}" y="{yt:.1f}" width="{cw:.1f}" height="{bh:.1f}" rx="{r:.1f}" fill="{col}" fill-opacity="{op:.2f}"/>'
        if is_hammer and highlight_hammer:
            parts.append(f'<circle cx="{cx:.1f}" cy="{y(lo):.1f}" r="{cw*.9:.1f}" fill="none" stroke="#EBD39A" stroke-opacity="{.8*dim:.2f}" stroke-width="{lw*1.4}"/>')
            parts.append(f'<circle cx="{cx:.1f}" cy="{y(lo):.1f}" r="{stroke*1.8:.1f}" fill="#EBD39A" fill-opacity="{dim:.2f}"/>')
            body = body.replace('fill="#0C0B09"', 'fill="#C9A24B" fill-opacity="0.25"').replace(f'stroke="{up}"', 'stroke="#EBD39A"')
            wick = wick.replace(f'stroke="{up}"', 'stroke="#EBD39A"')
        parts.append(wick + body)
    return f'<svg xmlns="http://www.w3.org/2000/svg" direction="ltr" style="direction:ltr" width="{w}" height="{h}" viewBox="0 0 {w} {h}">{"".join(parts)}</svg>'
