# AURO brand sources

The scripts that generated every AURO brand asset: logo SVG/PNG, 3D gold renders, the 16 banners, the brand book page and the PDF presentation. Everything is code, so any asset can be regenerated or changed and re-rendered.

## Layout

```
brand-src/
  v2/                 # the AURO brand (current)
    mark.py           # the Ingot A symbol geometry (single source of truth)
    outline.py        # HarfBuzz + fontTools: text -> outlined SVG paths
    brand2.py         # logo system: wordmark, lockup, symbol, app icon (5 colourways)
    r3d.html, r3d.js  # three.js offline renderer for the 3D gold (scenes: mark, bar, base, blob, ingot)
    chart_v1.py       # price series: impulse, 0.618 retracement, hammer, continuation
    chart2.py         # the glowing gold line chart built on that series
    kit.css           # banner design tokens (fonts, colours, glass, dots, halo)
    banners2.py       # the 16 banners as HTML pages at exact platform pixels -> jobs.json
    book2.py          # brand book page (writes ../build/book/golden-ratio-brand-book.html)
    slides.py         # 14-slide client presentation -> slides/index.html
    slides/render.js  # slides -> PNG per slide + AURO-Brand-Presentation.pdf
    fonts/            # Heebo, Archivo, Geist Mono, Noto Sans Hebrew (+ OFL licences)
  build/
    render.js         # renders jobs.json (HTML pages) to PNG at exact size
    export_logos.js   # SVG -> transparent PNG, long side 2400px
    shot.js, shotpage.js  # screenshot helpers
```

Generated output (not committed) lands in `v2/out/` (logo/svg, logo/png, 3d, banners) and `build/book/`.

## Setup

```bash
pip install fonttools uharfbuzz pillow
npm i playwright            # or set PLAYWRIGHT_MODULE to an installed playwright path
cd v2 && npm i three@0.169.0   # for the 3D renderer
```

Headless WebGL needs Chromium flags `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist` (already set in r3d.js).

## Regenerate

```bash
cd v2
python3 brand2.py out/logo/svg && node ../build/export_logos.js out/logo/svg out/logo/png

# 3D gold (serve v2 first: python3 -m http.server 8765 --bind 127.0.0.1)
P="envr=0.9&sweepx=0.42&cg=0.68&cb=0.24&sweep=1.0&a1=4&a2=3&exp=0.9"
node r3d.js out/3d/a-hero.png  "scene=mark&ry=0.32&rx=-0.24&$P" 1600 1600
node r3d.js out/3d/a-front.png "scene=mark&ry=0.2&rx=-0.14&$P&dist=6.6" 1400 1400
node r3d.js out/3d/a-left.png  "scene=mark&ry=-0.42&rx=-0.2&envr=-0.3&sweepx=0.45&cg=0.68&cb=0.24&sweep=1.0&a1=4&a2=3&exp=0.9" 1600 1600
# then crop each PNG to its alpha bbox (+12px)

python3 banners2.py && node ../build/render.js jobs.json        # -> out/banners/*.png
python3 book2.py                                                 # brand book page
python3 slides.py && node slides/render.js                       # presentation PDF
```

The landing page itself is not here; it lives one level up in `scrollcraft/builds/auro/` (see BRIEF.md, SPEC.md, assemble.py).
