// AGI Studio's meme editor (2026-10-14, meme templates; the owner: "even after the result they can still edit the text after,
// change font, change the text color", then "Save as a new meme (Recommended)"). One of its own template memes: its words
// (their text, font, color, outline, what's behind them, their size, box and place), changed in its maker's own browser, free;
// then downloaded with the share mark (drawn here as our server draws it) or saved as a new meme next to it (our server draws
// the words itself, with the same fonts and layout, and Gemini looks at it first: server/inf-meme-save.js). Its words are
// shapes from the fonts' own files (opentype.js: src/studio/meme-layout.js), never the browser's text, so what's shown here is
// what's saved. Drawn on a canvas; every style set through the CSSOM (the page's CSP allows no style attributes).
//   memeEditor(ctx, { inf, job, name, onSaved }) → opens it over the page (its own sheet); onSaved(newJob) once one is saved
import { h, btn, sheet, say, busy, put, nextId, pageTabs, segmented, chips } from '../ui.js';
import { infMemePic } from '../rules.js';
import {
  MEME_CANVAS, MEME_FONTS, MEME_EMOJI_FILE, MEME_COLORS, MEME_OUTLINES, MEME_BOXES, LAYERS, MARK_PREFER,
  memeFontUrl, templateOf, picBox, checkLayers, tidyText, newLayer, markBoxAt, markSpot,
} from '../memes.js';
import { layerShape, drawLayers, wordBoxes, missingChars, needsEmoji, fitLayer } from '../meme-layout.js';
import { drawPicked, range, toolBtn } from './layers.js';
import { memeEditorNote, memeErrorText, memeWordsText, editorSavedText, errorText, removeMarkText } from '../app-words.js';
import { withAiTag } from '../ai-tag.js';

// the share mark (server/media/studio-mark.png: the same picture our server puts on downloads)
const MARK_SRC = new URL('../../../server/media/studio-mark.png', import.meta.url).href;
const PREVIEW_MAX = 1400;            // the preview's longest side, in the device's pixels
const HISTORY = 40;
const TOOL_KEYS = ['words', 'style', 'color'];
// "None" for an outline or what's behind the words: a struck-through swatch (a swatch without a color is chips' rainbow "Any")
const NONE_SWATCH = 'linear-gradient(135deg, transparent 44%, #ef4444 44% 56%, transparent 56%), #26262b';
// where "Add words" puts a new text: the first of these heights with no other text's middle near it
const SLOTS = [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8];
const SNAP = 0.012;                  // a text dragged this close to the middle of the meme snaps to it
const r4 = (v) => Math.round(v * 1e4) / 1e4;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const loadImage = (src) => new Promise((resolve) => {
  const img = new Image();
  img.decoding = 'async';
  img.addEventListener('load', () => resolve(img), { once: true });
  img.addEventListener('error', () => resolve(null), { once: true });
  img.src = src;
});
const canvasOf = (w, ht) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(ht)); return c; };
const toBlob = (c, q = 0.92) => new Promise((resolve) => c.toBlob((b) => resolve(b), 'image/jpeg', q));

// ---------- the fonts (the same files our server draws with: public/fonts/meme/) ----------
// opentype.js's own ES module (its package's "browser" field is its UMD build), loaded only here; a failure lets the next
// editor try again
let parseP = null, fontsP = null, emojiP = null;
async function opentypeParse() {
  const m = await import('opentype.js/dist/opentype.mjs');
  const parse = [m, m.default, m.default?.default].find((x) => typeof x?.parse === 'function')?.parse;
  if (!parse) throw new Error('opentype.js has no parse');
  return parse;
}
const parser = () => (parseP ||= opentypeParse().catch((e) => { parseP = null; throw e; }));
async function fontFile(parse, file) {
  const url = memeFontUrl(file);   // only ever /fonts/meme/<file>: our own address
  const r = await fetch(url, { credentials: 'same-origin' });
  if (!r.ok) throw new Error(`font ${file}: HTTP ${r.status}`);
  return parse(await r.arrayBuffer());
}
// the six fonts, by their ids (about 190 KB, kept a year by the browser)
export function loadMemeFonts() {
  if (!fontsP) {
    fontsP = parser().then(async (parse) => {
      const ids = Object.keys(MEME_FONTS);
      const list = await Promise.all(ids.map((id) => fontFile(parse, MEME_FONTS[id].file)));
      return Object.fromEntries(ids.map((id, k) => [id, list[k]]));
    }).catch((e) => { fontsP = null; throw e; });
  }
  return fontsP;
}
// …and the emoji font (102 KB), only once some words need it
export function loadEmojiFont() {
  if (!emojiP) emojiP = parser().then((parse) => fontFile(parse, MEME_EMOJI_FILE)).catch((e) => { emojiP = null; throw e; });
  return emojiP;
}

// a template layer's label for each of these layers (the one at its place), else "Words n"
function freeLabel(used, n) {
  let k = Math.max(1, n);
  while (used.includes(`Words ${k}`)) k++;
  return `Words ${k}`;
}
function labelsOf(tpl, list) {
  const out = [];
  for (const l of list) {
    const t = tpl.layers.find((d) => Math.abs(d.x - l.x) < 0.002 && Math.abs(d.y - l.y) < 0.002 && !out.includes(d.label));
    out.push(t ? t.label : null);
  }
  return out.reduce((acc, v, k) => { acc.push(v ?? freeLabel([...acc, ...out.filter(Boolean)], k + 1)); return acc; }, []);
}

