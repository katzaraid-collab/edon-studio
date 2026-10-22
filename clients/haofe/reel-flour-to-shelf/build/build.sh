#!/usr/bin/env bash
# Rebuild the HaOfe "flour to shelf" reel from the Drive footage.
# Needs: ffmpeg, python3 + numpy + mido, fluidsynth + FluidR3_GM.sf2, node + playwright.
# Usage: build/build.sh WORK_DIR
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="${1:?work dir}"
RAW="$WORK/raw"; OUT="$WORK/out"; AUD="$WORK/audio"; OV="$WORK/ov"
mkdir -p "$RAW" "$OUT" "$AUD" "$OV"
SF2=/usr/share/sounds/sf2/FluidR3_GM.sf2

# 1. footage (Drive folder 1U6NdikJs-57TVk2A16mokK7IJNwtvYmD)
while read -r id name; do
  [ -s "$RAW/$name" ] || curl -sSL -o "$RAW/$name" \
    "https://drive.usercontent.google.com/download?id=$id&export=download&confirm=t"
done <<'EOF'
1dppRdRB4vZ8GJYfe3kSymP2-5bDIPph0 IMG_0448.jpg
1RMrQ9TTAURws8gncsyZWHx9Sj71Bsg4A IMG_0440.mov
16ADdbe3ix0fqznzxrSOLO07-12yXogOG IMG_0413.mov
1rgVZW9szcXnfXuf1091Kp1VVsC9W3A-N IMG_0417.mov
1Qz9tZ-r1z-ls-HG-KhhQZnqSuRzX4GHp IMG_0431.mov
1Onwqof0IxSlcNfxfOnX3lEptUfdhPErj IMG_3191.mov
18V47g0OzsuXJfw831r8bPUvafbXSZV2R IMG_3189.mov
171phmjhHCahsmoHW5Ba31tPCRif4fwHN IMG_2105.mov
1nhfKgP9Oxrf5-ofxKDM69uvVfsrAEST8 IMG_2102.mov
1H25lKBfcgDwhM4JWLgxQnpf8JFZsHOiP IMG_2093.mov
10N1kaiN5vTjlc-5tch27jbdtZPWFVDnc IMG_1195.mov
1IxgKKD1qQqG9n7EqLjM8vGFzodEKvicH IMG_1194.mov
EOF

# 2. cut, grade, concatenate (base.mp4 + ambient.wav)
python3 -I "$HERE/edit.py" "$RAW" "$OUT"

# 3. music, rewind whoosh, reversed-crash riser
python3 -I "$HERE/music.py" "$AUD"
fluidsynth -ni -q -g 0.7 -r 48000 -R 1 -C 1 -F "$AUD/music_raw.wav" "$SF2" "$AUD/music.mid"
fluidsynth -ni -q -g 0.7 -r 48000 -F "$AUD/crash_raw.wav" "$SF2" "$AUD/crash.mid"
python3 -I "$HERE/sfx.py" "$AUD/rewind.wav"
ffmpeg -v error -y -i "$AUD/crash_raw.wav" \
  -af "atrim=0:2.2,asetpts=PTS-STARTPTS,areverse,afade=t=in:d=1.2:curve=exp,aresample=48000" -ac 2 "$AUD/riser.wav"

ffmpeg -v error -y -i "$AUD/music_raw.wav" -i "$OUT/ambient.wav" -i "$AUD/rewind.wav" -i "$AUD/riser.wav" \
  -filter_complex "\
[0:a]aresample=48000,atrim=0:42.6,asetpts=PTS-STARTPTS,afade=t=out:st=41.3:d=1.3[m];\
[1:a]aresample=48000,highpass=f=140,lowpass=f=9000,acompressor=threshold=0.1:ratio=4:attack=5:release=120,volume='if(between(t,2.4,3.0),0.55,0.20)':eval=frame,afade=t=out:st=39.0:d=1.2[amb];\
[2:a]adelay=2400|2400,volume=0.9[rw];\
[3:a]asplit=2[r1][r2];[r1]adelay=800|800,volume=0.55[ra];[r2]adelay=17600|17600,volume=0.7[rb];\
[m][amb][rw][ra][rb]amix=inputs=5:normalize=0:duration=first,atrim=0:42.6,loudnorm=I=-14:TP=-1.5:LRA=9[out]" \
  -map "[out]" -ar 48000 -c:a pcm_s16le "$AUD/mix.wav"
ffmpeg -v error -y -i "$OUT/ambient.wav" \
  -filter_complex "[0:a]highpass=f=100,acompressor=threshold=0.1:ratio=3,afade=t=out:st=41.0:d=1.6,loudnorm=I=-16:TP=-1.5[o]" \
  -map "[o]" -ar 48000 -c:a pcm_s16le "$AUD/mix_nomusic.wav"

# 4. text layer: one transparent PNG per frame
export NODE_PATH="$(npm root -g)"
node "$HERE/render_overlay.js" "$HERE/overlay" "$OV" 42.6

# 5. final encodes + cover
DEST="$(dirname "$HERE")"
for v in main nomusic; do
  a="$AUD/mix.wav"; name=haofe-reel.mp4
  [ "$v" = nomusic ] && a="$AUD/mix_nomusic.wav" && name=haofe-reel-no-music.mp4
  ffmpeg -v error -y -i "$OUT/base.mp4" -framerate 30 -i "$OV/%05d.png" -i "$a" \
    -filter_complex "[0:v][1:v]overlay=format=auto:shortest=1,format=yuv420p[v]" -map "[v]" -map 2:a \
    -c:v libx264 -preset slow -crf 19 -profile:v high -level 4.1 -pix_fmt yuv420p -r 30 -g 60 \
    -c:a aac -b:a 192k -ar 48000 -movflags +faststart -t 42.6 "$DEST/$name"
done
ffmpeg -v error -y -i "$RAW/IMG_0448.jpg" \
  -vf "scale=1080:1920:flags=lanczos,eq=contrast=1.06:saturation=1.14,colorbalance=rs=0.035:bs=-0.035:rm=0.025:bm=-0.025" \
  -q:v 2 "$HERE/overlay/cover_bg.jpg"
node "$HERE/shot.js" "$HERE/overlay/cover.html" "$DEST/cover.jpg"
rm -f "$HERE/overlay/cover_bg.jpg"
