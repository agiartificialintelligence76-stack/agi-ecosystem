// I'M NOT A ROBOT on agi1.app (2026-11-08): Prove you're human. Four seconds at a time.
// AGI-1 is an AI sneaking into the humans-only internet in a cardboard mustache; you pass its silly human checks for
// her, one tiny four-second check at a time, faster and faster. This file wires the arcade kit's frame (../kit/shell.js),
// the input (touch, mouse and keys, all into the run's one input), the loop, the sounds and the three ways it runs: the
// player's run, the title (its gate's checkbox is the play button), and `?demo` (the arcade's preview: the drawn hand
// plays, seeded, silent, forever).
import './style.css';
import { createShell, el } from '../kit/shell.js';
import { fitCanvas } from '../kit/canvas.js';
import { createLoop } from '../kit/loop.js';
import { pointer } from '../kit/input.js';
import { DEMO, SEED, TOUCH, QUERY } from '../kit/env.js';
import { Particles, FloatText, Shake, rng } from '../kit/fx.js';
import { CHECKS, byId, commandOf } from './checks/index.js';
import { Run } from './run.js';
import { createBot } from './bot.js';
import { createRenderer, layout, drawTitleWindows } from './render.js';
import { createSfx, createMusic } from './sound.js';
import { LINES, endLine, shareText, plain } from './lines.js';
import { bpmFor } from './tempo.js';
import { C } from './art.js';
import { W, H } from './checks/util.js';

const TAGLINE = "Prove you're human. Four seconds at a time.";
const NS = 'http://www.w3.org/2000/svg';
const root = document.getElementById('ak-root');
const shell = createShell({
  game: 'notarobot', name: "I'M NOT A ROBOT", root,
  howTo: {
    intro: 'AGI-1 wants into the humans-only internet. Pass its silly human checks for her, one tiny check at a time.',
    steps: [
      ['Read the command', 'Each check slams in with one word or two: TICK IT!, ONLY CATS!, SLIDE IT!… then do it before the fuse burns out.'],
      ['Get stamped', 'VERIFIED HUMAN for a pass, a bonus when you\'re quick. Every 5 passes, everything gets faster.'],
      ['Mind the suspicion', 'A fail lights a suspicion light. Four lights and she\'s caught. Pass a FINAL VERIFICATION (every 15) to fix one.'],
    ],
    touch: [['Tap', 'Tick, pick, press'], ['Drag', 'Slide, turn, smile, sign'], ['Hold', 'Hold… let go'], ['Hands off', 'DON\'T! means don\'t']],
    keys: [['Mouse', 'Click, drag, hold'], ['Arrows', 'Move, turn, slide, shake'], ['Space', 'Click, hold, tap'], ['A–Z, 1–5', 'Type it, count, in order'], ['Esc', 'Pause']],
  },
  onPause: () => { run?.releaseAll(); activeId = null; },
  onRestart: () => newRun(),
  onQuit: () => toTitle(),
});

const canvas = el('canvas', { role: 'img', 'aria-label': "I'M NOT A ROBOT: a browser window with a human check in it" });
const safe = el('div', { class: 'nr-safe', 'aria-hidden': 'true' });
const live = el('p', { class: 'ak-sr', 'aria-live': 'polite' });
shell.stage.append(canvas, safe, live);
let view = null;
view = fitCanvas(canvas, { maxDpr: 2, onResize: () => relayout() });
const renderer = createRenderer();
const M = renderer.R.moments;
const sfx = createSfx(shell.audio);
let music = null;
const parts = new Particles(420);
const floats = new FloatText();
const shake = new Shake({ max: 12, decay: 2.2 });
const face = new Image();
face.decoding = 'async';
face.src = '/images/landing/agi1-face.webp';

let L = null;
let mode = 'boot';             // title · play · demo
let run = null, bot = null;
let time = 0, shown = 0, lastInput = TOUCH ? 'touch' : 'mouse', activeId = null, buffered = null;
let demoRuns = 0, runs = 0, bestAtStart = null, beatBest = false;
let later = [];                // [{ at, fn }]: moments a little after an event (the stamp landing…)
let titleWins = null;
const lineRoll = rng(SEED || 11);
const pick = (list) => list[Math.floor((DEMO ? lineRoll.next() : Math.random()) * list.length)];

