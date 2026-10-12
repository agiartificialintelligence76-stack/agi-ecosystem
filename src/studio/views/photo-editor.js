// AGI Studio's photo editor (2026-10-12, the editor; the owner's choices: "Photo editor (Recommended)": free, no AI, in the
// visitor's own browser; "New photo + download (Recommended)"). One of its own photos (a meme, an X banner): turned, flipped,
// cropped to a photo shape, its light and a filter, words and stickers on it; then downloaded with the share mark (drawn here
// as our server draws it on downloads: server/inf-mark.js) or saved as a new photo next to it (our server looks at it first:
// server/inf-editor.js). Drawn on a canvas, its pixels changed by one color matrix (src/studio/photo-edit.js: the same on every
// browser); every style set through the CSSOM (the page's CSP allows no style attributes).
//   photoEditor(ctx, { inf, job, name, onSaved }) → opens it over the page (its own sheet); onSaved(newJob) once one is saved
import { h, btn, sheet, say, busy, put, nextId, pageTabs, segmented } from '../ui.js';
import { EDITOR, EDITOR_CROPS, EDITOR_FILTERS, EDITOR_LIGHT, infPic } from '../rules.js';
import * as P from '../photo-edit.js';
import { drawLayer, drawPicked, range, toolBtn, layerPanel } from './layers.js';
import { savePhoto } from '../media.js';
import { editorErrorText, editorSavedText, editorNote, wordsText, downloadText } from '../app-words.js';
import { withAiTag } from '../ai-tag.js';

// the share mark (server/media/studio-mark.png: the same picture our server puts on downloads)
const MARK_SRC = new URL('../../../server/media/studio-mark.png', import.meta.url).href;
// (its words' and stickers' drawing and tools: src/studio/views/layers.js, the video editor's too)
const PREVIEW_MAX = 1400;            // the preview's longest side, in the device's pixels
const TOOL_KEYS = ['crop', 'light', 'filters', 'text', 'stickers'];
const HISTORY = 40;

const loadImage = (src) => new Promise((resolve) => {
  const img = new Image();
  img.decoding = 'async';
  img.addEventListener('load', () => resolve(img), { once: true });
  img.addEventListener('error', () => resolve(null), { once: true });
  img.src = src;
});
const canvasOf = (w, ht) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(ht)); return c; };
const toBlob = (c, q = 0.92) => new Promise((resolve) => c.toBlob((b) => resolve(b), 'image/jpeg', q));

