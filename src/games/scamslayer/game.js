// SCAM SLAYER (2026-11-08): AGI-1 protects her chat. Cartoon scams are tossed up from below the screen; swipe to
// slice them in mid-air, spare her hearts, never cut a rug. Classic (3 shields) and Blitz (60 seconds). Built on the
// arcade kit (src/games/kit/): its frame, title, pause and end-of-run cards, local bests, sound and the play counter.
// The rules are engine.js (pure), the throws waves.js, the demo's player demo.js; this file wires them to the page:
// the canvas, fingers and mouse, the loop, and what every moment looks, sounds and feels like.
import { createShell, el } from '../kit/shell.js';
import { fitCanvas } from '../kit/canvas.js';
import { createLoop } from '../kit/loop.js';
import { pointer, keyboard } from '../kit/input.js';
import { rng, fmt, clamp, approach } from '../kit/fx.js';
import { DEMO, SEED, REDUCED } from '../kit/env.js';
import { UNIT, KINDS } from './kinds.js';
import { createWorld, stepWorld, bladeDown, bladeMove, bladeUp, releaseBlades, resizeWorld, summary } from './engine.js';
import { createBot } from './demo.js';
import { makeVoice, endKey, shareText } from './lines.js';
import { createEffects } from './effects.js';
import { createBlades, bladePalette } from './blade.js';
import { createRenderer } from './render.js';
import { createSounds, runMusic } from './sound.js';
import { buildSprite, PAPER } from './art.js';
import './style.css';             // after the kit's styles (kit.css comes with shell.js), so ours win

const root = document.getElementById('ak-root');
const shell = createShell({
  game: 'scamslayer',
  name: 'SCAM SLAYER',
  root,
  howTo: {
    intro: 'Scams are flying into AGI-1’s chat. Swipe through them before they land.',
    steps: [
      ['Swipe to slice', 'Slash through the flying scams. Three or more in one swipe make a combo.'],
      ['Spare the hearts', 'Purple hearts are AGI-1’s love letters. Cutting one cracks a shield (in Blitz: −5 s).'],
      ['Never cut a rug', 'A rolled-up rug with a lit fuse ends a Classic run on the spot (in Blitz: −10 s).'],
      ['Don’t let scams land', 'In Classic, every scam that falls back down cracks a shield. Lose all three and it’s over.'],
      ['Power scams', 'Freeze slows everything down, Frenzy throws scams in from the sides, Double doubles your points.'],
    ],
    touch: [['Swipe', 'Slice'], ['More fingers', 'More blades']],
    keys: [['Hold + drag', 'Slice with the mouse'], ['Space · P · Esc', 'Pause'], ['Enter', 'Play again']],
  },
  onPause: () => releaseAll(),
  onRestart: () => newRun(mode),
  onQuit: () => toTitle(),
});

const canvas = document.createElement('canvas');
canvas.setAttribute('role', 'img');
canvas.setAttribute('aria-label', 'SCAM SLAYER: swipe to slice the flying scams, spare the hearts, never cut a rug');
shell.stage.append(canvas);
const safeProbe = el('div', { class: 'ss-safe', 'aria-hidden': 'true' });
root.append(safeProbe);

let dirty = true;
const view = fitCanvas(canvas, { maxDpr: 2, onResize: () => { dirty = true; } });
const renderer = createRenderer();
const fx = createEffects();
const blades = createBlades();
const sounds = createSounds(shell.audio);
const bestChip = shell.chip('Best', 0, { fmtFn: (v) => (v ? fmt(v) : '—') });

// ---------- the run's state ----------
let world = null, bot = null, phase = 'boot', dyingT = 0, ready = false;
let mode = shell.store.read().mode === 'blitz' ? 'blitz' : 'classic';
let W = UNIT, H = UNIT, top = 0, scale = 1;
let vt = 0;                          // the visual clock (s)
let shownScore = 0, best = 0, beatBest = false, freezeA = 0, lastSecond = 99;
let lastLine = -99, kindsSeen = new Set(), botDown = false, demoRuns = 0, titleRuns = 0;
// her lines' dice (seeded in a demo, so a recorded preview is the same every time)
const dice = DEMO ? rng((SEED || 7) * 13 + 5).next : Math.random;
const voice = makeVoice(dice);

