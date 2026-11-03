#!/usr/bin/env python3
"""Build the caption cards: ONE line, 3-4 words each, zero gaps.

Rules, in order (references/captions.md):
  1. merge the transcriber's split tokens (a prefix particle + a hyphenated Latin word,
     a brand name split in half) — config → language.merge_next
  2. HARD break after any sentence-ending word: a card must never carry the tail of one
     sentence and the head of the next
  3. soft break after a comma, or before a clause opener, once the card has >= 2 words
  4. 4-word ceiling
  5. no 1-word orphans (fold back if there is room, otherwise lend the previous card's
     last word — 3+2 beats 4+1)
  6. never split a locked phrase

Timing:
  * the FIRST card of each sentence starts at the SEGMENT BOUNDARY, not at the
    transcriber's first-word stamp (word starts run 0.03-0.15 s late, so the previous
    card otherwise lingers over the new sentence)
  * mid-sentence cards get a small LEAD, clamped to the boundary
  * duration = next_start - this_start - 0.005
    (the clip window is inclusive at both ends: without the 0.005 both cards render on
    the boundary frame and you get one frame of stacked text. 0.005 can never open a
    gap, because frame times are 0.04 s apart.)

Input   src/words.json   [[start, end, "word"], ...] from the FINAL A-roll transcript
Output  captions.json    [{i, start, dur, text, plain, n}, ...]
"""
import html
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hfcfg  # noqa: E402

FRAME = 0.04
MAXW = 4
SENT_END = (".", "?", "!", "…")


def load_words(path):
    """Accepts either [[s,e,w],...] or a whisper json with segments[].words[]."""
    d = json.load(open(path, encoding="utf-8"))
    if isinstance(d, dict) and "segments" in d:
        out = []
        for s in d["segments"]:
            for w in s.get("words", []):
                out.append([float(w.get("start", 0)), float(w.get("end", 0)),
                            str(w.get("word", "")).strip()])
        return out
    return [[float(a), float(b), str(c).strip()] for a, b, c in d]


def normalise(words, lang):
    """Merge split tokens and fix known transcriber typos."""
    typos = lang.get("typos") or {}
    merge_next = lang.get("merge_next") or {}
    out, i = [], 0
    while i < len(words):
        a, b, w = words[i]
        w = w.strip()
        if i + 1 < len(words):
            nxt = words[i + 1][2].strip()
            # "<particle>" + "-Latin"  →  one visual unit
            if nxt.startswith("-") and len(nxt) > 1:
                out.append([a, words[i + 1][1], w + nxt])
                i += 2
                continue
            if merge_next.get(w) == nxt.rstrip(",.?!"):
                out.append([a, words[i + 1][1], (w + nxt).replace(" ", "")])
                i += 2
                continue
        core = w.rstrip(",.?!…")
        tail = w[len(core):]
        out.append([a, b, typos.get(core, core) + tail])
        i += 1
    return out


def is_end(w):
    return w.rstrip().endswith(SENT_END)


def split_cards(words, lang):
    openers = set(lang.get("clause_openers") or [])
    locked = [tuple(p) for p in (lang.get("locked_phrases") or [])]

    def locked_with_prev(prev, w):
        core = w.rstrip(",.?!…")
        return any(len(p) == 2 and prev.rstrip(",.?!…") == p[0] and core == p[1] for p in locked)

    cards, cur = [], []
    for a, b, w in words:
        if cur:
            prev = cur[-1][2]
            must_stay = locked_with_prev(prev, w)
            hard = is_end(prev)
            soft = prev.rstrip().endswith(",") or (w.rstrip(",.?!…") in openers and len(cur) >= 2)
            if not must_stay and (hard or len(cur) >= MAXW or (soft and len(cur) >= 2)):
                cards.append(cur)
                cur = []
        cur.append([a, b, w])
    if cur:
        cards.append(cur)

    out = []
    for c in cards:
        if len(c) == 1 and out and not is_end(out[-1][-1][2]):
            if len(out[-1]) < MAXW:
                out[-1].extend(c)
                continue
            if len(out[-1]) >= 3:                 # 3+2 beats 4+1
                c = [out[-1].pop()] + c
        out.append(c)
    return out


