#!/usr/bin/env python3
"""Generate index.html — the composition — from the beat map plus a media manifest.

THE POINT OF THIS SCRIPT is that every timed value is DERIVED, never hand-typed. When
you drop a line or re-cut, everything downstream moves; anything hardcoded in an HTML
template is left at the old second and a snapshot at the old time looks fine. Rebuild
instead of editing, and the stranded-time bug cannot happen.

It also applies the rules that are easy to forget by hand:
  * the ONE-FRAME BOUNDARY RULE — HyperFrames ends a <video> INCLUSIVE of the frame at
    start+duration but a timed <div> EXCLUSIVE of it, so hook videos get `end - 0.04`
    and hook overlay divs get `end`, and both land their last paint on the same frame
  * alternating track indices, so adjacent clips never share a track
  * every caption's CSS class comes from slot_at() — never a second, hand-kept table
  * caption durations of exactly `next - this - 0.005`, so no boundary frame stacks
  * every card surface sets font-family itself (a class that does not renders in serif)
  * a `tl.set` hard kill at every animated element's out-point
  * the A-roll's per-beat y state, emitted from the beat map

Inputs
  config.json        brand, language, project
  scripts/beats.py   BEATS / SLOT / END        (edit this per project)
  src/bounds.json    segment boundaries        (written by cut_aroll.py)
  media.json         the layers — see --example

Outputs
  index.html         the composition
  build/expected.json  {id: [start, duration]} — feed it to validate.py --expect

Usage
  python3 scripts/build_index.py --example > media.json    # a commented starting point
  python3 scripts/build_index.py --config config.json
  python3 scripts/validate.py --expect build/expected.json --html index.html
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hfcfg  # noqa: E402

beatmap, BEATS_PATH = hfcfg.load_beats()   # project copy wins over the skill's stub

FRAME = 0.04

EXAMPLE = {
    "title": "my reel",
    "aroll": "assets/aroll.mp4",
    "_comment_hook": "omit the whole 'hook' block for a reel that opens on plain A-roll",
    "hook": {
        "backdrop": "assets/hook_blurred.mp4",
        "matte": "assets/matte.webm",
        "end": 8.28,
        "_comment": "matte_* only when the hook carries a graphics cluster; a bare hook "
                    "gets NO transform. Never scale below ~0.78.",
        "matte_scale": 0.80,
        "matte_y": -31,
        "_comment_wide": "set matte_width/matte_left when you matted a source WIDER than "
                         "the frame because you are scaling the roto down",
        "matte_width": 1292,
        "matte_left": -212,
        "wash": True
    },
    "broll": [
        {"id": "b01", "src": "assets/broll/b01.mp4", "start": 11.56, "duration": 3.34,
         "mode": "full"},
        {"id": "b02", "src": "assets/broll/b02.mp4", "start": 14.90, "duration": 2.60,
         "mode": "panel"}
    ],
    "graphics": [
        {"id": "g1", "start": 14.90, "duration": 3.10, "class": "card ctr",
         "reveal": "unblur",
         "html": "<div class=\"inner\"><div class=\"kicker\">the price</div>"
                 "<div class=\"huge\">free</div></div>"}
    ],
    "audio": {
        "music": [
            {"id": "bgm1", "src": "assets/music/bed.mp3", "start": 0, "duration": 11.06,
             "media_start": 0.125, "volume": 0.056},
            {"id": "bgm2", "src": "assets/music/bed.mp3", "start": 14.88, "duration": 5.12,
             "media_start": 15.005, "volume": 0.135}
        ],
        "sfx": [
            {"id": "riser", "src": "assets/sfx/riser_long.wav", "start": 13.19,
             "duration": 1.69, "volume": 0.5},
            {"id": "impact", "src": "assets/sfx/shutter_impact.wav", "start": 14.88,
             "duration": 0.62, "volume": 0.6}
        ]
    },
    "flares": [{"id": "flare1", "src": "assets/flares/flare1_v.mp4", "start": 14.88,
                "duration": 1.20}],
    "_comment_captions": "'external' = composited outside the renderer by caption_layer.py "
                         "(the fix for caption ghosting). 'inline' = emitted here as clips.",
    "captions": "external"
}


class Tracks:
    """Same track index = no overlap, so adjacent clips must alternate. Groups keep
    unrelated layers off each other's tracks."""

    def __init__(self):
        self.base = {"hook": 0, "matte": 4, "aroll": 5, "broll": 6, "graphics": 10,
                     "music": 20, "sfx": 24, "flare": 30, "cap": 40}
        self.n = {k: 0 for k in self.base}

    def next(self, group, width=2):
        i = self.base[group] + (self.n[group] % width)
        self.n[group] += 1
        return i


