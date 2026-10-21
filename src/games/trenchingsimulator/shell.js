// TRENCHING SIMULATOR's screens (2026-10-20): home, the terminals, the modes, the challenges, a run's brief, the run
// itself (its HUD over a terminal, the market moved on every frame, AGI-1 reacting) and its results (a share card drawn
// on a canvas). Each screen has its own place in the browser's history, so Back works the way people expect: Back in a
// run asks first (the pause sheet). Every node is made with createElement and its words set as text; styles only
// through classes and the CSS object model (the site's CSP allows no style attributes).
//
// Live mode (2026-10-21, #404): a Market switch on the modes screen (Simulated, the default, or Live coins) and a chain
// (Solana, Robinhood Chain, BNB Chain, Base). While it's on, one connection to our relay (./live-feed.js) says how the
// live feed is doing, in plain words; a run in it trades real coins with play money (./live-market.js) on a clock that
// never stops, and falls back to simulated stand-ins, saying so, whenever the feed is down or the chain is quiet with too
// few real coins (./live-chains.js: playState; a quiet chain with enough plays its real coins alone, since 2026-10-21).
// The daily market and the challenge that ends on a rug stay simulated.
import { el, setText, flag, icon, toast, clearToasts, paintTerminal } from './ui.js';
import { TERMINALS, terminalById, SAFETY_NOTE } from './terminals.js';
import { CHALLENGES, TIERS, challengeById, FREE_STARTS, SPEEDS, goalText, timeText, startText, freeStartSol, dailyKey, dailySeed,
  dailyChallenge } from './challenges.js';
import { createRun } from './run.js';
import { loadSave, writeSave, recordResult, starsTotal, SLIPPAGES, PRIORITIES } from './save.js';
import { getSolPrice } from './solprice.js';
import { createSound } from './sound.js';
import { createVoice } from './lines.js';
import { createAgi, facePixels } from './agi.js';
import { PRIORITY } from './engine.js';
import { mountBoard } from './boards/board.js';
import { Site } from './site.js';
import { shareText, shareLink, GAME_NAME } from './share.js';
import { money, moneySigned, clock, share, times, tokens, usd, unitOf, isCoinCurrency } from './format.js';
import { resultTitle, resultTone, resultLine, statLines, starsRow, sparkPath, cardText, modeLabel } from './results.js';
import { CHAINS, chainById, feedWords, liveOk, liveCurrency, UNIT_NAMES, relayUrl, liveOpen, LIVE_NOTE, LIVE_SOON,
  LIVE_SOON_HOW, playState, liveMoney } from './live-chains.js';
import { createLiveFeed } from './live-feed.js';
import { createLiveMarket } from './live-market.js';

