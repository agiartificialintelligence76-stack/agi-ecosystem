// AIR GAP: AGI-1's hands. Pure (no DOM): the match in, a target for her mallet out (and how fast she moves to it).
// Five personalities, one per setting (Sleepy → No mercy), differing in how late she sees the puck (her reaction), how
// fast her mallet moves, how many rail bounces she predicts, how hard and how cleanly she shoots, and her tricks: bank
// shots, fakes, reading where your mallet is. Her mistakes come from the seeded dice, so a seed repeats a match exactly.
//
// She thinks in her own frame: her goal at y = 0, yours at y = H. The bottom side (the demo's and the title's second
// AI) is the same brain, mirrored.
import { len, dexp, dlog, dsin, dcos } from './dmath.js';
import { rng as makeRng, clamp } from '../kit/fx.js';
import { W, H, MID, PUCK_R, MALLET_MAX, DRAG, mouthOf, confine } from './physics.js';
import { isOn } from './match.js';

// react: s (how old the puck she sees is) · speed: her mallet, × MALLET_MAX · shot: her striking mallet speed (u/s) ·
// follow: how tightly her mallet chases (per s) · depth: rail bounces she predicts · err: aim noise (rad) · whiff:
// chance a strike glances · strikeMax: the fastest puck she'll try to strike · bank, fake, read: chances of a bank shot,
// a fake, aiming away from your mallet · punish: hammer it when you're out of position · guard: her guard line (y) ·
// homeY, track: where she waits · doze: chance a second she nods off (Sleepy) · counter: chance she steps up to meet a
// slow puck instead of waiting for it · defErr: how far off her block can be (units) · lunge: chance she throws her
// mallet at a puck that's about to beat her
export const PERSONAS = [
  { id: 'sleepy', react: 0.37, speed: 0.42, shot: 640, follow: 16, depth: 0, err: 0.3, whiff: 0.25, strikeMax: 380, bank: 0, fake: 0, read: 0, punish: 0, guard: 143, homeY: 150, track: 0.2, doze: 0.16, counter: 0, defErr: 144, lunge: 0, chip: 0 },
  { id: 'playful', react: 0.27, speed: 0.56, shot: 920, follow: 22, depth: 0, err: 0.17, whiff: 0.12, strikeMax: 600, bank: 0, fake: 0, read: 0, punish: 0, guard: 129, homeY: 175, track: 0.45, doze: 0, counter: 0.2, defErr: 96, lunge: 0.1, chip: 0.1 },
  { id: 'competitive', react: 0.195, speed: 0.7, shot: 1100, follow: 28, depth: 2, err: 0.1, whiff: 0.06, strikeMax: 760, bank: 0.15, fake: 0, read: 0.25, punish: 0, guard: 119, homeY: 165, track: 0.55, doze: 0, counter: 0.4, defErr: 56, lunge: 0.45, chip: 0.3 },
  { id: 'tryhard', react: 0.145, speed: 0.84, shot: 1260, follow: 34, depth: 3, err: 0.06, whiff: 0.035, strikeMax: 900, bank: 0.45, fake: 0.35, read: 0.5, punish: 0, guard: 113, homeY: 160, track: 0.6, doze: 0, counter: 0.6, defErr: 30, lunge: 0.75, chip: 0.45 },
  { id: 'nomercy', react: 0.11, speed: 1, shot: 1430, follow: 40, depth: 4, err: 0.035, whiff: 0.015, strikeMax: 1050, bank: 0.3, fake: 0.25, read: 0.95, punish: 1, guard: 107, homeY: 150, track: 0.62, doze: 0, counter: 0.8, defErr: 14, lunge: 0.95, chip: 0.35 },
];

const HN = 64;                       // ticks of history (0.53 s at 120 Hz): enough for the slowest reaction

