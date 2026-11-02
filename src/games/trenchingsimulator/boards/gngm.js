// TRENCHING SIMULATOR's GNGM (2026-10-22, the owner: "the next terminal you doing is gmgn, i want it the literally exact
// same interface, the settings, the pnl card, the kols the chart design, the smoothness of it no lag … use a parody
// names, parody logo, parody branding"): our scanner terminal, laid out and working the way trenchers know that kind of
// web terminal, under our own name, mark (a sleepy pixel toad in a nightcap: ../brands.js), colors (terminals.js 'scan')
// and words. Its top bar: Trenches · Trending · Track · Holding, the search ("/"), the market it plays, the balance, its
// settings. Trenches: three live columns (New, Almost bonded, Migrated), each with its quick-buy amount, its filter (safe,
// smart money, strict) and a pause while the mouse is over it; cards full of numbers (holders, top 10, the dev, snipers,
// insiders, smart money, KOLs, market cap, volume, trades) and a quick-buy button; hotkeys when they're on (hold Z over a
// column and press a row's number, or hold Space, then a column's number and a row's). Trending (1m, 5m, 1h); Track (the
// KOLs', smart money's and whales' trades as they happen); Holding (the player's coins, each with its PnL card); a coin's
// page (./gngm-coin.js); a wallet's page (a smart wallet's week and run, a KOL's calls); its settings (presets P1 to P3,
// the chart's view, hotkeys, the player's optional name). Phones: a tab bar, the columns as tabs, Buy and Sell under a
// coin. Smooth: rows keyed (kept and updated in place, never rebuilt), words written only when they change, the fast
// parts every 250 ms and the lists every 650 ms.
//
// mountGngm(host, ctx) → { el, update(now), sub(), closeSub(), openCoin(id), destroy() }: boards/board.js's doors. ctx is
// board.js's (run, market, currency, solUsd, start, settings(), order(p), openSettings(), pushSub(), popSub(),
// reduceMotion, colors, onCoin(id)) and GNGM's own: chain (the run's live chain, or null), presets() → { preset, list },
// pickPreset(i), setPreset(i, { slippage, priority }), chartView() → { mode, unit }, setChartView(v), playerName(),
// setPlayerName(raw) → { ok, name }, saveCard(words) (the shell shares or downloads a PnL card). Live mode: what isn't
// known about a real coin is "—" (never made up), its address only its first 6 characters, and never a link anywhere.
// Everything is made with createElement and set as text; styles only through classes and the CSS object model.
import { el, setText, flag, keyed, icon, toast } from '../ui.js';
import { markEl, wordEl } from '../brands.js';
import { usd, money, moneySigned, pct, share, age, tokens, currencyOf, unitOf, nice } from '../format.js';
import { MIN_BUY, PRIORITY } from '../engine.js';
import { SLIPPAGES, PRIORITIES } from '../save.js';
import { chainById } from '../live-chains.js';
import { kolById } from '../names.js';
import { ORDER_ERRORS, buyPresets, parseAmount, num, ago, short, hueOf, initial, setP, tone, pic, samePic,
  fromWords, waitingForRealCoins } from './common.js';
import { cardMetrics, passes, riskOf, FILTERS, trackItems, TRACK_FILTERS, smartProfile, kolProfile, DIST_LABELS, limitHit,
  limitName, autoHit, entryMcOf, pnlOf } from './gngm-data.js';
import { positionCardWords } from './gngm-card.js';
import { tradeShareText } from '../share.js';
import { mountCoin } from './gngm-coin.js';
import { createAddressSearch } from '../live-search.js';
import { scannerRows, toggleScannerItem, scannerFlow, stepScannerDca } from './gngm-workspace.js';
import './gngm.css';

const FAST_MS = 250;
const SLOW_MS = 650;
const COL_MAX = 30;
const VIEWS = Object.freeze([['trenches', 'Trenches'], ['trending', 'Trending'], ['callout', 'Callout'], ['monitor', 'Monitor'], ['track', 'Track'], ['holding', 'Portfolio']]);
const COLS = Object.freeze([['new', 'New'], ['stretch', 'Almost bonded'], ['migrated', 'Migrated']]);
const WINS = Object.freeze([['1m', '1m'], ['5m', '5m'], ['1h', '1h']]);
const DIST_TONES = Object.freeze(['is-up', 'is-up', 'is-up', 'is-down', 'is-down']);

