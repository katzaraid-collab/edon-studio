"""Original music bed for the HaOfe reel: warm acoustic pop, 100 BPM, D major.

Beat grid matches edit.py: music beat m = edit beat b + 5, so the groove
lands at m = 5 (3.0 s), the oven reveal at m = 33 (19.8 s) and the end card
at m = 65 (39.0 s).

Usage: python3 -I music.py OUT_DIR   -> writes music.mid and crash.mid
"""
import random
import sys
from pathlib import Path

import mido

OUT = Path(sys.argv[1])
TPB = 480
BPM = 100
random.seed(7)

# GM programs
NYLON, STEEL, PIANO, GLOCK, STRINGS, BASS = 24, 25, 0, 9, 48, 32
KICK, STICK, SNARE, CLAP, HAT, OHAT, CRASH, SHAKER, TAMB = 36, 37, 38, 39, 42, 46, 49, 82, 54

notes = []  # (channel, start_beat, dur_beats, pitch, velocity)


def n(ch, start, dur, pitch, vel, human=True):
    if human:
        start += random.uniform(-0.012, 0.012)
        vel += random.randint(-6, 6)
    notes.append((ch, max(0.0, start), dur, pitch, max(1, min(127, vel))))


def P(name):
    names = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7,
             "G#": 8, "A": 9, "A#": 10, "B": 11}
    return 12 * (int(name[-1]) + 1) + names[name[:-1]]


VOICING = {
    "D": ["D3", "A3", "D4", "F#4"],
    "A": ["A2", "E3", "A3", "C#4", "E4"],
    "Bm": ["B2", "F#3", "B3", "D4", "F#4"],
    "G": ["G2", "B2", "D3", "G3", "B3", "G4"],
    "Em": ["E2", "B2", "E3", "G3", "B3", "E4"],
}
ROOT = {"D": "D2", "A": "A1", "Bm": "B1", "G": "G1", "Em": "E2"}
FIFTH = {"D": "A2", "A": "E2", "Bm": "F#2", "G": "D2", "Em": "B2"}
PAD = {"D": ["D4", "F#4", "A4"], "A": ["C#4", "E4", "A4"], "Bm": ["D4", "F#4", "B4"],
       "G": ["D4", "G4", "B4"], "Em": ["E4", "G4", "B4"]}
PROG = ["D", "A", "Bm", "G"]

# melody per chord (beat offset, length, note)
MEL = {
    "D": [(0, 1, "F#5"), (1, .5, "A5"), (1.5, .5, "F#5"), (2, 1, "E5"), (3, 1, "D5")],
    "A": [(0, 1, "E5"), (1, .5, "C#5"), (1.5, .5, "E5"), (2, 1.5, "A5")],
    "Bm": [(0, 1, "D5"), (1, .5, "F#5"), (1.5, .5, "B5"), (2, 1, "A5"), (3, 1, "F#5")],
    "G": [(0, 1, "G5"), (1, .5, "F#5"), (1.5, .5, "E5"), (2, 2, "D5")],
}

CH_GTR, CH_BASS, CH_PIANO, CH_GLOCK, CH_PAD, CH_DRUM = 0, 1, 2, 3, 4, 9


def strum(start, chord, vel, down=True, length=0.5, top=None):
    v = VOICING[chord]
    if not down:
        v = list(reversed(v[-(top or 4):]))
    for i, p in enumerate(v):
        n(CH_GTR, start + i * 0.02, length, P(p), vel - (0 if down else 14) - i * 2, human=False)


def guitar_bar(m, chord, vel=78):
    pattern = [(0, True, 1.0), (1, True, .5), (1.5, False, 1.0), (2.5, False, .5),
               (3, True, .5), (3.5, False, .5)]
    for off, down, ln in pattern:
        strum(m + off + random.uniform(-0.01, 0.01), chord, vel + random.randint(-4, 4), down, ln)


