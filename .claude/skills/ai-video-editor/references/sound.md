# Sound design

Sound is half of "premium." A technically clean edit with a boring bed still reads as amateur.

---

## Music

### Two tracks, not one

- **Track A** (energetic, hooky) runs frame 1 → **the end of the retention line** (~11–15 s).
- **Track B** (a bed with more room under dialogue) runs to the end.
- Fade A out over ~0.45 s and hard-set B in.

> "Switch after the hook" means **the end of the retention line**, not the flare. The flare is
> only where Track A steps *up* from the under-voice level to the post-flare level.

A single track for the whole reel is also a valid choice — but it has to be asked for, and the
level still steps at the flare.

### Music must play from frame 1

A silent hook is boring and it always gets flagged. Many tracks open near-silent (−83 dB at
t=0 is common). **Measure the opening RMS before committing** —
`asetnsamples=24000,astats` over the first 40 s — and require `v[0] > −25 dB`; otherwise `-ss`
past the intro so the reel opens on music.

### Start on the actual first beat

> *"The frame that the music starts, that's where the music should start."*

Tracks carry 100–150 ms of encoder/room silence before the first attack. Find it and set the
media start just before it, so frame 1 **is** the downbeat:

```
scan 10 ms Peak_level windows → first above −18 dB = the attack
data-media-start = attack − 0.013
```

Do **not** `-ss` into a louder section for the hook track. (That trick is only for a t=0 that
is genuinely silent.)

### Find the track's break and land it on the flare

Scan RMS in 0.5 s windows and look for the one window ~15 dB below the mean — that is the
break. Then `-ss (break − flare_time)` so it falls on the hook turn, and **re-verify the new
t=0 is still above −25 dB.**

### Levels

**Landed calibration: 0.056 under voice, 0.135 after the flare**, fading out at the end.
Present, never competing with the voice.

Volume history, so you do not re-walk it: 0.045 = inaudible. 0.10 / 0.24 = too loud.
0.075 / 0.18 = still too loud. **0.056 / 0.135 = the values that survived review.**

**Level-match Track B instead of reusing 0.135 blindly.** Those numbers were calibrated on a
track with a −18.2 dB mean:

```
vol_B = 0.135 × 10^((mean_A − mean_B) / 20)
```

### Choosing a track

**Tone: light / curious. Not dark, not scary — and not boring.** A generic documentary or
marimba bed is a safe floor, not a taste: it meets every technical rule and still gets
rejected. What is wanted is a track with an actual groove and a hook of its own.

**Offer 2–3 and let the creator choose. Never lead with a stock documentary bed.**

> Licensing is the creator's call, not yours. Pull from whatever library they have configured
> in `config.json → music_dir`. Never bundle or redistribute music with this skill, and never
> suggest ripping a commercial track.

---

## The hook transition

At the hook turn (~9–15 s, on the first sentence boundary after the hook):

- a **long riser** (~1.7 s) ending exactly at the cut,
- an **aggressive double lens flare** (screen-blend, scale sweep 1.6 → 1.0),
- a white radial **bloom**,
- an **impact shutter** (layered big shutter + camera flash),
- a **boom**,
- and the music handoff.

All of them land on the same frame. If the cut moves, all of them move — including the matte,
which has to be re-run to cover the new hook length.

### Kill the hook bed before the riser

At the retention line, stop the hook track dead and leave **actual silence** until the next
sentence — the riser needs the room.

*Landed:* bed fades out over 0.30 s at 11.06, silence 11.36 → 13.19, riser 13.19 → 14.88,
flare + Track B both start at 14.88.

### Align a riser by its ENVELOPE, not by its file length

> *"End the riser exactly on the cut — not the sound effect itself, but the last audible piece
> of the riser."*

Most riser files carry trailing silence, so `start = cut − duration` lands the audible tail
early and the cut feels disconnected. Measure a 50 ms RMS envelope, find the last bucket above
~−20 dB relative to peak, and set `start = cut − that_offset`.

*(Example: a 0.894 s riser that goes silent at 0.80 s starts at `cut − 0.80`.)*

### Duck the music under every riser — don't cut it

> *"The music should be stopped exactly when the riser ends, with a little bit of a crossfade
> so it won't stop completely."*

