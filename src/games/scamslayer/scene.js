// SCAM SLAYER: AGI-1's desk at night, behind the game. A flat illustration drawn in code once per screen size (portrait,
// landscape and in between each get their own layout), at a lower resolution than the screen so it's softly out of focus,
// and darkened so the stickers pop. Two layers for a gentle parallax: the city through the window (far) and the room
// (near: its wall with the window cut out, the curtains, the fairy lights, the desk with her monitor, the lamp, a mug, a
// plant and her cat asleep).
import { mk } from './art.js';

const C = {
  wallTop: '#2c1654', wallBot: '#1c0e38', stripe: 'rgba(255,240,255,0.035)',
  frame: '#a58fdc', frameD: '#7a62b8', frameL: '#c9b8f4', sill: '#bba6ee',
  curtain: '#b8458b', curtainD: '#8c3168', curtainL: '#d86aa8',
  deskTop: '#5b3a80', deskEdge: '#7d58a6', deskFace: '#3a2259', deskFaceD: '#2c1946',
  bezel: '#130830', screen: '#271a4c', screenHead: '#352462',
  lamp: '#ffc933', lampD: '#d79b0a', arm: '#3b2a5e', armL: '#5a4785',
  leaf: '#3aa878', leafD: '#2a7f5c', pot: '#d24f91', potD: '#a33a70',
  cat: '#8f8aa8', catD: '#6c6789', catL: '#b3aec8',
  mug: '#f4ecff', mugD: '#cbbfe6',
  skyTop: '#120a36', skyMid: '#29165e', skyLow: '#55277a',
  cityFar: '#2c1d5e', cityNear: '#1a1142', moon: '#fff1c2',
  bulbs: ['#ffd76a', '#ff7cbf', '#7fe9ff', '#b69cff'],
};

function rr(c, x, y, w, h, r) {
  const q = Math.max(0, Math.min(r, w / 2, h / 2));
  c.beginPath();
  c.moveTo(x + q, y);
  c.arcTo(x + w, y, x + w, y + h, q); c.arcTo(x + w, y + h, x, y + h, q);
  c.arcTo(x, y + h, x, y, q); c.arcTo(x, y, x + w, y, q);
  c.closePath();
}

