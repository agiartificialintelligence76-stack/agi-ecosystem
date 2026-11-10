// AUTOCOMPLETE (2026-11-09): the letter tiles. Pure (no DOM).
//
// A tile is one letter or a token: a tokenizer's piece (QU, TH, ING, ER, ED, ES, ON, UN, RE, ST, LY, TION) that counts
// as all its letters and is worth more. Letters come in the proportions English words use them; a board keeps 35–45%
// vowels, Q only as QU, at most 2 of the same rare letter (1 of J, X, Z), and about one tile in nine is a token.

// each letter's points: our own table (common letters 1, the rarer the more)
export const LETTER_VALUE = Object.freeze({
  a: 1, b: 3, c: 3, d: 2, e: 1, f: 4, g: 3, h: 3, i: 1, j: 7, k: 5, l: 1, m: 3,
  n: 1, o: 1, p: 3, q: 8, r: 1, s: 1, t: 1, u: 2, v: 5, w: 4, x: 7, y: 3, z: 9,
});
// how often each letter is drawn (its share of the letters in English words; Q only comes in QU)
const LETTER_WEIGHT = {
  e: 11.2, a: 8.5, r: 7.6, i: 7.5, o: 7.2, t: 7.0, n: 6.7, s: 5.4, l: 5.5, c: 4.5, u: 3.6, d: 3.4, p: 3.2,
  m: 3.0, h: 3.0, g: 2.5, b: 2.1, f: 1.8, y: 1.8, w: 1.3, k: 1.1, v: 1.0, x: 0.3, z: 0.27, j: 0.2,
};
export const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);
// the most of one letter a board may hold
const CAP = { j: 1, x: 1, z: 1, k: 2, v: 2, w: 2, y: 2, f: 2, b: 2, g: 2, h: 2, m: 2, p: 2, c: 2, d: 3, u: 3, s: 3 };
const capOf = (l) => CAP[l] ?? 4;
// tokens and how often each is drawn; one of each on a board at most, five tokens at most
export const TOKENS = Object.freeze(['qu', 'th', 'ing', 'er', 'ed', 'es', 'on', 'un', 're', 'st', 'ly', 'tion']);
const TOKEN_WEIGHT = { ing: 12, er: 12, ed: 10, es: 9, re: 9, st: 9, th: 9, on: 8, un: 6, ly: 6, tion: 5, qu: 5 };
export const TOKEN_RATE = 1 / 9;
export const MAX_TOKENS = 5;
export const VOWEL_RANGE = [0.35, 0.45];

const valueOf = (letters) => { let v = 0; for (const c of letters) v += LETTER_VALUE[c]; return v; };
let nextId = 1;
// a tile: { id, s (its letters, lower case), codes (a = 0), token, value, glitch (0, or words left before it corrupts) }
export function makeTile(s) {
  return { id: nextId++, s, codes: Array.from(s, (c) => c.charCodeAt(0) - 97), token: s.length > 1, value: valueOf(s), glitch: 0 };
}
export const vowelsIn = (s) => { let n = 0; for (const c of s) if (VOWELS.has(c)) n++; return n; };

// what's on the board now (null tiles skipped): letters, vowels, each letter's count, tokens
export function census(tiles) {
  const count = {}, tokens = {};
  let letters = 0, vowels = 0, tokenTiles = 0;
  for (const t of tiles) {
    if (!t) continue;
    letters += t.s.length;
    vowels += vowelsIn(t.s);
    if (t.token) { tokenTiles++; tokens[t.s] = (tokens[t.s] || 0) + 1; }
    for (const c of t.s) count[c] = (count[c] || 0) + 1;
  }
  return { letters, vowels, count, tokens, tokenTiles };
}

// one new tile for a board that holds `tiles` (rng: the kit's seeded dice). Keeps the vowels in range, the caps, and
// tokens about one in nine.
export function drawTile(tiles, rng) {
  const c = census(tiles);
  const ratio = c.letters ? c.vowels / c.letters : 0.4;
  const wantVowel = ratio < VOWEL_RANGE[0] ? true : ratio > VOWEL_RANGE[1] ? false : null;
  // a token now and then (not when the vowels must be fixed: a single letter does that best)
  if (wantVowel === null && c.tokenTiles < MAX_TOKENS && rng.next() < TOKEN_RATE) {
    const open = TOKENS.filter((t) => !c.tokens[t] && [...t].every((l) => (c.count[l] || 0) + 1 <= capOf(l) + 1));
    if (open.length) return makeTile(rng.weighted(open, (t) => TOKEN_WEIGHT[t]).toString());
  }
  const pool = Object.keys(LETTER_WEIGHT).filter((l) => (c.count[l] || 0) < capOf(l)
    && (wantVowel === null || VOWELS.has(l) === wantVowel));
  const list = pool.length ? pool : ['e', 'a', 'r', 't'];
  return makeTile(rng.weighted(list, (l) => LETTER_WEIGHT[l]));
}

// what a tile shows: QU, TH, ING… in capitals
export const label = (t) => t.s.toUpperCase();
