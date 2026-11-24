// TOO MANY TABS: the page. The arcade kit's frame, the layout, taps and keys, the loop, the three helpers, and what each
// of the rules' events looks and sounds like. The rules are ./rules.js (pure), the demo's player ./ai.js, the picture
// ./render.js and ./art.js, the sound ./sound.js, her words ./lines.js.
import './style.css';
import { createShell, el } from '../kit/shell.js';
import { createLoop } from '../kit/loop.js';
import { pointer, keyboard } from '../kit/input.js';
import { DEMO, SEED, QUERY } from '../kit/env.js';
import { fmt, fmtTime, clamp } from '../kit/fx.js';
import { createHer } from '../kit/her.js';
import { createLevel, pick, settle, undo, shuffle, tabOut, revive, update, drain, isFree, freeTiles, starsOf, dailySeed, paramsFor, DAILY_LEVEL, rushLevel, TUNE, TRAY, WALLPAPERS } from './rules.js';
import { createBot, choose } from './ai.js';
import { createRenderer, layout as layoutBoard, draw, fx, hit, tilePos, recount } from './render.js';
import { createSound } from './sound.js';
import { say, TIPS, shareText } from './lines.js';

const root = document.getElementById('ak-root');
const shell = createShell({
  game: 'toomanytabs', name: 'TOO MANY TABS', root,
  howTo: {
    intro: 'AGI-1 has way too many tabs open. Close them all before her browser freezes.',
    steps: [
      ['Tap a tab', 'Only tabs with nothing on top of them can be tapped. It drops into her taskbar at the bottom.'],
      ['Three alike close', 'Three of the same tab in the taskbar close together. Close them quickly in a row for a streak.'],
      ['Seven is too many', 'Seven tabs in the taskbar with no three alike and the browser freezes.'],
      ['Helpers', 'Undo takes back a tab, Shuffle mixes the pile, Tab out parks three taskbar tabs on a shelf. One of each per board.'],
      ['Stars', 'Close every tab fast for three stars. Stars open new wallpapers.'],
    ],
    touch: [['Tap', 'Take a tab']],
    keys: [['Click', 'Take a tab'], ['← → + Enter', 'Pick with the keys'], ['U · S · O', 'Undo · Shuffle · Tab out'], ['Esc / P', 'Pause']],
  },
  onRestart() { if (run && !run.attract) begin(run.mode, run.level); },
  onQuit() { queueMicrotask(toTitle); },
});

const canvas = el('canvas', { class: 'tt-canvas', role: 'img', 'aria-label': 'A pile of browser tabs in layers over AGI-1’s taskbar.' });
const safe = el('div', { class: 'tt-safe', 'aria-hidden': 'true' });
const tipText = el('span');
const tip = el('p', { class: 'tt-tip', hidden: true, role: 'status' }, tipText);
const row = el('div', 'tt-row');
shell.stage.append(canvas, safe, tip, row);
const her = createHer(row, { cls: 'tt-her', status: 'so many tabs…' });
const helper = (id, label, glyph) => {
  const count = el('b', 'tt-count', '1');
  const b = el('button', { class: 'tt-help', type: 'button', 'data-help': id, 'aria-label': label }, el('span', 'tt-glyph', glyph), el('span', 'tt-label', label), count);
  row.append(b);
  return { b, count };
};
const H = { undo: helper('undo', 'Undo', '↶'), shuffle: helper('shuffle', 'Shuffle', '⤨'), out: helper('out', 'Tab out', '⇡') };
const R = createRenderer(canvas);
const snd = createSound(shell.audio);
const scoreChip = shell.chip('', 0, { accent: true });
const levelChip = shell.chip('Lv', 1);
try { document.fonts?.load("900 20px 'AK Display'"); } catch { /* fallback font meanwhile */ }

const QA = QUERY.has('qa');
let save = shell.store.read();
if (!Number.isInteger(save.level) || save.level < 1) save.level = 1;
if (!save.stars || typeof save.stars !== 'object') save.stars = {};
if (!save.tips || typeof save.tips !== 'object') save.tips = {};
if (!WALLPAPERS.some((w) => w.id === save.wall)) save.wall = 'grid';
const persist = () => { if (!QA) shell.store.update((d) => Object.assign(d, save)); };
const totalStars = () => Object.values(save.stars).reduce((a, b) => a + (Number(b) || 0), 0);

