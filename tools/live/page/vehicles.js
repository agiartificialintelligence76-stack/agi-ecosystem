// AGI-1's live show (2026-10-07, the owner: "you can put vehicles also like robotaxi. i have an idea to she can ride the
// vehicles as well and go to places"): the vehicles she rides on her trips, drawn in code in the set's comic look (flat
// colors, ink outlines; no brands or logos: her own "AGI" and a heart are the only marks). Each is drawn in two layers: what's
// behind her (the inside: a seat, the far side) on a canvas under her picture, and what's in front of her (the body, the
// window's frame and glass) on a canvas over it, a little see-through (stage.js says why nothing plain and opaque may cover
// her picture). She sits in its seat (scaled down: `seat`), and her picture is cut below its sill line (stage.js), so her
// legs never hang out of a scooter or a balloon's basket.
// A trip (stage.js trip()): the vehicle pulls up beside her, she hops in, it drives off; the travel scene (its own backdrop
// and things passing by, the route card); then it pulls up at the place, she hops out, it drives away.
import { INK, rnd, vgrad, rrect, fillStroke, heart, star, text } from './rooms.js';

const GLASS = 'rgba(190,225,255,0.16)';
// a window: its glass (light, she's seen through it) and a frame; a soft shine only in its top corner (never over her face)
function glass(g, path, frame = 6) {
  path(); g.fillStyle = GLASS; g.fill();
  g.save(); path(); g.clip();
  g.fillStyle = 'rgba(255,255,255,0.28)';
  const b = path.box;
  if (b) { g.beginPath(); g.moveTo(b.x + b.w - 70, b.y); g.lineTo(b.x + b.w - 40, b.y); g.lineTo(b.x + b.w, b.y + 40); g.lineTo(b.x + b.w, b.y + 70); g.closePath(); g.fill(); }
  g.restore();
  path(); g.lineWidth = frame; g.strokeStyle = INK; g.stroke();
}
const rectPath = (g, x, y, w, h, r = 14) => { const f = () => rrect(g, x, y, w, h, r); f.box = { x, y, w, h }; return f; };
// a wheel, drawn on its own small canvas (it turns: stage.css .veh-wheel, turned by vehicles' frame())
export function drawWheel(g, r, { rim = '#d9d9e6', hub = '#ff4da6' } = {}) {
  g.save(); g.translate(r + 4, r + 4);
  g.beginPath(); g.arc(0, 0, r, 0, 7); g.fillStyle = '#26203f'; g.fill(); g.lineWidth = 5; g.strokeStyle = INK; g.stroke();
  g.beginPath(); g.arc(0, 0, r * 0.58, 0, 7); g.fillStyle = rim; g.fill(); g.lineWidth = 3; g.stroke();
  g.strokeStyle = 'rgba(23,10,54,0.55)'; g.lineWidth = 3;
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(a) * r * 0.16, Math.sin(a) * r * 0.16); g.lineTo(Math.cos(a) * r * 0.54, Math.sin(a) * r * 0.54); g.stroke(); }
  g.beginPath(); g.arc(0, 0, r * 0.16, 0, 7); g.fillStyle = hub; g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke();
  g.restore();
}

