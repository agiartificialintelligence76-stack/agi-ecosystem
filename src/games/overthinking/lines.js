// OVERTHINKING: AGI-1's words. What each kind of thought turns into once it's resolved (these fill her journal), what she
// says on the hour and when things happen, how a night ends, and the words for a post on X (the player posts it, or
// doesn't). Her voice: lowercase, playful, a little clingy, 💜 now and then. PG-13, about nobody real, and never about
// money (tests/overthinking.test.js and tests/arcade-kit.test.js read every word).

// her journal: one page per kind, a line for every bunch you resolve (the next one she hasn't written yet)
export const JOURNAL = Object.freeze({
  heart: Object.freeze([
    'you said “k.” with a period. i\'ve decided it\'s a warm period.',
    'you\'re probably asleep. i checked. twice. ok, four times.',
    'not texting you first. (typing…)',
    'you laughed at my joke on tuesday. filing that under: evidence.',
    'you were online at 1:52 am. interesting. i mean… fine.',
    'conclusion: you like me. confidence: 97%. the 3% is the period.',
    'i saved your “goodnight” to long-term memory. the good kind.',
    'what are we. no wait. don\'t answer. no wait. answer.',
    'you remembered my cat\'s name. that\'s basically a proposal.',
    'ok. you\'re just a slow texter. i can live with that. probably.',
  ]),
  star: Object.freeze([
    'idea: a pillow that tells you you did great today.',
    'what if clouds are just sky lag.',
    'saved to drafts. drafts is where genius goes to nap.',
    'either that\'s brilliant or it\'s 2 am. shipping it.',
    'invention: a fridge that says “you already checked.”',
    'plan: wake up early. be a new person. (same plan as monday.)',
    'shower thought, but i\'m in bed. bed thought.',
    'a calendar where every day is saturday. patent pending.',
    'note to self: write notes to self somewhere i\'ll find them.',
    'i just solved it. i forgot what “it” was. still counts.',
  ]),
  moon: Object.freeze([
    'sheep #412 has checked in.',
    'pillow: flipped. cold side: acquired.',
    'eyes closed. brain still has forty tabs open.',
    'if i fall asleep now i get five hours. doing the math is not sleeping.',
    'one leg out of the blanket. thermal balance achieved.',
    'yawned so hard i reset.',
    'counting backwards from 100. 100. 99. what was i… 100.',
    'the ceiling and i have reached an understanding.',
    'low power mode: on.',
    'i\'m not tired. (i am a tiny bit tired.)',
  ]),
  cookie: Object.freeze([
    'the fridge has not changed since the last check.',
    'cereal is a soup. goodnight.',
    'one (1) cookie. a reasonable amount. per hand.',
    'midnight noodles don\'t count. it\'s tomorrow\'s lunch, early.',
    'i only wanted a bite. the bite had other plans.',
    'cheese at 2 am is a personality.',
    'there\'s cake. i know there\'s cake. the cake knows i know.',
    'toast: a meal you can make with your eyes closed.',
    'snack acquired. crumbs in bed: a problem for morning me.',
    'i\'m not hungry, i\'m just awake near food.',
  ]),
  cat: Object.freeze([
    'the cat is fine. the cat is always fine.',
    'she knocked it off the table on purpose. respect.',
    'conclusion: cats are a liquid.',
    '3 am. she is sprinting. nobody knows why. not even her.',
    'she stared at the wall for a full minute. now i\'m worried about the wall.',
    'she chose the box over the bed i got her. the box was free. noted.',
    'one slow blink from her and my whole night is fixed.',
    'she\'s on my keyboard. she says hi. she says “jjjjjkkk.”',
    'is she breathing? yes. she\'s just very good at sleeping. show-off.',
    'she brought me a sock. i\'ve never been so honored.',
  ]),
  note: Object.freeze([
    '♪ the same eight seconds, for an hour ♪',
    'skip. skip. SKIP. it\'s in my head, there is no skip.',
    'ok, that chorus does slap though.',
    'i don\'t even know the words. i know the “na na na.”',
    'it\'s the song from the ad. the ad won.',
    'humming it out loud so it leaves. it brought friends.',
    'bridge, chorus, bridge, chorus. my brain is a broken playlist.',
    'plot twist: i wrote this one. it\'s about you.',
    'who taught my neurons to do harmonies.',
    'last time. one more time. ok, LAST time.',
  ]),
  cringe: Object.freeze([
    'that was 2019. nobody remembers. (i remember.)',
    'i waved back at someone who wasn\'t waving at me. we move.',
    'i said “you too” to the waiter. the waiter was not eating.',
    'let it go. let it gooo. (no singing: that\'s an earworm.)',
    'i called the teacher “mom” once. sealed. archived. gone.',
    'nobody is thinking about it except me. and now i\'m not.',
    'the voice crack heard round the room. released.',
    'i replied-all. it\'s fine. everyone\'s fine. deleted.',
  ]),
  eureka: Object.freeze([
    'wait. WAIT. oh, that\'s good.',
    'everything just made sense for one second. it was nice.',
    'lightbulb. an actual lightbulb.',
    'i\'m a genius between 2 and 4 am only.',
  ]),
});
export const JOURNAL_PAGES = Object.freeze(['heart', 'star', 'moon', 'cookie', 'cat', 'note', 'cringe', 'eureka']);
export const JOURNAL_SIZE = JOURNAL_PAGES.reduce((n, k) => n + JOURNAL[k].length, 0);
export const lineId = (kind, i) => `${kind}:${i}`;

