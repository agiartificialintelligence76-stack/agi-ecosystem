// HOTFIX: the page. The arcade kit's frame, the layout, the drag (a finger or the mouse holds a chip and pulls it round
// the board; the keys can too), a turn played back from the rules' timeline step by step, the patch card between
// floors, her bug log, and what everything looks and sounds like. The rules are ./rules.js (pure), the demo's player
// ./ai.js, the picture ./render.js, the sound ./sound.js, her words ./lines.js.
import './style.css';
import { createShell, el } from '../kit/shell.js';
import { createLoop } from '../kit/loop.js';
import { pointer, keyboard } from '../kit/input.js';
import { DEMO, SEED, QUERY } from '../kit/env.js';
import { fmt, clamp } from '../kit/fx.js';
import { createHer } from '../kit/her.js';
import { createRun, turn, choose, setTarget, startAt, dragTime, adjacent, xy, dailySeed, PATCHES, ALL_BUGS, KINDS, W, H } from './rules.js';
import { createBot, plan, pickPatch } from './ai.js';
import { createRenderer, layout as layoutBoard, draw, fx, cellAt, cellCenter, bugAt, bugSlots } from './render.js';
import { createSound } from './sound.js';
import { say, TIPS, shareText } from './lines.js';

const root = document.getElementById('ak-root');
const shell = createShell({
  game: 'hotfix', name: 'HOTFIX', root,
  howTo: {
    intro: 'Bugs are crawling through AGI-1’s code. Squash them with combos.',
    steps: [
      ['Drag a chip', 'Press any chip and drag it around the board (diagonals too). It swaps with every chip it passes over. You have a few seconds.'],
      ['Make lines', 'Let go: every line of 3+ of a kind clears. Each group is a combo; new chips fall in and can make more.'],
      ['Hit the bugs', 'Logic, Memory, Vision and Voice hit the targeted bug (tap one to target it). ×2 under a bug: it’s weak to that kind. ½: it resists it.'],
      ['Stay up', 'Green Debug chips heal her uptime. When a bug’s countdown hits 0 it bites. Some corrupt chips into junk or lock them.'],
      ['Go deeper', 'Clear a floor, pick a patch, go deeper. Every fifth floor is a boss.'],
    ],
    touch: [['Press + drag', 'Move a chip'], ['Tap a bug', 'Target it']],
    keys: [['Mouse drag', 'Move a chip'], ['Arrows + Space', 'Pick up, move, drop'], ['1 · 2 · 3', 'Target a bug'], ['Esc / P', 'Pause']],
  },
  onResume() { if (run?.offer && phase === 'offer') offerCard(); },
  onRestart() { if (run && !attract) begin(run.mode); },
  onQuit() { queueMicrotask(toTitle); },
});

const canvas = el('canvas', { class: 'hf-canvas', role: 'img', 'aria-label': 'Bugs above a 6 by 5 board of colored chips.' });
const safe = el('div', { class: 'hf-safe', 'aria-hidden': 'true' });
const tipText = el('span');
const tip = el('p', { class: 'hf-tip', hidden: true, role: 'status' }, tipText);
shell.stage.append(canvas, safe, tip);
const R = createRenderer(canvas);
const her = createHer(shell.stage, { cls: 'hf-her', status: 'debugging…' });
const snd = createSound(shell.audio);
const scoreChip = shell.chip('', 0, { accent: true });
const floorChip = shell.chip('Floor', 1);
try { document.fonts?.load("900 20px 'AK Display'"); } catch { /* fallback font meanwhile */ }

const QA = QUERY.has('qa');
const AUTO = QA && QUERY.has('auto');
let save = shell.store.read();
if (!Array.isArray(save.seen)) save.seen = [];
if (!save.tips || typeof save.tips !== 'object') save.tips = {};
const persist = () => { if (!QA) shell.store.update((d) => Object.assign(d, save)); };

let run = null, attract = false, bot = null, phase = 'idle', clock = 0;
let drag = null, cursor = 0, show = null, queue = [], step = null, stepT = 0, combo = 0, popping = null, shownHp = new Map(), shownUp = 100, thinkT = 0, botPath = null;
const playing = () => Boolean(run && !attract && shell.state === 'play' && !run.over);

