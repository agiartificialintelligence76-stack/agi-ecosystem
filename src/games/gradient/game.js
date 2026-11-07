// GRADIENT DESCENT on agi1.app (2026-11-08): 3D mini golf on glowing loss landscapes. The course is a smooth height
// field, the ball is the model, the cup is the global minimum; the valleys that aren't the lowest are local minima where
// the ball settles and wastes strokes. Three courses of six handmade holes, plus a daily hole.
//
// terrain.js / course.js / holes.js / daily.js are the landscapes, physics.js the ball, ai.js the demo's golfer,
// score.js the card and AGI-1's lines (all pure); scene.js draws it in 3D (three.js), sound.js plays it, ui.js holds the
// page's own bits. This file is the run: the kit's frame, input (slingshot aim, camera, keys), the camera rig, the
// juice, the cards between holes, the title and the self-playing demo (`?demo`).
import './style.css';
import { createShell, el } from '../kit/shell.js';
import { createLoop } from '../kit/loop.js';
import { fitCanvas } from '../kit/canvas.js';
import { Particles, FloatText, Shake, rng, clamp, approach, TAU } from '../kit/fx.js';
import { DEMO, SEED, REDUCED, TOUCH, QUERY } from '../kit/env.js';
import { COURSES, HOLES } from './holes.js';
import { buildHole } from './course.js';
import { PHYS, createBall, shoot, step, simulate, basinOf } from './physics.js';
import { planShot } from './ai.js';
import { dailyDef, dateKey } from './daily.js';
import { resultOf, vsPar, totals, LINES, holeLine, courseLine, MAX_STROKES } from './score.js';
import { createScene } from './scene.js';
import { createSound, courseMusic } from './sound.js';
import { createHud, holeCard, scorecard } from './ui.js';

const TAGLINE = 'Roll down the loss. Find the lowest point.';
const FACE = '/images/landing/agi1-face.webp';
const root = document.getElementById('ak-root');

const shell = createShell({
  game: 'gradient', name: 'GRADIENT DESCENT', root,
  howTo: {
    intro: 'Mini golf on loss landscapes. The cup is always the lowest point.',
    steps: [
      ['Pull back to putt', 'Drag back from the ball like a slingshot: the arrow shows where it goes and how hard. Let go to putt.'],
      ['Read the contours', 'Each line is one step of height. Close lines are steep. The ball rolls downhill and settles in the dips.'],
      ['Skip the local minima', 'Every dip that isn’t the lowest is a trap: the ball stops there and costs you strokes.'],
      ['Mind the hazards', 'Posts bounce. Hatched weight-decay patches are sticky. A NaN pit costs a stroke and puts you back.'],
      ['Beat par', 'Fewer strokes than par is a birdie or better. After eight strokes the ball is picked up.'],
    ],
    touch: [['Drag from the ball', 'Aim and putt'], ['Drag elsewhere', 'Turn the view'], ['Pinch', 'Zoom'], ['Map', 'The whole landscape']],
    keys: [['Drag from the ball', 'Aim and putt'], ['← →  ↑ ↓', 'Aim · power'], ['Space · Enter', 'Putt'], ['Right-drag · wheel', 'Turn · zoom'], ['M · C', 'Map · recentre'], ['Esc · P', 'Pause']],
  },
  onPause: () => { cancelAim(); sound.stop(); },
  onResume: () => { if (cardNode) reopenCard(); },
  onRestart: () => restart(),
  onQuit: () => toTitle(),
});
const sound = createSound(shell.audio);
const music = courseMusic();
const holeChip = shell.chip('Hole', '1/6');
holeChip.node.classList.add('gd-chip-hole');
const parChip = shell.chip('Par', 3);
const strokeChip = shell.chip('Strokes', 0, { accent: true });

// ---------- the stage: the 3D canvas, a vignette, the effects canvas on top (it takes the pointer) ----------
const glCanvas = el('canvas', { class: 'gd-gl', role: 'img', 'aria-label': 'A 3D loss landscape with a ball and a cup' });
const vignette = el('div', { class: 'gd-vignette', 'aria-hidden': 'true' });
const fxCanvas = el('canvas', { class: 'gd-fx', 'aria-hidden': 'true' });
shell.stage.append(glCanvas, vignette, fxCanvas);
const ui = createHud(shell.stage);
const scene = createScene(glCanvas, { reduced: REDUCED });
const fxView = fitCanvas(fxCanvas, { maxDpr: 2 });
const parts = new Particles(260);
const floats = new FloatText();
const shake = new Shake({ max: 7, decay: 2.2 });
const fontReady = document.fonts?.load?.("900 40px 'AK Display'").then(() => document.fonts.load("800 40px 'AK Mono'")).catch(() => {});

// ---------- state ----------
let mode = 'boot';        // boot · title · play · demo
let phase = 'idle';       // intro · aim · roll · sunk · pit · done · card
let phaseT = 0, simT = 0, renderT = 0;
let run = null;           // { kind: 'course' | 'daily' | 'demo', course, idx, defs, scores, stats }
let hole = null, def = null;
const ball = createBall(0, 0);
let strokes = 0, lastSpot = [0, 0];
const events = [];
let firstShot = true, holeSaid = new Set();
let sinkFrom = null, pitAt = null, glitchT = 0, flashBall = 0, squash = 0;
let cardNode = null, cardKeys = null;
const look = rng(SEED || 20261108);
const pick = (arr) => arr[Math.floor(look.next() * arr.length) % arr.length];

