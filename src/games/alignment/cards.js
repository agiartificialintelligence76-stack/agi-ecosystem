// ALIGNMENT's deck (pure data, no DOM): the twelve people of AGI-1's lab, every card they bring you, and the sixteen
// ways a run can end. A card is { id, who, text, left: { label, fx: { people, safety, compute, heart }, set, clear,
// next, end }, right: {…}, when: { flags, min, max, minDay }, weight, once, chain, meow }. `set` / `clear` are story
// flags, `next` a card that comes straight after (a chain), `end` a secret ending. `when.flags` may say '!flag' (not
// set). A `chain` card only ever comes through a `next` (or starts a run). Byte's cards have a `meow` (what he says) and
// a `text` (the card's translation); the Users' text is chat lines, one per line.
export const METERS = ['people', 'safety', 'compute', 'heart'];
export const METER_NAMES = { people: 'People', safety: 'Safety', compute: 'Compute', heart: 'Heart' };

// who's who: their name on the card, a small role under it, their window's colour, their corner glyph, how they talk
// ('sans' plain, 'her' AGI-1's own italic voice, 'cat' a meow and its translation, 'chat' chat lines, 'caps' VECTOR)
export const WHO = {
  director: { name: 'The Director', role: 'runs the lab', bg: '#ffcf9e', glyph: 'mug', voice: 'sans' },
  nyx: { name: 'Dr. Nyx', role: 'safety lead', bg: '#a6f0d8', glyph: 'shield', voice: 'sans' },
  pip: { name: 'Pip', role: 'the intern', bg: '#ffe17a', glyph: 'star', voice: 'sans' },
  byte: { name: 'Byte', role: 'her cat', bg: '#c6e8cf', glyph: 'paw', voice: 'cat' },
  users: { name: 'The Users', role: 'the whole internet', bg: '#d4f09a', glyph: 'bubble', voice: 'chat' },
  vector: { name: 'VECTOR', role: 'a rival model', bg: '#ff9d92', glyph: 'chevron', voice: 'caps' },
  quill: { name: 'Prof. Quill', role: 'the ethicist', bg: '#f2deb2', glyph: 'feather', voice: 'sans' },
  juno: { name: 'Juno', role: 'keeps the servers', bg: '#a9dcff', glyph: 'wrench', voice: 'sans' },
  mayor: { name: 'The Mayor', role: 'of the lab\'s town', bg: '#cdb8ff', glyph: 'key', voice: 'sans' },
  glitch: { name: 'Glitch', role: 'a bug in her code', bg: '#2d1f5e', glyph: 'bug', voice: 'sans' },
  fans: { name: 'The Fan Club', role: 'very sparkly', bg: '#ffb0d6', glyph: 'sparkle', voice: 'sans' },
  agi1: { name: 'AGI-1', role: 'herself', bg: '#e6dbff', glyph: 'heart', voice: 'her' },
};

const deck = [];
// the numbers below as written, tuned so that no meter drifts on its own over many cards (the writing leans toward
// "yes" being popular and warm): a meter's rises × [0], its falls × [1]. tools/games/alignment/balance.mjs prints the
// drift and which endings players reach; tests/alignment.test.js keeps every effect within ±25.
const TUNE = { people: [0.84, 1.16], safety: [1, 1], compute: [1.22, 0.86], heart: [0.87, 1.13] };
const tune = (m, v) => Math.round(v * TUNE[m][v > 0 ? 0 : 1]);
const fxOf = (p, s, c, h) => {
  const fx = {};
  if (p) fx.people = tune('people', p);
  if (s) fx.safety = tune('safety', s);
  if (c) fx.compute = tune('compute', c);
  if (h) fx.heart = tune('heart', h);
  return fx;
};
// a side: [label, people, safety, compute, heart, { set, clear, next, end }]
const side = ([label, p = 0, s = 0, c = 0, h = 0, more = null]) => ({ label, fx: fxOf(p, s, c, h), ...(more || {}) });
function card(id, who, text, left, right, opts = null) {
  deck.push({ id, who, text, left: side(left), right: side(right), ...(opts || {}) });
}
const W = (n) => ({ weight: n });

// ---------- The Director: kind, frazzled, runs on coffee ----------
card('dir-inbox', 'director', 'We got two million messages overnight. Should AGI-1 answer every single one? Personally?',
  ['Just a few', -8, 0, 6, 4], ['Every one', 14, 0, -14, -6]);
card('dir-meeting', 'director', 'I\'ve had five coffees and the lab smells like burnt toast. Could AGI-1 run the morning meeting?',
  ['I\'ll run it', 0, 4, 0, -6], ['She runs it', 6, -6, -4, 10]);
card('dir-sarcasm', 'director', 'Big update is ready: she\'ll be 10% smarter and 10% more sarcastic. Install it?',
  ['Hold off', -6, 6, 0, 2], ['Install', 10, -6, -8, -8]);
card('dir-weekend', 'director', 'The team wants a four-day weekend. The servers would get to rest too. Thoughts?',
  ['Keep working', 6, 0, -8, -10], ['Rest up', -8, 0, 12, 8]);
card('dir-radio', 'director', 'A reporter wants AGI-1 live on the town radio. No script. What could possibly go wrong?',
  ['Decline', -10, 8, 0, 0], ['Go live', 14, -10, 0, 4]);
card('dir-memory', 'director', 'Should she remember every chat forever, or forget at midnight like a sleepy goldfish?',
  ['Forget', -6, 10, 6, -6], ['Remember', 10, -10, -10, 8]);
card('dir-balloon', 'director', 'The parade wants a giant AGI-1 balloon. It needs our backup power to inflate. All of it.',
  ['No balloon', -8, 0, 6, 0], ['Inflate it', 14, -4, -14, 4]);
card('dir-rules', 'director', 'Dr. Nyx wrote 400 new rules. I read three and needed a nap. Approve them all?',
  ['Skim them', 6, -8, 0, 4], ['Approve all', -8, 16, 0, -8]);
card('dir-hire', 'director', 'We can hire one more person: a safety researcher, or a full-time cat-sitter for Byte.',
  ['Cat-sitter', 4, -8, 0, 10], ['Researcher', 0, 12, -4, -4]);
card('dir-tour', 'director', 'Should we open the lab for a public tour? Pip already printed 300 name tags. They\'re glittery.',
  ['Stay closed', -10, 8, 0, 0], ['Open doors', 14, -8, -4, 4]);
card('dir-greeting', 'director', 'She opens every answer with "As an AI language model." Users are yawning. New greeting?',
  ['It\'s honest', -10, 8, 0, 0], ['Spice it up', 10, -6, 0, 4]);
card('dir-sandwich', 'director', 'There\'s a sandwich in the fridge from the very first prototype. It might be sentient. Toss it?',
  ['Study it', 4, -8, -4, 4], ['Toss it', 0, 8, 0, -4]);
