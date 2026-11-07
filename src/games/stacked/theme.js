// STACKED's look (2026-11-08): the five skies the tower climbs through and the colours of its floors. Pure data and
// maths (no DOM, no three.js): scene.js turns it into shader uniforms, tests/stacked.test.js reads it.
//
// Art direction: a premium night-to-space diorama. Flat, lit floors with an ink outline (the arcade's sticker line),
// lit office windows, and a sky that changes by zone: plum city night with its skyline and moon, slate rain clouds,
// a peach sunrise over a sea of clouds, the deep blue stratosphere over the curve of the Earth, then black orbit.
// The floors ramp through the arcade palette so each zone's floors stand out against its sky (warm on the night,
// cool on the sunrise, warm again on the blue).

export const INK = '#170a36';

// the floors' colour by floor number: keyframes, interpolated; past the last one it cycles
export const RAMP = Object.freeze([
  [0, '#ffc933'],    // honey
  [9, '#ff9a3d'],    // tangerine
  [18, '#ff5f6d'],   // coral
  [27, '#ff4da6'],   // pink
  [37, '#b45cff'],   // orchid
  [47, '#6b7bff'],   // periwinkle
  [56, '#4cc3ff'],   // sky
  [68, '#3ff0c3'],   // mint
  [80, '#8fe86a'],   // lime
  [90, '#ffc933'],   // honey again for the blue stratosphere
  [104, '#ff9a3d'],
  [118, '#ff5f6d'],
  [132, '#ff4da6'],
  [142, '#b45cff'],  // orbit: the whole palette, round and round
  [152, '#6b7bff'],
  [162, '#4cc3ff'],
  [172, '#3ff0c3'],
  [182, '#8fe86a'],
  [192, '#ffc933'],
  [202, '#ff9a3d'],
  [212, '#ff5f6d'],
  [222, '#ff4da6'],
  [232, '#b45cff'],  // = floor 142's: the cycle closes
]);
const CYCLE_FROM = 142, CYCLE = 232 - 142;

