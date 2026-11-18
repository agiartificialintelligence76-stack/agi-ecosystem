// A shallow cabinet projection keeps the rail compass readable without sacrificing the miniature silhouette.
export function geometry(yard, w, h) {
  const small = w < 480,
    top = small ? 68 : 75,
    base = h - (small ? 63 : 62);
  const gap = Math.max(1, base - top),
    dx = .25,
    dy = .15;
  const width = yard.width - 1 + dx * (yard.height - 1),
    height = (yard.height - 1) * .78 + dy * (yard.width - 1);
  const unit = Math.max(12, Math.min((w - 16) / (width + 1.42), gap / (height + 1.75), w < 500 ? 95 : 153));
  const cx = w / 2,
    cy = top + gap * .55;
  function at(node) {
    const p = yard.points[node];
    return [cx + (p.x - (yard.width - 1) / 2 + (p.y - (yard.height - 1) / 2) * dx) * unit, cy + ((p.y - (yard.height - 1) / 2) * .78 - (p.x - (yard.width - 1) / 2) * dy) * unit];
  }
  return {
    at,
    unit,
    top,
    base,
    w,
    h
  };
}
export function nearest(yard, geo, x, y) {
  let best = -1,
    dist = Infinity;
  for (let i = 0; i < yard.points.length; i++) {
    const [cx, cy] = geo.at(i);
    const gap = Math.hypot(cx - x, (cy - y) * 1.13);
    if (gap < dist && gap < Math.max(22, geo.unit * .57)) {
      best = i;
      dist = gap;
    }
  }
  return best;
}
