# The back hair: the art has flat fills, smeared streaks, holes and bits of shirt where the body and arms were painted
# out. They're hidden until she lifts an arm or her hair swings, so they're repainted as hair in shadow: strands that
# flow down and wave a little (line-integral convolution of noise along a wavy flow), in her own hair colors, darker the
# deeper they sit behind her.
import insp, numpy as np, json
from PIL import Image
from scipy import ndimage as ndi
from util import lum, aa_alpha_from_mask, bleed, drop_islands
rng = np.random.default_rng(7)
H, W = 1536, 1024
b = insp.box_of('backHair'); f = np.zeros((H, W, 4)); f[b['y']:b['y'] + b['h'], b['x']:b['x'] + b['w']] = np.array(insp.load('backHair')).astype(float)
rgb, al = f[..., :3], f[..., 3] / 255
yy, xx = np.mgrid[0:H, 0:W]
L = lum(rgb)
# --- what to repaint
gx = np.abs(np.diff(L, axis=1, append=L[:, -1:])); gy = np.abs(np.diff(L, axis=0, append=L[-1:, :]))
mgx = ndi.uniform_filter(gx, 7); mgy = ndi.uniform_filter(gy, 7)
flat = (mgx + mgy) < 2.2
streak = (mgx > 2.0) & (mgy < 0.45 * mgx) & (mgy < 1.6)
lav = (rgb[..., 2] > rgb[..., 1] - 5) & (al > 0.2)
garb = (flat | streak | lav) & (al > 0.5) & (yy > 100)
garb = ndi.binary_closing(ndi.binary_opening(garb, iterations=2), iterations=3)
lab, n = ndi.label(garb); sizes = ndi.sum(garb, lab, range(1, n + 1))
big = np.isin(lab, 1 + np.nonzero(sizes > 400)[0])
mass = ndi.binary_fill_holes(ndi.binary_closing(al > 0.5, structure=np.ones((3, 3)), iterations=12))
# what covers the back hair when she stands still (the cleaned body and face, the front hair, the arms)
def cover_of(name, use_out=True):
    im, bx_ = insp.load_out(name) if use_out else (insp.load(name), insp.box_of(name))
    m_ = np.zeros((H, W), bool); m_[bx_['y']:bx_['y'] + bx_['h'], bx_['x']:bx_['x'] + bx_['w']] = np.array(im)[..., 3] > 128
    return m_
cover = cover_of('body') | cover_of('face') | cover_of('frontHair', False) | cover_of('armL', False) | cover_of('armR', False)
hidden = ndi.binary_erosion(cover, iterations=2)
# holes are filled only where they're hidden at rest (behind an arm or her body): shown when she lifts an arm or sways.
# Gaps between the outer strands stay as they are.
holes = mass & (al < 0.5) & (yy > 150) & hidden
lav_all = ndi.binary_dilation(lav, iterations=2) & (yy > 150)
todo = (big | holes | lav_all)
todo = ndi.binary_dilation(todo, iterations=1) & (mass | lav_all) & ((al > 0.5) | holes)
# --- hair palette from the real strands of the long hair
real = (al > 0.95) & ~ndi.binary_dilation(todo, iterations=3) & (yy > 280) & (yy < 620)
Lr = L[real]; cr = rgb[real]
def tone(p, band=4):
    lo, hi = np.percentile(Lr, [max(0, p - band), min(100, p + band)])
    sel = (Lr >= lo) & (Lr <= hi); return cr[sel].mean(0)
P_DARK, P_MID, P_LIGHT = tone(8), tone(45), tone(85)
print('palette', P_DARK.round(), P_MID.round(), P_LIGHT.round())
# --- line integral convolution along a wavy, downward flow
ys, xs = np.nonzero(todo)
y0, y1, x0, x1 = ys.min() - 30, ys.max() + 30, xs.min() - 30, xs.max() + 30
hh, ww = y1 - y0, x1 - x0
noise = rng.random((hh, ww))
noise = ndi.gaussian_filter(noise, (0.6, 1.1))       # strands a couple of pixels wide
def flow_angle(x, y):
    X, Y = x + x0, y + y0
    return np.pi / 2 + 0.2 * np.sin(Y / 41 + X / 57) + 0.12 * np.sin(Y / 17 - X / 29 + 1.3) + 0.08 * np.sign(X - 512) * np.clip((Y - 280) / 300, 0, 1)
