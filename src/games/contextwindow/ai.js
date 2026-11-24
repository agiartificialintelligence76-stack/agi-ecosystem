// CONTEXT WINDOW: a player made of code. It plays the demo (the previews on agi1.app/games), the title screen's attract
// run, and the tests and the balance tool (tools/games/contextwindow/balance.mjs) at three skill levels.
//
// Each step it looks for the token it wants most (a color to grow the thought it's holding, a different color to commit
// it once it's big enough, a wild card at two, a heart when it's hurt), finds the shortest way there through a grid where
// her tail moves out of the way as she goes (a cell her tail is on frees up after as many steps as it is from the end),
// and checks it won't box itself in: from the cell it steps to, enough of the board must still be reachable.
import { turn, frontRun, frontColor, SPAM, TUNE, DIRS } from './rules.js';
import { rng } from '../kit/fx.js';

export const PROFILES = Object.freeze({
  newbie: { greed: 3, slip: 0.1, look: false, wander: 0.2, picky: false },
  steady: { greed: 4, slip: 0.02, look: true, wander: 0, picky: false },
  expert: { greed: 5, slip: 0, look: true, wander: 0, picky: true },
  // (the preview: holds big thoughts, so there's a long, colorful tail to see)
  show: { greed: 7, slip: 0, look: true, wander: 0, picky: true },
});
const NAMES = Object.keys(DIRS);

export function createBot(profile = 'steady', seed = 1) {
  return { p: PROFILES[profile] || PROFILES.steady, rnd: rng(seed ^ 0x5eed) };
}

// when each cell frees up (0: free now; Infinity: a wall)
function freeAt(S) {
  const g = new Float32Array(S.W * S.H);
  const n = S.body.length;
  S.body.forEach((s, i) => { g[s.y * S.W + s.x] = Math.max(g[s.y * S.W + s.x], n - i); });
  for (const k of S.walls) g[k] = Infinity;
  return g;
}
const wrapOr = (S, x, y) => {
  if (x >= 0 && y >= 0 && x < S.W && y < S.H) return [x, y];
  if (!S.cfg.wrap) return null;
  return [(x + S.W) % S.W, (y + S.H) % S.H];
};

// how much a token is worth to it now
function want(S, t, p) {
  const run = frontRun(S), f = frontColor(S), room = TUNE.limit - S.body.length;
  switch (t.kind) {
    case 'color':
      if (run >= 3) return t.c !== f ? 10 + run * 2 : run < p.greed && room > 8 ? 7 : 0.5;
      if (run >= 1) return t.c === f ? 8 + run * 2 : room > 12 ? 1.2 : p.picky ? -1 : 0.4;
      return 3;
    case 'spam': return run >= 3 && room > 4 ? 6 : -4;
    case 'wild': return run === 2 ? 13 : run >= 3 && run < p.greed ? 7 : 3;
    case 'clear': return S.body.length > TUNE.limit * 0.6 ? 11 : 1;
    case 'heart': return S.cfg.hearts && S.hearts < TUNE.hearts ? 10 : 2;
    case 'boost': return 5;
    case 'coffee': return S.level > 4 ? 5 : 2;
    default: return 1;
  }
}

// breadth-first from her head: the first move toward each cell, and how far
function search(S, avoid) {
  const free = freeAt(S);
  const W = S.W, dist = new Int16Array(W * S.H).fill(-1), first = new Int8Array(W * S.H).fill(-1);
  const q = [S.head.x, S.head.y];
  dist[S.head.y * W + S.head.x] = 0;
  for (let qi = 0; qi < q.length; qi += 2) {
    const x = q[qi], y = q[qi + 1], d = dist[y * W + x];
    for (let k = 0; k < 4; k++) {
      const dir = DIRS[NAMES[k]];
      if (d === 0 && S.body.length && dir.x === -S.dir.x && dir.y === -S.dir.y) continue;
      const c = wrapOr(S, x + dir.x, y + dir.y);
      if (!c) continue;
      const i = c[1] * W + c[0];
      if (dist[i] >= 0 || free[i] > d + 1 || avoid.has(i)) continue;
      dist[i] = d + 1;
      first[i] = d === 0 ? k : first[y * W + x];
      q.push(c[0], c[1]);
    }
  }
  return { dist, first };
}
// how many cells she could still reach after one move in `dir` (a quick flood, her tail treated as fixed but its end free)
function room(S, dir, cap) {
  const c = wrapOr(S, S.head.x + dir.x, S.head.y + dir.y);
  if (!c) return -1;
  const free = freeAt(S);
  const W = S.W, start = c[1] * W + c[0];
  if (free[start] > 1) return -1;
  const seen = new Uint8Array(W * S.H);
  seen[start] = 1;
  seen[S.head.y * W + S.head.x] = 1;
  const q = [start];
  let n = 0;
  while (q.length && n < cap) {
    const i = q.pop(); n++;
    const x = i % W, y = (i / W) | 0;
    for (const d of Object.values(DIRS)) {
      const e = wrapOr(S, x + d.x, y + d.y);
      if (!e) continue;
      const j = e[1] * W + e[0];
      if (seen[j] || free[j] > 2 + n / 3) continue;
      seen[j] = 1; q.push(j);
    }
  }
  return n;
}

// decide, and ask for the turn (called before each step)
export function think(bot, S) {
  if (S.over) return;
  const p = bot.p;
  const need = Math.min(S.W * S.H * 0.45, S.body.length + 8);
  const avoid = new Set(S.tokens.filter((t) => want(S, t, p) < 0).map((t) => t.y * S.W + t.x));
  const { dist, first } = search(S, avoid);
  const options = S.tokens.map((t) => ({ t, d: dist[t.y * S.W + t.x], w: want(S, t, p) }))
    .filter((o) => o.d > 0 && o.w > 0).sort((a, b) => (b.w - b.d * 0.35) - (a.w - a.d * 0.35));
  let pick = null;
  if (p.wander && bot.rnd.chance(p.wander) && options.length > 1) options.push(options.shift());
  for (const o of options) {
    const k = first[o.t.y * S.W + o.t.x];
    if (k < 0) continue;
    if (!p.look || room(S, DIRS[NAMES[k]], need) >= need) { pick = NAMES[k]; break; }
  }
  if (!pick || bot.rnd.chance(p.slip)) {
    // nowhere it wants to go safely: the move that leaves the most room
    let best = -2;
    for (const name of NAMES) {
      const d = DIRS[name];
      if (S.body.length && d.x === -S.dir.x && d.y === -S.dir.y) continue;
      const r = room(S, d, 200) + (bot.rnd.next() * (p.look ? 0.5 : 6));
      if (r > best) { best = r; pick = name; }
    }
  }
  if (pick) {
    const d = DIRS[pick];
    if (d.x !== S.dir.x || d.y !== S.dir.y || S.ready > 0) { S.queue.length = 0; turn(S, pick); }
  }
}

// a whole run played by a bot, for the tests and the balance tool → { score, time, level, commits, cause, … }
export async function playRun({ mode = 'classic', seed = 1, profile = 'steady', W = 13, H = 19, maxTime = 900 } = {}) {
  const { createRun, update, drain } = await import('./rules.js');
  const S = createRun({ mode, seed, W, H });
  const bot = createBot(profile, seed);
  const dt = 1 / 60;
  while (!S.over && S.time < maxTime) { update(S, dt, (s) => think(bot, s)); drain(S); }
  return { score: S.score, time: S.time, level: S.level, commits: S.commits, cause: S.cause, stats: S.stats, over: S.over, spam: SPAM };
}
