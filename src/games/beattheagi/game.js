// BEAT THE AGI on agi1.app (2026-11-08): Four in a row. From 1B to AGI.
// Four in a row against AGI-1 on the arcade kit, up a ladder of six of her (1B, 7B, 13B, 70B, 400B, AGI), each
// unlocked by beating the one before, and pass & play for two people on one screen. While she thinks, her attention
// shows over the columns as bars that sharpen as she looks deeper ("depth 7 · 8 · 9"), and her portrait reacts.
// This file wires the kit's frame, the input, the loop, her brain (./brain.js: a Web Worker for the big models) and
// the ways it runs: your games, the title's quiet game, and ?demo (the arcade's preview: two of her playing, seeded,
// silent, forever).
import './style.css';
import { createShell, el } from '../kit/shell.js';
import { fitCanvas } from '../kit/canvas.js';
import { createLoop } from '../kit/loop.js';
import { pointer, keyboard } from '../kit/input.js';
import { Particles, Shake, FloatText, rng } from '../kit/fx.js';
import { DEMO, SEED, TOUCH, REDUCED, QUERY } from '../kit/env.js';
import { Match } from './match.js';
import { createBrain } from './brain.js';
import { createRenderer } from './render.js';
import { layout, columnAt } from './layout.js';
import { createSfx, createMusic } from './sound.js';
import { say, shareText, LINES } from './lines.js';
import { LEVELS, TOP } from './levels.js';
import { readSave, recordResult, firstMover, record, fromPicture, PINK, MINT, other, count } from './rules.js';
import { ladderCard, resultCard, miniLadder, undoButton } from './ui.js';
import { DEMO_OPENINGS, DEMO_LEVELS, ATTRACT_OPENINGS, demoClock } from './demo.js';
import { C as COL } from './art.js';

const root = document.getElementById('ak-root');
const shell = createShell({
  game: 'beattheagi', name: 'BEAT THE AGI', root,
  howTo: {
    intro: 'Drop stones into the board. Four of yours in a row, across, up or on a diagonal, wins.',
    steps: [
      ['Drop a stone', 'Tap or click a column: your pink stone falls to the lowest free hole.'],
      ['Make four, stop hers', 'Block her lines and build your own. Two threats at once and she can only stop one.'],
      ['Watch her think', 'The bars over the columns show where she is looking. Taller means she likes it more.'],
      ['Climb the ladder', 'Beat each AGI-1 once to unlock the next: 1B, 7B, 13B, 70B, 400B, then AGI.'],
    ],
    touch: [['Tap a column', 'Drop a stone'], ['Drag sideways', 'Aim, then let go to drop']],
    keys: [['← →', 'Choose a column'], ['1 – 7', 'Jump to a column'], ['↓ Space Enter', 'Drop'], ['U', 'Undo (pass & play)'], ['Esc P', 'Pause']],
  },
  onRestart: () => restart(),
  onQuit: () => toTitle(),
});

const canvas = el('canvas', { role: 'img', 'aria-label': 'BEAT THE AGI: a four-in-a-row board, seven columns of six holes, against AGI-1' });
const safe = el('div', { class: 'bt-safe', 'aria-hidden': 'true' });
const live = el('p', { class: 'ak-sr', 'aria-live': 'polite' });
const undoBtn = undoButton(() => doUndo());
shell.stage.classList.add('bt-stage');
shell.stage.append(canvas, safe, live, undoBtn);

let view = null;
view = fitCanvas(canvas, { maxDpr: 2, onResize: () => relayout() });
const renderer = createRenderer({ reduced: REDUCED });
const brain = createBrain();
const sfx = createSfx(shell.audio);
const music = createMusic();
const parts = new Particles(320);
const floats = new FloatText();
const shake = new Shake({ max: 9, decay: 2.2 });
const levelChip = shell.chip('Level', '1B');
const recordChip = shell.chip('Record', '0-0-0');
const ppChip = shell.chip('Pink · Mint', '0 · 0');
ppChip.hide();

