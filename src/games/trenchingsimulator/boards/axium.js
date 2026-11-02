// Axium: Pulse discovery and the trading workspace, using the game's single market and play-money account.
// Public workflow references: docs.axiom.trade/axiom/{finding-tokens/pulse,finding-tokens/explore-tokens,swap/market}.
// Orders, token metrics, holder lists and candles are simulator data; no wallet connection or external transactions.
import './axium.css';
import { el, setText, flag, keyed, icon, toast } from '../ui.js';
import { updateStats } from './stable-ui.js';
import { createCandleReader } from './candle-reader.js';
import { markEl, wordEl } from '../brands.js';
import { usd, money, moneySigned, pct, share, age, tokens, currencyOf, unitOf, nice } from '../format.js';
import { pic, samePic, short, num, buyPresets, parseAmount, ORDER_ERRORS, tone } from './common.js';
import { chartCredit } from './gchart.js';
import { createPhomoChart } from './phomo-chart.js';
import { createAddressSearch } from '../live-search.js';
import { AXIUM_FILTERS, axiumPasses, axiumTrigger, axiumFilterCount } from './axium-data.js';

const COLS = [['new', 'New Pairs'], ['stretch', 'Final Stretch'], ['migrated', 'Migrated']];
const NAV = [['discover', 'Discover'], ['pulse', 'Pulse'], ['trackers', 'Trackers'], ['perpetuals', 'Perpetuals'], ['portfolio', 'Portfolio']];
const TF = [['1s', 1], ['15s', 15], ['1m', 60], ['5m', 300], ['15m', 900]];
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const button = (label, fn, cls = 'ax-button', attrs = {}) => el('button', { class: cls, type: 'button', ...attrs, on: { click: fn } }, label);
const empty = (text) => el('p', { class: 'ax-empty' }, text);
const field = (label, input) => el('label', { class: 'ax-field' }, el('span', {}, label), input);
const clearEmpty = (host) => { for (const n of [...host.children]) if (!n.dataset.key) n.remove(); };

