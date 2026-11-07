// JAYWALK's toys (2026-11-08): every model as boxes [x0, y0, z0, x1, y1, z1, color, flags] in voxels (16 a cell for the
// street's things, 18.5 for the characters). Characters face -z (forward, away from the camera), with their soles at
// y = 0; vehicles, rafts and trains face +x (the way they drive). Flags: 'g' glows, 'n' no ink outline.
// Pure data (voxel.js turns it into three.js geometry). Our own designs: no real vehicles, brands or people.

const B = (x0, y0, z0, x1, y1, z1, c, f = '') => [x0, y0, z0, x1, y1, z1, c, f];
// a box and its mirror across x = 0
const P = (x0, y0, z0, x1, y1, z1, c, f = '') => [B(x0, y0, z0, x1, y1, z1, c, f), B(-x1, y0, z0, -x0, y1, z1, c, f)];

// ---------- palette ----------
export const C = Object.freeze({
  ink: '#2a1a52', skin: '#ffd9c6', blush: '#ff9fc4', mouth: '#c95a74', eye: '#c47a28', eyeDark: '#3a1d47', white: '#ffffff',
  hair: '#f5cf74', hairHi: '#ffe6a3', hairLo: '#dcae55',
  lav: '#c7b3ff', lav2: '#b29bff', lavHi: '#ddd0ff', violet: '#8b66ff', violetDeep: '#6b3bff',
  pink: '#ff8fc7', pinkDeep: '#ff4da6', honey: '#ffc933', honey2: '#ffd166', mint: '#3ff0c3', mint2: '#6fe6c1', sky: '#7fd3ff',
  glass: '#33295e', metal: '#9a93b5', tire: '#2c2347', pearl: '#f7f4ff',
});

// ---------- AGI-1 (and her outfits) ----------
// her shape: soles at 0, big head (13–21), long blonde hair down her back
function girl(o = {}) {
  const shirt = o.shirt || C.lav, sleeve = o.sleeve || shirt, shorts = o.shorts || C.lav2, trim = o.trim || C.white;
  const shoes = o.shoes || C.lav2, sole = o.sole || C.white, legs = o.legs || C.skin, arms = o.arms || C.skin;
  const b = [];
  // shoes and legs
  b.push(...P(0.6, 0, -3.2, 3.6, 1, 1.6, sole), ...P(0.8, 1, -2.8, 3.4, 2.6, 1.4, shoes));
  b.push(...P(0.9, 2.6, -1.1, 3.1, o.longLegs ? 8.6 : 5.6, 1.1, legs));
  // shorts with their trim
  if (!o.noShorts) b.push(B(-3.7, 5.2, -1.9, 3.7, 5.9, 1.9, trim), B(-3.6, 5.9, -1.8, 3.6, 8.8, 1.8, shorts));
  // the shirt, sleeves, arms and hands
  b.push(B(-3.4, 8.6, -1.7, 3.4, 12.8, 1.7, shirt));
  b.push(...P(3.4, o.longSleeves ? 7.6 : 10.4, -1.25, 4.7, 12.6, 1.25, sleeve));
  if (!o.longSleeves) b.push(...P(3.5, 7.6, -1, 4.5, 10.4, 1, arms));
  b.push(...P(3.5, 6.8, -1, 4.5, 7.6, 1, C.skin));
  if (o.print !== false) b.push(B(-1.6, 10.3, -1.85, 1.6, 11.4, -1.7, o.print || C.white));
  // neck and head
  b.push(B(-1.1, 12.8, -1, 1.1, 13.4, 1, C.skin), B(-4.5, 13.2, -3.8, 4.5, 21, 3.4, C.skin));
  // her face (the front: -z): amber eyes, a blush, a small smile
  b.push(...P(1.3, 15.3, -3.95, 3.1, 17.4, -3.75, C.eye), ...P(1.3, 16.5, -4.0, 3.1, 17.6, -3.75, C.eyeDark));
  b.push(...P(2.2, 16.7, -4.05, 2.8, 17.2, -3.9, C.white, 'n'));
  b.push(...P(2.9, 14.5, -3.9, 4.1, 15.1, -3.75, C.blush, 'n'), B(-0.6, 14.1, -3.9, 0.6, 14.6, -3.75, C.mouth, 'n'));
  if (!o.hood) {
    // her hair: a cap, the long back, the sides, a fringe, wavy ends, a highlight
    b.push(B(-5, 20.2, -4.3, 5, 22.6, 4.3, C.hair));
    b.push(B(-5, o.shortHair ? 12 : 8.2, 3.3, 5, 21, 5.1, C.hair));
    b.push(...P(4.3, 11.2, -2.6, 5.3, 21, 4.8, C.hair));
    b.push(...P(3.9, 9.8, -2.8, 5.4, 13.8, -0.4, C.hair));
    b.push(B(-4.7, 18.6, -4.45, -1.1, 20.6, -3.7, C.hair), B(-1.1, 18.0, -4.45, 2.3, 20.6, -3.7, C.hair), B(2.3, 18.9, -4.45, 4.7, 20.6, -3.7, C.hair));
    if (!o.shortHair) b.push(B(-4.6, 7.0, 3.6, -1.4, 8.4, 5.2, C.hairLo), B(1.0, 7.4, 3.6, 4.5, 8.4, 5.2, C.hairLo), B(-1.2, 6.6, 3.8, 1.2, 8.4, 5.0, C.hair));
    b.push(B(-3, 22.4, -2.2, 1.6, 23.0, 2.6, C.hairHi), B(-2.6, 12, 5.0, 2.2, 19, 5.3, C.hairHi, 'n'));
  }
  if (o.extra) b.push(...o.extra);
  return b;
}

