// BLOCKCHAIN on agi1.app (2026-11-08): Place blocks. Clear lines. Keep the chain alive.
// An 8 × 8 block puzzle on the arcade kit: drag one of three pieces onto the board (touch, mouse, or 1 2 3 + arrows +
// Space), fill rows and columns to clear them, and keep clearing to grow the CHAIN. This file wires the kit's frame
// (./../kit/shell.js), the input, the loop and the three ways it runs: the player's run, the title's little board
// playing itself, and `?demo` (the arcade's preview: its own player, seeded, silent, forever).
import './style.css';
import { createShell, el } from '../kit/shell.js';
import { fitCanvas } from '../kit/canvas.js';
import { createLoop } from '../kit/loop.js';
import { pointer } from '../kit/input.js';
import { DEMO, SEED, TOUCH, QUERY } from '../kit/env.js';
import { rng, fmt } from '../kit/fx.js';
import { Session } from './session.js';
import { Bot } from './bot.js';
import { createRenderer } from './render.js';
import { createSfx } from './sound.js';
import { demoOpening } from './ai.js';
import { endLine, shareText } from './lines.js';
import { PIECE } from './rules.js';

const TAGLINE = 'Place blocks. Clear lines. Keep the chain alive.';
const root = document.getElementById('ak-root');
const shell = createShell({
  game: 'blockchain', name: 'BLOCKCHAIN', root,
  howTo: {
    intro: 'Fill whole rows and columns on the 8 × 8 board to clear them. Clear again and again to grow your chain.',
    steps: [
      ['Drag a piece', 'Pick any of your three pieces and drop it on the board. Pieces never turn.'],
      ['Clear lines', 'A full row or column clears. Clear several in one drop for a much bigger score.'],
      ['Keep the chain alive', 'Every clear adds a link and multiplies your points. Three drops in a row without a clear break it.'],
      ['Mind the room', 'When none of your pieces fits anywhere, the run is over. A new tray comes once all three are placed.'],
    ],
    touch: [['Drag', 'Lift a piece and drop it'], ['Let go off the board', 'It goes back to the tray']],
    keys: [['Drag', 'Move a piece with the mouse'], ['1 2 3', 'Pick a piece'], ['Arrows', 'Move it'], ['Space', 'Drop it'], ['Esc', 'Put it back'], ['P', 'Pause']],
  },
  onPause: () => { se?.cancelDrag(true); dragId = null; },
  onRestart: () => newRun(),
  onQuit: () => toTitle(),
});

const canvas = el('canvas', { role: 'img', 'aria-label': 'BLOCKCHAIN: the 8 by 8 board and your three pieces' });
const safe = el('div', { class: 'bc-safe', 'aria-hidden': 'true' });
const live = el('p', { class: 'ak-sr', 'aria-live': 'polite' });
shell.stage.append(canvas, safe, live);
const renderer = createRenderer();
const sfx = createSfx(shell.audio);
const scoreChip = shell.chip('Score', 0);
const bestChip = shell.chip('Best', shell.store.best() ?? 0);
let L = null;
let view = null;
view = fitCanvas(canvas, { maxDpr: 2, onResize: () => relayout() });

let mode = 'boot';            // title · play · demo
let se = null;                // the run on the screen (the player's, or the demo's)
let bot = null;               // the demo's player
let attract = null, attractBot = null;
let runs = 0, demoRuns = 0, dragId = null, hover = -1;
const demoRoll = rng(SEED || 7);
const pick = (list) => list[Math.floor((DEMO ? demoRoll.next() : Math.random()) * list.length)];

// ---------- the layout: clear of the kit's bar and the notch ----------
function insets() {
  if (DEMO) return { top: 12, right: 12, bottom: 12, left: 12 };
  const cs = getComputedStyle(safe);
  const px = (v) => parseFloat(v) || 0;
  const bar = shell.bar.getBoundingClientRect();
  const st = canvas.getBoundingClientRect();
  return {
    top: Math.max(bar.bottom - st.top, px(cs.paddingTop)) + 8,
    right: px(cs.paddingRight) + 12, bottom: px(cs.paddingBottom) + 12, left: px(cs.paddingLeft) + 12,
  };
}
function relayout() {
  if (!view) return;
  const before = L;
  L = renderer.layout(view.w, view.h, view.dpr, insets());
  for (const s of [se, attract]) {
    if (!s) continue;
    s.L = L;
    // things in flight were placed for the old size
    if (before && (before.C !== L.C || before.gx !== L.gx || before.gy !== L.gy)) { s.parts.clear(); s.floats.clear(); s.labels = s.labels.filter((l) => l.stay); }
  }
  // the score's chip only where the bar has room (on a phone the big score sits right under it)
  scoreChip.hide(view.w < 640);
}

