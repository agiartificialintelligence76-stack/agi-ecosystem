// SCAM SLAYER: the rules of a run (pure, no DOM, deterministic: a seed and the blades' moves make the same run).
//
//   const w = createWorld({ mode: 'classic' | 'blitz' | 'attract', seed, W, H, top });
//   bladeDown(w, id, x, y, ms); bladeMove(w, id, x, y, ms); bladeUp(w, id)   the player's finger or mouse (or the demo's)
//   stepWorld(w, dt)                                                          1/120 s at a time
//   w.events                                                                  what happened (the page drains it)
//
// Classic: 3 shields. A scam that falls back down unsliced cracks one, cutting a heart cracks one, cutting a rug ends the
// run. Blitz: 60 seconds, no shields: a heart costs 5 seconds, a rug 10. Attract (the title screen's background): nothing
// is ever lost. Power scams switch on Freeze (everything slows for 4 s), Frenzy (scams fly in from the sides for 4 s) or
// Double (points ×2 for 8 s). Three or more scams in one swipe make a combo.
import { rng } from '../kit/fx.js';
import { KINDS, POWERS, roleOf, isScam, hitRadius } from './kinds.js';
import { segCircle } from './geom.js';
import { planVolley, frenzyLaunch, difficulty, pickPower } from './waves.js';

export const RULES = Object.freeze({
  lives: 3,
  blitzTime: 60,
  heartPenalty: 5,        // Blitz: seconds lost for cutting a heart
  rugPenalty: 10,         // Blitz: seconds lost for cutting a rug
  scamPoints: 10,
  goldenMult: 5,
  critMult: 2,
  doubleMult: 2,
  comboMin: 3,
  comboWindow: 0.3,       // s between two slices of the same swipe for them to count as one combo
  minSpeed: 380,          // units/s: slower than this the blade doesn't cut (a tap never does)
  critSpeed: 2400,        // units/s, through the middle: sometimes a critical slice (×2)
  critChance: 0.45,
  freeze: 4, frenzy: 4, double: 8,
  freezeScale: 0.35,
});

// the combo bonus for n scams in one swipe (5·n²: ×3 → 45, ×4 → 80, ×5 → 125, ×6 → 180)
export const comboBonus = (n) => (n >= RULES.comboMin ? 5 * n * n : 0);

// points for one slice
export function slicePoints(kind, { crit = false, double = false } = {}) {
  if (!isScam(kind)) return 0;
  let p = RULES.scamPoints * (KINDS[kind].golden ? RULES.goldenMult : 1);
  if (crit) p *= RULES.critMult;
  if (double) p *= RULES.doubleMult;
  return p;
}

// when the golden scam, the power scams and the rush waves come (seconds into the run; Blitz is busier)
export const TIMERS = Object.freeze({
  classic: { golden: [24, 34], goldenGap: [26, 42], power: [16, 22], powerGap: [18, 28], rush: [38, 48], rushGap: [32, 46] },
  blitz: { golden: [9, 13], goldenGap: [12, 18], power: [6, 9], powerGap: [9, 13], rush: [22, 26], rushGap: [18, 24] },
});

export function createWorld(o = {}) {
  const mode = o.mode === 'blitz' || o.mode === 'attract' ? o.mode : 'classic';
  const seed = (o.seed >>> 0) || 1;
  const r = rng(seed);
  const tm = TIMERS[mode === 'blitz' ? 'blitz' : 'classic'];
  const T = o.timers || {};
  const w = {
    mode, seed,
    W: o.W || 600, H: o.H || 1000, top: o.top || 0,
    start: o.start || 0,               // seconds of difficulty already behind it (the demo starts mid-game)
    rng: r,                            // throws (only the clock and the run's events draw from it)
    fxr: rng((seed ^ 0x9e3779b9) >>> 0), // critical slices, power picks
    clock: 0,                          // real seconds since it began
    t: 0,                              // game seconds (slower while frozen)
    ts: 1,                             // the time scale right now (eases into and out of Freeze)
    hitstop: 0,
    objs: [], queue: [], nextId: 1, blades: new Map(),
    score: 0,
    lives: mode === 'classic' ? RULES.lives : Infinity,
    timeLeft: mode === 'blitz' ? RULES.blitzTime : Infinity,
    power: { freeze: 0, frenzy: 0, double: 0 },
    stats: { spawned: 0, resolved: 0, slain: 0, missed: 0, hearts: 0, heartsSaved: 0, heartsCut: 0, rugs: 0, bestCombo: 0, combos: 0, golden: 0, crits: 0, powers: 0 },
    events: [],
    over: false, reason: null,
    spawn: {
      next: o.firstAt ?? 0.7, volleys: 0, opening: Boolean(o.opening),
      golden: T.golden ?? r.range(...tm.golden),
      power: T.power ?? r.range(...tm.power),
      powerKind: T.powerKind || null,
      lastPower: null,
      rush: T.rush ?? r.range(...tm.rush),
      frenzyNext: 0,
    },
  };
  return w;
}

