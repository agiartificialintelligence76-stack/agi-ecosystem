// WEB SCRAPER: the page. The arcade kit's frame, the layout, the steering (a drag anywhere is a joystick; arrows or
// WASD), the loop, the round's standings, her scrapbook and rims, and what each of the rules' events looks and sounds
// like. The rules are ./rules.js (pure), the portals' minds ./ai.js, the picture ./render.js, the sound ./sound.js,
// her words ./lines.js.
import './style.css';
import { createShell, el } from '../kit/shell.js';
import { createLoop } from '../kit/loop.js';
import { pointer, keyboard } from '../kit/input.js';
import { DEMO, SEED, QUERY } from '../kit/env.js';
import { fmt, fmtTime, clamp } from '../kit/fx.js';
import { createHer } from '../kit/her.js';
import { createRound, update, drain, ranking, rankOf, share, stars, dailySeed, TYPE_IDS, RIMS, TUNE } from './rules.js';
import { createBrain, think } from './ai.js';
import { createRenderer, layout as layoutCity, draw, fx } from './render.js';
import { createSound } from './sound.js';
import { say, TIPS, typeName, shareText } from './lines.js';

const root = document.getElementById('ak-root');
const shell = createShell({
  game: 'webscraper', name: 'WEB SCRAPER', root,
  howTo: {
    intro: 'AGI-1’s web scraper is a portal. Everything smaller than it falls in and makes it bigger.',
    steps: [
      ['Steer', 'Drag anywhere: the portal goes the way you pull (or use the arrows / WASD).'],
      ['Start small', 'Only things smaller than the portal fall in: cones and boba cups first, then cars, houses, towers.'],
      ['Rivals', 'Three rival scrapers are eating the same city. A portal clearly bigger than another swallows it whole.'],
      ['Two minutes', 'The most data when time’s up wins. Swallowed? You’re back, smaller, a moment later.'],
      ['Scrape it all', 'No rivals: swallow as much of the city as you can for stars.'],
    ],
    touch: [['Drag', 'Steer']],
    keys: [['Arrows / WASD', 'Steer'], ['Mouse drag', 'Steer'], ['Esc / P', 'Pause']],
  },
  onRestart() { if (run && !run.attract) begin(run.mode); },
  onQuit() { queueMicrotask(toTitle); },
});

const canvas = el('canvas', { class: 'ws-canvas', role: 'img', 'aria-label': 'A little city from above, with AGI-1’s scraper portal and three rival portals.' });
const safe = el('div', { class: 'ws-safe', 'aria-hidden': 'true' });
const board = el('ol', { class: 'ws-board', 'aria-label': 'Standings' });
const tipText = el('span');
const tip = el('p', { class: 'ws-tip', hidden: true, role: 'status' }, tipText);
shell.stage.append(canvas, safe, board, tip);
const R = createRenderer(canvas);
const her = createHer(shell.stage, { cls: 'ws-her', status: 'hungry for data' });
const snd = createSound(shell.audio);
const scoreChip = shell.chip('', 0, { accent: true });
const timeChip = shell.chip('', '2:00');
try { document.fonts?.load("900 20px 'AK Display'"); } catch { /* fallback font meanwhile */ }

const QA = QUERY.has('qa');
const AUTO = QA && QUERY.has('auto');
let save = shell.store.read();
if (!Array.isArray(save.book)) save.book = [];
if (!Number.isInteger(save.wins)) save.wins = 0;
if (!RIMS.some((r) => r.id === save.rim)) save.rim = 'mint';
if (!save.tips || typeof save.tips !== 'object') save.tips = {};
const persist = () => { if (!QA) shell.store.update((d) => Object.assign(d, save)); };
const rimColor = () => RIMS.find((r) => r.id === save.rim)?.color || '#3ff0c3';

let lastFound = -9;
let S = null, run = null, brains = new Map(), clock = 0, endAt = 0, stick = null, lastTick = 99, boardT = 0, warned = 0;
const playing = () => Boolean(S && run && !run.attract && shell.state === 'play' && !S.over);

