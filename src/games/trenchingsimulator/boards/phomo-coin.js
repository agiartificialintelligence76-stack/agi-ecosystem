// Phomo's spot coin page. Dollars are converted only at the existing practice-order boundary.
// The chart and holdings use the engine's normalized token units; live unknowns stay unavailable.
import { el, setText, keyed, icon } from '../ui.js';
import { usd, usdFull, signed, pct, share, age, tokens, price } from '../format.js';
import { SUPPLY } from '../curve.js';
import { MIN_BUY } from '../engine.js';
import { parseAmount, pic, samePic, short, num, tone, ORDER_ERRORS, CHAIN_NAMES } from './common.js';
import { GTF, INDICATORS } from './gngm-data.js';
import { chartCredit } from './gchart.js';
import { createPhomoChart } from './phomo-chart.js';
import { tokenMetrics } from './phomo-data.js';
import './phomo-coin.css';
import './phomo-chart.css';

const fin = (v) => typeof v === 'number' && Number.isFinite(v);
const knownPrice = (v) => fin(v) ? `$${price(v)}` : '—';
const button = (text, click, attrs = {}) => el('button', { type: 'button', class: 'tspc-button', ...attrs, on: { click } }, text);
const field = (label, value = '—') => {
  const dd = el('dd', {}, value);
  return { el: el('div', {}, el('dt', {}, label), dd), dd };
};
const paths = {
  candles: 'M7 3v18M4 7h6v9H4zM17 3v18M14 5h6v8h-6z', trend: 'M4 19L20 5M3 18l2 2M19 4l2 2',
  cursor: 'M5 3l14 10-7 1-3 7z', horizontal: 'M3 12h18', vertical: 'M12 3v18', ray: 'M3 19L20 4M15 4h5v5',
  rectangle: 'M4 5h16v14H4z', text: 'M4 5h16M12 5v15M8 20h8', measure: 'M4 17L17 4l4 4L8 21zM9 12l3 3M13 8l3 3',
  undo: 'M9 5L4 10l5 5M4 10h9a6 6 0 0 1 6 6', redo: 'M15 5l5 5-5 5M20 10h-9a6 6 0 0 0-6 6',
  fullscreen: 'M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6', camera: 'M3 7h5l2-3h4l2 3h5v13H3zM16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  trash: 'M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7',
};
function chartIcon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('class', 'tspc-tool-icon');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', paths[name] || paths.cursor); svg.append(p); return svg;
}

