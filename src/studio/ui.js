// AGI Studio (2026-10-10): the app's small building blocks: making elements (always with textContent, never HTML from
// strings), its icons (drawn here as SVG paths), bottom sheets (native <dialog>: focus kept inside, Escape closes), toasts,
// chips (real radio buttons, styled), copying, and pictures that fail softly.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// h('button', { class: 'sa-btn', type: 'button', onclick: fn, text: 'Go' }, child, …): attributes as strings, `text` as
// textContent, `dataset`, on<event> as listeners; children are nodes or plain text (never parsed as HTML)
export function h(tag, props = null, ...kids) {
  const node = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = String(v);
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (k === 'checked' || k === 'disabled' || k === 'hidden' || k === 'selected' || k === 'muted') node[k] = Boolean(v);
      else if (k === 'value') node.value = String(v);
      else node.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid === null || kid === undefined || kid === false) continue;
    node.append(kid instanceof Node ? kid : String(kid));
  }
  return node;
}
// replaceChildren and append that skip null, undefined and false and flatten arrays, like h()'s children (the browser's
// own would show a bare null as the word "null")
const kidsOf = (kids) => kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false).map((k) => (k instanceof Node ? k : String(k)));
export function put(node, ...kids) { node.replaceChildren(...kidsOf(kids)); return node; }
export function add(node, ...kids) { node.append(...kidsOf(kids)); return node; }

