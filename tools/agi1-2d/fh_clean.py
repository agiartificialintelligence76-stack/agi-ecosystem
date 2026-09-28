# The front hair: fully opaque where it's meant to be (the file stored 254), and no white matting fringe on its edges.
import insp, numpy as np, json
from PIL import Image
from scipy import ndimage as ndi
from util import bleed, lum, drop_islands
for name in ('frontHair',):
    im = np.array(insp.load(name)).astype(float); rgb, al = im[..., :3], im[..., 3] / 255
    al = np.where(al > 0.97, 1.0, al)
    al = drop_islands(al, 40)
    # edge pixels much whiter than the hair next to them
    inner = al > 0.95
    idx = ndi.distance_transform_edt(~inner, return_distances=False, return_indices=True)
    near = rgb[idx[0], idx[1]]
    whitish = (al < 0.95) & (al > 0) & (rgb.min(-1) > near.min(-1) + 25)
    rgb[whitish] = near[whitish]
    print(name, 'fringe px fixed', int(whitish.sum()))
    rgb = bleed(rgb, al)
    Image.fromarray(np.dstack([rgb, al * 255]).round().clip(0, 255).astype(np.uint8)).save(f'out/{name}.png')
    json.dump(insp.box_of(name), open(f'out/{name}.json', 'w'))
