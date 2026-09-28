# The face layer: clean skin under the eyes, brows and mouth (they're drawn on top and move), no hair bits on the forehead,
# a smooth jaw line (the padding below it cut away) and a soft chin shadow on the neck that moves with her head.
import insp, numpy as np, json
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
from util import membrane_fill, ellipse_mask, aa_alpha_from_mask, bleed, lum
H, W = 1536, 1024
bx = insp.box_of('face')
full = np.zeros((H, W, 4)); full[bx['y']:bx['y'] + bx['h'], bx['x']:bx['x'] + bx['w']] = np.array(insp.load('face')).astype(float)
rgb, al = full[..., :3], full[..., 3] / 255
inside = al > 0.5
# 1. under the eyes (the white and where the upper lash sits when open: both are shown when she blinks) and the mouth:
# smooth skin from the surrounding skin. The skin around them stays as painted.
m = np.zeros((H, W), bool)
for s_ in 'LR':
    for piece, grow in ((f'eye{s_}_white', 2), (f'eye{s_}_lashU', 1)):
        fb = insp.box_of(piece)
        new_a = np.array(Image.open(f'out/{piece}.png'))[..., 3] > (12 if piece.endswith('white') else 20)
        mm = np.zeros((H, W), bool); mm[fb['y']:fb['y'] + fb['h'], fb['x']:fb['x'] + fb['w']] = new_a
        m |= ndi.binary_dilation(mm, iterations=grow)
m |= ellipse_mask(H, W, 510, 199, 21, 9)
m &= inside
rgb = membrane_fill(rgb, m)
# 2. the upper lashes' painted surroundings (the crease and the shading above the eye) stay on her face, fixed: before,
# they moved with the lash and showed as patches when she blinked
for s_ in 'LR':
    piece = f'eye{s_}_lashU'; fb = insp.box_of(piece)
    old = np.array(insp.load(piece)).astype(float); new_a = np.array(Image.open(f'out/{piece}.png'))[..., 3].astype(float) / 255
    lash_zone = ndi.binary_dilation(new_a > 0.08, iterations=1)
    ha = (old[..., 3] / 255) * (~lash_zone)
    # only the skin-toned shading, not stray bright hair bits
    ha *= (lum(old[..., :3]) < 235)
    sl = (slice(fb['y'], fb['y'] + fb['h']), slice(fb['x'], fb['x'] + fb['w']))
    rgb[sl] = rgb[sl] * (1 - ha[..., None]) + old[..., :3] * ha[..., None]
# 3. the jaw: one smooth contour; below it, only a soft shadow on the neck
P = [(446, 179), (452, 182.5), (459, 190), (468, 200), (477, 209), (484, 215.5), (491, 221), (498, 225.3), (505, 227.8), (511, 228.6),
     (517, 227.8), (524, 225.3), (531, 221), (537, 215.5), (543, 210), (549, 205), (554, 200), (559, 194), (563, 189), (567, 184.5), (574, 180)]
def poly_y(x, pts):
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    return np.interp(x, xs, ys)
# a smooth version of the contour (Catmull-Rom through the points)
def catmull(pts, n=12):
    out = []
    p = [pts[0]] + pts + [pts[-1]]
    for i in range(1, len(p) - 2):
        p0, p1, p2, p3 = map(np.array, (p[i - 1], p[i], p[i + 1], p[i + 2]))
        for t in np.linspace(0, 1, n, endpoint=False):
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(np.array(pts[-1]))
    return np.array(out)
C = catmull(P)
yy, xx = np.mgrid[0:H, 0:W]
jaw_y = np.interp(np.arange(W), C[:, 0], C[:, 1], left=np.nan, right=np.nan)
below = np.zeros((H, W), bool)
for x in range(W):
    if np.isnan(jaw_y[x]): continue
    below[:, x] = yy[:, x] > jaw_y[x] + 0.9
# outside the jaw's x range, below the ears: cut at y = 181 (the ear lobes end there)
side = (xx < C[0, 0]) | (xx > C[-1, 0])
below |= side & (yy > 181)
keep = inside & ~below
alpha = aa_alpha_from_mask(keep, sigma=0.7)
# the jaw line itself: drawn on a 4x canvas, antialiased, tapered at the ears, softer at the chin
S4 = 4
line = Image.new('L', (W * S4, H * S4), 0); d = ImageDraw.Draw(line)
for i in range(len(C) - 1):
    (x0, y0), (x1, y1) = C[i], C[i + 1]
    u = i / (len(C) - 1)
    ear = min(1, min(u, 1 - u) / 0.08)             # thin at the ears
    chin = 1 - 0.18 * np.exp(-((u - 0.5) / 0.12) ** 2)   # a little softer at the chin
    w = (0.5 + 0.75 * ear) * S4 * chin
    d.line([(x0 * S4, y0 * S4), (x1 * S4, y1 * S4)], fill=int(255 * min(1, 0.55 + 0.45 * ear) * chin), width=max(1, int(round(w))))
line = np.asarray(line.resize((W, H), Image.BOX)).astype(float) / 255
LINE = np.array([122., 62., 58.])
rgb = rgb * (1 - line[..., None]) + LINE * line[..., None]
alpha = np.maximum(alpha, line)                  # the whole line stays visible
# the chin's shadow on the neck: soft, only over the neck, fading 16 px below the jaw
dist = yy - jaw_y[None, :]
neck = 1 - np.clip((np.abs(xx - 511.5) - 12) / 14, 0, 1) ** 1.5   # the neck is 54 px wide; soft sides, so a turned head keeps it on the neck
sh = np.where(np.isnan(dist), 0, np.clip(dist, 0, None))
shadow = 0.55 * np.exp(-sh / 7.0) * np.clip(sh - 0.3, 0, 1) * neck
SH = np.array([190., 112., 104.])
out_a = alpha + shadow * (1 - alpha)
rgb = np.where((shadow > alpha)[..., None], SH, rgb)
rgb = bleed(rgb, out_a)
res = np.dstack([rgb, out_a * 255]).round().clip(0, 255).astype(np.uint8)
ys, xs = np.nonzero(out_a > 0.004)
y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
Image.fromarray(res[y0:y1, x0:x1]).save('out/face.png')
json.dump({'x': int(x0), 'y': int(y0), 'w': int(x1 - x0), 'h': int(y1 - y0)}, open('out/face.json', 'w'))
print('face box', x0, y0, x1 - x0, y1 - y0)
