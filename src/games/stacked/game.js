// STACKED (2026-11-08): AGI-1's tower, one tap at a time. A floor slides over the tower; a tap drops it; what hangs
// over is cut off and falls. Perfect drops keep everything (and from six in a row they grow the floor back). The sky
// changes as the tower climbs: city night, rain clouds, above the clouds at sunrise, the stratosphere, orbit.
//
// logic.js holds the rules (pure), scene.js draws it in 3D (three.js), sound.js plays it, lines.js is her voice. This
// file is the run: the kit's frame (shell), input, the HUD, the juice, the end of a run, the title and the demo's AI.
import './style.css';
import { createShell, el } from '../kit/shell.js';
import { createLoop } from '../kit/loop.js';
import { fitCanvas } from '../kit/canvas.js';
import { Particles, FloatText, Shake, rng, fmt } from '../kit/fx.js';
import { DEMO, SEED, REDUCED, TOUCH, QUERY } from '../kit/env.js';
import * as L from './logic.js';
import { createScene, levelY } from './scene.js';
import { floorHex } from './theme.js';
import { LINES, endLine } from './lines.js';
import { createSound } from './sound.js';

const FACE = '/images/landing/agi1-face.webp';
const TAGLINE = 'One tap. Perfect drops. How high can she go?';
const root = document.getElementById('ak-root');

const shell = createShell({
  game: 'stacked', name: 'STACKED', root,
  howTo: {
    intro: "Build AGI-1's tower floor by floor: up through the city night, the clouds and into space.",
    steps: [
      ['Drop', 'A floor slides over the tower. Tap to drop it.'],
      ['Line it up', 'Whatever hangs over the edge is cut off, so the next floor is only as big as what you kept.'],
      ['Go perfect', 'Land right on the floor below and nothing is lost. Six perfects in a row and each one grows the floor back.'],
      ['Climb', 'Miss the tower completely and it’s over. Each floor is about 4 m: how high can she go?'],
    ],
    touch: [['Tap', 'Drop the floor']],
    keys: [['Space', 'Drop the floor'], ['Enter or ↓', 'Drop it too'], ['Esc or P', 'Pause']],
  },
  onRestart: () => newRun(),
  onQuit: () => toTitle(),
});
const sound = createSound(shell.audio);
const scoreChip = shell.chip('Score', 0);
const bestChip = shell.chip('Best', shell.store.best() ?? 0);

// ---------- the stage: the 3D canvas, a canvas for sparkles and words, the HUD ----------
const glCanvas = el('canvas', { class: 'st-gl', role: 'img', 'aria-label': "AGI-1's tower" });
const fxCanvas = el('canvas', { class: 'st-fx', 'aria-hidden': 'true' });
const floorNum = el('span', 'st-floor-num', '0');
const altEl = el('span', 'st-alt', '0 m');
const zoneEl = el('span', 'st-zone', L.ZONES[0].name);
const hud = el('div', { class: 'st-hud', 'aria-hidden': 'true', hidden: true }, el('div', 'st-floor', floorNum), el('div', 'st-meta', altEl, el('i', 'st-dot'), zoneEl));
const bannerKick = el('small', null, '');
const bannerName = el('b', null, '');
const banner = el('div', { class: 'st-banner', 'aria-hidden': 'true' }, bannerKick, bannerName);
const sayText = el('p', null, '');
const say = el('div', { class: 'st-say', role: 'status', 'aria-live': 'polite' }, el('img', { src: FACE, alt: '', width: 40, height: 40 }), el('span', 'ak-sr', 'AGI-1: '), sayText);
const hint = el('div', { class: 'st-hint', 'aria-hidden': 'true' }, TOUCH ? 'Tap to drop' : 'Click or press Space to drop');
shell.stage.append(glCanvas, fxCanvas, hud, banner, say, hint);

const scene = createScene(glCanvas, { reduced: REDUCED });
const fxView = fitCanvas(fxCanvas, { maxDpr: 2 });
const parts = new Particles(240);
const floats = new FloatText();
const shake = new Shake({ max: 9, decay: 1.8 });
const fontReady = document.fonts?.load?.("900 40px 'AK Display'").catch(() => {});

