# Upscale an RGB image 4x with the anime model (in overlapping tiles), then optionally down to 2x.
import onnxruntime as ort, numpy as np, time, sys, os
from PIL import Image
_sess = None
def sess():
    global _sess
    if _sess is None:
        o = ort.SessionOptions(); o.intra_op_num_threads = 2; o.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        _sess = ort.InferenceSession(os.path.join(os.getcwd(), 'anime6b.onnx'), o, providers=['CPUExecutionProvider'])
    return _sess
def up4(rgb, tile=96, pad=10):
    """rgb: HxWx3 uint8 -> 4H x 4W x 3 float (0..1)"""
    H, W, _ = rgb.shape
    x = rgb.astype(np.float32) / 255.0
    out = np.zeros((H * 4, W * 4, 3), np.float32)
    s = sess()
    for y0 in range(0, H, tile):
        for x0 in range(0, W, tile):
            y1, x1 = min(H, y0 + tile), min(W, x0 + tile)
            ya, xa = max(0, y0 - pad), max(0, x0 - pad)
            yb, xb = min(H, y1 + pad), min(W, x1 + pad)
            inp = x[ya:yb, xa:xb].transpose(2, 0, 1)[None]
            res = s.run(None, {'input': inp})[0][0].transpose(1, 2, 0)
            out[y0 * 4:y1 * 4, x0 * 4:x1 * 4] = res[(y0 - ya) * 4:(y0 - ya) * 4 + (y1 - y0) * 4, (x0 - xa) * 4:(x0 - xa) * 4 + (x1 - x0) * 4]
    return np.clip(out, 0, 1)
if __name__ == '__main__':
    im = np.array(Image.open(sys.argv[1]).convert('RGB'))
    t = time.time(); r = up4(im); print('time', round(time.time() - t, 1), 's for', im.shape)
    Image.fromarray((r * 255).round().astype(np.uint8)).save(sys.argv[2])