// ---------- icons (24 × 24, stroked; drawn for the app) ----------
const SVG = 'http://www.w3.org/2000/svg';
const ICONS = {
  spark: ['M12 3c.7 4.6 2.6 7 7 8-4.4 1-6.3 3.4-7 9-.7-5.6-2.6-8-7-9 4.4-1 6.3-3.4 7-8Z'],
  compass: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'm15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8 4.8-2.2Z'],
  plus: ['M12 5v14M5 12h14'],
  user: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M4.5 20c1.2-3.4 4-5 7.5-5s6.3 1.6 7.5 5'],
  image: ['M4 5h16v14H4z', 'm4 16 4.5-4.5 3.5 3.5 2.5-2.5L20 17', 'M15.5 9.5a1.5 1.5 0 1 0 0-.01'],
  film: ['M4 5h16v14H4z', 'M8 5v14M16 5v14M4 9h4M4 15h4M16 9h4M16 15h4'],
  zap: ['M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z'],
  cube: ['M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z', 'M4 7.5 12 12l8-4.5M12 12v9'],
  coin: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M9.5 9.2c.4-1 1.4-1.6 2.6-1.6 1.6 0 2.6.8 2.6 2 0 2.6-5.2 1.6-5.2 4.3 0 1.2 1.1 2 2.6 2 1.3 0 2.3-.6 2.6-1.6M12 6v1.6M12 16v2'],
  camera: ['M4 8h3l1.8-2.5h6.4L17 8h3v11H4z', 'M12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z'],
  upload: ['M12 15V4M7.5 8.5 12 4l4.5 4.5', 'M4 15v4h16v-4'],
  download: ['M12 4v11M7.5 10.5 12 15l4.5-4.5', 'M4 15v4h16v-4'],
  share: ['M8 12.5 16 8M8 11.5l8 4.5', 'M6 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM18 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM18 19.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z'],
  link: ['M10 14a4.5 4.5 0 0 0 6.4 0l2.6-2.6a4.5 4.5 0 0 0-6.4-6.4L11.5 6', 'M14 10a4.5 4.5 0 0 0-6.4 0L5 12.6a4.5 4.5 0 0 0 6.4 6.4l1.1-1.1'],
  flag: ['M5 21V4M5 4h11l-2 4 2 4H5'],
  trash: ['M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v5M14 11v5'],
  check: ['m5 12.5 4.5 4.5L19 7.5'],
  close: ['M6 6l12 12M18 6 6 18'],
  back: ['M15 5 8 12l7 7'],
  next: ['m9 5 7 7-7 7'],
  up: ['m6 15 6-6 6 6'],
  down: ['m6 9 6 6 6-6'],
  sliders: ['M4 7h9M17 7h3M4 17h3M11 17h9', 'M15 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM9 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z'],
  eye: ['M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'],
  eyeOff: ['M4 4l16 16', 'M9.9 5.8c.7-.2 1.4-.3 2.1-.3 6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.7M6.6 6.9C4 8.6 2.5 12 2.5 12S6 18.5 12 18.5c1.8 0 3.3-.5 4.6-1.3'],
  wallet: ['M4 7.5h15a1 1 0 0 1 1 1V19H5a1 1 0 0 1-1-1V7.5Z', 'M4 7.5 16 4v3.5', 'M16 13.2h.01'],
  copy: ['M8 8h11v11H8z', 'M16 8V5H5v11h3'],
  play: ['M8 5.5v13l10.5-6.5L8 5.5Z'],
  // (2026-10-11) the guide's video: pause
  pause: ['M8.5 5.5v13M15.5 5.5v13'],
  refresh: ['M19.5 12a7.5 7.5 0 1 1-2.2-5.3', 'M19.5 4.5v4h-4'],
  bolt: ['M13.5 2.5 6 13h5.5l-1 8.5L18 11h-5.5l1-8.5Z'],
  dots: ['M5.5 12h.01M12 12h.01M18.5 12h.01'],
  shield: ['M12 3 5 6v5.5c0 4.4 3 8 7 9.5 4-1.5 7-5.1 7-9.5V6l-7-3Z'],
  wand: ['M5 19 15 9M13.5 5.5l.8-2 .8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8ZM18 12l.5-1.2.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5Z'],
  sound: ['M5 9.5h3.5L13 5.5v13l-4.5-4H5v-5Z', 'M16 9.2a4 4 0 0 1 0 5.6M18.5 6.8a7.5 7.5 0 0 1 0 10.4'],
  heart: ['M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z'],
  // (2026-10-13) "With AGI-1": someone, and a little heart beside them (never the likes' heart alone)
  agi1: ['M8.5 11a3.3 3.3 0 1 0 0-6.6 3.3 3.3 0 0 0 0 6.6Z', 'M2.8 20c.9-3 3.1-4.6 5.7-4.6 1.4 0 2.6.4 3.6 1.2',
    'M17.6 18.5s-4-2.4-4-5.3a2.2 2.2 0 0 1 4-1.3 2.2 2.2 0 0 1 4 1.3c0 2.9-4 5.3-4 5.3Z'],
  flame: ['M12 21c-3.8 0-6.5-2.6-6.5-6.3 0-3.2 2.2-5 3.5-7.4.6 1.6 1.6 2.6 2.7 3 .1-2.9 1.3-5.6 3.5-7.3-.2 2.6.6 4.4 2 6.2 1.3 1.6 1.8 3 1.8 4.9 0 4-3 6.9-7 6.9Z'],
  trophy: ['M8 4h8v5.5a4 4 0 0 1-8 0V4Z', 'M8 6H5.2a3 3 0 0 0 2.9 4.2M16 6h2.8a3 3 0 0 1-2.9 4.2', 'M12 13.5V17M8.5 20.5h7M9.5 17h5'],
  rocket: ['M14.5 4.5c2.6-.9 4.4-.8 5-.2.6.6.7 2.4-.2 5-1 2.9-3.6 5.7-6.4 7.4l-3.6-3.6c1.7-2.8 4.3-5.4 5.2-8.6Z', 'M9.3 13.1 6 12.6l2.6-3.1 3.3-.3M10.9 14.7l.5 3.3 3.1-2.6.3-3.3', 'M6.7 16.4c-1.3.4-2 1.4-2.2 3.1 1.7-.2 2.7-.9 3.1-2.2'],
  grid: ['M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z'],
  // (round 4) a caption: a speech bubble with lines
  caption: ['M4.5 5.5h15v10h-9l-4.5 3.5v-3.5h-1.5v-10Z', 'M8 9.5h8M8 12.5h5'],
  // (round 4) clank.trade's @name
  at: ['M16 12a4 4 0 1 0-1.2 2.9', 'M16 9v4.2a2.3 2.3 0 0 0 4.5.6A9 9 0 1 0 17 19.2'],
  // (round 4, phase 2) help and support, the team's page, the owner's tab
  help: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M9.6 9.4a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.7M12 17h.01'],
  send: ['M4.5 11.5 19.5 4.5l-5 15-3.2-6.3-6.8-1.7Z', 'M11.3 13.2 19.5 4.5'],
  ban: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M5.7 5.7l12.6 12.6'],
  bell: ['M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15l1.5-2Z', 'M10 20.5a2 2 0 0 0 4 0'],
  team: ['M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z', 'M3 20c.9-3 3.2-4.5 6-4.5s5.1 1.5 6 4.5', 'M16 11a3 3 0 1 0 0-6', 'M17.5 15.6c1.9.4 3.1 1.9 3.5 4.4'],
  inbox: ['M4 13.5 6.5 5h11l2.5 8.5V19H4v-5.5Z', 'M4 13.5h4.5l1.2 2.2h4.6l1.2-2.2H20'],
  chart: ['M4 20h16', 'M7 16v-4M12 16V8M17 16v-7'],
  // (round 4, phase 3) gifts of credits, and invites
  gift: ['M4.5 11h15v9h-15z', 'M3.5 7.5h17V11h-17z', 'M12 7.5V20', 'M12 7.5c-.6-2.6-2.4-4-4-4-1.4 0-2.2 1-1.7 2.1.6 1.3 2.8 1.9 5.7 1.9Zm0 0c.6-2.6 2.4-4 4-4 1.4 0 2.2 1 1.7 2.1-.6 1.3-2.8 1.9-5.7 1.9Z'],
  invite: ['M10 11a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z', 'M3.5 20c1-3.2 3.5-4.9 6.5-4.9 1.3 0 2.5.3 3.5.9', 'M18 13.5v6M15 16.5h6'],
  // (round 4, phase 4) Instant (fast-forward chevrons: never a lightning bolt, the credits' sign), a meme, a reference, learning
  ff: ['m4.5 6.5 5.5 5.5-5.5 5.5', 'm12 6.5 5.5 5.5-5.5 5.5'],
  smile: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M8.5 14.2c.9 1.3 2.1 1.9 3.5 1.9s2.6-.6 3.5-1.9', 'M9 9.8h.01M15 9.8h.01'],
  paperclip: ['M16.5 7.5 9.4 14.6a1.9 1.9 0 0 0 2.7 2.7l7.2-7.2a3.9 3.9 0 0 0-5.5-5.5l-7.4 7.4a5.8 5.8 0 0 0 8.2 8.2l6-6'],
  learn: ['M2.5 9.5 12 5l9.5 4.5L12 14 2.5 9.5Z', 'M6.5 11.4v4.5c1.5 1.4 3.4 2.1 5.5 2.1s4-.7 5.5-2.1v-4.5', 'M21.5 9.5v5'],
  // (2026-10-12, the editor) the photo editor's tools
  crop: ['M6.5 3v12.5a2 2 0 0 0 2 2H21', 'M17.5 21V8.5a2 2 0 0 0-2-2H3'],
  sun: ['M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4'],
  filter: ['M12 11.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z', 'M8 19a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z', 'M16 19a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z'],
  type: ['M5 7V4.5h14V7', 'M12 4.5v15', 'M9 19.5h6'],
  sticker: ['M20.5 12a8.5 8.5 0 1 0-8.5 8.5l8.5-8.5Z', 'M20.5 12H16a4 4 0 0 0-4 4v4.5', 'M9 9.5h.01M14.5 9.5h.01'],
  turnLeft: ['M3.5 4v5h5', 'M3.9 9a8.5 8.5 0 1 1 .8 7'],
  turnRight: ['M20.5 4v5h-5', 'M20.1 9a8.5 8.5 0 1 0-.8 7'],
  flip: ['M12 3v18', 'M9 7.5 3.5 17H9V7.5Z', 'M15 7.5 20.5 17H15V7.5Z'],
  undo: ['M9.5 14 4.5 9l5-5', 'M4.5 9H15a5 5 0 0 1 0 10h-3.5'],
  // (2026-10-12, the video editor) Edit video and its Trim tool; its sound off
  scissors: ['M6.5 9.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6.5 20.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z', 'M20 4.5 8.8 15.7M14.4 14.2 20 19.5M8.8 8.3l3.3 3.3'],
  soundOff: ['M5 9.5h3.5L13 5.5v13l-4.5-4H5v-5Z', 'M16.5 9.5l5 5M21.5 9.5l-5 5'],
  // (2026-10-13) "Remove watermark": an eraser
  eraser: ['M13.3 4.4 20.6 11.7 12.4 19.9 5.1 12.6 13.3 4.4Z', 'M8.4 9.3 15.7 16.6', 'M12.4 19.9H20'],
};
export function icon(name, cls = 'sa-i') {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', cls);
  for (const d of ICONS[name] || []) {
    const p = document.createElementNS(SVG, 'path');
    p.setAttribute('d', d);
    p.setAttribute('stroke', 'currentColor');
    p.setAttribute('stroke-width', '1.8');
    p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('stroke-linejoin', 'round');
    svg.append(p);
  }
  return svg;
}

