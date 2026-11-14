// GROWTH STOCK: AGI-1 left her GPUs for a little farm in Gradient Hills, where the crops are stocks (the owner,
// 2026-11-14: "Stocks are the crops", then "i want real stock names"): plant GME, KO, TSLA, NVDA… and each grows as a
// little candle chart until its shares bloom on top. Plant, water and harvest with a finger (drag across the plots),
// sell from the barn when the rate is up (hold Sell: every share sold pushes it down a little), read the news (fairs,
// trends, gluts, rumours) and plant what will be wanted when it's ripe, get more land, sprinklers and a bigger barn,
// shoo the bear, and make the most gold by Sunday's closing bell. Four quarters, a Daily (the same week for everyone),
// and Endless. Only the names are real: the rates, the news and the gold are made up. No wallet, nothing to buy.
//
// This file is the page: the arcade kit's frame, the layout, the finger, the keys, the loop, and what each of the
// rules' events looks and sounds like. The rules are ./sim.js (pure), the stocks ./crops.js, the seasons and the week's
// news ./seasons.js, the game's own farmers ./ai.js, the picture ./render.js, ./art.js and ./chart.js, the page around
// the field ./ui.js, the sound ./sound.js, her words ./lines.js, what's kept ./progress.js.
import './style.css';
import { createShell } from '../kit/shell.js';
import { createLoop } from '../kit/loop.js';
import { pointer, keyboard } from '../kit/input.js';
import { DEMO, SEED, QUERY } from '../kit/env.js';
import { fmt, clamp } from '../kit/fx.js';
import { CROPS } from './crops.js';
import { SEASONS, seasonOf, makeConfig, clockOf, clockLabel, dateKey, dailySeason, dailySeed, DAYS, WEATHER, END_H, HOUR } from './seasons.js';
import { createSim, step, drain, act, sell, buy, deliver, shoo, select, have, barnCount, barnCap, nextCost, changeOf, fairOf, bearAt, closingBell, dayPlan, STEP, TUNE, COLS, ROWS, plotXY, ripe, growing, thirsty } from './sim.js';
import { createBot, drive, PROFILES } from './ai.js';
import { createRenderer, draw, drawTop, update as updateFx, fx, plotAt } from './render.js';
import { createSound } from './sound.js';
import { createUI, seasonsCard, recordsCard, overExtra, titleExtra } from './ui.js';
import { say, headline, effectOf, orderText, endLine, shareText, TIPS } from './lines.js';
import { load, applyRun, nextSeason, totalStars, seasonOpen, endlessOpen } from './progress.js';
import { MAX_STARS } from './seasons.js';

const root = document.getElementById('ak-root');
const shell = createShell({
  game: 'growthstock', name: 'GROWTH STOCK', root,
  howTo: {
    intro: 'AGI-1 has a farm now, and the crops are stocks: each grows as a little candle chart until its shares bloom. Grow them, sell when the rate is up, and make the most gold by Sunday’s closing bell. Real names, made-up rates and news: it’s a game.',
    steps: [
      ['Drag across the field', 'Empty soil gets the chosen stock. A drop means dry: drag over it to water. Ripe stocks glow: drag over them to harvest their shares.'],
      ['Never let it go dry', 'A stock that never went dry gives one more share when you harvest it.'],
      ['Sell when it’s up', 'Hold Sell. Each share sold pushes that stock’s rate down a little, so spread your sales out.'],
      ['Read the news', 'Fairs and trends make a stock wanted, gluts make it cheap. Plant so it’s ripe in time.'],
      ['Harvest in time', 'A ripe stock left too long wilts. Shares keep in the barn, but the barn only holds so many, and the bell sells what’s left.'],
      ['Grow the farm', 'Tap a sign to get more land. Sprinklers water for you. A bigger barn holds more. Shoo the bear: three taps.'],
    ],
    touch: [['Drag', 'Plant, water, harvest'], ['Hold Sell', 'Sell the chosen stock'], ['Tap a sign', 'Get that plot']],
    keys: [['Mouse', 'Drag across the field'], ['Arrows / WASD', 'Move round the field'], ['Space', 'Plant, water or harvest'], ['1–5', 'Choose a stock'], ['X (hold)', 'Sell'], ['B', 'Shoo the bear'], ['Esc / P', 'Pause']],
  },
  onPause() { endStroke(); ui.stopHold(); },
  onRestart() { if (run?.opts) startRun(run.opts); },
  onQuit() { if (run?.mode === 'endless' && !run.ended) endlessOver(); queueMicrotask(toTitle); },
});