// ---------- the screen ----------
function measure() {
  dirty = false;
  const w = view.w, h = view.h;
  const cs = getComputedStyle(safeProbe);
  const safe = { r: parseFloat(cs.paddingRight) || 0, l: parseFloat(cs.paddingLeft) || 0 };
  const barBottom = DEMO ? 0 : Math.max(0, shell.bar.getBoundingClientRect().bottom);
  const m = Math.min(w, h);
  const layout = {
    hudTop: DEMO ? 10 : Math.round(barBottom + 6),
    fs: clamp(Math.round(m * 0.095), 32, 60),
    av: clamp(Math.round(m * 0.112), 44, 70),
    sh: clamp(Math.round(m * 0.05), 22, 34),
    left: safe.l + 14, right: w - safe.r - 14,
  };
  renderer.resize(w, h, view.dpr, layout);
  scale = m / UNIT;
  W = w / scale; H = h / scale;
  top = (DEMO ? 4 : barBottom + 2) / scale;
  fx.bounds.minY = (layout.hudTop + layout.fs * 1.2) / scale;
  fx.bounds.W = W;
  if (world) resizeWorld(world, W, H, top);
}

// ---------- AGI-1's lines (one at a time, not too often) ----------
function say(key, { force = false, chance = 1 } = {}) {
  if (phase !== 'run') return;
  if (!force && (vt - lastLine < 3.6 || dice() > chance)) return;
  const line = voice.pick(key);
  if (!line) return;
  lastLine = vt;
  fx.say(line);
}

// ---------- runs ----------
function releaseAll() {
  if (world) releaseBlades(world);
  blades.clear();
  botDown = false;
}

function newRun(m = mode) {
  if (!ready) return;
  mode = m === 'blitz' ? 'blitz' : 'classic';
  if (!DEMO) shell.store.update((d) => { d.mode = mode; });
  const seed = DEMO ? (SEED || 7) + demoRuns * 101 : (Math.random() * 2 ** 31) >>> 0;
  releaseAll();
  world = createWorld({
    mode, seed, W, H, top,
    // the demo starts mid-game: a row to slice at once, the golden scam and a Frenzy within seconds
    ...(DEMO ? { start: 40, opening: true, firstAt: 0.1, timers: { golden: 4.6, power: 6.6, powerKind: 'frenzy', rush: 16 } } : {}),
  });
  bot = DEMO ? createBot(seed * 31 + 1) : null;
  fx.reset();
  shownScore = 0; beatBest = false; freezeA = 0; lastSecond = 99; lastLine = -99; kindsSeen = new Set();
  best = shell.store.best(mode === 'blitz' ? 'blitz' : 'best') || 0;
  bestChip.set(best);
  bestChip.node.classList.remove('is-accent');
  phase = 'run';
  shell.started();
  if (!DEMO) {
    sounds.start();
    shell.audio.music(runMusic());
    setTimeout(() => say('start', { force: true }), 500);
  }
}

function toTitle() {
  if (!ready) return;
  phase = 'title';
  shell.audio.stopMusic();
  releaseAll();
  world = createWorld({ mode: 'attract', seed: 4242 + titleRuns * 17, W, H, top, start: 26, firstAt: 0.25 });
  bot = createBot(99 + titleRuns, { relaxed: true });
  titleRuns++;
  fx.reset();
  const s = shell.store;
  shell.title({
    logo: logo(),
    tagline: 'Slice the scams. Spare the hearts.',
    hidePlay: true,
    modes: [
      { label: 'Classic', sub: '3 shields', onClick: () => newRun('classic') },
      { label: 'Blitz', sub: '60 seconds', onClick: () => newRun('blitz') },
    ],
    onPlay: () => newRun(mode),
    best: null,
    extra: titleExtra(s.best('best'), s.best('blitz'), s.read().slain || 0),
  });
}