// ---------- the run's state ----------
let run = null;
let phase = 'boot';              // boot · title · play · falling (missed: the tower is shown whole) · over
let phaseT = 0, zoomed = false, runs = 0, simT = 0;
let zoneCur = 0, zonePrev = 0, zoneT = 1, zoneAlt = 0;
let lightning = 0, boltIn = 5, boltTwice = 0;
let firstDrop = false, tinySaid = false, closeAt = -99, lastInput = 'mouse';
let popK = 0, bannerT = 9, sayT = 9, sayDur = 2.6, hintT = 0, fxDirty = false;
const look = rng(SEED || 20261108);                       // her lines and the sky's thunder (a demo replays exactly)
const pick = (arr) => arr[Math.floor(look.next() * arr.length) % arr.length];
// the demo's AI
let demoR = null, demoAim = null, demoPrev = 0, demoFailAt = Infinity;

// ---------- the 3D view's size (sharp up to 2× the screen's pixels; lighter on a device that struggles) ----------
let dpr = Math.min(window.devicePixelRatio || 1, 2);
const fixedDpr = DEMO || QUERY.has('hq');
function layout() {
  if (!scene) return;
  const r = shell.stage.getBoundingClientRect();
  scene.resize(Math.round(r.width), Math.round(r.height), dpr);
  reframe(true);
}
let slowT = 0;
function adapt(frameDt) {
  if (fixedDpr || dpr <= 1 || phase === 'boot' || document.visibilityState !== 'visible') return;
  if (frameDt > 1 / 42 && frameDt < 0.099) slowT += frameDt; else slowT = Math.max(0, slowT - frameDt * 0.5);
  if (slowT > 2.5) { slowT = 0; dpr = Math.max(1, Math.round((dpr - 0.25) * 4) / 4); layout(); }
}

function reframe(soft = false) {
  if (!scene) return;
  if (phase === 'play' && run?.moving) {
    const top = L.topOf(run);
    scene.framePlay(levelY(run.moving.n), top.x, top.z, { snap: soft && false });
  } else if (phase === 'title') scene.frameAll({ title: true, snap: soft });
  else if (phase === 'over' || (phase === 'falling' && zoomed)) scene.frameAll({ snap: false });
}

// ---------- the HUD ----------
function updateHud(instant = false) {
  const h = run ? L.heightOf(run) : 0;
  floorNum.textContent = String(h);
  altEl.textContent = L.altitudeText(h);
  zoneEl.textContent = L.ZONES[L.zoneIndex(h)].name;
  scoreChip.set(run ? run.score : 0, { pop: !instant });
  if (!instant) popK = 1;
}
function showBanner(zone, i) {
  bannerKick.textContent = `Zone ${i + 1} · ${L.altitudeText(zone.from)}`;
  bannerName.textContent = zone.name;
  bannerT = 0;
}
function sayLine(text, dur = 2.8) {
  if (!text) return;
  sayText.textContent = text;
  sayT = 0; sayDur = dur;
}
// the DOM bits move with the game's clock (a recorded demo steps its own time)
function animateDom(dt) {
  popK = Math.max(0, popK - dt * 5);
  const s = 1 + 0.16 * Math.sin(Math.min(1, 1 - popK) * Math.PI) * (popK > 0 ? 1 : 0);
  floorNum.style.transform = popK > 0 && !REDUCED ? `scale(${s.toFixed(3)})` : '';
  bannerT += dt;
  const bIn = Math.min(1, bannerT / 0.35), bOut = Math.max(0, (bannerT - 2.4) / 0.4);
  const bv = bannerT < 2.8 ? Math.min(bIn, 1 - bOut) : 0;
  banner.style.opacity = bv.toFixed(3);
  banner.style.transform = `translate(-50%, ${((1 - easeOut(bIn)) * -14 + bOut * -8).toFixed(1)}px) rotate(-1.5deg)`;
  sayT += dt;
  const sIn = Math.min(1, sayT / 0.3), sOut = Math.max(0, (sayT - sayDur) / 0.35);
  const sv = sayT < sayDur + 0.35 ? Math.min(sIn, 1 - sOut) : 0;
  say.style.opacity = sv.toFixed(3);
  say.style.transform = `translate(-50%, ${((1 - easeOut(sIn)) * 18 + sOut * 10).toFixed(1)}px)`;
  hintT += dt;
  const showHint = phase === 'play' && !firstDrop && !DEMO && run && run.age > 0.5;
  hint.style.opacity = showHint ? (0.78 + 0.22 * Math.sin(hintT * 4)).toFixed(3) : '0';
}
const easeOut = (t) => 1 - (1 - t) ** 3;

