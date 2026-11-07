// SINGULARITY (2026-11-08): the rules of the economy, pure (no DOM, no clock, no dice of its own: whoever calls passes
// the time step and the rolls). The game (./game.js), its demo (./demo.js), the balance simulator
// (tools/games/singularity/sim.mjs) and tests/singularity.test.js all play by these.
//
// A mind (`s`): FLOPs to spend, FLOPs made this run and ever, the machines owned, upgrades installed, Insight found and
// spent on perks, singularities, a Frenzy's seconds left and a few counters. `rates(s)` turns it into FLOPs/s, what a
// tap is worth and the bonuses in play; call it again after anything changes.
import {
  GENS, N, GROWTH, MILESTONES, UPGRADES, UPGRADE_BY_ID, SING_AT, INSIGHT_BONUS, PERK_BY_ID, WARM_START, EUREKA, AWAY,
  STAGES,
} from './data.js';
import { LOG } from './lines.js';

const LN_G = Math.log(GROWTH);

export function newMind() {
  return {
    flops: 0, run: 0, all: 0,
    owned: new Array(N).fill(0),
    up: new Set(),
    insight: 0, spent: 0, perks: new Set(), sing: 0,
    frenzy: 0, frenzyMax: 0,
    taps: 0, tapsAll: 0, eurekas: 0,
    best: 0, time: 0, runTime: 0,
    seen: 0,                // her log lines already read
    firsts: new Set(),      // the machines ever built (her first-machine lines, once)
    stage: 0,               // the core's form already celebrated this run
    ready: false,           // the singularity's opening already announced this run
    nextEureka: EUREKA.first,
  };
}

// ---------- milestones: ×2 at 10, 25, 50, 100, 150, 200… of a machine ----------
export function milestones(owned) {
  let m = 0;
  for (const t of MILESTONES) { if (owned >= t) m++; else break; }
  return m;
}
// the milestone a line is working toward: { prev, next } (next null once past the last one)
export function milestoneSpan(owned) {
  let prev = 0;
  for (const t of MILESTONES) { if (owned < t) return { prev, next: t }; prev = t; }
  return { prev, next: null };
}

// ---------- costs: each machine needs GROWTH × more than the one before ----------
export const costX = (s) => (s.perks.has('takeoff') ? 0.9 : 1);
// the FLOPs `n` more of machine k need, with `owned` already built: a geometric series
export function genCost(k, owned, n = 1, cx = 1) {
  if (n <= 0) return 0;
  const first = GENS[k].cost * cx * GROWTH ** owned;
  return n === 1 ? first : first * (GROWTH ** n - 1) / (GROWTH - 1);
}
// how many of machine k `flops` can build right now
export function maxCount(k, owned, flops, cx = 1) {
  const first = GENS[k].cost * cx * GROWTH ** owned;
  if (!(flops >= first)) return 0;
  let n = Math.floor(Math.log(flops * (GROWTH - 1) / first + 1) / LN_G);
  if (!Number.isFinite(n) || n < 1) n = 1;
  while (n > 1 && genCost(k, owned, n, cx) > flops) n--;
  while (genCost(k, owned, n + 1, cx) <= flops) n++;
  return n;
}
// what one press of a machine's row does with the chosen amount (1, 10, 100 or 'max'):
// { n, cost, ok } (with 'max' and nothing affordable: the cost of one, not ok)
export function plan(s, k, amount) {
  const cx = costX(s);
  if (amount === 'max') {
    const n = maxCount(k, s.owned[k], s.flops, cx);
    if (n < 1) return { n: 1, cost: genCost(k, s.owned[k], 1, cx), ok: false };
    return { n, cost: genCost(k, s.owned[k], n, cx), ok: true };
  }
  const n = Math.max(1, Math.floor(Number(amount) || 1));
  const cost = genCost(k, s.owned[k], n, cx);
  return { n, cost, ok: s.flops >= cost };
}
export function build(s, k, amount = 1) {
  const p = plan(s, k, amount);
  if (!p.ok) return 0;
  s.flops = Math.max(0, s.flops - p.cost);
  s.owned[k] += p.n;
  return p.n;
}

