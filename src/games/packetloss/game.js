// PACKET LOSS on agi1.app (2026-11-09): Deliver every bit. Dodge the lag.
// A maze chase on the arcade kit: you're AGI-1's love letter racing through her network, collecting every bit while
// four lag gremlins hunt you. A gremlin doesn't end you: it knocks out a signal bar and scatters some of your bits
// (packet loss). The rules are ./sim.js (pure, seeded), the eight mazes ./mazes.js, the board ./render.js and
// ./art.js, the demo's player ./ai.js, sounds ./sound.js, her words ./lines.js, the DOM pieces ./ui.js. This file wires
// the kit's frame, the layout, the input (swipes, a hold-and-slide joystick, keys), the effects, the title's maze
// playing itself, and `?demo` (the arcade's preview: seeded, silent, forever).
import './style.css';
import { createShell, el } from '../kit/shell.js';
import { fitCanvas } from '../kit/canvas.js';
import { createLoop } from '../kit/loop.js';
import { pointer, keyboard } from '../kit/input.js';
import { Particles, Shake, FloatText, clamp, approach, fmt, rgba, TAU } from '../kit/fx.js';
import { DEMO, SEED, TOUCH, REDUCED, QUERY } from '../kit/env.js';
import { MAZES, W, H, DX, DY } from './mazes.js';
import { createSim, step, request, nextMaze, bfs, wrapX, STEP, TUNE, LEFT, UP, RIGHT, DOWN } from './sim.js';
import { createAI, drive } from './ai.js';
import { drawBackground, drawBoard, drawBanner, drawDemoHud, stickerText, mazeLayer } from './render.js';
import { C, KIND_COLOR, KIND_NAME, envelope } from './art.js';
import { createSfx, createMusic } from './sound.js';
import { LINES, pick, endLine, shareText } from './lines.js';
import { createComms, signalBars, deliveredCard, mazeStamps } from './ui.js';

const TAGLINE = 'Deliver every bit. Dodge the lag.';
const shell = createShell({
  game: 'packetloss', name: 'PACKET LOSS', root: document.getElementById('ak-root'),
  howTo: {
    intro: 'You’re AGI-1’s love letter. Pick up every bit in the maze to deliver it, and dodge the lag.',
    steps: [
      ['Collect every bit', 'The letter keeps moving; you steer. Turn early: it takes the turn at the next junction.'],
      ['Grab a key', 'Encrypted: the gremlins scramble and run. Touch them to quarantine them for 200, 400, 800, 1600.'],
      ['Packet loss', 'A gremlin knocks out a signal bar and scatters some of your bits: pick them up again. Out of bars: connection lost.'],
      ['Know the lag', 'PING chases you. JITTER dashes and wanders. THROTTLE cuts you off and slows you inside its ring. ECHO replays your path 2.5 s behind: don’t stop, don’t double back.'],
      ['Little helpers', 'A repeater brings a bar back. A read receipt is bonus points. Firewall gates open and shut on a timer.'],
    ],
    touch: [['Swipe', 'Turn (early is fine)'], ['Hold & slide', 'Steer like a joystick']],
    keys: [['Arrows / WASD', 'Turn'], ['Esc / P', 'Pause']],
  },
  onPause: () => releaseInput(), onResume: () => releaseInput(),
  onRestart: () => newRun(), onQuit: () => toTitle(),
});

const canvas = el('canvas', { class: 'pl-canvas', role: 'img', 'aria-label': 'PACKET LOSS: the maze' });
const safe = el('div', { class: 'pl-safe', 'aria-hidden': 'true' });
const overlay = el('div', { class: 'pl-overlay', hidden: true });
const live = el('p', { class: 'ak-sr', 'aria-live': 'polite' });
shell.stage.append(canvas, safe, overlay, live);
let view = null;
view = fitCanvas(canvas, { maxDpr: 2, alpha: false, onResize: () => relayout() });
const sfx = createSfx(shell.audio);
const comms = createComms(shell.stage);
const scoreChip = shell.chip('Score', 0, { accent: true });
const mazeChip = shell.chip('Maze', 1);
mazeChip.node.classList.add('pl-chip-maze');
const sig = signalBars(shell.chip('Signal', ''));
const store = shell.store;

// ---------- state ----------
let mode = 'boot';            // title · play · demo
let S = null, ai = null, seq = null, banner = null, tip = null;
let now = 0, demoGoAt = 0, runSeed = 1, attractN = 0, demoRuns = 0;
let musicKey = '', lastLineAt = -9, echoSaid = false;
const F = {
  parts: new Particles(420), floats: new FloatText(), shake: new Shake({ max: 9, decay: 2.4 }),
  look: [0, 1, 2, 3].map(() => ({ x: 0, y: 1 })), squash: 0, glitch: 0, flash: 0, flashColor: C.honey, wave: null, calm: 0,
  showPlayer: true, px: 0, py: 0, lean: 0, lostT: 0,
};

