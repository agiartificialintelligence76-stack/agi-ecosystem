// SCAM SLAYER: the stickers, drawn in code. Every flying thing is a die-cut sticker: its art in flat colors with one
// shadow tone and one highlight (light from the top left), ink outlines, a paper border all around and an ink edge,
// like the arcade's Pop look. Each kind is drawn once per size into its own canvas (sharp on every screen), and a
// sliced one is redrawn as two halves along the blade's line, its cut face showing (halves come from a small pool).
import { KINDS } from './kinds.js';

export const INK = '#170a36';
export const PAPER = '#fffaf0';
const PAD = 1.42;                       // a sprite spans ±PAD radii (the art reaches past its circle: tags, sparkles)
const LW = 0.075;                       // the art's own ink lines, in radii
const BORDER = 0.13, EDGE = 0.07;       // the paper border and the ink edge around it

export const mk = (w, h) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  return c;
};

// ---------- small path helpers (they add to the current path; the caller begins and fills) ----------
function rr(c, x, y, w, h, r) {
  const q = Math.max(0, Math.min(r, w / 2, h / 2));
  c.moveTo(x + q, y);
  c.arcTo(x + w, y, x + w, y + h, q); c.arcTo(x + w, y + h, x, y + h, q);
  c.arcTo(x, y + h, x, y, q); c.arcTo(x, y, x + w, y, q);
  c.closePath();
}
function heartPath(c, cx, cy, s) {
  c.moveTo(cx, cy + 0.82 * s);
  c.bezierCurveTo(cx - 0.18 * s, cy + 0.66 * s, cx - 0.98 * s, cy + 0.22 * s, cx - 0.98 * s, cy - 0.3 * s);
  c.bezierCurveTo(cx - 0.98 * s, cy - 0.78 * s, cx - 0.38 * s, cy - 0.96 * s, cx, cy - 0.5 * s);
  c.bezierCurveTo(cx + 0.38 * s, cy - 0.96 * s, cx + 0.98 * s, cy - 0.78 * s, cx + 0.98 * s, cy - 0.3 * s);
  c.bezierCurveTo(cx + 0.98 * s, cy + 0.22 * s, cx + 0.18 * s, cy + 0.66 * s, cx, cy + 0.82 * s);
  c.closePath();
}
function sparkle(c, x, y, s) {             // a four-point twinkle
  c.moveTo(x, y - s);
  c.quadraticCurveTo(x + s * 0.16, y - s * 0.16, x + s, y);
  c.quadraticCurveTo(x + s * 0.16, y + s * 0.16, x, y + s);
  c.quadraticCurveTo(x - s * 0.16, y + s * 0.16, x - s, y);
  c.quadraticCurveTo(x - s * 0.16, y - s * 0.16, x, y - s);
  c.closePath();
}

// a filled shape with its shading: the base color, a shadow crescent on the bottom right (what the shape shifted up and
// left doesn't cover), a highlight, then its ink outline
function cel(c, path, base, dark, light, { sx = 0.1, sy = 0.12, outline = true, lw = LW } = {}) {
  c.beginPath(); path(c, 0, 0); c.fillStyle = base; c.fill();
  c.save();
  c.beginPath(); path(c, 0, 0); c.clip();
  if (dark) {
    // the shadow: the part of the shape that the shape shifted up and left doesn't cover (bottom right)
    c.beginPath(); c.rect(-4, -4, 8, 8); path(c, -sx, -sy);
    c.fillStyle = dark; c.fill('evenodd');
  }
  if (light) {
    // the highlight: the same the other way round (top left), thinner
    c.beginPath(); c.rect(-4, -4, 8, 8); path(c, sx * 0.55, sy * 0.55);
    c.fillStyle = light; c.fill('evenodd');
  }
  c.restore();
  if (outline) { c.beginPath(); path(c, 0, 0); c.lineWidth = lw; c.strokeStyle = INK; c.stroke(); }
}

// words on a sticker, drawn in device pixels (fonts don't like tiny sizes in scaled space)
function label(c, R, text, x, y, size, { fill = INK, stroke = null, sw = 0.16, rot = 0, weight = 900, align = 'center', font = 'AK Display', maxW = 0 } = {}) {
  c.save();
  c.translate(x, y); c.rotate(rot);
  c.scale(1 / R, 1 / R);
  let px = size * R;
  c.font = `${weight} ${px}px '${font}', 'Arial Black', system-ui, sans-serif`;
  if (maxW) {
    const m = c.measureText(text).width;
    if (m > maxW * R) { px *= (maxW * R) / m; c.font = `${weight} ${px}px '${font}', 'Arial Black', system-ui, sans-serif`; }
  }
  c.textAlign = align; c.textBaseline = 'middle';
  c.lineJoin = 'round';
  if (stroke) { c.lineWidth = px * sw; c.strokeStyle = stroke; c.strokeText(text, 0, px * 0.04); }
  c.fillStyle = fill; c.fillText(text, 0, px * 0.04);
  c.restore();
}

