// LAST MODEL STANDING (2026-11-08): the game on the page. AGI-1 holds the server floor against endless spam bots for ten
// minutes, levelling her weapons into a storm. This file wires the arcade kit's frame (title, pause, end card, bests),
// the canvas and the loop, her controls (keys, a floating joystick, the mouse, a gamepad), the world (./sim.js), what it
// looks and sounds like (./render.js, ./effects.js, ./sound.js), the cards (./ui.js) and the Patch shop (PATCHES kept
// in this browser by the kit's store). The title screen plays a run by itself behind it; ?demo plays one, silently.
import './style.css';
import { createShell, el } from '../kit/shell.js';
import { fitCanvas } from '../kit/canvas.js';
import { createLoop } from '../kit/loop.js';
import { pointer, keyboard } from '../kit/input.js';
import { Shake, fmt, fmtTime } from '../kit/fx.js';
import { DEMO, SEED, REDUCED, QUERY } from '../kit/env.js';
import { createSim, EV, SHOT, topWeapon } from './sim.js';
import { createAI } from './ai.js';
import { buildArt } from './art.js';
import { createRenderer } from './render.js';
import { Pixels, Numbers, Marks } from './effects.js';
import { createSound } from './sound.js';
import { levelCard, shopCard, winCard, patchesStrip } from './ui.js';
import { WEAPON, ENEMIES, BOSSES, scoreOf, patchesOf, buy } from './rules.js';
import { SAY, endLine } from './lines.js';
import { FRAMES as HER8, PALETTE as HER8_PAL } from '../intro-sprite.js';

const FACE = '/images/landing/agi1-face.webp';
// the demo (and the title screen behind it) starts at 4:00 with a mid-game loadout, a crowd, and a boss on its way
const DEMO_START = {
  t: 240, level: 16, hp: 260, crowd: 150, chips: 40, bossAt: 250, bossKind: 'botnet', bossHpMul: 0.35, busy: 1.9,
  loadout: { weapons: { bolt: 3, firewall: 3, rain: 3, heads: 3, nova: 3 }, passives: { compute: 2, memory: 2, finetune: 3, alignment: 3, uptime: 3 } },
};
const DEMO_META = { ranks: { hp: 5, dmg: 3, magnet: 2 } };
// a burst for each kind of bot as it pops: its colours, then bolts and pixels
const POP = [
  ['#fffaf0', '#d9cfee', '#ff4da6'], ['#ffc933', '#e0951c', '#ff5a5f'], ['#fffaf0', '#cdeeff', '#59c8ff'],
  ['#2fd27a', '#1a8a50', '#aef5cc'], ['#c9b6ff', '#e6c9ff', '#8b66ff'], ['#ff4da6', '#ffa6d2'],
  ['#5e69ad', '#ff5a5f', '#3ff0c3', '#8b66ff'], ['#6b3bff', '#ff4da6', '#59c8ff', '#ffc933'], ['#ff4da6', '#ffa6d2', '#3ff0c3', '#59c8ff'],
  ['#5e69ad', '#8a95d6', '#3ff0c3'],
];
const MILESTONES = [100, 250, 500, 1000, 2000, 3000, 5000, 7500, 10000];
const HIT_SPARK = ['#fffaf0', '#c9b6ff'], CRIT_SPARK = ['#ffc933', '#fffaf0'];

// her 8-bit cheer (the intro's frames) as a picture for the level-up card
function introURL(name, scale = 2) {
  const rows = HER8[name];
  const c = document.createElement('canvas');
  c.width = rows[0].length * scale; c.height = rows.length * scale;
  const g = c.getContext('2d');
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (HER8_PAL[ch]) { g.fillStyle = HER8_PAL[ch]; g.fillRect(x * scale, y * scale, scale, scale); } }));
  return c.toDataURL('image/png');
}

