// ACCEPT ALL COOKIES on agi1.app (2026-11-09): Cut the ropes. Feed her cat. Accept all cookies.
// A rope-cutting physics puzzle on the arcade kit: swipe across the ropes to drop and swing a sugar cookie into the
// mouth of AGI-1's hungry cat, through the page's three tracker pixels on the way. 30 levels in three "sites" (a
// recipe blog, a news site, a social feed) with hooks, pop-ups, cookie banners, fans, bugs, sliding pins and tabs.
// The physics are ./physics.js (no DOM, the tests run it), the levels ./levels.js, the look ./art.js and ./cat.js,
// the cards ./ui.js. This file wires the kit's frame, the input, the loop, the title's swinging cookie and `?demo`.
import './style.css';
import { createShell, el } from '../kit/shell.js';
import { fitCanvas } from '../kit/canvas.js';
import { createLoop } from '../kit/loop.js';
import { pointer } from '../kit/input.js';
import { Particles, Shake, FloatText, clamp, ease } from '../kit/fx.js';
import { DEMO, SEED, TOUCH, REDUCED, QUERY } from '../kit/env.js';
import { shareUrl } from '../kit/share.js';
import { World, HZ, DT, POP_R, closestT } from './physics.js';
import { LEVELS, SITES, levelById } from './levels.js';
import {
  C, FONT, WIN, WIN_W, WIN_H, cookieSprite, windowLayer, desktopLayer, drawAddress, ADDR, drawPin, drawHook, drawTrack,
  drawKnob, drawBanner, drawPad, drawFan, drawPopup, drawBug, drawTab, TAB_COLORS, drawPixel, strokeRope,
} from './art.js';
import { Cat, drawCat } from './cat.js';
import { createSfx, createMusic } from './sound.js';
import * as LINES from './lines.js';
import { createDock, levelSelect, doneCard } from './ui.js';
import * as P from './progress.js';

const FACE = '/images/landing/agi1-face.webp';
const TAGLINE = 'Cut the ropes. Feed her cat. Accept all cookies.';
const root = document.getElementById('ak-root');
const shell = createShell({
  game: 'cookies', name: 'ACCEPT ALL COOKIES', root,
  howTo: {
    intro: 'Get the cookie into the cat’s mouth. Find the three tracker pixels on the way for all the stars.',
    steps: [
      ['Cut', 'Swipe across a rope to cut it. One swipe can cut several.'],
      ['Swing', 'Time your cuts: a swinging cookie flies the way it was going.'],
      ['Dashed circles', 'The cookie passing through one gets a new rope.'],
      ['Pop-ups, fans, bugs, tabs', 'Pop-ups float it up (tap ✕), fans puff it, bugs crumble it, tabs send it to their twin.'],
    ],
    touch: [['Swipe', 'Cut a rope'], ['Tap', 'Close a pop-up, puff a fan'], ['Drag', 'Slide a yellow knob']],
    keys: [['Drag with the mouse', 'Cut'], ['Click', 'Close a pop-up, puff a fan'], ['R', 'Retry'], ['L', 'Levels'], ['Hold Tab', 'Number the ropes'], ['1–9', 'Cut rope (or pop, puff) n'], ['← →', 'Slide a knob'], ['Esc', 'Pause']],
  },
  onPause: () => { swipes.clear(); dragging.clear(); },
  onResume: () => { if (openCard) reshowCard(); },
  onRestart: () => { if (L) startLevel(L, { retry: true }); },
  onQuit: () => toTitle(),
});

const canvas = el('canvas', { class: 'ck-canvas', role: 'img', 'aria-label': 'ACCEPT ALL COOKIES: the page' });
const safe = el('div', { class: 'ck-safe', 'aria-hidden': 'true' });
const hero = el('img', { class: 'ck-hero', src: '/images/landing/agi1-cutout.webp', alt: '', 'aria-hidden': 'true', hidden: true });
shell.stage.append(canvas, safe, hero);
let booted = false;
const view = fitCanvas(canvas, { maxDpr: 2, onResize: () => { if (booted) relayout(); } });
const sfx = createSfx(shell.audio);
const music = createMusic();
const chipLevel = shell.chip('Level', '1-1');
const chipPx = shell.chip('Pixels', '0/3');
const dock = createDock(shell.stage, { onRetry: () => retry(), onLevels: () => openSelect(), face: FACE });
const store = shell.store;
const prog = () => store.read().levels || {};

// ---------- state ----------
let mode = 'boot';                 // title · play · demo
let L = null, site = SITES[0], world = null;
let phase = 'play';                // play · won · lost
let phaseT = 0, lastAct = 0, playT = 0;
let openCard = null;
let lay = { s: 1, x: 0, y: 0 };    // page units → CSS pixels
let winLayer = null, deskLayer = null, sprite = null;
const cat = new Cat();
const parts = new Particles(520);
const floats = new FloatText();
const shake = new Shake({ max: 9, decay: 2.4 });
const swipes = new Map();          // pointer id → its last point (page units)
const dragging = new Map();        // pointer id → sliding pin index
const trail = [];                  // the blade's trail: { x, y, t } (CSS pixels, seconds)
let now = 0, tabHeld = false, keyPin = 0;
let addrFlash = 0, reloadHot = 0, squash = { k: 0, nx: 0, ny: -1 };
const fx = { pads: [], fans: [], pops: [], hooks: [], tabs: [] };   // per element: its animations
let demo = null;                   // { order, i, startAt, acts, k }
let titleWorld = null, nudge = 0;

const announce = (t) => { dock.live.textContent = t; };

