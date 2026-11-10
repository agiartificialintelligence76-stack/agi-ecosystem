// BUBBLE SORT on agi1.app (2026-11-09): Match three. Drop the rest. Sort it all out.
// A bubble shooter in AGI-1's memory on the arcade kit: aim (the guide is the true path, walls and all), match three,
// drop whatever hung from them, and earn the SORT bubble, which bubble-sorts two rows by colour in front of you. Levels
// (30 "memory banks" levels in 3 banks) and Endless ("infinite context"). The rules are ./rules.js (no DOM), the board's
// geometry ./grid.js, the path ./path.js, its player ./ai.js, the levels ./levels.js; the scene ./view.js and ./render.js;
// the cards ./ui.js. This file wires the kit's frame, the input, the loop, the title's live board and `?demo`.
import './style.css';
import { createShell, el } from '../kit/shell.js';
import { fitCanvas } from '../kit/canvas.js';
import { createLoop } from '../kit/loop.js';
import { pointer, keyboard } from '../kit/input.js';
import { DEMO, SEED, TOUCH, REDUCED, QUERY } from '../kit/env.js';
import { clamp, fmt, rng } from '../kit/fx.js';
import { shareUrl } from '../kit/share.js';
import { LAUNCHER, DEADLINE_Y, LIMIT, MEMORY } from './grid.js';
import { clampAngle, MIN_ANGLE, MAX_ANGLE } from './path.js';
import { Game, starsFor, ENDLESS } from './rules.js';
import { LEVELS, levelAt, PER_BANK } from './levels.js';
import { chooseShot } from './ai.js';
import { Scene, computeLayout, drawPanel, NEXT_AT } from './view.js';
import { draw } from './render.js';
import { makeSprites } from './art.js';
import { createSfx, createMusic } from './sound.js';
import { line, endLine, shareText } from './lines.js';
import { createSay, levelsCard, clearCard, failCard, svg } from './ui.js';
import { demoGame, DEMO_TIMES, attractGame } from './demo.js';

const FACE = '/images/landing/agi1-face.webp';
const BUST = '/images/agi1-live-2d.webp';
const TAGLINE = 'Match three. Drop the rest. Sort it all out.';
const root = document.getElementById('ak-root');
const shell = createShell({
  game: 'bubblesort', name: 'BUBBLE SORT', root,
  howTo: {
    intro: 'Pop three or more of a colour, and everything that was hanging from them falls. A dropped bubble scores double the one before it.',
    steps: [
      ['Aim, then let go', 'The dotted guide is the real path, bounces and all, and the ghost shows where it sticks.'],
      ['Match three, drop the rest', 'Three of a colour pop. Whatever they held up falls: the bigger the drop, the bigger the score.'],
      ['Mind the misses', 'A shot that pops nothing lights a pip. When they\'re all lit, the whole stack comes down a row. Past the dashed line, it\'s over.'],
      ['Three pops in a row', 'The meter fills and you get a special: SORT lines two rows up by colour, WILD joins the biggest group, BOMB clears around it.'],
    ],
    touch: [['Drag', 'Aim'], ['Release', 'Shoot'], ['Drag below the launcher', 'Cancel'], ['Tap the next bubble', 'Swap']],
    keys: [['← →', 'Aim (hold to speed up)'], ['Shift', 'Fine aim'], ['Space', 'Shoot'], ['X', 'Swap'], ['Mouse', 'Aim, click to shoot']],
  },
  onPause: () => { ptr = null; },
  onResume: () => { if (openCard) reshowCard(); },
  onRestart: () => restart(),
  onQuit: () => toTitle(),
});

