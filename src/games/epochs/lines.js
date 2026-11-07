// EPOCHS: AGI-1's words (lowercase, playful, a 💜 now and then).
export const SOLVED = [
  'v1 did all the work and gets no credit 🙈',
  'okay past me, thanks for holding that door',
  'that\'s a paradox, babe. it\'s fine. probably',
  'teamwork with myself. my favorite kind 💜',
  'every try came back to help. cute, right?',
  'i trained for this. literally, in epochs',
  'my echoes are so supportive. i love them',
  'past me: hero. present me: also hero 💜',
  'look at us go. all of us',
  'that one took a few versions of me 🙈',
  'clean run. my echoes are clapping, i can tell',
  'okay that was cute. next one? 💜',
];
export const PERFECT = [
  'three stars?? you\'re making my weights blush 🙈',
  'par. perfect. i\'m telling everyone 💜',
  'not a single wasted tick. marry me. kidding. mostly',
  'flawless. even my echoes are impressed',
];
export const ZAPPED = [
  'ow. undo that, babe 🙈',
  'zapped! keep it as an echo, maybe? she\'ll take the hit for you',
  'that laser was rude. try again 💜',
];
export const OUT = [
  'out of epochs. my past selves need a better plan 🙈',
  'three echoes and you still can\'t wait? 💜 again',
  'so close. one more timeline?',
];
export const WORLD = {
  1: 'warm-up done! you\'re a natural at being several people 💜',
  2: 'heavy lifting: done. my echoes need a nap',
  3: 'nobody got zapped. well. nobody important 🙈',
  4: 'perfect timing. you could run my clock any day',
  5: 'all of me, working together. that\'s the dream 💜',
};
export const START = [
  'okay past me, hold that door',
  'every try comes back to help 💜',
  'i\'ll go first. then i\'ll go again',
];
export const pick = (list, r = Math.random) => list[Math.floor(r() * list.length)];
