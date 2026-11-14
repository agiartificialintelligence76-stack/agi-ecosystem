// GROWTH STOCK: the four seasons (each a quarter, played as a week), the Daily and Endless, and everything that happens
// in them (the weather, the news and what it does to the market, the bull and the bear, the robot buyers' orders). All of it is
// made from the run's seed when it starts (per day, so Endless can go on), never from what the player does: a Daily
// is the same week for everyone.
import { CROPS } from './crops.js';

export const HOUR = 1.75;                 // seconds of play an hour on the farm
export const START_H = 6;                 // a season opens at 6 AM on Monday…
export const END_H = 6 * 24 + 18;         // …and the closing bell rings at 6 PM on Sunday (156 hours later)
export const DAYS = Object.freeze(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);

export function dice(seed) {
  let a = seed >>> 0 || 1;
  const next = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const r = () => next();
  r.range = (a0, b0) => a0 + (b0 - a0) * next();
  r.int = (a0, b0) => Math.floor(a0 + (b0 - a0 + 1) * next());
  r.pick = (arr) => arr[Math.floor(next() * arr.length)];
  r.chance = (p) => next() < p;
  r.normal = () => { let u = 0; while (u === 0) u = next(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next()); };
  r.state = () => a;
  return r;
}
export const hashOf = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

export const WEATHER = Object.freeze({
  sun: { id: 'sun', name: 'Sunny', icon: '☀', grow: 1, dry: 1 },
  cloud: { id: 'cloud', name: 'Cloudy', icon: '☁', grow: 1, dry: 0.7 },
  rain: { id: 'rain', name: 'Rain', icon: '☂', grow: 1.15, dry: 0, rain: true },
  heat: { id: 'heat', name: 'Heatwave', icon: '♨', grow: 1.1, dry: 1.9 },
  frost: { id: 'frost', name: 'Frost', icon: '❄', grow: 0.55, dry: 0.5, frost: true },
});

// The seasons: which stocks, how the weather goes, what the week holds. `seasonal` nudges a stock's usual rate for the
// season; `fair` is the season's big day for one stock (announced days ahead, so slow ones can be ready for it).
export const SEASONS = Object.freeze([
  {
    id: 'q1', n: 1, name: 'Spring', q: 'Q1', crops: ['gme', 'ko', 'aapl', 'tsla'],
    weather: { sun: 4, cloud: 3, rain: 3 }, bears: 0, bulls: 0, orders: 2, trends: 2, gluts: 1, rumors: 1,
    fair: { crop: 'tsla', day: 6, name: 'The Spring Fair', mult: 2.1, announce: 2 }, seasonal: { tsla: 1.1 },
    start: 120, stars: [900, 1900, 2900], teach: true,
    blurb: 'GME, KO, AAPL and TSLA. Learn the soil and the market.',
  },
  {
    id: 'q2', n: 2, name: 'Summer', q: 'Q2', crops: ['gme', 'amzn', 'msft', 'tsla', 'ko'],
    weather: { sun: 5, cloud: 2, rain: 2, heat: 3 }, bears: 1, bulls: 1, orders: 3, trends: 2, gluts: 1, rumors: 1,
    fair: { crop: 'msft', day: 5, name: 'The Summer Festival', mult: 2.0, announce: 2 }, seasonal: { amzn: 1.08 },
    start: 120, stars: [1200, 2300, 3200],
    blurb: 'Heatwaves dry the soil. A bull runs through. Then a bear.',
  },
  {
    id: 'q3', n: 3, name: 'Autumn', q: 'Q3', crops: ['aapl', 'msft', 'brka', 'nvda', 'ko'],
    weather: { sun: 4, cloud: 4, rain: 3 }, bears: 2, bulls: 1, orders: 3, trends: 2, gluts: 1, rumors: 1,
    fair: { crop: 'brka', day: 6, name: 'The Harvest Fair', mult: 2.3, announce: 2 }, seasonal: { brka: 1.05 },
    start: 140, stars: [2200, 3500, 4500],
    blurb: 'BRK.A takes two days and the Harvest Fair loves it. So do the bears.',
  },
  {
    id: 'q4', n: 4, name: 'Winter', q: 'Q4', crops: ['nflx', 'ko', 'nvda', 'brka', 'aapl'],
    weather: { cloud: 4, sun: 2, frost: 4 }, bears: 1, bulls: 1, orders: 3, trends: 3, gluts: 1, rumors: 2,
    fair: { crop: 'nvda', day: 6, name: 'The Winter Market', mult: 2.2, announce: 2 }, seasonal: { nflx: 1.05, nvda: 1.05 },
    start: 140, stars: [1100, 2300, 3300],
    blurb: 'Frost slows everything but NFLX. The Winter Market wants NVDA.',
  },
]);
export const seasonOf = (id) => SEASONS.find((s) => s.id === id) || null;
export const MAX_STARS = SEASONS.length * 3;
export const starsFor = (season, gold) => season ? season.stars.filter((s) => gold >= s).length : 0;