const canvas = document.createElement('canvas');
canvas.className = 'gs-canvas';
canvas.setAttribute('role', 'img');
canvas.setAttribute('aria-label', 'AGI-1’s stock farm: a field of 5 by 5 plots. Drag across it to plant, water and harvest.');
const topCanvas = document.createElement('canvas');
topCanvas.className = 'gs-top';
topCanvas.setAttribute('aria-hidden', 'true');
shell.stage.append(canvas);
const R = createRenderer(canvas, topCanvas);
const { sfx, music } = createSound(shell.audio);
const goldChip = shell.chip('', 0, { accent: true, fmtFn: (v) => `${fmt(Math.floor(v))} gold` });
const clockChip = shell.chip('', 'Mon 6 AM');

// `?qa` (browser tests only): the game's state readable from the page, `&speed=n`, `&auto=steady` for one of the game's
// own farmers, `&season=q2` or `&mode=daily|endless` to start there. Nothing is saved or counted in a `?qa` page.
const QA = QUERY.has('qa');
let qaSpeed = QA ? clamp(Number(QUERY.get('speed')) || 1, 0.25, 16) : 1;
const QA_AUTO = QA && PROFILES[QUERY.get('auto')] ? QUERY.get('auto') : null;

let save = load(shell.store.read());
const persist = () => QA || shell.store.update((d) => Object.assign(d, {
  v: save.v, seasons: save.seasons, daily: save.daily, endless: save.endless, totals: save.totals, bestSale: save.bestSale, stickers: save.stickers, tips: save.tips,
}));

let S = null, bot = null, auto = null, run = null, L = null, fast = false, quality = 1, slow = 0;
let stroke = null, hover = null, keySel = null, confirm = null, cardOpen = false;

const ui = createUI(shell.stage, {
  pick(id) { if (!S || bot) return; select(S, id); ui.select(S.sel); sfx.tap(); },
  sellOne() { if (!playing()) return; const r = sell(S, S.sel, 1); if (!r.n) ui.stopHold(); else run.sale += r.gold; flush(); },
  sellEnd() { if (run && run.sale > 0) { if (run.sale >= 60) { sfx.sold(run.sale); speak(say('bigSale', Math.round(run.sale))); } run.sale = 0; } },
  deliver() { if (playing() && deliver(S)) flush(); },
  buy(what) {
    if (!playing()) return;
    const cost = nextCost(S, what);
    if (cost == null) return;
    if (S.gold < cost) { sfx.bad(); shell.toast(`Need ${fmt(cost)} gold`, 'bad', 1400); return; }
    if (ui.armed() !== what) { ui.arm(what); sfx.tap(); return; }
    ui.arm(null);
    if (buy(S, what)) flush();
  },
  fast() { fast = !fast; ui.setFast(fast); sfx.tap(); },
});
shell.stage.append(topCanvas);

// ---------- layout ----------
function layout() {
  const box = shell.stage.getBoundingClientRect();
  const w = Math.max(1, Math.round(box.width)), h = Math.max(1, Math.round(box.height));
  const dpr = clamp(Math.min(window.devicePixelRatio || 1, 2, 2600 / w) * quality, 0.75, 2);
  for (const cv of [canvas, topCanvas]) if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const bare = !run || run.mode === 'title';
  let fr;
  if (bare) { const top = shell.bar.getBoundingClientRect().bottom - box.top; fr = { x: 0, y: top, w, h: h - top }; }
  else fr = ui.fieldRect();
  const m = DEMO ? 0.15 : 0.5;
  const cell = Math.max(12, Math.floor(Math.min(fr.w / (COLS + m), fr.h / (ROWS + m))));
  L = { w, h, dpr, cell, gx: Math.round(fr.x + (fr.w - cell * COLS) / 2), gy: Math.round(fr.y + (fr.h - cell * ROWS) / 2) };
  R.L = L; R.bgKey = ''; R.topDirty = true;
}
new ResizeObserver(() => layout()).observe(shell.stage);
new ResizeObserver(() => layout()).observe(ui.field);

// ---------- the finger ----------
const playing = () => shell.state === 'play' && S && !S.over && !bot && run && !run.ended;
const world = (x, y) => ({ x: (x - L.gx) / L.cell, y: (y - L.gy) / L.cell });
function endStroke() { stroke = null; }

