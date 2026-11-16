#!/usr/bin/env python3
# HEARTBEAT (2026-11-08): the game's copies of AGI-1's songs, made from the owner's originals in public/music/ (which
# stay as they are). Run from anywhere:
#
#   python3 tools/games/heartbeat/encode.py audio      → public/games/heartbeat/audio/<id>.mp3   (the original's own MP3
#                                                         audio, frame for frame: only its tags and cover taken off,
#                                                         ~3.7–9.6 MB each; since 2026-11-16, an AAC copy at 112 kbps
#                                                         before, which the owner heard as "worse than the original")
#   python3 tools/games/heartbeat/encode.py covers     → public/games/heartbeat/covers/<id>.webp (320 px, from the cover
#                                                         inside each MP3)
#   python3 tools/games/heartbeat/encode.py previews   → public/games/heartbeat/preview/<id>.mp3 (the song select's short
#                                                         loop, cut from the original and made with LAME at its best
#                                                         setting, V0; its range from src/games/heartbeat/charts/<id>.json:
#                                                         run chart.py first)
#   python3 tools/games/heartbeat/encode.py all
#
# Needs ffmpeg (with libmp3lame). No lyrics, tags or covers are kept in the game's audio files (the covers are their own
# small pictures).
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(__file__))
from catalog import SONGS, original, game_audio, preview_audio, cover, chart_file  # noqa: E402


def ff(*args):
    os.makedirs(os.path.dirname(args[-1]), exist_ok=True)
    cmd = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', *args]
    subprocess.run(cmd, check=True)


def strip_tags(data):
    """An MP3's own audio frames: its ID3v2 tags (the cover, the title) and an ID3v1 tag at the end taken off."""
    i = 0
    while data[i:i + 3] == b'ID3':
        flags = data[i + 5]
        size = ((data[i + 6] & 0x7f) << 21) | ((data[i + 7] & 0x7f) << 14) | ((data[i + 8] & 0x7f) << 7) | (data[i + 9] & 0x7f)
        i += 10 + size + (10 if flags & 0x10 else 0)
    end = len(data)
    if data[end - 128:end - 125] == b'TAG':
        end -= 128
    out = data[i:end]
    if not (out[0] == 0xFF and (out[1] & 0xE0) == 0xE0):
        raise ValueError('no MPEG audio frame where the tags end')
    if b'APETAGEX' in out[-160:]:
        raise ValueError('an APE tag at the end: take it off too')
    return out


def audio():
    for sid, _ in SONGS:
        out = game_audio(sid)
        os.makedirs(os.path.dirname(out), exist_ok=True)
        with open(original(sid), 'rb') as f:
            frames = strip_tags(f.read())
        with open(out, 'wb') as f:
            f.write(frames)
        print(f'{sid}.mp3 {os.path.getsize(out) / 1e6:.2f} MB (the original\'s audio, as it is)')


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
        # cut from the original; a soft fade at both ends, so the loop breathes instead of clicking
        ff('-ss', f'{start:.3f}', '-t', f'{dur:.3f}', '-i', original(sid), '-map', '0:a:0', '-map_metadata', '-1',
           '-af', f'afade=t=in:st=0:d=0.35,afade=t=out:st={dur - 0.9:.3f}:d=0.9',
           '-c:a', 'libmp3lame', '-q:a', '0', '-id3v2_version', '0', '-write_id3v1', '0', out)
        print(f'{sid} preview {start:.2f}–{end:.2f} s, {os.path.getsize(out) / 1e3:.0f} KB')


if __name__ == '__main__':
    what = sys.argv[1] if len(sys.argv) > 1 else 'all'
    if what in ('audio', 'all'):
        audio()
    if what in ('covers', 'all'):
        covers()
    if what in ('previews', 'all'):
        previews()
