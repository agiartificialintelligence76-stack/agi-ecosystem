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
    && KEYS.every((key) => Number.isInteger(value[key]) && value[key] >= 0 && value[key] < TRAITS[key].length));
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
  return ['1', value.seed, ...KEYS.map((key) => value[key].toString(36))].join('.');
}
export function decodePortrait(text) {
  if (typeof text !== 'string' || text.length > 80 || !/^1\.[0-9a-f]{32}(?:\.[0-9a-z]{1,2}){4}$/.test(text)) return null;
  const [version, seed, ...indices] = text.split('.');
  const value = { version: Number(version), seed };
  KEYS.forEach((key, i) => { value[key] = parseInt(indices[i], 36); });
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
// Warm hair shadows overlap the peach skin palette. These source-coordinate
// outlines protect faces, necks and exposed arms while recoloring the entire
// golden strand, rather than leaving orange outlines on silver or dark hair.
const SKIN_REGIONS = [
  [ [[157,246],[183,232],[216,198],[269,190],[312,180],[339,179],[359,211],[353,265],[332,289],[297,308],[264,308],[222,292],[189,276],[166,269],[154,257]], [[242,297],[287,305],[291,331],[313,343],[318,365],[299,380],[267,381],[235,370],[216,349],[240,334]], [[141,482],[195,498],[198,512],[144,512]], [[376,502],[414,483],[421,512],[375,512]] ],
  [ [[193,229],[215,203],[246,189],[250,156],[256,204],[279,187],[297,169],[310,132],[316,160],[341,180],[357,200],[352,250],[333,274],[296,297],[255,297],[225,287],[205,266]], [[243,290],[295,296],[297,324],[319,341],[283,378],[246,349],[223,336],[241,321]] ],
  [ [[194,248],[215,221],[243,209],[246,168],[254,220],[281,208],[300,182],[303,155],[325,183],[353,208],[350,262],[332,288],[301,308],[265,309],[232,295],[211,279]], [[252,302],[297,306],[301,329],[325,345],[320,363],[292,370],[254,367],[222,354],[246,333]] ],
  [ [[208,212],[230,176],[266,155],[284,140],[289,170],[286,204],[309,197],[328,179],[346,144],[356,177],[368,217],[360,253],[336,276],[297,293],[265,286],[236,272],[218,250]], [[231,273],[272,286],[274,318],[300,337],[297,353],[268,357],[234,351],[216,339],[229,315]], [[119,500],[158,506],[160,512],[119,512]], [[424,505],[444,500],[446,512],[422,512]] ],
  [ [[181,221],[207,191],[231,173],[269,168],[280,158],[279,193],[300,187],[321,150],[335,141],[342,174],[355,202],[349,245],[329,267],[294,283],[261,283],[226,270],[198,250]], [[229,269],[280,280],[283,301],[307,321],[305,340],[282,350],[247,345],[218,327],[227,306]] ],
  [ [[181,239],[207,210],[242,201],[250,161],[255,204],[280,191],[295,167],[299,139],[323,161],[339,180],[345,217],[335,252],[310,279],[277,293],[244,290],[212,274],[190,258]], [[231,280],[279,289],[283,317],[308,335],[278,370],[243,348],[213,332],[229,313]] ],
  [ [[186,221],[210,195],[242,180],[267,163],[282,136],[285,169],[308,155],[321,128],[345,149],[360,177],[352,218],[333,245],[301,268],[270,270],[238,261],[210,248],[191,231]], [[244,259],[296,270],[299,292],[320,310],[314,320],[286,325],[251,318],[229,306],[242,289]] ],
  [ [[189,239],[211,210],[245,191],[252,151],[254,202],[277,186],[298,160],[305,142],[322,168],[344,180],[350,214],[342,250],[320,276],[289,288],[255,285],[225,277],[204,261]], [[243,279],[294,287],[297,312],[327,331],[319,350],[289,357],[253,350],[218,331],[241,312]], [[116,448],[173,474],[160,512],[95,512]], [[384,491],[431,472],[442,512],[383,512]] ],
  [ [[181,236],[210,201],[240,186],[248,162],[253,200],[279,187],[306,162],[317,132],[326,163],[345,185],[350,222],[340,255],[321,276],[291,288],[258,285],[224,273],[198,256]], [[235,277],[283,287],[284,313],[299,327],[284,347],[260,335],[235,323]] ],
  [ [[171,215],[188,177],[207,163],[210,132],[231,112],[250,119],[280,154],[315,176],[342,179],[346,213],[326,229],[319,244],[300,262],[278,278],[241,274],[206,258],[182,235]], [[238,268],[283,274],[294,303],[299,328],[312,348],[298,378],[278,388],[251,382],[236,356]] ],
  [ [[166,226],[189,203],[210,196],[223,165],[232,198],[249,181],[264,153],[273,173],[301,164],[317,150],[329,178],[342,201],[335,238],[313,268],[285,285],[251,286],[217,274],[189,255]], [[227,276],[279,286],[283,315],[311,337],[325,358],[315,375],[285,380],[250,373],[228,356],[232,330]] ],
  [ [[244,231],[268,207],[291,193],[303,169],[307,205],[330,190],[350,161],[368,171],[390,197],[403,219],[396,253],[375,279],[345,298],[310,294],[280,278],[257,255]], [[313,300],[345,298],[348,324],[370,345],[384,369],[378,387],[354,392],[327,384],[310,365],[316,333]] ],
];
function inPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i], [xj, yj] = points[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const skinMasks = new Map();
const SKIN_OVERRIDES = {
  8: [
    SKIN_REGIONS[8][0],
    [[236,279],[283,287],[284,313],[299,327],[284,347],[260,335],[246,325],[245,307]],
  ],
  35: [
    [[171,237],[188,241],[210,214],[243,190],[254,168],[268,154],[273,195],[292,191],[316,152],[334,142],[349,172],[367,195],[365,236],[347,267],[311,291],[277,294],[244,286],[216,271],[192,255],[177,247]],
    [[248,281],[306,292],[306,325],[323,336],[342,340],[345,357],[334,371],[310,378],[276,373],[246,360],[224,342],[243,330],[249,310]],
    [[104,487],[146,497],[186,512],[100,512]], [[450,503],[478,493],[484,512],[447,512]],
  ],
  47: [
    [[171,239],[194,214],[221,197],[244,184],[252,145],[260,201],[280,187],[297,164],[302,138],[321,165],[342,190],[344,230],[333,258],[310,278],[282,293],[247,291],[215,278],[189,260]],
    [[228,282],[282,293],[284,320],[291,330],[308,338],[281,373],[257,356],[225,337]],
  ],
};
function skinMask(character) {
  if (skinMasks.has(character)) return skinMasks.get(character);
  const regions = SKIN_OVERRIDES[character] || SKIN_REGIONS[character] || [
    [[166,215],[197,166],[251,143],[315,151],[358,192],[363,243],[330,285],[282,307],[229,294],[183,260]],
    [[229,283],[292,295],[302,326],[330,352],[316,383],[260,388],[222,354]],
  ];
  const result = new Uint8Array(512 * 512);
  for (const polygon of regions) {
    const xs = polygon.map(([x]) => x), ys = polygon.map(([, y]) => y);
    const minX = Math.max(0, Math.min(...xs)), maxX = Math.min(511, Math.max(...xs));
    const minY = Math.max(0, Math.min(...ys)), maxY = Math.min(511, Math.max(...ys));
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) if (inPolygon(x, y, polygon)) result[y * 512 + x] = 1;
  }
  // The curly bucket-hat fringe crosses in front of the forehead. Keep these
  // measured strands out of the skin region, including their warm edge pixels.
  if (character === 8) {
    const strands = [
      [[250,174],[267,163],[285,151],[300,144],[292,175],[279,195],[265,206],[252,201]],
      [[190,204],[228,177],[249,169],[248,185],[235,194],[212,205]],
    ];
    for (let y = 144; y <= 206; y++) for (let x = 190; x <= 300; x++) {
      if (strands.some((polygon) => inPolygon(x, y, polygon))) result[y * 512 + x] = 0;
    }
  }
  skinMasks.set(character, result);
  return result;
}
export function recolorPixels(data, config) {
  const hair = TRAITS.hair[effectiveHair(config)];
  const outfit = TRAITS.outfit[config.outfit];
  const skin = data.length === 512 * 512 * 4 ? skinMask(config.character) : null;
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue;
    const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    let target, base;
    // Source art is keyed: gold hair, violet fabric, neutral peach skin and white logos.
    const warmEdge = skin && !skin[i / 4] && h >= 12 && h < 36 && s > .16 && l > .10 && l < .73;
    const warmHairShadow = warmEdge || (h >= 24 && h < 36 && s > .26 && l > .23 && l < .73
      && (!skin?.[i / 4] || (h >= 31 && s < .76 && l < .63)));
    const goldenHair = h >= 36 && h < 72 && s > .30 && (!skin?.[i / 4] || h >= 38 || (l < .67 && s < .87));
    if ((goldenHair || warmHairShadow) && effectiveHair(config) !== 1) { target = hair; base = .66; }
    else if (h > 238 && h < 301 && s > .24 && config.outfit !== 0) { target = outfit; base = .60; }
    if (!target) continue;
    const rgb = hslToRgb(target.h, target.s * clamp(s / .60, .70, 1.1), clamp(target.l + (l - base) * .82, .06, .94));
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
  const img = await loadImage(`${ROOT}character-${config.character}.png`);
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
// Bounds of the original chest lettering in each versioned 512px sprite. The
// embroidered patch covers that print and drawstrings in one final pass, so AGI
// is complete and legible on every preview, shared recipe and downloaded PNG.
const CHEST_PRINTS = [
  [237,412,348,466], [240,416,344,470], [238,416,350,465], [218,401,342,459],
  [243,392,349,448], [232,410,340,466], [271,377,377,432], [238,391,352,441],
  [257,398,355,452], [210,419,329,467], [229,417,344,468], [303,423,415,473],
  [223,432,363,487], [249,436,359,483], [233,436,339,483], [225,430,348,483],
  [221,434,357,491], [251,432,368,486], [229,436,356,490], [243,426,367,482],
  [241,430,361,487], [252,419,360,471], [226,415,358,476], [287,436,401,491],
  [240,423,368,481], [235,426,353,484], [262,422,383,478], [249,405,373,460],
  [233,404,366,461], [236,420,374,480], [252,431,363,486], [270,436,381,492],
  [251,435,365,488], [260,415,385,478], [288,406,397,463], [268,411,390,474],
  [294,445,404,498], [270,411,385,469], [275,418,393,474], [233,430,364,486],
  [266,442,370,493], [236,437,351,487], [220,416,344,472], [245,429,356,482],
  [236,446,349,497], [280,412,386,463], [262,425,374,478], [247,422,357,471],
];
const AGI_GLYPHS = [
  ['01110','11011','11011','11111','11011','11011','11011'],
  ['01111','11000','11000','11011','11011','11011','01111'],
  ['11111','00100','00100','00100','00100','00100','11111'],
];
export function brandPatchBounds(character) {
  const [left, top, right, bottom] = CHEST_PRINTS[character] || CHEST_PRINTS[0];
  const width = Math.max(132, right - left + 21);
  const height = Math.max(70, bottom - top + 17);
  return { x: Math.round((left + right - width) / 2), y: Math.min(510 - height, Math.round((top + bottom - height) / 2)), width, height };
}
export function paintBrandPatch(ctx, character) {
  const { x, y, width, height } = brandPatchBounds(character);
  ctx.fillStyle = '#180f25';
  ctx.fillRect(x + 3, y, width - 6, height);
  ctx.fillRect(x, y + 3, width, height - 6);
  ctx.fillStyle = '#322142';
  ctx.fillRect(x + 3, y + 3, width - 6, height - 6);
  ctx.fillStyle = '#3b294d';
  ctx.fillRect(x + 5, y + 5, width - 10, 3);
  ctx.fillStyle = '#8d739e';
  for (let stitch = 8; stitch < width - 8; stitch += 8) {
    ctx.fillRect(x + stitch, y + 5, 3, 1);
    ctx.fillRect(x + stitch, y + height - 6, 3, 1);
  }
  for (let stitch = 12; stitch < height - 9; stitch += 8) {
    ctx.fillRect(x + 5, y + stitch, 1, 3);
    ctx.fillRect(x + width - 6, y + stitch, 1, 3);
  }
  const scale = 6, textWidth = 17 * scale;
  const textX = x + Math.floor((width - textWidth) / 2);
  const textY = y + Math.floor((height - 7 * scale) / 2);
  ctx.fillStyle = '#fff1da';
  AGI_GLYPHS.forEach((glyph, letter) => glyph.forEach((row, rowIndex) => {
    for (let col = 0; col < row.length; col++) if (row[col] === '1') ctx.fillRect(textX + (letter * 6 + col) * scale, textY + rowIndex * scale, scale, scale);
  }));
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
  paintBrandPatch(ctx, config.character);
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
