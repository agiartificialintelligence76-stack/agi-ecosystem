// MERGE TO AGI (2026-11-08): where everything goes on the screen. Two arrangements of the same jar (400 × 560 units):
// "tall" (phones held upright, tablets) with the NEXT bubble over the jar and the evolution strip under it, and "wide"
// (computers, sideways phones, the 480 × 480 demo) with the evolution list on the left and NEXT and AGI-1 on the right.
// Whichever shows the jar bigger wins. Pure: numbers in, numbers out.

// each arrangement's box, in jar units (the jar's inside is x 0…400, y 0…560; the dropper hangs above y 0)
export const BOUNDS = Object.freeze({
  tall: Object.freeze({ minX: -30, maxX: 430, minY: -222, maxY: 688 }),
  wide: Object.freeze({ minX: -222, maxX: 622, minY: -150, maxY: 622 }),
});

// the pieces of each arrangement, in jar units
export const PARTS = Object.freeze({
  tall: Object.freeze({
    next: { x: 378, y: -180, r: 25 },
    say: { x: -16, y: -208, w: 344, h: 56 },
    score: { x: -8, y: -186 },
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

// → { kind, s (CSS px a unit), ox, oy (CSS px of the jar's corner, x 0 y 0), w, h, parts }. `top` is what's over the
// screen's top edge (the kit's bar), `left`/`right`/`bottom` the notch and home bar (safe areas), `pad` a margin
export function computeLayout(w, h, { top = 0, pad = 10, left = 0, right = 0, bottom = 0, maxScale = 2.4, kind: force = null } = {}) {
  const aw = Math.max(1, w - left - right - pad * 2), ah = Math.max(1, h - top - bottom - pad);
  const fit = (b) => Math.min(aw / (b.maxX - b.minX), ah / (b.maxY - b.minY), maxScale);
  const sTall = fit(BOUNDS.tall), sWide = fit(BOUNDS.wide);
  const kind = force || (sWide >= sTall * 0.97 ? 'wide' : 'tall');
  const b = BOUNDS[kind], s = kind === 'wide' ? sWide : sTall;
  const lw = (b.maxX - b.minX) * s, lh = (b.maxY - b.minY) * s;
  const ox = left + pad + (aw - lw) / 2 - b.minX * s;
  const oy = top + (ah - lh) / 2 - b.minY * s;
  return { kind, s, ox, oy, w, h, parts: PARTS[kind] };
}

// a pointer's CSS pixels → jar units
export const toJar = (L, px, py) => ({ x: (px - L.ox) / L.s, y: (py - L.oy) / L.s });
