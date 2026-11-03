# Render, master and delivery

---

## Render

```bash
HF_VIDEO_COVERAGE_THRESHOLD=0 npx hyperframes render --quality high --video-bitrate 32M
```

→ mp4 1080x1920, **30–35 Mbps**. Never ship the ~7 Mbps default: social platforms re-encode
everything, and a low-bitrate source comes out of that mangled.

Then composite the caption layer and pin the master to SDR:

```bash
python3 scripts/finish.py           # overlay assets/captions.webm + force bt709 + assert
```

---

## Verify before delivering

| Check | Command | Pass |
|---|---|---|
| Duration | `ffprobe -show_entries format=duration` | Matches the A-roll's real duration, plus ~0.6 s tail |
| Bitrate | `ffprobe -show_entries format=bit_rate` | 30–35 Mbps |
| Colour | `ffprobe -show_entries stream=color_space,color_transfer,color_primaries` | `bt709` everywhere; **no** `bt2020` / `arib-std-b67` / `smpte2084` |
| Pixel format | same probe | `yuv420p` (8-bit) |
| Audio peak | `ffmpeg -i out.mp4 -af volumedetect -f null -` | max ≈ **−1 to −2 dB** |
| Frames | full contact sheet of the **encoded** file | every beat + boundary frames checked |

```bash
python3 scripts/preflight_qa.py . --aroll assets/aroll.mp4 \
        --transcript src/aroll.json --render renders/final.mp4
```

Then walk `references/checklist.md`. Every line on it is a note somebody has already had to
give once.

---

## Preview

```bash
npx hyperframes preview --port 3002
```

Run it from a **local** copy — an external or network volume is too slow to scrub.

**Kill the preview server before editing the composition** (see `references/hyperframes.md`) —
it rewrites `index.html` while it runs.

---

## File placement

Set these once in `config.json` and never deviate afterwards — a predictable structure is what
makes a two-year-old project findable:

```json
{
  "paths": {
    "archive_root": "/Volumes/<Drive>",
    "exports":      "{archive_root}/Social Media/Final Exports",
    "projects":     "{archive_root}/Social Media/Footage/{date}/{topic}",
    "assets":       "{archive_root}/Assets"
  }
}
```

- **Final export** → `exports/<short-topic-name>.mp4`
- **Whole project + footage** → `projects/` (one folder per shoot date, one per topic inside)
- **SFX / music / fonts stay in `assets/`.** Never copy generic library assets into a footage
  folder — that is how a 2 TB drive becomes a 6 TB drive holding four copies of the same riser.

**Verify with file counts plus a `cmp` byte-compare before deleting any local copy.** A sync
that "looks done" and a sync that is done are different things.

---

## A/B hook variants

Creators often record **two alternative opening sentences** and want both cut as separate
videos to A/B test.

1. Cut the sentence segments once.
2. Concat `s01 + body` and `s02 + body` into `arollA.mp4` / `arollB.mp4`.
3. **Re-transcribe EACH** — the body timings shift by the hook-length delta, so version B's
   captions are not version A's captions offset by a constant, they are their own build.
4. Build one composition per version.

HyperFrames allows only ONE root `index.html` with `data-composition-id`. Keep the variants in
`archive/index_A_final.html` / `index_B_final.html` and swap the active one into `index.html`
before each render.

Name the exports `<topic> - hook 1.mp4` / `<topic> - hook 2.mp4`.

---

## Handing it over

Present:

- the final file path,
- a contact sheet of the encoded master,
- the duration, bitrate and audio peak,
- anything you flagged and did **not** fix (a factual mismatch in the script, a shot that stays
  wide because punching in is banned, a trade-off you had to pick between).

State trade-offs explicitly. "I raised him 35 px and let the centre card overlap his crown by
20 px, because 2× logos and raising him were the same budget" is a useful sentence. Silently
picking one and hoping is not.