export function mountAxium(host, ctx) {
  const { market } = ctx, px = ctx.solUsd, cur = currencyOf(ctx.currency), U = unitOf(cur, px);
  const M = (v) => money(v, cur, px), MS = (v) => moneySigned(v, cur, px);
  const MC = (v) => usd(v * px);
  const base = Date.now() - market.t * 1000;
  const candleReader = createCandleReader(market, { maxEntries: 1 });
  const A = { view: 'pulse', coin: null, query: '', paused: false, density: false, mobileCol: 'new',
    filters: { new: {}, stretch: {}, migrated: {}, discover: {} }, watch: new Set(), hidden: new Set(),
    quick: String(nice(buyPresets(ctx.start)[1] * U.per)), tf: 1, indicators: [], chartMode: 'mcap', chartUnit: 'usd',
    side: 'buy', orderType: 'market', dataTab: 'trades', portfolioTab: 'positions', discover: 'trending',
    watchOnly: false, sort: 'vol5m', descending: true, limitSeq: 0, limits: [], tracked: new Set(),
    fastAt: -Infinity, slowAt: -Infinity, dead: false, chart: null, stats: new Map(), trackOnly: false,
    columnQuick: {}, columnQuery: {}, perps: null, perpsLoading: false };
  const stat = (id) => {
    if (!A.stats.has(id)) A.stats.set(id, market.stats(id));
    return A.stats.get(id);
  };
  const error = (code) => (ORDER_ERRORS[code] || 'The order could not be placed.').replace(/\bSOL\b/g, U.name);
  function send(params) {
    const result = ctx.order(params);
    if (!result?.ok) toast(error(result?.error), 'down');
    else toast(`${params.side === 'buy' ? 'Buy' : 'Sell'} order sent · play money`, 'up', 1400);
    return result;
  }
  function quickBuy(id, column = null) {
    const amount = parseAmount(column ? A.columnQuick[column] : A.quick);
    if (!(amount > 0)) return toast(`Enter a quick-buy amount in ${U.name}.`, 'down');
    send({ coin: id, side: 'buy', sol: amount / U.per });
  }
  function star(id) {
    if (A.watch.has(id)) A.watch.delete(id); else A.watch.add(id);
    renderWatch(); renderLists(true);
    if (A.coin !== null) paintCoin();
  }

  const nav = NAV.map(([id, label]) => button(label, () => setView(id), 'ax-nav-button', { 'aria-pressed': id === 'pulse' ? 'true' : 'false' }));
  const searchIn = el('input', { type: 'search', class: 'ax-search-input', placeholder: 'Search by token or CA…',
    'aria-label': 'Search Axium tokens', autocomplete: 'off', spellcheck: false });
  const searchResults = el('div', { class: 'ax-search-results', hidden: true });
  const lookup = createAddressSearch(market, () => { if (!A.dead) renderSearch(); });
  searchIn.addEventListener('input', () => { A.query = searchIn.value.trim(); renderSearch(); });
  const search = el('form', { class: 'ax-search', role: 'search', on: { submit: (e) => {
    e.preventDefault(); const found = market.find(A.query); if (found.length) openCoin(found[0]); else renderSearch();
  } } }, icon('search'), searchIn, el('kbd', {}, '/'), searchResults);
  function renderSearch() {
    searchResults.hidden = !A.query;
    if (!A.query) return;
    const rows = market.find(A.query).slice(0, 8).map((id) => market.row(id)).filter(Boolean);
    searchResults.replaceChildren(...rows.map((r) => button([pic(r, '', 'ax'), el('span', {}, el('b', {}, r.ticker),
      el('small', {}, r.name)), el('strong', {}, MC(r.mc))], () => { openCoin(r.id); searchResults.hidden = true; }, 'ax-search-result')));
    if (!rows.length) searchResults.append(empty(lookup(A.query) || 'No tokens found. Try a ticker or contract address.'));
  }
  const balance = el('strong', {}, '—');
  const head = el('header', { class: 'ax-header' },
    button([markEl('pro'), wordEl('pro'), el('span', { class: 'ax-pro' }, 'PRO')], () => setView('pulse'), 'ax-brand', { 'aria-label': 'Axium Pulse home' }),
    el('nav', { class: 'ax-nav', 'aria-label': 'Axium navigation' }, nav), search,
    button([icon('star'), el('span', { class: 'ax-desktop-text' }, 'Watchlist')], () => { A.watchOnly = !A.watchOnly; setView('discover'); }, 'ax-icon-button', { 'aria-label': 'Show watchlist' }),
    button([icon('sliders')], () => ctx.openSettings(), 'ax-icon-button', { 'aria-label': 'Axium trading settings' }),
    button([el('span', { class: 'ax-sol' }, '≋'), balance, el('span', {}, U.name)], () => setView('portfolio'), 'ax-wallet', { 'aria-label': 'Practice portfolio' }));
  const watch = el('div', { class: 'ax-watchstrip' });
  function renderWatch() {
    watch.replaceChildren(el('span', { class: 'ax-watch-label' }, icon('star'), 'Watchlist'),
      ...[...A.watch].map((id) => market.row(id)).filter(Boolean).map((r) => button([r.ticker, el('span', { class: r.ch5m >= 0 ? 'is-up' : 'is-down' }, pct(r.ch5m))], () => openCoin(r.id), 'ax-watch-token')));
    if (!A.watch.size) watch.append(el('span', { class: 'ax-muted' }, 'Star a token to follow it here'));
  }
  const quickIn = el('input', { type: 'text', inputMode: 'decimal', value: A.quick, 'aria-label': `Axium quick-buy amount (${U.name})`, class: 'ax-quick-input',
    on: { input: (e) => { A.quick = e.target.value; for (const c of columns) { A.columnQuick[c.id] = A.quick; c.quick.value = A.quick; } updateQuickLabels(); } } });
  const pause = button([icon('pause'), 'Pause'], () => {
    A.paused = !A.paused; pause.setAttribute('aria-pressed', String(A.paused));
    pause.replaceChildren(icon(A.paused ? 'play' : 'pause'), document.createTextNode(A.paused ? 'Resume' : 'Pause'));
    renderLists(true);
  }, 'ax-button', { 'aria-pressed': 'false' });
  const density = button([icon('menu'), 'Display'], () => {
    A.density = !A.density; flag(root, 'is-compact', A.density); density.setAttribute('aria-pressed', String(A.density));
  }, 'ax-button', { 'aria-pressed': 'false', title: 'Toggle compact token cards' });
  const title = el('h1', {}, 'Pulse');
  const pulseTools = el('div', { class: 'ax-page-tools' }, density, pause,
    el('label', { class: 'ax-quick-control' }, icon('bolt'), el('span', {}, 'Quick Buy'), quickIn, el('span', {}, U.name)),
    button('P1', () => pickPreset(0), 'ax-preset is-active'), button('P2', () => pickPreset(1), 'ax-preset'), button('P3', () => pickPreset(2), 'ax-preset'));
  function pickPreset(i) { ctx.pickPreset?.(i); syncPreset(); }
  function syncPreset() {
    const selected = ctx.presets?.().preset || 0;
    [...pulseTools.querySelectorAll('.ax-preset')].forEach((b, i) => { flag(b, 'is-active', i === selected); b.setAttribute('aria-pressed', String(i === selected)); });
  }
  const pageHead = el('div', { class: 'ax-pagehead' }, el('div', { class: 'ax-page-title' }, title, el('span', { class: 'ax-chain' }, '≋ ', ctx.chain || 'Solana')), pulseTools);
  const mobileCols = el('div', { class: 'ax-mobile-cols' }, COLS.map(([id, label]) => button(label, () => {
    A.mobileCol = id; syncColumns();
  }, 'ax-mobile-col', { data: { col: id } })));
  const columns = COLS.map(([id, label]) => {
    A.columnQuick[id] = A.quick; A.columnQuery[id] = '';
    const list = el('div', { class: 'ax-feed', 'aria-label': `${label} tokens` });
    const count = el('span', { class: 'ax-col-count' }, '0');
    const state = el('span', { class: 'ax-feed-state' }, '');
    const filter = button(icon('sliders'), () => openFilters(id, label), 'ax-icon-button', { 'aria-label': `${label} filters` });
    const search = el('input', { type: 'search', class: 'ax-col-search', placeholder: 'Search by ticker or name', 'aria-label': `Search ${label}`, on: { input: (e) => { A.columnQuery[id] = e.target.value; renderLists(true); } } });
    const quick = el('input', { type: 'text', inputMode: 'decimal', class: 'ax-col-quick', value: A.quick, 'aria-label': `${label} quick-buy amount (${U.name})`, on: { input: (e) => { A.columnQuick[id] = e.target.value; updateQuickLabels(); } } });
    const presets = el('span', { class: 'ax-col-presets' }, [0, 1, 2].map((i) => button(`P${i + 1}`, () => pickPreset(i), 'ax-preset')));
    const col = el('section', { class: 'ax-column', data: { col: id } },
      el('div', { class: 'ax-column-head' }, el('h2', {}, label), count, state, search,
        el('label', { class: 'ax-col-buy' }, icon('bolt'), quick, el('span', {}, '≋'), presets), filter), list);
    const c = { id, col, list, count, filter, state, quick, over: false, ids: [] };
    col.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') { c.over = true; setText(state, 'Paused'); } });
    col.addEventListener('pointerleave', () => { c.over = false; setText(state, ''); });
    return c;
  });
  const pulseView = el('section', { class: 'ax-pulse' }, mobileCols, el('div', { class: 'ax-columns' }, columns.map((c) => c.col)));
  function syncColumns() {
    for (const c of columns) flag(c.col, 'is-mobile-active', c.id === A.mobileCol);
    [...mobileCols.children].forEach((b) => { flag(b, 'is-active', b.dataset.col === A.mobileCol); b.setAttribute('aria-pressed', String(b.dataset.col === A.mobileCol)); });
  }
  function makeCard(r, column) {
    const name = el('b', { class: 'ax-token-ticker' }), fullname = el('span', { class: 'ax-token-name' });
    const tile = el('span', { class: 'ax-tile-wrap' }, pic(r, '', 'ax'));
    const starButton = button(icon('star'), () => star(r.id), 'ax-card-star', { 'aria-label': `Watch ${r.ticker}` });
    const identity = button([tile, el('span', { class: 'ax-identity' }, el('span', { class: 'ax-name-row' }, name, fullname),
      el('span', { class: 'ax-token-sub' }, el('span', { class: 'ax-age' }), el('span', { class: 'ax-source' })))], () => openCoin(r.id), 'ax-card-open');
    const cap = el('strong'), volume = el('strong'), txns = el('strong'), change = el('strong');
    const metrics = el('div', { class: 'ax-card-metrics' },
      el('span', {}, 'MC ', cap), el('span', {}, 'V ', volume), el('span', {}, 'TX ', txns), change);
    const holders = el('span'), top = el('span'), dev = el('span'), snipers = el('span'), bundle = el('span');
    const risk = el('div', { class: 'ax-card-risk' }, holders, top, dev, snipers, bundle);
    const bar = el('i'), progress = el('div', { class: 'ax-progress', 'aria-label': 'Bonding curve progress' }, bar);
    const buy = button([icon('bolt'), el('span', {}, A.columnQuick[column] || A.quick), ' ', U.name], () => quickBuy(r.id, column), 'ax-quick-buy', { 'aria-label': `Quick buy ${r.ticker}` });
    const hide = button('×', () => { A.hidden.add(r.id); renderLists(true); }, 'ax-hide-token', { 'aria-label': `Hide ${r.ticker}` });
    const card = el('article', { class: 'ax-card' }, starButton, identity, metrics, risk, progress, buy, hide);
    card.$ = { column, name, fullname, tile, starButton, cap, volume, txns, change, holders, top, dev, snipers, bundle, bar, buy,
      age: identity.querySelector('.ax-age'), source: identity.querySelector('.ax-source') };
    return card;
  }
  function paintCard(card, r) {
    const $ = card.$;
    setText($.name, r.ticker); setText($.fullname, r.name); setText($.age, age(r.age));
    setText($.source, r.live ? (r.tracked === false ? 'Not live' : r.src || ctx.chain || 'Live coin') : r.standIn ? 'Simulated' : 'pump');
    if (!samePic($.tile.firstChild, r)) $.tile.replaceChildren(pic(r, '', 'ax'));
    setText($.cap, MC(r.mc)); setText($.volume, MC(r.vol5m)); setText($.txns, num(r.txns5m));
    setText($.change, pct(r.ch5m)); tone($.change, r.ch5m, 0);
    const metrics = [[$.holders, '♙ ', num(r.holders), 'Holders'], [$.top, '◉ ', share(r.top10, 0), 'Top 10 holders'],
      [$.dev, '◇ ', share(r.dev, 0), 'Developer holding'], [$.snipers, '⌖ ', share(r.snipers, 0), 'Snipers'], [$.bundle, '▧ ', share(r.bundlers, 0), 'Bundlers']];
    for (const [node, prefix, value, label] of metrics) { setText(node, prefix + value); node.setAttribute('title', `${label}: ${value}`); }
    flag($.starButton, 'is-starred', A.watch.has(r.id)); $.starButton.setAttribute('aria-pressed', String(A.watch.has(r.id)));
    $.bar.style.setProperty('width', `${Math.max(0, Math.min(100, (r.progress || 0) * 100))}%`);
    card.setAttribute('title', `${r.name} · ${r.phase === 'pool' ? 'Migrated' : `Bonding ${share(r.progress)}`}`);
    setText($.buy.children[1], A.columnQuick[$.column] || '—');
    flag(card, 'is-migrated', r.phase === 'pool'); flag(card, 'is-rugged', r.rugged);
    $.buy.disabled = r.phase === 'migrating' || (r.live && r.tracked === false);
  }
  function updateQuickLabels() {
    for (const card of root.querySelectorAll('.ax-card')) if (card.$) setText(card.$.buy.children[1], A.columnQuick[card.$.column] || '—');
  }

  const discoverTabs = el('div', { class: 'ax-tabs' }, [['trending', 'Trending'], ['new', 'New Pairs'], ['migrated', 'Migrated']].map(([id, label]) =>
    button(label, () => { A.discover = id; A.watchOnly = false; renderLists(true); }, 'ax-tab', { data: { category: id } })),
    button('Watchlist', () => { A.watchOnly = !A.watchOnly; renderLists(true); }, 'ax-tab', { data: { category: 'watchlist' } }));
  const discoverBody = el('tbody');
  const headers = [['token', 'Token'], ['age', 'Age'], ['mc', 'Market Cap'], ['vol5m', '5m Volume'], ['ch5m', '5m Change'], ['txns5m', 'Txns'], ['holders', 'Holders']];
  const discoverView = el('section', { class: 'ax-discover', hidden: true }, el('div', { class: 'ax-view-tools' }, discoverTabs,
    button([icon('sliders'), 'Filters'], () => openFilters('discover', 'Discover'), 'ax-button')),
    el('div', { class: 'ax-table-scroll' }, el('table', { class: 'ax-table' }, el('thead', {}, el('tr', {},
      headers.map(([id, label]) => el('th', {}, button(label, () => {
        if (A.sort === id) A.descending = !A.descending; else { A.sort = id; A.descending = true; }
        renderLists(true);
      }, 'ax-sort'))), el('th', {}, 'Quick Buy'))), discoverBody)));
  function makeDiscover(r) {
    const token = button([pic(r, '', 'ax'), el('span', {}, el('b', {}, r.ticker), el('small', {}, r.name))], () => openCoin(r.id), 'ax-table-token');
    const starB = button(icon('star'), () => star(r.id), 'ax-card-star', { 'aria-label': `Watch ${r.ticker}` });
    const values = headers.slice(1).map(() => el('td'));
    const buy = button([icon('bolt'), A.quick], () => quickBuy(r.id), 'ax-table-buy', { 'aria-label': `Quick buy ${r.ticker}` });
    const row = el('tr', {}, el('td', { class: 'ax-token-cell' }, starB, token), values, el('td', {}, buy));
    row.$ = { values, starB, buy }; return row;
  }
  function paintDiscover(node, r) {
    const $ = node.$;
    [age(r.age), MC(r.mc), MC(r.vol5m), pct(r.ch5m), num(r.txns5m), num(r.holders)].forEach((v, i) => setText($.values[i], v));
    tone($.values[3], r.ch5m, 0); flag($.starB, 'is-starred', A.watch.has(r.id));
    $.starB.setAttribute('aria-pressed', String(A.watch.has(r.id)));
    setText($.buy, `ϟ ${A.quick || '—'} ${U.name}`);
  }
  function renderLists(force = false) {
    if (A.coin !== null || !['pulse', 'discover'].includes(A.view)) return;
    const L = market.lists({ limit: 100 });
    if (A.view === 'pulse') {
      for (const c of columns) {
        let rows;
        if (!force && (c.over || A.paused)) rows = c.ids.map((id) => market.row(id)).filter(Boolean);
        else {
          rows = L[c.id].filter((r) => !A.hidden.has(r.id) && axiumPasses(r, stat(r.id), A.filters[c.id], px, A.columnQuery[c.id])).slice(0, 35);
          c.ids = rows.map((r) => r.id);
        }
        clearEmpty(c.list); keyed(c.list, rows, (r) => r.id, (r) => makeCard(r, c.id), paintCard);
        if (!rows.length) c.list.replaceChildren(empty('No tokens match your filters.'));
        setText(c.count, rows.length); setText(c.state, A.paused || c.over ? 'Paused' : '');
        flag(c.filter, 'is-filtered', axiumFilterCount(A.filters[c.id]) > 0);
      }
    } else {
      let rows = A.watchOnly ? [...A.watch].map((id) => market.row(id)).filter(Boolean) : L[A.discover];
      rows = rows.filter((r) => !A.hidden.has(r.id) && axiumPasses(r, stat(r.id), A.filters.discover, px));
      rows.sort((a, b) => (A.sort === 'token' ? a.ticker.localeCompare(b.ticker) : (a[A.sort] ?? -Infinity) - (b[A.sort] ?? -Infinity)) * (A.descending ? -1 : 1));
      clearEmpty(discoverBody); keyed(discoverBody, rows, (r) => r.id, makeDiscover, paintDiscover);
      if (!rows.length) discoverBody.replaceChildren(el('tr', {}, el('td', { colSpan: 8 }, empty(A.watchOnly ? 'Your watchlist is empty. Star a token in Pulse.' : 'No tokens match your filters.'))));
      [...discoverTabs.children].forEach((b) => flag(b, 'is-active', A.watchOnly ? b.dataset.category === 'watchlist' : b.dataset.category === A.discover));
      [...discoverView.querySelectorAll('th')].forEach((th, i) => th.setAttribute('aria-sort', headers[i]?.[0] === A.sort ? A.descending ? 'descending' : 'ascending' : 'none'));
    }
  }

  const dialogBody = el('div', { class: 'ax-dialog-body' });
  const dialogTitle = el('h2');
  const dialog = el('dialog', { class: 'ax-dialog', 'aria-label': 'Axium filters' }, el('div', { class: 'ax-dialog-head' }, dialogTitle,
    button(icon('close'), () => dialog.close(), 'ax-icon-button', { 'aria-label': 'Close filters' })), dialogBody);
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  function openFilters(id, label) {
    setText(dialogTitle, `${label} Filters`);
    const inputs = new Map();
    const form = el('form', { class: 'ax-filter-form', on: { submit: (e) => {
      e.preventDefault(); const next = {};
      for (const [key, pair] of inputs) {
        const vals = pair.map((i) => i.value.trim() === '' ? null : Number(i.value));
        if (vals.some((v) => v !== null && (!finite(v) || v < 0)) || (vals[0] !== null && vals[1] !== null && vals[0] > vals[1])) {
          toast('Use positive ranges with the minimum below the maximum.', 'down'); return;
        }
        if (vals.some((v) => v !== null)) next[key] = vals;
      }
      A.filters[id] = next; dialog.close(); renderLists(true);
    } } }, el('p', { class: 'ax-muted' }, '5-minute activity. Leave a range blank to include all. Unknown live metrics do not pass a set filter.'),
    el('div', { class: 'ax-filter-grid' }, AXIUM_FILTERS.map(([key, labelText]) => {
      const pair = ['Minimum', 'Maximum'].map((kind, index) => el('input', { type: 'number', min: 0, step: 'any',
        value: A.filters[id][key]?.[index] ?? '', placeholder: kind === 'Minimum' ? 'Min' : 'Max', 'aria-label': `${kind} ${labelText}` }));
      inputs.set(key, pair); return el('label', { class: 'ax-range' }, el('span', {}, labelText), el('span', {}, pair[0], el('span', {}, '—'), pair[1]));
    })), el('div', { class: 'ax-dialog-actions' },
      button('Reset', () => { A.filters[id] = {}; openFilters(id, label); renderLists(true); }),
      button('Show hidden tokens', () => { A.hidden.clear(); renderLists(true); toast('Hidden tokens restored.'); }),
      el('button', { class: 'ax-primary', type: 'submit' }, 'Apply filters')));
    dialogBody.replaceChildren(form);
    if (!dialog.open) dialog.showModal();
  }

  // Portfolio and trigger orders use the same account as the rest of the simulator.
  const portfolioStats = el('div', { class: 'ax-portfolio-stats' });
  const portfolioBody = el('tbody');
  const portfolioHead = el('thead');
  const portfolioTabs = el('div', { class: 'ax-tabs' }, [['positions', 'Positions'], ['history', 'History'], ['orders', 'Orders']].map(([id, label]) =>
    button(label, () => { A.portfolioTab = id; renderPortfolio(); }, 'ax-tab', { data: { tab: id } })));
  const portfolioView = el('section', { class: 'ax-portfolio', hidden: true }, portfolioStats, portfolioTabs,
    el('div', { class: 'ax-table-scroll' }, el('table', { class: 'ax-table' }, portfolioHead, portfolioBody)));
  const statBlock = (label, value, cls = '') => el('div', {}, el('span', {}, label), el('strong', { class: cls }, value));
  function renderPortfolio() {
    const p = market.player, pnl = p.worth - market.startSol;
    updateStats(portfolioStats, [['Portfolio value', M(p.worth)], ['Available balance', M(p.sol)],
      ['Total P&L', MS(pnl), pnl >= 0 ? 'is-up' : 'is-down'], ['Open positions', market.positions().filter((x) => x.open).length]]);
    [...portfolioTabs.children].forEach((b) => flag(b, 'is-active', b.dataset.tab === A.portfolioTab));
    if (portfolioBody.dataset.tab !== A.portfolioTab) portfolioBody.replaceChildren();
    portfolioBody.dataset.tab = A.portfolioTab;
    clearEmpty(portfolioBody);
    if (A.portfolioTab === 'positions') {
      portfolioHead.replaceChildren(el('tr', {}, ['Token', 'Bought', 'Sold', 'Holding', 'PnL', 'Action'].map((x) => el('th', {}, x))));
      const rows = market.positions();
      keyed(portfolioBody, rows, (p) => p.id, (p) => {
        const cells = Array.from({ length: 4 }, () => el('td'));
        const sell = button('Sell 100%', () => send({ coin: p.id, side: 'sell', frac: 1 }), 'ax-sell-small');
        const tr = el('tr', {}, el('td', {}, button(p.ticker, () => openCoin(p.id), 'ax-token-link')), cells, el('td', {}, sell)); tr.$ = { cells, sell }; return tr;
      }, (n, p) => {
        [M(p.invested), M(p.sold), M(p.value), `${MS(p.total)} (${pct(p.pnlPct)})`].forEach((v, i) => setText(n.$.cells[i], v));
        tone(n.$.cells[3], p.total, 0); n.$.sell.disabled = !p.open;
      });
      if (!rows.length) portfolioBody.replaceChildren(el('tr', {}, el('td', { colSpan: 6 }, empty('Your positions appear here after your first trade.'))));
    } else if (A.portfolioTab === 'history') {
      portfolioHead.replaceChildren(el('tr', {}, ['Token', 'Side', 'Amount', 'Status', 'Time', 'Details'].map((x) => el('th', {}, x))));
      const rows = market.orders(100);
      keyed(portfolioBody, rows, (p) => p.id, () => el('tr', {}, Array.from({ length: 6 }, () => el('td'))), (tr, p) => {
        const values = [p.ticker, p.side.toUpperCase(), p.side === 'buy' ? M(p.sol) : share(p.frac), p.status, age(market.t - p.t), p.reason ? error(p.reason) : p.status === 'filled' ? `${tokens(p.tok)} tokens` : 'Waiting for execution'];
        values.forEach((v, i) => setText(tr.children[i], v));
        flag(tr.children[1], 'is-up', p.side === 'buy'); flag(tr.children[1], 'is-down', p.side === 'sell');
      });
      if (!rows.length) portfolioBody.replaceChildren(el('tr', {}, el('td', { colSpan: 6 }, empty('No orders yet.'))));
    } else {
      portfolioHead.replaceChildren(el('tr', {}, ['Token', 'Type', 'Side', 'Trigger', 'Amount', 'Action'].map((x) => el('th', {}, x))));
      keyed(portfolioBody, A.limits, (p) => p.id, (p) => el('tr', {}, Array.from({ length: 5 }, () => el('td')), el('td', {}, button('Cancel', () => cancelOrder(p.id), 'ax-button'))), (tr, p) => {
        [market.row(p.coin)?.ticker || '—', p.kind.toUpperCase(), p.side, p.kind === 'dca' ? `${p.remaining} left · next in ${age(Math.max(0, p.nextAt - market.t))}` : `${p.direction === 'above' ? '≥' : '≤'} ${MC(p.target)}`,
          p.side === 'buy' ? M(p.sol) : share(p.frac)].forEach((v, i) => setText(tr.children[i], v));
      });
      if (!A.limits.length) portfolioBody.replaceChildren(el('tr', {}, el('td', { colSpan: 6 }, empty('No active trigger orders. Place one from a token’s Limit or DCA tab.'))));
    }
  }
  function cancelOrder(id) { A.limits = A.limits.filter((p) => p.id !== id); renderPortfolio(); if (A.coin !== null) renderData(); }
  function checkTriggers() {
    if (ctx.run?.over) return;
    for (const order of A.limits.slice()) {
      const row = market.row(order.coin);
      if (!row || (row.live && row.tracked === false) || !axiumTrigger(order, row.mc, market.t)) continue;
      const res = send(order.side === 'buy' ? { coin: order.coin, side: 'buy', sol: order.sol } : { coin: order.coin, side: 'sell', frac: order.frac });
      if (res?.ok && order.kind === 'dca' && --order.remaining > 0) order.nextAt = market.t + order.interval;
      else A.limits = A.limits.filter((o) => o.id !== order.id);
    }
  }

  const trackerWallets = el('div', { class: 'ax-tracker-wallets' }), trackerFeed = el('div', { class: 'ax-tracker-feed' });
  const trackToggle = button('Tracked only', () => { A.trackOnly = !A.trackOnly; trackToggle.setAttribute('aria-pressed', String(A.trackOnly)); renderTrackers(); }, 'ax-button', { 'aria-pressed': 'false' });
  const trackersView = el('section', { class: 'ax-trackers', hidden: true },
    el('section', {}, el('div', { class: 'ax-panel-title' }, el('h2', {}, 'Wallet Tracker'), el('span', { class: 'ax-muted' }, 'Simulated smart wallets')), trackerWallets),
    el('section', {}, el('div', { class: 'ax-panel-title' }, el('h2', {}, 'Live Trades'), trackToggle), trackerFeed));
  const perpsView = el('section', { class: 'ax-perps', hidden: true });
  async function loadPerps() {
    if (A.perps || A.perpsLoading) { A.perps?.setActive(A.coin === null && A.view === 'perpetuals'); return; }
    A.perpsLoading = true; perpsView.replaceChildren(empty('Loading perpetual markets…'));
    try {
      const [{ mountPhomoPerps }] = await Promise.all([import('./phomo-perps.js'), import('./phomo-perps.css')]);
      if (A.dead) return;
      perpsView.replaceChildren(); A.perps = mountPhomoPerps(perpsView, { ...ctx, colors: { ...ctx.colors, accent: '#526fff' } });
      A.perps.setActive(A.coin === null && A.view === 'perpetuals');
    } catch {
      if (!A.dead) perpsView.replaceChildren(empty('Perpetual market data could not load.'), button('Try again', loadPerps, 'ax-button'));
    } finally { A.perpsLoading = false; }
  }
  function renderTrackers() {
    const wallets = market.smartWallets();
    clearEmpty(trackerWallets); keyed(trackerWallets, wallets, (w) => w.n, (w) => {
      const label = el('span'), value = el('strong'), follow = button('Track', () => {
        if (A.tracked.has(w.addr)) A.tracked.delete(w.addr); else A.tracked.add(w.addr); renderTrackers();
      }, 'ax-button');
      const row = el('div', { class: 'ax-tracker-wallet' }, el('span', { class: 'ax-avatar' }, `W${w.n + 1}`), label, value, follow);
      row.$ = { label, value, follow }; return row;
    }, (node, w) => {
      setText(node.$.label, short(w.addr)); setText(node.$.value, MS(w.pnl + w.upnl)); tone(node.$.value, w.pnl + w.upnl, 0);
      setText(node.$.follow, A.tracked.has(w.addr) ? 'Tracking' : 'Track'); node.$.follow.setAttribute('aria-pressed', String(A.tracked.has(w.addr)));
    });
    const followed = new Set(wallets.filter((w) => A.tracked.has(w.addr)).map((w) => w.n));
    const rows = market.feed(0).filter((f) => /^(smart|kol|whale)_(buy|sell)$/.test(f.kind) && (!A.trackOnly || (f.smart !== undefined && followed.has(f.smart)))).slice(-50).reverse();
    // The engine feed labels simulated traders; real trades never acquire invented wallet identities here.
    clearEmpty(trackerFeed); keyed(trackerFeed, rows, (f) => f.q, (f) => button('', () => openCoin(f.c), 'ax-tracker-trade'), (node, f) => {
      const r = market.row(f.c), buying = f.kind.endsWith('_buy');
      setText(node, `${buying ? 'BUY' : 'SELL'}  ${r?.ticker || '—'}  ·  ${M(f.sol)}  ·  ${f.smart !== undefined ? `Wallet ${f.smart + 1}` : f.kind.startsWith('kol') ? 'Caller' : 'Whale'}  ·  ${age(market.t - f.t)}`);
      flag(node, 'is-up', buying); flag(node, 'is-down', !buying);
    });
    if (!rows.length) trackerFeed.replaceChildren(empty(A.trackOnly ? 'Trades from tracked wallets will appear here.' : 'Waiting for the next market trade…'));
  }

  // Token detail: chart, transaction table, order ticket and token information.
  const coinName = el('h2'), coinFullName = el('span'), coinPic = el('span', { class: 'ax-coin-pic' });
  const coinStar = button(icon('star'), () => star(A.coin), 'ax-icon-button', { 'aria-label': 'Watch this token' });
  const coinStats = el('div', { class: 'ax-coin-stats' });
  const coinTitle = el('div', { class: 'ax-coin-title' }, button(icon('back'), () => closeCoin(false), 'ax-icon-button', { 'aria-label': 'Back to Pulse' }),
    coinPic, el('div', {}, coinName, coinFullName), coinStar, coinStats);
  const chartHost = el('div', { class: 'ax-chart-host', tabIndex: 0, 'aria-label': 'Token candlestick chart' });
  const chartLabel = el('span', { class: 'ax-chart-label' });
  const tfButtons = TF.map(([label, value]) => button(label, () => { A.tf = value; paintCoin(); }, 'ax-chart-button', { data: { tf: value }, 'aria-label': `${label} candles` }));
  const modeButton = button('Market Cap', () => { A.chartMode = A.chartMode === 'mcap' ? 'price' : 'mcap'; setText(modeButton, A.chartMode === 'mcap' ? 'Market Cap' : 'Price'); A.chart?.view({ mode: A.chartMode }); }, 'ax-chart-button');
  const unitButton = button('USD', () => { A.chartUnit = A.chartUnit === 'usd' ? 'coin' : 'usd'; setText(unitButton, A.chartUnit === 'usd' ? 'USD' : U.name); A.chart?.view({ unit: A.chartUnit, per: U.per }); }, 'ax-chart-button');
  const indicatorButtons = [['ma', 'MA'], ['ema', 'EMA'], ['rsi', 'RSI'], ['macd', 'MACD']].map(([id, label]) => button(label, () => {
    A.indicators = A.indicators.includes(id) ? A.indicators.filter((s) => s !== id) : [...A.indicators, id];
    A.chart?.indicators(A.indicators); syncChartTools();
  }, 'ax-chart-button', { data: { indicator: id }, 'aria-pressed': 'false' }));
  const chartTools = el('div', { class: 'ax-chart-tools' }, tfButtons, el('span', { class: 'ax-separator' }), modeButton, unitButton,
    indicatorButtons, button('−', () => A.chart?.zoom(-1), 'ax-chart-button', { 'aria-label': 'Zoom chart out' }),
    button('+', () => A.chart?.zoom(1), 'ax-chart-button', { 'aria-label': 'Zoom chart in' }), button('Reset', () => A.chart?.fit(), 'ax-chart-button'));
  const drawButtons = [['cursor', '⌖', 'Cursor'], ['trend', '╱', 'Trend line'], ['horizontal', '―', 'Horizontal line'], ['vertical', '│', 'Vertical line'],
    ['ray', '↗', 'Ray'], ['rectangle', '□', 'Rectangle'], ['measure', '↔', 'Measure']].map(([id, symbol, name]) =>
    button(symbol, () => A.chart?.drawTool(id), 'ax-draw-button', { 'aria-label': name, title: name, data: { tool: id }, 'aria-pressed': String(id === 'cursor') }));
  const undo = button('↶', () => A.chart?.undo(), 'ax-draw-button', { 'aria-label': 'Undo drawing', title: 'Undo drawing', disabled: true });
  const redo = button('↷', () => A.chart?.redo(), 'ax-draw-button', { 'aria-label': 'Redo drawing', title: 'Redo drawing', disabled: true });
  const drawRail = el('div', { class: 'ax-draw-rail', 'aria-label': 'Chart drawing tools' }, drawButtons, undo, redo,
    button('×', () => A.chart?.removeSelected(), 'ax-draw-button', { 'aria-label': 'Delete selected drawing', title: 'Delete selected drawing' }),
    button('⌫', () => A.chart?.clearDrawings(), 'ax-draw-button', { 'aria-label': 'Clear drawings', title: 'Clear drawings' }));
  const chartStyle = el('select', { class: 'ax-chart-style', 'aria-label': 'Chart style', on: { change: (e) => A.chart?.style(e.target.value) } },
    ['candles', 'bars', 'line', 'area'].map((value) => el('option', { value }, value.charAt(0).toUpperCase() + value.slice(1))));
  const log = button('log', () => A.chart?.scale(A.chart.state.scale === 'log' ? 'normal' : 'log'), 'ax-chart-button', { 'aria-label': 'Logarithmic scale', 'aria-pressed': 'false' });
  const percent = button('%', () => A.chart?.scale(A.chart.state.scale === 'percent' ? 'normal' : 'percent'), 'ax-chart-button', { 'aria-label': 'Percentage scale', 'aria-pressed': 'false' });
  const chartBottom = el('div', { class: 'ax-chart-bottom' }, chartStyle, ...[['5m', 300], ['1h', 3600], ['All', null]].map(([label, seconds]) =>
    button(label, () => A.chart?.range(seconds), 'ax-chart-button', { 'aria-label': `${label} chart range` })), log, percent,
    button('Latest', () => A.chart?.toNow(), 'ax-chart-button'));
  function syncChartTools() {
    tfButtons.forEach((b) => flag(b, 'is-active', Number(b.dataset.tf) === A.tf));
    indicatorButtons.forEach((b) => { flag(b, 'is-active', A.indicators.includes(b.dataset.indicator)); b.setAttribute('aria-pressed', String(A.indicators.includes(b.dataset.indicator))); });
  }
  const dataBody = el('tbody'), dataHead = el('thead');
  const dataTabs = el('div', { class: 'ax-tabs' }, [['trades', 'Trades'], ['positions', 'Positions'], ['orders', 'Orders'], ['holders', 'Holders'], ['traders', 'Top Traders'], ['early', 'Early Buyers'], ['dev', 'Dev Tokens']].map(([id, label]) =>
    button(label, () => { A.dataTab = id; renderData(); }, 'ax-tab', { data: { tab: id } })));
  const dataPanel = el('section', { class: 'ax-data-panel' }, dataTabs, el('div', { class: 'ax-data-scroll' }, el('table', { class: 'ax-table ax-data-table' }, dataHead, dataBody)));
  const tradeBalance = el('span'), tradePosition = el('div', { class: 'ax-ticket-position' });
  const buyButton = button('Buy', () => { A.side = 'buy'; syncTicket(); }, 'ax-side is-buy is-active');
  const sellButton = button('Sell', () => { A.side = 'sell'; syncTicket(); }, 'ax-side is-sell');
  const orderTabs = el('div', { class: 'ax-order-tabs' }, ['market', 'limit', 'dca'].map((kind) => button(kind === 'dca' ? 'DCA' : kind.charAt(0).toUpperCase() + kind.slice(1), () => {
    A.orderType = kind; syncTicket();
  }, 'ax-order-tab', { data: { kind } })));
  const amount = el('input', { type: 'text', inputMode: 'decimal', value: A.quick, 'aria-label': `Buy amount (${U.name})`, class: 'ax-amount' });
  const amountLabel = el('span', {}, 'Amount');
  const amountUnit = el('span', {}, U.name);
  const presets = el('div', { class: 'ax-amount-presets' });
  const target = el('input', { type: 'number', min: 0, step: 'any', 'aria-label': 'Target market cap ($)' });
  const direction = el('select', { 'aria-label': 'Trigger direction' }, el('option', { value: 'below' }, 'At or below'), el('option', { value: 'above' }, 'At or above'));
  const limitFields = el('div', { class: 'ax-limit-fields', hidden: true }, field('Target market cap ($)', target), direction);
  const dcaCount = el('input', { type: 'number', value: 5, min: 2, max: 100, step: 1, 'aria-label': 'DCA order count' });
  const dcaInterval = el('input', { type: 'number', value: 30, min: 1, max: 3600, step: 1, 'aria-label': 'DCA interval (seconds)' });
  const dcaFields = el('div', { class: 'ax-limit-fields', hidden: true }, field('Orders', dcaCount), field('Interval (seconds)', dcaInterval));
  const submit = el('button', { class: 'ax-submit is-buy', type: 'submit' }, 'Buy');
  const orderNote = el('p', { class: 'ax-order-note' });
  const tradeSettings = button('', () => ctx.openSettings(), 'ax-trade-settings');
  const ticket = el('form', { class: 'ax-ticket', on: { submit: submitOrder } },
    el('div', { class: 'ax-side-tabs' }, buyButton, sellButton), orderTabs,
    el('div', { class: 'ax-balance-line' }, amountLabel, tradeBalance),
    el('label', { class: 'ax-amount-wrap' }, amount, amountUnit), presets, limitFields, dcaFields,
    tradeSettings, submit, orderNote, tradePosition);
  function syncTicket() {
    const buying = A.side === 'buy';
    flag(buyButton, 'is-active', buying); flag(sellButton, 'is-active', !buying);
    buyButton.setAttribute('aria-pressed', String(buying)); sellButton.setAttribute('aria-pressed', String(!buying));
    flag(submit, 'is-buy', buying); flag(submit, 'is-sell', !buying);
    amount.setAttribute('aria-label', buying ? `Buy amount (${U.name})` : 'Sell percentage');
    amount.value = buying ? A.quick : '100'; setText(amountUnit, buying ? U.name : '%');
    setText(amountLabel, A.orderType === 'dca' ? (buying ? 'Amount per order' : '% of remaining per order') : 'Amount');
    presets.replaceChildren(...(buying ? buyPresets(ctx.start).map((x) => nice(x * U.per)) : [10, 25, 50, 100]).map((v) =>
      button(buying ? String(v) : `${v}%`, () => { amount.value = String(v); }, 'ax-amount-preset')));
    limitFields.hidden = A.orderType !== 'limit'; dcaFields.hidden = A.orderType !== 'dca';
    [...orderTabs.children].forEach((b) => { flag(b, 'is-active', b.dataset.kind === A.orderType); b.setAttribute('aria-pressed', String(b.dataset.kind === A.orderType)); });
    setText(orderNote, A.orderType === 'market' ? 'Play money · fills use simulated liquidity and your slippage.'
      : 'Triggers run while this session is open. Orders use market execution when triggered.');
    if (A.coin !== null) paintCoin();
  }
  function submitOrder(e) {
    e.preventDefault(); if (A.coin === null) return;
    const value = parseAmount(amount.value);
    if (!(value > 0) || (A.side === 'sell' && value > 100)) return toast(A.side === 'sell' ? 'Enter a sell percentage between 0 and 100.' : 'Enter a positive buy amount.', 'down');
    const params = A.side === 'buy' ? { coin: A.coin, side: 'buy', sol: value / U.per } : { coin: A.coin, side: 'sell', frac: value / 100 };
    if (A.orderType === 'market') { send(params); return; }
    const row = market.row(A.coin);
    if (A.orderType === 'limit') {
      const cap = Number(target.value);
      if (!(cap > 0) || !finite(cap)) return toast('Enter a positive target market cap.', 'down');
      A.limits.push({ ...params, id: ++A.limitSeq, kind: 'limit', target: cap / px, direction: direction.value });
    } else {
      const count = Number(dcaCount.value), interval = Number(dcaInterval.value);
      if (!Number.isInteger(count) || count < 2 || count > 100 || !Number.isInteger(interval) || interval < 1 || interval > 3600) return toast('Use 2–100 orders and an interval of 1–3600 seconds.', 'down');
      A.limits.push({ ...params, id: ++A.limitSeq, kind: 'dca', remaining: count, interval, nextAt: market.t });
    }
    toast(`${A.orderType === 'dca' ? 'DCA schedule' : 'Limit order'} created for ${row?.ticker || 'token'}.`, 'up');
    A.dataTab = 'orders'; renderData();
  }
  const tokenInfo = el('section', { class: 'ax-token-info' });
  const coinView = el('section', { class: 'ax-coin', hidden: true }, coinTitle,
    el('div', { class: 'ax-trade-layout' }, el('div', { class: 'ax-chart-column' }, chartTools, chartLabel, el('div', { class: 'ax-chart-stage' }, drawRail, chartHost), chartBottom, chartCredit(), dataPanel),
      el('aside', { class: 'ax-trade-sidebar' }, ticket, tokenInfo)));
  function paintCoin() {
    if (A.coin === null) return;
    const r = market.row(A.coin), s = market.stats(A.coin); if (!r || !s) return;
    setText(coinName, r.ticker); setText(coinFullName, r.name);
    if (!samePic(coinPic.firstChild, r)) coinPic.replaceChildren(pic(r, '', 'ax'));
    flag(coinStar, 'is-starred', A.watch.has(r.id)); coinStar.setAttribute('aria-pressed', String(A.watch.has(r.id)));
    updateStats(coinStats, [['Market Cap', MC(r.mc)], ['Liquidity', usd(s.liqUsd)],
      ['5m Volume', MC(s.vol5m)], ['5m Change', pct(s.change5m), s.change5m >= 0 ? 'is-up' : 'is-down']]);
    setText(chartLabel, `${r.ticker} / ${U.name} · ${A.chartMode === 'mcap' ? 'Market Cap' : 'Price'} · ${r.live ? 'Real coin · play money' : 'Simulated market'}`);
    syncChartTools();
    A.chart?.set({ candles: candleReader.read(r.id, s.cdv), solUsd: px, tf: A.tf, base, migratedAt: s.migratedAt,
      marks: market.orders(120).filter((o) => o.coin === r.id && o.status === 'filled').map((o) => ({ t: o.doneAt, side: o.side })) });
    setText(tradeBalance, `Balance: ${M(market.player.sol)}`);
    setText(submit, `${A.orderType === 'market' ? A.side === 'buy' ? 'Buy' : 'Sell' : A.orderType === 'limit' ? 'Create Limit' : 'Start DCA'} ${r.ticker}`);
    submit.disabled = r.phase === 'migrating' || (r.live && r.tracked === false);
    const settings = ctx.settings(); setText(tradeSettings, `Slippage ${share(settings.slippage, 0)}   ·   ${settings.priority} priority   ⚙`);
    const p = market.positions().find((p) => p.id === r.id);
    updateStats(tradePosition, [['Bought', M(p?.invested || 0)], ['Sold', M(p?.sold || 0)],
      ['Holding', M(p?.value || 0)], ['PnL', MS(p?.total || 0), p?.total < 0 ? 'is-down' : 'is-up']]);
    const info = market.info(r.id);
    tokenInfo.replaceChildren(...[el('h3', {}, 'Token Info'), el('div', { class: 'ax-info-stats' },
      statBlock('Holders', num(r.holders)), statBlock('Top 10', share(r.top10)), statBlock('Dev holding', share(r.dev)),
      statBlock('Snipers', share(r.snipers)), statBlock('Insiders', share(r.insiders)), statBlock('Bundled', share(r.bundlers))),
      el('div', { class: 'ax-curve-label' }, el('span', {}, r.phase === 'pool' ? 'Migrated' : 'Bonding curve'), el('b', {}, share(r.progress))),
      el('div', { class: 'ax-curve-bar' }, el('i', { vars: { width: `${Math.max(0, Math.min(100, r.progress * 100))}%` } })),
      el('p', { class: 'ax-muted' }, `Created ${age(r.age)} ago · ${info?.mint?.slice(0, 6) || 'Practice token'}…`),
      r.live ? el('p', { class: 'ax-muted' }, 'Holder distribution is unavailable from this feed.') : null].filter(Boolean));
  }
  function renderData() {
    if (A.coin === null) return;
    [...dataTabs.children].forEach((b) => flag(b, 'is-active', b.dataset.tab === A.dataTab));
    const r = market.row(A.coin), setHead = (labels) => dataHead.replaceChildren(el('tr', {}, labels.map((x) => el('th', {}, x))));
    const setRows = (rows, labels) => {
      setHead(labels); dataBody.replaceChildren(...rows.map((values) => el('tr', {}, values.map((v) => el('td', {}, v)))));
      if (!rows.length) dataBody.append(el('tr', {}, el('td', { colSpan: labels.length }, empty('No data yet.'))));
    };
    if (A.dataTab === 'trades') {
      const rows = (market.trades(A.coin, 60) || []).map((t) => [age(market.t - t.t), el('span', { class: t.side === 'buy' ? 'is-up' : 'is-down' }, t.side.toUpperCase()),
        M(t.sol), tokens(t.tok), MC(t.mc), t.me ? 'You' : t.addr ? short(t.addr) : 'Trader']);
      setRows(rows, ['Age', 'Type', U.name, 'Amount', 'Market Cap', 'Trader']);
    } else if (A.dataTab === 'holders' || A.dataTab === 'traders') {
      if (r.live) { setRows([], ['Wallet', 'Holding', 'Supply', 'Bought', 'Sold']); dataBody.replaceChildren(el('tr', {}, el('td', { colSpan: 5 }, empty('This live feed does not provide wallet identities or holder distribution.')))); return; }
      const holders = market.holders(A.coin, 100)?.list || [];
      if (A.dataTab === 'traders') holders.sort((a, b) => b.out - b.in - (a.out - a.in));
      setRows(holders.map((h) => [h.me ? 'You' : short(h.addr), tokens(h.tok), share(h.pct), M(h.in), M(h.out)]), ['Wallet', 'Holding', 'Supply', 'Bought', 'Sold']);
    } else if (A.dataTab === 'early') {
      const first = market.firstBuyers?.(A.coin);
      setRows((first?.list || []).map((p) => [p.n, p.me ? 'You' : short(p.addr), tokens(p.tok0), tokens(p.tok), p.status]), ['#', 'Wallet', 'Initial amount', 'Holding', 'Status']);
      if (!first) dataBody.replaceChildren(el('tr', {}, el('td', { colSpan: 5 }, empty('Early-buyer identities are unavailable for this live token.'))));
    } else if (A.dataTab === 'dev') {
      const info = market.info(A.coin), lists = market.lists({ limit: 100 });
      if (r.live || !info?.devAddr) { setRows([], ['Token', 'Market Cap', 'Age', 'Status']); dataBody.replaceChildren(el('tr', {}, el('td', { colSpan: 4 }, empty('Developer history is unavailable for this token.')))); return; }
      const known = [...new Map([...lists.new, ...lists.stretch, ...lists.migrated].map((r) => [r.id, r])).values()];
      setRows(known.filter((r) => market.info(r.id)?.devAddr === info.devAddr).map((r) => [button(r.ticker, () => openCoin(r.id), 'ax-token-link'), MC(r.mc), age(r.age), r.phase === 'pool' ? 'Migrated' : 'Bonding']), ['Token', 'Market Cap', 'Age', 'Status']);
    } else if (A.dataTab === 'positions') {
      const p = market.positions().find((p) => p.id === A.coin);
      setRows(p ? [[M(p.invested), M(p.sold), M(p.value), MS(p.total), pct(p.pnlPct), p.open ? button('Sell 100%', () => send({ coin: p.id, side: 'sell', frac: 1 }), 'ax-sell-small') : 'Closed']] : [],
        ['Bought', 'Sold', 'Holding', 'PnL', 'Return', 'Action']);
    } else {
      setRows(A.limits.filter((o) => o.coin === A.coin).map((o) => [o.kind.toUpperCase(), o.side.toUpperCase(), o.kind === 'dca' ? `${o.remaining} orders left` : `${o.direction === 'above' ? '≥' : '≤'} ${MC(o.target)}`,
        o.side === 'buy' ? M(o.sol) : share(o.frac), button('Cancel', () => cancelOrder(o.id), 'ax-button')]), ['Type', 'Side', 'Trigger', 'Amount', 'Action']);
    }
  }
  function openCoin(id) {
    if (!Number.isInteger(id) || !market.row(id)) return;
    if (A.coin === null) ctx.pushSub();
    A.coin = id; A.dataTab = 'trades'; A.side = 'buy';
    ctx.onCoin?.(id); searchResults.hidden = true;
    A.chart?.destroy(); A.chart = null; chartHost.replaceChildren();
    syncViews();
    A.chart = createPhomoChart(chartHost, { tf: A.tf, mode: A.chartMode,
      colors: { bg: '#101114', border: '#26272f', up: '#22cbaa', down: '#f34f67', axis: '#8c8f9e', grid: 'rgba(255,255,255,0.035)' }, indicators: A.indicators,
      onChange: (state) => {
        drawButtons.forEach((b) => b.setAttribute('aria-pressed', String(state.tool === b.dataset.tool)));
        undo.disabled = !state.canUndo; redo.disabled = !state.canRedo;
        log.setAttribute('aria-pressed', String(state.scale === 'log')); percent.setAttribute('aria-pressed', String(state.scale === 'percent'));
      } });
    A.chart.view({ unit: A.chartUnit, per: U.per }); chartStyle.value = 'candles';
    const r = market.row(id); target.value = String(Math.round(r.mc * px * .9)); direction.value = 'below';
    syncTicket(); paintCoin(); renderData();
  }
  function closeCoin(fromPop = false) {
    if (A.coin === null) return;
    A.coin = null; A.chart?.destroy(); A.chart = null; chartHost.replaceChildren(); ctx.onCoin?.(null);
    if (!fromPop) ctx.popSub(); syncViews(); renderLists(true);
  }
  function setView(id) {
    if (!NAV.some(([name]) => name === id)) return;
    if (A.coin !== null) closeCoin(false);
    A.view = id; syncViews(); renderLists(true);
    if (id === 'portfolio') renderPortfolio(); if (id === 'trackers') renderTrackers();
    if (id === 'perpetuals') loadPerps();
  }
  function syncViews() {
    root.dataset.view = A.coin !== null ? 'coin' : A.view;
    nav.forEach((b, i) => { flag(b, 'is-active', NAV[i][0] === A.view); b.setAttribute('aria-pressed', String(NAV[i][0] === A.view)); });
    pulseView.hidden = A.coin !== null || A.view !== 'pulse'; discoverView.hidden = A.coin !== null || A.view !== 'discover';
    portfolioView.hidden = A.coin !== null || A.view !== 'portfolio'; trackersView.hidden = A.coin !== null || A.view !== 'trackers';
    perpsView.hidden = A.coin !== null || A.view !== 'perpetuals';
    A.perps?.setActive(!perpsView.hidden);
    coinView.hidden = A.coin === null; pageHead.hidden = A.coin !== null;
    setText(title, NAV.find(([id]) => id === A.view)?.[1] || 'Pulse');
    pulseTools.hidden = !['pulse', 'discover'].includes(A.view);
  }
  const foot = el('footer', { class: 'ax-footer' }, el('span', { class: 'ax-connection' }, el('i'), ctx.chain ? 'Live feed · practice execution' : 'Simulation running'),
    button([icon('bag'), 'Positions'], () => { A.portfolioTab = 'positions'; setView('portfolio'); }, 'ax-footer-button'),
    button([icon('clock'), 'Orders'], () => { A.portfolioTab = 'orders'; setView('portfolio'); }, 'ax-footer-button'),
    el('span', { class: 'ax-footer-note' }, 'Play money only · Not affiliated with any real terminal'));
  const root = el('div', { class: 'ax', data: { terminal: 'axium' } }, head, watch, pageHead, pulseView, discoverView, trackersView, perpsView, portfolioView, coinView, foot, dialog);
  host.append(root);
  const onKey = (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/i.test(e.target?.tagName || '');
    if (e.key === '/' && !typing) { e.preventDefault(); searchIn.focus(); }
    if (e.key === 'Escape') { searchResults.hidden = true; if (dialog.open) dialog.close(); }
  };
  document.addEventListener?.('keydown', onKey);
  syncViews(); syncColumns(); syncPreset(); renderWatch(); renderLists(true);
  setText(balance, money(market.player.sol, cur, px, { unit: false }));
  return { el: root, openCoin, sub: () => A.coin !== null, closeSub: () => closeCoin(true),
    update(now) {
      if (A.dead) return;
      if (A.coin === null && A.view === 'perpetuals') A.perps?.update(now);
      if (now - A.fastAt >= 250) { A.fastAt = now; checkTriggers(); setText(balance, money(market.player.sol, cur, px, { unit: false })); if (A.coin !== null) paintCoin(); }
      if (now - A.slowAt >= 800) {
        A.slowAt = now; A.stats.clear(); renderWatch(); syncPreset();
        if (A.coin !== null) renderData(); else if (A.view === 'portfolio') renderPortfolio(); else if (A.view === 'trackers') renderTrackers(); else renderLists();
      }
    },
    destroy() { A.dead = true; A.limits = []; candleReader.clear(); A.chart?.destroy(); A.perps?.destroy(); ctx.onCoin?.(null); document.removeEventListener?.('keydown', onKey); if (dialog.open) dialog.close(); root.remove(); },
  };
}
