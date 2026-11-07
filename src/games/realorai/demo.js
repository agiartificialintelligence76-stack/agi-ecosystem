// REAL OR AI? (2026-11-08): the demo's player (`?demo`, the arcade's preview). For each photo it glides the loupe over
// one of its clue spots, then swipes the card the right way (about 1 time in 6 the wrong way: nobody's perfect).
// Seeded: the same seed plays the same game.
import { rng } from '../kit/fx.js';
import { truthOf, other } from './rules.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function createBot(seed) {
  const r = rng((Math.imul(seed >>> 0, 2654435761) + 17) >>> 0);
  let n = 0;
  return {
    // its plan for one photo: where the loupe starts and where it settles (fractions of the photo), how long it looks,
    // and its answer
    plan(pic) {
      n++;
      // (the preview's first two photos go right; then it slips about 1 time in 6)
      const roll = r.next();
      const wrong = n > 2 && roll < 1 / 6;
      const clues = pic.clues || [];
      const c = clues.length ? clues[r.int(0, clues.length - 1)] : null;
      const target = c ? { x: c.x, y: c.y } : { x: r.range(0.32, 0.68), y: r.range(0.3, 0.62) };
      const start = { x: clamp(target.x + r.range(0.12, 0.26) * r.sign(), 0.14, 0.86), y: clamp(target.y + r.range(0.08, 0.2) * r.sign(), 0.14, 0.86) };
      return { n, wrong, guess: wrong ? other(truthOf(pic)) : truthOf(pic), start, target, look: 0.8 + r.range(0, 0.25) };
    },
  };
}
