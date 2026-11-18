export function layout(w = 480, h = 480) {
  const wide = w > h * 1.42,
    compact = h < 325;
  const header = Math.max(40, Math.min(73, h * .16));
  const gap = w * .84 / 3,
    first = w * .08;
  const cabin = Math.max(44, Math.min(w * .15, h * .20, 108));
  const positions = Array.from({
    length: 4
  }, (_, i) => ({
    x: first + gap * i,
    y: header + (h - header) * (.32 + .09 * Math.sin((i + .3) * 1.24)),
    r: cabin * .49
  }));
  const scoreY = Math.max(h * .70, header + cabin * 1.68);
  const conductor = {
    x: wide ? w * .20 : w * .16,
    y: h * .95,
    size: Math.min(h * .37, w * .34)
  };
  return {
    w,
    h,
    wide,
    compact,
    header,
    positions,
    cabin,
    scoreY,
    conductor
  };
}
export function pickCabin(l, x, y) {
  return l.positions.findIndex(p => Math.abs(p.x - x) < Math.max(23, l.cabin * .50) && Math.abs(p.y - y) < Math.max(24, l.cabin * .60));
}
