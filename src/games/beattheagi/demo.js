// BEAT THE AGI (2026-11-08): boards for the arcade's preview (?demo) and the title's quiet game.
// Written by tools/games/beattheagi/demo-openings.mjs, which plays each one with the real game's clock (./match.js):
// in the demo, 13B plays pink for "you" against her at 400B. `R`: the game time (s) her think starts in which she
// finds her forced win (her bars turn honey mid-think); `A`: when her four lands. The first game's clock is shifted and
// scaled (demoClock) so that think starts at DEMO_THINK_AT seconds after the page opens and her four about DEMO_SPAN
// seconds later: inside the preview's recording (5.7 to 11.7 s). Pictures: rows top first, 'x' pink, 'o' mint; `turn`:
// who moves next.
export const DEMO_LEVELS = { her: 4, you: 2 };
export const DEMO_THINK_AT = 5.75;
export const DEMO_SPAN = 4.2;
export const DEMO_OPENINGS = [
  { pic: ['.......', '...x...', '...o...', '..xx...', 'x.ox.o.', 'oxooxox'], turn: 'o', seed: 101, R: 7.008, A: 12.958 },
  { pic: ['.......', '.......', '.......', '.....o.', 'oo..xx.', 'ox.xoxx'], turn: 'o', seed: 233, R: 2.442, A: 8.492 },
  { pic: ['.......', '.......', 'o......', 'x..x...', 'o.xoo.x', 'xooox.x'], turn: 'o', seed: 649, R: 7, A: 13.242 },
  { pic: ['.......', '.......', '.x.xx..', '.o.oox.', '.o.xxo.', '.oxxoxo'], turn: 'o', seed: 1217, R: 2.483, A: 8.833 },
  { pic: ['.......', '.......', '.o..x..', '.x..o..', '.x.ox..', 'oxooxox'], turn: 'o', seed: 1289, R: 4.675, A: 10.933 },
  { pic: ['.......', '.......', '..o....', '..ox.x.', '..xoxx.', 'oooxoox'], turn: 'x', seed: 1312, R: 7.533, A: 13.833 },
];
export const ATTRACT_OPENINGS = [
  { pic: ['.......', '.......', '.......', '.......', '.....o.', 'xoooxxx'], turn: 'x' },
  { pic: ['.......', '.......', '.......', '.......', '.x.o.x.', '.o.x.xo'], turn: 'o' },
  { pic: ['.......', '.......', '.......', '.......', '.o...ox', 'xo.x.ox'], turn: 'x' },
  { pic: ['.......', '.......', '.......', '.....o.', '.....x.', '.x.o.xo'], turn: 'x' },
  { pic: ['.......', '.......', '.......', '.......', '......o', 'x.oxxox'], turn: 'o' },
  { pic: ['.......', '.......', '.......', '.......', '.......', '..xo.xo'], turn: 'x' },
];

// the first demo game's clock: { speed, start } (start: the page time, in seconds, its game time is 0)
export function demoClock(op) {
  const speed = Math.max(0.85, Math.min(1.3, (op.A - op.R) / DEMO_SPAN));
  return { speed, start: DEMO_THINK_AT - op.R / speed };
}
