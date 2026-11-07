// HALLUCINATION (2026-11-08): a scene and AGI-1's redraw of it. A seed and a level make one picture-book page (a
// template, a palette, its things placed by ./compose.js) and five hallucinations: changes to the redraw that are each a
// real change of one property (removed, added, recolored, counted differently, flipped, reshaped, resized, repatterned,
// another symbol, another time, moved, two colors swapped), never overlapping each other, never hidden behind something,
// each big enough to see at the size it's played. Pure (no DOM): the same seed always makes the same scene.
import { rng, clamp, lerp } from '../kit/fx.js';
import { LIB, listOf, boxOf, partOf, area, overlap, grow, union } from './objects.js';
import { TEMPLATES, TEMPLATE_IDS } from './templates.js';
import { composer } from './compose.js';
import { cdist, W, H } from './paint.js';

export const N_DIFFS = 5;
export const KINDS = Object.freeze(['remove', 'add', 'recolor', 'count', 'flip', 'shape', 'size', 'pattern', 'symbol', 'time', 'move', 'swap']);
const WHOLE = new Set(['remove', 'add', 'flip', 'size', 'move']);
const SPEC_KIND = { recolor: 'recolor', recolorAt: 'recolor', pattern: 'pattern', shape: 'shape', symbol: 'symbol', count: 'count', swap: 'swap', toggle: null, time: 'time' };

// how hard a level is: smaller and subtler changes as it goes up
export function difficulty(level = 1) {
  const d = clamp((level - 1) / 9, 0, 1);
  return {
    d, level,
    minArea: lerp(520, 250, d),
    cmin: lerp(175, 105, d),
    sizeK: lerp(1.42, 1.24, d),
    moveMin: lerp(26, 15, d), moveMax: lerp(36, 22, d),
    countStep: d < 0.3 ? 2 : 1,
    // later on, whole things that appear, vanish, turn, grow or move are smaller ones (a whole bed vanishing is for level 1)
    maxWhole: d < 0.45 ? Infinity : lerp(6500, 2600, (d - 0.45) / 0.55),
    w: {
      remove: lerp(1.5, 0.7, d), add: lerp(1.2, 0.6, d), recolor: 1.3, count: lerp(0.6, 1.2, d), flip: lerp(0.35, 0.9, d),
      shape: 1, size: lerp(0.75, 0.45, d), pattern: lerp(0.9, 1.2, d), symbol: 1.2, time: lerp(0.6, 1.1, d), move: lerp(0.35, 0.85, d), swap: lerp(0.7, 1.1, d),
    },
  };
}

export const canFlip = (def, p) => (typeof def.flip === 'function' ? Boolean(def.flip(p)) : Boolean(def.flip));
const clone = (o) => ({ ...o, p: JSON.parse(JSON.stringify(o.p)) });
const inFrame = (b, m = 1) => b[0] >= m && b[1] >= m && b[2] <= W - m && b[3] <= H - m;
const sortObjects = (list) => list.slice().sort((a, b) => (a.layer - b.layer) || (a.z - b.z) || (a.id - b.id));
export function distToRect(x, y, b) {
  const dx = Math.max(b[0] - x, 0, x - b[2]), dy = Math.max(b[1] - y, 0, y - b[3]);
  return Math.hypot(dx, dy);
}

// ---------- a scene ----------
// opts: { template, palette (index), tries }
export function makeScene(seed, level = 1, opts = {}) {
  const s0 = seed >>> 0;
  for (let attempt = 0; attempt < 16; attempt++) {
    const r = rng((s0 + attempt * 7919) >>> 0 || 1);
    const tplId = opts.template && TEMPLATES[opts.template] ? opts.template : TEMPLATE_IDS[r.int(0, TEMPLATE_IDS.length - 1)];
    const tpl = TEMPLATES[tplId];
    const pal = opts.palette != null ? tpl.palettes[opts.palette % tpl.palettes.length] : r.pick(tpl.palettes);
    const c = composer(r, pal);
    const layout = tpl.compose(c, level) || {};
    const res = c.result();
    const a = sortObjects(res.objects.filter((o) => inFrame(boxOf(o), 0)));
    const scene = { seed: s0, level, tpl: tplId, pal, palId: pal.id, bg: r.int(1, 999999), layout, a, surfaces: res.surfaces, regions: res.regions };
    const made = makeDiffs(r, scene, difficulty(level));
    if (made) { scene.b = sortObjects(made.b); scene.diffs = made.diffs; return scene; }
  }
  throw new Error(`HALLUCINATION: no scene for seed ${seed}`);
}