function finish() {
  if (DEMO) { demoRuns++; newRun('classic'); return; }
  phase = 'over';
  const s = summary(world);
  const bestKey = mode === 'blitz' ? 'blitz' : 'best';
  const prev = shell.store.best(bestKey);
  shell.store.update((d) => { d.slain = (Number(d.slain) || 0) + s.slain; });
  const titles = { rug: 'Rugged!', heart: 'Heartbroken', miss: 'Out of shields', time: 'Time!' };
  shell.over({
    score: s.score,
    label: mode === 'blitz' ? 'Blitz score' : 'Classic score',
    bestKey,
    title: titles[s.reason] || 'Game over',
    stats: [
      ['Scams slain', fmt(s.slain)],
      ['Best combo', s.bestCombo ? `×${s.bestCombo}` : '—'],
      ['Hearts saved', fmt(s.heartsSaved)],
      ['Accuracy', `${s.accuracy}%`],
    ],
    line: voice.pick(endKey({ reason: s.reason, score: s.score, best: prev, mode })),
    share: shareText(s.slain),
    onAgain: () => newRun(mode),
    onMenu: () => toTitle(),
  });
}

// ---------- what each moment looks, sounds and feels like ----------
const POWER_BANNER = {
  freeze: ['FREEZE', 'everything slows down', '#59c8ff'],
  frenzy: ['FRENZY!', 'scams from every side', '#ffc933'],
  double: ['DOUBLE', 'points ×2 for 8 seconds', '#3ff0c3'],
};

// the first time a player meets each kind of thing, a label rides on it (kept on this device: shown once)
const FIRST = {
  scam: ['SWIPE!', '#ffc933'], heart: ['SPARE IT!', '#cdb8ff'], rug: ['DON’T CUT!', '#ff7a7e'],
  golden: ['×5 GOLDEN', '#ffc933'], freeze: ['SLOW-MO', '#59c8ff'], frenzy: ['FRENZY', '#ffc933'], double: ['DOUBLE', '#3ff0c3'],
};
let seenTips = null;
function firstTime(o) {
  if (DEMO) return;
  if (!seenTips) seenTips = { ...(shell.store.read().tips || {}) };
  const key = o.kind in FIRST ? o.kind : o.role === 'scam' ? 'scam' : o.role;
  if (!FIRST[key] || seenTips[key]) return;
  seenTips[key] = true;
  shell.store.update((d) => { d.tips = { ...(d.tips || {}), [key]: true }; });
  fx.tag(o, FIRST[key][0], FIRST[key][1], { ghost: key === 'scam', life: key === 'scam' ? 3.2 : 2.6 });
}

