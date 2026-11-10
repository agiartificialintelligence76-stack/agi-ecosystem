// PACKET LOSS: the characters and objects, drawn in code (canvas paths, no files): AGI-1's love letter, the four lag
// gremlins (PING, JITTER, THROTTLE, ECHO) in sticker style with ink outlines and big eyes that look where they're
// going, the encryption key, the read receipt, the repeater, a bit. Every function draws at (x, y) with `u` = one tile
// in pixels, so they stay crisp at any size.
import { PALETTE, roundRect, TAU } from '../kit/fx.js';

export const C = Object.freeze({
  bg: '#0b1022', bg2: '#10173a', mesh: '#1b2550', ink: '#170a36', inkDeep: '#07051a',
  paper: '#fffaf0', pink: PALETTE.pink, honey: PALETTE.honey, mint: PALETTE.mint, violet: PALETTE.violet2,
  lav: PALETTE.lav, red: '#ff5a3c', yellow: '#ffe14d', purple: '#9b5cff', echo: '#2a2155', echoLine: '#8b7bff',
  gate: '#ff4d6d', white: '#ffffff', scram: '#141a3c',
});
export const KIND_COLOR = { ping: C.red, jitter: C.yellow, throttle: C.purple, echo: C.echoLine };
export const KIND_NAME = { ping: 'PING', jitter: 'JITTER', throttle: 'THROTTLE', echo: 'ECHO' };

// ---------- small shapes ----------
export function heartPath(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.95);
  ctx.bezierCurveTo(x - r * 1.35, y + r * 0.05, x - r * 1.05, y - r * 1.15, x, y - r * 0.42);
  ctx.bezierCurveTo(x + r * 1.05, y - r * 1.15, x + r * 1.35, y + r * 0.05, x, y + r * 0.95);
  ctx.closePath();
}
function outline(ctx, w, color = C.ink) { ctx.lineWidth = w; ctx.strokeStyle = color; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }

// two big eyes that look where they're going (lx, ly: -1..1)
export function eyes(ctx, x, y, u, lx, ly, { gap = 0.17, rx = 0.12, ry = 0.15, pupil = 0.065, lid = 0, color = C.white } = {}) {
  for (const sgn of [-1, 1]) {
    const ex = x + sgn * gap * u;
    ctx.beginPath(); ctx.ellipse(ex, y, rx * u, ry * u, 0, 0, TAU);
    ctx.fillStyle = color; ctx.fill(); outline(ctx, Math.max(1, 0.04 * u));
    ctx.beginPath();
    ctx.arc(ex + lx * (rx - pupil * 0.7) * u, y + ly * (ry - pupil * 0.75) * u, pupil * u, 0, TAU);
    ctx.fillStyle = C.ink; ctx.fill();
    ctx.beginPath(); ctx.arc(ex + lx * (rx - pupil * 0.7) * u - pupil * 0.35 * u, y + ly * (ry - pupil * 0.75) * u - pupil * 0.35 * u, pupil * 0.32 * u, 0, TAU);
    ctx.fillStyle = C.white; ctx.fill();
    if (lid > 0) {
      // a cross brow (angry): a line over the eye, sloping in
      ctx.beginPath(); ctx.moveTo(ex - sgn * rx * 1.1 * u, y - ry * (1.25 - lid * 0.2) * u); ctx.lineTo(ex + sgn * rx * 1.05 * u, y - ry * (0.75 - lid * 0.25) * u);
      outline(ctx, Math.max(1.2, 0.055 * u));
    }
  }
}
// scrambled: dizzy little spiral eyes and a wavy mouth
function dizzyFace(ctx, x, y, u, t, color) {
  ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, 0.045 * u); ctx.lineCap = 'round';
  for (const sgn of [-1, 1]) {
    const ex = x + sgn * 0.17 * u;
    ctx.beginPath();
    for (let k = 0; k <= 14; k++) {
      const a = k * 0.62 + t * 9 * sgn, r = (0.015 + k * 0.0075) * u;
      const px = ex + Math.cos(a) * r, py = y - 0.02 * u + Math.sin(a) * r;
      if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.stroke();
  }
  ctx.beginPath();
  for (let k = 0; k <= 8; k++) {
    const px = x - 0.16 * u + k * 0.04 * u, py = y + 0.2 * u + Math.sin(k * 1.6 + t * 14) * 0.025 * u;
    if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.stroke();
}

// ---------- AGI-1's love letter ----------
// body: white with an ink outline, the flap, a pink heart seal. `lean` tilts it; sx/sy squash and stretch
export function envelope(ctx, x, y, u, { lean = 0, sx = 1, sy = 1, body = C.paper, line = C.ink, seal = C.pink, flap = 0, alpha = 1, gloss = true, dash = null } = {}) {
  const w = 0.88 * u, h = 0.64 * u, r = 0.11 * u, lw = Math.max(1.3, 0.075 * u);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y); ctx.rotate(lean); ctx.scale(sx, sy);
  roundRect(ctx, -w / 2, -h / 2, w, h, r);
  ctx.fillStyle = body; ctx.fill();
  if (dash) ctx.setLineDash(dash);
  outline(ctx, lw, line);
  if (dash) ctx.setLineDash([]);
  // the bottom folds, faint
  ctx.beginPath(); ctx.moveTo(-w / 2 + r * 0.5, h / 2 - r * 0.4); ctx.lineTo(-w * 0.1, h * 0.04); ctx.moveTo(w / 2 - r * 0.5, h / 2 - r * 0.4); ctx.lineTo(w * 0.1, h * 0.04);
  ctx.globalAlpha *= 0.35; outline(ctx, lw * 0.6, line); ctx.globalAlpha /= 0.35;
  // the flap: a V from the top corners (it lifts a little at speed)
  const tip = h * (0.1 - flap * 0.25);
  ctx.beginPath(); ctx.moveTo(-w / 2 + r * 0.45, -h / 2 + r * 0.35); ctx.lineTo(0, tip); ctx.lineTo(w / 2 - r * 0.45, -h / 2 + r * 0.35);
  outline(ctx, lw * 0.85, line);
  // the seal
  heartPath(ctx, 0, tip + 0.01 * u, 0.13 * u);
  ctx.fillStyle = seal; ctx.fill(); outline(ctx, Math.max(1, lw * 0.6), line);
  if (gloss) {
    ctx.beginPath(); ctx.moveTo(-w * 0.36, -h * 0.28); ctx.lineTo(-w * 0.2, -h * 0.28);
    ctx.globalAlpha *= 0.9; outline(ctx, Math.max(1, 0.05 * u), '#ffffff');
  }
  ctx.restore();
}

