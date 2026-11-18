const cache = new WeakMap();
export function layout(w, h, r) {
  const prev = cache.get(r);
  if (prev?.w === w && prev?.h === h) return prev;
  const wide = w >= 850 && w / h >= 1.26,
    side = wide ? Math.min(315, w * 0.235) : 0,
    playW = w - side;
  const head = Math.max(41, Math.min(70, h * 0.13)),
    foot = Math.max(41, Math.min(84, h * 0.14));
  const usable = h - head - foot,
    dy = w / h < 0.85 ? 0.76 : 0.7,
    skew = 0.2;
  const s = Math.min((playW * 0.92) / (r.w + skew * r.h + 0.42), (usable * 0.93) / (r.h * dy + 0.91), 160);
  const left = (playW - (r.w + skew * r.h) * s) / 2,
    top = head + (usable - r.h * dy * s) * 0.55;
  const pt = (x, y, z = 0) => [left + (x + skew * y) * s, top + dy * y * s - z * s * 0.77];
  const tile = (x, y) => {
    const yy = (y - top) / (s * dy),
      xx = (x - left) / s - skew * yy,
      tx = Math.floor(xx),
      ty = Math.floor(yy);
    return tx >= 0 && tx < r.w && ty >= 0 && ty < r.h ? ty * r.w + tx : -1;
  };
  const box = { w, h, wide, side, playW, head, foot, s, dy, skew, pt, tile };
  cache.set(r, box);
  return box;
}
