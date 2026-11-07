// EPOCHS on agi1.app (2026-11-08): Every try comes back to help.
// A turn-based puzzle on the arcade kit: each try (an epoch) replays as an echo of AGI-1 doing exactly what you did,
// so your past selves hold doors, push boxes and take laser hits while you reach the exit. The rules are ./engine.js
// (no DOM), the 30 levels ./levels.js, the board ./render.js, the console and cards ./ui.js. This file wires the
// kit's frame, the input (keys, swipes, taps, the D-pad), the title's little level playing itself, and `?demo` (the
// arcade's preview: the levels' own solutions, seeded, silent, forever).
import './style.css';
import { createShell, el } from '../kit/shell.js';
import { fitCanvas } from '../kit/canvas.js';
import { createLoop } from '../kit/loop.js';
import { pointer } from '../kit/input.js';
import { DEMO, TOUCH, REDUCED, QUERY, SEED } from '../kit/env.js';
import { clamp, rng } from '../kit/fx.js';
import { shareUrl } from '../kit/share.js';
import { parseLevel, Run, codeOf, PLATE, DOOR } from './engine.js';
import { LEVELS, WORLDS, levelById } from './levels.js';
import { Scene, boardGeo, C } from './render.js';
import { createConsole, levelSelect, solvedCard, outCard } from './ui.js';
import { createSfx, createMusic } from './sound.js';
import * as LINES from './lines.js';

const FACE = '/images/landing/agi1-face.webp';
const TAGLINE = 'Every try comes back to help.';
const root = document.getElementById('ak-root');
const shell = createShell({
  game: 'epochs', name: 'EPOCHS', root,
  howTo: {
    intro: 'Each try is an epoch. When a new one starts, every earlier try replays as an echo of AGI-1, move for move, in step with you.',
    steps: [
      ['Move', 'Each move is one tick. Waiting is a move too.'],
      ['Start a new epoch', 'The world resets and your last try becomes an echo: v1, v2… She does exactly what you did.'],
      ['Let your echoes help', 'Echoes hold plates, push boxes and even take a laser hit for you. You reach the exit.'],
      ['Stars', 'Solve it, then try it in fewer epochs and fewer moves (par).'],
    ],
    touch: [['Swipe', 'Move'], ['Tap AGI-1', 'Wait a tick'], ['D-pad', 'Move (on by default)'], ['Buttons', 'Undo, retry, new epoch']],
    keys: [['Arrows / WASD', 'Move'], ['Space', 'Wait a tick'], ['E', 'New epoch'], ['Z', 'Undo'], ['R', 'Retry this epoch'], ['Shift R', 'Restart the level'], ['Click', 'Step toward a tile'], ['Esc', 'Pause']],
  },
  onPause: () => { held = null; },
  onResume: () => { if (openCard) reshowCard(); },
  onRestart: () => { if (def) startLevel(def); },
  onQuit: () => toTitle(),
});

const canvas = el('canvas', { role: 'img', 'aria-label': 'EPOCHS: the puzzle board' });
const safe = el('div', { class: 'ep-safe', 'aria-hidden': 'true' });
const live = el('p', { class: 'ak-sr', 'aria-live': 'polite' });
const ui = el('div', { class: 'ep-ui', hidden: true });
const padBox = el('div', { class: 'ep-padbox' });
shell.stage.append(canvas, safe, ui, live);
let mode = 'boot';            // title · play · demo
let def = null, L = null, run = null;
const view = fitCanvas(canvas, { maxDpr: 2, onResize: () => relayout() });
const sfx = createSfx(shell.audio);
const music = createMusic();
const chipLevel = shell.chip('Level', '1-1');
const chipEpoch = shell.chip('Epoch', '1/2');
const chipTicks = shell.chip('Ticks', '0/12');

const store = shell.store;
const save = () => store.read();
const progress = () => save().levels || {};
let padOn = (() => { const v = save().pad; return v == null ? TOUCH : Boolean(v); })();
const unlocked = (l) => l.index === 0 || (progress()[LEVELS[l.index - 1].id]?.stars || 0) > 0;
const nextUnsolved = () => LEVELS.find((l) => !(progress()[l.id]?.stars > 0) && unlocked(l)) || LEVELS[LEVELS.length - 1];

// ---------- the console ----------
const con = createConsole({ touch: TOUCH, onAct: (name, dir) => act(name, dir) });
ui.append(con.node, padBox);

