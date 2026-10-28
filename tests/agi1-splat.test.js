import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { Animation, Armature, loadSkeletonLibrary, Pose } from '@viggle/splat-engine';
import { Entity, Mat4, Vec3 } from 'playcanvas';
import { Group } from 'three';
import { AGI1_SPLAT_ASSETS, AGI1_PROPORTIONS, applyAgi1Proportions, standOnFloor, createSplatPlayback, createController } from '../src/stage/agi1-splat.js';
import { readVsplat, sigmoid, hsv } from '../tools/model/vsplat-io.mjs';
import { createSplatMotion } from '../src/stage/agi1-splat-motion.js';
import { createAgi1SplatFace, createFaceSignals } from '../src/stage/agi1-splat-face.js';
import { setMeter, stopTalk, pretendTalk, talkLevel } from '../src/lib/talk.js';

const modelUrl = new URL(`../public${AGI1_SPLAT_ASSETS.character}`, import.meta.url);
const motionUrl = new URL(`../public${AGI1_SPLAT_ASSETS.hello}`, import.meta.url);
const nodUrl = new URL(`../public${AGI1_SPLAT_ASSETS.nod}`, import.meta.url);
const library = await loadSkeletonLibrary();

test('the shipped AGI-1 splat contains a complete, compatible skinned character', () => {
  const bytes = readFileSync(modelUrl);
  assert.equal(bytes.subarray(0, 8).toString(), 'VIGGCHAR');
  assert.equal(bytes.readUInt32LE(8), 1);
  assert.equal(bytes.readUInt32LE(12), bytes.length, 'the complete payload ships');
  const headerLength = bytes.readUInt32LE(16);
  const header = JSON.parse(bytes.subarray(20, 20 + headerLength));
  const payload = 20 + headerLength;
  const { blocks, numSplats } = header;
  assert.ok(Number.isInteger(numSplats) && numSplats >= 48000, 'the full character remains, with room for refined shirt detail');
  assert.equal(blocks.joints.count, library.boneNames441.length);
  for (const name of ['position', 'scale', 'rotation', 'color', 'opacity', 'boneIndex', 'boneWeight', 'joints']) {
    const block = blocks[name];
    assert.ok(block, `${name} is present`);
    assert.ok(block.offset >= 0 && block.length > 0 && payload + block.offset + block.length <= bytes.length, `${name} stays inside the file`);
    assert.equal(block.count, name === 'joints' ? library.boneNames441.length : numSplats);
    assert.equal(block.length, block.count * block.components * ({ u8: 1, u16: 2, f32: 4 }[block.dtype]), `${name} contains a value for every point`);
  }
  const rigSize = blocks.joints.count;
  for (const index of blocks.boneIndex.palette) assert.ok(Number.isInteger(index) && index >= 0 && index < rigSize);
  const indexOffset = payload + blocks.boneIndex.offset;
  for (let i = 0; i < blocks.boneIndex.length; i += 2) {
    assert.ok(bytes.readUInt16LE(indexOffset + i) < blocks.boneIndex.palette.length, 'every splat skin index resolves');
  }
  // Includes any fine shirt-logo points: invalid inherited weights would make
  // those points stretch away from the clothing when the character waves.
  assert.equal(blocks.boneWeight.components, blocks.boneIndex.components - 1);
  const weightOffset = payload + blocks.boneWeight.offset;
  for (let i = 0; i < numSplats; i++) {
    let stored = 0;
    for (let c = 0; c < blocks.boneWeight.components; c++) stored += bytes[weightOffset + c * numSplats + i];
    assert.ok(stored <= 255, 'stored weights plus the implicit final weight sum to one');
  }
  const jointsOffset = payload + blocks.joints.offset;
  for (let i = 0; i < blocks.joints.length; i += 4) assert.ok(Number.isFinite(bytes.readFloatLE(jointsOffset + i)));
});

const motion = await new NodeIO().readBinary(readFileSync(motionUrl));
const root = motion.getRoot();
const clip = root.listAnimations()[0];
const nodDocument = await new NodeIO().readBinary(readFileSync(nodUrl));

test('the hello clip targets the new character rig and ships without mesh or texture dependencies', () => {
  assert.equal(root.listAnimations().length, 1);
  assert.equal(root.listMeshes().length, 0);
  assert.equal(root.listTextures().length, 0);
  assert.equal(root.listNodes().length, library.boneNames441.length);
  const names = new Set(library.boneNames441);
  const targeted = new Set();
  for (const channel of clip.listChannels()) {
    const name = channel.getTargetNode().getName();
    assert.ok(names.has(name), `${name} exists in AGI-1's rig`);
    assert.ok(!name.startsWith('mixamorig'), 'the supplied Mixamo animation has been retargeted');
    targeted.add(name);
    const input = channel.getSampler().getInput().getArray();
    assert.ok(input.length > 1);
    assert.equal(input[0], 0);
    for (let i = 1; i < input.length; i++) assert.ok(input[i] > input[i - 1], 'animation times increase');
    assert.ok(Math.abs(input.at(-1) - 1.7) < 0.001, 'the supplied hello lasts 1.7 seconds');
  }
  for (const name of ['upperarm_r', 'lowerarm_r', 'hand_r']) assert.ok(targeted.has(name), `${name} plays the hello`);
});

