// PACKET LOSS: AGI-1's own player, for ?demo (the arcade's preview) and the title screen's maze. No dice: the same
// run plays the same way. Each step it maps the danger (tiles near a gremlin, more where it's heading; ECHO's coming
// stretch of your trail), runs a Dijkstra from the letter's tile with those costs, and picks a goal: a scrambled
// gremlin it can still catch, a key when trouble is close, the repeater when it's hurt, the read receipt, otherwise the
// nearest bits. It asks for the first step of that route like a player would (a buffered turn), and only turns right
// round when it means it (three plans in a row, or a gremlin in its face).
import { W, H, DX, DY, OPP } from './mazes.js';
import { canEnter, tileOf, wrapX, active, TUNE, STEP, request } from './sim.js';

const N = W * H;
const DANGER = [220, 120, 64, 32, 15, 7, 3];

class Heap {
  constructor(n) { this.k = new Int32Array(n * 4); this.p = new Float32Array(n * 4); this.n = 0; }
  clear() { this.n = 0; }
  push(key, pri) {
    let i = this.n++;
    const k = this.k, p = this.p;
    while (i > 0) {
      const up = (i - 1) >> 1;
      if (p[up] <= pri) break;
      k[i] = k[up]; p[i] = p[up]; i = up;
    }
    k[i] = key; p[i] = pri;
  }
  pop() {
    const k = this.k, p = this.p, top = k[0];
    const lk = k[--this.n], lp = p[this.n];
    let i = 0;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= this.n) break;
      if (c + 1 < this.n && p[c + 1] < p[c]) c++;
      if (p[c] >= lp) break;
      k[i] = k[c]; p[i] = p[c]; i = c;
    }
    k[i] = lk; p[i] = lp;
    return top;
  }
}

export function createAI({ caution = 1 } = {}) {
  return {
    caution,
    danger: new Float32Array(N), dist: new Float32Array(N), steps: new Int16Array(N), prev: new Int32Array(N),
    seen: new Int16Array(N), q: new Int32Array(N), heap: new Heap(N),
    wantRev: 0, goal: -1, goalKind: '', lastDir: -1,
  };
}

// a BFS from tile `from`, at most `depth` deep, adding `table[d]` danger
function spread(S, ai, from, table, scale) {
  const seen = ai.seen, q = ai.q;
  seen.fill(-1);
  let head = 0, tail = 0;
  seen[from] = 0; q[tail++] = from;
  while (head < tail) {
    const i = q[head++], d = seen[i];
    ai.danger[i] += table[d] * scale;
    if (d + 1 >= table.length) continue;
    const x = i % W, y = (i / W) | 0;
    for (let k = 0; k < 4; k++) {
      const ny = y + DY[k];
      if (ny < 0 || ny >= H) continue;
      const nx = wrapX(x + DX[k]);
      const j = ny * W + nx;
      if (seen[j] >= 0 || !canEnter(S, nx, ny)) continue;
      seen[j] = d + 1; q[tail++] = j;
    }
  }
}

function mapDanger(S, ai) {
  const D = ai.danger;
  D.fill(0);
  const c = ai.caution;
  for (const g of S.gremlins) {
    if (g.kind === 'echo') continue;
    if (g.scrambled || !(active(g) || g.state === 'exit')) continue;
    const gt = tileOf(g.x, g.y);
    spread(S, ai, gt, DANGER, c);
    // more where it's going (it can't turn straight round)
    if (g.state === 'roam' && g.dir >= 0) {
      const ax = wrapX(Math.round(g.x) + DX[g.dir]), ay = Math.round(g.y) + DY[g.dir];
      if (canEnter(S, ax, ay)) spread(S, ai, ay * W + ax, [70, 30, 10], c);
    }
  }
  // THROTTLE's aura reaches through walls: being slowed near anything else is how letters get caught
  const th = S.gremlins[2];
  if (th && active(th) && !th.scrambled) {
    const r = TUNE.aura + 0.5, x0 = Math.floor(th.x - r), x1 = Math.ceil(th.x + r);
    for (let y = Math.max(0, Math.floor(th.y - r)); y <= Math.min(H - 1, Math.ceil(th.y + r)); y++) {
      for (let x = x0; x <= x1; x++) {
        if (Math.hypot(x - th.x, y - th.y) <= r) D[y * W + wrapX(x)] += 26 * c;
      }
    }
  }
  // ECHO walks your trail: the stretch it will cover next is no place to turn back into
  const e = S.gremlins[3];
  if (e && (e.state === 'on' || e.state === 'join') && !e.scrambled) {
    const lag = Math.round(e.lag);
    for (let k = 0; k <= Math.min(lag, 260); k += 6) {
      const s = ((S.head - lag + k) % 4096 + 4096) % 4096;
      const t = tileOf(S.trail[s * 2], S.trail[s * 2 + 1]);
      D[t] += (k < 60 ? 120 : 45) * c;
    }
    D[tileOf(e.x, e.y)] += 200 * c;
  }
}

