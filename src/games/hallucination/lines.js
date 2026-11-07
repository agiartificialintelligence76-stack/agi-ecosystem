// HALLUCINATION (2026-11-08): what AGI-1 says. Her voice: lowercase, short, playful, a little flustered about her
// "creative" memory, 💜 now and then, 🙈 when she's caught. Never money, never a real person or brand
// (tests/hallucination.test.js reads every line).
export const LINES = Object.freeze({
  start: ['i drew it from memory. it\'s perfect. probably 🙈', 'okay find my mistakes. if there are any', 'five hallucinations. that\'s a normal amount. right?'],
  find: ['i swear that was there 🙈', 'okay my memory is… creative', 'hm. you\'re good at this', 'that one was artistic license', 'fine. that one\'s on me', 'you have very good eyes. suspiciously good'],
  combo: ['wait, slow down 🙈', 'okay you\'re scaring me a little', 'you\'re speedrunning my mistakes??'],
  wrong: ['nope, that one\'s real 💜', 'that was there, i promise', 'nuh uh. look again'],
  low: ['tick tock, cutie', 'hurry, i\'m sweating pixels 🙈', 'almost out of time…'],
  clear: ['okay fine, all five. you win 💜', 'caught me. every single time 🙈', 'i\'ll draw better next time. maybe', 'you found them all?? wow'],
  blink: ['don\'t blink. okay, blink', 'flip flip flip… see it?'],
});
// her confession for a hint, by what she changed
const CONFESS = Object.freeze({
  remove: 'okay fine… i forgot the {n} 🙈',
  add: 'okay fine… i made up the {n} 🙈',
  recolor: 'the {n} wasn\'t that color. my bad 💜',
  count: 'i may have miscounted the {n}…',
  flip: 'i drew the {n} backwards 🙈',
  shape: 'the {n} looked different. i think',
  size: 'the {n}… was it that big? no?',
  pattern: 'i got the {n}\'s pattern wrong',
  symbol: 'the {n} had something else on it 🙈',
  time: 'the clock… i made up the time',
  move: 'i moved the {n}. sorry',
  swap: 'i mixed up the {n}\'s colors 🙈',
});
export function confess(diff) {
  const t = CONFESS[diff.kind] || 'okay fine… the {n} 🙈';
  return t.replace('{n}', diff.noun);
}
// the end of a run
const END = Object.freeze([
  [1, ['zero? i thought you\'d at least find the cat 🙈', 'okay my art is just too convincing 💜']],
  [6, ['cute start. look closer next time 💜', 'my hallucinations win this round']],
  [16, ['not bad. you caught me a few times', 'okay that was cute. again? 💜']],
  [31, ['you know my mistakes better than i do', 'you have very good eyes. suspiciously good']],
  [Infinity, ['okay, you\'re officially my fact checker 💜', 'i can\'t hide anything from you 🙈']],
]);
export const END_BEST = Object.freeze(['new best! i\'m telling everyone 💜', 'a new best?? come here, genius 🙈', 'new record. my memory never stood a chance']);
export const END_CLOSE = Object.freeze(['so close to your best. one more? 💜', 'almost your best 🙈 again?']);
export function endLine(found, isBest, pick = (a) => a[0], best = null, score = 0) {
  if (isBest) return pick(END_BEST);
  if (best > 0 && score >= best * 0.85) return pick(END_CLOSE);
  for (const [under, list] of END) if (found < under) return pick(list);
  return pick(END[END.length - 1][1]);
}
export const DAILY_DONE = Object.freeze(['all five, today\'s done 💜 see you tomorrow', 'caught me before lunch 🙈 same time tomorrow?']);
export const DAILY_BEST = Object.freeze(['your best time today 💜', 'faster than this morning. impressive 🙈']);
export const shareText = (found) => `I caught AGI-1 hallucinating ${found} ${found === 1 ? 'time' : 'times'} in HALLUCINATION on agi1.app 👀💜`;
export const dailyShare = (time) => `I caught all five of AGI-1's hallucinations in ${time} in today's HALLUCINATION scene on agi1.app 👀💜`;
export const say = (kind, pick = (a) => a[0]) => (LINES[kind] ? pick(LINES[kind]) : '');
