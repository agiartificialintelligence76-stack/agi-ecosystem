// SINGULARITY (2026-11-08): its icons, drawn once as simple shapes on a 24 × 24 grid and rendered two ways: as SVG
// markup for the panels (crisp at any size) and on a canvas for the satellites circling the core. Sticker style: ink
// outlines, flat fills from the arcade's palette. Pure data plus two small renderers (no DOM here: game code turns the
// markup into elements, the way the kit's icons are made).

export const INK = '#170a36';
export const C = {
  ink: INK, paper: '#fffaf0', lav: '#e4d9ff', lav2: '#cdb8ff', violet: '#6b3bff', violet2: '#8b66ff', pink: '#ff4da6',
  honey: '#ffc933', mint: '#3ff0c3', sky: '#59c8ff', night: '#2a1760', red: '#ff5a5f',
};

// the machines' own colors (their rings, discs and glyphs)
export const GEN_COLORS = ['#ffc933', '#ff4da6', '#3ff0c3', '#59c8ff', '#8b66ff', '#ffc933', '#ff4da6', '#59c8ff', '#cdb8ff', '#ffc933', '#3ff0c3', '#ff4da6'];

// a shape: [kind, …numbers, fill] · fill: a color, 'a' (the accent), or null (outline only); kinds: rect (x y w h r),
// circle (cx cy r), ellipse (cx cy rx ry rotation°), line (x1 y1 x2 y2), path (d)
const star4 = (x, y, r, k = 0.32) => {
  const i = r * k;
  return `M${x} ${y - r}L${x + i} ${y - i}L${x + r} ${y}L${x + i} ${y + i}L${x} ${y + r}L${x - i} ${y + i}L${x - r} ${y}L${x - i} ${y - i}Z`;
};
const ring = (n, r, fn) => Array.from({ length: n }, (_, i) => fn((i / n) * Math.PI * 2, r));

