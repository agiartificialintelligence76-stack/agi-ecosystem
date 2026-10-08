// AGI-1 in 2D: her arms, turned in code on top of her Live2D model (2026-10-01, the owner: "why dont the 2d model wave
// anymore … she moves like a stick"). Her model is drawn in an A-pose and its own arm parameters (ParamArmRA / ParamArmLA)
// only swing each arm about 7°, so her wave and her relaxed arms are made here: after Live2D has worked out where her
// pieces are, each arm turns at the shoulder, the elbow and the wrist, like a real arm.
//  • her joints are found on her model when she loads (where her upper arm, forearm and hand overlap), and each frame they
//    follow her pieces wherever her model has moved them (her body's lean, her breathing, the model's own arm swing);
//  • her sleeve folds with her shoulder: its top stays on her shirt, its opening goes with her arm, and the top of her upper
//    arm under it moves exactly like it (2026-10-03);
//  • her elbow turns her forearm round her elbow joint, the way her artist drew her arm in two pieces: the top of her
//    forearm, soft at its end, covers the end of her upper arm, and both turn bit by bit along the arm, so her elbow keeps
//    its own shape (2026-10-03: drawn finer, so its outside is a smooth curve instead of flat cuts, and the end of her
//    upper arm turns fully with her forearm so it never pokes out below her elbow);
//  • her hand goes with her forearm, and her wrist adds a little turn of its own.
// Her arms are drawn with finer meshes than her model's own (src/stage/live2d.js refineMesh), so her bends are smooth; her
// model's own vertices are turned the same way too (for taps and her markers).
// (2026-10-08, her live show; the owner: "her arms doesnt even move naturally … when she holds things she doesnt even look
// shes holding it") Her hand is one drawing: an open palm facing us, fingers straight. Raised, both hands became "jazz
// hands", and nothing she held ever touched her fingers. So, on her show only, each arm can also (2.5D, from that one
// drawing): foreshorten her forearm as it comes toward us (`fore`), turn her hand about its own length (`twist`: a hand
// turned is narrower, and past 90° the other way round, its thumb on the other side, as the back of a hand is), and curl her
// fingers (`curl`: shorter, closer together, her thumb in over her palm, as fingers folding toward us look). handPoint()
// gives a point on her hand where it is now (her palm, her thumb…), for what she holds. Without them (the website), her
// arms are turned exactly as before.
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

// How far her drawing lets her arms go (2026-10-01, the owner's screenshot of her dance: "what is this lol"). Her shirt
// is drawn for arms held down: the inside of each sleeve is part of her shirt's own drawing, under the arm, and stays
// where it's drawn. Lifted much past her model's pose, an arm leaves it behind, and it shows under the raised sleeve like
// a torn flap (her dance lifted both arms 64°, straight out like a scarecrow). So each upper arm lifts at most 16° above
// her model's pose (degrees; clean at every angle up to 20, checked up close on both sides), easing into that limit
// instead of stopping, and her hands go up by bending her elbows: by her face for her wave and her cheer.
export const REACH = { shoulder: 16 };
const KNEE = 5;                                   // the last 5° before the limit ease into it
export function shoulderLimit(deg) {
  const from = REACH.shoulder - KNEE;
  return deg > from ? from + KNEE * Math.tanh((deg - from) / KNEE) : deg;
}

