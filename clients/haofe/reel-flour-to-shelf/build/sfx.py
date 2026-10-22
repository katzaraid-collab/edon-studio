"""Synthesize the rewind whoosh (2.4-3.0 s) as a 48 kHz stereo WAV.

Usage: python3 -I sfx.py OUT_WAV
"""
import sys
import wave

import numpy as np

SR = 48000
DUR = 0.62
rng = np.random.default_rng(3)
t = np.arange(int(SR * DUR)) / SR

# band-passed noise whose centre sweeps 4.5 kHz -> 350 Hz (STFT overlap-add)
noise = rng.standard_normal(len(t))
N, HOP = 1024, 256
win = np.hanning(N)
out = np.zeros(len(t) + N)
freqs = np.fft.rfftfreq(N, 1 / SR)
for start in range(0, len(t) - N, HOP):
    frac = start / (len(t) - N)
    fc = 4500 * (350 / 4500) ** frac
    band = np.exp(-0.5 * (np.log(np.maximum(freqs, 1) / fc) / 0.45) ** 2)
    spec = np.fft.rfft(noise[start:start + N] * win) * band
    out[start:start + N] += np.fft.irfft(spec) * win
whoosh = out[:len(t)]
whoosh /= np.abs(whoosh).max()

# tape-rewind warble: a falling chirp with fast vibrato
f = 1800 * (220 / 1800) ** (t / DUR) * (1 + 0.08 * np.sin(2 * np.pi * 34 * t))
chirp = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.25

env = np.minimum(1, t / 0.05) * np.minimum(1, (DUR - t) / 0.08) ** 1.5
mono = (0.8 * whoosh + 0.35 * chirp) * env * 0.5
pan = np.sin(2 * np.pi * 1.6 * t) * 0.35
stereo = np.stack([mono * (1 - pan), mono * (1 + pan)], axis=1)
stereo = np.clip(stereo, -1, 1)

with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((stereo * 32767).astype("<i2").tobytes())
print("ok", len(t) / SR)
