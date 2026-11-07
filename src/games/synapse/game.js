// SYNAPSE on agi1.app (2026-11-08): Connect the neurons. Fill the brain.
// A path-linking puzzle on the arcade kit: drag from a neuron to its twin, paths never cross, every cell filled; then
// the network fires and every solved board plays its own little melody. Campaign (six packs, 144 boards), Daily
// (three boards a day) and Rush (three minutes of small boards). This file wires the kit's frame, the input, the loop
// and the ways it runs: the player's board, the title's board solving itself, and `?demo` (the arcade's preview).
import './style.css';
import { createShell, el } from '../kit/shell.js';
import { fitCanvas } from '../kit/canvas.js';
import { createLoop } from '../kit/loop.js';
import { pointer } from '../kit/input.js';
import { DEMO, SEED, TOUCH, QUERY, REDUCED } from '../kit/env.js';
import { Particles, Shake, FloatText, rng, fmt, fmtTime, clamp } from '../kit/fx.js';
import { Board } from './rules.js';
import {
  PACKS, packSize, TOTAL_BOARDS, UNLOCK_AT, boardAt, dayKey, dailyBoard, nextStreak, rushBoard, RUSH,
} from './packs.js';
import { createRenderer, computeLayout, cellAt } from './render.js';
import { firingPlan } from './melody.js';
import { createSound, createMusic } from './sound.js';
import { Autoplayer, planStrokes, strokeTime, prefill } from './demo.js';
import { createTools, createSay, campaignCard, dailyCard, packDoneCard } from './ui.js';
import { say, rushLine, rushShare, dailyShare } from './lines.js';
import { COLORS } from './art.js';
import { BRIDGE, GATE, DEAD } from './puzzle.js';

const TAGLINE = 'Connect the neurons. Fill the brain.';
const root = document.getElementById('ak-root');
const shell = createShell({
  game: 'synapse', name: 'SYNAPSE', root,
  howTo: {
    intro: 'Connect every pair of matching neurons. Paths never cross, and every cell has to be filled.',
    steps: [
      ['Draw', 'Drag from a neuron to its twin: same color, same shape. Let go and the path stays.'],
      ['Fill the brain', 'A board is solved when every pair is connected and no cell is left empty. Then it fires.'],
      ['Fix it', 'Drag back along a path to shorten it, through another path to cut it, or tap a path to clear it.'],
      ['Twists', 'Bridges carry one path across and one over the top. Gates are crossed the way the arrow points, counted from the neuron with the white dot.'],
    ],
    touch: [['Drag', 'Draw a path'], ['Tap a path', 'Clear it'], ['Undo · Reset · Hint', 'Under the board']],
    keys: [['Drag', 'Draw with the mouse'], ['Arrows', 'Move the cursor, or the path you hold'], ['Space', 'Pick up or drop a path'], ['Backspace', 'Undo'], ['H', 'Hint'], ['R', 'Reset the board'], ['Enter', 'Next board'], ['P', 'Pause']],
  },
  onPause: () => commitDrag(),
  onRestart: () => restartFromPause(),
  onQuit: () => toTitle(),
});

const canvas = el('canvas', { role: 'img', 'aria-label': 'SYNAPSE: the board' });
const safe = el('div', { class: 'sy-safe', 'aria-hidden': 'true' });
const live = el('p', { class: 'ak-sr', 'aria-live': 'polite' });
shell.stage.append(canvas, safe, live);
const renderer = createRenderer();
const sfx = createSound(shell.audio);
const music = createMusic();
const tools = createTools(shell.stage, {
  undo: () => doUndo(), reset: () => doReset(), hint: () => doHint(), boards: () => openCampaign(true), skip: () => doSkip(), next: () => doNext(),
});
const bubble = createSay(shell.stage);
const chipBoard = shell.chip('Board', '');
chipBoard.node.classList.add('sy-chip-board');
const chipMoves = shell.chip('Moves', 0);
const chipTime = shell.chip('Time', '3:00', { accent: true });
const chipBoards = shell.chip('Boards', 0);
let view = null;
let L = null;
const demoRoll = rng(SEED || 7);
const pick = (list) => list[Math.floor((DEMO ? demoRoll.next() : Math.random()) * list.length)];
const announce = (t) => { live.textContent = t; };

// ---------- a board on the screen: its rules, its firing, its effects ----------
class Scene {
  constructor(pz, { quiet = false, label = '' } = {}) {
    this.pz = pz;
    this.board = new Board(pz);
    this.quiet = quiet;
    this.label = label;
    this.t = 0;
    this.time = 0;            // seconds of play (from the first touch)
    this.started = false;
    this.phase = 'play';      // play · fire · done
    this.fire = null;
    this.bloom = null;
    this.swap = 0;
    this.parts = new Particles(420);
    this.floats = new FloatText();
    this.shake = new Shake({ max: 7, decay: 2.2 });
    this.gateFlash = null;
    this.stats = this.board.stats();
    this.popPairs = 0; this.popPct = 0;
    this.ap = null;
    this.ghost = null;
    this.cutCount = 0;
    this.sources = pz.kind.some((k) => k === GATE);
    const twist = pz.kind.some((k) => k === BRIDGE) ? ' · bridges' : this.sources ? ' · gates' : pz.kind.some((k) => k === DEAD) ? ' · holes' : '';
    this.sub = `${pz.n}×${pz.n} · ${pz.pairs.length} pairs${twist}`;
  }
}
let mode = 'boot';      // title · play · demo
let sc = null;          // the scene on the screen
let run = null;         // what's being played: { kind: camp | daily | rush, p, i, slot }
let rush = null;
let demo = null;        // { k, next }
let cardOpen = false;
let pendingAfter = 0;   // seconds until the next scene (rush, demo, title)

