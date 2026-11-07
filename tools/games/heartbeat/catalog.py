# HEARTBEAT (2026-11-08): AGI-1's seven songs, as the game knows them. Shared by encode.py and chart.py.
# The originals are the owner's own (public/music/, read-only here); the game's copies are made from them.
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
MUSIC = os.path.join(ROOT, 'public', 'music')
OUT = os.path.join(ROOT, 'public', 'games', 'heartbeat')
CHARTS = os.path.join(ROOT, 'src', 'games', 'heartbeat', 'charts')

# id (= the original's file name), title as the owner wrote it
SONGS = [
    ('feel-the-agi', 'Feel the AGI'),
    ('si-its-better', "SI (It's Better)"),
    ('send-it', 'Send It'),
    ('mainrunner', 'MAINRUNNER'),
    ('save-slot-2', 'Save Slot 2'),
    ('agi', 'AGI.'),
    ('after-agi', 'After AGI'),
]


def original(song_id):
    return os.path.join(MUSIC, f'{song_id}.mp3')


def game_audio(song_id):
    return os.path.join(OUT, 'audio', f'{song_id}.m4a')


def preview_audio(song_id):
    return os.path.join(OUT, 'preview', f'{song_id}.m4a')


def cover(song_id):
    return os.path.join(OUT, 'covers', f'{song_id}.webp')


def chart_file(song_id):
    return os.path.join(CHARTS, f'{song_id}.json')