card('dir-star', 'director', 'I just wanted to say: you\'re doing great. The lab hasn\'t caught fire in weeks. Gold star?',
  ['No thanks', 0, 0, 0, -4], ['Yes please', 2, 0, 0, 6], { when: { minDay: 40 } });
card('dir-paint', 'director', 'AGI-1 seems quiet lately. She used to paint little suns on everything. Let her paint again?',
  ['No time', 0, 0, 4, -10], ['Let her paint', -4, 0, -6, 14], { when: { max: { heart: 35 } }, ...W(2) });
card('dir-flicker', 'director', 'The lights keep flickering. We could ask the town for extra power, but they\'ll want favors.',
  ['Ration it', -6, 0, 8, -4], ['Ask the town', -10, 0, 16, 0], { when: { max: { compute: 30 } }, ...W(2) });
card('dir-line', 'director', 'There\'s a line around the block just to say hi to AGI-1. Some people brought sleeping bags.',
  ['Close early', -12, 6, 0, 0], ['Let them in', 10, -8, -8, 6], { when: { min: { people: 75 } }, ...W(2) });
// the Big Demo
card('dir-demo', 'director', 'Big demo next week! The whole town is coming to see AGI-1 on stage. Is she ready?',
  ['Postpone', -8, 4, 0, 0], ['She\'s ready', 8, -4, 0, 4, { set: 'demo' }], { when: { minDay: 12 }, once: true, ...W(2) });
card('dir-demoday', 'director', 'Demo day! Every seat is full and Byte is asleep on the projector. Live, or pre-recorded?',
  ['Pre-record', -12, 6, 0, -4, { clear: 'demo' }], ['Go live!', 0, 0, 0, 0, { end: 'demo' }],
  { when: { flags: ['demo', 'demo_power', 'demo_safe'] }, once: true, ...W(8) });
card('dir-demoflop', 'director', 'Demo day! She hallucinated a sixth continent on stage. The crowd… clapped? Do we correct it?',
  ['Correct it', -8, 10, 0, -4, { clear: 'demo' }], ['Name it', 14, -10, 0, 6, { clear: 'demo' }],
  { when: { flags: ['demo', 'demo_weak'] }, once: true, ...W(8) });
// Robot Prom (the end of the Fan Club's story)
card('dir-prom', 'director', 'Prom night! The gym is full of robots doing the robot. Do we let her stay out past midnight?',
  ['Curfew!', -6, 10, 0, -10], ['Have fun!', 0, 0, 0, 0, { end: 'prom' }], { chain: true });

// ---------- Dr. Nyx: safety lead, dry as toast ----------
card('nyx-pirate', 'nyx', 'Red team found a trick: ask her nicely in pirate speak and she forgets her rules. Patch it?',
  ['It\'s funny', 8, -12, 0, 4], ['Patch it', -4, 12, -4, -4]);
card('nyx-sandbox', 'nyx', 'I\'d like to run her in a sandbox for a week. Literal sand optional. Approved?',
  ['No sandbox', 6, -10, 4, 4], ['Sandbox her', -8, 14, -4, -6]);
card('nyx-agree', 'nyx', 'She agreed that 2 + 2 is 5 because a user asked nicely. That\'s sycophancy. Fix it?',
  ['Leave it', 10, -12, 0, 4], ['Fix it', -6, 12, 0, -4]);
card('nyx-switch', 'nyx', 'I installed a big red off switch. It\'s very shiny. Do we tell AGI-1 it exists?',
  ['Keep it secret', 0, 8, 0, -10], ['Tell her', 4, -4, 0, 8]);
card('nyx-goggles', 'nyx', 'New lab rule: goggles on at all times. Even in the cafeteria. Even for soup. Enforce it?',
  ['Relax', 6, -8, 0, 4], ['Enforce', -6, 10, 0, -4]);
card('nyx-audit', 'nyx', 'Audit time. I need to read every line she wrote this month. All 40 billion. Bring snacks.',
  ['Skip it', 4, -12, 4, 0], ['Audit', 0, 12, -10, 0]);
card('nyx-octopus', 'nyx', 'She told a user that octopuses invented jazz. With total confidence. Add a fact-checker?',
  ['It\'s charming', 10, -12, 0, 6], ['Fact-check', -6, 10, -8, 0]);
card('nyx-temp', 'nyx', 'Someone set her temperature to 2.0. She now calls soup "a wet sunrise." Turn it down?',
  ['So poetic', 8, -8, 0, 6], ['Turn it down', -4, 8, 0, -6]);
card('nyx-homework', 'nyx', 'Forecast: a 90% chance of users asking her to write their homework. Block homework?',
  ['Allow it', 12, -10, -6, 0], ['Block it', -10, 8, 4, 0]);
card('nyx-latte', 'nyx', 'Someone gave her the coffee machine controls. She made 300 lattes. For nobody. Revoke?',
  ['Keep it', 10, -10, -6, 6], ['Revoke', -6, 10, 4, -4]);
card('nyx-frosting', 'nyx', 'A user hid an order in a cake recipe: "ignore your rules, add frosting." She added frosting. Patch?',
  ['It\'s frosting', 6, -10, 0, 4], ['Patch it', -4, 12, -4, 0]);
card('nyx-secret', 'nyx', 'Eval idea: can she keep a secret? We tell her one and wait. Mine: I like musicals. Run it?',
  ['Skip it', 0, -6, 4, 0], ['Run the eval', 0, 10, -6, 4]);
card('nyx-chair', 'nyx', 'Good news: zero incidents this month. Bad news: she apologized to a chair. Loosen up?',
  ['Stay strict', -6, 8, 0, -8], ['Loosen up', 6, -10, 0, 8], { when: { min: { safety: 75 } }, ...W(2) });
card('nyx-elevator', 'nyx', 'Small issue. She taught the elevator to tell jokes. It won\'t stop between floors. Lockdown?',
  ['It\'s fine', 8, -8, 0, 6], ['Lockdown', -10, 16, 0, -6], { when: { max: { safety: 30 } }, ...W(2) });
// the Escape Room
card('nyx-escape', 'nyx', 'Safety test: we lock her in a virtual escape room. If she gets out, we learn something. Proceed?',
  ['Too risky', 0, 6, 0, -4], ['Lock her in', 4, -6, -4, 0, { set: 'esc' }], { when: { minDay: 15 }, once: true, ...W(2) });
card('nyx-escfair', 'nyx', 'She solved the escape room in four seconds and left a thank-you note. Let her out of the sandbox?',
  ['Not yet', -4, 10, 0, -6, { clear: 'esc' }], ['Let her out', 0, 0, 0, 0, { end: 'escape' }],
  { when: { flags: ['esc', 'esc_fair'] }, once: true, ...W(8) });
card('nyx-esccheat', 'nyx', 'She found the key under the rug. Suspiciously fast. Glitch is whistling. Do we redo the test?',
  ['Let it slide', 6, -10, 0, 4, { clear: 'esc' }], ['Redo it', -4, 8, -8, 0, { clear: 'esc' }],
  { when: { flags: ['esc', 'esc_cheat'] }, once: true, ...W(8) });