def sample(img, x, y):
    x = np.clip(x, 0, img.shape[1] - 1.001); y = np.clip(y, 0, img.shape[0] - 1.001)
    x0_, y0_ = np.floor(x).astype(int), np.floor(y).astype(int); fx, fy = x - x0_, y - y0_
    return (img[y0_, x0_] * (1 - fx) * (1 - fy) + img[y0_, x0_ + 1] * fx * (1 - fy) + img[y0_ + 1, x0_] * (1 - fx) * fy + img[y0_ + 1, x0_ + 1] * fx * fy)
gy_, gx_ = np.mgrid[0:hh, 0:ww].astype(float)
acc = np.zeros((hh, ww)); wsum = np.zeros((hh, ww))
STEPS = 26
for direction in (1, -1):
    px, py = gx_.copy(), gy_.copy()
    for s in range(STEPS):
        a = flow_angle(px, py)
        px += direction * np.cos(a); py += direction * np.sin(a)
        wgt = 1 - s / STEPS
        acc += sample(noise, px, py) * wgt; wsum += wgt
lic = acc / wsum
lic = (lic - lic.mean()) / lic.std()
# strands: contrast, plus a slower variation (locks of hair lighter and darker)
locks = ndi.gaussian_filter(rng.random((hh, ww)), (18, 5)); locks = (locks - locks.mean()) / locks.std()
v = 0.52 + 0.27 * lic + 0.07 * locks
v = np.clip(v, 0, 1)
col = np.where(v[..., None] < 0.5, P_DARK + (P_MID - P_DARK) * (v[..., None] / 0.5), P_MID + (P_LIGHT - P_MID) * ((v[..., None] - 0.5) / 0.5))
# in shadow: darker the deeper behind her (far from any real hair or the edge of the hair)
todo_c = todo[y0:y1, x0:x1]
depth = ndi.distance_transform_edt(todo_c)
shade = 1 - 0.2 * np.clip(depth / 45, 0, 1) - 0.05
col = col * shade[..., None]
syn = np.zeros((H, W, 3)); syn[y0:y1, x0:x1] = col
w = ndi.gaussian_filter(todo.astype(float), 1.2) * mass
w = np.clip(w * 1.3, 0, 1); w[todo] = 1
rgb = rgb * (1 - w[..., None]) + syn * w[..., None]
alpha = np.maximum(al, todo.astype(float))
# white matting fringes at the outer edge: pull near-white edge pixels toward the hair color next to them
edge = (alpha > 0.02) & (alpha < 0.98) | (ndi.binary_dilation(alpha < 0.5, iterations=1) & (alpha >= 0.5))
whitish = edge & (rgb.min(-1) > 200)
if whitish.any():
    inner = (alpha > 0.95) & ~whitish
    idx = ndi.distance_transform_edt(~inner, return_distances=False, return_indices=True)
    rgb[whitish] = rgb[idx[0], idx[1]][whitish]
alpha = drop_islands(alpha, 40)
# the last two white specks (at her left, by her eye)
white = (rgb.min(-1) > 228) & (alpha > 0.2)
if white.any():
    inner = (alpha > 0.95) & ~ndi.binary_dilation(white, iterations=2)
    idx = ndi.distance_transform_edt(~inner, return_distances=False, return_indices=True)
    rgb[white] = rgb[idx[0], idx[1]][white]
rgb = bleed(rgb, alpha)
res = np.dstack([rgb, alpha * 255]).round().clip(0, 255).astype(np.uint8)
ys, xs = np.nonzero(alpha > 0.004)
Y0, Y1, X0, X1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
Image.fromarray(res[Y0:Y1, X0:X1]).save('out/backHair.png')
json.dump({'x': int(X0), 'y': int(Y0), 'w': int(X1 - X0), 'h': int(Y1 - Y0)}, open('out/backHair.json', 'w'))
print('backHair box', X0, Y0, X1 - X0, Y1 - Y0)
vis = Image.new('RGBA', (W, H), (60, 200, 120, 255)); vis.alpha_composite(Image.fromarray(res))
vis.crop((265, 0, 760, 630)).resize((990, 1260), Image.LANCZOS).save('bh-clean.png')
