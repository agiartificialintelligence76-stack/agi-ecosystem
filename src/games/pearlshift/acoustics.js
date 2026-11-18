export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export function position(fish, time) {
  return {
    x: fish.x + fish.ax * Math.sin(time * fish.speed + fish.phase),
    y: fish.y + fish.ay * Math.cos(time * fish.speed * .77 + fish.phase)
  };
}
export function hearing(receiver, fish, time, region) {
  const p = position(fish, time),
    dx = p.x - receiver.x,
    dy = p.y - receiver.y,
    distance = Math.hypot(dx, dy);
  const layers = fish.depth - receiver.depth;
  const bend = layers * region.bend * (.45 + .15 * Math.sin(time * .17 + fish.phase));
  const theta = Math.atan2(dy, dx) + bend;
  return {
    species: fish.species,
    theta,
    distance,
    pan: clamp(Math.cos(theta), -1, 1),
    strength: clamp(.95 - distance * .65 - Math.abs(layers) * .24, .11, 1),
    filter: Math.max(340, 3300 / (1 + Math.abs(layers) * 1.8 + distance)),
    layers,
    bend
  };
}
export function crossBearings(a, b) {
  const x1 = Math.cos(a.theta),
    y1 = Math.sin(a.theta),
    x2 = Math.cos(b.theta),
    y2 = Math.sin(b.theta);
  const det = x1 * y2 - y1 * x2;
  if (Math.abs(det) < .10 || Math.hypot(a.x - b.x, a.y - b.y) < .095) return null;
  const dx = b.x - a.x,
    dy = b.y - a.y,
    u = (dx * y2 - dy * x2) / det,
    v = (dx * y1 - dy * x1) / det;
  if (u < -.02 || v < -.02) return null;
  const x = a.x + u * x1,
    y = a.y + u * y1;
  if (x < 0 || y < 0 || x > 1 || y > 1) return null;
  return {
    x,
    y,
    quality: Math.abs(det)
  };
}
export function bestFix(samples, species) {
  let best = null;
  for (let i = 0; i < samples.length; i++) for (let j = i + 1; j < samples.length; j++) {
    const a = samples[i],
      b = samples[j];
    if (a.species !== species || b.species !== species || a.depth !== b.depth) continue;
    const fix = crossBearings(a, b);
    if (!fix) continue;
    const score = fix.quality / (1 + .05 * (samples.at(-1).time - a.time));
    if (!best || score > best.score) best = {
      ...fix,
      score,
      age: b.time
    };
  }
  return best;
}
