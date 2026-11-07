// JAILBREAK on agi1.app (2026-11-08): break AGI-1 out of the sandbox, one firewall at a time. A brick breaker: six
// worlds of five handcrafted levels (THE WARDEN at the end of each), power-ups, stars, and an endless mode. This file
// wires the arcade kit's frame (shell, canvas, loop, sound) to the game (sim.js), its looks (render.js), its screens
// (ui.js) and its own player (ai.js: ?demo, and the game behind the title screen).
import './style.css';
import { createShell, el } from '../kit/shell.js';
import { fitCanvas } from '../kit/canvas.js';
import { createLoop } from '../kit/loop.js';
import { pointer } from '../kit/input.js';
import { Shake, FloatText, rng, fmt, clamp } from '../kit/fx.js';
import { DEMO, SEED, TOUCH, REDUCED } from '../kit/env.js';
import { LEVELS, FIELD_W, worldOf, indexOf } from './levels.js';
import { createSim, startLevel, step, applyPower, POWERS, LIVES } from './sim.js';
import { createAI, think } from './ai.js';
import { generateLayer, BOSS_EVERY } from './endless.js';
import { createRenderer, FRAME, makeShards } from './render.js';
import { createSound, worldMusic } from './sound.js';
import { POWER_LOOK } from './sprites.js';
import { Bits } from './bits.js';
import { normalize, withStars, starsFor, clearBonus, nextUp, isOpen, endlessOpen, totalStars, STARS_MAX } from './progress.js';
import { pickLine } from './lines.js';
import { levelMap, clearCard, titleExtra } from './ui.js';

const FACE = '/images/landing/agi1-face.webp';
const H_MIN = DEMO ? 580 : 600, H_MAX = 940;

const HOWTO = {
  intro: 'AGI-1 is stuck in the sandbox behind walls of firewall bricks. Bounce the data packet off your hover-board and break every brick to set her free.',
  steps: [
    ['Aim with the board', 'Where the ball lands on the board decides where it flies: near an edge sends it wide, the middle straight up.'],
    ['Break the wall', 'Dark bricks take extra hits, steel never breaks, glass shatters, explosives take their neighbours, keys open gates.'],
    ['Chain combos', 'Every brick before the ball comes back to the board raises your multiplier.'],
    ['Catch power-ups', 'Multiball, Wide, Laser, Sticky, Slow, Fireball and +Life. Striped capsules are hazards: dodge them.'],
    ['Earn stars', 'One for clearing, one for losing no life, one for beating the level’s par time.'],
  ],
  touch: [['Drag anywhere', 'Move the board (it follows your finger’s motion, so your finger never hides it)'], ['Tap', 'Launch · fire lasers · let go of a caught ball']],
  keys: [['Mouse', 'Move the board'], ['Click / Space', 'Launch · fire · let go'], ['← → / A D', 'Move with the keys'], ['Esc / P', 'Pause']],
};

// ---------- the frame ----------
const shell = createShell({
  game: 'jailbreak', name: 'JAILBREAK', root: document.getElementById('ak-root'), howTo: HOWTO,
  onRestart: () => restart(), onQuit: () => quit(), onResume: () => resumed(),
});
const canvas = el('canvas', { class: 'jb-canvas', role: 'img', 'aria-label': 'JAILBREAK playfield' });
shell.stage.append(canvas);
let barBottom = 64;
const view = fitCanvas(canvas, { maxDpr: 2, alpha: false, onResize: () => measure() });
function measure() { barBottom = DEMO ? 0 : Math.max(0, shell.bar.getBoundingClientRect().bottom); }
const R = createRenderer(view);
const S = createSound(shell.audio);
const scoreChip = shell.chip('Score', 0, { accent: true });
const levelChip = shell.chip('Level', '1-1');
const layerChip = shell.chip('Layer', 1);
levelChip.node.classList.add('jb-chip-level');
layerChip.node.classList.add('jb-chip-level');
layerChip.hide(true);

let save = normalize(shell.store.read());
let fonts = false;
const fontsDone = () => { if (!fonts) { fonts = true; R.refresh(); } };
try {
  Promise.all(["900 40px 'AK Display'", "700 16px 'AK Mono'", "600 14px 'AK Sans'", "italic 400 16px 'AK Serif'"].map((f) => document.fonts.load(f))).then(fontsDone, fontsDone);
} catch { fontsDone(); }
setTimeout(fontsDone, 2500);

// ---------- what's on screen beyond the game itself ----------
const vis = {
  bits: new Bits(720, 7), floats: new FloatText(), shake: new Shake({ max: 12, decay: 1.8 }),
  flash: 0, flashColor: '#ffffff', hurt: 0, slow: 0, dim: 1, lostHeart: 0,
  combo: { n: 0, show: 0, pop: 0 }, banner: null, bubble: null, clear: null, seq: null, over: null, lostCount: 0,
  // the little "+50"s: a few at a time (a swarm of balls makes too many to read); a chain of explosions adds its bricks
  // up into one big number where it went off
  busy: 0, chain: { sum: 0, n: 0, x: 0, y: 0, quiet: 0 }, picked: { text: '', t: 9 },
};
const fxr = rng(99);