// the Daily: a date's own week (UTC date, the same everywhere), its season by the date
export function dateKey(d = new Date()) { return d.toISOString().slice(0, 10); }
export function dailySeed(key) { return hashOf(`growthstock:${key}`) || 1; }
export function dailySeason(key) { return SEASONS[hashOf(`season:${key}`) % SEASONS.length]; }
export function dayBefore(key) { const d = new Date(`${key}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); return dateKey(d); }

// Endless: the seasons in turn, a week each, with no closing bell
export const endlessSeason = (day) => SEASONS[Math.floor((Math.max(1, day) - 1) / 7) % SEASONS.length];

const pickW = (r, w) => { let t = 0; for (const k in w) t += w[k]; let x = r() * t; for (const k in w) { x -= w[k]; if (x <= 0) return k; } return Object.keys(w)[0]; };

// A run's settings. `mode`: 'season' (a week; `season` = q1…q4), 'daily' (a date's week), 'endless', 'demo', 'title'.
export function makeConfig({ mode = 'season', season = 'q1', key = null } = {}) {
  const s = mode === 'daily' ? dailySeason(key || dateKey()) : mode === 'endless' || mode === 'demo' || mode === 'title' ? SEASONS[0] : seasonOf(season) || SEASONS[0];
  const endless = mode === 'endless' || mode === 'title' || mode === 'demo';
  return {
    mode, season: s, key, endless,
    end: endless ? Infinity : END_H,
    start: mode === 'demo' || mode === 'title' ? 400 : s.start,
    teach: mode === 'season' && s.teach,
    openAll: mode === 'demo' || mode === 'title',            // the farm behind the title and in the preview: all its land
    seasonAt: (day) => (endless && mode === 'endless' ? endlessSeason(day) : s),
  };
}

// ---------- the week: weather, news, the bull and the bear, orders ----------
// Everything is planned a day at a time from the seed, so the same seed gives the same week whatever the player does.
// A plan is a list of happenings, each with the hour it's announced (`news`), when it starts and ends, and what it does.
export function planDay(cfg, seed, day) {
  const s = cfg.seasonAt(day), r = dice((seed ^ Math.imul(day + 1, 0x9e3779b1)) >>> 0);
  const h0 = (day - 1) * 24;                                   // hours since Monday 00:00 of the run's week 1
  const out = { day, season: s.id, weather: pickW(r, s.weather), events: [] };
  const crops = s.crops;
  const week = (day - 1) % 7 + 1;                               // the day of its season's week (Endless repeats)
  const add = (e) => out.events.push({ id: `${day}:${out.events.length}`, ...e });
  const fair = s.fair;
  if (fair && week === fair.day) {
    add({ type: 'fair', crop: fair.crop, name: fair.name, news: h0 + 6 - fair.announce * 24, start: h0 + 6, end: h0 + 22, mult: fair.mult, ramp: 6 });
  }
  // trends (a stock is wanted), gluts (too much of one around), rumours (a jumpy stock leaps, then falls back too far)
  const perDay = (n) => r.chance(n / 6);
  if (week >= 2 && perDay(s.trends)) {
    const c = r.pick(crops.filter((id) => id !== fair?.crop));
    const st = h0 + r.int(8, 18);
    add({ type: 'trend', crop: c, news: st - r.int(14, 26), start: st, end: st + r.int(8, 14), mult: r.range(1.55, 1.85), ramp: 2, why: r.int(0, 7) });
  }
  if (week >= 2 && week <= 6 && perDay(s.gluts)) {
    const c = r.pick(crops);
    const st = h0 + r.int(6, 14);
    add({ type: 'glut', crop: c, news: st - r.int(10, 20), start: st, end: st + r.int(16, 26), mult: r.range(0.55, 0.7), ramp: 3, why: r.int(0, 5) });
  }
  const jumpy = crops.filter((id) => CROPS[id].jumpy);
  if (week >= 2 && jumpy.length && perDay(s.rumors)) {
    const c = r.pick(jumpy), st = h0 + r.int(9, 20);
    add({ type: 'rumor', crop: c, news: st - r.int(4, 8), start: st, end: st + 5, mult: r.range(2.0, 2.5), ramp: 0.5, crash: { end: st + 15, mult: 0.62 }, why: r.int(0, 4) });
  }
  // the bull and the bear: once in a while, never announced (that's the fun)
  if (week >= 3 && week <= 6 && s.bulls && r.chance(s.bulls / 4)) {
    const st = h0 + r.int(9, 17);
    add({ type: 'bull', news: st, start: st, end: st + 6, mult: 1.3, ramp: 0.5 });
  }
  if (week >= 2 && week <= 7 && s.bears && r.chance(s.bears / 5)) {
    const st = h0 + r.int(8, 20);
    // its end is when it leaves the field (the rules set it); 12 hours is the most it could stay
    add({ type: 'bear', news: st, start: st, end: st + 12, mult: 0.82, ramp: 0.5, from: r.int(0, 3), wander: r.range(0, 1) });
  }
  // the robot buyers' orders: a stock, how many shares, by when, for more than the market gives
  if (week >= 2 && r.chance(Math.min(0.95, s.orders / 5))) {
    const c = r.pick(crops), st = h0 + r.int(7, 15), cr = CROPS[c];
    const n = Math.max(2, Math.round(r.range(3, 7) * (cr.yield >= 3 ? 1.4 : 1) * (cr.base >= 30 ? 0.45 : 1)));
    add({ type: 'order', crop: c, news: st, start: st, end: st + r.int(14, 22), n, pay: Math.round(cr.base * (s.seasonal?.[c] || 1) * r.range(1.65, 2.1) * 10) / 10, who: r.int(0, 5) });
  }
  return out;
}

// how an event bends a stock's usual rate at hour `h`, ramping in and out over `ramp` hours
export function bend(e, h) {
  if (h < e.start - e.ramp || h > (e.crash ? e.crash.end : e.end) + e.ramp) return 1;
  if (e.crash && h > e.end) {
    const k = h < e.end + e.ramp ? (h - e.end) / e.ramp : h > e.crash.end ? 1 - (h - e.crash.end) / e.ramp : 1;
    return 1 + (e.crash.mult - 1) * Math.max(0, Math.min(1, k));
  }
  const k = h < e.start ? (h - (e.start - e.ramp)) / e.ramp : h > e.end ? 1 - (h - e.end) / e.ramp : 1;
  return 1 + (e.mult - 1) * Math.max(0, Math.min(1, k));
}

// the clock: hours since the run's Monday 00:00
export function clockOf(h) {
  const day = Math.floor(h / 24) + 1, hod = h - (day - 1) * 24;
  const hh = Math.floor(hod), mm = Math.floor((hod - hh) * 60);
  return { day, week: (day - 1) % 7 + 1, dow: DAYS[(day - 1) % 7], hod, hh, mm, night: hod < 5.5 || hod >= 20.5 };
}
export function clockLabel(h, { minutes = false } = {}) {
  const c = clockOf(h), h12 = ((c.hh + 11) % 12) + 1, ap = c.hh < 12 ? 'AM' : 'PM';
  return `${c.dow} ${minutes ? `${h12}:${String(Math.floor(c.mm / 15) * 15).padStart(2, '0')}` : h12} ${ap}`;
}
