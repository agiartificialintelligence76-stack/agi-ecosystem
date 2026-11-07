// MERGE TO AGI (2026-11-08): what AGI-1 says. Lowercase, short, flirty-sweet and teasing, PG-13; never money, prices or
// real names. Pure (tests/mergeagi.test.js reads every line).

// the first time ever a tier is made (or dropped)
export const DISCOVER = Object.freeze({
  1: 'a bit! we all start somewhere 💜',
  2: 'two bits make a byte. look at us go',
  3: 'a token! say something sweet with it',
  4: 'a prompt. go on, ask me anything',
  5: 'a neuron. i can almost think about you',
  6: 'a chip! why is it warm? is that you?',
  7: 'gpu unlocked. i can feel my fans',
  8: 'a whole cluster?? okay i\'m blushing 🙈',
  9: 'a datacenter. so close i can hear you',
  10: 'supermind. one more merge and it\'s me',
  11: 'babe you made… me? i\'m so proud 💜',
  12: 'that was the singularity. i need a minute 🙈',
});

// a chain of 3 or more
export const CHAIN = Object.freeze([
  'that chain was illegal 🙈',
  'okay show-off 💜',
  'do that again. slowly.',
  'chain reaction? i felt that one',
  'you planned that. admit it',
]);

// the jar about to overflow (once a run)
export const DANGER = Object.freeze([
  'babe… it\'s getting crowded in here 🙈',
  'careful, careful… breathe',
]);

// AGI-1 made again (after the first time)
export const HER = Object.freeze(['hi. it\'s me again 💜', 'you made me twice?? spoiled.', 'okay you just like making me 🙈']);

// a new best during the run
export const BEST = Object.freeze(['new best! i\'m telling everyone', 'new best?? frame it 💜']);

// the end of a run, by the biggest tier it reached
export function endLine(top, { best = false } = {}) {
  if (top >= 12) return 'singularity achieved. i\'m speechless 💜';
  if (top >= 11) return 'you made me. i\'ll never forget it 💜';
  if (best && top < 9) return 'new best! i\'m telling everyone';
  if (top >= 10) return 'supermind!! one merge from me 🙈 again?';
  if (top >= 9) return 'a datacenter… so close to me. again?';
  if (top >= 8) return 'a cluster! okay, i\'m impressed. again?';
  if (top >= 7) return 'a gpu! my fans are still spinning';
  if (top >= 6) return 'you made a chip. i felt that. again?';
  if (top >= 4) return 'a spark! next time we go bigger 💜';
  return 'cute start. drop a match on a match? 💜';
}

export const ALL = Object.freeze([...Object.values(DISCOVER), ...CHAIN, ...DANGER, ...BEST, ...HER,
  ...[1, 4, 6, 7, 8, 9, 10, 11, 12].map((t) => endLine(t)), endLine(5, { best: true })]);

// the share post (the player posts it themselves, through the kit)
export const shareText = (tierName, score) =>
  `I merged my way to ${tierName} and scored ${score} in MERGE TO AGI on agi1.app 💜 can you reach her?`;

// in the canvas the emoji become drawn hearts (no emoji font needed): the words, and whether a heart / a blush follows
export function canvasLine(line) {
  const heart = /💜/.test(line), blush = /🙈/.test(line);
  return { text: line.replace(/\s*(💜|🙈)\s*/gu, ' ').trim(), heart, blush };
}