// How each piece follows the joints (model units, along the arm, measured from each joint): where a weight starts and
// ends. Tuned on her model at the poses she uses (her wave, its close-up version, her cheer, her dance, her arms down by
// her sides), looked at up close.
export const BLEND = {
  // her sleeve, and the top of her upper arm under it: from just above her shoulder joint (stays) to the sleeve's opening
  // (goes with her arm). The same for both (2026-10-03, the owner's close-up: her upper arm turned in full while her
  // sleeve's top stayed, and showed in a slit beside her chest when her arms relaxed by her sides)
  sleeve: [-0.05, 0.075],
  // her elbow: the end of her upper arm, from just before her elbow joint (stays) to its end (turns fully with her forearm;
  // until 2026-10-03 it turned only halfway, and poked out below her elbow as a little flap with its own outline), and
  // the top of her forearm, from behind the joint (stays) to past it (turns fully)
  elbowUpper: [-0.02, 0.035],
  elbowFore: [-0.03, 0.03],
  wristFore: [-0.02, 0.02],
  wristHand: [-0.03, 0.03],
};
// (2026-10-03, for one night her elbow bent like a tube round a point inside the bend instead: round and smooth, but the
// owner: "what is this lol, before was better its just the elbow thats the problem". Her elbow keeps her artist's shape.)

