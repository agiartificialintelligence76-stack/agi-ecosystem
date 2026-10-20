"""AGI-1 in 8-bit (2026-10-20), for the AGI GAMES intro every game opens with (src/games/intro.js): her frames as pixel
art, made from her 2D art (the front's cutout, public/images/landing/agi1-cutout.webp: the owner's art, never the 3D
model), and written as src/games/intro-sprite.js (generated: don't edit it by hand).

How it's made, at the art's own size first, then in pixels:
  1. Every pixel of her art gets the nearest colour of a small hand-picked palette (hair, skin, lavender, white, dark),
     nearest as the eye sees it (OKLab).
  2. Her arms are found (the skin reached from each hand), lifted off her and turned at her shoulders: up in a Y (air),
     straight up (dive). The hair behind her arms is filled in with hair (her art never drew it). Her sleeves stay on top.
  3. A crouch: her legs bend (thighs and shins shorter, knees out); her feet stay where they are, and her body comes down
     by exactly whole pixels, so her head and her shirt come out the same in every frame.
  4. Every frame is cut into one grid of square pixels (ROWS of them for her height, its bottom at her soles, a column
     on her middle); a pixel takes the colour most of it has, and stays empty when it's more than half empty.
  5. Tidied: specks apart from her go, pinholes are filled. Then drawn by hand on top: her eyes, her blush and her mouth,
     and "AGI" on her shirt (her art's letters are too small to survive as pixels). Then an ink outline.
  6. Her back (2026-10-20), for the far side of her spin jump (mirrored, her front read "AGI" backwards): her air frame
     with her hair over her head and neck, and her long hair down her back (as long as the hair at her sides, in
     strands, with a shine across it), so no letters on her tee. Her outline as the air frame's.

Run (Python with numpy, OpenCV and Pillow; Claude's workspace has them):
    python3 tools/games/agi1-8bit.py                 # writes src/games/intro-sprite.js
    python3 tools/games/agi1-8bit.py --png sheet.png # also a preview of every frame, 8x
Then npm test (tests/intro.test.js reads the module).
"""
import sys, os, json
import numpy as np, cv2
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..')
SRC = os.path.join(ROOT, 'public', 'images', 'landing', 'agi1-cutout.webp')
OUT = os.path.join(ROOT, 'src', 'games', 'intro-sprite.js')
ROWS = 56            # her height in pixels, head to soles

# The palette her art is read with, and what each colour is (its first letter is its group).
PAL = {
    'hy': '#fde3b0', 'hl': '#f5c98f', 'hb': '#e2ad74', 'hs': '#bb8352', 'hd': '#8c5a36',   # hair
    'sl': '#ffd9c0', 'sb': '#fcc3a6', 'ss': '#e9a48a', 'sd': '#c97f6c',                    # skin
    'll': '#e6c9ff', 'lb': '#cfa7f4', 'ls': '#b08ae0', 'ld': '#8a66b8',                    # lavender (her tee, shorts)
    'ww': '#ffffff', 'wo': '#f1e8fa',                                                     # white (letters, trims, shoes)
    'ee': '#4a2b29',                                                                      # dark (lashes, lines)
}
# Drawn by hand on top (never read from the art).
EXTRA = {'ey': '#2a1630', 'bl': '#ff9db6', 'mo': '#d8606f', 'ik': '#170a36'}
KEYS = list(PAL)
NK = len(KEYS)
RGB = np.array([[int(PAL[k][i:i + 2], 16) for i in (1, 3, 5)] for k in KEYS], float)
GROUPS = np.array([k[0] for k in KEYS])
IDX = {k: i for i, k in enumerate(KEYS)}
for k in EXTRA:
    IDX[k] = len(IDX)
ALL = {**PAL, **EXTRA}


def oklab(rgb):
    c = rgb / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    l = np.cbrt(c @ np.array([0.4122214708, 0.5363325363, 0.0514459929]))
    m = np.cbrt(c @ np.array([0.2119034982, 0.6806995451, 0.1073969566]))
    s = np.cbrt(c @ np.array([0.0883024619, 0.2817188376, 0.6299787005]))
    return np.stack([0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
                     1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
                     0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s], -1)


