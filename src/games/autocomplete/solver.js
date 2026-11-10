// AUTOCOMPLETE (2026-11-09): what can be spelled on a board. Pure (no DOM). Every search walks the board's tiles and
// the dictionary's word graph (./dict.js) together, so a dead end on either side stops it at once.
//
//   solve(board, dict)            every word on the board → Map(word → { path, tokens }) (the first path found)
//   predict(board, dict, path)    AGI-1's guesses for the word a path starts: her vocabulary only, most likely first
//   typedPath(board, letters, prev)   a path that spells typed letters (the keyboard's way to play)
//   hintWord(board, dict, words)  the word she'd complete for you
export const COLS = 5, ROWS = 6, SIZE = COLS * ROWS;
export const MIN_LEN = 3;

// the 8 neighbours of each cell
export const NEIGHBORS = (() => {
  const out = [];
  for (let i = 0; i < SIZE; i++) {
    const r = Math.floor(i / COLS), c = i % COLS, list = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) list.push(rr * COLS + cc);
    }
    out.push(list);
  }
  return out;
})();
export const adjacent = (a, b) => a !== b && Math.abs(Math.floor(a / COLS) - Math.floor(b / COLS)) <= 1 && Math.abs((a % COLS) - (b % COLS)) <= 1;

// a finger arrives on `cell` while drawing `path`: 'add' (a free neighbour of the last tile), 'undo' (back onto the
// tile before the last: the last one comes off), 'same' (still on the last tile), 'blocked' (used already, or not a
// neighbour). → { action, path } (a new array when it changed)
export function stepPath(path, cell) {
  const n = path.length;
  if (!n) return { action: 'add', path: [cell] };
  if (path[n - 1] === cell) return { action: 'same', path };
  if (n >= 2 && path[n - 2] === cell) return { action: 'undo', path: path.slice(0, -1) };
  if (path.includes(cell) || !adjacent(path[n - 1], cell)) return { action: 'blocked', path };
  return { action: 'add', path: [...path, cell] };
}

// a path's word and its number of letters
export const wordOf = (tiles, path) => path.map((i) => tiles[i].s).join('');
export const tokensIn = (tiles, path) => path.reduce((n, i) => n + (tiles[i].token ? 1 : 0), 0);

// every word on the board (3+ letters): Map(word → { path, tokens }), the first path found for each (search order:
// cells in order, neighbours in order: the same board, the same answer)
export function solve(tiles, dict, { limit = 5000 } = {}) {
  const found = new Map();
  const path = [];
  let used = 0;            // a bit for each cell on the path
  const parts = [];
  function visit(i, s, len) {
    if (len >= MIN_LEN && dict.isWord(s)) {
      const w = parts.join('');
      if (!found.has(w)) found.set(w, { path: path.slice(), tokens: tokensIn(tiles, path) });
      if (found.size >= limit) return;
    }
    if (!dict.canGrow(s)) return;
    for (const j of NEIGHBORS[i]) {
      if (used & (1 << j)) continue;
      const t = tiles[j];
      if (!t) continue;
      const s2 = dict.feed(s, t.codes);
      if (s2 < 0) continue;
      used |= 1 << j; path.push(j); parts.push(t.s);
      visit(j, s2, len + t.s.length);
      used &= ~(1 << j); path.pop(); parts.pop();
    }
  }
  for (let i = 0; i < SIZE; i++) {
    const t = tiles[i];
    if (!t) continue;
    const s = dict.feed(-1, t.codes);
    if (s < 0) continue;
    used = 1 << i; path.push(i); parts.push(t.s);
    visit(i, s, t.s.length);
    used = 0; path.pop(); parts.pop();
  }
  return found;
}