export const CHARACTER_MODELS = {
  agi: () => girl(),
  hoodie: () => girl({
    shirt: '#ff8fc7', sleeve: '#ff8fc7', longSleeves: true, shorts: '#8f88ad', trim: '#8f88ad', legs: '#8f88ad', longLegs: true,
    noShorts: true, shoes: C.white, sole: '#ff8fc7', print: '#ffd1e8',
    extra: [
      B(-3.7, 8.6, 1.6, 3.7, 9.4, 1.9, '#ff6fb5'),          // the hem
      B(-3.6, 11.4, 4.9, 3.6, 14.6, 6.4, '#ff8fc7'),        // the hood, down on her back
      B(-2.6, 12.2, 6.3, 2.6, 14.0, 6.6, '#ff6fb5'),
      ...P(0.6, 10.8, -1.95, 1.1, 12.6, -1.7, C.white, 'n'), // its strings
      B(-3.7, 2.6, -1.9, 3.7, 8.8, 1.9, '#8f88ad'),          // joggers
    ],
  }),
  raincoat: () => girl({
    shirt: C.honey, sleeve: C.honey, longSleeves: true, noShorts: true, shoes: C.mint2, sole: '#3fd6a8', print: false, hood: true,
    extra: [
      B(-4.1, 4.6, -2.2, 4.1, 9.2, 2.2, C.honey),            // the coat's flare
      B(-0.4, 5.2, -2.35, 0.4, 12.6, -2.15, '#e0a800', 'n'),  // its buttons' line
      ...[6.2, 8.4, 10.6].map((y) => B(-1.1, y, -2.4, -0.4, y + 0.9, -2.15, C.ink, 'n')),
      ...P(0.8, 0, -3.2, 3.6, 4.6, 1.6, C.mint2),             // rain boots
      // the hood up, framing her face, her fringe and her hair peeking out
      B(-5.4, 20.2, -4.2, 5.4, 23.6, 5.4, C.honey),
      ...P(4.5, 13, -3.4, 5.6, 21.4, 5.4, C.honey),
      B(-5.4, 12.6, 3.4, 5.4, 21.4, 5.6, C.honey),
      B(-4.6, 18.8, -4.45, 4.6, 20.4, -3.7, C.hair),
      B(-4.4, 9.2, 3.2, 4.4, 12.8, 4.8, C.hair),
      B(-5.5, 23.4, -0.5, 5.5, 24, 0.5, '#e0a800'),
    ],
  }),
  pajamas: () => girl({
    shirt: '#9ef0d4', sleeve: '#9ef0d4', longSleeves: true, noShorts: true, legs: '#9ef0d4', longLegs: true, shoes: '#ffb3d1', sole: '#ffd6e6',
    print: false, hood: true,
    extra: [
      B(-3.7, 2.6, -1.9, 3.7, 8.8, 1.9, '#9ef0d4'),
      // white dots
      ...[[-2.2, 4.2], [1.4, 6.6], [-1.0, 9.8], [2.0, 11.6], [-2.6, 7.2]].map(([x, y]) => B(x, y, -1.95, x + 0.9, y + 0.9, -1.75, C.white, 'n')),
      ...[[-2.4, 10.2], [1.2, 5.0]].map(([x, y]) => B(x, y, 1.75, x + 0.9, y + 0.9, 1.95, C.white, 'n')),
      // a bunny hood: soft white, two tall ears (pink inside), her sleep mask pushed up
      B(-5.3, 20.2, -4.2, 5.3, 23.2, 5.2, '#fff4fa'),
      ...P(4.4, 13, -3.4, 5.5, 21.4, 5.2, '#fff4fa'),
      B(-5.3, 12.6, 3.4, 5.3, 21.4, 5.4, '#fff4fa'),
      ...P(1.4, 23.2, -0.6, 3.6, 31, 1.4, '#fff4fa'),
      ...P(1.9, 24.2, -0.75, 3.1, 30, -0.55, '#ffb3d1', 'n'),
      B(-4.7, 18.6, -4.45, 4.7, 19.6, -3.7, C.hair),
      B(-4.7, 19.6, -4.5, 4.7, 20.8, -3.8, '#cdb8ff'),
      B(-4.0, 9.4, 3.2, 4.0, 12.8, 4.6, C.hair),
    ],
  }),
  astro: () => girl({
    shirt: C.pearl, sleeve: C.pearl, longSleeves: true, noShorts: true, legs: C.pearl, longLegs: true, shoes: '#b9b2d6', sole: '#8f88ad',
    print: false, hood: true,
    extra: [
      B(-3.7, 2.6, -1.9, 3.7, 8.8, 1.9, C.pearl),
      B(-3.8, 8.0, -2.0, 3.8, 9.0, 2.0, C.lav2),             // belt
      ...P(1.0, 4.2, -1.35, 3.0, 5.6, -1.15, C.lav, 'n'),    // knee pads
      B(-1.5, 10.6, -1.95, -0.3, 11.6, -1.75, C.pinkDeep, 'n'), B(-1.9, 11.2, -1.95, 0.1, 11.8, -1.75, C.pinkDeep, 'n'),
      B(-3.4, 8.4, 1.7, 3.4, 13.2, 4.0, '#e4dcff'),           // her backpack
      B(-2.4, 9.4, 4.0, 2.4, 12.2, 4.3, C.mint, 'g'),
      // an open helmet around her face: her fringe shows, a mint visor flipped up
      B(-5.6, 20.6, -4.5, 5.6, 24, 4.7, C.pearl),
      ...P(4.6, 12.4, -4.5, 5.7, 21, 4.7, C.pearl),
      B(-5.6, 12.4, 3.4, 5.6, 21, 4.8, C.pearl),
      B(-5.0, 21.4, -4.9, 5.0, 23.2, -4.4, '#8fe8ff', 'g'),
      B(-4.6, 18.8, -4.45, 4.6, 20.6, -3.7, C.hair),
      B(3.6, 24, -0.4, 4.2, 27.4, 0.2, C.metal), B(3.4, 27.4, -0.6, 4.4, 28.4, 0.4, C.pinkDeep, 'g'),
      B(-5.8, 12.0, -4.6, 5.8, 12.8, 4.9, C.lav2),
    ],
  }),
  // her cat: fluffy, grey, striped, white chest and paws
  cat: () => {
    const fur = '#b6b0c8', dark = '#857e9e', white = '#fbf9ff', pinkC = '#ff9fbf';
    const b = [];
    b.push(B(-4, 3, -5, 4, 10, 6.2, fur));
    for (const z of [-2.6, 0.4, 3.4]) b.push(B(-4.2, 8.4, z, 4.2, 10.3, z + 1.1, dark));
    b.push(B(-2.6, 3.6, -5.3, 2.6, 8.4, -4.8, white));
    for (const [z0, z1] of [[-4.6, -2.4], [3, 5.2]]) b.push(...P(1.3, 0, z0, 3.6, 3.4, z1, fur), ...P(1.3, 0, z0 - 0.15, 3.6, 1.1, z1, white));
    // head, cheeks, muzzle, nose, eyes, ears
    b.push(B(-4.6, 7.2, -10.2, 4.6, 14.4, -3.6, fur));
    b.push(...P(4.4, 7.8, -8.6, 5.6, 11.4, -4.6, fur));
    b.push(B(-4.6, 13.6, -9.0, 4.6, 14.6, -7.4, dark), B(-1.2, 12.4, -10.4, 1.2, 14.5, -9.6, dark));
    b.push(B(-2.2, 7.6, -10.5, 2.2, 10.4, -9.9, white), B(-0.7, 10.2, -10.7, 0.7, 11.0, -10.3, pinkC, 'n'));
    b.push(...P(1.5, 11.0, -10.45, 3.4, 12.8, -10.15, '#d9a33a'), ...P(2.1, 11.2, -10.55, 2.8, 12.6, -10.35, C.eyeDark, 'n'));
    b.push(...P(1.6, 14.4, -8.4, 4.4, 17.6, -5.8, fur), ...P(2.2, 14.6, -8.55, 3.8, 16.6, -8.35, pinkC, 'n'));
    // her big fluffy tail, up and curling forward
    b.push(B(-1.5, 6, 5.8, 1.5, 9.6, 8.8, fur));
    b.push(B(-1.8, 9.6, 7.0, 1.8, 17.2, 10.2, fur));
    for (const y of [11, 14]) b.push(B(-1.95, y, 6.85, 1.95, y + 1.2, 10.35, dark));
    b.push(B(-1.6, 17.2, 5.0, 1.6, 19.4, 9.2, dark));
    return b;
  },
};

