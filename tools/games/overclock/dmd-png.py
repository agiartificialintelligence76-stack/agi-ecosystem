# renders tools/games/overclock/dmd-preview.mjs's frames as dots, one under the other, with their names
import json, sys
from PIL import Image, ImageDraw
data = json.load(open(sys.argv[1]))
w, h, s = data['w'], data['h'], 4
cols = [(38, 16, 8), (118, 52, 12), (178, 84, 18), (236, 128, 34), (255, 190, 92), (96, 22, 56), (168, 36, 98), (236, 66, 148), (255, 150, 200)]
fr = data['frames']
per = 2
img = Image.new('RGB', (per * (w * s + 20) + 20, ((len(fr) + per - 1) // per) * (h * s + 26) + 10), (12, 6, 20))
dr = ImageDraw.Draw(img)
for i, f in enumerate(fr):
    ox, oy = 20 + (i % per) * (w * s + 20), 10 + (i // per) * (h * s + 26)
    dr.text((ox, oy), f['name'], fill=(200, 190, 230))
    for j, v in enumerate(f['buf']):
        x, y = j % w, j // w
        c = cols[v] if v < len(cols) else (255, 255, 255)
        dr.ellipse([ox + x * s, oy + 12 + y * s, ox + x * s + s - 1, oy + 12 + y * s + s - 1], fill=c)
img.save(sys.argv[2])
