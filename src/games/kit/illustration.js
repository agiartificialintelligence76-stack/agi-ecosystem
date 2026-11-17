// Small canvas primitives for the illustrated playfields.
export const TAU = Math.PI * 2;
export const clip = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export const mix = (a, b, t) => a + (b - a) * t;
export function polygon(c, points, fill, outline, width = 1) {
  c.beginPath();
  points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
  c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (outline) { c.strokeStyle = outline; c.lineWidth = width; c.stroke(); }
}
export function line(c, points, color, width = 1) {
  c.beginPath(); c.lineWidth = width; c.strokeStyle = color; c.lineJoin = 'round'; c.lineCap = 'round';
  points.forEach(([x,y], i) => i ? c.lineTo(x,y) : c.moveTo(x,y));
  c.stroke();
}
export function oval(c, x, y, rx, ry, fill, stroke, width = 1) {
  c.beginPath(); c.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), 0, 0, TAU);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
}
export function gradient(c, x, y, w, h, colors) {
  const g = c.createLinearGradient(x, y, x, y+h);
  colors.forEach((color, i) => g.addColorStop(i / (colors.length - 1), color));
  c.fillStyle = g; c.fillRect(x, y, w, h);
}
export function type(c, text, x, y, size = 18, color = '#fff4e3', align = 'center', family = 'sans-serif') {
  c.fillStyle = color; c.font = 'bold ' + size + 'px ' + family; c.textAlign = align; c.textBaseline = 'middle';
  c.fillText(text, x, y);
}
export function panel(c, x,y,w,h, fill, radius = 8) {
  c.beginPath(); c.roundRect(x,y,w,h,radius); c.fillStyle = fill; c.fill();
}
