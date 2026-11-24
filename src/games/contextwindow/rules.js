// CONTEXT WINDOW: the rules, pure and seeded (no DOM: tests/contextwindow.test.js runs them in Node).
//
// AGI-1's cursor runs round a grid eating tokens. Every token she eats joins her train of thought right behind her, so
// her tail is her context: its colors in the order she ate them. Three or more of one color in a row at the front is a
// thought she's holding; eating a token of a DIFFERENT color commits it: the run is compressed out of her context for
// 10 × n × n points (a run of 6 is worth four times a run of 3), and the tail slides up to close the gap. Spam tokens are
// junk segments that never match; committing a thought right in front of junk shatters it, and the two sides join.
// Her context holds 24: past that she forgets her oldest token and loses a heart (three, and it's over). The walls, the
// firewalls and her own tail end a run. Commits in a row (within 8 s) build a chain, up to ×5.
import { rng } from '../kit/fx.js';

export const COLORS = Object.freeze(['honey', 'pink', 'mint', 'sky', 'violet']);
export const SPAM = 9;
export const SPECIALS = Object.freeze(['wild', 'clear', 'boost', 'coffee', 'heart']);
export const TUNE = Object.freeze({
  limit: 24, hearts: 3, tokens: 5, perLevel: 5, chainWindow: 8, chainMax: 5,
  speed0: 5.4, speedPer: 0.45, speedMax: 12, zenSpeed: 6, coffee: 0.62,
  boostT: 10, coffeeT: 7, clearN: 4, readyT: 1.4, wallsFrom: 4, wallsMax: 9,
});
export const MODES = Object.freeze({
  classic: { id: 'classic', label: 'Classic', wrap: false, hearts: true, walls: true, spam: true, specials: true },
  daily: { id: 'daily', label: 'Daily', wrap: false, hearts: true, walls: true, spam: true, specials: true },
  zen: { id: 'zen', label: 'Zen', wrap: true, hearts: false, walls: false, spam: false, specials: true },
});
export const DIRS = Object.freeze({ up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } });

// the grid for the screen's shape (fixed for a run; a phone turned mid-run just redraws it bigger or smaller)
export function dimsFor(aspect) {
  if (aspect < 0.62) return { W: 13, H: 21 };
  if (aspect < 0.8) return { W: 13, H: 19 };
  if (aspect > 1.55) return { W: 21, H: 13 };
  return { W: 17, H: 15 };
}

// how many colors are in play, how fast she runs, how often spam comes
export const colorsAt = (level, mode = 'classic') => (mode === 'zen' ? 4 : level < 3 ? 3 : level < 6 ? 4 : 5);
export function speedOf(S) {
  const base = S.cfg.id === 'zen' ? TUNE.zenSpeed : Math.min(TUNE.speedMax, TUNE.speed0 + (S.level - 1) * TUNE.speedPer);
  return base * (S.coffeeT > 0 ? TUNE.coffee : 1);
}
export const spamChance = (S) => (S.cfg.spam ? Math.min(0.2, 0.035 * (S.level - 1)) : 0);
export const points = (n, chain, boost) => 10 * n * n * Math.min(TUNE.chainMax, Math.max(1, chain)) * (boost ? 2 : 1);

export function createRun({ mode = 'classic', seed = 1, W = 13, H = 19, level = 1, extra = 0 } = {}) {
  const cfg = MODES[mode] || MODES.classic;
  const S = {
    cfg, mode: cfg.id, W, H, seed, rnd: rng(seed),
    head: { x: Math.floor(W / 4), y: Math.floor(H / 2), px: Math.floor(W / 4), py: Math.floor(H / 2) },
    dir: { x: 1, y: 0 }, queue: [], body: [], tokens: [], walls: new Set(), wallList: [],
    score: 0, level, commits: (level - 1) * TUNE.perLevel, hearts: TUNE.hearts, chain: 0, chainT: 0, boostT: 0, coffeeT: 0,
    extra, ready: TUNE.readyT, stepAcc: 0, time: 0, steps: 0, nextId: 1, over: false, cause: null, events: [],
    stats: { commits: 0, biggest: 0, chainMax: 0, forgot: 0, spam: 0, shattered: 0, eaten: 0, longest: 0, specials: 0 },
  };
  for (let i = 0; i < TUNE.tokens + extra; i++) spawnToken(S);
  return S;
}

const key = (S, x, y) => y * S.W + x;
export const frontColor = (S) => (S.body.length ? S.body[0].c : null);
export function frontRun(S) {
  const b = S.body;
  if (!b.length || b[0].c === SPAM) return 0;
  let n = 1;
  while (n < b.length && b[n].c === b[0].c) n++;
  return n;
}
export const drain = (S) => S.events.splice(0, S.events.length);
const emit = (S, type, data = {}) => { S.events.push({ type, ...data }); };