// ---------- the layout: clear of the kit's bar and the notch ----------
function insets() {
  if (DEMO) return { top: 6, right: 6, bottom: 6, left: 6 };
  const cs = getComputedStyle(safe);
  const px = (v) => parseFloat(v) || 0;
  const bar = shell.bar.getBoundingClientRect();
  const st = canvas.getBoundingClientRect();
  return { top: Math.max(bar.bottom - st.top, px(cs.paddingTop)) + 6, right: px(cs.paddingRight) + 6, bottom: px(cs.paddingBottom) + 10, left: px(cs.paddingLeft) + 6 };
}
function relayout() { if (view) L = layout(view.w, view.h, insets(), { demo: DEMO }); }

// ---------- AGI-1's words ----------
function say(kind, { force = false, dur = 2.6, n = 0 } = {}) {
  const now = renderer.R.say;
  if (!force && now && time - now.at < 1.4) return;
  const text = pick(LINES[kind]).replace('{n}', String(n));
  renderer.R.say = { text: plain(text), at: time, dur };
}

// ---------- the player's run ----------
function newRun() {
  later = [];
  parts.clear(); floats.clear();
  renderer.R.say = null;
  const seed = SEED && runs === 0 ? SEED : ((Math.random() * 2 ** 31) >>> 0) || 1;
  // the first check of every run: the famous checkbox
  run = new Run({ seed, checks: CHECKS, first: ['tick'], touch: TOUCH });
  runs++;
  shown = 0;
  bestAtStart = shell.store.best();
  beatBest = false;
  mode = 'play';
  activeId = null; buffered = null;
  shell.started();
  music = createMusic(bpmFor(1));
  shell.audio.music(music);
  later.push({ at: time + 0.15, fn: () => say('start', { force: true, dur: 2.4 }) });
  announce('A new run. Pass each human check before its fuse burns out.');
}
function endRun() {
  if (DEMO) { newDemoRun(); return; }
  const s = run.stats();
  shell.audio.stopMusic();
  const prev = shell.store.best();
  const isBest = s.score > 0 && (prev == null || s.score > prev);
  shell.store.update((d) => {
    d.checks = (Number(d.checks) || 0) + s.passed;
    d.bestChecks = Math.max(Number(d.bestChecks) || 0, s.passed);
    d.bosses = (Number(d.bosses) || 0) + s.bosses;
  });
  shell.over({
    score: s.score, label: 'human points', title: 'Caught!',
    stats: [
      ['Checks passed', String(s.passed)],
      ['Tempo reached', String(s.tempo)],
      ['Bosses beaten', String(s.bosses)],
      ['Fastest pass', s.fastest == null ? '—' : `${s.fastest.toFixed(2)} s`],
    ],
    line: endLine(s, isBest, pick),
    share: shareText(s),
    onAgain: () => newRun(),
    onMenu: () => toTitle(),
  });
  announce(`Caught. ${s.passed} checks passed, ${s.score} human points.`);
}
function announce(text) { live.textContent = text; }

