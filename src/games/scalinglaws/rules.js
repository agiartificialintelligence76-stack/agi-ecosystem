// SCALING LAWS: the rules, pure and seeded (no DOM: tests/scalinglaws.test.js runs them in Node).
//
// AGI-1's model is a crowd of little parameters running down a neon track. Steer it left or right: every pair of gates
// does maths to it (+, ×, −, ÷), spinning "overfit" saws and data gaps knock parameters off, rival models block the
// road and trade parameters one for one, and the edges are a long way down. At the end of the track is the benchmark: a
// staircase where each step needs a few parameters to stand on it, and the highest step reached multiplies the score.
// Compute crystals on the way pay for upgrades between levels. Endless is one track that never ends.
//
// The road is x in [-1, 1] (its half-width is 1), z forward. The crowd is `n` parameters in a sunflower around (x, z).
import { rng, clamp } from '../kit/fx.js';

export const TUNE = Object.freeze({
  speed: 6.2, steer: 10, edge: 1.0, spacing: 0.055, maxR: 0.5, length0: 118, lengthPer: 4, lengthMax: 190,
  fightRate: 55, steps: 10, saw: 0.18, gem: 5,
});
export const MULTS = Object.freeze([1.2, 1.4, 1.6, 1.8, 2, 2.4, 2.8, 3.3, 4, 5]);
export const UPGRADES = Object.freeze([
  { id: 'pretrain', name: 'Pretraining', what: '+4 starting params', max: 12, cost: (lv) => 30 + lv * 25 },
  { id: 'data', name: 'Clean data', what: '+20% compute', max: 8, cost: (lv) => 40 + lv * 35 },
  { id: 'robust', name: 'Robustness', what: '−8% losses to hazards', max: 6, cost: (lv) => 60 + lv * 45 },
]);

// ---------- what a gate does ----------
export function apply(op, n) {
  switch (op.t) {
    case '+': return n + op.v;
    case 'x': return n * op.v;
    case '-': return Math.max(0, n - op.v);
    case '/': return Math.floor(n / op.v);
    default: return n;
  }
}
export const opText = (op) => (op.t === 'x' ? `×${op.v}` : op.t === '/' ? `÷${op.v}` : `${op.t}${op.v}`);
export const isGood = (op) => op.t === '+' || op.t === 'x';

// the crowd's shape: a sunflower, squeezed to fit the road (and longer front to back when it's squeezed)
export function formation(n) {
  const c = Math.min(TUNE.spacing, TUNE.maxR / Math.sqrt(Math.max(1, n)));
  return { c, depth: Math.min(6, TUNE.spacing / c), r: c * Math.sqrt(Math.max(1, n)) };
}
export function unitAt(i, f) {
  const r = f.c * Math.sqrt(i + 0.5), a = i * 2.399963;
  return { x: Math.cos(a) * r, z: Math.sin(a) * r * 0.62 * f.depth };
}
const SAMPLE = 260;