// ---------- what a mind makes ----------
export function logCount(s) {
  let n = 0;
  for (const l of LOG) if (s.all >= l.at) n++; else break;
  return n;
}
export function rates(s) {
  const mult = new Float64Array(N).fill(1), syn = new Float64Array(N);
  let global = 1, tapX = 1, echo = 0, luck = 1, golden = 1;
  for (const id of s.up) {
    const u = UPGRADE_BY_ID[id];
    if (!u) continue;
    if (u.kind === 'tap') tapX *= u.x;
    else if (u.kind === 'echo') echo += u.x;
    else if (u.kind === 'gen') mult[u.gen] *= u.x;
    else if (u.kind === 'syn') syn[u.to] += u.x * s.owned[u.from];
    else if (u.kind === 'global') global *= u.x;
    else if (u.kind === 'luck') luck *= u.x;
    else if (u.kind === 'golden') golden *= u.x;
  }
  const P = s.perks;
  if (P.has('nature')) { tapX *= 10; echo += 0.02; }
  if (P.has('lucky')) luck *= 2;
  if (P.has('golden')) golden *= 2;
  const insightX = 1 + INSIGHT_BONUS * s.insight;
  const recallX = P.has('recall') ? 1 + 0.02 * logCount(s) : 1;
  const everything = global * insightX * recallX;
  const unit = new Float64Array(N), line = new Float64Array(N);
  let base = 0;
  for (let k = 0; k < N; k++) {
    unit[k] = GENS[k].rate * 2 ** milestones(s.owned[k]) * mult[k] * (1 + syn[k]) * everything;
    line[k] = unit[k] * s.owned[k];
    base += line[k];
  }
  const frenzyX = s.frenzy > 0 ? EUREKA.frenzy : 1;
  const total = base * frenzyX;
  return {
    unit, line, base, total, frenzyX,
    tap: tapX * insightX * recallX + echo * total, tapX, echo,
    everything, insightX, recallX, luck, golden, cx: costX(s),
  };
}

// time passes: production, the clocks, the Frenzy running out. → true when the Frenzy just ended (rates change)
export function tick(s, dt, r) {
  if (!(dt > 0)) return false;
  const made = r.total * dt;
  s.flops += made; s.run += made; s.all += made;
  s.time += dt; s.runTime += dt;
  if (r.total > s.best) s.best = r.total;
  if (s.frenzy > 0) {
    s.frenzy = Math.max(0, s.frenzy - dt);
    if (s.frenzy === 0) { s.frenzyMax = 0; return true; }
  }
  return false;
}
// a tap on the core → the FLOPs it made
export function tapCore(s, r) {
  const v = r.tap;
  s.flops += v; s.run += v; s.all += v;
  s.taps++; s.tapsAll++;
  return v;
}
// a token bucket: at most TAPS_PER_SECOND taps count each second, multi-touch included
export function tapGate(rate = 20) {
  let tokens = rate, last = null;
  return (now) => {
    if (last != null) tokens = Math.min(rate, tokens + (now - last) * rate);
    last = now;
    if (tokens < 1) return false;
    tokens -= 1;
    return true;
  };
}

// ---------- upgrades ----------
export function needMet(s, need) {
  if (!need) return true;
  if (need.run != null && s.run < need.run) return false;
  if (need.own) for (const [g, n] of need.own) if (s.owned[g] < n) return false;
  return true;
}
// 'owned' · 'ready' (shown, maybe not affordable yet) · 'hidden'
export function upgradeState(s, u) {
  if (s.up.has(u.id)) return 'owned';
  return needMet(s, u.need) ? 'ready' : 'hidden';
}
export const shownUpgrades = (s) => UPGRADES.filter((u) => upgradeState(s, u) === 'ready').sort((a, b) => a.cost - b.cost);
export function install(s, id) {
  const u = UPGRADE_BY_ID[id];
  if (!u || s.up.has(id) || !needMet(s, u.need) || s.flops < u.cost) return false;
  s.flops -= u.cost;
  s.up.add(id);
  return true;
}

// ---------- the singularity ----------
// Insight ever found, for FLOPs ever made: 10 at the first 1e15, then the square root (4× the FLOPs, 2× the Insight)
export const insightFor = (all) => (all >= SING_AT ? Math.floor(10 * Math.sqrt(all / SING_AT) + 1e-9) : 0);
export const insightGain = (s) => Math.max(0, insightFor(s.all) - s.insight);
export const canAscend = (s) => s.run >= SING_AT && insightGain(s) >= 1;
// FLOPs still to make before the singularity offers one more Insight
export function toNextInsight(s) {
  const target = Math.max(s.insight, insightFor(s.all)) + 1;
  const all = (target / 10) ** 2 * SING_AT;
  return Math.max(all - s.all, SING_AT - s.run, 0);
}
// the singularity: Insight found, this run starts over (Insight, perks, the log, the stats are kept). → Insight found
export function ascend(s) {
  if (!canAscend(s)) return 0;
  const gain = insightGain(s);
  s.insight += gain;
  s.sing++;
  s.flops = 0; s.run = 0; s.runTime = 0; s.taps = 0;
  s.owned.fill(0);
  if (!s.perks.has('total')) s.up.clear();
  s.frenzy = 0; s.frenzyMax = 0;
  s.stage = 0; s.ready = false;
  warmStart(s);
  return gain;
}
function warmStart(s) {
  if (!s.perks.has('warm')) return;
  WARM_START.forEach((n, k) => { s.owned[k] = Math.max(s.owned[k], n); });
}
export const insightLeft = (s) => s.insight - s.spent;
export function perkState(s, id) {
  const p = PERK_BY_ID[id];
  if (!p) return 'hidden';
  if (s.perks.has(id)) return 'owned';
  const open = !p.after.length || p.after.some((a) => s.perks.has(a));
  if (!open) return 'locked';
  return insightLeft(s) >= p.cost ? 'ready' : 'short';
}
export function learn(s, id) {
  if (perkState(s, id) !== 'ready') return false;
  s.perks.add(id);
  s.spent += PERK_BY_ID[id].cost;
  if (id === 'warm' && s.run === 0) warmStart(s);
  return true;
}

