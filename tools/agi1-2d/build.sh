#!/bin/bash
# AGI-1 in 2D (2026-09-27): turn the owner's 2D art into the pictures the site uses (public/models/agi1-2d/).
#   bash tools/agi1-2d/build.sh "agi 2d anime/agi-vtuber.html"
# Steps (each script says what it does at its top): take the layers out of the page (extract.py); clean them up
# (feat_clean: eyes, brows and mouth as clean strokes · face_clean: skin under the eyes and mouth, a smooth jaw line, the
# chin's shadow · body_clean: no ghost sleeves or patches, the neck under her chin · bh_clean: the back hair behind her
# arms repainted as hair · arm_clean: each arm's outline · fh_clean: the front hair's fringe);
# upscale everything 2× with the Real-ESRGAN anime model (BSD-3; its weights, 18 MB, are downloaded into the work folder,
# never into git); then pack them (export.py). Needs Python 3 with numpy, scipy, pillow, onnx, onnxruntime.
# If the art changes, check the numbers export.py prints (site/rig.json) against src/stage/agi1-2d-rig.js.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../.." && pwd)"
HTML="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
WORK="${AGI1_2D_WORK:-$HERE/work}"; mkdir -p "$WORK"; cd "$WORK"
export PYTHONPATH="$HERE"
python3 "$HERE/extract.py" "$HTML"
for s in feat_clean face_clean body_clean bh_clean arm_clean fh_clean; do echo "· $s"; python3 "$HERE/$s.py"; done
if [ ! -f anime6b.onnx ]; then
  curl -sSL -o anime6b.pth https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.2.4/RealESRGAN_x4plus_anime_6B.pth
  echo "f872d837d3c90ed2e05227bed711af5671a6fd1c9f7d7e91c911a61f155e99da  anime6b.pth" | sha256sum -c -
  python3 "$HERE/build_onnx.py"
fi
python3 "$HERE/up_layers.py"
python3 "$HERE/export.py" 2 up site
mkdir -p "$ROOT/public/models/agi1-2d" && cp site/*.webp "$ROOT/public/models/agi1-2d/"
echo "done: public/models/agi1-2d/ (check site/rig.json against src/stage/agi1-2d-rig.js)"
