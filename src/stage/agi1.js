// AGI-1 on stage: a calm standing "idle" that faces you, a dance now and then, and reactions on top.
//
// Every frame the animation mixer sets her base pose (the idle, or the dance while she dances).
// Then this file adjusts a few bones on top of it: her right arm (to wave) and her neck and head
// (to look at you). The mixer only rewrites a bone when its animated value changes, and in the idle
// some of them never change, so each frame first puts those bones back to their clean pose
// (`beforeMixer`); otherwise the wave would stay on and the head turns would build up.
//
// Other parts of the site ask for a reaction with an event:
//   window.dispatchEvent(new CustomEvent('agi1:react', { detail: 'happy' }))
// Reactions: 'wave', 'happy' (= a tap), 'love', 'shy', 'nod' (a small nod while you talk to her, voice chat), and
// (2026-09-25) 'jealous' (a pout and a glance away: someone picked AGI-2 in the chat's model menu), 'neutral' (her calm face again), and her
// market moments: 'celebrate' ($AGI reached a new market cap step: a hop, a burst of hearts, a joyful face and, on the stage,
// a little dance) and 'sad' (a -20% day: a sad face, looking down for a few seconds); (2026-09-26) what she thinks of a
// ClankChecker scan: 'okay' (lower risk: a calm smile and a nod), 'hmm' (some risk: a pout and a tilt of her head) and
// 'worried' (high risk: a worried face, shaking her head slowly).
// Each one also sets her face's expression (see "her face's expressions" below).
//
// Talking and paying attention (2026-09-25, for her live view in the chat): her mouth opens and closes with her voice
// (setTalk, fed by src/lib/talk.js), her head nods a little while she talks, she blinks, and she tilts her head while she
// listens (you're typing) or thinks (her reply is on its way): setAttention. Her face (jaw, mouth, eyelids, cheeks) moves
// inside her shader (addFace), because her model has no face rig, and its expression follows the chat's moods.
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3(0, 0, 1);
const SIDE = new THREE.Vector3(1, 0, 0);

// Where her arm points while waving, relative to the way she faces: -X is her right, +Y up, +Z forward.
// "Up" is the real up (not her chest's), so the wave stays upright even when her body leans.
const UPPER_ARM_DIR = new THREE.Vector3(-0.75, 0.42, 0.35).normalize();   // out to her right, about 28° up
const FOREARM_DIR = new THREE.Vector3(-0.15, 1, 0.25).normalize();         // forearm up, hand near head height
// Seen up close (zoomed in, or in the chat's live view) she waves like on a video call: elbow a little below her shoulder,
// out to her side and forward, forearm up, her open hand beside her head at eye height, palm to you. (Until 2026-09-26 her
// elbow pointed at the camera and bent sideways: the owner saw a broken-looking arm, her hand cut off by the edge of the
// live view. The first fix put her elbow low and far out, which made her arm look extra long: "what did you do lol".)
const UPPER_ARM_NEAR = new THREE.Vector3(-0.6, -0.35, 0.72).normalize();
const FOREARM_NEAR = new THREE.Vector3(0.08, 1, 0.08).normalize();
const MAX_HEAD_TURN = 0.7; // radians (about 40°), so she never turns her head too far
const MAX_PALM_TURN = 0.9; // radians (about 50°): how far her forearm and wrist turn her palm toward you while she waves

// Her dance is performed turned about 35–60° to her right. While she dances, the whole model turns
// this much the other way, so she performs toward you.
const DANCE_TURN = 0.7;           // radians (about 40°)
const FIRST_DANCE_AFTER = 14;     // seconds after she arrives
const DANCE_GAP = [35, 55];       // seconds of idle between dances (random in this range)

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ---------- bone helpers (world space) ----------
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qc = new THREE.Quaternion();
const _va = new THREE.Vector3(), _vb = new THREE.Vector3(), _axis = new THREE.Vector3();

// Rotate a bone around a direction in the world (not its own tilted axes).
function rotateWorld(b, axis, angle) {
  if (!b || !angle) return;
  _qa.setFromAxisAngle(axis, angle);                                  // the turn, in world space
  b.parent.getWorldQuaternion(_qb);
  _qc.copy(_qb).invert().multiply(_qa).multiply(_qb);                  // the same turn, in the bone's own space
  b.quaternion.premultiply(_qc);
  b.updateMatrixWorld(true);
}
// A bone's direction in the world: its +Y axis points toward its child bone.
const boneDir = (b, out) => out.set(0, 1, 0).applyQuaternion(b.getWorldQuaternion(_qa));
// Turn a bone so its direction moves toward `to` (a world direction), by a fraction `amount`.
function aimBone(b, to, amount = 1, maxAngle = Math.PI) {
  if (!b || amount <= 0) return;
  const from = boneDir(b, _va);
  const angle = from.angleTo(to);
  _axis.crossVectors(from, to);
  if (angle < 1e-5 || _axis.lengthSq() < 1e-12) return;
  rotateWorld(b, _axis.normalize(), Math.min(angle, maxAngle) * amount);
}

// Her arm like a real arm (2026-09-26). aimBone only says where a bone points, not how it's turned around its own length,
// so a raised forearm could end up bent sideways at the elbow and twisted (up to ~55°), which looked broken up close. A real
// elbow is a hinge. These are her arm's own axes (in each bone's space), read from her rest pose (a T-pose, palms down,
// elbows bending forward): the axis her elbow bends around (world up in the T-pose) and the way her palm faces (down).
// → { arm, fore, palm } or null (another skeleton: the wave then uses aimBone alone)
function armAxes(root, bones) {
  let skinned = null;
  root.traverse((o) => { if (o.isSkinnedMesh && !skinned) skinned = o; });
  if (!skinned || bones.some((b) => !b)) return null;
  const { bones: all, boneInverses } = skinned.skeleton;
  const q = new THREE.Quaternion(), m = new THREE.Matrix4(), p = new THREE.Vector3(), s = new THREE.Vector3();
  const inBone = (b, world) => {                  // a direction of the rest pose, in the bone's own space, square to the bone
    const i = all.indexOf(b);
    if (i < 0) return null;
    m.copy(boneInverses[i]).invert().decompose(p, q, s);
    const v = world.clone().applyQuaternion(q.invert());
    v.y = 0;
    return v.lengthSq() > 0.25 ? v.normalize() : null;   // (clearly square to the bone, or this isn't the skeleton we know)
  };
  const [arm, fore, hand] = bones;
  const a = { arm: inBone(arm, UP), fore: inBone(fore, UP), palm: inBone(hand, new THREE.Vector3(0, -1, 0)) };
  return a.arm && a.fore && a.palm ? a : null;
}
// Turn a bone (by a fraction `amount`, from its pose now) so it points along `dir` with its own `axis` turned toward `side`
// (world directions; `axis` is in the bone's space, square to it).
const _m1 = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _x = new THREE.Vector3(), _z = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
function turnBone(b, dir, axis, side, amount = 1) {
  if (!b || amount <= 0) return;
  _x.copy(side).addScaledVector(dir, -side.dot(dir));
  if (_x.lengthSq() < 1e-8) return;
  _x.normalize();
  _m1.makeBasis(_x, dir, _z.crossVectors(_x, dir));                  // where we want its axes, in the world
  _m2.makeBasis(axis, UP, _z.crossVectors(axis, UP)).transpose();      // its own axes (the inverse)
  _q1.setFromRotationMatrix(_m1.multiply(_m2));
  b.getWorldQuaternion(_q2).slerp(_q1, amount);
  b.parent.getWorldQuaternion(_q1);
  b.quaternion.copy(_q1.invert().multiply(_q2));
  b.updateMatrixWorld(true);
}

// ---------- the idle ----------
// Her file has one animation (a 6-second dance), and her rest pose is a T-pose (arms straight out).
// This builds a calm, looping standing animation from the T-pose: arms relaxed at her sides,
// breathing, and a slight sway. It faces the same way as the file (+Z), which is toward the camera.
const IDLE_SECONDS = 8;

