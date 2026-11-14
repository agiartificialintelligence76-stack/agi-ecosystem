// GROWTH STOCK: what's kept in the player's browser (the arcade kit's local save, `agi_arcade:growthstock`): stars and
// bests per season, the Daily and its streak, Endless's best, the farm's lifetime totals, stickers, tips already shown.
import { SEASONS, starsFor, seasonOf, dayBefore } from './seasons.js';

export const STICKERS = Object.freeze([
  { id: 'first', name: 'First harvest', art: 'gme', how: 'Harvest anything.' },
  { id: 'bumper', name: 'Green thumb', art: 'aapl', how: '15 bumper crops in one season.' },
  { id: 'spike', name: 'Sold the spike', art: 'tsla', how: 'Sell a share at twice its usual rate.' },
  { id: 'top', name: 'Top of the chart', art: 'nvda', how: 'Sell a share at almost three times its usual rate.' },
  { id: 'shoo', name: 'Shoo!', art: 'bear', how: 'Chase a bear off the farm.' },
  { id: 'bull', name: 'Rode the bull', art: 'bull', how: 'Sell 150 gold of shares during a bull run.' },
  { id: 'orders', name: 'Order up', art: 'amzn', how: 'Deliver three orders in one season.' },
  { id: 'clean', name: 'Nothing wasted', art: 'ko', how: 'Finish a season with nothing wilted or eaten.' },
  { id: 'land', name: 'Every plot', art: 'msft', how: 'Open all 25 plots.' },
  { id: 'rich', name: 'Gold rush', art: 'coin', how: 'Finish a season with 5,000 gold.' },
  { id: 'perfect', name: 'Full marks', art: 'brka', how: 'Three stars in any season.' },
  { id: 'year', name: 'Four quarters', art: 'nflx', how: 'A star in all four seasons.' },
  { id: 'daily', name: 'Daily farmer', art: 'ko', how: 'Play the Daily three days in a row.' },
  { id: 'chips', name: 'Chip farmer', art: 'nvda', how: 'Harvest 30 NVDA shares in all.' },
]);
export const stickerOf = (id) => STICKERS.find((s) => s.id === id) || null;

export function fresh() {
  return { v: 1, seasons: {}, daily: { key: null, best: 0, last: null, streak: 0 }, endless: { best: 0, days: 0 }, totals: { harvested: 0, sold: 0, earned: 0, orders: 0, shooed: 0, byCrop: {} }, bestSale: null, stickers: [], tips: {} };
}
export function load(raw) {
  const f = fresh();
  if (!raw || typeof raw !== 'object' || raw.v !== 1) return f;
  const num = (v, d = 0) => (Number.isFinite(v) ? v : d);
  const seasons = {};
  for (const s of SEASONS) { const x = raw.seasons?.[s.id]; if (x) seasons[s.id] = { stars: Math.max(0, Math.min(3, num(x.stars))), best: num(x.best), played: num(x.played) }; }
  const d = raw.daily || {};
  const t = raw.totals || {};
  return {
    v: 1, seasons,
    daily: { key: typeof d.key === 'string' ? d.key : null, best: num(d.best), last: typeof d.last === 'string' ? d.last : null, streak: num(d.streak) },
    endless: { best: num(raw.endless?.best), days: num(raw.endless?.days) },
    totals: { harvested: num(t.harvested), sold: num(t.sold), earned: num(t.earned), orders: num(t.orders), shooed: num(t.shooed), byCrop: t.byCrop && typeof t.byCrop === 'object' ? { ...t.byCrop } : {} },
    bestSale: raw.bestSale && typeof raw.bestSale === 'object' ? raw.bestSale : null,
    stickers: Array.isArray(raw.stickers) ? raw.stickers.filter((id) => stickerOf(id)) : [],
    tips: raw.tips && typeof raw.tips === 'object' ? { ...raw.tips } : {},
  };
}
export const totalStars = (save) => SEASONS.reduce((n, s) => n + (save.seasons[s.id]?.stars || 0), 0);
export const seasonOpen = (save, id) => { const i = SEASONS.findIndex((s) => s.id === id); return i <= 0 || (save.seasons[SEASONS[i - 1].id]?.stars || 0) > 0; };
export const endlessOpen = (save) => (save.seasons.q1?.stars || 0) > 0;
// the season the Play button starts: the first without a star, else the first not at three, else the last
export function nextSeason(save) {
  return (SEASONS.find((s) => !(save.seasons[s.id]?.stars > 0)) || SEASONS.find((s) => (save.seasons[s.id]?.stars || 0) < 3) || SEASONS[SEASONS.length - 1]).id;
}

// A run's result into the save. `run`: { mode, season, key, gold, days, stats, bestSale }
export function applyRun(old, run) {
  const save = load(JSON.parse(JSON.stringify(old)));
  const st = run.stats || {};
  let stars = 0, isBest = false;
  if (run.mode === 'season') {
    const s = seasonOf(run.season);
    stars = starsFor(s, run.gold);
    const x = save.seasons[run.season] || { stars: 0, best: 0, played: 0 };
    isBest = run.gold > x.best;
    save.seasons[run.season] = { stars: Math.max(x.stars, stars), best: Math.max(x.best, Math.round(run.gold)), played: x.played + 1 };
  } else if (run.mode === 'daily') {
    const d = save.daily;
    if (d.key !== run.key) { d.streak = d.last === dayBefore(run.key) ? d.streak + 1 : 1; d.key = run.key; d.best = 0; }
    isBest = run.gold > d.best;
    d.best = Math.max(d.best, Math.round(run.gold)); d.last = run.key;
  } else if (run.mode === 'endless') {
    isBest = run.gold > save.endless.best;
    save.endless.best = Math.max(save.endless.best, Math.round(run.gold)); save.endless.days = Math.max(save.endless.days, run.days || 0);
  }
  const t = save.totals;
  t.harvested += st.harvested || 0; t.sold += st.sold || 0; t.earned += Math.round(st.earned || 0); t.orders += st.orders || 0; t.shooed += st.shooed || 0;
  for (const [k, v] of Object.entries(st.byCrop || {})) t.byCrop[k] = (t.byCrop[k] || 0) + v;
  if (st.bestSale && (!save.bestSale || st.bestSale.ratio > save.bestSale.ratio)) save.bestSale = { crop: st.bestSale.crop, ratio: Math.round(st.bestSale.ratio * 100) / 100 };
  // stickers
  const got = new Set(save.stickers), add = [];
  const give = (id, ok) => { if (ok && !got.has(id)) { got.add(id); add.push(stickerOf(id)); } };
  give('first', (st.harvested || 0) > 0);
  give('bumper', (st.bumpers || 0) >= 15);
  give('spike', (st.bestRatio || 0) >= 2);
  give('top', (st.bestRatio || 0) >= 2.8);
  give('shoo', (st.shooed || 0) > 0);
  give('bull', (st.bullSold || 0) >= 150);
  give('orders', (st.orders || 0) >= 3);
  give('clean', run.mode !== 'endless' && (st.harvested || 0) > 20 && !st.rotten && !st.eaten);
  give('land', (run.open || 0) >= 25);
  give('rich', run.mode === 'season' && run.gold >= 5000);
  give('perfect', Object.values(save.seasons).some((x) => x.stars >= 3));
  give('year', SEASONS.every((s) => (save.seasons[s.id]?.stars || 0) > 0));
  give('daily', save.daily.streak >= 3);
  give('chips', (t.byCrop.nvda || 0) >= 30);
  save.stickers = [...got];
  return { save, stars, isBest, newStickers: add };
}
