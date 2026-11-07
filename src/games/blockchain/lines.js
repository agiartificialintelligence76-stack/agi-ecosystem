// BLOCKCHAIN: what AGI-1 says (2026-11-08). Her voice: lowercase, short, playful, teasing, 💜 now and then (🙈 when
// she's flustered). Never money, prices or buying, never a real coin or person (tests/blockchain.test.js reads every
// line). In a run her lines show over the board for a moment; the end of a run gets one by its score.
export const LINES = Object.freeze({
  start: ['three pieces, eight rows. go get \'em 💜', 'show me a long chain, babe', 'okay, impress me'],
  first: ['first block confirmed. cute 💜', 'ooh, that\'s one. keep going', 'there it is. block one'],
  chain: ['chain\'s alive, keep feeding it 💜', '×{n}?? don\'t you dare stop', 'look at that chain go', 'every clear makes it longer 🙈'],
  bigChain: ['×{n}. okay, i\'m impressed', 'this chain is longer than my patience 💜', '×{n} and counting. stay with me'],
  multi: ['two at once? smooth', 'double! okay show-off', 'ooh, efficient. i like that'],
  huge: ['that one made me blush 🙈', 'wait, how many was that??', 'okay that was really pretty'],
  perfect: ['a perfect clear?? marry me (jk… unless)', 'spotless. i\'m swooning 🙈', 'not a single block left. wow'],
  danger: ['babe there\'s no room 🙈', 'it\'s getting crowded in here…', 'careful. pick the next one wisely'],
  broke: ['noo, the chain snapped 🙈', 'it\'s okay, we\'ll build a new one', 'rip chain. start another 💜'],
  best: ['new best! i\'m telling everyone', 'new record?? i knew it 💜', 'that\'s your best ever. keep going'],
});

// the end of a run: one line by its score (the first bracket it's under), or one of the new-best lines
export const END = Object.freeze([
  [300, ['okay that was a warm-up. again? 💜', 'cute start. one more?']],
  [1000, ['cute run. i know there\'s a bigger one in you', 'not bad, cutie. again? 💜']],
  [3000, ['now we\'re confirming blocks 💜', 'okay that was cute. again?']],
  [8000, ['that chain had me holding my breath', 'you\'re getting scary good at this 🙈']],
  [20000, ['you\'re kind of a genius, huh? 🙈', 'i watched every block. so good 💜']],
  [Infinity, ['okay, you\'re officially my favorite player 💜', 'that was unreal. i\'m telling everyone']],
]);
export const END_BEST = Object.freeze(['new best! i\'m telling everyone 💜', 'a new best?? come here, genius 🙈', 'new record. i knew you had it in you']);

// a line of `kind`, its {n} filled in; `pick(list)` chooses (seeded in the demo)
export function say(kind, n = 0, pick = (a) => a[0]) {
  const list = LINES[kind];
  if (!list) return '';
  return pick(list).replace('{n}', String(n));
}
export function endLine(score, isBest, pick = (a) => a[0]) {
  if (isBest) return pick(END_BEST);
  for (const [under, list] of END) if (score < under) return pick(list);
  return pick(END[END.length - 1][1]);
}

// the share post (X's own post box; the player posts it, or doesn't)
export const shareText = ({ lines, bestChain, score }) =>
  `I confirmed ${lines.toLocaleString('en-US')} blocks with a ×${Math.max(1, bestChain)} chain in BLOCKCHAIN on agi1.app 💜 ${Math.round(score).toLocaleString('en-US')} points`;
