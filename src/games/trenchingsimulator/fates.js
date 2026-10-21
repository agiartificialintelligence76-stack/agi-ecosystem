// TRENCHING SIMULATOR's fates (2026-10-20): what becomes of each coin, decided when it launches and played out by the
// engine (./engine.js). Most coins die (a dud), some are rugged by their dev and the wallets around them, some pump and
// dump on snipers and a caller, a few chop for a while, and a few run: they complete their bonding curve and keep going
// in their pool, and now and then one goes to the moon. Each fate is a plan: a path the market cap tends to (in
// multiples of its start, `pts`), how busy it is (`act`, trades a second), the wallets that act on it at their times
// (`events`: the dev, bundles, snipers, insiders, callers and their followers, smart wallets, whales), and what a
// player can read about it (`intel`: its dev's record, its socials), drawn differently for each fate so that reading a
// coin helps, never perfectly. Pure: read in Node too.
import { GRAD_M } from './curve.js';
import { KOLS, SMART_COUNT } from './names.js';

export const FATES = ['dud', 'rug', 'pumpdump', 'slow', 'runner', 'moon'];
export const ODDS = { dud: 0.47, rug: 0.18, pumpdump: 0.18, slow: 0.11, runner: 0.045, moon: 0.015 };
export const META_BOOST = 2.2; // a coin in the hot meta runs this many times more often
export const COPY_ODDS = { dud: 0.6, rug: 0.3, pumpdump: 0.1 };
export const CTO_ODDS = 0.02; // a dead coin its community takes over
export const PAST_GRAD = 15.5; // a target past graduation (so a runner completes its curve)

// The odds of each fate for a new coin: a hot meta's runs, a copy's odds
export function fateOdds({ hot = false, copy = false } = {}) {
  if (copy) return { ...COPY_ODDS };
  const o = { ...ODDS };
  if (hot) { o.runner *= META_BOOST; o.moon *= META_BOOST; }
  return o;
}

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const sortPts = (pts) => pts.sort((a, b) => a[0] - b[0]);

function kolFor(rng, wantHonest) {
  // honest-leaning plans pick callers who hold, dishonest ones callers who dump
  return rng.weighted(KOLS.map((k) => [k, wantHonest ? 0.15 + k.honest * (0.5 + k.skill) : 0.15 + (1 - k.honest) * 1.2]));
}

// How likely a smart wallet of quality `q` (0…1, its run's: see engine.js) is picked to buy a coin: good wallets mostly
// buy coins that run, bad ones mostly the ones that don't, and anyone can be on a slow one. Never certain either way, so
// a wallet's record helps a player, never perfectly.
export const smartWeight = (q, kind) => (kind === 'good' ? 0.4 + 1.5 * q * q : kind === 'bad' ? 0.4 + 1.5 * (1 - q) * (1 - q) : 1);
const EVEN = Object.freeze(Array.from({ length: SMART_COUNT }, () => 0.5));

// A smart wallet's last 7 days, before the run: what the smart-money board shows from its first second. Its trades are
// drawn the way its picks are on the run (`smartWeight`: a share of coins that run, the rest the ones that don't), so its
// record says something about it, with a week of trades' noise: a lucky wallet can look better than it is, and a good one
// can have a bad week. `rng` is the wallet's own stream.
export function smartHistory(rng, q) {
  const qw = clamp(q + rng.normal() * 0.22, 0.02, 0.98); // its week's form: better or worse than it is now
  // a run's smart buys a minute: about 0.95 on coins that run and 3.8 on ones that don't, shared by weight (0.9 a wallet
  // on average), and 0.7 on slow ones, shared evenly
  const g = (0.95 * smartWeight(qw, 'good')) / (0.9 * SMART_COUNT);
  const b = (3.8 * smartWeight(qw, 'bad')) / (0.9 * SMART_COUNT);
  const pRun = g / (g + b + 0.7 / SMART_COUNT);
  const trades = rng.between(25, 140);
  let won = 0;
  let vol = 0;
  let pnl = 0;
  for (let i = 0; i < trades; i++) {
    const size = clamp(rng.logn(1.2, 0.6), 0.05, 20);
    const run = rng.chance(pRun);
    const win = rng.chance(run ? 0.85 : 0.25);
    const x = win ? (run ? rng.logn(2.2, 0.5) : rng.logn(1.4, 0.25)) : run ? rng.logn(0.6, 0.3) : rng.logn(0.35, 0.45);
    const mult = win ? Math.max(1.02, x) : Math.min(0.98, x);
    if (win) won++;
    vol += size;
    pnl += size * (mult - 1);
  }
  return { trades, won, lost: trades - won, vol, pnl };
}

