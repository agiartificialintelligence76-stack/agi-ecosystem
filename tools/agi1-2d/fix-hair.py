"""AGI-1 in 2D: finishes the hair behind her arms where her arms move away from it (2026-10-03).

Her Live2D model's texture was painted with her arms out (an A-pose), so the hair behind each arm was never meant to be
seen: below her elbows it stops in a straight cut (along her forearm's outline), and beside her shoulders it keeps the
pink shadow and the light edge line drawn along her sleeve. Since her arms move in code (src/stage/agi1-2d-arms.js:
relaxed by her sides, her wave, her cheer, her dance), those parts show. This finishes them, only there:
  1. below her elbows: the straight cut becomes soft, streaky hair tips (only the hair's opacity changes);
  2. beside her shoulders: the pink shadow band gets her hair's own color (its brush strokes kept) and the light line is
     painted over from the hair around it;
  3. anywhere her arms uncover: tiny white specks are painted over.
The areas are the ones her arms uncover in her poses (measured on her model, as fractions of the texture: AREAS).

Run it on both textures after exporting her model again from Cubism Editor (see "Updating her model" in CLAUDE.md), after
fix-shirt.py:
  python3 tools/agi1-2d/fix-hair.py public/models/agi1-live2d/AGI-1.4096.webp
  python3 tools/agi1-2d/fix-hair.py public/models/agi1-live2d/AGI-1.2048.webp
Needs Python 3 with Pillow, NumPy and OpenCV (Claude's workspace has them). Run it once per export (each run saves the
texture again, which loses a tiny bit of quality). If her model's arms or hair were redrawn, the areas must be measured
again: tell Claude.
"""
import sys
import numpy as np
import cv2
from PIL import Image

# (x, y) as fractions of the texture. fade: where her arm cut her back hair (below her elbows); wedge: beside her
# shoulders, what her sleeve hid; shown: everything her arms uncover. R: her right side (hair_back_R), L: her left.
AREAS = {
    'fade': [
        [[0.0977, 0.386], [0.0403, 0.386], [0.0293, 0.4104], [0.0115, 0.4321], [0.0063, 0.4441], [0.0415, 0.4868],
         [0.0481, 0.481], [0.0486, 0.4766], [0.0522, 0.4753], [0.0537, 0.4685], [0.0645, 0.4526]],
        [[0.3323, 0.386], [0.3545, 0.4258], [0.3733, 0.4666], [0.3784, 0.4722], [0.3789, 0.4768], [0.3826, 0.4783],
         [0.3889, 0.4875], [0.4199, 0.4565], [0.4221, 0.4368], [0.4062, 0.4187], [0.4045, 0.4023], [0.4009, 0.3992],
         [0.396, 0.3997], [0.3904, 0.386]],
    ],
    'wedge': [
        [[0.0735, 0.3562], [0.0601, 0.3491], [0.0562, 0.3491], [0.051, 0.3647], [0.0474, 0.3704], [0.0452, 0.3804],
         [0.0403, 0.3892], [0.0398, 0.3948], [0.0701, 0.3948]],
        [[0.0723, 0.2898], [0.0679, 0.2915], [0.0454, 0.3354], [0.0474, 0.3411], [0.0559, 0.3484], [0.0591, 0.3486],
         [0.0647, 0.3157]],
        [[0.3567, 0.3506], [0.3611, 0.3948], [0.3904, 0.3948], [0.3896, 0.3887], [0.3835, 0.376], [0.3835, 0.3711],
         [0.3804, 0.3677], [0.3745, 0.3513], [0.3704, 0.3513], [0.3599, 0.3574], [0.3589, 0.3506]],
        [[0.3596, 0.2878], [0.3655, 0.3069], [0.3723, 0.3459], [0.376, 0.3477], [0.3845, 0.3396], [0.3853, 0.3335],
         [0.3704, 0.3069], [0.3689, 0.2983], [0.3657, 0.2969], [0.3616, 0.2878]],
    ],
    'shown': [
        [[0.0867, 0.2551], [0.083, 0.2571], [0.0703, 0.2883], [0.0454, 0.3354], [0.0474, 0.3411], [0.0559, 0.3481],
         [0.0334, 0.4077], [0.0168, 0.4324], [0.0425, 0.4773], [0.0596, 0.4568], [0.1028, 0.3701], [0.1096, 0.3696],
         [0.1096, 0.3669], [0.103, 0.3662], [0.1003, 0.3625], [0.0906, 0.3655], [0.0701, 0.3928], [0.0735, 0.3562],
         [0.0591, 0.3474], [0.0647, 0.3157]],
        [[0.3635, 0.3447], [0.3657, 0.3542], [0.3599, 0.3574], [0.3589, 0.3506], [0.3567, 0.3506], [0.3608, 0.3967],
         [0.3394, 0.3669], [0.3289, 0.3643], [0.3245, 0.3679], [0.3196, 0.3655], [0.321, 0.3711], [0.3276, 0.3711],
         [0.3711, 0.4575], [0.3901, 0.4802], [0.4158, 0.4355], [0.4036, 0.4192], [0.4021, 0.4031], [0.3948, 0.4033],
         [0.3738, 0.3491], [0.3679, 0.3506]],
        [[0.3452, 0.2559], [0.3655, 0.3069], [0.3696, 0.3396], [0.3728, 0.3472], [0.376, 0.3477], [0.3845, 0.3396],
         [0.3853, 0.3335], [0.3477, 0.2561]],
    ],
}
FADE = 55            # how far a soft hair tip reaches into the hair, on the 4096 px texture (px); varies 0.3 to 1.7 times
QUALITY = {4096: 90, 2048: 92}   # WebP quality per size (as fix-shirt.py)


