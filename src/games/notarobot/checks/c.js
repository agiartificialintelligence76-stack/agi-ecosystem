// I'M NOT A ROBOT: the last checks. CATCH IT! (the falling check into its box), SWAT! (bugs on the form), STEADY! (a
// shaky cursor on a tiny box), IN ORDER! (1, 2, 3…), SHAKE NO! (are you a robot? no, no, no), SIGN IT! (a squiggle on
// the line), WAIT… TAP! (only on green).
import { W, H, TAU, clamp, done, fx, kcursor, moveKcursor, KEYDIR, tile, scatter, wobble, OPTS } from './util.js';
import { INK, LW, C, SERIF, MONO, DISPLAY, rr, inked, circle, words, sticker, check, cross, arrowCursor, bug, face } from '../art.js';

// ======================================================================================= CATCH IT!
const BOXY = 296;
export const catchit = {
  id: 'catch', command: 'CATCH IT!', hint: 'drag', keys: ['←', '→'], time: 1, noBonus: true, boss: false,
  setup(level, r, o = OPTS) {
    const land = clamp(o.T * 0.6, 1.15, 2.3);
    const y0 = -26, yl = BOXY - 8;
    const x0 = r.range(70, 330);
    return {
      x: x0, x0, y: y0, vy: 0, g: (2 * (yl - y0)) / (land * land), vx: level === 3 ? r.sign() * r.range(85, 120) : 0,
      drift: level === 2 ? r.range(50, 75) : 0, ph: r.range(0, TAU), bx: 200, btx: 200, bw: [0, 128, 112, 98][level], caught: -1, missed: -1, spin: 0, kmove: false,
    };
  },
  fall(st, dt) {
    st.vy += st.g * dt; st.y += st.vy * dt;
    if (st.drift) st.x = st.x0 + Math.sin(st.t * 3.2 + st.ph) * st.drift;
    if (st.vx) {
      st.x += st.vx * dt;
      if (st.x < 34) { st.x = 34; st.vx = Math.abs(st.vx); }
      if (st.x > W - 34) { st.x = W - 34; st.vx = -Math.abs(st.vx); }
    }
    st.spin += dt * 2.5;
  },
  update(st, dt, io) {
    const dir = (io.held('right') ? 1 : 0) - (io.held('left') ? 1 : 0);
    if (dir) { st.btx = clamp(st.bx + dir * 60, st.bw / 2, W - st.bw / 2); st.kmove = true; }
    else if (!st.kmove && io.px > -900 && (io.pdown || io.ptype !== 'touch')) st.btx = io.px;
    else if (st.kmove && io.pdown) { st.kmove = false; st.btx = io.px; }
    const k = 1 - Math.exp(-(dir ? 9 : 18) * dt);
    st.bx = clamp(st.bx + (st.btx - st.bx) * k, st.bw / 2, W - st.bw / 2);
    this.fall(st, dt);
    if (st.y >= BOXY - 8) {
      if (Math.abs(st.x - st.bx) <= st.bw / 2 + 10) { st.caught = st.anim; st.y = BOXY - 8; st.vy = 0; fx(st, 'snap', st.x, BOXY); done(st, 'pass'); }
      else { st.missed = st.anim; fx(st, 'bad', st.x, BOXY); done(st, 'fail', 'missed'); }
    }
  },
  idle(st, dt) { if (st.missed >= 0 && st.y < H + 60) this.fall(st, dt); },
  // where it will cross the box's line (the demo's hand reads it, like a player's eye)
  landing(st) {
    const s = { ...st };
    for (let i = 0; i < 600 && s.y < BOXY - 8; i++) { s.t += 1 / 60; this.fall(s, 1 / 60); }
    return s.x;
  },
  draw(g, st, v) {
    // a guide line under it
    if (st.caught < 0 && st.missed < 0) {
      g.save(); g.setLineDash([4, 9]); g.lineWidth = LW * 0.8; g.strokeStyle = C.lav2;
      g.beginPath(); g.moveTo(st.x, st.y + 30); g.lineTo(st.x, BOXY - 4); g.stroke(); g.restore();
    }
    // the box (behind the check once caught, in front of its back flap)
    const bx = st.bx, bw = st.bw;
    g.beginPath(); g.moveTo(bx - bw / 2, BOXY); g.lineTo(bx - bw / 2 - 18, BOXY - 26); g.lineTo(bx - bw / 2 + 10, BOXY - 22); g.lineTo(bx - bw / 2 + 16, BOXY); g.closePath(); inked(g, '#e8b878');
    g.beginPath(); g.moveTo(bx + bw / 2, BOXY); g.lineTo(bx + bw / 2 + 18, BOXY - 26); g.lineTo(bx + bw / 2 - 10, BOXY - 22); g.lineTo(bx + bw / 2 - 16, BOXY); g.closePath(); inked(g, '#e8b878');
    rr(g, bx - bw / 2, BOXY - 8, bw, 12, 4); g.fillStyle = '#7d5a2f'; g.fill();
    const sp = st.caught >= 0 ? 0 : Math.sin(st.spin) * 0.35;
    if (st.caught >= 0) {
      const k = clamp((st.anim - st.caught) / 0.2, 0, 1);
      g.save(); g.translate(st.x, BOXY - 14 + k * 8); check(g, 0, 0, 58); g.restore();
    }
    rr(g, bx - bw / 2 + 3, BOXY + 5, bw, 52, 8); g.fillStyle = INK; g.fill();
    rr(g, bx - bw / 2, BOXY, bw, 52, 8); inked(g, C.tan);
    words(g, 'INBOX', bx, BOXY + 27, 15, '#6b4a26', { family: DISPLAY, weight: 900, stretch: 'expanded' });
    if (st.caught < 0) {
      g.save(); g.translate(st.x, st.y); g.rotate(sp); check(g, 0, 0, 62); g.restore();
    }
    if (st.kmove || v.kb) { words(g, '←  →', bx, BOXY + 66, 13, C.ink2, { family: MONO, weight: 700 }); }
  },
  bot(st, B) {
    if (!B.ready) { B.go(st.bx, BOXY + 18); return; }
    let x = this.landing(st);
    if (B.blunder) x = x < 200 ? x + st.bw + 30 : x - st.bw - 30;
    B.go(clamp(x, 40, 360), BOXY + 22);
  },
};

