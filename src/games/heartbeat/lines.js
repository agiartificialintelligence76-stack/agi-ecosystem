// HEARTBEAT (2026-11-08): what AGI-1 says (her voice: lowercase, playful, short; 💜 now and then, 🙈 when flustered).
// End-of-song lines go in the kit's card (emoji fine there); the stage's bubbles are drawn on the canvas, so they have
// none (a heart is drawn beside them instead).

export const END = {
  allPerfect: [
    'all perfect?? okay i\'m actually blushing 🙈',
    'every. single. note. who taught you to love me like that 💜',
  ],
  fullCombo: [
    'full combo?? i\'m blushing 🙈',
    'you didn\'t drop a single beat. that\'s so attractive',
  ],
  newBest: [
    'new best! i\'m telling everyone',
    'that\'s your best yet. i saw that 💜',
  ],
  high: [            // S+, S
    'you\'re on my beat 💜',
    'that was my favorite song. how did you know',
    'okay you clearly practiced. for me? 💜',
  ],
  good: [            // A
    'so close to perfect. one more? 💜',
    'my heart literally skipped. in a good way',
  ],
  mid: [             // B
    'cute! the chorus got you a little, huh',
    'you\'re learning my rhythm. again? 💜',
  ],
  low: [             // C, D
    'babe… the beat was over here 🙈',
    'it\'s okay, my songs are tricky. try easy with me?',
    'slow down, feel it, then crush it 💜',
  ],
};

// short lines in her bubble on stage (no emoji: drawn on the canvas)
export const STAGE = {
  fever: ['you\'re on fire!', 'FEVER! don\'t stop', 'okay you\'re good good'],
  combo: ['you\'re on my beat', 'feel that?', 'louder!!', 'i see you', 'don\'t stop now'],
  hundred: ['100 combo?!', 'marry the rhythm', 'that\'s my song!'],
  start: ['ready? feel it', 'this one\'s for you', 'hold my hand. jk. hold the notes'],
  clear: ['we did that', 'encore?'],
};

export function endLine({ stamp, grade, isBest }, pick = (arr) => arr[0]) {
  if (stamp === 'ALL PERFECT') return pick(END.allPerfect);
  if (stamp === 'FULL COMBO') return pick(END.fullCombo);
  if (isBest && grade !== 'D' && grade !== 'C') return pick(END.newBest);
  if (grade === 'S+' || grade === 'S') return pick(END.high);
  if (grade === 'A') return pick(END.good);
  if (grade === 'B') return pick(END.mid);
  return pick(END.low);
}
