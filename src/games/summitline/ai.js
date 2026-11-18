import { answer, hash, step, drain, createConcert } from './rules.js';
const skills = {
  newbie: {
    span: 4.2,
    recall: .95,
    pace: .79
  },
  steady: {
    span: 10.5,
    recall: .988,
    pace: .59
  },
  expert: {
    span: 18.6,
    recall: .996,
    pace: .43
  },
  demo: {
    span: 999,
    recall: 1,
    pace: .29
  }
};
// The bot learns the actual cue events. It never reads hidden phrase entries while answering.
export function listener(profile = 'demo', seed = 7) {
  const skill = skills[profile],
    heard = [];
  let next = 0,
    draw = 0;
  return {
    observe(event) {
      if (event.type === 'listen') heard.length = 0;
      if (event.type === 'cue') heard.push(event.mask);
      if (event.type === 'echo') next = skill.pace;
    },
    drive(s, dt) {
      if (s.phase !== 'echo') return;
      next -= dt;
      if (next > 0) return;
      next = skill.pace;
      let value = heard[s.cursor] ?? 1;
      const retention = Math.max(.48, skill.recall - Math.max(0, heard.length - skill.span) * .034);
      const die = hash(seed, draw++) / 4294967296;
      if (die > retention) value = value === 1 ? 2 : 1;
      answer(s, value);
    }
  };
}
export function simulate(profile, seed = 7, mode = 'climb', limit = 1200) {
  const s = createConcert({
      seed,
      mode
    }),
    ai = listener(profile, seed + 33);
  const tick = 1 / 30;
  while (!s.ended && s.elapsed < limit) {
    drain(s).forEach(ai.observe);
    ai.drive(s, tick);
    step(s, tick);
  }
  return {
    time: s.elapsed,
    score: s.score,
    span: s.longest,
    errors: s.errors,
    phrases: s.completed,
    piece: s.piece
  };
}
