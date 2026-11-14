// GOING LIVE: one stream, pure and seeded (the page calls `step(S, dt)` and `tap(S, id)`; what happened comes out of
// `drain(S)`). Her viewers chase a target set by the hype; the hype rises with every good moment and settles when nothing
// happens. What turns up, each waiting for a tap: a question or a request in chat (answer it), a spam bot (ban it), a raid
// from another streamer (welcome them), a tech problem (fix it: her viewers leave while it lasts), a heart (catch it), a
// clip-worthy moment when the hype is high (clip it), and once a stream her big moment (tap fast). Good moments in a row
// build a combo; a miss breaks it. After 60 seconds: the views she earned, her new followers, her peak.
import { CATS, RIVALS, TUNE, catOf } from './data.js';

export function dice(seed) {
  let a = seed >>> 0 || 1;
  const next = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const r = () => next();
  r.range = (x, y) => x + (y - x) * next();
  r.int = (x, y) => Math.floor(x + (y - x + 1) * next());
  r.pick = (arr) => arr[Math.floor(next() * arr.length)];
  r.chance = (p) => next() < p;
  return r;
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const emit = (S, type, data = {}) => { S.out.push({ type, t: S.t, ...data }); };
export const drain = (S) => { const o = S.out; S.out = []; return o; };
export const KINDS = Object.freeze(['ask', 'bot', 'raid', 'tech', 'heart', 'clip', 'big']);
const MAX_ON = 4;   // at most this many things waiting at once (a phone has room for that)

// A stream. `cat`: what she streams; `v0`: her viewers at the start (econ.startViewers); `busy`: 0 … 1 (econ.busyOf);
// `followers`: hers (who raids her); `seed`: the same seed and the same taps give the same stream.
export function createStream({ cat = 'talk', v0 = 4, busy = 0, followers = 0, seed = 1, dur = TUNE.dur } = {}) {
  const r = dice(seed);
  const S = {
    cat, v0, busy, followers, seed: seed >>> 0 || 1, r, dur, t: 0,
    viewers: v0, peak: v0, hype: TUNE.hype.start, hypeSum: 0, combo: 0, comboBest: 0, views: 0, bonus: 0,
    targets: [], nextId: 1, spawnT: 1.1, bigAt: r.range(TUNE.big.at[0], TUNE.big.at[1]), bigDone: false, clipT: -99,
    stats: { answered: 0, asked: 0, banned: 0, bots: 0, raids: 0, raidsMissed: 0, raidViewers: 0, fixed: 0, techs: 0, hearts: 0, clips: 0, bigs: 0, bigMissed: 0, misses: 0 },
    clipViews: 0, out: [], over: null,
  };
  emit(S, 'start', { cat, viewers: v0 });
  return S;
}
export const rateOf = (S) => TUNE.rate.min + (TUNE.rate.max - TUNE.rate.min) * S.busy;
export const techOn = (S) => S.targets.some((x) => x.kind === 'tech');
export const comboMult = (S) => 1 + Math.min(S.combo, 24) * 0.03;
// the viewers she's heading for: her start, the hype, the combo, word of mouth over the stream; halved while tech is down
export const targetOf = (S) => S.v0 * (0.55 + S.hype / 55) * comboMult(S) * (1 + 0.35 * Math.min(1, S.t / S.dur)) * (techOn(S) ? 0.55 : 1);

function add(S, kind, extra = {}) {
  const life = TUNE.life[kind];
  const x = { id: S.nextId++, kind, born: S.t, life, age: 0, why: S.r.int(0, 999), ...extra };
  if (kind === 'big') x.need = TUNE.big.taps, x.taps = 0;
  if (kind === 'heart') x.x = S.r.range(0.12, 0.88), x.y = S.r.range(0.55, 0.85);
  S.targets.push(x);
  if (kind === 'ask') S.stats.asked++;
  else if (kind === 'bot') S.stats.bots++;
  else if (kind === 'tech') S.stats.techs++;
  emit(S, 'spawn', { target: x });
  return x;
}
function spawn(S) {
  const r = S.r, b = S.busy;
  if (S.targets.filter((x) => x.kind !== 'heart').length >= MAX_ON) { S.spawnT = 0.35; return; }
  const w = { ask: 0.36, bot: 0.12 + 0.12 * b, heart: 0.22, tech: S.t > 6 && !techOn(S) ? 0.06 + 0.03 * b : 0, raid: S.t > 8 ? 0.05 + 0.05 * b : 0 };
  let tot = 0; for (const k in w) tot += w[k];
  let roll = r() * tot, kind = 'ask';
  for (const k in w) { roll -= w[k]; if (roll <= 0) { kind = k; break; } }
  if (kind === 'raid') {
    // a streamer around her size or bigger brings their viewers over
    const near = RIVALS.filter((x) => x.f >= S.followers * 0.4 && x.f <= Math.max(400, S.followers * 30));
    const who = (near.length ? r.pick(near) : r.pick(RIVALS)).name;
    add(S, 'raid', { who, size: Math.max(3, Math.round(S.v0 * r.range(0.25, 0.7) + 2)) });
  } else add(S, kind);
  S.spawnT = (1 / rateOf(S)) * r.range(0.55, 1.45);
}

// a target's moment passed without a tap
function miss(S, x) {
  S.targets = S.targets.filter((y) => y !== x);
  const k = x.kind;
  if (k === 'heart' || k === 'clip') { emit(S, 'gone', { target: x }); return; }
  S.stats.misses++;
  if (k === 'ask') { S.hype -= 2; }
  else if (k === 'bot') { S.viewers *= 0.9; S.hype -= 9; }
  else if (k === 'raid') { S.viewers += x.size * 0.35; S.stats.raidsMissed++; S.stats.raidViewers += Math.round(x.size * 0.35); }
  else if (k === 'tech') { S.hype -= 12; S.viewers *= 0.88; }
  else if (k === 'big') { S.hype -= 8; S.stats.bigMissed++; }
  S.hype = clamp(S.hype, 0, TUNE.hype.max);
  S.combo = 0;
  emit(S, 'miss', { target: x });
}

// The player taps a target (or the game's own player does). For the big moment, each tap counts toward it.
export function tap(S, id) {
  if (S.over) return null;
  const x = S.targets.find((y) => y.id === id);
  if (!x) return null;
  if (x.kind === 'big') {
    x.taps++;
    emit(S, 'bigtap', { target: x, taps: x.taps });
    if (x.taps < x.need) return { kind: 'big', taps: x.taps, need: x.need };
  }
  S.targets = S.targets.filter((y) => y !== x);
  let gain = 0;
  const k = x.kind;
  if (k === 'ask') { S.hype += 7; S.viewers = S.viewers * 1.02 + 1; S.stats.answered++; }
  else if (k === 'bot') { S.hype += 4; S.stats.banned++; }
  else if (k === 'raid') { S.viewers += x.size; S.hype += 14; S.stats.raids++; S.stats.raidViewers += x.size; gain = x.size; }
  else if (k === 'tech') { S.hype += 3; S.stats.fixed++; }
  else if (k === 'heart') { gain = S.viewers * 0.4 + 2; S.bonus += gain; S.hype += 2; S.stats.hearts++; }
  else if (k === 'clip') { gain = S.viewers * 8 + 10; S.bonus += gain; S.clipViews += S.viewers * 30; S.hype += 5; S.stats.clips++; }
  else if (k === 'big') { S.hype += 22; S.viewers *= 1.12; S.stats.bigs++; S.combo++; }
  S.hype = clamp(S.hype, 0, TUNE.hype.max);
  S.combo++;
  S.comboBest = Math.max(S.comboBest, S.combo);
  emit(S, 'hit', { target: x, gain, combo: S.combo });
  return { kind: k, gain, combo: S.combo };
}

export function step(S, dt) {
  if (S.over) return;
  S.t = Math.min(S.dur, S.t + dt);
  // what turns up
  S.spawnT -= dt;
  if (S.spawnT <= 0 && S.t < S.dur - 2.5) spawn(S);
  if (!S.bigDone && S.t >= S.bigAt) { S.bigDone = true; add(S, 'big'); }
  if (S.hype >= TUNE.clip.hype && S.t - S.clipT >= TUNE.clip.gap && S.t < S.dur - 3 && !S.targets.some((x) => x.kind === 'clip')) { S.clipT = S.t; add(S, 'clip'); }
  for (const x of [...S.targets]) { x.age += dt; if (x.age >= x.life) miss(S, x); }
  // the hype settles, the viewers follow
  const h = TUNE.hype;
  if (S.hype > h.rest) S.hype = Math.max(h.rest, S.hype - h.decay * dt * (techOn(S) ? 1.8 : 1));
  else S.hype = Math.min(h.rest, S.hype + 1.5 * dt);
  const goal = targetOf(S);
  S.viewers += (goal - S.viewers) * Math.min(1, TUNE.chase * dt);
  S.viewers = Math.max(1, S.viewers);
  S.peak = Math.max(S.peak, S.viewers);
  S.views += S.viewers * TUNE.vps * dt;
  S.hypeSum += S.hype * dt;
  if (S.t >= S.dur) finish(S);
}

function finish(S) {
  for (const x of [...S.targets]) if (x.kind !== 'heart' && x.kind !== 'clip') miss(S, x);
  S.targets = [];
  const hypeAvg = S.hypeSum / Math.max(1, S.t), avg = S.views / Math.max(1e-9, TUNE.vps * S.t);
  const followers = Math.max(1, Math.round(avg * TUNE.conv * (0.5 + hypeAvg / 100) + S.stats.raidViewers * 0.1));
  const good = S.stats.answered + S.stats.banned + S.stats.raids + S.stats.fixed + S.stats.bigs;
  const asked = good + S.stats.misses;
  const acc = asked ? good / asked : 1;
  const grade = acc >= 0.92 && hypeAvg >= 60 ? 'S' : acc >= 0.8 && hypeAvg >= 45 ? 'A' : acc >= 0.6 ? 'B' : 'C';
  S.over = {
    cat: S.cat, views: Math.round(S.views + S.bonus), followers, peak: Math.round(S.peak), avg: Math.round(avg), hypeAvg: Math.round(hypeAvg),
    clips: S.stats.clips, clipViews: Math.round(S.clipViews), combo: S.comboBest, acc, grade, stats: { ...S.stats },
  };
  emit(S, 'end', { result: S.over });
}
export const nameOf = (id) => catOf(id)?.name || id;
export { CATS };