const strokeInk = (c, w = LW) => { c.lineWidth = w; c.strokeStyle = INK; c.stroke(); };
const fillInk = (c, fill, w = LW) => { c.fillStyle = fill; c.fill(); strokeInk(c, w); };

// ---------- the kinds ----------
const DRAW = {
  airdrop(c, R) {
    // the parachute: a striped canopy and its strings
    c.beginPath();
    c.moveTo(-0.58, -0.16); c.lineTo(-0.9, -0.6); c.moveTo(0.58, -0.16); c.lineTo(0.9, -0.6);
    c.moveTo(-0.3, -0.16); c.lineTo(-0.34, -0.62); c.moveTo(0.3, -0.16); c.lineTo(0.34, -0.62);
    c.lineWidth = 0.04; c.strokeStyle = INK; c.stroke();
    const canopy = (k, ox, oy) => {
      k.moveTo(-0.98 + ox, -0.6 + oy);
      k.bezierCurveTo(-0.96 + ox, -1.28 + oy, 0.96 + ox, -1.28 + oy, 0.98 + ox, -0.6 + oy);
      k.quadraticCurveTo(0.65 + ox, -0.74 + oy, 0.33 + ox, -0.6 + oy);
      k.quadraticCurveTo(0 + ox, -0.74 + oy, -0.33 + ox, -0.6 + oy);
      k.quadraticCurveTo(-0.65 + ox, -0.74 + oy, -0.98 + ox, -0.6 + oy);
      k.closePath();
    };
    cel(c, canopy, '#cdb8ff', '#9d84ec', '#efe8ff', { outline: false });
    c.save(); c.beginPath(); canopy(c, 0, 0); c.clip();
    c.fillStyle = '#ff4da6';
    for (const sx of [-0.66, 0, 0.66]) { c.beginPath(); c.moveTo(sx - 0.16, -0.5); c.quadraticCurveTo(sx - 0.06, -1.2, sx, -1.3); c.quadraticCurveTo(sx + 0.06, -1.2, sx + 0.16, -0.5); c.fill(); }
    c.restore();
    c.beginPath(); canopy(c, 0, 0); strokeInk(c);
    // the box
    const box = (k, ox, oy) => rr(k, -0.64 + ox, -0.2 + oy, 1.28, 1.02, 0.12);
    cel(c, box, '#ff4da6', '#d02f86', '#ff92c9');
    c.save(); c.beginPath(); box(c, 0, 0); c.clip();
    c.fillStyle = '#ffc933'; c.fillRect(-0.13, -0.3, 0.26, 1.2); c.fillRect(-0.7, 0.2, 1.4, 0.22);
    c.fillStyle = '#e3a400'; c.fillRect(0.05, -0.3, 0.08, 1.2); c.fillRect(-0.7, 0.36, 1.4, 0.06);
    c.restore();
    c.beginPath(); c.rect(-0.13, -0.2, 0.26, 1.02); c.rect(-0.64, 0.2, 1.28, 0.22); strokeInk(c, 0.05);
    c.beginPath(); box(c, 0, 0); strokeInk(c);
    // the FREE label
    c.save(); c.translate(0.08, 0.5); c.rotate(-0.12);
    c.beginPath(); rr(c, -0.6, -0.24, 1.2, 0.48, 0.12); fillInk(c, PAPER);
    c.restore();
    label(c, R, 'FREE', 0.08, 0.5, 0.36, { rot: -0.12, maxW: 1.02 });
  },

  seed(c, R) {
    const bubble = (k, ox, oy) => {
      k.moveTo(-0.6 + ox, -0.76 + oy);
      k.lineTo(0.6 + ox, -0.76 + oy);
      k.quadraticCurveTo(0.98 + ox, -0.76 + oy, 0.98 + ox, -0.38 + oy);
      k.lineTo(0.98 + ox, 0.14 + oy);
      k.quadraticCurveTo(0.98 + ox, 0.52 + oy, 0.6 + ox, 0.52 + oy);
      k.lineTo(-0.2 + ox, 0.52 + oy);
      k.lineTo(-0.72 + ox, 0.92 + oy);
      k.lineTo(-0.56 + ox, 0.52 + oy);
      k.lineTo(-0.6 + ox, 0.52 + oy);
      k.quadraticCurveTo(-0.98 + ox, 0.52 + oy, -0.98 + ox, 0.14 + oy);
      k.lineTo(-0.98 + ox, -0.38 + oy);
      k.quadraticCurveTo(-0.98 + ox, -0.76 + oy, -0.6 + ox, -0.76 + oy);
      k.closePath();
    };
    cel(c, bubble, PAPER, '#dccff9', null);
    label(c, R, 'seed', -0.1, -0.33, 0.44, { fill: INK, maxW: 1.3 });
    label(c, R, 'phrase?', 0, 0.12, 0.4, { fill: '#6b3bff', maxW: 1.7 });
    // the unread badge
    c.beginPath(); c.arc(0.9, -0.74, 0.26, 0, Math.PI * 2); fillInk(c, '#ff5a5f');
    c.beginPath(); c.arc(0.84, -0.82, 0.08, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,.55)'; c.fill();
    label(c, R, '1', 0.9, -0.73, 0.31, { fill: PAPER });
  },

  hook(c, R) {
    // the chain: two links, like the link icon
    const link = (x, y, a) => {
      c.save(); c.translate(x, y); c.rotate(a);
      c.beginPath(); rr(c, -0.3, -0.14, 0.6, 0.28, 0.14);
      c.lineWidth = 0.21; c.strokeStyle = INK; c.stroke();
      c.lineWidth = 0.11; c.strokeStyle = '#8b66ff'; c.stroke();
      c.restore();
    };
    link(-0.5, -0.92, -0.75);
    link(-0.16, -0.68, -0.75);
    // the hook: a thick bent wire with a barb
    const hook = () => {
      c.beginPath();
      c.moveTo(0.12, -0.42);
      c.lineTo(0.12, 0.3);
      c.arc(-0.22, 0.3, 0.34, 0, Math.PI, false);
      c.lineTo(-0.56, 0.02);
    };
    hook(); c.lineWidth = 0.3; c.strokeStyle = INK; c.stroke();
    hook(); c.lineWidth = 0.17; c.strokeStyle = '#d9d4ea'; c.stroke();
    c.beginPath(); c.moveTo(0.08, -0.36); c.lineTo(0.08, 0.28); c.lineWidth = 0.05; c.strokeStyle = '#ffffff'; c.stroke();
    // the barb
    c.beginPath(); c.moveTo(-0.66, 0.04); c.lineTo(-0.56, -0.24); c.lineTo(-0.38, 0.08); c.closePath(); fillInk(c, '#d9d4ea', 0.06);
    // the eye where the chain hangs
    c.beginPath(); c.arc(0.12, -0.5, 0.13, 0, Math.PI * 2); c.lineWidth = 0.2; c.strokeStyle = INK; c.stroke();
    c.lineWidth = 0.1; c.strokeStyle = '#d9d4ea'; c.stroke();
    // the bait: an email on the hook
    c.save(); c.translate(0.36, 0.5); c.rotate(-0.28);
    c.beginPath(); rr(c, -0.42, -0.28, 0.84, 0.56, 0.08); fillInk(c, '#ff4da6');
    c.beginPath(); c.moveTo(-0.42, -0.26); c.lineTo(0, 0.06); c.lineTo(0.42, -0.26); strokeInk(c, 0.06);
    c.beginPath(); c.moveTo(-0.32, 0.22); c.lineTo(-0.08, 0.02); c.moveTo(0.32, 0.22); c.lineTo(0.08, 0.02); c.lineWidth = 0.04; c.strokeStyle = 'rgba(23,10,54,.55)'; c.stroke();
    c.restore();
  },

  badge(c, R) {
    // the rosette's tails (behind)
    for (const s of [-1, 1]) {
      c.beginPath();
      c.moveTo(0.18 * s, 0.5); c.lineTo(0.5 * s, 1.08); c.lineTo(0.34 * s, 0.98); c.lineTo(0.24 * s, 1.14); c.lineTo(-0.04 * s, 0.56); c.closePath();
      fillInk(c, s < 0 ? '#ffc933' : '#e3a400');
    }
    // a scalloped seal, a little lopsided
    const seal = (k, ox, oy) => {
      const n = 12;
      for (let i = 0; i <= n * 2; i++) {
        const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
        const wob = i === 6 ? 0.14 : i === 15 ? -0.05 : 0;
        const rad = (i % 2 ? 0.66 : 0.82) + wob;
        const x = Math.cos(a) * rad * 1.04 + ox, y = Math.sin(a) * rad * 0.96 + oy - 0.06;
        if (i === 0) k.moveTo(x, y); else k.lineTo(x, y);
      }
      k.closePath();
    };
    c.save(); c.rotate(0.14);
    cel(c, seal, '#59c8ff', '#2d9fe0', '#a8e4ff', { lw: LW });
    c.restore();
    // the wonky check: its short stroke too long, its long one bent
    const check = () => { c.beginPath(); c.moveTo(-0.46, -0.12); c.lineTo(-0.1, 0.32); c.quadraticCurveTo(0.12, -0.02, 0.5, -0.4); };
    check(); c.lineWidth = 0.34; c.strokeStyle = INK; c.stroke();
    check(); c.lineWidth = 0.2; c.strokeStyle = PAPER; c.stroke();
  },

  signals(c, R) {
    c.save(); c.rotate(-0.22);
    // the handle
    c.beginPath(); rr(c, -0.3, 0.12, 0.2, 0.58, 0.07); fillInk(c, '#4a1fd6');
    // the cone
    const cone = (k, ox, oy) => { k.moveTo(-0.66 + ox, -0.18 + oy); k.lineTo(0.48 + ox, -0.66 + oy); k.lineTo(0.48 + ox, 0.66 + oy); k.lineTo(-0.66 + ox, 0.18 + oy); k.closePath(); };
    cel(c, cone, '#ffc933', '#e09a00', '#ffe28a');
    // the mouthpiece and the bell
    c.beginPath(); rr(c, -0.86, -0.17, 0.24, 0.34, 0.07); fillInk(c, '#ff5a5f');
    c.beginPath(); c.ellipse(0.5, 0, 0.17, 0.68, 0, 0, Math.PI * 2); fillInk(c, '#ff5a5f');
    c.beginPath(); c.ellipse(0.53, 0, 0.09, 0.5, 0, 0, Math.PI * 2); c.fillStyle = '#b8323a'; c.fill();
    label(c, R, '100x', -0.13, 0.01, 0.4, { fill: INK, maxW: 0.74 });
    // its noise
    for (const [rad, a] of [[0.36, 0.62], [0.6, 0.56]]) {
      c.beginPath(); c.arc(0.64, 0, rad, -a, a);
      c.lineWidth = 0.17; c.strokeStyle = INK; c.stroke();
      c.lineWidth = 0.08; c.strokeStyle = PAPER; c.stroke();
    }
    c.restore();
  },

  hat(c, R) {
    // the wand, leaning on it
    c.save(); c.translate(0.66, 0.2); c.rotate(0.62);
    c.beginPath(); rr(c, -0.07, -0.66, 0.14, 1.04, 0.05); fillInk(c, INK);
    c.beginPath(); rr(c, -0.07, -0.66, 0.14, 0.24, 0.05); fillInk(c, PAPER);
    c.restore();
    // the brim
    c.beginPath(); c.ellipse(0, 0.62, 0.98, 0.22, 0, 0, Math.PI * 2); fillInk(c, '#3a17b0');
    // the crown
    const crown = (k, ox, oy) => {
      k.moveTo(-0.6 + ox, 0.6 + oy); k.lineTo(-0.66 + ox, -0.46 + oy);
      k.quadraticCurveTo(0 + ox, -0.66 + oy, 0.66 + ox, -0.46 + oy);
      k.lineTo(0.6 + ox, 0.6 + oy);
      k.quadraticCurveTo(0 + ox, 0.76 + oy, -0.6 + ox, 0.6 + oy);
      k.closePath();
    };
    cel(c, crown, '#4a1fd6', '#30108f', '#7b5aff');
    // the band
    c.save(); c.beginPath(); crown(c, 0, 0); c.clip();
    c.beginPath(); c.moveTo(-0.8, 0.12); c.quadraticCurveTo(0, 0.26, 0.8, 0.12); c.lineTo(0.8, 0.5); c.quadraticCurveTo(0, 0.64, -0.8, 0.5); c.closePath();
    c.fillStyle = '#ff4da6'; c.fill(); strokeInk(c, 0.05);
    c.restore();
    c.beginPath(); crown(c, 0, 0); strokeInk(c);
    label(c, R, '1→2', 0, 0.36, 0.34, { fill: PAPER, stroke: INK, sw: 0.2, maxW: 1.05 });
    // sparkles out of the top
    for (const [x, y, s] of [[-0.32, -0.92, 0.2], [0.14, -1.12, 0.26], [0.5, -0.86, 0.15]]) { c.beginPath(); sparkle(c, x, y, s); fillInk(c, '#ffc933', 0.05); }
  },

  impostor(c, R) {
    // the wig's long strands behind the head (a crooked fake of her long blonde hair)
    c.save(); c.rotate(-0.16);
    for (const s of [-1, 1]) {
      c.beginPath();
      c.moveTo(0.6 * s, -0.5);
      c.quadraticCurveTo(1.0 * s, 0.0, 0.84 * s, 0.68);
      c.quadraticCurveTo(0.76 * s, 0.86, 0.6 * s, 0.7);
      c.quadraticCurveTo(0.72 * s, 0.3, 0.46 * s, -0.2);
      c.closePath();
      fillInk(c, s < 0 ? '#ffd76a' : '#e8b740');
    }
    c.restore();
    // the head
    const head = (k, ox, oy) => rr(k, -0.64 + ox, -0.36 + oy, 1.28, 1.06, 0.24);
    cel(c, head, '#c6c1d9', '#9893b1', '#eeecf6');
    c.beginPath(); c.arc(-0.7, 0.18, 0.11, 0, Math.PI * 2); fillInk(c, '#9893b1', 0.05);
    c.beginPath(); c.arc(0.7, 0.18, 0.11, 0, Math.PI * 2); fillInk(c, '#9893b1', 0.05);
    // the screen face: suspicious eyes and a grille
    c.beginPath(); rr(c, -0.48, -0.12, 0.96, 0.66, 0.16); fillInk(c, '#2b2147', 0.05);
    c.save();
    c.fillStyle = '#ffc933';
    c.beginPath(); c.moveTo(-0.36, 0.06); c.lineTo(-0.1, 0.1); c.lineTo(-0.12, 0.2); c.lineTo(-0.36, 0.18); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(0.36, 0.06); c.lineTo(0.1, 0.1); c.lineTo(0.12, 0.2); c.lineTo(0.36, 0.18); c.closePath(); c.fill();
    c.fillStyle = '#ff4da6';
    c.beginPath(); rr(c, -0.2, 0.32, 0.4, 0.07, 0.03); c.fill();
    c.restore();
    // the wig's cap, crooked, with a pink clip
    c.save(); c.translate(0.02, -0.36); c.rotate(-0.2);
    const cap = (k, ox, oy) => {
      k.moveTo(-0.76 + ox, 0.18 + oy);
      k.bezierCurveTo(-0.84 + ox, -0.62 + oy, 0.84 + ox, -0.62 + oy, 0.76 + ox, 0.18 + oy);
      k.quadraticCurveTo(0.6 + ox, 0.02 + oy, 0.44 + ox, 0.22 + oy);
      k.quadraticCurveTo(0.26 + ox, 0.02 + oy, 0.1 + ox, 0.2 + oy);
      k.quadraticCurveTo(-0.1 + ox, 0.0 + oy, -0.28 + ox, 0.22 + oy);
      k.quadraticCurveTo(-0.5 + ox, 0.02 + oy, -0.76 + ox, 0.18 + oy);
      k.closePath();
    };
    cel(c, cap, '#ffd76a', '#e0ae3a', '#fff0b8');
    c.beginPath(); c.moveTo(-0.3, -0.3); c.quadraticCurveTo(-0.1, -0.1, 0.0, -0.36); c.moveTo(0.2, -0.32); c.quadraticCurveTo(0.34, -0.12, 0.46, -0.26);
    c.lineWidth = 0.045; c.strokeStyle = 'rgba(23,10,54,.55)'; c.stroke();
    c.beginPath(); rr(c, 0.38, -0.08, 0.3, 0.14, 0.06); fillInk(c, '#ff4da6', 0.05);
    c.restore();
    // the antenna pokes through it
    c.beginPath(); c.moveTo(0.3, -0.62); c.lineTo(0.38, -0.98); strokeInk(c, 0.07);
    c.beginPath(); c.arc(0.39, -1.02, 0.1, 0, Math.PI * 2); fillInk(c, '#ff5a5f', 0.05);
  },

  support(c, R) {
    // the headband
    const band = () => { c.beginPath(); c.arc(0, 0.08, 0.7, Math.PI * 1.02, Math.PI * 1.98); };
    band(); c.lineWidth = 0.3; c.strokeStyle = INK; c.stroke();
    band(); c.lineWidth = 0.17; c.strokeStyle = '#6b3bff'; c.stroke();
    // the mic's boom (behind the cup)
    c.beginPath(); c.moveTo(-0.72, 0.42); c.quadraticCurveTo(-0.62, 0.86, -0.08, 0.8);
    c.lineWidth = 0.17; c.strokeStyle = INK; c.stroke(); c.lineWidth = 0.08; c.strokeStyle = '#4a3d6e'; c.stroke();
    c.beginPath(); c.ellipse(-0.02, 0.79, 0.15, 0.12, 0, 0, Math.PI * 2); fillInk(c, '#2b2147', 0.06);
    // the cups
    for (const s of [-1, 1]) {
      const cup = (k, ox, oy) => rr(k, (s < 0 ? -0.98 : 0.6) + ox, -0.1 + oy, 0.38, 0.66, 0.16);
      cel(c, cup, '#6b3bff', '#4a1fd6', '#9b7bff');
      c.beginPath(); rr(c, s < 0 ? -0.66 : 0.56, -0.02, 0.1, 0.5, 0.05); fillInk(c, '#3ff0c3', 0.05);
    }
    // urgent
    c.beginPath(); c.arc(0.56, -0.66, 0.3, 0, Math.PI * 2); fillInk(c, '#ff5a5f');
    label(c, R, '!', 0.56, -0.66, 0.46, { fill: PAPER });
    c.save(); c.translate(0, 1.0); c.rotate(-0.05);
    c.beginPath();
    c.moveTo(-0.8, -0.2); c.lineTo(0.8, -0.2); c.lineTo(0.7, 0); c.lineTo(0.8, 0.2); c.lineTo(-0.8, 0.2); c.lineTo(-0.7, 0); c.closePath();
    fillInk(c, '#ff5a5f');
    c.restore();
    label(c, R, 'URGENT', 0, 1.0, 0.27, { fill: PAPER, rot: -0.05, maxW: 1.32 });
  },

  golden(c, R) {
    // handles
    for (const s of [-1, 1]) {
      c.beginPath(); c.moveTo(0.5 * s, -0.62); c.bezierCurveTo(1.04 * s, -0.66, 1.0 * s, -0.04, 0.4 * s, -0.08);
      c.lineWidth = 0.27; c.strokeStyle = INK; c.stroke(); c.lineWidth = 0.14; c.strokeStyle = '#ffc933'; c.stroke();
    }
    // base and stem
    c.beginPath(); rr(c, -0.6, 0.66, 1.2, 0.24, 0.07); fillInk(c, '#d99a00');
    c.beginPath(); rr(c, -0.44, 0.44, 0.88, 0.26, 0.07); fillInk(c, '#ffc933');
    c.beginPath(); c.moveTo(-0.13, 0.12); c.lineTo(0.13, 0.12); c.lineTo(0.16, 0.46); c.lineTo(-0.16, 0.46); c.closePath(); fillInk(c, '#e3a400');
    // the cup
    const cup = (k, ox, oy) => {
      k.moveTo(-0.64 + ox, -0.78 + oy); k.lineTo(0.64 + ox, -0.78 + oy);
      k.bezierCurveTo(0.64 + ox, -0.1 + oy, 0.36 + ox, 0.18 + oy, 0 + ox, 0.2 + oy);
      k.bezierCurveTo(-0.36 + ox, 0.18 + oy, -0.64 + ox, -0.1 + oy, -0.64 + ox, -0.78 + oy);
      k.closePath();
    };
    cel(c, cup, '#ffc933', '#d99a00', '#fff1b8', { sx: 0.12, sy: 0.1 });
    c.beginPath(); c.ellipse(0, -0.78, 0.64, 0.1, 0, 0, Math.PI * 2); fillInk(c, '#fff1b8', 0.06);
    label(c, R, 'WIN!', 0.02, -0.38, 0.36, { fill: INK, maxW: 0.92 });
    for (const [x, y, s] of [[-0.92, -1.0, 0.2], [0.98, -0.8, 0.16], [0.9, 0.62, 0.14]]) { c.beginPath(); sparkle(c, x, y, s); fillInk(c, PAPER, 0.05); }
  },

  heart(c, R) {
    // the love letter behind it
    c.save(); c.translate(0.46, -0.6); c.rotate(0.32);
    c.beginPath(); rr(c, -0.32, -0.22, 0.64, 0.44, 0.06); fillInk(c, PAPER, 0.06);
    c.beginPath(); c.moveTo(-0.32, -0.2); c.lineTo(0, 0.04); c.lineTo(0.32, -0.2); strokeInk(c, 0.05);
    c.restore();
    const h = (k, ox, oy) => heartPath(k, ox, 0.06 + oy, 0.96);
    cel(c, h, '#8b66ff', '#6236e8', '#b9a2ff', { sx: 0.12, sy: 0.12 });
    // shine
    c.beginPath(); c.moveTo(-0.66, -0.36); c.quadraticCurveTo(-0.62, -0.68, -0.32, -0.7);
    c.lineWidth = 0.13; c.strokeStyle = 'rgba(255,255,255,.9)'; c.stroke();
    c.beginPath(); c.arc(-0.66, -0.12, 0.065, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,.9)'; c.fill();
    // a small pink heart seal in its middle
    c.beginPath(); heartPath(c, 0.06, 0.08, 0.3); fillInk(c, '#ff4da6', 0.05);
  },

  rug(c, R) {
    c.scale(1.12, 1.12);
    // the fringe (right end)
    c.beginPath();
    for (let i = 0; i < 6; i++) { const y = -0.27 + i * 0.108; c.moveTo(0.76, y); c.lineTo(1.0, y + 0.03); }
    c.lineWidth = 0.1; c.strokeStyle = INK; c.stroke(); c.lineWidth = 0.05; c.strokeStyle = PAPER; c.stroke();
    // the roll
    const roll = (k, ox, oy) => rr(k, -0.8 + ox, -0.36 + oy, 1.6, 0.72, 0.3);
    cel(c, roll, '#ff5a5f', '#c8343a', '#ff9497');
    c.save(); c.beginPath(); roll(c, 0, 0); c.clip();
    // its pattern: zigzag bands
    for (const bx of [-0.42, 0.42]) {
      c.beginPath();
      for (let i = 0; i <= 8; i++) { const y = -0.4 + i * 0.1; const x = bx + (i % 2 ? 0.07 : -0.07); if (i) c.lineTo(x, y); else c.moveTo(x, y); }
      c.lineWidth = 0.14; c.strokeStyle = '#ffc933'; c.stroke();
    }
    c.restore();
    c.beginPath(); roll(c, 0, 0); strokeInk(c);
    // the rolled end, with its spiral
    c.beginPath(); c.ellipse(-0.76, 0, 0.2, 0.36, 0, 0, Math.PI * 2); fillInk(c, '#a62930');
    c.beginPath();
    for (let i = 0; i <= 40; i++) { const a = i * 0.32, rad = 0.02 + i * 0.0085; const x = -0.76 + Math.cos(a) * rad * 0.56, y = Math.sin(a) * rad; if (i) c.lineTo(x, y); else c.moveTo(x, y); }
    c.lineWidth = 0.045; c.strokeStyle = '#ffc9a8'; c.stroke();
    // its label
    c.beginPath(); rr(c, -0.4, -0.2, 0.88, 0.4, 0.08); fillInk(c, PAPER, 0.06);
    label(c, R, 'RUG', 0.04, 0.0, 0.34, { fill: INK, maxW: 0.74 });
    // the fuse, out of the spiral's middle
    c.beginPath(); c.moveTo(-0.76, -0.04); c.bezierCurveTo(-0.82, -0.42, -1.12, -0.36, -1.02, -0.74);
    c.lineWidth = 0.16; c.strokeStyle = INK; c.stroke(); c.lineWidth = 0.075; c.strokeStyle = '#8a5a2b'; c.stroke();
    c.beginPath(); sparkle(c, -1.0, -0.8, 0.2); fillInk(c, '#ffc933', 0.045);
  },

  freeze(c, R) { token(c, R, '#59c8ff', '#2d9fe0', '#a8e4ff', 'FREEZE', snowflake); },
  frenzy(c, R) { token(c, R, '#ffc933', '#e09a00', '#ffe28a', 'FRENZY', bolt); },
  double(c, R) { token(c, R, '#3ff0c3', '#16c79a', '#a6ffe7', 'DOUBLE', (k) => label(k, R, '×2', 0.0, -0.06, 0.66, { fill: PAPER, stroke: INK, sw: 0.22 })); },
};

