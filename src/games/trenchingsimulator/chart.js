// TRENCHING SIMULATOR's price chart (2026-10-20): candles of a coin's market cap in dollars, its volume, the last price
// on the axis, the player's own buys (B) and sells (S), a crosshair with its O/H/L/C, the clock times under it, drawn
// on a canvas sharp at any screen (devicePixelRatio), redrawn at most once a frame and only when something changed.
// The candles come from the engine as market caps in SOL (one a second): × SOL's price, they're dollars. The sums are
// pure (read in Node: tests/trench-game.test.js); `createChart` needs a canvas (a stand-in one in the tests).
import { usd } from './format.js';

export const TIMEFRAMES = Object.freeze([
  Object.freeze({ id: '1s', s: 1 }), Object.freeze({ id: '15s', s: 15 }),
  Object.freeze({ id: '1m', s: 60 }), Object.freeze({ id: '5m', s: 300 }),
]);

// 1-second candles ({ t, o, h, l, c, v }) made into candles of `tf` seconds; a bucket with no trade is left out
export function aggregate(candles, tf) {
  const out = [];
  const s = tf > 1 ? tf : 1;
  for (const x of candles || []) {
    const t = Math.floor(x.t / s) * s;
    const last = out[out.length - 1];
    if (last && last.t === t) {
      if (x.h > last.h) last.h = x.h;
      if (x.l < last.l) last.l = x.l;
      last.c = x.c;
      last.v += x.v || 0;
    } else out.push({ t, o: x.o, h: x.h, l: x.l, c: x.c, v: x.v || 0 });
  }
  return out;
}

// about `n` round numbers between lo and hi (1, 2 or 5 × a power of ten apart)
export function niceTicks(lo, hi, n = 4) {
  if (!(hi > lo) || !Number.isFinite(lo) || !Number.isFinite(hi)) return [];
  const raw = (hi - lo) / Math.max(1, n);
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = [10, 5, 2, 1].map((m) => m * p).find((x) => x <= raw * 1.5) || p; // the biggest near `raw`
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(+v.toPrecision(12));
  return out;
}

const two = (n) => String(n).padStart(2, '0');

// a candle's time under the chart. `base`: the page's clock (ms) when the market's clock read 0, so a candle shows the
// time of day it stands for, as terminals' charts do: "14:32:05" for candles under a minute, "14:32" for longer ones.
// Without a base, minutes and seconds from the run's start ("−1:30" for the market before the player arrived).
export function timeLabel(t, base, tf = 15) {
  if (!Number.isFinite(t)) return '';
  if (Number.isFinite(base)) {
    const d = new Date(base + t * 1000);
    if (!Number.isFinite(d.getTime())) return '';
    const hm = `${two(d.getHours())}:${two(d.getMinutes())}`;
    return tf >= 60 ? hm : `${hm}:${two(d.getSeconds())}`;
  }
  const s = Math.round(Math.abs(t));
  return `${t < 0 && s > 0 ? '−' : ''}${Math.floor(s / 60)}:${two(s % 60)}`;
}

// round steps for the time labels, in seconds
const TIME_STEPS = Object.freeze([1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 14400, 21600, 43200, 86400]);

// which candles get a time label: the first candle past each round step (the steps far enough apart for `gap` pixels
// between labels, `cw` pixels a candle, `span` seconds a candle). A gap in trading (no candle) is skipped over: its next
// candle starts the next label. Pure.
export function timeTicks(ts, span, cw, gap) {
  const out = [];
  if (!Array.isArray(ts) || !ts.length || !(cw > 0) || !(span > 0)) return out;
  const want = (Math.max(1, gap) / cw) * span;
  const step = TIME_STEPS.find((x) => x >= want) || TIME_STEPS[TIME_STEPS.length - 1];
  let last = -Infinity;
  for (let i = 0; i < ts.length; i++) {
    const b = Math.floor(ts[i] / step);
    const onStep = i === 0 ? ts[0] % step === 0 : b !== Math.floor(ts[i - 1] / step);
    if (!onStep || (i - last) * cw < gap) continue;
    out.push(i);
    last = i;
  }
  return out;
}

