// OVERCLOCK: one game of pinball, as data. Pure (no DOM): the physics (physics.js) moves the balls over the table
// (table.js), the rules (rules.js) score what they hit, and this file does the rest: the plunger, the ramp ride, the
// socket that holds and kicks, the spinner, the drop targets coming back up, drains, ball save, multiball's extra balls,
// tilt, the end-of-ball bonus, the next ball. Everything visible or audible leaves as events in S.ev.
//
//   const S = createSim({ seed });  S.input = { left, right, plunge, pull, nudge };  stepSim(S, 1 / 120)
import { stepWorld, makeBall, BALL_R, GRAVITY } from './physics.js';
import { buildTable, PLUNGER, SOCKET, RAMP, RAMP_MIN_V, RAMP_EXIT_V, DRAIN_Y, pathAt, TARGETS, TARGET_HALF } from './table.js';
import * as rules from './rules.js';
import { rng as makeRng } from '../kit/fx.js';

export const DT = 1 / 120;
export const PULL_S = 1.05;                 // holding the plunger this long pulls it all the way
export const SOCKET_V = 1750;               // the socket only catches a ball slower than this
export const SPIN_K = 0.0105, SPIN_DRAG = 1.25;
export const KICK = { dir: [-0.5, -0.866], v: 980, spread: 0.07 };
export const AUTO_POWER = 0.92;              // ball save and multiball plunge for you (around the orbit)

// The plunger's power (0..1) → the ball's speed up the shooter lane. The bands where each R-A-M lane is reached
// (calibrated by tools/games/overclock/calibrate.mjs, where the ball lands cleanly) sit side by side on the meter:
// weak … M … A … R … the orbit.
export const SKILL_BANDS = [
  { lane: 2, p0: 0.2, p1: 0.4, v0: 2132.5, v1: 2147 },
  { lane: 1, p0: 0.4, p1: 0.6, v0: 2191.5, v1: 2200 },
  { lane: 0, p0: 0.6, p1: 0.8, v0: 2226, v1: 2239.5 },
];
export function launchSpeed(p) {
  p = Math.max(0, Math.min(1, p));
  if (p < SKILL_BANDS[0].p0) return 2100 + (p / SKILL_BANDS[0].p0) * 26;
  for (let i = 0; i < SKILL_BANDS.length; i++) {
    const b = SKILL_BANDS[i];
    if (p <= b.p1) return b.v0 + ((p - b.p0) / (b.p1 - b.p0)) * (b.v1 - b.v0);
  }
  return 2250 + ((p - 0.8) / 0.2) * 250;
}
export const bandOf = (lane) => SKILL_BANDS.find((b) => b.lane === lane);

export function createSim({ seed = 1, demo = false } = {}) {
  const T = buildTable(seed);
  const S = {
    T, R: rules.createRules(seed), rng: makeRng(seed), seed, demo,
    balls: [], t: 0, phase: 'launch', ev: [],
    input: { left: false, right: false, plunge: false, pull: null, nudge: false },
    prev: { left: false, right: false, plunge: false, pull: null },
    plunger: { pull: 0, auto: 0, ready: false },
    spinner: { a: 0, w: 0, halves: 0 },
    flash: { pop: [0, 0, 0], sling: [0, 0], target: [0, 0, 0], socket: 0, ramp: 0, lane: [0, 0, 0], save: 0 },
    socket: { ball: null, t: 0, hold: 0, outcome: null, queue: 0 },
    serveIn: 0, autoNext: false,
    bonus: null, over: false,
    stats: { jackpots: 0, missions: 0, longest: 0, balls: 0 },
  };
  serve(S, false);
  return S;
}

const push = (S, type, data = {}) => { S.ev.push({ type, t: S.t, ...data }); };

// a new ball in the shooter lane (auto: plunged for the player a moment later)
export function serve(S, auto) {
  const b = makeBall(PLUNGER.x, PLUNGER.y, 0, 0);
  b.mode = 'plunger'; b.live = false; b.id = ++S.stats.balls;
  S.balls.push(b);
  S.plunger.pull = 0;
  S.plunger.auto = auto ? 0.55 : 0;
  S.plunger.ready = true;
  push(S, 'serve', { auto });
  return b;
}
const plungerBall = (S) => S.balls.find((b) => b.mode === 'plunger');
export const inPlay = (S) => S.balls.filter((b) => b.mode === 'play' || b.mode === 'ramp' || b.mode === 'socket').length;
export const waiting = (S) => Boolean(plungerBall(S)) && inPlay(S) === 0;

