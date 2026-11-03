#!/usr/bin/env python3
"""Measure every caption plate's real WIDTH in the real brand face, at build time.

`white-space: nowrap` plus a long 4-word card can exceed the frame. Measure it in the
actual font with Chrome — do NOT try to read overflow off a rendered snapshot: a white
sofa or a bright logo trips a pixel detector and sends you chasing a caption bug that is
not there.

Anything over the limit is reported with the size it WOULD fit at, so you can either
re-split the card or drop that one card's font size.

    python3 scripts/fit_captions.py                 # report
    python3 scripts/fit_captions.py --apply         # write per-card "size" into captions.json
"""
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hfcfg  # noqa: E402
from caption_layer import font_faces  # noqa: E402

PAGE = """<!doctype html><meta charset="utf-8">
<style>
{faces}
  body {{ margin:0; background:#fff; }}
  .p {{ display:inline-block; font-family:"{family}", sans-serif; font-weight:800;
        line-height:1.0; white-space:nowrap; padding:20px 34px 26px; }}
  .ltr {{ unicode-bidi:isolate; direction:ltr; }}
</style>
<div id="out"></div>
<script>
const CARDS = {cards};
const SIZES = {sizes};
const res = [];
for (const c of CARDS) {{
  const row = {{ i: c.i, plain: c.plain, w: {{}} }};
  for (const s of SIZES) {{
    const d = document.createElement('div');
    d.className = 'p'; d.style.fontSize = s + 'px'; d.style.direction = '{dir}';
    d.innerHTML = c.text;
    document.body.appendChild(d);
    row.w[s] = Math.round(d.getBoundingClientRect().width);
    d.remove();
  }}
  res.push(row);
}}
document.title = JSON.stringify(res);
document.getElementById('out').textContent = JSON.stringify(res);
</script>"""


def main():
    ap = hfcfg.arg_parser(__doc__)
    ap.add_argument("--captions", default="captions.json")
    ap.add_argument("--max-width", type=int, default=980)
    ap.add_argument("--apply", action="store_true")
    a = ap.parse_args()
    cfg = hfcfg.load(a.config)
    b = cfg["brand"]
    base = b["caption_size"]
    sizes = [base, int(base * 0.90), int(base * 0.83), int(base * 0.76)]

    font_dir = b["font_dir"] if os.path.isdir(b["font_dir"]) else \
        os.path.join(hfcfg.SKILL_DIR, "assets", "fonts")
    faces = font_faces(font_dir, b["font_family"])
    if not faces:
        sys.exit(f"no fonts in {font_dir} — run scripts/setup_assets.py")

    caps = json.load(open(a.captions, encoding="utf-8"))
    html = PAGE.format(faces=faces, family=b["font_family"],
                       dir=cfg["language"]["direction"],
                       cards=json.dumps(caps, ensure_ascii=False),
                       sizes=json.dumps(sizes))
    tmp = os.path.abspath("build/_fit.html")
    os.makedirs(os.path.dirname(tmp), exist_ok=True)
    open(tmp, "w", encoding="utf-8").write(html)

    dump = os.path.abspath("build/_fit.txt")
    r = subprocess.run([hfcfg.chrome_path(), "--headless", "--disable-gpu", "--no-sandbox",
                        "--allow-file-access-from-files", "--virtual-time-budget=2000",
                        "--dump-dom", "file://" + tmp],
                       capture_output=True, text=True)
    dom = r.stdout
    start = dom.find('id="out">')
    if start < 0:
        sys.exit(f"Chrome returned no measurement\n{r.stderr[-600:]}")
    payload = dom[start + len('id="out">'):]
    payload = payload[:payload.find("</div>")]
    rows = json.loads(payload)
    open(dump, "w", encoding="utf-8").write(payload)

    over = []
    for row in rows:
        w = row["w"][str(base)] if str(base) in row["w"] else row["w"][base]
        if w > a.max_width:
            fit = next((s for s in sizes if (row["w"].get(str(s)) or row["w"][s]) <= a.max_width),
                       sizes[-1])
            over.append((row, w, fit))

    print(f"  {len(rows)} cards measured at {base}px in {b['font_family']} "
          f"(limit {a.max_width}px)")
    if not over:
        print("  ✓ every plate fits")
        return 0
    print(f"  ✗ {len(over)} card(s) exceed the limit:")
    for row, w, fit in over:
        print(f"    c{row['i']:02d}  {w}px → fits at {fit}px   {row['plain']}")

    if a.apply:
        fits = {row["i"]: fit for row, _, fit in over}
        for c in caps:
            if c["i"] in fits:
                c["size"] = fits[c["i"]]
        json.dump(caps, open(a.captions, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(f"\n  wrote per-card sizes into {a.captions}")
        return 0
    print("\n  prefer re-splitting the card over shrinking it; --apply writes sizes instead")
    return 1


if __name__ == "__main__":
    sys.exit(main())
