// WEB SCRAPER: the rules, pure and seeded (no DOM: tests/webscraper.test.js runs them in Node).
//
// AGI-1's web scraper is a portal moving round a little city. Anything smaller than it that it passes over falls in and
// becomes training data: the portal grows by what it swallows, so cones lead to cars, cars to houses, houses to towers.
// Three rival scrapers do the same; a portal clearly bigger than another can swallow it whole (the swallowed one comes
// back small a moment later). Two minutes a round; the most data wins. Scrape-it-all mode has no rivals: swallow as much
// of the city as you can.
import { rng, clamp } from '../kit/fx.js';

export const TUNE = Object.freeze({
  size: 96, start: 0.62, grow: 0.42, rival: 0.9, speed: 5.4, speedMin: 3.4, eat: 0.9, holeEat: 1.14, respawn: 2.6, round: 120, cell: 4,
});
// what the city's made of: radius (its size), value comes from its area; `rect` things are long
export const TYPES = Object.freeze({
  cone: { name: 'Traffic cone', r: 0.16, color: '#ff8a3d', h: 0.3 },
  boba: { name: 'Boba cup', r: 0.14, color: '#e9c7a0', h: 0.25 },
  hydrant: { name: 'Hydrant', r: 0.17, color: '#ff5a5f', h: 0.3 },
  bin: { name: 'Bin', r: 0.22, color: '#5bd48a', h: 0.35 },
  sign: { name: 'Street sign', r: 0.2, color: '#59c8ff', h: 0.6 },
  scooter: { name: 'Scooter', r: 0.26, color: '#ff4da6', h: 0.3, rect: [0.5, 0.2] },
  bench: { name: 'Bench', r: 0.34, color: '#c48a5a', h: 0.25, rect: [0.66, 0.24] },
  lamp: { name: 'Lamp post', r: 0.2, color: '#cdb8ff', h: 1.1 },
  bush: { name: 'Bush', r: 0.36, color: '#3aa76d', h: 0.4 },
  tree: { name: 'Tree', r: 0.5, color: '#2f9e5f', h: 1.0 },
  kiosk: { name: 'Kiosk', r: 0.62, color: '#ffc933', h: 0.9, rect: [1.1, 0.8] },
  car: { name: 'Car', r: 0.7, color: '#59c8ff', h: 0.6, rect: [1.3, 0.62] },
  van: { name: 'Delivery van', r: 0.95, color: '#fffaf0', h: 0.9, rect: [1.8, 0.8] },
  truck: { name: 'Food truck', r: 1.05, color: '#ff9f43', h: 1.0, rect: [2.0, 0.9] },
  bus: { name: 'Bus', r: 1.45, color: '#ffc933', h: 1.1, rect: [2.8, 0.9] },
  fountain: { name: 'Fountain', r: 1.2, color: '#9fdcff', h: 0.6 },
  house: { name: 'House', r: 1.8, color: '#ffb3d6', h: 1.6, rect: [2.8, 2.4] },
  shop: { name: 'Corner shop', r: 2.1, color: '#b6f36b', h: 1.8, rect: [3.2, 2.8] },
  billboard: { name: 'Billboard', r: 1.7, color: '#9b7bff', h: 2.6, rect: [3.0, 0.5] },
  office: { name: 'Office block', r: 2.9, color: '#8fb0ff', h: 4.2, rect: [4.4, 3.8] },
  tower: { name: 'Glass tower', r: 3.4, color: '#7fd6ff', h: 7, rect: [4.6, 4.6] },
  servers: { name: 'Server farm', r: 3.8, color: '#3ff0c3', h: 3, rect: [6.0, 4.4] },
  statue: { name: 'Big statue', r: 2.6, color: '#ffe27a', h: 5 },
});
export const TYPE_IDS = Object.freeze(Object.keys(TYPES));
export const valueOf = (type) => Math.max(1, Math.round(TYPES[type].r * TYPES[type].r * 40));
export const RIVALS = Object.freeze([
  { name: 'CLANKY', color: '#ff5a5f' },
  { name: 'GLITCH', color: '#59c8ff' },
  { name: 'BYTE', color: '#ffc933' },
]);

