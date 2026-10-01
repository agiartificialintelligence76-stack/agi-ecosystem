// AGI-1 in 2D (2026-10-01, the owner's Live2D model): her hair and chest physics, read from the model's physics file
// (public/models/agi1-live2d/AGI-1.physics3.json, made in Live2D Cubism Editor). Written for this site (no Live2D
// framework code): the same pendulum maths as Live2D's own physics, so her hair and chest move as they were tuned in the
// editor. Pure: no browser, no three.js (tested in Node: tests/agi1-2d.test.js).
//
// How it works, per "setting" of the file (her front hair, side hair, back hair, chest up/down, chest sideways):
//  • its inputs: some of her parameters (her head and body angles), each turned into a push sideways (X) or a tilt (Angle)
//    of the top of a pendulum, weighted;
//  • the pendulum: a chain of points hanging from that top (here one rod each), with a delay, a mobility (how much speed
//    it keeps) and a radius (its length); it lags behind every move and swings back;
//  • its output: the rod's angle, times a scale, into another parameter (her hair's sway, her chest's follow-through).
// Steps are fixed (the file's Fps, 60 a second) whatever the page's frame rate, and the output is blended between the last
// two steps, so she moves the same at 30, 60 or 144 frames a second.

const AIR = 5;                 // how much a change of gravity's direction turns a rod at once (1 / AIR of it)
const MAX_BEHIND = 5;          // seconds: a page that was asleep longer than this starts over instead of catching up
const DEAD_ZONE = 0.001;       // × the setting's largest push: a rod this close to the middle rests exactly there

const toRad = (deg) => (deg * Math.PI) / 180;
// the angle from one direction to another, in (-π, π]
export function turnBetween(fx, fy, tx, ty) {
  let a = Math.atan2(ty, tx) - Math.atan2(fy, fx);
  while (a < -Math.PI) a += Math.PI * 2;
  while (a > Math.PI) a -= Math.PI * 2;
  return a;
}

// A parameter's value as a push or a tilt for the physics: its middle is 0, its ends the setting's ends (and, as in
// Live2D, an input that isn't "reflected" points the other way)
export function normalize(value, pMin, pMax, nMin, nMax, nDef, reflect) {
  const hi = Math.max(pMin, pMax), lo = Math.min(pMin, pMax);
  if (value > hi) value = hi;
  if (value < lo) value = lo;
  const nLo = Math.min(nMin, nMax), nHi = Math.max(nMin, nMax);
  const mid = lo + (hi - lo) / 2, d = value - mid;
  let r = 0;
  if (d > 0) { if (hi - mid !== 0) r = (d * (nHi - nDef)) / (hi - mid) + nDef; }
  else if (d < 0) { if (lo - mid !== 0) r = (d * (nLo - nDef)) / (lo - mid) + nDef; }
  else r = nDef;
  return reflect ? r : -r;
}

// One step of a chain: its top goes to (tx, ty), gravity tilts by `angle` (degrees), and every point follows
export function stepChain(ps, tx, ty, angle, wind, deadZone, dt) {
  ps[0].x = tx; ps[0].y = ty;
  const a = toRad(angle);
  let gx = Math.sin(a), gy = Math.cos(a);
  const gl = Math.hypot(gx, gy) || 1;
  gx /= gl; gy /= gl;
  for (let i = 1; i < ps.length; i++) {
    const p = ps[i], q = ps[i - 1];
    p.lx = p.x; p.ly = p.y;
    const delay = p.delay * dt * 30;
    // the rod turns a little with gravity's new direction
    const r = turnBetween(p.gx, p.gy, gx, gy) / AIR, c = Math.cos(r), s = Math.sin(r);
    let dx = p.x - q.x, dy = p.y - q.y;
    dx = c * dx - dy * s;
    dy = s * dx + dy * c;                    // (with the turned dx, as Live2D does: so it swings the same)
    p.x = q.x + dx; p.y = q.y + dy;
    // the speed it kept, and gravity (and the wind) pulling
    const fx = gx * p.acceleration + wind.x, fy = gy * p.acceleration + wind.y;
    p.x += p.vx * delay + fx * delay * delay;
    p.y += p.vy * delay + fy * delay * delay;
    // the rod keeps its length
    let nx = p.x - q.x, ny = p.y - q.y;
    const nl = Math.hypot(nx, ny);
    if (nl > 0) { nx /= nl; ny /= nl; } else { nx = 0; ny = 1; }
    p.x = q.x + nx * p.radius; p.y = q.y + ny * p.radius;
    if (Math.abs(p.x) < deadZone) p.x = 0;
    if (delay !== 0) { p.vx = ((p.x - p.lx) / delay) * p.mobility; p.vy = ((p.y - p.ly) / delay) * p.mobility; }
    p.gx = gx; p.gy = gy;
  }
}

