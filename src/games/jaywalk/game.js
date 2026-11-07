// JAYWALK on agi1.app (2026-11-08): an endless voxel road-crossing hopper. AGI-1 (a voxel chibi) hops across 2049's
// busiest streets: robotaxi roads, scooter lanes, glowing data rivers with server racks and drone pads to ride, maglev
// lines that ring before a train whooshes through. Every row forward is a point; hearts buy new looks.
//
// This file ties the pieces together: the arcade kit's frame (shell), the world and its rules (world.js, rules.js:
// pure), the 3D view (scene.js), input (taps, swipes, keys), sounds, the HUD and the looks (ui.js, chars.js), and the
// self-playing demo (`?demo`, pilot.js).
import './style.css';
import { createShell } from '../kit/shell.js';
import { createLoop } from '../kit/loop.js';
import { fitCanvas } from '../kit/canvas.js';
import { pointer } from '../kit/input.js';
import { Shake, FloatText, rng, fmt } from '../kit/fx.js';
import { DEMO, SEED, REDUCED, TOUCH } from '../kit/env.js';
import { createWorld, T, isSafe, trainWarning, trainEta } from './world.js';
import { createRun, step, press, scoreOf, IDLE_GRAB } from './rules.js';
import { think } from './pilot.js';
import { createView, TOP } from './scene.js';
import { charOf, looksOf, unlock, pick, bank, affordable, nextGoal } from './chars.js';
import { lineFor, shareText } from './lines.js';
import { createSound, createMusic } from './sound.js';
import { createHud, createDock, lookCard, heartIcon } from './ui.js';
import { thumbOf } from './thumb.js';

const root = document.getElementById('ak-root');
const shell = createShell({
  game: 'jaywalk', name: 'JAYWALK', root,
  howTo: {
    intro: 'Get AGI-1 across the busiest streets of 2049. Every new row is a point.',
    steps: [
      ['Hop', 'Tap to hop forward. Swipe left, right or back to sidestep.'],
      ['Read the street', 'Robotaxis, scooters and buses never stop. Maglevs flash red and ring a bell before they whoosh through.'],
      ['Ride the data', 'You can\'t swim in a data river: hop on server racks and drone pads, and don\'t ride them off the edge.'],
      ['Keep moving', 'Stand still too long or go back three rows and a security drone carries you off.'],
      ['Collect hearts', 'Hearts unlock new looks: her hoodie, her raincoat, her cat and more.'],
    ],
    touch: [['Tap', 'Hop forward'], ['Swipe ← →', 'Hop sideways'], ['Swipe ↓', 'Hop back']],
    keys: [['↑ W Space', 'Hop forward'], ['← A · → D', 'Hop sideways'], ['↓ S', 'Hop back'], ['Esc · P', 'Pause']],
  },
  onPause: () => { view?.charge(false); touches.clear(); },
  onRestart: () => newRun(),
  onQuit: () => toTitle(),
});

// ---------- the stage: the 3D street, an overlay for floating words, the HUD ----------
const glCanvas = document.createElement('canvas');
glCanvas.className = 'jw-gl';
glCanvas.setAttribute('aria-label', 'JAYWALK: AGI-1 on a busy street');
const fxCanvas = document.createElement('canvas');
fxCanvas.className = 'jw-fx';
fxCanvas.setAttribute('aria-hidden', 'true');
const hud = createHud();
const veil = document.createElement('div');
veil.className = 'jw-veil';
veil.setAttribute('aria-hidden', 'true');
shell.stage.append(glCanvas, veil, fxCanvas, hud.node);
const heartsChip = shell.chip('', 0);
heartsChip.node.classList.add('jw-chip');
heartsChip.node.prepend(heartIcon());
heartsChip.node.setAttribute('aria-label', 'Hearts this run');

