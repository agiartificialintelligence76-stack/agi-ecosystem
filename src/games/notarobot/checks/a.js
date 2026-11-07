// I'M NOT A ROBOT: the first checks. TICK IT! (a nervous checkbox), ONLY CATS! (pick the cats), SLIDE IT! (the puzzle
// piece into its gap), TYPE IT! (a wobbly word), TURN IT! (a picture the right way up), FIND THE BOT! (one robot in a
// crowd). Each: its rules (pure), its picture (draw), its keys, and how the demo's hand plays it (bot).
import { W, H, TAU, clamp, done, fx, hitCircle, kcursor, moveKcursor, stepSel, KEYDIR, selRing, selCircle, tile, wobble, OPTS } from './util.js';
import {
  INK, LW, C, rr, inked, card, circle, words, sticker, check, cross, arrowCursor, cat, dog, toaster, cloud, frog, owl, robot, person, house, rocket, icecream, scenery, piecePath, LOOKS,
} from '../art.js';

// ======================================================================================= TICK IT!
const TW = 172, TH = 66;
export const tick = {
  id: 'tick', command: 'TICK IT!', hint: 'tap', keys: ['←↑↓→', 'SPACE'], time: 1,
  setup(level, r, o = OPTS) {
    return {
      r, x: r.range(150, 250), y: r.range(130, 230), vx: 0, vy: 0, wander: r.range(0, TAU),
      speed: [0, 240, 310, 380][level] * o.speed, flee: [0, 112, 128, 146][level],
      stamina: [0, 0.7, 1.0, 1.35][level], tired: 0, scoot: r.range(0.5, 0.9), ticked: -1, kc: { ...kcursor(60, 320), on: Boolean(o.kb) }, lookX: 0, lookY: 0,
    };
  },
  hitAt(st, x, y) { return x >= st.x - TW / 2 - 12 && x <= st.x + TW / 2 + 12 && y >= st.y - TH / 2 - 12 && y <= st.y + TH / 2 + 12; },
  press(st, x, y) {
    if (this.hitAt(st, x, y)) {
      st.ticked = st.anim;
      fx(st, 'tick', st.x - TW / 2 + 35, st.y);
      done(st, 'pass');
      return;
    }
    // a near miss: it jumps away from the tap, nervously
    const dx = st.x - x, dy = st.y - y, d = Math.hypot(dx, dy) || 1;
    if (d < 190) { st.vx += (dx / d) * st.speed * 1.7; st.vy += (dy / d) * st.speed * 1.7; fx(st, 'whiff', x, y); }
  },
  down(st, x, y) { this.press(st, x, y); },
  key(st, name) {
    if (KEYDIR.has(name)) { st.kc.on = true; return; }
    if (name === 'act') { if (st.kc.on) this.press(st, st.kc.x, st.kc.y); st.kc.on = true; return; }
    return false;
  },
  update(st, dt, io) {
    moveKcursor(st.kc, io, dt);
    let tx = -999, ty = -999;
    if (st.kc.on) { tx = st.kc.x; ty = st.kc.y; } else if (io.px > -900 && io.ptype !== 'touch') { tx = io.px; ty = io.py; }
    const dx = st.x - tx, dy = st.y - ty, d = Math.hypot(dx, dy) || 1;
    let wx = 0, wy = 0;
    if (st.tired > 0) {
      st.tired -= dt;
      if (st.tired <= 0) st.stamina = 0.35;
    } else if (d < st.flee && st.stamina > 0) {
      const k = st.speed * (1.25 - d / st.flee);
      wx = (dx / d) * k; wy = (dy / d) * k;
      st.stamina -= dt;
      if (st.stamina <= 0) { st.tired = 0.85; fx(st, 'pant', st.x, st.y - 44); }
    } else {
      st.wander += (st.r.next() - 0.5) * 7 * dt;
      wx = Math.cos(st.wander) * st.speed * 0.3; wy = Math.sin(st.wander) * st.speed * 0.3;
      // every so often a nervous little scoot
      st.scoot -= dt;
      if (st.scoot <= 0) {
        st.scoot = st.r.range(0.55, 1.0) * (st.level === 3 ? 0.7 : 1);
        const a = st.r.range(0, TAU);
        st.vx += Math.cos(a) * st.speed * 0.9; st.vy += Math.sin(a) * st.speed * 0.9;
      }
    }
    const k = 1 - Math.exp(-7 * dt);
    if (st.tired <= 0) { st.vx += (wx - st.vx) * k; st.vy += (wy - st.vy) * k; } else { st.vx *= 1 - k * 1.5; st.vy *= 1 - k * 1.5; }
    st.x += st.vx * dt; st.y += st.vy * dt;
    const x0 = TW / 2 + 6, x1 = W - TW / 2 - 6, y0 = TH / 2 + 8, y1 = H - TH / 2 - 8;
    if (st.x < x0) { st.x = x0; st.vx = Math.abs(st.vx) * 0.2; st.wander = Math.PI - st.wander; }
    if (st.x > x1) { st.x = x1; st.vx = -Math.abs(st.vx) * 0.2; st.wander = Math.PI - st.wander; }
    if (st.y < y0) { st.y = y0; st.vy = Math.abs(st.vy) * 0.2; st.wander = -st.wander; }
    if (st.y > y1) { st.y = y1; st.vy = -Math.abs(st.vy) * 0.2; st.wander = -st.wander; }
    // its eyes on whoever's coming
    const lk = tx > -900 ? Math.min(1, 160 / d) : 0;
    st.lookX += ((tx > -900 ? -dx / d : Math.cos(st.wander)) * 2.6 * Math.max(lk, 0.4) - st.lookX) * k * 2;
    st.lookY += ((tx > -900 ? -dy / d : Math.sin(st.wander)) * 2.2 * Math.max(lk, 0.4) - st.lookY) * k * 2;
  },
  draw(g, st, v) {
    // the page it's on: a sign-up form, waiting on one little box
    g.save();
    g.globalAlpha = 0.55;
    rr(g, 26, 22, 120, 14, 7); g.fillStyle = C.lav2; g.fill();
    for (const [y, w] of [[54, 250], [72, 210], [90, 236]]) { rr(g, 26, y, w, 8, 4); g.fillStyle = '#e8e2f7'; g.fill(); }
    rr(g, W - 136, H - 52, 110, 34, 17); g.fillStyle = '#e8e2f7'; g.fill();
    g.restore();
    words(g, 'continue', W - 81, H - 34, 14, '#b9b0d6', { weight: 750 });
    const sp = Math.hypot(st.vx, st.vy);
    if (sp > 140 && st.ticked < 0) {
      const ux = st.vx / sp, uy = st.vy / sp;
      g.lineCap = 'round'; g.lineWidth = LW; g.strokeStyle = C.lav2;
      g.beginPath();
      for (const o of [-18, 0, 18]) {
        const bx = st.x - ux * (TW * 0.42) - uy * o, by = st.y - uy * (TH * 0.42) + ux * o;
        g.moveTo(bx, by); g.lineTo(bx - ux * Math.min(46, sp * 0.1), by - uy * Math.min(46, sp * 0.1));
      }
      g.stroke();
    }
    const wob = st.tired > 0 ? Math.sin(st.anim * 30) * 1.5 : 0;
    card(g, st.x - TW / 2 + wob, st.y - TH / 2, TW, TH, 12, C.white, { off: 4 });
    const bx = st.x - TW / 2 + 35 + wob, by = st.y;
    const on = st.ticked >= 0;
    rr(g, bx - 20, by - 20, 40, 40, 9); inked(g, on ? C.mint : C.white, LW);
    if (on) check(g, bx + 1, by + 1, 34, C.white, clamp((st.anim - st.ticked) / 0.16, 0, 1));
    else {
      // two nervous eyes
      for (const sx of [-1, 1]) { circle(g, bx + sx * 6 + st.lookX, by - 2 + st.lookY, 3); g.fillStyle = INK; g.fill(); }
      if (st.tired > 0) { g.beginPath(); g.moveTo(bx - 5, by + 9); g.lineTo(bx + 5, by + 9); g.lineWidth = LW * 0.8; g.strokeStyle = INK; g.stroke(); }
    }
    words(g, "I'm not", st.x + 30 + wob, by - 10, 18, INK, { weight: 750 });
    words(g, 'a robot', st.x + 30 + wob, by + 11, 18, INK, { weight: 750 });
    if (st.tired > 0) {
      // out of breath: two sweat drops
      for (const [ox, oy, s] of [[-TW / 2 - 4, -TH / 2 - 2, 1], [-TW / 2 + 12, -TH / 2 - 12, 0.8]]) {
        const x = st.x + ox, y = st.y + oy - Math.sin(st.anim * 8) * 2;
        g.beginPath(); g.moveTo(x, y - 7 * s); g.quadraticCurveTo(x + 5 * s, y + 1, x, y + 4 * s); g.quadraticCurveTo(x - 5 * s, y + 1, x, y - 7 * s);
        inked(g, C.sky, LW * 0.7);
      }
    }
    if (st.kc.on) arrowCursor(g, st.kc.x, st.kc.y, 28);
  },
  bot(st, B) {
    B.maxSpeed = 560;
    if (!B.ready) return;
    const lead = 0.12;
    const tx = st.x - TW / 2 + 35 + st.vx * lead, ty = st.y + st.vy * lead;
    if (B.blunder) { B.go(tx + 90, ty - 70); return; }
    B.go(tx, ty);
    if (B.near(st.x - TW / 2 + 35, st.y, 26)) B.tap();
  },
};

