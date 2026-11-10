// AUTOCOMPLETE on agi1.app (2026-11-09): She predicts your next word. Surprise her.
// A word game against AGI-1's autocomplete, on the arcade kit. Swipe touching letter keys into words; after two letters
// she guesses your word in her suggestion strip (a faint ghost of its path on the board): play her guess for its points,
// another word for ×1.5, a longer one for ×2. Token keys (QU, TH, ING, TION…) count as all their letters. Endless runs on
// a context window that drains faster and faster (words refill it; glitch keys from 90 s); Daily is today's board for
// everyone, 2 minutes; Zen has no clock. This file wires the kit's frame, the input (swipe, tap, mouse, keyboard), the
// loop, the effects and AGI-1's reactions, the title's board and `?demo` (the arcade's preview, its own player).
import './style.css';
import { createShell, el } from '../kit/shell.js';
import { fitCanvas } from '../kit/canvas.js';
import { createLoop } from '../kit/loop.js';
import { pointer } from '../kit/input.js';
import { DEMO, SEED, QUERY, REDUCED } from '../kit/env.js';
import { Particles, Shake, rng, fmt, fmtTime, ease, roundRect } from '../kit/fx.js';
import { createDict } from './dict.js';
import { newBoard, refill } from './board.js';
import { solve, predict, lockLength, surpriseOf, typedPath, stepPath, wordOf, tokensIn, hintWord, COLS, ROWS } from './solver.js';
import {
  scoreWord, CONTEXT, refillFor, newContext, drainContext, addContext, newGlitch, glitchDue, startGlitch, glitchAfterWord,
  pickGlitchCell, DAILY, dayKey, daySeed, newTally, tallyWord,
} from './rules.js';
import { computeLayout, cellAt, cellCenter } from './layout.js';
import { createRenderer, COLOR } from './render.js';
import { createSound, createMusic } from './sound.js';
import { say, endLine, shareText } from './lines.js';
import { chooseWord, planOpening, createSwiper, KNOWN } from './demo.js';
import { logoNode, switchRow, guessChip, createTools, topWordsNode, createLive } from './ui.js';

const TAGLINE = 'She predicts your next word. Surprise her.';
const root = document.getElementById('ak-root');
const shell = createShell({
  game: 'autocomplete', name: 'AUTOCOMPLETE', root,
  howTo: {
    intro: 'Swipe touching letters into words. After two letters AGI-1 guesses your word: surprise her for more points.',
    steps: [
      ['Swipe a word', 'Slide through touching keys, any direction, no key twice, 3 letters or more. Let go to play it. Slide back to undo a key.'],
      ['Surprise her', 'Her guess is in the strip, its path faint on the board. Play it: its points. Another word: ×1.5. A longer word: ×2.'],
      ['Tokens', 'Violet pills like TH, ING or TION count as all their letters, +50% each. Longer words score much more.'],
      ['Keep her context', 'In Endless the context window drains, faster and faster; every word fills it back up. A glitch key wants playing within 3 words.'],
    ],
    touch: [['Swipe', 'Spell a word'], ['Tap… tap', 'Spell it key by key, tap the last key again to play'], ['Complete it', 'Her hint: she shows a word (half points)']],
    keys: [['A–Z', 'Type a word: she finds its path'], ['Enter', 'Play it'], ['Backspace', 'Take a letter back'], ['?', 'Her hint'], ['Drag', 'Swipe with the mouse'], ['Esc', 'Pause']],
  },
  onPause: () => clearSelection(),
  onRestart: () => startRun(run && run.kind !== 'attract' ? run.kind : 'endless'),
  onQuit: () => toTitle(),
});

const canvas = el('canvas', { role: 'img', 'aria-label': 'AUTOCOMPLETE: the board of letter keys' });
const safe = el('div', { class: 'ac-safe', 'aria-hidden': 'true' });
shell.stage.append(canvas, safe);
const announce = createLive(shell.stage);
const renderer = createRenderer();
const sfx = createSound(shell.audio);
const music = createMusic();
const tools = createTools(shell.stage, { hint: () => doHint(), finish: () => finishZen() });
const chipScore = shell.chip('Score', 0, { accent: true });
const chipWords = shell.chip('Words', 0);
const chipTime = shell.chip('Time', '2:00');
let view = null, L = null;

// ---------- the dictionary: fetched as the title shows (about 0.5 MB) ----------
let dict = null;
const dictReady = Promise.all([
  fetch('/games/autocomplete/words.bin').then((r) => { if (!r.ok) throw new Error(`words ${r.status}`); return r.arrayBuffer(); }),
  fetch('/games/autocomplete/common.txt').then((r) => { if (!r.ok) throw new Error(`common ${r.status}`); return r.text(); }),
]).then(([buf, txt]) => { dict = createDict(buf, txt); return dict; });
dictReady.catch(() => { /* the title says so when Play is pressed */ });

// ---------- settings and the store ----------
const showGuess = () => shell.store.read().showGuess !== false;
const setShowGuess = (v) => shell.store.update((d) => { d.showGuess = v; });
const today = () => dayKey(new Date());
const dailyBest = () => { const d = shell.store.read().daily; return d && d.key === today() ? d.best : null; };

// ---------- the state ----------
let mode = 'boot';                 // title · play · demo
let run = null;                    // the board on the screen and its run
let sel = emptySel();              // the path being drawn
let ai = null;                     // the demo's and the title's player
let lesson = null;                 // the first run's ghost finger
const vis = new Map();             // tile id → { y (rows above its cell), vy, delay, scale, press, wobble, flash }
const parts = new Particles(500);
const shake = new Shake({ max: 9, decay: 2.4 });
let bursts = [], stamps = [], flyers = [], fadePath = null;
let faceMood = { mood: 'idle', t: 0, hold: 0 };
let result = null, invalidShake = null, ctxGlow = 0, hitstop = 0, clockT = 0, bestToasted = false;
const pick = (list) => list[Math.floor((DEMO && ai ? ai.rng.next() : Math.random()) * list.length)];

function emptySel() { return { path: [], lock: null, word: '', valid: false, typed: '', partial: 0, tap: false, src: null, following: null, passed: false }; }