// ---------- vehicles (facing +x) ----------
const wheels = (xs, half, r = 4.2, hub = C.metal) => xs.flatMap((x) => [
  B(x - 2, 0, half - 1.8, x + 2, r, half + 0.4, C.tire), B(x - 2, 0, -half - 0.4, x + 2, r, -half + 1.8, C.tire),
  B(x - 0.9, 1.2, half + 0.4, x + 0.9, r - 1.2, half + 0.7, hub, 'n'), B(x - 0.9, 1.2, -half - 0.7, x + 0.9, r - 1.2, -half - 0.4, hub, 'n'),
]);
const CAR_COLORS = ['#ff8fc7', '#7fd3ff', '#ffd166', '#6fe6c1'];
export const VEHICLE_MODELS = {
  car: (v = 0) => {
    const body = CAR_COLORS[v % 4];
    return [
      B(-12, 2.2, -6.2, 12, 7.6, 6.2, body),
      B(-6, 7.6, -5.4, 5, 12.4, 5.4, body),
      B(-5.4, 8.3, -5.6, 4.4, 11.8, 5.6, C.glass, 'n'),
      B(4.6, 8.3, -4.8, 5.4, 11.8, 4.8, C.glass, 'n'),
      B(-6.4, 8.3, -4.8, -5.6, 11.8, 4.8, C.glass, 'n'),
      B(-5.8, 12.2, -5.0, 4.6, 13.0, 5.0, '#ffffff'),
      B(11.6, 2.0, -6.0, 12.8, 3.4, 6.0, '#e9e4ff'), B(-12.8, 2.0, -6.0, -11.6, 3.4, 6.0, '#e9e4ff'),
      B(12, 4.6, -5.2, 12.5, 6.2, -3.2, C.honey, 'gn'), B(12, 4.6, 3.2, 12.5, 6.2, 5.2, C.honey, 'gn'),
      B(-12.5, 4.6, -5.2, -12, 6.2, -3.2, C.pinkDeep, 'gn'), B(-12.5, 4.6, 3.2, -12, 6.2, 5.2, C.pinkDeep, 'gn'),
      ...wheels([-7, 7], 5),
    ];
  },
  taxi: () => [
    B(-13.5, 2.2, -6.4, 13.5, 8, 6.4, C.pearl),
    B(-9, 8, -5.8, 9.5, 12.4, 5.8, C.glass),
    B(-9.6, 12.4, -6.0, 10, 13.4, 6.0, C.pearl),
    B(-13.6, 6.0, -6.6, 13.6, 6.8, 6.6, C.mint, 'g'),
    B(-2.6, 13.4, -2.6, 2.6, 14.0, 2.6, C.mint, 'g'),
    B(-2.0, 14.0, -2.0, 2.0, 15.8, 2.0, '#e4d9ff'),
    B(13.5, 4.6, -5, 14.0, 5.8, 5, C.honey, 'gn'),
    B(-14.0, 4.6, -5, -13.5, 5.8, 5, C.pinkDeep, 'gn'),
    ...wheels([-8.5, 8.5], 5.2),
  ],
  van: (v = 0) => {
    const body = ['#d9ccff', '#ffd166'][v % 2];
    const heart = [[1, 0], [2, 0], [4, 0], [5, 0], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [2, 3], [3, 3], [4, 3], [3, 4]];
    const deco = heart.flatMap(([hx, hy]) => {
      const x = -9 + hx * 1.3, y = 13 - hy * 1.3;
      return [B(x, y - 1.3, 6.8, x + 1.3, y, 7.05, C.pinkDeep, 'n'), B(x, y - 1.3, -7.05, x + 1.3, y, -6.8, C.pinkDeep, 'n')];
    });
    return [
      B(-17, 2.2, -6.8, 7, 15.6, 6.8, body),
      B(7, 2.2, -6.4, 17, 7.6, 6.4, body),
      B(7.4, 7.6, -6.0, 12.6, 11.6, 6.0, body),
      B(7.6, 7.9, -6.2, 12.2, 11.2, 6.2, C.glass, 'n'),
      B(12.6, 7.6, -5.4, 13.4, 11.0, 5.4, C.glass, 'n'),
      B(12.6, 7.6, -6.0, 13.0, 7.9, 6.0, body),
      B(-17.2, 15.6, -6.6, 6.8, 16.2, 6.6, '#ffffff'),
      B(17, 4.4, -5.4, 17.5, 6.0, 5.4, C.honey, 'gn'),
      B(-17.5, 4.4, -5.6, -17, 6.2, 5.6, C.pinkDeep, 'gn'),
      ...deco,
      ...wheels([-11, 11], 5.4),
    ];
  },
  bus: () => {
    const b = [
      B(-26.5, 2.4, -7, 26.5, 17, 7, '#8b66ff'),
      B(-26.6, 2.4, -7.1, 26.6, 5.2, 7.1, '#6b3bff'),
      B(-24, 9.4, -7.2, 24, 15, 7.2, C.glass, 'n'),
      B(26.5, 6, -6, 27, 15, 6, C.glass, 'n'),
      B(-26, 17, -6.5, 26, 18, 6.5, '#cdb8ff'),
      B(-8, 18, -4, 4, 19.6, 4, '#e4d9ff'),
      B(-26.7, 7, -7.2, 26.7, 8, 7.2, C.mint, 'g'),
      B(26.6, 15.4, -4, 27.1, 16.8, 4, C.honey, 'gn'),
      B(26.6, 3.6, -6, 27.1, 5.0, -3.6, C.honey, 'gn'), B(26.6, 3.6, 3.6, 27.1, 5.0, 6, C.honey, 'gn'),
      B(-27.1, 3.6, -6, -26.6, 5.0, -3.6, C.pinkDeep, 'gn'), B(-27.1, 3.6, 3.6, -26.6, 5.0, 6, C.pinkDeep, 'gn'),
      ...wheels([-18, 18], 6, 4.8),
    ];
    for (const x of [-16, -8, 0, 8, 16]) b.push(B(x - 0.7, 9.4, -7.3, x + 0.7, 15, 7.3, '#8b66ff', 'n'));
    return b;
  },
  // a little delivery bot zipping along on a scooter
  scooter: (v = 0) => {
    const bot = ['#f7f4ff', '#9ef0d4'][v % 2];
    return [
      B(-6, 1.6, -1.8, 4, 2.8, 1.8, C.tire),
      B(-6.6, 0, -1.2, -3.4, 3, 1.2, '#4a3d6e'), B(3.4, 0, -1.2, 6.6, 3, 1.2, '#4a3d6e'),
      B(4, 2.8, -0.8, 5.2, 13, 0.8, C.metal),
      B(3.8, 12.4, -4, 5.4, 13.4, 4, C.metal),
      B(-3.5, 2.8, -3, 2.5, 10.6, 3, bot),
      B(-3, 10.6, -3.2, 3, 16, 3.2, bot),
      B(3, 12.2, -2.4, 3.4, 14.6, 2.4, C.sky, 'g'),
      B(-0.4, 16, -0.4, 0.4, 19, 0.4, C.metal), B(-0.8, 19, -0.8, 0.8, 20.4, 0.8, C.pinkDeep, 'g'),
      B(-6.4, 4.8, -3, -3.5, 10.2, 3, C.honey),
    ];
  },
};

