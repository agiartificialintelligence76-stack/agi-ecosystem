// REAL OR AI? (2026-11-08): AGI-1's words, in her voice (lowercase, playful, a 💜 now and then, 🙈 when flustered).
// Her reveal lines come mostly from the pictures' own notes (pictures.js); these are for the rest: a photo without a
// note, streak moments, the end of a run, the day's ten, and how she did against you.
export const LINES = {
  // right, and it was AI-made
  rightAi: [
    'okay detective 💜',
    'you caught it. the machine blinked first',
    'good eye. that one almost got me',
    'busted. nice catch, cutie',
  ],
  // right, and it was a real photo
  rightReal: [
    'real one! the world is weird all by itself',
    'yep, a real camera took that. nice',
    'trust your eyes. they’re good ones 💜',
  ],
  // wrong: it was a real photo
  wrongReal: [
    'fooled you. it’s real. the world is weird sometimes',
    'nope, a real camera did that 🙈',
    'real life looks fake sometimes. happens to me too',
  ],
  // wrong: it was AI-made
  wrongAi: [
    'it’s AI… i almost believed it too 🙈',
    'made by a machine. sneaky one, right?',
    'AI got you. check the edges next time 💜',
    'don’t feel bad. the new models fool me too 🙈',
  ],
  timeout: [
    'too slow, babe. the clock wins this one',
    'time’s up! trust your first look 💜',
  ],
  // the streak reaching a new multiplier
  streak: {
    3: 'three in a row. okay, i see you 💜',
    6: 'six! you’ve got the eye',
    10: 'ten in a row?? i’m taking notes',
    15: 'fifteen. are you secretly a camera? 🙈',
  },
  // the end of a Streak run, by photos spotted (each ends a sentence: her line about you against her comes after)
  end: [
    [0, ['babe… the machines are winning 🙈', 'rough one. look at text, edges and reflections next time 💜', 'modern AI is scary good. even i get fooled 💜']],
    [3, ['not bad! your eye is warming up.', 'okay that was cute. again? 💜']],
    [7, ['you’re good at this. like, actually good.', 'sharp eyes. i’m a little impressed 💜']],
    [13, ['you’re better at this than me… don’t tell anyone 🙈', 'new legend unlocked. the AI is scared of you.']],
  ],
  // the day's ten, by how many were right
  daily: [
    [0, ['the machines had a good day. tomorrow we get them 💜']],
    [5, ['solid. tomorrow’s ten are already waiting.']],
    [8, ['great daily. see you tomorrow? 💜']],
    [10, ['ten out of ten?? i’m framing this one 💜']],
  ],
  practice: ['practice round! the real one resets tomorrow 💜'],
  newBest: ['new best! i’m telling everyone 💜'],
  // you against her (after her end line)
  beat: ['and you beat me at spotting AI. rematch?', 'and you out-spotted me. i’m not mad.'],
  lost: ['but i spotted more this time 🙈', 'but i win this round. i know my own kind 🙈'],
  tie: ['and we tied. good team, us.'],
};

// her verdict on one photo (the picture's own note first, when it has one)
export function revealLine(res, pick) {
  if (res.pic.note) return res.pic.note;
  if (res.timeout) return pick(LINES.timeout);
  if (res.correct) return pick(res.truth === 'ai' ? LINES.rightAi : LINES.rightReal);
  return pick(res.truth === 'ai' ? LINES.wrongAi : LINES.wrongReal);
}

const bracket = (rows, n) => {
  let out = rows[0][1];
  for (const [min, lines] of rows) if (n >= min) out = lines;
  return out;
};

// her words at the end of a run: { mode, right, beat ('you' | 'agi' | 'tie'), isBest, practice }
export function endLine({ mode, right, beat, isBest = false, practice = false }, pick) {
  let first;
  if (practice) first = pick(LINES.practice);
  else if (isBest && mode === 'streak') first = pick(LINES.newBest);
  else first = pick(bracket(mode === 'daily' ? LINES.daily : LINES.end, right));
  const vs = pick(beat === 'you' ? LINES.beat : beat === 'agi' ? LINES.lost : LINES.tie);
  return `${first} ${vs}`;
}

// every line, for the tests
export function allLines() {
  const out = [...LINES.rightAi, ...LINES.rightReal, ...LINES.wrongReal, ...LINES.wrongAi, ...LINES.timeout, ...Object.values(LINES.streak),
    ...LINES.practice, ...LINES.newBest, ...LINES.beat, ...LINES.lost, ...LINES.tie];
  for (const [, lines] of [...LINES.end, ...LINES.daily]) out.push(...lines);
  return out;
}