// One stroke, one kind of work: it plants only if it started on empty soil (so a harvest never spends gold by
// surprise); watering, harvesting and clearing happen in any stroke. Each plot once a stroke.
function touchPlot(i) {
  if (i == null || !stroke || stroke.done.has(i)) return;
  stroke.done.add(i);
  const p = S.plots[i];
  if (!p.open) return;
  if (!stroke.mode) stroke.mode = !p.crop && !p.rot ? 'plant' : 'work';
  act(S, i, { plant: stroke.mode === 'plant' });
}
function strokeTo(px, py) {
  const a = stroke.last, b = world(px, py);
  const d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.ceil(d / 0.2));
  for (let k = 1; k <= n; k++) {
    const x = a.x + (b.x - a.x) * k / n, y = a.y + (b.y - a.y) * k / n;
    if (x >= 0 && y >= 0 && x < COLS && y < ROWS) {
      // only when the finger is well inside a plot (crossing a corner doesn't catch its neighbours)
      const fx0 = x - Math.floor(x), fy0 = y - Math.floor(y);
      if (fx0 > 0.12 && fx0 < 0.88 && fy0 > 0.12 && fy0 < 0.88) touchPlot(Math.floor(y) * COLS + Math.floor(x));
    }
  }
  stroke.last = b;
}
pointer(canvas, {
  down(p) {
    if (!playing() || stroke) return;
    const q = world(p.x, p.y);
    if (bearAt(S, q.x, q.y)) { shoo(S); flush(); return; }
    const i = plotAt(L, p.x, p.y);
    if (i == null) return;
    const pl = S.plots[i];
    if (!pl.open) { tapLocked(i); return; }
    stroke = { id: p.id, done: new Set(), mode: null, last: q };
    touchPlot(i);
    flush();
  },
  move(p) {
    if (!stroke || p.id !== stroke.id || !playing()) return;
    const many = p.event.getCoalescedEvents?.();
    if (many && many.length > 1) { const r = canvas.getBoundingClientRect(); for (const e of many) strokeTo(e.clientX - r.left, e.clientY - r.top); }
    else strokeTo(p.x, p.y);
    flush();
  },
  up(p) { if (stroke && p.id === stroke.id) endStroke(); },
  hover(p) { if (p.type !== 'mouse' || !L) return; keySel = null; hover = plotAt(L, p.x, p.y); },
});
canvas.addEventListener('pointerleave', () => { hover = null; });
// a locked plot: the first tap shows what it costs, the second buys it
function tapLocked(i) {
  const cost = nextCost(S, 'plot');
  if (cost == null) return;
  if (confirm?.i === i && confirm.t > 0) {
    if (S.gold < cost) { sfx.bad(); fx.bad(R, i); shell.toast(`Need ${fmt(cost)} gold for this plot`, 'bad', 1500); confirm = null; return; }
    buy(S, 'plot', i); confirm = null; flush(); return;
  }
  confirm = { i, t: 2.6 };
  sfx.tap();
  if (S.gold < cost) shell.toast(`This plot costs ${fmt(cost)} gold`, null, 1500);
  else shell.toast(`Tap again to buy this plot for ${fmt(cost)} gold`, null, 1700);
}

// ---------- the keys ----------
const keys = keyboard({
  ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down',
  ' ': 'act', Enter: 'act', x: 'sell', b: 'bear', f: 'fast', 1: 'c1', 2: 'c2', 3: 'c3', 4: 'c4', 5: 'c5', q: 'prev', e: 'next',
}, {
  blocked: () => shell.state !== 'play' || Boolean(bot) || Boolean(document.activeElement?.closest?.('.gs-panel button, .ak-bar, .ak-layer')),
  down(name) {
    if (!playing()) return;
    const crops = S.cfg.seasonAt(clockOf(S.h).day).crops;
    if (['left', 'right', 'up', 'down'].includes(name)) {
      if (keySel == null) keySel = hover ?? 12;
      const x = keySel % COLS, y = Math.floor(keySel / COLS);
      const nx = clamp(x + (name === 'left' ? -1 : name === 'right' ? 1 : 0), 0, COLS - 1), ny = clamp(y + (name === 'up' ? -1 : name === 'down' ? 1 : 0), 0, ROWS - 1);
      keySel = ny * COLS + nx; hover = null;
    } else if (name === 'act') {
      if (keySel == null) { keySel = 12; return; }
      const q = plotXY(keySel);
      if (bearAt(S, q.x, q.y)) shoo(S);
      else if (!S.plots[keySel].open) tapLocked(keySel);
      else act(S, keySel);
      flush();
    } else if (name === 'sell') { ui.sell.focus?.({ preventScroll: true }); const r = sell(S, S.sel, 1); if (r.n) { run.sale += r.gold; run.keySell = 0.3; } flush(); }
    else if (name === 'bear') { if (S.bear) { shoo(S); flush(); } }
    else if (name === 'fast') { fast = !fast; ui.setFast(fast); }
    else if (name === 'prev' || name === 'next') { const i = crops.indexOf(S.sel), j = (i + (name === 'next' ? 1 : -1) + crops.length) % crops.length; select(S, crops[j]); ui.select(S.sel); }
    else if (/^c\d$/.test(name)) { const id = crops[Number(name.slice(1)) - 1]; if (id) { select(S, id); ui.select(S.sel); } }
  },
  up(name) { if (name === 'sell' && run) { run.keySell = 0; ui.stopHold(); } },
});

