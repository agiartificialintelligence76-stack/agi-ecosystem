// ROBOTAXI RUSH (agi1.app/games/robotaxi, 2026-11-08): AGI-1 takes her robotaxi down an endless neon highway. Curves and
// hills, traffic to weave through, near misses that charge the boost, a checkpoint every 2 km into a new part of the city.
// A pseudo-3D road drawn on a 2D canvas (render.js), a pure simulation (sim.js, traffic.js, track.js: tested in Node),
// its own AI for the ?demo preview and the title screen (ai.js), and the arcade kit's frame around it.
import './style.css';
import { createShell, el } from '../kit/shell.js';
import { createLoop } from '../kit/loop.js';
import { pointer, keyboard } from '../kit/input.js';
import { Particles, Shake, FloatText, rng, clamp, fmt } from '../kit/fx.js';
import { DEMO, SEED, REDUCED, TOUCH, QUERY } from '../kit/env.js';
import { SEG, BARRIER, ROAD_HALF, SPEED, MPU, ZONE_NAMES, LANE_X, segOf, zoneOfIndex } from './config.js';
import { createRun, stepRun, summary, kmh } from './sim.js';
import { createAI } from './ai.js';
import { createRenderer } from './render.js';
import { layoutView } from './camera.js';
import { buildSprites, rebuildBillboards } from './sprites.js';
import { createHud } from './hud.js';
import { createSound } from './sound.js';
import { endLine, RIDE } from './lines.js';
import { INK, PAPER, HONEY, PINK, MINT, SKY, LAV2 } from './zones.js';

const DISPLAY = "900 1em 'AK Display', 'Arial Black', system-ui, sans-serif";
const cosmetic = rng((SEED || 7) * 31 + 5);     // particles' and quips' dice (never the run's own)
const pick = (a) => a[Math.floor(cosmetic.next() * a.length)];

const shell = createShell({
  game: 'robotaxi',
  name: 'ROBOTAXI RUSH',
  root: document.getElementById('ak-root'),
  howTo: {
    intro: 'AGI-1 takes her robotaxi for a joyride. No brakes: you just steer, and the road gets faster.',
    steps: [
      ['Weave', 'Steer through the traffic. Watch for blinkers: those cars are changing lanes.'],
      ['Near misses', 'Pass a car close for points. Another within 2 seconds keeps the chain going and multiplies them.'],
      ['Boost', 'Near misses fill the boost. Fire it for 4 seconds of speed: cars in your way go flying.'],
      ['Shields', 'You have three. A hit costs one and spins you out. Mint shields on the road give one back.'],
      ['Pins and zones', 'Passenger pins are +500. Every 2 km a checkpoint takes you somewhere new.'],
    ],
    touch: [['Hold a side', 'Steer that way'], ['Drag', 'The robotaxi follows your finger'], ['BOOST', 'Fire the boost when it\'s full']],
    keys: [['← → or A D', 'Steer'], ['↑ W or Space', 'Boost'], ['Hold and drag', 'Steer with the mouse'], ['P or Esc', 'Pause']],
  },
  onRestart: () => newRun(),
  onQuit: () => toTitle(),
});

