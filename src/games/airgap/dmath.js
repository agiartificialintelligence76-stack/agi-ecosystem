// AIR GAP: maths that gives the same bits in every JavaScript engine. IEEE 754 fixes + − × ÷ and sqrt exactly, but
// not exp, log, sin, cos, atan2 or hypot: two browsers (or a browser and Node) can differ in the last digit, and air
// hockey is chaotic enough to turn that into a different match a few seconds later. The physics, the rules and her
// brain use these instead, so a seed (the demo, the tests, the balance tool) plays the same match everywhere.
const LN2 = 0.6931471805599453;
const TAU = 6.283185307179586;

export const len = (x, y) => Math.sqrt(x * x + y * y);

export function dexp(x) {
  if (x !== x) return x;
  if (x < -700) return 0;
  if (x > 700) return Infinity;
  const k = Math.round(x / LN2);
  const r = x - k * LN2;                       // |r| ≤ ln2 / 2
  let term = 1, sum = 1;
  for (let i = 1; i < 18; i++) { term *= r / i; sum += term; }
  let p = 1;
  const b = k < 0 ? 0.5 : 2;
  for (let i = Math.abs(k); i > 0; i--) p *= b;
  return sum * p;
}

export function dlog(x) {
  if (!(x > 0)) return x === 0 ? -Infinity : NaN;
  if (x === Infinity) return Infinity;
  // x = m · 2^e with m in [0.75, 1.5)
  let e = 0, m = x;
  while (m >= 1.5) { m *= 0.5; e++; }
  while (m < 0.75) { m *= 2; e--; }
  const s = (m - 1) / (m + 1), s2 = s * s;   // |s| < 0.2
  let term = s, sum = 0;
  for (let i = 1; i < 40; i += 2) { sum += term / i; term *= s2; }
  return e * LN2 + 2 * sum;
}

function reduce(x) { return x - TAU * Math.round(x / TAU); }   // into [−π, π]
export function dsin(x) {
  const r = reduce(x), r2 = r * r;
  let term = r, sum = r;
  for (let i = 1; i < 14; i++) { term *= -r2 / ((2 * i) * (2 * i + 1)); sum += term; }
  return sum;
}
export function dcos(x) {
  const r = reduce(x), r2 = r * r;
  let term = 1, sum = 1;
  for (let i = 1; i < 14; i++) { term *= -r2 / ((2 * i - 1) * (2 * i)); sum += term; }
  return sum;
}