export function mountPhomoCoin(host, ctx, id, { state, onTrader = () => {}, onClose = () => {}, positionsHost = null, initialSide = 'buy' } = {}) {
  const market = ctx.market;
  const px = ctx.solUsd > 0 ? ctx.solUsd : market.solUsd;
  const base = Date.now() - market.t * 1000;
  const C = { side: initialSide === 'sell' ? 'sell' : 'buy', tab: 'holders', tf: 60, mode: 'mcap', marks: true, thesis: true, following: false,
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
  const watch = button('☆', () => { state.toggleWatch(id); update(undefined, true); }, { 'aria-pressed': 'false', 'aria-label': 'Watch token', title: 'Watch token' });
  const hide = button('×', () => { state.toggleHide(id); onClose(); }, { 'aria-label': 'Hide token', title: 'Hide token' });
  const statLabels = [['cap', 'Market cap'], ['price', 'Price'], ['change', '24h change'], ['volume', '24h volume'],
    ['liquidity', 'Liquidity'], ['holders', 'Holders'], ['top10', 'Top 10']];
  const stats = Object.fromEntries(statLabels.map(([key, label]) => [key, field(label)]));
  const header = el('header', { class: 'tspc-header' },
    el('div', { class: 'tspc-heading' }, picture,
      el('div', { class: 'tspc-identity' }, el('div', { class: 'tspc-title' }, ticker, fullName),
        el('div', { class: 'tspc-meta' }, coinAge, contract, coinKind)),
      el('div', { class: 'tspc-actions' }, watch, hide)),
    el('dl', { class: 'tspc-stat-grid' }, Object.values(stats).map((x) => x.el)));

  const interval = el('select', { class: 'tspc-chart-select', 'aria-label': 'Candle interval', on: { change: () => {
    C.tf = Number(interval.value);
    C.chartDirty = true;
    update(undefined, true);
  } } }, GTF.map((t) => el('option', { value: t.s, selected: t.s === C.tf }, t.id)));
  const styleSelect = el('select', { class: 'tspc-chart-select tspc-style-select', 'aria-label': 'Chart style', on: { change: () => chart.style(styleSelect.value) } },
    [['candles', 'Candles'], ['bars', 'Bars'], ['line', 'Line'], ['area', 'Area']].map(([value, label]) => el('option', { value }, label)));
  const modes = [['price', 'Price'], ['mcap', 'MCap']].map(([mode, label]) => button(label, () => {
    C.mode = mode;
    for (const b of modes) b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
    chart.view({ mode, unit: 'usd' });
  }, { data: { mode }, 'aria-pressed': String(mode === C.mode) }));
  const indicatorButtons = INDICATORS.map(([key, label]) => button(label, () => {
    C.indicators = C.indicators.includes(key) ? C.indicators.filter((k) => k !== key) : [...C.indicators, key];
    for (const b of indicatorButtons) b.setAttribute('aria-pressed', String(C.indicators.includes(b.dataset.indicator)));
    chart.indicators(C.indicators);
  }, { data: { indicator: key }, 'aria-pressed': 'false' }));
  const indicators = el('details', { class: 'tspc-indicators' }, el('summary', {}, el('i', {}, 'ƒx'), ' Indicators'),
    el('div', { class: 'tspc-indicator-menu' }, indicatorButtons));
  const legend = el('p', { class: 'tspc-legend', 'aria-hidden': 'true' });
  const plot = el('div', { class: 'tspc-plot', tabIndex: 0, role: 'img', 'aria-label': 'Market cap chart in dollars. Use the drawing toolbar to annotate.' });
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
  const toolButton = (name, label, action, attrs = {}) => button(chartIcon(name), action, { class: 'tspc-icon-button', title: label, 'aria-label': label, ...attrs });
  const undo = toolButton('undo', 'Undo drawing', () => chart.undo());
  const redo = toolButton('redo', 'Redo drawing', () => chart.redo());
  const drawingButtons = [['cursor', 'Select or move drawing'], ['trend', 'Trend line'], ['horizontal', 'Horizontal line'], ['vertical', 'Vertical line'],
    ['ray', 'Ray'], ['rectangle', 'Rectangle'], ['text', 'Text annotation'], ['measure', 'Measure']].map(([tool, label]) =>
    toolButton(tool, label, () => { chart.drawTool(tool); setText(drawHint, tool === 'cursor' ? '' : tool === 'text' ? 'Click the chart to add text.'
      : ['horizontal', 'vertical'].includes(tool) ? 'Click the chart to place a line.' : 'Click two points on the chart.'); }, { data: { tool }, 'aria-pressed': String(tool === 'cursor') }));
  const lockDrawing = button(icon('lock'), () => chart.lockSelected(), { class: 'tspc-icon-button', 'aria-label': 'Lock or unlock selected drawing', title: 'Lock or unlock selected drawing' });
  const hideDrawings = toolButton('eye', 'Show or hide drawings', () => chart.showDrawings(!chart.state.visible), { 'aria-pressed': 'true' });
  const deleteDrawing = toolButton('trash', 'Delete selected drawing', () => chart.removeSelected());
  const drawingRail = el('div', { class: 'tspc-drawing-rail', role: 'toolbar', 'aria-label': 'Drawing tools', hidden: true }, drawingButtons,
    el('span', { class: 'tspc-tool-divider' }), lockDrawing, hideDrawings, deleteDrawing,
    button('Clear', () => chart.clearDrawings(), { class: 'tspc-drawing-clear', title: 'Remove unlocked drawings' }));
  const drawToggle = toolButton('trend', 'Toggle drawing tools', () => {
    drawingRail.hidden = !drawingRail.hidden; drawToggle.setAttribute('aria-pressed', String(!drawingRail.hidden));
  }, { 'aria-pressed': 'false' });
  const drawHint = el('p', { class: 'tspc-drawing-hint', role: 'status' });
  const clock = el('span', { class: 'tspc-chart-clock' });
  const rangeButtons = [['1D', 86400], ['1W', 604800], ['1M', 2592000], ['3M', 7776000], ['1Y', 31536000]].map(([label, seconds]) =>
    button(label, () => { chart.range(seconds); for (const b of rangeButtons) b.setAttribute('aria-pressed', String(b.textContent === label));
      setText(drawHint, 'Showing the selected range within this session’s retained market data.'); }, { 'aria-pressed': 'false' }));
  const percent = button('%', () => chart.scale(chart.state.scale === 'percent' ? 'normal' : 'percent'), { 'aria-label': 'Percentage price scale', 'aria-pressed': 'false' });
  const log = button('log', () => chart.scale(chart.state.scale === 'log' ? 'normal' : 'log'), { 'aria-label': 'Logarithmic price scale', 'aria-pressed': 'false' });
  const autoscale = button('auto', () => chart.auto(!chart.state.auto), { 'aria-label': 'Automatic price scale', 'aria-pressed': 'true' });
  const chartSection = el('section', { class: 'tspc-chart-card', 'aria-label': 'Coin chart' },
    el('div', { class: 'tspc-chart-tools' }, interval, el('label', { class: 'tspc-style-label', title: 'Chart style' }, chartIcon('candles'), styleSelect), indicators,
      el('div', { class: 'tspc-segments', role: 'group', 'aria-label': 'Chart value' }, modes), undo, redo,
      el('span', { class: 'tspc-tool-spacer' }), drawToggle,
      button(icon('sliders'), () => chartSettings.showModal(), { class: 'tspc-icon-button', title: 'Chart settings', 'aria-label': 'Chart settings' }),
      toolButton('fullscreen', 'Fullscreen chart', () => fullscreen()), toolButton('camera', 'Download chart image', () => snapshot())),
    el('div', { class: 'tspc-chart-body' }, drawingRail, el('div', { class: 'tspc-chart-canvas' }, legend, plot)),
    el('div', { class: 'tspc-chart-bottom' }, el('div', { class: 'tspc-chart-ranges' }, rangeButtons), clock, percent, log, autoscale,
      button('↻', () => chart.fit(), { title: 'Fit retained chart data', 'aria-label': 'Reset chart view' })),
    drawHint,
    el('div', { class: 'tspc-overlays' }, el('span', { class: 'tspc-muted' }, 'Chart overlays'),
      check('My swaps', 'marks'), check('Thesis', 'thesis'), check('Following only', 'following'),
      el('label', { class: 'tspc-min-label' }, 'Min size $', minimum)), noteStrip,
    el('details', { class: 'tspc-chart-disclosure' }, el('summary', {}, 'Chart data & attribution'), chartNote, chartCredit()));

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
    placeholder: '0', value: '100', 'aria-label': C.side === 'buy' ? 'Buy amount in practice dollars' : 'Percentage of your holding to sell', on: { input: () => { setText(status, ''); renderQuote(); } } });
  const amountUnit = el('span', { class: 'tspc-amount-unit' }, C.side === 'buy' ? '$' : '%');
  const amountHint = el('span', { class: 'tspc-amount-hint' }, C.side === 'buy' ? 'Enter amount' : 'Percentage to sell');
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
    setText(amountUnit, side === 'buy' ? '$' : '%');
    setText(amountHint, side === 'buy' ? 'Enter amount' : 'Percentage to sell');
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
      el('label', { class: 'tspc-amount-box' }, el('span', { class: 'tspc-amount-value' }, amountUnit, amount), amountHint), presetRow, balance,
      el('details', { class: 'tspc-quote-details' }, el('summary', {}, 'Quote & fees'), quoteText, quoteFees), submit, status, pending),
    el('p', { class: 'tspc-practice' }, 'Practice dollars only. No wallet or real funds.'));
  const myPosition = el('section', { class: 'tspc-position-card', hidden: true });
  const changePeriods = Object.fromEntries([['5m', '5m'], ['1h', '1h'], ['4h', '4h'], ['24h', '1d']].map(([k, label]) => [k, field(label)]));
  const aboutKeys = [['buys', 'Buys · 5m'], ['sells', 'Sells · 5m'], ['volume', 'Volume · 5m'], ['buyers', 'Buyers'], ['sellers', 'Sellers'],
    ['supply', 'Supply'], ['network', 'Network'], ['created', 'Created'], ['website', 'Website'], ['socials', 'Socials']];
  const aboutFields = Object.fromEntries(aboutKeys.map(([k, label]) => [k, field(label)]));
  const description = el('p', { class: 'tspc-description' });
  function pair(left, right) {
    const meter = el('progress', { class: 'tspc-pair-meter', max: 1, value: 0, 'aria-label': `${left} versus ${right}` });
    return { meter, el: el('div', { class: 'tspc-pair' }, el('dl', {}, aboutFields[left].el, aboutFields[right].el), meter) };
  }
  const tradesPair = pair('buys', 'sells');
  const tradersPair = pair('buyers', 'sellers');
  const aboutAddress = button('Contract', () => copyContract(), { class: 'tspc-address' });
  const moreAbout = el('details', { class: 'tspc-about-more' }, el('summary', {}, 'View more'),
    el('dl', { class: 'tspc-about-rows' }, ['supply', 'network', 'created', 'website', 'socials'].map((k) => aboutFields[k].el)),
    el('div', { class: 'tspc-contract-row' }, el('span', { class: 'tspc-muted' }, 'Contract'), aboutAddress));
  const about = el('section', { class: 'tspc-about' }, el('h3', {}, 'About'), description,
    el('dl', { class: 'tspc-changes' }, Object.values(changePeriods).map((x) => x.el)),
    tradesPair.el, el('dl', { class: 'tspc-about-rows tspc-about-volume' }, aboutFields.volume.el), tradersPair.el, moreAbout);
  const settings = makeSettings();
  const chartSettings = makeChartSettings();
  const textSettings = makeTextSettings();
  const root = el('section', { class: 'tspc-coin', 'aria-label': 'Phomo coin detail' },
    el('div', { class: 'tspc-layout' }, el('div', { class: 'tspc-main' }, header, chartSection, details),
      el('aside', { class: 'tspc-sidebar' }, orderCard, about, positionsHost || myPosition)), settings.dialog, chartSettings, textSettings.dialog);
  host.append(root);
  const palette = ctx.colors || {};
  const chart = createPhomoChart(plot, { mode: C.mode, unit: 'usd', tf: C.tf,
    colors: { bg: palette.bg || '#121010', border: palette.line || '#302727', axis: palette.muted || '#a49b98',
      strong: palette.text || '#f6f2ef', up: palette.up || '#6be2ac', down: palette.down || '#ff8b9a',
      label: palette.panel || '#211b19', ma: '#69b8ff', ema: '#c9a6ff' },
    onHover: (b) => setText(legend, b ? `${b.hovering ? '' : 'Now · '}O ${b.fmt(b.o)}  H ${b.fmt(b.h)}  L ${b.fmt(b.l)}  C ${b.fmt(b.c)}  ${pct(b.ch)}  Volume ${usd(b.vol * px)}` : ''),
    requestText: () => textSettings.ask(),
    onChange: (next) => {
      undo.disabled = !next.canUndo; redo.disabled = !next.canRedo;
      deleteDrawing.disabled = next.selected == null || next.drawings.find((r) => r.id === next.selected)?.locked;
      lockDrawing.disabled = next.selected == null;
      for (const b of drawingButtons) b.setAttribute('aria-pressed', String(b.dataset.tool === next.tool));
      hideDrawings.setAttribute('aria-pressed', String(next.visible));
      percent.setAttribute('aria-pressed', String(next.scale === 'percent')); log.setAttribute('aria-pressed', String(next.scale === 'log'));
      autoscale.setAttribute('aria-pressed', String(next.auto));
      if (next.tool === 'cursor' && !next.rangeSeconds) setText(drawHint, '');
    },
  });

  async function fullscreen() {
    try {
      if (document.fullscreenElement === chartSection) await document.exitFullscreen();
      else if (chartSection.requestFullscreen) await chartSection.requestFullscreen();
      else chartSection.classList.toggle('is-expanded');
    } catch { chartSection.classList.toggle('is-expanded'); }
  }
  function snapshot() {
    const source = chart.screenshot();
    if (!source) { setText(drawHint, 'The chart is still loading.'); return; }
    const image = document.createElement('canvas'); image.width = source.width; image.height = source.height + 36;
    const context = image.getContext('2d'); if (!context) return;
    context.fillStyle = '#151312'; context.fillRect(0, 0, image.width, image.height); context.drawImage(source, 0, 0);
    context.fillStyle = '#e5d9d3'; context.font = '12px sans-serif';
    context.fillText(`Phomo · ${current()?.ticker || 'Coin'} · Practice market · TradingView Lightweight Charts™`, 10, image.height - 13);
    image.toBlob((blob) => {
      if (!blob || C.dead) return;
      const url = URL.createObjectURL(blob), link = el('a', { href: url, download: 'phomo-practice-chart.png' });
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  }
  function makeChartSettings() {
    const dialog = el('dialog', { class: 'tspc-settings', 'aria-label': 'Chart display settings' },
      el('div', { class: 'tspc-settings-heading' }, el('h2', {}, 'Chart settings'), button('×', () => dialog.close(), { 'aria-label': 'Close chart settings' })),
      ['grid', 'volume', 'crosshair'].map((key) => {
        const input = el('input', { type: 'checkbox', checked: true, on: { change: () => chart.settings({ [key]: input.checked }) } });
        return el('label', { class: 'tspc-chart-option' }, input, { grid: 'Grid lines', volume: 'Volume bars', crosshair: 'Crosshair and axis labels' }[key]);
      }), el('p', { class: 'tspc-muted' }, 'Changes apply to this chart. Drawings remain on their original market values when the display changes.'));
    dialog.addEventListener('keydown', (e) => { if (e.key === 'Escape') e.stopPropagation(); }); return dialog;
  }
  function makeTextSettings() {
    let resolve = null;
    const input = el('input', { type: 'text', maxLength: 120, 'aria-label': 'Chart annotation text' });
    const dialog = el('dialog', { class: 'tspc-settings', 'aria-label': 'Add chart text' },
      el('h2', {}, 'Chart annotation'), el('form', { on: { submit: (e) => { e.preventDefault(); finish(input.value); } } }, input,
        el('div', { class: 'tspc-note-actions' }, button('Cancel', () => finish('')), el('button', { type: 'submit', class: 'tspc-button' }, 'Add text'))));
    const finish = (value) => { const done = resolve; resolve = null; dialog.close(); done?.(value); };
    dialog.addEventListener('close', () => { if (resolve) { const done = resolve; resolve = null; done(''); } });
    dialog.addEventListener('keydown', (e) => { if (e.key === 'Escape') e.stopPropagation(); });
    return { dialog, ask() { input.value = ''; dialog.showModal(); input.focus(); return new Promise((done) => { resolve = done; }); }, cancel: () => finish('') };
  }

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
    // All notes in this device's practice notebook are authored by you; a referenced trader is not their author.
    const notes = C.following ? [] : coinNotes();
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
    if (positionsHost) return;
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
    setText(coinKind, s.live ? CHAIN_NAMES[s.chain] || 'Live' : 'Simulated');
    coinKind.title = s.live ? 'Live market data · practice money' : 'Simulated coin';
    if (!samePic(picture.firstChild, s)) picture.replaceChildren(pic(s, '', 'tspc'));
    setText(contract, short(info.mint));
    contract.title = info.mint || '';
    setText(aboutAddress, short(info.mint));
    aboutAddress.title = info.mint || '';
    setText(watch, state.isWatched(id) ? '★' : '☆');
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
    setText(clock, `${new Date().toLocaleTimeString('en-GB', { hour12: false, timeZone: 'UTC' })} (UTC)`);
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
      setText(description, info.line || (s.live ? 'Live market data, traded with practice money. The relay has not supplied a token description.' : 'A simulated token in this practice market.'));
      const total = s.buys5m + s.sells5m;
      tradesPair.meter.value = total > 0 ? s.buys5m / total : 0;
      tradesPair.meter.classList.toggle('is-unknown', !(total > 0));
      tradesPair.meter.setAttribute('aria-valuetext', total > 0 ? `${num(s.buys5m)} buys and ${num(s.sells5m)} sells in five minutes` : 'No observed swaps in five minutes');
      tradersPair.meter.value = 0; tradersPair.meter.classList.add('is-unknown');
      tradersPair.meter.setAttribute('aria-valuetext', 'Unique buyer and seller counts are unavailable');
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
    if (chartSettings.open) chartSettings.close();
    textSettings.cancel();
    if (positionsHost?.parentNode) positionsHost.remove();
    chart.destroy();
    root.remove();
  } };
}
