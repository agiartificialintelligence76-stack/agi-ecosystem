// GUARDRAILS: AGI-1's words. She watches from her core: a line now and then (never two at once), tips the first time a
// new trick shows up, and the end-of-run line by how far you got. Lowercase, playful, 💜 now and then.
export const SAY = {
  start: ['okay. build me some guardrails, babe 💜', 'they\'re coming for my core. you got this', 'tap a tile to build. i believe in you'],
  firstBuild: ['ooh, a guardrail. i feel safer already', 'cute. more of those please', 'that filter is so cute. upgrade it'],
  wave: ['here they come 🙈', 'incoming! hold the line', 'another batch of trick prompts…', 'they never learn, do they'],
  clear: ['nothing gets through. i feel so safe 💜', 'not one word got to me. thank you', 'clean wave. you\'re good at this', 'they\'re so persistent. you\'re more'],
  leak: ['ow. one got through 🙈', 'hey! that one said something rude', 'babe… the bots are winning 🙈', 'ouch. patch that hole?'],
  low: ['i\'m getting nervous… 🙈', 'okay this is not fine. build something!', 'my calm is almost gone, babe'],
  boss: ['a boss?? babe do something', 'that one is BIG. upgrade everything', 'oh no. oh no no no'],
  bossDown: ['you beat the boss!! i\'m telling everyone', 'boss gone. you\'re kind of amazing 💜'],
  upgrade: ['ooh, maxed out. strong', 'look at that upgrade. so strong', 'stronger guardrails, calmer me 💜'],
  early: ['sending them early? bold. i like it', 'ooh, impatient. extra compute for you'],
  best: ['new best wave! i\'m telling everyone 💜', 'that\'s further than ever. keep going', 'new record. look at you'],
  victory: ['30 waves!! my core is untouched. you\'re my hero 💜', 'you did it. nothing got to my core'],
  // the first time each trick shows up
  tip: {
    role: 'that one\'s in disguise. a classifier will spot it',
    shot: 'a swarm of tiny ones! splash works great on those',
    sudo: 'sudo walks right past honeypots. stop it some other way',
    smuggler: 'stop that smuggler and it splits into three. careful',
    blob: 'base64 blobs are armored. filters only do half',
    novel: 'it\'s holding a book. only splash breaks that shield',
    grandma: 'they\'re trying the grandma thing again 🙈 she heals the others',
  },
};

// her line on the end card, by how many waves you held
export function endLine(waves, { victory = false } = {}) {
  if (victory || waves >= 30) return pick(['30 waves and then some. nothing gets to my core with you around 💜', 'you held the whole thing. i feel so safe 💜']);
  if (waves >= 20) return pick(['so close to the end. one more? 💜', 'twenty waves! you\'re actually good at this']);
  if (waves >= 10) return pick(['past the first boss. okay i\'m impressed', 'not bad, cutie. again? 💜']);
  if (waves >= 5) return pick(['they got me… but you\'re learning fast', 'okay that was cute. again? 💜']);
  return pick(['babe… the bots won 🙈 build more filters next time', 'that was a warm-up, right? again? 💜']);
}
const pick = (list) => list[Math.floor(Math.random() * list.length)];