// ---------- the rules' events: what they look and sound like ----------
function speak(text, { force = false, ms = 3400 } = {}) {
  if (!text || !run || bot) return;
  const now = performance.now();
  if (!force && now - run.lastSay < 4200) return;
  run.lastSay = now;
  ui.say(text, ms);
}
function coach(kind) {
  if (!run || bot || run.mode === 'title' || save.tips[kind] || run.coached?.[kind]) return;
  (run.coached ||= {})[kind] = true;
  save.tips[kind] = true; persist();
  ui.tip(TIPS[kind]);
}
function flush() {
  if (!S) return;
  for (const e of drain(S)) handle(e);
}
function handle(e) {
  const quiet = Boolean(bot);
  switch (e.type) {
    case 'open': if (!quiet) speak(say('open', run.mode === 'daily' ? 'daily' : run.mode === 'endless' ? 'endless' : e.season), { force: true, ms: 4200 }); break;
    case 'plant': fx.plant(R, e.i); if (!quiet) sfx.plant(); if (run.hintStep === 0) run.hintStep = 1; break;
    case 'water': fx.water(R, e.i); if (!quiet) sfx.water(); break;
    case 'harvest':
      fx.harvest(R, e.i, e.crop, e.n, ui.chipAt(e.crop), e.bump);
      if (!quiet) { sfx.harvest(e.crop, e.n, e.bump); if (e.bump && Math.random() < 0.25) speak(say('bump')); coach('sell'); }
      if (run.hintStep === 1) run.hintStep = 2;
      break;
    case 'ripe': if (!quiet) { sfx.ripe(); coach('harvest'); } break;
    case 'full': fx.bad(R, e.i); if (!quiet) { sfx.bad(); speak(say('full')); shell.toast('The barn is full: sell something', 'bad', 1500); } break;
    case 'broke': if (e.i != null) fx.bad(R, e.i); if (!quiet) { sfx.bad(); speak(say('broke')); } break;
    case 'clear': fx.flash(R, e.i, '#8a7a3a', 0.3); break;
    case 'sell': {
      const usual = fairOf(S, e.crop);
      if (!quiet) { sfx.coin(e.to / usual); fx.coins(R, ui.sellAt(), goldAt(), 1); fx.word(R, ui.sellAt().x, ui.sellAt().y - 34, `+${fmt(Math.round(e.gold))}`, '#ffc933', 18, 0.8); coach('usual'); }
      if (!quiet && e.to < usual * 0.72 && !run.flooded[e.crop]) { run.flooded[e.crop] = true; speak(say('flooded', e.crop)); }
      break;
    }
    case 'rot': fx.flash(R, e.i, '#8a7a3a', 0.6); if (!quiet) { sfx.rot(); speak(say('rot')); } break;
    case 'buy':
      if (!quiet) {
        sfx.buy();
        if (e.what === 'plot') { fx.sparkle(R, plotCenter(e.i)); speak(Math.random() < 0.5 ? 'more land. more stocks. more gold.' : 'new plot. it smells like opportunity. and dirt.'); }
        else if (e.what === 'sprinkler') shell.toast(`Sprinklers: the field is watered every ${TUNE.sprinkler[S.sprinkler.level]} hours`, 'good', 2400);
        else if (e.what === 'barn') shell.toast(`The barn holds ${barnCap(S)} now`, 'good', 2000);
        else if (e.what === 'compost') shell.toast(`Compost: the next ${TUNE.compost.n} stocks grow faster`, 'good', 2000);
      }
      break;
    case 'sprinkle': if (!quiet) { for (const p of S.plots) if (growing(p)) fx.water(R, p.i); sfx.water(); } break;
    case 'news': if (!quiet && !e.quiet) { sfx.news(); coach('news'); } refreshTicker(); break;
    case 'start': if (e.e.type === 'fair' && !quiet) speak(say('fair', e.e.crop), { force: true }); refreshTicker(); break;
    case 'end': refreshTicker(); break;
    case 'order': if (!quiet) { sfx.order(); speak(say('order', e), { force: true }); coach('order'); } break;
    case 'deliver': if (!quiet) { sfx.deliver(); fx.coins(R, orderAt(), goldAt(), 5); speak(say('deliver', Math.round(e.gold)), { force: true }); } break;
    case 'expire': if (!quiet) speak(say('expire')); break;
    case 'bear': if (!quiet) { sfx.bear(); speak(say('bear'), { force: true }); coach('bear'); shell.haptic([40, 30, 60]); } break;
    case 'shoo': fx.shoo(R, S); if (!quiet) { sfx.shoo(e.n); shell.haptic(20); } break;
    case 'bearleft': if (!quiet) { sfx.bearGone(); speak(say(e.why === 'shooed' ? 'shooed' : 'bearFull'), { force: true }); } break;
    case 'eaten': fx.eaten(R, e.i); if (!quiet) sfx.eaten(); break;
    case 'bull': fx.bull(R, 2.2); if (!quiet) { sfx.bull(); speak(say('bull'), { force: true }); shell.haptic([30, 30, 30]); } break;
    case 'day':
      if (!quiet) {
        sfx.morning();
        const last = run.mode !== 'endless' && clockOf(S.h).week === 7 && Number.isFinite(S.cfg.end);
        speak(last ? say('lastDay') : Math.random() < 0.5 ? say('weather', e.weather) : say('morning'), { force: true, ms: 3800 });
      }
      ui.weather(S.weather, e.tomorrow); refreshTicker();
      break;
    case 'season': ui.setCrops(S.cfg.seasonAt(clockOf(S.h).day).crops, S.sel); if (!quiet) speak(say('open', e.season), { force: true }); layout(); break;
    case 'hour':
      if (!quiet && Number.isFinite(S.cfg.end) && e.h === S.cfg.end - 1) { speak(say('bell'), { force: true }); shell.toast('Closing bell in one hour', null, 2000); }
      if (!quiet) watchMarket();
      refreshTicker();
      break;
    case 'close': if (!quiet) { sfx.bell(); shell.haptic([30, 40, 30]); } break;
    default: break;
  }
}
// once an hour: a stock that's jumped or fallen a long way, if there's some in the barn
function watchMarket() {
  for (const id in S.market) {
    const n = have(S, id); if (!n) continue;
    const k = S.market[id].r / fairOf(S, id);
    const t = run.watched[id] || -99;
    if (S.h - t < 10) continue;
    if (k > 1.3) { run.watched[id] = S.h; speak(say('spike', id)); return; }
    if (k < 0.72 && !run.flooded[id]) { run.watched[id] = S.h; speak(say('crash', id)); return; }
  }
}
const goldAt = () => { const r = goldChip.node?.getBoundingClientRect?.(), s = shell.stage.getBoundingClientRect(); return r ? { x: r.left - s.left + r.width / 2, y: Math.max(8, r.top - s.top + r.height / 2) } : { x: L.w / 2, y: 20 }; };
const orderAt = () => { const r = ui.panel.querySelector('.gs-order')?.getBoundingClientRect(), s = shell.stage.getBoundingClientRect(); return r ? { x: r.left - s.left + r.width - 50, y: r.top - s.top + r.height / 2 } : ui.sellAt(); };
const plotCenter = (i) => { const q = plotXY(i); return { x: L.gx + q.x * L.cell, y: L.gy + q.y * L.cell }; };