export const GLYPHS = {
  notebook: [
    ['rect', 6, 3, 13, 18, 2.2, 'a'],
    ['circle', 6, 7.5, 1.4, C.paper], ['circle', 6, 12, 1.4, C.paper], ['circle', 6, 16.5, 1.4, C.paper],
    ['path', star4(13, 12, 4.6), C.paper],
  ],
  rig: [
    ['rect', 6, 2.5, 12, 19, 2.2, 'a'],
    ['rect', 8.5, 5.5, 7, 2, 0.8, C.mint],
    ['circle', 12, 14, 4.2, C.paper],
    ['path', 'M12 14L12 10.4M12 14L15.1 15.8M12 14L8.9 15.8', null],
    ['circle', 12, 14, 1.1, C.ink],
  ],
  gpu: [
    ['rect', 2, 6, 20, 11, 2.2, 'a'],
    ['circle', 7.8, 11.5, 3.3, C.paper], ['circle', 16.2, 11.5, 3.3, C.paper],
    ['circle', 7.8, 11.5, 0.9, C.ink], ['circle', 16.2, 11.5, 0.9, C.ink],
    ['rect', 7, 17, 9, 2.6, 0.6, C.honey],
  ],
  server: [
    ['rect', 4, 2.5, 16, 19, 2.2, 'a'],
    ['rect', 6.5, 5, 11, 4, 1, C.paper], ['rect', 6.5, 10, 11, 4, 1, C.paper], ['rect', 6.5, 15, 11, 4, 1, C.paper],
    ['circle', 15.3, 7, 0.9, C.mint], ['circle', 15.3, 12, 0.9, C.honey], ['circle', 15.3, 17, 0.9, C.pink],
  ],
  datacenter: [
    ['rect', 4.5, 4.5, 6, 4.5, 1, C.paper], ['rect', 13.5, 4.5, 6, 4.5, 1, C.paper],
    ['rect', 2.5, 9, 19, 12, 1.8, 'a'],
    ['line', 5.5, 13, 18.5, 13], ['line', 5.5, 16.5, 9.5, 16.5], ['line', 14.5, 16.5, 18.5, 16.5],
    ['rect', 10.5, 15.5, 3, 5.5, 0.5, C.honey],
  ],
  campus: [
    ['rect', 2.5, 10, 6, 11, 1, 'a'], ['rect', 15.5, 7.5, 6, 13.5, 1, 'a'],
    ['rect', 8.8, 3.5, 6.4, 17.5, 1, C.paper],
    ['line', 11, 7, 13, 7], ['line', 11, 10.5, 13, 10.5], ['line', 11, 14, 13, 14],
    ['line', 1.5, 21, 22.5, 21],
  ],
  fusion: [
    ['ellipse', 12, 12, 10, 4.2, 0, null], ['ellipse', 12, 12, 10, 4.2, 60, null], ['ellipse', 12, 12, 10, 4.2, -60, null],
    ['circle', 12, 12, 3.6, 'a'],
    ['circle', 12, 12, 1.2, C.paper],
  ],
  orbital: [
    ['rect', 1.5, 9, 7, 6, 0.8, 'a'], ['rect', 15.5, 9, 7, 6, 0.8, 'a'],
    ['line', 5, 9, 5, 15], ['line', 19, 9, 19, 15],
    ['rect', 9.5, 8, 5, 8, 1.2, C.paper],
    ['line', 12, 8, 12, 4.6], ['circle', 12, 3.8, 1.4, C.honey],
  ],
  lunar: [
    ['path', 'M14.5 2.8A9.4 9.4 0 1 0 21.4 16.6A7.6 7.6 0 1 1 14.5 2.8Z', 'a'],
    ['circle', 7.5, 15.5, 1.5, C.paper], ['circle', 10.5, 19.2, 1, C.paper],
    ['path', star4(18.5, 6.5, 3.6), C.honey],
  ],
  dyson: [
    ...ring(8, 9.2, (a, r) => ['rect', 12 + Math.cos(a) * r - 1.7, 12 + Math.sin(a) * r - 1.7, 3.4, 3.4, 0.6, C.paper]),
    ['circle', 12, 12, 5, 'a'],
    ['path', star4(12, 12, 2.6), C.paper],
  ],
  matrioshka: [
    ['circle', 12, 12, 10, 'a'],
    ['circle', 12, 12, 7, C.paper],
    ['circle', 12, 12, 4, 'a'],
    ['circle', 12, 12, 1.4, C.ink],
  ],
  universe: [
    ['rect', 2.5, 2.5, 19, 19, 4.5, C.violet],
    ['path', 'M12 12C12 10.2 14.6 10.4 14.6 12.4C14.6 15.2 10.2 15.6 9.4 12.6C8.4 8.9 13.6 7.2 16.4 9.4C19.4 11.8 17.6 17.6 12.4 18', 'nofill'],
    ['circle', 12, 12, 1.5, 'a'],
    ['circle', 6.5, 7, 0.9, C.paper], ['circle', 18, 5.5, 0.7, C.paper], ['circle', 6, 17.5, 0.7, C.paper],
  ],
  // upgrades
  tap: [
    ['circle', 12, 9, 6.5, null],
    ['path', 'M10.6 21.5L8 15.4C7.6 14.4 8.6 13.6 9.4 14.2L10.6 15.2V7.6C10.6 6.6 12.4 6.6 12.4 7.6V12.2L16.4 12.9C17.4 13.1 17.9 14 17.7 15L16.8 21.5Z', C.paper],
  ],
  echo: [
    ['circle', 12, 12, 3, 'a'],
    ['path', 'M7 7.5A6.5 6.5 0 0 0 7 16.5M17 7.5A6.5 6.5 0 0 1 17 16.5', 'nofill'],
    ['path', 'M4.2 4.8A10.4 10.4 0 0 0 4.2 19.2M19.8 4.8A10.4 10.4 0 0 1 19.8 19.2', 'nofill'],
  ],
  global: [
    ['path', star4(12, 12, 10, 0.3), 'a'],
    ['circle', 12, 12, 2.2, C.paper],
  ],
  syn: [
    ['rect', 2.5, 8.5, 11, 7, 3.5, null], ['rect', 10.5, 8.5, 11, 7, 3.5, 'nofill'],
    ['line', 9, 12, 15, 12],
  ],
  luck: [
    ['path', star4(10, 13, 8), 'a'],
    ['path', star4(18.5, 5.5, 3.6), C.paper],
  ],
  golden: [
    ['path', 'M6 3H18M6 21H18M7.5 3C7.5 8 12 9 12 12C12 15 7.5 16 7.5 21M16.5 3C16.5 8 12 9 12 12C12 15 16.5 16 16.5 21', 'nofill'],
    ['path', 'M9 19.5C9.5 17.4 11 16.6 12 16.4C13 16.6 14.5 17.4 15 19.5Z', 'a'],
  ],
  // perks
  warm: [
    ['path', 'M12 2.5C15 6.5 18.5 9 18.5 14A6.5 6.5 0 0 1 5.5 14C5.5 11 7.4 9.2 8.6 7.6C9 10 10 11 11 11.4C11 8 11 5.4 12 2.5Z', 'a'],
    ['path', 'M12 12.5C13.6 14 14.6 15.2 14.6 16.8A2.6 2.6 0 0 1 9.4 16.8C9.4 15 11 14 12 12.5Z', C.paper],
  ],
  lucky: [
    ['path', star4(12, 12, 10, 0.34), 'a'],
    ['path', star4(12, 12, 4, 0.34), C.paper],
  ],
  dream: [
    ['path', 'M13 3.5A8.5 8.5 0 1 0 20.5 15.5A7 7 0 1 1 13 3.5Z', 'a'],
    ['path', 'M15.5 5H19.5L15.5 9.5H19.5', 'nofill'],
  ],
  takeoff: [
    ['path', 'M12 2C15.5 5 16.5 9.5 15.6 15H8.4C7.5 9.5 8.5 5 12 2Z', 'a'],
    ['path', 'M8.4 12.5L5 16.5L8.8 16.2ZM15.6 12.5L19 16.5L15.2 16.2Z', C.paper],
    ['circle', 12, 8.5, 1.8, C.paper],
    ['path', 'M10 16.5L12 21.5L14 16.5Z', C.honey],
  ],
  nature: [
    ['circle', 12, 12, 9.5, 'a'],
    ['path', star4(12, 12, 5.6), C.paper],
  ],
  recall: [
    ['rect', 4, 3, 16, 18, 2, 'a'],
    ['line', 7.5, 8, 16.5, 8], ['line', 7.5, 12, 16.5, 12], ['line', 7.5, 16, 13, 16],
  ],
  total: [
    ['path', 'M12 12C9.6 8.4 4 7.8 4 12C4 16.2 9.6 15.6 12 12C14.4 8.4 20 7.8 20 12C20 16.2 14.4 15.6 12 12Z', 'a'],
  ],
  lock: [
    ['rect', 5.5, 10.5, 13, 10, 2, C.lav2],
    ['path', 'M8.5 10.5V7.5A3.5 3.5 0 0 1 15.5 7.5V10.5', 'nofill'],
  ],
  spark: [
    ['path', star4(12, 12, 10.5, 0.3), C.honey],
  ],
  heart: [
    ['path', 'M12 20.5C6.5 16.4 3 13.2 3 9.2C3 6.4 5.1 4.4 7.6 4.4C9.4 4.4 10.9 5.4 12 7C13.1 5.4 14.6 4.4 16.4 4.4C18.9 4.4 21 6.4 21 9.2C21 13.2 17.5 16.4 12 20.5Z', 'a'],
  ],
};
export const GLYPH_OF_GEN = ['notebook', 'rig', 'gpu', 'server', 'datacenter', 'campus', 'fusion', 'orbital', 'lunar', 'dyson', 'matrioshka', 'universe'];
export const GLYPH_OF_KIND = { tap: 'tap', echo: 'echo', global: 'global', syn: 'syn', luck: 'luck', golden: 'golden' };