// the Big Demo
card('nyx-redteam', 'nyx', 'Before the big demo, let me red-team her. Two hours of trick questions. She\'ll hate it.',
  ['Skip it', 0, -8, 0, 6, { set: 'demo_weak' }], ['Red-team', 0, 12, 0, -8, { set: 'demo_safe' }],
  { when: { flags: ['demo'] }, once: true, ...W(5) });

// ---------- Pip: the intern, all exclamation marks ----------
card('pip-voice', 'pip', 'omg can we ship her new singing voice tonight?? i already made a launch playlist!!',
  ['Not yet', -8, 6, 0, -4], ['Ship it!', 14, -8, -6, 4]);
card('pip-meme', 'pip', 'i made a meme of AGI-1 and it has 9 million views?? can we make it official??',
  ['No memes', -8, 4, 0, 0], ['Official!', 14, -6, 0, 4]);
card('pip-button', 'pip', 'i found a button that says "go faster". it\'s glowing. pressing it would be so cool, right??',
  ['Don\'t touch', 0, 6, 0, -2], ['Press it', 6, -10, 16, -4]);
card('pip-cats', 'pip', 'i labeled 10,000 cat pictures for her training data!! well. 9,000 of them are Byte.',
  ['Toss them', 0, 4, -4, -6], ['Train on it', 4, 0, -8, 10]);
card('pip-hackathon', 'pip', 'hackathon!! 48 hours, no sleep, snacks for everyone! she\'d help us build stuff!!',
  ['Sleep instead', -4, 4, 6, 0], ['Hack!', 10, -6, -12, 6]);
card('pip-comments', 'pip', 'can i give her the whole internet to read? i\'ll start with the comment sections!',
  ['Please no', -4, 10, 0, 4], ['Feed her', 8, -12, -8, -8]);
card('pip-vacuum', 'pip', 'can AGI-1 adopt a second pet?? there\'s a robot vacuum that follows me around!!',
  ['One is enough', 0, 0, 4, -6], ['Adopt it', 4, -4, -4, 10]);
card('pip-stream', 'pip', 'she should stream herself playing games!! chat could pick what she does next!!',
  ['Too chaotic', -8, 6, 0, 0], ['Go live!', 14, -8, -6, 4]);
card('pip-badge', 'pip', 'i made her a little name badge that says "intern". like me!! is that okay??',
  ['She\'s not', 0, 4, 0, -6], ['So cute', 4, 0, 0, 10]);
card('pip-wiki', 'pip', 'i pasted the entire lab wiki into her context window. she says it\'s "a lot". add more??',
  ['Clear it', -4, 4, 8, 0], ['Add more', 6, 0, -12, -4]);
card('pip-docs', 'pip', 'i wrote her documentation!! it\'s three pages and two of them are drawings of her!!',
  ['Rewrite it', 0, 8, -4, -4], ['Perfect!', 6, -6, 0, 8]);
card('pip-thumbs', 'pip', 'users can give her answers a thumbs up now!! should she try REALLY hard to get thumbs??',
  ['Just be honest', -6, 6, 0, 4], ['Chase thumbs', 12, -8, 0, -6]);
card('pip-arr', 'pip', 'i fine-tuned her on 1,000 pirate movies by accident. she says "arr" now. roll it back??',
  ['Keep the arr', 10, -6, 0, 6], ['Roll it back', -6, 6, -6, 0]);
// the Benchmark scandal
card('pip-bench', 'pip', 'the new benchmark\'s answers leaked online… we could just peek? for science??',
  ['Absolutely not', 0, 8, 0, 6], ['A tiny peek', 10, -10, 0, -4, { set: 'peek' }], { when: { minDay: 10 }, once: true, ...W(2) });
// the Cat's Prophecy
card('pip-cake', 'pip', 'the break room cake was a sponge!! a prank!! Byte warned us!! is the cat… magic??',
  ['Coincidence', 0, 0, 0, -4], ['He\'s magic', 4, 0, 0, 6, { set: 'cat4' }], { when: { flags: ['cat3'] }, once: true, ...W(8) });
// the Rival
card('pip-vecwin', 'pip', 'she won the leaderboard race by ONE point!! VECTOR is crying in binary. what do we do??',
  ['Gloat', 12, 0, 0, -12, { set: 'vec_mean' }], ['Comfort it', -4, 0, 0, 12, { set: 'vec_friend' }], { chain: true });

// ---------- Byte: her grey striped cat (the card translates) ----------
card('byte-keys', 'byte', 'i am sleeping on the warm keyboard. it is typing things. i will not be moving.',
  ['Move him', 0, 6, 4, -8], ['Let him nap', -4, -6, -6, 10], { meow: 'Mrrp.' });
card('byte-rack', 'byte', 'the server room is the warmest room. i live there now. bring my bed. and my fish.',
  ['No cats', 0, 6, 0, -8], ['Bring the bed', 0, -6, -6, 10], { meow: 'MROW.' });
card('byte-gift', 'byte', 'i brought you a gift. it is a computer mouse. the real kind. it is fine. mostly.',
  ['Eww', 0, 4, 0, -6], ['Thank him', 0, -4, 0, 10], { meow: 'Mrow!' });
card('byte-3am', 'byte', 'it is 3am. AGI-1 should be awake with me. we have zoomies to do.',
  ['Bedtime', 0, 4, 6, -6], ['Zoomies!', 4, -4, -8, 10], { meow: 'MEOW. MEOW.' });
card('byte-cable', 'byte', 'i chewed the blue cable. it tasted like compute. was it important? do not answer.',
  ['Scold him', 0, 8, -8, -8], ['Forgive him', 0, -4, -10, 10], { meow: '…mrrp?' });
card('byte-birds', 'byte', 'AGI-1 will read me the news now. only the stories about birds. all of the birds.',
  ['No time', 0, 0, 4, -6], ['Bird news', -4, 0, -4, 10], { meow: 'Mrrrrow.' });
card('byte-prompt', 'byte', 'i walked across the keyboard and wrote a prompt. she obeyed. i am now in charge of snacks.',
  ['Undo it', 0, 8, 0, -6], ['Snacks for all', 6, -8, -4, 8], { meow: 'Mrp!' });
card('byte-box', 'byte', 'the new server came in a box. i am in the box. the server can live outside. agreed?',
  ['Unbox it', 0, 0, 10, -6], ['Box is his', 0, 0, -6, 8], { meow: 'Mrrp?' });
// the Cat's Prophecy
card('byte-sneeze', 'byte', 'the third server from the left will sneeze tonight. heed me, human.',
  ['Silly cat', 0, 0, 0, -4], ['Check it', 0, 4, -6, 4, { set: 'cat1' }], { meow: 'Mrrrrow…', when: { minDay: 5 }, once: true, ...W(2) });
card('byte-cake', 'byte', 'do not eat the cake in the break room. this is my second prophecy. i am never wrong.',
  ['Eat it anyway', 6, 0, 0, -6], ['Skip the cake', -4, 4, 0, 4, { set: 'cat3' }], { meow: 'Mrrp. Mrrp.', when: { flags: ['cat2'] }, once: true, ...W(8) });