// ---------- buttons ----------
// btn('Make photo', { kind: 'primary' | 'ghost' | 'quiet' | 'danger', icon: 'image', onclick, type, size: 'sm' | 'lg' })
export function btn(label, { kind = 'ghost', icon: ic = null, size = null, ...rest } = {}) {
  const b = h('button', { type: 'button', class: `sa-btn sa-btn-${kind}${size ? ` sa-btn-${size}` : ''}`, ...rest });
  if (ic) b.append(icon(ic));
  if (label) b.append(h('span', { text: label }));
  return b;
}
export function linkBtn(label, href, { kind = 'ghost', icon: ic = null, size = null, ...rest } = {}) {
  const a = h('a', { href, class: `sa-btn sa-btn-${kind}${size ? ` sa-btn-${size}` : ''}`, ...rest });
  if (ic) a.append(icon(ic));
  if (label) a.append(h('span', { text: label }));
  return a;
}
// a button busy with a request: its label while it waits, then back
// ---------- (2026-10-12) the keyboard's place in a part drawn again (a look's new answer, Make another, Delete) ----------
// focusPlace(box) before it: which control has the keyboard (by its own id, or its place among the controls of the element
// with an id around it: a tile), or null (the keyboard isn't in it). focusBack(box, place, fallback) after it: the same
// control again, else the fallback (its tile went: deleted); never when the keyboard is somewhere else already
const CONTROLS = 'button, a[href], input, select, textarea, [tabindex]';
export function focusPlace(box) {
  const a = document.activeElement;
  if (!a || a === document.body || !box.contains(a)) return null;
  if (a.id) return { id: a.id, n: -1 };
  const scope = a.parentElement?.closest('[id]');
  const inBox = scope && box.contains(scope) ? scope : null;
  return { id: inBox?.id || null, n: [...(inBox || box).querySelectorAll(CONTROLS)].indexOf(a) };
}
export function focusBack(box, place, fallback = null) {
  if (!place) return;
  const now = document.activeElement;
  if (now && now !== document.body && now.isConnected) return;
  const scope = place.id ? document.getElementById(place.id) : box;
  const el = scope && box.contains(scope) ? (place.n < 0 ? scope : scope.querySelectorAll(CONTROLS)[place.n] || scope.querySelector(CONTROLS)) : null;
  (el || fallback)?.focus({ preventScroll: true });
}