function token(c, R, base, dark, light, word, icon) {
  const disc = (k, ox, oy) => { k.moveTo(0.86 + ox, -0.06 + oy); k.arc(ox, -0.06 + oy, 0.86, 0, Math.PI * 2); };
  cel(c, disc, base, dark, light);
  c.beginPath(); c.arc(0, -0.06, 0.66, 0, Math.PI * 2); c.setLineDash([0.12, 0.1]); c.lineWidth = 0.05; c.strokeStyle = 'rgba(23,10,54,.45)'; c.stroke(); c.setLineDash([]);
  icon(c);
  c.save(); c.translate(0, 0.78);
  c.beginPath(); rr(c, -0.74, -0.18, 1.48, 0.36, 0.14); fillInk(c, INK, 0.05);
  c.restore();
  label(c, R, word, 0, 0.78, 0.26, { fill: PAPER, maxW: 1.26 });
}
function snowflake(c) {
  const arms = () => {
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3 - Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a);
      c.moveTo(0, -0.06); c.lineTo(ca * 0.5, -0.06 + sa * 0.5);
      for (const [d, s] of [[0.3, 0.14]]) {
        const bx = ca * d, by = -0.06 + sa * d;
        c.moveTo(bx, by); c.lineTo(bx + Math.cos(a + 0.9) * s, by + Math.sin(a + 0.9) * s);
        c.moveTo(bx, by); c.lineTo(bx + Math.cos(a - 0.9) * s, by + Math.sin(a - 0.9) * s);
      }
    }
  };
  arms(); c.lineWidth = 0.21; c.strokeStyle = INK; c.stroke();
  arms(); c.lineWidth = 0.1; c.strokeStyle = PAPER; c.stroke();
}
function bolt(c) {
  c.beginPath();
  c.moveTo(0.1, -0.62); c.lineTo(-0.34, 0.02); c.lineTo(-0.04, 0.02); c.lineTo(-0.14, 0.5); c.lineTo(0.34, -0.16); c.lineTo(0.04, -0.16); c.lineTo(0.16, -0.62);
  c.closePath();
  c.fillStyle = PAPER; c.fill(); c.lineWidth = 0.07; c.strokeStyle = INK; c.stroke();
}