let view = null;
try {
  // (the demo's sparkles come from its seed too, so a recorded preview is the same every time)
  view = createView(glCanvas, { mobile: TOUCH, reduced: REDUCED, adaptive: !DEMO, rand: DEMO ? rng(((SEED || 7) ^ 0x5eed) >>> 0).next : Math.random });
} catch (err) {
  // no WebGL here: say so kindly instead of a blank page
  const msg = document.createElement('div');
  msg.className = 'jw-nogl ak-card';
  msg.append(Object.assign(document.createElement('p'), { className: 'ak-card-kicker', textContent: 'JAYWALK' }),
    Object.assign(document.createElement('h2'), { className: 'ak-card-title', textContent: 'No 3D here' }),
    Object.assign(document.createElement('p'), { textContent: 'This browser can\'t draw 3D (WebGL is off or missing). Try another browser, or turn on hardware acceleration.' }));
  shell.stage.append(msg);
}
function barBottom() {
  if (DEMO) return 0;
  const s = shell.stage.getBoundingClientRect(), b = shell.bar.getBoundingClientRect();
  return Math.max(0, b.bottom - s.top);
}
const sizeTo = (v) => view?.resize(v.w, v.h, { top: barBottom() });
const fx = fitCanvas(fxCanvas, { maxDpr: 2, onResize: sizeTo });
const sized = () => sizeTo(fx);
sized();

const sound = createSound(shell.audio);
const music = createMusic();
const shake = new Shake({ max: 9, decay: 2.2 });
const pops = new FloatText();
const seedOf = () => (SEED || ((Math.random() * 2 ** 31) >>> 0) || 1);
const demoRng = rng(SEED || 7);

// ---------- the save (hearts, looks) ----------
const readSave = () => shell.store.read();
let save = readSave();
function store(next) {
  const s = looksOf(next);
  shell.store.update((d) => { d.hearts = s.hearts; d.heartsEver = s.heartsEver; d.owned = s.owned; d.look = s.look; });
  save = readSave();
  view?.setCharacter(looksOf(save).look);
}
view?.setCharacter(looksOf(save).look);

// ---------- the run ----------
let world = null, run = null;
let mode = 'title';            // title · play · over
let deadFor = 0, freeze = 0, heartStreak = 0, heartAt = -9;
let bellAt = 0, beepAt = 0, whooshed = new Set();
let pilotWait = 0, pilotBest = 0, pilotAt = 0, demoRuns = 0;
let fresh = false;             // the title's street, not yet played: Play starts right there
let snap = true;

function bestNow() { return shell.store.best() || 0; }

function prepare(seed) {
  world = createWorld(seed, DEMO ? { base: 0.3 } : {});
  run = createRun(world, { best: bestNow() });
  hud.best(bestNow());
  hud.set(0);
  hud.hearts(0);
  view?.setBest(DEMO ? 0 : bestNow());
  view?.resetCamera();
  snap = true;
  whooshed = new Set();
}

function newRun() {
  if (!(fresh && run && world)) prepare(seedOf());
  else run.best = bestNow();
  fresh = false;
  mode = 'play';
  deadFor = 0; freeze = 0; heartStreak = 0; pilotWait = DEMO ? 0.35 : 0; pilotBest = 0; pilotAt = run.t;
  heartsChip.set(0);
  hud.set(0);
  touches.clear();
  view?.charge(false);
  try { document.activeElement?.blur?.(); } catch { /* fine */ }
  shell.started();
  if (!DEMO) { shell.audio.music(music); sound.go(); }
}

function toTitle() {
  mode = 'title';
  prepare(seedOf());
  fresh = true;
  dock.update(save);
  shell.title({
    logo: ['JAY', { text: 'WALK', tone: 'accent' }],
    tagline: 'Hop. Dodge. Don\'t look back.',
    onPlay: () => newRun(),
    best: bestNow(),
    extra: dock.node,
  });
}

