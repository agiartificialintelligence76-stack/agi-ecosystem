// Read and write VIGGCHAR v1 character files (the owner's Viggle splat models).
// Blocks are planar (component-major) and quantized per component between the
// header's min and max. Reading then writing an unchanged model reproduces its
// payload byte for byte (values are dequantized in double precision).
import fs from 'node:fs';

const SIZE = { u8: 1, u16: 2, f32: 4 };
const SOURCE_OF = { position: 'pos', scale: 'scale', rotation: 'rot', color: 'color', opacity: 'opacity', boneIndex: 'boneIndex', boneWeight: 'boneWeight' };

export function readVsplat(file) {
  const bytes = fs.readFileSync(file);
  if (bytes.toString('utf8', 0, 8) !== 'VIGGCHAR' || bytes.readUInt32LE(8) !== 1) throw new Error(`${file}: expected VIGGCHAR v1`);
  const headerLength = bytes.readUInt32LE(16);
  const header = JSON.parse(bytes.toString('utf8', 20, 20 + headerLength));
  const base = 20 + headerLength;
  const raw = (name) => {
    const b = header.blocks[name], size = SIZE[b.dtype];
    const out = b.dtype === 'f32' ? new Float32Array(b.count * b.components)
      : b.dtype === 'u16' ? new Uint16Array(b.count * b.components) : new Uint8Array(b.count * b.components);
    for (let c = 0; c < b.components; c++) for (let i = 0; i < b.count; i++) {
      const at = base + b.offset + (c * b.count + i) * size;
      out[i * b.components + c] = b.dtype === 'f32' ? bytes.readFloatLE(at) : b.dtype === 'u16' ? bytes.readUInt16LE(at) : bytes[at];
    }
    return out;
  };
  const dequantized = (name) => {
    const b = header.blocks[name], q = raw(name), out = new Float64Array(q.length), max = b.dtype === 'u16' ? 65535 : 255;
    for (let i = 0; i < b.count; i++) for (let c = 0; c < b.components; c++) {
      out[i * b.components + c] = b.min[c] + q[i * b.components + c] * (b.max[c] - b.min[c]) / max;
    }
    return out;
  };
  return {
    header, n: header.numSplats, palette: header.blocks.boneIndex.palette,
    pos: dequantized('position'), scale: dequantized('scale'), rot: raw('rotation'), color: raw('color'),
    opacity: dequantized('opacity'), boneIndex: raw('boneIndex'), boneWeight: raw('boneWeight'), joints: raw('joints'),
  };
}

// Writes `model` (readVsplat's shape, any splat count) with the template
// header's block order and quantization ranges, widened only if a value falls
// outside them.
export function writeVsplat(file, model) {
  const { header, n } = model, blocks = {}, parts = [];
  let offset = 0;
  for (const [name, template] of Object.entries(header.blocks)) {
    const b = { ...template, offset };
    let buffer;
    if (name === 'joints') {
      buffer = Buffer.alloc(template.count * template.components * 4);
      for (let c = 0; c < template.components; c++) for (let i = 0; i < template.count; i++) {
        buffer.writeFloatLE(model.joints[i * template.components + c], (c * template.count + i) * 4);
      }
    } else {
      const source = model[SOURCE_OF[name]], size = SIZE[template.dtype], comps = template.components;
      const max = template.dtype === 'u16' ? 65535 : 255;
      if (!source || source.length !== n * comps) throw new Error(`${name}: expected ${n * comps} values`);
      b.count = n;
      if (template.min) {
        b.min = [...template.min]; b.max = [...template.max];
        for (let c = 0; c < comps; c++) for (let i = 0; i < n; i++) {
          const v = source[i * comps + c], tolerance = 1e-9 * Math.max(1, Math.abs(v));
          if (v < b.min[c] - tolerance) b.min[c] = v;
          if (v > b.max[c] + tolerance) b.max[c] = v;
        }
      }
      buffer = Buffer.alloc(n * comps * size);
      for (let c = 0; c < comps; c++) for (let i = 0; i < n; i++) {
        let q = source[i * comps + c];
        if (b.min) q = (q - b.min[c]) / (b.max[c] - b.min[c]) * max;
        q = Math.max(0, Math.min(max, Math.round(q)));
        if (size === 2) buffer.writeUInt16LE(q, (c * n + i) * 2); else buffer[c * n + i] = q;
      }
    }
    b.length = buffer.length;
    parts.push(buffer); blocks[name] = b; offset += buffer.length;
    const padding = (4 - offset % 4) % 4;
    if (padding) { parts.push(Buffer.alloc(padding)); offset += padding; }
  }
  const json = JSON.stringify({ ...header, numSplats: n, blocks });
  const encoded = Buffer.from(json + ' '.repeat((4 - Buffer.byteLength(json) % 4) % 4));
  const head = Buffer.alloc(20);
  head.write('VIGGCHAR'); head.writeUInt32LE(1, 8);
  head.writeUInt32LE(20 + encoded.length + offset, 12); head.writeUInt32LE(encoded.length, 16);
  const result = Buffer.concat([head, encoded, ...parts]);
  fs.writeFileSync(file, result);
  return result.length;
}

// Copy splats `indices` (in that order) into a new model of the same header.
export function selectSplats(model, indices) {
  const take = (array, comps) => {
    const out = new array.constructor(indices.length * comps);
    indices.forEach((from, to) => { for (let c = 0; c < comps; c++) out[to * comps + c] = array[from * comps + c]; });
    return out;
  };
  return { ...model, n: indices.length, pos: take(model.pos, 3), scale: take(model.scale, 3), rot: take(model.rot, 3),
    color: take(model.color, 3), opacity: take(model.opacity, 1), boneIndex: take(model.boneIndex, 4), boneWeight: take(model.boneWeight, 3) };
}

export const sigmoid = (x) => 1 / (1 + Math.exp(-x));
export function hsv(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d > 1e-6) { h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
  return [h, max > 0 ? d / max : 0, max / 255];
}