// ---------- the canvas (sharp, but within a pixel budget: a big screen at 2× would be slow on a laptop's GPU) ----------
const canvas = document.createElement('canvas');
canvas.className = 'rt-canvas';
canvas.setAttribute('role', 'img');
canvas.setAttribute('aria-label', 'AGI-1\'s robotaxi on a neon highway');
shell.stage.append(canvas);
const g = canvas.getContext('2d', { alpha: false });
const safeProbe = el('div', { class: 'rt-safe', 'aria-hidden': 'true' });
shell.root.append(safeProbe);
const view = { w: 1, h: 1, dpr: 1, layout: null, safe: { t: 0, r: 0, b: 0, l: 0 }, top: 0 };
let budget = TOUCH ? 2.2e6 : 3.7e6;
let stillSince = -1, redraw = true;     // (a still frame: paused, or the end card is up)
function resize(force = false) {
  const r = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
  const dpr = Math.min(2, window.devicePixelRatio || 1, Math.max(0.75, Math.sqrt(budget / (w * h))));
  const dw = Math.round(w * dpr), dh = Math.round(h * dpr);
  if (!force && dw === canvas.width && dh === canvas.height && w === view.w && h === view.h) return;
  canvas.width = dw; canvas.height = dh;
  view.w = w; view.h = h; view.dpr = dw / w;
  const cs = getComputedStyle(safeProbe);
  view.safe = { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
  view.top = DEMO ? view.safe.t : Math.max(view.safe.t, Math.round(shell.bar.getBoundingClientRect().height || 60));
  view.layout = layoutView(w, h, { top: view.top });
  view.layout.dpr = view.dpr;
  redraw = true;          // (a canvas that changed size is blank: draw it again even when it's standing still)
}
new ResizeObserver(() => resize()).observe(canvas);
addEventListener('resize', () => resize());
addEventListener('orientationchange', () => setTimeout(() => resize(), 150));
resize(true);

// ---------- the top bar's numbers, and the BOOST button ----------
const kmChip = shell.chip('Km', '0.00', { fmtFn: (v) => String(v) });
// (a narrow phone shows a big score short, 123.4K, so the bar never overflows; the end card has it in full)
const scoreChip = shell.chip('Score', 0, { fmtFn: (v) => fmt(v, { compact: innerWidth < 430 }) });
const boostBtn = el('button', { class: 'rt-boost', type: 'button', 'aria-label': 'Boost: charging', hidden: true },
  el('span', { class: 'rt-boost-ring', 'aria-hidden': 'true' }),
  el('span', { class: 'rt-boost-face', 'aria-hidden': 'true' }, el('b', null, 'BOOST'), el('small', null, TOUCH ? 'charging' : 'space')));
shell.stage.append(boostBtn);
let boostPressed = false;
boostBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); boostPressed = true; });
boostBtn.addEventListener('click', () => { boostPressed = true; });
let btnState = '', btnP = -1;
function drawBoostButton() {
  const show = mode === 'play' && shell.state === 'play';
  if (boostBtn.hidden === show) boostBtn.hidden = !show;
  if (!show || !run) return;
  const p = Math.round(run.boost * 100) / 100;
  if (p !== btnP) { btnP = p; boostBtn.style.setProperty('--p', String(p)); }
  const s = run.boostT > 0 ? 'active' : run.boost >= 1 ? 'ready' : 'charging';
  if (s !== btnState) {
    btnState = s;
    boostBtn.dataset.state = s;
    boostBtn.setAttribute('aria-label', s === 'ready' ? 'Boost: ready' : s === 'active' ? 'Boosting' : 'Boost: charging');
    boostBtn.querySelector('small').textContent = s === 'ready' ? (TOUCH ? 'tap!' : 'space') : s === 'active' ? 'go go go' : TOUCH ? 'charging' : 'space';
  }
}

// ---------- steering: keys, a finger or the mouse ----------
const input = { steer: 0, target: null, boost: false };
const keys = keyboard({
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'boost', KeyW: 'boost', Space: 'boost',
}, {
  down(name) { if (name === 'boost') boostPressed = true; if (name === 'left' || name === 'right') steerPtr = null; },
  blocked: () => mode !== 'play' || shell.state !== 'play',
});
const ptrs = new Map();
let steerPtr = null;
pointer(canvas, {
  down(p) {
    if (mode !== 'play' || shell.state !== 'play' || !run) return;
    const s = { id: p.id, x0: p.x, x: p.x, mode: 'hold', side: p.x < view.w / 2 ? -1 : 1, ax: p.x, apx: run.x };
    ptrs.set(p.id, s);
    steerPtr = s;
  },
  move(p) {
    const s = ptrs.get(p.id);
    if (!s || !run) return;
    s.x = p.x;
    // a finger that moves is dragging: the robotaxi follows it, counted from where it first touched (so the moment it
    // spent steering towards that side is taken back)
    if (s.mode === 'hold' && Math.abs(p.x - s.x0) > 10) s.mode = 'drag';
  },
  up(p) {
    ptrs.delete(p.id);
    if (steerPtr && steerPtr.id === p.id) { steerPtr = null; for (const s of ptrs.values()) steerPtr = s; }
  },
});
function readInput() {
  input.boost = boostPressed;
  if (boostPressed && taught) hud.hintDone();
  boostPressed = false;
  if (!taught && (steerPtr || keys.held('left') || keys.held('right')) && run.t > 0.6) hud.hintDone();
  if (steerPtr) {
    if (steerPtr.mode === 'drag') {
      const gain = (2 * ROAD_HALF) / Math.max(220, view.w * 0.5);
      input.target = clamp(steerPtr.apx + (steerPtr.x - steerPtr.ax) * gain, -BARRIER, BARRIER);
      input.steer = 0;
    } else { input.target = null; input.steer = steerPtr.side; }
  } else {
    input.target = null;
    input.steer = (keys.held('right') ? 1 : 0) - (keys.held('left') ? 1 : 0);
  }
}

