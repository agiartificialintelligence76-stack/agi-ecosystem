// AGI Studio's video editor (2026-10-12, the editor; the owner's choice: "Video editor": "trim, text on it (a layer drawn in the
// browser as a PNG, so the server needs no fonts), change its shape (9:16, 1:1, 16:9); ffmpeg on our server makes an H.264 MP4
// … free, 10 a day per wallet"). One of its own videos or trend videos: a part of it (1 to 15 seconds, a tenth of a second at
// a time), its shape (its own, or Vertical, Square, Wide: a crop, zoomed and moved), its sound on or off, and words and
// stickers on it; then saved as a new video next to it. Our server makes it (server/inf-cut.js: its clock, with ffmpeg) and
// looks at it before anyone sees it.
//   What it shows is the video itself (played by the browser, placed and cropped through the CSSOM: the page's CSP allows no
// style attributes), with a canvas over it for its words and stickers, the share mark where our server puts it on videos (top
// left: src/studio/video-edit.js markTopLeft) and, in Shape, its frame over the whole video. Its words and stickers go to our
// server as one transparent picture at its size (src/studio/views/layers.js layersPicture); its numbers are video-edit.js's,
// our server's too. A video whose share mark is in it already (a long video, or one saved from here: ownMark) keeps its own
// shape and the whole picture, and its words never cover its mark.
//   videoEditor(ctx, { inf, job, onSaved }) → opens it over the page (its own sheet); onSaved(newJob) once one is saved (no
// download here: the new video downloads from its own sheet, with its share mark, once it's made)
import { h, icon, btn, sheet, say, busy, put, nextId, pageTabs, segmented } from '../ui.js';
import { VIDEO_EDITOR, infVideo, infPoster } from '../rules.js';
import * as P from '../photo-edit.js';
import * as V from '../video-edit.js';
import { drawLayer, drawPicked, range, toolBtn, layerPanel, layersPicture } from './layers.js';
import { saveCut } from '../media.js';
import { cutNote, cutSavedText, cutErrorText, wordsText, trimText, tenth } from '../app-words.js';

// the share mark (server/media/studio-mark.png: the same picture our server puts on videos)
const MARK_SRC = new URL('../../../server/media/studio-mark.png', import.meta.url).href;
const OVER_MAX = 1400;             // the canvas over it: its longest side, in the device's pixels
const TOOL_KEYS = ['trim', 'shape', 'text', 'stickers'];
const HISTORY = 40;
const END_GAP = 0.04;              // (playing: back to its start this close to its end)

const loadImage = (src) => new Promise((resolve) => {
  const img = new Image();
  img.decoding = 'async';
  img.addEventListener('load', () => resolve(img), { once: true });
  img.addEventListener('error', () => resolve(null), { once: true });
  img.src = src;
});
const toPng = (c) => new Promise((resolve) => c.toBlob((b) => resolve(b), 'image/png'));
const pct = (v) => `${(Math.max(0, Math.min(1, v)) * 100).toFixed(3)}%`;

