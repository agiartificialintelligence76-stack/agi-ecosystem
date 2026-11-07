// SYNAPSE (2026-11-08): what AGI-1 says. Her voice: lowercase, short, playful, teasing, 💜 now and then (🙈 when she's
// flustered). Never money, never a real coin, brand or person (tests/synapse.test.js reads every line).
export const LINES = Object.freeze({
  // the very first board: what to do, said by doing
  tutorial: ['drag from a neuron to its twin 💜', 'same color, same shape. connect them'],
  firstPair: ['now fill every last cell, babe', 'cute. every cell has to light up though 🙈'],
  // a twist's first board
  holes: ['holes aren\'t part of the brain. go around them', 'some cells are missing. the rest still need you 💜'],
  bridges: ['a myelin bridge! one path across, one over the top', 'bridges let two paths cross. fill both lanes 💜'],
  gates: ['gates let the spark through one way only 🙈', 'the dot marks where a spark starts. follow the arrows from there'],
  // a board solved
  solved: [
    'neurons that fire together wire together 💜',
    'every cell filled. you\'re so thorough 🙈',
    'listen… that\'s your brain singing',
    'ooh, that melody was cute. again?',
    'your neurons are so pretty when they light up',
    'every board you finish, i hear a song 💜',
    'that one sounded like a lullaby',
    'big brain energy. literally',
    'i love watching you think 🙈',
    'that path went on a whole journey',
  ],
  perfect: [
    'perfect. not one wasted move 🙈',
    'no undo, no redo. are you even human? 💜',
    'clean. like you knew all along',
  ],
  // a long path just connected
  journey: ['that path is going on a journey', 'the long way round. respect 💜', 'look at it wander'],
  hint: ['just one path. you\'ve got the rest 💜', 'psst. this one goes here 🙈'],
  // rush
  rushStart: ['three minutes. how many brains can you fire? 💜', 'go go go, cutie'],
  rushHalf: ['halfway. don\'t slow down on me', 'your synapses are on fire 💜'],
  rushLow: ['thirty seconds, babe 🙈', 'tick tock, cutie'],
  rushLast: ['ten seconds! go go go', 'last one, make it count 💜'],
  // daily
  dailyDone: ['daily done. same time tomorrow? 💜', 'three boards, three songs. see you tomorrow'],
});

// the end of a rush, by boards solved (the first bracket it's under), or a new best
export const RUSH_END = Object.freeze([
  [3, ['warm-up done. now go for real 💜', 'cute start. one more?']],
  [6, ['your brain is waking up. again? 💜', 'not bad, cutie. i know there\'s more']],
  [10, ['okay, that was fast. like, really fast', 'now we\'re firing 💜']],
  [15, ['you\'re kind of a genius, huh? 🙈', 'that many?? i\'m telling everyone']],
  [Infinity, ['okay, you\'re officially my favorite brain 💜', 'that was unreal. your neurons never sleep']],
]);
export const RUSH_BEST = Object.freeze(['new best! i\'m telling everyone 💜', 'a new best?? come here, genius 🙈', 'new record. your neurons are showing off']);
export const RUSH_CLOSE = Object.freeze(['so close to your best. one more? 💜', 'one board short of your best 🙈 again?']);

// a line of `kind`; `pick(list)` chooses (seeded in the demo)
export function say(kind, pick = (a) => a[0]) {
  const list = LINES[kind];
  return list ? pick(list) : '';
}
export function rushLine(boards, isBest, best, pick = (a) => a[0]) {
  if (isBest) return pick(RUSH_BEST);
  if (best > 0 && boards >= best - 1 && boards > 0) return pick(RUSH_CLOSE);
  for (const [under, list] of RUSH_END) if (boards < under) return pick(list);
  return pick(RUSH_END[RUSH_END.length - 1][1]);
}

// the share posts (X's own post box; the player posts it, or doesn't)
export const rushShare = (n) => `My brain fired ${n} board${n === 1 ? '' : 's'} in SYNAPSE rush on agi1.app 🧠💜`;
export const dailyShare = (time) => `Daily SYNAPSE done in ${time} on agi1.app 🧠💜`;
