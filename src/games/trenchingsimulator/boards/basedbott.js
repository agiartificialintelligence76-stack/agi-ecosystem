// BasedBott: the BasedBot web terminal's compact Discover / Pulse / token workspace.
// Measured against basedbot.app (2026-11-02): system sans, #17171c background, #26a69a accent,
// 56px navigation, chain rail, dense tabular discovery, fixed tools bar. Official reference documentation:
// https://docs.basedbot.app/web-app/webapp/{discover,pulse,token-page,trading,portfolio,trackers}
// The simulator owns funds and execution. There is no account connection, private key, deposit or external trading.
import { el, setText, flag, keyed, icon, toast } from '../ui.js';
import { updateStats, updateLabels } from './stable-ui.js';
import { createCandleReader } from './candle-reader.js';
import { paintBasedTable, paintBasedInfo } from './basedbott-table.js';
import { markEl, wordEl } from '../brands.js';
import { usd, money, moneySigned, pct, share, age, tokens, currencyOf, unitOf, nice } from '../format.js';
import { buyPresets, parseAmount, pic, num, short, tone, ORDER_ERRORS } from './common.js';
import { createGChart, chartCredit } from './gchart.js';
import { createAddressSearch } from '../live-search.js';
import { CHAINS, chainById } from '../live-chains.js';
import { MIN_BUY } from '../engine.js';
import { createBasedOrders, basedRows, sparklinePath, basedCsvCell } from './basedbott-data.js';
import './basedbott.css';

const NAV = [['discover', 'Discover'], ['pulse', 'Pulse'], ['trackers', 'Trackers'], ['portfolio', 'Portfolio']];
const SORTS = [['top', 'Top'], ['trending', 'Trending'], ['viewed', 'Most Viewed'], ['surge', 'Surge'], ['dexpaid', 'Dexpaid'], ['watching', '☆ Watching']];
const TF = [[1, '1s'], [5, '5s'], [15, '15s'], [60, '1m'], [300, '5m'], [900, '15m']];
const SVG = 'http://www.w3.org/2000/svg';
const finite = (n, fn) => Number.isFinite(n) ? fn(n) : '—';