export async function busy(button, label, work) {
  const old = [...button.childNodes];
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.replaceChildren(h('span', { class: 'sa-spin', 'aria-hidden': 'true' }), h('span', { text: label }));
  try { return await work(); } finally {
    button.disabled = false;
    button.removeAttribute('aria-busy');
    button.replaceChildren(...old);
  }
}

// ---------- chips: a group of radio buttons (or checkboxes) that look like chips ----------
let uid = 0;
export const nextId = (p = 'sa') => `${p}-${++uid}`;
// chips({ name, legend, choices: { value: label } | [[value, label, look?]], value, onchange, hint, cls, media, swatches })
//   media: each choice is a tile with a picture (round 2: "show example of the image not just text"): its picture comes
//     later, with .media(value → its address, or null): a choice without one shows a soft tile
//   swatches: each choice shows its color (look.swatch, a CSS color, set through the style object: never a style attribute,
//     which the page's CSP refuses); one without a color ("Any") shows every color
//   toggle (2026-10-11, the owner: "they cant uncheck its look when creating, like when they pick masculine, it wont
//     uncheck"): a picked chip tapped again is unpicked, back to "Any" when the group has it, else none (Create then asks for
//     a choice it needs). Only where a group may be left empty: never a choice that must always have one (a shape, a tone)
//   sections (2026-10-11, 26 styles in four groups): [{ id, name, choices }]: more choices after the first ones, in named
//     sections, each a heading over its own tiles (as media: the first ones, like "Any style", stay plain chips). One group of
//     radio buttons all the same, and every section always shown: a picked one in a hidden or folded section would take the
//     whole group out of the keyboard's way (a browser's Tab only stops at a group's picked radio)
export function chips({ name, legend, choices, value = null, onchange = null, hint = null, cls = '', media = false, swatches = false, toggle = false, sections = null }) {
  const list = Array.isArray(choices) ? choices : Object.entries(choices);
  const secs = Array.isArray(sections) ? sections : [];
  const kind = media && !secs.length ? ' sa-chips-media' : swatches ? ' sa-chips-swatch' : secs.length ? ' sa-chips-sectioned' : '';
  const set = h('fieldset', { class: `sa-chips${kind} ${cls}`.trim() });
  set.append(h('legend', { class: 'sa-label', text: legend }));
  if (hint) set.append(h('p', { class: 'sa-hint', text: hint }));
  const groupName = name || nextId('chips');
  const boxes = new Map();
  const chip = (row, [v, label, look = null], asMedia) => {
    const id = nextId('chip');
    const input = h('input', { type: 'radio', class: 'sa-chip-input', name: groupName, id, value: v, checked: v === value });
    input.addEventListener('change', () => { if (input.checked) onchange?.(v); });
    const lab = h('label', { for: id });
    if (asMedia) {
      const box = h('span', { class: `sa-chip-media is-empty${v === '' ? ' is-any' : ''}`, 'aria-hidden': 'true' });
      boxes.set(v, box);
      lab.append(box);
    } else if (swatches) {
      const box = h('span', { class: `sa-chip-swatch${look?.swatch ? '' : ' is-any'}`, 'aria-hidden': 'true' });
      if (look?.swatch) box.style.setProperty('--sw', look.swatch);
      lab.append(box);
    }
    lab.append(h('span', { class: 'sa-chip-text', text: label }));
    row.append(h('span', { class: 'sa-chip' }, input, lab));
  };
  const row = h('div', { class: 'sa-chip-row' });
  for (const c of list) chip(row, c, media && !secs.length);
  if (list.length) set.append(row);
  for (const sec of secs) {
    const subId = nextId('chipsec');
    const subRow = h('div', { class: 'sa-chip-row', role: 'group', 'aria-labelledby': subId });
    for (const c of (Array.isArray(sec.choices) ? sec.choices : Object.entries(sec.choices))) chip(subRow, c, media);
    set.append(h('div', { class: `sa-chip-sec${media ? ' sa-chips-media' : ''}`, dataset: { section: sec.id } },
      h('p', { class: 'sa-chip-subhead', id: subId, text: sec.name }), subRow));
  }
  if (toggle) unpickable(set, onchange);
  return {
    node: set,
    get value() { return set.querySelector('input:checked')?.value ?? null; },
    set(v) { for (const i of set.querySelectorAll('input')) i.checked = i.value === v; },
    clear() { for (const i of set.querySelectorAll('input')) i.checked = false; },
    // the tiles' pictures (again when they arrive: the studio's settings can come after the page)
    media(urlOf) {
      for (const [v, box] of boxes) {
        const url = v === '' ? null : urlOf(v);
        const img = box.querySelector('img');
        if (url && !img) box.append(pic(url, { cls: 'sa-chip-img' }));
        else if (url && img && img.getAttribute('src') !== url) img.src = url;
        else if (!url && img) img.remove();
        box.classList.toggle('is-empty', !url);
      }
    },
  };
}