// A plan for a coin of `fate`. `rng` is the coin's own stream; `ctx.smart` is each smart wallet's quality on this run
// (all the same when it's not given).
export function makePlan(rng, fate, ctx = {}) {
  const qs = Array.isArray(ctx.smart) && ctx.smart.length === SMART_COUNT ? ctx.smart : EVEN;
  const ev = [];
  const buy = (t, who, sol, tag) => ev.push({ t: Math.max(0, t), kind: 'buy', who, sol: clamp(sol, 0.01, 60), tag });
  const sell = (t, who, frac) => ev.push({ t: Math.max(0, t), kind: 'sell', who, frac: clamp(frac, 0.05, 1) });
  const flag = (t, what, extra) => ev.push({ t: Math.max(0, t), kind: 'flag', what, ...extra });
  const crowd = (t, n, median, over, tag) => {
    for (let i = 0; i < n; i++) buy(t + rng.exp(1) * over / 2.2, 'new', rng.logn(median, 0.9), tag);
  };
  const intel = { devCoins: 1, devMigrated: 0, socials: { x: false, tg: false, web: false } };
  const socials = (px, ptg, pweb) => {
    intel.socials = { x: rng.chance(px), tg: rng.chance(ptg), web: rng.chance(pweb) };
  };
  let pts;
  let act;
  let sigma = 0.1;
  let tau = 15;
  let dieAt;

  // the dev's own buy at launch, and the bundle in the same block
  const devBuy = (median) => buy(0, 'dev', rng.logn(median, 0.6), 'dev');
  const bundle = (n, total) => {
    const parts = Array.from({ length: n }, () => rng.range(0.4, 1.6));
    const sum = parts.reduce((a, b) => a + b, 0);
    parts.forEach((p, i) => buy(rng.range(0, 0.4), `b${i}`, (total * p) / sum, 'bundle'));
    return n;
  };
  const snipers = (n, median) => {
    for (let i = 0; i < n; i++) buy(rng.range(0.3, 2.5), `s${i}`, rng.logn(median, 0.6), 'sniper');
    return n;
  };
  const sniperDumps = (n, from, to, p, fracLo = 0.6) => {
    for (let i = 0; i < n; i++) if (rng.chance(p)) sell(rng.range(from, to), `s${i}`, rng.range(fracLo, 1));
  };
  // n smart wallets buy it (never one twice), each at its own time (`when()`), picked by their quality for `kind`
  const smarts = (n, when, median, kind) => {
    const used = new Set();
    const list = [];
    for (let i = 0; i < n; i++) {
      const pairs = [];
      for (let k = 0; k < SMART_COUNT; k++) if (!used.has(k)) pairs.push([k, smartWeight(qs[k], kind)]);
      const k = rng.weighted(pairs);
      used.add(k);
      const t = when();
      buy(t, `m${k}`, rng.logn(median, 0.6), 'smart');
      list.push({ k, t });
    }
    return list;
  };
  const kolCall = (t, honestish, n = 0) => {
    const k = kolFor(rng, honestish);
    const key = n ? `kol${n}` : 'kol';
    buy(t, key, rng.logn(3.5, 0.5), 'kol');
    ev[ev.length - 1].kol = k.id;
    const follow = clamp(Math.round((k.followers / 3500) * rng.range(0.6, 1.4)), 5, 90);
    crowd(t + rng.range(0.5, 3), follow, 0.25, rng.range(15, 50), 'follower');
    flag(t, 'kol', { kol: k.id, who: key });
    return { k, key };
  };

  switch (fate) {
    case 'dud': {
      devBuy(0.4);
      const ns = snipers(rng.between(0, 4), 0.35);
      if (rng.chance(0.15)) bundle(rng.between(1, 3), rng.range(0.5, 3));
      const peakT = rng.range(8, 40);
      const peak = rng.range(1.15, 1.9);
      dieAt = rng.range(60, 180);
      pts = [[0, 1], [peakT, peak], [Math.max(peakT + 5, Math.min(peakT + 30, dieAt * 0.7)), 1 + (peak - 1) * 0.4], [dieAt, rng.range(1, 1.12)]];
      act = [[0, rng.range(0.8, 2)], [peakT, rng.range(0.5, 1.2)], [dieAt * 0.7, rng.range(0.1, 0.3)], [dieAt, 0.02], [dieAt + 20, 0]];
      sniperDumps(ns, 5, 60, 0.8);
      if (rng.chance(0.5)) sell(rng.range(10, dieAt), 'dev', 1);
      // now and then a smart wallet or two tries it, and mostly gets out again at a loss
      if (rng.chance(0.28)) {
        for (const s of smarts(rng.between(1, 2), () => rng.range(3, 30), 0.6, 'bad')) {
          if (rng.chance(0.7)) sell(s.t + rng.range(12, 60), `m${s.k}`, rng.range(0.6, 1));
        }
      }
      sigma = 0.08; tau = 10;
      socials(0.25, 0.15, 0.1);
      intel.devCoins = rng.between(1, 40);
      intel.devMigrated = rng.chance(0.08) ? 1 : 0;
      break;
    }
    case 'rug': {
      devBuy(1);
      const nb = bundle(rng.between(4, 14), clamp(rng.logn(7, 0.6), 2, 30));
      const ni = rng.between(1, 5);
      for (let i = 0; i < ni; i++) buy(rng.range(1, 20), `i${i}`, rng.logn(1, 0.6), 'insider');
      snipers(rng.between(1, 6), 0.5);
      const big = rng.chance(0.3);
      const peak = big ? rng.range(3, 8) : rng.range(1.3, 2.5);
      const rugT = big ? rng.range(60, 200) : rng.range(25, 100);
      if (big && rng.chance(0.25)) kolCall(rng.range(rugT * 0.3, rugT * 0.7), false);
      dieAt = rugT + rng.range(40, 150);
      const after = Math.max(1.03, peak * rng.range(0.25, 0.5));
      pts = [[0, 1], [rugT * rng.range(0.5, 0.8), peak * rng.range(0.8, 1)], [rugT, peak], [rugT + 4, after], [rugT + 60, rng.range(1, 1.1)], [dieAt, 1.02]];
      act = [[0, rng.range(1.5, 3)], [rugT, rng.range(1.5, 3.5)], [rugT + 15, 0.6], [dieAt, 0.02], [dieAt + 20, 0]];
      // a smart wallet or two in early: a few get out just before it's pulled, the rest are rugged with everyone
      if (rng.chance(0.32)) {
        for (const s of smarts(rng.between(1, 2), () => rng.range(3, Math.max(6, rugT * 0.7)), 0.8, 'bad')) {
          if (rng.chance(0.3)) sell(Math.max(s.t + 2, rugT - rng.range(3, 15)), `m${s.k}`, 1);
          else if (rng.chance(0.5)) sell(rugT + rng.range(6, 60), `m${s.k}`, 1);
        }
      }
      sell(rugT, 'dev', 1);
      for (let i = 0; i < nb; i++) sell(rugT + rng.range(0, 2), `b${i}`, 1);
      for (let i = 0; i < ni; i++) sell(rugT + rng.range(0, 3), `i${i}`, 1);
      flag(rugT, 'rug');
      sigma = 0.1; tau = 15;
      socials(0.5, 0.35, 0.25);
      intel.devCoins = rng.between(5, 80);
      intel.devMigrated = 0;
      break;
    }
    case 'pumpdump': {
      devBuy(0.5);
      const ns = snipers(rng.between(5, 15), 0.8);
      if (rng.chance(0.3)) bundle(rng.between(1, 4), rng.range(1, 6));
      let peakT = rng.range(20, 70);
      const peak = rng.range(2, 5);
      if (rng.chance(0.6)) {
        const kt = rng.range(8, 40);
        const { key } = kolCall(kt, false);
        peakT = kt + rng.range(10, 30);
        sell(kt + rng.range(20, 90), key, 1);
      }
      dieAt = peakT + rng.range(60, 180);
      // the weaker smart wallets chase a pump on its way up: a few get out around its top, most far too late
      if (rng.chance(0.7)) {
        for (const s of smarts(rng.between(1, 3), () => rng.range(4, Math.max(8, peakT * 0.95)), 0.9, 'bad')) {
          if (rng.chance(0.3)) sell(Math.max(s.t + 3, peakT + rng.range(-15, 8)), `m${s.k}`, rng.range(0.7, 1));
          else sell(peakT + rng.range(25, 150), `m${s.k}`, 1);
        }
      }
      pts = [[0, 1], [peakT * 0.5, 1 + (peak - 1) * 0.5], [peakT, peak], [peakT + rng.range(30, 90), rng.range(1.2, 1.6)], [dieAt, rng.range(1.05, 1.25)]];
      act = [[0, rng.range(2, 4)], [peakT, rng.range(2, 4)], [peakT + 60, 0.6], [dieAt, 0.02], [dieAt + 20, 0]];
      sniperDumps(ns, peakT * 0.6, peakT + 60, 0.9);
      if (rng.chance(0.7)) sell(peakT + rng.range(-10, 30), 'dev', 1);
      sigma = 0.12; tau = 12;
      socials(0.5, 0.4, 0.3);
      intel.devCoins = rng.between(2, 50);
      intel.devMigrated = rng.chance(0.05) ? 1 : 0;
      break;
    }
    case 'slow': {
      devBuy(0.6);
      const ns = snipers(rng.between(1, 5), 0.5);
      let t = 0;
      let m = 1;
      pts = [[0, 1]];
      const n = rng.between(4, 8);
      for (let i = 0; i < n; i++) {
        t += rng.range(20, 50);
        m = clamp(m * Math.exp(rng.range(-0.45, 0.6)), 1.4, 4);
        pts.push([t, m]);
      }
      dieAt = Math.max(t + 120, rng.range(300, 420));
      pts.push([t + (dieAt - t) * 0.5, rng.range(1.3, 2)], [dieAt, rng.range(1.1, 1.5)]);
      act = [[0, rng.range(1, 2)], [30, rng.range(0.5, 1.2)], [t, rng.range(0.4, 1)], [dieAt, 0.02], [dieAt + 30, 0]];
      if (rng.chance(0.3)) {
        const { key } = kolCall(rng.range(30, Math.max(40, t * 0.6)), true);
        if (rng.chance(0.6)) sell(rng.range(t, dieAt), key, rng.range(0.5, 1));
      }
      // anyone can be on a slow one: some take a part off on a leg up, the rest hold
      if (rng.chance(0.45)) {
        for (const s of smarts(rng.between(1, 3), () => rng.range(10, 90), 0.9, 'any')) {
          if (rng.chance(0.6)) sell(s.t + rng.range(40, Math.max(60, dieAt - s.t)), `m${s.k}`, rng.range(0.4, 1));
        }
      }
      sniperDumps(ns, 10, 90, 0.8);
      if (rng.chance(0.5)) sell(rng.range(60, dieAt), 'dev', rng.range(0.5, 1));
      sigma = 0.12; tau = 20;
      socials(0.6, 0.45, 0.35);
      intel.devCoins = rng.between(1, 25);
      intel.devMigrated = rng.chance(0.2) ? 1 : 0;
      break;
    }
    case 'runner':
    case 'moon': {
      const moon = fate === 'moon';
      devBuy(moon ? 0.6 : 0.7);
      const ns = snipers(rng.between(2, 8), 0.6);
      if (rng.chance(0.15)) bundle(rng.between(1, 3), rng.range(0.5, 3));
      const gradT = moon ? rng.range(90, 200) : rng.range(150, 330);
      const peakX = moon ? rng.range(15, 40) : rng.range(1.2, 3); // its peak in times its graduation
      const peakT = moon ? Math.max(gradT + 200, rng.range(480, 900)) : gradT + rng.range(60, 240);
      const peak = GRAD_M * peakX;
      pts = [[0, 1]];
      if (moon) {
        pts.push([rng.range(10, 25), rng.range(2, 3.2)], [rng.range(40, 80), rng.range(5, 8)]);
      } else {
        pts.push([rng.range(15, 40), rng.range(1.6, 2.5)], [rng.range(60, Math.min(110, gradT * 0.6)), rng.range(3, 6)]);
      }
      pts.push([gradT * 0.8, rng.range(8, 11)], [gradT, PAST_GRAD], [gradT + 15, GRAD_M * rng.range(0.85, 1.15)]);
      // up to its peak in legs, each a run up and a pullback
      const legs = moon ? rng.between(3, 5) : rng.between(1, 2);
      const step = Math.pow(peakX, 1 / legs);
      let m = GRAD_M;
      for (let i = 1; i <= legs; i++) {
        const tl = gradT + 15 + ((peakT - gradT - 15) * i) / legs;
        m = i === legs ? peak : m * step * rng.range(0.85, 1.15);
        pts.push([tl, m]);
        if (i < legs) pts.push([tl + rng.range(15, 40), m * rng.range(0.68, 0.85)]);
      }
      const coolT = peakT + rng.range(moon ? 200 : 120, moon ? 500 : 400);
      const endT = peakT + rng.range(600, 1200);
      pts.push([coolT, peak * rng.range(moon ? 0.4 : 0.35, moon ? 0.6 : 0.7)], [endT, peak * rng.range(0.2, 0.45)]);
      dieAt = endT + 60;
      act = moon
        ? [[0, rng.range(2.5, 4)], [gradT, rng.range(4, 6)], [peakT, rng.range(5, 8)], [coolT, rng.range(1.5, 3)], [endT, 0.2], [dieAt, 0]]
        : [[0, rng.range(1.5, 3)], [60, rng.range(1.5, 3.5)], [gradT, rng.range(3, 5)], [peakT, rng.range(2, 4)], [coolT, rng.range(0.6, 1.2)], [endT, 0.15], [dieAt, 0]];
      // callers: most runners get an honest-leaning call; moons get a few
      const calls = moon ? rng.between(1, 3) : rng.chance(0.7) ? 1 : 0;
      for (let i = 0; i < calls; i++) {
        const kt = moon ? rng.range(20, Math.max(30, peakT * 0.6)) : rng.range(40, Math.min(150, gradT * 0.7));
        const { k, key } = kolCall(kt, true, i);
        if (rng.chance(k.honest)) {
          if (rng.chance(0.5)) sell(kt + rng.range(180, 600), key, rng.range(0.4, 1));
        } else {
          sell(kt + rng.range(30, 120), key, 1);
        }
      }
      // the good wallets find it, most early and some only on its way to graduating
      const late = Math.max(moon ? 130 : 150, gradT * 0.9);
      const sm = smarts(moon ? rng.between(2, 5) : rng.between(1, 3),
        () => (rng.chance(0.6) ? rng.range(10, moon ? 70 : 90) : rng.range(moon ? 60 : 90, late)), moon ? 2.5 : 2, 'good');
      for (const s of sm) {
        // some take a profit on the way up, most sell around its top, a few hold on
        const r = rng.f();
        if (r < 0.4) sell(s.t + rng.range(30, 150), `m${s.k}`, rng.range(0.6, 1));
        else if (r < 0.88) sell(Math.max(s.t + 30, peakT + rng.range(-30, 200)), `m${s.k}`, rng.range(0.5, 1));
      }
      if (rng.chance(moon ? 0.9 : 0.65)) flag(rng.range(gradT * 0.4, gradT + 120), 'dexPaid');
      const wh = moon ? rng.between(3, 8) : rng.between(0, 3);
      for (let i = 0; i < wh; i++) {
        const wt = gradT + rng.range(10, Math.max(30, peakT - gradT));
        buy(wt, `w${i}`, rng.logn(moon ? 18 : 12, 0.5), 'whale');
        if (rng.chance(0.7)) sell(wt + rng.range(60, 600), `w${i}`, rng.range(0.5, 1));
      }
      sniperDumps(ns, 10, 90, 0.8, 0.5);
      if (rng.chance(0.4)) sell(rng.range(20, 120), 'dev', 1);
      else if (rng.chance(0.6)) sell(gradT + rng.range(30, 400), 'dev', rng.range(0.3, 1));
      sigma = moon ? 0.18 : 0.15; tau = 20;
      socials(moon ? 0.95 : 0.85, moon ? 0.85 : 0.7, moon ? 0.8 : 0.6);
      intel.devCoins = rng.chance(moon ? 0.7 : 0.6) ? 1 : rng.between(2, 10);
      intel.devMigrated = intel.devCoins > 1 ? rng.between(0, 2) : 0;
      break;
    }
    default:
      throw new Error(`no such fate: ${fate}`);
  }

  // now and then its community takes over a dead coin: new socials, a run, then a fade
  let cto = null;
  if ((fate === 'dud' || fate === 'rug') && rng.chance(CTO_ODDS)) {
    const t0 = dieAt + rng.range(120, 480);
    const base = pts[pts.length - 1][1];
    const toGrad = rng.chance(0.2);
    const top = toGrad ? PAST_GRAD : base * rng.range(3, 8);
    const tTop = t0 + rng.range(60, 180);
    const tEnd = tTop + rng.range(240, 600);
    pts.push([t0, base], [tTop, top], [tEnd, toGrad ? GRAD_M * rng.range(0.6, 1.2) : Math.max(1.05, top * rng.range(0.3, 0.6))]);
    act = act.filter(([t]) => t < t0);
    act.push([t0, 0.02], [t0 + 10, rng.range(1.2, 2.5)], [tTop, rng.range(1.5, 3)], [tEnd, 0.1], [tEnd + 60, 0]);
    flag(t0, 'cto');
    dieAt = tEnd + 60;
    cto = { at: t0 };
  }

  ev.sort((a, b) => a.t - b.t);
  return { fate, pts: sortPts(pts), act: sortPts(act), sigma, tau, dieAt, events: ev, intel, cto };
}

// ---------- reading a plan at a time ----------

const smooth = (x) => x * x * (3 - 2 * x);

// The plan's market cap multiple at `t` seconds after launch (between its points: eased, in log space)
export function targetAt(pts, t) {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [t1, m1] = pts[i];
    if (t <= t1) {
      const [t0, m0] = pts[i - 1];
      const x = t1 > t0 ? smooth((t - t0) / (t1 - t0)) : 1;
      return Math.exp(Math.log(m0) + (Math.log(m1) - Math.log(m0)) * x);
    }
  }
  return pts[pts.length - 1][1];
}

// The plan's trades a second at `t` (between its points: in a straight line)
export function activityAt(act, t) {
  if (t <= act[0][0]) return act[0][1];
  for (let i = 1; i < act.length; i++) {
    const [t1, a1] = act[i];
    if (t <= t1) {
      const [t0, a0] = act[i - 1];
      return t1 > t0 ? a0 + ((a1 - a0) * (t - t0)) / (t1 - t0) : a1;
    }
  }
  return act[act.length - 1][1];
}