function handle(e) {
  const live = phase === 'run';
  switch (e.type) {
    case 'launch':
      if (live) { sounds.launch(); firstTime(e.o); }
      break;
    case 'slice': {
      const o = e.o, k = KINDS[o.kind];
      fx.addHalves(e, renderer.sprites, renderer.halves);
      fx.shards(o, e.ang, e.crit ? 22 : 14);
      fx.splat(o.x, o.y, k.splat, o.r);
      if (o.role !== 'scam' && o.role !== 'power') break;
      blades.combo(e.blade, e.n);
      if (!live) break;
      sounds.slice(e.n, { crit: e.crit, golden: o.kind === 'golden' });
      shell.haptic(7);
      fx.scorePop = 1;
      const golden = o.kind === 'golden';
      const color = golden ? '#ffc933' : e.crit ? '#ff4da6' : world.power.double > 0 ? '#3ff0c3' : PAPER;
      // (in a Frenzy only the big ones: the screen is busy enough)
      if (golden || e.crit || world.power.frenzy <= 0) fx.float(o.x, o.y - o.r * 0.4, `+${e.pts}`, { size: golden ? 46 : e.crit ? 38 : 30, color, big: golden || e.crit });
      if (e.crit) {
        fx.float(o.x, o.y - o.r * 1.25, 'CRIT!', { size: 30, color: '#ff4da6', delay: 0.06, life: 0.8 });
        fx.top.burst({ x: o.x, y: o.y, count: 10, speed: [300, 700], life: [0.3, 0.6], size: [10, 18], colors: ['#ffffff', '#ff4da6'], shape: 'star', spin: 8, drag: 2.5 });
        fx.doFlash('#ffffff', 0.12);
        fx.shake.kick(0.16);
      }
      if (golden) {
        fx.ring(o.x, o.y, '#ffc933', 190, 0.5, 14);
        fx.top.burst({ x: o.x, y: o.y, count: 18, speed: [200, 760], life: [0.5, 1], size: [12, 22], colors: ['#ffc933', '#fff1b8', '#ffffff'], shape: 'star', spin: 6, drag: 1.6, gravity: 500 });
        fx.shake.kick(0.28);
        fx.mood('love', 1.8);
        say('golden', { force: true });
      } else if (o.role === 'scam' && !kindsSeen.has(o.kind)) {
        kindsSeen.add(o.kind);
        say(o.kind, { chance: 0.55 });
      }
      break;
    }
    case 'combo': {
      if (!live) break;
      const col = bladePalette(e.n).body;
      fx.float(e.x, e.y - 34, `COMBO ×${e.n}`, { size: 34 + Math.min(e.n, 9) * 3.5, color: col, big: true, life: 1.15, rise: 95 });
      fx.float(e.x, e.y + 18, `+${e.bonus}`, { size: 30, color: PAPER, delay: 0.1, life: 0.95 });
      fx.ring(e.x, e.y, col, 110 + Math.min(e.n, 9) * 22, 0.45, 12);
      sounds.combo(e.n);
      fx.shake.kick(0.1 + 0.03 * Math.min(e.n, 9));
      shell.haptic(16);
      fx.mood(e.n >= 5 ? 'love' : 'happy', 1.4);
      if (e.n >= 6) say('bigCombo', { force: vt - lastLine > 1.5 }); else if (e.n >= 4) say('combo', { chance: 0.7 });
      break;
    }
    case 'heart':
      fx.parts.burst({ x: e.o.x, y: e.o.y, count: 16, speed: [160, 520], life: [0.5, 1], size: [10, 18], colors: ['#ff4da6', '#8b66ff', '#ffc2e0'], gravity: 900, drag: 1.5, shape: 'circle', stroke: '#170a36' });
      if (!live) break;
      fx.doFlash('#ff4da6', 0.32);
      fx.shake.kick(0.42);
      sounds.heart();
      shell.haptic([30, 40, 30]);
      fx.mood('sad', 2.2);
      if (mode === 'classic') fx.float(e.o.x, e.o.y - 40, 'MY HEART!', { size: 32, color: '#ff4da6', big: true, life: 1 });
      say('heart', { force: true });
      break;
    case 'rug':
      fx.startRug(e.o, mode === 'classic' && phase === 'run');
      if (!live) break;
      sounds.rug(mode === 'classic');
      shell.haptic([60, 40, 140]);
      fx.mood('surprised', 2.6);
      say(mode === 'blitz' ? 'rugBlitz' : 'rug', { force: true });
      break;
    case 'close':
      if (!live) break;
      fx.float(e.o.x, e.o.y - e.o.r * 1.2, 'CLOSE!', { size: 30, color: '#ffc933', life: 0.8, rise: 46 });
      fx.mood('surprised', 1.1);
      sounds.close();
      say('close', { chance: 0.6 });
      break;
    case 'miss':
      if (!live) break;
      if (e.grace) {
        // the warm-up: no shield lost, a nudge instead
        fx.float(e.x, H - 70, 'FREE MISS', { size: 24, color: '#cdb8ff', life: 0.9, rise: 50 });
        sounds.saved();
        say('warmup', { force: vt - lastLine > 2 });
        break;
      }
      if (mode === 'blitz') { fx.float(e.x, H - 60, 'MISSED', { size: 20, color: '#cdb8ff', life: 0.7, rise: 36 }); break; }
      fx.float(e.x, H - 70, 'MISSED', { size: 28, color: '#ff5a5f', life: 0.9, rise: 50 });
      fx.parts.burst({ x: e.x, y: H - 6, count: 10, speed: [120, 380], angle: [-Math.PI * 0.85, -Math.PI * 0.15], life: [0.3, 0.6], size: [6, 12], colors: ['#ff5a5f', '#fffaf0'], gravity: 1200, shape: 'square', stroke: '#170a36' });
      sounds.miss();
      fx.mood('surprised', 1.3);
      say('miss', { chance: 0.45 });
      break;
    case 'life':
      if (!live) break;
      fx.crack(e.lives);
      sounds.crack();
      fx.shake.kick(0.22);
      shell.haptic(24);
      break;
    case 'penalty':
      if (!live) break;
      fx.float(e.x, e.y - 50, `−${e.seconds}s`, { size: 46, color: '#ff5a5f', big: true, life: 1.1 });
      fx.timerPop = 1;
      break;
    case 'power': {
      const [text, sub, color] = POWER_BANNER[e.power];
      if (live) {
        fx.banner(text, sub, color, 1.35);
        sounds.power(e.power);
        fx.mood('happy', 1.6);
        say(e.power, { force: vt - lastLine > 1.5 });
        shell.haptic(20);
      }
      break;
    }
    case 'power-end':
      if (live) sounds.powerEnd();
      break;
    case 'saved':
      if (live) { fx.float(clamp(e.o.x, 60, W - 60), H - 60, 'SAVED', { size: 22, color: '#cdb8ff', life: 0.8, rise: 40 }); sounds.saved(); }
      break;
    case 'rush':
      if (live) { fx.banner('RUSH!', 'here they come', '#ff4da6', 1.2); sounds.rush(); say('rush', { chance: 0.8 }); }
      break;
    case 'over': {
      if (phase !== 'run') break;
      phase = 'dying';
      releaseAll();
      shell.audio.stopMusic();
      const r = e.reason;
      dyingT = r === 'rug' ? 1.9 : r === 'time' ? 1.4 : 1.25;
      if (r === 'rug') setTimeout(() => { if (phase === 'dying') fx.banner('RUGGED!', 'never cut the rug', '#ff5a5f', 1.4); }, 650);
      else if (r === 'time') { fx.banner('TIME!', '', '#ffc933', 1.3); sounds.end(); }
      else { fx.banner('OUT OF SHIELDS', '', '#ff4da6', 1.2); sounds.end(); fx.mood('sad', 3); }
      break;
    }
    default: break;
  }
}