// chips' toggle: a picked chip tapped again is unpicked, back to "Any" (the choice whose value is '') when the group has it,
// else none. A radio clicked when it's picked already stays picked (and says nothing), so a tap is told by the chip being
// picked when a pointer went down on it: the arrow keys click the radio they move to too, in every browser, and never
// unpick. Space on a picked chip unpicks it as well (its keyup's click is cancelled, so it isn't picked again at once).
// row: what holds its chips (its fieldset, with its sections)
function unpickable(row, onchange) {
  let pressed = null; // { input, was }: the chip a pointer went down on, and whether it was picked then
  let keyed = null; // the chip Space just unpicked
  const inputs = () => [...row.querySelectorAll('.sa-chip-input')];
  const unpick = (input) => {
    const any = inputs().find((i) => i.value === '');
    input.checked = false;
    if (any) any.checked = true;
    onchange?.(any ? '' : null);
  };
  row.addEventListener('pointerdown', (e) => {
    const input = e.target.closest?.('.sa-chip')?.querySelector('.sa-chip-input') || null;
    pressed = input ? { input, was: input.checked } : null;
  });
  row.addEventListener('pointercancel', () => { pressed = null; });
  row.addEventListener('keydown', (e) => {
    pressed = null;
    const input = e.target;
    if (e.key !== ' ' || !input.matches?.('.sa-chip-input') || !input.checked || input.value === '') return;
    e.preventDefault();
    keyed = input;
    unpick(input);
  });
  row.addEventListener('keyup', () => { if (keyed) setTimeout(() => { keyed = null; }); });
  row.addEventListener('click', (e) => {
    const input = e.target;
    if (!input.matches?.('.sa-chip-input')) return; // a label's own click: its radio's comes next
    if (keyed === input) { e.preventDefault(); return; }
    const p = pressed;
    pressed = null;
    if (p?.input === input && p.was && input.value !== '') unpick(input);
  });
}

