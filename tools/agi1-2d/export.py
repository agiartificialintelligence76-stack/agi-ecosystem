# Export the cleaned art for the site: one WebP per layer (the features packed into one small atlas) and the rig data
# (every box, joint and curve the 2D rig needs) as JSON. SCALE: 1 = the art's own pixels, 2 = the upscaled copies (up/).
import insp, numpy as np, json, os, sys
from PIL import Image
SCALE = float(sys.argv[1]) if len(sys.argv) > 1 else 1.0
SRC = sys.argv[2] if len(sys.argv) > 2 else 'out'
DST = sys.argv[3] if len(sys.argv) > 3 else 'site'
os.makedirs(DST, exist_ok=True)
def box(name): return json.load(open(f'out/{name}.json')) if os.path.exists(f'out/{name}.json') else insp.box_of(name)
def img(name):
    p = f'{SRC}/{name}.png'
    return Image.open(p).convert('RGBA')
LAYERS = ['backHair', 'body', 'armL', 'armR', 'face', 'frontHair']
FILE = {'backHair': 'back-hair', 'body': 'body', 'armL': 'arm-l', 'armR': 'arm-r', 'face': 'face', 'frontHair': 'front-hair'}
MAX_TEX = 2048
rig = {'canvas': {'w': 1024, 'h': 1536}, 'layers': {}, 'features': {}}
total = 0
for n in LAYERS:
    b = box(n); im = img(n)
    s = min(SCALE, MAX_TEX / b['w'], MAX_TEX / b['h'])
    tw, th = int(round(b['w'] * s)), int(round(b['h'] * s))
    if im.size != (tw, th): im = im.resize((tw, th), Image.LANCZOS)
    path = f"{DST}/{FILE[n]}.webp"
    im.save(path, 'WEBP', quality=90, method=6, exact=True)
    total += os.path.getsize(path)
    rig['layers'][n] = {**b, 'file': FILE[n] + '.webp', 'tw': tw, 'th': th}
# the features atlas: each piece with 6 px of transparent padding, in rows
FEATS = ['eyeL_white', 'eyeL_iris', 'eyeL_lashU', 'eyeL_lashD', 'eyeR_white', 'eyeR_iris', 'eyeR_lashU', 'eyeR_lashD', 'browL', 'browR', 'mouth']
PAD = 6
S2 = SCALE
pieces = []
for n in FEATS:
    b = insp.box_of(n); im = img(n)
    tw, th = int(round(b['w'] * S2)), int(round(b['h'] * S2))
    if im.size != (tw, th): im = im.resize((tw, th), Image.LANCZOS)
    pieces.append((n, b, im))
# the layout is worked out at 1x (so the rig's numbers stay the same) and then scaled
AW1 = 256
x = y = 0; row_h = 0; place1 = {}
for n, b, im in pieces:
    w, h = b['w'], b['h']
    if x + w + 2 * PAD > AW1: x = 0; y += row_h; row_h = 0
    place1[n] = (x + PAD, y + PAD); x += w + 2 * PAD; row_h = max(row_h, h + 2 * PAD)
AH1 = 1
while AH1 < y + row_h: AH1 *= 2
AW, AH = int(AW1 * S2), int(AH1 * S2)
atlas = Image.new('RGBA', (AW, AH), (0, 0, 0, 0))
for n, b, im in pieces:
    px, py = place1[n]
    atlas.alpha_composite(im, (int(round(px * S2)), int(round(py * S2))))
    rig['features'][n] = {**b, 'ax': px, 'ay': py, 'aw': b['w'], 'ah': b['h']}
