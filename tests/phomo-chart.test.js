import test from 'node:test';
import assert from 'node:assert/strict';
import { createDrawingBook, createPhomoChart, annotationTimeAt, annotationLogicalAt } from '../src/games/trenchingsimulator/boards/phomo-chart.js';

test('Phomo drawings validate geometry, preserve locked annotations, and bound reversible history', () => {
  const book = createDrawingBook(2);
  const a = { t: 100, v: 10 }, b = { t: 200, v: 20 };
  assert.equal(book.add({ type: 'trend', points: [a] }), null);
  assert.equal(book.add({ type: 'horizontal', points: [{ t: 1, v: -1 }] }), null);
  const one = book.add({ type: 'trend', points: [a, b] });
  const two = book.add({ type: 'text', points: [a], text: 'hello\u202E' });
  assert.equal(book.rows[1].text, 'hello');
  const saved = book.rows; saved[0].points[0].v = 999;
  assert.equal(book.rows[0].points[0].v, 10);
  assert.equal(book.lock(one), true);
  assert.equal(book.replace(one, [b, a]), false);
  assert.equal(book.remove(one), false);
  book.clear(); assert.deepEqual(book.rows.map((r) => r.id), [one]);
  assert.equal(book.undo(), true); assert.deepEqual(book.rows.map((r) => r.id), [one, two]);
  assert.equal(book.redo(), true); assert.deepEqual(book.rows.map((r) => r.id), [one]);
  book.lock(one); book.replace(one, [b, a]); assert.equal(book.rows[0].points[0].v, 20);
  for (let i = 0; i < 80; i++) book.add({ type: 'horizontal', points: [{ t: i, v: i + 1 }] });
  assert.equal(book.rows.length, 2);
  let undos = 0; while (book.undo()) undos++;
  assert.equal(undos, 50);
  book.add({ type: 'vertical', points: [a] }); assert.equal(book.canRedo, false);
});

function fakeLibrary() {
  const c = { series: [], options: [], clicks: new Set(), cross: new Set(), removed: false, ranges: [], fit: 0, now: 0, panes: [0] };
  const ts = { barSpacing: 7 };
  const api = {
    addSeries(def, options = {}, pane = 0) {
      const s = { type: def.type, options, pane, data: [], primitives: [], changes: [], priceLines: [], resets:0, updates:0 };
      Object.assign(s, { setData: (rows) => { s.resets++; s.data = rows; }, update: (row) => { s.updates++; if (s.data.at(-1)?.time === row.time) s.data[s.data.length - 1] = row; else s.data.push(row); },
        applyOptions: (o) => { s.changes.push(o); Object.assign(s.options, o); }, priceScale: () => ({ applyOptions() {} }),
        priceToCoordinate: (v) => v, coordinateToPrice: (v) => v, createPriceLine: (l) => { s.priceLines.push(l); return l; },
        removePriceLine: l => { s.priceLines = s.priceLines.filter(line => line !== l); },
        attachPrimitive: (p) => { s.primitives.push(p); p.attached({ chart: api, series: s, requestUpdate() {} }); },
        detachPrimitive: (p) => { s.primitives = s.primitives.filter((x) => x !== p); p.detached(); } });
      c.series.push(s); return s;
    },
    addPane() { const p = c.panes.length; c.panes.push(p); return { addSeries: (d, o) => api.addSeries(d, o, p), setStretchFactor() {} }; },
    panes: () => c.panes.map((p) => ({ addSeries: (d, o) => api.addSeries(d, o, p), setStretchFactor() {} })),
    removeSeries: (s) => { c.series = c.series.filter((x) => x !== s); },
    applyOptions: (o) => c.options.push(o),
    subscribeClick: (h) => c.clicks.add(h), unsubscribeClick: (h) => c.clicks.delete(h),
    subscribeCrosshairMove: (h) => c.cross.add(h), unsubscribeCrosshairMove: (h) => c.cross.delete(h),
    timeScale: () => ({ applyOptions: (o) => Object.assign(ts, o), options: () => ts, timeToCoordinate: (t) => c.whitespace ? null : t,
      coordinateToTime: (x) => c.whitespace ? null : x, coordinateToLogical: (x) => x, logicalToCoordinate: (x) => x,
      setVisibleRange: (r) => c.ranges.push(r), setVisibleLogicalRange: (r) => c.ranges.push(r),
      scrollToRealTime: () => c.now++, fitContent: () => c.fit++ }),
    takeScreenshot: (...args) => ({ screenshot: true, args }), remove: () => { c.removed = true; },
  };
  const markers = [];
  const lib = { createChart: () => api, createSeriesMarkers: (_, rows) => {
    const m = { rows, setMarkers: (next) => { m.rows = next; }, detach: () => { m.dead = true; } }; markers.push(m); return m;
  }, ColorType: { Solid: 'solid' }, CrosshairMode: { Normal: 0 }, LineStyle: { Dashed: 2 }, LastPriceAnimationMode: { Disabled: 0 },
  TickMarkType: { Time: 3, TimeWithSeconds: 4 }, PriceScaleMode: { Normal: 0, Logarithmic: 1, Percentage: 2 } };
  for (const type of ['Candlestick', 'Line', 'Histogram', 'Bar', 'Area']) lib[`${type}Series`] = { type };
  const listeners = new Map();
  const host = { ownerDocument: { createElement: () => ({ remove() {} }) }, append() {},
    addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: (key) => listeners.delete(key),
    getBoundingClientRect: () => ({ left: 0, top: 0 }) };
  return { c, lib, host, listeners, markers, click: async (x, y) => { for (const h of c.clicks) await h({ time: c.whitespace ? undefined : x, point: { x, y } }); } };
}