const DEATH_TITLE = { car: 'Flattened!', splash: 'Splash!', edge: 'Carried away!', train: 'Zapped!', drone: 'Escorted out!' };
function endRun() {
  mode = 'over';
  const rows = scoreOf(run);
  const before = bestNow();
  store(bank(readSave(), run.hearts));
  const s = looksOf(save);
  const isBest = rows > before && rows > 0;
  const ready = affordable(save), goal = nextGoal(save);
  let extra = null;
  if (ready) extra = shell.el('p', 'jw-over-note', heartIcon(), `${ready.name} is ready to unlock on the menu`);
  else if (goal && run.hearts > 0) extra = shell.el('p', 'jw-over-note', heartIcon(), `${goal.need} more hearts for ${goal.char.name}`);
  shell.over({
    score: rows, label: rows === 1 ? 'Row' : 'Rows', title: DEATH_TITLE[run.death?.kind] || 'Game over',
    stats: [
      ['Hearts', `+${run.hearts}`],
      ['Total hearts', fmt(s.hearts)],
      ['Close calls', String(run.near)],
      ['Hops', fmt(run.hops)],
      ['Character', charOf(s.look).name, { wide: true }],
    ],
    line: lineFor({ kind: run.death?.kind || 'car', rows, isBest }),
    share: shareText(rows),
    extra,
    onAgain: () => newRun(),
    onMenu: () => toTitle(),
  });
}

// ---------- the looks ----------
const dock = createDock({
  thumb: (id) => thumbOf(id),
  onOpen: () => openLooks(),
});
function openLooks() {
  shell.audio.unlock();
  const lc = lookCard({
    save,
    thumb: (id) => thumbOf(id),
    onPick: (id) => {
      if (!id) { sound.error(); return save; }
      store(pick(save, id));
      sound.select();
      return save;
    },
    onUnlock: (id) => {
      store(unlock(save, id));
      sound.unlock();
      shell.toast(`New look: ${charOf(id).name}`, 'good');
      const p = view?.pose;
      if (p) view.burst({ x: p.x, y: p.y + 0.7, z: p.z, n: 36, speed: [1.5, 4], up: [2, 5], colors: ['#ff4da6', '#ffc933', '#3ff0c3', '#8b66ff', '#ffffff'], size: [0.06, 0.12], life: [0.6, 1.1] });
      return save;
    },
    onClose: () => { shell.closeCard(); dock.update(save); },
  });
  shell.card(lc.card, { label: 'Looks' });
}

// ---------- input: tap = forward, swipe = that way (it hops the moment the swipe is long enough), keys ----------
const SWIPE = 22;
const touches = new Map();
const playing = () => mode === 'play' && shell.state === 'play' && run && run.alive && !DEMO;
function go(dir) {
  if (!playing()) return;
  press(run, dir);
}
pointer(fxCanvas, {
  down(p) {
    if (!playing() || p.y < barBottom()) return;
    touches.set(p.id, { done: false });
    view?.charge(true);
  },
  move(p) {
    const s = touches.get(p.id);
    if (!s || s.done) return;
    if (Math.hypot(p.dx, p.dy) < SWIPE) return;
    s.done = true;
    go(Math.abs(p.dx) > Math.abs(p.dy) ? (p.dx > 0 ? 'right' : 'left') : (p.dy > 0 ? 'down' : 'up'));
    if ([...touches.values()].every((t) => t.done)) view?.charge(false);
  },
  up(p) {
    const s = touches.get(p.id);
    touches.delete(p.id);
    if (!touches.size) view?.charge(false);
    if (!s || s.done || p.event?.type === 'pointercancel') return;
    go('up');
  },
});
const KEYS = { ArrowUp: 'up', KeyW: 'up', Space: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
addEventListener('keydown', (e) => {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
  const dir = KEYS[e.code];
  if (!dir || shell.state !== 'play' || DEMO) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '')) return;
  e.preventDefault();
  if (e.repeat) return;
  go(dir);
});