// ---------- the camera rig (eased toward its goal) ----------
const cam = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0.6, dist: 12, ax: 0, ay: 0, az: 0 };
const goal = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0.6, dist: 12, ax: 0, ay: 0, az: 0 };
let camMode = 'aim';      // aim · follow · map · intro · title
let zoom = 1, userTurned = false, mapOn = false;
const portrait = () => scene && scene.size.h > scene.size.w * 1.15;
function baseDist() {
  const s = scene.size;
  const narrow = s.w / Math.max(1, s.h);
  return (narrow < 0.7 ? 11.5 : narrow < 1 ? 10.5 : 9.5) * zoom;
}
function aimYaw() {
  const dx = hole.cup[0] - ball.x, dz = hole.cup[1] - ball.z;
  return Math.atan2(-dx, -dz);
}
function groundY(x, z) { return hole ? hole.field.h(x, z) : 0; }
// the putt's direction straight at the cup (the angle in the ground's x, z)
function cupAngle() { return Math.atan2(hole.cup[1] - ball.z, hole.cup[0] - ball.x); }
function setGoal() {
  if (!hole) return;
  const by = groundY(ball.x, ball.z) + PHYS.R;
  if (camMode === 'map') {
    const [hx, hz] = hole.half;
    const fov = scene.camera.fov * Math.PI / 180, asp = scene.size.w / Math.max(1, scene.size.h);
    const need = Math.max(hz * 1.08, (hx * 1.08) / Math.max(0.3, asp));
    goal.x = 0; goal.z = 0; goal.y = (hole.hmin + hole.hmax) / 2;
    goal.pitch = 1.32; goal.dist = need / Math.tan(fov / 2) + 2;
    goal.ax = 0; goal.ay = goal.y; goal.az = 0;
    if (!userTurned) goal.yaw = Math.round(cam.yaw / (Math.PI / 2)) * (Math.PI / 2);
    return;
  }
  if (camMode === 'title') {
    // the whole block, turning slowly, as big as fits across (a phone's narrow view sets the distance), a little high
    const big = Math.hypot(hole.half[0], hole.half[1]);
    const vf = scene.camera.fov * Math.PI / 180, asp = scene.size.w / Math.max(1, scene.size.h);
    const hf = 2 * Math.atan(Math.tan(vf / 2) * asp);
    goal.x = 0; goal.z = 0; goal.y = (hole.hmin + hole.hmax) / 2;
    goal.yaw = renderT * 0.06 + 0.6; goal.pitch = 0.6;
    goal.dist = Math.max(big / Math.tan(hf / 2) * 1.02, big / Math.tan(vf / 2) * 1.25);
    const up = Math.tan(vf * (portrait() ? 0.16 : 0.04)) * goal.dist;
    goal.ax = 0; goal.ay = goal.y - up; goal.az = 0;
    return;
  }
  goal.x = ball.x; goal.y = by; goal.z = ball.z;
  if (camMode === 'follow') {
    const sp = Math.hypot(ball.vx, ball.vz);
    goal.dist = baseDist() * (DEMO ? 1.12 : 1) + Math.min(4, sp * 0.3);
    const k = Math.min(1, sp / 6) * 1.6;
    goal.ax = ball.x + (sp > 0.05 ? (ball.vx / sp) * k : 0); goal.ay = by; goal.az = ball.z + (sp > 0.05 ? (ball.vz / sp) * k : 0);
    if (DEMO) { // the demo keeps the cup in the picture
      goal.ax = ball.x * 0.7 + hole.cup[0] * 0.3; goal.az = ball.z * 0.7 + hole.cup[1] * 0.3;
    }
    return;
  }
  // aiming (and the intro's landing): behind the ball, looking towards the cup, the ball low in the picture
  if (!userTurned) goal.yaw = aimYaw();
  goal.pitch = userTurned ? goal.pitch : (DEMO ? 0.86 : 0.7);
  goal.dist = baseDist() * (DEMO ? 1.15 : 1);
  const ahead = goal.dist * 0.3;
  goal.ax = ball.x - Math.sin(goal.yaw) * ahead; goal.ay = by; goal.az = ball.z - Math.cos(goal.yaw) * ahead;
}
// the ball must stay in sight: if a hill stands between the camera and the ball, the camera rises until it doesn't
function clearView() {
  if (!hole || camMode === 'map' || camMode === 'title') return;
  const tx = goal.x, ty = goal.y, tz = goal.z;
  for (let tries = 0; tries < 7; tries++) {
    const cp = Math.cos(goal.pitch);
    const cx = tx + goal.dist * cp * Math.sin(goal.yaw), cy = ty + goal.dist * Math.sin(goal.pitch), cz = tz + goal.dist * cp * Math.cos(goal.yaw);
    let blocked = false;
    for (let k = 1; k <= 10 && !blocked; k++) {
      const f = k / 11;
      const px = tx + (cx - tx) * f, py = ty + (cy - ty) * f, pz = tz + (cz - tz) * f;
      if (Math.abs(px) > hole.half[0] || Math.abs(pz) > hole.half[1]) break;
      if (groundY(px, pz) > py - 0.25) blocked = true;
    }
    if (!blocked) return;
    goal.pitch = Math.min(1.35, goal.pitch + 0.1);
  }
}
function snapCam() { setGoal(); clearView(); Object.assign(cam, goal); }
function stepCam(dt) {
  setGoal();
  if (!userTurned) clearView();
  const r = camMode === 'follow' ? 5 : camMode === 'intro' ? 1.6 : camMode === 'map' ? 4 : 3.4;
  for (const k of ['x', 'y', 'z', 'pitch', 'dist', 'ax', 'ay', 'az']) cam[k] = approach(cam[k], goal[k], r, dt);
  let dy = goal.yaw - cam.yaw;
  while (dy > Math.PI) dy -= TAU;
  while (dy < -Math.PI) dy += TAU;
  cam.yaw = approach(cam.yaw, cam.yaw + dy, r * (camMode === 'title' ? 2 : 1), dt);
  const sx = shake.x * 0.012, sy = shake.y * 0.012;
  scene.setCamera([cam.x + sx, cam.y + sy, cam.z], cam.yaw, cam.pitch, cam.dist, [cam.ax + sx, cam.ay + sy, cam.az]);
}

// ---------- the hole ----------
function loadHole(d, { start = null, intro = true } = {}) {
  def = d;
  hole = buildHole(d);
  scene.setHole(hole);
  const s = start || hole.start;
  Object.assign(ball, createBall(s[0], s[1]));
  lastSpot = [s[0], s[1]];
  strokes = 0;
  holeSaid = new Set();
  sinkFrom = null; pitAt = null;
  scene.resetSpin(); scene.trailClear(); scene.setAim(null); scene.setPreview([], 0); scene.setPin(0);
  strokeChip.set(0);
  parChip.set(d.par);
  holeChip.set(run.kind === 'daily' ? 'Daily' : `${run.idx + 1}/${run.defs.length}`);
  zoom = 1; userTurned = false; mapOn = false; ui.mapBtn.setAttribute('aria-pressed', 'false');
  // the intro: from high above the whole landscape, down behind the ball
  camMode = 'map'; snapCam();
  cam.yaw = aimYaw() + 0.9; cam.pitch = 1.1;
  phase = intro ? 'intro' : 'aim'; phaseT = 0;
  camMode = intro ? 'intro' : 'aim';
  if (!intro) snapCam();
  const kicker = run.kind === 'daily' ? `Daily hole · ${d.key} · par ${d.par}` : `Hole ${run.idx + 1} · par ${d.par}`;
  ui.setBanner({ kicker, title: d.name, line: d.pun });
  bannerT = DEMO ? 9 : 0;
  stampT = 9; sayT = 9;
  if (mode === 'play') sound.hole();
}