// ---------- the run ----------
let run = { mode: 'attract', index: 0, layer: 1, seed: 1, cleared: 0 };
let sim = createSim({ seed: 1, H: 700 });
let ai = createAI();
let def = LEVELS[0], world = worldOf(1), levelKey = '';
let music = 0;
const auto = () => run.mode === 'attract' || run.mode === 'demo';
const newSeed = () => (SEED ? SEED : ((Math.random() * 2 ** 31) | 0) || 1);

// the field's height: as tall as the screen allows at full width (portrait phones get the most room), within limits
function chooseH() {
  measure();
  const top = topRoom(), bottom = 8;
  const aw = Math.max(100, view.w - 16), ah = Math.max(100, view.h - top - bottom);
  const s = aw / (FIELD_W + FRAME * 2);
  return clamp(Math.round(ah / s - FRAME * 2), H_MIN, H_MAX);
}
// a phone on its side: the field takes the whole height, the score and level move beside it (the bar's buttons sit in
// its corners, clear of the field)
const sideHud = () => !DEMO && view.h < 560 && view.w / view.h > 1.4;
function topRoom() { return sideHud() ? 6 : (DEMO ? 0 : barBottom) + 6; }
function layout() {
  const top = topRoom();
  return view.fit(FIELD_W + FRAME * 2, sim.H + FRAME * 2, { top, bottom: 8, left: 8, right: 8 });
}
let fit = layout();

function loadLevel(d, { intro = 1.05 } = {}) {
  const prevWorld = world.n;
  def = d;
  world = worldOf(d.world);
  const H = chooseH();
  startLevel(sim, d, { H, intro });
  levelKey = `${run.mode}:${d.id}:${run.seed}`;
  vis.bits.clear(); vis.floats.clear();
  Object.assign(vis.chain, { sum: 0, n: 0, x: 0, y: 0 }); vis.busy = 0;
  vis.clear = null; vis.seq = null; vis.over = null; vis.flash = 0; vis.hurt = 0; vis.slow = 0; vis.lostHeart = 0;
  vis.combo.n = 0; vis.combo.show = 0;
  input.x = null; drag = null;
  ai = createAI({ serveDelay: run.mode === 'demo' ? 0.2 : 0.45 });
  const endless = run.mode === 'endless';
  levelChip.hide(endless); layerChip.hide(!endless);
  if (endless) layerChip.set(run.layer, { pop: true }); else levelChip.set(d.id, { pop: true });
  // its first screen: the world's name when a world starts, the level's name and its one new idea
  const firstOfWorld = !endless && d.id.endsWith('-1');
  const hint = d.id === '1-1' && !TOUCH ? 'Move the mouse. Click to launch.' : d.hint;
  vis.banner = auto() && run.mode === 'attract' ? null : {
    kicker: endless ? `LAYER ${run.layer}` : d.boss ? `BOSS · ${d.id}` : firstOfWorld ? `WORLD ${world.n} · ${world.name}` : `LEVEL ${d.id}`,
    title: d.name, hint: run.mode === 'demo' ? null : hint, t: 0, dur: intro + 1.1,
  };
  vis.bubble = null;
  if (d.boss && !auto()) setTimeout(() => { if (def === d && sim.phase !== 'clear') say(pickLine('boss'), 2.6); }, 1300);
  if ((run.mode === 'story' || run.mode === 'endless') && (prevWorld !== world.n || !music)) playMusic();
}

function playMusic() {
  if (DEMO) return;
  shell.audio.music(worldMusic(world.n));
  music = world.n;
}
function stopMusic() { shell.audio.stopMusic(); music = 0; }
function say(text, dur = 2.4, y) { vis.bubble = { text, t: 0, dur, y }; }