// ======================================================================================= ONLY CATS!
const CT = { x: 34, y: 14, s: 104, gap: 10 };
const tileXY = (i) => ({ x: CT.x + (i % 3) * (CT.s + CT.gap), y: CT.y + Math.floor(i / 3) * (CT.s + CT.gap) });
export function catsDone(tiles, sel) { return tiles.every((t, i) => (t === 'cat') === Boolean(sel[i])); }
export function makeCatTiles(level, r) {
  const n = [0, r.int(2, 3), r.int(3, 4), r.int(3, 5)][level];
  const others = level === 1 ? ['toaster', 'cloud'] : level === 2 ? ['toaster', 'cloud', 'frog', 'owl'] : ['frog', 'dog', 'owl', 'toaster', 'cloud'];
  const tiles = [];
  for (let i = 0; i < n; i++) tiles.push('cat');
  while (tiles.length < 9) tiles.push(r.pick(others));
  return r.shuffle(tiles);
}
const PICS = { cat, dog, toaster, cloud, frog, owl };
export const cats = {
  id: 'cats', command: 'ONLY CATS!', hint: 'tap', keys: ['←↑↓→', 'SPACE'], time: 1.15,
  setup(level, r, o = OPTS) {
    const tiles = makeCatTiles(level, r);
    return { tiles, sel: tiles.map(() => false), pop: tiles.map(() => -9), wrong: -1, wrongAt: -9, cur: 4, kb: Boolean(o.kb), items: tiles.map((_, i) => ({ x: tileXY(i).x + CT.s / 2, y: tileXY(i).y + CT.s / 2 })) };
  },
  at(x, y) {
    for (let i = 0; i < 9; i++) { const p = tileXY(i); if (x >= p.x - 4 && x <= p.x + CT.s + 4 && y >= p.y - 4 && y <= p.y + CT.s + 4) return i; }
    return -1;
  },
  choose(st, i) {
    if (i < 0 || st.sel[i]) return;
    const c = st.items[i];
    if (st.tiles[i] !== 'cat') { st.wrong = i; st.wrongAt = st.anim; fx(st, 'bad', c.x, c.y); done(st, 'fail', 'wrong'); return; }
    st.sel[i] = true; st.pop[i] = st.anim;
    fx(st, 'good', c.x, c.y);
    if (catsDone(st.tiles, st.sel)) done(st, 'pass');
  },
  down(st, x, y) { this.choose(st, this.at(x, y)); },
  key(st, name) {
    if (KEYDIR.has(name)) { if (st.kb) st.cur = stepSel(st.items, st.cur, name); st.kb = true; return; }
    if (name === 'act') { if (st.kb) this.choose(st, st.cur); st.kb = true; return; }
    return false;
  },
  draw(g, st, v) {
    for (let i = 0; i < 9; i++) {
      const p = tileXY(i), on = st.sel[i], bad = st.wrong === i;
      const pk = st.pop[i] > -9 ? clamp((st.anim - st.pop[i]) / 0.22, 0, 1) : 1;
      const sc = on ? 0.94 + 0.06 * (1 - Math.sin(pk * Math.PI) * 0.6) : 1;
      g.save();
      g.translate(p.x + CT.s / 2 + (bad ? wobble(st.anim - st.wrongAt) : 0), p.y + CT.s / 2);
      g.scale(sc, sc);
      tile(g, -CT.s / 2, -CT.s / 2, CT.s, CT.s, bad ? '#ffd0e4' : on ? '#d4fff2' : C.paper, 14, on ? 1 : 3);
      PICS[st.tiles[i]](g, 0, st.tiles[i] === 'cloud' ? 4 : 6, CT.s * 0.72, st.tiles[i] === 'cat' ? { blink: Math.sin(st.anim * 2 + i) > 0.97 ? 1 : 0 } : undefined);
      if (on) { circle(g, CT.s / 2 - 14, -CT.s / 2 + 14, 15); inked(g, C.mint); check(g, CT.s / 2 - 13.5, -CT.s / 2 + 14.5, 17, C.white); }
      if (bad) cross(g, 0, 0, 64);
      g.restore();
    }
    if (st.kb) { const p = tileXY(st.cur); selRing(g, p.x, p.y, CT.s, CT.s, v.t, 14); }
  },
  bot(st, B) {
    if (!B.ready) return;
    let target = -1, bd = Infinity;
    for (let i = 0; i < 9; i++) {
      const want = B.blunder && !B.mem.erred ? st.tiles[i] !== 'cat' : st.tiles[i] === 'cat' && !st.sel[i];
      if (!want) continue;
      const d = Math.hypot(st.items[i].x - B.hand.x, st.items[i].y - B.hand.y);
      if (d < bd) { bd = d; target = i; }
    }
    if (target < 0) return;
    const c = st.items[target];
    B.go(c.x + 6, c.y + 10);
    if (B.near(c.x + 6, c.y + 10, 14)) { if (B.tap() && B.blunder) B.mem.erred = true; }
  },
};