// ---------- the data river's rafts (facing +x, their top at RAFT_TOP voxels) ----------
export const RAFT_TOP = 4.2;
const LED = [C.mint, C.pinkDeep, C.honey, C.sky];
export function rackModel(n) {
  const h = n * 8 - 0.6;
  const b = [
    B(-h, -4, -6.8, h, 3.4, 6.8, '#2f2759'),
    B(-h + 0.4, 3.4, -6.4, h - 0.4, 4.2, 6.4, '#5b4d85'),
    B(-h, 3.4, -6.9, h, 4.4, -6.1, '#b9a3ff'), B(-h, 3.4, 6.1, h, 4.4, 6.9, '#b9a3ff'),
    B(-h - 0.1, -1.8, -6.95, h + 0.1, -1.0, 6.95, '#1f1940', 'n'),
  ];
  for (let k = 0; k < n * 3; k++) {
    const x = -h + 2 + k * ((2 * h - 4) / Math.max(1, n * 3 - 1)) - 0.6;
    const c = LED[(k * 7 + n) % LED.length];
    b.push(B(x, 0.4, 6.8, x + 1.2, 1.6, 7.1, c, 'gn'), B(x, 0.4, -7.1, x + 1.2, 1.6, -6.8, c, 'gn'));
  }
  // its slots: faint seams on the deck, one a cell, so you can see where she'll stand
  for (let k = 1; k < n; k++) b.push(B(-h + k * 16 - 0.3 - 0.0, 4.2, -5.6, -h + k * 16 + 0.3, 4.3, 5.6, '#463a6e', 'n'));
  return b;
}
export function padsModel(n) {
  const b = [];
  for (let j = 0; j < n; j++) {
    const cx = (j - (n - 1) / 2) * 16;
    b.push(B(cx - 6.8, 1.2, -6.8, cx + 6.8, 3.4, 6.8, '#f1ecff'));
    b.push(B(cx - 7, 3.4, -7, cx + 7, 4.2, -6, C.mint, 'g'), B(cx - 7, 3.4, 6, cx + 7, 4.2, 7, C.mint, 'g'));
    b.push(B(cx - 7, 3.4, -6, cx - 6, 4.2, 6, C.mint, 'g'), B(cx + 6, 3.4, -6, cx + 7, 4.2, 6, C.mint, 'g'));
    b.push(B(cx - 5, 0, -5, cx + 5, 1.2, 5, '#8b66ff', 'g'));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.push(B(cx + sx * 7.8 - 1, 2.2, sz * 7.8 - 1, cx + sx * 7.8 + 1, 3.2, sz * 7.8 + 1, C.tire));
  }
  return b;
}

