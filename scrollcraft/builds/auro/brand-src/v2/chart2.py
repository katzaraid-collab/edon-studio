"""Modern area-line chart for AURO: the brand's impulse → 0.618 retrace → continuation, drawn as one glowing gold line."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import chart_v1

def smooth(pts, t=.5):
    d = f'M{pts[0][0]:.1f},{pts[0][1]:.1f}'
    for i in range(len(pts) - 1):
        p0 = pts[i - 1] if i else pts[i]; p1 = pts[i]; p2 = pts[i + 1]; p3 = pts[i + 2] if i + 2 < len(pts) else p2
        c1 = (p1[0] + (p2[0] - p0[0]) * t / 3, p1[1] + (p2[1] - p0[1]) * t / 3)
        c2 = (p2[0] - (p3[0] - p1[0]) * t / 3, p2[1] - (p3[1] - p1[1]) * t / 3)
        d += f' C{c1[0]:.1f},{c1[1]:.1f} {c2[0]:.1f},{c2[1]:.1f} {p2[0]:.1f},{p2[1]:.1f}'
    return d

def svg(w, h, rm=26, seed=7, pad_t=.1, pad_b=.18, level=True, gid='cg', stroke=3.5, end_dot=True, label=True, dim=1.0, font=18, cont_to=226.0, n_cont=13):
    data, low, high, golden = chart_v1.series(seed, cont_to=cont_to, n_cont=n_cont)
    vals = [data[0][0]] + [c for o, hi, lo, c in data]
    # tag the 0.618 touch exactly with the hammer's low
    k = next(i for i, d in enumerate(data) if abs(d[2] - golden) < 1e-6)
    vals[k + 1] = golden + 2.5
    vmax, vmin = max(vals), min(vals)
    top = vmax + (vmax - vmin) * pad_t; bot = vmin - (vmax - vmin) * pad_b
    X = lambda i: i / (len(vals) - 1) * (w - rm)
    Y = lambda v: (top - v) / (top - bot) * h
    pts = [(X(i), Y(v)) for i, v in enumerate(vals)]
    line = smooth(pts)
    area = line + f' L{w},{h} L0,{h} Z'
    gy = Y(golden)
    parts = [f'<defs><linearGradient id="{gid}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F2C14E" stop-opacity="{.30*dim:.2f}"/><stop offset="1" stop-color="#F2C14E" stop-opacity="0"/></linearGradient>'
             f'<linearGradient id="{gid}s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#B07A1E" stop-opacity="{.35*dim:.2f}"/><stop offset=".55" stop-color="#F2C14E" stop-opacity="{dim:.2f}"/><stop offset="1" stop-color="#FFF1C9" stop-opacity="{dim:.2f}"/></linearGradient>'
             f'<filter id="{gid}g" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="6"/></filter></defs>']
    if level:
        parts.append(f'<line x1="0" x2="{w}" y1="{gy:.1f}" y2="{gy:.1f}" stroke="#EDEBE6" stroke-opacity="{.35*dim:.2f}" stroke-width="1.5" stroke-dasharray="3 9"/>')
        if label:
            parts.append(f'<text x="{w-16}" y="{gy-14:.1f}" text-anchor="end" font-family="GMono" font-size="{font}" fill="#EDEBE6" fill-opacity="{.7*dim:.2f}" letter-spacing="2">0.618</text>')
    parts.append(f'<path d="{area}" fill="url(#{gid}f)"/>')
    parts.append(f'<path d="{line}" fill="none" stroke="#F2C14E" stroke-opacity="{.55*dim:.2f}" stroke-width="{stroke*3}" filter="url(#{gid}g)"/>')
    parts.append(f'<path d="{line}" fill="none" stroke="url(#{gid}s)" stroke-width="{stroke}" stroke-linecap="round" stroke-linejoin="round"/>')
    tx, ty = pts[k + 1]
    parts.append(f'<circle cx="{tx:.1f}" cy="{ty:.1f}" r="{stroke*2.6:.1f}" fill="#07070A" stroke="#EDEBE6" stroke-opacity="{.9*dim:.2f}" stroke-width="2"/>')
    if end_dot:
        ex, ey = pts[-1]
        parts.append(f'<circle cx="{ex-1:.1f}" cy="{ey:.1f}" r="{stroke*6:.1f}" fill="#F2C14E" fill-opacity="{.18*dim:.2f}"/><circle cx="{ex-1:.1f}" cy="{ey:.1f}" r="{stroke*2.2:.1f}" fill="#FFF1C9" fill-opacity="{dim:.2f}"/>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" direction="ltr" style="direction:ltr;overflow:visible" width="{w}" height="{h}" viewBox="0 0 {w} {h}">{"".join(parts)}</svg>'
