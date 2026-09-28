// AGI-1 in 2D (2026-09-27): where everything is on her picture. All numbers are pixels of her full-size picture
// (1024 × 1536, y pointing down), measured on the owner's art (agi 2d anime/agi-vtuber.html) after it was cleaned up.
// The pictures themselves are in public/models/agi1-2d/ (each layer can be any resolution: they're mapped by their box).

export const RIG = {
  canvas: { w: 1024, h: 1536 },
  feet: 1493,                 // the soles of her shoes: she stands on the floor here
  top: 11,                    // the top of her hair
  // back to front
  layers: {
    backHair: { x: 273, y: 11, w: 475, h: 609, file: 'back-hair.webp', grid: 10 },
    body: { x: 325, y: 177, w: 369, h: 1316, file: 'body.webp', grid: 12 },
    armL: { x: 126, y: 293, w: 278, h: 521, file: 'arm-l.webp', grid: 8 },   // each arm one picture, bent at the elbow
    armR: { x: 619, y: 293, w: 274, h: 521, file: 'arm-r.webp', grid: 8 },
    face: { x: 424, y: 65, w: 178, h: 199, file: 'face.webp', grid: 6 },
    frontHair: { x: 398, y: 9, w: 229, h: 323, file: 'front-hair.webp', grid: 8 },
  },
  // her eyes, brows and mouth, packed in one small picture (features.webp, 256 × 256 at 1×): each piece's box on her
  // face and its place in that picture (0..1)
  atlas: { file: 'features.webp', size: 256 },
  features: {
    eyeL_white: { x: 444, y: 129, w: 57, h: 39, a: [6, 6] },
    eyeL_iris: { x: 444, y: 129, w: 57, h: 39, a: [75, 6] },
    eyeL_lashU: { x: 444, y: 129, w: 57, h: 39, a: [144, 6] },
    eyeL_lashD: { x: 444, y: 129, w: 57, h: 39, a: [6, 57] },
    eyeR_white: { x: 521, y: 129, w: 57, h: 39, a: [75, 57] },
    eyeR_iris: { x: 521, y: 129, w: 57, h: 39, a: [144, 57] },
    eyeR_lashU: { x: 521, y: 129, w: 57, h: 39, a: [6, 108] },
    eyeR_lashD: { x: 521, y: 129, w: 57, h: 39, a: [75, 108] },
    browL: { x: 455, y: 112, w: 43, h: 25, a: [144, 108] },
    browR: { x: 520, y: 111, w: 48, h: 26, a: [199, 108] },
    mouth: { x: 490, y: 187, w: 40, h: 24, a: [6, 159] },
  },
  // each eye's white: its top and bottom edges at 9 points from x0 to x1, and the middle of the iris
  eyes: {
    L: { x0: 459, x1: 493, top: [152.92, 147.35, 146.06, 145.53, 145.16, 145.33, 145.84, 146.84, 151.87],
      bot: [152.92, 158.55, 160.71, 161.2, 161.42, 161.2, 160.43, 158.64, 151.87], iris: [477.5, 153.5], irisR: 10.5 },
    R: { x0: 529, x1: 563, top: [152.15, 146.63, 145.79, 145.31, 145.16, 145.6, 146.13, 147.7, 152.5],
      bot: [152.15, 158.87, 160.61, 161.24, 161.45, 161.13, 160.51, 158.17, 152.5], iris: [544, 153.5], irisR: 10 },
  },
  brows: { L: { pivot: [476.5, 124.5], inner: 1 }, R: { pivot: [544, 124], inner: -1 } },   // inner: which way her nose is
  mouth: { center: [511.3, 198] },
  cheeks: { L: [467, 176], R: [556, 176] },
  // her joints
  joints: {
    hip: [512, 640], waist: [512, 590], chest: [512, 420], neck: [512, 292], head: [512, 222],
    armL: { sh: [372, 335], el: [309, 522], wr: [205, 676], tip: [150, 795] },     // her right arm (on the left of the picture)
    armR: { sh: [652, 335], el: [711, 522], wr: [813, 676], tip: [874, 795] },     // her left arm
  },
  // the inside of each elbow: how far her arm's outline is from her elbow, every 4° from her forearm round the inside of
  // her elbow to her upper arm (measured by tools/agi1-2d/export.py). Where the two sides of her arm meet when she bends
  // is worked out from these (creaseAngle in agi1-2d-motion.js).
  elbows: {
    L: [323.2, 278.2, 119.5, 97, 82.2, 70.8, 62.8, 55.5, 50.2, 45.8, 41.8, 38.2, 35.8, 33, 31.5, 29.5, 28, 27.5, 26.2, 25.5,
      24.8, 24.2, 24.2, 24, 23.8, 23.8, 24.2, 24.8, 25.8, 26.8, 27.5, 29, 30.8, 32.8, 35, 39.2, 45, 53.8, 66.8, 88.2,
      212.5, 231.5],
    R: [328, 275, 123.5, 98, 82.8, 72.2, 63.2, 56.2, 50.8, 45.5, 41.8, 38.8, 35.5, 33.2, 31.8, 30, 28.5, 27.8, 27, 26.8,
      26.2, 26, 26, 26, 26, 26.2, 26.8, 27.2, 28.2, 29.2, 30.2, 31.8, 33.8, 36, 39.2, 43, 47.2, 54, 66.2, 88.5, 212],
  },
  // the markers the stage frames her by (like the 3D model's bones): the middle of her face and the top of her hair
  marks: { head: [512, 172], headTop: [512, 16], chest: [512, 400] },
  // her chest's soft follow-through (chestWeight / Jiggle in agi1-2d-motion.js, 2026-09-28): the middle of each side (L, R)
  // and of both (cx), the ovals' size, where it starts to move (top: below the AGI print) and where it moves fully (full).
  // Measured on her body picture: her silhouette is widest at y ≈ 405, the shadow under her chest at y ≈ 430–445.
  chest: { L: 448, R: 573, cx: 510.5, cy: 425, rx: 72, ry: 64, top: 395, full: 448 },
  // hair that swings: chains hanging from her head (their tops follow her head, their ends her body)
  hair: {
    back: { xs: [292, 346, 400, 452, 512, 572, 624, 678, 732], y0: 160, y1: 628, n: 8, follow: [175, 330] },
    front: { xs: [428, 596], y0: 150, y1: 340, n: 7, follow: [230, 330] },
  },
};
