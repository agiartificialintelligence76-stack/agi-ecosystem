// HALLUCINATION (2026-11-08): where the two pictures go. Two Polaroid-like cards, as big as the screen allows: one above
// the other on a tall screen, side by side on a wide one (whichever makes them bigger), the strip with the clock and
// the two tools under them, everything clear of the top bar and the notch. Pure numbers in, rectangles out (CSS px).
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const ASPECT = 0.75;

export function computeLayout(w, h, ins = { top: 0, right: 0, bottom: 0, left: 0 }, { demo = false } = {}) {
  const pad = demo ? 8 : clamp(Math.round(Math.min(w, h) * 0.025), 8, 20);
  const ax0 = ins.left + pad, ay0 = ins.top + (demo ? pad : 4), ax1 = w - ins.right - pad, ay1 = h - ins.bottom - (demo ? pad : Math.max(8, pad - 4));
  const AW = Math.max(120, ax1 - ax0), AH = Math.max(120, ay1 - ay0);
  const stripH = demo ? 24 : clamp(Math.round(Math.min(AW, AH) * 0.12), 48, 60);
  const sg = demo ? 6 : clamp(Math.round(AH * 0.014), 8, 14);
  const gap = demo ? 7 : clamp(Math.round(Math.min(AW, AH) * 0.022), 8, 18);
  const sh = demo ? 3 : 5;                                     // the cards' hard shadow
  const fit = (stacked) => {
    let f = 6, fb = 20, pw = 0;
    for (let i = 0; i < 4; i++) {
      pw = stacked
        ? Math.min(AW - 2 * f - sh, ((AH - stripH - sg - gap - 2 * sh) / 2 - f - fb) / ASPECT)
        : Math.min((AW - gap - 2 * sh) / 2 - 2 * f, (AH - stripH - sg - sh - f - fb) / ASPECT);
      f = clamp(Math.round(pw * 0.018), 4, 10);
      fb = demo ? 21 : clamp(Math.round(pw * 0.068), 20, 32);
    }
    return { pw: Math.max(40, Math.floor(pw)), f, fb };
  };
  const S = fit(true), D = fit(false);
  const stacked = S.pw > D.pw * 1.015 || (S.pw >= D.pw * 0.985 && h > w);
  const { pw, f, fb } = stacked ? S : D;
  const ph = Math.round(pw * ASPECT);
  const cw = pw + 2 * f, ch = ph + f + fb;
  const blockW = stacked ? cw : cw * 2 + gap;
  const cardsH = stacked ? ch * 2 + gap : ch;
  const blockH = cardsH + sg + stripH;
  const bx = Math.round(ax0 + (AW - blockW) / 2), by = Math.round(ay0 + (AH - blockH) / 2);
  const cards = stacked
    ? [{ x: bx, y: by, w: cw, h: ch }, { x: bx, y: by + ch + gap, w: cw, h: ch }]
    : [{ x: bx, y: by, w: cw, h: ch }, { x: bx + cw + gap, y: by, w: cw, h: ch }];
  const pics = cards.map((c) => ({ x: c.x + f, y: c.y + f, w: pw, h: ph }));
  // the strip: the hint button, the clock (found dots, the bar, the time), the blink button
  const sw = Math.min(blockW, Math.max(cw, 640));
  const strip = { x: Math.round(bx + (blockW - sw) / 2), y: by + cardsH + sg, w: Math.round(sw), h: stripH };
  const btnW = demo ? 0 : clamp(Math.round(strip.w * 0.27), stripH, 150);
  // the blink view: one big picture over the whole play area
  const bh = Math.min(AH - stripH - sg, AW * ASPECT), bw = bh / ASPECT;
  const blinkView = { x: Math.round(ax0 + (AW - bw) / 2), y: Math.round(ay0 + (AH - stripH - sg - bh) / 2), w: Math.round(bw), h: Math.round(bh) };
  return { stacked, pw, ph, k: pw / 400, f, fb, gap, sh, cards, pics, strip, btnW, blinkView, block: { x: bx, y: by, w: blockW, h: cardsH }, area: { x: ax0, y: ay0, w: AW, h: AH }, demo };
}
// which picture a point is on (0 memory, 1 redraw, -1 neither), and where in the page (400 × 300) it lands; `slack`
// px around a picture still counts (a tap on its frame)
export function pickPicture(L, x, y, slack = 10) {
  for (let i = 0; i < 2; i++) {
    const p = L.pics[i];
    if (x >= p.x - slack && x <= p.x + p.w + slack && y >= p.y - slack && y <= p.y + p.h + slack) {
      return { pic: i, x: clamp((x - p.x) / L.k, 0, 400), y: clamp((y - p.y) / L.k, 0, 300) };
    }
  }
  return { pic: -1, x: 0, y: 0 };
}