def bass_bar(m, chord, vel=88):
    r, f = P(ROOT[chord]), P(FIFTH[chord])
    n(CH_BASS, m, 1.0, r, vel)
    n(CH_BASS, m + 1.5, 0.5, r, vel - 10)
    n(CH_BASS, m + 2, 1.0, f, vel - 4)
    n(CH_BASS, m + 3, 0.5, r + 12, vel - 12)
    n(CH_BASS, m + 3.5, 0.5, f, vel - 14)


def pad_bar(m, chord, vel=42, beats=4):
    for p in PAD[chord]:
        n(CH_PAD, m, beats, P(p) - 12, vel, human=False)


def melody_bar(m, chord, ch, vel, octave=0):
    for off, ln, p in MEL[chord]:
        n(ch, m + off, ln * 0.95, P(p) + 12 * octave, vel)


def drums_a(m):
    for b in (0, 2):
        n(CH_DRUM, m + b, .25, KICK, 92, human=False)
    n(CH_DRUM, m + 2.5, .25, KICK, 64, human=False)
    for b in (1, 3):
        n(CH_DRUM, m + b, .25, STICK, 70)
    for i in range(8):
        n(CH_DRUM, m + i * .5, .25, HAT, 58 if i % 2 == 0 else 42)
    for i in range(16):
        n(CH_DRUM, m + i * .25, .2, SHAKER, 40 if i % 4 == 2 else 26)


def drums_c(m, fill=False):
    for b in (0, 1.75, 2, 2.5):
        n(CH_DRUM, m + b, .25, KICK, 100 if b in (0, 2) else 70, human=False)
    for b in (1, 3):
        n(CH_DRUM, m + b, .25, SNARE, 84)
        n(CH_DRUM, m + b + 0.01, .25, CLAP, 80)
        n(CH_DRUM, m + b, .25, TAMB, 60)
    for i in range(8):
        n(CH_DRUM, m + i * .5, .25, HAT, 64 if i % 2 == 0 else 46)
    n(CH_DRUM, m + 3.5, .4, OHAT, 56)
    for i in range(16):
        n(CH_DRUM, m + i * .25, .2, SHAKER, 44 if i % 4 == 2 else 28)
    if fill:
        for i, b in enumerate((3, 3.25, 3.5, 3.75)):
            n(CH_DRUM, m + b, .2, SNARE, 60 + i * 10)


# ---- intro: m 0-4 (hook) ----
arp = ["D4", "A4", "E5", "F#5", "A5", "F#5", "E5", "A4"]
for i, p in enumerate(arp):
    n(CH_PIANO, i * 0.5, 0.9, P(p), 58 if i % 2 == 0 else 48)
n(CH_GLOCK, 0.0, 1.0, P("F#6"), 52)
n(CH_GLOCK, 2.0, 1.0, P("A6"), 48)
pad_bar(0, "D", vel=38, beats=4)
n(CH_BASS, 0, 4, P("D2"), 60)
# m 4-5: the rewind. Music drops out; a snare pickup leads into the groove.
for i, b in enumerate((4.5, 4.625, 4.75, 4.875)):
    n(CH_DRUM, b, .12, SNARE, 50 + i * 12, human=False)

# ---- A: m 5-29 (dough) ----
for k in range(6):
    m = 5 + 4 * k
    ch = PROG[k % 4]
    guitar_bar(m, ch)
    bass_bar(m, ch)
    drums_a(m)
    if k >= 2:
        melody_bar(m, ch, CH_PIANO, 60)
n(CH_DRUM, 5, 1.5, CRASH, 88, human=False)

# ---- B: m 29-33 (proofing) breakdown, G -> A lifts into the oven ----
strum(29, "G", 72, True, 2.0)
strum(31, "A", 76, True, 2.0)
pad_bar(29, "G", vel=56, beats=2)
pad_bar(31, "A", vel=60, beats=2)
n(CH_BASS, 29, 2, P("G1"), 76)
n(CH_BASS, 31, 2, P("A1"), 80)
for i in range(16):
    n(CH_DRUM, 29 + i * .25, .2, SHAKER, 30 + i * 2)
