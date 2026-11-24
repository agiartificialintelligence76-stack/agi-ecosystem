// SCALING LAWS: the page. The arcade kit's frame, the layout, the steering (a drag, the arrows), the loop, upgrades
// between levels, and what each of the rules' events looks and sounds like. The rules are ./rules.js (pure), the demo's
// player ./ai.js, the picture ./render.js, the sound ./sound.js, her words ./lines.js.
import './style.css';
import { createShell, el } from '../kit/shell.js';
import { createLoop } from '../kit/loop.js';
import { pointer, keyboard } from '../kit/input.js';
import { DEMO, SEED, QUERY } from '../kit/env.js';
import { fmt, clamp } from '../kit/fx.js';
import { createHer } from '../kit/her.js';
import { createRun, update, drain, dailySeed, params, UPGRADES, DAILY_LEVEL, MULTS, TUNE } from './rules.js';
import { createBot, steer } from './ai.js';
import { createRenderer, layout as layoutTrack, draw, fx } from './render.js';
import { createSound } from './sound.js';
import { say, TIPS, shareText } from './lines.js';

const root = document.getElementById('ak-root');
const shell = createShell({
  game: 'scalinglaws', name: 'SCALING LAWS', root,
  howTo: {
    intro: 'AGI-1’s model is a crowd of little parameters. Grow it all the way down the track.',
    steps: [
      ['Steer', 'Drag left or right anywhere (or hold the arrow keys). The crowd follows.'],
      ['Pick the gate', 'Each pair of gates does maths to her crowd: + and × grow it, − and ÷ shrink it. Run through the better one.'],
      ['Mind the track', 'Saws, walls with a gap and 404 holes knock parameters off. So do the edges.'],
      ['Rival models', 'Red crowds block the road and trade parameters one for one. Arrive bigger.'],
      ['The benchmark', 'At the end, each step of the staircase needs a few parameters. The highest step multiplies your score.'],
      ['Upgrades', 'Compute crystals pay for Pretraining, Clean data and Robustness between runs.'],
    ],
    touch: [['Drag', 'Steer']],
    keys: [['← → / A D', 'Steer'], ['Mouse drag', 'Steer'], ['Esc / P', 'Pause']],
  },
  onRestart() { if (run && !run.attract) begin(run.mode, run.level); },
  onQuit() { queueMicrotask(toTitle); },
});

const canvas = el('canvas', { class: 'sl-canvas', role: 'img', 'aria-label': 'A crowd of AGI-1’s parameters running down a neon track toward gates.' });
const safe = el('div', { class: 'sl-safe', 'aria-hidden': 'true' });
const tipText = el('span');
const tip = el('p', { class: 'sl-tip', hidden: true, role: 'status' }, tipText);
shell.stage.append(canvas, safe, tip);
const R = createRenderer(canvas);
const her = createHer(shell.stage, { cls: 'sl-her', status: 'ready to scale' });
const snd = createSound(shell.audio);
const nChip = shell.chip('', '10B', { accent: true });
const levelChip = shell.chip('Lv', 1);
const gemChip = shell.chip('◆', 0);
try { document.fonts?.load("900 20px 'AK Display'"); } catch { /* fallback font meanwhile */ }

const QA = QUERY.has('qa');
const AUTO = QA && QUERY.has('auto');   // (browser checks: its own player at the wheel)
let save = shell.store.read();
if (!Number.isInteger(save.level) || save.level < 1) save.level = 1;
if (!Number.isFinite(save.compute)) save.compute = 0;
if (!save.up || typeof save.up !== 'object') save.up = {};
if (!save.tips || typeof save.tips !== 'object') save.tips = {};
const persist = () => { if (!QA) shell.store.update((d) => Object.assign(d, save)); };

let S = null, run = null, bot = null, clock = 0, endAt = 0, tx = 0, drag = null, lastSay = {};
const playing = () => Boolean(S && run && !run.attract && shell.state === 'play' && !S.over && !bot);

