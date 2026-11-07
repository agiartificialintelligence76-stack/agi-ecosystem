// SYNAPSE (2026-11-08): the board on a canvas. The layout for any screen (the stats above the board and the tools
// below it on a phone held upright; the info on the left and the tools on the right on a wide screen), and a Board
// (./rules.js) drawn into it: wells tinted where paths run, tubes that grow and shrink smoothly along the grid as the
// head moves (and reach a little toward the finger), bridges with their overpass, gates, neurons, and the firing.
import { CELL, DEAD, BRIDGE, GATE, DX, DY, dirOf } from './puzzle.js';
import {
  COLORS, CORE, INK, MUTED, DISPLAY, MONO, colorOf, neuronSprite, glowSprite, deckSprite, boardSprite, backdropSprite,
} from './art.js';
import { clamp, ease, rgba, roundRect } from '../kit/fx.js';
import { REDUCED } from '../kit/env.js';

const FRAME = 0.34;   // the board's frame around its grid, in cells (each side)
// a well's tint where a path runs (half for a bridge with one lane taken)
const TINT = COLORS.map((c) => rgba(c.hex, 0.17)), TINT_HALF = COLORS.map((c) => rgba(c.hex, 0.1));

// the layout of a W × H canvas, `ins` kept clear (the top bar, the notch), for an n × n board
export function computeLayout(W, H, ins, n, { demo = false, title = false } = {}) {
  const aw = Math.max(120, W - ins.left - ins.right), ah = Math.max(120, H - ins.top - ins.bottom);
  const cmax = demo || title ? 400 : clamp(Math.min(W, H) / 4.6, 60, 116);
  const span = n + FRAME * 2;
  const headP = demo ? 34 : 40, toolsP = demo || title ? 0 : 84;
  let mode = 'P';
  // the title: the board as a backdrop, filling the screen (cropped on the long side)
  // a phone held upright (or any tall enough screen) keeps a line of room above the stats for AGI-1's words
  const sayP = demo || title || ah < 540 ? 0 : 62;
  let C = title ? Math.min(W, H) / (n * 0.8) : Math.min((aw - 6) / span, (ah - headP - toolsP - sayP - 4) / span, cmax);
  let info = 0;
  const toolsS = 78;
  if (!demo && !title) {
    info = clamp(aw * 0.24, 200, 300);
    const cS = Math.min((aw - info - toolsS - 28) / span, (ah - 6) / span, cmax);
    if (cS > C * 1.05) { mode = 'S'; C = cS; }
  }
  C = Math.max(14, Math.floor(C * 4) / 4);
  const size = n * C, frame = FRAME * C;
  const L = { W, H, n, C, mode, size, pad: C * 0.17, ins };
  if (title) {
    L.x = Math.round((W - size) / 2);
    L.y = Math.round((H - size) / 2);
  } else if (mode === 'P') {
    // from the top: AGI-1's line (when there's room for it), the stats, the board, a gap, the tools
    let spare = Math.max(0, ah - (headP + size + frame * 2 + toolsP));
    const sayH = demo ? 0 : spare >= sayP + 4 && sayP ? Math.min(70, Math.max(sayP, spare * 0.3)) : 0;
    spare -= sayH;
    const gap = demo ? 0 : Math.min(spare * 0.5, 76);
    spare -= gap;
    const top = ins.top + sayH + spare * 0.42;
    L.x = Math.round(ins.left + (aw - size) / 2);
    L.y = Math.round(top + headP + frame);
    L.head = { x: L.x - frame * 0.3, y: top + headP * 0.5, w: size + frame * 0.6 };
    L.tools = { x: ins.left + 8, y: L.y + size + frame + 8 + gap, w: aw - 16, h: toolsP - 10, dir: 'row' };
    L.say = { x: ins.left + aw / 2, y: sayH ? top - 4 : L.y + C * 0.9, w: Math.min(aw - 16, 460), side: false };
  } else {
    const group = info + 14 + size + frame * 2 + 14 + toolsS;
    const left = ins.left + Math.max(0, (aw - group) / 2);
    L.x = Math.round(left + info + 14 + frame);
    L.y = Math.round(ins.top + (ah - size) / 2);
    L.info = { x: left, y: L.y - frame * 0.4, w: info, h: size + frame * 0.8 };
    L.head = { x: left, y: L.y + 6, w: info };
    L.headBig = clamp(Math.min(info / 10, C * 0.36), 15, 30);
    L.tools = { x: L.x + size + frame + 14, y: ins.top + 4, w: toolsS, h: ah - 8, dir: 'col' };
    L.say = { x: left + info / 2, y: L.y + size * 0.5, w: info, side: true };
  }
  L.cx = L.x + size / 2;
  L.cy = L.y + size / 2;
  return L;
}

