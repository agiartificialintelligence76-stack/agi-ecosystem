// Her live show (2026-10-02): the words that never go on her stream, shared by the website's checks (server/live.js: a
// viewer's question, the name they give, her answer) and the stream's own lines (tools/live/lines.js: her diary entry).
// Pure, no imports.

// Words written together are split before they're checked: "ElonMusk", "elon_musk", "PepeLover", "BTCmaxi", "Trump2028",
// "AGI1official" (so "Melon", "Trumpet" or "Staffan" stay what they are)
// (capitals together are split both ways, since only the words can tell: "BTCmaxi" is "BTC maxi", "XMLHttp" is "XML Http")
export function splitWords(text) {
  const base = String(text ?? '')
    .replace(/[_.\-]+/g, ' ')
    .replace(/(\p{L})(\p{N})/gu, '$1 $2')
    .replace(/(\p{N})(\p{L})/gu, '$1 $2')
    .replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2');
  const a = base.replace(/(\p{Lu})(\p{Lu}\p{Ll})/gu, '$1 $2');
  const b = base.replace(/(\p{Lu}{2,})(\p{Ll})/gu, '$1 $2');
  return a === b ? a : `${a} · ${b}`;
}

// Another coin, or a real person: only $AGI, and never real people, on her show (the owner's rules). The obvious ones; the
// AI judges the rest. (ETH stays allowed: it's Robinhood Chain's own money.)
const words = (list) => new RegExp(`\\b(?:${list.join('|')})\\b`, 'i');
export const OTHER_COINS = words(['bitcoin', 'btc', 'solana', 'doge(?:coin)?', 'shib(?:a(?:\\s*inu)?)?', 'pepe', 'bonk', 'dogwifhat', 'wif', 'floki', 'xrp',
  'cardano', 'bnb', 'binance', 'tether', 'usdt', 'usdc', 'fartcoin', 'pengu', 'spcx', 'clankcat', 'clankcap', 'pump\\s*fun', 'pumpfun']);
export const REAL_PEOPLE = words(['elon', 'musk', 'elonmusk', 'vitalik', 'buterin', 'saylor', 'tenev', 'bankman', 'sbf', 'trump', 'biden', 'putin',
  'zuckerberg', 'bezos', 'gensler']);
export const mentionsCoinOrPerson = (text) => {
  const t = splitWords(text);
  return OTHER_COINS.test(t) ? 'coin' : REAL_PEOPLE.test(t) ? 'person' : null;
};

// Someone going through something heavy: never in her line, never read on stream. They get a caring note at once instead
// (on the site and in her bot); the AI catches what this misses ("skip": "care"). (Curly apostrophes are made straight
// first: tidyText.)
export const DISTRESS = new RegExp(`\\b(?:${[
  "kill(?:ing)?\\s*my\\s*self", 'suicid\\w*', '(?:end|ending|take|taking)\\s+my\\s+(?:own\\s+)?life', 'end(?:ing)?\\s+it\\s+all',
  '(?:want|wanna)\\s+(?:to\\s+)?die', 'self[\\s-]?harm\\w*', '(?:cut|cutting|hurt|hurting)\\s+my\\s*self', 'unalive\\w*',
  "(?:don'?t|do\\s+not)\\s+want\\s+to\\s+(?:live|be\\s+alive|exist)", '(?:gonna|going\\s+to|want\\s+to|wanna|imma|will)\\s+kms',
  'wish\\s+i\\s+(?:was|were)\\s+(?:dead|never\\s+born)', 'better\\s+off\\s+dead', 'no\\s+reason\\s+to\\s+live', "can'?t\\s+go\\s+on",
].join('|')})\\b`, 'i');
