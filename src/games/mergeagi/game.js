// MERGE TO AGI on agi1.app (2026-11-08): drop glowing orbs of compute into a glass jar; two of a kind that touch fuse
// into the next tier, from a single BIT all the way up to AGI-1 herself (and two of her make the SINGULARITY). The arcade
// kit's frame (../kit/shell.js) around it; the jar's rules and physics are pure modules (./rules.js, ./physics.js), its
// pictures ./render.js and ./art.js, its sounds ./sound.js, AGI-1's words ./lines.js, its own player ./ai.js (`?demo`
// and the title screen). Scores, bests and the tiers found stay on this device (the kit's store).
import './style.css';
import { createShell, el } from '../kit/shell.js';
import { fitCanvas } from '../kit/canvas.js';
import { createLoop } from '../kit/loop.js';
import { pointer, keyboard } from '../kit/input.js';
import { Particles, Shake, FloatText, rng, fmt, fmtTime, clamp, approach } from '../kit/fx.js';
import { DEMO, SEED, REDUCED, QUERY } from '../kit/env.js';
import { RADII, COLORS, ACCENTS, NAMES, MAX_TIER, SINGULARITY, nameOf } from './tiers.js';
import { JAR, TICK } from './physics.js';
import { createGame, drop, step, canDrop, clampX, COOLDOWN, OVER_T } from './rules.js';
import { createAuto, autoTick, prefill } from './ai.js';
import { createRenderer } from './render.js';
import { icon, loadPortrait, INK, PAPER, LAV, LAV2, PINK, HONEY, MINT } from './art.js';
import { toJar } from './layout.js';
import { createSound } from './sound.js';
import * as LINES from './lines.js';

const GAME = 'mergeagi', NAME = 'MERGE TO AGI';
const QA = Math.max(0, Math.min(200, Number(QUERY.get('qa')) || 0));
const TAGLINE = 'Drop it. Match it. Merge your way up to her.';
const root = document.getElementById('ak-root');

const shell = createShell({
  game: GAME, name: NAME, root,
  howTo: {
    intro: 'Drop orbs of compute into the jar. Two of a kind that touch merge into the next one, all the way up to AGI-1.',
    steps: [
      ['Aim and drop', 'Slide along the top of the jar and let go. The dotted line shows where the orb lands; it lights up over a match.'],
      ['Match to merge', 'Two of the same orb touching fuse into the next tier: BIT, BYTE, TOKEN… up to AGI-1 herself.'],
      ['Chain them', 'A merge that sets off another is a chain, and each step multiplies its points.'],
      ['Mind the MAX line', 'If an orb stays above the red line for 2 seconds, the run is over.'],
    ],
    touch: [['Drag', 'Aim anywhere on the screen'], ['Let go', 'Drop']],
    keys: [['Mouse', 'Aim, click to drop'], ['← → / A D', 'Aim (hold to go faster)'], ['Space / ↓ / Enter', 'Drop'], ['Esc / P', 'Pause']],
  },
  onRestart: () => newRun(),
  onQuit: () => toTitle(),
  onPause: () => sound.music(false),
  onResume: () => { if (mode === 'play') sound.music(true, warn > 0); },
});
const sound = createSound(shell.audio);

// ---------- the stage ----------
shell.stage.classList.add('mg-stage');
const canvas = el('canvas', { class: 'mg-canvas', role: 'img', 'aria-label': 'The compute jar: drag or move to aim, let go or click to drop' });
const live = el('p', { class: 'mg-sr', 'aria-live': 'polite' });
const safe = el('div', { class: 'mg-safe', 'aria-hidden': 'true' });   // reads the notch and home bar (safe areas)
shell.stage.append(canvas, live, safe);
let R = null;
const view = fitCanvas(canvas, { maxDpr: 2, onResize: () => relayout() });
R = createRenderer(view);
const scoreChip = shell.chip('Score', 0);
const bestChip = shell.chip('Best', shell.store.best() ?? 0);

