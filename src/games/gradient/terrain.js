// GRADIENT DESCENT (2026-11-08): the landscape. Each hole's ground is one smooth height function h(x, z), a sum of
// simple parts (bowls, Gaussian bumps and dips, a banana valley, ridges, plateaus and cliffs, ripples, saddles), each
// with its exact slope (∇h) and curvature (the Hessian), so the ball's physics never has to guess. Pure: no DOM.
//
//   const f = makeField(parts);   f.sample(x, z, out)  → out = [h, ∂h/∂x, ∂h/∂z, ∂²h/∂x², ∂²h/∂x∂z, ∂²h/∂z²]
//   f.h(x, z)                     the height alone
//
// A part: { t: 'gauss' | 'bowl' | 'plane' | 'ridge' | 'banana' | 'mesa' | 'step' | 'ripple' | 'saddle', … } with its
// centre `c: [x, z]` and a turn `rot` (degrees) where it has a direction. See PART_DOCS below.

const DEG = Math.PI / 180;
const K = { gauss: 1, bowl: 2, plane: 3, ridge: 4, banana: 5, mesa: 6, step: 7, ripple: 8, saddle: 9, basin: 10 };
export const KINDS = Object.keys(K);

// what each part's numbers mean (also read by the tests, which check every part's slope against the height)
export const PART_DOCS = {
  gauss: 'a: height (negative: a dip), s: width (or [along, across]), c, rot',
  bowl: 'a, b: curvature along and across (h = a·u² + b·w²), c, rot',
  plane: 'g: [slope x, slope z]',
  ridge: 'a: height (negative: a trench), s: width, p: [x1, z1], q: [x2, z2] (a segment)',
  banana: 'a: wall height, k: bend, s: valley half-width, c, rot (the valley w = k·u²)',
  mesa: 'a: height, r: [radius along, across], e: edge softness (0.02 sharp … 0.3 soft), c, rot',
  step: 'a: height, e: edge softness (units), c (a point on the edge), rot (the edge faces +u)',
  ripple: 'a: amplitude, f: [freq along, freq across] (rad/unit; 0 across = a washboard), ph: [phase u, phase w], s: window width (0: everywhere), c, rot',
  saddle: 'a: height limit, k: [up along, down across], c, rot',
  basin: 'a: depth, r: flat floor radius, k: wall steepness, c (or p, q: a long floor along a segment)',
  green: 'a level putting surface: c, r (its flat radius), e (its rim, units), depth (below the ground at its centre); applied after the others',
};

// One part, ready to run: every part has the same shape (fast in JavaScript engines)
function compile(p) {
  const kind = K[p.t];
  if (!kind) throw new Error(`terrain: unknown part ${p.t}`);
  const rot = (p.rot || 0) * DEG;
  const c = p.c || [0, 0];
  const o = { k: kind, cx: c[0], cz: c[1], co: Math.cos(rot), sn: Math.sin(rot), a: p.a ?? 1, n1: 0, n2: 0, n3: 0, n4: 0, n5: 0, n6: 0 };
  switch (kind) {
    case 1: { const s = Array.isArray(p.s) ? p.s : [p.s ?? 2, p.s ?? 2]; o.n1 = 1 / (s[0] * s[0]); o.n2 = 1 / (s[1] * s[1]); break; }
    case 2: o.n1 = p.a ?? 0.05; o.n2 = p.b ?? o.n1; break;
    case 3: o.n1 = p.g[0]; o.n2 = p.g[1]; break;
    case 4: {
      o.cx = p.p[0]; o.cz = p.p[1];
      const dx = p.q[0] - p.p[0], dz = p.q[1] - p.p[1], L2 = dx * dx + dz * dz || 1e-9;
      o.n1 = dx; o.n2 = dz; o.n3 = 1 / L2; o.n4 = 1 / ((p.s ?? 1) * (p.s ?? 1));
      const L = Math.sqrt(L2); o.n5 = dx / L; o.n6 = dz / L;
      break;
    }
    case 5: o.n1 = p.k ?? 0.1; o.n2 = 1 / ((p.s ?? 1) * (p.s ?? 1)); break;
    case 6: { const r = Array.isArray(p.r) ? p.r : [p.r ?? 3, p.r ?? 3]; o.n1 = 1 / r[0]; o.n2 = 1 / r[1]; o.n3 = 1 / (p.e ?? 0.1); break; }
    case 7: o.n3 = 1 / (p.e ?? 0.3); break;
    case 8: {
      const f = Array.isArray(p.f) ? p.f : [p.f ?? 1, 0]; const ph = p.ph || [0, f[1] ? 0 : Math.PI / 2];
      o.n1 = f[0]; o.n2 = f[1]; o.n3 = ph[0]; o.n4 = ph[1]; o.n5 = p.s ? 1 / (p.s * p.s) : 0;
      break;
    }
    case 9: { const kk = Array.isArray(p.k) ? p.k : [p.k ?? 0.05, p.k ?? 0.05]; o.n1 = kk[0]; o.n2 = kk[1]; break; }
    case 10: {
      const a = p.p || c, b = p.q || a;
      o.cx = a[0]; o.cz = a[1];
      const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz;
      o.n1 = dx; o.n2 = dz; o.n3 = L2 > 1e-12 ? 1 / L2 : 0; o.n4 = p.r ?? 1.5; o.n5 = (p.k ?? 0.1) / (p.a ?? 1);
      o.n6 = p.k ?? 0.1;
      break;
    }
    default:
  }
  return o;
}