// ---------- cards to pick one from (round 4, phase 4: the model menu) ----------
// cardPick({ legend, choices: [{ value, name, note, price, from, off, why, pic }], value, onchange, cls }) → { node, value,
// set(v), update(choices) }. Radio buttons drawn as small cards: a name, a line about it, its price on the right ("⚡ 15", "from
// ⚡ 76" with from: true, or a word like "Free"; price: null hides it); a choice that's off (Anime for a realistic influencer) is
// disabled and says why instead of its note. (2026-10-19, meme templates: "Add someone") pic: a picture element (a face) on its
// left, its name and line beside it
export function cardPick({ legend, choices, value = null, onchange = null, cls = '', showLegend = true }) {
  const set = h('fieldset', { class: `sa-cards ${cls}`.trim() }, h('legend', { class: showLegend ? 'sa-label' : 'sa-sr', text: legend }));
  const row = h('div', { class: 'sa-cards-row' });
  const groupName = nextId('card');
  const parts = new Map();
  for (const c of choices) {
    const id = nextId('card');
    const input = h('input', { type: 'radio', class: 'sa-card-input', name: groupName, id, value: c.value, checked: c.value === value, disabled: c.off === true });
    input.addEventListener('change', () => { if (input.checked) onchange?.(c.value); });
    const note = h('span', { class: 'sa-card-note', text: c.off ? c.why || c.note || '' : c.note || '' });
    const priceN = h('span', { class: 'sa-card-n' });
    const fromW = h('span', { class: 'sa-card-from', text: 'from ' });
    const unit = h('span', { class: 'sa-sr', text: ' credits' });
    const price = h('span', { class: 'sa-card-price' }, fromW, icon('bolt'), priceN, unit);
    const lab = h('label', { for: id, ...(c.pic ? { class: 'has-pic' } : {}) }, c.pic ? h('span', { class: 'sa-card-pic', 'aria-hidden': 'true' }, c.pic) : null,
      h('span', { class: 'sa-card-top' }, h('span', { class: 'sa-card-name', text: c.name }), price), note);
    parts.set(c.value, { input, note, price, priceN, fromW, unit, c });
    row.append(h('span', { class: `sa-card-opt${c.off ? ' is-off' : ''}` }, input, lab));
  }
  set.append(row);
  const api = {
    node: set,
    get value() { return set.querySelector('input:checked')?.value ?? null; },
    set(v) { for (const i of set.querySelectorAll('input')) i.checked = i.value === v; },
    // a choice's price now ("from 76", "Free", a number), and whether it's off (and why)
    update(list) {
      for (const c of list) {
        const p = parts.get(c.value);
        if (!p) continue;
        if (c.price !== undefined) {
          const isNum = typeof c.price === 'number';
          p.price.hidden = c.price === null;
          p.price.classList.toggle('is-text', !isNum);
          p.priceN.textContent = isNum ? c.price.toLocaleString('en-US') : String(c.price ?? '');
          p.fromW.hidden = !(isNum && c.from === true);
          p.unit.hidden = !isNum;
        }
        if (c.off !== undefined) {
          p.input.disabled = c.off === true;
          p.input.closest('.sa-card-opt').classList.toggle('is-off', c.off === true);
          p.note.textContent = c.off ? c.why || p.c.note || '' : p.c.note || '';
        }
      }
    },
  };
  api.update(choices);
  return api;
}