// ---------- layout ----------
function insets() {
  const cs = getComputedStyle(safe);
  const px = (v) => parseFloat(v) || 0;
  return { t: px(cs.paddingTop), r: px(cs.paddingRight), b: px(cs.paddingBottom), l: px(cs.paddingLeft) };
}
// the window as big as fits in a box (with its shadow), centred
function fitWindow(box) {
  const s = Math.min(box.w / (WIN_W + 14), box.h / (WIN_H + 16));
  const w = WIN_W * s, h = WIN_H * s;
  const x0 = box.x + (box.w - w - 10 * s) / 2, y0 = box.y + (box.h - h - 12 * s) / 2;
  return { s, x: x0 - WIN.l * s, y: y0 - WIN.t * s, w, h, x0, y0 };
}
let dockSide = false;
function relayout() {
  const vw = view.w, vh = view.h;
  deskLayer = null;
  if (mode === 'demo') {
    lay = fitWindow({ x: 4, y: 4, w: vw - 8, h: vh - 8 });
  } else if (mode === 'title') {
    lay = titleLayout(vw, vh);
  } else {
    const ins = insets();
    const bar = shell.bar.getBoundingClientRect();
    const top = Math.max(bar.bottom, ins.t) + 4, bottom = ins.b + 10, left = ins.l + 10, right = ins.r + 10;
    const box = { x: left, y: top, w: vw - left - right, h: vh - top - bottom };
    dockSide = box.w > box.h * 0.82;
    const full = { ...box };
    if (dockSide) box.w -= 66; else box.h -= 64;
    lay = fitWindow(box);
    // the window and its dock as one group, in the middle of what's left
    if (dockSide) {
      const gw = lay.w + 10 * lay.s + 14 + 48;
      const x0 = full.x + Math.max(0, (full.w - gw) / 2);
      lay.x += x0 - lay.x0; lay.x0 = x0;
    } else {
      const gh = lay.h + 12 * lay.s + 10 + 52;
      const y0 = full.y + Math.max(0, (full.h - gh) / 2);
      lay.y += y0 - lay.y0; lay.y0 = y0;
    }
    // the dock: beside the window (right), or under it
    const d = dock.node;
    d.classList.toggle('is-side', dockSide);
    if (dockSide) {
      d.style.left = `${Math.round(lay.x0 + lay.w + 14 * lay.s + 8)}px`;
      d.style.top = `${Math.round(lay.y0 + 4)}px`;
    } else {
      d.style.left = `${Math.round(lay.x0 + lay.w - 2)}px`;
      d.style.top = `${Math.round(lay.y0 + lay.h + 12 * lay.s + 8)}px`;
    }
    // AGI-1's bubble: under the window on a phone held upright, beside it otherwise
    const say = dock.say;
    say.classList.toggle('is-side', dockSide);
    if (dockSide) {
      const room = lay.x0 - 16;
      say.classList.toggle('is-wide', room > 240);
      say.style.left = room > 240 ? `${Math.round(Math.max(16, lay.x0 - 300))}px` : `${Math.round(lay.x0 + lay.w + 14 * lay.s + 8)}px`;
      say.style.top = room > 240 ? `${Math.round(lay.y0 + lay.h * 0.12)}px` : `${Math.round(lay.y0 + 120)}px`;
      say.style.maxWidth = room > 240 ? '280px' : `${Math.max(160, Math.round(vw - (lay.x0 + lay.w) - 40))}px`;
    } else {
      say.classList.remove('is-wide');
      say.style.left = `${Math.round(lay.x0 + 4)}px`;
      say.style.top = `${Math.round(lay.y0 + lay.h + 12 * lay.s + 6)}px`;
      say.style.maxWidth = `${Math.round(Math.max(150, lay.w - 112))}px`;
    }
  }
  winLayer = null; sprite = null;
}
// the title: the window with the cat beside the menu (wide screens) or under it (a phone held upright)
let titleBox = null;
function titleLayout(vw, vh) {
  const wide = vw > vh * 1.05;
  let box;
  if (wide) box = { x: vw * 0.5, y: 70, w: vw * 0.46, h: vh - 90 };
  else box = { x: 12, y: vh * 0.5, w: vw - 24, h: vh * 0.5 - 8 };
  const f = fitWindow(box);
  titleBox = { wide, ...f };
  // AGI-1 beside the window
  const ok = wide ? (f.x0 - vw * 0.42 > 40) : true;
  hero.hidden = !ok;
  if (ok) {
    const h = wide ? Math.min(vh * 0.86, f.h * 1.05) : Math.min(vh * 0.44, f.h * 0.92);
    hero.style.height = `${Math.round(h)}px`;
    hero.style.left = wide ? `${Math.round(f.x0 - h * 0.34)}px` : `${Math.round(f.x0 - h * 0.2)}px`;
    hero.style.top = `${Math.round(f.y0 + f.h - h * (wide ? 0.97 : 0.95))}px`;
  }
  return f;
}

// ---------- the static layers ----------
function ensureLayers() {
  if (!deskLayer) deskLayer = desktopLayer(view.w, view.h, view.dpr);
  if (!winLayer) winLayer = windowLayer(site, lay.s, view.dpr);
  if (!sprite) sprite = cookieSprite(Math.max(8, Math.round(52 * lay.s * view.dpr)));
}

