Performance audit tools · האופה direction B
============================================

All scripts are read-only on concepts/ except gen.py, which writes concepts/assets/ai/r/ only.
Python: a venv with pillow (>= 12, has AVIF), numpy, fonttools, brotli.
Node 22 + Playwright (Chromium 153). Fonts are fetched from Google, so Chromium needs the proxy
(the scripts pass process.env.HTTPS_PROXY).

  imgq.py       resize (Lanczos, premultiplied), encode AVIF/WebP, SSIM on light+dark composites, alpha bleed
  gen.py        responsive variants + manifest.json -> concepts/assets/ai/r/
                  python3 gen.py            (all images)      python3 gen.py bag wheat   (only some)
  fonts.py      Hebrew + Basic Latin woff2 subsets from the upstream OFL TTFs (put the TTFs in fonts-dl/):
                  Rubik[wght].ttf, SecularOne-Regular.ttf, PlaypenSansHebrew[wght].ttf
                  from https://github.com/google/fonts/tree/main/ofl/{rubik,secularone,playpensanshebrew}
  charset.js    characters each family/weight renders in the overlay -> charset.json (fonts.py reads it)
  server.js     static server for concepts/ (ROOT=...), plus the harness pages:
                  /perf-full.html  today, overlay only      /perf-opt.html  recommended markup + fonts + LQIP
                  /perf-opt-img.html  images only           /perf-opt-nolqip.html  without LQIP
                  /perf-opt-nf.html   recommended + the plate-fade fix (finding P2)
                PORT=8765 node server.js ;  PORT=8766 COMPRESS=1 node server.js   (brotli)
  harness.js    the b.html rewrite used by server.js
  markup.js     the recommended <picture>/srcset/sizes markup, built from r/manifest.json
  measure.js    CDP measurement: node measure.js <scenario> <runs> <outdir>   (scenarios at the top)
  sizes.js      checks the sizes="" formulas against the rendered layout at 14 widths
  visual.js     reduced-motion full-page screenshots, today vs new markup, for pixel diffs
  trace.js      Chromium trace summary: node trace.js perf-full.html 390 780 3 4 label
  aggregate.js  results/*.json -> metrics.json ;  report.js  -> report.md, recommended-markup.html
  runall.sh     the full measurement matrix used for this report
