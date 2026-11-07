// I'M NOT A ROBOT: more checks. HOLD… LET GO! (human timing), TAP ×5! (human enthusiasm), DON'T! (human restraint),
// SMILE! (drag the corners up), ODD ONE! (one of four differs), HOW MANY? (count the traffic lights).
import { TAU, clamp, done, fx, stepSel, KEYDIR, selRing, tile, scatter, wobble, OPTS } from './util.js';
import {
  INK, LW, C, SERIF, rr, inked, circle, words, sticker, cross, cat, robot, face, shape, trafficLight, tree, cone, lamp, button,
} from '../art.js';

// ======================================================================================= HOLD… LET GO!
const HG = { cx: 200, cy: 206, R: 148, band: 34, by: 300 };
export const hold = {
  id: 'hold', command: 'HOLD… LET GO!', hint: 'hold', keys: ['SPACE', 'HOLD'], time: 1.12,
  setup(level, r, o = OPTS) {
    return { c: r.range(0.5, 0.8), w: [0, 0.22, 0.16, 0.115][level], n: 0, speed: [0, 0.5, 0.62, 0.74][level] * o.speed, holding: false, let: -1, pressAt: -9 };
  },
  start(st) {
    if (st.holding || st.let >= 0) return;
    st.holding = true; st.pressAt = st.anim;
    fx(st, 'hold', HG.cx, HG.by);
  },
  release(st) {
    if (!st.holding) return;
    st.holding = false; st.let = st.anim;
    const x = HG.cx + Math.cos(Math.PI + st.n * Math.PI) * HG.R, y = HG.cy + Math.sin(Math.PI + st.n * Math.PI) * HG.R;
    if (Math.abs(st.n - st.c) <= st.w / 2) { fx(st, 'snap', x, y); done(st, 'pass'); }
    else { fx(st, 'bad', x, y); done(st, 'fail', st.n < st.c ? 'early' : 'late'); }
  },
  down(st) { this.start(st); },
  up(st) { this.release(st); },
  key(st, name) { if (name === 'act') { this.start(st); return; } return false; },
  keyUp(st, name) { if (name === 'act') this.release(st); },
  update(st, dt) {
    if (!st.holding) return;
    st.n += st.speed * dt * (1 + st.n * 0.7);
    if (st.n >= 1) { st.n = 1; st.holding = false; st.let = st.anim; fx(st, 'bad', HG.cx + HG.R, HG.cy); done(st, 'fail', 'late'); }
  },
  draw(g, st, v) {
    const { cx, cy, R, band } = HG;
    const arc = (a0, a1, fill) => {
      g.beginPath();
      g.arc(cx, cy, R + band / 2, Math.PI + a0 * Math.PI, Math.PI + a1 * Math.PI);
      g.arc(cx, cy, R - band / 2, Math.PI + a1 * Math.PI, Math.PI + a0 * Math.PI, true);
      g.closePath();
      inked(g, fill, LW);
    };
    // its shadow, then the band: robot grey, the human green, then too much
    g.save(); g.translate(2, 5); arc(0, 1, INK); g.restore();
    arc(0, 1, '#d9dcef');
    arc(Math.max(0, st.c - st.w / 2), Math.min(1, st.c + st.w / 2), C.mint);
    arc(Math.min(1, st.c + st.w / 2), 1, '#ffc2dc');
    // ticks
    g.beginPath();
    for (let i = 1; i < 10; i++) {
      const a = Math.PI + (i / 10) * Math.PI;
      g.moveTo(cx + Math.cos(a) * (R - band / 2 - 4), cy + Math.sin(a) * (R - band / 2 - 4));
      g.lineTo(cx + Math.cos(a) * (R - band / 2 - 12), cy + Math.sin(a) * (R - band / 2 - 12));
    }
    g.lineWidth = LW * 0.8; g.strokeStyle = INK; g.stroke();
    // the labels
    const za = Math.PI + st.c * Math.PI;
    sticker(g, 'HUMAN', cx + Math.cos(za) * (R - band / 2 - 34), cy + Math.sin(za) * (R - band / 2 - 30), 16, C.mint, { shadow: 0.06 });
    words(g, 'BOT', cx - R, cy + 24, 15, C.ink2, { weight: 800 });
    words(g, 'TOO MUCH', cx + R - 10, cy + 24, 13, C.ink2, { weight: 800 });
    // the needle
    const a = Math.PI + st.n * Math.PI, nl = R - 6;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * nl, cy + Math.sin(a) * nl);
    g.lineTo(cx + Math.cos(a + Math.PI / 2) * 9, cy + Math.sin(a + Math.PI / 2) * 9);
    g.lineTo(cx + Math.cos(a - Math.PI / 2) * 9, cy + Math.sin(a - Math.PI / 2) * 9);
    g.closePath(); inked(g, C.pink, LW);
    circle(g, cx, cy, 15); inked(g, C.honey);
    // the button
    const pulse = st.holding || st.let >= 0 ? 0 : (Math.sin(st.anim * 8) * 0.5 + 0.5);
    const bw = 210 + pulse * 8, bh = 56;
    button(g, cx - bw / 2, HG.by - bh / 2 + 6, bw, bh, st.holding ? 'HOLDING…' : st.let >= 0 ? 'LET GO' : 'HOLD', { fill: st.holding ? C.honey : C.white, press: st.holding ? 1 : 0, size: 22 });
  },
  bot(st, B) {
    if (!B.ready) return;
    B.go(HG.cx + 10, HG.by + 16);
    if (!st.holding && st.let < 0) { if (B.near(HG.cx + 10, HG.by + 16, 10)) B.press(); return; }
    const aim = B.blunder ? st.c - st.w * 1.1 : st.c - st.w * 0.12;
    if (st.n >= aim) B.release();
  },
};

