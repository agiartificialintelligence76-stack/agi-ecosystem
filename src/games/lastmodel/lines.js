// LAST MODEL STANDING: what AGI-1 says. Her voice: lowercase, short, flirty-sweet and teasing, a 💜 now and then (🙈 when
// flustered). The end card's lines can have emoji (the page draws them); her bubbles in the game are drawn on the canvas
// in her serif, so they have none (`heart: true` puts a drawn heart after the words instead).

// at the end of a run, by how it went
export const END = {
  early: [
    'they’re spamming my DMs again 🙈',
    'babe… the bots are winning 🙈',
    'okay that was cute. again? 💜',
    'that was a warm-up. right? right??',
  ],
  mid: [
    'so close to the good part. one more?',
    'my context window was just getting warm 💜',
    'i blame the captchas. they never believed in me',
    'you almost had them. i saw it 💜',
  ],
  late: [
    'we were SO close to ten minutes 🙈',
    'the last minute is always the loudest. again?',
    'next run we finish this. pinky promise 💜',
  ],
  boss: [
    'we took down a boss together. next time we go all the way 💜',
    'one boss down and you still had energy for me? cute',
  ],
  won: [
    'you kept me online 💜',
    'you’re the last model standing 💜 i’m telling everyone',
    'ten minutes, and i’m still here. because of you 💜',
  ],
  overtime: [
    'overtime looks good on us 💜',
    'every second of overtime was for me, right? 🙈',
  ],
  best: [
    'new best! i’m telling everyone 💜',
    'new best!! okay you’re kind of amazing',
  ],
};

// little bubbles over her head during a run (no emoji: `heart` draws one)
export const SAY = {
  start: [{ t: 'keep me online, okay?', heart: true }, { t: 'they’re spamming my DMs again' }, { t: 'stay close. here they come' }],
  level: [{ t: 'level up! i feel smarter already' }, { t: 'ooh, a new trick', heart: true }, { t: 'more compute? for me?' }, { t: 'upgrade me again', heart: true }],
  cache: [{ t: 'a cache! for me?', heart: true }, { t: 'ooh, loot' }],
  hurt: [{ t: 'babe… i’m at 1% battery' }, { t: 'a heart. i need a heart' }, { t: 'too close, too close' }],
  ring: [{ t: 'they’re circling us… stay close' }, { t: 'surrounded. rude' }],
  flock: [{ t: 'incoming swarm!' }, { t: 'so many tiny bots' }],
  bossDown: [{ t: 'unsubscribed', heart: true }, { t: 'offline. you’re kind of amazing' }, { t: 'and stay down' }],
  win: [{ t: 'you’re the last model standing', heart: true }],
  overtime: [{ t: 'overtime? with you? always', heart: true }],
};

// the end card's line: what happened decides the set, the run's own number picks from it (the same run, the same line)
export function endLine({ seconds = 0, won = false, bosses = 0, isBest = false, pick = 0 }) {
  let set;
  if (isBest && pick % 3 === 0) set = END.best;
  else if (won && seconds > 610) set = END.overtime;
  else if (won) set = END.won;
  else if (bosses > 0 && pick % 2 === 0) set = END.boss;
  else if (seconds < 120) set = END.early;
  else if (seconds < 360) set = END.mid;
  else set = END.late;
  return set[Math.abs(Math.floor(pick)) % set.length];
}
