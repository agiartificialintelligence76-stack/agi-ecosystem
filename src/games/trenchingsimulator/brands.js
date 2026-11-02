// TRENCHING SIMULATOR's parody brands (2026-10-21, the owner: "use a parody names, parody logo, parody branding of that
// terminal … for each terminal"; the owner's pick: sound-alikes). Each terminal's mark is ours, drawn here as plain SVG
// shapes (never a real terminal's logo, mascot, art or file), each with its own joke:
// - GNGM: "GN, GM": a sleepy pixel toad in a striped nightcap, facing right, one eye shut, a few "z"s;
// - Pomp.fun: "pomp and circumstance": a pill tilted the other way, wearing a little gold crown;
// - Axium: a stack of three rounded bars, a little off balance ("almost bonded, almost balanced");
// - BasedBott: a chat-bubble robot with two antennae (the two t's), one bent;
// - Phomo: pho + fomo: a steaming noodle bowl whose chopsticks make an up-arrow.
// Names are text only, never a link or a domain (".fun" auto-links on X and Telegram: never in a post). Pure: the shapes
// are data, read in Node by the tests; `markEl()` makes the SVG in the page.

const SVG = 'http://www.w3.org/2000/svg';

const B = (o) => Object.freeze({ ...o, word: Object.freeze(o.word.map((w) => Object.freeze(w))), shapes: Object.freeze(o.shapes) });

// `word`: the wordmark in parts, each { t: text, k: 'main' | 'accent' }; `view`: the SVG's viewBox; `pixel`: crisp edges
export const BRANDS = Object.freeze({
  clank: B({
    name: 'Clank.trade', view: '0 0 32 32',
    word: [{ t: 'clank', k: 'main' }, { t: '.trade', k: 'accent' }],
    shapes: [
      ['path', { d: 'M22 5H11L4 16l7 11h11l-7-11z', fill: '#c4b5fd' }],
      ['path', { d: 'M27 8h-7l-5 8 5 8h7l-5-8z', fill: '#f5f5f5' }],
      ['circle', { cx: 28, cy: 5, r: 2, fill: '#c4b5fd' }],
    ],
  }),
  scan: B({
    name: 'GNGM', view: '0 0 12 12', pixel: true,
    word: [{ t: 'GN', k: 'main' }, { t: 'GM', k: 'accent' }],
    shapes: [
      ['path', { fill: '#3f7a2a', d: 'M2 5h8v1h1v4h-1v1H2v-1H1V6h1z' }],
      ['path', { fill: '#9fdc55', d: 'M2 6h8v4H2z' }],
      ['path', { fill: '#cfee8f', d: 'M3 6h2v1H3z' }],
      ['path', { fill: '#e4cf6a', d: 'M3 9h6v1H3z' }],
      ['path', { fill: '#141614', d: 'M7 7h2v1H7zM3 8h3v1H3z' }],
      ['path', { fill: '#f3f5ef', d: 'M3 3h5v1h1v1H2V4h1z' }],
      ['path', { fill: '#7c5cff', d: 'M4 3h1v2H4zM6 3h1v2H6zM8 2h1v2H8z' }],
      ['path', { fill: '#e5ff95', d: 'M10 1h1v1h-1zM9 2h1v1H9z' }],
    ],
  }),
  board: B({
    name: 'Pomp.fun', view: '0 0 32 32',
    word: [{ t: 'pomp', k: 'main' }, { t: '.fun', k: 'accent' }],
    shapes: [
      ['g', { transform: 'rotate(-45 16 18)' }, [
        ['rect', { x: 6, y: 13, width: 20, height: 10, rx: 5, fill: '#f4f6f5', stroke: '#173a2c', 'stroke-width': 1.6 }],
        ['path', { d: 'M11 13h5v10h-5a5 5 0 0 1 0-10z', fill: '#86efac', stroke: '#173a2c', 'stroke-width': 1.6 }],
        ['path', { d: 'M10 16h3', stroke: '#ffffff', 'stroke-width': 1.2, 'stroke-linecap': 'round', fill: 'none' }],
      ]],
      ['path', { d: 'M17 4l2 3 2-3 2 3 2-3v5h-8z', fill: '#eab308', stroke: '#173a2c', 'stroke-width': 1, 'stroke-linejoin': 'round' }],
    ],
  }),
  pro: B({
    name: 'Axium', view: '0 0 32 32',
    word: [{ t: 'AXI', k: 'main' }, { t: 'U', k: 'accent' }, { t: 'M', k: 'main' }],
    shapes: [
      ['g', { transform: 'rotate(-8 16 18)', fill: '#f4f4f7' }, [
        ['rect', { x: 14, y: 7, width: 9, height: 4, rx: 2 }],
        ['rect', { x: 9, y: 13, width: 14, height: 4, rx: 2 }],
        ['rect', { x: 6, y: 19, width: 20, height: 4, rx: 2 }],
      ]],
      ['circle', { cx: 26, cy: 7, r: 2, fill: '#7088ff' }],
    ],
  }),
  chat: B({
    name: 'BasedBott', view: '0 0 32 32',
    word: [{ t: 'BasedBo', k: 'main' }, { t: 'tt', k: 'accent' }],
    shapes: [
      ['path', { d: 'M6 8h20a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H13l-5 4v-4H6a3 3 0 0 1-3-3V11a3 3 0 0 1 3-3z', fill: '#5b9dff' }],
      ['circle', { cx: 12, cy: 16, r: 2.2, fill: '#0f1823' }],
      ['circle', { cx: 20, cy: 16, r: 2.2, fill: '#0f1823' }],
      ['path', { d: 'M12 8V4M20 8l2-4', stroke: '#5b9dff', 'stroke-width': 2, 'stroke-linecap': 'round', fill: 'none' }],
      ['circle', { cx: 12, cy: 3.5, r: 1.5, fill: '#5fd38d' }],
      ['circle', { cx: 22.4, cy: 3.5, r: 1.5, fill: '#f2726f' }],
    ],
  }),
  social: B({
    name: 'Phomo', view: '0 0 32 32',
    word: [{ t: 'pho', k: 'accent' }, { t: 'mo', k: 'main' }],
    shapes: [
      ['path', { d: 'M5 16h22a11 9 0 0 1-22 0z', fill: '#ff7a59' }],
      ['path', { d: 'M7 16q4 -3 9 0t9 0', fill: 'none', stroke: '#fde7dd', 'stroke-width': 1.6 }],
      ['path', { d: 'M18 14L26 4M21 15L27 7', stroke: '#f3f3f6', 'stroke-width': 1.6, 'stroke-linecap': 'round', fill: 'none' }],
      ['path', { d: 'M24 3l4 1-1 4', fill: 'none', stroke: '#f3f3f6', 'stroke-width': 1.6, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }],
      ['path', { d: 'M11 11v-4M14 12V6', stroke: '#b69cff', 'stroke-width': 1.4, 'stroke-linecap': 'round', fill: 'none' }],
    ],
  }),
});