// ---------- a track ----------
function gateOps(r, n, level, endless) {
  const d = 1 + level * 0.18;
  const add = () => ({ t: '+', v: Math.max(3, Math.round(r.range(4, 9 + level * 2.6) * (endless ? d : 1))) });
  const mul = () => ({ t: 'x', v: r.chance(0.78) ? 2 : 3 });
  const sub = () => ({ t: '-', v: Math.max(3, Math.round(r.range(0.25, 0.6) * Math.max(8, n))) });
  const div = () => ({ t: '/', v: r.chance(0.75) ? 2 : 3 });
  const good = r.chance(n < 40 ? 0.45 : 0.3) ? mul() : add();
  const roll = r.next();
  // the other side: usually worse, sometimes a close call, now and then both good (pick the better)
  const other = roll < 0.42 ? (r.chance(0.6) ? sub() : div()) : roll < 0.75 ? add() : r.chance(0.5) ? mul() : add();
  return r.chance(0.5) ? [good, other] : [other, good];
}
export function makeTrack({ level = 1, seed = 1, endless = false, start = 10, from = 0, upto = null } = {}) {
  const r = rng((seed * 2246822519) ^ (level * 3266489917) ^ (from * 668265263));
  const length = endless ? Infinity : Math.min(TUNE.lengthMax, TUNE.length0 + level * TUNE.lengthPer);
  const end = upto ?? (endless ? from + 160 : length - 8);
  const items = [];
  let z = Math.max(from, 11);
  let n = start;                                  // the crowd if every gate were picked well (sizes the rivals)
  let id = from * 1000;
  const lv = endless ? 3 + Math.floor(from / 120) : level;
  while (z < end) {
    const roll = r.next();
    if (roll < 0.5 || items.length === 0) {
      const [L, R] = gateOps(r, n, lv, endless);
      items.push({ id: id++, kind: 'gates', z, ops: [L, R] });
      n = Math.max(apply(L, n), apply(R, n));
      z += r.range(8.5, 11.5);
    } else if (roll < 0.68 && lv >= 2) {
      const e = Math.max(4, Math.round(n * r.range(0.2, Math.min(0.58, 0.3 + lv * 0.022))));
      items.push({ id: id++, kind: 'rival', z, n: e, n0: e });
      n -= e;
      z += r.range(8, 10);
    } else if (roll < 0.82) {
      const fast = r.range(1.2, 1.8 + lv * 0.08);
      items.push({ id: id++, kind: 'saw', z, amp: r.range(0.45, 0.8), w: fast, ph: r.range(0, Math.PI * 2), x0: r.range(-0.2, 0.2) });
      if (lv >= 4 && r.chance(0.4)) items.push({ id: id++, kind: 'saw', z: z + 2.2, amp: r.range(0.5, 0.8), w: fast * 0.8, ph: r.range(0, Math.PI * 2), x0: 0 });
      n = Math.round(n * 0.92);
      z += r.range(7, 9);
    } else if (roll < 0.92) {
      // a wall with a gap: only the parameters in the gap get through
      const w = r.range(0.7, 1.1 - Math.min(0.35, lv * 0.02)), c = r.range(-1 + w / 2, 1 - w / 2);
      items.push({ id: id++, kind: 'wall', z, gap: [c - w / 2, c + w / 2] });
      n = Math.round(n * 0.85);
      z += r.range(7, 9);
    } else {
      // a data gap: a hole in the road on one side
      const left = r.chance(0.5), w = r.range(0.55, 0.85);
      items.push({ id: id++, kind: 'pit', z, z1: z + r.range(1.6, 2.6), x: left ? [-1.2, -1 + w] : [1 - w, 1.2] });
      z += r.range(7, 9);
    }
    // compute crystals now and then, in a little line
    if (r.chance(0.55)) {
      const gx = r.range(-0.75, 0.75), gz = z - r.range(3, 5), k = r.int(3, 5);
      for (let i = 0; i < k; i++) items.push({ id: id++, kind: 'gem', z: gz + i * 0.7, x: clamp(gx + Math.sin(i) * 0.15, -0.85, 0.85) });
    }
  }
  items.sort((a, b) => a.z - b.z);
  return { length, items, par: Math.max(1, n), end: z };
}

// the benchmark's staircase: how many parameters each step takes (a well-played level reaches the top)
export const stepCost = (par, level) => Math.max(2, Math.ceil(par / 11) + Math.floor(level / 6));

