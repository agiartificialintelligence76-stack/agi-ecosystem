// ACCEPT ALL COOKIES: AGI-1's cat, drawn in code as a sticker: a fluffy grey striped cat sitting on its cushion, big
// round eyes that follow the cookie, ears that twitch, a tail that swishes, a mouth that opens wider as the cookie comes
// closer; a CHOMP, a happy wiggle and a purr when it's fed; droopy ears when the cookie is lost; an impatient paw tap
// when you keep it waiting. Never named. Everything here is in page units around the cat's mouth (mx, my).
import { clamp, ease, lerp } from '../kit/fx.js';

export const CAT = {
  ink: '#170a36', fur: '#b9b4c4', fur2: '#cfcbd8', stripe: '#7d7790', white: '#fbf8ff', pink: '#ff9bc4',
  pinkDeep: '#e2558f', mouth: '#7a1f4d', tongue: '#ff7fb4', iris: '#8fd6c4', iris2: '#4fae99', cushion: '#c9b3ff', cushion2: '#a98bff',
  shelf: '#e9c58d', shelf2: '#c99a59',
};
const TAU = Math.PI * 2;

// the cat's moods and moments, moved along by the game (seconds); none of it touches the physics
export class Cat {
  constructor() { this.reset(); }
  reset() {
    this.t = 0;
    this.lookX = 0; this.lookY = 0;    // where the pupils point (-1…1)
    this.open = 0;                      // how wide the mouth is (0…1)
    this.blink = 0; this.nextBlink = 1.4;
    this.ear = 0; this.nextEar = 2.2;   // a twitch (seconds left)
    this.chomp = -1;                    // seconds since the chomp (-1: none)
    this.sad = -1;                      // seconds since the cookie was lost
    this.wait = 0;                      // seconds of nothing happening (the impatient paw)
    this.hop = 0;                       // a little hop (a pixel, a near miss)
    this.purr = 0;
  }
  // tx, ty: the cookie (or null); dt: seconds; near: 0…1 how close the cookie is to the mouth
  update(dt, look, near, idle) {
    this.t += dt;
    const lx = look ? clamp(look.x, -1, 1) : 0, ly = look ? clamp(look.y, -1, 1) : 0.2;
    const k = 1 - Math.exp(-dt * 10);
    this.lookX += (lx - this.lookX) * k; this.lookY += (ly - this.lookY) * k;
    const want = this.chomp >= 0 ? 0 : this.sad >= 0 ? 0 : near;
    this.open += (want - this.open) * (1 - Math.exp(-dt * (want > this.open ? 14 : 8)));
    this.nextBlink -= dt;
    if (this.nextBlink <= 0) { this.blink = 0.14; this.nextBlink = 2 + ((this.t * 7.31) % 3); }
    if (this.blink > 0) this.blink = Math.max(0, this.blink - dt);
    this.nextEar -= dt;
    if (this.nextEar <= 0) { this.ear = 0.3; this.nextEar = 2.5 + ((this.t * 3.7) % 4); }
    if (this.ear > 0) this.ear = Math.max(0, this.ear - dt);
    if (this.chomp >= 0) this.chomp += dt;
    if (this.sad >= 0) this.sad += dt;
    this.wait = idle ? this.wait + dt : 0;
    if (this.hop > 0) this.hop = Math.max(0, this.hop - dt);
    if (this.purr > 0) this.purr = Math.max(0, this.purr - dt);
  }
  eat() { this.chomp = 0; this.purr = 2.4; this.sad = -1; }
  lose() { this.sad = 0; this.chomp = -1; }
  cheer() { this.hop = 0.35; }
}

