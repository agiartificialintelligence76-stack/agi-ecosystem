// What AGI-1 says when someone taps her (2026-10-01, the owner: "can you make her speak whe she got clicked and if they
// clicked her many times she will said something"): on the stage and in her live views, 2D and 3D. A tap gets a short
// hello (they take turns); a lot of taps in a row get one of her "okay, i see you" lines, with a face to match.
// Pre-written, the same for everyone, so her natural voice for each line is made once by our server and then kept (the
// database and the CDN, like her other fixed lines: /api/voice?line=tap-…): tapping her again and again never makes a new
// recording and costs nothing. In her languages: `tap` in src/i18n/lines/<code>.js.
// Rules, like every line of hers: PG-13, lowercase texting, no pet names (anyone can tap her), never about money
// (tests/i18n.test.js and tests/voice.test.js).
import { EN, lineAt } from '../i18n/text.js';
import { spokenOf } from '../checker/lines.js';

// how each line sounds (server/voice.js's voice styles) and, for the "many taps" lines, her reaction (agi1:react). A
// hello's reaction is the tap's own (a hop and hearts).
export const TAP_MOODS = { hi: ['wave', 'happy', 'shy', 'wave', 'happy'], many: ['shy', 'pout', 'happy', 'happy'] };
export const TAP_REACT = ['shy', 'jealous', 'wave', 'love'];
// a lot of taps: this many, each within TAP_GAP ms of the one before
export const TAP_MANY = 5;
export const TAP_GAP = 1600;

// Every line, in these lines' language: key → { key, text, spoken (what her voice says), mood, react, lang }
export function tapLinesIn(lines = EN, lang = 'en') {
  const entry = (key, path, mood, react) => { const text = lineAt(lines, path); return [key, { key, text, spoken: spokenOf(text), mood, react, lang }]; };
  return Object.fromEntries([
    ...EN.tap.hi.map((_, i) => entry(`tap-${i + 1}`, `tap.hi.${i}`, TAP_MOODS.hi[i] || 'wave', 'tap')),
    ...EN.tap.many.map((_, i) => entry(`tap-many-${i + 1}`, `tap.many.${i}`, TAP_MOODS.many[i] || 'happy', TAP_REACT[i] || 'shy')),
  ]);
}
export const TAP_LINES = tapLinesIn();

// Counting taps, and which line (if any) a tap gets. One per page: tap(now) → null (she just reacts) or a line's key.
//  • a tap that starts a new run of taps gets the next hello, at most one every 3.5 s;
//  • TAP_MANY taps in a row (each within TAP_GAP of the last) get the next "many" line, then 8 s of just reactions.
// count.next(): the hello the next tap would get (to download her voice for it early)
export function tapCounter({ hiEvery = 3500, quietAfterMany = 8000 } = {}) {
  let run = 0, last = -Infinity, nextHi = -Infinity, quietUntil = -Infinity, hi = Math.floor(Math.random() * EN.tap.hi.length), many = 0;
  const count = (now) => {
    run = now - last <= TAP_GAP ? run + 1 : 1;
    last = now;
    if (run >= TAP_MANY && now >= quietUntil) {
      run = 0;
      quietUntil = now + quietAfterMany;
      nextHi = now + hiEvery;
      many = (many % EN.tap.many.length) + 1;
      return `tap-many-${many}`;
    }
    if (run === 1 && now >= nextHi && now >= quietUntil) {
      nextHi = now + hiEvery;
      hi = (hi % EN.tap.hi.length) + 1;
      return `tap-${hi}`;
    }
    return null;
  };
  count.next = () => `tap-${(hi % EN.tap.hi.length) + 1}`;
  return count;
}