// ---------- sparkles and words ----------
const P = {};
function topCorners(rect, n) {
  const y = levelY(n) + L.FLOOR_H;
  return [[rect.x - rect.w / 2, rect.z - rect.d / 2], [rect.x + rect.w / 2, rect.z - rect.d / 2], [rect.x + rect.w / 2, rect.z + rect.d / 2], [rect.x - rect.w / 2, rect.z + rect.d / 2]]
    .map(([x, z]) => { scene.project(x, y, z, P); return [P.x, P.y]; });
}
const TIERS = [['#fffaf0', '#ffc933'], ['#ffc933', '#ff9a3d'], ['#3ff0c3', '#a5ffe6'], ['#ff4da6', '#ffc933']];
function tierOf(streak) { return streak >= 10 ? 3 : streak >= 6 ? 2 : streak >= 3 ? 1 : 0; }

function perfectFx(ev, entry) {
  const tier = tierOf(ev.streak);
  const colors = [...TIERS[tier], floorHex(ev.n)];
  for (const [x, y] of topCorners(ev.placed, ev.n)) {
    parts.burst({ x, y, count: 5 + tier, speed: [60, 210], life: [0.35, 0.75], size: [4, 8], colors, gravity: 260, drag: 2.2, shape: 'star', spin: 6 });
  }
  const tones = ['#fffaf0', '#ffc933', '#3ff0c3', '#ff4da6'];
  scene.ring(ev.placed, ev.n, { tone: tones[tier] });
  if (ev.streak >= 3) scene.ring(ev.placed, ev.n, { tone: tones[tier], delay: 0.12, dur: 0.7 });
  if (ev.milestone) scene.ring(ev.placed, ev.n, { tone: '#fffaf0', delay: 0.26, dur: 0.8 });
  const front = topCorners(ev.placed, ev.n)[2];
  const text = ev.milestone ? `×${ev.streak} STREAK +${L.STREAK_BONUS.points}` : ev.streak > 1 ? `PERFECT ×${ev.streak}` : 'PERFECT';
  floats.add({ x: clampX(front[0]), y: front[1] - 26, text, color: TIERS[tier][0] === '#fffaf0' ? '#fffaf0' : TIERS[tier][0], size: ev.milestone ? 30 : 22 + Math.min(6, ev.streak), life: 0.95, rise: 46 });
  if (ev.grew > 0 && ev.streak === L.GROW.from) floats.add({ x: clampX(front[0]), y: front[1] + 6, text: 'GROWING', color: '#3ff0c3', size: 16, life: 0.9, rise: 30 });
}
function cutFx(ev) {
  const k = ev.axis, sign = Math.sign(ev.delta) || 1;
  const y = levelY(ev.n) + L.FLOOR_H * 0.6;
  const ex = k === 'x' ? ev.placed.x + sign * ev.placed.w / 2 : ev.placed.x;
  const ez = k === 'z' ? ev.placed.z + sign * ev.placed.d / 2 : ev.placed.z;
  const half = (k === 'x' ? ev.placed.d : ev.placed.w) / 2;
  const color = floorHex(ev.n);
  for (const t of [-0.8, 0, 0.8]) {
    scene.project(k === 'x' ? ex : ex + t * half, y, k === 'z' ? ez : ez + t * half, P);
    parts.burst({ x: P.x, y: P.y, count: 3, speed: [40, 150], life: [0.3, 0.6], size: [3, 6], colors: [color, '#170a36'], gravity: 520, drag: 1.5, shape: 'square', spin: 8 });
  }
  if (ev.close) {
    scene.project(ex, y + 0.4, ez, P);
    floats.add({ x: clampX(P.x), y: P.y - 18, text: 'CLOSE ONE!', color: '#ff4da6', size: 20, life: 0.9, rise: 36 });
  }
}
const clampX = (x) => Math.min(Math.max(x, 90), fxView.w - 90);