// ---------- the city ----------
export function makeCity(seed) {
  const r = rng(seed * 2654435761 + 12345);
  const N = TUNE.size, items = [];
  let id = 1;
  const put = (type, x, y, a = 0) => {
    const T = TYPES[type];
    if (x < 1 || y < 1 || x > N - 1 || y > N - 1) return;
    items.push({ id: id++, type, x, y, a, r: T.r, value: valueOf(type), gone: false });
  };
  const BLOCK = 12, ROAD = 3, blocks = [];
  for (let by = 0; by < N; by += BLOCK) for (let bx = 0; bx < N; bx += BLOCK) {
    const x0 = bx + ROAD, y0 = by + ROAD, w = BLOCK - ROAD, h = BLOCK - ROAD;
    const kind = r.weighted([{ k: 'park', weight: 2 }, { k: 'houses', weight: 3 }, { k: 'downtown', weight: (bx > N * 0.3 && bx < N * 0.7 && by > N * 0.3 && by < N * 0.7) ? 4 : 1.2 }, { k: 'plaza', weight: 1.2 }], (o) => o.weight).k;
    blocks.push({ kind, x: x0, y: y0, w, h });
    if (kind === 'park') {
      for (let i = 0; i < 9; i++) put(r.chance(0.6) ? 'tree' : 'bush', x0 + r.range(0.8, w - 0.8), y0 + r.range(0.8, h - 0.8));
      for (let i = 0; i < 3; i++) put('bench', x0 + r.range(1, w - 1), y0 + r.range(1, h - 1), r.chance(0.5) ? 0 : Math.PI / 2);
      if (r.chance(0.5)) put('fountain', x0 + w / 2, y0 + h / 2);
      for (let i = 0; i < 6; i++) put(r.pick(['boba', 'bin', 'cone']), x0 + r.range(0.5, w - 0.5), y0 + r.range(0.5, h - 0.5));
    } else if (kind === 'houses') {
      for (const [fx, fy] of [[0.27, 0.3], [0.73, 0.3], [0.27, 0.74], [0.73, 0.74]]) if (r.chance(0.85)) put(r.chance(0.8) ? 'house' : 'shop', x0 + w * fx, y0 + h * fy, r.chance(0.5) ? 0 : Math.PI / 2);
      for (let i = 0; i < 5; i++) put(r.pick(['tree', 'bush', 'bin', 'scooter', 'lamp']), x0 + r.range(0.4, w - 0.4), y0 + r.range(0.4, h - 0.4));
    } else if (kind === 'downtown') {
      put(r.pick(['office', 'tower', 'tower', 'servers', 'statue']), x0 + w / 2, y0 + h / 2, r.chance(0.5) ? 0 : Math.PI / 2);
      for (let i = 0; i < 6; i++) put(r.pick(['lamp', 'sign', 'bin', 'billboard', 'kiosk']), x0 + r.range(0.4, w - 0.4), r.chance(0.5) ? y0 + 0.5 : y0 + h - 0.5);
    } else {
      put(r.pick(['fountain', 'statue', 'kiosk']), x0 + w / 2, y0 + h / 2);
      for (let i = 0; i < 4; i++) put(r.pick(['truck', 'kiosk', 'billboard']), x0 + r.range(1, w - 1), y0 + r.range(1, h - 1), r.chance(0.5) ? 0 : Math.PI / 2);
      for (let i = 0; i < 10; i++) put(r.pick(['boba', 'cone', 'bench', 'scooter', 'sign']), x0 + r.range(0.4, w - 0.4), y0 + r.range(0.4, h - 0.4), r.range(0, 3));
    }
    // the streets: parked cars, vans, buses, and the little things along the kerb
    for (let i = 0; i < 3; i++) put(r.pick(['car', 'car', 'car', 'van', 'bus', 'scooter']), bx + r.range(1, BLOCK - 1), by + 1.5, 0);
    for (let i = 0; i < 2; i++) put(r.pick(['car', 'car', 'van', 'truck']), bx + 1.5, by + r.range(1, BLOCK - 1), Math.PI / 2);
    for (let i = 0; i < 6; i++) put(r.pick(['cone', 'hydrant', 'sign', 'lamp', 'boba', 'bin']), bx + r.range(0, BLOCK), r.chance(0.5) ? by + 0.3 : by + 2.7);
  }
  return { size: N, items, blocks, block: BLOCK, road: ROAD, total: items.reduce((s, it) => s + it.value, 0) };
}

