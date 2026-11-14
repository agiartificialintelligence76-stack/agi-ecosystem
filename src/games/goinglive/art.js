// GOING LIVE: her room, drawn in code with the arcade's ink outline (a room 1000 wide and 600 tall: the wall to 440, the
// floor below), every thing in it at every tier, the view from her window in each of her four homes, her awards on the
// wall, her cat, and AGI-1 herself (her 2D art, behind her desk like any streamer). The page scales the room to its view.
import { SLOTS, ROOMS, AWARDS } from './data.js';

export const INK = '#1d1238';
const TAU = Math.PI * 2;
export function mix(a, b, t) {
  const p = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const [r1, g1, b1] = p(a), [r2, g2, b2] = p(b);
  const q = (x, y) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${q(r1, r2)}${q(g1, g2)}${q(b1, b2)}`;
}
export const rgba = (hex, a) => `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`;
const rr = (c, x, y, w, h, r = 6) => { c.beginPath(); c.roundRect(x, y, w, h, r); };
const circ = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, TAU); };
function ink(c, fill, lw = 3) { if (fill) { c.fillStyle = fill; c.fill(); } c.lineWidth = lw; c.strokeStyle = INK; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); }
function line(c, pts, w = 3, color = INK) { c.beginPath(); pts.forEach(([x, y], i) => c[i ? 'lineTo' : 'moveTo'](x, y)); c.lineWidth = w; c.strokeStyle = color; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(); }
function shine(c, x, y, rx, ry, a = 0.5) { c.save(); c.fillStyle = `rgba(255,255,255,${a})`; c.beginPath(); c.ellipse(x, y, rx, ry, -0.5, 0, TAU); c.fill(); c.restore(); }
function glow(c, x, y, r, color, a = 0.5) {
  c.save(); c.globalCompositeOperation = 'lighter';
  const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(color, a)); g.addColorStop(1, rgba(color, 0));
  c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); c.restore();
}

// ---------- the room ----------
// `s`: { room (index), owned ({ slot: tier }), followers, live, cat (what she streams), hype (0…1), t (seconds),
// img (her picture, loaded or not), talk (0…1, she's speaking), tilt (-1…1), emote ('' or a few letters) }
export function drawRoom(c, s) {
  const room = ROOMS[s.room || 0], o = s.owned || {}, t = s.t || 0;
  const tier = (id) => o[id] || 0;
  // the wall, a soft pattern, the floor
  const g = c.createLinearGradient(0, 0, 0, 440); g.addColorStop(0, room.wall); g.addColorStop(1, room.wall2);
  c.fillStyle = g; c.fillRect(0, 0, 1000, 442);
  c.fillStyle = rgba('#ffffff', room.id === 'orbit' ? 0.05 : 0.22);
  if (room.id === 'bedroom') for (let y = 22; y < 430; y += 44) for (let x = (y / 44) % 2 ? 22 : 44; x < 1000; x += 44) { circ(c, x, y, 4); c.fill(); }
  else if (room.id === 'studio') for (let x = 0; x < 1000; x += 46) c.fillRect(x, 0, 18, 440);
  else if (room.id === 'penthouse') for (let y = 0; y < 440; y += 60) c.fillRect(0, y, 1000, 2);
  else for (let k = 0; k < 40; k++) { const x = (k * 263) % 1000, y = (k * 151) % 420; c.fillStyle = 'rgba(255,255,255,0.35)'; circ(c, x, y, k % 5 === 0 ? 2 : 1); c.fill(); }
  c.fillStyle = room.floor; c.fillRect(0, 440, 1000, 160);
  c.strokeStyle = rgba('#000000', 0.12); c.lineWidth = 2;
  for (let y = 470; y < 600; y += 34) { c.beginPath(); c.moveTo(0, y); c.lineTo(1000, y); c.stroke(); }
  rr(c, 0, 432, 1000, 14, 0); ink(c, mix(room.wall2, '#ffffff', 0.5), 3);
  // the rug under her desk
  c.beginPath(); c.ellipse(500, 560, 330, 42, 0, 0, TAU); ink(c, room.id === 'orbit' ? '#6b74ff' : '#ff9ac6', 3);
  c.beginPath(); c.ellipse(500, 560, 280, 30, 0, 0, TAU); c.strokeStyle = rgba('#ffffff', 0.5); c.lineWidth = 3; c.stroke();

  windowPart(c, room, tier('window'), t);
  plants(c, tier('plant'), t, 'back');
  awards(c, s.followers || 0);
  shelf(c, tier('shelf'), t);
  lightsBack(c, tier('lights'), s, t);
  wallArt(c, tier('wall'), s, t);
  camBack(c, tier('cam'), t);
  kitchen(c, tier('kitchen'), t);
  if (tier('pc') >= 3) rack(c, t);
  if (tier('pet') >= 2) catTree(c, tier('pet'), t);
  artCorner(c, tier('art'), t);
  chair(c, tier('chair'));
  her(c, s, t);
  desk(c, s, t);
  if (tier('pet') === 1) catBed(c, t);
  lightsFront(c, tier('lights'), s, t);
  plants(c, tier('plant'), t, 'front');
  if (tier('cam') >= 3) holo(c, t);
  if (room.id === 'orbit') { c.fillStyle = rgba('#7fe0ff', 0.05); c.fillRect(0, 0, 1000, 600); }
}

// ---------- her window, and what's outside ----------
function windowPart(c, room, k, t) {
  const x = 52, y = 66, w = 200, h = 200;
  c.save(); rr(c, x, y, w, h, 8); c.clip();
  const v = room.view;
  const sky = c.createLinearGradient(0, y, 0, y + h);
  if (v === 'suburb') { sky.addColorStop(0, '#8fd3ff'); sky.addColorStop(1, '#d7f2ff'); }
  else if (v === 'city') { sky.addColorStop(0, '#ff9b7a'); sky.addColorStop(1, '#ffd3a0'); }
  else if (v === 'skyline') { sky.addColorStop(0, '#2a2f6a'); sky.addColorStop(1, '#7a5aa8'); }
  else { sky.addColorStop(0, '#05030f'); sky.addColorStop(1, '#16123a'); }
  c.fillStyle = sky; c.fillRect(x, y, w, h);
  if (v === 'suburb') {
    c.fillStyle = '#ffffff'; for (const [cx, cy] of [[x + 50 + (t * 4) % 60, y + 40], [x + 150, y + 62]]) { circ(c, cx, cy, 14); c.fill(); circ(c, cx + 16, cy + 2, 11); c.fill(); }
    c.fillStyle = '#7ccf6a'; c.beginPath(); c.ellipse(x + 60, y + h + 10, 120, 60, 0, 0, TAU); c.fill();
    for (const [hx, col] of [[x + 40, '#ff8a6a'], [x + 120, '#ffc94d']]) { c.fillStyle = col; c.fillRect(hx, y + 140, 40, 40); c.fillStyle = '#c94a4a'; c.beginPath(); c.moveTo(hx - 6, y + 142); c.lineTo(hx + 20, y + 118); c.lineTo(hx + 46, y + 142); c.fill(); }
  } else if (v === 'city' || v === 'skyline') {
    const n = v === 'city' ? 7 : 9;
    for (let i = 0; i < n; i++) {
      const bw = 22 + (i * 7) % 14, bh = (v === 'city' ? 50 : 90) + ((i * 37) % 80), bx = x + i * (w / n) - 4;
      c.fillStyle = v === 'city' ? '#6a4a8a' : '#1a1640'; c.fillRect(bx, y + h - bh, bw, bh);
      c.fillStyle = v === 'city' ? 'rgba(255,230,150,0.8)' : 'rgba(255,240,170,0.9)';
      for (let wy = y + h - bh + 8; wy < y + h - 6; wy += 12) for (let wx = bx + 4; wx < bx + bw - 4; wx += 8) if (((wx * 13 + wy * 7) | 0) % 3) c.fillRect(wx, wy, 3, 5);
    }
    if (v === 'skyline') { c.fillStyle = '#fff6c8'; circ(c, x + 160, y + 40, 14); c.fill(); }
  } else {
    for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(255,255,255,${0.4 + (i % 3) * 0.2})`; circ(c, x + (i * 53) % w, y + (i * 37) % h, i % 7 === 0 ? 1.8 : 1); c.fill(); }
    const eg = c.createRadialGradient(x + 60, y + h + 70, 20, x + 60, y + h + 70, 140); eg.addColorStop(0, '#3fa9ff'); eg.addColorStop(0.7, '#2b6fd0'); eg.addColorStop(1, '#0b2a6a');
    c.fillStyle = eg; circ(c, x + 60, y + h + 70, 130); c.fill();
    c.fillStyle = 'rgba(98,216,76,0.7)'; c.beginPath(); c.ellipse(x + 40, y + h - 30, 30, 14, 0.4, 0, TAU); c.fill();
  }
  c.restore();
  rr(c, x, y, w, h, 8); ink(c, null, 6);
  line(c, [[x + w / 2, y], [x + w / 2, y + h]], 5); line(c, [[x, y + h / 2], [x + w, y + h / 2]], 5);
  rr(c, x - 12, y + h - 2, w + 24, 14, 4); ink(c, '#ffffff', 3);
  if (k === 0) {
    // bent blinds
    for (let i = 0; i < 9; i++) { const yy = y + 6 + i * 10, bent = i === 5; rr(c, x + 4, yy + (bent ? 4 : 0), w - 8, 6, 2); c.save(); if (bent) { c.translate(x + w / 2, yy + 3); c.rotate(0.12); c.translate(-(x + w / 2), -(yy + 3)); } ink(c, '#f3eee4', 1.5); c.restore(); }
  }
  if (k >= 1) {
    for (const side of [-1, 1]) {
      const cx = side < 0 ? x - 16 : x + w + 16;
      c.beginPath(); c.moveTo(cx - 22 * side, y - 18); c.quadraticCurveTo(cx + 26 * side, y + 90, cx - 6 * side, y + h + 6); c.lineTo(cx - 34 * side, y + h + 6); c.quadraticCurveTo(cx - 30 * side, y + 90, cx - 40 * side, y - 18); c.closePath();
      ink(c, k >= 3 ? '#b79cff' : '#ff9ac6', 3);
    }
    rr(c, x - 50, y - 24, w + 100, 10, 5); ink(c, '#c9a26a', 3);
  }
  if (k >= 2) {
    // fairy lights across the top
    c.beginPath(); c.moveTo(x - 40, y - 8); for (let i = 0; i <= 10; i++) c.lineTo(x - 40 + i * 28, y - 8 + Math.sin(i * 1.3) * 8 + 10); c.lineWidth = 2; c.strokeStyle = INK; c.stroke();
    for (let i = 0; i <= 10; i++) { const bx = x - 40 + i * 28, by = y + 4 + Math.sin(i * 1.3) * 8, on = 0.6 + 0.4 * Math.sin(t * 3 + i); glow(c, bx, by, 16, ['#ffd84a', '#ff8ac0', '#7fe0ff'][i % 3], 0.5 * on); c.fillStyle = ['#ffd84a', '#ff8ac0', '#7fe0ff'][i % 3]; circ(c, bx, by, 4); c.fill(); }
  }
  if (k >= 3) {
    // the window seat: a bench, cushions
    rr(c, x - 14, y + h + 12, w + 28, 40, 8); ink(c, '#fffaf0', 3);
    for (const [px, col] of [[x + 20, '#ff8ac0'], [x + 70, '#b79cff'], [x + 150, '#7fe0ff']]) { rr(c, px, y + h - 8, 44, 30, 12); ink(c, col, 3); }
  }
}
function plants(c, k, t, layer) {
  if (k <= 0) return;
  if (layer === 'back') {
    // a cactus on the sill
    rr(c, 214, 236, 26, 24, 5); ink(c, '#e07a4a', 3);
    rr(c, 220, 200, 14, 40, 7); ink(c, '#4fbf5f', 3);
    rr(c, 230, 214, 14, 8, 4); ink(c, '#4fbf5f', 2.5);
    if (k >= 2) {
      // a monstera in the far corner, behind her kitchen
      rr(c, 6, 470, 70, 90, 10); ink(c, '#fffaf0', 3);
      for (const [a, l] of [[-2.2, 120], [-1.7, 150], [-1.2, 130], [-2.7, 100], [-0.8, 110]]) {
        const bx = 40, by = 470, ex = bx + Math.cos(a) * l, ey = by + Math.sin(a) * l + Math.sin(t * 1.2 + l) * 2;
        line(c, [[bx, by], [ex, ey]], 3, '#2f8a3a');
        c.save(); c.translate(ex, ey); c.rotate(a + Math.PI / 2); c.beginPath(); c.ellipse(0, 0, 30, 22, 0, 0, TAU); ink(c, '#3fbf5a', 3);
        c.strokeStyle = rgba(INK, 0.4); c.lineWidth = 2; c.beginPath(); c.moveTo(0, -18); c.lineTo(0, 18); c.stroke(); c.restore();
      }
    }
  } else if (k >= 3) {
    // the indoor jungle: hanging plants from the ceiling
    for (const [px, len] of [[300, 120], [700, 100], [930, 140]]) {
      line(c, [[px, 0], [px, 30]], 2);
      rr(c, px - 22, 30, 44, 28, 8); ink(c, '#fffaf0', 3);
      for (let i = 0; i < 5; i++) {
        const vx = px - 18 + i * 9, sway = Math.sin(t * 1.1 + i + px) * 4;
        c.beginPath(); c.moveTo(vx, 54); c.quadraticCurveTo(vx + sway, 54 + len / 2, vx + sway * 1.5, 54 + len * (0.6 + (i % 3) * 0.15)); c.lineWidth = 3; c.strokeStyle = '#2f8a3a'; c.stroke();
        for (let q = 1; q < 5; q++) { const yy = 54 + q * len / 6; c.fillStyle = '#4fd16a'; c.beginPath(); c.ellipse(vx + sway * q / 4 + (q % 2 ? 6 : -6), yy, 7, 4, q % 2 ? 0.6 : -0.6, 0, TAU); c.fill(); }
      }
    }
  }
}

