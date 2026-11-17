// Small canvas primitives used by the illustrated garden and workshop games.
export const TAU = Math.PI * 2;
export const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export function ellipse(ctx, x, y, rx, ry, fill, rotation = 0) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rotation, 0, TAU);
  ctx.fill();
}
export function line(ctx, points, color, width = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.stroke();
}
export function shape(ctx, points, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
  ctx.fill();
}
export function rect(ctx, x, y, w, h, radius, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
}
export function label(ctx, str, x, y, size, fill, align = 'left', family = 'sans-serif', weight = 700) {
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = fill;
  ctx.fillText(str, x, y);
}
export function sky(ctx, top, bottom, height = 480) {
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 480, height);
}
export function halo(ctx, x, y, radius, inside, outside) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, inside);
  g.addColorStop(1, outside);
  ellipse(ctx, x, y, radius, radius, g);
}

// The scene remains playable while its local, compressed illustration is decoding.
export function artwork(url) {
  if (typeof Image === 'undefined') return null;
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  return image;
}
export function paintArtwork(ctx, image, x, y, width, height) {
  if (!image?.naturalWidth) return false;
  ctx.drawImage(image, x, y, width, height);
  return true;
}