// ---------- state ----------
const scene = new Scene();
let auto = null;              // the title's or the demo's player
let openCard = null;          // { kind, make } (shown again after a pause)
let celebrate = -1, pendingEpoch = -1, queued = null, held = null, now = 0;
let hintShown = new Set(), wasRewinding = false;
scene.onSpawn = (i, isLive) => { if (mode === 'play') sfx.spawn(i, isLive); };

function announce(text) { live.textContent = text; }

// ---------- layout ----------
function insets() {
  const cs = getComputedStyle(safe);
  const px = (v) => parseFloat(v) || 0;
  return { t: px(cs.paddingTop), r: px(cs.paddingRight), b: px(cs.paddingBottom), l: px(cs.paddingLeft) };
}
function relayout() {
  if (!L) return;
  const vw = view.w, vh = view.h;
  if (mode === 'demo') {
    scene.geo = boardGeo(L, { x: 10, y: 40, w: vw - 20, h: vh - 40 - 30 }, 90);
    return;
  }
  if (mode === 'title') {
    const m = Math.min(vw, vh) * 0.04;
    // a phone upright: the little level plays above the logo; wider screens: behind it, dimmed
    if (vh > vw * 1.25) scene.geo = boardGeo(L, { x: m, y: 70, w: vw - m * 2, h: Math.max(140, vh * 0.4 - 70) }, 64);
    else scene.geo = boardGeo(L, { x: m, y: vh * 0.08, w: vw - m * 2, h: vh * 0.86 }, 70);
    return;
  }
  const ins = insets();
  const bar = shell.bar.getBoundingClientRect();
  const top = Math.max(bar.bottom, ins.t) + 10;
  const left = ins.l + 12, right = ins.r + 12, bottom = ins.b + 12;
  const side = vw > vh * 1.08 && vw >= 560;
  const dock = con.node;
  dock.classList.toggle('is-side', side);
  dock.classList.toggle('is-bottom', !side);
  dock.classList.toggle('has-pad', padOn);
  ui.classList.toggle('has-pad', padOn);
  let area;
  if (side) {
    const roomy = vw >= 1100 && vh >= 700;
    const dw = Math.round(clamp(vw * 0.27, 236, roomy ? 380 : 320));
    dock.classList.toggle('is-roomy', roomy);
    // the D-pad on the left (a phone held sideways), the console on the right
    const ps = padOn ? Math.round(clamp((vh - top - bottom) / 3.3, 40, 58)) : 0;
    if (padOn && con.pad.node.parentNode !== padBox) padBox.append(con.pad.node);
    padBox.hidden = !padOn;
    if (padOn) {
      padBox.style.setProperty('--ep-pad', `${ps}px`);
      con.pad.node.style.setProperty('--ep-pad', `${ps}px`);
      padBox.style.left = `${left}px`; padBox.style.top = `${vh - bottom - ps * 3 - 8}px`;
    }
    dock.style.left = `${vw - right - dw}px`; dock.style.width = `${dw}px`; dock.style.right = '';
    dock.style.bottom = '';
    dock.classList.toggle('is-short', vh < 560);
    dock.classList.toggle('is-tight', vh < 440 || dw < 260);
    const dh = dock.offsetHeight;
    dock.style.top = `${Math.max(top, top + (vh - top - bottom - dh) / 2)}px`;
    const ax = left + (padOn ? ps * 3 + 16 : 4);
    area = { x: ax, y: top, w: vw - right - dw - 16 - ax, h: vh - top - bottom };
  } else {
    if (con.pad.node.parentNode !== con.ctrl) con.ctrl.append(con.pad.node);
    padBox.hidden = true;
    dock.classList.remove('is-roomy');
    const ps = Math.round(clamp(vw / 7.6, 44, 56));
    con.pad.node.style.setProperty('--ep-pad', `${ps}px`);
    dock.style.left = `${left}px`; dock.style.width = `${vw - left - right}px`;
    dock.style.top = ''; dock.style.right = '';
    dock.classList.toggle('is-short', vh < 700);
    dock.classList.toggle('is-tight', vw < 380);
    const dh = dock.offsetHeight;
    dock.style.top = `${vh - bottom - dh}px`;
    // a phone upright: the board runs edge to edge (its outer walls may bleed off the sides)
    area = { x: ins.l, y: top, w: vw - ins.l - ins.r, h: vh - top - bottom - dh - 14 };
    scene.geo = boardGeo(L, area, 76, 0.42);
    chipTicks.hide(vw < 520);
    return;
  }
  scene.geo = boardGeo(L, area, 76);
  chipTicks.hide(vw < 520);
}