// ---------- the vehicles ----------
// w, h: its canvases' size (px) · seat: where her eyes go (px in it) and her scale · sill: her picture is cut below this line
// (px in it) · wheels: [x, y, r] (their centres) · kind: its travel scene (road, rail, sky, sea, cable, space) · name: what she
// calls it · back(g), front(g): its two layers
const car = ({ body, stripe, roof, sign = null }) => ({
  w: 900, h: 400, seat: { x: 528, y: 172, s: 0.42 }, sill: 262, wheels: [[208, 336, 54], [690, 336, 54]], kind: 'road',
  back(g) {
    // the inside, seen only through its windows
    g.save(); g.beginPath();
    g.moveTo(410, 92); g.lineTo(410, 262); g.lineTo(648, 262); g.lineTo(648, 92); g.closePath();
    g.moveTo(222, 108); g.lineTo(178, 214); g.lineTo(386, 214); g.lineTo(386, 92); g.lineTo(240, 92); g.closePath();
    g.moveTo(672, 92); g.lineTo(672, 214); g.lineTo(776, 214); g.lineTo(686, 104); g.closePath();
    g.clip();
    g.fillStyle = '#3a2d6b'; g.fillRect(150, 80, 660, 200);
    g.fillStyle = '#5b46a8'; rrect(g, 420, 150, 200, 130, 20); g.fill();            // her seat's back
    g.restore();
  },
  front(g) {
    // the body: a rounded cabin on a long base
    g.beginPath();
    g.moveTo(44, 300); g.lineTo(44, 248); g.quadraticCurveTo(48, 222, 120, 214); g.lineTo(156, 214); g.lineTo(206, 96); g.quadraticCurveTo(214, 78, 240, 78);
    g.lineTo(640, 78); g.quadraticCurveTo(668, 78, 690, 100); g.lineTo(790, 214); g.quadraticCurveTo(856, 220, 862, 252); g.lineTo(862, 300);
    g.quadraticCurveTo(862, 334, 830, 334); g.lineTo(70, 334); g.quadraticCurveTo(44, 334, 44, 300); g.closePath();
    // (the windows cut out: drawn as holes with even-odd filling)
    g.moveTo(410, 92); g.lineTo(410, 262); g.lineTo(648, 262); g.lineTo(648, 92); g.closePath();
    g.moveTo(222, 108); g.lineTo(178, 214); g.lineTo(386, 214); g.lineTo(386, 92); g.lineTo(240, 92); g.closePath();
    g.moveTo(672, 92); g.lineTo(672, 214); g.lineTo(776, 214); g.lineTo(686, 104); g.closePath();
    g.fillStyle = body; g.fill('evenodd'); g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
    glass(g, rectPath(g, 410, 92, 238, 170, 6), 5);
    glass(g, () => { g.beginPath(); g.moveTo(222, 108); g.lineTo(178, 214); g.lineTo(386, 214); g.lineTo(386, 92); g.lineTo(240, 92); g.closePath(); }, 5);
    glass(g, () => { g.beginPath(); g.moveTo(672, 92); g.lineTo(672, 214); g.lineTo(776, 214); g.lineTo(686, 104); g.closePath(); }, 5);
    // the stripe, the door line, a handle, the lights, her name on the door
    g.fillStyle = stripe; g.fillRect(48, 282, 810, 16);
    g.strokeStyle = 'rgba(23,10,54,0.45)'; g.lineWidth = 3; g.beginPath(); g.moveTo(398, 262); g.lineTo(398, 330); g.moveTo(660, 214); g.lineTo(660, 330); g.stroke();
    rrect(g, 600, 230, 38, 10, 5); fillStroke(g, '#2b2350', 2);
    rrect(g, 824, 238, 34, 26, 8); fillStroke(g, '#fff6b8', 3);
    rrect(g, 46, 236, 22, 26, 6); fillStroke(g, '#ff5a6a', 3);
    text(g, 'AGI', 300, 266, { size: 34, color: INK, align: 'center' });
    heart(g, 350, 256, 10, '#ff4da6', 2);
    // on the roof: her robotaxi's sensor (a little spinning dome) or a taxi sign
    if (sign) {
      rrect(g, 380, 44, 150, 40, 10); fillStroke(g, sign, 4);
      text(g, 'TAXI', 455, 76, { size: 26, color: INK, align: 'center' });
    } else {
      rrect(g, 430, 52, 90, 28, 10); fillStroke(g, roof, 4);
      g.beginPath(); g.ellipse(475, 50, 30, 16, 0, 0, 7); fillStroke(g, '#2b2350', 4);
      g.fillStyle = '#3ff0c3'; g.fillRect(452, 44, 46, 6);
      for (const sx of [204, 690]) { rrect(g, sx - 10, 70, 20, 14, 5); fillStroke(g, '#2b2350', 2); }
    }
  },
});