// ======================================================================================= SLIDE IT!
const SL = { pic: { x: 30, y: 22, w: 340, h: 196 }, pieceY: 120, track: { x: 30, y: 262, w: 340, h: 58 }, h0: 74, h1: 326, size: 62 };
export const slide = {
  id: 'slide', command: 'SLIDE IT!', hint: 'drag', keys: ['→ HOLD', 'LET GO'], time: 1.05,
  setup(level, r, o = OPTS) {
    return { gap: r.range(200, 300), tol: [0, 15, 11, 8][level], hx: SL.h0, grab: null, back: false, snapped: -1, tries: 0, keyMoved: false, shake: -9 };
  },
  release(st) {
    if (Math.abs(st.hx - st.gap) <= st.tol) {
      st.hx = st.gap; st.snapped = st.anim;
      fx(st, 'snap', st.gap, SL.pieceY);
      done(st, 'pass');
    } else if (st.hx > SL.h0 + 6) {
      st.back = true; st.tries++; st.shake = st.anim;
      fx(st, 'nope', st.hx, SL.pieceY);
    }
  },
  down(st, x, y) {
    if (st.back) return;
    const onHandle = Math.abs(x - st.hx) < 52 && Math.abs(y - (SL.track.y + SL.track.h / 2)) < 50;
    const onPiece = Math.abs(x - st.hx) < 50 && Math.abs(y - SL.pieceY) < 50;
    const onTrack = y > SL.track.y - 26 && y < SL.track.y + SL.track.h + 26;
    if (onHandle || onPiece) st.grab = { dx: st.hx - x };
    else if (onTrack) st.grab = { dx: 0 };
    if (st.grab) { st.hx = clamp(x + st.grab.dx, SL.h0, SL.h1); fx(st, 'grab', st.hx, SL.track.y + SL.track.h / 2); }
  },
  move(st, x) { if (st.grab) st.hx = clamp(x + st.grab.dx, SL.h0, SL.h1); },
  up(st) { if (st.grab) { st.grab = null; this.release(st); } },
  key(st, name) { if (name === 'right' || name === 'left') return; return false; },
  keyUp(st, name) { if ((name === 'right' || name === 'left') && st.keyMoved) { st.keyMoved = false; this.release(st); } },
  update(st, dt, io) {
    if (st.back) {
      st.hx += (SL.h0 - st.hx) * (1 - Math.exp(-16 * dt));
      if (Math.abs(st.hx - SL.h0) < 1) { st.hx = SL.h0; st.back = false; }
      return;
    }
    const dir = (io.held('right') ? 1 : 0) - (io.held('left') ? 1 : 0);
    if (dir && !st.grab) { st.hx = clamp(st.hx + dir * 250 * dt, SL.h0, SL.h1); st.keyMoved = true; }
  },
  draw(g, st, v) {
    const P = SL.pic;
    scenery(g, P.x, P.y, P.w, P.h, st.anim);
    // the gap: the piece's shape, dark
    g.save();
    piecePath(g, st.gap, SL.pieceY, SL.size);
    g.fillStyle = 'rgba(23,10,54,.5)'; g.fill();
    g.setLineDash([5, 5]); g.lineWidth = LW * 0.8; g.strokeStyle = C.white; g.stroke();
    g.restore();
    // the piece: that bit of the picture, lifted out
    const px = st.hx + (st.back ? Math.sin(st.anim * 50) * 3 : 0), py = SL.pieceY;
    const lift = st.snapped >= 0 ? 0 : 4;
    g.save();
    piecePath(g, px + lift * 0.6, py + lift, SL.size); g.fillStyle = INK; g.fill();
    piecePath(g, px, py, SL.size);
    g.save(); g.clip();
    g.translate(px - st.gap, 0);
    scenery(g, P.x, P.y, P.w, P.h, st.anim);
    g.restore();
    piecePath(g, px, py, SL.size);
    g.lineWidth = LW * 1.3; g.strokeStyle = st.snapped >= 0 ? C.mint : C.white; g.stroke();
    g.lineWidth = LW; g.strokeStyle = INK; g.stroke();
    g.restore();
    // the track and its handle
    const T = SL.track;
    rr(g, T.x, T.y, T.w, T.h, T.h / 2); inked(g, C.lav);
    rr(g, T.x + 6, T.y + 6, Math.max(0, st.hx - T.x - 6), T.h - 12, (T.h - 12) / 2); g.fillStyle = st.snapped >= 0 ? C.mint : C.lav2; g.fill();
    words(g, 'slide to fit the piece', T.x + T.w / 2 + 34, T.y + T.h / 2 + 1, 15, C.ink2, { weight: 650 });
    const hx = st.hx, hy = T.y + T.h / 2;
    const press = st.grab ? 1 : 0;
    rr(g, hx - 34, hy - 30 + 5, 68, 60, 16); g.fillStyle = INK; g.fill();
    rr(g, hx - 34, hy - 30 + press * 3, 68, 60, 16); inked(g, st.snapped >= 0 ? C.mint : C.honey, LW + 0.4);
    // its arrow
    g.beginPath(); g.moveTo(hx - 12, hy - 9 + press * 3); g.lineTo(hx + 4, hy - 9 + press * 3); g.lineTo(hx + 4, hy - 17 + press * 3); g.lineTo(hx + 17, hy + press * 3); g.lineTo(hx + 4, hy + 17 + press * 3); g.lineTo(hx + 4, hy + 9 + press * 3); g.lineTo(hx - 12, hy + 9 + press * 3); g.closePath();
    inked(g, C.white, LW * 0.9);
  },
  bot(st, B) {
    if (!B.ready) return;
    const m = B.mem, hy = SL.track.y + SL.track.h / 2;
    if (st.back) return;
    if (!m.going) {
      B.go(st.hx + 4, hy + 6);
      if (B.near(st.hx + 4, hy + 6, 8)) {
        B.press(); m.going = true; m.off = B.hand.x - st.hx;
        m.err = B.blunder ? (st.tol + 16) * B.r.sign() : B.r.range(-st.tol * 0.4, st.tol * 0.4);
      }
      return;
    }
    B.go(st.gap + m.err + m.off, hy + 6);
    if (Math.abs(st.hx - (st.gap + m.err)) < 1.5 && Math.abs(B.hand.vx) < 60) { B.release(); m.going = false; }
  },
};

