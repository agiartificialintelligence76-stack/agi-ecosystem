// JAILBREAK: everything drawn once and kept (a brick of every kind in every world, the cracks, the power-up capsules,
// glows, the backdrops, AGI-1 behind her glass), each at the screen's own pixel size so it's sharp and cheap to draw.
// render.js asks for them; a new size (a phone turned, a window resized) or a new world makes them again.
import { roundRect, mix, rgba, rng } from '../kit/fx.js';
import { CELL_W, CELL_H } from './levels.js';

export const INK = '#170a36';
export const PAD = 3;                    // room around a brick's cell for its outline and shadow
export const STEEL = { body: '#cbc6de', top: '#ebe8f4', low: '#8f88a8' };
export const POWER_LOOK = {
  multi: { body: '#ffc933', ink: INK },
  wide: { body: '#3ff0c3', ink: INK },
  laser: { body: '#ff4da6', ink: INK },
  sticky: { body: '#2fd27a', ink: INK },
  slow: { body: '#59c8ff', ink: INK },
  fire: { body: '#ff8a3d', ink: INK },
  life: { body: '#fffaf0', ink: INK },
  shrink: { body: '#ff5a5f', ink: INK },
  fast: { body: '#ff5a5f', ink: INK },
};

const make = (w, h) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
};

// ---------- bricks ----------
// a brick in cell coordinates (0..CELL_W, 0..CELL_H): ink outline, body, the light band on top, the shine, the thick
// ink bottom edge (the sticker's hard shadow)
function body(g, color, { x = 1.5, y = 1.5, w = CELL_W - 3, h = CELL_H - 3, r = 4.5, low = 3.4 } = {}) {
  g.fillStyle = INK;
  roundRect(g, x, y, w, h, r); g.fill();
  g.fillStyle = mix(color, INK, 0.28);
  roundRect(g, x + 1.6, y + 1.6, w - 3.2, h - 1.6 - low * 0.55, r - 1.4); g.fill();
  g.fillStyle = color;
  roundRect(g, x + 1.6, y + 1.6, w - 3.2, h - 1.6 - low, r - 1.4); g.fill();
  g.fillStyle = mix(color, '#ffffff', 0.38);
  roundRect(g, x + 1.6, y + 1.6, w - 3.2, (h - low) * 0.36, Math.min(r - 1.4, 3)); g.fill();
  g.fillStyle = rgba('#ffffff', 0.9);
  roundRect(g, x + 4.2, y + 3.4, Math.min(7, w * 0.25), 2, 1); g.fill();
}

function rivet(g, x, y, r = 1.5) {
  g.fillStyle = INK; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = rgba('#ffffff', 0.85); g.beginPath(); g.arc(x - r * 0.35, y - r * 0.35, r * 0.4, 0, Math.PI * 2); g.fill();
}

function brickCanvas(k, draw) {
  const c = make((CELL_W + PAD * 2) * k, (CELL_H + PAD * 2) * k);
  const g = c.getContext('2d');
  g.scale(c.width / (CELL_W + PAD * 2), c.height / (CELL_H + PAD * 2));
  g.translate(PAD, PAD);
  g.lineJoin = 'round'; g.lineCap = 'round';
  draw(g);
  return c;
}