Ramp the bed to ~25% over the riser's last 0.30 s so it bottoms out **on** the impact, then
back to full over ~1.1 s `power2.out`.

At a **track change**, the outgoing track goes to 0 over 0.55 s and the incoming one fades up
from 0.028 over 0.95 s out of the impact — never a hard in-point, which sounds like a splice.

### The music CUT-OUT is a different device — only when asked for by name

> *"When the riser ends, end the music and continue it only in the next cut."*

Kill the bed on the riser's landing frame (0.14 s fade) and restart on the **next segment
boundary** — the beat lands in silence, which is what sells it. This overrides the
duck-don't-cut rule wherever it is explicitly asked for; a cut-out is for a reveal line, a duck
is the default everywhere else.

Keep any boom on the landing **short (~1.1 s)** or its tail fills the silence you just made.

**Implement as two `<audio>` elements off the same file on different tracks**, the second with
`data-media-start = first_media_start + resume_time`, so the track continues where it *would*
have been instead of rewinding — the musical phrasing survives the gap.

*Landed:* riser lands on the 36.60 cut, bed out over 0.26 s, dead air under the reveal line,
bed back in over 0.90 s on the next cut at 39.22.

---

## SFX

### The reveal cue is a LOW WHOOSH, not a camera click

Pick by **spectral tilt, not by name**: measure `lowpass=f=250` vs `highpass=f=2000` mean and
take the most bass-heavy short one. *Landed:* a 0.48 s whoosh at +34 dB tilt, trimmed to 0.50 s
with `lowpass=f=1800` and a 0.16 s fade-out, fired **0.10 s before** the beat so the body of the
whoosh lands on it.

Level-match to whatever cue it replaces:
`vol = 0.34 × 10^((mean_old − mean_new)/20) × 0.85`.

**Only 5–7 cues per video**, on payoff beats. No vine-boom, ever.

### Level SFX by how far under the VOICE they land

Reusing another cue's calibration is how you end up with SFX ~15 dB under the voice —
measurably present, completely inaudible.

Measure it: render, then against a render without the cue,
`ratio = P_new / P_old − 1` per beat, `below_dB = −10 × log10(ratio)`.

**Target ~7 dB below the voice.** *Landed:* volumes 0.55 / 0.44 / 0.43 on clips normalised to
−6 dB peak; mean 7.4 dB below, peak −1.8 dBFS.

> A mix-RMS delta of only +0.1–0.2 dB means the cue is ~15 dB down and will not be heard. Do
> not accept that as "the SFX is in there."

### A tiered list gets a cue PER TIER, on EVERY beat

Not one cue per section. Three tiers (bad / ok / best) with three distinct cues.

If the source cues are screen recordings, isolate the sound first: RMS-scan at 10 ms, take the
loud island above `noise_floor + 14 dB`, cut with 0.05 s pre-roll + 0.14 s tail and a 0.10 s
fade-out, then normalise all tiers to a **common peak (−6 dB)** so no tier jumps out. Fire at
`beat − 0.05` so the attack lands on the beat, one track per tier.

### Other placements

- **Cash register** on a price reveal.
- **Short riser** into a mid-video turn ("but wait…").
- **A shutter click on every cut** in a fast article/montage sequence — this overrides the
  5–7-cues rule for that stretch, because the click *is* the rhythm.
- **A pop on every element in a numbered chain.** A silent number chain reads as unfinished.
- **A logo/brand pop fires on the WORD, not on the card boundary.** When asked to "add a pop to
  the X logo", fire it on the frame the brand name is spoken (from the word timings):
  `scale .30 → 1.14` in 0.26 s `power4.out`, settle to 1.0 in 0.20 s `back.out(3)`, with a pop
  cue at 0.62 on the same frame.

### Trimming a raw SFX file

Every synthesised or downloaded cue gets its leading silence removed before use:

```
silenceremove=start_periods=1:start_threshold=-45dB
```

*Landed hook mix:* pop 0.62 / whoosh 0.34 / click 0.80.

---

## Final audio check

- Peak on the master: **−1 to −2 dBFS** (`volumedetect`).
- No clipping inherited from the raw — see `references/cutting.md` §7.
- Listen to the whole thing once at the end. Every rule above is a proxy for that.