function launch(S, power, auto = false) {
  const b = plungerBall(S);
  if (!b) return;
  b.mode = 'play'; b.live = true;
  b.vx = 0; b.vy = -launchSpeed(power);
  S.plunger.ready = false;
  S.plunger.release = S.plunger.pull;
  S.plunger.pull = 0;
  S.plunger.auto = 0;
  if (!auto) rules.armSkill(S.R);
  push(S, 'launch', { power, auto });
}

// ---------- the physics' callbacks ----------
function onContact(S, c, b, speed, fired) {
  const R = S.R;
  switch (c.tag) {
    case 'pop':
      if (fired) {
        S.flash.pop[c.ref] = 1;
        rules.hit(R, 'pop', c.ref, [c.x, c.y]);
        push(S, 'pop', { ref: c.ref, x: c.x, y: c.y, speed });
      }
      break;
    case 'sling':
      if (fired) {
        S.flash.sling[c.ref] = 1;
        rules.hit(R, 'sling', c.ref, [b.x, b.y]);
        push(S, 'sling', { ref: c.ref, x: b.x, y: b.y });
      } else if (speed > 120) push(S, 'rubber', { speed, x: b.x, y: b.y });
      break;
    case 'target':
      // only a hit on its face (from below) drops it
      if ((b.x - c.ax) * c.nx + (b.y - c.ay) * c.ny > 0 && speed > 60 && !R.gpu[c.ref]) {
        S.flash.target[c.ref] = 1;
        rules.hit(R, 'target', c.ref, [(c.ax + c.bx) / 2, (c.ay + c.by) / 2]);
        c.on = !R.gpu[c.ref];
        push(S, 'target', { ref: c.ref, x: b.x, y: b.y, speed });
      } else if (speed > 80) push(S, 'wall', { speed, x: b.x, y: b.y });
      break;
    case 'flipper':
      if (speed > 90) push(S, 'flipHit', { side: c.side, speed, x: b.x, y: b.y, fired });
      break;
    default:
      if (speed > 140) push(S, c.sound === 'rubber' ? 'rubber' : 'wall', { speed, x: b.x, y: b.y });
  }
}
function onSensor(S, s, b, dir) {
  const R = S.R;
  switch (s.tag) {
    case 'lane':
      S.flash.lane[s.ref] = 1;
      rules.hit(R, 'lane', s.ref, [s.x, s.y]);
      push(S, 'lane', { ref: s.ref, x: s.x, y: s.y });
      break;
    case 'spinner': {
      const v = Math.hypot(b.vx, b.vy);
      const w = v * SPIN_K * (b.vy < 0 ? 1 : -1);
      if (Math.abs(w) > Math.abs(S.spinner.w) || Math.sign(w) !== Math.sign(S.spinner.w)) S.spinner.w = w;
      push(S, 'spinnerHit', { w });
      break;
    }
    case 'ramp':
      if (dir < 0 && b.vy < 0 && Math.hypot(b.vx, b.vy) >= RAMP_MIN_V) {
        b.mode = 'ramp'; b.live = false; b.s = 0;
        b.rv = Math.max(950, Math.min(1700, Math.hypot(b.vx, b.vy) * 0.72));
        b.scored = false;
        S.flash.ramp = 1;
        push(S, 'rampIn', { x: b.x, y: b.y });
      } else if (dir < 0) push(S, 'rampFail', { x: b.x, y: b.y });
      break;
    case 'orbit':
      if (dir < 0) { rules.hit(R, 'orbit', s.ref, [b.x, b.y]); push(S, 'orbit', { ref: s.ref, x: b.x, y: b.y }); }
      break;
    case 'inlane': rules.hit(R, 'inlane', s.ref, [s.x, s.y]); push(S, 'inlane', { ref: s.ref }); break;
    case 'outlane': rules.hit(R, 'outlane', s.ref, [s.x, s.y]); push(S, 'outlane', { ref: s.ref }); break;
    case 'launched':
      if (dir < 0) { rules.launched(R); push(S, 'gate'); }
      break;
    case 'socket':
      if (!S.socket.ball && Math.hypot(b.vx, b.vy) < SOCKET_V && b.mode === 'play') catchSocket(S, b);
      break;
    default: break;
  }
}