// ---------- the layout: clear of the kit's bar and the notch ----------
function insets() {
  if (DEMO) return { top: 8, right: 8, bottom: 8, left: 8 };
  const cs = getComputedStyle(safe);
  const px = (v) => parseFloat(v) || 0;
  const bar = shell.bar.getBoundingClientRect();
  const st = canvas.getBoundingClientRect();
  return { top: Math.max(bar.bottom - st.top, px(cs.paddingTop)) + 4, right: px(cs.paddingRight) + 10, bottom: px(cs.paddingBottom) + 10, left: px(cs.paddingLeft) + 10 };
}
function relayout() {
  if (!view || !sc) return;
  L = computeLayout(view.w, view.h, insets(), sc.pz.n, { demo: DEMO, title: mode === 'title' });
  renderer.setLayout(L, sc.pz, view.dpr);
  tools.place(L, DEMO || mode !== 'play');
  if (mode === 'play' && sc.phase !== 'done') tools.unsolved();
  if (mode !== 'play') { tools.bar.hidden = true; tools.done.hidden = true; }
  bubble.place(L);
}
function show(scene) {
  sc = scene;
  sc.swap = mode === 'play' && !REDUCED ? 0 : 1;
  renderer.resetDisplay(sc.board);
  relayout();
  canvas.setAttribute('aria-label', `SYNAPSE: a ${sc.pz.n} by ${sc.pz.n} board with ${sc.pz.pairs.length} pairs of neurons`);
}

// ---------- the store: progress, hints, the Daily, the lesson ----------
const today = () => dayKey(new Date());
const markKey = (p, i) => `${PACKS[p].id}:${i}`;
function progress() {
  const marks = shell.store.read().marks || {};
  const solvedIn = (p) => { let k = 0; for (let i = 0; i < packSize(PACKS[p]); i++) if (marks[markKey(p, i)]) k++; return k; };
  const api = {
    done: (p, i) => marks[markKey(p, i)] || 0,
    solvedIn,
    perfectIn: (p) => { let k = 0; for (let i = 0; i < packSize(PACKS[p]); i++) if (marks[markKey(p, i)] === 2) k++; return k; },
    unlocked: (p) => p === 0 || solvedIn(p - 1) >= UNLOCK_AT || solvedIn(p) > 0,
    next: (p) => { for (let i = 0; i < packSize(PACKS[p]); i++) if (!marks[markKey(p, i)]) return i; return 0; },
    total: () => Object.keys(marks).length,
    perfect: () => Object.values(marks).filter((v) => v === 2).length,
  };
  return api;
}
function hintsLeft() {
  const d = shell.store.read();
  const free = d.hints && d.hints.day === today() ? d.hints.free : 3;
  return Math.max(0, free) + (Number(d.bank) || 0);
}
function useHint() {
  let ok = false;
  shell.store.update((d) => {
    if (!d.hints || d.hints.day !== today()) d.hints = { day: today(), free: 3 };
    if (d.hints.free > 0) { d.hints.free--; ok = true; } else if ((Number(d.bank) || 0) > 0) { d.bank--; ok = true; }
  });
  return ok;
}
function dailyState() {
  const d = shell.store.read(), key = today();
  const day = d.daily && d.daily.key === key ? d.daily : { key, t: [null, null, null], perfect: [false, false, false] };
  const streak = d.streak && (d.streak.last === key || nextStreak(d.streak, key).n > 1) ? d.streak.n : 0;
  return { ...day, streak };
}