// ---------- the run, and what makes it feel good ----------
let run = null, mode = 'boot', demoRuns = 0, attractRuns = 0;
let renderer = null, sprites = null;
const ai = createAI({ safety: 70, greed: 1.15 });
const attractAI = createAI({ safety: 120, greed: 0.7 });
const hud = createHud();
const sound = createSound(shell.audio);
const parts = new Particles(REDUCED ? 160 : 420);
const floats = new FloatText();
const shake = new Shake({ max: 16, decay: 2.2 });
const fx = { time: 0, boost: 0, squash: 1, tilt: 0, bounce: 0, pan: 0, fromZone: null, zoneFade: 1, flash: 0, flashT: 4, shakeOut: { x: 0, y: 0, r: 0 }, rumble: 0 };
let playerBox = null, chipT = 0, lastQuip = -99, teach = false, taught = false, bestDist = 0, bestDone = false, smashAt = -9, smashN = 0;
const face = new Image();
face.src = '/images/landing/agi1-face.webp';

function resetFx() {
  parts.clear(); floats.clear(); hud.reset();
  shake.trauma = 0;
  fx.boost = 0; fx.squash = 1; fx.tilt = 0; fx.fromZone = null; fx.zoneFade = 1; fx.flash = 0;
  ptrs.clear(); steerPtr = null; boostPressed = false; keys.clear();
}

function newRun() {
  const seed = DEMO ? (SEED || 7) + demoRuns * 977 : SEED ? SEED + demoRuns * 977 : ((Math.random() * 2 ** 31) >>> 0) || 1;
  demoRuns++;
  // the demo starts where it's exciting: night city, already flying, the boost nearly full (`&km=` starts it further on:
  // for looking at the other zones)
  const startM = DEMO ? clamp(Number(QUERY.get('km')) * 1000 || 2230, 0, 60000) : 0;
  run = createRun({ seed, demo: DEMO, startM, boost: DEMO ? 0.74 : 0, lane: DEMO ? 2 : 1 });
  ai.reset();
  resetFx();
  mode = DEMO ? 'demo' : 'play';
  if (!DEMO) {
    shell.started();
    sound.music(run.zone);
    hud.say(pick(RIDE.start), 2.2);
    lastQuip = fx.time;
    // the first few rides: how to steer (it goes as soon as they do), and the boost once it's ready
    teach = (shell.store.read().runs || 0) < 3;
    bestDist = shell.store.best('dist') || 0;
    bestDone = bestDist < 300;              // (nothing worth celebrating yet)
    if (teach) hud.hint(TOUCH ? 'HOLD A SIDE OR DRAG TO STEER' : 'STEER WITH ← → OR A D', 6);
  } else hud.say(pick(RIDE.start), 2.4);
  kmChip.set('0.00'); scoreChip.set(0);
}

function toTitle() {
  attractRuns++;
  run = createRun({ seed: 2049 + attractRuns * 31, attract: true, startM: 140, boost: 0.2, lane: 1 });
  attractAI.reset();
  resetFx();
  mode = 'title';
  sound.stopMusic();
  const best = shell.store.best(), far = shell.store.best('dist');
  shell.title({
    logo: ['ROBOTAXI', { text: 'RUSH', tone: 'pink' }],
    tagline: 'Neon highway. No brakes. Chain the near misses.',
    onPlay: () => newRun(),
    best: best == null ? null : `${best.toLocaleString('en-US')}${far ? ` · ${(far / 1000).toFixed(2)} km` : ''}`,
    bestLabel: 'Best',
  });
}

