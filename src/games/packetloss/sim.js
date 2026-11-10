// PACKET LOSS: the rules, as a pure simulation (no DOM, no clock of its own). The letter's grid movement (turns
// remembered a moment, cornering, reversing, tunnels), the four lag gremlins, encryption keys and the quarantine box,
// packet loss instead of a death, the repeater, the read receipt, firewall gates, network calm, scoring, a maze
// delivered and the run's end. The same seed and the same inputs give the same run (tests/packetloss.test.js).
// The game (game.js) steps it at a fixed 120 Hz, reads `S`, and drains `S.events` for its sounds and effects.
import { rng as makeRng } from '../kit/fx.js';
import { PARSED, W, H, PATH, GATE, DX, DY, OPP } from './mazes.js';

export const STEP = 1 / 120;
export const UP = 0, RIGHT = 1, DOWN = 2, LEFT = 3;

export const TUNE = Object.freeze({
  buffer: 0.28,            // a swipe or key is remembered this long (s) and taken at the next junction that allows it
  corner: 0.34,            // a turn this close to a junction's center (tiles), early or late, snaps into it
  hitR: 0.62,              // touching (tiles between centers): small, so near misses are near misses
  inv: 1.5,                // blinking safety after packet loss (s)
  hitstop: 0.13,           // the world holds its breath on a hit (s)
  drop: 12,                // at most this many bits lost per hit
  dropNear: 2, dropFar: 9, // they land this many tiles away (route distance)
  enc: [6, 5, 4.5],        // encrypted for (s): mazes 1-8, the second lap, later
  encFlash: 1.5,           // the gremlins flash for the last of it
  chain: [200, 400, 800, 1600],
  scrambledSpeed: 0.55,
  echoAt: 30,              // ECHO joins after this many bits in a maze
  echoLag: 2.5,            // s behind you
  echoJoin: 1.0,           // its fade in (harmless)
  aura: 3, auraSlow: 0.25, // THROTTLE: within 3 tiles, you're 25% slower
  throttleAhead: 4,
  calmEvery: 20, calmFor: 4,
  gateCycle: 8, gateOpen: 5,
  repeaterAt: 0.6, repeaterFor: 15, repeaterFull: 500,
  receiptAt: [0.3, 0.7], receiptFor: 9,
  receipt: [100, 250, 500, 750, 1000, 1500, 2000, 3000],
  bit: 10, key: 50,
  quarantineFor: 3,        // s in the box before a quarantined gremlin comes out again
  signal: 3,
});

const KINDS = ['ping', 'jitter', 'throttle', 'echo'];
export { KINDS };

// how fast things move on maze n (0 = the first): tiles a second
export function speeds(n) {
  const lap = Math.floor(n / 8), k = Math.min(n, 7) / 7;
  const player = 6.4 + 1.0 * k + 0.3 * Math.min(lap, 4);
  const ratio = Math.min(1, 0.75 + 0.17 * k + 0.035 * lap);
  return { player, gremlin: player * ratio, ratio };
}
export const encFor = (n) => TUNE.enc[Math.min(TUNE.enc.length - 1, Math.floor(n / 8))];
// the gremlins leave the box in turn (s after GO): sooner on later mazes
export function releaseTimes(n) {
  const k = Math.max(0.35, 1 - 0.12 * n);
  return [0.6, 5 * k + 0.6, 10 * k + 0.6];
}
export const receiptValue = (n) => TUNE.receipt[Math.min(n, 7)] + 1000 * Math.floor(n / 8);
export const deliveryBonus = (n) => 500 + 250 * Math.min(n, 7) + 500 * Math.floor(n / 8);

