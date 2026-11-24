// CONTEXT WINDOW: the page. The arcade kit's frame, the layout, the controls (swipes, drags, arrows / WASD), the loop,
// and what each of the rules' events looks and sounds like. The rules are ./rules.js (pure), the demo's player ./ai.js,
// the picture ./render.js, the sound ./sound.js, her words ./lines.js.
import './style.css';
import { createShell, el } from '../kit/shell.js';
import { createLoop } from '../kit/loop.js';
import { pointer, keyboard } from '../kit/input.js';
import { DEMO, SEED, TOUCH, QUERY } from '../kit/env.js';
import { fmt, clamp } from '../kit/fx.js';
import { createHer } from '../kit/her.js';
import { createRun, update, drain, turn, dimsFor, holding, frontRun, dailySeed, TUNE, TRAILS, trailOpen, colorsAt } from './rules.js';
import { createBot, think } from './ai.js';
import { createRenderer, layout as layoutBoard, draw, fx, cellCenter } from './render.js';
import { createSound } from './sound.js';
import { say, endLine, shareText, TIPS } from './lines.js';

const root = document.getElementById('ak-root');
const shell = createShell({
  game: 'contextwindow', name: 'CONTEXT WINDOW', root,
  howTo: {
    intro: 'AGI-1’s cursor eats tokens, and every token joins her train of thought. Her tail is her context.',
    steps: [
      ['Hold a thought', 'Eat three or more of one color in a row. The run at the front of her tail glows: she’s holding it.'],
      ['Commit it', 'Then eat a DIFFERENT color: the run is compressed out of her context for 10 × n × n points. Six in a row is worth four times three.'],
      ['Chain', 'Commit again within 8 seconds to build a chain, up to ×5.'],
      ['Mind the junk', 'Grey spam never matches. Commit a thought right in front of it to shatter it, and the two sides join.'],
      ['Don’t overflow', 'Her context holds 24. Past that she forgets her oldest token and loses a heart. Three hearts.'],
      ['Don’t bonk', 'The edges, the red firewalls and her own tail end the run (not in Zen).'],
    ],
    touch: [['Swipe or drag', 'Steer (you can keep your finger down)']],
    keys: [['Arrows / WASD', 'Steer'], ['Esc / P', 'Pause']],
  },
  onRestart() { if (run) start(run.mode); },
  onQuit() { queueMicrotask(toTitle); },
});

const canvas = el('canvas', { class: 'cw-canvas', role: 'img', 'aria-label': 'AGI-1’s cursor on a grid of tokens, her context trailing behind her.' });
const safe = el('div', { class: 'cw-safe', 'aria-hidden': 'true' });
const tipText = el('span');
const tip = el('p', { class: 'cw-tip', hidden: true, role: 'status' }, tipText);
shell.stage.append(canvas, safe, tip);
const R = createRenderer(canvas);
const her = createHer(shell.stage, { cls: 'cw-her', status: 'listening…' });
const snd = createSound(shell.audio);
const scoreChip = shell.chip('', 0, { accent: true });
const levelChip = shell.chip('Lv', 1);
const heartChip = shell.chip('', '♥♥♥');
try { document.fonts?.load("900 20px 'AK Display'"); } catch { /* fallback font meanwhile */ }

// `?qa` (browser checks only): its state readable from the page, nothing saved
const QA = QUERY.has('qa');
let save = shell.store.read();
const persist = () => { if (!QA) shell.store.update((d) => Object.assign(d, save)); };
if (typeof save.commits !== 'number') save.commits = 0;
if (!save.tips || typeof save.tips !== 'object') save.tips = {};
if (!TRAILS.some((t) => t.id === save.trail)) save.trail = 'sticker';

let S = null, bot = null, run = null, clock = 0, endAt = 0, lastShatter = 0, warnedFull = false;
const playing = () => Boolean(S && run && !run.attract && shell.state === 'play' && !S.over && !bot);

