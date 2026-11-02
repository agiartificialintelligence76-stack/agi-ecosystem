// Recorded playback only: this view receives a snapshot, never a run, order callback, wallet or live feed.
import { el, setText, flag } from './ui.js';
import { usd, usdFull, signed, clock as timeText } from './format.js';
import { aggregate, niceTicks } from './chart.js';
import { createReplayClock, replayFrame, replayTradeAt, REPLAY_SPEEDS } from './replay-data.js';
import './replay.css';

const button = (label, action, cls = '') => el('button', { type: 'button', class: `ts-rp-button ${cls}`, on: { click: action } }, label);
const metric = (label, value) => el('div', { class: 'ts-rp-metric' }, el('small', {}, label), value);

export function mountReplay(host, record) {
  if (!record || record.v !== 1) {
    const unavailable = el('p', { class: 'ts-rp-empty' }, 'This run has no recorded replay.'); host.append(unavailable);
    return { destroy() { unavailable.remove(); } };
  }
  const playback = createReplayClock(record.duration);
  let dead = false, raf = 0, last = null, lastDraw = -Infinity, timeframe = 1;
  let selected = record.orders[0]?.coin ?? record.coins[0]?.id ?? null;
  let frame = replayFrame(record, 0, selected);
  const root = el('section', { class: 'ts-rp', 'aria-label': 'Recorded run replay' });
  const play = button('Play', () => { if (playback.playing) playback.pause(); else playback.play(); last = null; render(); });
  const previous = button('← Previous trade', () => jump(-1));
  const next = button('Next trade →', () => jump(1));
  const speed = el('select', { class: 'ts-rp-select', 'aria-label': 'Playback speed', on: { change() { playback.setSpeed(Number(speed.value)); } } },
    REPLAY_SPEEDS.map((v) => el('option', { value: v }, `${v}×`)));
  const scrub = el('input', { class: 'ts-rp-scrub', type: 'range', min: 0, max: Math.max(0.001, record.duration), value: 0,
    step: 0.1, 'aria-label': 'Replay time', on: { input() { playback.pause(); playback.seek(Number(scrub.value)); render(); } } });
  const clock = el('output', { class: 'ts-rp-time', 'aria-label': 'Playback position' });
  const choice = el('select', { class: 'ts-rp-select', 'aria-label': 'Replay token', on: { change() { selected = Number(choice.value); render(); } } },
    record.coins.map((c) => el('option', { value: c.id }, `${c.ticker} · ${c.name}`)));
  choice.value = selected === null ? '' : String(selected); choice.disabled = !record.coins.length;
  const interval = el('select', { class: 'ts-rp-select', 'aria-label': 'Replay chart timeframe', on: { change() { timeframe = Number(interval.value); render(); } } },
    [[1, '1 second'], [15, '15 seconds'], [60, '1 minute'], [300, '5 minutes']].map(([v, label]) => el('option', { value: v }, label)));
  const worth = el('strong'), pnl = el('strong'), marketCap = el('strong');
  const priceCanvas = el('canvas', { class: 'ts-rp-candles', role: 'img', 'aria-label': 'Recorded token market cap in dollars' });
  const equityCanvas = el('canvas', { class: 'ts-rp-equity', role: 'img', 'aria-label': 'Recorded play portfolio value in dollars' });
  const coverage = el('p', { class: 'ts-rp-note' });
  const source = record.practice ? 'Practice recording · simulated prices and volume' : record.live ? 'Live recording' : 'Simulated recording';
  const intro = el('div', { class: 'ts-rp-heading' }, el('div', {}, el('h3', {}, 'Watch your run'),
    el('p', {}, `${source} · Read only · Play money`)), el('span', { class: 'ts-rp-badge' }, 'REPLAY'));
  const priceBlock = el('section', { class: 'ts-rp-chart' }, el('div', { class: 'ts-rp-chart-title' }, el('h4', {}, 'Token market cap'), choice, interval), priceCanvas, coverage);
  const equityBlock = el('section', { class: 'ts-rp-chart' }, el('h4', {}, 'Portfolio history'), equityCanvas);
  const list = el('ol', { class: 'ts-rp-orders' });
  const orderNodes = record.orders.map((o) => {
    const at = o.doneAt ?? o.t;
    const detail = el('small');
    const row = button([el('span', { class: `ts-rp-side is-${o.side}` }, o.side.toUpperCase()),
      el('span', {}, el('b', {}, o.ticker || 'Token'), detail), el('time', {}, timeText(at))], () => {
      selected = o.coin; choice.value = String(selected); playback.pause(); playback.seek(at); render();
    }, 'ts-rp-order');
    const item = el('li', {}, row); list.append(item); return { order: o, row, detail };
  });
  if (!record.orders.length) list.append(el('li', { class: 'ts-rp-empty' }, 'No orders were placed in this run.'));
  const orderBlock = el('aside', { class: 'ts-rp-trades' }, el('h4', {}, 'Your recorded orders'),
    el('p', { class: 'ts-rp-note' }, 'Select an order to jump to its result.'), list);
  const trimmed = record.coverage.ordersTrimmed || record.coverage.coinsTrimmed || record.coverage.candlesTrimmed;
  const note = `${record.live && !record.practice ? 'Only retained live observations are shown. ' : 'Prices and trades are recorded from the same simulated run. '}`
    + 'Playback cannot place trades. Missing history stays blank; moves inside a saved candle are not reconstructed.'
    + (trimmed ? ' This long run contains only the retained portion of some history.' : '')
    + (record.coverage.equitySampled ? ' Portfolio history is sampled from recorded points.' : '');
  root.append(intro, el('div', { class: 'ts-rp-controls' }, play, previous, next, speed, clock),
    scrub, el('div', { class: 'ts-rp-metrics' }, metric('Portfolio', worth), metric('Profit / loss', pnl), metric('Market cap', marketCap)),
    el('div', { class: 'ts-rp-layout' }, el('div', { class: 'ts-rp-charts' }, priceBlock, equityBlock), orderBlock),
    el('p', { class: 'ts-rp-note ts-rp-foot' }, note));
  host.append(root);
  const style = getComputedStyle(root);
  const color = (key, fallback) => style.getPropertyValue(`--t-${key}`).trim() || fallback;
  const colors = { panel: color('panel', '#15161f'), line: color('line', '#303039'), muted: color('muted', '#a1a1aa'),
    text: color('text', '#e4e4e7'), up: color('up', '#4ade80'), down: color('down', '#f87171'), accent: color('accent', '#ff9b8d') };

  function jump(direction) {
    const o = replayTradeAt(record, playback.time, direction);
    if (!o) return;
    selected = o.coin; choice.value = String(selected); playback.pause(); playback.seek(o.doneAt); render();
  }
  function render() {
    if (dead) return;
    frame = replayFrame(record, playback.time, selected);
    choice.querySelector('option[data-unavailable]')?.remove();
    if (selected !== null && !frame.coin) {
      const name = record.orders.find((o) => o.coin === selected)?.ticker || 'Token';
      choice.append(el('option', { value: selected, data: { unavailable: '1' } }, `${name} · History not retained`));
    }
    choice.value = selected === null ? '' : String(selected);
    setText(play, playback.playing ? 'Pause' : playback.time >= record.duration && record.duration > 0 ? 'Play again' : 'Play');
    play.disabled = record.duration <= 0;
    previous.disabled = !replayTradeAt(record, playback.time, -1); next.disabled = !replayTradeAt(record, playback.time, 1);
    scrub.value = String(playback.time); scrub.setAttribute('aria-valuetext', timeText(playback.time));
    setText(clock, `${timeText(playback.time)} / ${timeText(record.duration)}`);
    setText(worth, usdFull(frame.worth === null ? null : frame.worth * record.solUsd));
    setText(pnl, signed(frame.pnl === null ? null : frame.pnl * record.solUsd, 'usd'));
    flag(pnl, 'is-up', frame.pnl > 0); flag(pnl, 'is-down', frame.pnl < 0);
    setText(marketCap, usd(frame.marketCap === null ? null : frame.marketCap * record.solUsd));
    setText(coverage, !frame.coin ? selected === null ? 'No token was recorded.' : 'This token’s chart history was not retained.' : !frame.candles.length ? 'No completed recorded candle at this time.'
      : `Saved candles · ${timeText(Math.max(0, frame.candles[0].t))}–${timeText(frame.candles.at(-1).availableAt)}${frame.coin.trimmed ? ' · Older candles were not retained' : ''}`);
    const states = new Map(frame.orders.map((o) => [o.id, o]));
    for (const { order, row, detail } of orderNodes) {
      const current = states.get(order.id);
      const at = order.doneAt ?? order.t;
      flag(row, 'is-future', !current); flag(row, 'is-current', Math.abs(playback.time - at) < 0.15);
      const amount = order.side === 'buy' ? order.sol * record.solUsd : order.frac * 100;
      setText(detail, `${order.side === 'buy' ? usd(amount) : `${Number(amount.toFixed(1))}%`} · ${!current ? 'Later in run' : current.status === 'failed' ? 'Failed' : current.status === 'filled' ? 'Filled' : 'Pending'}`);
    }
    draw();
  }
  function setupCanvas(canvas) {
    const g = canvas.getContext('2d'); if (!g) return null;
    const rect = canvas.getBoundingClientRect(), dpr = Math.min(3, globalThis.devicePixelRatio || 1);
    const w = Math.max(120, rect.width), h = Math.max(90, rect.height);
    const width = Math.round(w * dpr), height = Math.round(h * dpr);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = colors.panel; g.fillRect(0, 0, w, h);
    g.font = '11px "Geist Mono", monospace'; return { g, w, h };
  }
  function grid(g, w, h, lo, hi, axis = 72) {
    const top = 15, bottom = h - 25, y = (v) => top + (hi - v) / (hi - lo || 1) * (bottom - top);
    g.strokeStyle = colors.line; g.fillStyle = colors.muted; g.textAlign = 'left'; g.lineWidth = 1;
    for (const v of niceTicks(lo, hi, 4)) {
      const yy = y(v); g.beginPath(); g.moveTo(10, yy); g.lineTo(w - axis, yy); g.stroke(); g.fillText(usd(v), w - axis + 6, yy + 4);
    }
    return y;
  }
  function blank(g, w, h, label) { g.fillStyle = colors.muted; g.textAlign = 'center'; g.fillText(label, w / 2, h / 2); }
  function draw() {
    const price = setupCanvas(priceCanvas);
    if (price) {
      const { g, w, h } = price, bars = aggregate(frame.candles, timeframe).slice(-180);
      if (!bars.length) blank(g, w, h, 'No recorded price at this time');
      else {
        const low = Math.min(...bars.map((b) => b.l * record.solUsd)), high = Math.max(...bars.map((b) => b.h * record.solUsd));
        const pad = Math.max((high - low) * 0.12, high * 0.01, 0.0000001), y = grid(g, w, h, low - pad, high + pad);
        const t0 = bars[0].t, span = Math.max(timeframe, bars.at(-1).t - t0 + timeframe), width = w - 90;
        const x = (t) => 10 + (t - t0 + timeframe / 2) / span * width, bw = Math.max(1, Math.min(9, width * timeframe / span * 0.7));
        for (const b of bars) {
          g.fillStyle = g.strokeStyle = b.c >= b.o ? colors.up : colors.down;
          const xx = x(b.t), y1 = y(Math.max(b.o, b.c) * record.solUsd), y2 = y(Math.min(b.o, b.c) * record.solUsd);
          g.beginPath(); g.moveTo(xx, y(b.h * record.solUsd)); g.lineTo(xx, y(b.l * record.solUsd)); g.stroke();
          g.fillRect(xx - bw / 2, y1, bw, Math.max(1, y2 - y1));
        }
        for (const mark of frame.marks) {
          const bucket = Math.floor(mark.t / timeframe) * timeframe;
          const b = bars.find((c) => c.t === bucket); if (!b) continue;
          g.fillStyle = mark.side === 'buy' ? colors.up : colors.down; g.textAlign = 'center';
          g.fillText(mark.side === 'buy' ? 'B' : 'S', x(b.t), mark.side === 'buy' ? y(b.l * record.solUsd) + 13 : y(b.h * record.solUsd) - 5);
        }
        g.fillStyle = colors.muted; g.textAlign = 'left'; g.fillText(timeText(Math.max(0, t0)), 10, h - 6);
        g.textAlign = 'right'; g.fillText(timeText(Math.max(0, bars.at(-1).t)), w - 80, h - 6);
      }
    }
    const equity = setupCanvas(equityCanvas);
    if (equity) {
      const { g, w, h } = equity, points = frame.equity;
      if (!points.length) blank(g, w, h, 'No recorded portfolio value at this time');
      else {
        const values = points.map((p) => p.v * record.solUsd), low = Math.min(...values), high = Math.max(...values);
        const pad = Math.max((high - low) * 0.15, Math.abs(high) * 0.005, 0.01), y = grid(g, w, h, low - pad, high + pad);
        const x = (t) => 10 + t / Math.max(0.001, record.duration) * (w - 90);
        g.strokeStyle = colors.accent; g.lineWidth = 2; g.beginPath();
        points.forEach((p, i) => { if (i) g.lineTo(x(p.t), y(p.v * record.solUsd)); else g.moveTo(x(p.t), y(p.v * record.solUsd)); }); g.stroke();
        const p = points.at(-1); g.fillStyle = colors.accent; g.beginPath(); g.arc(x(p.t), y(p.v * record.solUsd), 3, 0, Math.PI * 2); g.fill();
        g.fillStyle = colors.muted; g.textAlign = 'left'; g.fillText('00:00', 10, h - 6); g.textAlign = 'right'; g.fillText(timeText(record.duration), w - 80, h - 6);
      }
    }
  }
  const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { if (!dead) draw(); }) : null;
  resize?.observe(priceCanvas); resize?.observe(equityCanvas);
  function animate(now) {
    if (dead) return;
    if (last !== null) playback.advance(Math.min(1, Math.max(0, (now - last) / 1000)));
    last = now;
    if (now - lastDraw >= 100) { lastDraw = now; if (playback.playing || scrub.value !== String(playback.time)) render(); }
    raf = requestAnimationFrame(animate);
  }
  function visibility() { if (document.hidden) { playback.pause(); last = null; render(); } }
  document.addEventListener('visibilitychange', visibility);
  render(); raf = requestAnimationFrame(animate);
  return { destroy() { if (dead) return; dead = true; cancelAnimationFrame(raf); resize?.disconnect(); document.removeEventListener('visibilitychange', visibility); root.remove(); } };
}