// the ticker: the news that's on or coming, the order, the weather
function refreshTicker() {
  if (!S || !run || run.mode === 'title') return;
  const items = [];
  for (const n of S.news) {
    if (n.end < S.h && !(n.type === 'rumor')) continue;
    if (n.type === 'rumor' && S.h > n.end + 10) continue;
    items.push({ tag: n.type === 'fair' ? 'FAIR' : n.type === 'glut' ? 'GLUT' : n.type === 'rumor' ? 'RUMOUR' : 'NEWS', tone: n.type === 'glut' ? 'down' : n.type === 'rumor' ? 'rumor' : 'up', text: headline(n, S.h).replace(/^Rumour: /, '') });
  }
  if (S.bear) items.unshift({ tag: 'BEAR', tone: 'down', text: 'A bear is on the farm. Tap it three times!' });
  if (!items.length) items.push({ tag: 'MARKET', tone: 'news', text: 'Quiet day on the market. Plant, water, sell above the usual line.' });
  ui.ticker(items.slice(0, 5));
}

// ---------- a run ----------
const seedNow = () => (QA && Number(QUERY.get('seed'))) || ((Math.random() * 2 ** 31) >>> 0) || 1;
function begin(opts, seed, asBot) {
  const cfg = makeConfig(opts);
  S = createSim(cfg, seed);
  bot = asBot ? createBot('demo', seed + 11) : null;
  auto = !asBot && QA_AUTO ? createBot(QA_AUTO, seed + 5) : null;
  // the farm behind the title and in the preview has been going since Monday: Tuesday late morning, stocks ripe
  if (asBot) { const n = Math.round(29 * HOUR / STEP); for (let k = 0; k < n && !S.over; k++) { drive(bot, S, STEP); step(S, STEP); } drain(S); }
  run = { opts, mode: opts.mode, season: cfg.season.id, key: opts.key || null, ended: false, endT: 0, lastSay: -1e9, sale: 0, keySell: 0, flooded: {}, watched: {}, hintStep: save.tips.plant ? 3 : 0, startDay: 1 };
  stroke = null; confirm = null; keySel = null;
  R.flies.length = 0; R.parts.clear(); R.floats.clear(); R.bull = null; R.flash.clear();
  ui.setCrops(cfg.seasonAt(1).crops, S.sel);
  ui.show(!asBot || DEMO);
  ui.root.dataset.demo = DEMO ? 'true' : 'false';
  ui.order(null);
  ui.weather(S.weather, dayPlan(S, 2).weather);
  ui.hush(); ui.tip(null);
  fast = false; ui.setFast(false);
  layout();
  flush();
  refreshTicker();
}
function startRun(opts) {
  shell.closeCard?.(); cardOpen = false;
  const seed = opts.mode === 'daily' ? dailySeed(opts.key) : seedNow();
  begin(opts, seed, false);
  shell.started({ count: !QA });
  music.start();
  if (!save.tips.plant) { ui.tip(TIPS.plant, 7000); save.tips.plant = true; persist(); }
}
function endRun() {
  run.ended = true; run.endT = 0;
  stroke = null; ui.stopHold();
  if (!bot) music.stop();
}

