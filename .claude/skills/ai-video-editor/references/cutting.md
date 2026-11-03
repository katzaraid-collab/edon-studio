# Cutting the A-roll

The cut is the quality gate. Everything downstream inherits its timing, so a millisecond of
drift here becomes a visible mistake forty seconds later.

---

## 1. Find the takes

Transcribe the raw once with word timestamps:

```bash
uvx --from mlx-whisper mlx_whisper raw.wav \
  --model mlx-community/whisper-large-v3-turbo \
  --language <lang> --word-timestamps True --output-format json
```

**The last take of a repeated line wins.** People re-record until they like it; the keeper is
almost always the final attempt.

**Traps in this step:**

- **Back-to-back repeated sentences get merged into one long "word."** Any lone token spanning
  2 s+ is a merge — re-transcribe that slice in isolation to find the hidden repeat.
- **Whisper's word alignment is unreliable wherever there are aborted takes.** It will smear
  one sentence across a 10 s span that actually holds a false start *plus* the real take.
  Trust `silencedetect`, not Whisper, for structure:
  1. map the speech islands,
  2. re-transcribe **each island separately** (`-ss` / `-to` on the island bounds),
  3. only that tells you which island is the complete take.
- **Cross-check at −40 dB.** A quietly-spoken take can read as silence at −33 dB and vanish
  from the map entirely.

---

## 2. Tighten to speech chunks, not takes

Cutting at take level is not tight enough — the standing note is always "the cuts are a bit
too slow."

1. Split every chosen take on internal silences (`silencedetect noise=-30dB:d=0.20`) and
   **transcribe each chunk in isolation.** Run this audit on **every** chosen take, not just
   the suspicious ones. This is the only thing that exposes a false start hiding inside an
   otherwise-good take — e.g. a take that opens with a half-sentence, restarts, and finishes
   clean. The aborted half is invisible in a take-level transcript and glaringly obvious on
   screen.
2. Concat chunks, not takes.
3. **Derive the edited gap from the original pause** so the speaker's rhythm survives:

   ```
   gap  = clamp(0.60 × original_pause, 0.15, 0.32)
   lead = 0.06
   tail = max(gap − lead, 0.09)
   ```

   Across a topic/category boundary use a flat **0.26**. This is still aggressive — it removes
   ~7% of a typical raw — without running phrases together. **Do not crush every gap to the
   floor:** a 0.06 s total gap makes the speaker sound like they are interrupting themselves.
4. **The closing segment takes `tail = 0.45`**, not the body tail. Without it the final word
   reads as clipped even though every syllable is present — what is missing is the decay plus
   a beat of air for the CTA to land on.
5. Target: `silencedetect -33dB:d=0.20` on the finished A-roll returns **zero** hits.

### A word clipped at its own segment head is fixed by MERGING, not by nudging the in-point

The −26 dB gate fires on a loud voiced consonant and drops the quieter fricative in front of
it, so the transcript comes back **missing a leading letter** — that is the tell. Nudging
`src_start` earlier just re-runs the same gate on the same audio.

Merge the chunk into its predecessor instead: the audio becomes continuous across the join,
mid-segment audio is never gated, and the natural pause survives — which is exactly what
"sounds like a complete sentence" means. Keep a `MERGE = [("c05","c06")]` list beside `DROP`
in the cut script; the merged chunk takes the first's `onset_raw` and the second's
`offset_raw`.

**Re-check any B-roll sitting on that beat** — merging lengthens the segment, so its clip has
to be rebuilt longer.

---

## 3. Find the onset at SPEECH level

`silencedetect` at −33/−40 dB stops at breath and room tone, which sit **40–150 ms before the
first consonant.** Cut there and there is an audible beat of nothing before the sentence.

Measure the first 10 ms window above **−26 dB** instead:

```bash
ffmpeg -y -t 1.2 -i SEG -af "asetnsamples=480,astats=metadata=1:reset=1,\
ametadata=print:key=lavfi.astats.Overall.RMS_level:file=/tmp/on.txt" -f null /dev/null
```