const timerMode = (w) => (w.mode === 'blitz' ? 'blitz' : 'classic');
export const effectiveTime = (w) => w.t + w.start;
export const diffOf = (w) => difficulty(timerMode(w), effectiveTime(w));
export const anyPower = (w) => w.power.freeze > 0 || w.power.frenzy > 0 || w.power.double > 0;

// the playfield changed size (a phone turned, a window resized): everything in flight keeps its place on the screen
export function resizeWorld(w, W, H, top = w.top) {
  const sx = W / w.W, sy = H / w.H;
  if (sx !== 1 || sy !== 1) {
    for (const o of w.objs) { o.x *= sx; o.vx *= sx; o.y *= sy; o.vy *= sy; o.g *= sy; }
    for (const q of w.queue) { q.x0 *= sx; q.vx *= sx; q.y0 *= sy; q.vy *= sy; q.g *= sy; }
    for (const b of w.blades.values()) { b.x *= sx; b.y *= sy; }
  }
  w.W = W; w.H = H; w.top = top;
}

function launch(w, l) {
  const k = KINDS[l.kind];
  const o = {
    id: w.nextId++, kind: l.kind, role: k.role, r: k.r,
    x: l.x0, y: l.y0, vx: l.vx, vy: l.vy, g: l.g, rot: l.rot || 0, spin: l.spin || 0,
    age: 0, bonus: Boolean(l.bonus), dead: false,
  };
  w.objs.push(o);
  if (isScam(o.kind)) w.stats.spawned++;
  if (o.role === 'heart') w.stats.hearts++;
  w.events.push({ type: 'launch', o });
  return o;
}

// put one sticker in the air by hand (tests, the title's legend): at (x, y), moving (vx, vy), under gravity g
export function place(w, kind, x, y, { vx = 0, vy = 0, g = 0, spin = 0, bonus = false } = {}) {
  return launch(w, { kind, x0: x, y0: y, vx, vy, g, spin, bonus });
}

function end(w, reason) {
  if (w.over) return;
  w.over = true;
  w.reason = reason;
  w.events.push({ type: 'over', reason });
}

function loseLife(w, why, o) {
  w.lives = Math.max(0, w.lives - 1);
  w.events.push({ type: 'life', lives: w.lives, why, x: o?.x ?? w.W / 2, y: o?.y ?? w.H / 2 });
  if (w.lives <= 0) end(w, why);
}

function loseTime(w, s, why, o) {
  w.timeLeft = Math.max(0, w.timeLeft - s);
  w.events.push({ type: 'penalty', seconds: s, why, x: o.x, y: o.y });
  if (w.timeLeft <= 0) end(w, 'time');
}

function activate(w, kind) {
  const p = KINDS[kind].power;
  w.power[p] = RULES[p];
  w.stats.powers++;
  if (p === 'frenzy') w.spawn.frenzyNext = w.t;
  w.events.push({ type: 'power', power: p });
}

function resolveCombo(w, b) {
  const n = b.n;
  if (n > w.stats.bestCombo) w.stats.bestCombo = n;
  if (n >= RULES.comboMin) {
    const bonus = comboBonus(n) * (w.power.double > 0 ? RULES.doubleMult : 1);
    w.score += bonus;
    w.stats.combos++;
    w.events.push({ type: 'combo', n, bonus, x: b.sx / n, y: b.sy / n, blade: b.id });
  }
  b.n = 0; b.sx = 0; b.sy = 0;
}

