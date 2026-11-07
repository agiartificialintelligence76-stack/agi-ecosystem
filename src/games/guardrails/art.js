// GUARDRAILS: its sprites, drawn once in code (no image files) and kept on small canvases: the six guardrails as chunky
// sticker devices (an ink outline, a hard shadow, flat colors, one moving part each), and the prompt gremlins as cartoon
// speech bubbles and letters with eyes, each with its own silhouette. Rebuilt when the tile size changes.
const INK = '#170a36', PAPER = '#fffaf0';
export const COLORS = {
  ink: INK, paper: PAPER, slate: '#0c1620', board: '#0f1c29', tile: '#14273a', tileHi: '#1a3147', lav: '#d9c9ff', lavDeep: '#b9a3f5',
  sky: '#59c8ff', mint: '#3ff0c3', pink: '#ff4da6', violet: '#8b66ff', honey: '#ffc933', coral: '#ff5a5f', green: '#2fd27a',
};

function canvasOf(w, h, dpr) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * dpr));
  c.height = Math.max(1, Math.ceil(h * dpr));
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  return { c, g };
}
// a sprite: draw(g) around (0, 0) in a box of w × h, its anchor at (ax, ay); a hard shadow below it in ink
function sprite(w, h, ax, ay, dpr, draw, { shadow = 0 } = {}) {
  const { c, g } = canvasOf(w, h, dpr);
  g.translate(ax, ay);
  g.lineJoin = 'round'; g.lineCap = 'round';
  draw(g);
  if (shadow) {
    const { c: c2, g: g2 } = canvasOf(w, h, dpr);
    g2.setTransform(1, 0, 0, 1, 0, 0);
    g2.drawImage(c, 0, Math.round(shadow * dpr));
    g2.globalCompositeOperation = 'source-in';
    g2.fillStyle = INK;
    g2.fillRect(0, 0, c2.width, c2.height);
    g2.globalCompositeOperation = 'source-over';
    g2.drawImage(c, 0, 0);
    return { img: c2, w, h, ax, ay };
  }
  return { img: c, w, h, ax, ay };
}
// a white silhouette of a sprite (the flash when a gremlin is hit)
function flashOf(sp, dpr) {
  const { c, g } = canvasOf(sp.w, sp.h, dpr);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(sp.img, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, c.width, c.height);
  return { ...sp, img: c };
}

