// GNGM's chart (2026-10-22): TradingView Lightweight Charts™ (lightweight-charts 5.2.1, Apache-2.0: its credit under the
// chart, chartCredit(); its license in the build, vite.config.js `build.license`), the way scanners' coin pages chart a
// coin: candles of 1 s to 15 min, a market cap or a token's price, in dollars or the run's own coin, a volume band,
// moving averages (MA 20, EMA 9) over the candles and RSI or MACD in panes under them, the last price on its axis, the
// player's own buys and sells as B / S bubbles, the migration marked, a crosshair with its value and time on the axes
// (and its candle for the page's legend: onHover), drag or a swipe to scroll back, the wheel or a pinch to zoom, a double
// click on an axis back to its first zoom. Its sums are ./gngm-data.js's; the time axis is the page's local time.
//
// It needs a page: the library comes as its own file the first time a coin's chart has candles (never in the game's
// first file, never on our server). Its logo is off (`attributionLogo: false`: it brings an inline style the site's CSP
// refuses), so its credit is ours, as text with one link to tradingview.com, which the library's license asks for.
//
// createGChart(host, { mode, unit, per, tf, colors, indicators, onHover, lib }) → { set, view, indicators, fit, toNow,
// zoom, redraw, state, destroy }. `host`: an element with a CSS height (the chart fills it and follows its size: its
// own ResizeObserver, `autoSize`). `lib`: the library itself (the tests' stand-in); else it's loaded when first needed.
// The same set({ candles, solUsd, marks, tf, migratedAt, base }) as Pomp.fun's chart (../chart.js).
import { el } from '../ui.js';
import { valueOf, formatterFor, sma, ema, rsi, macd } from './gngm-data.js';
import { createCandleStream } from './chart-stream.js';

export const PALETTE = Object.freeze({
  bg: '#0d0d0f', grid: 'rgba(255,255,255,0.04)', border: '#1f2024', axis: '#8a8d93', strong: '#eaecef', up: '#16c47f',
  down: '#f2495c', cross: '#5d616b', label: '#2a2d35', mig: '#f5b83d', ma: '#5fb0ff', ema: '#a99bff',
});
// the library's credit (its license: TradingView named as its maker, its notice, a link to tradingview.com on the page)
export const CREDIT = Object.freeze({ lead: 'Charts: ', name: 'TradingView Lightweight Charts™', url: 'https://www.tradingview.com/',
  tail: ' · Copyright (c) 2025 TradingView, Inc.' });
