// MERGE TO AGI (2026-11-08): where everything goes on the screen. Two arrangements of the same jar (400 × 560 units):
// "tall" (phones held upright, tablets) with the NEXT bubble over the jar and the evolution strip under it, and "wide"
// (computers, sideways phones, the 480 × 480 demo) with the evolution list on the left and NEXT and AGI-1 on the right.
// Whichever shows the jar bigger wins. Pure: numbers in, numbers out.

// each arrangement's box, in jar units (the jar's inside is x 0…400, y 0…560; the dropper hangs above y 0)
export const BOUNDS = Object.freeze({
  tall: Object.freeze({ minX: -30, maxX: 430, minY: -200, maxY: 688 }),
  wide: Object.freeze({ minX: -222, maxX: 622, minY: -150, maxY: 622 }),
});

// the pieces of each arrangement, in jar units
export const PARTS = Object.freeze({
  tall: Object.freeze({
    next: { x: 374, y: -164, r: 25 },
    say: { x: -14, y: -194, w: 338, h: 58 },
    score: { x: -8, y: -172 },
    strip: { x0: 6, x1: 394, y: 652, r: 15 },
  }),
  wide: Object.freeze({
    left: { x: -214, y: -112, w: 176, h: 718 },
    right: { x: 438, y: -112, w: 176, h: 718 },
    next: { x: 526, y: -12, r: 46 },
    score: { x: 526, y: 112 },
    list: { x: -184, y0: -56, y1: 576, r: 19 },
    face: { x: 526, y: 522, r: 40 },
  }),
});

// → { kind, s (CSS px a unit), ox, oy (CSS px of the jar's corner, x 0 y 0), w, h }
export function computeLayout(w, h, { top = 0, pad = 10, maxScale = 2.4 } = {}) {
  const fit = (b) => {
    const lw = b.maxX - b.minX, lh = b.maxY - b.minY;
    return Math.min(Math.max(1, w - pad * 2) / lw, Math.max(1, h - top - pad) / lh, maxScale);
  };
  const sTall = fit(BOUNDS.tall), sWide = fit(BOUNDS.wide);
  const kind = sWide >= sTall * 0.97 ? 'wide' : 'tall';
  const b = BOUNDS[kind], s = kind === 'wide' ? sWide : sTall;
  const lw = (b.maxX - b.minX) * s, lh = (b.maxY - b.minY) * s;
  const ox = pad + (w - pad * 2 - lw) / 2 - b.minX * s;
  const oy = top + (h - top - pad - lh) / 2 - b.minY * s;
  return { kind, s, ox, oy, w, h, parts: PARTS[kind] };
}

// a pointer's CSS pixels → jar units
export const toJar = (L, px, py) => ({ x: (px - L.ox) / L.s, y: (py - L.oy) / L.s });