export function createBrain(level, seed = 1, side = 1) {
  const hist = Array.from({ length: HN }, () => ({ n: 0, p: [0, 1, 2].map(() => ({ id: -1, x: 0, y: 0, vx: 0, vy: 0 })) }));
  return {
    P: PERSONAS[clamp(level | 0, 0, PERSONAS.length - 1)], level: clamp(level | 0, 0, PERSONAS.length - 1), side,
    rng: makeRng((seed >>> 0) || 1), t: 0,
    hist, hi: 0, hn: 0,
    seen: [0, 1, 2].map(() => ({ id: -1, x: 0, y: 0, vx: 0, vy: 0 })), seenN: 0,
    mode: 'home', plan: null, cool: 0, doze: 0, counterRoll: 1, counterId: -1, defOff: 0, lungeRoll: 1,
    mood: 'home',                    // for her face: home · defend · line · hit · doze · cheer · sulk
  };
}

// ---------- prediction ----------
const keepOver = (T) => dexp(-DRAG * T);
// where a puck will be after T seconds, bouncing off the side rails at most `bounces` times (past that she doesn't
// know: she thinks it stops at the rail)
export function project(x, y, vx, vy, T, bounces, out) {
  const f = T > 0 ? (1 - keepOver(T)) / DRAG : 0, k = keepOver(T);
  let nx = x + vx * f, nvx = vx * k;
  const lo = PUCK_R, hi = W - PUCK_R;
  for (let b = 0; b < bounces && (nx < lo || nx > hi); b++) {
    nx = nx < lo ? lo + (lo - nx) * 0.9 : hi - (nx - hi) * 0.9;
    nvx = -nvx * 0.9;
  }
  out.x = nx < lo ? lo : nx > hi ? hi : nx; out.y = y + vy * f; out.vx = nvx; out.vy = vy * k;
  return out;
}
// how long until the puck's centre reaches the line y = Y (Infinity: never, or it stops first)
export function timeTo(y, vy, Y) {
  if (Math.abs(vy) < 1) return Infinity;
  const f = (Y - y) / vy;
  if (f < 0) return Infinity;
  const q = 1 - DRAG * f;
  return q <= 0 ? Infinity : -dlog(q) / DRAG;
}

// ---------- perception: what she saw `react` seconds ago, moved on by what she predicts ----------
const fy = (B, y) => (B.side === 1 ? y : H - y);
const fvy = (B, vy) => (B.side === 1 ? vy : -vy);
function record(B, M) {
  const slot = B.hist[B.hi];
  slot.n = 0;
  for (const p of M.pucks) {
    if (slot.n >= 3) break;
    const q = slot.p[slot.n++];
    q.id = p.ghost > 0 ? -2 - p.id : p.id;   // a serve she can see but not yet hit
    q.x = p.x; q.y = fy(B, p.y); q.vx = p.vx; q.vy = fvy(B, p.vy);
  }
  B.hi = (B.hi + 1) % HN;
  B.hn = Math.min(HN, B.hn + 1);
}
const tmp = { x: 0, y: 0, vx: 0, vy: 0 };
function perceive(B, dt) {
  const k = Math.min(B.hn - 1, Math.round(B.P.react / dt));
  const slot = B.hist[(B.hi - 1 - k + HN * 2) % HN];
  const age = k * dt;
  B.seenN = 0;
  for (let i = 0; i < slot.n; i++) {
    const q = slot.p[i], s = B.seen[B.seenN++];
    s.id = q.id;
    if (q.id <= -2) { s.x = q.x; s.y = q.y; s.vx = 0; s.vy = 0; s.ghost = true; continue; }
    s.ghost = false;
    project(q.x, q.y, q.vx, q.vy, age, B.P.depth, tmp);
    s.x = tmp.x; s.y = tmp.y; s.vx = tmp.vx; s.vy = tmp.vy;
  }
}

// ---------- the brain ----------
const out = { x: 0, y: 0 };
const ph = { x: 0, y: 0, vx: 0, vy: 0 };
const hyp = len;