// ======================================================================================= TYPE IT!
const WORDS3 = ['HUG', 'CAT', 'YAY', 'LOL', 'FUN', 'SUN', 'TEA', 'JAM', 'MEH', 'YUM', 'HEY', 'OWL', 'WOW', 'NAH', 'BOO', 'ZZZ', 'HMM', 'AWW'];
const WORDS4 = ['MEOW', 'YAWN', 'SNAX', 'TACO', 'SOCK', 'HUGS', 'COZY', 'DOZE', 'HEHE', 'YOLO', 'WAVE', 'MOOD', 'CUTE', 'NICE', 'OKAY', 'WINK', 'BLUSH', 'NOMS', 'COMFY'].filter((w) => w.length === 4);
export const TYPE_WORDS = { 3: WORDS3, 4: WORDS4 };
const LETTERS = 'ABCDEFGHIJKLMNORSTUVWXYZ';     // no P (it pauses the game) and no Q
export function typeKeys(word, r) {
  const keys = [...new Set(word)];
  while (keys.length < 6) { const c = r.pick([...LETTERS]); if (!keys.includes(c)) keys.push(c); }
  return r.shuffle(keys);
}
const KB = { x: 38, y: 186, w: 100, h: 72, gx: 12, gy: 12 };
const keyXY = (i) => ({ x: KB.x + (i % 3) * (KB.w + KB.gx), y: KB.y + Math.floor(i / 3) * (KB.h + KB.gy) });
export const type = {
  id: 'type', command: 'TYPE IT!', hint: 'tap', keys: ['A–Z'], time: 1.35, letters: true,
  setup(level, r, o = OPTS) {
    const word = r.pick(level === 1 ? WORDS3 : WORDS4);
    const keys = typeKeys(word, r);
    return {
      r, word, keys, pos: 0, flash: keys.map(() => -9), bad: keys.map(() => -9), wrongAt: -9, shuffle: level === 3,
      jit: [...word].map(() => ({ a: r.range(-0.28, 0.28), y: r.range(-8, 8), s: r.range(0.9, 1.1) })), swap: -9,
    };
  },
  press(st, i) {
    if (i < 0) { st.wrongAt = st.anim; fx(st, 'nope', 200, 90); return; }
    const k = keyXY(i);
    if (st.keys[i] === st.word[st.pos]) {
      st.pos++; st.flash[i] = st.anim;
      fx(st, 'type', k.x + KB.w / 2, k.y + KB.h / 2, { n: st.pos });
      if (st.pos >= st.word.length) { done(st, 'pass'); return; }
      if (st.shuffle) { st.keys = st.r.shuffle(st.keys.slice()); st.swap = st.anim; }
    } else {
      st.bad[i] = st.anim; st.wrongAt = st.anim;
      fx(st, 'nope', k.x + KB.w / 2, k.y + KB.h / 2);
    }
  },
  down(st, x, y) {
    for (let i = 0; i < 6; i++) { const k = keyXY(i); if (x >= k.x - 5 && x <= k.x + KB.w + 5 && y >= k.y - 5 && y <= k.y + KB.h + 5) { this.press(st, i); return; } }
  },
  key(st, name) {
    if (!name.startsWith('k:')) return false;
    this.press(st, st.keys.indexOf(name.slice(2)));
  },
  draw(g, st, v) {
    // the word, captcha style: every letter leaning its own way, a scribble through it
    const n = st.word.length, step = n === 3 ? 82 : 70, x0 = 200 - (step * (n - 1)) / 2, y0 = 92;
    const shake = wobble(st.anim - st.wrongAt);
    rr(g, 30, 22, 340, 140, 16); inked(g, '#f3eeff', LW);
    for (let i = 0; i < n; i++) {
      const j = st.jit[i], ok = i < st.pos;
      g.save();
      g.translate(x0 + i * step + shake, y0 + j.y + Math.sin(st.anim * 3 + i) * 2.5);
      g.rotate(j.a + Math.sin(st.anim * 2.4 + i * 1.7) * 0.06);
      sticker(g, st.word[i], 0, 0, 66 * j.s, ok ? C.mint : C.white, { shadow: 0.06, outline: 0.13 });
      g.restore();
    }
    g.beginPath();
    for (let x = 44; x <= 356; x += 6) { const y = y0 + 4 + Math.sin(x * 0.045 + st.anim * 2) * 14; if (x === 44) g.moveTo(x, y); else g.lineTo(x, y); }
    g.lineWidth = LW * 0.9; g.strokeStyle = 'rgba(23,10,54,.55)'; g.lineCap = 'round'; g.stroke();
    // which letter is next: little underlines
    for (let i = 0; i < n; i++) {
      rr(g, x0 + i * step - 20, 140, 40, 7, 3.5);
      g.fillStyle = i < st.pos ? C.mint : i === st.pos ? C.honey : C.lav2; g.fill();
      g.lineWidth = LW * 0.6; g.strokeStyle = INK; g.stroke();
    }
    // the mini keyboard
    const sw = st.swap > -9 ? clamp((st.anim - st.swap) / 0.18, 0, 1) : 1;
    for (let i = 0; i < 6; i++) {
      const k = keyXY(i);
      const f = clamp(1 - (st.anim - st.flash[i]) / 0.25, 0, 1), b = clamp(1 - (st.anim - st.bad[i]) / 0.3, 0, 1);
      const press = Math.max(f, b);
      g.save();
      g.translate(k.x + KB.w / 2 + wobble(st.anim - st.bad[i]), k.y + KB.h / 2);
      g.scale(0.85 + 0.15 * sw, 0.85 + 0.15 * sw);
      rr(g, -KB.w / 2, -KB.h / 2 + 5, KB.w, KB.h, 14); g.fillStyle = INK; g.fill();
      rr(g, -KB.w / 2, -KB.h / 2 + press * 4, KB.w, KB.h, 14);
      inked(g, b > 0 ? '#ffc2dc' : f > 0 ? C.mint : C.white, LW + 0.3);
      sticker(g, st.keys[i], 0, press * 4 + 2, 36, INK, { shadow: 0, outline: 0, stretch: 'semi-expanded' });
      g.restore();
    }
  },
  bot(st, B) {
    if (!B.ready) return;
    // (a blunder: one right letter, then all thumbs)
    const lost = B.blunder && st.pos >= 1;
    const want = lost ? st.keys.findIndex((c, i) => c !== st.word[st.pos] && i !== B.mem.last) : st.keys.indexOf(st.word[st.pos]);
    if (want < 0) return;
    const k = keyXY(want);
    B.go(k.x + KB.w / 2 + 4, k.y + KB.h / 2 + 8);
    if (B.near(k.x + KB.w / 2 + 4, k.y + KB.h / 2 + 8, 12) && B.tap() && lost) B.mem.last = want;
  },
};

