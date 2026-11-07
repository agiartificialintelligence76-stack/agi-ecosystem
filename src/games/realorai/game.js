// REAL OR AI? (2026-11-08, the owner's own idea): one photo at a time, real or AI-made? Swipe the print right for REAL,
// left for AI (or tap the buttons), hold it for a loupe that shows its real pixels, and a rubber stamp gives the answer,
// with the clues circled in grease pencil and AGI-1's own guess beside yours. Two modes: Daily 10 (the same ten photos
// for everyone today) and Streak (three hearts, ten seconds a photo). Built on the arcade kit (src/games/kit/): its
// frame, title, pause and end cards, local bests, sound and the play counter. The rules are rules.js (pure), the
// photos pictures.js, the demo's player demo.js; this file wires them to the page.
import { createShell, el } from '../kit/shell.js';
import { fitCanvas } from '../kit/canvas.js';
import { createLoop } from '../kit/loop.js';
import { pointer, keyboard } from '../kit/input.js';
import { createLoopMusic } from '../kit/audio.js';
import { Particles, Shake, FloatText, rng, fmt } from '../kit/fx.js';
import { DEMO, SEED, REDUCED, TOUCH } from '../kit/env.js';
import { PICTURES } from './pictures.js';
import * as R from './rules.js';
import { LINES, revealLine, endLine } from './lines.js';
import { createBot } from './demo.js';
import * as IMG from './images.js';
import { createRenderer, stampSpot } from './render.js';
import { PRINT, INK, PAPER, MINT, PINK, HONEY, VIOLET } from './art.js';
import { createSounds, labMusic } from './sound.js';
import { createDock, titleLogo, eyePanel, recapStrip, openViewer, ICON } from './ui.js';
import './style.css';             // after the kit's styles (kit.css comes with shell.js), so ours win

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const approach = (a, b, rate, dt) => b + (a - b) * Math.exp(-rate * dt);
const smooth = (t) => t * t * (3 - 2 * t);
const GAP = 14;
const ZOOM = 2.5;
const AUTO = 1.75;              // a right answer moves on by itself after this long (unless held)
const HOLD_MS = 0.2;            // a press that stays still this long is the loupe
const PICS = PICTURES.filter((p) => p && p.file && p.id);

const root = document.getElementById('ak-root');
const shell = createShell({
  game: 'realorai',
  name: 'REAL OR AI?',
  root,
  howTo: {
    intro: 'Every photo here is either a real photo or a picture made by an AI. Your eyes decide which.',
    steps: [
      ['Look closely', 'Press and hold the photo for a loupe. AI hides its mistakes in the details: hands, text, edges, reflections.'],
      ['Swipe or tap', 'Swipe right or tap REAL for a real photo. Swipe left or tap AI for an AI-made picture.'],
      ['Read the stamp', 'The stamp shows the truth, and the clues get circled. Wrong answers wait so you can learn why.'],
      ['Be quick, keep a streak', 'Faster answers score more. 3, 6, 10 and 15 in a row multiply your points.'],
      ['Two ways to play', 'Daily 10: the same ten photos for everyone today. Streak: three hearts, ten seconds a photo.'],
      ['Beat AGI-1', 'She guesses every photo too. Spot more than she does.'],
    ],
    touch: [['Swipe →', 'Real'], ['Swipe ←', 'AI'], ['Hold', 'Loupe (drag to move it)'], ['Tap', 'Next']],
    keys: [['→ or D', 'Real'], ['← or A', 'AI'], ['Hold Z / Shift', 'Loupe (arrows move it)'], ['Hold the mouse', 'Loupe'], ['Space · Enter', 'Next'], ['Esc · P', 'Pause']],
  },
  onPause: () => releaseInput(),
  onRestart: () => newRun(mode, { practice }),
  onQuit: () => toTitle(),
});

// ---------- the page ----------
const table = document.createElement('canvas');
table.className = 'rai-table';
table.setAttribute('role', 'img');
table.setAttribute('aria-label', 'REAL OR AI?: a photo on the table. Swipe it right for real, left for AI, or hold it to look closer.');
shell.stage.append(table);
const fxCanvas = document.createElement('canvas');
fxCanvas.className = 'rai-fx';
fxCanvas.setAttribute('aria-hidden', 'true');
root.append(fxCanvas);
const safeProbe = el('div', { class: 'rai-safe', 'aria-hidden': 'true' });
root.append(safeProbe);
let dirty = true;
const view = fitCanvas(table, { maxDpr: 2, onResize: () => { dirty = true; } });
const fxView = fitCanvas(fxCanvas, { maxDpr: 2, onResize: () => { dirty = true; } });

// the bar: score, the streak (with its flame), hearts
const scoreChip = shell.chip('Score', 0);
scoreChip.node.classList.add('rai-chip-score');
const streakChip = shell.chip('Streak', 0);
streakChip.node.classList.add('rai-chip-streak');
const chipFlame = ICON.flame();
chipFlame.setAttribute('class', 'rai-chip-flame');
streakChip.node.prepend(chipFlame);
const heartsChip = shell.chip('', '');
heartsChip.node.classList.add('rai-chip-hearts');
heartsChip.node.setAttribute('aria-label', 'Hearts');
const heartIcons = [ICON.heart(), ICON.heart(), ICON.heart()];
heartsChip.node.append(el('span', 'rai-hearts', heartIcons));

const sounds = createSounds(shell.audio);
const dock = createDock({
  onChoice: (g, btn) => choose(g, 'button', btn),
  onNext: () => next(0),
  onWhy: () => hold(),
  touch: TOUCH,
});
shell.stage.append(dock.node);

let renderer = null;              // made once the fonts are in (the stamps are drawn with them)
const parts = new Particles(420);
const floats = new FloatText();
const shake = new Shake({ max: 12, decay: 2.2 });

// ---------- state ----------
let ready = false;
let phase = 'boot';               // boot · title · deal · ask · reveal · end
let mode = 'streak', practice = false, dayKey = R.dateKey();
let run = null, lastRes = null;
let card = null, leaving = null;
let stats = R.cleanStats(shell.store.read().stats);
let vt = 0, rt = 0;               // the game's clock (paused with the game) and the screen's (always)
let askT = 0, revealT = 0, autoAt = null, held = false, hitStop = 0, tickSec = 99;
let banner = null;                // { text, sub, t, color }
let demoRuns = 0, demoState = null, bot = null;
let tips = { ...(shell.store.read().tips || {}) };
let viewer = null;
const pose = { x: 0, y: 0, rot: 0, vx: 0, vy: 0, vr: 0, scale: 1, lift: 0 };
const G = { cx: 0, cy: 0, W: 300 };          // the print in play: where it is now (eased toward the layout)
let L = null;                     // the layout
let target = null;                // where the print goes ({ cx, cy, W })
const hover = { on: false, u: 0, v: 0, su: 0, sv: 0 };
const loupe = { on: false, a: 0, x: 0, y: 0, kind: 'touch', u: 0.5, v: 0.5 };
let press = null;                 // the finger or mouse on the table
let lastPointer = null;           // where the mouse was last (the keyboard's loupe starts there)
const lineDice = DEMO ? rng(((SEED || 7) * 31 + 3) >>> 0) : null;
const pick = (arr) => arr[Math.floor((lineDice ? lineDice.next() : Math.random()) * arr.length)];