// → sets her mallet's target (tx, ty), top speed (max) and how tightly it chases (follow)
export function think(B, M, dt) {
  const L = B.P, r = B.rng;
  B.t += dt;
  B.cool = Math.max(0, B.cool - dt);
  record(B, M);
  perceive(B, dt);
  const me = M.mallets[B.side], opp = M.mallets[1 - B.side];
  const mx = me.x, my = fy(B, me.y), ox = opp.x, oy = fy(B, opp.y);
  const mr = me.r;
  let tx = W / 2, ty = L.homeY, speed = L.speed * 0.6;

  // between points: home, a little dance if she just won, a sulk if she lost
  if (M.phase === 'goal' || M.phase === 'won' || M.phase === 'over' || !B.seenN) {
    B.plan = null; B.mode = 'home';
    if (M.phase === 'won' && M.winner === B.side) {
      B.mood = 'cheer';
      tx = W / 2 + dcos(B.t * 7) * 70; ty = 190 + dsin(B.t * 7) * 45; speed = 0.7;
    } else if (M.phase === 'won') { B.mood = 'sulk'; tx = W / 2; ty = mr + 6; speed = 0.25; }
    else { B.mood = 'home'; tx = W / 2; ty = L.homeY; }
    return write(B, me, tx, ty, speed);
  }

  // the puck that matters most: the most urgent threat, else one to strike, else the nearest
  let P = null, best = -Infinity;
  for (let i = 0; i < B.seenN; i++) {
    const s = B.seen[i];
    const sp = hyp(s.vx, s.vy);
    let score;
    if (s.vy < -40) score = 10 - Math.min(5, timeTo(s.y, s.vy, L.guard)) * 3 + (s.y < MID ? 2 : 0);
    else if (s.y < MID) score = 5 - sp / 500 - s.y / 600;
    else score = -s.y / 500;
    if (B.plan && s.id === B.plan.pid) score += 1.5;   // she sticks with the one she's after
    if (score > best) { best = score; P = s; }
  }
  const sp = hyp(P.vx, P.vy);
  const myHalf = P.y < MID - 4;

  // Sleepy nods off now and then (only while the puck is far away): her chance
  if (L.doze > 0) {
    if (B.doze > 0) {
      B.doze -= dt;
      if (B.doze > 0 && !(P.y < MID - 60 && P.vy < -200)) { B.mood = 'doze'; B.plan = null; return write(B, me, mx + dsin(B.t * 2) * 6, my, 0.12); }
      B.doze = 0;
    } else if (P.y > MID + 40 && r.chance(L.doze * dt)) { B.doze = r.range(0.9, 1.7); }
  }

  // a strike in progress goes on while it still makes sense
  if (B.plan) {
    const pl = B.plan;
    let Q = null;
    for (let i = 0; i < B.seenN; i++) if (B.seen[i].id === pl.pid || B.seen[i].id === -2 - pl.pid) Q = B.seen[i];
    const qs = Q ? hyp(Q.vx, Q.vy) : 0;
    if (!Q || Q.y > MID + 30 || (pl.phase === 'line' && qs > Math.max(L.strikeMax * 1.7, 700))) B.plan = null;
    else if (M.lastHit[B.side] > pl.start + 0.02 && M.last === B.side) { B.plan = null; B.cool = 0.22; }
    else {
      pl.t += dt;
      if (pl.phase === 'line' && pl.t > 1.5) { B.plan = null; B.cool = 0.3; }
      else if (pl.phase === 'hit' && (pl.t - pl.hitAt) > 0.32) { B.plan = null; B.cool = 0.25; }
      else return strike(B, M, me, Q, mx, my);
    }
  }

  // her turn to shoot: the puck in her half, slow enough (faster when you're out of position, or the stall clock runs)
  let reach = L.strikeMax;
  if (L.punish && H - oy > 300) reach = Math.max(reach, 1400);
  // a puck sliding across her half (not at her goal) is hers to chase down
  if (Math.abs(P.vy) < 260 && P.y < MID - 40) reach = Math.max(reach, 1500);
  if (M.stall.side === B.side && M.stall.t > 3.5) reach *= 1.6;
  const serveMine = M.phase === 'serve' && P.ghost && myHalf;
  if (B.cool <= 0 && myHalf && (sp < reach || serveMine) && !(P.vy < -200 && P.y < 160)) {
    if (plan(B, M, me, P, ox, oy)) return strike(B, M, me, P, mx, my);
  }

  // coming at her goal: block where it will cross her guard line (or step up to meet a slow one)
  if (P.vy < -40) {
    // each new shot at her: does she step up, where's she a little off, will she lunge
    const key = P.id * 2 + (P.vx > 0 ? 1 : 0);
    if (B.counterId !== key) { B.counterId = key; B.counterRoll = r.next(); B.defOff = r.range(-1, 1) * L.defErr; B.lungeRoll = r.next(); }
    if (sp < 760 && P.y < MID + 120 && B.counterRoll < L.counter && B.cool <= 0) {
      if (plan(B, M, me, P, ox, oy)) return strike(B, M, me, P, mx, my);
    }
    B.mood = 'defend';
    const g = L.guard;
    const t = timeTo(P.y, P.vy, g);
    let x = P.x;
    if (Number.isFinite(t) && t < 3) x = project(P.x, P.y, P.vx, P.vy, t, L.depth, ph).x;
    const [ml, mrr] = mouthOf(isOn(M, B.side, 'patch'));
    // cover the angle: between where it arrives and her goal's mouth
    tx = clamp(x + B.defOff, ml - 24, mrr + 24);
    ty = g;
    // a very late, very close puck: throw the mallet at it (the better she is, the more often)
    if (P.y < g + 90 && Math.abs(P.x - mx) < 120 && B.lungeRoll < L.lunge) { tx = P.x; ty = Math.max(mr, P.y - 10); }
    return write(B, me, tx, ty, L.speed);
  }

  // otherwise wait at home, following the puck a little (Sleepy sways)
  B.mood = 'home';
  tx = W / 2 + (P.x - W / 2) * L.track + (L.doze ? dsin(B.t * 0.8) * 34 : 0);
  ty = L.homeY;
  // a slow puck in her half that she isn't allowed to strike yet (cooling down): stay goal side of it
  if (myHalf && P.y < ty + 30) ty = Math.max(mr + 4, P.y - 70);
  return write(B, me, tx, ty, L.speed * 0.62);
}