// ---------- the fingers and the mouse ----------
function feed(id, x, y, ms) {
  bladeMove(world, id, x, y, ms);
  blades.move(id, x, y, vt);
  const b = world.blades.get(id);
  if (b && b.speed > 1500) sounds.swish(b.speed / 2600);
}
pointer(canvas, {
  down(p) {
    if (phase !== 'run' || shell.state !== 'play' || !world || world.over) return;
    const x = p.x / scale, y = p.y / scale;
    bladeDown(world, p.id, x, y, p.event.timeStamp);
    blades.down(p.id, x, y, vt);
  },
  move(p) {
    if (phase !== 'run' || !world || world.over) return;
    const list = typeof p.event.getCoalescedEvents === 'function' ? p.event.getCoalescedEvents() : null;
    if (list && list.length > 1) {
      const r = canvas.getBoundingClientRect();
      for (const ev of list) feed(p.id, (ev.clientX - r.left) / scale, (ev.clientY - r.top) / scale, ev.timeStamp);
    } else feed(p.id, p.x / scale, p.y / scale, p.event.timeStamp);
  },
  up(p) {
    if (world) bladeUp(world, p.id);
    blades.up(p.id);
  },
});
// Space pauses a run (Esc and P too: the kit's)
keyboard({ ' ': 'pause', Space: 'pause' }, {
  down: () => { if (phase === 'run') shell.pause(); },
  blocked: () => shell.state !== 'play' || DEMO,
});