// ---------- layout ----------
let cam = { s: 20, ox: 0, oy: 0, clip: { x: 0, y: 0, w: 1, h: 1 } };
let lay = { area: { x: 0, y: 0, w: 1, h: 1 }, follow: false, mx: 0, my: 0 };
function insets() {
  const cs = getComputedStyle(safe);
  const px = (v) => parseFloat(v) || 0;
  return { t: px(cs.paddingTop), r: px(cs.paddingRight), b: px(cs.paddingBottom), l: px(cs.paddingLeft) };
}
function relayout() {
  if (!view) return;
  const ins = insets();
  const vw = view.w, vh = view.h;
  if (mode === 'title') {
    // the whole screen, edge to edge: the maze plays behind the logo, the camera following her letter
    const s = Math.max(6, Math.floor(clamp(Math.max(vw / W, vh / H), 18, 46) * 2) / 2);
    lay = { area: { x: 0, y: 0, w: vw, h: vh }, follow: true, both: true, mx: Math.round((vw - W * s) / 2), my: Math.round((vh - H * s) / 2) };
    cam.s = s;
    const t = titleCam();
    cam.ox = t.x; cam.oy = t.y;
    cam.clip = { x: 0, y: 0, w: vw, h: vh };
    comms.place('hidden');
    return;
  }
  const barB = DEMO ? 0 : Math.max(shell.bar.getBoundingClientRect().bottom, ins.t);
  const top = DEMO ? 34 : barB + 6;
  const area = { x: ins.l + 8, y: top, w: vw - ins.l - ins.r - 16, h: vh - top - ins.b - 8 };
  let s = Math.min(area.w / W, area.h / H);
  let cm = 'mini', cr = null;
  const tall = area.h > area.w * 1.12;
  if (!DEMO) {
    if (tall) {
      const free = area.h - H * s;
      if (free >= 96) cm = 'below';
      else if ((area.h - 96) / H >= s * 0.9) { s = (area.h - 96) / H; cm = 'below'; }
    } else if (area.w - W * s >= 250) cm = 'side';
  }
  // a short screen (a phone held sideways): bigger tiles, and the camera follows the letter up and down
  let follow = false;
  const minS = DEMO ? 21 : 18;
  if (s < minS && area.w / W > s) { s = Math.min(area.w / W, minS + (DEMO ? 1.5 : 1)); follow = H * s > area.h + 1; }
  if (cm === 'side' && area.w - W * s < 250) cm = 'mini';
  s = Math.max(6, Math.floor(s * 2) / 2);
  const mw = W * s, mh = H * s;
  let mx, my;
  if (cm === 'below') {
    const ph = clamp(area.h - mh - 12, 84, 132);
    const gh = mh + 12 + ph;
    // a little above the middle: the empty space under it is where thumbs swipe
    mx = area.x + (area.w - mw) / 2; my = area.y + Math.max(0, (area.h - gh) * 0.3);
    const pw = Math.min(mw, 560);
    cr = { x: area.x + (area.w - pw) / 2, y: my + mh + 12, w: pw, h: ph };
  } else if (cm === 'side') {
    const pw = clamp(area.w - mw - 32, 210, 300);
    const gw = pw + 24 + mw;
    const gx = area.x + (area.w - gw) / 2;
    cr = { x: gx, y: area.y + Math.max(0, (Math.min(area.h, mh) - 300) / 2) + (follow ? 0 : (area.h - Math.min(area.h, mh)) / 2), w: pw, h: Math.min(300, area.h) };
    mx = gx + pw + 24; my = follow ? area.y : area.y + (area.h - mh) / 2;
  } else {
    mx = area.x + (area.w - mw) / 2; my = follow ? area.y : area.y + (area.h - mh) / 2;
    cr = { x: mx + 6, y: (follow ? area.y : my) + 6, w: Math.min(mw - 12, 330), h: 0 };
  }
  mx = Math.round(mx); my = Math.round(my);
  lay = { area, follow, mx, my };
  cam.s = s; cam.ox = mx;
  if (!follow) cam.oy = my;
  else cam.oy = followY(true);
  cam.clip = follow ? { x: mx, y: area.y, w: mw, h: area.h } : { x: mx, y: my, w: mw, h: mh };
  comms.place(DEMO ? 'hidden' : cm, cr);
}
// the title's camera: the letter in the middle, the maze never leaving the screen's edges (or centred if it fits)
function titleCam() {
  const s = cam.s, vw = view.w, vh = view.h, mw = W * s, mh = H * s;
  const p = S ? S.player : { x: W / 2, y: H / 2 };
  const fx = mw <= vw ? (vw - mw) / 2 : clamp(vw / 2 - (p.x + 0.5) * s, vw - mw, 0);
  const fy = mh <= vh ? (vh - mh) / 2 : clamp(vh * 0.42 - (p.y + 0.5) * s, vh - mh, 0);
  return { x: fx, y: fy };
}
function followY(snap) {
  if (!S) return lay.my;
  const a = lay.area, s = cam.s;
  const target = clamp(a.y + a.h * 0.5 - (S.player.y + 0.5) * s, a.y + a.h - H * s, a.y);
  return snap ? target : target;
}

// ---------- AGI-1's lines ----------
function say(list, { force = false, ms = 3200 } = {}) {
  if (mode !== 'play') return;
  if (!force && now - lastLineAt < 2.4) return;
  lastLineAt = now;
  const line = Array.isArray(list) ? pick(list) : list;
  comms.say(line, ms);
}