let save = readSave(shell.store.read());
let mode = 'boot';            // title · ladder · pp · demo
let M = null;                 // the game on the board
let attract = null;           // the title's quiet game
let L = null;
let Lt = null;                // the title's layout: the quiet game's board centred behind the words
let t = 0;
let glitchT = 0;
let ladderOpen = false, resultUp = false, lastCard = null;
let ppFirst = PINK;
let demoIndex = 0, demoGames = 0;
let keyCol = -1;
// the dice: seeded with ?seed= (the demo: 7), otherwise with a fresh number for this visit; every game gets its own seed
// from them, and her moves, her words and her reactions all come from seeded dice
const visit = (() => { try { return crypto.getRandomValues(new Uint32Array(1))[0]; } catch { return Date.now() >>> 0; } })();
const roll = rng(SEED || (DEMO ? 7 : visit));
const die = () => roll.next();
const pick = (list) => list[Math.floor(die() * list.length)];
const newSeed = () => ((roll.next() * 2 ** 31) >>> 0) || 1;
const agiBudget = () => (TOUCH ? 700 : 1100);
let saveVersion = 0;
const persist = () => { saveVersion++; shell.store.write(JSON.parse(JSON.stringify(save))); };

// ---------- the layout: clear of the kit's bar and the notch ----------
function insets() {
  if (DEMO) return { top: 10, right: 10, bottom: 10, left: 10 };
  const cs = getComputedStyle(safe);
  const px = (v) => parseFloat(v) || 0;
  const bar = shell.bar.getBoundingClientRect();
  const st = canvas.getBoundingClientRect();
  return { top: Math.max(bar.bottom - st.top, px(cs.paddingTop)) + 6, right: px(cs.paddingRight) + 10, bottom: px(cs.paddingBottom) + 10, left: px(cs.paddingLeft) + 10 };
}
function relayout() {
  if (!view?.w) return;
  L = layout(view.w, view.h, insets(), { demo: DEMO });
  Lt = layout(view.w, view.h, insets(), { demo: true });
  recordChip.hide(view.w < 400 || mode === 'pp');
  placeUndo();
}
function placeUndo() {
  if (!L || !L.status) return;
  const w = 116, h = 44;
  let x, y;
  // under the status pill (a tall screen has room there in pass & play: no ladder strip), or beside it if not
  x = L.status.x - w / 2; y = L.status.y + L.status.h / 2 + 12;
  if (y + h > view.h - 8) { x = L.board.x + L.board.w - w; y = L.status.y - h / 2; }
  undoBtn.style.left = `${Math.round(x)}px`;
  undoBtn.style.top = `${Math.round(y)}px`;
}

// ---------- her hooks ----------
function hooksFor(kind) {
  const loud = kind === 'play';
  return {
    think: (req) => brain.think({ ...req, budget: agiBudget() }),
    sfx: (name, ...a) => { if (loud) sfx[name]?.(...a); },
    shake: (k) => { if (kind !== 'attract') shake.kick(k); },
    haptic: (ms) => { if (loud) shell.haptic(ms); },
    line: (k, level, vars) => say(k, level, pick, vars),
    toast: (text, tone) => { if (loud) shell.toast(text, tone, 1700); },
    announce: (text) => { if (loud) live.textContent = text; },
    confetti: (who) => { if (kind !== 'attract') confetti(who); },
    glitch: () => { if (kind !== 'attract') glitchT = 0.7; },
    chance: (p) => die() < p,
    land: (col, row, who, rows) => { if (kind !== 'attract') landRing(col, row, who, rows); },
    float: (text, col, who, big) => { if (kind !== 'attract') callout(text, col, who, big); },
    ended: (result) => (kind === 'play' ? gameOver(result) : kind === 'demo' ? nextDemo() : startAttract()),
  };
}

function confetti(who) {
  if (!L || !M?.line) return;
  const Cc = L.C;
  const colors = who === PINK ? [COL.pink, COL.honey, COL.paper, COL.mint, COL.lav2] : [COL.mint, COL.paper, COL.honey];
  for (const i of M.line) {
    const x = L.cx(i % 7), y = L.cy((i / 7) | 0);
    parts.burst({ x, y, count: 14, speed: [Cc * 2, Cc * 7], life: [0.6, 1.3], size: [Cc * 0.08, Cc * 0.18], colors, gravity: Cc * 14, drag: 1.6, shape: 'square', spin: 9, stroke: null });
    parts.burst({ x, y, count: 3, speed: [Cc * 1, Cc * 4], life: [0.7, 1.2], size: [Cc * 0.14, Cc * 0.22], colors: [COL.honey, COL.paper], gravity: Cc * 8, shape: 'star', spin: 4 });
  }
  if (who === PINK || M.mode === 'pp') {
    for (let k = 0; k < 2; k++) {
      parts.burst({ x: view.w * (k ? 0.85 : 0.15), y: L.board.y - Cc, count: 26, angle: [k ? Math.PI * 1.05 : -Math.PI * 0.45, k ? Math.PI * 1.45 : -Math.PI * 0.05],
        speed: [Cc * 5, Cc * 11], life: [1.0, 1.8], size: [Cc * 0.08, Cc * 0.16], colors, gravity: Cc * 12, drag: 1.2, shape: 'square', spin: 10 });
    }
  }
}