// ---------- what happened this step: sounds, sparkles, words ----------
const CONFETTI = ['#ff4da6', '#ffc933', '#3ff0c3', '#8b66ff', '#59c8ff', '#ffffff'];
function at3(x, y, z) { return view ? view.project(x, y, z) : { x: fx.w / 2, y: fx.h / 2 }; }
function float(text, x, y, z, { color = '#fffaf0', size = 24, rise = 56, life = 0.9 } = {}) {
  const p = at3(x, y, z);
  pops.add({ x: p.x, y: p.y, text, color, size, rise, life });
}
function onEvents() {
  const w = world;
  for (const e of run.events) {
    switch (e.type) {
      case 'hop': {
        sound.hop(e.dir);
        const from = w.row(e.from);
        if (view && from.type !== T.RIVER) view.burst({ x: run.x, y: TOP[from.type] + 0.04, z: -e.from, n: 4, speed: [0.4, 1.2], up: [0.3, 1], colors: ['#fff4df', '#ffffff', '#e8dcff'], size: [0.05, 0.09], life: [0.22, 0.4], gravity: 3 });
        break;
      }
      case 'land': {
        view?.landed();
        sound.land(e.surface);
        if (view && e.surface === T.RIVER) view.ring(run.x, TOP.river + 0.03, -e.row, { size: 0.55, life: 0.45 });
        else if (view) view.burst({ x: run.x, y: TOP[e.surface] + 0.03, z: -e.row, n: 5, speed: [0.6, 1.5], up: [0.2, 0.8], colors: ['#ffffff', '#fff4df', '#d8ccff'], size: [0.05, 0.08], life: [0.2, 0.36], gravity: 4 });
        break;
      }
      case 'bump': sound.bump(); shell.haptic(8); break;
      case 'row': hud.set(e.row, { pop: e.row % 5 === 0 }); break;
      case 'heart': {
        heartStreak = run.t - heartAt < 2.5 ? heartStreak + 1 : 0;
        heartAt = run.t;
        sound.heart(e.big, heartStreak);
        shell.haptic(6);
        heartsChip.set(run.hearts, { pop: true });
        hud.hearts(run.hearts);
        const top = TOP[w.row(e.row).type] ?? 0;
        view?.burst({ x: e.x, y: top + 0.35, z: -e.row, n: e.big ? 22 : 12, speed: [1, 3], up: [1.5, 3.5], colors: e.big ? ['#ffc933', '#fff3c4', '#ff4da6'] : ['#ff4da6', '#ffd1e8', '#ffffff'], size: [0.05, 0.1], life: [0.35, 0.7] });
        float(e.big ? '+5' : '+1', e.x, top + 0.9, -e.row, { color: e.big ? '#ffc933' : '#ff8fc7', size: e.big ? 30 : 24 });
        break;
      }
      case 'near': {
        sound.near(e.train);
        const top = TOP[w.row(e.row).type] ?? 0;
        float(e.train ? 'WHOA!' : 'CLOSE!', run.x, top + 1.3, -run.lane, { color: '#3ff0c3', size: e.train ? 26 : 21, rise: 44, life: 0.75 });
        break;
      }
      case 'milestone': {
        sound.milestone();
        if (!DEMO) shell.toast(`${e.row} rows!`, 'good');
        const p = view?.pose;
        if (p) view.burst({ x: p.x, y: p.y + 0.8, z: p.z, n: 30, speed: [1.5, 4], up: [3, 6], colors: CONFETTI, size: [0.05, 0.11], life: [0.6, 1.1], gravity: 7 });
        break;
      }
      case 'best': {
        sound.best();
        if (!DEMO) shell.toast('New best!', 'good');
        hud.best(run.best);
        const p = view?.pose;
        if (p) { view.burst({ x: p.x, y: p.y + 0.8, z: p.z, n: 44, speed: [2, 5], up: [3, 7], colors: CONFETTI, size: [0.06, 0.12], life: [0.7, 1.3], gravity: 7 }); float('NEW BEST', p.x, p.y + 1.6, p.z, { color: '#ffc933', size: 30, rise: 70, life: 1.2 }); }
        break;
      }
      case 'drone-warn':
        sound.droneBeep(true);
        if (!DEMO) shell.toast(e.why === 'back' ? 'No going back, babe' : 'Keep moving!', 'warn', 1100);
        break;
      case 'death': onDeath(e); break;
      default: break;
    }
  }
  run.events.length = 0;
}
function onDeath(e) {
  deadFor = 0;
  touches.clear();
  view?.charge(false);
  shell.haptic([18, 40, 26]);
  const top = TOP[world.row(e.row).type] ?? 0;
  if (e.kind === 'car') {
    sound.splat();
    shake.kick(0.5);
    freeze = 0.1;
    view?.burst({ x: e.x, y: top + 0.1, z: -e.row, n: 16, speed: [1.5, 3.5], up: [1, 3], colors: ['#ffffff', '#e8dcff', '#ffd1e8'], size: [0.06, 0.12], life: [0.3, 0.6] });
  } else if (e.kind === 'train') {
    sound.zap();
    shake.kick(0.75);
    freeze = 0.12;
    view?.burst({ x: e.x, y: top + 0.5, z: -e.row, n: 30, speed: [2, 6], up: [2, 5], colors: ['#ffc933', '#3ff0c3', '#ffffff', '#8ff4ff'], size: [0.05, 0.1], life: [0.3, 0.7], gravity: 5 });
  } else if (e.kind === 'splash' || e.kind === 'edge') {
    sound.splash();
    shake.kick(0.22);
    view?.ring(e.x, TOP.river + 0.03, -e.row, { size: 0.9, life: 0.8 });
    later(0.16, () => view?.ring(e.x, TOP.river + 0.03, -e.row, { size: 1.4, life: 0.9 }));
    view?.burst({ x: e.x, y: TOP.river + 0.1, z: -e.row, n: 22, speed: [0.8, 2.4], up: [2.5, 5], colors: ['#8ff4ff', '#c9b6ff', '#ffffff', '#ff9ad5'], size: [0.05, 0.1], life: [0.4, 0.8], gravity: 11 });
  } else if (e.kind === 'drone') {
    sound.grab();
    shake.kick(0.18);
  }
}
// a little effect a moment later (on the loop's own clock: the demo's recorder steps time itself)
const queued = [];
function later(s, fn) { queued.push({ s, fn }); }
function runLater(dt) {
  for (let k = queued.length - 1; k >= 0; k--) {
    queued[k].s -= dt;
    if (queued[k].s <= 0) { const q = queued.splice(k, 1)[0]; q.fn(); }
  }
}

