// AGI-1's live show (2026-10-07, the owner: "she can eat food in the stream, alot of types of food"): what she eats on
// stream, drawn in code (160 × 160 each, the comic look: flat colors, ink outlines), in three stages: whole, one bite, two
// bites (a bite is taken out of its top right, the side toward her mouth). Drinks (boba, a coconut) go down a little with
// each sip instead. She holds it in her right hand (on the left of the picture: outfits.js), and her moves bring it to her
// mouth (moves.js ACTIONS.eat). The names are server/live-acts.js FOODS' (the tests check they're the same).
const INK = '#170a36';
const S = 160;
function fs(g, fill, line = 4) { if (fill) { g.fillStyle = fill; g.fill(); } if (line) { g.lineWidth = line; g.strokeStyle = INK; g.stroke(); } }
function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
const dots = (g, list, color, r = 3) => { g.fillStyle = color; for (const [x, y] of list) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } };
const ring = (g, x, y, r1, r2) => { g.beginPath(); g.arc(x, y, r1, 0, 7); g.arc(x, y, r2, 0, 7, true); };

// each: draw(g, sip) (sip: 0..1 how much of a drink is gone) · drink: true for the ones she sips
export const FOODS = {
  cookie: { draw(g) { g.beginPath(); g.arc(80, 80, 56, 0, 7); fs(g, '#d9a05a'); dots(g, [[60, 60], [96, 70], [74, 100], [104, 102], [56, 92]], '#4a2a1a', 7); } },
  donut: { draw(g) { ring(g, 80, 80, 58, 20); fs(g, '#e8b070'); g.beginPath(); g.arc(80, 76, 50, 0, 7); g.arc(80, 76, 22, 0, 7, true); fs(g, '#ff8cc6', 3);
    for (const [x, y, c] of [[54, 52, '#fff'], [100, 50, '#3ff0c3'], [112, 84, '#ffc933'], [52, 100, '#6b3bff'], [94, 112, '#fff']]) { g.save(); g.translate(x, y); g.rotate(x); g.fillStyle = c; g.fillRect(-6, -2, 12, 4); g.restore(); } } },
  berliner: { draw(g) { g.beginPath(); g.ellipse(80, 84, 60, 50, 0, 0, 7); fs(g, '#d99a52'); g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.ellipse(80, 62, 44, 18, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(112, 92, 10, 6, 0, 0, 7); fs(g, '#d0213f', 2); } },
  cupcake: { draw(g) { g.beginPath(); g.moveTo(40, 86); g.lineTo(120, 86); g.lineTo(108, 144); g.lineTo(52, 144); g.closePath(); fs(g, '#ff9cc0');
    g.beginPath(); g.arc(56, 82, 22, 0, 7); g.arc(104, 82, 22, 0, 7); g.arc(80, 64, 28, 0, 7); fs(g, '#fff6fb'); g.beginPath(); g.arc(80, 38, 10, 0, 7); fs(g, '#e8243f', 3); } },
  strawberry: { draw(g) { g.beginPath(); g.moveTo(80, 150); g.bezierCurveTo(20, 110, 30, 50, 80, 52); g.bezierCurveTo(130, 50, 140, 110, 80, 150); fs(g, '#ff3d5a');
    dots(g, [[64, 80], [96, 80], [80, 100], [60, 112], [100, 112], [80, 128]], '#ffe27a', 3);
    g.beginPath(); g.moveTo(80, 56); g.lineTo(56, 40); g.lineTo(72, 52); g.lineTo(80, 30); g.lineTo(88, 52); g.lineTo(104, 40); g.closePath(); fs(g, '#3fae5a', 3); } },
  apple: { draw(g) { g.beginPath(); g.moveTo(80, 52); g.bezierCurveTo(30, 30, 20, 120, 80, 146); g.bezierCurveTo(140, 120, 130, 30, 80, 52); fs(g, '#ff4d4d');
    g.lineWidth = 6; g.strokeStyle = '#6b4226'; g.beginPath(); g.moveTo(80, 54); g.lineTo(84, 30); g.stroke(); g.beginPath(); g.ellipse(100, 36, 14, 7, -0.5, 0, 7); fs(g, '#3fae5a', 3);
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.ellipse(58, 80, 8, 16, 0.3, 0, 7); g.fill(); } },
  icecream: { draw(g) { g.beginPath(); g.moveTo(52, 82); g.lineTo(108, 82); g.lineTo(80, 154); g.closePath(); fs(g, '#e8b070');
    g.strokeStyle = 'rgba(23,10,54,0.35)'; g.lineWidth = 2; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(56 + k * 12, 84); g.lineTo(86 + k * 4, 130); g.stroke(); }
    g.beginPath(); g.arc(80, 66, 34, 0, 7); fs(g, '#ffd1e8'); g.beginPath(); g.arc(80, 32, 12, 0, 7); fs(g, '#e8243f', 3); } },
  gelato: { draw(g) { g.beginPath(); g.moveTo(52, 86); g.lineTo(108, 86); g.lineTo(80, 154); g.closePath(); fs(g, '#e8b070');
    g.beginPath(); g.arc(68, 74, 26, 0, 7); fs(g, '#9fe0a0'); g.beginPath(); g.arc(94, 70, 26, 0, 7); fs(g, '#fff0c8'); g.beginPath(); g.arc(80, 46, 24, 0, 7); fs(g, '#ff9cc0'); } },
  pizza: { draw(g) { g.beginPath(); g.moveTo(30, 40); g.quadraticCurveTo(80, 20, 130, 40); g.lineTo(80, 150); g.closePath(); fs(g, '#ffd36a');
    g.beginPath(); g.moveTo(26, 40); g.quadraticCurveTo(80, 14, 134, 40); g.lineTo(130, 52); g.quadraticCurveTo(80, 30, 30, 52); g.closePath(); fs(g, '#d9984a');
    dots(g, [[66, 64], [96, 70], [80, 96], [70, 120]], '#e8433f', 9); } },
  hotdog: { draw(g) { g.save(); g.translate(80, 80); g.rotate(-0.5); rr(g, -66, -18, 132, 40, 20); fs(g, '#e8b070'); rr(g, -74, -12, 148, 26, 13); fs(g, '#c9533a');
    g.lineWidth = 4; g.strokeStyle = '#ffc933'; g.beginPath(); for (let x = -56; x <= 56; x += 14) g.lineTo(x, x % 28 ? -4 : 4); g.stroke(); g.restore(); } },
  pretzel: { draw(g) { g.lineWidth = 18; g.strokeStyle = INK; const p = () => { g.beginPath(); g.moveTo(40, 120); g.bezierCurveTo(10, 60, 70, 30, 80, 80); g.bezierCurveTo(90, 30, 150, 60, 120, 120); g.moveTo(44, 120); g.lineTo(116, 70); g.moveTo(116, 120); g.lineTo(44, 70); };
    p(); g.stroke(); g.lineWidth = 12; g.strokeStyle = '#a8642a'; p(); g.stroke(); dots(g, [[50, 64], [112, 64], [80, 96], [62, 110]], '#fff', 2.5); } },
  fishchips: { draw(g) { g.beginPath(); g.moveTo(40, 70); g.lineTo(120, 70); g.lineTo(104, 150); g.lineTo(56, 150); g.closePath(); fs(g, '#ffffff'); g.fillStyle = '#3a7bd5'; g.fillRect(50, 100, 62, 10);
    for (const [x, a] of [[54, -0.3], [68, -0.1], [82, 0.05], [96, 0.2], [108, 0.35]]) { g.save(); g.translate(x, 70); g.rotate(a); rr(g, -6, -46, 12, 50, 4); fs(g, '#ffd36a', 3); g.restore(); }
    g.beginPath(); g.ellipse(70, 50, 30, 16, -0.3, 0, 7); fs(g, '#e8a04a', 3); } },
  croissant: { draw(g) { g.beginPath(); g.moveTo(20, 104); g.bezierCurveTo(30, 40, 130, 40, 140, 104); g.bezierCurveTo(120, 84, 110, 96, 80, 96); g.bezierCurveTo(50, 96, 40, 84, 20, 104); fs(g, '#e8a04a');
    g.strokeStyle = 'rgba(23,10,54,0.45)'; g.lineWidth = 3; for (const x of [52, 80, 108]) { g.beginPath(); g.moveTo(x, 58); g.quadraticCurveTo(x + 4, 76, x, 94); g.stroke(); } } },
  macaron: { draw(g) { g.beginPath(); g.ellipse(80, 64, 52, 26, 0, 0, 7); fs(g, '#ff9cc0'); rr(g, 34, 72, 92, 16, 8); fs(g, '#fff6e8', 3); g.beginPath(); g.ellipse(80, 98, 52, 26, 0, 0, 7); fs(g, '#ff9cc0'); } },
  onigiri: { draw(g) { g.beginPath(); g.moveTo(80, 30); g.quadraticCurveTo(140, 100, 128, 132); g.quadraticCurveTo(80, 150, 32, 132); g.quadraticCurveTo(20, 100, 80, 30); fs(g, '#ffffff');
    rr(g, 54, 100, 52, 46, 6); fs(g, '#20302a', 3); dots(g, [[62, 70], [96, 76], [80, 56]], 'rgba(23,10,54,0.15)', 2); } },
  sushi: { draw(g) { rr(g, 34, 84, 92, 50, 22); fs(g, '#ffffff'); g.beginPath(); g.moveTo(26, 86); g.quadraticCurveTo(80, 40, 134, 86); g.quadraticCurveTo(80, 100, 26, 86); fs(g, '#ff8a5a');
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 4; for (const x of [56, 80, 104]) { g.beginPath(); g.moveTo(x - 8, 70); g.lineTo(x + 8, 84); g.stroke(); } g.fillStyle = '#20302a'; g.fillRect(70, 84, 20, 50); } },
  dango: { draw(g) { g.lineWidth = 6; g.strokeStyle = '#c9a96b'; g.beginPath(); g.moveTo(80, 156); g.lineTo(80, 10); g.stroke();
    for (const [y, c] of [[38, '#ff9cc0'], [78, '#ffffff'], [118, '#9fe0a0']]) { g.beginPath(); g.arc(80, y, 22, 0, 7); fs(g, c); } } },
  fishbun: { draw(g) { g.beginPath(); g.moveTo(24, 80); g.bezierCurveTo(40, 30, 110, 30, 126, 80); g.bezierCurveTo(110, 130, 40, 130, 24, 80); fs(g, '#e8a04a');
    g.beginPath(); g.moveTo(124, 80); g.lineTo(150, 54); g.lineTo(150, 106); g.closePath(); fs(g, '#e8a04a'); g.beginPath(); g.arc(48, 70, 6, 0, 7); fs(g, INK, 0);
    g.strokeStyle = 'rgba(23,10,54,0.35)'; g.lineWidth = 3; for (const x of [70, 86, 102]) { g.beginPath(); g.arc(x, 80, 10, -1, 1); g.stroke(); } } },
  bao: { draw(g) { g.beginPath(); g.moveTo(24, 120); g.quadraticCurveTo(20, 50, 80, 40); g.quadraticCurveTo(140, 50, 136, 120); g.closePath(); fs(g, '#fffaf0');
    g.strokeStyle = 'rgba(23,10,54,0.3)'; g.lineWidth = 3; for (const a of [-0.5, 0, 0.5]) { g.beginPath(); g.moveTo(80, 44); g.lineTo(80 + Math.sin(a) * 50, 90); g.stroke(); } } },
  tanghulu: { draw(g) { g.lineWidth = 6; g.strokeStyle = '#c9a96b'; g.beginPath(); g.moveTo(80, 156); g.lineTo(80, 8); g.stroke();
    for (const y of [30, 64, 98, 130]) { g.beginPath(); g.arc(80, y, 18, 0, 7); fs(g, '#e8243f'); g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.ellipse(74, y - 6, 5, 3, -0.5, 0, 7); g.fill(); } } },
  falafel: { draw(g) { g.beginPath(); g.moveTo(40, 150); g.lineTo(30, 50); g.quadraticCurveTo(80, 20, 130, 50); g.lineTo(120, 150); g.closePath(); fs(g, '#f2e3b8');
    for (const [x, y] of [[60, 52], [96, 50], [78, 36]]) { g.beginPath(); g.arc(x, y, 16, 0, 7); fs(g, '#8a5a2a', 3); } g.beginPath(); g.moveTo(44, 60); g.quadraticCurveTo(80, 70, 116, 60); g.lineWidth = 6; g.strokeStyle = '#3fae5a'; g.stroke(); } },
  dates: { draw(g) { for (const [x, y, a] of [[60, 70, -0.4], [100, 76, 0.3], [78, 108, 0]]) { g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.ellipse(0, 0, 18, 30, 0, 0, 7); fs(g, '#6b3a1a', 3); g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); g.ellipse(-5, -10, 4, 9, 0, 0, 7); g.fill(); g.restore(); } } },
  simit: { draw(g) { ring(g, 80, 80, 58, 26); fs(g, '#b8642a'); g.fillStyle = '#fff4d8'; for (let i = 0; i < 36; i++) { const a = i * 0.9, r = 34 + (i % 4) * 6; g.beginPath(); g.ellipse(80 + Math.cos(a) * r, 80 + Math.sin(a) * r, 3, 1.6, a, 0, 7); g.fill(); } } },
  baklava: { draw(g) { g.beginPath(); g.moveTo(30, 120); g.lineTo(80, 40); g.lineTo(130, 120); g.closePath(); fs(g, '#e8b44a'); g.strokeStyle = 'rgba(23,10,54,0.35)'; g.lineWidth = 2;
    for (let y = 60; y < 120; y += 12) { g.beginPath(); g.moveTo(80 - (y - 40) * 0.62, y); g.lineTo(80 + (y - 40) * 0.62, y); g.stroke(); } dots(g, [[70, 100], [86, 92], [96, 108]], '#5fbf5a', 4); } },
  samosa: { draw(g) { g.beginPath(); g.moveTo(80, 30); g.quadraticCurveTo(140, 110, 134, 132); g.quadraticCurveTo(80, 146, 26, 132); g.quadraticCurveTo(20, 110, 80, 30); fs(g, '#e8a04a');
    g.strokeStyle = 'rgba(23,10,54,0.35)'; g.lineWidth = 3; g.beginPath(); g.moveTo(80, 36); g.lineTo(80, 130); g.stroke(); dots(g, [[60, 110], [100, 106], [80, 80]], 'rgba(23,10,54,0.2)', 3); } },
  mango: { draw(g) { g.lineWidth = 6; g.strokeStyle = '#c9a96b'; g.beginPath(); g.moveTo(80, 156); g.lineTo(80, 70); g.stroke();
    g.beginPath(); g.moveTo(80, 18); g.bezierCurveTo(130, 30, 130, 90, 80, 100); g.bezierCurveTo(30, 90, 30, 30, 80, 18); fs(g, '#ffb02e');
    g.strokeStyle = 'rgba(23,10,54,0.25)'; g.lineWidth = 2; for (let y = 34; y < 96; y += 14) { g.beginPath(); g.moveTo(52, y); g.lineTo(108, y); g.stroke(); } } },
  banhmi: { draw(g) { g.save(); g.translate(80, 80); g.rotate(-0.55); rr(g, -74, -26, 148, 52, 26); fs(g, '#e8a04a'); rr(g, -62, -8, 124, 14, 6); fs(g, '#3fae5a', 3); g.fillStyle = '#ff7a4a'; g.fillRect(-50, -2, 30, 6); g.fillRect(4, -2, 30, 6); g.restore(); } },
  turon: { draw(g) { g.save(); g.translate(80, 80); g.rotate(-0.7); rr(g, -70, -20, 140, 40, 18); fs(g, '#d98a3a'); g.strokeStyle = 'rgba(23,10,54,0.35)'; g.lineWidth = 3; for (const x of [-40, 0, 40]) { g.beginPath(); g.moveTo(x - 10, -18); g.lineTo(x + 10, 18); g.stroke(); } g.fillStyle = 'rgba(255,240,180,0.7)'; g.fillRect(-60, -16, 120, 6); g.restore(); } },
  cheesebread: { draw(g) { for (const [x, y, r] of [[56, 92, 30], [104, 92, 30], [80, 60, 32]]) { g.beginPath(); g.arc(x, y, r, 0, 7); fs(g, '#f2c26a'); g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.ellipse(x - 8, y - 10, 9, 5, -0.4, 0, 7); g.fill(); } } },
  taco: { draw(g) { g.beginPath(); g.moveTo(20, 120); g.quadraticCurveTo(80, 10, 140, 120); g.closePath(); fs(g, '#ffd36a');
    g.beginPath(); g.moveTo(34, 104); g.quadraticCurveTo(80, 50, 126, 104); g.lineWidth = 10; g.strokeStyle = '#3fae5a'; g.stroke(); dots(g, [[60, 84], [84, 72], [104, 86]], '#e8433f', 7); dots(g, [[72, 90], [96, 96]], '#8a4a2a', 7); } },
  churro: { draw(g) { g.save(); g.translate(80, 80); g.rotate(-0.7); rr(g, -74, -14, 148, 28, 14); fs(g, '#d98a3a'); g.strokeStyle = 'rgba(23,10,54,0.35)'; g.lineWidth = 2; for (let x = -64; x < 70; x += 12) { g.beginPath(); g.moveTo(x, -12); g.lineTo(x + 6, 12); g.stroke(); } dots(g, [[-40, -4], [0, 4], [40, -2]], '#fff', 2); g.restore(); } },
  spacefood: { draw(g) { rr(g, 40, 30, 80, 110, 14); fs(g, '#e4e4f2'); g.fillStyle = '#6b3bff'; g.fillRect(44, 60, 72, 26); rr(g, 66, 14, 28, 22, 6); fs(g, '#c9c9d9', 3);
    g.fillStyle = '#fff'; g.font = '900 16px sans-serif'; g.textAlign = 'center'; g.fillText('SPACE', 80, 79); heart(g, 80, 114, 9, '#ff4da6'); } },
  boba: { drink: true, draw(g, sip = 0) { g.beginPath(); g.moveTo(42, 40); g.lineTo(118, 40); g.lineTo(108, 152); g.lineTo(52, 152); g.closePath(); fs(g, 'rgba(255,255,255,0.7)');
    const top = 54 + sip * 50; g.save(); g.beginPath(); g.moveTo(42, 40); g.lineTo(118, 40); g.lineTo(108, 152); g.lineTo(52, 152); g.closePath(); g.clip();
    g.fillStyle = '#d9a87a'; g.fillRect(30, top, 100, 160); dots(g, [[64, 140], [80, 134], [96, 140], [72, 124], [90, 122]], '#2b1a14', 7); g.restore();
    g.beginPath(); g.moveTo(42, 40); g.lineTo(118, 40); g.lineTo(108, 152); g.lineTo(52, 152); g.closePath(); fs(g, null, 4);
    rr(g, 36, 30, 88, 14, 6); fs(g, '#ff9cc0', 3); g.lineWidth = 9; g.strokeStyle = INK; g.beginPath(); g.moveTo(92, 34); g.lineTo(108, 2); g.stroke(); g.lineWidth = 5; g.strokeStyle = '#ff4da6'; g.stroke(); } },
  coconut: { drink: true, draw(g) { g.beginPath(); g.arc(80, 92, 56, 0, 7); fs(g, '#7a4a28'); g.beginPath(); g.ellipse(80, 52, 40, 12, 0, 0, 7); fs(g, '#fff8e8', 3);
    g.lineWidth = 7; g.strokeStyle = INK; g.beginPath(); g.moveTo(90, 52); g.lineTo(112, 6); g.stroke(); g.lineWidth = 4; g.strokeStyle = '#3ff0c3'; g.stroke();
    g.beginPath(); g.moveTo(54, 52); g.lineTo(40, 18); g.stroke(); g.beginPath(); g.moveTo(20, 24); g.quadraticCurveTo(40, 0, 62, 24); g.closePath(); fs(g, '#ff4da6', 3); } },
};
function heart(g, x, y, s, fill) {
  g.beginPath(); g.moveTo(x, y + s * 0.9); g.bezierCurveTo(x - s * 1.25, y + s * 0.15, x - s * 0.95, y - s * 0.8, x, y - s * 0.25);
  g.bezierCurveTo(x + s * 0.95, y - s * 0.8, x + s * 1.25, y + s * 0.15, x, y + s * 0.9); fs(g, fill, 2);
}
export const FOOD_IDS = Object.keys(FOODS);

