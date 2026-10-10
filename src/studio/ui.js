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
  eye: ['M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'],
  eyeOff: ['M4 4l16 16', 'M9.9 5.8c.7-.2 1.4-.3 2.1-.3 6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.7M6.6 6.9C4 8.6 2.5 12 2.5 12S6 18.5 12 18.5c1.8 0 3.3-.5 4.6-1.3'],
  wallet: ['M4 7.5h15a1 1 0 0 1 1 1V19H5a1 1 0 0 1-1-1V7.5Z', 'M4 7.5 16 4v3.5', 'M16 13.2h.01'],
  copy: ['M8 8h11v11H8z', 'M16 8V5H5v11h3'],
  play: ['M8 5.5v13l10.5-6.5L8 5.5Z'],
  refresh: ['M19.5 12a7.5 7.5 0 1 1-2.2-5.3', 'M19.5 4.5v4h-4'],
  bolt: ['M13.5 2.5 6 13h5.5l-1 8.5L18 11h-5.5l1-8.5Z'],
  dots: ['M5.5 12h.01M12 12h.01M18.5 12h.01'],
  shield: ['M12 3 5 6v5.5c0 4.4 3 8 7 9.5 4-1.5 7-5.1 7-9.5V6l-7-3Z'],
  wand: ['M5 19 15 9M13.5 5.5l.8-2 .8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8ZM18 12l.5-1.2.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5Z'],
  sound: ['M5 9.5h3.5L13 5.5v13l-4.5-4H5v-5Z', 'M16 9.2a4 4 0 0 1 0 5.6M18.5 6.8a7.5 7.5 0 0 1 0 10.4'],
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
// chips({ name, legend, choices: { value: label } | [[value, label]], value, onchange, required, hint })
export function chips({ name, legend, choices, value = null, onchange = null, hint = null, cls = '' }) {
  const list = Array.isArray(choices) ? choices : Object.entries(choices);
  const set = h('fieldset', { class: `sa-chips ${cls}`.trim() });
  set.append(h('legend', { class: 'sa-label', text: legend }));
  if (hint) set.append(h('p', { class: 'sa-hint', text: hint }));
  const row = h('div', { class: 'sa-chip-row' });
  const groupName = name || nextId('chips');
  for (const [v, label] of list) {
    const id = nextId('chip');
    const input = h('input', { type: 'radio', class: 'sa-chip-input', name: groupName, id, value: v, checked: v === value });
    input.addEventListener('change', () => { if (input.checked) onchange?.(v); });
    row.append(h('span', { class: 'sa-chip' }, input, h('label', { for: id, text: label })));
  }
  set.append(row);
  return {
    node: set,
    get value() { return set.querySelector('input:checked')?.value ?? null; },
    set(v) { for (const i of set.querySelectorAll('input')) i.checked = i.value === v; },
    clear() { for (const i of set.querySelectorAll('input')) i.checked = false; },
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
  const finish = () => {
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
    setFoot(...nodes) { const list = kidsOf(nodes); foot.replaceChildren(...list); foot.hidden = !list.length; },
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
