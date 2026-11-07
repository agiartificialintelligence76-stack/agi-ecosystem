// JAILBREAK: the game itself, pure (no DOM, no clock, no Math.random): a level's bricks, the balls, the paddle,
// power-ups, THE WARDEN, scoring, combos and lives. game.js steps it 120 times a second with the player's input
// ({ x: the paddle's target or null, dir: -1 | 0 | 1 for the keys, action: a tap or Space this step }) and draws what
// it sees, plus the events it leaves in `s.events`; ai.js plays it for ?demo and the title screen; tests run it in Node.
import { rng as makeRng } from '../kit/fx.js';
import { newHit, sweepBox, sweepWalls, reflect, minClimb, paddleOffset, launchVelocity, rotate } from './physics.js';
import { CELL_W, CELL_H, GRID_TOP, FIELD_W, BREAKABLE, parseLevel, moveOffset } from './levels.js';
import { WARDEN, BOMB_R, PLATE, makeWarden, platesOf, stepWarden, hurtWarden } from './boss.js';

export const BALL_R = 7;
// the paddle: its width, height, how far above the field's bottom its top is, its keys (acceleration), and how much
// wider than it looks it catches (forgiving)
export const PADDLE = { w: 80, h: 14, gap: 92, wide: 1.45, shrink: 0.62, keySpeed: 980, keyAccel: 5200, keyStart: 300, grace: 3 };
// the ball's speed: each world's to start with, a little faster the longer a level goes (heat), a cap
export const SPEED = { worlds: [360, 378, 395, 410, 425, 440], cap: 760, heat: 0.0035, heatMax: 0.3, slow: 0.7, fast: 1.32, ease: 5 };
export const DUR = { wide: 15, shrink: 10, laser: 8, sticky: 12, slow: 10, fire: 6, fast: 8 };
export const TIMING = { intro: 0.9, serveAuto: 3, lost: 1.05, stickyHold: 2.5, laserEvery: 0.42, laserCd: 0.15, blast: 0.075, calm: 9, stun: 0.85 };
export const LIVES = { start: 3, max: 5 };
export const LIMITS = { balls: 9, capsules: 3, drop: 0.1 };
export const POINTS = { normal: 10, tough: 10, crack: 5, glass: 15, bomb: 25, key: 50, power: 20, shield: 15, gates: 250,
  pickup: 50, hazard: 10, bossHit: 100, bossDown: 1000, bossWorld: 500, bombPop: 30, multMax: 20 };
// the power-ups: name, good or a hazard, how often they drop
export const POWERS = {
  multi: { name: 'MULTIBALL', good: true, weight: 16 },
  wide: { name: 'WIDE', good: true, weight: 15 },
  laser: { name: 'LASER', good: true, weight: 12 },
  sticky: { name: 'STICKY', good: true, weight: 10 },
  slow: { name: 'SLOW', good: true, weight: 10 },
  fire: { name: 'FIREBALL', good: true, weight: 9 },
  life: { name: '+LIFE', good: true, weight: 3 },
  shrink: { name: 'SHRINK', good: false, weight: 9 },
  fast: { name: 'FAST', good: false, weight: 8 },
};
export const POWER_IDS = Object.keys(POWERS);
export const NO_INPUT = Object.freeze({ x: null, dir: 0, action: false });

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const H1 = newHit(), H2 = newHit();

export function createSim({ seed = 1, H = 700, mode = 'story' } = {}) {
  return {
    W: FIELD_W, H, mode, seed, rng: makeRng((seed >>> 0) || 1),
    t: 0, levelT: 0, playT: 0, phase: 'idle', phaseT: 0, introLen: TIMING.intro,
    def: null, world: 1, bricks: [], movers: [], portals: [], keysLeft: 0, gatesOpen: true, required: 0, total: 0,
    balls: [], capsules: [], lasers: [], bombs: [], blasts: [], boss: null, plateSlots: [],
    paddle: { x: FIELD_W / 2, y: H - PADDLE.gap, w: PADDLE.w, h: PADDLE.h, kv: 0, vx: 0, stun: 0, squash: 0, flash: 0, fire: 0 },
    fx: { wide: 0, shrink: 0, laser: 0, sticky: 0, slow: 0, fire: 0, fast: 0 },
    lives: LIVES.start, score: 0, combo: 0, bestCombo: 0, broken: 0, levelLost: 0, runLost: 0, pickups: 0,
    baseSpeed: SPEED.worlds[0], laserT: 0, laserCd: 0, hitStop: 0, lastBreak: null, allLost: false, nextId: 1,
    events: [],
  };
}

