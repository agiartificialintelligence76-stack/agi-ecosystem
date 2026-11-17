// Drawing primitives for the hand-illustrated perspective playfields. Coordinates are logical pixels.
export const clamp = (n, low, high) => Math.min(high, Math.max(low, n));
export const mix = (a, b, t) => a + (b - a) * t;
export const TAU = Math.PI * 2;
export function poly(c, points, color) {
  c.beginPath();
  points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
  c.closePath(); c.fillStyle = color; c.fill();
}
export function line(c, points, color, width = 1) {
  c.beginPath(); c.lineJoin = 'round'; c.lineCap = 'round';
  points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
  c.strokeStyle = color; c.lineWidth = width; c.stroke();
}
export function oval(c, x, y, rx, ry, fill, stroke, width = 1) {
  c.beginPath(); c.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), 0, 0, TAU);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
}
export function gradient(c, y0, y1, stops) {
  const g = c.createLinearGradient(0, y0, 0, y1);
  for (const [position, color] of stops) g.addColorStop(position, color);
  return g;
}
export function caption(c, value, x, y, color = '#fff', size = 17, align = 'center') {
  c.font = '800 ' + size + 'px "AK Sans", system-ui, sans-serif';
  c.textAlign = align; c.textBaseline = 'middle'; c.fillStyle = color; c.fillText(value, x, y);
}
export function panel(c, x, y, w, h, color, radius = 9) {
  c.beginPath(); c.roundRect(x, y, w, h, radius); c.fillStyle = color; c.fill();
}
export function meter(c, x, y, width, value, ink, paper) {
  panel(c, x, y, width, 7, paper, 4);
  if (value > 0) panel(c, x, y, Math.max(3, width * clamp(value, 0, 1)), 7, ink, 4);
}

// Each cartridge loads only its own painting. Unit tests and blocked images use the
// procedural terrain already drawn beneath it. The overscan allows gentle camera parallax.
export function scenery(url) {
  const paint = sprite(url);
  return (ctx, panX = 0, panY = 0) =>
    paint(ctx, -15 + clamp(panX, -14, 14), -15 + clamp(panY, -14, 14), 510, 510);
}
export function sprite(url) {
  if (typeof Image === 'undefined') return () => false;
  const image = new Image();
  image.decoding = 'async';
  image.src = url.href;
  return (ctx, x, y, width, height) => {
    if (!image.complete || !image.naturalWidth) return false;
    ctx.drawImage(image, x, y, width, height);
    return true;
  };
}