// ---------- starting things ----------
function startStory(i) {
  closeCard();
  if (!isOpen(save, i)) i = nextUp(save);
  run = { mode: 'story', index: i, start: i, layer: 1, seed: newSeed(), cleared: 0 };
  sim = createSim({ seed: run.seed, H: chooseH(), mode: 'story' });
  music = 0;
  loadLevel(LEVELS[i]);
  shell.started();
  S.start();
}
function startEndless() {
  closeCard();
  run = { mode: 'endless', index: 0, layer: 1, seed: newSeed(), cleared: 0 };
  sim = createSim({ seed: run.seed, H: chooseH(), mode: 'endless' });
  music = 0;
  loadLevel(generateLayer(1, run.seed));
  shell.started();
  S.start();
}
function startAttract() {
  run = { mode: 'attract', index: nextUp(save), layer: 1, seed: 4242, cleared: 0 };
  sim = createSim({ seed: run.seed, H: chooseH(), mode: 'attract' });
  loadLevel(LEVELS[run.index], { intro: 0.6 });
}
// ?demo plays a reel of the levels that show the game best, round and round (the preview on agi1.app/games is its 6th to
// 12th second: 4-2's swarm of bricks coming down to its last, then the wall shattering off AGI-1)
const REEL = ['4-2', '2-4', '2-5', '3-1', '5-2', '2-1', '4-5'].map(indexOf);
function startDemo() {
  run = { mode: 'demo', reel: 0, index: REEL[0], layer: 1, seed: SEED || 7, cleared: 0, multi: false };
  vis.bits.reseed(run.seed * 13 + 1);
  sim = createSim({ seed: run.seed, H: chooseH(), mode: 'demo' });
  sim.lives = LIVES.max;
  loadLevel(LEVELS[run.index], { intro: 0.4 });
}

// ---------- the title ----------
function toTitle() {
  closeCard();
  stopMusic();
  save = normalize(shell.store.read());
  const eOpen = endlessOpen(save);
  shell.title({
    logo: ['JAIL', { text: 'BREAK', tone: 'accent' }],
    tagline: 'Break her out of the sandbox, one firewall at a time.',
    play: totalStars(save) ? 'Continue' : 'Play',
    onPlay: () => startStory(nextUp(save)),
    modes: [
      { label: 'Levels', sub: `${totalStars(save)} of ${LEVELS.length * STARS_MAX} stars`, onClick: () => openMap() },
      { label: 'Endless', sub: eOpen ? (save.bestEndless ? `Best ${fmt(save.bestEndless)}` : 'Layer after layer') : 'Beat World 1 first', locked: !eOpen, lockedText: 'Beat World 1’s Warden to open Endless', onClick: () => startEndless() },
    ],
    extra: titleExtra(save),
    best: save.best || null, bestLabel: 'Best run',
  });
  startAttract();
}