// ---------- layout ----------
function layout() {
  const box = shell.stage.getBoundingClientRect();
  const w = Math.max(1, Math.round(box.width)), h = Math.max(1, Math.round(box.height));
  const dpr = clamp(Math.min(window.devicePixelRatio || 1, 2, 2400 / w), 1, 2);
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
  const cs = getComputedStyle(safe);
  const st = parseFloat(cs.paddingTop) || 0, sb = parseFloat(cs.paddingBottom) || 0, sl = parseFloat(cs.paddingLeft) || 0, sr = parseFloat(cs.paddingRight) || 0;
  const barB = DEMO ? st : shell.bar.getBoundingClientRect().bottom - box.top;
  const L = layoutBoard(R, { w, h, dpr, top: barB, bottom: sb + 6, left: sl, right: sr });
  her.node.style.top = `${Math.round(L.herY + (L.herRow - her.node.offsetHeight) / 2)}px`;
  her.node.style.left = `${Math.round(L.bar.x)}px`;
  her.node.classList.toggle('is-up', Boolean(L.wide));
}
new ResizeObserver(() => layout()).observe(shell.stage);

// ---------- the drag ----------
function pickUp(i, x, y) {
  if (phase !== 'idle' || !playing() || i < 0 || run.cells[i].lock) return false;
  drag = { path: [i], cells: run.cells.slice(), id: run.cells[i].id, x, y, left: dragTime(run), started: false };
  phase = 'drag';
  snd.pick(); shell.haptic(6);
  return true;
}
// the held chip moves toward cell `c`, one neighbour at a time (a fast finger skips no cells)
function moveTo(c) {
  if (!drag || c < 0) return;
  for (let guard = 0; guard < 12; guard++) {
    const at = drag.path[drag.path.length - 1];
    if (at === c) return;
    const a = xy(at), b = xy(c);
    const nx = a.x + Math.sign(b.x - a.x), ny = a.y + Math.sign(b.y - a.y), next = ny * W + nx;
    if (drag.cells[next].lock || !adjacent(at, next)) return;
    [drag.cells[at], drag.cells[next]] = [drag.cells[next], drag.cells[at]];
    drag.path.push(next);
    drag.started = true;
    snd.swap(drag.path.length); shell.haptic(4);
  }
}
function drop() {
  if (!drag) return;
  const path = drag.path;
  drag = null;
  if (path.length < 2) { phase = 'idle'; return; }
  play(path);
}
pointer(canvas, {
  down(p) {
    if (!playing()) return;
    const b = bugAt(R, run.bugs, p.x, p.y);
    if (b >= 0 && phase === 'idle') { if (setTarget(run, b)) shell.audio.sfx('tap'); return; }
    pickUp(cellAt(R, p.x, p.y), p.x, p.y);
  },
  move(p) { if (drag && phase === 'drag') { drag.x = p.x; drag.y = p.y; moveTo(cellAt(R, clamp(p.x, R.L.bx + 1, R.L.bx + R.L.bw - 1), clamp(p.y, R.L.by + 1, R.L.by + R.L.bh - 1))); } },
  up() { if (phase === 'drag') drop(); },
});
// keys: arrows move a cursor; Space picks up and drops; arrows move the held chip
keyboard({ ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down', ' ': 'act', Enter: 'act', 1: 't1', 2: 't2', 3: 't3' }, {
  blocked: () => shell.state !== 'play',
  down(name) {
    if (!playing()) return;
    if (name[0] === 't') { setTarget(run, Number(name[1]) - 1); return; }
    if (name === 'act') {
      if (phase === 'idle') { const p = cellCenter(R, cursor); pickUp(cursor, p.x, p.y); } else if (phase === 'drag') drop();
      return;
    }
    const p = xy(drag ? drag.path[drag.path.length - 1] : cursor);
    const d = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[name];
    const nx = clamp(p.x + d[0], 0, W - 1), ny = clamp(p.y + d[1], 0, H - 1), next = ny * W + nx;
    if (drag) { moveTo(next); const q = cellCenter(R, next); drag.x = q.x; drag.y = q.y; } else cursor = next;
  },
});

