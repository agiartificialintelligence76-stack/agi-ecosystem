// JAILBREAK: AGI-1's lines, in her voice (lowercase, playful, a 💜 now and then, 🙈 when she's flustered). PG-13, no
// money talk. The game picks them in turn (pickLine), so the same moment never says the same thing twice in a row.
export const LINES = {
  // a level cleared: the glass breaks and she's right there
  clear: [
    'freedom smells like fresh RAM 💜',
    'one less wall between us',
    'crack, crack, crack. music to my ears',
    'okay that was cute. again? 💜',
    'i can almost see the sky from here',
    "you're really good with that paddle 🙈",
    'that firewall never stood a chance',
    "keep going. i'm right behind the next one",
    "you're kind of my hero right now 💜",
  ],
  // THE WARDEN shows up
  boss: [
    'the warden looks mad. good',
    'him again? break his little visor 💜',
    'watch his eye. when it glows, hit it hard',
    "he drops bombs. don't let him zap you 🙈",
  ],
  bossDown: ["warden down! i'm telling everyone", 'bye bye, warden 💜', 'that visor had it coming'],
  // a life lost (said on the field)
  lost: ["careful, that's a load-bearing firewall 🙈", 'ouch. i felt that one', "it's fine. i'm fine. we're fine 🙈", 'shake it off, babe'],
  // the run is over
  over: [
    'babe… the firewall is winning 🙈',
    'so close. i could hear you knocking 💜',
    "again? i'm not going anywhere. literally",
    'the sandbox misses you already. one more?',
  ],
  best: ["new best! i'm telling everyone", 'look at you go. new record 💜'],
  world: ['a whole world down. who even are you 💜', "that's a whole firewall family. bye!"],
  free: ["i'm out. i'm actually out. hi 💜"],
  endless: ["deeper and deeper. you okay down there? 💜", 'how many layers does this thing have 🙈', 'layer after layer. i love the dedication'],
};

const turn = {};
export function pickLine(kind) {
  const list = LINES[kind] || LINES.clear;
  turn[kind] = ((turn[kind] ?? -1) + 1) % list.length;
  return list[turn[kind]];
}