export function createRun({ level = 1, seed = 1, mode = 'campaign', upgrades = {} } = {}) {
  const endless = mode === 'endless';
  const start = 10 + (upgrades.pretrain || 0) * 4;
  const track = makeTrack({ level, seed, endless, start });
  return {
    mode, level, seed, endless, up: { pretrain: upgrades.pretrain || 0, data: upgrades.data || 0, robust: upgrades.robust || 0 },
    track, items: track.items, length: track.length, built: track.end, par: track.par, cost: stepCost(track.par, level),
    x: 0, tx: 0, z: 0, n: start, peak: start, time: 0, phase: 'run', fight: null, step: 0, stepT: 0, atFinale: 0,
    gems: 0, score: 0, over: false, won: false, cause: null, events: [], next: 0, rnd: rng(seed ^ 0x51ab),
    stats: { gates: 0, good: 0, lost: 0, rivals: 0, gems: 0, best: start },
  };
}
export const drain = (S) => S.events.splice(0, S.events.length);
const emit = (S, type, data = {}) => { S.events.push({ type, ...data }); };
export const sawX = (it, t) => clamp(it.x0 + Math.sin(t * it.w + it.ph) * it.amp, -0.9, 0.9);

// parameters lost to something in the way: those of the crowd's sampled units inside `inside(x, z)` (a share of them,
// so a big crowd isn't wiped out in one frame)
function cull(S, inside, cause, cap = 0.12) {
  const f = formation(S.n);
  const m = Math.min(S.n, SAMPLE);
  let hit = 0;
  for (let i = 0; i < m; i++) { const u = unitAt(i, f); if (inside(S.x + u.x, S.z + u.z)) hit++; }
  if (!hit) return 0;
  const robust = 1 - S.up.robust * 0.08;
  let k = Math.max(1, Math.round(hit * (S.n / m) * robust));
  k = Math.min(k, Math.max(1, Math.ceil(S.n * cap)), S.n);
  S.n -= k;
  S.stats.lost += k;
  emit(S, 'lost', { k, cause, x: S.x, z: S.z });
  return k;
}

function extend(S) {
  if (!S.endless || S.built - S.z > 60) return;
  const more = makeTrack({ level: S.level, seed: S.seed, endless: true, start: Math.max(10, S.n), from: S.built + 6 });
  S.items.push(...more.items);
  S.built = more.end;
  // (the ones far behind are dropped)
  S.items = S.items.filter((it) => it.z > S.z - 12 && !(it.done && it.z < S.z - 4));
  S.next = 0;
}

