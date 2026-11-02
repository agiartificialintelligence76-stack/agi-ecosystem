// TRENCHING SIMULATOR's Pomp.fun ("Trench Board" until the owner's parody names, 2026-10-21, #406): our own launchpad
// board, laid out the way today's launchpad boards are: a clean grid of coin cards under the king of the hill and its
// sorts, the latest trade and launch flashing in its header; a coin's page built around its chart (its header with the
// market cap and its numbers, the chart with its candle sizes, then its holders, thread and trades) with the trade
// column on its right (Buy / Sell, the amount and its quick picks, the coin's stats over 5 minutes, an hour or since
// launch, its bonding curve, the king of the hill's race, its pool and its creator); the player's bag on the left of a
// wide screen. Phones: one column, a tab bar at the bottom and a green trade button above it that opens the trade panel
// as a sheet. All under our own parody name and mark (brands.js: a pill in a gold crown, "pomp and circumstance"),
// colors and words.
//
// mountBoard(host, ctx) → { el, update(now), sub(), closeSub(), openCoin(id), destroy() }. ctx (from shell.js): { run,
// market, currency, solUsd, start, settings() → { slippage, priority }, order(params) → run.order's answer,
// openSettings(), pushSub(), popSub(), reduceMotion, colors, sort (the first sort), onCoin(id | null) (the coin page
// opened or closed) }. Everything is made with createElement and set as text; styles only through classes and the CSS
// object model (the site's CSP).
//
// Live mode (2026-10-21, #404): a real coin shows its own picture (from our relay, made small there) and where it came
// from ("from pump.fun"), "Real coin · play money" on its page, and "—" for what isn't known about it (its holders, its
// thread, its dev); a made-up stand-in among real coins is tagged "Simulated"; a real coin whose market isn't live right
// now, "Not live". Never a link anywhere, and a real coin's address only ever as its first 6 characters.
import { el, setText, flag, keyed, icon } from '../ui.js';
import { markEl, wordEl } from '../brands.js';
import { TIMEFRAMES } from '../chart.js';
import { createGChart, chartCredit } from './gchart.js';
import { createPompWorkspace } from './pomp-view.js';
import { usd, money, signed, pct, share, age, tokens, currencyOf, unitOf, nice } from '../format.js';
import { MIN_BUY } from '../engine.js';
import { createAddressSearch } from '../live-search.js';
import { CURVE_TOK, GRAD_MC, START_MC } from '../curve.js';
// (the helpers GNGM's board shares, in ./common.js since 2026-10-22; still exported from here as they always were)
import { SORTS, ORDER_ERRORS, whoText, holderTag, buyPresets, parseAmount, num, ago, short, hueOf, initial, setP, tone, pic,
  samePic, fromWords, SOCIALS } from './common.js';

export { SORTS, ORDER_ERRORS, whoText, holderTag, buyPresets, parseAmount };

const FAST_MS = 250;
const SLOW_MS = 650;
const CARDS = 24;