let S = null, run = null, bot = null, botT = 0, clock = 0, settleAt = 0, endAt = 0, endKind = '', hover = null, focus = -1;
const playing = () => Boolean(S && run && !run.attract && shell.state === 'play' && !S.over && !bot);

// ---------- layout ----------
function layout() {
  const box = shell.stage.getBoundingClientRect();
  const w = Math.max(1, Math.round(box.width)), h = Math.max(1, Math.round(box.height));
  const dpr = clamp(Math.min(window.devicePixelRatio || 1, 2, 2600 / w), 1, 2);
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
  const cs = getComputedStyle(safe);
  const st = parseFloat(cs.paddingTop) || 0, sb = parseFloat(cs.paddingBottom) || 0, sl = parseFloat(cs.paddingLeft) || 0, sr = parseFloat(cs.paddingRight) || 0;
  const barB = DEMO ? st + 2 : shell.bar.getBoundingClientRect().bottom - box.top;
  const rowH = row.hidden ? 0 : row.getBoundingClientRect().height + 10;
  layoutBoard(R, { w, h, dpr, top: barB, bottom: (DEMO ? 8 : rowH) + sb + 4, floor: sb + 4, left: sl, right: sr });
}
new ResizeObserver(() => layout()).observe(shell.stage);

// ---------- input ----------
function tapTile(t) {
  if (!playing() || !t) return;
  if (!isFree(S, t)) { fx.blocked(R, t.id); snd.blocked(); shell.haptic(6); if (Math.random() < 0.3) her.say(say('blocked')); return; }
  if (S.tray.length >= TRAY) return;
  const from = t.where === 'board' ? tilePos(R, t) : R.vis.get(t.id);
  if (pick(S, t.id)) { flush(from); settleAt = clock + 0.17; }
}
pointer(canvas, {
  tap(p) { tapTile(hit(R, S, p.x, p.y)); },
  hover(p) { if (p.type === 'mouse' && S) { const t = hit(R, S, p.x, p.y); hover = t && isFree(S, t) ? t : null; canvas.classList.toggle('is-hot', Boolean(hover) && playing()); } },
});
canvas.addEventListener('pointerleave', () => { hover = null; canvas.classList.remove('is-hot'); });
function choices() { return freeTiles(S).concat(S.shelf.map((id) => S.tiles[id - 1])).sort((a, b) => a.y - b.y || a.x - b.x); }
keyboard({ ArrowLeft: 'prev', ArrowUp: 'prev', ArrowRight: 'next', ArrowDown: 'next', Enter: 'take', ' ': 'take', u: 'undo', s: 'shuffle', o: 'out', z: 'undo' }, {
  blocked: () => shell.state !== 'play',
  down(name) {
    if (!playing()) return;
    if (name === 'undo' || name === 'shuffle' || name === 'out') { useHelper(name); return; }
    const list = choices();
    if (!list.length) return;
    if (name === 'take') { if (hover) tapTile(hover); return; }
    focus = (focus + (name === 'next' ? 1 : -1) + list.length) % list.length;
    hover = list[focus];
  },
});
function useHelper(id) {
  if (!playing()) return;
  settle(S); flush();
  const ok = id === 'undo' ? undo(S) : id === 'shuffle' ? shuffle(S) : tabOut(S);
  if (!ok) { snd.blocked(); shell.toast(S.boosters[id] <= 0 ? 'Used up on this board' : id === 'undo' ? 'Nothing to undo' : id === 'out' ? 'The shelf is full' : 'Nothing to shuffle', 'warn'); return; }
  flush();
}
for (const [id, h] of Object.entries(H)) h.b.addEventListener('click', () => { shell.audio.unlock(); useHelper(id); });
function drawHelpers() {
  for (const [id, h] of Object.entries(H)) {
    const n = S ? S.boosters[id] : 0;
    h.count.textContent = String(n);
    h.b.disabled = !playing() || n <= 0;
  }
}

