// Phomo's chart controls and original drawing tools. The underlying chart is the existing public Lightweight Charts
// adapter; no third-party chart UI, private API, network data or external trading action is used here.
import { createGChart, PALETTE } from './gchart.js';
import { valueOf, formatterFor } from './gngm-data.js';
import { createCandleStream } from './chart-stream.js';

export const PHOMO_CHART_STYLES = Object.freeze(['candles', 'bars', 'line', 'area']);
export const PHOMO_DRAW_TOOLS = Object.freeze(['cursor', 'trend', 'horizontal', 'vertical', 'ray', 'rectangle', 'text', 'measure']);
const fin = (v) => typeof v === 'number' && Number.isFinite(v);
const copy = (x) => JSON.parse(JSON.stringify(x));
const textOf = (s) => String(s || '').replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '').trim().slice(0, 120);
const pointOf = (p) => p && fin(p.t) && fin(p.v) && p.v > 0 ? { t: p.t, v: p.v } : null;

// Drawings may extend into empty chart space. Interpolate only the annotation's time anchor;
// no market candle is added or guessed. Gaps between retained bars keep their actual elapsed time.
export function annotationTimeAt(logical, times, interval = 60) {
  if (!fin(logical) || !times?.length) return null;
  const last = times.length - 1, step = interval > 0 ? interval : 1;
  if (logical <= 0) return times[0] + logical * step;
  if (logical >= last) return times[last] + (logical - last) * step;
  const i = Math.floor(logical); return times[i] + (logical - i) * (times[i + 1] - times[i]);
}
export function annotationLogicalAt(time, times, interval = 60) {
  if (!fin(time) || !times?.length) return null;
  const last = times.length - 1, step = interval > 0 ? interval : 1;
  if (time <= times[0]) return (time - times[0]) / step;
  if (time >= times[last]) return last + (time - times[last]) / step;
  let lo = 0, hi = last;
  while (lo + 1 < hi) { const mid = (lo + hi) >>> 1; if (times[mid] <= time) lo = mid; else hi = mid; }
  return lo + (time - times[lo]) / (times[hi] - times[lo]);
}

// Annotation history is bounded and contains only user-drawn geometry. Anchors are time + raw market cap in SOL,
// so changing USD/price/chart style never changes the annotation's meaning.
export function createDrawingBook(limit = 80) {
  let rows = [], before = [], after = [], sequence = 0;
  const cap = Math.max(1, Math.min(200, Math.floor(limit) || 80));
  const change = (next) => { before.push(copy(rows)); if (before.length > 50) before.shift(); rows = next; after = []; };
  return {
    get rows() { return copy(rows); }, get canUndo() { return before.length > 0; }, get canRedo() { return after.length > 0; },
    add(shape) {
      const one = ['horizontal', 'vertical', 'text'].includes(shape?.type);
      const points = (shape?.points || []).map(pointOf);
      if (!PHOMO_DRAW_TOOLS.includes(shape?.type) || shape.type === 'cursor' || points.length !== (one ? 1 : 2) || points.some((p) => !p)) return null;
      const row = { id: ++sequence, type: shape.type, points, text: textOf(shape.text), locked: false };
      change([...rows, row].slice(-cap)); return row.id;
    },
    replace(id, points) {
      const found = rows.find((r) => r.id === id), next = (points || []).map(pointOf);
      if (!found || found.locked || next.length !== found.points.length || next.some((p) => !p)) return false;
      change(rows.map((r) => r.id === id ? { ...r, points: next } : r)); return true;
    },
    remove(id) { if (!rows.some((r) => r.id === id && !r.locked)) return false; change(rows.filter((r) => r.id !== id)); return true; },
    lock(id) { const r = rows.find((x) => x.id === id); if (!r) return false; change(rows.map((x) => x.id === id ? { ...x, locked: !x.locked } : x)); return !r.locked; },
    clear() { if (rows.some((r) => !r.locked)) change(rows.filter((r) => r.locked)); },
    undo() { if (!before.length) return false; after.push(copy(rows)); rows = before.pop(); return true; },
    redo() { if (!after.length) return false; before.push(copy(rows)); rows = after.pop(); return true; },
  };
}