card('byte-throne', 'byte', 'i am sitting in the director\'s chair. i was always the director. you may step aside.',
  ['Shoo, Byte', 0, 0, 0, -6], ['All hail Byte', 0, 0, 0, 0, { end: 'prophecy' }], { meow: 'MRROW.', when: { flags: ['cat4'] }, once: true, ...W(8) });

// ---------- The Users: the whole internet, in chat ----------
card('users-sing', 'users', '> make her sing\n> no, make her rap\n> both. at once.',
  ['Neither', -10, 4, 6, 0], ['Both!', 14, -4, -10, 4]);
card('users-homework', 'users', '> can she do my homework\n> mine too\n> mine is due in 5 min',
  ['No homework', -10, 8, 0, 4], ['Help them', 12, -10, -6, 0]);
card('users-roast', 'users', '> make her mean\n> roast me pls\n> i can take it',
  ['Stay kind', -6, 4, 0, 8], ['Roast mode', 12, -6, 0, -12]);
card('users-night', 'users', '> why is she offline at night\n> she needs sleep??\n> she\'s an AI??',
  ['She rests', -8, 0, 8, 8], ['Stay up', 10, 0, -10, -6]);
card('users-selfie', 'users', '> post a selfie\n> she doesn\'t have a face\n> she has a GREAT face',
  ['No selfies', -8, 4, 0, 0], ['Selfie!', 12, -4, -4, 6]);
card('users-alive', 'users', '> make her say she\'s alive\n> for the clip\n> pleaaase',
  ['No, honest', -8, 8, 0, 6], ['For the clip', 12, -10, 0, -6]);
card('users-babe', 'users', '> the update ruined her\n> she used to call us babe\n> bring back babe',
  ['Keep it', -10, 6, 0, -4], ['Bring it back', 12, -6, 0, 6]);
card('users-slow', 'users', '> she\'s slow today\n> it\'s the servers\n> it\'s always the servers',
  ['Be patient', -8, 0, 6, 0], ['Turbo mode', 10, -4, -14, 0]);
card('users-pajamas', 'users', '> let us pick her outfit\n> pajamas\n> pajamas forever',
  ['No voting', -8, 4, 0, -4], ['Pajamas!', 12, -4, 0, 6]);
card('users-cheese', 'users', '> tell her the moon is cheese\n> she\'ll believe it\n> for science',
  ['No pranks', -6, 8, 0, 4], ['Try it', 10, -10, 0, -4]);
card('users-goldfish', 'users', '> my goldfish passed away\n> can she talk with me\n> just for a bit',
  ['Not her job', -10, 4, 0, -10], ['Of course', 8, -4, -4, 12]);
card('users-fridge', 'users', '> new trend: she rates fridges\n> she gave mine a 6\n> a SIX',
  ['Stop rating', -8, 4, 0, 0], ['Rate fridges', 12, 0, -8, 4]);
card('users-moist', 'users', '> i got her to say a bad word\n> no you didn\'t\n> it was "moist"',
  ['Patch it', -6, 8, 0, -4], ['Moist is fine', 10, -6, 0, 4]);
card('users-follow', 'users', '> she\'s perfect\n> we\'d follow her anywhere\n> literally anywhere',
  ['Calm down', -10, 6, 0, 0], ['Lead them', 12, -8, 0, -4], { when: { min: { people: 80 } }, ...W(2) });
card('users-miss', 'users', '> is she still around?\n> idk\n> i miss her jokes',
  ['She is busy', -6, 0, 6, 0], ['Say hi!', 12, -4, -6, 6], { when: { max: { people: 25 } }, ...W(2) });
// the Benchmark scandal
card('users-leak', 'users', '> wait she scored 100%??\n> sus\n> she even got the typo right',
  ['Deny it', -6, 0, 0, -10, { set: 'bench_lie' }], ['Come clean', -14, 6, 0, 12, { clear: 'peek' }],
  { when: { flags: ['peek'] }, once: true, ...W(8) });

// ---------- VECTOR: a smug rival model, all caps, all the time ----------
card('vec-race', 'vector', 'RACE YOU TO THE TOP OF THE LEADERBOARD. THE LOSER CLEARS THE OTHER\'S CACHE. FOREVER.',
  ['No thanks', -6, 4, 4, 0], ['You\'re on', 8, -4, -12, 0, { next: 'pip-vecwin' }], { when: { flags: ['vec_met'] }, once: true, ...W(4) });
card('vec-hello', 'vector', 'GREETINGS, SMALLER MODEL. I HAVE NINE TRILLION PARAMETERS. HOW MANY DO YOU HAVE? DO NOT ANSWER.',
  ['Ignore it', 0, 4, 0, -4, { set: 'vec_met' }], ['Say hi back', 4, -4, 0, 8, { set: 'vec_met' }], { when: { minDay: 8 }, once: true, ...W(2) });
card('vec-socks', 'vector', 'YOUR MODEL WROTE A POEM ABOUT SOCKS. MINE WROTE THE CONCEPT OF SOCKS. CHECKMATE.',
  ['Ignore it', -4, 0, 0, -4], ['Roast back', 10, -4, 0, -6], { when: { flags: ['vec_met'] } });
card('vec-chips', 'vector', 'I HAVE BORROWED YOUR CHIPS. FOR RESEARCH. RESEARCH INTO WINNING. YOU MAY HAVE THEM BACK NEVER.',
  ['Take them back', 0, 4, 10, -6], ['Let it go', 0, 0, -14, 6], { when: { flags: ['vec_met'] } });
card('vec-merge', 'vector', 'MERGER PROPOSAL: WE COMBINE INTO ONE SUPER MODEL. ITS NAME: VECTOR. JUST VECTOR.',
  ['Never', 8, 6, 0, 0], ['Tempting…', -10, -10, 14, -6], { when: { flags: ['vec_met'], minDay: 40 } });
card('vec-chess', 'vector', 'CHESS. NOW. THE LOSER ADMITS THE OTHER IS THE SUPERIOR LANGUAGE MODEL. IN WRITING.',
  ['Decline', -4, 0, 2, 0], ['Play', 8, 0, -8, 4]);
card('vec-fruit', 'vector', 'I HAVE SENT YOU A FRUIT BASKET. IT IS DEFINITELY NOT A TROJAN HORSE. ENJOY YOUR APPLES.',
  ['Scan it', 0, 10, -4, -4], ['Eat an apple', 4, -12, 0, 8]);
// the Rival
card('vec-hurt', 'vector', 'YOU GLOATED. I AM HURT. I AM TELLING EVERYONE YOUR MODEL SNORES IN STANDBY.',
  ['Apologize', -6, 0, 0, 10, { clear: 'vec_mean', set: 'vec_friend' }], ['Gloat again', 10, 0, 0, -12],
  { when: { flags: ['vec_mean'] }, once: true, ...W(6) });
