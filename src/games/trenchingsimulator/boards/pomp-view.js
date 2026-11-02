import { el, icon, keyed, setText, flag } from '../ui.js';
import { usd, pct, age } from '../format.js';
import { pic, samePic, short, waitingForRealCoins } from './common.js';
import { POMP_TABS, pompRows, pompRange, pompCallouts } from './pomp-data.js';

const button = (label, fn, cls = '') => el('button', { type: 'button', class: cls, on: { click: fn } }, label);
const empty = text => el('p', { class: 'pomp-empty' }, text);
const count = n => Number.isFinite(n) ? n.toLocaleString('en-US') : '—';

export function createPompWorkspace({ market, ctx, openCoin, openBag, closeCoin, searchForm, walletBtn, brand }) {
  const S = { view: 'feed', tab: 'movers', layout: 'table', mobile: 'calls', query: '', watch: new Set(), filters: {},
    paused: false, coin: null, recent: [], dead: false, rank: 'profit', panels: { trending: true, calls: true, leaders: true } };
  const px = ctx.solUsd;
  const cap = n => Number.isFinite(n) ? usd(n * px) : '—';
  const railButtons = new Map();
  const rail = el('nav', { class: 'pomp-rail', 'aria-label': 'Pomp navigation' }, brand);
  function railItem(name, glyph, fn) {
    const b = button([icon(glyph), el('span', { class: 'tsb-sr' }, name)], fn, 'pomp-rail-btn');
    b.setAttribute('title', name); b.setAttribute('aria-label', name); railButtons.set(name, b); rail.append(b); return b;
  }
  const avatar = el('span', { class: 'pomp-avatar' }, 'P');
  railItem('Your portfolio', 'bag', openBag);
  railItem('Feed', 'flame', () => navigate('feed'));
  railItem('Explore', 'search', () => navigate('explore'));
  railItem('Leaderboard', 'trophy', () => { S.mobile = 'leaders'; navigate('feed'); });
  rail.append(el('hr'));
  railItem('Watchlist', 'star', () => { S.tab = 'watch'; navigate('explore'); });
  railItem('Orders and positions', 'arrows', openBag);
  railItem('Create a coin', 'bolt', () => showLaunch());
  const settingsButton = railItem('Terminal settings', 'sliders', showSettings);
  settingsButton.classList.add('pomp-rail-bottom');
  const promo = el('div', { class: 'pomp-promo' }, 'Pomp.fun · Trade with play money.', button('×', () => { promo.hidden = true; }, 'pomp-promo-close'));
  const header = el('div', { class: 'pomp-header' }, searchForm,
    button('Portfolio', openBag, 'pomp-deposit'), walletBtn, avatar);
  const watchStrip = el('div', { class: 'pomp-watchstrip' });
  const watchItems = el('div', { class: 'pomp-watch-items' });
  watchStrip.append(button(icon('sliders'), showSettings, 'pomp-icon-btn'),
    button(icon('star'), () => { S.tab = 'watch'; navigate('explore'); }, 'pomp-icon-btn'),
    button(icon('bag'), openBag, 'pomp-icon-btn'), watchItems);
  for (const [b, label] of [[watchStrip.children[0], 'Feed settings'], [watchStrip.children[1], 'Open watchlist'], [watchStrip.children[2], 'Open positions']]) b.setAttribute('aria-label', label);

  function panel(title, glyph, key, content, controls) {
    const hide = button('×', () => { S.panels[key] = false; applyPanels(); }, 'pomp-icon-btn');
    hide.setAttribute('aria-label', `Hide ${title}`);
    const settings = button(icon('sliders'), () => showSettings(), 'pomp-panel-settings');
    settings.setAttribute('aria-label', `${title} settings`);
    return el('section', { class: `pomp-panel pomp-${key}` },
      el('header', { class: 'pomp-panel-head' }, el('span', { class: 'pomp-grip', 'aria-hidden': true }, '⠿'), icon(glyph),
        el('h2', {}, title), settings, hide), controls, content);
  }
  const trendList = el('div', { class: 'pomp-trend-list' });
  const callList = el('div', { class: 'pomp-call-list' });
  const leaderList = el('div', { class: 'pomp-leader-list' });
  const trendSort = el('select', { 'aria-label': 'Trending coin order', on: { change: () => update() } },
    el('option', { value: 'movers' }, 'Trending'), el('option', { value: 'new' }, 'New'), el('option', { value: 'cap' }, 'Market cap'));
  const pause = button('Pause', () => { S.paused = !S.paused; setText(pause, S.paused ? 'Resume' : 'Pause'); pause.setAttribute('aria-pressed', String(S.paused)); update(); }, 'pomp-pause');
  pause.setAttribute('aria-pressed', 'false');
  const trendControls = el('div', { class: 'pomp-panel-controls' }, el('span', { class: 'pomp-segment is-active' }, 'Coins'), trendSort, pause);
  const rank = el('select', { 'aria-label': 'Leaderboard order', on: { change: () => { S.rank = rank.value; update(); } } },
    el('option', { value: 'profit' }, 'Profit'), el('option', { value: 'value' }, 'Holdings'), el('option', { value: 'buys' }, 'Buys'));
  const leaderControls = el('div', { class: 'pomp-panel-controls' }, el('span', { class: 'pomp-segment is-active' }, 'Traders'),
    el('span', { class: 'pomp-muted' }, 'Simulated'), rank);
  const panels = { trending: panel('Trending', 'flame', 'trending', trendList, trendControls),
    calls: panel('Hot callouts', 'users', 'calls', callList), leaders: panel('Leaderboard', 'trophy', 'leaders', leaderList, leaderControls) };
  const feed = el('div', { class: 'pomp-feed' }, Object.values(panels));
  const mobileTabs = el('div', { class: 'pomp-mobile-tabs' }, [['calls', 'Callouts'], ['trending', 'Coins'], ['leaders', 'Top']].map(([id, label]) =>
    button(label, () => { S.mobile = id; applyPanels(); }, 'pomp-mobile-tab')));
  mobileTabs.children[0].dataset.panel = 'calls'; mobileTabs.children[1].dataset.panel = 'trending'; mobileTabs.children[2].dataset.panel = 'leaders';
  const exploreTitle = el('h1', {}, 'Explore coins');
  const tabButtons = POMP_TABS.map(([id, label]) => { const b = button(label, () => { S.tab = id; update(); }, 'pomp-explore-tab'); b.dataset.tab = id; return b; });
  const filterButton = button([icon('sliders'), 'Filter'], () => filterDialog.showModal(), 'pomp-control');
  const layoutButtons = ['grid', 'table'].map(layout => { const b = button(layout === 'grid' ? '▦' : '☰', () => { S.layout = layout; update(); }, 'pomp-layout'); b.setAttribute('aria-label', `${layout} view`); b.dataset.layout = layout; return b; });
  const tableBody = el('tbody');
  const table = el('table', { class: 'pomp-coin-table' }, el('thead', {}, el('tr', {},
    ['Coin', 'Graph', 'Mcap', 'ATH', 'Age', 'Trades', 'Volume', 'Holders', '5m', ''].map(s => el('th', { scope: 'col' }, s)))), tableBody);
  const cards = el('div', { class: 'pomp-cards' });
  const resultNote = el('p', { class: 'pomp-results', role: 'status' });
  const explore = el('section', { class: 'pomp-explore', hidden: true }, exploreTitle,
    el('div', { class: 'pomp-explore-controls' }, el('div', { class: 'pomp-explore-tabs', role: 'group', 'aria-label': 'Coin lists' }, tabButtons),
      el('div', { class: 'pomp-explore-options' }, filterButton, ...layoutButtons)), resultNote,
    el('div', { class: 'pomp-table-scroll' }, table), cards);
  const content = el('div', { class: 'pomp-workspace', data: { mobile: S.mobile } }, mobileTabs, feed, explore);
  const foot = el('footer', { class: 'pomp-footer' }, el('span', {}, '© Pomp.fun · Simulator'),
    el('span', {}, market.live ? 'Real coins · simulated prices/volume' : 'Simulated market · play money'));
  const mobileNav = el('nav', { class: 'pomp-mobile-nav', 'aria-label': 'Mobile terminal navigation' },
    [['Feed', 'flame', () => navigate('feed')], ['Explore', 'search', () => navigate('explore')], ['Create', 'bolt', showLaunch],
      ['Portfolio', 'bag', openBag], ['Settings', 'sliders', showSettings]].map(([name, glyph, fn]) => {
      const b = button(icon(glyph), fn); b.setAttribute('aria-label', name); return b;
    }));

  function makeRow(r, mode = 'table') {
    const n = el(mode === 'table' ? 'tr' : 'div', { class: `pomp-coin-row is-${mode}` });
    const open = button([], () => openCoin(r.id), 'pomp-coin-open');
    const image = pic(r, 'pomp-token');
    const name = el('b'), full = el('span'), mc = el('b'), change = el('span'), spark = el('span', { class: 'pomp-spark', 'aria-hidden': true });
    const star = button('☆', () => { if (S.watch.has(r.id)) S.watch.delete(r.id); else S.watch.add(r.id); update(); }, 'pomp-star');
    open.append(image, el('span', { class: 'pomp-coin-name' }, name, full));
    const cells = [open, spark, mc, el('span'), el('span'), el('span'), el('span'), el('span'), change, star];
    n.$ = { open, image, name, full, mc, change, spark, star, cells, sparkAt: -Infinity };
    if (mode === 'table') n.append(...cells.map(c => el('td', {}, c)));
    else n.append(open, el('div', { class: 'pomp-card-numbers' }, mc, change), spark, star);
    return n;
  }
  function updateRow(n, r) {
    const q = n.$;
    if (!samePic(q.image, r)) { const image = pic(r, 'pomp-token'); q.image.replaceWith(image); q.image = image; }
    setText(q.name, r.ticker); setText(q.full, r.name); setText(q.mc, cap(r.mc));
    setText(q.change, pct(r.ch5m)); flag(q.change, 'is-up', r.ch5m >= 0); flag(q.change, 'is-down', r.ch5m < 0);
    q.open.setAttribute('aria-label', `Open ${r.name}, ${r.ticker}`);
    setText(q.star, S.watch.has(r.id) ? '★' : '☆'); q.star.setAttribute('aria-pressed', String(S.watch.has(r.id)));
    q.star.setAttribute('aria-label', `${S.watch.has(r.id) ? 'Remove' : 'Add'} ${r.ticker} ${S.watch.has(r.id) ? 'from' : 'to'} watchlist`);
    setText(q.cells[4], age(r.age)); setText(q.cells[5], count(r.txns));
    setText(q.cells[6], cap(r.vol)); setText(q.cells[7], count(r.holders));
    // A bounded SVG preview, at most once every five simulated seconds; no layout reads or animation restart.
    if (market.t - q.sparkAt >= 5 || market.t < q.sparkAt) {
      q.sparkAt = market.t;
      if (n.classList.contains('is-table')) setText(q.cells[3], cap(market.stats(r.id)?.ath));
      if (n.classList.contains('is-trend')) return;
      const cs = (market.candles(r.id, market.t - 900) || []).slice(-20), vs = cs.map(c => c.c);
      if (vs.length > 1) {
        const lo = Math.min(...vs), hi = Math.max(...vs), range = hi - lo || 1;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 90 28');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        path.setAttribute('points', vs.map((v, i) => `${i * 90 / (vs.length - 1)},${26 - (v - lo) / range * 24}`).join(' '));
        path.setAttribute('fill', 'none'); path.setAttribute('stroke', vs.at(-1) >= vs[0] ? '#86efac' : '#f87171'); path.setAttribute('stroke-width', '1.4'); svg.append(path); q.spark.replaceChildren(svg);
      } else setText(q.spark, '—');
    }
  }
  function updateCalls(host, coinId = null) {
    const rows = pompCallouts(market).filter(e => coinId === null || e.c === coinId);
    if (rows.length && host.firstChild?.classList.contains('pomp-empty')) host.replaceChildren();
    keyed(host, rows, e => e.q, e => {
      const author = e.kol ? `@${e.kol}` : Number.isInteger(e.smart) ? `Trader ${e.smart + 1}` : e.kind === 'launch' ? 'Launchpad' : 'Market activity';
      const text = e.kind === 'launch' ? 'A new coin has launched.' : e.kind === 'migrated' ? 'Graduated from the bonding curve.'
        : e.kind === 'koth' ? 'Taking the top spot on the board.' : `Bought ${cap(e.sol)} of ${e.coin.ticker}.`;
      const time = el('span', { class: 'pomp-muted' });
      const card = el('article', { class: 'pomp-call' }, el('div', { class: 'pomp-call-author' }, el('span', { class: 'pomp-avatar' }, author.slice(0, 1)), el('b', {}, author), time),
        el('p', {}, text), button([pic(e.coin, 'pomp-token'), el('span', {}, el('b', {}, e.coin.ticker), el('small', {}, e.coin.name)), el('b', {}, cap(e.coin.mc))], () => openCoin(e.c), 'pomp-call-coin'),
        el('div', { class: 'pomp-call-footer' }, 'Simulated activity · play money'));
      card.$ = { time }; return card;
    }, (n, e) => setText(n.$.time, age(market.t - e.t)));
    if (!rows.length) host.replaceChildren(empty(market.live ? 'Public callouts are not included in this market feed.' : 'Callouts and market activity will appear here as the market moves.'));
  }
  const coinCalls = el('aside', { class: 'pomp-coin-calls' }, el('h3', {}, icon('users'), 'Hot callouts'), el('div', { class: 'pomp-coin-call-list' }));
  function applyPanels() {
    let shown = 0;
    for (const [key, node] of Object.entries(panels)) { node.hidden = !S.panels[key]; if (!node.hidden) shown++; }
    feed.style.setProperty('--pomp-panels', String(Math.max(1, shown))); content.dataset.mobile = S.mobile;
    for (const b of mobileTabs.children) b.setAttribute('aria-pressed', String(b.dataset.panel === S.mobile));
  }
  function navigate(view) { closeCoin(); S.view = view; update(); }
  function update() {
    if (S.dead) return;
    feed.hidden = S.view !== 'feed'; explore.hidden = S.view !== 'explore'; mobileTabs.hidden = S.view !== 'feed';
    for (const [name, b] of railButtons) b.setAttribute('aria-pressed', String((name === 'Feed' && S.view === 'feed') || (name === 'Explore' && S.view === 'explore')));
    applyPanels();
    const watched = [...S.watch].map(id => market.row(id)).filter(Boolean).slice(0, 12);
    if (watched.length && watchItems.firstChild?.classList.contains('pomp-muted')) watchItems.replaceChildren();
    keyed(watchItems, watched, r => r.id, r => { const b = button([], () => openCoin(r.id), 'pomp-watch-coin'); b.$ = { name: el('b'), value: el('span') }; b.append(b.$.name, b.$.value); return b; },
      (b, r) => { setText(b.$.name, r.ticker); setText(b.$.value, pct(r.ch5m)); flag(b.$.value, 'is-up', r.ch5m >= 0); flag(b.$.value, 'is-down', r.ch5m < 0); });
    if (!watched.length) watchItems.replaceChildren(el('span', { class: 'pomp-muted' }, 'Nothing on your watchlist yet. Star a coin to follow it here.'));
    if (S.coin !== null) { updateCalls(coinCalls.lastChild); return; }
    if (S.view === 'explore') {
      const rows = pompRows(market, { tab: S.tab, query: S.query, watch: S.watch, per: px, ...S.filters });
      for (const b of tabButtons) b.setAttribute('aria-pressed', String(b.dataset.tab === S.tab));
      for (const b of layoutButtons) b.setAttribute('aria-pressed', String(b.dataset.layout === S.layout));
      table.parentNode.hidden = S.layout !== 'table'; cards.hidden = S.layout !== 'grid';
      keyed(S.layout === 'table' ? tableBody : cards, rows, r => r.id, r => makeRow(r, S.layout), updateRow);
      setText(resultNote, rows.length ? S.query ? `${rows.length} coins matching “${S.query}”` : '' : waitingForRealCoins(market) ? 'Waiting for real coin listings…' : S.tab === 'watch' ? 'Star a coin to add it to your watchlist.' : 'No coins match these filters.');
    } else if (!S.paused) {
      const rows = pompRows(market, { tab: trendSort.value || 'movers', limit: 30, per: px });
      if (S.panels.trending) keyed(trendList, rows, r => r.id, r => makeRow(r, 'trend'), updateRow);
      if (S.panels.calls) updateCalls(callList);
      if (S.panels.leaders) {
        const leaders = market.live ? [] : (market.smartWallets?.() || []).slice().sort((a, b) => (S.rank === 'profit' ? b.pnl + b.upnl - a.pnl - a.upnl : (b[S.rank] || 0) - (a[S.rank] || 0))).slice(0, 20);
        if (leaders.length && leaderList.firstChild?.classList.contains('pomp-empty')) leaderList.replaceChildren();
        keyed(leaderList, leaders, r => r.n, r => { const name = el('b'), value = el('b'), position = el('span'); const n = el('div', { class: 'pomp-leader' }, position, el('span', { class: 'pomp-avatar' }, String(r.n + 1)), name, value); n.$ = { name, value, position }; return n; },
          (n, r) => { setText(n.$.name, `Trader ${r.n + 1}`); setText(n.$.position, leaders.indexOf(r) + 1); const value = S.rank === 'profit' ? r.pnl + r.upnl : r[S.rank]; setText(n.$.value, S.rank === 'buys' ? count(value) : cap(value)); flag(n.$.value, 'is-up', value >= 0); flag(n.$.value, 'is-down', value < 0); });
        if (!leaders.length) leaderList.replaceChildren(empty('Live trader rankings are not included in this market feed.'));
      }
    }
  }
  function dialog(title, children) {
    const d = el('dialog', { class: 'pomp-dialog' }, el('header', {}, el('h2', {}, title), button('×', () => d.close(), 'pomp-icon-btn')), children);
    d.addEventListener('click', e => { if (e.target === d) d.close(); }); return d;
  }
  const filterError = el('p', { role: 'alert', class: 'pomp-error' });
  const filterInputs = ['Minimum market cap', 'Maximum market cap', 'Minimum volume', 'Maximum volume'].map(name => el('input', { type: 'text', inputMode: 'decimal', placeholder: 'e.g. 10k, 1m', 'aria-label': name }));
  const graduated = el('input', { type: 'checkbox' });
  const filterDialog = dialog('Filter coins', el('form', { on: { submit: e => {
    e.preventDefault(); const [minCap, maxCap, minVol, maxVol] = filterInputs.map((n, i) => pompRange(n.value, i % 2 ? Infinity : 0));
    if ([minCap, maxCap, minVol, maxVol].includes(null) || minCap > maxCap || minVol > maxVol) return setText(filterError, 'Enter valid minimum and maximum amounts.');
    S.filters = { minCap, maxCap, minVol, maxVol, graduated: graduated.checked }; filterDialog.close(); update();
  } } }, el('h3', {}, 'Market cap · USD'), el('div', { class: 'pomp-range' }, filterInputs.slice(0, 2)),
  el('h3', {}, 'Volume · USD'), el('div', { class: 'pomp-range' }, filterInputs.slice(2)),
  el('label', { class: 'pomp-checkbox' }, graduated, 'Graduated coins only'), filterError,
  el('div', { class: 'pomp-dialog-actions' }, button('Clear', () => { for (const n of filterInputs) n.value = ''; graduated.checked = false; S.filters = {}; setText(filterError, ''); update(); }), el('button', { type: 'submit', class: 'pomp-primary' }, 'Apply'))));
  const settings = dialog('Feed settings', el('div', {}, el('p', { class: 'pomp-muted' }, 'Choose the panels in your feed.'),
    Object.entries(panels).map(([key, node]) => { const input = el('input', { type: 'checkbox', checked: true, on: { change: () => { S.panels[key] = input.checked; applyPanels(); update(); } } }); return el('label', { class: 'pomp-checkbox' }, input, node.querySelector('h2').textContent); }),
    button('Trading settings', () => { settings.close(); ctx.openSettings(); }, 'pomp-control'),
    el('p', { class: 'pomp-muted' }, 'Trading, launches and portfolios use play money. Accounts, creator rewards, livestreams and private messages are not connected.')));
  function showSettings() {
    const boxes = settings.querySelectorAll('input');
    Object.keys(panels).forEach((key, i) => { if (boxes[i]) boxes[i].checked = S.panels[key]; });
    settings.showModal();
  }
  const launchName = el('input', { maxLength: 32, placeholder: 'Coin name', 'aria-label': 'Coin name', required: true });
  const launchTicker = el('input', { maxLength: 10, placeholder: 'Ticker', 'aria-label': 'Ticker', required: true, pattern: '[A-Za-z0-9]{1,10}' });
  const launchDescription = el('textarea', { maxLength: 240, placeholder: 'Description (optional)', 'aria-label': 'Description' });
  const launchError = el('p', { class: 'pomp-error', role: 'status' });
  const launchSubmit = el('button', { type: 'submit', class: 'pomp-primary' }, 'Create coin · play money');
  const launch = dialog('Create a coin', el('form', { class: 'pomp-launch-form', on: { submit: e => {
    e.preventDefault(); if (!ctx.launchCoin || market.live || ctx.run?.mode !== 'free') return;
    const result = ctx.launchCoin({ name: launchName.value.trim(), ticker: launchTicker.value.trim().toUpperCase(), line: launchDescription.value.trim(), emoji: '💊', pair: 'ETH' });
    if (!result?.ok) return setText(launchError, 'This coin could not be created. Check the name and ticker or the run limit.');
    launch.close(); openCoin(result.id);
  } } }, el('label', {}, 'Name', launchName), el('label', {}, 'Ticker', launchTicker), el('label', {}, 'Description', launchDescription),
    el('p', { class: 'pomp-muted' }, 'A practice coin for this run. Nothing is deployed to a blockchain.'), launchError, launchSubmit));
  function showLaunch() {
    launchSubmit.disabled = !ctx.launchCoin || market.live || ctx.run?.mode !== 'free' || ctx.run?.over;
    setText(launchError, launchSubmit.disabled ? 'Practice launches are available in simulated free play.' : ''); launch.showModal();
  }
  return { el: content, rail, promo, header, watchStrip, foot, mobileNav, coinCalls, dialogs: [filterDialog, settings, launch],
    update, state: S,
    search(query) { if (query !== S.query) { S.query = query; if (query) S.view = 'explore'; } update(); },
    coin(id) { S.coin = id; if (id !== null) S.recent = [id, ...S.recent.filter(x => x !== id)].slice(0, 20); update(); },
    focusCoin(id) { const n = [...(S.layout === 'grid' ? cards : tableBody).children].find(n => n.dataset.key === String(id)); n?.$?.open.focus(); },
    destroy() { S.dead = true; for (const d of [filterDialog, settings, launch]) if (d.open) d.close(); },
  };
}