// ---------- shots ----------
let aim = null;           // { angle, power, from: 'pointer' | 'keys' | 'demo' }
let previewKey = '';
const previewPts = [];
function showAim() {
  if (!aim || phase !== 'aim') { scene.setAim(null); scene.setPreview([], 0); return; }
  scene.setAim({ angle: aim.angle, power: aim.power, alpha: aim.power < PHYS.MIN_POWER ? 0.35 : 0.95 }, ball.x, ball.z);
  const key = `${aim.angle.toFixed(3)}:${aim.power.toFixed(3)}`;
  if (key === previewKey) return;
  previewKey = key;
  previewPts.length = 0;
  if (aim.power >= PHYS.MIN_POWER) {
    simulate(hole, ball.x, ball.z, aim.angle, aim.power, { maxT: def.preview ?? 0.5, every: 5, track: (x, z) => { previewPts.push(x, z); } });
  }
  scene.setPreview(previewPts, previewPts.length / 2, 0.95);
}
function cancelAim() { aim = null; aimPtr = null; showAim(); }

function takeShot(angle, power) {
  if (phase !== 'aim' || power < PHYS.MIN_POWER) return;
  lastSpot = [ball.x, ball.z];
  shoot(ball, angle, power);
  strokes++;
  strokeChip.set(strokes, { pop: true });
  phase = 'roll'; phaseT = 0;
  camMode = 'follow'; mapOn = false; ui.mapBtn.setAttribute('aria-pressed', 'false');
  aim = null; aimPtr = null; showAim();
  scene.trailClear();
  squash = 1;
  if (!DEMO) { sound.putt(power); shell.haptic(power > 0.7 ? 18 : 10); }
  burstAtBall({ count: 6 + Math.round(power * 8), colors: ['#fffaf0', '#ffc933'], speed: [40, 120 + power * 120] });
  if (firstShot) { firstShot = false; hintT = 99; }
}

function onEvent(e) {
  if (e.e === 'rail' || e.e === 'post') {
    if (e.v < 0.5) return;
    if (!DEMO) sound.bounce(e.v, e.e === 'post');
    if (e.e === 'post') { scene.flashPost(e.i); shake.kick(Math.min(0.2, e.v * 0.02)); shell.haptic(8); }
    burstAtBall({ count: Math.min(12, 3 + Math.round(e.v)), colors: e.e === 'post' ? ['#ffc933', '#ff4da6', '#fffaf0'] : ['#e4d9ff', '#fffaf0'], speed: [40, 60 + e.v * 18] });
  } else if (e.e === 'lip') {
    if (!DEMO) sound.lip();
    floatAtBall('LIP OUT', '#ff4da6', 22);
    shell.haptic(12);
    if (!holeSaid.has('lip')) { holeSaid.add('lip'); say(pick(LINES.lip), 2.4); }
  }
}

function onSink() {
  phase = 'sunk'; phaseT = 0;
  sinkFrom = [ball.x, ball.z];
  const res = resultOf(strokes, def.par);
  scene.ripple(1); scene.popPin();
  if (!DEMO) { sound.sink(res.tier); shell.haptic(res.tier >= 2 ? [16, 40, 24] : 14); sound.stop(); }
  ui.setStamp(res, run.kind === 'daily' ? `${strokes} stroke${strokes === 1 ? '' : 's'} · ${vsPar(strokes, def.par)}` : `${strokes} stroke${strokes === 1 ? '' : 's'} · par ${def.par}`);
  stampT = 0;
  const P = projectGround(hole.cup[0], hole.cup[1], 0.2);
  parts.burst({ x: P.x, y: P.y, count: 18 + res.tier * 10, speed: [120, 320 + res.tier * 60], angle: [-Math.PI * 0.95, -Math.PI * 0.05], life: [0.6, 1.2], size: [4, 8], colors: ['#ffc933', '#ff4da6', '#3ff0c3', '#fffaf0', '#8b66ff'], gravity: 480, drag: 1.3, shape: 'square', spin: 10 });
  parts.burst({ x: P.x, y: P.y, count: 8, speed: [60, 120], life: [0.5, 0.8], size: [18, 30], colors: ['#3ff0c3'], drag: 2, shape: 'ring' });
  if (res.tier >= 2) shake.kick(0.18);
  if (!DEMO) say(holeLine(res, pick), 2.8);
}

function onPit(i) {
  phase = 'pit'; phaseT = 0;
  const p = hole.pits[i] || hole.pits[0];
  pitAt = [p.x, p.z, ball.x, ball.z];
  strokes++;
  strokeChip.set(strokes, { pop: true });
  if (run.stats) run.stats.pits++;
  glitchT = REDUCED ? 0 : 0.5;
  if (!DEMO) { sound.pit(); shell.haptic([20, 30, 20]); }
  floatAtBall('NaN  +1', '#3ff0c3', 26);
  shake.kick(0.22);
  if (!DEMO) say(pick(LINES.pit), 2.4);
}

function onRest() {
  if (strokes >= MAX_STROKES) { pickUp(); return; }
  phase = 'aim'; phaseT = 0;
  camMode = 'aim'; userTurned = false;
  previewKey = '';
  if (!DEMO) sound.stop();
  burstAtBall({ count: 6, colors: ['#e4d9ff', '#fffaf0'], speed: [20, 60], gravity: -40, size: [3, 6] });
  // a dip that isn't the lowest: tell them (once a hole)
  const b = basinOf(hole, ball.x, ball.z);
  if (!b.global && Math.hypot(b.x - ball.x, b.z - ball.z) < 1.8 && b.h > hole.cupH + 0.15) {
    floatAtBall('LOCAL MINIMUM', '#e4d9ff', 18);
    if (!DEMO) sound.localMin();
    if (!holeSaid.has('local') && !DEMO) { holeSaid.add('local'); say(pick(LINES.localMin), 2.8); }
  }
  if (DEMO) demoPlan = null;
}

function pickUp() {
  phase = 'done'; phaseT = 0;
  strokes = Math.max(strokes, MAX_STROKES);
  ui.setStamp({ name: 'PICKED UP', tone: 'lav' }, `${MAX_STROKES} on the card`);
  stampT = 0;
  if (!DEMO) { sound.stop(); say(pick(LINES.picked), 2.6); }
}

// ---------- the run ----------
function courseOf(n) { return COURSES[n - 1]; }
function startCourse(n) {
  closeCard();
  const c = courseOf(n);
  run = { kind: 'course', course: n, idx: 0, defs: c.holes.map((h) => ({ ...h, course: n, preview: h.preview ?? c.preview })), scores: [], stats: { aces: 0, birdies: 0, eagles: 0, pits: 0 } };
  mode = 'play';
  firstShot = n === 1 && !shell.store.read().played;
  hintT = 0;
  shell.started();
  loadHole(run.defs[0]);
  shell.audio.music(music);
}
function startDaily() {
  closeCard();
  const d = dailyDef(dateKey());
  run = { kind: 'daily', course: 0, idx: 0, defs: [d], scores: [], stats: { aces: 0, birdies: 0, eagles: 0, pits: 0 } };
  mode = 'play';
  firstShot = false;
  shell.started();
  loadHole(d);
  shell.audio.music(music);
}
function restart() {
  if (!run || run.kind === 'demo') return;
  if (run.kind === 'daily') startDaily(); else startCourse(run.course);
}
function nextFromCard() {
  closeCard();
  if (!run) return;
  if (run.idx >= run.defs.length - 1) { endRun(); return; }
  run.idx++;
  loadHole(run.defs[run.idx]);
}