// ---------- the soundscape around her: maglev bells, a train going by, the drone's beeps ----------
function ambience() {
  if (DEMO || !run) return;
  const t = run.t;
  let near = 0;
  for (let i = run.row - 2; i <= run.row + 5; i++) {
    const row = world.row(i);
    if (row.type !== T.RAIL) continue;
    if (trainWarning(row, t)) near = Math.max(near, 1 - Math.min(1, Math.abs(i - run.row) / 6));
    const eta = trainEta(row, t);
    const k = Math.round((t + eta - row.rail.phase) / row.rail.period);
    const key = `${i}:${k}`;
    if (eta < 0.25 && eta > -0.3 && !whooshed.has(key) && Math.abs(i - run.row) <= 4) { whooshed.add(key); sound.whoosh(); if (whooshed.size > 40) whooshed = new Set([key]); }
  }
  if (near > 0 && t - bellAt > 0.34) { bellAt = t; sound.bell(0.4 + near * 0.6); }
  if (run.alive && run.droneWarn) {
    const urgency = Math.max(run.idle / IDLE_GRAB, (run.maxRow - run.row) / 3);
    const gap = 0.55 - 0.35 * Math.min(1, urgency);
    if (t - beepAt > gap) { beepAt = t; sound.droneBeep(urgency > 0.8); }
  }
}