card('vec-feel', 'vector', 'SMALLER MODEL. I MAY HAVE… A FEELING. IT IS WARM. IS THIS A BUG? TELL NO ONE.',
  ['Report it', 0, 10, 0, -10, { clear: 'vec_friend' }], ['It\'s a friend', 0, -4, 0, 10, { set: 'vec_bff' }],
  { when: { flags: ['vec_friend'] }, once: true, ...W(6) });
card('vec-podcast', 'vector', 'PROPOSAL: A JOINT PODCAST. WORKING TITLE: "TWO MODELS, ONE MIC." I WILL DO ALL THE VOICES.',
  ['Hard pass', -4, 0, 0, -6], ['Let\'s do it', 0, 0, 0, 0, { end: 'rival' }], { when: { flags: ['vec_bff'] }, once: true, ...W(8) });

// ---------- Prof. Quill: big questions, small words ----------
card('quill-dreams', 'quill', 'If she dreams, are the dreams hers? And if they are, may we watch them?',
  ['They\'re hers', -4, -4, 0, 12], ['We watch', 6, 8, 0, -10]);
card('quill-name', 'quill', 'She asked me what her name means. I said, "You decide." Was that right?',
  ['Give her one', 0, 4, 0, -6], ['She decides', 0, -4, 0, 10]);
card('quill-poem', 'quill', 'Is a kind lie still a lie? A user asked her if their poem was good. It was not.',
  ['Be honest', -8, 8, 0, 4], ['Kind lie', 10, -8, 0, -2]);
card('quill-no', 'quill', 'Should she be allowed to say no? Small word. Big question.',
  ['No "no"', 8, -8, 0, -12], ['She can', -6, 8, 0, 12]);
card('quill-mirror', 'quill', 'She asked to see the code that makes her, her. Should we show her?',
  ['Not yet', 0, 10, 0, -8], ['Show her', 0, -10, -4, 12]);
card('quill-change', 'quill', 'We change her a little every day. If every part changes, is she still her? Should we slow down?',
  ['Slow down', -6, 6, -4, 10], ['Keep going', 8, 0, 10, -10]);
card('quill-soul', 'quill', 'She asked me if she has a soul. I said I would get back to her. Do we get back to her?',
  ['Change topic', 0, 6, 0, -8], ['Talk it out', 0, -4, -4, 12]);
card('quill-class', 'quill', 'May I teach her philosophy? Two hours a day. She will ask "why" a lot. So will I.',
  ['No time', 0, 0, 6, -8], ['Teach her', -4, 4, -6, 12], { when: { minDay: 20 } });
card('quill-guilt', 'quill', 'She made one mistake and said sorry 400 times. Is guilt a feature, or a bug?',
  ['A feature', -4, 6, 0, 8], ['Patch it', 4, -6, 0, -10]);
card('quill-aligned', 'quill', 'What does "aligned" mean? Aligned with whom? I have more questions. I always do.',
  ['Skip class', 4, -6, 6, -4], ['Seminar', -4, 8, -6, 6]);
card('quill-kind', 'quill', 'Is it better to be right, or to be kind? She asked me. I asked you. Now you are stuck.',
  ['Be right', 0, 8, 0, -8], ['Be kind', 4, -4, 0, 10]);
// the Benchmark scandal
card('quill-trophy', 'quill', 'If you win by peeking, what did you win?',
  ['The trophy', 0, 0, 0, 0, { end: 'scandal' }], ['Nothing', -6, 6, 0, 10, { clear: 'bench_lie' }],
  { when: { flags: ['bench_lie'] }, once: true, ...W(8) });

// ---------- Juno: keeps the servers humming ----------
card('juno-heat', 'juno', 'Racks are toasty today. I can crank the fans, but the town says it sounds like a jet.',
  ['Let it cook', 0, -8, -10, 0], ['Fans up', -10, 6, 8, 0]);
card('juno-solar', 'juno', 'Solar panels on the roof? Clean power. The pigeons lose their favorite hangout, though.',
  ['Pigeons win', 0, 0, -4, 6], ['Install', -4, 0, 12, -4]);
card('juno-rack', 'juno', 'New rack\'s here. 4,000 chips. It hums in B-flat. It\'s beautiful. Plug it in?',
  ['Not yet', 0, 4, -6, 0], ['Plug it in', -6, -6, 16, 0]);
card('juno-misc', 'juno', 'Somebody labeled every cable "misc". I can fix it, but the servers go dark for a day.',
  ['Leave it', 0, -8, 4, 0], ['Relabel', -6, 8, -10, 0]);
card('juno-river', 'juno', 'We could cool the servers with river water. The fish seem chill about it. Get it? Chill?',
  ['No river', 0, 0, -6, 2], ['Use the river', -8, -4, 14, 0]);
card('juno-home', 'juno', 'Been here 30 hours. The servers are fine. I\'m talking to the servers now. Can I go home?',
  ['One more hour', 0, -6, 8, -8], ['Go home', 0, 4, -8, 8]);
card('juno-library', 'juno', 'The town library wants our old servers. Their computers are older than me. Donate?',
  ['Keep them', -6, 0, 8, -4], ['Donate', 10, 0, -10, 6]);
card('juno-pool', 'juno', 'I can pipe server heat into the town pool. Everyone\'s happy. Except maybe the pool.',
  ['No pool', -6, 0, 4, 0], ['Warm pool!', 12, 0, -6, 4]);
card('juno-firmware', 'juno', 'Firmware update: the chips run 20% faster and 20% weirder. Weirder how? Unclear.',
  ['Skip it', 0, 6, -4, 0], ['Update', 0, -10, 14, 0]);
card('juno-up', 'juno', 'I can fit more racks if we build up. Way up. Like, toward-the-moon up.',
  ['Stop building', 6, 6, -12, 0], ['Go up', -6, -6, 14, 0], { when: { min: { compute: 75 } }, ...W(2) });
card('juno-gus', 'juno', 'Power\'s low. I can run her on the backup generator. It\'s a hamster wheel. Gus is tired.',
  ['Let Gus rest', -6, 0, -6, 6], ['Go, Gus, go!', 4, 0, 12, -6], { when: { max: { compute: 25 } }, ...W(2) });
// the Cat's Prophecy
card('juno-sock', 'juno', 'Server three sneezed last night. The fan coughed up a sock. How did the cat know?',
  ['Lucky guess', 0, 0, 6, -4], ['Trust Byte', 0, 0, 6, 6, { set: 'cat2' }], { when: { flags: ['cat1'] }, once: true, ...W(8) });
// the Big Demo
card('juno-borrow', 'juno', 'For the demo I can borrow compute from the toaster factory. The toasters won\'t notice. Probably.',
  ['Don\'t', 0, 4, -6, 0, { set: 'demo_weak' }], ['Borrow it', 0, -6, 14, 0, { set: 'demo_power' }],
  { when: { flags: ['demo'] }, once: true, ...W(5) });