// ---------- the title screen's pieces ----------
function logo() {
  const h1 = el('h1', { class: 'ak-logo ss-logo', 'aria-label': 'SCAM SLAYER' });
  const scam = el('span', { class: 'ak-logo-line ss-scam', 'aria-hidden': 'true' },
    el('span', 'ss-half ss-top', 'SCAM'), el('span', 'ss-half ss-bot', 'SCAM'), el('span', 'ss-slash'));
  h1.append(scam, el('span', { class: 'ak-logo-line is-accent', 'aria-hidden': 'true' }, 'SLAYER'));
  return h1;
}

function icon(kind) {
  const css = 28, dpr = Math.min(2, window.devicePixelRatio || 1);
  const sp = buildSprite(kind, (css / 2 / 1.42) * dpr);
  const c = document.createElement('canvas');
  c.width = Math.round(css * dpr); c.height = Math.round(css * dpr);
  c.className = 'ss-icon';
  c.setAttribute('aria-hidden', 'true');
  c.getContext('2d').drawImage(sp.canvas, 0, 0, c.width, c.height);
  return c;
}

function titleExtra(bestClassic, bestBlitz, slain) {
  const key = (kinds, verb, noun, tone) => el('li', `ss-key is-${tone}`,
    el('span', 'ss-icons', kinds.map(icon)), el('b', null, verb), el('small', null, noun));
  const legend = el('ul', { class: 'ss-legend', 'aria-label': 'What to slice and what to spare' },
    key(['airdrop', 'seed', 'hook'], 'Slice', 'the scams', 'go'),
    key(['heart'], 'Spare', 'her hearts', 'spare'),
    key(['rug'], 'Never', 'cut a rug', 'never'));
  const any = bestClassic || bestBlitz;
  const bests = any ? el('p', 'ak-best ss-bests', 'Best',
    el('span', null, 'Classic ', el('b', null, bestClassic ? fmt(bestClassic) : '—')),
    el('span', null, 'Blitz ', el('b', null, bestBlitz ? fmt(bestBlitz) : '—'))) : null;
  const total = slain > 0 ? el('p', 'ss-total', `${fmt(slain)} scam${slain === 1 ? '' : 's'} slain on this device so far`) : null;
  return el('div', 'ss-extra', legend, bests, total);
}