// ---------- building the sprites ----------

// the art's outline grown by `rad` pixels, in one color (the paper border, the ink edge, the shadow)
function grow(src, rad, color) {
  const S = src.width;
  const out = mk(S, S);
  const c = out.getContext('2d');
  const n = Math.max(12, Math.min(28, Math.round(rad * 2.4)));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    c.drawImage(src, Math.cos(a) * rad, Math.sin(a) * rad);
    if (i % 2 === 0) c.drawImage(src, Math.cos(a) * rad * 0.55, Math.sin(a) * rad * 0.55);
  }
  c.globalCompositeOperation = 'source-in';
  c.fillStyle = color;
  c.fillRect(0, 0, S, S);
  return out;
}

// one kind at `R` device pixels per radius → { canvas (the sticker), shadow (its silhouette in ink), S, R }
export function buildSprite(kind, R) {
  const S = Math.max(8, Math.ceil(2 * PAD * R));
  const art = mk(S, S);
  const c = art.getContext('2d');
  c.translate(S / 2, S / 2);
  c.scale(R, R);
  c.lineJoin = 'round'; c.lineCap = 'round';
  DRAW[kind](c, R);
  const edge = grow(art, (BORDER + EDGE) * R, INK);
  const border = grow(art, BORDER * R, PAPER);
  const out = mk(S, S);
  const o = out.getContext('2d');
  o.drawImage(edge, 0, 0);
  o.drawImage(border, 0, 0);
  o.drawImage(art, 0, 0);
  return { kind, canvas: out, shadow: edge, S, R };
}