// ---------- small helpers ----------
// two line icons ui.js doesn't have (24 × 24, stroke = currentColor, like its own)
const SVG = 'http://www.w3.org/2000/svg';
const GLYPHS = Object.freeze({ home: 'M4 11l8-7 8 7v9h-5v-6H9v6H4z', reply: 'M4 5h16v11H9l-5 4z' });
function glyph(name, cls = 'ts-icon') {
  const s = document.createElementNS(SVG, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('focusable', 'false');
  s.setAttribute('class', cls);
  const p = document.createElementNS(SVG, 'path');
  p.setAttribute('d', GLYPHS[name] || GLYPHS.reply);
  s.append(p);
  return s;
}
const sortLabel = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const replies = (n) => `${num(n)} ${n === 1 ? 'reply' : 'replies'}`;
// a coin's tags: [what the chip says, its class, its icon, what a screen reader hears]
const TAGS = Object.freeze({
  koth: ['King', 'is-koth', 'crown', 'king of the hill'], pool: ['Graduated', 'is-pool', null, 'graduated'],
  mig: ['Migrating', 'is-mig', null, 'migrating'], rug: ['Rugged', 'is-rug', null, 'rugged'],
  cto: ['CTO', 'is-cto', null, 'community takeover'], dex: ['DEX paid', 'is-dex', null, 'DEX paid'],
  sim: ['Simulated', 'is-sim', null, 'a simulated stand-in'], stale: ['Not live', 'is-stale', null, 'its price isn\'t live right now'],
});
function tagEl(k) {
  const [label, cls, ic] = TAGS[k];
  return el('span', { class: ['tsb-tag', cls] }, ic ? icon(ic, 'ts-icon tsb-tag-ic') : null, label);
}
// a row's or a coin's tags (`phases`: its graduated and migrating ones too, which a card says on its progress line)
const tagsOf = (r, phases) => [r.koth && 'koth', phases && r.phase === 'pool' && 'pool',
  phases && r.phase === 'migrating' && 'mig', r.rugged && 'rug', r.cto && 'cto', r.dexPaid && 'dex', r.standIn && 'sim',
  r.live && r.tracked === false && 'stale'].filter(Boolean);
// the stats' windows: the last 5 minutes, the last hour, and "24h" = since its launch (a run's coins are all younger)
const WINS = Object.freeze(['5m', '1h', '24h']);
const WIN_S = Object.freeze({ '5m': 300, '1h': 3600, '24h': Infinity });

export function mountBoard(host, ctx) {
  const { market } = ctx;
  // the board's money (./format.js): SOL, dollars, or (Live mode, since 2026-10-21) the chain's own coin, ETH or BNB; the
  // market counts in SOL, and every amount shown or typed is in U at the run's prices
  const cur = currencyOf(ctx.currency);
  const px = ctx.solUsd;
  const U = unitOf(cur, px);
  const isUsd = U.id === 'usd';
  const M = (x) => money(x, cur, px);
  const MN = (x) => money(x, cur, px, { unit: false });
  const MS = (x) => signed(x * U.per, isUsd ? 'usd' : 'sol');
  const unitName = U.name;
  // an order's error in the board's money (ORDER_ERRORS: SOL's words)
  const orderError = (code) => (code === 'min_buy' ? `The smallest buy is ${M(MIN_BUY)}.`
    : typeof ORDER_ERRORS[code] === 'string' ? ORDER_ERRORS[code].replace(/\bSOL\b/g, U.name) : '');
  const mc = (x) => usd(x * px);
  // the time of day the market's clock reads 0 (when the player arrived): the chart's times under its candles
  const clockBase = Date.now() - (Number.isFinite(market.t) ? market.t : 0) * 1000;
  const B = {
    view: 'board', sort: SORTS.some(([id]) => id === ctx.sort) ? ctx.sort : 'bump', query: '', found: null, coin: null, side: 'buy',
    tf: 15, tab: 'holders', stab: 'stats',
    win: '5m', cd: { id: null, arr: [] }, fastAt: 0, slowAt: 0, top: null, infos: new Map(), trade: null, launch: null,
    coinRender: null, kothId: null, tagKey: null, socKey: null, dead: false,
  };
  let workspace = null;
  const quiet = { matches: false, addEventListener() {}, removeEventListener() {} };
  const mq = (q) => (typeof matchMedia === 'function' ? matchMedia(q) : quiet);
  const phone = mq('(max-width: 719px)');
  const wide = mq('(min-width: 1180px)');
  const coarse = mq('(pointer: coarse)');
  const info = (id) => {
    let x = B.infos.get(id);
    if (!x) {
      x = market.info(id);
      if (x) B.infos.set(id, x);
    }
    return x;
  };
  const scrollTop = () => {
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') window.scrollTo(0, 0);
  };
  // label / value rows: { dl, dd: { key }, dt: { key }, row: { key } }
  function dlRows(items, cls, rowCls = null) {
    const dd = {};
    const dt = {};
    const row = {};
    const dl = el('dl', { class: cls }, items.map(([k, label, extra]) => {
      dt[k] = el('dt', {}, label);
      dd[k] = el('dd', {}, '—');
      row[k] = el('div', { class: [rowCls, extra] }, dt[k], dd[k]);
      return row[k];
    }));
    return { dl, dd, dt, row };
  }
  // two numbers against each other (buys / sells) and a bar of their split
  function splitEl(a, b) {
    const av = el('dd', {}, '—');
    const bv = el('dd', {}, '—');
    const bar = el('span', { class: 'tsb-split-bar', 'aria-hidden': 'true' }, el('i'));
    return {
      el: el('div', { class: 'tsb-split' },
        el('dl', { class: 'tsb-split-dl' },
          el('div', { class: 'is-buy' }, el('dt', {}, a), av),
          el('div', { class: 'is-sell' }, el('dt', {}, b), bv)),
        bar),
      a: av, b: bv, bar,
    };
  }
  function setSplit(bar, a, b) {
    const tot = (a || 0) + (b || 0);
    flag(bar, 'is-none', !(tot > 0));
    setP(bar, tot > 0 ? (a || 0) / tot : 0);
  }

  // ---------- the header: the brand, the latest trade and launch, search, the wallet ----------
  const flashTrade = el('button', { class: 'tsb-flash is-trade', type: 'button', tabIndex: -1, hidden: true });
  const flashLaunch = el('button', { class: 'tsb-flash is-launch', type: 'button', tabIndex: -1, hidden: true });
  const flashes = el('div', { class: 'tsb-flashes', 'aria-hidden': 'true' }, flashTrade, flashLaunch);
  flashes.addEventListener('animationend', (e) => {
    const n = e.target;
    if (n && n.classList && n.classList.contains('is-new')) n.classList.remove('is-new');
  });
  const searchIn = el('input', { class: 'tsb-search-in', type: 'search', placeholder: 'Search coins',
    'aria-label': 'Search coins by name, ticker or address', autocomplete: 'off', spellcheck: 'false', enterKeyHint: 'search' });
  let searchTimer = 0;
  const searchForm = el('form', { class: 'tsb-search', role: 'search', on: {
    submit: (e) => {
      e.preventDefault();
      clearTimeout(searchTimer);
      runSearch();
      searchIn.blur();
    },
    click: (e) => {
      if (e.target !== searchIn) searchIn.focus();
    },
  } }, icon('search', 'ts-icon tsb-search-ic'), searchIn, el('kbd', { class: 'tsb-kbd', 'aria-hidden': 'true' }, '/'));
  searchIn.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(runSearch, 180);
  });
  searchIn.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    // Escape here is the search's (never the pause sheet's): it clears it, then leaves it
    e.preventDefault();
    if (searchIn.value) {
      searchIn.value = '';
      clearTimeout(searchTimer);
      runSearch();
    } else searchIn.blur();
  });
  const walletAmt = el('b', { class: 'tsb-wallet-n' }, '—');
  const walletBtn = el('button', { class: 'tsb-wallet', type: 'button', on: { click: () => openBag() } },
    icon('bag', 'ts-icon tsb-wallet-ic'), el('span', { class: 'tsb-sr' }, 'Your bag, balance '), walletAmt,
    isUsd ? null : el('span', { class: 'tsb-wallet-u' }, ` ${U.name}`));
  const head = el('header', { class: 'tsb-head' },
    el('div', { class: 'tsb-brand' }, markEl('board', 'tsb-logo'), wordEl('board', 'tsb-brand-t')),
    flashes, searchForm, walletBtn);
  // "/" jumps to the search (unless something is being typed or a sheet is open)
  const onSlash = (e) => {
    if (B.dead || e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
    if (!root.isConnected || document.querySelector('dialog[open]')) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || ''))) return;
    e.preventDefault();
    searchIn.focus();
    searchIn.select();
  };

  // ---------- the board: the king of the hill, its sorts, the cards ----------
  const kothPicSlot = el('span', { class: 'tsb-koth-picslot' });
  const kothTk = el('b', { class: 'tsb-koth-tk' });
  const kothNm = el('span', { class: 'tsb-koth-nm' });
  const kothBy = el('span', { class: 'tsb-koth-by' });
  const kothMcv = el('b', { class: 'tsb-koth-mcv' });
  const kothCh = el('span', { class: 'tsb-koth-ch' });
  const kothBar = el('span', { class: 'tsb-bar is-gold' }, el('i'));
  const kothPv = el('span', { class: 'tsb-koth-pv' });
  const kothLine = el('span', { class: 'tsb-koth-line' });
  const kothRep = el('span', { class: 'tsb-koth-rep' });
  const kothBtn = el('button', { class: 'tsb-kothbtn', type: 'button', hidden: true, on: { click: () => {
    if (B.kothId !== null) openCoin(B.kothId);
  } } },
  kothPicSlot,
  el('span', { class: 'tsb-ktxt' },
    el('span', { class: 'tsb-ktop' }, kothTk, kothNm),
    kothBy,
    el('span', { class: 'tsb-kmc' }, el('span', { class: 'tsb-klabel' }, 'Market cap'), kothMcv, kothCh),
    el('span', { class: 'tsb-kprog' }, kothBar, kothPv),
    kothLine,
    el('span', { class: 'tsb-kfoot' }, glyph('reply', 'ts-icon tsb-rep-ic'), kothRep)));
  const kothEmpty = el('p', { class: 'tsb-koth-empty' }, 'No king yet: the first coin halfway up its curve takes the crown.');
  const kothCard = el('div', { class: 'tsb-koth-card' }, kothBtn, kothEmpty);
  const kothH = el('h2', { class: 'tsb-koth-h', tabIndex: -1 }, icon('crown', 'ts-icon tsb-koth-ic'), 'King of the hill');
  const sortBtns = SORTS.map(([id, label]) => el('button', { class: 'tsb-sort', type: 'button',
    'aria-pressed': String(id === B.sort), data: { sort: id }, on: { click: () => setSort(id) } }, sortLabel(label)));
  const gridNote = el('p', { class: 'tsb-gridnote', role: 'status' });
  const clearBtn = el('button', { class: 'tsb-clear', type: 'button', hidden: true, on: { click: () => {
    searchIn.value = '';
    clearTimeout(searchTimer);
    runSearch();
    searchIn.focus();
  } } }, icon('close', 'ts-icon tsb-clear-ic'), 'Clear search');
  // always rendered: its note is a live region (role=status), which only speaks while it's in the page
  const gridHead = el('div', { class: 'tsb-gridhead' }, gridNote, clearBtn);
  const grid = el('div', { class: 'tsb-grid' });
  // a card's shake ends: off again (the grid moves its cards, and a moved card would shake again)
  grid.addEventListener('animationend', (e) => {
    const n = e.target;
    if (n && n.classList && n.classList.contains('is-bump')) n.classList.remove('is-bump');
  });
  const boardView = el('section', { class: 'tsb-boardview', 'aria-label': 'The board' },
    el('div', { class: 'tsb-koth' }, kothH, kothCard),
    el('div', { class: 'tsb-sortbar', role: 'group', 'aria-label': 'Sort the board' }, sortBtns),
    gridHead,
    grid);

  function setSort(id) {
    B.sort = id;
    for (const b of sortBtns) b.setAttribute('aria-pressed', String(b.dataset.sort === id));
    if (B.query) {
      searchIn.value = '';
      runSearch();
    }
    B.top = null;
    renderBoard();
  }
  const addressSearch = createAddressSearch(market, () => { if (!B.dead && B.query) runSearch(); });
  function runSearch() {
    B.query = searchIn.value.trim();
    B.found = B.query ? market.find(B.query) : null;
    B.lookupNote = addressSearch(B.query, Boolean(B.found && B.found.length));
    clearBtn.hidden = !B.query;
    if (B.view !== 'board') closeCoin();
    renderBoard();
  }

  function makeCard(r) {
    const n = el('button', { class: 'tsb-card', type: 'button', on: { click: () => openCoin(Number(n.dataset.key)) } });
    const $ = {
      pic: pic(r, 'is-card'), tk: el('b', { class: 'tsb-tk' }), nm: el('span', { class: 'tsb-nm' }),
      age: el('span', { class: 'tsb-age' }), mcv: el('b', { class: 'tsb-c-mcv' }), ch: el('span', { class: 'tsb-c-ch' }),
      bar: el('span', { class: 'tsb-bar' }, el('i')), pv: el('span', { class: 'tsb-c-pv' }),
      by: el('span', { class: 'tsb-c-by' }), repn: el('span', { class: 'tsb-c-repn' }), tags: el('span', { class: 'tsb-tags' }),
      line: el('span', { class: 'tsb-c-line' }), tagKey: null, label: '',
    };
    n.$ = $;
    n.append($.pic, el('span', { class: 'tsb-card-txt' },
      el('span', { class: 'tsb-c-top' }, $.tk, $.nm, $.age),
      el('span', { class: 'tsb-c-cap' }, el('span', { class: 'tsb-c-l' }, 'MC'), $.mcv, $.ch),
      el('span', { class: 'tsb-c-prog' }, $.bar, $.pv),
      el('span', { class: 'tsb-c-meta' }, $.by, el('span', { class: 'tsb-c-rep' }, glyph('reply', 'ts-icon tsb-rep-ic'), $.repn), $.tags),
      $.line));
    return n;
  }
  const stageWords = (r) => (r.phase === 'pool' ? 'graduated' : r.phase === 'migrating' ? 'migrating to its pool'
    : `${share(r.progress, 0)} of its bonding curve`);
  function updateCard(n, r) {
    const $ = n.$;
    const f = info(r.id);
    if (!samePic($.pic, r)) {
      const next = pic(r, 'is-card');
      $.pic.replaceWith(next);
      $.pic = next;
    }
    setText($.tk, r.ticker);
    setText($.nm, r.name);
    setText($.age, age(r.age));
    setText($.mcv, mc(r.mc));
    setText($.ch, pct(r.ch5m));
    tone($.ch, r.ch5m, 0.001);
    setP($.bar, r.phase === 'curve' ? r.progress : 1);
    flag($.bar, 'is-done', r.phase === 'pool');
    flag($.bar, 'is-mig', r.phase === 'migrating');
    setText($.pv, r.phase === 'pool' ? 'Graduated' : r.phase === 'migrating' ? 'Migrating' : share(r.progress, 0));
    setText($.by, r.live ? fromWords(r) : `by ${f ? f.dev : '—'}`);
    setText($.repn, num(r.replies));
    setText($.line, (f && f.line) || '');
    const keys = tagsOf(r, false);
    const key = keys.join('|');
    if (key !== $.tagKey) {
      $.tagKey = key;
      $.tags.replaceChildren(...keys.map(tagEl));
    }
    flag(n, 'is-rugged', r.rugged);
    flag(n, 'is-koth', r.koth);
    const label = `${r.name}, $${r.ticker}${r.live ? `, a real coin ${fromWords(r)}` : ''}, market cap ${mc(r.mc)}, ${pct(r.ch5m)} in 5 minutes, ${stageWords(r)}${r.live ? '' : `, ${replies(r.replies)}`}${keys.map((k) => `, ${TAGS[k][3]}`).join('')}`;
    if (label !== $.label) {
      $.label = label;
      n.setAttribute('aria-label', label);
    }
  }

  function renderKoth(k) {
    kothBtn.hidden = !k;
    kothEmpty.hidden = Boolean(k);
    if (!k) {
      B.kothId = null;
      return;
    }
    const f = info(k.id);
    if (B.kothId !== k.id || !samePic(kothPicSlot.firstElementChild, k)) {
      B.kothId = k.id;
      kothPicSlot.replaceChildren(pic(k, 'is-koth'));
    }
    setText(kothTk, k.ticker);
    setText(kothNm, k.name);
    setText(kothBy, `${k.live ? fromWords(k) : `by ${f ? f.dev : '—'}`} · ${ago(k.age)}`);
    setText(kothMcv, mc(k.mc));
    setText(kothCh, pct(k.ch5m));
    tone(kothCh, k.ch5m, 0.001);
    setP(kothBar, k.phase === 'curve' ? k.progress : 1);
    setText(kothPv, k.phase === 'pool' ? 'Graduated' : k.phase === 'migrating' ? 'Migrating' : `${share(k.progress, 0)} of its curve`);
    setText(kothLine, (f && f.line) || '');
    setText(kothRep, replies(k.replies));
    const label = `King of the hill: ${k.name}, $${k.ticker}, market cap ${mc(k.mc)}, ${pct(k.ch5m)} in 5 minutes, ${stageWords(k)}, ${replies(k.replies)}`;
    if (kothBtn.getAttribute('aria-label') !== label) kothBtn.setAttribute('aria-label', label);
  }

  function renderBoard(L) {
    if (workspace) { workspace.search(B.query); return; }
    L ||= market.lists({ limit: 30 });
    renderKoth(L.koth);
    // the list (or what the search found)
    let rows;
    let note;
    if (B.query) {
      rows = (B.found || []).slice(0, CARDS).map((id) => market.row(id)).filter(Boolean);
      note = rows.length ? `${rows.length} found for “${B.query}”` : B.lookupNote || `Nothing found for “${B.query}”.`;
    } else {
      rows = (L[B.sort] || []).slice(0, CARDS);
      note = rows.length ? '' : B.sort === 'migrated' ? 'Nothing has graduated yet.' : 'Nothing here yet.';
    }
    setText(gridNote, note);
    const first = rows.length ? rows[0].id : null;
    keyed(grid, rows, (r) => r.id, makeCard, updateCard);
    // a new coin bumped to the top shakes (bump order and new), never with "reduce motion"
    if (!ctx.reduceMotion && !B.query && (B.sort === 'bump' || B.sort === 'new') && B.top !== null && first !== null
      && first !== B.top) {
      const n = grid.firstElementChild;
      if (n) {
        n.classList.remove('is-bump');
        void n.offsetWidth;
        n.classList.add('is-bump');
      }
    }
    B.top = first;
  }

  // ---------- a coin's page: its header, chart and tabs ----------
  const backBtn = el('button', { class: 'tsb-back', type: 'button', on: { click: () => closeCoin() } },
    icon('back', 'ts-icon tsb-back-ic'), 'Back');
  const chPic = el('span', { class: 'tsb-ch-pic' });
  const chTk = el('span', { class: 'tsb-ch-tk' });
  const chFull = el('span', { class: 'tsb-ch-full' });
  const chName = el('h2', { class: 'tsb-ch-name', tabIndex: -1 }, chTk, ' ', chFull);
  const chAge = el('span');
  const chCa = el('span', { class: 'tsb-chip is-mono' });
  const chSocs = el('span', { class: 'tsb-ch-socs' });
  const chDev = el('span', { class: 'tsb-chip' });
  const chTags = el('span', { class: 'tsb-tags' });
  // a real coin's: where it came from, and that it's play money here
  const chFrom = el('span', { class: 'tsb-chip', hidden: true });
  const chReal = el('span', { class: 'tsb-chip is-real', hidden: true }, 'Real coin · play money');
  const chChips = el('div', { class: 'tsb-ch-chips' },
    el('span', { class: 'tsb-chip' }, icon('clock', 'ts-icon tsb-chip-ic'), chAge), chReal, chFrom, chCa, chSocs, chDev, chTags);
  const chMcv = el('b', { class: 'tsb-ch-mcv' });
  const chMcch = el('span', { class: 'tsb-ch-mcch' });
  const chStats = dlRows([['vol', '24h vol'], ['hold', 'Holders'], ['ath', 'ATH'], ['liq', 'Liquidity', 'is-wide']],
    'tsb-ch-stats', 'tsb-ch-stat');
  const chRow = el('div', { class: 'tsb-ch-row' },
    el('div', { class: 'tsb-ch-mc' }, el('span', { class: 'tsb-ch-l' }, 'Market cap'), chMcv, chMcch),
    chStats.dl);
  const chCurveT = el('span', { class: 'tsb-ch-curve-t' });
  const chCurveBar = el('span', { class: 'tsb-bar' }, el('i'));
  const chCurve = el('div', { class: 'tsb-ch-curve' }, chCurveT, chCurveBar);
  const tfBtns = TIMEFRAMES.map((x) => el('button', { class: 'tsb-tf', type: 'button', 'aria-pressed': String(x.s === B.tf),
    data: { tf: x.s }, on: { click: () => setTf(x.s) } }, x.id));
  const canvas = el('div', { class: 'tsb-canvas', role: 'img', 'aria-label': 'Market cap chart' });
  let chartMode = 'mcap';
  const chartView = el('button', { class: 'pomp-chart-mode', type: 'button', on: { click: () => {
    chartMode = chartMode === 'mcap' ? 'price' : 'mcap'; chart.view({ mode: chartMode, unit: 'usd' });
    setText(chartView, chartMode === 'mcap' ? 'Price / MCap' : 'Price / MCap'); chartView.setAttribute('aria-pressed', String(chartMode === 'price'));
  } } }, 'Price / MCap');
  const chartBox = el('div', { class: 'tsb-chartbox' },
    el('div', { class: 'tsb-chart-tools' },
      el('div', { class: 'tsb-tfs', role: 'group', 'aria-label': 'Candle size' }, tfBtns),
      chartView, el('button', { type: 'button', class: 'pomp-chart-fit', on: { click: () => chart.fit() } }, 'Reset')),
    canvas, chartCredit());
  const chart = createGChart(canvas, { colors: { bg: '#000000', grid: '#171717', up: '#43d98b', down: '#f87171', border: '#252525', axis: '#888888' }, tf: B.tf });
  const tabN = { holders: el('span', { class: 'tsb-tab-n' }), thread: el('span', { class: 'tsb-tab-n' }) };
  const tabBtns = [['holders', 'Holders'], ['thread', 'Callouts'], ['trades', 'Trades'], ['info', 'About']].map(([id, label]) =>
    el('button', { class: ['tsb-tab', id === 'info' && 'is-phone'], type: 'button', 'aria-pressed': String(id === B.tab),
      data: { tab: id }, on: { click: () => setTab(id) } }, label, tabN[id] ? [' ', tabN[id]] : null));
  const th = (t, cls) => el('th', { scope: 'col', class: cls }, t);
  const holdBody = el('tbody');
  const holdPane = el('div', { class: 'tsb-tablewrap', tabIndex: 0, role: 'region', 'aria-label': 'Holders' },
    el('table', { class: 'tsb-table is-holders' },
      el('caption', { class: 'tsb-sr' }, 'Holders: the biggest wallets first'),
      el('thead', {}, el('tr', {}, th('Holder'), th('% supply', 'tsb-num'), th('Amount', 'tsb-num tsb-c-amt'),
        th(`Value (${unitName})`, 'tsb-num tsb-c-val'), th(`PnL (${unitName})`, 'tsb-num tsb-c-pnl'),
        th('Bought', 'tsb-num tsb-c-when'))),
      holdBody));
  const thread = el('ol', { class: 'tsb-thread', hidden: true, 'aria-label': 'Thread' });
  const tradesBody = el('tbody');
  const tradesPane = el('div', { class: 'tsb-tablewrap', tabIndex: 0, role: 'region', 'aria-label': 'Trades', hidden: true },
    el('table', { class: 'tsb-table is-trades' },
      el('caption', { class: 'tsb-sr' }, 'Trades: the newest first'),
      el('thead', {}, el('tr', {}, th('Account'), th('Type'), th(unitName, 'tsb-num'), th('Amount', 'tsb-num tsb-c-amt'),
        th('MC', 'tsb-num tsb-c-mc'), th('Time', 'tsb-num'))),
      tradesBody));
  const aboutPane = el('div', { class: 'pomp-about-pane', hidden: true });
  const coinL = el('div', { class: 'tsb-coin-l' },
    el('div', { class: 'tsb-coinbar' }, backBtn),
    el('div', { class: 'pomp-token-header' }, el('div', { class: 'tsb-ch' }, chPic, el('div', { class: 'tsb-ch-t' }, chName, chChips)), chRow),
    chCurve, chartBox,
    el('div', { class: 'tsb-tabs', role: 'group', 'aria-label': 'Coin details' }, tabBtns),
    el('div', { class: 'tsb-panes' }, holdPane, thread, tradesPane, aboutPane));

  // ---------- the trade panel ----------
  const sideBtns = [['buy', 'Buy'], ['sell', 'Sell']].map(([s, label]) => el('button', { class: ['tsb-side', `is-${s}`],
    type: 'button', 'aria-pressed': String(s === B.side), data: { side: s }, on: { click: () => setSide(s) } }, label));
  const slipV = el('span', { class: 'tsb-slip-v' });
  const slipBtn = el('button', { class: 'tsb-slip', type: 'button', title: 'Change slippage and priority',
    on: { click: () => ctx.openSettings() } },
  icon('sliders', 'ts-icon tsb-slip-ic'), el('span', { class: 'tsb-sr' }, 'Slippage and priority: '), slipV);
  const holdLine = el('p', { class: 'tsb-hold' });
  const amountIn = el('input', { class: 'tsb-amt', type: 'text', inputMode: 'decimal', autocomplete: 'off', spellcheck: 'false',
    placeholder: '0.0', 'aria-label': 'Amount' });
  const amtX = el('button', { class: 'tsb-amt-x', type: 'button', 'aria-label': 'Clear the amount', hidden: true, on: { click: () => {
    setAmount('');
    amountIn.focus();
  } } }, icon('close', 'ts-icon tsb-amt-x-ic'));
  const unit = el('span', { class: 'tsb-unit' }, unitName);
  const amtBox = el('div', { class: 'tsb-amtbox', on: { click: (e) => {
    if (e.target === amtBox || e.target === unit) amountIn.focus();
  } } }, amountIn, amtX, unit);
  const presets = el('div', { class: 'tsb-presets' });
  const quoteBox = el('p', { class: 'tsb-quote' });
  const placeBtn = el('button', { class: 'tsb-place', type: 'button', on: { click: () => place() } }, 'Buy');
  const errBox = el('p', { class: 'tsb-err', role: 'alert' });
  const tradePanel = el('div', { class: 'tsb-trade', data: { side: B.side } },
    el('div', { class: 'tsb-trade-top' }, el('div', { class: 'tsb-sides', role: 'group', 'aria-label': 'Buy or sell' }, sideBtns), slipBtn),
    holdLine, amtBox, presets, quoteBox, placeBtn, errBox);
  const syncAmt = () => {
    amtX.hidden = !amountIn.value;
  };
  amountIn.addEventListener('input', () => {
    setText(errBox, '');
    syncAmt();
    quote();
  });
  amountIn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      place();
    }
  });

  // ---------- the trade column's boxes: stats, the bonding curve, the king of the hill, the pool, about ----------
  const utabBtns = [['stats', 'Stats'], ['audit', 'Audit']].map(([id, label]) => el('button', { class: 'tsb-utab', type: 'button',
    'aria-pressed': String(id === B.stab), data: { stab: id }, on: { click: () => setStab(id) } }, label));
  const winBtns = WINS.map((w) => el('button', { class: 'tsb-seg-b', type: 'button', 'aria-pressed': String(w === B.win),
    data: { win: w }, on: { click: () => setWin(w) } }, w));
  const seg = el('div', { class: 'tsb-seg', role: 'group', 'aria-label': 'Time window' }, winBtns);
  const sRows = dlRows([['ch', 'Price change'], ['vol', 'Volume'], ['tx', 'Transactions']], 'tsb-rows');
  const split1 = splitEl('Buys', 'Sells');
  const split2 = splitEl('Buy vol', 'Sell vol');
  const statsPane = el('div', { class: 'tsb-stats-pane' }, sRows.dl, split1.el, split2.el);
  const audit = dlRows([['top10', 'Top 10 holders'], ['dev', 'Dev holds'], ['devsold', 'Dev sold'], ['snipers', 'Snipers'],
    ['bundlers', 'Bundlers'], ['insiders', 'Insiders'], ['smart', 'Smart wallets'], ['kols', 'Callers'], ['whales', 'Whales']],
  'tsb-rows is-audit');
  audit.dl.hidden = true;
  const statsBox = el('section', { class: 'tsb-box is-stats' },
    el('h3', { class: 'tsb-sr' }, 'Trading stats'),
    el('div', { class: 'tsb-box-h' }, el('div', { class: 'tsb-utabs', role: 'group', 'aria-label': 'Stats or audit' }, utabBtns), seg),
    el('div', { class: 'tsb-box-b' }, statsPane, audit.dl));
  const curveV = el('b', { class: 'tsb-box-v' });
  const curveBar = el('span', { class: 'tsb-bar is-big' }, el('i'));
  const curveTxt = el('p', { class: 'tsb-note' });
  const curveBox = el('section', { class: 'tsb-box' },
    el('div', { class: 'tsb-box-h' }, el('h3', { class: 'tsb-box-t' }, 'Bonding curve'), curveV),
    el('div', { class: 'tsb-box-b' }, curveBar, curveTxt));
  const kingV = el('b', { class: 'tsb-box-v' });
  const kingBar = el('span', { class: 'tsb-bar is-big is-gold' }, el('i'));
  const kingTxt = el('p', { class: 'tsb-note' });
  const kingBox = el('section', { class: 'tsb-box' },
    el('div', { class: 'tsb-box-h' }, el('h3', { class: 'tsb-box-t' }, icon('crown', 'ts-icon tsb-box-ic'), 'King of the hill'), kingV),
    el('div', { class: 'tsb-box-b' }, kingBar, kingTxt));
  const pool = dlRows([['pair', 'Paired with'], ['liq', 'Liquidity'], ['mc', 'Market cap'], ['ath', 'ATH'], ['born', 'Created'],
    ['dev', 'Creator'], ['ca', 'Contract']], 'tsb-rows');
  const poolBox = el('section', { class: 'tsb-box' },
    el('div', { class: 'tsb-box-h' }, el('h3', { class: 'tsb-box-t' }, 'Pool information')),
    el('div', { class: 'tsb-box-b' }, pool.dl));
  const aboutEl = el('div', { class: 'tsb-about' });
  const aboutBox = el('section', { class: 'tsb-box' },
    el('div', { class: 'tsb-box-h' }, el('h3', { class: 'tsb-box-t' }, 'About')),
    el('div', { class: 'tsb-box-b' }, aboutEl));
  const tradeSlot = el('div', { class: 'tsb-tradeslot' }, tradePanel);
  const coinR = el('div', { class: 'tsb-coin-r' }, tradeSlot, statsBox, curveBox, kingBox, poolBox, aboutBox);
  // phones: the green trade button above the tab bar, which opens the trade panel as a sheet
  const tradeBtnT = el('span', {}, 'Trade');
  const tradeBtn = el('button', { class: 'tsb-tradebtn', type: 'button', on: { click: () => openTradeSheet(B.side) } }, tradeBtnT);
  const buyBar = el('div', { class: 'tsb-buybar' }, tradeBtn);
  const coinView = el('section', { class: 'tsb-coinview', hidden: true, 'aria-label': 'Coin' },
    el('div', { class: 'tsb-coin' }, coinL, coinR), buyBar);

  function setTab(id) {
    const want = id;
    B.tab = want;
    root.dataset.tab = want;
    for (const b of tabBtns) b.setAttribute('aria-pressed', String(b.dataset.tab === want));
    holdPane.hidden = want !== 'holders';
    thread.hidden = want !== 'thread';
    tradesPane.hidden = want !== 'trades';
    aboutPane.hidden = want !== 'info';
    if (want === 'info') aboutPane.append(aboutEl);
    else aboutBox.lastChild.append(aboutEl);
    if (B.coin !== null) {
      renderCoinFast(false);
      renderCoinSlow();
    }
  }
  function setStab(id) {
    B.stab = id;
    for (const b of utabBtns) b.setAttribute('aria-pressed', String(b.dataset.stab === id));
    statsPane.hidden = id !== 'stats';
    audit.dl.hidden = id !== 'audit';
    seg.hidden = id !== 'stats';
    if (B.coin !== null) renderCoinSlow();
  }
  function setWin(w) {
    B.win = w;
    for (const b of winBtns) b.setAttribute('aria-pressed', String(b.dataset.win === w));
    if (B.coin !== null) renderCoinSlow();
  }
  function setTf(s) {
    B.tf = s;
    for (const b of tfBtns) b.setAttribute('aria-pressed', String(Number(b.dataset.tf) === s));
    if (B.coin !== null) renderCoinFast(false);
  }

  function placeLabel() {
    const r = B.coin !== null ? market.row(B.coin) : null;
    const verb = B.side === 'buy' ? 'Buy' : 'Sell';
    // a real coin: the button says it's play money (it never buys or sells anything for real)
    setText(placeBtn, r ? `${verb} $${r.ticker} · play money` : verb);
  }
  function setSide(s) {
    B.side = s;
    for (const b of sideBtns) b.setAttribute('aria-pressed', String(b.dataset.side === s));
    tradePanel.dataset.side = s;
    amountIn.value = '';
    syncAmt();
    setText(errBox, '');
    placeLabel();
    renderPresets();
    quote();
    if (B.coin !== null) {
      const st = market.stats(B.coin);
      if (st) renderTrade(st, false);
    }
  }
  function renderPresets() {
    const r = B.coin !== null ? market.row(B.coin) : null;
    const tk = r ? `$${r.ticker}` : '';
    if (B.side === 'buy') {
      setText(unit, unitName);
      amountIn.setAttribute('aria-label', isUsd ? 'Amount in dollars' : `Amount in ${U.name}`);
      const vals = buyPresets(ctx.start).map((v) => (isUsd ? Math.round(v * px) : U.id === 'sol' ? v : nice(v * U.per)));
      presets.replaceChildren(
        ...vals.map((v) => el('button', { type: 'button', 'aria-label': isUsd ? `$${v}` : `${v} ${U.name}`,
          on: { click: () => setAmount(String(v)) } }, isUsd ? `$${v}` : String(v))),
        el('button', { type: 'button', class: 'is-max', 'aria-label': 'Max: the most you can buy',
          on: { click: () => setAmount(maxBuyText()) } }, 'Max'));
    } else {
      setText(unit, '%');
      amountIn.setAttribute('aria-label', `How much of your ${tk || 'coins'} to sell, in percent`);
      presets.replaceChildren(...[25, 50, 75, 100].map((v) => el('button', { type: 'button',
        on: { click: () => setAmount(String(v)) } }, `${v}%`)));
    }
  }
  function maxBuyText() {
    const m = market.maxBuy(ctx.settings().priority);
    // (SOL to the thousandth, dollars whole, ETH or BNB to the hundred-thousandth: always at most what's there)
    const v = isUsd ? Math.floor(m * px) : U.id === 'sol' ? Math.floor(m * 1000) / 1000 : Math.floor(m * U.per * 1e5) / 1e5;
    return v > 0 ? String(v) : '0';
  }
  function setAmount(v) {
    amountIn.value = v;
    syncAmt();
    setText(errBox, '');
    quote();
    if (!coarse.matches) amountIn.focus();
  }
  function ask() {
    const v = parseAmount(amountIn.value);
    if (B.coin === null || !(v > 0)) return null;
    const s = ctx.settings();
    if (B.side === 'buy') return { coin: B.coin, side: 'buy', sol: v / U.per, slippage: s.slippage, priority: s.priority };
    if (v > 100) return { bad: true };
    return { coin: B.coin, side: 'sell', frac: v / 100, slippage: s.slippage, priority: s.priority };
  }
  function quote() {
    const a = ask();
    const r = B.coin !== null ? market.row(B.coin) : null;
    const tk = r ? `$${r.ticker}` : '';
    if (!a) return setText(quoteBox, '');
    if (a.bad) return setText(quoteBox, 'At most 100%.');
    const q = market.quote(a);
    if (!q.ok) return setText(quoteBox, orderError(q.error));
    const fees = q.fees.terminal + q.fees.market + q.fees.network;
    if (a.side === 'buy') {
      return setText(quoteBox, `you receive ≈ ${tokens(q.tokens)} ${tk} · price impact ${share(Math.max(0, q.impact))} · fees ${M(fees)}${q.enough ? '' : ` · not enough ${U.name}`}`);
    }
    return setText(quoteBox, `you receive ≈ ${M(q.got)} · price impact ${share(Math.max(0, -q.impact))} · fees ${M(fees)}`);
  }
  function place() {
    const a = ask();
    if (!a) return setText(errBox, B.side === 'buy' ? 'Type how much to buy.' : 'Pick how much to sell.');
    if (a.bad) return setText(errBox, 'At most 100%.');
    const r = ctx.order({ coin: a.coin, side: a.side, sol: a.sol, frac: a.frac });
    if (!r || !r.ok) return setText(errBox, orderError(r && r.error) || 'That didn\'t go through.');
    setText(errBox, '');
    if (tradeSheet.open) tradeSheet.close();
    return undefined;
  }

  // the trade panel as a sheet on phones (the same panel: it moves into the sheet and back)
  const sheetT = el('h2', { class: 'tsb-sheet-t' }, 'Trade');
  const tradeSheet = el('dialog', { class: 'tsb-sheet is-trade', 'aria-label': 'Trade' },
    el('div', { class: 'tsb-sheet-head' }, sheetT,
      el('button', { class: 'tsb-x', type: 'button', 'aria-label': 'Close', on: { click: () => tradeSheet.close() } }, icon('close'))));
  tradeSheet.addEventListener('close', () => {
    tradeSlot.append(tradePanel);
  });
  tradeSheet.addEventListener('click', (e) => {
    if (e.target === tradeSheet) tradeSheet.close();
  });
  function openTradeSheet(side) {
    if (B.coin === null || tradeSheet.open) return;
    if (bagSheet.open) bagSheet.close();
    const s = market.stats(B.coin);
    const holding = Boolean(s && s.me && s.me.tokens > 0);
    setSide(side === 'sell' && holding ? 'sell' : 'buy');
    const r = market.row(B.coin);
    const t = r ? `Trade $${r.ticker}` : 'Trade';
    setText(sheetT, t);
    tradeSheet.setAttribute('aria-label', t);
    tradeSheet.append(tradePanel);
    tradeSheet.showModal();
    if (!coarse.matches) amountIn.focus();
    else {
      const b = sideBtns.find((x) => x.dataset.side === B.side);
      if (b) b.focus();
    }
  }

  function openCoin(id) {
    if (!Number.isInteger(id) || !market.row(id)) return;
    if (bagSheet.open) bagSheet.close();
    const first = B.view !== 'coin';
    const changed = B.coin !== id;
    B.view = 'coin';
    B.coin = id;
    boardView.hidden = true;
    coinView.hidden = false;
    root.dataset.view = 'coin';
    workspace?.coin(id);
    if (first) ctx.pushSub();
    if (changed) {
      B.cd = { id: null, arr: [] };
      thread.replaceChildren();
      holdBody.replaceChildren();
      tradesBody.replaceChildren();
      aboutEl.replaceChildren();
      B.coinRender = null;
      B.tagKey = null;
      B.socKey = null;
      chPic.replaceChildren(pic(market.row(id), 'is-ch'));
      if (typeof ctx.onCoin === 'function') ctx.onCoin(id);
    }
    setSide(changed ? 'buy' : B.side);
    fast(true);
    slow(true);
    syncNav();
    scrollTop();
    chName.focus({ preventScroll: true });
  }
  function closeCoin(fromPop = false) {
    if (B.view !== 'coin') return;
    const a = document.activeElement;
    const inside = !a || a === document.body || coinView.contains(a) || tradeSheet.contains(a);
    const was = B.coin;
    B.view = 'board';
    B.coin = null;
    if (tradeSheet.open) tradeSheet.close();
    coinView.hidden = true;
    boardView.hidden = false;
    root.dataset.view = 'board';
    workspace?.coin(null);
    if (typeof ctx.onCoin === 'function') ctx.onCoin(null);
    if (!fromPop) ctx.popSub();
    renderBoard();
    syncNav();
    scrollTop();
    if (inside) {
      // the keyboard back on the coin it came from (or the board's first heading)
      const card = [...grid.children].find((n) => n.dataset.key === String(was));
      if (card) card.focus();
      else if (workspace) workspace.focusCoin(was);
      else kothH.focus({ preventScroll: true });
    }
  }

  function renderCoinFast(force) {
    const id = B.coin;
    const s = market.stats(id);
    if (!s) return;
    const f = info(id);
    if (!samePic(chPic.firstElementChild, s)) chPic.replaceChildren(pic(market.row(id) || s, 'is-ch'));
    setText(chTk, s.ticker);
    setText(chFull, s.name);
    setText(chAge, ago(s.age));
    chReal.hidden = !s.live;
    chFrom.hidden = !s.live;
    if (s.live) setText(chFrom, fromWords(s));
    // a contract's first characters only (never its end)
    setText(chCa, f && typeof f.mint === 'string' ? `CA ${f.mint.slice(0, 6)}…` : 'CA —');
    setText(chMcv, mc(s.mc));
    setText(chMcch, `${pct(s.change5m)} · 5m`);
    tone(chMcch, s.change5m, 0.0005);
    setText(chStats.dd.vol, usd(s.vol * px));
    setText(chStats.dd.hold, num(s.holders));
    setText(chStats.dd.ath, mc(s.ath));
    setText(chStats.dt.liq, s.phase === 'pool' ? 'Liquidity' : 'In the curve');
    setText(chStats.dd.liq, usd(s.liq * px));
    const devGone = s.devSold >= 0.999 && s.dev < 0.0005;
    // (a real coin's dev isn't followed: no chip rather than a guess)
    chDev.hidden = Boolean(s.live);
    setText(chDev, devGone ? 'Dev sold' : `Dev ${share(s.dev)}`);
    flag(chDev, 'is-warn', !devGone && s.dev > 0.05);
    // its curve in a line (phones: the trade column's boxes are under Info)
    if (s.phase === 'pool') setText(chCurveT, 'Graduated: trading in its pool');
    else if (s.phase === 'migrating') setText(chCurveT, 'Migrating to its pool');
    else setText(chCurveT, `Bonding curve ${share(s.progress, 0)}`);
    setP(chCurveBar, s.phase === 'curve' ? s.progress : 1);
    flag(chCurveBar, 'is-mig', s.phase === 'migrating');
    // the chart
    const C = B.cd;
    // (a real coin's older history may come in later: then all of it again)
    if (C.id !== id || C.v !== s.cdv) {
      C.id = id;
      C.v = s.cdv;
      C.arr = market.candles(id) || [];
    } else {
      const last = C.arr.length ? C.arr[C.arr.length - 1].t : null;
      const more = last === null ? market.candles(id) || [] : market.candles(id, last) || [];
      if (more.length) {
        if (last !== null && more[0].t === last) C.arr.pop();
        for (const x of more) C.arr.push(x);
        if (C.arr.length > 5000) C.arr.splice(0, C.arr.length - 4000);
      }
    }
    const marks = market.orders(120).filter((o) => o.coin === id && o.status === 'filled').map((o) => ({ t: o.doneAt, side: o.side }));
    chart.set({ candles: C.arr, solUsd: px, marks, tf: B.tf, migratedAt: s.migratedAt, base: clockBase });
    setText(tabN.holders, num(s.holders));
    setText(tabN.thread, num(s.replies));
    renderTrade(s, force);
    setText(tradeBtnT, `Trade $${s.ticker}`);
    if (B.tab === 'trades') renderTrades(id);
  }
  function renderTrade(s, force) {
    const me = s.me;
    const holding = Boolean(me && me.tokens > 0);
    const tk = `$${s.ticker}`;
    if (B.side === 'sell') setText(holdLine, holding ? `You hold ${tokens(me.tokens)} ${tk} · ${M(me.value)}` : `You don't hold any ${tk}`);
    else setText(holdLine, `Balance ${M(market.player.sol)}${holding ? ` · ${tokens(me.tokens)} ${tk}` : ''}`);
    const set = ctx.settings();
    setText(slipV, `${share(set.slippage, 0)} · ${set.priority}`);
    // a migrating coin can't be traded: its button says so (faded, and "off" for screen readers), and still explains why when pressed
    const off = s.phase === 'migrating';
    flag(placeBtn, 'is-off', off);
    if (placeBtn.getAttribute('aria-disabled') !== String(off)) placeBtn.setAttribute('aria-disabled', String(off));
    placeLabel();
    if (force || amountIn.value) quote();
  }

  function renderTrades(id) {
    const list = market.trades(id, 25) || [];
    const seen = new Map();
    const items = list.map((t) => {
      const k = `${t.t}|${t.side}|${t.tok}|${t.addr || t.label}`;
      const n = (seen.get(k) || 0) + 1;
      seen.set(k, n);
      return { ...t, key: n > 1 ? `${k}#${n}` : k };
    });
    if (!items.length) items.push({ key: 'empty', empty: true });
    keyed(tradesBody, items, (t) => t.key, (t) => {
      if (t.empty) return el('tr', { class: 'tsb-empty' }, el('td', { colSpan: 6 }, 'No trades yet'));
      return el('tr', { class: [t.side === 'buy' ? 'is-buy' : 'is-sell', t.me && 'is-me'] },
        el('td', { class: 'tsb-acct' }, t.me ? 'You' : t.kol ? `@${t.kol}` : short(t.addr || t.label)),
        el('td', { class: 'tsb-type' }, t.side === 'buy' ? 'Buy' : 'Sell'),
        el('td', { class: 'tsb-num' }, MN(t.sol)),
        el('td', { class: 'tsb-num tsb-c-amt' }, tokens(t.tok)),
        el('td', { class: 'tsb-num tsb-c-mc' }, mc(t.mc)),
        el('td', { class: 'tsb-num tsb-when' }));
    }, (tr, t) => {
      if (!t.empty) setText(tr.lastChild, age(market.t - t.t));
    });
  }

  function renderCoinSlow() {
    const id = B.coin;
    const s = market.stats(id);
    const f = info(id);
    if (!s || !f) return;
    // its tags and socials (made again only when they change)
    const keys = tagsOf(s, true);
    const key = keys.join('|');
    if (key !== B.tagKey) {
      B.tagKey = key;
      chTags.replaceChildren(...keys.map(tagEl));
    }
    const soc = s.socials || {};
    const sk = SOCIALS.map(([k]) => (soc[k] ? 1 : 0)).join('');
    if (sk !== B.socKey) {
      B.socKey = sk;
      const on = SOCIALS.filter(([k]) => soc[k]);
      chSocs.replaceChildren(...(on.length ? on.map(([, label]) => el('span', { class: 'tsb-chip' }, label))
        : [el('span', { class: 'tsb-chip is-off' }, 'No socials')]));
    }
    if (B.coinRender !== id || B.aboutPic !== (s.pic || '')) {
      B.coinRender = id;
      B.aboutPic = s.pic || '';
      renderAbout(s, f);
    }
    if (!phone.matches || B.tab === 'info') renderBoxes(s, f);
    if (B.tab === 'holders') renderHolders(id, s);
    if (B.tab === 'thread') renderThread(id, s, f);
    const label = `Market cap chart: ${mc(s.mc)}`;
    if (canvas.getAttribute('aria-label') !== label) canvas.setAttribute('aria-label', label);
  }

  function renderAbout(s, f) {
    const soc = s.socials || {};
    aboutEl.replaceChildren(
      el('div', { class: 'tsb-about-h' }, pic(market.row(s.id) || s, 'is-about'),
        el('div', { class: 'tsb-about-t' }, el('b', {}, s.name), el('span', {}, `$${s.ticker}`))),
      f.line ? el('p', { class: 'tsb-about-line' }, f.line) : null,
      el('div', { class: 'tsb-socials' }, SOCIALS.map(([k, label]) => el('span', { class: ['tsb-chip', !soc[k] && 'is-off'] },
        soc[k] ? label : `No ${label}`))),
      f.live
        ? el('p', { class: 'tsb-note' }, `A real coin ${fromWords(f)}, shown as its maker named it. Your trades here are play money and never leave this page.`)
        : el('p', { class: 'tsb-note' }, `Dev record: ${num(f.devCoins)} coin${f.devCoins === 1 ? '' : 's'} launched before · ${num(f.devMigrated)} graduated`));
  }

  // its numbers over the window picked: the last 5 minutes, the last hour, or since its launch
  function windowStats(s) {
    const since = market.t - WIN_S[B.win];
    let ch;
    let vol;
    let tx;
    if (B.win === '5m') {
      ch = s.change5m;
      vol = s.vol5m;
      tx = s.txns5m;
    } else if (B.win === '1h') {
      ch = s.change1h;
      vol = s.vol1h;
      tx = s.txns1h;
    } else {
      ch = Number.isFinite(s.changeAll) ? s.changeAll : s.mc / START_MC - 1;
      vol = s.vol;
      tx = s.txns;
    }
    tx = Number.isFinite(tx) ? tx : 0;
    vol = Number.isFinite(vol) ? vol : 0;
    let buys;
    let sells;
    if (B.win === '5m' && Number.isFinite(s.buys5m)) {
      buys = s.buys5m;
      sells = s.sells5m;
    } else {
      // the candles count each trade's side: their split, scaled to the window's trades
      let b = 0;
      let n = 0;
      if (B.cd.id === s.id) {
        for (const c of B.cd.arr) {
          if (c.t >= since) {
            b += c.b || 0;
            n += (c.b || 0) + (c.s || 0);
          }
        }
      }
      buys = n > 0 ? Math.round(tx * (b / n)) : 0;
      sells = n > 0 ? Math.max(0, tx - buys) : 0;
    }
    // the volume's split from its latest trades in the window
    let bv = 0;
    let sv = 0;
    for (const t of market.trades(s.id, 120) || []) {
      if (t.t < since) continue;
      if (t.side === 'buy') bv += t.sol;
      else sv += t.sol;
    }
    const r = bv + sv > 0 ? bv / (bv + sv) : buys + sells > 0 ? buys / (buys + sells) : 0;
    const bvol = vol * r;
    return { ch, vol, tx, buys, sells, bv: bvol, sv: Math.max(0, vol - bvol) };
  }

  function renderBoxes(s, f) {
    // its stats
    const w = windowStats(s);
    setText(sRows.dd.ch, pct(w.ch));
    tone(sRows.dd.ch, w.ch, 0.0005);
    setText(sRows.dd.vol, usd(w.vol * px));
    setText(sRows.dd.tx, num(w.tx));
    setText(split1.a, num(w.buys));
    setText(split1.b, num(w.sells));
    setSplit(split1.bar, w.buys, w.sells);
    setText(split2.a, usd(w.bv * px));
    setText(split2.b, usd(w.sv * px));
    setSplit(split2.bar, w.bv, w.sv);
    // its audit
    const ad = audit.dd;
    const warn = (k, on) => flag(audit.row[k], 'is-warn', on);
    setText(ad.top10, share(s.top10));
    warn('top10', s.top10 > 0.3);
    setText(ad.dev, share(s.dev));
    warn('dev', s.dev > 0.05);
    setText(ad.devsold, share(s.devSold));
    warn('devsold', s.devSold >= 0.5);
    const both = (n, p) => (Number.isFinite(n) ? `${num(n)} · ${share(p)}` : '—');
    setText(ad.snipers, both(s.snipersN, s.snipers));
    warn('snipers', s.snipers > 0.1);
    setText(ad.bundlers, both(s.bundlersN, s.bundlers));
    warn('bundlers', s.bundlers > 0.1);
    setText(ad.insiders, both(s.insidersN, s.insiders));
    warn('insiders', s.insiders > 0.1);
    setText(ad.smart, num(s.smart));
    setText(ad.kols, num(Array.isArray(s.kols) ? s.kols.length : 0));
    setText(ad.whales, num(s.whales));
    // the bonding curve
    flag(curveBar, 'is-mig', s.phase === 'migrating');
    if (s.phase === 'pool') {
      setText(curveV, '100%');
      setP(curveBar, 1);
      setText(curveTxt, `Graduated${s.migratedAt !== null ? ` ${age(market.t - s.migratedAt)} ago` : ''}: it trades in its own pool now, with ${usd(s.liq * px)} of liquidity.`);
    } else if (s.phase === 'migrating') {
      setText(curveV, '100%');
      setP(curveBar, 1);
      setText(curveTxt, 'The curve is sold out: it\'s moving into its pool. Trading opens again in a moment.');
    } else if (s.live && s.src !== 'pump.fun') {
      // another launchpad's curve: only how far along it is, as its source says
      setText(curveV, share(s.progress, 0));
      setP(curveBar, s.progress);
      setText(curveTxt, Number.isFinite(s.progress) ? `${share(s.progress, 0)} of its launchpad's curve is sold, as its source says. When it's all sold, the coin moves into a trading pool.`
        : 'Still on its launchpad\'s curve. When it\'s all sold, the coin moves into a trading pool.');
    } else {
      setText(curveV, share(s.progress, 0));
      setP(curveBar, s.progress);
      setText(curveTxt, `When the market cap reaches ${usd(GRAD_MC * px)}, all of the curve's liquidity moves into a trading pool. There are ${tokens(CURVE_TOK * (1 - s.progress))} tokens still for sale on the curve, and ${isUsd ? usd(s.curveSol * px) : `${MN(s.curveSol)} ${U.name}`} in it.`);
    }
    // the king of the hill's race
    const king = market.lists({ limit: 30 }).koth;
    if (s.koth) {
      setText(kingV, 'King');
      setP(kingBar, 1);
      setText(kingTxt, `It's the king of the hill${s.kothAt !== null && s.kothAt !== undefined ? `, crowned ${age(market.t - s.kothAt)} ago` : ''}.`);
    } else if (s.phase !== 'curve') {
      setText(kingV, '—');
      setP(kingBar, 1);
      setText(kingTxt, 'Only coins still on their curve race for the crown.');
    } else if (king) {
      const x = king.mc > 0 ? s.mc / king.mc : 0;
      setText(kingV, share(Math.min(1, x), 0));
      setP(kingBar, x);
      setText(kingTxt, `Dethrone the current king, $${king.ticker}, at ${mc(king.mc)} market cap.`);
    } else {
      const x = s.progress / 0.5;
      setText(kingV, share(Math.min(1, x), 0));
      setP(kingBar, x);
      setText(kingTxt, 'No king yet: the first coin halfway up its curve takes the crown.');
    }
    // its pool
    setText(pool.dd.pair, s.pair || (U.id !== 'sol' && U.id !== 'usd' ? U.name : 'SOL'));
    setText(pool.dt.liq, s.phase === 'pool' ? 'Liquidity' : 'In the curve');
    setText(pool.dd.liq, isUsd ? usd(s.liq * px) : `${usd(s.liq * px)} (${MN(s.liq)} ${U.name})`);
    setText(pool.dd.mc, mc(s.mc));
    setText(pool.dd.ath, mc(s.ath));
    setText(pool.dd.born, ago(s.age));
    setText(pool.dd.dev, f.live ? short(f.devAddr) : `${f.dev} · ${short(f.devAddr)}`);
    setText(pool.dd.ca, typeof f.mint === 'string' ? `${f.mint.slice(0, 6)}…` : '—');
  }

  function renderHolders(id, s) {
    const h = market.holders(id, 20);
    if (!h) return;
    const items = [];
    if (h.pool && h.pool.pct > 0) {
      items.push({ key: 'pool', pool: true, name: h.pool.kind === 'pool' ? 'Liquidity pool' : 'Bonding curve', tag: '',
        pct: h.pool.pct, tok: h.pool.tok });
    }
    for (const x of h.list) {
      const value = x.tok * s.price;
      items.push({ key: x.addr, name: x.me ? 'You' : x.kol ? `@${x.kol}` : short(x.addr), tag: x.me || x.kol ? '' : holderTag(x.label),
        pct: x.pct, tok: x.tok, me: x.me, value, pnl: (x.out || 0) + value - (x.in || 0), at: x.at });
    }
    if (s.live) items.push({ key: 'note', empty: true, note: 'Other holders aren\'t followed for live coins.' });
    if (!items.length) items.push({ key: 'empty', empty: true });
    keyed(holdBody, items, (x) => x.key, (x) => {
      if (x.empty) return el('tr', { class: 'tsb-empty' }, el('td', { colSpan: 6 }, x.note || 'No holders yet'));
      const $ = { name: el('span', { class: 'tsb-hname' }), tag: el('span', { class: 'tsb-htag' }), pct: el('td', { class: 'tsb-num' }),
        amt: el('td', { class: 'tsb-num tsb-c-amt' }), val: el('td', { class: 'tsb-num tsb-c-val' }),
        pnl: el('td', { class: 'tsb-num tsb-c-pnl' }), when: el('td', { class: 'tsb-num tsb-c-when' }) };
      const tr = el('tr', {}, el('td', { class: 'tsb-acct' }, $.name, $.tag), $.pct, $.amt, $.val, $.pnl, $.when);
      tr.$ = $;
      return tr;
    }, (tr, x) => {
      if (x.empty) return;
      const $ = tr.$;
      flag(tr, 'is-pool', Boolean(x.pool));
      flag(tr, 'is-me', Boolean(x.me));
      setText($.name, x.name);
      setText($.tag, x.tag);
      setText($.pct, share(x.pct));
      setText($.amt, tokens(x.tok));
      if (x.pool) {
        setText($.val, '—');
        setText($.pnl, '—');
        setText($.when, '—');
        tone($.pnl, 0, 1);
        return;
      }
      setText($.val, MN(x.value));
      setText($.pnl, MS(x.pnl));
      tone($.pnl, x.pnl, 1e-9);
      setText($.when, Number.isFinite(x.at) ? age(market.t - x.at) : '—');
    });
  }

  function renderThread(id, s, f) {
    const cm = (market.comments(id, 20) || []).slice().reverse();
    const seen = new Map();
    const items = [{ key: 'op', u: f.dev, x: f.live ? `${s.name} ($${s.ticker}): its thread isn't shown here.` : f.line || `${s.name} ($${s.ticker})`, t: s.born, op: true },
      ...cm.map((c) => {
        const k = `${c.t}|${c.u}|${hueOf(c.x)}`;
        const n = (seen.get(k) || 0) + 1;
        seen.set(k, n);
        return { key: n > 1 ? `${k}#${n}` : k, u: c.u, x: c.x, t: c.t, op: false };
      })];
    keyed(thread, items, (x) => x.key, (x) => {
      const when = el('span', { class: 'tsb-when' });
      const li = el('li', { class: ['tsb-post', x.op && 'is-op'] },
        el('span', { class: 'tsb-av', 'aria-hidden': 'true', vars: { '--h': hueOf(x.u) } }, initial(x.u)),
        el('div', { class: 'tsb-post-b' },
          el('p', { class: 'tsb-post-h' }, el('b', {}, x.u), x.op ? el('span', { class: 'tsb-tag is-dev' }, 'dev') : null, when),
          el('p', { class: 'tsb-post-x' }, x.x)));
      li.$when = when;
      return li;
    }, (li, x) => setText(li.$when, ago(market.t - x.t)));
  }

  // ---------- the bag ----------
  const bagSol = el('dd', {}, '—');
  const bagWorth = el('dd', {}, '—');
  const pendList = el('ul', { class: 'tsb-pend', 'aria-label': 'Orders on their way' });
  const posList = el('ul', { class: 'tsb-pos', 'aria-label': 'Your coins' });
  const bagEmpty = el('p', { class: 'tsb-bag-empty' }, 'Nothing yet. Pick a coin on the board and buy a little.');
  const bagH = el('h2', { class: 'tsb-bag-h', tabIndex: -1 }, 'Your bag');
  const bag = el('div', { class: 'tsb-bag' }, bagH,
    el('dl', { class: 'tsb-bag-sum' }, el('div', {}, el('dt', {}, 'Balance'), bagSol), el('div', {}, el('dt', {}, 'Worth'), bagWorth)),
    pendList, posList, bagEmpty);
  const side = el('aside', { class: 'tsb-aside', 'aria-label': 'Your bag' }, bag);
  const bagSheet = el('dialog', { class: 'tsb-sheet is-bag', 'aria-label': 'Your bag' },
    el('div', { class: 'tsb-sheet-head' }, el('h2', { class: 'tsb-sheet-t' }, 'Your bag'),
      el('button', { class: 'tsb-x', type: 'button', 'aria-label': 'Close', on: { click: () => bagSheet.close() } }, icon('close'))));
  bagSheet.addEventListener('close', () => {
    side.append(bag);
    syncNav();
  });
  bagSheet.addEventListener('click', (e) => {
    if (e.target === bagSheet) bagSheet.close();
  });
  function openBag() {
    if (wide.matches && !workspace) {
      bagH.focus();
      return;
    }
    if (tradeSheet.open) tradeSheet.close();
    if (bagSheet.open) return;
    bagSheet.append(bag);
    bagSheet.showModal();
    renderBag();
    syncNav();
  }

  function renderBag() {
    const p = market.player;
    setText(bagSol, M(p.sol));
    setText(bagWorth, M(p.worth));
    const pend = (market.orders(40) || []).filter((o) => o.status === 'pending');
    keyed(pendList, pend, (o) => o.id, (o) => el('li', { class: 'tsb-pend-i' },
      el('span', { class: 'tsb-spin', 'aria-hidden': 'true' }),
      el('span', {}, o.side === 'buy' ? `Buying ${M(o.sol)} of $${o.ticker}…` : `Selling ${share(o.frac, 0)} of $${o.ticker}…`)));
    const pos = (market.positions() || []).filter((x) => x.open || market.t - x.last < 120).slice(0, 12);
    keyed(posList, pos, (x) => x.id, (x) => {
      const v = el('span', { class: 'tsb-pos-v' });
      const pp = el('span', { class: 'tsb-pos-p' });
      const sells = el('div', { class: 'tsb-pos-sells', role: 'group', 'aria-label': `Sell $${x.ticker}` },
        el('button', { class: 'tsb-pos-sell', type: 'button', 'aria-label': `Sell 50% of $${x.ticker}`, on: { click: () => quickSell(x.id, 0.5) } }, 'Sell 50%'),
        el('button', { class: 'tsb-pos-sell', type: 'button', 'aria-label': `Sell all $${x.ticker}`, on: { click: () => quickSell(x.id, 1) } }, 'Sell all'));
      const li = el('li', { class: 'tsb-posrow' },
        el('button', { class: 'tsb-posopen', type: 'button', on: { click: () => openCoin(x.id) } },
          pic(market.row(x.id) || x, 'is-pos'), el('span', { class: 'tsb-pos-t' }, el('b', {}, `$${x.ticker}`), v), pp),
        sells);
      li.$ = { v, pp, sells };
      return li;
    }, (li, x) => {
      const r = market.row(x.id);
      const tile = li.querySelector('.tsb-pic');
      if (tile && r && !samePic(tile, r)) tile.replaceWith(pic(r, 'is-pos'));
      setText(li.$.v, x.open ? `${tokens(x.tokens)} · ${M(x.value)}` : 'Sold');
      setText(li.$.pp, `${x.total >= 0 ? '+' : '−'}${M(Math.abs(x.total))} (${pct(x.pnlPct)})`);
      tone(li.$.pp, x.total, 0);
      li.$.sells.hidden = !x.open;
    });
    bagEmpty.hidden = pend.length + pos.length > 0;
    const n = pos.filter((x) => x.open).length;
    setText(navBagN, n ? String(n) : '');
  }
  function quickSell(id, frac) {
    const s = ctx.settings();
    ctx.order({ coin: id, side: 'sell', frac, slippage: s.slippage, priority: s.priority });
  }

  // ---------- phones: the tab bar ----------
  const navBagN = el('i', { class: 'tsb-navn', 'aria-hidden': 'true' });
  const navBtn = (cls, ic, label, extra, onClick) => el('button', { class: ['tsb-nav-b', cls], type: 'button', on: { click: onClick } },
    ic, el('span', { class: 'tsb-nav-l' }, label), extra);
  const navBoard = navBtn('is-board', glyph('home', 'ts-icon tsb-nav-ic'), 'Board', null, () => {
    if (bagSheet.open) bagSheet.close();
    if (B.view === 'coin') closeCoin();
    else scrollTop();
    syncNav();
  });
  const navSearch = navBtn('is-search', icon('search', 'ts-icon tsb-nav-ic'), 'Search', null, () => {
    if (bagSheet.open) bagSheet.close();
    scrollTop();
    searchIn.focus();
  });
  const navBag = navBtn('is-bag', icon('bag', 'ts-icon tsb-nav-ic'), 'Bag', navBagN, () => (bagSheet.open ? bagSheet.close() : openBag()));
  const navSet = navBtn('is-set', icon('sliders', 'ts-icon tsb-nav-ic'), 'Settings', null, () => {
    if (bagSheet.open) bagSheet.close();
    ctx.openSettings();
  });
  const nav = el('nav', { class: 'tsb-nav', 'aria-label': 'Pomp.fun' }, navBoard, navSearch, navBag, navSet);
  function syncNav() {
    flag(navBag, 'is-on', bagSheet.open);
    const onBoard = B.view === 'board' && !bagSheet.open;
    flag(navBoard, 'is-on', onBoard);
    if (onBoard) navBoard.setAttribute('aria-current', 'page');
    else navBoard.removeAttribute('aria-current');
  }

  // ---------- the live boxes: the latest trade and the latest launch ----------
  function renderFlashes(L) {
    const tp = market.tape(3) || [];
    let t = null;
    for (const x of tp) if (!t || x.t > t.t) t = x;
    if (t && (!B.trade || t.t !== B.trade.t || t.coin !== B.trade.coin || t.sol !== B.trade.sol)) {
      B.trade = t;
      const r = market.row(t.coin);
      flashTrade.replaceChildren(pic(r || {}, 'is-xs'), el('span', { class: 'tsb-flash-t' }, `${whoText(t.label)} `,
        el('b', { class: ['tsb-verb', t.side === 'buy' ? 'is-up' : 'is-down'] }, t.side === 'buy' ? 'bought' : 'sold'),
        ` ${M(t.sol)} of $${t.ticker}`));
      flashTrade.onclick = () => openCoin(t.coin);
      flashTrade.hidden = false;
      bump(flashTrade);
    }
    const nw = L.new && L.new[0];
    if (nw && B.launch !== nw.id) {
      B.launch = nw.id;
      const f = info(nw.id);
      flashLaunch.replaceChildren(pic(nw, 'is-xs'), el('span', { class: 'tsb-flash-t' }, `${f ? f.dev : 'someone'} `,
        el('b', { class: 'tsb-verb is-made' }, 'created'), ` $${nw.ticker}`));
      flashLaunch.onclick = () => openCoin(nw.id);
      flashLaunch.hidden = false;
      bump(flashLaunch);
    }
  }
  function bump(n) {
    if (ctx.reduceMotion) return;
    n.classList.remove('is-new');
    void n.offsetWidth;
    n.classList.add('is-new');
  }

  // ---------- the whole terminal ----------
  const root = el('div', { class: 'tsb pomp', data: { view: 'board', tab: B.tab } }, head,
    el('div', { class: 'tsb-body' }, el('div', { class: 'tsb-main' }, boardView, coinView), side), nav, tradeSheet, bagSheet);
  workspace = createPompWorkspace({ market, ctx, openCoin, openBag, closeCoin, searchForm, walletBtn, brand: head.firstChild });
  boardView.replaceChildren(workspace.el);
  head.replaceChildren(workspace.promo, workspace.header, workspace.watchStrip);
  workspace.header.prepend(backBtn);
  coinView.prepend(workspace.coinCalls);
  root.prepend(workspace.rail);
  root.append(workspace.foot, workspace.mobileNav, ...workspace.dialogs);
  searchIn.placeholder = 'Search for coins…';
  host.append(root);
  setSide('buy');

  function fast(force) {
    const p = market.player;
    setText(walletAmt, isUsd ? usd(p.sol * px) : MN(p.sol));
    if (B.view === 'coin') renderCoinFast(force);
    if (bagSheet.open) renderBag();
  }
  function slow() {
    if (B.view === 'board') renderBoard();
    else { renderCoinSlow(); workspace.update(); }
  }
  fast(true);
  slow(true);
  syncNav();

  const onWide = () => {
    if (wide.matches && bagSheet.open) bagSheet.close();
  };
  const onPhone = () => {
    if (phone.matches) return;
    if (tradeSheet.open) tradeSheet.close();
    if (B.tab === 'info') setTab('holders');
  };
  wide.addEventListener('change', onWide);
  phone.addEventListener('change', onPhone);
  document.addEventListener('keydown', onSlash);

  return {
    el: root,
    update(now) {
      if (B.dead) return;
      if (now - B.fastAt >= FAST_MS) {
        B.fastAt = now;
        fast(false);
      }
      if (now - B.slowAt >= SLOW_MS) {
        B.slowAt = now;
        slow(false);
      }
    },
    // the coin page is open (the shell's history knows it as a step)
    sub: () => B.view === 'coin',
    closeSub: () => closeCoin(true),
    openCoin,
    destroy() {
      B.dead = true;
      clearTimeout(searchTimer);
      chart.destroy();
      workspace.destroy();
      wide.removeEventListener('change', onWide);
      phone.removeEventListener('change', onPhone);
      document.removeEventListener('keydown', onSlash);
      if (tradeSheet.open) tradeSheet.close();
      if (bagSheet.open) bagSheet.close();
      root.remove();
    },
  };
}