// ---------- a level ----------
function loadLevel(d, { epochs = null } = {}) {
  def = d;
  L = parseLevel(d);
  run = new Run(L);
  // (the title and the demo can start in a later epoch, its earlier ones already played)
  if (epochs) for (let e = 0; e < epochs.length; e++) { for (const ch of epochs[e]) run.step(codeOf(ch)); run.newEpoch(); }
  scene.load(L, run.world, view.dpr);
  celebrate = -1; pendingEpoch = -1; queued = null;
  relayout();
}
function startLevel(d) {
  closeCard();
  mode = 'play';
  auto = null;
  ui.hidden = false;
  loadLevel(d);
  scene.youT = 2.4;
  shell.started();
  shell.pausable(true);
  shell.audio.music(music);
  store.update((s) => { s.last = d.id; });
  con.level(d);
  syncHud();
  relayout();
  announce(`Level ${d.id}, ${d.name}. ${d.tip || ''}`);
}

function syncHud() {
  if (!run) return;
  const st = run.status;
  chipLevel.set(def.id);
  chipEpoch.set(`${run.epoch}/${L.K}`);
  chipTicks.set(`${run.t}/${L.T}`);
  con.state({ epoch: run.epoch, K: L.K, t: run.t, T: L.T, status: st, rewinding: scene.rewind > 0 });
  // the first world: when she stands on a plate with an epoch to spare, the big button says what's next
  if ((def.id === '1-1' || def.id === '1-2') && mode === 'play' && st === 'play' && run.epoch < L.K) {
    const p = run.world.bp[run.world.n - 1];
    if (L.kind[p] === PLATE && !hintShown.has(def.id)) {
      hintShown.add(def.id);
      shell.toast(TOUCH ? 'Now tap New epoch' : 'Now press E: New epoch', 'good', 2200);
      con.epochB.classList.add('is-hot');
    }
  }
}

// ---------- moves ----------
const playing = () => mode === 'play' && shell.state === 'play' && !openCard && run;
const ready = () => playing() && scene.rewind <= 0 && celebrate < 0 && pendingEpoch < 0;

function doMove(ch) {
  if (!playing()) return;
  if (!ready()) { if (scene.rewind > 0) queued = ch; return; }
  if (run.status === 'zapped') { shell.toast(TOUCH ? 'Zapped: undo, retry or keep as echo' : 'Zapped: Z undo · R retry · E keep as echo', 'warn', 1600); sfx.bump(); return; }
  step(ch);
}

// one tick: the rules, then the screen and the sound
function step(ch) {
  const W = run.world;
  const before = W.pressed.slice();
  const ev = run.step(codeOf(ch));
  if (!ev) return;
  scene.sync(run.world);
  scene.react(ev);
  sounds(ev, before, ch);
  afterTick(ev);
}

function sounds(ev, before, ch) {
  if (mode !== 'play') return;
  const W = run.world, liveI = W.n - 1;
  let moved = false, bumped = false, door = 0, pushed = false;
  for (const e of ev) {
    if (e.type === 'move' && e.i === liveI) moved = true;
    else if (e.type === 'bump' && e.i === liveI) bumped = true;
    else if (e.type === 'push') pushed = true;
    else if (e.type === 'door') door = e.open ? 1 : door || -1;
    else if (e.type === 'toggle') sfx.toggle();
    else if (e.type === 'timer') sfx.timer();
    else if (e.type === 'desync') sfx.desync();
    else if (e.type === 'deprecate') { sfx.deprecate(); shell.haptic(16); }
    else if (e.type === 'zap') { sfx.zap(); shell.haptic([30, 40, 30]); }
  }
  if (moved) sfx.step(run.t); else if (bumped) sfx.bump(); else if (ch === 'W') sfx.wait();
  if (pushed) { sfx.push(); shell.haptic(10); }
  // plates pressed or let go this tick
  let on = 0, off = 0;
  for (let p = 0; p < L.n; p++) if (L.kind[p] === PLATE && W.pressed[p] !== before[p]) { if (W.pressed[p]) on++; else off++; }
  if (on) sfx.plate(true); else if (off) sfx.plate(false);
  if (door) sfx.door(door > 0);
}