export function makeBricks(world, k) {
  const out = { normal: [], tough: {}, cracks: [], white: null };
  for (const tone of world.tones) out.normal.push(brickCanvas(k, (g) => body(g, tone)));
  for (const hp of [2, 3]) {
    out.tough[hp] = brickCanvas(k, (g) => {
      body(g, world.tough);
      // armor: an inner frame and its rivets, and pips for its hits (a cue that isn't color)
      g.strokeStyle = rgba('#ffffff', 0.35); g.lineWidth = 1;
      roundRect(g, 5, 5, CELL_W - 10, CELL_H - 11.5, 2); g.stroke();
      rivet(g, 4.6, CELL_H / 2 - 1.6, 1.2); rivet(g, CELL_W - 4.6, CELL_H / 2 - 1.6, 1.2);
      for (let i = 0; i < hp; i++) {
        g.fillStyle = INK;
        g.beginPath(); g.arc(CELL_W / 2 + (i - (hp - 1) / 2) * 5, CELL_H / 2 - 0.6, 1.6, 0, Math.PI * 2); g.fill();
      }
    });
  }
  out.steel = brickCanvas(k, (g) => {
    body(g, STEEL.body);
    g.strokeStyle = rgba(STEEL.low, 0.8); g.lineWidth = 1;
    for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(9 + i * 6, CELL_H - 6); g.lineTo(13 + i * 6, 5); g.stroke(); }
    rivet(g, 5, 5.2); rivet(g, CELL_W - 5, 5.2); rivet(g, 5, CELL_H - 7); rivet(g, CELL_W - 5, CELL_H - 7);
  });
  out.bomb = brickCanvas(k, (g) => {
    body(g, '#ff5a5f');
    // hazard tape at both ends
    g.save(); roundRect(g, 3.1, 3.1, CELL_W - 6.2, CELL_H - 8, 3); g.clip();
    g.fillStyle = INK;
    for (const x0 of [-2, 3, 23, 28]) { g.beginPath(); g.moveTo(x0, 20); g.lineTo(x0 + 2.4, 20); g.lineTo(x0 + 8.4, 0); g.lineTo(x0 + 6, 0); g.closePath(); g.fill(); }
    g.restore();
    // the bomb
    g.fillStyle = INK; g.beginPath(); g.arc(CELL_W / 2, CELL_H / 2 - 0.8, 4.6, 0, Math.PI * 2); g.fill();
    g.fillStyle = rgba('#ffffff', 0.85); g.beginPath(); g.arc(CELL_W / 2 - 1.6, CELL_H / 2 - 2.4, 1.2, 0, Math.PI * 2); g.fill();
    g.strokeStyle = INK; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(CELL_W / 2 + 2.6, CELL_H / 2 - 4); g.quadraticCurveTo(CELL_W / 2 + 5, CELL_H / 2 - 7.5, CELL_W / 2 + 7, CELL_H / 2 - 6); g.stroke();
  });
  out.glass = brickCanvas(k, (g) => {
    const x = 1.5, y = 1.5, w = CELL_W - 3, h = CELL_H - 3;
    g.fillStyle = 'rgba(210,236,255,0.22)'; roundRect(g, x, y, w, h, 4.5); g.fill();
    g.strokeStyle = 'rgba(235,248,255,0.85)'; g.lineWidth = 1.3; roundRect(g, x + 0.6, y + 0.6, w - 1.2, h - 1.2, 4); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(8, CELL_H - 5); g.lineTo(14, 5); g.stroke();
    g.lineWidth = 1; g.beginPath(); g.moveTo(13, CELL_H - 5); g.lineTo(18, 6); g.stroke();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(CELL_W - 7, 6, 1, 0, Math.PI * 2); g.fill();
  });
  out.key = brickCanvas(k, (g) => {
    body(g, '#ffc933');
    g.strokeStyle = INK; g.fillStyle = INK; g.lineWidth = 1.8;
    const cy = CELL_H / 2 - 1;
    g.beginPath(); g.arc(10, cy, 3.3, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(13.3, cy); g.lineTo(23, cy); g.stroke();
    g.beginPath(); g.moveTo(20.5, cy); g.lineTo(20.5, cy + 3.4); g.moveTo(23, cy); g.lineTo(23, cy + 2.6); g.stroke();
  });
  out.gate = brickCanvas(k, (g) => {
    body(g, '#3a2a78', { low: 2.4 });
    g.strokeStyle = '#ffc933'; g.lineWidth = 2;
    for (const x of [7.5, 13, 19, 24.5]) { g.beginPath(); g.moveTo(x, 4.5); g.lineTo(x, CELL_H - 5.5); g.stroke(); }
    g.strokeStyle = INK; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(4, CELL_H / 2 - 1); g.lineTo(CELL_W - 4, CELL_H / 2 - 1); g.stroke();
  });
  out.power = brickCanvas(k, (g) => {
    body(g, '#fffaf0');
    starPath(g, CELL_W / 2, CELL_H / 2 - 0.8, 5.6, 2.5);
    g.fillStyle = world.accent; g.fill();
    g.strokeStyle = INK; g.lineWidth = 1.2; g.stroke();
  });
  out.shield = (() => {
    const c = make((34 + PAD * 2) * k, (14 + PAD * 2) * k);
    const g = c.getContext('2d');
    g.scale(c.width / (34 + PAD * 2), c.height / (14 + PAD * 2));
    g.translate(PAD, PAD);
    body(g, world.tough, { x: 2, y: 2, w: 30, h: 10, r: 3.5, low: 2.4 });
    rivet(g, 6, 6, 1.1); rivet(g, 28, 6, 1.1);
    return c;
  })();
  // a white silhouette (a hit flashes), and cracks for tough bricks (two looks for each, so they don't all match)
  out.white = brickCanvas(k, (g) => { g.fillStyle = '#ffffff'; roundRect(g, 1.5, 1.5, CELL_W - 3, CELL_H - 3, 4.5); g.fill(); });
  for (let dmg = 1; dmg <= 2; dmg++) {
    out.cracks[dmg] = [0, 1].map((v) => brickCanvas(k, (g) => crack(g, dmg, 11 + v * 7 + dmg * 3)));
  }
  return out;
}