// ---------- the title: the gate's checkbox is the play button ----------
function svg(tag, attrs, ...kids) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  for (const k of kids) n.append(k);
  return n;
}
let gateBusy = false, gateBtn = null;
function gate() {
  gateBusy = false;
  const box = el('span', { class: 'nr-box', 'aria-hidden': 'true' },
    el('span', 'nr-spin'),
    svg('svg', { viewBox: '0 0 24 24', class: 'nr-tick' }, svg('path', { d: 'M5 12.6l4.6 4.6L19.2 7.4' })));
  gateBtn = el('button', { class: 'nr-check', type: 'button', 'aria-label': "I'm not a robot: tick it to start" }, box, el('span', 'nr-check-label', "I'm not a robot"));
  gateBtn.addEventListener('click', () => { shell.audio.unlock(); tickGate(); });
  // our own little seal: a robot head in a cardboard mustache
  const seal = svg('svg', { viewBox: '0 0 40 40', class: 'nr-seal', 'aria-hidden': 'true' },
    svg('path', { d: 'M20 4v6', class: 'nr-seal-line' }),
    svg('circle', { cx: 20, cy: 4.5, r: 3, class: 'nr-seal-dot' }),
    svg('rect', { x: 7, y: 10, width: 26, height: 21, rx: 6, class: 'nr-seal-head' }),
    svg('rect', { x: 12, y: 15.5, width: 5, height: 5, rx: 1.4, class: 'nr-seal-eye' }),
    svg('rect', { x: 23, y: 15.5, width: 5, height: 5, rx: 1.4, class: 'nr-seal-eye' }),
    svg('path', { d: 'M20 24.6c-2.6-3-7.6-2.6-8.6.6 1.6-.8 3.4-.3 4.4.7 1.3-1.2 3-1.4 4.2-1.3 1.2-.1 2.9.1 4.2 1.3 1-1 2.8-1.5 4.4-.7-1-3.2-6-3.6-8.6-.6z', class: 'nr-seal-stache' }));
  const kept = shell.store.read();
  const rec = Number(kept.bestChecks) > 0 ? el('p', 'nr-record', `Most checks in a run: ${Number(kept.bestChecks)}`) : null;
  return el('div', 'nr-gate-wrap',
    el('div', { class: 'nr-gate', role: 'group', 'aria-label': 'Human check' },
      el('div', 'nr-gate-bar', el('span', { class: 'nr-dots', 'aria-hidden': 'true' }, el('i'), el('i'), el('i')), el('span', 'nr-addr', 'human-check://gate-00')),
      el('div', 'nr-gate-body', gateBtn, el('span', 'nr-brand', seal, el('small', null, 'human', el('br'), 'check')))),
    rec);
}
function tickGate() {
  if (gateBusy || mode !== 'title') return;
  gateBusy = true;
  shell.audio.unlock();
  gateBtn?.classList.add('is-busy');
  sfx.fx('grab');
  setTimeout(() => { gateBtn?.classList.remove('is-busy'); gateBtn?.classList.add('is-on'); sfx.fx('tick'); }, 380);
  setTimeout(() => { if (mode === 'title') newRun(); }, 820);
}
function toTitle() {
  mode = 'title';
  shell.audio.stopMusic();
  run = null; bot = null; later = [];
  parts.clear(); floats.clear();
  if (!titleWins) titleWins = makeTitleWins();
  shell.title({ logo: ["I'M NOT", { text: 'A ROBOT', tone: 'mint' }], tagline: TAGLINE, hidePlay: true, extra: gate(), best: shell.store.best(), onPlay: () => tickGate() });
}
// three checks floating behind the title
function makeTitleWins() {
  const mk = (id, level, seed) => {
    const def = byId(id), st = def.setup(level, rng(seed), { T: 4, tempo: 1, speed: 1, boss: false });
    st.fx = []; st.anim = 0; st.t = 0; st.level = level;
    return { cur: { def, st }, boss: null, played: seed % 40 };
  };
  return [
    { run: mk('cats', 2, 21), x: 0.06, y: 0.2, s: 0.4, r: -0.16, ph: 0, a: 0.42 },
    { run: mk('slide', 1, 7), x: 0.95, y: 0.24, s: 0.36, r: 0.14, ph: 2, a: 0.42 },
    { run: mk('hold', 2, 3), x: 0.05, y: 0.88, s: 0.36, r: 0.12, ph: 4, a: 0.38 },
    { run: mk('findbot', 2, 12), x: 0.95, y: 0.88, s: 0.4, r: -0.12, ph: 1, a: 0.38 },
  ];
}

// ---------- the demo (?demo): the hand plays, from tempo 4, forever ----------
// the preview films 5.7 to 11.7 s after the page opens: two quick checks and a TEMPO UP before that, then ONLY CATS!,
// TICK IT!, DON'T! (the hand can't resist: BEEP, a light comes on) and SLIDE IT!'s command (tools/games/notarobot/
// demo-timeline.mjs prints the schedule)
const DEMO_FIRST = ['odd', 'smile', 'cats', 'tick', 'dont', 'slide', 'findbot', 'type', 'turn', 'count', 'swat', 'hold'];
function newDemoRun() {
  const seed = (SEED || 7) + demoRuns * 7919;
  const first = demoRuns === 0;
  run = new Run({ seed, checks: CHECKS, tempo: 4, passed: 8, score: 96, suspicion: 1, demo: true, first: first ? DEMO_FIRST : null, startDelay: first ? 0.5 : 0.6 });
  // its blunders: one now and then (the first run's is placed for the preview's six seconds)
  bot = createBot(seed, { blunders: (n) => (first ? n === 5 : n % 6 === 4) });
  demoRuns++;
  shown = run.score;
  mode = 'demo';
  later = [];
}