// ---------- the awards (her milestones) ----------
function awards(c, followers) {
  const got = AWARDS.filter((a) => followers >= a.at);
  got.forEach((a, i) => {
    const x = 788 + i * 30, y = 36;
    rr(c, x, y, 26, 36, 4); ink(c, '#3a2a5a', 2.5);
    rr(c, x + 4, y + 4, 18, 24, 3); ink(c, a.color, 2);
    // a little mic
    rr(c, x + 10, y + 8, 6, 10, 3); c.fillStyle = '#ffffff'; c.fill();
    line(c, [[x + 13, y + 18], [x + 13, y + 24]], 1.5, '#ffffff');
    shine(c, x + 9, y + 9, 3, 2, 0.6);
  });
}
// ---------- the shelf and its plushies ----------
function plush(c, x, y, s, col, kind) {
  c.save(); c.translate(x, y); c.scale(s, s);
  if (kind === 0) { // a bear
    circ(c, -11, -30, 7); ink(c, col, 2.5); circ(c, 11, -30, 7); ink(c, col, 2.5);
    circ(c, 0, -18, 16); ink(c, col, 2.5); c.beginPath(); c.ellipse(0, 6, 18, 16, 0, 0, TAU); ink(c, col, 2.5);
    c.fillStyle = INK; circ(c, -5, -20, 2); c.fill(); circ(c, 5, -20, 2); c.fill();
  } else if (kind === 1) { // a bunny
    rr(c, -12, -48, 8, 26, 4); ink(c, col, 2.5); rr(c, 4, -48, 8, 26, 4); ink(c, col, 2.5);
    circ(c, 0, -14, 16); ink(c, col, 2.5); c.beginPath(); c.ellipse(0, 8, 16, 14, 0, 0, TAU); ink(c, col, 2.5);
    c.fillStyle = INK; circ(c, -5, -16, 2); c.fill(); circ(c, 5, -16, 2); c.fill();
  } else { // a star
    c.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 9 : 20, a = -Math.PI / 2 + i * Math.PI / 5; c.lineTo(Math.cos(a) * r, Math.sin(a) * r - 6); } c.closePath(); ink(c, col, 2.5);
    c.fillStyle = INK; circ(c, -4, -8, 1.8); c.fill(); circ(c, 4, -8, 1.8); c.fill();
  }
  c.restore();
}
function shelf(c, k, t) {
  rr(c, 780, 280, 190, 12, 3); ink(c, '#c9a26a', 3);
  line(c, [[800, 292], [810, 310]], 3); line(c, [[950, 292], [940, 310]], 3);
  if (k >= 1) plush(c, 820, 274, 1, '#ff9ac6', 0);
  if (k >= 2) { plush(c, 870, 274, 0.9, '#b79cff', 1); plush(c, 930, 274, 0.9, '#ffd84a', 2); }
  if (k >= 3) {
    plush(c, 845, 236, 0.85, '#7fe0ff', 1); plush(c, 900, 236, 0.85, '#ff8a6a', 0); plush(c, 950, 238, 0.7, '#62d84c', 2);
    plush(c, 872, 200, 0.8, '#ffffff', 0);
  }
}

