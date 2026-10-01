// AGI-1 in 2D: her Live2D model (since 2026-10-01, the owner: "change the 2d model use the new model in VTuber_Project …
// when they visit the website i want the 2d model to be shown first instead of 3d"). The model was made from the owner's
// art in Live2D Cubism Editor (the owner's VTuber project): her head, eyes, mouth, body and arms move on the model's own
// parameters, and her hair and chest have the model's physics. It's drawn by the same stage as her 3D model (one canvas, one
// scene: src/stage/live2d.js), so the zoom, the live views, her hearts and the "3D · 2D" switch work for both.
//
// How she moves (what makes a VTuber look alive), all on her model's parameters:
//  • her eyes lead and her head follows (your pointer, the chat box, or you), quick little eye movements, slow drifts of
//    her head and body, her weight shifting, breathing;
//  • she blinks (a quick lid, now and then twice), her eyes close in a smile on happy moments, her cheeks blush;
//  • her mouth follows her voice (src/lib/talk.js, the same as her 3D mouth);
//  • her hair swings and her chest follows through with the model's own physics (src/stage/live2d-physics.js): her chest
//    natural and subtle, as on the whole site (PG-13, CHEST in agi1-2d-motion.js);
//  • every reaction the 3D AGI-1 has (agi1:react) has a 2D version, with the same timing, moods and hearts;
//  • her arms and hips move in code on top of her model (src/stage/agi1-2d-arms.js, 2026-10-01, the owner: "why dont the
//    2d model wave anymore … she moves like a stick"): her model is drawn in an A-pose and its own arm parameters swing
//    each arm only about 7°, so her arms hang relaxed by her sides, swing a little as she sways, and really wave (her arm
//    up, her elbow bent, her hand by her head); her weight shifts from one foot to the other (her hips move, her feet stay
//    on the floor, her upper body leans the other way), and her head looks around a little more.
// The controller returned by createAgi1_2D has the same methods as src/stage/agi1.js's, so the stage uses either.
import * as THREE from 'three';
import { loadCubismCore, buildMeshes, pieceAt, boxOf } from './live2d.js';
import { createPhysics } from './live2d-physics.js';
import { measureArm, bendArm } from './agi1-2d-arms.js';
import {
  Follow, makeDrift, blinkAmount, blinkLength, nextBlinkGap, mouthStep, eyeOpen, chestLimit, lookAt, clamp, lerp,
  smoothstep, CHEST,
} from './agi1-2d-motion.js';

export const HEIGHT = 1.62;                        // as tall as the 3D AGI-1, from her soles to the top of her hair (metres)
export const BASE = '/models/agi1-live2d/';
// her files (public/models/agi1-live2d/): Live2D's runtime, her model, its physics, her texture (2048 px; 4096 px only
// for close-ups on computers: sharpen())
export const FILES = {
  core: 'live2dcubismcore.min.js', moc: 'AGI-1.moc3', physics: 'AGI-1.physics3.json',
  texture: 'AGI-1.2048.webp', sharp: 'AGI-1.4096.webp',
};
const ORDER = 1;                                   // her pieces draw after the floor (0), before the hearts (2)
const FIRST_DANCE_AFTER = 14;                      // like the 3D AGI-1: a little dance 14 s after she arrives,
const DANCE_GAP = [35, 55];                        // then every 35 to 55 s (never up close)
const DANCE_LENGTH = 6;
// how far her head turns (her model's degrees): further, her flat art starts to show its seams (checked on every edge)
const TURN = { x: 20, up: 12, down: -15, z: 15 };
// her arms (degrees, src/stage/agi1-2d-arms.js: shoulder > 0 lifts the arm away from her body, elbow > 0 turns the forearm
// up and out): relaxed by her sides at rest (her model is drawn in an A-pose). Her upper arms never lift far (her shirt
// under her sleeves is drawn for arms down: REACH in agi1-2d-arms.js), so her hands go up by bending her elbows: her elbow
// stays low by her side and her hand comes up by her face, like a cute "hi!" (her wave), both hands up for a "yay!" (her
// cheer), her forearms up and swaying in front of her (her dance).
export const ARMS = {
  rest: { shoulder: -15, elbow: -3 }, wave: { shoulder: 9, elbow: 130 }, cheer: { shoulder: 8, elbow: 124 }, dance: { shoulder: 0, elbow: 116 },
  // up close (her live views, zoomed in): like on a video call, her hand a little nearer her face
  waveNear: { shoulder: 7, elbow: 134 },
};
// her hips: how far her weight shifts from one foot to the other (model units, about 1.5 cm), more in her dance
export const HIPS = { idle: 0.014, dance: 0.028 };