// ---------- input: a finger, a mouse, a pen, the keyboard ----------
const playing = () => mode === 'play' && shell.state === 'play' && run && !run.ended;
const contentAt = (p) => renderer.toContent(L, p.x, p.y);
pointer(canvas, {
  down(p) {
    if (!playing()) return;
    const type = p.type === 'touch' ? 'touch' : 'mouse';
    lastInput = type;
    const c = contentAt(p);
    if (activeId == null) activeId = p.id;
    if (run.phase === 'bumper' && run.pd - run.pt < 0.16) { buffered = { x: c.x, y: c.y, type, up: null }; return; }
    run.ptr('down', c.x, c.y, type);
  },
  move(p) {
    if (!playing() || p.id !== activeId) return;
    const c = contentAt(p);
    run.ptr('move', c.x, c.y, p.type === 'touch' ? 'touch' : 'mouse');
  },
  up(p) {
    if (!run || p.id !== activeId) return;
    activeId = null;
    const c = contentAt(p);
    if (buffered && !buffered.up) { buffered.up = { x: c.x, y: c.y }; return; }
    if (playing()) run.ptr('up', c.x, c.y, p.type === 'touch' ? 'touch' : 'mouse');
  },
  hover(p) {
    if (!playing() || p.type === 'touch') return;
    lastInput = 'mouse';
    const c = contentAt(p);
    run.ptr('hover', c.x, c.y, 'mouse');
  },
});
canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && run && activeId == null) run.ptr('leave'); });

const KEYS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', ' ': 'act', Enter: 'act', a: 'left', d: 'right', w: 'up', s: 'down' };
function keyName(e, def) {
  const k = e.key;
  if (k.length === 1 && /[a-z]/i.test(k) && def?.letters) return `k:${k.toUpperCase()}`;
  if (/^[1-9]$/.test(k)) return `n:${k}`;
  return KEYS[k] ?? KEYS[k.toLowerCase?.()] ?? null;
}
addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || !playing()) return;
  if (e.target?.closest?.('input, textarea, select')) return;
  const def = run.cur?.def;
  const name = keyName(e, def);
  if (!name) return;
  if ((e.key === ' ' || e.key === 'Enter') && e.target?.closest?.('button, a')) return;
  e.preventDefault();
  if (e.repeat) return;
  lastInput = 'key';
  run.key(name, true);
}, { capture: true });
addEventListener('keyup', (e) => {
  if (!run) return;
  const name = keyName(e, run.cur?.def);
  if (name) run.key(name, false);
});
addEventListener('blur', () => run?.releaseAll());