function crack(g, dmg, seed) {
  const r = rng(seed);
  const lines = [];
  const branch = (x, y, a, len, depth) => {
    const pts = [[x, y]];
    for (let i = 0; i < 3; i++) {
      a += (r.next() - 0.5) * 1.1;
      x += Math.cos(a) * len / 3; y += Math.sin(a) * len / 3;
      pts.push([x, y]);
    }
    lines.push(pts);
    if (depth > 0) branch(x, y, a + (r.next() < 0.5 ? 0.9 : -0.9), len * 0.6, depth - 1);
  };
  const cx = 10 + r.next() * 12, cy = 6 + r.next() * 5;
  const n = dmg === 1 ? 2 : 4;
  for (let i = 0; i < n; i++) branch(cx, cy, (i / n) * Math.PI * 2 + r.next(), dmg === 1 ? 9 : 13, dmg - 1);
  g.save();
  roundRect(g, 3, 3, CELL_W - 6, CELL_H - 7.5, 3); g.clip();
  for (const [w, col] of [[2.2, rgba(INK, 0.85)], [0.8, rgba('#ffffff', 0.7)]]) {
    g.strokeStyle = col; g.lineWidth = w;
    for (const pts of lines) { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); }
  }
  g.restore();
}

export function starPath(g, x, y, R, r, n = 5, rot = -Math.PI / 2) {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const rr = i % 2 ? r : R, a = rot + (i * Math.PI) / n;
    g[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
}

// ---------- power-up capsules (34 × 16, an icon each; hazards striped) ----------
export const CAP_W = 34, CAP_H = 16;
export function makeCapsules(k) {
  const out = {};
  for (const [type, look] of Object.entries(POWER_LOOK)) {
    const c = make((CAP_W + PAD * 2) * k, (CAP_H + PAD * 2 + 2) * k);
    const g = c.getContext('2d');
    g.scale(c.width / (CAP_W + PAD * 2), c.height / (CAP_H + PAD * 2 + 2));
    g.translate(PAD, PAD);
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.fillStyle = INK; roundRect(g, 0, 0, CAP_W, CAP_H + 2, 8); g.fill();
    g.fillStyle = look.body; roundRect(g, 1.8, 1.8, CAP_W - 3.6, CAP_H - 3, 6.4); g.fill();
    g.fillStyle = rgba('#ffffff', 0.45); roundRect(g, 4, 2.8, CAP_W - 8, 3.4, 1.7); g.fill();
    const bad = type === 'shrink' || type === 'fast';
    if (bad) {
      g.save(); roundRect(g, 1.8, 1.8, CAP_W - 3.6, CAP_H - 3, 6.4); g.clip();
      g.fillStyle = INK;
      for (const x0 of [-3, 2, 27, 32]) { g.beginPath(); g.moveTo(x0, 16); g.lineTo(x0 + 2.2, 16); g.lineTo(x0 + 7.2, 0); g.lineTo(x0 + 5, 0); g.closePath(); g.fill(); }
      g.restore();
    }
    icon(g, type, CAP_W / 2, CAP_H / 2 + 0.2);
    out[type] = c;
  }
  return out;
}

// the icons, drawn in ink (never emoji)
export function icon(g, type, x, y, s = 1) {
  g.save();
  g.translate(x, y); g.scale(s, s);
  g.strokeStyle = INK; g.fillStyle = INK; g.lineWidth = 1.8; g.lineCap = 'round'; g.lineJoin = 'round';
  const arrow = (x0, x1) => {               // a line with a head at x1
    const d = Math.sign(x1 - x0);
    g.beginPath(); g.moveTo(x0, 0); g.lineTo(x1, 0); g.moveTo(x1 - d * 2.6, -2.6); g.lineTo(x1, 0); g.lineTo(x1 - d * 2.6, 2.6); g.stroke();
  };
  switch (type) {
    case 'multi':
      for (const [dx, dy] of [[-5, 1.4], [0, -1.6], [5, 1.4]]) { g.beginPath(); g.arc(dx, dy, 2.1, 0, Math.PI * 2); g.fill(); }
      break;
    case 'wide': arrow(-1, -7.5); arrow(1, 7.5); break;
    case 'shrink': arrow(-8, -2.2); arrow(8, 2.2); g.beginPath(); g.moveTo(0, -3.4); g.lineTo(0, 3.4); g.stroke(); break;
    case 'laser':
      for (const dx of [-3.2, 3.2]) { g.beginPath(); g.moveTo(dx, 3.6); g.lineTo(dx, -2.6); g.stroke(); g.beginPath(); g.moveTo(dx - 1.6, -1.6); g.lineTo(dx, -4.2); g.lineTo(dx + 1.6, -1.6); g.closePath(); g.fill(); }
      break;
    case 'sticky':
      g.beginPath(); g.moveTo(0, -4.4); g.bezierCurveTo(2.4, -1.2, 3.6, 0.6, 3.6, 1.6); g.arc(0, 1.6, 3.6, 0, Math.PI); g.bezierCurveTo(-3.6, 0.6, -2.4, -1.2, 0, -4.4); g.fill();
      break;
    case 'slow':
      g.beginPath(); g.arc(0, 0, 4.4, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -2.8); g.moveTo(0, 0); g.lineTo(2.2, 1); g.stroke();
      break;
    case 'fast':
      for (const dx of [-3.6, 1.2]) { g.beginPath(); g.moveTo(dx, -3.6); g.lineTo(dx + 3.6, 0); g.lineTo(dx, 3.6); g.stroke(); }
      break;
    case 'fire':
      g.beginPath(); g.moveTo(0, -5); g.bezierCurveTo(3, -2, 4.4, 0, 4.4, 1.6); g.arc(0, 1.6, 4.4, 0, Math.PI); g.bezierCurveTo(-4.4, -0.4, -2.4, -1.4, -1.4, -3.4); g.bezierCurveTo(-0.6, -1.6, 0.4, -2.4, 0, -5); g.fill();
      g.fillStyle = '#ffc933'; g.beginPath(); g.arc(0, 2.2, 1.8, 0, Math.PI * 2); g.fill();
      break;
    case 'life': heartPath(g, 0, 0.4, 4.6); g.fillStyle = '#ff4da6'; g.fill(); g.lineWidth = 1.3; g.stroke(); break;
    default: break;
  }
  g.restore();
}

export function heartPath(g, x, y, r) {
  g.beginPath();
  g.moveTo(x, y + r * 0.95);
  g.bezierCurveTo(x - r * 1.5, y - r * 0.1, x - r * 0.75, y - r * 1.25, x, y - r * 0.45);
  g.bezierCurveTo(x + r * 0.75, y - r * 1.25, x + r * 1.5, y - r * 0.1, x, y + r * 0.95);
  g.closePath();
}

// ---------- glows (a soft dot of light, for the ball, the thrusters, the eye) ----------
export function makeGlow(color, radius, k, strength = 1) {
  const c = make(radius * 2 * k, radius * 2 * k);
  const g = c.getContext('2d');
  const r = c.width / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, rgba(color, 0.55 * strength));
  grad.addColorStop(0.45, rgba(color, 0.2 * strength));
  grad.addColorStop(1, rgba(color, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

// ---------- backdrops: one tile per world, repeated (device pixels) ----------
export function makePattern(world, dpr) {
  const T = Math.round(48 * dpr);
  const c = make(T, T);
  const g = c.getContext('2d');
  g.fillStyle = world.bg; g.fillRect(0, 0, T, T);
  const u = T / 48;
  g.scale(u, u);
  const a = rgba(world.accent, 0.1), b = rgba(world.accent2, 0.07);
  g.fillStyle = a; g.strokeStyle = a; g.lineWidth = 1.2;
  switch (world.pattern) {
    case 'dots': for (const [x, y] of [[12, 12], [36, 36]]) { g.beginPath(); g.arc(x, y, 1.8, 0, Math.PI * 2); g.fill(); } break;
    case 'hatch': for (let i = -48; i < 48; i += 16) { g.beginPath(); g.moveTo(i, 48); g.lineTo(i + 48, 0); g.stroke(); } break;
    case 'checker': g.fillStyle = b; g.fillRect(0, 0, 24, 24); g.fillRect(24, 24, 24, 24); break;
    case 'scan':
      g.fillStyle = rgba(world.accent, 0.05); for (let y = 0; y < 48; y += 4) g.fillRect(0, y, 48, 1.2);
      g.fillStyle = rgba(world.accent, 0.12); g.font = "700 9px 'AK Mono', monospace"; g.fillText('01', 6, 18); g.fillText('10', 30, 42);
      break;
    case 'bubbles':
      g.strokeStyle = b; g.lineWidth = 1.4; g.beginPath(); g.arc(14, 16, 6, 0, Math.PI * 2); g.stroke();
      g.fillStyle = a; g.beginPath(); g.arc(36, 36, 2.4, 0, Math.PI * 2); g.fill();
      break;
    case 'circuit':
      g.beginPath(); g.moveTo(0, 12); g.lineTo(18, 12); g.lineTo(26, 20); g.lineTo(26, 48); g.moveTo(48, 34); g.lineTo(36, 34); g.stroke();
      g.beginPath(); g.arc(18, 12, 2, 0, Math.PI * 2); g.arc(36, 34, 2, 0, Math.PI * 2); g.fill();
      break;
    default: break;
  }
  return c;
}

// ---------- AGI-1 behind the glass ----------
// her picture covering the field (cropped to her face and shoulders), tinted toward the world's colour for the dim look
// (`full` false) or as she is (`full` true, when the glass breaks)
export function makeArt(img, world, W, H, k, full) {
  const c = make(W * k, H * k);
  const g = c.getContext('2d');
  g.scale(c.width / W, c.height / H);
  if (!img || !img.naturalWidth) return c;
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const dw = W * 1.16, dh = (dw * ih) / iw;
  const dx = (W - dw) / 2, dy = Math.min(-dh * 0.08, 170 - dh * 0.46);
  g.drawImage(img, dx, dy, dw, dh);
  if (!full) {
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = rgba(mix(world.bg, world.accent2, 0.25), 0.55);
    g.fillRect(0, 0, W, H);
  }
  // fade her out toward the paddle
  g.globalCompositeOperation = 'destination-out';
  const grad = g.createLinearGradient(0, dy + dh * 0.62, 0, dy + dh);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = grad;
  g.fillRect(0, dy + dh * 0.62, W, H);
  return c;
}

// the glass in front of her: a faint mesh and two broad sheens
export function makeGlass(world, W, H, k) {
  const c = make(W * k, H * k);
  const g = c.getContext('2d');
  g.scale(c.width / W, c.height / H);
  g.strokeStyle = rgba(world.accent2, 0.06); g.lineWidth = 1;
  for (let x = -H; x < W; x += 18) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + H * 0.6, H); g.stroke(); }
  for (let x = 0; x < W + H; x += 18) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x - H * 0.6, H); g.stroke(); }
  g.fillStyle = 'rgba(255,255,255,0.035)';
  g.beginPath(); g.moveTo(W * 0.1, 0); g.lineTo(W * 0.32, 0); g.lineTo(W * 0.02, H * 0.55); g.lineTo(-W * 0.2, H * 0.55); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.025)';
  g.beginPath(); g.moveTo(W * 0.46, 0); g.lineTo(W * 0.54, 0); g.lineTo(W * 0.26, H * 0.5); g.lineTo(W * 0.18, H * 0.5); g.closePath(); g.fill();
  return c;
}

