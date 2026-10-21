// TRENCHING SIMULATOR's dice (2026-10-20): a seeded random number generator, so the same seed makes the same market
// (a run can be played again from its seed). sfc32 (a small, fast generator that passes PractRand), its four numbers
// made by splitmix32 from a 32-bit hash of the seed. Nothing in the game's engine uses Math.random.
// Pure: read in Node too (tests/trench.test.js).

// FNV-1a over a string's UTF-16 units, then a final mix (murmur3's), so close strings land far apart
export function hash32(text) {
  const s = String(text);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

// One seed from several parts (a run's seed and what a stream is for): `seedOf(seed, 'coin', 12)`
export const seedOf = (...parts) => hash32(parts.map(String).join('␟'));

function splitmix32(a) {
  let x = a >>> 0;
  return () => {
    x = (x + 0x9e3779b9) | 0;
    let t = x ^ (x >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t ^= t >>> 15;
    t = Math.imul(t, 0x735a2d97);
    t ^= t >>> 15;
    return t >>> 0;
  };
}

// A stream of random numbers. Every draw goes through `f()`, a number in [0, 1).
export function makeRng(seed) {
  const sm = splitmix32(seed);
  let a = sm(), b = sm(), c = sm(), d = sm();
  const f = () => {
    a |= 0; b |= 0; c |= 0; d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
  for (let i = 0; i < 15; i++) f();

  const r = {
    f,
    // a whole number 0 … n-1
    int: (n) => Math.floor(f() * n),
    // a number in [lo, hi)
    range: (lo, hi) => lo + (hi - lo) * f(),
    // a whole number lo … hi (both included)
    between: (lo, hi) => lo + Math.floor(f() * (hi - lo + 1)),
    chance: (p) => f() < p,
    pick: (list) => list[Math.floor(f() * list.length)],
    // one of a list's items by weight: [[item, weight], …] or { item: weight }
    weighted(items) {
      const pairs = Array.isArray(items) ? items : Object.entries(items);
      let total = 0;
      for (const [, w] of pairs) total += Math.max(0, w);
      let x = f() * total;
      for (const [item, w] of pairs) {
        x -= Math.max(0, w);
        if (x < 0) return item;
      }
      return pairs[pairs.length - 1][0];
    },
    // a standard normal number (Box–Muller, one of the pair: so each draw is two uniforms, whatever came before)
    normal() {
      let u = f();
      if (u < 1e-12) u = 1e-12;
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * f());
    },
    // a lognormal number: its median, and how wide (sigma of its log)
    logn: (median, sigma) => median * Math.exp(sigma * r.normal()),
    // how long until the next of events that come `rate` times a second
    exp(rate) {
      let u = f();
      if (u < 1e-12) u = 1e-12;
      return -Math.log(u) / rate;
    },
    // how many events of `mean` on average (Knuth's way while it's small, else a normal one, never below 0)
    poisson(mean) {
      if (!(mean > 0)) return 0;
      if (mean > 30) return Math.max(0, Math.round(mean + Math.sqrt(mean) * r.normal()));
      const limit = Math.exp(-mean);
      let k = 0;
      let p = f();
      while (p > limit) { k++; p *= f(); }
      return k;
    },
    // shuffles a copy of a list
    shuffled(list) {
      const out = list.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(f() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    // a new stream, its seed from this one and a label (this one moves on by one draw)
    fork: (label) => makeRng(hash32(`${label}␟${Math.floor(f() * 4294967296)}`)),
  };
  return r;
}
