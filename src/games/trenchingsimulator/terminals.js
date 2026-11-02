// TRENCHING SIMULATOR's five terminals (2026-10-20): each laid out and working the way trenchers know the real ones
// (the owner: "our players are real trenches"). Since 2026-10-21 under parody names (the owner: "use a parody names,
// parody logo, parody branding of that terminal … for each terminal", then "Sound-alikes"): GNGM, Pomp.fun, Axium,
// BasedBott and Phomo, each with its own mark drawn in code (brands.js: never a real terminal's logo or art), its own
// colors and words; never a real terminal's name ("Fomoo" is a known drainer site and a live coin: so Phomo). Names are
// text only, never a link. The order is the owner's list. `currency` is the money its play money is shown in (SOL, or
// dollars in Phomo: the owner's "the same coins used on that terminals"). Pure: read in Node too
// (tests/trench-game.test.js).

export const SAFETY_NOTE = 'Play money only. Not affiliated with any real trading terminal. This game never asks for a wallet.';
// A fixed reference rate for the fictional market, explicitly labelled on the briefing screen.
// Live BasedBott runs continue to use the relay's actual ETH quote, frozen for the run.
export const SIMULATED_ETH = Object.freeze({ coin: 'eth', usd: 3000 });

const T = (o) => Object.freeze({ ...o, colors: Object.freeze(o.colors), features: Object.freeze(o.features) });

export const TERMINALS = Object.freeze([
  T({
    id: 'chat', name: 'BasedBott', short: 'Terminal', currency: SIMULATED_ETH, ready: true,
    tagline: 'Discover tokens, follow wallets, and trade from one workspace.',
    features: ['Discover and Pulse', 'Token charts and quick trades', 'Wallet tracking', 'Portfolio and conditional orders'],
    colors: { bg: '#17171c', panel: '#1d1d23', panel2: '#24242b', panel3: '#2b2b33', line: '#2b2c34', line2: '#3a3b46',
      text: '#f1f2f6', soft: '#d4d5dd', muted: '#a1a3af', dim: '#a1a3af', hero: '#ffffff', accent: '#5bd2c5',
      onAccent: '#082722', up: '#5bd2a0', down: '#ff7b8b', onDown: '#330a13', warn: '#f7c764', info: '#83bfff', violet: '#b8a7ff' },
  }),
  T({
    id: 'scan', name: 'GNGM', short: 'Scanner', currency: 'sol', ready: true,
    tagline: 'Good night, good morning, good luck. Scan every coin and wallet.',
    features: ['New, almost bonded, migrated', 'Smart money and KOLs', 'Holders, devs and snipers', 'Wallet PnL cards'],
    // a scanner's near-black (2026-10-21): the same keys as Pomp.fun's (the page keeps one set of color names), its
    // toad's lime as the accent (never a real terminal's purple or green), a buy green and a sell red of its own
    colors: { bg: '#0d0d0f', panel: '#17181a', panel2: '#1e1f22', panel3: '#26282c', line: '#222326', line2: '#2e3034',
      text: '#eaecef', soft: '#c9ccd1', muted: '#9a9ea5', dim: '#8d9198', hero: '#ffffff', accent: '#9fdc55',
      onAccent: '#10200a', up: '#2ad48a', down: '#f65d71', onDown: '#2a0a10', warn: '#f5b83d', info: '#5fb0ff',
      violet: '#a99bff' },
  }),
  T({
    id: 'board', name: 'Pomp.fun', short: 'Launchpad', currency: 'sol', ready: true,
    tagline: 'Launch with pomp, exit with circumstance: the launchpad board.',
    features: ['Every new launch', 'Bonding curve progress', 'King of the hill', 'Threads and trades'],
    // a launchpad board's own dark (2026-10-20, #406): four greys from the page to a raised control, two lines, its
    // words in three greys (dim is the lightest grey that still reads on all four), a soft green with dark words on it
    // (and dark red words on its red), a warning yellow, and a blue and a violet for two of its tags
    colors: { bg: '#0b0b0e', panel: '#131316', panel2: '#1b1b1f', panel3: '#242429', line: '#232327', line2: '#303036',
      text: '#e4e4e7', soft: '#d4d4d8', muted: '#a1a1aa', dim: '#8a8a93', hero: '#fafafa', accent: '#86efac',
      onAccent: '#052e16', up: '#4ade80', down: '#f87171', onDown: '#450a0a', warn: '#eab308', info: '#60a5fa',
      violet: '#c084fc' },
  }),
  T({
    id: 'pro', name: 'Axium', short: 'Pro', currency: 'sol', ready: true,
    tagline: 'Three live columns, one-click buys, zero chill.',
    features: ['New, final stretch, migrated', 'One-click buys', 'Live candles and trades', 'Positions and P&L'],
    colors: { bg: '#08090d', panel: '#111216', panel2: '#191a20', panel3: '#24252d', line: '#25262e', line2: '#343640',
      text: '#f4f4f7', soft: '#cfd1d8', muted: '#9699aa', dim: '#9699aa', hero: '#ffffff', accent: '#8da2ff',
      onAccent: '#101b44', up: '#2fe3ac', down: '#ff6e8a', onDown: '#330a13', warn: '#f7c764', info: '#83bfff', violet: '#b8a7ff' },
  }),
  T({
    id: 'social', name: 'Phomo', short: 'Social', currency: 'usd', ready: true,
    tagline: 'Fear of missing out, served hot. Follow traders, all in dollars.',
    features: ['Everything in dollars', 'Simulated trader feeds', 'Copy a practice trade', 'Profiles & replay'],
    colors: { bg: '#0d0d10', panel: '#17171c', panel2: '#1b1b22', panel3: '#25252d', line: '#25252d', line2: '#33333e',
      text: '#f3f3f6', soft: '#d3d3dc', muted: '#a5a5b5', dim: '#9696a5', hero: '#ffffff', accent: '#ff967e',
      onAccent: '#33120a', up: '#55dda0', down: '#ff7b8b', onDown: '#330a13', warn: '#f7c764', info: '#83bfff', violet: '#b8a7ff' },
  }),
  T({
    id: 'clank', name: 'Clank.trade', short: 'Launchpad', currency: 'usd', ready: true,
    tagline: 'Explore the launchpad, trade coins, and launch your own practice token.',
    features: ['Trending and new coins', 'Stock-pair discovery', 'Charts, trades and holders', 'Launch a practice coin'],
    colors: { bg: '#131313', panel: '#1c1c1c', panel2: '#242424', panel3: '#2d2d2d', line: '#2b2b2b', line2: '#3a3a3a',
      text: '#f5f5f5', soft: '#d5d5d5', muted: '#a6a6a6', dim: '#a6a6a6', hero: '#ffffff', accent: '#c4b5fd',
      onAccent: '#211638', up: '#62daa5', down: '#ff7b8b', onDown: '#330a13', warn: '#f7c764', info: '#83bfff', violet: '#c4b5fd' },
  }),
]);

const BY_ID = new Map(TERMINALS.map((t) => [t.id, t]));
export const terminalById = (id) => BY_ID.get(id) || null;
export const TERMINAL_IDS = Object.freeze(TERMINALS.map((t) => t.id));
export const DEFAULT_TERMINAL = 'board';