// ======================================================================================= TAP ×5!
export const mash = {
  id: 'mash', command: (st) => `TAP ×${st.need}!`, hint: 'tap', keys: (st) => [`SPACE ×${st.need}`], time: 0.92,
  setup(level, r, o = OPTS) {
    return { r, need: [0, 5, 7, 9][level], n: 0, x: 200, y: 172, tx: 200, ty: 172, hop: [0, 0, 44, 88][level], squash: -9 };
  },
  tap(st) {
    st.n++; st.squash = st.anim;
    fx(st, 'mash', st.x, st.y, { n: st.n, of: st.need });
    if (st.n >= st.need) { done(st, 'pass'); return; }
    if (st.hop) {
      const a = st.r.range(0, TAU), d = st.r.range(st.hop * 0.6, st.hop);
      st.tx = clamp(st.x + Math.cos(a) * d, 120, 280); st.ty = clamp(st.y + Math.sin(a) * d, 118, 236);
    }
  },
  down(st, x, y) { if (Math.hypot(x - st.x, y - st.y) <= 100) this.tap(st); },
  key(st, name) { if (name === 'act') { this.tap(st); return; } return false; },
  update(st, dt) { const k = 1 - Math.exp(-20 * dt); st.x += (st.tx - st.x) * k; st.y += (st.ty - st.y) * k; },
  draw(g, st, v) {
    const s = clamp((st.anim - st.squash) / 0.16, 0, 1);
    const sq = s < 1 ? Math.sin(s * Math.PI) : 0;
    const R = 76;
    // the pips around it: one per tap
    for (let i = 0; i < st.need; i++) {
      const a = -Math.PI / 2 + (i / st.need) * TAU;
      const px = st.x + Math.cos(a) * (R + 30), py = st.y + Math.sin(a) * (R + 30);
      circle(g, px, py, 10); inked(g, i < st.n ? C.mint : C.white, LW * 0.9);
    }
    circle(g, st.x + 3, st.y + 8, R); g.fillStyle = INK; g.fill();
    g.save();
    g.translate(st.x, st.y + sq * 6);
    g.scale(1 + sq * 0.1, 1 - sq * 0.1);
    circle(g, 0, 0, R); inked(g, C.pink, LW + 0.6);
    circle(g, 0, 0, R - 12); g.lineWidth = LW * 0.8; g.strokeStyle = 'rgba(23,10,54,.25)'; g.stroke();
    sticker(g, 'TAP', 0, -24, 20, C.white, { shadow: 0.05 });
    sticker(g, String(Math.max(0, st.need - st.n)), 0, 16, 54, C.white, { shadow: 0.06 });
    g.restore();
    words(g, 'human enthusiasm required', 200, 340, 14, C.ink2, { family: SERIF, weight: 400 });
  },
  bot(st, B) {
    if (!B.ready) return;
    B.go(st.x + 8, st.y + 14);
    if (B.near(st.x + 8, st.y + 14, 30) && (!B.blunder || st.n < st.need - 2)) B.tap();
  },
};

