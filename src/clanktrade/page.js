// Clank Tank (agi1.app/clanktrade): the Shark Tank of crypto on Robinhood Chain, an interactive concept for clank.trade.
// Five views, each at its own address (#live, #markets, #records, #studio, #thesis):
// - Live: the show. A broadcast stage (the 3D Vladcat pitcher, the AI shark panel or a chart), the Deal or No Deal
//   scoreboard (one clearing price for everyone, a refund below the deal line, and a verdict when the clock runs out),
//   capped one-tap follows of shark buys, due diligence, and the panel's transcript.
// - Markets: pitch anything. Live clank.trade coins and stock tokens, plus simulated Pons coins, perps and outcomes.
// - Records: permanent pitch cards and the shark P&L leaderboard. Studio: set up a pitch. Thesis: the memo and SDK.
// What is real and what is simulated is always marked: coins, stock tokens, trades, the ETH price and ClankChecker scans
// come from clank.trade (/api/checker); pitches, sharks, P&L, comments and play ETH are simulated, and nothing is sent
// onchain. Sections update in place, so the 3D stage loads once and typing never loses focus.

import '../styles/clanktrade.css';
import {
  ETH_USD_FALLBACK,
  CLANK_CONTRACTS,
  STOCK_PAIRS,
  FOLLOWER_TIERS,
  NOTABLE_FOLLOWERS,
  AI_SHARKS,
  FEE_SPLIT_KEYS,
  DEFAULT_FEE_SPLITS,
  INITIAL_LIVE_ROOMS,
  PITCH_ANYTHING_EXTRA,
  PITCH_RECORDS,
  SHARK_LEADERBOARD,
  MARKET_THESIS_FOR_BAOSKEE,
  aiPanelPnlUsd,
  clankCoinUrl,
  explorerTokenUrl,
  isChainAddress,
  createPrivateXProof,
  validateFeeSplits,
  rebalanceFeeSplits,
  formatFeeRouterSnippet,
  computeDealClearing,
  commitCapEth,
  commitToDeal,
  settleDeal,
  buildDueDiligenceReport,
  filterAndSortSharks,
  flashEventsFor,
  liveCoinToInventory,
  buildDeskRoomForCoin,
  buildDynamicSceneForCoin,
  generateSyntheticCandles,
} from './data.js';
import { EXTERNAL_WALLETS, createTankWallet, shortAddress } from './wallet.js';
import { createTankChart } from './chart.js';

const COMMENTS_STORAGE = 'clanktrade:comments:v2';
const MARK = '/games/trenchingsimulator/clank/clank-mark.svg';
const WORDMARK = '/games/trenchingsimulator/clank/clank-word.svg';
const AGI1_FACE = '/images/landing/agi1-face.webp';
const PANEL_PORTRAITS = Object.freeze({ 'agi1-dd': '/images/agi1-portrait-2d.webp' });
const VIEWS = Object.freeze([
  { id: 'live', label: 'Live' },
  { id: 'markets', label: 'Markets' },
  { id: 'records', label: 'Records' },
  { id: 'studio', label: 'Studio' },
  { id: 'thesis', label: 'Thesis' },
]);
const VIEW_IDS = new Set(VIEWS.map((v) => v.id));
const LEGACY_VIEWS = Object.freeze({ tank: 'live', 'pitch-anything': 'markets' });
const CAM_LABELS = Object.freeze({ pitcher: 'Pitcher', panel: 'Panel', chart: 'Chart' });
const FEE_LABELS = Object.freeze({
  lpPool: 'LP pool',
  jackpotPot: 'Holder jackpot',
  topHolders: 'Top holders',
  aiSharkTreasury: 'AI shark wallets',
  creator: 'Creator',
});
const MAX_REVIEW_ROOMS = 6;
const SVG_NS = 'http://www.w3.org/2000/svg';

// ---------- DOM helpers (no HTML strings: the site's CSP allows no inline scripts or styles) ----------
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'on') for (const [ev, fn] of Object.entries(v)) node.addEventListener(ev, fn);
    else if (k === 'data') for (const [dk, dv] of Object.entries(v)) node.dataset[dk] = String(dv);
    else if (k === 'style') for (const [sk, sv] of Object.entries(v)) node.style.setProperty(sk, String(sv)); // CSSOM, not an inline attribute
    else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'hidden' || k === 'open') node[k] = Boolean(v);
    else if (k === 'value') node.value = String(v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false || child === '') continue;
    node.append(typeof child === 'string' || typeof child === 'number' ? document.createTextNode(String(child)) : child);
  }
  return node;
}

function svg(tag, attrs = {}, ...children) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined && v !== false) node.setAttribute(k, String(v));
  for (const child of children.flat(Infinity)) if (child) node.append(child);
  return node;
}

const ICON_PATHS = Object.freeze({
  check: 'M3.5 8.4l2.9 2.9 6.1-6.6',
  external: 'M6.5 3.5h-3v9h9v-3M9.5 3.5h3v3M12.5 3.5L7.5 8.5',
  next: 'M6.2 3.6l4.4 4.4-4.4 4.4',
  back: 'M9.8 3.6L5.4 8l4.4 4.4',
  lock: 'M4.6 7.4h6.8v5.1H4.6zM6 7.4V5.6a2 2 0 014 0v1.8',
  copy: 'M6 6h6.5v6.5H6zM3.5 10V3.5H10',
  refresh: 'M12.4 8.2a4.4 4.4 0 11-1.3-3.3M12.6 3.4v2.4h-2.4',
  close: 'M4.2 4.2l7.6 7.6M11.8 4.2l-7.6 7.6',
});