def esc(s):
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def build(cfg, media, bounds, end):
    W = cfg["project"]["width"]
    H = cfg["project"]["height"]
    b = cfg["brand"]
    lang = cfg["language"]
    tr = Tracks()
    expected = {}
    body, tl = [], []

    def clip(tag, cid, cls, start, dur, group, extra="", inner="", self_close=False):
        idx = tr.next(group)
        if start + dur > end + 1e-6:
            raise SystemExit(f"{cid} runs to {start + dur:.3f}s, past END {end:.3f}s")
        expected[cid] = [round(start, 3), round(dur, 3)]
        a = (f'<{tag} id="{cid}" class="clip {cls}" data-start="{round(start, 3)}" '
             f'data-duration="{round(dur, 3)}" data-track-index="{idx}"{extra}')
        return f'      {a}></{tag}>' if self_close is False and not inner else \
               f'      {a}>{inner}</{tag}>'

    # ------------------------------------------------------------------ hook
    hook = media.get("hook")
    if hook:
        he = float(hook["end"])
        # THE ONE-FRAME BOUNDARY RULE: videos INCLUSIVE, timed divs EXCLUSIVE.
        # Same number on both leaves a frame of un-washed roto; `end - 0.04` on both
        # kills the wash a frame early. Split them.
        hv, hd = round(he - FRAME, 3), round(he, 3)
        if hook.get("backdrop"):
            body.append(clip("video", "hookbg", "", 0.0, hv, "hook",
                             f' src="{hook["backdrop"]}" muted playsinline'))
        if hook.get("wash", True):
            body.append(clip("div", "hookwash", "", 0.0, hd, "hook"))
        if hook.get("matte"):
            body.append(clip("video", "matte", "", 0.0, hv, "matte",
                             f' src="{hook["matte"]}" muted playsinline'))
            # ONE STATIC TRANSFORM for the whole hook. A scale drift reads as
            # "you changed my position on the third second".
            s, y = hook.get("matte_scale"), hook.get("matte_y")
            if s is not None or y is not None:
                parts = []
                if s is not None:
                    parts.append(f"scale: {s}")
                if y is not None:
                    parts.append(f"y: {y}")
                tl.append(f'      tl.set("#matte", {{ {", ".join(parts)} }}, 0);')

    # ----------------------------------------------------------------- A-roll
    body.append(clip("video", "aroll", "", 0.0, end, "aroll",
                     f' src="{media["aroll"]}" playsinline'))

    # Per-beat A-roll state, DERIVED from the beat map. Cuts are hard sets, exactly on
    # sentence starts.
    if beatmap and beatmap.BEATS:
        prev = None
        for start, kind, tag in beatmap.BEATS:
            if kind == "hook":
                continue
            state = ("scale: 1.02, y: 770" if kind == "panel" else "scale: 1.02, y: 0")
            if state != prev:
                tl.append(f'      tl.set("#aroll", {{ {state} }}, {round(start, 3)});'
                          f'   // {tag}')
                prev = state

    # ----------------------------------------------------------------- B-roll
    # B-ROLL HARD-CUTS IN AND SITS THERE — no entrance tween is emitted, ever.
    for c in media.get("broll", []):
        cls = "toppanel" if c.get("mode") == "panel" else "full"
        tag = "img" if str(c["src"]).lower().endswith((".png", ".jpg", ".jpeg")) else "video"
        extra = (f' src="{c["src"]}"' + ("" if tag == "img" else " muted playsinline"))
        if tag == "img":
            cls += " bimg"
        body.append(clip(tag, c["id"], cls, float(c["start"]), float(c["duration"]),
                         "broll", extra))

    # --------------------------------------------------------------- graphics
    for g in media.get("graphics", []):
        gid, st, du = g["id"], float(g["start"]), float(g["duration"])
        body.append(clip("div", gid, g.get("class", "card"), st, du, "graphics",
                         inner=g.get("html", "")))
        rev = g.get("reveal", "unblur")
        if rev == "unblur":
            # Reveals are an UN-BLUR, not a pop. The contents are frosted, so the card's
            # own rounded edge stays crisp. Fire on the CUT — a panel must never sit
            # empty waiting for its pop.
            tl.append(f'      tl.set("#{gid} .inner", {{ filter: "blur(20px)" }}, {st});')
            tl.append(f'      tl.to("#{gid} .inner", {{ filter: "blur(0px)", '
                      f'duration: 0.34, ease: "power2.out" }}, {st});')
        elif rev == "pop":
            tl.append(f'      tl.fromTo("#{gid}", {{ scale: 0.35, opacity: 0 }}, '
                      f'{{ scale: 1.10, opacity: 1, duration: 0.26, ease: "power4.out" }}, {st});')
            tl.append(f'      tl.to("#{gid}", {{ scale: 1.0, duration: 0.20, '
                      f'ease: "back.out(3)" }}, {round(st + 0.26, 3)});')
        # GSAP exits that end at a clip boundary need a hard kill
        # (lint: gsap_exit_missing_hard_kill).
        tl.append(f'      tl.set("#{gid}", {{ opacity: 0 }}, {round(st + du, 3)});')

    # ----------------------------------------------------------------- flares
    for f in media.get("flares", []):
        body.append(clip("video", f["id"], "flare", float(f["start"]), float(f["duration"]),
                         "flare", f' src="{f["src"]}" muted playsinline'))

    # ------------------------------------------------------------------ audio
    audio = media.get("audio", {})
    for group in ("music", "sfx"):
        for s in audio.get(group, []):
            ms = s.get("media_start")
            # An <audio> element REQUIRES an id or it renders silent.
            extra = f' src="{s["src"]}"'
            if ms is not None:
                extra += f' data-media-start="{ms}"'
            if s.get("volume") is not None:
                extra += f' data-volume="{s["volume"]}"'
            body.append(clip("audio", s["id"], group, float(s["start"]),
                             float(s["duration"]), group, extra))

    # --------------------------------------------------------------- captions
    caps_mode = media.get("captions", "external")
    if caps_mode == "inline" and os.path.exists("captions.json"):
        caps = json.load(open("captions.json", encoding="utf-8"))
        cap_track = tr.base["cap"]
        for c in caps:
            # The class comes from slot_at() — never from a second, hand-kept table.
            slot = beatmap.slot_at(c["start"]) if beatmap and beatmap.BEATS else "std"
            size = f' style="font-size:{c["size"]}px"' if c.get("size") else ""
            expected[f"c{c['i']:02d}"] = [round(c["start"], 3), round(c["dur"], 3)]
            body.append(f'      <div id="c{c["i"]:02d}" class="clip cap {slot}" '
                        f'data-start="{c["start"]}" data-duration="{c["dur"]}" '
                        f'data-track-index="{cap_track}">'
                        f'<span class="p"{size}>{c["text"]}</span></div>')

    # ------------------------------------------------------------------- CSS
    slot_css = "\n".join(
        f'      .cap.{k} {{ top: {v}px; }}'
        for k, v in sorted((beatmap.SLOT if beatmap else {}).items(), key=lambda x: x[1]))

    matte_css = ""
    if hook and hook.get("matte"):
        mw = hook.get("matte_width")
        ml = hook.get("matte_left")
        if mw and ml is not None:
            # transform-origin must be the FRAME's bottom-centre expressed in ELEMENT
            # coordinates, or the scale pivots off-centre and the subject slides sideways.
            origin = round((W / 2 - ml) / mw * 100, 1)
            matte_css = (f'      #matte {{ z-index: 30; inset: auto; left: {ml}px; top: 0;\n'
                         f'               width: {mw}px; height: {H}px; object-fit: fill;\n'
                         f'               transform-origin: {origin}% 100%; }}')
        else:
            matte_css = '      #matte { z-index: 30; transform-origin: 50% 100%; }'

    font_file = None
    fd = b["font_dir"] if os.path.isdir(b["font_dir"]) else \
        os.path.join(hfcfg.SKILL_DIR, "assets", "fonts")
    for f in sorted(os.listdir(fd)) if os.path.isdir(fd) else []:
        if f.lower().endswith((".ttf", ".otf")):
            font_file = os.path.join(b["font_dir"], f)
            break

    html = f"""<!doctype html>
<!-- GENERATED by scripts/build_index.py — do not hand-edit.
     Every timed value is derived from scripts/beats.py + media.json. Edit those and
     rebuild; a hand-edit here is a stranded time waiting to happen. -->
<html lang="{lang['code']}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width={W}, height={H}" />
    <title>{esc(media.get('title', 'reel'))}</title>
    <script src="assets/vendor/gsap.min.js"></script>
    <style>
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ margin: 0; width: {W}px; height: {H}px; overflow: hidden; background: #000; }}
      /* A variable font needs the full weight RANGE, or Chrome clamps it to one
         instance and every weight renders identically. */
      @font-face {{ font-family: "{b['font_family']}";
                   src: url("{font_file or 'assets/fonts/Rubik.ttf'}") format("truetype");
                   font-weight: 100 1000; }}
      #root {{ position: relative; width: {W}px; height: {H}px; overflow: hidden; background: #000; }}
      video {{ position: absolute; inset: 0; width: {W}px; height: {H}px; object-fit: cover; }}

      #hookbg {{ z-index: 5; }}
      #hookwash {{ position: absolute; inset: 0; z-index: 6;
        background:
          radial-gradient(90% 62% at 22% 14%, rgba(46,196,214,0.34) 0%, rgba(46,196,214,0) 62%),
          radial-gradient(88% 66% at 84% 30%, rgba(48,110,232,0.36) 0%, rgba(48,110,232,0) 60%),
          linear-gradient(168deg, rgba(9,38,58,0.62) 0%, rgba(6,22,40,0.70) 52%, rgba(4,12,24,0.80) 100%); }}
{matte_css}
      #aroll {{ z-index: 20; transform-origin: 50% 30%; }}

      /* Qualify the panel rule to (0,2,1) — `video, img.bimg {{ inset:0; height:{H}px }}`
         is (0,1,1) and would otherwise win, rendering every panel full frame. */
      video.full, img.bimg.full {{ z-index: 20; }}
      video.toppanel, img.bimg.toppanel {{ z-index: 22; inset: auto; left: 0; top: 0;
        width: {W}px; height: 900px; object-fit: cover; }}

      /* EVERY card surface must set font-family itself — a new class does NOT inherit
         it and the whole card silently renders in the default serif. Name Inter, not
         Helvetica/Arial: the renderer aliases those to Inter anyway. */
      .card {{ position: absolute; z-index: 40; left: 70px; right: 70px;
        font-family: "{b['font_family']}", "Inter", Arial, sans-serif;
        background:
          radial-gradient(96% 90% at 50% 0%, rgba(38,168,190,.30), rgba(38,168,190,0) 70%),
          linear-gradient(163deg, rgba(14,56,78,.96), rgba(6,26,40,.97) 55%, rgba(3,14,22,.98));
        border-radius: 34px; border: 2px solid rgba(64,214,222,.30);
        box-shadow: 0 34px 92px rgba(0,0,0,.82), 0 0 90px rgba(26,140,180,.20);
        padding: 60px 54px 200px; }}   /* leave the caption band empty */
      .card.ctr {{ top: 380px; }}
      .card.panel {{ top: 90px; }}
      .card .kicker {{ font-size: 34px; color: {b['accent']}; font-weight: 700; }}
      .card .huge {{ font-size: 168px; color: #fff; font-weight: 900;
                     text-shadow: 0 0 46px rgba(79,230,216,.55); }}
      .card .sub {{ font-size: 40px; color: #7fd4e8; font-weight: 600; }}

      /* An inline <svg class="clip"> renders across the WHOLE video — `.clip` does not
         hide svg. Start hidden and drive opacity from the timeline. */
      svg.clip {{ opacity: 0; }}

      .cap {{ position: absolute; left: 0; right: 0; z-index: 50; text-align: center;
             direction: {lang['direction']};
             font-family: "{b['font_family']}", "Inter", Arial, sans-serif;
             font-weight: 800; line-height: 1.0; }}
      .cap .p {{ display: inline-block; color: {b['caption_ink']};
                font-size: {b['caption_size']}px; background: {b['caption_plate']};
                border-radius: 22px; padding: 20px 34px 26px;
                box-shadow: 0 10px 34px rgba(0,0,0,0.42); white-space: nowrap; }}
{slot_css}
      .ltr {{ unicode-bidi: isolate; direction: ltr; }}

      .flare {{ z-index: 60; mix-blend-mode: screen; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="{esc(media.get('title', 'reel'))}" data-duration="{round(end, 3)}">
{chr(10).join(body)}
    </div>
    <script>
      const tl = gsap.timeline({{ paused: true }});
{chr(10).join(tl)}
      window.__timelines = window.__timelines || {{}};
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
"""
    return html, expected