class Run {
  constructor(kind, { seed, tiles = null, rngState = null, quiet = false }) {
    this.kind = kind;                // endless · daily · zen · attract · demo
    this.seed = seed;
    this.rng = rng(rngState ?? seed);
    if (tiles) { this.tiles = tiles; this.check = refillCheck(tiles); }
    else { const b = newBoard(dict, this.rng); this.tiles = b.tiles; this.check = b.check; }
    this.tally = newTally();
    this.ctx = newContext();
    this.clock = DAILY.seconds;
    this.t = 0;
    this.started = false;
    this.glitch = newGlitch();
    this.hint = null;
    this.hints = 0;
    this.ended = false; this.endT = 0; this.overShown = false;
    this.quiet = quiet;
    this.lowSaid = false;
    this.prevBest = kind === 'endless' ? shell.store.best('best') : kind === 'daily' ? dailyBest() : kind === 'zen' ? shell.store.best('zen') : null;
  }
}
const refillCheck = (tiles) => ({ words: solve(tiles, dict) });
const loud = () => run && !run.quiet && mode === 'play';

// ---------- layout ----------
function insets() {
  if (DEMO) return { top: 6, right: 6, bottom: 6, left: 6 };
  const cs = getComputedStyle(safe);
  const px = (v) => parseFloat(v) || 0;
  const bar = shell.bar.getBoundingClientRect();
  const st = canvas.getBoundingClientRect();
  return { top: Math.max(bar.bottom - st.top, px(cs.paddingTop)) + 2, right: px(cs.paddingRight) + 4, bottom: px(cs.paddingBottom) + 8, left: px(cs.paddingLeft) + 4 };
}
function relayout() {
  if (!view) return;
  L = computeLayout(view.w, view.h, insets(), { demo: DEMO });
  renderer.setLayout(L, view.dpr);
  tools.place(L.tools, mode === 'play' && !DEMO);
}

// ---------- starting things ----------
function resetVisuals() {
  vis.clear(); parts.clear(); bursts = []; stamps = []; flyers = []; fadePath = null;
  result = null; invalidShake = null; ctxGlow = 0; hitstop = 0;
  sel = emptySel(); lesson = null;
  faceMood = { mood: 'idle', t: 0, hold: 0 };
}
function dropIn(tiles, { from = -ROWS - 1, stagger = true } = {}) {
  tiles.forEach((t, i) => {
    if (!t) return;
    const r = Math.floor(i / COLS), c = i % COLS;
    vis.set(t.id, { y: REDUCED ? 0 : from + (ROWS - r) * 0.12, vy: 0, delay: stagger && !REDUCED ? c * 0.035 + (ROWS - 1 - r) * 0.045 : 0, scale: 1, press: 0, wobble: 0, flash: 0 });
  });
}
function visOf(t) {
  let v = vis.get(t.id);
  if (!v) { v = { y: 0, vy: 0, delay: 0, scale: 1, press: 0, wobble: 0, flash: 0 }; vis.set(t.id, v); }
  return v;
}

function startRun(kind) {
  if (!dict) { whenReady(() => startRun(kind)); return; }
  ai = null;
  shell.closeCard();
  mode = 'play';
  const seed = kind === 'daily' ? daySeed(today()) : (SEED || ((Math.random() * 2 ** 31) >>> 0) || 1);
  resetVisuals();
  run = new Run(kind, { seed });
  if (kind === 'daily') run.day = today();
  dropIn(run.tiles);
  bestToasted = false;
  shell.started();
  relayout();
  updateChips(true, { score: true });
  shell.audio.music(music);
  sfx.select();
  const tut = !shell.store.read().tut && kind !== 'zen';
  if (tut) startLesson();
  else if (kind === 'daily') sayStrip(say('daily', pick), 'daily', 2.4);
  else if (kind === 'zen') sayStrip(say('zen', pick), 'zen', 2.4);
  announce(`${kind === 'daily' ? "Today's board" : kind === 'zen' ? 'Zen' : 'Endless'}. Swipe or type a word.`);
}

function whenReady(fn) {
  if (dict) { fn(); return; }
  const btns = [...root.querySelectorAll('.ak-title .ak-btn')];
  btns.forEach((b) => b.classList.add('is-loading'));
  const play = root.querySelector('.ak-title .ak-btn-play');
  const old = play ? play.lastChild.textContent : '';
  if (play) play.lastChild.textContent = 'Loading words…';
  dictReady.then(() => { btns.forEach((b) => b.classList.remove('is-loading')); if (play) play.lastChild.textContent = old; fn(); })
    .catch(() => { if (play) play.lastChild.textContent = old; shell.toast("Couldn't load the words. Try again", 'warn', 2400); });
}

// ---------- the title: its own board behind the menu, AGI-1 playing it ----------
function toTitle() {
  clearSelection();
  shell.audio.stopMusic();
  mode = 'title';
  tools.place(null, false);
  if (dict) startAttract(); else { run = null; dictReady.then(() => { if (mode === 'title' && !run) startAttract(); }); }
  const best = shell.store.best('best');
  const db = dailyBest();
  shell.title({
    logo: logoNode(),
    tagline: TAGLINE,
    play: 'Play',
    onPlay: () => whenReady(() => startRun('endless')),
    modes: [
      { label: 'Daily', sub: db != null ? `Today's best ${fmt(db)}` : "Today's board · 2 min", onClick: () => whenReady(() => startRun('daily')) },
      { label: 'Zen', sub: 'No clock, no rush', onClick: () => whenReady(() => startRun('zen')) },
    ],
    best: best != null && best > 0 ? best : null,
    extra: guessChip(showGuess, setShowGuess),
  });
}
function startAttract() {
  resetVisuals();
  const seed = 1 + Math.floor(Math.random() * 1e6);
  run = new Run('attract', { seed, quiet: true });
  run.started = true;
  dropIn(run.tiles);
  ai = { rng: rng(seed ^ 0x5bd1e995), swiper: createSwiper({ pace: 0.17, reach: 0.3, hold: 0.25 }), queue: [], wait: 1.2, think: [1.0, 1.8] };
  relayout();
}

