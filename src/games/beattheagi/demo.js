// BEAT THE AGI (2026-11-08): boards for the arcade's preview (?demo) and the title's quiet game.
// Written by tools/games/beattheagi/demo-openings.mjs, which plays each one with the real game's clock (./match.js):
// in the demo, 70B plays pink for "you" against 400B, and your four lands `at` seconds after the game starts (the
// first game is sped up or slowed a little so it lands at DEMO_TARGET seconds after the page opens). Pictures: rows top
// first, 'x' pink, 'o' mint; `turn`: who moves next.
export const DEMO_TARGET = 9.0;
export const DEMO_LEVELS = { her: 4, you: 2 };
export const DEMO_OPENINGS = [

];
export const ATTRACT_OPENINGS = [
  { pic: ['.......', '.......', '.......', '.......', '.....o.', 'xoooxxx'], turn: 'x' },
  { pic: ['.......', '.......', '.......', '.......', '.x.o.x.', '.o.x.xo'], turn: 'o' },
  { pic: ['.......', '.......', '.......', '.......', '.o...ox', 'xo.x.ox'], turn: 'x' },
  { pic: ['.......', '.......', '.......', '.....o.', '.....x.', '.x.o.xo'], turn: 'x' },
  { pic: ['.......', '.......', '.......', '.......', '......o', 'x.oxxox'], turn: 'o' },
  { pic: ['.......', '.......', '.......', '.......', '.......', '..xo.xo'], turn: 'x' },
];