// all of them, for a world scale (device pixels per world unit); kept until the size changes
export function buildSprites(pxPerUnit) {
  const out = {};
  for (const kind of Object.keys(KINDS)) {
    const R = Math.max(6, Math.min(170, KINDS[kind].r * pxPerUnit));
    out[kind] = buildSprite(kind, R);
  }
  return out;
}

// ---------- halves ----------
// A pool of canvases for halves (reused: no new canvas for every slice)
export function createHalves(max = 36) {
  const free = [];
  let made = 0;
  return {
    // the half of `sp` on one side of the cut (ang: the blade's angle in the sticker's own frame, off: how far from its
    // middle the cut runs, in world units; side: +1 or −1)
    make(sp, ang, offUnits, side, inner, pxPerUnit) {
      let cv = free.pop();
      if (!cv) { if (made >= max) return null; cv = mk(sp.S, sp.S); made++; }
      if (cv.width !== sp.S || cv.height !== sp.S) { cv.width = sp.S; cv.height = sp.S; }
      const c = cv.getContext('2d');
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalCompositeOperation = 'source-over';
      c.clearRect(0, 0, sp.S, sp.S);
      const h = sp.S / 2, off = offUnits * pxPerUnit;
      const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
      const L = sp.S * 1.5;
      // the half-plane on this side of the cut
      const px = h + nx * off, py = h + ny * off;
      c.save();
      c.beginPath();
      c.moveTo(px - ux * L, py - uy * L); c.lineTo(px + ux * L, py + uy * L);
      c.lineTo(px + ux * L + nx * L * side, py + uy * L + ny * L * side); c.lineTo(px - ux * L + nx * L * side, py - uy * L + ny * L * side);
      c.closePath();
      c.clip();
      c.drawImage(sp.canvas, 0, 0);
      c.restore();
      // the cut face: a light band along the cut with an ink line at its very edge, only where the sticker is
      c.globalCompositeOperation = 'source-atop';
      c.beginPath(); c.moveTo(px - ux * L, py - uy * L); c.lineTo(px + ux * L, py + uy * L);
      c.lineWidth = sp.R * 0.34; c.strokeStyle = inner; c.stroke();
      c.lineWidth = sp.R * 0.12; c.strokeStyle = INK; c.stroke();
      c.globalCompositeOperation = 'source-over';
      return cv;
    },
    release(cv) { if (cv && free.length < max) free.push(cv); },
    get made() { return made; },
  };
}

