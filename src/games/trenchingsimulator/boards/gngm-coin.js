// GNGM's coin page (2026-10-22): laid out the way scanners' token pages are. Its header (the coin, its age, `CA` and the
// first 6 characters of its address, its socials and tags) and its numbers (price, market cap, liquidity, holders,
// volume, top 10, ATH, and its moves over 1m, 5m and 1h); its chart (./gchart.js: TradingView Lightweight Charts™, its
// credit under it) with its toolbar (1s to 15m, market cap
// or price, dollars or the run's coin, fx: MA, EMA, RSI and MACD, the player's B / S marks, zoom) and its legend; its tabs
// (Activity, with each trade's maker and what it was to them, and chips for whose trades; Traders; Holders; Dev token;
// Position / Orders); and on the right its trade module (Buy or Sell; Market, Limit or Auto; four amounts, 25% to 100%,
// "Take my initial"; presets P1 to P3), the player's position with its PnL card, the security checklist, the pool and the
// first 70 buyers. Phones: one column, an Info tab for the right column's boxes, and Buy and Sell buttons that open the
// trade module as a sheet. A real coin: "Real coin · play money", "—" for what isn't known, never a link.
//
// mountCoin(kit) → { el, open(id), close(), isOpen(), fast(force), slow(), refresh(), onPhone(on), destroy() }; kit
// (from ./gngm.js): ctx, market, the run's money (M, MN, MS, mc, U, isUsd, px, cur), orderError, phone, coarse,
// info(id), statsOf(id), limits (add, cancel, of, setAuto, autoOf), shareCard(position), smartIndexOf(addr),
// openWallet(kind, id), close(), openSettings().
import { el, setText, flag, keyed, icon, toast } from '../ui.js';
import { usd, pct, share, age, tokens, price as tinyPrice, nice } from '../format.js';
import { CURVE_TOK, GRAD_MC, SUPPLY } from '../curve.js';
import { PRIORITY } from '../engine.js';
import { buyPresets, parseAmount, num, ago, short, setP, tone, pic, samePic, fromWords, SOCIALS } from './common.js';
import { GTF, INDICATORS, MAKER_FILTERS, makerOk, makerTag, activityLabels, topTraders, securityChecks, firstSummary,
  FIRST_STATES, initialFrac, makeLimit, limitName, entryMcOf, pnlOf, fxText } from './gngm-data.js';
import { createGChart, chartCredit } from './gchart.js';
import { makeScannerDca, scannerFlow } from './gngm-workspace.js';

const TABS = Object.freeze([['activity', 'Trades'], ['orders', 'Positions / Orders'], ['holders', 'Holders'], ['traders', 'Top Traders'],
  ['dev', 'Dev Token'], ['info', 'Info']]);
const STATE_MARK = Object.freeze({ ok: '✓', warn: '!', bad: '✗', na: '—' });
const STATE_WORD = Object.freeze({ ok: 'fine', warn: 'worth a look', bad: 'a red flag', na: 'not known' });