// ---------- layout ----------
function measure() {
  dirty = false;
  const w = view.w, h = view.h;
  const cs = getComputedStyle(safeProbe);
  const safe = { r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
  const barBottom = DEMO ? 0 : Math.max(0, shell.bar.getBoundingClientRect().bottom);
  const top = DEMO ? 12 : barBottom + 6;
  const bottom = h - safe.b - (DEMO ? 12 : 14);
  const left = safe.l + 14, right = w - safe.r - 14;
  const availW = right - left, availH = Math.max(120, bottom - top);
  const wide = w >= 640 && w > h * 1.12;
  if (wide) {
    const colW = clamp(availW * 0.36, 300, 430);
    const gap = clamp(availW * 0.035, 18, 46);
    const W = Math.max(180, Math.min((availH - 6) / PRINT.ratio, availW - colW - gap, 700));
    const groupW = W + gap + colW;
    const x0 = left + (availW - groupW) / 2;
    const ask = { cx: x0 + W / 2, cy: top + availH / 2, W };
    L = { shape: 'wide', top, bottom, left, right, w, h, ask, dockAsk: { x: x0 + W + gap, y: top, w: colW, h: availH } };
  } else {
    const dockW = Math.min(availW, availW >= 700 ? 640 : 560);
    dock.place({ x: 0, y: 0, w: dockW, h: 400 }, 'tall');
    const askH = dock.askHeight() || 130;
    // the stack peeks out under the print (about 5% of its width): the dock keeps clear of it
    const gapFor = (W) => GAP + W * 0.05;
    let W = Math.min(availW * 0.93, 720);
    W = Math.max(150, Math.min(W, (availH - askH - GAP) / (PRINT.ratio + 0.05)));
    const H = W * PRINT.ratio;
    const group = H + gapFor(W) + askH;
    const y0 = top + Math.max(0, (availH - group) * 0.48);
    const ask = { cx: left + availW / 2, cy: y0 + H / 2, W };
    const dy = y0 + H + gapFor(W);
    L = { shape: 'tall', top, bottom, left, right, w, h, ask, gapFor, dockAsk: { x: left + (availW - dockW) / 2, y: dy, w: dockW, h: bottom - dy } };
  }
  renderer?.invalidate();
  if (phase === 'reveal') placeReveal(); else placeAsk();
}
function placeAsk(snap = false) {
  if (!L) return;
  target = L.ask;
  dock.place(L.dockAsk, L.shape);
  if (snap) Object.assign(G, target);
}
// the reveal: under the photo on a phone (the print lifts, and shrinks only if the notes need the room), beside it wide
function placeReveal() {
  if (!L) return;
  if (L.shape === 'wide') { target = L.ask; dock.place(L.dockAsk, 'wide'); return; }
  dock.place({ ...L.dockAsk, h: 2000 }, 'tall');
  const need = dock.revealHeight() + 4;
  const room = L.dockAsk.h;
  if (need <= room) { target = L.ask; dock.place(L.dockAsk, 'tall'); return; }
  const full = L.bottom - L.top;
  let W = Math.min(L.ask.W, (full - GAP - need) / (PRINT.ratio + 0.05));
  W = Math.max(W, L.ask.W * (DEMO ? 0.8 : 0.64));
  const H = W * PRINT.ratio, gap = L.gapFor(W);
  const free = Math.max(0, full - H - gap - need);
  const y0 = L.top + free * 0.35;
  target = { cx: L.ask.cx, cy: y0 + H / 2, W };
  dock.place({ x: L.dockAsk.x, y: y0 + H + gap, w: L.dockAsk.w, h: L.bottom - (y0 + H + gap) }, 'tall');
}

// the print's photo square on the screen (ignoring its slight tilt): { x, y, s }
function picRect() {
  const g = renderer.printGeo(G.W * pose.scale);
  return { x: G.cx + pose.x + g.px, y: G.cy + pose.y + g.py, s: g.ps };
}
// is a point on the print? (its tilt included)
function onCard(x, y) {
  const dx = x - (G.cx + pose.x), dy = y - (G.cy + pose.y);
  const c = Math.cos(-pose.rot), s = Math.sin(-pose.rot);
  const lx = dx * c - dy * s, ly = dx * s + dy * c;
  return Math.abs(lx) <= (G.W * pose.scale) / 2 + 8 && Math.abs(ly) <= (G.W * PRINT.ratio * pose.scale) / 2 + 8;
}

// ---------- AGI-1's words, the HUD ----------
function hud() {
  if (!run) return;
  scoreChip.set(run.score);
  streakChip.set(run.streak);
  heartsChip.hide(run.mode !== 'streak');
  heartIcons.forEach((hrt, i) => hrt.classList.toggle('is-lost', run.hearts != null && i >= run.hearts));
  dock.tally(run.right, run.agiRight);
  dock.meter(run.streak);
  dock.score(run.score);
  if (run.mode === 'daily') dock.pips(run.answers, run.i, run.deck.length);
}
function hintFor() {
  if (DEMO) return '';
  const n = (shell.store.read().stats?.seen || 0) + (run ? run.answers.length : 0);
  if (n >= 4) return '';
  return TOUCH ? 'hold the photo to zoom in · swipe it or tap' : 'hold the photo to zoom in · ← AI · REAL →';
}

// ---------- a run ----------
function newRun(m = 'streak', { practice: pr = false } = {}) {
  if (!ready || !PICS.length) return;
  closeViewer();
  mode = m === 'daily' ? 'daily' : 'streak';
  practice = Boolean(pr) && mode === 'daily';
  dayKey = R.dateKey();
  let deck, salt;
  if (mode === 'daily') {
    deck = R.dailyPick(PICS, dayKey);
    salt = `daily:${dayKey}`;
  } else {
    const seed = DEMO ? (((SEED || 7) * 7919 + demoRuns * 101) >>> 0) : nextSeed();
    deck = R.streakDeck(PICS, seed, { seen: DEMO ? {} : stats.pics });
    if (DEMO) {
      // the preview opens on photos with clues to circle: an AI-made one, a real one, another AI-made one
      const ai = deck.filter((p) => p.ai && p.clues?.length), real = deck.filter((p) => !p.ai && p.clues?.length);
      const opening = [ai[0], real[0], ai[1]].filter(Boolean);
      deck = [...opening, ...deck.filter((p) => !opening.includes(p))];
    }
    salt = `streak:${seed}`;
  }
  run = R.createRun({ mode, deck, salt });
  if (mode === 'daily' && !practice) {
    const prog = shell.store.read().dailyProg;
    if (prog?.date === dayKey) R.restore(run, prog);
  }
  if (DEMO) Object.assign(run, { score: 1240, streak: 4, bestStreak: 4, hearts: 2, right: 6, agiRight: 5 });
  lastRes = null; leaving = null; banner = null; held = false; autoAt = null;
  parts.clear(); floats.clear();
  releaseInput();
  bot = DEMO ? createBot((SEED || 7) + demoRuns * 13) : null;
  demoState = null;
  shell.started();
  dock.mode(mode);
  dock.hint(hintFor());
  dock.show('ask');
  measure();
  placeAsk(true);
  hud();
  phase = 'deal';
  deal({ instant: DEMO });
  if (!DEMO) shell.audio.music(createLoopMusic(labMusic()));
  if (run.over) finish();
}

function deal({ instant = false } = {}) {
  if (mode === 'streak' && run.deck.length - run.i < 3) {
    const recent = run.answers.slice(-6).map((a) => a.pic.id);
    const seed = DEMO ? R.hashString(`${run.salt}:${run.i}`) : ((Math.random() * 2 ** 31) >>> 0);
    R.extendDeck(run, R.streakDeck(PICS, seed, { seen: DEMO ? {} : stats.pics, avoid: recent }));
  }
  const pic = R.currentPic(run);
  if (!pic) { finish(); return; }
  IMG.prefetch([pic, run.deck[run.i + 1], run.deck[run.i + 2]]);
  const d = rng(R.hashString(`${pic.id}:${run.i}:look`));
  card = {
    pic, picId: pic.id, frame: run.i + 1, flip: instant ? 1 : 0, flipT: instant ? 1 : -1, img: IMG.imageOf(pic), imgA: IMG.isReady(pic) ? 1 : 0,
    stamp: null, badge: null, clues: null, clueT: 0, caption: '', captionA: 0, label: { kind: 'real', a: 0 },
    baseRot: (d.next() - 0.5) * 0.028, t: 0, flash: 0, slammed: false, badged: false, finished: false,
  };
  Object.assign(pose, instant
    ? { x: 0, y: 0, rot: card.baseRot, vx: 0, vy: 0, vr: 0, lift: 0 }
    : { x: G.W * 0.03, y: G.W * 0.04, rot: 0.045, vx: 0, vy: 0, vr: 0, lift: 0 });
  phase = 'deal';
  askT = 0; tickSec = 99;
  dock.show('ask');
  dock.btnAI.disabled = true; dock.btnReal.disabled = true;
  dock.clock(1, mode === 'daily' ? 100 : R.CLOCK, false);
  dock.question(mode === 'daily' ? `Photo ${run.i + 1} of ${run.deck.length} · Daily` : `Photo ${String(run.i + 1).padStart(2, '0')} · Streak`);
  placeAsk();
  hud();
  if (!instant) sounds.deal();
  if (DEMO) demoState = { plan: bot.plan(pic), t: 0, first: run.answers.length === 0 && demoRuns === 0 };
}

// the photo couldn't be loaded: on to the next one (never shown half-drawn); several in a row: no connection
let broken = 0;
function skipBroken() {
  broken++;
  if (broken >= 3 || run.deck.length <= 1) {
    broken = 0;
    shell.toast('Can’t load the photos. Check your connection', 'warn', 3600);
    toTitle();
    return;
  }
  run.deck.splice(run.i, 1);
  if (mode === 'daily' && run.i >= run.deck.length) { finish(); return; }
  deal();
}

function choose(guess, how = 'button', btn = null) {
  if (phase !== 'ask' || !card || card.imgA < 1) return;
  const res = R.answer(run, guess, askT);
  if (!res) return;
  shell.audio.unlock();
  if (guess === 'real') sounds.shutter(); else sounds.bleep();
  shell.haptic(10);
  const side = guess === 'real' ? 1 : -1;
  if (how !== 'swipe') { pose.vx += side * G.W * 2.4; pose.vr += side * 1.4; }
  const b = btn || (guess === 'real' ? dock.btnReal : dock.btnAI);
  b.classList.add('is-press');
  setTimeout(() => b.classList.remove('is-press'), 130);
  reveal(res);
}
function timeout() {
  if (phase !== 'ask') return;
  const res = R.answer(run, null, R.CLOCK);
  sounds.timeout();
  shell.haptic([20, 30, 20]);
  pose.vy += 260;
  reveal(res);
}

function reveal(res) {
  phase = 'reveal';
  lastRes = res;
  revealT = 0;
  held = false;
  releaseLoupe();
  const d = rng(R.hashString(`${res.pic.id}:${res.i}:stamp`)).next;
  const spot = stampSpot(res.pic, res.truth, d);
  card.stamp = { kind: res.truth, t: -0.06, x: spot.x, y: spot.y, rot: spot.rot };
  // the ✓ / ✗ just past the stamp's inner end, a little toward the middle (never over its glyph)
  const half = (res.truth === 'ai' ? 0.3 : 0.44) / 2;
  const inward = spot.x < 0.5 ? 1 : -1;
  card.badge = { ok: res.correct, t: -0.26, x: clamp(spot.x + inward * (half + 0.055), 0.09, 0.91), y: clamp(spot.y + (spot.y > 0.5 ? -0.075 : 0.075), 0.08, 0.92), rot: spot.rot * -1.6 };
  card.clues = res.pic.clues || [];
  card.clueT = -0.42;
  card.caption = res.pic.title || '';
  card.label.a = 0;
  const auto = res.correct && !res.over;
  autoAt = auto ? (DEMO ? 2.6 : AUTO) : null;
  const line = revealLine(res, pick);
  dock.fill(res, { line, expanded: !res.correct || res.over, auto: auto && !DEMO, last: res.over, mode });
  dock.reveal.classList.toggle('is-compact', DEMO);
  dock.show('reveal');
  placeReveal();
  if (!DEMO && !practice) {
    shell.store.update((s) => {
      const st = R.cleanStats(s.stats);
      R.recordAnswer(st, res);
      s.stats = st;
      if (mode === 'daily') s.dailyProg = { date: dayKey, ...R.snapshot(run) };
    });
    stats = R.cleanStats(shell.store.read().stats);
  }
}

// the stamp lands: the thud, a tiny freeze, ink specks
function slam() {
  card.slammed = true;
  sounds.stamp();
  hitStop = REDUCED ? 0 : 0.075;
  shake.kick(lastRes.correct ? 0.2 : 0.3);
  shell.haptic(16);
  const r = picRect();
  const sx = r.x + card.stamp.x * r.s, sy = r.y + card.stamp.y * r.s;
  const col = card.stamp.kind === 'ai' ? PINK : MINT;
  parts.burst({ x: sx, y: sy, count: 22, speed: [120, 420], life: [0.25, 0.6], size: [2.5, 6], colors: [col, col, INK], drag: 4.5, shape: 'circle' });
  parts.burst({ x: sx, y: sy, count: 8, speed: [60, 200], life: [0.4, 0.8], size: [6, 11], colors: [INK], drag: 6, shape: 'square', spin: 4 });
}
// the verdict lands: the sting, the points, a heart, the streak
function verdict() {
  card.badged = true;
  const res = lastRes;
  const r = picRect();
  const cx = r.x + r.s / 2;
  // the points rise from the ✓ (kept on the screen)
  const size = clamp(r.s * 0.11, 26, 46), rise = 64;
  const fx = clamp(r.x + card.badge.x * r.s, r.x + size * 1.6, r.x + r.s - size * 1.6);
  const fy = Math.max(r.y + card.badge.y * r.s - r.s * 0.11, (L?.top ?? 0) + rise + size * 0.7);
  if (res.correct) {
    sounds.good(res.mult);
    sounds.climb(res.streak);
    floats.add({ x: fx, y: fy, text: `+${fmt(res.pts)}`, color: res.mult > 1 ? HONEY : MINT, size, life: 1.1, rise });
    scoreChip.set(run.score, { pop: true });
    streakChip.set(run.streak, { pop: true });
    if (res.multUp) {
      banner = { text: `×${res.mult} STREAK`, sub: LINES.streak[res.streak] || '', t: -0.3, color: res.mult >= 4 ? PINK : HONEY };
      sounds.multUp(res.mult);
      shell.haptic([12, 30, 12]);
      dock.meter(run.streak, { up: true });
    } else dock.meter(run.streak);
    parts.burst({ x: cx, y: r.y + r.s * 0.5, count: 14, speed: [180, 460], life: [0.4, 0.8], size: [7, 12], colors: [MINT, HONEY, PAPER], gravity: 600, drag: 2, shape: 'star', spin: 6, stroke: INK });
  } else {
    sounds.sour();
    streakChip.set(0, { pop: true });
    dock.meter(0);
    if (mode === 'streak') breakHeart(res.hearts);
    shell.haptic([30, 40, 30]);
  }
  dock.tally(run.right, run.agiRight);
  dock.score(run.score);
  if (mode === 'daily') dock.pips(run.answers, run.i, run.deck.length);
}
function breakHeart(left) {
  const icon = heartIcons[left];
  if (!icon) return;
  icon.classList.add('is-lost', 'is-break');
  setTimeout(() => icon.classList.remove('is-break'), 520);
  heartsChip.node.classList.remove('is-hit'); void heartsChip.node.offsetWidth; heartsChip.node.classList.add('is-hit');
  sounds.heart();
  const b = icon.getBoundingClientRect();
  const x = b.left + b.width / 2, y = b.top + b.height / 2;
  if (b.width) {
    parts.burst({ x, y, count: 12, speed: [120, 380], angle: [Math.PI * 0.1, Math.PI * 0.9], life: [0.5, 0.9], size: [5, 10], colors: [PINK, '#ff8cc6', INK], gravity: 900, drag: 1.2, shape: 'square', spin: 9, stroke: INK });
  }
  const r = picRect();
  floats.add({ x: r.x + r.s / 2, y: r.y + r.s * 0.42, text: left ? `${left} ${left === 1 ? 'HEART' : 'HEARTS'} LEFT` : 'NO HEARTS LEFT', color: PINK, size: clamp(r.s * 0.075, 20, 30), life: 1.3, rise: 34 });
}

function hold() {
  if (phase !== 'reveal') return;
  held = true;
  autoAt = null;
  dock.expand();
  placeReveal();
}
function next(dir = 0) {
  if (phase !== 'reveal' || revealT < 0.25) return;
  if (lastRes?.over) { finish(); return; }
  const side = dir || (lastRes?.truth === 'real' ? 1 : -1);
  leaving = { card, x: pose.x, y: pose.y, rot: pose.rot, vx: side * Math.max(1600, G.W * 5) + pose.vx * 0.3, vy: -120, vr: side * 3.2, cx: G.cx, cy: G.cy, W: G.W, t: 0 };
  sounds.whoosh();
  releaseLoupe();
  deal();
}

function finish() {
  if (phase === 'end') return;
  if (DEMO) { demoRuns++; newRun('streak'); return; }
  phase = 'end';
  releaseInput();
  shell.audio.stopMusic();
  // nothing of the last photo's moment over the end card
  banner = null;
  floats.clear();
  parts.clear();
  const s = R.summary(run);
  const daily = mode === 'daily';
  let best = undefined, isBest = undefined;
  if (daily && !practice) {
    shell.store.update((d) => {
      d.daily = R.trimDaily({ ...(d.daily || {}), [dayKey]: { s: run.score, r: run.right, n: run.answers.length, g: run.answers.map((a) => (a.correct ? 1 : 0)).join(''), b: run.bestStreak } });
      delete d.dailyProg;
    });
  }
  if (daily && practice) { best = null; isBest = false; }
  const prev = shell.store.best(daily ? 'dailyBest' : 'best');
  const willBest = !practice && run.score > 0 && (prev == null || run.score > prev);
  const line = endLine({ mode, right: run.right, beat: s.beat, isBest: willBest && !daily, practice }, pick);
  const stats4 = [
    ['Correct', `${s.right} of ${s.n}`],
    ['Best streak', String(s.bestStreak)],
    ['Fastest guess', s.fastest == null ? '—' : `${s.fastest.toFixed(1)} s`],
    ['You vs AGI-1', `${s.you} – ${s.agi}`],
  ];
  const extra = daily ? recapStrip(run.answers, (a) => showViewer(a)) : null;
  shell.over({
    score: run.score,
    label: daily ? (practice ? 'Practice score' : 'Daily score') : 'Streak score',
    bestKey: daily ? 'dailyBest' : 'best',
    best, isBest,
    title: daily ? `${practice ? 'Practice' : 'Daily 10'} · ${R.shortDate(dayKey)}` : 'Out of hearts',
    stats: stats4,
    line,
    extra,
    share: daily ? R.dailyShare(dayKey, run.answers, run.deck.length) : R.streakShare(s.bestStreak),
    again: daily ? 'Play Streak' : 'Play again',
    onAgain: () => newRun('streak'),
    onMenu: () => toTitle(),
  });
  if (daily && !practice && s.right === run.deck.length && run.deck.length >= 10) {
    sounds.perfect();
    confetti();
  }
}
function confetti() {
  const w = fxView.w;
  for (let i = 0; i < 6; i++) {
    parts.burst({ x: (w * (i + 0.5)) / 6, y: -20, count: 26, speed: [80, 420], angle: [Math.PI * 0.15, Math.PI * 0.85], life: [1.4, 2.6], size: [7, 13], colors: [MINT, PINK, HONEY, VIOLET, PAPER], gravity: 520, drag: 1.1, shape: 'square', spin: 10, stroke: INK });
  }
  celebrate = 3;
}
let celebrate = 0;

function showViewer(a) {
  closeViewer();
  viewer = openViewer(a, { line: a.pic.note || '', onClose: () => { viewer = null; } });
  root.append(viewer.node);
}
function closeViewer() { if (viewer) { const v = viewer; viewer = null; v.close(); } }

// Streak's next deck is picked while the title is up, so its first photos can load before Play
let streakSeed = 0;
function nextSeed() {
  const s = streakSeed || ((Math.random() * 2 ** 31) >>> 0);
  streakSeed = 0;
  return s;
}
function prefetchStreak() {
  streakSeed = (Math.random() * 2 ** 31) >>> 0;
  IMG.prefetch(R.streakDeck(PICS, streakSeed, { seen: stats.pics }).slice(0, 2));
}

// ---------- the title ----------
const logo = titleLogo();
const fanView = fitCanvas(logo.fan, { maxDpr: 2 });
const fan = { prints: [0, 1, 2].map(() => ({ img: null, flip: 0, target: 0, stamp: null, pic: null })), t: 0, next: 1.1, turn: 0, pool: [] };
function titleArt() {
  // the fan's photos: easy ones, both kinds
  const easy = PICS.filter((p) => p.level === 1);
  const pool = (easy.length >= 4 ? easy : PICS).slice();
  rng(R.hashString(R.dateKey())).shuffle(pool);
  fan.pool = pool.slice(0, 6);
  IMG.prefetch(fan.pool.slice(0, 3));
}
function toTitle() {
  if (!ready) return;
  closeViewer();
  phase = 'title';
  shell.audio.stopMusic();
  releaseInput();
  dock.hide();
  card = null; leaving = null; run = null; banner = null;
  parts.clear(); floats.clear();
  const s = shell.store.read();
  stats = R.cleanStats(s.stats);
  const today = R.dateKey();
  const done = s.daily?.[today];
  const prog = s.dailyProg?.date === today && s.dailyProg.i > 0 ? s.dailyProg : null;
  const best = shell.store.best('best');
  shell.title({
    logo: logo.node,
    tagline: 'One photo. Real or AI? Trust your eyes.',
    hidePlay: true,
    modes: [
      { label: 'Daily 10', sub: done ? `Done · ${done.r}/${done.n || 10} · practice` : prog ? `Continue · ${prog.i} of 10` : `${R.shortDate(today)} · ten photos`, onClick: () => newRun('daily', { practice: Boolean(done) }) },
      { label: 'Streak', sub: best ? `3 hearts · best ${fmt(best)}` : '3 hearts · 10 s a photo', onClick: () => newRun('streak') },
    ],
    onPlay: () => (done ? newRun('streak') : newRun('daily')),
    best: null,
    extra: eyePanel(stats, { dailyDays: R.dailyRun(s.daily, today) }),
  });
  const btns = root.querySelectorAll('.ak-btn-mode');
  btns[done ? 1 : 0]?.classList.add('rai-mode-glow');
  prefetchStreak();
}

// ---------- input: the finger, the mouse, the keys ----------
function releaseLoupe() {
  if (loupe.on) { loupe.on = false; if (!DEMO && phase !== 'end') sounds.loupeOff(); }
  table.classList.remove('is-loupe');
}
function releaseInput() {
  press = null;
  releaseLoupe();
  table.classList.remove('is-dragging');
  if (card) card.label.a = 0;
  keys?.clear();
}
function startLoupe(x, y, kind) {
  loupe.on = true;
  loupe.kind = kind;
  setLoupe(x, y);
  if (!DEMO) sounds.loupeOn();
  if (kind !== 'touch') table.classList.add('is-loupe');
  if (phase === 'reveal') { held = true; autoAt = null; }
  tips.loupe = true;
}
// the loupe looks at a point of the photo (kept on it)
function setLoupe(x, y) {
  const r = picRect();
  loupe.u = clamp((x - r.x) / r.s, 0, 1);
  loupe.v = clamp((y - r.y) / r.s, 0, 1);
}
function canAct() { return (phase === 'ask' || phase === 'reveal') && shell.state === 'play' && !DEMO; }

pointer(table, {
  down(p) {
    lastPointer = { x: p.x, y: p.y };
    if (press || !canAct()) return;
    press = { id: p.id, x0: p.x, y0: p.y, x: p.x, y: p.y, t0: vt, mode: null, on: onCard(p.x, p.y), type: p.type, hist: [[performance.now(), p.x]] };
  },
  move(p) {
    lastPointer = { x: p.x, y: p.y };
    if (!press || p.id !== press.id) return;
    press.x = p.x; press.y = p.y;
    press.hist.push([performance.now(), p.x]);
    if (press.hist.length > 8) press.hist.shift();
    const d = Math.hypot(p.x - press.x0, p.y - press.y0);
    if (!press.mode && d > 9) {
      press.mode = press.on && (phase === 'ask' || phase === 'reveal') ? 'drag' : 'none';
      if (press.mode === 'drag') table.classList.add('is-dragging');
    }
    if (press.mode === 'loupe') setLoupe(p.x, p.y);
  },
  up(p) {
    if (!press || p.id !== press.id) return;
    const pr = press;
    press = null;
    table.classList.remove('is-dragging');
    if (pr.mode === 'loupe') { releaseLoupe(); return; }
    if (pr.mode === 'drag') { endDrag(pr); return; }
    if (pr.mode === null && p.event?.type !== 'pointercancel') {
      // a tap: in the reveal, on the photo it holds the notes open, anywhere else it moves on
      if (phase === 'reveal') { if (pr.on && autoAt != null) hold(); else if (!pr.on) next(0); }
    }
  },
  hover(p) {
    lastPointer = { x: p.x, y: p.y };
    if (p.type !== 'mouse') return;
    hover.on = card && onCard(p.x, p.y);
    if (hover.on) {
      hover.u = clamp((p.x - G.cx) / (G.W / 2), -1, 1);
      hover.v = clamp((p.y - G.cy) / ((G.W * PRINT.ratio) / 2), -1, 1);
    }
    if (loupe.on && loupe.kind === 'key') setLoupe(p.x, p.y);
  },
});
table.addEventListener('pointerleave', () => { hover.on = false; });

function swipeSpeed(pr) {
  const h = pr.hist;
  if (h.length < 2) return 0;
  const a = h[0], b = h[h.length - 1];
  const dt = (b[0] - a[0]) / 1000;
  return dt > 0.001 && dt < 0.25 ? (b[1] - a[1]) / dt : 0;
}
function endDrag(pr) {
  const dx = pr.x - pr.x0;
  const thr = Math.min(G.W * 0.26, 130);
  const v = swipeSpeed(pr);
  const go = Math.abs(dx) > thr || (Math.abs(v) > 650 && Math.abs(dx) > 32 && Math.sign(v) === Math.sign(dx));
  if (card) card.label.a = 0;
  if (!go) { pose.vx = v * 0.4; return; }
  const side = Math.sign(dx);
  if (phase === 'ask') {
    pose.vx = v * 0.35;
    choose(side > 0 ? 'real' : 'ai', 'swipe');
  } else if (phase === 'reveal') next(side);
}

const keys = keyboard({
  ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'up', ArrowDown: 'down',
  z: 'loupe', Shift: 'loupe', ' ': 'next', Enter: 'next',
}, {
  blocked: () => shell.state !== 'play' || DEMO || Boolean(viewer),
  down(name) {
    if (name === 'loupe') {
      if ((phase === 'ask' || phase === 'reveal') && card?.imgA >= 1 && !loupe.on) {
        const r = picRect();
        const p = lastPointer && lastPointer.x > r.x && lastPointer.x < r.x + r.s && lastPointer.y > r.y && lastPointer.y < r.y + r.s ? lastPointer : { x: r.x + r.s / 2, y: r.y + r.s / 2 };
        startLoupe(p.x, p.y, 'key');
      }
      return;
    }
    if (loupe.on && loupe.kind === 'key') return;          // the arrows move the loupe
    if (name === 'left' && phase === 'ask') choose('ai', 'key');
    else if (name === 'right' && phase === 'ask') choose('real', 'key');
    else if (name === 'next' && phase === 'reveal') next(0);
  },
  up(name) { if (name === 'loupe' && loupe.kind === 'key') releaseLoupe(); },
});

// ---------- the demo's player ----------
function demoStep(dt) {
  const st = demoState;
  if (!st || !card) return;
  if (phase === 'ask') {
    st.t += dt;
    const p = st.plan;
    // the first photo: the action lines up with the preview's recording (about 5.7 to 11.7 s after the page opens)
    if (st.first && st.extra == null) st.extra = Math.max(0, 6.25 - performance.now() / 1000 - (0.25 + p.look + 0.42));
    const extra = st.extra || 0;
    const lookFrom = 0.25, lookTo = lookFrom + p.look + extra;
    const r = picRect();
    if (st.t >= lookFrom && st.t < lookTo) {
      // the loupe wanders, then settles on the clue
      const k = (st.t - lookFrom) / (lookTo - lookFrom);
      const path = st.path || (st.path = demoPath(p, extra));
      const seg = Math.min(path.length - 2, Math.floor(k * (path.length - 1)));
      const f = smooth(clamp(k * (path.length - 1) - seg, 0, 1));
      const u = lerp(path[seg].x, path[seg + 1].x, f), v = lerp(path[seg].y, path[seg + 1].y, f);
      if (!loupe.on) { loupe.on = true; loupe.kind = 'bot'; }
      loupe.u = u; loupe.v = v;
    } else if (st.t >= lookTo && loupe.on) {
      loupe.on = false;
    }
    if (DEMO && st.t < lookTo - 1.4) askT = 0;            // its clock starts with its last look
    const swipeFrom = lookTo + 0.1, dur = 0.32;
    if (st.t >= swipeFrom) {
      const k = clamp((st.t - swipeFrom) / dur, 0, 1);
      const side = p.guess === 'real' ? 1 : -1;
      pose.x = side * G.W * 0.38 * k * k;
      pose.rot = card.baseRot + side * 0.16 * k * k;
      pose.vx = 0; pose.vr = 0;
      card.label.kind = p.guess; card.label.a = clamp(k * 1.4, 0, 1);
      if (k >= 1) { pose.vx = side * 600; choose(p.guess, 'swipe'); }
    }
  } else if (phase === 'reveal') {
    if (revealT > 1.1 && revealT < 1.7) card.flash = revealT - 1.1; else card.flash = 0;
    if (!lastRes.correct && revealT > 2.4) next(0);
  }
}
function demoPath(p, extra) {
  const pts = [p.start];
  const r = rng(R.hashString(`${card.picId}:path`));
  const hops = Math.min(3, Math.floor(extra / 1.1));
  for (let i = 0; i < hops; i++) pts.push({ x: r.range(0.2, 0.8), y: r.range(0.22, 0.75) });
  pts.push(p.target, p.target);
  return pts;
}

// ---------- the clock: the game ----------
function step(dt) {
  vt += dt;
  shake.update(dt);
  parts.update(dt);
  floats.update(dt);
  if (celebrate > 0) celebrate -= dt;
  if (banner) { banner.t += dt; if (banner.t > 1.5) banner = null; }
  if (!ready || !run || !card) return;
  let cdt = dt;
  if (hitStop > 0) { hitStop -= dt; cdt = 0; }
  // the photo arrives (decoded first)
  if (!card.img && IMG.isReady(card.pic)) card.img = IMG.imageOf(card.pic);
  if (IMG.failed(card.pic) && phase !== 'reveal') { skipBroken(); return; }
  if (card.img && card.imgA < 1) card.imgA = Math.min(1, card.imgA + dt / 0.15);
  card.t += cdt;

  if (phase === 'deal') {
    if (card.flipT < 0 && card.t > 0.16) { card.flipT = 0; sounds.flip(); }
    if (card.flipT >= 0 && card.flip < 1) {
      card.flipT += cdt;
      card.flip = REDUCED ? 1 : clamp(card.flipT / 0.34, 0, 1);
      pose.lift = Math.sin(card.flip * Math.PI);
    }
    if (card.flip >= 1 && card.imgA >= 1) {
      broken = 0;
      phase = 'ask';
      askT = 0;
      dock.btnAI.disabled = false; dock.btnReal.disabled = false;
    }
  }
  if (phase === 'ask') {
    askT += cdt;
    const left = 1 - askT / R.CLOCK;
    if (mode === 'streak') {
      const sec = Math.max(0, Math.ceil(R.CLOCK - askT));
      dock.clock(left, sec, sec <= 3);
      if (sec <= 3 && sec !== tickSec && sec > 0) { tickSec = sec; sounds.tick(true); }
      if (askT >= R.CLOCK) timeout();
    } else {
      dock.clock(left, R.speedBonus(askT), false);
    }
  }
  if (phase === 'reveal') {
    revealT += cdt;
    card.stamp.t += cdt;
    card.badge.t += cdt;
    card.clueT += cdt;
    card.captionA = clamp(card.captionA + cdt / 0.35, 0, 1);
    if (!card.slammed && card.stamp.t >= (REDUCED ? 0 : 0.11)) slam();
    if (!card.badged && card.badge.t >= 0) verdict();
    if (autoAt != null && !press && !loupe.on) {
      dock.autoFill(revealT / autoAt);
      if (revealT >= autoAt) next(0);
    }
  }
  if (DEMO) demoStep(cdt);
  physics(cdt);
  if (leaving) {
    leaving.t += dt;
    leaving.x += leaving.vx * dt; leaving.y += leaving.vy * dt; leaving.vy += 900 * dt; leaving.rot += leaving.vr * dt;
    if (leaving.t > 0.9) leaving = null;
  }
  // the keyboard's loupe moves with the arrows
  if (loupe.on && loupe.kind === 'key') {
    const sp = 0.55 * dt;
    if (keys.held('left')) loupe.u = clamp(loupe.u - sp, 0, 1);
    if (keys.held('right')) loupe.u = clamp(loupe.u + sp, 0, 1);
    if (keys.held('up')) loupe.v = clamp(loupe.v - sp, 0, 1);
    if (keys.held('down')) loupe.v = clamp(loupe.v + sp, 0, 1);
  }
  // a still press turns into the loupe
  if (press && press.mode === null && press.on && vt - press.t0 >= HOLD_MS && (phase === 'ask' || phase === 'reveal') && card.imgA >= 1) {
    press.mode = 'loupe';
    startLoupe(press.x, press.y, press.type === 'mouse' ? 'mouse' : 'touch');
  }
}

function physics(dt) {
  if (!target) return;
  // the print eases to its place in the layout
  const k = 1 - Math.exp(-11 * dt);
  G.cx += (target.cx - G.cx) * k; G.cy += (target.cy - G.cy) * k; G.W += (target.W - G.W) * k;
  if (press && press.mode === 'drag') {
    const dx = press.x - press.x0, dy = press.y - press.y0;
    pose.x = dx;
    pose.y = dy * 0.28;
    pose.rot = card.baseRot + clamp(dx / (G.W * 1.6), -1, 1) * (REDUCED ? 0.08 : 0.3) * (press.y0 < G.cy ? 1 : -0.7);
    pose.vx = 0; pose.vy = 0; pose.vr = 0;
    const thr = Math.min(G.W * 0.26, 130);
    if (phase === 'ask') { card.label.kind = dx > 0 ? 'real' : 'ai'; card.label.a = clamp((Math.abs(dx) - 8) / thr, 0, 1); }
    return;
  }
  if (DEMO && phase === 'ask' && demoState && demoState.t >= 0.25 + demoState.plan.look + (demoState.extra || 0) + 0.1) return;
  // a spring back to rest (a little overshoot), the hover's lean on a computer
  hover.su = approach(hover.su, hover.on && !REDUCED ? hover.u : 0, 8, dt);
  hover.sv = approach(hover.sv, hover.on && !REDUCED ? hover.v : 0, 8, dt);
  const restRot = card.baseRot + hover.su * 0.022;
  const K = 260, D = 22;
  pose.vx += (-K * pose.x - D * pose.vx) * dt;
  pose.vy += (-K * pose.y - D * pose.vy) * dt;
  pose.vr += (-K * (pose.rot - restRot) - D * pose.vr) * dt;
  pose.x += pose.vx * dt; pose.y += pose.vy * dt; pose.rot += pose.vr * dt;
  if (phase !== 'deal') pose.lift = approach(pose.lift, hover.on ? 0.35 : 0, 10, dt);
  if (card.label.a > 0 && phase !== 'ask') card.label.a = Math.max(0, card.label.a - dt * 6);
}

// ---------- drawing ----------
const drawPose = { x: 0, y: 0, rot: 0, scale: 1, lift: 0 };
function sceneCard(ctx) {
  if (!card) return;
  drawPose.x = pose.x; drawPose.y = pose.y; drawPose.rot = pose.rot; drawPose.scale = 1; drawPose.lift = pose.lift;
  renderer.drawCard(ctx, card, G.cx, G.cy, G.W, drawPose, vt);
}
function draw(frameDt) {
  rt += frameDt;
  if (dirty) measure();
  const ctx = view.begin();
  const w = view.w, h = view.h;
  if (!renderer) { ctx.fillStyle = '#14132b'; ctx.fillRect(0, 0, w, h); fxView.begin(); return; }
  const inGame = run && card && phase !== 'title' && phase !== 'boot';
  ctx.save();
  if (inGame && !REDUCED) shake.apply(ctx, w / 2, h / 2);
  renderer.drawTable(ctx, w, h, rt, { strips: L?.shape === 'wide' && (L.ask.cx - L.ask.W / 2 - L.left) > 90 });
  if (inGame) {
    // the swipe's direction, on the screen's edge
    if (card.label.a > 0.02 && phase === 'ask') renderer.drawEdge(ctx, w, h, card.label.kind === 'ai' ? -1 : 1, card.label.a);
    const left = mode === 'daily' ? run.deck.length - run.i - (phase === 'reveal' ? 0 : 1) : 2;
    renderer.drawStack(ctx, G.cx, G.cy, G.W, Math.max(0, left), rt, run.i % 2);
    sceneCard(ctx);
    if (leaving) {
      const lp = { x: leaving.x, y: leaving.y, rot: leaving.rot, scale: 1, lift: 0.3 };
      renderer.drawCard(ctx, leaving.card, leaving.cx, leaving.cy, leaving.W, lp, vt);
    }
    // a computer's light on the print, leaning with the mouse
    if (hover.on && !press && !REDUCED && phase === 'ask' && card.imgA >= 1) sheen(ctx);
  }
  ctx.restore();

  // the effects' canvas: the loupe, the specks, the words
  const fx = fxView.begin();
  if (shell.state === 'pause') return;
  if (inGame) {
    loupe.a = approach(loupe.a, loupe.on ? 1 : 0, loupe.on ? 18 : 22, frameDt);
    if (loupe.a > 0.01 && card) {
      const r = picRect();
      const px = r.x + loupe.u * r.s, py = r.y + loupe.v * r.s;
      const R = clamp(Math.min(w, h) * 0.17, 64, 132);
      let lx = px, ly = py, handle = false;
      if (loupe.kind === 'touch' || loupe.kind === 'bot') {
        handle = true;
        const spot = lensSpot(px, py, R, loupe.kind === 'touch' ? 52 : 36, w, h);
        lx = spot.x; ly = spot.y;
      }
      renderer.drawLoupe(fx, { lx, ly, R, px, py, zoom: ZOOM, a: loupe.a, handle }, sceneCard);
    }
    // a first look: "hold to zoom"
    if (!DEMO && !tips.loupe && phase === 'ask' && askT > 1.4 && !press && run.answers.length === 0) {
      const r = picRect();
      const a = clamp((askT - 1.4) / 0.4, 0, 1);
      renderer.holdHint(fx, r.x + r.s * 0.5, r.y + r.s * 0.5, rt, a);
      renderer.sticker(fx, 'HOLD TO ZOOM', r.x + r.s * 0.5, r.y + r.s * 0.5 + 48, { size: 15, a, fill: PAPER });
    }
    if (banner && banner.t > 0) {
      const k = banner.t;
      const s = REDUCED ? 1 : k < 0.25 ? 0.6 + 0.4 * (1 - (1 - k / 0.25) ** 3) * 1.08 : 1;
      const a = k < 1.2 ? 1 : 1 - (k - 1.2) / 0.3;
      const r = picRect();
      renderer.sticker(fx, banner.text, r.x + r.s / 2, r.y + r.s * 0.5, { size: clamp(G.W * 0.075, 20, 34), fill: banner.color, rot: -0.06, a, scale: s });
    }
  }
  parts.draw(fx);
  floats.draw(fx);
}
// where the loupe sits for a finger: above it; else beside it, on the side with more room; else below. Kept on the
// screen and off the buttons (the dock), so it never hides behind them or under the finger.
function lensSpot(px, py, R, gap, w, h) {
  const off = R + gap;
  const top = (L?.top ?? 0) - 6;
  const bottom = L?.shape === 'tall' && phase === 'ask' ? L.dockAsk.y + 8 : h - 6;
  const fits = (x, y) => x - R >= 6 && x + R <= w - 6 && y - R >= top && y + R <= bottom;
  const yIn = clamp(py, top + R, bottom - R);
  const sides = px > w / 2 ? [[px - off, yIn], [px + off, yIn]] : [[px + off, yIn], [px - off, yIn]];
  for (const [x, y] of [[clamp(px, R + 6, w - R - 6), py - off], ...sides]) if (fits(x, y)) return { x, y };
  return { x: clamp(px, R + 6, w - R - 6), y: Math.min(py + off, h - R - 6) };
}

// a soft light across the print, from the side the mouse is on
function sheen(ctx) {
  const W = G.W, H = W * PRINT.ratio;
  ctx.save();
  ctx.translate(G.cx + pose.x, G.cy + pose.y);
  ctx.rotate(pose.rot);
  const gx = hover.su * W * 0.5, gy = hover.sv * H * 0.5;
  const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, W * 0.8);
  g.addColorStop(0, 'rgba(255, 255, 255, 0.13)');
  g.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(-W / 2, -H / 2, W, H);
  ctx.restore();
}