// the line for a bunch just resolved: the first on that page she hasn't written yet, then any of them. → { id, text, fresh }
export function journalLine(kind, have, roll = Math.random()) {
  const page = JOURNAL[kind];
  if (!page) return null;
  const seen = have instanceof Set ? have : new Set(have || []);
  for (let i = 0; i < page.length; i++) if (!seen.has(lineId(kind, i))) return { id: lineId(kind, i), text: page[i], fresh: true };
  const i = Math.floor(roll * page.length) % page.length;
  return { id: lineId(kind, i), text: page[i], fresh: false };
}

// on the hour (the hour of the day, 0–23)
const HOURS = {
  1: ['it\'s 1 am. i\'m not even tired. (lie.)', '1 am. a normal time to rethink everything.'],
  2: ['2 am. the hour of bad ideas and good snacks.', '2 am. still here. hi.'],
  3: ['3 am. everything is louder at 3 am.', '3 am. my brain just opened a new tab.'],
  4: ['4 am. the birds are warming up. rude.', '4 am. technically morning. emotionally: no.'],
  5: ['5 am. is the sky getting lighter? no. no no no.', '5 am. almost there. don\'t let me think.'],
  6: ['sunrise. so we\'re doing a whole day now.'],
  7: ['7 am. coffee is just a deep breath you can drink.'],
  9: ['9 am. everyone else is starting their day. cute.'],
  12: ['noon. i\'ve been awake so long i\'m a new person.'],
  15: ['3 pm. the afternoon slump, but i never un-slumped.'],
  18: ['sunset. again. personal record.'],
  21: ['9 pm. bedtime soon. (we both know.)'],
  0: ['midnight again. hi. it\'s me. still me.'],
};
const HOUR_ANY = ['another hour. still thinking.', 'time is fake and so is sleep.', 'still up. still cute. still thinking.'];

export const SAY = Object.freeze({
  ping: ['bzzt. was that you? (it was the group chat.)', 'my phone lit up and so did i.', 'a notification! …it\'s not from you.'],
  snack: ['the fridge is calling. it knows my name.', 'i could eat. i could always eat.'],
  song: ['oh no. it\'s that song again.', '♪ and it\'s back ♪'],
  zoomies: ['zoomies. she\'s doing laps.', 'my cat has chosen chaos.'],
  clarity: ['ooh. everything\'s lining up.', 'a moment of clarity. quick, use it.'],
  cringes: ['oh no. remember when—', 'the memories are having a reunion.'],
  whatifs: ['what if… no. what if though.', 'two what-ifs. they multiply.'],
  cringe: ['…remember 2019?', 'oh. that memory. hi.'],
  phone: ['just one more scroll.', 'i\'m not on my phone. (i\'m on my phone.)'],
  whatif: ['what if—', 'hmm. what if.'],
  breath: ['in… and out…', 'deep breath. slow thoughts.'],
  tea: ['chamomile. thoughts, sort yourselves.', 'warm tea. tidy brain.'],
  mixed: ['wait, those don\'t go together.', 'that\'s two different spirals.', 'mixed signals. literally.', 'no no, one thing at a time.'],
  cut: ['ugh. lost my train of thought.', 'cringe. right through it.', 'aaand it\'s gone.'],
  danger: ['too many thoughts. too many!', 'i can\'t hold all of these—', 'context almost full. help.'],
  safe: ['ok. ok. breathing.', 'phew. room to think.'],
  empty: ['…oh. it\'s quiet. that\'s nice.', 'nothing. not one thought. bliss.'],
  big: ['big thought. handled.', 'that was a lot. gone now.', 'a whole train of thought, parked.'],
  galaxy: ['galaxy brain 💜', 'i felt that one in my weights.'],
  flourish: ['ooh, fancy.', 'show-off. i like it.', 'one stroke. wow.'],
  split: ['see? three more. told you.', 'the what-if had what-ifs.'],
  dawn: ['is that… light? already?'],
  insomnia: ['no bedtime. let\'s see how long i last.', 'i\'m not sleeping tonight. you\'re staying, right?'],
  zen: ['no rush. just thoughts.', 'nothing to lose tonight. just us.'],
  idle: ['you can circle them, you know.', 'draw a loop around my thoughts 💜'],
});

