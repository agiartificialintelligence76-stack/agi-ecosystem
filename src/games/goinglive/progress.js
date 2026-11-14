// GOING LIVE: what's kept in the player's browser (the arcade kit's local save, `agi_arcade:goinglive`): her career (her
// followers, views, room, what she owns, how tired chat is of each kind, her clips), when the page last saw her (so her
// old streams can earn while she's away), her stickers and the tips already shown. Loaded with care: anything odd starts
// that part fresh.
import { newCareer } from './econ.js';
import { SLOTS, CAT_IDS, ROOMS, RIVALS, CATS } from './data.js';

export const STICKERS = Object.freeze([
  { id: 'first', name: 'Going live', how: 'Finish your first stream.' },
  { id: 'hundred', name: 'Bronze Mic', how: 'Reach 100 followers.' },
  { id: 'ban', name: 'Ban hammer', how: 'Ban 25 spam bots.' },
  { id: 'raid', name: 'Raid party', how: 'Welcome 10 raids.' },
  { id: 'clip', name: 'Clip it', how: 'Make 10 clips.' },
  { id: 'combo', name: 'Combo queen', how: 'A combo of 30 in one stream.' },
  { id: 'srank', name: 'S rank', how: 'An S stream: almost nothing missed, chat hyped.' },
  { id: 'big', name: 'Big moments', how: 'Win 10 big moments.' },
  { id: 'variety', name: 'Variety streamer', how: 'Stream all eight kinds.' },
  { id: 'moved', name: 'Moving up', how: 'Move to the studio flat.' },
  { id: 'million', name: 'Ruby Mic', how: 'Reach 1,000,000 followers.' },
  { id: 'setup', name: 'Dream setup', how: 'Every thing in her room at its best.' },
  { id: 'orbit', name: 'Streaming from space', how: 'Move to the space station.' },
  { id: 'no1', name: '#1 trending', how: 'Pass every streamer on the board.' },
]);
export const stickerOf = (id) => STICKERS.find((s) => s.id === id) || null;

const num = (v, d = 0, lo = 0, hi = Number.MAX_SAFE_INTEGER) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
export function fresh() { return { career: newCareer(), at: null, stickers: [], tips: {}, played: 0 }; }
export function load(raw) {
  const f = fresh();
  if (!raw || typeof raw !== 'object' || !raw.career || raw.career.v !== 1) return f;
  const r = raw.career, c = f.career;
  c.followers = Math.round(num(r.followers, 0, 0, 1e15));
  c.views = num(r.views, c.views, 0, 1e18);
  c.streams = Math.round(num(r.streams, 0, 0, 1e7));
  c.room = Math.round(num(r.room, 0, 0, ROOMS.length - 1));
  for (const s of SLOTS) c.owned[s.id] = Math.round(num(r.owned?.[s.id], 0, 0, s.tiers.length - 1));
  for (const id of CAT_IDS) c.fresh[id] = num(r.fresh?.[id], 1, 0, 1);
  c.clips = Math.round(num(r.clips, 0, 0, 1e9));
  c.clipRate = num(r.clipRate, 0, 0, 1e15);
  c.peak = Math.round(num(r.peak, 0, 0, 1e15));
  c.bestCombo = Math.round(num(r.bestCombo, 0, 0, 1e6));
  c.last = r.last && typeof r.last === 'object' && CAT_IDS.includes(r.last.cat) ? { cat: r.last.cat, peak: num(r.last.peak), views: num(r.last.views), followers: num(r.last.followers) } : null;
  const t = r.totals || {};
  for (const k of Object.keys(c.totals)) if (k !== 'byCat') c.totals[k] = num(t[k], 0, 0, 1e18);
  if (t.byCat && typeof t.byCat === 'object') for (const id of CAT_IDS) if (Number.isFinite(t.byCat[id])) c.totals.byCat[id] = Math.max(0, t.byCat[id]);
  return {
    career: c,
    at: Number.isFinite(raw.at) ? raw.at : null,
    stickers: Array.isArray(raw.stickers) ? raw.stickers.filter((id) => stickerOf(id)) : [],
    tips: raw.tips && typeof raw.tips === 'object' ? { ...raw.tips } : {},
    played: Math.round(num(raw.played, 0, 0, 1e7)),
  };
}
// the stickers a career has earned now (after a stream: its result, for the ones about one stream)
export function earned(save, r = null) {
  const c = save.career, t = c.totals, got = new Set(save.stickers), add = [];
  const give = (id, ok) => { if (ok && !got.has(id)) { got.add(id); add.push(stickerOf(id)); } };
  give('first', c.streams >= 1);
  give('hundred', c.followers >= 100);
  give('ban', t.banned >= 25);
  give('raid', t.raids >= 10);
  give('clip', t.clips >= 10);
  give('combo', (r?.combo || 0) >= 30 || c.bestCombo >= 30);
  give('srank', r?.grade === 'S');
  give('big', t.bigs >= 10);
  give('variety', CATS.every((k) => (t.byCat[k.id] || 0) > 0));
  give('moved', c.room >= 1);
  give('million', c.followers >= 1e6);
  give('setup', SLOTS.every((s) => (c.owned[s.id] || 0) >= s.tiers.length - 1));
  give('orbit', c.room >= ROOMS.length - 1);
  give('no1', c.followers > RIVALS[0].f);
  save.stickers = [...got];
  return add;
}
