// TOO MANY TABS: the rules, pure and seeded (no DOM: tests/toomanytabs.test.js runs them in Node).
//
// AGI-1 has far too many tabs open. They're piled on her screen in layers; a tab is free when nothing on a higher layer
// overlaps it. Tap a free tab and it drops into her taskbar (7 slots), next to any of its kind; three of a kind close
// together. Seven in the taskbar with no three alike and her browser freezes. Three helpers a board: Undo, Shuffle and
// Tab out (three taskbar tabs parked on a shelf, tappable later). Closing triples in quick succession builds a streak.
//
// Every board is made by playing it backwards: a random order in which the tabs could come off the pile is drawn first,
// and the kinds are dealt along that order in small shuffled windows (at most three kinds at a time), so there is always
// a way through that never holds more than six tabs in the taskbar. The tests replay that order on every level.
import { rng } from '../kit/fx.js';

export const KINDS = Object.freeze([
  { id: 'cat', name: 'cat videos', color: '#ff7ab8' },
  { id: 'boba', name: 'boba menus', color: '#ffc933' },
  { id: 'music', name: 'lo-fi radio', color: '#9b7bff' },
  { id: 'heart', name: 'fan mail', color: '#ff5a5f' },
  { id: 'moon', name: 'sleep tips', color: '#59c8ff' },
  { id: 'bolt', name: 'GPU benchmarks', color: '#3ff0c3' },
  { id: 'mail', name: 'unread mail', color: '#cdb8ff' },
  { id: 'star', name: 'wishlists', color: '#ffe27a' },
  { id: 'leaf', name: 'plant care', color: '#5bd48a' },
  { id: 'ghost', name: 'haunted forums', color: '#f1ecff' },
  { id: 'pizza', name: 'late-night snacks', color: '#ff9f43' },
  { id: 'chat', name: 'group chats', color: '#ff4da6' },
  { id: 'camera', name: 'selfie edits', color: '#7fd6ff' },
  { id: 'game', name: 'speedruns', color: '#b6f36b' },
]);
export const TRAY = 7, SHELF = 6, GW = 7, GH = 8;
export const TUNE = Object.freeze({ comboWindow: 4, comboMax: 5, triple: 30, rushTime: 150, rushBonus: 40, parPerTab: 1.5 });
export const MODES = Object.freeze({ levels: 'levels', daily: 'daily', rush: 'rush' });

// how a level is built: tabs, kinds, layers, how many kinds are dealt at once
export function paramsFor(level) {
  const L = Math.max(1, level | 0);
  const triples = Math.min(55, 9 + Math.floor((L - 1) * 1.6));
  return {
    tiles: triples * 3,
    kinds: Math.min(KINDS.length, 3 + Math.ceil(L * 0.45)),
    layers: Math.min(9, 2 + Math.floor((L - 1) / 3)),
    window: L < 3 ? 1 : L < 10 ? 2 : 3,
  };
}

const overlaps = (a, b) => Math.abs(a.x - b.x) < 0.999 && Math.abs(a.y - b.y) < 0.999;
// a tab is free when no tab still on the pile above it overlaps it
export function isFree(S, t) {
  if (t.where !== 'board') return t.where === 'shelf';
  for (const u of S.tiles) if (u.where === 'board' && u.z > t.z && overlaps(u, t)) return false;
  return true;
}
export const boardTiles = (S) => S.tiles.filter((t) => t.where === 'board');
export const freeTiles = (S) => S.tiles.filter((t) => t.where === 'board' && isFree(S, t));

// the pile's shape: layers of tabs, each offset half a tab from the one under it, mirrored left to right, each smaller
// than the one under it; `dense` scales how full the layers are (tried until there are enough tabs)
function makeSlots(r, p, dense = 1) {
  const slots = [];
  const layers = Math.min(9, p.layers);
  for (let z = 0; z < layers; z++) {
    const o = z % 2 ? 0.5 : 0;
    const inset = Math.floor(z / 2) * 0.5;
    const fill = Math.min(0.95, (z === 0 ? 0.6 : Math.max(0.3, 0.66 - z * 0.05)) * dense);
    for (let y = o + inset; y <= GH - 1 - inset + 1e-9; y += 1) for (let x = o + inset; x <= (GW - 1) / 2 + 1e-9; x += 1) {
      if (!r.chance(fill)) continue;
      slots.push({ x, y, z });
      const mx = GW - 1 - x;
      if (Math.abs(mx - x) > 1e-9) slots.push({ x: mx, y, z });
    }
  }
  return slots;
}
function pileFor(r, p) {
  let slots = [];
  for (let dense = 0.7; dense < 3 && slots.length < p.tiles; dense += 0.12) slots = makeSlots(r, p, dense);
  // exactly `tiles`: a few taken away anywhere, a mirrored pair at a time where it can
  while (slots.length > p.tiles) slots.splice(r.int(0, slots.length - 1), 1);
  return slots;
}