// the local results of one part, in its own frame (u along, w across): value, du, dw, duu, duw, dww
const L = new Float64Array(6);

function local(o, u, w) {
  switch (o.k) {
    case 1: { // gauss
      const E = o.a * Math.exp(-0.5 * (u * u * o.n1 + w * w * o.n2));
      const pu = u * o.n1, pw = w * o.n2;
      L[0] = E; L[1] = -E * pu; L[2] = -E * pw;
      L[3] = E * (pu * pu - o.n1); L[4] = E * pu * pw; L[5] = E * (pw * pw - o.n2);
      return;
    }
    case 2: { // bowl
      L[0] = o.n1 * u * u + o.n2 * w * w; L[1] = 2 * o.n1 * u; L[2] = 2 * o.n2 * w;
      L[3] = 2 * o.n1; L[4] = 0; L[5] = 2 * o.n2;
      return;
    }
    case 5: { // banana: a valley along w = k·u²
      const V = w - o.n1 * u * u, Vu = -2 * o.n1 * u, Vuu = -2 * o.n1;
      const E = Math.exp(-0.5 * V * V * o.n2);
      const hV = o.a * E * V * o.n2, hVV = o.a * E * (o.n2 - V * V * o.n2 * o.n2);
      L[0] = o.a * (1 - E); L[1] = hV * Vu; L[2] = hV;
      L[3] = hVV * Vu * Vu + hV * Vuu; L[4] = hVV * Vu; L[5] = hVV;
      return;
    }
    case 6: { // mesa: a plateau with a rounded edge (an ellipse in u, w)
      const pu = u * o.n1, pw = w * o.n2;
      const rho = Math.sqrt(pu * pu + pw * pw);
      const t = (1 - rho) * o.n3;
      const sg = t > 30 ? 1 : t < -30 ? 0 : 1 / (1 + Math.exp(-t));
      L[0] = o.a * sg;
      if (rho < 1e-7) { L[1] = 0; L[2] = 0; L[3] = 0; L[4] = 0; L[5] = 0; return; }
      const d1 = sg * (1 - sg), d2 = d1 * (1 - 2 * sg);
      const hr = -o.a * d1 * o.n3, hrr = o.a * d2 * o.n3 * o.n3;
      const ru = pu * o.n1 / rho, rw = pw * o.n2 / rho;
      const ruu = (o.n1 * o.n1 - ru * ru) / rho, rww = (o.n2 * o.n2 - rw * rw) / rho, ruw = -ru * rw / rho;
      L[1] = hr * ru; L[2] = hr * rw;
      L[3] = hrr * ru * ru + hr * ruu; L[4] = hrr * ru * rw + hr * ruw; L[5] = hrr * rw * rw + hr * rww;
      return;
    }
    case 7: { // step: a cliff along w (high where u < 0)
      const t = -u * o.n3;
      const sg = t > 30 ? 1 : t < -30 ? 0 : 1 / (1 + Math.exp(-t));
      const d1 = sg * (1 - sg), d2 = d1 * (1 - 2 * sg);
      L[0] = o.a * sg; L[1] = -o.a * d1 * o.n3; L[2] = 0;
      L[3] = o.a * d2 * o.n3 * o.n3; L[4] = 0; L[5] = 0;
      return;
    }
    case 8: { // ripple: a·sin(fu·u + pu)·sin(fw·w + pw), in a soft round window
      const su = Math.sin(o.n1 * u + o.n3), cu = Math.cos(o.n1 * u + o.n3);
      const sw = Math.sin(o.n2 * w + o.n4), cw = Math.cos(o.n2 * w + o.n4);
      const S = o.a * su * sw, Su = o.a * o.n1 * cu * sw, Sw = o.a * o.n2 * su * cw;
      const Suu = -o.n1 * o.n1 * S, Sww = -o.n2 * o.n2 * S, Suw = o.a * o.n1 * o.n2 * cu * cw;
      if (!o.n5) { L[0] = S; L[1] = Su; L[2] = Sw; L[3] = Suu; L[4] = Suw; L[5] = Sww; return; }
      const G = Math.exp(-0.5 * (u * u + w * w) * o.n5), Gu = -G * u * o.n5, Gw = -G * w * o.n5;
      const Guu = G * (u * u * o.n5 * o.n5 - o.n5), Gww = G * (w * w * o.n5 * o.n5 - o.n5), Guw = G * u * w * o.n5 * o.n5;
      L[0] = S * G; L[1] = Su * G + S * Gu; L[2] = Sw * G + S * Gw;
      L[3] = Suu * G + 2 * Su * Gu + S * Guu; L[4] = Suw * G + Su * Gw + Sw * Gu + S * Guw; L[5] = Sww * G + 2 * Sw * Gw + S * Gww;
      return;
    }
    case 9: { // saddle: up along u, down across w, softly limited to ±a
      const Q = o.n1 * u * u - o.n2 * w * w, Qu = 2 * o.n1 * u, Qw = -2 * o.n2 * w;
      const T = Math.tanh(Q / o.a), D = 1 - T * T, DD = -2 * T * D / o.a;
      L[0] = o.a * T; L[1] = D * Qu; L[2] = D * Qw;
      L[3] = DD * Qu * Qu + D * 2 * o.n1; L[4] = DD * Qu * Qw; L[5] = DD * Qw * Qw - D * 2 * o.n2;
      return;
    }
    default:
  }
}