function showOver() {
  const s = run.mode === 'season' ? seasonOf(run.season) : run.mode === 'daily' ? dailySeason(run.key) : null;
  const gold = Math.round(S.gold), days = clockOf(S.h).day;
  const res = applyRun(save, { mode: run.mode, season: run.season, key: run.key, gold, days, stats: S.stats, open: S.plots.filter((p) => p.open).length });
  save = res.save; persist();
  if (res.newStickers.length) sfx.sticker();
  const st = S.stats;
  const facts = { mode: run.mode, stars: res.stars, gold: fmt(gold), q: s?.q, season: s?.name, days };
  const best = run.mode === 'season' ? save.seasons[run.season]?.best : run.mode === 'daily' ? save.daily.best : save.endless.best;
  const next = run.mode === 'season' && res.stars > 0 ? SEASONS[SEASONS.findIndex((x) => x.id === run.season) + 1] : null;
  const again = next && seasonOpen(save, next.id) ? { label: `${next.name} →`, go: () => startRun({ mode: 'season', season: next.id }) } : { label: 'Play again', go: () => startRun(run.opts) };
  shell.over({
    title: run.mode === 'endless' ? 'Farm closed' : 'Closing bell',
    score: gold, label: run.mode === 'season' ? `gold · ${s.q} ${s.name}` : run.mode === 'daily' ? `gold · today’s Daily (${s.name})` : `gold · ${days} days`,
    best: best || null, isBest: res.isBest,
    stats: [
      ['Harvested', fmt(st.harvested)],
      ['Sold', `${fmt(st.sold)}${st.closing ? ` (bell ${fmt(Math.round(st.closing))})` : ''}`],
      ['Best sale', st.bestSale ? `${CROPS[st.bestSale.crop].tick} ×${st.bestSale.ratio.toFixed(1)}` : '—'],
      ['Orders', fmt(st.orders)],
    ],
    line: endLine(facts), share: shareText(facts),
    extra: overExtra({ stars: run.mode === 'season' ? res.stars : null, newStickers: res.newStickers, season: run.mode === 'season' ? s : null }),
    again: again.label, onAgain: again.go, onMenu: toTitle,
  });
}
// Endless ends when the player leaves it: the bell rings, what it earned is kept
function endlessOver() {
  closingBell(S); flush();
  run.ended = true;
  const res = applyRun(save, { mode: 'endless', gold: Math.round(S.gold), days: clockOf(S.h).day, stats: S.stats, open: S.plots.filter((p) => p.open).length });
  save = res.save; persist();
  for (const s of res.newStickers) setTimeout(() => shell.toast(`New sticker: ${s.name}`, 'good', 2600), 400);
}