def main():
    ap = hfcfg.arg_parser(__doc__)
    ap.add_argument("--media", default="media.json")
    ap.add_argument("--out", default="index.html")
    ap.add_argument("--bounds", default="src/bounds.json")
    ap.add_argument("--example", action="store_true",
                    help="print a starting media.json and exit")
    a = ap.parse_args()

    if a.example:
        print(json.dumps(EXAMPLE, indent=2))
        return 0

    cfg = hfcfg.load(a.config)
    if not os.path.exists(a.media):
        sys.exit(f"{a.media} not found — start one with:\n"
                 f"    python3 scripts/build_index.py --example > {a.media}")
    media = json.load(open(a.media, encoding="utf-8"))
    media = {k: v for k, v in media.items() if not k.startswith("_comment")}

    if not os.path.exists(a.bounds):
        sys.exit(f"{a.bounds} not found — run scripts/cut_aroll.py first")
    d = json.load(open(a.bounds, encoding="utf-8"))
    bounds, end = d["bounds"], d["total"]

    # Composition duration = the A-ROLL's REAL duration. Setting it short silently
    # chops the last word.
    if beatmap:
        beatmap.END = end
        if beatmap.BEATS:
            # ASSERT EVERY BEAT START IS A REAL SEGMENT BOUNDARY before building
            # anything. A beat mid-sentence is a cut that fires early.
            beatmap.assert_on_boundaries(bounds)
        else:
            print("  ! scripts/beats.py has no beats yet — the A-roll will hold one state "
                  "for the whole reel. Fill in BEATS, then rebuild.")

    html, expected = build(cfg, media, bounds, end)
    open(a.out, "w", encoding="utf-8").write(html)
    os.makedirs("build", exist_ok=True)
    json.dump(expected, open("build/expected.json", "w"), indent=1)

    print(f"  beat map: {BEATS_PATH or '(none found)'}"
          f"  {len(beatmap.BEATS) if beatmap else 0} beats")
    print(f"  {a.out}  {len(expected)} timed elements, END {end:.3f}s")
    print(f"  build/expected.json written — now run:")
    print(f"    python3 scripts/validate.py --expect build/expected.json --html {a.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