// ---------- starting boards ----------
function startScene(pz, info) {
  commitDrag();
  shell.closeCard();
  cardOpen = false;
  bubble.hide();
  const wasPlaying = shell.state === 'play';
  mode = 'play';
  run = info;
  show(new Scene(pz, { label: info.label }));
  if (!wasPlaying) shell.started();
  shell.audio.music(music);
  tools.setMode(info.kind);
  tools.unsolved();
  tools.setHints(hintsLeft());
  updateChips(true);
  relayout();
  if (TOUCH) cursor = -1;
  return sc;
}
function startCampaign(p, i) {
  const pz = boardAt(p, i);
  const pk = PACKS[p];
  startScene(pz, { kind: 'camp', p, i, label: `${pk.name} ${i + 1}` });
  shell.store.update((d) => { d.last = { p, i }; });
  lesson();
  announce(`${pk.name}, board ${i + 1} of ${packSize(pk)}: ${pz.n} by ${pz.n}, ${pz.pairs.length} pairs.`);
}
function continueCampaign() {
  const pr = progress(), d = shell.store.read();
  let p = d.last ? d.last.p : 0, i = d.last ? d.last.i : 0;
  if (pr.done(p, i)) {
    // the next unsolved board: this pack first, then the next open ones
    let found = false;
    for (let q = p; q < PACKS.length && !found; q++) {
      if (!pr.unlocked(q)) break;
      for (let k = q === p ? i : 0; k < packSize(PACKS[q]) && !found; k++) if (!pr.done(q, k)) { p = q; i = k; found = true; }
    }
    if (!found) for (let k = 0; k < packSize(PACKS[p]) && !found; k++) if (!pr.done(p, k)) { i = k; found = true; }
  }
  startCampaign(p, i);
}
// a first board ever, or a twist's first board: AGI-1 says what's new (and the very first board shows how)
function lesson() {
  const d = shell.store.read(), pz = sc.pz;
  const seen = d.seen || {};
  let kind = null;
  if (!d.tut && run.kind === 'camp' && run.p === 0) kind = 'tutorial';
  else if (pz.kind.some((k) => k === BRIDGE) && !seen.bridges) kind = 'bridges';
  else if (pz.kind.some((k) => k === GATE) && !seen.gates) kind = 'gates';
  else if (pz.kind.some((k) => k === DEAD) && !seen.holes) kind = 'holes';
  if (!kind) return;
  if (kind === 'tutorial') {
    // the shortest pair is shown being drawn, over and over, until the player draws one
    let c = 0;
    pz.sol.forEach((P, k) => { if (P.length < pz.sol[c].length) c = k; });
    sc.ghost = { c, cells: pz.sol[c], len: 0, t: -0.6 };
    setTimeout(() => { if (sc && sc.ghost) bubble.show(say('tutorial', pick), 0); }, 500);
  } else {
    const s = sc;
    setTimeout(() => { if (sc === s && mode === 'play') bubble.show(say(kind, pick), 5200); }, 450);
    shell.store.update((s) => { s.seen = { ...(s.seen || {}), [kind]: 1 }; });
  }
}
const dailyCache = new Map();
function dailyOf(key, slot) {
  const k = `${key}:${slot}`;
  if (!dailyCache.has(k)) dailyCache.set(k, dailyBoard(key, slot));
  return dailyCache.get(k);
}
function startDaily(slot) {
  const key = today();
  const pz = dailyOf(key, slot);
  startScene(pz, { kind: 'daily', slot, key, label: `Daily · ${['Small', 'Medium', 'Large'][slot]}` });
  lesson();
  announce(`Daily board ${slot + 1} of 3.`);
}
function startRush() {
  const seed = (SEED && !rush ? SEED : ((Math.random() * 2 ** 31) >>> 0)) || 1;
  rush = { seed, k: 0, left: RUSH.seconds, boards: 0, perfect: 0, bestTime: null, said: {}, ended: false };
  loadRush();
  setTimeout(() => { if (rush && !rush.ended) bubble.show(say('rushStart', pick), 2400); }, 300);
}
function loadRush() {
  const pz = rushBoard(rush.seed, rush.k);
  startScene(pz, { kind: 'rush', label: `Rush · board ${rush.k + 1}` });
  sc.started = true;
}

// ---------- the chips in the bar ----------
function updateChips(force = false) {
  const isRush = run && run.kind === 'rush';
  chipBoard.hide(isRush); chipMoves.hide(isRush);
  chipTime.hide(!isRush); chipBoards.hide(!isRush);
  if (!run || !sc) return;
  if (isRush) {
    chipTime.set(fmtTime(Math.ceil(rush.left)));
    chipTime.node.classList.toggle('is-accent', rush.left > 30);
    chipBoards.set(rush.boards, { pop: force });
  } else {
    const label = run.kind === 'daily' ? `${sc.pz.n}×${sc.pz.n} ${['S', 'M', 'L'][run.slot]}` : `${sc.pz.n}×${sc.pz.n} #${run.i + 1}`;
    chipBoard.set(label);
    chipMoves.set(sc.board.moves);
  }
  // Undo and Reset only when there's something to take back
  const b = sc.board;
  tools.setEnabled({ undo: b.history.length > 0 || Boolean(b.drag), reset: b.paths.some((P) => P.length) || Boolean(b.drag) });
}

// ---------- what happens as a path is drawn (the player's, the demo's) ----------
const hooksFor = (s) => ({
  press: (c) => { renderer.pop(c, 0.5); if (!s.quiet) sfx.press(c); },
  step: (r, cell, c, k) => onStep(s, r, cell, c, k),
  end: (res) => onRelease(s, res),
});
function onStep(s, r, cell, c, k = 0) {
  if (!r) return;
  const b = s.board;
  if (r === 'gate') {
    s.gateFlash = { cell: b.drag && b.drag.blocked != null ? b.drag.blocked : cell, t: 0 };
    if (!s.quiet) { sfx.blocked(); shell.haptic(10); }
    return;
  }
  if (!s.quiet) {
    if (r === 'back' || r === 'cut') sfx.back();
    else if (r === 'step') sfx.cell(b.n, cell, c, k || b.drag?.cur.length || 0);
  }
  if (r === 'done') {
    const p = renderer.center(cell);
    renderer.pop(c, 1);
    s.parts.burst({ x: p.x, y: p.y, count: 16, speed: [60, 220], life: [0.3, 0.6], size: [2, 5], colors: [COLORS[c].hex, '#ffffff'], shape: 'spark', drag: 3 });
    if (!s.quiet) { sfx.connect(b.n, cell, c); shell.haptic(14); }
    // the last connection: the network fires at once (no need to let go)
    if (s.phase === 'play' && b.drag && b.solved()) { onRelease(s, b.end()); return; }
  }
  const cutting = b.cutting().length;
  if (cutting > s.cutCount && !s.quiet) sfx.cut();
  s.cutCount = cutting;
}
function onRelease(s, res) {
  s.cutCount = 0;
  if (!res) return;
  const b = s.board;
  if (res.cleared && !s.quiet) sfx.clear();
  if (s === sc && mode === 'play') updateChips();
  if (s.phase !== 'play') return;
  if (b.solved()) { solved(s); return; }
  if (s.quiet || mode !== 'play') return;
  if (res.connected) {
    const st = b.stats();
    announce(`${COLORS[res.c].name} connected. ${st.pairs} of ${st.total} pairs, ${st.pct} percent of cells.`);
    if (sc.ghost) {
      sc.ghost = null;
      bubble.show(say('firstPair', pick), 3600);
    } else if (b.paths[res.c].length >= 11 && Math.random() < 0.35) bubble.show(say('journey', pick), 2600);
  }
}