const ev = (s, type, data = {}) => { data.type = type; s.events.push(data); return data; };

// ---------- a level ----------
export function startLevel(s, def, { H = s.H, intro = TIMING.intro } = {}) {
  s.H = H;
  s.def = def;
  s.world = def.world || 1;
  const L = parseLevel(def);
  s.bricks = L.bricks.map((c) => {
    const kind = c.kind;
    return {
      id: s.nextId++, row: c.row, col: c.col, kind, tone: c.tone, hp: c.hp, maxHp: c.hp,
      x: c.col * CELL_W, y: GRID_TOP + c.row * CELL_H, bx: c.col * CELL_W, w: CELL_W, h: CELL_H,
      alive: true, required: BREAKABLE.has(kind) && !def.boss, mover: -1, attached: false, flash: 0, hitT: 9, offX: 0, offY: 0,
    };
  });
  s.movers = (def.move || []).map((m) => ({ ...m, offset: 0 }));
  s.movers.forEach((m, i) => { for (const b of s.bricks) if (b.row === m.row) b.mover = i; });
  s.portals = L.portals.map((p) => ({ x: p.col * CELL_W + CELL_W / 2, y: GRID_TOP + p.row * CELL_H + CELL_H / 2, r: 12, pair: p.pair, end: p.end, twin: null }));
  for (const p of s.portals) p.twin = s.portals.find((o) => o.pair === p.pair && o.end !== p.end) || null;
  s.keysLeft = s.bricks.filter((b) => b.kind === 'key').length;
  s.gatesOpen = s.keysLeft === 0;
  s.required = s.bricks.filter((b) => b.required).length;
  s.total = s.required;
  s.boss = null;
  s.plateSlots = [];
  if (def.boss) {
    const cfg = def.warden || WARDEN[Math.max(0, Math.min(5, s.world - 1))];
    s.boss = makeWarden(cfg, s.W);
    s.plateSlots = platesOf(s.boss);
    for (const slot of s.plateSlots) addPlate(s, slot);
  }
  s.capsules.length = 0; s.lasers.length = 0; s.bombs.length = 0; s.blasts.length = 0; s.balls.length = 0;
  for (const k of Object.keys(s.fx)) s.fx[k] = 0;
  const P = s.paddle;
  P.y = s.H - PADDLE.gap; P.x = s.W / 2; P.w = PADDLE.w; P.kv = 0; P.vx = 0; P.stun = 0; P.squash = 0; P.flash = 0;
  s.levelT = 0; s.playT = 0; s.levelLost = 0; s.combo = 0; s.lastBreak = null; s.allLost = false; s.hitStop = 0;
  s.baseSpeed = def.speed || SPEED.worlds[clamp(s.world - 1, 0, 5)];
  s.phase = 'intro'; s.phaseT = 0; s.introLen = intro;
  serveBall(s);
  ev(s, 'level', { id: def.id });
  return s;
}

function addPlate(s, slot) {
  const B = s.boss;
  const b = {
    id: s.nextId++, row: -1, col: -1, kind: 'shield', tone: 0, hp: B.cfg.plateHp, maxHp: B.cfg.plateHp,
    x: B.x + slot.offX - PLATE.w / 2, y: B.y + slot.offY, bx: 0, w: PLATE.w, h: PLATE.h,
    alive: true, required: false, mover: -1, attached: true, offX: slot.offX - PLATE.w / 2, offY: slot.offY, slot: slot.slot, flash: 0, hitT: 9,
  };
  s.bricks.push(b);
  return b;
}

function newBall(s, props) {
  return { id: s.nextId++, x: s.paddle.x, y: s.paddle.y - BALL_R - 0.5, px: 0, py: 0, vx: 0, vy: 0, r: BALL_R,
    stuck: false, off: 0, stuckT: 0, portalCd: 0, calm: 0, trail: [], ...props };
}
function serveBall(s) {
  const b = newBall(s, { stuck: true, off: 0.16 });
  b.px = b.x; b.py = b.y;
  s.balls.push(b);
  return b;
}

export function targetSpeed(s) {
  let v = s.baseSpeed * (1 + Math.min(SPEED.heatMax, s.playT * SPEED.heat));
  if (s.fx.slow > 0) v *= SPEED.slow;
  if (s.fx.fast > 0) v *= SPEED.fast;
  return Math.min(SPEED.cap, v);
}

