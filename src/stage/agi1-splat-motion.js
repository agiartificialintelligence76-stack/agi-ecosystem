// The same soft target-following and irregular drift as AGI-1's 2D model,
// expressed through this character's own skeleton. Coordinates are model-space:
// +X is forward, +Y up, and Z runs across the shoulders. Feet stay planted.
import { Quat, Vec3 } from 'playcanvas';
import { Follow, makeDrift, clamp } from './agi1-2d-motion.js';

export function createSplatMotion(arm, { reducedMotion = false } = {}) {
  const { bindR, bindT, parents } = arm.skeleton;
  const ids = Object.fromEntries(arm.rigBoneNames.map((name, i) => [name.toLowerCase(), i]));
  const localRest = [], worldRest = [], inverseRest = [];
  const restFor = (i) => {
    if (worldRest[i]) return worldRest[i];
    localRest[i] = new Quat(bindR[i * 4], bindR[i * 4 + 1], bindR[i * 4 + 2], bindR[i * 4 + 3]);
    worldRest[i] = parents[i] < 0 ? localRest[i].clone() : new Quat().mul2(restFor(parents[i]), localRest[i]);
    inverseRest[i] = worldRest[i].clone().invert();
    return worldRest[i];
  };
  for (let i = 0; i < arm.rigBoneNames.length; i++) restFor(i);
  const delta = new Quat(), scratch = new Quat(), localDelta = new Quat(), poseFrom = new Quat();
  const bend = (pose, name, roll = 0, yaw = 0, pitch = 0, additive = false) => {
    const i = ids[name];
    if (i === undefined) return;
    delta.setFromEulerAngles(roll, yaw, pitch);
    scratch.mul2(inverseRest[i], delta);
    localDelta.mul2(scratch, worldRest[i]);
    pose.rotations[i].mul2(additive ? pose.rotations[i] : localRest[i], localDelta).normalize();
  };
  const blendArm = (pose, name, roll, pitch, amount) => {
    const i = ids[name];
    if (i === undefined) return;
    poseFrom.copy(pose.rotations[i]);
    bend(pose, name, roll, 0, pitch);
    pose.rotations[i].slerp(poseFrom, pose.rotations[i], amount).normalize();
  };
  const drift = Array.from({ length: 8 }, (_, i) => makeDrift(1.7 + i * 7.31));
  const follow = {
    yaw: new Follow(0, 2.1, 1, 0.1), pitch: new Follow(0, 2.2, 1, 0.1),
    roll: new Follow(0, 1.7, 1, 0), torso: new Follow(0, 1.05, 1, 0),
  };
  let clock = 0, breathPhase = 0, speaking = 0, slowLevel = 0, speechTime = 0;
  let waving = false, authored = null, closeUp = false, dance = -1, dancePhase = 0, danceAmount = 0;
  const bodyIndices = arm.rigBoneNames.flatMap((name, i) => /^facial_/i.test(name) ? [] : [i]);
  const previousBody = bodyIndices.map(i => localRest[i].clone());
  const previousPositions = bodyIndices.map(i => new Vec3(bindT[i * 3], bindT[i * 3 + 1], bindT[i * 3 + 2]));
  let wasAuthored = false, exitFrom = null, exitPositions = null, exitElapsed = 0;
  const state = { yaw: 0, pitch: 0, roll: 0, torso: 0, breath: 0, shoulderL: 0, shoulderR: 0,
    elbowL: 0, elbowR: 0, wristL: 0, wristR: 0, speaking: 0 };

  function update(dt, input = {}) {
    dt = Number.isFinite(dt) ? clamp(dt, 0, 0.1) : 0;
    if (dt <= 0) return;
    clock += dt;
    if (exitFrom) exitElapsed += dt;
    waving = !!input.waving;
    authored = input.authored || (waving ? 'hello' : null);
    closeUp = !!input.closeUp;
    dance = Number.isFinite(input.dance) ? input.dance : -1;
    if (dance >= 0) dancePhase = dance;
    else if (danceAmount > 0) dancePhase += dt;
    // Fade both a scheduled finish and an interruption (e.g. entering a close
    // view). The breathing pose stays underneath so shoulders never snap.
    const danceTarget = !reducedMotion && !closeUp && !authored && dance >= 0
      ? clamp((4 - dance) / 0.45, 0, 1) : 0;
    danceAmount += (danceTarget - danceAmount) * (1 - Math.exp(-dt * (danceTarget > danceAmount ? 9 : 11)));
    if (danceTarget === 0 && danceAmount < 0.001) danceAmount = 0;
    const level = Number.isFinite(input.level) ? clamp(input.level, 0, 1) : 0;
    const active = level > 0.05 ? 1 : 0;
    speaking += (active - speaking) * (1 - Math.exp(-dt * (active ? 5 : 1.4)));
    slowLevel += (level - slowLevel) * (1 - Math.exp(-dt * 4));
    speechTime = speaking > 0.001 ? speechTime + dt : 0;
    // Change breathing speed continuously; changing a sine's denominator at
    // speech onset would abruptly snap the shoulders to another phase.
    breathPhase += dt * Math.PI * 2 / (4.3 - 0.75 * speaking);
    const ambient = reducedMotion ? 0 : closeUp ? 0.7 : 1;
    const response = reducedMotion ? 0.4 : 1;
    const swing = (period, offset = 0) => Math.sin(clock * Math.PI * 2 / period + offset);
    const weight = clamp(0.7 * swing(8.7, 0.1) + 0.3 * drift[3](clock * 0.13), -1, 1);
    const pointer = input.pointer;
    const px = Number.isFinite(pointer?.x) ? clamp(pointer.x, -1.8, 1.8) : 0;
    const py = Number.isFinite(pointer?.y) ? clamp(pointer.y, -1.4, 1.4) : 0;
    // With this +X-facing rig, positive yaw looks right on the website.
    const gazeYaw = px * 8;
    const gazePitch = py * 4.5;
    const attentionTilt = input.attention === 'thinking' ? 3.5 : input.attention === 'listening' ? -2.3 : 0;
    const moodTilt = input.mood === 'shy' ? 2.4 : input.mood === 'sad' ? -1.6 : 0;
    const moodPitch = input.mood === 'sad' ? -4 : input.mood === 'shy' ? -2 : 0;
    const nod = Number.isFinite(input.nod) && input.nod >= 0 && input.nod <= 0.6
      ? -5 * Math.sin(input.nod / 0.6 * Math.PI) : 0;
    const shake = Number.isFinite(input.shake) && input.shake >= 0 && input.shake <= 1.3
      ? 5 * Math.sin(input.shake * 11) * Math.sin(input.shake / 1.3 * Math.PI) : 0;
    const talkNod = -slowLevel * 2.4 + speaking * 1.15 * Math.sin(speechTime * Math.PI * 2 * 0.9);
    const talkTurn = speaking * 0.8 * Math.sin(speechTime * Math.PI * 2 * 0.23 + 1);
    const talkRoll = speaking * 1.1 * Math.sin(speechTime * Math.PI * 2 * 0.37);
    const targetYaw = gazeYaw + response * (shake + talkTurn)
      + ambient * (2.6 * swing(6.5) + 1.3 * drift[0](clock * 0.2));
    const targetPitch = gazePitch + response * (nod + talkNod + moodPitch)
      + ambient * (1.25 * swing(4.9, 0.3) + 0.7 * drift[1](clock * 0.17));
    const targetRoll = response * (attentionTilt + moodTilt + talkRoll)
      + ambient * (1.5 * swing(5.6, 0.6) + 0.8 * drift[2](clock * 0.15) + 0.7 * weight);
    state.yaw = clamp(follow.yaw.step(dt, targetYaw), -18, 18);
    state.pitch = clamp(follow.pitch.step(dt, targetPitch), -12, 10);
    state.roll = clamp(follow.roll.step(dt, targetRoll), -7, 7);
    state.torso = clamp(follow.torso.step(dt, ambient * weight * 1.2), -1.5, 1.5);
    state.breath = ambient * Math.sin(breathPhase);
    state.shoulderL = ambient * (0.9 * state.breath + 0.5 * drift[4](clock * 0.21));
    state.shoulderR = ambient * (0.8 * state.breath + 0.5 * drift[5](clock * 0.23));
    state.elbowL = ambient * (1.4 * swing(7.7, 0.8) + 0.7 * drift[6](clock * 0.19));
    state.elbowR = ambient * (1.4 * swing(8.1, 2.1) + 0.7 * drift[7](clock * 0.17));
    state.wristL = ambient * (1.8 * drift[4](clock * 0.29 + 7));
    state.wristR = ambient * (1.8 * drift[5](clock * 0.31 + 2));
    state.speaking = speaking;
  }

  function apply(pose, options = {}) {
    const wave = options.waving ?? waving;
    const clip = options.authored !== undefined ? options.authored : (wave ? 'hello' : authored);
    if (wasAuthored && !clip) {
      exitFrom = previousBody.map(q => q.clone());
      exitPositions = previousPositions.map(p => p.clone());
      exitElapsed = 0;
    } else if (clip) { exitFrom = null; exitPositions = null; }
    if (!clip) {
      pose.setToBind(bindT, bindR);
      // Separate chest, shoulder and arm phases keep her from swaying as one
      // rigid piece. Root, pelvis and every leg/foot transform stay unchanged.
      bend(pose, 'spine_01', state.torso * 0.45, 0, state.breath * 0.25);
      bend(pose, 'spine_03', state.torso * 0.55, state.yaw * 0.08, state.breath * 0.45);
      bend(pose, 'spine_05', -state.torso * 0.2, 0, -state.breath * 0.15);
      bend(pose, 'clavicle_l', -state.shoulderL * 0.4, 0, state.shoulderL * 0.25);
      bend(pose, 'clavicle_r', state.shoulderR * 0.4, 0, state.shoulderR * 0.25);
      // The source elbows already bend forwards. Adding positive pitch here
      // held both hands out in front of her hips; gently unfold them instead.
      bend(pose, 'upperarm_l', -26 - state.shoulderL * 0.7, 0, -1 + state.elbowL * 0.6);
      bend(pose, 'upperarm_r', 29 + state.shoulderR * 0.7, 0, 2 + state.elbowR * 0.6);
      bend(pose, 'lowerarm_l', 0, 0, -13 + state.elbowL);
      bend(pose, 'lowerarm_r', 0, 0, -17 + state.elbowR);
      bend(pose, 'hand_l', state.wristL, 0, -4 + state.wristL * 0.3);
      bend(pose, 'hand_r', -state.wristR, 0, 2 + state.wristR * 0.3);
      if (danceAmount > 0) {
        const beat = Math.sin(dancePhase * 7);
        bend(pose, 'spine_03', beat * 4 * danceAmount, 0, 0, true);
        blendArm(pose, 'upperarm_l', -15 + beat * 12, 20, danceAmount);
        blendArm(pose, 'upperarm_r', 15 + beat * 12, 20, danceAmount);
        blendArm(pose, 'lowerarm_l', 0, 35, danceAmount);
        blendArm(pose, 'lowerarm_r', 0, 35, danceAmount);
      }
    }
    // Leave the authored wave's arms and torso intact. The small overlay keeps
    // eye contact without pulling her head away from the original greeting.
    const amount = clip === 'nod' ? 0.12 : clip ? 0.25 : 1;
    bend(pose, 'neck_01', state.roll * 0.25 * amount, state.yaw * 0.3 * amount, state.pitch * 0.3 * amount, true);
    bend(pose, 'head', state.roll * 0.75 * amount, state.yaw * 0.7 * amount, state.pitch * 0.7 * amount, true);
    // The player's stop fade is replaced by our procedural idle, so explicitly
    // blend the final greeting pose into that idle. Do not low-pass the whole
    // skeleton every frame: doing so makes the authored wave sluggish and
    // would erase the fast eyelid/lip movement applied after this helper.
    const fraction = clamp(exitElapsed / 0.32, 0, 1);
    const blend = fraction * fraction * (3 - 2 * fraction);
    for (let slot = 0; slot < bodyIndices.length; slot++) {
      const q = pose.rotations[bodyIndices[slot]];
      const p = pose.positions[bodyIndices[slot]];
      if (exitFrom) q.slerp(exitFrom[slot], q, blend).normalize();
      if (exitPositions) p.lerp(exitPositions[slot], p, blend);
      previousBody[slot].copy(q);
      previousPositions[slot].copy(p);
    }
    if (exitFrom && fraction >= 1) { exitFrom = null; exitPositions = null; }
    wasAuthored = !!clip;
  }

  return { update, apply, get diagnostics() { return { ...state, clock, waving }; } };
}