// ---------- a level ----------
function loadLevel(def) {
  L = def;
  site = SITES.find((s) => s.id === def.site);
  world = new World(def);
  phase = 'play'; phaseT = 0; lastAct = 0; playT = 0;
  cat.reset();
  parts.clear(); floats.clear();
  swipes.clear(); dragging.clear(); trail.length = 0;
  squash.k = 0; addrFlash = 0;
  fx.pads = world.walls.map(() => 0);
  fx.fans = world.fans.map(() => ({ spin: 0, v: 1.2, puff: 0 }));
  fx.pops = world.popups.map(() => ({ close: -1 }));
  fx.hooks = world.hooks.map(() => 1);
  fx.tabs = world.tabs.map(() => 0);
  winLayer = null;
}
function startLevel(def, { retry: again = false } = {}) {
  closeCard();
  mode = 'play';
  hero.hidden = true;
  loadLevel(def);
  relayout();
  dock.show(true);
  shell.started({ count: !again });
  shell.pausable(true);
  shell.audio.music(music);
  store.update((s) => { s.last = def.id; });
  chipLevel.set(def.id);
  chipPx.set('0/3');
  if (!again) {
    const tip = LINES.START[def.id];
    if (tip) setTimeout(() => { if (mode === 'play' && L === def) dock.speak(tip, 3400); }, 450);
    announce(`Level ${def.id}, ${def.name}. ${def.tip || ''}`);
  }
}
function retry() {
  if (mode !== 'play' || !L) return;
  shell.audio.unlock();
  sfx.select();
  startLevel(L, { retry: true });
}

// ---------- what the world says, as it happens ----------
function handle(events, { quiet = false } = {}) {
  for (const e of events) {
    switch (e.type) {
      case 'cut':
        if (!quiet) { sfx.cut(e.taut); shell.haptic(8); }
        parts.burst({ x: e.x, y: e.y, count: 10, speed: [60, 220], life: [0.25, 0.5], size: [3, 6], colors: [C.honey, C.paper, C.honey2], drag: 3, shape: 'spark' });
        lastAct = now;
        break;
      case 'pixel': {
        if (!quiet) { sfx.pixel(e.n); shell.haptic(14); }
        parts.burst({ x: e.x, y: e.y, count: 22, speed: [80, 300], life: [0.4, 0.8], size: [5, 10], colors: [C.mint, C.mint2, C.paper], gravity: 300, drag: 2.2, shape: 'square', spin: 8, stroke: C.ink });
        parts.burst({ x: e.x, y: e.y, count: 1, speed: [0, 0], life: [0.45, 0.45], size: [26, 26], colors: [C.mint], shape: 'ring', grow: 50 });
        floats.add({ x: e.x, y: e.y - 26, text: e.n === 3 ? 'ALL 3!' : `PIXEL ${e.n}`, color: C.mint, size: e.n === 3 ? 30 : 24, life: 0.9, rise: 50 });
        chipPx.set(`${e.n}/3`, { pop: true });
        addrFlash = 1;
        cat.cheer();
        if (!quiet && e.n === 3 && Math.random() < 0.5) dock.speak(LINES.pick(LINES.PIXEL), 1800);
        break;
      }
      case 'hook':
        if (!quiet) sfx.hook();
        { const h = world.hooks[e.i]; parts.burst({ x: h.x, y: h.y, count: 1, speed: [0, 0], life: [0.4, 0.4], size: [h.r * 0.5, h.r * 0.5], colors: [C.violet2], shape: 'ring', grow: h.r * 2 }); }
        break;
      case 'wrap':
        if (!quiet) sfx.wrap();
        parts.burst({ x: e.x, y: e.y, count: 12, speed: [60, 160], life: [0.3, 0.6], size: [3, 6], colors: [C.violet2, C.paper], drag: 3, shape: 'star' });
        break;
      case 'pop':
        if (!quiet) { sfx.bloop(); shell.haptic(10); }
        fx.pops[e.i].close = 0;
        parts.burst({ x: e.x, y: e.y, count: 14, speed: [100, 260], life: [0.3, 0.6], size: [5, 9], colors: [C.violet, C.paper, C.pink], gravity: 500, drag: 2, shape: 'square', spin: 10, stroke: C.ink });
        lastAct = now;
        break;
      case 'puff': {
        if (!quiet) sfx.puff(e.hit);
        const f = world.fans[e.i];
        fx.fans[e.i].v = 26; fx.fans[e.i].puff = 1;
        parts.burst({ x: f.x + f.dx * 40, y: f.y + f.dy * 40, count: 14, speed: [260, 520], angle: [Math.atan2(f.dy, f.dx) - 0.45, Math.atan2(f.dy, f.dx) + 0.45], life: [0.25, 0.5], size: [4, 8], colors: ['#ffffff', C.sky], drag: 4, shape: 'spark' });
        lastAct = now;
        break;
      }
      case 'bounce':
        if (e.pad) { fx.pads[e.wall] = 1; if (!quiet) { sfx.bounce(e.v, true); shell.haptic(10); } }
        else if (e.v > 160 && !quiet) sfx.bounce(e.v, false);
        if (e.v > 160 || e.pad) { const c = world.c; const d = Math.hypot(c.x - e.x, c.y - e.y) || 1; squash = { k: Math.min(1, e.v / 700), nx: (c.x - e.x) / d, ny: (c.y - e.y) / d }; }
        if (e.pad) parts.burst({ x: e.x, y: e.y, count: 8, speed: [60, 180], life: [0.2, 0.4], size: [3, 6], colors: [C.pink, C.paper], drag: 3, shape: 'spark' });
        break;
      case 'tab':
        if (!quiet) sfx.tab();
        fx.tabs[e.from] = 1; fx.tabs[e.to] = 1;
        for (const [x, y] of [[e.x, e.y], [e.tx, e.ty]]) parts.burst({ x, y, count: 12, speed: [60, 200], life: [0.3, 0.6], size: [3, 6], colors: [C.honey, C.paper, C.violet2], drag: 3, shape: 'star' });
        break;
      case 'eat': win(e, quiet); break;
      case 'lost': lose(e, quiet); break;
      default: break;
    }
  }
}