function cut(w, b, o, ax, ay, bx, by, d, speed) {
  o.dead = true;
  const ang = Math.atan2(by - ay, bx - ax);
  // where the cut runs across the sticker (its own frame): along the blade, near its centre (halves that look fair)
  const off = Math.max(-0.32 * o.r, Math.min(0.32 * o.r, -d));
  const role = o.role;
  const ev = { type: 'slice', o, ang, off, speed, blade: b.id, crit: false, pts: 0, n: 0 };
  if (role === 'scam' || role === 'power') {
    if (b.n && w.clock - b.lastHit > RULES.comboWindow) resolveCombo(w, b);
    const crit = speed >= RULES.critSpeed && Math.abs(d) < 0.3 * o.r && w.fxr.chance(RULES.critChance);
    const pts = slicePoints(o.kind, { crit, double: w.power.double > 0 });
    w.score += pts;
    w.stats.slain++; w.stats.resolved++;
    if (crit) w.stats.crits++;
    if (KINDS[o.kind].golden) { w.stats.golden++; w.hitstop = Math.max(w.hitstop, 0.07); }
    b.n++; b.lastHit = w.clock; b.sx += o.x; b.sy += o.y;
    ev.crit = crit; ev.pts = pts; ev.n = b.n;
    w.events.push(ev);
    if (role === 'power') activate(w, o.kind);
    return;
  }
  w.events.push(ev);
  if (role === 'heart') {
    w.stats.heartsCut++;
    w.events.push({ type: 'heart', o });
    if (w.mode === 'classic') { w.hitstop = Math.max(w.hitstop, 0.12); loseLife(w, 'heart', o); }
    else if (w.mode === 'blitz') { w.hitstop = Math.max(w.hitstop, 0.1); loseTime(w, RULES.heartPenalty, 'heart', o); }
  } else if (role === 'rug') {
    w.stats.rugs++;
    w.events.push({ type: 'rug', o });
    if (w.mode === 'classic') { w.hitstop = Math.max(w.hitstop, 0.3); end(w, 'rug'); }
    else if (w.mode === 'blitz') { w.hitstop = Math.max(w.hitstop, 0.18); loseTime(w, RULES.rugPenalty, 'rug', o); }
  }
}

const hitsScratch = [];
// the blade moved from A to B: everything it crossed is cut, in the order the blade met it
function slash(w, b, ax, ay, bx, by, speed) {
  hitsScratch.length = 0;
  for (const o of w.objs) {
    if (o.dead) continue;
    const h = segCircle(ax, ay, bx, by, o.x, o.y, hitRadius(o.kind));
    if (h) hitsScratch.push({ t: h.t, d: h.d, o });
  }
  if (!hitsScratch.length) return 0;
  hitsScratch.sort((p, q) => p.t - q.t);
  const n = hitsScratch.length;
  for (const h of hitsScratch) {
    if (w.over && w.reason === 'rug') break;     // nothing more after a rug ends the run
    cut(w, b, h.o, ax, ay, bx, by, h.d, speed);
  }
  hitsScratch.length = 0;
  return n;
}

export function bladeDown(w, id, x, y, ms) {
  let b = w.blades.get(id);
  if (b && b.n) resolveCombo(w, b);
  if (!b) { b = { id, x, y, ms, down: true, speed: 0, n: 0, lastHit: -1, sx: 0, sy: 0 }; w.blades.set(id, b); }
  b.x = x; b.y = y; b.ms = ms; b.down = true; b.speed = 0;
  return b;
}

// a new sample of the blade (ms: the caller's clock for this blade, only differences matter) → how many it cut
export function bladeMove(w, id, x, y, ms) {
  const b = w.blades.get(id);
  if (!b || !b.down) return 0;
  const dms = ms - b.ms;
  const len = Math.hypot(x - b.x, y - b.y);
  if (len < 1e-3) { if (dms > 50) { b.speed *= 0.5; b.ms = ms; } return 0; }
  const v = (len / Math.max(dms, 4)) * 1000;
  b.speed = b.speed > 0 ? b.speed * 0.35 + v * 0.65 : v;
  let n = 0;
  if (!w.over && (v >= RULES.minSpeed || b.speed >= RULES.minSpeed)) n = slash(w, b, b.x, b.y, x, y, Math.max(v, b.speed));
  b.x = x; b.y = y; b.ms = ms;
  return n;
}

export function bladeUp(w, id) {
  const b = w.blades.get(id);
  if (!b) return;
  b.down = false;
  if (b.n) resolveCombo(w, b);
  w.blades.delete(id);
}

export function releaseBlades(w) { for (const id of [...w.blades.keys()]) bladeUp(w, id); }

function fell(w, o) {
  o.dead = true;
  if (o.role === 'heart') { w.stats.heartsSaved++; w.events.push({ type: 'saved', o }); return; }
  if (o.role === 'rug') return;
  w.stats.resolved++;
  if (o.role === 'scam' && !o.bonus && !KINDS[o.kind].golden) {
    w.stats.missed++;
    w.events.push({ type: 'miss', o, x: Math.max(0, Math.min(w.W, o.x)) });
    if (w.mode === 'classic') loseLife(w, 'miss', o);
  }
}