// ======================================================================================= DON'T!
const TEASES = ['pls?', 'just once?', "it's so soft", 'no one would know', 'go on…', 'boop?', "i won't tell", 'one tiny tap'];
export const dont = {
  id: 'dont', command: "DON'T!", hint: 'none', keys: ['HANDS OFF'], time: 0.78, passOnTimeout: true, noBonus: true, boss: false,
  setup(level, r, o = OPTS) {
    return { r, x: 200, y: 176, tease: r.int(0, TEASES.length - 1), tt: 0, pressed: -1, follow: level === 3, wig: [0, 1, 1.6, 2][level] };
  },
  press(st) { st.pressed = st.anim; fx(st, 'bad', st.x, st.y); done(st, 'fail', 'pressed'); },
  down(st) { this.press(st); },
  key(st) { this.press(st); },
  update(st, dt, io) {
    st.tt += dt;
    if (st.tt > 0.75) { st.tt = 0; st.tease = (st.tease + 1) % TEASES.length; }
    if (st.follow && io.px > -900) {
      const k = 1 - Math.exp(-1.6 * dt);
      st.x += (clamp(io.px, 150, 250) - st.x) * k; st.y += (clamp(io.py, 140, 220) - st.y) * k;
    }
  },
  draw(g, st, v) {
    const pr = st.pressed >= 0 ? clamp((st.anim - st.pressed) / 0.12, 0, 1) : 0;
    const wig = Math.sin(st.anim * 9) * 0.035 * st.wig;
    const pulse = 1 + Math.sin(st.anim * 6) * 0.025;
    // its glow ring, breathing
    const ring = (st.anim * 1.4) % 1;
    g.save();
    g.globalAlpha = (1 - ring) * 0.5;
    rr(g, st.x - 150 - ring * 26, st.y - 72 - ring * 22, 300 + ring * 52, 144 + ring * 44, 40 + ring * 20);
    g.lineWidth = LW * 1.4; g.strokeStyle = C.pink; g.stroke();
    g.restore();
    g.save();
    g.translate(st.x, st.y);
    g.rotate(wig);
    g.scale(pulse, pulse);
    rr(g, -140, -62 + 10, 280, 124, 36); g.fillStyle = INK; g.fill();
    rr(g, -140, -62 + pr * 9, 280, 124, 36); inked(g, C.red, LW + 0.8);
    rr(g, -126, -52 + pr * 9, 252, 30, 15); g.fillStyle = 'rgba(255,255,255,.28)'; g.fill();
    sticker(g, "DON'T", 0, -10 + pr * 9, 54, C.white, { shadow: 0.06 });
    sticker(g, 'PRESS', 0, 34 + pr * 9, 24, C.white, { shadow: 0.06 });
    g.restore();
    // its little voice
    if (st.pressed < 0) {
      const t = TEASES[st.tease], bx = clamp(st.x + 92, 120, 310), by = st.y - 112;
      g.font = `italic 400 22px ${SERIF}`;
      const w = g.measureText(t).width + 30;
      rr(g, bx - w / 2, by - 21, w, 42, 18); inked(g, C.white, LW);
      g.beginPath(); g.moveTo(bx - 18, by + 19); g.lineTo(bx - 30, by + 36); g.lineTo(bx - 2, by + 19); g.closePath(); g.fillStyle = C.white; g.fill();
      g.beginPath(); g.moveTo(bx - 18, by + 20.5); g.lineTo(bx - 30, by + 36); g.lineTo(bx - 2, by + 20.5); g.lineWidth = LW; g.strokeStyle = INK; g.stroke();
      g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, bx, by + 1);
    }
    words(g, 'hands off. humans have self-control.', 200, 334, 14, C.ink2, { family: SERIF, weight: 400 });
  },
  bot(st, B, dt) {
    const m = B.mem;
    if (m.k == null) { m.k = 0; m.x0 = B.hand.x; m.y0 = B.hand.y; }
    const T = B.T;
    // closer… closer… (so tempted) …and away
    m.k = Math.min(1, m.k + dt * 0.9);
    const tempt = B.t < T * 0.62;
    const nx = st.x + 70, ny = st.y + 92;
    if (B.blunder && B.t > T * 0.4) { B.go(st.x + 10, st.y + 20); if (B.near(st.x + 10, st.y + 20, 14)) B.tap(); return; }
    if (tempt) B.go(m.x0 + (nx - m.x0) * m.k + Math.sin(B.t * 31) * 4, m.y0 + (ny - m.y0) * m.k + Math.cos(B.t * 27) * 3);
    else B.go(370, 340);
  },
};

