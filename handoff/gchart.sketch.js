// A GMGN-style chart for TRENCHING SIMULATOR on TradingView Lightweight Charts™ (lightweight-charts 5.2.1, Apache-2.0).
// Research sketch (2026-10-22): the same set({ candles, solUsd, marks, tf, migratedAt, base }) as chart.js's createChart,
// so a board can swap one for the other. Candles come from the engine as 1-second market caps in SOL
// ({ t, o, h, l, c, v, b, s }, t on the market's clock); `base` is the page's clock (ms) when the market's clock read 0.
//
// What it adds over chart.js: drag / wheel / pinch to scroll and zoom, kinetic touch scroll, a real time axis with
// seconds, crosshair labels on both axes, a price mode with subscript zeros (0.0₅1234) next to the market-cap mode,
// USD / SOL, a volume histogram in its own band, the last price line and label, B / S bubbles drawn by a series
// primitive, and only the newest candles sent on each update (series.update()), never the whole array again.
import {
  createChart, CandlestickSeries, HistogramSeries, createSeriesMarkers,
  ColorType, CrosshairMode, LineStyle, TickMarkType, LastPriceAnimationMode,
} from 'lightweight-charts';
import { price as tinyPrice, usd, compact } from './format.js';

export const SUPPLY = 1_000_000_000; // curve.js's

// GMGN-like dark palette: near-black, mint-green up, coral-red down, grey grid. Calibrate against real screenshots.
export const PALETTE = Object.freeze({
  bg: '#101114', grid: 'rgba(255,255,255,0.04)', border: '#24262c', text: '#8b8f98', strong: '#e7e9ee',
  up: '#2ebd85', down: '#f6465d', upVol: 'rgba(46,189,133,0.35)', downVol: 'rgba(246,70,93,0.35)',
  cross: '#5d616b', label: '#2a2d35', buy: '#2ebd85', sell: '#f6465d', mig: '#f0b90b',
});

export const TIMEFRAMES = Object.freeze([1, 15, 30, 60, 300, 900, 3600]); // GMGN's 1s 15s 30s 1m 5m 15m 1h

const two = (n) => String(n).padStart(2, '0');

// 1-second candles → candles of `tf` seconds (chart.js's aggregate, with buys and sells kept)
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

// the value a market cap in SOL shows as: mode 'mcap' | 'price', unit 'usd' | 'sol'
export const valueOf = (mcSol, { mode, unit, solUsd }) => mcSol * (unit === 'usd' ? solUsd : 1) / (mode === 'price' ? SUPPLY : 1);

// the axis and crosshair labels: market caps short ("$12.3K"), prices with their zeros small ("0.0₅1234")
export function formatterFor(mode, unit) {
  if (mode === 'price') return (v) => (unit === 'usd' ? `$${tinyPrice(v, 4)}` : tinyPrice(v, 4));
  return (v) => (unit === 'usd' ? usd(v) : compact(v, 2));
}
// smallest step the scale may use: a hundredth of the smallest price's significant digit
const minMoveFor = (mode) => (mode === 'price' ? 1e-13 : 0.01);

// a series primitive: the player's own trades as small B / S bubbles under the candle's low / over its high
class TradeBubbles {
  constructor(C) {
    this.C = C;
    this.items = []; // [{ time, side, low, high }]
    this.pts = [];
    this.chart = null;
    this.series = null;
    this.req = null;
    const self = this;
    this.views = [{ zOrder: () => 'top', renderer: () => ({ draw: (target) => self.draw(target) }) }];
  }
  attached({ chart, series, requestUpdate }) {
    this.chart = chart;
    this.series = series;
    this.req = requestUpdate;
  }
  detached() {
    this.chart = this.series = this.req = null;
  }
  set(items) {
    this.items = items;
    if (this.req) this.req();
  }
  updateAllViews() {
    this.pts = [];
    if (!this.chart) return;
    const ts = this.chart.timeScale();
    for (const m of this.items) {
      const x = ts.timeToCoordinate(m.time);
      const y = this.series.priceToCoordinate(m.side === 'buy' ? m.low : m.high);
      if (x === null || y === null) continue;
      this.pts.push({ x, y, buy: m.side === 'buy' });
    }
  }
  paneViews() {
    return this.views;
  }
  draw(target) {
    const { C, pts } = this;
    target.useBitmapCoordinateSpace(({ context: g, horizontalPixelRatio: hr, verticalPixelRatio: vr }) => {
      const r = 7 * vr;
      g.font = `${Math.round(10 * vr)}px "Geist Mono", ui-monospace, monospace`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      for (const p of pts) {
        const x = Math.round(p.x * hr);
        const y = Math.round((p.y + (p.buy ? 13 : -13)) * vr);
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fillStyle = p.buy ? C.buy : C.sell;
        g.fill();
        g.fillStyle = '#0b0c0e';
        g.fillText(p.buy ? 'B' : 'S', x, y + 0.5 * vr);
      }
    });
  }
}

