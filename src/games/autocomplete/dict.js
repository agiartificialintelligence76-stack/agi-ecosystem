// AUTOCOMPLETE (2026-11-09): the dictionary, at runtime. Pure (no DOM): tests/autocomplete.test.js reads the shipped
// files with it in Node.
//
// words.bin  every word the game accepts (ENABLE and SCOWL, filtered: tools/games/autocomplete/README.md), as a packed
//            word graph: 32-bit edges, a node's edges side by side in letter order. Bits 0–4 the letter (a = 0), bit 5 a
//            word ends after this edge, bit 6 the node's last edge, bits 7–31 where the next node's edges start (0: none).
//            Header: magic, word count, the root's first edge, the length.
// common.txt AGI-1's vocabulary (what she predicts and hints): one word a line, the most likely first.
//
// The solver walks the graph one letter at a time. Its state is the edge of the last letter read (-1: nothing read yet).
export const MAGIC = 0x41435731;

export function createDict(data, commonText = '') {
  let E = data instanceof Uint32Array ? data : new Uint32Array(data);
  if (E[0] !== MAGIC) {
    // a big-endian device (none in practice): the same file, its bytes turned around
    const dv = new DataView(E.buffer, E.byteOffset, E.byteLength);
    const F = new Uint32Array(E.length);
    for (let i = 0; i < E.length; i++) F[i] = dv.getUint32(i * 4, true);
    if (F[0] !== MAGIC) throw new Error('autocomplete: not a word graph');
    E = F;
  }
  const ROOT = E[2];
  const rank = new Map();
  let r = 0;
  for (const w of commonText.split('\n')) { const t = w.trim(); if (t && !rank.has(t)) rank.set(t, r++); }

  // the edge for letter `code` (0–25) out of the node whose edges start at `ref`, or -1
  function edge(ref, code) {
    if (!ref) return -1;
    for (let i = ref; ; i++) {
      const e = E[i], l = e & 31;
      if (l === code) return i;
      if (l > code || (e & 64)) return -1;
    }
  }
  // one letter on from state `s` (-1: the start)
  const next = (s, code) => edge(s < 0 ? ROOT : E[s] >>> 7, code);
  const isWord = (s) => s >= 0 && (E[s] & 32) !== 0;
  const canGrow = (s) => (s < 0 ? ROOT : E[s] >>> 7) !== 0;
  // a string of letters on from `s` (or -1 if no word goes that way)
  function feed(s, codes) {
    for (let i = 0; i < codes.length; i++) { s = next(s, codes[i]); if (s < 0) return -1; }
    return s;
  }
  const codesOf = (word) => Array.from(word, (c) => c.charCodeAt(0) - 97);
  function has(word) {
    if (!/^[a-z]{3,15}$/.test(word)) return false;
    return isWord(feed(-1, codesOf(word)));
  }
  // every word, a to z (tests)
  function* words() {
    const letters = [];
    function* walk(ref) {
      for (let i = ref; ; i++) {
        const e = E[i];
        letters.push(String.fromCharCode(97 + (e & 31)));
        if (e & 32) yield letters.join('');
        if (e >>> 7) yield* walk(e >>> 7);
        letters.pop();
        if (e & 64) break;
      }
    }
    yield* walk(ROOT);
  }
  return {
    E, ROOT, count: E[1], rank, size: rank.size,
    edge, next, isWord, canGrow, feed, codesOf, has, words,
    // her rank of a word: 0 is the word she'd guess first; -1 if she'd never guess it
    rankOf: (word) => rank.get(word) ?? -1,
  };
}