// ---------- the maglev (a car is 2.5 cells: 40 voxels; facing +x) ----------
export function trainModel(part) {
  const b = [];
  const body = C.pearl;
  if (part === 'mid') {
    b.push(B(-19.6, 3, -6.6, 19.6, 17, 6.6, body), B(-19, 17, -5.6, 19, 18.4, 5.6, '#e4d9ff'));
    b.push(B(-18, 9.6, -6.8, 18, 14, 6.8, C.glass, 'n'));
    for (const x of [-9, 0, 9]) b.push(B(x - 0.6, 9.6, -6.9, x + 0.6, 14, 6.9, body, 'n'));
    b.push(B(-19.6, 6.4, -6.9, 19.6, 8, 6.9, C.violetDeep), B(-17, 1.4, -5.4, 17, 3, 5.4, C.mint, 'g'));
    b.push(B(-20, 4, -5.8, -19.6, 16, 5.8, '#4a3d6e', 'n'), B(19.6, 4, -5.8, 20, 16, 5.8, '#4a3d6e', 'n'));
  } else {
    // the nose at +x
    b.push(B(-19.6, 3, -6.6, 8, 17, 6.6, body), B(-19, 17, -5.6, 7.4, 18.4, 5.6, '#e4d9ff'));
    b.push(B(8, 3, -6.6, 14, 14.2, 6.6, body), B(14, 3, -6.4, 18, 10.6, 6.4, body), B(18, 3, -6, 20, 7, 6, body));
    b.push(B(8, 12.4, -5.4, 14.4, 14.6, 5.4, C.glass, 'n'), B(14, 9.6, -5.2, 18.2, 10.9, 5.2, C.glass, 'n'));
    b.push(B(-18, 9.6, -6.8, 7, 14, 6.8, C.glass, 'n'));
    b.push(B(-19.6, 6.4, -6.9, 18.2, 8, 6.9, C.violetDeep), B(-17, 1.4, -5.4, 17, 3, 5.4, C.mint, 'g'));
    b.push(B(19.8, 3.8, -5, 20.3, 5.4, -2.6, part === 'head' ? C.honey : C.pinkDeep, 'gn'), B(19.8, 3.8, 2.6, 20.3, 5.4, 5, part === 'head' ? C.honey : C.pinkDeep, 'gn'));
    b.push(B(-20, 4, -5.8, -19.6, 16, 5.8, '#4a3d6e', 'n'));
  }
  return b;
}