function drawFx(dt) {
  parts.update(dt);
  floats.update(dt);
  const busy = parts.count > 0 || floats.items.length > 0;
  if (!busy && !fxDirty) return;
  const ctx = fxView.begin();
  parts.draw(ctx);
  floats.draw(ctx);
  fxDirty = busy;
}

// ---------- a run ----------
function syncMoving(spawned) {
  if (run?.moving) scene.setMoving(run.moving, run.moving.n, spawned ? scene.patOf() : null);
}

function newRun() {
  if (!scene) return;
  run = L.createRun();
  runs++;
  phase = 'play'; phaseT = 0; zoomed = false;
  firstDrop = false; tinySaid = false; closeAt = -99; sayT = 9; bannerT = 9;
  parts.clear(); floats.clear(); fxDirty = true;
  if (DEMO) {
    // the demo starts a few floors under a new zone, so the sky changes within seconds
    const starts = [44, 20, 85, 134];
    const s = starts[(runs - 1 + SEED) % starts.length];
    demoR = rng((SEED || 7) * 7919 + runs * 104729);
    L.prebuild(run, s, demoR, { slip: 0.14, wide: 0.3 });
    demoFailAt = s + 20 + Math.floor(demoR.next() * 6);
    demoAim = null;
    demoPrev = run.offset;
    firstDrop = true;
  }
  scene.buildTower(run.floors);
  syncMoving(true);
  const h = L.heightOf(run);
  zoneCur = zonePrev = L.zoneIndex(h); zoneT = 1;
  scene.setTheme(zoneCur, zoneCur, 1);
  scene.setJourney(0, DEMO);
  zoneAlt = Math.max(0, levelY(h) - levelY(L.ZONES[zoneCur].from));
  const top = L.topOf(run);
  scene.framePlay(levelY(run.moving.n), top.x, top.z, { snap: DEMO });
  updateHud(true);
  hud.hidden = false;
  shell.started();
  bestChip.set(shell.store.best() ?? 0);
  sound.start();
}

function drop(source) {
  if (phase !== 'play' || !run || run.over) return;
  const rewind = source === 'touch' ? 0.018 : source === 'key' ? 0.01 : source === 'demo' ? 0 : 0.012;
  const ev = L.dropRun(run, { rewind });
  if (!ev) return;
  firstDrop = true;
  if (ev.kind === 'miss') onMiss(ev); else onLand(ev);
}

function onLand(ev) {
  scene.land(ev);
  syncMoving(true);
  const top = L.topOf(run);
  scene.framePlay(levelY(run.moving.n), top.x, top.z);
  scene.kick(ev.kind === 'perfect' ? 1 : 0.75);
  sound.drop(ev);
  if (ev.kind === 'perfect') {
    perfectFx(ev);
    shell.haptic(ev.milestone ? [16, 40, 22] : 14);
    if (ev.milestone) { sound.milestone(); shake.kick(0.18); sayLine(ev.streak === 10 ? LINES.streak[1] : pick(LINES.streak)); }
  } else {
    cutFx(ev);
    shell.haptic(8);
    if (ev.close && simT - closeAt > 25) { closeAt = simT; sayLine(pick(LINES.close), 2.2); }
  }
  const size = Math.min(top.w, top.d);
  if (!tinySaid && size < 0.6) { tinySaid = true; sayLine(LINES.tiny[0], 2.4); }
  updateHud();
  if (ev.zone >= 0) enterZone(ev.zone);
}

function enterZone(i) {
  zonePrev = zoneCur; zoneCur = i; zoneT = 0;
  const z = L.ZONES[i];
  showBanner(z, i);
  sound.zone(i);
  sayLine(pick(LINES.zone[z.id] || LINES.mid), 3);
  shell.haptic([10, 30, 10]);
  // a burst of confetti from the top of the tower
  const t = L.topOf(run);
  scene.project(t.x, levelY(t.n + 1), t.z, P);
  parts.burst({ x: P.x, y: P.y, count: 26, speed: [120, 340], angle: [-Math.PI * 0.95, -Math.PI * 0.05], life: [0.7, 1.3], size: [4, 8], colors: ['#ffc933', '#ff4da6', '#3ff0c3', '#fffaf0', '#8b66ff'], gravity: 420, drag: 1.4, shape: 'square', spin: 10 });
}

