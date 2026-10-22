// Phomo's spot coin page. Dollars are converted only at the existing practice-order boundary.
// The chart and holdings use the engine's normalized token units; live unknowns stay unavailable.
import { el, setText, keyed, icon } from '../ui.js';
import { usd, usdFull, signed, pct, share, age, tokens, price } from '../format.js';
import { SUPPLY } from '../curve.js';
import { MIN_BUY } from '../engine.js';
import { parseAmount, pic, samePic, short, num, tone, ORDER_ERRORS, CHAIN_NAMES } from './common.js';
import { GTF, INDICATORS } from './gngm-data.js';
import { createGChart, chartCredit } from './gchart.js';
import { tokenMetrics } from './phomo-data.js';
import './phomo-coin.css';

const fin = (v) => typeof v === 'number' && Number.isFinite(v);
const knownPrice = (v) => fin(v) ? `$${price(v)}` : '—';
const button = (text, click, attrs = {}) => el('button', { type: 'button', class: 'tspc-button', ...attrs, on: { click } }, text);
const field = (label, value = '—') => {
  const dd = el('dd', {}, value);
  return { el: el('div', {}, el('dt', {}, label), dd), dd };
};

export function mountPhomoCoin(host, ctx, id, { state, onTrader = () => {}, onClose = () => {} } = {}) {
  const market = ctx.market;
  const px = ctx.solUsd > 0 ? ctx.solUsd : market.solUsd;
  const base = Date.now() - market.t * 1000;
  const C = { side: 'buy', tab: 'holders', tf: 1, mode: 'mcap', marks: true, thesis: true, following: false,
    indicators: [], dead: false, lastDraw: -Infinity, lastRows: -Infinity, candles: [], cdv: null, chartDirty: true };
  const prefs = () => state && state.prefs || {};
  const current = () => market.stats(id);
  const position = () => market.positions().find((p) => p.id === id) || null;
  const error = (code) => code === 'min_buy' ? `The smallest practice buy is ${usdFull(MIN_BUY * px)}.`
    : code === 'not_enough_sol' ? 'Not enough practice dollars, including fees.'
      : code === 'no_sol_for_fee' ? 'Keep some practice dollars available for fees.'
        : ORDER_ERRORS[code] || 'The practice order could not be placed.';

  const status = el('p', { class: 'tspc-status', role: 'status', 'aria-live': 'polite' });
  const picture = el('span', { class: 'tspc-picture' });
  const ticker = el('h2', { class: 'tspc-ticker', tabIndex: -1 });
  const fullName = el('span', { class: 'tspc-name' });
  const coinAge = el('span');
  const coinKind = el('span', { class: 'tspc-kind' });
  const contract = button('Contract', () => copyContract(), { class: 'tspc-contract' });
  const watch = button('☆ Watch', () => { state.toggleWatch(id); update(undefined, true); }, { 'aria-pressed': 'false' });
  const hide = button('Hide', () => { state.toggleHide(id); onClose(); });
  const statLabels = [['cap', 'Market cap'], ['price', 'Price'], ['change', '24h change'], ['volume', '24h volume'],
    ['liquidity', 'Liquidity'], ['holders', 'Holders'], ['top10', 'Top 10']];
  const stats = Object.fromEntries(statLabels.map(([key, label]) => [key, field(label)]));
  const header = el('header', { class: 'tspc-header' },
    el('div', { class: 'tspc-heading' }, button([icon('back'), 'Discover'], onClose, { class: 'tspc-back' }), picture,
      el('div', { class: 'tspc-identity' }, el('div', { class: 'tspc-title' }, ticker, fullName),
        el('div', { class: 'tspc-meta' }, coinAge, contract, coinKind)),
      el('div', { class: 'tspc-actions' }, watch, hide)),
    el('dl', { class: 'tspc-stat-grid' }, Object.values(stats).map((x) => x.el)));

  const tfButtons = GTF.map((t) => button(t.id, () => {
    C.tf = t.s;
    for (const b of tfButtons) b.setAttribute('aria-pressed', String(Number(b.dataset.tf) === C.tf));
    C.chartDirty = true;
    update(undefined, true);
  }, { data: { tf: t.s }, 'aria-pressed': String(t.s === C.tf) }));
  const modes = [['mcap', 'Market cap'], ['price', 'Price']].map(([mode, label]) => button(label, () => {
    C.mode = mode;
    for (const b of modes) b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
    chart.view({ mode, unit: 'usd' });
  }, { data: { mode }, 'aria-pressed': String(mode === C.mode) }));
  const indicatorButtons = INDICATORS.map(([key, label]) => button(label, () => {
    C.indicators = C.indicators.includes(key) ? C.indicators.filter((k) => k !== key) : [...C.indicators, key];
    for (const b of indicatorButtons) b.setAttribute('aria-pressed', String(C.indicators.includes(b.dataset.indicator)));
    chart.indicators(C.indicators);
  }, { data: { indicator: key }, 'aria-pressed': 'false' }));
  const indicators = el('details', { class: 'tspc-indicators' }, el('summary', {}, 'Indicators'),
    el('div', { class: 'tspc-indicator-menu' }, indicatorButtons));
  const legend = el('p', { class: 'tspc-legend', 'aria-hidden': 'true' });
  const plot = el('div', { class: 'tspc-plot', role: 'img', 'aria-label': 'Market cap candlestick chart in dollars' });
  const chartNote = el('p', { class: 'tspc-muted tspc-chart-note' });
  const minimum = el('input', { type: 'text', inputMode: 'decimal', value: '', placeholder: '0',
    'aria-label': 'Minimum swap size in dollars', class: 'tspc-minimum', on: { input: () => refreshRows() } });
  function check(label, key) {
    const input = el('input', { type: 'checkbox', checked: C[key], on: { change: () => {
      C[key] = input.checked;
      C.chartDirty = true;
      refreshRows();
    } } });
    return el('label', { class: 'tspc-check' }, input, label);
  }
  const noteStrip = el('div', { class: 'tspc-chart-theses', 'aria-label': 'Theses for this coin' });
  const chartSection = el('section', { class: 'tspc-chart-card', 'aria-label': 'Coin chart' },
    el('div', { class: 'tspc-chart-tools' }, el('div', { class: 'tspc-segments', role: 'group', 'aria-label': 'Candle interval' }, tfButtons),
      el('div', { class: 'tspc-segments', role: 'group', 'aria-label': 'Chart value' }, modes), indicators,
      button('−', () => chart.zoom(-1), { 'aria-label': 'Zoom out' }), button('+', () => chart.zoom(1), { 'aria-label': 'Zoom in' }),
      button('Reset', () => chart.fit())), legend, plot, chartCredit(),
    el('div', { class: 'tspc-overlays' }, el('span', { class: 'tspc-muted' }, 'Chart overlays'),
      check('My swaps', 'marks'), check('Thesis', 'thesis'), check('Following only', 'following'),
      el('label', { class: 'tspc-min-label' }, 'Min size $', minimum)), noteStrip, chartNote);

  const tableHead = el('thead');
  const tableBody = el('tbody');
  const table = el('table', { class: 'tspc-table' }, tableHead, tableBody);
  const rowsNote = el('p', { class: 'tspc-muted tspc-rows-note' });
  const thesisInput = el('textarea', { class: 'tspc-note-input', rows: 2, maxLength: 500, placeholder: 'What is your thesis?',
    'aria-label': 'Your thesis for this coin' });
  const thesisStatus = el('p', { class: 'tspc-muted', role: 'status' });
  const thesisList = el('div', { class: 'tspc-thesis-list' });
  const thesisPane = el('div', { class: 'tspc-thesis-pane', hidden: true },
    el('form', { class: 'tspc-thesis-form', on: { submit: (e) => {
      e.preventDefault();
      const text = thesisInput.value.trim();
      if (!text) { setText(thesisStatus, 'Write a thesis first.'); return; }
      const result = state.addNote({ text, coin: id });
      if (result === false || result && result.ok === false) { setText(thesisStatus, 'Your thesis could not be saved.'); return; }
      thesisInput.value = '';
      setText(thesisStatus, 'Saved on this device.');
      refreshRows();
    } } }, thesisInput, el('div', { class: 'tspc-note-actions' }, el('span', { class: 'tspc-muted' }, 'Local practice thesis · up to 500 characters'),
      el('button', { type: 'submit', class: 'tspc-button' }, 'Post thesis')), thesisStatus), thesisList);
  const tableWrap = el('div', { class: 'tspc-table-wrap', role: 'region', tabIndex: 0, 'aria-label': 'Coin holders and swaps' }, table);
  const tabs = [['holders', 'Holders'], ['swaps', 'Swaps'], ['thesis', 'Thesis']].map(([key, label]) => button(label, () => {
    C.tab = key;
    for (const b of tabs) b.setAttribute('aria-pressed', String(b.dataset.tab === key));
    refreshRows();
  }, { class: 'tspc-tab', data: { tab: key }, 'aria-pressed': String(C.tab === key) }));
  const details = el('section', { class: 'tspc-details' },
    el('div', { class: 'tspc-tabs', role: 'group', 'aria-label': 'Coin activity' }, tabs), rowsNote, tableWrap, thesisPane);

  const amount = el('input', { class: 'tspc-amount', type: 'text', inputMode: 'decimal', autocomplete: 'off', spellcheck: 'false',
    placeholder: '0', value: '100', 'aria-label': 'Buy amount in practice dollars', on: { input: () => { setText(status, ''); renderQuote(); } } });
  const amountUnit = el('span', {}, 'USD');
  const balance = el('p', { class: 'tspc-balance' });
  const presetRow = el('div', { class: 'tspc-presets' });
  const quoteText = el('p', { class: 'tspc-quote' });
  const quoteFees = el('p', { class: 'tspc-muted tspc-fees' });
  const pending = el('p', { class: 'tspc-muted tspc-pending', role: 'status' });
  const submit = el('button', { type: 'submit', class: 'tspc-submit' }, 'Buy');
  const sides = [['buy', 'Buy'], ['sell', 'Sell']].map(([side, label]) => button(label, () => {
    C.side = side;
    amount.value = side === 'buy' ? String((prefs().buyPresets || [10, 100, 500, 1000])[1]) : '100';
    amount.setAttribute('aria-label', side === 'buy' ? 'Buy amount in practice dollars' : 'Percentage of your holding to sell');
    setText(amountUnit, side === 'buy' ? 'USD' : '%');
    setText(status, '');
    for (const b of sides) b.setAttribute('aria-pressed', String(b.dataset.side === side));
    orderCard.dataset.side = side;
    renderPresets();
    renderQuote();
  }, { class: 'tspc-side', data: { side }, 'aria-pressed': String(C.side === side) }));
  const orderCard = el('section', { class: 'tspc-order-card', data: { side: C.side }, 'aria-label': 'Practice trade' },
    el('div', { class: 'tspc-trade-top' }, el('div', { class: 'tspc-sides', role: 'group', 'aria-label': 'Buy or sell' }, sides),
      button(icon('sliders'), () => openSettings(), { class: 'tspc-settings-button', 'aria-label': 'Swap settings' })),
    el('form', { on: { submit: (e) => { e.preventDefault(); place(); } } },
      el('label', { class: 'tspc-amount-box' }, amount, amountUnit), presetRow, balance, quoteText, quoteFees, submit, status, pending),
    el('p', { class: 'tspc-practice' }, 'Practice dollars only. No wallet or real funds.'));
  const myPosition = el('section', { class: 'tspc-position-card', hidden: true });
  const changePeriods = Object.fromEntries([['5m', '5m'], ['1h', '1h'], ['4h', '4h'], ['24h', '1d']].map(([k, label]) => [k, field(label)]));
  const aboutKeys = [['buys', 'Buys · 5m'], ['sells', 'Sells · 5m'], ['volume', 'Volume · 5m'], ['buyers', 'Buyers'], ['sellers', 'Sellers'],
    ['supply', 'Supply'], ['network', 'Network'], ['created', 'Created'], ['website', 'Website'], ['socials', 'Socials']];
  const aboutFields = Object.fromEntries(aboutKeys.map(([k, label]) => [k, field(label)]));
  const aboutAddress = button('Contract', () => copyContract(), { class: 'tspc-address' });
  const about = el('section', { class: 'tspc-about' }, el('h3', {}, 'About'),
    el('dl', { class: 'tspc-changes' }, Object.values(changePeriods).map((x) => x.el)),
    el('dl', { class: 'tspc-about-rows' }, Object.values(aboutFields).map((x) => x.el)),
    el('div', { class: 'tspc-contract-row' }, el('span', { class: 'tspc-muted' }, 'Contract'), aboutAddress));
  const settings = makeSettings();
  const root = el('section', { class: 'tspc-coin', 'aria-label': 'Phomo coin detail' }, header,
    el('div', { class: 'tspc-layout' }, el('div', { class: 'tspc-main' }, chartSection, details),
      el('aside', { class: 'tspc-sidebar' }, orderCard, myPosition, about)), settings.dialog);
  host.append(root);
  const palette = ctx.colors || {};
  const chart = createGChart(plot, { mode: C.mode, unit: 'usd', tf: C.tf,
    colors: { bg: palette.bg || '#121010', border: palette.line || '#302727', axis: palette.muted || '#a49b98',
      strong: palette.text || '#f6f2ef', up: palette.up || '#6be2ac', down: palette.down || '#ff8b9a',
      label: palette.panel || '#211b19', ma: '#69b8ff', ema: '#c9a6ff' },
    onHover: (b) => setText(legend, b ? `${b.hovering ? '' : 'Now · '}O ${b.fmt(b.o)}  H ${b.fmt(b.h)}  L ${b.fmt(b.l)}  C ${b.fmt(b.c)}  ${pct(b.ch)}  Volume ${usd(b.vol * px)}` : ''),
  });

  async function copyContract() {
    const value = market.info(id)?.mint;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      if (!C.dead) setText(status, 'Contract copied.');
    } catch {
      if (!C.dead) setText(status, `Contract: ${value}`);
    }
  }
  function orderOptions() {
    const p = prefs();
    const defaults = typeof ctx.settings === 'function' ? ctx.settings() : {};
    return { ...defaults, ...(p.slippageMode === 'custom' && fin(p.slippage) ? { slippage: p.slippage } : {}) };
  }
  function request() {
    const n = parseAmount(amount.value);
    if (!(n > 0) || !fin(n) || !(px > 0) || C.side === 'sell' && n > 100) return null;
    return { coin: id, side: C.side, ...orderOptions(), ...(C.side === 'buy' ? { sol: n / px } : { frac: n / 100 }) };
  }
  function renderPresets() {
    const values = C.side === 'buy' ? prefs().buyPresets || [10, 100, 500, 1000] : prefs().sellPresets || [10, 25, 50, 100];
    presetRow.replaceChildren(...values.map((v) => button(C.side === 'buy' ? usd(v) : `${v}%`, () => {
      amount.value = String(v);
      setText(status, '');
      renderQuote();
    })));
  }
  function renderQuote() {
    const s = current();
    if (!s) { submit.disabled = true; return; }
    const p = position();
    setText(balance, C.side === 'buy' ? `Available ${usdFull(market.player.sol * px)}`
      : `Your position ${usdFull((p?.value || 0) * px)} · ${tokens(p?.tokens || 0)} ${s.live ? 'practice units' : s.ticker}`);
    setText(submit, `${C.side === 'buy' ? 'Buy' : 'Sell'} ${s.ticker}`);
    const req = request();
    const q = req ? market.quote(req) : null;
    submit.disabled = !q || !q.ok || !q.enough || Boolean(ctx.run && ctx.run.over);
    if (!req) {
      setText(quoteText, C.side === 'buy' ? 'Enter an amount in practice dollars.' : 'Enter a percentage from 0 to 100.');
      setText(quoteFees, '');
    } else if (!q.ok) {
      setText(quoteText, error(q.error));
      setText(quoteFees, '');
    } else {
      setText(quoteText, C.side === 'buy' ? `Receive ≈ ${tokens(q.tokens)} ${s.live ? 'practice units' : s.ticker}` : `Receive ≈ ${usdFull(q.got * px)}`);
      const fees = q.fees.terminal + q.fees.market + q.fees.network;
      setText(quoteFees, `Fees ${usdFull(fees * px)} · Impact ${share(Math.abs(q.impact))} · Slippage ${share(q.slippage)}${q.enough ? '' : ' · Insufficient balance'}`);
    }
    const waiting = (s.pending || []).filter((o) => o.status === 'pending').length;
    setText(pending, waiting ? `${waiting} practice ${waiting === 1 ? 'swap' : 'swaps'} pending…` : '');
  }
  function place() {
    const req = request();
    if (!req) { setText(status, 'Check the amount.'); return; }
    const result = ctx.order(req);
    if (!result || !result.ok) { setText(status, error(result?.error)); return; }
    C.submitted = result.order?.id;
    setText(status, 'Practice swap submitted.');
    C.chartDirty = true;
    update(undefined, true);
  }
  function traderKey(row) {
    if (row.me) return 'you';
    if (row.kol) return `kol:${row.kol}`;
    return typeof state.traderForAddress === 'function' ? state.traderForAddress(row.addr) : null;
  }
  function traderCell(row, live) {
    const key = traderKey(row);
    const profile = key && state.profile(key);
    const name = row.me ? 'You' : profile?.name || (row.kol ? `@${row.kol}` : short(row.addr));
    return el('div', { class: 'tspc-trader' }, key ? button(name, () => onTrader(key), { class: 'tspc-trader-link' }) : el('span', {}, name || 'Unknown trader'),
      el('small', { class: 'tspc-muted' }, row.me ? 'Practice account' : live ? 'Unidentified live swap' : 'Simulated trader'));
  }
  const minSize = () => Math.max(0, parseAmount(minimum.value) || 0);
  const accepts = (row, dollars) => (!C.following || state.isFollowing(traderKey(row))) && (!minSize() || fin(dollars) && dollars >= minSize());
  const coinNotes = () => typeof state.notes === 'function' ? state.notes({ coin: id }) : [];
  function refreshRows() { C.lastRows = -Infinity; C.chartDirty = true; update(undefined, true); }
  function renderRows(s) {
    tableWrap.hidden = C.tab === 'thesis';
    thesisPane.hidden = C.tab !== 'thesis';
    const notes = coinNotes().filter((n) => !C.following || n.traderKey && state.isFollowing(n.traderKey));
    const noteNodes = () => notes.slice(0, 30).map((n) => el('article', { class: 'tspc-thesis' },
      el('span', { class: 'tspc-muted' }, 'Your local thesis'), el('p', {}, n.text)));
    const showNotes = C.thesis ? notes.slice(0, 2) : [];
    noteStrip.hidden = !showNotes.length;
    const noteKey = showNotes.map((n) => `${n.id}:${n.text}`).join('|');
    if (noteStrip.dataset.content !== noteKey) {
      noteStrip.dataset.content = noteKey;
      noteStrip.replaceChildren(...showNotes.map((n) => button(['Thesis · ', n.text], () => {
        C.tab = 'thesis';
        for (const b of tabs) b.setAttribute('aria-pressed', String(b.dataset.tab === C.tab));
        refreshRows();
      }, { class: 'tspc-chart-thesis' })));
    }
    if (C.tab === 'thesis') {
      setText(rowsNote, 'Theses are local practice notes. They are not published to a social network.');
      thesisList.replaceChildren(...(notes.length ? noteNodes() : [el('p', { class: 'tspc-empty' }, C.following ? 'No theses from followed traders.' : 'Start the conversation with your own thesis.')]));
      return;
    }
    const headers = C.tab === 'holders' ? ['Trader', 'Position', 'PnL', 'Avg entry', 'Thesis'] : ['Trader', 'Side', 'Size', 'Price', 'Time'];
    const headKey = headers.join('|');
    if (tableHead.dataset.content !== headKey) {
      tableHead.dataset.content = headKey;
      tableHead.replaceChildren(el('tr', {}, headers.map((h) => el('th', { scope: 'col' }, h))));
      tableBody.replaceChildren();
    }
    setText(rowsNote, s.live ? 'Real market data · only your practice holding is known. Other holders and identities are unavailable.'
      : 'Simulated traders and practice positions. All amounts are in dollars.');
    if (C.tab === 'holders') {
      const rows = (market.holders(id, 100)?.list || []).filter((h) => (!s.live || h.me) && accepts(h, h.tok * s.price * px));
      keyed(tableBody, rows, (h) => h.addr, () => el('tr'), (tr, h) => {
        const p = h.me ? position() : null;
        const value = h.tok * s.price * px;
        const pnl = p ? p.total * px : ((h.out || 0) + h.tok * s.price - (h.in || 0)) * px;
        // After partial sales the holder record has no remaining cost basis: do not invent an average entry.
        const entry = p && p.tokens > 0 ? p.cost / p.tokens * px : !h.out && h.tok > 0 ? h.in / h.tok * px : null;
        const note = h.me ? coinNotes()[0]?.text || '—' : '—';
        const key = `${value}:${pnl}:${entry}:${note}:${C.following}`;
        if (tr.dataset.content === key) return;
        tr.dataset.content = key;
        const pnlCell = el('td', {}, signed(pnl, 'usd'));
        tone(pnlCell, pnl, 0.005);
        tr.replaceChildren(el('td', {}, traderCell(h, s.live)), el('td', {}, usd(p?.value != null ? p.value * px : value),
          el('small', { class: 'tspc-muted tspc-token-count' }, `${tokens(h.tok)} ${s.live ? 'practice units' : s.ticker}`)),
          pnlCell, el('td', {}, knownPrice(entry)), el('td', { class: 'tspc-thesis-cell', title: note }, note));
      });
    } else {
      const rows = (market.trades(id, 100) || []).filter((t) => accepts(t, t.sol * px));
      keyed(tableBody, rows, (t) => `${t.t}:${t.addr}:${t.side}:${t.tok}`, () => el('tr'), (tr, t) => {
        const key = `${Math.floor(market.t - t.t)}:${t.sol}:${t.tok}`;
        if (tr.dataset.content === key) return;
        tr.dataset.content = key;
        const side = el('td', { class: t.side === 'buy' ? 'is-up' : 'is-down' }, t.side === 'buy' ? 'Buy' : 'Sell');
        tr.replaceChildren(el('td', {}, traderCell(t, s.live)), side, el('td', {}, usd(t.sol * px)),
          el('td', {}, knownPrice(t.tok > 0 ? t.sol / t.tok * px : null)), el('td', {}, `${age(market.t - t.t)} ago`));
      });
    }
    if (!tableBody.children.length) tableBody.append(el('tr', { data: { key: 'empty' } }, el('td', { colSpan: 5, class: 'tspc-empty' },
      C.following ? 'No matching activity from traders you follow.' : C.tab === 'holders' ? 'No practice positions to show yet.' : 'No matching swaps yet.')));
  }
  function renderPosition() {
    const p = position();
    myPosition.hidden = !p;
    if (!p) return;
    const key = `${p.tokens}:${p.value}:${p.total}:${p.cost}`;
    if (myPosition.dataset.content === key) return;
    myPosition.dataset.content = key;
    const pnl = el('strong', {}, `${signed(p.total * px, 'usd')} (${pct(p.pnlPct)})`);
    tone(pnl, p.total, 0.00001);
    myPosition.replaceChildren(el('h3', {}, 'Your position'), pnl, el('dl', { class: 'tspc-about-rows' },
      [['Value', usdFull(p.value * px)], ['Invested', usdFull(p.invested * px)], ['Sold', usdFull(p.sold * px)],
        ['Realized PnL', signed(p.realized * px, 'usd')]].map(([label, val]) => field(label, val).el)));
  }
  function renderChart(s) {
    if (C.cdv !== s.cdv || !C.candles.length) {
      C.cdv = s.cdv;
      C.candles = market.candles(id) || [];
    } else {
      const last = C.candles.at(-1)?.t;
      const more = market.candles(id, last) || [];
      if (more.length) {
        if (more[0].t === last) C.candles.pop();
        C.candles.push(...more);
        if (C.candles.length > 5000) C.candles.splice(0, C.candles.length - 4000);
      }
    }
    const marks = C.following ? (market.trades(id, 100) || []).filter((t) => accepts(t, t.sol * px)).map((t) => ({ t: t.t, side: t.side }))
      : C.marks ? market.orders(120).filter((o) => o.coin === id && o.status === 'filled'
        && Math.max(o.spent || 0, o.got || 0, o.sol || 0) * px >= minSize()).map((o) => ({ t: o.doneAt, side: o.side })) : [];
    chart.set({ candles: C.candles, solUsd: px, marks, tf: C.tf, migratedAt: s.migratedAt, base });
  }
  function update(now, force = false) {
    if (C.dead) return;
    const at = fin(now) ? now : performance.now();
    if (!force && at - C.lastDraw < 250 && at >= C.lastDraw) return;
    C.lastDraw = at;
    const s = current();
    const info = market.info(id);
    if (!s || !info) { setText(status, 'This coin is no longer available.'); submit.disabled = true; return; }
    const day = tokenMetrics(market, id, { solUsd: px, window: '24h' });
    setText(ticker, s.ticker);
    setText(fullName, s.name);
    setText(coinAge, age(s.age));
    setText(coinKind, s.live ? 'Real coin · practice money' : 'Simulated coin');
    if (!samePic(picture.firstChild, s)) picture.replaceChildren(pic(s, '', 'tspc'));
    setText(contract, short(info.mint));
    contract.title = info.mint || '';
    setText(aboutAddress, short(info.mint));
    aboutAddress.title = info.mint || '';
    setText(watch, state.isWatched(id) ? '★ Watching' : '☆ Watch');
    watch.setAttribute('aria-pressed', String(state.isWatched(id)));
    setText(stats.cap.dd, usd(s.mc * px));
    setText(stats.price.dd, knownPrice(s.price * px));
    setText(stats.price.el.firstChild, s.live ? 'Price · practice unit' : 'Price');
    stats.price.el.title = s.live ? 'Price per normalized practice unit; the real token supply may differ.' : 'Price per token';
    setText(stats.change.dd, pct(day?.change));
    tone(stats.change.dd, day?.change, 0.0005);
    setText(stats.volume.dd, usd(day?.volumeUsd));
    setText(stats.liquidity.dd, usd(s.live && s.estimated ? null : s.liq * px));
    setText(stats.holders.dd, s.live ? '—' : num(s.holders));
    setText(stats.top10.dd, s.live ? '—' : share(s.top10));
    setText(chartNote, s.live ? 'Chart follows real market cap. Prices and token counts use normalized practice units. Missing data is shown as —.'
      : 'Simulated market · drag to pan, scroll or pinch to zoom. Your practice swaps appear as B/S markers.');
    renderChart(s);
    C.chartDirty = false;
    renderQuote();
    if (C.submitted != null) {
      const order = market.orders(120).find((o) => o.id === C.submitted);
      if (order && order.status !== 'pending') {
        setText(status, order.status === 'filled' ? 'Practice swap filled.' : error(order.reason));
        C.submitted = null;
      }
    }
    renderPosition();
    if (force || at - C.lastRows >= 1000 || at < C.lastRows) {
      C.lastRows = at;
      renderRows(s);
      for (const [window, entry] of Object.entries(changePeriods)) {
        const m = window === '24h' ? day : tokenMetrics(market, id, { solUsd: px, window });
        setText(entry.dd, pct(m?.change));
        tone(entry.dd, m?.change, 0.0005);
      }
      const values = { buys: num(s.buys5m), sells: num(s.sells5m), volume: usd(s.vol5m * px), buyers: '—', sellers: '—',
        supply: s.live ? '—' : tokens(SUPPLY), network: s.live ? CHAIN_NAMES[s.chain] || s.chain || '—' : 'Simulated',
        created: fin(s.born) ? new Date(base + s.born * 1000).toLocaleString() : '—',
        website: info.socials?.web ? 'Available · address not supplied' : '—',
        socials: [info.socials?.x && 'X', info.socials?.tg && 'Telegram'].filter(Boolean).join(' · ') || '—' };
      for (const [key, value] of Object.entries(values)) setText(aboutFields[key].dd, value);
    }
  }

  function makeSettings() {
    const buy = [0, 1, 2, 3].map((n) => el('input', { type: 'text', inputMode: 'decimal', 'aria-label': `Buy preset ${n + 1} in dollars` }));
    const sell = [0, 1, 2, 3].map((n) => el('input', { type: 'text', inputMode: 'decimal', 'aria-label': `Sell preset ${n + 1} in percent` }));
    const slipMode = el('select', { 'aria-label': 'Slippage mode' }, el('option', { value: 'auto' }, 'Auto'), el('option', { value: 'custom' }, 'Custom'));
    const slip = el('input', { type: 'text', inputMode: 'decimal', 'aria-label': 'Custom slippage percentage' });
    const slipLabel = el('label', { class: 'tspc-custom-slip' }, 'Maximum slippage %', slip);
    slipMode.addEventListener('change', () => { slipLabel.hidden = slipMode.value !== 'custom'; });
    const message = el('p', { class: 'tspc-settings-error', role: 'alert' });
    const dialog = el('dialog', { class: 'tspc-settings', 'aria-label': 'Phomo swap settings' },
      el('div', { class: 'tspc-settings-heading' }, el('h2', {}, 'Swap settings'), button('×', () => dialog.close(), { 'aria-label': 'Close swap settings' })),
      el('form', { on: { submit: (e) => {
        e.preventDefault();
        const b = buy.map((n) => parseAmount(n.value));
        const s = sell.map((n) => parseAmount(n.value));
        const sl = parseAmount(slip.value) / 100;
        if (b.some((v) => !fin(v) || v <= 0 || v > 1e6) || s.some((v) => !fin(v) || v <= 0 || v > 100)
          || slipMode.value === 'custom' && (!fin(sl) || sl < 0.005 || sl > 0.99)) {
          setText(message, 'Use buy amounts up to $1 million, sell percentages up to 100%, and slippage from 0.5% to 99%.');
          return;
        }
        state.setPrefs({ buyPresets: b, sellPresets: s, slippageMode: slipMode.value, slippage: fin(sl) ? sl : 0.2 });
        renderPresets();
        renderQuote();
        dialog.close();
      } } },
      el('div', { class: 'tspc-settings-section' }, el('div', { class: 'tspc-settings-label' }, el('h3', {}, 'Buy presets · USD'),
        button('Reset', () => buy.forEach((n, i) => { n.value = String([10, 100, 500, 1000][i]); }))),
      el('div', { class: 'tspc-settings-inputs' }, buy)),
      el('div', { class: 'tspc-settings-section' }, el('div', { class: 'tspc-settings-label' }, el('h3', {}, 'Sell presets · %'),
        button('Reset', () => sell.forEach((n, i) => { n.value = String([10, 25, 50, 100][i]); }))),
      el('div', { class: 'tspc-settings-inputs' }, sell)),
      el('div', { class: 'tspc-settings-section' }, el('label', {}, 'Slippage ', slipMode), slipLabel,
        el('p', { class: 'tspc-muted' }, 'Auto uses your current game slippage setting. Applies to practice swaps only.'),
        button('Game trading settings', () => { dialog.close(); ctx.openSettings?.(); })), message,
      el('button', { class: 'tspc-submit', type: 'submit' }, 'Save')));
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
    // Keep the browser's native Escape-to-close behavior inside this modal; the workspace also handles Escape.
    dialog.addEventListener('keydown', (e) => { if (e.key === 'Escape') e.stopPropagation(); });
    return { dialog, buy, sell, slipMode, slip, slipLabel, message };
  }
  function openSettings() {
    const p = prefs();
    settings.buy.forEach((n, i) => { n.value = String((p.buyPresets || [10, 100, 500, 1000])[i]); });
    settings.sell.forEach((n, i) => { n.value = String((p.sellPresets || [10, 25, 50, 100])[i]); });
    settings.slipMode.value = p.slippageMode === 'custom' ? 'custom' : 'auto';
    settings.slip.value = String((fin(p.slippage) ? p.slippage : 0.2) * 100);
    settings.slipLabel.hidden = settings.slipMode.value !== 'custom';
    setText(settings.message, '');
    settings.dialog.showModal();
  }
  renderPresets();
  update(undefined, true);
  return { update, destroy() {
    if (C.dead) return;
    C.dead = true;
    if (settings.dialog.open) settings.dialog.close();
    chart.destroy();
    root.remove();
  } };
}
