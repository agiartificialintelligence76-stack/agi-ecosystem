// EPOCHS: AGI-1 as a small chibi, drawn in code (no image files): long wavy blonde hair, amber eyes, her lavender AGI
// shirt, lavender shorts with white trim, lavender sneakers. Four directions (left is right mirrored), a step frame, a
// wave, and her echoes: the same drawing tinted per epoch, see-through scanlines like an old hologram.
// Frames are drawn once per tile size into small canvases (createSprites(u, dpr)) and stamped each frame.

const INK = '#170a36';
const SKIN = '#ffe2cc', SKIN_SH = '#f6c3a8';
const HAIR = '#f7d394', HAIR_LT = '#fff0c8', HAIR_SH = '#e2ad6e';
const SHIRT = '#e4d2ff', SHIRT_SH = '#c7a8f5', SHORTS = '#a983ec', TRIM = '#ffffff', SHOE = '#cdb3ff', SOLE = '#fffaf0';
const EYE = '#d98a2b', EYE_DK = '#6a3210', BLUSH = 'rgba(255,120,150,.45)';
export const TINTS = ['#8b66ff', '#ff4da6', '#3ff0c3', '#ffc933'];   // v1 v2 v3 v4

// the sprite's box, in tiles: 1.2 wide, 1.62 tall; her feet at (0.6, 1.5)
export const BOX = { w: 1.2, h: 1.62, fx: 0.6, fy: 1.5 };

function path(g, pts) { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); }
function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function ell(g, x, y, rx, ry) { g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2); }