// ---------- solved: the network fires ----------
function solved(s) {
  s.phase = 'fire';
  const flows = s.board.flows();
  const short = run && run.kind === 'rush';
  s.fire = { t: -0.12, plan: firingPlan(s.board.n, flows, { maxTime: short ? 1.4 : 2.3 }), flows, next: 0 };
  s.ghost = null;
  if (s === sc && mode === 'play') {
    bubble.hide();
    commitDrag();
    record(s);
    announce(`Solved! The network fires.`);
  }
}
function updateFire(s, dt) {
  const f = s.fire;
  f.t += dt;
  const notes = f.plan.notes;
  let played = 0;
  while (f.next < notes.length && notes[f.next].t <= f.t) {
    const nt = notes[f.next++];
    renderer.light(nt.cell, 1);
    if (!s.quiet && played < 6) { sfx.fire(nt, s.board.K); played++; }
    if (nt.last) {
      renderer.pop(nt.c, 1);
      const p = renderer.center(nt.cell);
      s.parts.burst({ x: p.x, y: p.y, count: 12, speed: [40, 170], life: [0.3, 0.7], size: [2, 4.5], colors: [COLORS[nt.c].hex, '#ffffff'], shape: 'spark', drag: 2.5 });
    }
  }
  if (f.t >= f.plan.end + 0.12 && s.bloom == null) {
    s.bloom = 0;
    if (!s.quiet) { sfx.bloom(s.board.K); shell.haptic([12, 40, 18]); }
    s.shake.kick(0.12);
    // spores of light drift up from the board
    if (L) for (let k = 0; k < 26; k++) {
      const i = Math.floor(((k * 7919) % 997) / 997 * s.board.N2);
      if (s.pz.kind[i] === DEAD) continue;
      const p = renderer.center(i), c = Math.max(0, s.board.own[i] - 1);
      s.parts.burst({ x: p.x, y: p.y, count: 1, speed: [10, 40], angle: [-Math.PI * 0.75, -Math.PI * 0.25], life: [0.9, 1.8], size: [2, 4], colors: [COLORS[c % COLORS.length].hex], gravity: -30, drag: 0.6 });
    }
    afterBloom(s);
  }
}
function afterBloom(s) {
  if (s !== sc) return;
  // (the first demo board holds its glow to the end of the arcade's 6-second clip)
  if (mode === 'demo') { pendingAfter = demo && demo.k === 0 ? 2.6 : 1.6; return; }
  if (mode === 'title') { pendingAfter = 1.8; return; }
  if (run.kind === 'rush') {
    pendingAfter = 0.75;
    return;
  }
  // the panel, and AGI-1's line
  const b = s.board;
  const perfect = b.perfect;
  const best = s.prevBest ?? null;
  setTimeout(() => {
    if (s !== sc || mode !== 'play') return;
    s.phase = 'done';
    const stats = [fmtTime(s.time), `${b.moves} move${b.moves === 1 ? '' : 's'}`];
    if (best != null && best < s.time) stats.push(`best ${fmtTime(best)}`);
    const isLastDaily = run.kind === 'daily' && dailyState().t.every((t) => t != null);
    tools.solved({ title: perfect ? 'Perfect' : 'Solved', perfect, stats: stats.join(' · '), nextLabel: isLastDaily ? 'Finish' : 'Next' });
    relayout();
    tools.place(L, false);
    if (perfect) {
      sfx.perfect();
      s.parts.burst({ x: L.cx, y: L.cy, count: 26, speed: [120, 380], life: [0.6, 1.1], size: [7, 13], colors: ['#ffc933', '#fffaf0'], shape: 'star', spin: 6, drag: 2.2, stroke: '#170a36' });
    }
    if (Math.random() < 0.85 || perfect) bubble.show(say(perfect ? 'perfect' : 'solved', pick), 3400);
    if (keyUser) tools.next.focus({ preventScroll: true });
  }, 380);
}
// a solved board, kept: its mark (solved, perfect), its best time, the hints it earns, the Daily, the streak
function record(s) {
  const b = s.board, perfect = b.perfect;
  let unlocked = null, earned = false;
  if (run.kind === 'camp') {
    s.prevBest = (shell.store.read().times || {})[markKey(run.p, run.i)] ?? null;
    const before = progress();
    const wasOpen = run.p + 1 < PACKS.length && before.unlocked(run.p + 1);
    shell.store.update((d) => {
      d.marks = d.marks || {};
      const k = markKey(run.p, run.i);
      d.marks[k] = Math.max(d.marks[k] || 0, perfect ? 2 : 1);
      d.times = d.times || {};
      d.times[k] = Math.min(d.times[k] ?? Infinity, Math.round(s.time));
      d.tut = 1;
    });
    const after = progress();
    if (run.p + 1 < PACKS.length && !wasOpen && after.unlocked(run.p + 1)) unlocked = PACKS[run.p + 1];
  } else if (run.kind === 'daily') {
    shell.store.update((d) => {
      const key = run.key;
      if (!d.daily || d.daily.key !== key) d.daily = { key, t: [null, null, null], perfect: [false, false, false] };
      d.daily.t[run.slot] = d.daily.t[run.slot] == null ? Math.round(s.time) : Math.min(d.daily.t[run.slot], Math.round(s.time));
      d.daily.perfect[run.slot] = d.daily.perfect[run.slot] || perfect;
      if (d.daily.t.every((t) => t != null)) d.streak = nextStreak(d.streak, key);
    });
  } else if (run.kind === 'rush') {
    rush.boards++;
    if (perfect) rush.perfect++;
    rush.bestTime = rush.bestTime == null ? s.time : Math.min(rush.bestTime, s.time);
    rush.left += RUSH.bonus;
    s.floats.add({ x: L.cx, y: L.y + L.size * 0.5, text: `+${RUSH.bonus}s`, color: '#3ff0c3', size: Math.min(54, L.C * 0.9), life: 1.2, rise: 70 });
    updateChips(true);
  }
  shell.store.update((d) => {
    d.solves = (Number(d.solves) || 0) + 1;
    if (d.solves % 5 === 0) { d.bank = (Number(d.bank) || 0) + 1; earned = true; }
  });
  if (unlocked) setTimeout(() => { shell.toast(`${unlocked.name} unlocked`, 'good', 2200); sfx.gain(); }, 1400);
  else if (earned) setTimeout(() => { shell.toast('+1 hint', 'good'); tools.setHints(hintsLeft()); }, 1400);
}

