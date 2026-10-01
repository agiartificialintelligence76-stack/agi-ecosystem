// Coins that look like $AGI or like her (2026-10-01: shared by her feed, server/feed.js, and her launch checks,
// server/launch.js, so both read a coin the same way).
// An egirl or AI-girlfriend coin, by its name or ticker (a few words, not every coin with "AI" in it)
export const EGIRL = /e-?girl|girl-?friend|waifu|wifey|kawaii|\buwu\b|\bgfs?\b|\bgirls?\b|\bai[\s-]?(?:gf|wife|wifu|babe)s?\b|anime[\s-]?girl|\bagi[\s-]?\d\b|artificial\s+girl/i;
// Letters from other alphabets that look like A, G and I (a copy of $AGI can hide behind a Cyrillic "А"): Cyrillic, Greek,
// small capitals, Lisu, Cherokee, Latin look-alikes. (Fullwidth and mathematical letters: NFKC turns them into plain ones.)
const LOOKALIKE = {
  А: 'A', а: 'A', Α: 'A', α: 'A', ᴀ: 'A', ꓮ: 'A', Ꭺ: 'A', ɑ: 'A',
  Ԍ: 'G', ɢ: 'G', ꓖ: 'G', Ꮐ: 'G', ɡ: 'G',
  І: 'I', і: 'I', Ι: 'I', ι: 'I', Ӏ: 'I', ӏ: 'I', ɪ: 'I', ꓲ: 'I', Ꮖ: 'I', ı: 'I', ǀ: 'I',
};
const LOOKS = new RegExp(`[${Object.keys(LOOKALIKE).join('')}]`, 'g');
export const asLatin = (s) => String(s ?? '').normalize('NFKC').replace(LOOKS, (ch) => LOOKALIKE[ch]);