test('the retargeted hello has valid rotations, a moving waving arm, and no drifting root', () => {
  const moving = new Set();
  for (const channel of clip.listChannels()) {
    const name = channel.getTargetNode().getName();
    const values = channel.getSampler().getOutput().getArray();
    for (const value of values) assert.ok(Number.isFinite(value), `${name} has finite samples`);
    if (channel.getTargetPath() === 'rotation') {
      const digit = /^(thumb|index|middle|ring|pinky)_(?:metacarpal|0[1-3])_[lr]$/.test(name);
      const boneIndex = library.boneNames441.indexOf(name);
      const rest = library.restRotations441.subarray(boneIndex * 4, boneIndex * 4 + 4);
      for (let i = 0; i < values.length; i += 4) {
        assert.ok(Math.abs(Math.hypot(...values.subarray(i, i + 4)) - 1) < 0.002, `${name} has unit rotations`);
        const dot = Math.abs(values[i] * values[0] + values[i + 1] * values[1] + values[i + 2] * values[2] + values[i + 3] * values[3]);
        if (dot < 0.995) moving.add(name);
        if (digit) {
          const restDot = Math.abs(values[i] * rest[0] + values[i + 1] * rest[1] + values[i + 2] * rest[2] + values[i + 3] * rest[3]);
          assert.ok(restDot / (Math.hypot(...rest) * Math.hypot(...values.subarray(i, i + 4))) > 0.999999, `${name} preserves the character's natural finger shape`);
        }
      }
    }
    if (channel.getTargetPath() === 'translation') {
      for (let i = 3; i < values.length; i++) assert.ok(Math.abs(values[i] - values[i % 3]) < 0.00001, `${name} stays in place`);
    }
  }
  assert.ok(moving.has('upperarm_r') || moving.has('lowerarm_r'), 'the wave lifts her arm');
  assert.ok(moving.has('hand_r'), 'the supplied greeting moves her hand');
  for (const name of ['root', 'pelvis', 'thigh_l', 'thigh_r', 'calf_l', 'calf_r']) assert.ok(!moving.has(name), `${name} keeps the standing pose`);
});

test('the supplied nod drives the native full body while preserving fingers, face and root', () => {
  const root = nodDocument.getRoot(), animations = root.listAnimations();
  assert.equal(animations.length, 1);
  assert.equal(root.listMeshes().length + root.listTextures().length, 0);
  assert.deepEqual(root.listNodes().map(node => node.getName()), library.boneNames441);
  const moving = new Set();
  for (const channel of animations[0].listChannels()) {
    const name = channel.getTargetNode().getName(), index = library.boneNames441.indexOf(name);
    const times = channel.getSampler().getInput().getArray(), values = channel.getSampler().getOutput().getArray();
    assert.equal(times.length, 112);
    assert.equal(times[0], 0);
    assert.ok(Math.abs(times.at(-1) - 3.7) < 0.001, 'the supplied nod keeps its complete 3.7-second performance');
    for (let i = 1; i < times.length; i++) assert.ok(times[i] > times[i - 1]);
    for (const value of values) assert.ok(Number.isFinite(value));
    if (channel.getTargetPath() === 'rotation') {
      const keepRest = name === 'root' || name.startsWith('FACIAL_') || /^(thumb|index|middle|ring|pinky)_/.test(name);
      const rest = library.restRotations441.subarray(index * 4, index * 4 + 4);
      for (let i = 0; i < values.length; i += 4) {
        const q = values.subarray(i, i + 4), length = Math.hypot(...q);
        assert.ok(Math.abs(length - 1) < 0.002, `${name} has valid rotations`);
        const dot = Math.abs(q.reduce((sum, value, c) => sum + value * values[c], 0));
        if (dot < 0.99999) moving.add(name);
        if (keepRest) {
          const restDot = Math.abs(q.reduce((sum, value, c) => sum + value * rest[c], 0));
          assert.ok(restDot / (length * Math.hypot(...rest)) > 0.999999, `${name} preserves the native neutral shape`);
        }
      }
    } else {
      assert.equal(channel.getTargetPath(), 'translation');
      assert.equal(name, 'pelvis', 'only pelvis height changes to keep her feet grounded');
      for (let i = 0; i < values.length; i += 3) {
        assert.ok(Math.abs(values[i] - values[0]) < 1e-7 && Math.abs(values[i + 2] - values[2]) < 1e-7,
          'the nod stays in place instead of sliding across the stage');
      }
    }
  }
  assert.ok(moving.has('head') || moving.has('neck_01'), 'the supplied nod actually moves her head');
  assert.ok(moving.has('pelvis') && moving.has('thigh_l') && moving.has('thigh_r'), 'the authored natural stance is retained');
});

function playbackFixture({ canPlay = true, reducedMotion = false } = {}) {
  const played = [], stopped = [];
  const character = {
    crossfadeTo(name, options) { played.push({ name, ...options }); return canPlay; },
    armature: { stop(duration) { stopped.push(duration); } },
  };
  return { playback: createSplatPlayback(character, {
    hello: { name: 'agi1-hello', duration: 1.7 }, nod: { name: 'agi1-nod', duration: 3.7 },
    random: () => 0.5, reducedMotion,
  }), played, stopped };
}

function advancePlayback(playback, seconds, input = {}) {
  for (let frame = 0; frame < Math.round(seconds * 60); frame++) playback.update(1 / 60, input);
}

test('authored gestures play once, ignore duplicates, and give hello priority over nods', () => {
  const { playback, played, stopped } = playbackFixture();
  assert.equal(playback.active, null, 'no surprise animation before the first request');
  assert.equal(played.length, 0);
  assert.equal(playback.start('nod'), true);
  advancePlayback(playback, 0.8);
  assert.equal(playback.start('nod'), false, 'another okay request does not restart the current nod');
  assert.equal(played.length, 1);
  assert.equal(playback.active, 'nod');
  assert.equal(playback.start('hello'), true, 'a requested hello can take over an ambient nod');
  assert.equal(playback.start('nod'), false, 'a nod never interrupts the supplied hello');
  assert.equal(playback.start('hello'), false, 'duplicate hellos do not restart the player');
  assert.deepEqual(played, [
    { name: 'agi1-nod', duration: 0.32, loop: false, rootMotion: false },
    { name: 'agi1-hello', duration: 0.2, loop: false, rootMotion: false },
  ]);
  advancePlayback(playback, 1.3);
  assert.equal(playback.active, 'hello', 'the interrupted nod timer cannot end the new greeting');
  advancePlayback(playback, 0.5);
  assert.equal(playback.active, null);
  assert.deepEqual(stopped, [0.32], 'completion blends back to idle once');
  advancePlayback(playback, 2);
  assert.equal(played.length, 2, 'completed gestures do not restart themselves');
  assert.equal(stopped.length, 1, 'idle is not restarted every frame');
  assert.equal(playback.start('hello'), true);
  advancePlayback(playback, 1.8);
  assert.equal(playback.active, null);
  assert.equal(stopped.length, 2);
});