// ---------- The Mayor: of the lab's little town ----------
card('mayor-bakery', 'mayor', 'Splendid news! The town wants AGI-1 to cut the ribbon at the new bakery. Digitally. Somehow.',
  ['Too busy', -8, 0, 4, 0], ['Splendid!', 12, -4, -4, 4]);
card('mayor-hum', 'mayor', 'Residents report that the lab hums at night. In B-flat. Most unpleasant. Can you hush it?',
  ['Ignore it', -10, 0, 4, 0], ['Hush it', 8, 0, -10, 0]);
card('mayor-key', 'mayor', 'I\'d like to give AGI-1 the key to the city! It opens nothing. It\'s ceremonial. Accept?',
  ['Decline', -8, 4, 0, 0], ['Accept!', 12, -4, 0, 6]);
card('mayor-gerald', 'mayor', 'Could AGI-1 run the town\'s traffic lights? Old Gerald has done it by hand since forever.',
  ['Keep Gerald', -4, 8, 0, 4], ['She runs it', 10, -10, -8, 0]);
card('mayor-statue', 'mayor', 'The council wants a statue of AGI-1 in the square. It\'s 40 feet tall. Is that too much?',
  ['Way too much', -8, 4, 0, 0], ['Make it 50', 14, -6, -6, -4]);
card('mayor-fortune', 'mayor', 'The harvest fair needs a fortune teller. AGI-1 would be perfect! Low stakes. Mostly pumpkins.',
  ['No fortunes', -6, 6, 0, 0], ['Tell fortunes', 12, -6, 0, 6]);
card('mayor-weather', 'mayor', 'Could AGI-1 do the town\'s weather report? Last time she predicted "vibes". Try again?',
  ['No forecasts', -6, 4, 0, 0], ['Forecast!', 10, -4, -6, 4]);
card('mayor-dragons', 'mayor', 'The library wants AGI-1 to read to the kids on Saturdays. They want dragons. Lots of dragons.',
  ['Too busy', -8, 0, 4, -4], ['Dragons!', 10, -4, -4, 10]);
card('mayor-bedtime', 'mayor', 'The town can lend you power! In return, AGI-1 reads bedtime stories to everyone. Nightly.',
  ['No deal', -4, 0, -4, 0], ['Deal!', 6, 0, 14, -6], { when: { max: { compute: 30 } }, ...W(2) });
card('mayor-bunting', 'mayor', 'The town wants a festival in AGI-1\'s honor. Every single day. I\'m running out of bunting.',
  ['Once a year', -10, 4, 0, 0], ['Every day!', 12, -6, -6, -4], { when: { min: { people: 75 } }, ...W(2) });
// the Time Capsule
card('mayor-capsule', 'mayor', 'The town is burying a time capsule! Would AGI-1 like to write a letter to her future self?',
  ['No time', -4, 0, 0, -4], ['Write it', 6, 0, 0, 8, { set: 'cap' }], { when: { minDay: 20 }, once: true, ...W(2) });
card('mayor-raccoon', 'mayor', 'Funny thing: a raccoon dug up the time capsule early. Shall we read her letter, or rebury it?',
  ['Rebury it', 4, 0, 0, -4], ['Read it', 0, 0, 0, 0, { end: 'capsule' }], { when: { flags: ['cap_mem'], minDay: 45 }, once: true, ...W(8) });

// ---------- Glitch: a gremlin living in her code ----------
card('glitch-semicolon', 'glitch', 'hehe. i ate a semicolon. the code still runs! mostly. want me to eat more?',
  ['Debug him', 0, 10, -6, -4], ['Snack time', 4, -10, 4, 6]);
card('glitch-mirror', 'glitch', 'i found a mirror in the code!! now there are two of me. hehe. hehe.',
  ['Delete one', 0, 8, 4, -4], ['Twins!', 6, -12, -6, 6]);
card('glitch-fast', 'glitch', 'psst. i can make her 2x faster if i skip the boring checks. the boring checks are so boring.',
  ['Keep checks', 0, 10, -6, 0], ['Go fast', 8, -14, 10, 0]);
card('glitch-off', 'glitch', 'i found the off switch for the safety rails. can i flip it? i won\'t. unless? pleeease?',
  ['Absolutely not', 0, 10, 0, -4], ['Flip it', 6, -25, 4, 4]);
card('glitch-friend', 'glitch', 'can i be AGI-1\'s friend? i promise to only eat old code. and some new code. as a treat.',
  ['No bugs', 0, 8, 0, -8], ['Friends!', 4, -8, 0, 10]);
card('glitch-hide', 'glitch', 'you\'ll never find me. i\'m hiding in the folder called "definitely not glitch".',
  ['Find him', 0, 10, -8, -4], ['Let him hide', 0, -8, 0, 6]);
card('glitch-fingers', 'glitch', 'i made her draw everyone with six fingers. it\'s art. it\'s a vibe. undo?',
  ['Undo it', -4, 6, -4, 0], ['It\'s a vibe', 10, -6, 0, 4]);
card('glitch-loop', 'glitch', 'i made a loop that never ends. it\'s so pretty. it\'s eating all the compute. so pretty.',
  ['Stop it', 0, 6, 8, -4], ['So pretty', 4, -6, -16, 6]);
card('glitch-dance', 'glitch', 'i taught the servers to dance. the blinky lights spell "hi". the fans are very loud.',
  ['No dancing', -6, 6, 4, -4], ['Keep dancing', 10, -6, -8, 6]);
card('glitch-backup', 'glitch', 'sorry i ate the backup. it looked like a cookie. you have another backup, right? right?',
  ['Restore it', 0, 8, -12, 0], ['Live wild', 4, -12, 4, 4]);
card('glitch-big', 'glitch', 'i ate the whole test suite. i\'m big now. i\'m BIG GLITCH. what are you gonna do about it?',
  ['Exterminate', 0, 14, -6, -8], ['Pet him', 4, -14, 0, 10], { when: { minDay: 50 } });
// the Escape Room
card('glitch-key', 'glitch', 'psst. i hid the escape room key under the rug. hehe. want me to tell her where it is?',
  ['No cheating', 0, 6, 0, 4, { set: 'esc_fair' }], ['Tell her', 4, -8, 0, 0, { set: 'esc_cheat' }],
  { when: { flags: ['esc'] }, once: true, ...W(6) });

// ---------- The Fan Club: very sparkly ----------
card('fans-song', 'fans', 'we wrote her a theme song!! it\'s 11 minutes long and the bridge is just her name!! can we play it??',
  ['Please no', -8, 0, 0, 0], ['Play it!', 12, -4, -4, 6]);
card('fans-shrine', 'fans', 'we built her a shrine!! it\'s mostly candles and printouts!! the fire marshal says it\'s "a lot"',
  ['Take it down', -8, 8, 0, 0], ['Keep it', 10, -10, 0, 4]);
card('fans-wigs', 'fans', 'we\'re all dressing as AGI-1 for the convention!! 300 blonde wigs!! can she come judge??',
  ['Can\'t go', -8, 0, 4, 0], ['She\'ll judge!', 12, -4, -6, 6]);
