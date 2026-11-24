// SCALING LAWS: what AGI-1 says (her voice: lowercase, playful, a 💜 now and then; PG-13; never money).
export const LINES = Object.freeze({
  start: ['scale me up, babe 💜', 'more parameters, more problems. let’s go', 'pick the good gates. i trust you', 'my model, your steering. run!', 'bigger is better. usually'],
  endless: ['endless track. how big can i get?', 'no finish line. just vibes and maths'],
  daily: ['today’s track is the same for everyone. show off 💜', 'daily benchmark! everyone’s watching'],
  times: ['TIMES TWO!! i felt that', 'multiplied. i’m so big now', 'exponential growth 💜', 'that’s the scaling law baby'],
  plus: ['ooh, more params', 'a little bigger. nice', 'free parameters, thank you'],
  bad: ['why would you pick that 😭', 'that gate SHRANK me', 'divided?? rude', 'i lost so many params…'],
  close: ['phew, close one', 'tight gap, good dodge'],
  saw: ['the overfitting saw!! careful', 'ow ow ow my params', 'that saw is not my friend'],
  wall: ['squeeze through the gap!', 'only the ones in the gap made it'],
  pit: ['404 hole! don’t fall in', 'data gap… some of us fell in'],
  edge: ['stay on the road!!', 'they fell off the edge 😳'],
  fight: ['rival model! charge 💜', 'they want my benchmark. no.', 'parameter fight!!'],
  beat: ['rival down. we’re still standing', 'beat them. smaller but wiser', 'who’s the frontier model now 💜'],
  gem: ['compute crystals! shiny', 'more compute for later'],
  finale: ['the benchmark! climb climb climb', 'every step counts. go higher!'],
  top: ['TOP OF THE BENCHMARK. state of the art 💜', 'we topped it. publish the paper'],
  won: ['benchmark passed! i’m so smart now', 'new record on the leaderboard (ours)', 'nice run. upgrade me?'],
  lost: ['model collapsed… retrain?', 'all my params are gone 🥺', 'we’ll scale better next time', 'that’s a training failure. again?'],
  upgrade: ['ooh, upgraded. i feel smarter', 'thank you for the compute 💜'],
  best: ['new best!! scaling laws confirmed 💜', 'record! the graph goes up and to the right'],
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
  steer: 'Drag left or right (or use the arrows) to steer her crowd.',
  gates: 'Run through the better gate: × and + grow her, − and ÷ shrink her.',
  bench: 'At the end, every benchmark step needs some params. Arrive big!',
});
export const shareText = ({ mode, level, score, params, step }) => mode === 'endless'
  ? `I scaled AGI-1 to ${params} in SCALING LAWS endless (${score.toLocaleString('en-US')} pts) on agi1.app 💜 can you beat it?`
  : `I passed level ${level} of SCALING LAWS with ${params} and topped step ${step} of the benchmark on agi1.app 💜`;