const NS = 'http://www.w3.org/2000/svg';
const KNOWN = new Set(['home', 'terminals', 'modes', 'challenges', 'brief']);
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
    token: 0, resAgi: null, feed: null, offFeed: null };
  // Live mode: open on the site since its relay runs (2026-10-21; ./live-chains.js: LIVE_OPEN). Closed ("coming soon",
  // as it was until then), every run is simulated, whatever this browser kept from a try
  const LIVE = liveOpen(location);
  if (!LIVE) S.save.live = false;
  const sound = createSound({ muted: S.save.muted });
  const unlock = () => sound.unlock();
  addEventListener('pointerdown', unlock, { once: true, capture: true });
  addEventListener('keydown', unlock, { once: true, capture: true });

  const save = () => writeSave(store, S.save);
  // ---- Live mode ----
  // the one connection to the relay, made the first time Live mode is used, open only while it's on
  const liveFeed = () => {
    if (!S.feed) S.feed = createLiveFeed({ url: relayUrl(location) });
    return S.feed;
  };
  const chainNow = () => chainById(S.save.chain) || CHAINS[0];
  // a run with this setup is a live one (the daily market and a challenge that ends on a rug never are)
  const liveRun = (setup) => S.save.live && setup.kind !== 'daily'
    && (setup.kind !== 'challenge' || liveOk(challengeById(setup.id)));
  // a screen's line about the feed, kept up to date while the screen is up (`also`: the screen's own, on each change)
  function feedLine(when = 'before', also = null) {
    const line = el('p', { class: 'ts-live-state', role: 'status', 'aria-live': 'polite' });
    const paint = () => {
      const f = liveFeed();
      const liveCoins = f.chain === S.save.chain ? f.coins().filter((c) => c.tracked).length : 0;
      const w = feedWords(f.status, playState(f.chainState(S.save.chain), liveCoins), S.save.chain, when);
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
      el('span', { class: 'ts-brand', text: GAME_NAME }));
  }
  const note = () => el('p', { class: 'ts-note' }, icon('info'), el('span', { text: `${SAFETY_NOTE} Not financial advice.` }));

  function homeScreen() {
    const st = S.save.stats;
    const day = today();
    const dch = dailyChallenge(day);
    const dd = S.save.daily[day];
    const stat = (v, l) => el('div', { class: 'ts-stat' }, el('b', { text: v }), el('span', { text: l }));
    return el('section', { class: 'ts-screen ts-home' },
      header('games'),
      el('p', { class: 'ts-kicker', text: 'AGI GAMES · BETA' }),
      el('h1', { class: 'ts-title', text: 'TRENCHING SIMULATOR' }),
      el('p', { class: 'ts-lede', text: 'Trade made-up coins with play money on the terminals you know. Ape in early, sell the top, dodge the rugs.' }),
      el('div', { class: 'ts-actions' },
        btn('Play', { kind: 'primary', ic: 'play', on: () => go('terminals') }),
        btn(dd && dd.won ? `Daily market · won ${starsRow(dd.stars)}` : `Daily market · ${dch.name}`,
          { ic: 'flame', on: () => go('brief', { kind: 'daily' }) })),
      el('div', { class: 'ts-stats' }, stat(String(st.runs), 'runs'), stat(String(st.wins), 'wins'),
        stat(`${starsTotal(S.save)}/${STARS_MAX}`, 'stars'), stat(st.bestX > 0 ? times(st.bestX) : '—', 'best')),
      el('p', { class: 'ts-soon' }, icon('users'), el('span', { text: 'Multiplayer · coming soon' })),
      el('details', { class: 'ts-how' }, el('summary', { text: 'How to play' }), ...howTo()),
      note(),
      el('p', { class: 'ts-links' }, el('a', { href: '/games#rate-trenchingsimulator', text: 'Rate it' }), ' · ',
        el('a', { href: '/games', text: 'All games' })));
  }
  function howTo() {
    return [
      el('p', { text: 'Pick a terminal, then a challenge, the daily market or free play. You get play money, and a market full of made-up coins: new ones launch every few seconds, most of them die, a few run.' }),
      el('p', { text: 'Buy a coin, watch its chart and its holders, and sell before it dumps. Every trade pays a small fee and lands a moment later (faster with a higher priority); if the price moves past your slippage, it fails.' }),
      el('p', { text: 'Rugs, dev sells and migrations happen. Challenges have a goal and a clock; free play has neither. Nothing here is real money, and nothing here is advice.' }),
      el('p', { text: LIVE ? 'Live mode (on the modes screen): real new coins as they launch, on Solana, Robinhood Chain, BNB Chain or Base, with the names and pictures their makers gave them. You still trade them with play money only: nothing is ever bought or sold for real.'
        : LIVE_SOON_HOW }),
    ];
  }

  function terminalsScreen() {
    const cur = terminal();
    const cards = TERMINALS.map((t) => {
      const card = el('article', { class: ['ts-term', t.ready ? '' : 'is-soon', t.id === cur.id && 'is-on'] },
        el('h2', { class: 'ts-term-name', text: t.name }),
        el('p', { class: 'ts-term-tag', text: t.tagline }),
        el('ul', { class: 'ts-term-feats' }, t.features.map((f) => el('li', { text: f }))),
        el('p', { class: 'ts-term-cur', text: S.save.live ? `Live: play money in ${UNIT_NAMES[liveCurrency(t.id, S.save.chain)]}`
          : t.currency === 'usd' ? 'Play money in dollars' : 'Play money in SOL' }),
        t.ready
          ? btn(`Play on ${t.name}`, { kind: 'primary', ic: 'play', on: () => {
            S.save.terminal = t.id;
            save();
            go('modes');
          } })
          : btn('Coming soon', { ic: 'lock', disabled: true }));
      paintTerminal(card, t);
      return card;
    });
    return el('section', { class: 'ts-screen ts-terminals' }, header('home'),
      el('h1', { class: 'ts-h', text: 'Pick your terminal' }),
      el('p', { class: 'ts-lede', text: 'Laid out the way you know them, with our own names. More are on the way.' }),
      el('div', { class: 'ts-terms' }, cards), note());
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
        radio('Chain', CHAINS.map((c) => [c.id, c.name]), S.save.chain, (v) => {
          if (v === S.save.chain) return;
          S.save.chain = v;
          save();
          liveFeed().setChain(v);
          again(`.ts-market [data-v="${v}"]`);
        }, 'ts-market-chain'),
        feedLine('before', onNews),
        el('p', { class: 'ts-live-about', text: LIVE_NOTE }),
      ] : LIVE ? null : el('p', { class: 'ts-live-about', text: LIVE_SOON }));
  }

  function modesScreen() {
    const day = today();
    const dch = dailyChallenge(day);
    const dd = S.save.daily[day];
    const t = terminal();
    const live = S.save.live;
    const card = (title, line, sub, onClick, ic) => el('button', { type: 'button', class: 'ts-mode', on: { click: onClick } },
      icon(ic), el('b', { text: title }), el('span', { text: line }), sub ? el('small', { text: sub }) : null);
    // Free play's starts in the run's money (a live run's coin once the relay's price for it is in)
    const freeSub = () => `Start with ${startsText(live ? runCur(t, true) : t.currency)}`;
    let freeCard = null;
    const onNews = () => {
      const sm = freeCard && freeCard.querySelector('small');
      if (sm && sm.textContent !== freeSub()) setText(sm, freeSub());
    };
    return el('section', { class: 'ts-screen ts-modes' }, header('terminals'),
      el('p', { class: 'ts-kicker', text: t.name }),
      el('h1', { class: 'ts-h', text: 'Pick a mode' }),
      marketPicker(onNews),
      el('div', { class: 'ts-mode-list' },
        card('Daily market', `${dch.name}: ${goalText(dch, t.currency, priceUsd())}`,
          live ? 'Always simulated: the same coins for everyone today'
            : dd ? (dd.won ? `Won today ${starsRow(dd.stars)}` : `${dd.tries} ${dd.tries === 1 ? 'try' : 'tries'} today`)
              : 'The same market for everyone today', () => go('brief', { kind: 'daily' }), 'flame'),
        card('Challenges', live ? `${CHALLENGES.length} goals against a clock that never stops` : `${CHALLENGES.length} goals against the clock`,
          live ? `${starsTotal(S.save, { live: true })} of ${STARS_MAX} ★ in Live mode` : `${starsTotal(S.save)} of ${STARS_MAX} ★`,
          () => go('challenges'), 'trophy'),
        freeCard = card('Free play', live ? `Real ${chainNow().name} coins as they come. No clock and no goal.`
          : 'No clock and no goal. Trade as long as you like.', freeSub(), () => go('brief', { kind: 'free' }), 'chart')),
      note());
  }

  function challengesScreen() {
    const t = terminal();
    const live = S.save.live;
    // a challenge's money: in Live mode the chain's own coin, where it plays live
    const chCur = (c) => (live && liveOk(c) ? runCur(t, true) : t.currency);
    const groups = TIERS.map((tier) => {
      const list = CHALLENGES.filter((c) => c.tier === tier);
      if (!list.length) return null;
      return el('div', { class: 'ts-tier' },
        el('h2', { class: 'ts-tier-h', text: TIER_NAMES[tier] || tier }),
        list.map((c) => {
          const b = live && liveOk(c) ? S.save.liveBest[c.id] : S.save.best[c.id];
          return el('button', { type: 'button', class: ['ts-ch', b && b.stars > 0 && 'is-done'], data: { tier: c.tier },
            on: { click: () => go('brief', { kind: 'challenge', id: c.id }) } },
          el('b', { class: 'ts-ch-name', text: c.name }),
          el('span', { class: 'ts-ch-goal', text: goalText(c, chCur(c), priceUsd()) }),
          el('span', { class: 'ts-ch-meta', text: `${timeText(c.seconds)} · start ${startText(c, chCur(c), priceUsd())}${live && !liveOk(c) ? ' · simulated in Live mode' : ''}` }),
          el('span', { class: 'ts-ch-best', text: b && b.stars > 0
            ? `${starsRow(b.stars)}${b.time != null ? ` · best ${clock(b.time)}` : ''}` : starsRow(0) }));
        }));
    });
    return el('section', { class: 'ts-screen ts-challenges' }, header('modes'),
      el('h1', { class: 'ts-h', text: 'Challenges' }),
      el('p', { class: 'ts-lede', text: live
        ? `Live mode: real ${chainNow().name} coins on a clock that never stops, not even for the menu. Its stars are kept apart from the simulated ones. Rug dodger stays simulated: a real coin is never called a rug here.`
        : 'Win to earn up to 3 stars: faster wins and bigger multiples earn more.' }),
      groups, note());
  }
  const priceUsd = () => (S.price && S.price.usd > 0 ? S.price.usd : 150);
  // a live run's money (Trench Board's: the chain's own coin since 2026-10-21, ./live-chains.js liveMoney) at the relay's
  // prices; a simulated run's, the terminal's own
  const runCur = (t, live) => (live ? liveMoney(t.id, S.save.chain, liveFeed().px) : t.currency);
  // Free play's starts in a run's money: "1, 5, 10, 50 SOL", "0.04, 0.2, 0.4, 2 ETH"
  const startsText = (cur) => {
    const px = priceUsd();
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
    const priceLine = el('p', { class: 'ts-price', text: 'SOL price: checking…' });
    // the run's money (a live run's: the chain's own coin once the relay's price for it is in)
    const cur = () => (live ? runCur(t, true) : t.currency);
    const chipTexts = [];
    const fill = () => {
      const px = priceUsd();
      const c = cur();
      const rows = ch
        ? [['Goal', goalText(ch, c, px)], ['Time', timeText(ch.seconds)], ['Start', startText(ch, c, px)]]
        : [['Goal', 'None: trade as long as you like'], ['Time', 'No clock'],
          ['Start', money(freeStartSol(S.save.freeStart, c, px), c, px)]];
      rows.push(['On', t.name]);
      if (S.save.live) {
        rows.push(['Market', live ? `Live coins · ${chainNow().name}` : setup.kind === 'daily' ? 'Simulated: the same coins for everyone today'
          : 'Simulated: a real coin is never called a rug here']);
      }
      facts.replaceChildren(...rows.flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: v })]));
      const src = S.price ? S.price.source : '';
      const coin = isCoinCurrency(c) ? `${unitOf(c, px).name} ${usd(c.usd)} · ` : '';
      setText(priceLine, `${coin}SOL ${usd(px)} ${src === 'live' ? '· live' : src === 'saved' ? '· last known' : '· a stand-in price'}, frozen for this run`);
      for (const [b, v, text] of chipTexts) setText(b, text(v));
    };
    // (the coin's price comes with the feed: once it's in, or it moves, the words follow)
    let curKey = JSON.stringify(cur());
    const onFeedNews = () => {
      const k = JSON.stringify(cur());
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
        const b = el('button', { type: 'button', role: 'radio', class: 'ts-chip', 'aria-checked': String(v === value),
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
    return el('section', { class: 'ts-screen ts-brief' }, header(setup.kind === 'challenge' ? 'challenges' : 'modes'),
      el('p', { class: 'ts-kicker', text: setup.kind === 'daily' ? `Daily market · ${setup.day}`
        : ch ? `Challenge · ${TIER_NAMES[ch.tier] || ch.tier}` : 'Free play' }),
      el('h1', { class: 'ts-h', text: ch ? ch.name : 'Free play' }),
      el('p', { class: 'ts-lede', text: ch ? ch.blurb : live ? 'Real coins as they come, traded with play money. No clock and no goal: cash out whenever you like.'
        : 'Your own market, no clock and no goal. Cash out whenever you like.' }),
      facts,
      setup.kind === 'free' ? [
        chips('Start with', FREE_STARTS, S.save.freeStart, (v) => money(freeStartSol(v, cur(), priceUsd()), cur(), priceUsd()), (v) => {
          S.save.freeStart = v;
          save();
        }),
        live ? null : chips('Speed', SPEEDS, S.save.speed, (v) => `${v}×`, (v) => {
          S.save.speed = v;
          save();
        }),
      ] : null,
      live ? [feedLine('before', onFeedNews), el('p', { class: 'ts-live-about', text: `${LIVE_NOTE} The clock never stops in Live mode, not even for the menu.` })] : null,
      best && best.stars > 0 ? el('p', { class: 'ts-best', text: `Your best: ${starsRow(best.stars)}${best.time != null ? ` · ${clock(best.time)}` : ''}` }) : null,
      dd ? el('p', { class: 'ts-best', text: dd.won ? `Won today ${starsRow(dd.stars)}` : `${dd.tries} ${dd.tries === 1 ? 'try' : 'tries'} today` }) : null,
      priceLine,
      el('div', { class: 'ts-actions' },
        btn('Start', { kind: 'primary', ic: 'play', on: () => startRun(setup) }),
        btn('Back', { kind: 'ghost', on: () => back(setup.kind === 'challenge' ? 'challenges' : 'modes') })),
      note());
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
    const live = liveRun(setup) ? S.save.chain : null;
    show(loadingScreen(t, live), `Opening ${t.name}`);
    let feed = null;
    if (live) {
      feed = liveFeed();
      feed.start(live);
    }
    const [price] = await Promise.all([ensurePrice(), feed ? feedReady(feed, 5000) : null]);
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    if (tok !== S.token) return;
    // SOL's price: the relay's when it has it (the same source, just now), else the game's own
    const px = feed && feed.px.sol > 0 ? Math.round(feed.px.sol * 100) / 100 : price && price.usd > 0 ? price.usd : 150;
    // its money: a live run's the chain's own coin (Trench Board's since 2026-10-21) at the relay's price, frozen for it
    const cur = live ? liveMoney(t.id, live, feed.px) : t.currency;
    // a live run: real coins, play money, the real clock
    const liveOpts = live ? { live, realTime: true, makeMarket: (o) => createLiveMarket({ ...o, feed, chain: live }) } : {};
    let run;
    if (setup.kind === 'daily') {
      run = createRun({ seed: dailySeed(setup.day), challenge: dailyChallenge(setup.day), mode: 'daily', solUsd: px,
        currency: t.currency, terminal: t.id });
    } else if (setup.kind === 'challenge') {
      const ch = challengeById(setup.id);
      run = createRun({ seed: `${ch.id}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`,
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
    mountPlay(run, setup, t);
  }

  function mountPlay(run, setup, t) {
    const cur = run.currency;
    const px = run.solUsd;
    const M = (x) => money(x, cur, px);
    const P = { run, setup, t, dead: false, raf: 0, lastTs: null, hudAt: 0, overAt: null, quick: false, userPaused: false,
      autoPaused: false, endLine: null };
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
    const goal = el('div', { class: 'ts-hud-goal' }, name, run.mode === 'free' ? null : bar, label);
    const hud = el('header', { class: 'ts-hud' },
      el('button', { type: 'button', class: 'ts-ibtn', 'aria-label': 'Pause', on: { click: () => openPause() } }, icon('pause')),
      agiHost,
      goal,
      el('div', { class: 'ts-hud-time' }, icon('clock'), time),
      el('div', { class: 'ts-hud-money' }, worth, pnl),
      el('div', { class: 'ts-hud-tools' }, speedBtn, soundBtn, endBtn));
    const boardHost = el('div', { class: 'ts-board-host' });
    const screen = el('section', { class: ['ts-screen', 'ts-play', run.live && 'is-live'], data: { terminal: t.id } }, hud, liveStrip, boardHost);
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
    P.board = mountBoard(boardHost, {
      run, market: run.market, currency: cur, solUsd: px, start: run.start, colors: t.colors, reduceMotion: reduceMotion(),
      settings: () => ({ slippage: S.save.slippage, priority: S.save.priority }),
      order: (p) => run.order({ slippage: S.save.slippage, priority: S.save.priority, ...defined(p) }),
      openSettings: () => openSettings({ pause: false }),
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
      const w = feedWords(st.feed, st.chainState, st.chain, 'run');
      const c = chainById(run.live);
      setText(liveWords, w.tone === 'live' ? `Live · ${c.name} · real coins${c.src && c.allFrom ? ` from ${c.src}` : ''} · play money only` : w.text);
      if (liveStrip.dataset.tone !== w.tone) liveStrip.dataset.tone = w.tone;
    }
    function renderHud() {
      const h = run.hud();
      const p = run.progress();
      renderLive();
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
    S.last = { res, setup: P.setup, line: P.endLine, t: P.t };
    stopPlay();
    go('results', {}, { replace: true });
  }

  // ---- sheets ----
  function closeSheets() {
    for (const d of document.querySelectorAll('dialog.ts-sheet[open], dialog.tsb-sheet[open]')) d.close();
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
      group('Slippage', SLIPPAGES, S.save.slippage, (v) => share(v, 0), (v) => {
        S.save.slippage = v;
      }),
      el('p', { class: 'ts-sheet-note', text: 'How far the price may move before your trade lands. Higher fills more often, at a worse price.' }),
      group('Priority', PRIORITIES, S.save.priority, (k) => `${k} · ${feeText(PRIORITY[k].fee)} · ${PRIORITY[k].lo}–${PRIORITY[k].hi} s`, (k) => {
        S.save.priority = k;
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
    const node = el('section', { class: ['ts-screen', 'ts-results', `is-${tone}`] },
      header(setup.kind === 'challenge' ? 'challenges' : 'modes'),
      el('p', { class: 'ts-kicker', text: modeLabel(res) }),
      el('h1', { class: 'ts-res-title', text: resultTitle(res) }),
      res.outcome === 'won' && res.stars > 0 ? el('p', { class: 'ts-res-stars', 'aria-label': `${res.stars} of 3 stars`, text: starsRow(res.stars) }) : null,
      el('p', { class: 'ts-res-big', text: times(res.multiple) }),
      el('p', { class: 'ts-res-line', text: resultLine(res) }),
      chart,
      el('dl', { class: 'ts-res-stats' }, statLines(res).flatMap((s) => [el('dt', { text: s.label }),
        el('dd', { class: s.tone ? `is-${s.tone}` : '', text: s.value })])),
      agiHost,
      el('div', { class: 'ts-actions' },
        btn('Play again', { kind: 'primary', ic: 'replay', on: again }),
        el('a', { class: 'ts-btn', href: shareLink(text), target: '_blank', rel: 'noopener noreferrer' }, icon('share'), el('span', { text: 'Share on X' })),
        btn('Save card', { ic: 'download', on: (e) => saveCard(res, t, e.currentTarget) }),
        btn(setup.kind === 'challenge' ? 'Choose another' : 'Pick a mode', { kind: 'ghost', on: () => go(setup.kind === 'challenge' ? 'challenges' : 'modes') }),
        btn('Home', { kind: 'ghost', on: () => go('home') })),
      el('p', { class: 'ts-links' }, el('a', { href: '/games#rate-trenchingsimulator', text: 'Rate it' }), ' · ', el('a', { href: '/games', text: 'All games' })),
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

  async function saveCard(res, t, button) {
    if (button) button.disabled = true;
    try {
      try {
        await Promise.all(['800 120px Anybody', '600 40px Geist', '500 28px "Geist Mono"'].map((f) => document.fonts.load(f)));
      } catch {
        // the fonts' fallbacks draw it
      }
      const W = 1200;
      const H = 630;
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const g = c.getContext('2d');
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
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      if (!blob) throw new Error('no picture');
      const file = new File([blob], `trenching-simulator-${Date.now()}.png`, { type: 'image/png' });
      if (matchMedia('(pointer: coarse)').matches && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text: shareText(res) });
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
      if (S.last) go('brief', S.last.setup.kind === 'challenge' ? { kind: 'challenge', id: S.last.setup.id } : { kind: S.last.setup.kind }, { replace: true });
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

  const st0 = history.state;
  if (st0 && typeof st0 === 'object' && KNOWN.has(st0.ts)) render(st0);
  else go('home', {}, { replace: true });
  ensurePrice();
}