test('annotations interpolate and render in chart whitespace without fabricating market history', async () => {
  const times = [100, 160, 400];
  for (const logical of [-2, 0, .5, 1.5, 2, 6]) assert.equal(annotationLogicalAt(annotationTimeAt(logical, times, 60), times, 60), logical);
  assert.equal(annotationTimeAt(1.5, times, 60), 280, 'existing data gaps keep their true times');
  const f = fakeLibrary(), chart = createPhomoChart(f.host, { lib: f.lib });
  const candles = [{ t: 120, o: 10, h: 20, l: 8, c: 15, v: 1 }];
  chart.set({ candles, solUsd: 200 }); f.c.whitespace = true;
  chart.drawTool('horizontal'); await f.click(-3, 2000);
  assert.equal(chart.state.canUndo, true); assert.deepEqual(chart.state.drawings[0].points, [{ t: -60, v: 10 }]);
  assert.equal(candles.length, 1);
  const primitive = f.c.series.find((s) => s.type === 'Candlestick').primitives.at(-1);
  const moves = [];
  const context = new Proxy({ moveTo: (...args) => moves.push(args) }, { get: (target, key) => target[key] || (() => {}) });
  primitive.draw({ useMediaCoordinateSpace: (draw) => draw({ context, mediaSize: { width: 500, height: 300 } }) });
  assert.ok(moves.length > 0, 'whitespace time anchors remain drawable via logical coordinates');
  chart.destroy();
});

test('Phomo chart styles, intervals, indicators, scales and retained-data ranges use real chart APIs', () => {
  const f = fakeLibrary(), chart = createPhomoChart(f.host, { lib: f.lib, tf: 60 });
  const candles = [{ t: 0, o: 10, h: 15, l: 9, c: 14, v: 2 }, { t: 60, o: 14, h: 18, l: 12, c: 16, v: 3 }];
  chart.set({ candles, solUsd: 200, base: 1000000, marks: [{ t: 60, side: 'buy' }] });
  assert.equal(f.c.fit, 1, 'first populated data fits the available chart');
  assert.equal(chart.state.ready, true);
  const main = f.c.series.find((s) => s.type === 'Candlestick');
  assert.equal(main.data[0].open, 2000); assert.equal(main.data[1].close, 3200);
  chart.style('line');
  let line = f.c.series.find((s) => s.type === 'Line');
  assert.equal(main.options.visible, false);
  assert.deepEqual(line.data, [{ time: 1000, value: 2800 }, { time: 1060, value: 3200 }]);
  assert.equal(f.markers.at(-1).rows[0].text, 'B', 'practice swaps stay visible in line mode');
  chart.view({ mode: 'price' }); assert.equal(line.data[0].value, 2800 / 1e9);
  chart.set({ tf: 300 }); assert.equal(line.data.length, 1); assert.equal(line.data[0].value, 3200 / 1e9);
  chart.style('bars'); assert.equal(f.c.series.some((s) => s.type === 'Line'), false);
  assert.equal(f.c.series.find((s) => s.type === 'Bar').data[0].open, 2000 / 1e9);
  chart.style('area'); assert.equal(f.c.series.find((s) => s.type === 'Area').data[0].value, 3200 / 1e9);
  chart.style('candles'); assert.equal(main.options.visible, true);
  chart.indicators(['ma', 'rsi']); assert.deepEqual(chart.state.indicators, ['ma', 'rsi']);
  chart.settings({ grid: false, volume: false, crosshair: false });
  assert.equal(f.c.series.find((s) => s.type === 'Histogram').options.visible, false);
  assert.equal(f.c.options.at(-1).grid.vertLines.visible, false);
  chart.scale('log'); assert.equal(f.c.options.at(-1).rightPriceScale.mode, 1);
  chart.scale('percent'); chart.auto(false); assert.deepEqual(f.c.options.at(-1).rightPriceScale, { mode: 2, autoScale: false });
  chart.set({ tf: 60 }); chart.range(31536000);
  assert.deepEqual(f.c.ranges.at(-1), { from: 1000, to: 1060 }, 'large ranges never invent older history');
  assert.equal(f.c.fit, 1, 'live updates and style changes preserve the chosen zoom');
  chart.fit(); assert.equal(f.c.fit, 2);
  assert.deepEqual(chart.screenshot(), { screenshot: true, args: [true, false] });
  chart.destroy(); assert.equal(f.c.removed, true); assert.equal(f.c.clicks.size, 0); assert.equal(f.c.cross.size, 0);
  assert.equal(f.listeners.size, 0); assert.equal(f.markers[0].dead, true);
});