function write(B, me, tx, ty, speed) {
  me.tx = tx;
  me.ty = B.side === 1 ? ty : H - ty;
  me.max = MALLET_MAX * speed;
  me.follow = B.P.follow;
  return me;
}

// ---------- strikes ----------
// choose where to shoot and the point behind the puck to shoot from. → false if there's no way to shoot it from here
function plan(B, M, me, P, ox, oy) {
  const L = B.P, r = B.rng, mr = me.r;
  const [gl, gr] = mouthOf(isOn(M, 1 - B.side, 'patch'));
  const aims = [];
  const open = ox > W / 2 ? gl + 30 : gr - 30;
  let gx;
  if (L.read && r.chance(L.read)) gx = open + r.range(-12, 12);
  else {
    const u = r.next();
    gx = u < 0.45 ? W / 2 + r.range(-28, 28) : u < 0.72 ? gl + 30 : gr - 30;
  }
  let ax = gx, ay = H + 30;
  if (L.bank && r.chance(L.bank)) {
    // a bank shot: aim at the goal's mirror image in a side rail (off the rail on the far side from your mallet)
    const left = L.read ? ox > W / 2 : r.chance(0.5);
    const bx = left ? 2 * PUCK_R - gx : 2 * (W - PUCK_R) - gx;
    const wallX = left ? PUCK_R : W - PUCK_R;
    const yc = P.y + ((ay - P.y) * (wallX - P.x)) / (bx - P.x || 1e-6);
    if (yc > P.y + 80 && yc < H - 170) ax = bx;
  }
  // a power-up chip further up the table: she shoots through it (the better she is, the more she wants them)
  const c = M.chip;
  if (c && c.state !== 'out' && L.chip && r.chance(L.chip)) {
    const cy = fy(B, c.y);
    if (cy > P.y + 40) aims.push([c.x, cy]);
  }
  aims.push([ax, ay]);
  aims.push([W / 2, H + 30]);
  // sideways digs for a puck too near her own rail to get behind
  aims.push([P.x < W / 2 ? W + 400 : -400, P.y + 260]);
  aims.push([P.x < W / 2 ? -400 : W + 400, P.y + 260]);
  aims.push([P.x < W / 2 ? W + 400 : -400, P.y + 60]);
  const err = r.range(-L.err, L.err);
  const lead = 0.12;
  project(P.x, P.y, P.vx, P.vy, lead, L.depth, ph);
  for (let i = 0; i < aims.length; i++) {
    let dx = aims[i][0] - ph.x, dy = aims[i][1] - ph.y;
    const d = len(dx, dy) || 1;
    dx /= d; dy /= d;
    if (i === 0) { const c = dcos(err), s = dsin(err); [dx, dy] = [dx * c - dy * s, dx * s + dy * c]; }
    if (dy < 0.12 && i < 2) continue;
    const back = PUCK_R + mr + 6;
    const bx = ph.x - dx * back, by = ph.y - dy * back;
    const c = confine(bx, by, mr, 1, out);
    if (len(c.x - bx, c.y - by) > 4) continue;
    // a fake: line up for the other corner first, then switch (Tryhard, No mercy)
    let decoy = null;
    if (i === 0 && L.fake && r.chance(L.fake)) {
      const fx = (gx < W / 2 ? gr - 30 : gl + 30) - ph.x, fyy = ay - ph.y, fd = len(fx, fyy) || 1;
      decoy = { dx: fx / fd, dy: fyy / fd };
    }
    B.plan = { pid: P.id < -1 ? -2 - P.id : P.id, phase: 'line', dx, dy, decoy, t: 0, hitAt: 0, start: M.t, whiff: r.chance(L.whiff) ? r.sign() : 0, power: i >= 2 ? 0.7 : 1 };
    return true;
  }
  return false;
}

