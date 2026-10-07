// AGI-1's live show (2026-10-07, the owner: "add more outfits and rooms, (real places in real life) like new york, famous
// landmarks around the world. etc. she can also change outfit based on that place … go to moon, mars"): the places she
// travels to on stream, drawn in code on the set's background canvas like her rooms (rooms.js: the same comic look, flat
// colors, ink outlines), each with its landmark as a simple silhouette (never anyone's photo or artwork, no brands or
// logos), a few small things that move (stage.css .amb), and what goes with it: the outfit she changes into there
// (outfits.js), the vehicle that takes her there (vehicles.js), the food she can try (food.js), its weathers (weather.js),
// who she can meet (people.js), and the language people speak there (her greeting: tools/live/lines.js).
// Her picture covers the middle right of the set (her body from about x = 690 to 1150), so each landmark stands on the
// left, with the sky along the top and the ground at the bottom.
import { W, H, INK, rnd, vgrad, rrect, fillStroke, halftone, heart, star, text } from './rooms.js';

// ---------- a small kit for outdoor places ----------
const GROUND = 600;                                  // where the ground meets the sky's far end (the bar starts at 656)
function sky(g, stops, y1 = GROUND) { g.fillStyle = vgrad(g, stops, 0, y1); g.fillRect(0, 0, W, H); }
function sun(g, x, y, r, color = '#fff1b0', glow = 'rgba(255,241,176,0.28)') {
  g.fillStyle = glow; g.beginPath(); g.arc(x, y, r * 1.6, 0, 7); g.fill();
  g.fillStyle = color; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
}
function cloud(g, x, y, s = 1, color = 'rgba(255,255,255,0.88)') {
  g.fillStyle = color;
  g.beginPath(); g.ellipse(x, y, 70 * s, 22 * s, 0, 0, 7); g.ellipse(x - 34 * s, y - 6 * s, 34 * s, 22 * s, 0, 0, 7);
  g.ellipse(x + 10 * s, y - 20 * s, 40 * s, 28 * s, 0, 0, 7); g.ellipse(x + 46 * s, y - 4 * s, 30 * s, 18 * s, 0, 0, 7); g.fill();
}
function stars(g, n, seed, y1 = 360, a = 0.8) {
  const r = rnd(seed);
  for (let i = 0; i < n; i++) { g.fillStyle = `rgba(255,255,255,${(0.3 + r() * 0.7) * a})`; const s = r() < 0.15 ? 3 : 2; g.fillRect(r() * W, r() * y1, s, s); }
}
function hills(g, y, amp, color, seed, line = 4) {
  const r = rnd(seed);
  g.beginPath(); g.moveTo(0, H);
  g.lineTo(0, y);
  for (let x = 0; x <= W + 80; x += 80) g.quadraticCurveTo(x + 40, y - amp * (0.4 + r() * 0.8), x + 80, y + (r() - 0.5) * amp * 0.3);
  g.lineTo(W, H); g.closePath();
  fillStroke(g, color, line);
}
function water(g, y0, y1, top, bottom, seed, shine = 'rgba(255,255,255,0.35)') {
  g.fillStyle = vgrad(g, [[0, top], [1, bottom]], y0, y1); g.fillRect(0, y0, W, y1 - y0);
  const r = rnd(seed);
  g.fillStyle = shine;
  for (let i = 0; i < 26; i++) { const w = 30 + r() * 80; g.fillRect(r() * W, y0 + 8 + r() * (y1 - y0 - 12), w, 3); }
}
function ground(g, y, color, line = 5) {
  g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.lineTo(W, H); g.lineTo(0, H); g.closePath(); fillStroke(g, color, line);
}
function palm(g, x, y, h, lean = -0.12, leaf = '#2fbf7a') {
  const tx = x + h * lean * 2, ty = y - h;
  g.lineCap = 'round'; g.lineWidth = Math.max(8, h * 0.07); g.strokeStyle = '#7a4a28';
  g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + h * lean, y - h * 0.55, tx, ty); g.stroke();
  g.lineWidth = 3; g.strokeStyle = INK; g.stroke(); g.lineCap = 'butt';
  for (const [a, l] of [[-2.8, 1], [-2.2, 0.9], [-1.4, 0.8], [-0.7, 0.95], [-0.1, 0.85], [0.5, 0.7]]) {
    const L = h * 0.55 * l;
    g.beginPath(); g.moveTo(tx, ty);
    g.quadraticCurveTo(tx + Math.cos(a) * L * 0.6, ty + Math.sin(a) * L * 0.6 - 26, tx + Math.cos(a) * L, ty + Math.sin(a) * L + 22);
    g.quadraticCurveTo(tx + Math.cos(a) * L * 0.5, ty + Math.sin(a) * L * 0.5 - 6, tx, ty + 4);
    fillStroke(g, leaf, 3);
  }
}
function roundTree(g, x, y, r, color = '#3fae5a', trunk = '#6b4226') {
  g.fillStyle = trunk; g.fillRect(x - r * 0.12, y - r * 0.9, r * 0.24, r * 0.9);
  g.beginPath(); g.arc(x, y - r * 1.3, r, 0, 7); g.arc(x - r * 0.6, y - r * 1.0, r * 0.65, 0, 7); g.arc(x + r * 0.6, y - r * 1.05, r * 0.7, 0, 7);
  fillStroke(g, color, 3);
}
function cypress(g, x, y, h, color = '#2c6b3f') {
  g.beginPath(); g.moveTo(x, y - h); g.bezierCurveTo(x + h * 0.16, y - h * 0.6, x + h * 0.14, y - h * 0.15, x, y);
  g.bezierCurveTo(x - h * 0.14, y - h * 0.15, x - h * 0.16, y - h * 0.6, x, y - h); fillStroke(g, color, 3);
}
function birds(g, list, color = INK) {
  g.strokeStyle = color; g.lineWidth = 3; g.lineCap = 'round';
  for (const [x, y, s] of list) { g.beginPath(); g.moveTo(x - 12 * s, y); g.quadraticCurveTo(x - 5 * s, y - 8 * s, x, y); g.quadraticCurveTo(x + 5 * s, y - 8 * s, x + 12 * s, y); g.stroke(); }
  g.lineCap = 'butt';
}
// a row of plain buildings (silhouettes, lit windows or not)
function blocks(g, x0, x1, base, seed, { min = 60, max = 220, body = '#3a2d70', lit = null, litShare = 0.3, line = 0 } = {}) {
  const r = rnd(seed);
  for (let x = x0; x < x1;) {
    const w = 34 + r() * 56, h = min + r() * (max - min);
    g.beginPath(); g.rect(x, base - h, w, h); fillStroke(g, body, line);
    if (lit) { g.fillStyle = lit; for (let wy = base - h + 10; wy < base - 8; wy += 15) for (let wx = x + 6; wx < x + w - 8; wx += 12) if (r() < litShare) g.fillRect(wx, wy, 5, 7); }
    x += w + 2;
  }
}
// ---------- the places ----------
// name: what she calls it on stream · country · lang: one of her 16 languages people speak there (or null) · hello: her
// greeting in the language people speak there, and what it means (tools/live/lines.js) · outfit, vehicle, foods, weather
// (the ones that fit it), person (who she can meet) · draw(g) · ambient: its moving bits
export const PLACES = {
  newyork: {
    name: 'New York', country: 'USA', lang: 'en', accent: '#ffc933', outfit: 'newyork', vehicle: 'taxi', foods: ['pizza', 'hotdog', 'pretzel'],
    weather: ['sunny', 'rain', 'snow', 'leaves'], person: 'rosa',
    draw(g) {
      sky(g, [[0, '#7ec8ff'], [0.6, '#cfe9ff'], [1, '#ffe7c4']]);
      cloud(g, 520, 120, 1.1); cloud(g, 900, 80, 0.8);
      // the skyline across the water
      blocks(g, 260, W, 470, 41, { min: 90, max: 290, body: '#6b7ea8' });
      // a tall tower with a spire (an art deco silhouette, no particular building)
      g.beginPath(); g.moveTo(560, 470); g.lineTo(560, 230); g.lineTo(574, 206); g.lineTo(574, 170); g.lineTo(582, 150); g.lineTo(590, 170); g.lineTo(590, 206); g.lineTo(604, 230); g.lineTo(604, 470); g.closePath();
      fillStroke(g, '#5a6c95', 0);
      g.fillStyle = '#5a6c95'; g.fillRect(580, 96, 4, 60);
      water(g, 470, GROUND, '#4f86c9', '#2f5d9a', 7);
      // the statue on her island: a pedestal, her robe, her torch up, her crown's rays (a copper-green silhouette)
      const x = 210, base = 600;
      g.beginPath(); g.moveTo(x - 90, base); g.lineTo(x - 70, base - 110); g.lineTo(x + 70, base - 110); g.lineTo(x + 90, base); g.closePath(); fillStroke(g, '#c9b48a', 4);
      g.beginPath(); g.rect(x - 46, base - 190, 92, 80); fillStroke(g, '#bfa877', 4);
      const c = '#6fbf9f';
      g.beginPath(); g.moveTo(x - 40, base - 190); g.quadraticCurveTo(x - 46, base - 300, x - 18, base - 360); g.lineTo(x + 26, base - 360);
      g.quadraticCurveTo(x + 46, base - 300, x + 40, base - 190); g.closePath(); fillStroke(g, c, 4);
      g.beginPath(); g.arc(x + 4, base - 384, 26, 0, 7); fillStroke(g, c, 4);
      for (let i = -3; i <= 3; i++) { const a = -Math.PI / 2 + i * 0.32; g.beginPath(); g.moveTo(x + 4 + Math.cos(a) * 22, base - 384 + Math.sin(a) * 22); g.lineTo(x + 4 + Math.cos(a) * 52, base - 384 + Math.sin(a) * 52); g.lineWidth = 7; g.strokeStyle = c; g.stroke(); }
      // her raised arm and torch
      g.lineCap = 'round'; g.lineWidth = 18; g.strokeStyle = INK; g.beginPath(); g.moveTo(x + 26, base - 340); g.lineTo(x + 58, base - 450); g.stroke();
      g.lineWidth = 12; g.strokeStyle = c; g.stroke(); g.lineCap = 'butt';
      g.beginPath(); g.moveTo(x + 46, base - 456); g.lineTo(x + 72, base - 456); g.lineTo(x + 66, base - 476); g.lineTo(x + 52, base - 476); g.closePath(); fillStroke(g, c, 4);
      g.beginPath(); g.moveTo(x + 59, base - 524); g.quadraticCurveTo(x + 78, base - 494, x + 59, base - 478); g.quadraticCurveTo(x + 42, base - 494, x + 59, base - 524); fillStroke(g, '#ffc933', 3);
      // her tablet in the other arm
      g.beginPath(); g.rect(x - 52, base - 300, 22, 50); fillStroke(g, c, 3);
      // the street at the bottom: a sidewalk and the curb
      ground(g, GROUND, '#c4c9d6');
      g.fillStyle = '#9aa0b3'; for (let k = 0; k < W; k += 96) g.fillRect(k, GROUND + 4, 4, 52);
    },
    ambient: [{ cls: 'cloud-drift', x: 300, y: 70, delay: 0 }, { cls: 'cloud-drift', x: 760, y: 140, delay: 7 }, { cls: 'torch-glow', x: 269, y: 98 }],
  },

  london: {
    name: 'London', country: 'UK', lang: 'en', accent: '#ff4d4d', outfit: 'london', vehicle: 'bus', foods: ['fishchips', 'cookie'],
    weather: ['rain', 'fog', 'rain', 'leaves'], person: 'oliver',
    draw(g) {
      sky(g, [[0, '#9aa7c7'], [0.7, '#c9cfe0'], [1, '#e2e4ee']]);
      cloud(g, 160, 90, 1.3, 'rgba(240,242,250,0.9)'); cloud(g, 640, 130, 1.1, 'rgba(240,242,250,0.85)'); cloud(g, 1040, 70, 1.2, 'rgba(240,242,250,0.85)');
      // a big wheel on the river in the distance (no particular one)
      g.lineWidth = 5; g.strokeStyle = '#7b86a8';
      g.beginPath(); g.arc(560, 330, 150, 0, 7); g.stroke();
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; g.beginPath(); g.moveTo(560, 330); g.lineTo(560 + Math.cos(a) * 150, 330 + Math.sin(a) * 150); g.lineWidth = 2; g.stroke();
        g.fillStyle = '#7b86a8'; g.beginPath(); g.ellipse(560 + Math.cos(a) * 150, 330 + Math.sin(a) * 150, 9, 7, 0, 0, 7); g.fill(); }
      g.lineWidth = 6; g.beginPath(); g.moveTo(510, 480); g.lineTo(560, 330); g.lineTo(610, 480); g.stroke();
      blocks(g, 340, W, 480, 52, { min: 50, max: 140, body: '#8790b0' });
      // the clock tower: its tall body, the clock, its spire
      const x = 200;
      g.beginPath(); g.rect(x - 52, 230, 104, 300); fillStroke(g, '#c9a96b', 4);
      g.fillStyle = 'rgba(23,10,54,0.18)'; for (let k = 250; k < 520; k += 26) g.fillRect(x - 52, k, 104, 3);
      g.beginPath(); g.rect(x - 62, 150, 124, 92); fillStroke(g, '#d8bb7c', 4);
      g.beginPath(); g.arc(x, 196, 38, 0, 7); fillStroke(g, '#fff8e1', 4);
      g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.moveTo(x, 196); g.lineTo(x, 170); g.moveTo(x, 196); g.lineTo(x + 18, 202); g.stroke();
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.fillStyle = INK; g.fillRect(x + Math.cos(a) * 31 - 1.5, 196 + Math.sin(a) * 31 - 1.5, 3, 3); }
      g.beginPath(); g.moveTo(x - 62, 150); g.lineTo(x, 40); g.lineTo(x + 62, 150); g.closePath(); fillStroke(g, '#3b4566', 4);
      g.fillStyle = '#ffc933'; g.beginPath(); g.arc(x, 44, 6, 0, 7); g.fill();
      // the river and its wall
      water(g, 520, GROUND, '#6c7fa8', '#4b5b85', 9, 'rgba(255,255,255,0.25)');
      ground(g, GROUND, '#b9aa8e');
      g.fillStyle = 'rgba(23,10,54,0.15)'; for (let k = 0; k < W; k += 60) g.fillRect(k, GROUND + 3, 30, 10);
    },
    ambient: [{ cls: 'cloud-drift', x: 200, y: 110, delay: 2 }, { cls: 'cloud-drift', x: 900, y: 60, delay: 9 }],
  },

  paris: {
    name: 'Paris', country: 'France', lang: 'fr', accent: '#ff9cc0', outfit: 'paris', vehicle: 'balloon', foods: ['croissant', 'macaron'],
    weather: ['sunny', 'leaves', 'rain', 'petals'], person: 'mathis',
    draw(g) {
      sky(g, [[0, '#ffb3cf'], [0.55, '#ffd9b8'], [1, '#fff0d9']]);
      sun(g, 470, 300, 60, '#fff3d1', 'rgba(255,243,209,0.35)');
      cloud(g, 760, 110, 0.9, 'rgba(255,255,255,0.8)');
      // the iron tower: four legs, an arch, two platforms, the top (its lattice drawn as crossing lines)
      const x = 250, base = 600, top = 70;
      const col = '#5b4a6b';
      g.lineJoin = 'round';
      const leg = (side) => {
        g.beginPath(); g.moveTo(x + side * 150, base); g.quadraticCurveTo(x + side * 70, base - 200, x + side * 22, top + 160); g.lineTo(x + side * 12, top + 160);
        g.quadraticCurveTo(x + side * 45, base - 200, x + side * 96, base); g.closePath(); fillStroke(g, col, 3);
      };
      leg(-1); leg(1);
      g.beginPath(); g.moveTo(x - 96, base); g.quadraticCurveTo(x, base - 120, x + 96, base); g.lineTo(x + 70, base); g.quadraticCurveTo(x, base - 90, x - 70, base); g.closePath(); g.fillStyle = '#fff0d9'; g.fill();
      g.beginPath(); g.moveTo(x - 22, top + 160); g.lineTo(x - 6, top + 20); g.lineTo(x + 6, top + 20); g.lineTo(x + 22, top + 160); g.closePath(); fillStroke(g, col, 3);
      g.beginPath(); g.rect(x - 4, top - 10, 8, 32); fillStroke(g, col, 2);
      for (const [y, w] of [[base - 210, 130], [top + 160, 46]]) { g.beginPath(); g.rect(x - w / 2, y - 10, w, 14); fillStroke(g, col, 3); }
      g.strokeStyle = 'rgba(255,240,217,0.5)'; g.lineWidth = 1.5;
      for (let y = top + 40; y < base - 20; y += 22) { const w = 10 + (y - top) * 0.32; g.beginPath(); g.moveTo(x - w, y); g.lineTo(x + w, y + 22); g.moveTo(x + w, y); g.lineTo(x - w, y + 22); g.stroke(); }
      // the city's grey roofs with chimneys
      const r = rnd(61);
      for (let k = 380; k < W; k += 110) {
        const h = 120 + r() * 60;
        g.beginPath(); g.rect(k, GROUND - h, 104, h); fillStroke(g, '#f2e6d6', 3);
        g.beginPath(); g.moveTo(k - 6, GROUND - h); g.lineTo(k + 18, GROUND - h - 40); g.lineTo(k + 86, GROUND - h - 40); g.lineTo(k + 110, GROUND - h); g.closePath(); fillStroke(g, '#6f7aa3', 3);
        g.fillStyle = '#6f7aa3'; g.fillRect(k + 30, GROUND - h - 58, 12, 20); g.fillRect(k + 66, GROUND - h - 54, 10, 16);
        g.fillStyle = '#9fd3ff'; for (let wx = k + 14; wx < k + 96; wx += 30) for (let wy = GROUND - h + 18; wy < GROUND - 20; wy += 38) g.fillRect(wx, wy, 14, 22);
      }
      ground(g, GROUND, '#d9c3a5');
      g.fillStyle = 'rgba(23,10,54,0.12)'; for (let k = 0; k < W; k += 40) g.fillRect(k, GROUND + 4, 20, 6);
    },
    ambient: [{ cls: 'cloud-drift', x: 640, y: 90, delay: 3 }, ...[[90, 210], [140, 170]].map(([x, y], i) => ({ cls: 'bird-flap', x, y, delay: i * 0.4 }))],
  },

  rome: {
    name: 'Rome', country: 'Italy', lang: null, local: 'Italian', accent: '#ffb23f', outfit: 'rome', vehicle: 'scooter', foods: ['gelato', 'pizza'],
    weather: ['sunny', 'sunny', 'rain'], person: 'giulia',
    draw(g) {
      sky(g, [[0, '#5fb8ff'], [0.7, '#bfe4ff'], [1, '#fff3d6']]);
      sun(g, 1100, 90, 48);
      cloud(g, 420, 100, 0.9);
      // the arena: an ellipse of three stories of arches, one side taller and broken (a simple silhouette)
      const x0 = 60, x1 = 640, base = 590;
      const col = '#e8c48f';
      g.beginPath(); g.moveTo(x0, base); g.lineTo(x0, 330); g.quadraticCurveTo((x0 + x1) / 2, 300, x1 - 120, 300); g.lineTo(x1 - 120, 250); g.lineTo(x1 - 40, 260);
      g.lineTo(x1, 330); g.lineTo(x1, base); g.closePath(); fillStroke(g, col, 4);
      for (let row = 0; row < 3; row++) {
        const y = 350 + row * 78;
        g.fillStyle = 'rgba(23,10,54,0.25)'; g.fillRect(x0, y - 18, x1 - x0, 5);
        for (let ax = x0 + 18; ax < x1 - 30; ax += 46) {
          const top = row === 0 && ax > x1 - 160 ? 280 : 0;
          g.fillStyle = '#7a5130';
          g.beginPath(); g.moveTo(ax, y + 50); g.lineTo(ax, y + 16 - top * 0); g.arc(ax + 15, y + 16, 15, Math.PI, 0); g.lineTo(ax + 30, y + 50); g.closePath(); g.fill();
        }
      }
      // cypress trees and pines
      cypress(g, 700, 600, 220); cypress(g, 740, 600, 170);
      g.beginPath(); g.ellipse(1210, 330, 80, 34, 0, 0, 7); fillStroke(g, '#3c7d4b', 3); g.fillStyle = '#6b4226'; g.fillRect(1204, 362, 12, 240);
      ground(g, GROUND, '#d8b98a');
      // cobblestones
      const r = rnd(71);
      g.strokeStyle = 'rgba(23,10,54,0.25)'; g.lineWidth = 2;
      for (let y = GROUND + 10; y < H; y += 16) for (let x = (y / 16) % 2 ? 0 : 14; x < W; x += 28) { g.beginPath(); g.ellipse(x + r() * 4, y, 11, 6, 0, 0, 7); g.stroke(); }
    },
    ambient: [{ cls: 'cloud-drift', x: 300, y: 110, delay: 4 }, { cls: 'heat-shimmer', x: 0, y: 560 }],
  },

  berlin: {
    name: 'Berlin', country: 'Germany', lang: 'de', accent: '#ffc933', outfit: 'berlin', vehicle: 'train', foods: ['berliner', 'pretzel'],
    weather: ['leaves', 'rain', 'snow', 'fog'], person: 'lukas',
    draw(g) {
      sky(g, [[0, '#8fb3e8'], [0.7, '#d4e2f5'], [1, '#f2e9d8']]);
      cloud(g, 700, 90, 1.2); cloud(g, 1080, 160, 0.9);
      // the TV tower far behind: a needle and its sphere
      g.fillStyle = '#9aa5c0'; g.fillRect(546, 120, 16, 360); g.fillRect(552, 40, 4, 90);
      g.beginPath(); g.arc(554, 170, 34, 0, 7); fillStroke(g, '#b4bdd3', 3);
      g.fillStyle = 'rgba(23,10,54,0.25)'; g.fillRect(522, 168, 64, 6);
      blocks(g, 400, W, 500, 81, { min: 60, max: 150, body: '#a3aabd' });
      // the gate: six columns, its top beam and the chariot on top (a simple silhouette)
      const x = 240, base = 590, col = '#efe2c4';
      g.beginPath(); g.rect(x - 200, 330, 400, 46); fillStroke(g, col, 4);
      g.beginPath(); g.rect(x - 214, 312, 428, 24); fillStroke(g, col, 4);
      for (let i = 0; i < 6; i++) { const cx = x - 180 + i * 72; g.beginPath(); g.rect(cx - 13, 376, 26, base - 376); fillStroke(g, col, 3); }
      g.beginPath(); g.rect(x - 70, 276, 140, 36); fillStroke(g, col, 4);
      // the chariot: a wheel, four horses' backs, the figure with her staff (as plain shapes)
      g.fillStyle = '#5f7f6e';
      for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(x - 48 + i * 28, 262, 16, 12, 0, 0, 7); g.fill(); g.fillRect(x - 54 + i * 28, 236, 6, 18); }
      g.fillRect(x + 4, 214, 12, 50); g.fillRect(x + 14, 196, 4, 30);
      ground(g, GROUND, '#cfc4b0');
      // autumn trees on both sides
      roundTree(g, 1180, 600, 60, '#e98a3a'); roundTree(g, 1260, 610, 46, '#d65a3a');
    },
    ambient: [{ cls: 'cloud-drift', x: 520, y: 70, delay: 1 }],
  },

  istanbul: {
    name: 'Istanbul', country: 'Türkiye', lang: 'tr', accent: '#3ff0c3', outfit: 'istanbul', vehicle: 'boat', foods: ['simit', 'baklava'],
    weather: ['sunny', 'rain', 'snow'], person: 'emre',
    draw(g) {
      sky(g, [[0, '#ff9e7a'], [0.5, '#ffc7a0'], [1, '#ffe7cf']]);
      sun(g, 560, 360, 64, '#fff0c0', 'rgba(255,240,192,0.35)');
      // the skyline across the water: domes and slender minarets (no particular building)
      const col = '#5a4470';
      const dome = (x, y, r) => { g.beginPath(); g.moveTo(x - r, y); g.arc(x, y, r, Math.PI, 0); g.closePath(); g.fillStyle = col; g.fill(); g.fillRect(x - 2, y - r - 22, 4, 22); };
      const minaret = (x, y, h) => { g.fillStyle = col; g.fillRect(x - 6, y - h, 12, h); g.beginPath(); g.moveTo(x - 7, y - h); g.lineTo(x, y - h - 40); g.lineTo(x + 7, y - h); g.closePath(); g.fill(); g.fillRect(x - 10, y - h * 0.62, 20, 6); };
      g.fillStyle = col; g.fillRect(60, 420, 540, 70);
      dome(330, 420, 92); dome(200, 430, 54); dome(460, 430, 54); dome(110, 440, 34); dome(560, 440, 34);
      minaret(70, 490, 230); minaret(600, 490, 230); minaret(150, 490, 200); minaret(520, 490, 200);
      blocks(g, 640, W, 490, 91, { min: 30, max: 90, body: '#6a5683' });
      water(g, 490, GROUND, '#3f7fb8', '#2b5a8f', 11, 'rgba(255,240,192,0.45)');
      ground(g, GROUND, '#c9a882');
      g.fillStyle = '#7a5130'; for (let k = 0; k < W; k += 70) g.fillRect(k, GROUND, 8, 56);
    },
    ambient: [...[0, 1].map((i) => ({ cls: 'gull', x: 420 + i * 90, y: 170 - i * 30, delay: i * 0.8 })), { cls: 'wave-line', x: 300, y: 540, delay: 0.6 }],
  },

  cairo: {
    name: 'the pyramids of Giza', country: 'Egypt', lang: 'ar', accent: '#ffc933', outfit: 'cairo', vehicle: 'plane', foods: ['falafel', 'dates'],
    weather: ['sunny', 'sunny', 'dust'], person: 'omar',
    draw(g) {
      sky(g, [[0, '#4fa8ff'], [0.65, '#a9d8ff'], [1, '#ffe3a8']]);
      sun(g, 1100, 100, 56, '#fff6c8');
      // three pyramids (the near one big), their shaded sides, a few stone lines
      const pyr = (x, base, w, h, lit, dark) => {
        g.beginPath(); g.moveTo(x - w / 2, base); g.lineTo(x, base - h); g.lineTo(x + w / 2, base); g.closePath(); fillStroke(g, lit, 4);
        g.beginPath(); g.moveTo(x, base - h); g.lineTo(x + w / 2, base); g.lineTo(x + w * 0.12, base); g.closePath(); g.fillStyle = dark; g.fill();
        g.strokeStyle = 'rgba(23,10,54,0.18)'; g.lineWidth = 2;
        for (let y = base - h + 22; y < base; y += 22) { const k = (base - y) / h * w / 2; g.beginPath(); g.moveTo(x - k, y); g.lineTo(x + k * 0.24, y); g.stroke(); }
      };
      pyr(560, 500, 260, 160, '#e7c27a', '#c99a52');
      pyr(420, 520, 360, 230, '#ecc985', '#cfa25c');
      pyr(220, 590, 460, 330, '#f2d08e', '#d5a964');
      // the sphinx lying in front, on the right of the big one
      g.beginPath(); g.moveTo(470, 590); g.lineTo(470, 545); g.lineTo(560, 545); g.lineTo(574, 520); g.lineTo(606, 518); g.lineTo(612, 545); g.lineTo(640, 590); g.closePath(); fillStroke(g, '#d9ae6a', 3);
      g.beginPath(); g.moveTo(574, 520); g.lineTo(568, 552); g.lineTo(612, 552); g.lineTo(606, 518); g.closePath(); g.fillStyle = '#c99a52'; g.fill();
      // the desert
      g.beginPath(); g.moveTo(0, 590); g.quadraticCurveTo(300, 570, 640, 588); g.quadraticCurveTo(980, 604, W, 580); g.lineTo(W, H); g.lineTo(0, H); g.closePath(); fillStroke(g, '#f5d79a', 4);
      halftone(g, 0, 600, W, H, 'rgba(176,122,79,0.3)', { step: 18, max: 3, cx: 640, cy: 720, reach: 900 });
      palm(g, 1215, 610, 260, -0.08);
    },
    ambient: [{ cls: 'heat-shimmer', x: 0, y: 540 }, ...[[700, 140], [760, 120]].map(([x, y], i) => ({ cls: 'bird-flap', x, y, delay: i * 0.5 }))],
  },

  dubai: {
    name: 'Dubai', country: 'UAE', lang: 'ar', accent: '#ffc933', outfit: 'dubai', vehicle: 'robotaxi', foods: ['dates', 'icecream'],
    weather: ['sunny', 'sunny', 'dust'], person: 'layla',
    draw(g) {
      sky(g, [[0, '#ff8a5c'], [0.5, '#ffb36b'], [1, '#ffe0a6']]);
      sun(g, 860, 360, 70, '#fff3c4', 'rgba(255,243,196,0.4)');
      // the towers: one very tall needle (no particular building) among others
      const col = '#6b4f8a';
      blocks(g, 60, 700, 470, 101, { min: 80, max: 230, body: '#80679e' });
      g.beginPath(); g.moveTo(330, 470); g.lineTo(330, 210); g.lineTo(346, 170); g.lineTo(346, 110); g.lineTo(356, 80); g.lineTo(356, 30); g.lineTo(362, 0); g.lineTo(368, 30); g.lineTo(368, 80);
      g.lineTo(378, 110); g.lineTo(378, 170); g.lineTo(394, 210); g.lineTo(394, 470); g.closePath(); fillStroke(g, col, 3);
      g.beginPath(); g.moveTo(520, 470); g.lineTo(520, 230); g.quadraticCurveTo(560, 180, 600, 230); g.lineTo(600, 470); g.closePath(); fillStroke(g, '#7a5f9a', 3);
      // the dunes
      g.beginPath(); g.moveTo(0, 520); g.quadraticCurveTo(220, 450, 460, 520); g.quadraticCurveTo(700, 580, 900, 510); g.quadraticCurveTo(1100, 460, W, 520); g.lineTo(W, H); g.lineTo(0, H); g.closePath();
      fillStroke(g, '#f0b56b', 4);
      g.beginPath(); g.moveTo(0, 600); g.quadraticCurveTo(400, 560, 760, 600); g.quadraticCurveTo(1000, 625, W, 590); g.lineTo(W, H); g.lineTo(0, H); g.closePath(); fillStroke(g, '#f6c98a', 4);
      halftone(g, 0, 610, W, H, 'rgba(176,122,79,0.3)', { step: 18, max: 3, cx: 640, cy: 720, reach: 900 });
    },
    ambient: [{ cls: 'heat-shimmer', x: 0, y: 500 }],
  },

  agra: {
    name: 'the Taj Mahal', country: 'India', lang: 'hi', accent: '#ff9cc0', outfit: 'agra', vehicle: 'tuktuk', foods: ['samosa'],
    weather: ['sunny', 'rain', 'fog'], person: 'arjun',
    draw(g) {
      sky(g, [[0, '#ffc2d6'], [0.6, '#ffe2c9'], [1, '#fff4e6']]);
      sun(g, 1120, 120, 46, '#fff6e0');
      const x = 330, base = 470, col = '#fbf6ee', sh = '#e6dccd';
      // the four minarets
      for (const mx of [x - 250, x + 250, x - 200, x + 200]) {
        const near = Math.abs(mx - x) > 220;
        const h = near ? 300 : 270, w = near ? 18 : 14;
        g.beginPath(); g.rect(mx - w / 2, base - h, w, h); fillStroke(g, col, 3);
        g.beginPath(); g.moveTo(mx - w, base - h); g.lineTo(mx, base - h - 30); g.lineTo(mx + w, base - h); g.closePath(); fillStroke(g, col, 3);
        for (const k of [0.33, 0.66]) { g.fillStyle = sh; g.fillRect(mx - w * 0.9, base - h * k, w * 1.8, 6); }
      }
      // the main building: its body, the big arch, the side arches, the great dome and its small domes
      g.beginPath(); g.rect(x - 150, base - 190, 300, 190); fillStroke(g, col, 4);
      g.beginPath(); g.moveTo(x - 50, base); g.lineTo(x - 50, base - 120); g.quadraticCurveTo(x, base - 175, x + 50, base - 120); g.lineTo(x + 50, base); g.closePath(); fillStroke(g, sh, 3);
      for (const s of [-1, 1]) for (const yy of [0, 1]) {
        const ax = x + s * 105, ay = base - 20 - yy * 85;
        g.beginPath(); g.moveTo(ax - 22, ay); g.lineTo(ax - 22, ay - 44); g.quadraticCurveTo(ax, ay - 66, ax + 22, ay - 44); g.lineTo(ax + 22, ay); g.closePath(); fillStroke(g, sh, 2);
      }
      g.beginPath(); g.rect(x - 70, base - 220, 140, 32); fillStroke(g, col, 3);
      g.beginPath(); g.moveTo(x - 82, base - 220); g.bezierCurveTo(x - 110, base - 300, x - 40, base - 350, x, base - 380); g.bezierCurveTo(x + 40, base - 350, x + 110, base - 300, x + 82, base - 220); g.closePath(); fillStroke(g, col, 4);
      g.fillStyle = '#d9b44a'; g.fillRect(x - 3, base - 412, 6, 36);
      for (const s of [-1, 1]) { const dx = x + s * 120; g.beginPath(); g.moveTo(dx - 26, base - 190); g.quadraticCurveTo(dx, base - 250, dx + 26, base - 190); g.closePath(); fillStroke(g, col, 3); }
      // the long pool in front, its reflection, the garden
      g.fillStyle = '#7bc47f'; g.fillRect(0, base, W, GROUND - base);
      g.beginPath(); g.moveTo(x - 60, base); g.lineTo(x + 60, base); g.lineTo(x + 120, GROUND); g.lineTo(x - 120, GROUND); g.closePath(); fillStroke(g, '#9fd3ff', 3);
      g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(x - 10, base + 6, 20, GROUND - base - 12);
      for (const tx of [60, 130, 560, 640, 720]) cypress(g, tx, base + 4, 90, '#3f8f55');
      ground(g, GROUND, '#e8d2b0');
    },
    ambient: [...[[640, 160], [700, 140], [670, 120]].map(([x, y], i) => ({ cls: 'bird-flap', x, y, delay: i * 0.3 }))],
  },

  bangkok: {
    name: 'Bangkok', country: 'Thailand', lang: 'th', accent: '#ffc933', outfit: 'bangkok', vehicle: 'tuktuk', foods: ['mango', 'boba'],
    weather: ['sunny', 'rain', 'storm'], person: 'nok',
    draw(g) {
      sky(g, [[0, '#6ab6ff'], [0.6, '#bfe3ff'], [1, '#ffe9c8']]);
      cloud(g, 820, 110, 1.1); cloud(g, 1120, 70, 0.8);
      // a temple: its tall tower (layered, pointed) and roofs in tiers with curled ends (no particular temple)
      const x = 260, base = 540;
      g.beginPath(); g.moveTo(x - 90, base); g.quadraticCurveTo(x - 70, base - 200, x - 20, base - 330); g.lineTo(x, base - 440); g.lineTo(x + 20, base - 330);
      g.quadraticCurveTo(x + 70, base - 200, x + 90, base); g.closePath(); fillStroke(g, '#f2e3c6', 4);
      g.fillStyle = 'rgba(23,10,54,0.15)'; for (let k = base - 60; k > base - 330; k -= 34) { const w = 20 + (k - (base - 440)) * 0.18; g.fillRect(x - w, k, w * 2, 6); }
      for (const [rx, ry, w] of [[480, 480, 220], [480, 420, 170], [480, 370, 120]]) {
        g.beginPath(); g.moveTo(rx - w / 2 - 20, ry + 40); g.quadraticCurveTo(rx - w / 2, ry + 30, rx - w / 2 + 10, ry + 20); g.lineTo(rx, ry - 30); g.lineTo(rx + w / 2 - 10, ry + 20);
        g.quadraticCurveTo(rx + w / 2, ry + 30, rx + w / 2 + 20, ry + 40); g.closePath(); fillStroke(g, ry === 480 ? '#e4573f' : '#2e8a63', 3);
        g.fillStyle = '#ffc933'; g.fillRect(rx - w / 2 + 6, ry + 34, w - 12, 5);
      }
      g.beginPath(); g.rect(380, 520, 200, 50); fillStroke(g, '#f7e9d0', 3);
      water(g, 570, GROUND + 20, '#6f9c86', '#4c7a66', 13, 'rgba(255,255,255,0.3)');
      ground(g, GROUND + 20, '#c9a37a');
      palm(g, 1225, 600, 240, -0.1);
    },
    ambient: [{ cls: 'cloud-drift', x: 700, y: 80, delay: 5 }, { cls: 'wave-line', x: 200, y: 588, delay: 0 }],
  },

  halong: {
    name: 'Ha Long Bay', country: 'Vietnam', lang: 'vi', accent: '#3ff0c3', outfit: 'halong', vehicle: 'boat', foods: ['banhmi'],
    weather: ['sunny', 'fog', 'rain'], person: 'lan',
    draw(g) {
      sky(g, [[0, '#9fd7e8'], [0.7, '#dff3f5'], [1, '#f4f7ee']]);
      // limestone islands rising from the sea, far ones paler
      const isle = (x, w, h, col) => {
        g.beginPath(); g.moveTo(x - w / 2, 470); g.bezierCurveTo(x - w / 2, 470 - h * 0.7, x - w * 0.35, 470 - h, x - w * 0.05, 470 - h);
        g.bezierCurveTo(x + w * 0.3, 470 - h * 1.02, x + w / 2, 470 - h * 0.6, x + w / 2, 470); g.closePath(); fillStroke(g, col, 3);
        g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x - w * 0.1, 470 - h * 0.8, 6, h * 0.6);
      };
      isle(980, 200, 190, '#b7d6c8'); isle(1180, 160, 150, '#b7d6c8'); isle(820, 140, 120, '#a9cdbd');
      isle(160, 240, 300, '#5f9e7f'); isle(420, 200, 230, '#6fae8c'); isle(600, 150, 150, '#7dba97');
      water(g, 470, GROUND + 20, '#3fb59a', '#2a8f7b', 15, 'rgba(255,255,255,0.35)');
      // a wooden boat with brownish sails (a junk, no particular one)
      const bx = 560, by = 540;
      g.beginPath(); g.moveTo(bx - 90, by); g.lineTo(bx + 100, by); g.lineTo(bx + 80, by + 28); g.lineTo(bx - 70, by + 28); g.closePath(); fillStroke(g, '#8a5a3c', 3);
      for (const [sx, h] of [[bx - 30, 110], [bx + 40, 90]]) { g.beginPath(); g.moveTo(sx, by); g.lineTo(sx, by - h); g.quadraticCurveTo(sx + 50, by - h * 0.6, sx + 40, by - 10); g.closePath(); fillStroke(g, '#c96a3a', 3); }
      ground(g, GROUND + 20, '#e7d6b4');
    },
    ambient: [{ cls: 'fog-band', x: 0, y: 380, delay: 0 }, { cls: 'fog-band', x: 0, y: 300, delay: 6 }, { cls: 'wave-line', x: 260, y: 560, delay: 1 }],
  },

  bali: {
    name: 'Bali', country: 'Indonesia', lang: 'id', accent: '#3ff0c3', outfit: 'bali', vehicle: 'scooter', foods: ['coconut'],
    weather: ['sunny', 'rain', 'storm'], person: 'wayan',
    draw(g) {
      sky(g, [[0, '#57c3ff'], [0.65, '#b6ecff'], [1, '#fff4d1']]);
      // a volcano far away
      g.beginPath(); g.moveTo(420, 380); g.lineTo(600, 160); g.lineTo(640, 160); g.lineTo(840, 380); g.closePath(); fillStroke(g, '#8fb3c9', 3);
      cloud(g, 640, 150, 0.6, 'rgba(255,255,255,0.75)');
      // rice terraces: green steps curving across
      const shades = ['#8fd36a', '#7cc85a', '#6bbd4f', '#5aae45', '#4d9e3d'];
      for (let i = 0; i < 6; i++) {
        const y = 360 + i * 46;
        g.beginPath(); g.moveTo(0, y + 20); g.bezierCurveTo(300, y - 30, 700, y + 50, W, y); g.lineTo(W, H); g.lineTo(0, H); g.closePath(); fillStroke(g, shades[i % 5], 3);
        g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, y + 26); g.bezierCurveTo(300, y - 24, 700, y + 56, W, y + 6); g.stroke();
      }
      // a split gate (two stepped towers with a gap: no particular temple)
      const gx = 230, gb = 470;
      for (const s of [-1, 1]) {
        g.beginPath(); g.moveTo(gx + s * 20, gb); g.lineTo(gx + s * 20, gb - 210); g.lineTo(gx + s * 60, gb - 250); g.lineTo(gx + s * 100, gb - 170); g.lineTo(gx + s * 100, gb); g.closePath(); fillStroke(g, '#9a6a4a', 3);
        g.fillStyle = 'rgba(23,10,54,0.2)'; for (let k = gb - 40; k > gb - 200; k -= 30) g.fillRect(Math.min(gx + s * 20, gx + s * 100), k, 80, 5);
      }
      palm(g, 1210, 600, 280, -0.12); palm(g, 80, 600, 230, 0.1);
    },
    ambient: [{ cls: 'cloud-drift', x: 500, y: 60, delay: 2 }, ...[[880, 200], [930, 180]].map(([x, y], i) => ({ cls: 'bird-flap', x, y, delay: i * 0.4 }))],
  },

  palawan: {
    name: 'Palawan', country: 'Philippines', lang: 'fil', accent: '#3ff0c3', outfit: 'palawan', vehicle: 'jeepney', foods: ['turon', 'coconut'],
    weather: ['sunny', 'rain', 'storm'], person: 'jo',
    draw(g) {
      sky(g, [[0, '#3fb6ff'], [0.65, '#a9e6ff'], [1, '#fff6d6']]);
      sun(g, 1140, 90, 44);
      // tall limestone cliffs with green on top, a lagoon
      for (const [x, w, h] of [[110, 220, 360], [380, 180, 280], [560, 140, 200]]) {
        g.beginPath(); g.moveTo(x - w / 2, 500); g.lineTo(x - w / 2 + 10, 500 - h * 0.8); g.lineTo(x - w * 0.2, 500 - h); g.lineTo(x + w * 0.25, 500 - h * 0.96); g.lineTo(x + w / 2, 500 - h * 0.7); g.lineTo(x + w / 2, 500); g.closePath();
        fillStroke(g, '#8c8f9e', 3);
        g.beginPath(); g.ellipse(x, 500 - h * 0.98, w * 0.42, 26, 0, 0, 7); fillStroke(g, '#3d9e5a', 3);
        g.strokeStyle = 'rgba(23,10,54,0.2)'; g.lineWidth = 2; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(x - w * 0.3 + k * w * 0.2, 500 - h * 0.85); g.lineTo(x - w * 0.32 + k * w * 0.2, 490); g.stroke(); }
      }
      water(g, 500, GROUND + 10, '#2fd3c6', '#1fa6b0', 17, 'rgba(255,255,255,0.45)');
      // white sand and a little outrigger boat
      g.beginPath(); g.moveTo(0, GROUND + 10); g.quadraticCurveTo(640, GROUND - 14, W, GROUND + 10); g.lineTo(W, H); g.lineTo(0, H); g.closePath(); fillStroke(g, '#fff1d0', 4);
      const bx = 470, by = 560;
      g.beginPath(); g.moveTo(bx - 80, by); g.quadraticCurveTo(bx, by + 26, bx + 90, by); g.closePath(); fillStroke(g, '#3a7bd5', 3);
      g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.moveTo(bx - 60, by - 6); g.lineTo(bx - 110, by + 12); g.moveTo(bx + 70, by - 6); g.lineTo(bx + 120, by + 12); g.stroke();
      g.beginPath(); g.moveTo(bx - 130, by + 14); g.lineTo(bx + 140, by + 14); g.stroke();
      palm(g, 1230, 620, 260, -0.14);
    },
    ambient: [{ cls: 'wave-line', x: 240, y: 540, delay: 0 }, { cls: 'wave-line', x: 700, y: 520, delay: 1.4 }, { cls: 'gull', x: 680, y: 140 }],
  },

  tokyo: {
    name: 'Tokyo', country: 'Japan', lang: 'ja', accent: '#ff4da6', outfit: 'tokyo', vehicle: 'train', foods: ['onigiri', 'sushi', 'dango'],
    weather: ['petals', 'rain', 'snow', 'leaves'], person: 'yui',
    draw(g) {
      sky(g, [[0, '#2b1d6b'], [0.5, '#8a4bd1'], [0.85, '#ff8fb8'], [1, '#ffc7a6']]);
      stars(g, 50, 23, 220, 0.6);
      // the snowy mountain far away
      g.beginPath(); g.moveTo(540, 470); g.lineTo(800, 250); g.lineTo(840, 250); g.lineTo(1120, 470); g.closePath(); fillStroke(g, '#7a6fb8', 3);
      g.beginPath(); g.moveTo(760, 284); g.lineTo(800, 250); g.lineTo(840, 250); g.lineTo(880, 284); g.lineTo(856, 296); g.lineTo(834, 280); g.lineTo(812, 298); g.lineTo(790, 282); g.closePath(); g.fillStyle = '#fff'; g.fill();
      // the red-and-white tower (a lattice tower, no particular one)
      const x = 300, base = 560;
      const legs = (c) => { g.beginPath(); g.moveTo(x - 120, base); g.lineTo(x - 14, 120); g.lineTo(x + 14, 120); g.lineTo(x + 120, base); g.lineTo(x + 76, base); g.lineTo(x + 8, 180); g.lineTo(x - 8, 180); g.lineTo(x - 76, base); g.closePath(); fillStroke(g, c, 3); };
      legs('#ff5a3d');
      g.fillStyle = '#fff'; for (const y of [230, 330, 430]) { const w = 14 + (y - 120) * 0.25; g.fillRect(x - w, y, w * 2, 14); }
      for (const [y, w] of [[300, 90], [180, 50]]) { g.beginPath(); g.rect(x - w / 2, y, w, 20); fillStroke(g, '#ffffff', 3); }
      g.fillStyle = '#ff5a3d'; g.fillRect(x - 3, 40, 6, 84);
      // the city at night with glowing signs (shapes and hearts only: no words, no brands)
      blocks(g, 0, W, 600, 111, { min: 70, max: 200, body: '#241552', lit: '#ffd76b', litShare: 0.35 });
      for (const [sx, sy, c] of [[560, 470, '#ff4da6'], [620, 430, '#3ff0c3'], [960, 480, '#ffc933'], [1180, 440, '#ff4da6'], [100, 470, '#3ff0c3']]) {
        rrect(g, sx, sy, 34, 90, 6); fillStroke(g, 'rgba(23,10,54,0.9)', 3, c);
        heart(g, sx + 17, sy + 28, 9, c, 0); star(g, sx + 17, sy + 62, 10, c, 0);
      }
      ground(g, GROUND, '#3a2d6e');
      g.fillStyle = '#ffffff'; for (let k = 20; k < W; k += 80) g.fillRect(k, GROUND + 20, 50, 10);
    },
    ambient: [{ cls: 'neon', x: 577, y: 515 }, { cls: 'neon', x: 1197, y: 485 }, ...[[300, 40]].map(([x, y]) => ({ cls: 'beacon', x, y }))],
  },

  seoul: {
    name: 'Seoul', country: 'South Korea', lang: 'ko', accent: '#ff9cc0', outfit: 'seoul', vehicle: 'robotaxi', foods: ['fishbun'],
    weather: ['leaves', 'snow', 'rain', 'petals'], person: 'minji',
    draw(g) {
      sky(g, [[0, '#7fb0ff'], [0.6, '#cfe0ff'], [1, '#ffe6d2']]);
      cloud(g, 760, 100, 1); cloud(g, 1100, 150, 0.8);
      // a green hill with the city tower on top (a needle and its round top: no particular tower)
      g.beginPath(); g.moveTo(80, 470); g.quadraticCurveTo(330, 300, 600, 470); g.closePath(); fillStroke(g, '#5aa66a', 3);
      g.fillStyle = '#e8edf7'; g.fillRect(325, 180, 14, 170); g.fillRect(330, 110, 4, 74);
      g.beginPath(); g.ellipse(332, 200, 30, 14, 0, 0, 7); fillStroke(g, '#c9d3ea', 3);
      blocks(g, 560, W, 470, 121, { min: 60, max: 190, body: '#93a3c7' });
      // a palace gate's roof in front: a wide curved roof on red columns (no particular palace)
      const x = 330, y = 470;
      g.beginPath(); g.moveTo(x - 270, y - 40); g.quadraticCurveTo(x - 200, y - 60, x - 150, y - 110); g.lineTo(x + 150, y - 110); g.quadraticCurveTo(x + 200, y - 60, x + 270, y - 40);
      g.quadraticCurveTo(x + 200, y - 66, x + 150, y - 70); g.lineTo(x - 150, y - 70); g.quadraticCurveTo(x - 200, y - 66, x - 270, y - 40); g.closePath(); fillStroke(g, '#3a3f5c', 3);
      g.fillStyle = '#2e8a63'; g.fillRect(x - 160, y - 70, 320, 18);
      for (let i = 0; i < 6; i++) { g.beginPath(); g.rect(x - 150 + i * 58, y - 52, 16, 140); fillStroke(g, '#c43a35', 3); }
      ground(g, GROUND, '#d9cdb8');
      roundTree(g, 1190, 600, 56, '#e98a3a'); roundTree(g, 1260, 610, 40, '#f0b23f');
    },
    ambient: [{ cls: 'cloud-drift', x: 600, y: 80, delay: 3 }, ...[0, 1, 2, 3].map((i) => ({ cls: `lantern c${i % 3}`, x: 120 + i * 140, y: 330 + (i % 2) * 14, delay: i * 0.5 }))],
  },

  beijing: {
    name: 'the Great Wall', country: 'China', lang: 'zh', accent: '#ffc933', outfit: 'beijing', vehicle: 'train', foods: ['bao', 'tanghulu'],
    weather: ['sunny', 'leaves', 'snow', 'fog'], person: 'wei',
    draw(g) {
      sky(g, [[0, '#86c5ff'], [0.65, '#d2ecff'], [1, '#fff1dc']]);
      sun(g, 1090, 100, 44);
      // mountains in layers, autumn-colored near
      hills(g, 330, 110, '#a9b9d9', 3, 3); hills(g, 400, 120, '#8fae8a', 5, 3); hills(g, 470, 110, '#c98a4a', 9, 3);
      // the wall winding over the ridges, with watchtowers
      g.lineJoin = 'round'; g.lineCap = 'round';
      const path = [[0, 520], [120, 470], [220, 420], [320, 450], [420, 380], [520, 350], [600, 390], [700, 360]];
      g.lineWidth = 30; g.strokeStyle = INK; g.beginPath(); path.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
      g.lineWidth = 22; g.strokeStyle = '#d9c39a'; g.stroke();
      g.lineWidth = 3; g.strokeStyle = 'rgba(23,10,54,0.35)'; g.stroke();
      for (const [x, y] of [[220, 420], [520, 350]]) {
        g.beginPath(); g.rect(x - 34, y - 64, 68, 64); fillStroke(g, '#e2cfa6', 3);
        g.fillStyle = INK; g.fillRect(x - 10, y - 40, 20, 24);
        for (let k = -34; k < 34; k += 14) g.fillRect(x + k, y - 74, 9, 10);
      }
      g.lineCap = 'butt';
      ground(g, GROUND, '#b88a52');
      roundTree(g, 1200, 600, 50, '#e98a3a'); roundTree(g, 1255, 605, 38, '#d65a3a');
    },
    ambient: [{ cls: 'kite', x: 860, y: 150 }, { cls: 'cloud-drift', x: 420, y: 90, delay: 4 }],
  },

  rio: {
    name: 'Rio de Janeiro', country: 'Brazil', lang: 'pt', accent: '#3ff0c3', outfit: 'rio', vehicle: 'cablecar', foods: ['cheesebread', 'coconut'],
    weather: ['sunny', 'rain', 'rainbow'], person: 'bia',
    draw(g) {
      sky(g, [[0, '#2fa7ff'], [0.65, '#9fdcff'], [1, '#fff3c9']]);
      sun(g, 1150, 90, 46);
      // the two rounded peaks by the sea, and a cable between them
      g.beginPath(); g.moveTo(40, 470); g.bezierCurveTo(60, 240, 250, 180, 300, 300); g.bezierCurveTo(320, 380, 360, 440, 380, 470); g.closePath(); fillStroke(g, '#5b8c6e', 3);
      g.beginPath(); g.moveTo(330, 470); g.bezierCurveTo(360, 390, 470, 340, 520, 420); g.lineTo(560, 470); g.closePath(); fillStroke(g, '#6f9f80', 3);
      g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(230, 210); g.quadraticCurveTo(360, 300, 470, 360); g.stroke();
      water(g, 470, 540, '#1f8fd6', '#1a70b8', 19, 'rgba(255,255,255,0.4)');
      // the beach and its wavy promenade
      g.fillStyle = '#ffe6a8'; g.fillRect(0, 540, W, 40);
      g.fillStyle = '#ffffff'; g.fillRect(0, 580, W, H - 580);
      g.strokeStyle = INK; g.lineWidth = 6;
      for (let y = 596; y < H; y += 26) { g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= W; x += 40) g.quadraticCurveTo(x + 10, y - 10, x + 20, y), g.quadraticCurveTo(x + 30, y + 10, x + 40, y); g.stroke(); }
      palm(g, 640, 590, 230, -0.1); palm(g, 1230, 600, 270, -0.12);
    },
    ambient: [{ cls: 'wave-line', x: 200, y: 500, delay: 0.3 }, { cls: 'wave-line', x: 820, y: 512, delay: 1.6 }, { cls: 'gull', x: 720, y: 160 }],
  },

  mexico: {
    name: 'Chichén Itzá', country: 'Mexico', lang: 'es', accent: '#ff4da6', outfit: 'mexico', vehicle: 'robotaxi', foods: ['taco', 'churro'],
    weather: ['sunny', 'rain', 'storm'], person: 'sofia',
    draw(g) {
      sky(g, [[0, '#33a6ff'], [0.65, '#a8deff'], [1, '#fff3cf']]);
      cloud(g, 820, 110, 1.1); cloud(g, 1130, 160, 0.8);
      // jungle behind
      for (let k = 0; k < W; k += 70) { g.beginPath(); g.arc(k, 470, 60 + (k % 3) * 10, Math.PI, 0); fillStroke(g, k % 140 ? '#3f9a55' : '#358a4a', 3); }
      // the stepped pyramid: nine terraces, the staircase up the middle, the temple on top
      const x = 330, base = 560, w0 = 520, step = 34;
      for (let i = 0; i < 9; i++) {
        const w = w0 - i * 44;
        g.beginPath(); g.rect(x - w / 2, base - (i + 1) * step, w, step); fillStroke(g, i % 2 ? '#d9c08a' : '#e6cf9a', 3);
        g.fillStyle = 'rgba(23,10,54,0.12)'; g.fillRect(x - w / 2, base - (i + 1) * step + step - 6, w, 6);
      }
      g.beginPath(); g.moveTo(x - 40, base); g.lineTo(x - 30, base - 9 * step); g.lineTo(x + 30, base - 9 * step); g.lineTo(x + 40, base); g.closePath(); fillStroke(g, '#cdb27a', 3);
      g.strokeStyle = 'rgba(23,10,54,0.3)'; g.lineWidth = 2; for (let y = base - 9; y > base - 9 * step; y -= 9) { g.beginPath(); g.moveTo(x - 36, y); g.lineTo(x + 36, y); g.stroke(); }
      g.beginPath(); g.rect(x - 60, base - 9 * step - 70, 120, 70); fillStroke(g, '#e6cf9a', 3);
      g.fillStyle = INK; g.fillRect(x - 16, base - 9 * step - 50, 32, 50);
      ground(g, GROUND, '#cfe0a0');
      // cut-paper flags across the top (bright colors, simple shapes)
      g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 96); g.quadraticCurveTo(320, 136, 640, 100); g.stroke();
      const cols = ['#ff4da6', '#ffc933', '#3ff0c3', '#6b3bff', '#ff8a3d'];
      for (let i = 0; i < 14; i++) {
        const fx = 20 + i * 45, fy = 96 + Math.sin((fx / 640) * Math.PI) * 26;
        g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx + 34, fy); g.lineTo(fx + 34, fy + 40); g.lineTo(fx + 17, fy + 30); g.lineTo(fx, fy + 40); g.closePath(); fillStroke(g, cols[i % 5], 2);
        g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.arc(fx + 17, fy + 15, 6, 0, 7); g.fill();
      }
    },
    ambient: [{ cls: 'cloud-drift', x: 760, y: 70, delay: 1 }, ...[[700, 220], [750, 200]].map(([x, y], i) => ({ cls: 'bird-flap', x, y, delay: i * 0.6 }))],
  },

  moon: {
    name: 'the Moon', country: '384,400 km from home', lang: null, accent: '#e4d9ff', outfit: 'space', vehicle: 'rocket', foods: ['spacefood'],
    weather: ['stars'], person: 'nova',
    draw(g) {
      g.fillStyle = '#05030f'; g.fillRect(0, 0, W, H);
      stars(g, 220, 31, 560, 1);
      // the Earth in the sky
      g.fillStyle = 'rgba(120,180,255,0.18)'; g.beginPath(); g.arc(520, 150, 92, 0, 7); g.fill();
      g.beginPath(); g.arc(520, 150, 70, 0, 7); fillStroke(g, '#3a8be0', 3);
      g.fillStyle = '#4fbf6a';
      for (const [x, y, rx, ry] of [[500, 130, 26, 16], [548, 170, 20, 12], [496, 182, 14, 8]]) { g.beginPath(); g.ellipse(x, y, rx, ry, 0.4, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,0.75)'; g.beginPath(); g.ellipse(530, 110, 30, 7, 0.2, 0, 7); g.fill();
      g.fillStyle = 'rgba(5,3,15,0.55)'; g.beginPath(); g.arc(548, 150, 70, -Math.PI / 2, Math.PI / 2); g.fill();
      // the grey ground with craters
      g.beginPath(); g.moveTo(0, 470); g.quadraticCurveTo(300, 430, 640, 470); g.quadraticCurveTo(960, 505, W, 460); g.lineTo(W, H); g.lineTo(0, H); g.closePath(); fillStroke(g, '#b9b8c9', 4);
      const r = rnd(33);
      for (let i = 0; i < 16; i++) { const x = r() * W, y = 500 + r() * 200, s = 14 + r() * 40; g.beginPath(); g.ellipse(x, y, s, s * 0.35, 0, 0, 7); fillStroke(g, '#9f9db3', 2); g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(x, y - s * 0.12, s * 0.8, s * 0.2, 0, 0, Math.PI); g.fill(); }
      // her flag: a heart on violet (hers, nobody's country)
      g.fillStyle = '#d8d8e6'; g.fillRect(208, 330, 6, 160);
      rrect(g, 214, 330, 110, 70, 6); fillStroke(g, '#6b3bff', 3);
      heart(g, 269, 362, 18, '#ff4da6', 3);
      // a little base dome
      g.beginPath(); g.moveTo(470, 520); g.arc(560, 520, 90, Math.PI, 0); g.closePath(); fillStroke(g, '#e8e8f2', 4);
      g.fillStyle = '#3ff0c3'; g.fillRect(540, 470, 40, 20);
    },
    ambient: [{ cls: 'shooting-star', x: 700, y: 80 }, { cls: 'star-twinkle', x: 860, y: 60, delay: 0.7 }, { cls: 'star-twinkle', x: 120, y: 190, delay: 1.5 }],
  },

  mars: {
    name: 'Mars', country: 'the red planet', lang: null, accent: '#ff8a3d', outfit: 'space', vehicle: 'rocket', foods: ['spacefood'],
    weather: ['dust', 'stars'], person: 'rusty',
    draw(g) {
      sky(g, [[0, '#5b2a3a'], [0.55, '#c75a3a'], [1, '#f2a06a']]);
      // its two little moons
      g.fillStyle = '#e8c9b0'; g.beginPath(); g.arc(380, 110, 18, 0, 7); g.fill(); g.beginPath(); g.arc(560, 70, 10, 0, 7); g.fill();
      // red dunes, mesas and rocks
      g.beginPath(); g.moveTo(0, 430); g.lineTo(80, 430); g.lineTo(110, 360); g.lineTo(260, 360); g.lineTo(290, 430); g.lineTo(640, 440); g.lineTo(W, 430); g.lineTo(W, H); g.lineTo(0, H); g.closePath(); fillStroke(g, '#a8462e', 4);
      g.beginPath(); g.moveTo(0, 520); g.quadraticCurveTo(320, 470, 700, 520); g.quadraticCurveTo(1000, 560, W, 510); g.lineTo(W, H); g.lineTo(0, H); g.closePath(); fillStroke(g, '#d4673f', 4);
      const r = rnd(43);
      for (let i = 0; i < 12; i++) { const x = r() * W, y = 560 + r() * 140, s = 10 + r() * 24; g.beginPath(); g.ellipse(x, y, s, s * 0.6, 0, 0, 7); fillStroke(g, '#8f3b28', 2); }
      // a habitat: two domes and a tube between them
      g.beginPath(); g.moveTo(140, 540); g.arc(220, 540, 80, Math.PI, 0); g.closePath(); fillStroke(g, '#f0ece6', 4);
      g.beginPath(); g.moveTo(380, 540); g.arc(430, 540, 50, Math.PI, 0); g.closePath(); fillStroke(g, '#f0ece6', 4);
      g.beginPath(); g.rect(300, 512, 80, 26); fillStroke(g, '#dcd6cc', 3);
      g.fillStyle = '#3ff0c3'; g.fillRect(200, 490, 40, 18); g.fillRect(418, 506, 24, 12);
      // rover tracks
      g.strokeStyle = 'rgba(80,30,20,0.4)'; g.lineWidth = 4;
      for (const d of [0, 16]) { g.beginPath(); g.moveTo(480, 600 + d); g.quadraticCurveTo(800, 560 + d, W, 640 + d); g.stroke(); }
    },
    ambient: [{ cls: 'dust-drift', x: 0, y: 420 }, { cls: 'dust-drift', x: 0, y: 520, delay: 4 }],
  },
};
export const PLACE_IDS = Object.keys(PLACES);
// what she says there: the greeting in its language and what it means (tools/live/lines.js PLACE_LINES has the rest)
export const placeOf = (id) => PLACES[id] || null;

