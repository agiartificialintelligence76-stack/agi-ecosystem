// AGI-1 in 2D: her arms, turned in code on top of her Live2D model (2026-10-01, the owner: "why dont the 2d model wave
// anymore … she moves like a stick"). Her model is drawn in an A-pose and its own arm parameters (ParamArmRA / ParamArmLA)
// only swing each arm about 7°, so her wave and her relaxed arms are made here: after Live2D has worked out where her
// pieces are, each arm turns at the shoulder, the elbow and the wrist, like a real arm.
//  • her joints are found on her model when she loads (where her upper arm, forearm and hand overlap), and each frame they
//    follow her pieces wherever her model has moved them (her body's lean, her breathing, the model's own arm swing);
//  • a point near a joint turns around that joint by part of the joint's angle (its weight), so it keeps its distance from
//    the joint: her elbow stays round on the outside instead of pinching, and the bend is short, never a rubbery noodle;
//  • her sleeve folds with her shoulder: its top stays on her shirt, its opening goes with her arm;
//  • her hand goes with her forearm, and her wrist adds a little turn of its own.
// Pure maths on her model's vertex arrays (no three.js, no browser), so tests can check it with Live2D's real runtime.

const RAD = Math.PI / 180;
const smooth = (e0, e1, x) => {
  let t = (x - e0) / (e1 - e0);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return t * t * (3 - 2 * t);
};

// Her pieces, per arm: 'R' is her right arm (on the left of the picture, x < 0), 'L' her left
export const ARM_PIECES = {
  R: { upper: 'upper_arm_R', fore: 'forearm_R', hand: 'hand_R', sleeve: 'sleeve_R' },
  L: { upper: 'upper_arm_L', fore: 'forearm_L', hand: 'hand_L', sleeve: 'sleeve_L' },
};

// How each piece follows the joints (model units, along the arm, measured from each joint): where a weight starts and
// ends. Tuned on her model at the poses she uses (her wave, its close-up version, her cheer, her dance, her arms down by
// her sides), looked at up close.
export const BLEND = {
  sleeve: [-0.05, 0.075],       // her sleeve: from just above her shoulder joint (stays) to its opening (goes with her arm)
  elbowUpper: [0.0, 0.035],     // the end of her upper arm, past the elbow: turns halfway with her forearm
  elbowUpperShare: 0.5,
  elbowFore: [-0.03, 0.03],     // the top of her forearm: from behind the elbow (stays) to past it (turns fully)
  wristFore: [-0.02, 0.02],
  wristHand: [-0.03, 0.03],
};

// ---------- the pieces' shapes at rest ----------
function axisOf(p) {
  const n = p.length / 2;
  let cx = 0, cy = 0;
  for (let k = 0; k < p.length; k += 2) { cx += p[k]; cy += p[k + 1]; }
  cx /= n; cy /= n;
  let xx = 0, xy = 0, yy = 0;
  for (let k = 0; k < p.length; k += 2) { const dx = p[k] - cx, dy = p[k + 1] - cy; xx += dx * dx; xy += dx * dy; yy += dy * dy; }
  const th = 0.5 * Math.atan2(2 * xy, xx - yy);
  let ux = Math.cos(th), uy = Math.sin(th);
  if (uy > 0) { ux = -ux; uy = -uy; }             // pointing down her arm
  let t0 = Infinity, t1 = -Infinity;
  for (let k = 0; k < p.length; k += 2) { const t = (p[k] - cx) * ux + (p[k + 1] - cy) * uy; if (t < t0) t0 = t; if (t > t1) t1 = t; }
  return { c: [cx, cy], u: [ux, uy], top: [cx + ux * t0, cy + uy * t0], bot: [cx + ux * t1, cy + uy * t1], len: t1 - t0 };
}

