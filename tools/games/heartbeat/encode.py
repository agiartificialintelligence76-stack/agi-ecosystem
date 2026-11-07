#!/usr/bin/env python3
# HEARTBEAT (2026-11-08): the game's copies of AGI-1's songs, made from the owner's originals in public/music/ (which
# stay as they are). Run from anywhere:
#
#   python3 tools/games/heartbeat/encode.py audio      → public/games/heartbeat/audio/<id>.m4a   (AAC-LC 44.1 kHz stereo,
#                                                         112 kbps, fast start: what a run plays, ~2.1–3.4 MB each)
#   python3 tools/games/heartbeat/encode.py covers     → public/games/heartbeat/covers/<id>.webp (320 px, from the cover
#                                                         inside each MP3)
#   python3 tools/games/heartbeat/encode.py previews   → public/games/heartbeat/preview/<id>.m4a (the song select's short
#                                                         loop, its range from src/games/heartbeat/charts/<id>.json:
#                                                         run chart.py first)
#   python3 tools/games/heartbeat/encode.py all
#
# Needs ffmpeg. No lyrics, tags or covers are kept in the game's audio files (the covers are their own small pictures).
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(__file__))
from catalog import SONGS, original, game_audio, preview_audio, cover, chart_file  # noqa: E402


def ff(*args):
    cmd = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', *args]
    subprocess.run(cmd, check=True)


def audio():
    for sid, _ in SONGS:
        out = game_audio(sid)
        ff('-i', original(sid), '-map', '0:a:0', '-map_metadata', '-1', '-vn',
           '-c:a', 'aac', '-profile:a', 'aac_low', '-b:a', '112k', '-ar', '44100', '-ac', '2',
           '-movflags', '+faststart', out)
        print(f'{sid}.m4a {os.path.getsize(out) / 1e6:.2f} MB')


def covers():
    for sid, _ in SONGS:
        out = cover(sid)
        ff('-i', original(sid), '-map', '0:v:0', '-frames:v', '1',
           '-vf', 'scale=320:320:flags=lanczos', '-c:v', 'libwebp', '-quality', '84', '-compression_level', '6', out)
        print(f'{sid}.webp {os.path.getsize(out) / 1e3:.1f} KB')


def previews():
    for sid, _ in SONGS:
        with open(chart_file(sid), encoding='utf8') as f:
            start, end = json.load(f)['preview']
        dur = end - start
        out = preview_audio(sid)
        # a soft fade at both ends, so the loop breathes instead of clicking
        ff('-ss', f'{start:.3f}', '-t', f'{dur:.3f}', '-i', game_audio(sid), '-map', '0:a:0', '-map_metadata', '-1',
           '-af', f'afade=t=in:st=0:d=0.35,afade=t=out:st={dur - 0.9:.3f}:d=0.9',
           '-c:a', 'aac', '-profile:a', 'aac_low', '-b:a', '96k', '-ar', '44100', '-ac', '2', '-movflags', '+faststart', out)
        print(f'{sid} preview {start:.2f}–{end:.2f} s, {os.path.getsize(out) / 1e3:.0f} KB')


if __name__ == '__main__':
    what = sys.argv[1] if len(sys.argv) > 1 else 'all'
    if what in ('audio', 'all'):
        audio()
    if what in ('covers', 'all'):
        covers()
    if what in ('previews', 'all'):
        previews()