const canvas = el('canvas', { role: 'img', 'aria-label': 'BUBBLE SORT: the board' });
const safe = el('div', { class: 'bs-safe', 'aria-hidden': 'true' });
const live = el('p', { class: 'ak-sr', 'aria-live': 'polite' });
shell.stage.append(canvas, safe, live);
const say = createSay(shell.stage);
const sfx = createSfx(shell.audio);
const music = createMusic();
const chipScore = shell.chip('Score', 0);
const chipShots = shell.chip('Shots', 0, { accent: true });
const chipRows = shell.chip('Rows', 0);
const announce = (t) => { live.textContent = t; };
const dice = rng(SEED || ((Math.random() * 2 ** 31) >>> 0) || 1);
const roll = () => dice.next();

const imgFace = new Image(); imgFace.src = FACE;
const imgBust = new Image(); imgBust.src = BUST;
const loaded = (img) => img.complete && img.naturalWidth > 0;

// ---------- state ----------
let mode = 'boot';            // title · level · endless · demo
let game = null, def = null;
let L = null, panel = null, sheet = null;
let aim = Math.PI / 2;
let ptr = null;               // a finger or the mouse aiming: { id, swap, cancel, x0, y0 }
let openCard = null;          // { kind, make, label, keys }
let levelIntro = null;
let faceHop = 0, nervousSaid = 0, wasDanger = false;
let ending = null;            // a run's end, waiting for its animations: { at, kind }
let startedAt = 0;
let queued = null;            // a shot let go while the last one was still popping
let auto = null;              // the title's or the demo's own player: { game, nextAt, plan, aimFrom, aimT }
let now = 0;
let swaps = 0;

const scene = new Scene({
  sfx: (name, ...a) => { if (mode === 'level' || mode === 'endless') sfx[name]?.(...a); },
  haptic: (p) => { if (mode === 'level' || mode === 'endless') shell.haptic(p); },
  event: (name, data) => onEvent(name, data),
});

// ---------- the layout: clear of the kit's bar and the notch ----------
function insets() {
  if (DEMO) return { top: 4, right: 4, bottom: 4, left: 4 };
  const cs = getComputedStyle(safe);
  const px = (v) => parseFloat(v) || 0;
  const bar = shell.bar.getBoundingClientRect(), st = canvas.getBoundingClientRect();
  return { top: Math.max(bar.bottom - st.top, px(cs.paddingTop)) + 6, right: px(cs.paddingRight) + 8, bottom: px(cs.paddingBottom) + 8, left: px(cs.paddingLeft) + 8 };
}
let view = null;
function relayout() {
  if (!view) return;
  L = computeLayout(view.w, view.h, insets(), { demo: DEMO });
  scene.L = L;
  panel = drawPanel(L, view.dpr);
  sheet = makeSprites(L.s, view.dpr);
  say.place(L);
}
view = fitCanvas(canvas, { maxDpr: 2, onResize: () => relayout() });

// ---------- saves ----------
const store = shell.store;
function progress() {
  const d = store.read(), lv = d.levels || {};
  const stars = (n) => lv[n]?.stars || 0;
  const unlocked = (n) => n === 1 || stars(n - 1) > 0;
  const total = LEVELS.reduce((s, l) => s + stars(l.n), 0);
  const cleared = LEVELS.filter((l) => stars(l.n) > 0).length;
  const firstOpen = LEVELS.find((l) => unlocked(l.n) && !stars(l.n));
  const next = firstOpen ? firstOpen.n : Math.min(LEVELS.length, d.last || LEVELS.length);
  return { stars, unlocked, total, cleared, next, best: (n) => lv[n]?.score || 0 };
}