PAL_LAB = oklab(RGB)


def classify(rgb, only=None):
    """Each pixel's nearest palette colour (an index into KEYS); `only` limits it to some colours."""
    lab = oklab(rgb.reshape(-1, 3).astype(float))
    pal = PAL_LAB if only is None else PAL_LAB[only]
    best = np.empty(len(lab), int)
    for a in range(0, len(lab), 200000):                       # in parts: memory
        d = ((lab[a:a + 200000, None, :] - pal[None, :, :]) ** 2).sum(-1)
        best[a:a + 200000] = d.argmin(1)
    if only is not None:
        best = np.asarray(only)[best]
    return best.reshape(rgb.shape[:-1])


# ---------------------------------------------------------------- her art, read
def read_art():
    src = np.array(Image.open(SRC).convert('RGBA'))
    h0, w0 = src.shape[:2]
    pad_t, pad_s, pad_b = 420, 260, 40                          # room for her arms up
    img = np.zeros((h0 + pad_t + pad_b, w0 + 2 * pad_s, 4), np.uint8)
    img[pad_t:pad_t + h0, pad_s:pad_s + w0] = src
    return img, pad_t, pad_s


IMG, PADT, PADS = read_art()
H, W = IMG.shape[:2]
OPAQUE = IMG[..., 3] >= 128
CLS = np.full((H, W), -1, int)
CLS[OPAQUE] = classify(IMG[..., :3][OPAQUE][None])[0]
G = np.full((H, W), ' ')
G[OPAQUE] = GROUPS[CLS[OPAQUE]]
ys_, xs_ = np.nonzero(OPAQUE)
TOP, BOT, LEFT, RIGHT = ys_.min(), ys_.max(), xs_.min(), xs_.max()
CX = (LEFT + RIGHT) / 2
XX = np.arange(W)[None, :] * np.ones((H, 1))
YY = np.arange(H)[:, None] * np.ones((1, W))


def flood(seed, allow):
    m = np.zeros((H + 2, W + 2), np.uint8)
    canvas = allow.astype(np.uint8) * 255
    cv2.floodFill(canvas, m, seed, 128, loDiff=0, upDiff=0, flags=4)
    return canvas == 128


def grow(mask, size):
    return cv2.dilate(mask.astype(np.uint8), np.ones((size, size), np.uint8)).astype(bool)


# ---------------------------------------------------------------- her arms
SKIN = (G == 's') | (G == 'e')
HAND_L = (PADS + 60, PADT + 760)                                # her left hand (on the left of the picture)
HAND_R = (int(2 * CX - HAND_L[0]), PADT + 760)


def arm_mask(seed, side):
    m = flood(seed, SKIN & (side * (XX - CX) > 80))
    m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)).astype(bool) & OPAQUE
    # every bit of her hand (its highlights read as hair or white): out beside her hips there's nothing else
    m |= OPAQUE & grow(m, 61) & (side * (XX - CX) > 200) & (YY > PADT + 600)
    return m


ARM_L, ARM_R = arm_mask(HAND_L, -1), arm_mask(HAND_R, 1)
ARMS = ARM_L | ARM_R
FRONT = OPAQUE & ((G == 'l') | (G == 'w')) & ~ARMS               # her tee and shorts, drawn over her arms
FRONT[PADT + 1290:, :] = False                                  # her shoes go with her legs
BACK = OPAQUE & ~ARMS & ~FRONT
HAIR = G == 'h'
HAIRZONE = cv2.morphologyEx(HAIR.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((71, 71), np.uint8)).astype(bool)
HOLES = ARMS & HAIRZONE & ~FRONT                                # where her arms covered her hair


