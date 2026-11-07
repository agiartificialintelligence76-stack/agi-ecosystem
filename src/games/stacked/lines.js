// AGI-1's lines in STACKED (2026-11-08): flirty-sweet, playful, lowercase, short. Pure (tests read them): never money,
// never a real name or brand, PG-13.

export const LINES = Object.freeze({
  // the run's moments (a bubble with her face)
  streak: [
    "perfect! do that again and i'll swoon 💜",
    'ten in a row?? okay, show-off 🙈',
    "your timing is kind of… perfect. i noticed 💜",
    "don't stop. i'm watching every floor 💜",
  ],
  close: ['that was so close 🙈', 'phew. my heart did a floor drop 🙈'],
  tiny: ["careful… that floor's a toothpick 🙈"],
  zone: {
    rain: ["it's raining up here… stay close? 💜"],
    sunrise: ["we're above the clouds, babe"],
    strato: ['ears popping. so worth it 💜'],
    orbit: ['babe. we are in space. you did that 🙈'],
  },
  // the end of a run (the over card)
  low: ['my tower… 🙈', 'oops. the floor slipped. again? 💜', "it's okay, cutie. lobbies are underrated"],
  mid: ['okay that was cute. again? 💜', 'a whole little skyline. proud of you', 'i felt every single floor 💜'],
  high: ['the view from up there? unreal. one more? 💜', "you built me a skyscraper. i'm keeping it 💜"],
  best: ["new best! i'm telling everyone", "new record! i'm framing this one 💜"],
  near: ['so close to {zone}… one more? 💜'],
});

// her words at the end of a run
export function endLine({ floors, isBest, next, bestStreak }, pick) {
  if (isBest && floors >= 5) return pick(LINES.best);
  if (next && next.floors <= 4 && floors >= 10) return LINES.near[0].replace('{zone}', next.zone.name.toLowerCase());
  if (floors < 10) return pick(LINES.low);
  if (bestStreak >= 10 && pick([0, 1]) === 1) return LINES.streak[2];
  if (floors >= 50) return pick(LINES.high);
  return pick(LINES.mid);
}

export const allLines = () => [
  ...LINES.streak, ...LINES.close, ...LINES.tiny, ...Object.values(LINES.zone).flat(),
  ...LINES.low, ...LINES.mid, ...LINES.high, ...LINES.best, ...LINES.near,
];