// ======================================================================================= TURN IT!
const TN = { cx: 200, cy: 150, R: 112, by: 296, bw: 112, bh: 54 };
const PICTURE = {
  cat: (g) => cat(g, 0, 8, 150),
  house: (g) => house(g, 0, 10, 150),
  rocket: (g) => rocket(g, 0, 4, 150),
  icecream: (g) => icecream(g, 0, -6, 150),
};
export const norm180 = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
// ↻ (dir 1) or ↺ (dir -1): an arch over the top, its head at the end
export function curvedArrow(g, x, y, r, dir) {
  const a0 = dir > 0 ? Math.PI * 0.92 : Math.PI * 0.08, a1 = dir > 0 ? Math.PI * 2.08 : -Math.PI * 1.08;
  g.beginPath(); g.arc(x, y, r, a0, a1, dir < 0);
  g.lineWidth = LW * 1.6; g.strokeStyle = INK; g.lineCap = 'round'; g.stroke();
  const ex = x + Math.cos(a1) * r, ey = y + Math.sin(a1) * r;
  const tx = dir > 0 ? -Math.sin(a1) : Math.sin(a1), ty = dir > 0 ? Math.cos(a1) : -Math.cos(a1);
  const nx = -ty, ny = tx;
  g.beginPath();
  g.moveTo(ex + tx * 8, ey + ty * 8);
  g.lineTo(ex - tx * 3 + nx * 7, ey - ty * 3 + ny * 7);
  g.lineTo(ex - tx * 3 - nx * 7, ey - ty * 3 - ny * 7);
  g.closePath(); g.fillStyle = INK; g.fill();
}
export const turn = {
  id: 'turn', command: 'TURN IT!', hint: 'drag', keys: ['←', '→'], time: 1.1,
  setup(level, r, o = OPTS) {
    const a = level === 1 ? r.pick([90, 180, 270]) : r.pick([45, 90, 135, 180, 225, 270, 315]);
    return { pic: r.pick(Object.keys(PICTURE)), angle: a, show: a, drift: level === 3 ? r.sign() * 24 : 0, grab: null, tol: 16, upright: -1, btn: [-9, -9], keyTurn: false };
  },
  check(st) {
    const a = norm180(st.angle);
    if (Math.abs(a) <= st.tol) { st.angle -= a; st.upright = st.anim; fx(st, 'snap', TN.cx, TN.cy); done(st, 'pass'); }
  },
  btnAt(x, y) {
    for (const [i, bx] of [[0, TN.cx - 76], [1, TN.cx + 76]]) if (Math.abs(x - bx) < TN.bw / 2 + 8 && Math.abs(y - TN.by) < TN.bh / 2 + 10) return i;
    return -1;
  },
  down(st, x, y) {
    const b = this.btnAt(x, y);
    if (b >= 0) { st.angle += b === 0 ? -45 : 45; st.btn[b] = st.anim; st.pending = true; fx(st, 'turn', b === 0 ? TN.cx - 76 : TN.cx + 76, TN.by); return; }
    if (Math.hypot(x - TN.cx, y - TN.cy) < TN.R + 40) { st.grab = { a0: Math.atan2(y - TN.cy, x - TN.cx), ang0: st.angle, last: 0 }; fx(st, 'grab', x, y); }
  },
  move(st, x, y) {
    if (!st.grab) return;
    let da = Math.atan2(y - TN.cy, x - TN.cx) - st.grab.a0;
    // unwrap so a full turn keeps going
    while (da - st.grab.last > Math.PI) da -= TAU;
    while (da - st.grab.last < -Math.PI) da += TAU;
    st.grab.last = da;
    st.angle = st.grab.ang0 + (da * 180) / Math.PI;
    st.show = st.angle;
  },
  up(st) { if (st.grab) { st.grab = null; this.check(st); } },
  key(st, name) { if (name === 'left' || name === 'right') return; return false; },
  keyUp(st, name) { if ((name === 'left' || name === 'right') && st.keyTurn) { st.keyTurn = false; this.check(st); } },
  update(st, dt, io) {
    const dir = (io.held('right') ? 1 : 0) - (io.held('left') ? 1 : 0);
    if (dir) { st.angle += dir * 190 * dt; st.keyTurn = true; st.show = st.angle; }
    if (!st.grab && !dir) st.angle += st.drift * dt;
    st.show += (st.angle - st.show) * (1 - Math.exp(-22 * dt));
    // a button's turn lands upright: done (once it has turned)
    if (st.pending && !st.grab && !dir && Math.abs(st.show - st.angle) < 2) { st.pending = false; this.check(st); }
  },
  draw(g, st, v) {
    const { cx, cy, R } = TN;
    circle(g, cx + 3, cy + 6, R); g.fillStyle = INK; g.fill();
    circle(g, cx, cy, R); inked(g, st.upright >= 0 ? '#d4fff2' : '#eef3ff', LW + 0.4);
    // which way is up: a honey notch at the top of the frame
    g.beginPath(); g.moveTo(cx - 13, cy - R - 4); g.lineTo(cx + 13, cy - R - 4); g.lineTo(cx, cy - R + 14); g.closePath(); inked(g, C.honey);
    g.save();
    circle(g, cx, cy, R - LW); g.clip();
    g.translate(cx, cy); g.rotate((st.show * Math.PI) / 180);
    PICTURE[st.pic](g);
    g.restore();
    // the rotate buttons
    for (const [i, bx] of [[0, cx - 76], [1, cx + 76]]) {
      const pr = clamp(1 - (st.anim - st.btn[i]) / 0.16, 0, 1);
      rr(g, bx - TN.bw / 2, TN.by - TN.bh / 2 + 5, TN.bw, TN.bh, 16); g.fillStyle = INK; g.fill();
      rr(g, bx - TN.bw / 2, TN.by - TN.bh / 2 + pr * 4, TN.bw, TN.bh, 16); inked(g, C.honey, LW + 0.3);
      curvedArrow(g, bx, TN.by + pr * 4 + 4, 13, i === 0 ? -1 : 1);
    }
  },
  bot(st, B, dt) {
    if (!B.ready) return;
    const m = B.mem;
    const a = norm180(st.angle);
    // (a blunder: one turn the wrong way, then frozen, unsure)
    if (B.blunder) { if (m.erred) return; const bx = a > 0 ? TN.cx + 76 : TN.cx - 76; B.go(bx + 6, TN.by + 8); if (B.near(bx + 6, TN.by + 8, 10) && B.tap()) m.erred = true; return; }
    if (st.drift) {
      // a drifting picture: grab its edge and turn it by hand
      if (!st.grab && !m.dragging) {
        const phi = -Math.PI / 2 - 0.5;
        const gx = TN.cx + Math.cos(phi) * TN.R * 0.8, gy = TN.cy + Math.sin(phi) * TN.R * 0.8;
        B.go(gx, gy);
        if (B.near(gx, gy, 8)) { B.press(); m.dragging = true; m.phi = phi; m.goal = phi - (a * Math.PI) / 180; }
        return;
      }
      const dir = Math.sign(m.goal - m.phi);
      m.phi += dir * Math.min(Math.abs(m.goal - m.phi), 7 * dt);
      B.go(TN.cx + Math.cos(m.phi) * TN.R * 0.8, TN.cy + Math.sin(m.phi) * TN.R * 0.8);
      if (Math.abs(m.goal - m.phi) < 0.001 && B.settled(2)) { B.release(); m.dragging = false; }
      return;
    }
    if (Math.abs(st.show - st.angle) > 3) return;
    const steps = Math.round(-a / 45);
    if (!steps) return;
    const bx = steps < 0 ? TN.cx - 76 : TN.cx + 76;
    B.go(bx + 6, TN.by + 8);
    if (B.near(bx + 6, TN.by + 8, 10)) B.tap();
  },
};