// ---------- layout ----------
function layout() {
  const box = shell.stage.getBoundingClientRect();
  const w = Math.max(1, Math.round(box.width)), h = Math.max(1, Math.round(box.height));
  const dpr = clamp(Math.min(window.devicePixelRatio || 1, 2, 2600 / w), 1, 2);
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
  const cs = getComputedStyle(safe);
  const st = parseFloat(cs.paddingTop) || 0, sb = parseFloat(cs.paddingBottom) || 0, sl = parseFloat(cs.paddingLeft) || 0, sr = parseFloat(cs.paddingRight) || 0;
  const short = h < 520 && w > h * 1.25;
  const barB = DEMO ? st + 4 : shell.bar.getBoundingClientRect().bottom - box.top;
  const herH = her.node.hidden || short ? 8 : her.node.getBoundingClientRect().height + 22;
  if (!S) return;
  layoutBoard(R, { w, h, dpr, top: barB + 2, bottom: (DEMO ? sb + 8 : herH + sb), left: sl, right: sr }, S.W, S.H);
}
new ResizeObserver(() => layout()).observe(shell.stage);

// ---------- controls ----------
let anchor = null;
const steer = (name) => { if (playing() && turn(S, name)) snd.turn(); };
pointer(canvas, {
  down(p) { anchor = { x: p.x, y: p.y }; },
  move(p) {
    if (!anchor || !playing()) return;
    const dx = p.x - anchor.x, dy = p.y - anchor.y, th = TOUCH ? 18 : 12;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < th) return;
    steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    anchor = { x: p.x, y: p.y };
  },
  up() { anchor = null; },
  tap() { if (playing() && S.ready > 0) S.ready = 0; },
});
keyboard({ ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down', ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right' }, {
  blocked: () => shell.state !== 'play',
  down(name) { steer(name); },
});

// ---------- tips, the first time ----------
function coach(id) {
  if (DEMO || QA || !run || run.attract || save.tips[id] || !TIPS[id]) return;
  save.tips[id] = true;
  persist();
  tipText.textContent = TIPS[id];
  tip.hidden = false;
  tip.classList.remove('is-in'); void tip.offsetWidth; tip.classList.add('is-in');
  clearTimeout(coach.t);
  coach.t = setTimeout(() => { tip.hidden = true; }, 5200);
}
const speak = (kind, opts = {}) => { if (run && !run.attract && !DEMO) her.say(say(kind), opts.ms || 2600, opts); };

// ---------- the rules' events ----------
function hearts() { return S.cfg.hearts ? '♥'.repeat(Math.max(0, S.hearts)) + '♡'.repeat(Math.max(0, TUNE.hearts - S.hearts)) : '∞'; }
function handle(e) {
  const quiet = run.attract;
  const loud = !quiet && !DEMO;
  switch (e.type) {
    case 'eat':
      fx.eat(R, e);
      if (e.kind === 'color' && !quiet) snd.eat(e.c, Math.max(0, frontRun(S) - 1));
      if (e.kind === 'spam' && !quiet) { snd.spam(); speak('spam'); her.mood('worried'); coach('spam'); }
      if (loud && frontRun(S) >= 3) { coach('commit'); if (frontRun(S) >= 4 && Math.random() < 0.35) speak('holding'); }
      if (loud && S.stats.eaten === 1) coach('three');
      break;
    case 'commit':
      fx.commit(R, e);
      if (!quiet) {
        snd.commit(e.n, e.chain);
        if (e.chain >= 2) snd.chain(e.chain);
        scoreChip.set(S.score, { pop: true });
        shell.haptic(e.n >= 5 ? [12, 30, 18] : 10);
        her.mood(e.n >= 5 ? 'wow' : 'happy');
        if (e.n >= 5) speak('commitBig', { force: true });
        else if (e.chain >= 3) speak('chain');
        else if (Math.random() < 0.3) speak('commit');
        if (loud && S.stats.commits === 1) { tip.hidden = true; }
      }
      break;
    case 'shatter': {
      fx.shatter(R, e);
      const now = performance.now();
      if (!quiet && now - lastShatter > 90) { lastShatter = now; snd.shatter(); }
      break;
    }
    case 'shattered': if (!quiet) { scoreChip.set(S.score, { pop: true }); speak('shatter'); } break;
    case 'join': {
      fx.join(R, e, cellCenter(R, S.head.x, S.head.y));
      if (!quiet) { snd.join(); speak('join', { force: true }); her.mood('love'); }
      break;
    }
    case 'forget':
      fx.forget(R, e);
      if (!quiet) {
        snd.forget();
        heartChip.set(hearts(), { pop: true });
        shell.haptic([30, 50, 30]);
        her.mood('sad', 1400);
        speak(S.cfg.hearts && S.hearts === 1 ? 'lowHearts' : 'forget', { force: true });
      }
      break;
    case 'level':
      fx.level(R, e.level);
      if (!quiet) {
        snd.level(); snd.music(e.level);
        levelChip.set(e.level, { pop: true });
        if (loud) shell.toast(e.level === TUNE.wallsFrom && S.cfg.walls ? `Level ${e.level} · firewalls!` : e.colors > colorsAt(e.level - 1, S.mode) ? `Level ${e.level} · a new color` : `Level ${e.level} · faster`, 'good');
        speak('level');
      }
      break;
    case 'special': fx.special(R, e); if (!quiet) { snd.special(e.kind); speak(e.kind, { force: true }); her.mood('happy'); if (e.kind === 'heart') heartChip.set(hearts(), { pop: true }); } break;
    case 'clear': case 'snip': fx.clear(R, e); break;
    case 'wall': fx.wall(R, e); if (!quiet) snd.wall(); break;
    case 'expire': if (!quiet && e.kind !== 'spam') snd.expire(); break;
    case 'crash': fx.crash(R, e); if (!quiet) { snd.crash(); shell.haptic([60, 40, 90]); her.mood('sad', 2000); speak(e.cause, { force: true }); } break;
    case 'over':
      if (!quiet && e.cause === 'overflow') { snd.crash(); her.mood('sad', 2000); speak('overflow', { force: true }); fx.crash(R, { x: S.head.x, y: S.head.y }); }
      endAt = clock + (run.attract ? 1.2 : 1.15);
      break;
    default: break;
  }
}

