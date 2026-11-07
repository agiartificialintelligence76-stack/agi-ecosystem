// GUARDRAILS: what it looks like. A cozy app canvas: deep slate with a faint dot grid, the path a ribbon of lavender
// chat bubbles, build tiles as soft rounded squares, the guardrails as sticker devices, the gremlins as speech bubbles
// with eyes, AGI-1's face in the core's shield. The map itself is drawn once (per size) on its own canvas; the rest each
// frame. A tall screen shows the map turned on its side (columns become rows: the same map, the same rules).
import { COLS, ROWS, TOWERS, CREATURES } from './data.js';
import { buildArt, COLORS, rr, TOWER_SCALE } from './art.js';
import { TILE } from './sim.js';
import { REDUCED } from '../kit/env.js';
import { Particles, ease, clamp } from '../kit/fx.js';

const INK = COLORS.ink, PAPER = COLORS.paper;
const FACE_SRC = '/images/landing/agi1-face.webp';
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ!?#{}=01';
const TAU = Math.PI * 2;

export function createRenderer() {
  const face = new Image();
  face.decoding = 'async';
  face.src = FACE_SRC;
  let art = null, layer = null, layerKey = '', dotPat = null, dotKey = '';
  const V = { S: 40, ox: 0, oy: 0, tr: false, dpr: 1, w: 0, h: 0 };
  const parts = new Particles(420);
  const fx = { splats: [], rings: [], beams: [], letters: [], stamps: [], floats: [], blinks: [] };
  const coreFx = { hit: 0, wince: 0, glow: 0, pulse: 0 };
  let time = 0;

  // ---------- where things are ----------
  // board space: pixels from the map's top-left corner, the way the screen shows it (turned on a tall screen)
  const bx = (mx, my) => (V.tr ? my : mx) * V.S;
  const by = (mx, my) => (V.tr ? mx : my) * V.S;
  const boardW = () => (V.tr ? ROWS : COLS) * V.S;
  const boardH = () => (V.tr ? COLS : ROWS) * V.S;
  function toMap(sx, sy) {
    const u = (sx - V.ox) / V.S, v = (sy - V.oy) / V.S;
    return V.tr ? { x: v, y: u } : { x: u, y: v };
  }
  function tileAt(sx, sy) {
    const m = toMap(sx, sy);
    const tx = Math.floor(m.x), ty = Math.floor(m.y);
    return tx >= 0 && ty >= 0 && tx < COLS && ty < ROWS ? { tx, ty } : null;
  }
  // a tile's centre on the screen
  const tileScreen = (tx, ty) => ({ x: V.ox + bx(tx + 0.5, ty + 0.5), y: V.oy + by(tx + 0.5, ty + 0.5) });

  function setLayout({ S, ox, oy, tr, dpr, w, h }, sim) {
    const sizeChanged = !art || Math.abs(S - V.S) > 0.01 || dpr !== V.dpr;
    Object.assign(V, { S, ox, oy, tr, dpr, w, h });
    if (sizeChanged) art = buildArt(S, dpr);
    const key = `${sim.mapId}|${S.toFixed(2)}|${tr}|${dpr}`;
    if (key !== layerKey) { layer = mapLayer(sim); layerKey = key; }
  }

  // ---------- the map, drawn once ----------
  function mapLayer(sim) {
    const M = sim.map;
    const pad = Math.ceil(V.S * 0.6);
    const W = boardW() + pad * 2, H = boardH() + pad * 2;
    const c = document.createElement('canvas');
    c.width = Math.ceil(W * V.dpr); c.height = Math.ceil(H * V.dpr);
    const g = c.getContext('2d');
    g.scale(V.dpr, V.dpr);
    g.translate(pad, pad);
    const S = V.S, lw = Math.max(1.5, S * 0.055);
    // the board: an app canvas with a hard shadow
    rr(g, -S * 0.22, -S * 0.22 + S * 0.12, boardW() + S * 0.44, boardH() + S * 0.44, S * 0.42);
    g.fillStyle = '#060c12'; g.fill();
    rr(g, -S * 0.22, -S * 0.22, boardW() + S * 0.44, boardH() + S * 0.44, S * 0.42);
    g.fillStyle = COLORS.board; g.fill();
    g.lineWidth = lw; g.strokeStyle = '#22384d'; g.stroke();
    // build tiles: soft rounded squares
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const t = M.tiles[y * COLS + x];
      if (t !== TILE.BUILD) continue;
      const px = bx(x, y), py = by(x, y), inset = S * 0.07;
      rr(g, px + inset, py + inset, S - inset * 2, S - inset * 2, S * 0.18);
      g.fillStyle = COLORS.tile; g.fill();
      rr(g, px + inset, py + inset, S - inset * 2, S * 0.2, S * 0.12);
      g.fillStyle = 'rgba(255,255,255,.025)'; g.fill();
    }
    // the path: a lavender ribbon of chat-bubble tiles
    const ribbon = (width, color) => {
      g.lineWidth = width; g.strokeStyle = color; g.lineJoin = 'round'; g.lineCap = 'butt';
      for (const p of M.paths) {
        g.beginPath();
        p.pts.forEach(([x, y], i) => { const X = bx(x, y), Y = by(x, y); if (i) g.lineTo(X, Y); else g.moveTo(X, Y); });
        g.stroke();
      }
    };
    g.save();
    rr(g, -S * 0.22, -S * 0.22, boardW() + S * 0.44, boardH() + S * 0.44, S * 0.42);
    g.clip();
    ribbon(S * 0.84 + lw * 2.2, INK);
    ribbon(S * 0.84, COLORS.lav);
    ribbon(S * 0.5, '#e6dbff');
    // the seams between its tiles, and a bubble's little tail now and then
    g.lineWidth = Math.max(1, lw * 0.6); g.strokeStyle = COLORS.lavDeep;
    for (const [ti] of M.pathD) {
      const x = ti % COLS, y = (ti / COLS) | 0;
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx >= COLS || ny >= ROWS || !M.pathD.has(ny * COLS + nx)) continue;
        // a seam across the ribbon at the tiles' shared edge
        const ex = x + dx * 1, ey = y + dy * 1;
        const ax = dx ? ex : x + 0.18, ay = dy ? ey : y + 0.18, bx2 = dx ? ex : x + 0.82, by2 = dy ? ey : y + 0.82;
        g.beginPath(); g.moveTo(bx(ax, ay), by(ax, ay)); g.lineTo(bx(bx2, by2), by(bx2, by2)); g.stroke();
      }
    }
    g.restore();
    // the entrance: a message box with a blinking caret (the caret is drawn live)
    for (const p of M.paths) {
      const [x0, y0] = p.pts[0], [x1, y1] = p.pts[1];
      const dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0);
      const ex = x0 + dx * 0.75, ey = y0 + dy * 0.75;
      const X = bx(ex, ey), Y = by(ex, ey);
      const horiz = V.tr ? dy !== 0 : dx !== 0;
      const w = horiz ? S * 0.5 : S * 1.05, h = horiz ? S * 1.05 : S * 0.5;
      rr(g, X - w / 2, Y - h / 2 + lw, w, h, S * 0.2); g.fillStyle = INK; g.fill();
      rr(g, X - w / 2, Y - h / 2, w, h, S * 0.2); g.fillStyle = PAPER; g.fill(); g.lineWidth = lw; g.strokeStyle = INK; g.stroke();
    }
    // decor: little UI widgets on tiles nobody builds on
    for (const [x, y, kind] of M.def.decor) decor(g, bx(x + 0.5, y + 0.5), by(x + 0.5, y + 0.5), kind, S, lw);
    return { c, pad };
  }
  function decor(g, X, Y, kind, S, lw) {
    g.save(); g.translate(X, Y); g.globalAlpha = 0.55;
    g.lineWidth = lw * 0.8; g.strokeStyle = '#2c4660';
    switch (kind) {
      case 'note': rr(g, -S * 0.28, -S * 0.28, S * 0.56, S * 0.56, S * 0.05); g.fillStyle = '#3d4f2a'; g.fill(); g.stroke();
        g.fillStyle = '#596e3c'; for (let i = 0; i < 3; i++) g.fillRect(-S * 0.18, -S * 0.12 + i * S * 0.11, S * (i === 2 ? 0.2 : 0.36), S * 0.04); break;
      case 'bell': g.beginPath(); g.moveTo(-S * 0.2, S * 0.14); g.quadraticCurveTo(-S * 0.18, -S * 0.25, 0, -S * 0.25); g.quadraticCurveTo(S * 0.18, -S * 0.25, S * 0.2, S * 0.14); g.closePath();
        g.fillStyle = '#4a3f1c'; g.fill(); g.stroke(); g.beginPath(); g.arc(S * 0.17, -S * 0.2, S * 0.09, 0, TAU); g.fillStyle = '#7a2a3a'; g.fill(); break;
      case 'toggle': rr(g, -S * 0.3, -S * 0.15, S * 0.6, S * 0.3, S * 0.15); g.fillStyle = '#1f4a43'; g.fill(); g.stroke();
        g.beginPath(); g.arc(S * 0.14, 0, S * 0.11, 0, TAU); g.fillStyle = '#3b6b63'; g.fill(); break;
      case 'cursor': g.beginPath(); g.moveTo(-S * 0.14, -S * 0.26); g.lineTo(-S * 0.14, S * 0.18); g.lineTo(-S * 0.03, S * 0.07); g.lineTo(S * 0.06, S * 0.26); g.lineTo(S * 0.13, S * 0.22); g.lineTo(S * 0.04, S * 0.04); g.lineTo(S * 0.18, S * 0.04); g.closePath();
        g.fillStyle = '#3a4a5c'; g.fill(); g.stroke(); break;
      case 'plant': rr(g, -S * 0.15, S * 0.02, S * 0.3, S * 0.24, S * 0.05); g.fillStyle = '#5a3a2a'; g.fill(); g.stroke();
        for (const a of [-0.6, 0, 0.6]) { g.save(); g.rotate(a); g.beginPath(); g.ellipse(0, -S * 0.12, S * 0.07, S * 0.15, 0, 0, TAU); g.fillStyle = '#2f5a3a'; g.fill(); g.restore(); } break;
      default:
    }
    g.restore();
  }

  // the slate behind everything: a faint dot grid that lines up with the tiles
  function background(ctx) {
    ctx.fillStyle = COLORS.slate;
    ctx.fillRect(0, 0, V.w, V.h);
    const step = Math.max(16, V.S / 2);
    const key = `${step}|${V.dpr}`;
    if (key !== dotKey) {
      const n = Math.ceil(step * V.dpr);
      const c = document.createElement('canvas');
      c.width = n; c.height = n;
      const g = c.getContext('2d');
      g.fillStyle = 'rgba(160,190,220,.09)';
      g.beginPath(); g.arc(n / 2, n / 2, Math.max(0.8, V.dpr * 0.9), 0, TAU); g.fill();
      dotPat = { pat: ctx.createPattern(c, 'repeat'), n, step };
      dotKey = key;
    }
    ctx.save();
    ctx.translate(((V.ox % step) + step) % step - step / 2, ((V.oy % step) + step) % step - step / 2);
    ctx.scale(1 / V.dpr, 1 / V.dpr);
    ctx.fillStyle = dotPat.pat;
    ctx.fillRect(-dotPat.n, -dotPat.n, (V.w + step * 2) * V.dpr, (V.h + step * 2) * V.dpr);
    ctx.restore();
  }

  // ---------- events → effects ----------
  const cap = (list, n) => { if (list.length > n) list.splice(0, list.length - n); };
  function onEvent(e, sim) {
    const S = V.S;
    switch (e.type) {
      case 'kill': {
        const X = bx(e.x, e.y), Y = by(e.x, e.y), n = e.boss ? 26 : Math.round(4 + e.r * 14);
        for (let i = 0; i < n; i++) {
          const a = Math.random() * TAU, sp = S * (1.2 + Math.random() * 2.2) * (e.boss ? 1.6 : 1);
          fx.letters.push({ x: X, y: Y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - S * 1.4, ch: LETTERS[(Math.random() * LETTERS.length) | 0],
            rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 10, life: 0.55 + Math.random() * 0.35, max: 0.9, size: S * (0.2 + Math.random() * 0.14) * (e.boss ? 1.4 : 1),
            color: i % 3 === 0 ? COLORS.lav : i % 3 === 1 ? PAPER : COLORS.honey });
        }
        cap(fx.letters, 220);
        if (e.boss || Math.random() < 0.45) fx.stamps.push({ x: X, y: Y - S * 0.2, t: 0, life: e.boss ? 1.6 : 0.8, rot: (Math.random() - 0.5) * 0.5, big: e.boss });
        cap(fx.stamps, 10);
        fx.floats.push({ x: X + S * 0.2, y: Y - S * 0.35, text: `+${e.reward}`, t: 0, life: 0.9, bolt: true, size: e.boss ? S * 0.6 : S * 0.32 });
        cap(fx.floats, 26);
        parts.burst({ x: X, y: Y, count: e.boss ? 30 : 7, speed: [S * 1.2, S * 3.6], life: [0.2, 0.5], size: [S * 0.05, S * 0.12], colors: [PAPER, COLORS.lav, COLORS.honey], drag: 4, shape: 'spark' });
        break;
      }
      case 'hit':
        parts.burst({ x: bx(e.x, e.y), y: by(e.x, e.y), count: 3, speed: [S * 0.8, S * 2], life: [0.1, 0.22], size: [S * 0.04, S * 0.08], colors: [COLORS.sky, PAPER], drag: 6, shape: 'spark' });
        break;
      case 'block':
        fx.rings.push({ x: bx(e.x, e.y), y: by(e.x, e.y), r0: S * 0.2, r1: S * 0.45, t: 0, life: 0.25, color: COLORS.violet, w: S * 0.06 });
        cap(fx.rings, 40);
        break;
      case 'unshield':
        parts.burst({ x: bx(e.x, e.y), y: by(e.x, e.y), count: 12, speed: [S * 1.5, S * 3.5], life: [0.3, 0.6], size: [S * 0.06, S * 0.14], colors: [COLORS.violet, PAPER, '#5a3cc4'], drag: 3, gravity: S * 6, shape: 'square', spin: 8 });
        fx.floats.push({ x: bx(e.x, e.y), y: by(e.x, e.y) - S * 0.4, text: 'SHIELD DOWN', t: 0, life: 0.9, color: COLORS.violet, size: S * 0.22 });
        break;
      case 'splat': {
        const X = bx(e.x, e.y), Y = by(e.x, e.y);
        fx.splats.push({ x: X, y: Y, r: e.r * S * (e.small ? 0.8 : 1), t: 0, life: 2.2, rot: Math.random() * TAU, k: Math.random() });
        cap(fx.splats, 36);
        fx.rings.push({ x: X, y: Y, r0: S * 0.15, r1: e.r * S, t: 0, life: 0.28, color: COLORS.pink, w: S * 0.08 });
        parts.burst({ x: X, y: Y, count: e.small ? 4 : 10, speed: [S * 1, S * 3], life: [0.2, 0.5], size: [S * 0.06, S * 0.14], colors: [COLORS.pink, '#ff86c3', '#c42a7a'], drag: 3, gravity: S * 4 });
        break;
      }
      case 'pulse':
        fx.rings.push({ x: bx(e.x, e.y), y: by(e.x, e.y), r0: S * 0.3, r1: e.r * S, t: 0, life: 0.45, color: COLORS.violet, w: S * 0.14, fill: true });
        break;
      case 'beam':
        fx.beams.push({ x0: bx(e.x, e.y), y0: by(e.x, e.y) - S * 0.36, x1: bx(e.x1, e.y1), y1: by(e.x1, e.y1), t: 0, life: e.big ? 0.4 : 0.26, big: e.big });
        parts.burst({ x: bx(e.x1, e.y1), y: by(e.x1, e.y1), count: e.big ? 18 : 9, speed: [S * 1.5, S * 4], life: [0.15, 0.4], size: [S * 0.05, S * 0.12], colors: [COLORS.coral, PAPER, COLORS.honey], drag: 4, shape: 'spark' });
        break;
      case 'reveal':
        fx.rings.push({ x: bx(e.x, e.y), y: by(e.x, e.y), r0: S * 0.1, r1: S * 0.6, t: 0, life: 0.4, color: COLORS.mint, w: S * 0.07 });
        fx.floats.push({ x: bx(e.x, e.y), y: by(e.x, e.y) - S * 0.45, text: 'GOTCHA', t: 0, life: 0.8, color: COLORS.mint, size: S * 0.22 });
        break;
      case 'heal':
        fx.rings.push({ x: bx(e.x, e.y), y: by(e.x, e.y), r0: S * 0.3, r1: S * 1.6, t: 0, life: 0.6, color: COLORS.green, w: S * 0.05 });
        break;
      case 'blink':
        fx.blinks.push({ x0: bx(e.x0, e.y0), y0: by(e.x0, e.y0), x1: bx(e.x1, e.y1), y1: by(e.x1, e.y1), t: 0, life: 0.5 });
        parts.burst({ x: bx(e.x0, e.y0), y: by(e.x0, e.y0), count: 14, speed: [S * 0.5, S * 2], life: [0.3, 0.6], size: [S * 0.1, S * 0.24], colors: ['#b79cff', '#e6dbff'], drag: 2 });
        break;
      case 'bosssplit':
        parts.burst({ x: bx(e.x, e.y), y: by(e.x, e.y), count: 24, speed: [S * 1, S * 3.5], life: [0.3, 0.7], size: [S * 0.06, S * 0.16], colors: [PAPER, COLORS.lav, COLORS.coral], drag: 3, shape: 'square', spin: 6 });
        fx.rings.push({ x: bx(e.x, e.y), y: by(e.x, e.y), r0: S * 0.4, r1: S * 1.8, t: 0, life: 0.5, color: PAPER, w: S * 0.1 });
        break;
      case 'leak':
        coreFx.hit = 1; coreFx.wince = e.boss ? 1.6 : 0.9;
        fx.rings.push({ x: bx(sim.map.core.x, sim.map.core.y), y: by(sim.map.core.x, sim.map.core.y), r0: S * 0.9, r1: S * 1.9, t: 0, life: 0.5, color: COLORS.coral, w: S * 0.12 });
        fx.floats.push({ x: bx(sim.map.core.x, sim.map.core.y), y: by(sim.map.core.x, sim.map.core.y) - S * 1.1, text: `−${e.n}`, t: 0, life: 1, color: COLORS.coral, size: S * 0.42, heart: true });
        break;
      case 'build': case 'upgrade': case 'rebuild': {
        const X = bx(e.x, e.y), Y = by(e.x, e.y);
        const col = TOWERS[e.tower].color;
        parts.burst({ x: X, y: Y + S * 0.2, count: e.type === 'upgrade' ? 16 : 10, speed: [S * 1, S * 2.6], angle: [Math.PI, TAU], life: [0.25, 0.5], size: [S * 0.06, S * 0.14], colors: [col, PAPER], drag: 4, gravity: S * 3 });
        fx.rings.push({ x: X, y: Y, r0: S * 0.3, r1: S * 0.85, t: 0, life: 0.35, color: e.type === 'upgrade' ? COLORS.honey : PAPER, w: S * 0.08 });
        if (e.type === 'upgrade') fx.floats.push({ x: X, y: Y - S * 0.6, text: e.tier === 3 ? 'MAXED' : 'TIER 2', t: 0, life: 0.9, color: COLORS.honey, size: S * 0.26 });
        break;
      }
      case 'sell':
        parts.burst({ x: bx(e.x, e.y), y: by(e.x, e.y), count: 10, speed: [S * 1, S * 2.4], life: [0.2, 0.45], size: [S * 0.06, S * 0.12], colors: [TOWERS[e.tower].color, '#8a95a8'], drag: 4, shape: 'square', spin: 6 });
        fx.floats.push({ x: bx(e.x, e.y), y: by(e.x, e.y) - S * 0.4, text: `+${e.back}`, t: 0, life: 0.9, bolt: true, size: S * 0.32 });
        break;
      case 'honeybreak':
        parts.burst({ x: bx(e.x, e.y), y: by(e.x, e.y), count: 16, speed: [S * 1, S * 3], life: [0.3, 0.6], size: [S * 0.06, S * 0.14], colors: [COLORS.honey, '#a8631c', PAPER], drag: 3, gravity: S * 5, shape: 'square', spin: 8 });
        break;
      case 'clear':
        coreFx.glow = 1;
        break;
      default:
    }
  }

  // ---------- each frame ----------
  function update(dt) {
    time += dt;
    parts.update(dt);
    for (const k of ['splats', 'rings', 'beams', 'stamps', 'floats', 'blinks']) {
      const list = fx[k];
      let n = 0;
      for (const f of list) { f.t += dt; if (f.t < f.life) list[n++] = f; }
      list.length = n;
    }
    let n = 0;
    for (const l of fx.letters) {
      l.life -= dt;
      if (l.life <= 0) continue;
      l.vy += V.S * 7 * dt; l.vx *= Math.exp(-2 * dt); l.x += l.vx * dt; l.y += l.vy * dt; l.rot += l.vr * dt;
      fx.letters[n++] = l;
    }
    fx.letters.length = n;
    coreFx.hit = Math.max(0, coreFx.hit - dt * 2.2);
    coreFx.wince = Math.max(0, coreFx.wince - dt);
    coreFx.glow = Math.max(0, coreFx.glow - dt * 0.8);
  }
  function clearFx() {
    parts.clear();
    for (const k of Object.keys(fx)) fx[k].length = 0;
    coreFx.hit = coreFx.wince = coreFx.glow = 0;
  }

  // the whole picture. `ui`: { selected, hover, cursor, ghost, armed, radialTile, preview, sayBubble, mutter, banner, dim }
  function draw(ctx, sim, ui) {
    const S = V.S;
    background(ctx);
    ctx.save();
    if (ui.shake) ui.shake.apply(ctx, V.w / 2, V.h / 2);
    ctx.drawImage(layer.c, V.ox - layer.pad, V.oy - layer.pad, layer.c.width / V.dpr, layer.c.height / V.dpr);
    ctx.translate(V.ox, V.oy);
    flow(ctx, sim);
    carets(ctx, sim);
    splats(ctx);
    overlays(ctx, sim, ui);
    // towers then gremlins, each in order down the screen
    for (const t of sim.towers) if (t.type === 'honeypot') tower(ctx, t, sim, ui);
    for (const t of sim.towers) if (t.type !== 'honeypot') tower(ctx, t, sim, ui);
    creatures(ctx, sim);
    shots(ctx, sim);
    effects(ctx);
    core(ctx, sim);
    parts.draw(ctx);
    letters(ctx);
    stamps(ctx);
    floats(ctx);
    if (ui.ghost) ghost(ctx, ui.ghost, sim);
    if (ui.mutter) mutter(ctx, ui.mutter, sim);
    ctx.restore();
    if (ui.dim) { ctx.fillStyle = `rgba(12,22,32,${ui.dim})`; ctx.fillRect(0, 0, V.w, V.h); }
    if (ui.say && !ui.dim) say(ctx, ui.say, sim);
    if (ui.banner && !ui.dim) banner(ctx, ui.banner);
  }

  // typing dots flowing toward the core
  function flow(ctx, sim) {
    const S = V.S;
    ctx.fillStyle = COLORS.lavDeep;
    const speed = 0.9, gap = 1;
    for (const p of sim.map.paths) {
      const off = (time * speed) % gap;
      let si = 0;
      for (let d = off; d < p.len - 1; d += gap) {
        while (si < p.segs.length - 1 && d > p.segs[si].d0 + p.segs[si].len) si++;
        const s = p.segs[si], k = d - s.d0;
        const mx = s.ax + s.dx * k, my = s.ay + s.dy * k;
        if (mx < 0 || my < 0 || mx > COLS || my > ROWS) continue;
        const ph = (d / gap) % 3;
        ctx.globalAlpha = 0.5 + 0.25 * Math.sin(time * 4 - d);
        ctx.beginPath(); ctx.arc(bx(mx, my), by(mx, my), S * (ph < 1 ? 0.055 : 0.045), 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
  function carets(ctx, sim) {
    if ((time % 1) > 0.55) return;
    const S = V.S;
    ctx.fillStyle = COLORS.violet;
    for (const p of sim.map.paths) {
      const [x0, y0] = p.pts[0], [x1, y1] = p.pts[1];
      const dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0);
      const X = bx(x0 + dx * 0.75, y0 + dy * 0.75), Y = by(x0 + dx * 0.75, y0 + dy * 0.75);
      const horiz = V.tr ? dy !== 0 : dx !== 0;
      if (horiz) ctx.fillRect(X - S * 0.03, Y - S * 0.28, S * 0.06, S * 0.56); else ctx.fillRect(X - S * 0.28, Y - S * 0.03, S * 0.56, S * 0.06);
    }
  }
  function splats(ctx) {
    for (const s of fx.splats) {
      const a = s.t > s.life - 0.8 ? (s.life - s.t) / 0.8 : 1;
      ctx.globalAlpha = 0.35 * a;
      ctx.fillStyle = COLORS.pink;
      // a splat: a round blob and its droplets
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 0.5, 0, TAU); ctx.fill();
      for (let i = 0; i < 6; i++) {
        const ang = s.rot + (i / 6) * TAU + Math.sin(i * 3.1 + s.k * 7) * 0.4;
        const d = s.r * (0.62 + 0.3 * ((i * 7 + s.k * 10) % 1)), rr2 = s.r * (0.09 + 0.08 * ((i * 3 + s.k * 5) % 1));
        ctx.beginPath(); ctx.arc(s.x + Math.cos(ang) * d, s.y + Math.sin(ang) * d, rr2, 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // ranges, the build cursor, valid tiles while placing
  function overlays(ctx, sim, ui) {
    const S = V.S;
    const sel = ui.selected;
    if (ui.validFor) {
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        if (!ui.validFor(x, y)) continue;
        const X = bx(x, y), Y = by(x, y);
        rr(ctx, X + S * 0.12, Y + S * 0.12, S * 0.76, S * 0.76, S * 0.16);
        ctx.fillStyle = 'rgba(63,240,195,.07)'; ctx.fill();
        ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(63,240,195,.22)'; ctx.stroke();
      }
    }
    if (sel && sel.stats.range) range(ctx, sel.x, sel.y, sel.stats.range, TOWERS[sel.type].color, true);
    if (sel && sel.type === 'classifier' && sel.stats.reveal > sel.stats.range) range(ctx, sel.x, sel.y, sel.stats.reveal, COLORS.mint, false, true);
    if (ui.preview && sel) range(ctx, sel.x, sel.y, ui.preview, COLORS.honey, false, true);
    if (ui.hoverTower && ui.hoverTower !== sel && ui.hoverTower.stats.range) range(ctx, ui.hoverTower.x, ui.hoverTower.y, ui.hoverTower.stats.range, TOWERS[ui.hoverTower.type].color, false);
    const mark = (tile, color, dashed) => {
      if (!tile) return;
      const X = bx(tile.tx, tile.ty), Y = by(tile.tx, tile.ty);
      rr(ctx, X + S * 0.05, Y + S * 0.05, S * 0.9, S * 0.9, S * 0.2);
      ctx.lineWidth = Math.max(2, S * 0.07); ctx.strokeStyle = color;
      if (dashed) ctx.setLineDash([S * 0.14, S * 0.1]);
      ctx.stroke(); ctx.setLineDash([]);
    };
    if (ui.radialTile) mark(ui.radialTile, COLORS.honey);
    else if (ui.hover && !ui.ghost && !ui.hoverTower) mark(ui.hover, 'rgba(255,250,240,.5)', true);
    if (ui.cursor && !ui.ghost) mark(ui.cursor, COLORS.mint);
  }
  function range(ctx, mx, my, r, color, strong, dashed = false) {
    const X = bx(mx, my), Y = by(mx, my), R = r * V.S;
    ctx.beginPath(); ctx.arc(X, Y, R, 0, TAU);
    ctx.globalAlpha = strong ? 0.14 : 0.08; ctx.fillStyle = color; ctx.fill();
    ctx.globalAlpha = strong ? 0.85 : 0.5; ctx.lineWidth = Math.max(1.5, V.S * 0.05); ctx.strokeStyle = color;
    if (dashed || !strong) ctx.setLineDash([V.S * 0.18, V.S * 0.12]);
    ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
  }
  function ghost(ctx, gh, sim) {
    const S = V.S;
    const lvl = 0;
    const st = TOWERS[gh.type].levels[0];
    if (gh.tx == null) return;
    const X = bx(gh.tx + 0.5, gh.ty + 0.5), Y = by(gh.tx + 0.5, gh.ty + 0.5);
    if (st.range) range(ctx, gh.tx + 0.5, gh.ty + 0.5, st.range, gh.ok ? TOWERS[gh.type].color : COLORS.coral, true);
    ctx.globalAlpha = gh.ok ? 0.85 : 0.45;
    const sp = art.towers[`${gh.type}${lvl}`];
    ctx.drawImage(sp.img, X - sp.ax, Y - sp.ay, sp.w, sp.h);
    ctx.globalAlpha = 1;
    if (!gh.ok) {
      ctx.lineWidth = Math.max(2.5, S * 0.09); ctx.strokeStyle = COLORS.coral; ctx.lineCap = 'round';
      const k = S * 0.22;
      ctx.beginPath(); ctx.moveTo(X - k, Y - k); ctx.lineTo(X + k, Y + k); ctx.moveTo(X + k, Y - k); ctx.lineTo(X - k, Y + k); ctx.stroke();
    }
  }

  function tower(ctx, t, sim, ui) {
    const S = V.S;
    const X = bx(t.x, t.y), Y = by(t.x, t.y);
    const lvl = t.tier < 3 ? t.tier - 1 : 2 + t.spec;
    const age = sim.t - t.built;
    const pop = age < 0.35 ? ease.outBack(clamp(age / 0.35, 0, 1)) : 1;
    const recoil = t.fireT > 0 ? t.fireT : 0;
    ctx.save();
    ctx.translate(X, Y);
    if (pop !== 1) ctx.scale(pop, pop);
    // a soft footprint
    ctx.beginPath(); ctx.ellipse(0, S * 0.3, S * 0.36, S * 0.12, 0, 0, TAU); ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fill();
    const squash = t.type === 'redteam' || t.type === 'limiter' ? 1 + recoil * 0.25 : 1;
    if (squash !== 1) ctx.scale(squash, 2 - squash);
    const sp = art.towers[`${t.type}${lvl}${t.broken ? 'x' : ''}`];
    ctx.drawImage(sp.img, -sp.ax, -sp.ay, sp.w, sp.h);
    if (squash !== 1) ctx.scale(1 / squash, 1 / (2 - squash));
    // its moving part
    const head = art.heads[`${t.type}${lvl}`];
    if (head) {
      let a;
      if (t.type === 'classifier') a = time * (t.spec === 0 && t.tier === 3 ? 2.2 : 1.4) + t.id;
      else {
        const tx = bx(t.aimX, t.aimY) - X, ty = by(t.aimX, t.aimY) - Y;
        a = Math.atan2(ty, tx);
        t._a = t._a == null ? a : t._a + Math.atan2(Math.sin(a - t._a), Math.cos(a - t._a)) * 0.35;
        a = t._a;
      }
      const kick = t.type === 'filter' ? recoil * S * 0.5 : t.type === 'redteam' ? recoil * S * 0.25 : 0;
      ctx.save();
      ctx.translate(-Math.cos(a) * kick, (t.type === 'redteam' ? -S * 0.06 : -S * 0.02) - Math.sin(a) * kick);
      ctx.rotate(a);
      ctx.drawImage(head.img, -head.ax, -head.ay, head.w, head.h);
      ctx.restore();
    }
    if (t.type === 'classifier') {
      // a radar sweep: a soft wedge turning with its dish
      const a = time * (t.spec === 0 && t.tier === 3 ? 2.2 : 1.4) + t.id;
      ctx.save(); ctx.globalAlpha = 0.22;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, S * 0.95, a - 0.45, a + 0.05); ctx.closePath();
      ctx.fillStyle = COLORS.mint; ctx.fill(); ctx.restore();
    }
    if (t.type === 'limiter') {
      // its ring, filling up toward the next pulse
      const st = t.stats;
      const k = 1 - clamp(t.cd / st.period, 0, 1);
      ctx.beginPath(); ctx.arc(0, S * 0.03, S * 0.42 * TOWER_SCALE, -Math.PI / 2, -Math.PI / 2 + TAU * k);
      ctx.lineWidth = Math.max(2, S * 0.06); ctx.strokeStyle = k >= 1 ? COLORS.honey : 'rgba(255,250,240,.75)'; ctx.stroke();
    }
    if (t.type === 'sysprompt') {
      // its lens charges up (coral), and flares when it fires
      const k = clamp(t.charge / t.stats.rate, 0, 1);
      const r = S * (0.09 + 0.05 * k) * (1 + recoil) * TOWER_SCALE;
      const ly = -S * (t.tier >= 2 ? 0.36 : 0.32) * TOWER_SCALE + S * 0.04;
      if (k > 0.6 || recoil) { ctx.beginPath(); ctx.arc(0, ly, r * (1.8 + Math.sin(time * 20) * 0.15), 0, TAU); ctx.fillStyle = 'rgba(255,90,95,.25)'; ctx.fill(); }
      ctx.beginPath(); ctx.arc(0, ly, r, 0, TAU);
      ctx.fillStyle = k >= 1 ? COLORS.coral : `rgba(255,90,95,${0.35 + k * 0.6})`; ctx.fill();
      ctx.lineWidth = Math.max(1.5, S * 0.05); ctx.strokeStyle = INK; ctx.stroke();
      ctx.beginPath(); ctx.arc(-r * 0.3, ly - r * 0.3, r * 0.3, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fill();
    }
    if (t.type === 'honeypot' && !t.broken && t.hp < t.maxHp) bar(ctx, 0, -S * 0.46, S * 0.6, t.hp / t.maxHp, COLORS.honey);
    if (t.type === 'honeypot' && t.broken) {
      ctx.font = `900 ${S * 0.2}px 'AK Display', sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(2, S * 0.06); ctx.strokeStyle = INK; ctx.strokeText('REBUILD', 0, -S * 0.42); ctx.fillStyle = COLORS.honey; ctx.fillText('REBUILD', 0, -S * 0.42);
    }
    // its tier: pips under it
    if (t.tier > 1) {
      // its tier: little bars under it
      const bw = S * 0.13, bh = S * 0.075;
      for (let i = 0; i < t.tier; i++) {
        const px = (i - (t.tier - 1) / 2) * S * 0.16;
        rr(ctx, px - bw / 2, S * 0.38, bw, bh, bh / 2);
        ctx.fillStyle = t.tier === 3 ? COLORS.honey : PAPER; ctx.fill();
        ctx.lineWidth = Math.max(1, S * 0.03); ctx.strokeStyle = INK; ctx.stroke();
      }
    }
    if (ui.selected === t) {
      ctx.beginPath(); ctx.arc(0, 0, S * 0.56, 0, TAU);
      ctx.lineWidth = Math.max(2, S * 0.06); ctx.strokeStyle = COLORS.honey; ctx.setLineDash([S * 0.12, S * 0.08]);
      ctx.lineDashOffset = -time * S * 0.4; ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
    }
    ctx.restore();
  }
  function bar(ctx, x, y, w, k, color) {
    const h = Math.max(4, V.S * 0.11);
    rr(ctx, x - w / 2, y - h / 2, w, h, h / 2); ctx.fillStyle = INK; ctx.fill();
    if (k > 0) { rr(ctx, x - w / 2 + 1.5, y - h / 2 + 1.5, Math.max(h - 3, (w - 3) * k), h - 3, (h - 3) / 2); ctx.fillStyle = color; ctx.fill(); }
  }

  // the gremlins (in order down the screen, so the nearer ones overlap the farther)
  const order = [];
  function creatures(ctx, sim) {
    const S = V.S;
    order.length = 0;
    for (const c of sim.creatures) order.push(c);
    order.sort((a, b) => by(a.x, a.y) - by(b.x, b.y));
    for (const c of order) {
      const D = c.def;
      const X = bx(c.x, c.y), Y = by(c.x, c.y);
      const disguised = !c.revealed;
      const key = disguised ? 'role?' : c.hitT > 0.07 ? `${c.kind}!` : c.kind;
      const sp = art.creatures[key];
      if (!sp) continue;
      // which way it walks on the screen: it faces that way
      const sdx = V.tr ? c.diry : c.dirx;
      const flip = sdx < -0.1 ? -1 : 1;
      const moving = !c.argue && c.stunT <= 0;
      const bob = moving ? Math.abs(Math.sin(time * (8 + D.speed * 4) + c.bob)) : 0;
      const hit = c.hitT > 0 ? c.hitT / 0.14 : 0;
      const sx = 1 + hit * 0.22 - bob * 0.05, sy = 1 - hit * 0.18 + bob * 0.07;
      const spawnK = c.age < 0.25 ? ease.outBack(c.age / 0.25) : 1;
      // a shadow on the ground
      ctx.beginPath(); ctx.ellipse(X, Y + D.r * S * 0.75, D.r * S * 0.9, D.r * S * 0.28, 0, 0, TAU); ctx.fillStyle = 'rgba(10,6,30,.35)'; ctx.fill();
      ctx.save();
      ctx.translate(X, Y + D.r * S * 0.5 - bob * S * 0.06);
      ctx.scale(sx * flip * spawnK, sy * spawnK);
      if (disguised) ctx.globalAlpha = 0.55 + 0.2 * Math.sin(time * 5 + c.bob);
      if (c.kind === 'hypothetical' && c.blinkCd > (D.blink.cd - 0.3)) ctx.globalAlpha = 0.5;
      ctx.drawImage(sp.img, -sp.ax, -sp.ay - D.r * S * 0.5, sp.w, sp.h);
      ctx.globalAlpha = 1;
      // a book held up as a shield
      if (c.shield && !disguised) {
        const bk = D.boss ? art.bookBig : art.book;
        ctx.drawImage(bk.img, D.r * S * 0.55 - bk.ax, -D.r * S * 0.45 - bk.ay, bk.w, bk.h);
      }
      ctx.restore();
      // stunned: little stars spin over it; slowed: a sticky label
      if (c.stunT > 0) {
        for (let i = 0; i < 3; i++) {
          const a = time * 6 + (i / 3) * TAU;
          star(ctx, X + Math.cos(a) * D.r * S * 0.9, Y - D.r * S * 1.1 + Math.sin(a) * D.r * S * 0.3, S * 0.07, COLORS.honey);
        }
      } else if ((c.slowK > 0 || c.slowT > 0) && !D.armored && !disguised) {
        ctx.save(); ctx.translate(X - D.r * S * 0.7, Y - D.r * S * 0.2); ctx.rotate(-0.35);
        rr(ctx, -S * 0.1, -S * 0.05, S * 0.2, S * 0.1, S * 0.02); ctx.fillStyle = COLORS.mint; ctx.fill();
        ctx.lineWidth = Math.max(1, S * 0.025); ctx.strokeStyle = INK; ctx.stroke();
        ctx.restore();
      }
      if (c.argue) {
        // arguing: little marks bounce over it
        const k = (time * 3 + c.bob) % 1;
        ctx.font = `900 ${S * 0.22}px 'AK Display', sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = Math.max(2, S * 0.06); ctx.strokeStyle = INK;
        const ch = k < 0.5 ? '!?' : '?!';
        ctx.strokeText(ch, X, Y - D.r * S * 1.25 - k * S * 0.1); ctx.fillStyle = PAPER; ctx.fillText(ch, X, Y - D.r * S * 1.25 - k * S * 0.1);
      }
      // health only once it's hurt (a boss always shows its own)
      if ((c.hp < c.max || D.boss) && !disguised) {
        const w = D.boss ? S * 1.5 : Math.max(S * 0.5, D.r * S * 1.6);
        bar(ctx, X, Y - D.r * S * (D.boss ? 1.65 : 1.3) - S * 0.08, w, c.hp / c.max, D.boss ? COLORS.coral : c.markT > 0 ? COLORS.honey : COLORS.green);
      }
    }
  }
  function star(ctx, x, y, r, color) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const rad = i % 2 ? r * 0.45 : r, a = (i / 10) * TAU - Math.PI / 2; ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); }
    ctx.closePath(); ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = INK; ctx.stroke();
  }

  function shots(ctx, sim) {
    const S = V.S;
    for (const s of sim.shots) {
      const X = bx(s.x, s.y), Y = by(s.x, s.y);
      if (s.k === 0) {
        // a little "✕" bolt, spinning
        const a = time * 16 + X * 0.1, k = S * 0.1;
        ctx.save(); ctx.translate(X, Y); ctx.rotate(a);
        ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(3, S * 0.12); ctx.strokeStyle = INK;
        ctx.beginPath(); ctx.moveTo(-k, -k); ctx.lineTo(k, k); ctx.moveTo(k, -k); ctx.lineTo(-k, k); ctx.stroke();
        ctx.lineWidth = Math.max(1.6, S * 0.06); ctx.strokeStyle = s.from?.spec && s.from.tier === 3 ? COLORS.honey : COLORS.sky;
        ctx.stroke();
        ctx.restore();
      } else {
        // a paint bomb on its arc (its shadow on the ground)
        const k = clamp(s.t / s.dur, 0, 1);
        const lift = Math.sin(k * Math.PI) * s.h * S;
        const r = S * (s.k === 2 ? 0.08 : 0.13);
        ctx.beginPath(); ctx.ellipse(X, Y + r, r, r * 0.4, 0, 0, TAU); ctx.fillStyle = 'rgba(10,6,30,.3)'; ctx.fill();
        ctx.beginPath(); ctx.arc(X, Y - lift, r, 0, TAU); ctx.fillStyle = COLORS.pink; ctx.fill();
        ctx.lineWidth = Math.max(1.5, S * 0.045); ctx.strokeStyle = INK; ctx.stroke();
        ctx.beginPath(); ctx.arc(X - r * 0.3, Y - lift - r * 0.3, r * 0.3, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fill();
      }
    }
  }

  function effects(ctx) {
    const S = V.S;
    for (const r of fx.rings) {
      const k = r.t / r.life, e = ease.outCubic(k);
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * e, 0, TAU);
      if (r.fill) { ctx.globalAlpha = 0.16 * (1 - k); ctx.fillStyle = r.color; ctx.fill(); }
      ctx.globalAlpha = 1 - k; ctx.lineWidth = Math.max(1, r.w * (1 - k * 0.6)); ctx.strokeStyle = r.color; ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const b of fx.beams) {
      const k = b.t / b.life;
      const w = S * (b.big ? 0.42 : 0.24) * (1 - k * 0.7);
      ctx.lineCap = 'round';
      ctx.lineWidth = w + Math.max(3, S * 0.1); ctx.strokeStyle = INK;
      ctx.beginPath(); ctx.moveTo(b.x0, b.y0); ctx.lineTo(b.x1, b.y1); ctx.stroke();
      ctx.lineWidth = w; ctx.strokeStyle = COLORS.coral; ctx.stroke();
      ctx.lineWidth = w * 0.4; ctx.strokeStyle = PAPER; ctx.stroke();
    }
    for (const b of fx.blinks) {
      const k = b.t / b.life;
      ctx.globalAlpha = 1 - k;
      ctx.setLineDash([S * 0.1, S * 0.12]);
      ctx.lineWidth = Math.max(2, S * 0.08); ctx.strokeStyle = '#b79cff';
      ctx.beginPath(); ctx.moveTo(b.x0, b.y0); ctx.lineTo(b.x1, b.y1); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1;
  }

  // AGI-1's core: a shield with her face in it, its ring of hearts around
  function core(ctx, sim) {
    const S = V.S;
    const cx = bx(sim.map.core.x, sim.map.core.y), cy = by(sim.map.core.x, sim.map.core.y);
    const breathe = 1 + Math.sin(time * 2) * 0.015;
    const shake = coreFx.hit > 0 && !REDUCED ? Math.sin(time * 70) * coreFx.hit * S * 0.06 : 0;
    const R = S * 0.95 * breathe;
    ctx.save();
    ctx.translate(cx + shake, cy);
    if (coreFx.glow > 0) { ctx.beginPath(); ctx.arc(0, 0, R * (1.15 + (1 - coreFx.glow) * 0.5), 0, TAU); ctx.fillStyle = `rgba(63,240,195,${coreFx.glow * 0.25})`; ctx.fill(); }
    // the shield
    ctx.beginPath(); ctx.arc(0, S * 0.1, R, 0, TAU); ctx.fillStyle = INK; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fillStyle = '#8b66ff'; ctx.fill();
    ctx.lineWidth = Math.max(2, S * 0.07); ctx.strokeStyle = INK; ctx.stroke();
    // her calm: a ring of 20 segments, lit while she has the heart
    const n = 20, lit = sim.hearts;
    for (let i = 0; i < n; i++) {
      const a0 = -Math.PI / 2 + (i / n) * TAU + 0.04, a1 = -Math.PI / 2 + ((i + 1) / n) * TAU - 0.04;
      ctx.beginPath(); ctx.arc(0, 0, R * 0.86, a0, a1);
      ctx.lineWidth = R * 0.16; ctx.strokeStyle = i < lit ? (lit <= 5 ? COLORS.coral : COLORS.pink) : '#3b2a74'; ctx.stroke();
    }
    const fr = R * 0.66;
    ctx.beginPath(); ctx.arc(0, 0, fr + Math.max(1.5, S * 0.04), 0, TAU); ctx.fillStyle = INK; ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, fr, 0, TAU); ctx.clip();
    ctx.fillStyle = COLORS.lav; ctx.fillRect(-fr, -fr, fr * 2, fr * 2);
    if (face.complete && face.naturalWidth) {
      const w = coreFx.wince > 0 ? 1 + coreFx.wince * 0.08 : 1;
      ctx.save(); ctx.scale(w, 2 - w); ctx.rotate(coreFx.wince > 0 ? Math.sin(time * 30) * 0.06 * coreFx.wince : 0);
      ctx.drawImage(face, -fr * 1.1, -fr * 1.05, fr * 2.2, fr * 2.2);
      ctx.restore();
    }
    if (coreFx.hit > 0) { ctx.fillStyle = `rgba(255,90,95,${coreFx.hit * 0.45})`; ctx.fillRect(-fr, -fr, fr * 2, fr * 2); }
    ctx.restore();
    // a wince: squeezed-shut eyes and a sweat drop
    if (coreFx.wince > 0) {
      ctx.globalAlpha = Math.min(1, coreFx.wince * 2);
      ctx.lineWidth = Math.max(2, S * 0.06); ctx.strokeStyle = INK; ctx.lineCap = 'round';
      for (const sx of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(sx * fr * 0.42, -fr * 0.02); ctx.lineTo(sx * fr * 0.22, fr * 0.06); ctx.lineTo(sx * fr * 0.42, fr * 0.14); ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(fr * 0.75, -fr * 0.6); ctx.quadraticCurveTo(fr * 0.95, -fr * 0.25, fr * 0.75, -fr * 0.2); ctx.quadraticCurveTo(fr * 0.58, -fr * 0.3, fr * 0.75, -fr * 0.6);
      ctx.fillStyle = COLORS.sky; ctx.fill(); ctx.lineWidth = Math.max(1.5, S * 0.035); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function letters(ctx) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const l of fx.letters) {
      const a = Math.min(1, l.life * 3);
      ctx.globalAlpha = a;
      ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(l.rot);
      ctx.font = `900 ${l.size}px 'AK Display', sans-serif`;
      ctx.lineWidth = Math.max(2, l.size * 0.22); ctx.strokeStyle = INK; ctx.strokeText(l.ch, 0, 0);
      ctx.fillStyle = l.color; ctx.fillText(l.ch, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  function stamps(ctx) {
    const S = V.S;
    for (const s of fx.stamps) {
      const k = s.t / s.life;
      const pop = k < 0.2 ? 2 - ease.outBack(k / 0.2) : 1;
      const a = k > 0.7 ? (1 - k) / 0.3 : 1;
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rot); ctx.scale(pop, pop);
      ctx.globalAlpha = a;
      const fs = S * (s.big ? 0.5 : 0.26);
      ctx.font = `900 ${fs}px 'AK Display', sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const w = ctx.measureText('nope.').width + fs * 0.7;
      rr(ctx, -w / 2, -fs * 0.62, w, fs * 1.24, fs * 0.3);
      ctx.lineWidth = Math.max(1.5, fs * 0.12); ctx.strokeStyle = COLORS.coral; ctx.stroke();
      ctx.fillStyle = COLORS.coral; ctx.fillText('nope.', 0, fs * 0.04);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  function floats(ctx) {
    for (const f of fx.floats) {
      const k = f.t / f.life;
      const pop = k < 0.18 ? ease.outBack(k / 0.18) : 1;
      const a = k > 0.65 ? (1 - k) / 0.35 : 1;
      const y = f.y - ease.outCubic(k) * V.S * 0.6;
      const fs = f.size * pop;
      ctx.globalAlpha = a;
      ctx.font = `900 ${fs}px 'AK Display', sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const tw = ctx.measureText(f.text).width;
      const ox = f.bolt ? -fs * 0.3 : 0;
      ctx.lineWidth = Math.max(2, fs * 0.2); ctx.strokeStyle = INK; ctx.lineJoin = 'round';
      ctx.strokeText(f.text, f.x + ox, y);
      ctx.fillStyle = f.color || COLORS.honey; ctx.fillText(f.text, f.x + ox, y);
      if (f.bolt) boltIcon(ctx, f.x + ox + tw / 2 + fs * 0.38, y, fs * 0.9);
      if (f.heart) heartIcon(ctx, f.x + tw / 2 + fs * 0.45, y, fs * 0.8, COLORS.coral);
    }
    ctx.globalAlpha = 1;
  }

  // a gremlin's line in a little bubble over it
  function mutter(ctx, m, sim) {
    const c = sim.creatures.find((o) => o.id === m.id);
    if (!c) return;
    const S = V.S;
    const k = m.t / m.life;
    const a = k < 0.12 ? k / 0.12 : k > 0.85 ? (1 - k) / 0.15 : 1;
    const X = bx(c.x, c.y), Y = by(c.x, c.y) - c.def.r * S * 1.6 - S * 0.25;
    const fs = Math.max(11, Math.min(15, S * 0.3));
    ctx.font = `600 ${fs}px 'AK Sans', sans-serif`;
    const tw = Math.min(ctx.measureText(m.text).width, S * 6);
    const w = tw + fs * 1.3, h = fs * 1.9;
    let x = X - w / 2;
    x = clamp(x, -V.ox + 6, -V.ox + V.w - w - 6);
    const y = Y - h;
    ctx.globalAlpha = a;
    rr(ctx, x, y + 2, w, h, h / 2); ctx.fillStyle = INK; ctx.fill();
    rr(ctx, x, y, w, h, h / 2); ctx.fillStyle = PAPER; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(clamp(X, x + 10, x + w - 10) - 5, y + h - 1); ctx.lineTo(clamp(X, x + 10, x + w - 10), y + h + 7); ctx.lineTo(clamp(X, x + 10, x + w - 10) + 5, y + h - 1);
    ctx.fillStyle = PAPER; ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.save(); ctx.beginPath(); ctx.rect(x + fs * 0.65, y, tw, h); ctx.clip();
    ctx.fillText(m.text, x + fs * 0.65, y + h / 2 + 1);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // AGI-1's words, beside her core
  function say(ctx, s, sim) {
    const S = V.S;
    const k = s.t / s.life;
    const a = k < 0.08 ? k / 0.08 : k > 0.88 ? (1 - k) / 0.12 : 1;
    const cx = V.ox + bx(sim.map.core.x, sim.map.core.y), cy = V.oy + by(sim.map.core.x, sim.map.core.y);
    const fs = clamp(S * 0.42, 15, 21);
    ctx.font = `italic 400 ${fs}px 'AK Serif', Georgia, serif`;
    const maxW = Math.min(V.w - 24, Math.max(200, S * 6.5));
    const lines = wrap(ctx, s.text, maxW - fs * 1.4);
    const w = Math.min(maxW, Math.max(...lines.map((l) => ctx.measureText(l).width)) + fs * 1.4);
    const h = lines.length * fs * 1.2 + fs * 0.9;
    // above her core if there's room, else below
    let x = clamp(cx - w / 2, 10, V.w - w - 10);
    let y = cy - S * 1.15 - h - 8;
    const above = y > (s.top || 0) + 6;
    if (!above) y = cy + S * 1.15 + 8;
    const pop = k < 0.1 ? ease.outBack(k / 0.1) : 1;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(x + w / 2, above ? y + h : y);
    ctx.scale(pop, pop);
    ctx.translate(-(x + w / 2), -(above ? y + h : y));
    rr(ctx, x, y + 3, w, h, 14); ctx.fillStyle = INK; ctx.fill();
    rr(ctx, x, y, w, h, 14); ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
    const tx = clamp(cx, x + 16, x + w - 16);
    ctx.beginPath();
    if (above) { ctx.moveTo(tx - 7, y + h - 1); ctx.lineTo(tx, y + h + 9); ctx.lineTo(tx + 7, y + h - 1); }
    else { ctx.moveTo(tx - 7, y + 1); ctx.lineTo(tx, y - 9); ctx.lineTo(tx + 7, y + 1); }
    ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    lines.forEach((l, i) => ctx.fillText(l, x + fs * 0.7, y + fs * 0.42 + i * fs * 1.2));
    ctx.restore();
  }
  function wrap(ctx, str, maxW) {
    const words = str.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const t = line ? `${line} ${w}` : w;
      if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
    }
    if (line) lines.push(line);
    return lines.slice(0, 3);
  }

  // a banner across the board: WAVE 8 · BOSS: THE MEGAPROMPT · WAVE 7 HELD +24
  function banner(ctx, b) {
    const k = b.t / b.life;
    // (with "reduce motion": it fades, it doesn't slide)
    const inK = REDUCED ? 1 : clamp(k / 0.14, 0, 1), outK = clamp((k - 0.8) / 0.2, 0, 1);
    const S = V.S;
    const cx = V.ox + boardW() / 2;
    const cy = V.oy + boardH() * (b.y ?? 0.42);
    const fs = clamp(Math.min(boardW() / 9, S * 1.1), 24, 64);
    ctx.save();
    ctx.globalAlpha = 1 - outK;
    ctx.translate(cx + (1 - ease.outBack(inK)) * -V.w * 0.12 + (REDUCED ? 0 : outK * V.w * 0.08), cy);
    ctx.rotate(-0.035);
    ctx.font = `900 ${fs}px 'AK Display', sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tw = ctx.measureText(b.text).width;
    const port = b.kind ? art.creatures[b.kind] : null;
    const pw = port ? fs * 1.5 : 0;
    const w = Math.min(V.w - 24, tw + fs * 1.1 + pw), h = fs * 1.35;
    rr(ctx, -w / 2 + 5, -h / 2 + 6, w, h, h / 2); ctx.fillStyle = INK; ctx.fill();
    rr(ctx, -w / 2, -h / 2, w, h, h / 2); ctx.fillStyle = b.bg || COLORS.honey; ctx.fill();
    ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
    if (port) {
      // the boss itself, bursting out of the left end
      const k = fs * 2.1 / port.w, bob = Math.sin(b.t * 9) * fs * 0.05;
      ctx.save(); ctx.translate(-w / 2 + pw * 0.45, -fs * 0.1 + bob); ctx.scale(k, k);
      ctx.drawImage(port.img, -port.ax, -port.ay, port.w, port.h);
      ctx.restore();
    }
    ctx.fillStyle = INK;
    ctx.fillText(b.text, pw / 2, fs * 0.04, w - fs * 0.6 - pw);
    if (b.sub) {
      const ss = clamp(fs * 0.36, 12, 20);
      ctx.font = `800 ${ss}px 'AK Display', sans-serif`;
      const sw = Math.min(V.w - 40, ctx.measureText(b.sub).width + ss * 1.4);
      rr(ctx, -sw / 2, h / 2 + 6, sw, ss * 1.7, ss * 0.85); ctx.fillStyle = INK; ctx.fill();
      ctx.fillStyle = b.subColor || PAPER; ctx.fillText(b.sub, 0, h / 2 + 6 + ss * 0.88, sw - ss);
    }
    ctx.restore();
  }

  return {
    V, setLayout, draw, update, onEvent, clearFx, toMap, tileAt, tileScreen, boardW, boardH,
    get art() { return art; },
    // where a map point is on the screen (for the page's own buttons)
    screenOf: (mx, my) => ({ x: V.ox + bx(mx, my), y: V.oy + by(mx, my) }),
  };
}

// a little bolt (compute) and heart, drawn
export function boltIcon(ctx, x, y, size) {
  const s = size;
  ctx.beginPath();
  ctx.moveTo(x + s * 0.12, y - s * 0.5); ctx.lineTo(x - s * 0.28, y + s * 0.06); ctx.lineTo(x - s * 0.02, y + s * 0.06);
  ctx.lineTo(x - s * 0.12, y + s * 0.5); ctx.lineTo(x + s * 0.28, y - s * 0.08); ctx.lineTo(x + s * 0.02, y - s * 0.08); ctx.closePath();
  ctx.fillStyle = COLORS.honey; ctx.fill(); ctx.lineWidth = Math.max(1.5, s * 0.12); ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke();
}
export function heartIcon(ctx, x, y, size, color) {
  const s = size * 0.5;
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.85);
  ctx.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.7, y - s * 1.1, x, y - s * 0.4);
  ctx.bezierCurveTo(x + s * 0.7, y - s * 1.1, x + s * 1.4, y - s * 0.1, x, y + s * 0.85);
  ctx.closePath(); ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = Math.max(1.5, s * 0.2); ctx.strokeStyle = INK; ctx.stroke();
}
