// Facial motion for the new character's native 441-bone rig. Apply after the
// body's pose smoothing: a quick blink must reach closed before reopening.
import { Quat, Vec3 } from 'playcanvas';

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };

export function createFaceSignals({ random = Math.random } = {}) {
  let clock = 0, blinkTime = -1, nextBlink = 1.4 + clamp(random()) * 1.4;
  let blinking = 0, mouth = 0, smile = 0.12, attention = 'idle';
  const randomGap = () => 2.6 + clamp(random()) * 3;
  return {
    update(dt, { level = 0, mood = 'neutral', attention: nextAttention = 'idle' } = {}) {
      dt = clamp(dt, 0, 0.1); clock += dt;
      if (nextAttention !== attention && nextAttention !== 'idle') nextBlink = Math.min(nextBlink, clock + 0.15);
      attention = nextAttention;
      if (blinkTime < 0 && clock >= nextBlink) blinkTime = 0;
      if (blinkTime >= 0) {
        blinkTime += dt;
        blinking = blinkTime < 0.075 ? smooth(blinkTime / 0.075)
          : blinkTime < 0.12 ? 1 : 1 - smooth((blinkTime - 0.12) / 0.14);
        if (blinkTime >= 0.26) { blinkTime = -1; blinking = 0; nextBlink = clock + randomGap(); }
      }
      const want = clamp((clamp(level) - 0.025) / 0.975) * 0.9;
      mouth += (want - mouth) * (1 - Math.exp(-dt * (want > mouth ? 24 : 13)));
      if (want === 0 && mouth < 0.002) mouth = 0;
      const targetSmile = ['happy', 'love', 'celebrate'].includes(mood) ? 0.65 : mood === 'wave' ? 0.35
        : ['sad', 'worried', 'jealous'].includes(mood) ? -0.2 : 0.12;
      smile += (targetSmile - smile) * (1 - Math.exp(-dt * 6));
    },
    blinkNow() { if (blinkTime < 0) blinkTime = 0; },
    get blink() { return blinking; },
    get mouthOpen() { return mouth; },
    get smile() { return smile; },
  };
}

export function createAgi1SplatFace(arm, options = {}) {
  const signals = createFaceSignals(options);
  const names = arm.rigBoneNames, { bindR, parents } = arm.skeleton;
  const indices = new Map(names.map((name, i) => [name, i]));
  const rest = [], inverseRest = [];
  const at = i => {
    if (rest[i]) return rest[i];
    const local = new Quat(bindR[i * 4], bindR[i * 4 + 1], bindR[i * 4 + 2], bindR[i * 4 + 3]);
    rest[i] = parents[i] < 0 ? local : new Quat().mul2(at(parents[i]), local);
    inverseRest[i] = rest[i].clone().invert(); return rest[i];
  };
  names.forEach((_, i) => at(i));
  const local = new Vec3(), delta = new Quat(), intermediate = new Quat(), localDelta = new Quat();
  const move = (pose, name, x, y, z) => {
    const i = indices.get(name); if (i === undefined) return;
    local.set(x, y, z);
    if (parents[i] >= 0) inverseRest[parents[i]].transformVector(local, local);
    pose.positions[i].add(local);
  };
  const rotate = (pose, name, degrees) => {
    const i = indices.get(name); if (i === undefined) return;
    delta.setFromAxisAngle(Vec3.FORWARD, -degrees);
    // Vec3.FORWARD is -Z in PlayCanvas; positive jaw rotation here is down.
    intermediate.mul2(inverseRest[i], delta);
    localDelta.mul2(intermediate, rest[i]);
    pose.rotations[i].mul(localDelta).normalize();
  };
  return {
    update: (dt, state) => signals.update(dt, state),
    blinkNow: () => signals.blinkNow(),
    apply(pose, override = {}) {
      const blink = clamp(override.blink ?? signals.blink);
      const mouth = clamp(override.mouth ?? signals.mouthOpen, 0, 0.9);
      const smile = clamp(override.smile ?? signals.smile, -0.25, 0.75);
      for (const side of ['L', 'R']) {
        const eye = indices.get(`FACIAL_${side}_EyeParallel`);
        if (eye !== undefined) {
          // Recede the iris into the head while the lids meet. Bone scale is
          // not used: the rigid palette used to strip it, and with her
          // proportions stretch on (2026-10-28) the engine keeps pose scale,
          // which squashed the iris into a sliver mid-blink.
          move(pose, `FACIAL_${side}_EyeParallel`, -0.05 * blink, 0, 0);
        }
        move(pose, `FACIAL_${side}_EyelidUpperA`, 0.003 * blink, -0.019 * blink, 0);
        move(pose, `FACIAL_${side}_EyelidUpperB`, 0.002 * blink, -0.013 * blink, 0);
        move(pose, `FACIAL_${side}_EyelidUpperFurrow`, 0, -0.006 * blink, 0);
        move(pose, `FACIAL_${side}_EyelidLowerA`, 0.002 * blink, 0.009 * blink, 0);
        move(pose, `FACIAL_${side}_EyelidLowerB`, 0, 0.004 * blink, 0);
        move(pose, `FACIAL_${side}_LipCorner`, 0, 0.0022 * smile - 0.0015 * mouth, (side === 'L' ? -1 : 1) * 0.001 * smile);
      }
      // Lower-lip bones and jaw are separate branches in this rig. Moving
      // only FACIAL_C_Jaw, as the old adapter did, leaves her lips closed.
      rotate(pose, 'FACIAL_C_Jaw', -10 * mouth);
      rotate(pose, 'FACIAL_C_LowerLipRotation', -12 * mouth);
      move(pose, 'FACIAL_C_MouthUpper', 0, 0.001 * mouth, 0);
    },
    get blink() { return signals.blink; },
    get mouthOpen() { return signals.mouthOpen; },
    get expression() { return { smile: signals.smile }; },
  };
}