# bleed the atlas colors into the padding (so the shader's filtering never pulls in black)
from util import bleed
a = np.array(atlas).astype(float); rgb = bleed(a[..., :3], a[..., 3] / 255); atlas = Image.fromarray(np.dstack([rgb, a[..., 3]]).round().clip(0, 255).astype(np.uint8))
atlas.save(f'{DST}/features.webp', 'WEBP', quality=92, method=6, exact=True)
total += os.path.getsize(f'{DST}/features.webp')
rig['atlas'] = {'file': 'features.webp', 'w': AW, 'h': AH}
arms = json.load(open('out/arms.json'))
# the inside of each elbow: how far her arm's outline is from her elbow in each direction, every 4° from her forearm round
# the inside of her elbow to her upper arm (the site finds where the two sides of her arm meet when it bends from these)
import math
for s in 'LR':
    j = arms[s]; ab = box('arm' + s); a = np.array(Image.open(f'out/arm{s}.png'))[..., 3] / 255
    def cover(x, y):
        x, y = x - ab['x'] - 0.5, y - ab['y'] - 0.5
        if x < 0 or y < 0 or x >= a.shape[1] - 1 or y >= a.shape[0] - 1: return 0.0
        x0, y0 = int(x), int(y); fx, fy = x - x0, y - y0
        return (a[y0, x0] * (1 - fx) * (1 - fy) + a[y0, x0 + 1] * fx * (1 - fy) + a[y0 + 1, x0] * (1 - fx) * fy + a[y0 + 1, x0 + 1] * fx * fy)
    sg = 1 if s == 'L' else -1
    el, sh, wr = j['el'], j['sh'], j['wr']
    Af = math.atan2(wr[1] - el[1], wr[0] - el[0]); beta0 = (sg * (math.atan2(sh[1] - el[1], sh[0] - el[0]) - Af)) % (2 * math.pi)
    inner = []
    for k in range(int(math.degrees(beta0) // 4) + 1):
        ang = Af + sg * math.radians(4 * k); d = 0.0
        while cover(el[0] + d * math.cos(ang), el[1] + d * math.sin(ang)) >= 0.5 and d < 400: d += 0.25
        inner.append(round(d, 1))
    arms[s]['inner'] = inner
rig['arms'] = arms
# eyes: the white's top and bottom edges (9 samples across), its corners and the iris
eyes = {}
for s in 'LR':
    wb = insp.box_of(f'eye{s}_white'); wa = np.array(Image.open(f'out/eye{s}_white.png'))[..., 3] / 255
    cols = []
    for x in range(wa.shape[1]):
        col = wa[:, x]
        if col.max() < 0.5: continue
        ys = np.nonzero(col >= 0.5)[0]; t0, b0 = ys[0], ys[-1]
        top = t0 - (col[t0] - 0.5) / max(1e-3, col[t0] - col[t0 - 1]) if t0 > 0 else t0
        bot = b0 + (col[b0] - 0.5) / max(1e-3, col[b0] - col[b0 + 1]) if b0 + 1 < len(col) else b0
        cols.append((x + wb['x'] + 0.5, top + wb['y'] + 0.5, bot + wb['y'] + 0.5))
    e = np.array(cols)
    x0, x1 = float(e[0, 0]) - 0.5, float(e[-1, 0]) + 0.5
    xs = np.linspace(x0, x1, 9)
    top = np.interp(xs, e[:, 0], e[:, 1]); bot = np.interp(xs, e[:, 0], e[:, 2])
    # the ends: where top and bottom meet
    mid_end0 = (top[0] + bot[0]) / 2; mid_end1 = (top[-1] + bot[-1]) / 2
    top[0] = bot[0] = mid_end0; top[-1] = bot[-1] = mid_end1
    irb = insp.box_of(f'eye{s}_iris'); ira = np.array(Image.open(f'out/eye{s}_iris.png'))[..., 3]
    ys, xs_ = np.nonzero(ira > 128)
    icx, icy = (xs_.min() + xs_.max()) / 2 + irb['x'] + 0.5, (ys.min() + ys.max()) / 2 + irb['y'] + 0.5
    eyes[s] = {'x0': x0, 'x1': x1, 'top': [round(v, 2) for v in top], 'bot': [round(v, 2) for v in bot],
               'iris': [round(icx, 2), round(icy, 2)], 'irisR': round((xs_.max() - xs_.min() + 1) / 2, 2)}
rig['eyes'] = eyes
rig['brows'] = {'L': {'pivot': [476.5, 124.5]}, 'R': {'pivot': [544.0, 124.0]}}
rig['mouth'] = {'center': [511.3, 198.0]}
rig['feet'] = 1493
json.dump(rig, open(f'{DST}/rig.json', 'w'), indent=1)
print('total bytes', total, 'atlas', AW, AH)
for f in sorted(os.listdir(DST)): print('  ', f, os.path.getsize(f'{DST}/{f}'))
