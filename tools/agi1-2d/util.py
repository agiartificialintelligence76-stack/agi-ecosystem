import numpy as np
from scipy import ndimage as ndi
from scipy.sparse import lil_matrix, csr_matrix
from scipy.sparse.linalg import spsolve
def membrane_fill(img, mask):
    """Fill mask pixels of img (H,W,C float) with the smooth (harmonic) interpolation of the surrounding pixels."""
    H, W, C = img.shape
    ys, xs = np.nonzero(mask)
    n = len(ys)
    if n == 0: return img
    idx = -np.ones((H, W), int); idx[ys, xs] = np.arange(n)
    A = lil_matrix((n, n)); B = np.zeros((n, C))
    for k in range(n):
        y, x = ys[k], xs[k]; cnt = 0
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            yy, xx = y + dy, x + dx
            if not (0 <= yy < H and 0 <= xx < W): continue
            cnt += 1
            j = idx[yy, xx]
            if j >= 0: A[k, j] = -1
            else: B[k] += img[yy, xx]
        A[k, k] = cnt
    sol = spsolve(csr_matrix(A), B)
    out = img.copy(); out[ys, xs] = sol.reshape(n, C) if C > 1 else sol[:, None]
    return out
def ellipse_mask(H, W, cx, cy, rx, ry):
    yy, xx = np.mgrid[0:H, 0:W]
    return ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1
def aa_alpha_from_mask(mask, sigma=0.8, up=4):
    """A smooth, antialiased alpha from a hard mask: upsample, blur, threshold, box-downsample."""
    from PIL import Image
    H, W = mask.shape
    m = Image.fromarray((mask * 255).astype(np.uint8)).resize((W * up, H * up), Image.BICUBIC)
    m = np.asarray(m).astype(float) / 255
    m = ndi.gaussian_filter(m, sigma * up)
    m = np.clip((m - 0.5) * 3 + 0.5, 0, 1)           # sharpen back to a crisp (but smooth) edge
    m = m.reshape(H, up, W, up).mean((1, 3))
    return m
def bleed(rgb, alpha, iters=12):
    """Extend colors into transparent pixels so linear filtering never pulls in dark or wrong edge colors."""
    rgb = rgb.copy(); known = alpha > 0.003
    if known.all(): return rgb
    idx = ndi.distance_transform_edt(~known, return_distances=False, return_indices=True)
    return rgb[idx[0], idx[1]]
def lum(rgb): return rgb @ np.array([0.299, 0.587, 0.114])
def drop_islands(alpha, min_px=40, thresh=0.1):
    """Remove small detached bits (matting leftovers) from an alpha channel."""
    lab, n = ndi.label(alpha > thresh)
    if n == 0: return alpha
    sizes = ndi.sum(np.ones_like(alpha), lab, range(1, n + 1))
    small = np.isin(lab, 1 + np.nonzero(sizes < min_px)[0])
    out = alpha.copy(); out[small] = 0
    return out