// ---------- layout ----------
function layout() {
  const box = shell.stage.getBoundingClientRect();
  const w = Math.max(1, Math.round(box.width)), h = Math.max(1, Math.round(box.height));
  const dpr = clamp(Math.min(window.devicePixelRatio || 1, 2, 2400 / w), 1, 2);
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
  const cs = getComputedStyle(safe);
  const st = parseFloat(cs.paddingTop) || 0, sb = parseFloat(cs.paddingBottom) || 0;
  const barB = DEMO ? st : shell.bar.getBoundingClientRect().bottom - box.top;
  const short = h < 520 && w > h * 1.25;
  const herH = DEMO || her.node.hidden || short ? 0 : her.node.getBoundingClientRect().height + 16;
  layoutTrack(R, { w, h, dpr, top: barB, bottom: herH + sb });
}
new ResizeObserver(() => layout()).observe(shell.stage);

// ---------- steering ----------
pointer(canvas, {
  down(p) { if (playing()) drag = { x: p.x, tx }; },
  move(p) { if (drag && playing()) tx = clamp(drag.tx + (p.x - drag.x) / (R.L.s0 * 0.8), -1, 1); },
  up() { drag = null; },
});
const keys = keyboard({ ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right' }, { blocked: () => shell.state !== 'play' });

// ---------- tips and her words ----------
function coach(id) {
  if (DEMO || QA || !run || run.attract || save.tips[id] || !TIPS[id]) return;
  save.tips[id] = true; persist();
  tipText.textContent = TIPS[id];
  tip.hidden = false; tip.classList.remove('is-in'); void tip.offsetWidth; tip.classList.add('is-in');
  clearTimeout(coach.t); coach.t = setTimeout(() => { tip.hidden = true; }, 4800);
}
function speak(kind, { force = false, every = 0 } = {}) {
  if (!run || run.attract || DEMO) return;
  const now = performance.now();
  if (every && now - (lastSay[kind] || 0) < every) return;
  if (her.say(say(kind), 2400, { force })) lastSay[kind] = now;
}

// ---------- the rules' events ----------
function handle(e) {
  const quiet = run.attract;
  switch (e.type) {
    case 'gate': {
      fx.gate(R, S, e);
      if (quiet) break;
      snd.gate(e.op, e.after >= e.before);
      nChip.set(params(S.n), { pop: true });
      shell.haptic(e.good ? 10 : [30, 40, 30]);
      if (e.after < e.before) { her.mood('sad'); speak('bad', { force: true }); }
      else if (e.op.t === 'x') { her.mood('wow'); speak('times'); }
      else { her.mood('happy'); speak('plus', { every: 6000 }); }
      if (S.stats.gates === 1) coach('gates');
      break;
    }
    case 'lost':
      fx.lost(R, S, e);
      if (!quiet) { snd.pop(); speak(e.cause, { every: 5000 }); if (e.k > 3) her.mood('worried'); }
      break;
    case 'fight': if (!quiet) { speak('fight', { force: true }); her.mood('worried'); } break;
    case 'clash': fx.clash(R, S); if (!quiet) { snd.clash(); nChip.set(params(S.n)); } break;
    case 'beat': fx.beat(R); if (!quiet) { snd.beat(); speak('beat', { force: true }); her.mood('happy'); shell.haptic(14); } break;
    case 'gem': fx.gem(R, S, e); if (!quiet) { snd.gem(); gemChip.set(S.gems, { pop: true }); } break;
    case 'finale': if (!quiet) { speak('finale', { force: true }); coach('bench'); } break;
    case 'step': fx.step(R, S, e); if (!quiet) { snd.step(e.step); nChip.set(params(S.n)); shell.haptic(8); } break;
    case 'won':
      fx.won(R);
      if (!quiet) { snd.won(); her.mood('love', 2000); speak(S.step >= TUNE.steps ? 'top' : 'won', { force: true }); }
      endAt = clock + 1.3;
      break;
    case 'lost-run':
      fx.lose(R);
      if (!quiet) { snd.lose(); her.mood('sad', 2000); speak('lost', { force: true }); shell.haptic([50, 40, 80]); }
      endAt = clock + 1.1;
      break;
    default: break;
  }
}

// ---------- runs ----------
function begin(mode, level = save.level) {
  const daily = mode === 'daily' ? dailySeed() : null;
  const lv = mode === 'daily' ? DAILY_LEVEL : level;
  const seed = daily ? daily.seed : mode === 'endless' ? (SEED || (Math.random() * 2 ** 31) >>> 0) : 1000 + lv * 7;
  run = { mode, level: lv, daily, attract: false };
  S = createRun({ level: lv, seed, mode: mode === 'daily' ? 'campaign' : mode, upgrades: DEMO ? { pretrain: 3 } : save.up });
  bot = DEMO || AUTO ? createBot('expert', SEED || 7) : null;
  fx.reset(R);
  tx = 0; endAt = 0; drag = null;
  her.hide(DEMO);
  nChip.set(params(S.n)); levelChip.set(mode === 'endless' ? '∞' : mode === 'daily' ? 'Daily' : lv); gemChip.set(0);
  shell.started({ count: !DEMO && !QA });
  if (!DEMO) {
    snd.go(); snd.music();
    speak(mode === 'endless' ? 'endless' : mode === 'daily' ? 'daily' : 'start', { force: true });
    her.mood('happy');
    coach('steer');
  }
  layout();
}

// the upgrades: three buttons, each with its level and what the next one costs
function shopNode() {
  const box = el('div', { class: 'sl-shop', role: 'group', 'aria-label': 'Upgrades' });
  const paint = () => {
    box.replaceChildren(el('p', 'sl-shop-head', el('span', null, 'Upgrades'), el('b', null, `◆ ${fmt(save.compute)} compute`)),
      ...UPGRADES.map((u) => {
        const lv = save.up[u.id] || 0, maxed = lv >= u.max, cost = u.cost(lv), can = !maxed && save.compute >= cost;
        const b = el('button', { class: 'sl-up', type: 'button', 'aria-disabled': can ? null : 'true' },
          el('span', 'sl-up-name', u.name, el('small', null, `Lv ${lv}/${u.max}`)), el('span', 'sl-up-what', u.what), el('span', 'sl-up-cost', maxed ? 'MAX' : `◆ ${cost}`));
        b.addEventListener('click', () => {
          if (!can) { shell.audio.sfx('error'); shell.toast(maxed ? 'Maxed out' : `Need ◆ ${cost - save.compute} more`, 'warn'); return; }
          save.compute -= cost; save.up[u.id] = lv + 1; persist();
          snd.upgrade(); shell.toast(`${u.name} Lv ${lv + 1}`, 'good');
          paint();
        });
        return b;
      }));
  };
  paint();
  return box;
}
function ending() {
  snd.stopMusic();
  save.compute += S.gems;
  const lv = run.level;
  const progress = Math.min(99, Math.round((S.z / (S.length || 1)) * 100));
  const statsBase = [['Rivals beaten', String(S.stats.rivals)], ['Compute', `◆ +${S.gems}`]];
  let o;
  if (run.mode === 'endless') {
    o = { score: S.score, label: 'points', bestKey: 'endless', title: 'Model collapsed',
      stats: [['Distance', `${fmt(Math.round(S.z))} m`], ['Peak', params(S.peak)], ...statsBase], line: say('lost'),
      share: shareText({ mode: 'endless', score: S.score, params: params(S.peak) }), onAgain: () => begin('endless') };
  } else if (S.won) {
    if (run.mode === 'campaign') save.level = Math.max(save.level, lv + 1);
    o = { score: S.score, label: 'points', bestKey: run.mode === 'daily' ? `daily:${run.daily.key}` : `lv${lv}`, title: run.mode === 'daily' ? 'Daily benchmark passed' : `Level ${lv} passed`,
      stats: [['At the finish', params(S.atFinale)], ['Benchmark', S.step ? `×${MULTS[S.step - 1]}` : '×1'], ...statsBase], line: say(S.step >= TUNE.steps ? 'top' : 'won'),
      share: shareText({ mode: 'campaign', level: lv, params: params(S.atFinale), step: S.step }),
      again: run.mode === 'daily' ? 'Run it again' : `Level ${lv + 1}`, onAgain: () => (run.mode === 'daily' ? begin('daily') : begin('campaign', lv + 1)) };
  } else {
    o = { score: progress, label: 'of the track', best: null, format: (v) => `${v}%`, title: 'Model collapsed',
      stats: [['Peak', params(S.peak)], ['Level', run.mode === 'daily' ? 'Daily' : String(lv)], ...statsBase], line: say('lost'),
      share: shareText({ mode: 'campaign', level: lv, params: params(S.peak), step: 0 }), again: 'Try again', onAgain: () => begin(run.mode, lv) };
  }
  persist();
  shell.over({ ...o, onMenu: () => toTitle(), extra: shopNode() });
}

function toTitle() {
  snd.stopMusic();
  run = { mode: 'campaign', level: 4, attract: true };
  S = createRun({ level: 4, seed: 20261124, upgrades: { pretrain: 4 } });
  bot = createBot('expert', 3);
  fx.reset(R);
  her.hide(true); tip.hidden = true;
  const upgrades = el('button', { class: 'ak-link sl-open-shop', type: 'button' }, `◆ ${fmt(save.compute)} compute · Upgrades`);
  upgrades.addEventListener('click', () => {
    const close = el('button', { class: 'ak-btn ak-btn-primary', type: 'button', 'data-ak-first': true }, 'Done');
    close.addEventListener('click', () => { shell.closeCard(); toTitle(); });
    shell.card(el('div', 'ak-card sl-shop-card', el('p', 'ak-card-kicker', 'SCALING LAWS'), el('h2', 'ak-card-title', 'Upgrades'), shopNode(), el('div', 'ak-card-actions', close)), { label: 'Upgrades' });
  });
  shell.title({
    logo: ['SCALING', { text: 'LAWS', tone: 'mint' }],
    tagline: 'Pick the gates. Grow her model. Top the benchmark.',
    play: `Level ${save.level}`,
    onPlay: () => begin('campaign', save.level),
    best: null,
    modes: [
      { label: 'Endless', sub: shell.store.best('endless') ? `best ${fmt(shell.store.best('endless'))}` : 'how big can she get?', onClick: () => begin('endless') },
      { label: 'Daily', sub: 'one track for everyone', onClick: () => begin('daily') },
    ],
    extra: el('div', 'sl-title-extra', upgrades, save.level > 1 ? el('button', { class: 'ak-link', type: 'button', onclick: () => begin('campaign', 1) }, 'Replay from level 1') : null),
  });
  layout();
}

// ---------- the loop ----------
createLoop({
  update(dt) {
    if (!S || !run) return;
    const live = run.attract ? shell.state === 'title' : DEMO || shell.state === 'play';
    if (!live) return;
    clock += dt;
    if (!S.over) {
      if (bot) tx = steer(bot, S, dt);
      else {
        const k = (keys.held('right') ? 1 : 0) - (keys.held('left') ? 1 : 0);
        if (k) tx = clamp(tx + k * 2.6 * dt, -1, 1);
      }
      update(S, dt, tx);
      for (const e of drain(S)) handle(e);
      if (!run.attract && nChip.value !== params(S.n)) nChip.set(params(S.n));
      if (!run.attract && !DEMO) her.status(S.phase === 'fight' ? 'fighting a rival!' : S.phase === 'finale' ? `benchmark step ${S.step}` : `${params(S.n)} params`);
    } else if (endAt && clock >= endAt) {
      endAt = 0;
      if (run.attract) { S = createRun({ level: 3 + (Math.random() * 6 | 0), seed: (Math.random() * 1e9) >>> 0, upgrades: { pretrain: 4 } }); bot = createBot('expert', 5); fx.reset(R); }
      else if (DEMO) begin('campaign', 6);
      else ending();
    }
  },
  render(alpha, frameDt) {
    if (!S || !R.L) return;
    const dt = Math.min(0.05, frameDt);
    if (shell.state !== 'pause') fx.update(R, dt);
    draw(R, S, shell.state === 'pause' ? 0 : dt, { time: S.time, attract: run?.attract });
  },
  paused: () => shell.state === 'pause',
}).start();

if (QA) window.__sl = { get S() { return S; }, get run() { return run; }, begin };
layout();
if (DEMO) begin('campaign', 6); else toTitle();
