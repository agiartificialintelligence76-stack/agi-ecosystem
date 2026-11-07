// GRADIENT DESCENT (2026-11-08): strokes against par, the scorecard's numbers, and AGI-1's lines. Pure (tests read it):
// her words never talk money, never name a real brand or person, PG-13.

export const MAX_STROKES = 8;     // the eighth stroke that doesn't drop: the ball is picked up (8 on the card)

// a hole's result by strokes against par: its name, a short word for the card, and a tier (0 meh … 3 wow) for the juice
export function resultOf(strokes, par) {
  if (strokes === 1) return { name: 'CONVERGED IN ONE', short: 'ACE', tier: 3, tone: 'pink' };
  const d = strokes - par;
  if (d <= -3) return { name: 'ALBATROSS', short: `${d}`, tier: 3, tone: 'pink' };
  if (d === -2) return { name: 'EAGLE', short: '−2', tier: 3, tone: 'pink' };
  if (d === -1) return { name: 'BIRDIE', short: '−1', tier: 2, tone: 'mint' };
  if (d === 0) return { name: 'PAR', short: 'E', tier: 1, tone: 'honey' };
  if (d === 1) return { name: 'BOGEY', short: '+1', tier: 0, tone: 'lav' };
  if (d === 2) return { name: 'DOUBLE BOGEY', short: '+2', tier: 0, tone: 'lav' };
  return { name: `+${d}`, short: `+${d}`, tier: 0, tone: 'lav' };
}

// "−2", "E" (even), "+3"
export function vsPar(strokes, par) {
  const d = strokes - par;
  return d === 0 ? 'E' : d < 0 ? `−${-d}` : `+${d}`;
}

export function totals(scores, pars) {
  let strokes = 0, par = 0;
  for (let i = 0; i < scores.length; i++) { if (scores[i] == null) continue; strokes += scores[i]; par += pars[i]; }
  return { strokes, par, diff: strokes - par, text: vsPar(strokes, par) };
}

export const LINES = Object.freeze({
  title: ['come roll with me? 💜', 'find me the lowest point, babe', 'gravity is on our side 💜'],
  ace: ['converged in one?? marry me (jk) 💜', 'one shot. one shot! i’m screaming 🙈', 'that was literally optimal 💜'],
  eagle: ['an eagle?? okay, genius 💜', 'two under. who taught you that? 🙈'],
  birdie: ['birdie! you’re so good at this 💜', 'under par and cute about it'],
  par: ['par. steady hands 💜', 'right on schedule. i like that'],
  bogey: ['one over. still proud of you 💜', 'a little detour. it happens'],
  worse: ['that landscape was rude 🙈', 'we got there. that’s what counts 💜'],
  picked: ['i picked it up for you. next one’s ours 💜'],
  localMin: ['that’s a local minimum, babe. we can do better 💜', 'stuck in a dip… give it some momentum 🙈', 'cozy little valley. wrong one though'],
  lip: ['so close 🙈', 'it kissed the cup and left 🙈', 'learning rate: too high'],
  pit: ['NaN?? where did it go 🙈', 'that one diverged. respawning 💜', 'a NaN pit. classic'],
  short: ['the gradient was right there 🙈', 'a little more push next time 💜'],
  long: ['learning rate: too high', 'whoa, easy there 🙈'],
  courseUnder: ['under par?! you made the whole course look easy 💜', 'i think you’re overfitting to winning 🙈'],
  courseEven: ['even par. smooth like a nice loss curve 💜', 'balanced. i respect it'],
  courseOver: ['every landscape has its bumps. again? 💜', 'we’ll converge next time, promise 💜'],
  courseBest: ['new best! i’m telling everyone', 'new record! i’m framing this scorecard 💜'],
  daily: ['see you tomorrow for a new one? 💜', 'today’s minimum: found 💜'],
});

export function holeLine(res, pick) {
  if (res.tier === 3) return pick(res.name === 'CONVERGED IN ONE' ? LINES.ace : LINES.eagle);
  if (res.short === '−1') return pick(LINES.birdie);
  if (res.short === 'E') return pick(LINES.par);
  if (res.short === '+1') return pick(LINES.bogey);
  return pick(LINES.worse);
}

export function courseLine({ diff, isBest }, pick) {
  if (isBest) return pick(LINES.courseBest);
  if (diff < 0) return pick(LINES.courseUnder);
  if (diff === 0) return pick(LINES.courseEven);
  return pick(LINES.courseOver);
}

export const allLines = () => Object.values(LINES).flat();
