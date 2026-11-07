// HALLUCINATION (2026-11-08): how a scene is set: things put at chosen places, things lined up along a surface (the
// floor, a table, a shelf) with natural gaps, and the surfaces and free regions (a wall, the sky) where a hallucination
// may later add something. Pure: a seeded dice in, plain objects out.
import { LIB } from './objects.js';

export function composer(r, pal) {
  const objs = [], surfaces = [], regions = [];
  let nextId = 1;
  // her cat is one cat: a scene never has two
  const UNIQUE = new Set(['cat']);
  const taken = (type) => UNIQUE.has(type) && objs.some((o) => o.type === type);
  const flipOf = (def, f, p) => (f === undefined || f === 'rand' ? (typeof def.flip === 'function' ? Boolean(def.flip(p)) : Boolean(def.flip)) && r.chance(0.5) : Boolean(f));
  const api = {
    r, pal, objs, surfaces, regions,
    // one thing at (x, y): its foot for what stands, its middle for what hangs or floats
    add(type, x, y, o = {}) {
      const def = LIB[type];
      if (!def) throw new Error(`no object ${type}`);
      if (taken(type)) return null;
      const p = { ...def.make(r, pal, o.opt || {}), ...(o.p || {}) };
      const obj = { id: nextId++, type, x, y, s: o.s ?? 1, flip: flipOf(def, o.flip ?? false, p), p, z: o.z ?? 0, layer: o.layer ?? 0, parent: o.parent?.id ?? null, surf: o.surf ?? -1 };
      objs.push(obj);
      return obj;
    },
    // a line where things stand (the floor, a table's top…), and what a hallucination may add there
    surface(x0, x1, y, { types = [], z = 0, layer = 0, parent = null, s = [0.92, 1.08], add = true } = {}) {
      surfaces.push({ x0, x1, y, types: add ? types : [], z, layer, parent: parent?.id ?? null, s });
      return surfaces.length - 1;
    },
    // the top of a table, a desk, a shelf, a bench (in the page), as a surface
    top(o, opts = {}) {
      const sf = LIB[o.type].surface(o.p);
      let x0 = sf.x0 * o.s, x1 = sf.x1 * o.s;
      if (o.flip) { const t = x0; x0 = -x1; x1 = -t; }
      return api.surface(o.x + x0, o.x + x1, o.y + sf.y * o.s, { z: o.z + 0.5, layer: o.layer, parent: o, ...opts });
    },
    // things lined up on a surface, left to right, with random gaps (what doesn't fit is left out)
    row(si, items, { pad = 5 } = {}) {
      const sf = surfaces[si];
      const seen = new Set();
      const made = items.filter(Boolean).filter((it) => {
        const t = typeof it === 'string' ? it : it.type;
        if (taken(t) || (UNIQUE.has(t) && seen.has(t))) return false;
        seen.add(t);
        return true;
      }).map((it) => {
        const spec = typeof it === 'string' ? { type: it } : it;
        const def = LIB[spec.type];
        if (!def) throw new Error(`no object ${spec.type}`);
        const p = { ...def.make(r, pal, spec.opt || {}), ...(spec.p || {}) };
        const s = spec.s ?? r.range(sf.s[0], sf.s[1]);
        const flip = flipOf(def, spec.flip, p);
        const b = def.box(p);
        return { spec, p, s, flip, b, w: (b[2] - b[0]) * s };
      });
      const avail = sf.x1 - sf.x0;
      while (made.length && made.reduce((t, m) => t + m.w + pad, pad) > avail) made.pop();
      const free = avail - made.reduce((t, m) => t + m.w, 0);
      const weights = Array.from({ length: made.length + 1 }, () => 0.35 + r.next());
      const sum = weights.reduce((a, b) => a + b, 0);
      let cur = sf.x0;
      return made.map((m, i) => {
        cur += (free * weights[i]) / sum;
        const x = cur - (m.flip ? -m.b[2] : m.b[0]) * m.s;
        cur += m.w;
        const o = { id: nextId++, type: m.spec.type, x, y: sf.y, s: m.s, flip: m.flip, p: m.p, z: (m.spec.z ?? sf.z) + i * 0.01, layer: sf.layer, parent: sf.parent, surf: si };
        objs.push(o);
        return o;
      });
    },
    // a free region (a wall, the sky) where a hallucination may add something that hangs or floats
    region(x0, y0, x1, y1, { types = [], z = 0, layer = 0, s = [0.92, 1.08] } = {}) {
      regions.push({ x0, y0, x1, y1, types, z, layer, s });
    },
    has: (type) => objs.some((o) => o.type === type),
    result() { return { objects: objs, surfaces, regions }; },
  };
  return api;
}
