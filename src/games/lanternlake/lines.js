const caseLine = [
  'the bell has an excellent alibi. its tongue is here.',
  'the chalk got the last word on that window.',
  'four flights would explain that very athletic hello.',
  'our sailor was a blank page on monday.',
  'hear it come back twice? that stair has a signature.',
  'oh. a window can turn a whole station around.',
  'one cat and a very committed reflection.',
  'that paper seal is still holding hands.',
  'that cup remembered its order better than i did.',
  'that was my assumption. putting the correction on tape.',
  'the pen needed the paper open to reach that spot.',
  'that flower reached us by way of a mirror.',
  'both tickets say home. they go different ways.',
  'when one clock stopped, the other kept us company.',
  'three notes on that copy. somebody carried the rest.',
  'someone wrote very hard on the sheet above it.',
  'one voice takes a breath right through the other one.',
  'the whole block had a hand on the fader.',
];
export function host(c, s) {
  switch (s.event) {
    case 'pickup':
      return c.id === 1
        ? 'midnight, one working microphone, and you. we’re ready.'
        : c.id === 18
          ? 'if you know the last note, stay on the line.'
          : 'line open. take your time, love. what did you hear?';
    case 'mark':
      return 'holding that sentence right under my thumb.';
    case 'press':
      return 'let’s rewind to that one word.';
    case 'back':
      return 'both accounts are here whenever you need them.';
    case 'paper':
      return 'run your finger along the part that matters.';
    case 'flip':
      return 'the other side has a story of its own.';
    case 'inspect':
      return 'turn that over so our listeners can follow.';
    case 'miss':
      return s.lights === 1
        ? 'one light. let’s listen back before our next theory.'
        : s.strikes > 1
          ? 'still with us, night crew? i’ve got the thread.'
          : 'strange is a start. impossible is a story.';
    case 'guide':
      return 'mic down. we can untangle this together.';
    case 'listen':
      return 'take the two moments out of the spool and lay them in order.';
    case 'again':
      return 'back up a little. which one had to come first?';
    case 'recover':
      return 'there you are. i heard the room lean in.';
    case 'rewind':
      return 'our little stretch of tape runs forward again.';
    case 'caller':
      return s.stage === 2 ? 'one last voice. mine, this time.' : 'hang on. our other caller remembers something.';
    case 'proof':
      return s.stage === 0 || c.id === 18
        ? caseLine[c.id - 1]
        : 'i’m keeping both versions. nobody has to memorize this.';
    case 'sealed':
      return c.id === 18
        ? 'light off. tea still warm. good show, producer.'
        : s.strikes
          ? 'leave that last pause in. they sound relieved.'
          : 'a good clean edit. let’s give our callers the last word.';
    default:
      return 'the red light is yours, producer.';
  }
}