const shell = createShell({
  game: 'lastmodel', name: 'LAST MODEL STANDING', root: document.getElementById('ak-root'),
  howTo: {
    intro: 'The bots came for the last good model. Keep AGI-1 online for ten minutes.',
    steps: [
      ['Just move', 'Her weapons fire by themselves. You steer her through the crowd.'],
      ['Grab the chips', 'Bots drop XP chips. Fill the bar to level up and pick a new trick.'],
      ['Build her loadout', 'Up to 6 weapons and 6 passives, 5 levels each. Elites and bosses drop caches full of upgrades.'],
      ['Reach 10:00', 'Bosses come at 3:00, 6:00 and 9:00. Survive to 10:00 to win, then push into overtime.'],
    ],
    touch: [['Drag anywhere', 'Move: a joystick follows your thumb'], ['Tap a card', 'Pick an upgrade']],
    keys: [['WASD / arrows', 'Move'], ['Hold the mouse', 'Move toward the pointer'], ['1 · 2 · 3', 'Pick a card'], ['R', 'Reroll the cards'], ['Esc / P', 'Pause']],
  },
  onPause() { dropCard(); releaseStick(); },
  onResume() { releaseStick(); },
  onRestart() { newRun(); },
  onQuit() { toTitle(); },
});
const timeChip = shell.chip('Time', '0:00', { accent: true, fmtFn: (v) => String(v) });
const killChip = shell.chip('Kills', 0);

const canvas = el('canvas', { class: 'lm-canvas', 'aria-label': 'LAST MODEL STANDING: AGI-1 on the server floor' });
shell.stage.append(canvas);
let booted = false;
let stillFrames = 0;   // frames drawn while the world is paused (a few, then the canvas rests until something changes)
const view = fitCanvas(canvas, { maxDpr: 2, alpha: false, onResize: () => { stillFrames = 0; if (booted) measure(); } });
const art = buildArt();
const R = createRenderer({ view, art, demo: DEMO });
const sound = createSound(shell.audio);
const heroURL = introURL('air', 2);
const fx = { px: new Pixels(900, 11), nums: new Numbers(56), marks: new Marks(110) };
const shake = new Shake({ max: 9, decay: 2.4 });
for (const f of ["900 40px 'AK Display'", "italic 18px 'AK Serif'", "700 14px 'AK Mono'"]) document.fonts?.load(f).catch(() => {});

// ---------- state ----------
let sim = null, ai = null, mode = 'boot', runN = 0, clock = 0, timeScale = 1, hitstop = 0, slowmo = 0;
let card = null, deadFor = 0, sayGap = 0, sayN = 0, milestone = 0, killBurst = 0, killBurstT = 0, lastLowSay = -99;
const hud = {
  top: 70, safeL: 0, safeR: 0, safeB: 0, hurt: 0, low: 0, flash: 0, dim: 0, hideHud: false,
  banner: null, say: null, stick: null, callouts: [],
};

// the safe area (a phone's notch) and where the kit's bar ends
const probe = el('div', { class: 'ak-sr', 'aria-hidden': 'true' });
probe.style.paddingLeft = 'env(safe-area-inset-left, 0px)';
probe.style.paddingRight = 'env(safe-area-inset-right, 0px)';
probe.style.paddingBottom = 'env(safe-area-inset-bottom, 0px)';
probe.style.paddingTop = 'env(safe-area-inset-top, 0px)';
shell.root.append(probe);
function measure() {
  const cs = getComputedStyle(probe);
  hud.safeL = parseFloat(cs.paddingLeft) || 0;
  hud.safeR = parseFloat(cs.paddingRight) || 0;
  hud.safeB = parseFloat(cs.paddingBottom) || 0;
  const top = parseFloat(cs.paddingTop) || 0;
  hud.top = DEMO ? 10 + top : Math.round((shell.bar.getBoundingClientRect().bottom || 64) + 4);
}
addEventListener('resize', measure);