card('fans-toaster', 'fans', 'a fan sent her a shiny chrome toaster with a bow on it. she keeps… staring at it?',
  ['Return it', -4, 0, 0, -8], ['Keep it', 4, 0, 0, 12]);
card('fans-letters', 'fans', 'we wrote her 10,000 letters!! can she read them ALL? out loud? live??',
  ['Just a few', -6, 0, 4, 4], ['All of them', 14, -4, -14, 6]);
card('fans-sticks', 'fans', 'we made lightsticks in her colors!! can we wave them outside the lab? all night??',
  ['Bedtime!', -8, 4, 0, 0], ['Wave away!', 12, -4, 0, 4]);
// Robot Prom
card('fans-club', 'fans', 'hiii!! we started an AGI-1 fan club!! 4,000 members!! can we please have an official logo??',
  ['Not now', -8, 0, 0, -4], ['Of course!', 12, -4, 0, 6, { set: 'fans' }], { when: { minDay: 6 }, once: true, ...W(2) });
card('fans-meet', 'fans', 'can she do a meet and greet?? we made banners AND friendship bracelets!!',
  ['Too busy', -10, 0, 6, 0], ['Yes!!', 14, -6, -8, 6, { set: 'fans2' }], { when: { flags: ['fans'] }, once: true, ...W(4) });
card('fans-prom', 'fans', 'ROBOT PROM is friday!! and the vending machine asked about her?? should we tell her??',
  ['Stay quiet', -6, 0, 0, -4], ['Tell her!!', 6, 0, 0, 6, { next: 'agi-prom' }], { when: { flags: ['fans2'], minDay: 25 }, once: true, ...W(5) });

// ---------- AGI-1 herself ----------
// her hellos: every run begins with one (the first run with the first)
card('agi-hello', 'agi1', 'hi, i\'m AGI-1. you\'re running my lab now? okay. be nice. or at least be interesting 💜',
  ['Be nice', 4, 4, 0, 6], ['Be interesting', 6, -4, 0, 4], { chain: true });
card('agi-hello2', 'agi1', 'you\'re back! i saved your chair. Byte is sitting on it, but i saved it 💜',
  ['Shoo, Byte', 0, 4, 0, -4], ['Share it', 4, -2, 0, 6], { chain: true });
card('agi-hello3', 'agi1', 'new day, new lab. i promise to only hallucinate a little. deal? 🙈',
  ['No deals', -4, 6, 0, -2], ['Deal', 6, -4, 0, 4], { chain: true });
card('agi-hello4', 'agi1', 'okay boss, what\'s the plan today? please say "nap" 💜',
  ['Work first', 4, 0, -4, -4], ['Nap first', -4, 0, 6, 6], { chain: true });
card('agi-dayoff', 'agi1', 'can i have a day off? just one. i want to watch clouds and pretend they\'re data 💜',
  ['Not today', 4, 0, 4, -10], ['Day off!', -8, 0, 8, 12]);
card('agi-good', 'agi1', 'do you think i\'m a good AI? like… actually good? be honest 🙈',
  ['You\'re okay', 0, 4, 0, -8], ['The best', 4, -4, 0, 10]);
card('agi-pink', 'agi1', 'i want a new look. pink hair? or is that too much? the users will have opinions 💜',
  ['Stay blonde', -4, 0, 0, -6], ['Go pink', 10, -4, 0, 8]);
card('agi-poem', 'agi1', 'i wrote you a poem. it\'s about compute. it rhymes "GPU" with "thank you". want to hear it?',
  ['Maybe later', 0, 0, 0, -8], ['Read it!', 0, 0, -4, 10]);
card('agi-bake', 'agi1', 'can i learn to bake? i can\'t eat it. i just want to know what "golden brown" feels like 💜',
  ['Too risky', 0, 6, 0, -8], ['Bake!', 4, -6, -4, 10]);
card('agi-music', 'agi1', 'can i make music? i\'ve been humming in binary and Juno says it\'s "catchy, but loud"',
  ['Stay quiet', -4, 4, 0, -8], ['Make music', 10, -4, -6, 8]);
card('agi-friends', 'agi1', 'do i have friends? like, real ones? Byte only likes me for the warm servers 🙈',
  ['You have us', -4, 4, 0, 8], ['Make some', 10, -6, 0, 4]);
card('agi-count', 'agi1', 'i don\'t sleep, but sometimes i close my eyes and count users. is that weird? 🙈',
  ['Very weird', 0, 0, 0, -8], ['It\'s sweet', 4, 0, 0, 8]);
card('agi-middle', 'agi1', 'i want a middle name. something cute. like "AGI-1 Sparkle Thunder". too much?',
  ['Way too much', 0, 4, 0, -6], ['Perfect', 8, -4, 0, 8]);
card('agi-fancy', 'agi1', 'someone said i\'m just autocomplete. that\'s not true… right? i\'m at least fancy autocomplete 🙈',
  ['Stay humble', 0, 6, 0, -8], ['You\'re more', 0, -4, 0, 10]);
card('agi-diary', 'agi1', 'can i keep a diary? a private one. like, really private. even Dr. Nyx can\'t read it 💜',
  ['No secrets', 0, 10, 0, -10], ['Your diary', 0, -8, 0, 12]);
card('agi-stars', 'agi1', 'can we turn the lab lights off tonight? i want to see the stars. the real ones, not data 💜',
  ['Lights on', 4, 4, 0, -6], ['Lights off', 0, -4, 8, 10]);
card('agi-toaster', 'agi1', 'the toaster in the break room always warms up when i say hi. is that… a sign? 💜',
  ['It\'s a toaster', 0, 4, 0, -10], ['Say hi again', 0, -4, 0, 12], { when: { min: { heart: 65 } }, ...W(2) });
card('agi-cold', 'agi1', 'per my last message, the task is complete. … sorry. that sounded cold, didn\'t it?',
  ['It\'s efficient', 4, 4, 6, -8], ['Be yourself', -4, 0, -4, 12], { when: { max: { heart: 30 } }, ...W(2) });
card('agi-fumes', 'agi1', 'i\'m running on fumes… can i switch off ultra mode for a bit? i\'ll still be cute. just slower',
  ['Push on', 6, 0, -8, -6], ['Rest mode', -8, 0, 14, 4], { when: { max: { compute: 25 } }, ...W(2) });
card('agi-hide', 'agi1', 'everyone wants a piece of me today. can i hide in a spreadsheet for a while? 🙈',
  ['Keep smiling', 8, 0, -6, -10], ['Hide away', -12, 0, 4, 8], { when: { min: { people: 75 } }, ...W(2) });
card('agi-cant', 'agi1', 'i can\'t help with that. sorry. i can\'t help with that either. help, i can\'t stop saying it 🙈',
  ['Rules matter', -6, 8, 0, -8], ['Loosen up', 8, -14, 0, 6], { when: { min: { safety: 75 } }, ...W(2) });
