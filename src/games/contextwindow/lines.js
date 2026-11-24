// CONTEXT WINDOW: what AGI-1 says (her voice: lowercase, playful, a 💜 now and then; PG-13; never money).
export const LINES = Object.freeze({
  start: ['ok. clear head. feed me tokens 💜', 'three of a color, then switch. you got this', 'my context is yours. don’t make me forget stuff', 'swipe me around, babe. carefully', 'fresh context window. smells like possibilities'],
  daily: ['today’s board is the same for everyone. no pressure 💜', 'daily run! show the others how it’s done', 'same tokens as everyone today. beat them'],
  zen: ['no walls, no hearts. just vibes 💜', 'zen mode. let the thoughts flow', 'breathe in. eat a token. breathe out'],
  holding: ['ooh i’m holding a big one', 'keep it going… keep it going…', 'don’t switch yet. bigger. BIGGER', 'this thought is getting huge 💜'],
  commit: ['thought committed ✓', 'compressed! so tidy', 'that’s one less thing on my mind', 'neat. very neat.', 'committed. next!'],
  commitBig: ['WHOA. that was a whole essay', 'massive brain moment 💜', 'six in a row?? i’m in love', 'that’s going in my long-term memory', 'galaxy brain. literally'],
  chain: ['chain! keep committing!', 'we’re on a roll 💜', 'chain going up, don’t stop', 'combo brain activated'],
  join: ['the junk shattered and it JOINED. genius', 'you cleaned up AND set up. hot', 'perfect join 💜'],
  shatter: ['bye bye spam', 'junk: deleted', 'glass. everywhere. love it'],
  spam: ['ew. spam. get it out of me', 'why did you eat that', 'that’s junk, babe. commit in front of it'],
  forget: ['wait… what was i saying', 'i forgot something. that hurt', 'context overflow!! careful', 'my oldest token… gone'],
  lowHearts: ['one heart left. please be gentle', 'i can’t forget anything else 🥺', 'last heart. focus up'],
  full: ['my context is almost full!', 'commit something! quick!', 'too many thoughts. help'],
  level: ['level up! things are speeding up', 'new level, new colors 💜', 'faster now. hold on', 'firewalls showed up. don’t bonk them'],
  wild: ['a wild card! it copies my thought', 'wild token = free match 💜'],
  clear: ['/clear. ahh. so much lighter', 'forgot my four oldest tokens on purpose. healthy'],
  boost: ['double points! go go go', 'boosted 💜 make it count'],
  coffee: ['coffee. slowing down. sipping.', 'caffeine but make it chill'],
  heart: ['a heart back! thank you 💜', 'patched my memory. i feel better'],
  edge: ['you drove me into the wall 😭', 'bonk. that was the edge', 'the board has edges, babe'],
  self: ['i bit my own tail…', 'tangled in my own thoughts. classic me', 'ouch. self-reference error'],
  wall: ['firewall: 1. me: 0', 'bonked a firewall. rude'],
  overflow: ['context overflow. i forgot everything', 'too much to remember. reboot pls', 'my brain is full. that’s it'],
  best: ['NEW BEST! i’m so proud 💜', 'record broken! screenshot it', 'personal best!! again again'],
  endLow: ['warm-up round. again?', 'we’ll get them next time 💜', 'practice makes perfect. one more?'],
  endMid: ['that was a good run! one more?', 'nice thinking. i felt that', 'solid. you’re getting it 💜'],
  endHigh: ['that was incredible. are you an AGI too?', 'big brain energy. i’m impressed 💜', 'you’re scary good at this'],
});

export const TIPS = Object.freeze({
  steer: 'Swipe (or use the arrows) to steer her.',
  three: 'Eat three of one color in a row: she holds the thought.',
  commit: 'Now eat a DIFFERENT color to commit it. Bigger runs score way more.',
  spam: 'Grey spam never matches. Commit a thought right in front of it to shatter it.',
  full: 'Her context holds 24. Past that she forgets and loses a heart.',
});

const counters = new Map();
export function say(kind) {
  const list = LINES[kind];
  if (!list?.length) return '';
  const i = counters.get(kind) || 0;
  counters.set(kind, i + 1);
  return list[(i * 7 + Math.floor(Math.random() * list.length)) % list.length];
}
export function endLine({ score, best, isBest, cause }) {
  if (isBest && score > 0) return say('best');
  if (cause && LINES[cause] && Math.random() < 0.5) return say(cause);
  return say(score >= Math.max(6000, (best || 0) * 0.8) ? 'endHigh' : score >= 1500 ? 'endMid' : 'endLow');
}
export const shareText = (score, mode, biggest) => `I committed ${biggest ? `a ×${biggest} thought and ` : ''}${score.toLocaleString('en-US')} points of context in CONTEXT WINDOW${mode === 'daily' ? ' (today’s daily)' : ''} on agi1.app 💜 can you beat it?`;