// ---------- runs ----------
function newState(mode, seed, level = 1) {
  const box = shell.stage.getBoundingClientRect();
  // (the preview: a smaller board, bigger tiles, a few more tokens on it)
  const { W, H } = DEMO ? { W: 12, H: 11 } : dimsFor(box.width / Math.max(1, box.height - 150));
  S = createRun({ mode, seed, W, H, level, extra: DEMO ? 3 : 0 });
  fx.clear_all(R);
  layout();
}
// play a run forward without showing it (the preview and the title's attract run start mid-game)
function warm(seconds) {
  for (let t = 0; t < seconds && !S.over; t += 1 / 60) { update(S, 1 / 60, (s) => think(bot, s)); drain(S); }
  for (const s of S.body) { s.px = s.x; s.py = s.y; s.slide = 0; }
  S.head.px = S.head.x; S.head.py = S.head.y;
}
function start(mode) {
  const daily = mode === 'daily' ? dailySeed() : null;
  const seed = daily ? daily.seed : DEMO ? (SEED || 7) : (SEED || (Math.random() * 2 ** 31) >>> 0);
  run = { mode, attract: false, daily };
  bot = DEMO ? createBot('show', seed) : null;
  // (the preview starts a few levels in, half a minute into a run: more colors, a long tail, more going on)
  newState(mode, seed, DEMO ? 3 : 1);
  if (DEMO) warm(30);
  endAt = 0; warnedFull = false;
  her.hide(DEMO);
  her.status(holding(S));
  scoreChip.set(0); levelChip.set(S.level); heartChip.set(hearts()); heartChip.hide(!S.cfg.hearts);
  shell.started({ count: !DEMO && !QA });
  if (!DEMO) {
    snd.start(); snd.music(1);
    speak(mode === 'daily' ? 'daily' : mode === 'zen' ? 'zen' : 'start', { force: true });
    her.mood('happy');
    coach('steer');
  }
  layout();
}
function finish() {
  const commitsBefore = save.commits;
  save.commits += S.stats.commits;
  const opened = TRAILS.filter((t) => !trailOpen(t, commitsBefore) && trailOpen(t, save.commits));
  if (run.daily) save.daily = { key: run.daily.key, best: Math.max(save.daily?.key === run.daily.key ? save.daily.best : 0, S.score) };
  persist();
  snd.stopMusic();
  const bestKey = run.mode === 'daily' ? `daily:${run.daily.key}` : run.mode === 'zen' ? 'zen' : 'best';
  const before = shell.store.best(bestKey);
  const isBest = S.score > 0 && (before == null || S.score > before);
  shell.over({
    score: S.score, label: 'points', bestKey,
    title: S.cause === 'overflow' ? 'Context overflow' : S.cause === 'self' ? 'Tangled up' : 'Game over',
    stats: [['Commits', fmt(S.stats.commits)], ['Biggest', S.stats.biggest ? `×${S.stats.biggest}` : '–'], ['Best chain', S.stats.chainMax ? `×${S.stats.chainMax}` : '–'], ['Level', String(S.level)]],
    line: endLine({ score: S.score, best: before, isBest, cause: S.cause }),
    share: shareText(S.score, run.mode, S.stats.biggest),
    extra: opened.length ? el('p', 'cw-unlock', '✦ New trail: ', el('b', null, opened.map((t) => t.name).join(', '))) : null,
    onAgain: () => start(run.mode),
    onMenu: () => toTitle(),
  });
  her.hide(true);
}