// params: { ids, min, max } (her parameters, in the model's order). Returns the physics for her:
//   evaluate(values, dt)  reads her inputs from `values` (a Float32Array of every parameter) and writes the outputs
//   reset()               everything hanging straight again (after a jump, e.g. she was away)
//   setScale(id, k)       a multiplier on one output (her chest's, made subtle on the site)
//   output(id)            that output's last value
export function createPhysics(json, params, { gravity = { x: 0, y: -1 }, wind = { x: 0, y: 0 } } = {}) {
  const index = new Map(params.ids.map((id, i) => [id, i]));
  const meta = json.Meta || {};
  const stepDt = 1 / (meta.Fps > 0 ? meta.Fps : 60);
  const settings = (json.PhysicsSettings || []).map((s) => {
    const N = s.Normalization;
    return {
      pos: { min: N.Position.Minimum, max: N.Position.Maximum, def: N.Position.Default },
      ang: { min: N.Angle.Minimum, max: N.Angle.Maximum, def: N.Angle.Default },
      inputs: s.Input.map((i) => ({ at: index.get(i.Source.Id) ?? -1, weight: i.Weight / 100, type: i.Type, reflect: !!i.Reflect })),
      outputs: s.Output.map((o) => ({
        id: o.Destination.Id, at: index.get(o.Destination.Id) ?? -1, vertex: o.VertexIndex, scale: o.Scale, k: 1,
        weight: o.Weight / 100, type: o.Type, reflect: !!o.Reflect, prev: 0, cur: 0,
      })),
      rest: s.Vertices.map((v) => ({ mobility: v.Mobility, delay: v.Delay, acceleration: v.Acceleration, radius: v.Radius })),
      ps: null,
    };
  });
  const inputAt = [...new Set(settings.flatMap((s) => s.inputs.map((i) => i.at)).filter((i) => i >= 0))];
  const cache = new Float32Array(params.ids.length), inCache = new Float32Array(params.ids.length);
  let remain = 0, primed = false;

  function hang(s) {
    let y = 0;
    s.ps = s.rest.map((v, i) => {
      if (i > 0) y += v.radius;
      return { ...v, x: 0, y, lx: 0, ly: y, vx: 0, vy: 0, gx: 0, gy: 1 };
    });
    for (const o of s.outputs) { o.prev = 0; o.cur = 0; }
  }
  function reset() {
    for (const s of settings) hang(s);
    remain = 0;
    primed = false;
  }
  reset();

  // an output's raw value: the angle of its rod (from the rod above it, or from straight down for the first one), or
  // how far it moved sideways (X) or up and down (Y)
  function rawOutput(s, o) {
    const ps = s.ps, i = o.vertex;
    if (i < 1 || i >= ps.length) return 0;
    const tx = ps[i].x - ps[i - 1].x, ty = ps[i].y - ps[i - 1].y;
    let v;
    if (o.type === 'X') v = tx;
    else if (o.type === 'Y') v = ty;
    else {
      const px = i >= 2 ? ps[i - 1].x - ps[i - 2].x : -gravity.x, py = i >= 2 ? ps[i - 1].y - ps[i - 2].y : -gravity.y;
      v = turnBetween(px, py, tx, ty);
    }
    return o.reflect ? -v : v;
  }
  // a raw value into its parameter: scaled, kept inside the parameter's range, weighted
  function write(values, o, raw) {
    if (o.at < 0) return;
    // (in Live2D, outputs of type X and Y are never scaled up: their scale comes out as 0; these files use angles)
    const scale = o.type === 'Angle' ? o.scale * o.k : 0;
    let v = raw * scale;
    const lo = params.min[o.at], hi = params.max[o.at];
    if (v < lo) v = lo; else if (v > hi) v = hi;
    values[o.at] = o.weight >= 1 ? v : values[o.at] * (1 - o.weight) + v * o.weight;
  }

  function evaluate(values, dt) {
    if (!(dt > 0)) return;
    if (!primed) { for (const j of inputAt) inCache[j] = values[j]; primed = true; }
    remain += dt;
    if (remain > MAX_BEHIND) remain = 0;
    while (remain >= stepDt) {
      // the inputs move evenly from where they were to where they are now, across this frame's steps
      const w = stepDt / remain;
      for (const j of inputAt) { cache[j] = inCache[j] * (1 - w) + values[j] * w; inCache[j] = cache[j]; }
      for (const s of settings) {
        let tx = 0, ty = 0, angle = 0;
        for (const inp of s.inputs) {
          if (inp.at < 0) continue;
          const v = cache[inp.at], lo = params.min[inp.at], hi = params.max[inp.at];
          if (inp.type === 'X') tx += normalize(v, lo, hi, s.pos.min, s.pos.max, s.pos.def, inp.reflect) * inp.weight;
          else if (inp.type === 'Y') ty += normalize(v, lo, hi, s.pos.min, s.pos.max, s.pos.def, inp.reflect) * inp.weight;
          else angle += normalize(v, lo, hi, s.ang.min, s.ang.max, s.ang.def, inp.reflect) * inp.weight;
        }
        const r = toRad(-angle), c = Math.cos(r), sn = Math.sin(r);
        tx = tx * c - ty * sn;
        ty = tx * sn + ty * c;                 // (with the turned tx, as Live2D does)
        stepChain(s.ps, tx, ty, angle, wind, DEAD_ZONE * s.pos.max, stepDt);
        for (const o of s.outputs) { o.prev = o.cur; o.cur = rawOutput(s, o); }
      }
      remain -= stepDt;
    }
    // between the last two steps, for a frame that falls between them
    const a = remain / stepDt;
    for (const s of settings) for (const o of s.outputs) write(values, o, o.prev * (1 - a) + o.cur * a);
  }

  const outputs = settings.flatMap((s) => s.outputs);
  return {
    evaluate, reset,
    get stepDt() { return stepDt; },
    setScale(id, k) { for (const o of outputs) if (o.id === id) o.k = k; },
    output(id) { const o = outputs.find((x) => x.id === id); return o ? o.cur : 0; },
    get settings() { return settings; },
  };
}