// ======================================================================================= SWAT!
export const swat = {
  id: 'swat', command: (st) => `SWAT ${st.need}!`, hint: 'tap', keys: ['←↑↓→', 'SPACE'], time: 1.18,
  setup(level, r, o = OPTS) {
    const n = [0, 3, 4, 5][level], sp = [0, 70, 100, 130][level] * o.speed;
    const pts = scatter(r, n, { x0: 60, x1: 340, y0: 90, y1: 310, gap: 80 });
    return {
      r, need: [0, 3, 3, 4][level], got: 0, kc: { ...kcursor(200, 300), on: Boolean(o.kb) }, jerky: level === 3,
      bugs: pts.map((p) => ({ x: p.x, y: p.y, a: r.range(0, TAU), turn: 0, sp: sp * r.range(0.85, 1.2), dead: -1 })),
      whiffs: [],
    };
  },
  swatAt(st, x, y, rad = 38) {
    let best = null, bd = rad;
    for (const b of st.bugs) { if (b.dead >= 0) continue; const d = Math.hypot(b.x - x, b.y - y); if (d <= bd) { bd = d; best = b; } }
    if (!best) { st.whiffs.push({ x, y, at: st.anim }); fx(st, 'whiff', x, y); return; }
    best.dead = st.anim; st.got++;
    fx(st, 'splat', best.x, best.y, { n: st.got });
    if (st.got >= st.need) done(st, 'pass');
  },
  down(st, x, y) { this.swatAt(st, x, y); },
  key(st, name) {
    if (KEYDIR.has(name)) { st.kc.on = true; return; }
    if (name === 'act') { if (st.kc.on) this.swatAt(st, st.kc.x, st.kc.y, 44); st.kc.on = true; return; }
    return false;
  },
  move(st, dt) {
    for (const b of st.bugs) {
      if (b.dead >= 0) continue;
      b.turn += (st.r.next() - 0.5) * 9 * dt; b.turn = clamp(b.turn, -2.6, 2.6);
      if (st.jerky && st.r.chance(dt * 1.2)) b.a += st.r.range(1.2, 2.2) * st.r.sign();
      b.a += b.turn * dt;
      b.x += Math.cos(b.a) * b.sp * dt; b.y += Math.sin(b.a) * b.sp * dt;
      if (b.x < 30) { b.x = 30; b.a = Math.PI - b.a; } if (b.x > W - 30) { b.x = W - 30; b.a = Math.PI - b.a; }
      if (b.y < 70) { b.y = 70; b.a = -b.a; } if (b.y > H - 26) { b.y = H - 26; b.a = -b.a; }
    }
  },
  update(st, dt, io) {
    this.move(st, dt);
    moveKcursor(st.kc, io, dt, 500);
    // the keyboard's swatter is drawn to the nearest bug
    if (st.kc.on) {
      let best = null, bd = 64;
      for (const b of st.bugs) { if (b.dead >= 0) continue; const d = Math.hypot(b.x - st.kc.x, b.y - st.kc.y); if (d < bd) { bd = d; best = b; } }
      if (best) { const k = 1 - Math.exp(-7 * dt); st.kc.x += (best.x - st.kc.x) * k; st.kc.y += (best.y - st.kc.y) * k; }
    }
  },
  idle(st, dt) { if (!st.done || st.done === 'fail') this.move(st, dt); },
  draw(g, st, v) {
    // the form they crawl on
    rr(g, 24, 18, 352, 324, 14); inked(g, C.white, LW);
    words(g, 'CONTACT FORM', 44, 42, 14, C.ink2, { family: DISPLAY, weight: 900, align: 'left', stretch: 'expanded' });
    for (const [i, label] of ['name', 'email', 'message'].entries()) {
      const y = 84 + i * 82;
      words(g, label, 46, y, 14, C.ink2, { align: 'left', weight: 650 });
      rr(g, 44, y + 12, 312, i === 2 ? 70 : 38, 10); g.lineWidth = LW * 0.8; g.strokeStyle = '#c9c1e6'; g.stroke();
    }
    for (const w of st.whiffs) {
      const k = (st.anim - w.at) / 0.35;
      if (k > 1) continue;
      circle(g, w.x, w.y, 16 + k * 18); g.lineWidth = LW * (1 - k); g.strokeStyle = C.lav2; g.stroke();
    }
    for (const b of st.bugs) {
      if (b.dead >= 0) {
        const k = clamp((st.anim - b.dead) / 0.12, 0, 1);
        g.save(); g.globalAlpha = 0.9;
        // splat: ink drops around it
        for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.4; circle(g, b.x + Math.cos(a) * 24 * k, b.y + Math.sin(a) * 24 * k, 4.5 * k); g.fillStyle = C.lav2; g.fill(); }
        g.restore();
        bug(g, b.x, b.y, 40, b.a, 0, { splat: k });
        continue;
      }
      bug(g, b.x, b.y, 40, b.a, st.anim);
    }
    // how many left
    for (let i = 0; i < st.need; i++) {
      const x = 352 - (st.need - 1 - i) * 22, y = 40;
      circle(g, x, y, 8); inked(g, i < st.got ? C.mint : C.white, LW * 0.8);
    }
    if (st.kc.on) {
      const x = st.kc.x, y = st.kc.y;
      circle(g, x, y, 22); g.lineWidth = LW * 2.4; g.strokeStyle = INK; g.stroke(); g.lineWidth = LW * 1.2; g.strokeStyle = C.honey; g.stroke();
      g.beginPath(); g.moveTo(x - 30, y); g.lineTo(x - 14, y); g.moveTo(x + 14, y); g.lineTo(x + 30, y); g.moveTo(x, y - 30); g.lineTo(x, y - 14); g.moveTo(x, y + 14); g.lineTo(x, y + 30);
      g.lineWidth = LW; g.strokeStyle = INK; g.stroke();
    }
  },
  bot(st, B) {
    if (!B.ready) return;
    let best = null, bd = Infinity;
    for (const b of st.bugs) { if (b.dead >= 0) continue; const d = Math.hypot(b.x - B.hand.x, b.y - B.hand.y); if (d < bd) { bd = d; best = b; } }
    if (!best) return;
    const lead = 0.09, tx = best.x + Math.cos(best.a) * best.sp * lead, ty = best.y + Math.sin(best.a) * best.sp * lead;
    if (B.blunder && st.got >= st.need - 1) { B.go(tx + 60, ty + 50); return; }
    B.go(tx, ty);
    if (B.near(best.x, best.y, 14)) B.tap();
  },
};