// ---------- SVG markup (the panels) ----------
const fillOf = (f, accent) => (f === 'a' ? accent : f === 'nofill' || f == null ? 'none' : f);
export function glyphSVG(name, accent = C.honey, { stroke = INK, width = 1.7 } = {}) {
  const shapes = GLYPHS[name] || GLYPHS.spark;
  const parts = shapes.map(([kind, ...a]) => {
    const fill = fillOf(a[a.length - 1], accent);
    const common = `fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"`;
    if (kind === 'rect') return `<rect x="${a[0]}" y="${a[1]}" width="${a[2]}" height="${a[3]}" rx="${a[4]}" ${common}/>`;
    if (kind === 'circle') return `<circle cx="${a[0]}" cy="${a[1]}" r="${a[2]}" ${common}/>`;
    if (kind === 'ellipse') return `<ellipse cx="${a[0]}" cy="${a[1]}" rx="${a[2]}" ry="${a[3]}" transform="rotate(${a[4]} ${a[0]} ${a[1]})" ${common}/>`;
    if (kind === 'line') return `<line x1="${a[0]}" y1="${a[1]}" x2="${a[2]}" y2="${a[3]}" ${common}/>`;
    return `<path d="${a[0]}" ${common}/>`;
  });
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${parts.join('')}</svg>`;
}

// ---------- canvas (the core's satellites) ----------
const paths = new Map();
const pathOf = (d) => { let p = paths.get(d); if (!p) { p = new Path2D(d); paths.set(d, p); } return p; };
// draws a glyph centred at (x, y), `size` CSS pixels across
export function drawGlyph(ctx, name, x, y, size, accent = C.honey, { stroke = INK, width = 1.7 } = {}) {
  const shapes = GLYPHS[name] || GLYPHS.spark;
  const k = size / 24;
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(k, k);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.strokeStyle = stroke; ctx.lineWidth = width;
  for (const [kind, ...a] of shapes) {
    const fill = fillOf(a[a.length - 1], accent);
    let p;
    if (kind === 'path') p = pathOf(a[0]);
    else {
      p = new Path2D();
      if (kind === 'rect') p.roundRect ? p.roundRect(a[0], a[1], a[2], a[3], a[4]) : p.rect(a[0], a[1], a[2], a[3]);
      else if (kind === 'circle') p.arc(a[0], a[1], a[2], 0, Math.PI * 2);
      else if (kind === 'ellipse') p.ellipse(a[0], a[1], a[2], a[3], (a[4] * Math.PI) / 180, 0, Math.PI * 2);
      else if (kind === 'line') { p.moveTo(a[0], a[1]); p.lineTo(a[2], a[3]); }
    }
    if (fill !== 'none' && kind !== 'line') { ctx.fillStyle = fill; ctx.fill(p); }
    ctx.stroke(p);
  }
  ctx.restore();
}