const BAR_W = 7; // a candle and its gap, in pixels, to start with
const MIN_W = 2;
const MAX_W = 32;
const RETRY_MS = 15_000; // the library didn't come (offline): asked again after this, at the soonest
const FONT = '"Geist Mono", ui-monospace, monospace';
const two = (n) => String(n).padStart(2, '0');
const fin = (x) => typeof x === 'number' && Number.isFinite(x);
// a color with some see-through ('#16c47f' → 'rgba(22,196,127,0.35)'; anything else as it is)
const alpha = (c, a) => {
  const m = /^#([0-9a-f]{6})$/i.exec(String(c || ''));
  if (!m) return c;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

// its credit, under the chart: the one link GNGM has
export function chartCredit() {
  return el('p', { class: 'tsg-credit' }, CREDIT.lead,
    el('a', { class: 'tsg-credit-a', href: CREDIT.url, target: '_blank', rel: 'noopener noreferrer' }, CREDIT.name), CREDIT.tail);
}

// the player's own trades as small B / S bubbles under the candle's low (a buy) or over its high (a sell): a series
// primitive, drawn by the library with the candles (sharp at any screen's pixels, moving with zoom and scroll)
class TradeBubbles {
  constructor(C) {
    this.C = C;
    this.items = []; // [{ time, buy, low, high }]
    this.pts = [];
    this.chart = null;
    this.series = null;
    this.req = null;
    this.views = [{ zOrder: () => 'top', renderer: () => ({ draw: (target) => this.draw(target) }) }];
  }
  attached({ chart, series, requestUpdate }) {
    this.chart = chart;
    this.series = series;
    this.req = requestUpdate;
  }
  detached() {
    this.chart = null;
    this.series = null;
    this.req = null;
  }
  set(items) {
    this.items = items;
    if (this.req) this.req();
  }
  updateAllViews() {
    this.pts = [];
    if (!this.chart || !this.series) return;
    const ts = this.chart.timeScale();
    for (const m of this.items) {
      const x = ts.timeToCoordinate(m.time);
      const y = this.series.priceToCoordinate(m.buy ? m.low : m.high);
      if (x === null || y === null) continue;
      this.pts.push({ x, y, buy: m.buy });
    }
  }
  paneViews() {
    return this.views;
  }
  draw(target) {
    const { C, pts } = this;
    target.useBitmapCoordinateSpace(({ context: g, horizontalPixelRatio: hr, verticalPixelRatio: vr }) => {
      g.font = `${Math.round(10 * vr)}px ${FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      for (const p of pts) {
        const x = Math.round(p.x * hr);
        const y = Math.round((p.y + (p.buy ? 13 : -13)) * vr);
        g.beginPath();
        g.arc(x, y, 7 * vr, 0, Math.PI * 2);
        g.fillStyle = p.buy ? C.up : C.down;
        g.fill();
        g.fillStyle = C.bg;
        g.fillText(p.buy ? 'B' : 'S', x, y + 0.5 * vr);
      }
    });
  }
}

export function createGChart(host, { mode = 'mcap', unit = 'usd', per = 1, tf = 1, colors = {}, indicators = [], onHover = null,
  lib = null } = {}) {
  const C = { ...PALETTE, ...colors };
  const upVol = alpha(C.up, 0.35);
  const downVol = alpha(C.down, 0.35);
  let data = { candles: [], solUsd: 150, marks: [], tf, migratedAt: null, base: null };
  let view = { mode: mode === 'price' ? 'price' : 'mcap', unit: unit === 'coin' ? 'coin' : 'usd', per: per > 0 ? per : 1 };
  let ind = new Set(indicators);
  let L = null; // the library, once it's here
  let chart = null;
  let candles = null;
  let volume = null;
  let bubbles = null;
  let markers = null;
  const fx = {}; // the indicators' series: ma, ema (over the candles), rsi { line }, macd { hist, line, signal }
  let bars = [];
  const stream = createCandleStream();
  let calculatedKey = '';
  let indexBase = null;
  let calc = {}; // the indicators' values, candle by candle
  let at = new Map(); // a candle's time on the axis → its index
  let sent = null; // what the series have: { key, first, t, n }
  let hoverT = null; // the time under the crosshair, or null
  let emitted = '';
  let bubbleKey = '';
  let markKey = null;
  let loading = false;
  let failedAt = -Infinity;
  let dead = false;
  // its words while there's nothing to show yet (over the chart, as text)
  const doc = host && host.ownerDocument ? host.ownerDocument : null;
  const wait = doc ? doc.createElement('p') : null;
  if (wait) {
    wait.className = 'tsg-chart-wait';
    wait.textContent = 'waiting for the first trade…';
    host.append(wait);
  }

  const sec0 = () => (fin(data.base) ? Math.round(data.base / 1000) : 0);
  const px = () => (data.solUsd > 0 ? data.solUsd : 150);
  const val = (x) => valueOf(x, { mode: view.mode, unit: view.unit, solUsd: px(), per: view.per });
  const fmt = () => formatterFor(view.mode, view.unit);
  // its values' format on the axis and the crosshair (a price's tiny steps: 1e-13, or the scale rounds them to 0)
  const priceFormat = () => ({ type: 'custom', formatter: fmt(), minMove: view.mode === 'price' ? 1e-13 : 0.01 });
  const clockOf = (time, secs) => {
    const d = new Date(time * 1000);
    return secs ? `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}` : `${two(d.getHours())}:${two(d.getMinutes())}`;
  };

  function build(lw) {
    if (dead || chart || !lw) return;
    L = lw;
    const T = L.TickMarkType;
    chart = L.createChart(host, {
      autoSize: true,
      layout: {
        background: { type: L.ColorType.Solid, color: C.bg }, textColor: C.axis, fontSize: 11, fontFamily: FONT,
        attributionLogo: false,
        panes: { separatorColor: C.border, separatorHoverColor: C.label },
      },
      grid: { vertLines: { color: C.grid }, horzLines: { color: C.grid } },
      crosshair: {
        mode: L.CrosshairMode.Normal,
        vertLine: { color: C.cross, width: 1, style: L.LineStyle.Dashed, labelBackgroundColor: C.label },
        horzLine: { color: C.cross, width: 1, style: L.LineStyle.Dashed, labelBackgroundColor: C.label },
      },
      rightPriceScale: { borderColor: C.border, scaleMargins: { top: 0.08, bottom: 0.26 }, entireTextOnly: true },
      timeScale: {
        borderColor: C.border, timeVisible: true, secondsVisible: true, rightOffset: 4, barSpacing: BAR_W, minBarSpacing: MIN_W,
        maxBarSpacing: MAX_W, shiftVisibleRangeOnNewBar: true,
        tickMarkFormatter: (time, type) => (type === T.TimeWithSeconds ? clockOf(time, true) : type === T.Time ? clockOf(time, false)
          : `${new Date(time * 1000).getMonth() + 1}/${new Date(time * 1000).getDate()}`),
      },
      localization: { timeFormatter: (time) => clockOf(time, !(data.tf >= 60)) },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: { time: true, price: true }, axisDoubleClickReset: true },
      kineticScroll: { touch: true, mouse: false },
    });
    candles = chart.addSeries(L.CandlestickSeries, {
      upColor: C.up, downColor: C.down, borderVisible: false, wickUpColor: C.up, wickDownColor: C.down, priceLineVisible: true,
      priceLineStyle: L.LineStyle.Dashed, lastValueVisible: true, lastPriceAnimation: L.LastPriceAnimationMode.Disabled,
      priceFormat: priceFormat(),
    });
    // its volume: a scale of its own ('': an overlay) in the bottom fifth
    volume = chart.addSeries(L.HistogramSeries, { priceScaleId: '', priceFormat: { type: 'volume' }, lastValueVisible: false,
      priceLineVisible: false });
    volume.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    bubbles = new TradeBubbles(C);
    candles.attachPrimitive(bubbles);
    markers = L.createSeriesMarkers(candles, []);
    chart.subscribeCrosshairMove(onCross);
    syncFx();
    sync();
  }
  // the library, the first time there's something to chart (and again a while after it couldn't come)
  function ensure() {
    if (chart || dead || loading || Date.now() - failedAt < RETRY_MS) return;
    loading = true;
    import('lightweight-charts').then((m) => {
      loading = false;
      build(m);
    }, () => {
      loading = false;
      failedAt = Date.now();
      if (wait && !dead) wait.textContent = 'The chart didn\'t load: check your connection.';
    });
  }

  // the indicators' series: the averages over the candles, RSI and MACD in panes of their own under them (a pane goes
  // with its last series)
  function syncFx() {
    if (!chart) return;
    if (fx.ma && !ind.has('ma')) {
      chart.removeSeries(fx.ma);
      delete fx.ma;
    }
    if (fx.ema && !ind.has('ema')) {
      chart.removeSeries(fx.ema);
      delete fx.ema;
    }
    if (fx.rsi && !ind.has('rsi')) {
      chart.removeSeries(fx.rsi.line);
      delete fx.rsi;
    }
    if (fx.macd && !ind.has('macd')) {
      for (const s of [fx.macd.hist, fx.macd.line, fx.macd.signal]) chart.removeSeries(s);
      delete fx.macd;
    }
    const line = (color, more = {}) => ({ color, lineWidth: 2, priceLineVisible: false, lastValueVisible: false,
      crosshairMarkerVisible: false, priceFormat: priceFormat(), ...more });
    if (ind.has('ma') && !fx.ma) fx.ma = chart.addSeries(L.LineSeries, line(C.ma));
    if (ind.has('ema') && !fx.ema) fx.ema = chart.addSeries(L.LineSeries, line(C.ema));
    if (ind.has('rsi') && !fx.rsi) {
      const pane = chart.addPane();
      const l = pane.addSeries(L.LineSeries, line(C.ema, { lineWidth: 1, lastValueVisible: true,
        priceFormat: { type: 'price', precision: 1, minMove: 0.1 } }));
      for (const level of [70, 30]) {
        l.createPriceLine({ price: level, color: C.axis, lineWidth: 1, lineStyle: L.LineStyle.Dashed, axisLabelVisible: true, title: '' });
      }
      fx.rsi = { line: l };
    }
    if (ind.has('macd') && !fx.macd) {
      const pane = chart.addPane();
      const hist = pane.addSeries(L.HistogramSeries, { priceFormat: priceFormat(), priceLineVisible: false, lastValueVisible: false });
      const l = pane.addSeries(L.LineSeries, line(C.ma, { lineWidth: 1 }));
      const signal = pane.addSeries(L.LineSeries, line(C.mig, { lineWidth: 1 }));
      fx.macd = { hist, line: l, signal };
    }
    // the candles' pane three times an indicator's
    chart.panes().forEach((p, i) => p.setStretchFactor(i === 0 ? 3 : 1));
    sent = null;
  }
  // [name, series] of each indicator's series shown
  const fxSeries = () => [['ma', fx.ma], ['ema', fx.ema], ['rsi', fx.rsi && fx.rsi.line], ['macd', fx.macd && fx.macd.line],
    ['signal', fx.macd && fx.macd.signal], ['hist', fx.macd && fx.macd.hist]].filter(([, s]) => s);
  const fxValue = (name, i) => {
    if (name === 'ma' || name === 'ema' || name === 'rsi') return calc[name] ? calc[name][i] : null;
    if (!calc.macd) return null;
    return name === 'macd' ? calc.macd.line[i] : name === 'signal' ? calc.macd.signal[i] : calc.macd.hist[i];
  };
  const candleOf = (b) => ({ time: sec0() + b.t, open: val(b.o), high: val(b.h), low: val(b.l), close: val(b.c) });
  const volOf = (b) => ({ time: sec0() + b.t, value: b.v || 0, color: b.c >= b.o ? upVol : downVol });
  const pointOf = (name, b, i) => {
    const time = sec0() + b.t;
    const v = fxValue(name, i);
    if (v === null || !fin(v)) return { time };
    return name === 'hist' ? { time, value: v, color: v >= 0 ? upVol : downVol } : { time, value: v };
  };

  function setWait(on) {
    if (wait && wait.hidden === on) wait.hidden = !on;
  }

  // the market's candles to the series: all of them when what they show changed (the coin, its candle size, the view,
  // the indicators, older history), else only the newest candle again and any after it
  function sync() {
    const cd = Array.isArray(data.candles) ? data.candles : [];
    if (!chart) {
      setWait(true);
      return;
    }
    const changed = stream.update(cd, data.tf);
    bars = changed.bars;
    const s0 = sec0();
    const key = `${view.mode}|${view.unit}|${view.per}|${data.tf}|${px()}|${s0}|${fxSeries().map(([n]) => n).join(',')}`;
    const resetIndex = changed.reset || indexBase !== s0;
    if (resetIndex) at.clear();
    for (let i = resetIndex ? 0 : changed.from; i < bars.length; i++) at.set(s0 + bars[i].t, i);
    indexBase = s0;
    if (changed.changed || calculatedKey !== key) {
      const closes = fxSeries().length ? bars.map((b) => val(b.c)) : [];
      calc = { ma: fx.ma ? sma(closes, 20) : null, ema: fx.ema ? ema(closes, 9) : null, rsi: fx.rsi ? rsi(closes, 14) : null,
        macd: fx.macd ? macd(closes) : null };
      calculatedKey = key;
    }
    const first = bars.length ? bars[0].t : null;
    // (another coin's candles come as another array: always all of them again)
    if (changed.reset || !sent || sent.arr !== cd || sent.key !== key || sent.first !== first || bars.length < sent.n) {
      candles.setData(bars.map(candleOf));
      volume.setData(bars.map(volOf));
      for (const [name, s] of fxSeries()) s.setData(bars.map((b, i) => pointOf(name, b, i)));
      sent = { arr: cd, key, first, t: bars.length ? bars[bars.length - 1].t : -Infinity, n: bars.length };
    } else if (bars.length && changed.changed) {
      let i = bars.length - 1;
      while (i > 0 && bars[i].t > sent.t) i--;
      for (let j = i; j < bars.length; j++) {
        if (bars[j].t < sent.t) continue;
        candles.update(candleOf(bars[j]));
        volume.update(volOf(bars[j]));
        for (const [name, s] of fxSeries()) s.update(pointOf(name, bars[j], j));
      }
      sent.t = bars[bars.length - 1].t;
      sent.n = bars.length;
    }
    // the player's trades and the migration, on the candle each fell in
    const span = data.tf > 1 ? data.tf : 1;
    const bucket = (t) => at.get(s0 + Math.floor(t / span) * span);
    const items = [];
    for (const m of data.marks || []) {
      const i = m && fin(m.t) ? bucket(m.t) : undefined;
      if (i === undefined) continue;
      const b = bars[i];
      items.push({ time: s0 + b.t, buy: m.side === 'buy', low: val(b.l), high: val(b.h) });
    }
    const bk = JSON.stringify(items);
    if (bk !== bubbleKey) {
      bubbleKey = bk;
      bubbles.set(items);
    }
    const mi = fin(data.migratedAt) ? bucket(data.migratedAt) : undefined;
    const mk = mi === undefined ? '' : String(s0 + bars[mi].t);
    if (mk !== markKey) {
      markKey = mk;
      markers.setMarkers(mk ? [{ time: s0 + bars[mi].t, position: 'aboveBar', shape: 'arrowDown', color: C.mig, text: 'Migrated' }] : []);
    }
    setWait(!bars.length);
    emit();
  }

  // the crosshair moved (or left): its candle for the page's legend
  function onCross(p) {
    const t = p && p.point && p.time !== undefined && p.time !== null ? Number(p.time) : NaN;
    hoverT = Number.isFinite(t) ? t : null;
    emit();
  }
  // the page's legend: the candle under the crosshair, else the newest (only when it changed)
  function emit() {
    if (typeof onHover !== 'function') return;
    if (!bars.length) {
      if (emitted !== 'none') {
        emitted = 'none';
        onHover(null);
      }
      return;
    }
    const hi = hoverT === null ? undefined : at.get(hoverT);
    const hovering = hi !== undefined;
    const i = hovering ? hi : bars.length - 1;
    const b = bars[i];
    const fxNow = { ma: fxValue('ma', i), ema: fxValue('ema', i), rsi: fxValue('rsi', i), macd: fxValue('macd', i),
      signal: fxValue('signal', i), hist: fxValue('hist', i) };
    const key = `${b.t}|${b.o}|${b.h}|${b.l}|${b.c}|${b.v}|${hovering}|${view.mode}|${view.unit}|${view.per}|${px()}|${JSON.stringify(fxNow)}`;
    if (key === emitted) return;
    emitted = key;
    onHover({ t: b.t, o: val(b.o), h: val(b.h), l: val(b.l), c: val(b.c), vol: b.v, buys: b.b, sells: b.s,
      ch: b.o > 0 ? b.c / b.o - 1 : 0, hovering, fmt: fmt(), fx: fxNow, ind: [...ind] });
  }

  const barSpacing = () => (chart ? chart.timeScale().options().barSpacing : BAR_W);
  if (lib) build(lib);
  return {
    // { candles (1-second, market caps in SOL), solUsd, marks: [{ t, side }], tf, migratedAt, base (the page's clock in
    // ms when the market read 0) }
    set(d) {
      data = { ...data, ...d };
      if (!chart && Array.isArray(data.candles) && data.candles.length) ensure();
      sync();
    },
    // its two switches: { mode: 'mcap' | 'price', unit: 'usd' | 'coin', per (the run's coin a SOL) }
    view(v) {
      view = {
        mode: v && v.mode === 'price' ? 'price' : v && v.mode === 'mcap' ? 'mcap' : view.mode,
        unit: v && v.unit === 'coin' ? 'coin' : v && v.unit === 'usd' ? 'usd' : view.unit,
        per: v && v.per > 0 ? v.per : view.per,
      };
      if (!chart) return;
      const f = priceFormat();
      candles.applyOptions({ priceFormat: f });
      for (const [name, s] of fxSeries()) if (name !== 'rsi') s.applyOptions({ priceFormat: f });
      sent = null;
      sync();
    },
    // the indicators shown: any of 'ma', 'ema', 'rsi', 'macd'
    indicators(list) {
      ind = new Set(Array.isArray(list) ? list : []);
      if (!chart) return;
      syncFx();
      sync();
    },
    // back to now, at its first zoom
    fit() {
      if (!chart) return;
      chart.timeScale().applyOptions({ barSpacing: BAR_W });
      chart.timeScale().scrollToRealTime();
    },
    toNow() {
      if (chart) chart.timeScale().scrollToRealTime();
    },
    zoom(dir) {
      if (!chart || !bars.length) return;
      const w = barSpacing() * (dir > 0 ? 1.25 : 1 / 1.25);
      chart.timeScale().applyOptions({ barSpacing: Math.max(MIN_W, Math.min(MAX_W, w)) });
    },
    // (the library draws by itself when anything changes)
    redraw() {},
    get state() {
      return { ready: Boolean(chart), barW: barSpacing(), mode: view.mode, unit: view.unit, indicators: [...ind] };
    },
    destroy() {
      dead = true;
      if (chart) {
        chart.unsubscribeCrosshairMove(onCross);
        candles.detachPrimitive(bubbles);
        markers.detach();
        chart.remove();
        chart = null;
      }
      if (wait) wait.remove();
    },
  };
}