// ---------- runs ----------
const playing = () => (mode === 'level' || mode === 'endless') && shell.state === 'play' && !openCard && game && game.status === 'play' && !ending;
function beginRun() {
  closeCard();
  say.hide();
  ending = null; queued = null; ptr = null;
  aim = Math.PI / 2;
  scene.load(game, { intro: !REDUCED });
  shell.started();
  startedAt = performance.now();
  shell.audio.music(music);
  chips(true);
}
function startLevel(n) {
  def = levelAt(n);
  if (!def) return;
  game = new Game({ mode: 'level', def, seed: SEED || ((dice.next() * 2 ** 31) >>> 0) || 1 });
  mode = 'level';
  beginRun();
  store.update((d) => { d.last = n; });
  const goal = def.goal === 'memories' ? 'free 3 memories' : 'clear the board';
  levelIntro = { t: 0, dur: 1.9, kicker: `MEMORY BANK ${def.bank} · LEVEL ${n}`, title: def.name.toUpperCase(), sub: `${goal} · ${def.shots} shots` };
  announce(`Level ${n}: ${def.name}. Goal: ${goal}. ${def.shots} shots.`);
  const seen = store.read().tips || {};
  setTimeout(() => {
    if (mode !== 'level' || game?.def !== def) return;
    if (def.tip && !seen[n]) { say.show(def.tip, 4200, { force: true }); store.update((d) => { d.tips = { ...(d.tips || {}), [n]: 1 }; }); }
    else if (roll() < 0.4) say.show(line('start', roll()), 2400);
  }, 900);
}
function startEndless() {
  def = null;
  game = new Game({ mode: 'endless', seed: SEED || ((dice.next() * 2 ** 31) >>> 0) || 1 });
  mode = 'endless';
  beginRun();
  levelIntro = { t: 0, dur: 1.6, kicker: 'ENDLESS', title: 'INFINITE CONTEXT', sub: 'rows keep coming · how long can you last?' };
  announce('Endless. Rows keep coming in from the top.');
  setTimeout(() => { if (mode === 'endless') say.show(line('start', roll()), 2400); }, 900);
}
function restart() {
  if (mode === 'endless') startEndless();
  else if (def) startLevel(def.n);
}

// ---------- the chips in the bar ----------
function chips(force = false) {
  const isLevel = mode === 'level';
  chipShots.hide(!isLevel);
  chipRows.hide(mode !== 'endless');
  if (!game) return;
  chipScore.set(game.score, { pop: force ? false : chipScore.value !== game.score });
  if (isLevel) {
    chipShots.set(game.shotsLeft, { pop: chipShots.value !== game.shotsLeft && !force });
    chipShots.node.classList.toggle('is-accent', game.shotsLeft <= 5);
  } else chipRows.set(game.rows, { pop: chipRows.value !== game.rows && !force });
}

// ---------- aiming and firing ----------
function toUnits(x, y) { return { x: (x - L.x0) / L.s, y: (y - L.y0) / L.s }; }
// the direction from the launcher to a point; under the launcher's line: no aim (a cancel)
function angleTo(u) {
  const dx = u.x - LAUNCHER.x, dy = LAUNCHER.y - u.y;
  if (dy < 0.35) return null;
  return clampAngle(Math.atan2(dy, dx));
}
function fire() {
  if (!playing()) return;
  if (!scene.ready) { queued = { angle: aim, until: now + 0.45 }; return; }
  if (performance.now() - startedAt < 180) return;
  if (levelIntro && levelIntro.t < levelIntro.dur - 0.35) levelIntro.t = levelIntro.dur - 0.35;
  const res = game.fire(aim);
  if (!res) return;
  scene.playShot(res);
  if (res.status !== 'play') ending = { kind: res.status, reason: res.reason, res };
  chips();
  // her lines, now and then
  if (res.drops.length >= 15) faceHop = 1;
}
function swap() {
  if (!playing() || !scene.ready) return;
  if (game.swap()) {
    scene.shown = game.queue.slice();
    scene.reload = 0; scene.swapT = 0;
    sfx.swapQueue();
    shell.haptic(8);
    swaps++;
  } else sfx.error();
}