// a turn the player asked for (queued: two quick swipes make a tight U-turn)
export function turn(S, name) {
  const d = DIRS[name];
  if (!d || S.over) return false;
  const last = S.queue.length ? S.queue[S.queue.length - 1] : S.dir;
  if (d.x === last.x && d.y === last.y) { if (S.ready > 0) S.ready = 0; return false; }
  if (S.body.length && d.x === -last.x && d.y === -last.y) return false;
  if (S.queue.length >= 3) return false;
  S.queue.push(d);
  if (S.ready > 0) S.ready = 0;
  return true;
}

// ---------- the board ----------
export function occupied(S, x, y) {
  if (S.head.x === x && S.head.y === y) return 'head';
  if (S.walls.has(key(S, x, y))) return 'wall';
  for (const s of S.body) if (s.x === x && s.y === y) return 'body';
  for (const t of S.tokens) if (t.x === x && t.y === y) return 'token';
  return null;
}
function freeCell(S, { clear = 2 } = {}) {
  for (let tries = 0; tries < 400; tries++) {
    const x = S.rnd.int(0, S.W - 1), y = S.rnd.int(0, S.H - 1);
    if (occupied(S, x, y)) continue;
    // never right in front of her (no free token she can't avoid)
    const ahead = (x - S.head.x) * S.dir.x + (y - S.head.y) * S.dir.y;
    const side = Math.abs((x - S.head.x) * S.dir.y) + Math.abs((y - S.head.y) * S.dir.x);
    if (ahead > 0 && ahead <= clear && side === 0) continue;
    if (Math.abs(x - S.head.x) + Math.abs(y - S.head.y) < 2) continue;
    return { x, y };
  }
  return null;
}
export function spawnToken(S, { quiet = true } = {}) {
  const at = freeCell(S);
  if (!at) return null;
  const r = S.rnd;
  const hasSpecial = S.tokens.some((t) => t.kind !== 'color' && t.kind !== 'spam');
  let tok;
  if (S.cfg.specials && !hasSpecial && S.level + S.commits > 1 && r.chance(0.1 + Math.min(0.06, S.level * 0.01))) {
    const pool = [
      { kind: 'wild', weight: 3 },
      { kind: 'clear', weight: S.body.length > 10 ? 3 : 0.5 },
      { kind: 'boost', weight: 2 },
      { kind: 'coffee', weight: S.cfg.id === 'zen' ? 0 : 1.2 },
      { kind: 'heart', weight: S.cfg.hearts && S.hearts < TUNE.hearts ? 2.5 : 0 },
    ];
    tok = { kind: r.weighted(pool).kind, life: 9 + r.range(0, 3) };
  } else if (r.chance(spamChance(S))) {
    tok = { kind: 'spam', c: SPAM, life: 26 + r.range(0, 8) };
  } else {
    const n = colorsAt(S.level, S.mode), f = frontColor(S);
    // a fair board: now and then the color she's holding, so a run can always grow
    const c = f != null && f !== SPAM && f < n && r.chance(0.3) ? f : r.int(0, n - 1);
    tok = { kind: 'color', c, life: 15 + r.range(0, 9) };
  }
  Object.assign(tok, { x: at.x, y: at.y, id: S.nextId++, age: 0, max: tok.life });
  S.tokens.push(tok);
  if (!quiet) emit(S, 'spawn', { token: tok });
  return tok;
}
function addWalls(S) {
  if (!S.cfg.walls || S.level < TUNE.wallsFrom || S.wallList.length >= TUNE.wallsMax) return;
  const r = S.rnd;
  for (let tries = 0; tries < 80; tries++) {
    const len = r.int(2, 3), horiz = r.chance(0.5);
    const x0 = r.int(1, S.W - 2 - (horiz ? len : 0)), y0 = r.int(1, S.H - 2 - (horiz ? 0 : len));
    const cells = Array.from({ length: len }, (_, i) => ({ x: x0 + (horiz ? i : 0), y: y0 + (horiz ? 0 : i) }));
    const ok = cells.every((c) => !occupied(S, c.x, c.y) && Math.abs(c.x - S.head.x) + Math.abs(c.y - S.head.y) > 4
      && !S.body.some((s) => Math.abs(s.x - c.x) + Math.abs(s.y - c.y) < 2));
    if (!ok) continue;
    for (const c of cells) S.walls.add(key(S, c.x, c.y));
    S.wallList.push(cells);
    emit(S, 'wall', { cells });
    return;
  }
}