// Her hand's own frame (2026-10-08): a point on her hand is (along, across), in hand lengths: along from her wrist joint
// (0) to her fingertips (1), across from that line (positive on her little finger's side, negative on her thumb's).
// Measured on her drawing (both hands alike): her knuckles at about 0.56 along (her fingers part there), her thumb out on
// its side (across -0.2 to -0.48, along 0.25 to 0.56, its tip at about 0.52, -0.45), her palm's middle at about 0.33, 0.04.
export const HAND = {
  knuckles: 0.56,
  thumb: -0.18,                                   // her thumb: across, from here out (and before her knuckles)
  // curling: her fingers fold about her knuckles (at 1, `fold` of the way over: 0.5 is toward us, 1 flat back over her
  // palm), this much closer together; her thumb turns in over them about its base, at most this far (degrees)
  curl: { fold: 0.62, together: 0.34, thumb: 70, thumbBase: [0.26, -0.16] },
  // the narrowest a hand turned side on looks (a hand is about a fifth as thick as it is wide)
  edge: 0.2,
  at: { palm: [0.33, 0.04], thumb: [0.52, -0.45], knuckles: [0.58, -0.02], fingers: [0.8, -0.02], grip: [0.6, 0.02] },
};
// her forearm, turned with her hand (a forearm seen turned is a little narrower toward the wrist): at most this much
const FORE_TURN = 0.28;
// (2026-10-08, her live show) how far her elbow bends (degrees, 0 straight) before it turns as a hinge (pose.fold): from,
// all of it by
export const RIGID = [115, 160];

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
// `like`: the same arm measured on her model's own vertices, when these are finer ones (src/stage/live2d.js refineMesh):
// its joints are used as they are, so both turn exactly alike. Returns null if her model doesn't have the pieces (then her
// arms simply aren't turned).
export function measureArm({ rest, indices, find }, side, like = null) {
  const names = ARM_PIECES[side];
  const i = { upper: find(names.upper), fore: find(names.fore), hand: find(names.hand), sleeve: find(names.sleeve) };
  if (i.upper < 0 || i.fore < 0 || i.hand < 0) return null;
  let S, E, W, tip, upperLen;
  if (like) ({ S, E, W, tip, upper: upperLen } = like.rest);
  else {
    const up = axisOf(rest(i.upper)), fo = axisOf(rest(i.fore)), ha = axisOf(rest(i.hand));
    // her joints: the shoulder just inside the top of her upper arm (under her sleeve), the elbow and the wrist where the
    // pieces overlap
    S = [up.top[0] + up.u[0] * 0.05 * up.len, up.top[1] + up.u[1] * 0.05 * up.len];
    E = [(up.bot[0] + fo.top[0]) / 2, (up.bot[1] + fo.top[1]) / 2];
    W = [(fo.bot[0] + ha.top[0]) / 2, (fo.bot[1] + ha.top[1]) / 2];
    tip = ha.bot.slice();
    upperLen = up.len;
  }
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
  const shoulder = (p, k) => smooth(B.sleeve[0], B.sleeve[1], along(p, k, S, uS));
  make(i.sleeve, (p, k, w, o) => { w[o] = shoulder(p, k); });
  make(i.upper, (p, k, w, o) => { w[o] = shoulder(p, k); w[o + 1] = smooth(B.elbowUpper[0], B.elbowUpper[1], along(p, k, E, uS)); });
  make(i.fore, (p, k, w, o) => {
    w[o] = 1;
    w[o + 1] = smooth(B.elbowFore[0], B.elbowFore[1], along(p, k, E, uE));
    w[o + 2] = smooth(B.wristFore[0], B.wristFore[1], along(p, k, W, uE)) * 0.5;
  });
  make(i.hand, (p, k, w, o) => { w[o] = 1; w[o + 1] = 1; w[o + 2] = smooth(B.wristHand[0], B.wristHand[1], along(p, k, W, uW)); });
  // (2026-10-08) where each vertex of her hand and her forearm is in its own frame at rest (HAND: along, across, in that
  // piece's lengths), for turning her hand and curling her fingers, and foreshortening her forearm
  const inward = side === 'R' ? 1 : -1;
  const handLen = Math.hypot(tip[0] - W[0], tip[1] - W[1]), foreLen = Math.hypot(W[0] - E[0], W[1] - E[1]);
  const frame = (piece, J, u, len) => {
    const p = rest(piece), n = p.length / 2, out = new Float32Array(n * 2), nx = -u[1] * inward, ny = u[0] * inward;
    for (let v = 0; v < n; v++) {
      const dx = p[v * 2] - J[0], dy = p[v * 2 + 1] - J[1];
      out[v * 2] = (dx * u[0] + dy * u[1]) / len;
      out[v * 2 + 1] = (dx * nx + dy * ny) / len;
    }
    return out;
  };
  const local = { [i.hand]: frame(i.hand, W, uW, handLen), [i.fore]: frame(i.fore, E, uE, foreLen), [i.upper]: frame(i.upper, S, uS, upperLen) };
  if (i.sleeve >= 0) local[i.sleeve] = frame(i.sleeve, S, uS, upperLen);
  // her joints follow her pieces: the shoulder and the elbow her upper arm, the wrist her forearm, her fingertips her hand
  const anchors = {
    S: anchor(rest(i.upper), indices(i.upper), S[0], S[1]),
    E: anchor(rest(i.upper), indices(i.upper), E[0], E[1]),
    W: anchor(rest(i.fore), indices(i.fore), W[0], W[1]),
    T: anchor(rest(i.hand), indices(i.hand), tip[0], tip[1]),
  };
  return {
    side, sign: side === 'R' ? -1 : 1, inward, pieces: i, weights, anchors, local,
    // where her joints are this frame, once turned (bendArm writes them): for framing her live views on a raised hand.
    // hand: her hand's frame now (her wrist, her hand's length along it and across it, how it's turned and curled), for
    // handPoint()
    now: { S: S.slice(), E: E.slice(), W: W.slice(), tip: tip.slice(), hand: { o: W.slice(), u: [tip[0] - W[0], tip[1] - W[1]], n: [-(tip[1] - W[1]) * inward, (tip[0] - W[0]) * inward], turn: 1, curl: 0 },
      base: { S: S.slice(), up: [E[0] - S[0], E[1] - S[1]], fo: [W[0] - E[0], W[1] - E[1]], ha: [tip[0] - W[0], tip[1] - W[1]] } },
    rest: { S, E, W, tip, upper: upperLen, fore: foreLen, hand: handLen },
    // which way each bone points at rest, in degrees from straight down (positive = away from her body)
    down: { upper: outFromDown(uS, side), fore: outFromDown(uE, side), hand: outFromDown(uW, side) },
  };
}
function norm(x, y) { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; }
function outFromDown(u, side) { return (Math.atan2(u[0], -u[1]) / RAD) * (side === 'R' ? -1 : 1); }

