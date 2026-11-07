# LAST MODEL STANDING: a contact sheet of the game's pixel art (src/games/lastmodel/sprites.js), for looking at it while
# drawing it. Every sprite at a big scale on the floor's navy, with its name. Usage:
#   python3 tools/games/lastmodel/preview.py out.png [scale=8] [name-prefix…]
import re, sys
from PIL import Image, ImageDraw

SRC = 'src/games/lastmodel/sprites.js'
src = open(SRC).read()
pal_block = re.search(r'export const PAL = \{(.*?)\n\};', src, re.S).group(1)
PAL = {k: v for k, v in re.findall(r"'?(\w)'?: '(#[0-9a-fA-F]{6})'", pal_block)}
body = src[src.index('export const SPRITES'):]
sprites = {}
for m in re.finditer(r"^  (\w+): \[\n(.*?)\n  \],", body, re.S | re.M):
    rows = re.findall(r"'([^']*)'", m.group(2))
    sprites[m.group(1)] = rows

out = sys.argv[1] if len(sys.argv) > 1 else 'sheet.png'
S = int(sys.argv[2]) if len(sys.argv) > 2 else 8
prefixes = sys.argv[3:]
names = [n for n in sprites if not prefixes or any(n.startswith(p) for p in prefixes)]
problems = []
for n in names:
    rows = sprites[n]
    w = max(len(r) for r in rows)
    if any(len(r) != w for r in rows):
        problems.append(f'{n}: rows of different widths {sorted(set(len(r) for r in rows))}')
    for r in rows:
        for ch in r:
            if ch != '.' and ch not in PAL:
                problems.append(f'{n}: unknown colour {ch!r}')
                break
for p in problems:
    print('!!', p)

pad = 14
cells = []
for n in names:
    rows = sprites[n]
    w = max(len(r) for r in rows); h = len(rows)
    cells.append((n, w, h))
maxw = 1200
x = y = pad; rowh = 0
places = []
for n, w, h in cells:
    cw, ch = w * S + pad, h * S + pad + 14
    if x + cw > maxw:
        x = pad; y += rowh; rowh = 0
    places.append((n, x, y, w, h))
    x += cw; rowh = max(rowh, ch)
H = y + rowh + pad
img = Image.new('RGB', (maxw, H), (22, 27, 58))
d = ImageDraw.Draw(img)
for n, x, y, w, h in places:
    rows = sprites[n]
    # a faint checker behind (to see transparency)
    for yy in range(h):
        for xx in range(w):
            ch = rows[yy][xx] if xx < len(rows[yy]) else '.'
            if ch == '.':
                c = (26, 32, 66) if (xx + yy) % 2 else (30, 37, 74)
            else:
                v = PAL[ch]; c = tuple(int(v[i:i + 2], 16) for i in (1, 3, 5))
            d.rectangle([x + xx * S, y + yy * S, x + xx * S + S - 1, y + yy * S + S - 1], fill=c)
    d.text((x, y + h * S + 2), n, fill=(230, 220, 255))
img.save(out)
print('saved', out, len(names), 'sprites')
