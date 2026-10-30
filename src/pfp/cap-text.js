// Personal lettering stays in the portrait recipe, never in HTML or a server.
export const MAX_CAP_TEXT_LENGTH = 500;
export function normalizeCapText(value) {
  if (typeof value !== 'string') return '';
  const clean = value.replace(/\s+/gu, ' ')
    .replace(/[\p{Cc}\p{Cf}]/gu, (char) => char === '\u200c' || char === '\u200d' ? char : '');
  const canonical = Array.from(clean).filter((char) => !/^[\ud800-\udfff]$/.test(char)).join('').normalize('NFC').replace(/ +/g, ' ').trim();
  return Array.from(canonical).slice(0, MAX_CAP_TEXT_LENGTH).join('').trim();
}

// Measured on the 512px source artwork, ordered top-left, top-right,
// bottom-right, bottom-left. Lettering follows the fabric, clear of seams.
export const CAP_SURFACES = Object.freeze({
  0: [[242, 65], [358, 71], [367, 135], [252, 132]],
  2: [[178,109],[279,87],[286,128],[162,164]],
  3: [[232,47],[337,47],[355,84],[221,88]],
  4: [[227,59],[337,57],[350,100],[221,111]],
  7: [[171,118],[294,90],[299,127],[156,169]],
  8: [[222,56],[329,47],[354,83],[211,101]],
  10: [[132,83],[173,65],[186,106],[124,132]],
  12: [[173,93],[307,53],[330,89],[150,144]],
  13: [[197,49],[317,46],[345,82],[185,105]],
  17: [[107,124],[161,93],[157,136],[99,168]],
  19: [[136,89],[208,67],[218,112],[121,145]],
  22: [[174,111],[296,78],[301,113],[159,153]],
  25: [[196,55],[315,49],[340,84],[180,109]],
  32: [[172,82],[285,48],[311,74],[157,119]],
  33: [[290,103],[386,98],[404,128],[278,147]],
  35: [[162,82],[262,59],[271,113],[145,145]],
  37: [[213,43],[296,36],[318,51],[194,79]],
  38: [[192,116],[318,91],[323,130],[172,171]],
  46: [[222,54],[295,36],[324,55],[211,94]],
});
export function supportsCapText(character) {
  return Number.isInteger(character) && Object.hasOwn(CAP_SURFACES, character);
}

const FONT = '"AGI Cap Print", Arial, sans-serif';
let fontReady;
async function loadCapFont() {
  if (typeof FontFace === 'undefined' || !document.fonts) return;
  if (!fontReady) {
    const face = new FontFace('AGI Cap Print', 'url(/fonts/Geist-Variable.woff2)', { weight: '100 900' });
    fontReady = face.load().then((loaded) => { document.fonts.add(loaded); }).catch((error) => { fontReady = undefined; throw error; });
  }
  await fontReady;
}

function wrapText(ctx, text, width) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line && ctx.measureText(`${line} ${word}`).width <= width) { line += ` ${word}`; continue; }
    if (line) { lines.push(line); line = ''; }
    // Long names, CJK phrases and emoji can wrap without requiring spaces.
    for (const char of Array.from(word)) {
      if (line && ctx.measureText(line + char).width > width) { lines.push(line); line = ''; }
      line += char;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function layoutCapText(ctx, text, width, height) {
  let low = .1, high = height * .83, best;
  for (let step = 0; step < 16; step++) {
    const size = (low + high) / 2;
    ctx.font = `750 ${size}px ${FONT}`;
    const lines = wrapText(ctx, text, width * .94);
    const lineHeight = size * 1.12;
    if (lines.length <= 3 && lines.length * lineHeight <= height * .9 && lines.every((line) => ctx.measureText(line).width <= width * .94)) {
      best = { size, lineHeight, lines }; low = size;
    } else high = size;
  }
  return best || { size: .1, lineHeight: .112, lines: [text] };
}

function surfaceUV(x, y, quad) {
  const [a, b, c, d] = quad;
  const bx = b[0] - a[0], by = b[1] - a[1];
  const dx = d[0] - a[0], dy = d[1] - a[1];
  const ex = a[0] - b[0] + c[0] - d[0], ey = a[1] - b[1] + c[1] - d[1];
  let u = .5, v = .5;
  for (let step = 0; step < 5; step++) {
    const rx = a[0] + u * bx + v * dx + u * v * ex - x;
    const ry = a[1] + u * by + v * dy + u * v * ey - y;
    const ux = bx + v * ex, uy = by + v * ey, vx = dx + u * ex, vy = dy + u * ey;
    const det = ux * vy - uy * vx;
    if (Math.abs(det) < .01) return null;
    u -= (rx * vy - ry * vx) / det;
    v -= (ux * ry - uy * rx) / det;
  }
  return u >= 0 && u < 1 && v >= 0 && v < 1 ? [u, v] : null;
}

export async function paintCapText(ctx, config) {
  const text = normalizeCapText(config.capText);
  if (!text || !supportsCapText(config.character)) return;
  await loadCapFont();
  const quad = CAP_SURFACES[config.character];
  const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const width = Math.ceil((distance(quad[0], quad[1]) + distance(quad[3], quad[2])) / 2);
  const height = Math.ceil((distance(quad[0], quad[3]) + distance(quad[1], quad[2])) / 2);
  const mask = document.createElement('canvas');
  mask.width = width * 2; mask.height = height * 2;
  const ink = mask.getContext('2d', { willReadFrequently: true });
  ink.scale(2, 2);
  const printWidth = width / .8;
  ink.scale(.8, 1);
  const layout = layoutCapText(ink, text, printWidth, height);
  ink.font = `750 ${layout.size}px ${FONT}`;
  ink.fillStyle = '#fff';
  ink.textAlign = 'center';
  ink.textBaseline = 'middle';
  const top = (height - layout.lines.length * layout.lineHeight) / 2;
  layout.lines.forEach((line, i) => ink.fillText(line, printWidth / 2, top + (i + .5) * layout.lineHeight));
  const letters = ink.getImageData(0, 0, mask.width, mask.height).data;
  const left = Math.floor(Math.min(...quad.map(([x]) => x))), right = Math.ceil(Math.max(...quad.map(([x]) => x)));
  const topY = Math.floor(Math.min(...quad.map(([, y]) => y))), bottom = Math.ceil(Math.max(...quad.map(([, y]) => y)));
  const fabric = ctx.getImageData(left, topY, right - left, bottom - topY);
  for (let y = topY; y < bottom; y++) for (let x = left; x < right; x++) {
    const uv = surfaceUV(x + .5, y + .5, quad);
    if (!uv) continue;
    const offset = (Math.floor(uv[1] * mask.height) * mask.width + Math.floor(uv[0] * mask.width)) * 4;
    const coverage = letters[offset + 3] / 255;
    if (!coverage) continue;
    const index = ((y - topY) * fabric.width + x - left) * 4;
    const light = (fabric.data[index] * .2126 + fabric.data[index + 1] * .7152 + fabric.data[index + 2] * .0722) / 255;
    // The cap's own shading and a tiny stable weave show through the white ink.
    // Only letter pixels change; there is no sticker, rectangle, or shadow box.
    const weave = ((x * 17 + y * 31) % 11) / 110;
    const alpha = coverage * (.91 + weave * .35);
    const shade = .91 + light * .09;
    for (let channel = 0; channel < 3; channel++) {
      const white = [253, 249, 242][channel] * shade;
      fabric.data[index + channel] = Math.round(fabric.data[index + channel] * (1 - alpha) + white * alpha);
    }
  }
  ctx.putImageData(fabric, left, topY);
}
