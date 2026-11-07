#!/usr/bin/env python3
# HEARTBEAT (2026-11-08): its link preview's wordmark, over a picture of the game (card.mjs makes the picture):
#   python3 tools/games/heartbeat/card.py <demo.png>   → public/cards/games/heartbeat.jpg (1200 × 630, < 260 KB)
# The site's own fonts (Anybody for the wordmark, Instrument Serif for the line), as the kit's stickers: paper or pink
# letters in an ink outline with a hard ink shadow.
import os
import sys
import tempfile

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
FONTS = os.path.join(ROOT, 'public', 'fonts')
OUT = os.path.join(ROOT, 'public', 'cards', 'games', 'heartbeat.jpg')
INK, PAPER, PINK, HONEY = (23, 10, 54), (255, 250, 240), (255, 77, 166), (255, 201, 51)


def font(name, size, axes=None):
    tt = TTFont(os.path.join(FONTS, name))
    if axes:
        tt = instantiateVariableFont(tt, axes)
    tt.flavor = None
    path = os.path.join(tempfile.mkdtemp(), name.replace('.woff2', '.ttf'))
    tt.save(path)
    return ImageFont.truetype(path, size)


def sticker(d, xy, text, f, fill, shadow=INK, stroke=None):
    x, y = xy
    sw = stroke or max(3, round(f.size * 0.06))
    d.text((x, y + round(f.size * 0.075)), text, font=f, fill=shadow, stroke_width=sw, stroke_fill=shadow)
    d.text((x, y), text, font=f, fill=fill, stroke_width=sw, stroke_fill=INK)


def main():
    im = Image.open(sys.argv[1]).convert('RGB').resize((1200, 630))
    # a soft darker band behind the words (right side), so they read on the stars
    shade = Image.new('L', im.size, 0)
    ImageDraw.Draw(shade).rectangle([840, 0, 1200, 630], fill=120)
    shade = shade.filter(ImageFilter.GaussianBlur(60))
    im = Image.composite(Image.new('RGB', im.size, (10, 4, 26)), im, shade)
    d = ImageDraw.Draw(im)
    big = font('Anybody-Variable.woff2', 84, {'wght': 900, 'wdth': 112})
    small = font('Anybody-Variable.woff2', 19, {'wght': 850, 'wdth': 120})
    serif = font('InstrumentSerif-Italic.woff2', 30)
    cx = 1018
    def centred(text, f, y, **kw):
        w = d.textlength(text, font=f)
        sticker(d, (cx - w / 2, y), text, f, **kw)
    # AGI GAMES · BETA
    kick, tag = 'AGI GAMES', 'BETA'
    kw, tw = d.textlength(kick, font=small), d.textlength(tag, font=small)
    pw = tw + 26
    x0 = cx - (kw + 14 + pw) / 2
    d.text((x0, 152), kick, font=small, fill=PAPER)
    bx = x0 + kw + 14
    d.rounded_rectangle([bx, 147, bx + pw, 177], radius=15, fill=PINK, outline=INK, width=3)
    d.text((bx + 13, 152), tag, font=small, fill=INK)
    centred('HEART', big, 192, fill=PAPER)
    centred('BEAT', big, 282, fill=PINK)
    for i, t in enumerate(('Her songs. Your fingers.', 'Stay on the beat.')):
        w = d.textlength(t, font=serif)
        d.text((cx - w / 2, 400 + i * 36), t, font=serif, fill=PAPER)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    im.save(OUT, 'JPEG', quality=86, optimize=True, progressive=False)
    print(OUT, os.path.getsize(OUT), 'bytes')


if __name__ == '__main__':
    main()
