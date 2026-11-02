// Public perpetual quotes/candles with an optional run-owned paper ledger. This view never sends orders
// to the relay or fabricates a missing price/candle; isolated positions only use the shared play balance.
import { el, setText, keyed } from '../ui.js';
import { usd, pct, price as tinyPrice, compact } from '../format.js';
import { relayUrl } from '../live-chains.js';
import { createPaperPerpsTicket } from './phomo-perps-ticket.js';
import { createPerpsChart } from './phomo-perps-chart.js';

export const PERP_INTERVALS = Object.freeze(['1m', '5m', '15m', '1h', '4h', '1d']);
const COIN = /^(?:[a-z][a-z0-9-]{0,19}:)?[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/;
const DEX = /^(?:[a-z][a-z0-9-]{0,19})?$/;
const fin = (x) => typeof x === 'number' && Number.isFinite(x);
const value = (x) => fin(x) && Math.abs(x) <= 1e18 ? x : null;
const pos = (x) => fin(x) && x > 0 && x <= 1e18 ? x : null;
const nn = (x) => fin(x) && x >= 0 && x <= 1e18 ? x : null;
const words = (s) => typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u2069]/g, '').slice(0, 50) : '';
const quote = (v) => pos(v) === null ? '—' : v >= 1000 ? `$${v.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : `$${tinyPrice(v, 4)}`;

export function perpsUrl(loc) {
  const u = new URL(relayUrl(loc));
  u.pathname = '/perps'; u.search = ''; u.hash = '';
  return u.href;
}

export function parsePerpsReply(text) {
  if (typeof text !== 'string' || text.length > 2000000) return null;
  let m;
  try { m = JSON.parse(text); } catch { return null; }
  if (!m || typeof m !== 'object') return null;
  if (m.t === 'ready') return { t: 'ready' };
  if (!Number.isSafeInteger(m.id) || m.id < 0) return null;
  if (m.t === 'error') return ['busy', 'bad_request', 'unknown_market', 'unavailable'].includes(m.code) ? { t: 'error', id: m.id, code: m.code } : null;
  if (!['dexs', 'markets', 'candles'].includes(m.t) || !Array.isArray(m.data) || !Number.isSafeInteger(m.at) || m.at <= 0) return null;
  const out = { t: m.t, id: m.id, at: m.at, stale: m.stale === true, data: [] };
  if (m.t === 'dexs') {
    out.data = m.data.slice(0, 101).filter((d) => d && typeof d.id === 'string' && DEX.test(d.id))
      .map((d) => ({ id: d.id, name: words(d.name) || d.id || 'Hyperliquid' }));
  } else if (m.t === 'markets') {
    if (typeof m.dex !== 'string' || !DEX.test(m.dex)) return null;
    out.dex = m.dex;
    const seen = new Set();
    for (const r of m.data.slice(0, 1000)) {
      if (!r || typeof r.coin !== 'string' || !COIN.test(r.coin) || r.dex !== m.dex || seen.has(r.coin)) continue;
      if (m.dex ? !r.coin.startsWith(`${m.dex}:`) : r.coin.includes(':')) continue;
      seen.add(r.coin);
      out.data.push({ coin: r.coin, symbol: r.coin.split(':').at(-1), dex: m.dex, price: pos(r.price), mark: pos(r.mark),
        mid: pos(r.mid), oracle: pos(r.oracle), change: value(r.change), volume: nn(r.volume), funding: value(r.funding),
        openInterest: nn(r.openInterest), openInterestUsd: nn(r.openInterestUsd), leverage: pos(r.leverage) });
    }
  } else {
    if (typeof m.coin !== 'string' || !COIN.test(m.coin) || !PERP_INTERVALS.includes(m.interval)) return null;
    out.coin = m.coin; out.interval = m.interval;
    const rows = new Map();
    for (const r of m.data.slice(0, 180)) {
      if (!r || !Number.isSafeInteger(r.t) || r.t <= 0 || [r.o, r.h, r.l, r.c].some((v) => pos(v) === null)
        || r.h < Math.max(r.o, r.c) || r.l > Math.min(r.o, r.c) || r.h < r.l) continue;
      rows.set(r.t, { t: r.t, o: r.o, h: r.h, l: r.l, c: r.c, v: nn(r.v) });
    }
    out.data = [...rows.values()].sort((a, b) => a.t - b.t);
  }
  return out;
}

export function createPerpsClient({ location = globalThis.location, WebSocket: WS = globalThis.WebSocket,
  timers = { set: (f, ms) => setTimeout(f, ms), clear: (id) => clearTimeout(id) } } = {}) {
  let ws = null, wanted = false, state = 'idle', seq = 0, retry = null, deadline = null, attempts = 0;
  const pending = new Map(), listeners = new Set();
  const status = (next) => { state = next; for (const fn of listeners) fn(next); };
  const cancel = () => { for (const p of pending.values()) { timers.clear(p.timer); p.reject(new Error('unavailable')); } pending.clear(); };
  function connect() {
    timers.clear(retry); retry = null;
    if (!wanted || ws) return;
    status('connecting');
    try { ws = new WS(perpsUrl(location)); } catch { failed(); return; }
    const socket = ws;
    deadline = timers.set(() => { if (ws === socket) { ws = null; socket.close(); failed(); } }, 10000);
    socket.onmessage = (e) => {
      if (ws !== socket) return;
      const m = parsePerpsReply(e.data);
      if (!m) return;
      if (m.t === 'ready') { timers.clear(deadline); deadline = null; attempts = 0; status('live'); return; }
      const p = pending.get(m.id);
      if (!p || (m.t !== 'error' && m.t !== p.op)) return;
      pending.delete(m.id); timers.clear(p.timer);
      if (m.t === 'error') p.reject(new Error(m.code)); else p.resolve(m);
    };
    socket.onclose = () => { if (ws === socket) { ws = null; failed(); } };
    socket.onerror = () => {};
  }
  function failed() {
    timers.clear(deadline); deadline = null; cancel();
    if (!wanted) return;
    status('down');
    retry = timers.set(connect, Math.min(30000, 2000 * 2 ** Math.min(attempts++, 4)));
  }
  return {
    start() { wanted = true; if (!ws) connect(); },
    stop() {
      wanted = false; timers.clear(retry); timers.clear(deadline); retry = null; deadline = null;
      const socket = ws; ws = null; socket?.close(); cancel(); status('idle');
    },
    onStatus(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    request(op, args = {}) {
      if (state !== 'live' || !ws || ws.readyState !== 1) return Promise.reject(new Error('unavailable'));
      if (!['dexs', 'markets', 'candles'].includes(op)) return Promise.reject(new Error('bad_request'));
      if (pending.size >= 4) return Promise.reject(new Error('busy'));
      const id = ++seq;
      return new Promise((resolve, reject) => {
        const timer = timers.set(() => { pending.delete(id); reject(new Error('unavailable')); }, 12000);
        pending.set(id, { op, resolve, reject, timer });
        try { ws.send(JSON.stringify({ ...args, op, id })); }
        catch { pending.delete(id); timers.clear(timer); reject(new Error('unavailable')); }
      });
    },
    get status() { return state; },
  };
}

export function selectPerpMarkets(rows, { query = '', sort = 'volume' } = {}) {
  const q = String(query).trim().toLowerCase().slice(0, 60);
  const filtered = rows.filter((r) => !q || r.coin.toLowerCase().includes(q));
  return filtered.slice().sort((a, b) => {
    const av = sort === 'volume' ? a.volume : a.change;
    const bv = sort === 'volume' ? b.volume : b.change;
    if (av === null && bv !== null) return 1;
    if (bv === null && av !== null) return -1;
    return (sort === 'losers' ? (av ?? 0) - (bv ?? 0) : (bv ?? 0) - (av ?? 0)) || a.coin.localeCompare(b.coin);
  });
}

export function perpChartWindow(length, bars = 90, offset = 0) {
  const count = Math.min(Math.max(0, length), Math.max(15, Math.round(bars)));
  const end = Math.max(count, length - Math.max(0, Math.min(length - count, Math.round(offset))));
  return { start: end - count, end, count };
}

export function mountPhomoPerps(host, ctx = {}, hooks = {}) {
  const client = ctx.paperPerpsSession?.createClient() || ctx.perpsClient || createPerpsClient();
  const S = { active: true, dead: false, dex: '', rows: [], coin: null, interval: '15m', query: '', sort: 'volume',
    marketAt: 0, candleAt: 0, marketBusy: false, candleBusy: false, version: 0, chartVersion: 0 };
  const title = el('h2', { class: 'php-title' }, 'Perpetuals');
  const status = el('p', { class: 'php-status', role: 'status', 'aria-live': 'polite' }, 'Connecting to live markets…');
  const retry = el('button', { type: 'button', class: 'php-retry', hidden: true, on: { click: () => {
    if (client.status === 'live') { loadMarkets(); loadCandles(); } else client.start();
  } } }, 'Try again');
  const search = el('input', { class: 'php-search', type: 'search', placeholder: 'Search perpetuals', 'aria-label': 'Search perpetual markets',
    autocomplete: 'off', on: { input: (e) => { S.query = e.target.value; renderList(); } } });
  const venue = el('select', { class: 'php-select', 'aria-label': 'Market group', on: { change: (e) => {
    S.dex = e.target.value; S.version++; S.rows = []; S.coin = null; S.chartVersion++; S.candleBusy = false; S.marketBusy = false;
    chart.set([]); renderList(); renderAsset(); loadMarkets();
  } } }, el('option', { value: '' }, 'Hyperliquid'));
  const sort = el('select', { class: 'php-select', 'aria-label': 'Sort perpetual markets', on: { change: (e) => { S.sort = e.target.value; renderList(); } } },
    ...[['volume', 'Most traded'], ['gainers', 'Top gainers'], ['losers', 'Top losers']].map(([value, name]) => el('option', { value }, name)));
  const list = el('div', { class: 'php-list', role: 'group', 'aria-label': 'Perpetual markets' });
  const assetName = el('h3', { class: 'php-asset' }, 'Choose a market');
  const assetPrice = el('strong', { class: 'php-price' }, '—');
  const assetChange = el('span', { class: 'php-change' }, '—');
  const stats = el('dl', { class: 'php-stats' });
  const aboutName = el('p', { class: 'php-about-description' });
  const chartState = el('p', { class: 'php-chart-state', role: 'status' }, 'Select a market to load its price history.');
  const chart = createPerpsChart({ ledger: ctx.paperPerps, onInterval(interval) {
    S.interval = interval; S.chartVersion++; S.candleBusy = false; chart.set([], { coin: S.coin, interval }); loadCandles();
  } });
  const canvas = chart.plot;
  const paper = ctx.paperPerps ? createPaperPerpsTicket({ ledger: ctx.paperPerps,
    market: () => S.rows.find(row => row.coin === S.coin), onTransfer: ctx.openPaperCash }) : null;
  const marketPanel = el('div', { class: 'php-market-panel' },
    el('div', { class: 'php-heading' }, title, el('span', { class: 'php-badge' }, paper ? 'Paper trading' : 'View only')),
    el('div', { class: 'php-toolbar' }, search, venue, sort),
    el('div', { class: 'php-columns', 'aria-hidden': 'true' }, el('span', {}, 'Market'), el('span', {}, 'Price / 24h'), el('span', {}, '24h volume')), list);
  const navSlot = el('aside', { class: 'php-nav-slot', 'aria-label': 'Perpetual market discovery' }, marketPanel);
  const positionsSlot = el('div', { class: 'php-positions-slot' });
  const blankPositions = el('section', { class: 'php-position-note' }, el('h3', {}, 'Positions'),
    el('p', {}, 'No perpetual positions. This screen shows public market data and does not place derivatives orders.'));
  const sideRail = el('aside', { class: 'php-side-rail' },
    paper?.form || el('section', { class: 'php-preview-card' }, el('h3', {}, 'Live perpetual markets'),
      el('p', {}, 'Explore public prices and charts. Trading is not available in this web preview.'), el('span', { class: 'php-badge' }, 'View only · no wallet connection')),
    el('details', { class: 'php-about-card' }, el('summary', {}, 'About this market'), aboutName, stats,
      el('p', { class: 'php-source' }, 'Market data: Hyperliquid. Maximum leverage is the venue’s limit, not an active position.')),
    positionsSlot, paper ? null : blankPositions);
  const root = el('section', { class: 'php', 'aria-label': paper ? 'Paper perpetual markets' : 'Perpetual markets preview' },
    el('div', { class: 'php-workspace' }, navSlot, el('div', { class: 'php-layout' },
      el('section', { class: 'php-detail', 'aria-label': 'Selected perpetual market' },
        el('div', { class: 'php-detail-head' }, assetName, assetPrice, assetChange),
        chart.el, chartState,
        el('div', { class: 'php-state' }, status, retry), paper?.book,
        el('section', { class: 'php-activity-note' }, el('h3', {}, 'Market activity'),
          el('p', {}, 'Candles and current quotes are available. Trader identities, holders and account activity are not supplied by this public feed.'))), sideRail)));
  host.append(root);
  let externalPositions = null;
  function setHosts({ discoveryHost = null, positionsHost = null } = {}) {
    if (S.dead) return;
    (discoveryHost || navSlot).append(marketPanel);
    navSlot.hidden = Boolean(discoveryHost); root.classList.toggle('is-docked', Boolean(discoveryHost));
    if (externalPositions && externalPositions !== positionsHost && externalPositions.parentNode === positionsSlot) externalPositions.remove();
    externalPositions = positionsHost;
    if (positionsHost) positionsSlot.append(positionsHost);
    blankPositions.hidden = Boolean(positionsHost);
    chart.draw();
  }
  setHosts(hooks);

  function renderList() {
    const rows = selectPerpMarkets(S.rows, S);
    const items = rows.length ? rows : [{ coin: 'empty', empty: true }];
    keyed(list, items, (r) => r.coin, (r) => {
      if (r.empty) return el('p', { class: 'php-empty' }, S.query ? 'No markets match your search.' : 'No markets to show yet.');
      const b = el('button', { class: 'php-row', type: 'button', on: { click: () => { select(r.coin); hooks.onSelect?.(r.coin); } } },
        el('span', { class: 'php-row-name' }, el('b'), el('small')),
        el('span', { class: 'php-row-price' }, el('b'), el('small')), el('span', { class: 'php-row-vol' }));
      return b;
    }, (node, r) => {
      if (r.empty) { setText(node, S.query ? 'No markets match your search.' : 'No markets to show yet.'); return; }
      node.setAttribute('aria-pressed', String(S.coin === r.coin));
      setText(node.children[0].children[0], r.symbol);
      setText(node.children[0].children[1], r.leverage === null ? 'Max leverage —' : `${r.leverage}× max`);
      setText(node.children[1].children[0], quote(r.price));
      setText(node.children[1].children[1], pct(r.change));
      node.children[1].children[1].dataset.tone = r.change > 0 ? 'up' : r.change < 0 ? 'down' : '';
      setText(node.children[2], usd(r.volume));
    });
  }
  function renderAsset() {
    const a = S.rows.find((r) => r.coin === S.coin);
    setText(assetName, a ? `${a.symbol} Perpetual` : 'Choose a market');
    setText(assetPrice, quote(a?.price)); setText(assetChange, a ? pct(a.change) : '—');
    assetChange.dataset.tone = a?.change > 0 ? 'up' : a?.change < 0 ? 'down' : '';
    setText(aboutName, a ? `${a.symbol} perpetual market · ${a.dex || 'Hyperliquid'}. Figures below are the latest observed public market values.` : 'Choose a market from the discovery list.');
    const fields = [['Mark price', quote(a?.mark)], ['Mid price', quote(a?.mid)], ['Oracle price', quote(a?.oracle)],
      ['Funding rate', a && a.funding !== null ? pct(a.funding, 4) : '—'], ['24h volume', usd(a?.volume)],
      ['Open interest', a && a.openInterest !== null ? `${compact(a.openInterest)} ${a.symbol}` : '—'],
      ['Open interest value', usd(a?.openInterestUsd)], ['Maximum leverage', a?.leverage ? `${a.leverage}×` : '—']];
    stats.replaceChildren(...fields.map(([label, text]) => el('div', {}, el('dt', {}, label), el('dd', {}, text))));
    paper?.update();
  }
  function select(coin) {
    if (coin === S.coin) return;
    S.coin = coin; S.chartVersion++; S.candleBusy = false; chart.set([], { coin, interval: S.interval }); renderList(); renderAsset(); loadCandles();
  }
  async function loadMarkets() {
    if (S.dead || !S.active || client.status !== 'live' || S.marketBusy) return;
    S.marketBusy = true; S.marketAt = Date.now();
    const version = S.version, dex = S.dex;
    try {
      const m = await client.request('markets', { dex });
      if (S.dead || !S.active || version !== S.version || m.dex !== S.dex) return;
      S.rows = m.data;
      if (ctx.paperPerps && !ctx.paperPerpsSession) ctx.paperPerps.observeMarkets(m.data, { at: m.at, stale: m.stale });
      setText(status, m.stale ? 'Updates interrupted · showing the last available quotes.' : `Updated ${new Date(m.at).toLocaleTimeString()} · ${m.data.length} markets`);
      retry.hidden = !m.stale;
      if (!S.rows.some((r) => r.coin === S.coin)) {
        S.coin = null;
        const first = S.rows.find((r) => r.coin === 'BTC')?.coin || S.rows[0]?.coin || null;
        if (first) select(first);
        else { S.chartVersion++; S.candleBusy = false; chart.set([]); setText(chartState, 'No price history is available.'); }
      }
      renderList(); renderAsset();
      if (S.coin && Date.now() - S.candleAt >= 30000) loadCandles();
    } catch {
      if (!S.dead && S.active && version === S.version) { setText(status, S.rows.length ? 'Updates interrupted · showing the last available quotes.' : 'Markets are unavailable right now. Please try again.'); retry.hidden = false; }
    } finally { if (version === S.version) S.marketBusy = false; }
  }
  async function loadCandles() {
    if (S.dead || !S.active || !S.coin || client.status !== 'live' || S.candleBusy) return;
    S.candleBusy = true; S.candleAt = Date.now();
    const version = S.chartVersion, coin = S.coin, interval = S.interval;
    setText(chartState, 'Loading price history…');
    try {
      const m = await client.request('candles', { coin, interval });
      if (S.dead || !S.active || version !== S.chartVersion || m.coin !== S.coin || m.interval !== S.interval) return;
      chart.set(m.data, { coin, interval });
      setText(chartState, !m.data.length ? 'No price history is available for this interval.' : m.stale ? 'Chart updates interrupted · showing the last available candles.' : '');
      canvas.setAttribute('aria-label', `${coin} ${interval} price chart, ${m.data.length} observed candles. Plus or minus to zoom, arrows to pan, End for latest.`);
    } catch { if (!S.dead && S.active && version === S.chartVersion) { setText(chartState, 'Price history is unavailable. Try another interval or retry.'); retry.hidden = false; } }
    finally { if (version === S.chartVersion) S.candleBusy = false; }
  }
  const off = client.onStatus((state) => {
    if (S.dead || !S.active) return;
    if (state === 'live') {
      loadMarkets();
      client.request('dexs').then((m) => {
        if (S.dead || !S.active) return;
        venue.replaceChildren(...m.data.map((d) => el('option', { value: d.id }, d.name)));
        venue.value = S.dex;
      }).catch(() => {});
    } else { setText(status, state === 'connecting' ? 'Connecting to live markets…' : 'The market feed is unavailable. Reconnecting…'); retry.hidden = state !== 'down'; }
  });
  client.start();
  return { el: root, setHosts, selectCoin: select,
    update() {
      if (!S.active || S.dead) return;
      if (Date.now() - S.marketAt >= 10000) loadMarkets();
      if (Date.now() - S.candleAt >= 30000) loadCandles();
      paper?.update();
    },
    setActive(active) {
      if (S.dead || S.active === Boolean(active)) return;
      S.active = Boolean(active); S.version++; S.chartVersion++; S.marketBusy = false; S.candleBusy = false;
      chart.setActive(S.active); paper?.setActive(S.active);
      if (S.active) { client.start(); chart.draw(); } else client.stop();
    },
    destroy() { if (S.dead) return; S.dead = true; off(); client.stop(); client.release?.(); chart.destroy(); paper?.destroy();
      if (externalPositions?.parentNode === positionsSlot) externalPositions.remove(); marketPanel.remove(); root.remove(); },
  };
}