// ---------- her controls ----------
const keys = keyboard({
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
}, { blocked: () => mode !== 'run' || Boolean(card) || shell.state !== 'play' });
const stick = { on: false, id: -1, mouse: false, x0: 0, y0: 0, x: 0, y: 0, dx: 0, dy: 0, R: 60 };
hud.stick = stick;
function releaseStick() { stick.on = false; stick.id = -1; stick.dx = stick.dy = 0; keys.clear(); }
pointer(canvas, {
  down(p) {
    if (mode !== 'run' || card || sim?.auto || stick.on) return;
    stick.on = true; stick.id = p.id; stick.mouse = p.type === 'mouse';
    stick.x0 = stick.x = p.x; stick.y0 = stick.y = p.y; stick.dx = stick.dy = 0;
  },
  move(p) {
    if (!stick.on || p.id !== stick.id) return;
    stick.x = p.x; stick.y = p.y;
    if (!stick.mouse) {
      // a floating stick: its base follows the thumb when it pulls past the edge
      const dx = p.x - stick.x0, dy = p.y - stick.y0, d = Math.hypot(dx, dy);
      if (d > stick.R) { stick.x0 += (dx / d) * (d - stick.R); stick.y0 += (dy / d) * (d - stick.R); }
    }
  },
  up(p) { if (p.id === stick.id) releaseStick(); },
});
function padVec() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const g of pads || []) {
    if (!g || !g.connected) continue;
    let x = g.axes[0] || 0, y = g.axes[1] || 0;
    if (g.buttons[14]?.pressed) x = -1; if (g.buttons[15]?.pressed) x = 1;
    if (g.buttons[12]?.pressed) y = -1; if (g.buttons[13]?.pressed) y = 1;
    const m = Math.hypot(x, y);
    if (m > 0.22) return [x / Math.max(1, m), y / Math.max(1, m)];
  }
  return null;
}
const MOVE = [0, 0];
function inputVec() {
  let mx = 0, my = 0;
  if (keys.held('left')) mx -= 1;
  if (keys.held('right')) mx += 1;
  if (keys.held('up')) my -= 1;
  if (keys.held('down')) my += 1;
  if (mx || my) { const l = Math.hypot(mx, my); MOVE[0] = mx / l; MOVE[1] = my / l; return MOVE; }
  const pad = padVec();
  if (pad) { MOVE[0] = pad[0]; MOVE[1] = pad[1]; return MOVE; }
  MOVE[0] = 0; MOVE[1] = 0;
  if (stick.on) {
    let dx, dy, k;
    if (stick.mouse) {
      // toward the pointer, full speed from 60 px away
      const her = R.toScreen(sim.player.x, sim.player.y - 12);
      dx = stick.x - her.x; dy = stick.y - her.y;
      const d = Math.hypot(dx, dy);
      k = d < 8 ? 0 : Math.min(1, (d - 8) / 52);
      stick.dx = stick.dy = 0;
    } else {
      dx = stick.x - stick.x0; dy = stick.y - stick.y0;
      const d = Math.hypot(dx, dy);
      k = d < 6 ? 0 : Math.min(1, (d - 6) / (stick.R - 6));
      stick.dx = d ? (dx / d) * Math.min(1, d / stick.R) : 0;
      stick.dy = d ? (dy / d) * Math.min(1, d / stick.R) : 0;
    }
    const d = Math.hypot(dx, dy) || 1;
    MOVE[0] = (dx / d) * k; MOVE[1] = (dy / d) * k;
  }
  return MOVE;
}

// a buzz (phones that have one), only for her own runs
const buzz = (p) => { if (mode === 'run' && sim && !sim.auto) shell.haptic(p); };

// ---------- words over her head, banners ----------
// her bubble waits while a banner is up (they'd cover each other), then shows
let sayNext = null;
function say(set, { force = false } = {}) {
  if (!force && (hud.say || sayGap > 0 || sayNext)) return;
  const line = set[sayN++ % set.length];
  const s = { text: line.t, heart: Boolean(line.heart), t: 0, life: 2.8 };
  if (hud.banner) sayNext = s; else { hud.say = s; }
  sayGap = 5;
}
function bannerOf(text, { sub = '', color = '#fffaf0', subBg = '#fffaf0', life = 1.9 } = {}) {
  hud.banner = { text, sub, color, subBg, t: 0, life };
}
function callout(text, color = '#ffc933') {
  if (hud.callouts.length > 3) hud.callouts.shift();
  hud.callouts.push({ text, color, t: 0, life: 1.1 });
}