// A point that follows a piece: its affine coordinates in the piece's triangle nearest to it (exact while that triangle
// moves without bending, which a triangle does)
function anchor(p, idx, x, y) {
  let best = null, bestD = Infinity;
  for (let k = 0; k < idx.length; k += 3) {
    const a = idx[k] * 2, b = idx[k + 1] * 2, c = idx[k + 2] * 2;
    const x1 = p[a], y1 = p[a + 1], x2 = p[b], y2 = p[b + 1], x3 = p[c], y3 = p[c + 1];
    const det = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3);
    if (Math.abs(det) < 1e-9) continue;
    const l1 = ((y2 - y3) * (x - x3) + (x3 - x2) * (y - y3)) / det;
    const l2 = ((y3 - y1) * (x - x3) + (x1 - x3) * (y - y3)) / det;
    const l3 = 1 - l1 - l2;
    const out = Math.max(0, -l1) + Math.max(0, -l2) + Math.max(0, -l3);   // 0 inside
    const d = out + 1e-6 * Math.hypot((x1 + x2 + x3) / 3 - x, (y1 + y2 + y3) / 3 - y);
    if (d < bestD) { bestD = d; best = [a, b, c, l1, l2, l3]; }
  }
  return best;
}
const at = (p, [a, b, c, l1, l2, l3], out) => {
  out[0] = p[a] * l1 + p[b] * l2 + p[c] * l3;
  out[1] = p[a + 1] * l1 + p[b + 1] * l2 + p[c + 1] * l3;
  return out;
};

// ---------- one arm ----------
// `rest(i)`: drawable i's vertex positions at rest; `indices(i)`: its triangles; `find(name)`: a piece's index (-1 if none).
// Returns null if her model doesn't have the pieces (then her arms simply aren't turned).
export function measureArm({ rest, indices, find }, side) {
  const names = ARM_PIECES[side];
  const i = { upper: find(names.upper), fore: find(names.fore), hand: find(names.hand), sleeve: find(names.sleeve) };
  if (i.upper < 0 || i.fore < 0 || i.hand < 0) return null;
  const up = axisOf(rest(i.upper)), fo = axisOf(rest(i.fore)), ha = axisOf(rest(i.hand));
  // her joints: the shoulder just inside the top of her upper arm (under her sleeve), the elbow and the wrist where the
  // pieces overlap
  const S = [up.top[0] + up.u[0] * 0.05 * up.len, up.top[1] + up.u[1] * 0.05 * up.len];
  const E = [(up.bot[0] + fo.top[0]) / 2, (up.bot[1] + fo.top[1]) / 2];
  const W = [(fo.bot[0] + ha.top[0]) / 2, (fo.bot[1] + ha.top[1]) / 2];
  const tip = ha.bot.slice();
  const uS = norm(E[0] - S[0], E[1] - S[1]), uE = norm(W[0] - E[0], W[1] - E[1]), uW = norm(tip[0] - W[0], tip[1] - W[1]);
  // weights per vertex, from her rest pose: [shoulder, elbow, wrist], each 0..1
  const along = (p, k, J, u) => (p[k] - J[0]) * u[0] + (p[k + 1] - J[1]) * u[1];
  const weights = {};
  const B = BLEND;
  const make = (piece, fn) => {
    if (piece < 0) return;
    const p = rest(piece), n = p.length / 2, w = new Float32Array(n * 3);
    for (let v = 0; v < n; v++) fn(p, v * 2, w, v * 3);
    weights[piece] = w;
  };
  make(i.sleeve, (p, k, w, o) => { w[o] = smooth(B.sleeve[0], B.sleeve[1], along(p, k, S, uS)); });
  make(i.upper, (p, k, w, o) => { w[o] = 1; w[o + 1] = B.elbowUpperShare * smooth(B.elbowUpper[0], B.elbowUpper[1], along(p, k, E, uS)); });
  make(i.fore, (p, k, w, o) => {
    w[o] = 1;
    w[o + 1] = smooth(B.elbowFore[0], B.elbowFore[1], along(p, k, E, uE));
    w[o + 2] = smooth(B.wristFore[0], B.wristFore[1], along(p, k, W, uE)) * 0.5;
  });
  make(i.hand, (p, k, w, o) => { w[o] = 1; w[o + 1] = 1; w[o + 2] = smooth(B.wristHand[0], B.wristHand[1], along(p, k, W, uW)); });
  // her joints follow her pieces: the shoulder and the elbow her upper arm, the wrist her forearm, her fingertips her hand
  const anchors = {
    S: anchor(rest(i.upper), indices(i.upper), S[0], S[1]),
    E: anchor(rest(i.upper), indices(i.upper), E[0], E[1]),
    W: anchor(rest(i.fore), indices(i.fore), W[0], W[1]),
    T: anchor(rest(i.hand), indices(i.hand), tip[0], tip[1]),
  };
  return {
    side, sign: side === 'R' ? -1 : 1, pieces: i, weights, anchors,
    // where her joints are this frame, once turned (bendArm writes them): for framing her live views on a raised hand
    now: { S: S.slice(), E: E.slice(), W: W.slice(), tip: tip.slice() },
    rest: { S, E, W, tip, upper: up.len, fore: Math.hypot(W[0] - E[0], W[1] - E[1]), hand: Math.hypot(tip[0] - W[0], tip[1] - W[1]) },
    // which way each bone points at rest, in degrees from straight down (positive = away from her body)
    down: { upper: outFromDown(uS, side), fore: outFromDown(uE, side), hand: outFromDown(uW, side) },
  };
}
function norm(x, y) { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; }
function outFromDown(u, side) { return (Math.atan2(u[0], -u[1]) / RAD) * (side === 'R' ? -1 : 1); }

