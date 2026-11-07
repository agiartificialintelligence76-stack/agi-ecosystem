// ROBOTAXI RUSH: what stands by the road at each segment (palms, lamps, neon signs, AGI-1's billboards, chevrons on the
// curves, gantries over the road, the checkpoint gate). Pure: the same segment always gets the same things (a hash of its
// index), so nothing needs keeping as the road goes by.
import { ROAD_HALF, EDGE, ZONE_SEGS } from './config.js';
import { hash, hash01, isGate } from './track.js';

export const MAX_DECOR = 5;
// out: an array of MAX_DECOR { kind, x, v } (kind: a sprite's name, x: where it stands across the road, v: which one)
export function decorAt(i, zone, curve, out) {
  let n = 0;
  const put = (kind, x, v = 0) => { if (n < MAX_DECOR) { const o = out[n++]; o.kind = kind; o.x = x; o.v = v; } };
  if (isGate(i)) { put('gate', 0); return n; }
  const toGate = i % ZONE_SEGS;
  if (toGate > ZONE_SEGS - 6 || toGate < 4) return 0;          // a clear stretch around the gate
  const h = hash(i, 11), r = hash01(i, 23);
  const side = h & 1 ? 1 : -1;
  // a gantry over the road now and then (not on the coast)
  if (zone !== 'coast' && i % 330 === 165) { put('gantry', 0, hash(i, 5) % 4); return n; }
  // chevrons on the outside of a sharp curve
  if (Math.abs(curve) > 2.6 && i % 4 === 0) put(curve > 0 ? 'chevronL' : 'chevronR', -Math.sign(curve) * (EDGE + 380));
  // AGI-1's billboards
  if (i % 47 === 0 && hash01(i, 31) < 0.8) { put('billboard', side * (ROAD_HALF * 1.95 + r * 600), hash(i, 7) % 5); }
  switch (zone) {
    case 'dusk':
      if (i % 6 === 0) put('palm', -(ROAD_HALF * 1.32 + r * 300), 0);
      if (i % 6 === 3) put('palm', ROAD_HALF * 1.32 + r * 300, 0);
      if (i % 4 === 2) put('post', side * (EDGE + 150));
      break;
    case 'night':
      if (i % 9 === 0) put('lampL', -(EDGE + 260));
      if (i % 9 === 4) put('lampR', EDGE + 260);
      if (i % 13 === 7 && r < 0.85) put('neon', side * (ROAD_HALF * 1.55 + hash01(i, 3) * 900), hash(i, 9) % 8);
      if (i % 11 === 5 && r > 0.25) put('building', -side * (ROAD_HALF * 2.6 + hash01(i, 4) * 2200), hash(i, 8) % 4);
      break;
    case 'rain':
      if (i % 9 === 0) put('lampL', -(EDGE + 260));
      if (i % 9 === 4) put('lampR', EDGE + 260);
      if (i % 4 === 2) put('post', side * (EDGE + 150));
      if (i % 19 === 9 && r < 0.6) put('neon', side * (ROAD_HALF * 1.7 + hash01(i, 3) * 800), hash(i, 9) % 8);
      break;
    case 'coast':
      if (i % 7 === 0) put('palmC', -(ROAD_HALF * 1.3 + r * 500), 0);
      if (i % 7 === 4 && r < 0.4) put('palmC', ROAD_HALF * 1.35 + r * 300, 0);
      if (i % 9 === 3 && hash01(i, 6) < 0.7) put('umbrella', -(ROAD_HALF * 1.7 + hash01(i, 2) * 1600));
      if (i % 61 === 30) put('tower', -(ROAD_HALF * 2.1 + r * 700));
      if (i % 4 === 2) put('post', EDGE + 150);
      break;
    default: break;
  }
  return n;
}
export const decorBuffer = () => Array.from({ length: MAX_DECOR }, () => ({ kind: '', x: 0, v: 0 }));