function endRun() {
  if (DEMO) { newRun(); return; }
  mode = 'over';
  sound.stopMusic();
  const sum = summary(run);
  const prev = shell.store.best();
  shell.store.recordBest('dist', Math.round(sum.km * 1000));
  const isBest = prev == null ? sum.score > 0 : sum.score > prev;     // as the kit decides it
  shell.over({
    score: sum.score,
    label: 'Score',
    title: 'Ride over',
    stats: [
      ['Distance', `${sum.km.toFixed(2)} km`],
      ['Near misses', sum.nearMisses.toLocaleString('en-US')],
      ['Best combo', sum.bestCombo ? `×${sum.bestCombo}` : '—'],
      ['Top speed', `${sum.topKmh} km/h`],
    ],
    line: endLine(sum, { isBest, pick }),
    share: `I drove ${sum.km.toFixed(1)} km of neon highway in ROBOTAXI RUSH on agi1.app 💜 ${sum.nearMisses} near misses`,
    onAgain: () => newRun(),
  });
}

// a quip from her now and then (never two within a few seconds)
function quip(list, chance = 1, force = false) {
  if (!force && (fx.time - lastQuip < 7 || cosmetic.next() > chance)) return;
  lastQuip = fx.time;
  hud.say(pick(list));
}

// what happened in a step: words, sparks, sounds, a buzz
function onEvents() {
  const S = sound.sfx;
  for (const e of run.events) {
    hud.event(e, run);
    const pb = playerBox;
    switch (e.type) {
      case 'near': {
        hud.callout(e.close ? 'SO CLOSE!' : 'NEAR MISS', e.close ? PINK : HONEY, (e.close ? 1.1 : 1) * (1 + Math.min(e.combo - 1, 9) * 0.025), `+${e.pts.toLocaleString('en-US')}`);
        if (pb) {
          // a puff of wind on the side it passed
          parts.burst({ x: pb.x + e.side * pb.w * 0.55, y: pb.y - pb.h * 0.45, count: 7, speed: [120, 300], angle: e.side > 0 ? [-0.5, 0.5] : [Math.PI - 0.5, Math.PI + 0.5], life: [0.18, 0.34], size: [2, 3.5], colors: [PAPER, LAV2], shape: 'spark', drag: 4 });
        }
        S.near(e.combo, e.close);
        shell.haptic(e.close ? 14 : 8);
        shake.kick(e.close ? 0.12 : 0.05);
        if (e.close) quip(RIDE.close, 0.35);
        else if (e.combo === 6 || e.combo === 12) quip(RIDE.chain, 0.8);
        break;
      }
      case 'ready':
        if (teach && !taught && mode === 'play') { taught = true; hud.hint(TOUCH ? 'BOOST IS READY: TAP IT!' : 'BOOST IS READY: PRESS SPACE', 4); }
        S.ready();
        hud.callout('BOOST READY', MINT, 0.9);
        shell.haptic([10, 40, 10]);
        break;
      case 'boost':
        S.boost();
        shake.kick(0.32);
        fx.squash = 0.84;
        shell.haptic(24);
        quip(RIDE.boost, 0.7, true);
        break;
      case 'boostEnd': S.boostEnd(); break;
      case 'ram': {
        const c = e.car;
        const p = renderer.toScreen(run, c.z, c.x, c.h * 0.5);
        if (p) {
          const col = { pod: MINT, van: HONEY, truck: '#6b3bff', bus: PINK, coupe: '#ff5a5f', scooter: SKY }[c.type] || PAPER;
          parts.burst({ x: p.x, y: p.y, count: 18, speed: [160, 520], angle: [-Math.PI, 0], life: [0.4, 0.8], size: [3, 7], colors: [col, INK, PAPER], gravity: 900, shape: 'square', spin: 10 });
          parts.burst({ x: p.x, y: p.y, count: 10, speed: [200, 600], life: [0.15, 0.3], size: [2, 4], colors: [HONEY, PAPER], shape: 'spark', drag: 3 });
          // one SMASH word for a run of them; the ones right after it just their points, stepped apart
          smashN = fx.time - smashAt < 0.6 ? smashN + 1 : 0;
          smashAt = fx.time;
          floats.add({ x: p.x, y: p.y - 18 - (smashN % 3) * 20, text: smashN ? `+${e.pts}` : `SMASH +${e.pts}`, color: MINT, size: (smashN ? 15 : 17) * uiScale(), life: 0.6, rise: 36, font: DISPLAY, strokeWidth: 4 });
        }
        S.ram();
        shake.kick(0.22);
        shell.haptic(12);
        break;
      }
      case 'crash': {
        S.crash();
        shake.kick(e.wreck ? 0.9 : 0.6);
        shell.haptic(e.wreck ? [40, 30, 80] : 34);
        if (pb) {
          parts.burst({ x: pb.x - e.side * pb.w * 0.35, y: pb.y - pb.h * 0.4, count: 26, speed: [180, 560], life: [0.2, 0.5], size: [2, 4], colors: [HONEY, PAPER, PINK], shape: 'spark', drag: 2.5, gravity: 500 });
          parts.burst({ x: pb.x, y: pb.y - pb.h * 0.3, count: 12, speed: [30, 120], angle: [-Math.PI, 0], life: [0.6, 1.1], size: [14, 26], colors: ['#4a3d6e', '#2c2150', '#6b5d8e'], grow: 26, drag: 1.5, gravity: -60 });
        }
        if (!e.wreck) {
          hud.callout(e.shields === 1 ? 'LAST SHIELD!' : 'SHIELD LOST', PINK, 0.95);
          quip(e.shields === 1 ? RIDE.last : RIDE.crash, 1, true);
        }
        break;
      }
      case 'wreck':
        S.wreck();
        if (pb) {
          parts.burst({ x: pb.x, y: pb.y - pb.h * 0.4, count: 40, speed: [200, 700], life: [0.3, 0.9], size: [3, 8], colors: [LAV2, PAPER, PINK, INK], shape: 'square', gravity: 900, spin: 12 });
          parts.burst({ x: pb.x, y: pb.y - pb.h * 0.2, count: 20, speed: [40, 160], angle: [-Math.PI, 0], life: [0.9, 1.6], size: [18, 34], colors: ['#4a3d6e', '#2c2150', '#6b5d8e'], grow: 30, drag: 1.2, gravity: -80 });
        }
        break;
      case 'fare': {
        const p = renderer.toScreen(run, e.item.z, e.item.x, 600);
        const x = p ? p.x : view.w / 2, y = p ? p.y : view.h * 0.6;
        parts.burst({ x, y, count: 16, speed: [100, 340], life: [0.4, 0.8], size: [5, 10], colors: [PINK, HONEY, PAPER], shape: 'star', spin: 6, drag: 2.2 });
        parts.burst({ x, y, count: 2, speed: [0, 0], life: [0.4, 0.5], size: [30, 40], colors: [PINK], shape: 'ring' });
        floats.add({ x, y: y - 10, text: `FARE! +${e.pts}`, color: PINK, size: 22 * uiScale(), life: 0.9, rise: 50, font: DISPLAY, strokeWidth: 5 });
        S.fare();
        shell.haptic(10);
        quip(RIDE.fare, 0.25);
        break;
      }
      case 'shield': {
        const p = renderer.toScreen(run, e.item.z, e.item.x, 600);
        const x = p ? p.x : view.w / 2, y = p ? p.y : view.h * 0.6;
        parts.burst({ x, y, count: 18, speed: [100, 360], life: [0.4, 0.8], size: [4, 8], colors: [MINT, PAPER], shape: 'star', spin: 6, drag: 2.2 });
        floats.add({ x, y: y - 10, text: e.gained ? 'SHIELD +1' : 'SHIELDS FULL', color: MINT, size: 22 * uiScale(), life: 0.9, rise: 50, font: DISPLAY, strokeWidth: 5 });
        S.shield();
        if (e.gained) quip(RIDE.shield, 0.6);
        break;
      }
      case 'checkpoint': {
        S.checkpoint();
        fx.fromZone = zoneOfIndex(segOf(run.z) - 2);
        fx.zoneFade = 0;
        if (mode === 'play') sound.music(e.zone);
        shake.kick(0.18);
        quip(RIDE.checkpoint, 0.7, true);
        break;
      }
      case 'barrier':
        S.barrier();
        if (pb) parts.burst({ x: pb.x + e.side * pb.w * 0.5, y: pb.y - pb.h * 0.25, count: e.hard ? 18 : 8, speed: [140, 420], angle: e.side > 0 ? [Math.PI * 0.6, Math.PI * 1.3] : [-Math.PI * 0.3, Math.PI * 0.4], life: [0.15, 0.4], size: [2, 3.5], colors: [HONEY, PAPER], shape: 'spark', gravity: 600, drag: 2 });
        shake.kick(e.hard ? 0.3 : 0.12);
        fx.tilt = -e.side * 0.08;
        break;
      case 'chainEnd':
        if (e.n >= 4 && !e.broken) { S.chain(e.n); floats.add({ x: view.w / 2, y: view.top + 92 * uiScale(), text: `×${Math.min(e.n, 10)} CHAIN!`, color: HONEY, size: 20 * uiScale(), life: 0.9, rise: 20, font: DISPLAY, strokeWidth: 5 }); }
        break;
      case 'done': endRun(); return;
      default: break;
    }
  }
  run.events.length = 0;
}
const uiScale = () => clamp(Math.min(view.w, view.h * 1.1) / 430, 0.8, 1.3);