export function createChart(canvas, { colors = {}, tf = 15 } = {}) {
  const C = { bg: '#15161f', line: '#2d3045', text: '#f4f4f6', muted: '#9a9db1', up: '#4ade80', down: '#f87171',
    accent: '#ffd23f', ...colors };
  const g = canvas.getContext('2d');
  let data = { candles: [], solUsd: 150, marks: [], tf, migratedAt: null, base: null };
  let hover = null;
  let dirty = true;
  let raf = 0;
  let W = 0;
  let H = 0;
  let dpr = 1;
  const want = () => {
    dirty = true;
    if (!raf) raf = requestAnimationFrame(frame);
  };
  function size() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(3, window.devicePixelRatio || 1);
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    const pw = Math.round(W * dpr);
    const ph = Math.round(H * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    want();
  }
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(size) : null;
  if (ro) ro.observe(canvas);
  const onMove = (e) => {
    const r = canvas.getBoundingClientRect();
    hover = { x: e.clientX - r.left, y: e.clientY - r.top };
    want();
  };
  const onLeave = () => {
    hover = null;
    want();
  };
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerleave', onLeave);

  function frame() {
    raf = 0;
    if (!dirty) return;
    dirty = false;
    draw();
  }

  function draw() {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = C.bg;
    g.fillRect(0, 0, W, H);
    // the candles are market caps in SOL: × SOL's price, dollars
    const k = data.solUsd > 0 ? data.solUsd : 150;
    const bars = aggregate(data.candles, data.tf).slice(-Math.max(8, Math.floor((W - 64) / 7)));
    g.font = '11px "Geist Mono", ui-monospace, monospace';
    if (!bars.length) {
      g.fillStyle = C.muted;
      g.textAlign = 'center';
      g.fillText('waiting for the first trade…', W / 2, H / 2);
      return;
    }
    const axis = 64;
    const volH = Math.round(H * 0.18);
    const top = 14;
    const bot = H - volH - 18;
    let lo = Infinity;
    let hi = -Infinity;
    let vmax = 0;
    for (const b of bars) {
      lo = Math.min(lo, b.l * k);
      hi = Math.max(hi, b.h * k);
      vmax = Math.max(vmax, b.v);
    }
    if (hi - lo < hi * 0.02) {
      hi *= 1.01;
      lo *= 0.99;
    }
    const pad = (hi - lo) * 0.08;
    lo -= pad;
    hi += pad;
    const y = (v) => top + (bot - top) * (1 - (v - lo) / (hi - lo));
    const cw = (W - axis) / bars.length;
    const x = (i) => i * cw + cw / 2;
    g.strokeStyle = C.line;
    g.lineWidth = 1;
    g.fillStyle = C.muted;
    g.textAlign = 'left';
    for (const v of niceTicks(lo, hi, 4)) {
      const yy = Math.round(y(v)) + 0.5;
      g.beginPath();
      g.moveTo(0, yy);
      g.lineTo(W - axis, yy);
      g.stroke();
      g.fillText(usd(v), W - axis + 6, yy + 4);
    }
    const bw = Math.max(1, Math.min(9, cw * 0.7));
    bars.forEach((b, i) => {
      const up = b.c >= b.o;
      g.fillStyle = up ? C.up : C.down;
      g.strokeStyle = g.fillStyle;
      const cx = Math.round(x(i)) + 0.5;
      g.beginPath();
      g.moveTo(cx, y(b.h * k));
      g.lineTo(cx, y(b.l * k));
      g.stroke();
      const y1 = y(Math.max(b.o, b.c) * k);
      const y2 = y(Math.min(b.o, b.c) * k);
      g.fillRect(cx - bw / 2, y1, bw, Math.max(1, y2 - y1));
      if (vmax > 0) {
        const vh = (b.v / vmax) * (volH - 4);
        g.globalAlpha = 0.45;
        g.fillRect(cx - bw / 2, H - 18 - vh, bw, vh);
        g.globalAlpha = 1;
      }
    });
    const t0 = bars[0].t;
    const span = data.tf > 1 ? data.tf : 1;
    const ix = (t) => Math.floor((t - t0) / span);
    for (const m of data.marks || []) {
      const i = ix(m.t);
      if (i < 0 || i >= bars.length) continue;
      const b = bars[i];
      const buy = m.side === 'buy';
      const yy = buy ? y(b.l * k) + 12 : y(b.h * k) - 12;
      g.fillStyle = buy ? C.up : C.down;
      g.beginPath();
      g.arc(x(i), yy, 7, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = C.bg;
      g.textAlign = 'center';
      g.fillText(buy ? 'B' : 'S', x(i), yy + 4);
    }
    if (data.migratedAt !== null && data.migratedAt !== undefined) {
      const i = ix(data.migratedAt);
      if (i >= 0 && i < bars.length) {
        g.strokeStyle = C.accent;
        g.setLineDash([2, 3]);
        g.beginPath();
        g.moveTo(Math.round(x(i)) + 0.5, top);
        g.lineTo(Math.round(x(i)) + 0.5, bot);
        g.stroke();
        g.setLineDash([]);
      }
    }
    const last = bars[bars.length - 1];
    const ly = Math.round(y(last.c * k)) + 0.5;
    g.strokeStyle = last.c >= last.o ? C.up : C.down;
    g.setLineDash([4, 4]);
    g.beginPath();
    g.moveTo(0, ly);
    g.lineTo(W - axis, ly);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = g.strokeStyle;
    g.fillRect(W - axis + 1, ly - 9, axis - 2, 18);
    g.fillStyle = C.bg;
    g.textAlign = 'left';
    g.fillText(usd(last.c * k), W - axis + 5, ly + 4);
    g.fillStyle = C.muted;
    g.textAlign = 'center';
    // the clock times: round ones, never closer than a label's width, never cut off at the plot's edges
    const lw = g.measureText(timeLabel(43200 + 59, Number.isFinite(data.base) ? 0 : null, data.tf)).width || 50;
    for (const i of timeTicks(bars.map((b) => b.t), span, cw, lw + 18)) {
      const xx = x(i);
      if (xx - lw / 2 < 2 || xx + lw / 2 > W - axis - 2) continue;
      g.fillText(timeLabel(bars[i].t, data.base, data.tf), xx, H - 4);
    }
    if (hover && hover.x < W - axis) {
      const i = Math.max(0, Math.min(bars.length - 1, Math.floor(hover.x / cw)));
      const b = bars[i];
      g.strokeStyle = C.muted;
      g.setLineDash([3, 3]);
      g.beginPath();
      g.moveTo(Math.round(x(i)) + 0.5, top);
      g.lineTo(Math.round(x(i)) + 0.5, H - 18);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = C.text;
      g.textAlign = 'left';
      g.fillText(`O ${usd(b.o * k)}  H ${usd(b.h * k)}  L ${usd(b.l * k)}  C ${usd(b.c * k)}`, 6, 11);
    }
  }

  size();
  return {
    // { candles, solUsd, marks: [{ t, side }], tf, migratedAt, base (the page's clock in ms when the market read 0) }
    set(d) {
      data = { ...data, ...d };
      want();
    },
    redraw: want,
    destroy() {
      if (ro) ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
    },
  };
}