// ======================================================================================= STEADY!
export const steady = {
  id: 'steady', command: 'STEADY!', hint: 'tap', keys: ['←↑↓→', 'SPACE'], time: 1.18, cursor: 'none', hand: false,
  setup(level, r, o = OPTS) {
    return {
      tx: r.range(110, 290), ty: r.range(120, 250), tr: [0, 15, 12, 10][level], amp: [0, 11, 16, 21][level],
      ph: [r.range(0, TAU), r.range(0, TAU), r.range(0, TAU), r.range(0, TAU)], kc: { ...kcursor(64, 312), on: Boolean(o.kb) }, cx: -999, cy: -999,
      touch: Boolean(o.touch), finger: null, hitAt: -1, misses: [],
    };
  },
  tremor(st, t) {
    const p = st.ph, a = st.amp;
    return { x: a * (Math.sin(t * 7.3 + p[0]) * 0.62 + Math.sin(t * 12.9 + p[1]) * 0.38), y: a * (Math.cos(t * 6.1 + p[2]) * 0.6 + Math.sin(t * 11.1 + p[3]) * 0.4) };
  },
  aim(st, x, y, type) {
    const tr = this.tremor(st, st.t);
    return type === 'touch' ? { x: x + tr.x, y: y - 74 + tr.y } : { x: x + tr.x, y: y + tr.y };
  },
  click(st, x, y) {
    if (Math.hypot(x - st.tx, y - st.ty) <= st.tr + 6) { st.hitAt = st.anim; st.cx = x; st.cy = y; fx(st, 'tick', st.tx, st.ty); done(st, 'pass'); }
    else { st.misses.push({ x, y, at: st.anim }); fx(st, 'nope', x, y); }
  },
  down(st, x, y, type) {
    if (type === 'touch') { st.touch = true; st.finger = { x, y }; return; }
    const a = this.aim(st, x, y, type); this.click(st, a.x, a.y);
  },
  move(st, x, y, type) { if (type === 'touch') st.finger = { x, y }; },
  up(st, x, y, type) {
    if (type !== 'touch' || !st.finger) return;
    const a = this.aim(st, x, y, type); st.finger = null; this.click(st, a.x, a.y);
  },
  key(st, name) {
    if (KEYDIR.has(name)) { st.kc.on = true; return; }
    if (name === 'act') { if (st.kc.on) { const tr = this.tremor(st, st.t); this.click(st, st.kc.x + tr.x, st.kc.y + tr.y); } st.kc.on = true; return; }
    return false;
  },
  update(st, dt, io) {
    moveKcursor(st.kc, io, dt, 300);
    const tr = this.tremor(st, st.t);
    if (st.kc.on) { st.cx = st.kc.x + tr.x; st.cy = st.kc.y + tr.y; st.touch = false; }
    else if (io.ptype === 'touch') { if (st.finger) { st.cx = st.finger.x + tr.x; st.cy = st.finger.y - 74 + tr.y; } else st.cx = -999; st.touch = true; }
    else if (io.px > -900) { st.cx = io.px + tr.x; st.cy = io.py + tr.y; }
  },
  draw(g, st, v) {
    // the tiny box, its rings, a note pointing at it
    const { tx, ty, tr } = st;
    for (const [rad, a] of [[tr + 34, 0.35], [tr + 18, 0.6]]) { circle(g, tx, ty, rad); g.lineWidth = LW * 0.9; g.strokeStyle = `rgba(107,59,255,${a})`; g.stroke(); }
    rr(g, tx - tr, ty - tr, tr * 2, tr * 2, 4); inked(g, st.hitAt >= 0 ? C.mint : C.white, LW);
    if (st.hitAt >= 0) check(g, tx + 1, ty + 1, tr * 1.7, C.white);
    const lx = tx < 200 ? tx + 96 : tx - 96, ly = ty > 180 ? ty - 72 : ty + 74;
    words(g, 'click the tiny box', lx, ly, 15, C.violet, { family: SERIF, weight: 400 });
    g.beginPath(); g.moveTo(lx + (tx < 200 ? -46 : 46), ly + (ty > 180 ? 10 : -10)); g.quadraticCurveTo(lx, ty, tx + (tx < 200 ? tr + 14 : -tr - 14), ty);
    g.lineWidth = LW * 0.8; g.strokeStyle = C.violet; g.setLineDash([3, 6]); g.stroke(); g.setLineDash([]);
    for (const m of st.misses) {
      const k = (st.anim - m.at) / 0.5;
      if (k > 1) continue;
      g.save(); g.globalAlpha = 1 - k; cross(g, m.x, m.y, 18); g.restore();
    }
    // the finger on a touchscreen, and the shaky cursor above it
    if (st.finger) { circle(g, st.finger.x, st.finger.y, 22); g.fillStyle = 'rgba(107,59,255,.16)'; g.fill(); g.lineWidth = LW * 0.8; g.strokeStyle = C.lav2; g.stroke(); }
    if (st.cx > -900) {
      for (const [dt, a] of [[0.06, 0.18], [0.03, 0.34]]) {
        const tr0 = this.tremor(st, st.t - dt), tr1 = this.tremor(st, st.t);
        g.save(); g.globalAlpha = a; arrowCursor(g, st.cx + tr0.x - tr1.x, st.cy + tr0.y - tr1.y, 30); g.restore();
      }
      arrowCursor(g, st.cx, st.cy, 30);
    } else if (st.touch) {
      words(g, 'hold, aim, let go', 200, 330, 15, C.ink2, { family: SERIF, weight: 400 });
    }
  },
  bot(st, B) {
    if (!B.ready) return;
    B.go(st.tx, st.ty);
    const tr = this.tremor(st, st.t);
    const d = Math.hypot(B.hand.x + tr.x - st.tx, B.hand.y + tr.y - st.ty);
    if (B.blunder ? B.t > B.T * 0.3 && d > st.tr * 2 : d < st.tr * 0.7) B.tap();
  },
};