// ---------- what happened this frame: sounds, sparkles, her words ----------
const confetti = [C.mint, C.honey, C.pink, C.lav2, C.sky, C.white];
function screenOf(x, y) { return renderer.toScreen(L, x, y); }
function onEvent(e) {
  const quiet = DEMO;
  switch (e.type) {
    case 'bumper':
      if (!quiet) sfx.bumper(run.tempo);
      later.push({ at: time + 0.19, fn: () => { if (!quiet) sfx.slam(); shake.kick(0.14); } });
      announce(e.boss ? 'Final verification: three checks on one fuse.' : `Next check: ${commandOf(run.cur.def, run.cur.st)}`);
      break;
    case 'step':
      if (!quiet) sfx.step();
      later.push({ at: time + 0.19, fn: () => shake.kick(0.1) });
      break;
    case 'stepPass': {
      const p = screenOf(W / 2, H / 2);
      parts.burst({ x: p.x, y: p.y, count: 18, speed: [120, 380], life: [0.4, 0.8], size: [4, 8], colors: confetti, shape: 'square', gravity: 500, spin: 8 });
      break;
    }
    case 'pass': {
      M.stampAt = time;
      later.push({ at: time + 0.16, fn: () => {
        const p = screenOf(W / 2, H / 2);
        parts.burst({ x: p.x, y: p.y, count: e.boss ? 70 : 34, speed: [160, e.boss ? 620 : 460], life: [0.5, 1.1], size: [5, 10], colors: confetti, shape: 'square', gravity: 700, spin: 9, stroke: '#170a36' });
        parts.burst({ x: p.x, y: p.y, count: 10, speed: [60, 200], life: [0.4, 0.7], size: [7, 12], colors: [C.honey, C.white], shape: 'star', gravity: 200, spin: 4 });
        shake.kick(e.boss ? 0.45 : 0.24);
        if (!quiet) { sfx.pass(run.tempo, e.bonus, run.streak); shell.haptic(e.boss ? [20, 40, 20] : 14); }
        M.scoreAt = time;
      } });
      if (e.repaired) {
        later.push({ at: time + 0.55, fn: () => {
          M.repairAt = time;
          const p = renderer.lampAt(L, run.sus);
          parts.burst({ x: p.x, y: p.y, count: 16, speed: [60, 220], life: [0.4, 0.8], size: [5, 9], colors: [C.mint, C.white, C.honey], shape: 'star', gravity: 120, spin: 6 });
          floats.add({ x: p.x, y: p.y - 18, text: 'FIXED', size: 16, color: C.mint });
          if (!quiet) sfx.repair();
          say('repair', { force: true });
        } });
      }
      // a new best, mid-run: a moment for it (once a run)
      if (!DEMO && bestAtStart != null && !beatBest && run.score > bestAtStart) {
        beatBest = true;
        later.push({ at: time + 0.45, fn: () => { shell.toast('New best!', 'good'); sfx.best(); say('best', { force: true }); } });
      } else if (e.boss) say('bossPass', { force: true });
      else if (run.streak >= 5 && run.streak % 5 === 0) say('streak', { force: true, n: run.streak });
      else if (e.label === 'LIGHTNING' && pick([0, 1, 0]) === 1) say('quick');
      else if (pick([0, 0, 1]) === 1) say('pass');
      announce(`Verified human. ${e.passed} checks passed.`);
      break;
    }
    case 'fail':
      M.stampAt = time; M.failAt = time; M.slipAt = time;
      if (!quiet) sfx.fail();
      later.push({ at: time + 0.2, fn: () => {
        M.lightAt = time; M.lightIdx = e.sus - 1;
        if (!quiet) sfx.light();
        shake.kick(0.38);
        if (!quiet) shell.haptic([30, 40, 30]);
      } });
      if (e.sus === 3) say('lastLight', { force: true }); else if (e.boss) say('bossFail', { force: true }); else say('fail', { force: true });
      announce(`Suspiciously robotic. ${e.sus} of 4 suspicion lights.`);
      break;
    case 'tempo':
      M.tempoAt = time;
      if (!quiet) sfx.tempo();
      music?.setBpm(bpmFor(e.tempo));
      say('tempo', { force: true });
      announce(`Tempo up: ${e.tempo}. Everything gets faster.`);
      break;
    case 'bossIntro':
      M.bossAt = time;
      if (!quiet) sfx.boss();
      say('boss', { force: true });
      break;
    case 'caught':
      M.caughtAt = time;
      if (!quiet) { sfx.caught(); shell.audio.stopMusic(); shell.haptic([60, 60, 120]); }
      shake.kick(0.6);
      renderer.R.say = { text: 'caught. they saw the antenna', at: time + 0.3, dur: 3 };
      break;
    case 'end':
      endRun();
      break;
    default: break;
  }
}
function onCheckFx(f) {
  if (!DEMO) sfx.fx(f.type, f);
  const p = screenOf(f.x, f.y), s = L.win.s;
  switch (f.type) {
    case 'good': parts.burst({ x: p.x, y: p.y, count: 12, speed: [80, 260 * s], life: [0.3, 0.6], size: [5, 9], colors: [C.mint, C.white, C.honey], shape: 'star', gravity: 300, spin: 6 }); break;
    case 'bad': parts.burst({ x: p.x, y: p.y, count: 10, speed: [60, 220 * s], life: [0.3, 0.55], size: [3, 6], colors: [C.pink, C.red, '#170a36'], shape: 'spark', drag: 3 }); break;
    case 'tick': case 'snap': parts.burst({ x: p.x, y: p.y, count: 1, speed: [0, 0], life: [0.4, 0.4], size: [30 * s, 30 * s], colors: [C.honey], shape: 'ring', grow: 60 * s }); parts.burst({ x: p.x, y: p.y, count: 8, speed: [100, 240 * s], life: [0.3, 0.5], size: [4, 7], colors: [C.honey, C.white], shape: 'square', spin: 8 }); break;
    case 'splat': parts.burst({ x: p.x, y: p.y, count: 14, speed: [80, 260 * s], life: [0.3, 0.6], size: [4, 8], colors: [C.lav2, C.red, C.white], shape: 'circle', drag: 4 }); floats.add({ x: p.x, y: p.y - 20 * s, text: 'SPLAT', size: 20 * Math.max(0.8, s), color: C.honey }); break;
    case 'mash': parts.burst({ x: p.x, y: p.y, count: 1, speed: [0, 0], life: [0.3, 0.3], size: [70 * s, 70 * s], colors: [C.pink], shape: 'ring', grow: 120 * s }); break;
    case 'type': parts.burst({ x: p.x, y: p.y, count: 6, speed: [60, 160 * s], life: [0.25, 0.45], size: [3, 6], colors: [C.mint, C.honey], shape: 'square', spin: 6 }); break;
    default: break;
  }
}