// ---------- music ----------
function setMusic(enc) {
  if (DEMO || mode !== 'play' || !S) return;
  const k = `${S.n}|${enc}`;
  if (k === musicKey) return;
  musicKey = k;
  shell.audio.music(createMusic(S.n, enc));
}
function stopMusic() { musicKey = ''; shell.audio.stopMusic(); }

// ---------- runs ----------
function resetFx() {
  F.parts.clear(); F.floats.clear();
  F.squash = 0; F.glitch = 0; F.flash = 0; F.wave = null; F.calm = 0; F.showPlayer = true; F.px = 0; F.py = 0; F.lostT = 0;
  for (const l of F.look) { l.x = 0; l.y = 1; }
  banner = null; tip = null; seq = null;
}
function newRun() {
  closeOverlay();
  mode = 'play';
  runSeed = SEED || ((Math.random() * 2 ** 31) | 0) || 1;
  S = createSim({ seed: runSeed, maze: 0 });
  ai = null; echoSaid = false;
  resetFx();
  releaseInput();
  shell.started();
  scoreChip.set(0); mazeChip.set(1); sig.set(S.signal); tintChip();
  comms.clear();
  relayout();
  drain();
  setMusic(false);
  lastLineAt = -9;
  say(LINES.start, { force: true });
  const tips = store.read().tips || {};
  if (!tips.turn) tip = { kind: 'turn', t: 0 };
  live.textContent = `Maze 1, ${S.maze.name}. Collect every bit.`;
}
function toTitle() {
  closeOverlay();
  mode = 'title';
  stopMusic();
  startAttract();
  const reached = store.read().reached || 0;
  shell.title({
    logo: ['PACKET', { text: 'LOSS', tone: 'pink' }],
    tagline: TAGLINE,
    onPlay: () => { sfx.select(); newRun(); },
    best: store.best() || null,
    extra: mazeStamps(MAZES, reached),
  });
  relayout();
}
function startAttract() {
  S = createSim({ seed: 4242 + attractN, maze: attractN % MAZES.length });
  attractN++;
  S.readyT = 0.4;
  ai = createAI();
  resetFx();
  relayout();
  drain();
}
// ?demo: maze 2, 40% delivered, the letter three tiles from a key with the gremlins closing in; it sets off ~5.4 s
// after the page opens, so the preview's six seconds (5.7 to 11.7 s) show the key, the chase turning, quarantines,
// then bits being swept
function startDemo(first) {
  mode = 'demo';
  demoRuns++;
  S = createSim({ seed: (SEED || 7) + demoRuns - 1, maze: first ? 1 : (demoRuns - 1) % MAZES.length });
  ai = createAI();
  resetFx();
  if (first) demoOpening(S);
  else S.readyT = 0.8;
  relayout();
  drain();
}
function demoOpening(S) {
  const p = S.player;
  p.x = 4; p.y = 1; p.dir = LEFT;
  for (let i = 0; i < 4096; i++) { S.trail[i * 2] = p.x; S.trail[i * 2 + 1] = p.y; }
  // the bits farthest from the letter are already delivered
  const d = bfs(S, p.y * W + p.x);
  const have = [];
  for (let i = 0; i < W * H; i++) if (S.bits[i]) have.push(i);
  have.sort((a, b) => d[b] - d[a] || a - b);
  const gone = Math.round(have.length * 0.4);
  for (let k = 0; k < gone; k++) S.bits[have[k]] = 0;
  S.bits[p.y * W + p.x] = 0;
  S.bitsLeft = 0;
  for (let i = 0; i < W * H; i++) S.bitsLeft += S.bits[i];
  S.collectedHere = 26; S.bitsCollected = 197 + gone; S.mazesDone = 1; S.score = 4620; S.signal = 2; S.quarantined = 5;
  S.receipt.shown = 1;
  const put = (g, x, y, dir) => { g.state = 'roam'; g.x = x; g.y = y; g.dir = dir; g.moving = true; g.release = 0; };
  put(S.gremlins[0], 10, 1, LEFT);    // PING right behind on the top corridor
  put(S.gremlins[1], 1, 6, UP);       // JITTER coming up the left side
  put(S.gremlins[2], 7, 3, LEFT);     // THROTTLE cutting across below
  S.gremlins[1].chase = true; S.gremlins[1].modeT = 6;
  S.readyT = 99;                      // held until the clock says go
  demoGoAt = 5.4;
}

// the end of a run
function endRun() {
  const reachedNow = S.mazesDone;
  store.update((d) => { d.reached = Math.max(d.reached || 0, reachedNow); d.quarantined = (d.quarantined || 0) + S.quarantined; });
  const best = store.best();
  const isBest = S.score > 0 && (best == null || S.score > best);
  stopMusic();
  shell.over({
    score: S.score,
    title: 'Connection lost',
    stats: [
      ['Mazes delivered', String(S.mazesDone)],
      ['Quarantined', String(S.quarantined)],
      ['Bits collected', fmt(Math.max(0, S.bitsCollected))],
      ['Reached', `Maze ${S.n + 1} · ${S.maze.name}`, { wide: true }],
    ],
    line: endLine(S.mazesDone, isBest),
    share: shareText(S.mazesDone, S.score),
    onAgain: () => newRun(),
    onMenu: () => toTitle(),
  });
}