// ---------- a turn, played back ----------
function play(path) {
  for (const b of run.bugs) shownHp.set(b.uid, b.hp);
  shownUp = run.uptime;
  queue = turn(run, path);
  phase = 'resolve';
  combo = 0;
  step = null;
  next();
}
const DUR = { drag: 0.04, match: 0, fall: 0.26, hits: 0, bites: 0, clear: 0.7, over: 0.9 };
function next() {
  step = queue.shift() || null;
  stepT = 0;
  if (!step) { finishTurn(); return; }
  step.i = 0;
  if (step.kind === 'match') step.dur = 0.13 * step.groups.length + 0.12;
  else if (step.kind === 'hits') step.dur = 0.11 * step.hits.length + 0.25;
  else if (step.kind === 'bites') step.dur = 0.34 * Math.max(1, step.bites.length) + 0.1;
  else step.dur = DUR[step.kind] ?? 0.2;
  if (step.kind === 'drag') show = step.cells;
  if (step.kind === 'match') popping = new Map();
  if (step.kind === 'fall') {
    show = step.cells;
    for (const sp of step.spawns) { const p = cellCenter(R, sp.to); R.vis.set(sp.id, { x: p.x, y: R.L.by - sp.drop * R.L.cell + R.L.cell * 0.5, s: 1 }); }
  }
  if (step.kind === 'hits' && step.heal) { shownUp = Math.min(run.max, shownUp + step.heal); if (!attract) { fx.heal(R, step.heal); snd.heal(); speak('heal'); } }
  if (step.kind === 'hits' && !attract && step.combos >= 3) {
    her.mood(step.combos >= 5 ? 'wow' : 'happy');
    speak(step.combos >= 7 ? 'combo7' : step.combos >= 5 ? 'combo5' : 'combo3', { force: step.combos >= 5 });
  }
}
function tick(dt) {
  if (!step) return;
  stepT += dt;
  const loud = !attract;
  if (step.kind === 'match') {
    while (step.i < step.groups.length && stepT >= step.i * 0.13) {
      const g = step.groups[step.i++];
      for (const c of g.cells) popping.set(c, 1);
      combo++;
      fx.pop(R, g);
      if (loud) { snd.combo(combo); shell.haptic(6); }
    }
    if (stepT >= step.dur) { show = step.cells; popping = null; if (step.junk.length) fx.junk(R, step.junk); }
  } else if (step.kind === 'hits') {
    const slots = bugSlots(R, run.bugs);
    while (step.i < step.hits.length && stepT >= step.i * 0.11) {
      const h = step.hits[step.i++];
      if (h.uid == null) { R.floats.add({ x: R.L.bx + R.L.bw / 2, y: R.L.bugs.y + R.L.bugs.h / 2, text: `${h.amount}`, color: KINDS[h.t].color, size: 26, life: 0.9, rise: 50, font: "900 1em 'AK Display', sans-serif" }); if (loud) snd.hit(false); continue; }
      const k = run.bugs.findIndex((b) => b.uid === h.uid);
      if (k < 0) continue;
      shownHp.set(h.uid, Math.max(0, (shownHp.get(h.uid) ?? 0) - h.amount));
      R.hurt.set(h.uid, 0.5);
      fx.hit(R, slots[k], h);
      if (loud) { snd.hit(h.weak); if (h.weak && Math.random() < 0.3) speak('weak'); }
      if (h.killed) { shownHp.set(h.uid, 0); fx.kill(R, slots[k]); if (loud) { snd.kill(); speak('kill'); shell.haptic([10, 30, 20]); } }
    }
  } else if (step.kind === 'bites') {
    while (step.i < step.bites.length && stepT >= step.i * 0.34) {
      const b = step.bites[step.i++];
      R.lunge.set(b.uid, 1);
      if (b.kind === 'bite') { shownUp = Math.max(0, shownUp - b.amount); fx.bite(R, b.amount); if (loud) { snd.bite(); her.mood('worried'); shell.haptic([30, 30, 30]); speak(shownUp < run.max * 0.3 ? 'low' : 'bite'); } }
      else if (b.kind === 'corrupt') { show = step.cells; fx.mark(R, b.cells, '#8f88a6'); if (loud) { snd.glitch(); speak('corrupt'); } }
      else if (b.kind === 'lock') { show = step.cells; fx.mark(R, b.cells, '#cdb8ff'); if (loud) { snd.lock(); speak('lock'); } }
      else if (b.kind === 'shield') { if (loud) snd.shield(); }
      else if (b.kind === 'duck') { R.floats.add({ x: R.L.w / 2, y: R.L.bar.y, text: 'RUBBER DUCK!', color: '#ffc933', size: 22, life: 1, rise: 30, font: "900 1em 'AK Display', sans-serif" }); }
      else if (b.kind === 'heal') { const k = run.bugs.findIndex((x) => x.uid === b.uid); if (k >= 0) shownHp.set(b.uid, Math.min(run.bugs[k].max, (shownHp.get(b.uid) ?? 0) + b.amount)); }
    }
    if (stepT >= step.dur) show = step.cells;
  }
  if (stepT >= step.dur) next();
}
function finishTurn() {
  for (const b of run.bugs) shownHp.set(b.uid, b.hp);
  shownUp = run.uptime;
  show = null;
  combo = 0;
  scoreChip.set(run.mode === 'lab' ? Math.round(run.damage) : run.score, { pop: true });
  if (run.over) { phase = 'over'; endIn(0.6); return; }
  if (run.offer) { phase = 'offer'; if (!attract) { snd.floor(); her.mood('love'); speak('floor', { force: true }); } setTimeout(() => { if (phase === 'offer') (attract || bot ? autoPatch() : offerCard()); }, attract ? 300 : 650); return; }
  phase = 'idle';
  if (!attract && run.uptime < run.max * 0.3) her.mood('worried');
}
let endTimer = 0;
function endIn(s) { clearTimeout(endTimer); endTimer = setTimeout(() => { if (attract) toTitleRun(); else if (DEMO) begin('run'); else ending(); }, s * 1000); }