function release(s, b) {
  const v = launchVelocity(b.off, targetSpeed(s));
  b.vx = v.vx; b.vy = v.vy; b.stuck = false; b.stuckT = 0; b.calm = 0;
  ev(s, 'launch', { x: b.x, y: b.y });
}

// ---------- one step ----------
export function step(s, dt, input = NO_INPUT) {
  if (s.phase === 'idle' || s.phase === 'over') return;
  s.t += dt; s.phaseT += dt; s.levelT += dt;
  if (s.phase === 'live') s.playT += dt;
  stepPaddle(s, dt, input);
  stepTimers(s, dt);
  stepMovers(s);
  if (s.boss) stepBoss(s, dt);
  stepBlasts(s, dt);
  if (s.phase === 'intro' && s.phaseT >= s.introLen) { s.phase = 'serve'; s.phaseT = 0; }
  else if (s.phase === 'serve' && (input.action || s.phaseT >= TIMING.serveAuto)) {
    for (const b of s.balls) if (b.stuck) release(s, b);
    s.phase = 'live'; s.phaseT = 0;
  } else if (s.phase === 'lost' && s.phaseT >= TIMING.lost) {
    if (s.lives > 0) { serveBall(s); s.phase = 'serve'; s.phaseT = 0; }
    else { s.phase = 'over'; ev(s, 'over', {}); return; }
  }
  if (s.phase !== 'clear') {
    stepBalls(s, dt, input);
    stepCapsules(s, dt);
    stepLasers(s, dt, input);
    stepBombs(s, dt);
  }
  for (const b of s.bricks) { if (b.flash > 0) b.flash = Math.max(0, b.flash - dt * 6); b.hitT += dt; }
  const P = s.paddle;
  P.squash = Math.max(0, P.squash - dt * 5);
  P.flash = Math.max(0, P.flash - dt * 3);
  if (s.phase === 'live' || s.phase === 'serve') {
    if (s.required <= 0 && (!s.boss || s.boss.dead)) {
      s.phase = 'clear'; s.phaseT = 0;
      for (const b of s.balls) b.stuck = false;
      s.capsules.length = 0; s.bombs.length = 0; s.lasers.length = 0;
      ev(s, 'clear', { x: s.lastBreak?.x ?? s.W / 2, y: s.lastBreak?.y ?? s.H / 3 });
    } else if (s.allLost) loseLife(s);
  }
  s.allLost = false;
}

function loseLife(s) {
  s.lives = Math.max(0, s.lives - 1);
  s.levelLost++; s.runLost++;
  s.combo = 0;
  for (const k of Object.keys(s.fx)) s.fx[k] = 0;
  s.capsules.length = 0; s.lasers.length = 0; s.bombs.length = 0;
  s.paddle.stun = 0;
  s.phase = 'lost'; s.phaseT = 0;
  ev(s, 'life-lost', { lives: s.lives });
}

function stepPaddle(s, dt, input) {
  const P = s.paddle;
  P.y = s.H - PADDLE.gap;
  const tw = PADDLE.w * (s.fx.wide > 0 ? PADDLE.wide : s.fx.shrink > 0 ? PADDLE.shrink : 1);
  P.w += (tw - P.w) * (1 - Math.exp(-12 * dt));
  const half = P.w / 2, prev = P.x;
  if (P.stun > 0) { P.stun = Math.max(0, P.stun - dt); P.kv = 0; }
  else if (input.x != null && Number.isFinite(input.x)) { P.x = input.x; P.kv = 0; }
  else if (input.dir) {
    if (Math.sign(P.kv) !== input.dir) P.kv = input.dir * PADDLE.keyStart;
    P.kv = clamp(P.kv + input.dir * PADDLE.keyAccel * dt, -PADDLE.keySpeed, PADDLE.keySpeed);
    P.x += P.kv * dt;
  } else P.kv = 0;
  P.x = clamp(P.x, half, s.W - half);
  P.vx = (P.x - prev) / dt;
}

function stepTimers(s, dt) {
  const fx = s.fx;
  for (const k of Object.keys(fx)) if (fx[k] > 0) {
    fx[k] = Math.max(0, fx[k] - dt);
    if (!fx[k]) {
      ev(s, 'power-end', { kind: k });
      if (k === 'sticky') for (const b of s.balls) if (b.stuck && s.phase === 'live') release(s, b);
    }
  }
  s.laserCd = Math.max(0, s.laserCd - dt);
}

function stepMovers(s) {
  if (!s.movers.length) return;
  for (const m of s.movers) m.offset = moveOffset(m, s.levelT);
  for (const b of s.bricks) if (b.mover >= 0) b.x = b.bx + s.movers[b.mover].offset;
}