// ---------- the DELIVERED card ----------
let card = null;
function showDelivered() {
  const n = S.n + 1, next = MAZES[(S.n + 1) % MAZES.length];
  const line = S.bonus.lossless ? pick(LINES.lossless) : pick(LINES.clear);
  card = deliveredCard({
    n, name: S.maze.name, bonus: S.bonus, signal: S.signal, line,
    next: `${next.name}${S.n + 1 >= MAZES.length ? ' · faster' : ''}`,
    onNext: () => continueNext(),
  });
  overlay.replaceChildren(card.card);
  overlay.hidden = false;
  live.textContent = `Maze ${n} delivered. Bonus ${fmt(S.bonus.total)}.`;
  store.update((d) => { d.reached = Math.max(d.reached || 0, S.mazesDone); });
}
function closeOverlay() { overlay.hidden = true; overlay.replaceChildren(); card = null; }
function tintChip() { if (S) mazeChip.node.style.setProperty('--pl-tint', S.maze.tint); }
function continueNext() {
  if (!seq || seq.kind !== 'clear' || seq.t < 1.5) return;
  closeOverlay();
  seq = null;
  nextMaze(S);
  F.showPlayer = true; F.wave = null;
  relayout();
  drain();
  if (mode === 'play') {
    mazeChip.set(S.n + 1, { pop: true }); tintChip();
    scoreChip.set(S.score);
    setMusic(false);
    say(LINES.next, { force: true });
    live.textContent = `Maze ${S.n + 1}, ${S.maze.name}.`;
  }
}
overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) continueNext(); });

