// HOTFIX: what AGI-1 says (her voice: lowercase, playful, a 💜 now and then; PG-13; never money).
export const LINES = Object.freeze({
  start: ['bugs in my code again. help me squash them 💜', 'drag one chip, make lines. you know the drill', 'deploying hotfix in 3… 2…', 'let’s debug together'],
  daily: ['today’s bugs are the same for everyone. good luck 💜', 'daily hotfix! no pressure. some pressure'],
  lab: ['combo lab! no bugs, just vibes', 'practice mode. go for a huge combo'],
  combo3: ['nice combo!', 'three in one go 💜', 'clean.'],
  combo5: ['FIVE COMBO. you’re cooking', 'that’s a big patch', 'the bugs felt that'],
  combo7: ['SEVEN?! are you a compiler', 'i have never been this optimized 💜', 'legendary refactor'],
  weak: ['super effective!', 'right where it hurts', 'weak spot!'],
  kill: ['squashed!', 'bug fixed ✓', 'one less bug 💜', 'closed as resolved'],
  boss: ['BOSS BUG. this one’s big', 'oh no. it’s the legacy code', 'stay calm. we’ve got this 💜'],
  bite: ['ow! my uptime', 'it bit me 😭', 'that hurt my servers'],
  low: ['uptime’s low… debug chips please', 'i need healing. green chips!', 'one more bite and i crash'],
  heal: ['patched! feeling better', 'debug chips are my favorite 💜'],
  corrupt: ['it turned chips into junk!', 'junk chips. clear lines next to them'],
  lock: ['locked chips! work around them', 'merge conflicts everywhere'],
  floor: ['floor cleared! pick a patch', 'deeper we go 💜', 'all bugs fixed on this floor'],
  patch: ['ooh, good patch', 'installed. i feel stronger', 'upgrade accepted 💜'],
  crash: ['kernel panic… i crashed', 'too many bugs. reboot?', 'we’ll fix them next time 🥺'],
  best: ['new record! deepest debug ever 💜', 'best run yet!!'],
});
const counters = new Map();
export function say(kind) {
  const list = LINES[kind];
  if (!list?.length) return '';
  const i = counters.get(kind) || 0;
  counters.set(kind, i + 1);
  return list[(i * 5 + Math.floor(Math.random() * list.length)) % list.length];
}
export const TIPS = Object.freeze({
  drag: 'Press a chip and drag it around: it swaps with every chip it passes. Let go to match lines of 3+.',
  target: 'Tap a bug to target it. Colors under it: ×2 means it’s weak to that kind, ½ that it resists it.',
  debug: 'Green Debug chips heal her uptime.',
});
export const shareText = ({ mode, floor, combo, score }) => mode === 'lab'
  ? `I hit ${score.toLocaleString('en-US')} damage in the HOTFIX combo lab (best combo ${combo}) on agi1.app 💜`
  : `I squashed bugs down to floor ${floor} in HOTFIX with a ${combo}-combo on agi1.app 💜 can you go deeper?`;
