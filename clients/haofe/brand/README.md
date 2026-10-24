# האופה · logo files

Vectorized on 24.10.2026 from the only source available: the 512×512 PNG served by the bakery's own app (haofeapp.com/brand/icon-512.png).
This is a careful trace, not the designer's master file. If the original AI/PDF/SVG exists, it should replace these.

## Files

| file | what it is | when to use |
|---|---|---|
| `svg/haofe-logo.svg` | full colour, keeps the printed (distressed) texture | main logo, large sizes |
| `svg/haofe-logo-clean.svg` | full colour, texture filled in | small sizes (under ~64px), favicons, embroidery, print at small size |
| `svg/haofe-logo-badge.svg` | full colour on a white disc | on photos and on dark or busy backgrounds |
| `svg/haofe-logo-mono-chocolate.svg` | one colour, chocolate | one-colour print, stamps, packaging |
| `svg/haofe-logo-mono-cream.svg` | one colour, cream `#F7F1E6` | dark mode, dark packaging |
| `svg/haofe-logo-animated.svg` | 4.8s loop: rings draw, wheat grows, wordmark is stamped; static under reduced motion | site intro, loading state |
| `png/*.png` | transparent PNG exports (512, 1024, 2048; badge and mono at 1024) | anywhere SVG is not accepted |

## Structure (editable)

Every SVG has named groups so each part can be recoloured or animated separately:

- `#rings`: two exact `<circle>` elements (centre 254.75, 255; radii 229.2 and 240; strokes 9.2 and 3.4), not traced, so they stay perfectly round.
- `#wheat-and-tagline` (caramel `#B0702A`): the three wheat stalks, the hill and "בוטיק לחם" (with its vowel points).
- `#wordmark` (chocolate `#451804`): "האופה".
- In the animated file: `#hill`, `#stalk-1`, `#stalk-2`, `#stalk-3`, `#tagline`, `#wordmark`, `#rings`.

Colours were measured from the source PNG (caramel ≈ `#B0702A`, chocolate ≈ `#451804`).

## Rebuilding

`trace-logo.py` regenerates every SVG: `python trace-logo.py icon-512.png out/` (needs `potracer`, `scipy`, `numpy`, `Pillow`).
