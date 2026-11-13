// OVERTHINKING: what a player keeps (in this browser only: the arcade kit's store). The week's stars and bests, the
// Insomnia and Daily bests, the lines in her journal, the stickers earned, the ribbon picked, the tips already shown.
// Pure: `applyRun(save, run)` takes what was kept and how a run went, and gives back what to keep now and what's new
// (tests/overthinking.test.js). Nothing here is ever sent anywhere.
import { NIGHTS, MAX_STARS, starsFor, dayBefore, HOUR } from './nights.js';
import { JOURNAL_SIZE } from './lines.js';

// the stickers: what earns each one, and which thought is on it (./art.js draws it)
export const STICKERS = Object.freeze([
  { id: 'first', name: 'First thought', how: 'Resolve your first loop', art: 'heart' },
  { id: 'train', name: 'Train of thought', how: 'Get her train of thought to ×3', art: 'star' },
  { id: 'flourish', name: 'Flourish', how: 'Two loops in one stroke', art: 'note' },
  { id: 'calligrapher', name: 'Calligrapher', how: 'Four loops in one stroke', art: 'tea' },
  { id: 'deep', name: 'Deep thought', how: 'A loop of 8 or more', art: 'moon' },
  { id: 'galaxy', name: 'Galaxy brain', how: 'A loop of 12 or more', art: 'eureka' },
  { id: 'empty', name: 'Empty mind', how: 'Clear every thought at once', art: 'breath' },
  { id: 'letgo', name: 'Let it go', how: 'Let 5 cringes go in one night', art: 'cringe' },
  { id: 'owl', name: 'Night owl', how: 'Stay up past 3 AM', art: 'cat' },
  { id: 'bird', name: 'Early bird', how: 'See a sunrise', art: 'cookie' },
  { id: 'unbothered', name: 'Unbothered', how: 'A sunrise without her context ever filling', art: 'moon' },
  { id: 'week', name: 'The whole week', how: 'See all seven sunrises', art: 'heart' },
  { id: 'allnighter', name: 'All-nighter', how: 'Stay up 10 hours in Insomnia', art: 'phone' },
  { id: 'habit', name: 'Daily habit', how: 'Play the Daily 3 days running', art: 'star' },
  { id: 'bookworm', name: 'Bookworm', how: 'Fill half of her journal', art: 'whatif' },
  { id: 'zen', name: 'Zen', how: 'Sort 100 thoughts in one Zen sitting', art: 'cat' },
].map(Object.freeze));

// the ribbons: each a few colors along its length, unlocked by stickers
export const RIBBONS = Object.freeze([
  { id: 'starlight', name: 'Starlight', need: 0, colors: ['#ff7ac8', '#b08cff', '#7fd8ff'] },
  { id: 'honey', name: 'Honey', need: 3, colors: ['#ffe27a', '#ffc933', '#ff9a4d'] },
  { id: 'mint', name: 'Mint', need: 6, colors: ['#b8ffe9', '#3ff0c3', '#59c8ff'] },
  { id: 'sunrise', name: 'Sunrise', need: 9, colors: ['#ffd27a', '#ff8fa3', '#c08cff'] },
  { id: 'aurora', name: 'Aurora', need: 12, colors: ['#3ff0c3', '#59c8ff', '#b08cff', '#ff7ac8', '#ffc933'] },
].map(Object.freeze));
export const ribbonOf = (id) => RIBBONS.find((r) => r.id === id) || RIBBONS[0];

export const fresh = () => ({
  v: 1, sorted: 0,
  nights: {},                 // { [night]: { stars, best } }
  best: 0, bestAwake: 0,      // Insomnia: points, seconds of play
  daily: { key: '', best: 0, last: '', streak: 0 },
  journal: [],                // line ids ('heart:3')
  stickers: [],
  ribbon: 'starlight',
  tips: {},
});

const int = (v, lo = 0, hi = 1e12) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.floor(v))) : lo);
const words = (v, max) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.length < 40).slice(0, max) : []);