// ======================================================================================= SMILE!
const SK = ['#ffd9bd', '#f2b98f', '#d18f62', '#a8673f', '#ffe6d1'];
const HR = ['#2b1d16', '#5a3725', '#e9c46a', '#c0503a', '#1b1b2f', '#8b5cf6'];
const SM = { cx: 200, cy: 168, s: 262 };
export const smile = {
  id: 'smile', command: 'SMILE!', hint: 'drag', keys: ['↑'], time: 1,
  setup(level, r, o = OPTS) {
    const c = [0, 0, -0.45, -0.7][level];
    return { c, show: c, decay: level === 3 ? 0.55 : 0, grab: null, happy: -1, skin: r.pick(SK), hair: r.pick(HR) };
  },
  set(st, c) {
    st.c = clamp(c, -1, 1);
    if (st.c >= 0.8) { st.happy = st.anim; fx(st, 'good', SM.cx, SM.cy + 50); done(st, 'pass'); }
  },
  down(st, x, y) { st.grab = { y0: y, c0: st.c }; fx(st, 'grab', x, y); },
  move(st, x, y) { if (st.grab) this.set(st, st.grab.c0 + (st.grab.y0 - y) / 62); },
  up(st) { st.grab = null; },
  key(st, name) {
    if (name === 'up') { this.set(st, st.c + 0.42); fx(st, 'tick', SM.cx, SM.cy + 60); return; }
    if (name === 'down') { this.set(st, st.c - 0.42); return; }
    return false;
  },
  update(st, dt) {
    if (st.decay && !st.grab) st.c = Math.max(-0.75, st.c - st.decay * dt);
    st.show += (st.c - st.show) * (1 - Math.exp(-22 * dt));
  },
  idle(st, dt) { st.show += (st.c - st.show) * (1 - Math.exp(-22 * dt)); },
  draw(g, st, v) {
    const happy = st.happy >= 0;
    face(g, SM.cx, SM.cy, SM.s, { smile: st.show, skin: st.skin, hair: st.hair, happy, blush: clamp((st.show - 0.3) * 1.6, 0, 1) });
    if (happy) return;
    // the mouth's corners: grab handles with a nudge upward
    const r = SM.s * 0.46, my = SM.cy + r * 0.45 - clamp(st.show, -1, 1) * r * 0.2;
    const bob = Math.sin(st.anim * 9) * 4;
    for (const sx of [-1, 1]) {
      const x = SM.cx + sx * r * 0.46;
      circle(g, x, my, 9); inked(g, C.honey, LW * 0.9);
      // a fat arrow beside the face: up!
      const ax = SM.cx + sx * (r + 42), ay = SM.cy + r * 0.4 - bob;
      g.beginPath();
      g.moveTo(ax, ay - 30); g.lineTo(ax + 17, ay - 10); g.lineTo(ax + 7, ay - 10); g.lineTo(ax + 7, ay + 22);
      g.lineTo(ax - 7, ay + 22); g.lineTo(ax - 7, ay - 10); g.lineTo(ax - 17, ay - 10); g.closePath();
      inked(g, C.honey, LW);
    }
  },
  bot(st, B) {
    if (!B.ready) return;
    const r = SM.s * 0.46, x = SM.cx + r * 0.46, my = SM.cy + r * 0.45 - st.show * r * 0.2;
    const m = B.mem;
    if (m.gaveUp) { B.go(x + 60, my + 90); return; }
    if (!st.grab) { B.go(x + 4, my + 6); if (B.near(x + 4, my + 6, 8)) { B.press(); m.y0 = my + 6; } return; }
    B.go(x + 4, m.y0 - (B.blunder ? 40 : 150));
    // (a blunder: a shy little half-smile, then it lets go)
    if (B.blunder && B.settled(2)) { B.release(); m.gaveUp = true; }
  },
};