// adds one part's height, slope and curvature at (x, z) into out
function addPart(o, x, z, out) {
  if (o.k === 3) { out[0] += o.n1 * x + o.n2 * z; out[1] += o.n1; out[2] += o.n2; return; }
  if (o.k === 4) { // ridge: a Gaussian wall along a segment (its own frame: the nearest point)
    const px = x - o.cx, pz = z - o.cz;
    let t = (px * o.n1 + pz * o.n2) * o.n3;
    const inside = t > 0 && t < 1;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const dx = px - t * o.n1, dz = pz - t * o.n2;
    const D = dx * dx + dz * dz;
    const h = o.a * Math.exp(-0.5 * D * o.n4);
    const hD = -0.5 * h * o.n4, hDD = 0.25 * h * o.n4 * o.n4;
    const Dx = 2 * dx, Dz = 2 * dz;
    // ∇²D: 2·I at the ends, 2·(I − ê·êᵀ) along the segment
    let Dxx = 2, Dzz = 2, Dxz = 0;
    if (inside) { Dxx = 2 - 2 * o.n5 * o.n5; Dzz = 2 - 2 * o.n6 * o.n6; Dxz = -2 * o.n5 * o.n6; }
    out[0] += h; out[1] += hD * Dx; out[2] += hD * Dz;
    out[3] += hDD * Dx * Dx + hD * Dxx; out[4] += hDD * Dx * Dz + hD * Dxz; out[5] += hDD * Dz * Dz + hD * Dzz;
    return;
  }
  if (o.k === 10) { // basin: a flat floor (within r of a point or a segment), its walls rising softly to the rim
    const px = x - o.cx, pz = z - o.cz;
    let t = (px * o.n1 + pz * o.n2) * o.n3;
    const inside = t > 0 && t < 1;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const dx = px - t * o.n1, dz = pz - t * o.n2;
    const D = Math.sqrt(dx * dx + dz * dz), e = D - o.n4;
    if (e <= 0) { out[0] -= o.a; return; }
    const E = Math.exp(-o.n5 * e * e);
    out[0] -= o.a * E;
    const he = 2 * o.n6 * e * E, hee = 2 * o.n6 * E * (1 - 2 * o.n5 * e * e);
    const nx = dx / D, nz = dz / D;
    out[1] += he * nx; out[2] += he * nz;
    // ∇²D: (I − n·nᵀ)/D around an end (or a point); along the segment only across it, and that's linear: 0
    let Dxx = 0, Dzz = 0, Dxz = 0;
    if (!inside) { Dxx = (1 - nx * nx) / D; Dzz = (1 - nz * nz) / D; Dxz = -nx * nz / D; }
    out[3] += hee * nx * nx + he * Dxx; out[4] += hee * nx * nz + he * Dxz; out[5] += hee * nz * nz + he * Dzz;
    return;
  }
  const dx = x - o.cx, dz = z - o.cz, c = o.co, s = o.sn;
  const u = dx * c + dz * s, w = -dx * s + dz * c;
  local(o, u, w);
  out[0] += L[0];
  out[1] += L[1] * c - L[2] * s;
  out[2] += L[1] * s + L[2] * c;
  const cs = c * s, cc = c * c, ss = s * s;
  out[3] += cc * L[3] - 2 * cs * L[4] + ss * L[5];
  out[4] += cs * L[3] + (cc - ss) * L[4] - cs * L[5];
  out[5] += ss * L[3] + 2 * cs * L[4] + cc * L[5];
}

