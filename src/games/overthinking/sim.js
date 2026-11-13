// OVERTHINKING: the rules. Her mind is a field (its area always the same, its shape the screen's); thoughts drift in it,
// each kind in its own way; your pen leaves a ribbon of light that fades after a few seconds. Lift the pen and the
// ribbon closes with a straight line; cross your own ribbon and it closes at once and keeps going. A loop that holds
// thoughts of one kind resolves them; a mixed one scatters them. Her context fills as she keeps thinking, and four
// seconds over the top she spirals.
//
// Pure and seeded (no DOM, no clock, its own dice): the same seed and the same pen give the same night
// (tests/overthinking.test.js; the demo's player is ./ai.js). Lengths are in thought radii; time in seconds.
//
//   const S = createSim(makeConfig({ mode: 'night', night: 1 }), seed, aspect);
//   penDown(S, x, y) · penMove(S, x, y) · penUp(S)        the player (or the demo's player)
//   step(S, STEP)                                          once per tick
//   drain(S) → [{ type: 'capture' | 'mixed' | 'cut' | 'hour' | … }]   what happened since the last call
import { KINDS, SPECIALS, isKind, specOf } from './kinds.js';
import { segCross, pointInPoly, polyArea, polyCentroid, nearOnSeg, pathLength, clamp } from './geom.js';

export const STEP = 1 / 60;
const TAU = Math.PI * 2;

export const TUNE = Object.freeze({
  area: 480,            // the field's area (a thought's radius is 1): the same crowd on a phone and a monitor
  tall: 0.5, wide: 3,   // its shape, width over height: from a tall phone to a phone held sideways
  overT: 4,             // seconds over her context before she spirals
  life: 3,              // how long the ribbon lasts
  lenK: 2.6,            // its longest, in the field's shorter side
  minSeg: 0.3,          // the pen moves this far before the ribbon grows
  closeLen: 6,          // lifting closes a ribbon at least this long…
  chordK: 0.55,         // …whose ends are this close (as a part of its length): most of the way round
  minArea: 1.5,         // a loop smaller than this holds nothing
  born: 0.7,            // seconds a new thought takes to arrive
  settle: 0.3,          // and how long after that before a loop can hold it
  margin: 1.3,          // thoughts keep this far from the edge
  trainT: 7,            // seconds before her train of thought slows a notch
  trainStep: 3,         // loops in a row for each ×1 of the train
  trainMax: 5,
  flourishMax: 3,       // loops in one stroke: ×1, ×1.5, ×2, ×2.5, ×3
  slowT: 5, slowK: 0.35,
  teaT: 6, zoomT: 6,
  startleT: 1.3,
  emptyMin: 8,          // thoughts resolved since the last empty mind for it to count
});
const HELPERS = new Set(['eureka', 'breath', 'tea']);
const LIMITS = { cringe: 3, whatif: 3, phone: 1, eureka: 1, breath: 1, tea: 1 };

