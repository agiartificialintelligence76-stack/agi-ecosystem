export function seating(w, h) {
  const pad = Math.max(8, Math.min(23, w * .024)),
    gap = pad * .70,
    head = Math.min(55, Math.max(37, h * .09)),
    foot = Math.min(47, h * .1);
  const y = pad + head + gap,
    usable = h - y - foot - gap,
    wide = w / h > 1.32;
  if (wide) {
    const left = (w - 2 * pad - gap) * .56;
    return {
      pad,
      head,
      coach: {
        x: pad,
        y,
        w: left,
        h: usable
      },
      desk: {
        x: pad + left + gap,
        y,
        w: w - 2 * pad - gap - left,
        h: usable
      },
      wide
    };
  }
  const top = Math.min(usable * .46, Math.max(103, w * .47));
  return {
    pad,
    head,
    coach: {
      x: pad,
      y,
      w: w - 2 * pad,
      h: top
    },
    desk: {
      x: pad,
      y: y + top + gap,
      w: w - 2 * pad,
      h: usable - top - gap
    },
    wide
  };
}