function stepBoss(s, dt) {
  const B = s.boss;
  stepWarden(B, dt, s.W, {
    rng: s.rng,
    ev: (type, data) => ev(s, type, data),
    bomb: (x, y) => s.bombs.push({ x, y, vy: 40, r: BOMB_R, t: 0, id: s.nextId++ }),
    regrow: () => {
      const missing = s.plateSlots.find((slot) => !s.bricks.some((b) => b.attached && b.alive && b.slot === slot.slot));
      if (!missing) return false;
      const p = addPlate(s, missing);
      ev(s, 'plate', { x: p.x + p.w / 2, y: p.y + p.h / 2 });
      return true;
    },
  });
  for (const b of s.bricks) if (b.attached) { b.x = B.x + b.offX; b.y = B.y + b.offY; }
  if (B.dying > 0 && !B.cleared) {
    // its last moments: everything left on the field goes with it, one after another
    B.cleared = true;
    s.bombs.length = 0;
    let i = 0;
    for (const b of s.bricks) if (b.alive && b.kind !== 'steel' && b.kind !== 'gate') {
      s.blasts.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, t: 0.25 + (i++ % 24) * 0.05, only: b.id });
    }
  }
}

// ---------- the balls ----------
const WALL = 1, PAD = 2, BRICK = 3, BOSS = 4;

function stepBalls(s, dt, input) {
  const P = s.paddle;
  let released = false;
  for (let i = s.balls.length - 1; i >= 0; i--) {
    const b = s.balls[i];
    b.px = b.x; b.py = b.y;
    if (b.stuck) {
      b.x = clamp(P.x + b.off * (P.w / 2), b.r, s.W - b.r);
      b.y = P.y - b.r - 0.5;
      if (s.phase === 'live') {
        b.stuckT += dt;
        if ((input.action && !released) || b.stuckT >= TIMING.stickyHold) { release(s, b); released = true; }
      }
      continue;
    }
    // its speed eases to where it should be (a power-up's change is felt, not jarring)
    const sp = Math.hypot(b.vx, b.vy) || 1;
    const want = targetSpeed(s);
    const next = sp + (want - sp) * (1 - Math.exp(-SPEED.ease * dt));
    b.vx *= next / sp; b.vy *= next / sp;
    pushOut(s, b);
    sweepBall(s, b, dt);
    b.portalCd = Math.max(0, b.portalCd - dt);
    if (s.portals.length && b.portalCd <= 0) portal(s, b);
    // bombs touched by a ball pop
    for (let j = s.bombs.length - 1; j >= 0; j--) {
      const m = s.bombs[j];
      const dx = m.x - b.x, dy = m.y - b.y, rr = m.r + b.r;
      if (dx * dx + dy * dy < rr * rr) { s.bombs.splice(j, 1); s.score += POINTS.bombPop; ev(s, 'bomb-pop', { x: m.x, y: m.y, pts: POINTS.bombPop }); }
    }
    // the anti-stall nudge: a ball that's hit nothing useful for a long while gets a small turn
    b.calm += dt;
    if (b.calm > TIMING.calm) { rotate(b, (s.rng.next() < 0.5 ? -1 : 1) * (0.14 + s.rng.next() * 0.1)); minClimb(b); b.calm = TIMING.calm - 3; }
    // trail (every other step)
    if ((s.t * 120 | 0) % 2 === 0) { b.trail.unshift(b.x, b.y); if (b.trail.length > 20) b.trail.length = 20; }
    if (b.y - b.r > P.y + P.h + 40) {
      s.balls.splice(i, 1);
      ev(s, 'ball-lost', { x: b.x });
    }
  }
  if (s.phase === 'live' && s.balls.length === 0) s.allLost = true;
}