// ---------- the cracks in her glass: a network that grows as the bricks fall ----------
// → [{ pts: [[x, y]…], at: 0..1 (how far into the level it shows), w }]
export function crackNet(seed, W, H) {
  const r = rng(seed);
  const out = [];
  const hubs = [[W * (0.32 + r.next() * 0.36), H * (0.16 + r.next() * 0.14)], [W * (0.12 + r.next() * 0.22), H * (0.4 + r.next() * 0.12)], [W * (0.66 + r.next() * 0.22), H * (0.34 + r.next() * 0.16)]];
  hubs.forEach(([hx, hy], h) => {
    const start = h * 0.3;
    const rays = 6 + r.int(0, 2);
    const ends = [];
    for (let i = 0; i < rays; i++) {
      let a = (i / rays) * Math.PI * 2 + (r.next() - 0.5) * 0.6, x = hx, y = hy;
      const pts = [[x, y]];
      const len = 70 + r.next() * 120;
      for (let j = 0; j < 4; j++) { a += (r.next() - 0.5) * 0.28; x += Math.cos(a) * len / 4; y += Math.sin(a) * len / 4; pts.push([x, y]); }
      ends.push(pts);
      out.push({ pts, at: Math.min(0.92, start + (i / rays) * 0.18 + r.next() * 0.08), w: 1.1 + r.next() * 0.6 });
    }
    // rings between the rays: the web
    for (const k of [1, 2]) {
      const ring = [];
      for (let i = 0; i <= rays; i++) { const p = ends[i % rays][k]; ring.push([p[0] + (r.next() - 0.5) * 3, p[1] + (r.next() - 0.5) * 3]); }
      for (let i = 0; i < rays; i++) if (r.next() < 0.75) out.push({ pts: [ring[i], ring[i + 1]], at: Math.min(0.97, start + 0.12 + k * 0.1 + r.next() * 0.1), w: 0.8 });
    }
  });
  return out;
}