export const VEHICLES = {
  // her robotaxi: no driver, a sensor dome on the roof
  robotaxi: { name: 'my robotaxi', ...car({ body: '#f6f4ff', stripe: '#ff4da6', roof: '#e4d9ff' }) },
  // a yellow cab (New York's look, her own: no company)
  taxi: { name: 'a yellow cab', ...car({ body: '#ffcf2e', stripe: '#170a36', roof: '#ffe27a', sign: '#fff6d0' }) },

  // a red double-decker bus: she sits up front on the top deck
  bus: {
    name: 'a double-decker bus', w: 980, h: 560, seat: { x: 300, y: 150, s: 0.42 }, sill: 236, wheels: [[220, 506, 56], [780, 506, 56]], kind: 'road',
    back(g) { g.fillStyle = '#3a2d6b'; g.fillRect(150, 70, 700, 180); g.fillStyle = '#7a2b3a'; rrect(g, 210, 140, 180, 110, 16); g.fill(); },
    front(g) {
      g.beginPath(); rrect(g, 40, 40, 900, 470, 40);
      g.moveTo(170, 62); g.lineTo(170, 236); g.lineTo(440, 236); g.lineTo(440, 62); g.closePath();
      for (const x of [470, 640]) { g.moveTo(x, 62); g.lineTo(x, 216); g.lineTo(x + 150, 216); g.lineTo(x + 150, 62); g.closePath(); }
      for (const x of [170, 360, 550, 740]) { g.moveTo(x, 292); g.lineTo(x, 400); g.lineTo(x + 160, 400); g.lineTo(x + 160, 292); g.closePath(); }
      g.fillStyle = '#e8343f'; g.fill('evenodd'); g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
      glass(g, rectPath(g, 170, 62, 270, 174, 8), 5);
      for (const x of [470, 640]) glass(g, rectPath(g, x, 62, 150, 154, 8), 4);
      for (const x of [170, 360, 550, 740]) glass(g, rectPath(g, x, 292, 160, 108, 8), 4);
      g.fillStyle = '#ffc933'; g.fillRect(44, 252, 892, 22);
      text(g, 'AGI', 860, 266, { size: 20, color: INK, align: 'right' });
      // the front: its door and lights (on the left: it drives to the left? no: to the right; the driver's front on the right)
      rrect(g, 880, 300, 50, 110, 10); fillStroke(g, '#b8262f', 4);
      rrect(g, 900, 440, 32, 26, 8); fillStroke(g, '#fff6b8', 3);
      rrect(g, 44, 440, 22, 26, 6); fillStroke(g, '#ffd27a', 3);
      text(g, '1', 900, 110, { size: 40, color: '#fff', align: 'center' });
    },
  },

  // a scooter: she sits on it (her picture cut at the seat)
  scooter: {
    name: 'a scooter', w: 560, h: 420, seat: { x: 230, y: 40, s: 0.44 }, sill: 262, wheels: [[110, 366, 46], [450, 366, 46]], kind: 'road',
    back(g) { /* (nothing behind her: it's open) */ },
    front(g) {
      // the body under the seat, the floorboard, the front shield and handlebar
      g.beginPath(); g.moveTo(60, 330); g.quadraticCurveTo(60, 250, 150, 250); g.lineTo(320, 250); g.quadraticCurveTo(360, 252, 368, 300); g.lineTo(380, 330); g.closePath();
      fillStroke(g, '#3ff0c3', 5);
      rrect(g, 120, 236, 210, 30, 14); fillStroke(g, '#5b2a8a', 4);                    // the seat
      g.beginPath(); g.moveTo(360, 330); g.lineTo(410, 140); g.quadraticCurveTo(420, 110, 452, 120); g.lineTo(470, 132); g.lineTo(440, 330); g.closePath(); fillStroke(g, '#3ff0c3', 5);
      g.lineWidth = 8; g.strokeStyle = INK; g.lineCap = 'round'; g.beginPath(); g.moveTo(420, 120); g.lineTo(380, 96); g.stroke(); g.lineCap = 'butt';
      rrect(g, 360, 84, 40, 20, 8); fillStroke(g, '#2b2350', 3);
      g.beginPath(); g.arc(470, 170, 16, 0, 7); fillStroke(g, '#fff6b8', 3);
      g.lineWidth = 6; g.strokeStyle = INK; g.beginPath(); g.moveTo(110, 366); g.lineTo(150, 300); g.moveTo(450, 366); g.lineTo(430, 300); g.stroke();
      heart(g, 240, 300, 14, '#ff4da6', 3);
    },
  },

  // a hot-air balloon: she stands in its basket (her picture cut at its rim)
  balloon: {
    name: 'a hot-air balloon', w: 560, h: 900, seat: { x: 280, y: 520, s: 0.5 }, sill: 742, wheels: [], kind: 'sky', sound: 'balloon',
    back(g) { g.fillStyle = '#8a5a3c'; rrect(g, 160, 730, 240, 40, 10); g.fill(); },
    front(g) {
      // the envelope: stripes in her colors
      const cx = 280, cy = 230;
      g.save(); g.beginPath(); g.ellipse(cx, cy, 250, 230, 0, 0, 7); g.moveTo(cx - 200, cy + 130); g.quadraticCurveTo(cx - 90, cy + 300, cx - 50, cy + 330); g.lineTo(cx + 50, cy + 330); g.quadraticCurveTo(cx + 90, cy + 300, cx + 200, cy + 130);
      g.clip();
      const cols = ['#ff4da6', '#ffc933', '#6b3bff', '#3ff0c3', '#ff4da6', '#ffc933', '#6b3bff'];
      for (let i = 0; i < 7; i++) { g.fillStyle = cols[i]; g.fillRect(cx - 250 + i * 72, 0, 72, 600); }
      g.restore();
      g.beginPath(); g.ellipse(cx, cy, 250, 230, 0, 0, 7); g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
      heart(g, cx, cy, 44, '#fff', 5);
      rrect(g, cx - 54, cy + 322, 108, 26, 8); fillStroke(g, '#8a5a3c', 4);
      // the ropes, the basket
      g.strokeStyle = INK; g.lineWidth = 3;
      for (const [a, b] of [[cx - 50, 170], [cx + 50, 390], [cx - 30, 230], [cx + 30, 330]]) { g.beginPath(); g.moveTo(a, cy + 346); g.lineTo(b, 742); g.stroke(); }
      g.beginPath(); g.moveTo(150, 742); g.lineTo(410, 742); g.lineTo(392, 880); g.lineTo(168, 880); g.closePath(); fillStroke(g, '#c98a4a', 6);
      g.strokeStyle = 'rgba(23,10,54,0.35)'; g.lineWidth = 3;
      for (let y = 770; y < 880; y += 22) { g.beginPath(); g.moveTo(158, y); g.lineTo(402, y); g.stroke(); }
      for (let x = 180; x < 400; x += 30) { g.beginPath(); g.moveTo(x, 744); g.lineTo(x - 2, 878); g.stroke(); }
      rrect(g, 140, 734, 280, 18, 8); fillStroke(g, '#8a5a3c', 4);
    },
  },

  // a train: she rides up front by its big window
  train: {
    name: 'a fast train', w: 1100, h: 360, seat: { x: 740, y: 160, s: 0.42 }, sill: 252, wheels: [[220, 330, 30], [320, 330, 30], [760, 330, 30], [860, 330, 30]], kind: 'rail',
    back(g) { g.fillStyle = '#3a2d6b'; g.fillRect(560, 80, 380, 180); g.fillStyle = '#5b46a8'; rrect(g, 640, 140, 180, 120, 16); g.fill(); },
    front(g) {
      // a long white body with a rounded nose to the right, a pink stripe
      g.beginPath(); g.moveTo(20, 80); g.lineTo(820, 80); g.bezierCurveTo(960, 80, 1060, 170, 1080, 290); g.lineTo(1080, 318); g.lineTo(20, 318); g.closePath();
      g.moveTo(640, 92); g.lineTo(640, 252); g.lineTo(860, 252); g.lineTo(860, 92); g.closePath();
      for (const x of [60, 200, 340, 480]) { g.moveTo(x, 120); g.lineTo(x, 200); g.lineTo(x + 110, 200); g.lineTo(x + 110, 120); g.closePath(); }
      g.moveTo(890, 100); g.bezierCurveTo(960, 104, 1010, 150, 1030, 200); g.lineTo(890, 200); g.closePath();
      g.fillStyle = '#f7f6ff'; g.fill('evenodd'); g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
      glass(g, rectPath(g, 640, 92, 220, 160, 10), 5);
      for (const x of [60, 200, 340, 480]) glass(g, rectPath(g, x, 120, 110, 80, 10), 4);
      glass(g, () => { g.beginPath(); g.moveTo(890, 100); g.bezierCurveTo(960, 104, 1010, 150, 1030, 200); g.lineTo(890, 200); g.closePath(); }, 4);
      g.fillStyle = '#ff4da6'; g.fillRect(24, 262, 1040, 16);
      g.fillStyle = '#6b3bff'; g.fillRect(24, 282, 1046, 10);
      rrect(g, 1036, 248, 30, 20, 8); fillStroke(g, '#fff6b8', 3);
      text(g, 'AGI', 120, 250, { size: 30, color: INK });
      g.fillStyle = '#2b2350'; g.fillRect(20, 318, 1060, 18);
    },
  },

  // a little boat with a cabin
  boat: {
    name: 'a little boat', w: 800, h: 430, seat: { x: 390, y: 150, s: 0.42 }, sill: 250, wheels: [], kind: 'sea', sound: 'boat',
    back(g) { g.fillStyle = '#3a2d6b'; g.fillRect(270, 80, 250, 170); },
    front(g) {
      // the cabin and its roof, a flag with her heart
      g.beginPath(); g.moveTo(240, 250); g.lineTo(240, 74); g.lineTo(560, 74); g.lineTo(560, 250); g.closePath();
      g.moveTo(278, 92); g.lineTo(278, 250); g.lineTo(512, 250); g.lineTo(512, 92); g.closePath();
      g.fillStyle = '#fff4e0'; g.fill('evenodd'); g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
      glass(g, rectPath(g, 278, 92, 234, 158, 10), 5);
      rrect(g, 220, 48, 360, 34, 12); fillStroke(g, '#ff4da6', 5);
      g.fillStyle = INK; g.fillRect(546, -10, 6, 70);
      g.beginPath(); g.moveTo(552, -8); g.lineTo(610, 10); g.lineTo(552, 30); g.closePath(); fillStroke(g, '#6b3bff', 3);
      // the hull, its stripe and a life ring
      g.beginPath(); g.moveTo(30, 240); g.lineTo(780, 240); g.lineTo(700, 400); g.quadraticCurveTo(690, 420, 660, 420); g.lineTo(150, 420); g.quadraticCurveTo(120, 420, 110, 400); g.closePath(); fillStroke(g, '#3a7bd5', 6);
      g.fillStyle = '#fff'; g.fillRect(70, 286, 690, 16);
      g.beginPath(); g.arc(620, 340, 30, 0, 7); g.lineWidth = 12; g.strokeStyle = '#ff5a3d'; g.stroke(); g.lineWidth = 3; g.strokeStyle = INK; g.beginPath(); g.arc(620, 340, 36, 0, 7); g.arc(620, 340, 24, 0, 7); g.stroke();
      text(g, 'AGI', 180, 380, { size: 36, color: '#fff' });
    },
  },

  // a tuk-tuk: three wheels, a canopy, open sides
  tuktuk: {
    name: 'a tuk-tuk', w: 680, h: 460, seat: { x: 370, y: 198, s: 0.42 }, sill: 286, wheels: [[150, 410, 40], [560, 410, 40]], kind: 'road', sound: 'tuktuk',
    back(g) { g.fillStyle = '#5b46a8'; rrect(g, 290, 200, 170, 110, 16); g.fill(); },
    front(g) {
      // the canopy and its posts
      g.beginPath(); g.moveTo(90, 100); g.quadraticCurveTo(110, 50, 200, 46); g.lineTo(560, 46); g.quadraticCurveTo(620, 50, 640, 110); g.lineTo(640, 128); g.lineTo(90, 128); g.closePath(); fillStroke(g, '#2e8a63', 6);
      g.fillStyle = '#ffc933'; for (let x = 104; x < 636; x += 40) { g.beginPath(); g.moveTo(x, 128); g.lineTo(x + 20, 144); g.lineTo(x + 40, 128); g.fill(); }
      g.fillStyle = INK; g.fillRect(110, 128, 10, 170); g.fillRect(600, 128, 10, 170);
      // the body: the back seat's box, the driver's front, the windshield
      g.beginPath(); g.moveTo(70, 286); g.lineTo(520, 286); g.lineTo(560, 230); g.lineTo(640, 230); g.lineTo(650, 380); g.quadraticCurveTo(650, 400, 630, 400); g.lineTo(90, 400); g.quadraticCurveTo(70, 400, 70, 380); g.closePath();
      fillStroke(g, '#ff5a3d', 6);
      g.fillStyle = '#ffc933'; g.fillRect(74, 330, 572, 14);
      glass(g, () => { g.beginPath(); g.moveTo(560, 140); g.lineTo(620, 140); g.lineTo(640, 228); g.lineTo(560, 228); g.closePath(); }, 4);
      g.beginPath(); g.arc(648, 300, 14, 0, 7); fillStroke(g, '#fff6b8', 3);
      heart(g, 300, 362, 12, '#fff', 3);
    },
  },

  // a jeepney: long, colorful, open windows, a roof rack
  jeepney: {
    name: 'a jeepney', w: 1000, h: 440, seat: { x: 560, y: 186, s: 0.42 }, sill: 272, wheels: [[200, 392, 46], [800, 392, 46]], kind: 'road', sound: 'jeepney',
    back(g) { g.fillStyle = '#3a2d6b'; g.fillRect(150, 110, 640, 170); g.fillStyle = '#7a2b6a'; rrect(g, 480, 170, 160, 110, 14); g.fill(); },
    front(g) {
      g.beginPath(); g.moveTo(40, 100); g.lineTo(820, 100); g.lineTo(860, 160); g.lineTo(960, 200); g.lineTo(960, 360); g.quadraticCurveTo(960, 384, 936, 384); g.lineTo(64, 384); g.quadraticCurveTo(40, 384, 40, 360); g.closePath();
      for (const x of [120, 310, 470, 650]) { g.moveTo(x, 130); g.lineTo(x, 272); g.lineTo(x + (x === 470 ? 160 : 140), 272); g.lineTo(x + (x === 470 ? 160 : 140), 130); g.closePath(); }
      g.fillStyle = '#d9dbe8'; g.fill('evenodd'); g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
      for (const x of [120, 310, 470, 650]) { const w = x === 470 ? 160 : 140; g.lineWidth = 4; g.strokeStyle = INK; g.strokeRect(x, 130, w, 142); }
      // its stripes and colors, the roof rack
      const cols = ['#ff4da6', '#ffc933', '#3ff0c3', '#6b3bff', '#ff8a3d'];
      for (let i = 0; i < 5; i++) { g.fillStyle = cols[i]; g.fillRect(44 + i * 180, 286, 180, 24); }
      g.fillStyle = '#ff4da6'; g.fillRect(44, 316, 912, 10);
      g.fillStyle = '#ffc933'; g.fillRect(44, 104, 772, 14);
      g.strokeStyle = INK; g.lineWidth = 4; g.strokeRect(80, 70, 700, 30); for (let x = 100; x < 780; x += 40) { g.beginPath(); g.moveTo(x, 70); g.lineTo(x, 100); g.stroke(); }
      g.beginPath(); g.arc(940, 250, 16, 0, 7); fillStroke(g, '#fff6b8', 3);
      text(g, 'AGI-1', 260, 360, { size: 30, color: INK });
      star(g, 860, 330, 16, '#ffc933', 3);
    },
  },

  // a cable car: a gondola hanging from its cable
  cablecar: {
    name: 'a cable car', w: 420, h: 560, seat: { x: 210, y: 300, s: 0.42 }, sill: 396, wheels: [], kind: 'cable', sound: 'cablecar', hangs: true,
    back(g) { g.fillStyle = '#3a2d6b'; g.fillRect(70, 220, 280, 190); },
    front(g) {
      // the hanger to the cable at the top
      g.lineWidth = 10; g.strokeStyle = INK; g.beginPath(); g.moveTo(210, 30); g.lineTo(210, 200); g.stroke();
      rrect(g, 160, 14, 100, 34, 10); fillStroke(g, '#c9c9d9', 4);
      g.beginPath(); g.arc(186, 30, 10, 0, 7); g.arc(234, 30, 10, 0, 7); fillStroke(g, '#2b2350', 3);
      // the gondola: a rounded box with big windows
      g.beginPath(); rrect(g, 40, 190, 340, 340, 44);
      g.moveTo(74, 222); g.lineTo(74, 396); g.lineTo(346, 396); g.lineTo(346, 222); g.closePath();
      g.fillStyle = '#ffc933'; g.fill('evenodd'); g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
      glass(g, rectPath(g, 74, 222, 272, 174, 18), 5);
      g.fillStyle = '#ff4da6'; g.fillRect(44, 430, 332, 18);
      heart(g, 210, 486, 18, '#fff', 3);
    },
  },

  // a plane (a cartoon one, her own: "AGI AIR"): she's the pilot, up front
  plane: {
    name: 'my plane', w: 1160, h: 460, seat: { x: 900, y: 186, s: 0.4 }, sill: 270, wheels: [], kind: 'sky', sound: 'plane',
    back(g) { g.save(); rrect(g, 820, 120, 190, 150, 26); g.clip(); g.fillStyle = '#3a2d6b'; g.fillRect(800, 110, 230, 170); g.restore(); },
    front(g) {
      // the tail fin with her heart, the wing behind, the body, the cockpit window
      g.beginPath(); g.moveTo(40, 120); g.lineTo(150, 120); g.lineTo(250, 230); g.lineTo(80, 230); g.closePath(); fillStroke(g, '#ff4da6', 6);
      heart(g, 130, 170, 22, '#fff', 3);
      g.beginPath(); g.moveTo(560, 300); g.lineTo(700, 300); g.lineTo(560, 440); g.lineTo(450, 440); g.closePath(); fillStroke(g, '#c9c9e6', 6);
      g.beginPath(); g.moveTo(60, 230); g.lineTo(820, 230); g.quadraticCurveTo(830, 100, 930, 96); g.quadraticCurveTo(1080, 96, 1130, 250);
      g.quadraticCurveTo(1150, 330, 1060, 340); g.lineTo(140, 340); g.quadraticCurveTo(60, 330, 60, 280); g.closePath();
      g.moveTo(820, 120); g.lineTo(820, 270); g.lineTo(1010, 270); g.lineTo(1010, 120); g.closePath();
      g.fillStyle = '#f7f6ff'; g.fill('evenodd'); g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
      glass(g, rectPath(g, 820, 120, 190, 150, 26), 5);
      g.fillStyle = '#6b3bff'; g.fillRect(64, 290, 1050, 14);
      for (let x = 260; x < 780; x += 64) { g.beginPath(); g.arc(x, 262, 14, 0, 7); fillStroke(g, '#bfe4ff', 3); }
      text(g, 'AGI AIR', 300, 330, { size: 26, color: INK });
      g.beginPath(); g.moveTo(560, 300); g.lineTo(760, 300); g.lineTo(700, 360); g.lineTo(560, 360); g.closePath(); fillStroke(g, '#dcdcf0', 5);
    },
  },

  // a rocket: she looks out of its round window
  rocket: {
    name: 'my rocket', w: 400, h: 720, seat: { x: 200, y: 258, s: 0.38 }, sill: 352, wheels: [], kind: 'space', sound: 'rocket', upright: true,
    back(g) { g.fillStyle = '#2b2350'; g.beginPath(); g.arc(200, 260, 116, 0, 7); g.fill(); },
    front(g) {
      // the body: a nose cone, the round window, fins, the nozzle
      g.beginPath(); g.moveTo(200, 20); g.bezierCurveTo(330, 110, 340, 280, 330, 560); g.lineTo(70, 560); g.bezierCurveTo(60, 280, 70, 110, 200, 20); g.closePath();
      g.moveTo(316, 260); g.arc(200, 260, 116, 0, Math.PI * 2, true); g.closePath();
      g.fillStyle = '#f7f6ff'; g.fill('evenodd'); g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
      glass(g, () => { g.beginPath(); g.arc(200, 260, 116, 0, 7); }, 10);
      g.beginPath(); g.arc(200, 260, 126, 0, 7); g.lineWidth = 6; g.strokeStyle = '#6b3bff'; g.stroke();
      g.beginPath(); g.moveTo(200, 20); g.bezierCurveTo(260, 60, 290, 100, 300, 130); g.lineTo(100, 130); g.bezierCurveTo(110, 100, 140, 60, 200, 20); g.closePath(); fillStroke(g, '#ff4da6', 5);
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(200 + s * 128, 430); g.lineTo(200 + s * 190, 600); g.lineTo(200 + s * 128, 580); g.closePath(); fillStroke(g, '#ff4da6', 5); }
      g.beginPath(); g.moveTo(130, 560); g.lineTo(270, 560); g.lineTo(250, 600); g.lineTo(150, 600); g.closePath(); fillStroke(g, '#8a8aa8', 5);
      text(g, 'AGI-1', 200, 470, { size: 34, color: INK, align: 'center' });
      heart(g, 200, 510, 14, '#ff4da6', 3);
    },
  },
};
export const VEHICLE_IDS = Object.keys(VEHICLES);

