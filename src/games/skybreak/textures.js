// Every texture is drawn locally on a canvas, once. No network assets.
export const GREEN = '#16c784';
export const RED = '#ea3943';

function canvas(width, height) {
  const element = document.createElement('canvas');
  element.width = width;
  element.height = height;
  return [element, element.getContext('2d')];
}

function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** A candle body: a lit vertical gradient with bright edges and faint price ticks. */
export function candleFace(tone) {
  const [c, g] = canvas(128, 256);
  const green = tone === 'green';
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, green ? '#3cf08f' : '#ff6b75');
  grad.addColorStop(0.15, green ? '#16c784' : '#ea3943');
  grad.addColorStop(1, green ? '#075c34' : '#7d141c');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 256);
  g.fillStyle = green ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.08)';
  for (let y = 24; y < 256; y += 24) g.fillRect(10, y, 108, 2);
  g.fillStyle = green ? '#a6ffce' : '#ffc1c6';
  g.fillRect(0, 0, 128, 5);
  g.fillRect(0, 0, 4, 256);
  g.fillRect(124, 0, 4, 256);
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillRect(0, 250, 128, 6);
  return c;
}

/** The walkable cap of a candle: bright, readable from above. */
export function candleTop(tone) {
  const [c, g] = canvas(128, 128);
  const green = tone === 'green';
  g.fillStyle = green ? '#19c97a' : '#e8404c';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = green ? '#b6ffd6' : '#ffd0d3';
  g.lineWidth = 6;
  g.strokeRect(3, 3, 122, 122);
  g.fillStyle = green ? 'rgba(10,80,50,0.35)' : 'rgba(90,10,20,0.35)';
  g.beginPath(); g.arc(64, 64, 9, 0, Math.PI * 2); g.fill();
  return c;
}

/** Trading terminal deck: a dark screen with a grid and a rising chart line. */
export function terminalTop(seed = 7) {
  const [c, g] = canvas(256, 256);
  const random = seeded(seed);
  g.fillStyle = '#0d1630';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(80,140,255,0.18)';
  g.lineWidth = 1;
  for (let i = 16; i < 256; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke(); }
  let price = 190;
  for (let x = 14; x < 246; x += 16) {
    const open = price;
    price = Math.max(30, Math.min(226, price - 12 + random() * 30 - 8));
    const up = price < open;
    g.fillStyle = up ? '#16c784' : '#ea3943';
    g.fillRect(x + 6, Math.min(open, price) - 10 * random() - 4, 2, Math.abs(open - price) + 24);
    g.fillRect(x + 2, Math.min(open, price), 10, Math.max(3, Math.abs(open - price)));
  }
  g.strokeStyle = '#7fd7ff';
  g.lineWidth = 3;
  g.strokeRect(2, 2, 252, 252);
  return c;
}

/** An order-book block: bids stack green on the left, asks red on the right. */
export function orderBookSide(seed = 3) {
  const [c, g] = canvas(256, 128);
  const random = seeded(seed);
  g.fillStyle = '#0c1220';
  g.fillRect(0, 0, 256, 128);
  for (let row = 0; row < 8; row++) {
    const y = 6 + row * 15;
    const bid = 30 + random() * 90, ask = 30 + random() * 90;
    g.fillStyle = 'rgba(22,199,132,0.85)';
    g.fillRect(126 - bid, y, bid, 11);
    g.fillStyle = 'rgba(234,57,67,0.85)';
    g.fillRect(130, y, ask, 11);
  }
  g.fillStyle = '#e8f0ff';
  g.fillRect(127, 0, 2, 128);
  g.strokeStyle = '#3c5a8a';
  g.lineWidth = 4;
  g.strokeRect(2, 2, 252, 124);
  return c;
}

export function orderBookTop() {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#18233a';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#16c784'; g.fillRect(0, 0, 64, 6); g.fillRect(0, 122, 64, 6);
  g.fillStyle = '#ea3943'; g.fillRect(64, 0, 64, 6); g.fillRect(64, 122, 64, 6);
  g.fillStyle = 'rgba(232,240,255,0.7)';
  g.fillRect(62, 10, 4, 108);
  return c;
}

/** Concrete roof deck with tar seams. */
export function concreteTop(seed = 11) {
  const [c, g] = canvas(256, 256);
  const random = seeded(seed);
  g.fillStyle = '#8f949b';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    const v = 120 + random() * 50;
    g.fillStyle = `rgba(${v},${v},${v + 4},0.35)`;
    g.fillRect(random() * 256, random() * 256, 2 + random() * 3, 2 + random() * 3);
  }
  g.fillStyle = '#5d6168';
  for (const at of [85, 170]) { g.fillRect(at, 0, 3, 256); g.fillRect(0, at, 256, 3); }
  g.strokeStyle = '#ffb35c';
  g.lineWidth = 6;
  g.strokeRect(3, 3, 250, 250);
  return c;
}

