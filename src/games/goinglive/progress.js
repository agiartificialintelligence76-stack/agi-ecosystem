// GOING LIVE: what's kept in the player's browser (the arcade kit's local save, `agi_arcade:goinglive`): her career (her
// followers, views, level, skills, her room and her things, the videos she's making, the boxes on their way, her ideas
// and quests), when the page last saw her (so her old videos can earn while she's away), her stickers and the tips
// already shown. Loaded with care: anything odd starts that part fresh; the room is rebuilt thing by thing, so nothing
// can end up where it doesn't fit. A career from the first GOING LIVE (2026-11-14, before the rebuild) keeps its
// followers and views and starts in the new bedroom.
import { newCareer, refillIdeas, xpNeed } from './econ.js';
import { TOPIC_IDS, ITEM_IDS, itemOf, PERKS, AWARDS, HOMES, RIVALS } from './data.js';
import { TITLES } from './titles.js';
import { canPlace, starterItems } from './room.js';

export const STICKERS = Object.freeze([
  { id: 'first', name: 'First upload', how: 'Make your first video.' },
  { id: 'hundred', name: 'Bronze Mic', how: 'Reach 100 followers.' },
  { id: 'decor', name: 'Decorator', how: 'Put 25 new things in her room.' },
  { id: 'zap', name: 'Bot zapper', how: 'Zap 25 spam bots.' },
  { id: 'mail', name: 'Fan mail', how: 'Catch the fan-mail drone 10 times.' },
  { id: 'viral', name: 'Gone viral', how: 'Have a video go viral.' },
  { id: 'raid', name: 'Raid party', how: 'Welcome 10 raids when she’s live.' },
  { id: 'srank', name: 'S rank', how: 'An S live stream: almost nothing missed, chat hyped.' },
  { id: 'variety', name: 'Variety channel', how: 'Make videos about all ten topics.' },
  { id: 'moved', name: 'Moving up', how: 'Move to the studio flat.' },
  { id: 'million', name: 'Ruby Mic', how: 'Reach 1,000,000 followers.' },
  { id: 'brain', name: 'Big brain', how: 'Learn 10 skill ranks.' },
  { id: 'orbit', name: 'Streaming from space', how: 'Move to the space station.' },
  { id: 'no1', name: '#1 trending', how: 'Pass every streamer on the board.' },
]);
export const stickerOf = (id) => STICKERS.find((s) => s.id === id) || null;

const num = (v, d = 0, lo = 0, hi = Number.MAX_SAFE_INTEGER) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const int = (v, d = 0, lo = 0, hi = 1e9) => Math.round(num(v, d, lo, hi));
export function fresh(seed = 1) { return { career: newCareer(seed), at: null, stickers: [], tips: {}, played: 0 }; }
// a level for a number of followers (a career from the first GOING LIVE, or one whose level looks wrong)
export const levelFor = (f) => Math.max(1, Math.min(40, Math.round(2 + 2.4 * Math.log10(Math.max(1, f)) ** 1.2)));