// ---------- the loop ----------
const fuseTip = { x: 0, y: 0 };
function step(dt) {
  if (!world) return;
  if (bot) {
    bot.update(world, dt);
    const b = world.blades.get(bot.id);
    if (b && b.down) {
      if (!botDown) { blades.down(bot.id, b.x, b.y, vt); botDown = true; } else blades.move(bot.id, b.x, b.y, vt);
    } else if (botDown) { blades.up(bot.id); botDown = false; }
  }
  stepWorld(world, dt);
  if (world.events.length) {
    for (const e of world.events) handle(e);
    world.events.length = 0;
  }
  // a lit fuse sparks, the golden scam glitters
  for (const o of world.objs) {
    if (o.dead) continue;
    if (o.role === 'rug') {
      const c = Math.cos(o.rot), s = Math.sin(o.rot), lx = -1.12 * o.r, ly = -0.9 * o.r;
      fuseTip.x = o.x + lx * c - ly * s; fuseTip.y = o.y + lx * s + ly * c;
      if (Math.random() < 0.5) fx.parts.burst({ x: fuseTip.x, y: fuseTip.y, count: 1, speed: [80, 240], life: [0.15, 0.35], size: [3, 6], colors: ['#ffc933', '#ff5a5f', '#ffffff'], gravity: 300, drag: 2, shape: 'spark' });
      if (phase === 'run') sounds.fuse();
    }
  }
  fx.update(dt, world.ts, H);
  if (phase === 'run' || phase === 'dying') {
    // the score counts up, a new best is celebrated once
    const target = world.score;
    if (shownScore < target) shownScore = Math.min(target, Math.ceil(shownScore + Math.max(1, (target - shownScore) * dt * 14)));
    if (!beatBest && best > 0 && world.score > best && phase === 'run') {
      beatBest = true;
      if (!DEMO) {
        shell.toast('New best!', 'good');
        sounds.best();
        fx.mood('love', 2);
        say('best', { force: true });
      }
      bestChip.node.classList.add('is-accent');
    }
    if (beatBest || !best) bestChip.set(Math.max(best, world.score));
    if (mode === 'blitz' && phase === 'run') {
      const sec = Math.ceil(world.timeLeft);
      if (sec !== lastSecond) { if (sec <= 10 && sec > 0) sounds.tick(sec <= 5); lastSecond = sec; }
    }
  }
  freezeA = approach(freezeA, world.power.freeze > 0 ? 1 : 0, 7, dt);
  if (phase === 'dying') {
    dyingT -= dt;
    if (dyingT <= 0) finish();
  }
}

function frame(alpha, frameDt) {
  vt += Math.min(0.1, frameDt);
  if (dirty) measure();
  blades.update(vt);
  // the room leans a little toward the blade (or drifts on its own); still with "reduce motion"
  const tip = REDUCED ? null : blades.anyTip();
  const tx = REDUCED ? 0 : tip ? (tip.x / W) * 2 - 1 : Math.sin(vt * 0.21) * 0.35;
  const ty = REDUCED ? 0 : tip ? (tip.y / H) * 2 - 1 : Math.cos(vt * 0.17) * 0.25;
  renderer.par.x = approach(renderer.par.x, -tx, 2.2, frameDt);
  renderer.par.y = approach(renderer.par.y, -ty, 2.2, frameDt);
  const ctx = view.begin();
  if (!ctx) return;
  const showHud = phase === 'run' || phase === 'dying' || phase === 'over';
  const p = world?.power;
  renderer.frame(ctx, {
    world, fx, blades, t: vt, vt,
    hud: showHud,
    mode,
    shownScore,
    lives: world ? world.lives : 3,
    timeLeft: world && mode === 'blitz' ? world.timeLeft : 60,
    power: showHud ? p : null,
    double: Boolean(p && p.double > 0),
    beatBest,
    freezeA,
    palette: (n) => bladePalette(n, p ? (p.freeze > 0 ? 'freeze' : p.double > 0 ? 'double' : null) : null),
  });
}

createLoop({
  update: step,
  render: frame,
  paused: () => shell.state === 'pause',
}).start();

// ---------- start: the fonts first (the stickers have words on them); a demo also waits for the intro to finish ----------
const fonts = ["900 40px 'AK Display'", "italic 20px 'AK Serif'", "750 20px 'AK Mono'"];
const fontLoad = Promise.all(fonts.map((f) => document.fonts?.load?.(f)));
const fontsReady = Promise.race([fontLoad, new Promise((r) => setTimeout(r, 2500))]).catch(() => {});
// fonts that come after the wait: the stickers are drawn again with them
fontLoad.then(() => { if (ready) renderer.refreshSprites(); }).catch(() => {});
const introDone = new Promise((resolve) => {
  if (!document.getElementById('agi-intro')) { resolve(); return; }
  addEventListener('agi:intro-done', () => resolve(), { once: true });
  setTimeout(resolve, 6000);                     // never wait forever
});
fontsReady.then(() => {
  ready = true;
  measure();
  renderer.refreshSprites();
  if (DEMO) introDone.then(() => newRun('classic')); else toTitle();
});