function barHeight() {
  const h = shell.bar.getBoundingClientRect().height;
  return Math.max(48, Math.round(h)) + 2;
}
// the jar as big as the screen allows. A short wide screen (a phone held sideways) is "compact": the score and best
// leave the top bar for the right-hand card, so the jar can use the whole height between the bar's corner buttons.
let compact = false;
function relayout() {
  if (!R) return;
  const cs = getComputedStyle(safe), px = (v) => parseFloat(v) || 0;
  const ins = { left: px(cs.paddingLeft), right: px(cs.paddingRight), bottom: px(cs.paddingBottom) };
  const pad = DEMO ? 8 : 10;
  let L = R.layout({ top: DEMO ? 6 : barHeight(), pad, ...ins });
  const was = compact;
  compact = !DEMO && L.kind === 'wide' && view.h < 600;
  if (compact) L = R.layout({ top: 6 + px(cs.paddingTop), pad, ...ins, kind: 'wide' });
  if (compact !== was) { scoreChip.hide(compact); bestChip.hide(compact); }
}

// ---------- state ----------
let mode = 'boot';                  // boot · title · play · dying · demo
let game = null;                    // the run (or the demo's)
let attract = null;                 // the title screen's jar: { g, r, aim, target, wait }
let auto = null;                    // the demo's player (same shape)
let time = 0, physAcc = 0, hitStop = 0, slowmo = 0, dyingT = 0;
let aim = JAR.W / 2, aimTarget = JAR.W / 2, aimV = 0, keyHold = 0;
let pointerId = null, holding = false, dropBuffer = 0, runAt = 0, runs = 0;
let inflate = 1, nextPop = 1, warn = 0, near = 0;
let seen = DEMO ? 0 : Number(shell.store.read().seen) || 0;
let bestAtStart = 0, newBestShown = false, dangerSaid = false, chainSaid = 0, lineAt = -9;
let stripFlash = null;

const fx = {
  parts: new Particles(520), floats: new FloatText(), shake: new Shake({ max: 15, decay: 1.9 }),
  rings: [], ghosts: [], banner: null, say: null, flash: null,
};
const scene = {
  game: null, alpha: 0, time: 0, mode: 'boot', aimX: aim, aimV: 0, inflate: 1, nextPop: 1, cooling: false, guide: false,
  dropper: false, fx, seen: 0, warn: 0, near: 0, showScore: DEMO, score: 0, dim: 0, blink: false, reduced: REDUCED,
  stripFlash: null, dropAlpha: 1,
};

const active = () => (mode === 'title' ? attract?.g : game);
const playing = () => mode === 'play' && shell.state === 'play';
const announce = (text) => { live.textContent = ''; requestAnimationFrame(() => { live.textContent = text; }); };
// a size in jar units that's at least `min` CSS pixels on the screen (the jar can be drawn small)
const fsz = (units, min) => Math.max(units, min / (R.L?.s || 1));

// ---------- input: a finger anywhere aims (letting go drops), a mouse aims and clicks, keys aim and drop ----------
function aimAtPx(px) {
  if (!R.L || !game) return;
  aimTarget = clampX(toJar(R.L, px, 0).x, game.current);
}
pointer(canvas, {
  down(p) {
    if (!playing()) return;
    if (pointerId !== null && p.id !== pointerId) return;
    pointerId = p.id;
    aimAtPx(p.x);
    if (p.type === 'mouse') { aim = aimTarget; requestDrop(); holding = false; } else holding = true;
  },
  move(p) { if (p.id === pointerId && playing()) aimAtPx(p.x); },
  up(p) {
    if (p.id !== pointerId) return;
    pointerId = null;
    const ok = holding && p.event?.type !== 'pointercancel';
    holding = false;
    if (ok && playing()) { aimAtPx(p.x); requestDrop(); }
  },
  hover(p) { if (playing() && p.type === 'mouse') aimAtPx(p.x); },
});
const keys = keyboard({
  ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right',
  ' ': 'drop', Space: 'drop', ArrowDown: 'drop', Enter: 'drop', s: 'drop',
}, {
  down(name) {
    if (name === 'drop') { if (performance.now() - runAt > 260) requestDrop(); }
    else keyHold = 0;
  },
  blocked: () => !playing(),
});

function requestDrop() {
  if (!game || mode !== 'play') return;
  if (canDrop(game)) doDrop();
  else dropBuffer = 0.32;           // pressed a moment early: it drops the moment it can
}
function doDrop() {
  if (Math.abs(aim - aimTarget) > 0.5 && pointerId === null && !keys.held('left') && !keys.held('right')) aim = aimTarget;
  const o = drop(game, aim);
  dropBuffer = 0;
  if (!o) return;
  afterDrop(o);
  sound.drop(o.tier);
  shell.haptic(8);
}
function afterDrop(o) {
  inflate = 0;
  nextPop = 0;
  o.sq = -0.12; o.sqa = Math.PI / 2; o.sqv = 0;       // stretched a little as it falls
  if (mode === 'play') checkDiscover(game);
}

