# The arms: smooth edges, each arm one picture (the site bends it at the elbow: elbowOuter/elbowInner in
# src/stage/agi1-2d-motion.js: a round elbow outside and a clean crease inside), and where her joints are.
# Two flaws in the art's outline are repaired first, because the crease shows them up close: a small step in her right
# arm's inner outline above the elbow, and bits of hair stuck to her left arm's inner outline at the elbow.
import insp, numpy as np, json
from PIL import Image
from scipy import ndimage as ndi
from util import aa_alpha_from_mask, bleed
H, W = 1536, 1024
J = {'L': {'sh': (372, 335), 'el': (309, 522), 'wr': (205, 676)}, 'R': {'sh': (652, 335), 'el': (711, 522), 'wr': (813, 676)}}
# (side of the arm, rows of the flaw, rows around it that are clean, the curve through them, the columns to look in)
REPAIR = {'L': [('left', (452, 464), (428, 490), 1, (250, 400))], 'R': [('right', (486, 513), (456, 540), 3, (640, 800))]}


def edge_x(al, y, side, xr):
    """Where row y's outline is (alpha = 0.5 between two pixel centers), on the given side, within columns xr."""
    r = al[y, xr[0]:xr[1]]; xs = np.nonzero(r >= 0.5)[0]
    if side == 'left':
        i = xs[0]
        return xr[0] + i - 0.5 + (0.5 - r[i - 1]) / max(1e-3, r[i] - r[i - 1])
    i = xs[-1]
    return xr[0] + i + 0.5 + (r[i] - 0.5) / max(1e-3, r[i] - r[i + 1])


def repair_edge(rgb, al, side, flaw, around, deg, xr):
    """Redraw a stretch of the outline: a smooth curve through the clean outline around it, drawn with the clean outline's
    own look (its stroke, anti-aliasing and the skin next to it, measured across the outline)."""
    f0, f1 = flaw; ys = [y for y in range(around[0], around[1] + 1) if y < f0 - 1 or y > f1 + 1]
    P = np.polyfit(ys, [edge_x(al, y, side, xr) for y in ys], deg); dP = np.polyder(P)
    sgn = 1 if side == 'left' else -1
    def dist(y, x):                     # how far inside the outline pixel (x, y)'s centre is, across the outline
        return sgn * (x + 0.5 - np.polyval(P, y)) / np.sqrt(1 + np.polyval(dP, y) ** 2)
    bins = np.arange(-3, 8.001, 0.25); acc = np.zeros((len(bins), 5))
    for y in ys:
        if abs(y - (f0 + f1) / 2) > (f1 - f0) / 2 + 16: continue
        for x in range(xr[0], xr[1]):
            d = dist(y, x)
            if -3 <= d <= 8:
                k = int(round((d + 3) / 0.25)); a = al[y, x]
                acc[k] += [a, *(rgb[y, x] * a), 1]
    prof_a = acc[:, 0] / np.maximum(acc[:, 4], 1)
    prof_c = acc[:, 1:4] / np.maximum(acc[:, 0:1], 1e-6)
    for k in range(len(bins)):          # bins without paint: the colour of the nearest painted one
        if acc[k, 0] < 1e-3:
            j = min((j for j in range(len(bins)) if acc[j, 0] >= 1e-3), key=lambda j: abs(j - k)); prof_c[k] = prof_c[j]
    for y in range(f0 - 3, f1 + 4):
        wy = min(1.0, (y - (f0 - 4)) / 4, ((f1 + 4) - y) / 4)      # fade in and out over the rows next to the flaw
        for x in range(xr[0], xr[1]):
            d = dist(y, x)
            if d > 8: continue
            if d < -3: na, nc = 0.0, rgb[y, x]
            else:
                t = (d + 3) / 0.25; k = min(len(bins) - 2, int(t)); u = t - k
                na = prof_a[k] * (1 - u) + prof_a[k + 1] * u; nc = prof_c[k] * (1 - u) + prof_c[k + 1] * u
                keep = np.clip((d - 5) / 3, 0, 1); keep = keep * keep * (3 - 2 * keep)   # inside: back to the art's own skin
                na = na * (1 - keep) + al[y, x] * keep; nc = nc * (1 - keep) + rgb[y, x] * keep
            al[y, x] = al[y, x] * (1 - wy) + na * wy; rgb[y, x] = rgb[y, x] * (1 - wy) + np.asarray(nc) * wy


meta = {}
for s in 'LR':
    name = 'arm' + s; b = insp.box_of(name)
    f = np.zeros((H, W, 4)); f[b['y']:b['y'] + b['h'], b['x']:b['x'] + b['w']] = np.array(insp.load(name)).astype(float)
    rgb, al = f[..., :3], f[..., 3] / 255
    m = al > 0.5
    m = ndi.binary_closing(ndi.binary_opening(m, iterations=1), iterations=2)   # the small notches in the outline
    alpha = aa_alpha_from_mask(m, sigma=0.7)
    alpha = np.minimum(alpha, ndi.maximum_filter(al, 3))
    rgb = bleed(rgb, alpha)
    for r in REPAIR[s]: repair_edge(rgb, alpha, *r)
    rgb = bleed(rgb, alpha)
    res = np.dstack([rgb, alpha * 255]).round().clip(0, 255).astype(np.uint8)
    ys, xs = np.nonzero(alpha > 0.004); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    Image.fromarray(res[y0:y1, x0:x1]).save(f'out/arm{s}.png')
    json.dump({'x': int(x0), 'y': int(y0), 'w': int(x1 - x0), 'h': int(y1 - y0)}, open(f'out/arm{s}.json', 'w'))
    print(f'arm{s}', x0, y0, x1 - x0, y1 - y0)
    meta[s] = dict(J[s])
json.dump(meta, open('out/arms.json', 'w'), indent=1)