// ---------- the loop ----------
const aiInput = { steer: 0, target: null, boost: false };
function update(dt) {
  if (!run || !renderer) return;
  if (mode === 'title') {
    attractAI.drive(run, aiInput, dt);
    aiInput.boost = aiInput.boost && run.t > 6;
    stepRun(run, dt, aiInput);
    run.events.length = 0;
    if (run.over || run.shields < 2) toAttract();
  } else if (mode === 'play' || mode === 'demo') {
    if (mode === 'demo') ai.drive(run, input, dt); else readInput();
    stepRun(run, run.over ? dt * 0.6 : dt, input);
    input.boost = false;
    onEvents();
    if (mode === 'over' || !run) return;
  } else return;
  // past the furthest they've ever driven: a little party, once
  if (mode === 'play' && !bestDone && run.dist > bestDist && !run.over) {
    bestDone = true;
    hud.callout('NEW BEST DISTANCE!', MINT, 0.92, `${(run.dist / 1000).toFixed(2)} km`);
    sound.sfx.ready();
    shell.audio.sfx('win');
    quip(RIDE.record, 1, true);
    if (playerBox) parts.burst({ x: playerBox.x, y: playerBox.y - playerBox.h, count: 26, speed: [140, 420], life: [0.5, 1], size: [5, 10], colors: [MINT, HONEY, PINK, PAPER], shape: 'star', spin: 6, gravity: 300, drag: 1.5 });
  }
  // the sky slides with the curves
  fx.pan += run.track.curve(segOf(run.z)) * (run.speed * dt / SEG) * 0.0035;
}
// the title screen's drive goes on forever: a fresh road when it gets into trouble
function toAttract() {
  attractRuns++;
  run = createRun({ seed: 2049 + attractRuns * 31, attract: true, startM: 140 + (attractRuns % 4) * 2000, boost: 0.2, lane: 1 });
  attractAI.reset();
}