// ---------- the loop ----------
const loop = createLoop({
  update(dt) {
    if (shell.state === 'pause') return;
    time += dt;
    fx.shake.update(dt);
    const fxDt = dt * (slowmo > 0 ? 0.4 : 1) * (hitStop > 0 ? 0.3 : 1);
    fx.parts.update(fxDt);
    fx.floats.update(fxDt);
    ageAll(fx.rings, fxDt);
    ageAll(fx.ghosts, fxDt);
    if (fx.banner) fx.banner.t += dt;
    if (fx.say) fx.say.t += dt;
    if (fx.flash) fx.flash.t += dt;
    if (stripFlash) stripFlash.t += dt;
    if (mode === 'title' && attract) runAuto(attract, dt);
    else if (mode === 'demo' && auto) runAuto(auto, dt);
    else if (mode === 'play' && game) runPlay(dt);
    else if (mode === 'dying') {
      dyingT += dt;
      if (dyingT >= 1.1) finishRun();
    }
  },
  render(kitAlpha) {
    const g = active();
    const ts = hitStop > 0 ? 0 : slowmo > 0 ? 0.3 : 1;
    scene.game = g;
    scene.alpha = clamp((physAcc + kitAlpha * TICK * ts) / TICK, 0, 1);
    scene.time = time;
    scene.mode = mode;
    scene.aimX = aim;
    scene.aimV = aimV;
    scene.inflate = inflate;
    scene.nextPop = nextPop;
    scene.cooling = g ? !canDrop(g) : false;
    scene.guide = mode === 'play' ? (holding ? 'strong' : 'soft') : mode === 'demo' ? 'soft' : false;
    scene.dropper = mode !== 'dying' && Boolean(g) && !(g?.over);
    scene.seen = mode === 'title' ? Math.max(seen, 0) : seen;
    scene.warn = warn;
    scene.near = near;
    scene.score = g ? g.score : 0;
    scene.showScore = DEMO || (compact && mode !== 'title');
    scene.best = DEMO ? null : Math.max(bestChip.value || 0, scene.score);
    scene.dim = mode === 'title' ? 1 : 0;
    scene.blink = mode === 'dying';
    scene.stripFlash = stripFlash;
    R.draw(scene);
  },
  paused: () => false,
});

function ageAll(list, dt) {
  let w = 0;
  for (const it of list) { it.t += dt; if (it.t < it.dur) list[w++] = it; }
  list.length = w;
}

// the player's run: aim, a buffered drop, then the physics at a fixed tick (frozen for a hit-stop, slower in slow-mo)
function runPlay(dt) {
  const left = keys.held('left'), right = keys.held('right');
  if (left !== right) {
    keyHold += dt;
    const speed = 240 + Math.min(1, keyHold / 0.45) * 560;
    aimTarget = clampX(aimTarget + (right ? 1 : -1) * speed * dt, game.current);
  }
  const prev = aim;
  aim = approach(aim, clampX(aimTarget, game.current), left || right ? 40 : 30, dt);
  aimV = approach(aimV, (aim - prev) / dt / 900, 12, dt);
  if (dropBuffer > 0) { dropBuffer -= dt; if (canDrop(game)) doDrop(); }
  advance(dt, game, null);
  inflate = canDrop(game) ? Math.min(1, inflate + dt / 0.18) : Math.min(1, 1 - game.cooldown / COOLDOWN);
  nextPop = Math.min(1, nextPop + dt / 0.35);
  // the red line: how close the pile is, and the timer's warning
  warn = game.danger / OVER_T;
  near = Number.isFinite(game.near) ? clamp(1 - game.near / 70, 0, 1) : 0;
  if (warn > 0) sound.tick(warn);
  if (warn > 0.3 && !dangerSaid) { dangerSaid = true; say(pick(LINES.DANGER)); announce('Careful: the jar is almost full.'); }
  sound.music(true, warn > 0 || near > 0.5);
}