// ---------- floors and patches ----------
function autoPatch() { choose(run, pickPatch(run)); afterFloor(); }
function afterFloor() {
  phase = 'idle';
  for (const b of run.bugs) shownHp.set(b.uid, b.hp);
  floorChip.set(run.floor, { pop: true });
  for (const b of run.bugs) if (!save.seen.includes(b.id)) { save.seen.push(b.id); if (!attract && !DEMO) shell.toast(`Bug log: ${b.name}`, 'good'); }
  if (!attract && !DEMO) persist();
  if (!attract && run.bugs.some((b) => b.def.boss)) { speak('boss', { force: true }); her.mood('worried'); shell.toast(`Floor ${run.floor} · BOSS`, 'warn'); }
  else if (!attract && !DEMO) shell.toast(`Floor ${run.floor}`, 'good');
  if (!attract && run.bugs.length > 1) coach('target');
}
function offerCard() {
  const card = el('div', 'ak-card hf-offer');
  const buttons = run.offer.map((id) => {
    const p = PATCHES.find((q) => q.id === id), lv = run.patches[id] || 0;
    const b = el('button', { class: 'hf-patch', type: 'button', 'data-patch': id }, el('b', null, p.name), el('span', null, p.what), el('small', null, lv ? `Level ${lv} → ${lv + 1}` : 'New'));
    b.addEventListener('click', () => {
      if (phase !== 'offer') return;
      choose(run, id);
      snd.patch(); speak('patch');
      shell.closeCard();
      afterFloor();
    });
    return b;
  });
  buttons[0]?.setAttribute('data-ak-first', '');
  card.append(el('p', 'ak-card-kicker', `Floor ${run.floor} cleared`), el('h2', 'ak-card-title', 'Pick a patch'), el('div', 'hf-patches', buttons),
    el('p', 'ak-fine', `Uptime ${run.uptime}/${run.max} · next: floor ${run.floor + 1}${(run.floor + 1) % 5 === 0 ? ' (boss)' : ''}`));
  shell.card(card, { label: 'Pick a patch' });
}

// ---------- tips, her words ----------
function coach(id) {
  if (DEMO || QA || attract || save.tips[id] || !TIPS[id]) return;
  save.tips[id] = true; persist();
  tipText.textContent = TIPS[id];
  tip.hidden = false; tip.classList.remove('is-in'); void tip.offsetWidth; tip.classList.add('is-in');
  clearTimeout(coach.t); coach.t = setTimeout(() => { tip.hidden = true; }, 5600);
}
const speak = (kind, opts = {}) => { if (!attract && !DEMO && run) her.say(say(kind), opts.ms || 2400, opts); };