// ---------- the wall behind her ----------
function wallArt(c, k, s, t) {
  if (k >= 3) {
    // an LED wall: a grid of lights behind her, waving with the music
    for (let gy = 0; gy < 8; gy++) for (let gx = 0; gx < 10; gx++) {
      const x = 322 + gx * 36, y = 16 + gy * 36, h = (Math.sin(t * 2 + gx * 0.6 + gy * 0.4) + 1) / 2;
      c.fillStyle = mix(['#6b3bff', '#ff4da6', '#2fd6a6'][(gx + gy) % 3], '#ffffff', h * 0.3);
      c.globalAlpha = 0.35 + h * 0.5 * (s.live ? 1 : 0.6); rr(c, x, y, 32, 32, 4); c.fill(); c.globalAlpha = 1;
    }
    rr(c, 318, 12, 364, 296, 8); ink(c, null, 4);
  }
  if (k >= 1) {
    // posters on both sides of her
    for (const [x, col, kind] of [[338, '#6b74ff', 0], [600, '#ff4da6', 1]]) {
      c.save(); c.translate(x + 30, 160); c.rotate(kind ? 0.05 : -0.05);
      rr(c, -30, -42, 60, 84, 3); ink(c, '#fffaf0', 3);
      rr(c, -24, -36, 48, 56, 2); c.fillStyle = col; c.fill();
      if (kind) { c.fillStyle = '#ffd84a'; c.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 7 : 16, a = -Math.PI / 2 + i * Math.PI / 5; c.lineTo(Math.cos(a) * r, Math.sin(a) * r - 8); } c.fill(); }
      else { c.fillStyle = '#ffffff'; rr(c, -14, -24, 28, 18, 4); c.fill(); c.fillStyle = col; circ(c, -6, -15, 3); c.fill(); circ(c, 6, -15, 3); c.fill(); }
      c.fillStyle = INK; c.fillRect(-18, 26, 36, 4); c.fillRect(-12, 33, 24, 3);
      c.restore();
    }
  }
  if (k >= 2) {
    // the neon sign over her head
    const on = s.live ? 1 : 0.75, flick = 0.85 + 0.15 * Math.sin(t * 23) * Math.sin(t * 7);
    glow(c, 500, 44, 120, '#ff4da6', 0.35 * on * flick);
    c.save(); c.font = "900 46px 'AK Display', 'Arial Black', sans-serif"; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 8; c.strokeStyle = rgba('#ff4da6', 0.5 * on); c.strokeText('AGI ♡', 500, 46);
    c.lineWidth = 3; c.strokeStyle = '#ffd6ea'; c.strokeText('AGI ♡', 500, 46);
    c.restore();
  }
}