function onMiss(ev) {
  scene.miss(ev);
  phase = 'falling'; phaseT = 0; zoomed = false;
  sound.miss();
  shell.haptic([30, 50, 80]);
  shake.kick(0.32);
}

function zoomOut() {
  if (zoomed) return;
  zoomed = true;
  scene.frameAll();
  scene.setJourney(1);
}

function endRun() {
  if (phase !== 'falling') return;
  zoomOut();
  phase = 'over';
  if (DEMO) { newRun(); return; }
  const s = L.summary(run);
  const before = shell.store.best();
  const isBest = s.score > 0 && (before == null || s.score > before);
  const line = endLine({ floors: s.floors, isBest, next: s.next, bestStreak: s.bestStreak }, pick);
  shell.store.update((d) => {
    d.bestFloors = Math.max(Number(d.bestFloors) || 0, s.floors);
    d.bestZone = Math.max(Number(d.bestZone) || 0, s.zone);
  });
  shell.over({
    score: s.score, label: 'Score', title: 'Topped out',
    stats: [['Floors', fmt(s.floors)], ['Perfects', fmt(s.perfects)], ['Best streak', `×${s.bestStreak}`], ['Altitude', s.altitudeText]],
    line,
    share: `I stacked ${fmt(s.floors)} floors (${s.altitudeText}) for AGI-1 in STACKED on agi1.app 💜`,
    extra: zoneTrack(s),
    onAgain: () => newRun(),
    onMenu: () => toTitle(),
  });
  bestChip.set(shell.store.best() ?? 0);
}

// the over card's climb: the five zones, how far this run got, how far to the next
function zoneTrack(s) {
  const segs = L.ZONES.map((z, i) => {
    const next = L.ZONES[i + 1];
    const fill = s.floors >= (next ? next.from : Infinity) ? 1 : i === s.zone ? (next ? (s.floors - z.from) / (next.from - z.from) : 1) : 0;
    const seg = el('span', { class: `st-seg${i <= s.zone ? ' is-on' : ''}`, title: z.name }, el('i', null));
    seg.style.setProperty('--fill', String(Math.max(0, Math.min(1, fill))));
    return seg;
  });
  const words = s.next ? `${fmt(s.next.floors)} floor${s.next.floors === 1 ? '' : 's'} to ${s.next.zone.name.toLowerCase()}` : 'Orbit. Nothing above but stars.';
  return el('div', 'st-track', el('div', { class: 'st-track-bar', role: 'img', 'aria-label': `Reached ${L.ZONES[s.zone].name}` }, segs),
    el('p', 'st-track-words', el('b', null, L.ZONES[s.zone].name), ' · ', words));
}

// ---------- the title: a finished tower turning slowly behind it ----------
function logo() {
  const letters = [...'STACKED'].map((ch, i) => el('span', `st-l st-l${i}`, ch));
  return el('h1', 'ak-logo st-logo', el('span', 'ak-logo-line', letters));
}
function toTitle() {
  if (!scene) return;
  phase = 'title';
  run = null;
  const attract = L.prebuild(L.createRun(), 58, rng(20261108), { slip: 0.12, wide: 0.28 });
  scene.buildTower(attract.floors);
  scene.hideMoving();
  zoneCur = zonePrev = 0; zoneT = 1;
  scene.setTheme(0, 0, 1);
  scene.frameAll({ title: true, snap: true });
  scene.setJourney(1, true);
  hud.hidden = true;
  parts.clear(); floats.clear(); fxDirty = true; sayT = 9; bannerT = 9;
  const d = shell.store.read();
  const highest = Number(d.bestFloors) || 0;
  shell.title({
    logo: logo(), tagline: TAGLINE, onPlay: () => newRun(), best: shell.store.best(),
    extra: highest ? el('p', 'st-title-note', 'Highest ', el('b', null, `${fmt(highest)} floors`), ` · ${L.altitudeText(highest)}`) : null,
  });
}

