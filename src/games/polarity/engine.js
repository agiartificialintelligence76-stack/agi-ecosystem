// Pure magnetic-track simulation. Distances are radians travelled, so seeds repeat at every display rate.
export const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function random(seed) { let a = seed >>> 0; return () => { a += 0x6d2b79f5; let t = Math.imul(a ^ a >>> 15, a | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function createRun(seed = 7, mode = 'endless') {
  return { seed, mode, random: random(seed), time: 0, distance: 0, next: 1.8, lane: 0, radial: 0, cooldown: 0,
    hp: 3, shield: 0, charge: 0, combo: 0, score: 0, collected: 0, gates: 0, flips: 0, pulse: 0, phase: 'play', objects: [], events: [] };
}
export function flip(s) {
  if (s.phase !== 'play' || s.cooldown > 0) return false;
  s.lane = 1 - s.lane; s.cooldown = .16; s.flips++; s.events.push({ type: 'flip' }); return true;
}
export function burst(s) {
  if (s.phase !== 'play' || s.charge < 8) return false;
  s.charge = 0; s.pulse = 1; s.shield = Math.max(s.shield, 1.8);
  for (const o of s.objects) if (o.kind === 'gate' && o.at > s.distance && o.at < s.distance + 2.8 && !o.done) { o.done = true; s.score += 30; }
  s.events.push({ type: 'burst' }); return true;
}
function spawn(s) {
  while (s.next < s.distance + TAU) {
    const lane = s.random() < .5 ? 0 : 1;
    s.objects.push({ at: s.next, lane, kind: 'gate', done: false });
    s.objects.push({ at: s.next - .32, lane: 1 - lane, kind: 'spark', done: false });
    if (s.gates > 8 && s.random() < .25) s.objects.push({ at: s.next + .2, lane: 1 - lane, kind: 'spark', done: false });
    s.next += .84 + s.random() * .45;
  }
}
export function step(s, dt) {
  if (s.phase !== 'play') return;
  dt = clamp(dt, 0, .05); s.time += dt; s.cooldown = Math.max(0, s.cooldown - dt); s.shield = Math.max(0, s.shield - dt); s.pulse = Math.max(0, s.pulse - dt);
  s.radial += (s.lane - s.radial) * Math.min(1, dt * 18);
  const speed = Math.min(1.7, .86 + s.time * .004);
  s.distance += speed * dt; spawn(s);
  for (const o of s.objects) {
    if (o.done || o.at > s.distance + .06) continue;
    o.done = true;
    const same = Math.abs(o.lane - s.radial) < .43;
    if (o.kind === 'spark') {
      if (same) { s.combo++; s.collected++; s.charge = Math.min(8, s.charge + 1); const points = 25 + Math.min(s.combo, 20) * 5; s.score += points; s.events.push({ type: 'spark', points }); }
      else s.combo = 0;
    } else {
      s.gates++;
      if (same && s.shield <= 0) { s.hp--; s.combo = 0; s.shield = 1.45; s.events.push({ type: 'hit' }); if (!s.hp) s.phase = 'over'; }
      else { s.score += 10; s.events.push({ type: 'clear' }); }
    }
  }
  s.objects = s.objects.filter(o => o.at > s.distance - .7);
  if (s.mode === 'sprint' && s.time >= 90) { s.phase = 'won'; s.events.push({ type: 'finish' }); }
}
export function autopilot(s) {
  const threat = s.objects.find(o => !o.done && o.kind === 'gate' && o.at > s.distance && o.at < s.distance + .72);
  if (threat && s.lane === threat.lane) flip(s);
  if (s.charge === 8 && s.objects.some(o => o.kind === 'gate' && !o.done && o.at - s.distance < 1)) burst(s);
}
