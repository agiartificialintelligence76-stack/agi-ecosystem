// How each market phase looks: sky, sun, haze, light and the HUD accent.
// Gameplay data for the same districts lives in world.js.
const deg = Math.PI / 180;

export const ZONE_LOOKS = [
  { key: 'launchpad', accent: '#ffb35c', zenith: '#3f74ba', horizon: '#f0b98f', ground: '#5d5562', band: '#ffb47a',
    sunColor: '#ffd29a', sunElev: 9, sunAz: 205, sunSize: 1.5, cloud: 0.25, cloudLow: 0, cloudColor: '#ffe6d2',
    stars: 0, aurora: 0, auroraColor: '#000000', planet: 0,
    fog: '#e3b996', fogStart: 45, fogEnd: 320, ambient: '#8a8396', light: '#ffd8b0', lightIntensity: 2.1,
    envTint: 0.12, envColor: '#ffd9b8' },
  { key: 'breakout', accent: '#5cc8ff', zenith: '#2b64cc', horizon: '#b9dcff', ground: '#7894b8', band: '#eaf5ff',
    sunColor: '#fff3dc', sunElev: 36, sunAz: 160, sunSize: 1, cloud: 0.42, cloudLow: 0, cloudColor: '#ffffff',
    stars: 0, aurora: 0, auroraColor: '#000000', planet: 0,
    fog: '#bcdaf6', fogStart: 70, fogEnd: 440, ambient: '#9cb4d4', light: '#fff4e2', lightIntensity: 2.4,
    envTint: 0.18, envColor: '#cfe6ff' },
  { key: 'bullrun', accent: '#2ef0a6', zenith: '#0f5fc4', horizon: '#8cc8ff', ground: '#eef6ff', band: '#cfe9ff',
    sunColor: '#ffffff', sunElev: 52, sunAz: 120, sunSize: 1, cloud: 0.45, cloudLow: 1, cloudColor: '#ffffff',
    stars: 0, aurora: 0, auroraColor: '#000000', planet: 0,
    fog: '#9fd0ff', fogStart: 90, fogEnd: 460, ambient: '#9cb9dc', light: '#fffaf0', lightIntensity: 2.4,
    envTint: 0.4, envColor: '#f2f8ff' },
  { key: 'volatility', accent: '#ff4a5c', zenith: '#120f22', horizon: '#3e305e', ground: '#140f1f', band: '#5d417f',
    sunColor: '#b98cff', sunElev: 16, sunAz: 250, sunSize: 0.7, cloud: 0.95, cloudLow: 0.5, cloudColor: '#3c3158',
    stars: 0, aurora: 0, auroraColor: '#000000', planet: 0,
    fog: '#2b2342', fogStart: 30, fogEnd: 210, ambient: '#55487a', light: '#c4b0ff', lightIntensity: 1.6,
    envTint: 0.6, envColor: '#2b2342', storm: 1 },
  { key: 'euphoria', accent: '#ffc65c', zenith: '#3c2672', horizon: '#ff92b3', ground: '#5b2f63', band: '#ffb35c',
    sunColor: '#ffb35c', sunElev: 5, sunAz: 300, sunSize: 2.8, cloud: 0.32, cloudLow: 0.35, cloudColor: '#ffc4cc',
    stars: 0.05, aurora: 0, auroraColor: '#000000', planet: 0,
    fog: '#f19bb6', fogStart: 70, fogEnd: 380, ambient: '#a87ca8', light: '#ffc994', lightIntensity: 2.2,
    envTint: 0.6, envColor: '#f19bb6' },
  { key: 'discovery', accent: '#3dffb0', zenith: '#050826', horizon: '#3447aa', ground: '#141a52', band: '#6c7dff',
    sunColor: '#e9edff', sunElev: 22, sunAz: 40, sunSize: 0.8, cloud: 0, cloudLow: 0, cloudColor: '#ffffff',
    stars: 0.55, aurora: 0.9, auroraColor: '#3dffb0', planet: 0,
    fog: '#28327a', fogStart: 90, fogEnd: 520, ambient: '#5a65ad', light: '#e4eaff', lightIntensity: 2.1,
    envTint: 0.7, envColor: '#28327a' },
  { key: 'orbit', accent: '#7fb2ff', zenith: '#000006', horizon: '#070b20', ground: '#02040a', band: '#1b2c6c',
    sunColor: '#ffffff', sunElev: 28, sunAz: 330, sunSize: 0.6, cloud: 0, cloudLow: 0, cloudColor: '#ffffff',
    stars: 1, aurora: 0.12, auroraColor: '#5a8cff', planet: 1,
    fog: '#070b20', fogStart: 420, fogEnd: 1600, ambient: '#4a5474', light: '#ffffff', lightIntensity: 2.6,
    envTint: 0.8, envColor: '#070b20' },
  { key: 'moon', accent: '#fff2c4', zenith: '#000000', horizon: '#0b1026', ground: '#020308', band: '#283270',
    sunColor: '#fff6e0', sunElev: 30, sunAz: 20, sunSize: 0.7, cloud: 0, cloudLow: 0, cloudColor: '#ffffff',
    stars: 1, aurora: 0, auroraColor: '#000000', planet: 0.75,
    fog: '#0b1026', fogStart: 500, fogEnd: 1600, ambient: '#5f5f78', light: '#fff4e2', lightIntensity: 2.6,
    envTint: 0.8, envColor: '#0b1026' },
];

