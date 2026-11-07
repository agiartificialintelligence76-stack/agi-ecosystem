// JAILBREAK: THE WARDEN, the bot at the end of every world. It sways across the top of the field behind a row of
// shield plates (they grow back), drops bombs on the paddle (a bomb stuns it for a moment; the ball or a laser pops
// it), and every few seconds its eye lights up: a hit then does triple damage. Below half its health it gets angry
// (faster, more bombs). Tougher in every world. Pure: sim.js calls these with the game's state.
import { FIELD_W, GRID_TOP } from './levels.js';

export const WARDEN_W = 140, WARDEN_H = 60;
export const WARDEN_Y = GRID_TOP + 52;
export const PLATE = { w: 30, h: 10, step: 34 };
export const BOMB_R = 8;
export const EYE_WARN = 0.7;          // its eye blinks this long before it opens
export const DYING = 1.6;             // its last explosions, before the level is clear

// world → { hp, sway (its speed side to side), bombEvery (s), bombSpeed, twin (two bombs at once), plates, plateHp,
// regrow (s for a plate to grow back), eyeShut (s), eyeOpen (s) }
export const WARDEN = [
  { hp: 16, sway: 0.55, bombEvery: 3.6, bombSpeed: 170, twin: false, plates: 3, plateHp: 1, regrow: 9, eyeShut: 4.5, eyeOpen: 2.6 },
  { hp: 22, sway: 0.65, bombEvery: 3.1, bombSpeed: 185, twin: false, plates: 4, plateHp: 1, regrow: 8, eyeShut: 5, eyeOpen: 2.4 },
  { hp: 30, sway: 0.75, bombEvery: 2.8, bombSpeed: 200, twin: false, plates: 4, plateHp: 1, regrow: 7, eyeShut: 5, eyeOpen: 2.3 },
  { hp: 32, sway: 0.85, bombEvery: 2.6, bombSpeed: 210, twin: true, plates: 4, plateHp: 2, regrow: 6.5, eyeShut: 5.5, eyeOpen: 2.1 },
  { hp: 36, sway: 0.95, bombEvery: 2.4, bombSpeed: 225, twin: true, plates: 4, plateHp: 2, regrow: 6, eyeShut: 5.5, eyeOpen: 2.0 },
  { hp: 44, sway: 1.05, bombEvery: 2.1, bombSpeed: 240, twin: true, plates: 5, plateHp: 2, regrow: 5, eyeShut: 6, eyeOpen: 1.9 },
];
// endless mode's Warden on layer n (a little tougher every time it comes back)
export function endlessWarden(n) {
  const k = Math.min(5, Math.floor(n / 6));
  const base = WARDEN[k];
  return { ...base, hp: Math.round(base.hp * (0.8 + n * 0.02)) };
}

export function makeWarden(cfg, W = FIELD_W) {
  return {
    cfg, x: W / 2, y: WARDEN_Y, w: WARDEN_W, h: WARDEN_H, hp: cfg.hp, maxHp: cfg.hp,
    sw: 0, t: 0, angry: false, eye: 'shut', eyeT: 0, bombT: cfg.bombEvery * 0.6, regrowT: 0,
    flash: 0, squash: 0, dying: 0, dead: false, boomT: 0, hits: 0, crits: 0,
  };
}

// its shield plates, as bricks the sim keeps with the others (attached: they move with it)
export function platesOf(boss) {
  const n = boss.cfg.plates, out = [];
  for (let i = 0; i < n; i++) out.push({ offX: (i - (n - 1) / 2) * PLATE.step, offY: WARDEN_H / 2 + 4, slot: i });
  return out;
}

// One step: it sways, bobs, cycles its eye, drops bombs and grows plates back. `api` is the sim's: { bomb(x, y, vy),
// regrow(slot) → bool (a plate came back), ev(type, data), rng }
export function stepWarden(boss, dt, W, api) {
  boss.t += dt;
  boss.flash = Math.max(0, boss.flash - dt * 5);
  boss.squash = Math.max(0, boss.squash - dt * 4);
  if (boss.dead) return;
  if (boss.dying > 0) {
    boss.dying -= dt;
    boss.boomT -= dt;
    if (boss.boomT <= 0) {
      boss.boomT = 0.16;
      api.ev('boss-boom', { x: boss.x + (api.rng.next() - 0.5) * boss.w, y: boss.y + (api.rng.next() - 0.5) * boss.h });
    }
    if (boss.dying <= 0) { boss.dead = true; api.ev('boss-gone', { x: boss.x, y: boss.y }); }
    return;
  }
  const c = boss.cfg, mad = boss.angry ? 1.3 : 1;
  boss.sw += c.sway * mad * dt;
  const A = (W - boss.w) / 2 - 8;
  boss.x = W / 2 + A * Math.sin(boss.sw);
  boss.y = WARDEN_Y + Math.sin(boss.t * 1.7) * 5;
  // its eye: shut → blinking → open → shut
  boss.eyeT += dt;
  if (boss.eye === 'shut' && boss.eyeT >= c.eyeShut) { boss.eye = 'warn'; boss.eyeT = 0; api.ev('eye', { state: 'warn' }); }
  else if (boss.eye === 'warn' && boss.eyeT >= EYE_WARN) { boss.eye = 'open'; boss.eyeT = 0; api.ev('eye', { state: 'open' }); }
  else if (boss.eye === 'open' && boss.eyeT >= c.eyeOpen) { boss.eye = 'shut'; boss.eyeT = 0; api.ev('eye', { state: 'shut' }); }
  // bombs
  boss.bombT += dt;
  const every = c.bombEvery * (boss.angry ? 0.75 : 1);
  if (boss.bombT >= every) {
    boss.bombT = 0;
    const y = boss.y + boss.h / 2 + 2;
    if (c.twin) { api.bomb(boss.x - 36, y); api.bomb(boss.x + 36, y); } else api.bomb(boss.x, y);
    api.ev('bomb-drop', { x: boss.x, y });
  }
  // a plate grows back now and then
  boss.regrowT += dt;
  if (boss.regrowT >= c.regrow * (boss.angry ? 0.8 : 1)) {
    boss.regrowT = 0;
    api.regrow();
  }
}

// The ball (or a laser, or a blast) hit it: → the damage done
export function hurtWarden(boss, base, api, { x = boss.x, y = boss.y } = {}) {
  if (boss.dead || boss.dying > 0) return 0;
  const crit = boss.eye === 'open';
  const dmg = crit ? base * 3 : base;
  boss.hp = Math.max(0, boss.hp - dmg);
  boss.flash = 1;
  boss.squash = 1;
  boss.hits++;
  if (crit) boss.crits++;
  api.ev('boss-hit', { x, y, crit, dmg });
  if (!boss.angry && boss.hp > 0 && boss.hp <= boss.maxHp / 2) { boss.angry = true; api.ev('boss-angry', {}); }
  if (boss.hp <= 0) {
    boss.dying = DYING;
    boss.boomT = 0;
    boss.eye = 'shut';
    api.ev('boss-down', { x: boss.x, y: boss.y });
  }
  return dmg;
}

export const wardenBox = (b) => [b.x - b.w / 2, b.y - b.h / 2, b.x + b.w / 2, b.y + b.h / 2];