def area(name, w, h):
    m = np.zeros((h, w), np.uint8)
    for poly in AREAS[name]:
        cv2.fillPoly(m, [np.array([[x * w, y * h] for x, y in poly], np.int32)], 1)
    return m > 0


def fix(path, out=None, quality=None):
    im = Image.open(path).convert('RGBA')
    a = np.array(im)
    h, w = a.shape[:2]
    k = w / 4096
    rgb = np.ascontiguousarray(a[..., :3])
    al = a[..., 3].astype(np.float32) / 255
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB).astype(np.float32)
    L, A, B = lab[..., 0] * 100 / 255, lab[..., 1] - 128, lab[..., 2] - 128
    hue, chroma = np.degrees(np.arctan2(B, A)), np.hypot(A, B)
    out_rgb = rgb.astype(np.float32)
    counts = {}

    # 2. beside her shoulders. Her hair is a warm yellow (hue about 70°, chroma about 35, lightness about 80); the shadow
    # band is pinker (hue under 60°; beside her right shoulder its darkest part is almost as dark as an outline, and no
    # outline runs inside these areas) and the line whitish (chroma under 24, light).
    wedge = area('wedge', w, h)
    band = wedge & (hue < 60) & (L > 25) & (L < 76) & (al > 0.8)
    line = wedge & (chroma < 24) & (L > 70) & (al > 0.8)
    good = (cv2.dilate(wedge.astype(np.uint8), np.ones((int(61 * k) | 1,) * 2, np.uint8)) > 0) & ~band & ~line \
        & (hue >= 62) & (L > 60) & (L < 93) & (al > 0.95)
    if band.any():
        # the hair's own color from the hair around it (wide first, then finer where there's enough), plus the band's
        # own strokes (its detail above a light blur, at most ±12: her hair's strokes stay, the shadow's dark edge doesn't),
        # so it reads as hair, not a smear
        fill = None
        for sigma in (40 * k, 20 * k, 10 * k):
            num = cv2.GaussianBlur(out_rgb * good[..., None], (0, 0), sigma)
            den = cv2.GaussianBlur(good.astype(np.float32), (0, 0), sigma)[..., None]
            f = num / np.maximum(den, 1e-6)
            fill = f if fill is None else fill + (f - fill) * np.clip(den / 0.3, 0, 1)
        detail = np.clip(out_rgb - cv2.GaussianBlur(out_rgb, (0, 0), 2.5 * k), -12, 12)
        wgt = cv2.GaussianBlur(band.astype(np.float32), (0, 0), 2 * k)
        wgt = np.clip(wgt * 1.6, 0, 1)[..., None] * wedge[..., None]
        out_rgb = out_rgb * (1 - wgt) + (fill + 0.7 * detail) * wgt
        counts['shadow band'] = int(band.sum())
    if line.any():
        mask = cv2.dilate(line.astype(np.uint8), np.ones((3, 3), np.uint8)) & wedge.astype(np.uint8)
        out_rgb = cv2.inpaint(np.clip(out_rgb, 0, 255).astype(np.uint8), mask, max(3, int(8 * k)), cv2.INPAINT_TELEA).astype(np.float32)
        counts['light line'] = int(mask.sum())

    # 3. little white specks where her arms uncover her hair
    shown = area('shown', w, h)
    white = (shown & (L > 92) & (chroma < 12) & (al > 0.5)).astype(np.uint8)
    n, lbl, stats, _ = cv2.connectedComponentsWithStats(white, connectivity=8)
    speck = np.zeros_like(white)
    for j in range(1, n):
        if stats[j, cv2.CC_STAT_AREA] <= 600 * k * k:
            speck[lbl == j] = 1
    if speck.any():
        speck = cv2.dilate(speck, np.ones((5, 5), np.uint8))
        out_rgb = cv2.inpaint(np.clip(out_rgb, 0, 255).astype(np.uint8), speck, max(3, int(8 * k)), cv2.INPAINT_TELEA).astype(np.float32)
        counts['white specks'] = int(speck.sum())

    # 1. below her elbows: soft hair tips. How far each tip reaches varies from column to column (her hair falls down
    # the texture), like strands of different lengths; the same every run (a fixed seed).
    fade = area('fade', w, h)
    gone = (al < 0.04) & fade
    if gone.any():
        dist = cv2.distanceTransform((~gone).astype(np.uint8), cv2.DIST_L2, 5)
        noise = np.random.default_rng(7).random(4096).astype(np.float32)
        noise = cv2.resize(noise.reshape(1, -1), (w, 1), interpolation=cv2.INTER_LINEAR).ravel()
        noise = cv2.GaussianBlur(noise.reshape(1, -1), (0, 0), 2.5 * k).ravel()
        noise = (noise - noise.min()) / (noise.max() - noise.min() + 1e-6)
        reach = FADE * k * (0.3 + 1.4 * noise)[None, :]
        t = np.clip(dist / reach, 0, 1)
        f = np.where(fade, t * t * (3 - 2 * t), 1.0)
        new_al = al * f
        counts['soft tips'] = int((np.abs(new_al - al) > 1 / 255).sum())
        al = new_al

    a[..., :3] = np.clip(out_rgb + 0.5, 0, 255).astype(np.uint8)
    a[..., 3] = np.clip(al * 255 + 0.5, 0, 255).astype(np.uint8)
    q = quality or QUALITY.get(w, 90)
    Image.fromarray(a, 'RGBA').save(out or path, 'WEBP', quality=q, method=6, exact=True)
    return counts


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    for p in sys.argv[1:]:
        print(p, fix(p))