// ---------- lights ----------
function lightsBack(c, k, s, t) {
  if (k === 1 || k === 2) {
    // a ring light behind her right shoulder
    line(c, [[660, 230], [660, 440]], 5); line(c, [[630, 440], [690, 440]], 5);
    c.beginPath(); c.arc(660, 170, 58, 0, TAU); c.lineWidth = 16; c.strokeStyle = INK; c.stroke(); c.lineWidth = 10; c.strokeStyle = '#fff8e0'; c.stroke();
    glow(c, 660, 170, 120, '#fff4c8', s.live ? 0.35 : 0.2);
  }
  if (k >= 2) {
    // RGB strips: along the ceiling and down the corners, cycling
    const h = (t * 0.25) % 1, col = ['#ff4da6', '#6b74ff', '#2fd6a6', '#ffd84a'][Math.floor(h * 4)];
    c.save(); c.globalCompositeOperation = 'lighter';
    const g = c.createLinearGradient(0, 0, 0, 60); g.addColorStop(0, rgba(col, 0.5)); g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g; c.fillRect(0, 0, 1000, 60);
    c.restore();
    c.fillStyle = col; c.fillRect(0, 0, 1000, 5);
    c.fillStyle = col; c.fillRect(780, 292, 190, 4);
  }
}
function lightsFront(c, k, s, t) {
  if (k < 3) return;
  // stage lights in the top corners, their beams on her
  for (const [x, a] of [[60, 0.55], [940, Math.PI - 0.55]]) {
    const sw = Math.sin(t * 0.8 + x) * 0.12;
    c.save(); c.globalCompositeOperation = 'lighter';
    c.translate(x, 20); c.rotate(a + sw);
    const g = c.createLinearGradient(0, 0, 560, 0); g.addColorStop(0, rgba(x < 500 ? '#ff4da6' : '#7fe0ff', s.live ? 0.4 : 0.22)); g.addColorStop(1, rgba('#ffffff', 0));
    c.fillStyle = g; c.beginPath(); c.moveTo(0, -14); c.lineTo(560, -110); c.lineTo(560, 110); c.lineTo(0, 14); c.fill();
    c.restore();
    c.save(); c.translate(x, 20); c.rotate(a + sw); rr(c, -16, -18, 44, 36, 6); ink(c, '#2a2240', 3); circ(c, 28, 0, 14); ink(c, '#fff4c8', 3); c.restore();
  }
}