// ---------- the demo (?demo): its own player, a board planned for the arcade's 6-second clip ----------
let demoK = 0;
function startDemo() {
  mode = 'demo';
  resetVisuals();
  const seed = SEED || 7;
  const plan = demoK === 0 ? planOpening(dict, seed) : null;
  if (plan) {
    run = new Run('demo', { seed, tiles: plan.tiles, rngState: plan.rngState });
    // already in a run: a score, some words, the context two thirds full, a glitch key counting down
    Object.assign(run.tally, { score: 1240, words: 9, surprises: 6 });
    run.ctx.value = 66; run.ctx.running = true; run.ctx.t = 96;
    run.t = 96; run.started = true;
    run.glitch.nextAt = 999;
    if (plan.glitchCell >= 0) { startGlitch(run.glitch, run.tiles[plan.glitchCell].id); run.tiles[plan.glitchCell].glitch = run.glitch.left; }
  } else {
    run = new Run('demo', { seed: (seed * 31 + demoK * 977) >>> 0 || 1 });
    run.ctx.running = true; run.started = true;
    dropIn(run.tiles);
  }
  ai = {
    rng: rng((seed * 2654435761 + demoK) >>> 0 || 1),
    swiper: createSwiper({ pace: 0.12, reach: 0.17, hold: 0.1 }),
    // the opening: A surprises her, then B (a long word with a token) beats her guess, inside the recorded seconds
    queue: plan ? [{ path: plan.A.path, at: 5.62 }, { word: plan.B.word, at: 7.15 }] : [],
    wait: 0.6, think: [0.45, 0.85],
  };
  relayout();
}

// ---------- the path ----------
const canInput = () => mode === 'play' && run && !run.ended && shell.state === 'play';
function clearSelection() {
  sel = emptySel();
  dragId = null; tapOnLast = false; pendingTap = null;
}
function beginPath(cell, src) {
  if (!run || run.ended || !run.tiles[cell]) return;
  result = null;
  if (lesson && src !== 'ai') { lesson = null; }
  if (!run.started) startClock();
  sel = emptySel();
  sel.src = src;
  setPath([cell], 'add');
}
function enterCell(cell) {
  if (!sel.path.length || !run.tiles[cell]) return;
  const r = stepPath(sel.path, cell);
  if (r.action === 'add' || r.action === 'undo') setPath(r.path, r.action);
}
function setPath(path, action) {
  sel.path = path;
  sel.partial = 0;
  const letters = wordOf(run.tiles, path).length;
  if (loud()) {
    if (action === 'add') { sfx.key(letters - 1); shell.haptic(6); }
    else if (action === 'undo') sfx.back(letters);
  }
  if (action === 'add') { const v = visOf(run.tiles[path[path.length - 1]]); v.flash = 0.6; }
  pathChanged();
}
function pathChanged() {
  const tiles = run.tiles;
  const n = lockLength(tiles, sel.path);
  if (!n) sel.lock = null;
  else if (!sel.lock || sel.lock.n !== n || sel.lock.prefix.some((c, k) => c !== sel.path[k])) {
    const prefix = sel.path.slice(0, n);
    sel.lock = { n, prefix, guesses: predict(tiles, dict, prefix) };
  }
  const word = wordOf(tiles, sel.path);
  const g = sel.lock && sel.lock.guesses[0];
  sel.following = g ? g.word.startsWith(word) : null;
  sel.passed = g ? word.length > g.word.length && word.startsWith(g.word) : false;
  const valid = word.length >= 3 && !sel.partial && dict.has(word);
  if (valid && !sel.valid && loud() && sel.path.length > 1) sfx.valid();
  sel.valid = valid;
  sel.word = word;
  if (!sel.path.length) return;
  const seen = showGuess() || mode !== 'play';
  setMood(!g || !seen ? (sel.lock ? 'think' : 'watch') : sel.following ? 'smug' : sel.passed ? 'nervous' : 'think', 0);
}

// the finger lets go, Enter, the last key tapped again: play the path
function submit() {
  const path = sel.path;
  if (!path.length || !run) { clearSelection(); return; }
  const word = wordOf(run.tiles, path);
  if (sel.partial) { invalidWord(path, 'finish the token'); return; }
  if (word.length < 3) { fadePath = { path: path.slice(), a: 0.7 }; clearSelection(); setMood('idle', 0); return; }
  if (!dict.has(word)) { invalidWord(path, null); return; }
  acceptWord(path, word);
}

function invalidWord(path, why) {
  fadePath = { path: path.slice(), a: 1 };
  for (const i of path) { const t = run.tiles[i]; if (t) visOf(t).wobble = 1; }
  invalidShake = { t: 0 };
  const line = why || ((mode === 'play' && Math.random() < 0.4) ? say('invalid', pick) : 'not in my vocabulary');
  result = { kind: 'invalid', badge: 'NOT A WORD', line, t: 0, hold: 1.3 };
  setMood('sad', 0.9);
  if (loud()) { sfx.bonk(); shell.haptic([8, 40, 8]); announce(`${wordOf(run.tiles, path).toUpperCase()} is not a word.`); }
  clearSelection();
}