for i, b in enumerate((32, 32.25, 32.5, 32.75, 32.875)):
    n(CH_DRUM, b, .12, SNARE, 56 + i * 12, human=False)

# ---- C: m 33-57 (oven + packing) full ----
for k in range(6):
    m = 33 + 4 * k
    ch = PROG[k % 4]
    guitar_bar(m, ch, vel=84)
    bass_bar(m, ch, vel=94)
    drums_c(m, fill=(k == 5))
    pad_bar(m, ch, vel=48)
    melody_bar(m, ch, CH_PIANO, 66)
    melody_bar(m, ch, CH_GLOCK, 50, octave=1)
n(CH_DRUM, 33, 1.5, CRASH, 100, human=False)

# ---- D: m 57-65 (shelf + store) ----
for k in range(2):
    m = 57 + 4 * k
    ch = PROG[k % 4]
    guitar_bar(m, ch, vel=80)
    bass_bar(m, ch, vel=90)
    drums_c(m, fill=(k == 1))
    pad_bar(m, ch, vel=46)
    melody_bar(m, ch, CH_PIANO, 62)
n(CH_DRUM, 57, 1.5, CRASH, 86, human=False)

# ---- outro: m 65 (end card) final chord rings out ----
strum(65, "D", 92, True, 6.0)
n(CH_BASS, 65, 6, P("D2"), 96, human=False)
n(CH_DRUM, 65, .3, KICK, 108, human=False)
n(CH_DRUM, 65, 3, CRASH, 96, human=False)
for p in ("D4", "F#4", "A4", "D5"):
    n(CH_PIANO, 65, 6, P(p), 70, human=False)
for p in ("D4", "F#4", "A4"):
    n(CH_PAD, 65, 6, P(p) - 12, 56, human=False)
for i, p in enumerate(("D6", "F#6", "A6", "D7")):
    n(CH_GLOCK, 65.5 + i * 0.5, 2.0, P(p), 54 - i * 3)


def write(path, events, programs):
    mid = mido.MidiFile(ticks_per_beat=TPB)
    tr = mido.MidiTrack()
    mid.tracks.append(tr)
    tr.append(mido.MetaMessage("set_tempo", tempo=mido.bpm2tempo(BPM), time=0))
    for ch, prog in programs.items():
        tr.append(mido.Message("program_change", channel=ch, program=prog, time=0))
    tr.append(mido.Message("control_change", channel=CH_PAD, control=7, value=80, time=0))
    tr.append(mido.Message("control_change", channel=CH_GLOCK, control=7, value=88, time=0))
    tr.append(mido.Message("control_change", channel=CH_DRUM, control=7, value=104, time=0))
    msgs = []
    for ch, start, dur, pitch, vel in events:
        on = int(round(start * TPB))
        off = int(round((start + dur) * TPB))
        msgs.append((on, 1, mido.Message("note_on", channel=ch, note=pitch, velocity=vel)))
        msgs.append((off, 0, mido.Message("note_off", channel=ch, note=pitch, velocity=0)))
    msgs.sort(key=lambda x: (x[0], x[1]))
    now = 0
    for tick, _, msg in msgs:
        tr.append(msg.copy(time=tick - now))
        now = tick
    mid.save(path)


write(OUT / "music.mid", notes,
      {CH_GTR: STEEL, CH_BASS: BASS, CH_PIANO: PIANO, CH_GLOCK: GLOCK, CH_PAD: STRINGS})
# a lone crash, reversed later in ffmpeg as the riser into the drops
write(OUT / "crash.mid", [(CH_DRUM, 0, 4, CRASH, 110)], {})
print("notes", len(notes), "last beat", max(s + d for _, s, d, _, _ in notes))