def hair_fill():
    """Her hair where her arms were: filled from the hair around it only (never her arm's skin), in hair colours."""
    rgb = np.ascontiguousarray(IMG[..., 2::-1])                 # BGR for OpenCV
    unknown = HOLES | (grow(HOLES, 61) & ~HAIR)                 # only hair pixels feed the fill
    filled = cv2.inpaint(rgb, unknown.astype(np.uint8) * 255, 15, cv2.INPAINT_TELEA)[..., ::-1]
    hair_keys = [IDX[k] for k in KEYS if k[0] == 'h']
    idx = classify(filled[HOLES][None].astype(float), hair_keys)[0]
    out = np.zeros_like(IMG)
    out[BACK] = IMG[BACK]
    out[HOLES, :3] = RGB[idx].astype(np.uint8)
    out[HOLES, 3] = 255
    return out


BACK_RGBA = hair_fill()
FRONT_RGBA = np.zeros_like(IMG)
FRONT_RGBA[FRONT] = IMG[FRONT]


def arm_layer(mask):
    yy, xx = np.nonzero(mask)
    pts = np.stack([xx, yy], 1).astype(float)
    c = pts.mean(0)
    d = np.linalg.svd(pts - c, full_matrices=False)[2][0]
    if d[1] > 0:
        d = -d                                                  # along her arm, toward her shoulder
    root = c + d * ((pts - c) @ d).max()
    layer = np.zeros_like(IMG)
    layer[mask] = IMG[mask]
    # her arm goes on under her sleeve, so a raised arm never shows a cut end
    proj = (pts - root) @ d
    sel = proj > -45
    sx, sy = xx[sel], yy[sel]
    for k in range(4, 80, 3):
        tx = np.round(sx + d[0] * k).astype(int)
        ty = np.round(sy + d[1] * k).astype(int)
        ok = (tx >= 0) & (tx < W) & (ty >= 0) & (ty < H)
        tx, ty, fx, fy = tx[ok], ty[ok], sx[ok], sy[ok]
        under = FRONT[ty, tx] & (layer[ty, tx, 3] == 0)
        layer[ty[under], tx[under]] = IMG[fy[under], fx[under]]
    return layer, root + d * 55                                 # its shoulder: where it turns


ARM_L_RGBA, PIV_L = arm_layer(ARM_L)
ARM_R_RGBA, PIV_R = arm_layer(ARM_R)


def turn(layer, pivot, deg):
    m = cv2.getRotationMatrix2D((float(pivot[0]), float(pivot[1])), deg, 1.0)
    return cv2.warpAffine(layer, m, (W, H), flags=cv2.INTER_NEAREST, borderValue=(0, 0, 0, 0))


def over(dst, src):
    m = src[..., 3] >= 128
    dst[m] = src[m]


# ---------------------------------------------------------------- her legs
HEM, KNEE, ANKLE = PADT + 745, PADT + 1015, PADT + 1318         # her shorts' hem, her knees, her ankles
F = (BOT + 1 - TOP) / ROWS                                      # art pixels in one sprite pixel


def squat(layer, drop_cells, shin, spread):
    """Her legs bent so her body comes down exactly drop_cells pixels; her feet stay put."""
    knee2 = ANKLE - (ANKLE - KNEE) * shin
    hem2 = HEM + drop_cells * F
    thigh = (knee2 - hem2) / (KNEE - HEM)
    yo = np.arange(H, dtype=np.float32)[:, None] * np.ones((1, W), np.float32)
    xo = np.ones((H, 1), np.float32) * np.arange(W, dtype=np.float32)[None, :]
    ysrc = yo.copy()
    above = yo < hem2
    ysrc[above] = yo[above] - (hem2 - HEM)
    th = (yo >= hem2) & (yo < knee2)
    ysrc[th] = HEM + (yo[th] - hem2) / thigh
    sh = (yo >= knee2) & (yo < ANKLE)
    ysrc[sh] = KNEE + (yo[sh] - knee2) / shin
    w = np.zeros_like(yo)
    w[th] = (yo[th] - hem2) / (knee2 - hem2)
    w[sh] = 1 - (yo[sh] - knee2) / (ANKLE - knee2)
    xsrc = xo - np.sign(xo - CX) * spread * w
    return cv2.remap(layer, xsrc.astype(np.float32), ysrc.astype(np.float32), cv2.INTER_NEAREST,
                     borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))