// the title's fan of prints, flipping over one by one (and a stamp now and then)
function drawFanFrame(dt) {
  if (shell.state !== 'title' || !renderer) return;
  const fw = fanView.w, fh = fanView.h;
  if (fw < 20 || fh < 20) return;
  const ctx = fanView.begin();
  fan.t += dt;
  if (fan.t >= fan.next && fan.pool.length) {
    const order = [2, 0, 1];
    const i = order[fan.turn % 3];
    const p = fan.prints[i];
    if (p.target === 0) {
      const pic = fan.pool[fan.turn % fan.pool.length];
      if (IMG.isReady(pic)) { p.pic = pic; p.img = IMG.imageOf(pic); p.target = 1; p.stamp = null; p.since = 0; }
      IMG.prefetch([fan.pool[(fan.turn + 1) % fan.pool.length], fan.pool[(fan.turn + 2) % fan.pool.length]]);
    } else p.target = 0;
    fan.turn++;
    fan.next = fan.t + (p.target ? 1.15 : 0.55);
  }
  for (const p of fan.prints) {
    p.flip = REDUCED ? p.target : approach(p.flip, p.target, 9, dt);
    if (p.target === 1) {
      p.since = (p.since || 0) + dt;
      if (!p.stamp && p.since > 0.9 && p.pic) {
        const d = rng(R.hashString(`${p.pic.id}:fan`)).next;
        const s = stampSpot(p.pic, R.truthOf(p.pic), d);
        p.stamp = { kind: R.truthOf(p.pic), t: 0, x: s.x, y: s.y, rot: s.rot };
      }
      if (p.stamp) p.stamp.t += dt;
    }
  }
  renderer.drawFan(ctx, fw, fh, fan.prints, rt);
}

createLoop({
  update(dt) { step(dt); },
  render(alpha, frameDt) {
    draw(frameDt);
    drawFanFrame(frameDt);
  },
  paused: () => shell.state !== 'play' && !DEMO,
}).start();

// ---------- start: the fonts first (the stamps are drawn with them), then the first photos ----------
const fonts = ["900 40px 'AK Display'", "800 14px 'AK Display'", "700 16px 'AK Mono'", "italic 18px 'AK Serif'", "600 15px 'AK Sans'"];
const fontsReady = Promise.race([Promise.all(fonts.map((f) => document.fonts?.load?.(f))), new Promise((r) => setTimeout(r, 2500))]).catch(() => {});
fontsReady.then(async () => {
  renderer = createRenderer({ reduced: REDUCED });
  ready = true;
  dirty = true;
  if (!PICS.length) { shell.toast('No photos yet', 'warn', 4000); return; }
  if (DEMO) {
    newRun('streak');
    return;
  }
  titleArt();
  // the day's first photos load behind the title
  IMG.prefetch(R.dailyPick(PICS, R.dateKey()).slice(0, 2));
  toTitle();
});
