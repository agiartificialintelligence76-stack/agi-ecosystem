// OVERCLOCK on agi1.app (2026-11-08): neon pinball on AGI-1's motherboard. Flip fast. Run hot. Don't drop the ball.
// This file wires the arcade kit's frame (shell, canvas, loop, sound) to the game: the table's physics and rules
// (sim.js → physics.js, table.js, rules.js), its looks (render.js), its dot-matrix display (dmd.js), its sounds
// (sound.js), AGI-1's lines (lines.js) and her own player (ai.js: ?demo, and the game behind the title screen).
import './style.css';
import { createShell, el } from '../kit/shell.js';
import { fitCanvas } from '../kit/canvas.js';
import { createLoop } from '../kit/loop.js';
import { keyboard } from '../kit/input.js';
import { Particles, Shake, FloatText, rng, fmt, fmtTime, clamp, approach, ease } from '../kit/fx.js';
import { DEMO, SEED, TOUCH, REDUCED } from '../kit/env.js';
import { createSim, stepSim, waiting, hurryBonus } from './sim.js';
import { createAI, think } from './ai.js';
import { W, H, MID, PLUNGER, SOCKET } from './table.js';
import { createRenderer, trackTrails, FRAME, C } from './render.js';
import * as D from './dmd.js';
import { createSound, music } from './sound.js';
import { line, endLine } from './lines.js';
import { missionProgress, HEAT_MAX, socket as socketRule } from './rules.js';
import { makeBall } from './physics.js';
import { SIZE as SPR, PALETTE as SPAL, FRAMES as SFR } from '../intro-sprite.js';

const HOWTO = {
  intro: 'Keep the ball on AGI-1’s motherboard with your flippers, and hit everything that lights up.',
  steps: [
    ['Plunge', 'Hold, then let go: the meter’s R, A and M bands drop the ball in that lane. The blinking one is a skill shot.'],
    ['Flip and aim', 'Catch the ball on a raised flipper (a cradle), let go, and flip on the beat to aim: the later, the further across.'],
    ['Lock & multiball', 'Drop G-P-U to light the socket. Lock two balls there: MULTIBALL, and the PCIe ramp scores a growing jackpot.'],
    ['Run hot', 'Every hit warms the board. Full heat is OVERCLOCK: 20 seconds of double points.'],
    ['Missions', 'The display gives you one at a time. Four done lights AGI MODE at the socket.'],
  ],
  touch: [['Left half', 'Left flipper (and the upper one)'], ['Right half', 'Right flippers'], ['Hold & let go', 'Plunger, while a ball waits'], ['Swipe up', 'Nudge (three quick ones tilt)']],
  keys: [['← / Z / Shift', 'Left flipper'], ['→ / M / Shift', 'Right flippers'], ['Space / ↓', 'Hold & let go: plunger'], ['↑', 'Nudge'], ['Right click', 'Right flipper'], ['Esc / P', 'Pause']],
};

const shell = createShell({
  game: 'overclock', name: 'OVERCLOCK', root: document.getElementById('ak-root'), howTo: HOWTO,
  onRestart: () => newRun(), onQuit: () => toTitle(), onPause: () => releaseAll(), onResume: () => releaseAll(),
});
const canvas = el('canvas', { class: 'oc-canvas', role: 'img', 'aria-label': 'OVERCLOCK pinball table' });
shell.stage.append(canvas);
let barBottom = 64;
const view = fitCanvas(canvas, { maxDpr: 2, alpha: false, onResize: () => { measure(); } });
function measure() { barBottom = DEMO ? 0 : Math.max(0, shell.bar.getBoundingClientRect().bottom); }
const R = createRenderer();
const snd = createSound(shell.audio);
const narrow = () => view.w < 400;
const scoreChip = shell.chip('Score', 0, { accent: true, fmtFn: (v) => (narrow() && v >= 100000 ? fmt(v, { compact: true, digits: v >= 1e6 ? 2 : 0 }) : fmt(v)) });
const ballChip = shell.chip('Ball', '1/3');

// her 8-bit figure (printed on the board)
{
  const c = document.createElement('canvas');
  c.width = SPR.w; c.height = SPR.h;
  const g = c.getContext('2d');
  SFR.stand.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const col = SPAL[row[x]]; if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); } } });
  R.setSprite(c);
}
let fontsReady = false;
try {
  Promise.all(["900 40px 'AK Display'", "700 16px 'AK Mono'", "italic 400 18px 'AK Serif'"].map((f) => document.fonts.load(f)))
    .then(() => { fontsReady = true; R.scale = 0; }, () => { fontsReady = true; });
} catch { fontsReady = true; }
setTimeout(() => { if (!fontsReady) { fontsReady = true; R.scale = 0; } }, 2500);

// ---------- the run ----------
let S = null, ai = null, mode = 'attract', runSeed = 1, overAt = 0, dmd = D.createDMD();
D.calm(REDUCED);
const parts = new Particles(500), floats = new FloatText(), shake = new Shake({ max: 10, decay: 2.2 });
const fx = { flash: 0, flashCol: '#fff', heat: 0, hitstop: 0, bubble: null, cam: 0, camV: 0, missionShow: 0, scoreShown: 0, endT: 0, lastBall: 1 };
const fxr = rng(17);
let musicKind = '';