// the cushion (and a little shelf under it when the cat sits up the page)
function seat(g, mx, my) {
  const y = my + 84;
  if (y + 24 < 880) {
    // a shelf on two brackets
    g.fillStyle = CAT.shelf2;
    g.beginPath(); g.moveTo(mx - 56, y + 26); g.lineTo(mx - 40, y + 26); g.lineTo(mx - 48, y + 60); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(mx + 56, y + 26); g.lineTo(mx + 40, y + 26); g.lineTo(mx + 48, y + 60); g.closePath(); g.fill();
    g.lineWidth = 3.5; g.strokeStyle = CAT.ink; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(mx - 56, y + 26); g.lineTo(mx - 40, y + 26); g.lineTo(mx - 48, y + 60); g.closePath(); g.stroke();
    g.beginPath(); g.moveTo(mx + 56, y + 26); g.lineTo(mx + 40, y + 26); g.lineTo(mx + 48, y + 60); g.closePath(); g.stroke();
    rr(g, mx - 96, y + 14, 192, 16, 6);
    g.fillStyle = CAT.shelf; g.fill(); g.stroke();
  }
  rr(g, mx - 86, y - 6, 172, 28, 14);
  g.fillStyle = CAT.cushion; g.fill();
  g.lineWidth = 4; g.strokeStyle = CAT.ink; g.stroke();
  g.strokeStyle = CAT.cushion2; g.lineWidth = 3;
  g.beginPath(); g.moveTo(mx - 62, y + 8); g.quadraticCurveTo(mx, y + 16, mx + 62, y + 8); g.stroke();
}
function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