// ---------- a segmented control: a few radio buttons side by side (round 3: the pro tool layout's mode switch) ----------
// segmented({ legend, choices: [[value, label, icon?]], value, onchange, showLegend }) → { node, value, set(v) }
export function segmented({ legend, choices, value = null, onchange = null, cls = '', showLegend = false }) {
  const set = h('fieldset', { class: `sa-seg ${cls}`.trim() }, h('legend', { class: showLegend ? 'sa-label' : 'sa-sr', text: legend }));
  const row = h('div', { class: 'sa-seg-row' });
  const groupName = nextId('seg');
  for (const [v, label, ic = null] of choices) {
    const id = nextId('seg');
    const input = h('input', { type: 'radio', class: 'sa-seg-input', name: groupName, id, value: v, checked: v === value });
    input.addEventListener('change', () => { if (input.checked) onchange?.(v); });
    row.append(h('span', { class: 'sa-seg-opt' }, input, h('label', { for: id }, ic ? icon(ic) : null, h('span', { text: label }))));
  }
  set.append(row);
  return {
    node: set,
    get value() { return set.querySelector('input:checked')?.value ?? null; },
    set(v) { for (const i of set.querySelectorAll('input')) i.checked = i.value === v; },
  };
}

// ---------- tabs over a page's panels (round 4, phase 2: the owner's tab, the team's page) ----------
// pageTabs({ label, items: [[key, label, icon?]], value, onchange }) → { node, panel(key), show(key), value, count(key, n) }.
// Real tabs (the arrow keys, Home and End move between them, like any tab list); each panel is drawn by its page.
export function pageTabs({ label, items, value = null, onchange = null }) {
  const id = nextId('ptab');
  const keys = items.map(([k]) => k);
  let current = keys.includes(value) ? value : keys[0];
  const list = h('div', { class: 'sa-gtabs sa-ptabs', role: 'tablist', 'aria-label': label });
  const panels = new Map(), buttons = new Map(), counts = new Map();
  for (const [key, text, ic = null] of items) {
    const n = h('span', { class: 'sa-gtab-n', hidden: true });
    const b = h('button', { type: 'button', role: 'tab', class: 'sa-gtab', id: `${id}-${key}-t`, 'aria-controls': `${id}-${key}`, dataset: { tab: key } },
      ic ? icon(ic) : null, h('span', { text }), n);
    b.addEventListener('click', () => show(key));
    buttons.set(key, b);
    counts.set(key, n);
    panels.set(key, h('div', { class: 'sa-ppanel', role: 'tabpanel', id: `${id}-${key}`, 'aria-labelledby': `${id}-${key}-t` }));
    list.append(b);
  }
  list.addEventListener('keydown', (e) => {
    const at = keys.indexOf(current);
    const to = e.key === 'ArrowRight' ? keys[(at + 1) % keys.length] : e.key === 'ArrowLeft' ? keys[(at - 1 + keys.length) % keys.length]
      : e.key === 'Home' ? keys[0] : e.key === 'End' ? keys[keys.length - 1] : null;
    if (!to) return;
    e.preventDefault();
    show(to);
    buttons.get(to)?.focus();
  });
  function show(key, { quiet = false } = {}) {
    if (!panels.has(key)) return;
    current = key;
    for (const [k, b] of buttons) { b.setAttribute('aria-selected', String(k === key)); b.tabIndex = k === key ? 0 : -1; }
    for (const [k, p] of panels) p.hidden = k !== key;
    if (!quiet) onchange?.(key);
  }
  show(current, { quiet: true });
  return {
    node: h('div', { class: 'sa-ptabs-bar' }, list),
    panel: (k) => panels.get(k),
    show,
    get value() { return current; },
    // a small number on a tab (a count waiting there); 0 hides it
    count(key, n) { const c = counts.get(key); if (c) { c.textContent = n > 0 ? String(n) : ''; c.hidden = !(n > 0); } },
  };
}