function dijkstra(S, ai, from) {
  const dist = ai.dist, prev = ai.prev, steps = ai.steps, D = ai.danger, h = ai.heap;
  dist.fill(Infinity); prev.fill(-1); steps.fill(-1);
  h.clear();
  dist[from] = 0; steps[from] = 0; h.push(from, 0);
  while (h.n) {
    const i = h.pop();
    const x = i % W, y = (i / W) | 0, di = dist[i];
    for (let k = 0; k < 4; k++) {
      const ny = y + DY[k];
      if (ny < 0 || ny >= H) continue;
      const nx = wrapX(x + DX[k]);
      if (!canEnter(S, nx, ny)) continue;
      const j = ny * W + nx, nd = di + 1 + D[j];
      if (nd < dist[j]) { dist[j] = nd; prev[j] = i; steps[j] = steps[i] + 1; h.push(j, nd); }
    }
  }
}

// the first step from `from` toward `goal` (a direction), following the Dijkstra's tree back
function firstStep(ai, from, goal) {
  let i = goal, guard = N;
  while (ai.prev[i] !== from && ai.prev[i] >= 0 && guard--) i = ai.prev[i];
  if (ai.prev[i] !== from) return -1;
  const fx = from % W, fy = (from / W) | 0, x = i % W, y = (i / W) | 0;
  for (let d = 0; d < 4; d++) if (wrapX(fx + DX[d]) === x && fy + DY[d] === y) return d;
  return -1;
}

// one look at the board: → the direction to ask for (or -1)
export function think(ai, S) {
  if (S.phase !== 'play' && S.phase !== 'ready') return -1;
  const p = S.player;
  const from = tileOf(p.x, p.y);
  mapDanger(S, ai);
  dijkstra(S, ai, from);
  const dist = ai.dist, steps = ai.steps;
  let goal = -1, kind = '';
  // 1. a scrambled gremlin it can still catch before the key wears off
  if (S.enc > 0.5) {
    let best = Infinity;
    const close = S.spd.player * (1 - TUNE.scrambledSpeed);
    for (const g of S.gremlins) {
      if (!g.scrambled || !active(g)) continue;
      const t = tileOf(g.x, g.y), st = steps[t];
      if (st < 0) continue;
      const need = st / Math.max(1, close) + 0.25;
      if (need < S.enc * 0.95 && st < best) { best = st; goal = t; kind = 'hunt'; }
    }
  }
  // 2. trouble close and a key near: take it
  if (goal < 0) {
    let threat = Infinity;
    for (const g of S.gremlins) {
      if (g.scrambled || !active(g) || g.kind === 'echo') continue;
      const st = steps[tileOf(g.x, g.y)];
      if (st >= 0 && st < threat) threat = st;
    }
    if (threat <= 6 && S.enc <= 0) {
      let best = Infinity;
      for (const k of S.keys) {
        if (!k.on) continue;
        const t = k.y * W + k.x;
        if (steps[t] >= 0 && steps[t] <= 9 && dist[t] < best) { best = dist[t]; goal = t; kind = 'key'; }
      }
    }
  }
  // 3. hurt: the repeater; 4. the read receipt when it's handy
  if (goal < 0 && S.repeater.on && S.signal < TUNE.signal) {
    const t = S.maze.repeater.y * W + S.maze.repeater.x;
    if (steps[t] >= 0 && dist[t] < 60) { goal = t; kind = 'repeater'; }
  }
  if (goal < 0 && S.receipt.on) {
    const t = S.maze.receipt.y * W + S.maze.receipt.x;
    if (steps[t] >= 0 && steps[t] <= 12 && dist[t] < 40 && steps[t] / S.spd.player < S.receipt.t - 0.3) { goal = t; kind = 'receipt'; }
  }
  // 5. the nearest bits (a tie goes to the one with more bits around it)
  if (goal < 0) {
    let best = Infinity;
    for (let i = 0; i < N; i++) {
      if (!S.bits[i] || i === from) continue;
      const d = dist[i];
      if (d === Infinity) continue;
      let around = 0;
      const x = i % W, y = (i / W) | 0;
      for (let k = 0; k < 4; k++) { const ny = y + DY[k]; if (ny >= 0 && ny < H && S.bits[ny * W + wrapX(x + DX[k])]) around++; }
      const v = d - around * 0.3;
      if (v < best) { best = v; goal = i; kind = 'bit'; }
    }
  }
  ai.goal = goal; ai.goalKind = kind;
  let dir = goal >= 0 ? firstStep(ai, from, goal) : -1;
  if (dir < 0) {
    // nowhere to go (a bit under the letter, or walled in by a gate): keep going, safest way first
    let best = Infinity;
    const x = from % W, y = (from / W) | 0;
    for (let d = 0; d < 4; d++) {
      const nx = x + DX[d], ny = y + DY[d];
      if (!canEnter(S, nx, ny)) continue;
      const v = ai.danger[ny * W + wrapX(nx)] + (d === OPP[p.dir] ? 5 : 0);
      if (v < best) { best = v; dir = d; }
    }
  }
  // turning right round: only when it means it
  if (dir >= 0 && p.moving && dir === OPP[p.dir]) {
    const ahead = ai.danger[from] > 60;
    ai.wantRev++;
    if (!ahead && ai.wantRev < 3) dir = p.dir;
  } else ai.wantRev = 0;
  ai.lastDir = dir;
  return dir;
}

// a step of the AI: think, and ask the sim for the move
export function drive(ai, S) {
  const d = think(ai, S);
  if (d >= 0) request(S, d);
  return d;
}

export { STEP };