export function createGChart(host, { mode = 'mcap', unit = 'usd', tf = 1, colors = {}, attribution = false } = {}) {
  const C = { ...PALETTE, ...colors };
  let data = { candles: [], solUsd: 150, marks: [], tf, migratedAt: null, base: null };
  let view = { mode, unit };
  let sent = null; // { key, t: the last candle time sent, n } : what the series has
  let bars = [];
  // seconds since 1970 for a market-clock second (the chart's axis is wall-clock time, as terminals' are)
  const sec0 = () => (Number.isFinite(data.base) ? Math.round(data.base / 1000) : 0);
  // the axis shows the page's local time: Lightweight Charts formats in UTC unless told otherwise
  const local = (t) => new Date(t * 1000);
  const tick = (t, type) => {
    const d = local(t);
    if (type === TickMarkType.TimeWithSeconds) return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
    if (type === TickMarkType.Time) return `${two(d.getHours())}:${two(d.getMinutes())}`;
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };
  const chart = createChart(host, {
    autoSize: true, // a ResizeObserver on `host`: its CSS size is the chart's
    layout: {
      background: { type: ColorType.Solid, color: C.bg },
      textColor: C.text,
      fontSize: 11,
      fontFamily: '"Geist Mono", ui-monospace, SFMono-Regular, monospace',
      attributionLogo: attribution, // false: its <style> element is refused by the site's CSP (see the report)
      panes: { separatorColor: C.border, separatorHoverColor: C.label },
    },
    grid: { vertLines: { color: C.grid }, horzLines: { color: C.grid } },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: { color: C.cross, width: 1, style: LineStyle.Dashed, labelBackgroundColor: C.label },
      horzLine: { color: C.cross, width: 1, style: LineStyle.Dashed, labelBackgroundColor: C.label },
    },
    rightPriceScale: { borderColor: C.border, scaleMargins: { top: 0.08, bottom: 0.26 }, entireTextOnly: true },
    timeScale: {
      borderColor: C.border, timeVisible: true, secondsVisible: true, rightOffset: 6, barSpacing: 7, minBarSpacing: 0.8,
      shiftVisibleRangeOnNewBar: true, tickMarkFormatter: tick,
    },
    localization: { timeFormatter: (t) => tick(t, TickMarkType.TimeWithSeconds) },
    handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
    handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: { time: true, price: true }, axisDoubleClickReset: true },
    kineticScroll: { touch: true, mouse: false },
  });
  const fmt = () => formatterFor(view.mode, view.unit);
  const candles = chart.addSeries(CandlestickSeries, {
    upColor: C.up, downColor: C.down, borderVisible: false, wickUpColor: C.up, wickDownColor: C.down,
    priceLineVisible: true, priceLineStyle: LineStyle.Dashed, lastValueVisible: true,
    lastPriceAnimation: LastPriceAnimationMode.Disabled,
    priceFormat: { type: 'custom', formatter: fmt(), minMove: minMoveFor(view.mode) },
  });
  // volume: its own scale ('' = an overlay) in the bottom fifth
  const volume = chart.addSeries(HistogramSeries, {
    priceScaleId: '', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false,
  });
  volume.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
  const bubbles = new TradeBubbles(C);
  candles.attachPrimitive(bubbles);
  // the migration as a marker (Lightweight Charts' own markers plugin)
  const markers = createSeriesMarkers(candles, []);

  const toBar = (b) => {
    const t = sec0() + b.t;
    const k = (x) => valueOf(x, { ...view, solUsd: data.solUsd });
    return {
      c: { time: t, open: k(b.o), high: k(b.h), low: k(b.l), close: k(b.c) },
      v: { time: t, value: b.v, color: b.c >= b.o ? C.upVol : C.downVol },
    };
  };

  function sync() {
    bars = aggregate(data.candles, data.tf);
    const key = `${view.mode}|${view.unit}|${data.tf}|${data.solUsd}|${sec0()}`;
    const first = bars.length ? bars[0].t : null;
    // the whole series again only when what it shows changed (mode, unit, timeframe, a new coin or older history)
    if (!sent || sent.key !== key || sent.first !== first || bars.length < sent.n - 1) {
      const cs = [];
      const vs = [];
      for (const b of bars) {
        const x = toBar(b);
        cs.push(x.c);
        vs.push(x.v);
      }
      candles.setData(cs);
      volume.setData(vs);
      sent = { key, first, t: bars.length ? bars[bars.length - 1].t : -Infinity, n: bars.length };
    } else {
      // only the last candle again and the new ones: update() replaces a candle of the same time, adds a later one
      let i = bars.length - 1;
      while (i > 0 && bars[i - 1].t >= sent.t) i--;
      for (; i < bars.length; i++) {
        if (bars[i].t < sent.t) continue;
        const x = toBar(bars[i]);
        candles.update(x.c);
        volume.update(x.v);
      }
      sent.t = bars.length ? bars[bars.length - 1].t : sent.t;
      sent.n = bars.length;
    }
    // the player's trades, on the candle they fell in
    const s = data.tf > 1 ? data.tf : 1;
    const byT = new Map(bars.map((b) => [b.t, b]));
    const items = [];
    for (const m of data.marks || []) {
      const bt = Math.floor(m.t / s) * s;
      const b = byT.get(bt);
      if (!b) continue;
      const x = toBar(b).c;
      items.push({ time: x.time, side: m.side, low: x.low, high: x.high });
    }
    bubbles.set(items);
    const mig = data.migratedAt;
    if (mig !== null && mig !== undefined && byT.has(Math.floor(mig / s) * s)) {
      markers.setMarkers([{ time: sec0() + Math.floor(mig / s) * s, position: 'aboveBar', shape: 'arrowDown', color: C.mig,
        text: 'Migrated' }]);
    } else markers.setMarkers([]);
  }

  return {
    chart,
    // the same as chart.js's: { candles, solUsd, marks: [{ t, side }], tf, migratedAt, base }
    set(d) {
      data = { ...data, ...d };
      sync();
    },
    // GMGN's two toggles: Price / MCap and USD / SOL
    view(v) {
      view = { ...view, ...v };
      candles.applyOptions({ priceFormat: { type: 'custom', formatter: fmt(), minMove: minMoveFor(view.mode) } });
      sent = null;
      sync();
    },
    fit: () => chart.timeScale().fitContent(),
    toNow: () => chart.timeScale().scrollToRealTime(),
    redraw() {},
    destroy() {
      candles.detachPrimitive(bubbles);
      chart.remove();
    },
  };
}