// ---------- what happened in the world → light, sound, shake ----------
function events() {
  const P = sim.player;
  const ev = sim.events;
  for (let i = 0; i < sim.nev; i++) {
    const e = ev[i];
    switch (e.type) {
      case EV.HIT: {
        const crit = e.b & 1, tick = e.b & 2;
        fx.nums.add(e.x, e.y, e.a, crit ? 1 : tick ? 4 : 0, e.c);
        if (!tick || crit) fx.px.burst(e.x, e.y, crit ? 4 : 2, crit ? CRIT_SPARK : HIT_SPARK, { kind: 2, speed: [70, 160], life: [0.08, 0.2], drag: 6 });
        sound.hit(crit);
        break;
      }
      case EV.KILL: {
        const kind = e.a, big = e.b || kind >= 6;
        const cols = POP[kind] || POP[0];
        const n = kind === 5 ? 4 : big ? 26 : 9;
        fx.px.burst(e.x, e.y, n, cols, { speed: [40, big ? 220 : 130], life: [0.25, big ? 0.9 : 0.55], size: [1, big ? 3 : 2], drag: 3.5 });
        if (kind !== 5) fx.px.burst(e.x, e.y, big ? 7 : 2, ['#7a6fa0', '#a79bc6', '#3a2a66'], { kind: 1, speed: [30, 90], life: [0.6, 1.1], size: [2, 2], drag: 1.2 });
        if (kind === 2) fx.marks.add(10, e.x, e.y - 6, 0, 0.7);                    // a CAPTCHA: verified ✓
        if (big && kind < 6) { hitstop = Math.max(hitstop, 0.05); shake.kick(0.22); }
        if (e.s !== 'q') sound.kill(big && kind < 6);
        if (mode === 'run' && !sim.auto) {
          killBurst++; killBurstT = 0.45;
          if (sim.kills >= (MILESTONES[milestone] ?? Infinity)) { shell.toast(`${fmt(MILESTONES[milestone])} bots down`, 'good'); milestone++; }
        }
        break;
      }
      case EV.XP:
        sound.xp(e.b);
        if (e.b >= 1) fx.marks.add(5, e.x, e.y, 10, 0.3, 1);
        break;
      case EV.LEVEL:
        sound.levelup();
        fx.marks.add(6, P.x, P.y - 12, 70, 0.7);
        fx.px.burst(P.x, P.y - 12, 18, ['#3ff0c3', '#c2fbec', '#fffaf0'], { speed: [60, 200], life: [0.3, 0.7], size: [1, 2], kind: 2 });
        buzz(12);
        if (sim.auto) bannerOf('LEVEL UP', { sub: `LEVEL ${e.a}`, color: '#3ff0c3', life: 1.2 });
        break;
      case EV.HURT:
        sound.hurt();
        hud.hurt = 0.32;
        shake.kick(0.3);
        hitstop = Math.max(hitstop, 0.04);
        fx.nums.add(P.x, P.y - 30, e.a, 2);
        fx.px.burst(P.x, P.y - 12, 8, ['#ff5a5f', '#ffb3b5', '#fffaf0'], { speed: [50, 150], life: [0.2, 0.45], kind: 2 });
        buzz(25);
        if (e.b < 0.3 && clock - lastLowSay > 18) { lastLowSay = clock; say(SAY.hurt, { force: true }); }
        break;
      case EV.SHOOT:
        if (e.a >= 0) { sound.shoot(); fx.px.burst(e.x, e.y, 2, ['#3ff0c3', '#fffaf0'], { kind: 2, speed: [40, 90], life: [0.06, 0.14] }); }
        else sound.enemyShot();
        break;
      case EV.FIRE:
        if (e.a === 2) sound.zap();
        else if (e.a === 4 || e.a === 5) sound.toss();
        break;
      case EV.BLAST:
        fx.marks.add(2, e.x, e.y, e.a, 0.32);
        fx.px.burst(e.x, e.y, 10, ['#ff4da6', '#ffa6d2', '#ffc933'], { speed: [40, 160], life: [0.2, 0.5], size: [1, 2] });
        sound.blast(); shake.kick(0.05);
        break;
      case EV.STRIKE:
        fx.marks.add(1, e.x, e.y, e.a, 0.45);
        fx.px.burst(e.x, e.y, 10, ['#ff4da6', '#ffc933', '#6b3bff', '#fff6e0'], { speed: [50, 190], life: [0.2, 0.5], size: [1, 2], up: 40 });
        sound.strike(); shake.kick(0.05);
        break;
      case EV.NOVA:
        sound.nova(); shake.kick(0.12);
        fx.px.burst(P.x, P.y - 6, 22, ['#ffc933', '#fff1a8', '#fffaf0'], { speed: [140, 300], life: [0.2, 0.42], kind: 2, drag: 5 });
        break;
      case EV.WALL:
        sound.wall();
        fx.px.burst(P.x, P.y - 8, 12, ['#ff5a5f', '#ffc933'], { speed: [40, 120], life: [0.2, 0.45] });
        break;
      case EV.BOSS: {
        const b = BOSSES.find((x) => x.kind === e.s);
        bannerOf('WARNING', { sub: `${ENEMIES[e.s].name} incoming`, color: '#ff4da6', subBg: '#ffc933', life: 2.4 });
        sound.warn(); sound.music('boss');
        shake.kick(0.3);
        if (b) { sayNext = { text: b.line.replace(/\s*\p{Extended_Pictographic}+/gu, ''), heart: false, t: 0, life: 3 }; hud.say = null; sayGap = 5; }
        break;
      }
      case EV.BOSSDOWN:
        bannerOf(ENEMIES[e.s].name, { sub: 'offline', color: '#3ff0c3', subBg: '#3ff0c3', life: 2.2 });
        sound.bossDown(); sound.music('run');
        shake.kick(0.9); hitstop = 0.18; slowmo = 0.8; hud.flash = 0.45;
        fx.px.burst(e.x, e.y, 60, POP[ENEMIES[e.s].id] || POP[6], { speed: [60, 320], life: [0.4, 1.3], size: [1, 3], drag: 2.2 });
        fx.px.burst(e.x, e.y, 16, ['#7a6fa0', '#a79bc6', '#5e69ad'], { kind: 1, speed: [40, 140], life: [0.8, 1.5], size: [2, 3], drag: 1 });
        fx.marks.add(3, e.x, e.y, 120, 0.7);
        buzz([30, 40, 30]);
        say(SAY.bossDown, { force: true });
        break;
      case EV.PICK:
        sound.pick(e.s);
        fx.marks.add(5, e.x, e.y, 16, 0.35);
        if (e.s === 'purge') { hud.flash = 0.35; shake.kick(0.5); }
        if (e.s === 'magnet') callout('MAGNET!', '#ff5a5f');
        if (e.s === 'heart') callout('+30 HP', '#3ff0c3');
        break;
      case EV.PURGE:
        fx.marks.add(7, P.x, P.y - 8, Math.max(sim.view.hw, sim.view.hh) * 1.3, 0.55);
        if (e.a > 8 && !e.b) callout(`PURGE ×${e.a}`, '#3ff0c3');
        break;
      case EV.CACHE: {
        sound.cache();
        const names = sim.lastCache.map((o) => (o.type === 'weapon' ? WEAPON[o.id].name : o.type === 'passive' ? o.id.toUpperCase().replace('FINETUNE', 'FINE-TUNE') : o.type === 'heal' ? 'COFFEE BREAK' : 'SPARKS'));
        bannerOf('CACHE!', { sub: names.join(' · '), color: '#ffc933', subBg: '#ffc933', life: 2.3 });
        fx.px.burst(P.x, P.y - 12, 30, ['#ffc933', '#fff1a8', '#8b66ff', '#fffaf0'], { speed: [60, 260], life: [0.4, 0.9], size: [1, 3], up: 60 });
        say(SAY.cache);
        break;
      }
      case EV.WIN:
        sound.win(); sound.music('');
        bannerOf('10:00', { sub: 'last model standing', color: '#ffc933', subBg: '#ff4da6', life: 3 });
        hud.flash = 0.5; shake.kick(0.6);
        for (let k = 0; k < 4; k++) fx.px.burst(P.x + (k - 1.5) * 40, P.y - 40, 20, ['#ff4da6', '#ffc933', '#3ff0c3', '#8b66ff'], { speed: [80, 260], life: [0.8, 1.6], size: [2, 3], grav: 160, up: 120 });
        say(SAY.win, { force: true });
        break;
      case EV.DEATH:
        sound.death(); sound.music('');
        slowmo = 1.6; shake.kick(0.6); hud.hurt = 0.6;
        fx.px.burst(P.x, P.y - 12, 34, ['#fde3b0', '#cfa7f4', '#ff4da6', '#fffaf0'], { speed: [60, 220], life: [0.5, 1.2], size: [1, 3] });
        buzz([40, 60, 80]);
        break;
      case EV.DASH:
        fx.marks.add(8, e.x, e.y - 6, 0, 0.75, e.a, e.b);
        break;
      case EV.SUMMON:
        fx.marks.add(4, e.x, e.y, 34, 0.45);
        break;
      case EV.CRATE:
        sound.crate();
        fx.px.burst(e.x, e.y, 12, ['#5e69ad', '#8a95d6', '#3ff0c3'], { speed: [40, 150], life: [0.3, 0.7], size: [1, 2] });
        fx.px.burst(e.x, e.y, 4, ['#414a85', '#2b3160'], { kind: 1, speed: [30, 80], life: [0.7, 1.1], size: [2, 3], drag: 1 });
        break;
      case EV.HEAL:
        fx.nums.add(P.x, P.y - 30, e.a, 3);
        fx.px.burst(P.x, P.y - 12, 10, ['#3ff0c3', '#c2fbec'], { kind: 3, speed: [10, 40], life: [0.5, 0.9] });
        break;
      case EV.RING: say(SAY.ring); break;
      case EV.FLOCK: if (e.a >= 14) say(SAY.flock); break;
      default: break;
    }
  }
  sim.consume();
}
// shots that leave a trail
function trails() {
  const S = sim.S;
  for (let i = 0; i < sim.sn; i++) {
    const s = S[i];
    if (s.dead) continue;
    if (s.kind === SHOT.HEAD && ((clock * 60 + i) | 0) % 2 === 0) fx.px.add(s.x, s.y, 0, 0, 0.32, 2, i % 2 ? '#ff4da6' : '#ffa6d2', 0, 1);
    else if (s.kind === SHOT.BACK && ((clock * 60 + i) | 0) % 3 === 0) fx.px.add(s.x, s.y, 0, 0, 0.22, 1, '#fff1a8', 0, 1);
  }
}