// dice that repeat (mulberry32)
export function dice(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// the field for a screen's shape (width / height): always the same area
export function worldSize(aspect) {
  const a = clamp(Number.isFinite(aspect) && aspect > 0 ? aspect : 1, TUNE.tall, TUNE.wide);
  const H = Math.sqrt(TUNE.area / a);
  return { W: a * H, H };
}

export function createSim(cfg, seed = 1, aspect = 0.7) {
  const { W, H } = worldSize(aspect);
  const S = {
    cfg, seed: seed >>> 0, rnd: dice(seed), W, H,
    t: 0,                     // the pen's time: never slowed
    clock: 0,                 // her night's time: a deep breath slows it
    hour: -1, now: null,
    thoughts: [], nextId: 1,
    origin: { x: W / 2, y: H + 2.4 },      // where new thoughts come from: her head, under the field
    pen: { down: false, x: W / 2, y: H / 2, pts: [], loops: 0 },
    score: 0, train: 0, trainT: 0,
    slow: 0, tea: 0, zoom: 0, hold: 0,
    danger: 0, full: false,
    acc: 0, timers: {}, queue: [],
    over: null, sinceEmpty: 0, loopsClosed: 0,
    stats: { loops: 0, sorted: 0, biggest: 0, train: 0, mixed: 0, cuts: 0, empties: 0, flourish: 0, dismissed: 0, wilds: 0, peak: 0, fullT: 0, byKind: {} },
    out: [],
  };
  enterHour(S, 0);
  // she starts with a few thoughts already, each kind in its own corner
  const kinds = S.now.kinds;
  const spots = [[0.27, 0.27], [0.72, 0.4], [0.36, 0.72], [0.74, 0.76], [0.5, 0.52]];
  (cfg.initial || [3, 3, 3]).forEach((n, i) => {
    const kind = kinds[i % kinds.length], [fx, fy] = spots[i % spots.length];
    const cx = fx * W + (S.rnd() - 0.5) * 2, cy = fy * H + (S.rnd() - 0.5) * 2;
    for (let j = 0; j < n; j++) {
      const a = (j / n) * TAU + S.rnd(), d = n > 1 ? 1.35 + S.rnd() * 0.5 : 0;
      const x = inX(S, cx + Math.cos(a) * d), y = inY(S, cy + Math.sin(a) * d);
      add(S, kind, x, y, { born: 0.25 + 0.06 * (i * 3 + j), bx: x, by: y });
    }
  });
  return S;
}

const inX = (S, x, r = 1) => clamp(x, TUNE.margin + (r - 1), S.W - TUNE.margin - (r - 1));
const inY = (S, y, r = 1) => clamp(y, TUNE.margin + (r - 1), S.H - TUNE.margin - (r - 1));
const emit = (S, e) => { S.out.push(e); };
export function drain(S) { const out = S.out; S.out = []; return out; }

// how many thoughts her context holds right now (the good ones don't weigh on her)
export function count(S) {
  let n = 0;
  for (const t of S.thoughts) if (!HELPERS.has(t.kind)) n++;
  return n;
}
export const fill = (S) => count(S) / S.cfg.cap;
// the ribbon's longest, in this field
export const maxRibbon = (S) => TUNE.lenK * Math.min(S.W, S.H);

function add(S, kind, x, y, o = {}) {
  const sp = specOf(kind);
  const born = Math.max(0.01, o.born ?? TUNE.born);
  const t = {
    id: S.nextId++, kind, r: sp.r || 1,
    x: o.bx ?? S.origin.x, y: o.by ?? S.origin.y, px: 0, py: 0, vx: 0, vy: 0,
    tx: x, ty: y, bx: o.bx ?? S.origin.x, by: o.by ?? S.origin.y,
    born, born0: born,
    hd: o.hd ?? S.rnd() * TAU, ph: S.rnd() * TAU, age: 0,
    startle: 0, lead: o.lead || 0,
    fuse: sp.fuse || 0, life: sp.life || 0, every: sp.every || 0, left: sp.battery || 0,
  };
  t.px = t.x; t.py = t.y;
  if (sp.every) t.every = sp.every * 0.6;
  S.thoughts.push(t);
  return t;
}

// a thought put straight into the field, already arrived (the tests' and the tools' way to set a scene)
export function spawn(S, kind, x, y, o = {}) {
  const t = add(S, kind, x, y, { ...o, born: 0.01, bx: x, by: y });
  t.born = 0; t.x = t.px = x; t.y = t.py = y; t.age = 1;
  return t;
}

// is this place inside the loop being drawn right now (the ribbon, closed by a straight line)?
const inLoop = (S, x, y) => S.pen.down && S.pen.pts.length >= 6 && pointInPoly(x, y, S.pen.pts);

// a place with some room: the best of a few tries (far from the others and from the pen, never inside the loop
// being drawn: a thought that pops up in the middle of your loop would be no fair)
function freeSpot(S, r = 1) {
  let best = null, bestD = -Infinity;
  for (let i = 0; i < 10; i++) {
    const x = inX(S, S.rnd() * S.W, r), y = inY(S, S.rnd() * S.H, r);
    let d = 6;
    for (const t of S.thoughts) d = Math.min(d, Math.hypot(t.tx - x, t.ty - y) - t.r);
    if (S.pen.down) d = Math.min(d, Math.hypot(S.pen.x - x, S.pen.y - y) - 2);
    if (inLoop(S, x, y)) d -= 100;
    if (d > bestD) { bestD = d; best = { x, y }; }
    if (d >= 3.2) break;
  }
  return best;
}

// one, two or three new thoughts of a kind, together; sometimes right beside a thought of their kind
function spawnGroup(S) {
  const kinds = S.now.kinds;
  const kind = kinds[Math.floor(S.rnd() * kinds.length)];
  const roll = S.rnd();
  const n = roll < 0.58 ? 1 : roll < 0.9 ? 2 : 3;
  let at = null;
  if (S.rnd() < S.now.join) {
    const mates = S.thoughts.filter((t) => t.kind === kind && t.born <= 0);
    if (mates.length) {
      const m = mates[Math.floor(S.rnd() * mates.length)], a = S.rnd() * TAU, d = 2.2 + S.rnd();
      at = { x: inX(S, m.x + Math.cos(a) * d), y: inY(S, m.y + Math.sin(a) * d) };
      if (inLoop(S, at.x, at.y)) at = null;
    }
  }
  if (!at) at = freeSpot(S, KINDS[kind].r);
  for (let i = 0; i < n; i++) {
    const a = S.rnd() * TAU, d = i ? 2.1 + S.rnd() * 0.4 : 0;
    add(S, kind, inX(S, at.x + Math.cos(a) * d, KINDS[kind].r), inY(S, at.y + Math.sin(a) * d, KINDS[kind].r), { born: TUNE.born + i * 0.12 });
  }
  return n;
}

function spawnSpecial(S, kind) {
  if (S.thoughts.filter((t) => t.kind === kind).length >= (LIMITS[kind] || 1)) return null;
  const sp = SPECIALS[kind];
  if (kind === 'cringe') {
    // it walks in from an edge and keeps going
    const side = Math.floor(S.rnd() * 4), k = S.rnd();
    const x = side === 0 ? 0.4 : side === 1 ? S.W - 0.4 : S.W * (0.15 + 0.7 * k);
    const y = side === 2 ? 0.4 : side === 3 ? S.H - 0.4 : S.H * (0.15 + 0.7 * k);
    const hd = Math.atan2(S.H / 2 - y + (S.rnd() - 0.5) * S.H * 0.5, S.W / 2 - x + (S.rnd() - 0.5) * S.W * 0.5);
    const t = add(S, kind, inX(S, x, sp.r), inY(S, y, sp.r), { born: 0.45, bx: x, by: y, hd });
    emit(S, { type: 'special', kind, id: t.id });
    return t;
  }
  const at = freeSpot(S, sp.r);
  const t = add(S, kind, at.x, at.y, HELPERS.has(kind) ? { born: 0.5, bx: at.x, by: at.y } : {});
  emit(S, { type: 'special', kind, id: t.id });
  return t;
}

// ---------- what happens on the hour ----------
function fire(S, type) {
  const { W, H, rnd } = S;
  const has = (k) => S.now.kinds.includes(k);
  const cluster = (kind, n, from) => {
    const at = freeSpot(S);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rnd(), d = 1.2 + rnd() * 1.3;
      add(S, kind, inX(S, at.x + Math.cos(a) * d), inY(S, at.y + Math.sin(a) * d), { born: 0.5 + i * 0.11, ...(from || {}) });
    }
  };
  if (type === 'ping') {
    // her phone lights up: thoughts about you, all at once, from the top corner
    cluster('heart', 6, { bx: rnd() < 0.5 ? 1 : W - 1, by: -1.5 });
  } else if (type === 'snack') {
    cluster(has('cookie') ? 'cookie' : S.now.kinds[0], 5);
  } else if (type === 'clarity') {
    spawnSpecial(S, 'eureka');
    S.tea = Math.max(S.tea, TUNE.teaT - 1);
  } else if (type === 'zoomies') {
    S.zoom = TUNE.zoomT;
    if (has('cat')) cluster('cat', 3);
  } else if (type === 'cringes') {
    spawnSpecial(S, 'cringe'); spawnSpecial(S, 'cringe');
  } else if (type === 'whatifs') {
    spawnSpecial(S, 'whatif'); spawnSpecial(S, 'whatif');
  } else if (type === 'song') {
    // an earworm: a line of notes dances in from one side, each following the one in front
    const kind = has('note') ? 'note' : S.now.kinds[0];
    const n = H < 17 ? 5 : 6, left = rnd() < 0.5;
    const x = left ? TUNE.margin + 0.4 : W - TUNE.margin - 0.4, y0 = H / 2 - ((n - 1) * 2.15) / 2;
    let lead = 0;
    for (let i = 0; i < n; i++) {
      const t = add(S, kind, x, inY(S, y0 + i * 2.15), { born: 0.4 + i * 0.16, bx: left ? -1.5 : W + 1.5, by: y0 + i * 2.15, lead, hd: left ? -0.5 : Math.PI + 0.5 });
      lead = t.id;
    }
  }
  emit(S, { type: 'event', name: type });
}

