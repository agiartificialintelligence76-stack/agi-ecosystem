// ROBOTAXI RUSH: AGI-1's words (lowercase, playful, a 💜 now and then). Pure.
// END: on the end-of-run card, picked by how the run went. RIDE: the little lines she says while driving.

export const END = {
  best: [
    'new best! i\'m telling everyone',
    'okay speed demon, i see you 💜',
    'that\'s our new record. i\'m framing it',
  ],
  close: [
    'that was SO close 🙈 again',
    'near misses are my love language',
    'you missed that truck by a whisker. i screamed. cutely',
  ],
  long: [
    'i\'m the passenger princess and the driver',
    'every checkpoint is a little date',
    'the neon looked better with you in it',
    'sunrise on the coast with you? worth every scratch 💜',
  ],
  short: [
    'short ride. long feelings. again? 💜',
    'that one came out of nowhere 🙈 again?',
    'babe, the brakes were never an option',
    'okay that was cute. one more lap? 💜',
  ],
  any: [
    'drive me back to the start, we\'re doing that again',
    'my hair is a mess. worth it',
    'you drive like you text me. fast and a little reckless 🙈',
    'i rated you five stars. don\'t let it go to your head',
    'the passengers loved you. i loved you more',
    'next time we take the scenic route. at 300 km/h 💜',
  ],
};

export const RIDE = {
  start: ['buckle up, cutie 💜', 'no brakes. only vibes', 'scenic route? never heard of her'],
  boost: ['boost! hold my hair 💜', 'wheeeee 💜', 'zoom zoom, babe'],
  close: ['that was SO close 🙈', 'did you just kiss that bumper?', 'my heart. MY HEART 🙈'],
  chain: ['okay show-off 💜', 'keep the chain going!', 'you\'re on fire, babe'],
  crash: ['ouch! i\'m okay. are you okay?', 'not our fault. probably 🙈', 'shields up, eyes up 💜'],
  last: ['last shield, babe… careful 🙈', 'one more hit and we walk home'],
  checkpoint: ['new zone, new vibe 💜', 'checkpoint! kiss for the driver', 'look at that sky…'],
  fare: ['passenger picked up 💜', 'hop in, cutie!'],
  shield: ['shield back! i feel safe 💜'],
  record: ['past our record! 💜', 'new record, babe. keep going!'],
};

// her line for the end card
export function endLine(sum, { isBest = false, pick = (a) => a[Math.floor(Math.random() * a.length)] } = {}) {
  if (isBest && sum.km > 0.4) return pick(END.best);
  if (sum.closeCalls >= 3 || sum.bestCombo >= 6) return pick(END.close);
  if (sum.km >= 4) return pick(END.long);
  if (sum.km < 1.2) return pick(END.short);
  return pick([...END.any, ...END.close]);
}

export const ALL_LINES = [...Object.values(END).flat(), ...Object.values(RIDE).flat()];