// ---------- turning an arm ----------
// `pose`: { shoulder, elbow, wrist } in degrees. shoulder > 0 lifts her arm away from her body (out, then up; at most
// REACH.shoulder), < 0 brings it in to her side; elbow > 0 turns her forearm up and out (her wave), < 0 in (across her
// body); wrist > 0 turns her hand out. (2026-10-08, her live show) and if given: upper and fore (her upper arm's and her
// forearm's length as seen: 1 as drawn, less as it comes toward us), twist (degrees: her hand turned about its length; 0 her palm to us as drawn, 90 side
// on, 180 the other way round) and curl (0 her fingers straight as drawn, 1 folded; at most curlMax: on her live show her
// drawn fingers only curl a little, her hand open or round something she holds).
// `src(i)`: piece i's vertex positions this frame (from Live2D); `dst(i)`: where to write the turned ones (may be src).
const tmpS = [0, 0], tmpE = [0, 0], tmpW = [0, 0], tmpT = [0, 0];
// her fingers curling and her thumb coming in (HAND), in her hand's own frame: (along, across) → (along, across). Her
// fingers fold about her knuckles: shorter as they come toward us, then back over her palm (all the way, a fist: her live
// show stops well before, CURL_MAX in src/stage/agi1-2d.js); her thumb turns in over them.
function curled(a, b, c, out) {
  let a2 = a, b2 = b;
  if (c > 0) {
    const K = HAND.knuckles, C = HAND.curl;
    if (a > K) a2 = K + (a - K) * Math.cos(Math.PI * C.fold * c);
    b2 = b * (1 - C.together * c * smooth(K - 0.05, K + 0.1, a));
    const th = (1 - smooth(0.5, 0.62, a)) * smooth(-0.1, -0.2, b);
    if (th > 0) {
      const r = ((C.thumb * Math.PI) / 180) * c * th, [ba, bb] = C.thumbBase, da = a2 - ba, db = b2 - bb;
      const cr = Math.cos(r), sr = Math.sin(r);
      a2 = ba + da * cr - db * sr;
      b2 = bb + da * sr + db * cr;
    }
  }
  out[0] = a2; out[1] = b2;
  return out;
}
// how wide her hand looks turned by `twist` (radians): cos, but never thinner than its edge, the other way round past 90°
export function handTurn(twist) {
  const c = Math.cos(twist);
  return (c < 0 ? -1 : 1) * (HAND.edge + (1 - HAND.edge) * Math.abs(c));
}
const tmpC = [0, 0];
// a point on her hand where it is now (bendArm's last turn): along and across in her hand's own frame (HAND.at has a few)
export function handPoint(arm, a, b, out = [0, 0]) {
  const h = arm.now.hand;
  curled(a, b, h.curl, tmpC);
  const b2 = tmpC[1] * h.turn;
  out[0] = h.o[0] + h.u[0] * tmpC[0] + h.n[0] * b2;
  out[1] = h.o[1] + h.u[1] * tmpC[0] + h.n[1] * b2;
  return out;
}
// (2026-10-08, her live show) her arm reaching: a point of her hand (a along it, b across, HAND's frame) to (x, y) (model
// units, as bendArm's: without her hips' shift), her hand pointing `deg` (degrees, 90 up, from her wrist to her fingertips),
// turned and curled as given → { shoulder, upper, elbow, wrist, fore } for bendArm. Worked out on her arm as her model has
// it this frame (bendArm's last), so a hand by her mouth stays there as she moves. As a real arm does: her elbow comes
// forward (her upper arm seen shorter: `upper`) when her hand goes up to her face, her forearm comes toward us (`fore`),
// her shoulder stays near `shoulder`, her wrist bends little, and her forearm never sticks out flat from her elbow pulled
// in (the "paddle" rule, tests/stream.test.js). Her elbow and her wrist the nearest turns to `hint` ({ elbow, wrist }:
// where she is now), so a pose never flips round between frames.
const wrapDeg = (d) => d - 360 * Math.round(d / 360);
const UPPERS = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.42, 0.34, 0.26];
// bend: 'in' her forearm comes up across her body (her hand to her face, her chest's side: elbow −225° to 45°), 'out' up
// and out to her side (her wave: −45° to 225°), unless her elbow (`hint`) is already near the pose the other way round;
// else the nearest to `hint`.
export function reach(arm, x, y, deg, { a = 0.4, b = 0, twist = 0, curl = 0, shoulder = -10, prefer = 0.92, hint = null, spread = 32, bend = null } = {}) {
  const base = arm.now.base, sign = arm.sign, inw = arm.inward || (sign < 0 ? 1 : -1);
  const Lh = Math.hypot(base.ha[0], base.ha[1]), Lf = Math.hypot(base.fo[0], base.fo[1]) || 1e-9;
  const ux = Math.cos(deg * RAD) * Lh, uy = Math.sin(deg * RAD) * Lh, nx = -uy * inw, ny = ux * inw;
  curled(a, b, Math.max(0, Math.min(1, curl)), tmpC);
  const turn = handTurn(twist * RAD);
  const wx = x - ux * tmpC[0] - nx * tmpC[1] * turn, wy = y - uy * tmpC[0] - ny * tmpC[1] * turn;
  const aFo = Math.atan2(base.fo[1], base.fo[0]), aHa = Math.atan2(base.ha[1], base.ha[0]), aU = deg * RAD;
  let best = null;
  for (let k = -spread; k <= spread; k += 4) {
    const sh = Math.max(-70, Math.min(REACH.shoulder, shoulder + k));
    const sr = sign * shoulderLimit(sh) * RAD, c = Math.cos(sr), sn = Math.sin(sr);
    const rx = c * base.up[0] - sn * base.up[1], ry = sn * base.up[0] + c * base.up[1];
    for (const up of UPPERS) {
      const ex = base.S[0] + rx * up, ey = base.S[1] + ry * up;
      const dx = wx - ex, dy = wy - ey, f = Math.hypot(dx, dy) / Lf;
      let el = wrapDeg((Math.atan2(dy, dx) - aFo - sr) / RAD / sign);
      const near = hint ? hint.elbow + wrapDeg(el - hint.elbow) : el;
      if (bend === 'in') { if (el >= 45) el -= 360; } else if (bend === 'out') { if (el <= -45) el += 360; } else el = near;
      // (a bend says which way round her forearm comes up from her side; once it's up there, the nearest way: never a
      // whole turn of her forearm for the same pose written the other way round)
      if (hint && bend && Math.abs(near - hint.elbow) < 100) el = near;
      const wr = wrapDeg((aU - aHa - sr - sign * el * RAD) / RAD / sign);
      const ew = wrapDeg(el), paddle = sh < -20 && ew > 45 && ew < 140 ? 1 : 0;
      const score = Math.abs(f - prefer) + 0.3 * (1 - up) + 0.004 * Math.abs(sh - shoulder) + 10 * Math.max(0, f - 1.04)
        + 4 * Math.max(0, 0.55 - f) + 0.006 * Math.max(0, Math.abs(wr) - 40) + 5 * paddle;
      if (!best || score < best.score) best = { score, shoulder: sh, upper: up, elbow: el, wrist: wr, fore: Math.max(0.45, Math.min(1.05, f)) };
    }
  }
  return { shoulder: best.shoulder, upper: best.upper, elbow: best.elbow, wrist: best.wrist, fore: best.fore };
}
export function bendArm(arm, pose, src, dst) {
  if (!arm) return;
  const s = arm.sign * shoulderLimit(pose.shoulder || 0) * RAD, e = arm.sign * (pose.elbow || 0) * RAD, wr = arm.sign * (pose.wrist || 0) * RAD;
  const fo = pose.fore ?? 1, up = pose.upper ?? 1, tw = (pose.twist || 0) * RAD, cu = Math.max(0, Math.min(pose.curlMax ?? 1, pose.curl || 0));
  const extra = fo !== 1 || up !== 1 || tw !== 0 || cu !== 0;
  const { upper, fore, hand, sleeve } = arm.pieces;
  const S = at(src(upper), arm.anchors.S, tmpS), E = at(src(upper), arm.anchors.E, tmpE), W = at(src(fore), arm.anchors.W, tmpW);
  const T = at(src(hand), arm.anchors.T, tmpT);
  // where her elbow, wrist and fingertips go: E1 = S + R(s)(E − S); W2 = E1 + R(s + e)(W − E); T3 = W2 + R(s + e + wr)(T − W)
  const cs = Math.cos(s), ss = Math.sin(s), ce = Math.cos(e), se = Math.sin(e), cw = Math.cos(wr), sw = Math.sin(wr);
  const Sx = S[0], Sy = S[1];
  const E1x = Sx + cs * (E[0] - Sx) - ss * (E[1] - Sy), E1y = Sy + ss * (E[0] - Sx) + cs * (E[1] - Sy);
  const cse = Math.cos(s + e), sse = Math.sin(s + e);
  const W2x = E1x + cse * (W[0] - E[0]) - sse * (W[1] - E[1]), W2y = E1y + sse * (W[0] - E[0]) + cse * (W[1] - E[1]);
  const csw = Math.cos(s + e + wr), ssw = Math.sin(s + e + wr);
  const T3x = W2x + csw * (T[0] - W[0]) - ssw * (T[1] - W[1]), T3y = W2y + ssw * (T[0] - W[0]) + csw * (T[1] - W[1]);
  // (2026-10-08) her upper arm and her forearm foreshortened: her elbow moves in toward her shoulder, her wrist toward her
  // elbow, her hand with it; her hand's frame after them
  const dEx = (up - 1) * (E1x - Sx), dEy = (up - 1) * (E1y - Sy);
  const dFx = (fo - 1) * (W2x - E1x), dFy = (fo - 1) * (W2y - E1y);
  const dWx = dEx + dFx, dWy = dEy + dFy;
  const Ox = W2x + dWx, Oy = W2y + dWy;
  const ux = T3x - W2x, uy = T3y - W2y, inw = arm.inward || (arm.sign < 0 ? 1 : -1);
  const nx = -uy * inw, ny = ux * inw;                          // across her hand, to her little finger's side (a hand's length long)
  const turn = handTurn(tw);
  const Lf = Math.hypot(W2x - E1x, W2y - E1y) || 1e-9;
  const fnx = (-(W2y - E1y) * inw) / Lf, fny = ((W2x - E1x) * inw) / Lf;   // across her forearm, the same way (unit)
  const foreNarrow = FORE_TURN * Math.abs(Math.sin(tw));
  // (2026-10-08, her live show: pose.fold) her elbow bent far (her hand up by her face, her elbow down): her elbow turns as
  // a hinge, her forearm in one piece (its soft top too) and the end of her upper arm with it from her elbow joint on. The
  // soft blend round her elbow (for a bend like her wave's) fanned both soft ends out round the joint there, and they
  // showed below it as a pale, see-through cuff with odd lines; her round elbow (tools/live/page/outfits.js) covers the
  // joint instead. Not on the website (no `fold`).
  const rigid = (pose.fold || 0) * smooth(RIGID[0], RIGID[1], Math.abs(wrapDeg(pose.elbow || 0)));
  const now = arm.now;
  now.S[0] = Sx; now.S[1] = Sy; now.E[0] = E1x + dEx; now.E[1] = E1y + dEy; now.W[0] = Ox; now.W[1] = Oy;
  // (her arm unturned this frame, as her model has it: reach() works from it)
  if (now.base) { const b = now.base; b.S[0] = Sx; b.S[1] = Sy; b.up[0] = E[0] - Sx; b.up[1] = E[1] - Sy; b.fo[0] = W[0] - E[0]; b.fo[1] = W[1] - E[1]; b.ha[0] = T[0] - W[0]; b.ha[1] = T[1] - W[1]; }
  const h = now.hand;
  if (h) { h.o[0] = Ox; h.o[1] = Oy; h.u[0] = ux; h.u[1] = uy; h.n[0] = nx; h.n[1] = ny; h.turn = turn; h.curl = cu; }
  if (h && extra) handPoint(arm, 1, 0, now.tip);
  else { now.tip[0] = T3x + dWx; now.tip[1] = T3y + dWy; }
  for (const key in arm.weights) {
    const piece = +key, w = arm.weights[key], p = src(piece), q = dst(piece);
    const loc = extra && arm.local ? arm.local[piece] : null;
    const isHand = piece === hand, isFore = piece === fore, isUpper = piece === upper, isSleeve = piece === sleeve;
    for (let v = 0, n = p.length / 2; v < n; v++) {
      const ws = w[v * 3], ww = w[v * 3 + 2];
      let we = w[v * 3 + 1];
      if (rigid && (isFore || isUpper)) we += ((isFore || we >= 0.3 ? 1 : 0) - we) * rigid;
      let x = p[v * 2], y = p[v * 2 + 1], c, sn, dx, dy;
      // the shoulder (her sleeve and the top of her upper arm partly): around her shoulder joint
      if (ws) {
        if (ws === 1) { c = cs; sn = ss; } else { c = Math.cos(ws * s); sn = Math.sin(ws * s); }
        dx = x - Sx; dy = y - Sy; x = Sx + c * dx - sn * dy; y = Sy + sn * dx + c * dy;
      }
      // the elbow: around where her elbow went
      if (we) {
        if (we === 1) { c = ce; sn = se; } else { c = Math.cos(we * e); sn = Math.sin(we * e); }
        dx = x - E1x; dy = y - E1y; x = E1x + c * dx - sn * dy; y = E1y + sn * dx + c * dy;
      }
      // the wrist: around where her wrist went
      if (ww) {
        if (ww === 1) { c = cw; sn = sw; } else { c = Math.cos(ww * wr); sn = Math.sin(ww * wr); }
        dx = x - W2x; dy = y - W2y; x = W2x + c * dx - sn * dy; y = W2y + sn * dx + c * dy;
      }
      // (2026-10-08) her forearm foreshortened (and narrower toward her wrist as her hand turns); her hand moved with her
      // wrist, turned and curled in its own frame
      if (loc) {
        const a = loc[v * 2], b = loc[v * 2 + 1];
        if (isUpper || isSleeve) {
          const k = a < 0 ? 0 : a > 1 ? 1 : a, g = isUpper ? we + (1 - we) * k : k;
          x += dEx * g; y += dEy * g;
        } else if (isFore) {
          const k = a < 0 ? 0 : a > 1 ? 1 : a;
          x += dEx + dFx * k; y += dEy + dFy * k;
          if (foreNarrow) { const r = -foreNarrow * smooth(0.4, 1, a) * b * Lf; x += fnx * r; y += fny * r; }
        } else if (isHand) {
          x += dWx; y += dWy;
          if (tw || cu) {
            // (turned past side on, her hand is the other way round from her wrist on: mirrored at once, then narrowing
            // to its turn's width a little way up her hand. Going gradually from her palm's width through nothing to the
            // other way round, it pinched to a line just above her wrist: a notch, 2026-10-08.)
            curled(a, b, cu, tmpC);
            const hw = smooth(-0.02, 0.14, a), sg = turn < 0 ? -1 : 1, da = (tmpC[0] - a) * hw;
            const db = sg * (b + (tmpC[1] * Math.abs(turn) - b) * hw) - b;
            x += ux * da + nx * db; y += uy * da + ny * db;
          }
        }
      }
      q[v * 2] = x; q[v * 2 + 1] = y;
    }
  }
}