export function videoEditor(ctx, { inf, job, onSaved = null }) {
  const own = V.ownMark(job);
  // (its sound: a video made without it has none; a trend video's is its trend clip's, so it may have some, never one made from
  // its maker's own clip, whose sound is never used; our server keeps it only when the video it's from really has some)
  const hasSound = job.sound === true || (job.kind === 'trend' && job.clip !== true);
  const s = sheet({ title: 'Edit video', sub: cutNote(job, { own }), size: 'editor' });
  let state = null;                 // video-edit.js startCut, once its video says how long it is
  const past = [];
  let W = 0, H = 0, duration = 0;
  let mark = null;
  let tab = 'trim';
  let sel = -1;                     // the layer picked (its index), or none
  let boxes = [];                   // each layer's box as last drawn (fractions of the picture)

  // ---------- the stage: its video, and a canvas over it ----------
  const video = h('video', { class: 'sa-ve-video', playsinline: true, preload: 'auto', 'aria-hidden': 'true', ...(job.poster ? { poster: infPoster(inf, job.id) } : {}) });
  video.muted = true;
  const view = h('canvas', { class: 'sa-ve-over', tabindex: '0', role: 'img', 'aria-label': 'Your video as it will look' });
  const hint = h('p', { class: 'sa-pe-hint sa-ve-hint', id: nextId('veh'), hidden: true });
  view.setAttribute('aria-describedby', hint.id);
  const frame = h('div', { class: 'sa-ve-frame' }, video, view);
  const playB = h('button', { type: 'button', class: 'sa-ve-play', 'aria-label': 'Play its part', title: 'Play its part' }, icon('play'));
  const stage = h('div', { class: 'sa-pe-stage sa-ve-stage is-loading' }, frame, hint, playB);
  const err = h('p', { class: 'sa-err', role: 'alert', hidden: true });

  // ---------- the tools ----------
  const tabs = pageTabs({
    label: 'Tools', value: 'trim',
    items: [['trim', 'Trim', 'scissors'], ...(own ? [] : [['shape', 'Shape', 'crop']]), ['text', 'Text', 'type'], ['stickers', 'Stickers', 'sticker']],
    onchange: (k) => { tab = k; drawTools(); paint(); },
  });
  const panel = h('div', { class: 'sa-pe-panel' }, tabs.node, ...TOOL_KEYS.map((k) => tabs.panel(k)).filter(Boolean), err);
  put(s.body, h('div', { class: 'sa-pe sa-ve' }, stage, panel));

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
    seekTo(state.start);
  }
  const fresh = () => V.startCut(duration, hasSound);
  function reset() {
    if (!state || !useful(true)) return;
    past.push(last);
    state = fresh();
    sel = -1;
    last = snap();
    after({ tools: true });
    seekTo(0);
  }
  // a change made: its picture again, its tools when they show it, then kept in its history (end: false while a slider moves)
  function after({ tools = false, end = true } = {}) {
    if (tools) drawTools();
    video.muted = !state?.sound;
    place();
    paint();
    if (end) commit();
    syncFoot();
  }
  // anything to save: a change from the start, or a part of a video longer than the editor's most (its first 15 seconds)
  function useful(changedOnly = false) {
    if (!state) return false;
    if (V.cutChanged(state, duration, hasSound)) return true;
    return !changedOnly && V.toTenth(state.end - state.start) < V.toTenth(duration) - 0.05;
  }

  // ---------- where its video goes, and the canvas over it ----------
  const whole = () => tab === 'shape';
  const crop = () => V.cropBox({ shape: state.shape, w: W, h: H, zoom: state.zoom, cx: state.cx, cy: state.cy });
  const out = () => V.cutSize(state.shape, W, H);
  let fit = { cw: 1, ch: 1, k: 1 };
  function place() {
    if (!state || !W) return;
    const r = stage.getBoundingClientRect();
    const a = whole() ? W / H : V.aspectOfCut(state.shape, W, H);
    const bw = Math.max(80, r.width - 16), bh = Math.max(80, r.height - 16);
    let cw = bw, ch = bw / a;
    if (ch > bh) { ch = bh; cw = bh * a; }
    cw = Math.round(cw);
    ch = Math.round(ch);
    frame.style.setProperty('width', `${cw}px`);
    frame.style.setProperty('height', `${ch}px`);
    // its video: the whole of it (Shape), else its crop filling the frame
    let vw = cw, vh = ch, vx = 0, vy = 0;
    if (!whole()) {
      const b = crop();
      const k = cw / b.w;
      vw = W * k;
      vh = H * k;
      vx = -b.x * k;
      vy = -b.y * k;
    }
    video.style.setProperty('width', `${vw}px`);
    video.style.setProperty('height', `${vh}px`);
    video.style.setProperty('left', `${vx}px`);
    video.style.setProperty('top', `${vy}px`);
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const k = Math.min(dpr, OVER_MAX / Math.max(cw, ch));
    const pw = Math.max(1, Math.round(cw * k)), ph = Math.max(1, Math.round(ch * k));
    if (view.width !== pw || view.height !== ph) { view.width = pw; view.height = ph; }
    fit = { cw, ch, k };
  }
  let raf = 0;
  const paint = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); }); };
  function draw() {
    if (!state || !W) return;
    // (its frame first, as its tab shows it: the whole video in Shape, else its part; a new tab only paints, and from Shape to
    // Text the frame kept the whole video's shape until something else moved it: found by its guide video, 2026-10-12)
    place();
    const g = view.getContext('2d');
    g.clearRect(0, 0, view.width, view.height);
    if (whole()) {
      // its frame over the whole video (the rest dimmed), its thirds
      const k = view.width / W, b = crop();
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
    boxes = state.layers.map((l) => drawLayer(g, l, view.width, view.height));
    // the share mark where our server puts it (at its size, then as big as the canvas is): over its words, as it will be; a
    // video with its own mark keeps that one, and its words are kept off it (our server clears them there)
    if (mark) {
      const [ow, oh] = out();
      const m = V.markTopLeft(ow, oh, mark.naturalWidth, mark.naturalHeight);
      const k = view.width / ow;
      if (own) g.clearRect((m.x - 2) * k, (m.y - 2) * k, (m.w + 4) * k, (m.h + 4) * k);
      else g.drawImage(mark, m.x * k, m.y * k, m.w * k, m.h * k);
    }
    const b = boxes[sel];
    if (b) drawPicked(g, b, view.width, view.height, fit.k);
    say(hint, tab === 'trim' ? 'Tap it to play or pause' : state.layers.length ? 'Drag to move · tap to pick' : '');
  }

  // ---------- playing its part ----------
  let loop = 0;
  function seekTo(t) {
    if (!state || !Number.isFinite(t)) return;
    try { video.currentTime = Math.max(0, Math.min(duration, t)); } catch { /* not ready yet */ }
    showHead();
  }
  function pause() { if (!video.paused) video.pause(); }
  function toggle() {
    if (!state) return;
    if (!video.paused) { video.pause(); return; }
    if (video.currentTime < state.start - 0.05 || video.currentTime >= state.end - END_GAP) seekTo(state.start);
    video.muted = !state.sound;
    video.play()?.catch?.(() => {});
  }
  // while it plays: back to its start at its end (its part loops), and its playhead
  function tickLoop() {
    loop = 0;
    if (!state || video.paused) return;
    if (video.currentTime >= state.end - END_GAP || video.currentTime < state.start - 0.25) seekTo(state.start);
    showHead();
    loop = requestAnimationFrame(tickLoop);
  }
  video.addEventListener('play', () => { syncPlay(); if (!loop) loop = requestAnimationFrame(tickLoop); });
  video.addEventListener('pause', () => { syncPlay(); showHead(); });
  video.addEventListener('ended', () => { seekTo(state?.start || 0); video.play()?.catch?.(() => {}); });
  video.addEventListener('seeked', showHead);
  function syncPlay() {
    const on = !video.paused;
    playB.replaceChildren(icon(on ? 'pause' : 'play'));
    playB.setAttribute('aria-label', on ? 'Pause' : 'Play its part');
    playB.title = on ? 'Pause' : 'Play its part';
    if (trimTools?.play) {
      trimTools.play.replaceChildren(icon(on ? 'pause' : 'play'), h('span', { text: on ? 'Pause' : 'Play its part' }));
    }
  }
  playB.addEventListener('click', toggle);

  // ---------- a pointer and the keyboard on the stage ----------
  const at = (e) => { const r = view.getBoundingClientRect(); return { x: (e.clientX - r.left) / Math.max(1, r.width), y: (e.clientY - r.top) / Math.max(1, r.height) }; };
  const pointers = new Map();
  let drag = null;
  view.addEventListener('pointerdown', (e) => {
    if (!state || (e.pointerType === 'mouse' && e.button !== 0)) return;
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
    if (tab === 'trim') { drag = { tap: true, from: p }; return; }
    if (whole()) { drag = { crop: true, from: p, cx: state.cx, cy: state.cy }; return; }
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
      after({ end: false });
      LP.sync();
      return;
    }
    const p = pts[0];
    if (drag.tap) { if (Math.hypot(p.x - drag.from.x, p.y - drag.from.y) > 0.03) drag.moved = true; return; }
    if (drag.crop) {
      // the frame follows the pointer (its middle, in fractions of the whole video), kept where it can be
      state.cx = V.clamp(drag.cx + (p.x - drag.from.x), 0, 1);
      state.cy = V.clamp(drag.cy + (p.y - drag.from.y), 0, 1);
      keepFrame();
      after({ end: false });
    } else if (drag.layer !== undefined) {
      state.layers[drag.layer] = P.tidyLayer({ ...state.layers[drag.layer], x: drag.x + (p.x - drag.from.x), y: drag.y + (p.y - drag.from.y) });
      after({ end: false });
    }
  });
  const lift = (e) => {
    if (!pointers.delete(e.pointerId)) return;
    if (pointers.size) return;
    if (drag?.tap && !drag.moved && e.type === 'pointerup') toggle();
    drag = null;
    commit();
  };
  view.addEventListener('pointerup', lift);
  view.addEventListener('pointercancel', lift);
  // (its middle as far as the frame can go)
  function keepFrame() {
    const b = crop();
    state.cx = (b.x + b.w / 2) / W;
    state.cy = (b.y + b.h / 2) / H;
  }
  view.addEventListener('keydown', (e) => {
    if (!state) return;
    if (tab === 'trim') {
      if (e.key === ' ' || e.key === 'k' || e.key === 'Enter') { e.preventDefault(); toggle(); return; }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        pause();
        seekTo(V.toTenth(video.currentTime + (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 1 : 0.1)));
      }
      return;
    }
    const step = e.shiftKey ? 0.05 : 0.01;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (whole() && d) {
      e.preventDefault();
      state.cx = V.clamp(state.cx + d[0], 0, 1);
      state.cy = V.clamp(state.cy + d[1], 0, 1);
      keepFrame();
      after();
      return;
    }
    if (sel < 0) return;
    const l = state.layers[sel];
    if (d) { e.preventDefault(); state.layers[sel] = P.tidyLayer({ ...l, x: l.x + d[0], y: l.y + d[1] }); after(); return; }
    if (e.key === '+' || e.key === '=') { e.preventDefault(); state.layers[sel] = P.tidyLayer({ ...l, size: l.size * 1.08 }); after(); LP.sync(); return; }
    if (e.key === '-' || e.key === '_') { e.preventDefault(); state.layers[sel] = P.tidyLayer({ ...l, size: l.size / 1.08 }); after(); LP.sync(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); LP.remove(); }
  });

  // ---------- each tool's panel ----------
  // (its words and stickers: the editors' shared tools, src/studio/views/layers.js)
  const LP = layerPanel({ layers: () => state.layers, sel: () => sel, pick: (n) => { sel = n; }, after: (o) => after(o), commit: () => commit(), err, view, what: 'video' });
  let trimTools = null;             // Trim's controls kept in step while it plays (its playhead) and as its part changes
  // the picked tool's panel drawn again (the keyboard kept on the same control: each has its own key, data-k); the others emptied
  function drawTools() {
    if (state && sel >= state.layers.length) sel = -1;
    const p = tabs.panel(tab);
    if (!p) return;
    const was = p.contains(document.activeElement) ? document.activeElement.dataset.k || null : null;
    say(err, '');
    LP.clear();
    trimTools = null;
    for (const k of TOOL_KEYS) if (k !== tab) tabs.panel(k)?.replaceChildren();
    if (!state) { put(p, h('p', { class: 'sa-muted sa-small', text: 'Getting its video ready…' })); return; }
    if (tab === 'trim') trimPanel(p);
    else if (tab === 'shape') shapePanel(p);
    else if (tab === 'text') LP.text(p);
    else LP.stickers(p);
    if (was) p.querySelector(`[data-k="${was}"]`)?.focus({ preventScroll: true });
  }
  // Trim: its part (start and end, a tenth of a second at a time: 1 to 15 seconds), played in a loop; its sound
  function trimPanel(p) {
    const MIN = VIDEO_EDITOR.MIN_S, MAX = VIDEO_EDITOR.MAX_S;
    const d = V.toTenth(duration);
    const partB = h('span', { class: 'sa-ve-part' });
    const head = h('span', { class: 'sa-ve-head' });
    const bar = h('div', { class: 'sa-ve-bar', 'aria-hidden': 'true' }, partB, head);
    const len = h('p', { class: 'sa-ve-len', text: trimText(state.start, state.end) });
    // (moving one end pushes the other: never under MIN or over MAX seconds long)
    const setPart = (start, end, which) => {
      let st = start, en = end;
      if (which === 'start') { if (en < st + MIN) en = st + MIN; if (en > st + MAX) en = st + MAX; }
      else { if (en < st + MIN) st = en - MIN; if (en > st + MAX) st = en - MAX; }
      const t = V.tidyTrim(st, en, d);
      state.start = t.start;
      state.end = t.end;
      startR.set(state.start);
      endR.set(state.end);
      showPart();
    };
    const startR = range('Start', state.start, { key: 'start', min: 0, max: tenth(Math.max(0, d - MIN)), step: 0.1, text: (v) => `${tenth(v)} s`,
      onInput: (v) => { pause(); setPart(v, state.end, 'start'); seekTo(state.start); after({ end: false }); }, onChange: () => commit() });
    const endR = range('End', state.end, { key: 'end', min: tenth(Math.min(d, MIN)), max: tenth(d), step: 0.1, text: (v) => `${tenth(v)} s`,
      onInput: (v) => { pause(); setPart(state.start, v, 'end'); seekTo(Math.max(state.start, state.end - 0.1)); after({ end: false }); }, onChange: () => commit() });
    const play = btn('Play its part', { kind: 'primary', size: 'sm', icon: video.paused ? 'play' : 'pause', dataset: { k: 'play' } });
    play.addEventListener('click', toggle);
    const here = (which) => toolBtn(which === 'start' ? 'Start here' : 'End here', which === 'start' ? 'back' : 'next', () => {
      pause();
      const t = V.toTenth(video.currentTime);
      setPart(which === 'start' ? t : state.start, which === 'start' ? state.end : t, which);
      after();
    }, { dataset: { k: `here-${which}` } });
    const knob = h('span', { class: 'sa-switch-knob', 'aria-hidden': 'true' });
    const sound = h('button', { type: 'button', class: 'sa-switch', role: 'switch', 'aria-checked': String(state.sound === true), dataset: { k: 'sound' }, ...(hasSound ? {} : { disabled: true }) },
      knob, h('span', { text: 'Its sound' }));
    sound.addEventListener('click', () => { state.sound = !state.sound; sound.setAttribute('aria-checked', String(state.sound)); after(); });
    trimTools = { play, head, partB, len };
    put(p, bar, len, h('div', { class: 'sa-pe-row' }, play, here('start'), here('end')), startR.node, endR.node,
      h('div', { class: 'sa-ve-sound' }, sound, h('span', { class: 'sa-muted sa-small', text: hasSound ? 'Off: it\'s made silent.' : 'This video has no sound.' })),
      h('p', { class: 'sa-muted sa-small', text: `A part of ${MIN} to ${MAX} seconds. ${own ? 'Its share mark is in it already, so it keeps its own shape and the whole picture.' : 'Change its shape in Shape.'}` }));
    showPart();
    showHead();
  }
  // Shape: its own, or Vertical, Square, Wide (a crop), zoomed and moved
  function shapePanel(p) {
    // its size said again when its shape changes (the panel isn't drawn again then: found by its browser test, 2026-10-12)
    const made = h('p', { class: 'sa-muted sa-small' });
    const madeText = () => { const [ow, oh] = out(); made.textContent = `It's made ${ow} × ${oh}. Drag the frame on the video, or move it with the arrow keys.`; };
    const shapes = segmented({ legend: 'Its shape', choices: Object.entries(V.CUT_SHAPES), value: state.shape, showLegend: true, cls: 'sa-seg-pe',
      onchange: (v) => { state.shape = v; state.zoom = 1; state.cx = 0.5; state.cy = 0.5; zoom.set(1); madeText(); after(); } });
    const zoom = range('Zoom', state.zoom, { key: 'zoom', min: 1, max: VIDEO_EDITOR.ZOOM_MAX, step: 0.05, text: (v) => `${Number(v).toFixed(1)}×`,
      onInput: (v) => { state.zoom = v; keepFrame(); after({ end: false }); }, onChange: () => commit() });
    madeText();
    put(p, shapes.node, zoom.node, made);
  }
  function showPart() {
    if (!trimTools || !state) return;
    trimTools.partB.style.setProperty('left', pct(state.start / duration));
    trimTools.partB.style.setProperty('width', pct((state.end - state.start) / duration));
    trimTools.len.textContent = trimText(state.start, state.end);
  }
  function showHead() {
    if (!trimTools || !duration) return;
    trimTools.head.style.setProperty('left', pct(video.currentTime / duration));
  }

  // ---------- its foot: undo, start again, save ----------
  const undoB = btn('Undo', { kind: 'ghost', icon: 'undo', class: 'sa-btn sa-btn-ghost sa-pe-quiet', 'aria-label': 'Undo', title: 'Undo' });
  undoB.addEventListener('click', undo);
  const resetB = btn('Start again', { kind: 'quiet', icon: 'refresh', class: 'sa-btn sa-btn-quiet sa-pe-quiet', 'aria-label': 'Start again', title: 'Start again' });
  resetB.addEventListener('click', reset);
  const save = btn('Save as a new video', { kind: 'primary', icon: 'check', class: 'sa-btn sa-btn-primary sa-pe-save' });
  function syncFoot() {
    undoB.disabled = !past.length;
    resetB.disabled = !useful(true);
    save.disabled = !useful();
  }
  save.addEventListener('click', () => busy(save, 'Saving…', async () => {
    say(err, '');
    if (!state) return;
    pause();
    const cut = V.cutOf(state, W, H);
    // (the page's own check first: our server's is the same, video-edit.js cutSpec)
    if (!V.cutSpec(cut).ok || (own && !V.asItIs(cut))) { say(err, cutErrorText({ error: 'cut' })); return; }
    let layer = null;
    if (state.layers.length) {
      const [w, ht] = out();
      layer = await toPng(layersPicture(state.layers, w, ht));
      if (!layer) { say(err, cutErrorText({ error: 'picture' })); return; }
    }
    const r = await saveCut(ctx.act, { from: job.id, cut, words: P.wordsOf(state), layer });
    if (!r.ok) {
      if (r.error === 'words') {
        tabs.show('text');
        say(err, wordsText(r.field || 'text', r.why));
        return;
      }
      say(err, cutErrorText(r));
      return;
    }
    s.close();
    ctx.toast(cutSavedText(job), 'good');
    onSaved?.(r.job);
  }));
  s.setFoot(undoB, resetB, h('span', { class: 'sa-pe-gap' }), save);

  // ---------- its video, then the stage ----------
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { place(); paint(); }) : null;
  ro?.observe(stage);
  s.done.then(() => {
    ro?.disconnect();
    if (raf) cancelAnimationFrame(raf);
    if (loop) cancelAnimationFrame(loop);
    video.pause();
    video.removeAttribute('src');
    video.load();
    state = null;
  });
  video.addEventListener('loadedmetadata', () => {
    W = video.videoWidth;
    H = video.videoHeight;
    duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : Number(job.seconds) || VIDEO_EDITOR.MAX_S;
    if (!(W >= 64 && H >= 64)) { failed(); return; }
    state = fresh();
    last = snap();
    stage.classList.remove('is-loading');
    drawTools();
    place();
    paint();
    syncFoot();
  }, { once: true });
  function failed() {
    stage.classList.remove('is-loading');
    stage.classList.add('is-missing');
    say(err, "Its video couldn't be loaded here: close this and try again.");
    syncFoot();
  }
  video.addEventListener('error', () => { if (!state) failed(); }, { once: true });
  loadImage(MARK_SRC).then((m) => { mark = m; paint(); });
  video.src = infVideo(job.id);
  drawTools();
  syncFoot();
  return s;
}
