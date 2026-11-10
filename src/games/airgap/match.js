// AIR GAP: a match's rules. Pure (no DOM): the score, the serve and its one-second breath, the stall rule, first to N,
// and the power-up chips that slide onto the table (FIREWALL, SPLIT, LAG, BIG MALLET, PATCH) with their timers. The
// game (and the demo, the attract match, the tests) sets each mallet's target, calls stepMatch(M, dt) every 1/120 s and
// reads M.ev for what happened (sounds, sparks, her lines).
import { len, dsin, dcos } from './dmath.js';
import { rng as makeRng } from '../kit/fx.js';
import {
  W, H, MID, PUCK_R, MALLET_R, BIG, buildWalls, makePuck, makeMallet, stepPhysics, scored,
  PUCK_MAX, TURBO_MAX, MALLET_MAX, DRAG, TURBO_DRAG,
} from './physics.js';

export const SERVE_BREATH = 1.0;     // a served puck waits this long, still, before it's live
export const GOAL_TIME = 1.2;        // the celebration before the next serve
export const WIN_TIME = 1.9;         // the last goal's celebration before the match is over
export const STALL = 7;              // seconds in one half before it goes to the other side
export const CHIP_R = 24;
export const KINDS = ['firewall', 'split', 'lag', 'big', 'patch'];
export const DURATION = { firewall: 6, split: 8, lag: 5, big: 8, patch: 8 };
export const LABEL = { firewall: 'FIREWALL', split: 'SPLIT', lag: 'LAG', big: 'BIG MALLET', patch: 'PATCH' };
const WEIGHT = { firewall: 20, split: 22, lag: 18, big: 22, patch: 18 };
export const CHIP_FIRST = 7, CHIP_EVERY = 12, CHIP_LIFE = 9, CHIP_IN = 0.55, CHIP_OUT = 0.45;
export const SERVE_Y = [760, 240];   // where each side's serve waits
export const TARGETS = [5, 7, 11];
const SPLIT_COS = dcos(0.42), SPLIT_SIN = dsin(0.42);   // the two new pucks fan out 24° either side

export function createMatch({ seed = 1, to = 7, powerups = true, turbo = false, score = [0, 0], serveTo = 0, chipFirst = CHIP_FIRST } = {}) {
  const M = {
    seed, rng: makeRng(seed >>> 0 || 1), to, powerups, turbo,
    puckMax: turbo ? TURBO_MAX : PUCK_MAX, drag: turbo ? TURBO_DRAG : DRAG,
    t: 0, phase: 'serve', phaseT: 0,
    score: score.slice(0, 2),
    pucks: [], mallets: [makeMallet(0), makeMallet(1)], nextId: 1,
    last: -1, lastHit: [-9, -9], rallySide: -1,
    serveTo, servedAt: 0,
    stall: { side: -1, t: 0, warned: 0 },
    chip: null, chipT: chipFirst, lastKind: null,
    active: [null, null],          // each side's power-up: { kind, t, dur }
    walls: buildWalls(), wallsKey: '0000',
    ev: [],
    stats: { rally: 0, longest: 0, fastest: [0, 0], powerups: [0, 0], hits: [0, 0], shots: [0, 0], goals: [] },
    winner: -1,
  };
  for (const m of M.mallets) m.max = MALLET_MAX * (turbo ? 1.08 : 1);
  serve(M, serveTo, { quiet: true });
  return M;
}

// the puck, still, on `side`'s half; live after a breath
export function serve(M, side, { quiet = false } = {}) {
  endSplit(M, { quiet: true });
  M.pucks.length = 0;
  const p = makePuck(M.nextId++, W / 2, SERVE_Y[side]);
  p.ghost = SERVE_BREATH;
  M.pucks.push(p);
  M.serveTo = side;
  M.phase = 'serve'; M.phaseT = 0; M.servedAt = M.t;
  M.last = -1; M.rallySide = -1;
  M.stats.rally = 0;
  M.stall.side = -1; M.stall.t = 0; M.stall.warned = 0;
  if (!quiet) M.ev.push({ type: 'serve', side });
}

// ---------- power-ups ----------
export const isOn = (M, side, kind) => M.active[side]?.kind === kind;
export const lagged = (M, side) => isOn(M, 1 - side, 'lag');
export const splitOn = (M) => isOn(M, 0, 'split') || isOn(M, 1, 'split');

function refreshWalls(M) {
  const patch = [isOn(M, 0, 'patch'), isOn(M, 1, 'patch')], fw = [isOn(M, 0, 'firewall'), isOn(M, 1, 'firewall')];
  const key = `${+patch[0]}${+patch[1]}${+fw[0]}${+fw[1]}`;
  if (key !== M.wallsKey) { M.wallsKey = key; M.walls = buildWalls({ patch, firewall: fw }); }
  for (const m of M.mallets) {
    m.rt = isOn(M, m.side, 'big') ? MALLET_R * BIG : MALLET_R;
    m.lag = lagged(M, m.side) ? 1 : 0;
  }
}

