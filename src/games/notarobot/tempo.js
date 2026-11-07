// I'M NOT A ROBOT: the pace of a run (pure numbers, no DOM). Every 5 checks passed the tempo goes up: each check gets
// less time (4.5 s at the start, 2.4 s at the most), the bumpers and stamps get shorter, the checks get harder (levels
// 1 to 3) and the music gets faster. Every 15 passes: a boss check, FINAL VERIFICATION.
export const TEMPO_EVERY = 5;
export const BOSS_EVERY = 15;
export const LIGHTS = 4;            // suspicion lights: the fourth one on and she's caught
export const MAX_TEMPO = 9;

// seconds for one check at this tempo (its own `time` scale on top: a word to type gets a little longer)
export function gameTime(tempo, scale = 1) {
  const base = Math.max(2.4, 4.5 * 0.88 ** (Math.max(1, tempo) - 1));
  return Math.max(1.7, base * scale);
}
// the command slamming in before each check
export const bumperTime = (tempo) => Math.max(0.5, 0.9 - 0.07 * (Math.max(1, tempo) - 1));
// the VERIFIED / ROBOTIC stamp after it
export const stampTime = (tempo) => Math.max(0.6, 0.9 - 0.05 * (Math.max(1, tempo) - 1));
// the three-step boss check, one shared fuse
export const bossTime = (tempo) => Math.max(8, 10.5 - 0.35 * Math.max(0, tempo - 4));
// the soundtrack's beats per minute
export const bpmFor = (tempo) => Math.min(178, 116 + 9 * (Math.max(1, tempo) - 1));
// how fast things move inside a check (a gentle push on top of its level)
export const speedOf = (tempo) => 1 + 0.05 * (Math.max(1, tempo) - 1);

// how hard the next check is (1, 2 or 3): mostly easy at first, mostly hard from tempo 5
const LEVEL_ODDS = [
  null,
  [1, 0, 0],
  [0.75, 0.25, 0],
  [0.4, 0.5, 0.1],
  [0.15, 0.6, 0.25],
  [0, 0.45, 0.55],
  [0, 0.25, 0.75],
];
export function levelFor(tempo, r) {
  const odds = LEVEL_ODDS[Math.min(LEVEL_ODDS.length - 1, Math.max(1, tempo))];
  let roll = r.next();
  for (let i = 0; i < 3; i++) { roll -= odds[i]; if (roll < 0) return i + 1; }
  return 3;
}

// a fast pass earns a little extra (shown on the stamp)
export function speedBonus(elapsed, total) {
  const k = elapsed / Math.max(0.001, total);
  if (k < 0.35) return { bonus: 5, label: 'LIGHTNING' };
  if (k < 0.55) return { bonus: 3, label: 'QUICK' };
  return { bonus: 0, label: '' };
}
export const PASS_POINTS = 10;
export const BOSS_BONUS = 40;
