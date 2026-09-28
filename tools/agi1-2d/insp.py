# The owner's 2D art, as extracted by extract.py into the work folder (the current directory): each layer's picture
# (layers/<name>.webp) and where it sits on her 1024 × 1536 picture (meta.json), plus the cleaned copies (out/).
from PIL import Image
import numpy as np, json, os
WORK = os.getcwd()
META = json.load(open(os.path.join(WORK, 'meta.json')))
W, H = META['W'], META['H']
FEAT_ORDER = ['browL', 'browR', 'eyeL_white', 'eyeL_iris', 'eyeL_lashD', 'eyeL_lashU', 'eyeR_white', 'eyeR_iris', 'eyeR_lashD', 'eyeR_lashU', 'mouth']
def load(name):
    return Image.open(os.path.join(WORK, 'layers', name + '.webp')).convert('RGBA')
def box_of(name):
    return META['layers'][name] if name in META['layers'] else META['feat'][name]
def load_out(name):
    p = os.path.join(WORK, 'out', name + '.png')
    if os.path.exists(p):
        jp = os.path.join(WORK, 'out', name + '.json')
        return Image.open(p).convert('RGBA'), (json.load(open(jp)) if os.path.exists(jp) else box_of(name))
    return load(name), box_of(name)
def compose_out(skip=(), bg=(0, 0, 0, 0)):
    """Her whole picture from the cleaned layers (for checking by eye)."""
    c = Image.new('RGBA', (W, H), bg)
    for n in ['backHair', 'body', 'armL', 'armR', 'face', 'FEAT', 'frontHair']:
        if n in skip: continue
        if n == 'FEAT':
            for f in FEAT_ORDER:
                im, box = load_out(f)
                if f.endswith('_iris'):
                    wi, _ = load_out(f.replace('_iris', '_white'))
                    ia = np.array(im); ia[..., 3] = (ia[..., 3].astype(int) * np.array(wi)[..., 3] // 255).astype(np.uint8); im = Image.fromarray(ia)
                c.alpha_composite(im, (box['x'], box['y']))
            continue
        im, box = load_out(n)
        c.alpha_composite(im, (box['x'], box['y']))
    return c
