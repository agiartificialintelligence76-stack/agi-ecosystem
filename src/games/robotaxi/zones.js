// ROBOTAXI RUSH: the four zones' looks (dusk, night city, rain, sunrise coast). Pure data.
// The arcade's sticker colors (ink, paper, honey, pink, violet, mint, lavender) on top; each zone's sky, ground and haze
// underneath. A road segment takes the colors of its own zone, so the next zone's road shows up past each checkpoint
// gate before you get there; the sky fades over as you pass it.
export const INK = '#170a36';
export const PAPER = '#fffaf0';
export const HONEY = '#ffc933';
export const PINK = '#ff4da6';
export const VIOLET = '#6b3bff';
export const VIOLET2 = '#8b66ff';
export const MINT = '#3ff0c3';
export const LAV = '#e4d9ff';
export const LAV2 = '#cdb8ff';
export const SKY = '#59c8ff';
export const RED = '#ff5a5f';

export const LOOKS = {
  dusk: {
    name: 'Dusk',
    sky: [[0, '#14062f'], [0.34, '#371070'], [0.6, '#7d1f8c'], [0.82, '#d93a82'], [1, '#ff8a6b']],
    fog: '#6a2585',
    fogDensity: 1,
    ground: ['#1d0b45', '#200c4c'],
    groundR: null,
    grid: '#ff4da6', gridMix: 0.62,
    road: ['#1c1236', '#21163f'],
    rumble: [PINK, PAPER],
    lane: HONEY,
    edge: PAPER,
    lights: 0.85,
    sun: 'striped',
    stars: 0.25,
    far: { kind: 'mountains', color: '#2c0e5e', rim: PINK },
    near: { kind: 'city', color: '#1b0a42', windows: [HONEY, PINK, '#ffb36b'], lit: 0.18 },
    props: 'dusk',
  },
  night: {
    name: 'Night City',
    sky: [[0, '#04020d'], [0.45, '#0b0628'], [0.8, '#1d0f4c'], [1, '#33186a']],
    fog: '#1b1042',
    fogDensity: 1.1,
    ground: ['#0a071d', '#0d0a24'],
    groundR: null,
    grid: VIOLET, gridMix: 0.45,
    road: ['#141029', '#18132f'],
    rumble: [VIOLET2, PAPER],
    lane: HONEY,
    edge: MINT,
    lights: 1,
    sun: 'moon',
    stars: 1,
    far: { kind: 'city', color: '#150c38', windows: [LAV2, '#7d6bd6'], lit: 0.1, tall: 0.75 },
    near: { kind: 'city', color: '#0c0824', windows: [HONEY, PINK, MINT, LAV2], lit: 0.34, tall: 1.15, antennas: true },
    props: 'night',
  },
  rain: {
    name: 'Rain',
    sky: [[0, '#070c18'], [0.5, '#111b31'], [0.85, '#22344f'], [1, '#33496a']],
    fog: '#283754',
    fogDensity: 1.55,
    ground: ['#0c1424', '#0e1729'],
    groundR: null,
    grid: null,
    road: ['#141b2b', '#172031'],
    rumble: [SKY, PAPER],
    lane: HONEY,
    edge: PAPER,
    lights: 1,
    sun: 'clouds',
    stars: 0,
    wet: true,
    far: { kind: 'city', color: '#17243b', windows: ['#5a7aa8'], lit: 0.06, tall: 0.8 },
    near: { kind: 'city', color: '#0f182b', windows: [SKY, HONEY, '#9fb7d8'], lit: 0.22, tall: 1 },
    props: 'rain',
  },
  coast: {
    name: 'Sunrise Coast',
    sky: [[0, '#5b49c9'], [0.32, '#a58bef'], [0.6, '#f5b4cf'], [0.84, '#ffd29e'], [1, '#ffe8bd']],
    fog: '#f6cdbd',
    fogDensity: 0.9,
    ground: ['#f2c58c', '#efbf84'],
    groundR: ['#36b3c7', '#31a9be'],
    foam: '#e8fbff',
    grid: null,
    road: ['#44376f', '#493c76'],
    rumble: [PINK, PAPER],
    lane: PAPER,
    edge: HONEY,
    lights: 0,
    sun: 'sunrise',
    stars: 0,
    far: { kind: 'isles', color: '#8f74d6', rim: '#ffd9e6' },
    near: { kind: 'hills', color: '#7a5fc4' },
    props: 'coast',
  },
};

// the road's colors, mixed with the zone's haze in FOG_STEPS steps (far segments fade into the haze)
export const FOG_STEPS = 7;
const hexToRgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const mixHex = (a, b, t) => {
  const A = hexToRgb(a), B = hexToRgb(b);
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
};
// fog[k]: how much haze at step k (0 = none)
export const fogAt = (k) => Math.pow(k / (FOG_STEPS - 1), 1.35) * 0.92;

// every color the road needs for a zone, with its haze steps: colors(look).road[0][k] …
export function roadColors(look) {
  const steps = (hex) => Array.from({ length: FOG_STEPS }, (_, k) => mixHex(hex, look.fog, fogAt(k)));
  const gridC = look.grid ? mixHex(look.ground[0], look.grid, look.gridMix) : null;
  return {
    ground: look.ground.map(steps),
    groundR: look.groundR ? look.groundR.map(steps) : null,
    foam: look.foam ? steps(mixHex(look.groundR[0], look.foam, 0.55)) : null,
    grid: gridC ? steps(gridC) : null,
    road: look.road.map(steps),
    rumble: look.rumble.map(steps),
    lane: steps(look.lane),
    edge: steps(look.edge),
    farGround: mixHex(look.ground[0], look.fog, 0.95),
    farGroundR: look.groundR ? mixHex(look.groundR[0], look.fog, 0.9) : null,
    shine: look.wet ? steps(mixHex(look.road[0], '#5d7aa6', 0.35)) : null,
  };
}