// ---------- sheets: a native <dialog> as a bottom sheet on phones and a card on computers ----------
// sheet({ title, sub, size: 'md' | 'lg' }) → { dialog, body, foot, close(), done (a promise: resolves when it closes) }
export function sheet({ title, sub = null, size = 'md', onclose = null } = {}) {
  const id = nextId('sheet');
  const close = btn('', { kind: 'quiet', icon: 'close', class: 'sa-btn sa-btn-quiet sa-sheet-x', 'aria-label': 'Close' });
  const head = h('div', { class: 'sa-sheet-head' }, h('div', { class: 'sa-sheet-titles' }, h('h2', { class: 'sa-sheet-title', id, text: title }), sub ? h('p', { class: 'sa-sheet-sub', text: sub }) : null), close);
  const body = h('div', { class: 'sa-sheet-body' });
  const foot = h('div', { class: 'sa-sheet-foot', hidden: true });
  const dialog = h('dialog', { class: `sa-sheet sa-sheet-${size}`, 'aria-labelledby': id }, h('div', { class: 'sa-sheet-in' }, head, body, foot));
  let resolve;
  const done = new Promise((r) => { resolve = r; });
  // (2026-10-13) how tall its foot is, for the rules that fit a picture or a video above it (studio-app.css: a foot can
  // wrap onto a third line of buttons, since "Remove watermark"), kept as it changes; through the CSS object model (the
  // CSP forbids style attributes)
  const footH = () => dialog.style.setProperty('--sa-foot-h', `${foot.hidden ? 0 : foot.offsetHeight}px`);
  const footWatch = typeof ResizeObserver === 'function' ? new ResizeObserver(footH) : null;
  footWatch?.observe(foot);
  const finish = () => {
    footWatch?.disconnect();
    // its toasts (said while it was open) carry on where the next one shows, already read out
    const left = [...(dialog.querySelector(':scope > .sa-toasts')?.children || [])];
    dialog.remove();
    if (left.length) { for (const t of left) t.setAttribute('aria-hidden', 'true'); toastRegion()?.append(...left); }
    document.documentElement.classList.toggle('sa-locked', Boolean(document.querySelector('dialog.sa-sheet[open]')));
    onclose?.();
    resolve();
  };
  dialog.addEventListener('close', finish, { once: true });
  // a tap on the dimmed page around it closes it (the dialog's own box is the backdrop's target)
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  close.addEventListener('click', () => dialog.close());
  document.body.append(dialog);
  dialog.showModal();
  document.documentElement.classList.add('sa-locked');
  return {
    dialog, body, foot, done,
    close: () => { if (dialog.open) dialog.close(); },
    setFoot(...nodes) { const list = kidsOf(nodes); foot.replaceChildren(...list); foot.hidden = !list.length; footH(); },
  };
}
// closes every open sheet (leaving a page)
export const closeSheets = () => { for (const d of document.querySelectorAll('dialog.sa-sheet[open]')) d.close(); };

// ---------- toasts (read out by screen readers: the region is aria-live) ----------
// While a sheet is open everything else is inert (and dimmed), so its toasts go in the sheet itself
function toastRegion() {
  const open = [...document.querySelectorAll('dialog.sa-sheet[open]')].pop();
  if (!open) return document.querySelector('[data-sa-toasts]');
  let r = open.querySelector(':scope > .sa-toasts');
  if (!r) { r = h('div', { class: 'sa-toasts', 'aria-live': 'polite' }); open.append(r); }
  return r;
}
export function toast(text, kind = 'info') {
  const region = toastRegion();
  if (!region || !text) return;
  const t = h('div', { class: `sa-toast sa-toast-${kind}`, role: kind === 'bad' ? 'alert' : 'status' }, h('span', { text }));
  region.append(t);
  while (region.children.length > 3) region.firstElementChild.remove();
  setTimeout(() => { t.classList.add('is-out'); setTimeout(() => t.remove(), 300); }, kind === 'bad' ? 6000 : 4200);
}

// ---------- a line of words that can show or hide (an error under a field, a note) ----------
export function say(node, text) { if (node) { node.textContent = text || ''; node.hidden = !text; } }

// ---------- copying: the text, or (where the clipboard is blocked) selected for the keyboard ----------
export async function copyText(text, node = null) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    if (node) {
      const range = document.createRange();
      range.selectNodeContents(node);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
    }
    return false;
  }
}

// ---------- pictures ----------
// pic(src, { alt, w, h, cls, lazy }): an <img> that marks itself missing when it can't load (a soft tile instead)
export function pic(src, { alt = '', w = null, ht = null, cls = 'sa-pic', lazy = true } = {}) {
  const img = h('img', { class: cls, alt, src, ...(w ? { width: w } : {}), ...(ht ? { height: ht } : {}), loading: lazy ? 'lazy' : null, decoding: 'async' });
  img.addEventListener('error', () => img.classList.add('is-missing'), { once: true });
  return img;
}

// the user moved away (a new view): timers and listeners that a view started stop with this
export function stopper() {
  const stops = [];
  return {
    add(fn) { stops.push(fn); return fn; },
    timeout(fn, ms) { const t = setTimeout(fn, ms); stops.push(() => clearTimeout(t)); return t; },
    on(target, type, fn, opts) { target.addEventListener(type, fn, opts); stops.push(() => target.removeEventListener(type, fn, opts)); },
    stop() { while (stops.length) { try { stops.pop()(); } catch { /* ignore */ } } },
  };
}
