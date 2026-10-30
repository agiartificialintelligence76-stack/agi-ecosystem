import { skinMask } from './skin-mask.js';
import { normalizeCapText, supportsCapText, paintCapText, MAX_CAP_TEXT_LENGTH } from './cap-text.js';
export { normalizeCapText, supportsCapText, MAX_CAP_TEXT_LENGTH } from './cap-text.js';
// Versioned artwork + portable recipes: shared links never rely on a server or account.
const ROOT = '/pfp/v1/';
const characterNames = ['The Original · cap & waves', 'Lo-fi · bob & headphones', 'Double Trouble · twin tails', 'Daydream · bucket hat', 'Side Quest · braid & jacket', 'Offbeat · shag & headphones', 'Soft Signal · long hair & clips', 'Orbit · space buns', 'Cloud Nine · curls', 'Silver Frequency · track jacket', 'After Hours · backward cap', 'Cherry Rush · ponytail & bow'];
characterNames.push(
  'Velvet Muse · beret bob', 'Paper Moon · newsboy waves', 'Cat Frequency · twin braids', 'Incognito · hood & pixie', 'Sail Away · sailor collar', 'Snowglobe · puffer & fur hat', 'Study Break · bun & glasses', 'Street Signal · sidecut cap', 'Golden Hour · crown braid',
  'Sky Pilot · aviator goggles', 'Lazy Sunday · beanie & locs', 'Neon Vision · cyber visor', 'Rain Check · raincoat', 'Special Delivery · messenger cap', 'Flutter · butterfly clips', 'Sweet Static · ribbon braids', 'Warm Front · scarf & bob', 'Stereo Star · double buns',
  'Star Cadet · space headset', 'Lucky Star · side ponytail', 'French Twist · braided beret', 'Court Side · curls & visor', 'Snow Day · earmuffs', 'Sideways · pixie cap', 'Sailor Moonlight · bow & waves', 'Sun Seeker · wide-brim hat', 'Cozy Cat · knitted ears',
  'Ground Control · space suit', 'Sunflower · long hair & clips', 'Wild Signal · wolf cut', 'Team Spirit · sports braids', 'Hyperdrive · tech jacket', 'Sunday Morning · messy bun', 'Velvet Ribbon · lace collar', 'Paint Party · artist apron', 'Stardust · curly hoodie',
);
const palettes = [
  ['Golden', 43, .78, .66, '#e9bd66'], ['Silver', 265, .07, .80, '#cbc6d1'],
  ['Lavender', 271, .40, .69, '#b88fd0'], ['Burgundy', 329, .44, .27, '#74304f'],
  ['Midnight', 235, .18, .20, '#303242'], ['Chocolate', 25, .40, .29, '#785038'],
  ['Rose', 335, .57, .67, '#da7fa4'], ['Ice blue', 197, .52, .69, '#86c3d8'],
  ['Mint', 159, .43, .63, '#78c9ac'], ['Copper', 22, .67, .51, '#d57842'],
  ['Moonlight', 48, .15, .86, '#e4e0d6'], ['Electric violet', 275, .66, .55, '#9d40d8'],
];
const outfits = [
  ['AGI purple', 266, .72, .60, '#a16ce2'], ['Midnight', 234, .28, .26, '#303955'],
  ['Cherry', 345, .62, .46, '#be3556'], ['Ocean', 210, .59, .48, '#327abd'],
  ['Forest', 160, .42, .36, '#358367'], ['Rose', 326, .51, .53, '#c04c8e'],
  ['Tangerine', 22, .64, .47, '#c9692b'], ['Indigo', 247, .50, .45, '#6554ad'],
  ['Teal', 183, .56, .36, '#298e93'], ['Graphite', 255, .06, .30, '#4d4951'],
  ['Mulberry', 305, .40, .35, '#7f367a'], ['Cobalt', 224, .70, .48, '#2554d0'],
];
const sceneData = [
  ['Gaming room', 'room'], ['Midnight rooftop', 'rooftop'], ['Sakura twilight', 'sakura'], ['Neon arcade', 'arcade'], ['Cozy morning', 'bedroom'],
  ['Tokyo after dark', 'tokyo'], ['Paris at dusk', 'paris'], ['Bali sunset', 'bali'], ['Egypt under stars', 'egypt'], ['Northern lights', 'aurora'],
  ['Future megacity', 'future'], ['Moon base', 'moon'], ['Space station', 'station'], ['Sky garden', 'sky-garden'],
  ['Cosmos', 'cosmos'], ['Ink world', 'ink-world'], ['Wind world', 'wind-world'], ['Crystal realm', 'crystal'], ['Ocean in the sky', 'ocean-sky'], ['Dream world', 'dream'],
  ['London rain', 'london'], ['New York rooftops', 'new-york'], ['Roman ruins', 'rome'], ['Santorini blue', 'santorini'], ['Venice canals', 'venice'], ['Swiss Alps', 'alps'], ['Seoul nights', 'seoul'], ['Marrakech courtyard', 'marrakech'], ['Amazon canopy', 'amazon'],
  ['Saturn rings', 'saturn'], ['Mars frontier', 'mars'], ['Asteroid outpost', 'asteroid'], ['Black hole observatory', 'black-hole'], ['Alien ocean', 'alien-ocean'], ['Crimson nebula', 'crimson-nebula'], ['Comet trails', 'comet'], ['Starlit desert', 'star-desert'], ['Galactic library', 'galactic-library'],
  ['Ember world', 'ember'], ['Ice palace', 'ice-palace'], ['Thunder world', 'thunder'], ['Water temple', 'water-temple'], ['Mushroom forest', 'mushroom'], ['Enchanted woods', 'enchanted'], ['Clockwork world', 'clockwork'], ['Dream train', 'dream-train'], ['Atlantis', 'atlantis'],
  ['Solarpunk city', 'solarpunk'], ['Orbital elevator', 'orbital-elevator'], ['Robot greenhouse', 'robot-garden'], ['Cyber circuit', 'cyber-circuit'], ['Future station', 'future-station'], ['Neon laundromat', 'neon-laundry'], ['Hologram gallery', 'hologram'], ['Undersea laboratory', 'undersea-lab'], ['Retro starship', 'retro-starship'],
  ['Origami world', 'origami'], ['Glass world', 'glass'], ['Candy sky', 'candy-sky'], ['Mirror realm', 'mirror'],
];
export const TRAITS = Object.freeze({
  character: characterNames.map((label) => ({ label })),
  hair: [{ label: 'Signature color', color: '#c5a5dd' }, ...palettes.map(([label, h, s, l, color]) => ({ label, h, s, l, color }))],
  outfit: outfits.map(([label, h, s, l, color]) => ({ label, h, s, l, color })),
  backdrop: sceneData.map(([label, file], i) => ({ label, file,
    group: i < 5 ? 'Cozy corners' : i < 10 ? 'Around the world' : i < 14 ? 'Future & space' : i < 20 ? 'Imaginary worlds'
      : i < 29 ? 'Around the world' : i < 38 ? 'Across the cosmos' : i < 47 ? 'Imaginary worlds' : i < 56 ? 'Into the future' : 'Surreal escapes',
  })),
});
const KEYS = Object.keys(TRAITS);
const SEED = /^[0-9a-f]{32}$/;
export function validatePortrait(value) {
  return Boolean(value && typeof value === 'object' && value.version === 1 && typeof value.seed === 'string' && SEED.test(value.seed)
    && KEYS.every((key) => Number.isInteger(value[key]) && value[key] >= 0 && value[key] < TRAITS[key].length)
    && (value.capText === undefined || (typeof value.capText === 'string' && value.capText === normalizeCapText(value.capText))));
}
function newSeed() {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((n) => n.toString(16).padStart(2, '0')).join('');
}
function randomInt(max) {
  // Rejection sampling avoids modulo bias, including when only two choices remain.
  const limit = Math.floor(0x100000000 / max) * max;
  const bytes = new Uint32Array(1);
  do { globalThis.crypto.getRandomValues(bytes); } while (bytes[0] >= limit);
  return bytes[0] % max;
}
export function randomPortrait(previous, locks = []) {
  const valid = validatePortrait(previous);
  const held = new Set(locks);
  if (valid && KEYS.every((key) => held.has(key))) return { ...previous };
  const next = { version: 1, seed: newSeed() };
  if (valid && previous.capText) next.capText = previous.capText;
  for (const key of KEYS) {
    if (valid && held.has(key)) next[key] = previous[key];
    else if (valid) {
      const selected = randomInt(TRAITS[key].length - 1);
      next[key] = selected >= previous[key] ? selected + 1 : selected;
    } else next[key] = randomInt(TRAITS[key].length);
  }
  // A locked signature color means the color already visible on this character.
  // Resolve it before a different character can supply a different signature.
  if (valid && held.has('hair') && previous.hair === 0 && next.character !== previous.character) {
    next.hair = effectiveHair(previous);
  }
  // A locked background includes its exact decoration, not just its place name.
  if (valid && held.has('backdrop')) next.seed = previous.seed;
  // Signature maps to the character's reference hair. Avoid a visually identical
  // reroll between "Signature" and that same explicit color when hair alone changes.
  if (valid && !held.has('hair') && effectiveHair(next) === effectiveHair(previous)) {
    next.hair = (next.hair + 1) % TRAITS.hair.length;
    if (effectiveHair(next) === effectiveHair(previous)) next.hair = (next.hair + 1) % TRAITS.hair.length;
  }
  return next;
}
export function encodePortrait(value) {
  if (!validatePortrait(value)) throw new Error('Invalid portrait.');
  const parts = [value.capText ? '2' : '1', value.seed, ...KEYS.map((key) => value[key].toString(36))];
  if (value.capText) parts.push(encodeCapText(value.capText));
  return parts.join('.');
}
function encodeCapText(text) {
  return btoa(String.fromCharCode(...new TextEncoder().encode(text))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
export function decodePortrait(text) {
  if (typeof text !== 'string' || text.length > 3000) return null;
  const legacy = /^1\.[0-9a-f]{32}(?:\.[0-9a-z]{1,2}){4}$/.test(text);
  if (!legacy && !/^2\.[0-9a-f]{32}(?:\.[0-9a-z]{1,2}){4}\.[A-Za-z0-9_-]+$/.test(text)) return null;
  const [, seed, ...indices] = text.split('.');
  const value = { version: 1, seed };
  KEYS.forEach((key, i) => { value[key] = parseInt(indices[i], 36); });
  if (!legacy) {
    try {
      const encoded = indices[4];
      const bytes = Uint8Array.from(atob(encoded.replaceAll('-', '+').replaceAll('_', '/')), (char) => char.charCodeAt(0));
      value.capText = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      if (!value.capText || encodeCapText(value.capText) !== encoded) return null;
    } catch { return null; }
  }
  return validatePortrait(value) ? value : null;
}
export function portraitCode(value) {
  if (!validatePortrait(value)) throw new Error('Invalid portrait.');
  // Hash the entire recipe, so a manual color change also changes the display ID.
  let hash = 2166136261;
  for (const char of encodePortrait(value)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `AGI-${(hash >>> 0).toString(16).padStart(8, '0').toUpperCase()}`;
}
function effectiveHair(config) {
  return config.hair || (config.character === 9 ? 2 : config.character === 10 ? 3 : config.character === 11 ? 4 : 1);
}
export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  const l = (max + min) / 2;
  if (!delta) return [0, 0, l];
  const s = delta / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  h = (h * 60 + 360) % 360;
  return [h, s, l];
}
export function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60, x = c * (1 - Math.abs(hp % 2 - 1));
  const [r, g, b] = hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
  const m = l - c / 2;
  return [r, g, b].map((v) => Math.round((v + m) * 255));
}
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export function recolorPixels(data, config) {
  const hair = TRAITS.hair[effectiveHair(config)];
  const outfit = TRAITS.outfit[config.outfit];
  const skin = data.length === 512 * 512 * 4 ? skinMask(config.character) : null;
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3] || skin?.[i / 4] === 1) continue;
    const lens = skin?.[i / 4] === 2;
    const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    const fabricPixel = h > 238 && h < 301 && s > .24;
    // A traced neck/arm edge can overlap a pixel of its violet collar or hem.
    // Violet is keyed fabric in this artwork; protecting it would leave a
    // purple seam on a differently coloured outfit. Warm anatomy stays exact.
    if (skin?.[i / 4] === 3 && !fabricPixel) continue;
    // Warm cream print is not blonde hair. Pale violet fabric, however, must
    // follow its darker neighbours instead of leaving unrecoloured speckles.
    if (!lens && h < 100 && Math.min(data[i], data[i + 1], data[i + 2]) >= 200) continue;
    let target, base;
    // Source art is keyed: gold hair, violet fabric, neutral peach skin and white logos.
    const warmEdge = skin && !skin[i / 4] && h >= 12 && h < 36 && s > .16 && l > .10 && l < .73;
    const warmHairShadow = warmEdge || (h >= 24 && h < 36 && s > .26 && l > .23 && l < .73);
    const goldenHair = h >= 36 && h < 72 && s > .30;
    if (lens) {
      // The translucent visor contains baked reflections of several hues;
      // tint the glass as one material rather than selecting purple islands.
      if (config.outfit !== 0 && s > .12) { target = outfit; base = .60; }
    } else if ((goldenHair || warmHairShadow) && effectiveHair(config) !== 1) { target = hair; base = .66; }
    else if (fabricPixel && config.outfit !== 0) { target = outfit; base = .60; }
    if (!target) continue;
    // Anchor fabric shading at black, its midtone and white. This keeps bright
    // stitching/highlights bright even on dark outfits, without clipping folds.
    const fabric = target === outfit;
    const lightness = fabric
      ? l < base ? target.l * l / base : target.l + (1 - target.l) * (l - base) / (1 - base)
      : clamp(target.l + (l - base) * .82, .06, .94);
    const saturation = target.s * (fabric ? clamp(s / .72, 0, 1.1) : clamp(s / .60, .70, 1.1));
    const rgb = hslToRgb(target.h, saturation, lightness);
    data[i] = rgb[0]; data[i + 1] = rgb[1]; data[i + 2] = rgb[2];
  }
  return data;
}
const assets = new Map();
function loadImage(url) {
  if (!assets.has(url)) {
    const request = new Promise((resolve, reject) => {
      const img = new Image();
      const timeout = setTimeout(() => { img.src = ''; reject(new Error('Image load timed out.')); }, 20_000);
      img.onload = () => { clearTimeout(timeout); resolve(img); };
      img.onerror = () => { clearTimeout(timeout); reject(new Error('Image could not load.')); };
      img.src = url;
    }).catch((error) => { assets.delete(url); throw error; });
    assets.set(url, request);
  }
  return assets.get(url);
}
function canvas(size) {
  const result = document.createElement('canvas');
  result.width = result.height = size;
  return result;
}
const sprites = new Map();
async function sprite(config) {
  const key = `${config.character}.${effectiveHair(config)}.${config.outfit}`;
  if (sprites.has(key)) return sprites.get(key);
  const img = await loadImage(`${ROOT}character-${config.character}.png?v=20261031-paint1`);
  const layer = canvas(512), context = layer.getContext('2d', { willReadFrequently: true });
  context.drawImage(img, 0, 0, 512, 512);
  const pixels = context.getImageData(0, 0, 512, 512);
  recolorPixels(pixels.data, config);
  context.putImageData(pixels, 0, 0);
  if (sprites.size >= 32) sprites.delete(sprites.keys().next().value);
  sprites.set(key, layer);
  return layer;
}
function seedRandom(seed) {
  let state = parseInt(seed.slice(0, 8), 16) ^ parseInt(seed.slice(8, 16), 16) ^ parseInt(seed.slice(16, 24), 16) ^ parseInt(seed.slice(24), 16);
  return () => {
    state += 0x6d2b79f5;
    let v = Math.imul(state ^ state >>> 15, 1 | state);
    v ^= v + Math.imul(v ^ v >>> 7, 61 | v);
    return ((v ^ v >>> 14) >>> 0) / 4294967296;
  };
}
export async function renderPortrait(target, config, { size = 1024 } = {}) {
  if (!validatePortrait(config)) throw new Error('Invalid portrait.');
  if (![256, 512, 1024, 2048].includes(size)) throw new Error('Unsupported portrait size.');
  const [backdrop, character] = await Promise.all([
    loadImage(`${ROOT}${TRAITS.backdrop[config.backdrop].file}.webp`), sprite(config),
  ]);
  // Compose at a fixed native resolution: thumbnails and exports are identical crops.
  const work = canvas(512), ctx = work.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(backdrop, 0, 0, 512, 512);
  ctx.fillStyle = '#09051b22';
  ctx.fillRect(0, 0, 512, 512);
  // Each recipe has its own subtle pixel constellation. A locked scene keeps it intact.
  const random = seedRandom(config.seed);
  for (let i = 0; i < 28; i++) {
    const x = Math.floor(random() * 256) * 2;
    const y = Math.floor(random() * 256) * 2;
    ctx.fillStyle = `rgba(244,224,255,${(.18 + random() * .35).toFixed(2)})`;
    ctx.fillRect(x, y, 2, 2);
    if (i % 7 === 0) { ctx.fillRect(x - 2, y, 6, 2); ctx.fillRect(x, y - 2, 2, 6); }
  }
  ctx.drawImage(character, 0, 0, 512, 512);
  await paintCapText(ctx, config);
  target.width = target.height = size;
  const out = target.getContext('2d');
  if (!out) throw new Error('Canvas is unavailable.');
  out.imageSmoothingEnabled = false;
  out.drawImage(work, 0, 0, size, size);
  return target;
}
export async function exportPortrait(config) {
  const target = canvas(1024);
  await renderPortrait(target, config);
  return new Promise((resolve, reject) => target.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG export failed.')), 'image/png'));
}