export function load(raw, seed = 1) {
  const f = fresh(seed);
  if (!raw || typeof raw !== 'object' || !raw.career || typeof raw.career !== 'object') return f;
  const r = raw.career, c = f.career;
  const keep = {
    at: Number.isFinite(raw.at) ? raw.at : null,
    stickers: Array.isArray(raw.stickers) ? raw.stickers.filter((id) => stickerOf(id)) : [],
    tips: raw.tips && typeof raw.tips === 'object' ? Object.fromEntries(Object.entries(raw.tips).filter(([, v]) => v === true)) : {},
    played: int(raw.played, 0, 0, 1e7),
  };
  // the first GOING LIVE: followers, views and a level to match; a fresh bedroom
  if (r.v === 1) {
    c.followers = int(r.followers, 0, 0, 1e15); c.views = num(r.views, c.views, 0, 1e15);
    c.level = levelFor(c.followers); c.points = c.level - 1; c.migrated = true;
    c.ideas = []; refillIdeas(c);
    return { career: c, ...keep, stickers: [], tips: {} };
  }
  if (r.v !== 2) return f;
  c.seed = int(r.seed, c.seed, 1, 4294967295); c.rng = int(r.rng, c.rng, 1, 4294967295);
  c.clock = num(r.clock, 0, 0, 1e12);
  c.followers = int(r.followers, 0, 0, 1e15); c.views = num(r.views, c.views, 0, 1e18);
  c.level = int(r.level, 1, 1, 200); c.xp = int(r.xp, 0, 0, xpNeed(c.level)); c.points = int(r.points, 0, 0, 1e4);
  c.perks = {};
  for (const p of PERKS) { const n = int(r.perks?.[p.id], 0, 0, p.max); if (n) c.perks[p.id] = n; }
  c.home = int(r.home, 0, 0, HOMES.length - 1);
  // her room, thing by thing (what doesn't fit goes to her things)
  c.items = []; c.inv = {};
  const items = Array.isArray(r.items) ? r.items : starterItems();
  const map = new Map();
  const later = [];
  let next = 1;
  for (const it of items) {
    if (!it || !ITEM_IDS.includes(it.id)) continue;
    const def = itemOf(it.id);
    if (def.place === 'top') { later.push(it); continue; }
    const uid = next++;
    if (Number.isInteger(it.x) && Number.isInteger(it.y) && canPlace(c, it.id, it.x, it.y).ok) { c.items.push({ uid, id: it.id, x: it.x, y: it.y, flip: Boolean(it.flip) }); map.set(it.uid, uid); }
    else c.inv[it.id] = (c.inv[it.id] || 0) + 1;
  }
  for (const it of later) {
    const on = map.get(it.on), uid = next++;
    if (on && Number.isInteger(it.x) && canPlace(c, it.id, it.x, 0, { on }).ok) c.items.push({ uid, id: it.id, x: it.x, y: c.items.find((s) => s.uid === on).y, flip: Boolean(it.flip), on });
    else c.inv[it.id] = (c.inv[it.id] || 0) + 1;
  }
  for (const [id, n] of Object.entries(r.inv || {})) if (ITEM_IDS.includes(id)) { const k = int(n, 0, 0, 999); if (k) c.inv[id] = (c.inv[id] || 0) + k; }
  c.fresh = {};
  for (const [id, n] of Object.entries(r.fresh || {})) if (ITEM_IDS.includes(id)) { const k = int(n, 0, 0, 999); if (k) c.fresh[id] = k; }
  c.nextUid = next + 1000;
  c.deliveries = (Array.isArray(r.deliveries) ? r.deliveries : []).filter((d) => d && ITEM_IDS.includes(d.id)).slice(0, 12)
    .map((d) => ({ uid: c.nextUid++, id: d.id, ready: num(d.ready, c.clock, 0, 1e12), fresh: Boolean(d.fresh) }));
  c.uploads = (Array.isArray(r.uploads) ? r.uploads : []).filter((u) => u && TOPIC_IDS.includes(u.a) && TOPIC_IDS.includes(u.b)).slice(0, 3)
    .map((u, i) => ({ slot: i, title: String(u.title || '').slice(0, 80), a: u.a, b: u.b, start: num(u.start, c.clock, 0, 1e12), dur: num(u.dur, 10, 1, 120), views: int(u.views, 1, 1, 1e15), followers: int(u.followers, 1, 1, 1e14), viral: Boolean(u.viral), trend: Boolean(u.trend) }));
  c.videos = int(r.videos, 0, 0, 1e9);
  c.recent = (Array.isArray(r.recent) ? r.recent : []).filter((i) => Number.isInteger(i) && TITLES[i]).slice(0, 14);
  c.ideas = (Array.isArray(r.ideas) ? r.ideas : []).filter((x) => x && Number.isInteger(x.i) && TITLES[x.i]).slice(0, 3).map((x) => ({ i: x.i, title: TITLES[x.i][0], a: TITLES[x.i][1], b: TITLES[x.i][2] }));
  refillIdeas(c);
  c.ideasAt = num(r.ideasAt, 0, 0, 1e12);
  c.live = int(r.live, 0, 0, 20);
  c.questN = int(r.questN, 3, 0, 1e9);
  const okQuest = (q) => q && typeof q.kind === 'string' && Number.isFinite(q.target) && q.target > 0 && Number.isFinite(q.have) && q.reward && Number.isFinite(q.reward.views);
  const qs = (Array.isArray(r.quests) ? r.quests : []).filter(okQuest).slice(0, 3);
  if (qs.length === 3) c.quests = qs.map((q) => ({ n: int(q.n, 1), kind: q.kind, topic: TOPIC_IDS.includes(q.topic) ? q.topic : undefined, shelf: typeof q.shelf === 'string' ? q.shelf : undefined, have: num(q.have, 0, 0, 1e15), target: num(q.target, 1, 1, 1e15), reward: { views: num(q.reward.views, 0, 0, 1e15), xp: int(q.reward.xp, 0, 0, 1e6), point: Boolean(q.reward.point) } }));
  c.awards = (Array.isArray(r.awards) ? r.awards : []).filter((id) => AWARDS.some((a) => a.id === id));
  c.peak = int(r.peak, 0, 0, 1e15); c.bestCombo = int(r.bestCombo, 0, 0, 1e6);
  c.best = r.best && typeof r.best.title === 'string' ? { title: r.best.title.slice(0, 80), views: int(r.best.views, 0, 0, 1e15) } : null;
  const t = r.totals || {};
  for (const k of Object.keys(c.totals)) if (k !== 'byTopic') c.totals[k] = num(t[k], 0, 0, 1e18);
  if (t.byTopic && typeof t.byTopic === 'object') for (const id of TOPIC_IDS) if (Number.isFinite(t.byTopic[id])) c.totals.byTopic[id] = Math.max(0, t.byTopic[id]);
  c.drone = { next: c.clock + 20, until: -1, gift: null };
  c.bots = { next: c.clock + 60, list: [], n: int(r.bots?.n, 0, 0, 1e9) };
  return { career: c, ...keep };
}
// what to keep (the career without what's only for this visit)
export function saveOf(save) {
  const { out, ...c } = save.career;
  void out;
  return { career: { ...c, drone: undefined, bots: { n: c.bots.n } }, at: save.at, stickers: save.stickers, tips: save.tips, played: save.played };
}
// the stickers earned now (after a live stream: its result, for the ones about one stream)
export function earned(save, r = null) {
  const c = save.career, t = c.totals, got = new Set(save.stickers), add = [];
  const give = (id, ok) => { if (ok && !got.has(id)) { got.add(id); add.push(stickerOf(id)); } };
  give('first', t.videos >= 1);
  give('hundred', c.followers >= 100);
  give('decor', t.placed >= 25);
  give('zap', t.zapped >= 25);
  give('mail', t.mail >= 10);
  give('viral', t.viral >= 1);
  give('raid', t.raids >= 10);
  give('srank', r?.grade === 'S');
  give('variety', TOPIC_IDS.every((k) => (t.byTopic[k] || 0) > 0));
  give('moved', c.home >= 1);
  give('million', c.followers >= 1e6);
  give('brain', Object.values(c.perks).reduce((a, b) => a + b, 0) >= 10);
  give('orbit', c.home >= HOMES.length - 1);
  give('no1', c.followers > RIVALS[0].f);
  save.stickers = [...got];
  return add;
}
