// AIR GAP: her five settings, the stars and what unlocks what, and the save (local only). Pure: no DOM.
import { TARGETS } from './match.js';

export const SETTINGS = [
  { id: 'sleepy', name: 'Sleepy', blurb: 'Drifts, yawns, guards the middle. Shoot while she dozes.', tag: 'Half awake' },
  { id: 'playful', name: 'Playful', blurb: 'Attacks straight at you. Doesn’t see bank shots coming.', tag: 'Straight shooter' },
  { id: 'competitive', name: 'Competitive', blurb: 'Predicts the bounces and covers the angles.', tag: 'Reads the rails' },
  { id: 'tryhard', name: 'Tryhard', blurb: 'Bank shots into the far corner. Fakes one way, shoots the other.', tag: 'Bank shots, fakes' },
  { id: 'nomercy', name: 'No mercy', blurb: 'Reads your mallet and punishes every gap.', tag: 'Reads your hands' },
];
export const TOP = SETTINGS.length - 1;

// a win's stars: 1 a win, 2 by three goals or more, 3 a shutout (0: not a win)
export function starsFor(you, her) {
  if (!(you > her)) return 0;
  if (her === 0) return 3;
  return you - her >= 3 ? 2 : 1;
}

const fresh = () => ({
  v: 1, unlocked: 0, level: 0, stars: [0, 0, 0, 0, 0], wins: [0, 0, 0, 0, 0], losses: [0, 0, 0, 0, 0],
  settings: { powerups: true, to: 7, turbo: false }, pp: [0, 0], fastest: 0, matches: 0, taught: false,
});

// whatever was kept (or nothing, or something broken) → a save we can trust
export function readSave(raw) {
  const s = fresh();
  if (!raw || typeof raw !== 'object') return s;
  const int = (v, lo, hi, d) => (Number.isInteger(v) && v >= lo && v <= hi ? v : d);
  s.unlocked = int(raw.unlocked, 0, TOP, 0);
  s.level = Math.min(s.unlocked, int(raw.level, 0, TOP, 0));
  for (const k of ['stars', 'wins', 'losses']) {
    if (Array.isArray(raw[k])) s[k] = s[k].map((d, i) => int(raw[k][i], 0, k === 'stars' ? 3 : 1e7, d));
  }
  if (raw.settings && typeof raw.settings === 'object') {
    s.settings.powerups = raw.settings.powerups !== false;
    s.settings.to = TARGETS.includes(raw.settings.to) ? raw.settings.to : 7;
    s.settings.turbo = raw.settings.turbo === true;
  }
  if (Array.isArray(raw.pp)) s.pp = [int(raw.pp[0], 0, 1e7, 0), int(raw.pp[1], 0, 1e7, 0)];
  s.fastest = typeof raw.fastest === 'number' && Number.isFinite(raw.fastest) && raw.fastest > 0 ? Math.min(raw.fastest, 1e4) : 0;
  s.matches = int(raw.matches, 0, 1e7, 0);
  s.taught = raw.taught === true;
  // a setting can't be unlocked without a win below it (a save edited by hand keeps what it earned)
  while (s.unlocked > 0 && !s.wins[s.unlocked - 1]) s.unlocked--;
  s.level = Math.min(s.level, s.unlocked);
  return s;
}

// a finished match against her at `level`: → { save, stars, best (new best stars here), unlocked (the setting it
// opened, or −1), top (beat No mercy) }. The save given isn't changed.
export function recordMatch(save, level, you, her) {
  const s = readSave(JSON.parse(JSON.stringify(save)));
  const stars = starsFor(you, her);
  s.matches++;
  if (stars) s.wins[level]++; else s.losses[level]++;
  const best = stars > s.stars[level];
  if (best) s.stars[level] = stars;
  let unlocked = -1;
  if (stars && level < TOP && s.unlocked === level) { s.unlocked = level + 1; unlocked = level + 1; }
  return { save: s, stars, best, unlocked, top: Boolean(stars) && level === TOP };
}

export const totalStars = (save) => save.stars.reduce((a, b) => a + b, 0);
export const isUnlocked = (save, level) => level >= 0 && level <= save.unlocked;