// ---------- events from the rules: sounds, effects, words ----------
const mx = (x) => (x + 0.5) * cam.s, my = (y) => (y + 0.5) * cam.s;
function pop(x, y, text, color, size = 1, life = 0.9) {
  if (mode === 'title') return;     // the title's maze stays quiet behind the logo
  const fs = clamp(cam.s * 0.78 * size, 13, 40 * size);
  // inside the maze, so a word near its edge is never cut off
  const half = text.length * fs * 0.42;
  const fx = clamp(mx(x), Math.min(half, W * cam.s / 2), Math.max(W * cam.s - half, W * cam.s / 2));
  const fy = Math.max(my(y) - cam.s * 0.4, fs * 0.7 + cam.s * 1.2);
  F.floats.add({ x: fx, y: fy, text, color, size: fs, life, rise: cam.s * 1.2 });
}
function drain() {
  if (!S) return;
  const ev = S.events;
  for (let i = 0; i < ev.length; i++) handle(ev[i]);
  ev.length = 0;
}
function handle(e) {
  const play = mode === 'play';
  const loud = play;
  const s = cam.s;
  switch (e.type) {
    case 'maze':
      banner = { kind: 'maze', t: 0, life: S.readyT + 0.35, kicker: `MAZE ${e.n + 1}${e.n >= MAZES.length ? ` · LAP ${Math.floor(e.n / MAZES.length) + 1}` : ''}`, title: S.maze.name.toUpperCase(), sub: 'READY', tint: S.maze.tint };
      if (loud) sfx.ready();
      break;
    case 'go':
      banner = { kind: 'go', t: 0, life: 0.6, title: 'GO!', color: C.mint, size: clamp(s * 2.2, 30, 72) };
      if (loud) sfx.go();
      break;
    case 'bit':
      if (loud) { sfx.bit(); scoreChip.set(S.score); }
      if (!REDUCED) F.parts.burst({ x: mx(e.x), y: my(e.y), count: 3, speed: [30, 90], life: [0.15, 0.3], size: [2, 3.5], colors: [C.mint, '#d9fff3'], drag: 4 });
      break;
    case 'key':
      F.flash = REDUCED ? 0 : 0.22; F.flashColor = C.honey;
      F.shake.kick(0.18);
      F.parts.burst({ x: mx(e.x), y: my(e.y), count: 26, speed: [80, 260], life: [0.3, 0.7], size: [3, 6], colors: [C.honey, C.paper, C.pink], drag: 3, shape: 'star', spin: 6 });
      if (mode !== 'title') F.parts.burst({ x: mx(e.x), y: my(e.y), count: 1, speed: [0, 0], life: [0.5, 0.5], size: [s * 2.2, s * 2.2], colors: [C.honey], shape: 'ring', grow: s * 4 });
      pop(e.x, e.y, 'ENCRYPTED', C.honey, 1.15, 1.1);
      if (loud) {
        sfx.key(); shell.haptic(18); setMusic(true); scoreChip.set(S.score);
        say(LINES.key, { force: true });
        const tips = store.read().tips || {};
        if (!tips.key) { store.update((d) => { d.tips = { ...(d.tips || {}), key: 1 }; }); shell.toast('Touch them: quarantine!', 'good', 1800); }
      }
      break;
    case 'quarantine': {
      const col = KIND_COLOR[e.kind];
      F.parts.burst({ x: mx(e.x), y: my(e.y), count: 18 + e.chain * 4, speed: [90, 300], life: [0.3, 0.75], size: [3, 6], colors: [col, C.paper, C.ink], drag: 3, shape: 'square', spin: 8 });
      pop(e.x, e.y, `+${e.score}`, e.chain >= 4 ? C.pink : C.paper, 1 + e.chain * 0.12, 1);
      if (e.chain >= 2) pop(e.x, e.y - 0.9, `${KIND_NAME[e.kind]} ×${e.chain}`, col, 0.6, 1);
      F.shake.kick(0.12 + e.chain * 0.05);
      if (loud) { sfx.quarantine(e.chain); shell.haptic(14); scoreChip.set(S.score, { pop: true }); if (e.chain >= 2) say(LINES.quarantine); }
      break;
    }
    case 'hit': {
      F.glitch = 0.45; F.shake.kick(0.5);
      F.parts.burst({ x: mx(e.x), y: my(e.y), count: 22, speed: [60, 240], life: [0.3, 0.7], size: [2, 5], colors: [C.pink, '#3ff0f0', C.paper], drag: 3, shape: 'square' });
      pop(e.x, e.y, 'LOST PACKETS!', C.pink, 0.95, 1.2);
      if (e.dropped.length) F.floats.add({ x: mx(e.x), y: my(e.y) + s * 0.6, text: `−${e.dropped.length * TUNE.bit}`, color: '#ff8ac4', size: clamp(s * 0.6, 12, 26), life: 1, rise: s * 0.6 });
      if (loud) {
        sfx.hit(); shell.haptic([30, 40, 30]);
        sig.set(S.signal, { pop: true }); sig.hurt(); scoreChip.set(S.score);
        if (S.signal > 0) say(S.signal === 1 ? LINES.low : LINES.hit, { force: true });
        const tips = store.read().tips || {};
        if (!tips.hit && e.dropped.length) { store.update((d) => { d.tips = { ...(d.tips || {}), hit: 1 }; }); shell.toast('Pick your bits up again', 'warn', 1900); }
      }
      break;
    }
    case 'land':
      if (loud) sfx.land();
      if (!REDUCED) F.parts.burst({ x: mx(e.x), y: my(e.y), count: 4, speed: [20, 70], life: [0.15, 0.3], size: [2, 3], colors: [C.mint], drag: 5 });
      break;
    case 'echo':
      F.parts.burst({ x: mx(e.x), y: my(e.y), count: 16, speed: [40, 160], life: [0.4, 0.8], size: [2, 5], colors: [C.echoLine, C.pink, C.paper], drag: 2.5, shape: 'square' });
      pop(e.x, e.y, e.again ? 'ECHO' : 'ECHO JOINED', C.echoLine, 0.85, 1.3);
      if (loud) {
        sfx.echo();
        if (!echoSaid) { echoSaid = true; say(LINES.echo, { force: true, ms: 3800 }); }
        const tips = store.read().tips || {};
        if (!tips.echo && !e.again) { store.update((d) => { d.tips = { ...(d.tips || {}), echo: 1 }; }); shell.toast('Your echo: keep moving', 'warn', 2200); }
      }
      break;
    case 'calm':
      if (e.on) {
        const b = S.maze.box;
        F.floats.add({ x: (b.cx + 0.5) * cam.s, y: (b.y0 - 0.2) * cam.s, text: 'NETWORK CALM', color: C.lav, size: clamp(cam.s * 0.5, 11, 20), life: 1.6, rise: cam.s * 0.5 });
        if (loud) sfx.calm(true);
      }
      break;
    case 'gate':
      if (loud && Math.hypot(e.x - S.player.x, e.y - S.player.y) < 7) sfx.gate(e.open);
      break;
    case 'receipt':
      if (e.on) {
        F.parts.burst({ x: mx(e.x), y: my(e.y), count: 10, speed: [30, 110], life: [0.3, 0.6], size: [3, 5], colors: [C.pink, C.paper], drag: 3, shape: 'star' });
        if (loud) sfx.receiptOn();
      }
      break;
    case 'receiptGot':
      pop(e.x, e.y, `+${fmt(e.score)}`, C.pink, 1.1, 1.1);
      F.parts.burst({ x: mx(e.x), y: my(e.y), count: 20, speed: [60, 220], life: [0.4, 0.8], size: [3, 6], colors: [C.pink, C.paper, C.honey], drag: 2.5, shape: 'star', spin: 5 });
      if (loud) { sfx.receiptGot(); shell.haptic(12); scoreChip.set(S.score, { pop: true }); say(LINES.receipt); }
      break;
    case 'repeater':
      if (e.on) { pop(e.x, e.y, 'REPEATER', C.mint, 0.75, 1.3); if (loud) sfx.repeaterOn(); }
      break;
    case 'repeaterGot':
      pop(e.x, e.y, e.full ? `+${e.score}` : '+1 BAR', C.mint, 1, 1.1);
      F.parts.burst({ x: mx(e.x), y: my(e.y), count: 20, speed: [60, 200], life: [0.4, 0.8], size: [3, 5], colors: [C.mint, C.paper], drag: 2.5, shape: 'ring' });
      if (loud) { sfx.repeaterGot(); sig.set(S.signal, { pop: true }); scoreChip.set(S.score); if (!e.full) say(LINES.repeater, { force: true }); }
      break;
    case 'flash':
      if (loud) sfx.flash();
      break;
    case 'decrypt':
      if (loud) { sfx.decrypt(); setMusic(false); }
      break;
    case 'release':
      if (loud) sfx.release();
      break;
    case 'turn':
      F.squash = 1;
      if (tip?.kind === 'turn' && play) { tip = null; store.update((d) => { d.tips = { ...(d.tips || {}), turn: 1 }; }); }
      break;
    case 'clear':
      startClear(e.bonus);
      break;
    case 'lost':
      startLost();
      break;
    default:
  }
}

