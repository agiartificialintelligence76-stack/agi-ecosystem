// TRENCHING SIMULATOR's five terminals (2026-10-20): each laid out and working the way trenchers know the real ones
// (the owner: "our players are real trenches"). Since 2026-10-21 under parody names (the owner: "use a parody names,
// parody logo, parody branding of that terminal … for each terminal", then "Sound-alikes"): GNGM, Pomp.fun, Axium,
// BasedBott and Phomo, each with its own mark drawn in code (brands.js: never a real terminal's logo or art), its own
// colors and words; never a real terminal's name ("Fomoo" is a known drainer site and a live coin: so Phomo). Names are
// text only, never a link. The order is the owner's list. `currency` is the money its play money is shown in (SOL, or
// dollars in Phomo: the owner's "the same coins used on that terminals"). Pure: read in Node too
// (tests/trench-game.test.js).

export const SAFETY_NOTE = 'Play money only. Not affiliated with any real trading terminal. This game never asks for a wallet.';

const T = (o) => Object.freeze({ ...o, colors: Object.freeze(o.colors), features: Object.freeze(o.features) });

export const TERMINALS = Object.freeze([
  T({
    id: 'chat', name: 'BasedBott', short: 'Chat bot', currency: 'sol', ready: false,
    tagline: 'Paste a coin, tap a button, touch grass never.',
    features: ['Paste a coin, get its card', 'Buy and sell buttons', 'Positions in one message', 'Limit-style quick sells'],
    colors: { bg: '#0f1823', panel: '#172331', line: '#24334a', text: '#f2f5f8', muted: '#8a9db2', accent: '#5b9dff',
      up: '#5fd38d', down: '#f2726f' },
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
    id: 'pro', name: 'Axium', short: 'Pro', currency: 'sol', ready: false,
    tagline: 'Three live columns, one-click buys, zero chill.',
    features: ['New, final stretch, migrated', 'One-click buys', 'Live candles and trades', 'Positions and P&L'],
    colors: { bg: '#07080c', panel: '#101116', line: '#22242d', text: '#f4f4f7', muted: '#8b8ea1', accent: '#7088ff',
      up: '#2fe3ac', down: '#f2587f' },
  }),
  T({
    id: 'social', name: 'Phomo', short: 'Social', currency: 'usd', ready: true,
    tagline: 'Fear of missing out, served hot. Follow traders, all in dollars.',
    features: ['Everything in dollars', 'Simulated trader feeds', 'Copy a practice trade', 'Profiles & replay'],
    colors: { bg: '#0d0d10', panel: '#17171c', panel2: '#1b1b22', panel3: '#25252d', line: '#25252d', line2: '#33333e',
      text: '#f3f3f6', soft: '#d3d3dc', muted: '#a5a5b5', dim: '#9696a5', hero: '#ffffff', accent: '#ff967e',
      onAccent: '#33120a', up: '#55dda0', down: '#ff7b8b', onDown: '#330a13', warn: '#f7c764', info: '#83bfff', violet: '#b8a7ff' },
  }),
]);

const BY_ID = new Map(TERMINALS.map((t) => [t.id, t]));
export const terminalById = (id) => BY_ID.get(id) || null;
export const TERMINAL_IDS = Object.freeze(TERMINALS.map((t) => t.id));
export const DEFAULT_TERMINAL = 'board';
