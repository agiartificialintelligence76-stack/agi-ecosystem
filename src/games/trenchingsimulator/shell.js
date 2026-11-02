// TRENCHING SIMULATOR's screens (2026-10-20): home, the terminals, the modes, the challenges, a run's brief, the run
// itself (its HUD over a terminal, the market moved on every frame, AGI-1 reacting) and its results (a share card drawn
// on a canvas). Each screen has its own place in the browser's history, so Back works the way people expect: Back in a
// run asks first (the pause sheet). Every node is made with createElement and its words set as text; styles only
// through classes and the CSS object model (the site's CSP allows no style attributes).
//
// Live mode (2026-10-21, #404): a Market switch on the modes screen (Simulated, the default, or Live coins) and a chain
// (Solana, Robinhood Chain, BNB Chain, Base; since 2026-10-22 also Ethereum, Monad, HyperEVM, Arbitrum and Tron). While
// it's on, one connection to our relay (./live-feed.js) says how the
// live feed is doing, in plain words; a run in it trades real coins with play money (./live-market.js) on a clock that
// never stops. Since 2026-11-03, each real coin's first quote seeds simulated prices and volume; source refreshes
// preserve that practice market. No fictional coins fill in during a listing outage.
// The daily market and the challenge that ends on a rug stay simulated.
//
// Race rooms (2026-10-22, ./race.js): "Race a friend" on the home screen makes or joins a room (an invite link is the
// page's own address with #room=<code>); its host picks a challenge and starts it; everyone plays it on the same
// simulated market from the same moment, on a clock that never stops, with the room's standings under the HUD and on
// the results. Leaving its screens leaves the room.
import { el, setText, flag, icon, toast, clearToasts, paintTerminal } from './ui.js';
import { TERMINALS, terminalById, SAFETY_NOTE } from './terminals.js';
import { markEl } from './brands.js';
import { gameLogo, menuHeader, terminalTile, marketIllustration, modeTile, MENU_TERMINAL_ORDER, TERMINAL_GUIDES } from './menu.js';
import { CHALLENGES, TIERS, challengeById, FREE_STARTS, SPEEDS, goalText, timeText, startText, freeStartSol, dailyKey, dailySeed,
  dailyChallenge } from './challenges.js';
import { createRun } from './run.js';
import { captureRunReplay } from './replay-data.js';
import { createReplayArchive } from './replay-archive.js';
import { loadSave, writeSave, recordResult, starsTotal, SLIPPAGES, PRIORITIES } from './save.js';
import { getSolPrice } from './solprice.js';
import { createSound } from './sound.js';
import { createVoice } from './lines.js';
import { createAgi, facePixels } from './agi.js';
import { PRIORITY } from './engine.js';
import { mountBoard } from './boards/board.js';
import { loadName, saveName } from '../player-name.js';
import { Site } from './site.js';
import { askTicket, sendScore } from './ranked.js';
import { rankWords, boardTitle } from '../boards.js';
import { shareText, shareLink, GAME_NAME } from './share.js';
import { money, moneySigned, clock, share, times, tokens, usd, unitOf, isCoinCurrency } from './format.js';
import { resultTitle, resultTone, resultLine, statLines, starsRow, sparkPath, cardText, modeLabel } from './results.js';
import { CHAINS, chainById, feedWords, liveOk, liveCurrency, UNIT_NAMES, relayUrl, liveOpen, LIVE_NOTE, LIVE_SOON,
  LIVE_SOON_HOW, playState, liveMoney } from './live-chains.js';
import { createLiveFeed } from './live-feed.js';
import { createLiveMarket } from './live-market.js';
import { createClankFeed, createClankMarket } from './clank-live.js';
import { terminalLiveChains, terminalLiveChain, terminalFeedWords, CLANK_LIVE_NOTE } from './terminal-live.js';
import { createRace, raceUrl, roomOfHash, inviteLink, cleanCode, raceWords, standingText } from './race.js';

const NS = 'http://www.w3.org/2000/svg';
// a ready terminal's board, the same doors for each (boards/board.js's): Pomp.fun's is in the page; GNGM's (2026-10-22)
// and its PnL card come as their own file the first time they're needed (null: it couldn't be fetched)
const boardFor = (t) => (t.id === 'social' ? import('./boards/phomo.js').then((m) => m.mountPhomo, () => null)
  : t.id === 'scan' ? import('./boards/gngm.js').then((m) => m.mountGngm, () => null)
    : t.id === 'pro' ? import('./boards/axium.js').then((m) => m.mountAxium, () => null)
      : t.id === 'chat' ? import('./boards/basedbott.js').then((m) => m.mountBasedbott, () => null)
        : t.id === 'clank' ? import('./boards/clank.js').then((m) => m.mountClank, () => null) : Promise.resolve(mountBoard));
const gngmCard = () => import('./boards/gngm-card.js');
const CARD_W = 1200;
const CARD_H = 630;
const KNOWN = new Set(['home', 'terminals', 'modes', 'challenges', 'brief', 'race']);
const TIER_NAMES = { easy: 'Easy', medium: 'Medium', hard: 'Hard', legendary: 'Legendary' };
const END_KEYS = new Set(['won', 'lostTime', 'lostRug', 'busted', 'cashed', 'quit']);
const STARS_MAX = CHALLENGES.length * 3;
const FAIL_WORDS = {
  slippage: () => 'The price moved past your slippage: nothing traded',
  migrating: (t) => `$${t} is migrating: nothing trades for a moment`,
  no_liquidity: () => 'Not enough liquidity for that',
  no_tokens: (t) => `You don't hold $${t} any more`,
};

const svg = (tag, attrs) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, String(v));
  return n;
};
const today = () => dailyKey(new Date());
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const introUp = () => Boolean(document.getElementById('agi-intro'));

function btn(label, { kind = '', ic = null, on = null, disabled = false, cls = '' } = {}) {
  return el('button', { type: 'button', class: ['ts-btn', kind && `is-${kind}`, cls], disabled, on: on ? { click: on } : null },
    ic ? icon(ic) : null, el('span', { text: label }));
}