// one pose, drawn in a unit box (u = one tile in pixels). dir: 0 up (her back), 1 right, 2 down (her face), 3 left.
// frame: 0 standing, 1 a step, 2 waving (front only)
function drawPose(g, u, dir, frame) {
  const lw = Math.max(1.2, u * 0.045);
  g.lineJoin = 'round'; g.lineCap = 'round'; g.lineWidth = lw; g.strokeStyle = INK;
  const cx = 0.6 * u;
  const side = dir === 1 || dir === 3;
  const step = frame === 1;
  const fill = (c) => { g.fillStyle = c; g.fill(); g.stroke(); };

  // hair behind her (long, wavy, down her back)
  const hairBack = () => {
    g.beginPath();
    const top = 0.18 * u, bot = side ? 1.02 * u : 1.0 * u, w = side ? 0.36 * u : 0.42 * u;
    const ox = side ? cx - 0.08 * u : cx;
    g.moveTo(ox - w, 0.5 * u);
    g.bezierCurveTo(ox - w - 0.06 * u, 0.2 * u, ox - 0.1 * u, top - 0.02 * u, ox, top);
    g.bezierCurveTo(ox + 0.1 * u, top - 0.02 * u, ox + w + 0.06 * u, 0.2 * u, ox + w, 0.5 * u);
    // the wavy ends
    g.bezierCurveTo(ox + w + 0.05 * u, 0.75 * u, ox + w - 0.06 * u, 0.86 * u, ox + w - 0.02 * u, bot - 0.04 * u);
    g.quadraticCurveTo(ox + w * 0.55, bot + 0.04 * u, ox + w * 0.3, bot - 0.03 * u);
    g.quadraticCurveTo(ox, bot + 0.05 * u, ox - w * 0.3, bot - 0.03 * u);
    g.quadraticCurveTo(ox - w * 0.55, bot + 0.04 * u, ox - w + 0.02 * u, bot - 0.04 * u);
    g.bezierCurveTo(ox - w + 0.06 * u, 0.86 * u, ox - w - 0.05 * u, 0.75 * u, ox - w, 0.5 * u);
    g.closePath();
    fill(HAIR_SH);
  };

  // legs and sneakers
  const legs = () => {
    const ly = 1.2 * u, lh = 0.2 * u;
    const pairs = side
      ? [[cx - 0.05 * u + (step ? -0.07 * u : 0), 0], [cx + 0.03 * u + (step ? 0.07 * u : 0), 0]]
      : [[cx - 0.1 * u, step ? -0.03 * u : 0], [cx + 0.1 * u, step ? 0.02 * u : 0]];
    for (const [x, dy] of pairs) {
      rr(g, x - 0.055 * u, ly + dy, 0.11 * u, lh, 0.04 * u); fill(SKIN);
      // a sneaker
      ell(g, x + (side ? (dir === 1 ? 0.025 : -0.025) * u : 0), 1.43 * u + dy, side ? 0.1 * u : 0.08 * u, 0.06 * u); fill(SHOE);
      g.beginPath(); g.moveTo(x - 0.07 * u, 1.465 * u + dy); g.lineTo(x + 0.07 * u, 1.465 * u + dy);
      g.strokeStyle = SOLE; g.lineWidth = lw * 0.9; g.stroke(); g.strokeStyle = INK; g.lineWidth = lw;
    }
  };

  // shorts and shirt
  const body = () => {
    const w = side ? 0.34 * u : 0.46 * u;
    rr(g, cx - w / 2, 1.08 * u, w, 0.17 * u, 0.05 * u); fill(SHORTS);
    g.beginPath(); g.moveTo(cx - w / 2 + 0.02 * u, 1.235 * u); g.lineTo(cx + w / 2 - 0.02 * u, 1.235 * u);
    g.strokeStyle = TRIM; g.lineWidth = lw * 0.8; g.stroke(); g.strokeStyle = INK; g.lineWidth = lw;
    // the shirt: a soft trapezoid
    const sw = side ? 0.36 * u : 0.5 * u, top = 0.84 * u, bot = 1.13 * u;
    g.beginPath();
    g.moveTo(cx - sw * 0.42, top);
    g.quadraticCurveTo(cx, top - 0.03 * u, cx + sw * 0.42, top);
    g.lineTo(cx + sw * 0.5, bot); g.quadraticCurveTo(cx, bot + 0.025 * u, cx - sw * 0.5, bot); g.closePath();
    fill(SHIRT);
    // its little AGI print (letters when there's room, a stripe when tiny)
    if (dir === 2) {
      if (u >= 34) {
        g.fillStyle = '#6b3bff';
        g.font = `900 ${Math.round(u * 0.11)}px 'AK Display', 'Arial Black', sans-serif`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('AGI', cx, 0.985 * u);
      } else { g.fillStyle = '#8b66ff'; g.fillRect(cx - 0.08 * u, 0.97 * u, 0.16 * u, 0.035 * u); }
    }
  };

  const arms = () => {
    if (side) {
      const ax = cx + (dir === 1 ? -0.02 : 0.02) * u + (step ? (dir === 1 ? 0.05 : -0.05) * u : 0);
      rr(g, ax - 0.045 * u, 0.88 * u, 0.09 * u, 0.24 * u, 0.045 * u); fill(SKIN);
      rr(g, ax - 0.06 * u, 0.86 * u, 0.12 * u, 0.09 * u, 0.04 * u); fill(SHIRT_SH);
      return;
    }
    for (const s of [-1, 1]) {
      const raised = frame === 2 && s === 1;
      const ax = cx + s * 0.27 * u;
      if (raised) {
        // waving: the arm up by her face, the hand open
        g.save(); g.translate(ax, 0.9 * u); g.rotate(-2.5);
        rr(g, -0.045 * u, 0, 0.09 * u, 0.26 * u, 0.045 * u); fill(SKIN);
        g.restore();
        ell(g, ax + 0.16 * u, 0.66 * u, 0.06 * u, 0.065 * u); fill(SKIN);
        rr(g, ax - 0.07 * u, 0.85 * u, 0.13 * u, 0.09 * u, 0.04 * u); fill(SHIRT_SH);
      } else {
        const sw = step ? s * 0.012 * u : 0;
        rr(g, ax - 0.045 * u + sw, 0.88 * u, 0.09 * u, 0.25 * u, 0.045 * u); fill(SKIN);
        rr(g, ax - 0.065 * u, 0.86 * u, 0.13 * u, 0.09 * u, 0.04 * u); fill(SHIRT_SH);
      }
    }
  };

  const head = () => {
    const hy = 0.55 * u, r = 0.34 * u;
    ell(g, cx + (side ? (dir === 1 ? 0.02 : -0.02) * u : 0), hy, r, r * 0.96); fill(SKIN);
    if (dir === 0) {
      // her back: hair over the whole head
      g.beginPath();
      g.moveTo(cx - r - 0.02 * u, hy + 0.05 * u);
      g.bezierCurveTo(cx - r - 0.04 * u, hy - r * 1.2, cx + r + 0.04 * u, hy - r * 1.2, cx + r + 0.02 * u, hy + 0.05 * u);
      g.bezierCurveTo(cx + r * 0.9, hy + r * 0.9, cx - r * 0.9, hy + r * 0.9, cx - r - 0.02 * u, hy + 0.05 * u);
      g.closePath(); fill(HAIR);
      g.beginPath(); g.moveTo(cx - 0.1 * u, hy - r * 0.75); g.quadraticCurveTo(cx - 0.02 * u, hy - r * 0.2, cx - 0.12 * u, hy + r * 0.4);
      g.moveTo(cx + 0.12 * u, hy - r * 0.6); g.quadraticCurveTo(cx + 0.18 * u, hy, cx + 0.1 * u, hy + r * 0.5);
      g.strokeStyle = HAIR_LT; g.lineWidth = lw * 1.1; g.stroke(); g.strokeStyle = INK; g.lineWidth = lw;
      return;
    }
    const f = dir === 3 ? -1 : 1;           // which way the face looks (side views)
    // face
    if (!side) {
      for (const s of [-1, 1]) {
        const ex = cx + s * 0.125 * u, ey = hy + 0.07 * u;
        ell(g, ex, ey, 0.058 * u, 0.078 * u); g.fillStyle = EYE; g.fill();
        g.beginPath(); g.ellipse(ex, ey + 0.025 * u, 0.058 * u, 0.05 * u, 0, 0, Math.PI); g.fillStyle = EYE_DK; g.fill();
        ell(g, ex, ey, 0.058 * u, 0.078 * u); g.lineWidth = lw * 0.8; g.stroke(); g.lineWidth = lw;
        ell(g, ex - 0.018 * u, ey - 0.03 * u, 0.02 * u, 0.022 * u); g.fillStyle = '#fff'; g.fill();
        // lashes
        g.beginPath(); g.moveTo(ex - 0.07 * u, ey - 0.06 * u); g.quadraticCurveTo(ex, ey - 0.1 * u, ex + 0.07 * u, ey - 0.055 * u);
        g.lineWidth = lw * 1.15; g.stroke(); g.lineWidth = lw;
        ell(g, cx + s * 0.205 * u, hy + 0.17 * u, 0.05 * u, 0.028 * u); g.fillStyle = BLUSH; g.fill();
      }
      g.beginPath(); g.arc(cx, hy + 0.17 * u, 0.04 * u, 0.15 * Math.PI, 0.85 * Math.PI); g.lineWidth = lw * 0.8; g.stroke(); g.lineWidth = lw;
    } else {
      const ex = cx + f * 0.15 * u, ey = hy + 0.07 * u;
      ell(g, ex, ey, 0.045 * u, 0.075 * u); g.fillStyle = EYE; g.fill();
      g.lineWidth = lw * 0.8; g.stroke(); g.lineWidth = lw;
      ell(g, ex - f * 0.012 * u, ey - 0.03 * u, 0.016 * u, 0.02 * u); g.fillStyle = '#fff'; g.fill();
      g.beginPath(); g.moveTo(ex - f * 0.05 * u, ey - 0.07 * u); g.quadraticCurveTo(ex + f * 0.02 * u, ey - 0.1 * u, ex + f * 0.07 * u, ey - 0.05 * u);
      g.lineWidth = lw * 1.1; g.stroke(); g.lineWidth = lw;
      ell(g, cx + f * 0.21 * u, hy + 0.17 * u, 0.045 * u, 0.026 * u); g.fillStyle = BLUSH; g.fill();
    }
    // bangs and the hair on top: a scalloped fringe
    g.beginPath();
    const L = cx - r - 0.03 * u, R = cx + r + 0.03 * u, by = hy - 0.02 * u;
    if (!side) {
      g.moveTo(L, hy + 0.2 * u);
      g.bezierCurveTo(L - 0.02 * u, hy - r * 1.15, R + 0.02 * u, hy - r * 1.15, R, hy + 0.2 * u);
      g.quadraticCurveTo(R - 0.03 * u, by, R - 0.1 * u, by - 0.02 * u);
      g.quadraticCurveTo(cx + 0.2 * u, by - 0.05 * u, cx + 0.16 * u, by - 0.12 * u);
      g.quadraticCurveTo(cx + 0.1 * u, by - 0.02 * u, cx + 0.02 * u, by - 0.03 * u);
      g.quadraticCurveTo(cx - 0.05 * u, by - 0.06 * u, cx - 0.08 * u, by - 0.14 * u);
      g.quadraticCurveTo(cx - 0.14 * u, by - 0.03 * u, cx - 0.24 * u, by - 0.02 * u);
      g.quadraticCurveTo(L + 0.03 * u, by, L, hy + 0.2 * u);
    } else {
      const back = cx - f * (r + 0.05 * u), front = cx + f * (r + 0.02 * u);
      g.moveTo(back, hy + 0.3 * u);
      g.bezierCurveTo(back - f * 0.04 * u, hy - r * 1.2, front + f * 0.02 * u, hy - r * 1.1, front, hy - 0.02 * u);
      g.quadraticCurveTo(cx + f * 0.18 * u, by - 0.12 * u, cx + f * 0.06 * u, by - 0.03 * u);
      g.quadraticCurveTo(cx - f * 0.02 * u, hy + 0.1 * u, cx - f * 0.06 * u, hy + 0.32 * u);
      g.closePath();
    }
    fill(HAIR);
    // a shine on the hair
    g.beginPath();
    g.moveTo(cx - 0.17 * u, hy - r * 0.62); g.quadraticCurveTo(cx - 0.04 * u, hy - r * 0.86, cx + 0.12 * u, hy - r * 0.66);
    g.strokeStyle = HAIR_LT; g.lineWidth = lw * 1.3; g.stroke(); g.strokeStyle = INK; g.lineWidth = lw;
    // side locks framing her face (front)
    if (!side) {
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(cx + s * 0.28 * u, hy - 0.05 * u);
        g.bezierCurveTo(cx + s * 0.4 * u, hy + 0.15 * u, cx + s * 0.32 * u, hy + 0.3 * u, cx + s * 0.38 * u, hy + 0.42 * u);
        g.quadraticCurveTo(cx + s * 0.3 * u, hy + 0.38 * u, cx + s * 0.27 * u, hy + 0.3 * u);
        g.bezierCurveTo(cx + s * 0.25 * u, hy + 0.15 * u, cx + s * 0.3 * u, hy + 0.08 * u, cx + s * 0.28 * u, hy - 0.05 * u);
        g.closePath(); fill(HAIR);
      }
    }
  };

  if (dir !== 0) hairBack();
  legs();
  body();
  if (dir === 0) { arms(); hairBack(); head(); return; }
  arms();
  head();
}