// ---------- the five hallucinations ----------
function makeDiffs(r, sc, D) {
  const A = sc.a;
  const B = A.map(clone);
  const byId = new Map(B.map((o) => [o.id, o]));
  const kids = new Map();
  for (const o of A) if (o.parent != null) kids.set(o.parent, (kids.get(o.parent) || 0) + 1);
  const diffs = [], used = new Set(), perKind = {};
  let nextId = A.reduce((m, o) => Math.max(m, o.id), 0) + 1;
  const regions = () => diffs.map((d) => d.region);
  const free = (reg) => regions().every((g) => !overlap(grow(g, 7), reg));

  // what's drawn on top of an object covers it: a change must stay mostly in view (in both pictures)
  const coverOf = (list, o, reg) => {
    let c = 0;
    for (const q of list) {
      if (q === o || q.id === o.id || (q.layer < o.layer) || (q.layer === o.layer && q.z <= o.z) || LIB[q.type].kind === 'flat') continue;
      c += overlap(reg, boxOf(q));
    }
    return c / Math.max(1, area(reg));
  };
  const neighbors = (o) => B.filter((q) => q.id !== o.id && q.id !== o.parent && q.parent !== o.id && ((o.surf >= 0 && q.surf === o.surf) || (o.surf < 0 && q.surf < 0 && q.layer === o.layer && Math.abs(q.z - o.z) < 60)));
  const safe = sc.layout && sc.layout.safe;
  const inSafe = (o, b) => !safe || o.layer !== 0 || (b[0] >= safe[0] && b[1] >= safe[1] && b[2] <= safe[2] && b[3] <= safe[3]);
  const clear = (o, box) => inSafe(o, box) && neighbors(o).every((q) => overlap(grow(boxOf(q), 1.5), box) === 0);

  // ----- each kind, made concrete for one object (or null) -----
  const H = helpers(r, sc.pal, D);
  function specMuts(o, kind) {
    const def = LIB[o.type];
    const out = [];
    if (typeof def.muts === 'function') {
      for (const m of def.muts(o.p, r, sc.pal, D, H)) if (m && m.kind === kind) out.push(m);
      return out;
    }
    for (const spec of def.muts) {
      const [k] = spec;
      const opts = (typeof spec[spec.length - 1] === 'object' && spec[spec.length - 1] && !Array.isArray(spec[spec.length - 1])) ? spec[spec.length - 1] : {};
      if (opts.when && !opts.when(o.p)) continue;
      const sk = k === 'toggle' ? spec[2] : SPEC_KIND[k];
      if (sk !== kind) continue;
      const m = H.fromSpec(o.p, spec, opts);
      if (m) out.push(m);
    }
    return out;
  }
  function tryKind(o, kind) {
    const def = LIB[o.type];
    const ob = byId.get(o.id);
    if (kind === 'remove') {
      if (def.fixed || kids.get(o.id)) return null;
      const reg = boxOf(o);
      return { reg, vis: area(reg), apply: () => { B.splice(B.indexOf(ob), 1); byId.delete(o.id); }, noun: def.noun };
    }
    if (kind === 'flip') {
      if (!canFlip(def, o.p) || kids.get(o.id)) return null;
      const nb = boxOf({ ...o, flip: !o.flip });
      if (!inFrame(nb) || !clear(o, nb)) return null;
      return { reg: union(boxOf(o), nb), vis: area(boxOf(o)), apply: () => { ob.flip = !ob.flip; }, noun: def.noun };
    }
    if (kind === 'size') {
      if (def.fixed || kids.get(o.id)) return null;
      const k = r.chance(0.6) ? D.sizeK : 1 / D.sizeK;
      const ns = o.s * k;
      const no = { ...o, s: ns };
      if (def.kind === 'hang' || def.kind === 'float') { const b0 = boxOf(o), b1 = boxOf(no); no.y = o.y + ((b0[1] + b0[3]) - (b1[1] + b1[3])) / 2; }
      const nb = boxOf(no);
      if (!inFrame(nb) || (k > 1 && !clear(o, nb))) return null;
      return { reg: union(boxOf(o), nb), vis: Math.max(area(boxOf(o)), area(nb)), apply: () => { ob.s = ns; ob.y = no.y; }, noun: def.noun, big: k > 1 };
    }
    if (kind === 'move') {
      if (def.fixed || kids.get(o.id) || def.kind === 'flat') return null;
      const sf = o.surf >= 0 ? sc.surfaces[o.surf] : null;
      for (let t = 0; t < 6; t++) {
        const dist = r.range(D.moveMin, D.moveMax) * r.sign();
        const vertical = !sf && def.kind === 'float' && r.chance(0.35);
        const no = vertical ? { ...o, y: o.y + dist * 0.7 } : { ...o, x: o.x + dist };
        const nb = boxOf(no);
        if (!inFrame(nb, 2)) continue;
        if (sf && (nb[0] < sf.x0 - 0.5 || nb[2] > sf.x1 + 0.5)) continue;
        if (!clear(o, nb)) continue;
        return { reg: union(boxOf(o), nb), vis: area(boxOf(o)), apply: () => { ob.x = no.x; ob.y = no.y; }, noun: def.noun };
      }
      return null;
    }
    const muts = r.shuffle(specMuts(o, kind));
    for (const m of muts) {
      const np = m.apply();
      if (!np) continue;
      const nq = { ...o, p: np };
      const nb = boxOf(nq);
      if (!inFrame(nb)) continue;
      if (area(nb) > area(boxOf(o)) * 1.02 && !clear(o, nb)) continue;
      const partA = typeof m.part === 'function' ? m.part(o.p) : m.part;
      const partB = typeof m.part === 'function' ? m.part(np) : m.part;
      const ra = partA ? partOf(o, partA) : boxOf(o), rb = partB ? partOf(nq, partB) : nb;
      return { reg: union(ra, rb), vis: Math.max(area(ra), area(rb)), apply: () => { ob.p = np; }, noun: m.noun || def.noun };
    }
    return null;
  }
  function tryAdd() {
    const spots = [...sc.surfaces.map((s, i) => ({ s, i })).filter((x) => x.s.types.length), ...sc.regions.map((g) => ({ g }))];
    if (!spots.length) return null;
    for (let t = 0; t < 10; t++) {
      const spot = r.pick(spots);
      const types = spot.s ? spot.s.types : spot.g.types;
      const type = r.pick(types);
      if (type === 'cat' && B.some((q) => q.type === 'cat')) continue;
      const def = LIB[type];
      const p = def.make(r, sc.pal, type === 'bird' && spot.g ? { pose: 'fly' } : {});
      const range = spot.s ? spot.s.s : spot.g.s;
      const s = r.range(range[0], range[1]);
      const flip = canFlip(def, p) && r.chance(0.5);
      const b = def.box(p);
      const w = (b[2] - b[0]) * s;
      let o = null;
      if (spot.s) {
        const sf = spot.s;
        const on = B.filter((q) => q.surf === spot.i).map(boxOf).sort((x, y) => x[0] - y[0]);
        const gaps = [];
        let x = sf.x0;
        for (const q of on) { if (q[0] - x >= w + 8) gaps.push([x + 4, q[0] - 4]); x = Math.max(x, q[2]); }
        if (sf.x1 - x >= w + 8) gaps.push([x + 4, sf.x1 - 4]);
        if (!gaps.length) continue;
        const g = r.pick(gaps);
        const left = r.range(g[0], g[1] - w);
        const ox = left - (flip ? -b[2] : b[0]) * s;
        o = { id: nextId, type, x: ox, y: sf.y, s, flip, p, z: sf.z + 0.3, layer: sf.layer, parent: sf.parent, surf: spot.i };
      } else {
        const g = spot.g;
        const h = (b[3] - b[1]) * s;
        if (g.x1 - g.x0 < w + 4 || g.y1 - g.y0 < h + 4) continue;
        for (let k = 0; k < 14 && !o; k++) {
          const left = r.range(g.x0 + 2, g.x1 - w - 2), top = r.range(g.y0 + 2, g.y1 - h - 2);
          const ox = left - (flip ? -b[2] : b[0]) * s, oy = top - b[1] * s;
          const q = { id: nextId, type, x: ox, y: oy, s, flip, p, z: g.z + 0.3, layer: g.layer, parent: null, surf: -1 };
          const qb = boxOf(q);
          if (B.every((z) => overlap(grow(boxOf(z), 4), qb) === 0)) o = q;
        }
        if (!o) continue;
      }
      const reg = boxOf(o);
      if (!inFrame(reg, 2) || !inSafe(o, reg)) continue;
      if (spot.s && B.some((q) => q.surf === spot.i && overlap(grow(boxOf(q), 2), reg))) continue;
      return { o, reg, vis: area(reg), apply: () => { B.push(o); byId.set(o.id, o); nextId++; }, noun: def.noun };
    }
    return null;
  }

  // ----- pick five -----
  const cands = (kind) => A.filter((o) => !used.has(o.id) && free(grow(boxOf(o), 2)));
  for (let tries = 0; tries < 260 && diffs.length < N_DIFFS; tries++) {
    const kinds = KINDS.filter((k) => (perKind[k] || 0) < (k === 'time' || k === 'remove' || k === 'add' ? 1 : 2));
    const kind = r.weighted(kinds, (k) => D.w[k]);
    let made = null, o = null;
    if (kind === 'add') made = tryAdd();
    else {
      const list = cands(kind);
      if (!list.length) continue;
      o = r.pick(list);
      made = tryKind(o, kind);
    }
    if (!made) continue;
    const reg = made.reg.map((v, i) => clamp(v, 0, i % 2 ? H : W));
    if (made.vis < D.minArea) continue;
    if (WHOLE.has(kind) && made.vis > D.maxWhole) continue;
    if (!free(reg)) continue;
    if (o && (coverOf(A, o, reg) > 0.45 || coverOf(B, byId.get(o.id) || o, reg) > 0.45)) continue;
    if (made.o && coverOf(B, made.o, reg) > 0.45) continue;
    made.apply();
    if (o) used.add(o.id);
    perKind[kind] = (perKind[kind] || 0) + 1;
    diffs.push({ i: diffs.length, kind, oid: made.o ? made.o.id : o.id, type: made.o ? made.o.type : o.type, noun: made.noun, region: reg });
  }
  if (diffs.length < N_DIFFS) return null;
  return { b: B, diffs };
}