function spawn(w) {
  const s = w.spawn;
  const tt = effectiveTime(w);
  const field = { W: w.W, H: w.H, top: w.top, t: tt, mode: timerMode(w) };
  if (w.power.frenzy > 0) {
    if (w.t >= s.frenzyNext) {
      launch(w, frenzyLaunch(w.rng, field));
      s.frenzyNext = w.t + w.rng.range(0.1, 0.16);
    }
    s.next = Math.max(s.next, w.t + 0.55);
  } else if (w.t >= s.next && !w.queue.length) {
    const diff = difficulty(field.mode, tt);
    if (diff < 0.22 && w.objs.length > 1 && !s.opening) {
      s.next = w.t + 0.15;                     // the first volleys wait for a nearly clear screen
    } else {
      const tm = TIMERS[timerMode(w)];
      const powerDue = w.t >= s.power && !anyPower(w);
      const due = {
        golden: w.t >= s.golden,
        power: powerDue ? (s.powerKind || pickPower(w.fxr, s.lastPower)) : null,
        rush: w.t >= s.rush,
      };
      const v = planVolley(w.rng, { ...field, n: s.volleys, due, opening: s.opening });
      s.opening = false;
      let last = 0;
      for (const l of v.launches) { w.queue.push({ ...l, at: w.t + l.at }); if (l.at > last) last = l.at; }
      w.queue.sort((a, b) => a.at - b.at);
      s.next = w.t + last + v.gap;
      s.volleys++;
      if (v.has.golden) s.golden = w.t + w.rng.range(...tm.goldenGap);
      if (v.has.power) { s.lastPower = v.has.power; s.powerKind = null; s.power = w.t + w.rng.range(...tm.powerGap); }
      if (v.has.rush) { s.rush = w.t + w.rng.range(...tm.rushGap); w.events.push({ type: 'rush' }); }
    }
  }
  while (w.queue.length && w.queue[0].at <= w.t) launch(w, w.queue.shift());
}

function move(w, sdt) {
  const objs = w.objs;
  let j = 0;
  for (let i = 0; i < objs.length; i++) {
    const o = objs[i];
    if (o.dead) continue;
    o.x += o.vx * sdt;
    o.y += o.vy * sdt + 0.5 * o.g * sdt * sdt;
    o.vy += o.g * sdt;
    o.rot += o.spin * sdt;
    o.age += sdt;
    if ((o.vy > 0 && o.y > w.H + o.r * 1.15) || o.x < -o.r * 2.6 || o.x > w.W + o.r * 2.6) {
      fell(w, o);
      continue;
    }
    objs[j++] = o;
  }
  objs.length = j;
}

export const timeScaleTarget = (w) => (w.power.freeze > 0 ? RULES.freezeScale : 1);

export function stepWorld(w, dt) {
  w.clock += dt;
  for (const b of w.blades.values()) if (b.n && (!b.down || w.clock - b.lastHit > RULES.comboWindow)) resolveCombo(w, b);
  if (w.over) return;
  if (w.hitstop > 0) { w.hitstop = Math.max(0, w.hitstop - dt); return; }
  for (const p of POWERS) {
    if (w.power[p] > 0) {
      w.power[p] = Math.max(0, w.power[p] - dt);
      if (w.power[p] === 0) w.events.push({ type: 'power-end', power: p });
    }
  }
  // ease into and out of Freeze (a quick slide, not a jump)
  const target = timeScaleTarget(w);
  w.ts = target + (w.ts - target) * Math.exp(-9 * dt);
  if (Math.abs(w.ts - target) < 0.002) w.ts = target;
  const sdt = dt * w.ts;
  w.t += sdt;
  if (w.mode === 'blitz') {
    w.timeLeft = Math.max(0, w.timeLeft - sdt);
    if (w.timeLeft <= 0) { end(w, 'time'); return; }
  }
  spawn(w);
  // compact first: anything cut since the last step is gone
  move(w, sdt);
}

// the end of a run in numbers (the end card's stats)
export function summary(w) {
  const s = w.stats;
  return {
    score: w.score,
    slain: s.slain,
    bestCombo: s.bestCombo,
    heartsSaved: s.heartsSaved,
    accuracy: s.resolved ? Math.round((100 * s.slain) / s.resolved) : 0,
    reason: w.reason,
  };
}