// draw the cat; `cookie`: the cookie's position (or null) for its eyes; `reduced`: no wiggles
export function drawCat(g, cat, mx, my, { reduced = false } = {}) {
  const t = cat.t;
  const ink = CAT.ink;
  g.save();
  g.lineJoin = 'round'; g.lineCap = 'round';
  seat(g, mx, my);
  // the happy wiggle and the hop: the cat squashes and stretches on its cushion
  let sx = 1, sy = 1, lift = 0, tilt = 0;
  if (cat.chomp >= 0 && !reduced) {
    const c = cat.chomp;
    if (c < 0.12) { sy = 1 - c * 1.4; sx = 1 + c * 1.2; }
    else if (c < 0.5) { const k = (c - 0.12) / 0.38; sy = lerp(0.83, 1.06, ease.outBack(k)); sx = lerp(1.14, 0.97, ease.outBack(k)); }
    else { const w = Math.max(0, 1.6 - c); tilt = Math.sin(c * 14) * 0.06 * w; }
  }
  if (cat.hop > 0 && !reduced) { const k = cat.hop / 0.35; lift = Math.sin(k * Math.PI) * 10; }
  const baseY = my + 80;
  g.translate(mx, baseY - lift);
  g.rotate(tilt);
  g.scale(sx, sy);
  g.translate(-mx, -baseY);
  const H = { x: mx, y: my - 26 };
  // ---- the tail (behind): it swishes, faster when the cookie is near, wags when fed
  const swish = cat.chomp >= 0 ? Math.sin(t * 9) * 0.5 : Math.sin(t * (1.6 + cat.open * 3)) * 0.35;
  const droop = cat.sad >= 0 ? Math.min(1, cat.sad * 2) : 0;
  {
    const bx = mx + 52, by = my + 66;
    const a = -0.9 + swish * (reduced ? 0.3 : 1) + droop * 1.1;
    const tx = bx + Math.cos(a) * 70, ty = by + Math.sin(a) * 70 - 20;
    const cx1 = bx + 46, cy1 = by + 10;
    g.lineWidth = 24; g.strokeStyle = ink;
    g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(cx1, cy1, tx, ty); g.stroke();
    g.lineWidth = 17; g.strokeStyle = CAT.fur;
    g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(cx1, cy1, tx, ty); g.stroke();
    // tail stripes: short dark bands across it
    g.strokeStyle = CAT.stripe; g.lineWidth = 5;
    for (const k of [0.45, 0.65, 0.84]) {
      const px = (1 - k) * (1 - k) * bx + 2 * (1 - k) * k * cx1 + k * k * tx;
      const py = (1 - k) * (1 - k) * by + 2 * (1 - k) * k * cy1 + k * k * ty;
      const dx = 2 * (1 - k) * (cx1 - bx) + 2 * k * (tx - cx1), dy = 2 * (1 - k) * (cy1 - by) + 2 * k * (ty - cy1);
      const d = Math.hypot(dx, dy) || 1;
      g.beginPath(); g.moveTo(px - (dy / d) * 7, py + (dx / d) * 7); g.lineTo(px + (dy / d) * 7, py - (dx / d) * 7); g.stroke();
    }
    g.fillStyle = CAT.white;
    g.beginPath(); g.arc(tx, ty, 8, 0, TAU); g.fill();
    g.lineWidth = 3.5; g.strokeStyle = ink; g.beginPath(); g.arc(tx, ty, 8.5, -0.2 + a, Math.PI + 0.6 + a); g.stroke();
  }
  // ---- the body: a round loaf with a white chest
  g.beginPath(); g.ellipse(mx, my + 46, 70, 50, 0, 0, TAU);
  g.fillStyle = CAT.fur; g.fill(); g.lineWidth = 4.5; g.strokeStyle = ink; g.stroke();
  // body stripes (on the sides)
  g.strokeStyle = CAT.stripe; g.lineWidth = 6;
  for (const s of [-1, 1]) {
    g.beginPath(); g.moveTo(mx + s * 66, my + 30); g.quadraticCurveTo(mx + s * 52, my + 36, mx + s * 48, my + 50); g.stroke();
    g.beginPath(); g.moveTo(mx + s * 68, my + 54); g.quadraticCurveTo(mx + s * 56, my + 58, mx + s * 52, my + 70); g.stroke();
  }
  g.beginPath(); g.ellipse(mx, my + 52, 34, 38, 0, 0, TAU);
  g.fillStyle = CAT.white; g.fill();
  // fluffy chest tufts
  g.strokeStyle = '#e6e0f0'; g.lineWidth = 2.5;
  for (const [dx, dy] of [[-12, 40], [10, 48], [-4, 62], [14, 70]]) { g.beginPath(); g.moveTo(mx + dx - 5, my + dy); g.lineTo(mx + dx, my + dy + 6); g.lineTo(mx + dx + 5, my + dy); g.stroke(); }
  // ---- the paws (one taps when it waits)
  const tap = !reduced && cat.wait > 4 && cat.chomp < 0 && cat.sad < 0 ? Math.max(0, Math.sin(t * 9)) * 6 : 0;
  for (const s of [-1, 1]) {
    const py = my + 88 - (s > 0 ? tap : 0);
    g.beginPath(); g.ellipse(mx + s * 24, py, 19, 12, 0, 0, TAU);
    g.fillStyle = CAT.white; g.fill(); g.lineWidth = 4; g.strokeStyle = ink; g.stroke();
    g.lineWidth = 2.5;
    for (const k of [-6, 0, 6]) { g.beginPath(); g.moveTo(mx + s * 24 + k, py + 3); g.lineTo(mx + s * 24 + k, py + 9); g.stroke(); }
  }
  // ---- the head
  const earDroop = droop * 0.6;
  const twitch = cat.ear > 0 && !reduced ? Math.sin((0.3 - cat.ear) * 40) * 0.12 : 0;
  for (const s of [-1, 1]) {
    const a = s * (0.55 + earDroop) + (s > 0 ? twitch : 0);
    const bx = H.x + s * 40, by = H.y - 36;
    const ex = bx + Math.sin(a) * 58, ey = by - Math.cos(a) * 58 + earDroop * 30;
    const w = 24;
    const lx = bx - Math.cos(a) * w, ly = by - Math.sin(a) * w, rx2 = bx + Math.cos(a) * w, ry2 = by + Math.sin(a) * w;
    g.beginPath(); g.moveTo(lx, ly); g.quadraticCurveTo(ex - Math.cos(a) * 6, ey - Math.sin(a) * 6, ex, ey); g.quadraticCurveTo(ex + Math.cos(a) * 6, ey + Math.sin(a) * 6, rx2, ry2); g.closePath();
    g.fillStyle = CAT.fur; g.fill(); g.lineWidth = 4.5; g.strokeStyle = ink; g.stroke();
    g.beginPath(); g.moveTo(lx + (bx - lx) * 0.35, ly + (by - ly) * 0.35 - 4); g.lineTo(bx + (ex - bx) * 0.72, by + (ey - by) * 0.72); g.lineTo(rx2 + (bx - rx2) * 0.35, ry2 + (by - ry2) * 0.35 - 4); g.closePath();
    g.fillStyle = CAT.pink; g.fill();
  }
  // the face: wide and round, with cheek fluff
  g.beginPath();
  g.moveTo(H.x - 64, H.y + 6);
  g.bezierCurveTo(H.x - 66, H.y - 40, H.x - 34, H.y - 56, H.x, H.y - 56);
  g.bezierCurveTo(H.x + 34, H.y - 56, H.x + 66, H.y - 40, H.x + 64, H.y + 6);
  // cheek tufts
  g.lineTo(H.x + 72, H.y + 14); g.lineTo(H.x + 60, H.y + 20); g.lineTo(H.x + 66, H.y + 30); g.lineTo(H.x + 50, H.y + 32);
  g.bezierCurveTo(H.x + 38, H.y + 50, H.x + 18, H.y + 54, H.x, H.y + 54);
  g.bezierCurveTo(H.x - 18, H.y + 54, H.x - 38, H.y + 50, H.x - 50, H.y + 32);
  g.lineTo(H.x - 66, H.y + 30); g.lineTo(H.x - 60, H.y + 20); g.lineTo(H.x - 72, H.y + 14);
  g.closePath();
  g.fillStyle = CAT.fur; g.fill(); g.lineWidth = 4.5; g.strokeStyle = ink; g.stroke();
  // forehead stripes (an "M") and cheek stripes
  g.strokeStyle = CAT.stripe; g.lineWidth = 5.5;
  g.beginPath(); g.moveTo(H.x, H.y - 52); g.lineTo(H.x, H.y - 34); g.stroke();
  g.beginPath(); g.moveTo(H.x - 16, H.y - 50); g.quadraticCurveTo(H.x - 13, H.y - 40, H.x - 10, H.y - 32); g.stroke();
  g.beginPath(); g.moveTo(H.x + 16, H.y - 50); g.quadraticCurveTo(H.x + 13, H.y - 40, H.x + 10, H.y - 32); g.stroke();
  for (const s of [-1, 1]) {
    g.beginPath(); g.moveTo(H.x + s * 64, H.y - 6); g.lineTo(H.x + s * 48, H.y - 2); g.stroke();
    g.beginPath(); g.moveTo(H.x + s * 64, H.y + 6); g.lineTo(H.x + s * 50, H.y + 8); g.stroke();
  }
  // the muzzle
  g.beginPath(); g.ellipse(H.x, H.y + 30, 30, 22, 0, 0, TAU); g.fillStyle = CAT.white; g.fill();
  // blush
  g.fillStyle = 'rgba(255,120,170,0.35)';
  g.beginPath(); g.ellipse(H.x - 40, H.y + 18, 10, 6, 0, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(H.x + 40, H.y + 18, 10, 6, 0, 0, TAU); g.fill();
  // ---- the eyes: big and round, pupils on the cookie; closed and happy when fed, sad when it's lost
  const happy = cat.chomp >= 0 && cat.chomp > 0.25;
  for (const s of [-1, 1]) {
    const ex = H.x + s * 25, ey = H.y - 6;
    if (happy) {
      g.lineWidth = 5; g.strokeStyle = ink;
      g.beginPath(); g.arc(ex, ey + 4, 11, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      continue;
    }
    const sad = cat.sad >= 0;
    const lid = cat.blink > 0 ? 1 - Math.abs(cat.blink - 0.07) / 0.07 : 0;
    g.beginPath(); g.ellipse(ex, ey, 16, 17 * (1 - lid * 0.92), 0, 0, TAU);
    g.fillStyle = CAT.white; g.fill(); g.lineWidth = 4; g.strokeStyle = ink; g.stroke();
    if (lid < 0.6) {
      const px = ex + cat.lookX * 5.5, py = ey + cat.lookY * 5.5 + (sad ? 3 : 0);
      g.save();
      g.beginPath(); g.ellipse(ex, ey, 14, 15 * (1 - lid * 0.92), 0, 0, TAU); g.clip();
      g.beginPath(); g.arc(px, py, 12, 0, TAU); g.fillStyle = CAT.iris; g.fill();
      g.beginPath(); g.arc(px, py + 3, 9, 0, Math.PI); g.fillStyle = CAT.iris2; g.fill();
      const pupil = 5.5 + cat.open * 2.5;
      g.beginPath(); g.ellipse(px, py, pupil * 0.75, pupil, 0, 0, TAU); g.fillStyle = ink; g.fill();
      g.fillStyle = '#ffffff';
      g.beginPath(); g.arc(px - 4, py - 5, 3.6, 0, TAU); g.fill();
      g.beginPath(); g.arc(px + 4, py + 3, 1.6, 0, TAU); g.fill();
      g.restore();
    }
    if (sad) {
      g.lineWidth = 4; g.strokeStyle = ink;
      g.beginPath(); g.moveTo(ex - s * 14, ey - 22); g.lineTo(ex + s * 8, ey - 26); g.stroke();
    }
  }
  // ---- the nose and the mouth
  g.beginPath(); g.moveTo(H.x - 7, H.y + 13); g.lineTo(H.x + 7, H.y + 13); g.lineTo(H.x, H.y + 21); g.closePath();
  g.fillStyle = CAT.pinkDeep; g.fill(); g.lineWidth = 2.5; g.strokeStyle = ink; g.stroke();
  const open = cat.open;
  const chompClose = cat.chomp >= 0 && cat.chomp < 0.16 ? 1 - cat.chomp / 0.16 : 0;
  const o = Math.max(open, chompClose * 0.6);
  if (o > 0.08) {
    const w = 10 + o * 24, h = 6 + o * 26;
    const cy = H.y + 26 + h * 0.45;
    g.beginPath(); g.ellipse(H.x, cy, w, h, 0, 0, TAU);
    g.fillStyle = CAT.mouth; g.fill(); g.lineWidth = 4; g.strokeStyle = ink; g.stroke();
    g.save(); g.beginPath(); g.ellipse(H.x, cy, w - 2, h - 2, 0, 0, TAU); g.clip();
    g.beginPath(); g.ellipse(H.x, cy + h * 0.65, w * 0.7, h * 0.55, 0, 0, TAU); g.fillStyle = CAT.tongue; g.fill();
    g.restore();
    // two little fangs
    g.fillStyle = '#ffffff'; g.lineWidth = 2; g.strokeStyle = ink;
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(H.x + s * w * 0.55 - 4, cy - h * 0.82); g.lineTo(H.x + s * w * 0.55 + 4, cy - h * 0.82); g.lineTo(H.x + s * w * 0.55, cy - h * 0.82 + 7); g.closePath(); g.fill(); g.stroke();
    }
  } else if (cat.sad >= 0) {
    g.lineWidth = 3.5; g.strokeStyle = ink;
    g.beginPath(); g.arc(H.x, H.y + 34, 8, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
  } else {
    // ":3"
    g.lineWidth = 3.5; g.strokeStyle = ink;
    g.beginPath(); g.moveTo(H.x, H.y + 21); g.lineTo(H.x, H.y + 25); g.stroke();
    g.beginPath(); g.arc(H.x - 6, H.y + 25, 6, 0.1, Math.PI - 0.3); g.stroke();
    g.beginPath(); g.arc(H.x + 6, H.y + 25, 6, 0.3, Math.PI - 0.1); g.stroke();
  }
  // whiskers
  g.strokeStyle = ink; g.lineWidth = 2;
  for (const s of [-1, 1]) {
    for (const k of [-1, 0, 1]) {
      g.beginPath(); g.moveTo(H.x + s * 30, H.y + 24 + k * 5); g.lineTo(H.x + s * 62, H.y + 18 + k * 9); g.stroke();
    }
  }
  g.restore();
  // the purr: little curved lines beside its head
  if (cat.purr > 0 && !reduced) {
    const a = Math.min(1, cat.purr) * 0.9;
    g.save(); g.globalAlpha = a; g.strokeStyle = CAT.cushion2; g.lineWidth = 4; g.lineCap = 'round';
    for (const s of [-1, 1]) {
      for (let i = 0; i < 2; i++) {
        const r = 14 + i * 10 + ((t * 30) % 10);
        g.beginPath(); g.arc(mx + s * 78, my - 50, r, s > 0 ? -0.7 : Math.PI - 0.7 + 0, s > 0 ? 0.7 : Math.PI + 0.7); g.stroke();
      }
    }
    g.restore();
  }
}