// ---------- tips ----------
function coach(id) {
  if (DEMO || QA || !run || run.attract || save.tips[id] || !TIPS[id]) return;
  save.tips[id] = true; persist();
  tipText.textContent = TIPS[id];
  tip.hidden = false; tip.classList.remove('is-in'); void tip.offsetWidth; tip.classList.add('is-in');
  clearTimeout(coach.t); coach.t = setTimeout(() => { tip.hidden = true; }, 5200);
}
const speak = (kind, opts = {}) => { if (run && !run.attract && !DEMO) her.say(say(kind), opts.ms || 2500, opts); };

// ---------- the rules' events ----------
function flush(from = null) { for (const e of drain(S)) handle(e, from); drawHelpers(); }
function handle(e, from) {
  const quiet = run.attract;
  switch (e.type) {
    case 'pick':
      fx.pick(R, S, e, from);
      recount(R, S);
      if (!quiet) { snd.pick(e.count); shell.haptic(6); if (e.count === 2 && Math.random() < 0.25) speak('pair'); }
      if (!quiet && S.tray.length >= TRAY - 2) { her.mood('worried'); speak('crowded'); coach('helpers'); }
      if (!quiet) coach('three');
      break;
    case 'triple':
      fx.triple(R, e);
      if (!quiet) {
        snd.triple(e.combo);
        scoreChip.set(run.base + S.score, { pop: true });
        shell.haptic(e.combo >= 3 ? [10, 30, 14] : 10);
        her.mood(e.combo >= 3 ? 'wow' : 'happy');
        if (e.combo >= 3) speak('streak'); else if (Math.random() < 0.3) speak('triple');
      }
      break;
    case 'undo': if (!quiet) { snd.undo(); speak('undo'); } R.vis.delete(e.id); recount(R, S); break;
    case 'shuffle': fx.shuffle(R, S); recount(R, S); if (!quiet) { snd.shuffle(); speak('shuffle'); } break;
    case 'out': if (!quiet) { snd.out(); speak('out'); her.mood('happy'); } break;
    case 'full':
      fx.full(R);
      if (!quiet) { snd.full(); shell.haptic([40, 60, 40]); her.mood('sad', 1800); speak('full', { force: true }); }
      endAt = clock + 0.85; endKind = 'full';
      break;
    case 'clear':
      fx.clear(R);
      if (!quiet) { snd.clear(e.stars); her.mood('love', 1800); speak(e.stars === 3 ? 'three' : 'clear', { force: true }); scoreChip.set(run.base + S.score, { pop: true }); }
      endAt = clock + (run.mode === 'rush' ? 0.55 : 1.1); endKind = 'clear';
      break;
    default: break;
  }
}

// ---------- boards ----------
function newBoard(level, seed) {
  S = createLevel({ level, seed, mode: run.mode });
  fx.reset(R);
  R.hideDeep = level >= 8;
  recount(R, S);
  settleAt = 0; endAt = 0; endKind = ''; hover = null; focus = -1;
  layout();
}
function begin(mode, level) {
  const daily = mode === 'daily' ? dailySeed() : null;
  run = { mode, attract: false, level, daily, base: 0, board: 0, rushLeft: TUNE.rushTime, revived: false };
  bot = DEMO ? createBot('expert', SEED || 7) : null; botT = 1.2;
  const lv = mode === 'daily' ? DAILY_LEVEL : mode === 'rush' ? rushLevel(0) : level;
  const seed = daily ? daily.seed : mode === 'rush' ? (SEED || (Math.random() * 2 ** 31) >>> 0) : 1;
  run.seed = seed;
  newBoard(lv, seed);
  row.hidden = DEMO;
  scoreChip.set(0);
  levelChip.set(mode === 'daily' ? 'Daily' : mode === 'rush' ? fmtTime(run.rushLeft) : level);
  shell.started({ count: !DEMO && !QA });
  if (!DEMO) {
    snd.start(); snd.music();
    speak(mode === 'daily' ? 'daily' : mode === 'rush' ? 'rush' : 'start', { force: true });
    her.mood('happy');
    if (mode === 'levels' && level === 1) coach('tap');
    if (R.hideDeep) coach('hidden');
  }
  drawHelpers();
  layout();
}
function nextRushBoard() {
  run.base += S.score;
  run.board++;
  run.rushLeft += TUNE.rushBonus;
  shell.toast(`+${TUNE.rushBonus}s · board ${run.board + 1}`, 'good');
  newBoard(rushLevel(run.board), run.seed + run.board * 7919);
  drawHelpers();
}

