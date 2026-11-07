// ROBOTAXI RUSH: the camera. Pure (no DOM).
//
// A pinhole camera behind the robotaxi, with its focal lengths set by the screen's shape rather than a fixed angle: the
// road at the robotaxi is roadFrac screens wide (wider than a tall phone, a little wider than a wide screen), the
// horizon and the robotaxi sit at fixed heights. Sideways and up-down use their own focal lengths (fx, fy), so a tall
// phone gets a taller view of the road ahead instead of a thin strip of it, and a wide screen a flatter, faster one.
import { ROAD_HALF, CAM_H, CAM_BACK, NEAR, clamp, lerp } from './config.js';

export function layoutView(W, H, { top = 0, bottom = 0 } = {}) {
  const playH = Math.max(1, H - top - bottom);
  const aspect = W / playH;
  const t = clamp((aspect - 0.55) / (1.75 - 0.55), 0, 1);     // 0: a tall phone … 1: a wide screen
  const horizon = top + playH * lerp(0.36, 0.43, t);
  const carY = top + playH * lerp(0.835, 0.875, t);
  const roadFrac = lerp(1.6, 1.08, t);                         // the road's width at the robotaxi, in screens
  const follow = lerp(0.8, 0.58, t);                           // how much the camera follows it sideways
  const fx = ((roadFrac * W) / (2 * ROAD_HALF)) * CAM_BACK;
  const fy = ((carY - horizon) * CAM_BACK) / CAM_H;
  return { w: W, h: H, cx: W / 2, top, horizon, carY, fx, fy, follow, camBack: CAM_BACK, roadFrac, t };
}

// the same view with the camera pulled in by `k` (< 1) and its focal lengths with it: the robotaxi stays the same size
// and in the same place while the road ahead stretches away (the boost's "dolly zoom")
export function zoomView(base, k, out = {}) {
  Object.assign(out, base);
  out.fx = base.fx * k;
  out.fy = base.fy * k;
  out.camBack = base.camBack * k;
  return out;
}

// a point relative to the camera (X right, Y up, Z ahead, world units) → the screen: out.x, out.y (CSS px) and out.s
// (CSS px per world unit sideways at that distance)
export function project(v, X, Y, Z, out = {}) {
  const s = 1 / Math.max(NEAR, Z);
  out.x = v.cx + v.fx * X * s;
  out.y = v.horizon - v.fy * Y * s;
  out.s = v.fx * s;
  return out;
}