export function startShell(root) {
  const store = (() => {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  })();
  const S = { save: loadSave(store), price: null, priceAt: 0, priceP: null, play: null, last: null, expectPop: 0,
    token: 0, resAgi: null, feed: null, feedSource: null, offFeed: null, name: loadName(store), race: null, raceView: null, raceBoard: null,
    raceStarted: '', raceCh: 'speedrun' };
  const recordings = createReplayArchive(store);
  // Live mode: open on the site since its relay runs (2026-10-21; ./live-chains.js: LIVE_OPEN). Closed ("coming soon",
  // as it was until then), every run is simulated, whatever this browser kept from a try
  const LIVE = liveOpen(location);
  if (!LIVE) S.save.live = false;
  const sound = createSound({ muted: S.save.muted });
  const unlock = () => sound.unlock();
  addEventListener('pointerdown', unlock, { once: true, capture: true });
  addEventListener('keydown', unlock, { once: true, capture: true });

  const save = () => writeSave(store, S.save);
  // GNGM's presets P1 to P3 (2026-10-22): the one picked is the game's slippage and priority (an older save's settings
  // become the picked one's), and changing those (anywhere) changes it
  S.save.presets[S.save.preset] = { slippage: S.save.slippage, priority: S.save.priority };
  function pickPreset(i) {
    if (!Number.isInteger(i) || !S.save.presets[i]) return;
    S.save.preset = i;
    S.save.slippage = S.save.presets[i].slippage;
    S.save.priority = S.save.presets[i].priority;
    save();
  }
  function setPreset(i, patch) {
    const p = S.save.presets[i];
    if (!p || !patch) return;
    if (SLIPPAGES.includes(patch.slippage)) p.slippage = patch.slippage;
    if (PRIORITIES.includes(patch.priority)) p.priority = patch.priority;
    if (i === S.save.preset) {
      S.save.slippage = p.slippage;
      S.save.priority = p.priority;
    }
    save();
  }
  // the player's optional name (both games': ../player-name.js) → { ok, name }
  function setPlayerName(raw) {
    const r = saveName(store, raw);
    if (r.ok) S.name = r.name;
    return r;
  }
  // ---- Live mode ----
  // the one connection to the relay, made the first time Live mode is used, open only while it's on
  const liveFeed = () => {
    S.save.chain = terminalLiveChain(S.save.terminal, S.save.chain);
    const source = S.save.terminal === 'clank' ? 'clank' : 'relay';
    if (S.feed && S.feedSource !== source) {
      S.feed.stop();
      if (S.offFeed) S.offFeed();
      S.offFeed = null;
      S.feed = null;
    }
    if (!S.feed) {
      S.feed = source === 'clank' ? createClankFeed() : createLiveFeed({ url: relayUrl(location) });
      S.feedSource = source;
    }
    return S.feed;
  };
  const chainNow = () => chainById(terminalLiveChain(S.save.terminal, S.save.chain)) || CHAINS[0];
  // a run with this setup is a live one (the daily market and a challenge that ends on a rug never are)
  const liveRun = (setup) => S.save.live && setup.kind !== 'daily'
    && (setup.kind !== 'challenge' || liveOk(challengeById(setup.id)));
  // a screen's line about the feed, kept up to date while the screen is up (`also`: the screen's own, on each change)
  function feedLine(when = 'before', also = null) {
    const line = el('p', { class: 'ts-live-state', role: 'status', 'aria-live': 'polite' });
    const paint = () => {
      const f = liveFeed();
      const liveCoins = f.chain === S.save.chain ? f.coins().filter((c) => c.tracked).length : 0;
      const w = terminalFeedWords(S.save.terminal, f.status, playState(f.chainState(S.save.chain), liveCoins), S.save.chain, when);
      setText(line, w.text);
      line.dataset.tone = w.tone;
      if (also) also();
    };
    paint();
    if (S.offFeed) S.offFeed();
    S.offFeed = liveFeed().on(paint);
    return line;
  }
  const terminal = () => {
    const t = terminalById(S.save.terminal);
    return t && t.ready ? t : TERMINALS.find((x) => x.ready);
  };
  function ensurePrice() {
    if (S.price && Date.now() - S.priceAt < 300000) return Promise.resolve(S.price);
    if (!S.priceP) {
      S.priceP = Promise.resolve(getSolPrice({ storage: store })).then((p) => {
        S.price = p && p.usd > 0 ? p : { usd: 150, source: 'default' };
        S.priceAt = Date.now();
        S.priceP = null;
        return S.price;
      }, () => {
        S.priceP = null;
        return S.price || { usd: 150, source: 'default' };
      });
    }
    return S.priceP;
  }

  // ---- screens and history ----
  function show(node, title) {
    if (S.resAgi) {
      S.resAgi.destroy();
      S.resAgi = null;
    }
    // a race room is left with its screens (its room, its countdown, its run, its results)
    if (S.race && S.race.status !== 'idle' && node.dataset.race !== '1') leaveRoom();
    if (S.offFeed && !node.querySelector('.ts-live-state')) {
      S.offFeed();
      S.offFeed = null;
    }
    // the page itself too: toasts and sheets live in <body>, outside the root, and take its colors from there
    paintTerminal(document.documentElement, terminal());
    paintTerminal(root, terminal());
    // a toast belongs to the screen it came from (a sell's toast never lingers over the results)
    clearToasts();
    root.replaceChildren(node);
    document.title = title ? `${title} · TRENCHING SIMULATOR` : 'TRENCHING SIMULATOR · AGI games';
    const h = node.querySelector('h1, h2');
    if (h && document.activeElement && document.activeElement !== document.body) {
      h.setAttribute('tabindex', '-1');
      h.focus({ preventScroll: true });
    }
    scrollTo(0, 0);
  }
  function render(st) {
    S.token++;
    const s = st && typeof st === 'object' ? st : { ts: 'home' };
    if (s.ts === 'terminals') return show(terminalsScreen(), 'Pick a terminal');
    if (s.ts === 'modes') return show(modesScreen(), 'Pick a mode');
    if (s.ts === 'challenges') return show(challengesScreen(), 'Challenges');
    if (s.ts === 'brief') return show(briefScreen(s), 'Get ready');
    if (s.ts === 'race') return show(raceScreen(s), 'Race a friend');
    if (s.ts === 'results' && S.last) return show(resultsScreen(), resultTitle(S.last.res));
    return show(homeScreen(), '');
  }
  function go(name, params = {}, { replace = false } = {}) {
    const st = { ts: name, ...params };
    if (replace) history.replaceState(st, '');
    else history.pushState(st, '');
    render(st);
  }
  const back = (fallback) => (history.length > 1 ? history.back() : go(fallback, {}, { replace: true }));

  function header(backTo) {
    return el('div', { class: 'ts-top' },
      backTo === 'games'
        ? el('a', { class: 'ts-back', href: '/games' }, icon('back'), el('span', { text: 'Games' }))
        : btn('Back', { kind: 'ghost', ic: 'back', cls: 'ts-back', on: () => back(backTo) }),
      gameLogo({ compact: true }));
  }
  const note = () => el('p', { class: 'ts-note' }, icon('info'), el('span', { text: `${SAFETY_NOTE} Not financial advice.` }));
  // the player's optional name (2026-10-22, the owner: "they can enter their custom name before playing just like in the
  // real terminal (just optional)"): a field that keeps it when it changes, on a run's brief and in the settings
  function nameField() {
    const input = el('input', { class: 'ts-name-in', type: 'text', maxLength: 40, autocomplete: 'nickname', spellcheck: 'false',
      placeholder: 'Your name (optional)', value: S.name || '', 'aria-label': 'Your name, optional' });
    const msg = el('p', { class: 'ts-name-msg', role: 'status' });
    const keep = () => {
      const r = setPlayerName(input.value);
      if (!r.ok) {
        msg.dataset.tone = 'bad';
        setText(msg, 'That name can\'t be used: 1 to 24 letters, numbers, spaces or emoji; no links, addresses, or names that pass for AGI-1, her team or a moderator.');
        return;
      }
      input.value = r.name || '';
      msg.dataset.tone = '';
      setText(msg, r.name ? `Your cards say “by ${r.name}”.` : '');
    };
    input.addEventListener('change', keep);
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      keep();
    });
    return el('div', { class: 'ts-name' }, el('span', { class: 'ts-chips-l', text: 'Your name' }), input, msg,
      el('p', { class: 'ts-name-note', text: 'Optional, like a username on a terminal: it goes on your cards, and on the leaderboards with your ranked runs. Kept in this browser.' }));
  }

  function homeScreen() {
    const st = S.save.stats;
    const day = today();
    const dch = dailyChallenge(day);
    const dd = S.save.daily[day];
    const t = terminal();
    const first = st.runs === 0;
    const stat = (v, l) => el('div', { class: 'tsm-stat' }, el('b', { text: v }), el('span', { text: l }));
    const learn = () => {
      S.save.terminal = 'board';
      S.save.live = false;
      if (S.feed) S.feed.stop();
      save();
      go('brief', { kind: 'challenge', id: 'first-blood' });
    };
    return el('section', { class: 'ts-screen tsm-screen ts-home' },
      gameMenuHeader('home'),
      el('div', { class: 'tsm-hero' },
        el('div', { class: 'tsm-hero-copy' },
          el('p', { class: 'tsm-eyebrow' }, el('i', { class: 'tsm-status-dot' }), 'SIX TERMINALS. YOUR PLAYGROUND.'),
          el('h1', { class: 'tsm-title' }, 'ENTER THE', el('br'), el('em', { text: 'TRENCHES.' })),
          el('p', { class: 'tsm-intro', text: 'Catch the next runner. Learn when to get out. Practice on the terminals you know, with play money and nothing to lose.' }),
          el('div', { class: 'tsm-hero-actions' },
            btn(first ? 'Learn the basics' : `Play on ${t.name}`, { kind: 'primary', ic: 'play', on: first ? learn : () => go('modes') }),
            btn('Choose a terminal', { ic: 'sliders', on: () => go('terminals') })),
          el('p', { class: 'tsm-hero-foot', text: first ? 'Start with a 5-minute challenge · No wallet needed' : 'Your progress stays in this browser · Play money only' })),
        marketIllustration()),
      el('div', { class: 'tsm-section-head' }, el('div', {}, el('h2', { text: 'Find your next session' }),
        el('p', { text: 'A little practice or a proper challenge. You choose.' })),
        el('button', { type: 'button', class: 'tsm-text-button', on: { click: () => go('challenges') } }, 'All challenges', icon('back', 'ts-icon tsm-forward'))),
      el('div', { class: 'tsm-mode-grid' },
        modeTile({ title: 'Free play', description: 'Explore the market at your own pace. No timer. No target.',
          meta: `${t.name} · ${S.save.live ? 'Live coins' : 'Simulated market'}`, icon: 'chart', on: () => go('brief', { kind: 'free' }), featured: true }),
        modeTile({ title: 'Daily market', description: `${dch.name}. The same market for everyone today.`,
          meta: dd?.won ? `Completed ${starsRow(dd.stars)}` : `${timeText(dch.seconds)} · New every day`, icon: 'flame', on: () => go('brief', { kind: 'daily' }) }),
        modeTile({ title: 'Race a friend', description: 'One market. The same starting balance. Who comes out ahead?',
          meta: 'Private room · Share an invite', icon: 'users', on: () => go('race') })),
      el('div', { class: 'tsm-current' }, markEl(t.id), el('div', { class: 'tsm-current-copy' },
        el('small', { text: 'YOUR TERMINAL' }), el('b', { text: t.name }), el('p', { text: TERMINAL_GUIDES[t.id].detail })),
        btn('Browse all 6 terminals', { ic: 'sliders', on: () => go('terminals') })),
      el('div', { class: 'tsm-bottom' },
        el('div', { class: 'tsm-stats', 'aria-label': 'Your progress' }, stat(String(st.runs), 'Sessions played'), stat(String(st.wins), 'Challenges won'),
          stat(`${starsTotal(S.save)}/${STARS_MAX}`, 'Stars earned'), stat(st.bestX > 0 ? times(st.bestX) : '—', 'Best return')),
        el('details', { class: 'tsm-help' }, el('summary', { text: 'New to the trenches? Here’s how it works.' }), ...howTo())), note(),
      el('p', { class: 'ts-links' }, el('a', { href: '/games#rate-trenchingsimulator', text: 'Rate it' })));
  }

  function gameMenuHeader(active = '') {
    return menuHeader({ active, onHome: () => go('home'), onTerminals: () => go('terminals'), onReplays: openReplayLibrary });
  }
  function howTo() {
    return [
      el('p', { text: 'Pick a terminal, then a challenge, the daily market or free play. You get play money, and a market full of made-up coins: new ones launch every few seconds, most of them die, a few run.' }),
      el('p', { text: 'Buy a coin, watch its chart and its holders, and sell before it dumps. Every trade pays a small fee and lands a moment later (faster with a higher priority); if the price moves past your slippage, it fails.' }),
      el('p', { text: 'Rugs, dev sells and migrations happen. Challenges have a goal and a clock; free play has neither. Nothing here is real money, and nothing here is advice.' }),
      el('p', { text: LIVE ? 'Live mode (on the modes screen): real coins and logos from your selected chain, with simulated prices and volume. Your play-money buys and sells move the practice chart. New listings keep arriving, and nothing is bought or sold for real.'
        : LIVE_SOON_HOW }),
      el('p', { class: 'ts-how-credit', text: 'GNGM\'s charts: TradingView Lightweight Charts™ · Copyright (c) 2025 TradingView, Inc. (tradingview.com).' }),
    ];
  }

  function terminalsScreen() {
    const cur = terminal();
    const cards = MENU_TERMINAL_ORDER.map((id) => terminalTile(terminalById(id), { selected: id === cur.id, onSelect: (picked) => {
      S.save.terminal = picked;
      S.save.chain = terminalLiveChain(picked, S.save.chain);
      save();
      go('modes');
    } }));
    return el('section', { class: 'ts-screen tsm-screen ts-terminals' }, gameMenuHeader('terminals'),
      el('div', { class: 'tsm-page-heading' }, el('div', {}, el('h1', { text: 'Find your trading style.' }),
        el('p', { text: 'Six familiar workspaces. One play-money market. Pick a layout that feels right — you can switch any time between sessions.' })),
        el('span', { class: 'tsm-step' }, el('b', { text: '01 TERMINAL' }), ' / 02 MODE / 03 PLAY')),
      el('div', { class: 'tsm-terminal-grid' }, cards), note());
  }

  // the Market switch (Simulated or Live coins) and, for Live, the chain and how the feed is doing; while Live mode isn't
  // open yet, its Live coins choice says Soon and can't be picked (like the terminals not built yet)
  function marketPicker(onNews = null) {
    const live = S.save.live;
    if (live) liveFeed().start(S.save.chain);
    const radio = (label, items, value, pick, cls) => el('div', { class: ['ts-chips', cls], role: 'radiogroup', 'aria-label': label },
      el('span', { class: 'ts-chips-l', text: label }),
      items.map(([v, words, soon]) => el('button', { type: 'button', role: 'radio', class: ['ts-chip', soon && 'is-soon'],
        'aria-checked': String(v === value), 'aria-label': soon ? `${words}, coming soon` : null, disabled: Boolean(soon),
        data: { v }, on: { click: () => pick(v) } },
      words, soon ? el('span', { class: 'ts-chip-soon', text: 'Soon', 'aria-hidden': 'true' }) : null)));
    const again = (focusSel) => {
      render(history.state);
      const b = root.querySelector(focusSel);
      if (b) b.focus();
    };
    return el('div', { class: ['ts-market', live && 'is-live'] },
      radio('Market', [['sim', 'Simulated'], ['live', 'Live coins', !LIVE]], live ? 'live' : 'sim', (v) => {
        const on = v === 'live';
        if (on === S.save.live || (on && !LIVE)) return;
        S.save.live = on;
        save();
        if (!on && S.feed) S.feed.stop();
        again(`.ts-market [data-v="${v}"]`);
      }, 'ts-market-kind'),
      live ? [
        radio('Chain', terminalLiveChains(S.save.terminal).map((c) => [c.id, c.name]), S.save.chain, (v) => {
          v = terminalLiveChain(S.save.terminal, v);
          if (v === S.save.chain) return;
          S.save.chain = v;
          save();
          liveFeed().setChain(v);
          again(`.ts-market [data-v="${v}"]`);
        }, 'ts-market-chain'),
        feedLine('before', onNews),
        el('p', { class: 'ts-live-about', text: S.save.terminal === 'clank' ? CLANK_LIVE_NOTE : LIVE_NOTE }),
      ] : LIVE ? null : el('p', { class: 'ts-live-about', text: LIVE_SOON }));
  }

  function modesScreen() {
    const day = today();
    const dch = dailyChallenge(day);
    const dd = S.save.daily[day];
    const t = terminal();
    const live = S.save.live;
    const card = (title, line, sub, onClick, ic) => modeTile({ title, description: line, meta: sub,
      on: onClick, icon: ic, featured: title === 'Free play' });
    // Free play's starts in the run's money (a live run's coin once the relay's price for it is in)
    const freeSub = () => {
      const c = live ? runCur(t, true) : t.currency;
      return c === null ? `Start in ${liveUnit(t)} · waiting for price` : `Start with ${startsText(c, live)}`;
    };
    let freeCard = null;
    const onNews = () => {
      const sm = freeCard && freeCard.querySelector('small');
      if (sm && sm.textContent !== freeSub()) setText(sm, freeSub());
    };
    return el('section', { class: 'ts-screen tsm-screen ts-modes' }, gameMenuHeader('terminals'),
      el('p', { class: 'tsm-step' }, '01 TERMINAL / ', el('b', { text: '02 MODE' }), ' / 03 PLAY'),
      el('p', { class: 'ts-kicker', text: t.name }),
      el('h1', { class: 'ts-h', text: 'Pick a mode' }),
      marketPicker(onNews),
      el('div', { class: 'tsm-mode-grid' },
        freeCard = card('Free play', live ? t.id === 'clank' ? 'Real Clank.trade coins with simulated prices and volume. Your trades move the practice market.' : `Real ${chainNow().name} coins with simulated prices and volume. Your trades move the practice market.`
          : 'No clock and no goal. Trade as long as you like.', freeSub(), () => go('brief', { kind: 'free' }), 'chart'),
        card('Daily market', `${dch.name}: ${goalText(dch, t.currency, priceUsd())}`,
          live ? `Always simulated in ${unitOf(t.currency, priceUsd()).name}: the same coins for everyone today`
            : dd ? (dd.won ? `Won today ${starsRow(dd.stars)}` : `${dd.tries} ${dd.tries === 1 ? 'try' : 'tries'} today`)
              : 'The same market for everyone today', () => go('brief', { kind: 'daily' }), 'flame'),
        card('Challenges', live ? `${CHALLENGES.length} goals against a clock that never stops` : `${CHALLENGES.length} goals against the clock`,
          live ? `${starsTotal(S.save, { live: true })} of ${STARS_MAX} ★ in Live mode` : `${starsTotal(S.save)} of ${STARS_MAX} ★`,
          () => go('challenges'), 'trophy')),
      note());
  }

  function challengesScreen() {
    const t = terminal();
    const live = S.save.live;
    if (live) liveFeed().start(S.save.chain);
    // a challenge's money: in Live mode the chain's own coin, where it plays live
    const chCur = (c) => (live && liveOk(c) ? runCur(t, true) : t.currency);
    const descriptions = [];
    const describe = (c, goal, meta) => {
      const cLive = live && liveOk(c);
      const cur = chCur(c);
      const px = priceUsd(cLive);
      setText(goal, cur === null ? `Play money in ${liveUnit(t)} · waiting for price` : goalText(c, cur, px));
      setText(meta, `${timeText(c.seconds)} · ${cur === null ? `waiting for ${liveUnit(t)} price` : `start ${startText(c, cur, px)}`}${live && !liveOk(c) ? ' · simulated in Live mode' : ''}`);
    };
    const groups = TIERS.map((tier) => {
      const list = CHALLENGES.filter((c) => c.tier === tier);
      if (!list.length) return null;
      return el('div', { class: 'ts-tier' },
        el('h2', { class: 'ts-tier-h', text: TIER_NAMES[tier] || tier }),
        list.map((c) => {
          const b = live && liveOk(c) ? S.save.liveBest[c.id] : S.save.best[c.id];
          const goal = el('span', { class: 'ts-ch-goal' });
          const meta = el('span', { class: 'ts-ch-meta' });
          describe(c, goal, meta);
          descriptions.push([c, goal, meta]);
          return el('button', { type: 'button', class: ['ts-ch', b && b.stars > 0 && 'is-done'], data: { tier: c.tier },
            on: { click: () => go('brief', { kind: 'challenge', id: c.id }) } },
          el('b', { class: 'ts-ch-name', text: c.name }),
          goal, meta,
          el('span', { class: 'ts-ch-best', text: b && b.stars > 0
            ? `${starsRow(b.stars)}${b.time != null ? ` · best ${clock(b.time)}` : ''}` : starsRow(0) }));
        }));
    });
    return el('section', { class: 'ts-screen tsm-screen tsm-setup ts-challenges' }, header('modes'),
      el('h1', { class: 'ts-h', text: 'Challenges' }),
      el('p', { class: 'ts-lede', text: live
        ? `Live mode: real ${chainNow().name} coins with simulated prices and volume, on a clock that never stops. Its stars are kept apart from made-up markets. Rug dodger uses made-up coins: a real coin is never called a rug here.`
        : 'Win to earn up to 3 stars: faster wins and bigger multiples earn more.' }),
      live ? feedLine('before', () => descriptions.forEach(([c, goal, meta]) => describe(c, goal, meta))) : null,
      groups, note());
  }
  const priceUsd = (live = false) => (live && S.feed && S.feed.px.sol > 0 ? Math.round(S.feed.px.sol * 100) / 100
    : S.price && S.price.usd > 0 ? S.price.usd : 150);
  // a live run's money (Pomp.fun's: the chain's own coin since 2026-10-21, ./live-chains.js liveMoney) at the relay's
  // prices; a simulated run's, the terminal's own
  const runCur = (t, live) => (live ? liveMoney(t.id, S.save.chain, liveFeed().px) : t.currency);
  const liveUnit = (t) => UNIT_NAMES[liveCurrency(t.id, S.save.chain)];
  // Free play's starts in a run's money: "1, 5, 10, 50 SOL", "0.04, 0.2, 0.4, 2 ETH"
  const startsText = (cur, live = false) => {
    const px = priceUsd(live);
    const list = FREE_STARTS.map((v) => money(freeStartSol(v, cur, px), cur, px, { unit: false })).join(', ');
    return cur === 'usd' ? list : `${list} ${unitOf(cur, px).name}`;
  };

  function setupOf(st) {
    if (st.kind === 'daily') return { kind: 'daily', day: st.day || today() };
    if (st.kind === 'challenge' && challengeById(st.id)) return { kind: 'challenge', id: st.id };
    return { kind: 'free' };
  }
  function briefScreen(st) {
    const setup = setupOf(st);
    const t = terminal();
    const ch = setup.kind === 'daily' ? dailyChallenge(setup.day) : setup.kind === 'challenge' ? challengeById(setup.id) : null;
    const live = liveRun(setup);
    if (live) liveFeed().start(S.save.chain);
    const facts = el('dl', { class: 'ts-facts' });
    const priceLine = el('p', { class: 'ts-price' });
    // the run's money (a live run's: the chain's own coin once the relay's price for it is in)
    const cur = () => (live ? runCur(t, true) : t.currency);
    const chipTexts = [];
    let startButton = null;
    const fill = () => {
      const px = priceUsd(live);
      const c = cur();
      const waiting = c === null;
      const rows = ch
        ? [['Goal', waiting ? ch.blurb : goalText(ch, c, px)], ['Time', timeText(ch.seconds)], ['Start', waiting ? `Waiting for ${liveUnit(t)} price` : startText(ch, c, px)]]
        : [['Goal', 'None: trade as long as you like'], ['Time', 'No clock'],
          ['Start', waiting ? `Waiting for ${liveUnit(t)} price` : money(freeStartSol(S.save.freeStart, c, px), c, px)]];
      rows.push(['On', t.name]);
      if (S.save.live) {
        rows.push(['Market', live ? `Live coins · ${chainNow().name} · simulated prices and volume` : setup.kind === 'daily' ? `Simulated in ${unitOf(t.currency, px).name}: the same coins for everyone today`
          : 'Simulated: a real coin is never called a rug here']);
      }
      facts.replaceChildren(...rows.flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: v })]));
      const src = live && S.feed && S.feed.px.sol > 0 ? 'live' : S.price ? S.price.source : '';
      setText(priceLine, waiting ? `${liveUnit(t)} price is not available yet. Start unlocks when it arrives.`
        : isCoinCurrency(c) ? `${unitOf(c, px).name} ${usd(c.usd)} · ${live ? 'live' : 'practice reference rate'}, frozen for this run`
          : `SOL ${usd(px)} ${src === 'live' ? '· live' : src === 'saved' ? '· last known' : '· a stand-in price'}, frozen for this run`);
      if (startButton) startButton.disabled = waiting;
      for (const [b, v, text] of chipTexts) {
        setText(b, text(v));
        b.disabled = waiting;
      }
    };
    // (the coin's price comes with the feed: once it's in, or it moves, the words follow)
    let curKey = JSON.stringify([cur(), priceUsd(live)]);
    const onFeedNews = () => {
      const k = JSON.stringify([cur(), priceUsd(live)]);
      if (k === curKey) return;
      curKey = k;
      fill();
    };
    ensurePrice().then(() => {
      if (root.contains(facts)) fill();
    });
    fill();
    const chips = (label, list, value, text, pick) => el('div', { class: 'ts-chips', role: 'radiogroup', 'aria-label': label },
      el('span', { class: 'ts-chips-l', text: label }),
      list.map((v) => {
        const b = el('button', { type: 'button', role: 'radio', class: 'ts-chip', 'aria-checked': String(v === value), disabled: cur() === null,
          on: { click: (e) => {
            pick(v);
            for (const x of e.currentTarget.parentNode.querySelectorAll('.ts-chip')) x.setAttribute('aria-checked', String(x === e.currentTarget));
            fill();
          } } }, text(v));
        chipTexts.push([b, v, text]);
        return b;
      }));
    const best = ch && setup.kind === 'challenge' ? (live ? S.save.liveBest[ch.id] : S.save.best[ch.id]) : null;
    const dd = setup.kind === 'daily' ? S.save.daily[setup.day] : null;
    return el('section', { class: 'ts-screen tsm-screen tsm-setup ts-brief' }, header(setup.kind === 'challenge' ? 'challenges' : 'modes'),
      el('p', { class: 'ts-kicker', text: setup.kind === 'daily' ? `Daily market · ${setup.day}`
        : ch ? `Challenge · ${TIER_NAMES[ch.tier] || ch.tier}` : 'Free play' }),
      el('h1', { class: 'ts-h', text: ch ? ch.name : 'Free play' }),
      el('p', { class: 'ts-lede', text: ch ? ch.blurb : live ? t.id === 'clank' ? 'Real Clank.trade coins in your own simulated market. Your play-money buys and sells affect prices and volume.' : 'Real coins in your own simulated market. Your play-money buys and sells affect prices and volume. Cash out whenever you like.'
        : 'Your own market, no clock and no goal. Cash out whenever you like.' }),
      ch?.id === 'first-blood' ? el('ol', { class: 'tsm-first-steps', 'aria-label': 'Your first session' },
        el('li', {}, el('b', { text: 'Find a coin' }), el('span', { text: 'Open any coin from the feed to see its chart.' })),
        el('li', {}, el('b', { text: 'Make a small buy' }), el('span', { text: 'Choose an amount in the trade panel. All funds are play money.' })),
        el('li', {}, el('b', { text: 'Watch your return' }), el('span', { text: 'Use Sell to take profits. Reach 5% growth within 5 minutes to win.' }))) : null,
      facts,
      setup.kind === 'free' ? [
        chips('Start with', FREE_STARTS, S.save.freeStart, (v) => cur() === null ? `— ${liveUnit(t)}`
          : money(freeStartSol(v, cur(), priceUsd(live)), cur(), priceUsd(live)), (v) => {
          S.save.freeStart = v;
          save();
        }),
        live ? null : chips('Speed', SPEEDS, S.save.speed, (v) => `${v}×`, (v) => {
          S.save.speed = v;
          save();
        }),
      ] : null,
      live ? [feedLine('before', onFeedNews), el('p', { class: 'ts-live-about', text: `${t.id === 'clank' ? CLANK_LIVE_NOTE : LIVE_NOTE} The clock never stops in Live mode, not even for the menu.` })] : null,
      best && best.stars > 0 ? el('p', { class: 'ts-best', text: `Your best: ${starsRow(best.stars)}${best.time != null ? ` · ${clock(best.time)}` : ''}` }) : null,
      dd ? el('p', { class: 'ts-best', text: dd.won ? `Won today ${starsRow(dd.stars)}` : `${dd.tries} ${dd.tries === 1 ? 'try' : 'tries'} today` }) : null,
      !live && setup.kind !== 'free' && t.currency === 'sol'
        ? el('p', { class: 'ts-rank-note', text: 'Leaderboard: this run is checked on our server and ranked on agi1.app/games, under your name if you give one. Bragging rights only, no prizes.' })
        : null,
      nameField(),
      priceLine,
      el('div', { class: 'ts-actions' },
        startButton = btn('Start', { kind: 'primary', ic: 'play', disabled: cur() === null, on: () => startRun(setup) }),
        btn('Back', { kind: 'ghost', on: () => back(setup.kind === 'challenge' ? 'challenges' : 'modes') })),
      note());
  }

  // ---- race rooms (2026-10-22: ./race.js) ----
  // one connection to the relay's rooms, made the first time a room is made or joined
  const raceRoom = () => {
    if (!S.race) {
      S.race = createRace({ url: raceUrl(location) });
      S.race.on(onRace);
    }
    return S.race;
  };
  const inRoom = () => Boolean(S.race && S.race.room && S.race.status !== 'idle' && S.race.status !== 'closed');
  function leaveRoom() {
    if (S.race && S.race.status !== 'idle') S.race.leave();
  }
  // the room's news: a race starts (its countdown, then the run), the standings under the HUD or on the results, the room
  // screen's players and buttons
  function onRace(ev) {
    if (ev.type === 'go') {
      if (!S.play || S.play.dead) startRaceRun(ev.go);
      return;
    }
    if (S.play && !S.play.dead && S.play.setup.race) {
      if (S.play.paintRace) S.play.paintRace();
      return;
    }
    if (S.raceView && root.contains(S.raceView.el)) S.raceView.update();
    if (S.raceBoard && root.contains(S.raceBoard.el)) S.raceBoard.paint();
  }
  // the standings as a list (the room screen between races, the results)
  function boardList(rows, meId) {
    return el('ol', { class: 'ts-race-board' }, rows.map((row, i) => el('li', { class: row.id === meId ? 'is-me' : '' },
      standingText(row, i, { you: row.id === meId }))));
  }
  function raceScreen(st) {
    const r = raceRoom();
    const t = terminal();
    const h = el('h1', { class: 'ts-h', text: 'Race a friend' });
    const line = el('p', { class: 'ts-race-state', role: 'status', 'aria-live': 'polite' });
    const body = el('div', { class: 'ts-race-body' });
    const node = el('section', { class: 'ts-screen tsm-screen tsm-setup ts-race', data: { race: '1' } }, header('home'),
      el('p', { class: 'ts-kicker', text: 'Race a friend · play money' }), h,
      el('p', { class: 'ts-lede', text: 'Everyone in a room trades the same made-up market from the same moment, each with their own play money. Invite friends with a link: no wallet, no sign-in. The standings are just for fun.' }),
      body, line, note());
    const invited = st && cleanCode(st.code);
    let shown = '';
    // not in a room: join one (an invite link's code filled in), or make one for a challenge
    function formParts() {
      const codeIn = el('input', { class: 'ts-race-code', type: 'text', maxLength: 7, autocomplete: 'off', spellcheck: 'false',
        autocapitalize: 'characters', placeholder: 'K7QX2M', 'aria-label': 'Room code', value: invited || '' });
      const pick = el('select', { class: 'ts-race-pick', 'aria-label': 'Challenge' },
        CHALLENGES.map((c) => el('option', { value: c.id, text: `${c.name} · ${timeText(c.seconds)}` })));
      pick.value = challengeById(S.raceCh) ? S.raceCh : 'speedrun';
      const join = () => {
        const code = cleanCode(codeIn.value);
        if (!code) {
          setText(line, 'A room code is 6 letters and numbers, like K7QX2M.');
          codeIn.focus();
          return;
        }
        raceRoom().join(code, { name: S.name || '' });
        update();
      };
      const make = () => {
        const ch = challengeById(pick.value);
        if (!ch) return;
        S.raceCh = ch.id;
        raceRoom().create({ name: S.name || '', set: { challenge: ch.id, seconds: ch.seconds } });
        update();
      };
      codeIn.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        join();
      });
      return [
        nameField(),
        el('div', { class: 'ts-race-box' }, el('h2', { class: 'ts-race-h', text: 'Join a room' }),
          el('div', { class: 'ts-race-row' }, codeIn, btn(invited ? `Join room ${invited}` : 'Join', { kind: invited ? 'primary' : '', ic: 'users', on: join }))),
        el('div', { class: 'ts-race-box' }, el('h2', { class: 'ts-race-h', text: 'Make a room' }),
          el('p', { class: 'ts-race-note', text: 'Pick a challenge: everyone races it on the same market. You start the race once your friends are in.' }),
          el('div', { class: 'ts-race-row' }, pick, btn('Make a room', { kind: invited ? '' : 'primary', ic: 'flame', on: make }))),
      ];
    }
    // in a room: its invite link, its challenge, its players, ready and (the host) start, leave; between races, the last
    // race's standings
    const linkIn = el('input', { class: 'ts-race-link', type: 'text', readOnly: true, 'aria-label': 'Invite link' });
    const facts = el('dl', { class: 'ts-facts' });
    const players = el('ol', { class: 'ts-race-players', 'aria-label': 'Players' });
    const last = el('div', { class: 'ts-race-last' });
    const readyBtn = btn("I'm ready", { ic: 'check', on: () => {
      const me = S.race && S.race.room && S.race.room.players.find((p) => p.id === S.race.me.id);
      S.race.ready(!(me && me.ready));
    } });
    const startBtn = btn('Start the race', { kind: 'primary', ic: 'play', on: () => S.race.start() });
    const copy = () => navigator.clipboard.writeText(linkIn.value).then(() => toast('Invite link copied', 'up'),
      () => toast('Couldn\'t copy it: select the link and copy it', 'down'));
    function roomParts() {
      linkIn.addEventListener('focus', () => linkIn.select());
      return [
        el('div', { class: 'ts-race-box' }, el('h2', { class: 'ts-race-h', text: 'Invite friends' }),
          el('p', { class: 'ts-race-note', text: 'Send them this link. They need no wallet and no sign-in: they open it, and they\'re in.' }),
          el('div', { class: 'ts-race-row' }, linkIn, btn('Copy link', { ic: 'share', on: copy }))),
        facts,
        el('h2', { class: 'ts-race-h', text: 'Players' }), players, last,
        el('div', { class: 'ts-actions' }, readyBtn, startBtn, btn('Leave room', { kind: 'ghost', on: () => {
          leaveRoom();
          update();
        } })),
      ];
    }
    function paintRoom() {
      const rm = r.room;
      if (!rm) return;
      const me = r.me;
      const ch = challengeById(rm.set.challenge);
      const px = priceUsd();
      linkIn.value = inviteLink(rm.code, location.origin);
      facts.replaceChildren(...[['Challenge', ch ? ch.name : 'A challenge this page doesn\'t know yet: reload it'],
        ['Goal', ch ? goalText(ch, t.currency, px, { exactStart: true }) : '—'], ['Time', timeText(rm.set.seconds)],
        ['Start', ch ? startText(ch, t.currency, px, { exactStart: true }) : '—'],
        ['Market', 'Simulated: the same made-up coins for everyone in the room'], ['Clock', 'Never stops, not even for the menu']]
        .flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: v })]));
      const between = rm.state === 'lobby' || rm.state === 'ended';
      players.replaceChildren(...rm.players.map((p) => el('li', { class: [p.id === me.id && 'is-me', p.gone && 'is-gone'] },
        el('span', { class: 'ts-race-name', text: p.id === me.id ? `${p.name} (you)` : p.name }),
        p.host ? el('span', { class: 'ts-race-tag', text: 'Host' }) : null,
        p.ready ? el('span', { class: 'ts-race-tag is-ready', text: 'Ready' }) : null,
        p.gone ? el('span', { class: 'ts-race-tag', text: 'Away' }) : null,
        r.isHost && between && p.id !== me.id ? btn('Remove', { kind: 'ghost', cls: 'ts-race-kick', on: () => S.race.kick(p.id) }) : null)));
      const mine = rm.players.find((p) => p.id === me.id);
      readyBtn.hidden = !between;
      setText(readyBtn.querySelector('span'), mine && mine.ready ? 'Not ready' : "I'm ready");
      startBtn.hidden = !(r.isHost && between);
      setText(startBtn.querySelector('span'), rm.state === 'ended' ? 'Start a rematch' : 'Start the race');
      last.replaceChildren(...(rm.state === 'ended' && r.board.length ? [el('h2', { class: 'ts-race-h', text: 'Last race' }), boardList(r.board, me.id)] : []));
    }
    function update() {
      const want = inRoom() ? 'room' : 'form';
      if (want !== shown) {
        shown = want;
        body.replaceChildren(...(want === 'room' ? roomParts() : formParts()));
      }
      if (want === 'room') paintRoom();
      setText(h, want === 'room' && r.room ? `Room ${r.room.code}` : 'Race a friend');
      const words = raceWords(r.status, r.error);
      setText(line, r.status === 'lobby' && !r.isHost ? 'In the room. The host starts the race when everyone\'s in.'
        : r.status === 'lobby' ? 'You\'re the host: start the race when everyone\'s in (a race of one works too).' : words);
      line.dataset.tone = r.status === 'down' || r.status === 'closed' ? 'down' : '';
    }
    S.raceView = { el: node, update };
    update();
    return node;
  }
  // a race starts (once each): a run of its challenge (startRun: its countdown, then the run)
  function startRaceRun(g) {
    const r = S.race;
    const ch = challengeById(g.set.challenge);
    const key = `${r && r.room ? r.room.code : ''}:${g.race}`;
    if (!ch || S.raceStarted === key) {
      if (!ch) toast('This race is a challenge this page doesn\'t know yet: reload the page for the newest game.', 'down', 5000);
      return;
    }
    S.raceStarted = key;
    startRun({ kind: 'challenge', id: ch.id, race: g });
  }
  // its countdown screen, and the wait (on the relay's clock) until the race starts
  function raceGoScreen(g, t) {
    const ch = challengeById(g.set.challenge);
    return el('section', { class: 'ts-screen ts-loading ts-race-go', 'aria-busy': 'true', data: { race: '1' } },
      el('p', { class: 'ts-kicker', text: `Race · ${ch.name}` }),
      el('h1', { class: 'ts-h', text: 'Get ready' }),
      el('p', { class: 'ts-race-count', text: '…' }),
      el('p', { class: 'ts-lede', text: `${goalText(ch, t.currency, g.solUsd, { exactStart: true })} · ${timeText(ch.seconds)}. Everyone starts at the same moment, on the same market.` }),
      note());
  }
  function raceCountdown(tok) {
    return new Promise((resolve) => {
      const step = () => {
        const ms = tok === S.token && S.race ? S.race.startsIn() : 0;
        if (ms == null || ms <= 0) {
          resolve();
          return;
        }
        const n = root.querySelector('.ts-race-count');
        if (n) setText(n, String(Math.ceil(ms / 1000)));
        setTimeout(step, Math.min(200, ms));
      };
      step();
    });
  }

  // ---- a run ----
  function loadingScreen(t, live) {
    return el('section', { class: 'ts-screen ts-loading', 'aria-busy': 'true' },
      el('div', { class: 'ts-spin', 'aria-hidden': 'true' }),
      el('h1', { class: 'ts-h', text: `Opening ${t.name}…` }),
      el('p', { class: 'ts-lede', text: live ? `Connecting to the live feed for ${chainById(live).name}` : 'Filling the board with made-up coins' }));
  }
  // the live feed ready for a run (its chain's coins in, or it's quiet, down or full), at most `ms`
  function feedReady(feed, ms) {
    const ready = () => feed.status === 'down' || feed.status === 'full' || (feed.status === 'live'
      && (feed.coins().length > 0 || ['quiet', 'down', 'off'].includes(feed.chainState())));
    return new Promise((resolve) => {
      if (ready()) return resolve();
      let timer = 0;
      const off = feed.on(() => {
        if (!ready()) return;
        off();
        clearTimeout(timer);
        resolve();
      });
      timer = setTimeout(() => {
        off();
        resolve();
      }, ms);
      return undefined;
    });
  }
  async function startRun(setup, { replace = false } = {}) {
    const st = { ts: 'play' };
    if (replace) history.replaceState(st, '');
    else history.pushState(st, '');
    const tok = ++S.token;
    const t = terminal();
    S.save.chain = terminalLiveChain(t.id, S.save.chain);
    // (2026-10-22) a race room's race (./race.js `go`): its seed and SOL's price are the room's, simulated, never ranked
    const race = setup.race || null;
    const live = !race && liveRun(setup) ? S.save.chain : null;
    // (2026-10-22, the leaderboards) the daily market and the challenges, simulated, in SOL: ranked, with our server's
    // ticket (its seed and SOL's price); free play, Live mode and races never are
    const rankable = !race && !live && t.currency === 'sol' && (setup.kind === 'daily' || setup.kind === 'challenge');
    if (race) show(raceGoScreen(race, t), 'Get ready');
    else show(loadingScreen(t, live), `Opening ${t.name}`);
    let feed = null;
    if (live) {
      feed = liveFeed();
      feed.start(live);
    }
    const [price, , mount, got] = await Promise.all([race ? null : ensurePrice(), feed ? feedReady(feed, 5000) : null, boardFor(t),
      rankable ? askTicket({ kind: setup.kind, challenge: setup.kind === 'challenge' ? setup.id : null }) : null]);
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    if (tok !== S.token) return;
    if (!mount) {
      toast(`${t.name} didn't load: check your connection and try again.`, 'down', 4000);
      go(race ? 'race' : 'modes', {}, { replace: true });
      return;
    }
    // a race: everyone starts at the same moment
    if (race) await raceCountdown(tok);
    if (tok !== S.token) return;
    // ranked: its ticket (a daily market's for the same UTC day as the page's), else why not
    let ranked = race ? { why: 'race' } : setup.kind === 'free' ? { why: 'free' } : live ? { why: 'live' } : { why: 'off' };
    if (rankable && got) {
      if (!got.ticket) ranked = { why: got.why };
      else ranked = setup.kind === 'daily' && got.day !== setup.day ? { why: 'day' } : { ticket: got };
    }
    const tk = ranked.ticket || null;
    // SOL's price: a ranked run's ticket's; else the relay's when it has it (the same source, just now), else the game's own
    const px = tk ? tk.solUsd : feed && feed.px.sol > 0 ? Math.round(feed.px.sol * 100) / 100 : price && price.usd > 0 ? price.usd : 150;
    // its money: a live run's the chain's own coin (Pomp.fun's since 2026-10-21) at the relay's price, frozen for it
    const cur = live ? liveMoney(t.id, live, feed.px) : t.currency;
    if (cur === null) {
      go('brief', setup, { replace: true });
      toast(`${liveUnit(t)} price is not available yet. Please wait for the live feed.`, 'down', 4000);
      return;
    }
    // a live run: real coins, play money, the real clock
    const liveOpts = live ? { live, realTime: true, makeMarket: (o) => t.id === 'clank'
      ? createClankMarket({ ...o, feed, chain: 'robinhood' }) : createLiveMarket({ ...o, feed, chain: live }) } : {};
    let run;
    if (setup.kind === 'daily') {
      run = createRun({ seed: tk ? tk.seed : dailySeed(setup.day), challenge: dailyChallenge(setup.day), mode: 'daily', solUsd: px,
        currency: t.currency, terminal: t.id });
    } else if (setup.kind === 'challenge' && race) {
      run = createRun({ seed: race.seed, challenge: challengeById(setup.id), mode: 'challenge', solUsd: race.solUsd, currency: t.currency,
        terminal: t.id, realTime: true, exactStart: true });
    } else if (setup.kind === 'challenge') {
      const ch = challengeById(setup.id);
      run = createRun({ seed: tk ? tk.seed : `${ch.id}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`,
        challenge: ch, mode: 'challenge', solUsd: px, currency: cur, terminal: t.id, ...liveOpts });
    } else {
      run = createRun({ seed: `free-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`, mode: 'free',
        startSol: freeStartSol(S.save.freeStart, cur, px), speed: S.save.speed, solUsd: px, currency: cur, terminal: t.id, ...liveOpts });
    }
    try {
      Site.play();
    } catch {
      // a run is counted on a best-effort basis: the game never waits for it
    }
    mountPlay(run, setup, t, mount, ranked);
  }

  function mountPlay(run, setup, t, mount = mountBoard, ranked = null) {
    const compactHud = true;
    const cur = run.currency;
    const px = run.solUsd;
    const M = (x) => money(x, cur, px);
    const P = { run, setup, t, dead: false, raf: 0, lastTs: null, hudAt: 0, overAt: null, quick: false, userPaused: false,
      autoPaused: false, endLine: null, ranked };
    S.play = P;
    const voice = createVoice({ currency: cur, solUsd: px, live: Boolean(run.live),
      isReal: run.live ? (id) => run.market.isExt(id) : null });
    // the run's name is the page's one h1 while it's played (the board's own headings are h2)
    const name = el('h1', { class: 'ts-hud-name', text: run.challenge ? run.challenge.name : 'Free play' });
    const bar = el('div', { class: 'ts-bar', vars: { '--p': '0' } }, el('i'));
    const label = el('span', { class: 'ts-hud-label' });
    const time = el('span', { class: 'ts-hud-clock' });
    const worth = el('b', { class: 'ts-hud-worth' });
    const pnl = el('span', { class: 'ts-hud-pnl' });
    const soundBtn = el('button', { type: 'button', class: 'ts-ibtn', 'aria-label': 'Sound', 'aria-pressed': String(!sound.muted),
      on: { click: () => {
        sound.setMuted(!sound.muted);
        S.save.muted = sound.muted;
        save();
        soundBtn.replaceChildren(icon(sound.muted ? 'mute' : 'sound'));
        soundBtn.setAttribute('aria-pressed', String(!sound.muted));
      } } }, icon(sound.muted ? 'mute' : 'sound'));
    const speedBtn = run.mode === 'free' && !run.realTime ? el('button', { type: 'button', class: 'ts-ibtn ts-speed', 'aria-label': 'Speed',
      text: `${run.speed}×`, on: { click: () => {
        const i = SPEEDS.indexOf(run.speed);
        const next = SPEEDS[(i + 1) % SPEEDS.length];
        run.setSpeed(next);
        S.save.speed = next;
        save();
        setText(speedBtn, `${next}×`);
      } } }) : null;
    const endLabel = run.mode === 'free' ? 'Cash out' : 'End';
    const endSpan = el('span', { text: endLabel });
    let armed = 0;
    const endBtn = el('button', { type: 'button', class: 'ts-btn is-ghost ts-end', on: { click: () => {
      if (Date.now() - armed < 3000) return endNow();
      armed = Date.now();
      setText(endSpan, run.mode === 'free' ? 'Tap again to cash out' : 'Tap again to give up');
      setTimeout(() => {
        if (Date.now() - armed >= 2900) setText(endSpan, endLabel);
      }, 3050);
    } } }, endSpan);
    const agiHost = el('div', { class: 'ts-hud-agi' });
    // Live mode: a line under the HUD, always there (a stream's viewers see it): live on which chain, real coins, play
    // money; or, when the feed is down or the chain quiet, that in plain words (its dot says which)
    const liveWords = run.live ? el('span', { class: 'ts-live-words' }) : null;
    const liveStrip = run.live ? el('p', { class: 'ts-live-strip', role: 'status', 'aria-live': 'polite', data: { tone: 'wait' } },
      el('i', { 'aria-hidden': 'true' }), liveWords) : null;
    // a race (2026-10-22): the room's standings under the HUD, the top three and the player
    const raceStrip = setup.race ? el('p', { class: 'ts-race-strip', 'aria-label': 'The race' }) : null;
    const goal = el('div', { class: 'ts-hud-goal' }, name, run.mode === 'free' ? null : bar, label);
    const hud = el('header', { class: 'ts-hud' },
      el('button', { type: 'button', class: 'ts-ibtn', 'aria-label': 'Pause', on: { click: () => openPause() } }, icon('pause')),
      agiHost,
      goal,
      el('div', { class: 'ts-hud-time' }, icon('clock'), time),
      el('div', { class: 'ts-hud-money' }, worth, pnl),
      el('div', { class: 'ts-hud-tools' }, speedBtn, soundBtn, endBtn));
    if (compactHud) hud.append(liveStrip || el('p', { class: 'ts-live-strip', role: 'status' },
      el('span', {}, 'Simulated market · Play money only')));
    const boardHost = el('div', { class: 'ts-board-host' });
    const screen = el('section', { class: ['ts-screen', 'ts-play', compactHud && 'has-compact-hud', run.live && 'is-live'], data: setup.race ? { terminal: t.id, race: '1' } : { terminal: t.id } },
      hud, compactHud ? null : liveStrip, raceStrip, boardHost);
    show(screen, run.challenge ? run.challenge.name : 'Free play');
    paintTerminal(screen, t);
    P.agi = createAgi(agiHost, { reduceMotion: reduceMotion() });
    // her words: on a computer (1024 px and wider) in the HUD's goal cell, right beside her face, over the goal's own words
    // for a moment, never over the terminal; on a smaller screen under her face
    const wide = typeof matchMedia === 'function' ? matchMedia('(min-width: 1024px)') : null;
    const placeBubble = () => {
      const b = P.agi.bubble;
      const where = wide && wide.matches ? goal : P.agi.el;
      if (b.parentNode !== where) where.append(b);
    };
    placeBubble();
    if (wide) {
      wide.addEventListener('change', placeBubble);
      P.unwide = () => wide.removeEventListener('change', placeBubble);
    }
    const defined = (p) => Object.fromEntries(Object.entries(p || {}).filter(([, v]) => v !== undefined));
    P.board = mount(boardHost, {
      run, market: run.market, currency: cur, solUsd: px, start: run.start, colors: t.colors, reduceMotion: reduceMotion(),
      settings: () => ({ slippage: S.save.slippage, priority: S.save.priority }),
      order: (p) => run.order({ slippage: S.save.slippage, priority: S.save.priority, ...defined(p) }),
      launchCoin: (p) => {
        if (run.over) return { ok: false, error: 'over' };
        if (setup.kind !== 'free' || !run.market.canLaunchPractice) return { ok: false, error: 'free_only' };
        return run.market.launchCoin(p);
      },
      openSettings: () => openSettings({ pause: false }),
      openReplays: openReplayLibrary,
      // Display actual public quotes already received by the shared feed, without starting a new connection.
      spotPrices: () => S.feed?.px || {},
      spotPricesStatus: () => S.feed?.status || 'idle',
      // Live mode: polled chains start on their newest coins; the coin open is kept live for this player
      sort: run.live && run.live !== 'solana' ? 'new' : 'bump',
      onCoin: (id) => {
        if (typeof run.market.focus === 'function') run.market.focus(id);
      },
      pushSub: () => history.pushState({ ts: 'play', sub: true }, ''),
      popSub: () => {
        S.expectPop++;
        history.back();
      },
      // GNGM's own (2026-10-22): its presets, its chart's view, the player's name and its PnL cards
      terminal: t,
      chain: run.live || null,
      presets: () => ({ preset: S.save.preset, list: S.save.presets.map((p) => ({ ...p })) }),
      pickPreset,
      setPreset,
      chartView: () => ({ ...S.save.chart }),
      setChartView: (v) => {
        if (v && (v.mode === 'mcap' || v.mode === 'price')) S.save.chart.mode = v.mode;
        if (v && (v.unit === 'usd' || v.unit === 'coin')) S.save.chart.unit = v.unit;
        save();
      },
      playerName: () => S.name,
      setPlayerName,
      saveCard: (words, text) => gngmCard().then((card) => saveCanvas((g) => card.drawPnlCard(g, words, t.colors), { text }),
        () => toast("Couldn't make the card just now", 'down')),
    });

    function endNow() {
      if (run.over) return;
      P.quick = true;
      run.end();
    }
    P.endNow = endNow;

    function renderLive() {
      if (!run.live || typeof run.market.liveState !== 'function') return;
      const st = run.market.liveState();
      const w = terminalFeedWords(t.id, st.feed, st.chainState, st.chain, 'run');
      setText(liveWords, w.text);
      if (liveStrip.dataset.tone !== w.tone) liveStrip.dataset.tone = w.tone;
    }
    function paintRace() {
      if (!raceStrip) return;
      const r = S.race;
      if (!r || r.status === 'down' || r.status === 'closed' || r.status === 'idle') {
        setText(raceStrip, r ? raceWords(r.status, r.error) : 'The race room closed: your run goes on.');
        raceStrip.dataset.tone = 'down';
        return;
      }
      raceStrip.dataset.tone = '';
      const rows = r.board;
      const meId = r.me ? r.me.id : null;
      if (!rows.length) {
        setText(raceStrip, 'Race on: the standings come in a moment');
        return;
      }
      raceStrip.replaceChildren(...rows.map((row, i) => [row, i]).filter(([row, i]) => i < 3 || row.id === meId)
        .map(([row, i]) => el('span', { class: row.id === meId ? 'is-me' : '', text: standingText(row, i, { you: row.id === meId }) })));
    }
    P.paintRace = paintRace;
    function renderHud() {
      const h = run.hud();
      const p = run.progress();
      renderLive();
      // a race: how the run is going, to the room (at most once a second: ./race.js)
      if (setup.race && S.race && !run.over) S.race.report({ worth: h.worth, multiple: h.multiple, clock: h.clock });
      setText(worth, M(h.worth));
      setText(pnl, `${moneySigned(h.pnl, cur, px)} · ${times(h.multiple)}`);
      flag(pnl, 'is-up', h.pnl > 0);
      flag(pnl, 'is-down', h.pnl < 0);
      if (run.left === null) setText(time, clock(h.clock));
      else {
        setText(time, clock(run.left));
        flag(time, 'is-low', run.left <= 60);
      }
      if (p && p.frac != null) bar.style.setProperty('--p', String(Math.max(0, Math.min(1, p.frac))));
      setText(label, p && p.label ? p.label : '');
    }
    P.renderHud = renderHud;

    function react(events) {
      for (const e of events) {
        if (e.type === 'fill' && e.order) {
          const o = e.order;
          if (o.side === 'buy') {
            toast(`Bought ${tokens(o.tok)} $${o.ticker} for ${M(o.spent)}`, 'up');
            sound.play('buy');
          } else {
            toast(`Sold ${share(o.frac, 0)} of $${o.ticker} for ${M(o.got)} · ${moneySigned(e.pnl, cur, px)}`, e.pnl >= 0 ? 'up' : 'down');
            sound.play(e.pnl >= 0 ? 'win' : 'loss');
          }
        } else if (e.type === 'fail' && e.order) {
          const f = FAIL_WORDS[e.reason];
          toast(f ? f(e.order.ticker) : "That didn't go through", 'down');
          sound.play('fail');
        } else if (e.type === 'rug') {
          toast(`$${e.ticker} rugged`, 'down');
          sound.play('rug');
        } else if (e.type === 'milestone') {
          toast(`You're at ${times(e.x)} your start`, 'up');
          sound.play('milestone');
        } else if (e.type === 'countdown') sound.play('tick');
        else if (e.type === 'start') sound.play('go');
        else if (e.type === 'end') sound.play(e.outcome === 'won' ? 'won' : e.outcome === 'lost' || e.outcome === 'busted' ? 'lost' : 'won');
      }
      // real seconds, not the run's clock: at 4× she'd talk four times as often
      const v = voice.hear(events, performance.now() / 1000);
      if (v) {
        P.agi.say(v.text, v.mood);
        if (END_KEYS.has(v.key)) P.endLine = v;
      }
    }

    function loop(ts) {
      if (P.dead) return;
      P.raf = requestAnimationFrame(loop);
      const dt = P.lastTs == null ? 0 : (ts - P.lastTs) / 1000;
      P.lastTs = ts;
      if (!run.over) run.tick(dt);
      const ev = run.drain();
      if (ev.length) react(ev);
      if (ts - P.hudAt >= 100) {
        P.hudAt = ts;
        renderHud();
      }
      P.board.update(ts);
      if (run.over) {
        if (P.overAt == null) P.overAt = ts;
        if (ts - P.overAt >= (P.quick ? 250 : 1600)) finishRun();
      }
    }
    renderHud();
    paintRace();
    P.raf = requestAnimationFrame(loop);
  }

  function stopPlay() {
    const P = S.play;
    if (!P) return;
    P.dead = true;
    cancelAnimationFrame(P.raf);
    closeSheets();
    try {
      P.board.destroy();
    } catch {
      // nothing to keep
    }
    if (P.unwide) P.unwide();
    if (typeof P.run.market.destroy === 'function') P.run.market.destroy();
    P.agi.destroy();
    S.play = null;
  }
  function finishRun() {
    const P = S.play;
    if (!P || P.dead) return;
    const res = P.run.result();
    S.save = recordResult(S.save, res, { dailyKey: res.mode === 'daily' ? res.daily : null });
    save();
    S.last = { res, setup: P.setup, line: P.endLine, t: P.t, rank: null, replay: captureRunReplay(P.run) };
    S.last.replaySaved = S.last.replay ? recordings.save(S.last.replay, `${P.t.name} · ${modeLabel(res)}`) : null;
    // a race: how it ended, to the room (once); never ranked (`ranked`: { why: 'race' })
    if (P.setup.race && S.race) {
      S.race.finish({ worth: res.worth, multiple: res.multiple, clock: res.timeUsed, outcome: res.outcome, timeUsed: res.timeUsed });
    }
    // (2026-10-22) a ranked run: its orders to our server, which makes it again and ranks it; its line follows the answer
    const rk = P.ranked;
    // (a win ranks; on the daily market a run that didn't win too, unless its player ended it)
    const ranks = res.outcome === 'won' || (res.mode === 'daily' && (res.outcome === 'lost' || res.outcome === 'busted'));
    if (rk && rk.ticket && !ranks) S.last.rank = { why: 'not_ranked' };
    else if (rk && rk.ticket) {
      const last = S.last;
      last.rank = { state: 'pending' };
      sendScore(rk.ticket, res, P.run.market.log()).then((r) => {
        last.rank = r;
        if (S.last === last) paintRank();
      });
    } else if (rk && rk.why) S.last.rank = { why: rk.why };
    stopPlay();
    go('results', {}, { replace: true });
  }
  // the results' line about the leaderboards
  const boardName = (b) => {
    const m = /^c:([a-z0-9-]+):/.exec(b);
    const ch = m ? challengeById(m[1]) : null;
    return boardTitle('trenchingsimulator', b, ch ? ch.name : null);
  };
  function paintRank() {
    const n = root.querySelector('.ts-rank');
    if (n && S.last) setText(n, rankWords(S.last.rank, boardName));
  }

  // ---- sheets ----
  function closeSheets() {
    for (const d of document.querySelectorAll('dialog.ts-sheet[open], dialog.tsb-sheet[open], dialog.tsg-sheet[open]')) d.close();
  }
  function sheet(title, kids, { onClose } = {}) {
    if (introUp()) return null;
    const d = el('dialog', { class: 'ts-sheet', 'aria-label': title },
      el('div', { class: 'ts-sheet-head' }, el('h2', { text: title }),
        el('button', { type: 'button', class: 'ts-ibtn', 'aria-label': 'Close', on: { click: () => d.close() } }, icon('close'))),
      el('div', { class: 'ts-sheet-body' }, kids));
    d.addEventListener('close', () => {
      d.remove();
      if (onClose) onClose();
    });
    d.addEventListener('click', (e) => {
      if (e.target === d) d.close();
    });
    document.body.append(d);
    d.showModal();
    return d;
  }
  function openPause() {
    const P = S.play;
    if (!P || P.dead || P.run.over || document.querySelector('dialog.ts-sheet[open]')) return;
    P.run.pause();
    P.userPaused = true;
    let ending = 0;
    const real = P.run.realTime;
    const endSpan = el('span', { text: P.run.mode === 'free' ? 'Cash out and end' : 'End this run' });
    const d = sheet(real ? 'Menu' : 'Paused', [
      el('p', { class: 'ts-sheet-line', text: `${P.run.challenge ? `${P.run.challenge.name} · ${clock(P.run.left ?? 0)} left` : `Free play · ${clock(P.run.clock)}`}${real ? ' · live: the clock keeps going' : ''}` }),
      btn(real ? 'Back to the trenches' : 'Resume', { kind: 'primary', ic: 'play', on: () => d.close() }),
      btn('Settings', { ic: 'sliders', on: () => {
        d.close();
        openSettings({ pause: true });
      } }),
      btn('How to play', { ic: 'info', on: () => {
        d.close();
        openHow();
      } }),
      el('button', { type: 'button', class: 'ts-btn is-danger', on: { click: () => {
        if (Date.now() - ending < 3000) {
          d.close();
          P.endNow();
          return;
        }
        ending = Date.now();
        setText(endSpan, 'Tap again to end it');
      } } }, endSpan),
    ], { onClose: () => resumeIfMine() });
    if (!d) {
      // no sheet (the intro is still up): the run goes on as if nothing happened
      P.userPaused = false;
      P.run.resume();
    }
  }
  function resumeIfMine() {
    const P = S.play;
    if (!P || P.dead || document.querySelector('dialog.ts-sheet[open]')) return;
    if (P.userPaused && !document.hidden) {
      P.userPaused = false;
      P.lastTs = null;
      P.run.resume();
    }
  }
  function openSettings({ pause = false } = {}) {
    const P = S.play;
    // a priority fee in the run's money (SOL outside a run)
    const feeText = (fee) => (P && !P.dead ? money(fee, P.run.currency, P.run.solUsd) : `${fee} SOL`);
    const group = (label, list, value, text, pick) => el('div', { class: 'ts-chips', role: 'radiogroup', 'aria-label': label },
      el('span', { class: 'ts-chips-l', text: label }),
      list.map((v) => el('button', { type: 'button', role: 'radio', class: 'ts-chip', 'aria-checked': String(v === value),
        on: { click: (e) => {
          pick(v);
          save();
          for (const b of e.currentTarget.parentNode.querySelectorAll('.ts-chip')) b.setAttribute('aria-checked', String(b === e.currentTarget));
        } } }, text(v))));
    const d = sheet('Settings', [
      nameField(),
      group('Slippage', SLIPPAGES, S.save.slippage, (v) => share(v, 0), (v) => {
        S.save.slippage = v;
        S.save.presets[S.save.preset].slippage = v;
      }),
      el('p', { class: 'ts-sheet-note', text: 'How far the price may move before your trade lands. Higher fills more often, at a worse price.' }),
      group('Priority', PRIORITIES, S.save.priority, (k) => `${k} · ${feeText(PRIORITY[k].fee)} · ${PRIORITY[k].lo}–${PRIORITY[k].hi} s`, (k) => {
        S.save.priority = k;
        S.save.presets[S.save.preset].priority = k;
      }),
      el('p', { class: 'ts-sheet-note', text: 'A higher priority fee lands your trades sooner.' }),
      group('Sound', [false, true], S.save.muted, (m) => (m ? 'Off' : 'On'), (m) => {
        S.save.muted = m;
        sound.setMuted(m);
      }),
    ], { onClose: () => resumeIfMine() });
    // paused only once its sheet is open (none while the intro is up), so the run never stays paused behind nothing
    if (d && pause && P && !P.dead && !P.run.over) {
      P.run.pause();
      P.userPaused = true;
    }
  }
  function openHow() {
    sheet('How to play', howTo(), { onClose: () => resumeIfMine() });
  }

  // ---- results ----
  function openReplay(record = S.last?.replay) {
    // Event listeners pass an event; only an explicit recording replaces the last run.
    if (record && record.v !== 1) record = S.last?.replay;
    if (!record) return;
    const body = el('div', {}, el('p', { class: 'ts-sheet-note' }, 'Opening your recorded run…'));
    let view = null;
    const dialog = sheet('Replay your run', [body], { onClose: () => view?.destroy() });
    if (!dialog) return;
    dialog.classList.add('ts-replay-sheet');
    paintTerminal(dialog, terminalById(record.terminal));
    import('./replay.js').then(({ mountReplay }) => {
      if (!dialog.isConnected) return;
      body.replaceChildren();
      view = mountReplay(body,record);
    }, () => {
      if (dialog.isConnected) body.replaceChildren(el('p', { class: 'ts-sheet-note' }, 'Replay could not load. Close this window and try again.'));
    });
  }
  function exportReplay(record, name = 'current-run') {
    if (!record) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify({ format: 'phomo-recorded-run', v: 1, record })], { type: 'application/json' }));
    const safeName = String(name).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 99) || 'recorded-run';
    const link = el('a', { href: url, download: `phomo-replay-${safeName}.json` });
    try { document.body.append(link); link.click(); }
    finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  }
  function openReplayLibrary() {
    const body = el('div', { class: 'ts-replay-library' });
    const dialog = sheet('Saved replays', [el('p', { class: 'ts-sheet-note' },
      'Recent recordings stay in this browser. Up to eight runs are kept within the storage limit. Export a recording to keep a copy.'), body]);
    if (!dialog) return;
    function renderLibrary() {
      const rows = recordings.list();
      body.replaceChildren(...rows.map((row) => {
        const remove = btn('Remove', { kind: 'ghost', on: () => {
          if (remove.dataset.armed !== '1') { remove.dataset.armed = '1'; setText(remove, 'Confirm removal'); return; }
          if (recordings.remove(row.id)) renderLibrary(); else toast('This recording could not be removed.', 'down');
        } });
        return el('article', { class: 'ts-replay-library-row' },
          el('h3', {}, row.label), el('p', { class: 'ts-sheet-note' },
            `${new Date(row.at).toLocaleString()} · ${clock(row.duration)} · ${row.trades} filled trades · ${row.live ? 'Live recording' : 'Simulated'}`),
          el('div', { class: 'ts-actions' }, btn('Watch replay', { ic: 'play', on: () => { const r = recordings.get(row.id); dialog.close(); openReplay(r); } }),
            btn('Export recording', { ic: 'download', on: () => {
              const record = recordings.get(row.id); if (!record) return;
              exportReplay(record, row.id);
            } }), remove));
      }));
      if (!rows.length) body.append(el('p', { class: 'ts-sheet-note' }, 'Finish a run to save its replay here.'));
    }
    renderLibrary();
  }
  function resultsScreen() {
    const { res, setup, line, t } = S.last;
    const tone = resultTone(res);
    const sp = sparkPath(res.equity, { w: 600, h: 160, pad: 6, base: res.start });
    let chart = null;
    if (sp) {
      const s = svg('svg', { class: `ts-spark is-${sp.up ? 'up' : 'down'}`, viewBox: '0 0 600 160', role: 'img',
        'aria-label': `Your worth over the run: from ${money(res.start, res.currency, res.solUsd)} to ${money(res.worth, res.currency, res.solUsd)}` });
      s.append(svg('path', { class: 'ts-spark-area', d: sp.area }), svg('line', { class: 'ts-spark-base', x1: 6, x2: 594, y1: sp.baseY, y2: sp.baseY }),
        svg('path', { class: 'ts-spark-line', d: sp.d }));
      chart = s;
    }
    const agiHost = el('div', { class: 'ts-res-agi' });
    const text = shareText(res);
    const again = () => startRun(setup, { replace: true });
    // a race's results (2026-10-22): the room's standings, as the others finish too
    let raceRes = null;
    if (setup.race) {
      const state = el('p', { class: 'ts-race-state', role: 'status', 'aria-live': 'polite' });
      const list = el('div');
      raceRes = el('section', { class: 'ts-race-res', 'aria-label': 'The race' }, el('h2', { class: 'ts-race-h', text: 'The race' }), list, state);
      const paint = () => {
        const r = S.race;
        const rows = r ? r.board : [];
        list.replaceChildren(rows.length ? boardList(rows, r.me ? r.me.id : null) : el('p', { class: 'ts-race-note', text: 'The standings come in a moment.' }));
        setText(state, !r || r.status === 'idle' ? 'You left the room.' : r.status === 'ended' ? 'Everyone\'s done: the race is over.'
          : r.status === 'down' || r.status === 'closed' ? raceWords(r.status, r.error) : 'Waiting for the others to finish…');
      };
      S.raceBoard = { el: raceRes, paint };
      paint();
    }
    const node = el('section', { class: ['ts-screen', 'ts-results', `is-${tone}`], data: setup.race ? { race: '1' } : null },
      header(setup.race ? 'race' : setup.kind === 'challenge' ? 'challenges' : 'modes'),
      el('p', { class: 'ts-kicker', text: modeLabel(res) }),
      el('h1', { class: 'ts-res-title', text: resultTitle(res) }),
      res.outcome === 'won' && res.stars > 0 ? el('p', { class: 'ts-res-stars', 'aria-label': `${res.stars} of 3 stars`, text: starsRow(res.stars) }) : null,
      el('p', { class: 'ts-res-big', text: times(res.multiple) }),
      el('p', { class: 'ts-res-line', text: resultLine(res) }),
      el('p', { class: 'ts-rank', role: 'status', 'aria-live': 'polite', text: rankWords(S.last.rank, boardName) }),
      raceRes,
      chart,
      el('dl', { class: 'ts-res-stats' }, statLines(res).flatMap((s) => [el('dt', { text: s.label }),
        el('dd', { class: s.tone ? `is-${s.tone}` : '', text: s.value })])),
      agiHost,
      el('div', { class: 'ts-actions' },
        setup.race ? btn('Back to the room', { kind: 'primary', ic: 'users', on: () => go('race') })
          : btn('Play again', { kind: 'primary', ic: 'replay', on: again }),
        S.last.replay ? btn('Replay this run', { ic: 'play', on: openReplay }) : null,
        S.last.replay ? btn('Export this replay', { ic: 'download', on: () => exportReplay(S.last.replay, S.last.replaySaved?.id) }) : null,
        btn('Saved replays', { ic: 'replay', on: openReplayLibrary }),
        el('a', { class: 'ts-btn', href: shareLink(text), target: '_blank', rel: 'noopener noreferrer' }, icon('share'), el('span', { text: 'Share on X' })),
        btn('Save card', { ic: 'download', on: (e) => saveCard(res, t, e.currentTarget) }),
        setup.race ? btn('Leave the room', { kind: 'ghost', on: () => go('home') })
          : btn(setup.kind === 'challenge' ? 'Choose another' : 'Pick a mode', { kind: 'ghost', on: () => go(setup.kind === 'challenge' ? 'challenges' : 'modes') }),
        btn('Home', { kind: 'ghost', on: () => go('home') })),
      el('p', { class: 'ts-links' }, el('a', { href: '/games#rate-trenchingsimulator', text: 'Rate it' }), ' · ', el('a', { href: '/games', text: 'All games' })),
      S.last.replaySaved && !S.last.replaySaved.ok ? el('p', { class: 'ts-sheet-note' },
        'This replay is available until you leave this page. Browser storage could not keep this recording.') : null,
      note());
    queueMicrotask(() => {
      if (!root.contains(agiHost)) return;
      S.resAgi = createAgi(agiHost, { reduceMotion: reduceMotion(), ms: 600000 });
      const fallback = { text: res.outcome === 'won' ? 'you did it 💜' : 'the trenches are rough. again?', mood: res.outcome === 'won' ? 'celebrate' : 'sad' };
      const l = line || fallback;
      S.resAgi.say(l.text, l.mood);
    });
    return node;
  }

  // a run's card: GNGM's PnL card for a GNGM run (2026-10-22: ./boards/gngm-card.js), else the game's own
  async function saveCard(res, t, button) {
    const card = t.id === 'scan' ? await gngmCard().catch(() => null) : null;
    if (card) return saveCanvas((g) => card.drawPnlCard(g, card.runCardWords(res, { name: S.name }), t.colors), { text: shareText(res), button });
    return saveCanvas((g) => drawCard(g, res, t), { text: shareText(res), button });
  }
  // a 1200 × 630 picture: drawn by `draw`, then shared (a phone's share sheet) or downloaded
  async function saveCanvas(draw, { text = '', button = null } = {}) {
    if (button) button.disabled = true;
    try {
      try {
        await Promise.all(['800 120px Anybody', '600 40px Geist', '500 28px "Geist Mono"'].map((f) => document.fonts.load(f)));
      } catch {
        // the fonts' fallbacks draw it
      }
      const c = document.createElement('canvas');
      c.width = CARD_W;
      c.height = CARD_H;
      draw(c.getContext('2d'));
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      if (!blob) throw new Error('no picture');
      const file = new File([blob], `trenching-simulator-${Date.now()}.png`, { type: 'image/png' });
      if (matchMedia('(pointer: coarse)').matches && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text });
          return;
        } catch (err) {
          if (err && err.name === 'AbortError') return;
        }
      }
      const url = URL.createObjectURL(blob);
      const a = el('a', { href: url, download: file.name });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      toast('Card saved', 'up');
    } catch {
      toast("Couldn't make the card just now", 'down');
    } finally {
      if (button) button.disabled = false;
    }
  }
  // the game's own card (Pomp.fun's): its title, its multiple, its line, its stars, its worth as a line, AGI-1's face
  function drawCard(g, res, t) {
    const W = CARD_W;
    const H = CARD_H;
    const col = t.colors;
    const words = cardText(res);
    g.fillStyle = col.bg;
    g.fillRect(0, 0, W, H);
    g.fillStyle = col.panel;
    g.fillRect(40, 40, W - 80, H - 80);
    g.strokeStyle = col.line;
    g.lineWidth = 2;
    g.strokeRect(40, 40, W - 80, H - 80);
    const tone = words.tone === 'up' ? col.up : col.down;
    g.textBaseline = 'alphabetic';
    g.fillStyle = col.muted;
    g.font = '500 26px "Geist Mono", monospace';
    g.fillText(words.kicker.toUpperCase().slice(0, 64), 90, 120);
    g.fillStyle = tone;
    g.font = '700 54px Geist, sans-serif';
    g.fillText(words.title, 90, 190);
    g.fillStyle = col.text;
    g.font = '800 150px Anybody, Geist, sans-serif';
    g.fillText(words.big, 86, 345);
    g.font = '600 38px Geist, sans-serif';
    g.fillText(words.line, 90, 405);
    g.fillStyle = col.muted;
    g.font = '500 30px "Geist Mono", monospace';
    g.fillText(words.sub, 90, 450);
    if (words.stars) {
      g.fillStyle = col.accent;
      g.font = '700 46px Geist, sans-serif';
      g.fillText(words.stars, 90, 512);
    }
    const sp = sparkPath(res.equity, { w: 520, h: 150, pad: 6, base: res.start });
    if (sp) {
      g.save();
      g.translate(600, 300);
      g.strokeStyle = col.line;
      g.setLineDash([6, 6]);
      g.beginPath();
      g.moveTo(6, sp.baseY);
      g.lineTo(514, sp.baseY);
      g.stroke();
      g.setLineDash([]);
      g.strokeStyle = sp.up ? col.up : col.down;
      g.lineWidth = 4;
      g.lineJoin = 'round';
      g.stroke(new Path2D(sp.d));
      g.restore();
    }
    const px = 8;
    for (const [x, y, colr] of facePixels(res.outcome === 'won' ? 'celebrate' : 'neutral')) {
      g.fillStyle = colr;
      g.fillRect(W - 90 - 25 * px + x * px, 70 + y * px, px, px);
    }
    g.fillStyle = col.muted;
    g.font = '500 24px "Geist Mono", monospace';
    g.fillText(words.foot, 90, H - 70);
  }

  // ---- the page around it ----
  addEventListener('popstate', (e) => {
    if (S.expectPop > 0) {
      S.expectPop--;
      return;
    }
    const st = e.state && typeof e.state === 'object' ? e.state : { ts: 'home' };
    const P = S.play;
    if (P && !P.dead) {
      if (P.board.sub()) {
        P.board.closeSub();
        return;
      }
      closeSheets();
      history.pushState({ ts: 'play' }, '');
      openPause();
      return;
    }
    if (st.ts === 'play' || (st.ts === 'results' && !S.last)) {
      if (S.last && S.last.setup.race) go('race', {}, { replace: true });
      else if (S.last) go('brief', S.last.setup.kind === 'challenge' ? { kind: 'challenge', id: S.last.setup.id } : { kind: S.last.setup.kind }, { replace: true });
      else go('modes', {}, { replace: true });
      return;
    }
    render(st);
  });
  document.addEventListener('visibilitychange', () => {
    const P = S.play;
    if (!P || P.dead || P.run.over || P.run.realTime) return;
    if (document.hidden) {
      if (!P.run.paused) {
        P.run.pause();
        P.autoPaused = true;
      }
    } else if (P.autoPaused) {
      P.autoPaused = false;
      P.lastTs = null;
      if (!P.userPaused) P.run.resume();
    }
  });
  addEventListener('keydown', (e) => {
    const P = S.play;
    if (e.key !== 'Escape' || !P || P.dead || e.defaultPrevented) return;
    if (document.querySelector('dialog[open]')) return;
    e.preventDefault();
    if (P.board.sub()) history.back();
    else openPause();
  });

  // an invite link (#room=<code>): its room's screen, the code filled in; the code taken out of the address (it's the
  // page's own, never sent anywhere but to our relay, once the player joins)
  const invite = () => {
    const code = roomOfHash(location.hash);
    if (!code) return false;
    history.replaceState(history.state, '', `${location.pathname}${location.search}`);
    if (S.play && !S.play.dead) return true;
    go('race', { code }, { replace: true });
    return true;
  };
  addEventListener('hashchange', invite);
  const st0 = history.state;
  if (invite()) {
    // its room's screen is up
  } else if (st0 && typeof st0 === 'object' && KNOWN.has(st0.ts)) render(st0);
  else go('home', {}, { replace: true });
  ensurePrice();
}
