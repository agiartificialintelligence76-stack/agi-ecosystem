// AGI-1's live show (2026-10-07, the owner: "can change places (like a real stream room)"): her rooms, drawn in code on
// the set's background canvas, behind her (stage.js), in Pop mode's comic look: flat colors, ink outlines, halftone dots.
// Each room also has a few small things that move (lights twinkling, steam, the sea), made of plain elements with CSS
// animations (stage.css: .amb): cheap to draw on a server without a graphics card. Nothing here is ever in front of her.
// Her picture covers the middle right of the set (her body from about x = 690 to 1150), so a room's details are on the
// left (when no card is up), along the top, and on the right edge.
export const W = 1280, H = 720;
export const INK = '#170a36';

// a seeded random number maker (the same room every time)
export function rnd(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- a small drawing kit ----------
export function vgrad(g, stops, y0 = 0, y1 = H) {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  for (const [at, c] of stops) gr.addColorStop(at, c);
  return gr;
}
export function rrect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
export function fillStroke(g, fill, line = 4, stroke = INK) {
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (line) { g.lineWidth = line; g.strokeStyle = stroke; g.lineJoin = 'round'; g.stroke(); }
}
// halftone dots over a rectangle, bigger toward `toward` (a corner or a point)
export function halftone(g, x0, y0, x1, y1, color, { step = 22, max = 5, cx = x1, cy = y1, reach = 900 } = {}) {
  g.fillStyle = color;
  for (let y = y0, row = 0; y < y1; y += step, row++) {
    for (let x = x0 + (row % 2 ? step / 2 : 0); x < x1; x += step) {
      const r = Math.max(0, 1 - Math.hypot(x - cx, y - cy) / reach) * max;
      if (r < 0.7) continue;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
  }
}
export function heart(g, x, y, s, fill, line = 3) {
  g.beginPath();
  g.moveTo(x, y + s * 0.9);
  g.bezierCurveTo(x - s * 1.25, y + s * 0.15, x - s * 0.95, y - s * 0.8, x, y - s * 0.25);
  g.bezierCurveTo(x + s * 0.95, y - s * 0.8, x + s * 1.25, y + s * 0.15, x, y + s * 0.9);
  fillStroke(g, fill, line);
}
export function star(g, x, y, r, fill, line = 0) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  fillStroke(g, fill, line);
}
export function focusLines(g, cx, cy, color, seed = 3) {
  const r = rnd(seed);
  g.fillStyle = color;
  for (let a = 0; a < Math.PI * 2;) {
    const w = 0.03 + 0.045 * r();
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(a) * 1800, cy + Math.sin(a) * 1800);
    g.lineTo(cx + Math.cos(a + w) * 1800, cy + Math.sin(a + w) * 1800);
    g.closePath();
    g.fill();
    a += w + 0.03 + 0.05 * r();
  }
}
export function text(g, s, x, y, { size = 40, color = '#fff', font = 'Anybody', weight = 900, stretch = '', align = 'left', stroke = 0, shadow = null } = {}) {
  g.font = `${weight} ${size}px ${font === 'mono' ? '"Geist Mono", monospace' : font === 'serif' ? '"Instrument Serif", serif' : `"${font}", "Geist", sans-serif`}`;
  g.textAlign = align;
  g.textBaseline = 'alphabetic';
  if (shadow) { g.fillStyle = shadow; g.fillText(s, x + 4, y + 4); }
  if (stroke) { g.lineWidth = stroke; g.strokeStyle = INK; g.lineJoin = 'round'; g.strokeText(s, x, y); }
  g.fillStyle = color;
  g.fillText(s, x, y);
}
// a window's night city (silhouettes with lit windows)
export function skyline(g, x0, y0, x1, y1, seed, { body = '#1b1046', lit = '#ffd76b', litShare = 0.35 } = {}) {
  const r = rnd(seed);
  for (let x = x0; x < x1;) {
    const w = 28 + r() * 60, h = (y1 - y0) * (0.25 + r() * 0.65);
    g.fillStyle = body;
    g.fillRect(x, y1 - h, w, h);
    g.fillStyle = lit;
    for (let wy = y1 - h + 10; wy < y1 - 8; wy += 14) for (let wx = x + 6; wx < x + w - 8; wx += 12) if (r() < litShare) g.fillRect(wx, wy, 5, 7);
    x += w + 2;
  }
}