// a moving brick, a plate or the Warden moved into a ball: out it goes (the shallowest way) and off it bounces
function pushOut(s, b) {
  const movers = s.movers.length > 0 || s.boss;
  if (!movers) return;
  const test = (x0, y0, x1, y1) => {
    const cx = clamp(b.x, x0, x1), cy = clamp(b.y, y0, y1);
    let dx = b.x - cx, dy = b.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= b.r * b.r) return;
    let nx, ny, depth;
    if (d2 > 1e-9) { const d = Math.sqrt(d2); nx = dx / d; ny = dy / d; depth = b.r - d; }
    else {          // its center inside: out the nearest face
      const l = b.x - x0, r = x1 - b.x, u = b.y - y0, dn = y1 - b.y, m = Math.min(l, r, u, dn);
      nx = m === l ? -1 : m === r ? 1 : 0; ny = m === u ? -1 : m === dn ? 1 : 0; if (nx && ny) ny = 0;
      depth = b.r + m;
    }
    b.x += nx * (depth + 0.05); b.y += ny * (depth + 0.05);
    reflect(b, nx, ny);
  };
  for (const k of s.bricks) if (k.alive && (k.mover >= 0 || k.attached) && solid(s, k)) test(k.x, k.y, k.x + k.w, k.y + k.h);
  const B = s.boss;
  if (B && !B.dead && B.dying <= 0) test(B.x - B.w / 2, B.y - B.h / 2, B.x + B.w / 2, B.y + B.h / 2);
  b.x = clamp(b.x, b.r, s.W - b.r);
  if (b.y < b.r) b.y = b.r;
}

// steel and shut gates stop everything; glass and a fireball's bricks are broken on the way through
const solid = (s, k) => k.alive;
const passes = (s, k) => k.kind === 'glass' || (s.fx.fire > 0 && BREAKABLE.has(k.kind)) || k.kind === 'shield' && s.fx.fire > 0;

function sweepBall(s, b, dt) {
  let rem = dt;
  const P = s.paddle, B = s.boss;
  for (let iter = 0; iter < 12 && rem > 1e-7; iter++) {
    const dx = b.vx * rem, dy = b.vy * rem;
    let bt = 2, bnx = 0, bny = 0, what = 0, target = null;
    if (sweepWalls(b.x, b.y, dx, dy, b.r, s.W, H1) && H1.t < bt) { bt = H1.t; bnx = H1.nx; bny = H1.ny; what = WALL; }
    const hw = P.w / 2 + PADDLE.grace;
    if (b.vy > 0 && sweepBox(b.x, b.y, dx, dy, b.r, P.x - hw, P.y, P.x + hw, P.y + P.h, H1) && H1.t < bt) {
      bt = H1.t; bnx = H1.nx; bny = H1.ny; what = PAD;
    }
    const minx = (dx < 0 ? b.x + dx : b.x) - b.r, maxx = (dx < 0 ? b.x : b.x + dx) + b.r;
    const miny = (dy < 0 ? b.y + dy : b.y) - b.r, maxy = (dy < 0 ? b.y : b.y + dy) + b.r;
    for (const k of s.bricks) {
      if (!k.alive || k.x > maxx || k.x + k.w < minx || k.y > maxy || k.y + k.h < miny) continue;
      if (!sweepBox(b.x, b.y, dx, dy, b.r, k.x, k.y, k.x + k.w, k.y + k.h, H2)) continue;
      // a face beats a corner at the same moment (no false bump where two bricks meet)
      const tt = H2.t + (H2.nx !== 0 && H2.ny !== 0 ? 1e-7 : 0);
      if (tt < bt) { bt = tt; bnx = H2.nx; bny = H2.ny; what = BRICK; target = k; }
    }
    if (B && !B.dead && B.dying <= 0
      && sweepBox(b.x, b.y, dx, dy, b.r, B.x - B.w / 2, B.y - B.h / 2, B.x + B.w / 2, B.y + B.h / 2, H2) && H2.t < bt) {
      bt = H2.t; bnx = H2.nx; bny = H2.ny; what = BOSS; target = null;
    }
    if (!what || bt > 1) { b.x += dx; b.y += dy; break; }
    const t = clamp(bt, 0, 1);
    b.x += dx * t; b.y += dy * t;
    rem *= 1 - t;
    if (what === BRICK && passes(s, target)) {
      hitBrick(s, target, 'pierce', b);
      continue;          // straight on through, the brick is gone
    }
    if (what === PAD) { if (paddleHit(s, b, bnx, bny)) { rem = 0; break; } }
    else {
      reflect(b, bnx, bny);
      minClimb(b);
      if (what === WALL) ev(s, 'wall', { x: b.x, y: b.y, nx: bnx, ny: bny });
      else if (what === BRICK) hitBrick(s, target, 'ball', b);
      else if (what === BOSS) {
        const dmg = hurtWarden(B, s.fx.fire > 0 ? 2 : 1, { ev: (type, data) => ev(s, type, data) }, { x: b.x - bnx * b.r, y: b.y - bny * b.r });
        if (dmg) {
          s.combo++; s.bestCombo = Math.max(s.bestCombo, s.combo);
          s.score += POINTS.bossHit * dmg;
          s.hitStop = Math.max(s.hitStop, dmg > 1 ? 0.13 : 0.07);
          b.calm = 0;
          if (B.dying > 0) s.score += POINTS.bossDown + POINTS.bossWorld * s.world;
        }
      }
    }
    b.x += bnx * 0.02; b.y += bny * 0.02;
  }
}