// ---------- the street's things (16 voxels a cell; their foot at y = 0) ----------
export const PROP_MODELS = {
  tree: () => [
    B(-1.6, 0, -1.6, 1.6, 8, 1.6, '#9b7867'),
    B(-7, 8, -7, 7, 17, 7, '#ffb3d6'),
    B(-5, 17, -5, 5, 22, 5, '#ffc6e0'),
    B(-7.6, 9.6, -7.6, -2.4, 14, -2.6, '#ff9dc9'), B(2, 13.4, 2, 7.6, 18, 7.6, '#ffd6ea'), B(-3, 21.4, -2, 2, 23.4, 3, '#ffe1ef'),
  ],
  tree2: () => [
    B(-1.6, 0, -1.6, 1.6, 7, 1.6, '#9b7867'),
    B(-6.6, 7, -6.6, 6.6, 15.6, 6.6, '#73dbb0'),
    B(-4.6, 15.6, -4.6, 4.6, 20.4, 4.6, '#8fe8c3'),
    B(2, 9, -7.2, 7.2, 13.6, -2, '#5fcd9f'), B(-7.2, 12, 1, -2.4, 16, 7.2, '#9cf0cc'),
  ],
  bush: () => [
    B(-6, 0, -6, 6, 6.6, 6, '#79d9ad'), B(-4.2, 6.6, -4.2, 4.2, 9.4, 4.2, '#93e9c1'),
    B(-3, 5.6, -6.3, -1.8, 6.8, -6, '#ff8fc7', 'n'), B(2.2, 3.6, -6.3, 3.4, 4.8, -6, '#ffd166', 'n'), B(0, 9.2, -1, 1.2, 10, 0.2, '#ff8fc7', 'n'),
  ],
  rock: () => [B(-6, 0, -5, 6, 5.6, 5, '#c8c2dc'), B(-4, 5.6, -3, 3, 8.2, 3, '#ddd8ec'), B(2, 0, 4, 7, 3, 6.6, '#b8b1d0')],
  bench: () => [
    B(-7, 4, -3, 7, 5.2, 1.2, '#cdb8ff'), B(-7, 5.2, 1.0, 7, 10, 2.4, '#cdb8ff'),
    ...P(5, 0, -2.6, 6, 4, 1.8, '#4a3d6e'), B(-7.2, 9.4, 0.8, 7.2, 10.4, 2.6, '#b29bff'),
  ],
  lamp: () => [
    B(-2, 0, -2, 2, 2, 2, '#4a3d6e'), B(-0.9, 2, -0.9, 0.9, 24, 0.9, '#4a3d6e'),
    B(-0.9, 22.4, -0.9, 5.4, 23.8, 0.9, '#4a3d6e'), B(2.4, 21, -2, 6.4, 24.2, 2, '#4a3d6e'),
    B(2.8, 20.4, -1.6, 6, 21, 1.6, '#ffe08a', 'g'),
  ],
  hydrant: () => [
    B(-3, 0, -3, 3, 1.4, 3, '#d9406e'), B(-2.4, 1.4, -2.4, 2.4, 8, 2.4, '#ff5a8a'),
    B(-2.8, 8, -2.8, 2.8, 9.2, 2.8, '#d9406e'), B(-1.2, 9.2, -1.2, 1.2, 10.6, 1.2, '#ff5a8a'),
    ...P(2.4, 4.4, -1, 3.6, 6, 1, '#d9406e'),
  ],
  vend: () => [
    B(-6, 0, -4.5, 6, 20, 4.5, '#7fd3ff'),
    B(-4.8, 6, 4.5, 1.6, 18, 4.9, '#d8f6ff', 'g'),
    ...[[-4, 15], [-1.4, 15], [-4, 11.6], [-1.4, 11.6], [-4, 8.2], [-1.4, 8.2]].map(([x, y], k) => B(x, y, 4.9, x + 1.8, y + 2.2, 5.1, [C.pinkDeep, C.honey, C.mint, C.violet][k % 4], 'n')),
    B(2.6, 9, 4.5, 5, 11, 4.8, C.ink, 'n'), B(-4, 1.8, 4.5, 4, 4.4, 4.8, C.ink, 'n'),
    B(-6.2, 18.6, -4.7, 6.2, 20.4, 4.7, '#ff8fc7'),
  ],
  planter: () => [
    B(-6, 0, -6, 6, 5, 6, '#d9ccff'), B(-5.4, 5, -5.4, 5.4, 5.4, 5.4, '#7a5d4f'),
    B(-4, 5.4, -4, 4, 10, 4, '#7fe0b8'), B(-2.4, 10, -2.4, 2.4, 12, 2.4, '#9cf0cc'),
    B(-3.2, 9.4, -4.3, -2, 10.6, -4, '#ff8fc7', 'n'), B(1.6, 11.6, -1, 2.8, 12.6, 0.2, '#ffd166', 'n'), B(3, 7, -4.3, 4.2, 8.2, -4, '#ffffff', 'n'),
  ],
  bin: () => [B(-3.5, 0, -3.5, 3.5, 9, 3.5, '#6fe6c1'), B(-4, 9, -4, 4, 10.2, 4, '#45c99f'), B(-1.4, 10.2, -0.6, 1.4, 11, 0.6, '#45c99f')],
  flowers: () => [
    B(-4, 0, -3, -3, 2.2, -2, '#5fcd9f', 'n'), B(-4.5, 2.2, -3.5, -2.5, 3.4, -1.5, '#ff8fc7', 'n'),
    B(2, 0, 1, 3, 1.8, 2, '#5fcd9f', 'n'), B(1.5, 1.8, 0.5, 3.5, 3.0, 2.5, '#ffd166', 'n'),
    B(-0.5, 0, 3, 0.5, 1.4, 4, '#5fcd9f', 'n'), B(-1, 1.4, 2.5, 1, 2.4, 4.5, '#ffffff', 'n'),
  ],
  signal: () => [
    B(-1, 0, -1, 1, 2, 1, '#4a3d6e'), B(-0.7, 2, -0.7, 0.7, 19, 0.7, '#4a3d6e'),
    B(-2.8, 12.4, -1.2, 2.8, 16.4, 1.2, '#2c2347'),
    B(-4.4, 17.4, -0.5, 4.4, 20.6, 0.5, '#ffffff'), B(-4.4, 18.6, -0.6, 4.4, 19.4, 0.6, '#ff4d6d', 'n'),
  ],
  chev: () => [
    B(-3, 0, -3.6, -1, 0.3, -1.6, '#ffffff', 'n'), B(-1, 0, -1.6, 1, 0.3, 0.4, '#ffffff', 'n'), B(-3, 0, 1.6, -1, 0.3, 3.6, '#ffffff', 'n'),
    B(1, 0, -1.6, 3, 0.3, 0.4, '#ffffff', 'n'), B(-1, 0, 0.4, 1, 0.3, 1.6, '#ffffff', 'n'),
  ],
};