function acceptWord(path, word) {
  const tiles = run.tiles;
  const g = sel.lock && sel.lock.guesses[0];
  const hinted = Boolean(run.hint && run.hint.word === word);
  const kind = hinted ? 'predictable' : surpriseOf(word, g ? g.word : null);
  const tokens = tokensIn(tiles, path);
  const glitchTile = path.map((i) => tiles[i]).find((t) => t.glitch);
  const { points } = scoreWord({ word, tokens, kind, glitch: Boolean(glitchTile), hinted });
  const tally = run.tally;
  tallyWord(tally, { word, points, kind });
  // where it happened, on the screen
  const pts = path.map((i) => renderer.centerOf({ tiles, vis }, i));
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length, cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  // the keys pop, letters fly
  path.forEach((i, k) => {
    const t = tiles[i];
    bursts.push({ tile: t, x: pts[k].x, y: pts[k].y, t: -k * 0.028 });
    parts.burst({ x: pts[k].x, y: pts[k].y, count: 9, speed: [80, 260], life: [0.35, 0.75], size: [4, 8], colors: [COLOR.honey, COLOR.pink, COLOR.cream, COLOR.violet2], shape: 'square', spin: 8, gravity: 520, drag: 1.6, stroke: COLOR.ink });
  });
  if (kind !== 'predictable') parts.burst({ x: cx, y: cy, count: kind === 'longer' ? 22 : 12, speed: [120, 380], life: [0.5, 1], size: [7, 12], colors: kind === 'longer' ? [COLOR.mint, COLOR.honey, '#ffffff'] : [COLOR.pink, COLOR.honey], shape: 'star', spin: 6, drag: 2.2, stroke: COLOR.ink });
  // the word and its points fly up to the score
  const target = scoreTarget();
  flyers.push({ word: word.toUpperCase(), pts: `+${fmt(points)}`, x0: cx, y0: cy - L.pitch * 0.4, x1: target.x, y1: target.y, t: -0.18, dur: 0.62, color: kind === 'longer' ? COLOR.mint : kind === 'surprise' ? COLOR.pink : COLOR.honey, landed: false, score: tally.score });
  // long words: a stamp, a shake, a beat of stillness
  if (word.length >= 6) {
    const names = ['SIX!', 'SEVEN!!', 'EIGHT!!!', 'NINE!!!!', 'TEN!!!!!'];
    stamps.push({ text: names[Math.min(4, word.length - 6)], t: 0, dur: 0.9, x: L.board.x + L.board.w / 2, y: L.board.y + L.board.h * 0.3, rot: -0.1 + (word.length % 2) * 0.06, color: word.length >= 7 ? COLOR.mint : COLOR.honey, size: word.length >= 7 ? 0.92 : 0.8 });
    shake.kick(0.32 + 0.08 * (word.length - 6));
    hitstop = 0.08;
  }
  // her reaction
  const glitchRes = run.kind === 'endless' || run.kind === 'demo' ? glitchAfterWord(run.glitch, Boolean(glitchTile), run.t) : 'none';
  const badge = hinted ? 'HER HINT' : kind === 'longer' ? 'LONGER 2X' : kind === 'surprise' ? 'SURPRISE 1.5X' : 'PREDICTABLE';
  let line = hinted ? 'told you 💜' : say(word.length >= 7 && kind !== 'predictable' && Math.random() < 0.4 ? 'long' : kind, pick);
  if (glitchRes === 'fixed') line = say('fixed', pick);
  result = { kind: hinted ? 'hint' : kind, badge: glitchTile ? `GLITCH 2X · ${badge}` : badge, line, t: 0, hold: 2.2 };
  setMood(kind === 'predictable' ? (hinted ? 'happy' : 'smug') : 'shock', kind === 'longer' ? 1.5 : 1.1);
  // the context window fills back up (Endless)
  if (run.kind === 'endless' || run.kind === 'demo') {
    const got = addContext(run.ctx, refillFor(points) + (glitchRes === 'fixed' ? CONTEXT.glitchFixed : 0));
    if (got > 0) ctxGlow = 1;
    if (run.ctx.value >= CONTEXT.low) run.lowSaid = false;
  }
  if (loud()) {
    sfx.word(word.length, kind);
    if (kind === 'longer') sfx.longer(); else if (kind === 'surprise') sfx.surprise(); else sfx.predictable();
    if (word.length >= 6) setTimeout(() => sfx.stamp(), 60);
    if (glitchRes === 'fixed') sfx.fixed();
    shell.haptic(kind === 'longer' || word.length >= 6 ? [12, 30, 22] : 12);
    announce(`${word.toUpperCase()}: ${points} points. ${kind === 'longer' ? 'Longer than her guess.' : kind === 'surprise' ? 'A surprise.' : 'Her guess.'}`);
    if (!shell.store.read().tut) shell.store.update((d) => { d.tut = 1; });
  }
  // the board: the keys go, the rest fall, new ones drop in
  run.hint = null;
  if (lesson) lesson = null;
  const glitchId = run.glitch.tileId;
  applyRefill(refill(tiles, path, dict, run.rng, { keep: [] }), 0.12);
  if (glitchRes === 'tick') { const t = run.tiles.find((x) => x.id === glitchId); if (t) { t.glitch = run.glitch.left; visOf(t).flash = 0.8; } }
  if (glitchRes === 'corrupt') corrupt(glitchId);
  clearSelection();
  updateChips(true);
  if (mode === 'play' && run.prevBest != null && run.prevBest > 0 && !bestToasted && tally.score > run.prevBest) {
    bestToasted = true;
    setTimeout(() => { if (mode === 'play') { shell.toast('New best!', 'good', 1600); sfx.select(); } }, 700);
  }
}

// a refill on the screen: keys fall to their new rows, new keys drop in, a bouncy stagger
function applyRefill(res, wait = 0) {
  // (offsets add up: a key still falling from the last refill keeps falling from where it is)
  const before = new Map(run.tiles.map((t, i) => [t ? t.id : -1, i]));
  for (const m of res.moves) {
    const v = vis.get(m.id) || visOf({ id: m.id });
    const c = colOf(before.get(m.id));
    v.y = REDUCED ? 0 : v.y + m.from - m.to; v.vy = Math.min(v.vy, 0); v.delay = Math.max(v.delay, wait + c * 0.018);
  }
  for (const s of res.spawns) {
    const i = res.tiles.findIndex((x) => x && x.id === s.id);
    const c = i % COLS;
    const v = visOf(res.tiles[i]);
    if (s.pop || REDUCED) { v.y = 0; v.scale = REDUCED ? 1 : 0.2; v.delay = wait; }
    else { v.y = s.from - s.to; v.vy = 0; v.delay = wait + 0.05 + c * 0.03 + (ROWS - 1 - s.to) * 0.025; }
  }
  run.tiles = res.tiles;
  run.check = res.check;
}
const colOf = (i) => i % COLS;

function corrupt(id) {
  const i = run.tiles.findIndex((t) => t && t.id === id);
  if (i < 0) return;
  const p = renderer.centerOf({ tiles: run.tiles, vis }, i);
  bursts.push({ tile: run.tiles[i], x: p.x, y: p.y, t: -0.25, red: true });
  parts.burst({ x: p.x, y: p.y, count: 26, speed: [140, 420], life: [0.4, 0.9], size: [4, 9], colors: [COLOR.red, '#3ff0c3', COLOR.ink], shape: 'square', spin: 10, gravity: 400, drag: 1.4 });
  shake.kick(0.4);
  if (run.kind === 'endless' || run.kind === 'demo') addContext(run.ctx, -CONTEXT.glitchCorrupt);
  result = { kind: 'invalid', badge: 'CORRUPTED', line: say('corrupt', pick), t: 0, hold: 2 };
  setMood('sad', 1.2);
  if (loud()) { setTimeout(() => sfx.corrupt(), 220); shell.haptic([20, 50, 30]); }
  applyRefill(refill(run.tiles, [i], dict, run.rng), 0.3);
}