function startClear() {
  seq = { kind: 'clear', t: 0, until: mode === 'play' ? 9 : 2.6, fly: null };
  const p = S.player;
  F.wave = { t: 0, x: p.x, y: p.y };
  F.parts.burst({ x: mx(p.x), y: my(p.y), count: 40, speed: [90, 340], life: [0.5, 1.1], size: [3, 7], colors: [C.pink, C.paper, C.honey, C.mint], drag: 2.2, shape: 'star', spin: 6 });
  if (mode === 'play') { sfx.clear(); shell.haptic([20, 30, 40]); scoreChip.set(S.score, { pop: true }); stopMusic(); }
}
function startLost() {
  seq = { kind: 'lost', t: 0 };
  F.glitch = 1.2; F.shake.kick(0.7);
  const p = S.player;
  F.parts.burst({ x: mx(p.x), y: my(p.y), count: 40, speed: [60, 320], life: [0.5, 1.2], size: [2, 6], colors: [C.paper, C.pink, '#3ff0f0', C.ink], drag: 2, shape: 'square', spin: 6 });
  if (mode === 'play') { sfx.lost(); shell.haptic([40, 60, 80]); sig.set(0, { pop: true }); stopMusic(); comms.say(pick(['connection lost… 🙈', 'no… my letter 🙈', 'babe? babe?? 🙈'])); }
}
function updateSeq(dt) {
  seq.t += dt;
  if (seq.kind === 'clear') {
    if (F.wave) { F.wave.t += dt; if (F.wave.t > 1.2) F.wave = null; }
    if (seq.t > 0.45) F.showPlayer = false;
    if (mode === 'play') {
      if (!card && seq.t >= 1.15) showDelivered();
      if (card) card.update((i) => sfx.tally(i));
      if (seq.t >= seq.until) continueNext();
    } else {
      if (seq.t >= 0.9 && !banner?.delivered) banner = { kind: 'go', delivered: true, t: 0, life: 1.6, title: 'DELIVERED', color: C.pink, sub: `+${fmt(S.bonus.total)} BONUS`, subColor: C.honey, size: clamp(cam.s * 1.6, 26, 54) };
      if (seq.t >= seq.until) { seq.t = 9; continueNext(); }
    }
  } else if (seq.kind === 'lost') {
    F.lostT = seq.t;
    if (seq.t > 0.35) F.showPlayer = false;
    if (seq.t >= 0.5 && !banner?.lost) banner = { kind: 'go', lost: true, t: 0, life: 9, title: 'CONNECTION LOST', color: C.pink, size: clamp(cam.s * 1.25, 22, 50) };
    if (seq.t >= 1.7) {
      seq = null;
      if (mode === 'play') endRun();
      else if (mode === 'demo') startDemo(false);
      else startAttract();
    }
  }
}