// A green levels the ground: inside its radius the height is one flat level, across its rim it blends back into the
// landscape: h = (1 − m)·rest + m·level, with m going smoothly from 1 to 0 across the rim (and the exact derivatives).
function applyGreen(g, x, z, out) {
  const dx = x - g.cx, dz = z - g.cz;
  const D = Math.sqrt(dx * dx + dz * dz);
  const t = (D - g.r) / g.e;
  if (t >= 1) return;
  if (t <= 0) { out[0] = g.level; out[1] = 0; out[2] = 0; out[3] = 0; out[4] = 0; out[5] = 0; return; }
  const S = t * t * (3 - 2 * t), S1 = 6 * t * (1 - t) / g.e, S2 = (6 - 12 * t) / (g.e * g.e);
  const m = 1 - S, mD = -S1, mDD = -S2;
  const nx = dx / D, nz = dz / D;
  const mx = mD * nx, mz = mD * nz;
  const mxx = mDD * nx * nx + mD * (1 - nx * nx) / D, mzz = mDD * nz * nz + mD * (1 - nz * nz) / D, mxz = mDD * nx * nz - mD * nx * nz / D;
  const h = out[0], hx = out[1], hz = out[2], hxx = out[3], hxz = out[4], hzz = out[5];
  const d = g.level - h;
  out[0] = h + m * d;
  out[1] = (1 - m) * hx + d * mx;
  out[2] = (1 - m) * hz + d * mz;
  out[3] = (1 - m) * hxx - 2 * mx * hx + d * mxx;
  out[4] = (1 - m) * hxz - mx * hz - mz * hx + d * mxz;
  out[5] = (1 - m) * hzz - 2 * mz * hz + d * mzz;
}

export function makeField(parts) {
  const greensDef = parts.filter((p) => p.t === 'green');
  const list = parts.filter((p) => p.t !== 'green' && !p.after).map(compile);
  const after = parts.filter((p) => p.after).map(compile);
  const n = list.length;
  const tmp = new Float64Array(6);
  const greens = [];
  const base = (x, z, out) => {
    out[0] = 0; out[1] = 0; out[2] = 0; out[3] = 0; out[4] = 0; out[5] = 0;
    for (let i = 0; i < n; i++) addPart(list[i], x, z, out);
  };
  for (const g of greensDef) {
    const c = g.c || [0, 0];
    base(c[0], c[1], tmp);
    for (const q of greens) applyGreen(q, c[0], c[1], tmp);
    greens.push({ cx: c[0], cz: c[1], r: g.r ?? 2, e: g.e ?? 1, level: tmp[0] - (g.depth ?? 0.3) });
  }
  const field = {
    parts: list,
    greens,
    sample(x, z, out) {
      base(x, z, out);
      for (let i = 0; i < greens.length; i++) applyGreen(greens[i], x, z, out);
      for (let i = 0; i < after.length; i++) addPart(after[i], x, z, out);
      return out;
    },
    h(x, z) { field.sample(x, z, tmp); return tmp[0]; },
  };
  return field;
}

// the nearest valley floor downhill of (x, z): plain gradient descent with a line search (for the cup's exact spot, for
// "you're in a local minimum", and for the daily hole's checks)
export function descend(field, x, z, { steps = 400, tol = 1e-7, bounds = null } = {}) {
  const o = new Float64Array(6);
  let h = field.sample(x, z, o)[0];
  let lr = 0.5;
  for (let i = 0; i < steps; i++) {
    const gx = o[1], gz = o[2];
    const g2 = gx * gx + gz * gz;
    if (g2 < tol * tol) break;
    let nx, nz, nh;
    for (;;) {
      nx = x - lr * gx; nz = z - lr * gz;
      if (bounds) { nx = Math.max(-bounds[0], Math.min(bounds[0], nx)); nz = Math.max(-bounds[1], Math.min(bounds[1], nz)); }
      nh = field.h(nx, nz);
      if (nh <= h - 1e-4 * lr * g2 || lr < 1e-6) break;
      lr *= 0.5;
    }
    if (Math.abs(nx - x) + Math.abs(nz - z) < 1e-10) break;
    x = nx; z = nz; h = nh;
    field.sample(x, z, o);
    lr = Math.min(2, lr * 1.6);
  }
  return { x, z, h };
}