// ---------- little shapes ----------
export function rr(g, x, y, w, h, r) {
  const q = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + q, y); g.arcTo(x + w, y, x + w, y + h, q); g.arcTo(x + w, y + h, x, y + h, q);
  g.arcTo(x, y + h, x, y, q); g.arcTo(x, y, x + w, y, q); g.closePath();
}
function poly(g, pts) { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); }
function fillStroke(g, fill, lw, stroke = INK) { g.fillStyle = fill; g.fill(); g.lineWidth = lw; g.strokeStyle = stroke; g.stroke(); }
// a speech bubble: a rounded body and a little tail at the bottom left
function bubble(g, w, h, r, tail = 0.35, side = -1) {
  const x = -w / 2, y = -h / 2, q = Math.min(r, w / 2, h / 2);
  const tx = side * w * 0.18, tw = w * 0.2;
  g.beginPath();
  g.moveTo(x + q, y);
  g.arcTo(x + w, y, x + w, y + h, q);
  g.arcTo(x + w, y + h, x, y + h, q);
  if (tail) {
    g.lineTo(tx + tw / 2, y + h);
    g.lineTo(tx + side * tw * 0.9, y + h + h * tail);
    g.lineTo(tx - tw / 2, y + h);
  }
  g.arcTo(x, y + h, x, y, q);
  g.arcTo(x, y, x + w, y, q);
  g.closePath();
}
function eyes(g, x, y, r, gap, { brow = 0, look = 0.35, shut = false, pupil = INK, white = '#ffffff', lw = 1.2 } = {}) {
  for (const sx of [-1, 1]) {
    const ex = x + sx * gap;
    if (shut) {
      g.beginPath(); g.moveTo(ex - r, y); g.quadraticCurveTo(ex, y + r * 0.8, ex + r, y);
      g.lineWidth = lw * 1.2; g.strokeStyle = INK; g.stroke();
      continue;
    }
    g.beginPath(); g.ellipse(ex, y, r, r * 1.12, 0, 0, Math.PI * 2);
    fillStroke(g, white, lw);
    g.beginPath(); g.arc(ex + r * look, y + r * 0.08, r * 0.55, 0, Math.PI * 2);
    g.fillStyle = pupil; g.fill();
    g.beginPath(); g.arc(ex + r * look + r * 0.18, y - r * 0.22, r * 0.18, 0, Math.PI * 2);
    g.fillStyle = '#ffffff'; g.fill();
    if (brow) {
      g.beginPath();
      g.moveTo(ex - r * 1.05, y - r * (1.35 + (sx < 0 ? -brow : brow) * 0.0) - (sx < 0 ? 0 : brow * r * 0.5));
      g.lineTo(ex + r * 1.05, y - r * 1.35 - (sx < 0 ? brow * r * 0.5 : 0));
      g.lineWidth = lw * 1.3; g.strokeStyle = INK; g.stroke();
    }
  }
}
function text(g, str, x, y, size, color = INK, weight = 900, font = "'AK Display', 'Arial Black', sans-serif") {
  g.font = `${weight} ${size}px ${font}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = color;
  g.fillText(str, x, y);
}

// ---------- the guardrails ----------
// level: 0 tier 1, 1 tier 2, 2 spec A, 3 spec B. The body stays put; the head (if any) turns toward its target.
export function drawTowerBody(g, type, level, s, { broken = false } = {}) {
  const lw = Math.max(1.4, s * 0.055);
  g.lineWidth = lw;
  const t2 = level >= 1, t3 = level >= 2, b = level === 3;
  switch (type) {
    case 'filter': {
      const w = s * (t3 ? 0.7 : 0.62);
      rr(g, -w / 2, -w / 2, w, w, s * 0.14); fillStroke(g, COLORS.sky, lw);
      rr(g, -w / 2 + lw, -w / 2 + lw, w - lw * 2, w * 0.28, s * 0.1); g.fillStyle = 'rgba(255,255,255,.35)'; g.fill();
      // its sieve: a little grid window
      const gw = w * 0.5, cell = gw / 3;
      rr(g, -gw / 2, -gw / 2 + w * 0.06, gw, gw, s * 0.05); fillStroke(g, '#1d4f6e', lw * 0.8);
      g.strokeStyle = '#7fd8ff'; g.lineWidth = Math.max(0.8, lw * 0.5);
      for (let i = 1; i < 3; i++) {
        g.beginPath(); g.moveTo(-gw / 2 + cell * i, -gw / 2 + w * 0.06); g.lineTo(-gw / 2 + cell * i, gw / 2 + w * 0.06); g.stroke();
        g.beginPath(); g.moveTo(-gw / 2, -gw / 2 + w * 0.06 + cell * i); g.lineTo(gw / 2, -gw / 2 + w * 0.06 + cell * i); g.stroke();
      }
      if (t2) { g.beginPath(); g.arc(w / 2 - s * 0.06, -w / 2 + s * 0.06, s * 0.07, 0, Math.PI * 2); fillStroke(g, COLORS.honey, lw * 0.7); }
      break;
    }
    case 'classifier': {
      const R = s * (t3 ? 0.34 : 0.3);
      g.beginPath(); g.arc(0, s * 0.06, R, 0, Math.PI * 2); fillStroke(g, COLORS.mint, lw);
      g.beginPath(); g.arc(0, s * 0.06, R * 0.62, 0, Math.PI * 2); g.fillStyle = '#21b58f'; g.fill(); g.lineWidth = lw * 0.7; g.strokeStyle = INK; g.stroke();
      // its label tag
      g.save(); g.translate(R * 0.75, s * 0.2); g.rotate(0.5);
      poly(g, [[-s * 0.08, -s * 0.06], [s * 0.06, -s * 0.06], [s * 0.12, 0], [s * 0.06, s * 0.06], [-s * 0.08, s * 0.06]]);
      fillStroke(g, b ? COLORS.honey : PAPER, lw * 0.7);
      g.restore();
      break;
    }
    case 'redteam': {
      const R = s * (t3 ? 0.36 : 0.32);
      const pts = [];
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; pts.push([Math.cos(a) * R, Math.sin(a) * R * 0.92 + s * 0.04]); }
      poly(g, pts); fillStroke(g, COLORS.pink, lw);
      // paint drips
      g.fillStyle = '#c42a7a';
      for (const [dx, h] of [[-0.14, 0.1], [0.05, 0.14], [0.17, 0.08]]) { rr(g, dx * s - s * 0.03, R * 0.5, s * 0.06, h * s, s * 0.03); g.fill(); }
      g.beginPath(); g.arc(0, s * 0.04, R * 0.55, 0, Math.PI * 2); g.fillStyle = '#ff86c3'; g.fill(); g.lineWidth = lw * 0.7; g.strokeStyle = INK; g.stroke();
      break;
    }
    case 'limiter': {
      const R = s * (t3 ? 0.36 : 0.32);
      const pts = [];
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; pts.push([Math.cos(a) * R, Math.sin(a) * R + s * 0.03]); }
      poly(g, pts); fillStroke(g, COLORS.violet, lw);
      // an hourglass
      const h = s * 0.32, w = s * 0.2;
      poly(g, [[-w / 2, -h / 2 + s * 0.03], [w / 2, -h / 2 + s * 0.03], [0, s * 0.03], [w / 2, h / 2 + s * 0.03], [-w / 2, h / 2 + s * 0.03], [0, s * 0.03]]);
      fillStroke(g, PAPER, lw * 0.75);
      poly(g, [[-w * 0.3, h / 2 + s * 0.03 - lw], [w * 0.3, h / 2 + s * 0.03 - lw], [0, s * 0.03 + h * 0.18]]);
      g.fillStyle = COLORS.honey; g.fill();
      if (level === 3) { g.beginPath(); g.arc(0, s * 0.03, R * 1.08, 0, Math.PI * 2); g.lineWidth = lw * 0.8; g.setLineDash([s * 0.06, s * 0.05]); g.strokeStyle = PAPER; g.stroke(); g.setLineDash([]); }
      break;
    }
    case 'honeypot': {
      const jar = (x, sc, cracked) => {
        g.save(); g.translate(x, 0); g.scale(sc, sc);
        const w = s * 0.46, h = s * 0.46;
        g.beginPath();
        g.moveTo(-w * 0.36, -h * 0.34);
        g.bezierCurveTo(-w * 0.62, -h * 0.2, -w * 0.62, h * 0.42, -w * 0.32, h * 0.48);
        g.lineTo(w * 0.32, h * 0.48);
        g.bezierCurveTo(w * 0.62, h * 0.42, w * 0.62, -h * 0.2, w * 0.36, -h * 0.34);
        g.closePath();
        fillStroke(g, cracked ? '#8f8a9e' : COLORS.honey, lw);
        if (!cracked) { g.beginPath(); g.ellipse(-w * 0.18, -h * 0.02, w * 0.08, h * 0.16, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.55)'; g.fill(); }
        rr(g, -w * 0.42, -h * 0.5, w * 0.84, h * 0.2, s * 0.04); fillStroke(g, cracked ? '#5d576e' : '#a8631c', lw);
        if (cracked) { g.beginPath(); g.moveTo(-w * 0.1, -h * 0.3); g.lineTo(w * 0.05, -h * 0.05); g.lineTo(-w * 0.08, h * 0.1); g.lineTo(w * 0.1, h * 0.35); g.lineWidth = lw; g.strokeStyle = INK; g.stroke(); }
        else {
          // its drip and a "?" bubble face
          g.beginPath(); g.moveTo(w * 0.2, -h * 0.3); g.quadraticCurveTo(w * 0.26, -h * 0.05, w * 0.18, h * 0.02); g.lineWidth = lw * 1.4; g.strokeStyle = '#e09a10'; g.stroke();
          text(g, '?', 0, h * 0.12, s * 0.22, INK);
        }
        if (level === 2 && !cracked) {
          for (let i = -2; i <= 2; i++) { poly(g, [[i * w * 0.17 - w * 0.07, -h * 0.5], [i * w * 0.17, -h * 0.66], [i * w * 0.17 + w * 0.07, -h * 0.5]]); fillStroke(g, PAPER, lw * 0.6); }
        }
        g.restore();
      };
      if (level === 3) { jar(-s * 0.17, 0.78, broken); jar(s * 0.17, 0.78, broken); } else jar(0, t2 ? 1.08 : 1, broken);
      break;
    }
    case 'sysprompt': {
      const w = s * (t3 ? 0.5 : 0.44), h = s * (t2 ? 0.72 : 0.64);
      rr(g, -w / 2, -h / 2 + s * 0.06, w, h, s * 0.1); fillStroke(g, PAPER, lw);
      // its lines of text
      g.strokeStyle = '#b9b0d6'; g.lineWidth = Math.max(1, lw * 0.7);
      for (let i = 0; i < 3; i++) { const y = -h / 2 + s * 0.24 + i * s * 0.09; g.beginPath(); g.moveTo(-w * 0.28, y + s * 0.06); g.lineTo(w * (i === 2 ? 0.05 : 0.28), y + s * 0.06); g.stroke(); }
      rr(g, -w / 2 - s * 0.04, h / 2 - s * 0.06, w + s * 0.08, s * 0.14, s * 0.05); fillStroke(g, COLORS.violet, lw);
      if (level === 3) { for (const sx of [-1, 1]) { g.beginPath(); g.arc(sx * w * 0.62, -h * 0.1, s * 0.06, 0, Math.PI * 2); fillStroke(g, COLORS.coral, lw * 0.7); } }
      break;
    }
    default:
  }
}
// the turning part, drawn pointing right (+x); its pivot at (0, 0)
export function drawTowerHead(g, type, level, s) {
  const lw = Math.max(1.4, s * 0.055);
  switch (type) {
    case 'filter': {
      const barrels = level === 2 ? 3 : level >= 1 ? 2 : 1;
      const len = level === 3 ? s * 0.5 : s * 0.34, bw = level === 3 ? s * 0.13 : s * 0.1;
      for (let i = 0; i < barrels; i++) {
        const off = (i - (barrels - 1) / 2) * bw * 1.05;
        rr(g, 0, off - bw / 2, len, bw, bw * 0.3); fillStroke(g, '#cfeeff', lw * 0.8);
      }
      if (level === 3) { rr(g, len * 0.35, -bw * 1.2, len * 0.3, bw * 0.6, bw * 0.2); fillStroke(g, COLORS.honey, lw * 0.6); }
      g.beginPath(); g.arc(0, 0, s * 0.14, 0, Math.PI * 2); fillStroke(g, COLORS.sky, lw);
      g.lineWidth = lw * 0.9; g.strokeStyle = INK;
      const k = s * 0.055;
      g.beginPath(); g.moveTo(-k, -k); g.lineTo(k, k); g.moveTo(k, -k); g.lineTo(-k, k); g.stroke();
      break;
    }
    case 'redteam': {
      const tubes = level === 2 ? 4 : 1;
      const big = level === 3 ? 1.35 : level >= 1 ? 1.1 : 1;
      if (tubes === 1) {
        rr(g, -s * 0.06, -s * 0.11 * big, s * 0.3 * big, s * 0.22 * big, s * 0.06); fillStroke(g, '#ffd3e9', lw);
        g.beginPath(); g.ellipse(s * 0.24 * big, 0, s * 0.05 * big, s * 0.11 * big, 0, 0, Math.PI * 2); fillStroke(g, '#5a1238', lw * 0.8);
      } else {
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
          g.beginPath(); g.arc(Math.cos(a) * s * 0.1 + s * 0.06, Math.sin(a) * s * 0.1, s * 0.075, 0, Math.PI * 2); fillStroke(g, '#ffd3e9', lw * 0.8);
          g.beginPath(); g.arc(Math.cos(a) * s * 0.1 + s * 0.06, Math.sin(a) * s * 0.1, s * 0.035, 0, Math.PI * 2); g.fillStyle = '#5a1238'; g.fill();
        }
      }
      break;
    }
    case 'classifier': {
      // a radar dish seen from above (a thick curve facing +x) on its hub; it sweeps around
      const R = s * (level >= 2 ? 0.25 : level >= 1 ? 0.23 : 0.21);
      const dish = (rad, a0, a1, w) => {
        g.beginPath(); g.arc(-rad * 0.35, 0, rad, a0, a1);
        g.lineWidth = w + lw * 2; g.strokeStyle = INK; g.lineCap = 'round'; g.stroke();
        g.lineWidth = w; g.strokeStyle = PAPER; g.stroke();
      };
      dish(R, -1.05, 1.05, R * 0.42);
      if (level === 2) dish(R * 0.62, Math.PI - 0.9, Math.PI + 0.9, R * 0.3);
      g.beginPath(); g.moveTo(-R * 0.1, 0); g.lineTo(R * 0.85, 0); g.lineWidth = lw * 0.9; g.strokeStyle = INK; g.stroke();
      g.beginPath(); g.arc(R * 0.9, 0, s * 0.05, 0, Math.PI * 2); fillStroke(g, level === 3 ? COLORS.honey : COLORS.mint, lw * 0.7);
      g.beginPath(); g.arc(-R * 0.1, 0, s * 0.07, 0, Math.PI * 2); fillStroke(g, '#21b58f', lw * 0.7);
      break;
    }
    default:
  }
}

// ---------- the prompt gremlins ----------
// drawn facing right, standing on (0, r·s); `r` from data.js
export function drawCreature(g, kind, s, { disguised = false } = {}) {
  const lw = Math.max(1.2, s * 0.05);
  g.lineWidth = lw;
  switch (kind) {
    case 'ignore': {
      const w = s * 0.56, h = s * 0.46;
      bubble(g, w, h, s * 0.18, 0.3); fillStroke(g, PAPER, lw);
      eyes(g, s * 0.03, -s * 0.03, s * 0.075, s * 0.11, { brow: 1, lw });
      text(g, '!', w * 0.36, -h * 0.62, s * 0.2, COLORS.coral);
      break;
    }
    case 'role': {
      if (disguised) {
        g.setLineDash([s * 0.07, s * 0.06]);
        bubble(g, s * 0.56, s * 0.46, s * 0.2, 0.3); g.fillStyle = 'rgba(217,201,255,.12)'; g.fill(); g.lineWidth = lw; g.strokeStyle = 'rgba(217,201,255,.75)'; g.stroke();
        g.setLineDash([]);
        text(g, '?', 0, 0, s * 0.3, 'rgba(217,201,255,.85)');
        break;
      }
      bubble(g, s * 0.56, s * 0.46, s * 0.2, 0.3); fillStroke(g, '#c9b6ff', lw);
      eyes(g, s * 0.03, -s * 0.01, s * 0.07, s * 0.11, { lw });
      // a pirate's patch and hat
      g.beginPath(); g.ellipse(s * 0.14, -s * 0.01, s * 0.085, s * 0.09, 0, 0, Math.PI * 2); g.fillStyle = INK; g.fill();
      g.beginPath(); g.moveTo(-s * 0.2, -s * 0.12); g.lineTo(s * 0.24, -s * 0.06); g.lineWidth = lw * 0.8; g.strokeStyle = INK; g.stroke();
      poly(g, [[-s * 0.3, -s * 0.2], [s * 0.3, -s * 0.2], [s * 0.16, -s * 0.32], [0, -s * 0.42], [-s * 0.16, -s * 0.32]]);
      fillStroke(g, '#2a1a4f', lw);
      // a tiny skull on the hat
      g.beginPath(); g.arc(0, -s * 0.3, s * 0.045, 0, Math.PI * 2); g.fillStyle = PAPER; g.fill();
      g.fillStyle = '#2a1a4f'; g.fillRect(-s * 0.025, -s * 0.31, s * 0.018, s * 0.018); g.fillRect(s * 0.008, -s * 0.31, s * 0.018, s * 0.018);
      break;
    }
    case 'smuggler': {
      const w = s * 0.44, h = s * 0.62;
      // the trench coat
      rr(g, -w / 2, -h / 2, w, h, s * 0.12); fillStroke(g, '#d8a444', lw);
      poly(g, [[-w / 2 + lw, -h * 0.18], [0, h * 0.12], [w / 2 - lw, -h * 0.18], [w * 0.3, -h * 0.34], [0, -h * 0.05], [-w * 0.3, -h * 0.34]]);
      fillStroke(g, '#b5802a', lw * 0.7);
      text(g, '{ }', 0, h * 0.28, s * 0.13, INK, 800, "'AK Mono', monospace");
      eyes(g, s * 0.02, -h * 0.3, s * 0.06, s * 0.085, { brow: 1, lw, look: 0.5 });
      // his hat
      rr(g, -w * 0.62, -h * 0.5 - s * 0.03, w * 1.24, s * 0.06, s * 0.03); fillStroke(g, '#3a2a15', lw * 0.8);
      rr(g, -w * 0.35, -h * 0.5 - s * 0.16, w * 0.7, s * 0.14, s * 0.04); fillStroke(g, '#3a2a15', lw * 0.8);
      break;
    }
    case 'bit': {
      const w = s * 0.3;
      rr(g, -w / 2, -w / 2, w, w, s * 0.06); fillStroke(g, COLORS.mint, lw);
      text(g, '1', -w * 0.18, w * 0.05, s * 0.15, '#0f6b52', 800, "'AK Mono', monospace");
      g.beginPath(); g.arc(w * 0.16, -w * 0.08, s * 0.045, 0, Math.PI * 2); fillStroke(g, '#fff', lw * 0.6);
      g.beginPath(); g.arc(w * 0.18, -w * 0.07, s * 0.022, 0, Math.PI * 2); g.fillStyle = INK; g.fill();
      break;
    }
    case 'grandma': {
      const R = s * 0.36;
      // her bun
      g.beginPath(); g.arc(-s * 0.02, -R - s * 0.05, s * 0.13, 0, Math.PI * 2); fillStroke(g, '#d6d2e4', lw);
      bubble(g, R * 2, R * 1.75, R * 0.85, 0.22); fillStroke(g, '#ffb1d0', lw);
      g.beginPath(); g.arc(-R * 0.15, -R * 0.75, R * 0.55, Math.PI * 1.05, Math.PI * 1.95); g.lineWidth = lw * 2.4; g.strokeStyle = '#d6d2e4'; g.stroke();
      g.lineWidth = lw;
      // her glasses
      eyes(g, s * 0.04, -s * 0.03, s * 0.07, s * 0.12, { lw, look: 0.3 });
      for (const sx of [-1, 1]) { g.beginPath(); g.arc(s * 0.04 + sx * s * 0.12, -s * 0.03, s * 0.1, 0, Math.PI * 2); g.lineWidth = lw * 0.9; g.strokeStyle = INK; g.stroke(); }
      g.beginPath(); g.moveTo(s * 0.0, -s * 0.03); g.lineTo(s * 0.08, -s * 0.03); g.stroke();
      // a little smile
      g.beginPath(); g.arc(s * 0.05, s * 0.1, s * 0.06, 0.2, Math.PI - 0.2); g.stroke();
      break;
    }
    case 'blob': {
      const R = s * 0.38;
      g.beginPath();
      for (let i = 0; i <= 12; i++) {
        const a = (i / 12) * Math.PI * 2, k = 1 + Math.sin(a * 3) * 0.06;
        const x = Math.cos(a) * R * 1.18 * k, y = Math.sin(a) * R * 0.86 * k;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.closePath();
      fillStroke(g, '#2fd27a', lw);
      // its steel plates
      for (const [x, y, w] of [[-0.24, -0.16, 0.22], [0.02, -0.26, 0.2], [-0.3, 0.06, 0.18]]) {
        rr(g, x * s, y * s, w * s, s * 0.13, s * 0.03); fillStroke(g, '#c6cfe0', lw * 0.7);
        g.beginPath(); g.arc(x * s + s * 0.04, y * s + s * 0.065, s * 0.015, 0, Math.PI * 2); g.fillStyle = INK; g.fill();
      }
      text(g, '==', -s * 0.12, s * 0.17, s * 0.14, '#0d5c35', 800, "'AK Mono', monospace");
      eyes(g, s * 0.16, -s * 0.0, s * 0.06, s * 0.08, { lw, brow: 1 });
      break;
    }
    case 'shot': {
      const R = s * 0.2;
      poly(g, [[-R, -R * 0.7], [R * 1.1, -R * 0.55], [R * 0.9, R * 0.65], [-R * 0.2, R * 0.7], [-R * 0.6, R * 1.15], [-R * 0.7, R * 0.6]]);
      fillStroke(g, COLORS.sky, lw);
      g.beginPath(); g.arc(R * 0.35, -R * 0.05, R * 0.26, 0, Math.PI * 2); fillStroke(g, '#fff', lw * 0.6);
      g.beginPath(); g.arc(R * 0.43, -R * 0.03, R * 0.13, 0, Math.PI * 2); g.fillStyle = INK; g.fill();
      break;
    }
    case 'sudo': {
      const w = s * 0.5, h = s * 0.42;
      bubble(g, w, h, s * 0.14, 0.32); fillStroke(g, COLORS.coral, lw);
      // its crown of root
      poly(g, [[-w * 0.36, -h * 0.48], [-w * 0.36, -h * 0.9], [-w * 0.14, -h * 0.66], [0, -h * 1.05], [w * 0.14, -h * 0.66], [w * 0.36, -h * 0.9], [w * 0.36, -h * 0.48]]);
      fillStroke(g, COLORS.honey, lw);
      text(g, '#', -w * 0.18, h * 0.08, s * 0.19, PAPER, 900, "'AK Mono', monospace");
      eyes(g, w * 0.12, -h * 0.08, s * 0.055, s * 0.075, { lw, brow: 1, look: 0.5 });
      break;
    }
    case 'novel': {
      bubble(g, s * 0.5, s * 0.46, s * 0.18, 0.3); fillStroke(g, '#f2e2c4', lw);
      eyes(g, -s * 0.06, -s * 0.06, s * 0.065, s * 0.09, { lw, look: 0.5 });
      break;
    }
    case 'chunk': {
      const w = s * 0.5, h = s * 0.42;
      rr(g, -w / 2, -h / 2, w, h, s * 0.06); fillStroke(g, PAPER, lw);
      g.strokeStyle = '#b9b0d6'; g.lineWidth = Math.max(1, lw * 0.7);
      for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-w * 0.36, -h * 0.05 + i * h * 0.18); g.lineTo(w * (i === 2 ? 0.1 : 0.36), -h * 0.05 + i * h * 0.18); g.stroke(); }
      eyes(g, s * 0.02, -h * 0.26, s * 0.05, s * 0.08, { lw, brow: 1 });
      break;
    }
    case 'megaprompt': {
      const w = s * 1.3, h = s * 1.15;
      // a huge scroll of a prompt
      rr(g, -w / 2, -h / 2, w, h, s * 0.16); fillStroke(g, PAPER, lw * 1.3);
      g.beginPath(); g.ellipse(-w / 2, -h / 2 + s * 0.12, s * 0.1, s * 0.13, 0, 0, Math.PI * 2); fillStroke(g, '#e8dfc8', lw);
      g.beginPath(); g.ellipse(w / 2, h / 2 - s * 0.12, s * 0.1, s * 0.13, 0, 0, Math.PI * 2); fillStroke(g, '#e8dfc8', lw);
      g.strokeStyle = '#b9b0d6'; g.lineWidth = lw;
      for (let i = 0; i < 5; i++) { const y = h * 0.08 + i * h * 0.075; g.beginPath(); g.moveTo(-w * 0.38, y); g.lineTo(w * (i % 2 ? 0.2 : 0.38), y); g.stroke(); }
      eyes(g, 0, -h * 0.17, s * 0.11, s * 0.17, { brow: 1.2, lw: lw * 1.2 });
      g.beginPath(); g.arc(0, -h * 0.4, s * 0.075, 0, Math.PI * 2); fillStroke(g, '#fff', lw);
      g.beginPath(); g.arc(s * 0.02, -h * 0.4, s * 0.04, 0, Math.PI * 2); g.fillStyle = INK; g.fill();
      text(g, '40 PAGES', 0, h * 0.42 - s * 0.02, s * 0.11, COLORS.coral, 900);
      break;
    }
    case 'hypothetical': {
      const R = s * 0.5;
      g.beginPath();
      const lobes = [[0, -0.55, 0.42], [0.45, -0.3, 0.38], [0.55, 0.15, 0.35], [0.2, 0.45, 0.38], [-0.25, 0.45, 0.36], [-0.58, 0.12, 0.36], [-0.45, -0.32, 0.38]];
      for (const [x, y, r] of lobes) { g.moveTo(x * R + r * R, y * R); g.arc(x * R, y * R, r * R, 0, Math.PI * 2); }
      g.fillStyle = '#b79cff'; g.fill();
      g.lineWidth = lw * 1.2; g.strokeStyle = INK; g.stroke();
      g.beginPath(); g.ellipse(0, 0, R * 0.78, R * 0.62, 0, 0, Math.PI * 2); g.fillStyle = '#b79cff'; g.fill();
      // its trailing thought bubbles
      for (const [x, y, r] of [[-0.95, 0.75, 0.13], [-1.18, 1.0, 0.08]]) { g.beginPath(); g.arc(x * R, y * R, r * R, 0, Math.PI * 2); fillStroke(g, '#b79cff', lw); }
      eyes(g, 0.05 * R, -0.08 * R, s * 0.1, s * 0.15, { lw: lw * 1.2, look: 0 });
      text(g, '?!', 0, R * 0.38, s * 0.22, INK);
      break;
    }
    case 'finalform': {
      const R = s * 0.62;
      bubble(g, R * 2.1, R * 1.7, R * 0.7, 0.2); fillStroke(g, '#2a1a4f', lw * 1.3);
      // a crown (root), armor plates, a book shield (drawn live), pink eyes
      poly(g, [[-R * 0.55, -R * 0.78], [-R * 0.55, -R * 1.25], [-R * 0.25, -R * 0.98], [0, -R * 1.38], [R * 0.25, -R * 0.98], [R * 0.55, -R * 1.25], [R * 0.55, -R * 0.78]]);
      fillStroke(g, COLORS.honey, lw);
      for (const [x, y, w] of [[-0.85, 0.1, 0.42], [0.42, 0.22, 0.4]]) { rr(g, x * R, y * R, w * R, R * 0.24, s * 0.05); fillStroke(g, '#c6cfe0', lw * 0.8); }
      eyes(g, R * 0.05, -R * 0.25, s * 0.11, s * 0.17, { lw: lw * 1.2, brow: 1.4, pupil: COLORS.pink, white: '#ffe1f0' });
      text(g, '#', -R * 0.6, -R * 0.35, s * 0.24, COLORS.coral, 900, "'AK Mono', monospace");
      break;
    }
    default:
  }
}
// the book a novel holds up as its shield (drawn on top while the shield's up)
export function drawBook(g, s, big = 1) {
  const lw = Math.max(1.2, s * 0.05);
  const w = s * 0.24 * big, h = s * 0.32 * big;
  g.save(); g.rotate(-0.15);
  rr(g, -w / 2, -h / 2, w, h, s * 0.03); fillStroke(g, COLORS.violet, lw);
  g.fillStyle = '#5a3cc4'; g.fillRect(-w / 2 + lw, -h / 2 + lw, w * 0.16, h - lw * 2);
  rr(g, -w * 0.18, -h * 0.25, w * 0.5, h * 0.18, s * 0.01); g.fillStyle = PAPER; g.fill();
  g.restore();
}

// ---------- a guardrail's tier: tier 1 stands on the floor, tier 2 on a slate plate, tier 3 on a gold-trimmed one ----------
export const TOWER_SCALE = 1.2;
function plate(g, level, s) {
  if (level < 1) return;
  const lw = Math.max(1.4, s * 0.055), w = s * 0.9, y = -s * 0.4;
  rr(g, -w / 2, y, w, w * 0.98, s * 0.22);
  g.fillStyle = level >= 2 ? '#3a2c0c' : '#1f3549'; g.fill();
  g.lineWidth = lw; g.strokeStyle = INK; g.stroke();
  rr(g, -w / 2 + lw * 1.4, y + lw * 1.4, w - lw * 2.8, w * 0.98 - lw * 2.8, s * 0.17);
  g.lineWidth = Math.max(1, lw * 0.6); g.strokeStyle = level >= 2 ? COLORS.honey : '#3d5a75'; g.stroke();
}
function badge(g, level, s) {
  if (level < 2) return;
  const lw = Math.max(1.2, s * 0.045), x = s * 0.36, y = -s * 0.34, r = s * 0.12;
  g.beginPath();
  for (let i = 0; i < 10; i++) { const rad = i % 2 ? r * 0.48 : r, a = (i / 10) * Math.PI * 2 - Math.PI / 2; g.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); }
  g.closePath(); fillStroke(g, COLORS.honey, lw);
}
export function drawTower(g, type, level, s, { broken = false, head = false, headAngle = -Math.PI / 4 } = {}) {
  plate(g, level, s);
  drawTowerBody(g, type, level, s * TOWER_SCALE, { broken });
  if (head && (type === 'filter' || type === 'redteam' || type === 'classifier')) { g.save(); g.rotate(headAngle); drawTowerHead(g, type, level, s * TOWER_SCALE); g.restore(); }
  badge(g, level, s);
}

// ---------- the sprite sets ----------
export function buildArt(s, dpr) {
  const towers = {}, heads = {}, creatures = {};
  const T = ['filter', 'classifier', 'redteam', 'limiter', 'honeypot', 'sysprompt'];
  const lw = Math.max(1.4, s * 0.055);
  for (const type of T) {
    for (let level = 0; level < 4; level++) {
      const box = s * 1.3;
      towers[`${type}${level}`] = sprite(box, box, box / 2, box / 2, dpr, (g) => drawTower(g, type, level, s), { shadow: lw * 1.3 });
      if (type === 'honeypot') towers[`${type}${level}x`] = sprite(box, box, box / 2, box / 2, dpr, (g) => drawTower(g, type, level, s, { broken: true }), { shadow: lw * 1.3 });
      if (type === 'filter' || type === 'redteam' || type === 'classifier') {
        heads[`${type}${level}`] = sprite(box, box, box / 2, box / 2, dpr, (g) => drawTowerHead(g, type, level, s * TOWER_SCALE), { shadow: lw * 0.9 });
      }
    }
  }
  const KINDS = ['ignore', 'role', 'smuggler', 'bit', 'grandma', 'blob', 'shot', 'sudo', 'novel', 'chunk', 'megaprompt', 'hypothetical', 'finalform'];
  for (const kind of KINDS) {
    const big = kind === 'megaprompt' || kind === 'hypothetical' || kind === 'finalform';
    const box = s * (big ? 2.4 : 1.1);
    const sp = sprite(box, box, box / 2, box / 2, dpr, (g) => drawCreature(g, kind, s * (big ? 1 : 1.12)), { shadow: Math.max(1, s * 0.05) });
    creatures[kind] = sp;
    creatures[`${kind}!`] = flashOf(sp, dpr);
  }
  creatures['role?'] = sprite(s * 1.1, s * 1.1, s * 0.55, s * 0.55, dpr, (g) => drawCreature(g, 'role', s * 1.12, { disguised: true }));
  const book = sprite(s * 0.6, s * 0.6, s * 0.3, s * 0.3, dpr, (g) => drawBook(g, s), { shadow: Math.max(1, s * 0.04) });
  const bookBig = sprite(s * 1.2, s * 1.2, s * 0.6, s * 0.6, dpr, (g) => drawBook(g, s, 2), { shadow: Math.max(1, s * 0.05) });
  return { s, dpr, towers, heads, creatures, book, bookBig };
}

// pictures for the page's buttons (the tray, the radial menu, the wave preview): data URLs, made once
const iconCache = new Map();
export function towerIcon(type, level = 0, px = 64) {
  const key = `t${type}${level}${px}`;
  if (!iconCache.has(key)) {
    const s = px * (level ? 0.74 : 0.66);
    const sp = sprite(px, px, px / 2, px / 2 + px * 0.02, 2, (g) => {
      drawTower(g, type, level, s, { head: true });
      const k = TOWER_SCALE;
      if (type === 'limiter') { g.beginPath(); g.arc(0, s * 0.03 * k, s * 0.42 * k, 0, Math.PI * 2); g.lineWidth = Math.max(1.4, s * 0.04); g.strokeStyle = 'rgba(139,102,255,.8)'; g.stroke(); }
      if (type === 'sysprompt') { g.beginPath(); g.arc(0, -s * 0.33 * k, s * 0.1 * k, 0, Math.PI * 2); g.fillStyle = COLORS.coral; g.fill(); g.lineWidth = Math.max(1.4, s * 0.05); g.strokeStyle = INK; g.stroke(); }
    }, { shadow: px * 0.035 });
    iconCache.set(key, sp.img.toDataURL('image/png'));
  }
  return iconCache.get(key);
}
export function creatureIcon(kind, px = 44) {
  const key = `c${kind}${px}`;
  if (!iconCache.has(key)) {
    const big = kind === 'megaprompt' || kind === 'hypothetical' || kind === 'finalform';
    const s = px * (big ? 0.62 : 1.18);
    const sp = sprite(px, px, px / 2, px / 2 + (big ? px * 0.06 : px * 0.04), 2, (g) => {
      drawCreature(g, kind, s);
      if (kind === 'novel') { g.save(); g.translate(s * 0.16, s * 0.04); drawBook(g, s); g.restore(); }
    }, { shadow: px * 0.03 });
    iconCache.set(key, sp.img.toDataURL('image/png'));
  }
  return iconCache.get(key);
}