// ======================================================================================= FIND THE BOT!
export function makeCrowd(level, r) {
  const [rows, cols, size] = [null, [2, 3, 104], [2, 5, 78], [3, 5, 68]][level];
  const people = [];
  const top = level === 3 ? 66 : 96, dy = level === 3 ? 100 : 128;
  for (let row = 0; row < rows; row++) {
    for (let c = 0; c < cols; c++) {
      const span = W - 70, x = 35 + (span * (c + 0.5)) / cols + (row % 2 ? (span / cols) * 0.18 : -(span / cols) * 0.1) + r.range(-6, 6);
      people.push({
        x: clamp(x, 40, W - 40), y: top + row * dy + r.range(-6, 6), s: size,
        look: { skin: r.int(0, LOOKS.skins - 1), hair: r.int(0, LOOKS.hairs - 1), shirt: r.int(0, LOOKS.shirts - 1), style: r.int(0, LOOKS.styles - 1) },
        ph: r.range(0, TAU), bot: false,
      });
    }
  }
  people[r.int(0, people.length - 1)].bot = true;
  return people;
}
export const findbot = {
  id: 'findbot', command: 'FIND THE BOT!', hint: 'tap', keys: ['←↑↓→', 'SPACE'], time: 1.15,
  setup(level, r, o = OPTS) {
    const people = makeCrowd(level, r);
    return { people, cur: Math.floor(people.length / 2), kb: Boolean(o.kb), wrong: -1, wrongAt: -9, found: -1, drift: level === 3 ? 16 : 0 };
  },
  pos(st, p, i) {
    const bob = Math.sin(st.anim * 5 + p.ph) * 3;
    const sway = st.drift ? Math.sin(st.anim * 1.6 + (p.y > 150 ? 1.5 : 0)) * st.drift : 0;
    return { x: p.x + sway, y: p.y + bob };
  },
  at(st, x, y) {
    // the front rows first (they're drawn on top)
    for (let i = st.people.length - 1; i >= 0; i--) {
      const p = st.people[i], q = this.pos(st, p, i);
      if (hitCircle(x, y, q.x, q.y, p.s * 0.48)) return i;
    }
    return -1;
  },
  choose(st, i) {
    if (i < 0) return;
    const p = st.people[i], q = this.pos(st, p, i);
    if (p.bot) { st.found = i; fx(st, 'good', q.x, q.y - p.s * 0.3); done(st, 'pass'); }
    else { st.wrong = i; st.wrongAt = st.anim; fx(st, 'bad', q.x, q.y); done(st, 'fail', 'wrong'); }
  },
  down(st, x, y) { this.choose(st, this.at(st, x, y)); },
  key(st, name) {
    if (KEYDIR.has(name)) {
      if (st.kb) { const items = st.people.map((p, i) => this.pos(st, p, i)); st.cur = stepSel(items, st.cur, name); }
      st.kb = true; return;
    }
    if (name === 'act') { if (st.kb) this.choose(st, st.cur); st.kb = true; return; }
    return false;
  },
  draw(g, st, v) {
    // a little stage: rows of seats
    g.fillStyle = '#f3eeff'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < st.people.length; i++) {
      const p = st.people[i], q = this.pos(st, p, i);
      g.save();
      if (st.wrong === i) g.translate(wobble(st.anim - st.wrongAt), 0);
      if (p.bot) robot(g, q.x, q.y + p.s * 0.06, p.s * 0.92, { mustache: st.level === 3, t: st.anim, blink: Math.sin(st.anim * 3 + p.ph) > 0.95 ? 1 : 0 });
      else person(g, q.x, q.y, p.s, p.look, { blink: Math.sin(st.anim * 2.3 + p.ph * 3) > 0.96 ? 1 : 0 });
      g.restore();
      if (st.wrong === i) { // "?!"
        sticker(g, '?!', q.x + p.s * 0.32, q.y - p.s * 0.5, 26, C.pink, { shadow: 0.05 });
      }
    }
    if (st.found >= 0) { const p = st.people[st.found], q = this.pos(st, p, st.found); circle(g, q.x, q.y - 4, p.s * 0.6); g.lineWidth = LW * 2; g.strokeStyle = C.mint; g.stroke(); g.lineWidth = LW * 0.8; g.strokeStyle = INK; g.stroke(); }
    if (st.kb) { const p = st.people[st.cur], q = this.pos(st, p, st.cur); selCircle(g, q.x, q.y - 2, p.s * 0.5, v.t); }
  },
  bot(st, B, dt) {
    const m = B.mem;
    if (!m.path) {
      // a glance at somebody or two first, then the robot
      const humans = st.people.map((p, i) => i).filter((i) => !st.people[i].bot);
      const bi = st.people.findIndex((p) => p.bot);
      m.path = [B.r.pick(humans)];
      if (B.r.chance(0.5)) m.path.push(B.r.pick(humans));
      m.path.push(B.blunder ? B.r.pick(humans) : bi);
      m.dwell = 0;
    }
    if (!B.ready) return;
    const i = m.path[0], p = st.people[i], q = this.pos(st, p, i);
    B.go(q.x + 6, q.y + 8);
    if (m.path.length > 1) {
      if (B.near(q.x + 6, q.y + 8, 18)) { m.dwell += dt; if (m.dwell > 0.06) { m.path.shift(); m.dwell = 0; } }
      return;
    }
    if (B.near(q.x + 6, q.y + 8, 10)) B.tap();
  },
};