function catchSocket(S, b) {
  b.mode = 'socket'; b.live = false; b.vx = 0; b.vy = 0;
  b.cx = b.x; b.cy = b.y;                   // where it came from (it slides into the hole)
  const out = rules.socket(S.R, [SOCKET.x, SOCKET.y]);
  S.socket.ball = b; S.socket.t = 0; S.socket.outcome = out;
  S.socket.hold = out === 'multiball' ? 1.7 : out === 'agi' ? 1.5 : 1.0;
  S.flash.socket = 1;
  push(S, 'socket', { outcome: out });
}
function kickSocket(S, b) {
  const r = S.rng;
  const a = Math.atan2(KICK.dir[1], KICK.dir[0]) + r.range(-KICK.spread, KICK.spread);
  const v = KICK.v + r.range(-50, 50);
  b.x = SOCKET.x; b.y = SOCKET.y;
  b.vx = Math.cos(a) * v; b.vy = Math.sin(a) * v;
  b.mode = 'play'; b.live = true;
  b.inSpot.add(S.T.socket.id);              // it leaves through the socket's own sensor without being caught again
  push(S, 'kick', { x: SOCKET.x, y: SOCKET.y });
}

// ---------- one tick ----------
export function stepSim(S, dt = DT) {
  const R = S.R, T = S.T, inp = S.input, prev = S.prev;
  S.t += dt;
  const busy = inPlay(S) > 0;
  // flippers: dead while tilted or between balls (except to change the skill shot's lane)
  const alive = !R.tilted && S.phase !== 'bonus' && S.phase !== 'over';
  const wait = waiting(S);
  const L = alive && inp.left, Rr = alive && inp.right;
  if (L && !prev.left) { rules.flipperPress(R, 'L', wait); push(S, 'flip', { side: 'L' }); }
  if (Rr && !prev.right) { rules.flipperPress(R, 'R', wait); push(S, 'flip', { side: 'R' }); }
  if (!L && prev.left && alive) push(S, 'unflip', { side: 'L' });
  if (!Rr && prev.right && alive) push(S, 'unflip', { side: 'R' });
  T.flippers.L.held = L;
  T.flippers.R.held = Rr;
  T.flippers.U.held = Rr;

  // the plunger
  const pb = plungerBall(S);
  if (pb && S.plunger.ready) {
    if (S.plunger.auto > 0) {
      S.plunger.auto -= dt;
      S.plunger.pull = Math.min(1, S.plunger.pull + dt / 0.4);
      if (S.plunger.auto <= 0) launch(S, AUTO_POWER, true);
    } else if (S.phase !== 'bonus' && S.phase !== 'over') {
      if (inp.pull != null) S.plunger.pull = Math.max(0, Math.min(1, inp.pull));
      else if (inp.plunge) S.plunger.pull = Math.min(1, S.plunger.pull + dt / PULL_S);
      const released = (prev.plunge && !inp.plunge && inp.pull == null) || (prev.pull != null && inp.pull == null);
      if (released && S.plunger.pull > 0.015) launch(S, S.plunger.pull);
      else if (released) S.plunger.pull = 0;
    }
  }

  // a nudge: every ball on the table jumps a little (too many and it tilts)
  if (inp.nudge) {
    inp.nudge = false;
    if (S.phase === 'play' || busy) {
      const res = rules.nudge(R);
      for (const b of S.balls) if (b.live) { b.vx += S.rng.range(-70, 70); b.vy -= 240; }
      push(S, 'nudge', { result: res });
    }
  }

  // the physics
  const live = S.balls.filter((b) => b.live);
  if (live.length) {
    stepWorld(T.world, live, dt, {
      contact: (c, b, sp, fired) => onContact(S, c, b, sp, fired),
      sensor: (s, b, dir) => onSensor(S, s, b, dir),
    }, GRAVITY);
  } else for (const f of T.world.flippers) { /* the flippers still move with no ball on the table */
    const before = f.angle;
    f.held = f.held && alive;
    stepFlipperOnly(f, dt);
    f.moved += Math.abs(f.angle - before);
  }

  // balls riding the ramp
  for (const b of S.balls) {
    if (b.mode !== 'ramp') continue;
    const k = b.s / RAMP.total;
    b.rv = k < 0.32 ? Math.max(820, b.rv - 1100 * dt) : Math.min(1450, b.rv + 900 * dt);
    b.s += b.rv * dt;
    const p = pathAt(RAMP, b.s, b.pp || (b.pp = [0, 0, 0, 0]));
    b.x = p[0]; b.y = p[1];
    if (!b.scored && b.s > RAMP.total * 0.42) {
      b.scored = true;
      rules.hit(R, 'ramp', 0, [b.x, b.y]);
      push(S, 'ramp', { x: b.x, y: b.y });
    }
    if (b.s >= RAMP.total) {
      b.mode = 'play'; b.live = true;
      b.vx = p[2] * RAMP_EXIT_V; b.vy = p[3] * RAMP_EXIT_V;
      push(S, 'rampOut', { x: b.x, y: b.y });
    }
  }

  // the socket holds its ball, then answers
  const so = S.socket;
  if (so.ball) {
    so.t += dt;
    const b = so.ball;
    const k = Math.min(1, so.t / 0.18);
    b.x = b.cx + (SOCKET.x - b.cx) * k; b.y = b.cy + (SOCKET.y - b.cy) * k;
    if (so.t >= so.hold) {
      so.ball = null;
      if (so.outcome === 'lock') {
        b.mode = 'locked'; b.live = false;
        push(S, 'locked');
        S.serveIn = 0.7; S.autoNext = false;
      } else {
        kickSocket(S, b);
        if (so.outcome === 'multiball') { so.queue = 1; so.qt = 0.55; S.serveIn = 0.9; S.autoNext = true; }
      }
      S.flash.socket = 1;
    }
  } else if (so.queue > 0) {
    so.qt -= dt;
    if (so.qt <= 0) {
      so.queue--;
      const b = makeBall(SOCKET.x, SOCKET.y, 0, 0);
      b.id = ++S.stats.balls; b.mode = 'play';
      S.balls.push(b);
      kickSocket(S, b);
      so.qt = 0.55;
    }
  }
  if (S.serveIn > 0) {
    S.serveIn -= dt;
    if (S.serveIn <= 0) { S.serveIn = 0; if (!plungerBall(S)) serve(S, S.autoNext); }
  }

  // the spinner turns with the ball that went through it, slows down, and counts its half turns
  const sp = S.spinner;
  if (sp.w !== 0) {
    sp.a += sp.w * dt;
    sp.w *= Math.exp(-SPIN_DRAG * dt);
    if (Math.abs(sp.w) < 0.6) sp.w = 0;
    const halves = Math.floor(Math.abs(sp.a) / Math.PI);
    while (sp.halves < halves) { sp.halves++; rules.hit(R, 'spin', 0, [528, 430]); push(S, 'spin', { w: sp.w }); }
    while (sp.halves > halves) sp.halves--;
  }

  // drains, and a ball that fell back to the plunger
  for (const b of S.balls) {
    if (b.mode !== 'play') continue;
    if (b.y > DRAIN_Y) {
      b.mode = 'gone'; b.live = false;
      const left = S.balls.filter((o) => o !== b && (o.mode === 'play' || o.mode === 'ramp' || o.mode === 'socket')).length + S.socket.queue;
      const res = rules.drain(R, left);
      push(S, 'drain', { x: b.x, saved: res === 'saved', left });
      if (res === 'saved') { S.serveIn = Math.max(S.serveIn, 0.35); S.autoNext = true; }
    } else if (b.x > 558 && b.y > PLUNGER.y - 30 && Math.abs(b.vy) < 40 && Math.abs(b.vx) < 40) {
      b.mode = 'plunger'; b.live = false; b.x = PLUNGER.x; b.y = PLUNGER.y; b.vx = 0; b.vy = 0;
      S.plunger.ready = true; S.plunger.pull = 0;
    }
  }
  S.balls = S.balls.filter((b) => b.mode !== 'gone' && b.mode !== 'locked');

  // the drop targets come back up once nothing's in their way
  if (R.gpuReset > 0 && rules.gpuDue(R, dt)) R.gpuReset = 0.0001;
  if (R.gpuReset === 0.0001) {
    const blocked = S.balls.some((b) => b.live && TARGETS.some((t) => Math.abs(b.x - t.x) < TARGET_HALF + BALL_R + 4 && Math.abs(b.y - t.y) < BALL_R + 12));
    if (!blocked) { rules.gpuUp(R); for (const c of T.targets) c.on = true; push(S, 'gpuUp'); }
  }

  // the rules' clock, and the phase of the game
  const nowInPlay = inPlay(S) + S.socket.queue;
  rules.tick(R, dt, { inPlay: nowInPlay > 0 });
  if (S.phase === 'bonus') {
    S.bonus.t += dt;
    if (S.bonus.t >= S.bonus.dur) finishBall(S);
  } else if (S.phase !== 'over') {
    if (nowInPlay > 0) S.phase = 'play';
    else if (plungerBall(S) || S.serveIn > 0) S.phase = 'launch';
    else startBonus(S);
  }

  // lights fade
  const fade = Math.exp(-dt * 7);
  for (const k of ['pop', 'sling', 'target', 'lane']) for (let i = 0; i < S.flash[k].length; i++) S.flash[k][i] *= fade;
  S.flash.socket *= fade; S.flash.ramp *= fade;

  // the rules' news joins the sim's
  if (R.fx.length) { for (const e of R.fx) S.ev.push({ t: S.t, ...e }); R.fx.length = 0; }
  prev.left = inp.left; prev.right = inp.right; prev.plunge = inp.plunge; prev.pull = inp.pull;
}