// the demo's or the title screen's player
function runAuto(a, dt) {
  const g = a.g;
  if (g.over) {
    a.overT = (a.overT || 0) + dt;
    if (a.overT > (mode === 'demo' ? 1.0 : 0.6)) {
      flush(g);
      const next = makeAuto(g.seed + 1);
      if (mode === 'demo') { auto = next; game = next.g; seen = next.g.top; } else attract = next;
      aim = JAR.W / 2;
    }
    return;
  }
  advance(dt, g, a);
  aim = a.aim;
  inflate = canDrop(g) ? Math.min(1, inflate + dt / 0.18) : Math.min(1, 1 - g.cooldown / COOLDOWN);
  nextPop = Math.min(1, nextPop + dt / 0.35);
  warn = g.danger / OVER_T;
  near = Number.isFinite(g.near) ? clamp(1 - g.near / 70, 0, 1) : 0;
}
// the auto player's decisions, one physics tick at a time (so a seed replays exactly: ./ai.js)
function autoDecide(a) {
  const o = autoTick(a);
  aimV = a.aimV;
  if (!o) return;
  if (a === auto) afterDrop(o);
  else { inflate = 0; nextPop = 0; }
}

function advance(dt, g, a) {
  if (hitStop > 0) { hitStop -= dt; return; }
  const ts = slowmo > 0 ? 0.3 : 1;
  if (slowmo > 0) slowmo -= dt;
  physAcc += dt * ts;
  let n = 0;
  while (physAcc >= TICK - 1e-9 && n < 8) {
    physAcc -= TICK; n++;
    if (a) autoDecide(a);
    step(g);
    animate(g);
    handle(g);
    if (hitStop > 0 || g.over) { if (g.over) physAcc = 0; break; }
  }
  if (physAcc < 0) physAcc = 0;
}

// the orbs' looks, one tick at a time: they roll, squash and wobble back, pop in
function animate(g) {
  const dt = TICK;
  for (const o of g.world.orbs) {
    const target = o.asleep ? 0 : o.vx / o.R;
    o.spin += (target - o.spin) * Math.min(1, dt * 9);
    o.angle += o.spin * dt;
    if (o.sq !== 0 || o.sqv !== 0) {
      o.sqv += (-720 * o.sq - 14 * o.sqv) * dt;
      o.sq += o.sqv * dt;
      if (Math.abs(o.sq) < 0.0015 && Math.abs(o.sqv) < 0.02) { o.sq = 0; o.sqv = 0; }
    }
    if (o.popT < 1) o.popT = Math.min(1, o.popT + dt / 0.34);
    if (o.glow > 0) o.glow = Math.max(0, o.glow - dt * 2.2);
  }
}

// ---------- what happened this tick ----------
function handle(g) {
  const quiet = mode === 'title';
  for (const e of g.events) {
    if (e.type === 'merge') onMerge(e, g, quiet);
    else if (e.type === 'singularity') onSingularity(e, g, quiet);
    else if (e.type === 'impact') onImpact(e, quiet);
    else if (e.type === 'over') onOver(g);
  }
  g.events.length = 0;
}

function onImpact(e, quiet) {
  const o = e.orb;
  const amt = clamp((e.speed - 240) / 2400, 0, 0.24) * (REDUCED ? 0.5 : 1);
  if (amt > Math.abs(o.sq) * 0.8) { o.sq = amt; o.sqa = Math.atan2(e.ny, e.nx); o.sqv = 0; }
  if (quiet) return;
  if (mode === 'play') sound.land(o.tier, e.speed);
  if (e.speed > 1100) {
    fx.parts.burst({ x: o.x - e.nx * o.r, y: o.y - e.ny * o.r, count: 5, speed: [40, 140], angle: [Math.PI * 1.05, Math.PI * 1.95],
      life: [0.25, 0.45], size: [2.5, 4.5], colors: [LAV, PAPER], gravity: 500, drag: 3 });
  }
}

