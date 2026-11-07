// MERGE TO AGI (2026-11-08): the eleven tiers of the compute jar, from a single BIT up to AGI-1 herself, what making
// each one is worth, and which ones the dropper hands out. Pure: no DOM, no clock (tests/mergeagi.test.js reads it).

export const MAX_TIER = 11;                 // AGI-1; two of her make the SINGULARITY
export const SINGULARITY = 12;              // not an orb: the merge of two AGI-1s (both vanish in a shockwave)
export const DROP_MAX = 5;                  // the dropper only ever hands out tiers 1 to 5

// by tier number (index 0 is unused, so NAMES[7] is the GPU)
export const NAMES = Object.freeze(['', 'BIT', 'BYTE', 'TOKEN', 'PROMPT', 'NEURON', 'CHIP', 'GPU', 'CLUSTER', 'DATACENTER', 'SUPERMIND', 'AGI-1', 'SINGULARITY']);
// radii for a 400-unit jar
export const RADII = Object.freeze([0, 15, 19, 25, 31, 38, 46, 55, 64, 75, 87, 100]);
// each tier its own sticker color; neighbours always clearly different (and each has its own glyph and size too)
export const COLORS = Object.freeze(['', '#3ff0c3', '#ff4da6', '#ffc933', '#59c8ff', '#ff8a3d', '#2fd27a', '#ff5a5f', '#cdb8ff', '#3d7bff', '#2b1580', '#e4d9ff', '#ffffff']);
// a second color per tier for its sparks and glyph accents
export const ACCENTS = Object.freeze(['', '#c9fff0', '#ffd1e8', '#fff0b8', '#d4f1ff', '#ffd2b0', '#c6f7da', '#ffd0d1', '#f3edff', '#c9dbff', '#ff9bd8', '#ff4da6', '#e4d9ff']);

// points for making tier n: the triangular numbers 1, 3, 6 … 66 (× the chain multiplier)
export const points = (tier) => (tier >= SINGULARITY ? SINGULARITY_POINTS : (tier * (tier + 1)) / 2);
export const SINGULARITY_POINTS = 1000;

// the dropper: tiers 1–5, weighted toward the small ones; the first drops are small so a first merge comes at once
export const OPENING = Object.freeze([1, 1, 2]);
export const SPAWN_WEIGHTS = Object.freeze([0, 26, 24, 20, 16, 14]);
// the biggest tier the dropper hands out after `drops` drops (a gentle start: 1–3, then 1–4, then 1–5)
export const dropCap = (drops) => (drops < 6 ? 3 : drops < 14 ? 4 : DROP_MAX);

// the next tier for the dropper: `rand` is a kit rng() (seeded), `drops` how many orbs were dropped so far
export function spawnTier(rand, drops) {
  if (drops < OPENING.length) return OPENING[drops];
  const cap = dropCap(drops);
  let total = 0;
  for (let t = 1; t <= cap; t++) total += SPAWN_WEIGHTS[t];
  let roll = rand.next() * total;
  for (let t = 1; t <= cap; t++) {
    roll -= SPAWN_WEIGHTS[t];
    if (roll < 0) return t;
  }
  return cap;
}

export const nameOf = (tier) => NAMES[Math.max(0, Math.min(SINGULARITY, tier | 0))] || '';