// ======================================================================================= IN ORDER!
export const order = {
  id: 'order', command: 'IN ORDER!', hint: 'tap', keys: ['1 2 3…'], time: 1.1,
  setup(level, r, o = OPTS) {
    const n = [0, 3, 4, 5][level];
    const pts = scatter(r, n, { x0: 72, x1: 328, y0: 70, y1: 290, gap: 104 });
    return {
      n, next: 1, bad: -1, badAt: -9,
      tiles: pts.map((p, i) => ({ x: p.x, y: p.y, num: i + 1, rot: r.range(-0.24, 0.24), done: -1, vx: level === 3 ? r.range(-26, 26) : 0, vy: level === 3 ? r.range(-22, 22) : 0 })),
    };
  },
  pick(st, i) {
    const t = st.tiles[i];
    if (!t || t.done >= 0) return;
    if (t.num === st.next) {
      t.done = st.anim; st.next++;
      fx(st, 'type', t.x, t.y, { n: t.num });
      if (st.next > st.n) done(st, 'pass');
    } else { st.bad = i; st.badAt = st.anim; fx(st, 'bad', t.x, t.y); done(st, 'fail', 'wrong'); }
  },
  down(st, x, y) {
    let best = -1, bd = 52;
    st.tiles.forEach((t, i) => { const d = Math.hypot(t.x - x, t.y - y); if (d < bd) { bd = d; best = i; } });
    if (best >= 0) this.pick(st, best);
  },
  key(st, name) {
    if (!name.startsWith('n:')) return false;
    const i = st.tiles.findIndex((t) => t.num === Number(name.slice(2)));
    if (i >= 0) this.pick(st, i);
  },
  update(st, dt) {
    for (const t of st.tiles) {
      if (!t.vx && !t.vy) continue;
      t.x += t.vx * dt; t.y += t.vy * dt;
      if (t.x < 52 || t.x > W - 52) t.vx *= -1;
      if (t.y < 52 || t.y > H - 52) t.vy *= -1;
      t.x = clamp(t.x, 52, W - 52); t.y = clamp(t.y, 52, H - 52);
    }
  },
  draw(g, st, v) {
    st.tiles.forEach((t, i) => {
      const bad = st.bad === i, on = t.done >= 0;
      const k = on ? clamp((st.anim - t.done) / 0.2, 0, 1) : 0;
      g.save();
      g.translate(t.x + (bad ? wobble(st.anim - st.badAt) : 0), t.y);
      g.rotate(t.rot * (1 - k));
      const s = 1 + Math.sin(k * Math.PI) * 0.12;
      g.scale(s, s);
      tile(g, -40, -40, 80, 80, bad ? '#ffd0e4' : on ? C.mint : C.white, 18, on ? 2 : 4);
      sticker(g, String(t.num), 0, 3, 46, on ? C.white : C.honey, { shadow: 0.07 });
      g.restore();
    });
  },
  bot(st, B) {
    if (!B.ready) return;
    const want = B.blunder && st.next === 2 ? st.n : st.next;
    const t = st.tiles.find((x) => x.num === want);
    if (!t) return;
    B.go(t.x + 8, t.y + 12);
    if (B.near(t.x + 8, t.y + 12, 14)) B.tap();
  },
};

