// Convert the owner's Mixamo greeting to the new character's MetaHuman rig.
// Run from any directory: node tools/model/retarget-hello.mjs
// The source is a T-pose rig; the target binds in an A-pose facing +X.
// Align anatomical segment frames before transferring the source world-space
// motion. Simply copying local quaternions would twist the elbows and wrists.
import fs from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { Animation, loadSkeletonLibrary } from '@viggle/splat-engine';

const UP = new Vector3(0, 1, 0);
const SOURCE_FORWARD = new Vector3(0, 0, 1);
const TARGET_FORWARD = new Vector3(1, 0, 0);
const ALIGN = new Quaternion().setFromAxisAngle(UP, Math.PI / 2);
const IDENTITY = new Quaternion();
const UNIT = new Vector3(1, 1, 1);

function readGlb(bytes) {
  const b = Buffer.from(bytes);
  if (b.readUInt32LE(0) !== 0x46546c67 || b.readUInt32LE(4) !== 2) throw new Error('Expected GLB 2.0');
  const jsonEnd = 20 + b.readUInt32LE(12);
  const json = JSON.parse(b.toString('utf8', 20, jsonEnd));
  const binStart = jsonEnd + 8;
  const accessor = (index) => {
    const a = json.accessors[index], v = json.bufferViews[a.bufferView];
    if (a.componentType !== 5126 || v.byteStride) throw new Error('Expected packed FLOAT source accessor');
    const count = a.count * ({ SCALAR: 1, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type]);
    const start = binStart + (v.byteOffset || 0) + (a.byteOffset || 0);
    return Array.from({ length: count }, (_, i) => b.readFloatLE(start + i * 4));
  };
  return { json, accessor };
}

function worldPose(nodes, parents, rotations = nodes.map(n => new Quaternion(...(n.rotation || [0, 0, 0, 1])))) {
  const matrices = [], quaternions = [], positions = [];
  const visit = (i) => {
    if (matrices[i]) return;
    const parent = parents[i];
    if (parent >= 0) visit(parent);
    const local = new Matrix4().compose(new Vector3(...(nodes[i].translation || [0, 0, 0])), rotations[i], UNIT);
    matrices[i] = parent < 0 ? local : matrices[parent].clone().multiply(local);
    quaternions[i] = parent < 0 ? rotations[i].clone() : quaternions[parent].clone().multiply(rotations[i]);
    positions[i] = new Vector3().setFromMatrixPosition(matrices[i]);
  };
  nodes.forEach((_, i) => visit(i));
  return { matrices, quaternions, positions };
}

function segmentFrame(direction, secondary) {
  const y = direction.clone().normalize();
  const z = secondary.clone().addScaledVector(y, -secondary.dot(y)).normalize();
  if (z.lengthSq() < 0.5) throw new Error('Degenerate retarget segment frame');
  const x = new Vector3().crossVectors(y, z).normalize();
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));
}