// ---------- the title: the farm runs itself behind it ----------
function openCard(make) {
  const close = () => { shell.closeCard(); cardOpen = false; toTitle(); };
  cardOpen = true;
  shell.card(make(close), { label: 'GROWTH STOCK' });
}
addEventListener('keydown', (e) => { if (e.key === 'Escape' && cardOpen && shell.state === 'title') { e.preventDefault(); shell.closeCard(); cardOpen = false; toTitle(); } });

function toTitle() {
  music.stop();
  if (run?.mode !== 'title') begin({ mode: 'title' }, seedNow(), true);
  const nxt = seasonOf(nextSeason(save)), first = !save.seasons.q1;
  const today = dateKey(new Date()), ds = dailySeason(today);
  shell.title({
    logo: ['GROWTH', { text: 'STOCK', tone: 'accent' }],
    tagline: 'AGI-1’s farm, where the crops are stocks. Grow them, sell the spike, shoo the bear.',
    play: first ? 'Play' : `${nxt.q} ${nxt.name}`,
    onPlay: () => startRun({ mode: 'season', season: nxt.id }),
    modes: [
      { label: 'Seasons', sub: `★ ${totalStars(save)}/${MAX_STARS}`, onClick: () => openCard((close) => seasonsCard({ save, onClose: close, onPick: (id) => { shell.closeCard(); cardOpen = false; startRun({ mode: 'season', season: id }); } })) },
      { label: 'Daily', sub: save.daily.key === today && save.daily.best ? `today ${fmt(save.daily.best)}` : `${ds.name} market`, onClick: () => startRun({ mode: 'daily', key: today }) },
      { label: 'Endless', sub: save.endless.best ? `best ${fmt(save.endless.best)}` : 'no closing bell', locked: !endlessOpen(save), lockedText: 'Get a star in Spring first', onClick: () => startRun({ mode: 'endless' }) },
    ],
    extra: titleExtra({ onRecords: () => openCard((close) => recordsCard({ save, onClose: close })) }),
    best: null,
    fine: 'Real company names, made-up rates and news · play gold only · no wallet needed · your scores stay on this device',
  });
  layout();
}

// ---------- the loop ----------
function tick(dt) {
  if (!S || !L) return;
  if (bot && !S.over) drive(bot, S, dt);
  else if (auto && !S.over && playing()) drive(auto, S, dt);
  if (run.keySell > 0 && playing()) { run.keySell -= dt; if (run.keySell <= 0 && keys.held('sell')) { const r = sell(S, S.sel, 1); if (r.n) run.sale += r.gold; run.keySell = 0.09; } }
  if (!S.over) step(S, dt);
  if (confirm) { confirm.t -= dt; if (confirm.t <= 0) confirm = null; }
  flush();
  updateFx(R, dt);
  if (S.over && !run.ended) endRun();
  if (run.ended) {
    run.endT += dt;
    if (bot) { if (run.endT > 1) begin(run.opts, S.seed + 1, true); return; }
    if (shell.state === 'play' && run.endT > 2.4 && run.mode !== 'endless') showOver();
  }
}