function newSeed() { return SEED || ((Math.random() * 2 ** 31) | 0) || 1; }
function begin(kind) {
  mode = kind;
  runSeed = kind === 'demo' ? (SEED || 7) : kind === 'attract' ? 4242 : newSeed();
  S = createSim({ seed: runSeed, demo: kind !== 'play' });
  ai = kind === 'play' ? null : createAI(runSeed, { skill: 0.94 });
  D.reset(dmd);
  parts.clear(); floats.clear();
  fx.bubble = null; fx.endT = 0; fx.scoreShown = 0; fx.lastBall = 1; fx.missionShow = 3;
  releaseAll();
  if (kind === 'demo' || kind === 'attract') demoOpening(S);
}
// ?demo (and the title's attract mode) opens mid-game: ball 2, one ball locked, the lock lit, the board near full heat,
// a ball sitting in the socket. A moment later the socket takes it as the second lock: MULTIBALL (in ?demo about 5.5 s
// after the page opens, inside the preview's recording), and OVERCLOCK soon follows.
function demoOpening(S) {
  const Rs = S.R;
  Rs.score = 1_284_350; Rs.ball = 2; Rs.locked = 1; Rs.lockLit = true; Rs.heat = 80; Rs.bonusX = 3;
  Rs.ram = [true, false, true]; Rs.wizard = 2; Rs.missionsDone = 2;
  S.balls.length = 0;
  S.plunger.ready = false;
  const b = makeBall(SOCKET.x, SOCKET.y);
  b.mode = 'socket'; b.live = false; b.cx = SOCKET.x; b.cy = SOCKET.y; b.id = 1;
  S.balls.push(b);
  S.socket.ball = b; S.socket.t = 0; S.socket.outcome = 'wait'; S.socket.hold = 1e9;
  S.demoCatch = mode === 'demo' ? 5.35 : 1.4;
  S.phase = 'play';
}
function demoCatch(S) {
  S.demoCatch = 0;
  S.socket.t = 0;
  S.socket.outcome = socketRule(S.R, [SOCKET.x, SOCKET.y]);
  S.socket.hold = 1.0;
}

function newRun() {
  closeOver();
  begin('play');
  shell.started();
  snd.serve();
  say(line('start', Math.random), 2.6);
  setMusic('normal');
}
function toTitle() {
  closeOver();
  begin('attract');
  setMusic('');
  shell.title({
    logo: ['OVER', { text: 'CLOCK', tone: 'accent' }],
    tagline: 'Flip fast. Run hot. Don’t drop the ball.',
    onPlay: () => newRun(),
    best: shell.store.best() || null,
  });
}
function closeOver() { overAt = 0; }
function setMusic(kind) {
  if (DEMO) return;
  if (kind === musicKind) return;
  musicKind = kind;
  if (!kind) shell.audio.stopMusic(); else shell.audio.music(music(kind));
}