// ======================================================================================= SHAKE NO!
const SH = { cx: 200, cy: 232, s: 190 };
export const shake = {
  id: 'shake', command: 'SHAKE NO!', hint: 'swipe', keys: ['← → ← →'], time: 1.02,
  setup(level, r, o = OPTS) {
    return { need: [0, 4, 6, 8][level], n: 0, turn: 0, tt: 0, drag: null, lastKey: null, nos: [], skin: r.pick(['#ffd9bd', '#f2b98f', '#d18f62', '#a8673f']), hair: r.pick(['#2b1d16', '#e9c46a', '#c0503a', '#1b1b2f']) };
  },
  swing(st, d) {
    st.n++; st.tt = d;
    st.nos.push({ at: st.anim, side: d });
    if (st.nos.length > 6) st.nos.shift();
    fx(st, 'no', SH.cx + d * 120, SH.cy - 60, { n: st.n });
    if (st.n >= st.need) done(st, 'pass');
  },
  // a swing: 34 units one way from where it turned (the first one from where the press began)
  track(st, x) {
    const d = st.drag;
    if (d.dir === 0) {
      if (x > d.ext + 34) { d.dir = 1; d.ext = x; this.swing(st, 1); } else if (x < d.ext - 34) { d.dir = -1; d.ext = x; this.swing(st, -1); }
      return;
    }
    if (d.dir > 0) { if (x > d.ext) d.ext = x; else if (x < d.ext - 34) { d.dir = -1; d.ext = x; this.swing(st, -1); } }
    else if (x < d.ext) d.ext = x; else if (x > d.ext + 34) { d.dir = 1; d.ext = x; this.swing(st, 1); }
  },
  down(st, x) { st.drag = { ext: x, dir: 0 }; },
  move(st, x) { if (st.drag) this.track(st, x); },
  hover(st, x, y, type) { if (type !== 'mouse') return; if (!st.drag) st.drag = { ext: x, dir: 0 }; this.track(st, x); },
  up(st) { st.drag = null; },
  key(st, name) {
    if (name === 'left' || name === 'right') { if (name !== st.lastKey) { st.lastKey = name; this.swing(st, name === 'left' ? -1 : 1); } return; }
    return false;
  },
  update(st, dt) { st.turn += (st.tt - st.turn) * (1 - Math.exp(-18 * dt)); },
  idle(st, dt) { st.turn += (st.tt - st.turn) * (1 - Math.exp(-18 * dt)); },
  draw(g, st, v) {
    rr(g, 50, 16, 300, 62, 18); inked(g, C.honey, LW);
    sticker(g, 'ARE YOU A ROBOT?', 200, 48, 24, C.white, { shadow: 0.06, maxW: 270 });
    // the head, shaking no
    g.save();
    g.translate(SH.cx + st.turn * 16, SH.cy);
    g.rotate(st.turn * 0.12);
    face(g, 0, 0, SH.s, { turn: st.turn, skin: st.skin, hair: st.hair, smile: st.n >= st.need ? 0.7 : -0.1, happy: st.n >= st.need });
    g.restore();
    for (const no of st.nos) {
      const k = (st.anim - no.at) / 0.55;
      if (k > 1) continue;
      g.save(); g.globalAlpha = Math.min(1, (1 - k) * 2);
      sticker(g, 'NO!', SH.cx + no.side * (118 + k * 10), SH.cy - 40 - k * 34, 30 + (1 - k) * 6, C.pink, { shadow: 0.06 });
      g.restore();
    }
    for (let i = 0; i < st.need; i++) {
      const x = 200 + (i - (st.need - 1) / 2) * 24;
      circle(g, x, 342, 8); inked(g, i < st.n ? C.mint : C.white, LW * 0.8);
    }
  },
  bot(st, B) {
    if (!B.ready) return;
    const m = B.mem;
    if (!st.drag) { B.go(SH.cx, SH.cy + 40); if (B.near(SH.cx, SH.cy + 40, 10)) { B.press(); m.side = 1; } return; }
    if (B.blunder && st.n >= st.need - 2) { B.release(); return; }
    const tx = SH.cx + m.side * 92;
    B.go(tx, SH.cy + 40);
    if (Math.abs(B.hand.x - tx) < 14) m.side = -m.side;
  },
};