function frame(alpha, dt) {
  if (!S || !L) return;
  const cl = clockOf(S.h);
  const cost = nextCost(S, 'plot');
  const signs = new Set();
  if (cost != null && !bot) for (const p of S.plots) if (!p.open && S.plots.some((q) => q.open && Math.abs((q.i % COLS) - (p.i % COLS)) + Math.abs(Math.floor(q.i / COLS) - Math.floor(p.i / COLS)) === 1)) signs.add(p.i);
  const hint = bot || !run || run.mode === 'title' ? null : run.hintStep === 0 ? 12 : run.hintStep === 1 ? (S.plots.find((p) => ripe(p))?.i ?? null) : null;
  draw(R, S, {
    hover: playing() ? hover : null, keySel: playing() ? keySel : null, hint,
    cursor: bot && DEMO ? { ...bot.cur, tap: Boolean(bot.last) } : null,
    signs: S.gold >= (cost ?? Infinity) * 0.85 ? signs : null, plotCost: cost, confirm: confirm ? { i: confirm.i } : null,
    dim: run?.mode === 'title' ? 0.35 : 0,
  });
  drawTop(R);
  if (run.mode !== 'title') {
    goldChip.set(Math.floor(S.gold));
    clockChip.set(Number.isFinite(S.cfg.end) && S.h >= S.cfg.end - 0.01 ? 'Closed' : clockLabel(S.h));
    const day = cl.day;
    const view = {
      market: S.market, gold: S.gold, barn: barnCount(S), cap: barnCap(S), sprinkler: S.sprinkler.level, compost: S.compost,
      change: (id) => changeOf(S, id), have: (id) => have(S, id), usual: (id) => fairOf(S, id),
      cost: (what) => nextCost(S, what), sparkTick: Math.floor(S.tickH * 2),
      speedOf: (id) => { const w = WEATHER[S.weather]; return w.frost && CROPS[id].frost ? 1.3 : w.grow; },
      dayLabel: (d) => (d >= 1 ? DAYS[(d - 1) % 7] : ''),
      marks: (id) => S.news.filter((n) => n.crop === id && n.end >= S.h - 30).map((n) => ({ day: clockOf(n.start).day, text: effectOf(n).text.split(' ')[0], color: effectOf(n).color })),
      newsFor: (id) => {
        const n = S.news.find((x) => x.crop === id && x.end >= S.h);
        if (!n) return null;
        const ef = effectOf(n);
        return { up: ef.up, text: n.id, line: `${n.type === 'glut' ? '▼' : '▲'} ${headline(n, S.h)}` };
      },
    };
    ui.update(view, dt, R.time);
    if (S.order) {
      const o = S.order, left = Math.max(0, Math.ceil(o.until - S.h));
      ui.order(o, orderText(o), `${fmt(o.pay)} gold each · ${left}h left · you have ${have(S, o.crop)}`, have(S, o.crop) >= o.n);
    } else ui.order(null);
    if (!bot && !run.ended) music.mood(S.bear ? 2 : R.bull || allBull() ? 3 : cl.night ? 1 : 0);
    // a slow machine: fewer pixels (the picture softens, the game keeps its pace)
    if (dt > 0.03) { if (++slow > 90 && quality > 0.55) { quality = Math.max(0.5, quality - 0.25); slow = 0; layout(); } } else if (slow > 0) slow--;
    if (!bot && run.hintStep < 3 && S.plots.some((p) => thirsty(p))) coach('water');
    if (!bot && S.gold >= (cost ?? Infinity) && cl.day >= 1 && S.h > 14) coach('plot');
  }
  day0(cl.day);
}
const allBull = () => S && Object.values(S.days).some((p) => p.events.some((e) => e.type === 'bull' && e.on));
let lastDay = 0;
function day0(d) { if (d !== lastDay) { lastDay = d; } }

const loop = createLoop({ step: STEP, update: tick, render: frame, paused: () => shell.state === 'pause' || (shell.state === 'over' && !bot), speed: () => qaSpeed * (fast && playing() ? 2 : 1) });
if (QA) window.__gs = { get S() { return S; }, get L() { return L; }, get run() { return run; }, get save() { return save; }, speed(n) { qaSpeed = clamp(Number(n) || 1, 0.25, 16); } };

layout();
if (DEMO) { begin({ mode: 'demo' }, SEED || 7, true); shell.started({ count: false }); layout(); }
else if (QA && (QUERY.get('season') || QUERY.get('mode'))) startRun(QUERY.get('mode') ? { mode: QUERY.get('mode'), key: dateKey() } : { mode: 'season', season: QUERY.get('season') });
else toTitle();
loop.start();