// ---------- AGI-1 speaks (now and then: never a chatterbox) ----------
function onEvent(name, data) {
  if (mode !== 'level' && mode !== 'endless') return;
  const r = roll();
  if (name === 'bank' && r < 0.3) say.show(line('bank', roll()));
  else if (name === 'sort') { faceHop = 1; if (r < 0.65) say.show(line('sort', roll())); }
  else if (name === 'bomb') { if (r < 0.5) say.show(line('bomb', roll())); }
  else if (name === 'drop') { if (data.drops.length >= 8) { faceHop = 1; if (r < 0.55) say.show(line('drop', roll()), 2600, { force: data.drops.length >= 15 }); } }
  else if (name === 'memory') { faceHop = 1; say.show(line('memory', roll()), 2600, { force: true }); }
  else if (name === 'special') { if (r < 0.45) say.show(line('special', roll())); }
  else if (name === 'push') { if (data.by !== 'refill' && r < 0.45) say.show(line('push', roll())); }
  else if (name === 'shot') {
    if (data.wild && r < 0.4) say.show(line('wild', roll()));
    if (data.allClear && mode === 'endless') { faceHop = 1; scene.banner_('ALL CLEAR!', { sub: '+2,500', tone: '#3ff0c3', dur: 1.5 }); say.show(line('allClear', roll()), 2600, { force: true }); }
  }
}

// ---------- the end of a level, the end of a run ----------
function finishLevel() {
  const won = game.status === 'won';
  const res = ending.res;
  if (won) {
    // a cleared bank's whole remaining stack falls (a memory level can end with bubbles still up)
    if (scene.mirror.count() > 0) {
      const drops = [];
      scene.mirror.each((x, r, c) => drops.push({ id: x.id, r, c, k: x.k }));
      scene.dropAll({ drops, points: 0, pops: [], mult: 1, freed: 0 }, true);
    }
    sfx.clear();
    shell.haptic([20, 40, 20, 40]);
    scene.banner_(def.goal === 'memories' ? 'ALL FREE!' : 'CLEAR!', { sub: `+${fmt(res.bonus.total)} bonus`, tone: '#3ff0c3', dur: 1.6, big: 1.1 });
    scene.burstRainbow(11, 12, 40);
    faceHop = 1;
    const stars = game.stars();
    const prev = store.read().levels?.[def.n] || null;
    const isBest = !prev || game.score > (prev.score || 0);
    const before = progress();
    store.update((d) => {
      d.levels = d.levels || {};
      const o = d.levels[def.n] || {};
      d.levels[def.n] = { stars: Math.max(o.stars || 0, stars), score: Math.max(o.score || 0, game.score) };
      d.drop = Math.max(Number(d.drop) || 0, game.stats.biggestDrop);
    });
    const bankLevels = LEVELS.filter((l) => l.bank === def.bank);
    const after = progress();
    const bankDone = bankLevels.every((l) => after.stars(l.n) > 0) && !bankLevels.every((l) => before.stars(l.n) > 0);
    const allDone = LEVELS.every((l) => after.stars(l.n) > 0) && before.cleared < LEVELS.length;
    announce(`Level ${def.n} cleared with ${stars} of 3 stars.`);
    const ln = allDone ? line('allDone', roll()) : bankDone ? line('bankDone', roll()) : stars === 3 ? line('perfect', roll()) : line('clear', roll());
    const info = { stars, isBest: isBest && prev != null, bankDone, line: ln };
    setTimeout(() => { if (mode === 'level' && game && game.status === 'won') showClear(info); }, REDUCED ? 500 : 1500);
  } else {
    sfx.fail();
    shell.haptic([40, 60, 40]);
    scene.banner_(game.reason === 'overflow' ? 'OVERFLOW!' : 'OUT OF SHOTS', { tone: '#ff5a5f', dur: 1.4 });
    announce(game.reason === 'overflow' ? 'The stack crossed the deadline.' : 'Out of shots.');
    setTimeout(() => { if (mode === 'level' && game && game.status === 'lost') showFail(); }, REDUCED ? 450 : 1300);
  }
}
function finishEndless() {
  sfx.fail();
  shell.haptic([40, 60, 40]);
  scene.banner_('OVERFLOW!', { tone: '#ff5a5f', dur: 1.3 });
  shell.audio.stopMusic();
  const g = game;
  setTimeout(() => {
    if (mode !== 'endless' || game !== g) return;
    const prev = store.best('best');
    const isBest = g.score > 0 && (prev == null || g.score > prev);
    store.update((d) => { d.drop = Math.max(Number(d.drop) || 0, g.stats.biggestDrop); });
    shell.over({
      title: 'Memory overflow', score: g.score, label: 'points',
      stats: [['Score', fmt(g.score)], ['Biggest drop', `${g.stats.biggestDrop}`], ['Best combo', `×${g.stats.bestCombo}`], ['Rows survived', `${g.rows}`]],
      line: endLine(g.score, isBest, roll()),
      share: shareText({ drop: g.stats.biggestDrop, score: g.score }),
      onAgain: () => startEndless(), onMenu: () => toTitle(),
    });
  }, REDUCED ? 400 : 1300);
}
function showClear(info) {
  const next = levelAt(def.n + 1);
  const share = shareUrl({ text: shareText({ drop: game.stats.biggestDrop, level: def.n }), path: '/games/bubblesort' });
  const g = game, d0 = def;
  const make = () => clearCard({
    def: d0, stars: info.stars, score: g.score, shotsLeft: g.shotsLeft, drop: g.stats.biggestDrop, best: info.isBest, line: info.line, face: FACE,
    next, share, bankDone: info.bankDone,
    onNext: () => (next ? startLevel(next.n) : openLevels()),
    onRetry: () => startLevel(d0.n),
    onLevels: () => openLevels(),
  });
  showCard('clear', make, `Level ${d0.n} cleared`);
  openCard.keys = { primary: () => (next ? startLevel(next.n) : openLevels()), retry: () => startLevel(d0.n), back: () => openLevels() };
  if (!REDUCED) for (let i = 0; i < info.stars; i++) setTimeout(() => { if (openCard?.kind === 'clear') sfx.star(i); }, 220 + i * 240);
}
function showFail() {
  const g = game, d0 = def;
  const left = g.reason === 'overflow' ? 'The stack crossed the dashed line.' : d0.goal === 'memories' ? `${g.freed} of ${g.memTotal} memories freed.` : `${g.board.count()} bubble${g.board.count() === 1 ? '' : 's'} left.`;
  const make = () => failCard({
    def: d0, reason: g.reason, left, line: line(g.reason === 'overflow' ? 'overflow' : 'shots', roll()), face: FACE,
    onRetry: () => startLevel(d0.n), onLevels: () => openLevels(), onMenu: () => toTitle(),
  });
  showCard('fail', make, g.reason === 'overflow' ? 'Memory overflow' : 'Out of shots');
  openCard.keys = { primary: () => startLevel(d0.n), retry: () => startLevel(d0.n), back: () => openLevels() };
}