// ======================================================================================= SIGN IT!
const SG = { x0: 66, x1: 344, base: 288, top: 196, bottom: 330 };
export function coverage(bins) { let n = 0; for (let i = 0; i < bins.length; i++) n += bins[i]; return n / bins.length; }
export function markSpan(bins, xa, xb, x0) {
  const a = Math.max(0, Math.floor(Math.min(xa, xb) - x0)), b = Math.min(bins.length - 1, Math.ceil(Math.max(xa, xb) - x0));
  for (let i = a; i <= b; i++) bins[i] = 1;
}
export const sign = {
  id: 'sign', command: 'SIGN IT!', hint: 'drag', keys: ['→ HOLD'], time: 1.1,
  setup(level, r, o = OPTS) {
    return { need: [0, 0.62, 0.72, 0.8][level], bins: new Uint8Array(SG.x1 - SG.x0), cov: 0, strokes: [], cur: null, pen: null, signed: -1 };
  },
  add(st, x, y) {
    const s = st.cur;
    if (!s) return;
    const last = s[s.length - 1];
    if (last && Math.hypot(x - last.x, y - last.y) < 2.5) return;
    s.push({ x, y });
    if (last && y > SG.top - 30 && y < SG.bottom + 20 && last.y > SG.top - 30 && last.y < SG.bottom + 20) {
      markSpan(st.bins, last.x, x, SG.x0);
      st.cov = coverage(st.bins);
      if (st.cov >= st.need) { st.signed = st.anim; fx(st, 'good', x, y); done(st, 'pass'); }
      else if (s.length % 6 === 0) fx(st, 'scribble', x, y);
    }
  },
  down(st, x, y) { st.cur = [{ x, y }]; st.strokes.push(st.cur); },
  move(st, x, y) { this.add(st, x, y); },
  up(st) { st.cur = null; },
  key(st, name) { if (name === 'right') return; return false; },
  keyUp(st, name) { if (name === 'right') { st.pen = null; st.cur = null; } },
  update(st, dt, io) {
    if (!io.held('right')) return;
    if (!st.pen) { st.pen = { x: SG.x0 - 6, t: 0 }; st.cur = []; st.strokes.push(st.cur); }
    st.pen.x += 240 * dt; st.pen.t += dt;
    const y = 256 + Math.sin(st.pen.t * 17) * 20 + Math.sin(st.pen.t * 6.3) * 9;
    this.add(st, st.pen.x, y);
  },
  draw(g, st, v) {
    // the agreement
    rr(g, 26, 14, 348, 332, 14); inked(g, C.white, LW);
    words(g, 'HUMAN AGREEMENT', 200, 42, 16, INK, { family: DISPLAY, weight: 900, stretch: 'expanded' });
    words(g, 'i, the undersigned, am a real human', 200, 72, 17, C.ink2, { family: SERIF, weight: 400 });
    words(g, 'with real feelings and a real pulse.', 200, 94, 17, C.ink2, { family: SERIF, weight: 400 });
    for (let i = 0; i < 3; i++) { rr(g, 52, 120 + i * 18, 296 - (i === 2 ? 110 : 0), 7, 3.5); g.fillStyle = '#e8e2f7'; g.fill(); }
    // the line to sign on
    rr(g, 40, SG.top - 8, 320, SG.bottom - SG.top + 8, 12);
    g.setLineDash([6, 6]); g.lineWidth = LW * 0.8; g.strokeStyle = C.lav2; g.stroke(); g.setLineDash([]);
    words(g, 'sign here', 52, SG.top + 10, 13, C.violet, { align: 'left', weight: 750 });
    sticker(g, 'X', 52, SG.base - 14, 26, C.pink, { shadow: 0.05 });
    g.beginPath(); g.moveTo(SG.x0, SG.base); g.lineTo(SG.x1, SG.base); g.lineWidth = LW; g.strokeStyle = INK; g.lineCap = 'round'; g.stroke();
    // what's been signed
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const s of st.strokes) {
      if (s.length < 2) continue;
      g.beginPath(); g.moveTo(s[0].x, s[0].y);
      for (let i = 1; i < s.length; i++) g.lineTo(s[i].x, s[i].y);
      g.lineWidth = 5.5; g.strokeStyle = C.violet; g.stroke();
    }
    // how much of the line
    rr(g, SG.x0, SG.base + 14, SG.x1 - SG.x0, 10, 5); inked(g, '#efeafc', LW * 0.7);
    if (st.cov > 0) { rr(g, SG.x0, SG.base + 14, (SG.x1 - SG.x0) * Math.min(1, st.cov / st.need), 10, 5); inked(g, C.mint, LW * 0.7); }
    if (st.pen) { circle(g, st.pen.x, 256 + Math.sin(st.pen.t * 17) * 20, 5); g.fillStyle = INK; g.fill(); }
  },
  bot(st, B, dt) {
    if (!B.ready) return;
    const m = B.mem;
    const y0 = 254;
    if (!st.cur) { if (m.u > 0) return; B.go(SG.x0 - 4, y0); if (B.near(SG.x0 - 4, y0, 8)) { B.press(); m.u = 0; } return; }
    m.u = Math.min(1, (m.u || 0) + dt * (B.blunder ? 0.5 : 1.25));
    const span = (SG.x1 - SG.x0 + 12) * (B.blunder ? 0.45 : 1);
    B.go(SG.x0 - 4 + span * m.u, y0 + Math.sin(m.u * 26) * 22 + Math.sin(m.u * 9) * 10);
    if (m.u >= 1) B.release();
  },
};