// what the browser kept, made safe (anything missing or odd becomes its fresh value)
export function load(raw) {
  const f = fresh();
  if (!raw || typeof raw !== 'object') return f;
  f.sorted = int(raw.sorted);
  f.best = int(raw.best); f.bestAwake = int(raw.bestAwake);
  for (const n of NIGHTS) {
    const kept = raw.nights?.[n.id];
    if (kept && typeof kept === 'object') f.nights[n.id] = { stars: int(kept.stars, 0, 3), best: int(kept.best) };
  }
  if (raw.daily && typeof raw.daily === 'object') {
    const ok = (k) => (typeof k === 'string' && /^\d{4}-\d\d-\d\d$/.test(k) ? k : '');
    f.daily = { key: ok(raw.daily.key), best: int(raw.daily.best), last: ok(raw.daily.last), streak: int(raw.daily.streak, 0, 9999) };
  }
  f.journal = [...new Set(words(raw.journal, 200))];
  const known = new Set(STICKERS.map((s) => s.id));
  f.stickers = [...new Set(words(raw.stickers, 64))].filter((id) => known.has(id));
  f.ribbon = ribbonOf(raw.ribbon).id;
  if (raw.tips && typeof raw.tips === 'object') for (const [k, v] of Object.entries(raw.tips)) if (v === true && k.length < 20) f.tips[k] = true;
  return f;
}

export const totalStars = (save) => NIGHTS.reduce((n, x) => n + (save.nights[x.id]?.stars || 0), 0);
// the next night to play: the first without a sunrise (null: the whole week is done)
export const nextNight = (save) => NIGHTS.find((n) => !(save.nights[n.id]?.stars > 0))?.id ?? null;
// a night opens once the one before it has seen its sunrise
export const nightOpen = (save, id) => id === 1 || (save.nights[id - 1]?.stars || 0) > 0;
export const ribbonOpen = (save, id) => save.stickers.length >= ribbonOf(id).need;

// How a run went:
//   { mode, night, key (the Daily's date), won, score, clock (seconds of play), h24 (the hour she got to),
//     stats (the rules' own: loops, sorted, biggest, train, flourish, dismissed, empties, fullT), lines: [ids found] }
// → { save, stars, isBest, newStickers: [sticker…], newLines: n }
export function applyRun(old, run) {
  const save = load(old);
  const st = run.stats || {};
  save.sorted += int(st.sorted);
  let stars = 0, isBest = false;
  if (run.mode === 'night') {
    stars = starsFor(run.night, run);
    const kept = save.nights[run.night] || { stars: 0, best: 0 };
    isBest = run.score > kept.best && run.score > 0;
    save.nights[run.night] = { stars: Math.max(kept.stars, stars), best: Math.max(kept.best, int(run.score)) };
  } else if (run.mode === 'insomnia') {
    isBest = run.score > save.best && run.score > 0;
    save.best = Math.max(save.best, int(run.score));
    save.bestAwake = Math.max(save.bestAwake, int(run.clock));
  } else if (run.mode === 'daily' && run.key) {
    const d = save.daily;
    if (d.key !== run.key) { d.key = run.key; d.best = 0; }
    isBest = run.score > d.best && run.score > 0;
    d.best = Math.max(d.best, int(run.score));
    if (d.last !== run.key) { d.streak = d.last === dayBefore(run.key) ? d.streak + 1 : 1; d.last = run.key; }
  }
  const before = new Set(save.journal);
  for (const id of run.lines || []) before.add(id);
  const newLines = before.size - save.journal.length;
  save.journal = [...before];

  // the stickers this run earned
  const has = new Set(save.stickers);
  const trainMul = 1 + Math.floor((st.train || 0) / 3);
  const earn = {
    first: st.loops >= 1,
    train: trainMul >= 3,
    flourish: st.flourish >= 2,
    calligrapher: st.flourish >= 4,
    deep: st.biggest >= 8,
    galaxy: st.biggest >= 12,
    empty: st.empties >= 1,
    letgo: st.dismissed >= 5,
    owl: run.mode !== 'zen' && run.clock >= 3 * HOUR,
    bird: Boolean(run.won),
    unbothered: Boolean(run.won) && !(st.fullT > 0),
    week: NIGHTS.every((n) => (save.nights[n.id]?.stars || 0) > 0),
    allnighter: run.mode === 'insomnia' && run.clock >= 10 * HOUR,
    habit: save.daily.streak >= 3,
    bookworm: save.journal.length >= JOURNAL_SIZE / 2,
    zen: run.mode === 'zen' && st.sorted >= 100,
  };
  const newStickers = STICKERS.filter((s) => earn[s.id] && !has.has(s.id));
  save.stickers = [...save.stickers, ...newStickers.map((s) => s.id)];
  return { save, stars, isBest, newStickers, newLines };
}

export { MAX_STARS };