export function helipad() {
  const [c, g] = canvas(512, 512);
  g.fillStyle = '#8a8f96';
  g.fillRect(0, 0, 512, 512);
  g.strokeStyle = '#f2f2f2';
  g.lineWidth = 14;
  g.beginPath(); g.arc(256, 256, 180, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#f2f2f2';
  g.font = '900 230px Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('H', 256, 268);
  g.strokeStyle = '#ffb35c';
  g.lineWidth = 12;
  g.strokeRect(8, 8, 496, 496);
  return c;
}

/** Hazard-striped storm plating. */
export function stormSide() {
  const [c, g] = canvas(256, 64);
  g.fillStyle = '#272b36';
  g.fillRect(0, 0, 256, 64);
  g.save();
  g.beginPath(); g.rect(0, 22, 256, 20); g.clip();
  for (let x = -40; x < 300; x += 28) {
    g.fillStyle = '#ff3b4f';
    g.beginPath(); g.moveTo(x, 42); g.lineTo(x + 14, 42); g.lineTo(x + 34, 22); g.lineTo(x + 20, 22); g.closePath(); g.fill();
  }
  g.restore();
  g.fillStyle = '#ff7a86';
  g.fillRect(0, 0, 256, 3);
  return c;
}

export function stormTop() {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#3a3f4d';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(255,255,255,0.08)';
  for (let i = 0; i < 128; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 8, 128); g.stroke(); }
  g.strokeStyle = '#ff4a5c';
  g.lineWidth = 5;
  g.strokeRect(3, 3, 122, 122);
  return c;
}

/** A gold bar stamped with the AGI mark. */
export function goldTop() {
  const [c, g] = canvas(256, 256);
  const grad = g.createLinearGradient(0, 0, 256, 256);
  grad.addColorStop(0, '#fff1a8'); grad.addColorStop(0.45, '#f2c443'); grad.addColorStop(1, '#b8860b');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(120,80,0,0.55)';
  g.lineWidth = 8;
  g.strokeRect(22, 22, 212, 212);
  g.fillStyle = 'rgba(130,85,0,0.55)';
  g.font = '900 78px Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('AGI', 128, 120);
  g.font = '700 22px Arial, sans-serif';
  g.fillText('999.9 FINE', 128, 182);
  return c;
}

/** A Persian rug: a deep field, a medallion and a fringe. */
export function rugTop() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#7a1424';
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#e8b04a';
  g.fillRect(10, 10, 236, 236);
  g.fillStyle = '#1f2a5a';
  g.fillRect(22, 22, 212, 212);
  g.fillStyle = '#9b1b2f';
  g.fillRect(34, 34, 188, 188);
  g.save(); g.translate(128, 128); g.rotate(Math.PI / 4);
  g.fillStyle = '#e8b04a'; g.fillRect(-58, -58, 116, 116);
  g.fillStyle = '#1f2a5a'; g.fillRect(-42, -42, 84, 84);
  g.fillStyle = '#e8b04a'; g.fillRect(-16, -16, 32, 32);
  g.restore();
  g.fillStyle = '#f2dfb0';
  for (let i = 0; i < 256; i += 8) { g.fillRect(i, 0, 3, 8); g.fillRect(i, 248, 3, 8); }
  for (const [x, y] of [[60, 60], [196, 60], [60, 196], [196, 196]]) {
    g.fillStyle = '#e8b04a'; g.beginPath(); g.arc(x, y, 10, 0, Math.PI * 2); g.fill();
  }
  return c;
}

/** Faceted crystal for the stratosphere. */
export function crystalFace() {
  const [c, g] = canvas(128, 128);
  const grad = g.createLinearGradient(0, 0, 128, 128);
  grad.addColorStop(0, '#e4f6ff'); grad.addColorStop(0.5, '#8fd0ff'); grad.addColorStop(1, '#7b62ff');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(255,255,255,0.55)';
  g.lineWidth = 2;
  for (const [a, b, cc, d] of [[0, 30, 70, 0], [40, 128, 128, 60], [0, 90, 128, 20], [70, 0, 90, 128]]) { g.beginPath(); g.moveTo(a, b); g.lineTo(cc, d); g.stroke(); }
  g.strokeStyle = '#ffffff';
  g.lineWidth = 5;
  g.strokeRect(2, 2, 124, 124);
  return c;
}

/** Solar panel cells for the orbital modules. */
export function solarTop() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#c9ced8';
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const grad = g.createLinearGradient(0, 0, 60, 60);
      grad.addColorStop(0, '#2c5bd8'); grad.addColorStop(1, '#0d2a7a');
      g.fillStyle = grad;
      g.save(); g.translate(6 + x * 62, 6 + y * 62);
      g.fillRect(0, 0, 58, 58);
      g.strokeStyle = 'rgba(180,210,255,0.35)';
      g.lineWidth = 1;
      for (let i = 14; i < 58; i += 14) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 58); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(58, i); g.stroke(); }
      g.restore();
    }
  }
  return c;
}