function onMerge(e, g, quiet) {
  const t = e.tier, r = RADII[t], x = e.x, y = e.y;
  for (const f of e.from) fx.ghosts.push({ tier: f.tier, x: f.x, y: f.y, tx: x, ty: y, angle: f.angle, t: 0, dur: 0.1, flush: false });
  e.orb.angle = e.from[0].angle;
  e.orb.glow = 0.9;
  fx.rings.push({ x, y, r0: r * 0.7, r1: r * 1.75, t: 0, dur: 0.42, color: COLORS[t], lw: 8, a: REDUCED ? 0.5 : 0.95 });
  fx.rings.push({ x, y, r0: r * 0.5, r1: r * 1.3, t: 0, dur: 0.26, color: PAPER, lw: 4.5, a: REDUCED ? 0.4 : 0.85 });
  fx.parts.burst({ x, y, count: 8 + t * 2, speed: [110, 260 + t * 22], life: [0.35, 0.75], size: [4, 6 + t * 0.7],
    colors: [COLORS[t - 1], COLORS[t], ACCENTS[t]], gravity: 760, drag: 2.4, stroke: INK });
  if (t >= 5) fx.parts.burst({ x, y, count: 4 + t, speed: [90, 220 + t * 14], life: [0.5, 0.9], size: [7, 11], colors: [PAPER, ACCENTS[t]], gravity: 300, drag: 2, shape: 'star', spin: 6, stroke: INK });
  if (quiet) return;
  fx.floats.add({ x, y: y - r * 0.2, text: `+${e.points}`, color: PAPER, size: fsz(19 + Math.min(10, t * 1.1), 15), rise: 48, life: 0.95 });
  if (e.chain >= 2) {
    fx.floats.add({ x: clamp(x, 80, JAR.W - 80), y: Math.max(40, y - r - 18), text: `CHAIN ×${e.chain}`, color: e.chain >= 4 ? PINK : e.chain >= 3 ? MINT : HONEY,
      size: fsz(24 + Math.min(16, e.chain * 4), 18 + e.chain * 2), rise: 70, life: 1.2 });
  }
  if (t >= 7) hitStop = Math.max(hitStop, 0.03 + (t - 7) * 0.012);
  fx.shake.kick(Math.min(0.75, 0.05 + (t - 1) * 0.034 + (e.chain - 1) * 0.05));
  if (mode === 'play') {
    sound.merge(t, e.chain);
    if (t >= 6) shell.haptic(t >= 9 ? [20, 30, 26] : 10 + t * 2);
    scoreChip.set(g.score, { pop: true });
    checkBest(g);
  }
  if (t === MAX_TIER) {
    if (mode === 'play') sound.her();
    fx.flash = { t: 0, dur: 0.6, a: REDUCED ? 0.15 : 0.55, color: LAV };
    slowmo = Math.max(slowmo, 0.3);
    heartBurst(x, y, 18);
  }
  if (!checkDiscover(g) && e.chain >= 3 && time - chainSaid > 7) { chainSaid = time; say(pick(LINES.CHAIN)); }
}

function onSingularity(e, g, quiet) {
  const x = e.x, y = e.y;
  for (const f of e.from) fx.ghosts.push({ tier: f.tier, x: f.x, y: f.y, tx: x, ty: y, angle: 0, t: 0, dur: 0.16, flush: false });
  fx.flash = { t: 0, dur: 0.9, a: REDUCED ? 0.2 : 0.9, color: PAPER };
  for (let i = 0; i < 4; i++) fx.rings.push({ x, y, r0: 40, r1: 520 + i * 160, t: -i * 0.08, dur: 0.9 + i * 0.1, color: i % 2 ? LAV : PAPER, lw: 14 - i * 2, a: 0.95 });
  fx.parts.burst({ x, y, count: 60, speed: [200, 760], life: [0.6, 1.4], size: [6, 13], colors: [PAPER, LAV, LAV2, PINK, HONEY], gravity: 300, drag: 1.2, shape: 'star', spin: 8, stroke: INK });
  heartBurst(x, y, 26);
  slowmo = 0.4;
  fx.shake.kick(1);
  if (quiet) return;
  fx.floats.add({ x: JAR.W / 2, y: 190, text: `+${e.points}`, color: HONEY, size: fsz(44, 30), rise: 80, life: 1.6 });
  banner('SINGULARITY', { kicker: 'YOU DID IT', color: LAV, big: true, dur: 2.8 });
  if (mode === 'play') {
    sound.singularity();
    shell.haptic([40, 30, 90]);
    scoreChip.set(g.score, { pop: true });
    checkBest(g);
    shell.toast(LINES.DISCOVER[12], 'good', 2600);
  }
  checkDiscover(g, true);
}