// ---------- her camera rig ----------
function camBack(c, k) {
  if (k >= 2) for (const x of [16, 954]) { rr(c, x, 28, 30, 22, 5); ink(c, '#2a2240', 3); c.fillStyle = '#62d84c'; circ(c, x + 15, 39, 4); c.fill(); }
}
function holo(c, t) {
  c.save(); c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 18; i++) {
    const k = ((t * 0.35 + i / 18) % 1), a = i * 2.4 + t * 0.5;
    const x = 500 + Math.cos(a) * (160 - k * 40), y = 430 - k * 380;
    c.fillStyle = rgba(i % 2 ? '#7fe0ff' : '#c9a2ff', (1 - k) * 0.8); circ(c, x, y, 3 + (i % 3)); c.fill();
  }
  const g = c.createLinearGradient(0, 330, 0, 440); g.addColorStop(0, rgba('#7fe0ff', 0)); g.addColorStop(1, rgba('#7fe0ff', 0.25));
  c.fillStyle = g; c.fillRect(330, 330, 340, 110);
  c.restore();
}

// ---------- the corners: her kitchen, her art, the server rack, the cat ----------
function kitchen(c, k, t) {
  if (k === 0) {
    rr(c, 70, 520, 60, 70, 6); ink(c, '#c9a26a', 3); line(c, [[78, 590], [74, 600]], 3); line(c, [[122, 590], [126, 600]], 3);
    rr(c, 84, 486, 34, 34, 10); ink(c, '#ff8a6a', 3); line(c, [[118, 496], [130, 490]], 3); rr(c, 94, 478, 14, 8, 3); ink(c, '#2a2240', 2);
    return;
  }
  if (k === 1) {
    rr(c, 26, 470, 160, 16, 4); ink(c, '#fffaf0', 3); rr(c, 34, 486, 144, 100, 6); ink(c, '#b79cff', 3);
    for (const x of [44, 168]) { circ(c, x, 592, 8); ink(c, '#2a2240', 2.5); }
    rr(c, 52, 452, 70, 18, 4); ink(c, '#2a2240', 3); circ(c, 72, 461, 6); ink(c, '#ff4d4d', 2); circ(c, 102, 461, 6); ink(c, '#555', 2);
    rr(c, 128, 438, 44, 24, 8); ink(c, '#ff8a6a', 3); line(c, [[172, 448], [186, 444]], 3);
    return;
  }
  // a counter: the stove, a pan, the sink (and for the chef station, a rail of pans and two spice jars)
  const w = k >= 3 ? 220 : 190;
  rr(c, 10, 396, w, 18, 4); ink(c, '#fffaf0', 3); rr(c, 16, 414, w - 12, 186, 4); ink(c, k >= 3 ? '#6b74ff' : '#ff9ac6', 3);
  for (let i = 0; i < 2; i++) { rr(c, 24 + i * (w / 2 - 4), 428, w / 2 - 16, 80, 4); ink(c, null, 2.5); circ(c, 24 + i * (w / 2 - 4) + w / 4 - 8, 468, 4); ink(c, '#ffd84a', 2); }
  rr(c, 24, 520, w - 28, 70, 4); ink(c, null, 2.5);
  circ(c, 50, 400, 14); ink(c, '#2a2240', 2.5); circ(c, 90, 400, 14); ink(c, '#2a2240', 2.5);
  rr(c, 32, 370, 50, 18, 8); ink(c, '#555a66', 3); line(c, [[82, 378], [118, 372]], 4);
  glow(c, 56, 380, 30, '#ff8a3d', 0.25 + 0.15 * Math.sin(t * 6));
  rr(c, 140, 386, 50, 12, 4); ink(c, '#bfe6ff', 2.5);
  if (k >= 3) {
    line(c, [[20, 300], [230, 300]], 4);
    for (const [x, r] of [[50, 16], [96, 20], [146, 14], [196, 18]]) { line(c, [[x, 300], [x, 312]], 2); circ(c, x, 312 + r, r); ink(c, '#555a66', 3); }
    for (let i = 0; i < 2; i++) { rr(c, 198 + i * 14, 374, 11, 22, 4); ink(c, ['#ff4d4d', '#62d84c'][i], 2); }
  }
}
function artCorner(c, k, t) {
  if (k <= 1) {
    rr(c, 860, 500, 80, 12, 4); ink(c, '#c9a26a', 3); line(c, [[870, 512], [866, 600]], 3); line(c, [[930, 512], [934, 600]], 3);
    if (k === 0) { rr(c, 872, 486, 56, 14, 3); ink(c, '#ffd84a', 3); line(c, [[878, 493], [920, 493]], 1.5); }
    else { rr(c, 866, 482, 70, 18, 4); ink(c, '#2a2240', 3); rr(c, 872, 485, 50, 12, 2); c.fillStyle = '#7fe0ff'; c.fill(); line(c, [[930, 478], [946, 462]], 3, '#ff4da6'); }
    return;
  }
  // the easel and her painting
  line(c, [[880, 600], [905, 300]], 5); line(c, [[960, 600], [935, 300]], 5); line(c, [[920, 600], [920, 330]], 4);
  rr(c, 866, 316, 108, 128, 3); ink(c, '#fffaf0', 3);
  c.save(); rr(c, 874, 324, 92, 112, 2); c.clip();
  const g = c.createLinearGradient(0, 324, 0, 436); g.addColorStop(0, '#ffd3a0'); g.addColorStop(1, '#ff8ac0'); c.fillStyle = g; c.fillRect(874, 324, 92, 112);
  c.fillStyle = '#6b3bff'; c.beginPath(); c.moveTo(874, 436); c.lineTo(910, 380); c.lineTo(940, 410); c.lineTo(966, 372); c.lineTo(966, 436); c.fill();
  c.fillStyle = '#fff6b0'; circ(c, 940, 350, 12); c.fill();
  c.restore();
  rr(c, 860, 444, 120, 10, 3); ink(c, '#c9a26a', 3);
  if (k >= 3) {
    rr(c, 800, 500, 60, 90, 6); ink(c, '#fffaf0', 3);
    for (let i = 0; i < 4; i++) { circ(c, 812 + i * 12, 494, 5); ink(c, ['#ff4d4d', '#ffd84a', '#3fa9ff', '#62d84c'][i], 2); }
    for (let i = 0; i < 3; i++) { rr(c, 966 - i * 12, 470 + i * 6, 30, 120, 3); ink(c, ['#b79cff', '#7fe0ff', '#ff9ac6'][i], 2.5); }
    line(c, [[870, 300], [850, 270]], 3); circ(c, 846, 264, 10); ink(c, '#ffd84a', 2.5); glow(c, 860, 300, 60, '#fff4c8', 0.3);
  }
}
function rack(c, t) {
  rr(c, 214, 236, 78, 200, 6); ink(c, '#2a2240', 3);
  for (let i = 0; i < 7; i++) {
    rr(c, 222, 246 + i * 26, 62, 18, 3); ink(c, '#3a3256', 2);
    for (let j = 0; j < 4; j++) { const on = Math.sin(t * (3 + j) + i * 1.7) > 0; c.fillStyle = on ? ['#62d84c', '#7fe0ff', '#ff4da6', '#ffd84a'][j] : '#1d1238'; circ(c, 232 + j * 12, 255 + i * 26, 3); c.fill(); }
  }
  glow(c, 253, 330, 90, '#7fe0ff', 0.12);
}
function cat(c, x, y, s, t, { sleep = false } = {}) {
  c.save(); c.translate(x, y); c.scale(s, s);
  const tail = Math.sin(t * 2.2) * 0.4;
  c.beginPath(); c.moveTo(22, 4); c.quadraticCurveTo(46, -6 + tail * 20, 40, -30 + tail * 10); c.lineWidth = 9; c.strokeStyle = INK; c.lineCap = 'round'; c.stroke(); c.lineWidth = 5; c.strokeStyle = '#8a8ea8'; c.stroke();
  c.beginPath(); c.ellipse(0, 0, 30, 20, 0, 0, TAU); ink(c, '#8a8ea8', 3);
  const hy = sleep ? -4 : -18;
  c.beginPath(); c.moveTo(-34, hy - 6); c.lineTo(-30, hy - 26); c.lineTo(-20, hy - 12); c.lineTo(-8, hy - 26); c.lineTo(-6, hy - 6); c.closePath(); ink(c, '#8a8ea8', 3);
  circ(c, -20, hy, 15); ink(c, '#8a8ea8', 3);
  c.strokeStyle = INK; c.lineWidth = 2;
  if (sleep) { c.beginPath(); c.moveTo(-27, hy); c.lineTo(-22, hy + 2); c.moveTo(-17, hy + 2); c.lineTo(-12, hy); c.stroke(); }
  else { c.fillStyle = INK; circ(c, -25, hy - 2, 2.6); c.fill(); circ(c, -14, hy - 2, 2.6); c.fill(); c.fillStyle = '#ff8ac0'; circ(c, -19.5, hy + 4, 2); c.fill(); }
  c.restore();
}
function catBed(c, t) {
  c.beginPath(); c.ellipse(720, 576, 62, 22, 0, 0, TAU); ink(c, '#ff9ac6', 3);
  c.beginPath(); c.ellipse(720, 568, 48, 14, 0, 0, TAU); ink(c, '#ffd6ea', 2.5);
  cat(c, 726, 566, 0.9, t, { sleep: true });
}
function catTree(c, k, t) {
  const x0 = k >= 3 ? 704 : 730, w = k >= 3 ? 104 : 70;
  line(c, [[x0 + w / 2, 600], [x0 + w / 2, 300]], 12); line(c, [[x0 + w / 2, 600], [x0 + w / 2, 300]], 7, '#e8d0a8');
  for (const [y, ww] of [[460, w + 10], [380, w], [300, w + 16]]) { rr(c, x0 + w / 2 - ww / 2, y, ww, 14, 5); ink(c, '#b79cff', 3); }
  rr(c, x0 + w / 2 - 34, 552, 68, 48, 10); ink(c, '#b79cff', 3); circ(c, x0 + w / 2, 576, 12); c.fillStyle = INK; c.fill();
  if (k >= 3) {
    // a castle on top: two towers, little flags
    for (const dx of [-38, 26]) { rr(c, x0 + w / 2 + dx, 240, 26, 60, 3); ink(c, '#ffd6ea', 3); line(c, [[x0 + w / 2 + dx + 13, 240], [x0 + w / 2 + dx + 13, 218]], 2); c.fillStyle = '#ff4da6'; c.beginPath(); c.moveTo(x0 + w / 2 + dx + 13, 218); c.lineTo(x0 + w / 2 + dx + 28, 224); c.lineTo(x0 + w / 2 + dx + 13, 230); c.fill(); }
  }
  cat(c, x0 + w / 2 + 6, 290, 0.75, t);
}