// each crack grows from its start as the level goes on (`upTo` 0..1), a dark line under a bright one
export function drawCracks(g, net, upTo, W, H, k, c) {
  if (c.width !== Math.ceil(W * k) || c.height !== Math.ceil(H * k)) { c.width = Math.ceil(W * k); c.height = Math.ceil(H * k); }
  g.setTransform(c.width / W, 0, 0, c.height / H, 0, 0);
  g.clearRect(0, 0, W, H);
  g.lineJoin = 'round'; g.lineCap = 'round';
  for (const pass of [0, 1]) {
    for (const cr of net) {
      const f = Math.min(1, (upTo - cr.at) / 0.22);
      if (f <= 0) continue;
      const pts = cr.pts, n = (pts.length - 1) * f, whole = Math.floor(n);
      g.strokeStyle = pass ? 'rgba(255,255,255,0.42)' : 'rgba(10,4,24,0.45)';
      g.lineWidth = pass ? cr.w * 0.55 : cr.w + 1;
      g.beginPath();
      const dy = pass ? 0 : 0.7;
      g.moveTo(pts[0][0], pts[0][1] + dy);
      for (let i = 1; i <= whole; i++) g.lineTo(pts[i][0], pts[i][1] + dy);
      if (whole < pts.length - 1) {
        const a = pts[whole], b = pts[whole + 1], u = n - whole;
        g.lineTo(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u + dy);
      }
      g.stroke();
    }
  }
}