function endHole() {
  run.scores[run.idx] = strokes;
  const res = resultOf(strokes, def.par);
  if (run.stats) {
    if (strokes === 1) run.stats.aces++;
    if (strokes - def.par === -1) run.stats.birdies++;
    if (strokes - def.par <= -2 && strokes > 1) run.stats.eagles++;
  }
  if (run.kind === 'demo') { demoNext(); return; }
  shell.store.update((d) => { d.played = true; d.holes = (Number(d.holes) || 0) + 1; if (strokes === 1) d.aces = (Number(d.aces) || 0) + 1; });
  if (run.kind === 'daily') { endRun(); return; }
  phase = 'card';
  const last = run.idx >= run.defs.length - 1;
  const { node } = holeCard({
    courseName: courseOf(run.course).name, holeNo: run.idx + 1, holeCount: run.defs.length, def, strokes,
    line: holeLine(res, pick), holes: run.defs, scores: run.scores, last,
    onNext: () => nextFromCard(), onMenu: () => { closeCard(); toTitle(); },
  });
  openCard(node, { enter: () => nextFromCard() });
}

function endRun() {
  shell.audio.stopMusic(); sound.stop();
  phase = 'end';
  const pars = run.defs.map((h) => h.par);
  const t = totals(run.scores, pars);
  if (run.kind === 'daily') {
    const key = `daily-${run.defs[0].key}`;
    const before = shell.store.best(key);
    shell.over({
      title: `Daily hole · ${run.defs[0].key}`, score: t.strokes, label: `Strokes · ${t.text === 'E' ? 'even par' : `${t.text} vs par`}`,
      bestKey: key, lower: true,
      stats: [['Par', String(t.par)], ['Vs par', t.text], ['NaN pits', String(run.stats.pits)], ['Hole', run.defs[0].name, { wide: false }]],
      line: before == null || t.strokes < before ? pick(LINES.daily) : pick(LINES.daily),
      share: `I converged in ${t.strokes} stroke${t.strokes === 1 ? '' : 's'} (${t.text === 'E' ? 'even' : t.text}) on today’s daily hole in GRADIENT DESCENT on agi1.app ⛳💜`,
      onAgain: () => startDaily(), onMenu: () => toTitle(), again: 'Play it again',
    });
    return;
  }
  const n = run.course, c = courseOf(n);
  const before = shell.store.best(`c${n}`);
  const isBest = before == null || t.strokes < before;
  const unlockedBefore = unlocked();
  shell.store.update((d) => { d.unlocked = Math.max(Number(d.unlocked) || 1, Math.min(3, n + 1)); d.done = { ...(d.done || {}), [n]: true }; });
  const sc = scorecard({ holes: run.defs, scores: run.scores, compact: true });
  const opened = n < 3 && unlockedBefore < n + 1 ? el('p', 'gd-unlock', el('b', null, 'Unlocked'), ` ${courseOf(n + 1).name}`) : null;
  shell.over({
    title: `${c.name} · done`, score: t.strokes, label: `Strokes · ${t.text === 'E' ? 'even par' : `${t.text} vs par`}`,
    bestKey: `c${n}`, lower: true,
    stats: [['Vs par', t.text === 'E' ? 'Even' : t.text], ['Hole-in-ones', String(run.stats.aces)], ['Birdies', String(run.stats.birdies + run.stats.eagles)], ['NaN pits', String(run.stats.pits)]],
    line: courseLine({ diff: t.diff, isBest: isBest && before != null }, pick),
    share: `I converged in ${t.strokes} strokes (${t.text === 'E' ? 'even par' : t.text}) on ${c.name} in GRADIENT DESCENT on agi1.app ⛳💜`,
    extra: el('div', 'gd-over-extra', opened, sc.node),
    onAgain: () => startCourse(n), onMenu: () => toTitle(),
    again: 'Play again',
  });
}

// ---------- my cards (between holes): Enter / Space for Next, Esc / P left to the shell (pause; it comes back) ----------
function openCard(node, keys) { cardNode = node; cardKeys = keys; shell.card(node, { label: node.querySelector('.ak-card-title')?.textContent || 'Scorecard' }); }
function closeCard() { if (cardNode) { cardNode = null; cardKeys = null; shell.closeCard(); } }
function reopenCard() { const n = cardNode, k = cardKeys; cardNode = null; openCard(n, k); }
addEventListener('keydown', (e) => {
  if (!cardNode || shell.state !== 'play' || e.ctrlKey || e.metaKey || e.altKey) return;
  if ((e.key === 'Enter' || e.key === ' ') && !e.target?.closest?.('button, a')) { e.preventDefault(); e.stopImmediatePropagation(); cardKeys?.enter?.(); }
}, { capture: true });