function stepFlipperOnly(f, dt) {
  const n = 4;
  for (let i = 0; i < n; i++) {
    const target = f.held ? f.up : f.rest;
    const d = target - f.angle;
    if (Math.abs(d) < 1e-9) { f.w = 0; return; }
    const dir = Math.sign(d);
    if (Math.sign(f.w) !== dir) f.w = 0;
    f.w += dir * (f.held ? 2600 : 600) * (dt / n);
    const maxW = f.held ? 23 : 15;
    if (Math.abs(f.w) > maxW) f.w = dir * maxW;
    f.angle += f.w * (dt / n);
    if ((target - f.angle) * dir <= 0) { f.angle = target; f.w = 0; }
  }
}

// the last ball is gone: the bonus is counted (the display shows it line by line), then the next ball
function startBonus(S) {
  const b = rules.bonusLines(S.R);
  S.phase = 'bonus';
  S.bonus = { ...b, t: 0, dur: b.lines.length ? 1.2 + b.lines.length * 0.45 : 1.4, tilted: S.R.tilted };
  push(S, 'bonus', { bonus: S.bonus });
}
function finishBall(S) {
  const R = S.R;
  const res = rules.endBall(R);
  S.stats.jackpots = R.jackpots;
  S.stats.missions = R.missionsDone;
  S.stats.longest = R.longest;
  // whatever's left (a ball still waiting in the socket's queue…) is cleared for the new ball
  for (const b of S.balls) { b.mode = 'gone'; b.live = false; }
  S.balls.length = 0;
  S.socket.ball = null; S.socket.queue = 0;
  for (const c of S.T.targets) c.on = !R.gpu[c.ref];
  S.bonus = null;
  if (res.next === 'over') {
    S.phase = 'over'; S.over = true;
    push(S, 'gameOver', { score: R.score });
    return;
  }
  S.phase = 'launch';
  serve(S, false);
  push(S, 'nextBall', { ball: R.ball, again: res.next === 'again' });
}

// the bonus count is skipped on a flipper press (the game calls this)
export function hurryBonus(S) { if (S.phase === 'bonus' && S.bonus) S.bonus.t = Math.max(S.bonus.t, S.bonus.dur - 0.25); }