function afterTick(ev) {
  const st = run.status;
  syncHud();
  if (mode !== 'play') { if (st === 'won') win(); return; }
  if (ev.some((e) => e.type === 'zap')) {
    scene.banner = { text: 'ZAPPED', sub: run.canNewEpoch() ? (TOUCH ? 'undo · retry · keep as echo' : 'Z undo · R retry · E keep as echo') : (TOUCH ? 'undo · retry' : 'Z undo · R retry'), t: 0, color: C.pink };
    announce('Zapped by a laser. Undo, retry this epoch, or keep it as an echo.');
  }
  if (st === 'won') win();
  else if (st === 'timeup') {
    pendingEpoch = 0.42;
    shell.toast(`Time’s up · epoch ${run.epoch + 1}`, '', 1300);
  } else if (st === 'out') {
    sfx.out();
    setTimeout(() => { if (mode === 'play' && run.status === 'out') showOut(); }, 380);
  }
}

function newEpoch(silent = false) {
  if (!run || !run.canNewEpoch()) { if (!silent) { sfx.bump(); shell.toast(run && run.epoch >= L.K ? 'This is your last epoch' : 'Not now', 'warn', 1200); } return false; }
  run.newEpoch();
  scene.banner = null;
  scene.zapT = -1;
  // boxes slide home while the tape rewinds
  scene.sync(run.world, { instant: true });
  scene.startRewind(run.epoch);
  if (mode === 'play') sfx.rewind();
  pendingEpoch = -1;
  syncHud();
  announce(`Epoch ${run.epoch} of ${L.K}. ${run.epoch - 1 === 1 ? 'Your echo v1 replays your last try.' : `Your echoes v1 to v${run.epoch - 1} replay your tries.`}`);
  return true;
}

function undo() {
  if (!run || celebrate >= 0) return;
  const e0 = run.epoch;
  if (!run.undo()) { sfx.bump(); return; }
  scene.banner = null; scene.zapT = -1;
  if (run.epoch !== e0) { scene.sync(run.world, { instant: true }); scene.flash = 0.25; scene.flashColor = C.violet2; }
  else scene.sync(run.world, { undo: true });
  sfx.undo();
  pendingEpoch = -1;
  syncHud();
}
function retryEpoch() {
  if (!run || celebrate >= 0 || run.t === 0) return;
  run.restartEpoch();
  scene.banner = null; scene.zapT = -1;
  scene.sync(run.world, { instant: true });
  scene.startRewind(run.epoch);
  sfx.rewind();
  pendingEpoch = -1;
  syncHud();
}
function restartLevel() {
  if (!def) return;
  startLevel(def);
  scene.startRewind(1);
  sfx.rewind();
}

function act(name, dir) {
  if (name === 'pad-down') { doMove(dir); held = { dir, next: now + 0.3 }; con.pad.node.querySelector(`[data-dir="${dir}"]`)?.classList.add('is-on'); return; }
  if (name === 'pad-up') { if (held?.dir === dir) held = null; con.pad.node.querySelector(`[data-dir="${dir}"]`)?.classList.remove('is-on'); return; }
  if (name === 'pad-tap') { doMove(dir); return; }
  if (!playing()) return;
  shell.audio.unlock();
  if (name === 'undo') undo();
  else if (name === 'retry') retryEpoch();
  else if (name === 'epoch') { if (ready() || run.status === 'zapped') newEpoch(); }
  else if (name === 'levels') openSelect();
  else if (name === 'restart') restartLevel();
}