// ---------- the title: the landscape turning slowly, a ball rolling home ----------
let attract = null;        // { def, shot, t, ball }
function unlocked() { return clamp(Number(shell.store.read().unlocked) || 1, 1, 3); }
function courseBest(n) {
  const b = shell.store.best(`c${n}`);
  if (b == null) return null;
  const par = courseOf(n).holes.reduce((s, h) => s + h.par, 0);
  return `${b} (${vsPar(b, par)})`;
}
function toTitle() {
  closeCard();
  shell.audio.stopMusic(); sound.stop();
  mode = 'title'; phase = 'idle'; run = { kind: 'title', idx: 0, defs: [] };
  const d = HOLES.find((h) => h.id === 'banana');
  def = d; hole = buildHole(d); scene.setHole(hole);
  attract = { start: [-6.2, -0.4], t: 0, plan: null };
  Object.assign(ball, createBall(attract.start[0], attract.start[1]));
  camMode = 'title'; snapCam();
  ui.mapBtn.setAttribute('aria-pressed', 'false');
  const u = unlocked();
  const key = dateKey();
  const dBest = shell.store.best(`daily-${key}`);
  const modes = COURSES.map((c) => ({
    label: c.short, sub: c.n > u ? `Locked · finish ${courseOf(c.n - 1).short}` : courseBest(c.n) ? `Best ${courseBest(c.n)}` : `Course ${c.n} · 6 holes`,
    locked: c.n > u, lockedText: `Finish ${c.n > 1 ? courseOf(c.n - 1).name : ''} to open ${c.name}`,
    onClick: () => startCourse(c.n),
  }));
  modes.push({ label: 'Daily hole', sub: dBest != null ? `Today · best ${dBest}` : 'A new one today', onClick: () => startDaily() });
  const done = shell.store.read().done || {};
  const next = [1, 2, 3].find((n) => n <= u && !done[n]) || u;
  shell.title({
    logo: ['GRADIENT', { text: 'DESCENT', tone: 'accent' }], tagline: TAGLINE,
    play: next === 1 && !done[1] ? 'Play' : `Play ${courseOf(next).name}`,
    onPlay: () => startCourse(next), modes, best: null,
    extra: el('p', 'gd-title-say', el('img', { src: FACE, alt: '', width: 30, height: 30 }), el('span', 'ak-sr', 'AGI-1: '), pick(LINES.title)),
  });
}
function stepAttract(dt) {
  if (!attract) return;
  attract.t += dt;
  if (!attract.plan) {
    // a full putt round the banana's valley that drops (found with the demo's own search: tools/games/gradient)
    attract.plan = { angle: 0.1725, power: 1 };
    attract.t = -1.2;
  }
  if (attract.t >= 0 && !ball.moving && !ball.done) shoot(ball, attract.plan.angle, attract.plan.power);
  if (ball.moving) {
    const n = Math.max(1, Math.round(dt / PHYS.DT));
    for (let i = 0; i < n && ball.moving; i++) step(ball, hole, PHYS.DT, null);
    scene.trailPush(ball.x, ball.z);
  }
  if (ball.done) {
    if (attract.wait == null) { attract.wait = 0; if (ball.done === 'sink') scene.ripple(0.8); }
    attract.wait += dt;
    if (attract.wait > 2.4) {
      Object.assign(ball, createBall(attract.start[0], attract.start[1]));
      scene.resetSpin(); scene.trailClear(); attract.t = -0.6; attract.wait = null;
    }
  }
}

// ---------- the demo: AGI-1's golfer plays by itself (the arcade's preview) ----------
// the reel starts mid-banana: aimed at 5.6 s, putted at 6.6 s, the ball curves round the valley and drops at about
// 9.7 s, and the celebration runs to the end of the recorded window (5.7 to 11.7 s after the page opens)
const DEMO_REEL = [
  { id: 'banana', start: [-3.7, -3.4] },
  { id: 'twovalleys', start: null },
  { id: 'saddle', start: null },
  { id: 'double', start: null },
  { id: 'minima', start: null },
];
let demoR = null, demoPlan = null, demoAimT = 0, demoN = 0;
function startDemo() {
  mode = 'demo';
  demoR = rng(SEED || 7);
  run = { kind: 'demo', idx: 0, defs: [], scores: [], stats: { aces: 0, birdies: 0, eagles: 0, pits: 0 } };
  shell.started();
  demoLoad();
}
function demoLoad() {
  // (the arcade's preview is seed 7: it opens on the banana; other seeds open elsewhere in the reel)
  const r = DEMO_REEL[(demoN + (SEED ? (SEED + DEMO_REEL.length * 9 - 7) % DEMO_REEL.length : 0)) % DEMO_REEL.length];
  const d = HOLES.find((h) => h.id === r.id);
  run.defs = [d]; run.idx = 0;
  loadHole(d, { start: r.start });
  demoPlan = null; demoAimT = 0;
}
function demoNext() { demoN++; demoLoad(); }
function demoStep(dt) {
  if (phase !== 'aim') return;
  // the first putt waits for the recorder's window
  if (demoN === 0 && strokes === 0 && simT < 5.62) return;
  if (!demoPlan) { demoPlan = planShot(hole, ball.x, ball.z, { rand: demoR, noise: 0.6 }); demoAimT = 0; }
  demoAimT += dt;
  const k = Math.min(1, demoAimT / 0.7);
  const e = 1 - (1 - k) ** 3;
  aim = { angle: demoPlan.angle + Math.sin(demoAimT * 7) * 0.02 * (1 - k), power: demoPlan.power * e, from: 'demo' };
  showAim();
  if (demoAimT > 0.95) takeShot(demoPlan.angle, demoPlan.power);
}

// ---------- input: slingshot aim from the ball, orbit elsewhere, pinch and wheel to zoom ----------
const ptrs = new Map();
let aimPtr = null, pinch = null;
const P = { x: 0, y: 0 };
function ballScreen() {
  const y = groundY(ball.x, ball.z) + PHYS.R;
  return scene.project(ball.x, y, ball.z, { x: 0, y: 0 });
}
function projectGround(x, z, lift = 0) { return scene.project(x, groundY(x, z) + lift, z, { x: 0, y: 0 }); }
function grabRadius() { return TOUCH ? 72 : 56; }
function canAim() { return mode === 'play' && phase === 'aim' && shell.state === 'play' && !cardNode; }

fxCanvas.addEventListener('pointerdown', (e) => {
  if (mode !== 'play' || shell.state !== 'play') return;
  const r = fxCanvas.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  try { fxCanvas.setPointerCapture(e.pointerId); } catch { /* fine */ }
  if (e.cancelable) e.preventDefault();
  shell.audio.unlock();
  const orbitButton = e.pointerType === 'mouse' && e.button > 0;
  const b = ballScreen();
  let kind = 'orbit';
  if (!orbitButton && canAim() && !aimPtr && ptrs.size === 0 && Math.hypot(x - b.x, y - b.y) < grabRadius()) kind = 'aim';
  ptrs.set(e.pointerId, { x, y, x0: x, y0: y, kind });
  if (kind === 'aim') { aimPtr = e.pointerId; aim = { angle: cupAngle(), power: 0, from: 'pointer' }; kbAim = false; hintT = 99; }
  const orbiting = [...ptrs.values()].filter((p) => p.kind === 'orbit');
  if (orbiting.length === 2) {
    const [a, c] = orbiting;
    pinch = { d0: Math.hypot(a.x - c.x, a.y - c.y), z0: zoom };
  }
});
fxCanvas.addEventListener('pointermove', (e) => {
  const p = ptrs.get(e.pointerId);
  const r = fxCanvas.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  if (!p) { hover = { x, y }; return; }
  const dx = x - p.x, dy = y - p.y;
  p.x = x; p.y = y;
  if (p.kind === 'aim' && aimPtr === e.pointerId) { aimFromPointer(x, y); return; }
  const orbiting = [...ptrs.values()].filter((q) => q.kind === 'orbit');
  if (pinch && orbiting.length === 2) {
    const [a, c] = orbiting;
    const d = Math.hypot(a.x - c.x, a.y - c.y);
    zoom = clamp(pinch.z0 * (pinch.d0 / Math.max(20, d)), 0.45, 2.4);
    return;
  }
  if (p.kind === 'orbit') {
    userTurned = true;
    goal.yaw -= dx * 0.0085; cam.yaw -= dx * 0.0085;
    const pt = clamp(goal.pitch + dy * 0.006, 0.18, camMode === 'map' ? 1.5 : 1.42);
    goal.pitch = pt; cam.pitch = clamp(cam.pitch + dy * 0.006, 0.18, 1.5);
  }
});
function endPtr(e) {
  const p = ptrs.get(e.pointerId);
  if (!p) return;
  ptrs.delete(e.pointerId);
  if (pinch && [...ptrs.values()].filter((q) => q.kind === 'orbit').length < 2) pinch = null;
  if (p.kind === 'aim' && aimPtr === e.pointerId) {
    aimPtr = null;
    if (e.type !== 'pointercancel' && aim && aim.power >= PHYS.MIN_POWER && canAim()) takeShot(aim.angle, aim.power);
    else cancelAim();
  }
}
fxCanvas.addEventListener('pointerup', endPtr);
fxCanvas.addEventListener('pointercancel', endPtr);
fxCanvas.addEventListener('lostpointercapture', endPtr);
fxCanvas.addEventListener('contextmenu', (e) => e.preventDefault());
fxCanvas.addEventListener('wheel', (e) => {
  if (mode !== 'play') return;
  e.preventDefault();
  zoom = clamp(zoom * 1.0015 ** e.deltaY, 0.45, 2.4);
}, { passive: false });
let hover = null;