// all her frames at one size: { get(dir, frame, tint) } → a canvas (tint: -1 her, 0..3 an echo's color)
export function createSprites(u, dpr, makeCanvas = () => document.createElement('canvas')) {
  const cache = new Map();
  const W = Math.ceil(BOX.w * u * dpr), H = Math.ceil(BOX.h * u * dpr);
  function base(dir, frame) {
    const k = `b${dir}${frame}`;
    if (cache.has(k)) return cache.get(k);
    const c = makeCanvas(); c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (dir === 3) { g.translate(BOX.w * u, 0); g.scale(-1, 1); }
    drawPose(g, u, dir === 3 ? 1 : dir, frame);
    cache.set(k, c);
    return c;
  }
  function tinted(dir, frame, t) {
    const k = `t${dir}${frame}${t}`;
    if (cache.has(k)) return cache.get(k);
    const src = base(dir, frame);
    const c = makeCanvas(); c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.drawImage(src, 0, 0);
    // her colors in the epoch's own hue (her outlines and shading stay: a 'color' blend keeps their lightness)
    g.globalCompositeOperation = 'color';
    g.fillStyle = TINTS[t]; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = 0.22; g.fillStyle = TINTS[t]; g.fillRect(0, 0, W, H);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(src, 0, 0);
    // scanlines (see-through stripes, like an old hologram)
    g.globalCompositeOperation = 'destination-out';
    g.globalAlpha = 0.3;
    const step = Math.max(2, Math.round(dpr * 2));
    for (let y = 0; y < H; y += step * 2) g.fillRect(0, y, W, step);
    cache.set(k, c);
    return c;
  }
  return {
    u, dpr, w: BOX.w * u, h: BOX.h * u,
    get(dir, frame = 0, tint = -1) { return tint < 0 ? base(dir, frame) : tinted(dir, frame, tint % TINTS.length); },
  };
}