// ---------- solved, out of epochs ----------
function win() {
  celebrate = 0;
  if (mode === 'play') { sfx.win(); shell.haptic([20, 30, 40]); }
  const ex = L.exit % L.w, ey = (L.exit / L.w) | 0;
  const c = scene.center(ex, ey);
  scene.parts.burst({ x: c.x, y: c.y - scene.geo.s * 0.5, count: 70, speed: [120, 420], angle: [-Math.PI * 0.95, -Math.PI * 0.05], life: [0.8, 1.5], size: [4, 8], colors: [C.honey, C.pink, C.mint, C.violet2, C.paper], gravity: 520, drag: 1.2, shape: 'square', spin: 8 });
  const g0 = scene.geo, fx = clamp(c.x, g0.x0 + g0.s * 2.6, g0.x0 + g0.bw - g0.s * 2.6);
  scene.floats.add({ x: fx, y: c.y - scene.geo.s * 1.6, text: 'SOLVED', color: C.honey, size: clamp(scene.geo.s * 0.75, 22, 46), life: 1.2, rise: scene.geo.s * 0.6 });
  if (mode !== 'play') return;
  const stars = run.stars(def.par);
  const prev = progress()[def.id] || null;
  const isBetter = !prev || stars > (prev.stars || 0) || run.ticks < (prev.ticks ?? Infinity);
  store.update((s) => {
    s.levels ||= {};
    const o = s.levels[def.id] || {};
    s.levels[def.id] = {
      stars: Math.max(o.stars || 0, stars),
      epochs: Math.min(o.epochs ?? Infinity, run.epoch),
      ticks: Math.min(o.ticks ?? Infinity, run.ticks),
    };
  });
  const worldLevels = LEVELS.filter((l) => l.world === def.world);
  const worldDone = worldLevels.every((l) => progress()[l.id]?.stars > 0) && !(prev?.stars > 0) && def.id === worldLevels[worldLevels.length - 1].id;
  const allDone = LEVELS.every((l) => progress()[l.id]?.stars > 0) && !(prev?.stars > 0);
  const info = { stars, epochs: run.epoch, ticks: run.ticks, best: prev && isBetter && prev.stars > 0 ? (stars > prev.stars ? 'More stars!' : 'New best!') : null, worldDone, allDone };
  announce(`Solved in ${run.epoch} epochs and ${run.ticks} moves. ${stars} of 3 stars.`);
  setTimeout(() => { if (mode === 'play' && run && run.status === 'won') showSolved(info); }, REDUCED ? 450 : 1150);
}

function showSolved(info) {
  const next = LEVELS[def.index + 1] || null;
  const line = info.allDone || info.worldDone ? LINES.WORLD[def.world] : info.stars === 3 ? LINES.pick(LINES.PERFECT) : LINES.pick(LINES.SOLVED);
  const text = `I solved ${def.id} of EPOCHS in ${info.epochs} epoch${info.epochs > 1 ? 's' : ''} on agi1.app 💜 my past selves did the heavy lifting`;
  const make = () => solvedCard({
    def, ...info, par: def.par, line, face: FACE, next,
    share: shareUrl({ text, path: '/games/epochs' }),
    onNext: () => (next ? startLevel(next) : openSelect()),
    onRetry: () => startLevel(def),
    onLevels: () => openSelect(),
  });
  showCard('solved', make, `Level ${def.id} solved`);
  // the stars pop in one by one, with a note each
  if (!REDUCED) for (let i = 0; i < info.stars; i++) setTimeout(() => { if (openCard?.kind === 'solved') sfx.star(i); }, 260 + i * 220);
  if (info.worldDone || info.allDone) setTimeout(() => sfx.world(), 900);
  openCard.keys = { primary: () => (next ? startLevel(next) : openSelect()), retry: () => startLevel(def) };
}
function showOut() {
  const make = () => outCard({
    def, line: LINES.pick(LINES.OUT), face: FACE,
    onRetry: () => startLevel(def),
    onUndo: () => { closeCard(); undo(); },
    onLevels: () => openSelect(),
  });
  showCard('out', make, 'Out of epochs');
  openCard.keys = { primary: () => startLevel(def), retry: () => startLevel(def), undo: () => { closeCard(); undo(); } };
}

// ---------- cards over the game (the kit's layer) ----------
function showCard(kind, make, label) {
  const node = make();
  openCard = { kind, make, label, keys: {} };
  shell.card(node, { label });
  shell.pausable(false);
}
function reshowCard() {
  if (!openCard) return;
  const keys = openCard.keys;
  shell.card(openCard.make(), { label: openCard.label });
  openCard.keys = keys;
  shell.pausable(false);
}
function closeCard() {
  if (!openCard) return;
  openCard = null;
  shell.closeCard();
  if (mode === 'play') shell.pausable(true);
}