const speedLines = Array.from({ length: 30 }, (_, i) => ({ a: cosmetic.range(0, Math.PI * 2), p: cosmetic.next(), v: cosmetic.range(1.2, 2.2), w: cosmetic.range(1, 2.6), i }));
const rain = Array.from({ length: REDUCED ? 50 : 130 }, () => ({ x: cosmetic.next(), y: cosmetic.next(), v: cosmetic.range(0.9, 1.4), l: cosmetic.range(0.6, 1.2) }));
let frameAvg = 16, slowFor = 0, lowered = 0;

const perf = { n: 0, sum: 0, max: 0 };
const frameInfo = {};
const hudInfo = { demo: DEMO, meter: DEMO, face };
// (the dev server measures each frame's main-thread time for QA: window.__rt.perf())
const render = import.meta.env.DEV ? (alpha, frameDt) => {
  const t0 = performance.now();
  renderFrame(alpha, frameDt);
  const ms = performance.now() - t0;
  perf.n++; perf.sum += ms; perf.max = Math.max(perf.max, ms);
} : renderFrame;
function renderFrame(alpha, frameDt) {
  const dt = Math.min(0.05, frameDt);
  fx.time += dt;
  // paused, or the end card is up: once the smoke has settled, the last frame stays as it is (no drawing, no battery)
  if (shell.state === 'pause' || mode === 'over') {
    if (stillSince < 0) stillSince = fx.time;
    if (fx.time - stillSince > 1.8 && !redraw) { sound.update(false, 0, 0, false); return; }
  } else stillSince = -1;
  redraw = false;
  if (!renderer || !run || !view.layout) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#12072c'; g.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }
  // a slow device: fewer pixels (never in a demo, whose clock is a recording's)
  if (!DEMO && mode === 'play') {
    frameAvg += (frameDt * 1000 - frameAvg) * 0.05;
    slowFor = frameAvg > 25 ? slowFor + dt : 0;
    if (slowFor > 2.5 && lowered < 3 && budget > 0.8e6) { budget *= 0.72; lowered++; slowFor = 0; resize(true); }
  }
  shake.update(dt);
  parts.update(dt);
  floats.update(dt);
  hud.update(dt, run);
  fx.boost += ((run.boostT > 0 ? 1 : 0) - fx.boost) * Math.min(1, dt * (run.boostT > 0 ? 6 : 2.5));
  fx.squash += (1 - fx.squash) * Math.min(1, dt * 9);
  fx.tilt += (0 - fx.tilt) * Math.min(1, dt * 6);
  if (fx.zoneFade < 1) fx.zoneFade = Math.min(1, fx.zoneFade + dt / 2.6);
  const speedPct = run.speed / SPEED.max;
  const rumble = run.rumble && !run.over && (mode === 'play' || mode === 'demo');
  fx.bounce = REDUCED ? 0 : Math.sin(fx.time * 47) * 0.5 * speedPct + (rumble ? Math.sin(fx.time * 90) * 1.6 : 0);
  if (rumble && cosmetic.next() < 0.35 && playerBox) {
    parts.burst({ x: playerBox.x + run.rumble * playerBox.w * 0.42, y: playerBox.y - 2, count: 1, speed: [80, 220], angle: [Math.PI * 1.1, Math.PI * 1.9], life: [0.12, 0.25], size: [2, 3], colors: [HONEY, PAPER], shape: 'spark', gravity: 500 });
    sound.sfx.scrape(fx.time);
  }
  // lightning, now and then, in the rain (never with "reduce motion")
  const zone = zoneOfIndex(segOf(run.z));
  fx.flash = Math.max(0, fx.flash - dt * 3);
  if (zone === 'rain' && !REDUCED) { fx.flashT -= dt; if (fx.flashT <= 0) { fx.flash = 1; fx.flashT = cosmetic.range(5, 11); } }
  const sh = fx.shakeOut;
  sh.x = shake.x; sh.y = shake.y; sh.r = shake.r;
  if (rumble && !REDUCED) { sh.x += (cosmetic.next() - 0.5) * 2; sh.y += (cosmetic.next() - 0.5) * 2; }

  g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  const f = frameInfo;
  f.view = view.layout; f.alpha = mode === 'over' ? 1 : alpha; f.time = fx.time; f.boost = fx.boost; f.shake = sh; f.tilt = fx.tilt;
  f.bounce = fx.bounce; f.squash = fx.squash; f.pan = fx.pan; f.fromZone = fx.fromZone; f.zoneFade = fx.zoneFade; f.flash = fx.flash;
  playerBox = renderer.draw(run, f);
  drawWeather(zone, dt);
  if (fx.boost > 0.15) drawSpeedLines(dt);
  parts.draw(g);
  floats.draw(g);
  if (mode !== 'title') {
    const h = hudInfo;
    h.view = view.layout; h.safe = view.safe; h.top = view.top; h.time = fx.time; h.player = playerBox;
    hud.draw(g, run, h);
  }
  drawBoostButton();

  // the engine and the wind
  sound.update(mode === 'play' && shell.state === 'play', speedPct, fx.boost, rumble);
  chipT -= dt;
  if (chipT <= 0 && mode === 'play') {
    chipT = 0.1;
    kmChip.set((run.z * MPU / 1000).toFixed(2));
    scoreChip.set(run.score);
  }
}