// → true when the ball stuck to it (sticky)
function paddleHit(s, b, nx, ny) {
  const P = s.paddle;
  if (ny < -0.3) {
    const off = paddleOffset(b.x, P.x, P.w / 2 + b.r * 0.6);
    s.combo = 0;
    P.squash = 1;
    b.calm = 0;
    if (s.fx.sticky > 0) {
      b.stuck = true; b.off = clamp((b.x - P.x) / (P.w / 2), -0.95, 0.95); b.stuckT = 0; b.vx = 0; b.vy = 0;
      b.y = P.y - b.r - 0.5;
      ev(s, 'stick', { x: b.x, y: P.y });
      return true;
    }
    const v = launchVelocity(off, Math.hypot(b.vx, b.vy) || targetSpeed(s));
    b.vx = v.vx; b.vy = v.vy;
    ev(s, 'paddle', { x: b.x, y: P.y, off });
    return false;
  }
  reflect(b, nx, ny);
  ev(s, 'wall', { x: b.x, y: b.y, nx, ny, side: true });
  return false;
}

function portal(s, b) {
  for (const p of s.portals) {
    if (!p.twin) continue;
    const dx = b.x - p.x, dy = b.y - p.y;
    if (dx * dx + dy * dy > p.r * p.r) continue;
    const sp = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / sp, uy = b.vy / sp, o = p.twin.r + b.r + 2;
    const from = { x: b.x, y: b.y };
    b.x = clamp(p.twin.x + ux * o, b.r, s.W - b.r);
    b.y = Math.max(b.r, p.twin.y + uy * o);
    b.px = b.x; b.py = b.y;
    b.trail.length = 0;
    b.portalCd = 0.3;
    ev(s, 'portal', { from, to: { x: b.x, y: b.y }, pair: p.pair });
    return;
  }
}

// ---------- bricks ----------
export function hitBrick(s, k, how, ball = null) {
  if (!k.alive) return;
  const cx = k.x + k.w / 2, cy = k.y + k.h / 2;
  if (k.kind === 'steel' || k.kind === 'gate') {
    k.flash = 1; k.hitT = 0;
    ev(s, 'clank', { x: ball ? ball.x : cx, y: ball ? ball.y : cy, kind: k.kind });
    return;
  }
  if (ball) ball.calm = 0;
  const dmg = how === 'ball' || how === 'laser' ? 1 : k.hp;
  k.hp -= dmg;
  k.flash = 1; k.hitT = 0;
  if (k.hp > 0) {
    s.score += POINTS.crack;
    ev(s, 'crack', { x: cx, y: cy, brick: k, how });
    return;
  }
  breakBrick(s, k, how);
}

function breakBrick(s, k, how) {
  k.alive = false;
  s.combo++;
  s.bestCombo = Math.max(s.bestCombo, s.combo);
  const mult = Math.min(POINTS.multMax, s.combo);
  const base = k.kind === 'tough' ? POINTS.tough * k.maxHp : (POINTS[k.kind] ?? POINTS.normal);
  const pts = base * mult;
  s.score += pts;
  s.broken++;
  const cx = k.x + k.w / 2, cy = k.y + k.h / 2;
  if (k.required) { s.required--; s.lastBreak = { x: cx, y: cy }; }
  ev(s, 'break', { x: cx, y: cy, brick: k, pts, mult, combo: s.combo, how });
  if (s.combo >= 5 && s.combo % 5 === 0) ev(s, 'combo', { n: s.combo, x: cx, y: cy });
  if (k.kind === 'key') {
    s.keysLeft--;
    if (s.keysLeft <= 0 && !s.gatesOpen) openGates(s);
  }
  if (k.kind === 'bomb') s.blasts.push({ x: cx, y: cy, t: TIMING.blast });
  maybeDrop(s, k, cx, cy);
}

function openGates(s) {
  s.gatesOpen = true;
  const gates = [];
  for (const b of s.bricks) if (b.alive && b.kind === 'gate') { b.alive = false; gates.push(b); }
  s.score += POINTS.gates;
  ev(s, 'gates', { gates, pts: POINTS.gates });
}