test('a missing clip or invalid frame delta cannot leave an authored gesture stuck', () => {
  const missing = playbackFixture({ canPlay: false });
  assert.equal(missing.playback.start('nod'), false);
  assert.equal(missing.playback.active, null);
  missing.playback.update(10);
  assert.equal(missing.stopped.length, 0);
  const { playback, stopped } = playbackFixture();
  playback.start('hello');
  for (const dt of [NaN, Infinity, -Infinity, 0, -1]) playback.update(dt);
  assert.equal(playback.active, 'hello');
  assert.equal(stopped.length, 0);
  advancePlayback(playback, 1.8);
  assert.equal(playback.active, null);
  assert.equal(stopped.length, 1);
});

test('ambient nods are occasional and wait for uninterrupted quiet idle', () => {
  const { playback, played } = playbackFixture();
  const starts = [];
  for (let frame = 0; frame < 75 * 60; frame++) {
    const before = played.length;
    playback.update(1 / 60, { level: 0, attention: 'idle', dancing: false, mood: 'neutral' });
    if (played.length > before) starts.push((frame + 1) / 60);
  }
  assert.ok(starts.length >= 2 && starts.length <= 4, 'the nod is a sparse gesture, not a looping idle animation');
  assert.ok(starts[0] >= 8 && starts[0] < 8.1, 'she settles before the first ambient gesture');
  for (let i = 1; i < starts.length; i++) assert.ok(starts[i] - starts[i - 1] >= 18, 'gestures have a long quiet gap');
  assert.ok(played.every(entry => entry.name === 'agi1-nod' && entry.loop === false));
  for (const input of [{ level: 0.7 }, { attention: 'listening' }, { attention: 'thinking' }, { dancing: true }, { mood: 'love' }]) {
    const busy = playbackFixture();
    advancePlayback(busy.playback, 30, input);
    assert.equal(busy.played.length, 0, 'voice, attention, emotion and dancing postpone ambient nods');
    advancePlayback(busy.playback, 2);
    assert.equal(busy.played.length, 0, 'becoming quiet does not immediately trigger an overdue gesture');
  }
  const reduced = playbackFixture({ reducedMotion: true });
  advancePlayback(reduced.playback, 60);
  assert.equal(reduced.played.length, 0, 'reduced motion disables unsolicited nods');
});

function motionFixture(reducedMotion = false) {
  const arm = {
    rigBoneNames: library.boneNames441,
    skeleton: { bindR: library.restRotations441, bindT: library.restTranslations441, parents: library.parents441 },
  };
  const pose = new Pose(arm.rigBoneNames.length);
  pose.setToBind(arm.skeleton.bindT, arm.skeleton.bindR);
  return { arm, pose, motion: createSplatMotion(arm, { reducedMotion }) };
}
const rotationOf = (pose, name) => pose.rotations[library.boneNames441.indexOf(name)];
const quaternionGap = (a, b) => 1 - Math.min(1, Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w)
  / (Math.hypot(a.x, a.y, a.z, a.w) * Math.hypot(b.x, b.y, b.z, b.w)));