export function memeEditor(ctx, { inf, job, name = 'Your influencer', onSaved = null }) {
  const tpl = templateOf(job.meme);
  const first = checkLayers(job.layers);
  if (!tpl || !first.ok) {
    const s = sheet({ title: 'Edit meme', size: 'md' });
    put(s.body, h('p', { class: 'sa-err', role: 'alert', text: memeErrorText({ error: 'old' }) }));
    return s;
  }
  const C = MEME_CANVAS[tpl.canvas];
  const PB = picBox(tpl);
  const firstJson = JSON.stringify(first.layers);
  const s = sheet({ title: 'Edit meme', sub: memeEditorNote(job), size: 'editor' });
  let layers = first.layers.map((l) => ({ ...l }));
  let labels = labelsOf(tpl, layers);
  const firstSnap = JSON.stringify({ layers, labels });
  const past = [];
  let src = null, mark = null, fonts = null, closed = false;
  let tab = 'words';
  let sel = -1;                     // the text picked (its index), or none

  // ---------- the stage ----------
  const view = h('canvas', { class: 'sa-pe-canvas', tabindex: '0', role: 'img', 'aria-label': 'Your meme as it will look' });
  const hint = h('p', { class: 'sa-pe-hint', 'aria-hidden': 'true', hidden: true });
  const help = h('p', { class: 'sa-sr', id: nextId('mxh'),
    text: 'On the meme: the arrow keys move the words picked (with Shift, further), + and − make them bigger or smaller, Page Up and Page Down pick the next or the one before, Delete removes them.' });
  view.setAttribute('aria-describedby', help.id);
  const stage = h('div', { class: 'sa-pe-stage is-loading' }, view, hint, help);
  const err = h('p', { class: 'sa-err', role: 'alert', hidden: true });
  // what changed for a screen reader (set directly: say() hides an empty node, and a live region must stay)
  const live = h('p', { class: 'sa-sr', 'aria-live': 'polite' });
  const announce = (text) => { live.textContent = text; };

  // ---------- a press under way ----------
  // A warning that would move what's being pressed waits until it's let go (a tick after: its click first). A text left empty
  // says so as it loses the keyboard, and that moved "Add words" and the remove buttons under it between their press and their
  // release, so the click was lost. Mouse and pen: pointerdown, then the focus moves; a tap: the focus moves with its mousedown,
  // after its pointerup, so both kinds are watched.
  let pressing = false;
  let held = [];
  const showHeld = () => { const list = held; held = []; for (const f of list) f(); };
  const onPress = () => { pressing = true; };
  const onLift = () => { if (!pressing) return; pressing = false; setTimeout(showHeld, 0); };
  const later = (f) => { if (pressing) held.push(f); else f(); };
  const PRESS = [['pointerdown', onPress], ['mousedown', onPress], ['pointerup', onLift], ['mouseup', onLift], ['pointercancel', onLift]];
  for (const [t, f] of PRESS) document.addEventListener(t, f, true);
  window.addEventListener('blur', onLift);

  // ---------- the tools ----------
  const tabs = pageTabs({
    label: 'Tools', value: 'words',
    items: [['words', 'Words', 'type'], ['style', 'Style', 'sliders'], ['color', 'Color', 'filter']],
    onchange: (k) => { tab = k; drawTools(); paint(); },
  });
  const panel = h('div', { class: 'sa-pe-panel' }, tabs.node, ...TOOL_KEYS.map((k) => tabs.panel(k)), err);
  const root = h('div', { class: 'sa-pe sa-mx' }, stage, panel, live);
  put(s.body, root);

  // ---------- its history (its texts and their labels: picking one alone isn't a change) ----------
  const snap = () => JSON.stringify({ layers, labels });
  let last = snap();
  // whether its words would be saved differently from the meme it's from (a text that can't be saved counts: Save says why)
  const changed = () => { const c = checkLayers(layers); return !c.ok || JSON.stringify(c.layers) !== firstJson; };
  function restore(json) {
    const v = JSON.parse(json);
    layers = v.layers;
    labels = v.labels;
    if (sel >= layers.length) sel = layers.length - 1;
  }
  function commit() {
    const now = snap();
    if (now === last) return;
    past.push(last);
    if (past.length > HISTORY) past.shift();
    last = now;
    syncFoot();
  }
  function undo() {
    // a change not kept yet (a slider still held, words still being typed): back to the last kept state; else the one before
    if (snap() === last) {
      if (!past.length) return;
      last = past.pop();
    }
    restore(last);
    after({ tools: true, end: false });
    announce('Undone');
  }
  function reset() {
    if (snap() === firstSnap) return;
    commit();
    past.push(last);
    if (past.length > HISTORY) past.shift();
    restore(firstSnap);
    last = firstSnap;
    after({ tools: true, end: false });
    announce('Back to how it was');
  }
  // a change made: its picture again, its tools when they show it, then kept in its history (end: false while a slider moves
  // or words are typed); its buttons (Undo, Start again, Save) as they are now
  function after({ tools = false, end = true } = {}) {
    if (tools) drawTools();
    paint();
    if (end) commit();
    syncFoot();
  }
  // the text being edited: kept inside the meme, its sizes inside their limits (only this one: the others stay exactly as
  // they were, so a meme whose words didn't change is never saved again)
  function tidyBox(l) {
    l.w = r4(clamp(l.w, LAYERS.W[0], LAYERS.W[1]));
    l.h = r4(clamp(l.h, LAYERS.H[0], LAYERS.H[1]));
    l.s = r4(clamp(l.s, LAYERS.S[0], LAYERS.S[1]));
    l.x = r4(clamp(l.x, l.w / 2, 1 - l.w / 2));
    l.y = r4(clamp(l.y, l.h / 2, 1 - l.h / 2));
    return l;
  }
  function edit(fn, { end = true } = {}) {
    if (!layers[sel]) return;
    layers[sel] = tidyBox(fn({ ...layers[sel] }));
    after({ end });
  }
  // bigger or smaller by k, its middle kept (or its top left: a corner dragged), never past its limits or out of the meme
  function scaleLimit(l0, k, anchor = null) {
    let hi = Math.min(LAYERS.W[1] / l0.w, LAYERS.H[1] / l0.h, LAYERS.S[1] / l0.s);
    hi = anchor ? Math.min(hi, (1 - anchor.left) / l0.w, (1 - anchor.top) / l0.h) : Math.min(hi, 1 / l0.w, 1 / l0.h);
    const lo = Math.max(LAYERS.W[0] / l0.w, LAYERS.H[0] / l0.h, LAYERS.S[0] / l0.s);
    return clamp(k, lo, Math.max(lo, hi));
  }
  function scaled(l0, k, anchor = null) {
    const kk = scaleLimit(l0, k, anchor);
    const w = l0.w * kk, ht = l0.h * kk;
    return tidyBox({ ...l0, w, h: ht, s: l0.s * kk, x: anchor ? anchor.left + w / 2 : l0.x, y: anchor ? anchor.top + ht / 2 : l0.y });
  }

  // ---------- drawing ----------
  // A text's shapes, kept while only its place changes (its shapes moved: their geometry depends on its place only by a shift);
  // at most 96 kept, forgotten when the emoji font arrives
  const memo = new Map();
  const canMove = typeof Path2D === 'function' && typeof Path2D.prototype.addPath === 'function' && typeof DOMMatrix === 'function';
  function shapeOf(f, l, W, H) {
    if (!canMove) return layerShape(f, l, W, H);
    const key = JSON.stringify([l.t, l.w, l.h, l.s, l.f, !!l.o, !!l.b, l.a, l.u, f.emoji ? 1 : 0, W, H]);
    let m = memo.get(key);
    if (!m) {
      const sh = layerShape(f, l, W, H);
      m = { s: sh, x0: l.x * W, y0: l.y * H, path: sh.d ? new Path2D(sh.d) : null };
      memo.set(key, m);
      if (memo.size > 96) memo.delete(memo.keys().next().value);
    }
    const dx = l.x * W - m.x0, dy = l.y * H - m.y0;
    if (!dx && !dy) return { ...m.s, path: m.path };
    let path = null;
    if (m.path) { path = new Path2D(); path.addPath(m.path, new DOMMatrix([1, 0, 0, 1, dx, dy])); }
    const b = m.s.bbox;
    return { ...m.s, path, bbox: { x1: b.x1 + dx, y1: b.y1 + dy, x2: b.x2 + dx, y2: b.y2 + dy },
      bg: m.s.bg ? { ...m.s.bg, x: m.s.bg.x + dx, y: m.s.bg.y + dy } : null };
  }
  // its texts as they're drawn (and saved): tidied, the empty ones left out
  const drawn = () => layers.map((l) => ({ ...l, t: tidyText(l.t) })).filter((l) => l.t);
  // its template's canvas (its own color) with its picture without words in its place, covered, centred (as our server puts it:
  // server/meme-render.js composeBase), on a canvas of w × ht
  function paintBase(g, w, ht) {
    g.fillStyle = tpl.bg || '#ffffff';
    g.fillRect(0, 0, w, ht);
    const kx = w / C.w, ky = ht / C.h;
    const iw = src.naturalWidth, ih = src.naturalHeight;
    const k = Math.max(PB.w / iw, PB.h / ih);
    const sw = PB.w / k, sh = PB.h / k;
    g.imageSmoothingQuality = 'high';
    g.drawImage(src, (iw - sw) / 2, (ih - sh) / 2, sw, sh, PB.x * kx, PB.y * ky, PB.w * kx, PB.h * ky);
  }
  // the whole meme as it will be saved (mark: the share mark, for a download: where its words aren't, as on our server)
  function finished({ withMark = false } = {}) {
    const c = canvasOf(C.w, C.h);
    const g = c.getContext('2d');
    paintBase(g, C.w, C.h);
    const words = drawn();
    drawLayers(g, fonts, words, C.w, C.h, shapeOf);
    if (withMark && mark) {
      const b = markBoxAt(C.w, C.h, markSpot(wordBoxes(fonts, words, C.w, C.h, shapeOf), C.w, C.h, MARK_PREFER.photo));
      g.drawImage(mark, b.x, b.y, b.w, b.h);
    }
    return c;
  }

  // the stage: its canvas as big as its box allows (its pixels the device's, at most PREVIEW_MAX), the meme's shape
  let fit = { w: 1, h: 1, k: 1 };
  let base = null;
  function size() {
    const r = stage.getBoundingClientRect();
    const a = C.w / C.h;
    const bw = Math.max(80, r.width - 16), bh = Math.max(80, r.height - 16);
    let cw = bw, ch = bw / a;
    if (ch > bh) { ch = bh; cw = bh * a; }
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const k = Math.min(dpr, PREVIEW_MAX / Math.max(cw, ch));
    fit = { w: Math.round(cw * k), h: Math.round(ch * k), k };
    if (view.width !== fit.w || view.height !== fit.h) { view.width = fit.w; view.height = fit.h; base = null; }
    view.style.setProperty('width', `${Math.round(cw)}px`);
    view.style.setProperty('height', `${Math.round(ch)}px`);
  }
  // the round handle at the picked box's bottom right (in CSS pixels of a canvas rw × rh), kept inside it
  const handlePx = (l, rw, rh) => ({
    x: clamp((l.x + l.w / 2) * rw + 4, 9, Math.max(9, rw - 9)),
    y: clamp((l.y + l.h / 2) * rh + 4, 9, Math.max(9, rh - 9)),
  });
  let raf = 0;
  const paint = () => { if (!raf && !closed) raf = requestAnimationFrame(() => { raf = 0; draw(); }); };
  function draw() {
    if (!src || !fonts || closed) return;
    size();
    const g = view.getContext('2d');
    const key = `${view.width}x${view.height}`;
    if (!base || base.key !== key) { const c = canvasOf(view.width, view.height); paintBase(c.getContext('2d'), c.width, c.height); base = { key, c }; }
    g.clearRect(0, 0, view.width, view.height);
    g.drawImage(base.c, 0, 0);
    g.save();
    g.scale(view.width / C.w, view.height / C.h);
    drawLayers(g, fonts, drawn(), C.w, C.h, shapeOf);
    g.restore();
    const k = fit.k;
    // (where a text with no words yet is: a faint dashed box)
    g.save();
    g.setLineDash([4 * k, 4 * k]);
    g.lineWidth = Math.max(1, k);
    g.strokeStyle = 'rgba(255,255,255,0.6)';
    layers.forEach((l, n) => {
      if (n === sel || tidyText(l.t)) return;
      g.strokeRect((l.x - l.w / 2) * view.width, (l.y - l.h / 2) * view.height, l.w * view.width, l.h * view.height);
    });
    g.restore();
    // (dragged to the middle: its line)
    if (drag?.snapped) {
      g.save();
      g.strokeStyle = '#8b5cf6';
      g.lineWidth = Math.max(1.5, 1.5 * k);
      g.beginPath();
      g.moveTo(view.width / 2, 0);
      g.lineTo(view.width / 2, view.height);
      g.stroke();
      g.restore();
    }
    const l = layers[sel];
    if (l) {
      drawPicked(g, { x: l.x, y: l.y, w: l.w, h: l.h, turn: 0 }, view.width, view.height, k);
      const hp = handlePx(l, view.width / k, view.height / k);
      g.save();
      g.beginPath();
      g.arc(hp.x * k, hp.y * k, 7 * k, 0, Math.PI * 2);
      g.fillStyle = '#ffffff';
      g.fill();
      g.lineWidth = 2 * k;
      g.strokeStyle = '#8b5cf6';
      g.stroke();
      g.restore();
    }
    say(hint, l ? 'Drag to move · its corner to resize' : 'Tap words to pick them');
  }

  // ---------- a pointer and the keyboard on the stage ----------
  const at = (e) => { const r = view.getBoundingClientRect(); return { x: (e.clientX - r.left) / Math.max(1, r.width), y: (e.clientY - r.top) / Math.max(1, r.height) }; };
  // the texts under a point (a little room around their boxes), the top one first
  function under(p, r) {
    const tx = 6 / Math.max(1, r.width), ty = 6 / Math.max(1, r.height);
    const out = [];
    for (let n = layers.length - 1; n >= 0; n--) {
      const l = layers[n];
      if (Math.abs(p.x - l.x) <= l.w / 2 + tx && Math.abs(p.y - l.y) <= l.h / 2 + ty) out.push(n);
    }
    return out;
  }
  const onHandle = (p, r, pointerType) => {
    const l = layers[sel];
    if (!l) return false;
    const hp = handlePx(l, r.width, r.height);
    return Math.hypot(p.x * r.width - hp.x, p.y * r.height - hp.y) <= (pointerType === 'mouse' ? 14 : 22);
  };
  // how far along its box's diagonal (from its top left) a point is, in the meme's pixels: 1 at its corner
  const along = (d, p) => {
    const w0 = d.l0.w * C.w, h0 = d.l0.h * C.h;
    return (((p.x - d.left) * C.w * w0) + ((p.y - d.top) * C.h * h0)) / Math.max(1, w0 * w0 + h0 * h0);
  };
  // a text picked on the stage: its panel shows it (the Words panel only marks its card: its words may be being typed)
  function picked(tell = false) {
    if (tab === 'words') markPicked(); else drawTools();
    paint();
    if (tell && layers[sel]) announce(`${labels[sel]} picked`);
  }
  const pointers = new Map();
  let drag = null;
  view.addEventListener('pointerdown', (e) => {
    if (!src || !fonts || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    view.setPointerCapture?.(e.pointerId);
    view.focus({ preventScroll: true });
    const r = view.getBoundingClientRect();
    const p = at(e);
    pointers.set(e.pointerId, p);
    if (pointers.size === 2 && sel >= 0) {
      const [a, b] = [...pointers.values()];
      drag = { kind: 'pinch', n: sel, l0: { ...layers[sel] }, dist: Math.max(8, Math.hypot((a.x - b.x) * r.width, (a.y - b.y) * r.height)) };
      return;
    }
    if (pointers.size > 1) return;
    if (onHandle(p, r, e.pointerType)) {
      const l0 = { ...layers[sel] };
      drag = { kind: 'size', n: sel, l0, left: l0.x - l0.w / 2, top: l0.y - l0.h / 2 };
      drag.k0 = Math.max(0.05, along(drag, p));
      return;
    }
    const hits = under(p, r);
    if (hits.includes(sel)) {
      drag = { kind: 'move', n: sel, from: p, x0: layers[sel].x, y0: layers[sel].y, moved: false, hits, cycle: true };
    } else if (hits.length) {
      sel = hits[0];
      picked(true);
      drag = { kind: 'move', n: sel, from: p, x0: layers[sel].x, y0: layers[sel].y, moved: false, hits, cycle: false };
    } else {
      if (sel >= 0) { sel = -1; picked(); }
      drag = null;
    }
  });
  view.addEventListener('pointermove', (e) => {
    const r = view.getBoundingClientRect();
    if (!pointers.has(e.pointerId) || !drag) {
      // (a mouse over the handle: the cursor says it resizes)
      if (e.pointerType === 'mouse' && src && fonts) view.style.setProperty('cursor', onHandle(at(e), r, 'mouse') ? 'nwse-resize' : '');
      return;
    }
    pointers.set(e.pointerId, at(e));
    const pts = [...pointers.values()];
    if (drag.kind === 'pinch') {
      if (pts.length < 2) return;
      const k = Math.hypot((pts[0].x - pts[1].x) * r.width, (pts[0].y - pts[1].y) * r.height) / drag.dist;
      layers[drag.n] = scaled(drag.l0, k);
      after({ end: false });
      syncStyle();
      return;
    }
    const p = pts[0];
    if (drag.kind === 'size') {
      layers[drag.n] = scaled(drag.l0, along(drag, p) / drag.k0, { left: drag.left, top: drag.top });
      after({ end: false });
      syncStyle();
      return;
    }
    if (!drag.moved && Math.hypot((p.x - drag.from.x) * r.width, (p.y - drag.from.y) * r.height) < 4) return;
    drag.moved = true;
    let x = drag.x0 + (p.x - drag.from.x);
    drag.snapped = Math.abs(x - 0.5) < SNAP;
    if (drag.snapped) x = 0.5;
    layers[drag.n] = tidyBox({ ...layers[drag.n], x, y: drag.y0 + (p.y - drag.from.y) });
    after({ end: false });
  });
  const lift = (e) => {
    if (!pointers.delete(e.pointerId)) return;
    if (pointers.size) { if (drag?.kind === 'pinch') drag = null; return; }
    // (a tap on texts on top of each other: the next one under it)
    if (drag?.kind === 'move' && !drag.moved && drag.cycle && drag.hits.length > 1) {
      sel = drag.hits[(drag.hits.indexOf(sel) + 1) % drag.hits.length];
      picked(true);
    }
    drag = null;
    commit();
    paint();
  };
  view.addEventListener('pointerup', lift);
  view.addEventListener('pointercancel', lift);
  view.addEventListener('keydown', (e) => {
    if (!src || !fonts || !layers.length) return;
    const step = e.shiftKey ? 0.05 : 0.01;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d && !['+', '=', '-', '_', 'Delete', 'Backspace', 'PageUp', 'PageDown'].includes(e.key)) return;
    e.preventDefault();
    // (nothing picked yet: the first one, first)
    if (sel < 0) { sel = 0; picked(true); return; }
    if (e.key === 'PageDown' || e.key === 'PageUp') {
      sel = (sel + (e.key === 'PageDown' ? 1 : layers.length - 1)) % layers.length;
      picked(true);
      return;
    }
    const l = layers[sel];
    if (d) { layers[sel] = tidyBox({ ...l, x: l.x + d[0], y: l.y + d[1] }); after(); return; }
    if (e.key === '+' || e.key === '=') { layers[sel] = scaled(l, 1.08); after(); syncStyle(); return; }
    if (e.key === '-' || e.key === '_') { layers[sel] = scaled(l, 1 / 1.08); after(); syncStyle(); return; }
    removeAt(sel);
  });

  // ---------- its emoji (their font downloaded only once some words need it) ----------
  let emojiWait = null;
  function wantEmoji() {
    if (fonts?.emoji) return Promise.resolve(true);
    if (!emojiWait) {
      emojiWait = loadEmojiFont().then((e) => {
        if (closed || !fonts) return false;
        fonts = { ...fonts, emoji: e };
        memo.clear();
        paint();
        refreshWarns();
        updateFit();
        return true;
      }, () => { emojiWait = null; return false; });
    }
    return emojiWait;
  }
  const needsAny = (list) => Boolean(fonts) && list.some((l) => needsEmoji(fonts, l.f, tidyText(l.t)));

  // ---------- adding and removing texts ----------
  function addWords() {
    say(err, '');
    if (layers.length >= LAYERS.MAX) { say(err, memeWordsText('many')); return; }
    const y = SLOTS.find((v) => layers.every((l) => Math.abs(l.y - v) > 0.08)) ?? 0.5;
    layers.push(tidyBox({ ...newLayer(''), y }));
    labels.push(freeLabel(labels, layers.length));
    sel = layers.length - 1;
    after({ tools: true });
    tabs.panel('words')?.querySelector(`[data-k="text-${sel}"]`)?.focus();
    announce(`${labels[sel]} added`);
  }
  function removeAt(n) {
    say(err, '');
    if (layers.length < 2) { say(err, memeErrorText({ error: 'last' })); return; }
    const label = labels[n];
    layers.splice(n, 1);
    labels.splice(n, 1);
    sel = Math.min(n, layers.length - 1);
    after({ tools: true });
    // (its button went with it, or can't be used now: the keyboard on the stage)
    if (!s.dialog.contains(document.activeElement) || document.activeElement?.disabled) view.focus({ preventScroll: true });
    announce(`${label} removed`);
  }

  // ---------- each tool's panel ----------
  // the picked tool's panel drawn again (the keyboard kept on the same control: each has its own key, data-k); the others emptied
  // (drawn again when they're picked: never one showing an older state)
  let styleTools = null;
  function drawTools() {
    if (sel >= layers.length) sel = layers.length - 1;
    if (tab !== 'words' && sel < 0 && layers.length) sel = 0;
    const p = tabs.panel(tab);
    if (!p) return;
    const was = p.contains(document.activeElement) ? document.activeElement.dataset.k || null : null;
    say(err, '');
    styleTools = null;
    for (const k of TOOL_KEYS) if (k !== tab) tabs.panel(k)?.replaceChildren();
    if (tab === 'words') wordsPanel(p);
    else if (tab === 'style') stylePanel(p);
    else colorPanel(p);
    if (was) p.querySelector(`[data-k="${was}"]`)?.focus({ preventScroll: true });
  }
  const keyed = (node, prefix) => { for (const i of node.querySelectorAll('input')) i.dataset.k = `${prefix}-${i.value || 'none'}`; };
  // which text the Style and Color tools change (when there's more than one)
  function picker() {
    if (layers.length < 2) return null;
    return h('div', { class: 'sa-pe-layers', role: 'group', 'aria-label': 'Which words' }, ...layers.map((l, n) => {
      const b = h('button', { type: 'button', class: 'sa-pe-layer', 'aria-pressed': String(n === sel), dataset: { k: `pick-${n}` },
        title: tidyText(l.t).split('\n')[0] || 'No words yet', text: labels[n] });
      b.addEventListener('click', () => { sel = n; drawTools(); paint(); });
      return b;
    }));
  }

  // Words: each text in a card (its label, how many characters, remove; its words; what's wrong with them), then Add words
  function warnOf(n, { blurred = false } = {}) {
    const l = layers[n];
    const t = tidyText(l?.t);
    if (!t) return blurred ? memeWordsText('empty') : '';
    if ([...t].length > LAYERS.TEXT_MAX) return memeWordsText('long');
    if (t.split('\n').length > LAYERS.LINES_MAX) return memeWordsText('lines');
    // (letters our fonts can't draw: said once the emoji font is here, or when no emoji is needed)
    if (fonts && (fonts.emoji || !needsEmoji(fonts, l.f, t))) {
      const miss = missingChars(fonts, l.f, t);
      if (miss.length) return memeWordsText('chars', miss);
    }
    return '';
  }
  function markPicked() {
    for (const c of tabs.panel('words')?.querySelectorAll('.sa-mx-word') || []) c.classList.toggle('is-picked', Number(c.dataset.n) === sel);
  }
  function refreshWarns() {
    for (const c of tabs.panel('words')?.querySelectorAll('.sa-mx-word') || []) {
      const n = Number(c.dataset.n);
      const w = c.querySelector('.sa-mx-warn');
      if (w && layers[n]) say(w, warnOf(n, { blurred: document.activeElement !== c.querySelector('textarea') && !tidyText(layers[n].t) && w.textContent !== '' }));
    }
  }
  function wordsPanel(p) {
    const list = h('div', { class: 'sa-mx-words' }, ...layers.map((l, n) => {
      const id = nextId('mxt');
      const warn = h('p', { class: 'sa-err sa-small sa-mx-warn', id: nextId('mxw'), hidden: true });
      const count = h('span', { class: 'sa-count', 'aria-hidden': 'true' });
      const showCount = () => {
        const c = [...tidyText(layers[n].t)].length;
        count.textContent = `${c}/${LAYERS.TEXT_MAX}`;
        count.classList.toggle('is-over', c > LAYERS.TEXT_MAX);
      };
      const rm = btn('', { kind: 'quiet', size: 'sm', icon: 'trash', class: 'sa-btn sa-btn-quiet sa-btn-sm', 'aria-label': `Remove ${labels[n]}`, title: 'Remove these words',
        dataset: { k: `rm-${n}` }, disabled: layers.length < 2 });
      rm.addEventListener('click', () => removeAt(n));
      const ta = h('textarea', { class: 'sa-input sa-textarea sa-mx-text', id, rows: '2', maxlength: '240', dataset: { k: `text-${n}` }, 'aria-describedby': warn.id });
      ta.value = l.t;
      ta.addEventListener('focus', () => { if (sel !== n) { sel = n; markPicked(); paint(); } });
      ta.addEventListener('input', () => {
        if (!layers[n]) return;
        layers[n] = { ...layers[n], t: ta.value };
        showCount();
        say(warn, warnOf(n));
        if (fonts && !fonts.emoji && needsEmoji(fonts, layers[n].f, tidyText(ta.value))) wantEmoji();
        after({ end: false });
      });
      ta.addEventListener('change', () => commit());
      // (left empty: said once a press is let go, and only on this card as it is: Add words or a remove redraws the cards)
      ta.addEventListener('blur', () => later(() => {
        if (layers[n] && warn.isConnected && document.activeElement !== ta) say(warn, warnOf(n, { blurred: true }));
      }));
      showCount();
      say(warn, warnOf(n));
      return h('div', { class: `sa-mx-word${n === sel ? ' is-picked' : ''}`, dataset: { n: String(n) } },
        h('div', { class: 'sa-mx-word-top' }, h('label', { class: 'sa-label', for: id, text: labels[n] }), count, rm), ta, warn);
    }));
    const addB = toolBtn('Add words', 'plus', addWords, { dataset: { k: 'add' } });
    put(p, list, h('div', { class: 'sa-pe-row' }, addB),
      h('p', { class: 'sa-muted sa-small', text: `Up to ${LAYERS.MAX} texts of ${LAYERS.TEXT_MAX} characters. Drag them on the meme, or pick one and move it with the arrow keys.` }));
  }

  // Style: its font, its biggest size (smaller when its words need it to fit its box), its box, its lines' side, ALL CAPS
  function stylePanel(p) {
    const l = layers[sel];
    if (!l) { put(p, h('p', { class: 'sa-muted sa-small', text: 'Add some words first.' })); return; }
    const fontsPick = chips({ legend: 'Font', choices: Object.entries(MEME_FONTS).map(([id, f]) => [id, f.name]), value: l.f, cls: 'sa-mx-fonts',
      onchange: (v) => { edit((x) => ({ ...x, f: v })); updateFit(); } });
    for (const i of fontsPick.node.querySelectorAll('.sa-chip-input')) {
      i.dataset.k = `font-${i.value}`;
      i.closest('.sa-chip')?.querySelector('.sa-chip-text')?.classList.add(`sa-mx-font-${i.value}`);
    }
    const sizeR = range('Biggest size', Math.round(l.s * 1000), { key: 'size', min: 20, max: 200, text: (v) => `${Math.round((v / 1000) * C.w)} px`,
      onInput: (v) => { edit((x) => ({ ...x, s: v / 1000 }), { end: false }); updateFit(); }, onChange: () => commit() });
    const fitNote = h('p', { class: 'sa-muted sa-small sa-mx-fit', hidden: true });
    const widthR = range('Box width', Math.round(l.w * 100), { key: 'width', min: 8, max: 100, text: (v) => `${v}%`,
      onInput: (v) => { edit((x) => ({ ...x, w: v / 100 }), { end: false }); updateFit(); }, onChange: () => commit() });
    const heightR = range('Box height', Math.round(l.h * 100), { key: 'height', min: 4, max: 100, text: (v) => `${v}%`,
      onInput: (v) => { edit((x) => ({ ...x, h: v / 100 }), { end: false }); updateFit(); }, onChange: () => commit() });
    const align = segmented({ legend: 'Its lines', choices: [['l', 'Left'], ['c', 'Middle'], ['r', 'Right']], value: l.a, showLegend: true, cls: 'sa-seg-pe',
      onchange: (v) => edit((x) => ({ ...x, a: v })) });
    keyed(align.node, 'a');
    const caps = h('button', { type: 'button', class: 'sa-switch', role: 'switch', 'aria-checked': String(l.u === true), dataset: { k: 'caps' } },
      h('span', { class: 'sa-switch-knob', 'aria-hidden': 'true' }), h('span', { text: 'ALL CAPS' }));
    caps.addEventListener('click', () => {
      edit((x) => ({ ...x, u: !x.u }));
      caps.setAttribute('aria-checked', String(layers[sel]?.u === true));
      updateFit();
    });
    const rm = toolBtn('Remove these words', 'trash', () => removeAt(sel), { dataset: { k: 'remove' }, disabled: layers.length < 2 });
    styleTools = { sizeR, widthR, heightR, fitNote };
    put(p, picker(), fontsPick.node, sizeR.node, fitNote, widthR.node, heightR.node, align.node, h('div', { class: 'sa-pe-row' }, caps, rm),
      h('p', { class: 'sa-muted sa-small', text: 'Or on the meme: drag its corner, or pinch it with two fingers.' }));
    updateFit();
  }
  // its sizes kept in step while it's resized or pinched on the stage
  function syncStyle() {
    const t = styleTools, l = layers[sel];
    if (!t || !l) return;
    t.sizeR.set(Math.round(l.s * 1000));
    t.widthR.set(Math.round(l.w * 100));
    t.heightR.set(Math.round(l.h * 100));
    updateFit();
  }
  // its words drawn smaller than its biggest size, to fit its box: said
  function updateFit() {
    const t = styleTools, l = layers[sel];
    if (!t) return;
    const words = l ? tidyText(l.t) : '';
    if (!l || !fonts || !words) { say(t.fitNote, ''); return; }
    const got = fitLayer(fonts, { ...l, t: words }, C.w, C.h).size;
    say(t.fitNote, got < l.s * C.w - 0.5 ? `Drawn at ${Math.round(got)} px to fit its box: a bigger box, or fewer words, draws it bigger.` : '');
  }

  // Color: its words' color (any one), its outline, and what's behind it
  function colorPanel(p) {
    const l = layers[sel];
    if (!l) { put(p, h('p', { class: 'sa-muted sa-small', text: 'Add some words first.' })); return; }
    const swatch = (hex) => ({ swatch: hex || NONE_SWATCH });
    const any = h('input', { type: 'color', class: 'sa-mx-any', value: l.c, dataset: { k: 'c-any' } });
    const colors = chips({ legend: 'Color of the words', choices: MEME_COLORS.map(([hex, nm]) => [hex, nm, swatch(hex)]), value: l.c, swatches: true,
      onchange: (v) => { any.value = v; edit((x) => ({ ...x, c: v })); } });
    keyed(colors.node, 'c');
    any.addEventListener('input', () => {
      const v = String(any.value).toLowerCase();
      colors.set(v);
      edit((x) => ({ ...x, c: v }), { end: false });
    });
    any.addEventListener('change', () => commit());
    colors.node.append(h('label', { class: 'sa-mx-any-row' }, any, h('span', { text: 'Any color' })));
    const outline = chips({ legend: 'Outline', choices: MEME_OUTLINES.map(([hex, nm]) => [hex, nm, swatch(hex)]), value: l.o, swatches: true,
      onchange: (v) => edit((x) => ({ ...x, o: v })) });
    keyed(outline.node, 'o');
    const behind = chips({ legend: 'Behind the words', choices: MEME_BOXES.map(([hex, nm]) => [hex, nm, swatch(hex)]), value: l.b, swatches: true,
      onchange: (v) => edit((x) => ({ ...x, b: v })) });
    keyed(behind.node, 'b');
    put(p, picker(), colors.node, outline.node, behind.node);
  }

  // what stopped its words being saved: that text picked, its Words card showing why, the keyboard in its words
  function wordsNo(n, why, chars = null) {
    const text = memeWordsText(why, chars);
    if (!(n >= 0 && n < layers.length)) { say(err, text); return; }
    sel = n;
    tabs.show('words');
    const card = tabs.panel('words')?.querySelector(`.sa-mx-word[data-n="${n}"]`);
    const warn = card?.querySelector('.sa-mx-warn');
    if (warn) say(warn, text); else say(err, text);
    card?.querySelector('textarea')?.focus({ preventScroll: false });
    announce(`${labels[n]}: ${text}`);
    paint();
  }

  // ---------- its foot: undo, start again, download, save ----------
  const undoB = btn('Undo', { kind: 'ghost', icon: 'undo', class: 'sa-btn sa-btn-ghost sa-pe-quiet', 'aria-label': 'Undo', title: 'Undo' });
  undoB.addEventListener('click', undo);
  const resetB = btn('Start again', { kind: 'quiet', icon: 'refresh', class: 'sa-btn sa-btn-quiet sa-pe-quiet', 'aria-label': 'Start again', title: 'Start again' });
  resetB.addEventListener('click', reset);
  const dl = btn('Download', { kind: 'ghost', icon: 'download' });
  const save = btn('Save as a new meme', { kind: 'primary', icon: 'check', class: 'sa-btn sa-btn-primary sa-pe-save' });
  function syncFoot() {
    undoB.disabled = !past.length && snap() === last;
    resetB.disabled = snap() === firstSnap;
    save.disabled = !(src && fonts && changed());
    dl.disabled = !(src && fonts);
  }
  dl.addEventListener('click', () => busy(dl, 'Getting it ready…', async () => {
    say(err, '');
    // (without the mark for its maker holding STUDIO_CLEAN_AGI $AGI, as our server says (server/inf-clean.js); every download
    // says inside its file that it's AI-made (src/studio/ai-tag.js))
    const r = Number(ctx.info?.cleanAgi) > 0 ? await ctx.act('inf-dl', { job: job.id }) : null;
    const clean = Boolean(r?.ok && r.data?.clean);
    if (needsAny(drawn())) await wantEmoji();
    const made = await toBlob(finished({ withMark: !clean }));
    if (!made) { say(err, memeErrorText({ error: 'picture' })); return; }
    const tagged = withAiTag(new Uint8Array(await made.arrayBuffer()));
    const blob = tagged ? new Blob([tagged], { type: 'image/jpeg' }) : made;
    const a = h('a', { href: URL.createObjectURL(blob), download: `${String(name).replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'meme'}-meme.jpg`, hidden: true });
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
    ctx.toast(clean ? removeMarkText(r.data) : 'Downloaded, with its "Made with AGI Studio · AI-generated" watermark', 'good');
  }).then(syncFoot));
  save.addEventListener('click', () => busy(save, 'Saving…', async () => {
    say(err, '');
    const L = checkLayers(layers);
    if (!L.ok) { wordsNo(L.n, L.why); return; }
    if (JSON.stringify(L.layers) === firstJson) { say(err, errorText('same')); return; }
    // every letter one our fonts draw (the emoji font first, when some words need it: if it can't be had here, our server says)
    const emojiOk = !needsAny(L.layers) || await wantEmoji();
    if (emojiOk) {
      for (let n = 0; n < L.layers.length; n++) {
        const miss = missingChars(fonts, L.layers[n].f, L.layers[n].t);
        if (miss.length) { wordsNo(n, 'chars', miss); return; }
      }
    }
    const r = await ctx.act('inf-meme-save', { from: job.id, layers: L.layers });
    const d = r.data || {};
    if (!r.ok) {
      if (d.error === 'words') { wordsNo(Number.isInteger(d.n) ? d.n : -1, d.why, d.chars); return; }
      say(err, memeErrorText(d, { status: r.status }));
      return;
    }
    s.close();
    ctx.toast(editorSavedText(job), 'good');
    onSaved?.(d.job);
  }).then(syncFoot));
  s.setFoot(undoB, resetB, h('span', { class: 'sa-pe-gap' }), dl, save);

  // ---------- its picture and its fonts, then the stage ----------
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { base = null; paint(); }) : null;
  ro?.observe(stage);
  s.done.then(() => {
    closed = true; ro?.disconnect(); if (raf) cancelAnimationFrame(raf); raf = 0; src = null; memo.clear();
    for (const [t, f] of PRESS) document.removeEventListener(t, f, true);
    window.removeEventListener('blur', onLift);
    held = [];
  });
  Promise.all([loadImage(infMemePic(inf, job.id)), loadMemeFonts().catch(() => null), loadImage(MARK_SRC)]).then(([img, f, m]) => {
    if (closed) return;
    mark = m;
    stage.classList.remove('is-loading');
    if (!img || !f) { stage.classList.add('is-missing'); say(err, memeErrorText({ error: f ? 'source' : 'fonts' })); syncFoot(); return; }
    src = img;
    fonts = { ...f };
    if (needsAny(layers)) wantEmoji();
    drawTools();
    paint();
    syncFoot();
  });
  drawTools();
  syncFoot();
  return s;
}