// ---------- the player's run ----------
const hooks = {
  sfx: (name, ...a) => sfx[name]?.(...a),
  haptic: (ms) => shell.haptic(ms),
  over: (s) => endRun(s),
  pick,
};
function newRun() {
  stopAttract();
  dragId = null;
  const seed = SEED && runs === 0 ? SEED : ((Math.random() * 2 ** 31) >>> 0) || 1;
  const kept = shell.store.read();
  se = new Session({ seed, best: shell.store.best(), ticker: Number(kept.confirmed) || 0, hooks });
  se.L = L;
  runs++;
  mode = 'play';
  shell.started();
  bestChip.set(shell.store.best() ?? 0);
  if (runs === 1) setTimeout(() => { if (se && se.time < 3 && !se.cleared) se.speak('start', 0, { force: true }); }, 700);
  announce('A new run. Drag a piece onto the board, or press 1, 2 or 3.');
}
function endRun(s) {
  if (DEMO) { newDemoRun(); return; }
  if (s !== se) return;
  const st = s.s;
  const prev = shell.store.best();
  const isBest = st.score > 0 && (prev == null || st.score > prev);
  shell.store.update((d) => {
    d.confirmed = (Number(d.confirmed) || 0) + st.lines;
    d.bestChain = Math.max(Number(d.bestChain) || 0, st.bestChain);
    d.perfects = (Number(d.perfects) || 0) + st.perfects;
  });
  shell.over({
    score: st.score, label: 'points',
    stats: [['Lines', fmt(st.lines)], ['Best chain', `×${Math.max(st.bestChain, 0)}`], ['Blocks placed', fmt(st.pieces)], ['Perfects', fmt(st.perfects)]],
    line: endLine(st.score, isBest, pick),
    share: shareText(st),
    onAgain: () => newRun(),
    onMenu: () => toTitle(),
  });
  bestChip.set(shell.store.best() ?? 0);
  announce(`No room left. ${fmt(st.score)} points, ${st.lines} lines.`);
  if (isBest) s.confetti(L.center.x, L.frame.y + L.C, 80);
}
function announce(text) { live.textContent = text; }

// ---------- the title: its little board plays itself behind the logo ----------
function startAttract() {
  const o = demoOpening(((Math.random() * 1e6) | 0) + 1);
  attract = new Session({ seed: o.seed, board: o.board, quiet: true, hooks: { over: () => startAttract() } });
  attract.L = L;
  attractBot = new Bot(attract, { pace: 0.85, firstWait: 0.6 });
}
function stopAttract() { attract = null; attractBot = null; }
function toTitle() {
  mode = 'title';
  se?.cancelDrag(true);
  se = null;
  if (!attract) startAttract();
  shell.title({
    logo: ['BLOCK', { text: 'CHAIN', tone: 'accent' }],
    tagline: TAGLINE,
    best: shell.store.best(),
    onPlay: () => newRun(),
  });
}

// ---------- the demo (?demo): its own player, from a half-full board, forever ----------
function newDemoRun() {
  const seed = (SEED || 7) + demoRuns * 7919;
  demoRuns++;
  const o = demoOpening(seed);
  se = new Session({ seed: o.seed, board: o.board, ticker: 1284 + demoRuns * 37, hooks: { over: () => newDemoRun(), pick } });
  se.L = L;
  bot = new Bot(se, { firstWait: demoRuns === 1 ? 0.25 : 0.5 });
  mode = 'demo';
}