// time passes; `tx` is where the player is steering (−1..1)
export function update(S, dt, tx = S.tx) {
  if (S.over) return;
  S.time += dt;
  S.tx = clamp(tx, -1, 1);
  if (S.phase === 'fight') {
    const f = S.fight;
    const k = Math.min(S.n, f.it.n, Math.max(1, Math.ceil(dt * (TUNE.fightRate + Math.max(S.n, f.it.n) * 0.9))));
    S.n -= k; f.it.n -= k; f.acc += k;
    emit(S, 'clash', { k });
    if (S.n <= 0) { S.n = 0; lose(S, 'rival'); return; }
    if (f.it.n <= 0) { f.it.done = true; S.phase = 'run'; S.stats.rivals++; emit(S, 'beat', { lost: f.acc, z: f.it.z }); S.fight = null; }
    return;
  }
  if (S.phase === 'finale') {
    S.stepT -= dt;
    if (S.stepT <= 0) {
      if (S.n >= S.cost && S.step < TUNE.steps) {
        S.n -= S.cost; S.step++;
        S.stepT = 0.16;
        emit(S, 'step', { step: S.step, mult: MULTS[S.step - 1], n: S.n });
      } else win(S);
    }
    return;
  }
  // steering and running
  S.x += (S.tx - S.x) * (1 - Math.exp(-TUNE.steer * dt));
  S.x = clamp(S.x, -0.95, 0.95);
  const z0 = S.z;
  S.z += TUNE.speed * dt;
  extend(S);
  const f = formation(S.n);
  // the edges: parameters past them fall (only those well past, a crowd brushing the rail loses a few)
  if (Math.abs(S.x) + f.r > TUNE.edge + 0.04) cull(S, (x) => Math.abs(x) > TUNE.edge + 0.02, 'edge', 0.04);
  for (let i = S.next; i < S.items.length; i++) {
    const it = S.items[i];
    if (it.z > S.z + 3) break;
    if (it.done) continue;
    switch (it.kind) {
      case 'gates':
        if (it.z <= S.z && it.z > z0 - 1e-9) {
          const side = S.x < 0 ? 0 : 1, op = it.ops[side], before = S.n;
          S.n = Math.min(99999, apply(op, S.n));
          it.done = true; it.side = side;
          S.stats.gates++;
          const better = apply(op, before) >= apply(it.ops[1 - side], before);
          if (better) S.stats.good++;
          emit(S, 'gate', { op, before, after: S.n, side, good: isGood(op), better, z: it.z });
        }
        break;
      case 'rival':
        if (it.z <= S.z + f.r * f.depth * 0.6) { S.phase = 'fight'; S.fight = { it, acc: 0 }; emit(S, 'fight', { n: it.n, z: it.z }); return; }
        break;
      case 'saw': {
        if (Math.abs(it.z - S.z) < 1.2) { const sx = sawX(it, S.time); cull(S, (x, z) => (x - sx) ** 2 + ((z - it.z) * 1.4) ** 2 < TUNE.saw ** 2, 'saw', 0.035); }
        if (it.z < S.z - 1.5) it.done = true;
        break;
      }
      case 'wall':
        if (it.z <= S.z && it.z > z0 - 1e-9) {
          cull(S, (x) => x < it.gap[0] || x > it.gap[1], 'wall', 0.9);
          it.done = true;
        }
        break;
      case 'pit':
        if (S.z + 0.4 > it.z && S.z - 0.6 < it.z1) cull(S, (x, z) => z > it.z && z < it.z1 && x > it.x[0] && x < it.x[1], 'pit', 0.1);
        if (it.z1 < S.z - 1) it.done = true;
        break;
      case 'gem':
        if (Math.abs(it.z - S.z) < 0.3 + f.r * f.depth * 0.6 && Math.abs(it.x - S.x) < f.r + 0.1) {
          it.done = true;
          const v = Math.round(TUNE.gem * (1 + S.up.data * 0.2));
          S.gems += v; S.stats.gems++;
          emit(S, 'gem', { x: it.x, z: it.z, v });
        }
        break;
      default: break;
    }
    if (S.n <= 0) { S.n = 0; lose(S, it.kind); return; }
  }
  while (S.next < S.items.length && (S.items[S.next].done || S.items[S.next].z < S.z - 3)) S.next++;
  S.peak = Math.max(S.peak, S.n);
  S.stats.best = S.peak;
  if (!S.endless && S.z >= S.length) { S.phase = 'finale'; S.atFinale = S.n; S.stepT = 0.35; emit(S, 'finale', { n: S.n, cost: S.cost }); }
}
function win(S) {
  if (S.over) return;
  S.over = true; S.won = true; S.phase = 'won';
  const mult = S.step ? MULTS[S.step - 1] : 1;
  S.score = Math.round(S.atFinale * mult * 10) + S.gems;
  emit(S, 'won', { score: S.score, step: S.step, mult, params: S.atFinale });
}
function lose(S, cause) {
  if (S.over) return;
  S.over = true; S.cause = cause; S.phase = 'lost';
  S.score = S.endless ? Math.round(S.z) * 5 + Math.round(Math.sqrt(S.peak) * 10) + S.gems : S.gems;
  emit(S, 'lost-run', { cause, score: S.score });
}

export function dailySeed(date = new Date()) {
  const k = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  let h = 2166136261;
  for (const ch of `scalinglaws:${k}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return { key: k, seed: (h >>> 0) || 1 };
}
export const DAILY_LEVEL = 12;
// parameters as a size ("128B")
export const params = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}T` : `${n}B`);