// ---------- the buttons ----------
const canAct = () => mode === 'play' && sc && sc.phase === 'play' && shell.state === 'play' && !cardOpen;
function doUndo() {
  if (!canAct()) return;
  commitDrag();
  if (sc.board.undo()) { sfx.undo(); updateChips(); } else sfx.blocked();
}
function doReset() {
  if (!canAct()) return;
  commitDrag();
  if (sc.board.restart()) { sfx.whoosh(); updateChips(); }
}
function doHint() {
  if (!canAct()) return;
  if (hintsLeft() <= 0) { shell.toast('No hints left today', 'warn'); sfx.blocked(); return; }
  commitDrag();
  sc.started = true;
  const c = sc.board.hint();
  if (c < 0) { shell.toast('Every path is already right', ''); return; }
  useHint();
  tools.setHints(hintsLeft());
  sfx.hint();
  renderer.pop(c, 1);
  bubble.show(say('hint', pick), 2400);
  sc.ghost = null;
  updateChips();
  if (sc.board.solved()) solved(sc);
}
function doSkip() {
  if (!canAct() || !rush) return;
  rush.k++;
  sfx.whoosh();
  loadRush();
}
function doNext() {
  if (mode !== 'play' || !sc || sc.phase !== 'done') return;
  sfx.select();
  if (run.kind === 'camp') {
    const pr = progress(), size = packSize(PACKS[run.p]);
    const d = shell.store.read();
    const done = d.packsDone || {};
    if (pr.solvedIn(run.p) === size && !done[PACKS[run.p].id]) {
      shell.store.update((s) => { s.packsDone = { ...(s.packsDone || {}), [PACKS[run.p].id]: 1 }; });
      return showPackDone(run.p);
    }
    let i = run.i + 1;
    if (i >= size) {
      // the end of the pack: back to a board still to solve, or the pack's card when every one is
      if (pr.solvedIn(run.p) === size) return showPackDone(run.p);
      i = pr.next(run.p);
    }
    startCampaign(run.p, i);
  } else if (run.kind === 'daily') {
    const day = dailyState();
    const next = day.t.findIndex((t) => t == null);
    if (next >= 0) startDaily(next);
    else finishDaily(day);
  }
}
function showPackDone(p) {
  const nextPack = p + 1 < PACKS.length && progress().unlocked(p + 1) ? PACKS[p + 1] : null;
  cardOpen = true;
  shell.card(packDoneCard({
    pack: PACKS[p], perfect: progress().perfectIn(p), total: packSize(PACKS[p]), nextPack,
    onNext: () => { cardOpen = false; if (nextPack) startCampaign(p + 1, progress().next(p + 1)); else openCampaign(false); },
    onClose: () => { cardOpen = false; shell.closeCard(); toTitle(); },
  }), { label: `${PACKS[p].name} complete` });
  sfx.gain();
}
function finishDaily(day) {
  const total = day.t.reduce((a, b) => a + b, 0);
  shell.audio.stopMusic();
  shell.over({
    title: 'Daily done', score: total, format: fmtTime, label: 'total time', bestKey: 'daily', lower: true,
    stats: [['Small', fmtTime(day.t[0])], ['Medium', fmtTime(day.t[1])], ['Large', fmtTime(day.t[2])], ['Streak', `${day.streak} day${day.streak === 1 ? '' : 's'}`]],
    line: say('dailyDone', pick), share: dailyShare(fmtTime(total)),
    again: 'Play Rush', onAgain: () => startRush(), onMenu: () => toTitle(),
  });
}
function restartFromPause() {
  if (!run) return;
  if (run.kind === 'rush') startRush();
  else if (run.kind === 'daily') startDaily(run.slot);
  else startCampaign(run.p, run.i);
}