def frame(arm_l=0.0, arm_r=0.0, drop=0, shin=1.0, spread=0.0):
    out = np.zeros_like(IMG)
    over(out, BACK_RGBA)
    over(out, turn(ARM_L_RGBA, PIV_L, arm_l))
    over(out, turn(ARM_R_RGBA, PIV_R, arm_r))
    over(out, FRONT_RGBA)
    if drop:
        out = squat(out, drop, shin, spread)
    return out


POSES = {
    'stand': dict(),
    'crouch': dict(arm_l=8, arm_r=-8, drop=7, shin=0.86, spread=34),
    'air': dict(arm_l=-118, arm_r=118),
    'dive': dict(arm_l=-142, arm_r=142),
}


# ---------------------------------------------------------------- pixels
def pixelize(fr):
    a = fr[..., 3] >= 128
    c = np.full((H, W), NK, int)
    if a.any():
        c[a] = classify(fr[..., :3][a][None].astype(float))[0]
    gy1 = BOT + 1                                               # the grid's bottom at her soles
    ny = int(np.ceil(gy1 / F))
    gx0 = CX - F / 2 - F * int(np.ceil((CX - F / 2) / F))       # a column on her middle
    nx = int(np.ceil((W - gx0) / F))
    grid = np.full((ny, nx), -1, int)
    for j in range(ny):
        y0f = gy1 - (ny - j) * F
        ya, yb = int(np.floor(max(0, y0f))), int(np.ceil(min(H, y0f + F)))
        if yb <= ya:
            continue
        for i in range(nx):
            x0f = gx0 + i * F
            xa, xb = int(np.floor(max(0, x0f))), int(np.ceil(min(W, x0f + F)))
            if xb <= xa:
                continue
            cell = c[ya:yb, xa:xb]
            cnt = np.bincount(cell.reshape(-1), minlength=NK + 1)
            if cnt[NK] > cell.size * 0.5:
                continue
            grid[j, i] = cnt[:NK].argmax()
    mid = int((CX - gx0) // F)                                  # the column on her middle
    return grid, mid


def tidy(g):
    """Specks apart from her go; pinholes inside her are filled with their neighbours' colour."""
    filled = (g >= 0).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(filled, connectivity=8)
    if n > 2:
        biggest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        for k in range(1, n):
            if k != biggest and stats[k, cv2.CC_STAT_AREA] < 12:
                g[lab == k] = -1
    h, w = g.shape
    for _ in range(2):
        out = g.copy()
        for y in range(1, h - 1):
            for x in range(1, w - 1):
                if g[y, x] >= 0:
                    continue
                nb = [g[y - 1, x], g[y + 1, x], g[y, x - 1], g[y, x + 1]]
                full = [v for v in nb if v >= 0]
                if len(full) >= 3:
                    out[y, x] = max(set(full), key=full.count)
        g = out
    return g


# ---------------------------------------------------------------- drawn by hand
FONT = {   # "AGI" on her tee, 4 pixels tall (her art's letters are about 1.5 pixels tall at this size)
    'A': ['.#.', '#.#', '###', '#.#'],
    'G': ['###', '#..', '#.#', '###'],
    'I': ['#', '#', '#', '#'],
}


def group_at(g, y, x):
    v = g[y, x]
    return '' if v < 0 else (KEYS[v][0] if v < NK else 'x')


def find_face(g, mid):
    """Her face's rows: the first row her skin is 5 wide on her middle (her eyes), and her tee's first row below it."""
    head_top = next(y for y in range(g.shape[0]) if g[y, mid] >= 0)
    eye = None
    for y in range(head_top, g.shape[0]):
        if group_at(g, y, mid) != 's':
            continue
        if all(group_at(g, y, mid + d) == 's' for d in (-2, -1, 0, 1, 2)):
            eye = y
            break
    tee = next(y for y in range(eye + 1, g.shape[0]) if group_at(g, y, mid) == 'l')
    return head_top, eye, tee


def draw_face(g, mid, eye):
    for dy in (-1, 0):                                          # her eyes, two pixels tall
        for dx in (-1, 1):
            g[eye + dy, mid + dx] = IDX['ey']
    for dx in (-2, 2):                                          # her blush
        if group_at(g, eye + 1, mid + dx) == 's':
            g[eye + 1, mid + dx] = IDX['bl']
    if group_at(g, eye + 2, mid) == 's':                       # her smile
        g[eye + 2, mid] = IDX['mo']


def draw_letters(g, mid, tee):
    x = mid - 4
    for ch in 'AGI':
        rows = FONT[ch]
        for dy, row in enumerate(rows):
            for dx, on in enumerate(row):
                if on == '#':
                    g[tee + 1 + dy, x + dx] = IDX['ww']
        x += len(rows[0]) + 1


SKIN_TO_HAIR = {'sl': 'hl', 'sb': 'hb', 'ss': 'hs', 'sd': 'hd'}
BACK_TIPS = {2: -1, 3: -1, 5: -1}   # her hair's ends down her back, a pixel shorter at these columns from her middle


def back_hair(y, a, tee, ends):
    """A pixel of her hair down her back: its colour by its row and its column's distance from her middle (a)."""
    if y < tee:
        return 'hs'                                             # just under her head: in its shadow
    if a and a % 3 == 0:
        return 'hs' if y < ends - 1 else 'hd'                   # between its strands
    if tee + 1 <= y <= tee + 2 and a:
        return 'hl'                                             # a shine across it
    if y == tee + 3 and a % 3 == 1:
        return 'hl'
    return 'hb'


def draw_back(g, mid, top, tee):
    """Her back, for the far side of her spin (2026-10-20: mirrored, her front read "AGI" backwards). Made from a frame
    before her face and letters are drawn on it, inside her outline only (her silhouette stays the same):
      - her hair over her head and her neck: her face's skin (the run of it on her middle in each row) in the hair
        colour of the same shade;
      - her long hair down her back: from her nape (two rows above her tee's first row on her middle), a pixel wider on
        each side every row, down to where the hair at her sides ends, every pixel of her tee (and of that hair) is her
        hair, in strands; so no "AGI" (it's on her tee's front). Her arms (skin) stay as they are."""
    w = g.shape[1]
    for y in range(top, tee):
        if group_at(g, y, mid) != 's':
            continue
        x0 = x1 = mid
        while x0 > 0 and group_at(g, y, x0 - 1) == 's':
            x0 -= 1
        while x1 + 1 < w and group_at(g, y, x1 + 1) == 's':
            x1 += 1
        for x in range(x0, x1 + 1):
            g[y, x] = IDX[SKIN_TO_HAIR[KEYS[g[y, x]]]]
    ends = max(y for y in range(tee, g.shape[0]) for x in range(w) if group_at(g, y, x) == 'h')
    nape = tee - 2
    for y in range(nape, ends):
        for x in range(w):
            a = abs(x - mid)
            if a > 2 + (y - nape) or y > ends - 1 + BACK_TIPS.get(a, 0):
                continue
            if group_at(g, y, x) in ('l', 'w', 'h'):
                g[y, x] = IDX[back_hair(y, a, tee, ends)]


def outline(g):
    h, w = g.shape
    out = np.full((h + 2, w + 2), -1, int)
    out[1:-1, 1:-1] = g
    full = out >= 0
    near = np.zeros_like(full)
    near[1:, :] |= full[:-1, :]
    near[:-1, :] |= full[1:, :]
    near[:, 1:] |= full[:, :-1]
    near[:, :-1] |= full[:, 1:]
    out[near & ~full] = IDX['ik']
    return out


def build():
    grids, mids = {}, {}
    for name, pose in POSES.items():
        grids[name], mids[name] = pixelize(frame(**pose))
    mid = mids['stand']
    assert all(m == mid for m in mids.values())
    for name in grids:
        grids[name] = tidy(grids[name])
    # one crop for every frame, so her feet are in the same place in each
    u = np.zeros_like(grids['stand'], bool)
    for g in grids.values():
        u |= g >= 0
    rr, cc = np.nonzero(u)
    r0, r1, c0, c1 = rr.min(), rr.max() + 1, cc.min(), cc.max() + 1
    mid -= c0
    head = {}
    for name in grids:
        grids[name] = grids[name][r0:r1, c0:c1]
    st_top, st_eye, st_tee = find_face(grids['stand'], mid)
    back = None
    for name, g in grids.items():
        top = next(y for y in range(g.shape[0]) if g[y, mid] >= 0)
        shift = top - st_top                                    # her crouch: her body came down whole pixels
        if name == 'air':                                       # her back, in the air (her spin's far side)
            back = g.copy()
            draw_back(back, mid, st_top + shift, st_tee + shift)
        draw_face(g, mid, st_eye + shift)
        draw_letters(g, mid, st_tee + shift)
        head[name] = shift
    grids['back'] = back
    return {name: outline(g) for name, g in grids.items()}, mid + 1, head


CHARS = '0123456789abcdefghijklmnopqrstuvwxyz'


def module(frames, mid):
    used = sorted({v for g in frames.values() for v in g.reshape(-1) if v >= 0})
    names = list(ALL)
    char = {v: CHARS[i] for i, v in enumerate(used)}
    h, w = next(iter(frames.values())).shape
    feet = next(y for y in range(h - 1, -1, -1) if (frames['stand'][y] >= 0).any())
    lines = [
        '// Generated by tools/games/agi1-8bit.py from her 2D art (public/images/landing/agi1-cutout.webp): don\'t edit by',
        '// hand. AGI-1 in 8-bit for the AGI GAMES intro: every frame the same size, one character a pixel (a colour of',
        '// PALETTE, "." empty), her soles\' middle at FEET.',
        'export const PALETTE = {',
    ]
    for v in used:
        lines.append(f"  '{char[v]}': '{ALL[names[v]]}', // {names[v]}")
    lines.append('};')
    lines.append(f'export const SIZE = {{ w: {w}, h: {h} }};')
    lines.append(f'export const FEET = {{ x: {mid + 0.5}, y: {feet + 1} }};')
    lines.append('export const FRAMES = {')
    for name, g in frames.items():
        lines.append(f'  {name}: [')
        for row in g:
            lines.append("    '" + ''.join('.' if v < 0 else char[v] for v in row) + "',")
        lines.append('  ],')
    lines.append('};')
    return '\n'.join(lines) + '\n'


def sheet(frames, path, z=8, bg=(107, 59, 255)):
    tiles = []
    for g in frames.values():
        h, w = g.shape
        im = np.zeros((h, w, 3), np.uint8)
        im[:] = bg
        for v in np.unique(g):
            if v >= 0:
                im[g == v] = [int(ALL[list(ALL)[v]][i:i + 2], 16) for i in (1, 3, 5)]
        tiles.append(np.pad(np.kron(im, np.ones((z, z, 1), np.uint8)), ((0, 0), (0, 2 * z), (0, 0)), constant_values=0))
    Image.fromarray(np.concatenate(tiles, 1)).save(path)


if __name__ == '__main__':
    frames, mid, head = build()
    with open(OUT, 'w') as f:
        f.write(module(frames, mid))
    if '--png' in sys.argv:
        sheet(frames, sys.argv[sys.argv.index('--png') + 1])
    h, w = next(iter(frames.values())).shape
    print(f'{len(frames)} frames, {w} x {h} pixels, her middle column {mid}, head shifts {head}: {os.path.relpath(OUT)}')
