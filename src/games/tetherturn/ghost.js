import { runLeg } from './flight.js';
export const VERSION = 3;
export function validGhost(course, ghost) {
  if (!ghost || ghost.version !== VERSION || ghost.id !== course.id || ghost.variant !== course.variant || !Array.isArray(ghost.legs) || ghost.legs.length !== course.legs.length) return false;
  return ghost.legs.every(t => t && Number.isFinite(t.angle) && Number.isFinite(t.power) && t.power >= .08 && t.power <= 1 && Array.isArray(t.controls) && t.controls.length <= 5 && t.controls.every((c, i) => Number.isInteger(c.tick) && c.tick >= 0 && c.tick < 1400 && (!i || c.tick >= t.controls[i - 1].tick) && ['port', 'starboard', 'flip', 'brake'].includes(c.id)));
}
export function ghostPath(course, legId, saved) {
  if (!validGhost(course, saved)) return null;
  const run = runLeg(course.legs[legId], saved.legs[legId], true);
  return run.flight.phase === 'sunk' ? run.points : null;
}
export function rankFlight(strokes, par, spent, rings) {
  return Math.max(50, 280 + par * 75 + rings * 35 - Math.max(0, strokes - par) * 48 - spent * 3);
}
export function recordFlight(api, course, strokes, spent, rings, legs) {
  const score = rankFlight(strokes, course.par, spent, rings),
    id = course.id + '/' + course.variant;
  api?.update?.(d => {
    const old = d.orbitPost || {},
      best = {
        ...(old.bests || {})
      },
      past = best[id];
    if (!past || score > past.score) best[id] = {
      id: course.id,
      variant: course.variant,
      version: VERSION,
      score,
      strokes,
      rings,
      legs
    };
    const flags = {
      ...(old.flags || {}),
      [course.id]: true
    };
    return {
      ...d,
      orbitPost: {
        ...old,
        bests: best,
        flags
      }
    };
  });
  return score;
}