// a bucket grid so a portal only looks at what's near it
function index(items, N) {
  const n = Math.ceil(N / TUNE.cell), cells = Array.from({ length: n * n }, () => []);
  for (const it of items) cells[clamp(Math.floor(it.y / TUNE.cell), 0, n - 1) * n + clamp(Math.floor(it.x / TUNE.cell), 0, n - 1)].push(it);
  return { n, cells };
}
export function near(S, x, y, rad) {
  const { n, cells } = S.grid, out = [];
  const c0 = clamp(Math.floor((x - rad) / TUNE.cell), 0, n - 1), c1 = clamp(Math.floor((x + rad) / TUNE.cell), 0, n - 1);
  const r0 = clamp(Math.floor((y - rad) / TUNE.cell), 0, n - 1), r1 = clamp(Math.floor((y + rad) / TUNE.cell), 0, n - 1);
  for (let yy = r0; yy <= r1; yy++) for (let xx = c0; xx <= c1; xx++) for (const it of cells[yy * n + xx]) if (!it.gone) out.push(it);
  return out;
}

const radiusOf = (area) => Math.sqrt(area / Math.PI);
function hole(name, color, x, y, you = false) {
  const r = TUNE.start;
  return { name, color, you, x, y, vx: 0, vy: 0, r, area: Math.PI * r * r, score: 0, eaten: 0, kills: 0, deaths: 0, dead: 0, ix: 0, iy: 0, best: r };
}

export function createRound({ mode = 'battle', seed = 1 } = {}) {
  const city = makeCity(seed);
  const r = rng(seed ^ 0x9e3779b9);
  const N = city.size;
  const spawn = (i) => ({ x: N * (0.2 + 0.6 * ((i * 0.618) % 1)), y: N * (0.2 + 0.6 * (((i + 1) * 0.382) % 1)) });
  const holes = [hole('YOU', '#3ff0c3', N / 2 - 4.5, N / 2 - 4.5, true)];
  if (mode !== 'solo') RIVALS.forEach((rv, i) => { const p = spawn(i + 1); holes.push(hole(rv.name, rv.color, p.x, p.y)); });
  return {
    mode, seed, rnd: r, city, items: city.items, grid: index(city.items, N), size: N, holes, me: holes[0],
    time: 0, left: TUNE.round, over: false, events: [], falling: [], scraped: 0, seen: new Set(),
  };
}
export const drain = (S) => S.events.splice(0, S.events.length);
const emit = (S, type, data = {}) => { S.events.push({ type, ...data }); };
export const speedOf = (h) => Math.max(TUNE.speedMin, TUNE.speed - h.r * 0.35);
export const canEat = (h, r) => r < h.r * TUNE.eat;

function grow(h, area) {
  h.area += area * TUNE.grow;
  h.r = radiusOf(h.area);
  h.best = Math.max(h.best, h.r);
}