// ---------- the level select ----------
function openSelect() {
  const current = (def && mode === 'play' ? def : nextUnsolved()).id;
  const make = () => {
    const { card, focusMe } = levelSelect({
      worlds: WORLDS, levels: LEVELS, progress: progress(), unlocked, current, touch: TOUCH, padOn,
      onPick: (l, ok) => { if (!ok) { sfx.bump(); shell.toast('Solve the one before it first', 'warn', 1400); return; } sfx.select(); startLevel(l); },
      onClose: () => closeSelect(),
      onPad: (v) => { padOn = v; store.update((s) => { s.pad = v; }); relayout(); },
    });
    requestAnimationFrame(() => focusMe?.scrollIntoView?.({ block: 'nearest' }));
    return card;
  };
  showCard('select', make, 'Levels');
  openCard.keys = { primary: () => { const l = levelById(current); if (l && unlocked(l)) startLevel(l); } };
}
function closeSelect() {
  closeCard();
  if (mode === 'play' && run && (run.status === 'won' || run.status === 'out')) toTitle();
}

// ---------- the title: a level playing its own solution behind the logo ----------
function toTitle() {
  closeCard();
  mode = 'title';
  ui.hidden = true;
  shell.audio.stopMusic();
  const pool = LEVELS.filter((l) => ['1-6', '2-4', '3-5', '5-1', '5-2', '3-3', '4-6'].includes(l.id));
  startAuto(pool[Math.floor(Math.random() * pool.length)], { title: true });
  const p = progress();
  const stars = LEVELS.reduce((s, l) => s + (p[l.id]?.stars || 0), 0);
  const solved = LEVELS.filter((l) => p[l.id]?.stars > 0).length;
  shell.title({
    logo: ['EPOCHS'],
    tagline: TAGLINE,
    play: solved ? 'Levels' : 'Play',
    best: stars || null, bestLabel: 'Stars',
    extra: solved ? el('p', 'ep-record', `${solved}/${LEVELS.length} solved`) : null,
    onPlay: () => { sfx.select(); if (!solved) startLevel(LEVELS[0]); else openSelect(); },
  });
}

// the levels' own solutions, played with nice pacing: the title's background, and the demo
class Autoplayer {
  constructor(d, { pace = 0.3, fromEpoch = 1, startAt = 0, title = false } = {}) {
    this.def = d; this.pace = pace; this.title = title;
    loadLevel(d, { epochs: d.sol.slice(0, fromEpoch - 1) });
    this.epoch = fromEpoch - 1;   // index into sol
    this.i = 0;
    this.wait = 0;
    this.startAt = startAt;       // performance.now() (s) to start moving (the demo's clock)
    this.done = false;
  }
  update(dt) {
    if (this.done || !run) return;
    if (this.startAt && performance.now() / 1000 < this.startAt) return;
    if (scene.rewind > 0) return;
    this.wait -= dt;
    if (this.wait > 0) return;
    const sol = this.def.sol;
    if (run.status === 'won') { this.done = true; return; }
    const moves = sol[this.epoch];
    if (this.i < moves.length) {
      step(moves[this.i]);
      this.i++;
      this.wait = this.pace;
      return;
    }
    // this epoch's moves are done: the next one (with the rewind)
    if (this.epoch + 1 < sol.length) {
      this.epoch++; this.i = 0;
      newEpoch(true);
      this.wait = 0.25;
    } else this.done = true;
  }
}
let demoN = 0, autoT = 0;
const DEMO_LEVELS = ['3-5', '5-1', '2-4', '3-3', '1-6', '5-5', '4-6', '3-6'];
function startAuto(d, { title = false, demo = false } = {}) {
  mode = demo ? 'demo' : 'title';
  const first = demo && demoN === 0;
  // the demo starts each level in its last epoch (its echoes already there), the title from the first
  auto = new Autoplayer(d, {
    pace: demo ? 0.26 : 0.34,
    fromEpoch: demo ? d.sol.length : 1,
    startAt: first ? 5.55 : 0,
    title,
  });
  if (demo && !first) { scene.startRewind(run.epoch); }
  autoT = 0;
  relayout();
}
function nextDemo() {
  demoN++;
  const r = rng((SEED || 7) + demoN);
  const id = demoN < DEMO_LEVELS.length ? DEMO_LEVELS[demoN] : DEMO_LEVELS[1 + Math.floor(r.next() * (DEMO_LEVELS.length - 1))];
  startAuto(levelById(id), { demo: true });
}

