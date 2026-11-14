// GOING LIVE: her career, pure (no page, no clock of its own: the page moves `c.clock` with `tick(c, dt)`). Followers,
// views (the game’s points), her level and idea points (💡), her room and what’s in it, deliveries, the videos she’s
// making, her video ideas and what’s trending, quests, the fan-mail drone and the spam bots, the live meter, her old
// videos earning while you’re away, the awards and her place on the board. Its own dice (`c.rng`): the same career and
// the same choices give the same results. What happened comes out of `drain(c)`.
import { TOPICS, topicOf, ITEMS, itemOf, pointsOf, HOMES, homeOf, perkOf, AWARDS, RIVALS, rankOf, SETS, BOXES, boxOf, RARITIES, TUNE } from './data.js';
import { TITLES } from './titles.js';
import { starterItems, place as roomPlace, spotsFor, layer, blockedGrid, deskSpot } from './room.js';

export const hashOf = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
// the career’s dice (mulberry32 on c.rng)
export function roll(c) {
  c.rng = (c.rng + 0x6d2b79f5) >>> 0;
  let t = c.rng; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const range = (c, a, b) => a + (b - a) * roll(c);
const emit = (c, type, data = {}) => { c.out.push({ type, ...data }); };
export const drain = (c) => { const o = c.out; c.out = []; return o; };

export function newCareer(seed = 1) {
  const c = {
    v: 3, seed: seed >>> 0 || 1, rng: (seed * 2654435761) >>> 0 || 7, clock: 0,
    followers: TUNE.start.followers, views: TUNE.start.views, xp: 0, level: 1, points: 0, perks: {},
    home: 0, items: starterItems(), nextUid: 0, inv: {}, fresh: {},
    // mystery boxes to open; every thing she’s ever had (the collection book); the sets she’s completed; her outfit
    mystery: [], got: {}, sets: [], outfit: 0,
    deliveries: [], uploads: [], videos: 0, ideas: [], ideasAt: 0, recent: [],
    live: 0, quests: [], questN: 0,
    drone: { next: 25, until: -1, gift: null }, bots: { next: 100, list: [], n: 0 },
    awards: [], peak: 0, bestCombo: 0, best: null,
    totals: { views: 0, followers: 0, videos: 0, viral: 0, live: 0, zapped: 0, mail: 0, placed: 0, bought: 0, raids: 0, clips: 0, answered: 0, pets: 0, boxes: 0, uses: 0, byTopic: {} },
    out: [],
  };
  c.nextUid = 1 + Math.max(...c.items.map((t) => t.uid));
  for (const it of c.items) c.got[it.id] = 1;
  refillIdeas(c);
  while (c.quests.length < 3) c.quests.push(newQuest(c));
  return c;
}

// ---------- what she can do ----------
export const openTopics = (c) => TOPICS.filter((t) => c.level >= t.level);
export const isOpen = (c, id) => Boolean(topicOf(id)) && c.level >= topicOf(id).level;
export const nextTopic = (c) => TOPICS.find((t) => c.level < t.level) || null;
export const shopItems = (c) => ITEMS.filter((x) => !x.starter && !x.given && !x.box && c.level >= x.level);
export const perkRank = (c, id) => c.perks[id] || 0;
export const slotsOf = (c) => 1 + perkRank(c, 'slot2') + perkRank(c, 'slot3');

// ---------- her room’s points ----------
// a topic’s points: every placed thing’s (what’s put away doesn’t count)
export function scores(c) {
  const s = Object.fromEntries(TOPICS.map((t) => [t.id, 0]));
  for (const it of c.items) { const p = pointsOf(itemOf(it.id)); for (const k in p) s[k] += p[k]; }
  return s;
}
export const quality = (pts) => 1 + Math.max(0, pts / TUNE.video.q) ** TUNE.video.qPow;

// ---------- what’s trending: up to three open topics, for `every` videos at a time ----------
export function trendsOf(c) {
  const open = openTopics(c).map((t) => t.id);
  const n = Math.min(TUNE.trend.n, Math.max(1, open.length - 1));
  const slot = Math.floor(c.videos / TUNE.trend.every);
  const ranked = open.map((id) => ({ id, h: hashOf(`${c.seed}:trend:${slot}:${id}`) })).sort((a, b) => a.h - b.h);
  return ranked.slice(0, n).map((x) => x.id);
}
export const trendLeft = (c) => TUNE.trend.every - (c.videos % TUNE.trend.every);
export function trendMult(c, a, b) {
  const tr = trendsOf(c), hit = [a, b].filter((t) => t && tr.includes(t)).length;
  const r = TUNE.trend.radar * perkRank(c, 'radar');
  return hit === 2 ? TUNE.trend.two + 2 * r : hit === 1 ? TUNE.trend.one + r : 1;
}

// ---------- a video ----------
export const reachOf = (f) => TUNE.video.base + TUNE.video.reach * Math.max(0, f) ** TUNE.video.reachPow;
// the views an idea would get now (before luck)
export function expected(c, idea, s = scores(c)) {
  const pts = (s[idea.a] || 0) + (s[idea.b] || 0);
  return reachOf(c.followers) * quality(pts) * trendMult(c, idea.a, idea.b) * setBonus(c, idea) * (1 + 0.2 * perkRank(c, 'thumbs'));
}
// her completed sets: each one about a topic of the idea’s makes it a bit better
export const setBonus = (c, idea) => 1 + TUNE.sets.bonus * SETS.filter((x) => (c.sets || []).includes(x.id) && (x.topic === idea.a || x.topic === idea.b)).length;
// the new followers an idea would bring now (before luck)
export function expectedFollowers(c, idea, s = scores(c)) {
  const V = TUNE.video, pts = (s[idea.a] || 0) + (s[idea.b] || 0);
  return V.grow * (Math.max(0, c.followers) + V.growStart) ** V.growPow * quality(pts) ** V.growQ * trendMult(c, idea.a, idea.b) * setBonus(c, idea) * (1 + 0.15 * perkRank(c, 'follow'));
}
export const makeTime = (c) => Math.min(TUNE.make.max, TUNE.make.base + TUNE.make.per * c.level ** TUNE.make.pow) * (1 - TUNE.make.fast * perkRank(c, 'fast'));

function newIdea(c) {
  const open = new Set(openTopics(c).map((t) => t.id));
  const fits = (i) => open.has(TITLES[i][1]) && open.has(TITLES[i][2]);
  const all = TITLES.map((t, i) => i).filter(fits);
  const pool = all.filter((i) => !c.recent.includes(i) && !c.ideas.some((x) => x.i === i));
  const list = pool.length ? pool : all.filter((i) => !c.ideas.some((x) => x.i === i));
  // a topic that just opened comes up more, so it gets used
  const w = list.map((i) => 1 + (Math.max(topicOf(TITLES[i][1]).level, topicOf(TITLES[i][2]).level) >= c.level - 2 && c.level > 1 ? 1.5 : 0));
  let r = roll(c) * w.reduce((a, b) => a + b, 0), pick = list[0];
  for (let k = 0; k < list.length; k++) { r -= w[k]; if (r <= 0) { pick = list[k]; break; } }
  c.recent = [pick, ...c.recent].slice(0, 14);
  const [title, a, b] = TITLES[pick];
  return { i: pick, title, a, b };
}
export function refillIdeas(c) { while (c.ideas.length < TUNE.ideas.n) c.ideas.push(newIdea(c)); }
// new ideas (free every `refresh` seconds)
export const ideasReady = (c) => c.clock >= c.ideasAt;
export function newIdeas(c) {
  if (!ideasReady(c)) return false;
  c.ideas = []; refillIdeas(c); c.ideasAt = c.clock + TUNE.ideas.refresh;
  return true;
}
// start making a video from idea k (a free slot needed) → the upload
export function startVideo(c, k) {
  const idea = c.ideas[k];
  if (!idea || c.uploads.length >= slotsOf(c)) return null;
  const luck = range(c, TUNE.video.luck[0], TUNE.video.luck[1]);
  const viral = roll(c) < TUNE.video.viral, x = luck * (viral ? TUNE.video.viralX : 1), s = scores(c);
  const views = Math.max(1, Math.round(expected(c, idea, s) * x)), followers = Math.max(1, Math.round(expectedFollowers(c, idea, s) * x));
  const slot = [0, 1, 2].find((k2) => !c.uploads.some((u) => u.slot === k2));
  const u = { slot, title: idea.title, a: idea.a, b: idea.b, start: c.clock, dur: makeTime(c), views, followers, viral, trend: trendMult(c, idea.a, idea.b) > 1 };
  c.uploads.push(u);
  c.ideas.splice(k, 1);
  refillIdeas(c);
  emit(c, 'start', { upload: u });
  return u;
}
export const uploadLeft = (c, u) => Math.max(0, u.start + u.dur - c.clock);
function finishVideo(c, u) {
  c.uploads = c.uploads.filter((x) => x !== u);
  const before = c.followers;
  c.views += u.views; c.followers += u.followers; c.videos++;
  const t = c.totals;
  t.views += u.views; t.followers += u.followers; t.videos++; if (u.viral) t.viral++;
  for (const k of [u.a, u.b]) t.byTopic[k] = (t.byTopic[k] || 0) + 1;
  if (!c.best || u.views > c.best.views) c.best = { title: u.title, views: u.views };
  c.live = Math.min(liveNeed(c), c.live + 1);
  emit(c, 'video', { upload: u });
  progress(c, 'videos', 1); progress(c, 'topic', 1, [u.a, u.b]); if (u.trend) progress(c, 'trend', 1); progress(c, 'one', u.views);
  addXp(c, TUNE.xp.video + TUNE.xp.perLevel * c.level);
  grew(c, before);
}

// ---------- levels ----------
export const xpNeed = (L) => Math.round(TUNE.xp.base + TUNE.xp.per * L ** TUNE.xp.pow);
export function addXp(c, n) {
  c.xp += Math.max(0, Math.round(n));
  while (c.xp >= xpNeed(c.level)) {
    c.xp -= xpNeed(c.level); c.level++;
    const pts = 1 + (c.level % 5 === 0 ? 1 : 0);
    c.points += pts;
    emit(c, 'level', { level: c.level, points: pts, topic: TOPICS.find((t) => t.level === c.level) || null, items: ITEMS.filter((x) => x.level === c.level && !x.starter && !x.given && !x.box).length });
    const box = levelBox(c.level);
    if (box) grantBox(c, box, 'level');
  }
}

// ---------- mystery boxes, the collection, sets ----------
// a level’s box: one for each of the first levels, then every third level, a silver every fifth and a gold every tenth
export const levelBox = (L) => (L % 10 === 0 ? 'gold' : L % 5 === 0 ? 'silver' : L <= 4 || L % 3 === 0 ? 'bronze' : null);
export function grantBox(c, tier, why = '') {
  const b = { uid: c.nextUid++, tier: boxOf(tier).id, why };
  c.mystery.push(b);
  emit(c, 'mystery', { box: b });
  return b;
}
// what a box could hold of a rarity: the shop’s things up to a few levels ahead, and the finds only boxes have
export const boxPool = (c, rarity) => ITEMS.filter((x) => x.rarity === rarity && !x.starter && !x.given && (x.box || x.level <= c.level + TUNE.boxes.ahead));
// a find she already has two of comes as views instead (a few videos’ worth, more the rarer it is)
const DUP = { common: 1, rare: 2.5, epic: 6, legendary: 15 };
export const dupViews = (c, x) => Math.round((reachOf(c.followers) * TUNE.boxes.dup + 60) * (DUP[x.rarity] || 1));
export const ownedOf = (c, id) => (c.inv[id] || 0) + c.items.filter((t) => t.id === id).length;
// open one: its rarity by the box’s odds (a rarer box, better odds), then one of that rarity → { id, rarity, tier, isNew,
// dup } (`dup`: the views it came as, when she already had two)
export function openMystery(c, uid) {
  const b = c.mystery.find((x) => x.uid === uid);
  if (!b) return null;
  c.mystery = c.mystery.filter((x) => x !== b);
  const odds = boxOf(b.tier).odds;
  let r = roll(c) * odds.reduce((a, v) => a + v, 0), k = 0;
  for (; k < odds.length - 1; k++) { r -= odds[k]; if (r < 0) break; }
  let pool = boxPool(c, RARITIES[k].id);
  while (!pool.length && k > 0) pool = boxPool(c, RARITIES[--k].id);
  // what she hasn’t got yet comes up a little more
  const w = pool.map((x) => (c.got[x.id] ? 1 : 2));
  let t = roll(c) * w.reduce((a, v) => a + v, 0), x = pool[0];
  for (let i = 0; i < pool.length; i++) { t -= w[i]; if (t <= 0) { x = pool[i]; break; } }
  const isNew = !c.got[x.id];
  c.totals.boxes++;
  if (!isNew && ownedOf(c, x.id) >= TUNE.boxes.keep) {
    const dup = dupViews(c, x);
    c.views += dup;
    emit(c, 'opened', { box: b, id: x.id, rarity: x.rarity, isNew, dup });
    return { id: x.id, rarity: x.rarity, tier: b.tier, isNew, dup };
  }
  c.inv[x.id] = (c.inv[x.id] || 0) + 1; c.fresh[x.id] = (c.fresh[x.id] || 0) + 1;
  got(c, x.id);
  emit(c, 'opened', { box: b, id: x.id, rarity: x.rarity, isNew, dup: 0 });
  return { id: x.id, rarity: x.rarity, tier: b.tier, isNew, dup: 0 };
}
// a thing she’s got (for the collection book): new ones count toward sets; a set done is a bonus and a gold box
export function got(c, id) {
  if (!itemOf(id) || c.got[id]) return false;
  c.got[id] = 1;
  for (const x of SETS) if (!c.sets.includes(x.id) && x.items.every((i) => c.got[i])) {
    c.sets.push(x.id);
    emit(c, 'set', { set: x });
    grantBox(c, 'gold', 'set');
  }
  return true;
}
export const gotCount = (c) => ITEMS.filter((x) => c.got[x.id] && !x.given).length;

// ---------- the shop ----------
export function deliverTime(c, price) {
  const D = TUNE.deliver;
  if (price < D.free) return 0;
  return Math.min(D.max, D.base + D.per * Math.log10(price / D.free) ** D.pow) * (1 - D.express * perkRank(c, 'express'));
}
export const canBuy = (c, id) => { const x = itemOf(id); return Boolean(x) && !x.starter && !x.given && !x.box && c.level >= x.level && c.views >= x.price; };
// buy a thing: it comes in a box (at once, for cheap things) → the delivery
export function buy(c, id) {
  if (!canBuy(c, id)) return null;
  const x = itemOf(id);
  c.views -= x.price;
  const d = { uid: c.nextUid++, id, ready: c.clock + deliverTime(c, x.price), fresh: true };
  c.deliveries.push(d);
  c.totals.bought++;
  progress(c, 'kind', 1, [x.kind]);
  emit(c, 'bought', { delivery: d });
  return d;
}
export const boxLeft = (c, d) => Math.max(0, d.ready - c.clock);
// a tap on a box that’s still on its way: a bit sooner
export function tapBox(c, uid) {
  const d = c.deliveries.find((x) => x.uid === uid);
  if (!d || boxLeft(c, d) <= 0) return false;
  d.ready -= Math.max(0.35, boxLeft(c, d) * TUNE.deliver.tap);
  return true;
}
// open a box that’s arrived → its thing (it’s hers now: to place, or kept with her things)
export function openBox(c, uid) {
  const d = c.deliveries.find((x) => x.uid === uid);
  if (!d || boxLeft(c, d) > 0) return null;
  c.deliveries = c.deliveries.filter((x) => x !== d);
  c.inv[d.id] = (c.inv[d.id] || 0) + 1;
  if (d.fresh) c.fresh[d.id] = (c.fresh[d.id] || 0) + 1;
  got(c, d.id);
  return d.id;
}
// place one of her things that’s put away (a new one gives experience, once) → the placed thing
export function placeFromInv(c, id, x, y, opts = {}) {
  if (!(c.inv[id] > 0)) return null;
  const it = roomPlace(c, id, x, y, opts);
  if (!it) return null;
  if (--c.inv[id] <= 0) delete c.inv[id];
  if (c.fresh[id] > 0) {
    if (--c.fresh[id] <= 0) delete c.fresh[id];
    c.totals.placed++;
    progress(c, 'place', 1);
    addXp(c, TUNE.xp.place + TUNE.xp.placePer * Math.log10(itemOf(id).price + 10));
  }
  emit(c, 'placed', { item: it });
  return it;
}
// a spot for it: floor things along the back first, never in front of her desk, and never shutting off part of the
// floor (she has to get round); rugs in the middle; small things and wall things wherever there’s room
export const hasSpot = (c, id) => spotsFor(c, id).length > 0;
export function autoSpot(c, id) {
  const home = homeOf(c), def = itemOf(id), list = spotsFor(c, id);
  if (!list.length) return null;
  const desk = deskSpot(c), mid = home.cols / 2;
  const score = (p) => {
    if (def.place === 'flat') return Math.abs(p.x + def.w / 2 - mid) + Math.abs(p.y + def.h / 2 - home.rows / 2) * 2;
    if (def.place !== 'floor') return p.y * 2 + Math.abs(p.x + def.w / 2 - mid) * 0.2;
    let v = p.y * 3 + Math.abs(p.x + def.w / 2 - mid) * 0.2;
    if (desk && desk.x >= p.x && desk.x < p.x + def.w && desk.y >= p.y && desk.y < p.y + def.h) v += 100;
    return v;
  };
  const ranked = list.map((p) => ({ p, v: score(p) })).sort((a, b) => a.v - b.v).map((x) => x.p);
  if (def.place !== 'floor' || def.pet) return ranked[0];
  const base = blockedGrid(c);
  return ranked.find((p) => staysOpen(c, def, p, base)) || null;
}
// would the floor’s free cells all still reach each other with this thing there? (`base`: what stands there now)
function staysOpen(c, def, p, base = blockedGrid(c)) {
  const home = homeOf(c), cols = home.cols, b = base.slice();
  for (let i = 0; i < def.w; i++) for (let j = 0; j < def.h; j++) { const x = p.x + i, y = p.y + j; if (x >= 0 && y >= 0 && x < cols && y < home.rows) b[y * cols + x] = 1; }
  let free = 0, start = -1;
  for (let k = 0; k < b.length; k++) if (!b[k]) { free++; if (start < 0) start = k; }
  if (free < 3) return false;
  const seen = new Uint8Array(b.length), q = new Int32Array(b.length);
  let head = 0, tail = 0, n = 1;
  q[tail++] = start; seen[start] = 1;
  while (head < tail) {
    const k = q[head++], x = k % cols;
    const next = [x > 0 ? k - 1 : -1, x < cols - 1 ? k + 1 : -1, k - cols, k + cols];
    for (const m of next) if (m >= 0 && m < b.length && !b[m] && !seen[m]) { seen[m] = 1; q[tail++] = m; n++; }
  }
  return n === free;
}
export const invCount = (c) => Object.values(c.inv).reduce((a, b) => a + b, 0);

// ---------- homes ----------
export const nextHome = (c) => HOMES[(c.home || 0) + 1] || null;
export const canMoveHome = (c) => { const h = nextHome(c); return Boolean(h) && c.followers >= h.at && c.views >= h.cost; };
export function moveHome(c) {
  if (!canMoveHome(c)) return null;
  const h = nextHome(c);
  c.views -= h.cost; c.home++;
  emit(c, 'home', { home: h });
  return h;
}

// ---------- perks ----------
export const perkCost = (c, id) => perkRank(c, id) + 1;
export function canPerk(c, id) {
  const p = perkOf(id);
  return Boolean(p) && c.points >= perkCost(c, id) && c.level >= p.level && perkRank(c, id) < p.max && (!p.needs || perkRank(c, p.needs) > 0);
}
export function buyPerk(c, id) {
  if (!canPerk(c, id)) return false;
  c.points -= perkCost(c, id); c.perks[id] = perkRank(c, id) + 1;
  emit(c, 'perk', { perk: perkOf(id), rank: c.perks[id] });
  return true;
}

// ---------- going live ----------
// the live meter: about TUNE.live.charge minutes of her videos (less with Live energy)
// (her first stream comes sooner: a handful of videos)
export const liveNeed = (c) => (c.totals.live ? Math.max(4, Math.round(TUNE.live.charge * videosPerStream(c) * (1 - TUNE.live.energy * perkRank(c, 'energy')))) : TUNE.live.first);
export const liveReady = (c) => c.live >= liveNeed(c);
// the topic she’d go live with: her best, a trending one first
export function liveTopic(c) {
  const s = scores(c), tr = trendsOf(c);
  const v = (t) => s[t.id] + (tr.includes(t.id) ? 1000 : 0);
  return [...openTopics(c)].sort((a, b) => v(b) - v(a))[0].id;
}
// → what the stream starts with (./stream.js’s createStream)
export function liveStart(c, topic = liveTopic(c)) {
  if (!liveReady(c)) return null;
  c.live = 0;
  const s = scores(c);
  // a few in every hundred followers watch her live (more with a better room)
  return { topic, v0: 3 + TUNE.live.watch * Math.max(0, c.followers) ** 0.95 * Math.sqrt(quality(s[topic] * 2)), busy: Math.max(0, Math.min(1, (Math.log10(c.followers + 10) - 1) / 6.5)) };
}
// her best video now: about `topic` (her live topic) and whichever other open topic goes best with it
export function bestIdea(c, topic = liveTopic(c), s = scores(c)) {
  let best = null, f = -1;
  for (const t of openTopics(c)) {
    if (t.id === topic && openTopics(c).length > 1) continue;
    const idea = { a: topic, b: t.id }, v = expectedFollowers(c, idea, s);
    if (v > f) { f = v; best = idea; }
  }
  return best;
}
// how many videos she could make in the minute a stream takes
export const videosPerStream = (c) => (TUNE.dur / makeTime(c)) * slotsOf(c);
// a live stream takes the minute she could’ve spent making videos, so it’s worth that minute of her best video: a bit
// less for a quiet stream, about twice as much with chat hyped, more for an S → { views, followers, xp }
export function liveWorth(c, r) {
  const s = scores(c), W = TUNE.live.worth;
  const k = (W[0] + W[1] * Math.min(1, (r.hypeAvg || 0) / 100) + (r.grade === 'S' ? W[2] : 0)) * videosPerStream(c);
  const idea = bestIdea(c, isOpen(c, r.cat) ? r.cat : liveTopic(c), s);
  return {
    views: Math.round(expected(c, idea, s) * k),
    followers: Math.max(1, Math.round(expectedFollowers(c, idea, s) * k)),
    xp: Math.round((TUNE.xp.video + TUNE.xp.perLevel * c.level) * k * TUNE.xp.live),
  };
}
// what a stream brought: its views and followers (a live stream is the best way to grow), experience
export function liveDone(c, r) {
  const before = c.followers;
  const { views, followers, xp } = liveWorth(c, r);
  c.views += views; c.followers += followers;
  c.peak = Math.max(c.peak, Math.round(r.peak)); c.bestCombo = Math.max(c.bestCombo, r.combo || 0);
  const t = c.totals;
  t.views += views; t.followers += followers; t.live++; t.raids += r.stats?.raids || 0; t.clips += r.stats?.clips || 0; t.answered += r.stats?.answered || 0;
  t.zapped += r.stats?.banned || 0;
  progress(c, 'live', 1);
  addXp(c, xp);
  grew(c, before);
  const box = r.grade === 'S' ? 'silver' : r.grade === 'A' ? 'bronze' : null;
  if (box) grantBox(c, box, 'live');
  return { views, followers, xp, box };
}

// ---------- the clock ----------
export const idleRate = (c) => (TUNE.idle.base + c.followers * TUNE.idle.perF) * (1 + TUNE.idle.old * perkRank(c, 'old')) * (c.bots.list.length ? TUNE.idle.bots : 1);
// time goes by: her old videos earn, videos finish, boxes arrive, the drone and the bots come by
export function tick(c, dt, { events = true } = {}) {
  if (!(dt > 0)) return;
  c.clock += dt;
  c.views += idleRate(c) * dt;
  for (const u of [...c.uploads]) if (uploadLeft(c, u) <= 0) finishVideo(c, u);
  for (const d of c.deliveries) if (!d.told && boxLeft(c, d) <= 0) { d.told = true; emit(c, 'arrived', { delivery: d }); }
  if (!events) return;
  // the fan-mail drone
  const D = TUNE.drone;
  if (c.drone.until >= 0 && c.clock > c.drone.until) { c.drone.until = -1; c.drone.gift = null; emit(c, 'droneGone'); }
  if (c.drone.until < 0 && c.clock >= c.drone.next) {
    c.drone.next = c.clock + range(c, D.every[0], D.every[1]) * (1 - D.mail * perkRank(c, 'mail'));
    c.drone.until = c.clock + D.fly; c.drone.gift = droneGift(c);
    emit(c, 'drone', { gift: c.drone.gift });
  }
  // the spam bots
  const B = TUNE.bots;
  c.bots.list = c.bots.list.filter((b) => { if (c.clock > b.until) { emit(c, 'botGone', { bot: b }); return false; } return true; });
  if (c.followers >= B.from && c.clock >= c.bots.next && !c.bots.list.length) {
    c.bots.next = c.clock + range(c, B.every[0], B.every[1]);
    const n = Math.round(range(c, B.n[0], B.n[1] + (c.followers > 5000 ? 1 : 0)));
    for (let i = 0; i < n; i++) { const b = { id: ++c.bots.n, until: c.clock + B.life + i * 1.5 }; c.bots.list.push(b); emit(c, 'bot', { bot: b }); }
  }
}
function droneGift(c) {
  const m = perkRank(c, 'mail'), r = roll(c);
  if (r < 0.03 + 0.015 * m) return { kind: 'point' };
  if (r < TUNE.boxes.mail + 0.03 * m) return { kind: 'box', tier: 'bronze' };
  if (r < 0.45) {
    const cheap = shopItems(c).filter((x) => x.price <= Math.max(250, c.views * 0.6));
    if (cheap.length) { const x = cheap[Math.floor(roll(c) * cheap.length)]; return { kind: 'item', id: x.id }; }
  }
  return { kind: 'views', n: Math.round((30 + idleRate(c) * 35 + reachOf(c.followers) * 1.5) * (1 + 0.25 * m)) };
}
// a tap on the drone while it’s over her room → its gift
export function catchDrone(c) {
  if (c.drone.until < 0 || c.clock > c.drone.until || !c.drone.gift) return null;
  const g = c.drone.gift;
  c.drone.until = -1; c.drone.gift = null;
  if (g.kind === 'point') c.points++;
  else if (g.kind === 'item') { c.inv[g.id] = (c.inv[g.id] || 0) + 1; c.fresh[g.id] = (c.fresh[g.id] || 0) + 1; got(c, g.id); }
  else if (g.kind === 'box') grantBox(c, g.tier, 'mail');
  else c.views += g.n;
  c.totals.mail++;
  progress(c, 'mail', 1);
  emit(c, 'mail', { gift: g });
  return g;
}
// a tap on a spam bot: gone, and a few views for the trouble
export function zap(c, id) {
  const b = c.bots.list.find((x) => x.id === id);
  if (!b) return 0;
  c.bots.list = c.bots.list.filter((x) => x !== b);
  const n = Math.round(4 + idleRate(c) * 4);
  c.views += n; c.totals.zapped++;
  progress(c, 'zap', 1);
  emit(c, 'zapped', { bot: b, views: n });
  return n;
}
// a pet for her cat (or her robot dog): a heart, and every fifth one a few views
export function pet(c) {
  c.totals.pets++;
  progress(c, 'pet', 1);
  const n = c.totals.pets % 5 === 0 ? Math.round(10 + idleRate(c) * 6) : 0;
  c.views += n;
  return n;
}
// away: her old videos earned half as much (eight hours at most); her videos and deliveries finished
export function awayGain(c, seconds) {
  const away = Math.max(0, Number(seconds) || 0), counted = Math.min(away, TUNE.idle.cap);
  return { away, counted, capped: away > TUNE.idle.cap, views: idleRate({ ...c, bots: { list: [] } }) * counted * TUNE.idle.away };
}
export function comeBack(c, seconds) {
  const g = awayGain(c, seconds);
  if (g.away <= 0) return g;
  c.bots.list = [];
  c.clock += g.away;
  c.views += g.views;
  for (const u of [...c.uploads]) if (uploadLeft(c, u) <= 0) finishVideo(c, u);
  c.drone.until = -1; c.drone.gift = null; c.drone.next = c.clock + 15; c.bots.next = Math.max(c.bots.next, c.clock + 60);
  return g;
}

// ---------- quests: three at a time, claimed as they’re done ----------
const QUEST_KINDS = ['videos', 'topic', 'place', 'trend', 'kind', 'one', 'live', 'zap', 'mail', 'pet', 'followers'];
function newQuest(c) {
  const n = ++c.questN, open = openTopics(c);
  const kinds = QUEST_KINDS.filter((k) => !c.quests.some((q) => q.kind === k)
    && !(k === 'live' && c.level < 2) && !(k === 'zap' && c.followers < TUNE.bots.from) && !(k === 'pet' && !c.items.some((t) => itemOf(t.id).pet))
    && !(k === 'mail' && n < 3) && !(k === 'trend' && open.length < 2) && !(k === 'kind' && !shopItems(c).length));
  const kind = kinds[Math.floor(roll(c) * kinds.length)] || 'videos';
  const q = { n, kind, have: 0, target: 1, reward: {} };
  if (kind === 'videos') q.target = 2 + Math.floor(roll(c) * 3);
  else if (kind === 'topic') { q.topic = open[Math.floor(roll(c) * open.length)].id; q.target = 2; }
  else if (kind === 'place') q.target = 2 + Math.floor(roll(c) * 2);
  else if (kind === 'trend') q.target = 2;
  else if (kind === 'kind') { const ks = [...new Set(shopItems(c).map((x) => x.kind))]; q.shelf = ks[Math.floor(roll(c) * ks.length)]; q.target = 1; }
  else if (kind === 'one') q.target = round2(Math.max(30, reachOf(c.followers) * quality(Math.max(...Object.values(scores(c))) * 1.4) * 1.3));
  else if (kind === 'zap') q.target = 2 + Math.floor(roll(c) * 2);
  else if (kind === 'mail') q.target = 1 + Math.floor(roll(c) * 2);
  else if (kind === 'pet') q.target = 5;
  else if (kind === 'followers') { q.target = round2(Math.max(20, c.followers * 1.6)); q.have = c.followers; }
  q.reward = { views: round2(reachOf(c.followers) * (3 + roll(c) * 3) + 40), xp: 12 + 4 * c.level, point: n % 4 === 0 };
  if (n % TUNE.boxes.quest === 0) q.reward.box = 'silver';
  return q;
}
const round2 = (v) => { const p = 10 ** Math.max(0, Math.floor(Math.log10(Math.max(1, v))) - 1); return Math.ceil(v / p) * p; };
export function progress(c, kind, n = 1, keys = null) {
  for (const q of c.quests) {
    if (q.done) continue;
    if (kind === 'one' && q.kind === 'one') q.have = Math.max(q.have, n);
    else if (kind === 'followers' && q.kind === 'followers') q.have = n;
    else if (q.kind === kind && kind !== 'one' && kind !== 'followers' && (kind !== 'topic' || keys?.includes(q.topic)) && (kind !== 'kind' || keys?.includes(q.shelf))) q.have += n;
    if (q.have >= q.target) q.done = true;
  }
  for (const q of c.quests.filter((x) => x.done)) {
    c.quests = c.quests.filter((x) => x !== q);
    c.views += q.reward.views; if (q.reward.point) c.points++;
    emit(c, 'quest', { quest: q });
    if (q.reward.box) grantBox(c, q.reward.box, 'quest');
    addXp(c, q.reward.xp);
    c.quests.push(newQuest(c));
  }
}
function grew(c, before) {
  progress(c, 'followers', c.followers);
  for (const a of AWARDS) if (before < a.at && c.followers >= a.at && !c.awards.includes(a.id)) {
    c.awards.push(a.id); c.inv[`plaque_${a.id}`] = (c.inv[`plaque_${a.id}`] || 0) + 1;
    emit(c, 'award', { award: a });
  }
  const h = nextHome(c);
  if (h && before < h.at && c.followers >= h.at) emit(c, 'homeReady', { home: h });
  const passed = RIVALS.filter((r) => before <= r.f && c.followers > r.f);
  if (passed.length) emit(c, 'passed', { rivals: passed, rank: rankOf(c.followers) });
}
export { rankOf, layer, BOXES };