// ---------- AGI-1: her face, her strip ----------
function setMood(mood, hold) { if (faceMood.mood !== mood) faceMood = { mood, t: 0, hold }; else faceMood.hold = Math.max(faceMood.hold, hold); }
function sayStrip(line, kind = 'say', hold = 2.2) { result = { kind, badge: null, line, t: 0, hold }; }
function restingMood() {
  if (!run) return 'idle';
  if ((run.kind === 'endless' || run.kind === 'demo') && run.started && run.ctx.value < CONTEXT.low) return 'worried';
  if (run.kind === 'daily' && run.started && run.clock < 15) return 'worried';
  return 'idle';
}

// ---------- the clock, the context window, glitches (fixed 120 Hz steps) ----------
function startClock() {
  run.started = true;
  if (run.kind === 'endless') run.ctx.running = true;
}
function tick(dt) {
  if (!run || run.ended) {
    if (run && run.ended) {
      run.endT += dt;
      if (mode === 'play' && !run.overShown && run.endT > 1.05) showOver();
      if (mode === 'demo' && run.endT > 1.4) { demoK++; startDemo(); }
    }
    return;
  }
  if (!run.started) return;
  run.t += dt;
  if (run.kind === 'endless' || run.kind === 'demo') {
    const before = run.ctx.value;
    drainContext(run.ctx, run.kind === 'demo' ? dt * 0.55 : dt);
    if (before >= CONTEXT.low && run.ctx.value < CONTEXT.low && !run.lowSaid) {
      run.lowSaid = true;
      if (!sel.path.length) sayStrip(say('low', pick), 'low', 2);
      if (loud()) sfx.low();
    }
    if (run.ctx.value < 12 && loud() && Math.floor(run.t * 1.4) !== Math.floor((run.t - dt) * 1.4)) sfx.tick();
    if (run.ctx.value <= 0) endRun('context');
    // a glitch key (Endless)
    if (run.kind === 'endless' && glitchDue(run.glitch, run.t)) spawnGlitch();
  } else if (run.kind === 'daily') {
    const before = run.clock;
    run.clock = Math.max(0, run.clock - dt);
    if (Math.ceil(before) !== Math.ceil(run.clock)) {
      updateChips();
      if (run.clock <= 10 && run.clock > 0 && loud()) sfx.tick();
    }
    if (run.clock <= 0) endRun('time');
  }
}
function spawnGlitch() {
  const cell = pickGlitchCell(run.tiles, run.check.words, dict, run.rng, sel.path);
  if (cell < 0) { run.glitch.nextAt = run.t + 3; return; }
  startGlitch(run.glitch, run.tiles[cell].id);
  run.tiles[cell].glitch = run.glitch.left;
  visOf(run.tiles[cell]).flash = 1;
  visOf(run.tiles[cell]).wobble = 0.8;
  if (!sel.path.length) sayStrip(say('glitch', pick), 'glitch', 2.2);
  if (loud()) { sfx.glitch(); shell.haptic(16); announce('A glitch key: play it within 3 words.'); }
}

function endRun(reason) {
  if (run.ended) return;
  run.ended = true; run.endT = 0; run.reason = reason;
  clearSelection();
  run.hint = null;
  sayStrip(reason === 'context' ? 'i lost the thread… 🙈' : reason === 'time' ? "time's up!" : 'that was cozy 💜', reason, 9);
  setMood(reason === 'context' ? 'sad' : 'happy', 9);
  if (loud()) { shell.audio.stopMusic(); sfx.end(); shell.haptic([30, 60, 30]); }
}
function finishZen() {
  if (!canInput() || run.kind !== 'zen') return;
  endRun('zen');
}
function showOver() {
  run.overShown = true;
  const t = run.tally, kind = run.kind;
  let best, isBest;
  if (kind === 'daily') {
    const prev = dailyBest();
    isBest = t.score > 0 && (prev == null || t.score > prev);
    if (isBest) shell.store.update((d) => { d.daily = { key: run.day, best: t.score }; });
    best = isBest ? t.score : prev;
  }
  const score = t.score;
  shell.over({
    title: kind === 'endless' ? 'Context lost' : kind === 'daily' ? "Time's up" : 'Zen done',
    score, label: 'points',
    ...(kind === 'daily' ? { best, isBest } : { bestKey: kind === 'zen' ? 'zen' : 'best' }),
    stats: [['Words', fmt(t.words)], ['Longest word', t.longest ? t.longest.toUpperCase() : '—'], ['Surprises', fmt(t.surprises)], ['Longer words', fmt(t.longer)]],
    line: endLine({ score, isBest: kind === 'daily' ? isBest : (score > 0 && (run.prevBest == null || score > run.prevBest)), mode: kind, surprises: t.surprises, words: t.words }, pick),
    share: shareText({ surprises: t.surprises, score: fmt(score), mode: kind }),
    extra: topWordsNode(t.top),
    again: kind === 'daily' ? 'Play Endless' : 'Play again',
    onAgain: () => startRun(kind === 'daily' ? 'endless' : kind),
    onMenu: () => toTitle(),
  });
}

// ---------- her hint: "complete it for me" ----------
function hintCost() { return !run ? '' : run.kind === 'endless' ? `−${CONTEXT.hint}%` : run.kind === 'daily' ? `−${DAILY.hintCost}s` : 'free'; }
function doHint() {
  if (!canInput()) return;
  if (run.hint) { result = null; return; }
  if (run.kind === 'endless' && run.started && run.ctx.value <= CONTEXT.hint + 3) { shell.toast('Not enough context', 'warn'); sfx.bonk(); return; }
  const h = hintWord(run.tiles, dict, run.check.words, (w, info) => (dict.rankOf(w) < KNOWN ? scoreWord({ word: w, tokens: info.tokens }).points : 0));
  if (!h) return;
  if (!run.started) startClock();
  if (run.kind === 'endless') addContext(run.ctx, -CONTEXT.hint);
  if (run.kind === 'daily') run.clock = Math.max(1, run.clock - DAILY.hintCost);
  run.hint = h; run.hints++;
  clearSelection();
  result = null;
  sayStrip(say('hint', pick), 'hint', 2.2);
  setMood('happy', 1.2);
  sfx.hint();
  shell.haptic(10);
  announce(`Her hint: ${h.word.toUpperCase()}.`);
  updateChips();
}

