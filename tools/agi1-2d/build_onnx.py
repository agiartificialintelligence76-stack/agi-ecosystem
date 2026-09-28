# Real-ESRGAN x4plus anime 6B (BSD-3): read the PyTorch weights without PyTorch and write the same network as ONNX.
import zipfile, pickle, numpy as np, collections, onnx
from onnx import helper, TensorProto, numpy_helper
Z = zipfile.ZipFile('anime6b.pth')
prefix = Z.namelist()[0].split('/')[0]
class Storage:
    def __init__(self, dtype): self.dtype = dtype
def _rebuild_tensor_v2(storage, offset, size, stride, requires_grad=False, backward_hooks=None, metadata=None):
    arr = storage
    n = int(np.prod(size)) if len(size) else 1
    out = np.lib.stride_tricks.as_strided(arr[offset:], shape=tuple(size), strides=tuple(s * arr.itemsize for s in stride)) if len(size) else arr[offset:offset + 1].reshape(())
    return np.array(out)
DT = {'FloatStorage': np.float32, 'HalfStorage': np.float16, 'DoubleStorage': np.float64, 'LongStorage': np.int64, 'IntStorage': np.int32}
class U(pickle.Unpickler):
    def find_class(self, mod, name):
        if name == '_rebuild_tensor_v2': return _rebuild_tensor_v2
        if mod == 'torch' and name in DT: return name
        if name == 'OrderedDict': return collections.OrderedDict
        if mod == 'torch._utils' and name == '_rebuild_parameter': return lambda data, rg, hooks: data
        return super().find_class(mod, name)
    def persistent_load(self, pid):
        typ, stype, key, loc, numel = pid
        dt = DT[stype] if isinstance(stype, str) else np.float32
        return np.frombuffer(Z.read(f'{prefix}/data/{key}'), dtype=dt)
sd = U(Z.open(f'{prefix}/data.pkl')).load()
if 'params_ema' in sd: sd = sd['params_ema']
elif 'params' in sd: sd = sd['params']
print('tensors', len(sd), 'first', list(sd)[:3], sd['conv_first.weight'].shape)
nodes, inits = [], []
def W(name):
    inits.append(numpy_helper.from_array(sd[name].astype(np.float32), name)); return name
cnt = [0]
def uid(p): cnt[0] += 1; return f'{p}_{cnt[0]}'
def conv(x, name):
    y = uid('c'); nodes.append(helper.make_node('Conv', [x, W(name + '.weight'), W(name + '.bias')], [y], pads=[1, 1, 1, 1], kernel_shape=[3, 3])); return y
def lrelu(x):
    y = uid('l'); nodes.append(helper.make_node('LeakyRelu', [x], [y], alpha=0.2)); return y
def cat(xs):
    y = uid('cat'); nodes.append(helper.make_node('Concat', xs, [y], axis=1)); return y
def scale_add(x, s, r):
    cs = uid('k'); inits.append(numpy_helper.from_array(np.array(s, np.float32), cs))
    m = uid('m'); nodes.append(helper.make_node('Mul', [x, cs], [m]))
    y = uid('a'); nodes.append(helper.make_node('Add', [m, r], [y])); return y
def add(a, b):
    y = uid('a'); nodes.append(helper.make_node('Add', [a, b], [y])); return y
def up2(x):
    sc = uid('s'); inits.append(numpy_helper.from_array(np.array([1, 1, 2, 2], np.float32), sc))
    y = uid('u'); nodes.append(helper.make_node('Resize', [x, '', sc], [y], mode='nearest')); return y
def rdb(x, p):
    x1 = lrelu(conv(x, p + '.conv1'))
    x2 = lrelu(conv(cat([x, x1]), p + '.conv2'))
    x3 = lrelu(conv(cat([x, x1, x2]), p + '.conv3'))
    x4 = lrelu(conv(cat([x, x1, x2, x3]), p + '.conv4'))
    x5 = conv(cat([x, x1, x2, x3, x4]), p + '.conv5')
    return scale_add(x5, 0.2, x)
nb = len({k.split('.')[1] for k in sd if k.startswith('body.')})
print('blocks', nb)
feat = conv('input', 'conv_first')
b = feat
for i in range(nb):
    o = rdb(b, f'body.{i}.rdb1'); o = rdb(o, f'body.{i}.rdb2'); o = rdb(o, f'body.{i}.rdb3')
    b = scale_add(o, 0.2, b)
feat = add(feat, conv(b, 'conv_body'))
feat = lrelu(conv(up2(feat), 'conv_up1'))
feat = lrelu(conv(up2(feat), 'conv_up2'))
out = conv(lrelu(conv(feat, 'conv_hr')), 'conv_last')
nodes.append(helper.make_node('Identity', [out], ['output']))
g = helper.make_graph(nodes, 'rrdb', [helper.make_tensor_value_info('input', TensorProto.FLOAT, [1, 3, None, None])],
                      [helper.make_tensor_value_info('output', TensorProto.FLOAT, [1, 3, None, None])], inits)
m = helper.make_model(g, opset_imports=[helper.make_opsetid('', 13)])
m.ir_version = 8
onnx.checker.check_model(m)
onnx.save(m, 'anime6b.onnx')
print('saved')