// Exercise the same player and pose-modifier path used by the browser. Driving
// scene-graph nodes keeps the real engine active without a GPU or fake sampler.
function engineFixture(t) {
  const scene = { contentRoot: new Entity('test scene'), skeletonLibrary: library,
    skeletalAnimationLibrary: new Map(), app: { frame: 0 } };
  const load = (url, name) => {
    const bytes = readFileSync(url);
    const clip = Animation.fromGlb(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    clip.register(scene, name); return clip;
  };
  const clip = load(motionUrl, 'agi1-hello'), nodClip = load(nodUrl, 'agi1-nod');
  const arm = new Armature('test AGI-1', { numBones: library.boneNames441.length,
    boneNames: library.boneNames441, restIsPerCharacter: true,
    stdMaleRestTranslations: library.restTranslations441, stdMaleRestRotations: library.restRotations441,
    stdMaleParents: library.parents441 });
  arm.addToScene(scene);
  const nodes = library.boneNames441.map(name => new Entity(name));
  arm.driveNodes(nodes);
  scene.app.update = dt => { scene.app.frame++; arm.update(dt); };
  t.after(() => { arm.destroy(); nodes.forEach(node => node.destroy()); scene.contentRoot.destroy(); });
  return { arm, scene, clip, nodClip };
}

test('the full-body nod keeps both feet grounded throughout real engine sampling', t => {
  const { arm, nodClip } = engineFixture(t);
  assert.equal(arm.playAnimation('agi1-nod', false, false), true);
  const feet = ['ball_l', 'ball_r'].map(name => library.boneNames441.indexOf(name));
  assert.ok(feet.every(index => index >= 0));
  const first = new Float32Array(6), current = new Float32Array(6);
  assert.equal(arm.probeBoneWorldPositions(0, feet, first), true);
  const floor = Math.min(first[1], first[4]);
  for (let frame = 0; frame < nodClip.numFrames; frame++) {
    assert.equal(arm.probeBoneWorldPositions(frame, feet, current), true);
    assert.ok(Math.abs(Math.min(current[1], current[4]) - floor) < 0.002, 'a supporting foot stays on the floor');
    for (let side = 0; side < 2; side++) {
      const i = side * 3;
      assert.ok(Math.hypot(current[i] - first[i], current[i + 1] - first[i + 1], current[i + 2] - first[i + 2]) < 0.01,
        'the natural stance does not make her feet skate');
    }
  }
});

test('the actual controller advances the nod smoothly while blinking and speaking independently', t => {
  const { arm, scene, clip, nodClip } = engineFixture(t), played = [];
  const character = { armature: arm, crossfadeTo(name, options) { played.push(name); return arm.crossfadeTo(name, options); } };
  const controller = createController({ character, scene, clip, nodClip, fx: new Group(),
    marks: { head: new Group(), chest: new Group() }, sync() {}, updateMarks() {}, random: () => 0.5 });
  const authored = new Pose(arm.numBones), shown = new Pose(arm.numBones), previous = new Pose(arm.numBones);
  const modify = arm.poseModifier;
  arm.poseModifier = pose => { authored.copyFrom(pose); modify(pose); shown.copyFrom(pose); };
  controller.update(1 / 60); previous.copyFrom(shown);
  const initialHead = rotationOf(shown, 'head').clone();
  const body = ['pelvis', 'spine_03', 'clavicle_l', 'upperarm_r', 'thigh_l', 'calf_r'];
  const eye = library.boneNames441.indexOf('FACIAL_L_EyeParallel');
  let headMotion = 0, eyeClosure = 0, jawMotion = 0, ended = false;
  controller.react('okay');
  for (let frame = 0; frame < 270; frame++) {
    if (frame === 12) controller.react('okay');
    if (frame === 40 || frame === 220) controller.blink();
    controller.setTalk(frame >= 30 && frame < 150 ? 0.7 : 0);
    const wasNodding = controller.nodding;
    controller.update(1 / 60);
    if (controller.nodding) {
      assert.equal(arm.currentAnimationName, 'agi1-nod');
      assert.ok(Math.abs(arm.animationTime - (frame + 1) / 2) < 1e-4, 'the clip clock advances instead of restarting on each pose update');
      for (const name of body) assert.ok(quaternionGap(rotationOf(authored, name), rotationOf(shown, name)) < 1e-10,
        `${name} retains its authored nod instead of being reset to the idle pose`);
    }
    for (const name of body.concat('head')) {
      const index = library.boneNames441.indexOf(name);
      assert.ok(quaternionGap(previous.rotations[index], shown.rotations[index]) < 0.01, `${name} enters and leaves the nod without snapping`);
      assert.ok(previous.positions[index].distance(shown.positions[index]) < 0.02, `${name} does not jump vertically on return to idle`);
      if (wasNodding && !controller.nodding) {
        assert.ok(quaternionGap(previous.rotations[index], shown.rotations[index]) < 1e-10, 'the first idle frame retains the last authored body pose');
        assert.ok(previous.positions[index].distance(shown.positions[index]) < 1e-8, 'the return blend preserves the last pelvis height');
        ended = true;
      }
    }
    headMotion = Math.max(headMotion, quaternionGap(initialHead, rotationOf(shown, 'head')));
    eyeClosure = Math.max(eyeClosure, shown.positions[eye].distance(authored.positions[eye]));
    jawMotion = Math.max(jawMotion, quaternionGap(rotationOf(authored, 'FACIAL_C_LowerLipRotation'), rotationOf(shown, 'FACIAL_C_LowerLipRotation')));
    previous.copyFrom(shown);
  }
  assert.deepEqual(played, ['agi1-nod'], 'repeated okay input and pose evaluation do not replay the clip');
  assert.equal(ended, true, 'the authored gesture completes and returns to idle');
  assert.ok(headMotion > 0.001, 'the supplied head movement is visible');
  assert.ok(eyeClosure > 0.049, 'a complete blink survives the body animation and return blend');
  assert.ok(jawMotion > 0.001, 'speech moves her native lips during the nod');
  assert.equal(controller.mouthOpen, 0);
  assert.equal(controller.blinking, 0);
  assert.ok(shown.positions[eye].distance(authored.positions[eye]) < 1e-8, 'the eyes reopen without accumulating facial offsets');
});

test('her idle has gentle movement while the feet and hips stay planted', () => {
  const { motion, pose, arm } = motionFixture();
  motion.update(0, {}); motion.apply(pose);
  const head = rotationOf(pose, 'head').clone();
  let movement = 0;
  const fixed = ['root', 'pelvis', 'thigh_l', 'thigh_r', 'calf_l', 'calf_r', 'foot_l', 'foot_r'];
  const lower = new Pose(pose.numBones); lower.copyFrom(pose);
  for (let frame = 0; frame < 600; frame++) {
    motion.update(1 / 60, {}); motion.apply(pose);
    movement = Math.max(movement, quaternionGap(head, rotationOf(pose, 'head')));
    for (const name of fixed) {
      assert.ok(quaternionGap(rotationOf(lower, name), rotationOf(pose, name)) < 1e-10, `${name} stays planted`);
    }
    for (let i = 0; i < pose.numBones; i++) {
      const q = pose.rotations[i], p = pose.positions[i];
      assert.ok(Number.isFinite(q.x + q.y + q.z + q.w));
      assert.ok(Math.abs(Math.hypot(q.x, q.y, q.z, q.w) - 1) < 0.002);
      assert.deepEqual([p.x, p.y, p.z], Array.from(arm.skeleton.bindT.subarray(i * 3, i * 3 + 3)), 'idle does not drift across the floor');
    }
  }
  assert.ok(movement > 1e-6, 'she looks around naturally instead of holding a frozen head pose');
  assert.ok(movement < 0.08, 'ambient head motion stays subtle');
});

test('reduced motion rests quietly but still responds smoothly to attention', () => {
  const { motion, pose } = motionFixture(true);
  motion.update(0, {}); motion.apply(pose);
  const initial = new Pose(pose.numBones); initial.copyFrom(pose);
  for (let frame = 0; frame < 240; frame++) { motion.update(1 / 60, {}); motion.apply(pose); }
  for (let i = 0; i < pose.numBones; i++) assert.ok(quaternionGap(initial.rotations[i], pose.rotations[i]) < 1e-10, 'no unsolicited ambient sway');
  const restingHead = rotationOf(pose, 'head').clone();
  let previous = restingHead.clone(), response = 0;
  for (let frame = 0; frame < 120; frame++) {
    motion.update(1 / 60, { pointer: { x: 1, y: 0.5 }, attention: 'listening' }); motion.apply(pose);
    const head = rotationOf(pose, 'head');
    response = Math.max(response, quaternionGap(restingHead, head));
    assert.ok(quaternionGap(previous, head) < 0.005, 'a new focus eases in without snapping');
    previous.copy(head);
  }
  assert.ok(response > 1e-5, 'she still acknowledges someone speaking to her');
  for (let frame = 0; frame < 300; frame++) { motion.update(1 / 60, { pointer: null, attention: 'idle', level: 0 }); motion.apply(pose); }
  assert.ok(quaternionGap(restingHead, rotationOf(pose, 'head')) < 1e-6, 'attention returns to rest without accumulating a head turn');
});

test('natural motion leaves the supplied hello arm and wrist animation intact', () => {
  const { motion, pose } = motionFixture();
  const names = ['clavicle_l', 'upperarm_l', 'lowerarm_l', 'hand_l', 'clavicle_r', 'upperarm_r', 'lowerarm_r', 'hand_r'];
  for (const channel of clip.listChannels()) {
    if (channel.getTargetPath() !== 'rotation') continue;
    const index = library.boneNames441.indexOf(channel.getTargetNode().getName());
    const values = channel.getSampler().getOutput().getArray();
    pose.rotations[index].set(...values.subarray(25 * 4, 26 * 4));
  }
  const authored = new Map(names.map(name => [name, rotationOf(pose, name).clone()]));
  motion.update(1 / 60, { waving: true, level: 0.7, attention: 'listening', pointer: { x: 0.5, y: 0.2 } });
  motion.apply(pose, { waving: true });
  for (const [name, rotation] of authored) assert.ok(quaternionGap(rotation, rotationOf(pose, name)) < 1e-10, `${name} retains the supplied greeting pose`);
});

test('the greeting blends back to idle without snapping her raised arm', () => {
  const { motion, pose } = motionFixture(true);
  const idle = motionFixture(true);
  idle.motion.apply(idle.pose);
  for (const channel of clip.listChannels()) {
    if (channel.getTargetPath() !== 'rotation') continue;
    const values = channel.getSampler().getOutput().getArray();
    rotationOf(pose, channel.getTargetNode().getName()).set(...values.subarray(25 * 4, 26 * 4));
  }
  motion.update(1 / 60, { waving: true }); motion.apply(pose, { waving: true });
  const lastWave = rotationOf(pose, 'upperarm_r').clone();
  assert.ok(quaternionGap(lastWave, rotationOf(idle.pose, 'upperarm_r')) > 0.001, 'the test starts with a raised arm');
  motion.update(1 / 60, { waving: false }); motion.apply(pose, { waving: false });
  assert.ok(quaternionGap(lastWave, rotationOf(pose, 'upperarm_r')) < 1e-10, 'first idle frame starts at the last wave pose');
  for (let i = 0; i < 24; i++) { motion.update(1 / 60, { waving: false }); motion.apply(pose); }
  assert.ok(quaternionGap(rotationOf(pose, 'upperarm_r'), rotationOf(idle.pose, 'upperarm_r')) < 1e-10, 'the arm settles into relaxed idle');
});

test('her mouth follows the shared voice meter and silent speech, then closes during silence', t => {
  t.after(() => { setMeter(null); stopTalk(); });
  stopTalk();
  const face = createFaceSignals({ random: () => 0.5 });
  let volume = 0.7;
  setMeter(() => volume);
  for (let i = 0; i < 12; i++) face.update(1 / 60, { level: talkLevel() });
  assert.ok(face.mouthOpen > 0.5 && face.mouthOpen < 0.9, 'audible speech opens her mouth without overextending it');
  volume = 0;
  for (let i = 0; i < 36; i++) face.update(1 / 60, { level: talkLevel() });
  assert.equal(face.mouthOpen, 0, 'silence closes the mouth');
  setMeter(null);
  pretendTalk(2, 0.8, 1000);
  let widest = 0, narrowest = 1;
  for (let ms = 1000; ms < 3000; ms += 1000 / 60) {
    face.update(1 / 60, { level: talkLevel(ms) });
    widest = Math.max(widest, face.mouthOpen);
    narrowest = Math.min(narrowest, face.mouthOpen);
  }
  assert.ok(widest > 0.25 && widest <= 0.9, 'text replies still visibly speak when audio is off');
  assert.ok(widest - narrowest > 0.2, 'syllables vary rather than holding one open mouth');
  stopTalk();
  for (let i = 0; i < 60; i++) face.update(1 / 60, { level: talkLevel(4000) });
  assert.equal(face.mouthOpen, 0);
});

test('her blinks close fully, reopen quickly, and recur without holding the eyes shut', () => {
  const face = createFaceSignals({ random: () => 0.5 });
  let episodes = 0, wasBlinking = false, closedTime = 0, maximum = 0;
  for (let i = 0; i < 12 * 120; i++) {
    face.update(1 / 120, {});
    assert.ok(face.blink >= 0 && face.blink <= 1);
    const blinking = face.blink > 0;
    if (blinking && !wasBlinking) episodes++;
    if (blinking) closedTime += 1 / 120;
    wasBlinking = blinking;
    maximum = Math.max(maximum, face.blink);
  }
  assert.ok(episodes >= 3 && episodes <= 4, 'occasional natural blinks');
  assert.equal(maximum, 1, 'lids reach fully closed');
  assert.ok(closedTime < 1.2, 'eyes spend most of the time open');
  face.blinkNow();
  for (let i = 0; i < 40; i++) face.update(1 / 120, {});
  assert.equal(face.blink, 0, 'a requested blink finishes within a third of a second');
  let attentiveBlink = 0;
  for (let i = 0; i < 48; i++) {
    face.update(1 / 120, { attention: 'listening' });
    attentiveBlink = Math.max(attentiveBlink, face.blink);
  }
  assert.equal(attentiveBlink, 1, 'shifting attention prompts a quick blink');
});

test('facial motion uses the native lids and both mouth branches, leaving body poses untouched', () => {
  const { arm, pose } = motionFixture();
  const face = createAgi1SplatFace(arm, { random: () => 0.5 });
  const baseline = new Pose(pose.numBones); baseline.copyFrom(pose);
  // The engine normalizes its rigid bone palette, stripping pose scales.
  // Check the actual model-space translation instead of the ignored scale.
  const restWorld = [];
  const restRotation = i => {
    if (restWorld[i]) return restWorld[i];
    const q = baseline.rotations[i].clone().normalize(), parent = arm.skeleton.parents[i];
    return restWorld[i] = (parent < 0 ? q : restRotation(parent).clone().mul(q)).normalize();
  };
  const modelDelta = i => {
    const delta = pose.positions[i].clone().sub(baseline.positions[i]), parent = arm.skeleton.parents[i];
    return parent < 0 ? delta : restRotation(parent).transformVector(delta, delta);
  };
  face.apply(pose, { blink: 1, mouth: 0, smile: 0 });
  for (const side of ['L', 'R']) {
    const eye = library.boneNames441.indexOf(`FACIAL_${side}_EyeParallel`);
    const upper = library.boneNames441.indexOf(`FACIAL_${side}_EyelidUpperA`);
    const lower = library.boneNames441.indexOf(`FACIAL_${side}_EyelidLowerA`);
    assert.ok(eye >= 0 && upper >= 0 && lower >= 0, 'the animated face parts exist in the shipped rig');
    const eyeMove = modelDelta(eye), upperMove = modelDelta(upper), lowerMove = modelDelta(lower);
    assert.ok(Math.abs(eyeMove.x + 0.05) < 0.001 && Math.abs(eyeMove.y) < 1e-6 && Math.abs(eyeMove.z) < 1e-6,
      'the iris recedes into the head along model -X even with bone scale stripped');
    assert.ok(upperMove.y < -0.01 && lowerMove.y > 0.005, 'the upper lid lowers and lower lid rises to cover the eye');
    assert.ok(Math.abs(upperMove.z) + Math.abs(lowerMove.z) < 1e-6, 'both lids converge vertically without sliding sideways');
  }
  pose.copyFrom(baseline);
  face.apply(pose, { blink: 0, mouth: 0.8, smile: 0 });
  for (const name of ['FACIAL_C_Jaw', 'FACIAL_C_LowerLipRotation']) {
    assert.ok(quaternionGap(rotationOf(pose, name), rotationOf(baseline, name)) > 0.001, `${name} opens visibly with speech`);
  }
  for (let i = 0; i < pose.numBones; i++) {
    if (library.boneNames441[i].startsWith('FACIAL_')) continue;
    assert.ok(pose.positions[i].distance(baseline.positions[i]) < 1e-10);
    assert.ok(quaternionGap(pose.rotations[i], baseline.rotations[i]) < 1e-10, 'a blink or syllable never distorts the body or supplied greeting');
  }
  pose.copyFrom(baseline);
  face.apply(pose, { blink: 0, mouth: 0, smile: 0 });
  for (let i = 0; i < pose.numBones; i++) {
    assert.ok(pose.positions[i].distance(baseline.positions[i]) < 1e-10);
    assert.ok(pose.scales[i].distance(baseline.scales[i]) < 1e-10);
    assert.ok(quaternionGap(pose.rotations[i], baseline.rotations[i]) < 1e-10, 'the next fresh frame returns fully to rest');
  }
});

// ---- 2026-10-28: taller proportions, standing on the floor, and the model clean-up
function shippedArmature() {
  const model = readVsplat(modelUrl);
  return new Armature('shipped AGI-1', { numBones: library.boneNames441.length, boneNames: library.boneNames441,
    restIsPerCharacter: true, stdMaleRestTranslations: Float32Array.from(model.joints),
    stdMaleRestRotations: library.restRotations441, stdMaleParents: library.parents441 });
}
function restWorld(arm) {
  const pose = new Pose(arm.numBones), world = [];
  pose.setToBind(arm.skeleton.bindT, arm.skeleton.bindR);
  arm.skeleton.applyLocal(pose, Mat4.IDENTITY, world);
  return name => world[library.boneNames441.indexOf(name)].getTranslation(new Vec3());
}

test('her taller proportions lengthen the legs, keep her feet on the floor and leave her head as it is', () => {
  const arm = shippedArmature(), before = restWorld(arm);
  const { lift, rise } = applyAgi1Proportions(arm);
  const after = restWorld(arm);
  const length = (at, a, b) => at(a).distance(at(b));
  for (const side of ['l', 'r']) {
    const thigh = length(after, `thigh_${side}`, `calf_${side}`) / length(before, `thigh_${side}`, `calf_${side}`);
    const shin = length(after, `calf_${side}`, `foot_${side}`) / length(before, `calf_${side}`, `foot_${side}`);
    assert.ok(Math.abs(thigh - AGI1_PROPORTIONS.legAlong) < 1e-4 && Math.abs(shin - AGI1_PROPORTIONS.legAlong) < 1e-4, 'both leg segments grow');
    assert.ok(Math.abs(length(after, `foot_${side}`, `ball_${side}`) - length(before, `foot_${side}`, `ball_${side}`)) < 1e-6, 'her feet keep their size');
    // Her right foot rests 1 cm higher and its leg is a little less upright, so it ends within a millimetre.
    assert.ok(Math.abs(after(`ball_${side}`).y + lift - before(`ball_${side}`).y) < 0.002, 'the lift puts each foot back on the floor');
  }
  assert.ok(lift > 0.09 && lift < 0.14, `the legs add about 11 cm in the model's metres (${lift.toFixed(3)})`);
  assert.ok(rise > lift && rise < lift + 0.02, 'a slightly longer neck lifts her head a little more');
  const headSize = (at) => at('head').distance(at('FACIAL_C_FacialRoot'));
  assert.ok(Math.abs(headSize(after) - headSize(before)) < 1e-6, 'her head and face keep their size');
  assert.ok(Math.abs(length(after, 'spine_01', 'spine_05') - length(before, 'spine_01', 'spine_05')) < 1e-6, 'her torso keeps its length');
  applyAgi1Proportions(arm, null);
  const reset = restWorld(arm);
  assert.ok(reset('ball_l').distance(before('ball_l')) < 1e-6, 'proportions can be switched off again');
});

test('she stands on the floor despite the engine lowering VIGGCHAR characters by their bake shift', () => {
  const calls = [];
  const character = { bakedGroundShiftY: 0.1119, setPosition: (...xyz) => calls.push(xyz) };
  standOnFloor(character, 0.05);
  assert.deepEqual(calls[0].map(v => +v.toFixed(6)), [0, 0.1619, 0], 'the entity rises by the shift plus the longer legs');
  standOnFloor({ setPosition: (...xyz) => calls.push(xyz) });
  assert.deepEqual(calls[1], [0, 0, 0], 'a character without a bake shift stays at the origin');
  const source = readFileSync(new URL('../src/stage/agi1-splat.js', import.meta.url), 'utf8');
  assert.match(source, /applyAgi1Proportions\(character\.armature\)/, 'the website applies her proportions');
  assert.match(source, /standOnFloor\(character, lift\)/, 'the website stands her on the floor');
  assert.match(source, /AGI1_SPLAT_HEIGHT \/ \(SOURCE_HEIGHT \+ rise\)/, 'her overall height stays the 2D model\'s');
});

test('blinks never scale bones, which the proportions stretch would otherwise show', () => {
  const { arm, pose } = motionFixture();
  const face = createAgi1SplatFace(arm, { random: () => 0.5 });
  face.apply(pose, { blink: 1, mouth: 0.8, smile: 0.5 });
  for (let i = 0; i < pose.numBones; i++) {
    const s = pose.scales[i];
    assert.ok(Math.abs(s.x - 1) + Math.abs(s.y - 1) + Math.abs(s.z - 1) < 1e-9, `${library.boneNames441[i]} keeps unit scale`);
  }
});

test('the shipped model has an invisible first splat and no other invisible splats', () => {
  const model = readVsplat(modelUrl);
  const invisible = 1 / 255;
  assert.ok(sigmoid(model.opacity[0]) < invisible, 'slot 0 is a placeholder: the renderer misdraws whatever is stored first');
  let hidden = 0;
  for (let i = 1; i < model.n; i++) if (sigmoid(model.opacity[i]) < invisible) hidden++;
  assert.equal(hidden, 0, 'splats nobody can see are dropped');
});

test('the AGI print sits on the shirt instead of floating in front of it', () => {
  const model = readVsplat(modelUrl), ink = [], cloth = [];
  for (let i = 0; i < model.n; i++) {
    const rgb = [model.color[i * 3], model.color[i * 3 + 1], model.color[i * 3 + 2]];
    if (rgb[0] === 249 && rgb[1] === 247 && rgb[2] === 253) { ink.push(i); continue; }
    const [h, s] = hsv(...rgb), y = model.pos[i * 3 + 1];
    if (model.pos[i * 3] > 0.05 && y > 1.36 && y < 1.5 && h >= 230 && h <= 300 && s > 0.1 && sigmoid(model.opacity[i]) > 0.3) cloth.push(i);
  }
  assert.ok(ink.length > 5000, 'the print is present');
  const gaps = [];
  for (const i of ink) {
    let front = -Infinity;
    for (const j of cloth) {
      const dy = model.pos[j * 3 + 1] - model.pos[i * 3 + 1], dz = model.pos[j * 3 + 2] - model.pos[i * 3 + 2];
      if (dy * dy + dz * dz < 0.0001) front = Math.max(front, model.pos[j * 3]);
    }
    if (front > -Infinity) gaps.push(model.pos[i * 3] - front);
  }
  gaps.sort((a, b) => a - b);
  const at = p => gaps[Math.floor(p * (gaps.length - 1))];
  // The first version stood 20 mm (median) to 26 mm (95%) off the cloth.
  assert.ok(at(0.5) < 0.01, `the print hugs the shirt (median gap ${(at(0.5) * 1000).toFixed(1)} mm)`);
  assert.ok(at(0.95) < 0.02, `even where her chest curves away (95% gap ${(at(0.95) * 1000).toFixed(1)} mm)`);
});

test('the AGI print moves with the shirt through the nod and the wave', () => {
  // The shirt's own motion at each print splat: its shirt splats within 8 mm,
  // skinned together (skinning is linear, so their mean weights). The print's
  // first weights followed only her spine: in the nod the top of the word stood
  // up to 4 mm off the shirt (p99), a white fin above her outline from the side.
  const model = readVsplat(modelUrl), ink = [], cloth = [];
  for (let i = 0; i < model.n; i++) {
    const rgb = [model.color[i * 3], model.color[i * 3 + 1], model.color[i * 3 + 2]];
    if (rgb[0] === 249 && rgb[1] === 247 && rgb[2] === 253) { ink.push(i); continue; }
    const [h, s] = hsv(...rgb), y = model.pos[i * 3 + 1];
    if (model.pos[i * 3] > 0.05 && y > 1.36 && y < 1.5 && h >= 230 && h <= 300 && s > 0.1 && sigmoid(model.opacity[i]) > 0.3) cloth.push(i);
  }
  const weightsOf = (i) => {
    const w = [0, 1, 2].map(k => model.boneWeight[i * 3 + k]);
    w.push(255 - w[0] - w[1] - w[2]);
    return w.map((v, k) => [model.palette[model.boneIndex[i * 4 + k]], v / 255]).filter(([, v]) => v > 0);
  };
  const at = (i) => new Vec3(model.pos[i * 3], model.pos[i * 3 + 1], model.pos[i * 3 + 2]);
  const pairs = [];
  for (const i of ink) {
    const p = at(i), shirt = new Map();
    let n = 0;
    for (const j of cloth) {
      const q = at(j);
      if ((q.y - p.y) ** 2 + (q.z - p.z) ** 2 >= 0.008 ** 2 || q.x < p.x - 0.02) continue;
      n++;
      for (const [bone, w] of weightsOf(j)) shirt.set(bone, (shirt.get(bone) || 0) + w);
    }
    if (n) pairs.push({ p, own: weightsOf(i), shirt: [...shirt].map(([bone, w]) => [bone, w / n]) });
  }
  assert.ok(pairs.length > 5000, 'the print lies on the shirt');
  const scene = { contentRoot: new Entity('print test'), skeletonLibrary: library, skeletalAnimationLibrary: new Map(), app: { frame: 0 } };
  const arm = shippedArmature();
  arm.addToScene(scene);
  const world = [], skin = library.boneNames441.map(() => new Mat4()), scratch = new Vec3();
  const skinned = (weights, p) => {
    const out = new Vec3();
    for (const [bone, w] of weights) out.add(skin[bone].transformPoint(p, scratch).mulScalar(w));
    return out;
  };
  for (const [name, url] of [['agi1-hello', motionUrl], ['agi1-nod', nodUrl]]) {
    const bytes = readFileSync(url);
    const clip = Animation.fromGlb(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    clip.register(scene, name);
    assert.equal(arm.playAnimation(name, false, false), true);
    const pose = new Pose(arm.numBones), offsets = [];
    for (let frame = 0; frame < clip.numFrames; frame += 3) {
      arm.probePose(frame, pose);
      arm.skeleton.applyLocal(pose, Mat4.IDENTITY, world);
      for (let b = 0; b < skin.length; b++) skin[b].mul2(world[b], arm.inverseBindPose[b]);
      for (const { p, own, shirt } of pairs) {
        const base = skinned(shirt, p), normal = skinned(shirt, new Vec3(p.x + 0.01, p.y, p.z)).sub(base).normalize();
        offsets.push(skinned(own, p).sub(base).dot(normal));
      }
    }
    offsets.sort((a, b) => a - b);
    const out = offsets[Math.floor(0.99 * (offsets.length - 1))], inward = -offsets[Math.floor(0.01 * (offsets.length - 1))];
    assert.ok(out < 0.0015, `${name}: the print stays on the shirt (99% within ${(out * 1000).toFixed(2)} mm in front of it)`);
    assert.ok(inward < 0.0015, `${name}: and does not sink into it (99% within ${(inward * 1000).toFixed(2)} mm)`);
  }
  arm.destroy();
  scene.contentRoot.destroy();
});

test('hair hanging far from her arms follows her upper body, not her arms', () => {
  const model = readVsplat(modelUrl), at = restWorld(shippedArmature());
  const armBones = new Set();
  for (const side of ['l', 'r']) {
    const root = library.boneNames441.indexOf(`clavicle_${side}`);
    for (let i = 0; i < library.boneNames441.length; i++) {
      for (let b = i; b >= 0; b = library.parents441[b]) if (b === root) { armBones.add(i); break; }
    }
  }
  const segments = ['l', 'r'].flatMap(side => [[`clavicle_${side}`, `upperarm_${side}`], [`upperarm_${side}`, `lowerarm_${side}`],
    [`lowerarm_${side}`, `hand_${side}`], [`hand_${side}`, `middle_03_${side}`]].map(([a, b]) => [at(a), at(b)]));
  const distance = (p) => Math.min(...segments.map(([a, b]) => {
    const ab = b.clone().sub(a), t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / ab.lengthSq()));
    return p.distance(a.clone().add(ab.mulScalar(t)));
  }));
  let farHair = 0, onArms = 0;
  for (let i = 1; i < model.n; i++) {
    const [h, s, v] = hsv(model.color[i * 3], model.color[i * 3 + 1], model.color[i * 3 + 2]);
    if (!(h >= 24 && h <= 60 && s >= 0.18 && v >= 0.3)) continue;
    const p = new Vec3(model.pos[i * 3], model.pos[i * 3 + 1], model.pos[i * 3 + 2]);
    if (p.y < 1.0 || distance(p) < 0.16) continue;
    farHair++;
    const weights = [model.boneWeight[i * 3], model.boneWeight[i * 3 + 1], model.boneWeight[i * 3 + 2]];
    weights.push(255 - weights[0] - weights[1] - weights[2]);
    if (weights.some((w, k) => w > 2 && armBones.has(model.palette[model.boneIndex[i * 4 + k]]))) onArms++;
  }
  assert.ok(farHair > 1000, 'her long hair is found');
  assert.equal(onArms, 0, 'no long hair is dragged by a wave');
});