// ---------- touch and mouse ----------
const playing = () => mode === 'play' && shell.state === 'play' && se && !se.busy;
function slotAt(x, y) {
  if (!L) return -1;
  const m = L.C * 0.18;
  for (let k = 0; k < 3; k++) {
    const sl = L.slots[k];
    if (x >= sl.x - m && x <= sl.x + sl.w + m && y >= sl.y - m && y <= sl.y + sl.h + m && se.s.tray[k] >= 0) return k;
  }
  return -1;
}
pointer(canvas, {
  down(p) {
    if (!playing() || se.drag) return;
    const k = slotAt(p.x, p.y);
    if (k < 0) return;
    if (se.startDrag(k, p.x, p.y, { touch: p.type !== 'mouse' })) { dragId = p.id; canvas.style.cursor = 'grabbing'; }
  },
  move(p) { if (se?.drag && p.id === dragId) se.moveDrag(p.x, p.y); },
  up(p) {
    if (!se?.drag || p.id !== dragId) return;
    dragId = null;
    if (p.event?.type === 'pointercancel') se.cancelDrag();
    else se.endDrag();
    canvas.style.cursor = '';
  },
  hover(p) {
    if (!playing() || se.drag) { hover = -1; return; }
    hover = p.type === 'mouse' ? slotAt(p.x, p.y) : -1;
    canvas.style.cursor = hover >= 0 ? 'grab' : '';
  },
});

// ---------- the keyboard: 1 2 3 pick, arrows move, Space or Enter drops, Esc puts it back ----------
// (on the capture side, so Esc with a piece in hand puts it back instead of pausing: the shell skips handled keys)
addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || !playing()) return;
  if (e.target?.closest?.('input, textarea, select')) return;
  const k = e.key;
  const first = () => [0, 1, 2].find((s) => se.s.tray[s] >= 0);
  if (k === '1' || k === '2' || k === '3') { e.preventDefault(); if (!e.repeat) se.pickKey(Number(k) - 1); return; }
  const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (arrows[k]) {
    e.preventDefault();
    if (!se.kb) { const f = first(); if (f != null) se.pickKey(f); return; }
    se.moveKey(...arrows[k]);
    return;
  }
  if (k === ' ' || k === 'Enter') {
    if (e.target?.closest?.('button, a')) return;
    e.preventDefault();
    if (e.repeat) return;
    if (!se.kb) { const f = first(); if (f != null) se.pickKey(f); return; }
    const r = se.placeKey();
    if (r && r.lines) announce(`${r.lines} ${r.lines > 1 ? 'lines' : 'line'} cleared. Chain ${r.chain}.`);
    return;
  }
  if (k === 'Escape' && se.kb) { e.preventDefault(); se.cancelKey(); }
}, { capture: true });

// ---------- the loop ----------
const loop = createLoop({
  update(dt) {
    if (mode === 'demo') { bot.update(dt); se.update(dt); return; }
    if (mode === 'play' && se) se.update(dt);
  },
  render(alpha, frameDt) {
    const g = view.begin();
    if (!L) relayout();
    if (mode === 'title' && attract) {
      attractBot.update(frameDt);
      attract.update(frameDt);
      renderer.draw(g, attract, { title: true, bot: attractBot });
      return;
    }
    if (!se) return;
    if (mode === 'play' && shell.state === 'over') se.update(frameDt);
    renderer.draw(g, se, { bot: mode === 'demo' ? bot : null, keys: mode === 'play' && !TOUCH, hover: se.drag ? -1 : hover });
    if (mode === 'play') scoreChip.set(se.disp.score);
  },
  paused: () => shell.state !== 'play' && !DEMO,
});

// QA (`?qa`): a handle for the screenshot scripts (stage a board, read the run); never on a link from the site
if (QUERY.has('qa')) {
  window.__bc = {
    get se() { return se; },
    get L() { return L; },
    // stage(rows of '.'/'1-7', [piece ids]): the current run's board and tray as given
    stage(rows, tray, extra = {}) {
      const b = se.s.board;
      rows.forEach((row, y) => [...row].forEach((ch, x) => { b[y * 8 + x] = ch === '.' ? 0 : Number(ch); }));
      se.s.tray = tray.map((id) => (id == null ? -1 : PIECE[id]));
      Object.assign(se.s, extra);
      se.s.over = false;
      se.checkDanger(true);
    },
    drop(slot, x, y) { return se.drop(slot, x, y); },
  };
}

// the canvas's words wait for the arcade's fonts (never longer than a moment)
const fonts = Promise.all([
  "900 40px 'AK Display'", "650 16px 'AK Mono'", "italic 400 18px 'AK Serif'",
].map((f) => document.fonts?.load(f).catch(() => null)));
Promise.race([fonts, new Promise((r) => setTimeout(r, 1800))]).then(() => {
  relayout();
  if (DEMO) newDemoRun(); else toTitle();
  loop.start();
});