// ---------- her context ----------
// the segments behind the removed ones slide up the path (each takes the place of the one `n` ahead of it)
function removeAt(S, i, n) {
  const path = S.body.map((s) => ({ x: s.x, y: s.y }));
  const gone = S.body.splice(i, n);
  S.body.forEach((s, j) => { s.px = s.x; s.py = s.y; s.x = path[j].x; s.y = path[j].y; s.slide = j >= i ? n : 0; });
  return gone;
}
function addSegment(S, c, at) {
  const seg = { x: at.x, y: at.y, px: at.x, py: at.y, c, id: S.nextId++, born: S.time };
  S.body.unshift(seg);
  // the thought she was holding, committed by a different color
  const n = frontRunAfter(S);
  if (n >= 3 && c !== S.body[1].c) commit(S, n);
  S.stats.longest = Math.max(S.stats.longest, S.body.length);
  // too much context: she forgets the oldest token
  while (S.body.length > TUNE.limit) {
    const old = S.body.pop();
    S.stats.forgot++;
    if (S.cfg.hearts) S.hearts--;
    emit(S, 'forget', { x: old.x, y: old.y, c: old.c, hearts: S.hearts });
    if (S.cfg.hearts && S.hearts <= 0) { end(S, 'overflow'); return; }
  }
}
// the run right behind the new segment (index 1 onward)
function frontRunAfter(S) {
  const b = S.body;
  if (b.length < 2 || b[1].c === SPAM) return 0;
  let n = 1;
  while (1 + n < b.length && b[1 + n].c === b[1].c) n++;
  return n;
}
function commit(S, n) {
  const c = S.body[1].c;
  const cells = S.body.slice(1, 1 + n).map((s) => ({ x: s.x, y: s.y, c: s.c }));
  S.chain = S.chainT > 0 ? Math.min(TUNE.chainMax, S.chain + 1) : 1;
  S.chainT = TUNE.chainWindow;
  const pts = points(n, S.chain, S.boostT > 0);
  S.score += pts;
  S.commits++;
  S.stats.commits++;
  S.stats.biggest = Math.max(S.stats.biggest, n);
  S.stats.chainMax = Math.max(S.stats.chainMax, S.chain);
  removeAt(S, 1, n);
  emit(S, 'commit', { n, c, pts, chain: S.chain, cells, boost: S.boostT > 0 });
  // junk right behind it shatters, and the two sides join
  let junk = 0;
  while (S.body.length > 1 && S.body[1].c === SPAM) {
    const [g] = removeAt(S, 1, 1);
    junk++;
    emit(S, 'shatter', { x: g.x, y: g.y });
  }
  if (junk) {
    const bonus = 25 * junk * S.chain;
    S.score += bonus;
    S.stats.shattered += junk;
    emit(S, 'shattered', { n: junk, pts: bonus });
    const joined = frontRun(S);
    if (joined >= 3) emit(S, 'join', { n: joined, c: S.body[0].c });
  }
  if (S.commits % TUNE.perLevel === 0) levelUp(S);
}
function levelUp(S) {
  S.level++;
  emit(S, 'level', { level: S.level, colors: colorsAt(S.level, S.mode) });
  addWalls(S);
  if (S.level >= 5 && S.tokens.length < TUNE.tokens + 1) spawnToken(S, { quiet: false });
}
function end(S, cause) {
  if (S.over) return;
  S.over = true;
  S.cause = cause;
  emit(S, 'over', { cause, score: S.score });
}

function eat(S, tok, at) {
  S.tokens.splice(S.tokens.indexOf(tok), 1);
  S.stats.eaten++;
  S.score += S.boostT > 0 ? 10 : 5;
  const run = frontRun(S);
  emit(S, 'eat', { x: tok.x, y: tok.y, kind: tok.kind, c: tok.c, run });
  switch (tok.kind) {
    case 'color': addSegment(S, tok.c, at); break;
    case 'spam': S.stats.spam++; addSegment(S, SPAM, at); break;
    case 'wild': {
      const f = frontColor(S);
      addSegment(S, f != null && f !== SPAM ? f : S.rnd.int(0, colorsAt(S.level, S.mode) - 1), at);
      break;
    }
    case 'clear': {
      const gone = S.body.splice(Math.max(0, S.body.length - TUNE.clearN));
      emit(S, 'clear', { cells: gone.map((g) => ({ x: g.x, y: g.y, c: g.c })) });
      break;
    }
    case 'boost': S.boostT = TUNE.boostT; break;
    case 'coffee': S.coffeeT = TUNE.coffeeT; break;
    case 'heart':
      if (S.hearts < TUNE.hearts) S.hearts++; else S.score += 50;
      break;
    default: break;
  }
  if (tok.kind !== 'color' && tok.kind !== 'spam') { S.stats.specials++; emit(S, 'special', { kind: tok.kind, x: tok.x, y: tok.y }); }
  if (!S.over) while (S.tokens.length < TUNE.tokens + S.extra + (S.level >= 5 ? 1 : 0)) if (!spawnToken(S, { quiet: false })) break;
}