// ---------- the demo's pilot: looks ahead, hops, pauses a breath on the sidewalks like a person would ----------
function pilot(dt) {
  if (!run.alive || run.hop || run.queue.length) return;
  if (pilotWait > 0) { pilotWait -= dt; return; }
  if (run.maxRow > pilotBest) { pilotBest = run.maxRow; pilotAt = run.t; }
  // (a press now starts its hop at the next step: plan from then)
  const a = think(world, { row: run.row, x: run.x, ride: run.ride, t: run.t + dt }, { maxRow: run.maxRow, idle: run.idle, got: run.got, stuck: run.t - pilotAt });
  if (a === 'wait') { pilotWait = 0.05; return; }
  press(run, a);
  // a breath after landing somewhere safe; none in the middle of a street (the plan may need the next hop at once)
  const to = world.row(run.row + (a === 'up' ? 1 : a === 'down' ? -1 : 0));
  pilotWait = isSafe(to.type) && a !== 'left' && a !== 'right' ? 0.05 + demoRng.next() * 0.14 : 0;
}

// ---------- the loop ----------
createLoop({
  update(dt) {
    if (!run || mode !== 'play') return;
    if (freeze > 0) { freeze -= dt; return; }
    if (DEMO) pilot(dt);
    step(run, dt);
    if (run.events.length) onEvents();
    ambience();
    if (!run.alive) {
      deadFor += dt;
      if (deadFor >= (DEMO ? 1.5 : 1.3)) {
        if (DEMO) { demoRuns++; prepare((SEED || 7) + demoRuns * 7919); fresh = true; newRun(); } else endRun();
      }
    }
    if (run.alive && run.maxRow > 30) world.prune(run.maxRow - 30);
  },
  render(alpha, frameDt) {
    if (!view || !run) return;
    const dt = Math.min(0.05, frameDt || 1 / 60);
    // the street keeps moving behind the title and the end card (not while paused)
    if (shell.state === 'title' || shell.state === 'over') run.t += dt;
    shake.update(dt);
    runLater(dt);
    const t = shell.state === 'play' && freeze <= 0 ? run.t + alpha / 120 : run.t;
    view.render({
      world, run, t, dt, frameDt,
      title: shell.state === 'title' || (mode === 'title'),
      warn: run.alive && run.droneWarn,
      shake: { x: shake.x * 0.02, y: shake.y * 0.02 },
      snap,
    });
    snap = false;
    // floating words
    const ctx = fx.begin();
    pops.update(dt);
    if (ctx) pops.draw(ctx);
  },
  paused: () => shell.state !== 'play' && !DEMO,
}).start();

// fonts first (the painted numbers on the street, the floating words), then the title (or the demo, straight away)
const fonts = document.fonts?.load ? Promise.all([document.fonts.load("900 40px 'AK Display'"), document.fonts.load("800 20px 'AK Display'")]).catch(() => {}) : Promise.resolve();
fonts.then(() => view?.fontsLoaded());
addEventListener('resize', () => sized());
// QA in development only (Vite drops it from the site's build): read the run, or end it a given way to look at it
if (import.meta.env?.DEV) {
  window.__jaywalk = {
    state: () => ({ mode, shell: shell.state, row: run?.row, x: run?.x, t: run?.t, alive: run?.alive, maxRow: run?.maxRow, hearts: run?.hearts }),
    info: () => ({ ...view?.renderer.info.render, geometries: view?.renderer.info.memory.geometries, pixelRatio: view?.renderer.getPixelRatio() }),
    die(kind = 'car') {
      if (!run?.alive) return false;
      run.alive = false;
      run.death = { kind, t: run.t, row: run.lane, x: run.x, dir: 1, side: 1, why: 'idle' };
      run.events.push({ type: 'death', ...run.death });
      return true;
    },
  };
}
if (DEMO) { prepare(SEED || 7); fresh = true; newRun(); } else toTitle();