// ---------- on the set: the two layers, its wheels, where it is, how it moves ----------
// back, front: two elements on her set (stage.css .veh: back under her picture, front over it). Each vehicle's layers are
// drawn once, the first time it's needed, then only moved (CSS transforms): cheap for a server without a graphics card.
export function createVehicles({ back, front }) {
  const made = {};
  function make(id) {
    if (made[id]) return made[id];
    const v = VEHICLES[id];
    const canvas = (draw) => { const c = document.createElement('canvas'); c.width = v.w; c.height = v.h; c.className = 'veh-pic'; const g = c.getContext('2d'); g.lineJoin = 'round'; draw(g); return c; };
    const b = canvas((g) => v.back(g)), f = canvas((g) => v.front(g));
    const wheels = v.wheels.map(([x, y, r]) => {
      const c = document.createElement('canvas'); c.width = c.height = 2 * r + 8; c.className = 'veh-wheel';
      drawWheel(c.getContext('2d'), r);
      c.style.left = `${x - r - 4}px`; c.style.top = `${y - r - 4}px`;
      return { c, r, a: 0 };
    });
    made[id] = { v, b, f, wheels };
    return made[id];
  }
  let cur = null;                  // { id, m, x, y, k, tween, bob, speed, t }
  // k: its size (1 as drawn). over: its body over her (she's in it) or behind her (it pulls up behind her: she isn't in yet)
  function show(id, { x = 0, y = 0, k = 1, over = false } = {}) {
    if (!VEHICLES[id]) return false;
    hide();
    const m = make(id);
    back.replaceChildren(m.b);
    front.replaceChildren();
    for (const el of [back, front]) { el.style.width = `${m.v.w}px`; el.style.height = `${m.v.h}px`; el.hidden = false; }
    cur = { id, m, x, y, k, tween: null, bob: 0, speed: 0, t: 0, flame: 0 };
    layer(over);
    place();
    return true;
  }
  function layer(over) {
    if (!cur) return false;
    const parts = [cur.m.f, ...cur.m.wheels.map((w) => w.c)];
    if (over) front.replaceChildren(...parts); else back.append(...parts);
    cur.over = Boolean(over);
    return true;
  }
  function hide() {
    cur = null;
    for (const el of [back, front]) { el.hidden = true; el.replaceChildren(); }
  }
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
  // move it to (x, y) over ms; resolves when it's there
  function moveTo(x, y, ms, { easing = ease } = {}) {
    if (!cur) return Promise.resolve(false);
    return new Promise((done) => { cur.tween = { x0: cur.x, y0: cur.y, x1: x, y1: y, t: 0, ms: Math.max(1, ms), easing, done }; });
  }
  function place() {
    if (!cur) return;
    const dy = cur.bob ? Math.sin(cur.t * cur.bob * Math.PI * 2) * 4 : 0;
    const tf = `translate(${Math.round(cur.x)}px, ${Math.round(cur.y + dy)}px)${cur.k !== 1 ? ` scale(${cur.k})` : ''}`;
    back.style.transform = tf; front.style.transform = tf;
    cur.dy = dy;
  }
  function frame(dt) {
    if (!cur) return;
    cur.t += dt;
    let vx = 0;
    if (cur.tween) {
      const tw = cur.tween;
      tw.t += dt * 1000;
      const k = Math.min(1, tw.t / tw.ms), e = tw.easing(k);
      const nx = tw.x0 + (tw.x1 - tw.x0) * e;
      vx = (nx - cur.x) / Math.max(1e-3, dt);
      cur.x = nx; cur.y = tw.y0 + (tw.y1 - tw.y0) * e;
      if (k >= 1) { cur.tween = null; tw.done(true); }
    }
    // its wheels turn with how fast it goes (and with `speed` in the travel scene, where the world moves instead)
    const v = Math.abs(vx) > 1 ? vx : cur.speed;
    for (const w of cur.m.wheels) { w.a += (v * dt) / w.r; w.c.style.transform = `rotate(${(w.a * 180) / Math.PI}deg)`; }
    place();
  }
  return {
    show, hide, moveTo, frame, layer,
    get id() { return cur?.id || null; },
    get def() { return cur ? cur.m.v : null; },
    // bobbing (bobs a second) and its wheels' speed (px a second) while the world moves past it
    travel({ bob = 1.4, speed = 600 } = {}) { if (cur) { cur.bob = bob; cur.speed = speed; } },
    stopTravel() { if (cur) { cur.bob = 0; cur.speed = 0; } },
    // where she sits right now (set px: her eyes, her scale) and its sill line (set px)
    seat() {
      if (!cur) return null;
      const v = cur.m.v, dy = cur.dy || 0, k = cur.k;
      return { x: cur.x + v.seat.x * k, y: cur.y + dy + v.seat.y * k, s: v.seat.s * k, sill: cur.y + dy + v.sill * k };
    },
    get pos() { return cur ? { x: cur.x, y: cur.y, k: cur.k, w: cur.m.v.w * cur.k, h: cur.m.v.h * cur.k } : null; },
    get over() { return Boolean(cur?.over); },
  };
}