// ---------- the score in the bar ----------
function updateChips(pop = false, { score = false } = {}) {
  const daily = run && run.kind === 'daily';
  chipTime.hide(!daily);
  if (!run || mode !== 'play') return;
  if (score) chipScore.set(run.tally.score);
  chipWords.set(run.tally.words, { pop });
  if (daily) chipTime.set(fmtTime(Math.ceil(run.clock)));
  chipTime.node.classList.toggle('is-low', daily && run.clock <= 15);
  tools.set({ mode: run.kind, cost: hintCost(), enabled: !run.ended && !run.hint, active: Boolean(run.hint) });
}
function scoreTarget() {
  if (DEMO || mode !== 'play') return { x: L.ctx.x + L.ctx.w - 24, y: L.ctx.y + L.ctx.h / 2 };
  const r = chipScore.node.getBoundingClientRect(), c = canvas.getBoundingClientRect();
  return { x: r.left + r.width / 2 - c.left, y: r.top + r.height / 2 - c.top };
}

// ---------- the first run's lesson: a ghost finger draws a word until you touch the board ----------
function startLesson() {
  const words = [...run.check.words].filter(([w, info]) => w.length === 4 && dict.rankOf(w) >= 0 && dict.rankOf(w) < 3000 && info.tokens === 0)
    .sort((a, b) => dict.rankOf(a[0]) - dict.rankOf(b[0]));
  if (!words.length) return;
  lesson = { path: words[0][1].path, word: words[0][0], swiper: createSwiper({ pace: 0.3, reach: 0.45, hold: 0.5 }), drawn: [], wait: 0.9 };
  sayStrip(say('start', pick), 'lesson', 999);
}
function stepLesson(dt) {
  if (!lesson) return;
  const s = lesson.swiper;
  if (!s.busy) {
    lesson.wait -= dt;
    if (lesson.wait <= 0) { lesson.drawn = []; s.start(lesson.path, 0); }
  }
  s.update(dt, {
    start: (c) => { lesson.drawn = [c]; },
    enter: (c) => { lesson.drawn.push(c); },
    release: () => { lesson.wait = 1.1; lesson.fade = 1; },
  });
  if (lesson.fade > 0) lesson.fade = Math.max(0, lesson.fade - dt * 2.2);
}

// ---------- touch and mouse: swipe, or tap key by key ----------
let dragId = null, lastPt = null, fingerPt = null, moved = false, tapOnLast = false, pendingTap = null, downAt = null;
function walk(x0, y0, x1, y1) {
  const dist = Math.hypot(x1 - x0, y1 - y0), steps = Math.max(1, Math.ceil(dist / (L.pitch * 0.18)));
  for (let k = 1; k <= steps; k++) {
    const x = x0 + ((x1 - x0) * k) / steps, y = y0 + ((y1 - y0) * k) / steps;
    const cell = cellAt(L, x, y);
    if (cell >= 0 && cell !== sel.path[sel.path.length - 1]) enterCell(cell);
  }
}
pointer(canvas, {
  down(p) {
    if (!canInput() || dragId != null || !L) return;
    const cell = cellAt(L, p.x, p.y, true);
    if (cell < 0) return;
    dragId = p.id; lastPt = { x: p.x, y: p.y }; fingerPt = { x: p.x, y: p.y, down: true }; moved = false; downAt = cell;
    tapOnLast = false; pendingTap = null;
    sel.typed = '';
    if (sel.tap && sel.path.length) {
      const last = sel.path[sel.path.length - 1];
      if (cell === last) { tapOnLast = true; return; }
      const r = stepPath(sel.path, cell);
      if (r.action === 'add' || r.action === 'undo') { pendingTap = { cell }; setPath(r.path, r.action); return; }
    }
    beginPath(cell, 'touch');
  },
  move(p) {
    if (p.id !== dragId) return;
    fingerPt = { x: p.x, y: p.y, down: true };
    if (!moved && Math.hypot(p.dx, p.dy) > Math.max(10, L.pitch * 0.22)) {
      moved = true;
      // a drag that started away from the end of a tapped path starts a new word there
      if (pendingTap) { beginPath(pendingTap.cell, 'touch'); pendingTap = null; }
      tapOnLast = false;
    }
    if (!sel.path.length) return;
    walk(lastPt.x, lastPt.y, p.x, p.y);
    lastPt = { x: p.x, y: p.y };
  },
  up(p) {
    if (p.id !== dragId) return;
    dragId = null; fingerPt = null;
    if (!canInput()) return;
    if (p.event?.type === 'pointercancel') { clearSelection(); return; }
    const tap = !moved && p.event?.type === 'pointerup';
    if (tap) {
      if (tapOnLast) {
        // the last key tapped again: play it (or, with too few letters, let it go)
        if (wordOf(run.tiles, sel.path).length >= 3) submit(); else { clearSelection(); setMood('idle', 0); }
        return;
      }
      sel.tap = true;       // key by key: the path stays
      pendingTap = null;
      return;
    }
    submit();
  },
});