// a ring where a stone lands (bigger the further it fell), and a word over the board
function landRing(col, row, who, rows) {
  if (!L) return;
  const color = who === PINK ? COL.pink : COL.mint;
  parts.burst({ x: L.cx(col), y: L.cy(row), count: 1, speed: [0, 0], life: [0.32, 0.32], size: [L.C * (0.5 + rows * 0.04), L.C * (0.5 + rows * 0.04)], colors: [color], shape: 'ring', drag: 0 });
}
function callout(text, col, who, big = false) {
  if (!L) return;
  const color = who === PINK ? (big ? COL.honey : COL.pink) : COL.mint;
  const x = Math.max(L.board.x + L.C * 1.6, Math.min(L.board.x + L.board.w - L.C * 1.6, L.cx(col)));
  floats.add({ x, y: L.board.y + L.C * (big ? 1.4 : 1.1), text: text.toUpperCase(), color, size: L.C * (big ? 0.5 : 0.4), life: big ? 1.5 : 1.15, rise: L.C * 0.9 });
}

// ---------- a game against her (the ladder) ----------
function playLevel(level, { rematch = false } = {}) {
  closeCards();
  save = readSave(save);
  save.level = Math.max(0, Math.min(save.unlocked, level));
  let first = firstMover(save, { rematch });
  if (save.starter === 'swap') first = save.lastFirst === 'you' ? 'her' : 'you';
  save.lastFirst = first;
  persist();
  stopAttract();
  brain.newGame();
  parts.clear(); floats.clear(); glitchT = 0;
  const fresh = !LEVELS.some((x) => { const st = save.stats[x.id]; return st.w + st.d + st.l > 0; });
  M = new Match({ mode: 'ladder', level: save.level, turn: first === 'you' ? PINK : MINT, seed: newSeed(), hooks: hooksFor('play'), coach: fresh });
  mode = 'ladder';
  shell.started();
  shell.audio.music(music);
  showChips();
  undoBtn.hidden = true;
  keyCol = -1;
  if (save.level >= 3) brain.warm();
  M.greet();
  M.start();
  live.textContent = `A new game against AGI-1 at ${LEVELS[save.level].id}. ${first === 'you' ? 'You start.' : 'She starts.'}`;
}
function restart() {
  if (mode === 'pp') playPP({ swap: false });
  else playLevel(save.level, { rematch: true });
}
function showChips() {
  const pp = mode === 'pp';
  levelChip.hide(pp); recordChip.hide(pp || view.w < 400); ppChip.hide(!pp);
  if (!pp) {
    const st = save.stats[LEVELS[save.level].id];
    levelChip.set(LEVELS[save.level].id);
    recordChip.set(record(st));
  }
}

function gameOver(result) {
  if (mode === 'pp') return ppOver(result);
  const level = M.level;
  const r = recordResult(save, level, result);
  save = r.save;
  persist();
  showChips();
  shell.audio.stopMusic();
  let line;
  if (r.firstAgi) line = LINES.firstAgi;
  else if (r.promoted) line = `${say('yourWin', level, pick)}`;
  else if (result === 'win') line = say('yourWin', level, pick);
  else if (result === 'loss') line = say('herWin', level, pick);
  else line = say('draw', level, pick);
  const yours = M.history.filter((h) => h.who === PINK).length;
  const st = r.stats;
  const stats = [
    [`Record at ${LEVELS[level].id}`, record(st)],
    ['Win streak', `${st.streak}${st.best > st.streak ? ` (best ${st.best})` : ''}`],
    ['Your stones', String(yours)],
    ['Her deepest look', level <= 1 || !M.deepest ? 'one glance' : `${M.deepest} moves`],
  ];
  // the shell's end state (Enter, Space or R: a rematch; no pause), with this game's own card on top
  shell.over({ score: null, title: 'Game over', onAgain: () => playLevel(level, { rematch: true }), onMenu: () => toTitle() });
  resultUp = true;
  shell.card(lastCard = resultCard({
    mode: 'ladder', result, level, save, promoted: r.promoted, next: r.next, firstAgi: r.firstAgi, line, stats,
    share: shareText(result, level),
    onRematch: () => playLevel(level, { rematch: true }),
    onNext: (n) => playLevel(n),
    onLadder: () => openLadder(),
    onMenu: () => toTitle(),
  }), { label: `${result === 'win' ? 'You win' : result === 'loss' ? 'AGI-1 wins' : 'A draw'} at ${LEVELS[level].id}` });
  if (r.promoted || r.firstAgi) setTimeout(() => sfx.promote(), 280);
  live.textContent = `${result === 'win' ? 'You win' : result === 'loss' ? 'AGI-1 wins' : 'A draw'}. ${r.promoted ? `${LEVELS[r.next].id} unlocked.` : ''}`;
}