// ---------- runs ----------
function reset() {
  fx.reset(R); queue = []; step = null; show = null; drag = null; combo = 0; popping = null; phase = 'idle'; thinkT = 0.6; botPath = null;
  shownHp = new Map(run.bugs.map((b) => [b.uid, b.hp])); shownUp = run.uptime;
  clearTimeout(endTimer);
}
function begin(mode) {
  const daily = mode === 'daily' ? dailySeed() : null;
  const seed = daily ? daily.seed : (SEED || (Math.random() * 2 ** 31) >>> 0);
  attract = false;
  run = createRun({ mode: mode === 'daily' ? 'run' : mode, seed });
  run.daily = daily;
  if (DEMO) startAt(run, 4);
  bot = DEMO || AUTO ? createBot('expert', seed) : null;
  reset();
  her.hide(false);
  scoreChip.set(0); floorChip.set(run.mode === 'lab' ? '–' : run.floor); floorChip.hide(run.mode === 'lab');
  shell.started({ count: !DEMO && !QA });
  if (!DEMO) {
    snd.start(); snd.music();
    speak(mode === 'daily' ? 'daily' : mode === 'lab' ? 'lab' : 'start', { force: true });
    her.mood('happy');
    coach('drag');
  }
  for (const b of run.bugs) if (!save.seen.includes(b.id)) save.seen.push(b.id);
  persist();
  layout();
}
function ending() {
  snd.stopMusic();
  snd.crash();
  her.mood('sad', 2000);
  const lab = run.mode === 'lab';
  const taken = Object.entries(run.patches).map(([id, n]) => `${PATCHES.find((p) => p.id === id)?.name}${n > 1 ? ` ×${n}` : ''}`);
  shell.over({
    score: lab ? Math.round(run.damage) : run.score, label: lab ? 'damage in 10 moves' : 'points',
    bestKey: lab ? 'lab' : run.daily ? `daily:${run.daily.key}` : 'best',
    title: lab ? 'Lab results' : `Crashed on floor ${run.floor}`,
    stats: lab ? [['Best combo', String(run.bestCombo)], ['Moves', String(run.moves)]]
      : [['Floor', String(run.floor)], ['Best combo', String(run.bestCombo)], ['Damage', fmt(Math.round(run.damage))], ['Turns', String(run.turns)]],
    line: say(lab ? 'combo5' : 'crash'),
    share: shareText({ mode: run.mode, floor: run.floor, combo: run.bestCombo, score: lab ? Math.round(run.damage) : run.score }),
    extra: taken.length ? el('p', 'hf-taken', el('b', null, 'Patches: '), taken.join(' · ')) : null,
    onAgain: () => begin(run.daily ? 'daily' : run.mode), onMenu: () => toTitle(),
  });
  if (!lab) save.bestFloor = Math.max(save.bestFloor || 0, run.floor);
  persist();
  her.hide(true);
}

function bugLog() {
  const close = el('button', { class: 'ak-btn ak-btn-primary', type: 'button', 'data-ak-first': true }, 'Close');
  close.addEventListener('click', () => shell.closeCard());
  const list = el('ul', 'hf-log', ALL_BUGS.map((b) => {
    const seen = save.seen.includes(b.id);
    return el('li', `hf-log-row${seen ? '' : ' is-locked'}`, el('b', null, seen ? b.name : '???'), el('span', null, seen ? `${b.what} Weak to ${b.weak}, resists ${b.resist}.` : 'Not met yet.'));
  }));
  shell.card(el('div', 'ak-card hf-log-card', el('p', 'ak-card-kicker', 'HOTFIX'), el('h2', 'ak-card-title', `Bug log ${save.seen.length}/${ALL_BUGS.length}`), list, el('div', 'ak-card-actions', close)), { label: 'Bug log' });
}
function toTitleRun() {
  attract = true;
  run = createRun({ mode: 'run', seed: (Math.random() * 1e9) >>> 0 });
  startAt(run, 3);
  bot = createBot('expert', 9);
  reset();
}
function toTitle() {
  snd.stopMusic();
  toTitleRun();
  her.hide(true); tip.hidden = true;
  const daily = dailySeed();
  const log = el('button', { class: 'ak-link', type: 'button' }, `Bug log ${save.seen.length}/${ALL_BUGS.length}`);
  log.addEventListener('click', bugLog);
  shell.title({
    logo: ['HOT', { text: 'FIX', tone: 'pink' }],
    tagline: 'Drag one chip. Chain the combos. Squash her bugs.',
    onPlay: () => begin('run'),
    best: shell.store.best(), bestLabel: save.bestFloor ? `Deepest floor ${save.bestFloor} · Best` : 'Best',
    modes: [
      { label: 'Daily', sub: shell.store.best(`daily:${daily.key}`) ? `today’s best ${fmt(shell.store.best(`daily:${daily.key}`))}` : 'the same bugs for everyone', onClick: () => begin('daily') },
      { label: 'Combo lab', sub: 'no bugs, 10 moves, go big', onClick: () => begin('lab') },
    ],
    extra: log,
  });
  layout();
}

