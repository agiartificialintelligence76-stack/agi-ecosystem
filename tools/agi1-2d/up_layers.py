# Upscale every cleaned layer 2x with the anime upscaler (Real-ESRGAN x4plus anime 6B, then halved): sharp lines for
# close-ups. Color and alpha are upscaled separately; colors under transparent pixels were already extended (bleed).
import sys, os, json, time, numpy as np
from PIL import Image
from upscale import up4
from util import bleed
os.makedirs('up', exist_ok=True)
names = sys.argv[1:] or ['face', 'frontHair', 'backHair', 'body', 'armL', 'armR',
    'eyeL_white', 'eyeL_iris', 'eyeL_lashU', 'eyeL_lashD', 'eyeR_white', 'eyeR_iris', 'eyeR_lashU', 'eyeR_lashD', 'browL', 'browR', 'mouth']
for n in names:
    t = time.time()
    a = np.array(Image.open(f'out/{n}.png').convert('RGBA')).astype(np.float32)
    rgb, al = a[..., :3], a[..., 3] / 255
    rgb = bleed(rgb, al)
    PAD = 8                                           # a margin so the network sees context at the borders
    rgbp = np.pad(rgb, ((PAD, PAD), (PAD, PAD), (0, 0)), mode='edge').round().clip(0, 255).astype(np.uint8)
    alp = np.pad(al, ((PAD, PAD), (PAD, PAD)), mode='constant')
    r4 = up4(rgbp)[PAD * 4:-PAD * 4, PAD * 4:-PAD * 4]
    a4 = up4(np.repeat((alp * 255).round().astype(np.uint8)[..., None], 3, -1))[PAD * 4:-PAD * 4, PAD * 4:-PAD * 4].mean(-1)
    H, W = al.shape
    r2 = np.array(Image.fromarray((r4 * 255).round().clip(0, 255).astype(np.uint8)).resize((W * 2, H * 2), Image.LANCZOS)).astype(np.float32)
    a2 = np.array(Image.fromarray((a4 * 255).round().clip(0, 255).astype(np.uint8)).resize((W * 2, H * 2), Image.LANCZOS)).astype(np.float32) / 255
    a2 = np.clip((a2 - 0.02) / 0.96, 0, 1)            # clean near-0 and near-1 values
    # keep the art's own colors: match each channel's average (where it's opaque) to the original's
    m1 = al > 0.9; m2 = a2 > 0.9
    if m1.sum() > 50 and m2.sum() > 50:
        shift = rgb[m1].mean(0) - r2[m2].mean(0)
        r2 = r2 + shift * 0.7
    r2 = bleed(r2, a2)
    Image.fromarray(np.dstack([r2, a2 * 255]).round().clip(0, 255).astype(np.uint8)).save(f'up/{n}.png')
    print(n, (W, H), '->', (W * 2, H * 2), round(time.time() - t, 1), 's', flush=True)
