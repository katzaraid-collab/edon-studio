"""AURO — the Ingot A. A flat-topped A cut by one level line: the top piece is a gold bar, the base is a market peak."""
B, H = 200.0, 170.0            # base width, total height
T = .22 * B                    # flat top width
C = .382 * H                   # height of the bar (above the level line)
GAP = .05 * B                  # level-line gap
NB = .30 * B                   # notch width at the base

def _x_at(y):                  # half-width of the outer trapezoid at height y (from top)
    return (T + (B - T) * y / H) / 2

def pieces(x=0, y=0, k=1.0, gap=GAP):
    """Two polygons (bar, base) for the mark with its top-left corner of the bounding box at (x, y)."""
    cx = B / 2
    y1 = C; y2 = C + gap
    bar = [(cx - _x_at(0), 0), (cx + _x_at(0), 0), (cx + _x_at(y1), y1), (cx - _x_at(y1), y1)]
    apex = y2 + .07 * H
    base = [(cx - _x_at(y2), y2), (cx + _x_at(y2), y2), (cx + B / 2, H), (cx + NB / 2, H), (cx, apex), (cx - NB / 2, H), (cx - B / 2, H)]
    f = lambda pts: [(x + px * k, y + py * k) for px, py in pts]
    return f(bar), f(base)

def d(x=0, y=0, k=1.0, gap=GAP):
    out = ''
    for poly in pieces(x, y, k, gap):
        out += 'M' + ' L'.join(f'{px:.2f},{py:.2f}' for px, py in poly) + 'Z'
    return out