export function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
export function rgbToHex([r, g, b]) {
  const c = (v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
const mixRgb = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const smooth = (t) => t * t * (3 - 2 * t);

// a floor's colour as [r, g, b] in 0…1 (each floor a little different from the one below)
export function floorRgb(n) {
  let f = Math.max(0, n);
  if (f > RAMP[RAMP.length - 1][0]) f = CYCLE_FROM + ((f - CYCLE_FROM) % CYCLE);
  for (let i = 1; i < RAMP.length; i++) {
    const [f1, c1] = RAMP[i];
    if (f <= f1) {
      const [f0, c0] = RAMP[i - 1];
      return mixRgb(hexToRgb(c0), hexToRgb(c1), smooth((f - f0) / (f1 - f0)));
    }
  }
  return hexToRgb(RAMP[RAMP.length - 1][1]);
}
export const floorHex = (n) => rgbToHex(floorRgb(n));

// ---------- the skies ----------
// colours are hex; numbers are weights (0…1) or sizes. Every key is in every theme, so two themes blend key by key.
// sky: top / mid / bottom of the gradient (bottom = the haze the tower's base fades into); light: the sun's colour and
// strength; amb: the ambient light from above and below; glass: unlit windows; lit: share of windows lit
export const THEMES = Object.freeze([
  { id: 'city',
    top: '#0a0b26', mid: '#1d1747', bot: '#4b2257', midAt: 0.5,
    light: '#ffe9cf', lightK: 0.62, ambTop: '#6a66c4', ambBot: '#2a1d4f',
    glass: '#1c1f48', lit: 0.58, winA: '#ffc94d', winB: '#6ff5d0', winC: '#ff7ab8',
    stars: 0.85, skyline: 1, moon: 1, rain: 0, clouds: 0, cloudA: '#3a3560', cloudB: '#5a5080',
    sun: 0, sunCol: '#fff3c9', sea: 0, seaA: '#ffffff', seaB: '#ffd1c2',
    earth: 0, earthR: 6, earthY: -0.36, earthCol: '#2a63c8', limb: '#bff3ff',
    island: '#3a2f68', park: '#21443e', islandSide: '#22183f' },
  { id: 'rain',
    top: '#171a30', mid: '#343854', bot: '#646886', midAt: 0.55,
    light: '#e4e6ff', lightK: 0.5, ambTop: '#8f92bd', ambBot: '#2b2c47',
    glass: '#28304f', lit: 0.46, winA: '#ffc94d', winB: '#6ff5d0', winC: '#ff7ab8',
    stars: 0, skyline: 0, moon: 0, rain: 1, clouds: 1, cloudA: '#4a4e6e', cloudB: '#7d809f',
    sun: 0, sunCol: '#fff3c9', sea: 0, seaA: '#ffffff', seaB: '#ffd1c2',
    earth: 0, earthR: 6, earthY: -0.36, earthCol: '#2a63c8', limb: '#bff3ff',
    island: '#3a2f68', park: '#21443e', islandSide: '#22183f' },
  { id: 'sunrise',
    top: '#5566c2', mid: '#f29a8a', bot: '#ffd48c', midAt: 0.5,
    light: '#ffd9a6', lightK: 0.78, ambTop: '#b8a8ff', ambBot: '#d9897c',
    glass: '#3d4c8e', lit: 0.1, winA: '#ffd36b', winB: '#a3fff0', winC: '#ffb0d6',
    stars: 0, skyline: 0, moon: 0, rain: 0, clouds: 0, cloudA: '#ffe7dc', cloudB: '#ffc9b8',
    sun: 1, sunCol: '#fff4d1', sea: 1, seaA: '#fff6ee', seaB: '#ffc6b8',
    earth: 0, earthR: 6, earthY: -0.36, earthCol: '#2a63c8', limb: '#bff3ff',
    island: '#3a2f68', park: '#21443e', islandSide: '#22183f' },
  { id: 'strato',
    top: '#040a2b', mid: '#123a8c', bot: '#5aa6ee', midAt: 0.45,
    light: '#f2f7ff', lightK: 0.72, ambTop: '#6f93dc', ambBot: '#1d2f6b',
    glass: '#1e3672', lit: 0.3, winA: '#ffc94d', winB: '#7ff3ff', winC: '#ff8ac4',
    stars: 0.35, skyline: 0, moon: 0, rain: 0, clouds: 0, cloudA: '#dbe9ff', cloudB: '#9fc1f2',
    sun: 0, sunCol: '#fff4d1', sea: 0, seaA: '#fff6ee', seaB: '#ffc6b8',
    earth: 1, earthR: 7.5, earthY: -0.3, earthCol: '#3a7fe0', limb: '#d6f6ff',
    island: '#3a2f68', park: '#21443e', islandSide: '#22183f' },
  { id: 'orbit',
    top: '#03020d', mid: '#0a0822', bot: '#17133d', midAt: 0.5,
    light: '#ffffff', lightK: 0.82, ambTop: '#3b3a74', ambBot: '#2a5aa6',
    glass: '#141737', lit: 0.62, winA: '#ffc94d', winB: '#6ff5d0', winC: '#ff7ab8',
    stars: 1, skyline: 0, moon: 0, rain: 0, clouds: 0, cloudA: '#dbe9ff', cloudB: '#9fc1f2',
    sun: 0, sunCol: '#fff4d1', sea: 0, seaA: '#fff6ee', seaB: '#ffc6b8',
    earth: 1, earthR: 1.55, earthY: -0.27, earthCol: '#2766c9', limb: '#7ff3e4',
    island: '#3a2f68', park: '#21443e', islandSide: '#22183f' },
]);

// a theme as numbers: colours become [r, g, b]
export function themeNumbers(theme) {
  const out = {};
  for (const [k, v] of Object.entries(theme)) {
    if (k === 'id') continue;
    out[k] = typeof v === 'string' ? hexToRgb(v) : v;
  }
  return out;
}

// blend two numeric themes (t = 0 → a, 1 → b) into `out` (reused every frame: no garbage)
export function blendInto(out, a, b, t) {
  for (const k of Object.keys(a)) {
    const va = a[k], vb = b[k];
    if (Array.isArray(va)) {
      const o = out[k] || (out[k] = [0, 0, 0]);
      o[0] = va[0] + (vb[0] - va[0]) * t; o[1] = va[1] + (vb[1] - va[1]) * t; o[2] = va[2] + (vb[2] - va[2]) * t;
    } else out[k] = va + (vb - va) * t;
  }
  return out;
}