// ---------- the gremlins ----------
// PING: a round red-orange alarm bot, one antenna with a blinking bulb, little feet
function drawPing(ctx, x, y, u, o) {
  const r = 0.4 * u, lw = Math.max(1.3, 0.075 * u), bob = Math.sin(o.t * 12) * 0.03 * u;
  y += bob;
  // feet
  ctx.fillStyle = o.body;
  for (const sgn of [-1, 1]) {
    ctx.beginPath(); ctx.ellipse(x + sgn * 0.2 * u, y + r * 0.92, 0.11 * u, 0.07 * u, 0, 0, TAU); ctx.fill(); outline(ctx, lw * 0.8, o.line);
  }
  // antenna
  const ax = x + o.lx * 0.05 * u;
  ctx.beginPath(); ctx.moveTo(x, y - r * 0.9); ctx.quadraticCurveTo(x + 0.02 * u, y - r * 1.35, ax, y - r * 1.48);
  outline(ctx, lw * 0.9, o.line);
  ctx.beginPath(); ctx.arc(ax, y - r * 1.52, 0.085 * u, 0, TAU);
  ctx.fillStyle = o.blink ? C.honey : C.paper; ctx.fill(); outline(ctx, lw * 0.7, o.line);
  // body
  ctx.beginPath();
  if (o.wobble) for (let k = 0; k <= 24; k++) { const a = (k / 24) * TAU, rr = r * (1 + Math.sin(a * 5 + o.t * 14) * 0.06); if (k) ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  else ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = o.body; ctx.fill(); outline(ctx, lw * (o.scrambled ? 1.4 : 1), o.line);
  if (!o.scrambled) {
    // a highlight and the alarm's grille
    ctx.beginPath(); ctx.arc(x - r * 0.28, y - r * 0.32, r * 0.46, Math.PI * 1.05, Math.PI * 1.6);
    outline(ctx, Math.max(1, 0.06 * u), 'rgba(255,255,255,0.55)');
    ctx.beginPath();
    for (let k = -1; k <= 1; k++) { ctx.moveTo(x + k * 0.1 * u, y + r * 0.52); ctx.lineTo(x + k * 0.1 * u, y + r * 0.7); }
    outline(ctx, Math.max(1, 0.045 * u), o.line);
    eyes(ctx, x, y - 0.04 * u, u, o.lx, o.ly, { lid: o.angry ? 1 : 0 });
  } else dizzyFace(ctx, x, y - 0.04 * u, u, o.t, o.line);
}

// JITTER: a yellow zigzag spark, its points never quite still
function drawJitter(ctx, x, y, u, o) {
  const lw = Math.max(1.3, 0.075 * u), n = 9;
  ctx.beginPath();
  for (let k = 0; k < n * 2; k++) {
    const a = (k / (n * 2)) * TAU - Math.PI / 2 + Math.sin(o.t * 3) * 0.05;
    const flick = Math.sin(o.t * 37 + k * 2.3) * 0.035 + (o.wobble ? Math.sin(a * 4 + o.t * 12) * 0.05 : 0);
    const rr = (k % 2 ? 0.3 : 0.47 + flick) * u;
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = o.body; ctx.fill(); outline(ctx, lw * (o.scrambled ? 1.4 : 1), o.line);
  if (!o.scrambled) {
    ctx.beginPath(); ctx.arc(x, y, 0.2 * u, Math.PI * 1.1, Math.PI * 1.55); outline(ctx, Math.max(1, 0.05 * u), 'rgba(255,255,255,0.7)');
    eyes(ctx, x, y - 0.02 * u, u, o.lx, o.ly, { gap: 0.15, rx: 0.11, ry: 0.14, pupil: 0.06 });
    // a toothy zigzag grin
    ctx.beginPath();
    for (let k = 0; k <= 4; k++) ctx.lineTo(x - 0.12 * u + k * 0.06 * u, y + 0.17 * u + (k % 2 ? 0.04 : 0) * u);
    outline(ctx, Math.max(1, 0.045 * u), o.line);
  } else dizzyFace(ctx, x, y - 0.02 * u, u, o.t, o.line);
}

// THROTTLE: a purple blob with a speedometer for a mouth (its needle twitches into the red)
function drawThrottle(ctx, x, y, u, o) {
  const lw = Math.max(1.3, 0.075 * u), w = 0.46 * u, top = y - 0.42 * u, bot = y + 0.36 * u;
  const sq = Math.sin(o.t * 6) * 0.03 * u;
  ctx.beginPath();
  ctx.moveTo(x - w - sq, bot);
  ctx.bezierCurveTo(x - w - sq, y - 0.05 * u, x - w * 0.95, top + sq, x, top + sq);
  ctx.bezierCurveTo(x + w * 0.95, top + sq, x + w + sq, y - 0.05 * u, x + w + sq, bot);
  // a wavy base
  const n = 4;
  for (let k = n; k >= 0; k--) {
    const px = x - w - sq + ((2 * (w + sq)) / n) * k;
    const py = bot + (k % 2 ? 0.06 : -0.01) * u + (o.wobble ? Math.sin(k + o.t * 12) * 0.04 * u : 0);
    ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = o.body; ctx.fill(); outline(ctx, lw * (o.scrambled ? 1.4 : 1), o.line);
  if (!o.scrambled) {
    ctx.beginPath(); ctx.arc(x - 0.16 * u, y - 0.2 * u, 0.18 * u, Math.PI * 1.1, Math.PI * 1.5); outline(ctx, Math.max(1, 0.055 * u), 'rgba(255,255,255,0.5)');
    eyes(ctx, x, y - 0.13 * u, u, o.lx, o.ly, { gap: 0.16, rx: 0.115, ry: 0.13, pupil: 0.06, lid: 0.6 });
    // the gauge: a half dial with ticks, a red zone and a needle
    const gx = x, gy = y + 0.24 * u, gr = 0.17 * u;
    ctx.beginPath(); ctx.arc(gx, gy, gr, Math.PI, 0); ctx.closePath();
    ctx.fillStyle = C.paper; ctx.fill(); outline(ctx, Math.max(1, 0.045 * u), o.line);
    ctx.beginPath(); ctx.arc(gx, gy, gr * 0.78, Math.PI * 1.62, Math.PI * 1.95); outline(ctx, Math.max(1, 0.05 * u), C.gate);
    const na = Math.PI * (1.25 + 0.5 * o.needle);
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + Math.cos(na) * gr * 0.85, gy + Math.sin(na) * gr * 0.85); outline(ctx, Math.max(1, 0.045 * u), o.line);
  } else dizzyFace(ctx, x, y - 0.06 * u, u, o.t, o.line);
}

// ECHO: a dark, see-through copy of the letter, a little out of sync with itself
function drawEcho(ctx, x, y, u, o) {
  const jx = Math.sin(o.t * 53) > 0.82 ? 0.06 * u : 0;
  ctx.save();
  ctx.globalAlpha *= o.alpha;
  if (!o.scrambled) {
    // its ghost of a ghost: one copy a hair to the side
    envelope(ctx, x + jx - 0.05 * u, y, u, { body: 'rgba(255,77,166,0)', line: 'rgba(255,90,140,0.45)', seal: 'rgba(0,0,0,0)', gloss: false, lean: o.lean, alpha: 0.9 });
    envelope(ctx, x + jx, y, u, { body: 'rgba(42,33,85,0.82)', line: C.echoLine, seal: '#7a2a63', gloss: false, lean: o.lean, dash: [0.16 * u, 0.09 * u] });
    // two slanted glowing slits for eyes
    ctx.fillStyle = '#ff7ab8';
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      const ex = x + jx + sgn * 0.17 * u + o.lx * 0.03 * u, ey = y - 0.06 * u + o.ly * 0.02 * u;
      ctx.moveTo(ex - 0.09 * u, ey - sgn * 0.0 * u - 0.035 * u); ctx.lineTo(ex + 0.09 * u, ey + (sgn > 0 ? -0.06 : 0.0) * u + 0.0);
      ctx.lineTo(ex + 0.09 * u, ey + 0.03 * u); ctx.lineTo(ex - 0.09 * u, ey + (sgn > 0 ? 0.03 : 0.06) * u - 0.03 * u);
      ctx.closePath(); ctx.fill();
    }
  } else {
    envelope(ctx, x, y, u, { body: C.scram, line: o.line, seal: o.line, gloss: false, lean: Math.sin(o.t * 9) * 0.15, dash: [0.12 * u, 0.08 * u] });
    dizzyFace(ctx, x, y - 0.05 * u, u * 0.85, o.t, o.line);
  }
  ctx.restore();
}

const DRAW = { ping: drawPing, jitter: drawJitter, throttle: drawThrottle, echo: drawEcho };
// o: { t, lx, ly, scrambled, flashOn, wobble, alpha, angry, blink, needle, lean }
export function gremlin(ctx, kind, x, y, u, o) {
  const color = KIND_COLOR[kind];
  o.body = o.scrambled ? C.scram : color;
  o.line = o.scrambled ? (o.flashOn ? C.white : color) : C.ink;
  o.wobble = o.scrambled;
  DRAW[kind](ctx, x, y, u, o);
}

// ---------- things on the board ----------
// an encryption key: honey, an ink outline, a round bow with a heart cut-out and teeth
export function key(ctx, x, y, u, { t = 0, scale = 1 } = {}) {
  const s = u * scale, lw = Math.max(1.2, 0.07 * s);
  ctx.save(); ctx.translate(x, y); ctx.rotate(-0.6 + Math.sin(t * 2.2) * 0.12);
  // shaft and teeth
  ctx.beginPath();
  ctx.moveTo(-0.02 * s, -0.06 * s); ctx.lineTo(0.42 * s, -0.06 * s); ctx.lineTo(0.42 * s, 0.07 * s); ctx.lineTo(0.34 * s, 0.07 * s);
  ctx.lineTo(0.34 * s, 0.17 * s); ctx.lineTo(0.26 * s, 0.17 * s); ctx.lineTo(0.26 * s, 0.07 * s); ctx.lineTo(0.2 * s, 0.07 * s);
  ctx.lineTo(0.2 * s, 0.13 * s); ctx.lineTo(0.13 * s, 0.13 * s); ctx.lineTo(0.13 * s, 0.07 * s); ctx.lineTo(-0.02 * s, 0.07 * s); ctx.closePath();
  ctx.fillStyle = C.honey; ctx.fill(); outline(ctx, lw);
  // the bow
  ctx.beginPath(); ctx.arc(-0.2 * s, 0, 0.22 * s, 0, TAU); ctx.fillStyle = C.honey; ctx.fill(); outline(ctx, lw);
  heartPath(ctx, -0.2 * s, 0.0, 0.085 * s); ctx.fillStyle = C.ink; ctx.fill();
  ctx.beginPath(); ctx.arc(-0.27 * s, -0.08 * s, 0.07 * s, Math.PI, Math.PI * 1.6); outline(ctx, Math.max(1, 0.04 * s), 'rgba(255,255,255,0.8)');
  ctx.restore();
}
// the read receipt: a pink heart with two little ticks
export function receipt(ctx, x, y, u, { t = 0, left = 9 } = {}) {
  const pulse = 1 + Math.sin(t * 7) * 0.06;
  const r = 0.3 * u * pulse, lw = Math.max(1.2, 0.07 * u);
  heartPath(ctx, x, y - 0.02 * u, r);
  ctx.fillStyle = C.pink; ctx.fill(); outline(ctx, lw);
  // ✓✓ in paper
  ctx.beginPath();
  ctx.moveTo(x - 0.17 * u, y - 0.02 * u); ctx.lineTo(x - 0.1 * u, y + 0.05 * u); ctx.lineTo(x + 0.02 * u, y - 0.08 * u);
  ctx.moveTo(x - 0.05 * u, y + 0.03 * u); ctx.lineTo(x - 0.01 * u, y + 0.05 * u); ctx.lineTo(x + 0.13 * u, y - 0.08 * u);
  outline(ctx, Math.max(1.2, 0.055 * u), C.paper);
  // its time running out: a ring around it
  if (left < 9) {
    ctx.beginPath(); ctx.arc(x, y, 0.48 * u, -Math.PI / 2, -Math.PI / 2 + TAU * (left / 9));
    outline(ctx, Math.max(1, 0.05 * u), 'rgba(255,77,166,0.7)');
  }
}
// the repeater: a little mast with signal arcs
export function repeater(ctx, x, y, u, { t = 0, left = 15 } = {}) {
  const lw = Math.max(1.2, 0.07 * u);
  const blink = left < 3 && Math.sin(t * 18) < 0;
  ctx.save(); if (blink) ctx.globalAlpha *= 0.45;
  ctx.beginPath(); ctx.moveTo(x - 0.17 * u, y + 0.34 * u); ctx.lineTo(x, y - 0.12 * u); ctx.lineTo(x + 0.17 * u, y + 0.34 * u);
  ctx.moveTo(x - 0.1 * u, y + 0.14 * u); ctx.lineTo(x + 0.1 * u, y + 0.14 * u);
  outline(ctx, lw * 1.6, C.ink); outline(ctx, lw * 0.7, C.paper);
  ctx.beginPath(); ctx.arc(x, y - 0.16 * u, 0.08 * u, 0, TAU); ctx.fillStyle = C.mint; ctx.fill(); outline(ctx, lw * 0.8);
  const base = ctx.globalAlpha;
  for (let k = 1; k <= 2; k++) {
    const rr = (0.12 + k * 0.11) * u;
    ctx.globalAlpha = base * (0.55 + 0.45 * Math.sin(t * 6 - k * 1.2));
    ctx.beginPath(); ctx.arc(x, y - 0.16 * u, rr, -0.7, 0.7); outline(ctx, Math.max(1.2, 0.06 * u), C.mint);
    ctx.beginPath(); ctx.arc(x, y - 0.16 * u, rr, Math.PI - 0.7, Math.PI + 0.7); outline(ctx, Math.max(1.2, 0.06 * u), C.mint);
  }
  ctx.restore();
}

// a bit: a tiny mint diamond (cached as a sprite by render.js)
export function bitShape(ctx, x, y, u, bright = false) {
  const r = 0.115 * u;
  ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath();
  ctx.fillStyle = bright ? '#d9fff3' : C.mint; ctx.fill();
  ctx.lineWidth = Math.max(1, 0.035 * u); ctx.strokeStyle = bright ? C.mint : '#0d4a44'; ctx.stroke();
}
