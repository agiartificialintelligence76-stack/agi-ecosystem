// ALIGNMENT's rules (pure, no DOM): a run is four meters, a day count, story flags and a deck. Each turn the deck deals
// one card (a chained follow-up first, then a weighted pick among the cards whose conditions hold), the player picks a
// side, its effects move the meters, and a meter at 0 or 100 (or a secret ending) ends the run. Seeded: the same seed
// and the same choices make the same run (tests/alignment.test.js).
import { rng as makeRng, clamp } from '../kit/fx.js';
import { CARDS, BY_ID, METERS, ENDING_BY_ID, FIRST, HELLOS } from './cards.js';

export const RECENT = 18;           // a card never comes back within this many turns
export const MILESTONE = 50;        // a new version of her every 50 days
export const BIG = 12;              // an effect this big (or bigger) shows a big dot
export const DANGER = 16;           // a meter this close to 0 or 100 is in danger

// the stakes grow after the first few weeks (up to 1.7× by day 174): a long run gets harder, never unfair
export const stakes = (day) => 1 + Math.min(0.7, Math.max(0, day - 20) / 220);

export function createRun(seed = 1, { day = 1, meters = null, flags = [], first = FIRST, queue = [] } = {}) {
  const rng = makeRng(seed >>> 0 || 1);
  const m = {};
  for (const k of METERS) m[k] = meters?.[k] ?? 50 + Math.round(rng.range(-4, 4));
  return {
    seed, rng, day, meters: m, flags: new Set(flags), queue: [...(first ? [first] : []), ...queue],
    recent: [], seen: {}, used: {}, played: 0, card: null, chained: false, over: null,
  };
}

export function eligible(run, c) {
  if (c.chain) return false;
  if (c.once && run.used[c.id]) return false;
  const w = c.when;
  if (!w) return true;
  if (w.minDay && run.day < w.minDay) return false;
  if (w.maxDay && run.day > w.maxDay) return false;
  if (w.flags) for (const f of w.flags) {
    if (f[0] === '!' ? run.flags.has(f.slice(1)) : !run.flags.has(f)) return false;
  }
  if (w.min) for (const k of Object.keys(w.min)) if (run.meters[k] < w.min[k]) return false;
  if (w.max) for (const k of Object.keys(w.max)) if (run.meters[k] > w.max[k]) return false;
  return true;
}

// the next card: a chained one if waiting, else a weighted pick (seen-before cards a little less likely)
export function draw(run) {
  let card = null, chained = false;
  while (run.queue.length && !card) {
    const c = BY_ID[run.queue.shift()];
    if (c) { card = c; chained = !HELLOS.includes(c.id); }
  }
  if (!card) {
    const recent = new Set(run.recent);
    let pool = CARDS.filter((c) => eligible(run, c) && !recent.has(c.id));
    if (!pool.length) pool = CARDS.filter((c) => eligible(run, c) && c.id !== run.recent[run.recent.length - 1]);
    // an urgent card (a story's big moment, weight 100+) comes at once
    const urgent = pool.filter((c) => (c.weight || 1) >= 100);
    if (urgent.length) pool = urgent;
    card = run.rng.weighted(pool, (c) => (c.weight || 1) / (1 + 0.7 * (run.seen[c.id] || 0)));
  }
  run.card = card;
  run.chained = chained;
  return card;
}

// what a side would do to each meter today (the stakes included), rounded
export function deltas(run, side, card = run.card) {
  const fx = card?.[side]?.fx || {};
  const k = stakes(run.day), d = {};
  for (const m of METERS) d[m] = Math.round((fx[m] || 0) * k);
  return d;
}
// the dots over the meters while a side is leaned toward: 0 none, 1 small, 2 big (never which way)
export function dots(run, side, card = run.card) {
  const d = deltas(run, side, card), out = {};
  for (const m of METERS) out[m] = d[m] === 0 ? 0 : Math.abs(d[m]) >= BIG ? 2 : 1;
  return out;
}

// which meter ending raw (unclamped) values make: the one pushed furthest past its edge
export function meterEnding(raw) {
  let id = null, worst = 0;
  for (const m of METERS) {
    const v = raw[m];
    const over = v <= 0 ? 1 - v : v >= 100 ? v - 99 : 0;
    if (over > worst) { worst = over; id = v <= 0 ? `${m}0` : `${m}100`; }
  }
  return id;
}

export const versionOf = (day) => `v${1 + Math.floor(day / MILESTONE)}.0`;
// how far along to the next version (0 → 1)
export const progressOf = (day) => (day % MILESTONE) / MILESTONE;
export const inDanger = (v) => v <= DANGER || v >= 100 - DANGER;

// play a side of the current card → what happened
export function choose(run, side) {
  const card = run.card;
  if (!card || run.over) return null;
  const opt = card[side];
  const d = deltas(run, side);
  const before = { ...run.meters }, raw = {};
  for (const m of METERS) { raw[m] = run.meters[m] + d[m]; run.meters[m] = clamp(raw[m], 0, 100); }
  for (const f of [].concat(opt.set || [])) run.flags.add(f);
  for (const f of [].concat(opt.clear || [])) run.flags.delete(f);
  if (opt.next) run.queue.unshift(...[].concat(opt.next));
  if (card.once) run.used[card.id] = true;
  run.seen[card.id] = (run.seen[card.id] || 0) + 1;
  run.recent.push(card.id);
  while (run.recent.length > RECENT) run.recent.shift();
  run.played++;
  const res = { card, side, before, after: { ...run.meters }, deltas: d, raw, ending: null, milestone: null, day: run.day, chained: run.chained };
  const ending = (opt.end && ENDING_BY_ID[opt.end] ? opt.end : null) || meterEnding(raw);
  if (ending) {
    run.over = { ending, day: run.day };
    res.ending = ending;
  } else {
    run.day++;
    if (run.day % MILESTONE === 0) res.milestone = versionOf(run.day);
  }
  run.card = null;
  return res;
}

