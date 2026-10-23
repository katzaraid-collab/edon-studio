#!/usr/bin/env bash
# Rebuild the motion-design cut of the HaOfe reel (42 s, Fredoka type, no voiceover).
# Needs: ffmpeg, python3, node + playwright. Run build.sh first for the footage
# download (RAW) and the bakery ambience (out/ambient.wav).
# Usage: build/build_motion.sh WORK_DIR
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="${1:?work dir}"
RAW="$WORK/raw"; AUD="$WORK/audio"; SFX="$WORK/sfx"; M="$WORK/motion"
DEST="$(dirname "$HERE")"
mkdir -p "$AUD" "$SFX" "$M"

# 1. compositor page, fonts and assets, then source frames and the shot timeline
cp -r "$HERE/motion/." "$M/"
cp "$RAW/IMG_0448.jpg" "$M/assets/photo.jpg"
python3 -I "$HERE/motion_prep.py" "$RAW" "$M"

# 2. music + sound effects (Mixkit free licenses)
[ -s "$AUD/funkee_monkeee.mp3" ] || curl -sSL -o "$AUD/funkee_monkeee.mp3" "https://assets.mixkit.co/music/1140/1140.mp3"
for id in 790 3005 1092 772 168 1490 2350 1143 2902 2357; do
  [ -s "$SFX/$id.mp3" ] || curl -sSL -o "$SFX/$id.mp3" "https://assets.mixkit.co/active_storage/sfx/$id/$id-preview.mp3"
done

# 3. picture: every frame built in the browser, piped to ffmpeg
export NODE_PATH="$(npm root -g)"
node "$HERE/motion_render.js" "$M" "$WORK/motion_silent.mp4" 42.0

# 4. sound
python3 -I "$HERE/motion_mix.py" "$AUD/funkee_monkeee.mp3" "$WORK/out/ambient.wav" "$SFX" "$AUD/mix_motion.wav"
python3 -I "$HERE/motion_mix.py" "$AUD/funkee_monkeee.mp3" "$WORK/out/ambient.wav" "$SFX" "$AUD/mix_motion_nomusic.wav" --no-music

# 5. final encodes
for v in main nomusic; do
  a="$AUD/mix_motion.wav"; name=haofe-reel-motion.mp4
  [ "$v" = nomusic ] && a="$AUD/mix_motion_nomusic.wav" && name=haofe-reel-motion-no-music.mp4
  ffmpeg -v error -y -i "$WORK/motion_silent.mp4" -i "$a" -map 0:v -map 1:a \
    -c:v libx264 -preset slow -crf 20 -profile:v high -level 4.1 -pix_fmt yuv420p -r 30 -g 60 \
    -c:a aac -b:a 192k -ar 48000 -movflags +faststart -t 42.0 "$DEST/$name"
done