class Drawings {
  constructor(owner) { this.owner = owner; this.request = null; this.views = [{ zOrder: () => 'top', renderer: () => ({ draw: (t) => this.draw(t) }) }]; }
  attached({ requestUpdate }) { this.request = requestUpdate; }
  detached() { this.request = null; }
  paneViews() { return this.views; }
  updateAllViews() {}
  refresh() { this.request?.(); }
  draw(target) {
    const a = this.owner;
    if (!a.visible()) return;
    target.useMediaCoordinateSpace(({ context: g, mediaSize }) => {
      const { width: w, height: h } = mediaSize;
      g.save(); g.beginPath(); g.rect(0, 0, w, h); g.clip();
      for (const row of a.rows()) {
        const p = row.points.map(a.screen); if (p.some((x) => !x)) continue;
        const [u, v = u] = p;
        const chosen = row.id === a.selected();
        g.strokeStyle = chosen ? '#ffb799' : '#8aa6ff'; g.fillStyle = g.strokeStyle; g.lineWidth = chosen ? 2 : 1.5;
        g.setLineDash(row.type === 'measure' ? [4, 3] : []);
        const line = (x1, y1, x2, y2) => { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
        if (row.type === 'horizontal') line(0, u.y, w, u.y);
        else if (row.type === 'vertical') line(u.x, 0, u.x, h);
        else if (row.type === 'rectangle' || row.type === 'measure') {
          g.globalAlpha = 0.12; g.fillRect(Math.min(u.x, v.x), Math.min(u.y, v.y), Math.abs(v.x - u.x), Math.abs(v.y - u.y));
          g.globalAlpha = 1; g.strokeRect(Math.min(u.x, v.x), Math.min(u.y, v.y), Math.abs(v.x - u.x), Math.abs(v.y - u.y));
          if (row.type === 'measure') {
            const change = (row.points[1].v / row.points[0].v - 1) * 100;
            g.font = '11px "Phomo Aeonik", Arial, sans-serif'; g.textAlign = 'left';
            g.fillText(`${change >= 0 ? '+' : ''}${change.toFixed(2)}% · ${Math.round(Math.abs(row.points[1].t - row.points[0].t))}s`, Math.min(u.x, v.x) + 5, Math.min(u.y, v.y) - 7);
          }
        } else if (row.type === 'text') { g.font = '12px "Phomo Aeonik", Arial, sans-serif'; g.textAlign = 'left'; g.fillText(row.text || 'Note', u.x, u.y); }
        else if (row.type === 'ray') {
          const dx = v.x - u.x, dy = v.y - u.y;
          if (Math.abs(dx) < 0.01) line(u.x, u.y, u.x, dy < 0 ? 0 : h);
          else { const end = dx > 0 ? w : 0; line(u.x, u.y, end, u.y + (end - u.x) * dy / dx); }
        } else line(u.x, u.y, v.x, v.y);
        if (chosen && !row.locked) for (const q of p) { g.beginPath(); g.arc(q.x, q.y, 4, 0, Math.PI * 2); g.fill(); }
      }
      g.restore();
    });
  }
}

export function createPhomoChart(host, options = {}) {
  let L = null, chart = null, main = null, alt = null, altMarkers = null, base = null, primitive = null, dead = false;
  let data = { candles: [], solUsd: 150, tf: options.tf || 60, marks: [], base: 0 };
  let barsCache = [], barsDirty = true, barsBase = null, barsChange = { reset: true, changed: true, from: 0 };
  const stream = createCandleStream();
  let altRevision = '', markersRevision = '';
  let levels = [], levelSeries = null, levelLines = [], levelsRevision = '';
  let view = { mode: options.mode || 'mcap', unit: 'usd', per: 1 };
  let chartStyle = 'candles', tool = 'cursor', selected = null, draft = null, visible = true, dragging = null;
  let scale = 'normal', auto = true, grid = true, volume = true, crosshair = true, rangeSeconds = null;
  let indicators = options.indicators || [], pendingFit = false, initialFit = false;
  const book = createDrawingBook();
  const colors = { ...PALETTE, ...options.colors };
  const waiting = host.ownerDocument?.createElement('p');
  if (waiting) { waiting.className = 'tsg-chart-wait'; waiting.textContent = 'Loading chart…'; host.append(waiting); }
  const factor = () => valueOf(1, { ...view, solUsd: data.solUsd });
  const times = () => {
    if (!barsDirty) return barsCache;
    const next = stream.update(data.candles, data.tf), epoch = Math.round((data.base || 0) / 1000);
    const reset = next.reset || epoch !== barsBase, from = reset ? 0 : next.from;
    barsChange = { changed: next.changed || reset, reset, from };
    if (barsChange.changed) {
      barsCache.length = from;
      for (let i = from; i < next.bars.length; i++) barsCache.push({ ...next.bars[i], time: epoch + next.bars[i].t });
    }
    barsDirty = false; barsBase = epoch;
    return barsCache;
  };
  const active = () => alt || main;
  const state = () => ({ ready: Boolean(base?.state.ready), style: chartStyle, tool, selected, visible, scale, auto, grid, volume,
    crosshair, canUndo: book.canUndo, canRedo: book.canRedo, drawings: book.rows, indicators: [...indicators], rangeSeconds });
  const notify = () => { primitive?.refresh(); options.onChange?.(state()); };
  const screen = (p) => {
    const scale = chart?.timeScale();
    let x = scale?.timeToCoordinate(p.t);
    if (!fin(x) && scale?.logicalToCoordinate) x = scale.logicalToCoordinate(annotationLogicalAt(p.t, times().map((b) => b.time), data.tf));
    const y = active()?.priceToCoordinate(p.v * factor());
    return fin(x) && fin(y) ? { x, y } : null;
  };
  function anchor(p) {
    if (!p || !chart || !active()) return null;
    const scale = chart.timeScale();
    let t = fin(p.time) ? p.time : scale.coordinateToTime(p.point?.x);
    if (!fin(t) && scale.coordinateToLogical) t = annotationTimeAt(scale.coordinateToLogical(p.point?.x), times().map((b) => b.time), data.tf);
    const displayed = active().coordinateToPrice(p.point?.y);
    return pointOf({ t, v: displayed / factor() });
  }
  function hit(point) {
    if (!point || !visible) return null;
    let nearest = null, distance = 9;
    for (const row of [...book.rows].reverse()) {
      const pts = row.points.map(screen); if (pts.some((p) => !p)) continue;
      for (let i = 0; i < pts.length; i++) {
        const d = Math.hypot(pts[i].x - point.x, pts[i].y - point.y);
        if (d < distance) { nearest = { row, index: i }; distance = d; }
      }
      const [a, b = a] = pts;
      let d = Infinity;
      if (row.type === 'horizontal') d = Math.abs(point.y - a.y);
      else if (row.type === 'vertical') d = Math.abs(point.x - a.x);
      else if (row.type === 'rectangle' || row.type === 'measure') {
        const left = Math.min(a.x, b.x), right = Math.max(a.x, b.x), top = Math.min(a.y, b.y), bottom = Math.max(a.y, b.y);
        if (point.x >= left - 5 && point.x <= right + 5) d = Math.min(Math.abs(point.y - top), Math.abs(point.y - bottom));
        if (point.y >= top - 5 && point.y <= bottom + 5) d = Math.min(d, Math.abs(point.x - left), Math.abs(point.x - right));
      } else if (pts.length > 1) {
        const dx = b.x - a.x, dy = b.y - a.y, len = dx * dx + dy * dy;
        const k = len ? Math.max(0, Math.min(row.type === 'ray' ? Infinity : 1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / len)) : 0;
        d = Math.hypot(point.x - a.x - k * dx, point.y - a.y - k * dy);
      }
      if (d < distance) { nearest = { row, index: null }; distance = d; }
    }
    return nearest;
  }
  async function click(p) {
    if (dead || dragging || !p.point) return;
    if (tool === 'cursor') { selected = hit(p.point)?.row.id ?? null; notify(); return; }
    const a = anchor(p); if (!a) return;
    if (tool === 'text') {
      const words = textOf(await options.requestText?.()); if (dead || !words) return;
      selected = book.add({ type: 'text', points: [a], text: words });
    } else if (tool === 'horizontal' || tool === 'vertical') selected = book.add({ type: tool, points: [a] });
    else if (!draft) { draft = { id: -1, type: tool, points: [a, a] }; notify(); return; }
    else { selected = book.add({ type: draft.type, points: [draft.points[0], a] }); draft = null; }
    tool = 'cursor'; draft = null; applySettings(); notify();
  }
  function move(p) {
    if (draft && !dragging) { const a = anchor(p); if (a) { draft.points[1] = a; primitive?.refresh(); } }
    if (alt && fin(p.time)) {
      const b = times().find((x) => x.time === p.time); if (!b) return;
      options.onHover?.({ o: b.o * factor(), h: b.h * factor(), l: b.l * factor(), c: b.c * factor(), ch: b.c / b.o - 1,
        vol: b.v, hovering: true, fmt: formatterFor(view.mode, 'usd') });
    }
  }
  function attachDrawing() {
    if (!active()) return;
    primitive = new Drawings({ visible: () => visible, selected: () => selected, screen,
      rows: () => [...book.rows.filter((r) => !dragging || r.id !== dragging.row.id), ...(draft ? [draft] : [])] });
    active().attachPrimitive(primitive);
  }
  function recreateStyle() {
    if (!chart || !main) return;
    clearLevels();
    if (primitive) active().detachPrimitive(primitive);
    if (altMarkers) { altMarkers.detach(); altMarkers = null; }
    if (alt) { chart.removeSeries(alt); alt = null; }
    main.applyOptions({ visible: chartStyle === 'candles' });
    if (chartStyle !== 'candles') {
      const definition = { bars: L.BarSeries, line: L.LineSeries, area: L.AreaSeries }[chartStyle];
      alt = chart.addSeries(definition, { upColor: colors.up, downColor: colors.down, color: colors.up,
        lineColor: colors.up, topColor: 'rgba(48,200,130,.2)', bottomColor: 'rgba(48,200,130,0)', lineWidth: 2,
        priceFormat: { type: 'custom', formatter: formatterFor(view.mode, 'usd'), minMove: view.mode === 'price' ? 1e-13 : 0.01 } });
      altMarkers = L.createSeriesMarkers(alt, []);
    }
    altRevision = ''; markersRevision = '';
    attachDrawing(); syncAlt(); applySettings(); syncLevels();
  }
  function clearLevels() { for (const line of levelLines) levelSeries?.removePriceLine?.(line); levelLines = []; levelSeries = null; levelsRevision = ''; }
  function syncLevels() {
    const series = active(); if (!series?.createPriceLine) return;
    const revision = JSON.stringify([levels, factor()]); if (series === levelSeries && revision === levelsRevision) return;
    clearLevels(); levelSeries = series; levelsRevision = revision;
    levelLines = levels.map(row => series.createPriceLine({ price: row.value * factor(), title: row.title,
      color: row.color, lineWidth: 1, lineStyle: 2, axisLabelVisible: true }));
  }
  function syncAlt() {
    if (!alt) return;
    const bars = times(), f = factor(), revision = `${chartStyle}|${f}|${data.tf}|${barsBase}`;
    const convert = (b) => chartStyle === 'bars' ? { time: b.time, open: b.o * f, high: b.h * f, low: b.l * f, close: b.c * f } : { time: b.time, value: b.c * f };
    if (revision !== altRevision || barsChange.reset) alt.setData(bars.map(convert));
    else if (barsChange.changed) for (let i = barsChange.from; i < bars.length; i++) alt.update(convert(bars[i]));
    altRevision = revision;
    const nextMarkers = JSON.stringify([data.marks, data.tf, barsBase, bars[0]?.time, bars.at(-1)?.time]);
    if (nextMarkers === markersRevision) return;
    markersRevision = nextMarkers;
    const available = new Set(bars.map((b) => b.time));
    const marks = (data.marks || []).filter((m) => fin(m.t) && ['buy', 'sell'].includes(m.side)).slice(-200).map((m) => ({
      time: Math.round((data.base || 0) / 1000) + Math.floor(m.t / data.tf) * data.tf,
      position: m.side === 'buy' ? 'belowBar' : 'aboveBar', shape: m.side === 'buy' ? 'arrowUp' : 'arrowDown',
      color: m.side === 'buy' ? colors.up : colors.down, text: m.side === 'buy' ? 'B' : 'S',
    })).filter((m) => available.has(m.time)).sort((a, b) => a.time - b.time);
    altMarkers?.setMarkers(marks);
  }
  function applySettings() {
    if (!chart) return;
    chart.applyOptions({ grid: { vertLines: { visible: grid }, horzLines: { visible: grid } },
      crosshair: { vertLine: { visible: crosshair, labelVisible: crosshair }, horzLine: { visible: crosshair, labelVisible: crosshair } },
      rightPriceScale: { mode: scale === 'log' ? L.PriceScaleMode.Logarithmic : scale === 'percent' ? L.PriceScaleMode.Percentage : L.PriceScaleMode.Normal, autoScale: auto },
      handleScroll: { pressedMouseMove: tool === 'cursor', horzTouchDrag: tool === 'cursor' } });
    // The base adapter owns its first histogram as volume; later histograms are indicator panes.
    volumeSeries?.applyOptions({ visible: volume });
  }
  let volumeSeries = null;
  function build(lib) {
    if (dead) return;
    L = lib;
    const wrapped = { ...lib, createChart(...args) {
      args[1] = { ...args[1], layout: { ...args[1]?.layout, fontFamily: 'Phomo Aeonik, Arial, sans-serif', fontSize: 12 } };
      chart = lib.createChart(...args);
      return new Proxy(chart, { get(target, key) {
        if (key === 'addSeries') return (definition, ...rest) => {
          const series = target.addSeries(definition, ...rest);
          if (!main && definition === lib.CandlestickSeries) main = series;
          if (!volumeSeries && definition === lib.HistogramSeries) volumeSeries = series;
          return series;
        };
        const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
      } });
    } };
    base = createGChart(host, { ...options, ...view, tf: data.tf, indicators, lib: wrapped });
    waiting?.remove(); base.set(data); recreateStyle();
    chart.subscribeClick(click); chart.subscribeCrosshairMove(move);
    fitInitial();
    if (rangeSeconds) api.range(rangeSeconds); if (pendingFit) api.fit(); notify();
  }
  function fitInitial() {
    if (initialFit || !chart || !data.candles.length) return;
    initialFit = true;
    if (!rangeSeconds) chart.timeScale().fitContent();
  }
  const pointer = (e) => { const rect = host.getBoundingClientRect(); return { point: { x: e.clientX - rect.left, y: e.clientY - rect.top } }; };
  const down = (e) => {
    if (chart && e.button === 0) host.focus?.({ preventScroll: true });
    if (tool !== 'cursor' || !chart || e.button !== 0) return;
    const found = hit(pointer(e).point); if (!found || found.row.locked) return;
    selected = found.row.id; dragging = { ...found, start: anchor(pointer(e)) }; draft = copy(found.row); chart.applyOptions({ handleScroll: false });
    e.preventDefault(); e.stopPropagation(); host.setPointerCapture?.(e.pointerId); notify();
  };
  const drag = (e) => { if (!dragging) return; const a = anchor(pointer(e)); if (!a) return;
    if (dragging.index == null && dragging.start) {
      const dt = a.t - dragging.start.t, dv = a.v - dragging.start.v;
      const next = dragging.row.points.map((p) => ({ t: p.t + dt, v: p.v + dv }));
      if (next.every(pointOf)) draft.points = next;
    } else draft.points[dragging.index ?? 0] = a;
    primitive?.refresh(); };
  const up = (e) => { if (!dragging) return; const row = draft; book.replace(dragging.row.id, row.points); dragging = null; draft = null;
    host.releasePointerCapture?.(e.pointerId); applySettings(); notify(); };
  const cancel = () => { dragging = null; draft = null; applySettings(); notify(); };
  const keydown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.stopPropagation(); if (e.shiftKey) api.redo(); else api.undo(); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); e.stopPropagation(); api.removeSelected(); }
    else if (e.key === 'Escape' && (draft || tool !== 'cursor')) { e.preventDefault(); e.stopPropagation(); api.drawTool('cursor'); }
  };
  host.addEventListener('pointerdown', down, true); host.addEventListener('pointermove', drag, true);
  host.addEventListener('pointerup', up, true); host.addEventListener('pointercancel', cancel, true); host.addEventListener('keydown', keydown);
  const api = {
    set(next) { data = { ...data, ...next }; barsDirty = true; base?.set(data); times(); syncAlt(); syncLevels(); fitInitial(); if (barsChange.changed) primitive?.refresh(); },
    view(next) { if (Object.entries(next).every(([key, value]) => view[key] === value)) return; view = { ...view, ...next }; base?.view(next); if (alt) alt.applyOptions({ priceFormat: { type: 'custom', formatter: formatterFor(view.mode, 'usd'), minMove: view.mode === 'price' ? 1e-13 : .01 } }); syncAlt(); syncLevels(); notify(); },
    indicators(next) { indicators = [...next]; base?.indicators(next); notify(); },
    levels(next) { levels = (Array.isArray(next) ? next : []).filter(row => fin(row?.value) && row.value > 0).slice(0, 100)
      .map(row => ({ value: row.value, title: textOf(row.title).slice(0, 30), color: /^#[0-9a-f]{6}$/i.test(row.color) ? row.color : colors.axis })); syncLevels(); },
    style(next) { if (PHOMO_CHART_STYLES.includes(next)) { chartStyle = next; recreateStyle(); notify(); } },
    settings(patch) { if (typeof patch.grid === 'boolean') grid = patch.grid; if (typeof patch.volume === 'boolean') volume = patch.volume;
      if (typeof patch.crosshair === 'boolean') crosshair = patch.crosshair; applySettings(); notify(); },
    scale(next) { if (['normal', 'log', 'percent'].includes(next)) { scale = next; applySettings(); notify(); } },
    auto(next) { auto = Boolean(next); applySettings(); notify(); },
    range(seconds) {
      rangeSeconds = fin(seconds) && seconds > 0 ? seconds : null;
      if (!chart) return;
      const bars = times(); if (!bars.length) return;
      const to = bars.at(-1).time, from = rangeSeconds ? Math.max(bars[0].time, to - rangeSeconds) : bars[0].time;
      if (to > from) chart.timeScale().setVisibleRange({ from, to }); else chart.timeScale().setVisibleLogicalRange({ from: -5, to: 5 });
      notify();
    },
    fit() { pendingFit = !chart; rangeSeconds = null; chart?.timeScale().fitContent(); notify(); }, zoom(dir) { base?.zoom(dir); },
    toNow() { base?.toNow(); }, redraw() { primitive?.refresh(); },
    drawTool(next) { if (!PHOMO_DRAW_TOOLS.includes(next)) return; tool = next; draft = null; selected = null; applySettings(); notify(); },
    undo() { draft = null; book.undo(); selected = null; notify(); }, redo() { book.redo(); selected = null; notify(); },
    removeSelected() { book.remove(selected); selected = null; notify(); }, lockSelected() { book.lock(selected); notify(); },
    showDrawings(on) { visible = Boolean(on); notify(); }, clearDrawings() { book.clear(); selected = null; notify(); },
    screenshot() { return chart?.takeScreenshot(true, false) || null; }, get state() { return state(); },
    destroy() { if (dead) return; dead = true;
      clearLevels();
      host.removeEventListener('pointerdown', down, true); host.removeEventListener('pointermove', drag, true);
      host.removeEventListener('pointerup', up, true); host.removeEventListener('pointercancel', cancel, true); host.removeEventListener('keydown', keydown);
      if (chart) { chart.unsubscribeClick(click); chart.unsubscribeCrosshairMove(move); if (primitive) active()?.detachPrimitive(primitive); }
      altMarkers?.detach();
      base?.destroy(); waiting?.remove(); chart = null; main = null; alt = null; }
  };
  if (options.lib) build(options.lib);
  else import('lightweight-charts').then(build, () => { if (!dead && waiting) waiting.textContent = 'Chart unavailable. Reopen the token to retry.'; });
  return api;
}