export function mountGngm(host, ctx) {
  const { market } = ctx;
  const cur = currencyOf(ctx.currency);
  const px = ctx.solUsd;
  const U = unitOf(cur, px);
  const isUsd = U.id === 'usd';
  const M = (x) => money(x, cur, px);
  const MN = (x) => money(x, cur, px, { unit: false });
  const MS = (x) => moneySigned(x, cur, px);
  const mc = (x) => usd(x * px);
  const orderError = (code) => (code === 'min_buy' ? `The smallest buy is ${M(MIN_BUY)}.`
    : typeof ORDER_ERRORS[code] === 'string' ? ORDER_ERRORS[code].replace(/\bSOL\b/g, U.name) : '');
  const quiet = { matches: false, addEventListener() {}, removeEventListener() {} };
  const mq = (q) => (typeof matchMedia === 'function' ? matchMedia(q) : quiet);
  const phone = mq('(max-width: 719px)');
  const coarse = mq('(pointer: coarse)');
  // an amount in the run's money, as people type it (a quick buy's: SOL, dollars, or the chain's coin)
  const shown = (sol) => (isUsd ? Math.round(sol * px) : U.id === 'sol' ? sol : nice(sol * U.per));
  const qbStart = String(shown(buyPresets(ctx.start)[1]));
  const G = {
    view: 'trenches', sub: null, dead: false, fastAt: 0, slowAt: 0, col: 'new', hot: false, hoverPause: true,
    keys: { z: false, space: false, col: null, over: null }, filter: { new: 'all', stretch: 'all', migrated: 'all' },
    qb: { new: qbStart, stretch: qbStart, migrated: qbStart }, win: '5m', track: 'all', wallet: null, wtab: 'holdings',
    wrange: 'week', limits: [], limitSeq: 0, autos: new Map(), stats: new Map(), infos: new Map(), smartN: null, query: '',
    watched: new Set(), hidden: new Set(), showHidden: false, keywords: { new: '', stretch: '', migrated: '' },
    rail: true, railTab: 'picks',
  };
  const info = (id) => {
    let x = G.infos.get(id);
    if (!x) {
      x = market.info(id);
      if (x) G.infos.set(id, x);
    }
    return x;
  };
  // a coin's stats, once a list update (cleared every slow tick)
  const statsOf = (id) => {
    if (G.stats.has(id)) return G.stats.get(id);
    const s = market.stats(id);
    G.stats.set(id, s);
    return s;
  };
  // which smart wallet an address is (the same 28 everywhere)
  const smartIndexOf = (addr) => {
    if (!G.smartN) G.smartN = new Map(market.smartWallets().map((w) => [w.addr, w.n]));
    return G.smartN.has(addr) ? G.smartN.get(addr) : null;
  };
  const scrollTop = () => {
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') window.scrollTo(0, 0);
  };

  // ---------- quick buys ----------
  function quickBuy(id, colId, btn) {
    const v = parseAmount(G.qb[colId] || G.qb.new);
    const r = market.row(id);
    if (!r) return;
    if (!(v > 0)) {
      toast(`Set a quick-buy amount first (in ${U.name}).`, 'down');
      return;
    }
    const res = ctx.order({ coin: id, side: 'buy', sol: v / U.per });
    if (!res || !res.ok) {
      toast(orderError(res && res.error) || 'That didn\'t go through.', 'down');
      return;
    }
    toast(`Buying ${isUsd ? usd(v) : `${v} ${U.name}`} of $${r.ticker}${r.live ? ' · play money' : ''}…`, '', 1400);
    if (btn && !ctx.reduceMotion) {
      btn.classList.remove('is-sent');
      void btn.offsetWidth;
      btn.classList.add('is-sent');
    }
  }
  const qbLabel = (colId) => {
    const v = parseAmount(G.qb[colId]);
    return v > 0 ? (isUsd ? `$${v}` : String(v)) : '—';
  };

  // ---------- the top bar ----------
  const navBtns = VIEWS.map(([id, label]) => el('button', { class: 'tsg-navb', type: 'button', data: { view: id },
    'aria-pressed': String(id === G.view), on: { click: () => setView(id) } }, label));
  const searchIn = el('input', { class: 'tsg-search-in', type: 'search', placeholder: 'Search coin / ticker / CA',
    'aria-label': 'Search coins by name, ticker or address', autocomplete: 'off', spellcheck: 'false', enterKeyHint: 'search' });
  const found = el('div', { class: 'tsg-found', hidden: true, role: 'list', 'aria-label': 'Search results' });
  let searchTimer = 0;
  const addressSearch = createAddressSearch(market, () => { if (!G.dead && G.query) runSearch(); });
  const searchForm = el('form', { class: 'tsg-search', role: 'search', on: {
    submit: (e) => {
      e.preventDefault();
      clearTimeout(searchTimer);
      runSearch();
      const first = found.querySelector('.tsg-found-b');
      if (first) first.click();
    },
  } }, icon('search', 'ts-icon tsg-search-ic'), searchIn, el('kbd', { class: 'tsg-kbd', 'aria-hidden': 'true' }, '/'), found);
  searchIn.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(runSearch, 150);
  });
  searchIn.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (searchIn.value) {
        searchIn.value = '';
        runSearch();
      } else searchIn.blur();
    } else if (e.key === 'ArrowDown') {
      const first = found.querySelector('.tsg-found-b');
      if (first) {
        e.preventDefault();
        first.focus();
      }
    }
  });
  found.addEventListener('keydown', (e) => {
    const bs = [...found.querySelectorAll('.tsg-found-b')];
    const i = bs.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' && i >= 0 && i < bs.length - 1) {
      e.preventDefault();
      bs[i + 1].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (i > 0) bs[i - 1].focus();
      else searchIn.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      searchIn.focus();
    }
  });
  function runSearch() {
    G.query = searchIn.value.trim();
    const ids = G.query ? market.find(G.query).slice(0, 8) : [];
    const rows = ids.map((id) => market.row(id)).filter(Boolean);
    const lookupNote = addressSearch(G.query, rows.length > 0);
    found.hidden = !G.query;
    const items = rows.length ? rows : G.query ? [{ id: 'none', none: true, note: lookupNote || 'Nothing found.' }] : [];
    keyed(found, items, (r) => r.id, (r) => {
      if (r.none) return el('p', { class: 'tsg-found-none' }, r.note);
      const b = el('button', { class: 'tsg-found-b', type: 'button', on: { click: () => {
        searchIn.value = '';
        runSearch();
        openCoin(r.id);
      } } });
      b.$ = { pic: pic(r, 'is-xs', 'tsg'), tk: el('b'), nm: el('span', { class: 'tsg-found-nm' }), mc: el('span', { class: 'tsg-found-mc' }) };
      b.append(b.$.pic, b.$.tk, b.$.nm, b.$.mc);
      return b;
    }, (b, r) => {
      if (r.none) { setText(b, r.note); return; }
      setText(b.$.tk, `$${r.ticker}`);
      setText(b.$.nm, r.name);
      setText(b.$.mc, `${mc(r.mc)} · ${age(r.age)}`);
    });
  }
  searchIn.addEventListener('blur', () => {
    setTimeout(() => {
      if (!searchForm.contains(document.activeElement)) found.hidden = true;
    }, 150);
  });
  searchIn.addEventListener('focus', () => {
    if (G.query) found.hidden = false;
  });
  const liveChain = ctx.chain ? chainById(ctx.chain) : null;
  const chainPill = el('span', { class: ['tsg-chain', liveChain && 'is-live'], title: liveChain ? `${liveChain.name} live source` : 'Simulated market' }, el('i', { 'aria-hidden': 'true' }),
    liveChain ? liveChain.native || liveChain.name : 'SOL');
  const balN = el('b', { class: 'tsg-bal-n' }, '—');
  const balBtn = el('button', { class: 'tsg-bal', type: 'button', title: 'Your coins', on: { click: () => setView('holding') } },
    icon('bag', 'ts-icon tsg-bal-ic'), el('span', { class: 'tsg-sr' }, 'Balance '), balN, isUsd ? null : el('span', { class: 'tsg-bal-u' }, ` ${U.name}`));
  const gearBtn = el('button', { class: 'tsg-gear', type: 'button', 'aria-label': 'GNGM settings', on: { click: () => openGSettings() } },
    icon('sliders', 'ts-icon'));
  const head = el('header', { class: 'tsg-head' },
    el('button', { class: 'tsg-brand', type: 'button', 'aria-label': 'GNGM Trenches', on: { click: () => setView('trenches') } }, markEl('scan', 'tsg-logo'), wordEl('scan', 'tsg-brand-t')),
    el('nav', { class: 'tsg-nav', 'aria-label': 'GNGM' }, navBtns),
    searchForm, chainPill, balBtn, gearBtn);

  // ---------- Trenches: three live columns ----------
  const hotBtn = el('button', { class: 'tsg-hot', type: 'button', 'aria-pressed': 'false', title: 'Hotkeys: hold Z over a column and press a row\'s number to buy it; or hold Space, press a column\'s number, then a row\'s',
    on: { click: () => setHot(!G.hot) } }, icon('bolt', 'ts-icon tsg-hot-ic'), el('span', {}, 'Hotkeys'));
  const hotNote = el('p', { class: 'tsg-hotnote', hidden: true },
    'Hotkeys on: hold Z over a column and press 1 to 9 to quick-buy that row; or hold Space, press 1, 2 or 3 for a column, then a row.');
  const colTabs = COLS.map(([id, label]) => el('button', { class: 'tsg-coltab', type: 'button', data: { col: id },
    'aria-pressed': String(id === G.col), on: { click: () => setCol(id) } }, label));
  const cols = {};
  const colsEl = el('div', { class: 'tsg-cols', data: { col: G.col } });
  for (const [id, label] of COLS) {
    const count = el('span', { class: 'tsg-col-n' });
    const qbIn = el('input', { class: 'tsg-qb-in', type: 'text', inputMode: 'decimal', autocomplete: 'off', spellcheck: 'false',
      value: G.qb[id], 'aria-label': `Quick-buy amount for ${label}, in ${isUsd ? 'dollars' : U.name}` });
    qbIn.addEventListener('input', () => {
      G.qb[id] = qbIn.value;
      flag(qbIn, 'is-bad', !(parseAmount(qbIn.value) > 0));
      const t = qbLabel(id);
      for (const card of list.children) if (card.$) setText(card.$.qbv, t);
    });
    const filterSel = el('select', { class: 'tsg-filter', 'aria-label': `Filter ${label}` },
      FILTERS.map(([v, l]) => el('option', { value: v }, l)));
    filterSel.addEventListener('change', () => {
      G.filter[id] = filterSel.value;
      renderTrenches(market.lists({ limit: COL_MAX }), true);
    });
    const paused = el('span', { class: 'tsg-paused', hidden: true }, 'Paused');
    const keyword = el('input', { class: 'tsg-col-query', type: 'search', placeholder: 'Keyword1, Keyword2…',
      'aria-label': `${label} keywords`, autocomplete: 'off', spellcheck: 'false', on: { input: (e) => {
        G.keywords[id] = e.target.value; renderTrenches(market.lists({ limit: COL_MAX }), true);
      } } });
    const colPresets = [0, 1, 2].map((i) => el('button', { class: 'tsg-col-preset', type: 'button',
      'aria-label': `${label} preset ${i + 1}`, data: { preset: i }, on: { click: () => {
        ctx.pickPreset(i); syncColumnPresets(); coin.refresh();
      } } }, `P${i + 1}`));
    const list = el('div', { class: 'tsg-list', role: 'list', 'aria-label': label });
    const empty = el('p', { class: 'tsg-empty', hidden: true });
    const keyNo = el('span', { class: 'tsg-colkey', 'aria-hidden': 'true' }, String(COLS.findIndex(([c]) => c === id) + 1));
    const colEl = el('section', { class: 'tsg-col', data: { col: id }, 'aria-label': label },
      el('div', { class: 'tsg-col-head' }, keyNo, el('h2', { class: 'tsg-col-t' }, label, ' ', count),
        keyword,
        el('label', { class: 'tsg-qb', title: 'Quick-buy amount' }, icon('bolt', 'ts-icon tsg-qb-ic'), qbIn,
          isUsd ? null : el('span', { class: 'tsg-qb-u' }, U.name)),
        el('div', { class: 'tsg-col-presets', role: 'group', 'aria-label': `${label} presets` }, colPresets), filterSel, paused),
      list, empty);
    const C = { id, label, el: colEl, list, count, paused, empty, hover: false, colPresets };
    list.addEventListener('pointerenter', (e) => {
      G.keys.over = id;
      if (e.pointerType !== 'mouse') return;
      C.hover = true;
      paused.hidden = !G.hoverPause;
    });
    list.addEventListener('pointerleave', () => {
      if (G.keys.over === id) G.keys.over = null;
      C.hover = false;
      paused.hidden = true;
      showKeys();
    });
    cols[id] = C;
    colsEl.append(colEl);
  }
  const hiddenBtn = el('button', { class: 'tsg-tool', type: 'button', 'aria-pressed': 'false', 'aria-label': 'Show hidden tokens', on: { click: () => {
    G.showHidden = !G.showHidden; hiddenBtn.setAttribute('aria-pressed', String(G.showHidden));
    renderTrenches(market.lists({ limit: COL_MAX }), true);
  } } }, '◉');
  const trenchesView = el('section', { class: 'tsg-view tsg-trenches', 'aria-label': 'Trenches' },
    el('div', { class: 'tsg-bar tsg-trenches-bar' }, el('h2', { class: 'tsg-h' }, '🪖 Trenches'),
      el('span', { class: 'tsg-chain-tag' }, liveChain ? liveChain.name : 'SOL'),
      el('div', { class: 'tsg-trench-tools' }, el('button', { class: 'tsg-tool', type: 'button', on: { click: openGSettings } }, '☷ Customize'), hiddenBtn, hotBtn)),
    el('div', { class: 'tsg-coltabs', role: 'group', 'aria-label': 'Column' }, colTabs),
    hotNote, colsEl);
  function syncColumnPresets() {
    const selected = typeof ctx.presets === 'function' ? ctx.presets().preset : 0;
    for (const c of Object.values(cols)) for (const b of c.colPresets) b.setAttribute('aria-pressed', String(Number(b.dataset.preset) === selected));
  }

  function setCol(id) {
    G.col = id;
    colsEl.dataset.col = id;
    for (const b of colTabs) b.setAttribute('aria-pressed', String(b.dataset.col === id));
  }
  function setHot(on) {
    G.hot = on;
    hotBtn.setAttribute('aria-pressed', String(on));
    flag(hotBtn, 'is-on', on);
    hotNote.hidden = !on;
    if (!on) {
      G.keys.z = false;
      G.keys.space = false;
      G.keys.col = null;
    }
    showKeys();
  }

  const MET = [['h', 'H', 'Holders'], ['t10', 'T10', 'Top 10 holders'], ['dev', 'DEV', 'Dev holds'],
    ['sn', 'SN', 'Snipers'], ['in', 'IN', 'Insiders'], ['sm', 'SM', 'Smart money holding'], ['kol', 'KOL', 'KOLs holding']];
  function makeCard(r, colId) {
    const $ = {
      ring: el('span', { class: 'tsg-ring', 'aria-hidden': 'true' }), pic: pic(r, 'is-card', 'tsg'), tk: el('b', { class: 'tsg-tk' }),
      nm: el('span', { class: 'tsg-nm' }), age: el('span', { class: 'tsg-age' }), socs: el('span', { class: 'tsg-socs' }),
      tags: el('span', { class: 'tsg-tags' }), mcv: el('b', { class: 'tsg-mcv' }), vol: el('span', { class: 'tsg-c-v' }),
      tx: el('span', { class: 'tsg-c-tx' }), prog: el('span', { class: 'tsg-c-prog' }), qbv: el('span', { class: 'tsg-qbv' }),
      ca: el('span', { class: 'tsg-card-ca' }), fee: el('span', { class: 'tsg-card-fee' }), pair: el('span', { class: 'tsg-card-pair' }),
      people: el('span', { class: 'tsg-card-people' }), flow: el('i'),
      met: {}, socKey: null, tagKey: null, label: '',
    };
    $.ring.append($.pic);
    const mets = MET.map(([k, short2, long]) => {
      const v = el('span', { class: 'tsg-m-v' });
      $.met[k] = v;
      return el('span', { class: 'tsg-m', title: long }, el('span', { class: 'tsg-m-k' }, short2), v);
    });
    const open = el('button', { class: 'tsg-card-open', type: 'button', on: { click: () => openCoin(r.id) } },
      el('span', { class: 'tsg-card-media' }, $.ring, $.ca),
      el('span', { class: 'tsg-card-txt' },
        el('span', { class: 'tsg-c-top' }, $.tk, $.nm),
        el('span', { class: 'tsg-card-fees' }, $.fee, $.pair),
        el('span', { class: 'tsg-card-meta' }, $.age, $.socs, $.people), $.tags,
        el('span', { class: 'tsg-c-mets' }, mets),
        el('span', { class: 'tsg-c-low' }, el('span', { class: 'tsg-c-mc' }, el('span', { class: 'tsg-c-l' }, 'MC'), $.mcv), $.vol, $.tx,
          el('span', { class: 'tsg-card-flow' }, $.flow), $.prog)));
    const qb = el('button', { class: 'tsg-qbtn', type: 'button', on: { click: () => quickBuy(r.id, colId, qb) } },
      icon('bolt', 'ts-icon tsg-qbtn-ic'), $.qbv);
    qb.addEventListener('animationend', () => qb.classList.remove('is-sent'));
    const star = el('button', { class: 'tsg-card-star', type: 'button', 'aria-label': `Watch ${r.ticker}`, on: { click: () => {
      toggleScannerItem(G.watched, r.id); updateCard(n, market.row(r.id) || r, colId); renderRail();
    } } }, '☆');
    const hide = el('button', { class: 'tsg-card-hide', type: 'button', 'aria-label': `Hide ${r.ticker}`, on: { click: () => {
      toggleScannerItem(G.hidden, r.id); renderTrenches(market.lists({ limit: COL_MAX }), true);
    } } }, '×');
    const n = el('div', { class: 'tsg-card', role: 'listitem' }, open, qb, star, hide);
    $.star = star; $.hide = hide;
    n.$ = $;
    n.$open = open;
    n.$qb = qb;
    return n;
  }
  const metText = (x, kind) => (x === null ? '—' : kind === 'n' ? num(x) : share(x, x < 0.1 ? 1 : 0));
  function updateCard(n, r, colId) {
    const $ = n.$;
    if (!samePic($.pic, r)) {
      const next = pic(r, 'is-card', 'tsg');
      $.pic.replaceWith(next);
      $.pic = next;
    }
    const s = statsOf(r.id);
    const m = cardMetrics(r, s);
    setText($.tk, r.ticker);
    setText($.nm, r.name);
    const detail = info(r.id);
    setText($.ca, detail && detail.mint ? short(detail.mint, 4) : '—');
    setText($.fee, `Fee ${share(market.config.terminalFee, 2)}`);
    setText($.pair, liveChain ? U.name : 'SOL');
    setText($.people, `♙ ${num(m.holders)}  ◉ ${num(m.smart)}`);
    setText($.star, G.watched.has(r.id) ? '★' : '☆');
    $.star.setAttribute('aria-pressed', String(G.watched.has(r.id)));
    $.hide.setAttribute('aria-label', `${G.hidden.has(r.id) ? 'Unhide' : 'Hide'} ${r.ticker}`);
    setText($.age, age(r.age));
    setP($.ring, r.phase === 'curve' ? r.progress : 1);
    flag($.ring, 'is-done', r.phase === 'pool');
    const set = (k, x, kind, risk) => {
      setText($.met[k], metText(x, kind));
      const lv = risk ? riskOf(risk, x) : 'na';
      flag($.met[k].parentNode, 'is-warn', lv === 'warn');
      flag($.met[k].parentNode, 'is-bad', lv === 'bad');
      flag($.met[k].parentNode, 'is-good', (k === 'sm' || k === 'kol') && x > 0);
    };
    set('h', m.holders, 'n');
    set('t10', m.top10, 'p', 'top10');
    set('dev', m.dev, 'p', 'dev');
    set('sn', m.snipers, 'p', 'snipers');
    set('in', m.insiders, 'p', 'insiders');
    set('sm', m.smart, 'n');
    set('kol', m.kols, 'n');
    setText($.mcv, mc(r.mc));
    setText($.vol, `V ${usd(r.vol * px)}`);
    setText($.tx, `TX ${num(r.txns)}`);
    const flow = scannerFlow(s); setP($.flow, flow.fraction ?? .5); flag($.flow.parentNode, 'is-unknown', flow.fraction === null);
    setText($.prog, r.phase === 'pool' ? (Number.isFinite(r.migratedAt) ? `Migrated ${ago(market.t - r.migratedAt)}` : 'Migrated')
      : r.phase === 'migrating' ? 'Migrating' : share(r.progress, 0));
    setText($.qbv, qbLabel(colId));
    const soc = r.socials || {};
    const sk = `${soc.x ? 1 : 0}${soc.tg ? 1 : 0}${soc.web ? 1 : 0}`;
    if (sk !== $.socKey) {
      $.socKey = sk;
      $.socs.replaceChildren(...[['x', 'X'], ['tg', 'TG'], ['web', 'W']].filter(([k]) => soc[k])
        .map(([, l]) => el('span', { class: 'tsg-soc' }, l)));
    }
    const tags = [r.rugged && ['Rugged', 'is-bad'], r.cto && ['CTO', ''], r.dexPaid && ['DEX', 'is-info'],
      r.standIn && ['Sim', ''], r.live && !r.practice && r.tracked === false && ['Not live', 'is-warn'], r.live && ['Real', 'is-real']].filter(Boolean);
    const tk = tags.map((t) => t[0]).join('|');
    if (tk !== $.tagKey) {
      $.tagKey = tk;
      $.tags.replaceChildren(...tags.map(([w, c]) => el('span', { class: ['tsg-tag', c] }, w)));
    }
    flag(n, 'is-rugged', r.rugged);
    const label = `${r.name}, $${r.ticker}${r.live ? `, a real coin ${fromWords(r)}` : ''}, ${age(r.age)} old, market cap ${mc(r.mc)}, volume ${usd(r.vol * px)}${m.holders !== null ? `, ${num(m.holders)} holders` : ''}${m.top10 !== null ? `, top 10 hold ${share(m.top10, 0)}` : ''}${m.dev !== null ? `, dev holds ${share(m.dev, 1)}` : ''}${m.smart ? `, ${m.smart} smart wallets` : ''}${m.kols ? `, ${m.kols} KOLs` : ''}`;
    if (label !== $.label) {
      $.label = label;
      n.$open.setAttribute('aria-label', label);
      n.$qb.setAttribute('aria-label', `Quick-buy ${qbLabel(colId)} ${isUsd ? '' : U.name} of $${r.ticker}`.replace(/\s+/g, ' '));
    }
  }

  function renderTrenches(L, force = false) {
    for (const [id] of COLS) {
      const C = cols[id];
      // the mouse over it (or its hotkeys' numbers up): its order stays, its numbers still move
      const frozen = !force && ((C.hover && G.hoverPause) || G.keys.over === id && G.keys.z || (G.keys.space && G.keys.col === id));
      let rows;
      if (frozen) {
        rows = [...C.list.children].map((n) => market.row(Number(n.dataset.key))).filter(Boolean);
      } else {
        rows = scannerRows(L[id], { query: G.keywords[id], hidden: G.hidden, watched: G.watched, showHidden: G.showHidden })
          .filter((r) => G.filter[id] === 'all' || passes(cardMetrics(r, statsOf(r.id)), G.filter[id], px)).slice(0, COL_MAX);
      }
      keyed(C.list, rows, (r) => r.id, (r) => makeCard(r, id), (n, r) => updateCard(n, r, id));
      [...C.list.children].forEach((n, i) => {
        const k = i < 9 ? String(i + 1) : '';
        if (n.dataset.n !== k) n.dataset.n = k;
      });
      setText(C.count, String(rows.length));
      C.empty.hidden = rows.length > 0;
      setText(C.empty, waitingForRealCoins(market) ? 'Waiting for real coin listings…' : G.filter[id] !== 'all' ? 'Nothing passes this filter right now.'
        : id === 'migrated' ? 'Nothing has migrated yet.' : id === 'stretch' ? 'Nothing is close to bonding yet.' : 'Waiting for new coins…');
    }
  }

  // hotkeys: which column shows its rows' numbers
  function showKeys() {
    for (const [id] of COLS) {
      const C = cols[id];
      const on = G.hot && ((G.keys.z && G.keys.over === id) || (G.keys.space && G.keys.col === id));
      flag(C.el, 'is-keys', on);
      flag(C.el, 'is-pick', G.hot && G.keys.space && !G.keys.col);
    }
  }
  function quickBuyRow(colId, n) {
    const C = cols[colId];
    const card = C && C.list.children[n - 1];
    if (!card) return;
    quickBuy(Number(card.dataset.key), colId, card.$qb);
  }
  const onKey = (e) => {
    if (G.dead || !root.isConnected) return;
    const t = e.target;
    const typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || ''));
    const sheetOpen = Boolean(document.querySelector('dialog[open]'));
    if (e.type === 'keydown' && e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey && !e.defaultPrevented && !sheetOpen) {
      e.preventDefault();
      if (G.sub) closeSub();
      searchIn.focus();
      searchIn.select();
      return;
    }
    if (!G.hot || typing || sheetOpen || G.view !== 'trenches' || G.sub || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.type === 'keydown') {
      if (e.key === 'z' || e.key === 'Z') {
        G.keys.z = true;
        showKeys();
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        if (!G.keys.space) {
          G.keys.space = true;
          G.keys.col = null;
        }
        showKeys();
        return;
      }
      if (!/^[1-9]$/.test(e.key) || e.repeat) return;
      const d = Number(e.key);
      if (G.keys.z && G.keys.over) {
        e.preventDefault();
        quickBuyRow(G.keys.over, d);
      } else if (G.keys.space) {
        e.preventDefault();
        if (!G.keys.col) {
          if (d <= COLS.length) G.keys.col = COLS[d - 1][0];
          showKeys();
        } else quickBuyRow(G.keys.col, d);
      }
    } else if (e.type === 'keyup') {
      if (e.key === 'z' || e.key === 'Z') G.keys.z = false;
      if (e.key === ' ') {
        G.keys.space = false;
        G.keys.col = null;
      }
      showKeys();
    }
  };
  const onBlur = () => {
    G.keys.z = false;
    G.keys.space = false;
    G.keys.col = null;
    showKeys();
  };

  // ---------- Trending ----------
  const winBtns = WINS.map(([id, label]) => el('button', { class: 'tsg-seg-b', type: 'button', data: { win: id },
    'aria-pressed': String(id === G.win), on: { click: () => {
      G.win = id;
      for (const b of winBtns) b.setAttribute('aria-pressed', String(b.dataset.win === id));
      renderTrending(market.lists({ limit: COL_MAX }));
    } } }, label));
  const th = (t, cls) => el('th', { scope: 'col', class: cls }, t);
  const trendBody = el('tbody');
  const trendingView = el('section', { class: 'tsg-view tsg-trending', hidden: true, 'aria-label': 'Trending' },
    el('div', { class: 'tsg-bar' }, el('h2', { class: 'tsg-h' }, 'Trending'), el('div', { class: 'tsg-seg', role: 'group', 'aria-label': 'Time window' }, winBtns)),
    el('div', { class: 'tsg-tablewrap', tabIndex: 0, role: 'region', 'aria-label': 'Trending coins' },
      el('table', { class: 'tsg-table is-trending' },
        el('caption', { class: 'tsg-sr' }, 'Trending coins, the busiest first'),
        el('thead', {}, el('tr', {}, th('#', 'tsg-c-rank'), th('Token'), th('Age', 'tsg-num tsg-c-age'), th('Liq / MC', 'tsg-num'),
          th('Holders', 'tsg-num tsg-c-hold'), th('TXs', 'tsg-num tsg-c-txs'), th('Vol', 'tsg-num'), th('1m', 'tsg-num tsg-c-ch'),
          th('5m', 'tsg-num tsg-c-ch'), th('1h', 'tsg-num tsg-c-ch'), th(el('span', { class: 'tsg-sr' }, 'Quick buy'), 'tsg-c-qb'))),
        trendBody)));
  function renderTrending(L) {
    const seen = new Set();
    const pool = [];
    for (const r of [...(L.trending || []), ...(L.stretch || []), ...(L.migrated || []), ...(L.new || [])]) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      pool.push(r);
    }
    const volOf = (s) => (G.win === '1m' ? s.vol1m : G.win === '1h' ? s.vol1h : s.vol5m);
    const rows = pool.map((r) => ({ r, s: statsOf(r.id) })).filter((x) => x.s && volOf(x.s) > 0)
      .sort((a, b) => volOf(b.s) - volOf(a.s) || b.r.id - a.r.id).slice(0, COL_MAX);
    const items = rows.length ? rows : [{ empty: true }];
    keyed(trendBody, items, (x) => (x.empty ? 'empty' : x.r.id), (x) => {
      if (x.empty) return el('tr', { class: 'tsg-emptyrow' }, el('td', { colSpan: 11 }, 'Nothing is trading in this window yet.'));
      const tok = el('button', { class: 'tsg-tokcell', type: 'button', on: { click: () => openCoin(x.r.id) } });
      const qbb = el('button', { class: 'tsg-qbtn is-sm', type: 'button', on: { click: () => quickBuy(x.r.id, 'new', qbb) } },
        icon('bolt', 'ts-icon tsg-qbtn-ic'), el('span', { class: 'tsg-qbv' }));
      qbb.addEventListener('animationend', () => qbb.classList.remove('is-sent'));
      const tr = el('tr', {});
      tr.$ = { rank: el('td', { class: 'tsg-c-rank' }), tok, pic: null, age: el('td', { class: 'tsg-num tsg-c-age' }),
        liq: el('td', { class: 'tsg-num' }), hold: el('td', { class: 'tsg-num tsg-c-hold' }), txs: el('td', { class: 'tsg-num tsg-c-txs' }),
        vol: el('td', { class: 'tsg-num' }), c1: el('td', { class: 'tsg-num tsg-c-ch' }), c5: el('td', { class: 'tsg-num tsg-c-ch' }),
        c60: el('td', { class: 'tsg-num tsg-c-ch' }), qbb };
      tr.append(tr.$.rank, el('td', {}, tok), tr.$.age, tr.$.liq, tr.$.hold, tr.$.txs, tr.$.vol, tr.$.c1, tr.$.c5, tr.$.c60,
        el('td', { class: 'tsg-c-qb' }, qbb));
      return tr;
    }, (tr, x) => {
      if (x.empty) return;
      const { r, s } = x;
      const $ = tr.$;
      setText($.rank, String(rows.indexOf(x) + 1));
      if (!$.pic || !samePic($.pic, r)) {
        $.pic = pic(r, 'is-xs', 'tsg');
        $.tok.replaceChildren($.pic, el('b', {}, `$${r.ticker}`), el('span', { class: 'tsg-tok-nm' }, r.name));
      }
      setText($.age, age(r.age));
      setText($.liq, `${usd(s.liq * px)} / ${mc(s.mc)}`);
      setText($.hold, num(s.holders));
      setText($.txs, G.win === '5m' ? `${num(s.buys5m)} / ${num(s.sells5m)}` : num(G.win === '1h' ? s.txns1h : s.txns5m));
      setText($.vol, usd(((G.win === '1m' ? s.vol1m : G.win === '1h' ? s.vol1h : s.vol5m) || 0) * px));
      for (const [c, v] of [[$.c1, s.change1m], [$.c5, s.change5m], [$.c60, s.change1h]]) {
        setText(c, pct(v));
        tone(c, v, 0.0005);
      }
      setText($.qbb.lastChild, qbLabel('new'));
      $.qbb.setAttribute('aria-label', `Quick-buy $${r.ticker}`);
    });
  }

  // ---------- Track: KOLs, smart money and whales as they trade ----------
  const trackBtns = TRACK_FILTERS.map(([id, label]) => el('button', { class: 'tsg-chip', type: 'button', data: { f: id },
    'aria-pressed': String(id === G.track), on: { click: () => {
      G.track = id;
      for (const b of trackBtns) b.setAttribute('aria-pressed', String(b.dataset.f === id));
      renderTrack();
    } } }, label));
  const trackList = el('ol', { class: 'tsg-track-list', 'aria-label': 'Their trades, the newest first' });
  const trackView = el('section', { class: 'tsg-view tsg-track', hidden: true, 'aria-label': 'Track' },
    el('div', { class: 'tsg-bar' }, el('h2', { class: 'tsg-h' }, 'Track'), el('div', { class: 'tsg-chips', role: 'group', 'aria-label': 'Whose trades' }, trackBtns)),
    el('p', { class: 'tsg-note' }, 'The made-up KOLs\', smart wallets\' and whales\' trades as they happen. Learn who holds and who dumps on their followers.'),
    trackList);
  const whoName = (x) => (x.who === 'kol' ? `@${x.kol}` : x.who === 'smart' ? `Smart wallet ${x.smart + 1}` : 'A whale');
  function renderTrack() {
    const items = trackItems(market.feed(0), { filter: G.track, max: 60 });
    const list = items.length ? items : [{ q: 'empty', empty: true }];
    keyed(trackList, list, (x) => x.q, (x) => {
      if (x.empty) return el('li', { class: 'tsg-track-empty' }, 'No trades from them yet. They\'ll show up here as they happen.');
      const r = market.row(x.coin);
      const canOpen = x.who !== 'whale';
      const who = el(canOpen ? 'button' : 'span', { class: 'tsg-who', type: canOpen ? 'button' : null,
        on: canOpen ? { click: () => openWallet(x.who, x.who === 'kol' ? x.kol : x.smart) } : null },
      el('span', { class: 'tsg-av', vars: { '--h': hueOf(whoName(x)) }, 'aria-hidden': 'true' }, initial(x.who === 'kol' ? x.kol : x.who === 'smart' ? 'S' : 'W')),
      el('b', {}, whoName(x)), x.who === 'kol' && kolById(x.kol) ? el('span', { class: 'tsg-tag' }, 'KOL') : x.who === 'smart' ? el('span', { class: 'tsg-tag is-good' }, 'Smart') : el('span', { class: 'tsg-tag' }, 'Whale'));
      const coinB = el('button', { class: 'tsg-tokcell', type: 'button', on: { click: () => openCoin(x.coin) } },
        pic(r || {}, 'is-xs', 'tsg'), el('b', {}, `$${x.ticker || (r && r.ticker) || '?'}`));
      const when = el('span', { class: 'tsg-when' });
      const mcNow = el('span', { class: 'tsg-track-mc' });
      const qbb = el('button', { class: 'tsg-qbtn is-sm', type: 'button', 'aria-label': `Quick-buy $${x.ticker || '?'}`,
        on: { click: () => quickBuy(x.coin, 'new', qbb) } }, icon('bolt', 'ts-icon tsg-qbtn-ic'), el('span', { class: 'tsg-qbv' }, qbLabel('new')));
      qbb.addEventListener('animationend', () => qbb.classList.remove('is-sent'));
      const li = el('li', { class: ['tsg-track-row', x.side === 'buy' ? 'is-buy' : 'is-sell'] },
        when, who, el('span', { class: ['tsg-tside', x.side === 'buy' ? 'is-up' : 'is-down'] }, x.side === 'buy' ? 'Buy' : x.frac >= 0.999 ? 'Sell all' : 'Sell'),
        coinB, el('span', { class: 'tsg-track-amt' }, x.sol !== null ? M(x.sol) : x.frac !== null ? `${share(x.frac, 0)} of it` : '—'), mcNow, qbb);
      li.$ = { when, mcNow, qbb };
      return li;
    }, (li, x) => {
      if (x.empty) return;
      setText(li.$.when, age(market.t - x.t));
      const r = market.row(x.coin);
      setText(li.$.mcNow, r ? `MC ${mc(r.mc)}` : '');
      setText(li.$.qbb.lastChild, qbLabel('new'));
    });
  }

  // ---------- Holding: the player's coins ----------
  const holdSum = { bal: el('dd', {}, '—'), worth: el('dd', {}, '—'), pnl: el('dd', {}, '—'), open: el('dd', {}, '—') };
  const holdBody = el('tbody');
  const holdingView = el('section', { class: 'tsg-view tsg-holding', hidden: true, 'aria-label': 'Holding' },
    el('div', { class: 'tsg-bar' }, el('h2', { class: 'tsg-h' }, 'Holding')),
    el('dl', { class: 'tsg-sum' }, el('div', {}, el('dt', {}, 'Balance'), holdSum.bal), el('div', {}, el('dt', {}, 'Worth'), holdSum.worth),
      el('div', {}, el('dt', {}, 'Profit'), holdSum.pnl), el('div', {}, el('dt', {}, 'Open'), holdSum.open)),
    el('div', { class: 'tsg-tablewrap', tabIndex: 0, role: 'region', 'aria-label': 'Your coins' },
      el('table', { class: 'tsg-table is-holding' },
        el('caption', { class: 'tsg-sr' }, 'Your coins this run'),
        el('thead', {}, el('tr', {}, th('Token'), th('Balance', 'tsg-num tsg-c-bal'), th('Value', 'tsg-num'), th('Invested', 'tsg-num tsg-c-inv'),
          th('Profit', 'tsg-num'), th('Return', 'tsg-num tsg-c-ret'), th(el('span', { class: 'tsg-sr' }, 'Actions')))),
        holdBody)));
  function shareCard(p) {
    if (typeof ctx.saveCard !== 'function' || !p) return;
    const live = market.isExt(p.id);
    const v = pnlOf(p);
    ctx.saveCard(positionCardWords(p, { live, currency: cur, solUsd: px, name: typeof ctx.playerName === 'function' ? ctx.playerName() : null }),
      tradeShareText({ ticker: p.ticker, live, change: v ? v.pct : null }));
  }
  function sellPart(id, frac) {
    const res = ctx.order({ coin: id, side: 'sell', frac });
    if (!res || !res.ok) toast(orderError(res && res.error) || 'That didn\'t go through.', 'down');
  }
  function renderHolding() {
    const p = market.player;
    setText(holdSum.bal, M(p.sol));
    setText(holdSum.worth, M(p.worth));
    const start = market.startSol;
    setText(holdSum.pnl, MS(p.worth - start));
    tone(holdSum.pnl, p.worth - start, 1e-9);
    const pos = market.positions() || [];
    setText(holdSum.open, num(pos.filter((x) => x.open).length));
    const items = pos.length ? pos.slice().sort((a, b) => Number(b.open) - Number(a.open) || b.last - a.last).slice(0, 40)
      : [{ id: 'empty', empty: true }];
    keyed(holdBody, items, (x) => x.id, (x) => {
      if (x.empty) return el('tr', { class: 'tsg-emptyrow' }, el('td', { colSpan: 7 }, 'Nothing yet. Quick-buy a coin in the Trenches.'));
      const r = market.row(x.id);
      const tok = el('button', { class: 'tsg-tokcell', type: 'button', on: { click: () => openCoin(x.id) } },
        pic(r || x, 'is-xs', 'tsg'), el('b', {}, `$${x.ticker}`));
      const acts = el('div', { class: 'tsg-acts' },
        el('button', { class: 'tsg-mini', type: 'button', 'aria-label': `Sell half of $${x.ticker}`, on: { click: () => sellPart(x.id, 0.5) } }, '50%'),
        el('button', { class: 'tsg-mini', type: 'button', 'aria-label': `Sell all $${x.ticker}`, on: { click: () => sellPart(x.id, 1) } }, 'Sell all'),
        el('button', { class: 'tsg-mini is-share', type: 'button', 'aria-label': `PnL card for $${x.ticker}`, on: { click: () => {
          const now = (market.positions() || []).find((q) => q.id === x.id);
          shareCard(now || x);
        } } }, icon('share', 'ts-icon tsg-mini-ic'), 'PnL'));
      const tr = el('tr', {});
      tr.$ = { bal: el('td', { class: 'tsg-num tsg-c-bal' }), val: el('td', { class: 'tsg-num' }), inv: el('td', { class: 'tsg-num tsg-c-inv' }),
        pnl: el('td', { class: 'tsg-num' }), ret: el('td', { class: 'tsg-num tsg-c-ret' }), acts };
      tr.append(el('td', {}, tok), tr.$.bal, tr.$.val, tr.$.inv, tr.$.pnl, tr.$.ret, el('td', {}, acts));
      return tr;
    }, (tr, x) => {
      if (x.empty) return;
      const $ = tr.$;
      flag(tr, 'is-closed', !x.open);
      setText($.bal, x.open ? tokens(x.tokens) : 'Sold');
      setText($.val, x.open ? M(x.value) : '—');
      setText($.inv, M(x.invested));
      setText($.pnl, MS(x.total));
      tone($.pnl, x.total, 1e-9);
      setText($.ret, pct(x.pnlPct));
      tone($.ret, x.pnlPct, 0.0005);
      for (const b of $.acts.querySelectorAll('.tsg-mini:not(.is-share)')) b.hidden = !x.open;
    });
  }

  // ---------- a wallet's page ----------
  const wBack = el('button', { class: 'tsg-back', type: 'button', on: { click: () => closeSub() } }, icon('back', 'ts-icon'), 'Back');
  const wAv = el('span', { class: 'tsg-av is-big', 'aria-hidden': 'true' });
  const wName = el('h2', { class: 'tsg-w-name', tabIndex: -1 });
  const wAddr = el('span', { class: 'tsg-chipx is-mono' });
  const wTags = el('span', { class: 'tsg-tags' });
  const rangeBtns = [['week', '7D'], ['run', 'This run']].map(([id, label]) => el('button', { class: 'tsg-seg-b', type: 'button',
    data: { r: id }, 'aria-pressed': String(id === G.wrange), on: { click: () => {
      G.wrange = id;
      for (const b of rangeBtns) b.setAttribute('aria-pressed', String(b.dataset.r === id));
      renderWallet();
    } } }, label));
  const wRange = el('div', { class: 'tsg-seg', role: 'group', 'aria-label': 'Which days' }, rangeBtns);
  const wStats = el('dl', { class: 'tsg-wstats' });
  const wDistBar = el('div', { class: 'tsg-dist', 'aria-hidden': 'true' });
  const wDistList = el('ul', { class: 'tsg-dist-l' });
  const wDistH = el('h3', { class: 'tsg-box-t' }, 'How its trades ended');
  const wtabBtns = [['holdings', 'Holdings'], ['activity', 'Activity']].map(([id, label]) => el('button', { class: 'tsg-tab', type: 'button',
    data: { t: id }, 'aria-pressed': String(id === G.wtab), on: { click: () => {
      G.wtab = id;
      for (const b of wtabBtns) b.setAttribute('aria-pressed', String(b.dataset.t === id));
      renderWallet();
    } } }, label));
  const wList = el('ul', { class: 'tsg-wlist' });
  const wNote = el('p', { class: 'tsg-note' });
  const walletView = el('section', { class: 'tsg-view tsg-walletview', hidden: true, 'aria-label': 'Wallet' },
    el('div', { class: 'tsg-coinbar' }, wBack),
    el('div', { class: 'tsg-w-head' }, wAv, el('div', { class: 'tsg-w-t' }, wName, el('div', { class: 'tsg-w-chips' }, wAddr, wTags)), wRange),
    wStats,
    el('section', { class: 'tsg-box' }, wDistH, wDistBar, wDistList),
    el('div', { class: 'tsg-tabs', role: 'group', 'aria-label': 'Its details' }, wtabBtns),
    wList, wNote);
  function openWallet(kind, id) {
    if (kind !== 'kol' && kind !== 'smart') return;
    if (kind === 'kol' && !kolById(id)) return;
    if (kind === 'smart' && !(Number.isInteger(id) && id >= 0)) return;
    if (coin.isOpen()) coin.close();
    const first = !G.sub;
    G.sub = 'wallet';
    G.wallet = { kind, id };
    if (first) ctx.pushSub();
    syncViews();
    renderWallet(true);
    scrollTop();
    wName.focus({ preventScroll: true });
  }
  function renderWallet(force = false) {
    const w = G.wallet;
    if (!w) return;
    const feed = market.feed(0);
    if (w.kind === 'smart') {
      const sw = market.smartWallets()[w.id];
      const p = smartProfile(sw);
      if (!p) return;
      if (force) {
        setText(wName, p.name);
        setText(wAv, 'S');
        wAv.style.setProperty('--h', String(hueOf(p.name)));
        setText(wAddr, short(p.addr));
        wTags.replaceChildren(el('span', { class: 'tsg-tag is-good' }, 'Smart money'));
      }
      wRange.hidden = false;
      const R = G.wrange === 'run' ? p.run : p.week;
      const stats = G.wrange === 'run'
        ? [['Profit', MS(p.run.pnl), p.run.pnl], ['Unrealized', MS(p.run.upnl), p.run.upnl], ['Win rate', p.run.winRate === null ? '—' : share(p.run.winRate, 0)],
          ['Buys / sells', `${num(p.run.buys)} / ${num(p.run.sells)}`], ['Bought', M(p.run.in)], ['Holding', M(p.run.value)]]
        : [['7D profit', MS(p.week.pnl), p.week.pnl], ['Win rate', p.week.winRate === null ? '—' : share(p.week.winRate, 0)],
          ['Trades', num(p.week.trades)], ['Won / lost', `${num(p.week.won)} / ${num(p.week.lost)}`], ['Volume', M(p.week.vol)]];
      fillStats(stats);
      setText(wDistH, G.wrange === 'run' ? 'Its open coins, by return' : 'How its trades ended (7D)');
      fillDist(R.dist);
      if (G.wtab === 'holdings') {
        const items = (sw.open || []).map((o) => ({ key: `o${o.coin}`, coin: o.coin, tok: o.tok, value: o.value, pnl: o.value + o.out - o.in }));
        fillList(items, 'Holds nothing right now.');
      } else {
        const items = feed.filter((e) => e.smart === w.id && (e.kind === 'smart_buy' || e.kind === 'smart_sell')).slice(-40).reverse()
          .map((e) => ({ key: `e${e.q}`, coin: e.c, ev: e }));
        fillList(items, 'No trades this run yet.');
      }
      setText(wNote, 'A made-up wallet: its week before the run, and what it does on this one.');
    } else {
      const p = kolProfile(w.id, feed);
      if (!p) return;
      if (force) {
        setText(wName, p.name);
        setText(wAv, initial(p.id));
        wAv.style.setProperty('--h', String(hueOf(p.name)));
        setText(wAddr, short(p.addr));
        wTags.replaceChildren(el('span', { class: 'tsg-tag' }, 'KOL'), el('span', { class: 'tsg-tag' }, `${num(p.followers)} followers`));
      }
      wRange.hidden = true;
      // what it holds now of the coins it called (the coins' own holders)
      const holds = [];
      for (const c of p.coins) {
        const s = statsOf(c);
        const k = s && Array.isArray(s.kols) ? s.kols.find((x) => x.id === w.id) : null;
        if (k && k.tok > 0) holds.push({ key: `o${c}`, coin: c, tok: k.tok, value: k.tok * s.price, pnl: null });
      }
      fillStats([['Followers', num(p.followers)], ['Calls this run', num(p.calls)], ['Sells this run', num(p.sells)], ['Holding', num(holds.length)]]);
      setText(wDistH, 'Its calls');
      fillDist(null);
      if (G.wtab === 'holdings') fillList(holds, 'Holds none of the coins it called.');
      else {
        const items = feed.filter((e) => e.kol === w.id && (e.kind === 'kol_buy' || e.kind === 'kol_sell')).slice(-40).reverse()
          .map((e) => ({ key: `e${e.q}`, coin: e.c, ev: e }));
        fillList(items, 'No calls this run yet.');
      }
      setText(wNote, 'A made-up KOL: watch whether its followers get paid or dumped on.');
    }
  }
  function fillStats(stats) {
    keyed(wStats, stats, (s) => s[0], (s) => {
      const dd = el('dd', {});
      const d = el('div', {}, el('dt', {}, s[0]), dd);
      d.$dd = dd;
      return d;
    }, (d, s) => {
      setText(d.$dd, s[1]);
      if (s.length > 2) tone(d.$dd, s[2], 1e-9);
    });
  }
  function fillDist(dist) {
    const has = Array.isArray(dist) && dist.some((x) => x > 0);
    wDistBar.hidden = !has;
    wDistList.hidden = !Array.isArray(dist);
    if (!Array.isArray(dist)) return;
    const tot = dist.reduce((a, b) => a + b, 0) || 1;
    keyed(wDistBar, dist.map((n, i) => ({ i, n })), (x) => x.i, (x) => el('i', { class: `tsg-dist-${x.i}` }), (n, x) => {
      n.style.setProperty('--w', String(x.n / tot));
    });
    keyed(wDistList, dist.map((n, i) => ({ i, n })), (x) => x.i, (x) => {
      const v = el('b', {});
      const li = el('li', {}, el('span', { class: ['tsg-dist-k', DIST_TONES[x.i], `tsg-dist-${x.i}`] }, DIST_LABELS[x.i]), v);
      li.$v = v;
      return li;
    }, (li, x) => setText(li.$v, num(x.n)));
  }
  function fillList(items, emptyWords) {
    const list = items.length ? items : [{ key: 'empty', empty: true }];
    keyed(wList, list, (x) => x.key, (x) => {
      if (x.empty) return el('li', { class: 'tsg-wempty' }, emptyWords);
      const r = market.row(x.coin);
      const b = el('button', { class: 'tsg-wrow', type: 'button', on: { click: () => openCoin(x.coin) } });
      b.$ = { a: el('span', { class: 'tsg-wrow-a' }), b: el('span', { class: 'tsg-wrow-b' }) };
      b.append(pic(r || {}, 'is-xs', 'tsg'), el('b', {}, `$${(r && r.ticker) || (x.ev && x.ev.ticker) || '?'}`), b.$.a, b.$.b);
      return el('li', {}, b);
    }, (li, x) => {
      if (x.empty) return;
      const b = li.firstChild;
      if (x.ev) {
        const e = x.ev;
        const buy = e.kind.endsWith('buy');
        setText(b.$.a, `${buy ? 'Bought' : e.frac >= 0.999 ? 'Sold all' : 'Sold'}${Number.isFinite(e.sol) ? ` ${M(e.sol)}` : ''}`);
        flag(b.$.a, 'is-up', buy);
        flag(b.$.a, 'is-down', !buy);
        setText(b.$.b, ago(market.t - e.t));
      } else {
        setText(b.$.a, `${tokens(x.tok)} · ${M(x.value)}`);
        setText(b.$.b, x.pnl === null ? '' : MS(x.pnl));
        if (x.pnl !== null) tone(b.$.b, x.pnl, 1e-9);
      }
    });
  }

  // ---------- limit orders and auto (take profit, stop loss): watched here, placed as market orders when hit ----------
  const limitsApi = {
    add(o) {
      G.limits.push({ ...o, id: ++G.limitSeq });
      return G.limitSeq;
    },
    cancel(id) {
      G.limits = G.limits.filter((o) => o.id !== id);
    },
    of: (coin) => G.limits.filter((o) => o.coin === coin),
    setAuto(coinId, a) {
      if (a) G.autos.set(coinId, a);
      else G.autos.delete(coinId);
    },
    autoOf: (coinId) => G.autos.get(coinId) || null,
  };
  function checkTriggers() {
    for (const o of G.limits.slice()) {
      const r = market.row(o.coin);
      if (!r) {
        limitsApi.cancel(o.id);
        continue;
      }
      if (o.kind === 'dca') {
        const next = stepScannerDca(o, market.t, ctx.order);
        Object.assign(o, next);
        if (!o.remaining) limitsApi.cancel(o.id);
        if (o.error) toast(`DCA stopped: ${orderError(o.error) || 'the next order could not be placed'}`, 'down');
        continue;
      }
      if (!limitHit(o, r.mc)) continue;
      limitsApi.cancel(o.id);
      const res = o.side === 'buy' ? ctx.order({ coin: o.coin, side: 'buy', sol: o.sol }) : ctx.order({ coin: o.coin, side: 'sell', frac: o.frac });
      toast(res && res.ok ? `${limitName(o)} on $${r.ticker} at ${mc(r.mc)}: order sent`
        : `${limitName(o)} on $${r.ticker}: ${orderError(res && res.error) || 'it didn\'t go through'}`, res && res.ok ? 'up' : 'down');
    }
    if (!G.autos.size) return;
    const open = new Map((market.positions() || []).filter((p) => p.open).map((p) => [p.id, p]));
    for (const [coinId, a] of G.autos) {
      const p = open.get(coinId);
      if (!p) {
        G.autos.delete(coinId);
        continue;
      }
      const r = market.row(coinId);
      const hit = r ? autoHit(a, r.mc, entryMcOf(p)) : null;
      if (!hit) continue;
      a[hit].done = true;
      const res = ctx.order({ coin: coinId, side: 'sell', frac: a[hit].frac });
      toast(res && res.ok ? `${hit === 'tp' ? 'Take profit' : 'Stop loss'} on $${r.ticker}: selling ${share(a[hit].frac, 0)}`
        : `${hit === 'tp' ? 'Take profit' : 'Stop loss'} on $${r.ticker}: ${orderError(res && res.error) || 'it didn\'t go through'}`, res && res.ok ? 'up' : 'down');
      if ((!a.tp || a.tp.done) && (!a.sl || a.sl.done)) G.autos.delete(coinId);
    }
  }

  // ---------- a coin's page (./gngm-coin.js) ----------
  const coin = mountCoin({
    ctx, market, M, MN, MS, mc, U, isUsd, px, cur, orderError, phone, coarse, info, statsOf, limits: limitsApi, shareCard,
    smartIndexOf, openWallet: (kind, id) => openWallet(kind, id), close: () => closeSub(), openSettings: () => openGSettings(),
  });

  // ---------- settings ----------
  const nameIn = el('input', { class: 'tsg-in', type: 'text', maxLength: 40, autocomplete: 'nickname', spellcheck: 'false',
    placeholder: 'Your name (optional)', 'aria-label': 'Your name, optional' });
  const nameMsg = el('p', { class: 'tsg-sheet-note', role: 'status' });
  const nameSave = el('button', { class: 'tsg-btn', type: 'button', on: { click: () => saveName() } }, 'Save');
  nameIn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveName();
    }
  });
  function saveName() {
    if (typeof ctx.setPlayerName !== 'function') return;
    const r = ctx.setPlayerName(nameIn.value);
    if (!r || !r.ok) {
      setText(nameMsg, 'That name can\'t be used: 1 to 24 letters, numbers, spaces or emoji; no links, addresses, or names that pass for AGI-1, her team or a moderator.');
      flag(nameMsg, 'is-bad', true);
      return;
    }
    nameIn.value = r.name || '';
    flag(nameMsg, 'is-bad', false);
    setText(nameMsg, r.name ? `Saved: your cards say “by ${r.name}”, and your ranked runs show it.` : 'No name: your cards show none, and your ranked runs say “A player”.');
  }
  const presetTabs = [0, 1, 2].map((i) => el('button', { class: 'tsg-ptab', type: 'button', data: { i },
    on: { click: () => {
      ctx.pickPreset(i);
      renderPresets();
      coin.refresh();
    } } }, `P${i + 1}`));
  const slipChips = el('div', { class: 'tsg-chips', role: 'radiogroup', 'aria-label': 'Slippage' });
  const prioChips = el('div', { class: 'tsg-chips', role: 'radiogroup', 'aria-label': 'Priority' });
  function renderPresets() {
    if (typeof ctx.presets !== 'function') return;
    const { preset, list } = ctx.presets();
    presetTabs.forEach((b, i) => {
      b.setAttribute('aria-pressed', String(i === preset));
      setText(b, `P${i + 1}`);
      b.setAttribute('aria-label', `Preset ${i + 1}: ${share(list[i].slippage, 0)} slippage, ${list[i].priority}${i === preset ? ', in use' : ''}`);
    });
    const p = list[preset];
    slipChips.replaceChildren(el('span', { class: 'tsg-chips-l' }, 'Slippage'), ...SLIPPAGES.map((v) => el('button', { class: 'tsg-chip', type: 'button',
      role: 'radio', 'aria-checked': String(v === p.slippage), on: { click: () => {
        ctx.setPreset(preset, { slippage: v });
        renderPresets();
        coin.refresh();
      } } }, share(v, 0))));
    prioChips.replaceChildren(el('span', { class: 'tsg-chips-l' }, 'Priority'), ...PRIORITIES.map((k) => el('button', { class: 'tsg-chip', type: 'button',
      role: 'radio', 'aria-checked': String(k === p.priority), on: { click: () => {
        ctx.setPreset(preset, { priority: k });
        renderPresets();
        coin.refresh();
      } } }, `${k} · ${M(PRIORITY[k].fee)}`)));
  }
  const viewChips = el('div', { class: 'tsg-setrow' });
  function renderViewChips() {
    const v = typeof ctx.chartView === 'function' ? ctx.chartView() : { mode: 'mcap', unit: 'usd' };
    const chip = (label, on, click) => el('button', { class: 'tsg-chip', type: 'button', role: 'radio', 'aria-checked': String(on), on: { click } }, label);
    viewChips.replaceChildren(
      el('div', { class: 'tsg-chips', role: 'radiogroup', 'aria-label': 'The chart shows' }, el('span', { class: 'tsg-chips-l' }, 'Chart'),
        chip('Market cap', v.mode === 'mcap', () => setView2({ mode: 'mcap' })), chip('Price', v.mode === 'price', () => setView2({ mode: 'price' }))),
      el('div', { class: 'tsg-chips', role: 'radiogroup', 'aria-label': 'In' }, el('span', { class: 'tsg-chips-l' }, 'In'),
        chip('USD', v.unit === 'usd', () => setView2({ unit: 'usd' })), chip(isUsd ? 'SOL' : U.name, v.unit === 'coin', () => setView2({ unit: 'coin' }))));
  }
  function setView2(v) {
    if (typeof ctx.setChartView === 'function') ctx.setChartView(v);
    renderViewChips();
    coin.refresh();
  }
  const hotChip = el('button', { class: 'tsg-chip', type: 'button', role: 'switch', on: { click: () => {
    setHot(!G.hot);
    hotChip.setAttribute('aria-checked', String(G.hot));
  } } }, 'Hotkeys');
  const pauseChip = el('button', { class: 'tsg-chip', type: 'button', role: 'switch', 'aria-checked': 'true', on: { click: () => {
    G.hoverPause = !G.hoverPause;
    pauseChip.setAttribute('aria-checked', String(G.hoverPause));
  } } }, 'Pause a column under the mouse');
  const gSheet = el('dialog', { class: 'tsg-sheet is-settings', 'aria-label': 'GNGM settings' },
    el('div', { class: 'tsg-sheet-head' }, el('h2', { class: 'tsg-sheet-t' }, 'Settings'),
      el('button', { class: 'tsg-x', type: 'button', 'aria-label': 'Close', on: { click: () => gSheet.close() } }, icon('close'))),
    el('div', { class: 'tsg-sheet-body' },
      el('h3', { class: 'tsg-set-h' }, 'Your name'),
      el('div', { class: 'tsg-namerow' }, nameIn, nameSave), nameMsg,
      el('p', { class: 'tsg-sheet-note' }, 'Optional, like a username: it goes on your PnL cards, and on the leaderboards with your ranked runs. Kept in this browser.'),
      el('h3', { class: 'tsg-set-h' }, 'Trade presets'),
      el('div', { class: 'tsg-ptabs', role: 'group', 'aria-label': 'Presets' }, presetTabs), slipChips, prioChips,
      el('p', { class: 'tsg-sheet-note' }, 'Three presets of slippage and priority: the one picked is used for every trade.'),
      el('h3', { class: 'tsg-set-h' }, 'Chart'), viewChips,
      el('h3', { class: 'tsg-set-h' }, 'Trenches'), el('div', { class: 'tsg-chips' }, hotChip, pauseChip),
      el('p', { class: 'tsg-sheet-note' }, 'Hotkeys: hold Z over a column and press 1 to 9 to quick-buy that row; or hold Space, press 1, 2 or 3 for a column, then a row.'),
      el('button', { class: 'tsg-btn is-ghost', type: 'button', on: { click: () => {
        gSheet.close();
        ctx.openSettings();
      } } }, 'Sound and the game\'s other settings')));
  gSheet.addEventListener('click', (e) => {
    if (e.target === gSheet) gSheet.close();
  });
  function openGSettings() {
    if (gSheet.open || document.querySelector('dialog[open]')) return;
    nameIn.value = (typeof ctx.playerName === 'function' && ctx.playerName()) || '';
    setText(nameMsg, '');
    hotChip.setAttribute('aria-checked', String(G.hot));
    renderPresets();
    renderViewChips();
    gSheet.showModal();
  }

  // GMGN's workspace rails. The data stays inside this practice run: the watchlist is the player's selection,
  // Picks uses its market rankings and Callout shows the simulator's existing KOL events.
  const railList = el('div', { class: 'tsg-rail-list', 'aria-label': 'Picks' });
  const railCalls = el('div', { class: 'tsg-rail-calls', 'aria-label': 'Callouts' });
  const pinned = el('div', { class: 'tsg-pinned', 'aria-label': 'Watched coins' });
  const railToggle = el('button', { class: 'tsg-tool', type: 'button', 'aria-label': 'Toggle market sidebar',
    'aria-pressed': 'true', on: { click: () => {
      G.rail = !G.rail; root.dataset.rail = String(G.rail); railToggle.setAttribute('aria-pressed', String(G.rail)); renderRail();
    } } }, '☷');
  const railTabs = [['picks', 'Picks'], ['trending', 'Trending'], ['watch', 'Tracking']].map(([id, label]) =>
    el('button', { class: 'tsg-rail-tab', type: 'button', data: { tab: id }, 'aria-pressed': String(id === G.railTab), on: { click: () => {
      G.railTab = id; for (const b of railTabs) b.setAttribute('aria-pressed', String(b.dataset.tab === id)); renderRail();
    } } }, label));
  const rail = el('aside', { class: 'tsg-rail', 'aria-label': 'Market sidebar' },
    el('section', { class: 'tsg-rail-picks' }, el('div', { class: 'tsg-rail-head' }, el('span', { class: 'tsg-chain-tag' }, U.name), railTabs),
      el('div', { class: 'tsg-rail-labels' }, el('span', {}, 'Time / TXs'), el('span', {}, 'MC / 5m %')), railList),
    el('section', { class: 'tsg-rail-callout' }, el('div', { class: 'tsg-rail-head' }, el('b', {}, 'Callout'),
      el('button', { class: 'tsg-tool', type: 'button', on: { click: () => setView('callout') } }, '↗')),
    el('p', { class: 'tsg-rail-source' }, 'KOL activity · simulated'), railCalls));
  const monitorList = el('div', { class: 'tsg-monitor-list' });
  const monitorView = el('section', { class: 'tsg-view tsg-monitor', hidden: true, 'aria-label': 'Monitor' },
    el('div', { class: 'tsg-bar' }, el('h2', { class: 'tsg-h' }, 'Monitor'), el('span', { class: 'tsg-note' }, 'Your watchlist · this run')),
    monitorList);
  const calloutList = el('div', { class: 'tsg-callout-list' });
  const calloutView = el('section', { class: 'tsg-view tsg-callout', hidden: true, 'aria-label': 'Callout' },
    el('div', { class: 'tsg-bar' }, el('h2', { class: 'tsg-h' }, 'Callout')),
    el('p', { class: 'tsg-note' }, 'The simulator’s KOL buys and sells. Open a profile to inspect its calls and holdings.'), calloutList);
  function renderCallouts(list, max) {
    const items = trackItems(market.feed(0), { filter: 'kol', max });
    keyed(list, items.length ? items : [{ q: 'empty', empty: true }], (x) => x.q, (x) => {
      if (x.empty) return el('p', { class: 'tsg-empty' }, 'No KOL calls in this run yet.');
      const when = el('span', { class: 'tsg-call-when' }), value = el('span', { class: 'tsg-call-value' });
      const card = el('article', { class: 'tsg-call-card' },
        el('div', { class: 'tsg-call-head' }, el('button', { class: 'tsg-call-author', type: 'button', on: { click: () => openWallet('kol', x.kol) } },
          el('span', { class: 'tsg-av', vars: { '--h': hueOf(x.kol) } }, initial(x.kol)), el('b', {}, `@${x.kol}`)), when),
        el('p', {}, x.side === 'buy' ? 'Opened a position.' : x.frac >= .999 ? 'Closed the position.' : 'Sold part of the position.'),
        el('button', { class: 'tsg-call-token', type: 'button', on: { click: () => openCoin(x.coin) } },
          pic(market.row(x.coin) || {}, 'is-xs', 'tsg'), el('b', {}, x.ticker), value));
      card.$ = { when, value }; return card;
    }, (node, x) => {
      if (x.empty) return; setText(node.$.when, age(market.t - x.t));
      const r = market.row(x.coin); setText(node.$.value, r ? mc(r.mc) : '—');
    });
  }
  function renderMonitor() {
    const rows = [...G.watched].map((id) => market.row(id)).filter(Boolean);
    keyed(monitorList, rows.length ? rows : [{ id: 'empty', empty: true }], (r) => r.id,
      (r) => r.empty ? el('p', { class: 'tsg-empty' }, 'Tap ☆ on a token to add it to your watchlist.') : makeCard(r, 'new'),
      (node, r) => { if (!r.empty) updateCard(node, r, 'new'); });
  }
  function renderRail() {
    const watched = [...G.watched].map((id) => market.row(id)).filter(Boolean);
    keyed(pinned, watched, (r) => r.id, (r) => el('button', { class: 'tsg-pin', type: 'button', on: { click: () => openCoin(r.id) } }),
      (node, r) => setText(node, `★ ${r.ticker} ${mc(r.mc)}`));
    if (phone.matches || !G.rail) return;
    const L = market.lists({ limit: 16 });
    const rows = (G.railTab === 'watch' ? watched : G.railTab === 'trending' ? L.trending : L.bump.length ? L.bump : L.trending).slice(0, 12);
    keyed(railList, rows.length ? rows : [{ id: 'empty', empty: true }], (r) => r.id, (r) => {
      if (r.empty) return el('p', { class: 'tsg-empty' }, G.railTab === 'watch' ? 'Watch a token with ☆.' : 'Waiting for market activity…');
      const image = pic(r, 'is-xs', 'tsg'), ticker = el('b'), note = el('span'), cap = el('b'), change = el('span');
      const b = el('button', { class: 'tsg-rail-row', type: 'button', on: { click: () => openCoin(r.id) } }, image,
        el('span', { class: 'tsg-rail-token' }, ticker, note), el('span', { class: 'tsg-rail-price' }, cap, change));
      b.$ = { image, ticker, note, cap, change }; return b;
    }, (node, r) => {
      if (r.empty) return; const $ = node.$;
      setText($.ticker, r.ticker); setText($.note, `${num(r.txns)} TXs · ${age(r.age)}`); setText($.cap, mc(r.mc));
      setText($.change, pct(r.ch5m)); tone($.change, r.ch5m, .0005);
      if (!samePic($.image, r)) { const p = pic(r, 'is-xs', 'tsg'); $.image.replaceWith(p); $.image = p; }
    });
    renderCallouts(railCalls, 3);
  }
  const utility = el('div', { class: 'tsg-utility' }, railToggle,
    el('button', { class: 'tsg-tool', type: 'button', title: 'Watchlist', on: { click: () => setView('monitor') } }, '★'),
    el('button', { class: 'tsg-tool', type: 'button', title: 'Trending', on: { click: () => setView('trending') } }, '⌁'),
    el('span', { class: 'tsg-utility-divider' }), el('span', { class: 'tsg-chain-tag' }, U.name),
    el('button', { class: 'tsg-tool', type: 'button', on: { click: () => setView('trenches') } }, 'All ⌄'), pinned);
  const dockStatus = el('span', { class: 'tsg-dock-status' });
  const dock = el('footer', { class: 'tsg-dock' },
    el('button', { class: 'tsg-dock-b is-primary', type: 'button', on: { click: () => setView('trenches') } }, '✦ Trenches'),
    [['track', '♙ Wallet Tracker'], ['callout', '◀ Callout'], ['holding', '▥ Holding'], ['monitor', '★ Watchlist'],
      ['trending', '♨ Trending'], ['holding', '▥ PnL']].map(([viewId, label]) => el('button', { class: 'tsg-dock-b', type: 'button',
      on: { click: () => setView(viewId) } }, label)),
    dockStatus, el('button', { class: 'tsg-dock-b', type: 'button', on: { click: openGSettings } }, '⚙'));

  // ---------- phones: the tab bar ----------
  const tabBtns = [...VIEWS, ['settings', 'Settings']].map(([id, label]) => el('button', { class: 'tsg-tabbar-b', type: 'button',
    data: { view: id }, on: { click: () => (id === 'settings' ? openGSettings() : setView(id)) } },
  icon({ trenches: 'shovel', trending: 'flame', callout: 'bolt', monitor: 'search', track: 'users', holding: 'bag', settings: 'sliders' }[id], 'ts-icon tsg-tabbar-ic'),
  el('span', {}, label)));
  const tabbar = el('nav', { class: 'tsg-tabbar', 'aria-label': 'GNGM' }, tabBtns);

  // ---------- views ----------
  const views = { trenches: trenchesView, trending: trendingView, callout: calloutView, monitor: monitorView, track: trackView, holding: holdingView };
  function syncViews() {
    for (const [id, v] of Object.entries(views)) v.hidden = Boolean(G.sub) || id !== G.view;
    coin.el.hidden = G.sub !== 'coin';
    walletView.hidden = G.sub !== 'wallet';
    root.dataset.view = G.sub || G.view;
    for (const b of navBtns) b.setAttribute('aria-pressed', String(!G.sub && b.dataset.view === G.view));
    for (const b of tabBtns) {
      const on = b.dataset.view === G.view && !G.sub;
      flag(b, 'is-on', on);
      if (on) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    }
  }
  function setView(id) {
    if (G.sub) closeSub();
    G.view = id;
    syncViews();
    slow(true);
    scrollTop();
  }
  function openCoin(id) {
    if (!Number.isInteger(id) || !market.row(id)) return;
    const first = !G.sub;
    G.sub = 'coin';
    G.wallet = null;
    if (first) ctx.pushSub();
    syncViews();
    coin.open(id);
    scrollTop();
  }
  // a sub-page (a coin's or a wallet's) closed: from its Back (the history steps back) or from the browser's Back
  function closeSub(fromPop = false) {
    if (!G.sub) return;
    if (G.sub === 'coin') coin.close();
    G.sub = null;
    G.wallet = null;
    if (!fromPop) ctx.popSub();
    syncViews();
    slow(true);
  }

  const root = el('div', { class: 'tsg', data: { view: G.view, rail: G.rail } }, head, utility,
    el('div', { class: 'tsg-workspace' }, rail, el('main', { class: 'tsg-main' }, trenchesView, trendingView, calloutView, monitorView, trackView, holdingView, coin.el, walletView)),
    dock, tabbar, gSheet);
  host.append(root);
  syncViews();

  function fast(force) {
    const p = market.player;
    setText(balN, isUsd ? usd(p.sol * px) : MN(p.sol));
    checkTriggers();
    const state = typeof market.liveState === 'function' ? market.liveState() : null;
    setText(dockStatus, state ? state.feed === 'live' ? '● Real coins · simulated prices/volume' : '○ Coin feed reconnecting · simulation running' : '● Simulated market · practice account');
    if (G.sub === 'coin') coin.fast(force);
  }
  function slow(force) {
    G.stats.clear();
    const L = market.lists({ limit: COL_MAX });
    if (G.sub === 'coin') coin.slow();
    else if (G.sub === 'wallet') renderWallet();
    else if (G.view === 'trenches') renderTrenches(L, force === true);
    else if (G.view === 'trending') renderTrending(L);
    else if (G.view === 'track') renderTrack();
    else if (G.view === 'holding') renderHolding();
    else if (G.view === 'monitor') renderMonitor();
    else if (G.view === 'callout') renderCallouts(calloutList, 30);
    renderRail(); syncColumnPresets();
    if (G.query && !found.hidden) runSearch();
  }
  fast(true);
  slow(true);

  const onPhone = () => coin.onPhone(phone.matches);
  phone.addEventListener('change', onPhone);
  document.addEventListener('keydown', onKey);
  document.addEventListener('keyup', onKey);
  if (typeof window !== 'undefined') window.addEventListener('blur', onBlur);

  return {
    el: root,
    update(now) {
      if (G.dead) return;
      if (now - G.fastAt >= FAST_MS) {
        G.fastAt = now;
        fast(false);
      }
      if (now - G.slowAt >= SLOW_MS) {
        G.slowAt = now;
        slow(false);
      }
    },
    // a coin's or a wallet's page is open (the shell's history knows it as a step)
    sub: () => Boolean(G.sub),
    closeSub: () => closeSub(true),
    openCoin,
    destroy() {
      G.dead = true;
      clearTimeout(searchTimer);
      coin.destroy();
      phone.removeEventListener('change', onPhone);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('keyup', onKey);
      if (typeof window !== 'undefined') window.removeEventListener('blur', onBlur);
      if (gSheet.open) gSheet.close();
      root.remove();
    },
  };
}