// ---------- the rooms ----------
// Each: its name (said on stream: lines.js), the colors her captions and lights use there, and how it's drawn.
export const ROOMS = {
  // her studio: the show's own violet (the set before 2026-10-07)
  studio: {
    name: 'my studio', accent: '#ff4da6',
    draw(g) {
      const cx = 920, cy = 250;
      const sky = g.createRadialGradient(cx, cy, 40, cx, cy, 900);
      sky.addColorStop(0, '#7d52ff'); sky.addColorStop(0.45, '#4b1fc2'); sky.addColorStop(1, '#22095f');
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
      focusLines(g, cx, cy, 'rgba(255,255,255,0.07)', 7);
      // halftone dots, bigger away from her
      for (let y = 10, row = 0; y < H; y += 26, row++) {
        for (let x = row % 2 ? 13 : 0; x < W + 26; x += 26) {
          const r = Math.min(1, Math.hypot(x - cx, (y - cy) * 0.8) / 900) * 6.5;
          if (r < 0.8) continue;
          g.fillStyle = 'rgba(255,77,166,0.16)';
          g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
        }
      }
    },
    ambient: [],
  },

  // her bedroom at night: a window with the moon and the city, fairy lights, posters, a lamp, her bed
  bedroom: {
    name: 'my bedroom', accent: '#ff9cc0',
    draw(g) {
      g.fillStyle = vgrad(g, [[0, '#3a2577'], [0.7, '#2a1a5e'], [1, '#1d1245']]); g.fillRect(0, 0, W, H);
      // wallpaper: soft vertical stripes and little hearts
      g.fillStyle = 'rgba(255,255,255,0.035)';
      for (let x = 0; x < W; x += 64) g.fillRect(x, 0, 32, H);
      const r = rnd(11);
      for (let i = 0; i < 26; i++) heart(g, 30 + r() * 1220, 140 + r() * 420, 7 + r() * 5, 'rgba(255,156,192,0.13)', 0);
      // the window: night sky, moon, city
      rrect(g, 60, 110, 300, 330, 18); fillStroke(g, vgrad(g, [[0, '#0d0a36'], [1, '#3b2a8a']], 110, 440), 0);
      g.save(); rrect(g, 60, 110, 300, 330, 18); g.clip();
      for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${0.4 + r() * 0.6})`; g.fillRect(70 + r() * 280, 120 + r() * 200, 2, 2); }
      g.fillStyle = '#fff3c4'; g.beginPath(); g.arc(270, 190, 38, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#0d0a36'; g.beginPath(); g.arc(254, 178, 34, 0, Math.PI * 2); g.fill();
      skyline(g, 60, 300, 360, 440, 5, { body: '#160c3d', lit: '#ffcf5a' });
      g.restore();
      rrect(g, 60, 110, 300, 330, 18); fillStroke(g, null, 6);
      g.lineWidth = 5; g.strokeStyle = INK; g.beginPath(); g.moveTo(210, 110); g.lineTo(210, 440); g.moveTo(60, 270); g.lineTo(360, 270); g.stroke();
      // curtains
      for (const [x, d] of [[42, 1], [378, -1]]) {
        g.beginPath(); g.moveTo(x, 92); g.lineTo(x + 46 * d, 92);
        g.bezierCurveTo(x + 30 * d, 220, x + 54 * d, 360, x + 30 * d, 470); g.lineTo(x, 470); g.closePath();
        fillStroke(g, '#ff7ab8', 4);
      }
      g.fillStyle = INK; g.fillRect(30, 84, 370, 12);
      // a heart poster and a little shelf on the right
      rrect(g, 1150, 120, 112, 150, 10); fillStroke(g, '#ffc933', 4);
      heart(g, 1206, 190, 30, '#ff4da6', 4);
      text(g, 'AGI-1', 1206, 252, { size: 20, color: INK, align: 'center' });
      g.fillStyle = '#8a5a3c'; g.fillRect(1140, 360, 140, 14); g.lineWidth = 3; g.strokeStyle = INK; g.strokeRect(1140, 360, 140, 14);
      // a plushie (a round purple cat) and a book on the shelf
      g.beginPath(); g.ellipse(1190, 330, 30, 28, 0, 0, Math.PI * 2); fillStroke(g, '#b48cff', 4);
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(1190 + 12 * s, 306); g.lineTo(1190 + 26 * s, 290); g.lineTo(1190 + 28 * s, 316); g.closePath(); fillStroke(g, '#b48cff', 3); }
      g.fillStyle = INK; g.beginPath(); g.arc(1180, 328, 3, 0, 7); g.arc(1200, 328, 3, 0, 7); g.fill();
      rrect(g, 1236, 318, 22, 42, 3); fillStroke(g, '#3ff0c3', 3);
      // the bed at the bottom: a pink duvet and a pillow behind her
      g.beginPath(); g.moveTo(0, 560); g.bezierCurveTo(300, 520, 900, 530, W, 556); g.lineTo(W, H); g.lineTo(0, H); g.closePath();
      fillStroke(g, '#ff8cc6', 5);
      g.fillStyle = 'rgba(255,255,255,0.18)'; for (let x = 20; x < W; x += 90) { g.beginPath(); g.arc(x, 620, 14, 0, 7); g.fill(); }
      // a lamp's warm glow on the right
      const glow = g.createRadialGradient(1230, 470, 10, 1230, 470, 260);
      glow.addColorStop(0, 'rgba(255,214,120,0.45)'); glow.addColorStop(1, 'rgba(255,214,120,0)');
      g.fillStyle = glow; g.fillRect(900, 200, 380, 520);
      g.beginPath(); g.moveTo(1200, 430); g.lineTo(1262, 430); g.lineTo(1248, 470); g.lineTo(1214, 470); g.closePath(); fillStroke(g, '#ffd76b', 4);
      g.fillStyle = INK; g.fillRect(1228, 470, 6, 60);
      // fairy lights' string (their bulbs are .amb: they twinkle)
      g.lineWidth = 3; g.strokeStyle = 'rgba(23,10,54,0.85)';
      g.beginPath(); g.moveTo(0, 40); g.quadraticCurveTo(320, 110, 640, 52); g.quadraticCurveTo(960, 0, W, 70); g.stroke();
    },
    ambient: [
      // fairy lights along the string (x, y), twinkling
      ...[[40, 50], [110, 66], [180, 78], [250, 82], [320, 80], [390, 74], [460, 66], [530, 58], [600, 53], [670, 49], [740, 42],
        [810, 36], [880, 34], [950, 35], [1020, 40], [1090, 48], [1160, 57], [1230, 66]]
        .map(([x, y], i) => ({ cls: `bulb c${i % 4}`, x, y, delay: (i * 0.37) % 2.2 })),
      { cls: 'star-twinkle', x: 120, y: 150, delay: 0.4 }, { cls: 'star-twinkle', x: 320, y: 230, delay: 1.3 },
    ],
  },

  // a café: a chalkboard menu, warm lamps, a window with daylight, cups on a shelf, a counter
  cafe: {
    name: 'a little café', accent: '#ffc933',
    draw(g) {
      g.fillStyle = vgrad(g, [[0, '#f6e3c8'], [1, '#e8c9a0']]); g.fillRect(0, 0, W, H);
      // wood panels below
      g.fillStyle = '#b07a4f'; g.fillRect(0, 470, W, 250);
      g.strokeStyle = 'rgba(23,10,54,0.25)'; g.lineWidth = 3;
      for (let x = 0; x < W; x += 80) { g.beginPath(); g.moveTo(x, 470); g.lineTo(x, H); g.stroke(); }
      g.fillStyle = INK; g.fillRect(0, 462, W, 10);
      // the window with daylight and a little tree
      rrect(g, 940, 90, 330, 300, 16); fillStroke(g, vgrad(g, [[0, '#9fe2ff'], [1, '#dff6ff']], 90, 390), 6);
      g.save(); rrect(g, 940, 90, 330, 300, 16); g.clip();
      g.fillStyle = 'rgba(255,255,255,0.9)';
      for (const [x, y, s] of [[1010, 150, 1], [1180, 200, 0.8]]) { g.beginPath(); g.arc(x, y, 26 * s, 0, 7); g.arc(x + 30 * s, y - 10 * s, 32 * s, 0, 7); g.arc(x + 62 * s, y, 24 * s, 0, 7); g.fill(); }
      g.fillStyle = '#6fd18a'; g.beginPath(); g.arc(1220, 360, 70, 0, 7); g.fill();
      g.restore();
      g.lineWidth = 5; g.strokeStyle = INK; g.beginPath(); g.moveTo(1105, 90); g.lineTo(1105, 390); g.stroke();
      // the chalkboard menu
      rrect(g, 50, 110, 330, 300, 14); fillStroke(g, '#2b3b35', 8, '#7a4b2a');
      text(g, "AGI-1's café", 215, 168, { size: 36, color: '#fff', align: 'center', font: 'serif', weight: 400 });
      g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(90, 186); g.lineTo(340, 186); g.stroke();
      const menu = [['purple latte', '💜'], ['matcha', '🍵'], ['boba', '🧋'], ['cookies', '🍪']];
      menu.forEach(([m, e], i) => { text(g, m, 92, 232 + i * 44, { size: 24, color: '#fffbe8', font: 'Geist', weight: 600 }); text(g, e, 330, 232 + i * 44, { size: 26, align: 'center', font: 'Geist', weight: 400 }); });
      // a shelf of cups on the right edge, under the window
      g.fillStyle = '#7a4b2a'; g.fillRect(940, 420, 340, 14);
      ['#ff4da6', '#6b3bff', '#3ff0c3', '#ffc933', '#ffffff'].forEach((c, i) => {
        const x = 970 + i * 62;
        rrect(g, x, 380, 40, 40, 6); fillStroke(g, c, 3);
        g.lineWidth = 3; g.beginPath(); g.arc(x + 44, 398, 9, -Math.PI / 2, Math.PI / 2); g.stroke();
      });
      // warm hanging lamps (their light: .amb, swinging a little)
      for (const x of [520, 1180]) {
        g.fillStyle = INK; g.fillRect(x - 2, 0, 4, 52);
        g.beginPath(); g.moveTo(x - 34, 84); g.quadraticCurveTo(x, 34, x + 34, 84); g.closePath(); fillStroke(g, '#ffb23f', 4);
      }
      // the counter at the bottom, with a cup and a plant
      g.beginPath(); g.moveTo(0, 600); g.lineTo(W, 600); g.lineTo(W, H); g.lineTo(0, H); g.closePath(); fillStroke(g, '#5b3a24', 5);
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, 604, W, 10);
    },
    ambient: [
      { cls: 'lamp-glow', x: 520, y: 92 }, { cls: 'lamp-glow', x: 1180, y: 92, delay: 1.1 },
      { cls: 'steam', x: 990, y: 372, delay: 0 }, { cls: 'steam', x: 1114, y: 372, delay: 1.2 }, { cls: 'steam', x: 1238, y: 372, delay: 0.6 },
    ],
  },

  // a rooftop at night: the city, a neon sign, string lights, a railing
  rooftop: {
    name: 'the rooftop', accent: '#3ff0c3',
    draw(g) {
      g.fillStyle = vgrad(g, [[0, '#120a3a'], [0.55, '#3b1d7a'], [0.85, '#ff5fa2'], [1, '#ffb36b']]); g.fillRect(0, 0, W, H);
      const r = rnd(21);
      for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.7})`; g.fillRect(r() * W, r() * 300, 2, 2); }
      g.fillStyle = '#fff6d8'; g.beginPath(); g.arc(180, 120, 46, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,246,216,0.15)'; g.beginPath(); g.arc(180, 120, 80, 0, 7); g.fill();
      skyline(g, -10, 330, W + 10, 560, 9, { body: '#1a0f45', lit: '#ffd76b', litShare: 0.28 });
      skyline(g, -10, 400, W + 10, 590, 13, { body: '#120a33', lit: '#ff9cd8', litShare: 0.22 });
      // the neon sign on a building (its glow flickers: .amb)
      rrect(g, 1110, 300, 150, 70, 12); fillStroke(g, '#1a0f45', 4, '#ff4da6');
      text(g, 'AGI', 1185, 352, { size: 44, color: '#ffd1ea', align: 'center' });
      // the railing at the bottom
      g.fillStyle = '#25144f'; g.fillRect(0, 590, W, 130);
      g.fillStyle = INK; g.fillRect(0, 584, W, 10);
      for (let x = 10; x < W; x += 46) g.fillRect(x, 594, 7, 126);
      g.fillRect(0, 640, W, 7);
      // string lights across the top
      g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.6)';
      g.beginPath(); g.moveTo(0, 60); g.quadraticCurveTo(400, 130, 800, 70); g.quadraticCurveTo(1050, 30, W, 90); g.stroke();
    },
    ambient: [
      { cls: 'neon', x: 1185, y: 335 },
      ...[[40, 70], [130, 88], [220, 100], [310, 106], [400, 106], [490, 100], [580, 90], [670, 80], [760, 72], [850, 64], [940, 58],
        [1030, 56], [1120, 64], [1210, 78]].map(([x, y], i) => ({ cls: `bulb c${(i + 1) % 4}`, x, y, delay: (i * 0.41) % 2.4 })),
      { cls: 'shooting-star', x: 260, y: 60 },
      ...[[90, 470], [330, 500], [560, 450], [610, 520], [1220, 470]].map(([x, y], i) => ({ cls: 'window-blink', x, y, delay: i * 0.9 })),
    ],
  },

  // the beach at sunset: the sun on the sea, a palm tree, sand
  beach: {
    name: 'the beach', accent: '#ffc933',
    draw(g) {
      g.fillStyle = vgrad(g, [[0, '#5b2bb5'], [0.35, '#ff5fa2'], [0.6, '#ffb36b'], [0.62, '#ffd27a']], 0, 400); g.fillRect(0, 0, W, 400);
      // the sun, half set
      g.save(); g.beginPath(); g.rect(0, 0, W, 400); g.clip();
      g.fillStyle = '#fff1b0'; g.beginPath(); g.arc(300, 400, 120, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,241,176,0.25)'; g.beginPath(); g.arc(300, 400, 175, 0, 7); g.fill();
      g.restore();
      // clouds
      g.fillStyle = 'rgba(255,214,235,0.75)';
      for (const [x, y, s] of [[80, 120, 1], [520, 80, 0.8], [1080, 140, 1.1]]) { g.beginPath(); g.ellipse(x, y, 90 * s, 18 * s, 0, 0, 7); g.ellipse(x + 50 * s, y - 12 * s, 60 * s, 16 * s, 0, 0, 7); g.fill(); }
      // the sea
      g.fillStyle = vgrad(g, [[0, '#7a3fd0'], [1, '#3a1a8a']], 400, 560); g.fillRect(0, 400, W, 160);
      g.fillStyle = 'rgba(255,241,176,0.55)';
      for (let y = 410, i = 0; y < 540; y += 16, i++) { const w = 220 - i * 18; g.fillRect(300 - w / 2 + (i % 2) * 14, y, w, 4); }
      // the sand
      g.beginPath(); g.moveTo(0, 560); g.bezierCurveTo(400, 530, 900, 545, W, 560); g.lineTo(W, H); g.lineTo(0, H); g.closePath();
      fillStroke(g, '#ffd99a', 5);
      halftone(g, 0, 570, W, H, 'rgba(176,122,79,0.35)', { step: 18, max: 3.2, cx: 640, cy: 720, reach: 900 });
      // a palm tree on the right edge
      g.lineWidth = 22; g.strokeStyle = '#6b3f22'; g.lineCap = 'round';
      g.beginPath(); g.moveTo(1240, 720); g.quadraticCurveTo(1200, 450, 1225, 230); g.stroke();
      g.lineWidth = 4; g.strokeStyle = INK; g.stroke();
      g.lineCap = 'butt';
      for (const [a, l] of [[-2.7, 170], [-2.1, 150], [-1.2, 140], [-0.5, 160], [0.2, 120]]) {
        g.beginPath(); g.moveTo(1225, 230);
        g.quadraticCurveTo(1225 + Math.cos(a) * l * 0.6, 230 + Math.sin(a) * l * 0.6 - 40, 1225 + Math.cos(a) * l, 230 + Math.sin(a) * l + 30);
        g.quadraticCurveTo(1225 + Math.cos(a) * l * 0.5, 230 + Math.sin(a) * l * 0.5 - 10, 1225, 236);
        fillStroke(g, '#2fbf7a', 4);
      }
      // a towel and a little crab on the sand
      g.save(); g.translate(150, 640); g.rotate(-0.08); rrect(g, -110, -26, 220, 52, 8); fillStroke(g, '#3ff0c3', 4);
      g.fillStyle = 'rgba(255,255,255,0.7)'; for (let x = -90; x < 110; x += 40) g.fillRect(x, -26, 14, 52); g.restore();
    },
    ambient: [
      ...[0, 1, 2].map((i) => ({ cls: 'wave-line', x: 60 + i * 400, y: 470 + (i % 2) * 26, delay: i * 1.3 })),
      { cls: 'gull', x: 520, y: 150 }, { cls: 'gull', x: 600, y: 120, delay: 0.7 },
    ],
  },

  // her gaming room: RGB lights, a big monitor's glow, posters, a neon LIVE sign
  gaming: {
    name: 'my gaming room', accent: '#3ff0c3',
    draw(g) {
      g.fillStyle = vgrad(g, [[0, '#14102e'], [1, '#0b0820']]); g.fillRect(0, 0, W, H);
      // acoustic foam panels
      for (let y = 90; y < 470; y += 64) for (let x = 40; x < 400; x += 64) { rrect(g, x, y, 56, 56, 8); fillStroke(g, (x + y) % 128 ? '#2a1f5c' : '#33266e', 2, '#0b0820'); }
      // a big monitor's glow (left) and a desk at the bottom
      const glow = g.createRadialGradient(240, 560, 20, 240, 560, 420);
      glow.addColorStop(0, 'rgba(63,240,195,0.35)'); glow.addColorStop(1, 'rgba(63,240,195,0)');
      g.fillStyle = glow; g.fillRect(0, 200, 700, 520);
      g.beginPath(); g.moveTo(0, 610); g.lineTo(W, 610); g.lineTo(W, H); g.lineTo(0, H); g.closePath(); fillStroke(g, '#241b48', 5);
      // posters on the right
      rrect(g, 1130, 100, 130, 180, 8); fillStroke(g, '#6b3bff', 4);
      star(g, 1195, 170, 40, '#ffc933', 4);
      text(g, 'LVL 99', 1195, 255, { size: 24, color: '#fff', align: 'center', font: 'mono', weight: 800 });
      rrect(g, 1150, 310, 110, 140, 8); fillStroke(g, '#ff4da6', 4);
      heart(g, 1205, 370, 28, '#fff', 4);
      text(g, 'GG', 1205, 430, { size: 30, color: INK, align: 'center' });
      // figures on a shelf
      g.fillStyle = '#3a2d70'; g.fillRect(440, 300, 200, 12);
      [['#ff4da6', 470], ['#3ff0c3', 530], ['#ffc933', 590]].forEach(([c, x]) => { rrect(g, x - 14, 254, 28, 46, 8); fillStroke(g, c, 3); g.beginPath(); g.arc(x, 246, 14, 0, 7); fillStroke(g, c, 3); });
      // the neon LIVE sign (its glow: .amb)
      text(g, 'LIVE', 540, 200, { size: 64, color: '#ff9cd8', align: 'center', stroke: 0 });
    },
    ambient: [
      { cls: 'rgb-strip', x: 0, y: 70 }, { cls: 'rgb-strip bottom', x: 0, y: 598 },
      { cls: 'neon live', x: 540, y: 178 },
    ],
  },

  // a concert stage, for her song: an LED wall, a truss with spotlights, the crowd's hands
  stage: {
    name: 'the stage', accent: '#ffc933',
    draw(g) {
      g.fillStyle = vgrad(g, [[0, '#07041a'], [1, '#1a0b45']]); g.fillRect(0, 0, W, H);
      // the LED wall behind her: a dotted grid in violet and pink
      rrect(g, 60, 70, 1160, 470, 10); fillStroke(g, '#12093a', 5, '#2a1a5e');
      for (let y = 86; y < 530; y += 14) for (let x = 76; x < 1206; x += 14) {
        const d = Math.hypot(x - 640, (y - 300) * 1.4);
        g.fillStyle = `rgba(${d < 320 ? '255,77,166' : '107,59,255'},${Math.max(0.12, 0.55 - d / 1400)})`;
        g.fillRect(x, y, 6, 6);
      }
      text(g, 'FEEL THE AGI', 340, 170, { size: 70, color: '#ffd1ea', align: 'center', stroke: 0 });
      // the truss across the top
      g.fillStyle = '#9a9ab0'; g.fillRect(0, 30, W, 10); g.fillRect(0, 54, W, 6);
      g.strokeStyle = '#9a9ab0'; g.lineWidth = 3;
      for (let x = 0; x < W; x += 30) { g.beginPath(); g.moveTo(x, 40); g.lineTo(x + 15, 54); g.lineTo(x + 30, 40); g.stroke(); }
      for (const x of [150, 420, 860, 1130]) { rrect(g, x - 18, 58, 36, 30, 6); fillStroke(g, '#2c2c40', 3); }
      // the stage floor at the bottom
      g.fillStyle = vgrad(g, [[0, '#2a1a5e'], [1, '#120a33']], 560, H); g.fillRect(0, 560, W, 160);
      g.fillStyle = INK; g.fillRect(0, 556, W, 8);
    },
    ambient: [
      ...[150, 420, 1130].map((x, i) => ({ cls: `beam c${i % 3}`, x, y: 84, delay: i * 0.7 })),
      ...Array.from({ length: 16 }, (_, i) => ({ cls: 'crowd-hand', x: 20 + i * 82 + (i % 2) * 20, y: 600 + (i % 3) * 14, delay: (i * 0.23) % 0.9 })),
      { cls: 'stage-flash', x: 0, y: 0 },
    ],
  },
};
export const ROOM_IDS = Object.keys(ROOMS);
// the rooms she moves between during a show (the stage is only for her song)
export const SHOW_ROOMS = ['studio', 'bedroom', 'cafe', 'rooftop', 'beach', 'gaming'];

// Draws a room on the set's background canvas
export function drawRoom(id, canvas) {
  const room = ROOMS[id] || ROOMS.studio;
  const g = canvas.getContext('2d');
  g.save();
  g.clearRect(0, 0, W, H);
  room.draw(g);
  g.restore();
  return room;
}
// Its moving bits: plain elements in the ambient layer (stage.css .amb), each placed by its own CSS variables
export function fillAmbient(id, el) {
  const room = ROOMS[id] || ROOMS.studio;
  fillAmbientList(room.ambient, el, id);
}
// (2026-10-07) the same for a place or a trip's scene (places.js): a list of { cls, x, y, delay }
export function fillAmbientList(list, el, id = '') {
  el.replaceChildren(...list.map((a) => {
    const d = document.createElement('i');
    d.className = a.cls;
    d.style.setProperty('--x', `${a.x}px`);
    d.style.setProperty('--y', `${a.y}px`);
    d.style.setProperty('--d', `${-(a.delay || 0)}s`);
    return d;
  }));
  el.dataset.room = id;
}