// ---------- the helpers the object library's own changes use ----------
function helpers(r, pal, D) {
  const pickColor = (cur, list, min = D.cmin) => {
    const opts = listOf(pal, list).filter((c) => c !== cur && cdist(c, cur) >= min);
    if (!opts.length) return null;
    return r.pick(opts);
  };
  const set = (p, fn) => { const q = JSON.parse(JSON.stringify(p)); fn(q); return q; };
  const step = (cur, min, max, st) => {
    const ups = cur + st <= max, downs = cur - st >= min;
    if (ups && downs) return r.chance(0.5) ? cur + st : cur - st;
    if (ups) return cur + st;
    if (downs) return cur - st;
    if (st > 1) return step(cur, min, max, 1);
    return null;
  };
  const H = {
    pickColor,
    color(p, r2, pal2, D2, cur, setter, part, noun, list = 'acc') {
      return { kind: 'recolor', part, noun, apply: () => { const c = pickColor(cur, list); return c ? set(p, (q) => setter(q, c)) : null; } };
    },
    count(p, r2, D2, cur, min, max, setter, part, noun) {
      return { kind: 'count', part, noun, apply: () => { const n = step(cur, min, max, D.countStep); return n == null ? null : set(p, (q) => setter(q, n)); } };
    },
    fromSpec(p, spec, opts) {
      const [k] = spec;
      if (k === 'recolor') {
        const [, key, part, list = 'acc'] = spec;
        return { kind: 'recolor', part, noun: opts.noun, apply: () => { const c = pickColor(p[key], list); return c ? set(p, (q) => { q[key] = c; }) : null; } };
      }
      if (k === 'recolorAt') {
        const [, key, countKey, partFn] = spec;
        const n = typeof countKey === 'number' ? countKey : p[countKey];
        if (!n) return null;
        const i = r.int(0, n - 1);
        return { kind: 'recolor', part: partFn ? (q) => partFn(q, i) : null, noun: opts.noun, apply: () => { const c = pickColor(p[key][i], opts.list || 'acc'); return c ? set(p, (q) => { q[key][i] = c; }) : null; } };
      }
      if (k === 'pattern' || k === 'shape' || k === 'symbol') {
        const [, key, optsList, part] = spec;
        const list = (typeof optsList === 'function' ? optsList(p) : optsList).filter((v) => v !== p[key]);
        if (!list.length) return null;
        const v = r.pick(list);
        return { kind: k, part, noun: opts.noun, apply: () => set(p, (q) => { q[key] = v; }) };
      }
      if (k === 'count') {
        const [, key, min, max, part] = spec;
        return { kind: 'count', part, noun: opts.noun, apply: () => { const n = step(p[key], min, max, opts.step || D.countStep); return n == null ? null : set(p, (q) => { q[key] = n; }); } };
      }
      if (k === 'swap') {
        const [, k1, k2, part] = spec;
        if (cdist(p[k1], p[k2]) < D.cmin * 0.8) return null;
        return { kind: 'swap', part, noun: opts.noun, apply: () => set(p, (q) => { q[k1] = p[k2]; q[k2] = p[k1]; }) };
      }
      if (k === 'toggle') {
        const [, key, kind, part] = spec;
        return { kind, part, noun: opts.noun, apply: () => set(p, (q) => { q[key] = !p[key]; }) };
      }
      if (k === 'time') {
        return {
          kind: 'time', noun: 'clock', part: null,
          apply: () => set(p, (q) => {
            if (r.chance(0.55)) q.h = (p.h + r.sign() * r.int(D.d < 0.5 ? 3 : 2, 5) + 12) % 12;
            else q.m = (p.m + (r.chance(0.5) ? 30 : r.sign() * 20) + 60) % 60;
          }),
        };
      }
      return null;
    },
  };
  return H;
}

// ---------- taps ----------
// the difference a tap at (x, y) (page units) finds, within `rad` page units: the nearest one not found yet (−1: none).
// One already found there: { again: i }.
export function hitTest(sc, x, y, rad, found) {
  let best = -1, bestD = Infinity, again = -1, againD = Infinity;
  for (const d of sc.diffs) {
    const dist = distToRect(x, y, d.region);
    if (dist > rad) continue;
    const score = dist - Math.min(12, Math.sqrt(area(d.region)) * 0.02);
    if (found[d.i]) { if (score < againD) { againD = score; again = d.i; } continue; }
    if (score < bestD) { bestD = score; best = d.i; }
  }
  if (best >= 0) return { hit: best };
  if (again >= 0) return { again };
  return { hit: -1 };
}

// what changed in words, for her confessions and the tests
export const describe = (d) => `${d.kind} ${d.noun}`;