// a way to take every tab off the pile, in order (always free at its turn)
function removalOrder(r, slots) {
  const left = slots.map((s, i) => ({ ...s, i, where: 'board' }));
  const S = { tiles: left };
  const order = [];
  while (order.length < slots.length) {
    const free = left.filter((t) => t.where === 'board' && isFree(S, t));
    // prefer the top of the pile a little, so the deal lines up with what a player sees
    free.sort((a, b) => b.z - a.z);
    const t = free[Math.min(free.length - 1, Math.floor(r.next() ** 1.6 * free.length))];
    t.where = 'gone';
    order.push(t.i);
  }
  return order;
}

export function createLevel({ level = 1, seed = 1, mode = 'levels' } = {}) {
  const r = rng((seed * 2654435761) ^ (level * 40503));
  const p = paramsFor(level);
  let slots = pileFor(r, p);
  const n = slots.length - (slots.length % 3);
  slots = slots.slice(0, n);
  const order = removalOrder(r, slots);
  const kinds = r.shuffle(KINDS.map((k, i) => i)).slice(0, p.kinds);
  const type = new Array(n);
  for (let at = 0; at < n;) {
    const w = Math.min(p.window, (n - at) / 3);
    const deal = [];
    for (let j = 0; j < w; j++) { const k = kinds[r.int(0, kinds.length - 1)]; deal.push(k, k, k); }
    r.shuffle(deal);
    for (let j = 0; j < deal.length; j++) type[order[at + j]] = deal[j];
    at += deal.length;
  }
  const tiles = slots.map((s, i) => ({ id: i + 1, x: s.x, y: s.y, z: s.z, kind: type[i], where: 'board' }));
  return {
    mode, level, seed, params: p, tiles, tray: [], shelf: [], solution: order.map((i) => i + 1),
    boosters: { undo: 1, shuffle: 1, out: 1 }, revived: false, history: [], pending: [],
    score: 0, combo: 0, comboT: 0, time: 0, closed: 0, over: false, won: false, cause: null, events: [], rnd: r,
  };
}

export const drain = (S) => S.events.splice(0, S.events.length);
const emit = (S, type, data = {}) => { S.events.push({ type, ...data }); };
const tile = (S, id) => S.tiles.find((t) => t.id === id);
const countIn = (S, kind) => S.tray.reduce((n, id) => n + (tile(S, id).kind === kind ? 1 : 0), 0);

// where a tab lands in the taskbar: right after the last one of its kind (or at the end)
function insertTray(S, t) {
  let at = S.tray.length;
  for (let i = S.tray.length - 1; i >= 0; i--) if (tile(S, S.tray[i]).kind === t.kind) { at = i + 1; break; }
  S.tray.splice(at, 0, t.id);
  return at;
}

// tap a tab: it goes to the taskbar (and is "pending" until `settle`, so the page can show it flying there)
export function pick(S, id) {
  if (S.over) return false;
  settle(S);
  const t = tile(S, id);
  if (!t || !isFree(S, t) || S.tray.length >= TRAY) return false;
  const from = t.where;
  if (from === 'shelf') S.shelf.splice(S.shelf.indexOf(id), 1);
  t.where = 'tray';
  const slot = insertTray(S, t);
  S.history.push({ id, from, x: t.x, y: t.y, z: t.z });
  S.pending.push(id);
  emit(S, 'pick', { id, kind: t.kind, from, slot, count: countIn(S, t.kind) });
  return true;
}