export const hexToRgb = (hex) => {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
};

const COLORS = ['accent', 'zenith', 'horizon', 'ground', 'band', 'sunColor', 'cloudColor', 'auroraColor', 'fog', 'ambient', 'light', 'envColor'];
const NUMBERS = ['sunElev', 'sunAz', 'sunSize', 'cloud', 'cloudLow', 'stars', 'aurora', 'planet', 'fogStart', 'fogEnd', 'lightIntensity', 'envTint', 'storm'];
const PREPARED = ZONE_LOOKS.map((look) => {
  const out = { key: look.key };
  for (const name of COLORS) out[name] = hexToRgb(look[name]);
  for (const name of NUMBERS) out[name] = look[name] ?? 0;
  return out;
});

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

/** The look at a height: each boundary blends over the 12 m below it and 4 m above. */
export function lookAt(y, zoneHeight = 75, out = {}) {
  const count = PREPARED.length;
  const boundary = Math.round(y / zoneHeight);
  const i = Math.max(0, Math.min(count - 1, boundary - 1));
  const j = Math.max(0, Math.min(count - 1, boundary));
  const t = i === j ? 0 : smooth(boundary * zoneHeight - 12, boundary * zoneHeight + 4, y);
  const a = PREPARED[i], b = PREPARED[j];
  for (const name of COLORS) {
    out[name] ??= [0, 0, 0];
    for (let k = 0; k < 3; k++) out[name][k] = lerp(a[name][k], b[name][k], t);
  }
  for (const name of NUMBERS) out[name] = lerp(a[name], b[name], t);
  // Azimuth takes the short way round.
  let delta = ((b.sunAz - a.sunAz + 540) % 360) - 180;
  out.sunAz = a.sunAz + delta * t;
  out.zone = t < 0.5 ? i : j;
  out.sunDir ??= [0, 0, 0];
  const elev = out.sunElev * deg, az = out.sunAz * deg;
  out.sunDir[0] = Math.cos(elev) * Math.sin(az);
  out.sunDir[1] = Math.sin(elev);
  out.sunDir[2] = -Math.cos(elev) * Math.cos(az);
  return out;
}

export const rgbToCss = (rgb) => `rgb(${Math.round(rgb[0] * 255)},${Math.round(rgb[1] * 255)},${Math.round(rgb[2] * 255)})`;