function enterHour(S, h) {
  S.hour = h;
  S.now = S.cfg.at(h);
  for (const e of S.cfg.events(h, S.rnd) || []) S.queue.push({ at: h * S.cfg.hourLen + e.at, type: e.type });
  S.queue.sort((a, b) => a.at - b.at);
  for (const [k, every] of Object.entries(S.now.special || {})) {
    if (!every) { delete S.timers[k]; continue; }
    if (!(S.timers[k] > 0)) S.timers[k] = every * (0.45 + 0.5 * S.rnd());
    else S.timers[k] = Math.min(S.timers[k], every * 1.3);
  }
  for (const k of Object.keys(S.timers)) if (!S.now.special?.[k]) delete S.timers[k];
  if (h > 0) {
    if (!S.cfg.zen) S.score += 100 * h;
    emit(S, { type: 'hour', hour: h, bonus: S.cfg.zen ? 0 : 100 * h });
  }
}

// ---------- the pen ----------
export function penDown(S, x, y) {
  if (S.over) return;
  const p = S.pen;
  p.down = true; p.loops = 0;
  p.x = clamp(x, 0, S.W); p.y = clamp(y, 0, S.H);
  p.pts = [{ x: p.x, y: p.y, t: S.t }];
}

export function penMove(S, x, y) {
  const p = S.pen;
  if (!p.down || S.over) return;
  x = clamp(x, 0, S.W); y = clamp(y, 0, S.H);
  const from = p.pts[p.pts.length - 1];
  const fx = from.x, fy = from.y, dx = x - fx, dy = y - fy, d = Math.hypot(dx, dy);
  p.x = x; p.y = y;
  if (d < TUNE.minSeg) return;
  const n = Math.ceil(d / 0.6);
  for (let i = 1; i <= n && p.down && !S.over; i++) if (grow(S, fx + (dx * i) / n, fy + (dy * i) / n)) break;
}