// ---------- pass & play ----------
function playPP({ swap = false } = {}) {
  closeCards();
  stopAttract();
  if (swap) ppFirst = other(ppFirst);
  parts.clear(); floats.clear(); glitchT = 0;
  M = new Match({ mode: 'pp', turn: ppFirst, seed: newSeed(), hooks: hooksFor('play') });
  mode = 'pp';
  shell.started();
  shell.audio.music(music);
  showChips();
  ppChip.set(`${save.pp.pink} · ${save.pp.mint}`);
  undoBtn.hidden = false;
  relayout();
  M.greet();
  M.start();
  live.textContent = `Pass and play. ${ppFirst === PINK ? 'Pink' : 'Mint'} starts.`;
}
function ppOver(result) {
  if (result === 'pink') save.pp.pink++; else if (result === 'mint') save.pp.mint++; else save.pp.draws++;
  persist();
  ppChip.set(`${save.pp.pink} · ${save.pp.mint}`);
  shell.audio.stopMusic();
  undoBtn.hidden = true;
  const line = result === 'draw' ? say('ppDraw', 0, pick) : say('ppWin', 0, pick, { who: result });
  shell.over({ score: null, title: 'Game over', onAgain: () => playPP({ swap: true }), onMenu: () => toTitle() });
  resultUp = true;
  shell.card(resultCard({
    mode: 'pp', result, level: 0, save, line,
    stats: [['Pink wins', String(save.pp.pink)], ['Mint wins', String(save.pp.mint)], ['Draws', String(save.pp.draws)], ['Stones', String(count(M.cells))]],
    onRematch: () => playPP({ swap: true }), onMenu: () => toTitle(),
  }), { label: result === 'draw' ? 'A draw' : `${result === 'pink' ? 'Pink' : 'Mint'} wins` });
}
function doUndo() {
  if (mode !== 'pp' || shell.state !== 'play' || !M) return;
  if (!M.undo()) sfx.nope();
}

// ---------- the title, its quiet game, the ladder card ----------
function toTitle() {
  mode = 'title';
  closeCards();
  shell.audio.stopMusic();
  undoBtn.hidden = true;
  M = null;
  parts.clear(); floats.clear(); glitchT = 0;
  if (!attract) startAttract();
  save = readSave(shell.store.read());
  // her big models think in a worker: start it (and warm it up) while the player reads the title
  if (save.unlocked >= 3) setTimeout(() => { if (mode === 'title') brain.warm(); }, 1200);
  const beaten = LEVELS.filter((x) => save.stats[x.id].w > 0).length;
  shell.title({
    logo: ['BEAT', { text: 'THE AGI', tone: 'mint' }],
    tagline: 'Four in a row. From 1B to AGI.',
    play: `Play ${LEVELS[save.level].id}`,
    onPlay: () => playLevel(save.level),
    modes: [
      { label: 'Ladder', sub: beaten ? `${beaten} of ${LEVELS.length} beaten` : 'Six of her to beat', onClick: () => openLadder() },
      { label: 'Pass & play', sub: 'Two players, one screen', onClick: () => playPP() },
    ],
    extra: miniLadder(save),
    best: null,
  });
}
function startAttract() {
  const o = pick(ATTRACT_OPENINGS);
  attract = new Match({
    mode: 'attract', level: 3, pinkLevel: 2, cells: fromPicture(o.pic), turn: o.turn === 'x' ? PINK : MINT,
    seed: newSeed(), hooks: hooksFor('attract'), pace: { think: 1.7, aim: 2.2 },
  });
  attract.start();
}
function stopAttract() { attract = null; }