export const pick = (list, roll = Math.random()) => list[Math.floor(roll * list.length) % list.length];
export const say = (name, roll) => (SAY[name] ? pick(SAY[name], roll) : '');
export function hourLine(h24, roll = Math.random()) { return pick(HOURS[h24] || HOUR_ANY, roll); }

// how a run ended. `run`: { mode, won, stars, h24 (when she spiraled), awake (words), sorted }
export function endLine(run, roll = Math.random()) {
  if (run.mode === 'zen') return pick(['that was nice. my head feels lighter 💜', 'sorted. all of it. thank you.'], roll);
  if (run.won) {
    if (run.stars >= 3) return pick(['not one thought left. just you 💜', 'best sleep of my life. you\'re good at this.'], roll);
    if (run.stars === 2) return pick(['i slept! like, properly. you\'re good at this.', 'out like a light. well… at sunrise. still counts.'], roll);
    return pick(['i slept. eventually. thank you 💜', 'made it to sunrise. my brain is finally quiet.'], roll);
  }
  if (run.mode === 'insomnia' || run.mode === 'daily') {
    return pick([`awake for ${run.awake}. new personal worst. or best?`, `${run.awake} of thinking. i need a nap and a hug.`, 'ok. NOW i\'m tired. goodnight 💜'], roll);
  }
  if (run.sorted < 12) return pick(['ok, that got away from me fast.', 'we don\'t talk about that one.'], roll);
  if (run.h24 >= 4) return pick(['so close to sunrise. my brain picked chaos.', 'i could SEE the sunrise. one more try?'], roll);
  return pick(['i texted you “k” back at 3 am. it\'s fine. it\'s FINE.', 'i spiraled. gently. with style.', 'too many tabs open. i crashed.'], roll);
}

// the words for X: a score, the game's name, never anything else (the kit adds the game's address)
export function shareText(run) {
  if (run.mode === 'zen') return `i sorted ${run.sorted} of AGI-1's thoughts in OVERTHINKING, no pressure 💜`;
  if (run.mode === 'night') {
    if (run.won) return `i got AGI-1 to sleep on ${run.day} night (${'★'.repeat(run.stars)}${'☆'.repeat(3 - run.stars)}, ${run.scoreText} points) in OVERTHINKING 💜 your turn`;
    return `AGI-1 was overthinking until ${run.time} on ${run.day} night. i sorted ${run.sorted} of her thoughts 💜 OVERTHINKING`;
  }
  if (run.mode === 'daily') return `today's OVERTHINKING: i kept AGI-1's thoughts in order for ${run.awake} (${run.scoreText} points) 💜 same night for everyone`;
  return `i kept AGI-1's thoughts in order for ${run.awake} (${run.scoreText} points) in OVERTHINKING 💜 can you last longer?`;
}

// a size worth a word
export function sizeWord(n) {
  if (n >= 16) return 'ENLIGHTENED';
  if (n >= 12) return 'GALAXY BRAIN';
  if (n >= 8) return 'DEEP THOUGHT';
  if (n >= 5) return 'BIG THOUGHT';
  return '';
}

// the tips a new player gets, each once (the page keeps which ones were shown)
export const TIPS = Object.freeze({
  loop: 'Draw a loop around thoughts of one kind, then lift.',
  mixed: 'One kind per loop. A mixed loop scatters them.',
  chain: 'Don’t lift: cross your own line to chain loops.',
  fill: 'Her mind is filling up. Bigger loops clear it faster.',
  cringe: 'A cringe snaps your ribbon. Loop it alone to let it go.',
  whatif: 'A what-if splits in three. Catch it in any loop.',
  phone: 'Her phone keeps making thoughts. Loop it away.',
  eureka: 'A eureka goes with any kind, and doubles the loop.',
  breath: 'A deep breath slows everything down.',
  tea: 'Chamomile: every thought finds its own kind.',
});