function stepBlasts(s, dt) {
  for (let i = s.blasts.length - 1; i >= 0; i--) {
    const bl = s.blasts[i];
    bl.t -= dt;
    if (bl.t > 0) continue;
    s.blasts.splice(i, 1);
    if (bl.only) {             // the Warden's last moments: one brick at a time
      const k = s.bricks.find((b) => b.id === bl.only);
      if (k?.alive) { hitBrick(s, k, 'blast'); ev(s, 'pop', { x: bl.x, y: bl.y }); }
      continue;
    }
    ev(s, 'explode', { x: bl.x, y: bl.y });
    s.hitStop = Math.max(s.hitStop, 0.035);
    for (const k of s.bricks) {
      if (!k.alive) continue;
      const kx = k.x + k.w / 2, ky = k.y + k.h / 2;
      if (Math.abs(kx - bl.x) <= CELL_W * 1.5 + 0.5 && Math.abs(ky - bl.y) <= CELL_H * 1.5 + 0.5) hitBrick(s, k, 'blast');
    }
    const B = s.boss;
    if (B && !B.dead && B.dying <= 0 && Math.abs(B.x - bl.x) < B.w / 2 + CELL_W && Math.abs(B.y - bl.y) < B.h / 2 + CELL_H) {
      const dmg = hurtWarden(B, 2, { ev: (type, data) => ev(s, type, data) }, { x: bl.x, y: bl.y });
      if (dmg) { s.score += POINTS.bossHit * dmg; if (B.dying > 0) s.score += POINTS.bossDown + POINTS.bossWorld * s.world; }
    }
  }
}

// ---------- power-ups ----------
function maybeDrop(s, k, x, y) {
  if (k.kind === 'shield') return;
  const sure = k.kind === 'power';
  if (!sure && (s.capsules.length >= LIMITS.capsules || s.rng.next() >= LIMITS.drop)) return;
  if (s.phase === 'clear' || (s.required <= 0 && !s.boss) || (s.boss && s.boss.dying > 0)) return;
  const type = pickPower(s, sure);
  s.capsules.push({ id: s.nextId++, x, y, vy: 50, type, t: 0 });
  ev(s, 'drop', { x, y, type });
}

export function pickPower(s, goodOnly = false) {
  const list = POWER_IDS.filter((id) => (!goodOnly || POWERS[id].good) && !(id === 'life' && s.lives >= LIVES.max));
  const weight = (id) => POWERS[id].weight * (!POWERS[id].good && s.world === 1 && s.mode !== 'endless' ? 0.5 : 1);
  return s.rng.weighted(list, weight);
}

function stepCapsules(s, dt) {
  const P = s.paddle;
  for (let i = s.capsules.length - 1; i >= 0; i--) {
    const c = s.capsules[i];
    c.t += dt;
    c.vy = Math.min(165, c.vy + 260 * dt);
    c.y += c.vy * dt;
    if (Math.abs(c.x - P.x) <= P.w / 2 + 15 && c.y + 8 >= P.y - 2 && c.y - 8 <= P.y + P.h) {
      s.capsules.splice(i, 1);
      applyPower(s, c.type, c.x, P.y);
    } else if (c.y > s.H + 20) s.capsules.splice(i, 1);
  }
}

export function applyPower(s, type, x = s.paddle.x, y = s.paddle.y) {
  const good = POWERS[type]?.good;
  const pts = good ? POINTS.pickup : POINTS.hazard;
  s.score += pts;
  s.pickups++;
  s.paddle.flash = 1;
  const fx = s.fx;
  switch (type) {
    case 'multi': multiball(s); break;
    case 'wide': fx.wide = DUR.wide; fx.shrink = 0; break;
    case 'shrink': fx.shrink = DUR.shrink; fx.wide = 0; break;
    case 'laser': fx.laser = DUR.laser; s.laserT = 0.1; break;
    case 'sticky': fx.sticky = DUR.sticky; break;
    case 'slow': fx.slow = DUR.slow; fx.fast = 0; break;
    case 'fast': fx.fast = DUR.fast; fx.slow = 0; break;
    case 'fire': fx.fire = DUR.fire; break;
    case 'life': s.lives = Math.min(LIVES.max, s.lives + 1); break;
    default: break;
  }
  ev(s, 'pickup', { kind: type, good, x, y, pts });
}