// ======================================================================================= ODD ONE!
const SHAPES = ['circle', 'square', 'triangle', 'star', 'heart', 'diamond'];
const FILLS = [C.honey, C.sky, C.pink, C.mint, C.lav2, C.orange];
export function makeOdd(level, r) {
  const odd = r.int(0, 3);
  let items;
  if (level === 1) {
    const [a, b] = r.shuffle(SHAPES.slice()).slice(0, 2), fill = r.pick(FILLS);
    items = [0, 1, 2, 3].map((i) => ({ kind: i === odd ? b : a, fill, rot: 0, detail: 0 }));
  } else if (level === 2) {
    const kind = r.pick(['arrow', 'triangle', 'moon', 'heart']), rot = (r.int(0, 3) * Math.PI) / 2, fill = r.pick(FILLS);
    items = [0, 1, 2, 3].map((i) => ({ kind, fill, rot: i === odd ? rot + Math.PI : rot, detail: 0 }));
  } else {
    const kind = r.pick(['cat', 'robot', 'face']);
    items = [0, 1, 2, 3].map((i) => ({ kind, fill: null, rot: 0, detail: i === odd ? 1 : 0 }));
  }
  return { items, odd };
}
// the one that's different from the rest (-1: none, or more than one)
export function oddOut(items) {
  const sig = (it) => `${it.kind}|${Math.round(((it.rot % TAU) + TAU) % TAU * 100)}|${it.detail}`;
  const count = new Map();
  for (const it of items) count.set(sig(it), (count.get(sig(it)) || 0) + 1);
  const singles = items.map((it, i) => (count.get(sig(it)) === 1 ? i : -1)).filter((i) => i >= 0);
  return singles.length === 1 && count.size === 2 ? singles[0] : -1;
}
const OD = { x: 40, y: 16, w: 152, h: 150, gx: 16, gy: 14 };
const oddXY = (i) => ({ x: OD.x + (i % 2) * (OD.w + OD.gx), y: OD.y + Math.floor(i / 2) * (OD.h + OD.gy) });
export const odd = {
  id: 'odd', command: 'ODD ONE!', hint: 'tap', keys: ['1 2 3 4'], time: 1.05,
  setup(level, r, o = OPTS) {
    const { items, odd: k } = makeOdd(level, r);
    return { items, odd: k, cur: 0, kb: Boolean(o.kb), pick: -1, pickAt: -9, ph: items.map(() => r.range(0, TAU)), centers: items.map((_, i) => ({ x: oddXY(i).x + OD.w / 2, y: oddXY(i).y + OD.h / 2 })) };
  },
  choose(st, i) {
    if (i < 0 || i > 3) return;
    st.pick = i; st.pickAt = st.anim;
    const c = st.centers[i];
    if (i === st.odd) { fx(st, 'good', c.x, c.y); done(st, 'pass'); } else { fx(st, 'bad', c.x, c.y); done(st, 'fail', 'wrong'); }
  },
  down(st, x, y) {
    for (let i = 0; i < 4; i++) { const p = oddXY(i); if (x >= p.x - 6 && x <= p.x + OD.w + 6 && y >= p.y - 6 && y <= p.y + OD.h + 6) { this.choose(st, i); return; } }
  },
  key(st, name) {
    if (name.startsWith('n:')) { st.kb = true; this.choose(st, Number(name.slice(2)) - 1); return; }
    if (KEYDIR.has(name)) { if (st.kb) st.cur = stepSel(st.centers, st.cur, name); st.kb = true; return; }
    if (name === 'act') { if (st.kb) this.choose(st, st.cur); st.kb = true; return; }
    return false;
  },
  draw(g, st, v) {
    for (let i = 0; i < 4; i++) {
      const p = oddXY(i), it = st.items[i];
      const picked = st.pick === i, good = picked && i === st.odd, bad = picked && i !== st.odd;
      g.save();
      g.translate(bad ? wobble(st.anim - st.pickAt) : 0, 0);
      tile(g, p.x, p.y, OD.w, OD.h, good ? '#d4fff2' : bad ? '#ffd0e4' : C.paper, 18);
      const cx = p.x + OD.w / 2, cy = p.y + OD.h / 2 + Math.sin(st.anim * 3 + st.ph[i]) * 3;
      if (it.kind === 'cat') cat(g, cx, cy + 6, 104, { blink: it.detail });
      else if (it.kind === 'robot') robot(g, cx, cy + 4, 112, { blink: it.detail, eye: C.mint });
      else if (it.kind === 'face') face(g, cx, cy, 104, { smile: it.detail ? -0.7 : 0.6 });
      else shape(g, it.kind, cx, cy, 96, it.fill, it.rot);
      if (v.kb || st.kb) { circle(g, p.x + 20, p.y + 20, 13); inked(g, C.white, LW * 0.8); words(g, String(i + 1), p.x + 20, p.y + 21, 15, INK, { weight: 800 }); }
      if (bad) cross(g, cx, cy, 70);
      g.restore();
    }
    if (st.kb) { const p = oddXY(st.cur); selRing(g, p.x, p.y, OD.w, OD.h, v.t, 18); }
  },
  bot(st, B) {
    if (!B.ready) return;
    const i = B.blunder ? (st.odd + 1) % 4 : st.odd, c = st.centers[i];
    B.go(c.x + 8, c.y + 14);
    if (B.near(c.x + 8, c.y + 14, 12)) B.tap();
  },
};

