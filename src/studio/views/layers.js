// AGI Studio's editors' words and stickers (2026-10-12, the editor): what the photo editor (src/studio/views/photo-editor.js)
// and the video editor (src/studio/views/video-editor.js) share. Each layer drawn on a canvas (its letters in the device's own
// fonts, its stickers the device's own emoji: no font files, nothing to license), and their tools: adding words and stickers,
// picking one, its words, font, color and style, its size and turn, removing it. Their numbers are src/studio/photo-edit.js's
// (pure: read in Node too). Every style is set through the CSSOM (the page's CSP allows no style attributes).
import { h, btn, say, put, nextId, segmented } from '../ui.js';
import { EDITOR, EDITOR_FONTS, EDITOR_COLORS, EDITOR_STYLES, STICKERS } from '../rules.js';
import * as P from '../photo-edit.js';

export const FONT = {
  clean: (px) => `700 ${px}px Geist, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`,
  bold: (px) => `900 ${px}px Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif`,
  classic: (px) => `italic 600 ${px}px Georgia, "Times New Roman", serif`,
};
export const EMOJI_FONT = (px) => `${px}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Twemoji Mozilla", sans-serif`;
const dark = (key) => key === 'black';

// ---------- drawing ----------
// one of its layers on g (a picture of w × ht) → its box (fractions: its middle, its width and height, its turn)
export function drawLayer(g, l, w, ht) {
  const short = Math.min(w, ht);
  const px = Math.max(8, Math.round(l.size * short));
  g.save();
  g.translate(l.x * w, l.y * ht);
  g.rotate((l.turn * Math.PI) / 180);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let bw, bh;
  if (l.kind === 'sticker') {
    g.font = EMOJI_FONT(px);
    bw = Math.max(px, g.measureText(l.emoji).width);
    bh = px * 1.15;
    g.fillText(l.emoji, 0, px * 0.06);
  } else {
    g.font = FONT[l.font] ? FONT[l.font](px) : FONT.clean(px);
    const lines = P.wrapWords(l.text, w * 0.9, (t) => g.measureText(t).width);
    const lh = px * 1.18;
    bw = Math.max(...lines.map((t) => g.measureText(t).width));
    bh = lh * lines.length;
    const fill = EDITOR_COLORS[l.color] || EDITOR_COLORS.white;
    if (l.style === 'box') {
      const pad = px * 0.35;
      g.fillStyle = dark(l.color) ? 'rgba(255,255,255,0.88)' : 'rgba(0,0,0,0.62)';
      roundRect(g, -bw / 2 - pad, -bh / 2 - pad * 0.6, bw + pad * 2, bh + pad * 1.2, px * 0.3);
      g.fill();
      bw += pad * 2;
      bh += pad * 1.2;
    }
    lines.forEach((t, n) => {
      const y = -lh * (lines.length / 2) + lh * (n + 0.5);
      if (l.style === 'outline') {
        g.lineJoin = 'round';
        g.lineWidth = Math.max(2, px * 0.16);
        g.strokeStyle = dark(l.color) ? '#ffffff' : '#000000';
        g.strokeText(t, 0, y);
      }
      g.fillStyle = fill;
      g.fillText(t, 0, y);
    });
  }
  g.restore();
  return { x: l.x, y: l.y, w: bw / w, h: bh / ht, turn: l.turn };
}
function roundRect(g, x, y, w, ht, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + ht, r);
  g.arcTo(x + w, y + ht, x, y + ht, r);
  g.arcTo(x, y + ht, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
// the picked one's box, dashed (white, then violet), on a canvas of w × ht whose pixels are k of the page's
export function drawPicked(g, b, w, ht, k) {
  g.save();
  g.translate(b.x * w, b.y * ht);
  g.rotate((b.turn * Math.PI) / 180);
  g.setLineDash([6 * k, 4 * k]);
  g.lineWidth = Math.max(1.5, 1.5 * k);
  g.strokeStyle = '#ffffff';
  g.strokeRect((-b.w * w) / 2 - 4 * k, (-b.h * ht) / 2 - 4 * k, b.w * w + 8 * k, b.h * ht + 8 * k);
  g.strokeStyle = '#8b5cf6';
  g.lineDashOffset = 5 * k;
  g.strokeRect((-b.w * w) / 2 - 4 * k, (-b.h * ht) / 2 - 4 * k, b.w * w + 8 * k, b.h * ht + 8 * k);
  g.restore();
}

// ---------- their controls ----------
// a slider with its label and its value said (key: its data-k, so the keyboard comes back to it when its panel is drawn again)
export const range = (label, value, { key, min, max, step = 1, onInput, onChange, text = (v) => String(v) }) => {
  const id = nextId('per');
  const out = h('output', { class: 'sa-pe-val', for: id, text: text(value) });
  const input = h('input', { class: 'sa-range', id, type: 'range', min: String(min), max: String(max), step: String(step), value: String(value), 'aria-valuetext': text(value),
    dataset: key ? { k: key } : {} });
  const show = (v) => { out.textContent = text(v); input.setAttribute('aria-valuetext', text(v)); };
  input.addEventListener('input', () => { const v = Number(input.value); show(v); onInput(v); });
  input.addEventListener('change', () => onChange?.(Number(input.value)));
  return { node: h('div', { class: 'sa-pe-range' }, h('div', { class: 'sa-pe-range-top' }, h('label', { class: 'sa-label', for: id, text: label }), out), input), input, out,
    set(v) { input.value = String(v); show(Number(input.value)); } };
};
export const toolBtn = (label, ic, onClick, more = {}) => { const b = btn(label, { kind: 'ghost', size: 'sm', icon: ic, ...more }); b.addEventListener('click', onClick); return b; };

// The Text and Stickers tools of an editor. env: { layers() (its layers now: the editor's state may be a new one after Undo),
// sel() and pick(n) (the one picked, or -1), after(opts) and commit() (the editor's: drawn again, kept in its history), err (its
// line for a "no"), view (its stage, for the keyboard after a removal), what ('photo' | 'video': its words) }
// → { text(panel), stickers(panel), sync() (the picked one's sliders, while it's dragged or pinched), remove(), clear() }
export function layerPanel(env) {
  let layerTools = null;          // the picked layer's controls, kept in step while it's dragged or pinched
  const listed = new Map();       // each layer's button in its list (by its index), its words kept in step while they're typed
  const full = () => {
    if (env.layers().length < EDITOR.LAYERS) return false;
    say(env.err, `At most ${EDITOR.LAYERS} words and stickers on one ${env.what}.`);
    return true;
  };
  function text(p) {
    const id = nextId('pet');
    const words = h('input', { class: 'sa-input', id, type: 'text', maxlength: String(EDITOR.TEXT_MAX), placeholder: 'Type your words', autocomplete: 'off', dataset: { k: 'words' } });
    const addB = btn('Add', { kind: 'primary', size: 'sm', icon: 'plus', dataset: { k: 'add' } });
    const add = () => {
      const t = words.value.trim();
      if (!t) { say(env.err, 'Type your words first.'); words.focus(); return; }
      if (full()) return;
      const ls = env.layers();
      ls.push(P.newText(t, ls.filter((l) => l.kind === 'text').length));
      env.pick(ls.length - 1);
      words.value = '';
      env.after({ tools: true });
    };
    addB.addEventListener('click', add);
    words.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    put(p, h('div', { class: 'sa-field' }, h('label', { class: 'sa-label', for: id, text: 'Add words' }), h('div', { class: 'sa-pe-add' }, words, addB)),
      layerList('text'), selected('text'));
  }
  function stickers(p) {
    const grid = h('div', { class: 'sa-pe-stickers', role: 'group', 'aria-label': 'Stickers' }, ...STICKERS.map((e) => {
      const b = h('button', { type: 'button', class: 'sa-pe-sticker', 'aria-label': `Add the sticker ${e}`, text: e, dataset: { k: `sticker-${e}` } });
      b.addEventListener('click', () => {
        if (full()) return;
        const ls = env.layers();
        ls.push(P.newSticker(e, ls.filter((l) => l.kind === 'sticker').length));
        env.pick(ls.length - 1);
        env.after({ tools: true });
      });
      return b;
    }));
    put(p, h('p', { class: 'sa-label', text: 'Tap one to put it on' }), grid, layerList('sticker'), selected('sticker'));
  }
  // its words and stickers, to pick one with the keyboard too
  function layerList(kind) {
    const mine = env.layers().map((l, n) => [l, n]).filter(([l]) => l.kind === kind);
    if (!mine.length) return null;
    return h('div', { class: 'sa-pe-layers', role: 'group', 'aria-label': kind === 'text' ? 'Your words' : 'Your stickers' }, ...mine.map(([l, n]) => {
      const b = h('button', { type: 'button', class: 'sa-pe-layer', 'aria-pressed': String(n === env.sel()), text: l.kind === 'text' ? l.text : l.emoji, dataset: { k: `layer-${n}` } });
      b.addEventListener('click', () => { env.pick(n); env.after({ tools: true }); });
      listed.set(n, b);
      return b;
    }));
  }
  // the picked one's controls (its words, font, color and style; its size and turn; Remove)
  function selected(kind) {
    const sel = env.sel();
    const l = env.layers()[sel];
    if (!l || l.kind !== kind) return h('p', { class: 'sa-muted sa-small', text: kind === 'text' ? `Pick your words on the ${env.what} to change them.` : `Pick a sticker on the ${env.what} to change it.` });
    const set = (patch, opts = {}) => { const ls = env.layers(); ls[env.sel()] = P.tidyLayer({ ...ls[env.sel()], ...patch }); env.after(opts); };
    const lim = kind === 'text' ? P.LAYER.TEXT : P.LAYER.STICKER;
    const sizeR = range('Size', Math.round(l.size * 1000), { key: 'size', min: Math.round(lim.min * 1000), max: Math.round(lim.max * 1000), text: (v) => `${Math.round((v / (lim.start * 1000)) * 100)}%`,
      onInput: (v) => set({ size: v / 1000 }, { end: false }), onChange: () => env.commit() });
    const turnR = range('Turn', l.turn, { key: 'turn', min: -180, max: 180, text: (v) => `${v}°`, onInput: (v) => set({ turn: v }, { end: false }), onChange: () => env.commit() });
    layerTools = { size: sizeR, turn: turnR };
    const parts = [];
    if (kind === 'text') {
      const id = nextId('pew');
      const w = h('input', { class: 'sa-input', id, type: 'text', maxlength: String(EDITOR.TEXT_MAX), value: l.text, autocomplete: 'off', dataset: { k: 'its-words' } });
      // (its list's button follows; the panel isn't drawn again, so the keyboard stays where it is)
      w.addEventListener('input', () => {
        if (!w.value.trim()) return;
        set({ text: w.value }, { end: false });
        const b = listed.get(env.sel());
        if (b) b.textContent = env.layers()[env.sel()].text;
      });
      w.addEventListener('change', () => { if (!w.value.trim()) w.value = env.layers()[env.sel()].text; env.commit(); });
      parts.push(h('div', { class: 'sa-field' }, h('label', { class: 'sa-label', for: id, text: 'Its words' }), w));
      parts.push(segmented({ legend: 'Font', choices: Object.entries(EDITOR_FONTS), value: l.font, showLegend: true, cls: 'sa-seg-pe', onchange: (v) => set({ font: v }) }).node);
      const colors = h('fieldset', { class: 'sa-pe-colors' }, h('legend', { class: 'sa-label', text: 'Color' }), ...Object.keys(EDITOR_COLORS).map((k) => {
        const b = h('button', { type: 'button', class: `sa-pe-color is-${k}`, 'aria-label': k, 'aria-pressed': String(l.color === k) });
        b.addEventListener('click', () => { set({ color: k }); for (const x of colors.querySelectorAll('.sa-pe-color')) x.setAttribute('aria-pressed', String(x === b)); });
        return b;
      }));
      parts.push(colors);
      parts.push(segmented({ legend: 'Style', choices: Object.entries(EDITOR_STYLES), value: l.style, showLegend: true, cls: 'sa-seg-pe', onchange: (v) => set({ style: v }) }).node);
    }
    const rm = btn(kind === 'text' ? 'Remove these words' : 'Remove this sticker', { kind: 'quiet', size: 'sm', icon: 'trash' });
    rm.addEventListener('click', remove);
    return h('div', { class: 'sa-pe-selected' }, ...parts, sizeR.node, turnR.node, h('div', { class: 'sa-pe-row' }, rm));
  }
  function sync() {
    const l = env.layers()[env.sel()];
    if (!l || !layerTools) return;
    layerTools.size.set(Math.round(l.size * 1000));
    layerTools.turn.set(l.turn);
  }
  function remove() {
    const sel = env.sel();
    if (sel < 0) return;
    env.layers().splice(sel, 1);
    env.pick(-1);
    env.after({ tools: true });
    env.view.focus({ preventScroll: true });
  }
  const clear = () => { layerTools = null; listed.clear(); };
  return { text, stickers, sync, remove, clear };
}

// Its words and stickers alone, at w × ht, on a transparent picture (the video editor's layer: our server puts it over the
// video with ffmpeg, so it needs no fonts) → a canvas
export function layersPicture(layers, w, ht) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(ht));
  const g = c.getContext('2d');
  for (const l of layers || []) drawLayer(g, l, c.width, c.height);
  return c;
}
