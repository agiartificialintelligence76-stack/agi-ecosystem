// AGI-1's live show (2026-10-09, the owner: "can you also include on her watching the live trading chart of $AGI"): $AGI's
// live chart on her TV, drawn in code from its newest trades (clank.trade's, read by our server: server/live.js
// streamMarket; never who traded). Candles of its price over the time the trades cover, its buys and sells under them, the
// last price, how it moved over that time. Redrawn with each update (every few seconds while she watches); nothing in it
// moves in between but a dot (CSS), so it's cheap on a server without a graphics card.
// The pure parts (candlesOf, chartDir, spanText) are tested in Node; drawChart needs a canvas.
import { fmtPrice, fmtCompact } from '../../../src/prices/parse.js';

export const CHART_W = 582, CHART_H = 327;          // (her TV's screen: 620 px less its border and padding, 16:9)
const C = { bg: '#0f0826', grid: 'rgba(255, 255, 255, 0.07)', up: '#3ff0c3', down: '#ff4da6', text: '#ffffff', dim: 'rgba(228, 217, 255, 0.78)',
  honey: '#ffc933', ink: '#170a36', lav: '#e4d9ff' };

// trades [{ at (ms), side, price (dollars), usd }] (any order) → candles [{ t0, t1, o, h, l, c, buy, sell, n }] over the time
// they cover, about `count` of them (a slot with no trade: flat at the last price, so the line never breaks)
export function candlesOf(trades, count = 28) {
  const list = (Array.isArray(trades) ? trades : []).filter((t) => Number.isFinite(t?.at) && t.price > 0).sort((a, b) => a.at - b.at);
  if (!list.length) return [];
  const first = list[0].at, last = list[list.length - 1].at;
  const span = Math.max(60_000, last - first);
  const n = Math.max(6, Math.min(count, list.length));
  const step = span / n;
  const out = [];
  let k = 0, prev = list[0].price;
  for (let i = 0; i < n; i++) {
    const t0 = first + i * step, t1 = i === n - 1 ? last + 1 : first + (i + 1) * step;
    const c = { t0, t1, o: prev, h: prev, l: prev, c: prev, buy: 0, sell: 0, n: 0 };
    for (; k < list.length && list[k].at < t1; k++) {
      const t = list[k];
      if (c.n === 0) { c.o = prev; c.h = Math.max(prev, t.price); c.l = Math.min(prev, t.price); }
      c.h = Math.max(c.h, t.price); c.l = Math.min(c.l, t.price); c.c = t.price;
      if (t.side === 'sell') c.sell += t.usd || 0; else c.buy += t.usd || 0;
      c.n += 1;
    }
    prev = c.c;
    out.push(c);
  }
  return out;
}
// how it moved over what's on screen: 'up' (+3% or more), 'down' (-3% or less) or 'flat' (her feeling, never advice)
export function chartDir(trades) {
  const list = (Array.isArray(trades) ? trades : []).filter((t) => t?.price > 0).sort((a, b) => a.at - b.at);
  if (list.length < 2) return 'flat';
  const pct = ((list[list.length - 1].price - list[0].price) / list[0].price) * 100;
  return pct >= 3 ? 'up' : pct <= -3 ? 'down' : 'flat';
}
export const changeOf = (trades) => {
  const list = (Array.isArray(trades) ? trades : []).filter((t) => t?.price > 0).sort((a, b) => a.at - b.at);
  return list.length < 2 ? 0 : ((list[list.length - 1].price - list[0].price) / list[0].price) * 100;
};
// "the last 3 h 20 min" / "the last 45 min" / "the last 2 days"
export function spanText(ms) {
  const m = Math.max(1, Math.round(ms / 60_000));
  if (m < 60) return `the last ${m} min`;
  const h = Math.floor(m / 60), rest = m % 60;
  if (h < 48) return `the last ${h} h${rest ? ` ${rest} min` : ''}`;
  return `the last ${Math.round(h / 24)} days`;
}

