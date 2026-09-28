# The body layer: cut away the flat lavender "ghost" pieces (where the arms and hair were painted over): the wings
# beside the torso, the patches above the shoulders and the blob around the head. The neck continues up under her chin as
# plain skin (her chin's line and shadow now come with the face, so they move with her head). The torso's sides under
# the sleeves get a shaded edge, so when an arm lifts you see the side of her shirt, not a flat shape.
import insp, numpy as np, json
from PIL import Image
from scipy import ndimage as ndi
from util import aa_alpha_from_mask, bleed, lum
H, W = 1536, 1024
def full_layer(name):
    b = insp.box_of(name); f = np.zeros((H, W, 4)); f[b['y']:b['y'] + b['h'], b['x']:b['x'] + b['w']] = np.array(insp.load(name)).astype(float)
    return f
body = full_layer('body'); rgb, al = body[..., :3], body[..., 3] / 255
armL, armR = full_layer('armL')[..., 3] > 128, full_layer('armR')[..., 3] > 128
yy, xx = np.mgrid[0:H, 0:W]
keep = al > 0.5
# --- the sides: under each sleeve the body reaches a little past the sleeve's inner edge; below the armpit, its own edge
MARGIN = 7
def inner_edge(mask, side, y):
    xs = np.nonzero(mask[y])[0]
    if not len(xs): return None
    return xs.max() if side == 'L' else xs.min()
cutL = np.full(H, -1.0); cutR = np.full(H, W + 1.0)
for y in range(286, 433):
    e = inner_edge(armL, 'L', y)
    if e is not None: cutL[y] = e - MARGIN
    e = inner_edge(armR, 'R', y)
    if e is not None: cutR[y] = e + MARGIN
# below the armpit: the torso's own outline (read off the art)
realL = [(432, 398), (445, 402), (460, 406), (475, 409), (482, 411)]
realR = [(432, 620), (445, 614), (460, 608), (475, 603), (490, 599)]
for y in range(433, 491):
    if y <= realL[-1][0]: cutL[y] = np.interp(y, [p[0] for p in realL], [p[1] for p in realL]) - 1
    if y <= realR[-1][0]: cutR[y] = np.interp(y, [p[0] for p in realR], [p[1] for p in realR]) + 1
# smooth the cut lines (no stair steps from the arms' pixel edges)
def smooth_cut(c, lo, hi):
    seg = c[lo:hi].copy(); ok = seg > -1e5
    c[lo:hi] = ndi.gaussian_filter1d(seg, 2.0)
smooth_cut(cutL, 290, 490); smooth_cut(cutR, 290, 490)
for y in range(286, 491):
    if cutL[y] > 0: keep[y, :int(np.floor(cutL[y]))] = False
    if cutR[y] < W: keep[y, int(np.ceil(cutR[y])) + 1:] = False
# --- above the shoulders: nothing but the neck (54 px wide, straight up under her chin)
NECK_TOP, NL, NR = 178, 484.5, 538.5
topL = [(290, 300), (330, 300), (345, 294), (360, 289), (380, 285), (400, 282), (420, 278), (440, 275), (455, 272), (464, 269),
        (467, 266), (473, 263), (477, 260), (479, 257), (482, 251), (484, 248)]
topR = [(539, 248), (540, 251), (543, 257), (545, 260), (548, 263), (552, 266), (556, 269), (565, 272), (582, 275), (602, 278),
        (622, 282), (642, 285), (657, 289), (672, 294), (690, 300), (735, 300)]
for x in range(290, 735):
    if x < NL: t = np.interp(x, [p[0] for p in topL], [p[1] for p in topL])
    elif x > NR: t = np.interp(x, [p[0] for p in topR], [p[1] for p in topR])
    else: t = NECK_TOP
    keep[:int(round(t)), x] = False
# the neck under her chin: plain skin (her chin's shadow comes with the face), feathered into the art below
cols = (xx >= int(NL)) & (xx <= int(NR))
ref = np.median(rgb[252:264], axis=0)
ref = ndi.gaussian_filter1d(ref, 6, axis=0, mode="nearest")
wv = np.clip((256 - yy) / 10.0, 0, 1)               # 1 above y = 246, 0 below y = 256
fill = cols & (yy >= NECK_TOP) & (yy < 256)
rgb = np.where(fill[..., None], ref[None, :, :] * wv[..., None] + rgb * (1 - wv[..., None]), rgb)
keep |= cols & (yy >= NECK_TOP) & (yy < 256)
# its two outlines, continued straight up
LINE = np.array([150., 88., 78.])
for x_line in (NL, NR):
    for y in range(NECK_TOP, 252):
        k = np.clip((252 - y) / 6.0, 0, 1)             # blends into the art's own outline below
        for x in (int(np.floor(x_line)), int(np.ceil(x_line))):
            w = (1 - abs(x - x_line)) * 0.85 * k
            rgb[y, x] = rgb[y, x] * (1 - w) + LINE * w
alpha = aa_alpha_from_mask(keep, sigma=0.6)
alpha = np.minimum(alpha, al * 1.0 + fill)   # never more than the art had (except the new neck)
alpha = np.clip(alpha, 0, 1)
# --- a shaded edge on the torso's sides under the sleeves (seen when an arm lifts)
dist_edge = ndi.distance_transform_edt(alpha > 0.5)
side_zone = ((xx < 430) | (xx > 590)) & (yy > 285) & (yy < 492)
shade = np.clip(1 - dist_edge / 12, 0, 1) * side_zone
rgb = rgb * (1 - 0.16 * shade[..., None]) 
outline = np.clip(1 - np.abs(dist_edge - 1.2) / 1.2, 0, 1) * side_zone * (dist_edge > 0)
rgb = rgb * (1 - 0.35 * outline[..., None]) + np.array([96., 70., 140.]) * 0.35 * outline[..., None]
rgb = bleed(rgb, alpha)
res = np.dstack([rgb, alpha * 255]).round().clip(0, 255).astype(np.uint8)
ys, xs = np.nonzero(alpha > 0.004)
y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
Image.fromarray(res[y0:y1, x0:x1]).save('out/body.png')
json.dump({'x': int(x0), 'y': int(y0), 'w': int(x1 - x0), 'h': int(y1 - y0)}, open('out/body.json', 'w'))
print('body box', x0, y0, x1 - x0, y1 - y0)