// ---------- the grid ----------
const N = W * H;
export const wrapX = (x) => ((x % W) + W) % W;
export const tileOf = (x, y) => Math.round(y) * W + wrapX(Math.round(x));
export function canEnter(S, x, y) {
  if (y < 0 || y >= H) return false;
  const i = y * W + wrapX(x), c = S.cell[i];
  return c === PATH || (c === GATE && S.gateOpen[i] === 1);
}
// route distance (tiles, tunnels wrap, closed gates block) from tile `from` to every tile; -1 where it can't go
export function bfs(S, from, out = new Int16Array(N)) {
  out.fill(-1);
  const q = S._q;
  let head = 0, tail = 0;
  out[from] = 0; q[tail++] = from;
  while (head < tail) {
    const i = q[head++], x = i % W, y = (i / W) | 0, d = out[i] + 1;
    for (let k = 0; k < 4; k++) {
      const ny = y + DY[k];
      if (ny < 0 || ny >= H) continue;
      const j = ny * W + wrapX(x + DX[k]);
      if (out[j] >= 0) continue;
      const c = S.cell[j];
      if (c === PATH || (c === GATE && S.gateOpen[j] === 1)) { out[j] = d; q[tail++] = j; }
    }
  }
  return out;
}
// a field from a tile, cached until the gates change
function field(S, from) {
  let f = S._fields.get(from);
  if (f) return f;
  if (S._fields.size > 48) S._fields.clear();
  f = bfs(S, from);
  S._fields.set(from, f);
  return f;
}
// the route tile nearest to a point (for corners and targets)
function nearestRoute(S, px, py) {
  let best = -1, bd = Infinity;
  for (let i = 0; i < N; i++) {
    const c = S.cell[i];
    if (c !== PATH) continue;
    const x = i % W, y = (i / W) | 0, d = (x - px) ** 2 + (y - py) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

// ---------- a run ----------
export function createSim({ seed = 1, maze = 0 } = {}) {
  const S = {
    seed, rng: makeRng(seed >>> 0 || 1),
    n: 0, maze: null, cell: null, bits: null, gateOpen: new Uint8Array(N),
    phase: 'ready', readyT: 0, clock: 0, t: 0, hitstop: 0,
    score: 0, signal: TUNE.signal, mazesDone: 0, quarantined: 0, bitsCollected: 0, hits: 0,
    bitsLeft: 0, collectedHere: 0, hitsHere: 0, flying: [],
    player: null, gremlins: [], keys: [], gates: [],
    enc: 0, encMax: 0, chain: 0, calm: 0, calmNext: 0,
    receipt: { on: false, t: 0, shown: 0, value: 0 }, repeater: { on: false, t: 0, done: false },
    bonus: null, events: [], spd: null,
    _q: new Int16Array(N), _fields: new Map(), _pf: new Int16Array(N), _pfTile: -1, _stamp: 0, _pfStamp: -1,
    corners: null, junctions: null,
    trail: new Float32Array(TRAIL * 2), head: 0,
  };
  loadMaze(S, maze);
  return S;
}
const TRAIL = 4096;   // the letter's last positions, one a step (34 s), for ECHO and the trail

export function loadMaze(S, n) {
  const M = PARSED[n % PARSED.length];
  S.n = n; S.maze = M;
  S.cell = M.cell;
  S.bits = M.bits.slice();
  S.bitsLeft = M.bitCount;
  S.collectedHere = 0; S.hitsHere = 0; S.flying.length = 0;
  S.spd = speeds(n);
  S.t = 0; S.phase = 'ready'; S.readyT = n === 0 ? 1.6 : 1.3; S.hitstop = 0;
  S.enc = 0; S.encMax = encFor(n); S.chain = 0;
  S.calm = 0; S.calmNext = TUNE.calmEvery + S.rng.range(-2, 2);
  S.receipt = { on: false, t: 0, shown: 0, value: receiptValue(n) };
  S.repeater = { on: false, t: 0, done: false };
  S.bonus = null;
  S.keys = M.keys.map((k) => ({ x: k.x, y: k.y, on: true }));
  S.gates = M.gates.map((g) => ({ x: g.x, y: g.y, group: g.group, i: g.y * W + g.x, open: true, left: 0 }));
  S.gateOpen.fill(0);
  updateGates(S, true);
  S._fields.clear(); S._pfTile = -1;
  S.corners = [nearestRoute(S, W - 2, 1), nearestRoute(S, 1, 1), nearestRoute(S, 1, H - 2), -1];
  S.junctions = [];
  for (let i = 0; i < N; i++) {
    if (S.cell[i] !== PATH) continue;
    const x = i % W, y = (i / W) | 0;
    let k = 0;
    for (let d = 0; d < 4; d++) if (canEnter(S, x + DX[d], y + DY[d])) k++;
    if (k >= 3) S.junctions.push(i);
  }
  const p = M.start;
  S.player = {
    x: p.x, y: p.y, dir: LEFT, moving: false, want: -1, wantUntil: 0,
    inv: 0, slowed: false, speed: 0, turned: 0,
  };
  // the trail starts where the letter does
  for (let i = 0; i < TRAIL; i++) { S.trail[i * 2] = p.x; S.trail[i * 2 + 1] = p.y; }
  S.head = 0;
  const rel = releaseTimes(n);
  S.gremlins = KINDS.map((kind, i) => {
    const slot = M.slots[i] || M.slots[1];
    return {
      kind, i, x: slot.x, y: slot.y, dir: UP, moving: false, state: kind === 'echo' ? 'off' : 'box',
      t: 0, release: rel[i] ?? 0, scrambled: false, slot,
      chase: true, modeT: kind === 'jitter' ? S.rng.range(3, 5) : 0, wander: -1, burstT: 0,
      lag: TUNE.echoLag / STEP, fx: 0, fy: 0, flyT: 0, flyDur: 0, alpha: kind === 'echo' ? 0 : 1, speed: 0,
    };
  });
  S.events.push({ type: 'maze', n });
  return S;
}

export function nextMaze(S) {
  loadMaze(S, S.n + 1);
}

// the player asks for a direction (a swipe, a key, the demo's AI): remembered a moment
export function request(S, dir) {
  const p = S.player;
  p.want = dir;
  p.wantUntil = S.clock + TUNE.buffer;
}

// ---------- the clock ----------
export function step(S, dt = STEP) {
  playerArrive.S = S; gremlinArrive.S = S;
  S.clock += dt;
  const p = S.player;
  if (S.phase === 'ready') {
    if (p.want >= 0) p.wantUntil = S.clock + TUNE.buffer;   // a turn asked for during "ready" waits for GO
    S.readyT -= dt;
    if (S.readyT <= 0) {
      S.phase = 'play';
      // the letter sets off by itself: the way you asked, or left
      const tx = wrapX(Math.round(p.x)), ty = Math.round(p.y);
      if (p.want >= 0 && canEnter(S, tx + DX[p.want], ty + DY[p.want])) p.dir = p.want;
      p.moving = canEnter(S, tx + DX[p.dir], ty + DY[p.dir]);
      S.events.push({ type: 'go' });
    }
    return;
  }
  if (S.phase !== 'play') return;
  if (S.hitstop > 0) { S.hitstop -= dt; if (p.want >= 0) p.wantUntil = Math.max(p.wantUntil, S.clock + 0.05); return; }
  S.t += dt;
  updateGates(S, false);
  timers(S, dt);
  movePlayer(S, dt);
  // the trail: one sample a step
  S.head = (S.head + 1) % TRAIL;
  S.trail[S.head * 2] = p.x; S.trail[S.head * 2 + 1] = p.y;
  collect(S);
  // the last bit wins: delivered before anything else moves
  if (S.bitsLeft === 0 && S.flying.length === 0) { clearMaze(S); return; }
  for (const g of S.gremlins) updateGremlin(S, g, dt);
  collide(S);
}

function updateGates(S, init) {
  const cyc = TUNE.gateCycle;
  let changed = false;
  for (const g of S.gates) {
    const ph = (S.t + g.group * cyc / 2) % cyc;
    const open = ph < TUNE.gateOpen;
    g.left = open ? TUNE.gateOpen - ph : cyc - ph;        // until it switches
    g.phase = open ? 1 - g.left / TUNE.gateOpen : 1 - g.left / (cyc - TUNE.gateOpen);
    if (init || open !== g.open) {
      if (!init && open !== g.open) S.events.push({ type: 'gate', open, x: g.x, y: g.y, group: g.group });
      g.open = open; S.gateOpen[g.i] = open ? 1 : 0; changed = true;
    }
  }
  if (changed) { S._stamp++; S._fields.clear(); }
}

function timers(S, dt) {
  const p = S.player;
  if (p.inv > 0) p.inv = Math.max(0, p.inv - dt);
  // encryption
  if (S.enc > 0) {
    const before = S.enc;
    S.enc = Math.max(0, S.enc - dt);
    if (before > TUNE.encFlash && S.enc <= TUNE.encFlash) S.events.push({ type: 'flash' });
    if (S.enc === 0) {
      for (const g of S.gremlins) g.scrambled = false;
      S.events.push({ type: 'decrypt' });
    }
  }
  // network calm: every ~20 s a few seconds where they drift home (never while you're encrypted)
  if (S.calm > 0) {
    S.calm = Math.max(0, S.calm - dt);
    if (S.calm === 0) S.events.push({ type: 'calm', on: false });
  } else {
    S.calmNext -= dt;
    if (S.calmNext <= 0) {
      if (S.enc > 0) S.calmNext = 1;
      else {
        S.calm = Math.max(2.5, TUNE.calmFor - 0.15 * Math.min(S.n, 8));
        S.calmNext = TUNE.calmEvery + S.rng.range(-2, 2);
        S.events.push({ type: 'calm', on: true });
      }
    }
  }
  // the read receipt and the repeater
  const progress = 1 - S.bitsLeft / S.maze.bitCount;
  const R = S.receipt;
  if (R.on) { R.t -= dt; if (R.t <= 0) { R.on = false; S.events.push({ type: 'receipt', on: false }); } }
  else if (R.shown < TUNE.receiptAt.length && progress >= TUNE.receiptAt[R.shown]) {
    R.on = true; R.t = TUNE.receiptFor; R.shown++;
    S.events.push({ type: 'receipt', on: true, x: S.maze.receipt.x, y: S.maze.receipt.y });
  }
  const P = S.repeater;
  if (P.on) { P.t -= dt; if (P.t <= 0) { P.on = false; P.done = true; S.events.push({ type: 'repeater', on: false }); } }
  else if (!P.done && progress >= TUNE.repeaterAt) {
    P.on = true; P.t = TUNE.repeaterFor;
    S.events.push({ type: 'repeater', on: true, x: S.maze.repeater.x, y: S.maze.repeater.y });
  }
  // lost packets in the air land
  for (let i = S.flying.length - 1; i >= 0; i--) {
    const f = S.flying[i];
    f.t += dt;
    if (f.t >= f.dur) {
      S.flying.splice(i, 1);
      S.bits[f.ty * W + f.tx] = 1;
      S.events.push({ type: 'land', x: f.tx, y: f.ty });
    }
  }
}

// ---------- moving along the grid ----------
// `a` is at (x, y) in tiles (tile centers on whole numbers), going `dir`. It moves `dist` tiles: the other axis slides
// to its tile's center line (that's what makes an early or late turn a smooth corner), and at each tile center
// `arrive(a, tx, ty)` may turn it or stop it.
function advance(S, a, dist, arrive) {
  if (!a.moving || a.dir < 0) return;
  // the other axis: back to its center line
  {
    const horiz = DX[a.dir] !== 0;
    if (horiz) { const c = Math.round(a.y), o = a.y - c; a.y = Math.abs(o) <= dist ? c : a.y - Math.sign(o) * dist; }
    else { const c = Math.round(a.x), o = a.x - c; a.x = Math.abs(o) <= dist ? c : a.x - Math.sign(o) * dist; }
  }
  for (let guard = 0; guard < 6 && dist > 1e-7 && a.moving; guard++) {
    const dx = DX[a.dir], dy = DY[a.dir], s = dx + dy, horiz = dx !== 0;
    let along = horiz ? a.x : a.y;
    const c = Math.round(along), off = (along - c) * s;
    let target;
    if (Math.abs(off) < 1e-7) {
      // standing on a center: only on if the next tile lets it in
      const tx = horiz ? c : Math.round(a.x), ty = horiz ? Math.round(a.y) : c;
      if (!canEnter(S, tx + dx, ty + dy)) { a.moving = false; along = c; break; }
      target = c + s;
    } else target = off < 0 ? c : c + s;
    const gap = Math.abs(target - along);
    const m = Math.min(dist, gap);
    along += m * s; dist -= m;
    const reached = gap - m < 1e-7;
    if (reached) along = target;
    if (horiz) a.x = along; else a.y = along;
    // tunnels: out one side, in the other
    if (a.x < -0.5) a.x += W; else if (a.x >= W - 0.5) a.x -= W;
    if (reached) arrive(a, wrapX(Math.round(a.x)), Math.round(a.y));
  }
}

function movePlayer(S, dt) {
  const p = S.player;
  if (p.want >= 0 && S.clock > p.wantUntil) p.want = -1;
  // THROTTLE's aura
  const th = S.gremlins[2];
  p.slowed = Boolean(th && active(th) && !th.scrambled && p.inv <= 0 && distTo(th, p) <= TUNE.aura);
  p.speed = S.spd.player * (p.slowed ? 1 - TUNE.auraSlow : 1);
  const w = p.want;
  if (w >= 0) {
    if (w === OPP[p.dir] && p.moving) { p.dir = w; p.turned++; S.events.push({ type: 'turn', dir: w, reverse: true }); }
    else if (w !== p.dir || !p.moving) tryTurn(S, p, w);
  }
  advance(S, p, p.speed * dt, playerArrive);
}
// a turn near a junction: up to TUNE.corner tiles before or after its center; or from standing still
function tryTurn(S, p, w) {
  const tx = wrapX(Math.round(p.x)), ty = Math.round(p.y);
  const off = p.moving ? (DX[p.dir] !== 0 ? p.x - Math.round(p.x) : p.y - Math.round(p.y)) : 0;
  if (Math.abs(off) > TUNE.corner) return false;
  if (!canEnter(S, tx + DX[w], ty + DY[w])) return false;
  const was = p.dir;
  p.dir = w; p.moving = true; p.turned++;
  if (w !== was) S.events.push({ type: 'turn', dir: w, reverse: false });
  return true;
}
function playerArrive(p, tx, ty) {
  const S = playerArrive.S;
  if (p.want >= 0 && p.want !== p.dir && canEnter(S, tx + DX[p.want], ty + DY[p.want])) {
    p.dir = p.want; p.turned++;
    S.events.push({ type: 'turn', dir: p.want, reverse: false });
  }
  if (!canEnter(S, tx + DX[p.dir], ty + DY[p.dir])) p.moving = false;
}
playerArrive.S = null;

// ---------- picking things up ----------
function collect(S) {
  const p = S.player;
  const i = tileOf(p.x, p.y), tx = i % W, ty = (i / W) | 0;
  if (S.bits[i]) {
    S.bits[i] = 0; S.bitsLeft--; S.collectedHere++; S.bitsCollected++;
    S.score += TUNE.bit;
    S.events.push({ type: 'bit', x: tx, y: ty, n: S.collectedHere });
    if (S.collectedHere === TUNE.echoAt) joinEcho(S);
  }
  for (const k of S.keys) {
    if (k.on && k.x === tx && k.y === ty) {
      k.on = false;
      S.score += TUNE.key;
      S.enc = S.encMax; S.chain = 0;
      for (const g of S.gremlins) {
        if (g.state === 'roam' || g.state === 'stun' || (g.kind === 'echo' && (g.state === 'on' || g.state === 'join'))) {
          if (!g.scrambled && g.state === 'roam' && g.kind !== 'echo') { g.dir = OPP[g.dir]; g.moving = true; }
          g.scrambled = true;
          if (g.state === 'stun') g.state = 'roam';
        }
      }
      S.events.push({ type: 'key', x: tx, y: ty });
    }
  }
  const R = S.receipt;
  if (R.on && S.maze.receipt.x === tx && S.maze.receipt.y === ty) {
    R.on = false; S.score += R.value;
    S.events.push({ type: 'receiptGot', x: tx, y: ty, score: R.value });
  }
  const P = S.repeater;
  if (P.on && S.maze.repeater.x === tx && S.maze.repeater.y === ty) {
    P.on = false; P.done = true;
    const full = S.signal >= TUNE.signal;
    if (full) S.score += TUNE.repeaterFull; else S.signal++;
    S.events.push({ type: 'repeaterGot', x: tx, y: ty, full, score: full ? TUNE.repeaterFull : 0 });
  }
}

// ---------- the gremlins ----------
export const active = (g) => g.state === 'roam' || g.state === 'stun' || (g.kind === 'echo' && g.state === 'on');
export function distTo(a, b) {
  let dx = Math.abs(a.x - b.x);
  if (dx > W / 2) dx = W - dx;
  return Math.hypot(dx, a.y - b.y);
}
// the player's route-distance field (from the tile the letter is on), refreshed as it moves or a gate switches
export function playerField(S) {
  const t = tileOf(S.player.x, S.player.y);
  if (t !== S._pfTile || S._pfStamp !== S._stamp) {
    bfs(S, t, S._pf);
    S._pfTile = t; S._pfStamp = S._stamp;
  }
  return S._pf;
}
// THROTTLE aims this tile: up to 4 tiles ahead of the letter along its corridor (stops at a wall)
export function throttleTarget(S) {
  const p = S.player;
  let x = wrapX(Math.round(p.x)), y = Math.round(p.y);
  const d = p.dir;
  for (let k = 0; k < TUNE.throttleAhead; k++) {
    if (!canEnter(S, x + DX[d], y + DY[d])) break;
    x = wrapX(x + DX[d]); y += DY[d];
  }
  return y * W + x;
}
// JITTER: chasing (true) or off to a random junction (false); switches every 3-5 s (seeded)
export function jitterChasing(g) { return g.chase; }

const ASK_ORDER = [UP, LEFT, DOWN, RIGHT];
function gremlinArrive(g, tx, ty) {
  const S = gremlinArrive.S;
  chooseDir(S, g, tx, ty);
}
gremlinArrive.S = null;
// at a tile center: pick the way to go (never straight back unless there's nothing else)
export function chooseDir(S, g, tx, ty) {
  // each one steers by a target tile as the crow flies (so a wall can fool it: that's your breathing room)
  const p = S.player;
  let ax, ay, flee = false;
  if (g.scrambled) { flee = true; ax = p.x; ay = p.y; }
  else if (S.calm > 0 && S.corners[g.i] >= 0) { ax = S.corners[g.i] % W; ay = (S.corners[g.i] / W) | 0; }
  else if (g.kind === 'jitter' && !g.chase && g.wander >= 0) { ax = g.wander % W; ay = (g.wander / W) | 0; }
  else if (g.kind === 'throttle') { const t = throttleTarget(S); ax = t % W; ay = (t / W) | 0; }
  else { ax = p.x; ay = p.y; }
  let best = -1, bestScore = Infinity, n = 0;
  for (const d of ASK_ORDER) {
    if (d === OPP[g.dir]) continue;
    const nx = tx + DX[d], ny = ty + DY[d];
    if (!canEnter(S, nx, ny)) continue;
    n++;
    const dd = (nx - ax) ** 2 + (ny - ay) ** 2;
    const v = flee ? -dd + S.rng.next() * 6 : dd;   // fleeing: away from the letter, a little unpredictable
    if (v < bestScore) { bestScore = v; best = d; }
  }
  if (n === 0) {
    // a dead end for now (a closed gate): back the way it came, or wait
    if (canEnter(S, tx + DX[OPP[g.dir]], ty + DY[OPP[g.dir]])) { g.dir = OPP[g.dir]; g.moving = true; }
    else g.moving = false;
    return;
  }
  g.dir = best; g.moving = true;
}

function gremlinSpeed(S, g) {
  let v = S.spd.gremlin;
  if (g.kind === 'ping') v *= 1 + 0.1 * (1 - S.bitsLeft / S.maze.bitCount);
  if (g.kind === 'jitter') {
    // bursts: quick dashes, then a near stop
    const s = Math.max(0, Math.sin(g.burstT * Math.PI * 2 * 1.15));
    v *= 0.48 + 1.12 * s ** 0.7;
  }
  if (g.kind === 'throttle') v *= 0.93;
  if (S.calm > 0) v *= 0.85;
  if (g.scrambled) v *= TUNE.scrambledSpeed;
  return v;
}

function updateGremlin(S, g, dt) {
  const M = S.maze;
  switch (g.state) {
    case 'box': {
      g.t += dt;
      if (g.kind === 'echo') {
        // ECHO waits out its quarantine, then reconnects on your trail
        g.release -= dt;
        if (g.release <= 0) rejoinEcho(S, g);
        return;
      }
      g.release -= dt;
      if (g.release <= 0) { g.state = 'exit'; g.t = 0; g.fx = g.x; g.fy = g.y; }
      return;
    }
    case 'exit': {
      // out of the box: to the door's inside, through the door, onto the route outside
      g.t += dt;
      const sp = 3.6;
      const pts = [{ x: M.inside.x, y: M.inside.y }, { x: M.exit.x, y: M.exit.y }];
      const d0 = Math.hypot(pts[0].x - g.fx, pts[0].y - g.fy), d1 = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const k = g.t * sp;
      if (k < d0) { const u = k / d0; g.x = g.fx + (pts[0].x - g.fx) * u; g.y = g.fy + (pts[0].y - g.fy) * u; }
      else if (k < d0 + d1) { const u = (k - d0) / d1; g.x = pts[0].x + (pts[1].x - pts[0].x) * u; g.y = pts[0].y + (pts[1].y - pts[0].y) * u; }
      else {
        g.x = M.exit.x; g.y = M.exit.y; g.dir = M.exitDir; g.state = 'roam'; g.moving = true;
        if (S.enc > 0) g.scrambled = false;
        chooseDir(S, g, M.exit.x, M.exit.y);
        S.events.push({ type: 'release', kind: g.kind, x: g.x, y: g.y });
      }
      return;
    }
    case 'stun':
      g.t -= dt;
      if (g.t <= 0) { g.state = 'roam'; g.t = 0; }
      return;
    case 'return': {
      g.flyT += dt;
      const u = Math.min(1, g.flyT / g.flyDur);
      g.x = g.fx + (g.slot.x - g.fx) * u; g.y = g.fy + (g.slot.y - g.fy) * u;
      if (u >= 1) {
        g.state = 'box'; g.t = 0; g.release = TUNE.quarantineFor; g.scrambled = false;
        g.x = g.slot.x; g.y = g.slot.y;
      }
      return;
    }
    case 'off': case 'join': case 'on':
      if (g.kind === 'echo') { updateEcho(S, g, dt); return; }
      return;
    case 'roam': {
      if (g.kind === 'jitter') {
        g.burstT += dt;
        g.modeT -= dt;
        if (g.modeT <= 0) {
          g.chase = !g.chase;
          g.modeT = S.rng.range(3, 5);
          g.wander = g.chase ? -1 : S.junctions[Math.floor(S.rng.next() * S.junctions.length)];
          S.events.push({ type: 'jitter', chase: g.chase });
        }
      }
      if (!g.moving) chooseDir(S, g, wrapX(Math.round(g.x)), Math.round(g.y));
      g.speed = gremlinSpeed(S, g);
      gremlinArrive.S = S;
      advance(S, g, g.speed * dt, gremlinArrive);
      return;
    }
    default:
  }
}

// ---------- ECHO: your own latency, 2.5 s behind you ----------
function samplePos(S, lagSteps, out) {
  const k = Math.max(0, Math.min(TRAIL - 2, Math.round(lagSteps)));
  const i = ((S.head - k) % TRAIL + TRAIL) % TRAIL;
  out.x = S.trail[i * 2]; out.y = S.trail[i * 2 + 1];
  return out;
}
const _p = { x: 0, y: 0 }, _q = { x: 0, y: 0 };
// where the letter was `sec` seconds ago (the trail)
export function pastPos(S, sec, out = { x: 0, y: 0 }) { return samplePos(S, sec / STEP, out); }
function joinEcho(S) {
  const g = S.gremlins[3];
  if (!g || g.state !== 'off') return;
  g.state = 'join'; g.t = 0; g.lag = TUNE.echoLag / STEP; g.alpha = 0; g.scrambled = S.enc > 0;
  samplePos(S, g.lag, _p); g.x = _p.x; g.y = _p.y;
  S.events.push({ type: 'echo', x: g.x, y: g.y });
}
function rejoinEcho(S, g) {
  g.state = 'join'; g.t = 0; g.lag = TUNE.echoLag / STEP; g.alpha = 0; g.scrambled = false;
  samplePos(S, g.lag, _p); g.x = _p.x; g.y = _p.y;
  S.events.push({ type: 'echo', x: g.x, y: g.y, again: true });
}
function updateEcho(S, g, dt) {
  if (g.state === 'off') return;
  const base = TUNE.echoLag / STEP;
  // scrambled, it replays you slower and falls behind; afterwards it catches up to 2.5 s again
  if (g.scrambled) g.lag = Math.min(TRAIL - 4, g.lag + (1 - TUNE.scrambledSpeed));
  else if (g.lag > base) g.lag = Math.max(base, g.lag - 0.35);
  samplePos(S, g.lag, _p);
  samplePos(S, g.lag + 6, _q);
  const dx = _p.x - _q.x, dy = _p.y - _q.y;
  if (Math.abs(dx) > 1e-4 && Math.abs(dx) < 2) g.dir = dx > 0 ? RIGHT : LEFT;
  else if (Math.abs(dy) > 1e-4) g.dir = dy > 0 ? DOWN : UP;
  g.moving = Math.abs(dx) + Math.abs(dy) > 1e-4;
  g.x = _p.x; g.y = _p.y;
  if (g.state === 'join') {
    g.t += dt;
    g.alpha = Math.min(1, g.t / TUNE.echoJoin);
    if (g.t >= TUNE.echoJoin) g.state = 'on';
  }
}
export function echoPos(S, out = { x: 0, y: 0 }) { return samplePos(S, S.gremlins[3].lag, out); }

// ---------- touching ----------
function collide(S) {
  const p = S.player;
  for (const g of S.gremlins) {
    if (!active(g)) continue;
    if (distTo(g, p) >= TUNE.hitR) continue;
    if (g.scrambled) quarantine(S, g);
    else if (p.inv <= 0 && S.phase === 'play') hit(S, g);
  }
}
function quarantine(S, g) {
  const score = TUNE.chain[Math.min(S.chain, TUNE.chain.length - 1)];
  S.score += score; S.quarantined++;
  S.events.push({ type: 'quarantine', kind: g.kind, x: g.x, y: g.y, score, chain: S.chain + 1 });
  S.chain++;
  g.state = 'return'; g.scrambled = false; g.fx = g.x; g.fy = g.y; g.flyT = 0;
  g.flyDur = 0.45 + Math.hypot(g.slot.x - g.x, g.slot.y - g.y) * 0.035;
  S.hitstop = Math.max(S.hitstop, 0.05);
}
function hit(S, g) {
  const p = S.player;
  S.signal = Math.max(0, S.signal - 1);
  S.hits++; S.hitsHere++;
  const n = Math.min(TUNE.drop, S.collectedHere);
  const dropped = dropBits(S, n);
  p.inv = TUNE.inv;
  S.hitstop = TUNE.hitstop;
  // the gremlin that got you, and any other close by, hiccups (stops, turns round): you get a head start
  for (const o of S.gremlins) {
    if (o.kind === 'echo' || o.state !== 'roam' || o.scrambled) continue;
    if (o !== g && distTo(o, p) > 4) continue;
    o.state = 'stun'; o.t = o === g ? 0.8 : 0.5; o.dir = OPP[o.dir];
  }
  S.events.push({ type: 'hit', kind: g.kind, x: p.x, y: p.y, dropped, signal: S.signal });
  if (S.signal <= 0) { S.phase = 'lost'; S.events.push({ type: 'lost' }); }
}
// lose up to n collected bits: they arc out onto free route tiles near the letter (never walls, the box, gates or a
// tile that already has a bit), and must be picked up again
export function dropBits(S, n) {
  const p = S.player;
  if (n <= 0) return [];
  const from = tileOf(p.x, p.y);
  const dist = bfs(S, from, new Int16Array(N));
  const taken = new Set(S.flying.map((f) => f.ty * W + f.tx));
  const spots = (S.keys || []).filter((k) => k.on).map((k) => k.y * W + k.x);
  const M = S.maze;
  spots.push(M.receipt.y * W + M.receipt.x, M.repeater.y * W + M.repeater.x);
  const cand = [];
  for (const nearest of [TUNE.dropNear, 1]) {
    for (let i = 0; i < N; i++) {
      const d = dist[i];
      if (d < nearest || (nearest === 1 && d >= TUNE.dropNear)) continue;
      if (S.cell[i] !== PATH || S.bits[i] || taken.has(i) || spots.includes(i)) continue;
      cand.push(i);
    }
    if (cand.length >= n) break;     // (right next to the letter only when there's nowhere else)
  }
  // the nearest first (within TUNE.dropFar if there's room there, further out if not); then a seeded shuffle among
  // the nearest few so they spray around
  cand.sort((a, b) => dist[a] - dist[b] || a - b);
  let near = 0;
  while (near < cand.length && dist[cand[near]] <= TUNE.dropFar) near++;
  const pool = cand.slice(0, Math.max(Math.min(near, Math.max(n * 2, 16)), n));
  S.rng.shuffle(pool);
  const out = [];
  for (let k = 0; k < Math.min(n, pool.length); k++) {
    const i = pool[k];
    const f = { fx: p.x, fy: p.y, tx: i % W, ty: (i / W) | 0, t: 0, dur: 0.5 + 0.035 * k + dist[i] * 0.02 };
    S.flying.push(f); out.push(f);
  }
  S.bitsLeft += out.length; S.collectedHere -= out.length; S.bitsCollected -= out.length;
  S.score = Math.max(0, S.score - out.length * TUNE.bit);
  return out;
}

function clearMaze(S) {
  S.phase = 'clear';
  S.mazesDone++;
  const bonus = { delivery: deliveryBonus(S.n), signal: 150 * S.signal, lossless: S.hitsHere ? 0 : 1000 };
  bonus.total = bonus.delivery + bonus.signal + bonus.lossless;
  S.score += bonus.total;
  S.bonus = bonus;
  S.enc = 0;
  for (const g of S.gremlins) g.scrambled = false;
  S.events.push({ type: 'clear', bonus });
}

// the presentation's helpers
export function encrypted(S) { return S.enc > 0; }
export function flashing(S) { return S.enc > 0 && S.enc <= TUNE.encFlash; }
export function progressOf(S) { return 1 - S.bitsLeft / S.maze.bitCount; }