function reviveButton() {
  if (S.revived || S.won) return null;
  const b = el('button', { class: 'ak-btn ak-btn-sm tt-revive', type: 'button' }, 'Force quit 3 tabs & keep going');
  b.addEventListener('click', () => {
    if (!revive(S)) return;
    snd.revive(); flush();
    shell.started({ count: false });
    speak('revive', { force: true });
    drawHelpers();
  });
  return b;
}
function ending() {
  snd.stopMusic();
  const stats = [['Time', fmtTime(S.time)], ['Closed', `${S.closed * 3} tabs`]];
  if (run.mode === 'levels') {
    const n = run.level;
    if (S.won) {
      const stars = starsOf(S);
      save.stars[n] = Math.max(save.stars[n] || 0, stars);
      save.level = Math.max(save.level, n + 1);
      persist();
      shell.over({
        score: S.score, label: 'points', bestKey: `lv${n}`, title: `Level ${n} cleared`,
        stats: [...stats, ['Stars', '★'.repeat(stars) + '☆'.repeat(3 - stars)], ['Next', `${paramsFor(n + 1).tiles} tabs`]],
        line: say(stars === 3 ? 'three' : 'clear'), share: shareText({ mode: 'levels', level: n }),
        again: `Level ${n + 1}`, onAgain: () => begin('levels', n + 1), onMenu: () => toTitle(),
        extra: el('p', 'tt-stars', '★'.repeat(stars) + '☆'.repeat(3 - stars)),
      });
    } else {
      shell.over({ score: S.score, label: 'points', best: null, title: 'Browser froze', stats: [...stats, ['Level', String(n)]],
        line: say('endLow'), share: shareText({ mode: 'levels', level: n }), again: 'Try again',
        onAgain: () => begin('levels', n), onMenu: () => toTitle(), extra: reviveButton() });
    }
  } else if (run.mode === 'daily') {
    const score = S.won ? S.score : null;
    if (S.won) {
      shell.over({ score, label: 'points', bestKey: `daily:${run.daily.key}`, title: 'Daily cleared', stats: [...stats, ['Stars', '★'.repeat(starsOf(S))]],
        line: say('clear'), share: shareText({ mode: 'daily', time: S.time }), onAgain: () => begin('daily'), onMenu: () => toTitle() });
    } else {
      shell.over({ score: S.score, label: 'points', best: null, title: 'Browser froze', stats, line: say('endLow'), share: shareText({ mode: 'daily', time: S.time }),
        again: 'Try again', onAgain: () => begin('daily'), onMenu: () => toTitle(), extra: reviveButton() });
    }
  } else {
    const total = run.base + S.score;
    shell.over({ score: total, label: 'points', bestKey: 'rush', title: run.rushLeft <= 0 ? 'Time’s up' : 'Browser froze',
      stats: [['Boards', String(run.board + (S.won ? 1 : 0))], ['Closed', `${S.closed * 3} tabs`]], line: say(total > 1500 ? 'endHigh' : 'endLow'),
      share: shareText({ mode: 'rush', score: total }), onAgain: () => begin('rush'), onMenu: () => toTitle(), extra: run.rushLeft > 0 ? reviveButton() : null });
  }
  drawHelpers();
}