// Draws a place (the set's background canvas) and fills its moving bits (the ambient layer), like a room
export function drawPlace(id, canvas) {
  const p = PLACES[id];
  if (!p) return null;
  const g = canvas.getContext('2d');
  g.save();
  g.clearRect(0, 0, W, H);
  g.lineJoin = 'round';
  p.draw(g);
  g.restore();
  return p;
}

// ---------- the travel scenes: what she sees on the way (vehicles.js `kind`) ----------
// Each drawn once, with things passing by (stage.css .mv-*: CSS animations, the world moving while her vehicle bobs in place)
export const TRAVEL = {
  road: {
    draw(g) {
      sky(g, [[0, '#7ec8ff'], [0.7, '#d6efff'], [1, '#fff0d6']], 560);
      cloud(g, 300, 110, 1.1); cloud(g, 980, 80, 0.9);
      hills(g, 470, 90, '#9fd3a0', 51, 3);
      blocks(g, 0, W, 560, 52, { min: 30, max: 120, body: '#a7b8d9' });
      g.fillStyle = '#4a4560'; g.fillRect(0, 560, W, H - 560);
      g.fillStyle = '#6d6884'; g.fillRect(0, 560, W, 10);
    },
    ambient: [
      { cls: 'mv-road', x: 0, y: 612 },
      ...[0, 1, 2, 3].map((i) => ({ cls: 'mv-tree', x: 0, y: 470, delay: i * 1.5 })),
      ...[0, 1].map((i) => ({ cls: 'mv-cloud', x: 0, y: 70 + i * 60, delay: i * 5 })),
    ],
  },
  rail: {
    draw(g) {
      sky(g, [[0, '#8fd0ff'], [0.7, '#e1f4ff'], [1, '#fff3d9']], 520);
      cloud(g, 420, 90, 1); cloud(g, 1060, 140, 0.8);
      hills(g, 430, 80, '#b5d99a', 61, 3);
      g.fillStyle = '#8fc96a'; g.fillRect(0, 470, W, 120);
      g.fillStyle = '#7a6a5a'; g.fillRect(0, 590, W, H - 590);
    },
    ambient: [
      { cls: 'mv-rail', x: 0, y: 600 },
      ...[0, 1, 2].map((i) => ({ cls: 'mv-pole', x: 0, y: 300, delay: i * 0.9 })),
      ...[0, 1].map((i) => ({ cls: 'mv-cloud', x: 0, y: 60 + i * 70, delay: i * 4 })),
    ],
  },
  sky: {
    draw(g) {
      sky(g, [[0, '#3f9cff'], [0.6, '#a9dcff'], [1, '#e9f6ff']], H);
      sun(g, 1120, 110, 50);
      // a sea of clouds below
      g.fillStyle = '#ffffff';
      for (let x = -40; x < W + 80; x += 90) { g.beginPath(); g.arc(x, 640, 70 + (x % 3) * 8, 0, 7); g.fill(); }
      g.fillRect(0, 640, W, 80);
    },
    ambient: [...[0, 1, 2, 3].map((i) => ({ cls: 'mv-cloud big', x: 0, y: 120 + (i % 2) * 220, delay: i * 2.2 }))],
  },
  sea: {
    draw(g) {
      sky(g, [[0, '#6cc4ff'], [0.7, '#cdeeff'], [1, '#fff1d6']], 420);
      sun(g, 1080, 120, 44);
      water(g, 420, H, '#2f9fd6', '#1c6fae', 21, 'rgba(255,255,255,0.4)');
    },
    ambient: [
      { cls: 'mv-waves', x: 0, y: 470 }, { cls: 'mv-waves slow', x: 0, y: 540 },
      { cls: 'mv-isle', x: 0, y: 330 }, { cls: 'gull', x: 380, y: 140 },
    ],
  },
  cable: {
    draw(g) {
      sky(g, [[0, '#4fb0ff'], [0.7, '#bfe6ff'], [1, '#e8f6ff']], H);
      // the cable across the top (the gondola's hanger rides on it), the city and the sea far below
      g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.moveTo(0, 30); g.lineTo(W, 40); g.stroke();
      water(g, 600, H, '#2f9fd6', '#1c6fae', 23, 'rgba(255,255,255,0.4)');
      blocks(g, 0, W, 610, 71, { min: 20, max: 70, body: '#9fb3d6' });
    },
    ambient: [...[0, 1, 2].map((i) => ({ cls: 'mv-cloud', x: 0, y: 200 + i * 110, delay: i * 2.6 }))],
  },
  space: {
    draw(g) {
      g.fillStyle = '#05030f'; g.fillRect(0, 0, W, H);
      stars(g, 160, 41, H, 0.9);
      g.fillStyle = 'rgba(107,59,255,0.18)'; g.beginPath(); g.ellipse(980, 220, 260, 120, -0.4, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,77,166,0.12)'; g.beginPath(); g.ellipse(260, 520, 240, 110, 0.3, 0, 7); g.fill();
    },
    ambient: [...Array.from({ length: 10 }, (_, i) => ({ cls: 'mv-streak', x: 60 + i * 124, y: 0, delay: (i * 0.37) % 1.4 }))],
  },
};
export function drawTravel(kind, canvas) {
  const t = TRAVEL[kind] || TRAVEL.road;
  const g = canvas.getContext('2d');
  g.save(); g.clearRect(0, 0, W, H); g.lineJoin = 'round'; t.draw(g); g.restore();
  return t;
}