// A food at a stage (0 whole, 1 one bite, 2 two bites) on a canvas: the bites out of its top right
export function drawFood(g, id, stage = 0) {
  const f = FOODS[id];
  g.clearRect(0, 0, S, S);
  if (!f) return false;
  g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
  f.draw(g, f.drink ? Math.min(1, stage * 0.45) : 0);
  g.restore();
  if (!f.drink && stage > 0) {
    // the bites: round notches, the second one a little lower
    g.save(); g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';
    const bites = [[118, 42, 26], [128, 70, 24]].slice(0, stage);
    for (const [x, y, r] of bites) { for (const [dx, dy] of [[0, 0], [-14, 10], [10, 16]]) { g.beginPath(); g.arc(x + dx, y + dy, r * 0.62, 0, 7); g.fill(); } }
    g.restore();
    // crumbs along the bite's edge
    g.fillStyle = 'rgba(23,10,54,0.4)';
    for (const [x, y] of [[100, 36], [108, 60], [116, 78]].slice(0, stage + 1)) { g.beginPath(); g.arc(x, y, 2.4, 0, 7); g.fill(); }
  }
  return true;
}
export const FOOD_SIZE = S;
// how big each is in her hand, next to the others (2026-10-07, her first trip recording: three dates as big as her palm):
// small things smaller; anything not listed as drawn
export const FOOD_SCALE = {
  dates: 0.6, strawberry: 0.72, macaron: 0.7, sushi: 0.74, falafel: 0.74, baklava: 0.76, cheesebread: 0.8, dango: 0.86,
  onigiri: 0.86, apple: 0.86, samosa: 0.86, bao: 0.86, cookie: 0.88, turon: 0.9, donut: 0.92, cupcake: 0.92, berliner: 0.92,
  mango: 0.92, croissant: 0.96, fishbun: 0.96, pretzel: 0.96, taco: 0.96,
};