export function mountCoin(kit) {
  const { ctx, market, M, MN, MS, mc, U, isUsd, px, orderError, phone, coarse, info, limits } = kit;
  const coinName = isUsd ? 'SOL' : U.name;
  const perCoin = isUsd ? 1 : U.per;
  const C = { id: null, side: 'buy', otype: 'market', tab: 'activity', tf: 1, maker: 'all', marks: true, fx: [],
    cd: { id: null, arr: [], v: null }, tagKey: null, socKey: null, dead: false, init: null };
  const clockBase = Date.now() - (Number.isFinite(market.t) ? market.t : 0) * 1000;
  const view = () => (typeof ctx.chartView === 'function' ? ctx.chartView() : { mode: 'mcap', unit: 'usd' });

  // ---------- its header and numbers ----------
  const backBtn = el('button', { class: 'tsg-back', type: 'button', on: { click: () => kit.close() } }, icon('back', 'ts-icon'), 'Back');
  const chPic = el('span', { class: 'tsg-ch-pic' });
  const chTk = el('span', { class: 'tsg-ch-tk' });
  const chFull = el('span', { class: 'tsg-ch-full' });
  const chName = el('h2', { class: 'tsg-ch-name', tabIndex: -1 }, chTk, ' ', chFull);
  const chAge = el('span', { class: 'tsg-chipx' });
  const chReal = el('span', { class: 'tsg-chipx is-real', hidden: true }, 'Real coin · play money');
  const chFrom = el('span', { class: 'tsg-chipx', hidden: true });
  const chCa = el('span', { class: 'tsg-chipx is-mono' });
  const chSocs = el('span', { class: 'tsg-ch-socs' });
  const chTags = el('span', { class: 'tsg-tags' });
  const statKeys = [['price', 'Price'], ['mc', 'MC'], ['liq', 'Liq'], ['hold', 'Holders'], ['vol', 'Vol'], ['top10', 'Top 10'], ['ath', 'ATH']];
  const st = {};
  const chStats = el('dl', { class: 'tsg-ch-stats' }, statKeys.map(([k, label]) => {
    st[k] = el('dd', {}, '—');
    return el('div', { class: `tsg-st-${k}` }, el('dt', {}, label), st[k]);
  }));
  const chg = {};
  const chChanges = el('div', { class: 'tsg-ch-chg' }, [['1m', '1m'], ['5m', '5m'], ['1h', '1h']].map(([k, label]) => {
    chg[k] = el('b', {}, '—');
    return el('span', { class: 'tsg-chg' }, el('span', {}, label), chg[k]);
  }));
  const curveT = el('span', { class: 'tsg-curve-t' });
  const curveBar = el('span', { class: 'tsg-bar' }, el('i'));
  const curveBox = el('div', { class: 'tsg-curve' }, curveT, curveBar);

  // ---------- its chart ----------
  const tfBtns = GTF.map((x) => el('button', { class: 'tsg-tf', type: 'button', data: { tf: x.s }, 'aria-pressed': String(x.s === C.tf),
    on: { click: () => setTf(x.s) } }, x.id));
  const modeBtns = [['mcap', 'MCap'], ['price', 'Price']].map(([m, label]) => el('button', { class: 'tsg-tg', type: 'button', data: { m },
    on: { click: () => setChartView({ mode: m }) } }, label));
  const unitBtns = [['usd', 'USD'], ['coin', coinName]].map(([u, label]) => el('button', { class: 'tsg-tg', type: 'button', data: { u },
    on: { click: () => setChartView({ unit: u }) } }, label));
  const fxBtns = INDICATORS.map(([k, label]) => el('button', { class: 'tsg-chip', type: 'button', data: { k }, 'aria-pressed': 'false',
    on: { click: () => toggleFx(k) } }, label));
  const fxMenu = el('div', { class: 'tsg-fxmenu', hidden: true, role: 'group', 'aria-label': 'Indicators' }, fxBtns);
  const fxBtn = el('button', { class: 'tsg-tg is-fx', type: 'button', 'aria-expanded': 'false', on: { click: () => {
    fxMenu.hidden = !fxMenu.hidden;
    fxBtn.setAttribute('aria-expanded', String(!fxMenu.hidden));
  } } }, el('i', {}, 'fx'), el('span', { class: 'tsg-sr' }, ' indicators'));
  const marksBtn = el('button', { class: 'tsg-tg', type: 'button', 'aria-pressed': 'true', title: 'Your buys and sells on the chart',
    on: { click: () => {
      C.marks = !C.marks;
      marksBtn.setAttribute('aria-pressed', String(C.marks));
      fast(false);
    } } }, 'B/S');
  const zoomOut = el('button', { class: 'tsg-tg is-icon', type: 'button', 'aria-label': 'Zoom out', on: { click: () => chart.zoom(-1) } }, '−');
  const zoomIn = el('button', { class: 'tsg-tg is-icon', type: 'button', 'aria-label': 'Zoom in', on: { click: () => chart.zoom(1) } }, '+');
  const fitBtn = el('button', { class: 'tsg-tg is-icon', type: 'button', 'aria-label': 'Back to now', on: { click: () => chart.fit() } },
    icon('replay', 'ts-icon tsg-tg-ic'));
  const legend = el('p', { class: 'tsg-legend', 'aria-hidden': 'true' });
  // (TradingView Lightweight Charts™ draws in it: a box with a height, its own canvases inside, ./gchart.js)
  const plot = el('div', { class: 'tsg-canvas', role: 'img', 'aria-label': 'Chart' });
  const chartBox = el('div', { class: 'tsg-chartbox' },
    el('div', { class: 'tsg-chart-tools' },
      el('div', { class: 'tsg-tfs', role: 'group', 'aria-label': 'Candle size' }, tfBtns),
      el('div', { class: 'tsg-tgs', role: 'group', 'aria-label': 'Market cap or price' }, modeBtns),
      el('div', { class: 'tsg-tgs', role: 'group', 'aria-label': 'In dollars or the coin' }, unitBtns),
      fxBtn, marksBtn, el('div', { class: 'tsg-tgs is-zoom' }, zoomOut, zoomIn, fitBtn)),
    fxMenu, legend, el('div', { class: 'tsg-chart-host' }, plot), chartCredit());
  const col = ctx.colors || {};
  const chart = createGChart(plot, {
    tf: C.tf, mode: view().mode, unit: view().unit, per: perCoin,
    colors: { bg: '#111111', border: '#282828', axis: '#8c8c8c', strong: '#eeeeee', up: '#38b78b', down: '#e85e63', label: '#292929',
      mig: col.warn, ma: col.info, ema: col.violet },
    onHover: (b) => {
      if (!b) return setText(legend, '');
      const f = b.fmt;
      const more = fxText(b.fx, b.ind, f);
      return setText(legend, `${b.hovering ? '' : 'Now  '}O ${f(b.o)}  H ${f(b.h)}  L ${f(b.l)}  C ${f(b.c)}  ${pct(b.ch)}  V ${usd(b.vol * px)}${more ? `  ${more}` : ''}`);
    },
  });
  function syncToggles() {
    const v = view();
    for (const b of modeBtns) b.setAttribute('aria-pressed', String(b.dataset.m === v.mode));
    for (const b of unitBtns) b.setAttribute('aria-pressed', String(b.dataset.u === v.unit));
    chart.view({ mode: v.mode, unit: v.unit, per: perCoin });
  }
  function setChartView(v) {
    if (typeof ctx.setChartView === 'function') ctx.setChartView(v);
    syncToggles();
  }
  function setTf(s) {
    C.tf = s;
    for (const b of tfBtns) b.setAttribute('aria-pressed', String(Number(b.dataset.tf) === s));
    fast(false);
  }
  function toggleFx(k) {
    C.fx = C.fx.includes(k) ? C.fx.filter((x) => x !== k) : [...C.fx, k];
    for (const b of fxBtns) b.setAttribute('aria-pressed', String(C.fx.includes(b.dataset.k)));
    chart.indicators(C.fx);
  }

  // ---------- its tabs ----------
  const tabN = el('span', { class: 'tsg-tab-n' });
  const tabBtns = TABS.map(([id, label]) => el('button', { class: ['tsg-tab', id === 'info' && 'is-phone'], type: 'button', data: { tab: id },
    'aria-pressed': String(id === C.tab), on: { click: () => setTab(id) } }, label, id === 'holders' ? [' ', tabN] : null));
  const th = (t, cls) => el('th', { scope: 'col', class: cls }, t);
  const makerBtns = MAKER_FILTERS.map(([id, label]) => el('button', { class: 'tsg-chip', type: 'button', data: { f: id },
    'aria-pressed': String(id === C.maker), on: { click: () => {
      C.maker = id;
      for (const b of makerBtns) b.setAttribute('aria-pressed', String(b.dataset.f === id));
      renderActivity();
    } } }, label));
  const actBody = el('tbody');
  const actPane = el('div', { class: 'tsg-pane' },
    el('div', { class: 'tsg-chips is-makers', role: 'group', 'aria-label': 'Whose trades' }, makerBtns),
    el('div', { class: 'tsg-tablewrap', tabIndex: 0, role: 'region', 'aria-label': 'Activity' },
      el('table', { class: 'tsg-table is-activity' },
        el('caption', { class: 'tsg-sr' }, 'Its trades, the newest first'),
        el('thead', {}, el('tr', {}, th('Age'), th('Type'), th(isUsd ? 'USD' : U.name, 'tsg-num'), th('Amount', 'tsg-num tsg-c-amt'),
          th('MC', 'tsg-num tsg-c-mc'), th('Maker'))),
        actBody)));
  const trBody = el('tbody');
  const tradersPane = el('div', { class: 'tsg-pane', hidden: true },
    el('div', { class: 'tsg-tablewrap', tabIndex: 0, role: 'region', 'aria-label': 'Top traders' },
      el('table', { class: 'tsg-table is-traders' },
        el('caption', { class: 'tsg-sr' }, 'Its traders, the most profit first'),
        el('thead', {}, el('tr', {}, th('#'), th('Trader'), th('Bought', 'tsg-num'), th('Sold', 'tsg-num tsg-c-sold'), th('Holding', 'tsg-num tsg-c-holdv'),
          th('Profit', 'tsg-num'), th('Return', 'tsg-num tsg-c-ret'))),
        trBody)));
  const hBody = el('tbody');
  const holdersPane = el('div', { class: 'tsg-pane', hidden: true },
    el('div', { class: 'tsg-tablewrap', tabIndex: 0, role: 'region', 'aria-label': 'Holders' },
      el('table', { class: 'tsg-table is-holders' },
        el('caption', { class: 'tsg-sr' }, 'Its holders, the biggest first'),
        el('thead', {}, el('tr', {}, th('Rank'), th('Holder'), th('% supply', 'tsg-num'), th('Amount', 'tsg-num tsg-c-amt'),
          th('Value', 'tsg-num tsg-c-holdv'), th('Profit', 'tsg-num'))),
        hBody)));
  const devDl = el('dl', { class: 'tsg-rows' });
  const devNote = el('p', { class: 'tsg-note' });
  const devPane = el('div', { class: 'tsg-pane', hidden: true }, devDl, devNote);
  const posBox = el('div', { class: 'tsg-posbox' });
  const ordList = el('ul', { class: 'tsg-ordlist', 'aria-label': 'Your orders on it' });
  const ordersPane = el('div', { class: 'tsg-pane', hidden: true }, posBox, el('h3', { class: 'tsg-box-t' }, 'Orders'), ordList);
  const panes = { activity: actPane, traders: tradersPane, holders: holdersPane, dev: devPane, orders: ordersPane };

  // ---------- the trade module ----------
  const sideBtns = [['buy', 'Buy'], ['sell', 'Sell']].map(([s, label]) => el('button', { class: ['tsg-side', `is-${s}`], type: 'button',
    data: { side: s }, 'aria-pressed': String(s === C.side), on: { click: () => setSide(s) } }, label));
  const otBtns = [['market', 'Market'], ['limit', 'Limit'], ['dca', 'DCA'], ['auto', 'Auto']].map(([o, label]) => el('button', { class: 'tsg-otype', type: 'button',
    data: { o }, 'aria-pressed': String(o === C.otype), on: { click: () => setOtype(o) } }, label));
  const holdLine = el('p', { class: 'tsg-holdline' });
  const trigIn = el('input', { class: 'tsg-amt', type: 'text', inputMode: 'decimal', autocomplete: 'off', spellcheck: 'false',
    placeholder: '0', 'aria-label': 'Trigger: the market cap in dollars' });
  const trigNow = el('span', { class: 'tsg-trig-now' });
  const trigBox = el('div', { class: 'tsg-trig', hidden: true },
    el('label', { class: 'tsg-amtbox' }, el('span', { class: 'tsg-amt-pre' }, 'MC $'), trigIn), trigNow);
  const amountIn = el('input', { class: 'tsg-amt', type: 'text', inputMode: 'decimal', autocomplete: 'off', spellcheck: 'false',
    placeholder: '0.0', 'aria-label': 'Amount' });
  const unitEl = el('span', { class: 'tsg-unit' }, isUsd ? 'USD' : U.name);
  const amtBox = el('label', { class: 'tsg-amtbox' }, amountIn, unitEl);
  const presets = el('div', { class: 'tsg-presets' });
  const dcaCount = el('input', { class: 'tsg-amt is-sm', type: 'number', min: '2', max: '20', step: '1', value: '3', 'aria-label': 'DCA number of buys' });
  const dcaEvery = el('input', { class: 'tsg-amt is-sm', type: 'number', min: '2', max: '3600', step: '1', value: '10', 'aria-label': 'DCA seconds between buys' });
  const dcaBox = el('div', { class: 'tsg-dca', hidden: true }, el('label', {}, 'Buys', dcaCount), el('label', {}, 'Every (seconds)', dcaEvery));
  const tpAt = el('input', { class: 'tsg-amt is-sm', type: 'text', inputMode: 'decimal', value: '100', 'aria-label': 'Take profit at, percent up' });
  const tpFrac = el('input', { class: 'tsg-amt is-sm', type: 'text', inputMode: 'decimal', value: '50', 'aria-label': 'Take profit: sell this many percent' });
  const slAt = el('input', { class: 'tsg-amt is-sm', type: 'text', inputMode: 'decimal', value: '50', 'aria-label': 'Stop loss at, percent down' });
  const slFrac = el('input', { class: 'tsg-amt is-sm', type: 'text', inputMode: 'decimal', value: '100', 'aria-label': 'Stop loss: sell this many percent' });
  const autoNow = el('p', { class: 'tsg-note' });
  const autoBox = el('div', { class: 'tsg-auto', hidden: true },
    el('p', { class: 'tsg-autorow' }, el('span', { class: 'is-up' }, 'Take profit'), ' at +', tpAt, '% sell ', tpFrac, '%'),
    el('p', { class: 'tsg-autorow' }, el('span', { class: 'is-down' }, 'Stop loss'), ' at −', slAt, '% sell ', slFrac, '%'),
    autoNow);
  const pBtns = [0, 1, 2].map((i) => el('button', { class: 'tsg-pbtn', type: 'button', data: { i }, on: { click: () => {
    ctx.pickPreset(i);
    renderPresetRow();
    quote();
  } } }, `P${i + 1}`));
  const pWords = el('span', { class: 'tsg-pwords' });
  const pGear = el('button', { class: 'tsg-pgear', type: 'button', 'aria-label': 'Change the presets', on: { click: () => kit.openSettings() } },
    icon('sliders', 'ts-icon'));
  const presetRow = el('div', { class: 'tsg-prow' }, el('div', { class: 'tsg-pbtns', role: 'group', 'aria-label': 'Presets' }, pBtns), pWords, pGear);
  const quoteBox = el('p', { class: 'tsg-quote' });
  const placeBtn = el('button', { class: 'tsg-place', type: 'button', on: { click: () => place() } }, 'Buy');
  const errBox = el('p', { class: 'tsg-err', role: 'alert' });
  const tradePanel = el('div', { class: 'tsg-trade', data: { side: C.side } },
    el('div', { class: 'tsg-sides', role: 'group', 'aria-label': 'Buy or sell' }, sideBtns),
    el('div', { class: 'tsg-otypes', role: 'group', 'aria-label': 'Order type' }, otBtns),
    holdLine, trigBox, amtBox, presets, dcaBox, autoBox, presetRow, quoteBox, placeBtn, errBox);
  amountIn.addEventListener('input', () => {
    setText(errBox, '');
    quote();
  });
  dcaCount.addEventListener('input', quote); dcaEvery.addEventListener('input', quote);
  trigIn.addEventListener('input', () => {
    setText(errBox, '');
    quote();
  });
  for (const n of [amountIn, trigIn]) {
    n.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        place();
      }
    });
  }

  // ---------- the right column's boxes ----------
  const posSlot = el('section', { class: 'tsg-box is-pos', hidden: true },
    el('div', { class: 'tsg-box-h' }, el('h3', { class: 'tsg-box-t' }, 'Your position')), el('div', { class: 'tsg-box-b' }));
  const secList = el('ul', { class: 'tsg-sec' });
  const secSum = el('span', { class: 'tsg-box-v' });
  const secNote = el('p', { class: 'tsg-note', hidden: true }, 'A real coin\'s checks aren\'t known here: every one is “—”, never a guess.');
  const secBox = el('section', { class: 'tsg-box' },
    el('div', { class: 'tsg-box-h' }, el('h3', { class: 'tsg-box-t' }, 'Security'), secSum), el('div', { class: 'tsg-box-b' }, secList, secNote));
  const poolDl = el('dl', { class: 'tsg-rows' });
  const poolBox = el('section', { class: 'tsg-box' },
    el('div', { class: 'tsg-box-h' }, el('h3', { class: 'tsg-box-t' }, 'Pool info')), el('div', { class: 'tsg-box-b' }, poolDl));
  const firstGrid = el('div', { class: 'tsg-first', role: 'img', 'aria-label': 'Its first 70 buyers' });
  const firstSum = el('dl', { class: 'tsg-rows is-first' });
  const firstNote = el('p', { class: 'tsg-note' });
  const firstLegend = el('ul', { class: 'tsg-first-l' }, FIRST_STATES.map(([k, label]) => el('li', {}, el('i', { class: `is-${k}` }), label)));
  const firstBox = el('section', { class: 'tsg-box' },
    el('div', { class: 'tsg-box-h' }, el('h3', { class: 'tsg-box-t' }, 'First 70 buyers')),
    el('div', { class: 'tsg-box-b' }, firstGrid, firstLegend, firstSum, firstNote));
  const tradeSlot = el('div', { class: 'tsg-tradeslot' }, tradePanel);
  const flowValues = { volume: el('b'), buys: el('b'), sells: el('b') };
  const flowSummary = el('section', { class: 'tsg-market-summary' }, chChanges,
    el('dl', { class: 'tsg-flow-summary' }, [['volume', 'Vol (5m)'], ['buys', 'Buys'], ['sells', 'Sells']].map(([key, label]) =>
      el('div', {}, el('dt', {}, label), el('dd', {}, flowValues[key])))));
  const mobileChanges = el('div', { class: 'tsg-mobile-changes' });
  const headlineNumbers = el('dl', { class: 'tsg-headline-numbers' }, st.mc.parentElement, st.price.parentElement);
  const coinR = el('div', { class: 'tsg-coin-r' }, flowSummary, tradeSlot, posSlot,
    el('section', { class: 'tsg-overview' }, chStats), secBox, poolBox, firstBox);
  const coinL = el('div', { class: 'tsg-coin-l' },
    el('div', { class: 'tsg-coinbar' }, backBtn),
    el('div', { class: 'tsg-ch' }, chPic, el('div', { class: 'tsg-ch-t' }, chName,
      el('div', { class: 'tsg-ch-chips' }, el('span', { class: 'tsg-chipx' }, icon('clock', 'ts-icon tsg-chip-ic'), chAge), chReal, chFrom, chCa, chSocs, chTags)), headlineNumbers),
    mobileChanges, curveBox, chartBox,
    el('div', { class: 'tsg-tabs', role: 'group', 'aria-label': 'Coin details' }, tabBtns),
    el('div', { class: 'tsg-panes' }, actPane, tradersPane, holdersPane, devPane, ordersPane));
  // phones: Buy and Sell under the coin, opening the trade module as a sheet
  const buyBarB = el('button', { class: 'tsg-barbtn is-buy', type: 'button', on: { click: () => openSheet('buy') } }, 'Buy');
  const buyBarS = el('button', { class: 'tsg-barbtn is-sell', type: 'button', on: { click: () => openSheet('sell') } }, 'Sell');
  const buyBar = el('div', { class: 'tsg-buybar' }, buyBarB, buyBarS);
  const sheetT = el('h2', { class: 'tsg-sheet-t' }, 'Trade');
  const sheet = el('dialog', { class: 'tsg-sheet is-trade', 'aria-label': 'Trade' },
    el('div', { class: 'tsg-sheet-head' }, sheetT,
      el('button', { class: 'tsg-x', type: 'button', 'aria-label': 'Close', on: { click: () => sheet.close() } }, icon('close'))));
  sheet.addEventListener('close', () => tradeSlot.append(tradePanel));
  sheet.addEventListener('click', (e) => {
    if (e.target === sheet) sheet.close();
  });
  const root = el('section', { class: 'tsg-view tsg-coinview', hidden: true, 'aria-label': 'Coin', data: { tab: C.tab } },
    el('div', { class: 'tsg-coin' }, coinL, coinR), buyBar, sheet);

  // ---------- switches ----------
  function setTab(id) {
    const want = id === 'info' && !phone.matches ? 'activity' : id;
    C.tab = want;
    root.dataset.tab = want;
    for (const b of tabBtns) b.setAttribute('aria-pressed', String(b.dataset.tab === want));
    for (const [k, p] of Object.entries(panes)) p.hidden = k !== want;
    if (C.id !== null) slow();
  }
  function setSide(s) {
    // DCA is buy-only. A phone's persistent Sell action can enter this ticket even
    // while its desktop DCA tab was selected, so normalize the order type first.
    if (s === 'sell' && C.otype === 'dca') setOtype('market');
    C.side = s;
    for (const b of sideBtns) b.setAttribute('aria-pressed', String(b.dataset.side === s));
    tradePanel.dataset.side = s;
    amountIn.value = '';
    setText(errBox, '');
    renderPresets();
    syncTrade();
  }
  function setOtype(o) {
    C.otype = o;
    if (o === 'dca' && C.side !== 'buy') setSide('buy');
    for (const b of otBtns) b.setAttribute('aria-pressed', String(b.dataset.o === o));
    setText(errBox, '');
    syncTrade();
  }
  // which of the module's parts show, its button's words, its quote
  function syncTrade() {
    const auto = C.otype === 'auto';
    trigBox.hidden = C.otype !== 'limit';
    amtBox.hidden = auto;
    presets.hidden = auto;
    autoBox.hidden = !auto;
    dcaBox.hidden = C.otype !== 'dca';
    sideBtns.forEach((b) => {
      b.disabled = auto || C.otype === 'dca' && b.dataset.side === 'sell';
    });
    const r = C.id !== null ? market.row(C.id) : null;
    const tk = r ? `$${r.ticker}` : '';
    const play = r && r.live ? ' · play money' : '';
    if (auto) setText(placeBtn, `Set auto${tk ? ` on ${tk}` : ''}${play}`);
    else if (C.otype === 'limit') setText(placeBtn, `Place ${C.side === 'buy' ? 'buy' : 'sell'} limit${play}`);
    else if (C.otype === 'dca') setText(placeBtn, `Start DCA buy${play}`);
    else setText(placeBtn, `${C.side === 'buy' ? 'Buy' : 'Sell'} ${tk}${play}`.trim());
    renderPresetRow();
    quote();
  }
  function renderPresets() {
    if (C.side === 'buy') {
      setText(unitEl, isUsd ? 'USD' : U.name);
      amountIn.setAttribute('aria-label', isUsd ? 'Amount in dollars' : `Amount in ${U.name}`);
      const vals = buyPresets(ctx.start).map((v) => (isUsd ? Math.round(v * px) : U.id === 'sol' ? v : nice(v * U.per)));
      presets.replaceChildren(...vals.map((v) => el('button', { type: 'button', class: 'tsg-pre', 'aria-label': isUsd ? `$${v}` : `${v} ${U.name}`,
        on: { click: () => setAmount(String(v)) } }, isUsd ? `$${v}` : String(v))));
    } else {
      setText(unitEl, '%');
      amountIn.setAttribute('aria-label', 'How much of it to sell, in percent');
      presets.replaceChildren(...[25, 50, 75, 100].map((v) => el('button', { type: 'button', class: 'tsg-pre', on: { click: () => setAmount(String(v)) } }, `${v}%`)),
        el('button', { type: 'button', class: 'tsg-pre is-init', title: 'Sell enough to get back what is still in it', on: { click: () => takeInitial() } }, 'Take my initial'));
    }
  }
  function renderPresetRow() {
    if (typeof ctx.presets !== 'function') return;
    const { preset, list } = ctx.presets();
    pBtns.forEach((b, i) => {
      b.setAttribute('aria-pressed', String(i === preset));
      b.setAttribute('aria-label', `Preset ${i + 1}: ${share(list[i].slippage, 0)} slippage, ${list[i].priority}`);
    });
    const p = list[preset];
    setText(pWords, `${share(p.slippage, 0)} · ${p.priority} · ${M(PRIORITY[p.priority].fee)}`);
  }
  function setAmount(v) {
    amountIn.value = v;
    setText(errBox, '');
    quote();
    if (!coarse.matches) amountIn.focus();
  }
  const posOf = (id) => (market.positions() || []).find((p) => p.id === id) || null;
  function takeInitial() {
    if (C.id === null) return;
    const p = posOf(C.id);
    const s = ctx.settings();
    const f = initialFrac(p, (frac) => {
      const q = market.quote({ coin: C.id, side: 'sell', frac, slippage: s.slippage, priority: s.priority });
      return q && q.ok ? q.got : 0;
    });
    if (f === null) {
      setText(errBox, p && p.open ? 'Nothing to take back yet: selling all of it wouldn\'t get back what you put in.' : 'You don\'t hold any of it.');
      return;
    }
    setAmount(String(Math.min(100, Math.ceil(f * 1000) / 10)));
  }
  function ask() {
    const v = parseAmount(amountIn.value);
    if (C.id === null || !(v > 0)) return null;
    const s = ctx.settings();
    if (C.side === 'buy') return { coin: C.id, side: 'buy', sol: v / U.per, slippage: s.slippage, priority: s.priority };
    if (v > 100) return { bad: true };
    return { coin: C.id, side: 'sell', frac: v / 100, slippage: s.slippage, priority: s.priority };
  }
  function quote() {
    if (C.id === null) return;
    const r = market.row(C.id);
    if (C.otype === 'auto') return quoteAuto();
    if (C.otype === 'dca') {
      const order = makeScannerDca({ coin: C.id, sol: parseAmount(amountIn.value) / U.per, count: Number(dcaCount.value), interval: Number(dcaEvery.value), now: market.t });
      return setText(quoteBox, order ? `${order.count} buys of ${M(order.sol)}, every ${order.interval}s. Total ${M(order.total)} plus fees. Stops if a slice cannot be placed.` : 'Enter a total amount, 2–20 buys, and an interval of 2–3,600 seconds.');
    }
    if (C.otype === 'limit') {
      const t = parseAmount(trigIn.value);
      setText(trigNow, r ? `now ${mc(r.mc)}` : '');
      if (!(t > 0)) return setText(quoteBox, 'Set the market cap that triggers it.');
      const mcSol = t / px;
      const dir = r && mcSol < r.mc ? 'down' : 'up';
      const name = limitName({ side: C.side, dir });
      return setText(quoteBox, `${name}: when the market cap ${dir === 'down' ? 'falls' : 'rises'} to ${usd(t)}, a market order goes in.`);
    }
    const a = ask();
    if (!a) return setText(quoteBox, '');
    if (a.bad) return setText(quoteBox, 'At most 100%.');
    const q = market.quote(a);
    if (!q.ok) return setText(quoteBox, orderError(q.error));
    const fees = q.fees.terminal + q.fees.market + q.fees.network;
    if (a.side === 'buy') {
      return setText(quoteBox, `≈ ${tokens(q.tokens)} $${r ? r.ticker : ''} · impact ${share(Math.max(0, q.impact))} · fees ${M(fees)}${q.enough ? '' : ` · not enough ${U.name}`}`);
    }
    return setText(quoteBox, `≈ ${M(q.got)} · impact ${share(Math.max(0, -q.impact))} · fees ${M(fees)}`);
  }
  function quoteAuto() {
    const a = limits.autoOf(C.id);
    const p = posOf(C.id);
    if (!p || !p.open) {
      setText(autoNow, 'Auto sells work on coins you hold: buy first.');
      return setText(quoteBox, '');
    }
    const words = (leg, up) => (leg ? `${up ? 'take profit' : 'stop loss'} at ${up ? '+' : '−'}${Math.round(Math.abs(leg.at) * 100)}% (sell ${share(leg.frac, 0)})${leg.done ? ', done' : ''}` : '');
    setText(autoNow, a ? `On now: ${[words(a.tp, true), words(a.sl, false)].filter(Boolean).join(' · ')}.` : 'None set on this coin.');
    const e = entryMcOf(p);
    return setText(quoteBox, e ? `Your average entry: ${mc(e)} market cap.` : '');
  }
  function place() {
    if (C.id === null) return;
    const r = market.row(C.id);
    if (C.otype === 'dca') {
      const o = makeScannerDca({ coin: C.id, sol: parseAmount(amountIn.value) / U.per, count: Number(dcaCount.value), interval: Number(dcaEvery.value), now: market.t });
      if (!o) return setText(errBox, `Each buy must be at least ${M(.001)}. Use 2–20 buys and a 2–3,600 second interval.`);
      if (o.total > market.player.sol) return setText(errBox, 'Not enough balance for that total amount.');
      limits.add(o); setText(errBox, ''); amountIn.value = ''; toast(`DCA set: ${o.count} buys of $${r.ticker}`, 'up');
      renderOrders(); return quote();
    }
    if (C.otype === 'auto') {
      const p = posOf(C.id);
      if (!p || !p.open) return setText(errBox, 'Buy first: auto sells work on coins you hold.');
      const up = parseAmount(tpAt.value);
      const dn = parseAmount(slAt.value);
      const tf = parseAmount(tpFrac.value);
      const sf = parseAmount(slFrac.value);
      const tp = up > 0 && tf > 0 && tf <= 100 ? { at: up / 100, frac: tf / 100 } : null;
      const sl = dn > 0 && dn < 100 && sf > 0 && sf <= 100 ? { at: -dn / 100, frac: sf / 100 } : null;
      if (!tp && !sl) return setText(errBox, 'Set a take profit, a stop loss, or both (sell 1% to 100%).');
      limits.setAuto(C.id, { tp, sl });
      setText(errBox, '');
      toast(`Auto set on $${r.ticker}`, 'up');
      renderOrders();
      return quote();
    }
    if (C.otype === 'limit') {
      const t = parseAmount(trigIn.value);
      const v = parseAmount(amountIn.value);
      if (!(t > 0)) return setText(errBox, 'Set the market cap that triggers it.');
      if (!(v > 0)) return setText(errBox, C.side === 'buy' ? 'Type how much to buy.' : 'Pick how much to sell.');
      if (C.side === 'sell' && v > 100) return setText(errBox, 'At most 100%.');
      if (C.side === 'sell' && !(posOf(C.id) || {}).open) return setText(errBox, 'You don\'t hold any of it.');
      const o = makeLimit({ coin: C.id, side: C.side, mc: t / px, sol: C.side === 'buy' ? v / U.per : null,
        frac: C.side === 'sell' ? v / 100 : null, mcNow: r.mc });
      if (!o) return setText(errBox, 'Check the amount and the trigger.');
      limits.add(o);
      setText(errBox, '');
      toast(`${limitName(o)} set: $${r.ticker} at ${usd(t)} market cap`, 'up');
      amountIn.value = '';
      renderOrders();
      return quote();
    }
    const a = ask();
    if (!a) return setText(errBox, C.side === 'buy' ? 'Type how much to buy.' : 'Pick how much to sell.');
    if (a.bad) return setText(errBox, 'At most 100%.');
    const res = ctx.order({ coin: a.coin, side: a.side, sol: a.sol, frac: a.frac });
    if (!res || !res.ok) return setText(errBox, orderError(res && res.error) || 'That didn\'t go through.');
    setText(errBox, '');
    if (sheet.open) sheet.close();
    return undefined;
  }
  function openSheet(side) {
    if (C.id === null || sheet.open) return;
    if (C.otype === 'auto') setOtype('market');
    setSide(side);
    const r = market.row(C.id);
    const t = r ? `${side === 'buy' ? 'Buy' : 'Sell'} $${r.ticker}` : 'Trade';
    setText(sheetT, t);
    sheet.setAttribute('aria-label', t);
    sheet.append(tradePanel);
    sheet.showModal();
    if (!coarse.matches) amountIn.focus();
  }

  // ---------- drawing it ----------
  function renderHead(s, f) {
    if (!samePic(chPic.firstElementChild, s)) chPic.replaceChildren(pic(market.row(s.id) || s, 'is-ch', 'tsg'));
    setText(chTk, s.ticker);
    setText(chFull, s.name);
    setText(chAge, ago(s.age));
    chReal.hidden = !s.live;
    chFrom.hidden = !s.live;
    if (s.live) setText(chFrom, fromWords(s));
    // a contract's first characters only (never its end)
    setText(chCa, f && typeof f.mint === 'string' ? `CA ${f.mint.slice(0, 6)}…` : 'CA —');
    setText(st.price, `$${tinyPrice(s.priceUsd, 4)}`);
    setText(st.mc, mc(s.mc));
    setText(st.liq, usd(s.liq * px));
    setText(st.hold, num(s.holders));
    setText(st.vol, usd(s.vol * px));
    setText(st.top10, s.top10 === null ? '—' : share(s.top10, 1));
    setText(st.ath, mc(s.ath));
    for (const [k, v] of [['1m', s.change1m], ['5m', s.change5m], ['1h', s.change1h]]) {
      setText(chg[k], pct(v));
      tone(chg[k], v, 0.0005);
    }
    curveBox.hidden = s.phase === 'pool';
    if (s.phase === 'migrating') setText(curveT, 'Bonding curve sold out: migrating to its pool');
    else if (s.phase === 'curve') {
      setText(curveT, s.live && s.src !== 'pump.fun' ? `Bonding curve ${share(s.progress, 0)}, as its source says`
        : `Bonding curve ${share(s.progress, 0)} · ${tokens(CURVE_TOK * (1 - s.progress))} left · migrates at ${usd(GRAD_MC * px)}`);
    }
    setP(curveBar, s.phase === 'curve' ? s.progress : 1);
    flag(curveBar, 'is-mig', s.phase === 'migrating');
    const keys = [s.rugged && ['Rugged', 'is-bad'], s.cto && ['CTO', ''], s.dexPaid && ['DEX paid', 'is-info'], s.koth && ['King', 'is-warn'],
      s.phase === 'pool' && ['Migrated', 'is-good'], market.row(s.id) && market.row(s.id).standIn && ['Simulated', ''],
      s.live && s.tracked === false && ['Not live', 'is-warn']].filter(Boolean);
    const key = keys.map((k) => k[0]).join('|');
    if (key !== C.tagKey) {
      C.tagKey = key;
      chTags.replaceChildren(...keys.map(([w, c]) => el('span', { class: ['tsg-tag', c] }, w)));
    }
    const soc = s.socials || {};
    const sk = SOCIALS.map(([k]) => (soc[k] ? 1 : 0)).join('');
    if (sk !== C.socKey) {
      C.socKey = sk;
      const on = SOCIALS.filter(([k]) => soc[k]);
      chSocs.replaceChildren(...(on.length ? on.map(([, label]) => el('span', { class: 'tsg-chipx' }, label))
        : [el('span', { class: 'tsg-chipx is-off' }, 'No socials')]));
    }
    setText(tabN, num(s.holders));
    const label = `Chart of $${s.ticker}: market cap ${mc(s.mc)}, ${pct(s.change5m)} in 5 minutes`;
    if (plot.getAttribute('aria-label') !== label) plot.setAttribute('aria-label', label);
  }
  function renderChart(s) {
    const id = C.id;
    const D = C.cd;
    if (D.id !== id || D.v !== s.cdv) {
      D.id = id;
      D.v = s.cdv;
      D.arr = market.candles(id) || [];
    } else {
      const last = D.arr.length ? D.arr[D.arr.length - 1].t : null;
      const more = last === null ? market.candles(id) || [] : market.candles(id, last) || [];
      if (more.length) {
        if (last !== null && more[0].t === last) D.arr.pop();
        for (const x of more) D.arr.push(x);
        if (D.arr.length > 5000) D.arr.splice(0, D.arr.length - 4000);
      }
    }
    const marks = C.marks ? market.orders(120).filter((o) => o.coin === id && o.status === 'filled').map((o) => ({ t: o.doneAt, side: o.side })) : [];
    chart.set({ candles: D.arr, solUsd: px, marks, tf: C.tf, migratedAt: s.migratedAt, base: clockBase });
  }
  function renderHoldLine(s) {
    const me = s.me;
    const holding = Boolean(me && me.tokens > 0);
    const tk = `$${s.ticker}`;
    if (C.side === 'sell') setText(holdLine, holding ? `You hold ${tokens(me.tokens)} ${tk} · ${M(me.value)}` : `You don't hold any ${tk}`);
    else setText(holdLine, `Balance ${M(market.player.sol)}${holding ? ` · ${tokens(me.tokens)} ${tk}` : ''}`);
    const off = s.phase === 'migrating' && C.otype === 'market';
    flag(placeBtn, 'is-off', off);
    if (placeBtn.getAttribute('aria-disabled') !== String(off)) placeBtn.setAttribute('aria-disabled', String(off));
  }
  function renderPosition() {
    const p = posOf(C.id);
    const body = posSlot.lastChild;
    posSlot.hidden = !p;
    const fill = (host) => {
      if (!p) {
        host.replaceChildren(el('p', { class: 'tsg-note' }, 'You haven\'t traded it yet.'));
        return;
      }
      const e = entryMcOf(p);
      const v = pnlOf(p);
      const rows = [['Balance', p.open ? `${tokens(p.tokens)} · ${M(p.value)}` : 'Sold'], ['Avg entry', e ? `${mc(e)} MC` : '—'],
        ['Invested', M(p.invested)], ['Sold', M(p.sold)], ['Profit', `${MS(p.total)} (${pct(v.pct)})`]];
      const want = rows.map((r) => r.join('=')).join('|');
      if (host.dataset.k === want) return;
      host.dataset.k = want;
      const pnlDd = el('dd', {}, rows[4][1]);
      tone(pnlDd, p.total, 1e-9);
      host.replaceChildren(el('dl', { class: 'tsg-rows' }, rows.slice(0, 4).map(([k, val]) => el('div', {}, el('dt', {}, k), el('dd', {}, val))),
        el('div', {}, el('dt', {}, 'Profit'), pnlDd)),
      el('button', { class: 'tsg-btn is-share', type: 'button', on: { click: () => kit.shareCard(posOf(C.id) || p) } },
        icon('share', 'ts-icon'), 'PnL card'));
    };
    fill(body);
    if (C.tab === 'orders') fill(posBox);
  }
  function renderActivity() {
    const id = C.id;
    const s = kit.statsOf(id);
    const all = market.trades(id, 80) || [];
    const h = market.holders(id, 100);
    const labels = s && s.live ? all.map(() => '') : activityLabels(all, h ? h.list : [], Boolean(h && h.count <= h.list.length));
    const seen = new Map();
    const items = [];
    all.forEach((t, i) => {
      if (!makerOk(t, C.maker)) return;
      const k = `${t.t}|${t.side}|${t.tok}|${t.addr || t.label}`;
      const n = (seen.get(k) || 0) + 1;
      seen.set(k, n);
      items.push({ ...t, lab: labels[i], key: n > 1 ? `${k}#${n}` : k });
    });
    if (!items.length) items.push({ key: 'empty', empty: true });
    keyed(actBody, items.slice(0, 50), (t) => t.key, (t) => {
      if (t.empty) return el('tr', { class: 'tsg-emptyrow' }, el('td', { colSpan: 6 }, C.maker === 'all' ? 'No trades yet' : 'No trades from them yet'));
      const smart = t.label === 'smart' ? kit.smartIndexOf(t.addr) : null;
      const canOpen = Boolean(t.kol) || smart !== null;
      const name = t.me ? 'You' : t.kol ? `@${t.kol}` : t.addr ? short(t.addr) : 'a trader';
      const tag = t.me ? '' : makerTag(t.kol ? 'kol' : t.label);
      const maker = el(canOpen ? 'button' : 'span', { class: 'tsg-maker', type: canOpen ? 'button' : null,
        on: canOpen ? { click: () => kit.openWallet(t.kol ? 'kol' : 'smart', t.kol || smart) } : null },
      el('span', { class: 'tsg-maker-n' }, name), tag ? el('span', { class: ['tsg-tag', t.label === 'smart' && 'is-good', t.label === 'dev' && 'is-warn'] }, tag) : null,
      t.lab ? el('span', { class: ['tsg-lab', /^(Sell All)$/.test(t.lab) && 'is-down', t.lab === 'New Holder' && 'is-up'] }, t.lab) : null);
      return el('tr', { class: [t.side === 'buy' ? 'is-buy' : 'is-sell', t.me && 'is-me'] },
        el('td', { class: 'tsg-when' }),
        el('td', { class: ['tsg-type', t.side === 'buy' ? 'is-up' : 'is-down'] }, t.side === 'buy' ? 'Buy' : 'Sell'),
        el('td', { class: 'tsg-num' }, MN(t.sol)), el('td', { class: 'tsg-num tsg-c-amt' }, tokens(t.tok)),
        el('td', { class: 'tsg-num tsg-c-mc' }, mc(t.mc)), el('td', {}, maker));
    }, (tr, t) => {
      if (!t.empty) setText(tr.firstChild, age(market.t - t.t));
    });
  }
  function renderTraders(s) {
    const h = market.holders(C.id, 100);
    const list = s.live || !h ? [] : topTraders(h.list, s.price).slice(0, 30);
    const items = list.length ? list : [{ addr: 'empty', empty: true, note: s.live ? 'Other traders aren\'t followed for live coins.' : 'No traders yet' }];
    keyed(trBody, items, (x) => x.addr, (x) => {
      if (x.empty) return el('tr', { class: 'tsg-emptyrow' }, el('td', { colSpan: 7 }, x.note));
      const smart = x.label === 'smart' ? kit.smartIndexOf(x.addr) : null;
      const canOpen = Boolean(x.kol) || smart !== null;
      const tag = x.me ? '' : makerTag(x.kol ? 'kol' : x.label);
      const who = el(canOpen ? 'button' : 'span', { class: 'tsg-maker', type: canOpen ? 'button' : null,
        on: canOpen ? { click: () => kit.openWallet(x.kol ? 'kol' : 'smart', x.kol || smart) } : null },
      el('span', { class: 'tsg-maker-n' }, x.me ? 'You' : x.kol ? `@${x.kol}` : short(x.addr)), tag ? el('span', { class: 'tsg-tag' }, tag) : null);
      const tr = el('tr', { class: x.me ? 'is-me' : '' });
      tr.$ = { rank: el('td', {}), inn: el('td', { class: 'tsg-num' }), out: el('td', { class: 'tsg-num tsg-c-sold' }),
        val: el('td', { class: 'tsg-num tsg-c-holdv' }), pnl: el('td', { class: 'tsg-num' }), ret: el('td', { class: 'tsg-num tsg-c-ret' }) };
      tr.append(tr.$.rank, el('td', {}, who), tr.$.inn, tr.$.out, tr.$.val, tr.$.pnl, tr.$.ret);
      return tr;
    }, (tr, x) => {
      if (x.empty) return;
      setText(tr.$.rank, String(list.indexOf(x) + 1));
      setText(tr.$.inn, MN(x.in));
      setText(tr.$.out, MN(x.out));
      setText(tr.$.val, MN(x.value));
      setText(tr.$.pnl, MS(x.pnl));
      tone(tr.$.pnl, x.pnl, 1e-9);
      setText(tr.$.ret, x.pct === null ? '—' : pct(x.pct));
      tone(tr.$.ret, x.pct || 0, 0.0005);
    });
  }
  function renderHolders(s) {
    const h = market.holders(C.id, 50);
    if (!h) return;
    const items = [];
    if (h.pool && h.pool.pct > 0) {
      items.push({ key: 'pool', pool: true, name: h.pool.kind === 'pool' ? 'Liquidity pool' : 'Bonding curve', pct: h.pool.pct, tok: h.pool.tok });
    }
    h.list.forEach((x) => {
      const value = x.tok * s.price;
      items.push({ key: x.addr, rank: x.rank, name: x.me ? 'You' : x.kol ? `@${x.kol}` : short(x.addr), tag: x.me ? '' : makerTag(x.kol ? 'kol' : x.label),
        pct: x.pct, tok: x.tok, me: x.me, value, pnl: (x.out || 0) + value - (x.in || 0) });
    });
    if (s.live) items.push({ key: 'note', empty: true, note: 'Other holders aren\'t followed for live coins.' });
    if (!items.length) items.push({ key: 'empty', empty: true, note: 'No holders yet' });
    keyed(hBody, items, (x) => x.key, (x) => {
      if (x.empty) return el('tr', { class: 'tsg-emptyrow' }, el('td', { colSpan: 6 }, x.note));
      const bar = el('span', { class: 'tsg-hbar', 'aria-hidden': 'true' }, el('i'));
      const tr = el('tr', {});
      tr.$ = { rank: el('td', {}), name: el('span', { class: 'tsg-maker-n' }), tag: el('span', { class: 'tsg-tag', hidden: true }),
        pct: el('span', {}), bar, amt: el('td', { class: 'tsg-num tsg-c-amt' }), val: el('td', { class: 'tsg-num tsg-c-holdv' }), pnl: el('td', { class: 'tsg-num' }) };
      tr.append(tr.$.rank, el('td', {}, el('span', { class: 'tsg-maker' }, tr.$.name, tr.$.tag)), el('td', { class: 'tsg-num' }, tr.$.pct, bar),
        tr.$.amt, tr.$.val, tr.$.pnl);
      return tr;
    }, (tr, x) => {
      if (x.empty) return;
      const $ = tr.$;
      flag(tr, 'is-pool', Boolean(x.pool));
      flag(tr, 'is-me', Boolean(x.me));
      setText($.rank, x.pool ? '—' : `TOP${x.rank}`);
      setText($.name, x.name);
      $.tag.hidden = !x.tag;
      setText($.tag, x.tag || '');
      setText($.pct, share(x.pct));
      setP($.bar, Math.min(1, x.pct / 0.2));
      setText($.amt, tokens(x.tok));
      setText($.val, x.pool ? '—' : MN(x.value));
      setText($.pnl, x.pool ? '—' : MS(x.pnl));
      tone($.pnl, x.pool ? 0 : x.pnl, 1e-9);
    });
  }
  function renderDev(s, f) {
    const rows = s.live
      ? [['Creator', f.devAddr ? short(f.devAddr) : '—'], ['Dev holds', '—'], ['Dev sold', '—'], ['Coins before', '—'], ['Migrated', '—']]
      : [['Creator', `${f.dev} · ${short(f.devAddr)}`], ['Dev holds', share(s.dev)], ['Dev sold', share(s.devSold, 0)],
        ['Coins before', num(f.devCoins)], ['Migrated', num(f.devMigrated)]];
    keyed(devDl, rows, (r) => r[0], (r) => {
      const dd = el('dd', {});
      const d = el('div', {}, el('dt', {}, r[0]), dd);
      d.$dd = dd;
      return d;
    }, (d, r) => setText(d.$dd, r[1]));
    setText(devNote, s.live ? 'A real coin\'s dev isn\'t followed here: only its creator\'s address, shortened.'
      : `Its dev launched ${num(f.devCoins)} coin${f.devCoins === 1 ? '' : 's'} before this one; ${num(f.devMigrated)} migrated.`);
  }
  function renderOrders() {
    const id = C.id;
    if (id === null) return;
    const pend = (market.orders(60) || []).filter((o) => o.coin === id && o.status === 'pending')
      .map((o) => ({ key: `p${o.id}`, text: o.side === 'buy' ? `Buying ${M(o.sol)}…` : `Selling ${share(o.frac, 0)}…`, kind: 'pending' }));
    const lims = limits.of(id).map((o) => ({ key: `l${o.id}`, text: o.kind === 'dca'
      ? `DCA: ${o.remaining}/${o.count} buys left · ${M(o.sol)} every ${o.interval}s`
      : `${limitName(o)} at ${mc(o.mc)} MC: ${o.side === 'buy' ? M(o.sol) : `sell ${share(o.frac, 0)}`}`,
      kind: 'limit', cancel: () => limits.cancel(o.id) }));
    const a = limits.autoOf(id);
    const autos = a ? [{ key: 'auto', text: `Auto: ${[a.tp && `take profit at +${Math.round(a.tp.at * 100)}% (sell ${share(a.tp.frac, 0)})${a.tp.done ? ' ✓' : ''}`,
      a.sl && `stop loss at −${Math.round(-a.sl.at * 100)}% (sell ${share(a.sl.frac, 0)})${a.sl.done ? ' ✓' : ''}`].filter(Boolean).join(' · ')}`,
    kind: 'auto', cancel: () => limits.setAuto(id, null) }] : [];
    const items = [...pend, ...lims, ...autos];
    const list = items.length ? items : [{ key: 'none', text: 'No orders on it. Limit and Auto orders stay until they fill or the run ends.', kind: 'none' }];
    keyed(ordList, list, (x) => x.key, (x) => el('li', { class: ['tsg-ord', `is-${x.kind}`] },
      x.kind === 'pending' ? el('span', { class: 'tsg-spin', 'aria-hidden': 'true' }) : null, el('span', {}, x.text),
      x.cancel ? el('button', { class: 'tsg-mini', type: 'button', on: { click: () => {
        x.cancel();
        renderOrders();
        quote();
      } } }, 'Cancel') : null), (li, x) => setText(li.querySelector('span:not(.tsg-spin)'), x.text));
  }
  function renderBoxes(s, f) {
    // security
    const checks = securityChecks(s);
    keyed(secList, checks, (c) => c.k, (c) => {
      const mark = el('span', { class: 'tsg-sec-m', 'aria-hidden': 'true' });
      const v = el('span', { class: 'tsg-sec-v' });
      const sr = el('span', { class: 'tsg-sr' });
      const li = el('li', {}, mark, el('span', { class: 'tsg-sec-k' }, c.label), v, sr);
      li.$ = { mark, v, sr };
      return li;
    }, (li, c) => {
      setText(li.$.mark, STATE_MARK[c.state]);
      setText(li.$.v, c.value);
      setText(li.$.sr, `: ${STATE_WORD[c.state]}`);
      for (const k of ['ok', 'warn', 'bad', 'na']) flag(li, `is-${k}`, c.state === k);
    });
    const good = checks.filter((c) => c.state === 'ok').length;
    setText(secSum, s.live ? '—' : `${good}/${checks.length}`);
    secNote.hidden = !s.live;
    // its pool
    const rows = [['Pair', s.pair || (U.id !== 'sol' && U.id !== 'usd' ? U.name : 'SOL')], [s.phase === 'pool' ? 'Liquidity' : 'In the curve', usd(s.liq * px)],
      ['Market cap', mc(s.mc)], ['Supply', tokens(SUPPLY)], ['Created', ago(s.age)], ['Creator', f.devAddr ? short(f.devAddr) : '—'],
      ['Contract', typeof f.mint === 'string' ? `${f.mint.slice(0, 6)}…` : '—'],
      ['Status', s.phase === 'pool' ? `Migrated${Number.isFinite(s.migratedAt) ? ` ${ago(market.t - s.migratedAt)}` : ''}` : s.phase === 'migrating' ? 'Migrating' : `Bonding curve ${share(s.progress, 0)}`]];
    keyed(poolDl, rows, (r) => r[0], (r) => {
      const dt = el('dt', {});
      const dd = el('dd', {});
      const d = el('div', {}, dt, dd);
      d.$ = { dt, dd };
      return d;
    }, (d, r) => {
      setText(d.$.dt, r[0]);
      setText(d.$.dd, r[1]);
    });
    // its first buyers
    const fb = market.firstBuyers ? market.firstBuyers(C.id) : null;
    const sum = firstSummary(fb);
    if (!fb) {
      firstGrid.replaceChildren();
      firstGrid.hidden = true;
      firstSum.replaceChildren();
      setText(firstNote, s.live ? 'A real coin\'s first buyers aren\'t followed here.' : '—');
      return;
    }
    firstGrid.hidden = false;
    const cells = Array.from({ length: 70 }, (_, i) => fb.list[i] || { n: i + 1, status: 'empty' });
    keyed(firstGrid, cells, (x) => x.n, () => el('i', {}), (n, x) => {
      const cls = `tsg-fb is-${x.status}${x.me ? ' is-me' : ''}`;
      if (n.className !== cls) n.className = cls;
    });
    firstGrid.setAttribute('aria-label', `Its first ${sum.count} buyers: ${sum.states.hold} hold, ${sum.states.more} bought more, ${sum.states.part} sold part, ${sum.states.all} sold all`);
    const sumRows = [['Bought', share(sum.got)], ['Holding now', share(sum.holdNow)], ['Snipers / insiders', `${num(sum.snipers)} / ${num(sum.insiders)}`]];
    keyed(firstSum, sumRows, (r) => r[0], (r) => {
      const dd = el('dd', {});
      const d = el('div', {}, el('dt', {}, r[0]), dd);
      d.$dd = dd;
      return d;
    }, (d, r) => setText(d.$dd, r[1]));
    setText(firstNote, sum.count ? `Of the first ${sum.count}: ${sum.states.hold} hold, ${sum.states.more} bought more, ${sum.states.part} sold part, ${sum.states.all} sold all.` : 'No buyers yet.');
  }

  // the fast parts (its numbers, chart, trade module) and the slow ones (its tabs and boxes)
  function fast(force) {
    if (C.id === null) return;
    const s = market.stats(C.id);
    if (!s) return;
    renderHead(s, info(C.id));
    const flow = scannerFlow(s);
    setText(flowValues.volume, Number.isFinite(s.vol5m) ? usd(s.vol5m * px) : '—');
    setText(flowValues.buys, num(flow.buys)); setText(flowValues.sells, num(flow.sells));
    renderChart(s);
    renderHoldLine(s);
    if (force || amountIn.value || C.otype !== 'market') quote();
  }
  function slow() {
    if (C.id === null) return;
    const s = kit.statsOf(C.id);
    const f = info(C.id);
    if (!s || !f) return;
    if (C.tab === 'activity') renderActivity();
    else if (C.tab === 'traders') renderTraders(s);
    else if (C.tab === 'holders') renderHolders(s);
    else if (C.tab === 'dev') renderDev(s, f);
    else if (C.tab === 'orders') renderOrders();
    renderPosition();
    if (!phone.matches || C.tab === 'info') renderBoxes(s, f);
  }

  renderPresets();
  syncToggles();
  syncTrade();
  const moveChanges = (on) => (on ? mobileChanges : flowSummary).prepend(chChanges);
  moveChanges(phone.matches);

  return {
    el: root,
    open(id) {
      const changed = C.id !== id;
      C.id = id;
      root.hidden = false;
      if (changed) {
        C.cd = { id: null, arr: [], v: null };
        C.tagKey = null;
        C.socKey = null;
        actBody.replaceChildren();
        trBody.replaceChildren();
        hBody.replaceChildren();
        firstGrid.replaceChildren();
        posSlot.lastChild.dataset.k = '';
        chPic.replaceChildren(pic(market.row(id), 'is-ch', 'tsg'));
        amountIn.value = '';
        trigIn.value = '';
        setSide('buy');
        if (C.otype !== 'market') setOtype('market');
        if (typeof ctx.onCoin === 'function') ctx.onCoin(id);
      }
      syncTrade();
      fast(true);
      slow();
      renderOrders();
      chName.focus({ preventScroll: true });
    },
    close() {
      if (C.id === null) return;
      if (sheet.open) sheet.close();
      C.id = null;
      root.hidden = true;
      if (typeof ctx.onCoin === 'function') ctx.onCoin(null);
    },
    isOpen: () => C.id !== null,
    fast,
    slow,
    // a setting changed (a preset, the chart's view)
    refresh() {
      syncToggles();
      renderPresetRow();
      quote();
    },
    onPhone(on) {
      moveChanges(on);
      if (on) return;
      if (sheet.open) sheet.close();
      if (C.tab === 'info') setTab('activity');
    },
    destroy() {
      C.dead = true;
      chart.destroy();
      if (sheet.open) sheet.close();
    },
  };
}