// ======================================================================================= WAIT… TAP!
export const now = {
  id: 'now', command: 'WAIT… TAP!', hint: 'tap', keys: ['SPACE'], time: 1.05,
  setup(level, r, o = OPTS) {
    return { go: r.range(0.32, 0.52) * o.T, fake: level >= 2 ? r.range(0.12, 0.24) * o.T : -1, win: [0, 9, 1.0, 0.72][level], tapped: -1, early: -1 };
  },
  light(st) {
    if (st.t >= st.go) return 2;
    if (st.fake >= 0 && st.t >= st.fake && st.t < st.fake + 0.22) return 1;
    if (st.fake < 0 && st.t >= st.go - 0.4) return 1;
    return 0;
  },
  hit(st) {
    if (st.t >= st.go) { st.tapped = st.anim; fx(st, 'good', 200, 150); done(st, 'pass'); }
    else { st.early = st.anim; fx(st, 'bad', 200, 150); done(st, 'fail', 'early'); }
  },
  down(st) { this.hit(st); },
  key(st, name) { if (name === 'act') { this.hit(st); return; } return false; },
  update(st) { if (st.t >= st.go + st.win) done(st, 'fail', 'slow'); },
  draw(g, st, v) {
    const lit = st.done === 'fail' && st.early >= 0 ? 0 : this.light(st);
    // a big light on a post
    const lx = 146;
    rr(g, lx - 14, 250, 28, 70, 6); inked(g, C.grey2);
    rr(g, lx - 68 + 3, 22 + 7, 136, 234, 34); g.fillStyle = INK; g.fill();
    rr(g, lx - 68, 22, 136, 234, 34); inked(g, '#3b3460', LW + 0.4);
    const cols = [C.red, C.honey, C.green];
    for (let i = 0; i < 3; i++) {
      const y = 62 + i * 77;
      circle(g, lx, y, 30);
      inked(g, lit === i ? cols[i] : '#5b5480', LW);
      if (lit === i) { circle(g, lx, y, 30); g.save(); g.clip(); circle(g, lx - 10, y - 10, 12); g.fillStyle = 'rgba(255,255,255,.45)'; g.fill(); g.restore(); }
    }
    const go = lit === 2;
    const k = go ? Math.min(1, (st.t - st.go) / 0.12) : 1;
    g.save(); g.translate(298, go ? 216 : 62); g.rotate(-0.06); g.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k);
    sticker(g, go ? 'TAP!' : 'WAIT…', 0, 0, go ? 46 : 32, go ? C.green : C.white, { shadow: 0.07 });
    g.restore();
    if (!go) { g.beginPath(); g.moveTo(258, 90); g.quadraticCurveTo(250, 120, 216, 130); g.lineWidth = LW * 0.8; g.strokeStyle = C.ink2; g.setLineDash([3, 6]); g.stroke(); g.setLineDash([]); words(g, 'not yet…', 300, 104, 15, C.ink2, { family: SERIF, weight: 400 }); }
    words(g, 'humans wait for the green', 200, 342, 14, C.ink2, { family: SERIF, weight: 400 });
  },
  bot(st, B) {
    const m = B.mem;
    B.go(250, 300);
    if (B.blunder) { if (st.fake >= 0 ? st.t >= st.fake + 0.12 : st.t >= st.go * 0.6) B.tap(); return; }
    if (st.t >= st.go) { m.seen = m.seen ?? st.t; if (st.t - m.seen >= m.react) B.tap(); }
    if (m.react == null) m.react = B.r.range(0.16, 0.26);
  },
};