// ---------- layout ----------
function layout() {
  const box = shell.stage.getBoundingClientRect();
  const w = Math.max(1, Math.round(box.width)), h = Math.max(1, Math.round(box.height));
  const dpr = clamp(Math.min(window.devicePixelRatio || 1, 2, 2400 / w), 1, 2);
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
  const st = parseFloat(getComputedStyle(safe).paddingTop) || 0;
  const barB = DEMO ? st : shell.bar.getBoundingClientRect().bottom - box.top;
  layoutCity(R, { w, h, dpr, top: run?.attract ? 0 : Math.max(0, barB - 10) });
}
new ResizeObserver(() => layout()).observe(shell.stage);

// ---------- steering: a joystick wherever the finger goes down ----------
pointer(canvas, {
  down(p) { if (playing()) stick = { x0: p.x, y0: p.y, x: p.x, y: p.y }; },
  move(p) { if (stick) { stick.x = p.x; stick.y = p.y; } },
  up() { stick = null; },
});
const keys = keyboard({ ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down', ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right' }, { blocked: () => shell.state !== 'play' });
function myWish() {
  if (stick) {
    const dx = stick.x - stick.x0, dy = stick.y - stick.y0, d = Math.hypot(dx, dy);
    if (d < 6) return { x: 0, y: 0 };
    const m = Math.min(1, d / 46);
    return { x: (dx / d) * m, y: (dy / d) * m };
  }
  const x = (keys.held('right') ? 1 : 0) - (keys.held('left') ? 1 : 0), y = (keys.held('down') ? 1 : 0) - (keys.held('up') ? 1 : 0);
  return x || y ? { x, y } : { x: 0, y: 0 };
}

// ---------- her words, tips, the standings ----------
function coach(id) {
  if (DEMO || QA || !run || run.attract || save.tips[id] || !TIPS[id]) return;
  save.tips[id] = true; persist();
  tipText.textContent = TIPS[id];
  tip.hidden = false; tip.classList.remove('is-in'); void tip.offsetWidth; tip.classList.add('is-in');
  clearTimeout(coach.t); coach.t = setTimeout(() => { tip.hidden = true; }, 4800);
}
const speak = (kind, opts = {}) => { if (run && !run.attract && !DEMO) her.say(say(kind), opts.ms || 2400, opts); };
function drawBoard() {
  board.replaceChildren(...ranking(S).map((h, i) => {
    const li = el('li', { class: `ws-row${h.you ? ' is-you' : ''}` }, el('span', 'ws-rank', String(i + 1)), el('i', 'ws-dot'), el('span', 'ws-name', h.you ? 'YOU' : h.name), el('b', 'ws-score', fmt(h.score, { compact: true })));
    li.querySelector('.ws-dot').style.background = h.you ? (rimColor() === 'rainbow' ? '#ff4da6' : rimColor()) : h.color;
    return li;
  }));
}

// ---------- the rules' events ----------
function handle(e) {
  const quiet = run.attract;
  switch (e.type) {
    case 'eat':
      if (!e.you) break;
      fx.eat(R, e);
      if (quiet) break;
      snd.eat(e.r, e.value);
      scoreChip.set(S.me.score);
      if (e.r >= 1.6) { her.mood('wow'); speak('big'); shell.haptic([10, 20, 14]); } else if (e.r > 0.6) shell.haptic(5);
      if (e.first && !save.book.includes(e.thing)) {
        save.book.push(e.thing); persist();
        if (clock - lastFound > 4) { lastFound = clock; snd.found(); shell.toast(`Scrapbook: ${typeName(e.thing)} (${save.book.length}/${TYPE_IDS.length})`, 'good'); }
        if (Math.random() < 0.5) speak('found');
      }
      if (S.me.eaten === 12) coach('rivals');
      break;
    case 'swallow':
      fx.swallow(R, e);
      if (quiet) break;
      if (e.you) { snd.swallow(); her.mood('love'); speak('ate', { force: true }); shell.haptic([20, 30, 40]); }
      else if (e.victimYou) { snd.eaten(); her.mood('sad', 2200); speak('eaten', { force: true }); shell.haptic([60, 40, 80]); }
      break;
    case 'respawn': if (e.you && !quiet) { snd.back(); speak('back'); } break;
    case 'over': endAt = clock + 0.6; break;
    default: break;
  }
}

