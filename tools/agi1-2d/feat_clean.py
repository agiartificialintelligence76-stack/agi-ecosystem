# Clean the eye, brow and mouth pieces: keep only the drawn strokes (lashes, brows), with a soft alpha from how dark
# each pixel is compared with her skin, so moving them never drags a patch of skin or a strand of hair along.
import insp, numpy as np
from PIL import Image
from scipy import ndimage as ndi
SKIN = np.array([246., 186., 156.])
def lum(rgb): return rgb @ np.array([0.299, 0.587, 0.114])
def stroke(name, core_max_lum, core_lum, reach=3, gamma=1.0):
    a = np.array(insp.load(name)).astype(float)
    rgb, al = a[..., :3], a[..., 3] / 255
    L = lum(rgb)
    core = (L < core_max_lum) & (al > 0.3)
    near = ndi.binary_dilation(core, iterations=reach)
    t = np.clip((lum(SKIN) - L) / (lum(SKIN) - core_lum), 0, 1) ** gamma
    alpha = t * al * near
    # un-mix the stroke's own color from the skin behind it
    with np.errstate(divide='ignore', invalid='ignore'):
        C = (rgb - (1 - alpha[..., None]) * SKIN) / np.maximum(alpha[..., None], 1e-3)
    C = np.clip(C, 0, 255)
    # where alpha is small the un-mixed color is noisy: pull it toward the nearest strong stroke color
    strong = alpha > 0.6
    if strong.any():
        idx = ndi.distance_transform_edt(~strong, return_distances=False, return_indices=True)
        Cs = C[idx[0], idx[1]]
        k = np.clip(alpha / 0.6, 0, 1)[..., None]
        C = C * k + Cs * (1 - k)
    out = np.dstack([C, alpha * 255]).round().clip(0, 255).astype(np.uint8)
    return Image.fromarray(out)
res = {}
for s in 'LR':
    res[f'eye{s}_lashU'] = stroke(f'eye{s}_lashU', 90, 14, reach=2)
    res[f'eye{s}_lashD'] = stroke(f'eye{s}_lashD', 165, 112, reach=2)
    res[f'brow{s}'] = stroke(f'brow{s}', 150, 108, reach=2)
    res[f'eye{s}_white'] = insp.load(f'eye{s}_white')
    res[f'eye{s}_iris'] = insp.load(f'eye{s}_iris')
res['mouth'] = insp.load('mouth')
for k, v in res.items(): v.save(f'out/{k}.png')
# preview at 8x on skin color
tiles = []
for k in ['eyeL_lashU', 'eyeL_lashD', 'browL', 'eyeR_lashU', 'eyeR_lashD', 'browR']:
    im = res[k]; b = Image.new('RGBA', im.size, tuple(SKIN.astype(int)) + (255,)); b.alpha_composite(im)
    tiles.append(b.resize((im.width * 8, im.height * 8), Image.NEAREST))
W = max(t.width for t in tiles); sheet = Image.new('RGBA', (W * 2 + 8, sum(t.height + 6 for t in tiles[:3])), (40, 40, 40, 255))
y = 0
for i in range(3):
    sheet.paste(tiles[i], (0, y)); sheet.paste(tiles[i + 3], (W + 8, y)); y += tiles[i].height + 6
sheet.save('feat-clean8x.png')

# ---- brows: rebuild each as one clean stroke (a front-hair strand crossed them, leaving a gap and a diagonal line) ----
def rebuild_brow(im, im_side):
    a = np.array(im).astype(float); al = a[..., 3] / 255; rgb = a[..., :3]
    h, w = al.shape
    ys = np.arange(h)[:, None]
    # the brow's band: rows where most of the ink is
    rows = al.sum(1); band_c = (rows * np.arange(h)).sum() / rows.sum()
    cols = []
    for x in range(w):
        col = al[:, x] * (np.abs(np.arange(h) - band_c) < 6)
        s = col.sum()
        if s < 1.2: cols.append(None); continue
        c = (col * np.arange(h)).sum() / s
        cols.append((x, c, s, (rgb[:, x] * col[:, None]).sum(0) / s))
    good = [c for c in cols if c]
    xs = np.array([c[0] for c in good]); cs = np.array([c[1] for c in good]); ts = np.array([c[2] for c in good])
    cols_rgb = np.array([c[3] for c in good])
    # a smooth center line and thickness; the gap columns come from the neighbours
    p = np.polyfit(xs, cs, 2, w=ts)
    x0, x1 = xs.min(), xs.max()
    X = np.arange(w)
    thick = np.interp(X, xs, ndi.median_filter(ts, 5))
    thick = ndi.gaussian_filter1d(thick, 1.5)
    # taper both ends over a few pixels
    u = np.clip((X - x0) / max(1, x1 - x0), 0, 1)
    inner_right = im_side == 'L'                       # her right brow (image left): its inner end is on the right
    ui = u if inner_right else 1 - u                   # 0 at the outer end, 1 at the inner end
    outer = np.clip(ui / 0.35, 0, 1) ** 0.8            # the outer end tapers to a point
    inner = np.clip((1 - ui) / 0.1, 0, 1) ** 0.5       # the inner end is blunter
    thick = thick * (0.15 + 0.85 * outer) * (0.55 + 0.45 * inner) * ((X >= x0) & (X <= x1))
    center = np.polyval(p, X)
    colr = np.stack([np.interp(X, xs, ndi.median_filter(cols_rgb[:, k], 5)) for k in range(3)], 1)
    d = np.abs(ys - center[None, :]) - thick[None, :] / 2
    alpha = np.clip(0.5 - d, 0, 1) * (thick[None, :] > 0.25)   # one pixel of antialiasing
    # a slightly darker lower edge, like the original stroke
    shade = np.clip((ys - center[None, :]) / np.maximum(thick[None, :], 1), -0.5, 0.5)
    C = colr[None, :, :] * (1 - 0.12 * shade[..., None])
    out = np.dstack([C, alpha * 255 * 0.96]).round().clip(0, 255).astype(np.uint8)
    return Image.fromarray(out)
for s in 'LR':
    res[f'brow{s}'] = rebuild_brow(res[f'brow{s}'], s)
    res[f'brow{s}'].save(f'out/brow{s}.png')
tiles = []
for k in ['browL', 'browR']:
    im = res[k]; b = Image.new('RGBA', im.size, tuple(SKIN.astype(int)) + (255,)); b.alpha_composite(im)
    tiles.append(b.resize((im.width * 8, im.height * 8), Image.NEAREST))
sheet = Image.new('RGBA', (tiles[0].width + tiles[1].width + 8, max(t.height for t in tiles)), (40, 40, 40, 255))
sheet.paste(tiles[0], (0, 0)); sheet.paste(tiles[1], (tiles[0].width + 8, 0)); sheet.save('brows8x.png')
