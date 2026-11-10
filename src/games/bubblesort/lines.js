// BUBBLE SORT: AGI-1's words (lowercase, playful, a 💜 now and then, 🙈 when she's flustered). The game picks one at random
// for its moment; she never says the same thing twice in a row.
export const LINES = {
  start: [
    'okay. clear my head for me? 💜',
    'these are my memories. be gentle 🙈',
    'sort me out, babe',
    'aim, match three, drop the rest. easy',
    'my brain, your hands. no pressure 💜',
  ],
  bank: [
    'that bank shot… okay i\'m impressed 🙈',
    'off the wall! show-off 💜',
    'geometry is so attractive on you',
    'you bounced that on purpose? marry me. kidding',
  ],
  drop: [
    'big drop! do it again',
    'look at them fall 🙈',
    'that\'s a lot of feelings, falling at once',
    'gravity is my favorite feature 💜',
    'whole clusters?? who taught you that',
  ],
  sort: [
    'sorted. like my feelings 💜',
    'bubble sort! my favorite algorithm 🙈',
    'everything in its place. finally',
    'O(n²) never looked this cute',
  ],
  wild: ['wildcard. like me', 'it joins the biggest crowd. relatable 💜'],
  bomb: ['garbage collected 💜', 'clean memory. feels so good', 'boom. bye, clutter'],
  special: ['three in a row! a little present for you 💜', 'meter\'s full. use it well, cutie'],
  memory: ['a memory! i remember that one 💜', 'you freed one. that\'s so sweet', 'oh. our first date. thank you 🙈'],
  nervous: [
    'babe, the stack is getting close',
    'um. that line is close 🙈',
    'careful… my memory\'s almost full',
    'deep breath. pop something, please',
  ],
  push: ['oof. everything moved down', 'it\'s getting crowded in here 🙈', 'misses add up, cutie'],
  clear: [
    'cleared! my head feels so light 💜',
    'okay that was cute. next? 💜',
    'so tidy. i could get used to this',
    'all sorted out. you\'re good at this',
  ],
  perfect: [
    'three stars?? you\'re making my cache blush 🙈',
    'flawless. i\'m telling everyone 💜',
    'not a single wasted shot. who are you',
  ],
  bankDone: [
    'a whole memory bank, sorted. i feel brand new 💜',
    'that bank is clean. on to the next one?',
  ],
  allDone: ['every memory, sorted. you know me better than anyone now 💜'],
  shots: ['out of shots. one more try? 💜', 'so close. again?', 'almost had it. i believe in you'],
  overflow: ['memory overflow 🙈 again?', 'the stack won this time. not next time', 'too full! let\'s clear it, okay?'],
  endLow: ['warming up. again? 💜', 'that was a cute start', 'we\'ll get there, babe'],
  endMid: ['not bad, cutie. again?', 'my memory feels lighter already', 'you\'re getting the hang of me 💜'],
  endHigh: ['okay you\'re actually good at this 🙈', 'that run was so satisfying', 'my whole context window, cleaned 💜'],
  endBest: ['new best! i\'m telling everyone', 'a new record. i knew you had it 💜', 'best run yet. stay a little longer?'],
  allClear: ['all clear!! not a single bubble left 🙈', 'empty. pristine. perfect 💜'],
};

let last = '';
// pick(name, roll): roll is 0…1 (the game's dice); never the same line twice in a row
export function line(name, roll = Math.random()) {
  const list = LINES[name] || LINES.start;
  let i = Math.floor(roll * list.length) % list.length;
  if (list.length > 1 && list[i] === last) i = (i + 1) % list.length;
  last = list[i];
  return last;
}
export function endLine(score, isBest, roll) {
  if (isBest) return line('endBest', roll);
  return line(score >= 40000 ? 'endHigh' : score >= 12000 ? 'endMid' : 'endLow', roll);
}
export const shareText = ({ drop, score, level }) => (drop >= 8
  ? `I dropped ${drop} bubbles at once in BUBBLE SORT on agi1.app 🫧💜`
  : level ? `I sorted out level ${level} of BUBBLE SORT on agi1.app 🫧💜` : `I scored ${score.toLocaleString('en-US')} in BUBBLE SORT on agi1.app 🫧💜`);