// ---------- hearts, the security drone, sparkles ----------
const HEART = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
export function heartModel(color = C.pinkDeep, hi = '#ffd1e8') {
  const b = [];
  const s = 1.7;
  for (let r = 0; r < HEART.length; r++) {
    for (let c = 0; c < 7; c++) {
      if (HEART[r][c] !== '#') continue;
      const x = (c - 3.5) * s, y = (HEART.length - 1 - r) * s;
      b.push(B(x, y, -1.6, x + s, y + s, 1.6, color));
    }
  }
  b.push(B(-3.5 * s + s, 4 * s, -1.75, -3.5 * s + 2 * s, 5 * s, 1.75, hi, 'n'));
  return b;
}
export function droneModel() {
  return [
    B(-5, 0, -5, 5, 3.6, 5, '#4a3d6e'),
    B(-3.2, 3.6, -3.2, 3.2, 5.6, 3.2, '#cdb8ff'),
    B(-2.2, 1, 5, 2.2, 2.8, 5.4, '#ff5a5f', 'g'),
    B(-2.6, 5.6, -0.8, -0.8, 6.6, 0.8, '#ff5a5f', 'g'), B(0.8, 5.6, -0.8, 2.6, 6.6, 0.8, '#59c8ff', 'g'),
    B(5, 2, -0.8, 9.4, 3, 0.8, '#4a3d6e'), B(-9.4, 2, -0.8, -5, 3, 0.8, '#4a3d6e'),
    B(-0.8, 2, 5, 0.8, 3, 9.4, '#4a3d6e'), B(-0.8, 2, -9.4, 0.8, 3, -5, '#4a3d6e'),
    B(8.4, 3, -1, 10.4, 4, 1, C.tire), B(-10.4, 3, -1, -8.4, 4, 1, C.tire), B(-1, 3, 8.4, 1, 4, 10.4, C.tire), B(-1, 3, -10.4, 1, 4, -8.4, C.tire),
    B(-0.6, -3, -0.6, 0.6, 0, 0.6, C.metal), B(-2.6, -3.8, -0.6, 2.6, -2.8, 0.6, C.metal),
    B(-2.6, -5.4, -0.6, -1.6, -3.8, 0.6, C.metal), B(1.6, -5.4, -0.6, 2.6, -3.8, 0.6, C.metal),
  ];
}
export const rotorModel = () => [B(-4.4, 0, -0.7, 4.4, 0.5, 0.7, '#e9e4ff', 'n'), B(-0.7, 0, -4.4, 0.7, 0.5, 4.4, '#e9e4ff', 'n')];
export const sparkModel = () => [B(-2, -0.6, -0.6, 2, 0.6, 0.6, C.honey, 'g'), B(-0.6, -2, -0.6, 0.6, 2, 0.6, C.honey, 'g'), B(-0.6, -0.6, -2, 0.6, 0.6, 2, C.honey, 'g')];
