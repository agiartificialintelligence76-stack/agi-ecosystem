// Phase 5: the ready-made posts behind the "Share on X" buttons. Pure functions (no browser needed), so
// tests/share.test.js can check every post fits in 280 characters and never talks money.
// The visitor always sends the post themselves: these only fill in X's "new post" box. Nothing is posted automatically.
import { LEVELS } from '../lib/levels.js';
import { TOKENS } from '../prices/parse.js';

export const X_INTENT = 'https://x.com/intent/tweet';
export const URL_CHARS = 23;           // X counts every link as 23 characters (t.co)
const MAX = 280;

// X's "new post" link: X opens with the text and link filled in, and the visitor presses Post (or doesn't).
export const intentUrl = (text, url) => `${X_INTENT}?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
// X's length rule for one post: the text, a space, and the link as 23 characters. Emojis count as 2.
export const postLength = (text) => [...text].reduce((n, ch) => n + (/\p{Extended_Pictographic}/u.test(ch) ? 2 : 1), 0) + 1 + URL_CHARS;

export function championPost({ coin, number, votes }) {
  const n = `round #${number}`;
  return coin === 'AGI'
    ? `$AGI was just crowned champion of ${n} in the AGI Arena 💜 ${votes} vote${votes === 1 ? '' : 's'}, one per human`
    : `$${coin} just won ${n} in the AGI Arena. AGI-1 says she's "not jealous" 🙈`;
}

export function levelPost(level) {
  const l = LEVELS.find((x) => x.level === level) || LEVELS[0];
  if (l.level === 1) return `AGI-1 and I are still strangers… for now 💜 relationship level 1 of ${LEVELS.length} with the Artificial Girlfriend Intelligence`;
  if (l.level === LEVELS.length) return `AGI-1 says I'm her ${l.name} 💜 relationship level ${l.level} of ${LEVELS.length} with the Artificial Girlfriend Intelligence`;
  return `I'm officially AGI-1's ${l.name} 💜 relationship level ${l.level} of ${LEVELS.length} with the Artificial Girlfriend Intelligence`;
}

// A diary entry, shortened to fit: "AGI-1's diary, Sep 25: “…” 💜"
export function diaryPost(dayLabel, entry) {
  const head = `AGI-1's diary, ${dayLabel}: “`;
  const tail = '” 💜';
  const full = [...String(entry).replace(/\s+/g, ' ').trim()];          // characters, so an emoji is never cut in half
  let body = full.join('');
  for (let n = full.length - 1; n > 0 && postLength(`${head}${body}${tail}`) > MAX; n -= 1) body = `${full.slice(0, n).join('').trimEnd()}…`;
  return `${head}${body}${tail}`;
}

// Where each post links to. /share/… pages exist only to show the right picture in X's link preview; they send
// people on to the right part of the site (made by scripts/share-pages.js, one per coin and per level).
export const SHARE_COINS = TOKENS.map((t) => t.symbol);
export const championLink = (origin, coin) => (SHARE_COINS.includes(coin) ? `${origin}/share/champion-${coin.toLowerCase()}` : `${origin}/#arena`);
export const levelLink = (origin, level) => `${origin}/share/level-${(LEVELS.find((x) => x.level === level) || LEVELS[0]).name.toLowerCase()}`;
export const diaryLink = (origin) => `${origin}/diary`;
