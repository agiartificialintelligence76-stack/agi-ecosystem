// HALLUCINATION (2026-11-08): the demo's player (`?demo`): it looks around like a person (a glance somewhere else first,
// a little wobble), taps each hallucination at a human pace, and gets one wrong per scene. Pure: a scene and a seeded
// dice in, a list of timed taps out (page units, which picture).
import { boxOf } from './objects.js';
import { distToRect } from './scene.js';

const center = (b) => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];

// a spot that is NOT a difference: the middle of something that didn't change, well away from every change
export function decoySpot(sc, r, away = 34) {
  const far = (x, y) => sc.diffs.every((d) => distToRect(x, y, d.region) > away);
  const things = r.shuffle(sc.a.slice());
  for (const o of things) {
    const [x, y] = center(boxOf(o));
    if (x > 12 && x < 388 && y > 12 && y < 288 && far(x, y)) return [x, y];
  }
  for (let i = 0; i < 40; i++) { const x = r.range(30, 370), y = r.range(30, 270); if (far(x, y)) return [x, y]; }
  return [200, 150];
}

// the taps: `times` (seconds on the demo's clock) for the finds still to make, or a pace from `start`
export function planDemo(sc, r, { found = [], start = 0, pace = 1.1, times = null, wrongBefore = 1 } = {}) {
  const open = sc.diffs.filter((d) => !found.includes(d.i));
  // roughly left to right, the way eyes sweep a picture, with a little shuffle
  open.sort((a, b) => (a.region[0] + a.region[2]) - (b.region[0] + b.region[2]) + r.range(-60, 60));
  const acts = [];
  let t = start;
  open.forEach((d, j) => {
    t = times ? times[j] : t + pace + r.range(-0.12, 0.18);
    const [cx, cy] = center(d.region);
    const jx = Math.min(8, (d.region[2] - d.region[0]) * 0.25), jy = Math.min(8, (d.region[3] - d.region[1]) * 0.25);
    acts.push({ at: t, x: cx + r.range(-jx, jx), y: cy + r.range(-jy, jy), pic: r.chance(0.7) ? 1 : 0, i: d.i, look: decoySpot(sc, r, 20) });
  });
  if (acts.length > 1 && wrongBefore != null) {
    const k = Math.min(acts.length - 1, Math.max(1, wrongBefore));
    const prev = acts[k - 1].at, next = acts[k].at;
    const [x, y] = decoySpot(sc, r, 40);
    acts.splice(k, 0, { at: prev + (next - prev) * 0.48, x, y, pic: r.chance(0.5) ? 1 : 0, i: -1, look: null });
  }
  return acts;
}
// the first scene of a recorded preview: its taps at fixed moments of the page's clock (the recorder films 5.7 … 11.7 s)
export const PREVIEW_TIMES = Object.freeze([6.0, 7.1, 8.2, 9.25]);
