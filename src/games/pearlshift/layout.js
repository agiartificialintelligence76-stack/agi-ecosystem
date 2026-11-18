export function layout(w = 480, h = 480) {
  const wide = w > h * 1.35,
    margin = Math.max(8, Math.min(23, w * .018)),
    head = Math.max(42, Math.min(65, h * .13));
  const chart = {
    x: margin,
    y: head + margin,
    w: wide ? w * .64 - margin * 2 : w - margin * 2,
    h: wide ? h - head - margin * 2 : Math.max(100, (h - head) * .68 - margin)
  };
  const side = wide ? {
    x: chart.x + chart.w + margin * 1.3,
    y: chart.y,
    w: w - chart.w - margin * 3.5,
    h: chart.h
  } : {
    x: margin,
    y: chart.y + chart.h + 6,
    w: w - margin * 2,
    h: Math.max(49, h - chart.y - chart.h - 13)
  };
  return {
    wide,
    w,
    h,
    margin,
    chart,
    side,
    head
  };
}
export const project = (r, x, y) => [r.x + x * r.w, r.y + y * r.h];
export function unproject(r, x, y) {
  if (x < r.x || y < r.y || x > r.x + r.w || y > r.y + r.h) return null;
  return [(x - r.x) / r.w, (y - r.y) / r.h];
}