export function buildIdleClip(root) {
  let skinned = null;
  root.traverse((o) => { if (o.isSkinnedMesh && !skinned) skinned = o; });
  const bone = (name) => root.getObjectByName('mixamorig' + name);
  const need = ['Hips', 'Spine', 'Spine1', 'Spine2', 'LeftShoulder', 'RightShoulder', 'LeftArm', 'RightArm',
    'LeftForeArm', 'RightForeArm', 'LeftHand', 'RightHand', 'LeftLeg', 'RightUpLeg'];
  if (!skinned || need.some((n) => !bone(n))) return null;
  const bones = skinned.skeleton.bones;
  // Her hips' standing position as the file stores it. The dance moves the hips in this same space; the
  // skeleton's bind pose (below) has them about 0.8 units lower, which made her float ~0.7 m while dancing.
  const standingHips = bone('Hips').position.clone();

  skinned.skeleton.pose();                    // back to the rest pose (the T-pose)
  root.updateMatrixWorld(true);

  // 1. The standing pose. Directions are in her own space: +X is her left, +Y up, +Z forward.
  aimBone(bone('LeftShoulder'), _vb.set(1, -0.12, 0).normalize());
  aimBone(bone('RightShoulder'), _vb.set(-1, -0.12, 0).normalize());
  for (const [side, x] of [['Left', 1], ['Right', -1]]) {
    aimBone(bone(side + 'Arm'), _vb.set(0.3 * x, -0.95, 0.03).normalize());      // upper arm down, clear of her hips
    aimBone(bone(side + 'ForeArm'), _vb.set(0.22 * x, -0.94, 0.26).normalize());  // elbow softly bent
    aimBone(bone(side + 'Hand'), _vb.set(0.14 * x, -0.96, 0.24).normalize());
  }
  // Weight a little more on her right leg: hips tilt, left knee relaxed.
  rotateWorld(bone('Hips'), FORWARD, 0.035);
  rotateWorld(bone('Spine'), FORWARD, -0.03);
  rotateWorld(bone('RightUpLeg'), FORWARD, -0.035);
  rotateWorld(bone('LeftLeg'), SIDE, 0.12);
  const base = bones.map((b) => b.quaternion.clone());

  // 2. Small movements on top, sampled into a seamless 8-second loop.
  const times = [], values = bones.map(() => []);
  const KEYS = 32;
  for (let k = 0; k <= KEYS; k++) {
    const t = (k / KEYS) * IDLE_SECONDS;
    bones.forEach((b, i) => b.quaternion.copy(base[i]));
    root.updateMatrixWorld(true);
    const breath = Math.sin((2 * Math.PI * t) / 4);          // one breath every 4 s
    const sway = Math.sin((2 * Math.PI * t) / 8);            // one slow sway every 8 s
    const sway2 = Math.sin((2 * Math.PI * t) / 8 + 1.3);
    rotateWorld(bone('Hips'), FORWARD, 0.018 * sway);
    rotateWorld(bone('Hips'), UP, 0.03 * sway2);
    rotateWorld(bone('Spine'), FORWARD, -0.014 * sway);
    rotateWorld(bone('Spine1'), SIDE, -0.008 * breath);
    rotateWorld(bone('Spine2'), SIDE, -0.014 * breath);
    rotateWorld(bone('LeftShoulder'), FORWARD, 0.012 * breath);
    rotateWorld(bone('RightShoulder'), FORWARD, -0.012 * breath);
    rotateWorld(bone('LeftArm'), SIDE, 0.03 * Math.sin((2 * Math.PI * t) / 8 + 0.6));
    rotateWorld(bone('RightArm'), SIDE, 0.03 * Math.sin((2 * Math.PI * t) / 8 + 2.2));
    times.push(t);
    bones.forEach((b, i) => values[i].push(...b.quaternion.toArray()));
  }
  const tracks = bones.map((b, i) => new THREE.QuaternionKeyframeTrack(`${b.name}.quaternion`, times, values[i]));
  const hips = bone('Hips');
  tracks.push(new THREE.VectorKeyframeTrack(`${hips.name}.position`, [0], standingHips.toArray()));

  skinned.skeleton.pose();                    // leave her as we found her
  root.updateMatrixWorld(true);
  return new THREE.AnimationClip('agi1-idle', IDLE_SECONDS, tracks);
}

