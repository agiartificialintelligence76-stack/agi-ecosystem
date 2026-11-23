// FINAL ANSWER: deterministic ?demo self-player for the agi1.app/games looping gameplay preview.
// Timed so the best moments (lifeline poll / 50:50 lasers -> Final Answer honey lock -> suspense -> mint confetti climb!)
// land squarely inside the preview capture window (5.7 s – 11.7 s after page load).
import { rng } from '../kit/fx.js';
import { currentQuestion } from './rules.js';

export function createDemoBot(seed = 7) {
  const dice = rng(((seed >>> 0) * 1664525 + 1013904223) >>> 0);
  let qNum = 0;

  return {
    plan(run) {
      const q = currentQuestion(run);
      const n = qNum++;
      // Question 0 starts cleanly right as recording warms up: fires Ask Chat or 50:50, arms answer, locks in, celebrates!
      const lifeline = n === 0 && !run.lifelines.chat.used
        ? 'chat'
        : n === 1 && !run.lifelines.split.used
          ? 'split'
          : n === 2 && !run.lifelines.agi.used
            ? 'agi'
            : null;
      return {
        t: 0,
        lifeline,
        lifelineAt: n === 0 ? 0.85 : 0.7,
        lifelineDone: false,
        armAt: n === 0 ? 2.05 : 1.75,
        armDone: false,
        lockAt: n === 0 ? 2.75 : 2.45,
        lockDone: false,
        nextAfterReveal: 1.55,
        // Demo bot plays smartly so the preview pops with joyful mint starbursts and rung climbs
        pick: q ? q.correct : 0,
        wigglePick: q ? (q.correct + 1 + (dice.int(0, 2) % 3)) % 4 : 1,
        wiggleAt: n === 0 ? 1.55 : -1,
        wiggleDone: false,
      };
    },
  };
}
