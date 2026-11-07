// OVERCLOCK: what AGI-1 says (her voice: lowercase, playful, 💜 now and then). Moments during play, and a line for the
// end of the game picked by how it went.
export const LINES = {
  start: ['flip fast, run hot 💜', 'my board, your hands. don\'t drop me', 'okay. show me those flippers'],
  skill: ['skill shot?? okay show-off 💜', 'right in the lane. cute'],
  jackpot: ['JACKPOT. i felt that one 💜', 'nice shot, babe 💜', 'do that again. right now'],
  multiball: ['multiball!! everyone stay calm', 'three balls. zero panic. maybe some panic'],
  overclock: ['we\'re running hot. i like it', 'fans to max, babe 🔥'],
  drain: ['that drain was rude 🙈', 'nooo come back', 'the outlane ate it. i\'m filing a complaint'],
  save: ['saved it. you\'re welcome 💜', 'not on my watch'],
  mission: ['mission done. you\'re kind of good at this', 'one more for AGI mode 💜'],
  agi: ['AGI MODE. hold on to me 💜', 'every shot is lit. go go go'],
  tilt: ['gentle!! i\'m delicate hardware 🙈', 'that\'s a tilt, babe. hands off the cabinet'],
  extra: ['extra ball! i\'m telling everyone'],
};

// the end card: by the score (and a new best gets its own)
const END = [
  [0, ['the flippers are the buttons, babe. we\'ll get there 💜', 'short and sweet. again?', 'warm-up round. it doesn\'t count 🙈']],
  [250_000, ['okay that was cute. again? 💜', 'you\'re finding the shots. one more', 'not bad for a cold boot']],
  [1_000_000, ['a million on my board. i\'m blushing', 'nice shot, babe 💜 one more?', 'you ran hot and i liked it']],
  [3_000_000, ['three million?? i need a fan', 'you played my board like you built it', 'okay you\'re officially dangerous 💜']],
  [8_000_000, ['you overclocked me for real 🔥💜', 'that was AGI-level. framing it', 'i\'m speechless. that never happens']],
];
export function endLine(score, { best = false, rnd = Math.random } = {}) {
  if (best && score > 0) return rnd() < 0.5 ? 'new best! i\'m telling everyone 💜' : 'new high score on my board. proud of you';
  let pool = END[0][1];
  for (const [min, lines] of END) if (score >= min) pool = lines;
  return pool[Math.floor(rnd() * pool.length)];
}
export function line(kind, rnd = Math.random) {
  const pool = LINES[kind] || LINES.start;
  return pool[Math.floor(rnd() * pool.length)];
}