// ---------- touch and mouse on the board ----------
function boardCell(px, py) {
  const g = scene.geo;
  return { x: (px - g.x0) / g.s - 0.5, y: (py - g.y0) / g.s - 0.5 };
}
function towards(px, py) {
  if (!run) return null;
  const W = run.world, p = W.bp[W.n - 1];
  const at = boardCell(px, py + scene.geo.s * 0.25);
  const dx = at.x - (p % L.w), dy = at.y - ((p / L.w) | 0);
  if (Math.abs(dx) < 0.6 && Math.abs(dy) < 0.75) return 'W';
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : (dy > 0 ? 'D' : 'U');
}
pointer(canvas, {
  tap(p) { if (!playing()) return; shell.audio.unlock(); const d = towards(p.x, p.y); if (d) doMove(d); },
  swipe(p, dir) { if (!playing()) return; doMove({ up: 'U', down: 'D', left: 'L', right: 'R' }[dir]); },
  hover(p) {
    if (!playing() || p.type !== 'mouse' || !ready()) { canvas.style.cursor = ''; return; }
    canvas.style.cursor = 'pointer';
  },
});

// ---------- keys (on the capture side: a card's keys first, and Esc never pauses over a card) ----------
const DIRKEY = { ArrowUp: 'U', ArrowDown: 'D', ArrowLeft: 'L', ArrowRight: 'R', w: 'U', s: 'D', a: 'L', d: 'R', W: 'U', S: 'D', A: 'L', D: 'R' };
addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target?.closest?.('input, textarea, select')) return;
  const k = e.key;
  if (openCard) {
    const onButton = e.target?.closest?.('button, a');
    if (k === 'Escape' || (k === 'p' || k === 'P')) {
      e.preventDefault();
      if (openCard.kind === 'select') closeSelect();
      else if (k === 'Escape') { if (openCard.kind === 'solved' || openCard.kind === 'out') openSelect(); }
      return;
    }
    if ((k === 'Enter' || k === ' ') && !onButton && !e.repeat) { e.preventDefault(); openCard.keys.primary?.(); return; }
    if ((k === 'r' || k === 'R') && !e.repeat && openCard.keys.retry) { e.preventDefault(); openCard.keys.retry(); return; }
    if ((k === 'z' || k === 'Z') && !e.repeat && openCard.keys.undo) { e.preventDefault(); openCard.keys.undo(); return; }
    return;
  }
  if (mode !== 'play' || shell.state !== 'play') return;
  if (DIRKEY[k]) { e.preventDefault(); if (e.repeat) return; doMove(DIRKEY[k]); held = { dir: DIRKEY[k], key: k, next: now + 0.24 }; return; }
  if (k === ' ') { e.preventDefault(); if (!e.repeat) doMove('W'); return; }
  if (e.repeat) return;
  if (k === 'z' || k === 'Z' || k === 'Backspace') { e.preventDefault(); undo(); }
  else if (k === 'e' || k === 'E') { e.preventDefault(); act('epoch'); }
  else if (k === 'R') { e.preventDefault(); restartLevel(); }
  else if (k === 'r') { e.preventDefault(); retryEpoch(); }
  else if (k === 'l' || k === 'L') { e.preventDefault(); openSelect(); }
}, { capture: true });
addEventListener('keyup', (e) => { if (held && (DIRKEY[e.key] === held.dir)) held = null; });
addEventListener('blur', () => { held = null; });

// ---------- the loop ----------
const loop = createLoop({
  update(dt) {
    now += dt;
    if (mode === 'play' && shell.state === 'play') {
      if (held && ready() && now >= held.next) { doMove(held.dir); held.next = now + 0.14; }
      if (queued && ready()) { const q = queued; queued = null; doMove(q); }
      if (pendingEpoch >= 0) { pendingEpoch -= dt; if (pendingEpoch < 0) { pendingEpoch = -1; newEpoch(true); } }
      if (celebrate >= 0) celebrate += dt;
    }
  },
  render(alpha, frameDt) {
    const g = view.begin();
    // the room around the board: deep navy, a big faint blueprint grid, a vignette
    g.fillStyle = C.bg; g.fillRect(0, 0, view.w, view.h);
    drawBackdrop(g);
    if (!L) return;
    if (!scene.geo) relayout();
    if (mode === 'title' || mode === 'demo') {
      auto?.update(frameDt);
      if (auto?.done) {
        autoT += frameDt;
        if (autoT > (mode === 'demo' ? 1.15 : 1.6)) {
          if (mode === 'demo') nextDemo();
          else { const pool = ['1-6', '2-4', '3-5', '5-1', '5-2', '3-3', '4-6']; startAuto(levelById(pool[Math.floor(Math.random() * pool.length)]), { title: true }); }
        }
      }
    }
    if (mode !== 'play' || shell.state === 'play') scene.update(Math.min(frameDt, 0.05));
    if (mode === 'play' && wasRewinding && scene.rewind <= 0) syncHud();
    wasRewinding = scene.rewind > 0;
    scene.draw(g, view, {
      dim: mode === 'title' ? 0.5 : 0,
      quiet: mode === 'title',
      hud: mode === 'demo' ? { id: def.id, name: def.name, K: L.K, epoch: run.epoch, T: L.T, t: run.t } : null,
    });
  },
  paused: () => false,
});