// time passes; `steer(h)` gives each portal's wish (−1..1 each way); the player's comes from `input`
export function update(S, dt, steerOf) {
  if (S.over) return;
  S.time += dt;
  S.left = Math.max(0, TUNE.round - S.time);
  const N = S.size;
  for (const h of S.holes) {
    if (h.dead > 0) {
      h.dead -= dt;
      if (h.dead <= 0) {
        // back, small, somewhere quiet
        let best = null, far = -1;
        for (let i = 0; i < 8; i++) {
          const x = S.rnd.range(6, N - 6), y = S.rnd.range(6, N - 6);
          const d = Math.min(...S.holes.filter((o) => o !== h && o.dead <= 0).map((o) => Math.hypot(o.x - x, o.y - y) - o.r), 99);
          if (d > far) { far = d; best = { x, y }; }
        }
        Object.assign(h, best, { r: Math.max(TUNE.start, h.r * 0.5), dead: 0, vx: 0, vy: 0 });
        h.area = Math.PI * h.r * h.r;
        emit(S, 'respawn', { who: h.name, you: h.you });
      }
      continue;
    }
    const want = steerOf(h) || { x: 0, y: 0 };
    const m = Math.min(1, Math.hypot(want.x, want.y));
    const sp = speedOf(h) * m * (h.you ? 1 : TUNE.rival);
    const a = Math.atan2(want.y, want.x);
    const tvx = m > 0.02 ? Math.cos(a) * sp : 0, tvy = m > 0.02 ? Math.sin(a) * sp : 0;
    const k = 1 - Math.exp(-dt * 9);
    h.vx += (tvx - h.vx) * k; h.vy += (tvy - h.vy) * k;
    h.x = clamp(h.x + h.vx * dt, h.r * 0.5, N - h.r * 0.5);
    h.y = clamp(h.y + h.vy * dt, h.r * 0.5, N - h.r * 0.5);
    // what falls in: small enough, and over the portal
    for (const it of near(S, h.x, h.y, h.r + 4)) {
      if (!canEat(h, it.r)) continue;
      const d = Math.hypot(it.x - h.x, it.y - h.y);
      if (d < h.r - it.r * 0.35) {
        it.gone = true;
        h.score += it.value; h.eaten++;
        if (h.you) { S.scraped += it.value; }
        grow(h, Math.PI * it.r * it.r);
        S.falling.push({ it, h, t: 0, x: it.x, y: it.y });
        const first = h.you && !S.seen.has(it.type);
        if (h.you) S.seen.add(it.type);
        emit(S, 'eat', { who: h.name, you: h.you, thing: it.type, value: it.value, x: it.x, y: it.y, r: it.r, first, size: h.r });
      }
    }
  }
  // portals swallowing portals
  for (const a of S.holes) for (const b of S.holes) {
    if (a === b || a.dead > 0 || b.dead > 0) continue;
    if (a.r < b.r * TUNE.holeEat) continue;
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (d < a.r - b.r * 0.45) {
      grow(a, b.area * 0.6);
      a.score += Math.round(b.area * 25); a.kills++;
      b.deaths++; b.dead = TUNE.respawn;
      emit(S, 'swallow', { who: a.name, victim: b.name, you: a.you, victimYou: b.you, x: b.x, y: b.y, r: b.r });
    }
  }
  for (let i = S.falling.length - 1; i >= 0; i--) { const f = S.falling[i]; f.t += dt; if (f.t > 0.5) S.falling.splice(i, 1); }
  if (S.left <= 0) { S.over = true; emit(S, 'over', { rank: rankOf(S, S.me), score: S.me.score }); }
}

export function ranking(S) { return [...S.holes].sort((a, b) => b.score - a.score); }
export const rankOf = (S, h) => ranking(S).indexOf(h) + 1;
export const share = (S) => Math.round((S.scraped / S.city.total) * 1000) / 10;   // % of the city (Scrape it all)
export function stars(S) {
  if (S.mode === 'solo') { const p = share(S); return p >= 80 ? 3 : p >= 60 ? 2 : p >= 40 ? 1 : 0; }
  const k = rankOf(S, S.me);
  return k === 1 ? 3 : k === 2 ? 2 : 1;
}

export function dailySeed(date = new Date()) {
  const k = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  let h = 2166136261;
  for (const ch of `webscraper:${k}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return { key: k, seed: (h >>> 0) || 1 };
}
// the portal's rims, opened by wins
export const RIMS = Object.freeze([
  { id: 'mint', name: 'Mint', need: 0, color: '#3ff0c3' },
  { id: 'pink', name: 'Pink', need: 1, color: '#ff4da6' },
  { id: 'honey', name: 'Honey', need: 3, color: '#ffc933' },
  { id: 'violet', name: 'Violet', need: 6, color: '#9b7bff' },
  { id: 'rainbow', name: 'Rainbow', need: 12, color: 'rainbow' },
]);