export const brandOf = (id) => BRANDS[id] || null;

// the SVG tags a mark may use (the tests hold every mark to these: shapes only, never text, a picture or a link)
export const MARK_TAGS = Object.freeze(['g', 'path', 'rect', 'circle']);

function build(doc, [tag, attrs, kids]) {
  const n = doc.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  if (kids) for (const kid of kids) n.append(build(doc, kid));
  return n;
}

// a terminal's wordmark: its name in parts (main and accent), each a span; read as one word by screen readers
export function wordEl(id, cls = 'ts-word') {
  const b = brandOf(id);
  const doc = globalThis.document;
  const w = doc.createElement('span');
  w.className = cls;
  if (!b) return w;
  for (const part of b.word) {
    const s = doc.createElement('span');
    s.className = part.k === 'accent' ? 'ts-word-accent' : 'ts-word-main';
    s.textContent = part.t;
    w.append(s);
  }
  return w;
}

// a terminal's mark as an SVG element (decoration: hidden from screen readers; its name is said next to it)
export function markEl(id, cls = 'ts-mark') {
  const b = brandOf(id);
  const doc = globalThis.document;
  const s = doc.createElementNS(SVG, 'svg');
  s.setAttribute('viewBox', b ? b.view : '0 0 32 32');
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('focusable', 'false');
  s.setAttribute('class', cls);
  if (b && b.pixel) s.setAttribute('shape-rendering', 'crispEdges');
  if (b) for (const shape of b.shapes) s.append(build(doc, shape));
  return s;
}