// the title: her attract run plays behind it
function trailPicker() {
  const row = el('div', { class: 'cw-trails', role: 'group', 'aria-label': 'Her trail' });
  const draw = () => {
    row.replaceChildren(el('span', 'cw-trails-label', 'Trail'), ...TRAILS.map((t) => {
      const open = trailOpen(t, save.commits);
      const b = el('button', { class: 'cw-trail', type: 'button', 'data-trail': t.id, 'aria-pressed': String(save.trail === t.id), 'aria-disabled': open ? null : 'true',
        title: open ? t.name : `${t.name}: ${t.need} commits` }, open ? t.name : `🔒 ${t.need}`);
      b.addEventListener('click', () => {
        if (!open) { shell.toast(`${t.name}: commit ${t.need - save.commits} more thoughts`, 'warn'); shell.audio.sfx('error'); return; }
        save.trail = t.id; persist(); shell.audio.sfx('select'); draw();
      });
      return b;
    }));
  };
  draw();
  return row;
}
function toTitle() {
  snd.stopMusic();
  run = { mode: 'classic', attract: true };
  bot = createBot('expert', 11);
  newState('classic', 20261124, 3);
  warm(20);
  her.hide(true);
  tip.hidden = true;
  const daily = dailySeed();
  const dailyBest = save.daily?.key === daily.key ? save.daily.best : null;
  shell.title({
    logo: ['CONTEXT', { text: 'WINDOW', tone: 'accent' }],
    tagline: 'Eat tokens. Hold the thought. Commit it before she forgets.',
    onPlay: () => start('classic'),
    best: shell.store.best(),
    modes: [
      { label: 'Daily', sub: dailyBest ? `today’s best ${fmt(dailyBest)}` : 'same board for everyone', onClick: () => start('daily') },
      { label: 'Zen', sub: 'no walls, no hearts', onClick: () => start('zen') },
    ],
    extra: trailPicker(),
  });
  layout();
}

// ---------- the loop ----------
createLoop({
  update(dt) {
    if (!S || !run) return;
    if (R.freeze > 0) { R.freeze -= dt; return; }
    const live = run.attract ? shell.state === 'title' : DEMO || shell.state === 'play';
    if (!live) return;
    clock += dt;
    if (!S.over) {
      update(S, dt, bot ? (s) => think(bot, s) : null);
      for (const e of drain(S)) handle(e);
      if (!run.attract && !DEMO) {
        her.status(holding(S));
        if (S.body.length >= TUNE.limit - 3 && !warnedFull) { warnedFull = true; speak('full', { force: true }); her.mood('worried'); coach('full'); }
        if (S.body.length < TUNE.limit - 6) warnedFull = false;
      }
    } else if (endAt && clock >= endAt) {
      endAt = 0;
      if (run.attract) { bot = createBot('expert', 3); newState('classic', (Math.random() * 1e9) >>> 0, 3); warm(12); }
      else if (DEMO) start('classic');
      else finish();
    }
  },
  render(alpha, frameDt) {
    if (!S || !R.L) return;
    const dt = Math.min(0.05, frameDt);
    const moving = shell.state !== 'pause';
    if (moving) fx.update(R, dt);
    draw(R, S, S.ready > 0 ? 0 : S.stepAcc, dt, { trail: run?.attract ? 'neon' : save.trail, time: clock + (moving ? 0 : 0), attract: run?.attract });
  },
  paused: () => shell.state === 'pause',
}).start();

if (QA) window.__cw = { get S() { return S; }, get run() { return run; }, start };
layout();
if (DEMO) start('classic'); else toTitle();