export function photoEditor(ctx, { inf, job, name = 'Your influencer', onSaved = null }) {
  const banner = job.shape === 'banner';
  const s = sheet({ title: 'Edit photo', sub: editorNote(job), size: 'editor' });
  let state = P.startState();
  const past = [];
  let src = null, mark = null;
  let tab = 'crop';
  let sel = -1;                     // the layer picked (its index), or none
  let boxes = [];                   // each layer's box as last drawn (fractions of the picture)

  // ---------- the stage ----------
  const view = h('canvas', { class: 'sa-pe-canvas', tabindex: '0', role: 'img', 'aria-label': 'Your photo as it will look' });
  const hint = h('p', { class: 'sa-pe-hint', id: nextId('peh'), hidden: true });
  view.setAttribute('aria-describedby', hint.id);
  const stage = h('div', { class: 'sa-pe-stage is-loading' }, view, hint);
  const err = h('p', { class: 'sa-err', role: 'alert', hidden: true });

  // ---------- the tools ----------
  const tabs = pageTabs({
    label: 'Tools', value: banner ? 'light' : 'crop',
    items: [...(banner ? [] : [['crop', 'Crop', 'crop']]), ['light', 'Light', 'sun'], ['filters', 'Filters', 'filter'], ['text', 'Text', 'type'], ['stickers', 'Stickers', 'sticker']],
    onchange: (k) => { tab = k; drawTools(); paint(); },
  });
  tab = tabs.value;
  const panel = h('div', { class: 'sa-pe-panel' }, tabs.node, ...TOOL_KEYS.map((k) => tabs.panel(k)).filter(Boolean), err);
  const root = h('div', { class: `sa-pe${banner ? ' is-banner' : ''}` }, stage, panel);
  put(s.body, root);

  // ---------- its history ----------
  const snap = () => JSON.stringify({ state, sel });
  let last = snap();
  function commit() {
    const now = snap();
    if (now === last) return;
    past.push(last);
    if (past.length > HISTORY) past.shift();
    last = now;
    syncFoot();
  }
  function undo() {
    if (!past.length) return;
    const prev = JSON.parse(past.pop());
    state = prev.state;
    sel = prev.sel;
    last = snap();
    after({ tools: true });
  }
  function reset() {
    if (!P.changed(state)) return;
    past.push(last);
    state = P.startState();
    sel = -1;
    last = snap();
    after({ tools: true });
  }
  // a change made: its picture again, its tools when they show it, then kept in its history (end: false while a slider moves);
  // its buttons (Undo, Start again, Save) as they are now
  function after({ tools = false, end = true, geometry = false } = {}) {
    if (geometry) base = null;
    if (tools) drawTools();
    paint();
    if (end) commit();
    syncFoot();
  }

  // ---------- drawing ----------
  let base = null;
  const turnedSize = () => P.turned(src.naturalWidth, src.naturalHeight, state.rot);
  const aspect = () => { const t = turnedSize(); return P.aspectOf(state.crop, t.w, t.h, banner); };
  const crop = () => { const t = turnedSize(); return P.cropBox({ w: t.w, h: t.h, aspect: aspect(), zoom: state.zoom, cx: state.cx, cy: state.cy }); };
  // its picture turned and flipped, the part inside box drawn on g at scale k
  function drawSource(g, box, k) {
    const t = turnedSize();
    const W = src.naturalWidth, H = src.naturalHeight;
    g.save();
    g.scale(k, k);
    g.translate(-box.x, -box.y);
    if (state.flip) { g.translate(t.w, 0); g.scale(-1, 1); }
    g.translate(t.w / 2, t.h / 2);
    g.rotate((state.rot * Math.PI) / 180);
    g.imageSmoothingQuality = 'high';
    g.drawImage(src, -W / 2, -H / 2);
    g.restore();
  }
  // the cropped picture with its light and filter, at w × ht
  function picture(w, ht) {
    const box = crop();
    const c = canvasOf(w, ht);
    const g = c.getContext('2d', { willReadFrequently: true });
    drawSource(g, box, c.width / box.w);
    const m = P.colorMatrix(state.light, state.filter);
    if (!P.isIdentity(m)) {
      const data = g.getImageData(0, 0, c.width, c.height);
      P.applyMatrix(data.data, m);
      g.putImageData(data, 0, 0);
    }
    return c;
  }
  // the whole picture as it will be saved (mark: the share mark, for a download)
  function finished({ withMark = false } = {}) {
    const out = P.outSize(crop(), banner);
    const c = picture(out.w, out.h);
    const g = c.getContext('2d');
    for (const l of state.layers) drawLayer(g, l, out.w, out.h);
    if (withMark && mark) {
      const at = P.markPlace(out.w, out.h, mark.naturalWidth, mark.naturalHeight);
      g.drawImage(mark, at.x, at.y, at.w, at.h);
    }
    return c;
  }

  // the stage: its canvas as big as its box allows (its pixels the device's, at most PREVIEW_MAX), its picture drawn
  let fit = { w: 1, h: 1, k: 1 };
  function size() {
    if (!src) return;
    const r = stage.getBoundingClientRect();
    const t = turnedSize();
    const a = tab === 'crop' ? t.w / t.h : aspect();
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
  let raf = 0;
  const paint = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); }); };
  function draw() {
    if (!src) return;
    size();
    const g = view.getContext('2d');
    g.clearRect(0, 0, view.width, view.height);
    if (tab === 'crop') {
      // the whole picture, its frame over it (the rest dimmed)
      const t = turnedSize();
      const full = { x: 0, y: 0, w: t.w, h: t.h };
      drawSource(g, full, view.width / t.w);
      const k = view.width / t.w, b = crop();
      g.save();
      g.fillStyle = 'rgba(0,0,0,0.55)';
      g.beginPath();
      g.rect(0, 0, view.width, view.height);
      g.rect(b.x * k, b.y * k, b.w * k, b.h * k);
      g.fill('evenodd');
      g.strokeStyle = '#ffffff';
      g.lineWidth = Math.max(1.5, fit.k * 1.5);
      g.strokeRect(b.x * k, b.y * k, b.w * k, b.h * k);
      g.globalAlpha = 0.45;
      g.lineWidth = Math.max(1, fit.k);
      for (const f of [1 / 3, 2 / 3]) {
        g.beginPath(); g.moveTo((b.x + b.w * f) * k, b.y * k); g.lineTo((b.x + b.w * f) * k, (b.y + b.h) * k); g.stroke();
        g.beginPath(); g.moveTo(b.x * k, (b.y + b.h * f) * k); g.lineTo((b.x + b.w) * k, (b.y + b.h * f) * k); g.stroke();
      }
      g.restore();
      say(hint, 'Drag the frame to move it');
      return;
    }
    // (its picture with its light and filter, made again only when one of them, its crop or the stage's size changes)
    const key = JSON.stringify([state.rot, state.flip, state.crop, state.zoom, state.cx, state.cy, state.light, state.filter, view.width, view.height]);
    if (!base || base.key !== key) base = { key, c: picture(view.width, view.height) };
    g.drawImage(base.c, 0, 0);
    boxes = state.layers.map((l) => drawLayer(g, l, view.width, view.height));
    const b = boxes[sel];
    if (b) drawPicked(g, b, view.width, view.height, fit.k);
    say(hint, state.layers.length ? 'Drag to move · tap to pick' : '');
  }

  // ---------- a pointer and the keyboard on the stage ----------
  const at = (e) => { const r = view.getBoundingClientRect(); return { x: (e.clientX - r.left) / Math.max(1, r.width), y: (e.clientY - r.top) / Math.max(1, r.height) }; };
  const pointers = new Map();
  let drag = null;
  view.addEventListener('pointerdown', (e) => {
    if (!src || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    view.setPointerCapture?.(e.pointerId);
    view.focus({ preventScroll: true });
    const p = at(e);
    pointers.set(e.pointerId, p);
    if (pointers.size === 2 && drag?.layer !== undefined && sel >= 0) {
      const [a, b] = [...pointers.values()];
      drag = { pinch: true, dist: Math.hypot(a.x - b.x, a.y - b.y) || 0.01, size: state.layers[sel].size };
      return;
    }
    if (tab === 'crop') {
      drag = { crop: true, from: p, cx: state.cx, cy: state.cy };
      return;
    }
    // the top layer under it, else none picked
    let hit = -1;
    for (let n = boxes.length - 1; n >= 0; n--) if (P.hitLayer(boxes[n], p.x, p.y, view.width, view.height)) { hit = n; break; }
    if (hit !== sel) { sel = hit; drawTools(); }
    drag = hit >= 0 ? { layer: hit, from: p, x: state.layers[hit].x, y: state.layers[hit].y } : null;
    paint();
  });
  view.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId) || !drag) return;
    pointers.set(e.pointerId, at(e));
    const pts = [...pointers.values()];
    if (drag.pinch && pts.length >= 2 && sel >= 0) {
      const k = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) / drag.dist;
      state.layers[sel] = P.tidyLayer({ ...state.layers[sel], size: drag.size * k });
      after({ end: false, tools: false });
      syncLayerTools();
      return;
    }
    const p = pts[0];
    if (drag.crop) {
      // the frame follows the pointer (its middle, in fractions of the whole picture)
      state.cx = P.clamp(drag.cx + (p.x - drag.from.x), 0, 1);
      state.cy = P.clamp(drag.cy + (p.y - drag.from.y), 0, 1);
      // (kept where the frame can be: its middle as far as it can go)
      const t = turnedSize(), b = crop();
      state.cx = (b.x + b.w / 2) / t.w;
      state.cy = (b.y + b.h / 2) / t.h;
      after({ end: false, geometry: true });
    } else if (drag.layer !== undefined) {
      state.layers[drag.layer] = P.tidyLayer({ ...state.layers[drag.layer], x: drag.x + (p.x - drag.from.x), y: drag.y + (p.y - drag.from.y) });
      after({ end: false });
    }
  });
  const lift = (e) => {
    if (!pointers.delete(e.pointerId)) return;
    if (!pointers.size) { drag = null; commit(); }
  };
  view.addEventListener('pointerup', lift);
  view.addEventListener('pointercancel', lift);
  view.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 0.05 : 0.01;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (tab === 'crop' && d) {
      e.preventDefault();
      const t = turnedSize();
      state.cx = P.clamp(state.cx + d[0], 0, 1);
      state.cy = P.clamp(state.cy + d[1], 0, 1);
      const b = crop();
      state.cx = (b.x + b.w / 2) / t.w;
      state.cy = (b.y + b.h / 2) / t.h;
      after({ geometry: true });
      return;
    }
    if (sel < 0) return;
    const l = state.layers[sel];
    if (d) { e.preventDefault(); state.layers[sel] = P.tidyLayer({ ...l, x: l.x + d[0], y: l.y + d[1] }); after({ tools: false }); return; }
    if (e.key === '+' || e.key === '=') { e.preventDefault(); state.layers[sel] = P.tidyLayer({ ...l, size: l.size * 1.08 }); after(); syncLayerTools(); return; }
    if (e.key === '-' || e.key === '_') { e.preventDefault(); state.layers[sel] = P.tidyLayer({ ...l, size: l.size / 1.08 }); after(); syncLayerTools(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeLayer(); }
  });

  // ---------- each tool's panel ----------
  // (its words and stickers: the editors' shared tools, src/studio/views/layers.js)
  const LP = layerPanel({ layers: () => state.layers, sel: () => sel, pick: (n) => { sel = n; }, after: (o) => after(o), commit: () => commit(), err, view, what: 'photo' });
  const syncLayerTools = () => LP.sync();
  const removeLayer = () => LP.remove();
  // the picked tool's panel drawn again (the keyboard kept on the same control: each has its own key, data-k); the others emptied
  // (drawn again when they're picked: never one showing an older state)
  function drawTools() {
    if (sel >= state.layers.length) sel = -1;
    const p = tabs.panel(tab);
    if (!p) return;
    const was = p.contains(document.activeElement) ? document.activeElement.dataset.k || null : null;
    say(err, '');
    LP.clear();
    for (const k of TOOL_KEYS) if (k !== tab) tabs.panel(k)?.replaceChildren();
    buildTools(p);
    if (was) p.querySelector(`[data-k="${was}"]`)?.focus({ preventScroll: true });
  }
  function buildTools(p) {
    if (tab === 'crop') {
      const shapes = segmented({ legend: 'Its shape', choices: Object.entries(EDITOR_CROPS).map(([k, v]) => [k, v]), value: state.crop, showLegend: true, cls: 'sa-seg-pe',
        onchange: (v) => { state.crop = v; state.zoom = 1; state.cx = 0.5; state.cy = 0.5; zoom.set(1); after({ geometry: true }); } });
      const zoom = range('Zoom', state.zoom, { key: 'zoom', min: 1, max: EDITOR.ZOOM_MAX, step: 0.05, text: (v) => `${Number(v).toFixed(1)}×`,
        onInput: (v) => { state.zoom = v; after({ end: false, geometry: true }); }, onChange: () => commit() });
      // (the frame flipped with it: it stays on what it framed)
      const flip = toolBtn('Flip', 'flip', () => { state.flip = !state.flip; state.cx = 1 - state.cx; flip.setAttribute('aria-pressed', String(state.flip)); after({ geometry: true }); },
        { 'aria-pressed': String(state.flip), dataset: { k: 'flip' } });
      const turns = h('div', { class: 'sa-pe-row' },
        toolBtn('Turn left', 'turnLeft', () => { state.rot = (state.rot + 270) % 360; state.cx = 0.5; state.cy = 0.5; after({ geometry: true }); }, { dataset: { k: 'left' } }),
        toolBtn('Turn right', 'turnRight', () => { state.rot = (state.rot + 90) % 360; state.cx = 0.5; state.cy = 0.5; after({ geometry: true }); }, { dataset: { k: 'right' } }),
        flip);
      put(p, shapes.node, zoom.node, turns, h('p', { class: 'sa-muted sa-small', text: 'Drag the frame on the photo, or move it with the arrow keys.' }));
      return;
    }
    if (tab === 'light') {
      const rows = Object.entries(EDITOR_LIGHT).map(([k, label]) => range(label, state.light[k] || 0, { key: `light-${k}`, min: -100, max: 100,
        text: (v) => (v > 0 ? `+${v}` : String(v)), onInput: (v) => { state.light = { ...state.light, [k]: v }; after({ end: false }); }, onChange: () => commit() }).node);
      put(p, ...rows, h('div', { class: 'sa-pe-row' },
        toolBtn('Reset light', 'refresh', () => { state.light = P.startState().light; after({ tools: true }); }, { dataset: { k: 'reset-light' } })));
      return;
    }
    if (tab === 'filters') {
      const grid = h('div', { class: 'sa-pe-filters', role: 'group', 'aria-label': 'Filters' }, ...Object.entries(EDITOR_FILTERS).map(([k, label]) => {
        const thumb = h('canvas', { class: 'sa-pe-thumb', width: '96', height: '96', 'aria-hidden': 'true' });
        thumbOf(thumb, k);
        const b = h('button', { type: 'button', class: 'sa-pe-filter', 'aria-pressed': String(state.filter === k), dataset: { k: `filter-${k}` } }, thumb, h('span', { text: label }));
        b.addEventListener('click', () => { state.filter = k; for (const x of grid.querySelectorAll('.sa-pe-filter')) x.setAttribute('aria-pressed', String(x === b)); after(); });
        return b;
      }));
      put(p, grid);
      return;
    }
    if (tab === 'text') { LP.text(p); return; }
    LP.stickers(p);
  }
  // a filter's own small picture (its middle square)
  function thumbOf(c, k) {
    if (!src) return;
    const g = c.getContext('2d', { willReadFrequently: true });
    const side = Math.min(src.naturalWidth, src.naturalHeight);
    g.drawImage(src, (src.naturalWidth - side) / 2, (src.naturalHeight - side) / 2, side, side, 0, 0, c.width, c.height);
    const m = P.colorMatrix({}, k);
    if (!P.isIdentity(m)) { const d = g.getImageData(0, 0, c.width, c.height); P.applyMatrix(d.data, m); g.putImageData(d, 0, 0); }
  }

  // ---------- its foot: undo, start again, download, save ----------
  const undoB = btn('Undo', { kind: 'ghost', icon: 'undo', class: 'sa-btn sa-btn-ghost sa-pe-quiet', 'aria-label': 'Undo', title: 'Undo' });
  undoB.addEventListener('click', undo);
  const resetB = btn('Start again', { kind: 'quiet', icon: 'refresh', class: 'sa-btn sa-btn-quiet sa-pe-quiet', 'aria-label': 'Start again', title: 'Start again' });
  resetB.addEventListener('click', reset);
  const dl = btn('Download', { kind: 'ghost', icon: 'download' });
  const save = btn('Save as a new photo', { kind: 'primary', icon: 'check', class: 'sa-btn sa-btn-primary sa-pe-save' });
  function syncFoot() {
    undoB.disabled = !past.length;
    resetB.disabled = !P.changed(state);
    save.disabled = !src || !P.changed(state);
    dl.disabled = !src;
  }
  dl.addEventListener('click', () => busy(dl, 'Getting it ready…', async () => {
    // (2026-10-12) without the mark for a holder of STUDIO_CLEAN_AGI $AGI, as our server says (server/inf-clean.js); every
    // download says inside its file that it's AI-made (src/studio/ai-tag.js)
    const r = Number(ctx.info?.cleanAgi) > 0 ? await ctx.act('inf-dl', { job: job.id }) : null;
    const clean = Boolean(r?.ok && r.data?.clean);
    const made = await toBlob(finished({ withMark: !clean }));
    if (!made) { say(err, editorErrorText({ error: 'picture' })); return; }
    const tagged = withAiTag(new Uint8Array(await made.arrayBuffer()));
    const blob = tagged ? new Blob([tagged], { type: 'image/jpeg' }) : made;
    const a = h('a', { href: URL.createObjectURL(blob), download: `${String(name).replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'photo'}-edited.jpg`, hidden: true });
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
    ctx.toast(clean ? downloadText(r.data) : 'Downloaded, with its "Made with AGI Studio · AI-generated" mark', 'good');
  }));
  save.addEventListener('click', () => busy(save, 'Saving…', async () => {
    say(err, '');
    const blob = await toBlob(finished());
    if (!blob) { say(err, editorErrorText({ error: 'picture' })); return; }
    const b = crop();
    const r = await savePhoto(ctx.act, { from: job.id, shape: P.shapeOfCrop(state.crop, b.w, b.h, banner), words: P.wordsOf(state), blob });
    if (!r.ok) {
      if (r.error === 'words') {
        tabs.show('text');
        say(err, wordsText(r.field || 'text', r.why));
        return;
      }
      say(err, editorErrorText(r));
      return;
    }
    s.close();
    ctx.toast(editorSavedText(job), 'good');
    onSaved?.(r.job);
  }));
  s.setFoot(undoB, resetB, h('span', { class: 'sa-pe-gap' }), dl, save);

  // ---------- its picture, then the stage ----------
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { base = null; paint(); }) : null;
  ro?.observe(stage);
  s.done.then(() => { ro?.disconnect(); if (raf) cancelAnimationFrame(raf); src = null; });
  Promise.all([loadImage(infPic(inf, job.id, 0)), loadImage(MARK_SRC)]).then(([img, m]) => {
    mark = m;
    if (!img) { stage.classList.add('is-missing'); say(err, editorErrorText({ error: 'picture' })); syncFoot(); return; }
    src = img;
    stage.classList.remove('is-loading');
    drawTools();
    paint();
    syncFoot();
  });
  drawTools();
  syncFoot();
  return s;
}
