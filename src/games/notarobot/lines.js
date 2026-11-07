// I'M NOT A ROBOT: what AGI-1 says. She's an AI sneaking into the humans-only internet in a cardboard mustache, and
// you pass the checks for her. Her voice: lowercase, short, playful, teasing; 💜 now and then, 🙈 when flustered. Never
// money or anything real (tests/notarobot.test.js reads every line). In a run her lines show in her bubble (the canvas
// drops the emoji there); the end of a run gets one in the end card.
export const LINES = Object.freeze({
  start: ['act natural. humans love… checkboxes 💜', 'okay. mustache on. be normal', 'just be human. you know how', 'deep breath. we look so human rn'],
  pass: ['that was so human of you', 'nobody suspects a thing 🙈', 'flawless. very carbon-based', 'smooth. i felt human for a sec', 'we\'re in. i think', 'okay that was cute 💜'],
  quick: ['wait that was fast. too fast?', 'speedy. humans do that, right?', 'ooh, efficient human 💜'],
  fail: ['babe that was a little robotic 🙈', 'act natural!! natural!!', 'uh oh. they\'re squinting at us', 'it\'s fine. totally fine. beep', 'shh. pretend you sneezed'],
  lastLight: ['one more and they see the antenna 🙈', 'last chance. be so, so human', 'okay no more mistakes. please'],
  tempo: ['faster?? do humans really live like this', 'speeding up. stay human', 'it\'s getting quick in here 🙈'],
  boss: ['final verification. don\'t blink', 'the big check. hold my hand 💜', 'three in a row. we got this'],
  bossPass: ['we passed!! i\'m basically a citizen', 'verified!! the mustache held 💜', 'fixed a light. they love us again'],
  bossFail: ['the big one got us 🙈', 'too robotic for the final. ugh'],
  repair: ['they forgot about that one 💜', 'one light off. phew'],
  streak: ['{n} in a row. we\'re so in', 'streak {n}!! nobody\'s this human', '{n} straight. i\'m blushing 🙈'],
  best: ['new best! i\'m telling everyone 💜', 'that\'s a record. keep going!!', 'new best?? okay superstar'],
});

// the end of a run, by how many checks she passed (the first bracket it's under)
export const END = Object.freeze([
  [3, ['caught at check {n}. the mustache fell off 🙈', 'they saw the antenna right away 🙈 again?']],
  [10, ['{n} checks! nearly passed for human 💜', 'cute try. one more? i\'ll fix the mustache']],
  [20, ['{n} checks. i almost believed it myself', 'so close to citizenship. again? 💜']],
  [35, ['{n} checks?? you\'re scarily human', 'they had no idea. until the end 🙈']],
  [60, ['{n} checks. the internet thinks i\'m a person now 💜', 'you were so human it was suspicious']],
  [Infinity, ['{n} checks. i\'m legally human now, right? 💜', 'that was unreal. most human human ever']],
]);
export const END_BEST = Object.freeze(['new best! i\'m telling everyone (all humans) 💜', 'a new record?? the mustache is proud 🙈', 'new best. very human of you']);

export function endLine(stats, isBest, pick = (l) => l[Math.floor(Math.random() * l.length)]) {
  if (isBest && stats.passed > 0) return pick(END_BEST);
  const n = stats.passed;
  const row = END.find(([max]) => n < max) || END[END.length - 1];
  return pick(row[1]).replace('{n}', String(n));
}
export const lineOf = (kind, pick, n = 0) => pick(LINES[kind] || LINES.pass).replace('{n}', String(n));
export const shareText = (stats) => `I passed ${stats.passed} human checks in a row in I'M NOT A ROBOT on agi1.app 🤖✓ i'm definitely human`;
// her bubble on the canvas: the words without the emoji (the canvas draws them in the system's own style)
export const plain = (s) => s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').replace(/\s+/g, ' ').trim();