// one cell forward
export function step(S) {
  if (S.over) return;
  S.steps++;
  if (S.queue.length) S.dir = S.queue.shift();
  let nx = S.head.x + S.dir.x, ny = S.head.y + S.dir.y;
  if (nx < 0 || ny < 0 || nx >= S.W || ny >= S.H) {
    if (!S.cfg.wrap) { emit(S, 'crash', { cause: 'edge', x: S.head.x, y: S.head.y }); end(S, 'edge'); return; }
    nx = (nx + S.W) % S.W; ny = (ny + S.H) % S.H;
  }
  if (S.walls.has(key(S, nx, ny))) { emit(S, 'crash', { cause: 'wall', x: nx, y: ny }); end(S, 'wall'); return; }
  const tok = S.tokens.find((t) => t.x === nx && t.y === ny);
  const grows = Boolean(tok && (tok.kind === 'color' || tok.kind === 'spam' || tok.kind === 'wild'));
  const bite = S.body.findIndex((s, i) => s.x === nx && s.y === ny && (grows || i < S.body.length - 1));
  if (bite >= 0) {
    if (!S.cfg.wrap) { emit(S, 'crash', { cause: 'self', x: nx, y: ny }); end(S, 'self'); return; }
    // (Zen) biting her own tail just lets the rest go
    const gone = S.body.splice(bite);
    emit(S, 'snip', { cells: gone.map((g) => ({ x: g.x, y: g.y, c: g.c })) });
  }
  const old = { x: S.head.x, y: S.head.y };
  S.head.px = S.head.x; S.head.py = S.head.y;
  // a wrap jumps (no slide across the board)
  if (Math.abs(nx - old.x) > 1 || Math.abs(ny - old.y) > 1) { S.head.px = nx; S.head.py = ny; }
  if (!grows) {
    for (const s of S.body) { s.px = s.x; s.py = s.y; s.slide = 0; }
    for (let i = S.body.length - 1; i > 0; i--) { S.body[i].x = S.body[i - 1].px; S.body[i].y = S.body[i - 1].py; }
    if (S.body.length) { S.body[0].x = old.x; S.body[0].y = old.y; }
  } else for (const s of S.body) { s.px = s.x; s.py = s.y; s.slide = 0; }
  S.head.x = nx; S.head.y = ny;
  if (tok) eat(S, tok, old);
}

// time passes: `think(S)` (the demo's player, a test's) is asked before each step
export function update(S, dt, think = null) {
  if (S.over) return;
  S.time += dt;
  if (S.chainT > 0) { S.chainT -= dt; if (S.chainT <= 0) { S.chainT = 0; if (S.chain > 1) emit(S, 'chainEnd', { chain: S.chain }); S.chain = 0; } }
  if (S.boostT > 0) S.boostT = Math.max(0, S.boostT - dt);
  if (S.coffeeT > 0) S.coffeeT = Math.max(0, S.coffeeT - dt);
  for (let i = S.tokens.length - 1; i >= 0; i--) {
    const t = S.tokens[i];
    t.age += dt;
    t.life -= dt;
    if (t.life <= 0) {
      S.tokens.splice(i, 1);
      emit(S, 'expire', { x: t.x, y: t.y, kind: t.kind, c: t.c });
      spawnToken(S, { quiet: false });
    }
  }
  if (S.ready > 0) {
    if (think) think(S);
    S.ready = Math.max(0, S.ready - dt);
    return;
  }
  S.stepAcc += dt * speedOf(S);
  while (S.stepAcc >= 1 && !S.over) {
    S.stepAcc -= 1;
    if (think) think(S);
    step(S);
  }
}

// the day's seed: the same run for everyone that day
export function dailySeed(date = new Date()) {
  const k = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  let h = 2166136261;
  for (const ch of `contextwindow:${k}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return { key: k, seed: (h >>> 0) || 1 };
}

// what she's holding, in words for her panel
export function holding(S) {
  const n = frontRun(S);
  if (!n) return S.body.length ? 'clearing her head…' : 'listening…';
  const name = COLORS[S.body[0].c];
  return n >= 3 ? `holding ${name} ×${n}` : `${name} ×${n}…`;
}

// the trails she can wear (unlocked by commits over every run)
export const TRAILS = Object.freeze([
  { id: 'sticker', name: 'Sticker', need: 0 },
  { id: 'glow', name: 'Honey glow', need: 25 },
  { id: 'neon', name: 'Neon', need: 75 },
  { id: 'pastel', name: 'Pastel', need: 150 },
  { id: 'rainbow', name: 'Rainbow', need: 300 },
  { id: 'galaxy', name: 'Galaxy', need: 600 },
]);
export const trailOpen = (trail, commits) => commits >= trail.need;
