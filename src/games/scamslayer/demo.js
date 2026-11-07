// SCAM SLAYER: the game playing itself (the ?demo preview and the title screen's background). Pure: it reads the world,
// predicts where everything will be, and swipes through it with the same blade calls a player's finger makes, so it can
// only do what a player can. It looks for the line through the most scams that keeps clear of every heart and rug, waits
// a moment when a better line is coming (a row of scams reaching the top together), and swipes like a hand: a slight arc,
// slow-fast-slow, a little overshoot. Seeded: the same seed plays the same game.
import { rng } from '../kit/fx.js';
import { bladeDown, bladeMove, bladeUp } from './engine.js';
import { HIT } from './kinds.js';
import { segDist } from './geom.js';

// where an object will be `tau` seconds from now (the world's own time scale: slower while frozen)
function pos(o, tau, ts) {
  const t = tau * ts;
  return { x: o.x + o.vx * t, y: o.y + o.vy * t + 0.5 * o.g * t * t };
}

// slow-fast-slow, never stopping (part linear, so the blade is always fast enough to cut)
const ease = (u) => 0.55 * u + 0.45 * (0.5 - 0.5 * Math.cos(Math.PI * u));
function easeInv(s) {
  let lo = 0, hi = 1;
  for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (ease(m) < s) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

function bez(p0, p1, p2, s) {
  const a = (1 - s) * (1 - s), b = 2 * (1 - s) * s, c = s * s;
  return { x: a * p0.x + b * p1.x + c * p2.x, y: a * p0.y + b * p1.y + c * p2.y };
}

const LEADS = [0, 0.1, 0.2, 0.32, 0.45];

export function createBot(seed, opts = {}) {
  const r = rng(seed >>> 0 || 7);
  const relaxed = Boolean(opts.relaxed);      // the title screen's: a little lazier
  const bot = {
    id: opts.id || 'bot',
    phase: 'rest',
    wait: opts.firstWait ?? 0.2,
    patience: 0,
    t: 0, dur: 0.15, p0: null, p1: null, p2: null,
    swipes: 0,
  };

  const onScreen = (w, p, o) => p.x > o.r * 0.5 && p.x < w.W - o.r * 0.5 && p.y > w.top + o.r * 0.2 && p.y < w.H - o.r * 0.55;

  // the best swipe if it started `lead` seconds from now → { members, p0, p1, p2, dur, score } or null
  function bestSwipe(w, lead, targets, hazards) {
    const ts = w.ts;
    const at = (o, tau) => pos(o, lead + tau, ts);
    const now = [];
    for (const o of targets) {
      const p = at(o, 0.05);
      if (onScreen(w, p, o)) now.push({ o, p });
    }
    if (!now.length) return null;
    let best = null;
    const speed = relaxed ? 1500 : 2000;
    const tryLine = (ax, ay, dx, dy) => {
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      // who's on this line
      let members = [];
      for (const t of now) {
        const px = t.p.x - ax, py = t.p.y - ay;
        const perp = Math.abs(px * -uy + py * ux);
        if (perp <= t.o.r * HIT.scam * 0.62) members.push({ ...t, s: px * ux + py * uy });
      }
      if (!members.length) return;
      members.sort((m1, m2) => m1.s - m2.s);
      // refine twice: where each member really is when the blade gets to it
      let p0, p2, dur = 0.15, lx = ux, ly = uy;
      for (let it = 0; it < 3; it++) {
        const f = members[0], l = members[members.length - 1];
        const fx = f.p.x, fy = f.p.y, ex = l.p.x, ey = l.p.y;
        let dx2 = ex - fx, dy2 = ey - fy;
        let L2 = Math.hypot(dx2, dy2);
        if (L2 < 1) { dx2 = lx; dy2 = ly; L2 = 1; }
        lx = dx2 / L2; ly = dy2 / L2;
        const ext = f.o.r * 1.45;
        p0 = { x: fx - lx * ext, y: fy - ly * ext };
        p2 = { x: ex + lx * (l.o.r * 1.45), y: ey + ly * (l.o.r * 1.45) };
        const L = Math.hypot(p2.x - p0.x, p2.y - p0.y);
        dur = Math.max(0.08, Math.min(0.26, L / speed));
        for (const m of members) {
          const s = ((m.p.x - p0.x) * lx + (m.p.y - p0.y) * ly) / L;
          m.tau = easeInv(Math.max(0, Math.min(1, s))) * dur;
          m.p = at(m.o, m.tau);
        }
      }
      // everyone still on the line when the blade passes?
      const L = Math.hypot(p2.x - p0.x, p2.y - p0.y) || 1;
      members = members.filter((m) => segDist(p0.x, p0.y, p2.x, p2.y, m.p.x, m.p.y) <= m.o.r * HIT.scam * 0.78);
      if (!members.length) return;
      // keep clear of hearts and rugs all along the swipe (where they will be at each moment)
      let prev = p0;
      for (let k = 1; k <= 14; k++) {
        const u = k / 14, q = { x: p0.x + (p2.x - p0.x) * ease(u), y: p0.y + (p2.y - p0.y) * ease(u) };
        for (const h of hazards) {
          const hp = at(h, u * dur);
          const need = h.r * HIT[h.role] + 26 + h.r * 0.25;
          if (segDist(prev.x, prev.y, q.x, q.y, hp.x, hp.y) < need) return;
        }
        prev = q;
      }
      let score = 0;
      for (const m of members) {
        score += 10;
        if (m.o.kind === 'golden') score += 14;
        if (m.o.role === 'power') score += 9;
        if (m.o.vy > 0 && m.o.y > w.H - m.o.r * 3.2) score += 4;       // about to get away
      }
      score -= L * 0.004;
      if (!best || score > best.score) best = { members, p0, p2, dur, score, lead };
    };
    // lines through every pair, and through each one alone (a few angles)
    for (let i = 0; i < now.length; i++) {
      for (let j = i + 1; j < now.length; j++) tryLine(now[i].p.x, now[i].p.y, now[j].p.x - now[i].p.x, now[j].p.y - now[i].p.y);
      const o = now[i].o;
      const base = Math.atan2(o.vy, o.vx) + Math.PI / 2;
      for (const a of [0, 0.7, -0.7, 1.4]) tryLine(now[i].p.x, now[i].p.y, Math.cos(base + a), Math.sin(base + a));
    }
    return best;
  }

  function plan(w) {
    const targets = [], hazards = [];
    for (const o of w.objs) {
      if (o.dead) continue;
      if (o.role === 'heart' || o.role === 'rug') hazards.push(o); else targets.push(o);
    }
    if (!targets.length) return null;
    let first = null, top = null;
    for (const lead of LEADS) {
      const b = bestSwipe(w, lead, targets, hazards);
      if (!b) continue;
      if (lead === 0) first = b;
      if (!top || b.members.length > top.members.length) top = b;
    }
    if (!top) return null;
    // a bigger combo is coming: wait for it (unless something is about to get away)
    const urgent = targets.some((o) => o.vy > 0 && o.y > w.H - o.r * 3.4);
    if (top.lead > 0 && (!first || top.members.length > first.members.length) && !urgent && bot.patience < 0.7) {
      return { wait: Math.max(0.03, top.lead * 0.7) };
    }
    return first || { wait: 0.04 };
  }

  // a swipe as a stroke: a slight arc from p0 to p2
  function stroke(s) {
    const L = Math.hypot(s.p2.x - s.p0.x, s.p2.y - s.p0.y);
    const nx = -(s.p2.y - s.p0.y) / (L || 1), ny = (s.p2.x - s.p0.x) / (L || 1);
    const bend = r.range(-0.07, 0.07) * L;
    return { p0: s.p0, p1: { x: (s.p0.x + s.p2.x) / 2 + nx * bend, y: (s.p0.y + s.p2.y) / 2 + ny * bend }, p2: s.p2, dur: s.dur, eased: true };
  }

  function start(w, s) {
    bot.segs = [stroke(s)]; bot.k = 0; bot.t = 0;
    bot.phase = 'swipe';
    bot.patience = 0;
    bot.chains = 0;
    bot.swipes++;
    bladeDown(w, bot.id, s.p0.x, s.p0.y, w.clock * 1000);
  }

  // Mid-combo, carry straight on into the next line without lifting the blade (a zig-zag) when that's safe: a quick
  // connecting flick, then the next stroke, timed for where everything will be by then.
  function chain(w, from) {
    const targets = [], hazards = [];
    for (const o of w.objs) {
      if (o.dead) continue;
      if (o.role === 'heart' || o.role === 'rug') hazards.push(o); else targets.push(o);
    }
    if (!targets.length) return false;
    let lead = 0.07, s = null;
    for (let it = 0; it < 2; it++) {
      s = bestSwipe(w, lead, targets, hazards);
      if (!s) return false;
      const want = Math.max(0.04, Math.min(0.12, Math.hypot(s.p0.x - from.x, s.p0.y - from.y) / 4200));
      if (Math.abs(want - lead) < 0.012) break;
      lead = want;
    }
    const dist = Math.hypot(s.p0.x - from.x, s.p0.y - from.y);
    if (dist > Math.max(w.W, w.H) * 0.6) return false;
    // the flick cuts too: it must keep clear of hearts and rugs
    let prev = from;
    for (let k = 1; k <= 8; k++) {
      const u = k / 8, q = { x: from.x + (s.p0.x - from.x) * u, y: from.y + (s.p0.y - from.y) * u };
      for (const h of hazards) {
        const hp = pos(h, u * lead, w.ts);
        if (segDist(prev.x, prev.y, q.x, q.y, hp.x, hp.y) < h.r * HIT[h.role] + 26 + h.r * 0.25) return false;
      }
      prev = q;
    }
    bot.segs = [{ p0: from, p1: { x: (from.x + s.p0.x) / 2, y: (from.y + s.p0.y) / 2 }, p2: s.p0, dur: lead, eased: false }, stroke(s)];
    bot.k = 0; bot.t = 0;
    bot.chains++;
    return true;
  }

  bot.update = (w, dt) => {
    if (w.over) {
      if (bot.phase === 'swipe') { bladeUp(w, bot.id); bot.phase = 'rest'; }
      return;
    }
    if (bot.phase === 'swipe') {
      if (w.hitstop > 0) return;                       // the blade waits out a hit-stop with the world
      const seg = bot.segs[bot.k];
      bot.t += dt;
      const u = Math.min(1, bot.t / seg.dur);
      const p = bez(seg.p0, seg.p1, seg.p2, seg.eased ? ease(u) : u);
      bladeMove(w, bot.id, p.x, p.y, (w.clock + dt) * 1000);
      if (u >= 1) {
        bot.k++; bot.t = 0;
        if (bot.k < bot.segs.length) return;
        if (!relaxed && bot.chains < 3 && chain(w, p)) return;
        bladeUp(w, bot.id);
        bot.phase = 'rest';
        bot.wait = relaxed ? r.range(0.12, 0.3) : r.range(0.03, 0.09);
      }
      return;
    }
    bot.wait -= dt;
    if (bot.wait > 0 || w.hitstop > 0) return;
    const p = plan(w);
    if (!p) { bot.wait = 0.05; return; }
    if (p.wait) { bot.wait = p.wait; bot.patience += p.wait; return; }
    start(w, p);
  };
  return bot;
}