// the ribbon grows by a point: does the new piece cross the ribbon (a loop), or run into a cringe (a snap: true, and
// the rest of this move draws nothing)?
function grow(S, x, y) {
  const p = S.pen, pts = p.pts, a = pts[pts.length - 1];
  let hit = null, at = -1;
  for (let i = pts.length - 4; i >= 0; i--) {
    const c = segCross(a.x, a.y, x, y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
    if (c && (!hit || c.t < hit.t)) { hit = c; at = i; }
  }
  if (hit) {
    const poly = [{ x: hit.x, y: hit.y }];
    for (let i = at + 1; i < pts.length; i++) poly.push({ x: pts[i].x, y: pts[i].y });
    closeLoop(S, poly, 'cross');
    // the ribbon starts again where it crossed, and goes on
    p.pts = [{ x: hit.x, y: hit.y, t: S.t }];
    if (Math.hypot(x - hit.x, y - hit.y) > 0.05) p.pts.push({ x, y, t: S.t });
    return false;
  }
  pts.push({ x, y, t: S.t });
  for (const t of S.thoughts) {
    if (t.kind !== 'cringe' || t.born > 0) continue;
    if (nearOnSeg(t.x, t.y, a.x, a.y, x, y).d2 < (t.r * 0.85) ** 2) { snap(S, t); return true; }
  }
  return false;
}

function snap(S, cringe) {
  const p = S.pen;
  emit(S, { type: 'cut', x: cringe.x, y: cringe.y, pts: p.pts.map((q) => ({ x: q.x, y: q.y })), train: S.train });
  p.pts = [{ x: p.x, y: p.y, t: S.t }];
  p.loops = 0;
  S.train = 0; S.trainT = 0;
  S.stats.cuts++;
  cringe.life = Math.min(cringe.life, 5);
}

// lifting the pen closes the ribbon with a straight line, if it went most of the way round
export function closable(S) {
  const pts = S.pen.pts;
  if (!S.pen.down || pts.length < 6) return false;
  const len = pathLength(pts);
  if (len < TUNE.closeLen) return false;
  const a = pts[0], b = pts[pts.length - 1];
  if (Math.hypot(b.x - a.x, b.y - a.y) > TUNE.chordK * len) return false;
  return Math.abs(polyArea(pts)) >= TUNE.minArea;
}

export function penUp(S) {
  const p = S.pen;
  if (!p.down) return;
  if (!S.over && closable(S)) closeLoop(S, p.pts.map((q) => ({ x: q.x, y: q.y })), 'lift');
  else if (p.pts.length > 1) emit(S, { type: 'fade', pts: p.pts.map((q) => ({ x: q.x, y: q.y })) });
  p.down = false; p.pts = []; p.loops = 0;
}
// the pen taken away without closing anything (the game paused, the tab hidden)
export function penCancel(S) {
  const p = S.pen;
  if (p.down && p.pts.length > 1) emit(S, { type: 'fade', pts: p.pts.map((q) => ({ x: q.x, y: q.y })) });
  p.down = false; p.pts = []; p.loops = 0;
}

// what a loop holds, and what that makes it: 'empty' · 'pure' (one kind, with any wild ones) · 'dismiss' (only
// cringes: let them go) · 'mixed'
// (a thought that has only just arrived isn't in anybody's loop yet: it neither counts nor spoils it)
function inside(S, poly) {
  const list = [];
  for (const t of S.thoughts) if (t.born <= 0 && t.age >= TUNE.settle && pointInPoly(t.x, t.y, poly)) list.push(t);
  return list;
}
export function judge(list) {
  if (!list.length) return { verdict: 'empty', kind: null, n: 0 };
  const kinds = new Set();
  let cringes = 0;
  for (const t of list) {
    if (t.kind === 'cringe') cringes++;
    else if (isKind(t.kind)) kinds.add(t.kind);
  }
  if (cringes) return cringes === list.length ? { verdict: 'dismiss', kind: 'cringe', n: cringes } : { verdict: 'mixed', kind: null, n: list.length };
  if (kinds.size > 1) return { verdict: 'mixed', kind: null, n: list.length };
  return { verdict: 'pure', kind: kinds.size ? [...kinds][0] : list[0].kind, n: list.length };
}
// what lifting the pen right now would do: null (nothing to close), or { verdict, kind, n, ids }
export function preview(S) {
  if (!closable(S)) return null;
  const list = inside(S, S.pen.pts);
  return { ...judge(list), ids: list.map((t) => t.id) };
}

const snapOf = (t) => ({ id: t.id, kind: t.kind, x: t.x, y: t.y, r: t.r });

function closeLoop(S, poly, how) {
  if (Math.abs(polyArea(poly)) < TUNE.minArea) { emit(S, { type: 'fade', pts: poly }); return false; }
  const list = inside(S, poly);
  const j = judge(list);
  if (j.verdict === 'empty') { emit(S, { type: 'fade', pts: poly }); return false; }
  const c = polyCentroid(poly);
  if (j.verdict === 'mixed') {
    for (const t of list) {
      const dx = t.x - c.x, dy = t.y - c.y, d = Math.hypot(dx, dy) || 1;
      t.startle = TUNE.startleT;
      t.vx = (dx / d) * 6.5; t.vy = (dy / d) * 6.5;
      t.hd = Math.atan2(dy, dx);
    }
    emit(S, { type: 'mixed', poly, items: list.map(snapOf), cx: c.x, cy: c.y, train: S.train });
    S.train = 0; S.trainT = 0; S.pen.loops = 0;
    S.stats.mixed++;
    return false;
  }
  // resolved: they leave her mind
  const ids = new Set(list.map((t) => t.id));
  S.thoughts = S.thoughts.filter((t) => !ids.has(t.id));
  const n = list.length;
  const eureka = list.some((t) => t.kind === 'eureka');
  const dismiss = j.verdict === 'dismiss';
  const trainMul = Math.min(TUNE.trainMax, 1 + Math.floor(S.train / TUNE.trainStep));
  const flMul = Math.min(TUNE.flourishMax, 1 + 0.5 * S.pen.loops);
  const pts = Math.round((dismiss ? 100 * n : 10 * n * n) * (eureka ? 2 : 1) * trainMul * flMul);
  S.score += pts;
  S.train++; S.trainT = TUNE.trainT;
  S.pen.loops++; S.loopsClosed++;
  const helpers = [];
  for (const t of list) {
    const h = SPECIALS[t.kind]?.helper;
    if (h === 'breath') { S.slow = TUNE.slowT; helpers.push(h); }
    if (h === 'tea') { S.tea = TUNE.teaT; helpers.push(h); }
  }
  const st = S.stats;
  st.loops++; st.sorted += n;
  st.biggest = Math.max(st.biggest, n);
  st.train = Math.max(st.train, S.train);
  st.flourish = Math.max(st.flourish, S.pen.loops);
  if (dismiss) st.dismissed += n;
  for (const t of list) {
    if (isKind(t.kind)) st.byKind[t.kind] = (st.byKind[t.kind] || 0) + 1;
    else if (t.kind !== 'cringe') st.wilds++;
  }
  S.sinceEmpty += n;
  emit(S, {
    type: 'capture', kind: j.kind, n, pts, trainMul, flMul, loops: S.pen.loops, train: S.train, eureka, dismiss, how, helpers,
    poly, items: list.map(snapOf), cx: c.x, cy: c.y,
  });
  // nothing left on her mind at all
  if (count(S) === 0 && S.sinceEmpty >= TUNE.emptyMin && !S.cfg.zen) {
    const bonus = 50 * S.sinceEmpty;
    S.score += bonus; S.sinceEmpty = 0; S.hold = 2.2; st.empties++;
    emit(S, { type: 'empty', bonus, x: c.x, y: c.y });
  } else if (count(S) === 0) S.sinceEmpty = 0;
  return true;
}

// ---------- a tick ----------
export function step(S, dt = STEP) {
  if (S.over) return;
  const cfg = S.cfg, { W, H } = S;
  const wdt = dt * (S.slow > 0 ? TUNE.slowK : 1);
  S.t += dt;
  S.clock += wdt;

  // her clock: a new hour, the sunrise
  const h = Math.floor(S.clock / cfg.hourLen);
  if (h !== S.hour) {
    if (h >= cfg.hours) {
      const calm = Math.max(0, cfg.cap - count(S));
      const bonus = 1500 + 40 * calm;
      S.score += bonus;
      S.over = { cause: 'sunrise', won: true, bonus };
      penCancel(S);
      emit(S, { type: 'sunrise', bonus, calm });
      return;
    }
    enterHour(S, h);
    if ((h + Math.floor(cfg.startHour)) % 24 === 6) emit(S, { type: 'dawn' });
  }
  while (S.queue.length && S.queue[0].at <= S.clock) fire(S, S.queue.shift().type);

  // new thoughts: as fast as the hour says (Zen: only while there's room for more)
  if (S.hold > 0) S.hold -= wdt;
  else if (!cfg.zen || count(S) < (cfg.zenTarget || 16)) {
    S.acc += S.now.rate * wdt;
    while (S.acc >= 1) S.acc -= spawnGroup(S);
  }
  for (const k of Object.keys(S.timers)) {
    S.timers[k] -= wdt;
    if (S.timers[k] <= 0) { spawnSpecial(S, k); S.timers[k] = S.now.special[k] * (0.7 + 0.6 * S.rnd()); }
  }

  move(S, wdt);

  // the ribbon fades from its old end: by age, and when it's too long
  const p = S.pen, pts = p.pts;
  if (pts.length > 1) {
    let cut = 0;
    while (cut < pts.length - 1 && S.t - pts[cut].t > TUNE.life) cut++;
    let len = 0;
    for (let i = pts.length - 1; i > cut; i--) {
      len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      if (len > maxRibbon(S)) { cut = i; break; }
    }
    if (cut) pts.splice(0, cut);
  }
  // a cringe drifting into the ribbon snaps it
  if (p.down && pts.length > 1) {
    outer: for (const t of S.thoughts) {
      if (t.kind !== 'cringe' || t.born > 0) continue;
      const rr = (t.r * 0.85) ** 2;
      for (let i = 1; i < pts.length; i++) {
        if (nearOnSeg(t.x, t.y, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y).d2 < rr) { snap(S, t); break outer; }
      }
    }
  }

  // her train of thought slows a notch when nothing has resolved for a while
  if (S.train > 0) {
    S.trainT -= dt;
    if (S.trainT <= 0) {
      S.train = Math.max(0, S.train - TUNE.trainStep);
      S.trainT = S.train > 0 ? TUNE.trainT : 0;
      emit(S, { type: 'train', train: S.train });
    }
  }
  if (S.slow > 0) { S.slow -= dt; if (S.slow <= 0) { S.slow = 0; emit(S, { type: 'effect', name: 'breath', on: false }); } }
  if (S.tea > 0) { S.tea -= wdt; if (S.tea <= 0) { S.tea = 0; emit(S, { type: 'effect', name: 'tea', on: false }); } }
  if (S.zoom > 0) { S.zoom -= wdt; if (S.zoom <= 0) { S.zoom = 0; emit(S, { type: 'effect', name: 'zoomies', on: false }); } }

  // her context: over the top for too long and she spirals
  const n = count(S);
  S.stats.peak = Math.max(S.stats.peak, n);
  if (cfg.zen) return;
  const full = n >= cfg.cap;
  if (full !== S.full) { S.full = full; emit(S, { type: 'danger', on: full }); }
  if (full) {
    S.danger += dt; S.stats.fullT += dt;
    if (S.danger >= TUNE.overT) {
      S.over = { cause: 'overflow', won: false };
      penCancel(S);
      emit(S, { type: 'over', cause: 'overflow' });
    }
  } else if (S.danger > 0) S.danger = Math.max(0, S.danger - 1.5 * dt);
}

// every thought moves its own way
function move(S, dt) {
  const { W, H, pen, rnd } = S;
  const list = S.thoughts;
  const speedK = S.now.speed || 1;
  const gone = [];
  let cringes = null;
  for (const t of list) if (t.kind === 'cringe' && t.born <= 0) (cringes || (cringes = [])).push(t);

  for (const t of list) {
    t.px = t.x; t.py = t.y;
    // still arriving: from where it was born to its place
    if (t.born > 0) {
      t.born -= dt;
      const k = 1 - Math.max(0, t.born) / t.born0, e = 1 - (1 - k) ** 3;
      t.x = t.bx + (t.tx - t.bx) * e; t.y = t.by + (t.ty - t.by) * e;
      if (t.born <= 0) {
        const sp = specOf(t.kind);
        t.vx = Math.cos(t.hd) * sp.speed * 0.6; t.vy = Math.sin(t.hd) * sp.speed * 0.6;
        emit(S, { type: 'land', id: t.id, kind: t.kind, x: t.x, y: t.y });
      }
      continue;
    }
    t.age += dt;
    const sp = specOf(t.kind);

    if (t.kind === 'cringe') {
      // a straight line, off the walls, until it has had enough
      const v = sp.speed * Math.min(1.5, speedK);
      t.vx = Math.cos(t.hd) * v; t.vy = Math.sin(t.hd) * v;
      t.x += t.vx * dt; t.y += t.vy * dt;
      if ((t.x < t.r && t.vx < 0) || (t.x > W - t.r && t.vx > 0)) t.hd = Math.PI - t.hd;
      if ((t.y < t.r && t.vy < 0) || (t.y > H - t.r && t.vy > 0)) t.hd = -t.hd;
      t.life -= dt;
      if (t.life <= 0) gone.push(t);
      continue;
    }
    if (t.kind === 'phone') {
      t.every -= dt;
      if (t.every <= 0) {
        t.every = sp.every;
        const kinds = S.now.kinds, kind = kinds[Math.floor(rnd() * kinds.length)];
        const a = rnd() * TAU, d = 2.4 + rnd() * 1.6;
        add(S, kind, inX(S, t.x + Math.cos(a) * d), inY(S, t.y + Math.sin(a) * d), { bx: t.x, by: t.y, born: 0.5 });
        emit(S, { type: 'buzz', id: t.id, x: t.x, y: t.y });
        if (--t.left <= 0) gone.push(t);
      }
      continue;
    }
    if (t.fuse > 0) {
      t.fuse -= dt;
      if (t.fuse <= 0) {
        // a what-if nobody answered: three more thoughts
        const kinds = S.now.kinds;
        for (let i = 0; i < (sp.splits || 3); i++) {
          const a = (i / 3) * TAU + rnd(), kind = kinds[Math.floor(rnd() * kinds.length)];
          add(S, kind, inX(S, t.x + Math.cos(a) * 2.3), inY(S, t.y + Math.sin(a) * 2.3), { bx: t.x, by: t.y, born: 0.45 });
        }
        emit(S, { type: 'split', x: t.x, y: t.y });
        gone.push(t);
        continue;
      }
    }
    if (t.life > 0) { t.life -= dt; if (t.life <= 0) { gone.push(t); continue; } }

    const kd = KINDS[t.kind];
    const zoomy = S.zoom > 0 && t.kind === 'cat';
    const startled = t.startle > 0;
    if (startled) t.startle -= dt;
    let base = sp.speed * speedK * (zoomy ? 2.7 : 1) * (startled ? 2.3 : 1);
    let ax = 0, ay = 0;

    // a note in a line follows the one in front of it
    let leader = null;
    if (t.lead) {
      for (const o of list) if (o.id === t.lead) { leader = o; break; }
      if (!leader || leader.kind !== t.kind) t.lead = 0;
    }
    if (leader && !startled) {
      const lv = Math.hypot(leader.vx, leader.vy) || 1;
      const gx = leader.x - (leader.vx / lv) * 2.15, gy = leader.y - (leader.vy / lv) * 2.15;
      ax += (gx - t.x) * 7 - t.vx * 2.4; ay += (gy - t.y) * 7 - t.vy * 2.4;
      t.hd = Math.atan2(leader.y - t.y, leader.x - t.x);
      base *= 1.6;
    } else {
      // its own wandering heading (an earworm sways; her cat with the zoomies can't hold a line)
      t.hd += (rnd() - 0.5) * 2 * (kd ? kd.turn : 1) * (zoomy ? 3 : 1) * dt * 3;
      const hd = kd?.wave ? t.hd + Math.sin(t.age * 2.3 + t.ph) * 0.95 : t.hd;
      ax += (Math.cos(hd) * base - t.vx) * 2.2; ay += (Math.sin(hd) * base - t.vy) * 2.2;
    }

    // its own kind pulls it in (a train of thought forms by itself); chamomile sorts everyone
    if (kd && !startled && !zoomy && !leader) {
      let sx = 0, sy = 0, m = 0;
      const tea = S.tea > 0;
      for (const o of list) {
        if (o === t || o.born > 0) continue;
        const dx = o.x - t.x, dy = o.y - t.y, d2 = dx * dx + dy * dy;
        if (o.kind === t.kind) { if (d2 < (tea ? 400 : 72)) { sx += o.x; sy += o.y; m++; } }
        else if (tea && d2 < 12.25 && isKind(o.kind)) { const d = Math.sqrt(d2) || 1; ax -= (dx / d) * 3 * (1 - d / 3.5); ay -= (dy / d) * 3 * (1 - d / 3.5); }
      }
      if (m) {
        const dx = sx / m - t.x, dy = sy / m - t.y, d = Math.hypot(dx, dy);
        if (d > 1.5) { const f = kd.flock * (tea ? 9 : 1); ax += (dx / d) * f; ay += (dy / d) * f; }
      }
    }
    // your pen: most thoughts back away from it, thoughts about you follow it
    if (pen.down && kd && kd.pen) {
      const dx = t.x - pen.x, dy = t.y - pen.y, d = Math.hypot(dx, dy) || 1;
      if (kd.pen < 0 && d < 3.6) { const f = -kd.pen * (1 - d / 3.6) * 2.2; ax += (dx / d) * f; ay += (dy / d) * f; }
      else if (kd.pen > 0 && d < 7.5 && d > 1.5) { ax -= (dx / d) * kd.pen; ay -= (dy / d) * kd.pen; }
    }
    // nobody likes a cringe nearby
    if (cringes) for (const c of cringes) {
      const dx = t.x - c.x, dy = t.y - c.y, d = Math.hypot(dx, dy) || 1;
      if (d < 3) { const f = 6 * (1 - d / 3); ax += (dx / d) * f; ay += (dy / d) * f; }
    }
    if (t.kind === 'moon') ay += 0.14;            // sleepy thoughts sink
    else if (t.kind === 'star') ay -= 0.09;       // bright ideas float
    // the edges of her mind: a soft push back in, and its heading turned around
    const m = TUNE.margin + (t.r - 1);
    if (t.x < m) { ax += (m - t.x) * 12; if (Math.cos(t.hd) < 0) t.hd = Math.PI - t.hd; }
    else if (t.x > W - m) { ax -= (t.x - (W - m)) * 12; if (Math.cos(t.hd) > 0) t.hd = Math.PI - t.hd; }
    if (t.y < m) { ay += (m - t.y) * 12; if (Math.sin(t.hd) < 0) t.hd = -t.hd; }
    else if (t.y > H - m) { ay -= (t.y - (H - m)) * 12; if (Math.sin(t.hd) > 0) t.hd = -t.hd; }

    t.vx += ax * dt; t.vy += ay * dt;
    const v = Math.hypot(t.vx, t.vy), vmax = base * 1.7 + (startled ? 5 : 2.5);
    if (v > vmax) { t.vx *= vmax / v; t.vy *= vmax / v; }
    t.x += t.vx * dt; t.y += t.vy * dt;
  }
  if (gone.length) {
    const ids = new Set(gone.map((t) => t.id));
    S.thoughts = S.thoughts.filter((t) => !ids.has(t.id));
    for (const t of gone) if (t.kind !== 'whatif') emit(S, { type: 'gone', kind: t.kind, x: t.x, y: t.y });
  }

  // thoughts don't sit on top of each other
  const all = S.thoughts;
  for (let i = 0; i < all.length; i++) {
    const a = all[i];
    if (a.born > 0 || a.kind === 'cringe') continue;
    for (let j = i + 1; j < all.length; j++) {
      const b = all[j];
      if (b.born > 0 || b.kind === 'cringe') continue;
      const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r - 0.04;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr) continue;
      const d = Math.sqrt(d2) || 0.001, push = (rr - d) / 2, nx = dx / d, ny = dy / d;
      const ka = a.kind === 'phone' ? 0 : b.kind === 'phone' ? 2 : 1, kb = 2 - ka;
      a.x -= nx * push * ka; a.y -= ny * push * ka;
      b.x += nx * push * kb; b.y += ny * push * kb;
      const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rel < 0) { a.vx += nx * rel * 0.5; a.vy += ny * rel * 0.5; b.vx -= nx * rel * 0.5; b.vy -= ny * rel * 0.5; }
    }
  }

  // the ribbon is a fence of light: thoughts can't drift across it
  const pts = pen.pts;
  if (pts.length > 1) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of pts) { if (q.x < x0) x0 = q.x; if (q.x > x1) x1 = q.x; if (q.y < y0) y0 = q.y; if (q.y > y1) y1 = q.y; }
    for (const t of all) {
      if (t.born > 0 || t.kind === 'cringe') continue;
      const pad = t.r + 0.14;
      if (t.x < x0 - pad || t.x > x1 + pad || t.y < y0 - pad || t.y > y1 + pad) continue;
      for (let i = 1; i < pts.length; i++) {
        const q = nearOnSeg(t.x, t.y, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
        if (q.d2 >= pad * pad) continue;
        const d = Math.sqrt(q.d2);
        let nx, ny;
        if (d > 1e-6) { nx = (t.x - q.x) / d; ny = (t.y - q.y) / d; }
        else { const sx = pts[i].x - pts[i - 1].x, sy = pts[i].y - pts[i - 1].y, sl = Math.hypot(sx, sy) || 1; nx = -sy / sl; ny = sx / sl; }
        t.x = q.x + nx * pad; t.y = q.y + ny * pad;
        const vn = t.vx * nx + t.vy * ny;
        if (vn < 0) { t.vx -= 1.5 * vn * nx; t.vy -= 1.5 * vn * ny; }
      }
    }
  }
  for (const t of all) {
    if (t.born > 0) continue;
    t.x = clamp(t.x, t.r * 0.9, W - t.r * 0.9); t.y = clamp(t.y, t.r * 0.9, H - t.r * 0.9);
  }
}

// the screen changed shape (a phone turned): the same thoughts in the new field
export function resize(S, aspect) {
  const { W, H } = worldSize(aspect);
  if (Math.abs(W - S.W) < 1e-6 && Math.abs(H - S.H) < 1e-6) return;
  const kx = W / S.W, ky = H / S.H;
  for (const t of S.thoughts) {
    for (const k of ['x', 'px', 'tx', 'bx']) t[k] *= kx;
    for (const k of ['y', 'py', 'ty', 'by']) t[k] *= ky;
  }
  for (const q of S.pen.pts) { q.x *= kx; q.y *= ky; }
  S.pen.x *= kx; S.pen.y *= ky;
  S.origin.x *= kx; S.origin.y *= ky;
  S.W = W; S.H = H;
}

// where new thoughts come from (her head), set by the page's layout
export function setOrigin(S, x, y) { S.origin.x = x; S.origin.y = y; }