// ---------- cards over the game (the kit's layer) ----------
function showCard(kind, make, label) {
  const node = make();
  openCard = { kind, make, label, keys: {} };
  shell.card(node.card || node, { label });
  shell.pausable(false);
  if (node.card && node.focus) requestAnimationFrame(() => node.focus.focus({ preventScroll: true }));
}
function reshowCard() {
  if (!openCard) return;
  const keys = openCard.keys;
  const node = openCard.make();
  shell.card(node.card || node, { label: openCard.label });
  openCard.keys = keys;
  shell.pausable(false);
}
function closeCard() {
  if (!openCard) return;
  openCard = null;
  shell.closeCard();
  if (mode === 'level' || mode === 'endless') shell.pausable(true);
}
function openLevels() {
  sfx.select();
  const make = () => levelsCard({
    progress: progress(),
    onPick: (n, ok) => {
      if (!ok) { sfx.error(); shell.toast('Clear the one before it first', 'warn', 1400); return; }
      sfx.select();
      startLevel(n);
    },
    onClose: () => closeLevels(),
  });
  showCard('levels', make, 'Memory banks');
  openCard.keys = { primary: () => startLevel(progress().next), back: () => closeLevels() };
}
function closeLevels() {
  closeCard();
  // from a finished level (or the title): back to the title
  if (!game || game.status !== 'play' || mode === 'title') toTitle();
}