/** Grey regolith with craters. */
export function moonRock(seed = 5, size = 256) {
  const [c, g] = canvas(size, size);
  const random = seeded(seed);
  g.fillStyle = '#a3a5ab';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < size * 4; i++) {
    const v = 130 + random() * 60;
    g.fillStyle = `rgba(${v},${v},${v + 3},0.4)`;
    g.fillRect(random() * size, random() * size, 2 + random() * 4, 2 + random() * 4);
  }
  for (let i = 0; i < size / 12; i++) {
    const x = random() * size, y = random() * size, r = 4 + random() * size / 14;
    g.fillStyle = 'rgba(70,72,80,0.45)';
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(210,212,220,0.5)';
    g.beginPath(); g.arc(x - r * 0.2, y - r * 0.2, r * 0.75, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(120,122,130,0.6)';
    g.beginPath(); g.arc(x, y, r * 0.7, 0, Math.PI * 2); g.fill();
  }
  return c;
}

/** Chevrons that point along a trend rail. */
export function railTop() {
  const [c, g] = canvas(512, 128);
  g.fillStyle = '#0f1f22';
  g.fillRect(0, 0, 512, 128);
  g.strokeStyle = '#2ef0a6';
  g.lineWidth = 10;
  for (let x = 20; x < 512; x += 64) {
    g.beginPath(); g.moveTo(x, 24); g.lineTo(x + 30, 64); g.lineTo(x, 104); g.stroke();
  }
  g.fillStyle = '#8affd2';
  g.fillRect(0, 0, 512, 6); g.fillRect(0, 122, 512, 6);
  return c;
}

/** A coin face. */
export function coinFace() {
  const [c, g] = canvas(128, 128);
  const grad = g.createRadialGradient(50, 44, 6, 64, 64, 64);
  grad.addColorStop(0, '#fff6c2'); grad.addColorStop(0.6, '#f5c542'); grad.addColorStop(1, '#b07d12');
  g.fillStyle = grad;
  g.beginPath(); g.arc(64, 64, 64, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#8a5d00'; g.lineWidth = 6;
  g.beginPath(); g.arc(64, 64, 52, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#8a5d00';
  g.font = '900 38px Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('AGI', 64, 67);
  return c;
}

/** A giant holographic chart for the skyline: candles marching up and to the right. */
export function chartBillboard(seed = 1, label = '$AGI / USD') {
  const [c, g] = canvas(1024, 512);
  const random = seeded(seed);
  g.fillStyle = '#060b18';
  g.fillRect(0, 0, 1024, 512);
  g.strokeStyle = 'rgba(90,150,255,0.16)';
  g.lineWidth = 2;
  for (let x = 0; x < 1024; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); }
  for (let y = 0; y < 512; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(1024, y); g.stroke(); }
  let price = 430;
  const points = [];
  for (let x = 40; x < 990; x += 30) {
    const open = price;
    price = Math.max(70, Math.min(460, price - (random() * 46 - 13)));
    const up = price < open;
    const hi = Math.min(open, price) - random() * 26, lo = Math.max(open, price) + random() * 26;
    g.fillStyle = up ? '#16c784' : '#ea3943';
    g.fillRect(x + 9, hi, 4, lo - hi);
    g.fillRect(x, Math.min(open, price), 22, Math.max(4, Math.abs(open - price)));
    points.push([x + 11, price]);
  }
  g.strokeStyle = 'rgba(255,214,102,0.8)';
  g.lineWidth = 4;
  g.beginPath();
  points.forEach(([x, y], i) => (i ? g.lineTo(x, y - 20) : g.moveTo(x, y - 20)));
  g.stroke();
  g.fillStyle = '#e8f0ff';
  g.font = '700 44px Arial, sans-serif';
  g.fillText(label, 40, 64);
  g.fillStyle = '#16c784';
  g.font = '700 36px Arial, sans-serif';
  g.fillText('▲ ' + (120 + Math.floor(random() * 800)) + '%', 40, 112);
  g.strokeStyle = '#7fd7ff';
  g.lineWidth = 8;
  g.strokeRect(4, 4, 1016, 504);
  return c;
}

/** A signboard label: bold, high-contrast, transparent background. */
export function signLabel(text, color = '#ffffff', sub = '') {
  const [c, g] = canvas(1024, 256);
  g.clearRect(0, 0, 1024, 256);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `800 ${text.length > 12 ? 92 : 120}px Arial, sans-serif`;
  g.lineWidth = 14;
  g.strokeStyle = 'rgba(0,0,0,0.55)';
  g.strokeText(text, 512, sub ? 112 : 128);
  g.fillStyle = color;
  g.fillText(text, 512, sub ? 112 : 128);
  if (sub) {
    g.font = '600 44px Arial, sans-serif';
    g.lineWidth = 8;
    g.strokeText(sub, 512, 206);
    g.fillText(sub, 512, 206);
  }
  return c;
}