// a few splat shapes (an ink blot with drops), drawn white once and tinted per color on demand
export function createSplats(px) {
  const cache = new Map();
  const shapes = [];
  const size = Math.max(16, Math.round(px));
  for (let s = 0; s < 4; s++) {
    const cv = mk(size * 2, size * 2);
    const c = cv.getContext('2d');
    c.translate(size, size);
    c.fillStyle = '#fff';
    let seed = 17 + s * 101;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    c.beginPath();
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2, rad = size * (0.42 + rnd() * 0.22);
      const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
      if (i === 0) c.moveTo(x, y); else c.quadraticCurveTo(Math.cos(a - 0.35) * rad * 1.15, Math.sin(a - 0.35) * rad * 1.15, x, y);
    }
    c.fill();
    for (let i = 0; i < 7; i++) {
      const a = rnd() * Math.PI * 2, d = size * (0.62 + rnd() * 0.3), rr2 = size * (0.05 + rnd() * 0.09);
      c.beginPath(); c.arc(Math.cos(a) * d, Math.sin(a) * d, rr2, 0, Math.PI * 2); c.fill();
    }
    shapes.push(cv);
  }
  return {
    size,
    get(i, color) {
      const key = `${i % 4}${color}`;
      let cv = cache.get(key);
      if (!cv) {
        const src = shapes[i % 4];
        cv = mk(src.width, src.height);
        const c = cv.getContext('2d');
        c.drawImage(src, 0, 0);
        c.globalCompositeOperation = 'source-in';
        c.fillStyle = color; c.fillRect(0, 0, cv.width, cv.height);
        cache.set(key, cv);
      }
      return cv;
    },
  };
}