// ---------- the title: a board playing itself behind the logo ----------
function toTitle() {
  closeCard();
  shell.audio.stopMusic();
  say.hide();
  mode = 'title';
  ending = null; queued = null; ptr = null; levelIntro = null;
  game = attractGame(Math.floor(Math.random() * 1e6) + 1);
  scene.load(game);
  scene.calm = true;
  auto = { k: 0, nextAt: now + 1.2, plan: null, gap: 1.35 };
  const pr = progress();
  const best = store.best('best');
  const drop = Number(store.read().drop) || 0;
  const bits = [];
  if (pr.total) bits.push(`${pr.total}/90 stars`);
  if (drop >= 5) bits.push(`biggest drop ${drop}`);
  shell.title({
    logo: ['BUBBLE', { text: 'SORT', tone: 'pink' }],
    tagline: TAGLINE,
    play: pr.cleared ? `Level ${pr.next}` : 'Play',
    onPlay: () => { sfx.select(); startLevel(pr.next); },
    modes: [
      { label: 'Levels', sub: `${pr.cleared} of ${LEVELS.length} cleared`, onClick: () => openLevels() },
      { label: 'Endless', sub: best ? `Best ${fmt(best)}` : 'Infinite context', onClick: () => { sfx.select(); startEndless(); } },
    ],
    best: null,
    extra: bits.length ? el('p', 'bs-record', svg('star', 'bs-ico bs-star is-on'), bits.join(' · ')) : null,
  });
  chips(true);
}

// ---------- the demo (?demo): a game in the middle, its own player, forever ----------
function startDemo(k = 0) {
  mode = 'demo';
  game = demoGame(k, SEED || 7);
  scene.load(game, { intro: k > 0 });
  auto = { k, nextAt: now + (k === 0 ? 0 : 1.1), plan: null, gap: 0.6, times: k === 0 ? DEMO_TIMES.slice() : [] };
}

// the title's and the demo's player: picks a shot, swings the barrel there (0.35 s), fires. The demo's first shots wait
// for their times (DEMO_TIMES, on the page's clock: the recorder's clock), and never swap
function autoplay(dt) {
  const A = auto, g = game;
  if (!A || !g) return;
  if (g.status !== 'play') {
    if (scene.ready && A.endAt == null) A.endAt = now + 1.1;
    if (A.endAt != null && now >= A.endAt) { if (mode === 'demo') startDemo(A.k + 1); else toTitleBoard(); }
    return;
  }
  const clock = performance.now() / 1000;
  const scripted = Boolean(A.times && A.times.length);
  if (!A.plan) {
    if (!scene.ready) return;
    if (scripted ? clock < A.times[0] - 0.4 : now < A.nextAt) return;
    const pick = chooseShot(g, { swap: !scripted });
    if (!pick) return;
    if (pick.swap) { g.swap(); scene.shown = g.queue.slice(); scene.reload = 0; scene.swapT = 0; }
    A.plan = { angle: pick.angle, from: aim, t: 0 };
  }
  const P = A.plan;
  P.t += dt;
  const k = clamp(P.t / 0.35, 0, 1), e = k * k * (3 - 2 * k);
  aim = P.from + (P.angle - P.from) * e;
  if (k >= 1 && (!scripted || clock >= A.times[0])) {
    if (scripted) A.times.shift();
    const res = g.fire(P.angle);
    A.plan = null;
    A.nextAt = now + A.gap;
    if (res) scene.playShot(res, { quiet: true });
  }
}
function toTitleBoard() {
  game = attractGame(Math.floor(Math.random() * 1e6) + 1);
  scene.load(game, { intro: true });
  scene.calm = true;
  auto = { k: 0, nextAt: now + 1, plan: null, gap: 1.35 };
}