// ---------- the keyboard: type the letters, she finds the path ----------
addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (!canInput()) return;
  if (e.target?.closest?.('input, textarea, select')) return;
  const k = e.key;
  const onButton = e.target?.closest?.('button, a');
  if (/^[a-zA-Z]$/.test(k)) { e.preventDefault(); typeLetter(k.toLowerCase()); return; }
  if (k === 'Backspace') { e.preventDefault(); typeBack(); return; }
  if (k === 'Delete') { e.preventDefault(); clearSelection(); return; }
  if ((k === 'Enter' || k === ' ') && !onButton) { e.preventDefault(); if (sel.path.length) submit(); return; }
  if (k === '?' || k === '/') { e.preventDefault(); doHint(); }
}, { capture: true });
function typeLetter(ch) {
  if (dragId != null) return;
  const fromKeys = sel.src === 'keys';
  const typed = (fromKeys ? sel.typed : '') + ch;
  const found = typedPath(run.tiles, typed, fromKeys ? sel.path : []);
  if (!found) {
    // no path spells it: the letter isn't taken
    if (loud()) sfx.bonk();
    invalidShake = { t: 0 };
    return;
  }
  if (!fromKeys) { result = null; if (!run.started) startClock(); lesson = null; sel = emptySel(); sel.src = 'keys'; }
  sel.typed = typed; sel.path = found.path; sel.partial = found.partial;
  if (loud()) sfx.key(typed.length - 1);
  const t = run.tiles[found.path[found.path.length - 1]];
  if (t) visOf(t).flash = 0.6;
  pathChanged();
}
function typeBack() {
  if (sel.src !== 'keys' || !sel.typed) { if (sel.path.length) { const r = sel.path.slice(0, -1); if (r.length) setPath(r, 'undo'); else clearSelection(); } return; }
  const typed = sel.typed.slice(0, -1);
  if (!typed) { clearSelection(); return; }
  const found = typedPath(run.tiles, typed, sel.path);
  if (!found) { clearSelection(); return; }
  sel.typed = typed; sel.path = found.path; sel.partial = found.partial;
  if (loud()) sfx.back(typed.length);
  pathChanged();
  if (found.partial) sel.valid = false;
}

// ---------- the AI's turn (the demo, the title) ----------
function stepAI(dt, now) {
  if (!ai || !run || run.ended || !L) return;
  const sw = ai.swiper;
  if (!sw.busy) {
    ai.wait -= dt;
    if (ai.wait <= 0) {
      let path = null, at = null;
      while (!path && ai.queue.length) {
        const q = ai.queue.shift();
        path = q.path || (run.check.words.get(q.word) || {}).path || null;
        at = q.at;
      }
      if (!path) { const c = chooseWord(run.tiles, dict, run.check.words, ai.rng); path = c ? c.path : null; }
      if (path) sw.start(path, at != null ? Math.max(0, at - now) : 0);
      else ai.wait = 0.5;
    }
  }
  sw.update(dt, {
    start: (c) => beginPath(c, 'ai'),
    enter: (c) => enterCell(c),
    release: () => { submit(); ai.wait = ai.think[0] + ai.rng.next() * (ai.think[1] - ai.think[0]); },
  });
}

// ---------- the loop ----------
function stepVisuals(dt) {
  clockT += dt;
  shake.update(dt);
  parts.update(dt);
  const settle = hitstop > 0;
  hitstop = Math.max(0, hitstop - dt);
  for (const [, v] of vis) {
    if (v.delay > 0) { if (!settle) v.delay -= dt; }
    else if (v.y < 0 || v.vy !== 0) {
      v.vy += 62 * dt;
      v.y += v.vy * dt;
      if (v.y >= 0) { v.y = 0; v.vy = v.vy > 3 ? -v.vy * 0.24 : 0; }
    }
    if (v.scale !== 1 && v.delay <= 0) v.scale = Math.min(1, v.scale + dt * 6 * (1.2 - v.scale + 0.2));
    v.wobble = Math.max(0, v.wobble - dt * 2.6);
    v.flash = Math.max(0, v.flash - dt * 3.2);
  }
  for (const b of bursts) b.t += dt;
  bursts = bursts.filter((b) => b.t < 0.22);
  for (const s of stamps) s.t += dt;
  stamps = stamps.filter((s) => s.t < s.dur);
  for (const f of flyers) {
    f.t += dt;
    if (!f.landed && f.t >= f.dur) {
      f.landed = true;
      if (mode === 'play' && run) { chipScore.set(f.score, { pop: true }); if (!run.quiet) sfx.tick(); }
    }
  }
  flyers = flyers.filter((f) => f.t < f.dur);
  if (fadePath) { fadePath.a -= dt * 2.8; if (fadePath.a <= 0) fadePath = null; }
  if (invalidShake) { invalidShake.t += dt; if (invalidShake.t > 0.4) invalidShake = null; }
  ctxGlow = Math.max(0, ctxGlow - dt * 1.8);
  faceMood.t += dt;
  if (faceMood.hold > 0) faceMood.hold -= dt;
  else if (!sel.path.length && faceMood.mood !== restingMood() && !(run && run.ended)) faceMood = { mood: restingMood(), t: 0, hold: 0 };
  if (result) { result.t += dt; if (result.t > result.hold && !(run && run.ended)) result = null; }
}

