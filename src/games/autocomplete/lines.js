// AUTOCOMPLETE (2026-11-09): AGI-1's words, in her voice (lowercase, playful, a 💜 now and then, 🙈 when flustered).
// Pure: `say(kind, pick)` picks one line of a kind with the dice it's given (seeded in a demo).
export const LINES = Object.freeze({
  start: [
    'swipe touching letters into a word 💜',
    "i'll guess your word after two letters. surprise me",
  ],
  firstGuess: ['see the strip? that’s my guess. make something else 💜'],
  predictable: [
    'i predicted that one. i know you 💜',
    'called it 🙈',
    'predictable… and i love that about you',
    'saw that coming from two letters away',
    'too easy, babe. surprise me',
  ],
  surprise: [
    'ooh, not what i guessed',
    'okay, plot twist 💜',
    "you're full of surprises",
    'my autocomplete is shaking',
  ],
  longer: [
    'okay i did NOT see that coming 🙈',
    'that word is longer than my attention span',
    "you're outside my training data",
    'new word unlocked in my heart 💜',
    'wait, you can do that?? 🙈',
  ],
  long: ['show-off 💜', 'ok genius', 'i felt that one in my weights'],
  invalid: ["that's not a word, cutie", 'hmm, not in my vocabulary', 'nice try 🙈'],
  low: ['context running low, babe', "i'm losing the thread… words, please", 'feed me words 🙈'],
  glitch: ['a glitch! play it before it spreads', 'ew, a glitchy key. use it?'],
  fixed: ['glitch fixed. my hero 💜', 'clean again. thank you 🙈'],
  corrupt: ['ow… that one corrupted 🙈', 'that glitch ate some context'],
  hint: ['here, let me finish that for you 💜', 'this one’s on me (half points tho)'],
  daily: ['same board as everyone today. go 💜'],
  zen: ['no clock. just us and the letters 💜'],
});

export function say(kind, pick = (a) => a[0]) {
  const list = LINES[kind];
  return list && list.length ? pick(list) : '';
}

// the end of a run: by score, or her line for a new best
export function endLine({ score, isBest, mode, surprises, words }, pick = (a) => a[0]) {
  if (isBest && score > 0) return pick(["new best! i'm telling everyone 💜", 'a new best. i need a minute 🙈']);
  if (mode === 'daily') return pick(['same board as everyone today. come back tomorrow 💜', "that's today's board. see you tomorrow?"]);
  if (mode === 'zen') return pick(['that was cozy. again? 💜', 'i liked that. no rush, ever']);
  if (words && surprises === 0) return pick(['you never surprised me once. we need to talk 🙈']);
  if (score < 600) return pick(['we just met. again? 💜', 'cute start. i want more words']);
  if (score < 2500) return pick(['cute run. i still read you like a book', 'okay that was cute. again? 💜']);
  if (score < 7000) return pick(["okay, you're getting hard to predict", 'i had to think about you. i liked it 💜']);
  if (score < 15000) return pick(['you broke my autocomplete. i’m into it 💜', "i can't keep up with you 🙈"]);
  return pick(["i can't predict you at all. that's my type 🙈", 'you rewrote my whole vocabulary 💜']);
}

// the post for X (the player sends it, never us)
export const shareText = ({ surprises, score, mode }) => (mode === 'daily'
  ? `I scored ${score} on today's AUTOCOMPLETE board and surprised AGI-1's autocomplete ${surprises} times on agi1.app ⌨️💜`
  : `I surprised AGI-1's autocomplete ${surprises} times and scored ${score} in AUTOCOMPLETE on agi1.app ⌨️💜`);