// ---------- touch and mouse ----------
pointer(canvas, {
  down(p) {
    if (!playing() || !L || ptr) return;
    const u = toUnits(p.x, p.y);
    // the next bubble or the launcher: a tap swaps them
    if (Math.hypot(u.x - NEXT_AT.x, u.y - NEXT_AT.y) < 1.9 || Math.hypot(u.x - LAUNCHER.x, u.y - (LAUNCHER.y + 0.5)) < 2.1) {
      ptr = { id: p.id, swap: true, x0: p.x, y0: p.y };
      return;
    }
    const a = angleTo(u);
    if (a == null) return;
    ptr = { id: p.id, swap: false, cancel: false };
    aim = a;
  },
  move(p) {
    if (!ptr || p.id !== ptr.id || !L) return;
    const u = toUnits(p.x, p.y);
    if (ptr.swap) {
      // dragged up out of the swap spot: it's an aim after all
      if (Math.hypot(p.x - ptr.x0, p.y - ptr.y0) > 18) { const a = angleTo(u); if (a != null) { ptr = { id: p.id, swap: false, cancel: false }; aim = a; } }
      return;
    }
    const a = angleTo(u);
    if (a == null) { ptr.cancel = true; return; }
    ptr.cancel = false;
    aim = a;
  },
  up(p) {
    if (!ptr || p.id !== ptr.id) return;
    const P = ptr;
    ptr = null;
    if (p.event?.type === 'pointercancel' || p.event?.type === 'lostpointercapture') return;
    if (P.swap) { if (Math.hypot(p.x - P.x0, p.y - P.y0) <= 18) swap(); return; }
    if (!P.cancel) fire();
  },
  hover(p) {
    if (!playing() || p.type !== 'mouse' || !L || ptr) return;
    const a = angleTo(toUnits(p.x, p.y));
    if (a != null) aim = a;
  },
});

// ---------- keys ----------
let keyHeld = 0, keyAt = -9;
const keys = keyboard({
  ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', Shift: 'fine',
  ' ': 'fire', ArrowUp: 'fire', w: 'fire', x: 'swap', Tab: 'swap',
}, {
  down(name) {
    if (!playing()) return;
    keyAt = now;
    if (name === 'fire') fire();
    else if (name === 'swap') swap();
    else if (name === 'left' || name === 'right') keyHeld = 0;
  },
  blocked: () => Boolean(openCard) || shell.state !== 'play' || mode === 'title',
});
// the cards' keys first (capture): Esc never pauses over a card
addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || !openCard) return;
  if (e.target?.closest?.('input, textarea, select')) return;
  const k = e.key, onButton = e.target?.closest?.('button, a');
  if (k === 'Escape' || k === 'p' || k === 'P') { e.preventDefault(); e.stopImmediatePropagation(); openCard.keys.back?.(); return; }
  if ((k === 'Enter' || k === ' ') && !onButton && !e.repeat) { e.preventDefault(); e.stopImmediatePropagation(); openCard.keys.primary?.(); return; }
  if ((k === 'r' || k === 'R') && !e.repeat && openCard.keys.retry) { e.preventDefault(); e.stopImmediatePropagation(); openCard.keys.retry(); }
}, { capture: true });

