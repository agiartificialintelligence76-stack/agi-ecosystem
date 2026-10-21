// TRENCHING SIMULATOR's results (2026-10-20): a finished run in words and numbers (its title, its line, its stats), its
// worth over time as a line (an SVG path, at most 200 points), and its share card's words. Pure: the shell draws them,
// and tests read them in Node (tests/trench-game.test.js).
import { money, moneySigned, times, clock, usd } from './format.js';
import { challengeById } from './challenges.js';
import { GAME_NAME } from './share.js';
import { chainById } from './live-chains.js';

const fin = (x) => typeof x === 'number' && Number.isFinite(x);
const r1 = (x) => Math.round(x * 10) / 10;

export const TITLES = Object.freeze({
  won: 'Challenge complete', time: 'Time\'s up', rug: 'Rugged out', busted: 'Busted', cashed: 'Cashed out', quit: 'Run ended',
});

// the results' title, by how the run ended (run.result()'s outcome and reason)
export function resultTitle(res) {
  const r = res && typeof res === 'object' ? res : {};
  if (r.outcome === 'won') return TITLES.won;
  if (r.outcome === 'lost') return r.reason === 'rug' ? TITLES.rug : TITLES.time;
  if (r.outcome === 'busted') return TITLES.busted;
  if (r.outcome === 'cashed') return TITLES.cashed;
  return TITLES.quit;
}

// up (a win, or a run that ended above its start) or down: the title's color
export function resultTone(res) {
  const r = res && typeof res === 'object' ? res : {};
  if (r.outcome === 'won') return 'up';
  if (r.outcome === 'lost' || r.outcome === 'busted') return 'down';
  return fin(r.multiple) && r.multiple >= 1 ? 'up' : 'down';
}

// what the run was: a challenge's name, the daily market with its day, or free play; in Live mode, with its chain
export function modeLabel(res) {
  const r = res && typeof res === 'object' ? res : {};
  const ch = typeof r.challenge === 'string' ? challengeById(r.challenge) : null;
  if (r.mode === 'daily' && typeof r.daily === 'string') return ch ? `Daily market · ${r.daily} · ${ch.name}` : `Daily market · ${r.daily}`;
  const base = ch ? ch.name : 'Free play';
  const live = typeof r.live === 'string' ? chainById(r.live) : null;
  return live ? `${base} · Live · ${live.name}` : base;
}
// a run that traded real coins (Live mode): its words say so
export const tradedLive = (r) => Boolean(r && typeof r.live === 'string' && Number.isFinite(r.liveTraded) && r.liveTraded > 0);

const cur = (r) => (r.currency === 'usd' ? 'usd' : 'sol');
const px = (r) => (fin(r.solUsd) && r.solUsd > 0 ? r.solUsd : 150);

// "1 SOL → 2.31 SOL (2.31x) in 08:42"
export function resultLine(res) {
  const r = res && typeof res === 'object' ? res : {};
  const c = cur(r);
  const p = px(r);
  const m = fin(r.multiple) ? ` (${times(r.multiple)})` : '';
  const t = fin(r.timeUsed) ? ` in ${clock(r.timeUsed)}` : '';
  return `${money(r.start, c, p)} → ${money(r.worth, c, p)}${m}${t}`;
}

// a position as the results show it: "🐸 $FROG +0.42 SOL"
function trade(x, c, p) {
  if (!x || typeof x !== 'object') return '—';
  const t = typeof x.ticker === 'string' ? x.ticker : '?';
  return `${x.emoji || '🪙'} $${t} ${moneySigned(x.total, c, p)}`;
}

// the results' numbers: [{ label, value, tone }] (tone: 'up', 'down' or '')
export function statLines(res) {
  const r = res && typeof res === 'object' ? res : {};
  const c = cur(r);
  const p = px(r);
  const tone = (v) => (fin(v) && v > 0 ? 'up' : fin(v) && v < 0 ? 'down' : '');
  // one position both best and worst (a run with one trade): shown once, on its own side (a loss is never "best")
  const same = r.best && r.worst && r.best.id != null && r.best.id === r.worst.id;
  const lost = same && fin(r.best.total) && r.best.total < 0;
  const best = same && lost ? null : r.best;
  const worst = same && !lost ? null : r.worst;
  const out = [
    { label: 'Profit', value: moneySigned(r.pnl, c, p), tone: tone(r.pnl) },
    { label: 'Peak', value: money(r.peak, c, p), tone: '' },
    { label: 'Time', value: fin(r.seconds) && r.seconds > 0 ? `${clock(r.timeUsed)} of ${clock(r.seconds)}` : clock(r.timeUsed), tone: '' },
    { label: 'Orders', value: `${fin(r.filled) ? r.filled : 0} filled${r.failed > 0 ? ` · ${r.failed} failed` : ''}`, tone: '' },
    { label: 'Coins traded', value: String(fin(r.coins) ? r.coins : 0), tone: '' },
    { label: 'Wins / losses', value: `${fin(r.wins) ? r.wins : 0} / ${fin(r.losses) ? r.losses : 0}`, tone: '' },
    { label: 'Best trade', value: trade(best, c, p), tone: best ? tone(best.total) : '' },
    { label: 'Worst trade', value: trade(worst, c, p), tone: worst ? tone(worst.total) : '' },
    { label: 'Fees paid', value: `${money(fin(r.fees) ? r.fees : 0, c, p)}${fin(r.mev) && r.mev > 0 ? ` · ${money(r.mev, c, p)} lost to bots` : ''}`, tone: '' },
    { label: 'SOL price', value: `${usd(p)} (frozen for this run)`, tone: '' },
  ];
  return out;
}

