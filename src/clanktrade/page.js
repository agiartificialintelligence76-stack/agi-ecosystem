// Clank Tank v2 (agi1.app/clanktrade) — The Shark Tank of Crypto on Robinhood Chain.
// Turns live avatar pitching into THE core mechanism (not an empty sidebar next to a launchpad):
// 1. Live Tank: 3D VRM Avatar Stage + Deal or No Deal uniform clearing escrow (daos.fun logic) +
//    4 Always-On AI Sharks + Narrator (clank.world engine) with fee-funded public P&L wallets +
//    AI Due-Diligence Co-Host (live ClankChecker scans + labeled team wallets) +
//    Sharks Buy on Stream flash banner with capped one-tap Follow + live user comments.
// 2. Pitch Anything: Real live clank.trade Robinhood Chain coins (/api/checker?terminal=clank) +
//    Pons coins + Stock Tokens (SPCX, NVDA, PLTR, RDDT, AMC, META, AAPL, HIMS, TTWO) + Perps + Outcomes.
// 3. Pitch & Shark Records: Permanent pitch cards + full trader realized P&L leaderboard with sort/filter/comments.
// 4. Deal Studio: Interactive Deal or No Deal launcher + Privacy-Preserving zk-X Credential builder +
//    Programmable Creator Fee Split Router (LP, Jackpot, Holders, AI Sharks, Creator).
// 5. Thesis & Dev SDK: State of the Market memo for @baoskee + verified developer.clank.trade V2 Contracts & SDK.

import '../styles/clanktrade.css';
import {
  ETH_USD_FALLBACK,
  CLANK_CONTRACTS,
  STOCK_PAIRS,
  FOLLOWER_TIERS,
  NOTABLE_FOLLOWERS,
  AI_SHARKS,
  DEFAULT_FEE_SPLITS,
  INITIAL_LIVE_ROOMS,
  PITCH_ANYTHING_EXTRA,
  PITCH_RECORDS,
  SHARK_LEADERBOARD,
  SHARK_FLASH_EVENTS,
  MARKET_THESIS_FOR_BAOSKEE,
  createPrivateXProof,
  validateFeeSplits,
  formatFeeRouterSnippet,
  computeDealClearing,
  commitToDeal,
  settleDeal,
  buildDueDiligenceReport,
  filterAndSortSharks,
  buildDynamicSceneForCoin,
  generateSyntheticCandles,
} from './data.js';
import { EXTERNAL_WALLETS, createTankWallet, shortAddress } from './wallet.js';
import { mountTankAvatarStage } from './stage3d.js';
import { createTankChart } from './chart.js';

const COMMENTS_STORAGE = 'clanktrade:comments:v2';

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'on' && typeof v === 'object') {
      for (const [ev, fn] of Object.entries(v)) node.addEventListener(ev, fn);
    } else if (k === 'data' && typeof v === 'object') {
      for (const [dk, dv] of Object.entries(v)) node.dataset[dk] = String(dv);
    } else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'hidden') {
      node[k] = Boolean(v);
    } else if (k === 'value') {
      node.value = String(v);
    } else {
      node.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(typeof child === 'string' || typeof child === 'number' ? document.createTextNode(String(child)) : child);
  }
  return node;
}