// ---------- turning an arm ----------
// `pose`: { shoulder, elbow, wrist } in degrees. shoulder > 0 lifts her arm away from her body (out, then up), < 0 brings
// it in to her side; elbow > 0 turns her forearm up and out (her wave), < 0 in; wrist > 0 turns her hand out.
// `src(i)`: piece i's vertex positions this frame (from Live2D); `dst(i)`: where to write the turned ones (may be src).
const tmpS = [0, 0], tmpE = [0, 0], tmpW = [0, 0], tmpT = [0, 0];
export function bendArm(arm, pose, src, dst) {
  if (!arm) return;
  const s = arm.sign * (pose.shoulder || 0) * RAD, e = arm.sign * (pose.elbow || 0) * RAD, wr = arm.sign * (pose.wrist || 0) * RAD;
  const { upper, fore, hand } = arm.pieces;
  const S = at(src(upper), arm.anchors.S, tmpS), E = at(src(upper), arm.anchors.E, tmpE), W = at(src(fore), arm.anchors.W, tmpW);
  const T = at(src(hand), arm.anchors.T, tmpT);
  // where her elbow, wrist and fingertips go: E1 = S + R(s)(E − S); W2 = E1 + R(s + e)(W − E); T3 = W2 + R(s + e + wr)(T − W)
  const cs = Math.cos(s), ss = Math.sin(s);
  const E1x = S[0] + cs * (E[0] - S[0]) - ss * (E[1] - S[1]), E1y = S[1] + ss * (E[0] - S[0]) + cs * (E[1] - S[1]);
  const cse = Math.cos(s + e), sse = Math.sin(s + e);
  const W2x = E1x + cse * (W[0] - E[0]) - sse * (W[1] - E[1]), W2y = E1y + sse * (W[0] - E[0]) + cse * (W[1] - E[1]);
  const csw = Math.cos(s + e + wr), ssw = Math.sin(s + e + wr);
  const now = arm.now;
  now.S[0] = S[0]; now.S[1] = S[1]; now.E[0] = E1x; now.E[1] = E1y; now.W[0] = W2x; now.W[1] = W2y;
  now.tip[0] = W2x + csw * (T[0] - W[0]) - ssw * (T[1] - W[1]); now.tip[1] = W2y + ssw * (T[0] - W[0]) + csw * (T[1] - W[1]);
  const Sx = S[0], Sy = S[1];
  for (const key in arm.weights) {
    const piece = +key, w = arm.weights[key], p = src(piece), q = dst(piece);
    for (let v = 0, n = p.length / 2; v < n; v++) {
      const ws = w[v * 3], we = w[v * 3 + 1], ww = w[v * 3 + 2];
      let x = p[v * 2], y = p[v * 2 + 1];
      // the shoulder (her sleeve partly): around her shoulder joint
      if (ws) { const a = ws * s, c = Math.cos(a), sn = Math.sin(a), dx = x - Sx, dy = y - Sy; x = Sx + c * dx - sn * dy; y = Sy + sn * dx + c * dy; }
      // the elbow: around where her elbow went
      if (we) { const a = we * e, c = Math.cos(a), sn = Math.sin(a), dx = x - E1x, dy = y - E1y; x = E1x + c * dx - sn * dy; y = E1y + sn * dx + c * dy; }
      // the wrist: around where her wrist went
      if (ww) { const a = ww * wr, c = Math.cos(a), sn = Math.sin(a), dx = x - W2x, dy = y - W2y; x = W2x + c * dx - sn * dy; y = W2y + sn * dx + c * dy; }
      q[v * 2] = x; q[v * 2 + 1] = y;
    }
  }
}