// ---------- loading ----------
async function getBuffer(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.arrayBuffer();
}
async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}
async function getTexture(url) {
  const t = await new THREE.TextureLoader().loadAsync(url);
  t.premultiplyAlpha = true;                       // clean edges when it's filtered (as Live2D draws)
  t.colorSpace = THREE.NoColorSpace;               // her colors drawn exactly as they are
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

export async function loadAgi1_2D({ renderer, base = BASE, onProgress = () => {} } = {}) {
  const done = [0, 0, 0, 0];
  const tick = (i) => (v) => { done[i] = 1; onProgress(Math.min(0.99, done.reduce((a, b) => a + b, 0) / done.length)); return v; };
  const [Core, mocBuffer, physicsJson, texture] = await Promise.all([
    loadCubismCore(base + FILES.core).then(tick(0)),
    getBuffer(base + FILES.moc).then(tick(1)),
    getJson(base + FILES.physics).then(tick(2)),
    getTexture(base + FILES.texture).then(tick(3)),
  ]);
  const moc = Core.Moc.fromArrayBuffer(mocBuffer);
  if (!moc) throw new Error("her Live2D model couldn't be read");
  const core = Core.Model.fromMoc(moc);
  if (!core) throw new Error("her Live2D model couldn't be made");
  return buildPuppet({ core, moc, physicsJson, texture, base, renderer });
}

// ---------- the puppet ----------
export function buildPuppet({ core, moc, physicsJson, texture, base = BASE }) {
  const P = core.parameters, D = core.drawables;
  const params = Array.from(P.ids), pieces = Array.from(D.ids);
  const at = Object.fromEntries(params.map((id, i) => [id, i]));
  const piece = (name) => pieces.indexOf(name);
  // her pose at rest: where her soles and the top of her hair are, so she stands on the floor, HEIGHT tall
  P.values.set(P.defaultValues);
  core.update();
  const shown = [...Array(D.count).keys()].filter((i) => (D.dynamicFlags[i] & 1) && D.opacities[i] > 0.01);
  const rest = boxOf(core, shown);
  const K = HEIGHT / (rest.y1 - rest.y0);          // world units per model unit
  const holder = new THREE.Group();                // moved by the stage (switching in and out)
  const fx = new THREE.Group();                    // hops, squashes, her weight shifting
  const art = new THREE.Group();                   // model units → world: she stands on the floor, facing you
  art.scale.setScalar(K);
  art.position.set(-((rest.x0 + rest.x1) / 2) * K, -rest.y0 * K, 0);
  holder.add(fx);
  fx.add(art);
  let map = texture;
  const meshes = buildMeshes(core, map, { order: ORDER });
  art.add(meshes.group);

  // markers the stage frames her by (like the 3D model's bones), kept where her pieces are every frame
  const marker = (name) => { const o = new THREE.Object3D(); o.name = name; art.add(o); return o; };
  const marks = {
    head: marker('head'), headTop: marker('headTop'), chest: marker('chest'),
    // her right hand (on the left of the picture), then her left: [wrist, fingertips, elbow]
    hands: ['R', 'L'].map((s) => [marker(`wrist${s}`), marker(`tip${s}`), marker(`elbow${s}`)]),
  };
  const P_FACE = [piece('face')], P_HAIR = [piece('hair_front_L'), piece('hair_front_R')], P_CHEST = [piece('chest')];

  // her arms and hips, moved in code on top of her model (src/stage/agi1-2d-arms.js), measured on her pose at rest. Live2D
  // works out every piece's vertices afresh on each update (tests/agi1-2d.test.js checks it), so they're turned in place.
  const restPos = Array.from({ length: D.count }, (_, i) => Float32Array.from(D.vertexPositions[i]));
  const rig = { rest: (i) => restPos[i], indices: (i) => D.indices[i], find: piece };
  const arms = { R: measureArm(rig, 'R'), L: measureArm(rig, 'L') };
  // her hips shift sideways with her weight: her shoes stay where they are, her legs lean (more toward her hips), and
  // everything above her legs moves with her hips
  const isLeg = new Uint8Array(D.count);
  for (const n of ['leg_L', 'leg_R', 'shoe_L', 'shoe_R']) if (piece(n) >= 0) isLeg[piece(n)] = 1;
  const feetTop = boxOf(core, ['shoe_L', 'shoe_R'].map(piece), {}).y1 ?? rest.y0;
  const hipsAt = boxOf(core, ['leg_L', 'leg_R'].map(piece), {}).y1 ?? 0;
  const posture = { R: { shoulder: 0, elbow: 0, wrist: 0 }, L: { shoulder: 0, elbow: 0, wrist: 0 }, hip: 0 };
  const own = (i) => D.vertexPositions[i];
  function deform() {
    bendArm(arms.R, posture.R, own, own);
    bendArm(arms.L, posture.L, own, own);
    const h = posture.hip;
    if (!h) return;
    for (let i = 0; i < D.count; i++) {
      const p = D.vertexPositions[i];
      if (isLeg[i]) for (let k = 0; k < p.length; k += 2) p[k] += h * smoothstep(feetTop, hipsAt, p[k + 1]);
      else for (let k = 0; k < p.length; k += 2) p[k] += h;
    }
  }

  const b = { x0: 0, y0: 0, x1: 0, y1: 0, cx: 0, cy: 0 };
  function updateMarks() {
    boxOf(core, P_FACE, b);
    const hx = (b.x0 + b.x1) / 2;
    marks.head.position.set(hx, (b.y0 + b.y1) / 2, 0);
    boxOf(core, P_HAIR, b);
    marks.headTop.position.set(hx, b.y1, 0);
    boxOf(core, P_CHEST, b);
    marks.chest.position.set((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, 0);
    // her hands: her wrist, fingertips and elbow where her arms really are (a wave widens the live view to keep them in)
    ['R', 'L'].forEach((s, i) => {
      const arm = arms[s];
      if (!arm) return;
      const [wrist, tip, elbow] = marks.hands[i], h = posture.hip;
      wrist.position.set(arm.now.W[0] + h, arm.now.W[1], 0);
      tip.position.set(arm.now.tip[0] + h, arm.now.tip[1], 0);
      elbow.position.set(arm.now.E[0] + h, arm.now.E[1], 0);
    });
  }
  deform();
  updateMarks();

  // taps: on her (inside her pieces' outlines), not on a box around her. The stage asks with a raycaster.
  const hitBox = new THREE.Object3D();
  hitBox.name = 'hit';
  const inv = new THREE.Matrix4(), ray = new THREE.Ray(), hitAt = new THREE.Vector3();
  let lastHit = null;
  hitBox.raycast = (raycaster, intersects) => {
    inv.copy(art.matrixWorld).invert();
    ray.copy(raycaster.ray).applyMatrix4(inv);
    if (Math.abs(ray.direction.z) < 1e-9) return;
    const t = -ray.origin.z / ray.direction.z;
    if (t < 0) return;
    const x = ray.origin.x + ray.direction.x * t, y = ray.origin.y + ray.direction.y * t;
    const i = pieceAt(core, x, y);
    if (i < 0) return;
    lastHit = pieces[i];
    hitAt.set(x, y, 0).applyMatrix4(art.matrixWorld);
    intersects.push({ distance: raycaster.ray.origin.distanceTo(hitAt), point: hitAt.clone(), object: hitBox, piece: pieces[i] });
  };
  art.add(hitBox);

  const physics = createPhysics(physicsJson, { ids: params, min: P.minimumValues, max: P.maximumValues });
  physics.setScale('ParamChestY', CHEST.scale);
  physics.setScale('ParamChestX', CHEST.scale);

  // her eyes and waist (world height, standing): for framing her elsewhere (her daily clips: tools/clips/page/clip.js)
  const worldY = (y) => (y - rest.y0) * K;
  const print = boxOf(core, [piece('shirt_print')], {});
  const landmarks = {
    eyes: worldY(boxOf(core, [piece('eye_white_L'), piece('eye_white_R')], {}).cy ?? 0),
    waist: worldY(boxOf(core, [piece('shorts')], {}).y1 ?? 0),
    print: { top: worldY(print.y1 ?? 0), bottom: worldY(print.y0 ?? 0) },    // the AGI on her shirt
    top: HEIGHT,
  };

  let sharp = null;
  return {
    kind: 'agi1_2d', holder, fx, root: art, art, marks, hitBox, mixer: null, core, physics, meshes, at, landmarks, K,
    focusBones: [marks.head, marks.headTop],
    updateMarks,
    // her arms and hips this frame (the controller sets them; deform() turns her pieces after Live2D's update)
    posture, deform, arms,
    get lastHit() { return lastHit; },
    // the 4096 px texture, for close-ups on a computer (downloaded once, about 1.2 MB, on request)
    sharpen() {
      sharp ??= getTexture(base + FILES.sharp).then((t) => {
        const old = map;
        map = t;
        meshes.setMap(t);
        old.dispose();
        return true;
      }).catch((err) => { console.warn('[agi1_2d] the sharper texture could not load', err); return false; });
      return sharp;
    },
    get sharp() { return map !== texture; },
    dispose() {
      meshes.dispose();
      map.dispose();
      if (map !== texture) texture.dispose();
      core.release?.();
      moc._release?.();
    },
  };
}

// ---------- the controller ----------
export function createAgi1_2D(model, { camera, effects, reducedMotion = false, onGlow = () => {} }) {
  const { core, physics, at } = model;
  const RM = reducedMotion;
  const PV = core.parameters.values, MIN = core.parameters.minimumValues, MAX = core.parameters.maximumValues;
  const put = (id, v) => { const i = at[id]; if (i !== undefined) PV[i] = v < MIN[i] ? MIN[i] : v > MAX[i] ? MAX[i] : v; };
  const get = (id) => { const i = at[id]; return i === undefined ? 0 : PV[i]; };
  const drift = Array.from({ length: 10 }, (_, i) => makeDrift(i * 7.31 + 1.7));
  if (RM) { physics.setScale('ParamChestY', 0); physics.setScale('ParamChestX', 0); }   // "reduce motion": no follow-through

  // ---------- her pose: each part follows its target like a real body part ----------
  // (her head and body on her model's parameters; her arms in degrees and her hips in model units: model.posture)
  const R0 = ARMS.rest;
  const F = {
    ax: new Follow(0, 1.35, 0.82, 0.25), ay: new Follow(0, 1.35, 0.85, 0.2), az: new Follow(0, 1.1, 0.8, 0),
    ex: new Follow(0, 7.5, 1, 0), ey: new Follow(0, 7.5, 1, 0),
    bx: new Follow(0, 0.7, 0.9, 0), by: new Follow(0, 1.6, 0.7, 0), bz: new Follow(0, 0.8, 0.8, 0),
    hip: new Follow(0, 0.55, 0.95, 0),
    // her arms swing a little behind her body, like real arms (shoulder, elbow, wrist; R her right, on the left of the picture)
    shR: new Follow(R0.shoulder, 2.2, 0.68, 0.1), elR: new Follow(R0.elbow, 3, 0.6, 0.05), wrR: new Follow(0, 3.6, 0.5, 0),
    shL: new Follow(R0.shoulder, 2.2, 0.68, 0.1), elL: new Follow(R0.elbow, 3, 0.6, 0.05), wrL: new Follow(0, 3.6, 0.5, 0),
  };
  const P = {};
  for (const k in F) P[k] = F[k].y;

  // ---------- state ----------
  let clock = 0, closeUp = false, attention = 'idle';
  const look = { pointer: null, awayUntil: 0, away: { lx: 0, ly: 0, ex: 0, ey: 0 }, atViewerUntil: 0 };
  const sacc = { x: 0, y: 0, next: 0.6 };
  const talk = { level: 0, open: 0, slow: 0, env: 0, t: 0 };
  const blink = { t: -1, next: 1.2 + Math.random() * 2 };
  let blinkAmt = 0;
  // moods: the same as the 3D AGI-1's (src/stage/agi1.js), on what her model can show: a little smile with her mouth open
  // (grin), her blush, her lids lowered a little (lids), and her eyes closing in a smile for a moment (pulse, after: when)
  const FACES = {
    calm: {},
    listening: { grin: 0.03 },
    thinking: { lids: 0.6 },
    dancing: { grin: 0.25, blush: 0.15 },
    neutral: {},
    happy: { grin: 0.32, blush: 0.35, pulse: 0.8 },
    love: { grin: 0.2, blush: 0.95, lids: 0.6, pulse: 0.75, after: 0.8 },
    shy: { grin: 0.05, blush: 1, lids: 1 },
    wave: { grin: 0.3, blush: 0.15, pulse: 0.5 },
    jealous: { blush: 0.3, lids: 0.7 },
    celebrate: { grin: 0.45, blush: 0.5, pulse: 1 },
    sad: { lids: 1 },
    okay: { grin: 0.18, blush: 0.1 },
    hmm: { lids: 0.5 },
    worried: { grin: 0.04, lids: 0.4 },
  };
  const EXPR_KEYS = ['grin', 'blush', 'lids'];
  const expr = { mood: null, until: 0, pulseFrom: 0, pulseUntil: 0, happy: 0, grin: 0, blush: 0, lids: 0, blushUntil: 0 };
  // body moves
  const act = { wave: -1, waveNear: 0, hop: -1, sway: -1, nod: -1, shake: -1, hmm: -1, cheer: -1 };
  let dancing = false, danceT = 0, nextDance = FIRST_DANCE_AFTER, danceW = 0, hopBody = 0;

  function setMood(mood) {
    const f = FACES[mood];
    if (!f) return;
    expr.mood = mood === 'neutral' ? null : mood;
    expr.until = clock + 4.5;
    expr.pulseFrom = clock + (RM ? 0 : f.after || 0);
    expr.pulseUntil = f.pulse ? expr.pulseFrom + f.pulse : 0;
  }
  function applyExpression(dt) {
    if (expr.mood && talk.env > 0.05) expr.until = Math.max(expr.until, clock + 2.5);   // it holds while she talks
    if (expr.mood && clock >= expr.until) expr.mood = null;
    const rest = dancing ? 'dancing' : attention === 'listening' || attention === 'thinking' ? attention : 'calm';
    const want = FACES[expr.mood || rest];
    for (const k of EXPR_KEYS) {
      const to = k === 'blush' && clock < expr.blushUntil ? Math.max(want[k] || 0, 0.9) : want[k] || 0;   // (a tap on her face)
      expr[k] += (to - expr[k]) * (1 - Math.exp(-dt * (Math.abs(to) > Math.abs(expr[k]) ? 9 : 2.5)));
    }
    // her eyes close in a smile quickly and open quickly (in between, her model's lids cross-fade: see eyeOpen())
    const shut = clock >= expr.pulseFrom && clock < expr.pulseUntil && talk.env < 0.5 ? 1 : 0;
    expr.happy += (shut - expr.happy) * (1 - Math.exp(-dt * 26));
  }

  // ---------- where she looks ----------
  const vHead = new THREE.Vector3();
  function lookTargets() {
    let lt;
    if (clock < look.atViewerUntil || !look.pointer) lt = lookAt(null);
    else {
      model.marks.head.getWorldPosition(vHead).project(camera);
      lt = lookAt(look.pointer, vHead, camera.aspect || 1);
    }
    if (clock < look.awayUntil) lt = { ...look.away };
    return lt;
  }

  // ---------- one frame ----------
  const tg = {};
  function update(dt) {
    if (!(dt > 0)) return;
    clock += dt;
    const mo = RM ? 0.45 : 1;                          // how much she drifts
    applyExpression(dt);
    // blinking (and a blink when her attention shifts or her eyes jump far)
    if (blink.t < 0 && clock >= blink.next) blink.t = 0;
    if (blink.t >= 0) {
      blink.t += dt;
      blinkAmt = blinkAmount(blink.t);
      if (blink.t >= blinkLength()) { blink.t = -1; blinkAmt = 0; blink.next = clock + nextBlinkGap(); }
    }
    // talking: her mouth opens with each syllable; her head nods a little on the louder words
    talk.open = mouthStep(talk.open, talk.level, dt);
    const on = talk.level > 0.05 ? 1 : 0;
    talk.env += (on - talk.env) * (1 - Math.exp(-dt * (on ? 5 : 1.4)));
    talk.slow += (talk.level - talk.slow) * (1 - Math.exp(-dt * 4));
    talk.t = talk.env > 0.001 ? talk.t + dt : 0;

    // saccades: her eyes jump a little, now and then
    if (clock >= sacc.next) {
      const far = Math.random() < 0.3;
      sacc.x = far ? 0 : (Math.random() - 0.5) * 0.5;
      sacc.y = far ? 0 : (Math.random() - 0.5) * 0.3;
      sacc.next = clock + 0.7 + Math.random() * 2.2;
    }
    const lt = lookTargets();
    const t = clock;
    const follow = look.pointer && clock >= look.atViewerUntil ? 0.3 : 1;
    const tilt = attention === 'thinking' ? 7 : attention === 'listening' ? -4 : 0;
    const w1 = Math.sin(talk.t * Math.PI * 2 * 0.9), w2 = Math.sin(talk.t * Math.PI * 2 * 0.37), w3 = Math.sin(talk.t * Math.PI * 2 * 0.23 + 1);
    // Never still (2026-10-01, the owner: "she moves like a stick"): slow swings that never line up (like Live2D's own
    // idle "breath" for VTubers) with a little randomness on top, so she always moves, never the same way twice.
    const swing = (period, phase) => Math.sin((t / period + phase) * Math.PI * 2);
    // her weight shifts from one foot to the other every few seconds: her hips move, her upper body leans the other way
    // (balance), her head tilts with it
    const weight = clamp(0.75 * swing(8.7, 0.1) + 0.35 * drift[3](t * 0.13), -1, 1);
    // her head: where she looks, a slow look around, the chat's attention, and a little life while she talks
    tg.ax = lt.lx * 18 + mo * (7.5 * swing(6.5, 0) + 3 * drift[0](t * 0.2)) + talk.env * 1.6 * w3;
    tg.ay = lt.ly * 12 + mo * (3 * swing(4.9, 0.3) + 1.5 * drift[1](t * 0.17)) - talk.slow * 3 + talk.env * 1.2 * w1;
    tg.az = tilt + mo * (3.5 * swing(5.6, 0.6) + 2 * drift[2](t * 0.15) + 2.2 * weight) + talk.env * 2 * w2 - lt.lx * lt.ly * 6;
    tg.ex = clamp(lt.ex + sacc.x * follow, -1, 1);
    tg.ey = clamp(lt.ey - sacc.y * follow, -1, 1);
    // her body: follows her head a little, sways, balances her hips
    tg.hip = mo * HIPS.idle * weight;
    tg.bx = F.ax.y * 0.3 + mo * (2.5 * swing(12.1, 0.2) + 1.5 * drift[4](t * 0.1));
    tg.bz = F.ax.y * 0.1 - mo * 2 * weight + mo * (2 * swing(7.3, 0.45) + drift[5](t * 0.2));
    tg.by = mo * 0.9 * drift[6](t * 0.11);
    // her arms hang relaxed by her sides and swing a little: gravity keeps them hanging when her upper body leans
    const lean = F.bz.y * 0.45;
    tg.shR = R0.shoulder + mo * 1.6 * drift[7](t * 0.23) - lean;
    tg.shL = R0.shoulder + mo * 1.6 * drift[8](t * 0.21) + lean;
    tg.elR = R0.elbow + mo * 2.5 * drift[9](t * 0.19);
    tg.elL = R0.elbow - mo * 2.5 * drift[9](t * 0.17 + 5);
    tg.wrR = mo * 4 * drift[7](t * 0.31 + 2);
    tg.wrL = mo * 4 * drift[8](t * 0.29 + 7);

    // the reactions, on top
    applyMoves(dt, tg);
    hopPose(dt);
    // the limits, so she never turns too far
    tg.ax = clamp(tg.ax, -TURN.x, TURN.x);
    tg.ay = clamp(tg.ay, TURN.down, TURN.up);
    tg.az = clamp(tg.az, -TURN.z, TURN.z);
    for (const k in F) P[k] = F[k].step(dt, tg[k]);
    // a big jump of her eyes brings a blink now and then, as with people
    if (Math.abs(tg.ex - P.ex) > 0.55 && blink.t < 0 && Math.random() < 0.02 * 60 * dt) blink.next = clock;

    // breathing: a little slower than one breath every 4 s, quicker while she talks
    const breath = 0.5 - 0.5 * Math.cos((Math.PI * 2 * clock) / (talk.env > 0.3 ? 3.4 : 4.3));
    put('ParamAngleX', P.ax); put('ParamAngleY', P.ay); put('ParamAngleZ', P.az);
    put('ParamEyeBallX', P.ex); put('ParamEyeBallY', P.ey);
    put('ParamBodyAngleX', P.bx); put('ParamBodyAngleY', P.by + hopBody); put('ParamBodyAngleZ', P.bz);
    put('ParamBreath', breath);
    const eyes = eyeOpen(blinkAmt, expr.lids, expr.happy);
    put('ParamEyeLOpen', eyes); put('ParamEyeROpen', eyes);
    put('ParamMouthOpenY', Math.max(talk.open, expr.grin * (1 - 0.5 * talk.env)));
    put('ParamCheek', expr.blush);
    // her hair and chest: the model's physics, from the pose above
    physics.evaluate(PV, dt);
    const [cx, cy] = chestLimit(get('ParamChestX'), get('ParamChestY'));
    put('ParamChestX', RM ? 0 : cx); put('ParamChestY', RM ? 0 : cy);
    core.update();
    // her arms and hips, on top of what her model just worked out
    const pz = model.posture;
    pz.R.shoulder = P.shR; pz.R.elbow = P.elR; pz.R.wrist = P.wrR;
    pz.L.shoulder = P.shL; pz.L.elbow = P.elL; pz.L.wrist = P.wrL;
    pz.hip = P.hip;
    model.deform();
    model.meshes.sync();
    model.updateMarks();
    body3D();
  }

  // ---------- reactions (body) ----------
  // both arms at once: `fn(side, sign)` → [shoulder, elbow, wrist] to add (sign: +1 her right arm, -1 her left)
  const bothArms = (fn) => {
    for (const [side, sign] of [['R', 1], ['L', -1]]) {
      const [sh = 0, el = 0, wr = 0] = fn(side, sign);
      tg[`sh${side}`] += sh; tg[`el${side}`] += el; tg[`wr${side}`] += wr;
    }
  };
  function applyMoves(dt, tg) {
    // the wave: her right forearm (on the left of the picture) comes up, her elbow low by her side, her hand up by her
    // face, and she waves from the elbow (her hand a moment behind, like a real hand), tilting her head toward it, leaning
    // and bouncing a little on each wave (up close, in the chat, a little less)
    if (act.wave >= 0) {
      act.wave += dt;
      const a = act.wave;
      act.waveNear += ((closeUp ? 1 : 0) - act.waveNear) * (1 - Math.exp(-dt * 5));
      const n = act.waveNear;
      const up = smoothstep(0.02, 0.4, a) * (1 - smoothstep(2.5, 3.05, a));
      const env = smoothstep(0.32, 0.55, a) * (1 - smoothstep(2.2, 2.5, a));
      const ph = (a - 0.4) * Math.PI * 2 * 1.7;
      const beat = Math.sin(ph) * env, late = Math.sin(ph - 1.1) * env;
      tg.shR = lerp(tg.shR, lerp(ARMS.wave.shoulder, ARMS.waveNear.shoulder, n) + 3 * beat, up);
      tg.elR = lerp(tg.elR, lerp(ARMS.wave.elbow, ARMS.waveNear.elbow, n) + lerp(17, 10, n) * beat, up);
      tg.wrR = lerp(tg.wrR, 10 * late, up);
      tg.bz -= lerp(2.5, 1.5, n) * up + 0.8 * beat * up;
      tg.az -= 5 * up;
      tg.by += lerp(1.2, 0.6, n) * Math.abs(beat) * up;
      if (a > 3.1) act.wave = -1;
    }
    // "celebrate": both hands up by her face in a little "yay!", shaking with joy, then down
    if (act.cheer >= 0) {
      act.cheer += dt;
      const c = act.cheer;
      const e = smoothstep(0, 0.22, c) * (1 - smoothstep(1.25, 1.75, c));
      const shake = Math.sin(c * Math.PI * 2 * 2.4) * smoothstep(0.18, 0.32, c);
      for (const side of ['R', 'L']) {
        tg[`sh${side}`] = lerp(tg[`sh${side}`], ARMS.cheer.shoulder, e);
        tg[`el${side}`] = lerp(tg[`el${side}`], ARMS.cheer.elbow + 8 * shake, e);
        tg[`wr${side}`] = lerp(tg[`wr${side}`], 10 * shake, e);
      }
      if (c > 1.75) act.cheer = -1;
    }
    // "love": a happy sway from side to side (the 3D AGI-1 spins; a flat picture can't), her arms swinging out with it
    if (act.sway >= 0) {
      act.sway += dt;
      const p = act.sway / 1.1;
      if (p >= 1) act.sway = -1;
      else {
        const s = Math.sin(p * Math.PI * 2) * Math.sin(p * Math.PI);
        tg.bz += 6 * s; tg.az += 7 * s; tg.hip += 0.02 * s;
        bothArms(() => [6 * Math.abs(s), 6 * Math.abs(s)]);
      }
    }
    // nods ('nod', 'okay'), a slow shake of her head ('worried') and a tilt ('hmm')
    if (act.nod >= 0) {
      act.nod += dt;
      if (act.nod >= 0.55) act.nod = -1; else tg.ay -= Math.sin((act.nod / 0.55) * Math.PI) * 8;
    }
    if (act.shake >= 0) {
      act.shake += dt;
      if (act.shake >= 1.4) act.shake = -1;
      else tg.ax += Math.sin(act.shake * Math.PI * 2 * 1.5) * 10 * Math.sin((act.shake / 1.4) * Math.PI);
    }
    if (act.hmm >= 0) {
      act.hmm += dt;
      if (act.hmm >= 1.9) act.hmm = -1; else tg.az += 9 * Math.sin((act.hmm / 1.9) * Math.PI);
    }
    // shy and sad: her arms come in to her sides, her shoulders a little forward
    if (clock < look.awayUntil && expr.mood === 'shy') { bothArms(() => [-6, -9]); tg.by += 1.5; }
    if (expr.mood === 'sad') { bothArms(() => [-3, -2]); tg.by += 2; }
    // her little dance: her hips swaying on the beat, her upper body the other way, a bounce, and her forearms up in front
    // of her, her hands swaying from side to side with her and bobbing on each beat (her elbows stay low: REACH)
    updateDance(dt);
    if (danceW > 0.001) {
      const b = danceT * 1.9;                          // beats (about 114 a minute)
      const w = danceW * (RM ? 0 : 1);
      const bounce = 0.5 - 0.5 * Math.cos(Math.PI * 2 * b);
      const sw = Math.sin(Math.PI * b);
      tg.hip += w * HIPS.dance * sw;
      tg.bz -= w * 5 * sw;
      tg.bx += w * 4 * Math.sin(Math.PI * b + 0.5);
      tg.by += w * 3 * bounce;
      tg.az -= w * 6 * Math.sin(Math.PI * b + 1.1);
      tg.ay += w * 3 * Math.sin(Math.PI * 2 * b);
      const sway = Math.sin(Math.PI * b - 0.4);       // (her hands a moment behind her hips)
      const bob = 0.5 - 0.5 * Math.cos(Math.PI * 2 * b - 0.5);
      for (const [side, sign] of [['R', 1], ['L', -1]]) {   // (both hands the same way: her arms turn opposite ways)
        tg[`sh${side}`] += w * (ARMS.dance.shoulder - tg[`sh${side}`] - 5 * sign * sway);
        tg[`el${side}`] += w * (ARMS.dance.elbow - tg[`el${side}`] + 16 * sign * sway + 10 * bob);
        tg[`wr${side}`] += w * (10 * sign * sway - tg[`wr${side}`]);
      }
    }
  }
  function startDance() {
    if (dancing || act.wave >= 0 || RM) return;
    dancing = true; danceT = 0;
  }
  function updateDance(dt) {
    if (dancing) {
      danceT += dt;
      if (danceT >= DANCE_LENGTH) { dancing = false; nextDance = clock + DANCE_GAP[0] + Math.random() * (DANCE_GAP[1] - DANCE_GAP[0]); }
    } else if (act.wave < 0 && !RM && clock >= nextDance) {
      if (closeUp) nextDance = clock + 6; else startDance();
    }
    const want = dancing ? smoothstep(0, 0.6, danceT) * (1 - smoothstep(DANCE_LENGTH - 0.8, DANCE_LENGTH, danceT)) : 0;
    danceW += (want - danceW) * (1 - Math.exp(-dt * 6));
  }

  // a hop (a tap, "happy", "celebrate"): a little crouch first, up, and a soft landing. It moves her whole figure (like
  // the 3D model's reactions group, so the live views frame it the same), and her body bends with it (her model's body Y:
  // down in the crouch and the landing, up in the air), which her chest's physics feels.
  const hop = { y: 0, squash: 0 };
  function hopPose(dt) {
    hop.y = 0; hop.squash = 0; hopBody = 0;
    if (act.hop < 0) return;
    act.hop += dt;
    const p = act.hop / 0.66;
    if (p >= 1) { act.hop = -1; return; }
    if (RM) return;
    if (p < 0.12) { const u = Math.sin((p / 0.12) * Math.PI / 2); hop.squash = -0.035 * u; hopBody = 4 * u; }   // crouch
    else if (p < 0.88) {
      const q = (p - 0.12) / 0.76;
      hop.y = Math.sin(q * Math.PI) * 0.12;
      hop.squash = 0.03 * Math.cos(q * Math.PI);
      hopBody = 4 * Math.cos(Math.min(1, q * 3) * Math.PI / 2) - 2.5 * Math.sin(q * Math.PI);
      if (act.cheer < 0) bothArms(() => [10 * Math.sin(q * Math.PI), 6 * Math.sin(q * Math.PI)]);   // her arms lift a little in the air
    } else { const u = Math.sin(((p - 0.88) / 0.12) * Math.PI); hop.squash = -0.03 * u; hopBody = 3 * u; }   // landing
  }
  function body3D() {
    model.fx.position.set(0, hop.y, 0);
    model.fx.scale.set(1 - hop.squash * 0.5, 1 + hop.squash, 1);
  }

  // ---------- reactions ----------
  const worldPos = (o, lift = 0) => o.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, lift, 0));
  function awayLook(lx, ly, ex, ey, seconds) {
    look.away = { lx, ly, ex, ey };
    look.awayUntil = clock + seconds;
  }
  function startWave() {
    if (act.wave >= 0) return;
    dancing = false;
    act.wave = 0;
    act.waveNear = closeUp ? 1 : 0;
    look.atViewerUntil = clock + 3;
  }
  function react(type) {
    setMood(type === 'tap' ? 'happy' : type);
    const mk = model.marks;
    switch (type) {
      case 'neutral': break;
      case 'wave': startWave(); break;
      case 'tap':
      case 'happy':
        if (!RM && act.hop < 0) act.hop = 0;
        if (type === 'tap' && /^(face|nose|blush|ear_|eye_|brow_|mouth_|hair_front|hair_side)/.test(model.lastHit || '')) expr.blushUntil = clock + 2.5;   // a tap on her face: she blushes
        effects?.spawnHearts(worldPos(mk.chest, 0.1), { count: 9 });
        look.atViewerUntil = clock + 1.6;
        break;
      case 'love':
        if (!RM && act.sway < 0) act.sway = 0;
        effects?.spawnHearts(worldPos(mk.head, 0.05), { count: 18, spread: 0.6, size: 0.12, rise: 1 });
        look.atViewerUntil = clock + 2.2;
        onGlow(0xff5c8a, 1.2);
        break;
      case 'shy':
        awayLook(-0.55, -0.6, -0.8, -0.85, 2.4);       // down and to the side
        effects?.spawnHearts(worldPos(mk.head, 0.1), { count: 4, spread: 0.25, size: 0.07, rise: 0.5 });
        onGlow(0xff5c8a, 0.7);
        break;
      case 'celebrate':
        if (!RM && act.hop < 0) act.hop = 0;
        if (!RM) act.cheer = 0;
        effects?.spawnHearts(worldPos(mk.head, 0.05), { count: 24, spread: 0.7, size: 0.12, rise: 1.1 });
        look.atViewerUntil = clock + 2.5;
        onGlow(0xff5c8a, 1);
        if (!closeUp && !dancing) nextDance = clock + 0.9;
        break;
      case 'sad': awayLook(0.05, -0.75, 0, -0.9, 3.5); break;          // she looks down for a few seconds
      case 'jealous': awayLook(-0.75, 0.05, -1, 0.15, 1.6); break;     // a glance away
      case 'dance': startDance(); break;
      case 'nod': if (act.nod < 0) act.nod = 0; break;
      case 'okay': if (act.nod < 0) act.nod = 0; look.atViewerUntil = clock + 1.6; break;
      case 'hmm': if (act.hmm < 0) act.hmm = 0; look.atViewerUntil = clock + 1.9; break;
      case 'worried': if (act.shake < 0) act.shake = 0; look.atViewerUntil = clock + 2; break;
      default: console.warn('[agi1_2d] unknown reaction:', type);
    }
  }
  function hello() {
    startWave();
    setMood('wave');
    nextDance = clock + FIRST_DANCE_AFTER;
  }

  // the first frames: settle everything where it belongs (no swinging in from nowhere)
  update(1 / 60);
  physics.reset();
  update(1 / 60);

  return {
    update, react, hello,
    beforeMixer() {},                                  // (the 3D AGI-1 needs this; nothing to undo here)
    setPointer(pointer) { look.pointer = pointer ? { x: pointer.x, y: pointer.y } : null; },
    // up close (zoomed in, or in a live view): no surprise dances, and one in progress ends softly (her hands in the air would
    // widen the live view's portrait to her waist)
    setCloseUp(on) {
      closeUp = !!on;
      if (closeUp && dancing && danceT < DANCE_LENGTH - 0.8) danceT = DANCE_LENGTH - 0.8;
    },
    setTalk(level) { talk.level = Number.isFinite(level) ? clamp(level, 0, 1) : 0; },
    setAttention(mode) {
      const next = mode === 'listening' || mode === 'thinking' ? mode : 'idle';
      if (next !== attention && next !== 'idle' && blink.t < 0) blink.next = clock + 0.15;
      attention = next;
    },
    get style() { return '2d'; },
    get dancing() { return dancing; },
    get mouthOpen() { return talk.open; },
    get blinking() { return blinkAmt; },
    get attention() { return attention; },
    get mood() { return expr.mood; },
    get expression() {
      return { grin: expr.grin, blush: expr.blush, lids: expr.lids, happy: expr.happy, blink: blinkAmt,
        eyes: get('ParamEyeLOpen'), mouth: get('ParamMouthOpenY'), cheek: get('ParamCheek') };
    },
    get hair() {
      const lag = Math.max(...['ParamHairFront', 'ParamHairSide', 'ParamHairBack'].map((id) => Math.abs(get(id))));
      return { lag, front: get('ParamHairFront'), side: get('ParamHairSide'), back: get('ParamHairBack'), on: true };
    },
    get pose() { return { ...P, hop: model.fx.position.y }; },
    get params() { return Object.fromEntries(Object.keys(at).map((id) => [id, get(id)])); },
    get chest() { return { x: get('ParamChestX'), y: get('ParamChestY'), on: !RM }; },   // her chest's follow-through (-1..1)
    get waving() { return act.wave >= 0; },
  };
}