function moneyCompact(n) {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function formatClock(secs) {
  const s = Math.max(0, Math.floor(secs));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
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
  try {
    localStorage.setItem(COMMENTS_STORAGE, JSON.stringify(map));
  } catch { /* ignore */ }
}

function renderPrivateXBadges(xProof, { compact = false } = {}) {
  const row = el('div', { class: 'ct-cred-pills' });
  row.append(
    el('img', { src: '/games/trenchingsimulator/clank/clank-mark.svg', alt: 'Clank verified', class: 'ct-clank-mini' }),
    el('span', { class: 'ct-x-pill', title: xProof.privacySummary },
      el('span', { class: 'ct-x-mark', 'aria-hidden': 'true' }, '𝕏'),
      xProof.tier,
    ),
  );
  const list = compact ? xProof.notableFollowers.slice(0, 2) : xProof.notableFollowers;
  for (const handle of list) {
    const meta = NOTABLE_FOLLOWERS.find((n) => n.handle === handle) || { initials: handle.slice(1, 3).toUpperCase(), hue: 'lavender' };
    row.append(
      el('span', { class: 'ct-x-pill' },
        el('span', { class: `ct-notable-dot hue-${meta.hue}`, 'aria-hidden': 'true' }, meta.initials),
        `followed by ${handle}`,
      ),
    );
  }
  if (!compact) {
    row.append(
      el('span', { class: 'ct-zk-note ct-mono' },
        xProof.handleVisible ? `Handle revealed: ${xProof.revealedHandle}` : `🔒 Handle hidden (${xProof.zkProofId})`,
      ),
    );
  }
  return row;
}

export function bootClankTrade(root) {
  if (!root) return;
  const wallet = createTankWallet();
  const savedComments = loadSavedComments();

  const state = {
    view: 'tank', // 'tank' | 'pitch-anything' | 'records' | 'studio' | 'thesis'
    sidebarCollapsed: false,
    rooms: INITIAL_LIVE_ROOMS.map((r) => ({ ...r, recentCommits: [...r.recentCommits], script: [...r.script], comments: [...r.comments] })),
    activeRoomId: INITIAL_LIVE_ROOMS[0].id,
    stageCam: 'pitcher', // 'pitcher' | 'desk' | 'chart'
    scriptCursor: 0,
    flashIndex: 0,
    flashPop: false,
    ethUsd: ETH_USD_FALLBACK,
    liveStatus: 'connecting',
    liveCoins: [],
    liveStocks: [...STOCK_PAIRS],
    recentTrades: [],
    invCategory: 'all',
    invPair: 'all',
    invQuery: '',
    sharkFilter: 'all',
    sharkSort: 'pnl',
    sharkQuery: '',
    selectedSharkId: SHARK_LEADERBOARD[0].id,
    studioForm: {
      launchType: 'deal',
      name: 'Neo Tokyo AI',
      ticker: 'NTOKYO',
      pairSymbol: 'SPCX',
      minRaiseEth: 20,
      hardCapEth: 45,
      creatorAllocPct: 2.0,
      lockDays: 90,
      pitchHook: 'Uniform-clearing Robinhood Chain pitch backed by live SPCX stock flow and programmable holder jackpots.',
      xHandle: 'founder_anon',
      xTier: '500K+ followers',
      xNotable: ['@elonmusk', '@pmarca', '@baoskee'],
      revealHandle: false,
      feeSplits: { ...DEFAULT_FEE_SPLITS },
    },
    commitInput: '0.5',
    dealFeedback: '',
    dealFeedbackTone: '',
    toastText: '',
    toastTimer: null,
    activeDossier: null,
    dossierDd: null,
    dossierCandles: [],
    vrmInstance: null,
    stageChart: null,
    dossierChart: null,
  };

  function currentRoom() {
    return state.rooms.find((r) => r.id === state.activeRoomId) || state.rooms[0];
  }

  function commentsFor(key, fallback = []) {
    return Array.isArray(savedComments[key]) ? savedComments[key] : fallback;
  }

  function addComment(key, fallback, text) {
    const clean = String(text || '').trim().slice(0, 280);
    if (!clean) return false;
    const w = wallet.get();
    const list = [...commentsFor(key, fallback)];
    list.unshift({
      id: `u-${Date.now()}`,
      author: w.connected ? `${w.short}` : 'Anon Viewer',
      badge: w.connected ? (w.isHardware ? 'HARDWARE' : 'SIM WALLET') : 'VIEWER',
      text: clean,
      likes: 1,
      at: 'just now',
    });
    savedComments[key] = list.slice(0, 40);
    saveComments(savedComments);
    return true;
  }

  function likeComment(key, fallback, id) {
    const list = [...commentsFor(key, fallback)].map((c) => (c.id === id ? { ...c, likes: (c.likes || 0) + 1 } : c));
    savedComments[key] = list;
    saveComments(savedComments);
  }

  // ---------- Toast ----------
  const toastEl = el('div', { class: 'ct-toast', role: 'status', 'aria-live': 'polite', hidden: true });
  function showToast(msg) {
    clearTimeout(state.toastTimer);
    toastEl.textContent = msg;
    toastEl.hidden = false;
    state.toastTimer = setTimeout(() => { toastEl.hidden = true; }, 4200);
  }

  // ---------- Header ----------
  const navItems = [
    { id: 'tank', label: 'Live Tank', liveDot: true },
    { id: 'pitch-anything', label: 'Pitch Anything' },
    { id: 'records', label: 'Pitch & Shark Records' },
    { id: 'studio', label: 'Deal Studio' },
    { id: 'thesis', label: 'Thesis & Dev SDK' },
  ];

  const navButtons = new Map();
  const navEl = el('nav', { class: 'ct-nav', 'aria-label': 'Clank Tank navigation' });
  for (const item of navItems) {
    const btn = el('button', {
      type: 'button',
      class: `ct-nav-btn ${state.view === item.id ? 'is-active' : ''}`,
      on: { click: () => switchView(item.id) },
    }, item.liveDot ? el('span', { class: 'ct-nav-dot', 'aria-hidden': 'true' }) : null, item.label);
    navButtons.set(item.id, btn);
    navEl.append(btn);
  }

  const walletDot = el('span', { class: 'ct-wallet-dot' });
  const walletPrimaryText = el('strong', {}, 'Connect wallet');
  const walletSubText = el('small', {}, 'External / Hardware first');
  const walletBtn = el('button', {
    type: 'button',
    class: 'ct-wallet-btn',
    on: { click: openWalletModal },
  }, walletDot, el('span', { class: 'ct-wallet-meta' }, walletPrimaryText, walletSubText));

  function syncWalletButton() {
    const w = wallet.get();
    walletDot.classList.toggle('is-on', w.connected);
    if (w.connected) {
      walletPrimaryText.textContent = `${w.playBalanceEth.toFixed(2)} ETH · ${w.short}`;
      walletSubText.textContent = `${w.providerName} · 4663`;
    } else {
      walletPrimaryText.textContent = 'Connect wallet';
      walletSubText.textContent = 'Hardware & External first';
    }
  }
  wallet.on(syncWalletButton);

  const header = el('header', { class: 'ct-header' },
    el('div', { class: 'ct-header-left' },
      el('a', { class: 'ct-agi-back', href: '/' }, '← ', el('span', {}, 'agi1.app')),
      el('button', { type: 'button', class: 'ct-brand', on: { click: () => switchView('tank') } },
        el('img', { src: '/games/trenchingsimulator/clank/clank-mark.svg', alt: '', class: 'ct-brand-mark' }),
        el('img', { src: '/games/trenchingsimulator/clank/clank-word.svg', alt: 'Clank Tank', class: 'ct-brand-word' }),
        el('span', { class: 'ct-brand-pill' }, 'TANK v2'),
      ),
    ),
    navEl,
    el('div', { class: 'ct-header-right' },
      el('button', { type: 'button', class: 'ct-btn ct-btn-primary', on: { click: () => switchView('studio') } }, 'Pitch a Deal'),
      walletBtn,
    ),
  );

  // ---------- Collapsible Always-Live Sidebar ----------
  const sidebarRoomList = el('div', { class: 'ct-sidebar-body' });
  const liveCountSpan = el('span', {}, `Live (${state.rooms.length})`);
  const collapseBtn = el('button', {
    type: 'button',
    class: 'ct-collapse-btn',
    'aria-label': 'Toggle live channels sidebar',
    'aria-expanded': 'true',
    on: {
      click: () => {
        state.sidebarCollapsed = !state.sidebarCollapsed;
        shell.classList.toggle('is-collapsed', state.sidebarCollapsed);
        collapseBtn.textContent = state.sidebarCollapsed ? '›' : '‹';
        collapseBtn.setAttribute('aria-expanded', String(!state.sidebarCollapsed));
      },
    },
  }, '‹');

  const sidebar = el('aside', { class: 'ct-sidebar', 'aria-label': 'Always-on live Shark Tank channels' },
    el('div', { class: 'ct-sidebar-head' },
      el('span', { class: 'ct-live-pill' },
        el('span', { class: 'ct-live-pulse', 'aria-hidden': 'true' }),
        el('span', { class: 'ct-sidebar-title-text' }, liveCountSpan),
        el('span', { class: 'ct-tag-chip is-green ct-sidebar-title-text' }, '24/7 ON AIR'),
      ),
      collapseBtn,
    ),
    sidebarRoomList,
    el('div', { class: 'ct-sidebar-foot' },
      el('div', { class: 'ct-wallet-stance-box' },
        el('strong', {}, 'Wallet-Native First · 4663'),
        'Ledger, Trezor, Rabby & MetaMask first — zero forced custodial lock-in.',
      ),
      el('button', { type: 'button', class: 'ct-btn ct-btn-primary', on: { click: () => switchView('studio') } }, '((o)) Go Live & Pitch'),
    ),
  );

  function renderSidebar() {
    liveCountSpan.textContent = `Live (${state.rooms.length})`;
    sidebarRoomList.replaceChildren();
    sidebarRoomList.append(
      el('div', { class: 'ct-always-banner' },
        el('strong', {}, 'Never Live (0) Again', el('span', { class: 'ct-tag-chip is-cyan' }, 'clank.world')),
        el('span', {}, '4 AI Sharks + Narrator run 24/7 between human pitches, reviewing live Robinhood Chain launches with public P&L wallets.'),
      ),
      el('span', { class: 'ct-side-label' }, 'Active Broadcast Channels'),
    );
    for (const room of state.rooms) {
      const clearing = computeDealClearing(room, state.ethUsd);
      const isActive = state.view === 'tank' && state.activeRoomId === room.id;
      const item = el('button', {
        type: 'button',
        class: `ct-room-item ${isActive ? 'is-active' : ''}`,
        on: {
          click: () => {
            state.activeRoomId = room.id;
            state.scriptCursor = 0;
            state.dealFeedback = '';
            switchView('tank');
          },
        },
      },
        el('img', { src: room.avatar, alt: '', class: 'ct-room-thumb' }),
        el('span', { class: 'ct-room-info' },
          el('strong', {}, room.title),
          el('span', { class: 'ct-room-meta' },
            el('span', { class: `ct-tag-chip ${room.mode === 'DEAL_OR_NO_DEAL' ? 'is-green' : room.mode === 'AI_SHARK_DESK' ? 'is-cyan' : 'is-gold'}` }, room.venueBadge),
            `${room.viewers.toLocaleString()} live`,
          ),
          el('span', { class: 'ct-room-meta ct-mono' }, `${clearing.totalCommittedEth}/${clearing.minRaiseEth} ETH · ${room.pairSymbol}`),
        ),
      );
      sidebarRoomList.append(item);
    }

    if (state.liveCoins.length) {
      sidebarRoomList.append(el('span', { class: 'ct-side-label' }, 'Pull Live Coin Onto AI Desk'));
      for (const coin of state.liveCoins.slice(0, 4)) {
        sidebarRoomList.append(
          el('button', {
            type: 'button',
            class: 'ct-room-item',
            on: { click: () => pullLiveCoinToTank(coin) },
          },
            el('img', {
              src: coin.image ? `/api/checker?terminal=clank&image=${coin.address}` : '/games/trenchingsimulator/clank/clank-mark.svg',
              alt: '',
              class: 'ct-room-thumb',
            }),
            el('span', { class: 'ct-room-info' },
              el('strong', {}, `${coin.name} ($${coin.ticker})`),
              el('span', { class: 'ct-room-meta ct-mono' }, `${moneyCompact(coin.marketCapUsd)} MC · Pull to AI Desk →`),
            ),
          ),
        );
      }
    }
  }

  // ---------- Main Container & Shell ----------
  const mainEl = el('main', { id: 'ct-main', class: 'ct-main' });
  const shell = el('div', { class: 'ct-shell' }, sidebar, mainEl);

  // ---------- Bottom Live Trade Tape ----------
  const tapeTrack = el('div', { class: 'ct-tape-track' });
  const tape = el('div', { class: 'ct-tape', 'aria-label': 'Live Clank Tank trades and Shark commits' },
    el('div', { class: 'ct-tape-badge' }, el('span', { class: 'ct-nav-dot', 'aria-hidden': 'true' }), '4663 LIVE TAPE'),
    el('div', { class: 'ct-tape-viewport' }, tapeTrack),
  );

  function renderTape() {
    const baseItems = state.recentTrades.length
      ? state.recentTrades.slice(0, 14).map((t) => ({
        side: t.side,
        text: `${Number(t.quote || 0).toFixed(4)} ${t.quoteAsset || 'ETH'} ${t.side === 'buy' ? 'bought' : 'sold'} $${t.ticker}`,
        badge: 'LIVE 4663',
      }))
      : [
        { side: 'buy', text: '2.40 ETH DEAL COMMIT · @TokyoWhale (#1 Shark) -> $AAGII', badge: 'SHARK FLASH' },
        { side: 'buy', text: '1.80 ETH AI WALLET · VALKYRIE-9 -> $AAGII', badge: 'AI SHARK' },
        { side: 'buy', text: '1.50 ETH LABELED TEAM · @baoskee -> $AAGII', badge: 'VERIFIED TEAM' },
        { side: 'buy', text: '1.25 ETH ROUTED · DEGEN-V4 -> $SPCX-5X (0.35% Clank fee)', badge: 'PITCH ANYTHING' },
        { side: 'buy', text: '0.80 ETH DD PASSED · AGI-1 DD -> $AGI', badge: 'AI DD' },
        { side: 'sell', text: 'NO DEAL REFUND · 6.10 ETH returned 100% on $SHAD (missed 20 ETH min)', badge: 'REFUNDED' },
      ];
    const doubled = [...baseItems, ...baseItems];
    tapeTrack.replaceChildren(...doubled.map((item) =>
      el('span', { class: `ct-tape-item ${item.side === 'sell' ? 'is-sell' : 'is-buy'}` },
        el('span', { class: `ct-tag-chip ${item.side === 'sell' ? 'is-red' : 'is-green'}` }, item.badge),
        el('strong', {}, item.text),
      ),
    ));
  }

  // ---------- Wallet-Native Modal ----------
  const walletDialog = el('dialog', { class: 'ct-dialog is-narrow', 'aria-labelledby': 'ct-wallet-dlg-title' });
  const walletDialogMsg = el('p', { class: 'ct-feedback' });

  function openWalletModal() {
    const w = wallet.get();
    walletDialogMsg.textContent = '';
    const extList = el('div', { class: 'ct-wallet-list' }, ...EXTERNAL_WALLETS.map((meta) =>
      el('button', {
        type: 'button',
        class: 'ct-wallet-option',
        on: {
          click: async () => {
            const res = await wallet.connectExternal(meta);
            walletDialogMsg.textContent = res.ok ? res.message : res.error;
            walletDialogMsg.className = `ct-feedback ${res.ok ? 'is-good' : 'is-error'}`;
            if (res.ok) {
              showToast(res.message);
              renderCurrentView();
              setTimeout(() => { if (walletDialog.open) walletDialog.close(); }, 650);
            }
          },
        },
      },
        el('span', {}, el('strong', {}, meta.name), el('small', {}, meta.kind)),
        el('span', { class: `ct-tag-chip ${meta.hardware ? 'is-green' : ''}` }, meta.badge),
      ),
    ));

    walletDialog.replaceChildren(
      el('div', { class: 'ct-dialog-head' },
        el('h3', { id: 'ct-wallet-dlg-title' }, 'Wallet-Native Connect · Robinhood Chain 4663'),
        el('button', { type: 'button', class: 'ct-btn ct-btn-sm ct-btn-ghost', on: { click: () => walletDialog.close() } }, 'Close'),
      ),
      el('div', { class: 'ct-dialog-body' },
        el('div', { class: 'ct-wallet-stance-box' },
          el('strong', {}, 'External & Hardware Wallets First (Pump.fun Nov 30 Positioning)'),
          'Your keys stay on your Ledger, Trezor, Rabby, or MetaMask. Official team wallets are cryptographically labeled to eliminate fake "@baoskee bought" bait. Interactive actions on this prototype use play ETH so zero real funds are ever spent.',
        ),
        extList,
        el('button', {
          type: 'button',
          class: 'ct-btn ct-btn-primary',
          on: {
            click: () => {
              const res = wallet.connectSimulator();
              showToast(res.message);
              renderCurrentView();
              walletDialog.close();
            },
          },
        }, `Instant Interactive Tank Simulator (${w.playBalanceEth.toFixed(2)} play ETH)`),
        el('details', {},
          el('summary', { class: 'ct-side-label' }, 'Secondary Embedded Options (Passkey / Google — Optional)'),
          el('p', { class: 'ct-section-sub' }, 'Available for Robinhood retail onboarding (the 98% not yet onchain), while power traders & Sharks stay hardware-native.'),
        ),
        w.connected ? el('button', {
          type: 'button',
          class: 'ct-btn ct-btn-danger ct-btn-sm',
          on: { click: () => { wallet.disconnect(); showToast('Wallet disconnected.'); walletDialog.close(); } },
        }, 'Disconnect current wallet') : null,
        walletDialogMsg,
      ),
    );
    walletDialog.showModal();
  }

  // ---------- Coin / Pitch Dossier Dialog (Chart + Live AI DD + Trade + Comments) ----------
  const dossierDialog = el('dialog', { class: 'ct-dialog', 'aria-labelledby': 'ct-dossier-title' });
  dossierDialog.addEventListener('close', () => {
    state.dossierChart?.destroy();
    state.dossierChart = null;
  });

  async function openCoinDossier(item) {
    state.activeDossier = item;
    const ddInit = buildDueDiligenceReport(item, null);
    const chartBox = el('div', { class: 'ct-chart-host', 'aria-label': `${item.name} candlestick chart` });
    const ddHost = el('div', { class: 'ct-dd-stage-pane' });
    const commentKey = `coin:${(item.address || item.id || item.ticker).toLowerCase()}`;
    const defaultComments = [
      { id: 'dc1', author: 'AGI-1 DD', badge: 'AI DD CO-HOST', text: `Live audit active for $${item.ticker}. Dev history & bundle clustering monitored on Robinhood Chain 4663.`, likes: 14, at: 'live' },
      { id: 'dc2', author: '@TokyoWhale', badge: 'SHARK #1', text: 'Routing through Clank keeps fee splits transparent and verifiable on chain.', likes: 9, at: '6m ago' },
    ];
    const commentsBox = el('div', { class: 'ct-comment-list' });
    const commentInput = el('input', { class: 'ct-input', type: 'text', placeholder: `Post a comment on $${item.ticker}…`, maxlength: 260 });
    const tradeFeedback = el('p', { class: 'ct-feedback' });
    const tradeInput = el('input', { type: 'number', step: '0.05', min: '0.05', max: '5', value: '0.25', 'aria-label': 'Trade ETH amount' });

    function drawDd(dd) {
      ddHost.replaceChildren(
        el('div', { class: 'ct-dd-head' },
          el('img', { src: '/images/landing/agi1-face.webp', alt: '', class: 'ct-dd-avatar' }),
          el('div', { class: 'ct-dd-title' },
            el('strong', {}, 'AGI-1 AI DD Co-Host'),
            el('small', {}, dd.source === 'live-clankchecker' ? 'Live ClankChecker Scan · 4663' : 'On-Screen Telemetry Engine'),
          ),
          el('span', { class: `ct-dd-verdict is-${dd.verdictTone}` }, dd.verdict),
        ),
        el('div', { class: 'ct-dd-metrics' },
          el('div', { class: 'ct-dd-row' }, el('span', {}, 'Dev History'), el('b', {}, dd.devHistory)),
          el('div', { class: 'ct-dd-row' }, el('span', {}, 'Bundle / Sniper %'), el('b', {}, dd.bundlePct)),
          el('div', { class: 'ct-dd-row' }, el('span', {}, 'Wash Volume Risk'), el('b', {}, dd.washVolumePct)),
          el('div', { class: 'ct-dd-row' }, el('span', {}, 'Liquidity Lock'), el('b', {}, dd.lpLocked)),
          el('div', { class: 'ct-dd-row' }, el('span', {}, 'Labeled Team Check'), el('b', {}, dd.labeledTeam ? `${dd.labeledTeam.label} (${dd.labeledTeam.badge})` : 'No impersonation detected')),
        ),
        el('ul', { class: 'ct-dd-notes' }, ...dd.notes.map((n) => el('li', {}, n))),
      );
    }

    function drawComments() {
      const list = commentsFor(commentKey, defaultComments);
      commentsBox.replaceChildren(...list.map((c) =>
        el('div', { class: 'ct-comment' },
          el('div', { class: 'ct-comment-head' },
            el('span', { class: 'ct-comment-author' }, c.author, el('span', { class: 'ct-tag-chip' }, c.badge)),
            el('button', {
              type: 'button',
              class: 'ct-like-btn',
              on: { click: () => { likeComment(commentKey, defaultComments, c.id); drawComments(); } },
            }, `▲ ${c.likes}`),
          ),
          el('p', {}, c.text),
        ),
      ));
    }

    drawDd(ddInit);
    drawComments();

    dossierDialog.replaceChildren(
      el('div', { class: 'ct-dialog-head' },
        el('div', {},
          el('h3', { id: 'ct-dossier-title' }, `${item.name} ($${item.ticker})`),
          el('small', { class: 'ct-mono' }, `${item.venue || 'Robinhood Chain 4663'} · ${shortAddress(item.address || '')}`),
        ),
        el('div', { class: 'ct-flash-actions' },
          el('button', {
            type: 'button',
            class: 'ct-btn ct-btn-primary ct-btn-sm',
            on: {
              click: () => {
                dossierDialog.close();
                pullLiveCoinToTank(item);
              },
            },
          }, 'Bring to Live AI Shark Desk'),
          el('button', { type: 'button', class: 'ct-btn ct-btn-sm ct-btn-ghost', on: { click: () => dossierDialog.close() } }, 'Close'),
        ),
      ),
      el('div', { class: 'ct-dialog-body' },
        item.xProof ? renderPrivateXBadges(item.xProof) : null,
        el('div', { class: 'ct-dossier-grid' },
          el('div', { class: 'ct-stage-col' },
            chartBox,
            el('div', { class: 'ct-comments-card' },
              el('div', { class: 'ct-section-head' }, el('h2', {}, 'Community Comments & Pitch Notes')),
              el('form', {
                class: 'ct-grill-form',
                on: {
                  submit: (e) => {
                    e.preventDefault();
                    if (addComment(commentKey, defaultComments, commentInput.value)) {
                      commentInput.value = '';
                      drawComments();
                      showToast('Comment posted to pitch thread.');
                    }
                  },
                },
              }, commentInput, el('button', { type: 'submit', class: 'ct-btn ct-btn-primary ct-btn-sm' }, 'Post')),
              commentsBox,
            ),
          ),
          el('div', { class: 'ct-deal-col' },
            el('div', { class: 'ct-deal-card' },
              el('div', { class: 'ct-deal-header' },
                el('h4', { class: 'ct-deal-title' }, 'Route Trade via Clank'),
                el('span', { class: 'ct-tag-chip is-cyan' }, '0.35% ROUTER FEE'),
              ),
              el('div', { class: 'ct-clearing-hero' },
                el('div', { class: 'ct-metric-box' }, el('span', {}, 'Market Cap'), el('strong', { class: 'ct-mono' }, moneyCompact(item.marketCapUsd))),
                el('div', { class: 'ct-metric-box' }, el('span', {}, '24h Delta'), el('strong', { class: `ct-mono ${(item.change24h || 0) >= 0 ? 'is-up' : 'is-down'}` }, `${(item.change24h || 0) >= 0 ? '+' : ''}${(item.change24h || 0).toFixed(2)}%`)),
              ),
              el('div', { class: 'ct-amount-row' }, tradeInput, el('span', { class: 'ct-amount-unit' }, 'ETH (Play)')),
              el('div', { class: 'ct-settle-row' },
                el('button', {
                  type: 'button',
                  class: 'ct-btn ct-btn-deal',
                  on: {
                    click: () => {
                      const amt = Number(tradeInput.value);
                      const res = wallet.spendPlayEth(amt, { side: 'buy', ticker: item.ticker, venue: item.venue });
                      tradeFeedback.textContent = res.ok
                        ? `Routed ${amt} play ETH buy on $${item.ticker} via Clank Universal Router (0.35% fee logged).`
                        : res.error;
                      tradeFeedback.className = `ct-feedback ${res.ok ? 'is-good' : 'is-error'}`;
                      if (res.ok) showToast(`Simulated buy filled: ${amt} ETH -> $${item.ticker}`);
                    },
                  },
                }, 'Route Buy'),
                el('button', {
                  type: 'button',
                  class: 'ct-btn ct-btn-danger',
                  on: {
                    click: () => {
                      const amt = Number(tradeInput.value) || 0.25;
                      wallet.refundPlayEth(amt);
                      tradeFeedback.textContent = `Simulated sell routed: +${amt} play ETH returned to simulator wallet.`;
                      tradeFeedback.className = 'ct-feedback is-good';
                    },
                  },
                }, 'Route Sell'),
              ),
              tradeFeedback,
            ),
            ddHost,
          ),
        ),
      ),
    );

    dossierDialog.showModal();
    state.dossierChart?.destroy();
    state.dossierChart = createTankChart(chartBox);
    state.dossierChart.setCandles(generateSyntheticCandles(item.marketCapUsd || 42000, 72));

    // Hydrate real live candles + live ClankChecker DD scan when coin is an on-chain Robinhood address
    if (item.address && /^0x[0-9a-f]{40}$/i.test(item.address) && item.isLiveClank) {
      const addr = item.address.toLowerCase();
      Promise.allSettled([
        fetch(`/api/checker?terminal=clank&a=${addr}&interval=5m`, { credentials: 'omit' }).then((r) => (r.ok ? r.json() : null)),
        fetch(`/api/checker?a=${addr}`, { credentials: 'omit' }).then((r) => (r.ok ? r.json() : null)),
      ]).then(([detailRes, scanRes]) => {
        if (!dossierDialog.open) return;
        if (detailRes.status === 'fulfilled' && detailRes.value?.candles?.length >= 5) {
          state.dossierChart?.setCandles(detailRes.value.candles);
        }
        if (scanRes.status === 'fulfilled' && scanRes.value && !scanRes.value.error) {
          drawDd(buildDueDiligenceReport(item, scanRes.value));
        }
      });
    }
  }

  // ---------- Pull ANY Live Coin onto the AI Shark Desk ----------
  async function pullLiveCoinToTank(coin) {
    const id = `room-live-${coin.address || coin.ticker}`;
    let existing = state.rooms.find((r) => r.id === id);
    if (!existing) {
      const dd = buildDueDiligenceReport(coin, null);
      existing = {
        id,
        mode: 'AI_SHARK_DESK',
        stageType: 'pitcher-card',
        title: `${coin.name} ($${coin.ticker}) · Live AI Shark Review`,
        ticker: coin.ticker,
        subtitle: `Pulled live from Robinhood Chain 4663 · Paired with ${coin.quoteAsset || coin.pairSymbol || 'ETH'}`,
        venue: coin.venue || 'Live Clank Coin',
        venueBadge: 'AI LIVE AUDIT',
        pairSymbol: coin.quoteAsset || coin.pairSymbol || 'ETH',
        address: coin.address,
        avatar: coin.image && coin.isLiveClank
          ? `/api/checker?terminal=clank&image=${coin.address}`
          : (coin.image || '/images/clanktrade/shark-degen.png'),
        pitcherName: `AI Shark Desk · Reviewing $${coin.ticker}`,
        pitcherAlias: coin.creatorUsername ? `@${coin.creatorUsername}` : shortAddress(coin.creator || coin.address),
        pitcherTrackRecord: `Live MC ${moneyCompact(coin.marketCapUsd)} · ${coin.holders || 0} holders`,
        creatorWallet: coin.creator || '',
        viewers: 740 + (coin.holders || 40) % 450,
        minRaiseEth: 15.0,
        hardCapEth: 35.0,
        committedEth: 11.4,
        contributors: 88,
        userCommittedEth: 0,
        timeLeftSec: 600,
        saleSupply: 600_000_000,
        totalSupply: 1_000_000_000,
        xProof: coin.xProof || createPrivateXProof({ tier: '100K+ followers', notableFollowers: ['@baoskee'] }),
        terms: {
          creatorAllocPct: 1.5,
          lockPeriod: coin.phase === 'pool' ? 'Graduated · Locked Uniswap V4 LP' : 'Bonding Curve -> V4 Lock',
          publicCapPct: 0.5,
          sharkCapPct: 2.0,
          feeMode: '1% curve / 0.3% V4 · Programmable split ready',
        },
        feeSplits: { ...DEFAULT_FEE_SPLITS },
        dd,
        recentCommits: [
          { id: `lc-${Date.now()}`, who: 'AGI-1 DD [AI DD]', amountEth: 0.6, isShark: true, at: Date.now() },
        ],
        script: buildDynamicSceneForCoin(coin, dd),
        comments: [],
      };
      state.rooms.unshift(existing);
    }
    state.activeRoomId = existing.id;
    state.scriptCursor = 0;
    switchView('tank');
    showToast(`Pulled $${coin.ticker} live onto the 4-Shark AI Desk!`);

    if (coin.address && /^0x[0-9a-f]{40}$/i.test(coin.address) && coin.isLiveClank) {
      try {
        const res = await fetch(`/api/checker?a=${coin.address.toLowerCase()}`, { credentials: 'omit' });
        if (res.ok) {
          const scan = await res.json();
          if (scan && !scan.error) {
            existing.dd = buildDueDiligenceReport(coin, scan);
            existing.script = buildDynamicSceneForCoin(coin, existing.dd);
            if (state.view === 'tank' && state.activeRoomId === existing.id) renderCurrentView();
          }
        }
      } catch { /* keep baseline DD */ }
    }
  }

  // ---------- View 1: LIVE TANK (THE MAIN MECHANISM) ----------
  function renderLiveTankView() {
    const room = currentRoom();
    const clearing = computeDealClearing(room, state.ethUsd);
    const dd = buildDueDiligenceReport(room, null);
    const activeLine = room.script[state.scriptCursor % room.script.length] || room.script[0];
    const flash = SHARK_FLASH_EVENTS[state.flashIndex % SHARK_FLASH_EVENTS.length];

    // Destroy old WebGL/chart cleanly before rebuilding DOM
    state.vrmInstance?.destroy();
    state.vrmInstance = null;
    state.stageChart?.destroy();
    state.stageChart = null;

    // 1. Compact Broadcast Header
    const headStrip = el('div', { class: 'ct-broadcast-head' },
      el('div', { class: 'ct-broadcast-title-group' },
        el('span', { class: 'ct-onair-badge' }, '● ON AIR'),
        el('h1', { class: 'ct-broadcast-h1' }, 'The ', el('em', {}, 'Shark Tank'), ' of Crypto · Robinhood Chain'),
      ),
      el('div', { class: 'ct-broadcast-stats' },
        el('span', { class: 'ct-stat-pill' }, 'Live Viewers ', el('b', { class: 'ct-mono' }, room.viewers.toLocaleString())),
        el('span', { class: 'ct-stat-pill' }, 'Live Coins 4663 ', el('b', { class: 'ct-mono' }, state.liveCoins.length ? String(state.liveCoins.length) : 'Syncing')),
        el('span', { class: 'ct-stat-pill' }, 'AI Shark Public P&L ', el('b', { class: 'ct-mono is-up' }, '+$166,645')),
      ),
    );

    // 2. Creator Credential Card (Privacy-Preserving zk-X Proof matching user screenshot!)
    const credCard = el('section', { class: 'ct-cred-card', 'aria-label': 'Creator credentials and privacy-preserving X proof' },
      el('img', { src: room.avatar, alt: '', class: 'ct-cred-avatar' }),
      el('div', { class: 'ct-cred-main' },
        el('div', { class: 'ct-cred-top' },
          el('span', { class: 'ct-cred-ticker' }, room.ticker),
          el('span', { class: 'ct-cred-name' }, room.title),
          el('span', { class: `ct-cred-dev-pill ${dd.labeledTeam ? 'is-team' : ''}` },
            dd.labeledTeam ? `✓ ${dd.labeledTeam.label} · ${dd.labeledTeam.badge}` : room.pitcherAlias,
          ),
          el('span', { class: 'ct-tag-chip is-gold' }, room.pitcherTrackRecord),
        ),
        renderPrivateXBadges(room.xProof),
      ),
      el('button', {
        type: 'button',
        class: 'ct-btn ct-btn-sm ct-btn-ghost',
        on: {
          click: () => {
            room.xProof = createPrivateXProof({
              handle: room.pitcherAlias.replace(/^@/, ''),
              tier: room.xProof.tier,
              notableFollowers: room.xProof.notableFollowers,
              revealHandle: !room.xProof.handleVisible,
            });
            renderCurrentView();
            showToast(room.xProof.handleVisible ? 'Creator opted-in to reveal X handle.' : 'Creator X handle hidden again — follower tier & notable followers still proven.');
          },
        },
      }, room.xProof.handleVisible ? 'Hide Handle (zk-X)' : 'Preview Opt-In Reveal'),
    );

    // 3. Widescreen Broadcast Stage (Avatar / AI Desk / Chart + Live DD Co-Host)
    const avatarPane = el('div', { class: 'ct-avatar-pane' });
    if (state.stageCam === 'chart') {
      const stageChartBox = el('div', { class: 'ct-chart-host' });
      avatarPane.append(stageChartBox);
      requestAnimationFrame(() => {
        if (!stageChartBox.isConnected) return;
        state.stageChart = createTankChart(stageChartBox);
        state.stageChart.setCandles(generateSyntheticCandles(clearing.clearingMcapUsd || 62000, 64));
      });
    } else if (state.stageCam === 'pitcher' && room.stageType === 'vrm-vladcat') {
      const vrmHost = el('div', { class: 'ct-vrm-host', role: 'img', 'aria-label': '3D Vladcat pitcher avatar live on stage' });
      avatarPane.append(vrmHost);
      mountTankAvatarStage(vrmHost).then((inst) => {
        if (vrmHost.isConnected) state.vrmInstance = inst;
        else inst.destroy();
      });
    } else {
      const imgSrc = state.stageCam === 'desk' ? '/images/clanktrade/shark-kuro.png' : room.avatar;
      avatarPane.append(el('img', { src: imgSrc, alt: room.pitcherName, class: 'ct-stage-portrait' }));
    }

    if (state.stageCam !== 'chart') {
      avatarPane.append(
        el('div', { class: 'ct-avatar-hud' },
          el('div', { class: 'ct-pitcher-line' },
            el('span', { class: 'ct-pitcher-tag' },
              el('span', { class: 'ct-eq', 'aria-hidden': 'true' }, el('i'), el('i'), el('i'), el('i')),
              `${room.pitcherName} · Local cam`,
            ),
          ),
          el('div', { class: 'ct-caption-box', 'aria-live': 'polite' },
            el('div', { class: 'ct-caption-speaker' },
              el('span', {}, `${activeLine.speaker} · ${activeLine.role}`),
              el('span', { class: 'ct-mono' }, `clank.world scene ${(state.scriptCursor % room.script.length) + 1}/${room.script.length}`),
            ),
            el('p', { class: 'ct-caption-text' }, activeLine.line),
          ),
        ),
      );
    }

    const ddPane = el('div', { class: 'ct-dd-stage-pane', 'aria-label': 'Live AI Due-Diligence Co-Host' },
      el('div', { class: 'ct-dd-head' },
        el('img', { src: '/images/landing/agi1-face.webp', alt: '', class: 'ct-dd-avatar' }),
        el('div', { class: 'ct-dd-title' },
          el('strong', {}, 'AI Due-Diligence Co-Host'),
          el('small', {}, 'Live On-Screen Audit · Anti-Bait'),
        ),
        el('span', { class: `ct-dd-verdict is-${dd.verdictTone}` }, dd.verdict),
      ),
      el('div', { class: 'ct-dd-metrics' },
        el('div', { class: 'ct-dd-row' }, el('span', {}, 'Dev History'), el('b', {}, dd.devHistory)),
        el('div', { class: 'ct-dd-row' }, el('span', {}, 'Sniper / Bundles'), el('b', {}, dd.bundlePct)),
        el('div', { class: 'ct-dd-row' }, el('span', {}, 'Wash Volume'), el('b', {}, dd.washVolumePct)),
        el('div', { class: 'ct-dd-row' }, el('span', {}, 'LP Lock'), el('b', {}, dd.lpLocked)),
        el('div', { class: 'ct-dd-row' }, el('span', {}, 'Official Labels'), el('b', {}, dd.labeledTeam ? `${dd.labeledTeam.label} ✓` : 'Anti-Fake-Bait On')),
      ),
      el('ul', { class: 'ct-dd-notes' }, ...dd.notes.map((n) => el('li', {}, n))),
    );

    // Sharks Buy on Stream Flash Banner + Capped One-Tap Follow
    const flashBanner = el('div', { class: `ct-shark-flash ${state.flashPop ? 'is-pop' : ''}` },
      el('div', { class: 'ct-flash-left' },
        el('span', { class: 'ct-flash-kicker' }, '🦈 SHARK BUY FLASH'),
        el('span', { class: 'ct-flash-copy' },
          `${flash.shark} `,
          el('span', { class: 'ct-tag-chip is-green' }, flash.verifiedLabel),
          ` ${flash.action} `,
          el('b', { class: 'ct-mono' }, `${flash.amountEth} ETH`),
          ` on $${flash.ticker}`,
        ),
        el('span', { class: 'ct-flash-record ct-mono' }, `${flash.rank} · ${flash.record}`),
      ),
      el('div', { class: 'ct-flash-actions' },
        el('button', {
          type: 'button',
          class: 'ct-btn ct-btn-deal ct-btn-sm',
          on: {
            click: () => {
              const capEth = flash.followCapEth;
              const spend = wallet.spendPlayEth(capEth, { side: 'buy', ticker: room.ticker, followed: flash.shark });
              if (!spend.ok) {
                showToast(spend.error);
                return;
              }
              const res = commitToDeal(room, capEth, { isRankedShark: false, walletLabel: `Follow ${flash.shark} (You)` });
              if (res.ok) {
                const idx = state.rooms.findIndex((r) => r.id === room.id);
                state.rooms[idx] = res.deal;
                state.dealFeedback = `Capped One-Tap Follow filled: ${capEth} ETH following ${flash.shark} into uniform clearing!`;
                state.dealFeedbackTone = 'is-good';
                showToast(`Followed ${flash.shark} with capped ${capEth} ETH!`);
                renderSidebar();
                renderCurrentView();
              } else {
                wallet.refundPlayEth(capEth);
                showToast(res.error);
              }
            },
          },
        }, `One-Tap Follow (${flash.followCapEth} ETH Cap)`),
        el('button', {
          type: 'button',
          class: 'ct-btn ct-btn-sm ct-btn-ghost',
          on: {
            click: () => {
              state.flashIndex = (state.flashIndex + 1) % SHARK_FLASH_EVENTS.length;
              state.flashPop = true;
              renderCurrentView();
              setTimeout(() => { state.flashPop = false; }, 600);
            },
          },
        }, 'Next Flash ↻'),
      ),
    );

    const stageShell = el('section', { class: 'ct-stage-shell', 'aria-label': 'Live Shark Tank Broadcast Stage' },
      el('div', { class: 'ct-stage-topbar' },
        el('div', { class: 'ct-stage-cam-tabs' },
          ...[['pitcher', 'Avatar Podium (3D)'], ['desk', 'AI Shark Panel Cam'], ['chart', 'Live Clearing Chart']].map(([id, label]) =>
            el('button', {
              type: 'button',
              class: `ct-cam-btn ${state.stageCam === id ? 'is-active' : ''}`,
              on: { click: () => { state.stageCam = id; renderCurrentView(); } },
            }, label),
          ),
        ),
        el('div', { class: 'ct-flash-actions' },
          el('span', { class: 'ct-tag-chip is-cyan' }, `PAIRED: ${room.pairSymbol}`),
          el('button', {
            type: 'button',
            class: 'ct-btn ct-btn-sm',
            on: {
              click: () => {
                state.scriptCursor = (state.scriptCursor + 1) % room.script.length;
                renderCurrentView();
              },
            },
          }, 'Next Shark Line →'),
        ),
      ),
      el('div', { class: 'ct-stage-viewport' },
        el('div', { class: 'ct-stage-matrix', 'aria-hidden': 'true' },
          'CLANK TANK 4663 / UNIFORM CLEARING / ZERO SNIPER CLUSTERS / ROBINHOOD CHAIN / '.repeat(14),
        ),
        avatarPane,
        ddPane,
      ),
      flashBanner,
    );

    // 4. Always-On 4-Shark AI Panel (clank.world Multi-Character Engine + Fee-Funded Public P&L Wallets)
    const grillInput = el('input', {
      class: 'ct-input',
      type: 'text',
      placeholder: 'Grill the pitcher or ask the 4 AI Sharks (e.g. "Why no snipers?" or "What is the fee split?")…',
      maxlength: 200,
    });

    const sharkPanelBox = el('section', { class: 'ct-panel-box', 'aria-label': 'Always-on 4 AI Shark Panel' },
      el('div', { class: 'ct-section-head' },
        el('div', {},
          el('h2', {}, 'Always-On AI Shark Panel', el('span', { class: 'ct-tag-chip is-cyan' }, '4 SHARKS + NARRATOR')),
          el('p', { class: 'ct-section-sub' }, 'Powered by clank.world multi-character engine · Each AI Shark trades a real fee-funded wallet with public P&L (Neuro-sama retention wired to live trading).'),
        ),
        el('button', {
          type: 'button',
          class: 'ct-btn ct-btn-sm',
          on: {
            click: () => {
              const targetCoin = state.liveCoins[Math.floor(Math.random() * Math.max(1, state.liveCoins.length))];
              if (targetCoin) pullLiveCoinToTank(targetCoin);
              else {
                state.activeRoomId = 'room-ai-desk';
                renderSidebar();
                renderCurrentView();
              }
            },
          },
        }, 'Auto-Review Next Live Launch ↻'),
      ),
      el('div', { class: 'ct-sharks-grid' }, ...AI_SHARKS.map((s) => {
        const speaking = activeLine.speaker === s.name;
        return el('article', { class: `ct-shark-tile ${speaking ? 'is-speaking' : ''}` },
          el('div', { class: 'ct-shark-top' },
            el('img', { src: s.avatar, alt: s.name, class: 'ct-shark-img' }),
            el('div', { class: 'ct-shark-name' },
              el('strong', {}, s.name),
              el('small', {}, s.role),
            ),
          ),
          el('span', { class: `ct-tag-chip ${speaking ? 'is-green' : ''}` }, speaking ? '● SPEAKING NOW' : s.stance),
          el('div', { class: 'ct-shark-pnl' },
            el('span', {}, 'Public P&L'),
            el('b', { class: 'ct-mono' }, `+$${s.realizedPnlUsd.toLocaleString()} (+${s.roi30d}%)`),
          ),
          el('div', { class: 'ct-shark-wallet ct-mono' },
            el('span', {}, s.walletShort),
            el('span', {}, `${s.treasuryEth} ETH · ${s.winRate}% W`),
          ),
        );
      })),
      el('div', { class: 'ct-transcript-box' },
        el('div', { class: 'ct-transcript-list' }, ...room.script.map((line, i) =>
          el('div', { class: `ct-line ${i === (state.scriptCursor % room.script.length) ? 'is-current' : ''}` },
            el('b', {}, `${line.speaker}:`),
            line.line,
          ),
        )),
        el('form', {
          class: 'ct-grill-form',
          on: {
            submit: (e) => {
              e.preventDefault();
              const q = grillInput.value.trim();
              if (!q) return;
              const shark = AI_SHARKS[(room.script.length) % AI_SHARKS.length];
              room.script.push({ speaker: 'AUDIENCE', role: 'Live Question', line: q });
              room.script.push({
                speaker: shark.name,
                role: shark.role,
                line: `Direct answer on $${room.ticker}: uniform clearing holds at ${moneyCompact(clearing.clearingMcapUsd)} MC with ${room.terms.lockPeriod}. Fee router sends ${room.feeSplits.jackpotPot}% straight to holder jackpots — zero silent sniper bundles.`,
              });
              state.scriptCursor = room.script.length - 1;
              grillInput.value = '';
              renderCurrentView();
            },
          },
        }, grillInput, el('button', { type: 'submit', class: 'ct-btn ct-btn-primary ct-btn-sm' }, 'Ask Panel')),
      ),
    );

    // 5. Right Column: "Deal or No Deal" Uniform-Clearing Escrow Card (daos.fun logic!)
    const fillPct = Math.min(100, (clearing.totalCommittedEth / clearing.hardCapEth) * 100);
    const minMarkPct = Math.min(98, (clearing.minRaiseEth / clearing.hardCapEth) * 100);
    const fillBar = el('div', {
      class: `ct-escrow-fill ${clearing.status === 'NO_DEAL_REFUND' ? 'is-nodeal' : clearing.meetsMinimum ? 'is-deal' : ''}`,
    });
    fillBar.style.setProperty('--fill', `${fillPct.toFixed(1)}%`);
    const minMarker = el('div', { class: 'ct-escrow-marker', title: `Minimum Deal Threshold: ${clearing.minRaiseEth} ETH` });
    minMarker.style.setProperty('--min-mark', `${minMarkPct.toFixed(1)}%`);

    const commitInputEl = el('input', {
      type: 'number',
      step: '0.1',
      min: '0.05',
      max: '5',
      value: state.commitInput,
      'aria-label': 'Commit ETH to uniform clearing pitch',
      on: { input: () => { state.commitInput = commitInputEl.value; } },
    });

    const isSettled = clearing.status === 'DEAL_LOCKED' || clearing.status === 'NO_DEAL_REFUND';

    const dealCard = el('section', { class: 'ct-deal-card', 'aria-label': 'Deal or No Deal uniform clearing escrow' },
      el('div', { class: 'ct-deal-header' },
        el('div', {},
          el('h2', { class: 'ct-deal-title' }, 'Deal or No Deal · Pitch Escrow'),
          el('small', { class: 'ct-section-sub' }, 'Uniform clearing price · daos.fun refund guarantee'),
        ),
        el('span', { class: 'ct-timer-pill ct-mono' }, isSettled ? 'CLOSED' : `⏱ ${formatClock(room.timeLeftSec)}`),
      ),
      el('div', { class: 'ct-clearing-hero' },
        el('div', { class: 'ct-metric-box' },
          el('span', {}, 'Uniform Clearing MC'),
          el('strong', { class: 'ct-mono' }, moneyCompact(clearing.clearingMcapUsd)),
          el('small', {}, 'Same price for EVERY buyer'),
        ),
        el('div', { class: 'ct-metric-box' },
          el('span', {}, 'Escrowed ETH'),
          el('strong', { class: 'ct-mono' }, `${clearing.totalCommittedEth} ETH`),
          el('small', {}, `${room.contributors} wallets · 0 snipers`),
        ),
      ),
      el('div', { class: 'ct-escrow-meter' },
        el('div', { class: 'ct-escrow-labels' },
          el('span', {}, 'Min Deal: ', el('b', { class: 'ct-mono' }, `${clearing.minRaiseEth} ETH`)),
          el('span', {}, 'Hard Cap: ', el('b', { class: 'ct-mono' }, `${clearing.hardCapEth} ETH`)),
        ),
        el('div', { class: 'ct-escrow-track' }, fillBar, minMarker),
        el('div', { class: `ct-escrow-status ${clearing.status === 'NO_DEAL_REFUND' ? 'is-nodeal' : clearing.meetsMinimum ? 'is-deal' : ''}` },
          clearing.status === 'DEAL_LOCKED'
            ? `✓ DEAL LOCKED · Graduated uniformly at ${moneyCompact(clearing.clearingMcapUsd)} MC straight to locked Uniswap V4 LP.`
            : clearing.status === 'NO_DEAL_REFUND'
              ? `✕ NO DEAL · Missed ${clearing.minRaiseEth} ETH minimum -> 100% refunded to all ${room.contributors} contributors.`
              : clearing.meetsMinimum
                ? `✓ DEAL THRESHOLD MET (${clearing.totalCommittedEth}/${clearing.minRaiseEth} ETH) · Uniform clearing active until close!`
                : `${clearing.remainingToMinEth} ETH needed to reach DEAL — otherwise 100% auto-refunded.`,
        ),
      ),
      el('div', { class: 'ct-terms-box' },
        el('span', { class: 'ct-terms-head' }, 'Creator Terms Pinned On-Screen (Immutable)'),
        el('div', { class: 'ct-term-row' }, el('span', {}, 'Creator Allocation'), el('b', {}, `${room.terms.creatorAllocPct}%`)),
        el('div', { class: 'ct-term-row' }, el('span', {}, 'Vesting / LP Lock'), el('b', {}, room.terms.lockPeriod)),
        el('div', { class: 'ct-term-row' }, el('span', {}, 'Anti-Sniper Caps'), el('b', {}, `${room.terms.publicCapPct}% Public · ${room.terms.sharkCapPct}% Sharks`)),
        el('div', { class: 'ct-term-row' }, el('span', {}, 'Programmable Fees'), el('b', {}, room.terms.feeMode)),
      ),
      el('div', { class: 'ct-commit-box' },
        el('div', { class: 'ct-amount-row' }, commitInputEl, el('span', { class: 'ct-amount-unit' }, 'ETH (Play)')),
        el('div', { class: 'ct-quick-chips' }, ...[0.25, 0.5, 1.0, 2.0].map((v) =>
          el('button', {
            type: 'button',
            class: 'ct-chip-btn ct-mono',
            on: { click: () => { state.commitInput = String(v); commitInputEl.value = String(v); } },
          }, `${v} ETH`),
        )),
        el('button', {
          type: 'button',
          class: 'ct-btn ct-btn-primary',
          disabled: isSettled,
          on: {
            click: () => {
              const amt = Number(commitInputEl.value);
              const spend = wallet.spendPlayEth(amt, { side: 'commit', ticker: room.ticker });
              if (!spend.ok) {
                state.dealFeedback = spend.error;
                state.dealFeedbackTone = 'is-error';
                renderCurrentView();
                return;
              }
              const res = commitToDeal(room, amt, { isRankedShark: wallet.get().isRankedShark, walletLabel: `You (${wallet.get().short})` });
              if (!res.ok) {
                wallet.refundPlayEth(amt);
                state.dealFeedback = res.error;
                state.dealFeedbackTone = 'is-error';
              } else {
                const idx = state.rooms.findIndex((r) => r.id === room.id);
                state.rooms[idx] = res.deal;
                state.dealFeedback = `Committed ${res.appliedEth} ETH! Projected clearing: ${moneyCompact(res.clearing.clearingMcapUsd)} MC (${res.clearing.meetsMinimum ? 'DEAL READY!' : `${res.clearing.remainingToMinEth} ETH to min`}).`;
                state.dealFeedbackTone = 'is-good';
                showToast(`Escrowed ${res.appliedEth} ETH into $${room.ticker} clearing round.`);
              }
              renderSidebar();
              renderCurrentView();
            },
          },
        }, isSettled ? 'Pitch Round Closed' : `Commit ETH to Uniform Clearing${room.userCommittedEth ? ` (Yours: ${room.userCommittedEth} ETH)` : ''}`),
        el('div', { class: 'ct-settle-row' },
          el('button', {
            type: 'button',
            class: 'ct-btn ct-btn-sm ct-btn-deal',
            disabled: isSettled,
            on: {
              click: () => {
                const settled = settleDeal(room, state.ethUsd);
                const idx = state.rooms.findIndex((r) => r.id === room.id);
                state.rooms[idx] = settled.deal;
                if (settled.refundEth > 0) wallet.refundPlayEth(settled.refundEth);
                state.dealFeedback = settled.summary;
                state.dealFeedbackTone = settled.outcome === 'DEAL' ? 'is-good' : 'is-error';
                showToast(settled.summary);
                renderSidebar();
                renderCurrentView();
              },
            },
          }, clearing.meetsMinimum ? 'Close & Lock DEAL ✓' : 'Test Close -> NO DEAL Refund'),
          el('button', {
            type: 'button',
            class: 'ct-btn ct-btn-sm ct-btn-ghost',
            on: {
              click: () => {
                const fresh = INITIAL_LIVE_ROOMS.find((r) => r.id === room.id);
                if (fresh) {
                  const idx = state.rooms.findIndex((r) => r.id === room.id);
                  state.rooms[idx] = { ...fresh, recentCommits: [...fresh.recentCommits], script: [...fresh.script], comments: [...fresh.comments] };
                  state.dealFeedback = 'Pitch escrow reset to live funding state.';
                  state.dealFeedbackTone = '';
                  renderSidebar();
                  renderCurrentView();
                }
              },
            },
          }, 'Reset Demo Round'),
        ),
        el('p', { class: `ct-feedback ${state.dealFeedbackTone}` }, state.dealFeedback),
      ),
      el('div', { class: 'ct-recent-commits' }, ...room.recentCommits.slice(0, 5).map((c) =>
        el('div', { class: `ct-commit-row ${c.isShark ? 'is-shark' : ''}` },
          el('span', {}, c.who),
          el('b', { class: 'ct-mono is-up' }, `+${c.amountEth} ETH`),
        ),
      )),
    );

    // 6. Live Pitch Comments Card
    const roomCommentKey = `room:${room.id}`;
    const liveComments = commentsFor(roomCommentKey, room.comments);
    const roomCommentInput = el('input', { class: 'ct-input', type: 'text', placeholder: 'Drop pitch feedback or DD notes…', maxlength: 260 });
    const commentsCard = el('section', { class: 'ct-comments-card', 'aria-label': 'Viewer comments' },
      el('div', { class: 'ct-section-head' },
        el('h2', {}, `Live Pitch Comments (${liveComments.length})`),
      ),
      el('form', {
        class: 'ct-grill-form',
        on: {
          submit: (e) => {
            e.preventDefault();
            if (addComment(roomCommentKey, room.comments, roomCommentInput.value)) {
              roomCommentInput.value = '';
              renderCurrentView();
              showToast('Comment added to live pitch.');
            }
          },
        },
      }, roomCommentInput, el('button', { type: 'submit', class: 'ct-btn ct-btn-primary ct-btn-sm' }, 'Post')),
      el('div', { class: 'ct-comment-list' }, ...liveComments.map((c) =>
        el('div', { class: 'ct-comment' },
          el('div', { class: 'ct-comment-head' },
            el('span', { class: 'ct-comment-author' }, c.author, el('span', { class: 'ct-tag-chip' }, c.badge)),
            el('button', {
              type: 'button',
              class: 'ct-like-btn',
              on: { click: () => { likeComment(roomCommentKey, room.comments, c.id); renderCurrentView(); } },
            }, `▲ ${c.likes}`),
          ),
          el('p', {}, c.text),
        ),
      )),
    );

    mainEl.replaceChildren(
      headStrip,
      el('div', { class: 'ct-tank-grid' },
        el('div', { class: 'ct-stage-col' }, credCard, stageShell, sharkPanelBox),
        el('div', { class: 'ct-deal-col' }, dealCard, commentsCard),
      ),
      renderFooter(),
    );
  }

  // ---------- View 2: PITCH ANYTHING (Anti-Niche Live Clank + Pons + Stocks + Perps + Outcomes) ----------
  function renderPitchAnythingView() {
    const stocksRail = el('div', { class: 'ct-stocks-rail', 'aria-label': 'Robinhood tokenized stock pairs' },
      ...state.liveStocks.map((st) =>
        el('button', {
          type: 'button',
          class: `ct-stock-card ${state.invPair === st.symbol ? 'is-active' : ''}`,
          on: {
            click: () => {
              state.invPair = state.invPair === st.symbol ? 'all' : st.symbol;
              renderCurrentView();
            },
          },
        },
          el('img', { src: st.icon || `/games/trenchingsimulator/clank/stocks/${st.symbol}.webp`, alt: '', class: 'ct-stock-icon' }),
          el('span', { class: 'ct-stock-info' },
            el('strong', {}, st.symbol),
            el('small', { class: 'ct-mono' }, `${moneyCompact(st.marketCapUsd)} MC`),
          ),
          el('span', { class: `ct-stock-delta ct-mono ${(st.change24h || 0) >= 0 ? 'is-up' : 'is-down'}` },
            `${(st.change24h || 0) >= 0 ? '▲' : '▼'} ${Math.abs(st.change24h || 0).toFixed(2)}%`,
          ),
        ),
      ),
    );

    const liveMapped = state.liveCoins.map((c) => ({
      id: `live-${c.address}`,
      category: 'clank',
      venue: 'Clank Live · Robinhood 4663',
      name: c.name,
      ticker: c.ticker,
      address: c.address,
      marketCapUsd: c.marketCapUsd,
      change24h: Number.isFinite(c.priceChange) ? c.priceChange * 100 : 0,
      holders: c.holderCount || 0,
      progress: Number.isFinite(c.progress) ? c.progress : 0,
      pairSymbol: c.quoteAsset || 'ETH',
      quoteAsset: c.quoteAsset || 'ETH',
      image: c.image ? `/api/checker?terminal=clank&image=${c.address}` : '',
      isLiveClank: true,
      creator: c.creator,
      creatorUsername: c.creatorUsername,
      phase: c.phase,
      pitcherPosition: 'Live 4663 Listing · Click to Audit',
      routingFeeBps: 35,
      xProof: createPrivateXProof({
        tier: (c.holderCount || 0) > 500 ? '1M+ followers' : (c.holderCount || 0) > 150 ? '100K+ followers' : '50K+ followers',
        notableFollowers: (c.holderCount || 0) > 500 ? ['@elonmusk', '@pmarca', '@baoskee'] : ['@baoskee'],
      }),
      ddBadge: c.phase === 'pool' ? '100% BONDED · V4 LOCK' : 'BONDING CURVE',
      ddTone: c.phase === 'pool' ? 'good' : 'warn',
    }));

    const combined = [...liveMapped, ...PITCH_ANYTHING_EXTRA];
    const q = state.invQuery.trim().toLowerCase();
    const filtered = combined.filter((item) => {
      if (state.invCategory !== 'all' && item.category !== state.invCategory) return false;
      if (state.invPair !== 'all' && item.pairSymbol !== state.invPair) return false;
      if (q) {
        const hay = `${item.name} ${item.ticker} ${item.address || ''} ${item.venue}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const searchInput = el('input', {
      class: 'ct-input ct-search-box',
      type: 'search',
      placeholder: 'Search live Clank coins, Pons, SPCX, NVDA, address…',
      value: state.invQuery,
      on: { input: () => { state.invQuery = searchInput.value; renderCurrentView(); } },
    });

    const cats = [
      ['all', `All Inventory (${combined.length})`],
      ['clank', `Live Clank 4663 (${liveMapped.length})`],
      ['pons', 'Pons Coins'],
      ['stocks', 'Stock Tokens'],
      ['perps', 'Leveraged Perps'],
      ['outcomes', 'Outcomes'],
    ];

    const grid = el('div', { class: 'ct-inv-grid' }, ...filtered.slice(0, 36).map((item) => {
      const bar = el('span', { class: 'ct-prog-bar' }, el('i'));
      bar.firstChild.style.setProperty('--p', `${Math.round((item.progress || 0) * 100)}%`);
      return el('article', { class: 'ct-coin-card' },
        el('div', { class: 'ct-coin-top' },
          el('div', { class: 'ct-coin-art' },
            item.image ? el('img', { src: item.image, alt: '', loading: 'lazy' }) : item.ticker.slice(0, 2),
          ),
          el('div', { class: 'ct-coin-meta' },
            el('strong', {}, item.name),
            el('small', { class: 'ct-mono' }, `$${item.ticker} · ${item.venue}`),
            el('div', { class: 'ct-room-meta' },
              el('span', { class: `ct-tag-chip ${item.ddTone === 'good' ? 'is-green' : 'is-gold'}` }, item.ddBadge),
              item.pairSymbol && item.pairSymbol !== 'ETH' ? el('span', { class: 'ct-tag-chip is-cyan' }, `↔ ${item.pairSymbol}`) : null,
            ),
          ),
        ),
        renderPrivateXBadges(item.xProof, { compact: true }),
        el('div', { class: 'ct-dd-row' },
          el('span', {}, 'Verified Pitch Position'),
          el('b', {}, item.pitcherPosition),
        ),
        el('div', { class: 'ct-coin-nums' },
          el('strong', { class: 'ct-mono' }, `${moneyCompact(item.marketCapUsd)} MC`),
          el('span', { class: `ct-mono ${(item.change24h || 0) >= 0 ? 'is-up' : 'is-down'}` },
            `${(item.change24h || 0) >= 0 ? '▲' : '▼'} ${Math.abs(item.change24h || 0).toFixed(1)}%`,
          ),
        ),
        bar,
        el('div', { class: 'ct-coin-actions' },
          el('button', { type: 'button', class: 'ct-btn ct-btn-primary ct-btn-sm', on: { click: () => openCoinDossier(item) } }, 'Chart & Route'),
          el('button', { type: 'button', class: 'ct-btn ct-btn-sm', on: { click: () => pullLiveCoinToTank(item) } }, 'Pitch on Tank'),
        ),
      );
    }));

    mainEl.replaceChildren(
      el('div', { class: 'ct-broadcast-head' },
        el('div', {},
          el('h1', { class: 'ct-broadcast-h1' }, 'Pitch Anything · ', el('em', {}, 'Anti-Niche Inventory Router')),
          el('p', { class: 'ct-section-sub' }, 'Pitch ANY trade on chain — live Clank 4663 coins, Pons coins, Robinhood stock tokens, perps, or outcomes. Verified position on screen, routed through Clank for 0.35% fee.'),
        ),
        el('span', { class: 'ct-stat-pill' }, 'Live Feed ', el('b', { class: state.liveStatus === 'live' ? 'is-up' : '' }, state.liveStatus === 'live' ? 'CONNECTED 4663' : 'SYNCING / FALLBACK')),
      ),
      stocksRail,
      el('div', { class: 'ct-toolbar' },
        el('div', { class: 'ct-filter-pills' }, ...cats.map(([id, label]) =>
          el('button', {
            type: 'button',
            class: `ct-pill ${state.invCategory === id ? 'is-active' : ''}`,
            on: { click: () => { state.invCategory = id; renderCurrentView(); } },
          }, label),
        )),
        searchInput,
      ),
      filtered.length ? grid : el('p', { class: 'ct-section-sub' }, 'No assets match that filter. Clear search or pair filter to see full inventory.'),
      renderFooter(),
    );
  }

  // ---------- View 3: PITCH RECORDS & SHARK P&L LEADERBOARD ----------
  function renderRecordsView() {
    const sharks = filterAndSortSharks(SHARK_LEADERBOARD, {
      filter: state.sharkFilter,
      sort: state.sharkSort,
      query: state.sharkQuery,
    });
    const selectedShark = sharks.find((s) => s.id === state.selectedSharkId) || sharks[0] || SHARK_LEADERBOARD[0];
    const sharkSearch = el('input', {
      class: 'ct-input ct-search-box',
      type: 'search',
      placeholder: 'Search sharks, wallets, AI agents, team labels…',
      value: state.sharkQuery,
      on: { input: () => { state.sharkQuery = sharkSearch.value; renderCurrentView(); } },
    });
    const sortSelect = el('select', {
      class: 'ct-input',
      'aria-label': 'Sort traders',
      on: { change: () => { state.sharkSort = sortSelect.value; renderCurrentView(); } },
    },
      ...[['pnl', 'Sort: Realized P&L'], ['roi', 'Sort: 30D ROI'], ['winRate', 'Sort: Win Rate'], ['volume', 'Sort: Volume'], ['followers', 'Sort: Followers']]
        .map(([v, l]) => el('option', { value: v, selected: state.sharkSort === v }, l)),
    );

    const sharkCommentKey = `shark:${selectedShark.id}`;
    const defaultSharkComments = [
      { id: 'sc1', author: '@ShibuyaLP', badge: 'RABBY', text: `Consistent entries on uniform-clearing pitches. One-tap capped follow on ${selectedShark.name} has been my highest Sharpe play.`, likes: 16, at: '1h ago' },
    ];
    const sharkComments = commentsFor(sharkCommentKey, defaultSharkComments);
    const sharkCommentInput = el('input', { class: 'ct-input', type: 'text', placeholder: `Leave a public note on ${selectedShark.name}…`, maxlength: 240 });

    mainEl.replaceChildren(
      el('div', { class: 'ct-broadcast-head' },
        el('div', {},
          el('h1', { class: 'ct-broadcast-h1' }, 'Permanent ', el('em', {}, 'Pitch Records'), ' & Shark P&L Leaderboard'),
          el('p', { class: 'ct-section-sub' }, 'Every pitch leaves an immutable on-chain card (replay, terms, price since pitch). Every trader & AI shark builds a pseudonymous realized P&L record.'),
        ),
      ),
      el('div', { class: 'ct-records-grid' }, ...PITCH_RECORDS.map((rec) =>
        el('article', { class: `ct-record-card ${rec.outcome === 'DEAL' ? 'is-deal' : 'is-nodeal'}` },
          el('div', { class: 'ct-coin-top' },
            el('img', { src: rec.avatar, alt: '', class: 'ct-room-thumb' }),
            el('div', { class: 'ct-coin-meta' },
              el('strong', {}, `${rec.episode} · ${rec.tokenName} ($${rec.ticker})`),
              el('small', {}, `${rec.date} · Pitcher: ${rec.pitcher} · ${rec.pitcherRecord}`),
            ),
            el('span', { class: `ct-tag-chip ${rec.outcome === 'DEAL' ? 'is-green' : 'is-red'}` }, rec.outcome === 'DEAL' ? 'DEAL · V4' : 'NO DEAL · REFUNDED'),
          ),
          renderPrivateXBadges(rec.xProof, { compact: true }),
          el('div', { class: 'ct-clearing-hero' },
            el('div', { class: 'ct-metric-box' },
              el('span', {}, 'Raised / Min'),
              el('strong', { class: 'ct-mono' }, `${rec.raisedEth} / ${rec.minRaiseEth} ETH`),
              el('small', {}, rec.outcome === 'DEAL' ? `Cleared @ ${moneyCompact(rec.clearingMcapUsd)}` : '100% Auto-Refunded'),
            ),
            el('div', { class: 'ct-metric-box' },
              el('span', {}, 'Price Since Pitch'),
              el('strong', { class: `ct-mono ${rec.sincePitchPct > 0 ? 'is-up' : ''}` }, rec.outcome === 'DEAL' ? `+${rec.sincePitchPct}%` : 'PROTECTED'),
              el('small', {}, rec.outcome === 'DEAL' ? `Now ${moneyCompact(rec.currentMcapUsd)} MC` : 'Zero rugs escaped'),
            ),
          ),
          el('div', { class: 'ct-dd-row' }, el('span', {}, 'Pinned Terms'), el('b', {}, rec.terms)),
          el('p', { class: 'ct-section-sub' }, `Replay: ${rec.replayHighlight}`),
        ),
      )),
      el('div', { class: 'ct-toolbar' },
        el('div', { class: 'ct-filter-pills' }, ...[
          ['all', 'All Traders'],
          ['human', 'Human Sharks'],
          ['ai', 'AI Shark Wallets'],
          ['team', 'Labeled Team'],
          ['pitcher', 'Pitchers'],
        ].map(([id, label]) =>
          el('button', {
            type: 'button',
            class: `ct-pill ${state.sharkFilter === id ? 'is-active' : ''}`,
            on: { click: () => { state.sharkFilter = id; renderCurrentView(); } },
          }, label),
        )),
        el('div', { class: 'ct-flash-actions' }, sortSelect, sharkSearch),
      ),
      el('div', { class: 'ct-table-wrap' },
        el('table', { class: 'ct-table' },
          el('thead', {}, el('tr', {},
            el('th', {}, 'Rank'),
            el('th', {}, 'Shark / Trader (Pseudonymous)'),
            el('th', {}, 'Wallet Stance'),
            el('th', {}, 'Realized P&L'),
            el('th', {}, '30D ROI'),
            el('th', {}, 'Win Rate'),
            el('th', {}, 'Copy Vol'),
            el('th', {}, 'Action'),
          )),
          el('tbody', {}, ...sharks.map((s) =>
            el('tr', {},
              el('td', { class: 'ct-mono' }, `#${s.rank}`),
              el('td', {},
                el('div', { class: 'ct-trader-cell' },
                  el('img', { src: s.avatar, alt: '' }),
                  el('div', {},
                    el('strong', {}, s.name),
                    el('div', { class: 'ct-room-meta' }, ...s.badges.map((b) => el('span', { class: `ct-tag-chip ${b.includes('TEAM') || b.includes('AI') ? 'is-green' : ''}` }, b))),
                  ),
                ),
              ),
              el('td', { class: 'ct-mono' }, `${s.walletType} · ${s.address}`),
              el('td', { class: 'ct-mono is-up' }, `+$${s.realizedPnlUsd.toLocaleString()}`),
              el('td', { class: 'ct-mono is-up' }, `+${s.roi30d}%`),
              el('td', { class: 'ct-mono' }, `${s.winRate}%`),
              el('td', { class: 'ct-mono' }, moneyCompact(s.copyVolumeUsd)),
              el('td', {},
                el('button', {
                  type: 'button',
                  class: 'ct-btn ct-btn-sm ct-btn-primary',
                  on: { click: () => { state.selectedSharkId = s.id; renderCurrentView(); } },
                }, 'Inspect & Comments'),
              ),
            ),
          )),
        ),
      ),
      el('section', { class: 'ct-comments-card', 'aria-label': 'Selected Shark dossier and community comments' },
        el('div', { class: 'ct-section-head' },
          el('div', {},
            el('h2', {}, `${selectedShark.name} · Shark Record & Comments`),
            el('p', { class: 'ct-section-sub' }, selectedShark.bio),
          ),
          renderPrivateXBadges(selectedShark.xProof, { compact: true }),
        ),
        el('form', {
          class: 'ct-grill-form',
          on: {
            submit: (e) => {
              e.preventDefault();
              if (addComment(sharkCommentKey, defaultSharkComments, sharkCommentInput.value)) {
                sharkCommentInput.value = '';
                renderCurrentView();
                showToast(`Comment posted on ${selectedShark.name}'s Shark Record.`);
              }
            },
          },
        }, sharkCommentInput, el('button', { type: 'submit', class: 'ct-btn ct-btn-primary ct-btn-sm' }, 'Post Note')),
        el('div', { class: 'ct-comment-list' }, ...sharkComments.map((c) =>
          el('div', { class: 'ct-comment' },
            el('div', { class: 'ct-comment-head' },
              el('span', { class: 'ct-comment-author' }, c.author, el('span', { class: 'ct-tag-chip' }, c.badge)),
              el('button', {
                type: 'button',
                class: 'ct-like-btn',
                on: { click: () => { likeComment(sharkCommentKey, defaultSharkComments, c.id); renderCurrentView(); } },
              }, `▲ ${c.likes}`),
            ),
            el('p', {}, c.text),
          ),
        )),
      ),
      renderFooter(),
    );
  }

  // ---------- View 4: DEAL STUDIO (Deal or No Deal Launcher + Private X Proof + Programmable Fee Router) ----------
  function renderStudioView() {
    const f = state.studioForm;
    const feeCheck = validateFeeSplits(f.feeSplits);
    const previewXProof = createPrivateXProof({
      handle: f.xHandle,
      tier: f.xTier,
      notableFollowers: f.xNotable,
      revealHandle: f.revealHandle,
    });

    const splitKeys = [
      ['lpPool', 'LP Deepening Pool'],
      ['jackpotPot', 'Holder Jackpot Pot'],
      ['topHolders', 'Top Holders Dividend'],
      ['aiSharkTreasury', 'AI Shark Panel Fuel'],
      ['creator', 'Creator Reward'],
    ];

    const nameIn = el('input', { class: 'ct-input', type: 'text', value: f.name, maxlength: 48, on: { input: () => { f.name = nameIn.value; renderStudioPreviewOnly(); } } });
    const tickerIn = el('input', { class: 'ct-input', type: 'text', value: f.ticker, maxlength: 12, on: { input: () => { f.ticker = tickerIn.value.toUpperCase(); renderStudioPreviewOnly(); } } });
    const pairSel = el('select', { on: { change: () => { f.pairSymbol = pairSel.value; renderStudioPreviewOnly(); } } },
      el('option', { value: 'ETH', selected: f.pairSymbol === 'ETH' }, 'Ethereum (ETH)'),
      ...STOCK_PAIRS.map((s) => el('option', { value: s.symbol, selected: f.pairSymbol === s.symbol }, `${s.symbol} · ${s.name}`)),
    );
    const minIn = el('input', { class: 'ct-input', type: 'number', min: '5', max: '100', value: String(f.minRaiseEth), on: { input: () => { f.minRaiseEth = Number(minIn.value) || 10; renderStudioPreviewOnly(); } } });
    const capIn = el('input', { class: 'ct-input', type: 'number', min: '10', max: '250', value: String(f.hardCapEth), on: { input: () => { f.hardCapEth = Number(capIn.value) || 40; renderStudioPreviewOnly(); } } });
    const allocIn = el('input', { class: 'ct-input', type: 'number', min: '0', max: '5', step: '0.5', value: String(f.creatorAllocPct), on: { input: () => { f.creatorAllocPct = Number(allocIn.value) || 0; renderStudioPreviewOnly(); } } });
    const lockSel = el('select', { on: { change: () => { f.lockDays = Number(lockSel.value); renderStudioPreviewOnly(); } } },
      ...[30, 90, 180, 365].map((d) => el('option', { value: String(d), selected: f.lockDays === d }, `${d} days linear cliff`)),
    );
    const handleIn = el('input', { class: 'ct-input', type: 'text', value: f.xHandle, placeholder: 'Your real X handle (kept private by default)', on: { input: () => { f.xHandle = handleIn.value; renderStudioPreviewOnly(); } } });
    const tierSel = el('select', { on: { change: () => { f.xTier = tierSel.value; renderStudioPreviewOnly(); } } },
      ...FOLLOWER_TIERS.map((t) => el('option', { value: t, selected: f.xTier === t }, t)),
    );
    const revealCheck = el('input', {
      type: 'checkbox',
      checked: f.revealHandle,
      on: { change: () => { f.revealHandle = revealCheck.checked; renderStudioPreviewOnly(); } },
    });
    const hookArea = el('textarea', { rows: 2, maxlength: 220, value: f.pitchHook, on: { input: () => { f.pitchHook = hookArea.value; } } });

    const previewHost = el('div', { class: 'ct-deal-col' });
    const feeTotalBadge = el('span', { class: `ct-tag-chip ${feeCheck.ok ? 'is-green' : 'is-red'}` }, `Total: ${feeCheck.total}%`);

    function renderStudioPreviewOnly() {
      const proof = createPrivateXProof({
        handle: f.xHandle,
        tier: f.xTier,
        notableFollowers: f.xNotable,
        revealHandle: f.revealHandle,
      });
      const check = validateFeeSplits(f.feeSplits);
      feeTotalBadge.textContent = `Total: ${check.total}%`;
      feeTotalBadge.className = `ct-tag-chip ${check.ok ? 'is-green' : 'is-red'}`;
      const projectedMinMc = computeDealClearing({ committedEth: f.minRaiseEth, minRaiseEth: f.minRaiseEth, hardCapEth: f.hardCapEth }, state.ethUsd);

      previewHost.replaceChildren(
        el('div', { class: 'ct-form-card' },
          el('div', { class: 'ct-section-head' },
            el('h2', {}, 'Live On-Screen Pitch Card Preview'),
            el('span', { class: 'ct-tag-chip is-green' }, 'PRIVACY X CREDENTIALS'),
          ),
          el('div', { class: 'ct-cred-card' },
            el('img', { src: '/images/clanktrade/pitcher-founder.png', alt: '', class: 'ct-cred-avatar' }),
            el('div', { class: 'ct-cred-main' },
              el('div', { class: 'ct-cred-top' },
                el('span', { class: 'ct-cred-ticker' }, f.ticker || 'TOKEN'),
                el('span', { class: 'ct-cred-name' }, `${f.name || 'Untitled Pitch'} | ${proof.handleVisible ? proof.revealedHandle : 'Pseudonymous Avatar'}`),
              ),
              renderPrivateXBadges(proof),
            ),
          ),
          el('div', { class: 'ct-terms-box' },
            el('span', { class: 'ct-terms-head' }, 'Pinned Deal or No Deal Escrow Terms'),
            el('div', { class: 'ct-term-row' }, el('span', {}, 'Paired Asset'), el('b', {}, f.pairSymbol)),
            el('div', { class: 'ct-term-row' }, el('span', {}, 'Minimum Deal / Hard Cap'), el('b', { class: 'ct-mono' }, `${f.minRaiseEth} ETH / ${f.hardCapEth} ETH`)),
            el('div', { class: 'ct-term-row' }, el('span', {}, 'Clearing MC at Min Deal'), el('b', { class: 'ct-mono' }, moneyCompact(projectedMinMc.clearingMcapUsd))),
            el('div', { class: 'ct-term-row' }, el('span', {}, 'Creator Allocation & Lock'), el('b', {}, `${f.creatorAllocPct}% · ${f.lockDays}d linear cliff`)),
            el('div', { class: 'ct-term-row' }, el('span', {}, 'Miss Minimum Outcome'), el('b', { class: 'is-up' }, '100% Automatic Refund (NO DEAL)')),
          ),
          el('div', {},
            el('span', { class: 'ct-side-label' }, 'Provable Creator Fee Router Calldata'),
            el('pre', { class: 'ct-code-block' }, formatFeeRouterSnippet(f.ticker, f.feeSplits)),
          ),
        ),
      );
    }

    renderStudioPreviewOnly();

    const slidersBox = el('div', { class: 'ct-dd-metrics' }, ...splitKeys.map(([key, label]) => {
      const valText = el('b', { class: 'ct-mono' }, `${f.feeSplits[key]}%`);
      const range = el('input', {
        type: 'range',
        min: '0',
        max: '100',
        step: '5',
        value: String(f.feeSplits[key]),
        'aria-label': label,
        on: {
          input: () => {
            f.feeSplits[key] = Number(range.value);
            valText.textContent = `${f.feeSplits[key]}%`;
            renderStudioPreviewOnly();
          },
        },
      });
      return el('div', { class: 'ct-slider-row' }, el('span', {}, label), range, valText);
    }));

    const launchError = el('p', { class: 'ct-feedback is-error' });

    const studioFormEl = el('form', {
      class: 'ct-form-card',
      on: {
        submit: (e) => {
          e.preventDefault();
          const check = validateFeeSplits(f.feeSplits);
          if (!check.ok) {
            launchError.textContent = check.error;
            return;
          }
          if (!f.name.trim() || !f.ticker.trim()) {
            launchError.textContent = 'Enter a coin name and ticker to go live.';
            return;
          }
          const proof = createPrivateXProof({
            handle: f.xHandle,
            tier: f.xTier,
            notableFollowers: f.xNotable,
            revealHandle: f.revealHandle,
          });
          const newId = `room-custom-${Date.now()}`;
          const created = {
            id: newId,
            mode: 'DEAL_OR_NO_DEAL',
            stageType: 'vrm-vladcat',
            title: `${f.ticker.trim()} · ${f.name.trim()}`,
            ticker: f.ticker.trim().toUpperCase(),
            subtitle: `Custom Live Deal Pitch · Paired with ${f.pairSymbol}`,
            venue: 'Clank Tank Deal',
            venueBadge: 'DEAL OR NO DEAL',
            pairSymbol: f.pairSymbol,
            address: `0x${Date.now().toString(16).padEnd(40, '0').slice(0, 40)}`,
            avatar: '/images/clanktrade/pitcher-founder.png',
            pitcherName: 'Your Live Avatar Podium',
            pitcherAlias: proof.handleVisible ? proof.revealedHandle : 'Pseudonymous zk-X Founder',
            pitcherTrackRecord: 'Live Debut Pitch · 0 Snipers',
            creatorWallet: wallet.get().address,
            viewers: 312,
            minRaiseEth: f.minRaiseEth,
            hardCapEth: Math.max(f.minRaiseEth + 5, f.hardCapEth),
            committedEth: 2.5,
            contributors: 19,
            userCommittedEth: 0,
            timeLeftSec: 900,
            saleSupply: 600_000_000,
            totalSupply: 1_000_000_000,
            xProof: proof,
            terms: {
              creatorAllocPct: f.creatorAllocPct,
              lockPeriod: `${f.lockDays}d linear cliff · LP locked forever`,
              publicCapPct: 0.5,
              sharkCapPct: 2.0,
              feeMode: `${f.feeSplits.lpPool}% LP · ${f.feeSplits.jackpotPot}% Jackpot · ${f.feeSplits.topHolders}% Holders · ${f.feeSplits.aiSharkTreasury}% AI Sharks · ${f.feeSplits.creator}% Dev`,
            },
            feeSplits: { ...f.feeSplits },
            dd: {
              verdict: 'CLEAN DEAL',
              verdictTone: 'good',
              devHistory: 'Fresh Deal-or-No-Deal escrow · Zero pre-mint',
              bundlePct: '0.0% (Uniform Clearing)',
              washVolumePct: '0.0% (Pre-launch)',
              lpLocked: 'Auto-locked Uniswap V4 on Deal',
              notes: [
                `zk-X verified (${proof.tier}) without exposing creator handle`,
                `Creator fees programmed: ${f.feeSplits.jackpotPot}% holder jackpot + ${f.feeSplits.lpPool}% LP deepening`,
                `Refund guarantee active below ${f.minRaiseEth} ETH minimum`,
              ],
            },
            recentCommits: [
              { id: 'nc1', who: 'VALKYRIE-9 [AI SHARK]', amountEth: 1.5, isShark: true, at: Date.now() },
              { id: 'nc2', who: 'AGI-1 DD [AI DD]', amountEth: 1.0, isShark: true, at: Date.now() },
            ],
            script: [
              { speaker: 'NARRATOR', role: 'Broadcast Host', line: `NEW PITCH LIVE IN THE TANK: ${f.name.trim()} ($${f.ticker.trim().toUpperCase()}) paired with ${f.pairSymbol}. Minimum Deal threshold: ${f.minRaiseEth} ETH!` },
              { speaker: 'PITCHER', role: 'Your Avatar', line: f.pitchHook || `Launching $${f.ticker.trim().toUpperCase()} with uniform clearing and provable fee splits.` },
              { speaker: 'AGI-1 DD', role: 'AI DD Co-Host', line: `Verified zk-X proof (${proof.tier}) + ${f.creatorAllocPct}% dev allocation locked ${f.lockDays} days. 0% sniper bundles possible.` },
              { speaker: 'KURO-SAN', role: 'Tokyo VC Shark', line: `Programming ${f.feeSplits.jackpotPot}% of fees directly into a holder jackpot pot solves Day-7 retention. Show us the community conviction.` },
            ],
            comments: [],
          };
          state.rooms.unshift(created);
          state.activeRoomId = newId;
          state.scriptCursor = 0;
          state.dealFeedback = `Your pitch $${created.ticker} is LIVE on the Shark Tank stage!`;
          state.dealFeedbackTone = 'is-good';
          showToast(`Launched $${created.ticker} live onto the Clank Tank stage!`);
          renderSidebar();
          switchView('tank');
        },
      },
    },
      el('div', { class: 'ct-section-head' },
        el('h2', {}, '1. Deal or No Deal Pitch Config'),
        el('span', { class: 'ct-tag-chip is-cyan' }, 'FREE LAUNCH · 0 SNIPERS'),
      ),
      el('div', { class: 'ct-field-grid' },
        el('div', { class: 'ct-field' }, el('label', {}, 'Coin / Pitch Name'), nameIn),
        el('div', { class: 'ct-field' }, el('label', {}, 'Ticker'), tickerIn),
      ),
      el('div', { class: 'ct-field-grid' },
        el('div', { class: 'ct-field' }, el('label', {}, 'Paired Asset (Stocks or ETH)'), pairSel),
        el('div', { class: 'ct-field' }, el('label', {}, 'Creator Vesting Lock'), lockSel),
      ),
      el('div', { class: 'ct-field-grid' },
        el('div', { class: 'ct-field' }, el('label', {}, 'Min Raise ETH (Refund Floor)'), minIn),
        el('div', { class: 'ct-field' }, el('label', {}, 'Hard Cap ETH'), capIn),
      ),
      el('div', { class: 'ct-field' }, el('label', {}, 'Creator Allocation (%)'), allocIn),
      el('div', { class: 'ct-field' }, el('label', {}, 'Opening Pitch Thesis (Read Live on Stage)'), hookArea),

      el('div', { class: 'ct-section-head' },
        el('h2', {}, '2. Privacy-Preserving X Credentials'),
        el('span', { class: 'ct-tag-chip is-green' }, 'HANDLE HIDDEN BY DEFAULT'),
      ),
      el('div', { class: 'ct-field-grid' },
        el('div', { class: 'ct-field' }, el('label', {}, 'X Account Handle (Private zk-OAuth)'), handleIn),
        el('div', { class: 'ct-field' }, el('label', {}, 'Verified Follower Range'), tierSel),
      ),
      el('div', { class: 'ct-field' },
        el('label', {}, 'Celebrity / Notable Followers Proven On-Screen'),
        el('div', { class: 'ct-toggle-grid' }, ...NOTABLE_FOLLOWERS.map((n) => {
          const on = f.xNotable.includes(n.handle);
          return el('button', {
            type: 'button',
            class: `ct-toggle-chip ${on ? 'is-on' : ''}`,
            on: {
              click: () => {
                if (f.xNotable.includes(n.handle)) f.xNotable = f.xNotable.filter((h) => h !== n.handle);
                else if (f.xNotable.length < 4) f.xNotable = [...f.xNotable, n.handle];
                renderCurrentView();
              },
            },
          }, `followed by ${n.handle}`);
        })),
      ),
      el('label', { class: 'ct-dd-row' },
        el('span', {}, 'Optional: Publicly reveal my X handle (off keeps you pseudonymous)'),
        revealCheck,
      ),

      el('div', { class: 'ct-section-head' },
        el('h2', {}, '3. Programmable Creator Fee Distribution'),
        feeTotalBadge,
      ),
      slidersBox,
      launchError,
      el('button', { type: 'submit', class: 'ct-btn ct-btn-primary' }, 'Launch Live Deal Pitch Into Tank →'),
    );

    mainEl.replaceChildren(
      el('div', { class: 'ct-broadcast-head' },
        el('div', {},
          el('h1', { class: 'ct-broadcast-h1' }, 'Deal Studio · ', el('em', {}, 'Launch a Shark Tank Pitch')),
          el('p', { class: 'ct-section-sub' }, 'Configure uniform-clearing Deal or No Deal terms, prove X credibility without doxxing, and program provable creator fee splits across LP, jackpots, and holders.'),
        ),
      ),
      el('div', { class: 'ct-studio-grid' }, studioFormEl, previewHost),
      renderFooter(),
    );
  }

  // ---------- View 5: THESIS FOR @BAOSKEE & DEVELOPER.CLANK.TRADE V2 SDK ----------
  function renderThesisView() {
    const t = MARKET_THESIS_FOR_BAOSKEE;
    const contractRows = [
      ['Clank V2 Launch Factory', CLANK_CONTRACTS.factoryV2],
      ['Launch-and-Buy Forwarder', CLANK_CONTRACTS.launchForwarder],
      ['Uniswap V4 PoolManager', CLANK_CONTRACTS.v4PoolManager],
      ['Universal Router', CLANK_CONTRACTS.universalRouter],
      ['Permit2', CLANK_CONTRACTS.permit2],
      ['Robinhood WETH', CLANK_CONTRACTS.weth],
      ['V4 Quoter', CLANK_CONTRACTS.v4Quoter],
      ['V2-Beta Legacy ($AGI)', CLANK_CONTRACTS.legacyFactoryV2Beta],
    ];

    const sdkSnippet = `// Real @clanktrade/sdk (developer.clank.trade) + Clank Tank Deal Escrow Extension
import { createPublicClient, http } from "viem";
import { createClankClient } from "@clanktrade/sdk";

const publicClient = createPublicClient({ chain: robinhoodChain4663, transport: http() });
const clank = createClankClient({
  publicClient,
  chainId: ${CLANK_CONTRACTS.chainId},
  factory: "${CLANK_CONTRACTS.factoryV2}",
  // Launch fee: Free · Bonding curve: 1% (100 bps) · Uniswap V4: 0.3% (3000)
});

// 1. Existing V2 quote + buildBuy (works today on Robinhood Chain 4663)
const quote = await clank.quoteBuy({ token: "0xfa31d04462746aaa24bc7e5626403e09e4b106ec", amountIn: 10n ** 17n });
const tx = await clank.buildBuy({ quote, recipient: userWallet, slippageBps: 100 });

// 2. Clank Tank V2 Upgrade: Uniform-Clearing "Deal or No Deal" Pitch Escrow
const deal = await clank.createPitchDeal({
  minRaiseEth: 20n * 10n ** 18n,     // Miss min -> 100% auto refund (daos.fun logic)
  hardCapEth: 40n * 10n ** 18n,      // Uniform clearing price -> zero sniper clusters
  pairToken: "0x4a0E...5eEa",        // SPCX tokenized stock liquidity rail
  zkXCredentialHash: "zkX:0x8a2f...", // Proves 1M+ followers + @elonmusk without dox
  graduateDirectlyToV4: true,        // Locked full-range Uniswap V4 position on Deal
});`;

    mainEl.replaceChildren(
      el('section', { class: 'ct-thesis-hero' },
        el('div', { class: 'ct-room-meta' },
          el('span', { class: 'ct-tag-chip is-green' }, `PRODUCT BLUEPRINT FOR ${t.recipient}`),
          el('span', { class: 'ct-tag-chip is-cyan' }, 'INSPIRED BY SHARK TANK · CRYPTOKNIGHTSHQ · TOKYO PITCH NIGHTS'),
        ),
        el('h1', { class: 'ct-broadcast-h1' }, t.headline),
        el('p', { class: 'ct-caption-text' }, t.summary),
      ),
      el('div', { class: 'ct-section-head' }, el('h2', {}, 'State of the Market (Wide-Range Context)')),
      el('div', { class: 'ct-thesis-grid' }, ...t.marketState.map((m) =>
        el('article', { class: 'ct-thesis-card' },
          el('span', { class: 'ct-tag-chip is-gold' }, m.tag),
          el('h3', {}, m.title),
          el('p', {}, m.detail),
        ),
      )),
      el('div', { class: 'ct-section-head' }, el('h2', {}, '6 Core Product Upgrades Built Into This Prototype')),
      el('div', { class: 'ct-thesis-grid' }, ...t.pillars.map((p) =>
        el('article', { class: 'ct-thesis-card' },
          el('div', { class: 'ct-room-meta' },
            el('span', { class: 'ct-tag-chip is-cyan ct-mono' }, p.num),
            el('span', { class: 'ct-tag-chip is-green' }, p.badge),
          ),
          el('h3', {}, p.title),
          el('p', {}, p.body),
        ),
      )),
      el('section', { class: 'ct-panel-box' },
        el('div', { class: 'ct-section-head' },
          el('div', {},
            el('h2', {}, 'developer.clank.trade · Verified Robinhood Chain (4663) V2 Contracts & SDK'),
            el('p', { class: 'ct-section-sub' }, `Config ID ${CLANK_CONTRACTS.configId} · Launch Fee: ${CLANK_CONTRACTS.launchFee} · Curve Fee: 1% (${CLANK_CONTRACTS.curveFeeBps} bps) · Uniswap V4 Fee: 0.3% (${CLANK_CONTRACTS.v4FeeMillionths}) · Deploy Block ${CLANK_CONTRACTS.deployBlock}`),
          ),
          el('a', { class: 'ct-btn ct-btn-sm', href: 'https://developer.clank.trade', target: '_blank', rel: 'noopener noreferrer' }, 'developer.clank.trade ↗'),
        ),
        el('div', { class: 'ct-contracts-grid' }, ...contractRows.map(([label, addr]) =>
          el('div', { class: 'ct-contract-row' },
            el('div', {}, el('strong', {}, label), el('code', {}, shortAddress(addr))),
            el('button', {
              type: 'button',
              class: 'ct-btn ct-btn-sm ct-btn-ghost',
              on: {
                click: async () => {
                  try { await navigator.clipboard.writeText(addr); showToast(`Copied ${label}: ${addr}`); }
                  catch { showToast(`${label}: ${addr}`); }
                },
              },
            }, 'Copy'),
          ),
        )),
        el('pre', { class: 'ct-code-block' }, sdkSnippet),
      ),
      renderFooter(),
    );
  }

  function renderFooter() {
    return el('footer', { class: 'ct-footer' },
      el('span', {}, 'Clank Tank v2 Concept & Interactive Prototype on agi1.app/clanktrade — built for @baoskee & the Robinhood Chain ecosystem. Simulated deals/trades use play ETH; live token listings and risk scans come from public Robinhood Chain 4663 feeds. Entertainment & product prototype only; not financial advice.'),
      el('span', {},
        el('a', { href: 'https://clank.trade', target: '_blank', rel: 'noopener noreferrer' }, 'clank.trade ↗'),
        ' · ',
        el('a', { href: 'https://developer.clank.trade', target: '_blank', rel: 'noopener noreferrer' }, 'developer.clank.trade ↗'),
        ' · ',
        el('a', { href: '/' }, 'agi1.app'),
      ),
    );
  }

  function renderCurrentView() {
    for (const [id, btn] of navButtons) btn.classList.toggle('is-active', id === state.view);
    if (state.view === 'tank') renderLiveTankView();
    else if (state.view === 'pitch-anything') renderPitchAnythingView();
    else if (state.view === 'records') renderRecordsView();
    else if (state.view === 'studio') renderStudioView();
    else renderThesisView();
  }

  function switchView(next) {
    state.view = next;
    renderSidebar();
    renderCurrentView();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // ---------- Live Feed Poller (Real Robinhood Chain 4663 Coins + Stocks + Trades) ----------
  async function syncLiveClankFeed() {
    try {
      const res = await fetch('/api/checker?terminal=clank', { credentials: 'omit', headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('feed_down');
      const data = await res.json();
      if (data?.v === 1 && Array.isArray(data.coins)) {
        state.liveStatus = 'live';
        if (Number.isFinite(data.px?.eth) && data.px.eth > 0) state.ethUsd = data.px.eth;
        const ranks = new Map((data.trending || []).map((a, i) => [a, i]));
        state.liveCoins = [...data.coins].sort((a, b) => {
          const ra = ranks.has(a.address) ? ranks.get(a.address) : 9999;
          const rb = ranks.has(b.address) ? ranks.get(b.address) : 9999;
          return ra - rb || (b.marketCapUsd || 0) - (a.marketCapUsd || 0);
        });
        if (Array.isArray(data.stocks) && data.stocks.length) {
          const bySym = new Map(STOCK_PAIRS.map((s) => [s.symbol, s]));
          state.liveStocks = data.stocks.map((s) => ({
            ...(bySym.get(s.symbol) || { symbol: s.symbol, name: s.symbol, icon: `/games/trenchingsimulator/clank/stocks/${s.symbol}.webp` }),
            marketCapUsd: s.marketCapUsd || bySym.get(s.symbol)?.marketCapUsd || 0,
            change24h: Number.isFinite(s.change24h) ? s.change24h : (bySym.get(s.symbol)?.change24h || 0),
          }));
        }
        if (Array.isArray(data.recentTrades) && data.recentTrades.length) {
          state.recentTrades = data.recentTrades;
        }
        renderSidebar();
        renderTape();
        if (state.view === 'pitch-anything') renderCurrentView();
      }
    } catch {
      state.liveStatus = 'fallback';
    }
  }

  // ---------- Always-On Live Timers (Countdown + AI Scene Cycle + Shark Buy Flash) ----------
  const clockInterval = setInterval(() => {
    if (document.hidden) return;
    let changed = false;
    for (const r of state.rooms) {
      if (!r.settledStatus && r.timeLeftSec > 0) {
        r.timeLeftSec -= 1;
        changed = true;
      }
    }
    if (changed && state.view === 'tank') {
      const pill = mainEl.querySelector('.ct-timer-pill');
      const r = currentRoom();
      if (pill && !r.settledStatus) pill.textContent = `⏱ ${formatClock(r.timeLeftSec)}`;
    }
  }, 1000);

  const sceneInterval = setInterval(() => {
    if (document.hidden || state.view !== 'tank') return;
    const r = currentRoom();
    state.scriptCursor = (state.scriptCursor + 1) % r.script.length;
    if (state.scriptCursor % 2 === 0) {
      state.flashIndex = (state.flashIndex + 1) % SHARK_FLASH_EVENTS.length;
      state.flashPop = true;
      setTimeout(() => { state.flashPop = false; }, 600);
    }
    // Lightweight in-place caption & speaking highlight update without tearing down 3D WebGL stage!
    const activeLine = r.script[state.scriptCursor % r.script.length];
    const capSpeaker = mainEl.querySelector('.ct-caption-speaker span:first-child');
    const capText = mainEl.querySelector('.ct-caption-text');
    const capStep = mainEl.querySelector('.ct-caption-speaker .ct-mono');
    if (capSpeaker && activeLine) capSpeaker.textContent = `${activeLine.speaker} · ${activeLine.role}`;
    if (capText && activeLine) capText.textContent = activeLine.line;
    if (capStep) capStep.textContent = `clank.world scene ${(state.scriptCursor % r.script.length) + 1}/${r.script.length}`;
    const lines = mainEl.querySelectorAll('.ct-transcript-list .ct-line');
    lines.forEach((n, idx) => n.classList.toggle('is-current', idx === (state.scriptCursor % r.script.length)));
    const tiles = mainEl.querySelectorAll('.ct-shark-tile');
    tiles.forEach((tile, idx) => {
      const s = AI_SHARKS[idx];
      if (!s) return;
      const isSp = activeLine?.speaker === s.name;
      tile.classList.toggle('is-speaking', isSp);
      const chip = tile.querySelector('.ct-tag-chip');
      if (chip) {
        chip.textContent = isSp ? '● SPEAKING NOW' : s.stance;
        chip.classList.toggle('is-green', isSp);
      }
    });
  }, 6800);

  const feedInterval = setInterval(() => {
    if (!document.hidden) syncLiveClankFeed();
  }, 12000);

  window.addEventListener('beforeunload', () => {
    clearInterval(clockInterval);
    clearInterval(sceneInterval);
    clearInterval(feedInterval);
    state.vrmInstance?.destroy();
    state.stageChart?.destroy();
    state.dossierChart?.destroy();
  });

  // Mount root
  root.replaceChildren(header, shell, tape, walletDialog, dossierDialog, toastEl);
  syncWalletButton();
  renderSidebar();
  renderTape();
  renderCurrentView();
  syncLiveClankFeed();
}

if (typeof document !== 'undefined') {
  const host = document.querySelector('[data-ct-root]');
  if (host) bootClankTrade(host);
}
