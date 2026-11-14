// GROWTH STOCK: the farm market's pictures. A stock's chart is a candle a day (open, high, low, close: mint when it closed
// higher, pink when lower, as on any market chart) with today's candle growing live, a dashed line at its usual rate
// and today's rate on the right; a chip's sparkline is its last day, a point every half hour. Up and down also say it
// in words and arrows on the page, never by color alone.
import { INK } from './art.js';

const UP = '#2fd6a6', DOWN = '#ff4d8d', USUAL = '#8b66ff';
function fit(cv) {
  const dpr = Math.min(2, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1);
  const w = Math.max(1, Math.round(cv.clientWidth)), h = Math.max(1, Math.round(cv.clientHeight));
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { c, w, h };
}
export const fmtRate = (r) => (r >= 100 ? Math.round(r).toString() : r >= 10 ? r.toFixed(1) : r.toFixed(2));

export function drawSpark(cv, values, { usual = null, up = true } = {}) {
  const { c, w, h } = fit(cv);
  c.clearRect(0, 0, w, h);
  if (!values || values.length < 2) return;
  let lo = Infinity, hi = -Infinity;
  for (const v of values) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  if (usual != null) { lo = Math.min(lo, usual); hi = Math.max(hi, usual); }
  const pad = (hi - lo) * 0.12 || hi * 0.05 || 1;
  lo -= pad; hi += pad;
  const X = (i) => 1 + (i / (values.length - 1)) * (w - 2), Y = (v) => h - 1 - ((v - lo) / (hi - lo)) * (h - 2);
  if (usual != null) { c.setLineDash([3, 3]); c.strokeStyle = 'rgba(107,59,255,0.45)'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, Y(usual)); c.lineTo(w, Y(usual)); c.stroke(); c.setLineDash([]); }
  const col = up ? UP : DOWN;
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, `${col}55`); g.addColorStop(1, `${col}00`);
  c.beginPath(); c.moveTo(X(0), h); values.forEach((v, i) => c.lineTo(X(i), Y(v))); c.lineTo(X(values.length - 1), h); c.closePath(); c.fillStyle = g; c.fill();
  c.beginPath(); values.forEach((v, i) => c[i ? 'lineTo' : 'moveTo'](X(i), Y(v)));
  c.lineWidth = 1.8; c.strokeStyle = col; c.lineJoin = 'round'; c.stroke();
  c.beginPath(); c.arc(X(values.length - 1), Y(values[values.length - 1]), 2.4, 0, Math.PI * 2); c.fillStyle = col; c.fill();
}

// `m`: the stock's market (its candles and today's); `usual`: its usual rate now; `labels(day)`: a candle's day name;
// `marks`: [{ day, text, color }] (the news over a day's candle)
export function drawCandles(cv, m, { usual, labels, marks = [], days = 9, t = 0 } = {}) {
  const { c, w, h } = fit(cv);
  c.clearRect(0, 0, w, h);
  const list = [...m.candles.slice(-(days - 1)), m.live].filter(Boolean);
  if (!list.length) return;
  let lo = Infinity, hi = -Infinity;
  for (const k of list) { lo = Math.min(lo, k.l); hi = Math.max(hi, k.h); }
  lo = Math.min(lo, usual); hi = Math.max(hi, usual);
  const pad = (hi - lo) * 0.14 || hi * 0.06 || 1;
  lo = Math.max(0, lo - pad); hi += pad;
  // a small chart (a phone's short screen) has no room for day names or the news's marks
  const roomy = h >= 64 && w >= 200;
  const right = 44, bottom = roomy ? 14 : 3, top = roomy ? 6 : 3;
  const plotW = w - right - 4, plotH = h - bottom - top;
  const Y = (v) => top + plotH - ((v - lo) / (hi - lo)) * plotH;
  const slot = plotW / days, bw = Math.max(3, Math.min(16, slot * 0.56));
  // a light grid
  c.strokeStyle = 'rgba(23,10,54,0.08)'; c.lineWidth = 1;
  for (let k = 1; k < 4; k++) { const y = top + (plotH * k) / 4; c.beginPath(); c.moveTo(0, y); c.lineTo(plotW + 4, y); c.stroke(); }
  // usual
  c.setLineDash([4, 4]); c.strokeStyle = USUAL; c.lineWidth = 1.4; c.beginPath(); c.moveTo(0, Y(usual)); c.lineTo(plotW + 4, Y(usual)); c.stroke(); c.setLineDash([]);
  const offset = days - list.length;
  list.forEach((k, i) => {
    const x = 4 + (offset + i + 0.5) * slot, live = k === m.live;
    const up = k.c >= k.o, col = up ? UP : DOWN;
    c.strokeStyle = INK; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(x, Y(k.h)); c.lineTo(x, Y(k.l)); c.stroke();
    const y0 = Y(Math.max(k.o, k.c)), y1 = Y(Math.min(k.o, k.c));
    c.beginPath(); c.roundRect(x - bw / 2, y0, bw, Math.max(2, y1 - y0), 2);
    c.fillStyle = col; c.fill(); c.lineWidth = 1.4; c.strokeStyle = INK; c.stroke();
    if (live) { c.save(); c.globalAlpha = 0.25 + 0.2 * Math.sin(t * 5); c.strokeStyle = col; c.lineWidth = 3; c.beginPath(); c.roundRect(x - bw / 2 - 3, y0 - 3, bw + 6, Math.max(2, y1 - y0) + 6, 4); c.stroke(); c.restore(); }
    const lab = labels ? labels(k.day) : '';
    if (lab && roomy) { c.fillStyle = live ? INK : 'rgba(23,10,54,0.55)'; c.font = `${live ? 700 : 500} 9px 'AK Sans', system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillText(lab, x, h - 3); }
    if (roomy) for (const mk of marks) if (mk.day === k.day) { c.font = "700 9px 'AK Sans', system-ui, sans-serif"; c.fillStyle = mk.color; c.textAlign = 'center'; c.fillText(mk.text, x, top + 8); }
  });
  // today's rate, on the right
  const now = m.r, y = Y(now), up = now >= usual;
  c.setLineDash([2, 3]); c.strokeStyle = up ? UP : DOWN; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, y); c.lineTo(plotW + 4, y); c.stroke(); c.setLineDash([]);
  c.beginPath(); c.roundRect(plotW + 6, Math.max(1, Math.min(h - 17, y - 8)), right - 8, 16, 4); c.fillStyle = up ? UP : DOWN; c.fill(); c.lineWidth = 1.2; c.strokeStyle = INK; c.stroke();
  c.fillStyle = INK; c.font = "700 10px 'AK Mono', ui-monospace, monospace"; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(fmtRate(now), plotW + 6 + (right - 8) / 2, Math.max(1, Math.min(h - 17, y - 8)) + 8.5);
  // the usual line's own small tag
  c.fillStyle = USUAL; c.font = "600 9px 'AK Sans', system-ui, sans-serif"; c.textAlign = 'left'; c.textBaseline = 'bottom';
  if (roomy && Math.abs(Y(usual) - y) > 12) c.fillText('usual', 6, Y(usual) - 2);
}