function render(alpha, frameDt) {
  const g = view.begin();
  if (!L) relayout();
  const dt = Math.min(frameDt, 0.05);
  const now = performance.now() / 1000;
  if (mode === 'title' || mode === 'demo') stepAI(dt, now);
  if (mode === 'play' && shell.state === 'play') stepLesson(dt);
  if (shell.state !== 'pause') stepVisuals(dt);
  renderer.background(g, view.w, view.h);
  if (!run || !dict) { drawLoading(g); return; }
  g.save();
  shake.apply(g, L.board.x + L.board.w / 2, L.board.y + L.board.h / 2);
  // the board
  const selSet = new Set(sel.path);
  let ghost = null;
  const pickG = sel.lock && sel.lock.guesses[0];
  if (pickG && (showGuess() || mode !== 'play') && sel.path.length && pickG.path.length > sel.path.length && sel.path.every((c, k) => pickG.path[k] === c)) ghost = { path: pickG.path, from: sel.path.length };
  const aiF = ai && ai.swiper.finger.show ? toPx(ai.swiper.finger) : null;
  const lessonF = lesson && lesson.swiper.finger.show ? toPx(lesson.swiper.finger) : null;
  const finger = fingerPt && sel.path.length ? fingerPt : aiF && aiF.down ? aiF : null;
  renderer.drawBoard(g, {
    tiles: run.tiles, vis, sel: sel.path, selSet, over: run.ended ? Math.min(1, run.endT / 0.5) : 0, ghost,
    hint: run.hint && !run.ended ? { path: run.hint.path } : null, finger: finger ? { ...finger, show: false } : null, t: clockT,
    fade: fadePath ? { path: fadePath.path, a: fadePath.a } : lesson && lesson.drawn.length ? { path: lesson.drawn, a: 0.7 * (lesson.swiper.busy ? 1 : lesson.fade || 0), color: COLOR.lav2 } : null,
  });
  for (const b of bursts) drawBurst(g, b);
  parts.draw(g);
  g.restore();
  // the strip, her face, the context window (the title shows only the board behind its menu)
  if (mode !== 'title') {
    drawStripNow(g);
    renderer.drawFace(g, { mood: faceMood.mood, t: faceMood.t, T: clockT });
    drawContextNow(g);
    for (const s of stamps) renderer.drawStamp(g, s);
    for (const f of flyers) if (f.t > 0) renderer.drawFlyer(g, f);
  }
  if (aiF) renderer.drawFinger(g, aiF);
  if (lessonF) renderer.drawFinger(g, lessonF);
}
function toPx(f) { return { x: L.board.x + f.x * L.pitch, y: L.board.y + f.y * L.pitch, down: f.down, alpha: f.alpha }; }
function drawBurst(g, b) {
  if (b.t < 0) return;
  const k = b.t / 0.22;
  const sc = k < 0.35 ? 1 + 0.18 * ease.outQuad(k / 0.35) : 1.18 * (1 - ease.inQuad((k - 0.35) / 0.65));
  g.save();
  g.globalAlpha = 1 - Math.max(0, k - 0.6) / 0.4;
  g.translate(b.x, b.y); g.scale(sc, sc);
  const cap = L.cap;
  const r = cap * 0.2;
  roundRect(g, -cap / 2, -cap / 2, cap, cap, r);
  g.fillStyle = b.red ? COLOR.red : COLOR.honey; g.fill(); g.lineWidth = 3; g.strokeStyle = COLOR.ink; g.stroke();
  g.font = `900 ${Math.round(cap * (b.tile.token ? 0.27 : 0.5))}px 'AK Display', sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = COLOR.ink; g.fillText(b.tile.s.toUpperCase(), 0, cap * 0.02);
  g.restore();
}
function drawStripNow(g) {
  const word = sel.path.length ? (sel.src === 'keys' ? sel.typed.toUpperCase() : sel.word.toUpperCase()) : '';
  const showResult = result && (!sel.path.length || (run && run.ended));
  let guesses = sel.lock ? sel.lock.guesses : null;
  let hint = false;
  if (!sel.path.length && run.hint) { guesses = [{ word: run.hint.word }]; hint = true; }
  renderer.drawStrip(g, {
    word, valid: sel.valid, guesses, following: sel.following, passed: sel.passed, hint,
    hidden: mode === 'play' && !showGuess() && !hint,
    result: showResult ? result : null, invalid: invalidShake, t: clockT,
    idleLeft: run.kind === 'attract' ? 'her turn' : TOUCH_WORD,
  });
}
const TOUCH_WORD = 'swipe';
function drawContextNow(g) {
  const k = run.kind;
  const scoreText = DEMO ? fmt(run.tally.score) : null;
  if (k === 'daily') renderer.drawContext(g, { label: 'TIME', value: run.clock / DAILY.seconds, low: run.clock < 15, glow: 0, t: clockT, color: run.clock < 15 ? COLOR.red : COLOR.honey, score: scoreText });
  else if (k === 'zen') renderer.drawContext(g, { label: 'ZEN', value: 1, low: false, glow: 0, t: clockT, color: 'rgba(63,240,195,0.35)', score: scoreText });
  else if (k === 'attract') renderer.drawContext(g, { label: 'CONTEXT', value: 0.5 + 0.4 * Math.sin(clockT * 0.4), low: false, glow: 0, t: clockT });
  else renderer.drawContext(g, { label: 'CONTEXT', value: run.ctx.value / CONTEXT.max, low: run.started && run.ctx.value < CONTEXT.low, glow: ctxGlow, t: clockT, score: scoreText });
}
function drawLoading(g) {
  if (!L) return;
  g.font = "italic 400 20px 'AK Serif', Georgia, serif"; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = COLOR.lav2;
  g.fillText('loading her vocabulary…', L.board.x + L.board.w / 2, L.board.y + L.board.h / 2);
}

const loop = createLoop({
  update(dt) {
    if (mode === 'play' && shell.state === 'play') tick(dt);
    else if (mode === 'demo') tick(dt);
  },
  render,
  paused: () => shell.state !== 'play' && !DEMO,
});

// the pause card gets her switch (and How to play its credit line), whenever the kit draws them
const layerObserver = new MutationObserver(() => {
  const sw = root.querySelector('.ak-layer .ak-switches');
  if (sw && !sw.querySelector('.ac-guess-switch')) sw.prepend(switchRow('Show her guess', showGuess, setShowGuess, 'ac-guess-switch'));
  const how = [...root.querySelectorAll('.ak-layer .ak-card')].find((c) => c.querySelector('.ak-steps'));
  if (how && !how.querySelector('.ac-credit')) {
    how.querySelector('.ak-card-actions')?.before(el('p', 'ak-fine ac-credit', 'Word list: ENABLE (public domain) and SCOWL by Kevin Atkinson, filtered for a family arcade.'));
  }
});
layerObserver.observe(root.querySelector('.ak-layer') || root, { childList: true, subtree: true });

view = fitCanvas(canvas, { maxDpr: 2, onResize: () => relayout() });

// QA (`?qa`): handles for the screenshot scripts (never on a link from the site)
if (QUERY.has('qa')) {
  window.__ac = {
    get run() { return run; }, get sel() { return sel; }, get L() { return L; }, get mode() { return mode; }, get dict() { return dict; },
    start: (k) => startRun(k), title: () => toTitle(),
    context: (v) => { if (run) run.ctx.value = v; },
    clock: (s) => { if (run) run.clock = s; },
    time: (s) => { if (run) { run.t = s; run.ctx.t = s; } },
    glitch: () => spawnGlitch(),
    words: () => [...run.check.words.keys()],
    play: (word) => { const info = run.check.words.get(word); if (!info) return false; beginPath(info.path[0], 'touch'); for (const c of info.path.slice(1)) enterCell(c); submit(); return true; },
  };
}

// the canvas's words wait for the arcade's fonts (never longer than a moment)
const fonts = Promise.all(["900 40px 'AK Display'", "700 16px 'AK Mono'", "italic 400 18px 'AK Serif'", "600 14px 'AK Sans'"].map((f) => document.fonts?.load(f).catch(() => null)));
Promise.race([fonts, new Promise((r) => setTimeout(r, 1800))]).then(() => {
  relayout();
  loop.start();
  if (DEMO) dictReady.then(() => { startDemo(); }).catch(() => {});
  else toTitle();
});