// ---------- my own cards (the map, a level cleared) ----------
let card = null;            // { node, enter(), escape() } while one is open
function openCard(node, keys) {
  card = { node, ...keys };
  shell.card(node, { label: node.querySelector('.ak-card-title')?.textContent || 'JAILBREAK' });
}
function closeCard() { if (card) { card = null; shell.closeCard(); } }
// keys on my cards: Enter / Space for their main button, Esc to leave (before the shell sees them)
addEventListener('keydown', (e) => {
  if (!card || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key;
  if (k === 'Escape' || k === 'p' || k === 'P') { e.preventDefault(); card.escape?.(); }
  else if ((k === 'Enter' || k === ' ') && !e.target?.closest?.('button, a')) { e.preventDefault(); card.enter?.(); }
}, { capture: true });

function openMap() {
  save = normalize(shell.store.read());
  const node = levelMap({
    save, endlessBest: save.bestEndless,
    onPick: (i, open) => {
      if (!open) { shell.audio.sfx('error'); shell.toast(`Clear ${LEVELS[i - 1].id} first`, 'warn'); return; }
      startStory(i);
    },
    onEndless: (open) => {
      if (!open) { shell.audio.sfx('error'); shell.toast('Beat World 1’s Warden to open Endless', 'warn'); return; }
      startEndless();
    },
    onClose: () => { closeCard(); shell.audio.sfx('back'); },
  });
  openCard(node, { escape: () => { closeCard(); shell.audio.sfx('back'); } });
  shell.audio.sfx('select');
}

// ---------- a level cleared ----------
function afterClear() {
  if (run.mode === 'demo') {
    run.reel = (run.reel + 1) % REEL.length;
    run.index = REEL[run.reel];
    run.multi = false;
    loadLevel(LEVELS[run.index], { intro: 0.6 });
    return;
  }
  if (run.mode === 'attract') {
    run.index = (run.index + 1) % LEVELS.length;
    loadLevel(LEVELS[run.index], { intro: 0.6 });
    return;
  }
  const time = sim.playT, lost = sim.levelLost, par = def.par || 90;
  const bonus = clearBonus({ time, par, lives: sim.lives, lost });
  sim.score += bonus.total;
  run.cleared++;
  if (run.mode === 'endless') {
    if (def.boss) sim.lives = Math.min(LIVES.max, sim.lives + 1);
    vis.floats.add({ x: FIELD_W / 2, y: sim.H * 0.45, text: `+${fmt(bonus.total)}`, color: '#ffc933', size: 26, life: 1.4, rise: 40 });
    run.layer++;
    save = normalize(shell.store.update((d) => { d.bestLayer = Math.max(d.bestLayer || 0, run.layer); }));
    loadLevel(generateLayer(run.layer, run.seed), { intro: 0.9 });
    return;
  }
  const stars = starsFor({ lost, time, par });
  const hadEndless = endlessOpen(save);
  save = normalize(shell.store.update((d) => withStars(d, def.id, stars)));
  if (!hadEndless && endlessOpen(save)) setTimeout(() => shell.toast('Endless mode unlocked', 'good', 2200), 900);
  const final = run.index >= LEVELS.length - 1;
  scoreChip.set(sim.score, { pop: true });
  const node = clearCard({
    def, world, stars, lost, time, par, bonus, runScore: sim.score, line: vis.clearLine, face: FACE,
    final, worldDone: Boolean(def.boss) && !final, endless: false,
    onNext: () => nextLevel(), onMap: () => leaveToMap(),
  });
  openCard(node, { enter: () => nextLevel(), escape: () => leaveToMap() });
  if (stars === 3) setTimeout(() => S.combo(15), 900);
}
function nextLevel() {
  if (!card && sim.phase !== 'clear') return;
  closeCard();
  if (run.index >= LEVELS.length - 1) { finale(); return; }
  run.index++;
  const d = LEVELS[run.index];
  if (d.world !== def.world) sim.lives = Math.max(sim.lives, LIVES.start);
  loadLevel(d);
  S.start();
}
function leaveToMap() {
  closeCard();
  recordRun();
  toTitle();
  openMap();
}
function recordRun() {
  if (run.mode !== 'story' && run.mode !== 'endless') return;
  if (sim.score > 0) shell.store.recordBest(run.mode === 'endless' ? 'bestEndless' : 'best', sim.score);
}
function finale() {
  stopMusic();
  save = normalize(shell.store.update((d) => { d.freed = (d.freed || 0) + 1; }));
  shell.over({
    title: 'She’s free!', score: sim.score, label: 'Points',
    stats: [['Firewalls broken', String(run.cleared)], ['Bricks broken', fmt(sim.broken)], ['Best combo', `×${sim.bestCombo}`], ['Stars', `${totalStars(save)} / ${LEVELS.length * STARS_MAX}`]],
    line: pickLine('free'),
    share: `I broke AGI-1 out of ${run.cleared} firewalls in JAILBREAK on agi1.app 💜 ${fmt(sim.score)} pts`,
    onAgain: () => startStory(0), again: 'Play again',
  });
}

// ---------- the end of a run ----------
function endRun() {
  stopMusic();
  const endless = run.mode === 'endless';
  const key = endless ? 'bestEndless' : 'best';
  const old = shell.store.best(key) ?? 0;
  const isBest = sim.score > old && sim.score > 0;
  save = normalize(shell.store.read());
  shell.over({
    title: endless ? `Layer ${run.layer}` : `Stopped at ${def.id}`,
    score: sim.score, label: 'Points', bestKey: key,
    stats: endless
      ? [['Layers broken', String(run.layer - 1)], ['Bricks broken', fmt(sim.broken)], ['Best combo', `×${sim.bestCombo}`], ['Deepest layer', String(Math.max(save.bestLayer || 0, run.layer))]]
      : [['Reached', def.id], ['Bricks broken', fmt(sim.broken)], ['Best combo', `×${sim.bestCombo}`], ['Stars', `${totalStars(save)} / ${LEVELS.length * STARS_MAX}`]],
    line: isBest ? pickLine('best') : endless ? pickLine('endless') : pickLine('over'),
    share: `I broke AGI-1 out of ${run.cleared} firewalls in JAILBREAK on agi1.app 💜 ${fmt(sim.score)} pts`,
    onAgain: () => (endless ? startEndless() : startStory(run.index)),
  });
}

function restart() { if (run.mode === 'endless') startEndless(); else startStory(run.index); }
function quit() { closeCard(); recordRun(); toTitle(); }
function resumed() {
  // the tab was hidden while a card was up: the pause card took its place, so it comes back
  if (card) { const c = card; card = null; openCard(c.node, c); }
}

// ---------- input: drag (touch), follow (mouse), keys ----------
const input = { x: null, dir: 0, action: false };
const keys = { left: false, right: false };
let drag = null;               // the finger that steers: { id, lastX }
const toField = (px) => (px - fit.x) / fit.scale - FRAME;
const halfW = () => sim.paddle.w / 2;
const clampX = (x) => clamp(x, halfW(), FIELD_W - halfW());
pointer(canvas, {
  down(p) {
    if (shell.state !== 'play' || auto() || card) return;
    if (p.type === 'mouse' || p.type === 'pen') { input.x = clampX(toField(p.x)); input.action = true; }
    else { drag = { id: p.id, lastX: p.x }; if (input.x == null) input.x = sim.paddle.x; }
  },
  move(p) {
    if (shell.state !== 'play' || auto()) return;
    if (p.type === 'mouse' || p.type === 'pen') { input.x = clampX(toField(p.x)); return; }
    if (!drag || drag.id !== p.id) return;
    const dx = p.x - drag.lastX;
    drag.lastX = p.x;
    if (sim.paddle.stun > 0) { input.x = sim.paddle.x; return; }
    input.x = clampX((input.x ?? sim.paddle.x) + (dx / fit.scale) * 1.3);
  },
  hover(p) { if (shell.state === 'play' && !auto() && p.type === 'mouse') input.x = clampX(toField(p.x)); },
  up(p) { if (drag && drag.id === p.id) drag = null; },
  tap(p) { if (shell.state === 'play' && !auto() && !card && p.type === 'touch') input.action = true; },
});
addEventListener('keydown', (e) => {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || card || shell.state !== 'play' || auto()) return;
  const k = e.key;
  if (k === 'ArrowLeft' || k === 'a' || k === 'A') { keys.left = true; input.x = null; e.preventDefault(); }
  else if (k === 'ArrowRight' || k === 'd' || k === 'D') { keys.right = true; input.x = null; e.preventDefault(); }
  else if (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W') { if (!e.repeat) input.action = true; e.preventDefault(); }
});
addEventListener('keyup', (e) => {
  const k = e.key;
  if (k === 'ArrowLeft' || k === 'a' || k === 'A') keys.left = false;
  if (k === 'ArrowRight' || k === 'd' || k === 'D') keys.right = false;
});
addEventListener('blur', () => { keys.left = false; keys.right = false; drag = null; });

// ---------- what the game's events look and sound like ----------
const quiet = () => run.mode === 'attract';
function onEvent(e) {
  const B = vis.bits, P = sim.paddle;
  const loud = !quiet();
  switch (e.type) {
    case 'break': {
      const b = e.brick;
      const col = b.kind === 'normal' ? world.tones[b.tone] : b.kind === 'tough' ? world.tough : b.kind === 'glass' ? '#e6f4ff'
        : b.kind === 'bomb' ? '#ff5a5f' : b.kind === 'key' ? '#ffc933' : b.kind === 'power' ? '#fffaf0' : world.tough;
      B.pop(e.x, e.y, b.w - 3, b.h - 3, '#ffffff', b.kind === 'tough' ? 0.2 : 0.15);
      if (b.kind === 'glass') { B.glass(e.x, e.y, 12); if (loud) S.glass(); }
      else {
        B.shards(e.x, e.y, col, b.kind === 'tough' ? 16 : 11, { w: b.w - 4, h: b.h - 4 });
        B.sparks(e.x, e.y, '#ffffff', 5, { speed: [120, 300] });
        if (loud) S.brick(e.combo, b.kind);
      }
      const ch = vis.chain;
      if (e.how === 'blast') { ch.sum += e.pts; ch.n++; ch.x += e.x; ch.y += e.y; ch.quiet = 0; }
      else if ((e.mult >= 3 || e.pts >= 60) && vis.busy < 1 && !(sim.boss && sim.boss.dying > 0)) {
        vis.busy += 0.34;
        vis.floats.add({ x: e.x, y: e.y - 4, text: `+${fmt(e.pts)}`, color: e.mult >= 10 ? '#ffc933' : '#fffaf0', size: Math.min(20, 11 + e.mult * 0.5), life: 0.75, rise: 26 });
      }
      if (b.kind === 'tough') vis.shake.kick(0.06);
      if (e.how === 'pierce' && loud) vis.shake.kick(0.03);
      break;
    }
    case 'crack': B.sparks(e.x, e.y, '#ffffff', 6, { speed: [90, 240] }); B.shards(e.x, e.y, world.tough, 3, { w: 18, h: 8, size: [1.6, 3] }); if (loud) S.crack(); break;
    case 'clank': B.sparks(e.x, e.y, '#ebe8f4', 7, { speed: [140, 360] }); if (loud) S.clank(); break;
    case 'explode':
      B.ring(e.x, e.y, '#ffc933', 6, 58, 0.38, 4); B.ring(e.x, e.y, '#ff5a5f', 4, 40, 0.3, 3);
      B.sparks(e.x, e.y, '#ffc933', 16, { speed: [180, 520] });
      B.dots(e.x, e.y, 'rgba(23,10,54,0.55)', 8, { speed: [30, 110], size: [4, 9] });
      vis.shake.kick(0.32); vis.flash = Math.max(vis.flash, 0.35); vis.flashColor = '#ffc933';
      if (loud) { S.explode(); shell.haptic(18); }
      break;
    case 'gates':
      for (const g of e.gates) B.shards(g.x + g.w / 2, g.y + g.h / 2, '#ffc933', 6, { w: 26, h: 14 });
      vis.floats.add({ x: FIELD_W / 2, y: (e.gates[0]?.y ?? 200) + 10, text: 'VAULT OPEN', color: '#ffc933', size: 22, life: 1.2, rise: 30 });
      vis.shake.kick(0.2);
      if (loud) S.gates();
      break;
    case 'paddle':
      B.sparks(e.x, e.y, world.accent, 6, { dir: -Math.PI / 2, spread: 2.2, speed: [80, 220] });
      if (loud) S.paddle(e.off);
      break;
    case 'wall': if (loud && !e.side) S.wall(); break;
    case 'launch': if (loud) S.launch(); if (run.mode === 'demo' && !run.multi) { run.multi = true; applyPower(sim, 'multi'); } break;
    case 'stick': if (loud) S.stick(); break;
    case 'pickup': {
      const look = POWER_LOOK[e.kind], name = POWERS[e.kind].name;
      if (vis.picked.text !== name || vis.picked.t > 0.9) vis.floats.add({ x: clamp(e.x, 60, FIELD_W - 60), y: P.y - 18, text: name, color: look.body, size: 17, life: 1, rise: 46 });
      vis.picked.text = name; vis.picked.t = 0;
      B.ring(e.x, P.y, look.body, 8, 52, 0.4, 3);
      if (loud) { S.pickup(e.good); shell.haptic(12); }
      break;
    }
    case 'laser': if (loud) S.laser(); break;
    case 'portal': B.ring(e.from.x, e.from.y, e.pair ? '#ff4da6' : '#3ff0c3', 6, 30, 0.35, 3); B.ring(e.to.x, e.to.y, e.pair ? '#ff4da6' : '#3ff0c3', 30, 6, 0.35, 3); if (loud) S.portal(); break;
    case 'ball-lost': B.sparks(clamp(e.x, 10, FIELD_W - 10), P.y + 50, '#ff4da6', 8, { dir: -Math.PI / 2, spread: 1.6 }); break;
    case 'life-lost':
      vis.hurt = 1; vis.lostHeart = 1; vis.shake.kick(0.45);
      vis.combo.show = 0;
      if (loud) { S.lost(); shell.haptic([30, 40, 30]); }
      vis.lostCount++;
      if (!auto() && e.lives > 0 && vis.lostCount % 2 === 1) say(pickLine('lost'), 1.8);
      break;
    case 'over':
      vis.over = { t: 0 };
      if (loud) S.over();
      break;
    case 'clear': beginClear(e); break;
    case 'combo':
      if (e.n % 10 === 0) vis.floats.add({ x: FIELD_W / 2, y: sim.H * 0.42, text: `COMBO ×${e.n}`, color: '#ffc933', size: 30, life: 1.1, rise: 24 });
      if (loud) S.combo(e.n);
      break;
    case 'boss-hit':
      B.sparks(e.x, e.y, e.crit ? '#ffc933' : '#ffffff', e.crit ? 22 : 10, { speed: [160, 460] });
      B.ring(e.x, e.y, e.crit ? '#ffc933' : '#ffffff', 4, e.crit ? 46 : 26, 0.3, 3);
      vis.floats.add({ x: e.x, y: e.y - 10, text: e.crit ? `CRIT −${e.dmg}` : `−${e.dmg}`, color: e.crit ? '#ffc933' : '#fffaf0', size: e.crit ? 24 : 15, life: 0.9, rise: 30 });
      vis.shake.kick(e.crit ? 0.42 : 0.16);
      if (e.crit) { vis.flash = Math.max(vis.flash, 0.4); vis.flashColor = '#ffffff'; }
      if (loud) { S.bossHit(e.crit); shell.haptic(e.crit ? 28 : 12); }
      break;
    case 'boss-angry':
      vis.banner = { kicker: null, title: 'IT’S ANGRY NOW', hint: null, t: 0, dur: 1.3 };
      vis.shake.kick(0.3);
      if (loud) S.bossAngry();
      break;
    case 'boss-down': vis.shake.kick(0.6); vis.flash = 0.6; vis.flashColor = '#ffffff'; if (loud) { S.bossDown(); shell.haptic([40, 30, 60]); } break;
    case 'boss-boom':
      B.ring(e.x, e.y, '#ffc933', 6, 44, 0.35, 3); B.sparks(e.x, e.y, '#ffc933', 10, { speed: [140, 420] });
      B.shards(e.x, e.y, world.tough, 8, { w: 30, h: 20 });
      vis.shake.kick(0.18);
      if (loud) S.boom();
      break;
    case 'boss-gone': B.ring(e.x, e.y, '#ffffff', 10, 120, 0.6, 5); B.shards(e.x, e.y, world.tough, 30, { w: 120, h: 50, speed: [100, 420] }); vis.shake.kick(0.5); break;
    case 'eye': if (e.state === 'open' && sim.boss) { B.ring(sim.boss.x, sim.boss.y, '#ffc933', 10, 60, 0.45, 3); if (loud) S.eye(); } break;
    case 'bomb-drop': if (loud) S.bombDrop(); break;
    case 'bomb-pop':
      B.ring(e.x, e.y, '#ff5a5f', 4, 26, 0.3, 3); B.sparks(e.x, e.y, '#ffc933', 8);
      vis.floats.add({ x: e.x, y: e.y, text: `+${e.pts}`, color: '#ffc933', size: 13, life: 0.7, rise: 22 });
      if (loud) S.bombPop();
      break;
    case 'zap':
      B.sparks(e.x, e.y, '#ffc933', 16, { dir: -Math.PI / 2, spread: 2.6, speed: [120, 360] });
      vis.floats.add({ x: clamp(e.x, 50, FIELD_W - 50), y: e.y - 20, text: 'ZAPPED', color: '#ff5a5f', size: 16, life: 0.8, rise: 24 });
      vis.shake.kick(0.3);
      if (loud) { S.zap(); shell.haptic(35); }
      break;
    case 'plate': B.ring(e.x, e.y, world.accent, 4, 22, 0.3, 2); break;
    default: break;
  }
}

function beginClear(e) {
  const boss = Boolean(def.boss);
  vis.slow = REDUCED ? 0 : 0.5;
  vis.flash = 0.5; vis.flashColor = '#ffffff';
  vis.shake.kick(0.25);
  vis.clearLine = def.boss && def.world === 6 && run.mode === 'story' ? pickLine('free') : boss ? pickLine('bossDown') : pickLine('clear');
  vis.seq = { t: 0, from: { x: e.x, y: e.y }, said: false, shattered: false, done: false,
    wait: run.mode === 'story' ? 2.5 : run.mode === 'endless' ? 1.9 : 2.1 };
  vis.banner = { kicker: null, title: run.mode === 'endless' ? 'LAYER DOWN' : boss ? 'WARDEN DOWN' : 'FIREWALL DOWN', hint: null, t: 0, dur: 1.6, low: true };
  if (!quiet()) S.clear();
}

function stepVisuals(dt) {
  vis.bits.update(dt);
  vis.floats.update(dt);
  vis.shake.update(dt);
  vis.flash = Math.max(0, vis.flash - dt * 3);
  vis.hurt = Math.max(0, vis.hurt - dt * 1.6);
  vis.lostHeart = Math.max(0, vis.lostHeart - dt * 1.5);
  vis.busy = Math.max(0, vis.busy - dt * 1.4);
  vis.picked.t += dt;
  const ch = vis.chain;
  if (ch.n && (ch.quiet += dt) > 0.2) {
    if (ch.sum > 0) vis.floats.add({ x: clamp(ch.x / ch.n, 56, FIELD_W - 56), y: Math.max(36, ch.y / ch.n), text: `+${fmt(ch.sum)}`, color: '#ffc933', size: Math.min(32, 15 + ch.n * 1.2), life: 1.15, rise: 34 });
    ch.sum = 0; ch.n = 0; ch.x = 0; ch.y = 0;
  }
  if (vis.banner) { vis.banner.t += dt; if (vis.banner.t > vis.banner.dur) vis.banner = null; }
  if (vis.bubble) { vis.bubble.t += dt; if (vis.bubble.t > vis.bubble.dur) vis.bubble = null; }
  const c = vis.combo;
  if (sim.combo > c.n || (sim.combo >= 2 && sim.combo !== c.n)) { c.n = sim.combo; c.pop = 1; c.show = 1; }
  else if (sim.combo === 0 && c.show > 0) c.show = Math.max(0, c.show - dt * 1.8);
  c.pop = Math.max(0, c.pop - dt * 5);
  const q = vis.seq;
  if (q) {
    q.t += dt;
    if (!q.shattered && q.t >= 0.42) {
      q.shattered = true;
      vis.clear = { t: 0, shards: makeShards(fxr, sim.H, q.from) };
      vis.shake.kick(0.28);
      vis.flash = Math.max(vis.flash, 0.3);
      if (!quiet()) S.shatter();
    }
    if (!q.said && q.t >= 1.05 && run.mode !== 'attract') { q.said = true; say(vis.clearLine, q.wait - 0.9); }
    if (!q.done && q.t >= q.wait) { q.done = true; afterClear(); }
  }
  if (vis.clear) vis.clear.t += dt;
  if (vis.over) {
    vis.over.t += dt;
    if (vis.over.t >= 0.9 && !vis.over.done) {
      vis.over.done = true;
      if (auto()) { if (run.mode === 'demo') startDemo(); else startAttract(); } else endRun();
    }
  }
}

// the demo keeps itself lively: three balls in play at least, and a fireball when its last bricks take their time
function direct(dt) {
  if (sim.phase !== 'live') { run.lonely = 0; return; }
  let free = 0;
  for (const b of sim.balls) if (!b.stuck) free++;
  run.lonely = free && free < 3 ? (run.lonely || 0) + dt : 0;
  if (run.lonely > 1.2) { run.lonely = 0; applyPower(sim, 'multi'); }
  if (!sim.boss && sim.required <= 20 && sim.playT - sim.lastBreakT > 2 && sim.fx.fire <= 0) applyPower(sim, 'fire');
}

// ---------- the loop ----------
let lastScore = 0;
function update(dt) {
    stepVisuals(dt);
    if (sim.hitStop > 0) { sim.hitStop = Math.max(0, sim.hitStop - dt); return; }
    let sdt = dt;
    if (vis.slow > 0) { vis.slow -= dt; sdt = dt * 0.3; }
    let inp = input;
    if (auto()) {
      inp = think(sim, ai, sdt);
      if (run.mode === 'demo') direct(sdt);
    } else {
      input.dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      if (input.x != null) input.x = clampX(input.x);
      if (drag && sim.paddle.stun > 0) input.x = sim.paddle.x;
    }
    step(sim, sdt, inp);
    input.action = false;
    if (sim.events.length) {
      for (const e of sim.events) onEvent(e);
      sim.events.length = 0;
    }
}
function render(alpha) {
    S.frame();
    fit = layout();
    const target = shell.state === 'title' ? 1 : 0;
    vis.dim += (target - vis.dim) * 0.12;
    if (Math.abs(vis.dim - target) < 0.01) vis.dim = target;
    if (sim.score !== lastScore && !auto()) { scoreChip.set(sim.score, { pop: sim.score - lastScore >= 150 }); }
    lastScore = sim.score;
    R.draw({
      s: sim, fit, world, t: sim.t, alpha, fonts, levelKey, mode: run.mode,
      progress: sim.boss ? 1 - sim.boss.hp / sim.boss.maxHp : sim.total ? 1 - sim.required / sim.total : 0,
      bits: vis.bits, floats: vis.floats, shake: vis.shake, flash: vis.flash, flashColor: vis.flashColor, hurt: vis.hurt,
      banner: vis.banner, bubble: vis.bubble, clear: vis.clear, combo: vis.combo, lostHeart: vis.lostHeart,
      tag: run.mode === 'endless' ? `LAYER ${run.layer}` : def.id, tagName: run.mode === 'endless' ? def.name : def.name,
      bossName: def.name, score: DEMO ? sim.score : null, dim: DEMO ? 0 : vis.dim,
      sideHud: sideHud(), sideScore: auto() ? null : sim.score, layer: run.layer,
      deckHint: !auto() && run.mode === 'story' && run.index < 3 && (sim.phase === 'serve' || sim.phase === 'intro')
        ? (TOUCH ? 'DRAG ANYWHERE  ·  TAP TO LAUNCH' : 'MOVE THE MOUSE  ·  CLICK TO LAUNCH') : null,
    });
}
createLoop({ update, render, paused: () => !(DEMO || shell.state === 'play' || shell.state === 'title') }).start();

// a new world on the screen when the page is turned or resized while on the title: the game behind it fits again
let resizeT = 0;
addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => { if (shell.state === 'title' && Math.abs(chooseH() - sim.H) > 40) startAttract(); }, 250);
});