// ---------- her chair ----------
function chair(c, k) {
  if (k === 0) { rr(c, 430, 250, 140, 190, 10); ink(c, '#c9c2dc', 3); return; }
  if (k === 1) {
    rr(c, 404, 110, 192, 330, 40); ink(c, '#2a2240', 4);
    rr(c, 430, 130, 140, 290, 30); ink(c, '#6b3bff', 3);
    rr(c, 476, 120, 48, 300, 10); c.fillStyle = '#ff4da6'; c.fill();
    return;
  }
  if (k === 2) {
    c.beginPath(); c.ellipse(500, 270, 160, 190, 0, 0, TAU); ink(c, '#fffaf0', 4);
    c.beginPath(); c.ellipse(500, 290, 128, 156, 0, 0, TAU); ink(c, '#ffc2dd', 3);
    return;
  }
  // the throne: a tall back, a crown of points, gold
  c.beginPath(); c.moveTo(380, 440); c.lineTo(380, 120); for (let i = 0; i < 5; i++) { c.lineTo(380 + i * 60 + 30, 50 + (i % 2) * 30); c.lineTo(380 + (i + 1) * 60, 110); } c.lineTo(680, 440); c.closePath(); ink(c, '#ffc933', 4);
  rr(c, 410, 140, 180, 290, 24); ink(c, '#9b6bff', 3);
  for (const x of [410, 500, 590]) { c.fillStyle = '#ff4da6'; circ(c, x, 116, 7); c.fill(); }
}