export function pickKind(M) {
  const options = KINDS.filter((k) => k !== M.lastKind);
  return M.rng.weighted(options, (k) => WEIGHT[k]);
}

// a chip slides in from a side rail to (x, y) (never in a goal crease, never under a puck or a mallet)
export function spawnChip(M, kind = pickKind(M), at = null) {
  let x = 300, y = 500;
  if (at) { x = at.x; y = at.y; } else {
    for (let tries = 0; tries < 16; tries++) {
      x = M.rng.range(110, W - 110); y = M.rng.range(280, H - 280);
      const clear = M.pucks.every((p) => len(p.x - x, p.y - y) > 110) && M.mallets.every((m) => len(m.x - x, m.y - y) > 120);
      if (clear) break;
    }
  }
  M.chip = { kind, x, y, from: x < W / 2 ? -70 : W + 70, t: 0, state: 'in' };
  M.lastKind = kind;
  M.ev.push({ type: 'chipIn', kind, x, y });
  return M.chip;
}
// where the chip is drawn (sliding in or out): → { x, y, k (0..1 how far in) }
export function chipPos(chip, out = { x: 0, y: 0, k: 0 }) {
  let k = 1;
  if (chip.state === 'in') { const t = Math.min(1, chip.t / CHIP_IN); k = 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2; }
  else if (chip.state === 'out') { const t = Math.min(1, chip.t / CHIP_OUT); k = 1 - t * t; }
  out.x = chip.from + (chip.x - chip.from) * k; out.y = chip.y; out.k = k;
  return out;
}

function nextChipIn(M) { M.chipT = CHIP_EVERY + M.rng.range(-2, 2); }

function apply(M, kind, side, puck) {
  if (M.active[side]) end(M, side);
  if (kind === 'split' && splitOn(M)) end(M, 1 - side);
  M.active[side] = { kind, t: DURATION[kind], dur: DURATION[kind] };
  M.stats.powerups[side]++;
  if (kind === 'split' && puck) {
    // three pucks, fanning out from where it hit the chip
    const s0 = len(puck.vx, puck.vy), sp = Math.max(750, s0);
    const ux = s0 > 1 ? puck.vx / s0 : 0, uy = s0 > 1 ? puck.vy / s0 : (M.last === 0 ? -1 : 1);
    puck.vx = ux * sp; puck.vy = uy * sp;
    for (const sn of [-SPLIT_SIN, SPLIT_SIN]) {
      const q = makePuck(M.nextId++, puck.x, puck.y, (ux * SPLIT_COS - uy * sn) * sp, (ux * sn + uy * SPLIT_COS) * sp);
      q.noPP = 0.3; q.split = true;
      M.pucks.push(q);
    }
    puck.noPP = 0.3;
  }
  refreshWalls(M);
  M.ev.push({ type: 'powerup', kind, side, x: puck?.x ?? W / 2, y: puck?.y ?? MID });
}
function end(M, side, { quiet = false } = {}) {
  const a = M.active[side];
  if (!a) return;
  M.active[side] = null;
  if (a.kind === 'split') mergeSplit(M, quiet);
  refreshWalls(M);
  if (!quiet) M.ev.push({ type: 'powerEnd', kind: a.kind, side });
}
function endSplit(M, opts) { for (const s of [0, 1]) if (isOn(M, s, 'split')) end(M, s, opts); }
// SPLIT ends: the extra pucks pop, the oldest one left plays on
function mergeSplit(M, quiet) {
  if (M.pucks.length <= 1) return;
  let keep = M.pucks[0];
  for (const p of M.pucks) if (p.id < keep.id) keep = p;
  for (const p of M.pucks) if (p !== keep && !quiet) M.ev.push({ type: 'merge', x: p.x, y: p.y });
  M.pucks.length = 0;
  M.pucks.push(keep);
}