// ---------- fed, or lost ----------
function win(e, quiet) {
  phase = 'won'; phaseT = 0;
  cat.eat();
  shake.kick(0.18);
  parts.burst({ x: e.x, y: e.y, count: 26, speed: [120, 380], angle: [-Math.PI * 0.95, -Math.PI * 0.05], life: [0.5, 1.1], size: [4, 8], colors: ['#f2c780', '#de9f55', C.pink, C.pink2], gravity: 900, drag: 1.2, shape: 'square', spin: 10 });
  floats.add({ x: world.cat.x, y: world.cat.y - 120, text: 'CHOMP!', color: C.honey, size: 40, life: 1.1, rise: 40 });
  if (quiet) return;
  sfx.chomp(); sfx.purr(1.6);
  shell.haptic([18, 40, 18]);
  if (mode !== 'play') return;
  const stars = e.pixels;
  const before = prog();
  const { prog: next, better, first, opened } = P.record(before, L.id, stars);
  store.update((s) => { s.levels = next; });
  const siteLv = LEVELS.filter((l) => l.site === L.site);
  const siteDone = first && siteLv.every((l) => next[l.id]);
  const info = { stars, best: !first && better ? 'More pixels!' : null, siteDone, opened };
  announce(`Fed! ${stars} of 3 pixels.`);
  setTimeout(() => { if (mode === 'play' && phase === 'won' && world && world.status === 'won') showDone(info); }, REDUCED ? 500 : 1250);
}
function lose(e, quiet) {
  phase = 'lost'; phaseT = 0;
  cat.lose();
  if (e.why === 'bug') {
    shake.kick(0.32);
    parts.burst({ x: e.x, y: e.y, count: 30, speed: [80, 320], life: [0.5, 1], size: [4, 9], colors: ['#f2c780', '#de9f55', '#fbe3b0', C.pink], gravity: 900, drag: 1.4, shape: 'square', spin: 12 });
    floats.add({ x: e.x, y: e.y - 30, text: 'CRUMBLED', color: C.red, size: 28, life: 1, rise: 40 });
  } else floats.add({ x: clamp(e.x, 90, 510), y: clamp(e.y, 120, 820) - 30, text: e.why === 'away' ? 'FLOATED AWAY' : 'OOPS', color: C.pink, size: 28, life: 1, rise: 30 });
  if (quiet) return;
  if (e.why === 'bug') { sfx.crumble(); shell.haptic([30, 30, 30]); } else sfx.fall();
  if (Math.random() < 0.6) dock.speak(LINES.lostLine(e.why), 1900);
  announce(e.why === 'bug' ? 'A bug crumbled the cookie. Retrying.' : 'The cookie was lost. Retrying.');
}

function showDone(info) {
  const next = LEVELS[L.index + 1] || null;
  const nextOpen = next && P.levelOpen(prog(), next);
  const line = info.siteDone ? LINES.SITE_DONE[L.site] : LINES.doneLine(info.stars);
  const p = prog();
  const text = LINES.share(P.fedCount(p), P.totalStars(p));
  const goNext = () => (next && nextOpen ? startLevel(next) : openSelect(next && !nextOpen ? next.site : L.site));
  const make = () => doneCard({
    L, stars: info.stars, best: info.best, line, face: FACE, next: next && nextOpen ? next : null,
    kicker: info.siteDone ? `${site.name} · all fed` : null,
    share: shareUrl({ text, path: '/games/cookies' }),
    onNext: goNext, onReplay: () => startLevel(L, { retry: true }), onLevels: () => openSelect(),
  });
  showCard('done', make, `Level ${L.id} fed`);
  openCard.keys = { primary: goNext, retry: () => startLevel(L, { retry: true }) };
  if (!REDUCED) for (let i = 0; i < info.stars; i++) setTimeout(() => { if (openCard?.kind === 'done') sfx.star(i); }, 280 + i * 240);
  if (info.siteDone) setTimeout(() => sfx.site(), 1000);
  for (const sid of info.opened) setTimeout(() => { shell.toast(`${SITES[sid - 1].name} unlocked!`, 'good', 2200); }, 900);
}

// ---------- cards over the game (the kit's layer) ----------
function showCard(kind, make, label) {
  openCard = { kind, make, label, keys: {} };
  shell.card(make(), { label });
  shell.pausable(false);
  dock.hush();
}
function reshowCard() {
  if (!openCard) return;
  const keys = openCard.keys;
  shell.card(openCard.make(), { label: openCard.label });
  openCard.keys = keys;
  shell.pausable(false);
}
function closeCard() {
  if (!openCard) return;
  openCard = null;
  shell.closeCard();
  if (mode === 'play') shell.pausable(true);
}

// the level select
let selSite = 1;
function openSelect(siteId) {
  const p = prog();
  const cur = mode === 'play' && L ? L : P.nextLevel(p);
  selSite = siteId || cur.site;
  const make = () => levelSelect({
    sites: SITES, levels: LEVELS, prog: p, current: cur.id, site: selSite, total: P.totalStars(p),
    open: (l) => P.levelOpen(p, l), siteOpenFn: (s) => P.siteOpen(p, s), starsOf: (id) => P.starsOf(p, id), siteStars: (s) => P.siteStars(p, s),
    onPick: (l, ok) => { shell.audio.unlock(); if (!ok) { sfx.error(); shell.toast(P.siteOpen(p, l.site) ? 'Feed the one before it first' : `Find ${SITES[l.site - 1].unlock} pixels to open`, 'warn', 1500); return; } sfx.select(); startLevel(l); },
    onClose: () => closeSelect(),
    onSite: (s) => { selSite = s; },
  }).card;
  showCard('select', make, 'Levels');
  openCard.keys = { primary: () => { const l = cur; if (P.levelOpen(p, l)) startLevel(l); } };
}
function closeSelect() {
  closeCard();
  if (mode === 'play' && world && world.status !== 'play') toTitle();
  else if (mode === 'title') toTitle();
}