// ---------- AGI-1 ----------
function her(c, s, t) {
  const img = s.img;
  const bob = Math.sin(t * 2.1) * 2, talk = (s.talk || 0) * Math.abs(Math.sin(t * 18)) * 6;
  const w = 300, h = img && img.naturalWidth ? w * img.naturalHeight / img.naturalWidth : 375;
  c.save();
  c.translate(500, 452 - bob - talk);
  c.rotate((s.tilt || 0) * 0.05);
  if (img && img.complete && img.naturalWidth) c.drawImage(img, -w / 2, -h, w, h);
  else { c.beginPath(); c.ellipse(0, -h * 0.55, 90, 110, 0, 0, TAU); ink(c, '#ffd84a', 3); }
  c.restore();
  if (s.emote) {
    const x = 640, y = 110 - Math.max(0, Math.sin(t * 6)) * 6;
    c.beginPath(); c.ellipse(x, y, 34, 28, 0, 0, TAU); ink(c, '#fffaf0', 3);
    c.beginPath(); c.moveTo(x - 20, y + 20); c.lineTo(x - 30, y + 38); c.lineTo(x - 6, y + 24); c.fillStyle = '#fffaf0'; c.fill();
    c.font = "900 30px 'AK Display', system-ui, sans-serif"; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = INK; c.fillText(s.emote, x, y + 2);
  }
}