// ---------- rounds ----------
function newRound(mode, seed, attract) {
  S = createRound({ mode, seed });
  brains = new Map(S.holes.map((h, i) => [h, createBrain(h.you ? 'expert' : attract ? 'steady' : 'steady', seed + i * 31)]));
  R.cam = { x: S.me.x, y: S.me.y, view: 15 };
  fx.reset(R);
  if (DEMO) { S.me.r = 1.3; S.me.area = Math.PI * S.me.r * S.me.r; R.cam.view = 22; }
}
function begin(mode) {
  const daily = mode === 'daily' ? dailySeed() : null;
  const seed = daily ? daily.seed : (SEED || (Math.random() * 2 ** 31) >>> 0);
  run = { mode: daily ? 'battle' : mode, daily, attract: false, auto: DEMO || AUTO };
  newRound(run.mode, seed, false);
  endAt = 0; lastTick = 99; warned = 0; stick = null;
  her.hide(DEMO);
  board.hidden = run.mode === 'solo' || DEMO;
  scoreChip.set(0); timeChip.set(fmtTime(TUNE.round));
  shell.started({ count: !DEMO && !QA });
  if (!DEMO) {
    snd.start(); snd.music();
    speak(mode === 'daily' ? 'daily' : mode === 'solo' ? 'solo' : 'start', { force: true });
    her.mood('happy');
    coach('move'); setTimeout(() => coach('small'), 5200);
  }
  drawBoard();
  layout();
}
function ending() {
  snd.stopMusic();
  const rank = rankOf(S, S.me), st = stars(S);
  const solo = run.mode === 'solo';
  if (!solo && rank === 1) save.wins++;
  const before = RIMS.filter((r) => save.wins - (rank === 1 && !solo ? 1 : 0) >= r.need).length;
  const opened = RIMS.filter((r) => save.wins >= r.need).slice(before);
  persist();
  snd.end(solo ? st >= 2 : rank === 1);
  const standings = solo ? null : el('ol', 'ws-final', ranking(S).map((h, i) => el('li', `ws-final-row${h.you ? ' is-you' : ''}`, el('span', null, `${i + 1}. ${h.you ? 'You' : h.name}`), el('b', null, fmt(h.score)))));
  const pct = share(S);
  shell.over({
    score: solo ? Math.round(pct) : S.me.score, label: solo ? 'of the city scraped' : 'data scraped',
    format: solo ? (v) => `${v}%` : undefined,
    bestKey: solo ? 'solo' : run.daily ? `daily:${run.daily.key}` : 'best',
    title: solo ? `${'★'.repeat(st)}${'☆'.repeat(3 - st)}` : rank === 1 ? 'Biggest scraper in town' : `#${rank} of ${S.holes.length}`,
    stats: [['Biggest', `${(S.me.best * 2).toFixed(1)} m`], ['Things', fmt(S.me.eaten)], ...(solo ? [['Scrapbook', `${save.book.length}/${TYPE_IDS.length}`]] : [['Rivals scraped', String(S.me.kills)], ['Got scraped', String(S.me.deaths)]])],
    line: say((solo ? st >= 2 : rank === 1) ? 'win' : 'lose'),
    share: shareText({ mode: run.mode, rank, score: S.me.score, pct }),
    extra: el('div', 'ws-over-extra', standings, opened.length ? el('p', 'ws-unlock', '✦ New rim: ', el('b', null, opened.map((r) => r.name).join(', '))) : null),
    onAgain: () => begin(run.daily ? 'daily' : run.mode), onMenu: () => toTitle(),
  });
  her.hide(true);
}