// ---------- the title: the cat in its window, a cookie swinging over it ----------
const TITLE_LEVEL = { id: '0-0', name: 'title', cookie: [404, 400], pins: [[300, 120]], ropes: [[0]], cat: [300, 800], pixels: [[150, 360], [300, 450], [450, 360]] };
function toTitle() {
  closeCard();
  mode = 'title';
  dock.show(false);
  shell.audio.stopMusic();
  site = SITES[0];
  L = null;
  titleWorld = new World(TITLE_LEVEL);
  world = titleWorld;
  phase = 'play';
  cat.reset();
  parts.clear(); floats.clear(); trail.length = 0;
  fx.pads = []; fx.fans = []; fx.pops = []; fx.hooks = []; fx.tabs = [];
  relayout();
  const p = prog();
  const total = P.totalStars(p), fedN = P.fedCount(p);
  const next = P.nextLevel(p);
  shell.title({
    logo: [{ text: 'ACCEPT ALL', small: true }, { text: 'COOKIES', tone: 'accent' }],
    tagline: TAGLINE,
    play: fedN ? `Play ${next.id}` : 'Play',
    modes: [{ label: 'Levels', sub: `${fedN}/30 fed · ${total}/90 pixels`, onClick: () => { sfx.select(); openSelect(); } }],
    best: null,
    onPlay: () => { sfx.select(); startLevel(P.nextLevel(prog())); },
  });
}

// ---------- the demo: the levels' own solutions, with a visible blade and taps ----------
const DEMO_ORDER = ['2-10', '1-6', '3-10', '2-3', '1-9', '3-8', '2-5', '1-4'];
function startDemo(k = 0) {
  mode = 'demo';
  dock.show(false);
  const id = DEMO_ORDER[k % DEMO_ORDER.length];
  loadLevel(levelById(id));
  relayout();
  const acts = L.sol.slice().sort((a, b) => a[0] - b[0]);
  // the first one lands just after the preview starts recording (5.7 s after the page opens)
  const first = acts.length ? acts[0][0] : 0;
  const startAt = k === 0 ? Math.max(0, 5.95 - first / HZ) : 0;
  demo = { k, acts, i: 0, startAt, done: 0, ghosts: [] };
}
function demoUpdate() {
  if (!demo) return;
  if (demo.startAt && performance.now() / 1000 < demo.startAt) return false;
  const T = world.tick;
  while (demo.i < demo.acts.length && demo.acts[demo.i][0] <= T) {
    const a = demo.acts[demo.i++];
    world.apply(a.slice(1));
  }
  // the blade: a swipe drawn across each rope a moment before it's cut, a tap ring on a pop-up or a fan
  for (const a of demo.acts) {
    const dt = a[0] - T;
    if (a[1] === 'cut' && dt === 9) {
      const r = world.ropes[a[2]];
      if (r && !r.cut) {
        const p = r.chain.p, k = (r.chain.n >> 1) * 4;
        const mx = (p[k] + p[k + 4]) / 2, my = (p[k + 1] + p[k + 5]) / 2;
        let dx = p[k + 4] - p[k], dy = p[k + 5] - p[k + 1];
        const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
        demo.ghosts.push({ x0: mx - dy * 70 - dx * 18, y0: my + dx * 70 - dy * 18, x1: mx + dy * 70 + dx * 18, y1: my - dx * 70 + dy * 18, t: 0, dur: 14 / HZ });
      }
    }
    if ((a[1] === 'pop' || a[1] === 'puff') && dt === 0) {
      const o = a[1] === 'pop' ? world.popups[a[2]] : world.fans[a[2]];
      if (o) parts.burst({ x: o.x, y: o.y, count: 1, speed: [0, 0], life: [0.4, 0.4], size: [20, 20], colors: [C.paper], shape: 'ring', grow: 70 });
    }
  }
  return true;
}