// ---------- the title (a board quietly clearing itself behind it) ----------
function wallPicker() {
  const box = el('div', { class: 'tt-walls', role: 'group', 'aria-label': 'Wallpaper' });
  const stars = totalStars();
  const paint = () => box.replaceChildren(el('span', 'tt-walls-label', `★ ${stars} · Wallpaper`), ...WALLPAPERS.map((w) => {
    const open = stars >= w.need;
    const b = el('button', { class: 'tt-wall', type: 'button', 'data-wall': w.id, 'aria-pressed': String(save.wall === w.id), 'aria-disabled': open ? null : 'true' }, open ? w.name : `🔒 ★${w.need}`);
    b.addEventListener('click', () => {
      if (!open) { shell.toast(`${w.name}: ${w.need - stars} more stars`, 'warn'); shell.audio.sfx('error'); return; }
      save.wall = w.id; persist(); shell.audio.sfx('select'); paint();
    });
    return b;
  }));
  paint();
  return box;
}
function toTitle() {
  snd.stopMusic();
  run = { mode: 'levels', attract: true, level: 6, base: 0 };
  bot = createBot('steady', 5); botT = 1;
  newBoard(6, 20261124);
  row.hidden = true;
  tip.hidden = true;
  const daily = dailySeed();
  shell.title({
    logo: ['TOO MANY', { text: 'TABS', tone: 'pink' }],
    tagline: 'Close her tabs in threes before the browser freezes.',
    play: `Level ${save.level}`,
    onPlay: () => begin('levels', save.level),
    best: null,
    modes: [
      { label: 'Daily', sub: shell.store.best(`daily:${daily.key}`) ? `today’s best ${fmt(shell.store.best(`daily:${daily.key}`))}` : 'one big mess for everyone', onClick: () => begin('daily') },
      { label: 'Rush', sub: shell.store.best('rush') ? `best ${fmt(shell.store.best('rush'))}` : 'boards against the clock', onClick: () => begin('rush') },
    ],
    extra: el('div', 'tt-title-extra', save.level > 1 ? el('button', { class: 'ak-link tt-restart', type: 'button', onclick: () => begin('levels', 1) }, 'Start from level 1') : null, wallPicker()),
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
    if (S.pending.length && clock >= settleAt) { settle(S); flush(); }
    if (!S.over) {
      update(S, dt);
      if (run.mode === 'rush' && !run.attract) {
        run.rushLeft -= dt;
        const shown = fmtTime(Math.max(0, run.rushLeft));
        if (levelChip.value !== shown) { levelChip.set(shown); if (run.rushLeft < 10 && run.rushLeft > 0) snd.tick(); }
        if (run.rushLeft <= 0) { S.over = true; endAt = clock + 0.4; endKind = 'time'; snd.full(); }
      }
      if (bot) {
        botT -= dt;
        if (botT <= 0) {
          botT = run.attract ? 0.85 : 0.3;
          const c = choose(bot, S);
          if (c === 'out' || c === 'shuffle' || c === 'undo') { (c === 'out' ? tabOut : c === 'shuffle' ? shuffle : undo)(S); flush(); }
          else if (c != null) {
            const t = S.tiles[c - 1];
            const from = t.where === 'board' ? tilePos(R, t) : R.vis.get(t.id);
            if (pick(S, c)) { flush(from); settleAt = clock + 0.17; }
          } else { S.over = true; endAt = clock + 0.5; endKind = 'stuck'; }
        }
      }
    } else if (endAt && clock >= endAt) {
      endAt = 0;
      if (run.attract || DEMO) {
        if (S.won) { run.level = run.attract ? 6 + ((run.level + 1) % 5) : run.level + 1; newBoard(run.level, 20261124 + run.level); }
        else if (revive(S)) flush(); else newBoard(run.level, (Math.random() * 1e9) >>> 0);
        bot = createBot(run.attract ? 'steady' : 'expert', run.level); botT = 0.6;
      } else if (run.mode === 'rush' && endKind === 'clear') nextRushBoard();
      else ending();
    }
  },
  render(alpha, frameDt) {
    if (!S || !R.L) return;
    const dt = Math.min(0.05, frameDt);
    if (shell.state !== 'pause') fx.update(R, dt);
    draw(R, S, dt, { time: clock, wallpaperId: run?.attract ? 'grid' : save.wall, hover: playing() ? hover : null, attract: run?.attract, rush: run?.mode === 'rush' && !run.attract ? Math.max(0, run.rushLeft) : null });
  },
  paused: () => shell.state === 'pause',
}).start();

if (QA) window.__tt = { get S() { return S; }, get run() { return run; }, begin, R, tilePos, isFree };
layout();
if (DEMO) { run = { mode: 'levels', level: 12 }; begin('levels', 12); } else toTitle();
