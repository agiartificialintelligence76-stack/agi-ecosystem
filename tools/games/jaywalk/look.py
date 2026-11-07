# JAYWALK: the contact sheet of tools/games/jaywalk/look.mjs's raw pictures (every look, from behind and from the front)
import sys, os
from PIL import Image
d = sys.argv[1] if len(sys.argv) > 1 else 'jaywalk-look'
S = 200
ids = sorted({f.split('-')[0] for f in os.listdir(d) if f.endswith('.rgba')})
sheet = Image.new('RGBA', (S * len(ids), S * 2), (150, 222, 196, 255))
for i, id_ in enumerate(ids):
    for j, v in enumerate(['back', 'front']):
        raw = open(os.path.join(d, f'{id_}-{v}.rgba'), 'rb').read()
        im = Image.frombytes('RGBA', (S, S), raw)
        bg = Image.new('RGBA', (S, S), (255, 244, 223, 255) if j == 0 else (228, 217, 255, 255))
        bg.alpha_composite(im)
        sheet.paste(bg, (i * S, j * S))
sheet.convert('RGB').save(os.path.join(d, 'sheet.png'))
print(os.path.join(d, 'sheet.png'))