def render_text(card, direction):
    """Wrap Latin runs in an isolated LTR span. In a caption the verbatim rule wins, so
    you cannot rewrite the Latin away to dodge bidi reordering — isolate it instead."""
    parts = []
    for _, _, w in card:
        if direction == "rtl" and re.search(r"[A-Za-z]", w):
            m = re.match(r"^([^A-Za-z]*)([A-Za-z][A-Za-z'’0-9.\-]*)(.*)$", w)
            if m:
                pre, lat, post = m.groups()
                parts.append(f'{html.escape(pre)}'
                             f'<span class="ltr">{html.escape(lat)}</span>'
                             f'{html.escape(post)}')
                continue
        parts.append(html.escape(w))
    return " ".join(parts)


def snap(t):
    return round(round(t / FRAME) * FRAME, 3)


def main():
    ap = hfcfg.arg_parser(__doc__)
    ap.add_argument("--words", default="src/words.json")
    ap.add_argument("--bounds", default="src/bounds.json")
    ap.add_argument("--out", default="captions.json")
    a = ap.parse_args()
    cfg = hfcfg.load(a.config)
    lang = cfg["language"]
    lead = cfg["cutting"]["lead"]

    words = normalise(load_words(a.words), lang)
    cards = split_cards(words, lang)

    bounds, end = [], None
    if os.path.exists(a.bounds):
        d = json.load(open(a.bounds, encoding="utf-8"))
        bounds, end = d["bounds"], d["total"]
    if end is None:
        end = max(w[1] for w in words) + 0.60

    # First card of a sentence snaps to its SEGMENT BOUNDARY; mid-sentence cards get a
    # lead, clamped to that boundary. Whisper reports word starts 0.03-0.15 s late, so
    # without the snap the previous card lingers over the new sentence.
    starts = []
    for c in cards:
        w0 = c[0][0]
        b = max([x for x in bounds if x <= w0 + 0.20], default=None)
        # this card is the first of its segment when the PREVIOUS card began before b
        first_of_segment = b is not None and (not starts or starts[-1] < b - 1e-6)
        t = b if first_of_segment else max(w0 - lead, b if b is not None else 0.0)
        starts.append(snap(t))
    for i in range(1, len(starts)):
        if starts[i] <= starts[i - 1]:
            starts[i] = round(starts[i - 1] + FRAME, 3)

    rows = []
    for i, c in enumerate(cards):
        s = starts[i]
        nxt = starts[i + 1] if i + 1 < len(starts) else end
        rows.append({"i": i + 1, "start": round(s, 3),
                     "dur": round(max(nxt - s - 0.005, FRAME), 3),
                     "text": render_text(c, lang["direction"]),
                     "plain": " ".join(w for _, _, w in c), "n": len(c)})

    json.dump(rows, open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    # ------------------------------------------------------------- assertions
    problems = []
    over = [r for r in rows if r["n"] > MAXW]
    if over:
        problems.append(f"{len(over)} card(s) over {MAXW} words")
    for i in range(len(rows) - 1):
        gap = rows[i + 1]["start"] - (rows[i]["start"] + rows[i]["dur"])
        if gap > 0.0055:
            problems.append(f"GAP of {gap:.3f}s before card {rows[i+1]['i']} — blank frames")
        if gap < -1e-6:
            problems.append(f"OVERLAP before card {rows[i+1]['i']}")
    missing = [b for b in bounds if not any(abs(r["start"] - b) < 1e-6 for r in rows)]
    if missing:
        problems.append(f"{len(missing)} segment boundary/ies with no caption change: "
                        f"{[round(m,2) for m in missing][:6]}")

    print(f"{len(rows)} cards, {sum(r['n'] for r in rows)} words, "
          f"max {max(r['n'] for r in rows)} words/card, {rows[0]['start']} → {end}")
    for r in rows:
        print(f"  c{r['i']:02d} {r['start']:6.2f} +{r['dur']:4.2f} [{r['n']}]  {r['plain']}")
    if problems:
        print("\n  ✗ " + "\n  ✗ ".join(problems))
        return 1
    print("\n  ✓ zero gaps, zero overlaps, every sentence boundary has a caption change")
    return 0


if __name__ == "__main__":
    sys.exit(main())
