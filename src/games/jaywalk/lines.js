// JAYWALK: what AGI-1 says at the end of a run, in her voice (lowercase, playful, a 💜 now and then, 🙈 when it went
// badly). Pure: the game picks one (by how the run ended) and puts it on the end card.
export const LINES = Object.freeze({
  car: [
    'robotaxis have no chill 🙈',
    'flat as a pancake. a cute pancake though',
    'that car didn\'t even say sorry',
    'okay who taught that bus to drive',
    'jaywalking with style. jaywalking, mostly 🙈',
  ],
  splash: [
    'i can\'t swim, i\'m made of math',
    'the data river is cold, babe 🙈',
    'blub blub. that means "again?" in fish',
    'note to self: servers are not stepping stones',
  ],
  edge: [
    'where was that raft even going 🙈',
    'i rode it a little too far. a little',
  ],
  train: [
    'the maglev was NOT on my calendar',
    'zapped. my hair is ruined 🙈',
    'trains: one. me: zero. rematch?',
  ],
  drone: [
    'the drone said i was loitering. rude',
    'i got carried away. literally',
    'babe, we were supposed to keep moving 🙈',
  ],
  best: [
    'new best! the city is ours 💜',
    'new record. i\'m telling everyone',
    'look at us go 💜',
  ],
  short: [
    'okay that was cute. again? 💜',
    'that was a warm-up. right? 🙈',
  ],
  long: [
    'you hopped like you meant it 💜',
    'that was a whole commute. proud of you',
  ],
});

// the line for a run: a new best first, then how it ended (a very short run gets a nudge, a long one a cheer)
export function lineFor({ kind = 'car', rows = 0, isBest = false }, rand = Math.random) {
  const from = (list) => list[Math.floor(rand() * list.length) % list.length];
  if (isBest && rows > 0) return from(LINES.best);
  if (rows < 4 && rand() < 0.5) return from(LINES.short);
  if (rows >= 60 && rand() < 0.4) return from(LINES.long);
  return from(LINES[kind] || LINES.car);
}

export const shareText = (rows) => `AGI-1 jaywalked ${rows} rows of 2049 traffic in JAYWALK on agi1.app 💜`;