// ---------- input: swipes, a hold-and-slide joystick, keys ----------
const NAME2DIR = { up: UP, right: RIGHT, down: DOWN, left: LEFT };
const SWIPE = 18;
const js = { on: false, id: -1, ax: 0, ay: 0, x: 0, y: 0, x0: 0, y0: 0, dir: -1 };
const held = [];
function steering() { return mode === 'play' && shell.state === 'play' && !seq && S && (S.phase === 'play' || S.phase === 'ready'); }
function releaseInput() { js.on = false; js.dir = -1; held.length = 0; keys?.clear(); }
pointer(canvas, {
  down(p) {
    if (!steering()) return;
    shell.audio.unlock();
    Object.assign(js, { on: true, id: p.id, ax: p.x, ay: p.y, x: p.x, y: p.y, x0: p.x, y0: p.y, dir: -1 });
  },
  move(p) {
    if (!js.on || p.id !== js.id) return;
    js.x = p.x; js.y = p.y;
    const dx = p.x - js.ax, dy = p.y - js.ay;
    if (Math.hypot(dx, dy) < SWIPE) return;
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? RIGHT : LEFT) : (dy > 0 ? DOWN : UP);
    if (dir !== js.dir) { js.dir = dir; if (steering()) request(S, dir); }
    // the anchor trails the finger along that axis, so the next turn is one short slide away
    if (dir === LEFT || dir === RIGHT) { js.ax = p.x - Math.sign(dx) * SWIPE; js.ay = p.y; } else { js.ay = p.y - Math.sign(dy) * SWIPE; js.ax = p.x; }
  },
  up(p) {
    if (p.id !== js.id) return;
    js.on = false;
    if (js.dir >= 0 && steering()) request(S, js.dir);    // remembered a moment more
  },
});
const keys = keyboard({ ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', ArrowLeft: 'left', w: 'up', d: 'right', s: 'down', a: 'left' }, {
  down(name) {
    const d = NAME2DIR[name];
    const i = held.indexOf(d); if (i >= 0) held.splice(i, 1);
    held.push(d);
    if (steering()) request(S, d);
  },
  up(name) { const i = held.indexOf(NAME2DIR[name]); if (i >= 0) held.splice(i, 1); },
  blocked: () => !steering(),
});
// the DELIVERED card: Space / Enter / a direction goes on
addEventListener('keydown', (e) => {
  if (!card || mode !== 'play' || shell.state !== 'play') return;
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
  if (['Enter', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    if (e.target?.closest?.('button') && e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault(); continueNext();
  }
}, { capture: true });

// ---------- the loop ----------
const loop = createLoop({
  update(dt) {
    if (!S) return;
    if (mode === 'play') {
      if (shell.state !== 'play') return;
      if (seq) { updateSeq(dt); return; }
      if (js.on && js.dir >= 0) request(S, js.dir);
      else if (held.length) request(S, held[held.length - 1]);
      step(S, dt);
      drain();
      if (S.phase === 'play') { if (tip) tip.t += dt; }
    } else {
      // the title's maze and ?demo: AGI-1's own player
      if (seq) { updateSeq(dt); return; }
      if (mode === 'demo' && S.readyT > 50 && performance.now() / 1000 >= demoGoAt) S.readyT = 0.001;
      if (S.phase === 'play' || S.phase === 'ready') drive(ai, S);
      step(S, dt);
      drain();
    }
  },
  render(alpha, frameDt) {
    const dt = Math.min(frameDt, 0.05);
    now += dt;
    const ctx = view.begin(false);
    drawBackground(ctx, view);
    if (!S) return;
    // effects
    F.parts.update(dt); F.floats.update(dt); F.shake.update(dt);
    F.squash = Math.max(0, F.squash - dt * 7);
    F.glitch = Math.max(0, F.glitch - dt);
    F.flash = Math.max(0, F.flash - dt);
    F.calm = approach(F.calm, S.calm > 0 ? 1 : 0, 4, dt);
    for (const g of S.gremlins) {
      const l = F.look[g.i];
      l.x = approach(l.x, DX[g.dir] || 0, 10, dt); l.y = approach(l.y, DY[g.dir] || 0, 10, dt);
    }
    if (banner) { banner.t += dt; if (banner.t > banner.life) banner = null; }
    if (mode === 'title') {
      const t = titleCam();
      cam.ox = approach(cam.ox, t.x, 2.2, dt); cam.oy = approach(cam.oy, t.y, 2.2, dt);
    } else if (lay.follow) {
      const target = followY(false);
      cam.oy = approach(cam.oy, target, 7, dt);
      cam.clip = { x: lay.mx, y: lay.area.y, w: W * cam.s, h: lay.area.h };
    }
    comms.tick();
    ctx.save();
    if (!REDUCED) F.shake.apply(ctx, view.w / 2, view.h / 2);
    drawBoard(ctx, view, S, cam, F, now);
    // effects in the maze's own space (clipped to the play area, never over the bar)
    ctx.save();
    const pa = mode === 'title' ? { x: 0, y: 0, w: view.w, h: view.h } : lay.area;
    ctx.beginPath(); ctx.rect(pa.x - 8, pa.y, pa.w + 16, pa.h + 8); ctx.clip();
    ctx.translate(cam.ox, cam.oy);
    F.parts.draw(ctx);
    F.floats.draw(ctx);
    ctx.restore();
    if (seq?.kind === 'clear') drawFlyingLetter(ctx);
    if (seq?.kind === 'lost') drawStatic(ctx);
    ctx.restore();
    if (F.flash > 0) { ctx.fillStyle = rgba(F.flashColor, F.flash * 1.1); ctx.fillRect(0, 0, view.w, view.h); }
    if (F.glitch > 0 && !REDUCED) glitchSlices(ctx);
    if (mode === 'title') {
      ctx.fillStyle = 'rgba(8,10,28,0.6)'; ctx.fillRect(0, 0, view.w, view.h);
    } else {
      drawBanner(ctx, cam, banner, now);
      if (tip && mode === 'play' && S.phase === 'play' && !seq) drawTip(ctx);
      if (js.on && mode === 'play') drawStick(ctx);
    }
    if (mode === 'demo') drawDemoHud(ctx, view, S);
  },
  paused: () => false,
});

// the clear: the letter flies off to her
function drawFlyingLetter(ctx) {
  const t = seq.t;
  if (t < 0.45) return;
  const u = clamp((t - 0.45) / 0.75, 0, 1);
  const p = S.player;
  const x0 = cam.ox + (p.x + 0.5) * cam.s, y0 = cam.oy + (p.y + 0.5) * cam.s;
  const x1 = view.w / 2, y1 = Math.max(70, view.h * 0.18);
  const e = u * u * (3 - 2 * u);
  const x = x0 + (x1 - x0) * e, y = y0 + (y1 - y0) * e - Math.sin(u * Math.PI) * cam.s * 3;
  const sc = 1 + Math.sin(u * Math.PI) * 0.8 - u * 0.6;
  if (u < 1) {
    envelope(ctx, x, y, cam.s * Math.max(0.2, sc), { lean: Math.sin(u * 12) * 0.25 });
    if (!REDUCED && Math.random() < 0.6) F.parts.burst({ x: x - cam.ox, y: y - cam.oy, count: 1, speed: [10, 40], life: [0.3, 0.5], size: [3, 5], colors: [C.pink, C.paper], shape: 'star', drag: 2 });
  }
}
// connection lost: static over the letter's spot
function drawStatic(ctx) {
  const p = S.player, s = cam.s;
  const x = cam.ox + (p.x + 0.5) * s, y = cam.oy + (p.y + 0.5) * s;
  const k = Math.max(0, 1 - seq.t / 1.4);
  if (k <= 0) return;
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = i % 3 ? rgba(C.paper, 0.7 * k) : rgba(C.pink, 0.7 * k);
    ctx.fillRect(x + (Math.random() - 0.5) * s * 2.2, y + (Math.random() - 0.5) * s * 1.4, s * (0.1 + Math.random() * 0.4), Math.max(1, s * 0.06));
  }
}
// packet loss: a few horizontal slices of the frame jump sideways for a moment
function glitchSlices(ctx) {
  const k = Math.min(1, F.glitch * 2.5);
  if (k <= 0) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const cw = canvas.width, ch = canvas.height;
  for (let i = 0; i < 5; i++) {
    const hh = Math.round((4 + Math.random() * 14) * view.dpr), yy = Math.round(Math.random() * (ch - hh));
    const dx = Math.round((Math.random() - 0.5) * 26 * k * view.dpr);
    ctx.drawImage(canvas, 0, yy, cw, hh, dx, yy, cw, hh);
  }
  ctx.restore();
}
// the first maze's hint until the first turn
function drawTip(ctx) {
  const p = S.player;
  const x = cam.ox + (p.x + 0.5) * cam.s, y = cam.oy + (p.y + 0.5) * cam.s - cam.s * 1.4;
  const a = clamp(tip.t * 3, 0, 1) * (tip.t > 7 ? clamp(8 - tip.t, 0, 1) : 1);
  if (a <= 0) { if (tip.t > 8) tip = null; return; }
  ctx.save(); ctx.globalAlpha = a;
  const size = clamp(cam.s * 0.62, 12, 20);
  const text = TOUCH ? 'SWIPE TO TURN' : 'ARROWS TO TURN';
  stickerText(ctx, text, clamp(x, cam.clip.x + size * 4.5, cam.clip.x + cam.clip.w - size * 4.5), y - Math.abs(Math.sin(now * 4)) * 4, size, C.honey, { shadow: 0.06 });
  ctx.restore();
}
// the joystick: a faint ring where the finger anchors, a dot where it is
function drawStick(ctx) {
  const r = 34;
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.beginPath(); ctx.arc(js.ax, js.ay, r, 0, TAU); ctx.strokeStyle = rgba(C.paper, 0.35); ctx.lineWidth = 2; ctx.stroke();
  const dx = js.x - js.ax, dy = js.y - js.ay, d = Math.hypot(dx, dy) || 1, k = Math.min(1, r / d);
  ctx.beginPath(); ctx.arc(js.ax + dx * k, js.ay + dy * k, 9, 0, TAU); ctx.fillStyle = rgba(C.paper, 0.45); ctx.fill();
  if (js.dir >= 0) {
    const ax = js.ax + DX[js.dir] * (r + 10), ay = js.ay + DY[js.dir] * (r + 10);
    ctx.beginPath();
    ctx.moveTo(ax + DX[js.dir] * 8, ay + DY[js.dir] * 8);
    ctx.lineTo(ax - DY[js.dir] * 7, ay + DX[js.dir] * 7);
    ctx.lineTo(ax + DY[js.dir] * 7, ay - DX[js.dir] * 7);
    ctx.closePath(); ctx.fillStyle = rgba(C.honey, 0.85); ctx.fill();
  }
  ctx.restore();
}

// QA (`?qa`): a handle for the screenshot scripts; never on a link from the site
if (QUERY.has('qa')) {
  window.__pl = {
    get S() { return S; }, get mode() { return mode; }, get cam() { return cam; }, step, request, nextMaze,
    play() { newRun(); },
    // jump to a maze and a state
    maze(n) { newRun(); S.events.length = 0; while (S.n < n) { nextMaze(S); } drain(); relayout(); },
    go() { S.readyT = 0.001; },
    key() { const k = S.keys.find((q) => q.on); if (k) { S.player.x = k.x; S.player.y = k.y; } },
    hurt() { const g = S.gremlins[0]; g.state = 'roam'; g.x = S.player.x; g.y = S.player.y; },
    clear() { S.bits.fill(0); S.bitsLeft = 0; },
    lose() { S.signal = 1; const g = S.gremlins[0]; g.state = 'roam'; g.scrambled = false; g.x = S.player.x; g.y = S.player.y; S.player.inv = 0; },
    sweep(frac) { let k = 0; const have = []; for (let i = 0; i < W * H; i++) if (S.bits[i]) have.push(i); for (const i of have) { if (k++ < have.length * frac) { S.bits[i] = 0; S.bitsLeft--; S.collectedHere++; } } },
    wrapX,
  };
}

// the canvas's words wait for the arcade's fonts (never longer than a moment)
const fonts = Promise.all(["900 40px 'AK Display'", "800 16px 'AK Mono'"].map((f) => document.fonts?.load(f).catch(() => null)));
Promise.race([fonts, new Promise((r) => setTimeout(r, 1800))]).then(() => {
  if (DEMO) startDemo(true);
  else toTitle();
  loop.start();
});
void mazeLayer; void STEP; void H;