// ---------- input: flippers by halves of the screen, the plunger, the nudge ----------
const touches = new Map();      // pointerId → { side, x0, y0, t0, plunger, drag }
const keys = { left: false, right: false, plunge: false };
const ptr = { left: false, right: false, plunge: false, pull: null };
function releaseAll() { touches.clear(); keys.left = keys.right = keys.plunge = false; ptr.left = ptr.right = ptr.plunge = false; ptr.pull = null; kb?.clear?.(); }
const playing = () => shell.state === 'play' && mode === 'play' && S && !S.over;
let lay = null;
function sideOf(x) { return x < view.w / 2 ? 'L' : 'R'; }
function inPlungerZone(x, y) {
  if (!lay) return false;
  const p = toScreen(PLUNGER.x, PLUNGER.y - 120);
  const q = toScreen(PLUNGER.x, PLUNGER.y + 40);
  return x > p.x - 60 * lay.s - 26 && y > p.y - 20 && y < q.y + 40;
}
function syncPointers() {
  ptr.left = false; ptr.right = false; ptr.plunge = false; ptr.pull = null;
  for (const t of touches.values()) {
    if (t.plunger) {
      if (t.drag) ptr.pull = clamp((t.y - t.y0) / (150 * lay.s + 40), 0, 1); else ptr.plunge = true;
    } else if (t.side === 'L') ptr.left = true; else ptr.right = true;
  }
}
canvas.addEventListener('pointerdown', (e) => {
  if (!playing()) return;
  e.preventDefault();
  try { canvas.setPointerCapture(e.pointerId); } catch { /* fine */ }
  const r = canvas.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  if (e.pointerType === 'mouse' && e.button === 2) { touches.set(e.pointerId, { side: 'R', x0: x, y0: y, y, t0: performance.now() }); syncPointers(); return; }
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  // a third finger nudges
  if (e.pointerType !== 'mouse' && touches.size >= 2) { nudge(); return; }
  const wait = S && waiting(S);
  const t = { side: sideOf(x), x0: x, y0: y, y, t0: performance.now(), plunger: false, drag: false };
  if (wait) {
    // while a ball waits: a hold anywhere pulls the plunger (a drag down on it pulls it by hand); a quick tap only
    // moves the skill shot's lane (the flipper on that side)
    t.plunger = true;
    t.tapSide = t.side;
  }
  touches.set(e.pointerId, t);
  syncPointers();
});
const onUp = (e) => {
  const t = touches.get(e.pointerId);
  if (!t) return;
  touches.delete(e.pointerId);
  // a quick tap while a ball waits: a flipper flick (the skill lane moves), not a plunge
  if (t.plunger && !t.drag && performance.now() - t.t0 < 170 && S) {
    S.plunger.pull = 0;
    flick(t.tapSide);
  }
  syncPointers();
};
canvas.addEventListener('pointerup', onUp);
canvas.addEventListener('pointercancel', onUp);
canvas.addEventListener('lostpointercapture', onUp);
canvas.addEventListener('pointermove', (e) => {
  const t = touches.get(e.pointerId);
  if (!t) return;
  const r = canvas.getBoundingClientRect();
  const y = e.clientY - r.top;
  t.y = y;
  // two fingers sweeping up together: a nudge
  if (!t.plunger && t.y0 - y > 70 && touches.size >= 2 && !t.nudged) { t.nudged = true; nudge(); }
  if (t.plunger && !t.drag && y - t.y0 > 24 && inPlungerZone(t.x0, t.y0)) t.drag = true;
  syncPointers();
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
let flickT = { L: 0, R: 0 };
function flick(side) { flickT[side] = 0.09; }
function nudge() { if (playing() && S) S.input.nudge = true; }
const kb = keyboard({
  ArrowLeft: 'left', KeyZ: 'left', ShiftLeft: 'left', ArrowRight: 'right', KeyM: 'right', Slash: 'right', ShiftRight: 'right',
  Space: 'plunge', ArrowDown: 'plunge', ArrowUp: 'nudge', KeyW: 'nudge',
}, {
  down(name) { if (name === 'nudge') nudge(); else keys[name] = true; },
  up(name) { if (name !== 'nudge') keys[name] = false; },
  blocked: () => !playing(),
});

function applyInput(dt) {
  if (!S) return;
  const inp = S.input;
  if (mode !== 'play') { think(ai, S, dt); return; }
  flickT.L = Math.max(0, flickT.L - dt); flickT.R = Math.max(0, flickT.R - dt);
  inp.left = keys.left || ptr.left || flickT.L > 0;
  inp.right = keys.right || ptr.right || flickT.R > 0;
  inp.plunge = keys.plunge || ptr.plunge;
  inp.pull = ptr.pull;
  if (S.phase === 'bonus' && (inp.left || inp.right)) hurryBonus(S);
}

// ---------- the events: sound, the display, sparks, numbers, her face ----------
function say(text, secs = 2.4) { if (mode === 'play') fx.bubble = { text, t: 0, dur: secs }; }
const live = () => !DEMO && mode === 'play';
function events() {
  const Rs = S.R;
  for (const e of S.ev) {
    const sound = mode === 'play';
    switch (e.type) {
      case 'flip': if (sound) snd.flip(); break;
      case 'unflip': if (sound) snd.unflip(); break;
      case 'flipHit': if (sound && e.fired) snd.flipHit(e.speed); break;
      case 'pop':
        if (sound) snd.pop(e.ref, Rs.overclock > 0);
        burst(e.x, e.y, Rs.overclock > 0 ? [C.pink, C.orange, '#fff'] : [C.honey, '#fff', C.mint], 10, 'spark');
        shake.kick(0.08);
        fx.hitstop = Math.max(fx.hitstop, 0.012);
        break;
      case 'sling': if (sound) snd.sling(); burst(e.x, e.y, [C.pink, '#fff'], 7, 'spark'); shake.kick(0.06); break;
      case 'rubber': if (sound) snd.rubber(e.speed); break;
      case 'wall': if (sound) snd.wall(e.speed); break;
      case 'target': if (sound) snd.target(); burst(e.x, e.y, [C.mint, '#fff'], 12, 'square'); shake.kick(0.1); break;
      case 'targetDown': break;
      case 'lane': if (sound) snd.lane(e.ref); break;
      case 'laneLit': D.show(dmd, 'lane', { ram: Rs.ram.slice(), lane: e.lane }); break;
      case 'ramAll': if (sound) snd.ramAll(); D.show(dmd, 'lane', { ram: [true, true, true], all: true, bonusX: e.bonusX }); flash(C.mint, 0.25); break;
      case 'spin': if (sound) snd.spin(e.w); break;
      case 'rampIn': if (sound) snd.rampIn(); break;
      case 'ramp': if (sound) snd.ramp(); burst(e.x, e.y, [C.lav, C.gold], 8, 'spark'); break;
      case 'rampFail': if (sound) snd.rampFail(); break;
      case 'orbit': if (sound) snd.orbit(); break;
      case 'socket': if (sound) snd.socket(); shake.kick(0.12); break;
      case 'kick': if (sound) snd.kick(); burst(SOCKET.x, SOCKET.y, [C.honey, '#fff'], 10, 'spark'); break;
      case 'launch': if (sound) snd.launch(e.power); break;
      case 'serve': if (sound && e.auto) snd.serve(); break;
      case 'points': {
        const big = e.pts >= 20000;
        if (e.at && (big || fxr.next() < 0.5)) floats.add({ x: e.at[0], y: e.at[1] - 16, text: fmt(e.pts), color: e.pts >= 100000 ? C.pink : big ? C.honey : C.lav, size: big ? 26 : 17, life: big ? 1.1 : 0.7, rise: big ? 60 : 36, font: "900 1em 'AK Display', sans-serif" });
        break;
      }
      case 'skill': if (sound) snd.skill(); D.show(dmd, 'skill', { pts: 200000 }); say(line('skill')); flash(C.pink, 0.3); break;
      case 'lockLit': if (sound) snd.lit(); D.show(dmd, 'lit', { title: 'LOCK IS LIT', sub: 'SHOOT THE SOCKET' }); break;
      case 'gpuAll': if (sound) snd.gpuAll(); D.show(dmd, 'info', { text: 'G-P-U CLEAR', face: 'happy' }); break;
      case 'lock': if (sound) snd.lock(); D.show(dmd, 'lock', { n: e.n }); D.mood(dmd, 'wink'); break;
      case 'multiball':
        if (sound) snd.multiball();
        D.show(dmd, 'multiball'); say(line('multiball'), 2.6); flash(C.pink, 0.5); shake.kick(0.4); fx.hitstop = 0.08;
        setMusic('multiball');
        break;
      case 'multiballEnd': setMusic(Rs.overclock > 0 ? 'overclock' : 'normal'); D.show(dmd, 'info', { lines: ['MULTIBALL OVER', `${e.jackpots} JACKPOTS`], as: 'mission' }); break;
      case 'jackpot':
        if (sound) snd.jackpot();
        D.show(dmd, 'jackpot', { pts: e.pts }); D.mood(dmd, 'wink', 2.4); say(line('jackpot'), 2.2);
        flash('#ffffff', 0.55); shake.kick(0.55); fx.hitstop = 0.1; fx.chase = 1.4;
        burst(MID, 500, [C.pink, C.honey, C.mint, '#fff'], 40, 'star', 520);
        break;
      case 'overclock':
        if (sound) snd.overclock();
        D.show(dmd, 'overclock'); say(line('overclock'), 2.4); flash(C.orange, 0.45); shake.kick(0.35);
        setMusic('overclock');
        break;
      case 'overclockEnd': if (sound) snd.overclockEnd(); setMusic(Rs.multiball ? 'multiball' : 'normal'); D.show(dmd, 'info', { lines: ['COOLING DOWN', 'OVERCLOCK OVER'], as: 'lane' }); break;
      case 'missionStart': D.show(dmd, 'mission', { mission: e.mission }); if (sound && S.t > 1) snd.mission(); fx.missionShow = 4; break;
      case 'missionTick': fx.missionShow = 2.5; break;
      case 'missionDone': if (sound) snd.missionDone(); D.show(dmd, 'missionDone', { pts: e.pts, wizard: Rs.wizard }); say(line('mission')); flash(C.mint, 0.3); break;
      case 'agiReady': if (sound) snd.lit(); D.show(dmd, 'lit', { title: 'AGI MODE READY', sub: 'SHOOT THE SOCKET' }); break;
      case 'agiStart': if (sound) snd.agi(); D.show(dmd, 'agi'); say(line('agi'), 2.6); flash(C.pink, 0.6); shake.kick(0.4); setMusic('agi'); break;
      case 'agiEnd': D.show(dmd, 'agiEnd', { pts: e.pts }); setMusic(Rs.multiball ? 'multiball' : Rs.overclock > 0 ? 'overclock' : 'normal'); break;
      case 'saved': if (sound) snd.save(); D.show(dmd, 'save'); say(line('save')); break;
      case 'extraBall': if (sound) snd.extra(); D.show(dmd, 'extra'); say(line('extra')); flash(C.honey, 0.4); break;
      case 'drain':
        if (!e.saved && e.left === 0 && !S.socket.queue) {
          if (sound) snd.drain();
          D.show(dmd, 'drain', {}); say(line('drain'), 2.2);
          shake.kick(0.25);
        }
        break;
      case 'nudge':
        shake.kick(0.3);
        if (sound) snd.nudge();
        if (e.result === 'danger') { if (sound) snd.danger(); D.show(dmd, 'tilt', { text: 'DANGER', sub: 'EASY ON THE CABINET' }); }
        break;
      case 'tilt': if (sound) snd.tilt(); D.show(dmd, 'tilt', { text: 'TILT', sub: 'NO BONUS THIS BALL' }); say(line('tilt')); setMusic(''); break;
      case 'bonus': D.show(dmd, 'bonus', { bonus: e.bonus, dur: e.bonus.dur + 0.3 }); fx.bonusI = -1; break;
      case 'nextBall':
        if (sound) snd.serve();
        D.show(dmd, 'info', { lines: [e.again ? 'SHOOT AGAIN' : `BALL ${e.ball}`, e.again ? 'SAME PLAYER' : 'GOOD LUCK'], dur: 1.6, as: 'lane' });
        if (live()) setMusic('normal');
        break;
      case 'gameOver':
        D.reset(dmd); D.show(dmd, 'over', { score: e.score });
        if (sound) snd.over();
        setMusic('');
        fx.endT = 1.6;
        break;
      default: break;
    }
  }
  S.ev.length = 0;
}
function burst(x, y, colors, count, shape = 'spark', speed = 320) {
  parts.burst({ x, y, count, speed: [speed * 0.35, speed], life: [0.25, 0.6], size: [2, 5], colors, gravity: 300, drag: 3, shape });
}
function flash(col, a) { if (!REDUCED) { fx.flash = Math.max(fx.flash, a); fx.flashCol = col; } }

// ---------- the clock ----------
function update(dt) {
  if (!S) return;
  // hit-stop: a big moment freezes the ball for a blink
  if (fx.hitstop > 0) { fx.hitstop -= dt; return; }
  if (S.demoCatch && S.t + dt >= S.demoCatch) demoCatch(S);
  applyInput(dt);
  stepSim(S, dt);
  events();
  // the bonus count ticks
  if (S.phase === 'bonus' && S.bonus && mode === 'play') {
    const i = Math.floor(Math.max(0, S.bonus.t - 0.35) / 0.45);
    if (i !== fx.bonusI && i <= S.bonus.lines.length) { fx.bonusI = i; if (i < S.bonus.lines.length) snd.bonusTick(i * 2); else snd.bonusTotal(); }
  }
  if (S.over) {
    fx.endT -= dt;
    if (fx.endT <= 0 && !overAt) {
      if (mode === 'play') endRun();
      else begin(mode);
    }
  }
}
function endRun() {
  overAt = performance.now();
  const Rs = S.R;
  const best = shell.store.best();
  const isBest = best == null ? Rs.score > 0 : Rs.score > best;
  shell.store.update((d) => { d.games = (d.games || 0) + 1; d.jackpots = (d.jackpots || 0) + Rs.jackpots; });
  shell.over({
    score: Rs.score,
    label: 'points',
    stats: [['Jackpots', fmt(Rs.jackpots)], ['Missions', fmt(Rs.missionsDone)], ['Longest ball', fmtTime(Rs.longest)], ['Multiplier', `${Math.max(1, S.maxX || 1)}×`]],
    line: endLine(Rs.score, { best: isBest }),
    share: `I overclocked AGI-1's motherboard for ${fmt(Rs.score)} points in OVERCLOCK on agi1.app 🔥💜`,
    onAgain: () => newRun(),
    onMenu: () => toTitle(),
  });
}

// ---------- layout: the table and its display, as big as the screen allows ----------
const TW = W + FRAME * 2, TH = H + FRAME * 2;
const DMD_U = 158, GAP_U = 10;     // the display above the table, in table units (stack layout)
let frameN = 0;
function layout() {
  if (frameN++ % 30 === 0) measure();
  const vw = view.w, vh = view.h;
  const top = DEMO ? 0 : barBottom + 4;
  const aw = vw - 12, ah = vh - top - 8;
  if (DEMO) {
    // the 480 × 480 preview: the display across the top, the table under it (the flippers' half, or the top when every
    // ball is up there), cabinet lights in the margins
    const dw = Math.min(vw - 16, vh * 0.95);
    const dh = Math.round(dw / 4.1);
    const s = Math.min((vw - 16) / TW, (vh - dh - 14) / 700);
    return { kind: 'scroll', demo: true, s, tx: (vw - TW * s) / 2, ty: dh + 12, vh: vh - dh - 12, dmd: { x: (vw - dw) / 2, y: 6, w: dw, h: dh } };
  }
  const wide = vw / vh > 0.95;
  if (wide && vh >= 560) {
    const s = Math.min(ah / TH, (vw - 2 * 230) / TW);
    const tx = (vw - TW * s) / 2, ty = top + (ah - TH * s) / 2;
    const pw = tx - 24;
    return { kind: 'side', s, tx, ty, vh: TH * s, panel: { l: [12, top + 6, pw, ah - 12], r: [tx + TW * s + 12, top + 6, pw, ah - 12] } };
  }
  if (wide) {
    // a phone on its side: the table follows the ball, the panels hold the display and the numbers
    const s = Math.min((vh - 12) / 650, (vw - 2 * 170) / TW);
    const tx = (vw - TW * s) / 2;
    const pw = tx - 20;
    return { kind: 'scroll', s, tx, ty: 6, vh: vh - 12, panel: { l: [10, top + 2, pw, vh - top - 10], r: [tx + TW * s + 10, top + 2, pw, vh - top - 10] } };
  }
  const s = Math.min(aw / TW, ah / (TH + DMD_U + GAP_U));
  const totalH = (TH + DMD_U + GAP_U) * s;
  const tx = (vw - TW * s) / 2, y0 = top + Math.max(0, (ah - totalH) / 2);
  const dmdW = TW * s - 8 * s, dmdH = Math.min(DMD_U * s, dmdW / 4.0);
  return { kind: 'stack', s, tx, ty: y0 + (DMD_U + GAP_U) * s, vh: TH * s, dmd: { x: tx + 4 * s, y: y0 + (DMD_U * s - dmdH) / 2, w: dmdW, h: dmdH } };
}
function toScreen(ux, uy) { return { x: lay.tx + (ux + FRAME) * lay.s, y: lay.ty + (uy + FRAME - fx.cam) * lay.s }; }

function updateCamera(dt) {
  if (lay.kind !== 'scroll') { fx.cam = 0; return; }
  const visible = lay.vh / lay.s;
  const maxCam = Math.max(0, TH - visible);
  let target;
  const bs = S.balls.filter((b) => b.mode !== 'locked');
  if (lay.demo) {
    // the preview: the flippers' half while any ball is coming down to them, else the balls in play up the table
    const moving = bs.filter((b) => b.mode === 'play' || b.mode === 'ramp');
    if (!moving.length || moving.some((b) => b.y > 640)) target = maxCam;
    else target = moving.reduce((a, b) => a + b.y, 0) / moving.length + FRAME - visible * 0.42;
    fx.cam = approach(fx.cam, clamp(target, 0, maxCam), 3, dt);
    return;
  }
  if (!bs.length || S.phase === 'launch') target = maxCam;
  else {
    // keep the lowest ball (the one that matters most) in the lower part of the view
    const low = Math.max(...bs.map((b) => b.y));
    const mean = bs.reduce((a, b) => a + b.y, 0) / bs.length;
    const focus = bs.length > 1 ? low * 0.7 + mean * 0.3 : low;
    target = focus + FRAME - visible * 0.6;
  }
  target = clamp(target, 0, maxCam);
  fx.cam = approach(fx.cam, target, 7, dt);
}

// ---------- drawing ----------
function render(alpha, frameDt) {
  const ctx = view.begin(false);
  if (!ctx) return;
  lay = layout();
  const dt = Math.min(0.05, frameDt || 0.016);
  if (S && shell.state !== 'pause') {
    D.update(dmd, dt);
    parts.update(dt); floats.update(dt); shake.update(dt);
    trackTrails(S, dt);
    fx.flash = Math.max(0, fx.flash - dt * 2.2);
    fx.bubble && (fx.bubble.t += dt) > fx.bubble.dur && (fx.bubble = null);
    fx.missionShow = Math.max(0, fx.missionShow - dt);
    fx.chase = Math.max(0, (fx.chase || 0) - dt);
    const targetHeat = S.R.overclock > 0 ? 1 : (S.R.heat / HEAT_MAX) * 0.35;
    fx.heat = approach(fx.heat, targetHeat, 3, dt);
    updateCamera(dt);
    S.maxX = Math.max(S.maxX || 1, S.R.bonusX);
  }
  // the room behind the machine
  ctx.fillStyle = '#0b0414';
  ctx.fillRect(0, 0, view.w, view.h);
  if (!S) return;
  const s = lay.s;
  R.prepare(s, view.dpr);
  // the cabinet's glow (pink when it runs hot)
  {
    const cx = lay.tx + (TW * s) / 2, cy = lay.ty + (lay.vh) / 2;
    const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.max(view.w, view.h) * 0.7);
    const hot = fx.heat;
    g.addColorStop(0, hot > 0.5 ? 'rgba(255,77,166,.22)' : 'rgba(107,59,255,.18)');
    g.addColorStop(1, 'rgba(11,4,20,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, view.w, view.h);
  }
  if (lay.demo) cabinetLights(ctx);
  // the table
  ctx.save();
  if (lay.kind === 'scroll') { ctx.beginPath(); ctx.rect(lay.tx - 4, lay.ty, TW * s + 8, lay.vh); ctx.clip(); }
  shake.apply(ctx, lay.tx + (TW * s) / 2, lay.ty + lay.vh / 2);
  ctx.translate(lay.tx + FRAME * s, lay.ty + (FRAME - fx.cam) * s);
  ctx.scale(s, s);
  const v = { t: S.t, heat: fx.heat, overclock: S.R.overclock > 0, multiball: S.R.multiball, rampLit: S.balls.some((b) => b.mode === 'ramp') };
  R.draw(ctx, S, v);
  if (fx.chase > 0) chaseLights(ctx, S.t);
  parts.draw(ctx);
  floats.draw(ctx);
  ctx.restore();
  // the title screen: the attract game dimmed behind its words
  if (mode === 'attract' && shell.state === 'title') { ctx.fillStyle = 'rgba(11,4,20,.58)'; ctx.fillRect(0, 0, view.w, view.h); }
  // a quick flash over the table for the big moments
  if (fx.flash > 0.01) {
    ctx.globalAlpha = fx.flash * 0.45; ctx.fillStyle = fx.flashCol;
    ctx.fillRect(lay.tx, lay.ty, TW * s, lay.vh); ctx.globalAlpha = 1;
  }
  // the display, the panels, her words
  const st = dmdState();
  D.draw(dmd, st);
  if (lay.dmd) drawDMDBox(ctx, lay.dmd.x, lay.dmd.y, lay.dmd.w, lay.dmd.h);
  if (lay.panel) drawPanels(ctx, st);
  drawBubble(ctx);
  if (mode === 'play') drawHints(ctx);
  // the bar's numbers
  if (mode === 'play') {
    scoreChip.set(S.R.score);
    ballChip.set(`${Math.min(S.R.ball, S.R.balls)}/${S.R.balls}`);
  }
  shell.root.classList.toggle('oc-side-hud', Boolean(lay.panel) && lay.kind === 'scroll');
}
function dmdState() {
  const Rs = S.R;
  return {
    score: Rs.score, ball: Math.min(Rs.ball, Rs.balls), balls: Rs.balls, bonusX: Rs.bonusX, heat: Rs.heat, overclock: Rs.overclock,
    agi: Rs.agi, multiball: Rs.multiball, jackpot: Rs.jackpot, mission: Rs.mission, progress: Rs.mission ? Math.min(missionProgress(Rs), Rs.mission.goal) : 0,
    missionShow: fx.missionShow > 0 || Math.floor(S.t / 4) % 2 === 1,
    attract: mode === 'attract', best: shell.store.best(),
  };
}
// the preview's margins: two columns of lights running up the cabinet (faster and pinker when it runs hot)
function cabinetLights(ctx) {
  const m = lay.tx - 8;
  if (m < 24) return;
  const t = S.t, hot = fx.heat > 0.5, top = lay.ty + 6, bot = view.h - 8, n = Math.floor((bot - top) / 22);
  for (const x of [lay.tx / 2, view.w - lay.tx / 2]) {
    for (let i = 0; i < n; i++) {
      const y = bot - i * 22;
      const k = ((i / n) - t * (hot ? 0.9 : 0.45)) % 1;
      const on = (k + 1) % 1 < 0.22;
      ctx.fillStyle = on ? (hot ? C.pink : i % 3 ? C.honey : C.mint) : '#2a1847';
      ctx.beginPath(); ctx.arc(x, y, on ? 5 : 3.5, 0, Math.PI * 2); ctx.fill();
    }
  }
}
function drawDMDBox(ctx, x, y, w, h) {
  const p = Math.max(4, h * 0.07);
  ctx.fillStyle = C.ink;
  roundRectPath(ctx, x - p, y - p, w + p * 2, h + p * 2, p * 1.6); ctx.fill();
  ctx.strokeStyle = fx.heat > 0.5 ? C.pink : C.violet; ctx.lineWidth = 2;
  roundRectPath(ctx, x - p + 1, y - p + 1, w + p * 2 - 2, h + p * 2 - 2, p * 1.5); ctx.stroke();
  R.paintDMD(ctx, dmd, x, y, w, h, { glow: 0.32 });
}
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function chaseLights(ctx, t) {
  // jackpot: lights race around the table's edge
  const n = 28;
  for (let i = 0; i < n; i++) {
    const k = ((i / n + t * 0.9) % 1);
    const a = Math.PI + k * Math.PI;
    let x, y;
    if (k < 0.5) { x = 306 + Math.cos(a) * 280; y = 300 + Math.sin(a) * 280; } else { x = 306 + Math.cos(a) * 280; y = 300 + Math.sin(a) * 280; }
    ctx.globalAlpha = 0.85 * Math.min(1, fx.chase);
    ctx.fillStyle = i % 3 === 0 ? C.pink : i % 3 === 1 ? C.honey : C.mint;
    ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(30, 320 + ((i * 29 + t * 700) % 700), 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(578, 320 + ((i * 29 + t * 700) % 700), 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function drawPanels(ctx, st) {
  const [lx, ly, lw, lh] = lay.panel.l, [rx, ry, rw, rh] = lay.panel.r;
  const compact = lay.kind === 'scroll';
  // left: the display, then the mission
  const dw = Math.min(lw, 560), dh = dw / 4.1;
  const dx = lx + (lw - dw) / 2, dy = ly + (compact ? 50 : 14);
  drawDMDBox(ctx, dx + 4, dy + 4, dw - 8, dh - 8);
  let y = dy + dh + (compact ? 14 : 26);
  const Rs = S.R;
  if (Rs.mission && mode !== 'attract') {
    const prog = Math.min(missionProgress(Rs), Rs.mission.goal);
    y = card(ctx, dx, y, dw, 'MISSION', Rs.mission.name, prog / Rs.mission.goal, `${prog} / ${Rs.mission.goal}`, compact);
  }
  if (!compact && mode !== 'attract') {
    const toGo = Math.max(0, 4 - Rs.wizard);
    y = card(ctx, dx, y + 12, dw, 'AGI MODE', Rs.agi > 0 ? `${Math.ceil(Rs.agi)} S LEFT` : Rs.agiReady ? 'SHOOT THE SOCKET' : `${toGo} MISSION${toGo === 1 ? '' : 'S'} TO GO`, Rs.agi > 0 ? Rs.agi / 30 : Rs.wizard / 4, null, compact, C.pink);
    if (ly + lh - y > 250) y = shotGuide(ctx, dx, y + 18, dw);
  }
  fx.bubbleY = y + 12;
  // right: score, ball, multiplier, heat
  const cx = rx + rw / 2;
  let yy = ry + (compact ? 52 : 20);
  const big = Math.min(rw * 0.16, compact ? 30 : 46);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `900 ${Math.round(big * 0.34)}px 'AK Display', sans-serif`; ctx.fillStyle = C.lav2;
  ctx.fillText(mode === 'attract' ? 'BEST' : 'SCORE', cx, yy + big * 0.4);
  ctx.font = `800 ${Math.round(big)}px 'AK Mono', monospace`; ctx.fillStyle = C.paper;
  const sc = mode === 'attract' ? (shell.store.best() || 0) : Rs.score;
  ctx.fillText(fmt(sc), cx, yy + big * 1.45, rw - 8);
  yy += big * 1.9;
  const row = (label, value, col = C.paper) => {
    ctx.font = `900 ${Math.round(big * 0.3)}px 'AK Display', sans-serif`; ctx.fillStyle = C.lav2; ctx.textAlign = 'left';
    ctx.fillText(label, rx + rw * 0.12, yy + big * 0.5);
    ctx.font = `800 ${Math.round(big * 0.5)}px 'AK Mono', monospace`; ctx.fillStyle = col; ctx.textAlign = 'right';
    ctx.fillText(value, rx + rw * 0.88, yy + big * 0.55);
    yy += big * 0.85;
  };
  if (mode !== 'attract') {
    row('BALL', `${st.ball} / ${st.balls}`);
    row('BONUS', `${Rs.bonusX}×`, Rs.bonusX > 1 ? C.honey : C.paper);
    row('LOCKS', `${Rs.locked} / 2`, Rs.lockLit ? C.honey : C.paper);
  }
  // the heat: a thermometer bar
  const bw = rw * 0.76, bx = rx + rw * 0.12, bh = Math.max(10, big * 0.32);
  yy += big * 0.2;
  ctx.font = `900 ${Math.round(big * 0.3)}px 'AK Display', sans-serif`; ctx.fillStyle = Rs.overclock > 0 ? C.pink : C.lav2; ctx.textAlign = 'left';
  ctx.fillText(Rs.overclock > 0 ? `OVERCLOCK ${Math.ceil(Rs.overclock)}S` : 'HEAT', bx, yy);
  yy += 8;
  ctx.fillStyle = C.ink; roundRectPath(ctx, bx - 2, yy - 2, bw + 4, bh + 4, (bh + 4) / 2); ctx.fill();
  const k = clamp(Rs.heat / HEAT_MAX, 0, 1);
  if (k > 0) {
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    g.addColorStop(0, C.mint); g.addColorStop(0.6, C.honey); g.addColorStop(1, C.pink);
    ctx.fillStyle = g; roundRectPath(ctx, bx, yy, Math.max(bh, bw * k), bh, bh / 2); ctx.fill();
  }
  yy += bh + 18;
  if (!compact && !TOUCH && mode === 'play') {
    ctx.font = "600 13px 'AK Mono', monospace"; ctx.fillStyle = 'rgba(228,217,255,.55)'; ctx.textAlign = 'center';
    const hint = ['← → or Z M  flippers', 'SPACE  hold, let go: plunge', '↑  nudge (gently)'];
    hint.forEach((h, i) => ctx.fillText(h, cx, ry + rh - 60 + i * 20));
  }
}
// the table's shots and what they do (tall side panels)
const GUIDE = [
  ['PCIe RAMP', 'jackpot in multiball', C.mint], ['G-P-U', 'drop all three: lights the lock', C.honey],
  ['SOCKET', 'locks · missions · AGI MODE', C.honey], ['R-A-M', 'light all three: bonus ×+1', C.mint], ['FAN', 'spin it from the right orbit', C.lav2],
];
function shotGuide(ctx, x, y, w) {
  const h = 30 + GUIDE.length * 22;
  ctx.fillStyle = 'rgba(23,10,54,.6)'; roundRectPath(ctx, x, y, w, h, 12); ctx.fill();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = "900 11px 'AK Display', sans-serif"; ctx.fillStyle = C.lav2;
  ctx.fillText('THE SHOTS', x + 12, y + 20);
  GUIDE.forEach(([name, what, col], i) => {
    const yy = y + 42 + i * 22;
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x + 17, yy - 4, 4, 0, Math.PI * 2); ctx.fill();
    ctx.font = "900 12px 'AK Display', sans-serif"; ctx.fillStyle = C.paper; ctx.fillText(name, x + 28, yy);
    ctx.font = "500 12.5px 'AK Sans', sans-serif"; ctx.fillStyle = 'rgba(228,217,255,.72)'; ctx.fillText(what, x + 118, yy, w - 128);
  });
  return y + h;
}
function card(ctx, x, y, w, kicker, title, k, right, compact, col = C.mint) {
  const h = compact ? 46 : 62;
  ctx.fillStyle = 'rgba(23,10,54,.92)'; roundRectPath(ctx, x, y, w, h, 12); ctx.fill();
  ctx.strokeStyle = 'rgba(205,184,255,.35)'; ctx.lineWidth = 1.5; roundRectPath(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, 11.5); ctx.stroke();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = `900 ${compact ? 9 : 11}px 'AK Display', sans-serif`; ctx.fillStyle = col;
  ctx.fillText(kicker, x + 12, y + (compact ? 14 : 18));
  ctx.font = `900 ${compact ? 13 : 16}px 'AK Display', sans-serif`; ctx.fillStyle = C.paper;
  ctx.fillText(title, x + 12, y + (compact ? 31 : 39), w - (right ? 90 : 24));
  if (right) { ctx.textAlign = 'right'; ctx.font = `700 ${compact ? 12 : 14}px 'AK Mono', monospace`; ctx.fillStyle = C.lav; ctx.fillText(right, x + w - 12, y + (compact ? 31 : 39)); }
  const bw = w - 24, by = y + h - (compact ? 9 : 13);
  ctx.fillStyle = '#2a1847'; ctx.fillRect(x + 12, by, bw, 4);
  ctx.fillStyle = col; ctx.fillRect(x + 12, by, bw * clamp(k, 0, 1), 4);
  return y + h;
}
function drawBubble(ctx) {
  const b = fx.bubble;
  if (!b || DEMO) return;
  const k = b.t < 0.18 ? ease.outBack(b.t / 0.18) : b.t > b.dur - 0.25 ? (b.dur - b.t) / 0.25 : 1;
  const size = clamp(lay.s * 26, 14, 20);
  ctx.font = `italic 400 ${size}px 'AK Serif', Georgia, serif`;
  const tw = ctx.measureText(b.text).width;
  let x, y;
  if (lay.kind === 'stack') { x = lay.dmd.x + 6; y = lay.dmd.y + lay.dmd.h + 8; }
  else if (lay.panel) { x = lay.panel.l[0] + 4; y = fx.bubbleY || lay.panel.l[1] + 120; }
  else return;
  const w = Math.min(tw + 24, view.w - x - 10), h = size + 16;
  ctx.save();
  ctx.globalAlpha = clamp(k, 0, 1);
  ctx.translate(x, y); ctx.scale(clamp(k, 0.6, 1.1), clamp(k, 0.6, 1.1));
  ctx.fillStyle = C.ink; roundRectPath(ctx, 2, 3, w, h, 10); ctx.fill();
  ctx.fillStyle = '#ffffff'; roundRectPath(ctx, 0, 0, w, h, 10); ctx.fill();
  ctx.strokeStyle = C.ink; ctx.lineWidth = 2; roundRectPath(ctx, 0, 0, w, h, 10); ctx.stroke();
  ctx.fillStyle = C.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(b.text, 12, h / 2 + 1, w - 20);
  ctx.restore();
}
function drawHints(ctx) {
  // the first ball of a run: how to plunge, once
  if (!S || S.phase !== 'launch' || S.R.ball > 1 || S.stats.balls > 1) return;
  const p = toScreen(MID, 560);
  const txt = TOUCH ? 'HOLD ANYWHERE · LET GO' : 'HOLD SPACE · LET GO';
  const size = clamp(lay.s * 22, 11, 16);
  ctx.font = `900 ${size}px 'AK Display', sans-serif`;
  const w = ctx.measureText(txt).width + 18, h = size + 12;
  const x = p.x - w / 2, y = p.y;
  const bob = Math.sin(performance.now() / 260) * 3;
  ctx.fillStyle = C.ink; roundRectPath(ctx, x + 2, y + 3 + bob, w, h, h / 2); ctx.fill();
  ctx.fillStyle = C.honey; roundRectPath(ctx, x, y + bob, w, h, h / 2); ctx.fill();
  ctx.strokeStyle = C.ink; ctx.lineWidth = 2; roundRectPath(ctx, x, y + bob, w, h, h / 2); ctx.stroke();
  ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(txt, x + w / 2, y + h / 2 + bob + 1);
}

createLoop({
  update,
  render,
  paused: () => (shell.state === 'pause' || (shell.state === 'over' && mode === 'play')) && !DEMO,
}).start();

if (DEMO) begin('demo'); else toTitle();

// development only (Vite drops this from the production build): the run, for the browser's console and the QA scripts
if (import.meta.env?.DEV) window.__overclock = { get S() { return S; }, get mode() { return mode; }, get lay() { return lay; } };