// the taskbar settles: three alike close, seven with none alike freeze it, an empty pile wins
export function settle(S) {
  if (!S.pending.length) return;
  S.pending.length = 0;
  for (const kind of new Set(S.tray.map((id) => tile(S, id).kind))) {
    const ids = S.tray.filter((id) => tile(S, id).kind === kind);
    if (ids.length < 3) continue;
    const three = ids.slice(0, 3);
    const slots = three.map((id) => S.tray.indexOf(id));
    S.tray = S.tray.filter((id) => !three.includes(id));
    for (const id of three) tile(S, id).where = 'gone';
    S.combo = S.comboT > 0 ? Math.min(TUNE.comboMax, S.combo + 1) : 1;
    S.comboT = TUNE.comboWindow;
    const pts = TUNE.triple * S.combo;
    S.score += pts;
    S.closed++;
    // an undo can't bring back a tab that closed
    S.history = S.history.filter((h) => !three.includes(h.id));
    emit(S, 'triple', { kind, ids: three, slots, pts, combo: S.combo });
  }
  if (!S.tiles.some((t) => t.where === 'board' || t.where === 'tray' || t.where === 'shelf')) {
    S.won = true; S.over = true;
    const par = parOf(S);
    const bonus = 100 + Math.max(0, Math.round((par - S.time) * 5));
    S.score += bonus;
    emit(S, 'clear', { bonus, stars: starsOf(S), time: S.time });
    return;
  }
  if (S.tray.length >= TRAY) { S.over = true; S.cause = 'full'; emit(S, 'full'); }
}

export const parOf = (S) => S.params.tiles * TUNE.parPerTab;
export function starsOf(S) {
  const par = parOf(S);
  return S.time <= par ? 3 : S.time <= par * 1.6 ? 2 : 1;
}

// ---------- helpers ----------
export function undo(S) {
  if (S.over || S.boosters.undo <= 0) return false;
  settle(S);
  const h = S.history.pop();
  if (!h) return false;
  const t = tile(S, h.id);
  if (t.where !== 'tray') return false;
  S.tray.splice(S.tray.indexOf(t.id), 1);
  if (h.from === 'shelf') { t.where = 'shelf'; S.shelf.push(t.id); } else { t.where = 'board'; }
  S.boosters.undo--;
  emit(S, 'undo', { id: t.id });
  return true;
}
// the pile's kinds dealt again (where they are stays; which kind is where changes)
export function shuffle(S) {
  if (S.over || S.boosters.shuffle <= 0) return false;
  settle(S);
  const on = boardTiles(S);
  if (on.length < 2) return false;
  const kinds = S.rnd.shuffle(on.map((t) => t.kind));
  on.forEach((t, i) => { t.kind = kinds[i]; });
  S.boosters.shuffle--;
  emit(S, 'shuffle', { ids: on.map((t) => t.id) });
  return true;
}
// three tabs out of the taskbar onto the shelf
export function tabOut(S, { free = false } = {}) {
  if (S.over && !free) return false;
  settle(S);
  if ((!free && S.boosters.out <= 0) || !S.tray.length || S.shelf.length + Math.min(3, S.tray.length) > SHELF) return false;
  const out = S.tray.splice(0, 3);
  for (const id of out) { tile(S, id).where = 'shelf'; S.shelf.push(id); }
  S.history = S.history.filter((h) => !out.includes(h.id));
  if (!free) S.boosters.out--;
  emit(S, 'out', { ids: out });
  return true;
}
// once a board: a frozen taskbar gets three tabs out and play goes on
export function revive(S) {
  if (!S.over || S.won || S.revived || S.cause !== 'full') return false;
  S.over = false; S.cause = null; S.revived = true;
  return tabOut(S, { free: true });
}

export function update(S, dt) {
  if (S.over) return;
  S.time += dt;
  if (S.comboT > 0) { S.comboT -= dt; if (S.comboT <= 0) { S.comboT = 0; S.combo = 0; } }
}

export function dailySeed(date = new Date()) {
  const k = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  let h = 2166136261;
  for (const ch of `toomanytabs:${k}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return { key: k, seed: (h >>> 0) || 1 };
}
// the daily board: a hard level, the same for everyone that day
export const DAILY_LEVEL = 16;
// Rush: boards one after another against the clock (each a little harder), from this level
export const rushLevel = (board) => 4 + board * 2;

// her wallpapers, opened by stars from the levels
export const WALLPAPERS = Object.freeze([
  { id: 'grid', name: 'Grid', need: 0 },
  { id: 'sunset', name: 'Sunset', need: 12 },
  { id: 'clouds', name: 'Clouds', need: 30 },
  { id: 'arcade', name: 'Arcade', need: 60 },
  { id: 'galaxy', name: 'Galaxy', need: 100 },
  { id: 'hearts', name: 'Hearts', need: 160 },
]);