Take the first `pts_time` whose `RMS_level > -26`. (Note: **do not pass `-v error`** — it
suppresses the astats output entirely.)

### Bound the search window on BOTH sides

Searching a flat `start − 0.6 s` catches the **previous** chunk's tail, and the offset search
catches the **next** chunk's head — silently gluing neighbouring sentences together. For
chunk *i*:

```
lo = max(start_i − 0.6, end_{i−1} + 0.005)
hi = min(end_i + 0.5, start_{i+1} − 0.005)
```

**Add an explicit floor just after any DROPPED false start.** A discarded take is not in the
chunk list, so nothing else stops the search locking onto its tail.

> A shift that comes back as exactly `−0.600` — your search-window edge — is always this bug,
> never a real onset.

---

## 4. Land the speech one frame in

Cut so true speech lands **exactly 0.04 s (one frame) into the segment**: enough runway that a
plosive is not clipped, too little to read as dead air.

Iterate: measure, shift the start by `(speech_onset − 0.04)`, re-cut, re-measure, until every
segment reads 0.02–0.05 s.

- `end = last_word_end + tail`
- Fades: **0.02 s in**, ≤ **0.055 s out**. A 0.06 s fade-in eats the first consonant when
  speech starts at 0.04 s. The fade-out must start well after the last speech sample:
  `fade_out ≤ tail − 0.035`, always.
- Encode: `scale=1080:1920`, `-r 25`, `-crf 16 -preset medium`, AAC 256k. Concat with the
  demuxer.

To re-time a fade without re-timing the edit, keep the stored `src_start` / `src_end` and only
re-encode — durations stay identical, so no caption needs touching.

---

## 5. Quantise every segment to whole frames

**This is the cause of the single most-repeated note in this pipeline.**

A non-frame-aligned duration encodes *longer* than requested (25 fps rounds up), so the
planned cumulative boundaries drift later and later than the real concat — 0.27 s by the end
of a 59 s cut. Every layout cut then fires **before** its sentence actually starts, which
reads on screen as *"you cut into the next sentence but the old one is still up."*

```python
nframes = math.ceil(dur / 0.04)
# encode with:  -frames:v nframes  -t nframes*0.04
```

Build the timeline from those exact values, then **prove it**: ffprobe every segment,
accumulate, and assert real == planned to under 1 ms before touching the composition.

### Count PACKETS, not seconds

```bash
ffprobe -v error -select_streams v:0 -count_packets \
        -show_entries stream=nb_read_packets -of csv=p=0 seg.mp4
```

`sum(segment frames) == concat frames` and `cum_frames × 0.04 == planned_start` for every
segment means the cut is frame-exact. Anything else is drift.

Do this instead of trusting `format=duration`, which reports the AAC tail (~20 ms past the
last video frame) and makes a perfect concat look 0.02 s long.

### Do NOT "verify" boundaries by onset-detecting from `start − 0.25 s`

Segments are butt-joined with only ~0.03 s of tail, so that window is still inside the
*previous* sentence, and every boundary falsely reads as ~0.25 s of drift. Search from the
boundary **forward** (`-ss start -t 0.6`); a healthy segment answers 0.03–0.07 s.

---

## 6. Verify

```bash
ffmpeg -i aroll.mp4 -af "silencedetect=noise=-33dB:d=0.3" -f null -
```

Only natural mid-sentence breaths may survive. Then **re-transcribe the FINAL A-roll** for
caption timings — captions must be built in the final timebase, never the raw's.

**Composition duration = the A-roll's real duration.** Setting it short silently chops the last
word. Check that the last speech sample sits inside the composition, and leave ~0.6 s of tail
after the final syllable or the ending reads as cut off even when every word is present.

---

## 7. Audio level of the raw

Raw recordings sometimes arrive **already clipped at 0.0 dBFS.** The render inherits it and
preflight fails on it. Check the A-roll's peak before rendering and fix with a plain
`volume=-2dB` on the audio (`-c:v copy`, durations unchanged → no caption needs touching).

**Do not use `alimiter`** — its auto-makeup gain pushes the peak straight back to 0.0 dB and
raises the mean.