function aimFromPointer(x, y) {
  const b = ballScreen();
  const pd = Math.hypot(x - b.x, y - b.y);
  const s = scene.size;
  const full = Math.max(110, Math.min(s.w, s.h) * 0.34);
  const power = clamp((pd - 12) / full, 0, 1);
  let angle = aim?.angle ?? 0;
  if (pd > 6) {
    const gy = groundY(ball.x, ball.z);
    const g = scene.groundAt(x, y, gy);
    if (g && Math.hypot(g.x - ball.x, g.z - ball.z) < 60) angle = Math.atan2(ball.z - g.z, ball.x - g.x);
    else {
      // the pointer above the horizon: turn the screen's pull into the ground's directions
      const sx = x - b.x, sy = y - b.y;
      const rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw), fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
      const wx = sx * rx - sy * fx, wz = sx * rz - sy * fz;
      angle = Math.atan2(-wz, -wx);
    }
  }
  aim = { angle, power, from: 'pointer', px: x, py: y };
  showAim();
}

// keys: ← → aim, ↑ ↓ power, Space / Enter putt, M map, C recentre
let kbAim = false;
const held = new Set();
addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
  if (mode !== 'play' || shell.state !== 'play' || cardNode) return;
  if (e.target?.closest?.('input, select, textarea')) return;
  const k = e.key;
  const name = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down', A: 'left', D: 'right', W: 'up', S: 'down' }[k];
  if (name) {
    e.preventDefault();
    held.add(name);
    if (canAim() && !aimPtr && (!aim || aim.from !== 'keys')) { aim = { angle: cupAngle(), power: 0.45, from: 'keys' }; kbAim = true; hintT = 99; showAim(); }
    return;
  }
  if (k === ' ' || k === 'Enter') {
    if (e.target?.closest?.('button, a')) return;
    e.preventDefault();
    if (e.repeat || !canAim()) return;
    if (aim && aim.from === 'keys') takeShot(aim.angle, aim.power);
    else { aim = { angle: cupAngle(), power: 0.45, from: 'keys' }; kbAim = true; hintT = 99; showAim(); }
    return;
  }
  if (k === 'm' || k === 'M') { e.preventDefault(); toggleMap(); }
  if (k === 'c' || k === 'C') { e.preventDefault(); recentre(); }
});
addEventListener('keyup', (e) => {
  const name = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down', A: 'left', D: 'right', W: 'up', S: 'down' }[e.key];
  if (name) held.delete(name);
});
addEventListener('blur', () => held.clear());
let keyHoldT = 0;
function stepKeys(dt) {
  if (!aim || aim.from !== 'keys' || !canAim()) { keyHoldT = 0; return; }
  const turn = (held.has('left') ? 1 : 0) - (held.has('right') ? 1 : 0);
  const pw = (held.has('up') ? 1 : 0) - (held.has('down') ? 1 : 0);
  if (!turn && !pw) { keyHoldT = 0; return; }
  keyHoldT += dt;
  const speed = keyHoldT < 0.35 ? 0.45 : keyHoldT < 1 ? 0.9 : 1.6;
  // ← turns the shot to the left on screen (the camera looks along −yaw)
  aim.angle -= turn * speed * dt;
  aim.power = clamp(aim.power + pw * 0.55 * dt, 0.03, 1);
  showAim();
}

function toggleMap() {
  if (mode !== 'play' || !hole) return;
  mapOn = !mapOn;
  camMode = mapOn ? 'map' : phase === 'roll' ? 'follow' : 'aim';
  userTurned = false;
  ui.mapBtn.setAttribute('aria-pressed', String(mapOn));
  if (!DEMO) shell.audio.sfx(mapOn ? 'select' : 'back');
}
function recentre() {
  if (mode !== 'play' || !hole) return;
  mapOn = false; ui.mapBtn.setAttribute('aria-pressed', 'false');
  userTurned = false; zoom = 1;
  camMode = phase === 'roll' ? 'follow' : 'aim';
  if (!DEMO) shell.audio.sfx('back');
}
ui.mapBtn.addEventListener('click', () => toggleMap());
ui.centerBtn.addEventListener('click', () => recentre());