// ---------- menus ----------
function openCampaign(fromGame) {
  if (fromGame && !canAct() && !(sc && sc.phase === 'done')) return;
  commitDrag();
  cardOpen = true;
  sfx.select();
  shell.card(campaignCard({
    progress: progress(),
    start: fromGame && run && run.kind === 'camp' ? run.p : null,
    onBoard: (p, i) => startCampaign(p, i),
    onClose: () => { cardOpen = false; shell.closeCard(); },
  }), { label: 'Campaign' });
}
function openDaily() {
  const key = today();
  cardOpen = true;
  sfx.select();
  shell.card(dailyCard({
    day: { ...dailyState(), label: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) },
    specs: [0, 1, 2].map((s) => {
      const pz = dailyOf(key, s);
      return { n: pz.n, bridges: pz.kind.includes(BRIDGE), gates: pz.kind.includes(GATE), holes: pz.kind.includes(DEAD) };
    }),
    onPlay: (slot) => startDaily(slot),
    onClose: () => { cardOpen = false; shell.closeCard(); },
  }), { label: 'Daily' });
}
function toTitle() {
  commitDrag();
  cardOpen = false;
  shell.audio.stopMusic();
  bubble.hide();
  run = null; rush = null;
  mode = 'title';
  startAttract();
  const pr = progress(), d = shell.store.read(), day = dailyState();
  const doneToday = day.t.filter((t) => t != null).length;
  const rushBest = shell.store.best('rush');
  const bits = [`${pr.total()}/${TOTAL_BOARDS} boards`];
  if (pr.perfect()) bits.push(`${pr.perfect()} perfect`);
  if (day.streak) bits.push(`${day.streak}-day streak`);
  shell.title({
    logo: [{ text: 'SYNAPSE', tone: 'mint' }],
    tagline: TAGLINE,
    play: d.last ? 'Continue' : 'Play',
    onPlay: () => continueCampaign(),
    modes: [
      { label: 'Campaign', sub: `${pr.total()} of ${TOTAL_BOARDS} solved`, onClick: () => openCampaign(false) },
      { label: 'Daily', sub: doneToday === 3 ? 'Done for today' : `${3 - doneToday} board${3 - doneToday === 1 ? '' : 's'} today`, onClick: () => openDaily() },
      { label: 'Rush', sub: rushBest ? `Best ${rushBest} boards` : '3-minute sprint', onClick: () => startRush() },
    ],
    best: null,
    extra: pr.total() || day.streak ? el('p', 'sy-record', bits.join(' · ')) : null,
  });
}

// ---------- the title's board: solving itself behind the logo ----------
let attractK = 0;
function startAttract() {
  // a phone held upright: a 6×6 or 7×7 board; anything wider: a big one (it fills the screen behind the logo)
  const small = view && view.w < 600 && view.h > view.w;
  const picks = small ? [[1, 3], [2, 4], [3, 2], [2, 15], [1, 11], [3, 6]] : [[5, 2], [3, 14], [5, 9], [4, 5], [5, 15], [3, 20]];
  const [p, i] = picks[attractK++ % picks.length];
  const s = new Scene(boardAt(p, i), { quiet: true });
  // half of it drawn already (every other color), the rest drawn as it plays
  prefill(s.board, s.pz.sol.map((_, c) => c).filter((c) => c % 2 === attractK % 2));
  s.ap = new Autoplayer(s.board, { pace: 0.14, travel: 0.4, wait: 0.6, hooks: hooksFor(s) });
  show(s);
}

// ---------- the demo (?demo): its own player, a 7×7 board half drawn, then an 8×8 with a bridge, forever ----------
function demoScene(k) {
  const seed = SEED || 7;
  const n7 = (seed * 3 + k) % 10, n8 = 8 + ((seed * 5 + k) % 16);
  const [p, i] = k % 2 === 0 ? [2, n7] : [3, n8];
  const s = new Scene(boardAt(p, i), { quiet: true, label: `${PACKS[p].name} ${i + 1}` });
  // the first board: some paths already drawn, the rest drawn so the network fires between 5.7 and 11.7 s after load
  const now = performance.now() / 1000;
  let wait = 0.5;
  if (k === 0) {
    const order = s.pz.sol.map((P, c) => [P.length, c]).sort((a, b) => b[0] - a[0]).map((x) => x[1]);
    const done = [];
    const fireAt = 8.4;
    const est = () => strokeTime(planStrokes(s.board, { x: s.pz.n / 2, y: s.pz.n + 0.6 }), { pace: 0.12 });
    prefill(s.board, done);
    for (const c of order) {
      if (done.length >= 2 && est() <= Math.min(4.2, fireAt - now - 0.4)) break;
      done.push(c);
      prefill(s.board, done);
    }
    wait = Math.max(0.2, fireAt - now - est());
  }
  s.ap = new Autoplayer(s.board, { pace: 0.12, wait, hooks: hooksFor(s) });
  return s;
}
function nextDemo() {
  demo.k++;
  show(demoScene(demo.k));
}

// ---------- the drag: touch and mouse ----------
let dragId = null, lastPt = null, finger = null, hoverCell = -1;
const playing = () => mode === 'play' && sc && sc.phase === 'play' && shell.state === 'play' && !cardOpen;
function commitDrag() {
  if (sc && sc.board.drag && mode === 'play') onRelease(sc, sc.board.end());
  dragId = null; finger = null; hoverCell = -1;
}
// the cells along the finger's way since the last event, each one walked to in turn (a quick swipe skips none)
function walk(x0, y0, x1, y1) {
  const b = sc.board, n = L.n;
  const dist = Math.hypot(x1 - x0, y1 - y0), steps = Math.max(1, Math.ceil(dist / (L.C * 0.3)));
  let last = -2;
  for (let k = 1; k <= steps; k++) {
    const x = x0 + ((x1 - x0) * k) / steps, y = y0 + ((y1 - y0) * k) / steps;
    const h = cellAt(L, x, y);
    // just off the board: the nearest cell on its edge
    const gx = clamp(Math.floor(h.gx), 0, n - 1), gy = clamp(Math.floor(h.gy), 0, n - 1);
    if (Math.abs(h.gx - clamp(h.gx, 0, n)) > 1.2 || Math.abs(h.gy - clamp(h.gy, 0, n)) > 1.2) continue;
    const cell = gy * n + gx;
    if (cell === last || cell === b.head) { last = cell; continue; }
    last = cell;
    const c = b.dragColor;
    for (const r of b.towards(cell)) onStep(sc, r, b.head, c);
    if (!b.drag) return;
  }
}
pointer(canvas, {
  down(p) {
    if (!playing() || dragId != null) return;
    const h = cellAt(L, p.x, p.y);
    if (h.cell < 0) return;
    const got = sc.board.pick(h.cell, Math.abs(h.fx) > Math.abs(h.fy) ? 1 : 0);
    if (!got) return;
    sc.started = true;
    cursor = -1;
    dragId = p.id;
    lastPt = { x: p.x, y: p.y };
    finger = { x: p.x, y: p.y };
    sc.board.begin(got);
    hooksFor(sc).press(got.c);
    if (sc.ghost) sc.ghost.hold = true;
    canvas.style.cursor = 'grabbing';
  },
  move(p) {
    if (p.id !== dragId || !sc.board.drag) return;
    walk(lastPt.x, lastPt.y, p.x, p.y);
    lastPt = { x: p.x, y: p.y };
    finger = { x: p.x, y: p.y };
    const h = cellAt(L, p.x, p.y);
    hoverCell = h.cell;
  },
  up(p) {
    if (p.id !== dragId) return;
    dragId = null; finger = null; hoverCell = -1;
    canvas.style.cursor = '';
    if (!sc.board.drag) return;
    const tap = p.event?.type === 'pointerup' && p.t < 0.32 && Math.hypot(p.dx, p.dy) < 10;
    onRelease(sc, sc.board.end({ tap }));
    if (sc.ghost) sc.ghost.hold = false;
  },
  hover(p) {
    if (!playing() || p.type !== 'mouse' || !L) return;
    const h = cellAt(L, p.x, p.y);
    canvas.style.cursor = h.cell >= 0 && sc.board.pick(h.cell) ? 'grab' : '';
  },
});