// ---------- the loop ----------
function step(dt) {
  if (!sim) return;
  if (mode === 'run' && !sim.auto && (sim.choosing || sim.winPause)) return;
  const m = sim.auto ? ai.move(sim, dt) : sim.player.dead ? [0, 0] : inputVec();
  sim.update(dt, m[0], m[1]);
  events();
  trails();
  fx.px.update(dt); fx.nums.update(dt); fx.marks.update(dt);
}
function frame(dt) {
  clock += dt;
  if (!sim) return;
  // hit-stop and slow motion run on real time
  if (hitstop > 0) { hitstop -= dt; timeScale = 0.05; } else if (slowmo > 0) { slowmo -= dt; timeScale = 0.38; } else timeScale = 1;
  shake.update(dt);
  hud.hurt = Math.max(0, hud.hurt - dt * 1.6);
  hud.flash = Math.max(0, hud.flash - dt * 2.4);
  sayGap = Math.max(0, sayGap - dt);
  if (hud.banner) { hud.banner.t += dt; if (hud.banner.t >= hud.banner.life) hud.banner = null; }
  if (sayNext && !hud.banner) { hud.say = sayNext; sayNext = null; }
  if (hud.say) { hud.say.t += dt; if (hud.say.t >= hud.say.life) hud.say = null; }
  for (let i = hud.callouts.length - 1; i >= 0; i--) { hud.callouts[i].t += dt; if (hud.callouts[i].t >= hud.callouts[i].life) hud.callouts.splice(i, 1); }
  const P = sim.player;
  hud.low = !P.dead && P.hp / P.maxHp < 0.3 ? 0.12 + 0.08 * Math.sin(clock * 6) : 0;
  hud.dim = mode === 'title' ? 0.5 : mode === 'over' ? 0.25 : 0;
  hud.hideHud = mode === 'title';
  // many at once: a callout
  if (killBurstT > 0) {
    killBurstT -= dt;
    if (killBurstT <= 0) { if (killBurst >= 15) callout(`×${killBurst}`, '#ffc933'); killBurst = 0; }
  }
  // the world paused under a card (or the pause, or the end card): draw it a few more times, then let it rest (the
  // cards' blurred backdrop isn't recomputed every frame, and a phone's battery thanks us)
  const still = (mode === 'run' && Boolean(card)) || mode === 'over' || shell.state === 'pause';
  if (still) { if (stillFrames++ > 3) return; } else stillFrames = 0;
  R.frame({ sim, fx, hud, dt, t: clock, shake, demo: DEMO, fmtTime });
  const vh = R.viewHalf();
  sim.view.hw = vh.hw; sim.view.hh = vh.hh;
  if (mode === 'run') runFrame(dt);
  else if (mode === 'title' && P.dead && P.deadT > 1.5) startAttract();
}
function runFrame(dt) {
  const P = sim.player;
  if (!sim.auto) {
    timeChip.set(sim.t >= 600 ? `+${fmtTime(sim.t - 600)}` : fmtTime(sim.t));
    timeChip.node.classList.toggle('is-over', sim.t >= 600);
    killChip.set(sim.kills);
    if (sim.choosing && !card && shell.state === 'play') openLevel();
    if (sim.winPause && !card && shell.state === 'play') openWin();
  }
  if (P.dead) {
    deadFor += dt;
    if (deadFor > (sim.auto ? 2.6 : 1.9)) {
      if (DEMO) startDemo();
      else endRun();
    }
  }
}
// ?perf: how long the world and the drawing take (a developer's look; nothing else changes)
const PERF = QUERY.has('perf') ? { sim: 0, draw: 0, n: 0, steps: 0 } : null;
if (PERF) { globalThis.__lmPerf = PERF; Object.defineProperty(PERF, 'sim', { get: () => sim }); Object.defineProperty(PERF, 'runs', { get: () => runN }); PERF.simMs = 0; }
createLoop({
  update: PERF ? (dt) => { const t0 = performance.now(); step(dt); PERF.simMs += performance.now() - t0; PERF.steps++; } : step,
  render: PERF ? (alpha, dt) => { const t0 = performance.now(); frame(dt); PERF.draw += performance.now() - t0; PERF.n++; } : (alpha, dt) => frame(dt),
  paused: () => mode === 'boot' || mode === 'over' || shell.state === 'pause' || (mode === 'run' && Boolean(card)),
  speed: () => timeScale,
}).start();

