// TRENCHING SIMULATOR's small building blocks for the page (2026-10-20): elements made with createElement (never HTML
// from strings: every word is text), line icons drawn as SVG, text set only when it changed (the board updates many
// numbers a second), and toasts. Styles only through classes and the CSS object model (the site's CSP allows no style
// attributes).
const SVG = 'http://www.w3.org/2000/svg';

// el('button', { class: 'ts-btn', type: 'button', on: { click } }, 'Play', icon('play'))
export function el(tag, attrs, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') n.className = Array.isArray(v) ? v.filter(Boolean).join(' ') : v;
    else if (k === 'on') for (const [ev, fn] of Object.entries(v)) n.addEventListener(ev, fn);
    else if (k === 'text') n.textContent = String(v);
    else if (k === 'data') for (const [dk, dv] of Object.entries(v)) n.dataset[dk] = String(dv);
    else if (k === 'vars') for (const [vk, vv] of Object.entries(v)) n.style.setProperty(vk, String(vv));
    else if (k in n && typeof v !== 'string') n[k] = v;
    else n.setAttribute(k, v === true ? '' : String(v));
  }
  add(n, kids);
  return n;
}

function add(n, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k === null || k === undefined || k === false) continue;
    n.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

// a node's words, set only when they changed
export function setText(n, text) {
  const t = String(text);
  if (n && n.textContent !== t) n.textContent = t;
}

// a class switched on or off, only when it changed
export const flag = (n, cls, on) => n && n.classList.contains(cls) !== Boolean(on) && n.classList.toggle(cls, Boolean(on));

// A node's children made the same as `items` (each by its key): kept nodes are reused (and updated by `update`), new
// ones made by `make`, gone ones removed, then put in order. So a list of coins updates in place, focus and all.
export function keyed(host, items, keyOf, make, update) {
  const old = new Map();
  for (const c of [...host.children]) if (c.dataset.key) old.set(c.dataset.key, c);
  let prev = null;
  for (const it of items) {
    const k = String(keyOf(it));
    let n = old.get(k);
    if (n) old.delete(k);
    else {
      n = make(it);
      n.dataset.key = k;
    }
    if (update) update(n, it);
    const want = prev ? prev.nextSibling : host.firstChild;
    if (want !== n) host.insertBefore(n, want);
    prev = n;
  }
  for (const n of old.values()) n.remove();
}

// line icons (24 × 24, stroke = currentColor)
const PATHS = {
  play: 'M7 4l13 8-13 8z', pause: 'M8 4v16M16 4v16', close: 'M6 6l12 12M18 6L6 18', back: 'M15 5l-7 7 7 7',
  menu: 'M4 7h16M4 12h16M4 17h16', search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  sound: 'M4 10v4h4l5 4V6L8 10zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11', mute: 'M4 10v4h4l5 4V6L8 10zM17 9l5 6M22 9l-5 6',
  star: 'M12 3l2.7 5.6 6.2.9-4.5 4.4 1 6.1L12 17l-5.5 3 1-6.1L3 9.5l6.2-.9z', share: 'M12 3v12M7 8l5-5 5 5M5 14v6h14v-6',
  download: 'M12 4v12M7 11l5 5 5-5M5 20h14', trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H4a4 4 0 0 0 4 4M16 6h4a4 4 0 0 1-4 4M12 13v4M8 20h8',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2', bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  shovel: 'M14 3l7 7-3 1-5-5zM14.5 8.5L5 18M3 21l2-3 1 1z', crown: 'M3 8l4 4 5-7 5 7 4-4-2 11H5z',
  bag: 'M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2', check: 'M5 12l5 5 9-10', lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
  chart: 'M4 20V4M4 20h16M8 16l4-5 3 3 5-7', flame: 'M12 3c2 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 3-6 1 2 2 2 3 2 0-3-1-5 0-7z',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M17 11a3 3 0 1 0-1-5.8M22 20a6 6 0 0 0-4-5.6',
  sliders: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4', info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7v.5',
  replay: 'M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5', arrows: 'M7 4v16M4 17l3 3 3-3M17 20V4M14 7l3-3 3 3',
};

export function icon(name, cls = 'ts-icon') {
  const s = document.createElementNS(SVG, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('focusable', 'false');
  s.setAttribute('class', cls);
  const p = document.createElementNS(SVG, 'path');
  p.setAttribute('d', PATHS[name] || PATHS.info);
  s.append(p);
  return s;
}

// a short note at the bottom of the screen, said to screen readers too (`tone`: '', 'up', 'down')
let toastHost = null;
export function toast(text, tone = '', ms = 2600) {
  if (!toastHost || !toastHost.isConnected) {
    toastHost = el('div', { class: 'ts-toasts', role: 'status', 'aria-live': 'polite' });
    document.body.append(toastHost);
  }
  const t = el('div', { class: ['ts-toast', tone && `is-${tone}`], text });
  toastHost.append(t);
  while (toastHost.children.length > 3) toastHost.firstChild.remove();
  setTimeout(() => {
    t.classList.add('is-out');
    setTimeout(() => t.remove(), 300);
  }, ms);
  return t;
}

// every toast gone at once (a new screen: a trade's toast never lingers over the results or a list)
export function clearToasts() {
  if (toastHost) toastHost.replaceChildren();
}

// a terminal's colors as the page's custom properties (from terminals.js: one place for them)
export function paintTerminal(node, terminal) {
  const c = (terminal && terminal.colors) || {};
  // a key in camelCase becomes its CSS name in kebab-case (onAccent → --t-on-accent)
  for (const [k, v] of Object.entries(c)) node.style.setProperty(`--t-${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`, v);
}
