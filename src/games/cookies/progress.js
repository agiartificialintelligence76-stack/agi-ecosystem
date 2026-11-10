// ACCEPT ALL COOKIES: the player's progress, kept in this browser by the kit's store ({ levels: { '1-4': { stars } } }).
// Pure (no DOM): stars add up, sites open at 15 and 35 stars, a level opens when the one before it on its site is fed.
import { LEVELS, SITES } from './levels.js';

export const MAX_STARS = LEVELS.length * 3;
export const starsOf = (prog, id) => (prog && prog[id] ? prog[id].stars || 0 : 0);
export const fed = (prog, id) => Boolean(prog && prog[id]);
export const totalStars = (prog) => LEVELS.reduce((s, l) => s + starsOf(prog, l.id), 0);
export const fedCount = (prog) => LEVELS.filter((l) => fed(prog, l.id)).length;
export const siteStars = (prog, site) => LEVELS.filter((l) => l.site === site).reduce((s, l) => s + starsOf(prog, l.id), 0);
export const siteOpen = (prog, site) => totalStars(prog) >= (SITES.find((s) => s.id === site)?.unlock ?? Infinity);
export function levelOpen(prog, L) {
  if (!siteOpen(prog, L.site)) return false;
  if (L.n === 1) return true;
  return fed(prog, `${L.site}-${L.n - 1}`);
}
// where Play goes: the first open level not fed yet; else the first open one under three pixels; else the first
export function nextLevel(prog) {
  return LEVELS.find((l) => levelOpen(prog, l) && !fed(prog, l.id))
    || LEVELS.find((l) => levelOpen(prog, l) && starsOf(prog, l.id) < 3)
    || LEVELS[0];
}
// a level fed with `stars` pixels: the best is kept → { prog, better, first, opened: [site ids opened just now] }
export function record(prog, id, stars) {
  const before = { ...(prog || {}) };
  const old = before[id];
  const next = { ...before, [id]: { stars: Math.max(old?.stars || 0, stars) } };
  const opened = SITES.filter((s) => !siteOpen(before, s.id) && siteOpen(next, s.id)).map((s) => s.id);
  return { prog: next, better: !old || stars > (old.stars || 0), first: !old, opened };
}