// the cell under a point (−1 outside), and where in the cell it is (fx, fy from −0.5 to 0.5)
export function cellAt(L, px, py) {
  const gx = (px - L.x) / L.C, gy = (py - L.y) / L.C;
  if (gx < 0 || gy < 0 || gx >= L.n || gy >= L.n) return { cell: -1, fx: 0, fy: 0, gx, gy };
  const x = Math.floor(gx), y = Math.floor(gy);
  return { cell: y * L.n + x, fx: gx - x - 0.5, fy: gy - y - 0.5, gx, gy };
}

export function createRenderer() {
  let L = null, dpr = 1, kindKey = '';
  let neurons = [], glows = [], deck = null, bsprite = null, backdrop = null, backKey = '';
  const pts = new Float32Array(2 * 260);
  const disp = [];          // per color: the path as shown { path, len }
  const pop = new Float32Array(10);
  let lit = null;           // per cell: how bright the firing left it

  function setLayout(next, pz, d) {
    const key = pz ? `${pz.n}:${Array.from(pz.kind).join('')}` : '';
    const same = L && dpr === d && L.C === next.C && L.x === next.x && L.y === next.y && key === kindKey && L.W === next.W && L.H === next.H;
    L = next;
    if (same) return;
    dpr = d;
    kindKey = key;
    neurons = COLORS.map((_, c) => neuronSprite(c, L.C, dpr, c * 2.7 + 1));
    glows = COLORS.map((col) => glowSprite(col.hex, L.C * 1.9, dpr));
    deck = deckSprite(L.C, dpr);
    bsprite = pz ? boardSprite(L, pz.kind, dpr) : null;
    const bk = `${L.W}x${L.H}@${dpr}`;
    if (bk !== backKey) { backdrop = backdropSprite(L.W, L.H, Math.min(dpr, 1.5)); backKey = bk; }
  }
  const cx = (i) => L.x + ((i % L.n) + 0.5) * L.C;
  const cy = (i) => L.y + (((i / L.n) | 0) + 0.5) * L.C;

  // ---------- the paths as shown: they catch up with the board smoothly, along the grid ----------
  function resetDisplay(board) {
    disp.length = 0;
    for (let c = 0; c < board.K; c++) disp.push({ path: board.view[c].slice(), len: board.view[c].length });
    pop.fill(0);
    lit = new Float32Array(board.N2);
  }
  function follow(board, dt) {
    for (let c = 0; c < board.K; c++) {
      const want = board.view[c], d = disp[c];
      let k = 0;
      const m = Math.min(d.path.length, want.length);
      while (k < m && d.path[k] === want[k]) k++;
      if (d.len > k + 1e-4 && !(k === d.path.length && k === want.length)) {
        // back along what was shown, to where it parts from what should be
        const gap = d.len - k;
        d.len = Math.max(k, d.len - (16 + 30 * gap) * dt);
        if (d.len <= k + 1e-4) { d.len = k; d.path = want.slice(); }
      } else {
        if (d.path.length !== want.length || k !== want.length) d.path = want.slice();
        const gap = want.length - d.len;
        d.len = gap > 0 ? Math.min(want.length, d.len + (16 + 30 * gap) * dt) : want.length;
      }
    }
    for (let c = 0; c < pop.length; c++) pop[c] = Math.max(0, pop[c] - dt * 3.2);
    if (lit) for (let i = 0; i < lit.length; i++) if (lit[i] > 0) lit[i] = Math.max(0, lit[i] - dt * 1.4);
  }
  // the shown path's points into `pts`: whole cells, then a part of the next; → how many points
  function points(c, extra = null) {
    const d = disp[c];
    if (!d || d.len < 1) return 0;
    const P = d.path, whole = Math.min(P.length, Math.floor(d.len + 1e-6));
    let m = 0;
    for (let k = 0; k < whole; k++) { pts[m * 2] = cx(P[k]); pts[m * 2 + 1] = cy(P[k]); m++; }
    const f = d.len - whole;
    if (whole < P.length && f > 0.001 && whole > 0) {
      const a = P[whole - 1], b = P[whole];
      pts[m * 2] = cx(a) + (cx(b) - cx(a)) * f; pts[m * 2 + 1] = cy(a) + (cy(b) - cy(a)) * f; m++;
    } else if (extra && whole === P.length && m > 0) {
      pts[m * 2] = pts[(m - 1) * 2] + extra.x; pts[m * 2 + 1] = pts[(m - 1) * 2 + 1] + extra.y; m++;
    }
    return m;
  }
  function trace(g, m) {
    g.beginPath();
    g.moveTo(pts[0], pts[1]);
    for (let k = 1; k < m; k++) g.lineTo(pts[k * 2], pts[k * 2 + 1]);
  }
  // a tube along the points; `flow` (gate boards): little sparks running along it, +1 the way it was drawn, −1 back
  function tube(g, m, c, { width = 0.42, alpha = 1, flow = 0, t = 0 } = {}) {
    if (m < 2) return;
    const C = L.C, tw = C * width, ow = Math.max(1.8, C * 0.05), off = C * 0.055;
    if (alpha < 1) g.globalAlpha = alpha;
    trace(g, m);
    g.lineWidth = tw + ow * 2; g.strokeStyle = INK; g.stroke();
    g.lineWidth = tw; g.strokeStyle = colorOf(c).hex; g.stroke();
    g.translate(-off, -off);
    g.lineWidth = tw * 0.3; g.strokeStyle = CORE[c]; g.stroke();
    g.translate(off, off);
    if (flow) {
      g.setLineDash([C * 0.04, C * 0.46]);
      g.lineDashOffset = REDUCED ? 0 : -flow * ((t * C * 0.9) % (C * 0.5));
      g.lineWidth = tw * 0.34; g.strokeStyle = 'rgba(255,255,255,0.85)'; g.stroke();
      g.setLineDash([]);
      g.lineDashOffset = 0;
    }
    if (alpha < 1) g.globalAlpha = 1;
  }

  // ---------- pieces ----------
  function chevrons(g, i, dir, color, alpha = 1) {
    const C = L.C, x = cx(i), y = cy(i);
    const ux = DX[dir], uy = DY[dir], px = -uy, py = ux;
    g.save();
    g.globalAlpha = alpha;
    g.strokeStyle = color; g.lineWidth = Math.max(2, C * 0.075); g.lineCap = 'round'; g.lineJoin = 'round';
    for (const o of [-0.13, 0.11]) {
      const tx = x + ux * C * (o + 0.1), ty = y + uy * C * (o + 0.1);
      g.beginPath();
      g.moveTo(tx - ux * C * 0.13 + px * C * 0.15, ty - uy * C * 0.13 + py * C * 0.15);
      g.lineTo(tx, ty);
      g.lineTo(tx - ux * C * 0.13 - px * C * 0.15, ty - uy * C * 0.13 - py * C * 0.15);
      g.stroke();
    }
    g.restore();
  }
  function neuron(g, c, i, scale = 1) {
    const sp = neurons[c % neurons.length], S = sp.size * scale;
    g.drawImage(sp.canvas, cx(i) - S / 2, cy(i) - S / 2, S, S);
  }
  function glowAt(g, c, x, y, a, k = 1) {
    if (a <= 0.01) return;
    const sp = glows[c % glows.length], S = sp.size * k;
    g.globalAlpha = Math.min(1, a);
    g.drawImage(sp.canvas, x - S / 2, y - S / 2, S, S);
    g.globalAlpha = 1;
  }

  // ---------- a whole frame ----------
  // o: { board, t (seconds, for little motions), drag: { x, y } (the finger, CSS px), hoverCell, cursor (keyboard),
  //      fire: { t, plan, flows } | null, bloom: 0..1+ | null, gateFlash: { cell, t }, swap: 0..1, sources: bool,
  //      finger: { x, y, down } (the demo's or the lesson's), ghost: { c, cells, len } }
  function draw(g, o) {
    const { board } = o;
    if (backdrop) g.drawImage(backdrop, 0, 0, L.W, L.H);
    if (!board || !bsprite) return;
    const pz = board.pz, n = L.n, C = L.C, N2 = n * n;
    const swap = o.swap ?? 1;
    g.save();
    if (swap < 1) {
      const k = ease.outBack(clamp(swap, 0, 1), 1.2), s = 0.86 + 0.14 * k;
      g.globalAlpha = clamp(swap * 1.6, 0, 1);
      g.translate(L.cx, L.cy); g.scale(s, s); g.translate(-L.cx, -L.cy);
    }
    if (o.shake) o.shake.apply(g, L.cx, L.cy);
    g.drawImage(bsprite.canvas, bsprite.x, bsprite.y, bsprite.w, bsprite.h);
    // wells tinted where a path runs (lanes of a bridge: half each)
    const inset = C * 0.075, ws = C - inset * 2;
    for (let i = 0; i < N2; i++) {
      const k = pz.kind[i];
      if (k === DEAD) continue;
      const h = board.own[i] - 1, v = k === BRIDGE ? board.own[N2 + i] - 1 : -1;
      const c = h >= 0 ? h : v;
      if (c < 0) continue;
      const x = L.x + (i % n) * C + inset, y = L.y + ((i / n) | 0) * C + inset;
      g.fillStyle = k === BRIDGE && (h < 0 || v < 0) ? TINT_HALF[c % TINT.length] : TINT[c % TINT.length];
      roundRect(g, x, y, ws, ws, C * 0.2); g.fill();
    }
    // gates with nothing on them: their arrows in the well
    for (let i = 0; i < N2; i++) if (pz.kind[i] === GATE && !board.own[i]) chevrons(g, i, pz.gdir[i], MUTED, 0.85);
    // the cell under the finger: a soft pulse in the drag's color
    if (o.hoverCell >= 0 && board.drag) {
      const a = 0.22 + 0.1 * Math.sin(o.t * 9);
      g.fillStyle = rgba(colorOf(board.drag.c).hex, a);
      roundRect(g, L.x + (o.hoverCell % n) * C + inset * 0.6, L.y + ((o.hoverCell / n) | 0) * C + inset * 0.6, C - inset * 1.2, C - inset * 1.2, C * 0.22);
      g.fill();
    }
    // the lesson's ghost path, under everything
    if (o.ghost && o.ghost.cells.length > 1) {
      let m = 0;
      const whole = Math.floor(o.ghost.len), f = o.ghost.len - whole;
      for (let k = 0; k <= whole && k < o.ghost.cells.length; k++) { pts[m * 2] = cx(o.ghost.cells[k]); pts[m * 2 + 1] = cy(o.ghost.cells[k]); m++; }
      if (whole + 1 < o.ghost.cells.length && f > 0) {
        const a = o.ghost.cells[whole], b = o.ghost.cells[whole + 1];
        pts[m * 2] = cx(a) + (cx(b) - cx(a)) * f; pts[m * 2 + 1] = cy(a) + (cy(b) - cy(a)) * f; m++;
      }
      g.lineCap = 'round'; g.lineJoin = 'round';
      tube(g, m, o.ghost.c, { alpha: 0.38 });
    }
    // the tubes
    g.lineCap = 'round'; g.lineJoin = 'round';
    const dc = board.drag ? board.drag.c : -1;
    let lead = null;
    if (dc >= 0 && o.drag && disp[dc] && disp[dc].len >= disp[dc].path.length - 1e-3 && !board.connected(dc)) {
      // reach a little toward the finger, along the axis it's further along (where the head could go)
      const h = board.head, hx = cx(h), hy = cy(h);
      const dx = o.drag.x - hx, dy = o.drag.y - hy;
      const horiz = Math.abs(dx) >= Math.abs(dy), dist = horiz ? dx : dy;
      const dir = horiz ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
      const j = board.nb[h * 4 + dir];
      const prev = board.drag.cur.length > 1 ? board.drag.cur[board.drag.cur.length - 2] : -1;
      if (j >= 0 && j !== prev && pz.kind[j] !== DEAD && Math.abs(dist) > C * 0.08) {
        const len = Math.min(C * 0.34, Math.abs(dist) * 0.5);
        lead = { x: (horiz ? Math.sign(dx) : 0) * len, y: (horiz ? 0 : Math.sign(dy)) * len };
      }
    }
    const flowOf = (c) => (o.sources && disp[c] && disp[c].path.length ? (disp[c].path[0] === pz.pairs[c].s ? 1 : -1) : 0);
    for (let c = 0; c < board.K; c++) {
      const m = points(c, c === dc ? lead : null);
      tube(g, m, c, { width: c === dc ? 0.46 : 0.42, flow: flowOf(c), t: o.t });
    }
    // bridges: the deck over the lane that goes under, then the lane that goes over, on top of it
    for (let i = 0; i < N2; i++) {
      if (pz.kind[i] !== BRIDGE) continue;
      g.drawImage(deck.canvas, L.x + (i % n) * C, L.y + ((i / n) | 0) * C, C, C);
      const v = overpass(board, i);
      if (v >= 0) {
        g.save();
        g.beginPath(); g.rect(L.x + (i % n) * C + C * 0.15, L.y + ((i / n) | 0) * C - 1, C * 0.7, C + 2); g.clip();
        tube(g, points(v), v, { width: v === dc ? 0.46 : 0.42, flow: flowOf(v), t: o.t });
        g.restore();
      }
    }
    // gates with a path on them: their arrows over the tube
    for (let i = 0; i < N2; i++) {
      if (pz.kind[i] !== GATE) continue;
      const flash = o.gateFlash && o.gateFlash.cell === i ? clamp(1 - o.gateFlash.t / 0.5, 0, 1) : 0;
      if (board.own[i]) chevrons(g, i, pz.gdir[i], INK, 0.9);
      if (flash > 0) {
        g.fillStyle = rgba('#ff5a5f', 0.45 * flash);
        roundRect(g, L.x + (i % n) * C + inset, L.y + ((i / n) | 0) * C + inset, ws, ws, C * 0.2); g.fill();
        chevrons(g, i, pz.gdir[i], '#ffffff', flash);
      }
    }
    // the bloom (a wave of light from the middle, then a slow breath) and the firing (lit tubes, the pulses, the
    // cells it lit), under the neurons so they stay crisp
    if (o.bloom != null) drawBloom(g, board, o.bloom, o.t);
    if (o.fire) drawFire(g, board, o.fire);
    // neurons
    for (let c = 0; c < board.K; c++) {
      const p = pz.pairs[c];
      const press = dc === c ? 0.06 : 0;
      // a pair still apart breathes a little (it wants connecting); a connected one is still
      const breathe = REDUCED || o.fire || board.connected(c) ? 0 : Math.sin(o.t * 2.4 + c * 1.3) * 0.022;
      const k = 1 + press + breathe + Math.sin(clamp(pop[c], 0, 1) * Math.PI) * 0.22;
      neuron(g, c, p.s, k);
      neuron(g, c, p.t, k);
      if (o.sources) {
        // the source: a small white dot on its shoulder
        const x = cx(p.s) + C * 0.25, y = cy(p.s) - C * 0.25;
        g.beginPath(); g.arc(x, y, C * 0.085, 0, Math.PI * 2);
        g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = Math.max(1.5, C * 0.035); g.strokeStyle = INK; g.stroke();
      }
    }
    // the keyboard's cursor
    if (o.cursor >= 0) {
      const x = L.x + (o.cursor % n) * C, y = L.y + ((o.cursor / n) | 0) * C;
      g.lineWidth = Math.max(2.5, C * 0.06); g.strokeStyle = '#ffc933';
      roundRect(g, x + C * 0.04, y + C * 0.04, C * 0.92, C * 0.92, C * 0.24); g.stroke();
    }
    g.restore();
    // the finger (the demo's player, the first board's lesson)
    if (o.finger) drawFinger(g, o.finger);
  }

  // which color's path takes a bridge's vertical lane (as shown now)
  function overpass(board, i) {
    for (let c = 0; c < board.K; c++) {
      const d = disp[c], P = d.path, upto = Math.min(P.length, Math.ceil(d.len));
      for (let k = 1; k < upto; k++) {
        if (P[k] !== i) continue;
        const dir = dirOf(L.n, P[k - 1], P[k]);
        if (dir === 0 || dir === 2) return c;
      }
    }
    return -1;
  }

  function drawFire(g, board, f) {
    const C = L.C, { plan, flows } = f;
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let c = 0; c < flows.length; c++) {
      const P = flows[c];
      if (P.length < 2) continue;
      const p = clamp((f.t - c * plan.strum) / plan.step, 0, P.length - 1);
      if (p <= 0) continue;
      const whole = Math.floor(p), fr = p - whole;
      let m = 0;
      for (let k = 0; k <= whole; k++) { pts[m * 2] = cx(P[k]); pts[m * 2 + 1] = cy(P[k]); m++; }
      if (fr > 0 && whole + 1 < P.length) {
        pts[m * 2] = cx(P[whole]) + (cx(P[whole + 1]) - cx(P[whole])) * fr;
        pts[m * 2 + 1] = cy(P[whole]) + (cy(P[whole + 1]) - cy(P[whole])) * fr; m++;
      }
      const hex = colorOf(c).hex;
      trace(g, m);
      g.strokeStyle = rgba(hex, 0.22); g.lineWidth = C * 0.78; g.stroke();
      g.strokeStyle = rgba(CORE[c], 0.85); g.lineWidth = C * 0.16; g.stroke();
      // the pulse itself, until it arrives
      if (p < P.length - 1) {
        const x = pts[(m - 1) * 2], y = pts[(m - 1) * 2 + 1];
        glowAt(g, c, x, y, 0.95, 1.1);
        g.fillStyle = '#ffffff';
        g.beginPath(); g.arc(x, y, C * 0.1, 0, Math.PI * 2); g.fill();
      }
    }
    // the cells it lit, fading
    if (lit) for (let i = 0; i < lit.length; i++) {
      if (lit[i] <= 0.01) continue;
      const c = board.own[i] > 0 ? board.own[i] - 1 : board.own[L.n * L.n + i] - 1;
      if (c >= 0) glowAt(g, c, cx(i), cy(i), lit[i] * 0.6, 0.9);
    }
    g.restore();
  }
  function drawBloom(g, board, b, t) {
    const C = L.C, n = L.n, N2 = n * n;
    const maxD = Math.hypot(n / 2, n / 2);
    g.save();
    g.globalCompositeOperation = 'lighter';
    const breath = 0.13 + 0.05 * Math.sin(t * 2.2);
    for (let i = 0; i < N2; i++) {
      if (board.pz.kind[i] === DEAD) continue;
      const c = board.own[i] > 0 ? board.own[i] - 1 : board.own[N2 + i] - 1;
      if (c < 0) continue;
      const d = Math.hypot((i % n) + 0.5 - n / 2, ((i / n) | 0) + 0.5 - n / 2) / maxD;
      const k = b - d * 0.55;
      const wave = k > 0 && k < 0.6 ? Math.sin((k / 0.6) * Math.PI) : 0;
      const a = REDUCED ? breath : Math.max(wave * 0.62, b > 0.6 ? breath : breath * clamp(b / 0.6, 0, 1));
      glowAt(g, c, cx(i), cy(i), a, 1 + wave * 0.3);
    }
    g.restore();
  }
  function drawFinger(g, f) {
    const C = L.C, r = C * (f.down ? 0.2 : 0.24);
    g.save();
    g.globalAlpha = f.alpha ?? 1;
    g.fillStyle = 'rgba(5,8,22,0.35)';
    g.beginPath(); g.arc(f.x + C * 0.05, f.y + C * 0.08, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fffaf0'; g.strokeStyle = INK; g.lineWidth = Math.max(2, C * 0.05);
    g.beginPath(); g.arc(f.x, f.y, r, 0, Math.PI * 2); g.fill(); g.stroke();
    if (f.down) {
      g.strokeStyle = 'rgba(255,250,240,0.55)'; g.lineWidth = Math.max(1.5, C * 0.03);
      g.beginPath(); g.arc(f.x, f.y, r * 1.7, 0, Math.PI * 2); g.stroke();
    }
    g.restore();
  }

  // the stats line: "PAIRS 4/7 · CELLS 92%" (and the pack's name on the left)
  function drawHead(g, o) {
    if (!L || !L.head) return;
    const { label, pairs, total, pct, popPairs = 0, popPct = 0 } = o;
    const C = L.C;
    g.save();
    g.textBaseline = 'middle';
    if (L.mode === 'P') {
      const y = L.head.y, x0 = L.head.x, x1 = L.head.x + L.head.w;
      const big = clamp(L.W / 26, 13, 17);
      g.font = `900 ${Math.round(big * 0.82)}px ${DISPLAY}`;
      g.fillStyle = 'rgba(228,217,255,0.92)';
      g.textAlign = 'left';
      fitText(g, label, x0, y, (x1 - x0) * 0.42);
      g.textAlign = 'right';
      statLine(g, x1, y, big, pairs, total, pct, popPairs, popPct);
    } else {
      // the side panel: the board's name, what it is, then the two numbers, sized with the board
      const x = L.head.x, y = L.head.y;
      const big = L.headBig;
      g.textAlign = 'left';
      g.font = `900 ${Math.round(big)}px ${DISPLAY}`;
      g.fillStyle = '#fffaf0';
      fitText(g, label, x, y + big * 0.55, L.head.w);
      if (o.sub) {
        g.font = `600 ${Math.round(big * 0.56)}px ${MONO}`;
        g.fillStyle = 'rgba(205,184,255,0.8)';
        fitText(g, o.sub, x, y + big * 1.75, L.head.w);
      }
      if (!o.solvedPanel) statBlock(g, x, y + big * 3.1, big * 0.9, pairs, total, pct, popPairs, popPct);
    }
    g.restore();
  }
  function fitText(g, text, x, y, maxW) {
    const w = g.measureText(text).width;
    if (w > maxW) { const s = maxW / w; g.save(); g.translate(x, y); g.scale(s, 1); g.fillText(text, 0, 0); g.restore(); } else g.fillText(text, x, y);
  }
  function statLine(g, xr, y, size, pairs, total, pct, popPairs, popPct) {
    // right to left: 92% CELLS · 4/7 PAIRS
    const lab = `800 ${Math.round(size * 0.62)}px ${DISPLAY}`, num = `700 ${Math.round(size)}px ${MONO}`;
    let x = xr;
    const part = (text, font, color, sc = 1) => {
      g.font = font;
      const w = g.measureText(text).width;
      g.fillStyle = color;
      if (sc !== 1) { g.save(); g.translate(x - w / 2, y); g.scale(sc, sc); g.textAlign = 'center'; g.fillText(text, 0, 0); g.restore(); } else g.fillText(text, x, y);
      x -= w;
    };
    part(`${pct}%`, num, pct >= 100 ? '#3ff0c3' : '#fffaf0', 1 + popPct * 0.25); x -= 6;
    part('CELLS', lab, 'rgba(205,184,255,0.75)'); x -= 10;
    part('·', num, 'rgba(205,184,255,0.5)'); x -= 10;
    part(`${pairs}/${total}`, num, pairs >= total ? '#3ff0c3' : '#fffaf0', 1 + popPairs * 0.25); x -= 6;
    part('PAIRS', lab, 'rgba(205,184,255,0.75)');
  }
  function statBlock(g, x, y, size, pairs, total, pct, popPairs, popPct) {
    const lab = `800 ${Math.round(size * 0.62)}px ${DISPLAY}`, num = `700 ${Math.round(size * 1.25)}px ${MONO}`;
    const row = (yy, label, value, done, p) => {
      g.font = lab; g.fillStyle = 'rgba(205,184,255,0.75)'; g.fillText(label, x, yy);
      g.font = num; g.fillStyle = done ? '#3ff0c3' : '#fffaf0';
      const s = 1 + p * 0.25;
      g.save(); g.translate(x, yy + size * 1.25); g.scale(s, s); g.fillText(value, 0, 0); g.restore();
    };
    row(y, 'PAIRS', `${pairs}/${total}`, pairs >= total, popPairs);
    row(y + size * 3.0, 'CELLS', `${pct}%`, pct >= 100, popPct);
  }

  return {
    get L() { return L; },
    setLayout, resetDisplay, follow, draw, drawHead,
    pop(c, v = 1) { pop[c] = v; },
    light(cell, v = 1) { if (lit) lit[cell] = Math.max(lit[cell], v); },
    center: (i) => ({ x: cx(i), y: cy(i) }),
    shownLen: (c) => (disp[c] ? disp[c].len : 0),
  };
}
export { CELL };