// AGI-1's guesses for the word `prefix` (a path of cells) starts: words of her vocabulary that go on from it on this
// board, most likely first: [{ word, path, rank }] (up to `k`). Her pick is the first.
export function predict(tiles, dict, prefix, { k = 3 } = {}) {
  if (!prefix.length) return [];
  let s = -1, used = 0, len = 0;
  const parts = [];
  for (const i of prefix) {
    const t = tiles[i];
    if (!t || (used & (1 << i))) return [];
    s = dict.feed(s, t.codes);
    if (s < 0) return [];
    used |= 1 << i; parts.push(t.s); len += t.s.length;
  }
  const best = new Map();   // word → { word, path, rank }
  const path = prefix.slice();
  function visit(i, s, len) {
    if (len >= MIN_LEN && dict.isWord(s)) {
      const w = parts.join('');
      const r = dict.rankOf(w);
      if (r >= 0 && !best.has(w)) best.set(w, { word: w, path: path.slice(), rank: r });
    }
    if (!dict.canGrow(s)) return;
    for (const j of NEIGHBORS[i]) {
      if (used & (1 << j)) continue;
      const t = tiles[j];
      if (!t) continue;
      const s2 = dict.feed(s, t.codes);
      if (s2 < 0) continue;
      used |= 1 << j; path.push(j); parts.push(t.s);
      visit(j, s2, len + t.s.length);
      used &= ~(1 << j); path.pop(); parts.pop();
    }
  }
  visit(prefix[prefix.length - 1], s, len);
  return [...best.values()].sort((a, b) => a.rank - b.rank).slice(0, k);
}

// the cells (from the start of a path) that make her guess: once a path spells 2+ letters she guesses, and her guess
// holds while the path still starts the same way
export function lockLength(tiles, path) {
  let n = 0;
  for (let k = 0; k < path.length; k++) { n += tiles[path[k]].s.length; if (n >= 2) return k + 1; }
  return 0;
}

// how a played word did against her pick: 'predictable' (her pick), 'longer' (more letters than her pick, or she had
// no guess at all), 'surprise' (any other word)
export function surpriseOf(word, pick) {
  if (!pick) return 'longer';
  if (word === pick) return 'predictable';
  return word.length > pick.length ? 'longer' : 'surprise';
}

// a path for typed letters (lower case): every tile's letters in turn, the last tile maybe only begun (a token typed
// half way). → { path, partial (letters of the last tile still to type), complete } or null. Prefers a path that
// keeps the one before (`prev`), then whole tiles, then fewer tiles (tokens are worth more).
export function typedPath(tiles, letters, prev = []) {
  if (!letters) return null;
  const found = [];
  const path = [];
  let used = 0;
  function visit(i, at) {
    // tile i was matched; `at` letters typed so far
    if (at >= letters.length) { found.push({ path: path.slice(), partial: 0 }); return; }
    if (found.length > 400) return;
    for (const j of NEIGHBORS[i]) {
      if (used & (1 << j)) continue;
      const t = tiles[j];
      if (!t) continue;
      const m = matchTile(t.s, letters, at);
      if (m < 0) continue;
      used |= 1 << j; path.push(j);
      if (m > 0) found.push({ path: path.slice(), partial: m });
      else visit(j, at + t.s.length);
      used &= ~(1 << j); path.pop();
    }
  }
  for (let i = 0; i < SIZE; i++) {
    const t = tiles[i];
    if (!t) continue;
    const m = matchTile(t.s, letters, 0);
    if (m < 0) continue;
    used = 1 << i; path.push(i);
    if (m > 0) found.push({ path: path.slice(), partial: m });
    else visit(i, t.s.length);
    used = 0; path.pop();
  }
  if (!found.length) return null;
  const keep = (p) => { let k = 0; while (k < p.length && k < prev.length && p[k] === prev[k]) k++; return k; };
  found.sort((a, b) => (a.partial > 0) - (b.partial > 0) || keep(b.path) - keep(a.path) || a.path.length - b.path.length
    || a.path.join(',').localeCompare(b.path.join(',')));
  const best = found[0];
  return { path: best.path, partial: best.partial, complete: best.partial === 0 };
}
// tile letters `s` against the typed letters from `at`: 0 the whole tile fits, n > 0 the typed letters end n letters
// into it (the last tile, begun), -1 no
function matchTile(s, letters, at) {
  const left = letters.length - at;
  if (left >= s.length) return letters.startsWith(s, at) ? 0 : -1;
  return s.startsWith(letters.slice(at)) ? s.length - left : -1;
}

// the word she'd "complete for you": a good word people know, the longest worthwhile one of her vocabulary on the board
// (the best by her score of it, its rank breaking ties). `words`: solve()'s map. → { word, path } or null
export function hintWord(tiles, dict, words, score) {
  let best = null, bestKey = -Infinity;
  for (const [w, info] of words) {
    const r = dict.rankOf(w);
    if (r < 0) continue;
    const key = score(w, info) - r / 1e6;
    if (key > bestKey) { bestKey = key; best = { word: w, path: info.path }; }
  }
  return best;
}