// ---------- the loop ----------
function step(dt) {
  time += dt;
  run.kb = lastInput === 'key';
  if (mode === 'demo') bot.update(dt, run);
  const before = run.phase;
  run.update(dt);
  if (before === 'bumper' && run.phase === 'play' && buffered) {
    const b = buffered; buffered = null;
    run.ptr('down', b.x, b.y, b.type);
    if (b.up) run.ptr('up', b.up.x, b.up.y, b.type);
  }
  if (run.events.length) { const ev = run.events.splice(0); for (const e of ev) onEvent(e); }
  const st = run.cur?.st;
  if (st && st.fx.length) { const fl = st.fx.splice(0); if (L) for (const f of fl) onCheckFx(f); }
  // the last second of a fuse ticks
  if (!DEMO && run.phase === 'play' && run.left < 0.25 && run.left > 0) sfx.fuse();
}
function runLater() {
  if (!later.length) return;
  const due = later.filter((l) => l.at <= time);
  if (!due.length) return;
  later = later.filter((l) => l.at > time);
  for (const l of due) l.fn();
}
function tick(dt) {
  if ((mode === 'play' || mode === 'demo') && run && !run.ended) step(dt);
  else time += dt;
  runLater();
  parts.update(dt);
  floats.update(dt);
  shake.update(dt);
}
function frame() {
  const g = view.begin();
  if (!L) relayout();
  const t = time;
  if (mode === 'title' || !run) {
    renderer.draw(g, { L, run: null, t: performance.now() / 1000, dpr: view.dpr, img: face, shake, parts, floats, title: true });
    if (titleWins) drawTitleWindows(g, L, null, titleWins, performance.now() / 1000, renderer);
    return;
  }
  // the score counts up to the real one
  if (shown < run.score) shown = Math.min(run.score, shown + Math.max(1, Math.ceil((run.score - shown) * 0.18)));
  renderer.draw(g, { L, run, t, dpr: view.dpr, img: face, shake, parts, floats, botHand: mode === 'demo' ? bot.hand : null, keyboard: !DEMO && (lastInput === 'key' || (!TOUCH && lastInput !== 'touch')), shown, title: false });
  // the mouse pointer: hidden where a check draws its own
  const cur = mode === 'play' && run.phase === 'play' ? run.cur?.def.cursor || '' : '';
  if (canvas.style.cursor !== cur) canvas.style.cursor = cur;
}
const loop = createLoop({
  update: tick,
  render: frame,
  paused: () => shell.state !== 'play' && !DEMO,
});

// QA (`?qa`): a handle for the screenshot scripts; never on a link from the site
if (QUERY.has('qa')) {
  window.__nr = {
    get run() { return run; }, get L() { return L; }, get mode() { return mode; },
    // play a given check next (at a level)
    force(id, level = 1) {
      const def = byId(id);
      run.cur = run.make(def, level, 4.5);
      run.setPhase('bumper', 0.6);
      run.events.push({ type: 'bumper', id, level });
    },
    // how long one frame takes to draw (ms)
    bench(n = 60) { const t0 = performance.now(); for (let i = 0; i < n; i++) frame(); return (performance.now() - t0) / n; },
  };
}

// the canvas's words wait for the arcade's fonts (never longer than a moment)
const fonts = Promise.all(["900 40px 'AK Display'", "700 16px 'AK Sans'", "650 16px 'AK Mono'", "italic 400 18px 'AK Serif'"].map((f) => document.fonts?.load(f).catch(() => null)));
if (DEMO) {
  // the preview's clock is the page's: the run is where it would be had it started as the page did
  relayout();
  newDemoRun();
  const behind = Math.min(3, performance.now() / 1000);
  for (let s = 0; s < behind; s += 1 / 120) tick(1 / 120);
  loop.start();
} else {
  Promise.race([fonts, new Promise((r) => setTimeout(r, 1800))]).then(() => {
    relayout();
    toTitle();
    loop.start();
  });
}
