// JAILBREAK: what the game keeps in this browser (each level's best stars, the bests) and the sums it shows (a level's
// stars and its clear bonus). Pure: game.js reads and writes it through the arcade kit's store (shell.store).
import { LEVELS, LEVEL_COUNT } from './levels.js';

export const STARS_MAX = 3;

// A level's stars: one for breaking her out, one for losing no life on the way, one for beating its par time
export const starsFor = ({ lost, time, par }) => 1 + (lost === 0 ? 1 : 0) + (time <= par ? 1 : 0);

// The bonus on top of the bricks when a level is clear (shown line by line on the level-clear card)
export function clearBonus({ time, par, lives, lost }) {
  const clear = 500;
  const fast = Math.max(0, Math.round((par - time) * 10));
  const kept = Math.max(0, lives) * 150;
  const flawless = lost === 0 ? 500 : 0;
  return { clear, fast, kept, flawless, total: clear + fast + kept + flawless };
}

// The save as it's kept: { stars: { '1-1': 3, … }, best, bestEndless, bestLayer, freed }. Anything damaged is dropped.
export function normalize(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const stars = {};
  for (const L of LEVELS) {
    const n = Number(r.stars?.[L.id]);
    if (Number.isInteger(n) && n >= 1 && n <= STARS_MAX) stars[L.id] = n;
  }
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  return { ...r, stars, best: num(r.best), bestEndless: num(r.bestEndless), bestLayer: num(r.bestLayer), freed: num(r.freed) };
}

// A new save with a level's stars (the best ever kept)
export function withStars(save, id, n) {
  const s = normalize(save);
  return { ...s, stars: { ...s.stars, [id]: Math.max(s.stars[id] || 0, Math.min(STARS_MAX, Math.max(1, n | 0))) } };
}

export const totalStars = (save) => Object.values(normalize(save).stars).reduce((a, b) => a + b, 0);
export const worldStars = (save, world) => LEVELS.filter((l) => l.world === world).reduce((a, l) => a + (normalize(save).stars[l.id] || 0), 0);
// a level is open once the one before it is cleared (the first always is)
export const isOpen = (save, index) => index === 0 || (index > 0 && index < LEVEL_COUNT && Boolean(normalize(save).stars[LEVELS[index - 1].id]));
// the next level to play: the first open one not cleared yet (all cleared: the last)
export function nextUp(save) {
  const s = normalize(save);
  for (let i = 0; i < LEVEL_COUNT; i++) if (!s.stars[LEVELS[i].id]) return isOpen(s, i) ? i : Math.max(0, i - 1);
  return LEVEL_COUNT - 1;
}
// Endless opens once World 1's Warden is down
export const endlessOpen = (save) => Boolean(normalize(save).stars['1-5']);
export const cleared = (save) => Object.keys(normalize(save).stars).length;