export function retargetHello(inputBytes, library = loadSkeletonLibrary()) {
  const { json: source, accessor } = readGlb(inputBytes);
  const sourceParents = source.nodes.map(() => -1);
  source.nodes.forEach((n, i) => n.children?.forEach(child => { sourceParents[child] = i; }));
  const sourceIndex = Object.fromEntries(source.nodes.map((n, i) => [n.name?.replace(/^mixamorig:/, ''), i]));
  const sourceRest = worldPose(source.nodes, sourceParents);
  const clip = source.animations[0];
  const channels = clip.channels.filter(c => c.target.path === 'rotation').map(c => {
    const sampler = clip.samplers[c.sampler];
    if (sampler.interpolation && sampler.interpolation !== 'LINEAR') throw new Error('Expected linear source rotations');
    return { node: c.target.node, times: accessor(sampler.input), values: accessor(sampler.output) };
  });
  const duration = Math.max(...channels.map(c => c.times.at(-1)));
  const frameCount = Math.round(duration * 30) + 1;
  const times = Array.from({ length: frameCount }, (_, i) => i / 30);
  const names = library.boneNames441, parents = Array.from(library.parents441);
  const nodes = names.map((name, i) => ({ name,
    translation: Array.from(library.restTranslations441.subarray(i * 3, i * 3 + 3)),
    rotation: Array.from(library.restRotations441.subarray(i * 4, i * 4 + 4)),
    children: [] }));
  parents.forEach((p, i) => { if (p >= 0) nodes[p].children.push(i); });
  nodes.forEach(n => { if (!n.children.length) delete n.children; });
  const targetIndex = Object.fromEntries(names.map((name, i) => [name, i]));
  const targetRest = worldPose(nodes, parents);
  const mapping = new Map();

  // The lower body remains planted: a greeting should not inherit the dummy's
  // hip position/leg proportions and drift off the website's floor. Spine world
  // rotations still include the original torso sway and head movement.
  for (const [target, sourceName] of [['spine_01', 'Spine'], ['spine_03', 'Spine1'], ['spine_05', 'Spine2'],
    ['neck_01', 'Neck'], ['head', 'Head']]) {
    mapping.set(targetIndex[target], { source: sourceIndex[sourceName], calibration: targetRest.quaternions[targetIndex[target]].clone() });
  }
  const addSegment = (target, sourceName, targetChild, sourceChild, targetSecondary = TARGET_FORWARD, sourceSecondary = SOURCE_FORWARD) => {
    const ti = targetIndex[target], si = sourceIndex[sourceName];
    // Distal finger joints have no target end marker; continue the last phalanx.
    const td = targetChild
      ? targetRest.positions[targetIndex[targetChild]].clone().sub(targetRest.positions[ti])
      : targetRest.positions[ti].clone().sub(targetRest.positions[parents[ti]]);
    const sd = sourceRest.positions[sourceIndex[sourceChild]].clone().sub(sourceRest.positions[si]);
    const targetFrame = segmentFrame(td, targetSecondary);
    const sourceFrame = segmentFrame(sd, sourceSecondary);
    const calibration = ALIGN.clone().multiply(sourceFrame).multiply(targetFrame.invert()).multiply(targetRest.quaternions[ti]);
    mapping.set(ti, { source: si, calibration });
  };
  for (const [side, prefix] of [['l', 'Left'], ['r', 'Right']]) {
    addSegment(`clavicle_${side}`, `${prefix}Shoulder`, `upperarm_${side}`, `${prefix}Arm`);
    addSegment(`upperarm_${side}`, `${prefix}Arm`, `lowerarm_${side}`, `${prefix}ForeArm`);
    addSegment(`lowerarm_${side}`, `${prefix}ForeArm`, `hand_${side}`, `${prefix}Hand`);
    const targetAcross = targetRest.positions[targetIndex[`index_01_${side}`]].clone().sub(targetRest.positions[targetIndex[`pinky_01_${side}`]]);
    const sourceAcross = sourceRest.positions[sourceIndex[`${prefix}HandIndex1`]].clone().sub(sourceRest.positions[sourceIndex[`${prefix}HandPinky1`]]);
    addSegment(`hand_${side}`, `${prefix}Hand`, `middle_01_${side}`, `${prefix}HandMiddle1`, targetAcross, sourceAcross);
    // Preserve this character's own softly bent, open fingers. The supplied
    // dummy has much longer fingers and a very wide animated spread; applying
    // those digit frames to the splat's hand makes its thin fingertips spike.
    // Its authored palm/wrist/arm wave still transfers in full above.
  }

  const rotations = nodes.map(() => []);
  for (const time of times) {
    const sourceLocal = source.nodes.map(n => new Quaternion(...(n.rotation || [0, 0, 0, 1])));
    for (const channel of channels) {
      let low = 0;
      while (low + 1 < channel.times.length && channel.times[low + 1] < time) low++;
      const high = Math.min(low + 1, channel.times.length - 1);
      const span = channel.times[high] - channel.times[low];
      const amount = span > 0 ? Math.max(0, Math.min(1, (time - channel.times[low]) / span)) : 0;
      sourceLocal[channel.node].fromArray(channel.values, low * 4).slerp(new Quaternion().fromArray(channel.values, high * 4), amount).normalize();
    }
    const animated = worldPose(source.nodes, sourceParents, sourceLocal);
    const targetWorld = [];
    for (let i = 0; i < nodes.length; i++) {
      const parent = parents[i], mapped = mapping.get(i);
      const parentWorld = parent < 0 ? IDENTITY : targetWorld[parent];
      let local = new Quaternion(...nodes[i].rotation).normalize();
      if (mapped) {
        const desired = ALIGN.clone().multiply(animated.quaternions[mapped.source])
          .multiply(sourceRest.quaternions[mapped.source].clone().invert())
          .multiply(ALIGN.clone().invert()).multiply(mapped.calibration).normalize();
        local = parentWorld.clone().invert().multiply(desired).normalize();
      }
      targetWorld[i] = parentWorld.clone().multiply(local).normalize();
      const previous = rotations[i];
      if (previous.length && local.dot(new Quaternion().fromArray(previous, previous.length - 4)) < 0) local.set(-local.x, -local.y, -local.z, -local.w);
      rotations[i].push(...local.toArray());
    }
  }

  const parts = [], bufferViews = [], accessors = [];
  let byteOffset = 0;
  const addAccessor = (values, type, extra = {}) => {
    const bytes = Buffer.alloc(values.length * 4);
    values.forEach((v, i) => bytes.writeFloatLE(v, i * 4));
    const view = bufferViews.push({ buffer: 0, byteOffset, byteLength: bytes.length }) - 1;
    parts.push(bytes); byteOffset += bytes.length;
    return accessors.push({ bufferView: view, componentType: 5126, count: values.length / ({ SCALAR: 1, VEC4: 4 }[type]), type, ...extra }) - 1;
  };
  const timeAccessor = addAccessor(times, 'SCALAR', { min: [0], max: [times.at(-1)] });
  const samplers = [], outputChannels = [];
  rotations.forEach((values, i) => {
    const output = addAccessor(values, 'VEC4');
    outputChannels.push({ sampler: samplers.length, target: { node: i, path: 'rotation' } });
    samplers.push({ input: timeAccessor, output, interpolation: 'LINEAR' });
  });
  const json = { asset: { version: '2.0', generator: 'AGI-1 Mixamo-to-MetaHuman greeting retargeter' },
    scene: 0, scenes: [{ nodes: parents.flatMap((p, i) => p < 0 ? [i] : []) }], nodes,
    animations: [{ name: 'Wave Hello', samplers, channels: outputChannels }],
    buffers: [{ byteLength: byteOffset }], bufferViews, accessors };
  const rawJson = Buffer.from(JSON.stringify(json));
  const jsonBytes = Buffer.alloc(Math.ceil(rawJson.length / 4) * 4, 0x20); rawJson.copy(jsonBytes);
  const binary = Buffer.concat(parts);
  const output = Buffer.alloc(12 + 8 + jsonBytes.length + 8 + binary.length);
  output.writeUInt32LE(0x46546c67, 0); output.writeUInt32LE(2, 4); output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(jsonBytes.length, 12); output.writeUInt32LE(0x4e4f534a, 16); jsonBytes.copy(output, 20);
  const binHeader = 20 + jsonBytes.length;
  output.writeUInt32LE(binary.length, binHeader); output.writeUInt32LE(0x004e4942, binHeader + 4); binary.copy(output, binHeader + 8);
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const source = new URL('../../new agi 3d model/Wave-Hello.glb', import.meta.url);
  const destination = new URL('../../public/models/agi1-wave-hello.glb', import.meta.url);
  const output = retargetHello(await fs.readFile(source));
  const parsed = Animation.fromGlb(output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength));
  await fs.writeFile(destination, output);
  console.log(JSON.stringify({ output: fileURLToPath(destination), bytes: output.length, frames: parsed.numFrames, bones: parsed.numBones }));
}