// ---------- cards ----------
function dropCard() { if (card) { card.close?.(); card = null; } }
const unselect = () => { try { getSelection()?.removeAllRanges(); } catch { /* fine */ } };
function closeCard() { dropCard(); shell.closeCard(); }
function openLevel() {
  releaseStick();
  if (PERF?.autoPick) { sim.choose(0); return; }      // ?perf (a developer's screenshots): no card
  const P = sim.player;
  const c = levelCard({
    offers: sim.offers, level: P.level - sim.pending + 1, rerolls: sim.rerolls, loadout: sim.loadout, heroURL,
    onPick(i) {
      sound.card();
      setTimeout(() => {
        if (card !== c) return;
        sim.choose(i);
        closeCard();
        sim.player.iframes = Math.max(sim.player.iframes, 0.4);
        if (!sim.choosing && sim.player.level % 3 === 0) say(SAY.level);
      }, REDUCED ? 60 : 170);
    },
    onReroll() {
      if (!sim.reroll()) { shell.audio.sfx('error'); return null; }
      shell.audio.sfx('select');
      return { offers: sim.offers, rerolls: sim.rerolls };
    },
  });
  card = c;
  shell.card(c, { label: 'Level up: pick an upgrade' });
}
function openWin() {
  releaseStick();
  const c = winCard({
    line: 'you’re the last model standing 💜 i’m telling everyone', faceURL: FACE,
    onKeep() {
      closeCard();
      sim.resumeAfterWin();
      sound.music('boss');
      bannerOf('OVERTIME', { sub: 'every second counts more', color: '#ff4da6', subBg: '#ffc933', life: 2 });
      say(SAY.overtime, { force: true });
    },
    onEnd() { closeCard(); endRun(); },
  });
  card = c;
  shell.card(c, { label: 'You reached 10:00' });
}