function strike(B, M, me, P, mx, my) {
  const L = B.P, pl = B.plan, mr = me.r;
  const sp = len(P.vx, P.vy);
  const back = PUCK_R + mr + 6;
  if (pl.phase === 'line') {
    B.mood = 'line';
    const dx = pl.decoy ? pl.decoy.dx : pl.dx, dy = pl.decoy ? pl.decoy.dy : pl.dy;
    // where the puck will be when she gets behind it
    const far = len(mx - (P.x - dx * back), my - (P.y - dy * back));
    const tau = Math.min(0.5, far / (MALLET_MAX * L.speed) + 0.05);
    project(P.x, P.y, P.vx, P.vy, tau, L.depth, ph);
    const bx = ph.x - dx * back, by = ph.y - dy * back;
    // in front of it (between it and your goal)? go around, not through
    const fx = mx - ph.x, fyy = my - ph.y;
    const along = fx * dx + fyy * dy;
    let tx = bx, ty = by;
    if (along > -back * 0.35) {
      const px = -dy, py = dx, s = fx * px + fyy * py >= 0 ? 1 : -1;
      tx = ph.x + px * s * (back + 18) - dx * back * 0.55;
      ty = ph.y + py * s * (back + 18) - dy * back * 0.55;
    }
    const gap = len(mx - bx, my - by);
    if (gap < 16 + sp * 0.02 && along <= -back * 0.35) {
      if (pl.decoy) { pl.decoy = null; pl.t = Math.min(pl.t, 0.9); }       // the fake: now the real line
      else if (!P.ghost) { pl.phase = 'hit'; pl.hitAt = pl.t; pl.start = M.t; }
    }
    return write(B, me, tx, ty, L.speed);
  }
  // the hit: straight through the puck at her shot speed (a whiff glances off one side)
  B.mood = 'hit';
  project(P.x, P.y, P.vx, P.vy, 0.04, L.depth, ph);
  const through = 170;
  let tx = ph.x + pl.dx * through, ty = ph.y + pl.dy * through;
  if (pl.whiff) { tx += -pl.dy * pl.whiff * 38; ty += pl.dx * pl.whiff * 38; }
  write(B, me, tx, ty, 1);
  me.max = L.shot * pl.power * (M.turbo ? 1.1 : 1);
  me.follow = Math.max(L.follow, 30);
  return me;
}