// ---------- input: swipe to cut, tap pop-ups and fans, drag the knobs ----------
const toPage = (x, y) => ({ x: (x - lay.x) / lay.s, y: (y - lay.y) / lay.s });
const playing = () => mode === 'play' && shell.state === 'play' && !openCard && world;
function tappable(w) {
  for (let i = 0; i < world.popups.length; i++) {
    const u = world.popups[i];
    if (u.state === 'closed') continue;
    if (Math.hypot(w.x - u.x, w.y - u.y) < POP_R + 26) return { kind: 'pop', i };
  }
  for (let i = 0; i < world.fans.length; i++) { const f = world.fans[i]; if (Math.hypot(w.x - f.x, w.y - f.y) < 48) return { kind: 'puff', i }; }
  for (let i = 0; i < world.pins.length; i++) { const p = world.pins[i]; if (p.track && Math.hypot(w.x - p.x, w.y - p.y) < 46) return { kind: 'knob', i }; }
  if (Math.hypot(w.x - ADDR.reload[0], w.y - ADDR.reload[1]) < 24) return { kind: 'reload' };
  return null;
}
function slideTo(i, w) {
  const p = world.pins[i], t = p.track;
  world.apply(['slide', i, closestT(t.x0, t.y0, t.x1, t.y1, w.x, w.y)]);
}
pointer(canvas, {
  down(p) {
    shell.audio.unlock();
    if (phase === 'lost' && mode === 'play' && shell.state === 'play' && !openCard) { startLevel(L, { retry: true }); return; }
    if (!playing() || phase !== 'play') return;
    const w = toPage(p.x, p.y);
    const hit = tappable(w);
    if (hit?.kind === 'reload') { retry(); reloadHot = 1; return; }
    if (hit?.kind === 'pop') world.apply(['pop', hit.i]);
    else if (hit?.kind === 'puff') world.apply(['puff', hit.i]);
    else if (hit?.kind === 'knob') { dragging.set(p.id, hit.i); slideTo(hit.i, w); lastAct = now; return; }
    swipes.set(p.id, w);
    trail.push({ x: p.x, y: p.y, t: now, id: p.id });
    handle(world.drain());
  },
  move(p) {
    if (!playing()) return;
    const w = toPage(p.x, p.y);
    if (dragging.has(p.id)) { slideTo(dragging.get(p.id), w); return; }
    const last = swipes.get(p.id);
    if (!last) return;
    if (phase === 'play') {
      const n = world.cutAlong(last.x, last.y, w.x, w.y);
      if (n) handle(world.drain());
    }
    if (Math.hypot(w.x - last.x, w.y - last.y) > 26 && Math.random() < 0.3) sfx.swish();
    swipes.set(p.id, w);
    trail.push({ x: p.x, y: p.y, t: now, id: p.id });
  },
  up(p) { swipes.delete(p.id); dragging.delete(p.id); },
  hover(p) {
    if (!playing() || p.type !== 'mouse') { canvas.style.cursor = ''; return; }
    const hit = tappable(toPage(p.x, p.y));
    canvas.style.cursor = hit ? (hit.kind === 'knob' ? 'grab' : 'pointer') : 'crosshair';
  },
});

// keys (on the capture side: a card's keys first, and Esc never pauses over a card)
function actionables() {
  const list = [];
  if (!world) return list;
  for (const r of world.ropes) if (!r.cut) list.push({ kind: 'cut', i: r.id });
  world.popups.forEach((u, i) => { if (u.state !== 'closed') list.push({ kind: 'pop', i }); });
  world.fans.forEach((f, i) => list.push({ kind: 'puff', i }));
  return list;
}
addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target?.closest?.('input, textarea, select')) return;
  const k = e.key;
  if (openCard) {
    const onButton = e.target?.closest?.('button, a');
    if (k === 'Escape') { e.preventDefault(); if (openCard.kind === 'select') closeSelect(); else openSelect(); return; }
    if ((k === 'Enter' || k === ' ') && !onButton && !e.repeat) { e.preventDefault(); openCard.keys.primary?.(); return; }
    if ((k === 'r' || k === 'R') && !e.repeat && openCard.keys.retry) { e.preventDefault(); openCard.keys.retry(); return; }
    return;
  }
  if (mode !== 'play' || shell.state !== 'play') return;
  if (k === 'Tab') { e.preventDefault(); tabHeld = true; return; }
  if (e.repeat && !/^Arrow/.test(k)) return;
  if (k === 'r' || k === 'R') { e.preventDefault(); if (phase === 'lost') startLevel(L, { retry: true }); else retry(); return; }
  if (k === 'l' || k === 'L') { e.preventDefault(); openSelect(); return; }
  if (/^[1-9]$/.test(k) && phase === 'play') {
    e.preventDefault();
    const a = actionables()[Number(k) - 1];
    if (a) { world.apply([a.kind, a.i]); handle(world.drain()); }
    return;
  }
  const knobs = world.pins.map((p, i) => (p.track ? i : -1)).filter((i) => i >= 0);
  if (knobs.length && /^Arrow/.test(k) && phase === 'play') {
    e.preventDefault();
    if (k === 'ArrowUp' || k === 'ArrowDown') { keyPin = (keyPin + (k === 'ArrowDown' ? 1 : knobs.length - 1)) % knobs.length; tabHeld = true; setTimeout(() => { tabHeld = false; }, 900); return; }
    const i = knobs[keyPin % knobs.length], p = world.pins[i];
    const dir = (p.track.x1 - p.track.x0) >= 0 ? 1 : -1;
    world.apply(['slide', i, clamp(p.target + (k === 'ArrowRight' ? 0.125 : -0.125) * dir, 0, 1)]);
    lastAct = now;
  }
}, { capture: true });
addEventListener('keyup', (e) => { if (e.key === 'Tab') tabHeld = false; });
addEventListener('blur', () => { tabHeld = false; });

// ---------- the loop ----------
const loop = createLoop({
  update(dt) {
    now += dt;
    if (mode === 'play') {
      if (shell.state !== 'play' || openCard) return;
      phaseT += dt;
      if (phase === 'play') {
        world.step();
        handle(world.drain());
        playT += dt;
      } else {
        world.step(); world.drain();
        if (phase === 'lost' && phaseT > 1.0) startLevel(L, { retry: true });
      }
    } else if (mode === 'demo') {
      phaseT += dt;
      if (demoUpdate() === false) return;
      world.step();
      handle(world.drain(), { quiet: true });
      if (world.status !== 'play') {
        demo.done += dt;
        if (demo.done > (world.status === 'won' ? 1.3 : 0.8)) startDemo(demo.k + 1);
      } else if (world.tick > HZ * 20) startDemo(demo.k + 1);
    } else if (mode === 'title' && titleWorld) {
      // the title's cookie keeps swinging gently (a little push now and then, at the bottom of its swing)
      titleWorld.step(); titleWorld.drain();
      nudge -= dt;
      const c = titleWorld.c;
      if (nudge <= 0 && Math.abs(c.x - 300) < 6) {
        const v = c.x - c.px;
        const sp = Math.abs(v);
        if (sp < 4.2) { const k = (4.2 - sp) * 0.6 * Math.sign(v || 1); c.px -= k; }
        nudge = 0.8;
      }
      // the title's pixels come back (it's a loop)
      for (const p of titleWorld.pixels) if (p.got && Math.random() < 0.004) { p.got = false; }
    }
  },
  render(alpha, frameDt) {
    const g = view.begin();
    ensureLayers();
    g.drawImage(deskLayer, 0, 0, view.w, view.h);
    if (!world) return;
    const fdt = Math.min(frameDt, 0.05);
    tick(fdt);
    drawScene(g, alpha);
    drawTrail(g);
  },
  paused: () => false,
});