function icon(name, cls = '') {
  return svg('svg', { class: `ct-icon ${cls}`.trim(), viewBox: '0 0 16 16', width: 16, height: 16, 'aria-hidden': 'true', focusable: 'false' },
    svg('path', { d: ICON_PATHS[name], fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
}

// ---------- Formatting ----------
function usd(n) {
  if (!Number.isFinite(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}
const trim = (s) => String(s).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
function ethNum(n, digits) {
  const v = Number(n) || 0;
  const d = digits ?? (Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : Math.abs(v) >= 1 ? 2 : 4);
  return trim(v.toFixed(d));
}
const eth = (n, digits) => `${ethNum(n, digits)} ETH`;
function signedPct(n, d = 1) {
  if (!Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}${Math.abs(n).toFixed(d)}%`;
}
const toneOf = (n) => (!Number.isFinite(n) || n === 0 ? '' : n > 0 ? 'is-up' : 'is-down');
const countFmt = (n) => (Number.isFinite(n) ? Number(n).toLocaleString('en-US') : '—');
function clock(secs) {
  const s = Math.max(0, Math.floor(secs || 0));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
// The big clock in Suisse: each digit in a fixed-width cell (the font has no tabular figures), so it never jitters
function setClockDigits(node, text) {
  node.setAttribute('aria-label', text);
  node.replaceChildren(...[...text].map((ch) => el('span', { class: ch === ':' ? 'c' : 'd', 'aria-hidden': 'true' }, ch)));
}
const usdExact = (n) => (Number.isFinite(n) ? `$${Math.round(n).toLocaleString('en-US')}` : '—');

const tagLive = (label = 'Live') => el('span', { class: 'ct-tag is-live', title: 'Live data from clank.trade' }, el('i', { class: 'ct-dot', 'aria-hidden': 'true' }), label);
const tagSim = (label = 'Simulated') => el('span', { class: 'ct-tag is-sim', title: 'Simulated for this demo. Play ETH only; nothing is sent onchain.' }, label);
const tagPlain = (label, tone = '') => el('span', { class: `ct-tag${tone ? ` is-${tone}` : ''}` }, label);

function coinArt(item, cls) {
  const letters = String(item?.ticker || '?').replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '?';
  const box = el('span', { class: `ct-art ${cls || ''}`.trim(), 'aria-hidden': 'true' }, letters);
  if (item?.image) {
    const img = el('img', { src: item.image, alt: '', loading: 'lazy', decoding: 'async' });
    img.addEventListener('error', () => img.remove(), { once: true });
    box.append(img);
  }
  return box;
}

function sparkline(values, { width = 96, height = 28, tone = '' } = {}) {
  const pts = (Array.isArray(values) ? values : []).filter(Number.isFinite);
  const box = svg('svg', { class: `ct-spark ${tone}`.trim(), viewBox: `0 0 ${width} ${height}`, width, height, 'aria-hidden': 'true', preserveAspectRatio: 'none' });
  if (pts.length < 2) return box;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const d = pts.map((v, i) => `${(i / (pts.length - 1)) * width},${height - 2 - ((v - min) / span) * (height - 4)}`).join(' ');
  box.append(svg('polyline', { points: d, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
  return box;
}

function loadSavedComments() {
  try {
    const raw = JSON.parse(localStorage.getItem(COMMENTS_STORAGE) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

function saveComments(map) {
  try { localStorage.setItem(COMMENTS_STORAGE, JSON.stringify(map)); } catch { /* storage unavailable */ }
}

function viewFromHash() {
  const raw = String(location.hash || '').replace(/^#/, '');
  if (VIEW_IDS.has(raw)) return raw;
  return LEGACY_VIEWS[raw] || 'live';
}

const cloneRoom = (r) => ({
  ...r,
  recentCommits: [...(r.recentCommits || [])],
  script: [...(r.script || [])],
  comments: [...(r.comments || [])],
  terms: r.terms ? { ...r.terms } : r.terms,
});
const hasRound = (room) => room.kind === 'deal' || room.kind === 'pitch';
// the 3D pitcher (three.js, about 600 KB) loads only when a stage shows it, so the page itself appears at once
const avatar = { host: null, inst: null, failed: false };
const camsFor = (room) => (room.kind === 'review' ? ['panel', 'chart']
  : room.kind === 'desk' ? ['panel']
    : room.stageType === 'vrm-vladcat' && avatar.failed ? ['panel', 'chart'] : ['pitcher', 'panel', 'chart']);

export function bootClankTrade(root) {
  if (!root) return;
  const wallet = createTankWallet();
  const savedComments = loadSavedComments();
  const reducedMotion = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  const state = {
    view: viewFromHash(),
    rooms: INITIAL_LIVE_ROOMS.map(cloneRoom),
    activeRoomId: INITIAL_LIVE_ROOMS[0].id,
    stageCam: 'pitcher',
    scriptCursor: 0,
    flashCursor: 0,
    ethUsd: ETH_USD_FALLBACK,
    ethLive: false,
    liveStatus: 'connecting', // 'connecting' | 'live' | 'down'
    liveCoins: [],
    liveStocks: STOCK_PAIRS.map((s) => ({ ...s, sparkline: s.spark, isLive: false })),
    recentTrades: [],
    tapeSig: '',
    scans: new Map(),
    candles: new Map(),
    markets: { category: 'all', pair: 'all', query: '' },
    records: { filter: 'all', sort: 'pnl', query: '', selectedId: SHARK_LEADERBOARD[0].id },
    studio: {
      name: 'Neo Tokyo AI',
      ticker: 'NTOKYO',
      pairSymbol: 'SPCX',
      minRaiseEth: 20,
      hardCapEth: 45,
      creatorAllocPct: 2,
      lockDays: 90,
      pitchHook: 'A uniform-clearing Robinhood Chain pitch, paired with live SPCX stock flow, with programmable holder jackpots.',
      xHandle: 'founder_anon',
      xTier: '500K+ followers',
      xNotable: ['@elonmusk', '@pmarca', '@baoskee'],
      revealHandle: false,
      feeSplits: { ...DEFAULT_FEE_SPLITS },
    },
    commitInput: '0.5',
    episodeCounter: Math.max(...INITIAL_LIVE_ROOMS.map((r) => r.episode || 0)),
  };

  const practiceHoldings = new Map();
  const currentRoom = () => state.rooms.find((r) => r.id === state.activeRoomId) || state.rooms[0];
  const currentLine = () => {
    const room = currentRoom();
    return room.script[state.scriptCursor % room.script.length] || room.script[0];
  };
  function replaceRoom(next) {
    const i = state.rooms.findIndex((r) => r.id === next.id);
    if (i >= 0) state.rooms[i] = next;
  }
  function speakerName(speaker, room) {
    if (speaker === 'PITCHER') return 'Pitcher';
    if (speaker === 'NARRATOR') return 'Narrator';
    if (speaker === 'AUDIENCE') return 'Audience';
    return speaker;
  }

  // ---------- Comments (saved in this browser only) ----------
  const commentsFor = (key, fallback = []) => (Array.isArray(savedComments[key]) ? savedComments[key] : fallback);
  function addComment(key, fallback, text) {
    const clean = String(text || '').trim().slice(0, 280);
    if (!clean) return false;
    const w = wallet.get();
    savedComments[key] = [{
      id: `u-${Date.now()}`,
      author: w.connected ? w.short : 'You',
      badge: w.connected ? (w.isHardware ? 'Hardware' : 'Play wallet') : 'Viewer',
      text: clean,
      likes: 0,
      at: 'just now',
      mine: true,
    }, ...commentsFor(key, fallback)].slice(0, 40);
    saveComments(savedComments);
    return true;
  }
  function likeComment(key, fallback, id) {
    savedComments[key] = commentsFor(key, fallback).map((c) => (c.id === id ? { ...c, likes: (c.likes || 0) + 1, liked: true } : c));
    saveComments(savedComments);
  }
  function commentThread({ key, fallback, placeholder, label }) {
    const list = el('ol', { class: 'ct-comment-list' });
    const input = el('input', { class: 'ct-input', type: 'text', placeholder, maxlength: 280, 'aria-label': label });
    const countEl = el('span', { class: 'ct-count' });
    function draw() {
      const items = commentsFor(key, fallback);
      countEl.textContent = String(items.length);
      list.replaceChildren(...items.map((c) => {
        const like = el('button', {
          type: 'button',
          class: 'ct-like',
          'aria-pressed': String(Boolean(c.liked)),
          'aria-label': `Like, ${c.likes || 0} likes`,
          disabled: c.liked,
          on: { click: () => { likeComment(key, fallback, c.id); draw(); } },
        }, svg('svg', { viewBox: '0 0 16 16', width: 12, height: 12, 'aria-hidden': 'true' }, svg('path', { d: 'M8 3.2l4.6 7.6H3.4z', fill: 'currentColor' })), String(c.likes || 0));
        return el('li', { class: `ct-comment${c.mine ? ' is-mine' : ''}` },
          el('div', { class: 'ct-comment-head' },
            el('strong', {}, c.author),
            c.badge ? el('span', { class: 'ct-comment-badge' }, c.badge) : null,
            el('span', { class: 'ct-comment-at' }, c.at || ''),
            like,
          ),
          el('p', {}, c.text),
        );
      }));
    }
    const form = el('form', {
      class: 'ct-inline-form',
      on: {
        submit: (e) => {
          e.preventDefault();
          if (addComment(key, fallback, input.value)) {
            input.value = '';
            draw();
            toast('Comment posted. It is saved in this browser only.');
          }
        },
      },
    }, input, el('button', { type: 'submit', class: 'ct-btn ct-btn-sm' }, 'Post'));
    draw();
    return { list, form, countEl, draw };
  }

  // ---------- Toast ----------
  const toastEl = el('div', { class: 'ct-toast', role: 'status', 'aria-live': 'polite', hidden: true });
  let toastTimer = null;
  function toast(msg) {
    clearTimeout(toastTimer);
    toastEl.textContent = msg;
    toastEl.hidden = false;
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 4600);
  }

  // ---------- Header ----------
  const navLinks = new Map();
  const nav = el('nav', { class: 'ct-nav', 'aria-label': 'Clank Tank' }, VIEWS.map((v) => {
    const a = el('a', { href: `#${v.id}`, class: 'ct-nav-link', data: { view: v.id } },
      v.id === 'live' ? el('i', { class: 'ct-onair-dot', 'aria-hidden': 'true' }) : null, v.label);
    navLinks.set(v.id, a);
    return a;
  }));

  const walletLabel = el('span', { class: 'ct-wallet-label' }, 'Connect wallet');
  const walletSub = el('span', { class: 'ct-wallet-sub' }, 'Hardware and external first');
  const walletBtn = el('button', { type: 'button', class: 'ct-wallet', on: { click: openWalletModal } },
    el('i', { class: 'ct-wallet-dot', 'aria-hidden': 'true' }),
    el('span', { class: 'ct-wallet-text' }, walletLabel, walletSub));
  function syncWallet() {
    const w = wallet.get();
    walletBtn.classList.toggle('is-on', w.connected);
    walletLabel.textContent = w.connected ? `${w.playBalanceEth.toFixed(2)} play ETH` : 'Connect wallet';
    walletSub.textContent = w.connected ? `${w.providerName}, ${w.short}` : 'Hardware and external first';
    for (const n of root.querySelectorAll('[data-balance]')) n.textContent = `${w.playBalanceEth.toFixed(2)} play ETH`;
  }
  wallet.on(syncWallet);

  const header = el('header', { class: 'ct-header' },
    el('div', { class: 'ct-header-left' },
      el('a', { class: 'ct-back', href: '/', 'aria-label': 'Back to agi1.app' }, icon('back'), el('span', {}, 'agi1.app')),
      el('a', { class: 'ct-brand', href: '#live', 'aria-label': 'Clank Tank' },
        el('img', { src: MARK, alt: '', class: 'ct-brand-mark', width: 30, height: 30 }),
        el('img', { src: WORDMARK, alt: '', class: 'ct-brand-word', width: 64, height: 19 }),
        el('span', { class: 'ct-brand-tank' }, 'Tank'),
      ),
    ),
    nav,
    el('div', { class: 'ct-header-right' },
      el('a', { class: 'ct-btn ct-btn-primary ct-pitch-cta', href: '#studio' }, 'Pitch a deal'),
      walletBtn,
    ),
  );

  const notice = el('div', { class: 'ct-notice', role: 'note' },
    el('p', {},
      el('strong', {}, 'Concept demo for clank.trade. '),
      'Pitches, sharks, P&L and comments are simulated and use play ETH; nothing is sent onchain. Anything marked ',
      tagLive(),
      ' comes from clank.trade.'),
  );

  const viewHost = el('div', { class: 'ct-view' });
  const main = el('main', { id: 'ct-main', class: 'ct-main', tabindex: '-1' }, viewHost, renderFooter());

  // ---------- Trade tape ----------
  const SIM_TAPE = [
    { id: 's1', side: 'buy', text: '@TokyoWhale committed 2.4 ETH to $AAGII' },
    { id: 's2', side: 'buy', text: 'VALKYRIE-9 committed 1.8 ETH to $AAGII' },
    { id: 's3', side: 'buy', text: 'DEGEN-V4 copied $SPCX-5X with 1.25 ETH' },
    { id: 's4', side: 'buy', text: 'AGI-1 DD passed $AAGII and committed 0.8 ETH' },
    { id: 's5', side: 'sell', text: 'No deal on $SHAD: 6.1 ETH refunded to everyone' },
  ];
  const tapeTrack = el('div', { class: 'ct-tape-track' });
  const tapeSource = el('span', { class: 'ct-tape-source' });
  const tape = el('aside', { class: 'ct-tape', 'aria-label': 'Recent trades' },
    el('div', { class: 'ct-tape-head' }, el('span', {}, 'Trades'), tapeSource),
    el('div', { class: 'ct-tape-viewport' }, tapeTrack));
  function renderTape() {
    const isLive = state.recentTrades.length > 0;
    const items = isLive
      ? state.recentTrades.slice(0, 18).map((t, i) => ({
        id: t.id || `${t.address}-${i}`,
        side: t.side === 'sell' ? 'sell' : 'buy',
        ticker: t.ticker,
        amount: Number(t.quote) || 0,
        asset: t.quoteAsset || 'ETH',
      }))
      : SIM_TAPE;
    const sig = `${isLive ? 'L' : 'S'}:${items.map((i) => i.id).join('|')}`;
    if (sig === state.tapeSig) return;
    state.tapeSig = sig;
    tapeSource.replaceChildren(isLive ? tagLive('clank.trade') : tagSim());
    const make = (it, dup) => el('span', { class: `ct-tape-item is-${it.side}`, 'aria-hidden': dup ? 'true' : null },
      it.text
        ? it.text
        : [el('b', {}, it.side === 'sell' ? 'Sell' : 'Buy'), ` $${it.ticker} `, el('span', { class: 'ct-num' }, `${ethNum(it.amount, it.amount < 1 ? 4 : 2)} ${it.asset}`)]);
    tapeTrack.replaceChildren(...items.map((it) => make(it, false)), ...items.map((it) => make(it, true)));
  }

  // ---------- Wallet dialog ----------
  const walletDialog = el('dialog', { class: 'ct-dialog is-narrow', 'aria-labelledby': 'ct-wallet-title' });
  function openWalletModal() {
    const w = wallet.get();
    const msg = el('p', { class: 'ct-feedback', 'aria-live': 'polite' });
    walletDialog.replaceChildren(
      el('div', { class: 'ct-dialog-head' },
        el('h2', { id: 'ct-wallet-title' }, 'Connect a wallet'),
        el('button', { type: 'button', class: 'ct-icon-btn', 'aria-label': 'Close', on: { click: () => walletDialog.close() } }, icon('close'))),
      el('div', { class: 'ct-dialog-body' },
        el('p', { class: 'ct-sub' }, 'Hardware and external wallets come first: your keys stay on your Ledger, Trezor, Rabby or MetaMask. In this demo every action uses play ETH, so nothing is ever signed or spent.'),
        el('div', { class: 'ct-wallet-list' }, EXTERNAL_WALLETS.map((meta) => el('button', {
          type: 'button',
          class: 'ct-wallet-option',
          on: {
            click: async () => {
              const res = await wallet.connectExternal(meta);
              msg.textContent = res.ok ? res.message : res.error;
              msg.className = `ct-feedback ${res.ok ? 'is-good' : 'is-error'}`;
              if (res.ok) {
                toast(res.message);
                setTimeout(() => { if (walletDialog.open) walletDialog.close(); }, 700);
              }
            },
          },
        }, el('span', {}, el('strong', {}, meta.name), el('small', {}, meta.kind)), meta.hardware ? tagPlain('Hardware', 'up') : null))),
        el('button', {
          type: 'button',
          class: 'ct-btn ct-btn-primary ct-btn-block',
          on: { click: () => { const res = wallet.connectSimulator(); toast(res.message); walletDialog.close(); } },
        }, `Use the play wallet (${w.playBalanceEth.toFixed(2)} play ETH)`),
        el('details', { class: 'ct-details' },
          el('summary', {}, 'Passkey or Google sign-in'),
          el('p', { class: 'ct-sub' }, 'An optional embedded wallet for Robinhood users who are not onchain yet. Power traders and sharks stay on hardware.')),
        w.connected ? el('button', {
          type: 'button',
          class: 'ct-btn ct-btn-ghost ct-btn-sm',
          on: { click: () => { wallet.disconnect(); toast('Wallet disconnected.'); walletDialog.close(); } },
        }, 'Disconnect') : null,
        msg,
      ),
    );
    walletDialog.showModal();
  }

  // ---------- Coin dossier dialog: chart, ClankChecker scan, practice trade, comments ----------
  const dossierDialog = el('dialog', { class: 'ct-dialog', 'aria-labelledby': 'ct-dossier-title' });
  const dossier = { item: null, chart: null, scanHost: null };
  dossierDialog.addEventListener('close', () => {
    dossier.chart?.destroy();
    dossier.chart = null;
    dossier.item = null;
  });

  function scanPanel(item, { compact = false } = {}) {
    const live = item.isLiveClank && isChainAddress(item.address);
    if (!live) return ddCard(buildDueDiligenceReport(item, null), { title: 'Due diligence', compact });
    const entry = state.scans.get(item.address.toLowerCase());
    if (!entry || entry.status === 'loading') {
      return el('div', { class: 'ct-dd is-loading' },
        ddHead('ClankChecker scan', tagLive()),
        el('p', { class: 'ct-sub' }, `Scanning $${item.ticker}: holder spread, creator wallet, liquidity and copycat tickers…`));
    }
    if (entry.status === 'failed') {
      return el('div', { class: 'ct-dd is-failed' },
        ddHead('ClankChecker scan', tagLive()),
        el('p', { class: 'ct-sub' }, entry.error === 'not_clank'
          ? 'clank.trade does not list this coin yet, so there is nothing to scan.'
          : 'ClankChecker could not scan this coin just now.'),
        entry.error === 'not_clank' ? null : el('button', { type: 'button', class: 'ct-btn ct-btn-sm', on: { click: () => ensureScan(item.address, { force: true }) } }, icon('refresh'), 'Try again'));
    }
    return ddCard(buildDueDiligenceReport(item, entry.scan), { title: 'ClankChecker scan', compact });
  }

  function openCoinDossier(item) {
    dossier.item = item;
    const live = item.isLiveClank && isChainAddress(item.address);
    const chartBox = el('div', { class: 'ct-chart', 'aria-label': `${item.name} price chart` });
    const chartNote = el('p', { class: 'ct-chart-note' }, live ? [tagLive('clank.trade'), ' 5-minute candles, market cap in USD'] : [tagSim(), ' Illustrative chart']);
    dossier.scanHost = el('div', { class: 'ct-dossier-scan' }, scanPanel(item));
    const thread = commentThread({
      key: `coin:${String(item.address || item.id || item.ticker).toLowerCase()}`,
      fallback: [{ id: 'dc1', author: 'AGI-1 DD', badge: 'AI DD', text: `Watching $${item.ticker}: holders, creator wallet and liquidity on Robinhood Chain.`, likes: 3, at: 'pinned' }],
      placeholder: `Add a note on $${item.ticker}`,
      label: `Comment on ${item.ticker}`,
    });
    const play = practiceTrade(item);
    dossierDialog.replaceChildren(
      el('div', { class: 'ct-dialog-head' },
        el('div', { class: 'ct-dossier-title' },
          coinArt(item, 'ct-dossier-art'),
          el('div', {},
            el('h2', { id: 'ct-dossier-title' }, item.name, ' ', el('span', { class: 'ct-ticker' }, `$${item.ticker}`)),
            el('p', { class: 'ct-sub' },
              live ? tagLive('clank.trade') : tagSim(),
              live ? null : [' ', item.venue],
              item.address && isChainAddress(item.address) ? [' ', el('code', {}, shortAddress(item.address))] : null)),
        ),
        el('div', { class: 'ct-dialog-actions' },
          live ? el('a', { class: 'ct-btn ct-btn-sm', href: clankCoinUrl(item.address), target: '_blank', rel: 'noopener noreferrer' }, 'clank.trade', icon('external')) : null,
          el('button', { type: 'button', class: 'ct-btn ct-btn-primary ct-btn-sm', on: { click: () => { dossierDialog.close(); pullToDesk(item); } } }, 'Put on the desk'),
          el('button', { type: 'button', class: 'ct-icon-btn', 'aria-label': 'Close', on: { click: () => dossierDialog.close() } }, icon('close')),
        ),
      ),
      el('div', { class: 'ct-dialog-body' },
        el('div', { class: 'ct-dossier-grid' },
          el('div', { class: 'ct-dossier-main' }, chartBox, chartNote, play),
          dossier.scanHost,
        ),
        el('section', { class: 'ct-dossier-comments', 'aria-label': 'Comments' },
          el('div', { class: 'ct-section-head' }, el('h3', {}, 'Notes'), thread.countEl), thread.form, thread.list),
      ),
    );
    dossierDialog.showModal();
    dossier.chart?.destroy();
    dossier.chart = createTankChart(chartBox, { background: '#141419' });
    if (live) {
      ensureScan(item.address);
      loadCandles(item.address).then((candles) => {
        if (dossier.item !== item) return;
        if (candles.length >= 2) dossier.chart?.setCandles(candles);
        else chartNote.replaceChildren('clank.trade has no recent candles for this coin yet.');
      }).catch(() => { if (dossier.item === item) chartNote.replaceChildren('clank.trade did not send candles just now.'); });
    } else {
      dossier.chart.setCandles(generateSyntheticCandles(item.marketCapUsd || 42000, 72));
    }
  }

  function practiceTrade(item) {
    const key = String(item.address || item.ticker).toLowerCase();
    const amount = el('input', { type: 'number', step: '0.05', min: '0.05', max: '5', value: '0.25', inputmode: 'decimal', 'aria-label': 'Practice trade amount in ETH' });
    const fb = el('p', { class: 'ct-feedback', 'aria-live': 'polite' });
    const say = (text, good) => { fb.textContent = text; fb.className = `ct-feedback ${good ? 'is-good' : 'is-error'}`; };
    const go = (side) => {
      const amt = Number(amount.value);
      if (!(amt > 0)) return say('Enter an amount of ETH greater than 0.', false);
      const held = practiceHoldings.get(key) || 0;
      if (side === 'buy') {
        const res = wallet.spendPlayEth(amt, { side: 'buy', ticker: item.ticker, venue: item.venue });
        if (!res.ok) return say(res.error, false);
        practiceHoldings.set(key, +(held + amt).toFixed(4));
        return say(`Practice buy: ${eth(amt)} of $${item.ticker} through the Clank router (0.35% fee). You hold ${eth(held + amt)} of it.`, true);
      }
      if (held <= 0) return say(`You have no practice position in $${item.ticker} to sell yet.`, false);
      const sold = Math.min(amt, held);
      practiceHoldings.set(key, +(held - sold).toFixed(4));
      wallet.refundPlayEth(sold);
      return say(`Practice sell: ${eth(sold)} back in your play wallet.${sold < amt ? ' That was your whole position.' : ''}`, true);
    };
    return el('div', { class: 'ct-practice' },
      el('div', { class: 'ct-practice-head' }, el('h3', {}, 'Practice trade'), tagSim('Play ETH')),
      el('div', { class: 'ct-practice-row' },
        el('div', { class: 'ct-amount is-sm' }, amount, el('span', {}, 'ETH')),
        el('button', { type: 'button', class: 'ct-btn ct-btn-up ct-btn-sm', on: { click: () => go('buy') } }, 'Buy'),
        el('button', { type: 'button', class: 'ct-btn ct-btn-down ct-btn-sm', on: { click: () => go('sell') } }, 'Sell')),
      fb);
  }

  // ---------- Live data from clank.trade ----------
  async function ensureScan(address, { force = false } = {}) {
    if (!isChainAddress(address)) return;
    const key = address.toLowerCase();
    const cached = state.scans.get(key);
    if (!force && cached && (cached.status === 'loading' || (cached.status === 'done' && Date.now() - cached.at < 120_000))) return;
    state.scans.set(key, { status: 'loading', at: Date.now() });
    onScan(key);
    try {
      const res = await fetch(`/api/checker?a=${key}`, { credentials: 'omit', headers: { Accept: 'application/json' } });
      const data = await res.json().catch(() => null);
      if (!data || data.error) throw new Error(data?.error || `status_${res.status}`);
      state.scans.set(key, { status: 'done', at: Date.now(), scan: data });
    } catch (err) {
      state.scans.set(key, { status: 'failed', at: Date.now(), error: String(err?.message || 'unavailable') });
    }
    onScan(key);
  }

  function onScan(key) {
    const room = currentRoom();
    if (state.view === 'live' && room.kind === 'review' && String(room.address || '').toLowerCase() === key) {
      const entry = state.scans.get(key);
      if (entry?.status === 'done') {
        room.script = buildDynamicSceneForCoin(room.coin, buildDueDiligenceReport(room.coin, entry.scan));
        renderTranscript();
        updateCaption();
      }
      renderDd();
    }
    if (dossierDialog.open && dossier.item && String(dossier.item.address || '').toLowerCase() === key && dossier.scanHost) {
      dossier.scanHost.replaceChildren(scanPanel(dossier.item));
    }
  }

  async function loadCandles(address) {
    const key = address.toLowerCase();
    const hit = state.candles.get(key);
    if (hit && Date.now() - hit.at < 60_000) return hit.candles;
    const res = await fetch(`/api/checker?terminal=clank&a=${key}&interval=5m`, { credentials: 'omit', headers: { Accept: 'application/json' } });
    const data = res.ok ? await res.json() : null;
    const candles = Array.isArray(data?.candles) ? data.candles : [];
    state.candles.set(key, { at: Date.now(), candles });
    return candles;
  }

  function mergeStocks(rows) {
    const bySym = new Map(STOCK_PAIRS.map((s) => [s.symbol, s]));
    return rows.filter((s) => /^[A-Z0-9]{1,12}$/.test(s?.symbol)).map((s) => {
      const base = bySym.get(s.symbol) || { symbol: s.symbol, name: s.symbol, icon: `/games/trenchingsimulator/clank/stocks/${s.symbol}.webp` };
      return {
        ...base,
        marketCapUsd: Number.isFinite(s.marketCapUsd) && s.marketCapUsd > 0 ? s.marketCapUsd : base.marketCapUsd,
        change24h: Number.isFinite(s.change24h) ? s.change24h : null,
        sparkline: Array.isArray(s.sparkline) ? s.sparkline.filter(Number.isFinite).slice(-60) : [],
        isLive: true,
      };
    });
  }

  async function syncLiveFeed() {
    try {
      const res = await fetch('/api/checker?terminal=clank', { credentials: 'omit', headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('feed_down');
      const data = await res.json();
      if (data?.v !== 1 || !Array.isArray(data.coins)) throw new Error('bad_feed');
      state.liveStatus = 'live';
      if (Number.isFinite(data.px?.eth) && data.px.eth > 0) {
        state.ethUsd = data.px.eth;
        state.ethLive = true;
      }
      const ranks = new Map((data.trending || []).map((a, i) => [a, i]));
      state.liveCoins = data.coins.filter((c) => isChainAddress(c?.address)).sort((a, b) => {
        const ra = ranks.has(a.address) ? ranks.get(a.address) : 9999;
        const rb = ranks.has(b.address) ? ranks.get(b.address) : 9999;
        return ra - rb || (b.marketCapUsd || 0) - (a.marketCapUsd || 0);
      });
      if (Array.isArray(data.stocks) && data.stocks.length) state.liveStocks = mergeStocks(data.stocks);
      if (Array.isArray(data.recentTrades)) {
        state.recentTrades = data.recentTrades.filter((t) => t && typeof t.ticker === 'string' && (t.side === 'buy' || t.side === 'sell'));
      }
    } catch {
      if (state.liveStatus !== 'live') state.liveStatus = 'down';
    }
    onFeed();
  }

  const focusInside = (node) => Boolean(node && document.activeElement && node.contains(document.activeElement));

  function onFeed() {
    renderTape();
    if (state.view === 'live') {
      renderChannels();
      const room = currentRoom();
      if (hasRound(room)) updateDealPrices();
      if (room.kind === 'review' && room.isLiveCoin) {
        const fresh = state.liveCoins.find((c) => c.address === room.address);
        if (fresh) room.coin = { ...room.coin, ...liveCoinToInventory(fresh) };
        if (!focusInside(live.score)) renderScore();
      }
      if (room.kind === 'desk' && !focusInside(live.score)) renderScore();
    } else if (state.view === 'markets') {
      renderMarketStatus();
      renderFilters();
      if (!focusInside(mk.rail)) renderRail();
      if (!focusInside(mk.grid)) renderMarketGrid();
    }
  }

  // ---------- Live view: the show ----------
  const live = {};
  function avatarFailed() {
    avatar.failed = true;
    const room = currentRoom();
    if (state.view === 'live' && state.stageCam === 'pitcher' && room.stageType === 'vrm-vladcat') {
      state.stageCam = 'panel';
      renderStage();
    }
  }
  function avatarHost() {
    if (!avatar.host) {
      avatar.host = el('div', { class: 'ct-vrm-host', role: 'img', 'aria-label': 'Vladcat, the 3D pitcher avatar' });
      import('./stage3d.js')
        .then(({ mountTankAvatarStage }) => mountTankAvatarStage(avatar.host))
        .then((inst) => {
          if (avatar.host.dataset.failed) return avatarFailed();
          avatar.inst = inst;
          const room = currentRoom();
          inst.setSpeaking(currentLine()?.speaker === 'PITCHER' && room.stageType === 'vrm-vladcat');
        })
        .catch(() => {
          avatar.host.dataset.failed = 'true';
          avatarFailed();
        });
    }
    return avatar.host;
  }

  function renderLive() {
    const room = currentRoom();
    const cams = camsFor(room);
    if (!cams.includes(state.stageCam)) state.stageCam = cams[0];
    live.chart?.destroy();
    Object.assign(live, {
      chart: null,
      channels: el('nav', { class: 'ct-channels', 'aria-label': 'Channels' }),
      head: el('header', { class: 'ct-pitch-head' }),
      stage: el('section', { class: 'ct-stage', 'aria-label': 'Stage' }),
      flash: el('div', { class: 'ct-flash-slot' }),
      panel: el('section', { class: 'ct-panel', 'aria-labelledby': 'ct-panel-title' }),
      score: el('section', { class: 'ct-score', 'aria-label': 'Round' }),
      dd: el('section', { class: 'ct-card ct-dd-card', 'aria-label': 'Due diligence' }),
      comments: el('section', { class: 'ct-card ct-comments', 'aria-labelledby': 'ct-comments-title' }),
    });
    viewHost.replaceChildren(
      el('div', { class: 'ct-live' },
        live.channels,
        el('div', { class: 'ct-live-grid' },
          el('div', { class: 'ct-live-main' }, live.head, live.stage, live.flash, live.panel, live.comments),
          el('div', { class: 'ct-live-side' }, live.score, live.dd),
        ),
      ),
    );
    renderChannels();
    renderPitchHead();
    renderStage();
    renderFlash();
    renderPanel();
    renderScore();
    renderDd();
    renderComments();
    if (room.kind === 'review' && room.isLiveCoin) ensureScan(room.address);
  }

  function selectRoom(id) {
    state.activeRoomId = id;
    state.scriptCursor = 0;
    state.flashCursor = 0;
    state.commitInput = '0.5';
    state.stageCam = camsFor(currentRoom())[0];
    if (state.view !== 'live') location.hash = 'live';
    else renderLive();
    restartSceneTimer();
  }

  function pullToDesk(item) {
    const room = buildDeskRoomForCoin(item);
    if (!state.rooms.some((r) => r.id === room.id)) {
      state.rooms.push(room);
      const reviews = state.rooms.filter((r) => r.kind === 'review');
      if (reviews.length > MAX_REVIEW_ROOMS) state.rooms = state.rooms.filter((r) => r !== reviews[0]);
    }
    selectRoom(room.id);
    toast(`$${item.ticker} is on the AI shark desk.`);
  }

  function renderChannels() {
    if (!live.channels?.isConnected) return;
    const rooms = state.rooms.map((r) => {
      const active = r.id === state.activeRoomId;
      const info = hasRound(r) ? computeDealClearing(r, state.ethUsd) : null;
      const status = r.settledStatus === 'DEAL_LOCKED' ? 'Deal'
        : r.settledStatus === 'NO_DEAL_REFUND' ? 'No deal'
          : info ? `${ethNum(info.totalCommittedEth)} of ${eth(info.minRaiseEth)}`
            : r.kind === 'review' ? (r.isLiveCoin ? 'AI review, live coin' : 'AI review') : 'Always on';
      const name = r.kind === 'desk' ? 'AI shark desk' : `$${r.ticker}`;
      return el('button', {
        type: 'button',
        class: `ct-chan${active ? ' is-active' : ''}${r.settledStatus ? ' is-closed' : ''}`,
        'aria-pressed': String(active),
        on: { click: () => { if (!active) selectRoom(r.id); } },
      },
        r.kind === 'review' ? coinArt(r.coin, 'ct-chan-thumb') : el('img', { src: r.avatar, alt: '', class: 'ct-chan-thumb', width: 34, height: 34, loading: 'lazy' }),
        el('span', { class: 'ct-chan-text' }, el('strong', {}, name), el('small', {}, status)),
        info && !r.settledStatus ? el('span', { class: `ct-chan-meter${info.meetsMinimum ? ' is-met' : ''}`, style: { '--p': `${Math.min(100, info.minProgressPct)}%` }, 'aria-hidden': 'true' }) : null,
      );
    });
    const coins = state.liveCoins.slice(0, 8).map((c) => {
      const item = liveCoinToInventory(c);
      return el('button', { type: 'button', class: 'ct-chan is-coin', on: { click: () => pullToDesk(item) }, title: `Put ${item.name} on the AI desk` },
        coinArt(item, 'ct-chan-thumb'),
        el('span', { class: 'ct-chan-text' },
          el('strong', {}, `$${item.ticker}`),
          el('small', {}, usd(item.marketCapUsd), ' ', item.change24h !== null ? el('span', { class: toneOf(item.change24h) }, signedPct(item.change24h)) : null)),
        el('span', { class: 'ct-sr' }, ', put it on the AI desk'),
      );
    });
    const empty = el('span', { class: 'ct-chan-empty' }, state.liveStatus === 'down' ? 'clank.trade is not answering right now.' : 'Loading coins from clank.trade…');
    live.channels.replaceChildren(
      el('div', { class: 'ct-chan-group' }, el('span', { class: 'ct-chan-label' }, 'On now'), ...rooms),
      el('div', { class: 'ct-chan-group is-coins' },
        el('span', { class: 'ct-chan-label' }, 'Review a live coin', state.liveStatus === 'live' ? tagLive() : null),
        ...(coins.length ? coins : [empty])),
    );
  }

  function xProofBadge(xProof, { compact = false, onToggle = null } = {}) {
    const notable = xProof.notableFollowers.map((h) => NOTABLE_FOLLOWERS.find((n) => n.handle === h)).filter(Boolean);
    const names = notable.map((n) => n.handle).join(', ');
    return el('div', { class: `ct-xproof${compact ? ' is-compact' : ''}`, title: xProof.privacySummary },
      el('span', { class: 'ct-xproof-tier' }, el('b', { class: 'ct-x', 'aria-hidden': 'true' }, 'X'), el('span', { class: 'ct-sr' }, 'X account with '), xProof.tier),
      notable.length ? el('span', { class: 'ct-xproof-notable' },
        el('span', { class: 'ct-faces', 'aria-hidden': 'true' }, notable.slice(0, 4).map((n) => el('i', { class: `hue-${n.hue}` }, n.initials))),
        compact ? `${notable.length} notable` : `followed by ${names}`) : null,
      compact ? null : el('span', { class: 'ct-xproof-handle' }, icon(xProof.handleVisible ? 'check' : 'lock'), xProof.handleVisible ? xProof.revealedHandle : 'handle hidden'),
      onToggle ? el('button', { type: 'button', class: 'ct-link-btn', on: { click: onToggle } }, xProof.handleVisible ? 'Hide handle' : 'Preview a reveal') : null,
    );
  }

  function renderPitchHead() {
    const room = currentRoom();
    if (room.kind === 'review') {
      const c = room.coin;
      live.head.replaceChildren(
        coinArt(c, 'ct-head-art'),
        el('div', { class: 'ct-head-main' },
          el('h1', { class: 'ct-head-title' }, el('span', { class: 'ct-head-ticker' }, `$${c.ticker}`), el('span', { class: 'ct-head-name' }, c.name)),
          el('div', { class: 'ct-head-meta' },
            room.isLiveCoin ? tagLive('clank.trade') : tagSim(),
            el('span', {}, 'On the AI shark desk'),
            c.creatorUsername ? el('span', {}, `Created by @${c.creatorUsername}`) : c.creator ? el('span', {}, 'Creator ', el('code', {}, shortAddress(c.creator))) : null,
          ),
        ),
      );
      return;
    }
    if (room.kind === 'desk') {
      live.head.replaceChildren(
        el('img', { src: room.avatar, alt: '', class: 'ct-head-art', width: 52, height: 52 }),
        el('div', { class: 'ct-head-main' },
          el('h1', { class: 'ct-head-title' }, 'AI shark desk'),
          el('div', { class: 'ct-head-meta' }, tagSim(), el('span', {}, room.subtitle))),
      );
      return;
    }
    const dd = buildDueDiligenceReport(room, null);
    live.head.replaceChildren(
      el('img', { src: room.avatar, alt: '', class: 'ct-head-art', width: 52, height: 52 }),
      el('div', { class: 'ct-head-main' },
        el('h1', { class: 'ct-head-title' }, el('span', { class: 'ct-head-ticker' }, `$${room.ticker}`), el('span', { class: 'ct-head-name' }, room.title)),
        el('div', { class: 'ct-head-meta' },
          tagSim(room.episode ? `Demo pitch ${room.episode}` : 'Demo pitch'),
          el('span', { class: 'ct-head-pitcher' }, room.pitcherAlias,
            dd.labeledTeam ? el('span', { class: 'ct-verified' }, icon('check'), dd.labeledTeam.badge) : null),
          room.pitcherTrackRecord ? el('span', {}, room.pitcherTrackRecord) : null,
        ),
        room.xProof ? xProofBadge(room.xProof, {
          onToggle: () => {
            room.xProof = createPrivateXProof({
              handle: String(room.pitcherAlias || '').replace(/^@/, ''),
              tier: room.xProof.tier,
              notableFollowers: room.xProof.notableFollowers,
              revealHandle: !room.xProof.handleVisible,
            });
            renderPitchHead();
            toast(room.xProof.handleVisible ? 'Preview: the creator chose to reveal their X handle.' : 'Handle hidden again. The follower range and notable followers are still proven.');
          },
        }) : null,
      ),
    );
  }

  function stageLabel(room) {
    if (room.kind === 'review') return room.isLiveCoin ? 'AI review of a live coin' : 'AI review';
    if (room.kind === 'desk') return 'AI shark desk';
    if (room.kind === 'pitch') return 'Trade pitch';
    return room.episode ? `Pitch ${room.episode}` : 'New pitch';
  }

  function portraitFeed(src, alt) {
    return el('div', { class: 'ct-portrait' },
      el('img', { class: 'ct-portrait-bg', src, alt: '', 'aria-hidden': 'true' }),
      el('img', { class: 'ct-portrait-img', src, alt }));
  }

  function panelFeed() {
    const speaker = currentLine()?.speaker;
    live.panelSeats = AI_SHARKS.map((s) => ({
      name: s.name,
      node: el('figure', { class: `ct-pseat${speaker === s.name ? ' is-speaking' : ''}` },
        el('img', { src: PANEL_PORTRAITS[s.id] || s.avatar, alt: '' }),
        el('figcaption', {}, el('strong', {}, s.name), el('small', {}, s.role))),
    }));
    return el('div', { class: 'ct-panel-feed', role: 'img', 'aria-label': 'The four AI sharks at the desk' }, live.panelSeats.map((x) => x.node));
  }

  function chartFeed(room) {
    const host = el('div', { class: 'ct-chart' });
    const note = el('p', { class: 'ct-chart-note' });
    requestAnimationFrame(() => {
      if (!host.isConnected) return;
      live.chart?.destroy();
      live.chart = createTankChart(host, { background: '#0d0d11' });
      if (room.kind === 'review' && room.isLiveCoin) {
        note.replaceChildren(tagLive('clank.trade'), ' 5-minute candles, market cap in USD');
        loadCandles(room.address).then((candles) => {
          if (!host.isConnected) return;
          if (candles.length >= 2) live.chart?.setCandles(candles);
          else note.replaceChildren('clank.trade has no recent candles for this coin yet.');
        }).catch(() => { if (host.isConnected) note.replaceChildren('clank.trade did not send candles just now.'); });
      } else {
        const base = room.kind === 'review' ? room.coin?.marketCapUsd : computeDealClearing(room, state.ethUsd).clearingMcapUsd;
        live.chart.setCandles(generateSyntheticCandles(base || 42000, 64));
        note.replaceChildren(tagSim(), room.kind === 'review' ? ' Illustrative chart' : ' Projected clearing market cap');
      }
    });
    return el('div', { class: 'ct-chart-feed' }, host, note);
  }

  function renderStage() {
    const room = currentRoom();
    const cams = camsFor(room);
    live.chart?.destroy();
    live.chart = null;
    live.panelSeats = null;
    const media = el('div', { class: 'ct-stage-media' });
    if (state.stageCam === 'pitcher' && room.stageType === 'vrm-vladcat') media.append(avatarHost());
    else if (state.stageCam === 'pitcher') media.append(portraitFeed(room.avatar, room.pitcherName));
    else if (state.stageCam === 'panel') media.append(panelFeed());
    else media.append(chartFeed(room));

    live.bugClock = hasRound(room) ? el('span', { class: 'ct-bug-clock' }) : null;
    const bug = el('div', { class: 'ct-bug' },
      el('span', { class: 'ct-onair' }, 'On air'),
      el('span', { class: 'ct-bug-text' }, stageLabel(room)),
      live.bugClock);
    const camSwitch = cams.length > 1
      ? el('div', { class: 'ct-cams', role: 'group', 'aria-label': 'Camera' }, cams.map((c) => el('button', {
        type: 'button',
        class: 'ct-cam',
        'aria-pressed': String(state.stageCam === c),
        on: { click: () => { if (state.stageCam !== c) { state.stageCam = c; renderStage(); } } },
      }, CAM_LABELS[c])))
      : null;

    live.ltSpeaker = el('strong', {});
    live.ltRole = el('span', {});
    live.ltText = el('p', { class: 'ct-lt-text' });
    live.ltCount = el('span', { class: 'ct-lt-count' });
    const lowerThird = el('div', { class: 'ct-lt' },
      el('div', { class: 'ct-lt-head' }, live.ltSpeaker, live.ltRole),
      live.ltText,
      el('div', { class: 'ct-lt-nav' },
        live.ltCount,
        el('button', { type: 'button', class: 'ct-icon-btn', 'aria-label': 'Next line', on: { click: () => advanceScene(1, true) } }, icon('next'))));
    live.verdict = el('div', { class: 'ct-verdict', hidden: true });
    live.verdict.addEventListener('animationend', () => { if (live.verdict) live.verdict.hidden = true; });
    live.stage.replaceChildren(
      el('div', { class: `ct-screen cam-${state.stageCam}` },
        el('div', { class: 'ct-screen-bg', 'aria-hidden': 'true' }),
        media, bug, camSwitch, lowerThird, live.verdict),
    );
    updateCaption();
    updateClock();
  }

  function showVerdict(room) {
    if (!live.verdict?.isConnected) return;
    const isDeal = room.settledStatus === 'DEAL_LOCKED';
    live.verdict.className = `ct-verdict ${isDeal ? 'is-deal' : 'is-nodeal'}${reducedMotion.matches ? ' is-still' : ''}`;
    live.verdict.replaceChildren(el('div', { class: 'ct-verdict-stamp' },
      el('span', { class: 'ct-verdict-word' }, isDeal ? 'Deal' : 'No deal'),
      el('span', { class: 'ct-verdict-sub' }, isDeal ? `Cleared at a ${usd(room.clearingMcapUsd)} market cap` : 'Everyone is refunded')));
    live.verdict.hidden = false;
    if (reducedMotion.matches) setTimeout(() => { if (live.verdict) live.verdict.hidden = true; }, 2600);
  }

  function updateCaption() {
    const room = currentRoom();
    const n = room.script.length;
    const idx = ((state.scriptCursor % n) + n) % n;
    const line = room.script[idx];
    if (!line) return;
    if (live.ltSpeaker?.isConnected) {
      live.ltSpeaker.textContent = speakerName(line.speaker, room);
      live.ltRole.textContent = line.role;
      live.ltText.textContent = line.line;
      live.ltCount.textContent = `${idx + 1} of ${n}`;
    }
    if (live.lines) {
      live.lines.forEach((node, i) => node.classList.toggle('is-current', i === idx));
      const cur = live.lines[idx];
      const list = live.transcript;
      if (cur && list && (cur.offsetTop < list.scrollTop || cur.offsetTop + cur.offsetHeight > list.scrollTop + list.clientHeight)) {
        list.scrollTop = Math.max(0, cur.offsetTop - 8);
      }
    }
    for (const seat of live.seats || []) seat.node.classList.toggle('is-speaking', seat.name === line.speaker);
    for (const seat of live.panelSeats || []) seat.node.classList.toggle('is-speaking', seat.name === line.speaker);
    avatar.inst?.setSpeaking(line.speaker === 'PITCHER' && room.stageType === 'vrm-vladcat');
  }

  function advanceScene(step = 1, manual = false) {
    const room = currentRoom();
    state.scriptCursor = (state.scriptCursor + step + room.script.length) % room.script.length;
    updateCaption();
    if (manual) restartSceneTimer();
  }

  function updateClock() {
    const room = currentRoom();
    if (!hasRound(room)) return;
    if (live.bugClock?.isConnected) {
      live.bugClock.textContent = room.settledStatus ? (room.settledStatus === 'DEAL_LOCKED' ? 'Deal' : 'No deal') : clock(room.timeLeftSec);
      live.bugClock.className = `ct-bug-clock${room.settledStatus ? (room.settledStatus === 'DEAL_LOCKED' ? ' is-deal' : ' is-nodeal') : room.timeLeftSec <= 30 ? ' is-low' : ''}`;
    }
    if (live.scoreClock?.isConnected && !room.settledStatus) {
      setClockDigits(live.scoreClock, clock(room.timeLeftSec));
      live.scoreClock.classList.toggle('is-low', room.timeLeftSec <= 30);
    }
  }

  function renderFlash() {
    const room = currentRoom();
    const events = hasRound(room) && !room.settledStatus ? flashEventsFor(room.ticker) : [];
    if (!events.length) {
      live.flash.replaceChildren();
      return;
    }
    const f = events[state.flashCursor % events.length];
    live.flash.replaceChildren(el('div', { class: 'ct-flash' },
      el('span', { class: 'ct-flash-kicker' }, 'Shark buy'),
      el('p', { class: 'ct-flash-copy' },
        el('strong', {}, f.shark), ' ', el('span', { class: 'ct-flash-label' }, f.verifiedLabel), ` ${f.action} `, el('strong', { class: 'ct-num' }, eth(f.amountEth)),
        el('span', { class: 'ct-flash-record' }, `${f.rank}, ${f.record}`)),
      el('div', { class: 'ct-flash-actions' },
        el('button', { type: 'button', class: 'ct-btn ct-btn-up ct-btn-sm', on: { click: () => commitPlay(eventRoom(f), f.followCapEth, { label: 'You', tag: `following ${f.shark}`, source: 'flash' }) } }, `Follow with ${eth(f.followCapEth)}`),
        events.length > 1 ? el('button', { type: 'button', class: 'ct-icon-btn', 'aria-label': 'Next shark buy', on: { click: () => { state.flashCursor += 1; renderFlash(); } } }, icon('next')) : null),
    ));
  }
  const eventRoom = (f) => state.rooms.find((r) => r.ticker === f.ticker && hasRound(r)) || currentRoom();

  function renderPanel() {
    const room = currentRoom();
    const speaker = currentLine()?.speaker;
    live.seats = AI_SHARKS.map((s) => ({
      name: s.name,
      node: el('li', { class: `ct-seat${speaker === s.name ? ' is-speaking' : ''}` },
        el('img', { src: s.avatar, alt: '', class: 'ct-seat-img', width: 40, height: 40 }),
        el('div', { class: 'ct-seat-text' }, el('strong', {}, s.name), el('small', {}, s.role)),
        el('div', { class: 'ct-seat-pnl' }, el('b', { class: 'is-up' }, `+${usd(s.realizedPnlUsd)}`), el('small', {}, `${s.winRate}% wins`)),
        el('span', { class: 'ct-eq', 'aria-hidden': 'true' }, el('i'), el('i'), el('i'))),
    }));
    live.transcript = el('ol', { class: 'ct-transcript', 'aria-label': 'Transcript', tabindex: '0' });
    const input = el('input', { class: 'ct-input', type: 'text', maxlength: 200, id: 'ct-ask-input', placeholder: room.kind === 'review' ? `Ask about $${room.ticker}` : 'Ask the pitcher or the sharks, like "Why no snipers?"' });
    const form = el('form', {
      class: 'ct-inline-form ct-ask',
      on: {
        submit: (e) => {
          e.preventDefault();
          if (askPanel(input.value)) input.value = '';
        },
      },
    }, el('label', { class: 'ct-sr', for: 'ct-ask-input' }, 'Ask the panel'), input, el('button', { type: 'submit', class: 'ct-btn ct-btn-sm' }, 'Ask'));
    live.panel.replaceChildren(
      el('div', { class: 'ct-section-head' },
        el('div', {},
          el('h2', { id: 'ct-panel-title' }, 'The panel'),
          el('p', { class: 'ct-sub' }, `Four AI sharks, each trading a fee-funded wallet with public P&L: ${usd(aiPanelPnlUsd())} realized so far.`)),
        tagSim('Simulated P&L')),
      el('ol', { class: 'ct-seats' }, live.seats.map((s) => s.node)),
      live.transcript,
      form,
    );
    renderTranscript();
  }

  function renderTranscript() {
    if (!live.transcript) return;
    const room = currentRoom();
    const idx = state.scriptCursor % room.script.length;
    live.lines = room.script.map((l, i) => el('li', { class: `ct-tline${i === idx ? ' is-current' : ''}${l.speaker === 'AUDIENCE' ? ' is-audience' : ''}` },
      el('b', {}, speakerName(l.speaker, room)), ' ', l.line));
    live.transcript.replaceChildren(...live.lines);
  }

  function askPanel(question) {
    const q = String(question || '').trim().slice(0, 200);
    if (!q) return false;
    const room = currentRoom();
    const shark = AI_SHARKS[room.script.filter((l) => l.speaker === 'AUDIENCE').length % AI_SHARKS.length];
    let answer;
    if (hasRound(room)) {
      const info = computeDealClearing(room, state.ethUsd);
      answer = `On $${room.ticker}: everyone clears at the same ${usd(info.clearingMcapUsd)} market cap, with ${room.terms?.lockPeriod || 'the pinned lock'}. ${room.feeSplits ? `${room.feeSplits.jackpotPot}% of fees go to the holder jackpot, and` : ''} there is no block-0 for snipers to bundle.`;
    } else if (room.kind === 'review') {
      const entry = room.isLiveCoin ? state.scans.get(String(room.address).toLowerCase()) : null;
      const report = entry?.status === 'done' ? buildDueDiligenceReport(room.coin, entry.scan) : null;
      answer = report
        ? `ClankChecker says ${report.verdict.toLowerCase()} for $${room.ticker}${report.rows.length ? `: ${report.rows.slice(0, 3).map((r) => `${r.label.toLowerCase()} ${r.value}`).join(', ')}` : ''}. Size it like a coin with no pitch record.`
        : `$${room.ticker} trades at ${usd(room.coin?.marketCapUsd)} with ${countFmt(room.coin?.holders)} holders. Wait for the scan before you size in.`;
    } else {
      answer = 'Put a live coin on the desk and we will review it on air: holders, creator wallet, liquidity and the tape.';
    }
    room.script.push({ speaker: 'AUDIENCE', role: 'Your question', line: q });
    room.script.push({ speaker: shark.name, role: shark.role, line: answer });
    state.scriptCursor = room.script.length - 1;
    renderTranscript();
    updateCaption();
    restartSceneTimer();
    return true;
  }

  // ---------- The scoreboard: Deal or No Deal, a live coin review, or the desk's queue ----------
  function renderScore() {
    const room = currentRoom();
    live.scoreClock = null;
    live.clearingEl = null;
    live.ethEl = null;
    if (hasRound(room)) renderRoundScore(room);
    else if (room.kind === 'review') renderReviewScore(room);
    else renderDeskScore();
  }

  function ethPriceNode() {
    return state.ethLive
      ? el('span', {}, `${usdExact(state.ethUsd)} `, tagLive())
      : el('span', {}, `${usdExact(state.ethUsd)} `, tagPlain('Fallback'));
  }

  function updateDealPrices() {
    const room = currentRoom();
    if (!hasRound(room)) return;
    if (live.clearingEl?.isConnected) {
      const info = computeDealClearing(room, state.ethUsd);
      live.clearingEl.textContent = usd(room.settledStatus === 'DEAL_LOCKED' && room.clearingMcapUsd ? room.clearingMcapUsd : info.clearingMcapUsd);
    }
    if (live.ethEl?.isConnected) live.ethEl.replaceChildren(ethPriceNode());
  }

  function renderRoundScore(room) {
    const info = computeDealClearing(room, state.ethUsd);
    const w = wallet.get();
    const cap = commitCapEth(room, { isRankedShark: w.isRankedShark });
    const words = room.kind === 'pitch'
      ? { title: 'Copy-trade pool', unit: 'pool', line: 'minimum', verb: 'Copy' }
      : { title: 'Deal or No Deal', unit: 'round', line: 'deal line', verb: 'Commit' };
    const fillPct = Math.min(100, (info.totalCommittedEth / info.hardCapEth) * 100);
    const linePct = Math.min(100, (info.minRaiseEth / info.hardCapEth) * 100);
    live.clearingEl = el('b', { class: 'ct-num' }, usd(room.settledStatus === 'DEAL_LOCKED' && room.clearingMcapUsd ? room.clearingMcapUsd : info.clearingMcapUsd));
    live.ethEl = el('dd', {}, ethPriceNode());

    const meter = el('div', {
      class: `ct-meter${info.meetsMinimum ? ' is-met' : ''}${room.settledStatus === 'NO_DEAL_REFUND' ? ' is-failed' : ''}`,
      role: 'meter',
      'aria-label': `ETH committed, out of a ${eth(info.hardCapEth)} hard cap`,
      'aria-valuemin': '0',
      'aria-valuemax': String(info.hardCapEth),
      'aria-valuenow': String(info.totalCommittedEth),
      'aria-valuetext': `${eth(info.totalCommittedEth)} of ${eth(info.hardCapEth)}; the ${words.line} is ${eth(info.minRaiseEth)}`,
    },
      el('i', { class: 'ct-meter-fill', style: { '--fill': `${fillPct.toFixed(1)}%` } }),
      el('i', { class: 'ct-meter-line', style: { '--at': `${linePct.toFixed(1)}%` } }, el('span', {}, words.line === 'deal line' ? 'Deal line' : 'Minimum')));

    const top = room.settledStatus
      ? el('div', { class: `ct-result ${room.settledStatus === 'DEAL_LOCKED' ? 'is-deal' : 'is-nodeal'}` },
        el('span', { class: 'ct-result-word' }, room.settledStatus === 'DEAL_LOCKED' ? 'Deal' : 'No deal'),
        el('p', {}, room.settledStatus === 'DEAL_LOCKED'
          ? `${eth(info.totalCommittedEth)} cleared at one price and went straight to a locked Uniswap V4 pool.`
          : `The ${words.unit} raised ${eth(info.totalCommittedEth)} of ${eth(info.minRaiseEth)}, so every commitment was refunded in full.`))
      : el('div', { class: 'ct-clockline' },
        (live.scoreClock = el('span', { class: `ct-clock${room.timeLeftSec <= 30 ? ' is-low' : ''}`, role: 'timer' })),
        el('span', { class: 'ct-clock-label' }, `left in this ${words.unit}`));

    const status = room.settledStatus ? null
      : info.status === 'DEAL_FILLED' ? 'The hard cap is reached. Everyone clears at the same price when the clock runs out.'
        : info.meetsMinimum ? `Past the ${words.line}. More commitments raise the clearing price for everyone equally.`
          : `${eth(info.remainingToMinEth)} to the ${words.line}. If the clock runs out below it, everyone is refunded.`;

    const parts = [
      el('div', { class: 'ct-score-head' }, el('h2', {}, words.title), tagSim()),
      top,
      el('div', { class: 'ct-raise' },
        el('p', { class: 'ct-raise-nums' }, el('b', { class: 'ct-num' }, eth(info.totalCommittedEth)), ` committed of ${eth(info.minRaiseEth)} ${words.line === 'deal line' ? 'needed' : 'minimum'}`),
        meter,
        el('div', { class: 'ct-meter-scale' }, el('span', {}, '0'), el('span', {}, `Hard cap ${eth(info.hardCapEth)}`)),
        status ? el('p', { class: 'ct-raise-status' }, status) : null),
      el('dl', { class: 'ct-facts' },
        el('div', {}, el('dt', {}, 'Clearing price', el('small', {}, 'The same for every buyer')), el('dd', {}, live.clearingEl, ' market cap')),
        el('div', {}, el('dt', {}, 'Wallets in'), el('dd', {}, `${countFmt(room.contributors)}, no snipers`)),
        el('div', {}, el('dt', {}, 'ETH price'), live.ethEl),
        room.userCommittedEth ? el('div', {}, el('dt', {}, 'Your stake'), el('dd', {}, el('b', { class: 'ct-num' }, eth(room.userCommittedEth)))) : null),
    ];

    if (!room.settledStatus) {
      const remaining = Math.max(0, +(info.hardCapEth - info.totalCommittedEth).toFixed(4));
      const maxNow = Math.max(0, Math.min(cap, remaining));
      const amount = el('input', {
        id: 'ct-commit-amount', type: 'number', step: '0.05', min: '0.05', max: String(maxNow || cap), inputmode: 'decimal',
        value: state.commitInput,
      });
      const submit = el('button', { type: 'submit', class: 'ct-btn ct-btn-primary ct-btn-block' });
      const fb = el('p', { class: 'ct-feedback', 'aria-live': 'polite' });
      live.commitFeedback = fb;
      const label = () => {
        const v = Number(amount.value);
        submit.textContent = v > 0 ? `${words.verb} ${eth(v)}` : `${words.verb} play ETH`;
      };
      amount.addEventListener('input', () => { state.commitInput = amount.value; label(); });
      label();
      const maxPreset = Math.floor(maxNow * 100) / 100;
      const presets = [...new Set([0.25, 0.5, 1, maxPreset].filter((v) => v > 0 && v <= maxNow + 1e-9))].slice(0, 4);
      parts.push(el('form', {
        class: 'ct-commit',
        novalidate: true,
        on: {
          submit: (e) => {
            e.preventDefault();
            commitPlay(room, amount.value, { label: `You (${wallet.get().short})` });
          },
        },
      },
        el('label', { class: 'ct-label', for: 'ct-commit-amount' }, `${words.verb} play ETH`),
        el('div', { class: 'ct-amount' }, amount, el('span', {}, 'ETH')),
        presets.length ? el('div', { class: 'ct-presets' }, presets.map((v) => el('button', {
          type: 'button',
          class: 'ct-preset',
          on: { click: () => { amount.value = String(v); state.commitInput = String(v); label(); amount.focus(); } },
        }, v === maxPreset && v !== 0.25 && v !== 0.5 && v !== 1 ? `Max ${ethNum(v)}` : ethNum(v)))) : null,
        submit,
        el('p', { class: 'ct-commit-meta' },
          `Up to ${eth(cap)} per wallet (anti-sniper cap). `,
          el('span', { 'data-balance': '' }, `${w.playBalanceEth.toFixed(2)} play ETH`), ' in your wallet.'),
        fb));
    }

    parts.push(
      el('details', { class: 'ct-details ct-terms' },
        el('summary', {}, 'Creator terms, pinned for the whole round'),
        el('dl', {},
          el('div', {}, el('dt', {}, 'Creator allocation'), el('dd', {}, `${room.terms.creatorAllocPct}%`)),
          el('div', {}, el('dt', {}, 'Vesting and LP'), el('dd', {}, room.terms.lockPeriod)),
          el('div', {}, el('dt', {}, 'Anti-sniper caps'), el('dd', {}, `${room.terms.publicCapPct}% for viewers, ${room.terms.sharkCapPct}% for sharks`)),
          el('div', {}, el('dt', {}, 'Fees'), el('dd', {}, room.terms.feeMode)))),
      el('div', { class: 'ct-commits' },
        el('h3', {}, 'Latest commitments'),
        el('ol', {}, room.recentCommits.slice(0, 5).map((c) => el('li', { class: `${c.isShark ? 'is-shark' : ''}${c.isYou ? ' is-you' : ''}` },
          el('span', {}, c.who, c.tag ? el('small', {}, c.tag) : null),
          el('b', { class: 'ct-num is-up' }, `+${eth(c.amountEth)}`))))),
      el('div', { class: 'ct-demo' },
        el('span', {}, 'Demo controls'),
        room.settledStatus
          ? el('button', { type: 'button', class: 'ct-btn ct-btn-sm', on: { click: () => resetRoom(room) } }, icon('refresh'), `Run the ${words.unit} again`)
          : [
            el('button', { type: 'button', class: 'ct-btn ct-btn-sm ct-btn-ghost', on: { click: () => settleRoom(room) } }, 'Close it now'),
            el('button', { type: 'button', class: 'ct-btn ct-btn-sm ct-btn-ghost', on: { click: () => resetRoom(room) } }, 'Reset'),
          ]),
    );
    live.score.className = 'ct-score';
    live.score.replaceChildren(...parts);
    if (live.scoreClock) setClockDigits(live.scoreClock, clock(room.timeLeftSec));
  }

  function renderReviewScore(room) {
    const c = room.coin;
    const isLive = room.isLiveCoin;
    const stage = c.phase === 'pool' ? 'Graduated, trading in its pool' : c.phase === 'migrating' ? 'Graduating to its pool' : 'On its bonding curve';
    const progress = Number.isFinite(c.progress) ? Math.round(c.progress * 100) : null;
    live.score.className = 'ct-score is-review';
    live.score.replaceChildren(
      el('div', { class: 'ct-score-head' }, el('h2', {}, isLive ? 'Live coin' : 'Coin'), isLive ? tagLive('clank.trade') : tagSim()),
      el('dl', { class: 'ct-stats' },
        el('div', {}, el('dt', {}, 'Market cap'), el('dd', { class: 'ct-num' }, usd(c.marketCapUsd))),
        el('div', {}, el('dt', {}, '24 h'), el('dd', { class: `ct-num ${toneOf(c.change24h)}` }, signedPct(c.change24h))),
        el('div', {}, el('dt', {}, 'Holders'), el('dd', { class: 'ct-num' }, countFmt(c.holders))),
        el('div', {}, el('dt', {}, 'Paired with'), el('dd', {}, c.quoteAsset || c.pairSymbol || 'ETH'))),
      el('div', { class: 'ct-curve' },
        el('div', { class: 'ct-curve-head' }, el('span', {}, stage), c.phase !== 'pool' && progress !== null ? el('b', { class: 'ct-num' }, `${progress}%`) : null),
        c.phase !== 'pool' && progress !== null ? el('span', { class: 'ct-bar', 'aria-hidden': 'true' }, el('i', { style: { '--p': `${progress}%` } })) : null),
      el('div', { class: 'ct-score-actions' },
        isLive ? el('a', { class: 'ct-btn ct-btn-primary', href: clankCoinUrl(c.address), target: '_blank', rel: 'noopener noreferrer' }, 'Open on clank.trade', icon('external')) : null,
        el('button', { type: 'button', class: 'ct-btn', on: { click: () => openCoinDossier(c) } }, 'Chart and notes')),
      practiceTrade(c),
    );
  }

  function renderDeskScore() {
    live.score.className = 'ct-score is-desk';
    const queue = state.liveCoins.slice(0, 6).map(liveCoinToInventory);
    live.score.replaceChildren(
      el('div', { class: 'ct-score-head' }, el('h2', {}, 'Up next on the desk'), state.liveStatus === 'live' ? tagLive('clank.trade') : null),
      el('p', { class: 'ct-sub' }, 'The most active coins on clank.trade right now. Pick one and the sharks review it on air, with a live ClankChecker scan.'),
      queue.length
        ? el('ol', { class: 'ct-queue' }, queue.map((item) => el('li', {},
          coinArt(item, 'ct-queue-art'),
          el('span', { class: 'ct-queue-text' }, el('strong', {}, `$${item.ticker}`), el('small', {}, item.name)),
          el('span', { class: 'ct-queue-num' }, el('b', { class: 'ct-num' }, usd(item.marketCapUsd)), el('small', { class: toneOf(item.change24h) }, signedPct(item.change24h))),
          el('button', { type: 'button', class: 'ct-btn ct-btn-sm', on: { click: () => pullToDesk(item) } }, 'Review'))))
        : el('p', { class: 'ct-empty' }, state.liveStatus === 'down'
          ? 'clank.trade is not answering right now. The desk picks coins up again as soon as it does.'
          : 'Loading coins from clank.trade…'),
    );
  }

  function commitPlay(room, amount, { label = 'You', tag = '', source = 'form' } = {}) {
    const fb = (text, tone) => {
      const inline = source === 'form' && state.view === 'live' && room.id === state.activeRoomId && live.commitFeedback?.isConnected;
      if (inline) {
        live.commitFeedback.textContent = text;
        live.commitFeedback.className = `ct-feedback ${tone === 'good' ? 'is-good' : 'is-error'}`;
      } else {
        toast(text);
      }
    };
    const amt = Number(amount);
    if (!(amt > 0)) return fb('Enter an amount of ETH greater than 0.', 'bad');
    const res = commitToDeal(room, amt, { isRankedShark: wallet.get().isRankedShark, walletLabel: label, walletTag: tag, ethUsd: state.ethUsd });
    if (!res.ok) return fb(res.error, 'bad');
    const spend = wallet.spendPlayEth(res.appliedEth, { side: 'commit', ticker: room.ticker });
    if (!spend.ok) return fb(spend.error, 'bad');
    replaceRoom(res.deal);
    renderChannels();
    if (room.id === state.activeRoomId && state.view === 'live') {
      renderScore();
      const capped = res.appliedEth < amt ? ` (the hard cap only had room for ${eth(res.appliedEth)})` : '';
      const msg = `Committed ${eth(res.appliedEth)}${capped}. Clearing now at a ${usd(res.clearing.clearingMcapUsd)} market cap${res.clearing.meetsMinimum ? ', past the deal line' : `, ${eth(res.clearing.remainingToMinEth)} to go`}.`;
      fb(msg, 'good');
    } else {
      toast(`${eth(res.appliedEth)} of play ETH committed to $${room.ticker}.`);
    }
    return true;
  }

  function settleRoom(room, { auto = false } = {}) {
    const fresh = state.rooms.find((r) => r.id === room.id) || room;
    if (fresh.settledStatus) return;
    const res = settleDeal(fresh, state.ethUsd);
    replaceRoom(res.deal);
    if (res.refundEth > 0) wallet.refundPlayEth(res.refundEth);
    const isActive = state.view === 'live' && res.deal.id === state.activeRoomId;
    if (isActive) {
      renderScore();
      renderFlash();
      updateClock();
      showVerdict(res.deal);
    }
    renderChannels();
    const info = computeDealClearing(res.deal, state.ethUsd);
    const said = res.outcome === 'DEAL'
      ? `Deal: ${eth(info.totalCommittedEth)} cleared at one price, a ${usd(res.deal.clearingMcapUsd)} market cap.`
      : `No deal: ${eth(info.totalCommittedEth)} of ${eth(info.minRaiseEth)} raised, so everyone is refunded${res.refundEth > 0 ? `, including your ${eth(res.refundEth)}` : ''}.`;
    if (isActive || !auto) toast(`${auto ? `Time is up on $${res.deal.ticker}. ` : ''}${said}`);
  }

  function resetRoom(room) {
    const original = INITIAL_LIVE_ROOMS.find((r) => r.id === room.id);
    const userEth = room.settledStatus === 'NO_DEAL_REFUND' ? 0 : Number(room.userCommittedEth) || 0;
    if (userEth > 0) wallet.refundPlayEth(userEth);
    const next = original
      ? cloneRoom(original)
      : { ...room, settledStatus: null, committedEth: room.startCommittedEth ?? 2.5, contributors: room.startContributors ?? 19, userCommittedEth: 0, timeLeftSec: room.startTimeSec ?? 900, recentCommits: (room.recentCommits || []).filter((c) => !c.isYou) };
    replaceRoom(next);
    if (state.view === 'live' && next.id === state.activeRoomId) {
      renderScore();
      renderFlash();
      updateClock();
    }
    renderChannels();
    toast(userEth > 0 ? `Round reset. Your ${eth(userEth)} is back in the play wallet.` : 'Round reset.');
  }

  function ddHead(title, tag) {
    return el('div', { class: 'ct-section-head' }, el('h2', {}, title), tag);
  }

  function ddCard(report, { title = 'Due diligence', compact = false } = {}) {
    const isLive = report.source === 'live-clankchecker';
    return el('div', { class: `ct-dd${compact ? ' is-compact' : ''}` },
      ddHead(title, isLive ? tagLive() : tagSim()),
      el('div', { class: `ct-dd-verdict is-${report.verdictTone}` },
        el('img', { src: AGI1_FACE, alt: '', width: 34, height: 34 }),
        el('span', { class: 'ct-dd-who' }, el('strong', {}, 'AGI-1 DD'), el('small', {}, isLive ? 'Reading ClankChecker' : 'AI due-diligence co-host')),
        el('span', { class: 'ct-verdict-pill' }, report.verdict)),
      report.notes.length ? el('ul', { class: 'ct-notes' }, report.notes.map((n) => el('li', { class: `is-${n.tone}` }, n.text))) : null,
      report.rows.length ? el('dl', { class: 'ct-dd-rows' }, report.rows.map((r) => el('div', {}, el('dt', {}, r.label), el('dd', {}, r.value)))) : null,
      report.labeledTeam ? el('p', { class: 'ct-dd-team' }, icon('check'), `Creator wallet is the labeled ${report.labeledTeam.label} (${report.labeledTeam.role}).`) : null,
      report.links ? el('p', { class: 'ct-dd-links' },
        report.links.clank ? el('a', { href: report.links.clank, target: '_blank', rel: 'noopener noreferrer' }, 'clank.trade', icon('external')) : null,
        report.links.explorer ? el('a', { href: report.links.explorer, target: '_blank', rel: 'noopener noreferrer' }, 'Explorer', icon('external')) : null) : null,
    );
  }

  function renderDd() {
    if (!live.dd?.isConnected) return;
    const room = currentRoom();
    if (room.kind === 'desk') {
      live.dd.hidden = true;
      return;
    }
    live.dd.hidden = false;
    live.dd.replaceChildren(room.kind === 'review' ? scanPanel(room.coin) : ddCard(buildDueDiligenceReport(room, null)));
  }

  function renderComments() {
    const room = currentRoom();
    const thread = commentThread({
      key: `room:${room.id}`,
      fallback: room.comments,
      placeholder: room.kind === 'review' ? `What do you think of $${room.ticker}?` : 'Feedback for the pitcher, or DD notes',
      label: 'Write a comment',
    });
    live.comments.replaceChildren(
      el('div', { class: 'ct-section-head' }, el('h2', { id: 'ct-comments-title' }, 'Comments'), thread.countEl),
      thread.form,
      thread.list,
      el('p', { class: 'ct-fine' }, 'Comments are saved in this browser only.'),
    );
  }

  // ---------- Markets: pitch anything ----------
  const mk = {};
  const MARKET_CATEGORIES = [
    ['all', 'All'],
    ['clank', 'clank.trade coins'],
    ['pons', 'Pons coins'],
    ['stocks', 'Stock tokens'],
    ['perps', 'Perps'],
    ['outcomes', 'Outcomes'],
  ];

  function inventory() {
    const liveItems = state.liveCoins.map(liveCoinToInventory);
    const stockBySym = new Map(state.liveStocks.filter((s) => s.isLive).map((s) => [s.symbol, s]));
    const sim = PITCH_ANYTHING_EXTRA.map((x) => {
      const st = x.category === 'stocks' ? stockBySym.get(x.ticker) : null;
      return st ? { ...x, marketCapUsd: st.marketCapUsd, change24h: st.change24h ?? x.change24h, liveStockData: true } : x;
    });
    return [...liveItems, ...sim];
  }

  function renderMarkets() {
    mk.status = el('p', { class: 'ct-feed-status' });
    mk.rail = el('ul', { class: 'ct-rail' });
    mk.filters = el('div', { class: 'ct-filters', role: 'group', 'aria-label': 'Show' });
    mk.grid = el('div', { class: 'ct-grid' });
    mk.empty = el('p', { class: 'ct-empty', hidden: true });
    const search = el('input', {
      class: 'ct-input ct-search',
      type: 'search',
      placeholder: 'Search by name, ticker or address',
      'aria-label': 'Search markets',
      value: state.markets.query,
      on: { input: () => { state.markets.query = search.value; renderMarketGrid(); } },
    });
    viewHost.replaceChildren(el('div', { class: 'ct-page' },
      el('header', { class: 'ct-page-head' },
        el('h1', {}, 'Pitch anything'),
        el('p', { class: 'ct-lede' }, 'Any trade on chain can be pitched on the show: a coin on clank.trade, a Pons coin, a stock token, a perp or an outcome market. Viewers copy it through Clank for a 0.35% fee.'),
        mk.status),
      el('section', { class: 'ct-rail-wrap', 'aria-labelledby': 'ct-rail-title' },
        el('div', { class: 'ct-section-head' }, el('h2', { id: 'ct-rail-title' }, 'Stock tokens on Robinhood Chain'), el('span', { class: 'ct-sub' }, 'Pick one to see what is paired with it')),
        mk.rail),
      el('div', { class: 'ct-toolbar' }, mk.filters, search),
      mk.grid,
      mk.empty,
    ));
    renderMarketStatus();
    renderRail();
    renderFilters();
    renderMarketGrid();
  }

  function renderMarketStatus() {
    if (!mk.status?.isConnected) return;
    mk.status.replaceChildren(...(
      state.liveStatus === 'live'
        ? [tagLive('clank.trade'), ` ${countFmt(state.liveCoins.length)} coins, ETH at ${usdExact(state.ethUsd)}. Pons coins, perps and outcomes are simulated.`]
        : state.liveStatus === 'down'
          ? [tagPlain('Offline'), ' clank.trade is not answering, so only the simulated markets are shown.']
          : [tagPlain('Connecting'), ' Loading live coins from clank.trade…']));
  }

  function renderRail() {
    if (!mk.rail?.isConnected) return;
    mk.rail.replaceChildren(...state.liveStocks.map((st) => {
      const on = state.markets.pair === st.symbol;
      return el('li', {}, el('button', {
        type: 'button',
        class: 'ct-stock',
        'aria-pressed': String(on),
        on: { click: () => { state.markets.pair = on ? 'all' : st.symbol; renderRail(); renderMarketGrid(); } },
      },
        el('img', { src: st.icon || `/games/trenchingsimulator/clank/stocks/${st.symbol}.webp`, alt: '', class: 'ct-stock-icon', width: 32, height: 32, loading: 'lazy' }),
        el('span', { class: 'ct-stock-text' }, el('strong', {}, st.symbol), el('small', {}, usd(st.marketCapUsd))),
        el('span', { class: 'ct-stock-move' },
          sparkline(st.sparkline || st.spark, { tone: toneOf(st.change24h) }),
          el('small', { class: toneOf(st.change24h) }, signedPct(st.change24h, 2)))));
    }));
  }

  function renderFilters() {
    if (!mk.filters?.isConnected) return;
    const all = inventory();
    mk.filters.replaceChildren(...MARKET_CATEGORIES.map(([id, label]) => {
      const n = id === 'all' ? all.length : all.filter((x) => x.category === id).length;
      return el('button', {
        type: 'button',
        class: 'ct-pill',
        'aria-pressed': String(state.markets.category === id),
        on: { click: () => { state.markets.category = id; renderFilters(); renderMarketGrid(); } },
      }, label, el('span', { class: 'ct-pill-n' }, String(n)));
    }));
  }

  function marketCard(item) {
    const isLive = Boolean(item.isLiveClank);
    const progress = Number.isFinite(item.progress) ? Math.round(item.progress * 100) : null;
    const stage = isLive
      ? (item.phase === 'pool' ? 'Graduated' : item.phase === 'migrating' ? 'Graduating' : `Bonding curve${progress !== null ? ` ${progress}%` : ''}`)
      : item.ddBadge;
    return el('article', { class: `ct-mcard${isLive ? ' is-live' : ''}` },
      el('div', { class: 'ct-mcard-top' },
        coinArt(item, 'ct-mcard-art'),
        el('div', { class: 'ct-mcard-name' },
          el('h3', { title: item.name }, item.name),
          el('p', {}, `$${item.ticker}`, item.pairSymbol && item.pairSymbol !== item.ticker ? `, paired with ${item.pairSymbol}` : ''))),
      !isLive && item.description ? el('p', { class: 'ct-mcard-desc' }, item.description) : null,
      el('dl', { class: 'ct-mcard-stats' },
        el('div', {}, el('dt', {}, 'Market cap'), el('dd', { class: 'ct-num' }, usd(item.marketCapUsd))),
        el('div', {}, el('dt', {}, '24 h'), el('dd', { class: `ct-num ${toneOf(item.change24h)}` }, signedPct(item.change24h))),
        el('div', {}, el('dt', {}, 'Holders'), el('dd', { class: 'ct-num' }, countFmt(item.holders)))),
      el('div', { class: 'ct-mcard-stage' },
        el('div', { class: 'ct-mcard-stage-head' }, el('span', {}, stage), isLive ? tagLive() : tagSim()),
        isLive && item.phase !== 'pool' && progress !== null ? el('span', { class: 'ct-bar', 'aria-hidden': 'true' }, el('i', { style: { '--p': `${progress}%` } })) : null),
      !isLive && item.pitcherPosition ? el('div', { class: 'ct-mcard-pitch' }, el('span', {}, item.pitcherPosition), item.xProof ? xProofBadge(item.xProof, { compact: true }) : null) : null,
      el('div', { class: 'ct-mcard-actions' },
        el('button', { type: 'button', class: 'ct-btn ct-btn-sm ct-btn-primary', on: { click: () => openCoinDossier(item) } }, isLive ? 'Chart and scan' : 'Chart'),
        el('button', { type: 'button', class: 'ct-btn ct-btn-sm', on: { click: () => pullToDesk(item) } }, 'Put on the desk')),
    );
  }

  function renderMarketGrid() {
    if (!mk.grid?.isConnected) return;
    const q = state.markets.query.trim().toLowerCase();
    const items = inventory().filter((item) => {
      if (state.markets.category !== 'all' && item.category !== state.markets.category) return false;
      if (state.markets.pair !== 'all' && item.pairSymbol !== state.markets.pair && item.ticker !== state.markets.pair) return false;
      if (q && !`${item.name} ${item.ticker} ${item.address || ''} ${item.venue}`.toLowerCase().includes(q)) return false;
      return true;
    });
    mk.grid.replaceChildren(...items.slice(0, 48).map(marketCard));
    mk.empty.hidden = items.length > 0;
    mk.empty.textContent = items.length ? '' : state.markets.pair !== 'all'
      ? `Nothing here is paired with ${state.markets.pair}. Pick the stock again to clear the filter.`
      : 'Nothing matches that search. Try a ticker, a name or a 0x address.';
  }

  // ---------- Records: pitch cards and the shark leaderboard ----------
  const rec = {};
  function recordCard(r) {
    const isDeal = r.outcome === 'DEAL';
    return el('article', { class: `ct-record ${isDeal ? 'is-deal' : 'is-nodeal'}` },
      el('span', { class: 'ct-record-stamp', 'aria-hidden': 'true' }, isDeal ? 'Deal' : 'No deal'),
      el('header', {},
        el('img', { src: r.avatar, alt: '', width: 44, height: 44, loading: 'lazy' }),
        el('div', {},
          el('h3', {}, r.tokenName, ' ', el('span', { class: 'ct-ticker' }, `$${r.ticker}`)),
          el('p', {}, `${r.episode}, ${r.date}. Pitched by ${r.pitcher} (${r.pitcherRecord}).`))),
      el('p', { class: 'ct-sr' }, isDeal ? 'Outcome: deal.' : 'Outcome: no deal, everyone refunded.'),
      el('dl', { class: 'ct-record-stats' },
        el('div', {}, el('dt', {}, 'Raised'), el('dd', {}, el('b', { class: 'ct-num' }, ethNum(r.raisedEth)), ` of ${eth(r.minRaiseEth)}`)),
        isDeal
          ? el('div', {}, el('dt', {}, 'Cleared at'), el('dd', { class: 'ct-num' }, usd(r.clearingMcapUsd)))
          : el('div', {}, el('dt', {}, 'Outcome'), el('dd', {}, 'Refunded in full')),
        isDeal
          ? el('div', {}, el('dt', {}, 'Since the pitch'), el('dd', {}, el('b', { class: 'ct-num is-up' }, signedPct(r.sincePitchPct)), ` to ${usd(r.currentMcapUsd)}`))
          : el('div', {}, el('dt', {}, 'Backed by'), el('dd', {}, 'No sharks'))),
      el('p', { class: 'ct-record-terms' }, el('b', {}, 'Terms '), r.terms),
      el('p', { class: 'ct-record-replay' }, r.replayHighlight),
      xProofBadge(r.xProof, { compact: true }),
    );
  }

  function renderRecords() {
    rec.board = el('div', { class: 'ct-board' });
    rec.detail = el('section', { class: 'ct-card ct-trader', 'aria-live': 'polite' });
    const search = el('input', {
      class: 'ct-input ct-search',
      type: 'search',
      placeholder: 'Search sharks, wallets, labels',
      'aria-label': 'Search the leaderboard',
      value: state.records.query,
      on: { input: () => { state.records.query = search.value; renderBoard(); } },
    });
    const sort = el('select', {
      class: 'ct-input ct-select',
      'aria-label': 'Sort by',
      on: { change: () => { state.records.sort = sort.value; renderBoard(); } },
    }, [['pnl', 'Sort by realized P&L'], ['roi', 'Sort by 30-day return'], ['winRate', 'Sort by win rate'], ['volume', 'Sort by volume'], ['followers', 'Sort by followers']]
      .map(([v, l]) => el('option', { value: v, selected: state.records.sort === v }, l)));
    rec.filters = el('div', { class: 'ct-filters', role: 'group', 'aria-label': 'Show' });
    viewHost.replaceChildren(el('div', { class: 'ct-page' },
      el('header', { class: 'ct-page-head' },
        el('h1', {}, 'Pitch records'),
        el('p', { class: 'ct-lede' }, 'Every pitch leaves a permanent card: the terms, the outcome and the price since. Every trader and AI shark builds a pseudonymous P&L record.'),
        el('p', { class: 'ct-feed-status' }, tagSim(), ' Every record and number on this page is simulated.')),
      el('section', { class: 'ct-records-wrap', 'aria-labelledby': 'ct-records-title' },
        el('h2', { id: 'ct-records-title', class: 'ct-h2' }, 'Past pitches'),
        el('div', { class: 'ct-records' }, PITCH_RECORDS.map(recordCard))),
      el('section', { class: 'ct-board-wrap', 'aria-labelledby': 'ct-board-title' },
        el('div', { class: 'ct-section-head' }, el('h2', { id: 'ct-board-title' }, 'Shark leaderboard'), tagSim()),
        el('div', { class: 'ct-toolbar' }, rec.filters, el('div', { class: 'ct-toolbar-right' }, sort, search)),
        el('div', { class: 'ct-board-grid' }, rec.board, rec.detail)),
    ));
    renderBoardFilters();
    renderBoard();
  }

  function renderBoardFilters() {
    rec.filters.replaceChildren(...[['all', 'Everyone'], ['human', 'Human sharks'], ['ai', 'AI sharks'], ['team', 'Labeled team'], ['pitcher', 'Pitchers']].map(([id, label]) => el('button', {
      type: 'button',
      class: 'ct-pill',
      'aria-pressed': String(state.records.filter === id),
      on: { click: () => { state.records.filter = id; renderBoardFilters(); renderBoard(); } },
    }, label)));
  }

  function renderBoard() {
    const sharks = filterAndSortSharks(SHARK_LEADERBOARD, state.records);
    if (!sharks.some((s) => s.id === state.records.selectedId) && sharks[0]) state.records.selectedId = sharks[0].id;
    const selected = sharks.find((s) => s.id === state.records.selectedId) || null;
    const rows = sharks.map((s, i) => el('tr', { class: s.id === state.records.selectedId ? 'is-selected' : '' },
      el('td', { class: 'ct-num ct-rank' }, String(i + 1)),
      el('td', {},
        el('button', {
          type: 'button',
          class: 'ct-trader-btn',
          'aria-pressed': String(s.id === state.records.selectedId),
          on: { click: () => { state.records.selectedId = s.id; renderBoard(); } },
        },
          el('img', { src: s.avatar, alt: '', width: 32, height: 32, loading: 'lazy' }),
          el('span', {}, el('strong', {}, s.name), el('small', {}, s.walletType)))),
      el('td', { class: 'ct-num is-up', 'data-label': 'P&L' }, `+${usd(s.realizedPnlUsd)}`),
      el('td', { class: 'ct-num is-up', 'data-label': '30 days' }, signedPct(s.roi30d)),
      el('td', { class: 'ct-num', 'data-label': 'Win rate' }, `${s.winRate}%`),
      el('td', { class: 'ct-num', 'data-label': 'Copied' }, usd(s.copyVolumeUsd))));
    rec.board.replaceChildren(sharks.length
      ? el('table', { class: 'ct-table' },
        el('thead', {}, el('tr', {},
          el('th', { scope: 'col' }, '#'),
          el('th', { scope: 'col' }, 'Trader'),
          el('th', { scope: 'col' }, 'Realized P&L'),
          el('th', { scope: 'col' }, '30 days'),
          el('th', { scope: 'col' }, 'Win rate'),
          el('th', { scope: 'col' }, 'Copied'))),
        el('tbody', {}, rows))
      : el('p', { class: 'ct-empty' }, 'No traders match. Clear the search or pick another filter.'));
    if (!selected) {
      rec.detail.replaceChildren(el('p', { class: 'ct-empty' }, 'Pick a trader to see their record.'));
      return;
    }
    const thread = commentThread({
      key: `shark:${selected.id}`,
      fallback: [{ id: 'sc1', author: '@ShibuyaLP', badge: 'Rabby', text: `Consistent entries on uniform-clearing pitches. A capped follow on ${selected.name} has been my best risk-adjusted play.`, likes: 16, at: '1h ago' }],
      placeholder: `A public note on ${selected.name}`,
      label: `Note on ${selected.name}`,
    });
    rec.detail.replaceChildren(
      el('div', { class: 'ct-trader-head' },
        el('img', { src: selected.avatar, alt: '', width: 56, height: 56 }),
        el('div', {}, el('h3', {}, selected.name), el('p', { class: 'ct-sub' }, selected.walletType, ' ', el('code', {}, selected.address)))),
      el('div', { class: 'ct-badges' }, selected.badges.map((b) => tagPlain(b))),
      el('p', {}, selected.bio),
      el('dl', { class: 'ct-stats' },
        el('div', {}, el('dt', {}, 'Realized P&L'), el('dd', { class: 'ct-num is-up' }, `+${usd(selected.realizedPnlUsd)}`)),
        el('div', {}, el('dt', {}, '30 days'), el('dd', { class: 'ct-num is-up' }, signedPct(selected.roi30d))),
        el('div', {}, el('dt', {}, 'Pitches backed'), el('dd', { class: 'ct-num' }, String(selected.pitchesBacked))),
        el('div', {}, el('dt', {}, 'Followers'), el('dd', { class: 'ct-num' }, countFmt(selected.followers)))),
      xProofBadge(selected.xProof, { compact: false }),
      el('div', { class: 'ct-section-head' }, el('h3', {}, 'Notes'), thread.countEl),
      thread.form,
      thread.list,
    );
  }

  // ---------- Studio: set up a Deal or No Deal pitch ----------
  function renderStudio() {
    const f = state.studio;
    const preview = el('div', { class: 'ct-studio-preview' });
    const err = el('p', { class: 'ct-feedback is-error', 'aria-live': 'polite' });
    const field = (id, label, control, hint) => el('div', { class: 'ct-field' },
      el('label', { for: id }, label), control, hint ? el('small', { class: 'ct-hint' }, hint) : null);
    const input = (id, key, attrs = {}, map = (v) => v) => {
      const node = el('input', { id, class: 'ct-input', value: f[key], ...attrs });
      node.addEventListener('input', () => { f[key] = map(node.value); updatePreview(); });
      return node;
    };
    const select = (id, key, options, map = (v) => v) => {
      const node = el('select', { id, class: 'ct-input ct-select' }, options.map(([v, l]) => el('option', { value: v, selected: String(f[key]) === String(v) }, l)));
      node.addEventListener('change', () => { f[key] = map(node.value); updatePreview(); });
      return node;
    };

    const tickerIn = input('st-ticker', 'ticker', { type: 'text', maxlength: 12, autocomplete: 'off' }, (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, ''));
    tickerIn.addEventListener('input', () => { if (tickerIn.value !== f.ticker) tickerIn.value = f.ticker; });
    const hook = el('textarea', { id: 'st-hook', class: 'ct-input', rows: 3, maxlength: 220 });
    hook.value = f.pitchHook;
    hook.addEventListener('input', () => { f.pitchHook = hook.value; });
    const reveal = el('input', { id: 'st-reveal', type: 'checkbox', checked: f.revealHandle });
    reveal.addEventListener('change', () => { f.revealHandle = reveal.checked; updatePreview(); });

    const notableBtns = NOTABLE_FOLLOWERS.map((n) => {
      const b = el('button', { type: 'button', class: 'ct-toggle', 'aria-pressed': String(f.xNotable.includes(n.handle)) }, n.handle);
      b.addEventListener('click', () => {
        if (f.xNotable.includes(n.handle)) f.xNotable = f.xNotable.filter((h) => h !== n.handle);
        else if (f.xNotable.length < 4) f.xNotable = [...f.xNotable, n.handle];
        else { toast('Up to four notable followers can be shown.'); return; }
        for (const [i, btn] of notableBtns.entries()) btn.setAttribute('aria-pressed', String(f.xNotable.includes(NOTABLE_FOLLOWERS[i].handle)));
        updatePreview();
      });
      return b;
    });

    const feeBar = el('div', { class: 'ct-feebar', 'aria-hidden': 'true' });
    const feeRows = FEE_SPLIT_KEYS.map((key) => {
      const out = el('output', { class: 'ct-num', for: `st-fee-${key}` }, `${f.feeSplits[key]}%`);
      const range = el('input', { id: `st-fee-${key}`, type: 'range', min: '0', max: '100', step: '1', value: String(f.feeSplits[key]) });
      // the other splits keep the proportions they had when this slider was picked up, so repeated small steps don't drift
      let base = null;
      range.addEventListener('focus', () => { base = { ...f.feeSplits }; });
      range.addEventListener('pointerdown', () => { base = { ...f.feeSplits }; });
      range.addEventListener('blur', () => { base = null; });
      range.addEventListener('input', () => {
        f.feeSplits = rebalanceFeeSplits(base || f.feeSplits, key, Number(range.value));
        for (const row of feeRows) {
          row.range.value = String(f.feeSplits[row.key]);
          row.out.textContent = `${f.feeSplits[row.key]}%`;
        }
        drawFeeBar();
        updatePreview();
      });
      return { key, out, range, node: el('div', { class: `ct-fee-row fee-${key}` }, el('label', { for: `st-fee-${key}` }, el('i', { 'aria-hidden': 'true' }), FEE_LABELS[key]), range, out) };
    });
    function drawFeeBar() {
      feeBar.replaceChildren(...FEE_SPLIT_KEYS.filter((k) => f.feeSplits[k] > 0).map((k) => el('i', { class: `fee-${k}`, style: { '--w': `${f.feeSplits[k]}%` } })));
    }
    drawFeeBar();

    function updatePreview() {
      const proof = createPrivateXProof({ handle: f.xHandle, tier: f.xTier, notableFollowers: f.xNotable, revealHandle: f.revealHandle });
      const atMin = computeDealClearing({ committedEth: f.minRaiseEth, minRaiseEth: f.minRaiseEth, hardCapEth: f.hardCapEth }, state.ethUsd);
      const hardCap = Math.max(Number(f.minRaiseEth) + 5, Number(f.hardCapEth) || 0);
      preview.replaceChildren(
        el('div', { class: 'ct-section-head' }, el('h2', {}, 'How it looks on stage'), tagSim('Preview')),
        el('div', { class: 'ct-preview-card' },
          el('img', { src: '/images/clanktrade/pitcher-founder.png', alt: '', width: 52, height: 52 }),
          el('div', {},
            el('p', { class: 'ct-head-title' }, el('span', { class: 'ct-head-ticker' }, `$${f.ticker || 'TOKEN'}`), el('span', { class: 'ct-head-name' }, f.name || 'Untitled pitch')),
            el('p', { class: 'ct-sub' }, proof.handleVisible ? `Pitched by ${proof.revealedHandle}` : 'Pitched by a pseudonymous avatar'),
            xProofBadge(proof))),
        el('dl', { class: 'ct-facts' },
          el('div', {}, el('dt', {}, 'Paired with'), el('dd', {}, f.pairSymbol)),
          el('div', {}, el('dt', {}, 'Deal line and hard cap'), el('dd', { class: 'ct-num' }, `${eth(f.minRaiseEth)} and ${eth(hardCap)}`)),
          el('div', {}, el('dt', {}, 'Clearing price at the deal line'), el('dd', {}, `${usd(atMin.clearingMcapUsd)} market cap`)),
          el('div', {}, el('dt', {}, 'Creator allocation'), el('dd', {}, `${f.creatorAllocPct}%, ${f.lockDays}-day linear cliff`)),
          el('div', {}, el('dt', {}, 'Below the deal line'), el('dd', { class: 'is-up' }, 'Everyone is refunded automatically'))),
        el('div', { class: 'ct-fee-legend' },
          el('h3', {}, 'Where trading fees go'),
          feeBar.cloneNode(true),
          el('ul', {}, FEE_SPLIT_KEYS.map((k) => el('li', { class: `fee-${k}` }, el('i', { 'aria-hidden': 'true' }), `${FEE_LABELS[k]} ${f.feeSplits[k]}%`)))),
        el('details', { class: 'ct-details' },
          el('summary', {}, 'Fee router call (proposed SDK)'),
          el('pre', { class: 'ct-code' }, formatFeeRouterSnippet(f.ticker, f.feeSplits))),
      );
    }
    updatePreview();

    const form = el('form', {
      class: 'ct-studio-form',
      novalidate: true,
      on: {
        submit: (e) => {
          e.preventDefault();
          const check = validateFeeSplits(f.feeSplits);
          if (!check.ok) { err.textContent = check.error; return; }
          if (!String(f.name).trim() || !String(f.ticker).trim()) { err.textContent = 'Give the coin a name and a ticker to go live.'; return; }
          const minRaise = Math.max(5, Math.min(100, Number(f.minRaiseEth) || 20));
          launchPitch({ ...f, minRaiseEth: minRaise, hardCapEth: Math.max(minRaise + 5, Number(f.hardCapEth) || 40) });
        },
      },
    },
      el('fieldset', {},
        el('legend', {}, el('span', { class: 'ct-step' }, '1'), 'The deal'),
        el('div', { class: 'ct-field-grid' },
          field('st-name', 'Coin name', input('st-name', 'name', { type: 'text', maxlength: 48 })),
          field('st-ticker', 'Ticker', tickerIn)),
        el('div', { class: 'ct-field-grid' },
          field('st-pair', 'Paired with', select('st-pair', 'pairSymbol', [['ETH', 'ETH'], ...STOCK_PAIRS.map((s) => [s.symbol, `${s.symbol}, ${s.name}`])])),
          field('st-lock', 'Creator lock', select('st-lock', 'lockDays', [30, 90, 180, 365].map((d) => [d, `${d}-day linear cliff`]), Number))),
        el('div', { class: 'ct-field-grid' },
          field('st-min', 'Deal line (ETH)', input('st-min', 'minRaiseEth', { type: 'number', min: '5', max: '100', step: '1', inputmode: 'decimal' }, Number), 'Below this, everyone is refunded'),
          field('st-cap', 'Hard cap (ETH)', input('st-cap', 'hardCapEth', { type: 'number', min: '10', max: '250', step: '1', inputmode: 'decimal' }, Number), 'At least 5 ETH above the deal line')),
        field('st-alloc', 'Creator allocation (%)', input('st-alloc', 'creatorAllocPct', { type: 'number', min: '0', max: '5', step: '0.5', inputmode: 'decimal' }, Number)),
        field('st-hook', 'Opening line, read on stage', hook)),
      el('fieldset', {},
        el('legend', {}, el('span', { class: 'ct-step' }, '2'), 'Your X credentials'),
        el('p', { class: 'ct-sub' }, 'Prove your follower range and who follows you without showing your handle.'),
        el('div', { class: 'ct-field-grid' },
          field('st-handle', 'X handle (kept private)', input('st-handle', 'xHandle', { type: 'text', maxlength: 32, autocomplete: 'off' })),
          field('st-tier', 'Follower range', select('st-tier', 'xTier', FOLLOWER_TIERS.map((t) => [t, t])))),
        el('div', { class: 'ct-field' }, el('span', { class: 'ct-label', id: 'st-notable' }, 'Notable followers to prove (up to four)'),
          el('div', { class: 'ct-toggles', role: 'group', 'aria-labelledby': 'st-notable' }, notableBtns)),
        el('label', { class: 'ct-check', for: 'st-reveal' }, reveal, 'Show my handle publicly too')),
      el('fieldset', {},
        el('legend', {}, el('span', { class: 'ct-step' }, '3'), 'Where trading fees go'),
        el('p', { class: 'ct-sub' }, 'Move any slider and the others adjust, so the split always adds up to 100%.'),
        feeBar,
        el('div', { class: 'ct-fees' }, feeRows.map((r) => r.node))),
      err,
      el('button', { type: 'submit', class: 'ct-btn ct-btn-primary ct-btn-block ct-btn-lg' }, 'Go live in the tank'),
    );

    viewHost.replaceChildren(el('div', { class: 'ct-page' },
      el('header', { class: 'ct-page-head' },
        el('h1', {}, 'Studio'),
        el('p', { class: 'ct-lede' }, 'Set up a Deal or No Deal pitch: one clearing price for everyone, a refund if it misses the deal line, private X credentials, and fees routed where you choose.')),
      el('div', { class: 'ct-studio' }, form, preview),
    ));
  }

  function launchPitch(f) {
    const ticker = String(f.ticker).trim().toUpperCase();
    const name = String(f.name).trim();
    const proof = createPrivateXProof({ handle: f.xHandle, tier: f.xTier, notableFollowers: f.xNotable, revealHandle: f.revealHandle });
    state.episodeCounter += 1;
    const id = `room-custom-${Date.now()}`;
    const room = {
      id,
      mode: 'DEAL_OR_NO_DEAL',
      kind: 'deal',
      stageType: 'vrm-vladcat',
      title: name,
      ticker,
      episode: state.episodeCounter,
      subtitle: `Your pitch, paired with ${f.pairSymbol}`,
      venue: 'Clank Tank deal',
      venueBadge: 'Deal or No Deal',
      pairSymbol: f.pairSymbol,
      address: null,
      avatar: '/images/clanktrade/pitcher-founder.png',
      pitcherName: 'Your avatar',
      pitcherAlias: proof.handleVisible ? proof.revealedHandle : 'Pseudonymous founder',
      pitcherTrackRecord: 'First pitch',
      creatorWallet: wallet.get().address,
      viewers: 312,
      minRaiseEth: f.minRaiseEth,
      hardCapEth: f.hardCapEth,
      committedEth: 2.5,
      startCommittedEth: 2.5,
      contributors: 19,
      startContributors: 19,
      userCommittedEth: 0,
      timeLeftSec: 900,
      startTimeSec: 900,
      saleSupply: 600_000_000,
      totalSupply: 1_000_000_000,
      xProof: proof,
      terms: {
        creatorAllocPct: f.creatorAllocPct,
        lockPeriod: `${f.lockDays}-day linear cliff, LP locked forever`,
        publicCapPct: 0.5,
        sharkCapPct: 2.0,
        feeMode: FEE_SPLIT_KEYS.map((k) => `${f.feeSplits[k]}% ${FEE_LABELS[k].toLowerCase()}`).join(', '),
      },
      feeSplits: { ...f.feeSplits },
      dd: {
        verdict: 'Clean deal',
        verdictTone: 'good',
        devHistory: 'Fresh Deal or No Deal escrow, no pre-mint',
        bundlePct: '0% (uniform clearing)',
        washVolumePct: '0% (before launch)',
        lpLocked: 'Locked in Uniswap V4 on a deal',
        notes: [
          `zk-X proof: ${proof.tier}, handle ${proof.handleVisible ? 'shown' : 'hidden'}`,
          `${f.feeSplits.jackpotPot}% of fees to the holder jackpot and ${f.feeSplits.lpPool}% to the LP pool`,
          `Everyone is refunded below the ${f.minRaiseEth} ETH deal line`,
        ],
      },
      recentCommits: [
        { id: 'nc1', who: 'VALKYRIE-9', tag: 'AI shark', amountEth: 1.5, isShark: true, at: Date.now() },
        { id: 'nc2', who: 'AGI-1 DD', tag: 'AI DD', amountEth: 1.0, isShark: true, at: Date.now() },
      ],
      script: [
        { speaker: 'NARRATOR', role: 'Host', line: `New pitch in the tank: ${name} ($${ticker}), paired with ${f.pairSymbol}. The deal line is ${f.minRaiseEth} ETH.` },
        { speaker: 'PITCHER', role: 'Your avatar', line: f.pitchHook || `Launching $${ticker} with uniform clearing and provable fee splits.` },
        { speaker: 'AGI-1 DD', role: 'AI DD co-host', line: `zk-X proof checks out (${proof.tier}). The creator holds ${f.creatorAllocPct}%, locked for ${f.lockDays} days, and uniform clearing leaves nothing for snipers to bundle.` },
        { speaker: 'KURO-SAN', role: 'Tokyo VC shark', line: `Sending ${f.feeSplits.jackpotPot}% of fees to a holder jackpot is a real answer to day-7 retention. Now show us the community.` },
      ],
      comments: [],
    };
    state.rooms.unshift(room);
    toast(`$${ticker} is live in the tank. Play ETH only.`);
    selectRoom(id);
  }

  // ---------- Thesis: the memo and the developer.clank.trade V2 SDK ----------
  function renderThesis() {
    const t = MARKET_THESIS_FOR_BAOSKEE;
    const contractRows = [
      ['Clank V2 launch factory', CLANK_CONTRACTS.factoryV2],
      ['Launch-and-buy forwarder', CLANK_CONTRACTS.launchForwarder],
      ['Uniswap V4 PoolManager', CLANK_CONTRACTS.v4PoolManager],
      ['Universal Router', CLANK_CONTRACTS.universalRouter],
      ['Permit2', CLANK_CONTRACTS.permit2],
      ['Robinhood WETH', CLANK_CONTRACTS.weth],
      ['V4 Quoter', CLANK_CONTRACTS.v4Quoter],
      ['V2-beta legacy factory ($AGI)', CLANK_CONTRACTS.legacyFactoryV2Beta],
    ];
    const today = `import { createPublicClient, http } from "viem";
import { createClankClient } from "@clanktrade/sdk";

const publicClient = createPublicClient({ chain: robinhoodChain, transport: http() });
const clank = createClankClient({
  publicClient,
  chainId: ${CLANK_CONTRACTS.chainId},
  factory: "${CLANK_CONTRACTS.factoryV2}",
  // launch fee: free; bonding curve: 1% (100 bps); Uniswap V4: 0.3% (3000)
});

const quote = await clank.quoteBuy({ token: "0xfa31d04462746aaa24bc7e5626403e09e4b106ec", amountIn: 10n ** 17n });
const tx = await clank.buildBuy({ quote, recipient: userWallet, slippageBps: 100 });`;
    const proposed = `// Proposed Clank Tank extension: a uniform-clearing Deal or No Deal escrow
const deal = await clank.createPitchDeal({
  minRaiseEth: 20n * 10n ** 18n,      // below it: 100% automatic refund (daos.fun logic)
  hardCapEth: 40n * 10n ** 18n,       // one clearing price for everyone, no sniper clusters
  pairToken: "0x4a0E...5eEa",         // SPCX tokenized stock liquidity
  zkXCredentialHash: "zkX:0x8a2f...", // proves a follower range without the handle
  graduateDirectlyToV4: true,         // locked full-range Uniswap V4 position on a deal
});`;
    viewHost.replaceChildren(el('article', { class: 'ct-page ct-memo' },
      el('header', { class: 'ct-memo-head' },
        el('p', { class: 'ct-memo-to' }, `Memo to ${t.recipient}, from agi1.app`),
        el('h1', {}, t.headline),
        el('p', { class: 'ct-lede' }, t.summary),
        el('p', { class: 'ct-sub' }, 'Inspired by Shark Tank, CryptoKnightsHQ and Tokyo pitch nights.')),
      el('section', { class: 'ct-memo-section', 'aria-labelledby': 'ct-market-title' },
        el('h2', { id: 'ct-market-title' }, 'The state of the market'),
        el('dl', { class: 'ct-memo-list' }, t.marketState.map((m) => el('div', {},
          el('dt', {}, m.tag),
          el('dd', {}, el('strong', {}, m.title), el('p', {}, m.detail)))))),
      el('section', { class: 'ct-memo-section', 'aria-labelledby': 'ct-pillars-title' },
        el('h2', { id: 'ct-pillars-title' }, 'Six upgrades, all working in this prototype'),
        el('div', { class: 'ct-pillars' }, t.pillars.map((p) => el('article', { class: 'ct-pillar' },
          el('h3', {}, p.title),
          el('p', { class: 'ct-pillar-badge' }, p.badge),
          el('p', {}, p.body))))),
      el('section', { class: 'ct-memo-section', 'aria-labelledby': 'ct-dev-title' },
        el('div', { class: 'ct-section-head' },
          el('div', {},
            el('h2', { id: 'ct-dev-title' }, 'developer.clank.trade: V2 contracts on Robinhood Chain'),
            el('p', { class: 'ct-sub' }, `Chain ${CLANK_CONTRACTS.chainId}, config ${CLANK_CONTRACTS.configId}. Launch fee: free. Curve fee: 1% (${CLANK_CONTRACTS.curveFeeBps} bps). Uniswap V4 fee: 0.3% (${CLANK_CONTRACTS.v4FeeMillionths}). Deployed at block ${CLANK_CONTRACTS.deployBlock.toLocaleString('en-US')}.`)),
          el('a', { class: 'ct-btn ct-btn-sm', href: 'https://developer.clank.trade', target: '_blank', rel: 'noopener noreferrer' }, 'developer.clank.trade', icon('external'))),
        el('ul', { class: 'ct-contracts' }, contractRows.map(([label, addr]) => el('li', {},
          el('span', {}, el('strong', {}, label), el('code', { title: addr }, addr)),
          el('button', {
            type: 'button',
            class: 'ct-icon-btn',
            'aria-label': `Copy the ${label} address`,
            on: {
              click: async () => {
                try { await navigator.clipboard.writeText(addr); toast(`Copied the ${label} address.`); } catch { toast(`${label}: ${addr}`); }
              },
            },
          }, icon('copy'))))),
        el('div', { class: 'ct-code-pair' },
          el('figure', {}, el('figcaption', {}, el('strong', {}, 'Works today'), ' with @clanktrade/sdk'), el('pre', { class: 'ct-code' }, today)),
          el('figure', {}, el('figcaption', {}, el('strong', {}, 'Proposed'), ' for Clank Tank'), el('pre', { class: 'ct-code' }, proposed)))),
    ));
  }

  function renderFooter() {
    return el('footer', { class: 'ct-footer' },
      el('p', {}, 'Clank Tank is a concept and interactive prototype on agi1.app, built for @baoskee and the Robinhood Chain community. Deals and trades here use play ETH and send nothing onchain; coin listings, prices, trades and risk scans come from clank.trade’s public data. Entertainment and a product prototype only, not financial advice.'),
      el('p', {}, 'The Vladcat 3D model is © Clanktrade, used unmodified under CC BY-SA 4.0. The Clank marks and the Suisse Intl font belong to their owners.'),
      el('p', { class: 'ct-footer-links' },
        el('a', { href: 'https://clank.trade', target: '_blank', rel: 'noopener noreferrer' }, 'clank.trade', icon('external')),
        el('a', { href: 'https://developer.clank.trade', target: '_blank', rel: 'noopener noreferrer' }, 'developer.clank.trade', icon('external')),
        el('a', { href: '/' }, 'agi1.app')),
    );
  }

  // ---------- Views ----------
  function showView(next) {
    state.view = next;
    for (const [id, a] of navLinks) {
      if (id === next) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    }
    root.dataset.view = next;
    live.chart?.destroy();
    live.chart = null;
    if (next === 'live') renderLive();
    else if (next === 'markets') renderMarkets();
    else if (next === 'records') renderRecords();
    else if (next === 'studio') renderStudio();
    else renderThesis();
    const title = VIEWS.find((v) => v.id === next)?.label || 'Live';
    document.title = next === 'live'
      ? 'Clank Tank · The Shark Tank of Crypto on Robinhood Chain · AGI'
      : `${title} · Clank Tank · AGI`;
  }

  window.addEventListener('hashchange', () => {
    const next = viewFromHash();
    if (next !== state.view) {
      showView(next);
      window.scrollTo({ top: 0, behavior: 'instant' });
      main.focus({ preventScroll: true });
    }
  });

  // ---------- Timers: the round clock, the scene, the live feed ----------
  setInterval(() => {
    if (document.hidden) return;
    for (const r of state.rooms) {
      if (!hasRound(r) || r.settledStatus || !(r.timeLeftSec > 0)) continue;
      r.timeLeftSec -= 1;
      if (r.timeLeftSec <= 0) settleRoom(r, { auto: true });
    }
    if (state.view === 'live') updateClock();
  }, 1000);

  let sceneTimer = 0;
  let sceneTicks = 0;
  function restartSceneTimer() {
    clearInterval(sceneTimer);
    sceneTimer = setInterval(() => {
      if (document.hidden || state.view !== 'live') return;
      advanceScene(1);
      sceneTicks += 1;
      const room = currentRoom();
      if (sceneTicks % 2 === 0 && hasRound(room) && !room.settledStatus && flashEventsFor(room.ticker).length > 1 && !focusInside(live.flash)) {
        state.flashCursor += 1;
        renderFlash();
        live.flash.firstElementChild?.classList.add('is-new');
      }
    }, 6800);
  }

  setInterval(() => { if (!document.hidden) syncLiveFeed(); }, 12_000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && state.liveStatus !== 'connecting') syncLiveFeed(); });

  // ---------- Mount ----------
  root.replaceChildren(header, notice, main, tape, walletDialog, dossierDialog, toastEl);
  syncWallet();
  renderTape();
  showView(state.view);
  restartSceneTimer();
  syncLiveFeed();
}

if (typeof document !== 'undefined') {
  const host = document.querySelector('[data-ct-root]');
  if (host) bootClankTrade(host);
}