// ---------- words over the playfield ----------
let bannerT = 9, stampT = 9, sayT = 9, sayDur = 2.6, hintT = 99;
function say(text, dur = 2.6) { ui.sayText.textContent = text; sayT = 0; sayDur = dur; }
function burstAtBall({ count = 8, colors = ['#fffaf0'], speed = [40, 140], gravity = 260, size = [3, 7] } = {}) {
  const b = ballScreen();
  parts.burst({ x: b.x, y: b.y, count, speed, life: [0.3, 0.7], size, colors, gravity, drag: 2, shape: 'circle' });
}
function floatAtBall(text, color, size = 22) {
  const b = ballScreen();
  floats.add({ x: clamp(b.x, 90, fxView.w - 90), y: Math.max(120, b.y - 40), text, color, size, life: 1.2, rise: 50 });
}
const styled = new WeakMap();
function put(node, prop, value) {
  let m = styled.get(node);
  if (!m) styled.set(node, (m = {}));
  if (m[prop] === value) return;
  m[prop] = value;
  node.style[prop] = value;
}
const easeOut = (t) => 1 - (1 - t) ** 3;
function animateDom(dt) {
  const slide = REDUCED ? 0 : 1;
  bannerT += dt;
  const bIn = Math.min(1, bannerT / 0.4), bOut = Math.max(0, (bannerT - 2.6) / 0.45);
  const bv = bannerT < 3.05 ? Math.min(bIn, 1 - bOut) : 0;
  put(ui.banner, 'opacity', bv.toFixed(3));
  put(ui.banner, 'transform', `translate(-50%, ${(((1 - easeOut(bIn)) * -16 + bOut * -10) * slide).toFixed(1)}px)`);
  stampT += dt;
  const sIn = Math.min(1, stampT / 0.32), sOut = Math.max(0, (stampT - 2.0) / 0.35);
  const sv = stampT < 2.35 ? Math.min(sIn, 1 - sOut) : 0;
  put(ui.stamp, 'opacity', sv.toFixed(3));
  const sc = REDUCED ? 1 : 1 + (1 - easeOut(sIn)) * 0.9;
  put(ui.stamp, 'transform', `translate(-50%, -50%) rotate(-4deg) scale(${sc.toFixed(3)})`);
  sayT += dt;
  const aIn = Math.min(1, sayT / 0.3), aOut = Math.max(0, (sayT - sayDur) / 0.35);
  const av = sayT < sayDur + 0.35 ? Math.min(aIn, 1 - aOut) : 0;
  put(ui.say, 'opacity', av.toFixed(3));
  put(ui.say, 'transform', `translate(-50%, ${(((1 - easeOut(aIn)) * 16 + aOut * 10) * slide).toFixed(1)}px)`);
  hintT += dt;
  const showHint = mode === 'play' && phase === 'aim' && firstShot && !aim && hintT > 0.4;
  if (showHint && !ui.hint.textContent) ui.hint.textContent = TOUCH ? 'Pull back from the ball, let go to putt' : 'Pull back from the ball, let go to putt · or arrows and Space';
  put(ui.hint, 'opacity', showHint ? (0.82 + 0.18 * Math.sin(hintT * 4)).toFixed(2) : '0');
  put(ui.tools, 'opacity', mode === 'play' && phase !== 'card' ? '1' : '0');
  put(ui.tools, 'visibility', mode === 'play' && !DEMO ? 'visible' : 'hidden');
}