test('paper order levels preserve exact prices through series changes and remove stale or disabled lines', () => {
  const f = fakeLibrary(), chart = createPhomoChart(f.host, { lib:f.lib, mode:'price' });
  chart.set({ candles:[{t:100,o:100e9,h:110e9,l:90e9,c:105e9,v:2}], solUsd:1 });
  const main=f.c.series.find(s=>s.type==='Candlestick');
  chart.levels([{value:95e9,title:'Paper limit',color:'#818cf8'}]); assert.equal(main.priceLines[0].price,95);
  chart.levels([{value:95e9,title:'Paper limit',color:'#818cf8'}]); assert.equal(main.priceLines.length,1);
  chart.style('line'); assert.equal(main.priceLines.length,0); const line=f.c.series.find(s=>s.type==='Line'); assert.equal(line.priceLines[0].price,95);
  chart.view({mode:'mcap'}); assert.equal(line.priceLines[0].price,95e9);
  chart.levels([]); assert.equal(line.priceLines.length,0); chart.destroy();
});

test('Phomo native drawings retain their market coordinates across price mode, dragging, undo and series changes', async () => {
  const f = fakeLibrary(), chart = createPhomoChart(f.host, { lib: f.lib, requestText: async () => 'Local note' });
  chart.set({ candles: [{ t: 100, o: 10, h: 20, l: 8, c: 15, v: 1 }], solUsd: 200 });
  chart.drawTool('trend'); await f.click(100, 2000); await f.click(200, 4000);
  assert.deepEqual(chart.state.drawings[0].points, [{ t: 100, v: 10 }, { t: 200, v: 20 }]);
  assert.equal(chart.state.tool, 'cursor'); assert.notEqual(chart.state.selected, null);
  chart.view({ mode: 'price' }); chart.style('line');
  assert.deepEqual(chart.state.drawings[0].points, [{ t: 100, v: 10 }, { t: 200, v: 20 }]);
  chart.view({ mode: 'mcap' });
  const event = (x, y) => ({ clientX: x, clientY: y, button: 0, pointerId: 1, preventDefault() {}, stopPropagation() {} });
  f.listeners.get('pointerdown')(event(100, 2000)); f.listeners.get('pointermove')(event(120, 3000)); f.listeners.get('pointerup')(event(120, 3000));
  assert.deepEqual(chart.state.drawings[0].points[0], { t: 120, v: 15 });
  chart.undo(); assert.deepEqual(chart.state.drawings[0].points[0], { t: 100, v: 10 });
  chart.redo(); assert.deepEqual(chart.state.drawings[0].points[0], { t: 120, v: 15 });
  await f.click(120, 3000); chart.lockSelected(); chart.removeSelected(); assert.equal(chart.state.drawings.length, 1);
  chart.drawTool('text'); await f.click(150, 2500); assert.equal(chart.state.drawings[1].text, 'Local note');
  chart.showDrawings(false); assert.equal(chart.state.visible, false);
  chart.clearDrawings(); assert.equal(chart.state.drawings.length, 1, 'locked annotation survives clear');
  chart.destroy();
});

test('Phomo alternate series updates only the open bucket and preserves full history across interval, unit and retention changes', () => {
  const f = fakeLibrary(), chart = createPhomoChart(f.host, {lib:f.lib,tf:60});
  const candles = Array.from({length:10000},(_,t)=>({t,o:10+t/100,h:12+t/100,l:9+t/100,c:11+t/100,v:1}));
  chart.set({candles,solUsd:200,base:1000000}); chart.style('line');
  const line = f.c.series.find(s=>s.type==='Line'), initial = line.resets, first = line.data[0];
  for(let i=0;i<500;i++) { candles.at(-1).c+=.01; candles.at(-1).h=Math.max(candles.at(-1).h,candles.at(-1).c); chart.set({candles}); chart.view({mode:'mcap',unit:'usd'}); }
  assert.equal(line.resets,initial,'streaming ticks never replace the complete alternative series');
  assert.equal(line.updates,500); assert.equal(line.data[0],first);
  const updates = line.updates; chart.set({candles}); assert.equal(line.updates,updates,'unchanged ticks do no series work');
  const newTime=10020; candles.push({t:newTime,o:120,h:125,l:119,c:124,v:3}); chart.set({candles});
  assert.equal(line.data.at(-1).time,11020); assert.equal(line.data.at(-1).value,24800);
  chart.view({mode:'price'}); assert.equal(line.resets,initial+1); assert.equal(line.data.at(-1).value,24800/1e9);
  chart.set({tf:300}); assert.equal(line.data.at(-1).time,10900); assert.equal(line.data.at(-1).value,24800/1e9);
  candles.splice(0,9000); chart.set({candles}); assert.equal(line.data[0].time,10000); assert.equal(line.data.length,4);
  const replacement=[{t:0,o:3,h:4,l:2,c:3.5,v:2}]; chart.set({candles:replacement,base:2000000});
  assert.deepEqual(line.data,[{time:2000,value:700/1e9}]); chart.destroy();
});