// a big faint grid behind everything, drawn once per size
let backdrop = null;
function drawBackdrop(g) {
  const w = view.w, h = view.h, dpr = view.dpr;
  if (!backdrop || backdrop.w !== w || backdrop.h !== h || backdrop.dpr !== dpr) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * dpr); c.height = Math.ceil(h * dpr);
    const x = c.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    const grd = x.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.1, w / 2, h / 2, Math.max(w, h) * 0.75);
    grd.addColorStop(0, '#191536'); grd.addColorStop(1, '#0b0919');
    x.fillStyle = grd; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(120,140,255,0.055)'; x.lineWidth = 1;
    x.beginPath();
    const step = 28;
    for (let gx = (w / 2) % step; gx < w; gx += step) { x.moveTo(Math.round(gx) + 0.5, 0); x.lineTo(Math.round(gx) + 0.5, h); }
    for (let gy = (h / 2) % step; gy < h; gy += step) { x.moveTo(0, Math.round(gy) + 0.5); x.lineTo(w, Math.round(gy) + 0.5); }
    x.stroke();
    x.strokeStyle = 'rgba(120,140,255,0.09)';
    x.beginPath();
    for (let gx = (w / 2) % (step * 4); gx < w; gx += step * 4) { x.moveTo(Math.round(gx) + 0.5, 0); x.lineTo(Math.round(gx) + 0.5, h); }
    for (let gy = (h / 2) % (step * 4); gy < h; gy += step * 4) { x.moveTo(0, Math.round(gy) + 0.5); x.lineTo(w, Math.round(gy) + 0.5); }
    x.stroke();
    backdrop = { c, w, h, dpr };
  }
  g.drawImage(backdrop.c, 0, 0, w, h);
}

// QA (`?qa`): a handle for the screenshot scripts; never on a link from the site
if (QUERY.has('qa')) {
  window.__ep = {
    get run() { return run; }, get scene() { return scene; }, get mode() { return mode; },
    start(id) { startLevel(levelById(id)); },
    // play a level's reference solution quickly (all epochs but the last, then the last up to `upto` moves)
    solve(id, upto = Infinity) {
      startLevel(levelById(id));
      const sol = def.sol;
      for (let e = 0; e < sol.length; e++) {
        if (e > 0) newEpoch(true);
        const moves = e === sol.length - 1 ? sol[e].slice(0, upto) : sol[e];
        for (const ch of moves) { const ev = run.step(codeOf(ch)); scene.sync(run.world, { instant: true }); scene.react(ev || []); afterTick(ev || []); }
      }
      for (const b of scene.bodies) b.spawn = 1;
      scene.rewind = 0;
      syncHud();
    },
    unlockAll() { store.update((s) => { s.levels ||= {}; for (const l of LEVELS) s.levels[l.id] ||= { stars: 1 + (l.index % 3), epochs: 9, ticks: 99 }; }); },
    select() { openSelect(); },
  };
}

// the canvas's words wait for the arcade's fonts (never longer than a moment)
const fonts = Promise.all(["900 40px 'AK Display'", "800 16px 'AK Mono'"].map((f) => document.fonts?.load(f).catch(() => null)));
Promise.race([fonts, new Promise((r) => setTimeout(r, 1800))]).then(() => {
  if (DEMO) { startAuto(levelById(DEMO_LEVELS[0]), { demo: true }); }
  else toTitle();
  loop.start();
});