// ---------- her face: mouth, eyelids and expressions (2026-09-25) ----------
// Her model has no face rig (no jaw or eyelid bones, no morph targets): her lips and eyes are painted on its texture. So her
// face is made to move inside her own shader, which makes it part of the model wherever she's drawn, in two ways:
//  - her face's SHAPE really moves (vertex shader, before her skeleton poses her): her jaw and chin drop as her mouth opens,
//    the corners of her mouth go up when she smiles (her painted lips bend with them) or down and forward when she pouts,
//    and her cheeks lift a little with a smile;
//  - what the model doesn't have is PAINTED (fragment shader): the inside of her open mouth (dark, with her tongue),
//    eyelids (blinking, half-closed when she's shy, smiling eyes, "^^" when she's delighted) and a blush on her cheeks.
// Everything is placed in her model's own rest-pose coordinates (as stored in agi1.glb and agi1-phone.glb, which share
// them), so it stays in place in any pose. Measured by picking points on close-ups of her face (2026-09-25); the skin color
// was sampled from her texture right above her eyes (linear RGB). If the model file is ever replaced, measure them again.
const FACE = {
  // size: her open mouth's half-width and height, wide open; round: how round its bottom is (2 = half an ellipse); lip: how
  // far above the centre its top edge sits (over the line of her painted upper lip)
  mouth: { center: [-0.0005, 0.7172, 0.2005], up: [0, 0.8816, 0.472], size: [0.0105, 0.0085], corner: 0.016, round: 2.2, lip: 0.0009 },
  eyes: { right: [-0.06, 0.787, 0.1625], left: [0.0585, 0.7872, 0.163], size: [0.037, 0.0215], tilt: 0.17 },  // tilt: outer corners up
  cheeks: { right: [-0.064, 0.752, 0.166], left: [0.062, 0.753, 0.167], size: [0.021, 0.0125] },
  jaw: { top: 0.716, full: 0.704, bottom: 0.664, halfWidth: 0.062, drop: 0.0042 },       // rest-space heights; drop wide open
  smile: { lift: 0.0046, wide: 0.0013, cheek: 0.0016 },                                   // how far a full smile moves things
  skin: [0.93, 0.47, 0.31],
  skinLow: [0.93, 0.418, 0.292],       // the skin under her eyes is a little pinker (for lids painted from below)
  lash: [0.1, 0.035, 0.03],
  blush: [0.96, 0.25, 0.3],
  mouthInside: [[0.2, 0.045, 0.055], [0.045, 0.011, 0.015]],  // (linear RGB) bottom → top: a deep red, darker up top
  tongue: [0.46, 0.13, 0.14],
};
const f4 = (x) => x.toFixed(4);
const vec3 = (v) => `vec3( ${v.map((x) => x.toFixed(5)).join(', ')} )`;
const eyeAxes = (outward) => {        // along the eye (toward its outer corner) and up, in her face's plane
  const c = Math.cos(FACE.eyes.tilt), s = Math.sin(FACE.eyes.tilt);
  return [vec3([outward * c, s, 0]), vec3([-outward * s, c, 0])];
};
// her face's shape (vertex shader): p = a point of her model at rest → how far it moves right now
const FACE_MOVE = `
uniform float uMouthOpen, uSmile, uPout;
vec3 agi1FaceMove( vec3 p ) {
  vec3 m = vec3( 0.0 );
  float front = smoothstep( 0.115, 0.145, p.z );                     // only her face, never her hair or the back of her head
  // her jaw: chin and lower lip drop (and go back a little) as her mouth opens
  float jx = 1.0 - smoothstep( ${f4(FACE.jaw.halfWidth * 0.5)}, ${f4(FACE.jaw.halfWidth)}, abs( p.x ) );
  float jy = ( 1.0 - smoothstep( ${f4(FACE.jaw.full)}, ${f4(FACE.jaw.top)}, p.y ) ) * smoothstep( ${f4(FACE.jaw.bottom)}, ${f4(FACE.jaw.full - 0.012)}, p.y );
  m += vec3( 0.0, -1.0, -0.3 ) * ( ${f4(FACE.jaw.drop)} * uMouthOpen * front * jx * jy );
  // the corners of her mouth: up and a little outward for a smile, down and in (lips pushed out) for a pout
  vec3 d = p - ${vec3(FACE.mouth.center)};
  float cx = abs( d.x ) / ${f4(FACE.mouth.corner)};
  float lips = ( 1.0 - smoothstep( 1.15, 1.7, cx ) ) * ( 1.0 - smoothstep( 0.005, 0.013, abs( d.y ) ) ) * front;
  m.y += ( uSmile * ${f4(FACE.smile.lift)} - uPout * ${f4(FACE.smile.lift * 0.3)} ) * min( cx * cx, 1.3 ) * lips;
  m.x += sign( d.x ) * ( uSmile * ${f4(FACE.smile.wide)} - uPout * 0.0016 ) * min( cx, 1.0 ) * lips;
  m.z += uPout * 0.0018 * ( 1.0 - smoothstep( 0.6, 1.3, cx ) ) * lips;
  // her cheeks lift a little when she smiles
  vec2 cr = ( p.xy - ${vec3(FACE.cheeks.right)}.xy ) / vec2( 0.026, 0.018 );
  vec2 cl = ( p.xy - ${vec3(FACE.cheeks.left)}.xy ) / vec2( 0.026, 0.018 );
  float cheek = ( 1.0 - smoothstep( 0.2, 1.0, min( length( cr ), length( cl ) ) ) ) * front;
  m.y += max( uSmile, 0.0 ) * ${f4(FACE.smile.cheek)} * cheek;
  return m;
}`;
// her hair swinging (vertex shader, after her skeleton has posed her; 2026-09-26): rest = a point of her model at rest,
// p = where her skeleton put it (both in her model's own space) → how much further her hair moves. hairFree (per vertex,
// from hairFreedom below): 0 = her roots and everything that isn't hair, 1 = the free ends of her long hair.
const HAIR_MOVE = `
attribute float hairFree;
uniform vec3 uHairLag, uHairPivot;
uniform float uHairTwist, uHairFlare, uHairWind, uHairTime;
vec3 agi1Hair( vec3 rest, vec3 p ) {
  float f = hairFree;
  if ( f < 0.001 ) return vec3( 0.0 );
  float f2 = f * f;
  vec3 m = uHairLag * f2;                                     // her hair's weight lags behind when she moves
  vec2 d = p.xz - uHairPivot.xz;                              // turning: it swings around after her
  float a = uHairTwist * f, c = cos( a ), s = sin( a );
  m.xz += vec2( c * d.x + s * d.y, -s * d.x + c * d.y ) - d;
  m.xz += d / max( length( d ), 1e-4 ) * uHairFlare * f2;      // a fast spin: it flares out a little
  // hair lying on her chest or down her back never sinks into her: it can only lift away from her there
  m.z = mix( m.z, max( m.z, 0.0 ), smoothstep( 0.04, 0.1, rest.z ) );
  m.z = mix( m.z, min( m.z, 0.015 ), smoothstep( -0.04, -0.1, rest.z ) );
  // a very gentle breeze: slow waves running down her hair
  m.x += uHairWind * f2 * sin( uHairTime * 1.1 + rest.y * 8.0 + rest.z * 3.0 );
  m.z += uHairWind * 0.7 * f2 * sin( uHairTime * 0.8 + rest.y * 6.0 + rest.x * 4.0 + 1.3 );
  return m;
}`;
// Which parts of her are hair, and how freely each part swings (the attribute hairFree). Her hair is found the way
// tools/model/fix-hair-weights.mjs found it: its golden color in her texture, among the vertices that tool tied to her
// spine, neck and head. How free: nothing at her roots, her bangs or around her face, more and more further down her long
// hair, and a little for the locks that hang out from the sides of her head. → a BufferAttribute, or null (then her hair
// doesn't swing)
const HAIR = { roots: 0.64, ends: 0.25, skull: [0.005, 0.83, 0.04], out: [0.17, 0.3] };   // her model's rest-pose space
function hairFreedom(mesh) {
  try {
    const g = mesh.geometry, img = mesh.material?.map?.image;
    const P = g.attributes.position, U = g.attributes.uv, J = g.attributes.skinIndex, W = g.attributes.skinWeight;
    if (!img || !P || !U || !J || !W || typeof document === 'undefined') return null;
    const S = 256;                                            // her texture, small: enough to tell hair from skin and clothes
    const canvas = document.createElement('canvas');
    canvas.width = S; canvas.height = S;
    const cx = canvas.getContext('2d', { willReadFrequently: true });
    cx.drawImage(img, 0, 0, S, S);
    const px = cx.getImageData(0, 0, S, S).data;
    const chain = new Set(['Spine', 'Spine1', 'Spine2', 'Neck', 'Head']
      .map((n) => mesh.skeleton.bones.findIndex((b) => b.name === 'mixamorig' + n)).filter((i) => i >= 0));
    const soft = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    const golden = (r, gr, b) => {                            // hair is golden blonde; her skin is pinker, her top lavender
      const mx = Math.max(r, gr, b), d = mx - Math.min(r, gr, b);
      if (mx !== r || d <= 0) return 0;
      const hue = (60 * (gr - b)) / d;
      return soft(22, 27, hue) * (1 - soft(55, 62, hue)) * soft(0.1, 0.15, d / mx);
    };
    const [sx, sy, sz] = HAIR.skull;
    const out = new Float32Array(P.count);
    let any = 0;
    for (let v = 0; v < P.count; v++) {
      let onChain = 0;
      for (let k = 0; k < 4; k++) if (chain.has(J.getComponent(v, k))) onChain += W.getComponent(v, k);
      if (onChain < 0.9) continue;
      const x = P.getX(v), y = P.getY(v), z = P.getZ(v);
      const face = soft(0.05, 0.1, z) * (1 - soft(0.08, 0.13, Math.abs(x))) * soft(0.6, 0.66, y);   // her bangs stay put
      const free = Math.max(soft(HAIR.roots, HAIR.ends, y), 0.5 * soft(HAIR.out[0], HAIR.out[1], Math.hypot(x - sx, y - sy, z - sz))) * (1 - face);
      if (free <= 0) continue;
      const u = Math.min(S - 1, Math.max(0, Math.floor(U.getX(v) * S))), t = Math.min(S - 1, Math.max(0, Math.floor(U.getY(v) * S)));
      const i = (t * S + u) * 4;
      out[v] = free * golden(px[i], px[i + 1], px[i + 2]);
      if (out[v] > 0) any++;
    }
    return any ? new THREE.BufferAttribute(out, 1) : null;
  } catch {
    return null;
  }
}
// the painted parts (fragment shader)
const FACE_GLSL = `
varying vec3 vRestPos;
uniform float uMouthOpen, uBlink, uSmile, uPout, uSquint, uHappy, uBlush;
// one eye's lids → .x how much of this spot is lid (skin), .y her lash line, .z the upper lid's shadow on her eye,
// .w how low in the eye it is (the lower lid is painted a little pinker, like the skin under her eyes)
vec4 agi1Eyelid( vec3 d, vec3 along, vec3 up, float notSkin ) {
  float u = dot( d, along ) / ${f4(FACE.eyes.size[0])};
  float v = dot( d, up ) / ${f4(FACE.eyes.size[1])};
  float shape = pow( abs( u ), 3.0 ) + v * v;
  float aa = max( fwidth( shape ), 1e-4 ) * 1.5;
  float inEye = ( 1.0 - smoothstep( 1.0 - aa, 1.0 + aa, shape ) ) * step( abs( d.z ), 0.022 );
  float ea = max( fwidth( v ), 1e-4 ) * 1.5;
  float uu = 1.0 - u * u;
  float arch = -0.32 + 0.52 * uu;                                    // where her lids meet in "^^": higher in the middle
  // upper lid: down to a soft curve when she blinks (or rests half-closed), to the arch when she's delighted
  float top = mix( mix( 1.2, -0.3, uBlink ) - 0.15 * uBlink * uu, arch, uHappy );
  // lower lid: up with a smile (smiling eyes), to the arch when she's delighted
  float low = mix( mix( -1.3, -0.3, uSquint ) + 0.34 * uSquint * uu, arch, uHappy );
  float lidTop = smoothstep( top - ea, top + ea, v );
  float lidLow = 1.0 - smoothstep( low - ea, low + ea, v );
  float shut = smoothstep( 0.8, 0.95, max( uBlink, uHappy ) );
  float lid = max( max( lidTop, lidLow ), shut ) * inEye * notSkin;
  float lash = max(
    ( 1.0 - smoothstep( 0.0, 0.14 + ea, abs( v - top ) ) ) * smoothstep( 0.1, 0.35, uBlink ) * ( 1.0 - uHappy ),
    // "^^": a brush stroke along the arch, thicker in the middle
    ( 1.0 - smoothstep( 0.0, 0.06 + 0.15 * uu + ea, abs( v - arch ) ) ) * smoothstep( 0.35, 0.9, uHappy ) * smoothstep( 0.0, 0.25, uu ) );
  lash = max( lash, ( 1.0 - smoothstep( 0.0, 0.09 + ea, abs( v - low ) ) ) * smoothstep( 0.2, 0.7, uSquint ) * ( 1.0 - uHappy ) * 0.4 );
  float shade = ( 1.0 - lidTop ) * ( 1.0 - smoothstep( 0.0, 0.45, top - v ) ) * smoothstep( 0.05, 0.3, uBlink ) * ( 1.0 - shut );
  return vec4( lid, lash * inEye, shade * inEye, 1.0 - smoothstep( -0.7, 0.35, v ) );
}
// a soft blush on one cheek, and (really blushing) three little slanted strokes
vec2 agi1Blush( vec3 p, vec3 c ) {
  vec2 q = ( p.xy - c.xy ) / vec2( ${f4(FACE.cheeks.size[0])}, ${f4(FACE.cheeks.size[1])} );
  float near = step( abs( p.z - c.z ), 0.03 );
  float soft = exp( -2.2 * dot( q, q ) ) * near;
  float strokes = 0.0;
  for ( int i = -1; i <= 1; i++ ) {
    float dx = q.x - float( i ) * 0.45 - 0.5 * q.y;
    float w = max( fwidth( dx ), 1e-4 ) * 1.2 + 0.04;
    strokes = max( strokes, ( 1.0 - smoothstep( 0.0, w, abs( dx ) ) ) * ( 1.0 - smoothstep( 0.28, 0.4, abs( q.y ) ) ) );
  }
  return vec2( soft, strokes * near );
}`;
const FACE_PAINT = `
float agi1Lid = 0.0, agi1Mouth = 0.0;
// only where the picture isn't skin already (her eyes, lashes), so there's no visible patch around them
float agi1SkinLike = 1.0 - smoothstep( 0.06, 0.2, distance( diffuseColor.rgb, ${vec3(FACE.skin)} ) );
if ( uBlink > 0.004 || uSquint > 0.004 || uHappy > 0.004 ) {
  float notSkin = smoothstep( 0.05, 0.16, distance( diffuseColor.rgb, ${vec3(FACE.skin)} ) );
  vec4 er = agi1Eyelid( vRestPos - ${vec3(FACE.eyes.right)}, ${eyeAxes(-1).join(', ')}, notSkin );
  vec4 el = agi1Eyelid( vRestPos - ${vec3(FACE.eyes.left)}, ${eyeAxes(1).join(', ')}, notSkin );
  vec4 eyes = er.x >= el.x ? vec4( max( er.xyz, el.xyz ), er.w ) : vec4( max( er.xyz, el.xyz ), el.w );
  agi1Lid = eyes.x;
  diffuseColor.rgb *= 1.0 - 0.3 * eyes.z;
  diffuseColor.rgb = mix( diffuseColor.rgb, mix( ${vec3(FACE.skin)}, ${vec3(FACE.skinLow)}, eyes.w ), eyes.x );
  diffuseColor.rgb = mix( diffuseColor.rgb, ${vec3(FACE.lash)}, eyes.y * 0.92 );
}
if ( uBlush > 0.004 ) {
  vec2 b = max( agi1Blush( vRestPos, ${vec3(FACE.cheeks.right)} ), agi1Blush( vRestPos, ${vec3(FACE.cheeks.left)} ) );
  float onSkin = max( agi1SkinLike, agi1Lid );
  diffuseColor.rgb = mix( diffuseColor.rgb, ${vec3(FACE.blush)}, b.x * 0.45 * uBlush * onSkin );
  diffuseColor.rgb = mix( diffuseColor.rgb, ${vec3(FACE.blush.map((x) => x * 0.72))}, b.y * 0.6 * smoothstep( 0.55, 0.95, uBlush ) * onSkin );
}
if ( uMouthOpen > 0.004 ) {
  // her open mouth (2026-09-26, redrawn after the owner: "this isn't natural at all"): a soft, rounded anime mouth that
  // opens below her upper lip: a gentle arch on top, round below. It gets taller quickly and wider slowly as she opens it
  // (small and round for soft sounds, wider when she's loud), wider with a smile, narrower with a pout. Dark red inside,
  // her tongue at the bottom when it's open wide. No teeth (at this size they were a jagged white line).
  vec3 d = vRestPos - ${vec3(FACE.mouth.center)};
  vec3 up = ${vec3(FACE.mouth.up)};
  float s = max( uSmile, 0.0 );
  float o = uMouthOpen;
  float w = ${f4(FACE.mouth.size[0])} * ( 0.55 + 0.45 * o ) * ( 1.0 + 0.2 * s ) * ( 1.0 - 0.35 * uPout );
  float h = ${f4(FACE.mouth.size[1])} * sqrt( o ) * ( 1.0 + 0.15 * uPout );
  float u = d.x / w;
  float y = dot( d, up );
  float lip = ${f4(FACE.mouth.lip)} * smoothstep( 0.0, 0.25, o );    // just over the line of her painted upper lip
  float yTop = lip + h * 0.08 * ( 1.0 - u * u );                        // her upper lip: a soft arch
  float yBot = lip - h * sqrt( max( 1.0 - pow( abs( u ), ${f4(FACE.mouth.round)} ), 0.0 ) );   // round below
  float depth = dot( d, cross( vec3( 1.0, 0.0, 0.0 ), up ) );            // in front of or behind her lips
  float aa = max( fwidth( y ), 1e-5 ) * 1.1;
  float inside = smoothstep( -aa, aa, min( yTop - y, y - yBot ) ) * ( 1.0 - smoothstep( 0.96, 1.0, abs( u ) ) )
    * step( -0.02, depth ) * step( depth, 0.02 );
  float t = clamp( ( y - yBot ) / max( yTop - yBot, 1e-5 ), 0.0, 1.0 );   // 0 at the bottom, 1 at the top
  vec3 inner = mix( ${vec3(FACE.mouthInside[0])}, ${vec3(FACE.mouthInside[1])}, smoothstep( 0.05, 0.8, t ) );
  vec2 tq = vec2( u / 0.62, ( y - yBot - 0.18 * h ) / ( 0.3 * h + 1e-6 ) );   // her tongue: a soft oval at the bottom
  inner = mix( inner, ${vec3(FACE.tongue)}, ( 1.0 - smoothstep( 0.5, 1.0, length( tq ) ) ) * smoothstep( 0.3, 0.75, o ) * 0.85 );
  diffuseColor.rgb = mix( diffuseColor.rgb, inner, inside );
  agi1Mouth = inside;
}`;