function openLadder() {
  save = readSave(shell.store.read());
  ladderOpen = true;
  shell.card(ladderCard(save, {
    onPick: (i) => { ladderOpen = false; playLevel(i); },
    onStarter: (v) => { save.starter = v; persist(); },
    onClose: () => closeLadder(),
  }), { label: 'The ladder' });
}
function closeLadder() {
  ladderOpen = false;
  if (shell.state === 'title') { toTitle(); return; }
  // back from the ladder to the end of the game's card
  if (shell.state === 'over' && lastCard) { shell.card(lastCard, { label: 'Game over' }); return; }
  shell.closeCard();
}
function closeCards() { ladderOpen = false; resultUp = false; }

// ---------- the demo (?demo): 13B playing "you" against her at 400B, from a board that ends in the preview's window ----------
let demoWait = 0;
function startDemo() {
  const op = DEMO_OPENINGS[(demoIndex + (SEED || 7)) % DEMO_OPENINGS.length];
  demoIndex++;
  parts.clear(); floats.clear(); glitchT = 0;
  M = new Match({
    mode: 'demo', level: DEMO_LEVELS.her, pinkLevel: DEMO_LEVELS.you, cells: fromPicture(op.pic), turn: op.turn === 'x' ? PINK : MINT, seed: op.seed,
    hooks: hooksFor('demo'),
  });
  mode = 'demo';
  M.gx = 3;
  demoWait = 0;
  if (demoGames++ === 0) {
    // the first game runs on the page's clock: the think in which she finds her win starts as the preview's recording
    // does, and her four lands a few seconds later (demo.js: demoClock)
    const clock = demoClock(op);
    M.speed = clock.speed;
    const since = (typeof performance !== 'undefined' ? performance.now() : 0) / 1000;
    if (clock.start > since) { demoWait = clock.start - since; return; }
    M.start();
    M.advance(since - clock.start);
    return;
  }
  M.start();
}
function nextDemo() { startDemo(); }

// ---------- touch and mouse ----------
const playing = () => (mode === 'ladder' || mode === 'pp') && shell.state === 'play' && M;
let dragId = null;
function aimAt(c, sound = true) {
  if (!M || c === M.hover) return;
  M.hover = c;
  if (c >= 0 && sound && M.canInput) sfx.hover(c);
}
pointer(canvas, {
  down(p) {
    if (!playing() || dragId != null) return;
    const c = columnAt(L, p.x, p.y);
    if (c < 0) return;
    dragId = p.id;
    keyCol = -1;
    aimAt(c);
  },
  move(p) {
    if (p.id !== dragId || !playing()) return;
    const c = columnAt(L, p.x, p.y);
    if (c >= 0) aimAt(c);
  },
  up(p) {
    if (p.id !== dragId) return;
    dragId = null;
    if (!playing()) return;
    const type = p.event?.type;
    if (type === 'pointercancel' || type === 'lostpointercapture') return;
    const c = columnAt(L, p.x, p.y);
    if (c < 0) { if (p.type !== 'mouse') M.hover = -1; return; }
    M.tryDrop(c);
    if (p.type !== 'mouse') setTimeout(() => { if (M && M.phase !== 'input' && dragId == null) M.hover = -1; }, 0);
  },
  hover(p) {
    if (!playing() || p.type !== 'mouse') return;
    const c = columnAt(L, p.x, p.y);
    if (c >= 0) keyCol = -1;
    aimAt(c);
    canvas.style.cursor = c >= 0 && M.canInput ? 'pointer' : '';
  },
});
canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && M && keyCol < 0 && dragId == null) M.hover = -1; });

// ---------- the keyboard ----------
keyboard({
  ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowDown: 'drop', s: 'drop', ' ': 'drop', Enter: 'drop',
  1: 'c0', 2: 'c1', 3: 'c2', 4: 'c3', 5: 'c4', 6: 'c5', 7: 'c6', u: 'undo',
}, {
  blocked: () => !playing(),
  down(name, e) {
    if (e.target?.closest?.('button, a')) return;
    if (name === 'undo') { doUndo(); return; }
    const cur = M.hover >= 0 ? M.hover : 3;
    if (name === 'left' || name === 'right') {
      const c = M.hover < 0 ? 3 : Math.max(0, Math.min(6, cur + (name === 'left' ? -1 : 1)));
      keyCol = c; aimAt(c);
      return;
    }
    if (name[0] === 'c') { const c = Number(name.slice(1)); keyCol = c; aimAt(c); return; }
    if (name === 'drop') {
      if (M.hover < 0) { keyCol = 3; aimAt(3); return; }
      M.tryDrop(M.hover);
    }
  },
});
// keys while a card of ours is up: Esc closes the ladder; Enter / Space / R don't start a game behind it
addEventListener('keydown', (e) => {
  if (!ladderOpen) return;
  if (e.key === 'Escape') { e.preventDefault(); closeLadder(); return; }
  if ((e.key === 'Enter' || e.key === ' ' || e.key === 'r' || e.key === 'R') && !e.target?.closest?.('button, a')) e.preventDefault();
}, { capture: true });