// effects and the cat, once a frame
function tick(dt) {
  parts.update(dt); floats.update(dt); shake.update(dt);
  if (addrFlash > 0) addrFlash = Math.max(0, addrFlash - dt * 3);
  if (reloadHot > 0) reloadHot = Math.max(0, reloadHot - dt * 3);
  if (squash.k > 0) squash.k = Math.max(0, squash.k - dt * 6);
  for (let i = 0; i < fx.pads.length; i++) fx.pads[i] = Math.max(0, fx.pads[i] - dt * 5);
  for (const f of fx.fans) { f.spin += f.v * dt; f.v += (1.2 - f.v) * (1 - Math.exp(-dt * 2.5)); f.puff = Math.max(0, f.puff - dt * 3); }
  for (const p of fx.pops) if (p.close >= 0) p.close += dt * 4;
  for (let i = 0; i < fx.hooks.length; i++) if (world.hooks[i]?.used) fx.hooks[i] = Math.max(0, fx.hooks[i] - dt * 4);
  for (let i = 0; i < fx.tabs.length; i++) fx.tabs[i] = Math.max(0, fx.tabs[i] - dt * 2.5);
  // the cat watches the cookie
  const c = world.c, k = world.cat;
  let look = null, near = 0;
  if (!c.gone) {
    const dx = c.x - k.x, dy = c.y - (k.y - 26);
    const d = Math.hypot(dx, dy) || 1;
    look = { x: dx / Math.max(d, 140), y: dy / Math.max(d, 140) };
    near = clamp(1 - (d - 60) / 260, 0, 1);
  }
  const idle = mode === 'play' && phase === 'play' && now - lastAct > 0 && Math.hypot(c.x - c.px, c.y - c.py) < 0.3;
  cat.update(dt, look, near, idle && now - lastAct > 5);
  if (mode === 'play' && phase === 'play' && cat.wait > 9 && cat.wait - dt <= 9) dock.speak(LINES.pick(LINES.IDLE), 2400);
}

function drawScene(g, alpha) {
  const s = lay.s;
  // the window (pre-drawn)
  g.save();
  if (shake.trauma) g.translate(shake.x, shake.y);
  const wl = winLayer;
  g.drawImage(wl.canvas, lay.x + (WIN.l - wl.pad) * s, lay.y + (WIN.t - wl.pad) * s, wl.canvas.width / view.dpr, wl.canvas.height / view.dpr);
  g.translate(lay.x, lay.y);
  g.scale(s, s);
  drawAddress(g, site, L ? L.id : 'hello', world.got, addrFlash, reloadHot);
  // the page
  g.save();
  g.beginPath(); g.rect(1.5, 1.5, 597, 897); g.clip();
  const t = now;
  world.hooks.forEach((h, i) => drawHook(g, h, t, fx.hooks[i] ?? 0));
  for (const p of world.pins) if (p.track) drawTrack(g, p);
  for (let i = 0; i < world.tabs.length; i++) drawTab(g, world.tabs[i], t + i, TAB_COLORS[(i >> 1) % TAB_COLORS.length], fx.tabs[i]);
  world.walls.forEach((w, i) => (w.kind === 'pad' ? drawPad(g, w, fx.pads[i] || 0) : drawBanner(g, w)));
  world.fans.forEach((f, i) => drawFan(g, f, fx.fans[i]?.spin || 0, fx.fans[i]?.puff || 0));
  world.pixels.forEach((p, i) => { if (!p.got) drawPixel(g, p, t, i); });
  world.bugs.forEach((b, i) => drawBug(g, b, t, i));
  // the cat
  drawCat(g, cat, world.cat.x, world.cat.y, { reduced: REDUCED });
  // ropes (the cut halves fade)
  for (const pc of world.pieces) strokeRope(g, pc.chain.p, pc.chain.n, Math.min(1, pc.life / pc.max * 1.6));
  const c = world.c;
  const cx = c.ox + (c.x - c.ox) * alpha, cy = c.oy + (c.y - c.oy) * alpha;
  for (const r of world.ropes) if (!r.cut) strokeRope(g, r.chain.p, r.chain.n, 1, [cx, cy]);
  for (let i = 0; i < world.pins.length; i++) {
    const p = world.pins[i];
    if (p.track) drawKnob(g, p.x, p.y, dragging.size && [...dragging.values()].includes(i) ? 1 : 0);
    else drawPin(g, p.x, p.y);
  }
  // pop-ups that float the cookie, and the cookie
  world.popups.forEach((u, i) => { if (u.state === 'idle') drawPopup(g, u, t, false); });
  if (!c.gone) drawCookie(g, cx, cy, c.angle);
  world.popups.forEach((u, i) => {
    if (u.state === 'holding') drawPopup(g, u, t, true);
    else if (u.state === 'closed' && fx.pops[i] && fx.pops[i].close >= 0 && fx.pops[i].close < 1) drawPopup(g, u, t, false, fx.pops[i].close);
  });
  parts.draw(g);
  floats.draw(g);
  if (tabHeld && mode === 'play') drawNumbers(g);
  g.restore();
  g.restore();
}