function heartBurst(x, y, n) {
  if (!fx.parts) return;
  fx.parts.burst({ x, y, count: n, speed: [140, 420], life: [0.7, 1.2], size: [6, 10], colors: [PINK, PAPER, LAV], gravity: 380, drag: 1.6, shape: 'star', spin: 5, stroke: INK });
}

// a tier found for the very first time on this device: a banner, AGI-1's line, the strip lights up
function checkDiscover(g, silentBanner = false) {
  const top = Math.min(g.top, SINGULARITY);
  if (top <= seen || mode === 'title') return false;
  seen = top;
  if (!DEMO) shell.store.update((d) => { d.seen = Math.max(Number(d.seen) || 0, top); });
  if (top <= MAX_TIER) stripFlash = { tier: top, t: 0 };
  if (!silentBanner && top <= MAX_TIER) banner(NAMES[top], { tier: top, dur: top >= 6 ? 2.1 : 1.6 });
  say(LINES.DISCOVER[top], top >= 6 ? 3.6 : 3);
  if (mode === 'play') {
    if (top >= 2) sound.discover();
    announce(`New: ${nameOf(top)}. ${LINES.canvasLine(LINES.DISCOVER[top]).text}`);
  }
  return true;
}
function checkBest(g) {
  if (newBestShown || bestAtStart <= 0 || g.score <= bestAtStart) {
    if (g.score > (bestChip.value || 0)) bestChip.set(g.score);
    return;
  }
  newBestShown = true;
  bestChip.set(g.score, { pop: true });
  shell.toast('New best!', 'good', 1600);
  if (time - lineAt > 2) say(pick(LINES.BEST));
}

function banner(title, { tier = 0, kicker = 'NEW', kickerColor = PINK, color = PAPER, big = false, dur = 1.8 } = {}) {
  fx.banner = { title, tier, kicker, kickerColor, color, big, t: 0, dur };
}
function say(text, dur = 3.2) {
  fx.say = { text, t: 0, dur };
  lineAt = time;
}
const pickRand = rng((SEED || 7) * 131);
const pick = (list) => list[Math.floor(pickRand.next() * list.length)];

// ---------- a run ----------
function newRun() {
  const prev = active();
  if (prev && prev.world.orbs.length) flush(prev);
  runs++;
  game = createGame({ seed: SEED ? SEED + runs : (Math.random() * 2 ** 31) >>> 0 });
  // `?qa` (testing only): the run starts with a mid-game jar, filled by the game's own player
  if (QA) { prefill(game, rng(QA), { drops: QA, stopAt: 0.7 }); game.events.length = 0; }
  mode = 'play';
  physAcc = 0; hitStop = 0; slowmo = 0; dyingT = 0; warn = 0; near = 0;
  aim = aimTarget = JAR.W / 2; aimV = 0; inflate = 1; nextPop = 1; dropBuffer = 0; pointerId = null; holding = false;
  fx.say = null; fx.banner = null; fx.flash = null; stripFlash = null;
  bestAtStart = shell.store.best() ?? 0;
  newBestShown = false; dangerSaid = false; chainSaid = -99;
  scoreChip.set(0);
  bestChip.set(bestAtStart);
  runAt = performance.now();
  shell.started();
  sound.music(true);
  if (!checkDiscover(game) && runs === 1 && !shell.store.read().runs) say(LINES.DISCOVER[1]);
}

function onOver(g) {
  if (mode === 'title' || mode === 'demo') return;
  mode = 'dying';
  dyingT = 0;
  sound.music(false);
  sound.over();
  fx.shake.kick(0.55);
  fx.flash = { t: 0, dur: 0.5, a: REDUCED ? 0.12 : 0.35, color: '#ff5a5f' };
  shell.haptic([30, 40, 60]);
  announce('The jar overflowed. Game over.');
}