function drawWeather(zone, dt) {
  const amt = zone === 'rain' ? (fx.fromZone && fx.fromZone !== 'rain' ? fx.zoneFade : 1) : fx.fromZone === 'rain' ? 1 - fx.zoneFade : 0;
  if (amt <= 0.01) return;
  const W = view.w, H = view.h;
  const sp = run.speed / SPEED.max;
  g.strokeStyle = 'rgba(190,210,240,.42)';
  g.lineWidth = 1.3;
  g.globalAlpha = amt;
  g.beginPath();
  const lean = -run.lean * 0.25 - 0.18;
  for (const d of rain) {
    d.y += dt * d.v * (1.3 + sp * 0.9);
    d.x += dt * lean * 0.6;
    if (d.y > 1) { d.y -= 1; d.x = cosmetic.next(); }
    if (d.x < 0) d.x += 1; else if (d.x > 1) d.x -= 1;
    const x = d.x * W, y = d.y * H, len = (16 + 22 * sp) * d.l;
    g.moveTo(x, y); g.lineTo(x + lean * len, y + len);
  }
  g.stroke();
  g.globalAlpha = 1;
}

function drawSpeedLines(dt) {
  const L = view.layout;
  const cx = L.cx, cy = L.horizon + (L.carY - L.horizon) * 0.1;
  const R = Math.hypot(view.w, view.h) * 0.75;
  g.globalAlpha = ((fx.boost - 0.15) / 0.85) * (REDUCED ? 0.25 : 0.55);
  g.strokeStyle = PAPER;
  g.lineCap = 'round';
  for (const s of speedLines) {
    s.p += dt * s.v * 2.2;
    if (s.p > 1) { s.p -= 1; s.a = cosmetic.range(0, Math.PI * 2); }
    const r0 = R * (0.25 + s.p * 0.9), r1 = r0 + R * 0.16 * s.p;
    const ca = Math.cos(s.a), sa = Math.sin(s.a);
    g.lineWidth = s.w * (0.5 + s.p);
    g.beginPath(); g.moveTo(cx + ca * r0, cy + sa * r0 * 0.7); g.lineTo(cx + ca * r1, cy + sa * r1 * 0.7); g.stroke();
  }
  g.globalAlpha = 1;
}

