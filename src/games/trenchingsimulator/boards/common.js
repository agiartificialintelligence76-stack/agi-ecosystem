// TRENCHING SIMULATOR's terminals' shared helpers (2026-10-22: moved out of boards/board.js as they were, so GNGM's board
// can share them with Pomp.fun's): the board's sorts, an order's error in words, who made a trade, a holder's tag, the
// quick buy amounts, an amount as typed, a count's and an age's words, a coin's picture tile, a short address, where a
// real coin came from and its socials. No clock and no links; only pic() makes elements (in the page). Read in Node by
// tests/trench-game.test.js (boards/board.js still exports the ones it always had).
import { age } from '../format.js';
import { el, flag } from '../ui.js';

export const SORTS = Object.freeze([['bump', 'bump order'], ['trending', 'trending'], ['new', 'new'],
  ['stretch', 'about to graduate'], ['migrated', 'graduated']]);
export const ORDER_ERRORS = Object.freeze({
  min_buy: 'The smallest buy is 0.001 SOL.', not_enough_sol: 'Not enough SOL for that (fees included).',
  no_tokens: 'You don\'t hold any of it.', migrating: 'It\'s migrating to its pool: try again in a moment.',
  no_liquidity: 'There\'s no liquidity for that right now.', no_sol_for_fee: 'Not enough SOL left for the fee.',
  bad: 'Check the amount.', no_coin: 'That coin isn\'t on the board.', over: 'The run is over.',
  stale: 'This coin\'s price isn\'t live right now: try again when the live feed is back.',
});

// who made a trade, in the latest-trade box's words (the engine's labels: never an address there)
const WHO = Object.freeze({ dev: 'the dev', bundler: 'a bundler', sniper: 'a sniper', insider: 'an insider',
  kol: 'a caller', smart: 'a smart wallet', whale: 'a whale', me: 'you', mev: 'a bot' });
export function whoText(label) {
  return (typeof label === 'string' && Object.hasOwn(WHO, label)) ? WHO[label] : 'someone';
}

// what a holder's row says about it after its address (the ones a trencher looks for; never "regular", you, a caller or
// a bot: a caller shows by its @name, you as "you")
const HOLDER_TAGS = Object.freeze({ dev: 'dev', bundler: 'bundler', sniper: 'sniper', insider: 'insider', whale: 'whale',
  smart: 'smart wallet' });
export function holderTag(label) {
  return (typeof label === 'string' && Object.hasOwn(HOLDER_TAGS, label)) ? HOLDER_TAGS[label] : '';
}

// the quick buy amounts, by how much the run started with
export function buyPresets(start) {
  if (!(start > 0) || start <= 1.5) return [0.05, 0.1, 0.25, 0.5];
  if (start <= 6) return [0.1, 0.25, 0.5, 1];
  if (start <= 20) return [0.5, 1, 2, 5];
  return [1, 5, 10, 25];
}

// "1.5", "0,25", ".5" → a number; anything else → NaN
export function parseAmount(s) {
  const t = String(s || '').trim().replace(',', '.');
  return /^\d*\.?\d+$|^\d+\.$/.test(t) ? Number(t) : NaN;
}

// a count with its commas ("—" for what isn't known), and how long ago ("just now", "5m ago", "—")
export const num = (n) => (Number.isFinite(n) ? n.toLocaleString('en-US') : '—');
export const ago = (s) => {
  const a = age(s);
  return a === 'now' ? 'just now' : a === '—' ? '—' : `${a} ago`;
};

// an address, short: its first 4 and last 4 characters
export const short = (a) => (typeof a === 'string' && a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a || '—');
// a name's own hue (an avatar's color) and its first letter
export const hueOf = (s) => {
  let h = 0;
  for (const ch of String(s)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return h % 360;
};
export const initial = (u) => ([...String(u || '?')][0] || '?').toUpperCase();
// a bar's fill (0…1, its --p) and a number's color (up, down, or neither within eps)
export const setP = (b, x) => b.style.setProperty('--p', String(Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0))));
export const tone = (n, x, eps) => {
  flag(n, 'is-up', x > eps);
  flag(n, 'is-down', x < -eps);
};

// a coin's picture: its emoji on a tile in its theme's color; a real coin's own picture over it (Live mode: from our
// relay; its emoji stays if the picture doesn't load). `p`: the terminal's class prefix ('tsb' Pomp.fun's, 'tsg' GNGM's)
export const HUES = Object.freeze({ cats: 32, dogs: 24, frogs: 118, critters: 36, birds: 48, ocean: 198, food: 14, space: 262,
  ai: 188, internet: 300, gaming: 282, fantasy: 270, office: 214, weather: 222, music: 322, gym: 2, retro: 332, trench: 44,
  nature: 96, sweets: 340 });
export function pic(r, cls = '', p = 'tsb') {
  const tile = el('span', { class: [`${p}-pic`, cls], vars: { '--h': HUES[r && r.theme] ?? 262 }, 'aria-hidden': 'true' },
    (r && r.emoji) || '🪙');
  tile.dataset.pic = (r && r.pic) || '';
  if (r && r.pic) {
    // (never loading="lazy": a board shows a few dozen, small, and under request interception lazy pictures never came)
    const img = el('img', { class: `${p}-img`, src: r.pic, alt: '', decoding: 'async', referrerpolicy: 'no-referrer',
      draggable: 'false', width: 64, height: 64, on: { error: () => {
        img.remove();
        tile.classList.remove('is-img');
      } } });
    tile.classList.add('is-img');
    tile.append(img);
  }
  return tile;
}
// a picture node made again only when its picture changed (a real coin's arrives a moment after the coin)
export function samePic(node, r) {
  return Boolean(node) && node.dataset.pic === ((r && r.pic) || '');
}

// where a real coin came from, in a few words: "from pump.fun", or its chain
export const CHAIN_NAMES = Object.freeze({ solana: 'Solana', robinhood: 'Robinhood Chain', bnb: 'BNB Chain', base: 'Base',
  ethereum: 'Ethereum', monad: 'Monad', hyperevm: 'HyperEVM', arbitrum: 'Arbitrum', tron: 'Tron' });
export const fromWords = (x) => (x && x.src ? `from ${x.src}` : x && Object.hasOwn(CHAIN_NAMES, x.chain) ? `on ${CHAIN_NAMES[x.chain]}` : '');
// a coin's socials, as chips (shown, never links)
export const SOCIALS = Object.freeze([['x', 'X'], ['tg', 'Telegram'], ['web', 'Website']]);