export function mountBasedbott(host, ctx) {
  const { market } = ctx, cur = currencyOf(ctx.currency), px = ctx.solUsd, U = unitOf(cur, px);
  const M = v => money(v, cur, px), MS = v => moneySigned(v, cur, px), MC = v => finite(v, x => usd(x * px));
  const base = Date.now() - market.t * 1000;
  const candleReader = createCandleReader(market, { maxEntries: 5 });
  const sparkReader = createCandleReader(market, { maxEntries: 96, limit: 32 });
  const S = { view: 'discover', sort: 'top', coin: null, side: 'buy', type: 'market', tf: 5, tab: 'trades',
    query: '', chain: 'all', source: 'all', watched: new Set(), blacklist: new Set(), viewed: new Map(),
    filters: { minimum: 0, maximum: Infinity, minHolders: 0 }, window: '5m', fast: -Infinity, slow: -Infinity,
    paused: false, dead: false, chartMode: 'mcap', indicators: new Set(), dialogs: new Set(), multi: [], multiKey: '',
    tracker: 'all', portfolio: 'positions', notification: 0, dense: false, searchOpen: false };
  const shown = v => String(nice(v * U.per));
  const quick = el('input', { class: 'tbb-quick-in', value: shown(buyPresets(ctx.start)[1]), inputMode: 'decimal', 'aria-label': `Quick buy amount in ${U.name}` });
  const amount = el('input', { class: 'tbb-amount', value: quick.value, inputMode: 'decimal', 'aria-label': `Buy amount in ${U.name}` });
  const target = el('input', { class: 'tbb-in', inputMode: 'decimal', placeholder: 'Target market cap in USD', 'aria-label': 'Target market cap in USD' });
  const targetRange = el('input', { type: 'range', min: -90, max: 100, value: 0, 'aria-label': 'Target relative to current market cap', on: { input: () => {
    const r = market.row(S.coin); if (r) target.value = String(Math.round(r.mc * px * (1 + Number(targetRange.value) / 100)));
    setText(targetPercent, `${targetRange.value > 0 ? '+' : ''}${targetRange.value}%`);
  } } });
  const targetPercent = el('span', {}, '0%');
  const interval = el('input', { class: 'tbb-in', type: 'number', min: 5, value: 30, 'aria-label': 'DCA interval in seconds' });
  const repeats = el('input', { class: 'tbb-in', type: 'number', min: 2, max: 100, value: 5, 'aria-label': 'DCA number of orders' });
  const trail = el('input', { class: 'tbb-in', type: 'number', min: 1, max: 99, value: 20, 'aria-label': 'Trailing stop drawdown percent' });
  const feedback = el('p', { class: 'tbb-order-feedback', role: 'status' });
  const errorWords = code => code === 'min_buy' ? `The smallest buy is ${M(MIN_BUY)}.`
    : (ORDER_ERRORS[code] || 'The order could not be submitted.').replace(/SOL/g, U.name);
  const automations = createBasedOrders({ row: id => market.row(id), order: p => ctx.order(p), now: () => market.t, notify: (o, r) => {
    S.notification++;
    toast(o.side === 'alert' ? `$${r.ticker} reached ${MC(r.mc)}` : o.status === 'failed' ? `${r.ticker}: ${errorWords(o.error)}`
      : `${o.mode.toUpperCase()}: ${o.side} order submitted for $${r.ticker}`, o.status === 'failed' ? 'down' : 'up');
  } });
  function btn(text, fn, cls = '', attrs = {}) { return el('button', { type: 'button', class: ['tbb-btn', cls], ...attrs, on: { click: fn } }, text); }
  function ibtn(ic, label, fn) { return btn(icon(ic), fn, 'tbb-icon-btn', { 'aria-label': label, title: label }); }
  function empty(text) { return el('p', { class: 'tbb-empty' }, text); }
  function infoRows(items) { return el('dl', { class: 'tbb-info-rows' }, items.map(([label, value]) => el('div', {}, el('dt', {}, label), el('dd', {}, value)))); }
  function stat(label, value, cls = '') { return el('div', { class: ['tbb-stat', cls] }, el('span', {}, label), el('strong', {}, value)); }
  const main = el('div', { class: 'tbb-content' });
  const search = el('input', { class: 'tbb-search-in', type: 'search', placeholder: 'Search by token or paste contract', 'aria-label': 'Search token or contract address', autocomplete: 'off', on: { input: () => { S.query = search.value; renderSearch(); }, keydown: e => {
    if (e.key === 'Escape') closeSearch();
    if (e.key === 'Enter') { e.preventDefault(); const ids = market.find(search.value); if (ids.length === 1) { openCoin(ids[0]); closeSearch(); } }
  } } });
  const searchResults = el('div', { class: 'tbb-search-results' });
  const searchPanel = el('section', { class: 'tbb-search-panel', hidden: true, 'aria-label': 'Search tokens' },
    el('div', { class: 'tbb-search-head' }, icon('search'), search, ibtn('close', 'Close search', () => closeSearch())), searchResults);
  const lookup = createAddressSearch(market, () => { if (!S.dead) renderSearch(); });
  function openSearch() { S.searchOpen = true; searchPanel.hidden = false; renderSearch(); search.focus(); }
  function closeSearch() { S.searchOpen = false; searchPanel.hidden = true; }
  function renderSearch() {
    const ids = S.query.trim() ? market.find(S.query.trim()) : market.lists({ limit: 8 }).trending.map(r => r.id);
    const note = lookup(S.query.trim(), ids.length > 0);
    searchResults.replaceChildren(...ids.slice(0, 12).map(id => {
      const r = market.row(id); return btn([pic(r, '', 'tbb'), el('span', { class: 'tbb-search-name' }, el('b', {}, r.ticker), el('small', {}, r.name)), el('span', {}, MC(r.mc))],
        () => { openCoin(id); closeSearch(); }, 'tbb-search-row');
    }));
    if (!ids.length) searchResults.append(empty(note || 'No tokens found in this market.'));
  }
  const navBtns = NAV.map(([id, label]) => btn(label, () => navigate(id), 'tbb-nav-btn', { data: { view: id } }));
  const balance = btn('', () => navigate('portfolio'), 'tbb-wallet', { 'aria-label': 'Open practice wallet' });
  const notifications = ibtn('info', 'Order notifications', () => showNotifications());
  const chainName = chainById(ctx.chain)?.name || 'Simulated';
  const top = el('header', { class: 'tbb-top' }, btn([markEl('chat'), wordEl('chat')], () => navigate('discover'), 'tbb-brand', { 'aria-label': 'BasedBott Discover' }),
    el('nav', { class: 'tbb-nav', 'aria-label': 'BasedBott terminal' }, navBtns,
      btn('Tools ▾', () => showTools(), 'tbb-nav-btn')),
    el('div', { class: 'tbb-top-actions' }, ibtn('search', 'Search tokens (/)', openSearch),
      ibtn('star', 'Open watchlist', () => { S.sort = 'watching'; navigate('discover'); }), notifications,
      el('span', { class: 'tbb-chain-badge' }, el('i'), chainName), balance));
  const rail = el('aside', { class: 'tbb-chain-rail', 'aria-label': 'Filter displayed chains' });
  const railNames = [['all', 'All chains', '◉'], ...CHAINS.map(c => [c.id, c.name, c.coin === 'eth' ? '◆' : c.coin === 'sol' ? '≋' : c.name.slice(0, 1)]), ['simulated', 'Simulated', 'S']];
  const railButtons = railNames.map(([id, name, text]) => btn(text, () => {
    S.chain = S.chain === id ? 'all' : id;
    if (S.coin !== null) closeSub();
    if (!['discover', 'pulse'].includes(S.view)) navigate('discover');
    render();
  }, 'tbb-chain-dot', { title: name, 'aria-label': `Show ${name}`, 'aria-pressed': String(id === 'all'), data: { chain: id } }));
  rail.append(...railButtons);
  const sortBtns = SORTS.map(([id, label]) => btn(label, () => { S.sort = id; render(); }, 'tbb-sort', { data: { sort: id } }));
  const source = el('select', { class: 'tbb-source', 'aria-label': 'Filter token source', on: { change: () => { S.source = source.value; render(); } } }, el('option', { value: 'all' }, 'All sources'));
  const windowBtns = ['1m', '5m', '1h', '24h'].map(w => btn(w, () => { S.window = w; render(); }, 'tbb-window', { data: { win: w } }));
  const discoverTools = el('div', { class: 'tbb-discover-tools' }, el('div', { class: 'tbb-sorts' }, sortBtns), source,
    el('div', { class: 'tbb-windows' }, windowBtns), btn([icon('sliders'), 'Filter'], showFilters, 'tbb-filter'),
    el('label', { class: 'tbb-quick' }, 'Quick Buy', quick, el('span', {}, U.name)), ibtn('lock', 'Manage blacklist', showBlacklist));
  const tableHead = el('div', { class: 'tbb-market-head' }, ['Pair Info / Age', 'Trend', 'Market Cap', 'Liquidity', 'Volume', 'TXNS', 'Token Info', 'Action'].map(t => el('span', {}, t)));
  const discoverList = el('div', { class: 'tbb-market-list', role: 'list', 'aria-label': 'Discovered tokens' });
  const discover = el('section', { class: 'tbb-discover' }, discoverTools, el('div', { class: 'tbb-market-scroll' }, tableHead, discoverList));
  const pulseLists = {}, pulseCounts = {};
  const pauseBtn = btn('Pause feed', () => { S.paused = !S.paused; setText(pauseBtn, S.paused ? 'Resume feed' : 'Pause feed'); render(); });
  const pulse = el('section', { class: 'tbb-pulse', hidden: true }, el('div', { class: 'tbb-view-title' }, el('h2', {}, 'Pulse'),
    el('span', {}, 'New launches and bonding curves'), pauseBtn, btn([icon('sliders'), 'Filters'], showFilters)),
    el('div', { class: 'tbb-pulse-grid' }, [['new', 'New Pairs'], ['stretch', 'Final Stretch'], ['migrated', 'Migrated']].map(([id, label]) => {
      pulseCounts[id] = el('span', { class: 'tbb-count' }, '0'); pulseLists[id] = el('div', { class: 'tbb-pulse-list', role: 'list' });
      return el('section', { class: 'tbb-pulse-column' }, el('h3', {}, label, pulseCounts[id]), pulseLists[id]);
    })));
  const portfolioBody = el('div'), portfolioStats = el('div', { class: 'tbb-portfolio-stats' });
  const portfolioTabs = ['positions', 'history', 'orders'].map(id => btn(id[0].toUpperCase() + id.slice(1), () => { S.portfolio = id; renderPortfolio(); }, '', { data: { ptab: id } }));
  const portfolio = el('section', { class: 'tbb-portfolio', hidden: true }, el('div', { class: 'tbb-view-title' }, el('h2', {}, 'Portfolio'),
    el('span', {}, 'W1 · Practice wallet'), btn('Export trades', exportTrades)), portfolioStats,
    el('div', { class: 'tbb-tabs' }, portfolioTabs), portfolioBody);
  const trackerBody = el('div'), trackerTabs = ['all', 'smart', 'kol', 'whale', 'me'].map(id => btn(id === 'all' ? 'All activity' : id === 'me' ? 'My trades' : id === 'kol' ? 'KOLs' : id[0].toUpperCase() + id.slice(1),
    () => { S.tracker = id; renderTracker(); }, '', { data: { track: id } }));
  const trackers = el('section', { class: 'tbb-trackers', hidden: true }, el('div', { class: 'tbb-view-title' }, el('h2', {}, 'Trackers'),
    el('span', {}, 'Market activity · simulated trader identities')), el('div', { class: 'tbb-tabs' }, trackerTabs), trackerBody);
  const multiGrid = el('div', { class: 'tbb-multi-grid' });
  const multichart = el('section', { class: 'tbb-multichart', hidden: true }, el('div', { class: 'tbb-view-title' }, el('h2', {}, 'Multichart'),
    el('span', {}, 'Your watchlist · up to four charts'), btn('Choose tokens', () => { S.sort = 'watching'; navigate('discover'); })), multiGrid);
  const coinHeading = el('h2', {}), coinPic = el('span'), coinSubtitle = el('p', { class: 'tbb-muted' }), coinStats = el('div', { class: 'tbb-coin-stats' });
  const watchCoin = ibtn('star', 'Watch token', () => toggleWatch(S.coin));
  const coinHeader = el('header', { class: 'tbb-coin-header' }, ibtn('back', 'Back to token list', () => closeSub()), coinPic,
    el('div', { class: 'tbb-coin-name' }, coinHeading, coinSubtitle), watchCoin, coinStats);
  const plot = el('div', { class: 'tbb-chart', role: 'img', 'aria-label': 'Token market cap chart' });
  const legend = el('p', { class: 'tbb-legend' }, 'Move over the chart to inspect a candle.');
  const chart = createGChart(plot, { tf: S.tf, colors: { bg: '#17171c', border: '#2b2b32', axis: '#93939f', strong: '#f1f2f6',
    up: '#26a69a', down: '#ef5350', label: '#292930' }, onHover: b => {
    if (b) setText(legend, `O ${b.fmt(b.o)}  H ${b.fmt(b.h)}  L ${b.fmt(b.l)}  C ${b.fmt(b.c)}  V ${MC(b.vol)}`);
  } });
  const tfBtns = TF.map(([s, label]) => btn(label, () => { S.tf = s; renderCoin(); }, 'tbb-timeframe', { data: { tf: s } }));
  const modeBtn = btn('MCap', () => { S.chartMode = S.chartMode === 'mcap' ? 'price' : 'mcap'; setText(modeBtn, S.chartMode === 'mcap' ? 'MCap' : 'Price'); chart.view({ mode: S.chartMode }); renderCoin(); });
  const fxBtns = ['ma', 'ema', 'rsi', 'macd'].map(id => btn(id.toUpperCase(), () => {
    if (S.indicators.has(id)) S.indicators.delete(id); else S.indicators.add(id);
    chart.indicators([...S.indicators]); renderCoin();
  }, 'tbb-indicator', { data: { fx: id }, 'aria-pressed': 'false' }));
  const coinTabs = ['trades', 'holders', 'position', 'orders', 'info'].map(id => btn(id[0].toUpperCase() + id.slice(1), () => { S.tab = id; renderCoinTables(); }, '', { data: { ctab: id } }));
  const coinTable = el('div', { class: 'tbb-coin-table' });
  const sideBtns = ['buy', 'sell'].map(side => btn(side === 'buy' ? 'Buy' : 'Sell', () => {
    S.side = side; amount.value = side === 'sell' ? '100' : quick.value; if (side === 'buy' && S.type === 'trail') S.type = 'market'; syncOrder();
  }, `tbb-side is-${side}`, { data: { side } }));
  const typeSelect = el('select', { class: 'tbb-type', 'aria-label': 'Order type', on: { change: () => { S.type = typeSelect.value; syncOrder(); } } },
    ['market', 'limit', 'dca', 'trail', 'migration'].map(id => el('option', { value: id }, ({ market: 'Market', limit: 'Limit', dca: 'DCA', trail: 'Trailing stop', migration: 'Migration snipe' })[id])));
  const amountUnit = el('span', {}, U.name), presets = el('div', { class: 'tbb-amount-presets' }), holdLine = el('p', { class: 'tbb-muted' });
  const limitFields = el('div', { class: 'tbb-limit-fields', hidden: true }, el('label', {}, 'Target Market Cap', target), el('div', { class: 'tbb-target-range' }, targetRange, targetPercent));
  const dcaFields = el('div', { class: 'tbb-dca-fields', hidden: true }, el('label', {}, 'Interval (seconds)', interval), el('label', {}, 'Number of orders', repeats));
  const trailFields = el('label', { class: 'tbb-trail-fields', hidden: true }, 'Sell after a drop from the session high (%)', trail);
  const orderTypeNote = el('p', { class: 'tbb-muted' });
  const orderBtn = btn('Buy', submitOrder, 'tbb-place');
  const tradeSettings = btn('', () => ctx.openSettings(), 'tbb-trade-settings');
  const positionInfo = el('div', { class: 'tbb-position-info' }), riskInfo = el('div', { class: 'tbb-risk-info' });
  const orderPanel = el('aside', { class: 'tbb-order-panel' }, el('div', { class: 'tbb-sides' }, sideBtns),
    el('div', { class: 'tbb-order-type' }, typeSelect, el('span', {}, 'W1')), holdLine,
    el('label', { class: 'tbb-amount-box' }, amount, amountUnit), presets, limitFields, dcaFields, trailFields, orderTypeNote,
    tradeSettings, orderBtn, feedback, el('p', { class: 'tbb-practice-note' }, 'Play money · orders apply only to this run'), positionInfo,
    btn([icon('clock'), 'Create price alert'], () => priceAlert(), 'tbb-alert-button'), riskInfo);
  const coinView = el('section', { class: 'tbb-coin', hidden: true }, coinHeader,
    el('div', { class: 'tbb-coin-layout' }, el('div', { class: 'tbb-chart-column' },
      el('div', { class: 'tbb-chart-tools' }, tfBtns, modeBtn, fxBtns, ibtn('replay', 'Fit chart', () => chart.fit())), legend, plot, chartCredit(),
      el('div', { class: 'tbb-tabs' }, coinTabs), coinTable), orderPanel));
  main.append(discover, pulse, trackers, portfolio, multichart, coinView);
  const footerStatus = el('span', { class: 'tbb-connection' }, '● Practice session');
  const footer = el('footer', { class: 'tbb-footer' }, footerStatus, ibtn('sliders', 'Terminal settings', () => showSettings()),
    ...[['discover', 'Discover', 'search'], ['pulse', 'Pulse', 'bolt'], ['trackers', 'Tracker', 'users'], ['portfolio', 'PnL', 'chart'], ['multichart', 'Multichart', 'chart']].map(([id, label, ic]) => btn([icon(ic), label], () => navigate(id))),
    btn([icon('clock'), 'Alerts'], showAlerts), el('span', { class: 'tbb-footer-money' }, `1 SOL = ${usd(px)} · ${U.name} practice balance`));
  const root = el('div', { class: 'tbb-terminal' }, top, el('div', { class: 'tbb-workspace' }, rail, main), footer, searchPanel);
  host.append(root);

  function allRows() {
    const lists = market.lists({ limit: 100 });
    return [...new Map([...lists.new, ...lists.stretch, ...lists.migrated, ...lists.trending].map(r => [r.id, r])).values()];
  }
  function filtered(rows) { return basedRows(rows, { ...S.filters, sort: S.sort, watched: S.watched, viewed: S.viewed,
    blacklist: S.blacklist, chain: S.chain, source: S.source, solUsd: px }); }
  function toggleWatch(id) {
    if (S.watched.has(id)) S.watched.delete(id); else S.watched.add(id);
    render(); if (S.coin !== null) renderCoin();
  }
  function quickBuy(id) {
    const v = parseAmount(quick.value);
    if (!(v > 0)) { toast(`Enter a quick buy amount in ${U.name}.`, 'down'); quick.focus(); return; }
    const r = ctx.order({ coin: id, side: 'buy', sol: v / U.per });
    toast(r?.ok ? `Buy submitted · ${M(v / U.per)}` : errorWords(r?.error), r?.ok ? 'up' : 'down');
    renderPortfolio();
  }
  function makeMarketRow(r) {
    const star = ibtn('star', `Watch ${r.ticker}`, () => toggleWatch(r.id));
    const name = btn([pic(r, '', 'tbb'), el('span', { class: 'tbb-row-name' }, el('b', {}, r.ticker), el('small', {}, r.name), el('span', { class: 'tbb-row-age' }))], () => openCoin(r.id), 'tbb-token-link');
    const spark = document.createElementNS(SVG, 'svg'); spark.setAttribute('viewBox', '0 0 96 30'); spark.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(SVG, 'path'); spark.append(path);
    const trend = el('div', { class: 'tbb-trend' }, spark, el('span'));
    const mc = el('strong'), liq = el('span'), vol = el('span'), txns = el('span'), intel = el('div', { class: 'tbb-intel' });
    const buy = btn([icon('bolt'), 'Buy'], () => quickBuy(r.id), 'tbb-quick-buy', { 'aria-label': `Quick buy ${r.ticker}` });
    const hide = ibtn('close', `Hide ${r.ticker}`, () => { S.blacklist.add(r.id); render(); });
    const row = el('article', { class: 'tbb-market-row', role: 'listitem' }, el('div', { class: 'tbb-pair' }, star, name), trend, mc, liq, vol, txns, intel, el('div', { class: 'tbb-row-actions' }, buy, hide));
    row.$ = { star, name, trend, path, mc, liq, vol, txns, intel, buy }; return row;
  }
  function updateMarketRow(node, r) {
    const x = node.$, st = market.stats(r.id);
    setText(x.name.querySelector('.tbb-row-age'), `${age(r.age)} · ${r.live ? chainById(r.chain)?.name || 'Live coin' : 'Simulated'}${r.phase === 'pool' ? ' · Migrated' : ''}`);
    x.star.setAttribute('aria-pressed', String(S.watched.has(r.id)));
    const change = S.window === '1m' ? st.change1m : S.window === '1h' ? st.change1h : S.window === '24h' ? st.changeAll : st.change5m;
    setText(x.trend.lastChild, pct(change)); tone(x.trend, change, 0);
    const path = sparklinePath(sparkReader.read(r.id, st.cdv));
    if (x.path.getAttribute('d') !== path) x.path.setAttribute('d', path);
    setText(x.mc, MC(r.mc)); setText(x.liq, MC(st.liq));
    setText(x.vol, MC(S.window === '1m' ? st.vol1m : S.window === '1h' ? st.vol1h : S.window === '24h' ? st.vol : st.vol5m));
    setText(x.txns, num(S.window === '1h' ? st.txns1h : S.window === '24h' ? st.txns : st.txns5m));
    updateLabels(x.intel, [`Holders ${num(r.holders)}`, `Top 10 ${share(r.top10)}`, `Dev ${share(r.dev)}`]);
    x.buy.disabled = r.phase === 'migrating' || r.live && r.tracked === false;
  }
  function makePulseCard(r) {
    const name = btn([pic(r, '', 'tbb'), el('span', {}, el('b', {}, r.ticker), el('small', {}, r.name))], () => openCoin(r.id), 'tbb-pulse-token');
    const meta = el('span', { class: 'tbb-muted' }), stats = el('div', { class: 'tbb-pulse-stats' }), bar = el('div', { class: 'tbb-curve' }, el('i'));
    const buy = btn('', () => quickBuy(r.id), 'tbb-quick-buy'), watch = ibtn('star', `Watch ${r.ticker}`, () => toggleWatch(r.id));
    const node = el('article', { class: 'tbb-pulse-card', role: 'listitem' }, el('div', { class: 'tbb-pulse-card-top' }, name, watch), meta, stats, bar, buy);
    node.$ = { meta, stats, bar, buy, watch }; return node;
  }
  function updatePulseCard(node, r) {
    const x = node.$;
    setText(x.meta, `${age(r.age)} · ${r.live ? 'Real coin · play money' : 'Simulated'} · ${num(r.holders)} holders`);
    updateStats(x.stats, [['MC', MC(r.mc)], ['V 5m', MC(r.vol5m)], ['Change', pct(r.ch5m), r.ch5m >= 0 ? 'is-up' : 'is-down']], 'strong', 'tbb-stat');
    x.bar.style.setProperty('--progress', `${Math.max(0, Math.min(100, (r.progress || 0) * 100))}%`);
    x.bar.title = `Bonding curve ${share(r.progress)}`;
    setText(x.buy, `ϟ ${quick.value} ${U.name}`); x.buy.disabled = r.phase === 'migrating' || r.live && r.tracked === false;
    x.watch.setAttribute('aria-pressed', String(S.watched.has(r.id)));
  }
  function render() {
    if (S.dead) return;
    for (const b of navBtns) b.setAttribute('aria-current', b.dataset.view === S.view && S.coin === null ? 'page' : 'false');
    for (const b of railButtons) b.setAttribute('aria-pressed', String(b.dataset.chain === S.chain));
    for (const b of sortBtns) b.setAttribute('aria-pressed', String(b.dataset.sort === S.sort));
    for (const b of windowBtns) b.setAttribute('aria-pressed', String(b.dataset.win === S.window));
    discover.hidden = S.coin !== null || S.view !== 'discover'; pulse.hidden = S.coin !== null || S.view !== 'pulse';
    portfolio.hidden = S.coin !== null || S.view !== 'portfolio'; trackers.hidden = S.coin !== null || S.view !== 'trackers';
    multichart.hidden = S.coin !== null || S.view !== 'multichart'; coinView.hidden = S.coin === null;
    setText(balance, `W1  ${M(market.player.sol)}`);
    setText(footerStatus, market.live ? '● Live market · play money' : '● Practice session');
    notifications.title = `${S.notification} automation notifications`;
    if (!discover.hidden || !pulse.hidden) {
      const rows = allRows(), sources = [...new Set(rows.map(r => r.src || 'simulated'))];
      const signature = sources.join('|');
      if (source.dataset.sources !== signature) {
        source.dataset.sources = signature; source.replaceChildren(el('option', { value: 'all' }, 'All sources'), ...sources.map(id => el('option', { value: id }, id === 'simulated' ? 'Simulated' : id))); source.value = S.source;
      }
      if (!discover.hidden) {
        const list = filtered(rows).slice(0, 75);
        keyed(discoverList, list, r => r.id, makeMarketRow, updateMarketRow);
        if (!list.length) discoverList.replaceChildren(empty(S.sort === 'watching' ? 'Star a token to add it to your watchlist.' : 'No tokens match these filters.'));
        else discoverList.querySelector('.tbb-empty')?.remove();
      }
      if (!pulse.hidden && !S.paused) {
        const lists = market.lists({ limit: 40 });
        for (const id of ['new', 'stretch', 'migrated']) {
          const list = filtered(lists[id]); setText(pulseCounts[id], list.length);
          keyed(pulseLists[id], list, r => r.id, makePulseCard, updatePulseCard);
          if (!list.length) pulseLists[id].replaceChildren(empty('No tokens here yet.'));
          else pulseLists[id].querySelector('.tbb-empty')?.remove();
        }
      }
    }
    if (!portfolio.hidden) renderPortfolio();
    if (!trackers.hidden) renderTracker();
    if (!multichart.hidden) renderMultichart();
    if (!coinView.hidden) renderCoin();
  }
  function navigate(view) {
    if (S.coin !== null) closeSub();
    S.view = view; closeSearch(); render();
  }
  function openCoin(id) {
    if (!Number.isInteger(id) || !market.row(id)) return;
    if (S.coin === null) ctx.pushSub?.();
    S.coin = id; S.viewed.set(id, (S.viewed.get(id) || 0) + 1); S.tab = 'trades'; S.side = 'buy'; S.type = 'market'; amount.value = quick.value;
    const r = market.row(id); target.value = String(Math.round(r.mc * px));
    coinPic.replaceChildren(pic(r, '', 'tbb')); setText(coinHeading, r.ticker); setText(coinSubtitle, r.name);
    ctx.onCoin?.(id); syncOrder(); render(); chart.fit();
  }
  function closeSub(fromPop = false) {
    if (S.coin === null) return;
    S.coin = null; ctx.onCoin?.(null); if (!fromPop) ctx.popSub?.(); render();
  }
  function syncOrder() {
    typeSelect.value = S.type;
    for (const b of sideBtns) b.setAttribute('aria-pressed', String(b.dataset.side === S.side));
    amount.setAttribute('aria-label', S.side === 'buy' ? `Buy amount in ${U.name}` : 'Sell percentage');
    setText(amountUnit, S.side === 'buy' ? U.name : '%');
    presets.replaceChildren(...(S.side === 'buy' ? buyPresets(ctx.start).map(v => [shown(v), shown(v)]) : [['25', '25%'], ['50', '50%'], ['75', '75%'], ['100', '100%']])
      .map(([value, label]) => btn(label, () => { amount.value = value; })));
    limitFields.hidden = S.type !== 'limit'; dcaFields.hidden = S.type !== 'dca'; trailFields.hidden = S.type !== 'trail';
    setText(orderTypeNote, S.type === 'market' ? '' : S.type === 'dca' ? 'Submits one order each interval while this run is open.'
      : S.type === 'trail' ? 'Sells once after the market cap falls from its highest value after creation.'
        : S.type === 'migration' ? 'Buys once when this token enters its pool.' : 'Submits a market order when this target is crossed.');
    setText(orderBtn, `${S.type === 'market' ? '' : 'Create '}${S.side === 'buy' ? 'Buy' : 'Sell'}${S.type === 'market' ? ` ${market.row(S.coin)?.ticker || ''}` : ` ${S.type === 'trail' ? 'trailing stop' : S.type === 'migration' ? 'migration snipe' : S.type.toUpperCase()} order`}`);
    flag(orderBtn, 'is-sell', S.side === 'sell'); setText(feedback, ''); renderCoin();
  }
  function submitOrder() {
    const r = market.row(S.coin), value = parseAmount(amount.value);
    if (!r || !(value > 0) || S.side === 'sell' && value > 100) { setText(feedback, S.side === 'sell' ? 'Enter a percentage between 0 and 100.' : 'Enter a positive amount.'); return; }
    const p = { coin: S.coin, side: S.side, ...(S.side === 'buy' ? { sol: value / U.per } : { frac: value / 100 }), ...ctx.settings() };
    if (S.type === 'market') {
      const result = ctx.order(p); setText(feedback, result?.ok ? 'Order submitted. Check the Trades tab for its fill.' : errorWords(result?.error));
      flag(feedback, 'is-down', !result?.ok); renderCoin(); return;
    }
    if (S.type === 'trail' && S.side !== 'sell' || S.type === 'migration' && S.side !== 'buy') { setText(feedback, S.type === 'trail' ? 'Trailing stops are sell orders.' : 'Migration snipes are buy orders.'); return; }
    const o = automations.add({ ...p, mode: S.type, target: parseAmount(target.value) / px,
      interval: Number(interval.value), count: Number(repeats.value), drop: Number(trail.value) / 100 });
    setText(feedback, o ? 'Order created. It remains active for this run.' : 'Check the target and order settings. Migration snipes need a token that has not migrated.');
    flag(feedback, 'is-down', !o); if (o) { S.tab = 'orders'; renderCoinTables(); }
  }
  function renderCoin() {
    if (S.coin === null || S.dead) return;
    const r = market.row(S.coin), st = market.stats(S.coin); if (!r || !st) return;
    setText(coinSubtitle, `${r.name} · ${age(r.age)} · ${r.live ? 'Real coin · play money' : 'Simulated'}${r.live && !r.tracked ? ' · Not live' : ''}`);
    updateStats(coinStats, [['Market Cap', MC(r.mc)], ['Liquidity', MC(st.liq)], ['Volume 5m', MC(st.vol5m)], ['Holders', num(st.holders)], ['5m', pct(st.change5m), st.change5m >= 0 ? 'is-up' : 'is-down']], 'strong', 'tbb-stat');
    watchCoin.setAttribute('aria-pressed', String(S.watched.has(S.coin)));
    for (const b of tfBtns) b.setAttribute('aria-pressed', String(Number(b.dataset.tf) === S.tf));
    for (const b of fxBtns) b.setAttribute('aria-pressed', String(S.indicators.has(b.dataset.fx)));
    chart.set({ candles: candleReader.read(S.coin, st.cdv), solUsd: px, tf: S.tf, migratedAt: st.migratedAt, base,
      marks: market.orders(120).filter(o => o.coin === S.coin && o.status === 'filled').map(o => ({ t: o.doneAt, side: o.side })) });
    setText(holdLine, S.side === 'buy' ? `Balance ${M(market.player.sol)}` : `Holding ${tokens(st.me?.tokens || 0)} ${r.ticker}`);
    const settings = ctx.settings(); setText(tradeSettings, `Slippage ${share(settings.slippage)}  ·  Priority ${settings.priority}  ⚙`);
    orderBtn.disabled = S.type === 'market' && (r.phase === 'migrating' || r.live && !r.tracked);
    const p = market.positions().find(p => p.id === S.coin);
    paintBasedInfo(positionInfo, 'position', 'My Position', [['Bought', M(p?.invested || 0)], ['Sold', M(p?.sold || 0)], ['Current holding', M(p?.value || 0)], ['PnL', p ? `${MS(p.total)} (${pct(p.pnlPct)})` : '—']]);
    paintBasedInfo(riskInfo, 'risk', 'Token Info', [['Top 10', share(st.top10)], ['Dev holding', share(st.dev)], ['Snipers', share(st.snipers)], ['Bundlers', share(st.bundlers)], ['Bonding curve', share(st.progress)], ['DEX paid', r.live ? '—' : st.dexPaid ? 'Yes' : 'No']]);
    renderCoinTables();
  }
  function table(labels, rows, cls = '') {
    return el('div', { class: ['tbb-data-scroll', cls] }, el('table', { class: 'tbb-data-table' }, el('thead', {}, el('tr', {}, labels.map(l => el('th', { scope: 'col' }, l)))),
      el('tbody', {}, rows.map(row => el('tr', {}, row.map(v => el('td', {}, v)))))));
  }
  function orderRows(coin = null) {
    return automations.list().filter(o => coin === null || o.coin === coin).map(o => ({ id: o.id, cells: [{ text: market.row(o.coin)?.ticker || 'Token', action: () => openCoin(o.coin) },
      `${o.side} · ${o.mode}`, o.mode === 'limit' ? MC(o.target) : o.mode === 'dca' ? `${o.remaining} × every ${o.interval}s` : o.mode === 'trail' ? `${share(o.drop)} below high` : 'On migration',
      o.side === 'alert' ? 'Alert' : o.side === 'buy' ? M(o.sol) : share(o.frac), { text: 'Cancel', action: () => { automations.cancel(o.id); render(); }, className: 'tbb-cancel' }] }));
  }
  const tradeKey = t => `${t.id ?? ''}|${t.t}|${t.coin ?? ''}|${t.addr ?? ''}|${t.side}|${t.sol}|${t.tok ?? ''}`;
  function renderCoinTables() {
    if (S.coin === null) return;
    for (const b of coinTabs) b.setAttribute('aria-pressed', String(b.dataset.ctab === S.tab));
    const st = market.stats(S.coin);
    if (S.tab === 'trades') {
      const trades = market.trades(S.coin, 40) || [];
      paintBasedTable(coinTable, `trades:${S.coin}`, ['Time', 'Type', 'Value', 'Tokens', 'Market Cap', 'Trader'], trades.map(t => ({ id: tradeKey(t), cells: [age(market.t - t.t),
        { text: t.side.toUpperCase(), tone: t.side === 'buy' ? 'is-up' : 'is-down' }, M(t.sol), tokens(t.tok), MC(t.mc), t.me ? 'You' : t.kol || (t.addr ? short(t.addr) : '—')] })), 'No trades yet.');
    } else if (S.tab === 'holders') {
      const holders = market.holders(S.coin, 40);
      paintBasedTable(coinTable, `holders:${S.coin}`, ['#', 'Holder', 'Share', 'Tokens', 'Bought', 'Sold'], (st.live ? [] : holders?.list || []).map(h => ({ id: h.addr, cells: [h.rank, h.me ? 'You' : short(h.addr), share(h.pct), tokens(h.tok), M(h.in), M(h.out)] })), st.live ? 'Holder identities are not provided by this live feed.' : 'No holders yet.');
    } else if (S.tab === 'orders') {
      const rows = orderRows(S.coin);
      paintBasedTable(coinTable, `orders:${S.coin}`, ['Token', 'Type', 'Trigger', 'Amount', ''], rows, 'No active conditional orders for this token.');
    } else if (S.tab === 'position') {
      const p = market.positions().find(p => p.id === S.coin);
      paintBasedInfo(coinTable, `position:${S.coin}`, '', p ? [['Tokens', tokens(p.tokens)], ['Invested', M(p.invested)], ['Sold', M(p.sold)], ['Value', M(p.value)], ['Total profit', `${MS(p.total)} · ${pct(p.pnlPct)}`], ['Fees', M(p.fees)]] : [['Position', 'Buy this token to open a practice position.']]);
    } else {
      const i = market.info(S.coin), r = market.row(S.coin);
      paintBasedInfo(coinTable, `info:${S.coin}`, '', [['Name', i?.name || r.name], ['Ticker', r.ticker], ['Contract', i?.mint ? `${i.mint.slice(0, 6)}…` : 'Simulated token'],
        ['Source', r.src || 'Simulated market'], ['Phase', r.phase], ['All-time high', MC(st.ath)], ['Age', age(st.age)], ['Transactions', num(st.txns)]]);
    }
  }
  function renderPortfolio() {
    const p = market.player, pos = market.positions();
    updateStats(portfolioStats, [['Total Value', M(p.worth)], ['Available Balance', M(p.sol)], ['Total PnL', MS(p.worth - market.startSol), p.worth >= market.startSol ? 'is-up' : 'is-down'], ['Open Positions', pos.filter(x => x.open).length]], 'strong', 'tbb-stat');
    for (const b of portfolioTabs) b.setAttribute('aria-pressed', String(b.dataset.ptab === S.portfolio));
    if (S.portfolio === 'orders') {
      paintBasedTable(portfolioBody, 'orders', ['Token', 'Type', 'Trigger', 'Amount', ''], orderRows(), 'No active conditional orders. Open a token and select Limit, DCA or a stop.');
    } else if (S.portfolio === 'history') {
      const orders = market.orders(100); paintBasedTable(portfolioBody, 'history', ['Token', 'Side', 'Amount', 'Status', 'Time'], orders.map(o => ({ id: o.id, cells: [{ text: o.ticker, action: () => openCoin(o.coin) }, o.side, o.side === 'buy' ? M(o.sol) : share(o.frac), o.reason ? `${o.status} · ${o.reason}` : o.status, age(market.t - o.t)] })), 'Your trade history will appear here.');
    } else {
      paintBasedTable(portfolioBody, 'positions', ['Token', 'Holding', 'Invested', 'Value', 'PnL', 'Action'], pos.map(p => ({ id: p.id, cells: [{ text: p.ticker, token: p, action: () => openCoin(p.id), className: 'tbb-position-token' }, tokens(p.tokens), M(p.invested), M(p.value),
        { text: `${MS(p.total)} (${pct(p.pnlPct)})`, tone: p.total >= 0 ? 'is-up' : 'is-down' }, p.open ? { text: 'Sell 100%', action: () => { const r = ctx.order({ coin: p.id, side: 'sell', frac: 1 }); toast(r?.ok ? 'Sell order submitted.' : errorWords(r?.error), r?.ok ? 'up' : 'down'); renderPortfolio(); }, className: 'tbb-sell-small' } : 'Closed'] })), 'No positions yet. Discover a token and make your first practice trade.');
    }
  }
  function renderTracker() {
    for (const b of trackerTabs) b.setAttribute('aria-pressed', String(b.dataset.track === S.tracker));
    const tape = S.tracker === 'me' ? market.orders(80).filter(o => o.status === 'filled').map(o => ({ ...o, label: 'me', sol: o.side === 'buy' ? o.spent : o.got }))
      : market.tape(100).filter(t => S.tracker === 'all' || t.label === S.tracker);
    paintBasedTable(trackerBody, `tracker:${S.tracker}`, ['Age', 'Token', 'Trader', 'Side', 'Value', 'Market cap', 'Action'], tape.slice(0, 60).map(t => ({ id: tradeKey(t), cells: [age(market.t - t.t), { text: t.ticker, action: () => openCoin(t.coin) }, t.label === 'me' ? 'You' : t.label || 'Unknown',
      { text: t.side, tone: t.side === 'buy' ? 'is-up' : 'is-down' }, M(t.sol), MC(t.mc), { text: 'Buy', action: () => quickBuy(t.coin), className: 'tbb-quick-buy' }] })), 'No activity matches this filter yet.');
  }
  function renderMultichart() {
    const ids = [...S.watched].filter(id => market.row(id)).slice(0, 4), key = ids.join(',');
    if (S.multiKey !== key) {
      for (const c of S.multi) c.chart.destroy(); S.multi = []; S.multiKey = key; multiGrid.replaceChildren();
      for (const id of ids) {
        const r = market.row(id), canvas = el('div', { class: 'tbb-mini-chart' });
        multiGrid.append(el('section', {}, btn(r.ticker, () => openCoin(id), 'tbb-mini-heading'), canvas));
        S.multi.push({ id, chart: createGChart(canvas, { tf: 5, colors: { bg: '#17171c', up: '#26a69a', down: '#ef5350' } }) });
      }
    }
    if (!ids.length && !multiGrid.children.length) multiGrid.append(empty('Star tokens in Discover to add them to this multichart workspace.'));
    for (const c of S.multi) c.chart.set({ candles: candleReader.read(c.id, market.stats(c.id)?.cdv), solUsd: px, tf: 5, base });
  }
  function dialog(title, children) {
    const d = el('dialog', { class: 'tbb-dialog ts-sheet', 'aria-label': title }, el('header', {}, el('h2', {}, title), ibtn('close', 'Close', () => d.close())), el('div', { class: 'tbb-dialog-body' }, children));
    d.addEventListener('close', () => { S.dialogs.delete(d); d.remove(); });
    d.addEventListener('click', e => { if (e.target === d) d.close(); });
    root.append(d); S.dialogs.add(d); d.showModal(); return d;
  }
  function showFilters() {
    const min = el('input', { class: 'tbb-in', inputMode: 'decimal', value: String(S.filters.minimum), 'aria-label': 'Minimum market cap in dollars' });
    const max = el('input', { class: 'tbb-in', inputMode: 'decimal', value: Number.isFinite(S.filters.maximum) ? String(S.filters.maximum) : '', placeholder: 'No maximum', 'aria-label': 'Maximum market cap in dollars' });
    const holders = el('input', { class: 'tbb-in', type: 'number', min: 0, value: S.filters.minHolders, 'aria-label': 'Minimum holders' });
    const msg = el('p', { role: 'status' });
    const d = dialog('Filters', [el('label', {}, 'Market cap minimum ($)', min), el('label', {}, 'Market cap maximum ($)', max), el('label', {}, 'Minimum holders', holders), msg,
      btn('Apply filters', () => {
        const lo = min.value.trim() ? parseAmount(min.value) : 0, hi = max.value.trim() ? parseAmount(max.value) : Infinity, hold = Number(holders.value);
        if (!(lo >= 0 && hi >= lo && hold >= 0 && Number.isFinite(hold))) { setText(msg, 'Enter a valid range and holder count.'); return; }
        S.filters = { minimum: lo, maximum: hi, minHolders: hold }; d.close(); render();
      }, 'is-primary'), btn('Reset filters', () => { S.filters = { minimum: 0, maximum: Infinity, minHolders: 0 }; S.chain = 'all'; S.source = 'all'; d.close(); render(); })]);
  }
  function showBlacklist() {
    const body = el('div');
    const paint = () => body.replaceChildren(...(S.blacklist.size ? [...S.blacklist].map(id => el('div', { class: 'tbb-blacklist-row' }, el('span', {}, market.row(id)?.ticker || 'Token'), btn('Restore', () => { S.blacklist.delete(id); paint(); render(); }))) : [empty('No hidden tokens. Use × in a token row to hide it.')]));
    paint(); dialog('Blacklist', [body]);
  }
  function showTools() { dialog('Tools', [btn('Multichart', () => { closeDialogs(); navigate('multichart'); }), btn('Price alerts', () => { closeDialogs(); showAlerts(); }),
    btn('Conditional orders', () => { closeDialogs(); S.portfolio = 'orders'; navigate('portfolio'); }), btn('Terminal settings', () => { closeDialogs(); showSettings(); })]); }
  function showSettings() {
    const dense = el('input', { type: 'checkbox', checked: S.dense, on: { change: () => { S.dense = dense.checked; flag(root, 'is-compact', S.dense); } } });
    dialog('Terminal settings', [el('label', { class: 'tbb-check-label' }, dense, 'Compact token rows'),
      el('p', { class: 'tbb-muted' }, 'The terminal uses your run’s slippage, execution priority and play-money balance.'),
      btn('Trading presets and sound', () => { closeDialogs(); ctx.openSettings(); }), btn('Clear watchlist', () => { S.watched.clear(); render(); toast('Watchlist cleared.'); })]);
  }
  function priceAlert() {
    if (S.coin === null) { showAlerts(); return; }
    const id = S.coin, r = market.row(id), input = el('input', { class: 'tbb-in', inputMode: 'decimal', value: String(Math.round(r.mc * px * 1.2)), 'aria-label': 'Alert market cap in dollars' });
    const msg = el('p', { role: 'status' });
    const d = dialog(`Price alert · ${r.ticker}`, [el('label', {}, 'Target market cap ($)', input), msg, btn('Create alert', () => {
      const added = automations.add({ coin: id, side: 'alert', target: parseAmount(input.value) / px });
      if (!added) { setText(msg, 'Enter a positive market cap.'); return; } d.close(); toast('Price alert created for this run.');
    }, 'is-primary')]);
  }
  function showAlerts() {
    const body = el('div');
    const paint = () => { const list = automations.list().filter(o => o.side === 'alert'); body.replaceChildren(...(list.length ? list.map(o => el('div', { class: 'tbb-blacklist-row' },
      el('span', {}, `${market.row(o.coin)?.ticker} · ${MC(o.target)}`), btn('Remove', () => { automations.cancel(o.id); paint(); }))) : [empty('No active price alerts. Open a token and choose Create price alert.')])); };
    paint(); dialog('Price alerts', [body]);
  }
  function showNotifications() {
    S.notification = 0; const events = automations.history();
    dialog('Notifications', [events.length ? table(['Token', 'Order', 'Result', 'Age'], events.map(o => [market.row(o.coin)?.ticker || 'Token', `${o.side} ${o.mode}`, o.status === 'failed' ? errorWords(o.error) : o.status, age(market.t - o.at)])) : empty('Triggered alerts and conditional orders appear here.')]);
  }
  function exportTrades() {
    const rows = [['Token', 'Side', 'Status', 'Amount', 'Unit', 'Market time (s)'], ...market.orders(300).map(o => [o.ticker, o.side, o.status, o.side === 'buy' ? o.sol * U.per : o.frac * 100, o.side === 'buy' ? U.name : '%', o.t])];
    const csv = rows.map(row => row.map(basedCsvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = el('a', { href: url, download: 'basedbott-practice-trades.csv' }); a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function closeDialogs() { for (const d of [...S.dialogs]) d.close(); }
  function keydown(e) {
    if (S.dead || e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName) || e.target?.isContentEditable || document.querySelector('dialog[open]')) return;
    if (e.key === '/') { e.preventDefault(); openSearch(); }
    if (e.key === 'Escape' && S.searchOpen) closeSearch();
  }
  document.addEventListener('keydown', keydown);
  render();
  return { el: root, update(now) {
    if (S.dead) return;
    automations.tick();
    if (now - S.slow >= 700) { S.slow = now; render(); }
    else if (S.coin !== null && now - S.fast >= 250) { S.fast = now; renderCoin(); }
  }, sub: () => S.coin !== null, closeSub: () => closeSub(true), openCoin, destroy() {
    S.dead = true; closeDialogs(); chart.destroy(); for (const c of S.multi) c.chart.destroy(); automations.clear(); candleReader.clear(); sparkReader.clear();
    document.removeEventListener('keydown', keydown); root.remove();
  } };
}