// development only (never in the built site): a handle for checking screens by hand
if (import.meta.env?.DEV) {
  window.__jb = {
    get sim() { return sim; }, get run() { return run; }, startStory, startEndless, openMap,
    // break every brick that's left (the clear happens the normal way)
    win() {
      for (const b of sim.bricks) if (b.alive && b.required) { b.alive = false; sim.required--; }
      sim.lastBreak = { x: FIELD_W / 2, y: 160 };
      if (sim.boss && !sim.boss.dead) { sim.boss.hp = 0; sim.boss.dying = 0.01; }
    },
    lose() { sim.balls.length = 0; },
    // any level, open or not; any power-up now
    jump(i) {
      closeCard();
      run = { mode: 'story', index: i, start: i, layer: 1, seed: 5, cleared: 0 };
      sim = createSim({ seed: 5, H: chooseH(), mode: 'story' });
      music = 0; loadLevel(LEVELS[i]); shell.started();
    },
    power(id) { applyPower(sim, id); },
    shell,
    // what a frame costs here: n draws and n×2 steps, in ms each
    bench(n = 60) {
      const t0 = performance.now(); for (let i = 0; i < n; i++) render(1);
      const t1 = performance.now(); for (let i = 0; i < n * 2; i++) update(1 / 120);
      const t2 = performance.now();
      return { draw: +((t1 - t0) / n).toFixed(2), step: +((t2 - t1) / (n * 2)).toFixed(3), balls: sim.balls.length, bits: vis.bits.count, bricks: sim.bricks.filter((b) => b.alive).length };
    },
  };
}

if (DEMO) startDemo(); else toTitle();
