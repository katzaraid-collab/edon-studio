#!/usr/bin/env python3
"""Render a captured pyte screen buffer into a terminal-window HTML page.

The text is exactly what the real CLI printed — this only puts it in a window
chrome so it reads as premium B-roll instead of a raw screenshot.
"""
import json, html, sys, argparse, re

# xterm base-16 mapped to a palette that reads well on a dark background
ANSI = {
    "black": "#2b2b30", "red": "#ff6b68", "green": "#57d18e", "brown": "#e0c060",
    "yellow": "#e0c060", "blue": "#6aa9ff", "magenta": "#c792ea", "cyan": "#56cfd8",
    "white": "#d6d3cd", "brightblack": "#6f6b78", "brightred": "#ff8b88",
    "brightgreen": "#7ce0a8", "brightyellow": "#f2d98a", "brightblue": "#8dbcff",
    "brightmagenta": "#dcb0f5", "brightcyan": "#7fe3ea", "brightwhite": "#ffffff",
    "default": "#d8d5cf",
}
BG_DEFAULT = "#15141a"


def color(v, is_bg=False):
    if v in (None, "default"):
        return BG_DEFAULT if is_bg else ANSI["default"]
    if v in ANSI:
        return ANSI[v]
    if re.fullmatch(r"[0-9a-fA-F]{6}", str(v)):
        return "#" + v
    return BG_DEFAULT if is_bg else ANSI["default"]


def render(cells, redact=()):
    out = []
    for y, row in enumerate(cells):
        spans = []
        cur = None
        buf = ""

        def flush():
            nonlocal buf, cur
            if buf:
                fg, bg, b = cur
                st = f"color:{fg}"
                if bg != BG_DEFAULT:
                    st += f";background:{bg}"
                if b:
                    st += ";font-weight:700"
                spans.append(f'<span style="{st}">{html.escape(buf)}</span>')
            buf = ""

        line_text = "".join(c["c"] for c in row)
        blur_ranges = []
        for pat in redact:
            for m in re.finditer(pat, line_text):
                blur_ranges.append((m.start(), m.end()))

        for x, c in enumerate(row):
            fg = color(c["fg"])
            bg = color(c["bg"], True)
            if c.get("r"):
                fg, bg = bg, fg
            key = (fg, bg, bool(c.get("b")))
            blurred = any(s <= x < e for s, e in blur_ranges)
            if blurred:
                flush()
                cur = key
                spans.append(f'<span style="color:{fg};filter:blur(6px)">{html.escape(c["c"])}</span>')
                cur = None
                continue
            if key != cur:
                flush()
                cur = key
            buf += c["c"]
        flush()
        out.append("".join(spans) or "&nbsp;")
    return "\n".join(out)


PAGE = """<meta charset="utf-8">
<style>
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  html,body {{ background:{page_bg}; }}
  .stage {{ width:{W}px; height:{H}px; display:flex; align-items:{align};
            justify-content:center; padding:{pad}px; padding-top:{ptop}px;
            padding-bottom:{pbot}px; }}
  .win {{ width:100%; height:{winh}; border-radius:20px; overflow:hidden;
          background:{bg}; box-shadow:0 44px 100px rgba(0,0,0,.7), 0 0 0 1px rgba(255,255,255,.08);
          display:flex; flex-direction:column; }}
  .bar {{ height:52px; flex:0 0 52px; background:#211f27; display:flex; align-items:center;
          padding:0 20px; gap:10px; border-bottom:1px solid rgba(255,255,255,.06); }}
  .dot {{ width:15px; height:15px; border-radius:50%; }}
  .t {{ margin-left:16px; color:#8d8898; font:600 18px -apple-system,"Helvetica Neue",Arial;
        letter-spacing:.2px; }}
  pre {{ padding:{ipad}px {ipad}px; color:#d8d5cf; background:{bg};
         font-family:Menlo,"SF Mono",Monaco,"Courier New",monospace;
         font-size:{fs}px; line-height:{lh}; white-space:pre; overflow:hidden;
         font-variant-ligatures:none; }}
</style>
<div class="stage"><div class="win">
  <div class="bar">
    <div class="dot" style="background:#ff5f57"></div>
    <div class="dot" style="background:#febc2e"></div>
    <div class="dot" style="background:#28c840"></div>
    <div class="t">{title}</div>
  </div>
  <pre>{body}</pre>
</div></div>"""


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--json", required=True)
    p.add_argument("--key", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--title", default="~ — zsh")
    p.add_argument("--w", type=int, default=1080)
    p.add_argument("--h", type=int, default=900)
    p.add_argument("--fs", type=float, default=0)     # 0 = auto-fit to width
    p.add_argument("--lh", type=float, default=1.16)
    p.add_argument("--pad", type=int, default=26)
    p.add_argument("--ipad", type=int, default=24)
    p.add_argument("--top", type=int, default=0)      # pin window this far from the top
    p.add_argument("--bottom", type=int, default=0)
    p.add_argument("--fill", action="store_true")     # window fills the stage height
    p.add_argument("--rows", default="")
    p.add_argument("--redact", action="append", default=[])
    p.add_argument("--page-bg", default="#0b0a0e")
    a = p.parse_args()

    snap = json.load(open(a.json))[a.key]
    cells = snap["cells"]
    if a.rows:
        s, e = a.rows.split(":")
        cells = cells[int(s):int(e)]
    # trim trailing blank rows so the window hugs its content
    while len(cells) > 4 and not "".join(c["c"] for c in cells[-1]).strip():
        cells.pop()
    body = render(cells, a.redact)

    # size the glyphs so the captured columns exactly fill the window width
    ipad = a.ipad
    inner = a.w - 2 * a.pad - 2 * ipad
    fs = a.fs if a.fs else inner / (snap["cols"] * 0.6015)   # Menlo advance = .6015em
    open(a.out, "w").write(PAGE.format(W=a.w, H=a.h, fs=round(fs, 2), lh=a.lh, pad=a.pad,
                                       ipad=ipad, bg=BG_DEFAULT, page_bg=a.page_bg,
                                       align="stretch" if a.fill else ("flex-start" if a.top else "center"),
                                       ptop=a.top if a.top else a.pad,
                                       pbot=a.bottom if a.bottom else a.pad,
                                       winh="100%" if a.fill else "auto",
                                       title=html.escape(a.title), body=body))
    print("wrote", a.out)


if __name__ == "__main__":
    main()