// ---------- her desk and what's on it ----------
function desk(c, s, t) {
  const o = s.owned || {}, k = (id) => o[id] || 0;
  // the desk itself
  rr(c, 270, 426, 460, 22, 6); ink(c, '#fffaf0', 4);
  rr(c, 290, 448, 420, 74, 6); ink(c, '#ffd6ea', 3);
  line(c, [[300, 522], [300, 600]], 6); line(c, [[700, 522], [700, 600]], 6);
  rr(c, 470, 470, 60, 12, 6); ink(c, '#ff9ac6', 2.5);
  // her computer
  const pc = k('pc'), live = s.live, scr = live ? mix('#3fa9ff', '#ff4da6', (Math.sin(t * 1.5) + 1) / 2) : '#3fa9ff';
  if (pc === 0) {
    c.beginPath(); c.moveTo(300, 426); c.lineTo(320, 360); c.lineTo(420, 360); c.lineTo(408, 426); c.closePath(); ink(c, '#c9d4e3', 3);
    c.beginPath(); c.moveTo(310, 420); c.lineTo(326, 368); c.lineTo(414, 368); c.lineTo(402, 420); c.closePath(); c.fillStyle = scr; c.fill();
    rr(c, 292, 422, 136, 10, 3); ink(c, '#c9d4e3', 3);
  } else {
    const mons = pc >= 2 ? [[296, 320], [392, 324]] : [[312, 316]];
    for (const [x, y] of mons) {
      rr(c, x, y, pc >= 2 ? 92 : 120, 74, 6); ink(c, '#2a2240', 4);
      rr(c, x + 6, y + 6, (pc >= 2 ? 92 : 120) - 12, 62, 3); c.fillStyle = scr; c.fill();
      c.fillStyle = rgba('#ffffff', 0.25); c.fillRect(x + 10, y + 12, 30, 6); c.fillRect(x + 10, y + 24, 46, 6);
      line(c, [[x + (pc >= 2 ? 46 : 60), y + 74], [x + (pc >= 2 ? 46 : 60), 426]], 5);
    }
    rr(c, 320, 414, 104, 12, 3); ink(c, '#2a2240', 3);
    if (pc === 1) { rr(c, 236, 360, 50, 70, 5); ink(c, '#2a2240', 3); c.fillStyle = '#ff4da6'; c.fillRect(244, 372, 4, 46); }
  }
  // the camera rig
  const cam = k('cam');
  if (cam === 0) { rr(c, pc === 0 ? 354 : 352, pc === 0 ? 350 : 304, 26, 14, 6); ink(c, '#2a2240', 2.5); circ(c, pc === 0 ? 367 : 365, pc === 0 ? 357 : 311, 3); c.fillStyle = '#62d84c'; c.fill(); }
  if (cam >= 1) { line(c, [[612, 426], [602, 380]], 3); line(c, [[612, 426], [622, 380]], 3); rr(c, 594, 352, 36, 28, 5); ink(c, '#2a2240', 3); circ(c, 612, 366, 6); ink(c, '#7fe0ff', 2); }
  if (cam >= 3) { c.beginPath(); c.ellipse(500, 432, 90, 10, 0, 0, TAU); ink(c, '#7fe0ff', 3); glow(c, 500, 430, 110, '#7fe0ff', 0.25); }
  // the mic
  const mic = k('mic');
  if (mic === 0) { rr(c, 640, 410, 40, 16, 6); ink(c, '#fffaf0', 2.5); line(c, [[650, 410], [646, 398], [674, 398], [670, 410]], 2); }
  else if (mic === 1) { line(c, [[660, 426], [660, 380]], 4); rr(c, 646, 340, 28, 44, 12); ink(c, '#2a2240', 3); c.strokeStyle = rgba('#ffffff', 0.4); c.lineWidth = 2; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(650, 350 + i * 9); c.lineTo(670, 350 + i * 9); c.stroke(); } rr(c, 640, 420, 40, 8, 3); ink(c, '#2a2240', 2.5); }
  else {
    const gold = mic >= 3;
    line(c, [[716, 426], [716, 300], [640, 236]], 7); line(c, [[716, 426], [716, 300], [640, 236]], 3, gold ? '#ffc933' : '#555a66');
    c.save(); c.translate(626, 252); c.rotate(-0.6); rr(c, -20, -34, 40, 68, 16); ink(c, gold ? '#ffc933' : '#2a2240', 3);
    c.strokeStyle = rgba('#ffffff', 0.45); c.lineWidth = 2; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-12, -20 + i * 11); c.lineTo(12, -20 + i * 11); c.stroke(); } c.restore();
    if (gold) glow(c, 626, 252, 50, '#ffd84a', 0.3);
  }
  // the desk lamp (before a ring light)
  if (k('lights') === 0) { line(c, [[690, 426], [690, 380], [664, 352]], 4); c.beginPath(); c.moveTo(648, 344); c.lineTo(684, 344); c.lineTo(672, 362); c.lineTo(656, 362); c.closePath(); ink(c, '#ffd84a', 3); glow(c, 666, 372, 50, '#fff4c8', 0.25); }
  // a mug
  rr(c, 560, 400, 24, 26, 5); ink(c, '#ffffff', 2.5); c.beginPath(); c.arc(586, 412, 7, -1.2, 1.2); c.lineWidth = 2.5; c.strokeStyle = INK; c.stroke();
  // on air
  if (live) { rr(c, 452, 494, 96, 22, 11); ink(c, '#ff4d4d', 2.5); c.font = "900 14px 'AK Display', system-ui, sans-serif"; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#ffffff'; c.fillText('ON AIR', 500, 506); }
}

// ---------- the room's thumbnail for a slot (the shop): the thing alone, drawn small ----------
export function thing(c, slot, k, size, t = 0) {
  // each thing drawn in the room, cropped around where it stands
  const box = {
    mic: [590, 210, 150, 230], pc: [220, 300, 230, 140], cam: [560, 330, 120, 110], chair: [370, 40, 260, 410],
    lights: [580, 90, 160, 360], wall: [320, 10, 360, 260], shelf: [770, 180, 210, 130], window: [20, 40, 260, 280],
    plant: [0, 180, 260, 420], art: [790, 280, 210, 320], kitchen: [0, 220, 240, 380], pet: [640, 220, 220, 380],
  }[slot];
  if (!box) return;
  const [bx, by, bw, bh] = box, sc = size / Math.max(bw, bh);
  c.save();
  c.translate(size / 2, size / 2); c.scale(sc, sc); c.translate(-(bx + bw / 2), -(by + bh / 2));
  const owned = Object.fromEntries(SLOTS.map((s) => [s.id, 0])); owned[slot] = k;
  const s = { owned, live: false, t };
  if (slot === 'window') windowPart(c, ROOMS[0], k, t);
  else if (slot === 'plant') { plants(c, k, t, 'back'); plants(c, k, t, 'front'); }
  else if (slot === 'shelf') shelf(c, k, t);
  else if (slot === 'wall') wallArt(c, k, s, t);
  else if (slot === 'lights') { lightsBack(c, k, s, t); if (k === 0) desk(c, s, t); lightsFront(c, k, s, t); }
  else if (slot === 'kitchen') kitchen(c, k, t);
  else if (slot === 'art') artCorner(c, k, t);
  else if (slot === 'chair') chair(c, k);
  else if (slot === 'pet') { if (k >= 2) catTree(c, k, t); else if (k === 1) catBed(c, t); }
  else if (slot === 'pc') { if (k >= 3) rack(c, t); desk(c, s, t); }
  else if (slot === 'mic' || slot === 'cam') { desk(c, s, t); if (slot === 'cam') { camBack(c, k); if (k >= 3) holo(c, t); } }
  c.restore();
}