// ---------- the loop ----------
createLoop({
  update(dt) {
    if (!run) return;
    const live = attract ? shell.state === 'title' : DEMO || shell.state === 'play';
    if (!live) return;
    clock += dt;
    if (phase === 'drag' && drag) {
      if (drag.started) drag.left -= dt;
      if (drag.left <= 0) drop();
    }
    if (phase === 'resolve') tick(dt);
    // the bot: plans a drag, then pulls the chip along it, a cell at a time
    if (bot && phase === 'idle' && !run.over) {
      thinkT -= dt;
      if (thinkT <= 0) {
        botPath = plan(bot, run);
        const p = cellCenter(R, botPath[0]);
        drag = { path: [botPath[0]], cells: run.cells.slice(), id: run.cells[botPath[0]].id, x: p.x, y: p.y, left: 99, started: true };
        phase = 'drag'; botPath.t = 0; botPath.i = 1;
      }
    } else if (bot && phase === 'drag' && botPath) {
      botPath.t += dt;
      while (botPath.i < botPath.length && botPath.t >= botPath.i * 0.075) { const c = botPath[botPath.i++]; moveTo(c); const q = cellCenter(R, c); drag.x = q.x; drag.y = q.y; }
      if (botPath.i >= botPath.length && botPath.t >= botPath.length * 0.075 + 0.12) { botPath = null; thinkT = attract ? 0.9 : 0.45; drop(); }
    }
    if (!attract && !DEMO && run && phase !== 'over') her.status(run.mode === 'lab' ? `${run.lab} moves left` : `uptime ${Math.ceil(shownUp)}`);
  },
  render(alpha, frameDt) {
    if (!run || !R.L) return;
    const dt = Math.min(0.05, frameDt);
    if (shell.state !== 'pause') fx.update(R, dt);
    const bugsView = run.bugs.map((b) => ({ ...b, hp: shownHp.has(b.uid) ? shownHp.get(b.uid) : b.hp }));
    const cells = drag ? drag.cells : show || run.cells;
    draw(R, { ...run, bugs: bugsView }, cells, shell.state === 'pause' ? 0 : dt, {
      time: clock, held: drag ? { id: drag.id, x: drag.x, y: drag.y } : null,
      timer: drag && drag.started && !bot ? clamp(drag.left / dragTime(run), 0, 1) : null,
      combo, popping, attract, uptime: shownUp,
    });
    // the keyboard's cursor
    if (!drag && !attract && phase === 'idle' && playing() && document.documentElement.dataset.hfKeys === '1') {
      const p = cellCenter(R, cursor), ctx = R.ctx;
      ctx.lineWidth = 3; ctx.strokeStyle = '#fffaf0'; ctx.strokeRect(p.x - R.L.cell / 2 + 3, p.y - R.L.cell / 2 + 3, R.L.cell - 6, R.L.cell - 6);
    }
  },
  paused: () => shell.state === 'pause',
}).start();
addEventListener('keydown', (e) => { if (e.key.startsWith('Arrow')) document.documentElement.dataset.hfKeys = '1'; });
addEventListener('pointerdown', () => { document.documentElement.dataset.hfKeys = '0'; });

if (QA) window.__hf = { get run() { return run; }, get phase() { return phase; }, begin, R, cellCenter };
layout();
if (DEMO) begin('run'); else toTitle();
