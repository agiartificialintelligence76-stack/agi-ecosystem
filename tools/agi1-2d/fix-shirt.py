"""AGI-1 in 2D: paints over the patch of skin color left on her shirt's side under her right arm (2026-10-01).

Her Live2D model's texture was painted with her arms down, so the side of her shirt under her right arm (on the left of
the picture) kept a pink and orange smudge where the arm was. Nobody saw it until she waves (her arm goes up, see
src/stage/agi1-2d-arms.js), so this repaints it in her shirt's purple from the shirt around it: only the smudge (the
pixels that aren't shirt-purple, in that one area of the shirt and of the chest piece over it), never her outline.

Run it on both textures after exporting her model again from Cubism Editor (see "Updating her model" in CLAUDE.md):
  python3 tools/agi1-2d/fix-shirt.py public/models/agi1-live2d/AGI-1.4096.webp
  python3 tools/agi1-2d/fix-shirt.py public/models/agi1-live2d/AGI-1.2048.webp
Needs Python 3 with Pillow, NumPy and OpenCV (Claude's workspace has them). Run it once per export (each run saves the
texture again, which loses a tiny bit of quality).
"""
import sys
import numpy as np
import cv2
from PIL import Image

# the areas to look in, as fractions of the texture (her shirt's side under her right arm, and the chest piece's side)
AREAS = [
    (0.567, 0.070, 0.660, 0.170),   # the shirt piece, its side under her right arm
]
QUALITY = {4096: 90, 2048: 92}   # WebP quality per size (a little smaller than the export, the difference invisible)


def fix(path, out=None, quality=None):
    im = Image.open(path).convert('RGBA')
    a = np.array(im)
    h, w = a.shape[:2]
    changed = 0
    for fx0, fy0, fx1, fy1 in AREAS:
        x0, y0, x1, y1 = int(fx0 * w), int(fy0 * h), int(fx1 * w), int(fy1 * h)
        rgb = np.ascontiguousarray(a[y0:y1, x0:x1, :3])
        al = a[y0:y1, x0:x1, 3].astype(np.float32) / 255
        lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB).astype(np.float32)
        L, b = lab[..., 0] * 100 / 255, lab[..., 2] - 128
        # how much a pixel is smudge: her shirt's purple has b* about -32 (blue); skin and pink are much less blue. Her
        # dark lines (folds, outline) are never touched.
        weight = np.clip((b + 26) / 8, 0, 1) * np.clip((L - 50) / 8, 0, 1) * (al > 0.03)
        if weight.max() == 0:
            continue
        weight = cv2.GaussianBlur(weight.astype(np.float32), (0, 0), max(1.0, w / 2048))
        weight = np.clip(weight * 1.4, 0, 1)
        # paint it from the shirt around it: a soft average of the clean shirt-purple pixels nearby (never the see-through
        # pixels, her dark lines or other pieces next to it on the texture), so the side of her shirt is smooth
        known = ((al >= 0.8) & (b < -26) & (L > 60) & (weight < 0.02)).astype(np.float32)
        filled = None
        for sigma in (w / 20, w / 40, w / 80, w / 160):    # wide first, then finer where there's enough shirt nearby
            num = cv2.GaussianBlur(rgb.astype(np.float32) * known[..., None], (0, 0), sigma)
            den = cv2.GaussianBlur(known, (0, 0), sigma)[..., None]
            fill = num / np.maximum(den, 1e-6)
            filled = fill if filled is None else filled + (fill - filled) * np.clip(den / 0.35, 0, 1)
        out_rgb = rgb.astype(np.float32) * (1 - weight[..., None]) + filled.astype(np.float32) * weight[..., None]
        a[y0:y1, x0:x1, :3] = np.clip(out_rgb + 0.5, 0, 255).astype(np.uint8)
        changed += int((weight > 0.02).sum())
    q = quality or QUALITY.get(w, 90)
    Image.fromarray(a, 'RGBA').save(out or path, 'WEBP', quality=q, method=6, exact=True)
    return changed


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    for p in sys.argv[1:]:
        print(p, fix(p), 'pixels repainted')
