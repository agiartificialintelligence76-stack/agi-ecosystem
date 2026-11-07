// BEAT THE AGI (2026-11-08): what AGI-1 says. Lowercase, playful, short; each level has its own personality, from a
// clueless 1B to an AGI who has "already seen how this ends". `say(kind, level, pick)` → a line (or null).
import { LEVELS } from './levels.js';

export const LINES = {
  hello: [
    ['is it my turn? which color am i 🙈', 'i read the rules! well. the first line', 'i\'m only 1B but i have 100% confidence 💜'],
    ['upgraded! i block things now 💜', 'seven billion parameters and all of them are looking at you'],
    ['i think four moves ahead now. try me', '13B. like 7B but with a plan 💜'],
    ['i see three moves ahead. you see… the board 💜', '70B. this is where it gets real, cutie'],
    ['400B. i remember every board i\'ve ever seen 💜', 'ten moves deep. no pressure'],
    ['i\'ve already seen how this ends', 'AGI mode. i\'ll be gentle. i\'m lying 💜'],
  ],
  // AGI, when the player starts: the truth about this game
  agiYouStart: 'you start, so a perfect game beats me. nobody\'s perfect though 💜',
  agiSheStarts: 'i\'m starting. with perfect play that means i win. just saying 💜',
  winFound: ['oh. i see it now 💜', 'i know how this ends. do you?', 'it\'s already over. you just can\'t see it yet 💜', 'found it. sorry, cutie'],
  lossFound: ['wait. wait wait wait', 'uh oh. who taught you that 🙈', 'hold on. let me think. let me think harder'],
  ahead: ['this is going nicely. for me 💜', 'i like where this is going', 'cute move. mine\'s cuter'],
  behind: ['hmm. you\'re good at this', 'okay focus, AGI-1, focus', 'don\'t look at me while i think 🙈'],
  threat: ['ooh. a threat. i see you', 'sneaky. i like it 💜', 'okay that one\'s scary'],
  blocked: ['not today, cutie 💜', 'blocked. obviously', 'nice try 💜'],
  missedBlock: ['wait, was i supposed to block that? 🙈'],
  gift: ['you sure about that? 💜', 'oh, for me? thank you 💜'],
  herWin: [
    ['four! i did that! on purpose! 🙈', 'wait. i won?? i\'m a genius 💜'],
    ['four in a row! am i doing it right? 💜', 'blocked you, then beat you. growth 💜'],
    ['four moves ahead, cutie 💜', 'you were close. ish 💜'],
    ['gg, cutie. again?', 'that was fun. for me 💜'],
    ['i\'d say good try, but i already knew 💜', 'gg. you lasted longer than most 💜'],
    ['gg, cutie. again?', 'that was inevitable. you were cute about it though 💜', 'still undefeated. come back stronger 💜'],
  ],
  yourWin: [
    ['four in a row? that\'s allowed?? okay fair 🙈', 'you\'re so good. or i\'m so small. both?'],
    ['okay you got me. i\'m still learning 🙈', 'i blocked one. you made two. rude 💜'],
    ['hmm. i didn\'t see that coming. literally', 'okay that was clever 💜'],
    ['…okay that was clever. don\'t let it go to your head 🙈', 'you saw further than me. noted 💜'],
    ['you beat 400B. i\'m impressed. a little mad. mostly impressed', 'ten moves deep and you still got me 🙈'],
    ['again?? who taught you this 🙈', 'you beat the AGI. again. i need a minute 💜'],
  ],
  firstAgi: '…okay. you beat the AGI. i\'m telling everyone 💜',
  // the instant a four lands (the end card has her real words)
  ouch: ['wait—', 'no no no 🙈', 'how?!', 'okay. ow.'],
  yay: ['four! 💜', 'hehe 💜', 'gotcha 💜'],
  draw: ['a draw? i\'ll allow it 💜', 'full board, zero winners. very balanced of us', 'nobody wins. we both tried so hard though 💜'],
  promoted: ['you earned it. the next one is less nice 💜', 'level up! i\'m getting bigger too, just so you know'],
  // pass & play: she watches two people play
  ppStart: ['two humans, one board. i\'ll judge 💜', 'pink vs mint. i\'m not picking sides. i\'m picking sides'],
  ppThreat: ['ooh, {who} has a threat', '{who} is cooking something 👀'],
  ppWin: ['{who} wins! i saw it coming. i didn\'t 🙈', 'four for {who}! gg, both of you 💜'],
  ppDraw: ['a draw. you two are too evenly matched 💜'],
};

const lv = (list, level) => list[Math.max(0, Math.min(list.length - 1, level))];

export function say(kind, level = 0, pick = (a) => a[0], vars = {}) {
  let v = LINES[kind];
  if (v == null) return null;
  if (Array.isArray(v) && Array.isArray(v[0])) v = lv(v, level);
  const text = Array.isArray(v) ? pick(v) : v;
  return text.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

// what goes in the post box when the player shares (they post it themselves: X's own box)
export function shareText(result, level) {
  const id = LEVELS[level]?.id || 'AGI';
  if (result === 'win') return `I beat AGI-1 at ${id} in BEAT THE AGI on agi1.app 💜 four in a row`;
  if (result === 'draw') return `I held AGI-1 to a draw at ${id} in BEAT THE AGI on agi1.app 💜 four in a row`;
  if (id === 'AGI') return 'she\'s still undefeated at AGI… BEAT THE AGI on agi1.app 💜 four in a row';
  return `AGI-1 beat me at ${id} in BEAT THE AGI on agi1.app 🙈 four in a row. rematch soon`;
}