// "★★☆": a run's stars out of 3
export function starsRow(n) {
  const k = Math.max(0, Math.min(3, Math.floor(fin(n) ? n : 0)));
  return '★'.repeat(k) + '☆'.repeat(3 - k);
}

// A line's points made few enough to draw (at most `max`), its shape kept: the first and the last, and of each stretch
// in between its lowest and its highest (in their order), so a spike or a rug's drop is never smoothed away.
export function downsample(points, max = 200) {
  const p = Array.isArray(points) ? points.filter((q) => q && fin(q.t) && fin(q.v)) : [];
  const cap = Math.max(4, Math.floor(fin(max) ? max : 200));
  if (p.length <= cap) return p.slice();
  const buckets = Math.floor((cap - 2) / 2);
  const span = (p.length - 2) / buckets;
  const out = [p[0]];
  for (let b = 0; b < buckets; b++) {
    const s = 1 + Math.floor(b * span);
    const e = Math.min(p.length - 1, 1 + Math.floor((b + 1) * span));
    let lo = null;
    let hi = null;
    for (let i = s; i < e; i++) {
      if (!lo || p[i].v < lo.v) lo = p[i];
      if (!hi || p[i].v > hi.v) hi = p[i];
    }
    if (!lo) continue;
    if (lo === hi) out.push(lo);
    else if (lo.t <= hi.t) out.push(lo, hi);
    else out.push(hi, lo);
  }
  out.push(p[p.length - 1]);
  return out;
}

// A run's worth over time as an SVG path in a w × h box (pad inside it): the line (`d`), the area under it (`area`), and
// where its start's level is (`baseY`), so the line shows above or below where it began. Its values' range always
// includes `base`, and is at least `minSpan` of it (5%: a 0.4% dip draws as a dip, not a crash). Fewer than one
// point: null.
export function sparkPath(points, { w = 600, h = 160, pad = 6, base = null, minSpan = 0.05 } = {}) {
  const p = downsample(points, 200);
  if (!p.length) return null;
  if (p.length === 1) p.push({ t: p[0].t + 1, v: p[0].v });
  const b = fin(base) ? base : p[0].v;
  let lo = b;
  let hi = b;
  for (const q of p) {
    if (q.v < lo) lo = q.v;
    if (q.v > hi) hi = q.v;
  }
  const least = Math.abs(b) * (fin(minSpan) && minSpan > 0 ? minSpan : 0);
  if (hi - lo < least) {
    const mid = (lo + hi) / 2;
    lo = mid - least / 2;
    hi = mid + least / 2;
  }
  const t0 = p[0].t;
  const t1 = p[p.length - 1].t;
  const iw = Math.max(1, w - 2 * pad);
  const ih = Math.max(1, h - 2 * pad);
  const X = (q, i) => r1(pad + (t1 > t0 ? (q.t - t0) / (t1 - t0) : i / (p.length - 1)) * iw);
  const Y = (v) => r1(hi > lo ? pad + (1 - (v - lo) / (hi - lo)) * ih : pad + ih / 2);
  const xy = p.map((q, i) => [X(q, i), Y(q.v)]);
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
  const bottom = r1(h - pad);
  const area = `${d} L${xy[xy.length - 1][0]} ${bottom} L${xy[0][0]} ${bottom} Z`;
  return { d, area, baseY: Y(b), up: p[p.length - 1].v >= b, lo, hi, n: p.length };
}

// the share card's words (src: shell.js draws them on a 1200 × 630 canvas)
export function cardText(res) {
  const r = res && typeof res === 'object' ? res : {};
  const c = cur(r);
  const p = px(r);
  return {
    kicker: `${GAME_NAME} · ${modeLabel(r)}`,
    title: resultTitle(r),
    big: fin(r.multiple) ? times(r.multiple) : '—',
    line: `${money(r.start, c, p)} → ${money(r.worth, c, p)}`,
    sub: `${moneySigned(r.pnl, c, p)}${fin(r.timeUsed) ? ` · ${clock(r.timeUsed)}` : ''}`,
    stars: r.outcome === 'won' && fin(r.stars) && r.stars > 0 ? starsRow(r.stars) : '',
    // (Live mode, 2026-10-21: its own words; never a real coin's name on the card)
    foot: tradedLive(r) ? 'Play money on live coins · agi1.app/games/trenchingsimulator'
      : 'Play money, made-up coins · agi1.app/games/trenchingsimulator',
    tone: resultTone(r),
  };
}
