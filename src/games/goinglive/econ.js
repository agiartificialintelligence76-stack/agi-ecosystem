// GOING LIVE: her career, pure (no page, no clock of its own): followers, views (the game's points), her room, what each
// kind of stream draws, which kind is trending and which ones chat is tired of, what a stream brings, what her room
// earns while she's away, the awards and her place on the board. The page keeps a career in the browser (progress.js).
import { CATS, CAT_IDS, catOf, SLOTS, slotOf, ROOMS, roomOf, AWARDS, RIVALS, rankOf, TUNE } from './data.js';

export const hashOf = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

export function newCareer() {
  return {
    v: 1, followers: TUNE.start.followers, views: TUNE.start.views, streams: 0, room: 0,
    owned: Object.fromEntries(SLOTS.map((s) => [s.id, 0])),
    fresh: Object.fromEntries(CAT_IDS.map((id) => [id, 1])),
    clips: 0, clipRate: 0, peak: 0, bestCombo: 0, last: null,
    totals: { views: 0, followers: 0, viewers: 0, banned: 0, raids: 0, answered: 0, hearts: 0, clips: 0, fixed: 0, bigs: 0, byCat: {} },
  };
}

// what she can stream now
export const unlocked = (c) => CATS.filter((k) => c.followers >= k.unlock);
export const isOpen = (c, id) => Boolean(catOf(id)) && c.followers >= catOf(id).unlock;
export const nextUnlock = (c) => CATS.find((k) => c.followers < k.unlock) || null;
// what's trending: one of what she can stream, for TUNE.trend.every streams at a time (the same for the same career)
export function trendOf(c) {
  const open = unlocked(c), slot = Math.floor(c.streams / TUNE.trend.every);
  if (open.length < 2) return null;
  return open[hashOf(`trend:${slot}:${open.length}`) % open.length].id;
}
export const trendLeft = (c) => TUNE.trend.every - (c.streams % TUNE.trend.every);

// her room's points for a kind of stream, and what the kind draws (1 is a bare room's)
export function pointsFor(c, id) {
  let p = 0;
  for (const s of SLOTS) {
    const t = s.tiers[c.owned[s.id] || 0];
    p += t?.stats?.[id] || 0;
  }
  return p;
}
export const freshMult = (c, id) => TUNE.fresh.floor + (1 - TUNE.fresh.floor) * (c.fresh[id] ?? 1);
export function appeal(c, id, { trend = trendOf(c) } = {}) {
  const k = catOf(id);
  if (!k) return 0;
  return (1 + pointsFor(c, id) / TUNE.points) * roomOf(c).mult * k.base * freshMult(c, id) * (trend === id ? TUNE.trend.mult : 1);
}
// viewers at the start of a stream of it
export const reachOf = (f) => TUNE.base + TUNE.reach * Math.pow(Math.max(0, f), TUNE.reachPow ?? 0.92);
export const startViewers = (c, id) => reachOf(c.followers) * appeal(c, id);
// how busy a stream is (0 a new streamer … 1 the biggest): more chat, more bots, more raids
export const busyOf = (f) => Math.max(0, Math.min(1, (Math.log10(f + 10) - 1) / 6.5));

// ---------- her room ----------
export const tierOf = (c, slot) => slotOf(slot)?.tiers[c.owned[slot] || 0] || null;
export function nextTier(c, slot) { const s = slotOf(slot); const i = (c.owned[slot] || 0) + 1; return s && i < s.tiers.length ? s.tiers[i] : null; }
export const nextCost = (c, slot) => nextTier(c, slot)?.cost ?? null;
// upgrade a slot: what it cost, or null (the best already, or not enough views)
export function upgrade(c, slot) {
  const t = nextTier(c, slot);
  if (!t || c.views < t.cost) return null;
  c.views -= t.cost;
  c.owned[slot] = (c.owned[slot] || 0) + 1;
  return t;
}
export const fullRoom = (c) => SLOTS.every((s) => (c.owned[s.id] || 0) >= s.tiers.length - 1);
// moving up: the next room, once she has its followers; null in the last one
export const nextRoom = (c) => ROOMS[(c.room || 0) + 1] || null;
export const canMove = (c) => { const r = nextRoom(c); return Boolean(r) && c.followers >= r.at && c.views >= r.cost; };
export function moveRoom(c) {
  const r = nextRoom(c);
  if (!r || c.followers < r.at || c.views < r.cost) return null;
  c.views -= r.cost; c.room = (c.room || 0) + 1;
  return r;
}
// the upgrades that would help a kind of stream most for the views (for the page's tip and the game's own players)
export function bestUpgrades(c, id) {
  const list = [];
  for (const s of SLOTS) {
    const t = nextTier(c, s.id); if (!t) continue;
    const now = tierOf(c, s.id)?.stats?.[id] || 0, gain = (t.stats[id] || 0) - now;
    list.push({ slot: s.id, tier: t, gain, per: gain / Math.max(1, t.cost) });
  }
  return list.sort((a, b) => b.per - a.per);
}

// ---------- the room keeps earning ----------
export const idleRate = (c) => c.followers * TUNE.idle.perFollower * roomOf(c).mult + c.clipRate;
export function awayGain(c, seconds) {
  const away = Math.max(0, Number(seconds) || 0), counted = Math.min(away, TUNE.idle.cap);
  return { away, counted, capped: away > TUNE.idle.cap, views: idleRate(c) * counted * TUNE.idle.away };
}

// ---------- after a stream ----------
// `r` from stream.js's results: { cat, views, followers, peak, clips, clipViews, combo, stats }
export function applyStream(c, r) {
  const before = c.followers;
  c.streams++;
  c.followers += r.followers;
  c.views += r.views;
  c.peak = Math.max(c.peak, Math.round(r.peak));
  c.bestCombo = Math.max(c.bestCombo, r.combo || 0);
  c.clips += r.clips || 0;
  c.clipRate += (r.clipViews || 0) * TUNE.idle.clip;
  for (const id of CAT_IDS) c.fresh[id] = id === r.cat ? (c.fresh[id] ?? 1) * TUNE.fresh.use : Math.min(1, (c.fresh[id] ?? 1) + TUNE.fresh.back);
  const t = c.totals;
  t.views += r.views; t.followers += r.followers; t.viewers = Math.max(t.viewers, Math.round(r.peak));
  for (const k of ['banned', 'raids', 'answered', 'hearts', 'clips', 'fixed', 'bigs']) t[k] += r.stats?.[k] || 0;
  t.byCat[r.cat] = (t.byCat[r.cat] || 0) + 1;
  c.last = { cat: r.cat, peak: Math.round(r.peak), views: Math.round(r.views), followers: r.followers };
  return {
    awards: AWARDS.filter((a) => before < a.at && c.followers >= a.at),
    room: nextRoom(c) && before < nextRoom(c).at && c.followers >= nextRoom(c).at ? nextRoom(c) : null,
    opened: CATS.filter((k) => before < k.unlock && c.followers >= k.unlock),
    passed: RIVALS.filter((x) => before <= x.f && c.followers > x.f),
    rank: [rankOf(before), rankOf(c.followers)],
  };
}
export const awardsOf = (f) => AWARDS.filter((a) => f >= a.at);
export { roomOf, rankOf, ROOMS };