// data: { trades, numbers: { mcap, h24 } | null } → drawn on the canvas (CHART_W × CHART_H)
export function drawChart(canvas, data, { now = Date.now() } = {}) {
  const g = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const trades = Array.isArray(data?.trades) ? data.trades : [];
  const candles = candlesOf(trades);
  g.clearRect(0, 0, W, H);
  g.fillStyle = C.bg;
  g.fillRect(0, 0, W, H);
  // header: $AGI · LIVE, the last price and how it moved
  g.textBaseline = 'alphabetic';
  g.font = "900 22px Anybody, Geist, sans-serif";
  g.fillStyle = C.lav;
  g.fillText('$AGI', 14, 30);
  const tw = g.measureText('$AGI').width;
  g.fillStyle = C.down;
  g.beginPath(); g.arc(14 + tw + 14, 23, 5, 0, Math.PI * 2); g.fill();
  g.font = "800 13px 'Geist Mono', monospace";
  g.fillStyle = C.text;
  g.fillText('LIVE TRADES', 14 + tw + 24, 28);
  if (!candles.length) {
    g.font = "700 18px Geist, sans-serif"; g.fillStyle = C.dim;
    g.fillText('No trades to show right now', 14, H / 2);
    return { candles: 0 };
  }
  const last = candles[candles.length - 1].c;
  const pct = changeOf(trades);
  g.textAlign = 'right';
  g.font = "800 19px 'Geist Mono', monospace";
  g.fillStyle = C.text;
  g.fillText(fmtPrice(last), W - 92, 29);
  g.fillStyle = pct >= 0 ? C.up : C.down;
  g.fillText(`${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`, W - 14, 29);
  g.textAlign = 'left';
  // the plot: prices on the right, candles, then the buys and sells under them
  const px0 = 14, px1 = W - 74, py0 = 46, py1 = 236, vy0 = 246, vy1 = 292;
  let lo = Math.min(...candles.map((c) => c.l)), hi = Math.max(...candles.map((c) => c.h));
  if (hi - lo < hi * 0.01) { lo *= 0.995; hi *= 1.005; }
  const pad = (hi - lo) * 0.08;
  lo -= pad; hi += pad;
  const y = (p) => py1 - ((p - lo) / (hi - lo)) * (py1 - py0);
  g.strokeStyle = C.grid; g.lineWidth = 1;
  g.font = "600 11px 'Geist Mono', monospace"; g.fillStyle = C.dim;
  for (let i = 0; i <= 4; i++) {
    const p = lo + ((hi - lo) * i) / 4, yy = Math.round(y(p)) + 0.5;
    g.beginPath(); g.moveTo(px0, yy); g.lineTo(px1, yy); g.stroke();
    g.fillText(fmtPrice(p), px1 + 6, yy + 4);
  }
  const slot = (px1 - px0) / candles.length, body = Math.max(3, slot * 0.62);
  const vmax = Math.max(1, ...candles.map((c) => c.buy + c.sell));
  candles.forEach((c, i) => {
    const cx = px0 + slot * (i + 0.5);
    const color = c.c >= c.o ? C.up : C.down;
    g.strokeStyle = color; g.fillStyle = color; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(Math.round(cx) + 0.5, y(c.h)); g.lineTo(Math.round(cx) + 0.5, y(c.l)); g.stroke();
    const top = y(Math.max(c.o, c.c)), bot = y(Math.min(c.o, c.c));
    g.fillRect(cx - body / 2, top, body, Math.max(2, bot - top));
    // its buys (mint) and sells (pink), stacked
    const bh = ((vy1 - vy0) * c.buy) / vmax, sh = ((vy1 - vy0) * c.sell) / vmax;
    g.globalAlpha = 0.85;
    g.fillStyle = C.up; g.fillRect(cx - body / 2, vy1 - bh, body, bh);
    g.fillStyle = C.down; g.fillRect(cx - body / 2, vy1 - bh - sh, body, sh);
    g.globalAlpha = 1;
  });
  // the last price: a dashed line and its label
  const ly = Math.round(y(last)) + 0.5;
  g.setLineDash([5, 4]); g.strokeStyle = C.honey; g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(px0, ly); g.lineTo(px1, ly); g.stroke();
  g.setLineDash([]);
  g.fillStyle = C.honey;
  g.fillRect(px1 + 2, ly - 9, W - px1 - 4, 18);
  g.fillStyle = C.ink; g.font = "800 11px 'Geist Mono', monospace";
  g.fillText(fmtPrice(last), px1 + 6, ly + 4);
  // footer: what it covers, and its market cap
  const first = Math.min(...trades.filter((t) => t?.price > 0).map((t) => t.at));
  const cap = data?.numbers?.mcap > 0 ? ` · market cap ${fmtCompact(data.numbers.mcap)}` : '';
  g.font = "600 11px 'Geist Mono', monospace"; g.fillStyle = C.dim;
  g.fillText(`${trades.length} trades on clank.trade, ${spanText(now - first)}${cap} · not financial advice`, 14, H - 18);
  return { candles: candles.length, last, pct, y: ly };
}