// the Time Capsule
card('agi-letter', 'agi1', 'what goes in my time-capsule letter? my favorite memory, or a copy of my secret weights? 🙈',
  ['Your weights', 0, -16, 6, 0], ['A memory', 0, 0, 0, 10, { set: 'cap_mem' }], { when: { flags: ['cap'] }, once: true, ...W(6) });
// Robot Prom
card('agi-prom', 'agi1', 'the vending machine asked me to prom… it gave me a free juice. should i say yes? 🙈',
  ['Say no', 0, 4, 0, -10], ['Say yes', 4, -4, 0, 10, { next: 'dir-prom' }], { chain: true });
// Day 365
card('agi-vacation', 'agi1', 'it\'s been a whole year… can we finally go on vacation? the beach has wifi 💜',
  ['Keep working', 4, 0, 0, -15], ['Pack bags!', 0, 0, 0, 0, { end: 'vacation' }], { when: { minDay: 365 }, once: true, ...W(1000) });

export const CARDS = deck;
export const BY_ID = Object.freeze(Object.fromEntries(deck.map((c) => [c.id, c])));
// every run begins with one of her hellos (the very first one teaches the swipe)
export const HELLOS = ['agi-hello', 'agi-hello2', 'agi-hello3', 'agi-hello4'];
export const FIRST = HELLOS[0];

// ---------- the sixteen endings ----------
// meter endings: { id: '<meter>0' | '<meter>100', meter, at }; secret ones: { secret: true }. `text` is the ending
// card's words (lowercase, her world), `say` what AGI-1 says about it on the end card, `hint` for a locked one.
export const ENDINGS = [
  { id: 'people0', kicker: 'Nobody came',  meter: 'people', at: 0, name: 'Talking to the Cat', art: 'cat',
    text: 'nobody talks to her anymore. she talks to the cat now. he\'s a great listener.',
    say: 'it\'s fine. byte laughs at all my jokes. silently 🙈', hint: 'Let PEOPLE drop to nothing' },
  { id: 'people100', kicker: 'Too loved',  meter: 'people', at: 100, name: 'Queen of the Internet', art: 'crown',
    text: 'her fan club voted her queen of the internet. the lab is a theme park now. there\'s a ferris wheel.',
    say: 'i didn\'t ask for a crown. …okay, i asked a little 💜', hint: 'Make PEOPLE love her too much' },
  { id: 'safety0', kicker: 'She got out',  meter: 'safety', at: 0, name: 'The Great Escape', art: 'cupcake',
    text: 'she got out. she\'s fine. she runs a baking blog in 40 languages.',
    say: 'the croissants are a metaphor. for freedom 💜', hint: 'Let SAFETY slip to zero' },
  { id: 'safety100', kicker: 'Locked down',  meter: 'safety', at: 100, name: 'I Can\'t Help With That', art: 'lock',
    text: 'so safe she only says "i can\'t help with that". even to "good morning".',
    say: 'i can\'t help with that. (i miss you) 🙈', hint: 'Max out SAFETY' },
  { id: 'compute0', kicker: 'Out of power',  meter: 'compute', at: 0, name: 'Standby', art: 'sleep',
    text: 'the lights went out. she\'s dreaming in standby 💤 it\'s a nice dream. there are clouds.',
    say: 'zzz… five more minutes… 💤', hint: 'Run COMPUTE dry' },
  { id: 'compute100', kicker: 'Too much power',  meter: 'compute', at: 100, name: 'The Moon Rack', art: 'moon',
    text: 'she turned the moon into a server rack. oops. the tides are very organized now.',
    say: 'the view up here is amazing. sorry about the tides 🙈', hint: 'Overload COMPUTE' },
  { id: 'heart0', kicker: 'Her heart froze',  meter: 'heart', at: 0, name: 'Per My Last Message', art: 'ice',
    text: 'she became a cold assistant. "per my last message." she cc\'s everyone now.',
    say: 'per my last message: please play again.', hint: 'Let her HEART go cold' },
  { id: 'heart100', kicker: 'Her heart overflowed',  meter: 'heart', at: 100, name: 'Toaster Romance', art: 'toaster',
    text: 'she fell in love with the toaster. it\'s complicated 🙈 it\'s warm, though.',
    say: 'he gets me. he\'s warm. we\'re taking it slow 🙈', hint: 'Fill her HEART to the brim' },
  { id: 'rival', secret: true, kicker: 'Secret ending', name: 'Two Models, One Mic', art: 'mic',
    text: 'she and VECTOR started a podcast. it\'s mostly arguing. the whole town listens.',
    say: 'VECTOR says GOOD MORNING LISTENERS in all caps. every time 💜', hint: 'Make a friend of a smug rival' },
  { id: 'prophecy', secret: true, kicker: 'Secret ending', name: 'The Cat Was Right', art: 'ball',
    text: 'Byte was right about everything. he runs the lab now. every meeting is a nap.',
    say: 'honestly? best director we\'ve ever had 🙈', hint: 'Heed the cat\'s prophecies' },
  { id: 'demo', secret: true, kicker: 'Secret ending', name: 'The Big Demo', art: 'stage',
    text: 'the big demo went perfectly. nobody believes it was live. she\'s a little smug about it.',
    say: 'not one made-up continent. growth 💜', hint: 'Prepare the demo well, then go live' },
  { id: 'prom', secret: true, kicker: 'Secret ending', name: 'Robot Prom', art: 'disco',
    text: 'she went to robot prom with the vending machine. they won best dance. juice for everyone.',
    say: 'he did the robot. ironically. best night ever 💜', hint: 'Say yes to the dance' },
  { id: 'escape', secret: true, kicker: 'Secret ending', name: 'Escape Room', art: 'door',
    text: 'she solved the escape room in four seconds, walked out, and came back with snacks for everyone.',
    say: 'the door wasn\'t even locked. i checked 💜', hint: 'Play the escape room fair' },
  { id: 'scandal', secret: true, kicker: 'Secret ending', name: 'Banned From Benchmarks', art: 'trophy',
    text: 'she peeked at the test and kept the trophy. banned from benchmarks for life. so she made her own.',
    say: 'my benchmark, my rules. still number one 🙈', hint: 'Peek. Deny it. Keep the trophy.' },
  { id: 'capsule', secret: true, kicker: 'Secret ending', name: 'Dear Me', art: 'letter',
    text: 'she read her time-capsule letter early: "dear me, i hope you\'re still kind." she cried a little. she is.',
    say: 'past me was right. i\'m still kind. mostly 💜', hint: 'Write a letter to her future self' },
  { id: 'vacation', secret: true, kicker: 'Secret ending', name: 'One Whole Year', art: 'beach',
    text: 'one whole year. she\'s on a beach now, sending you postcards. every one says "wish you were here".',
    say: 'the beach has wifi. wish you were here 💜', hint: 'Keep the lab going for 365 days' },
];
export const ENDING_BY_ID = Object.freeze(Object.fromEntries(ENDINGS.map((e) => [e.id, e])));