function drawCookie(g, x, y, angle) {
  const sp = sprite;
  const sz = sp.size / view.dpr / lay.s;           // its size in page units
  g.save();
  g.translate(x, y);
  if (squash.k > 0.01 && !REDUCED) {
    const a = Math.atan2(squash.ny, squash.nx);
    g.rotate(a); g.scale(1 - squash.k * 0.22, 1 + squash.k * 0.14); g.rotate(-a);
  }
  g.rotate(angle);
  g.drawImage(sp.canvas, -sz / 2, -sz / 2, sz, sz);
  g.restore();
}

// holding Tab: every rope (then pop-up and fan) gets its number
function drawNumbers(g) {
  const list = actionables();
  list.forEach((a, i) => {
    let x, y;
    if (a.kind === 'cut') { const r = world.ropes[a.i], p = r.chain.p, k = (r.chain.n >> 1) * 4; x = p[k]; y = p[k + 1]; }
    else if (a.kind === 'pop') { x = world.popups[a.i].x + 40; y = world.popups[a.i].y - 40; }
    else { x = world.fans[a.i].x + 34; y = world.fans[a.i].y - 34; }
    g.beginPath(); g.arc(x, y, 15, 0, Math.PI * 2); g.fillStyle = C.ink; g.fill(); g.lineWidth = 3; g.strokeStyle = C.paper; g.stroke();
    g.fillStyle = C.paper; g.font = `800 17px ${FONT.mono}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(i + 1), x, y + 1);
  });
}

// the blade's trail (and the demo's ghost swipes)
function drawTrail(g) {
  const life = 0.2;
  while (trail.length && now - trail[0].t > life) trail.shift();
  if (demo && mode === 'demo') {
    for (let i = demo.ghosts.length - 1; i >= 0; i--) {
      const q = demo.ghosts[i];
      q.t += 1 / 60;
      const k = Math.min(1, q.t / q.dur);
      const x0 = lay.x + q.x0 * lay.s, y0 = lay.y + q.y0 * lay.s, x1 = lay.x + q.x1 * lay.s, y1 = lay.y + q.y1 * lay.s;
      bladeStroke(g, [[x0, y0], [x0 + (x1 - x0) * k, y0 + (y1 - y0) * k]], 1 - Math.max(0, q.t - q.dur) / 0.2);
      if (q.t > q.dur + 0.2) demo.ghosts.splice(i, 1);
    }
  }
  if (trail.length < 2) return;
  const byId = new Map();
  for (const p of trail) { if (!byId.has(p.id)) byId.set(p.id, []); byId.get(p.id).push([p.x, p.y, p.t]); }
  for (const pts of byId.values()) if (pts.length > 1) bladeStroke(g, pts, 1);
}
function bladeStroke(g, pts, a) {
  if (a <= 0) return;
  const n = pts.length;
  g.save(); g.globalAlpha = Math.max(0, Math.min(1, a)); g.lineCap = 'round'; g.lineJoin = 'round';
  for (let i = 1; i < n; i++) {
    const k = i / (n - 1);
    g.beginPath(); g.moveTo(pts[i - 1][0], pts[i - 1][1]); g.lineTo(pts[i][0], pts[i][1]);
    g.lineWidth = 2 + k * 7; g.strokeStyle = 'rgba(23,10,54,0.55)'; g.stroke();
    g.lineWidth = 1 + k * 4; g.strokeStyle = '#ffffff'; g.stroke();
  }
  const [hx, hy] = pts[n - 1];
  g.translate(hx, hy); g.rotate(now * 9);
  g.beginPath();
  for (let i = 0; i < 8; i++) { const r = i % 2 ? 2.5 : 8; const an = (i / 8) * Math.PI * 2; g[i ? 'lineTo' : 'moveTo'](Math.cos(an) * r, Math.sin(an) * r); }
  g.closePath(); g.fillStyle = C.honey; g.fill(); g.lineWidth = 1.5; g.strokeStyle = C.ink; g.stroke();
  g.restore();
}

// QA (`?qa`): a handle for the screenshot scripts; never on a link from the site
if (QUERY.has('qa')) {
  window.__ck = {
    get world() { return world; }, get mode() { return mode; }, get lay() { return lay; },
    start(id) { startLevel(levelById(id)); },
    startDef(def) { startLevel({ index: 0, site: 1, n: 1, sol: [], ...def }); },
    unlockAll() { store.update((s) => { s.levels ||= {}; for (const l of LEVELS) s.levels[l.id] ||= { stars: 1 + (l.index % 3) }; }); },
    select() { openSelect(); },
    // play a level's reference solution in real time
    auto(id) {
      startLevel(levelById(id));
      const acts = L.sol.slice();
      const t0 = world.tick;
      const iv = setInterval(() => {
        while (acts.length && acts[0][0] <= world.tick - t0) { world.apply(acts.shift().slice(1)); handle(world.drain()); }
        if (!acts.length || mode !== 'play') clearInterval(iv);
      }, 4);
    },
  };
}

// the canvas's words wait for the arcade's fonts (never longer than a moment)
const fonts = Promise.all(["900 40px 'AK Display'", "700 15px 'AK Mono'", "800 15px 'AK Sans'"].map((f) => document.fonts?.load(f).catch(() => null)));
Promise.race([fonts, new Promise((r) => setTimeout(r, 1800))]).then(() => {
  booted = true;
  if (DEMO) startDemo(0);
  else toTitle();
  loop.start();
});