// ---------- while you were away ----------
export function awayGain(s, seconds, r) {
  const dream = s.perks.has('dream');
  const cap = dream ? AWAY.dreamCap : AWAY.cap;
  const pct = dream ? AWAY.dreamRate : AWAY.rate;
  const t = Math.max(0, Math.min(Number(seconds) || 0, cap));
  return { flops: r.base * pct * t, seconds: t, away: Math.max(0, Number(seconds) || 0), capped: seconds > cap, pct, cap };
}
export function applyAway(s, gain) {
  s.flops += gain.flops; s.run += gain.flops; s.all += gain.flops;
  // a Frenzy doesn't wait for you
  s.frenzy = Math.max(0, s.frenzy - gain.away);
  if (s.frenzy === 0) s.frenzyMax = 0;
  s.nextEureka = Math.max(3, s.nextEureka - gain.away);
}

// ---------- Eureka sparks ----------
// seconds until the next one (roll: 0..1)
export const eurekaGap = (r, roll) => (EUREKA.min + (EUREKA.max - EUREKA.min) * roll) / r.luck;
// caught: a Frenzy (×7 FLOPs for 30 s) or a lump (15 minutes of production). The first one ever is always a Frenzy.
export function catchEureka(s, r, roll, force = null) {
  s.eurekas++;
  const frenzy = force ? force === 'frenzy' : s.eurekas === 1 || roll < EUREKA.frenzyChance;
  if (frenzy) {
    const len = EUREKA.frenzyFor * r.golden;
    s.frenzy = Math.max(s.frenzy, len);
    s.frenzyMax = Math.max(s.frenzyMax, s.frenzy);
    return { kind: 'frenzy', seconds: len, x: EUREKA.frenzy };
  }
  const lump = Math.max(r.base * EUREKA.lumpFor, r.tap * 30, 15);
  s.flops += lump; s.run += lump; s.all += lump;
  return { kind: 'lump', flops: lump };
}

// ---------- the core's form ----------
export function stageOf(run) {
  let i = 0;
  while (i + 1 < STAGES.length && run >= STAGES[i + 1].at) i++;
  return i;
}
// 0..1 through the current form (by the log of FLOPs made), for the core to grow smoothly
export function stageProgress(run) {
  const i = stageOf(run);
  if (i === STAGES.length - 1) return 1;
  const a = Math.log10(Math.max(1, STAGES[i].at)), b = Math.log10(STAGES[i + 1].at);
  return Math.max(0, Math.min(1, (Math.log10(Math.max(1, run)) - a) / (b - a)));
}

// ---------- what to build next (the demo's AI and the simulator) ----------
// every option's payback: seconds to save up for it plus seconds for it to pay for itself
export function options(s, r, { tapsPerSecond = 0 } = {}) {
  const income = r.base + tapsPerSecond * r.tap;
  const out = [];
  const after = (fn) => { const t = clone(s); fn(t); const r2 = rates(t); return r2.base + tapsPerSecond * r2.tap; };
  for (let k = 0; k < N; k++) {
    if (k > 0 && s.owned[k - 1] === 0 && s.owned[k] === 0) break;       // one new kind of machine at a time
    const cost = genCost(k, s.owned[k], 1, r.cx);
    const gain = after((t) => { t.owned[k]++; }) - income;
    if (gain > 0) out.push({ type: 'gen', k, cost, gain, score: Math.max(0, cost - s.flops) / Math.max(income, 1e-9) + cost / gain });
  }
  for (const u of UPGRADES) {
    if (upgradeState(s, u) !== 'ready') continue;
    const gain = after((t) => { t.up.add(u.id); }) - income;
    const bonus = u.kind === 'luck' || u.kind === 'golden' ? income * 0.15 : 0;
    if (gain + bonus > 0) out.push({ type: 'up', id: u.id, cost: u.cost, gain: gain + bonus, score: Math.max(0, u.cost - s.flops) / Math.max(income, 1e-9) + u.cost / (gain + bonus) });
  }
  return out.sort((a, b) => a.score - b.score);
}
export function clone(s) {
  return { ...s, owned: s.owned.slice(), up: new Set(s.up), perks: new Set(s.perks), firsts: new Set(s.firsts) };
}