// ---------- the keyboard: arrows move a cursor (or the path held), Space picks up and drops ----------
let cursor = -1, keyUser = false;
addEventListener('pointerdown', () => { keyUser = false; }, { capture: true });
addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target?.closest?.('input, textarea, select')) return;
  if (mode !== 'play' || shell.state !== 'play' || cardOpen || !sc) return;
  const k = e.key;
  const onButton = e.target?.closest?.('button, a');
  if (sc.phase === 'done') {
    if ((k === 'Enter' || k === ' ' || k === 'n' || k === 'N') && !onButton) { e.preventDefault(); doNext(); }
    return;
  }
  if (sc.phase !== 'play') return;
  const b = sc.board, n = b.n;
  const arrows = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 };
  if (k in arrows) {
    e.preventDefault();
    keyUser = true;
    sc.started = true;
    if (cursor < 0) { cursor = b.drag ? b.head : b.pz.pairs[0].s; return; }
    const j = b.nb[cursor * 4 + arrows[k]];
    if (b.drag) {
      if (j < 0) return;
      const c = b.dragColor;
      const r = b.stepTo(j);
      onStep(sc, r, j, c);
      cursor = b.drag ? b.head : cursor;
    } else if (j >= 0) cursor = j;
    return;
  }
  if ((k === ' ' || k === 'Enter') && !onButton) {
    e.preventDefault();
    keyUser = true;
    sc.started = true;
    if (cursor < 0) { cursor = b.pz.pairs[0].s; return; }
    if (b.drag) { const res = b.end(); onRelease(sc, res); return; }
    const got = b.pick(cursor);
    if (got) { b.begin(got); hooksFor(sc).press(got.c); if (got.k >= 0) cursor = b.head; } else sfx.blocked();
    return;
  }
  if (k === 'Escape' && b.drag) { e.preventDefault(); b.cancel(); return; }
  if (k === 'Backspace' || k === 'z' || k === 'Z') { e.preventDefault(); doUndo(); return; }
  if (k === 'h' || k === 'H') { e.preventDefault(); doHint(); return; }
  if ((k === 'r' || k === 'R') && !e.repeat) { e.preventDefault(); doReset(); }
}, { capture: true });