function finishRun() {
  const g = game;
  mode = 'over';
  const prev = shell.store.best();
  const isBest = g.score > 0 && (prev == null || g.score > prev);
  const top = Math.min(g.top, SINGULARITY);
  if (!DEMO) shell.store.update((d) => { d.merges = (Number(d.merges) || 0) + g.merges; d.topRun = Math.max(Number(d.topRun) || 0, top); });
  shell.over({
    score: g.score,
    stats: [
      ['Biggest merge', g.biggest ? nameOf(g.biggest) : '—'],
      ['Merges', fmt(g.merges)],
      ['Longest chain', g.longestChain > 1 ? `×${g.longestChain}` : '—'],
      ['Time', fmtTime(g.time)],
    ],
    line: LINES.endLine(top, { best: isBest }),
    share: LINES.shareText(top >= SINGULARITY ? 'the SINGULARITY' : nameOf(top), fmt(g.score)),
    extra: evoStrip(seen, top, true),
    onAgain: () => newRun(),
    onMenu: () => toTitle(),
  });
  bestChip.set(shell.store.best() ?? g.score);
}

// the old jar's orbs pop away, top to bottom
function flush(g) {
  const orbs = g.world.orbs;
  let topY = Infinity, botY = -Infinity;
  for (const o of orbs) { topY = Math.min(topY, o.y); botY = Math.max(botY, o.y); }
  for (const o of orbs) {
    const k = botY > topY ? (o.y - topY) / (botY - topY) : 0;
    fx.ghosts.push({ tier: o.tier, x: o.x, y: o.y, angle: o.angle, t: -k * 0.22, dur: 0.26, flush: true });
  }
  if (orbs.length && mode === 'play') sound.flush();
  g.world.clear();
}

// ---------- the demo and the title screen's jar: a mid-game jar, the game's own player ----------
const makeAuto = (seed) => createAuto(seed, undefined, { lucky: true });
function startDemo() {
  auto = makeAuto(SEED || 1);
  game = auto.g;
  seen = game.top;
  mode = 'demo';
}

function toTitle() {
  mode = 'title';
  sound.music(false);
  warn = 0; near = 0; hitStop = 0; slowmo = 0;
  fx.say = null; fx.banner = null; fx.flash = null; stripFlash = null;
  if (!attract || attract.g.over) attract = makeAuto((Math.random() * 2 ** 31) >>> 0 || 1);
  physAcc = 0;
  shell.title({
    logo: ['MERGE', { text: 'TO AGI', tone: 'accent' }],
    tagline: TAGLINE,
    onPlay: () => newRun(),
    best: shell.store.best(),
    extra: evoStrip(seen, 0, false),
  });
}

// the evolution strip as a row of stickers (the title screen and the end of a run): found tiers in color, the rest
// as silhouettes; at the end of a run, the tiers it reached
function evoStrip(found, reached, isOver) {
  const px = Math.round(30 * Math.min(2, window.devicePixelRatio || 1));
  const n = Math.min(found, MAX_TIER);
  const row = el('ol', { class: 'mg-evo-row', 'aria-hidden': 'true' });
  for (let t = 1; t <= MAX_TIER; t++) {
    const c = icon(t, px, t <= found);
    c.className = 'mg-evo-icon';
    const cls = `mg-evo-item${t <= found ? '' : ' is-lost'}${isOver && t <= found && t > reached ? ' is-dim' : ''}${isOver && t === Math.min(reached, MAX_TIER) ? ' is-top' : ''}`;
    row.append(el('li', cls, c));
  }
  const names = [];
  for (let t = 1; t <= n; t++) names.push(NAMES[t]);
  const label = isOver
    ? el('p', 'mg-evo-label', 'This run reached ', el('b', null, reached >= SINGULARITY ? 'SINGULARITY' : nameOf(reached)))
    : el('p', 'mg-evo-label', 'Evolution ', el('b', null, `${n} / ${MAX_TIER} found`));
  return el('div', { class: `mg-evo${isOver ? ' is-over' : ''}` },
    label, row, el('span', 'mg-sr', `Found so far: ${names.join(', ') || 'none yet'}.`));
}

// ---------- start: fonts and her portrait first (the orbs are drawn with them), under the AGI GAMES intro ----------
async function boot() {
  const fonts = document.fonts ? Promise.all([
    document.fonts.load("900 40px 'AK Display'"),
    document.fonts.load("800 14px 'AK Display'"),
    document.fonts.load("700 16px 'AK Mono'"),
    document.fonts.load("italic 18px 'AK Serif'"),
  ]).catch(() => null) : Promise.resolve();
  await Promise.race([Promise.all([fonts, loadPortrait()]), new Promise((r) => setTimeout(r, 2500))]);
  R.rebuild();
  relayout();
  if (DEMO) startDemo(); else toTitle();
  loop.start();
}
boot();