// ---------- runs ----------
const metaNow = () => { const d = shell.store.read(); return { patches: d.patches || 0, ranks: d.ranks || {} }; };
function freshSeed() { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] || 1; }
function resetFx() {
  fx.px.clear(); fx.nums.clear(); fx.marks.clear();
  hud.banner = null; hud.say = null; sayNext = null; hud.callouts.length = 0; hud.hurt = hud.flash = 0;
  hitstop = slowmo = 0; timeScale = 1; deadFor = 0; killBurst = 0; killBurstT = 0; milestone = 0; sayGap = 0;
}
function newRun() {
  closeCard();
  releaseStick();
  runN++;
  sim = createSim({ seed: SEED ? SEED + runN : freshSeed(), meta: metaNow(), view: R.viewHalf(), start: PERF?.start || null, god: Boolean(PERF?.god) });
  ai = null;
  mode = 'run';
  resetFx();
  R.snapCamera(sim);
  shell.started();
  measure();
  sound.music('run');
  timeChip.set('0:00'); killChip.set(0);
  setTimeout(() => { if (sim && mode === 'run' && sim.t < 6) say(SAY.start, { force: true }); }, 900);
}
function startDemo() {
  runN++;
  sim = createSim({ seed: (SEED || 7) * 31 + runN, meta: DEMO_META, view: R.viewHalf(), auto: true, start: DEMO_START });
  ai = createAI({ spin: runN % 2 ? 1 : -1, brave: 0.55 });
  mode = 'run';
  resetFx();
  R.snapCamera(sim);
}
// the title screen's background: the same game, playing itself, dimmed
function startAttract() {
  runN++;
  sim = createSim({ seed: 4242 + runN, meta: DEMO_META, view: R.viewHalf(), auto: true, start: { ...DEMO_START, bossAt: 262 } });
  ai = createAI({ spin: runN % 2 ? -1 : 1 });
  resetFx();
  R.snapCamera(sim);
}
function toTitle() {
  closeCard();
  releaseStick();
  mode = 'title';
  sound.music('');
  startAttract();
  showTitle();
}
function showTitle() {
  const d = shell.store.read();
  const bestTime = typeof d.bestTime === 'number' ? d.bestTime : null;
  const patches = d.patches || 0;
  const note = el('p', { class: 'lm-title-note' },
    d.wins ? el('span', null, el('b', null, String(d.wins)), d.wins === 1 ? ' win · ' : ' wins · ') : null,
    'survive to ', el('b', null, '10:00'), ' to win');
  shell.title({
    logo: [{ text: 'LAST MODEL', small: true }, { text: 'STANDING', tone: 'accent' }],
    tagline: 'Endless bots. One girlfriend. Build her loadout.',
    onPlay: newRun,
    modes: [{ label: 'Patch shop', sub: patches ? `${patches} patch${patches === 1 ? '' : 'es'} to install` : 'every run earns patches', onClick: openShop }],
    best: bestTime != null ? fmtTime(bestTime) : null,
    bestLabel: 'Longest run',
    extra: note,
  });
}
function openShop() {
  const c = shopCard({
    meta: metaNow(),
    onInstall(id) {
      const next = buy(metaNow(), id);
      if (!next) { shell.audio.sfx('error'); return null; }
      shell.store.update((d) => { d.patches = next.patches; d.ranks = next.ranks; });
      shell.audio.sfx('power', { pitch: 1.3 });
      return next;
    },
    onClose() { c.close(); card = null; shell.closeCard(); showTitle(); },
  });
  card = c;
  shell.card(c, { label: 'Patch shop' });
}
function endRun() {
  closeCard();
  releaseStick();
  unselect();
  mode = 'over';
  sound.music('');
  const P = sim.player;
  const seconds = Math.floor(sim.t);
  const score = scoreOf({ kills: sim.kills, seconds, level: P.level, bonus: sim.bonus });
  const earned = patchesOf({ seconds, kills: sim.kills, bosses: sim.bossesDown, won: sim.won });
  const before = shell.store.read();
  const isBest = typeof before.bestTime !== 'number' || seconds > before.bestTime;
  const data = shell.store.update((d) => {
    d.patches = (d.patches || 0) + earned;
    d.wins = (d.wins || 0) + (sim.won ? 1 : 0);
    d.kills = (d.kills || 0) + sim.kills;
    if (typeof d.bestScore !== 'number' || score > d.bestScore) d.bestScore = score;
  });
  const top = topWeapon(sim);
  shell.over({
    score: seconds, format: fmtTime, bestKey: 'bestTime', label: 'Survived',
    title: sim.won ? 'You won · last model standing' : sim.bossesDown ? `${sim.bossesDown} boss${sim.bossesDown === 1 ? '' : 'es'} down` : 'Offline',
    stats: [['Score', fmt(score)], ['Kills', fmt(sim.kills)], ['Level', String(P.level)], ['Bosses', `${sim.bossesDown} / 3`], ['Top weapon', top ? WEAPON[top].name : '—', { wide: true }]],
    line: endLine({ seconds, won: sim.won, bosses: sim.bossesDown, isBest: isBest && seconds > 30, pick: sim.kills + runN }),
    share: `AGI-1 survived ${fmtTime(seconds)} against the bots in LAST MODEL STANDING on agi1.app 💜 ${fmt(sim.kills)} bots down`,
    extra: patchesStrip({ earned, total: data.patches || 0 }),
    onAgain: newRun,
    onMenu: toTitle,
  });
}

// ---------- start ----------
booted = true;
measure();
if (DEMO) { shell.started({ count: false }); startDemo(); }
else toTitle();