// ---------- the loop ----------
let lastStats = null;
function step(s, dt) {
  s.t += dt;
  if (s.swap < 1) s.swap = Math.min(1, s.swap + dt / 0.42);
  if (s.ap && !s.ap.finished) s.ap.update(dt);
  if (s.fire) updateFire(s, dt);
  if (s.bloom != null) s.bloom += dt / 0.95;
  if (s.gateFlash) { s.gateFlash.t += dt; if (s.gateFlash.t > 0.5) s.gateFlash = null; }
  if (s.ghost) s.ghost.hold = Boolean(s.board.drag);
  if (s.ghost && !s.ghost.hold) {
    const G = s.ghost;
    G.t += dt;
    G.len = clamp(G.t / 0.2, 0, G.cells.length - 1);
    if (G.t > G.cells.length * 0.2 + 0.9) G.t = -0.5;
  }
  s.parts.update(dt);
  s.floats.update(dt);
  s.shake.update(dt);
  renderer.follow(s.board, dt);
  // the counter ticks
  const st = s.board.stats();
  if (lastStats && lastStats.board === s && (st.pairs !== lastStats.pairs)) s.popPairs = 1;
  if (lastStats && lastStats.board === s && (st.pct !== lastStats.pct)) s.popPct = 1;
  s.popPairs = Math.max(0, s.popPairs - dt * 5);
  s.popPct = Math.max(0, s.popPct - dt * 5);
  s.stats = st;
  lastStats = { board: s, pairs: st.pairs, pct: st.pct };
}
const loop = createLoop({
  update(dt) {
    if (mode === 'demo') return;
    if (mode !== 'play' || !sc) return;
    if (sc.phase === 'play' && sc.started && !cardOpen) sc.time += dt;
    if (run.kind === 'rush' && rush && !rush.ended && sc.phase === 'play' && !cardOpen) {
      const before = rush.left;
      rush.left = Math.max(0, rush.left - dt);
      if (Math.ceil(before) !== Math.ceil(rush.left)) {
        updateChips();
        if (rush.left <= 10 && rush.left > 0) sfx.tick();
      }
      for (const [at, kind] of [[90, 'rushHalf'], [30, 'rushLow'], [10, 'rushLast']]) {
        if (before > at && rush.left <= at && !rush.said[kind]) { rush.said[kind] = 1; bubble.show(say(kind, pick), 2000); }
      }
      if (rush.left <= 0) endRush();
    }
  },
  render(alpha, frameDt) {
    const g = view.begin();
    if (!L || !sc) { relayout(); if (!sc) return; }
    const dt = Math.min(frameDt, 0.05);
    // the title's and the demo's boards (and the player's board's animations) move with the frame
    if (mode === 'demo' || mode === 'title') {
      step(sc, dt);
      if (sc.ap && sc.ap.finished && sc.phase === 'play' && !sc.board.solved()) sc.ap = null;
    } else if (shell.state === 'play' || shell.state === 'over') step(sc, shell.state === 'play' ? dt : dt);
    if (pendingAfter > 0) {
      pendingAfter -= dt;
      if (pendingAfter <= 0) {
        pendingAfter = 0;
        if (mode === 'demo') nextDemo();
        else if (mode === 'title') startAttract();
        else if (run && run.kind === 'rush' && rush && !rush.ended) { rush.k++; loadRush(); }
      }
    }
    const b = sc.board;
    const fingerShown = sc.ap && !sc.ap.finished ? sc.ap.finger : null;
    const fingerPx = fingerShown ? { x: L.x + fingerShown.x * L.C, y: L.y + fingerShown.y * L.C, down: fingerShown.down, alpha: fingerShown.alpha } : null;
    let ghostFinger = null;
    if (sc.ghost && !sc.ghost.hold && sc.ghost.t > -0.2) {
      const G = sc.ghost, k = Math.min(G.cells.length - 1, Math.floor(G.len)), f = G.len - k;
      const a = G.cells[k], z = G.cells[Math.min(G.cells.length - 1, k + 1)];
      const pa = renderer.center(a), pz = renderer.center(z);
      ghostFinger = { x: pa.x + (pz.x - pa.x) * f, y: pa.y + (pz.y - pa.y) * f, down: G.t > 0, alpha: 0.75 };
    }
    renderer.draw(g, {
      board: b, t: sc.t, drag: finger || (fingerPx && fingerPx.down ? fingerPx : null),
      hoverCell: finger ? hoverCell : fingerPx && fingerPx.down ? b.head : -1,
      cursor: mode === 'play' && !TOUCH && cursor >= 0 && keyUser ? cursor : -1,
      fire: sc.fire, bloom: sc.bloom, gateFlash: sc.gateFlash, swap: sc.swap, sources: sc.sources, shake: sc.shake,
      finger: fingerPx || ghostFinger, ghost: sc.ghost && sc.ghost.t > 0 && !sc.ghost.hold ? sc.ghost : null,
    });
    sc.parts.draw(g);
    sc.floats.draw(g);
    if (mode !== 'title') {
      const st = sc.stats;
      renderer.drawHead(g, { label: (sc.label || '').toUpperCase(), sub: sc.sub, pairs: st.pairs, total: st.total, pct: st.pct, popPairs: sc.popPairs, popPct: sc.popPct, solvedPanel: mode === 'play' && sc.phase === 'done' });
    }
    if (mode === 'play' && sc.phase === 'play') updateChips();
  },
  paused: () => shell.state !== 'play' && !DEMO,
});

function endRush() {
  if (!rush || rush.ended) return;
  rush.ended = true;
  commitDrag();
  shell.audio.stopMusic();
  bubble.hide();
  const prev = shell.store.best('rush');
  const n = rush.boards;
  const isBest = n > 0 && (prev == null || n > prev);
  shell.over({
    title: "Time's up", score: n, label: n === 1 ? 'board' : 'boards', bestKey: 'rush',
    stats: [['Boards', fmt(n)], ['Perfect', fmt(rush.perfect)], ['Best time', rush.bestTime != null ? fmtTime(rush.bestTime) : '—']],
    line: rushLine(n, isBest, prev, pick), share: rushShare(n),
    onAgain: () => startRush(), onMenu: () => toTitle(),
  });
  announce(`Time's up. ${n} boards.`);
}

// keep the board clear of the bar when the page changes size
view = fitCanvas(canvas, { maxDpr: 2, onResize: () => relayout() });

// QA (`?qa`): a handle for the screenshot scripts; never on a link from the site
if (QUERY.has('qa')) {
  window.__sy = {
    get sc() { return sc; }, get L() { return L; }, get mode() { return mode; },
    camp: (p, i) => startCampaign(p, i), daily: (s) => startDaily(s), rush: () => startRush(), title: () => toTitle(),
    // draw every answer path but the first k colors' (or all), then let go
    fill(skip = 0) {
      const b = sc.board;
      for (let c = skip; c < b.K; c++) b.paths[c] = b.pz.sol[c].slice();
      b.view = b.paths; b.derive();
      if (b.solved()) solved(sc);
    },
    time: (s) => { if (rush) rush.left = s; },
  };
}

// the canvas's words wait for the arcade's fonts (never longer than a moment)
const fonts = Promise.all(["900 40px 'AK Display'", "700 16px 'AK Mono'", "italic 400 18px 'AK Serif'"].map((f) => document.fonts?.load(f).catch(() => null)));
Promise.race([fonts, new Promise((r) => setTimeout(r, 1800))]).then(() => {
  if (DEMO) {
    mode = 'demo';
    demo = { k: 0 };
    show(demoScene(0));
  } else toTitle();
  loop.start();
});
