// TRENCHING SIMULATOR's five terminals (2026-10-20): each laid out and working the way trenchers know the real ones
// (the owner: "our players are real trenches"), under our own names, colors and words: never a real terminal's name,
// logo or art (Claude's answer to "exact copies", with the safety note). The order is the owner's list. `currency` is
// the money its play money is shown in (SOL, or dollars in Trench Social: the owner's "the same coins used on that
// terminals"). Pure: read in Node too (tests/trench-game.test.js).

export const SAFETY_NOTE = 'Play money only. Not affiliated with any real trading terminal. This game never asks for a wallet.';

const T = (o) => Object.freeze({ ...o, colors: Object.freeze(o.colors), features: Object.freeze(o.features) });

export const TERMINALS = Object.freeze([
  T({
    id: 'chat', name: 'Trench Chat', short: 'Chat', currency: 'sol', ready: false,
    tagline: 'Trade by tapping buttons in a chat, like a trading bot.',
    features: ['Paste a coin, get its card', 'Buy and sell buttons', 'Positions in one message', 'Limit-style quick sells'],
    colors: { bg: '#101a24', panel: '#182531', line: '#24323f', text: '#f2f5f8', muted: '#8597a8', accent: '#5aa9ff',
      up: '#5fd38d', down: '#f2726f' },
  }),
  T({
    id: 'scan', name: 'Trench Scan', short: 'Scan', currency: 'sol', ready: false,
    tagline: 'Scan new coins, smart money and every wallet.',
    features: ['New, almost bonded, migrated', 'Smart money and callers', 'Holders, devs and snipers', 'Wallet records'],
    colors: { bg: '#0f1012', panel: '#17191c', line: '#25282d', text: '#e9eaec', muted: '#8b9097', accent: '#2dd4bf',
      up: '#3ddc97', down: '#ff6b6b' },
  }),
  T({
    id: 'board', name: 'Trench Board', short: 'Board', currency: 'sol', ready: true,
    tagline: 'The launchpad board: new coins, bonding curves and the king of the hill.',
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
    id: 'pro', name: 'Trench Pro', short: 'Pro', currency: 'sol', ready: false,
    tagline: 'Three live columns, one-click buys, everything at once.',
    features: ['New, final stretch, migrated', 'One-click buys', 'Live candles and trades', 'Positions and P&L'],
    colors: { bg: '#0b0b0e', panel: '#131318', line: '#20202a', text: '#ececf1', muted: '#8a8a99', accent: '#4c7dff',
      up: '#2fd18e', down: '#f0616d' },
  }),
  T({
    id: 'social', name: 'Trench Social', short: 'Social', currency: 'usd', ready: false,
    tagline: 'Follow traders, copy their moves, all in dollars.',
    features: ['Everything in dollars', 'Traders\' live feeds', 'Copy a trade in one tap', 'Leaderboards'],
    colors: { bg: '#0d0d10', panel: '#17171c', line: '#25252d', text: '#f3f3f6', muted: '#8e8e9c', accent: '#ff7a59',
      up: '#3ad68a', down: '#ff5c6c' },
  }),
]);

const BY_ID = new Map(TERMINALS.map((t) => [t.id, t]));
export const terminalById = (id) => BY_ID.get(id) || null;
export const TERMINAL_IDS = Object.freeze(TERMINALS.map((t) => t.id));
export const DEFAULT_TERMINAL = 'board';