// ---------- one tick ----------
export function stepMatch(M, dt) {
  if (M.phase === 'over') return;
  M.t += dt; M.phaseT += dt;
  // the power-ups' timers
  for (const s of [0, 1]) {
    const a = M.active[s];
    if (a && (a.t -= dt) <= 0) end(M, s);
  }
  refreshWalls(M);
  const live = M.phase === 'play' || M.phase === 'serve';
  const S = { pucks: live ? M.pucks : [], mallets: M.mallets, walls: M.walls, puckMax: M.puckMax, drag: M.drag };
  const evStart = M.ev.length;
  stepPhysics(S, dt, M.ev);
  // who touched it last, the rally, the fastest shots
  for (let i = evStart; i < M.ev.length; i++) {
    const e = M.ev[i];
    if (e.type !== 'hit') continue;
    if (M.phase === 'serve') { M.phase = 'play'; M.phaseT = 0; }
    const s = e.side;
    if (!e.soft && (s !== M.rallySide || M.t - M.lastHit[s] > 0.4)) { M.stats.rally++; M.stats.longest = Math.max(M.stats.longest, M.stats.rally); M.stats.hits[s]++; }
    if (e.speed > 900) M.stats.shots[s]++;
    M.rallySide = s; M.lastHit[s] = M.t; M.last = s;
    M.stats.fastest[s] = Math.max(M.stats.fastest[s], e.out || 0);
  }
  if (M.phase === 'serve') {
    if (M.phaseT >= SERVE_BREATH) { M.phase = 'play'; M.phaseT = 0; for (const p of M.pucks) p.ghost = 0; M.ev.push({ type: 'live', side: M.serveTo }); }
    return;
  }
  if (M.phase === 'goal') {
    if (M.phaseT >= GOAL_TIME) serve(M, M.serveTo);
    return;
  }
  if (M.phase === 'won') {
    if (M.phaseT >= WIN_TIME) { M.phase = 'over'; M.ev.push({ type: 'over', winner: M.winner }); }
    return;
  }
  // play: goals (the whole puck past the line), lost pucks, the stall rule, the chips
  for (let i = M.pucks.length - 1; i >= 0; i--) {
    const p = M.pucks[i];
    if (p.lost) { M.pucks.splice(i, 1); continue; }
    const by = scored(p);
    if (by < 0) continue;
    M.pucks.splice(i, 1);
    goal(M, by, p);
    if (M.phase !== 'play') return;
  }
  if (!M.pucks.length) { serve(M, M.serveTo); return; }
  stall(M, dt);
  if (M.phase !== 'play') return;
  chips(M, dt);
}

function goal(M, by, p) {
  M.score[by]++;
  const speed = len(p.vx, p.vy);
  M.stats.goals.push({ by, t: M.t, speed, rally: M.stats.rally });
  const won = M.score[by] >= M.to;
  M.ev.push({ type: 'goal', side: by, x: p.x, y: p.y, speed, split: M.pucks.length > 0 && !won, score: M.score.slice(), last: M.last });
  M.serveTo = 1 - by;
  if (won) {
    M.winner = by;
    M.phase = 'won'; M.phaseT = 0;
    M.chip = null;
    for (const s of [0, 1]) end(M, s, { quiet: true });
    M.pucks.length = 0;
    M.ev.push({ type: 'win', side: by, score: M.score.slice() });
    return;
  }
  if (M.score[by] === M.to - 1) M.ev.push({ type: 'matchPoint', side: by });
  if (M.pucks.length) return;              // SPLIT: the others play on
  endSplit(M, { quiet: true });
  M.phase = 'goal'; M.phaseT = 0;
}

function stall(M, dt) {
  if (M.pucks.length !== 1) { M.stall.side = -1; M.stall.t = 0; return; }
  const side = M.pucks[0].y >= MID ? 0 : 1;
  const st = M.stall;
  if (side !== st.side) { st.side = side; st.t = 0; st.warned = 0; return; }
  st.t += dt;
  const left = Math.ceil(STALL - st.t);
  if (left <= 3 && left >= 1 && st.warned !== left) { st.warned = left; M.ev.push({ type: 'stallTick', side, left }); }
  if (st.t >= STALL) {
    M.ev.push({ type: 'stall', side });
    serve(M, 1 - side);
  }
}

function chips(M, dt) {
  if (!M.powerups) return;
  if (!M.chip) {
    if (splitOn(M)) return;
    M.chipT -= dt;
    if (M.chipT <= 0) spawnChip(M);
    return;
  }
  const c = M.chip;
  c.t += dt;
  if (c.state === 'in' && c.t >= CHIP_IN) { c.state = 'on'; c.t = 0; }
  else if (c.state === 'on' && c.t >= CHIP_LIFE) { c.state = 'out'; c.t = 0; M.ev.push({ type: 'chipOut', kind: c.kind }); }
  else if (c.state === 'out' && c.t >= CHIP_OUT) { M.chip = null; nextChipIn(M); return; }
  if (c.state !== 'on' || M.last < 0) return;
  for (const p of M.pucks) {
    if (len(p.x - c.x, p.y - c.y) < PUCK_R + CHIP_R - 4) {
      M.chip = null;
      nextChipIn(M);
      apply(M, c.kind, M.last, p);
      return;
    }
  }
}

// ---------- reading a match ----------
// the side whose half the puck (or the first puck) is in
export const halfOf = (y) => (y >= MID ? 0 : 1);
export const isMatchPoint = (M, side) => M.score[side] === M.to - 1;
