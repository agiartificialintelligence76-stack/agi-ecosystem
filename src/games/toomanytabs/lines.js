// TOO MANY TABS: what AGI-1 says (her voice: lowercase, playful, a 💜 now and then; PG-13; never money).
import { KINDS } from './rules.js';

export const LINES = Object.freeze({
  start: ['ok i might have a tab problem', 'close them in threes. i’ll stop opening new ones. probably', 'my laptop fan sounds like a jet. help', 'every tab is important. except all of them', 'please save my browser 💜'],
  daily: ['today’s mess is the same for everyone. good luck', 'daily cleanup! the internet thanks you'],
  rush: ['speed round! close close close', 'the tabs keep coming. go go go 💜', 'tick tock, tab clock'],
  triple: ['closed ✓', 'bye bye tabs', 'so much faster already', 'three down 💜', 'my ram says thank you', 'clean.'],
  streak: ['streak! keep closing!', 'you’re on fire. my fan is cooling down', 'combo!! my browser loves you', 'tab-closing machine 💜'],
  pair: ['ooh a pair. find the third', 'two of them… where’s the third', 'one more of those and they’re gone'],
  crowded: ['taskbar’s getting full…', 'careful, careful', 'five tabs in the bar. eek', 'one wrong tap and it freezes 😳'],
  blocked: ['that one’s under something', 'can’t reach it yet, babe', 'something’s on top of it'],
  undo: ['undo! nobody saw that', 'ctrl+z, the best key'],
  shuffle: ['shuffled! fresh eyes', 'mixed them up. new chances'],
  out: ['parked three on the shelf. breathing room', 'tab out! i’ll deal with those later'],
  revive: ['force quit and back! close the shelf ones too', 'phew. un-frozen 💜'],
  full: ['frozen. my browser is frozen', 'not responding… classic', 'spinning wheel of doom 😭'],
  clear: ['ALL CLOSED. i can hear my fan again 💜', 'clean desktop. i love you', 'zero tabs. is this what peace feels like', 'you did it! now i’ll open more. kidding. mostly'],
  three: ['three stars?! speed demon', 'perfect cleanup 💜', 'that was so fast i didn’t even see it'],
  best: ['new best! screenshot it 💜', 'record time!! again again'],
  endLow: ['we’ll get them next time', 'that’s okay, i’ll just download more ram. kidding', 'one more try? 💜'],
  endHigh: ['you’re a tab-closing legend', 'my browser has never been this happy', 'hire this person 💜'],
});
const counters = new Map();
export function say(kind) {
  const list = LINES[kind];
  if (!list?.length) return '';
  const i = counters.get(kind) || 0;
  counters.set(kind, i + 1);
  return list[(i * 5 + Math.floor(Math.random() * list.length)) % list.length];
}
// the kind she's thinking about, in words
export const kindLine = (kind) => `three more ${KINDS[kind].name} to go…`;
export const TIPS = Object.freeze({
  tap: 'Tap a tab on top of the pile: it drops into her taskbar.',
  three: 'Three alike in the taskbar close. Seven with no three: frozen!',
  helpers: 'Stuck? Undo, Shuffle and Tab out are under the taskbar (one each a board).',
  hidden: 'Tabs buried deep are face down now. Clear the top to see them.',
});
export const shareText = ({ mode, level, score, time }) => mode === 'levels'
  ? `I closed every tab on level ${level} of TOO MANY TABS on agi1.app 💜 my browser is free`
  : mode === 'rush' ? `I closed ${score.toLocaleString('en-US')} points of tabs in a TOO MANY TABS rush on agi1.app 💜 can you beat it?`
    : `I cleared today’s TOO MANY TABS daily in ${Math.round(time)}s on agi1.app 💜 can you beat it?`;