// ---------- the effects canvas: the slingshot's band, the power, the grab ring, sparkles, the glitch ----------
const NF = "800 15px 'AK Mono', ui-monospace, monospace";
function drawFx(dt) {
  parts.update(dt); floats.update(dt);
  const ctx = fxView.begin();
  if (!ctx) return;
  const b = mode === 'play' || mode === 'demo' ? ballScreen() : null;
  // the grab ring: where to start pulling
  if (b && canAim() && !aim) {
    const pulse = REDUCED ? 0.5 : 0.5 + 0.5 * Math.sin(renderT * 3.2);
    const r = 22 + pulse * 6;
    ctx.save();
    ctx.lineWidth = 2.5; ctx.strokeStyle = `rgba(255,250,240,${0.45 + 0.35 * pulse})`;
    ctx.setLineDash([5, 6]); ctx.lineDashOffset = -renderT * 14;
    ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  // the slingshot: a band from the ball to the finger, and the power on a sticker
  if (b && aim && phase === 'aim' && aim.power > 0) {
    let fx, fy;
    if (aim.from === 'pointer' && aim.px != null) { fx = aim.px; fy = aim.py; }
    else {
      // keys and the demo: a virtual finger behind the ball
      const back = projectGround(ball.x - Math.cos(aim.angle) * (0.6 + aim.power * 2.2), ball.z - Math.sin(aim.angle) * (0.6 + aim.power * 2.2), PHYS.R);
      fx = back.x; fy = back.y;
    }
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#170a36'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(fx, fy); ctx.stroke();
    ctx.strokeStyle = '#fffaf0'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(fx, fy); ctx.stroke();
    ctx.fillStyle = '#fffaf0'; ctx.strokeStyle = '#170a36'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(fx, fy, 9, 0, TAU); ctx.fill(); ctx.stroke();
    // the power, in a little pill above the ball
    const txt = aim.power < PHYS.MIN_POWER ? 'cancel' : `${Math.round(aim.power * 100)}%`;
    ctx.font = NF; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // (beside the finger, above it: a thumb never covers it)
    const w = ctx.measureText(txt).width + 18, px = clamp(fx, w / 2 + 8, fxView.w - w / 2 - 8), py = clamp(fy - 44, 84, fxView.h - 20);
    ctx.fillStyle = aim.power > 0.85 ? '#ff4da6' : aim.power > 0.5 ? '#ffc933' : '#3ff0c3';
    ctx.strokeStyle = '#170a36'; ctx.lineWidth = 2.5;
    roundRectPath(ctx, px - w / 2, py - 13, w, 26, 13); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#170a36'; ctx.fillText(txt, px, py + 1);
    ctx.restore();
  }
  parts.draw(ctx);
  floats.draw(ctx);
  // a NaN pit: the picture tears into glitchy slices
  if (glitchT > 0 && !REDUCED) {
    glitchT -= dt;
    const k = Math.max(0, glitchT / 0.5);
    const W = fxView.w, H = fxView.h, cw = glCanvas.width, ch = glCanvas.height, sx = cw / W, sy = ch / H;
    for (let i = 0; i < 7; i++) {
      const y = ((Math.sin(renderT * 47 + i * 13.1) * 0.5 + 0.5) * H) | 0;
      const h = 6 + ((i * 17) % 24);
      const off = Math.sin(renderT * 91 + i) * 26 * k;
      try { ctx.drawImage(glCanvas, 0, y * sy, cw, h * sy, off, y, W, h); } catch { /* not ready */ }
      ctx.fillStyle = i % 2 ? `rgba(255,77,166,${0.35 * k})` : `rgba(63,240,195,${0.3 * k})`;
      ctx.fillRect(0, y, W, 2);
    }
    void sx;
  }
}
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// ---------- the loop ----------
function update(dt) {
  simT += dt;
  if (mode !== 'play' && mode !== 'demo') return;
  phaseT += dt;
  if (phase === 'intro') {
    const len = mode === 'demo' ? (demoN === 0 ? 4.4 : 1.4) : 1.5;
    if (phaseT > len * 0.45 && camMode === 'intro') camMode = 'aim';
    if (phaseT > len) { phase = 'aim'; phaseT = 0; camMode = 'aim'; previewKey = ''; }
    return;
  }
  if (phase === 'aim') {
    stepKeys(dt);
    if (mode === 'demo') demoStep(dt);
    return;
  }
  if (phase === 'roll') {
    for (let s = 0; s < 2; s++) {
      events.length = 0;
      const d = step(ball, hole, PHYS.DT, events);
      for (const e of events) onEvent(e);
      if (d === 'sink') { onSink(); break; }
      if (d === 'pit') { onPit(events.find((e) => e.e === 'pit')?.i ?? 0); break; }
      if (d === 'rest') { onRest(); break; }
    }
    if (ball.moving) scene.trailPush(ball.x, ball.z);
    // the pin lifts out of the way as the ball comes close
    return;
  }
  if (phase === 'sunk') { if (phaseT > (mode === 'demo' ? 2.7 : 2.3)) endHole(); return; }
  if (phase === 'pit') {
    if (phaseT > 1.15) {
      ball.x = lastSpot[0]; ball.z = lastSpot[1]; ball.vx = 0; ball.vz = 0; ball.done = null; ball.moving = false;
      scene.resetSpin(); scene.trailClear();
      pitAt = null;
      if (strokes >= MAX_STROKES) { pickUp(); return; }
      phase = 'aim'; phaseT = 0; camMode = 'aim'; userTurned = false; previewKey = '';
      if (!DEMO) sound.respawn();
      burstAtBall({ count: 10, colors: ['#3ff0c3', '#fffaf0'], speed: [40, 130] });
      if (mode === 'demo') demoPlan = null;
    }
    return;
  }
  if (phase === 'done') { if (phaseT > 1.6 && (run.kind === 'course' || run.kind === 'demo')) { phase = 'idle'; endHole(); } else if (phaseT > 1.6 && run.kind === 'daily' && shell.state === 'play') { phase = 'idle'; endHole(); } }
}

let dpr = Math.min(window.devicePixelRatio || 1, 2);
const fixedDpr = DEMO || QUERY.has('hq');
function layout() {
  if (!scene) return;
  const r = shell.stage.getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
  scene.camera.fov = w / h < 0.8 ? 50 : 42;
  scene.resize(w, h, dpr);
}
let slowT = 0;
function adapt(frameDt) {
  if (fixedDpr || dpr <= 1 || document.visibilityState !== 'visible') return;
  if (frameDt > 1 / 42 && frameDt < 0.099) slowT += frameDt; else slowT = Math.max(0, slowT - frameDt * 0.5);
  if (slowT > 2.5) { slowT = 0; dpr = Math.max(1, Math.round((dpr - 0.25) * 4) / 4); layout(); }
}

function render(alpha, frameDt) {
  if (!scene || !hole) return;
  const paused = shell.state === 'pause';
  const dt = paused ? 0 : Math.min(frameDt, 0.05);
  renderT += dt;
  if (mode === 'title') stepAttract(dt);
  shake.update(dt);
  // the ball as drawn: rolling, dropping into the cup (a little spiral), swallowed by a pit
  let bx = ball.x, bz = ball.z, sc = 1, sink = 0;
  if (phase === 'sunk' && sinkFrom) {
    const k = Math.min(1, phaseT / 0.45), e = 1 - (1 - k) ** 2;
    const a = k * 5;
    const r = (1 - e) * Math.hypot(sinkFrom[0] - hole.cup[0], sinkFrom[1] - hole.cup[1]);
    const a0 = Math.atan2(sinkFrom[1] - hole.cup[1], sinkFrom[0] - hole.cup[0]);
    bx = hole.cup[0] + Math.cos(a0 + a) * r; bz = hole.cup[1] + Math.sin(a0 + a) * r;
    sink = e; sc = 1 - e * 0.35;
  } else if (phase === 'pit' && pitAt) {
    const k = Math.min(1, phaseT / 0.35);
    bx = pitAt[2] + (pitAt[0] - pitAt[2]) * k; bz = pitAt[3] + (pitAt[1] - pitAt[3]) * k;
    sc = Math.max(0, 1 - k); sink = k * 0.6;
  }
  squash = Math.max(0, squash - dt * 5);
  flashBall = Math.max(0, flashBall - dt * 3);
  const hidden = (phase === 'sunk' && phaseT > 0.5) || (phase === 'pit' && phaseT > 0.4);
  scene.setBall(bx, bz, { visible: !hidden, scale: sc * (1 + Math.sin(squash * Math.PI) * 0.18), sink, flash: flashBall });
  // the pin: out of the way when the ball is near or rolling close
  const dc = Math.hypot(ball.x - hole.cup[0], ball.z - hole.cup[1]);
  const lift = phase === 'sunk' ? 0 : clamp((3.2 - dc) / 2.2, 0, 1);
  scene.setPin(lift);
  if (mode === 'play' && phase === 'roll' && !DEMO) sound.roll(Math.hypot(ball.vx, ball.vz), ball.sticky);
  scene.setTrailFade(phase === 'roll' || phase === 'sunk' || mode === 'title' ? 1 : Math.max(0, 1 - phaseT * 0.8));
  stepCam(dt);
  scene.update(dt, renderT);
  scene.render();
  drawFx(dt);
  animateDom(dt);
  adapt(frameDt);
}

// ---------- start ----------
if (!scene) {
  shell.title({ logo: ['GRADIENT', { text: 'DESCENT', tone: 'accent' }], tagline: TAGLINE, hidePlay: true, best: null,
    extra: el('p', 'gd-title-note', 'GRADIENT DESCENT needs 3D graphics (WebGL), which this browser has turned off. Try another browser, or turn hardware acceleration on.') });
} else {
  new ResizeObserver(() => layout()).observe(shell.stage);
  addEventListener('orientationchange', () => setTimeout(layout, 150));
  layout();
  createLoop({ update, render, paused: () => shell.state !== 'play' && !DEMO }).start();
  const q = QUERY.get('hole');
  if (DEMO) startDemo();
  else if (q && HOLES.some((h) => h.id === q)) {
    // a direct link to one hole (for checking a design): its course, from that hole
    const d = HOLES.find((h) => h.id === q);
    startCourse(d.course);
    run.idx = d.index;
    loadHole(run.defs[d.index]);
  } else toTitle();
  fontReady?.then?.(() => scene.refreshText());
  // ?qa: a handle for the screenshot checks (where the ball is on screen, the run's state)
  if (QUERY.has('qa')) window.__gd = { ball: () => ballScreen(), state: () => ({ mode, phase, strokes, simT: +simT.toFixed(2), ball: { x: ball.x, z: ball.z }, cam: { ...cam } }), shot: (a, p) => takeShot(a, p), aimYaw: () => aimYaw(), scene, ai: () => { const p = planShot(hole, ball.x, ball.z, {}); takeShot(p.angle, p.power); return p.result; }, last: () => { run.scores = run.defs.map((h) => h.par); run.idx = run.defs.length - 1; loadHole(run.defs[run.idx], { intro: false }); }, map: () => toggleMap() };
}