// ======================================================================================= HOW MANY?
const ST = { x: 20, y: 12, w: 360, h: 226, road: 176 };
const DRAW = { light: trafficLight, tree, cone, lamp };
export function makeStreet(level, r) {
  const n = level === 1 ? r.int(2, 3) : level === 2 ? r.int(2, 4) : r.int(3, 5);
  const opts = level === 3 ? [3, 4, 5] : [2, 3, 4];
  const extra = [0, 2, 3, 4][level];
  const size = [0, 82, 72, 62][level];
  const kinds = [];
  for (let i = 0; i < n; i++) kinds.push('light');
  for (let i = 0; i < extra; i++) kinds.push(r.pick(['tree', 'cone', 'lamp', 'tree']));
  const pts = scatter(r, kinds.length, { x0: 48, x1: 352, y0: 84, y1: 184, gap: size * 0.82 });
  // back to front, and every traffic light in front of the rest (counting is fair: none hides behind a tree)
  const objs = kinds.map((kind, i) => ({ kind, x: pts[i].x, y: pts[i].y, s: size * r.range(0.92, 1.04) }))
    .sort((a, b) => (a.kind === 'light') - (b.kind === 'light') || a.y - b.y);
  return { objs, n, opts };
}
export const countOf = (objs, kind = 'light') => objs.filter((o) => o.kind === kind).length;
const ANS = { y: 252, w: 104, h: 76, gap: 14 };
const ansX = (i) => 30 + i * (ANS.w + ANS.gap);
export const count = {
  id: 'count', command: 'HOW MANY?', hint: 'tap', keys: ['2 3 4'], time: 1.25,
  setup(level, r, o = OPTS) {
    const s = makeStreet(level, r);
    return { ...s, pick: -1, pickAt: -9, ask: 'traffic lights' };
  },
  choose(st, i) {
    if (i < 0) return;
    st.pick = i; st.pickAt = st.anim;
    const x = ansX(i) + ANS.w / 2;
    if (st.opts[i] === st.n) { fx(st, 'good', x, ANS.y + ANS.h / 2); done(st, 'pass'); } else { fx(st, 'bad', x, ANS.y + ANS.h / 2); done(st, 'fail', 'wrong'); }
  },
  down(st, x, y) {
    if (y < ANS.y - 14 || y > ANS.y + ANS.h + 14) return;
    for (let i = 0; i < 3; i++) if (x >= ansX(i) - 7 && x <= ansX(i) + ANS.w + 7) { this.choose(st, i); return; }
  },
  key(st, name) {
    if (name.startsWith('n:')) { this.choose(st, st.opts.indexOf(Number(name.slice(2)))); return; }
    return false;
  },
  draw(g, st, v) {
    // the street
    g.save();
    rr(g, ST.x, ST.y, ST.w, ST.h, 16); g.clip();
    g.fillStyle = '#d9f1ff'; g.fillRect(ST.x, ST.y, ST.w, ST.h);
    g.fillStyle = '#c7cde0'; g.fillRect(ST.x, ST.road, ST.w, ST.h);
    g.fillStyle = '#b3bad1'; g.fillRect(ST.x, ST.road, ST.w, 8);
    g.setLineDash([22, 16]); g.lineWidth = 5; g.strokeStyle = C.white;
    g.beginPath(); g.moveTo(ST.x, ST.road + 34); g.lineTo(ST.x + ST.w, ST.road + 34); g.stroke(); g.setLineDash([]);
    for (const o of st.objs) DRAW[o.kind](g, o.x, o.y, o.s);
    g.restore();
    rr(g, ST.x, ST.y, ST.w, ST.h, 16); inked(g, null, LW);
    // the question, small, in the corner
    rr(g, ST.x + 10, ST.y + 10, 154, 30, 15); inked(g, C.white, LW * 0.8);
    trafficLight(g, ST.x + 28, ST.y + 23, 22);
    words(g, 'how many?', ST.x + 98, ST.y + 26, 15, INK, { weight: 800 });
    for (let i = 0; i < 3; i++) {
      const picked = st.pick === i, good = picked && st.opts[i] === st.n;
      const x = ansX(i) + (picked && !good ? wobble(st.anim - st.pickAt) : 0);
      button(g, x, ANS.y, ANS.w, ANS.h, String(st.opts[i]), { fill: picked ? (good ? C.mint : '#ff9cc7') : C.white, press: picked ? 1 : 0, size: 40, r: 18 });
      if (v.kb) words(g, `key ${st.opts[i]}`, x + ANS.w / 2, ANS.y + ANS.h + 18, 12, C.ink2, { weight: 700 });
    }
  },
  bot(st, B, dt) {
    const m = B.mem;
    if (!m.path) {
      m.path = st.objs.filter((o) => o.kind === 'light').map((o) => ({ x: o.x + 4, y: o.y + 4, look: true }));
      const want = B.blunder ? st.opts.find((v) => v !== st.n) : st.n;
      const i = st.opts.indexOf(want);
      m.path.push({ x: ansX(i) + ANS.w / 2 + 6, y: ANS.y + ANS.h / 2 + 10, look: false });
      m.dwell = 0;
    }
    if (!B.ready) return;
    const p = m.path[0];
    B.go(p.x, p.y);
    if (p.look) { if (B.near(p.x, p.y, 22)) { m.dwell += dt; if (m.dwell > 0.03) { m.path.shift(); m.dwell = 0; } } return; }
    if (B.near(p.x, p.y, 12)) B.tap();
  },
};