createLoop({ update, render, paused: () => shell.state === 'pause' }).start();

// QA on the dev server only (Vite drops this from the production build): window.__rt.run, __rt.wreck()
if (import.meta.env.DEV) window.__rt = { get run() { return run; }, wreck() { if (run) { run.shields = 1; run.grace = 0; } }, get mode() { return mode; }, perf() { const r = { avg: +(perf.sum / Math.max(1, perf.n)).toFixed(2), max: +perf.max.toFixed(1), n: perf.n, dpr: view.dpr, w: canvas.width, h: canvas.height }; perf.n = 0; perf.sum = 0; perf.max = 0; return r; } };

// ---------- start: fonts and pictures first, then the road ----------
const portrait = new Image();
portrait.src = '/images/agi1-portrait-2d.webp';
const loaded = (img) => (img.decode ? img.decode().then(() => img, () => null) : Promise.resolve(null));
const timeout = (ms) => new Promise((res) => setTimeout(() => res(null), ms));
(async () => {
  try {
    await Promise.race([Promise.all([
      document.fonts.load("900 40px 'AK Display'"), document.fonts.load("750 20px 'AK Mono'"), document.fonts.load("italic 400 18px 'AK Serif'"),
    ]), timeout(2500)]);
  } catch { /* the fallback fonts will do */ }
  const art = await Promise.race([loaded(portrait), timeout(1500)]);
  sprites = buildSprites(art);
  if (!art) loaded(portrait).then((img) => { if (img) rebuildBillboards(sprites, img); });
  renderer = createRenderer(g, sprites);
  if (DEMO) newRun(); else toTitle();
})();