// the ladder's chips in the game: where you are (made again only when the save changes)
let ladderKey = -1, ladderVal = null;
function ladderInfo(current) {
  const key = saveVersion * 8 + current;
  if (key !== ladderKey) { ladderKey = key; ladderVal = { unlocked: save.unlocked, current, beaten: LEVELS.map((x) => save.stats[x.id].w > 0) }; }
  return ladderVal;
}

// the title's scrim: darkest where the words are, the board's edges showing around them
let scrim = null, scrimKey = '';
function titleScrim(g) {
  const key = `${view.w}x${view.h}`;
  if (scrimKey !== key) {
    scrimKey = key;
    const r = Math.max(view.w, view.h) * 0.62;
    scrim = g.createRadialGradient(view.w / 2, view.h * 0.5, r * 0.15, view.w / 2, view.h * 0.5, r);
    scrim.addColorStop(0, 'rgba(14,6,34,0.86)');
    scrim.addColorStop(0.55, 'rgba(14,6,34,0.74)');
    scrim.addColorStop(1, 'rgba(14,6,34,0.5)');
  }
  return scrim;
}

// ---------- the loop ----------
function step(dt) {
  t += dt;
  const m = mode === 'title' ? attract : M;
  if (mode === 'demo' && demoWait > 0) {
    // the board waits (the intro covers most of it), then the game starts on time
    demoWait -= dt;
    if (demoWait <= 0) { M.start(); M.advance(-demoWait); demoWait = 0; }
  } else m?.update(dt);
  parts.update(dt);
  floats.update(dt);
  shake.update(dt);
  if (glitchT > 0) glitchT = Math.max(0, glitchT - dt);
}
const loop = createLoop({
  update(dt) { if (mode !== 'title') step(dt); },
  render(alpha, frameDt) {
    const st = shell.state;
    if (!DEMO && (st === 'title' || st === 'over' || st === 'menu' || mode === 'title')) step(frameDt);
    const g = view.begin();
    if (!L) relayout();
    if (!L) return;
    const m = mode === 'title' ? attract : M;
    if (!m) return;
    const levelLabel = m.mode === 'pp' ? 'host' : LEVELS[m.level].id;
    if (mode === 'title') {
      // the quiet game, dimmed behind the title
      renderer.draw(g, view, Lt, m, { t, levelLabel, title: true });
      g.fillStyle = titleScrim(g);
      g.fillRect(0, 0, view.w, view.h);
      return;
    }
    renderer.draw(g, view, L, m, {
      t, levelLabel, shake, parts, floats, glitch: glitchT / 0.7, demo: DEMO, coachText: TOUCH ? 'Tap a column' : 'Click a column',
      ladder: m.mode === 'ladder' ? ladderInfo(m.level) : null,
    });
  },
  paused: () => shell.state !== 'play' && !DEMO,
});

// QA (`?qa`): a handle for the screenshot scripts; never on a link from the site
if (QUERY.has('qa')) {
  window.__bt = {
    get M() { return M; }, get L() { return L; }, get save() { return save; }, brain,
    stage(pic, turn = 'x') { M.fall = null; M.hidden = -1; M.think = null; M.cells = fromPicture(pic); M.turn = turn === 'x' ? PINK : MINT; M.nextTurn(); },
    unlock(n) { save.unlocked = n; save.level = n; persist(); },
  };
}

// the canvas's words wait for the arcade's fonts (never longer than a moment)
const fonts = Promise.all(["900 40px 'AK Display'", "700 16px 'AK Mono'", "italic 400 18px 'AK Serif'"].map((f) => document.fonts?.load(f).catch(() => null)));
Promise.race([fonts, new Promise((r) => setTimeout(r, 1800))]).then(() => {
  relayout();
  if (DEMO) startDemo(); else toTitle();
  loop.start();
});