function rimPicker() {
  const box = el('div', { class: 'ws-rims', role: 'group', 'aria-label': 'Portal rim' });
  const paint = () => box.replaceChildren(el('span', 'ws-rims-label', `Scrapbook ${save.book.length}/${TYPE_IDS.length} · Rim`), ...RIMS.map((r) => {
    const open = save.wins >= r.need;
    const b = el('button', { class: 'ws-rim', type: 'button', 'aria-pressed': String(save.rim === r.id), 'aria-disabled': open ? null : 'true', 'data-rim': r.id }, open ? r.name : `🔒 ${r.need} win${r.need === 1 ? '' : 's'}`);
    b.addEventListener('click', () => {
      if (!open) { shell.toast(`${r.name}: win ${r.need - save.wins} more round${r.need - save.wins === 1 ? '' : 's'}`, 'warn'); shell.audio.sfx('error'); return; }
      save.rim = r.id; persist(); shell.audio.sfx('select'); paint();
    });
    return b;
  }));
  paint();
  return box;
}
function toTitle() {
  snd.stopMusic();
  run = { mode: 'battle', attract: true, auto: true };
  newRound('battle', 20261124, true);
  for (let i = 0; i < 20 * 30; i++) { update(S, 1 / 30, (h) => think(brains.get(h), S, h, 1 / 30)); drain(S); }
  R.cam = { x: S.me.x, y: S.me.y, view: 26 };
  her.hide(true); board.hidden = true; tip.hidden = true;
  const daily = dailySeed();
  shell.title({
    logo: ['WEB', { text: 'SCRAPER', tone: 'mint' }],
    tagline: 'Swallow the city, one cone at a time. Then the towers.',
    onPlay: () => begin('battle'),
    best: shell.store.best(),
    modes: [
      { label: 'Scrape it all', sub: shell.store.best('solo') ? `best ${shell.store.best('solo')}%` : 'no rivals, the whole city', onClick: () => begin('solo') },
      { label: 'Daily', sub: shell.store.best(`daily:${daily.key}`) ? `today’s best ${fmt(shell.store.best(`daily:${daily.key}`))}` : 'one city for everyone', onClick: () => begin('daily') },
    ],
    extra: rimPicker(),
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
      update(S, dt, (h) => (h.you && !run.auto ? myWish() : think(brains.get(h), S, h, dt)));
      for (const e of drain(S)) handle(e);
      if (!run.attract) {
        const t = fmtTime(Math.ceil(S.left));
        if (timeChip.value !== t) timeChip.set(t);
        const sec = Math.ceil(S.left);
        if (!DEMO && sec <= 10 && sec !== lastTick) { lastTick = sec; snd.tick(); if (sec === 10) speak('hurry', { force: true }); }
        boardT -= dt;
        if (boardT <= 0 && !board.hidden) { boardT = 0.3; drawBoard(); }
        if (!DEMO) {
          her.status(S.me.dead > 0 ? 'scraped… back soon' : `${(S.me.r * 2).toFixed(1)} m wide`);
          const danger = S.holes.some((o) => !o.you && o.dead <= 0 && o.r >= S.me.r * 1.14 && Math.hypot(o.x - S.me.x, o.y - S.me.y) < o.r + S.me.r + 3);
          if (danger && clock - warned > 6) { warned = clock; speak('danger'); her.mood('worried'); }
        }
      }
    } else if (endAt && clock >= endAt) {
      endAt = 0;
      if (run.attract) newRound('battle', (Math.random() * 1e9) >>> 0, true);
      else if (DEMO) begin('battle');
      else ending();
    }
  },
  render(alpha, frameDt) {
    if (!S || !R.L) return;
    const dt = Math.min(0.05, frameDt);
    if (shell.state !== 'pause') fx.update(R, dt);
    draw(R, S, shell.state === 'pause' ? 0 : dt, { time: clock, rim: run?.attract ? '#3ff0c3' : rimColor(), attract: run?.attract });
    // the joystick under the finger
    if (stick && playing()) {
      const ctx = R.ctx;
      ctx.setTransform(R.L.dpr, 0, 0, R.L.dpr, 0, 0);
      const dx = stick.x - stick.x0, dy = stick.y - stick.y0, d = Math.hypot(dx, dy), k = d > 46 ? 46 / d : 1;
      ctx.globalAlpha = 0.5; ctx.lineWidth = 3; ctx.strokeStyle = '#fffaf0';
      ctx.beginPath(); ctx.arc(stick.x0, stick.y0, 46, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.arc(stick.x0 + dx * k, stick.y0 + dy * k, 18, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  },
  paused: () => shell.state === 'pause',
}).start();

if (QA) window.__ws = { get S() { return S; }, get run() { return run; }, begin };
layout();
if (DEMO) begin('battle'); else toTitle();