// Adds her moving face (and, since 2026-09-26, her swinging hair) to her material → { setMouth(0..1), setBlink(0..1),
// setExpression({...}), setHair(...), hasHair }, or null if the model isn't as expected. setExpression: smile (-1..1: a
// pout's corners down … a big smile), pout, squint (smiling eyes), happy ("^^"), blush (all 0..1).
export function addFace(root) {
  let mesh = null;
  root.traverse((o) => { if (o.isSkinnedMesh && !mesh) mesh = o; });
  const material = mesh?.material;
  if (!material || Array.isArray(material)) return null;
  const hairFree = hairFreedom(mesh);
  if (hairFree) mesh.geometry.setAttribute('hairFree', hairFree);
  const uniforms = { uMouthOpen: { value: 0 }, uBlink: { value: 0 }, uSmile: { value: 0 }, uPout: { value: 0 }, uSquint: { value: 0 },
    uHappy: { value: 0 }, uBlush: { value: 0 },
    uHairLag: { value: new THREE.Vector3() }, uHairPivot: { value: new THREE.Vector3() }, uHairTwist: { value: 0 }, uHairFlare: { value: 0 },
    uHairWind: { value: 0 }, uHairTime: { value: 0 } };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vRestPos;${FACE_MOVE}${HAIR_MOVE}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRestPos = vec3( position );\ntransformed += agi1FaceMove( position );')
      .replace('#include <skinning_vertex>', '#include <skinning_vertex>\ntransformed += agi1Hair( position, transformed );');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>${FACE_GLSL}`)
      .replace('#include <map_fragment>', `#include <map_fragment>${FACE_PAINT}`)
      // under a closed lid, the eye's bumps in her normal map would still show: smooth them away there
      // inside her open mouth: no shine and no bumps from her lips' texture (they showed as a light line along its edge)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix( roughnessFactor, 1.0, agi1Mouth );')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize( mix( normal, nonPerturbedNormal, max( agi1Lid, agi1Mouth ) ) );');
  };
  material.customProgramCacheKey = () => 'agi1-face-v5';
  const clamp = (x, lo = 0) => Math.min(1, Math.max(lo, Number(x) || 0));
  const u = uniforms;
  const toModel = new THREE.Matrix4(), toModel3 = new THREE.Matrix3();
  return {
    hasHair: Boolean(hairFree),
    // her hair this frame (createAgi1's applyHair): lag = how far her hair's weight trails behind (world, meters), twist =
    // how far it trails when she turns (radians), flare = a fast spin (0..1), pivot = her neck (world), wind 0..1
    setHair(lag, twist, flare, pivot, time, wind) {
      mesh.updateWorldMatrix(true, false);
      toModel.copy(mesh.matrixWorld).invert();
      u.uHairLag.value.copy(lag).applyMatrix3(toModel3.setFromMatrix4(toModel));
      u.uHairPivot.value.copy(pivot).applyMatrix4(toModel);
      u.uHairTwist.value = twist;
      u.uHairFlare.value = flare * 0.035;                    // (her model's own units: about 3 cm at the ends of her hair)
      u.uHairWind.value = wind * 0.004;
      u.uHairTime.value = time;
    },
    setMouth(open) { u.uMouthOpen.value = clamp(open); },
    setBlink(amount) { u.uBlink.value = clamp(amount); },
    setExpression({ smile = 0, pout = 0, squint = 0, happy = 0, blush = 0 } = {}) {
      u.uSmile.value = clamp(smile, -1);
      u.uPout.value = clamp(pout);
      u.uSquint.value = clamp(squint);
      u.uHappy.value = clamp(happy);
      u.uBlush.value = clamp(blush);
    },
    get mouth() { return u.uMouthOpen.value; },
    get blink() { return u.uBlink.value; },
    get expression() {
      return { smile: u.uSmile.value, pout: u.uPout.value, squint: u.uSquint.value, happy: u.uHappy.value, blush: u.uBlush.value };
    },
  };
}