// a small seeded dice of its own (the same room every time for a screen size)
function dice(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// where everything goes on a w × h screen (CSS pixels)
export function layoutScene(w, h) {
  const u = Math.min(w, h) / 600;
  const aspect = h / w;
  const portrait = aspect >= 1.2, landscape = aspect <= 0.8;
  let win;
  if (portrait) { const ww = w * 0.74; win = { x: (w - ww) / 2, y: h * 0.1, w: ww, h: Math.min(h * 0.4, ww * 1.32) }; }
  else if (landscape) { const ww = Math.min(w * 0.42, h * 1.05); win = { x: w * 0.07, y: h * 0.09, w: ww, h: h * 0.58 }; }
  else win = { x: w * 0.08, y: h * 0.09, w: w * 0.52, h: h * 0.5 };
  const deskY = h * (portrait ? 0.83 : 0.8);
  const mw = portrait ? w * 0.52 : landscape ? Math.min(w * 0.3, h * 0.6) : w * 0.4;
  const mh = mw * 0.62;
  const mx = portrait ? w * 0.4 : landscape ? w * 0.66 : w * 0.7;
  const monitor = { x: mx - mw / 2, y: deskY - mh - u * 34, w: mw, h: mh };
  const lamp = { x: portrait ? w * 0.86 : landscape ? w * 0.9 : w * 0.9, y: deskY };
  return { u, portrait, landscape, win, deskY, monitor, lamp };
}

function drawSky(c, w, h, L) {
  const g = c.createLinearGradient(0, 0, 0, h * 0.75);
  g.addColorStop(0, C.skyTop); g.addColorStop(0.55, C.skyMid); g.addColorStop(1, C.skyLow);
  c.fillStyle = g; c.fillRect(-w, -h, w * 3, h * 3);
  const rnd = dice(7 + Math.round(w) * 3 + Math.round(h));
  const { u, win } = L;
  // stars
  for (let i = 0; i < 70; i++) {
    const x = win.x + rnd() * win.w, y = win.y + rnd() * win.h * 0.6;
    c.globalAlpha = 0.35 + rnd() * 0.5;
    c.fillStyle = rnd() < 0.2 ? '#ffd76a' : '#ffffff';
    const s = (rnd() < 0.15 ? 2.6 : 1.5) * u;
    c.fillRect(x, y, s, s);
  }
  c.globalAlpha = 1;
  // the moon (a crescent)
  const mx = win.x + win.w * 0.74, my = win.y + win.h * 0.2, mr = Math.min(win.w, win.h) * 0.1;
  const halo = c.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 2.6);
  halo.addColorStop(0, 'rgba(255,241,194,0.16)'); halo.addColorStop(1, 'rgba(255,241,194,0)');
  c.fillStyle = halo;
  c.beginPath(); c.arc(mx, my, mr * 2.6, 0, Math.PI * 2); c.fill();
  c.fillStyle = C.moon;
  c.beginPath(); c.arc(mx, my, mr, 0, Math.PI * 2); c.fill();
  // the crescent's bite: the sky drawn back over it (the same gradient, so it's seamless)
  c.fillStyle = g;
  c.beginPath(); c.arc(mx - mr * 0.45, my - mr * 0.25, mr * 0.88, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(255,241,194,0.1)';
  c.beginPath(); c.arc(mx - mr * 0.45, my - mr * 0.25, mr * 0.88, 0, Math.PI * 2); c.fill();
  // a soft cloud
  c.fillStyle = 'rgba(120,80,170,0.35)';
  for (const [cx, cy, s] of [[0.28, 0.32, 1], [0.62, 0.44, 0.8]]) {
    const x = win.x + win.w * cx, y = win.y + win.h * cy, q = win.w * 0.08 * s;
    c.beginPath(); c.ellipse(x, y, q * 2.2, q * 0.55, 0, 0, Math.PI * 2); c.ellipse(x + q * 0.7, y - q * 0.35, q * 1.1, q * 0.55, 0, 0, Math.PI * 2); c.fill();
  }
  // two rows of buildings with their windows lit
  const rows = [
    { base: win.y + win.h * 0.62, hMin: 0.12, hMax: 0.32, color: C.cityFar, lit: 0.32, wmin: 0.07, wmax: 0.13 },
    { base: win.y + win.h * 0.78, hMin: 0.16, hMax: 0.42, color: C.cityNear, lit: 0.45, wmin: 0.09, wmax: 0.17 },
  ];
  for (const row of rows) {
    let x = win.x - win.w * 0.1;
    while (x < win.x + win.w * 1.1) {
      const bw = win.w * (row.wmin + rnd() * (row.wmax - row.wmin));
      const bh = win.h * (row.hMin + rnd() * (row.hMax - row.hMin));
      const top = row.base - bh;
      c.fillStyle = row.color;
      c.fillRect(x, top, bw, win.y + win.h * 1.3 - top);
      if (rnd() < 0.3) c.fillRect(x + bw * 0.4, top - bh * 0.12, bw * 0.12, bh * 0.12);   // an antenna
      // windows
      const cw = Math.max(2, 5 * u), ch = Math.max(2, 6 * u), gx = cw * 1.9, gy = ch * 1.8;
      for (let yy = top + gy * 0.8; yy < row.base + win.h * 0.4; yy += gy) {
        for (let xx = x + gx * 0.6; xx < x + bw - cw; xx += gx) {
          if (rnd() < row.lit) {
            const k = rnd();
            c.fillStyle = k < 0.6 ? 'rgba(255,201,51,0.75)' : k < 0.85 ? 'rgba(255,124,191,0.7)' : 'rgba(127,233,255,0.6)';
            c.fillRect(xx, yy, cw, ch);
          }
        }
      }
      x += bw + win.w * (0.005 + rnd() * 0.02);
    }
  }
  // a little neon heart on the near row
  const hx = win.x + win.w * 0.3, hy = win.y + win.h * 0.5, hs = Math.min(win.w, win.h) * 0.05;
  c.strokeStyle = 'rgba(255,77,166,0.9)'; c.lineWidth = Math.max(1.5, 3 * u);
  c.beginPath();
  c.moveTo(hx, hy + hs * 0.8);
  c.bezierCurveTo(hx - hs * 1.2, hy, hx - hs * 0.8, hy - hs * 0.9, hx, hy - hs * 0.35);
  c.bezierCurveTo(hx + hs * 0.8, hy - hs * 0.9, hx + hs * 1.2, hy, hx, hy + hs * 0.8);
  c.stroke();
}

function drawRoom(c, w, h, L) {
  const { u, win, deskY, monitor: M, lamp } = L;
  const rnd = dice(91 + Math.round(w) + Math.round(h) * 7);
  // the wall, with faint stripes
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, C.wallTop); g.addColorStop(1, C.wallBot);
  c.fillStyle = g; c.fillRect(-w, -h, w * 3, h * 3);
  c.fillStyle = C.stripe;
  for (let x = -w * 0.2; x < w * 1.2; x += 44 * u) c.fillRect(x, -h, 18 * u, h * 3);

  // the window: its frame, then the glass cut out so the city shows through
  const fr = Math.max(6, 14 * u);
  rr(c, win.x - fr, win.y - fr, win.w + fr * 2, win.h + fr * 2, 10 * u); c.fillStyle = C.frameD; c.fill();
  rr(c, win.x - fr, win.y - fr, win.w + fr * 2, win.h + fr * 2 - 4 * u, 10 * u); c.fillStyle = C.frame; c.fill();
  c.globalCompositeOperation = 'destination-out';
  rr(c, win.x, win.y, win.w, win.h, 4 * u); c.fill();
  c.globalCompositeOperation = 'source-over';
  // mullions
  c.fillStyle = C.frame;
  c.fillRect(win.x + win.w / 2 - fr * 0.35, win.y, fr * 0.7, win.h);
  c.fillRect(win.x, win.y + win.h * 0.46 - fr * 0.35, win.w, fr * 0.7);
  c.fillStyle = C.frameL;
  c.fillRect(win.x + win.w / 2 - fr * 0.35, win.y, fr * 0.2, win.h);
  // the glass's faint reflection
  c.fillStyle = 'rgba(255,255,255,0.05)';
  c.beginPath(); c.moveTo(win.x + win.w * 0.1, win.y + win.h); c.lineTo(win.x + win.w * 0.32, win.y); c.lineTo(win.x + win.w * 0.4, win.y); c.lineTo(win.x + win.w * 0.18, win.y + win.h); c.fill();
  // the sill
  rr(c, win.x - fr * 1.8, win.y + win.h + fr * 0.5, win.w + fr * 3.6, fr * 1.3, 4 * u); c.fillStyle = C.sill; c.fill();
  c.fillStyle = C.frameD; c.fillRect(win.x - fr * 1.6, win.y + win.h + fr * 1.6, win.w + fr * 3.2, fr * 0.35);

  // the curtains, tied back
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? win.x - fr * 2.4 : win.x + win.w + fr * 2.4;
    const cw = Math.max(win.w * 0.2, 46 * u);
    const top = win.y - fr * 2.2, bot = win.y + win.h + fr * 3.2, tie = win.y + win.h * 0.62;
    c.beginPath();
    c.moveTo(x0, top);
    c.lineTo(x0 - side * cw, top);
    c.quadraticCurveTo(x0 - side * cw * 0.9, tie - win.h * 0.2, x0 - side * cw * 0.25, tie);
    c.quadraticCurveTo(x0 - side * cw * 1.05, tie + win.h * 0.2, x0 - side * cw * 0.95, bot);
    c.lineTo(x0 + side * cw * 0.25, bot);
    c.lineTo(x0 + side * cw * 0.25, top);
    c.closePath();
    c.fillStyle = C.curtain; c.fill();
    c.save(); c.clip();
    c.fillStyle = C.curtainD;
    for (let k = 0; k < 4; k++) c.fillRect(x0 - side * cw * (0.1 + k * 0.28), top, cw * 0.09, bot - top);
    c.fillStyle = C.curtainL;
    c.fillRect(x0 - side * cw * 0.85, top, cw * 0.06, bot - top);
    c.restore();
    rr(c, x0 - side * cw * 0.4 - 9 * u, tie - 5 * u, 18 * u, 10 * u, 4 * u); c.fillStyle = '#ffc933'; c.fill();
  }
  // the rod
  c.fillStyle = C.frameD;
  rr(c, win.x - fr * 4, win.y - fr * 2.6, win.w + fr * 8, Math.max(3, 6 * u), 3 * u); c.fill();

  // fairy lights along the top of the window
  const n = Math.max(8, Math.round(win.w / (26 * u)));
  const sag = win.h * 0.07;
  c.strokeStyle = 'rgba(30,16,60,0.9)'; c.lineWidth = Math.max(1, 1.6 * u);
  c.beginPath();
  for (let i = 0; i <= 40; i++) {
    const t = i / 40, x = win.x - fr + (win.w + fr * 2) * t, y = win.y - fr * 0.4 + Math.sin(t * Math.PI) * sag;
    if (i) c.lineTo(x, y); else c.moveTo(x, y);
  }
  c.stroke();
  L.bulbs = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, x = win.x - fr + (win.w + fr * 2) * t, y = win.y - fr * 0.4 + Math.sin(t * Math.PI) * sag + 5 * u;
    L.bulbs.push({ x, y, color: C.bulbs[i % C.bulbs.length] });
    c.fillStyle = C.bulbs[i % C.bulbs.length];
    c.beginPath(); c.ellipse(x, y, 3.6 * u, 5 * u, 0, 0, Math.PI * 2); c.fill();
  }

  // a shelf with books and a framed heart (wide screens)
  if ((L.landscape || !L.portrait) && w - (win.x + win.w) > 160 * u) {
    const sx = Math.max(M.x + M.w * 0.05, win.x + win.w + fr * 3.4 + Math.max(win.w * 0.2, 46 * u) * 0.3), sw = Math.min(M.w * 0.95, w - sx - 20 * u), sy = Math.max(win.y + 20 * u, M.y - M.h * 0.75);
    c.fillStyle = C.frameD; rr(c, sx, sy, sw, 9 * u, 3 * u); c.fill();
    let bx = sx + sw * 0.06;
    const spines = ['#ff4da6', '#ffc933', '#59c8ff', '#8b66ff', '#3ff0c3', '#ff5a5f'];
    for (let i = 0; i < 6; i++) {
      const bw = (10 + rnd() * 8) * u, bh = (34 + rnd() * 18) * u;
      c.fillStyle = spines[i]; c.globalAlpha = 0.8;
      rr(c, bx, sy - bh, bw, bh, 2 * u); c.fill();
      bx += bw + 2 * u;
    }
    c.globalAlpha = 1;
    const fx = sx + sw * 0.66, fs = 46 * u;
    rr(c, fx, sy - fs, fs * 0.8, fs, 4 * u); c.fillStyle = '#e9ddff'; c.fill();
    c.fillStyle = '#ff4da6';
    const hx = fx + fs * 0.4, hy = sy - fs * 0.52, hs = fs * 0.2;
    c.beginPath(); c.moveTo(hx, hy + hs); c.bezierCurveTo(hx - hs * 1.6, hy - hs * 0.2, hx - hs * 0.6, hy - hs * 1.4, hx, hy - hs * 0.4); c.bezierCurveTo(hx + hs * 0.6, hy - hs * 1.4, hx + hs * 1.6, hy - hs * 0.2, hx, hy + hs); c.fill();
  }

  // a plant on the sill
  const px = win.x + win.w - 34 * u, py = win.y + win.h + fr * 0.5;
  c.fillStyle = C.leafD;
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.42, len = (30 + (i % 3) * 8) * u;
    c.beginPath(); c.ellipse(px + Math.cos(a) * len * 0.55, py - 18 * u + Math.sin(a) * len * 0.55, len * 0.5, 7 * u, a, 0, Math.PI * 2);
    c.fillStyle = i % 2 ? C.leaf : C.leafD; c.fill();
  }
  rr(c, px - 14 * u, py - 22 * u, 28 * u, 24 * u, 5 * u); c.fillStyle = C.pot; c.fill();
  c.fillStyle = C.potD; c.fillRect(px - 14 * u, py - 22 * u, 28 * u, 5 * u);

  // the desk
  c.fillStyle = C.deskFace; c.fillRect(-w, deskY, w * 3, h * 2);
  c.fillStyle = C.deskFaceD; c.fillRect(-w, deskY + 26 * u, w * 3, 6 * u);
  c.fillStyle = C.deskTop; c.fillRect(-w, deskY - 4 * u, w * 3, 26 * u);
  c.fillStyle = C.deskEdge; c.fillRect(-w, deskY - 4 * u, w * 3, 4 * u);

  // the monitor: a stand, a bezel, AGI-1's chat on screen
  c.fillStyle = C.bezel;
  rr(c, M.x + M.w * 0.44, M.y + M.h, M.w * 0.12, 30 * u, 3 * u); c.fill();
  rr(c, M.x + M.w * 0.32, deskY - 8 * u, M.w * 0.36, 9 * u, 4 * u); c.fill();
  rr(c, M.x - 7 * u, M.y - 7 * u, M.w + 14 * u, M.h + 14 * u, 12 * u); c.fill();
  rr(c, M.x, M.y, M.w, M.h, 6 * u); c.fillStyle = C.screen; c.fill();
  c.save(); rr(c, M.x, M.y, M.w, M.h, 6 * u); c.clip();
  c.fillStyle = C.screenHead; c.fillRect(M.x, M.y, M.w, M.h * 0.16);
  c.fillStyle = '#ffd76a'; c.beginPath(); c.arc(M.x + M.h * 0.09, M.y + M.h * 0.08, M.h * 0.05, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(228,217,255,0.6)'; rr(c, M.x + M.h * 0.17, M.y + M.h * 0.06, M.w * 0.24, M.h * 0.04, 2 * u); c.fill();
  const bubbles = [[0, 0.24, 0.5], [1, 0.38, 0.36], [0, 0.52, 0.42], [1, 0.66, 0.5], [0, 0.8, 0.3]];
  for (const [side, yy, ww] of bubbles) {
    const bw = M.w * ww, bh = M.h * 0.1;
    const bx = side ? M.x + M.w - bw - M.w * 0.05 : M.x + M.w * 0.05;
    c.fillStyle = side ? 'rgba(255,77,166,0.85)' : 'rgba(205,184,255,0.75)';
    rr(c, bx, M.y + M.h * yy, bw, bh, bh / 2); c.fill();
  }
  // a scam warning in the chat
  c.fillStyle = '#ff5a5f';
  const tx = M.x + M.w * 0.42, ty = M.y + M.h * 0.585, ts = M.h * 0.05;
  c.beginPath(); c.moveTo(tx, ty - ts); c.lineTo(tx + ts, ty + ts * 0.8); c.lineTo(tx - ts, ty + ts * 0.8); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.06)';
  c.beginPath(); c.moveTo(M.x + M.w * 0.6, M.y); c.lineTo(M.x + M.w * 0.8, M.y); c.lineTo(M.x + M.w * 0.5, M.y + M.h); c.lineTo(M.x + M.w * 0.3, M.y + M.h); c.fill();
  c.restore();
  // a sticky note on its corner
  c.save(); c.translate(M.x + M.w - 6 * u, M.y + 10 * u); c.rotate(0.12);
  c.fillStyle = '#ffd76a'; c.fillRect(-14 * u, -12 * u, 28 * u, 26 * u);
  c.fillStyle = 'rgba(23,10,54,0.35)'; c.fillRect(-9 * u, -4 * u, 18 * u, 2.4 * u); c.fillRect(-9 * u, 2 * u, 13 * u, 2.4 * u);
  c.restore();

  // the keyboard
  const kw = M.w * 0.7, kx = M.x + (M.w - kw) / 2;
  rr(c, kx, deskY + 2 * u, kw, 12 * u, 4 * u); c.fillStyle = '#4c3672'; c.fill();
  c.fillStyle = 'rgba(228,217,255,0.25)';
  for (let i = 0; i < 12; i++) c.fillRect(kx + kw * 0.05 + i * kw * 0.075, deskY + 5 * u, kw * 0.05, 4 * u);

  // a mug with a heart, steaming
  const gx = Math.max(24 * u, M.x - 44 * u), gy = deskY - 30 * u;
  rr(c, gx, gy, 26 * u, 30 * u, 5 * u); c.fillStyle = C.mug; c.fill();
  c.fillStyle = C.mugD; c.fillRect(gx + 18 * u, gy, 8 * u, 30 * u);
  c.strokeStyle = C.mug; c.lineWidth = 4 * u; c.beginPath(); c.arc(gx - 1 * u, gy + 15 * u, 7 * u, Math.PI * 0.5, Math.PI * 1.5); c.stroke();
  c.fillStyle = '#ff4da6'; c.beginPath(); c.arc(gx + 10 * u, gy + 14 * u, 4 * u, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 2.4 * u;
  for (const sx of [6, 16]) { c.beginPath(); c.moveTo(gx + sx * u, gy - 4 * u); c.bezierCurveTo(gx + (sx - 6) * u, gy - 14 * u, gx + (sx + 6) * u, gy - 20 * u, gx + sx * u, gy - 30 * u); c.stroke(); }

  // her cat, asleep on the desk by the lamp
  const cx = lamp.x - 70 * u, cy = deskY - 2 * u;
  if (cx > M.x + M.w + 30 * u || L.portrait) {
    const kx2 = L.portrait ? w * 0.72 : cx;
    c.fillStyle = C.catD; c.beginPath(); c.ellipse(kx2 + 26 * u, cy - 6 * u, 22 * u, 7 * u, -0.2, 0, Math.PI * 2); c.fill();   // tail
    c.fillStyle = C.cat; c.beginPath(); c.ellipse(kx2, cy - 16 * u, 34 * u, 18 * u, 0, Math.PI, 0); c.lineTo(kx2 + 34 * u, cy); c.lineTo(kx2 - 34 * u, cy); c.fill();
    c.fillStyle = C.catD;
    for (const sx of [-14, -2, 10]) c.fillRect(kx2 + sx * u, cy - 32 * u, 5 * u, 12 * u);
    c.fillStyle = C.cat; c.beginPath(); c.ellipse(kx2 - 26 * u, cy - 12 * u, 15 * u, 12 * u, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(kx2 - 38 * u, cy - 18 * u); c.lineTo(kx2 - 36 * u, cy - 32 * u); c.lineTo(kx2 - 28 * u, cy - 22 * u); c.fill();
    c.beginPath(); c.moveTo(kx2 - 24 * u, cy - 22 * u); c.lineTo(kx2 - 16 * u, cy - 32 * u); c.lineTo(kx2 - 15 * u, cy - 18 * u); c.fill();
    c.strokeStyle = 'rgba(23,10,54,0.6)'; c.lineWidth = 1.6 * u;
    c.beginPath(); c.arc(kx2 - 31 * u, cy - 12 * u, 3 * u, 0.2, Math.PI - 0.2); c.moveTo(kx2 - 19 * u, cy - 12 * u); c.arc(kx2 - 22 * u, cy - 12 * u, 3 * u, 0.2, Math.PI - 0.2); c.stroke();
  }

  // the lamp: a base, an arm, a shade over the desk
  const ax = lamp.x, ay = deskY;
  const armH = Math.min(h * 0.32, 190 * u);
  c.fillStyle = C.arm; rr(c, ax - 26 * u, ay - 9 * u, 52 * u, 10 * u, 5 * u); c.fill();
  c.strokeStyle = C.arm; c.lineWidth = 7 * u; c.lineCap = 'round';
  c.beginPath(); c.moveTo(ax, ay - 8 * u); c.lineTo(ax + 18 * u, ay - armH * 0.55); c.lineTo(ax - 34 * u, ay - armH); c.stroke();
  c.fillStyle = C.armL; c.beginPath(); c.arc(ax + 18 * u, ay - armH * 0.55, 6 * u, 0, Math.PI * 2); c.fill();
  c.save(); c.translate(ax - 34 * u, ay - armH); c.rotate(-0.55);
  c.fillStyle = C.lamp;
  c.beginPath(); c.moveTo(-12 * u, -12 * u); c.lineTo(12 * u, -12 * u); c.lineTo(34 * u, 26 * u); c.lineTo(-34 * u, 26 * u); c.closePath(); c.fill();
  c.fillStyle = C.lampD; c.fillRect(-34 * u, 22 * u, 68 * u, 5 * u);
  c.fillStyle = '#fff6d6'; c.beginPath(); c.ellipse(0, 27 * u, 18 * u, 5 * u, 0, 0, Math.PI * 2); c.fill();
  c.restore();
  L.lampGlow = { x: ax - 34 * u + Math.sin(0.55) * 30 * u, y: ay - armH + 30 * u };
}

// both layers for a w × h screen. `res`: canvas pixels per CSS pixel (lower: softer). `margin`: extra room on every
// side for the parallax.
export function buildScene(w, h, { res = 0.5, farRes = 0.38 } = {}) {
  const L = layoutScene(w, h);
  const m = Math.round(16 * L.u);
  L.margin = m;
  const W = w + m * 2, H = h + m * 2;
  // far: the sky and the city
  const back = mk(W * farRes, H * farRes);
  const b = back.getContext('2d');
  b.scale(farRes, farRes); b.translate(m, m);
  drawSky(b, w, h, L);
  // near: the room
  const room = mk(W * res, H * res);
  const c = room.getContext('2d');
  c.scale(res, res); c.translate(m, m);
  drawRoom(c, w, h, L);
  // the lamp's warm light (on the room, kept bright), then night over everything, then a vignette
  const lg = L.lampGlow;
  c.save();
  c.globalCompositeOperation = 'source-atop';
  c.fillStyle = 'rgba(10,4,28,0.34)';
  c.fillRect(-m, -m, W, H);
  const vg = c.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.3, w / 2, h * 0.5, Math.max(w, h) * 0.8);
  vg.addColorStop(0, 'rgba(8,3,22,0)'); vg.addColorStop(1, 'rgba(8,3,22,0.55)');
  c.fillStyle = vg; c.fillRect(-m, -m, W, H);
  c.globalCompositeOperation = 'lighter';
  const glow = c.createRadialGradient(lg.x, L.deskY, 4, lg.x, L.deskY, Math.min(w, h) * 0.5);
  glow.addColorStop(0, 'rgba(255,190,90,0.34)'); glow.addColorStop(0.5, 'rgba(255,150,80,0.1)'); glow.addColorStop(1, 'rgba(255,150,80,0)');
  c.fillStyle = glow; c.fillRect(-m, -m, W, H);
  const M = L.monitor;
  const mg = c.createRadialGradient(M.x + M.w / 2, M.y + M.h / 2, M.w * 0.2, M.x + M.w / 2, M.y + M.h / 2, M.w * 0.9);
  mg.addColorStop(0, 'rgba(150,120,255,0.12)'); mg.addColorStop(1, 'rgba(150,120,255,0)');
  c.fillStyle = mg; c.fillRect(-m, -m, W, H);
  for (const bulb of L.bulbs) {
    const bgl = c.createRadialGradient(bulb.x, bulb.y, 1, bulb.x, bulb.y, 16 * L.u);
    bgl.addColorStop(0, bulb.color); bgl.addColorStop(1, 'rgba(0,0,0,0)');
    c.globalAlpha = 0.35; c.fillStyle = bgl; c.fillRect(bulb.x - 16 * L.u, bulb.y - 16 * L.u, 32 * L.u, 32 * L.u);
  }
  c.restore();
  // the city through the glass, dimmed too
  b.fillStyle = 'rgba(10,4,28,0.28)'; b.fillRect(-m, -m, W, H);
  return { back, room, L, m, res, farRes, w, h };
}