// ---------- input: a tap anywhere (not on the bar), Space, Enter, ↓ ----------
shell.stage.addEventListener('pointerdown', (e) => {
  if (e.button > 0 && e.pointerType === 'mouse') return;
  if (shell.state !== 'play') return;
  const barBottom = shell.bar.getBoundingClientRect().bottom;
  if (e.clientY < barBottom - 6) return;
  lastInput = e.pointerType === 'touch' ? 'touch' : 'mouse';
  if (e.cancelable) e.preventDefault();
  shell.audio.unlock();
  if (phase === 'play') drop(lastInput);
  else if (phase === 'falling' && phaseT > 0.3) endRun();
});
addEventListener('keydown', (e) => {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
  if (!(e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown')) return;
  if (shell.state !== 'play' || e.target?.closest?.('button, a, input, select, textarea')) return;
  e.preventDefault();
  if (e.repeat) return;
  lastInput = 'key';
  if (phase === 'play') drop('key');
  else if (phase === 'falling' && phaseT > 0.3) endRun();
});

// ---------- the demo plays itself ----------
function demoStep() {
  if (!demoAim) {
    const top = L.topOf(run);
    const size = run.axis === 'x' ? top.w : top.d;
    demoAim = L.heightOf(run) >= demoFailAt
      ? { error: Math.min(L.SPAWN - 0.05, size + 0.25), fail: true }
      : L.aimFor(demoR, { slip: 0.2, wide: 0.32 });
    demoPrev = run.offset;
  }
  if (L.crosses(demoPrev, run.offset, demoAim.error)) { demoAim = null; drop('demo'); return; }
  demoPrev = run.offset;
}

// ---------- the loop ----------
createLoop({
  update(dt) {
    simT += dt;
    if (phase === 'play') {
      L.stepRun(run, dt);
      if (DEMO) demoStep();
    } else if (phase === 'falling') {
      phaseT += dt;
      if (phaseT > 0.5) zoomOut();
      if (phaseT > (DEMO ? 3.2 : 2.2)) endRun();
    }
  },
  render(alpha, frameDt) {
    if (!scene) return;
    const dt = shell.state === 'pause' ? 0 : Math.min(frameDt, 0.05);
    if (phase === 'play' && run?.moving) scene.setMoving(run.moving, run.moving.n);
    // the sky: blending into a new zone; the clouds pass as the tower climbs
    if (zoneT < 1) { zoneT = Math.min(1, zoneT + dt / 2.4); scene.setTheme(zonePrev, zoneCur, zoneT); }
    if (run) {
      const target = Math.max(0, levelY(L.heightOf(run)) - levelY(L.ZONES[zoneCur].from));
      zoneAlt += (target - zoneAlt) * (1 - Math.exp(-4 * dt));
      scene.setZoneAlt(zoneAlt);
    }
    // thunder in the rain clouds (not with reduced motion)
    if (zoneCur === 1 && phase === 'play' && !REDUCED) {
      boltIn -= dt;
      if (boltIn <= 0) {
        lightning = 1; boltTwice = 0.16; boltIn = 5 + look.next() * 7;
        if (!DEMO) sound.thunder();
      }
    }
    if (boltTwice > 0) { boltTwice -= dt; if (boltTwice <= 0) lightning = Math.max(lightning, 0.7); }
    lightning = Math.max(0, lightning - dt * 4.5);
    scene.setLightning(lightning);
    shake.update(dt);
    scene.setShake(shake.x, shake.y);
    scene.update(dt);
    if (dt > 0 || fxDirty) scene.render();
    drawFx(dt);
    animateDom(dt);
    adapt(frameDt);
  },
  paused: () => shell.state !== 'play' && !DEMO,
}).start();

// ---------- start ----------
if (!scene) {
  // no WebGL (it's off in this browser): say so kindly
  shell.title({ logo: logo(), tagline: TAGLINE, hidePlay: true, best: null,
    extra: el('p', 'st-title-note', 'STACKED needs 3D graphics (WebGL), which this browser has turned off. Try another browser, or turn hardware acceleration on.') });
} else {
  new ResizeObserver(() => layout()).observe(shell.stage);
  addEventListener('orientationchange', () => setTimeout(layout, 150));
  layout();
  if (DEMO) newRun(); else toTitle();
  fontReady?.then?.(() => { fxDirty = true; });
}