export function createAgi1(model, { camera, effects, reducedMotion = false, onGlow = () => {} }) {
  const { root, fx, mixer, idle, dance, danceClip, face } = model;
  const bone = (name) => root.getObjectByName(name);
  const B = {
    chest: bone('mixamorigSpine2'), spine: bone('mixamorigSpine1'), hips: bone('mixamorigHips'),
    neck: bone('mixamorigNeck'), head: bone('mixamorigHead'), headFront: bone('headfront'),
    rArm: bone('mixamorigRightArm'), rFore: bone('mixamorigRightForeArm'), rHand: bone('mixamorigRightHand'),
  };
  const missing = Object.entries(B).filter(([, b]) => !b).map(([k]) => k);
  if (missing.length) console.warn('[agi1] bones not found, some reactions are off:', missing);

  // A turntable between the reactions group and the model: it turns her toward you while she dances.
  const turn = new THREE.Group();
  fx.add(turn);
  turn.add(root);

  if (dance) {
    dance.setLoop(THREE.LoopOnce, 1);
    dance.clampWhenFinished = false;
  }

  const vA = new THREE.Vector3(), vB = new THREE.Vector3();
  const vFace = new THREE.Vector3(), vWant = new THREE.Vector3();
  const qChest = new THREE.Quaternion(), qFacing = new THREE.Quaternion();

  const look = { target: new THREE.Vector3(), smoothed: camera.position.clone(), awayUntil: 0, away: new THREE.Vector3(), atViewerUntil: 0 };
  const wave = { active: false, t: 0, near: 0 };        // near: 0 = the big wave, 1 = the close-up one (eased between)
  const vUpper = new THREE.Vector3(), vFore = new THREE.Vector3(), vHand = new THREE.Vector3(), vHinge = new THREE.Vector3();
  const vPalm = new THREE.Vector3(), vToYou = new THREE.Vector3();
  const arm = armAxes(root, [B.rArm, B.rFore, B.rHand]);   // her elbow's hinge and her palm (null: another skeleton)
  let hopT = -1, spinT = -1, clock = 0;

  // The bones this file turns by hand, and their clean pose (as the animation left them, before our changes).
  const handTurned = [B.rArm, B.rFore, B.rHand, B.neck, B.head].filter(Boolean);
  const cleanPose = handTurned.map((b) => b.quaternion.clone());
  function beforeMixer() { handTurned.forEach((b, i) => b.quaternion.copy(cleanPose[i])); }
  function saveCleanPose() { handTurned.forEach((b, i) => cleanPose[i].copy(b.quaternion)); }
  let dancing = false, nextDance = FIRST_DANCE_AFTER;
  let closeUp = false;          // zoomed in on her, or in the chat's live view: no surprise dances, and a smaller wave
  // talking (src/lib/talk.js → setTalk) and what she's paying attention to (the chat → setAttention)
  const talk = { level: 0, open: 0, slow: 0, env: 0, t: 0 };
  let attention = 'idle', tilt = 0, nodT = -1, shakeT = -1, hmmT = -1;

  // ---------- her face's expressions (2026-09-25) ----------
  // Each mood from the chat has a face. It lasts while she says that reply (plus a few seconds) and then eases back to her
  // resting face, which follows what she's doing: a small smile while you type, a thoughtful look while she thinks, a happy
  // one while she dances. smile: -1..1 (corners down … a big smile); lids: her upper lids resting part-way down;
  // grin: her mouth a little open even when she isn't talking; pulse: seconds of "^^" (eyes shut with joy) at the start
  // (for love, once her spin is over, so you see it).
  const FACES = {
    calm: { smile: 0.15 },
    listening: { smile: 0.32, squint: 0.1 },
    thinking: { smile: -0.08, pout: 0.25, squint: 0.2, lids: 0.22 },
    dancing: { smile: 0.75, squint: 0.35, grin: 0.2 },
    neutral: { smile: 0.15 },
    happy: { smile: 1, squint: 0.55, blush: 0.25, grin: 0.35, pulse: 1.1 },
    love: { smile: 0.7, squint: 0.3, blush: 0.9, lids: 0.3, grin: 0.12, pulse: 0.9, after: 0.8 },
    shy: { smile: 0.3, blush: 1, lids: 0.5 },
    wave: { smile: 0.85, squint: 0.3, grin: 0.28, pulse: 0.7 },
    jealous: { smile: -0.5, pout: 1, squint: 0.25, lids: 0.25, blush: 0.3 },
    // market moments (2026-09-25): a new $200K step of $AGI's market cap, or a -20% day
    celebrate: { smile: 1, squint: 0.6, blush: 0.4, grin: 0.45, pulse: 1.4 },
    sad: { smile: -0.9, pout: 0.35, lids: 0.42 },
    // ClankChecker (2026-09-26): what she thinks of a coin's scan: lower risk (a calm smile and a nod), some risk (a pout and a
    // tilt of her head: "hmm"), high risk (worried, shaking her head)
    okay: { smile: 0.55, squint: 0.2 },
    hmm: { smile: 0.05, pout: 0.55, squint: 0.3, lids: 0.12 },
    worried: { smile: -0.55, pout: 0.2, lids: 0.18 },
  };
  const expr = { smile: 0.15, pout: 0, squint: 0, blush: 0, lids: 0, grin: 0, happy: 0, mood: null, until: 0, pulseFrom: 0, pulseUntil: 0 };
  function setMood(mood) {
    const f = FACES[mood];
    if (!f) return;
    expr.mood = mood === 'neutral' ? null : mood;
    expr.until = clock + 4.5;
    expr.pulseFrom = clock + (reducedMotion ? 0 : f.after || 0);
    expr.pulseUntil = f.pulse ? expr.pulseFrom + f.pulse : 0;
  }
  function applyExpression(dt) {
    if (expr.mood && talk.env > 0.05) expr.until = Math.max(expr.until, clock + 2.5);   // it holds while she's talking
    if (expr.mood && clock >= expr.until) expr.mood = null;
    const rest = dancing ? 'dancing' : attention === 'listening' || attention === 'thinking' ? attention : 'calm';
    const want = FACES[expr.mood || rest];
    for (const key of ['smile', 'pout', 'squint', 'blush', 'lids', 'grin']) {
      const to = want[key] || 0;
      // quick to show a feeling (a quarter of a second), slower to let it go
      expr[key] += (to - expr[key]) * (1 - Math.exp(-dt * (Math.abs(to) > Math.abs(expr[key]) ? 9 : 2.5)));
    }
    expr.happy += ((clock >= expr.pulseFrom && clock < expr.pulseUntil ? 1 : 0) - expr.happy) * (1 - Math.exp(-dt * 14));
    face?.setExpression(expr);
    face?.setMouth(Math.max(talk.open, expr.grin));   // talking, or a little open smile
  }

  // ---------- dancing now and then ----------
  function startDance() {
    if (!dance || !idle || dancing || wave.active) return;
    dancing = true;
    dance.reset();              // from the start, full weight
    dance.play();
    idle.crossFadeTo(dance, 0.6, false);
  }
  function endDance(seconds) {
    if (!dancing) return;
    dancing = false;
    idle.enabled = true;        // the idle was switched off when it faded out
    idle.setEffectiveWeight(1);
    dance.crossFadeTo(idle, seconds, false);
    nextDance = clock + DANCE_GAP[0] + Math.random() * (DANCE_GAP[1] - DANCE_GAP[0]);
  }
  function updateDance(dt) {
    if (dancing && dance.time >= danceClip.duration - 0.75) endDance(0.7);   // blend back before it ends
    if (!dancing && !wave.active && !reducedMotion && clock >= nextDance) {
      if (closeUp) nextDance = clock + 6;          // try again a bit later
      else startDance();
    }
    const want = dancing ? DANCE_TURN : 0;
    turn.rotation.y += (want - turn.rotation.y) * (1 - Math.exp(-dt * 2.5));
  }

  // ---------- waving (on top of the idle) ----------
  function startWave() {
    if (wave.active || !B.rArm) return;
    endDance(0.4);
    wave.active = true;
    wave.t = 0;
    wave.near = closeUp ? 1 : 0;
    look.atViewerUntil = clock + 3;
  }

  function applyWave(dt) {
    if (!wave.active) return;
    wave.t += dt;
    const t = wave.t;
    if (t > 3.1) { wave.active = false; return; }
    const w = smoothstep(0.15, 0.6, t) * (1 - smoothstep(2.3, 2.85, t));
    if (w <= 0) return;

    // Which way is she facing? Take her chest's forward direction, but keep only the left/right turn.
    B.chest.getWorldQuaternion(qChest);
    vA.set(0, 0, 1).applyQuaternion(qChest);
    qFacing.setFromAxisAngle(UP, Math.atan2(vA.x, vA.z));
    // Side-to-side swing, 1.6 waves per second. Mostly outward (positive), so her hand never covers her face (smaller
    // up close, so her hand stays in the picture).
    // (a wave that starts on the stage and moves into the chat's live view glides from the big wave to the close-up one)
    wave.near += ((closeUp ? 1 : 0) - wave.near) * (1 - Math.exp(-dt * 5));
    const n = wave.near, beat = Math.sin(t * Math.PI * 2 * 1.6);
    const swing = THREE.MathUtils.lerp(0.12, 0.02, n) + beat * THREE.MathUtils.lerp(0.26, 0.15, n);
    vUpper.lerpVectors(UPPER_ARM_DIR, UPPER_ARM_NEAR, n).normalize().applyQuaternion(qFacing);
    vFore.lerpVectors(FOREARM_DIR, FOREARM_NEAR, n).normalize();
    vHand.copy(vFore).applyAxisAngle(FORWARD, swing * 1.3).applyQuaternion(qFacing);   // her hand follows a little further
    vFore.applyAxisAngle(FORWARD, swing).applyQuaternion(qFacing);
    if (arm) {
      // Like a real arm: the elbow bends around its hinge (so the upper arm turns a little with each swing, as a shoulder
      // does when you wave), and her palm turns toward you the way a forearm turns: mostly at the wrist, a little along the
      // forearm, never at the elbow itself, and at most about 50°.
      vHinge.crossVectors(vUpper, vFore).normalize();
      vPalm.copy(vHinge).negate();                                    // her palm with no turn at all
      vToYou.set(0, 0, 1).applyQuaternion(qFacing);                   // toward you
      vToYou.addScaledVector(vFore, -vToYou.dot(vFore));
      let twist = 0;
      if (vToYou.lengthSq() > 1e-6) {
        vToYou.normalize();
        twist = THREE.MathUtils.clamp(Math.atan2(vFore.dot(vB.crossVectors(vPalm, vToYou)), vPalm.dot(vToYou)), -MAX_PALM_TURN, MAX_PALM_TURN);
      }
      turnBone(B.rArm, vUpper, arm.arm, vHinge, w);
      turnBone(B.rFore, vFore, arm.fore, vB.copy(vHinge).applyAxisAngle(vFore, twist * 0.3), w);
      turnBone(B.rHand, vHand, arm.palm, vPalm.applyAxisAngle(vFore, twist), w);
    } else {
      aimBone(B.rArm, vUpper, w);
      aimBone(B.rFore, vFore, w);
      aimBone(B.rHand, vHand, w);
    }
  }

  // ---------- looking at you ----------
  // pointer: {x, y} in the canvas's -1..1 coordinates, or null (then she looks at the camera = you).
  function setPointer(pointer) {
    if (!pointer) { look.target.copy(camera.position); return; }
    vA.set(THREE.MathUtils.clamp(pointer.x, -3, 3), THREE.MathUtils.clamp(pointer.y, -3, 3), 0.5)
      .unproject(camera).sub(camera.position).normalize();
    const dist = camera.position.distanceTo(B.head.getWorldPosition(vB)) * 0.75;
    look.target.copy(camera.position).addScaledVector(vA, dist);
  }

  function applyLook(dt) {
    if (!B.head || !B.headFront || !B.neck) return;
    let target = look.target;
    if (clock < look.awayUntil) target = look.away;                  // shy: look down and away
    else if (clock < look.atViewerUntil) target = camera.position;   // waving or tapped: look at you
    look.smoothed.lerp(target, 1 - Math.exp(-dt * 6));
    // She only looks at things in front of her. Toward her back (someone dragged the camera behind her), the
    // head would bend backwards and throw her hair around, so the look fades out between about 100° and 135°.
    B.chest.getWorldQuaternion(qChest);
    vA.set(0, 0, 1).applyQuaternion(qChest).setY(0).normalize();        // the way her body faces, level
    vWant.copy(look.smoothed).sub(B.head.getWorldPosition(vB)).setY(0).normalize();
    const behind = smoothstep(1.75, 2.35, vA.angleTo(vWant));
    // she looks more decidedly while waving, right after a tap, and while she listens or thinks (the chat)
    const intent = wave.active || clock < look.atViewerUntil ? 0.95 : attention === 'thinking' ? 0.85 : attention === 'listening' ? 0.7 : 0.6;
    const weight = intent * (1 - behind);
    if (weight < 0.01) return;

    for (const [b, share] of [[B.neck, 0.35], [B.head, 0.65]]) {
      B.head.getWorldPosition(vA);
      B.headFront.getWorldPosition(vFace).sub(vA).normalize();       // where her face points now
      vWant.copy(look.smoothed).sub(vA).normalize();                 // where we'd like it to point
      aimTurn(b, vFace, vWant, share * weight);
    }
  }
  // Like aimBone, but for "face direction" vectors that aren't the bone's own axis.
  function aimTurn(b, from, to, amount) {
    const angle = from.angleTo(to);
    const axis = vB.crossVectors(from, to);
    if (angle < 1e-5 || axis.lengthSq() < 1e-12) return;
    rotateWorld(b, axis.normalize(), Math.min(angle, MAX_HEAD_TURN) * amount);
  }

  // ---------- blinking (2026-09-25) ----------
  // every 2.5 to 6 seconds (now and then twice in a row), and when she starts thinking or listening
  const blink = { t: -1, next: 1.5 + Math.random() * 2 };
  function applyBlink(dt) {
    if (blink.t < 0 && clock >= blink.next) blink.t = 0;
    let amount = 0;
    if (blink.t >= 0) {
      blink.t += dt;
      const t = blink.t;                    // shut in 70 ms, stay 50 ms, open in 120 ms
      amount = t < 0.07 ? t / 0.07 : t < 0.12 ? 1 : Math.max(0, 1 - (t - 0.12) / 0.12);
      if (t >= 0.24) { blink.t = -1; blink.next = clock + (Math.random() < 0.15 ? 0.2 : 2.5 + Math.random() * 3.5); }
    }
    face?.setBlink(Math.max(amount, expr.lids));
  }

  // ---------- talking, listening, thinking (2026-09-25) ----------
  const vFacing = new THREE.Vector3(), vSide = new THREE.Vector3();
  function applyTalk(dt) {
    // her mouth: opens quickly on each syllable and closes a little slower, like a real one, so between quick syllables it
    // doesn't snap shut (2026-09-26: it used to open all the way and shut about five times a second, like a puppet's)
    const want = Math.min(0.9, Math.max(0, (talk.level - 0.05) * 1.15));
    talk.open += (want - talk.open) * (1 - Math.exp(-dt * (want > talk.open ? 20 : 9)));
    if (want === 0 && talk.open < 0.01) talk.open = 0;
    if (!B.head || !B.headFront) return;
    // her head: small nods on the louder words, a slow sway while she talks, and a tilt while she listens or thinks
    const on = talk.level > 0.05 ? 1 : 0;
    talk.env += (on - talk.env) * (1 - Math.exp(-dt * (on ? 5 : 1.4)));
    talk.slow += (talk.level - talk.slow) * (1 - Math.exp(-dt * 4));
    talk.t = talk.env > 0.001 ? talk.t + dt : 0;
    const wantTilt = attention === 'thinking' ? 0.12 : attention === 'listening' ? -0.07 : 0;
    tilt += (wantTilt - tilt) * (1 - Math.exp(-dt * 3.5));
    const k = reducedMotion ? 0.5 : 1;
    const wave1 = Math.sin(talk.t * Math.PI * 2 * 0.9), wave2 = Math.sin(talk.t * Math.PI * 2 * 0.37), wave3 = Math.sin(talk.t * Math.PI * 2 * 0.23 + 1);
    let listenNod = 0;                             // 'nod': a small "mm-hm" while you talk to her
    if (nodT >= 0) {
      nodT += dt;
      if (nodT >= 0.5) nodT = -1; else listenNod = Math.sin((nodT / 0.5) * Math.PI) * 0.09;
    }
    let shake = 0, hmmTilt = 0;                    // ClankChecker: 'worried' shakes her head slowly, 'hmm' tilts it
    if (shakeT >= 0) {
      shakeT += dt;
      if (shakeT >= 1.3) shakeT = -1; else shake = Math.sin(shakeT * Math.PI * 2 * 1.5) * 0.11 * Math.sin((shakeT / 1.3) * Math.PI);
    }
    if (hmmT >= 0) {
      hmmT += dt;
      if (hmmT >= 1.9) hmmT = -1; else hmmTilt = 0.13 * Math.sin((hmmT / 1.9) * Math.PI);
    }
    const nod = k * (0.05 * talk.slow + talk.env * 0.015 * wave1 + listenNod);
    const roll = k * (tilt + hmmTilt + talk.env * 0.03 * wave2);
    const turnBy = k * (talk.env * 0.03 * wave3 + shake);
    if (Math.abs(nod) + Math.abs(roll) + Math.abs(turnBy) < 1e-4) return;
    // her face's own directions: forward (from her head to the front of her face, kept level) and sideways
    B.head.getWorldPosition(vA);
    vFacing.copy(B.headFront.getWorldPosition(vB)).sub(vA).setY(0);
    if (vFacing.lengthSq() < 1e-8) return;
    vFacing.normalize();
    vSide.crossVectors(UP, vFacing);
    rotateWorld(B.head, vSide, nod);          // positive: chin down (a nod)
    rotateWorld(B.head, vFacing, roll);       // head tilted to one side
    rotateWorld(B.head, UP, turnBy);          // a little turn
  }

  // ---------- body moves (hop, spin), applied to her whole model ----------
  function applyBody(dt) {
    let y = 0, spinY = 0, squash = 0;
    if (hopT >= 0) {
      hopT += dt;
      const p = hopT / 0.62;
      if (p >= 1) hopT = -1;
      else { y = Math.sin(p * Math.PI) * 0.13; squash = Math.sin(p * Math.PI * 2) * 0.035; }
    }
    if (spinT >= 0) {
      spinT += dt;
      const p = Math.min(1, spinT / 0.85);
      spinY = (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2) * Math.PI * 2;
      if (p >= 1) spinT = -1;
    }
    fx.position.y = y;
    fx.rotation.y = spinY;
    fx.scale.set(1 + squash * 0.5, 1 - squash, 1 + squash * 0.5);
  }

  // ---------- reactions ----------
  const worldPos = (b, lift = 0) => b.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, lift, 0));

  function react(type) {
    setMood(type === 'tap' ? 'happy' : type);        // her face (src/chat/chat.js sends every reply's mood)
    switch (type) {
      case 'neutral':                                // her face only
        break;
      case 'wave':
        startWave();
        break;
      case 'tap':
      case 'happy':
        if (!reducedMotion && hopT < 0) hopT = 0;
        effects.spawnHearts(worldPos(B.chest, 0.1), { count: 9 });
        look.atViewerUntil = clock + 1.6;
        break;
      case 'love':
        if (!reducedMotion && spinT < 0) spinT = 0;
        effects.spawnHearts(worldPos(B.head, 0.05), { count: 18, spread: 0.6, size: 0.12, rise: 1 });
        look.atViewerUntil = clock + 2.2;
        onGlow(0xff5c8a, 1.2);
        break;
      case 'shy': {
        // Look down and to the side of wherever you (the camera) are.
        const head = worldPos(B.head);
        const toYou = camera.position.clone().sub(head).setY(0).normalize();
        const side = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), toYou);
        look.away.copy(head).addScaledVector(toYou, 0.6).addScaledVector(side, 0.7).add(new THREE.Vector3(0, -0.8, 0));
        look.awayUntil = clock + 2.4;
        effects.spawnHearts(worldPos(B.head, 0.1), { count: 4, spread: 0.25, size: 0.07, rise: 0.5 });
        onGlow(0xff5c8a, 0.7);
        break;
      }
      case 'celebrate':                              // $AGI reached a new market cap step: a hop and a burst of hearts,
        if (!reducedMotion && hopT < 0) hopT = 0;     // then, on the stage, a little happy dance (not up close: no dances there)
        effects.spawnHearts(worldPos(B.head, 0.05), { count: 24, spread: 0.7, size: 0.12, rise: 1.1 });
        look.atViewerUntil = clock + 2.5;
        onGlow(0xff5c8a, 1);
        if (!closeUp && !dancing) nextDance = clock + 0.7;
        break;
      case 'sad': {                                  // a -20% day: she looks down for a few seconds
        const head = worldPos(B.head);
        const toYou = camera.position.clone().sub(head).setY(0).normalize();
        look.away.copy(head).addScaledVector(toYou, 0.5).add(new THREE.Vector3(0, -1.1, 0));
        look.awayUntil = clock + 3.5;
        break;
      }
      case 'jealous': {                              // someone picked AGI-2: a little pout, and a glance away
        const head = worldPos(B.head);
        const toYou = camera.position.clone().sub(head).setY(0).normalize();
        const side = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), toYou);
        look.away.copy(head).addScaledVector(toYou, 0.8).addScaledVector(side, -0.9).add(new THREE.Vector3(0, 0.1, 0));
        look.awayUntil = clock + 1.6;
        break;
      }
      case 'dance':
        startDance();
        break;
      case 'nod':
        if (nodT < 0) nodT = 0;
        break;
      case 'okay':                                   // ClankChecker, lower risk: a calm smile and a nod, looking at you
        if (nodT < 0) nodT = 0;
        look.atViewerUntil = clock + 1.6;
        break;
      case 'hmm':                                    // some risk: a pout and a slow tilt of her head
        if (hmmT < 0) hmmT = 0;
        look.atViewerUntil = clock + 1.9;
        break;
      case 'worried':                                // high risk: she shakes her head slowly, looking at you
        if (shakeT < 0) shakeT = 0;
        look.atViewerUntil = clock + 2;
        break;
      default:
        console.warn('[agi1] unknown reaction:', type);
    }
  }

  // ---------- her hair (2026-09-26, the owner: "add hair physics, so when she moves her hair moves too naturally") ----------
  // Her model has no hair bones: her hair moves with her head, neck and upper back (tools/model/fix-hair-weights.mjs). On
  // top of that her shader lets it swing (HAIR_MOVE): the weight of her hair follows her neck like a soft spring, so it
  // trails behind when she moves, dances or hops and then settles; it swings around after her when she turns or spins (and
  // flares out a little in a fast spin); and a very gentle breeze keeps it from ever looking frozen ("reduce motion": no
  // breeze). The free ends of her long hair move the most, her roots not at all.
  const HAIR_SPRING = { k: 45, c: 5.4, turnK: 40, turnC: 6.5, maxLag: 0.09, maxTwist: 0.7 };
  const hair = { p: new THREE.Vector3(), v: new THREE.Vector3(), lag: new THREE.Vector3(), yaw: 0, last: 0, angle: 0, turn: 0, flare: 0, ready: false };
  const vNeck = new THREE.Vector3();
  function applyHair(dt) {
    if (!face?.hasHair || !B.neck || !B.chest) return;
    B.neck.getWorldPosition(vNeck);
    B.chest.getWorldQuaternion(qChest);                       // which way she faces (her chest), counting whole turns
    vA.set(0, 0, 1).applyQuaternion(qChest);
    const yaw = Math.atan2(vA.x, vA.z);
    if (!hair.ready) {
      Object.assign(hair, { yaw, last: yaw, angle: yaw, turn: 0, flare: 0, ready: true });
      hair.p.copy(vNeck); hair.v.set(0, 0, 0);
    }
    let dYaw = yaw - hair.last;
    dYaw -= Math.round(dYaw / (2 * Math.PI)) * 2 * Math.PI;
    hair.last = yaw;
    hair.yaw += dYaw;
    const S = HAIR_SPRING;
    if (dt > 0) {
      vB.copy(vNeck).sub(hair.p).multiplyScalar(S.k).addScaledVector(hair.v, -S.c);   // about one swing a second
      hair.v.addScaledVector(vB, dt);
      hair.p.addScaledVector(hair.v, dt);
      hair.turn += (S.turnK * (hair.yaw - hair.angle) - S.turnC * hair.turn) * dt;
      hair.angle += hair.turn * dt;
      const fast = Math.min(1, Math.abs(dYaw / dt) / 10);                                // a spin: about 10 radians a second
      hair.flare += (fast - hair.flare) * (1 - Math.exp(-dt * (fast > hair.flare ? 8 : 3)));
    }
    hair.lag.copy(hair.p).sub(vNeck);
    if (hair.lag.length() > S.maxLag) { hair.lag.setLength(S.maxLag); hair.p.copy(vNeck).add(hair.lag); }
    let twist = hair.angle - hair.yaw;
    if (Math.abs(twist) > S.maxTwist) { twist = Math.sign(twist) * S.maxTwist; hair.angle = hair.yaw + twist; }
    face.setHair(hair.lag, twist, hair.flare, vNeck, clock, reducedMotion ? 0 : 1);
  }

  // Called by the stage every frame, right after the mixer has set her pose.
  function update(dt) {
    saveCleanPose();            // what the animation set this frame, before the wave and the look change it
    clock += dt;
    updateDance(dt);
    root.updateMatrixWorld(true);
    applyWave(dt);
    applyLook(dt);
    applyTalk(dt);
    applyExpression(dt);
    applyBlink(dt);
    applyBody(dt);
    applyHair(dt);              // last: her hair follows where everything above has put her
  }

  // She arrived on stage (page opened, or switched back from the champion's card): wave hello, dance a bit later.
  function hello() {
    startWave();
    setMood('wave');                             // with a smile
    nextDance = clock + FIRST_DANCE_AFTER;
  }

  return {
    update, beforeMixer, react, setPointer, hello,
    setCloseUp(on) { closeUp = !!on; },
    setTalk(level) { talk.level = Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : 0; },
    setAttention(mode) {
      const next = mode === 'listening' || mode === 'thinking' ? mode : 'idle';
      if (next !== attention && next !== 'idle' && blink.t < 0) blink.next = clock + 0.15;   // a blink as her attention shifts
      attention = next;
    },
    get dancing() { return dancing; },
    get mouthOpen() { return talk.open; },
    get blinking() { return face ? face.blink : 0; },
    get attention() { return attention; },
    get mood() { return expr.mood; },
    get expression() { return face ? face.expression : null; },
    get hair() { return { lag: hair.lag.length(), twist: hair.angle - hair.yaw, flare: hair.flare, on: Boolean(face?.hasHair) }; },
  };
}
