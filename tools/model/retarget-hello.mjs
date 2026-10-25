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

export function retargetMotion(inputBytes, library = loadSkeletonLibrary(), { name = 'Wave Hello', fullBody = false } = {}) {
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
  const motionAlignment = ALIGN.clone();
  if (fullBody) {
    // Presets can face another direction (Nod Yes faces ~114° to the right).
    // Remove only that initial heading, preserving the actual nod and posture.
    const firstLocal = source.nodes.map(n => new Quaternion(...(n.rotation || [0, 0, 0, 1])));
    channels.forEach(channel => firstLocal[channel.node].fromArray(channel.values, 0).normalize());
    const first = worldPose(source.nodes, sourceParents, firstLocal);
    const forward = SOURCE_FORWARD.clone().applyQuaternion(first.quaternions[sourceIndex.Hips]);
    const yaw = Math.atan2(forward.x, forward.z);
    motionAlignment.multiply(new Quaternion().setFromAxisAngle(UP, -yaw));
  }
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
  if (fullBody) mapping.set(targetIndex.pelvis, { source: sourceIndex.Hips, calibration: targetRest.quaternions[targetIndex.pelvis].clone() });
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
    if (fullBody) {
      addSegment(`thigh_${side}`, `${prefix}UpLeg`, `calf_${side}`, `${prefix}Leg`);
      addSegment(`calf_${side}`, `${prefix}Leg`, `foot_${side}`, `${prefix}Foot`);
      addSegment(`foot_${side}`, `${prefix}Foot`, `ball_${side}`, `${prefix}ToeBase`, UP, UP);
      // Keep the character's own toe spread while transferring the toe hinge.
      mapping.set(targetIndex[`ball_${side}`], { source: sourceIndex[`${prefix}ToeBase`], calibration: targetRest.quaternions[targetIndex[`ball_${side}`]].clone() });
    }
  }

  const rotations = nodes.map(() => []);
  const pelvisPositions = [];
  const footIndices = ['foot_l', 'foot_r', 'ball_l', 'ball_r', 'bigtoe_02_l', 'bigtoe_02_r'].map(n => targetIndex[n]);
  const groundHeight = Math.min(...footIndices.map(i => targetRest.positions[i].y));
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
    const targetWorld = [], targetLocal = [];
    for (let i = 0; i < nodes.length; i++) {
      const parent = parents[i], mapped = mapping.get(i);
      const parentWorld = parent < 0 ? IDENTITY : targetWorld[parent];
      let local = new Quaternion(...nodes[i].rotation).normalize();
      if (mapped) {
        const desired = motionAlignment.clone().multiply(animated.quaternions[mapped.source])
          .multiply(sourceRest.quaternions[mapped.source].clone().invert())
          .multiply(ALIGN.clone().invert()).multiply(mapped.calibration).normalize();
        local = parentWorld.clone().invert().multiply(desired).normalize();
      }
      targetWorld[i] = parentWorld.clone().multiply(local).normalize();
      targetLocal[i] = local;
      const previous = rotations[i];
      if (previous.length && local.dot(new Quaternion().fromArray(previous, previous.length - 4)) < 0) local.set(-local.x, -local.y, -local.z, -local.w);
      rotations[i].push(...local.toArray());
    }
    if (fullBody) {
      // Match the target's own sole height after retargeting different leg
      // proportions. Correct vertical placement only: no accumulated root
      // displacement, no changing character scale, and no sliding whole body.
      const posed = worldPose(nodes, parents, targetLocal);
      const floorOffset = groundHeight - Math.min(...footIndices.map(i => posed.positions[i].y));
      const pelvis = nodes[targetIndex.pelvis].translation;
      pelvisPositions.push(pelvis[0], pelvis[1] + floorOffset, pelvis[2]);
    }
  }

  const parts = [], bufferViews = [], accessors = [];
  let byteOffset = 0;
  const addAccessor = (values, type, extra = {}) => {
    const bytes = Buffer.alloc(values.length * 4);
    values.forEach((v, i) => bytes.writeFloatLE(v, i * 4));
    const view = bufferViews.push({ buffer: 0, byteOffset, byteLength: bytes.length }) - 1;
    parts.push(bytes); byteOffset += bytes.length;
    return accessors.push({ bufferView: view, componentType: 5126, count: values.length / ({ SCALAR: 1, VEC3: 3, VEC4: 4 }[type]), type, ...extra }) - 1;
  };
  const timeAccessor = addAccessor(times, 'SCALAR', { min: [0], max: [times.at(-1)] });
  const samplers = [], outputChannels = [];
  rotations.forEach((values, i) => {
    const output = addAccessor(values, 'VEC4');
    outputChannels.push({ sampler: samplers.length, target: { node: i, path: 'rotation' } });
    samplers.push({ input: timeAccessor, output, interpolation: 'LINEAR' });
  });
  if (fullBody) {
    const output = addAccessor(pelvisPositions, 'VEC3');
    outputChannels.push({ sampler: samplers.length, target: { node: targetIndex.pelvis, path: 'translation' } });
    samplers.push({ input: timeAccessor, output, interpolation: 'LINEAR' });
  }
  const json = { asset: { version: '2.0', generator: 'AGI-1 Mixamo-to-MetaHuman greeting retargeter' },
    scene: 0, scenes: [{ nodes: parents.flatMap((p, i) => p < 0 ? [i] : []) }], nodes,
    animations: [{ name, samplers, channels: outputChannels }],
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

export function retargetHello(inputBytes, library = loadSkeletonLibrary()) {
  return retargetMotion(inputBytes, library);
}

// Offline pose inspection helper. The website uses its relaxed procedural idle;
// the nod's first frame leans forward in preparation for the gesture.
export function standingPoseFromGlb(inputBytes) {
  const { json, accessor } = readGlb(inputBytes);
  const bones = {};
  for (const channel of json.animations[0].channels) {
    const node = json.nodes[channel.target.node];
    if (/^FACIAL_/i.test(node.name)) continue;
    const values = accessor(json.animations[0].samplers[channel.sampler].output);
    bones[node.name] ??= {};
    if (channel.target.path === 'rotation') bones[node.name].rotation = values.slice(0, 4);
    if (channel.target.path === 'translation') bones[node.name].translation = values.slice(0, 3);
  }
  return { source: 'Nod-Yes.glb, first frame; retargeted and grounded', bones };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const source = new URL('../../new agi 3d model/Wave-Hello.glb', import.meta.url);
  const destination = new URL('../../public/models/agi1-wave-hello.glb', import.meta.url);
  const output = retargetHello(await fs.readFile(source));
  const parsed = Animation.fromGlb(output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength));
  await fs.writeFile(destination, output);
  console.log(JSON.stringify({ output: fileURLToPath(destination), bytes: output.length, frames: parsed.numFrames, bones: parsed.numBones }));
}