export function multiball(s) {
  for (const b of s.balls) if (b.stuck && s.phase === 'live') release(s, b);
  const src = s.balls.find((b) => !b.stuck) || s.balls[0];
  if (!src) return 0;
  let made = 0;
  for (const a of [-0.42, 0.42]) {
    if (s.balls.length >= LIMITS.balls) break;
    const nb = newBall(s, { x: src.x, y: src.y, vx: src.vx, vy: src.vy, stuck: src.stuck, off: src.off });
    if (!nb.stuck) { rotate(nb, a); minClimb(nb); }
    nb.px = nb.x; nb.py = nb.y;
    s.balls.push(nb);
    made++;
  }
  return made;
}

// ---------- lasers ----------
function fireLasers(s) {
  const P = s.paddle;
  for (const sx of [-1, 1]) s.lasers.push({ x: P.x + sx * (P.w / 2 - 9), y: P.y - 4, id: s.nextId++ });
  ev(s, 'laser', { x: P.x, y: P.y });
}

function stepLasers(s, dt, input) {
  if (s.fx.laser > 0 && s.phase === 'live') {
    s.laserT -= dt;
    const anyStuck = s.balls.some((b) => b.stuck);
    if (s.laserT <= 0) { fireLasers(s); s.laserT = TIMING.laserEvery; }
    else if (input.action && !anyStuck && s.laserCd <= 0) { fireLasers(s); s.laserT = TIMING.laserEvery; s.laserCd = TIMING.laserCd; }
  }
  const B = s.boss;
  for (let i = s.lasers.length - 1; i >= 0; i--) {
    const L = s.lasers[i];
    const y0 = L.y, y1 = L.y - 1000 * dt;
    L.y = y1;
    let hitK = null, hitY = -Infinity;
    for (const k of s.bricks) {
      if (!k.alive || L.x < k.x || L.x > k.x + k.w) continue;
      const bottom = k.y + k.h;
      if (bottom >= y1 - 14 && k.y <= y0 && bottom > hitY) { hitY = bottom; hitK = k; }
    }
    let bossHit = false;
    if (B && !B.dead && B.dying <= 0 && Math.abs(L.x - B.x) <= B.w / 2) {
      const bottom = B.y + B.h / 2;
      if (bottom >= y1 - 14 && B.y - B.h / 2 <= y0 && bottom > hitY) { hitY = bottom; hitK = null; bossHit = true; }
    }
    let gone = false;
    for (let j = s.bombs.length - 1; j >= 0; j--) {
      const m = s.bombs[j];
      if (Math.abs(m.x - L.x) <= m.r + 2 && m.y + m.r >= y1 - 14 && m.y - m.r <= y0 && m.y + m.r > hitY) {
        s.bombs.splice(j, 1); s.score += POINTS.bombPop; ev(s, 'bomb-pop', { x: m.x, y: m.y, pts: POINTS.bombPop }); gone = true; break;
      }
    }
    if (!gone && hitK) { hitBrick(s, hitK, 'laser'); gone = true; }
    else if (!gone && bossHit) {
      const dmg = hurtWarden(B, 1, { ev: (type, data) => ev(s, type, data) }, { x: L.x, y: hitY });
      if (dmg) { s.score += POINTS.bossHit * dmg; s.hitStop = Math.max(s.hitStop, 0.04); if (B.dying > 0) s.score += POINTS.bossDown + POINTS.bossWorld * s.world; }
      gone = true;
    }
    if (gone || L.y < -20) s.lasers.splice(i, 1);
  }
}

// ---------- the Warden's bombs ----------
function stepBombs(s, dt) {
  const P = s.paddle, B = s.boss;
  const vmax = B ? B.cfg.bombSpeed : 200;
  for (let i = s.bombs.length - 1; i >= 0; i--) {
    const m = s.bombs[i];
    m.t += dt;
    m.vy = Math.min(vmax, m.vy + 320 * dt);
    m.y += m.vy * dt;
    if (Math.abs(m.x - P.x) <= P.w / 2 + m.r * 0.6 && m.y + m.r >= P.y && m.y - m.r <= P.y + P.h) {
      s.bombs.splice(i, 1);
      P.stun = TIMING.stun;
      s.combo = 0;
      ev(s, 'zap', { x: m.x, y: P.y });
    } else if (m.y > s.H + 20) s.bombs.splice(i, 1);
  }
}

// ---------- reading it ----------
export const powerTimers = (s) => Object.entries(s.fx).filter(([, v]) => v > 0);
export const progressOf = (s) => (s.boss ? 1 - s.boss.hp / s.boss.maxHp : s.total ? 1 - s.required / s.total : 0);
export const multOf = (s) => Math.min(POINTS.multMax, Math.max(1, s.combo));