// ---------- the loop ----------
const loop = createLoop({
  update(dt) {
    if (!game || (mode !== 'level' && mode !== 'endless')) return;
    // keys: the barrel turns (faster the longer it's held; Shift for fine aim)
    const dir = (keys.held('left') ? 1 : 0) - (keys.held('right') ? 1 : 0);
    if (dir && playing()) {
      keyHeld += dt;
      keyAt = now;
      const speed = keys.held('fine') ? 0.24 : Math.min(2.3, 0.85 + keyHeld * 2.2);
      aim = clamp(aim + dir * speed * dt, MIN_ANGLE, MAX_ANGLE);
    } else keyHeld = 0;
    if (queued && scene.ready && playing()) { const q = queued; queued = null; if (now <= q.until) { aim = q.angle; fire(); } }
    // Endless: the slow timer (only while the board is still)
    if (mode === 'endless' && playing() && scene.ready) {
      const r = game.tick(dt);
      if (r) {
        scene.playPush(r.push);
        if (r.status !== 'play') ending = { kind: r.status, reason: r.reason, res: null };
        chips();
      }
    }
    // she gets nervous near the deadline
    const danger = game.danger;
    if (danger && !wasDanger && now - nervousSaid > 10 && playing()) { nervousSaid = now; say.show(line('nervous', roll()), 2600); sfx.warn(); }
    wasDanger = danger;
    // a run's end, once its last shot has played out
    if (ending && scene.ready && !ending.done) {
      ending.done = true;
      if (mode === 'level') finishLevel(); else finishEndless();
    }
  },
  render(alpha, frameDt) {
    if (!L) relayout();
    const g = view.begin();
    if (!g || !L || !sheet) return;
    const dt = Math.min(frameDt, 0.05);
    const frozen = shell.state === 'pause';
    if (!frozen) scene.update(dt);
    now += dt;
    if (mode === 'title' || mode === 'demo') autoplay(dt);
    if (levelIntro && !frozen) { levelIntro.t += dt; if (levelIntro.t > levelIntro.dur) levelIntro = null; }
    if (faceHop > 0 && !frozen) faceHop = Math.max(0, faceHop - dt * 2.2);
    if (mode === 'level' || mode === 'endless') chips();
    let guide = null;
    if (game && game.status === 'play' && scene.ready && !openCard) {
      if (mode === 'demo' || mode === 'title') { if (auto?.plan) guide = game.path(aim); }
      else if (playing() || shell.state === 'pause') { if (!TOUCH || ptr || now - keyAt < 2.5) guide = game.path(aim); }
    }
    draw(g, L, scene, {
      t: performance.now() / 1000, game, guide, aim, cancel: Boolean(ptr && ptr.cancel), mode, def, panel, sheet, dpr: view.dpr,
      face: loaded(imgFace) ? imgFace : null, bust: loaded(imgBust) ? imgBust : null, faceHop,
      nervous: Boolean(game && game.status === 'play' && game.danger && mode !== 'title'),
      timerMax: game ? ENDLESS.interval(game.rows) : 1, best: store.best('best'), levelIntro,
    });
  },
  paused: () => shell.state !== 'play' && !DEMO,
});

// keep the board clear of the bar when the page changes size
addEventListener('resize', () => relayout());

// QA (`?qa`): a handle for the screenshot scripts; never on a link from the site
if (QUERY.has('qa')) {
  window.__bs = {
    get game() { return game; }, get scene() { return scene; }, get L() { return L; }, get mode() { return mode; },
    level: (n) => startLevel(n), endless: () => startEndless(), title: () => toTitle(), levels: () => openLevels(),
    aim: (deg) => { aim = clampAngle((deg * Math.PI) / 180); }, fire: () => fire(), swap: () => swap(),
    best: () => { const p = chooseShot(game); if (p) { if (p.swap) swap(); aim = p.angle; } return p; },
    unlock: () => store.update((d) => { d.levels = d.levels || {}; for (const l of LEVELS) d.levels[l.n] ||= { stars: 1 + (l.n % 3), score: 1000 }; }),
  };
}

// the canvas's words wait for the arcade's fonts (never longer than a moment)
const fonts = Promise.all(["900 40px 'AK Display'", "700 16px 'AK Mono'", "italic 400 18px 'AK Serif'"].map((f) => document.fonts?.load(f).catch(() => null)));
Promise.race([fonts, new Promise((r) => setTimeout(r, 1800))]).then(() => {
  relayout();
  if (DEMO) startDemo(0); else toTitle();
  loop.start();
});
