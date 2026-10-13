// 7. Edit (40–46 s): "Edit with words." "Make the jacket red", Edit ⚡ 15, a wipe: only that changes. Then the photo
// editor, free: Vivid, Mono, Warm, a 💜 sticker, "café mood ✨". "Now… make it move."
import { S, backdrop, headline, goButton, inputBox, typedAt, pointer, ripple, pill, icon, glow } from '../look.js';
import { panel, popK, around, E, prog, clamp, mix, text, rr, media, label, shadow } from '../parts.js';
import { EDIT } from '../../words.js';

// 16:9 (the photo at 470 and the sheet at 760 in 4:3): the two side by side, in the middle of the wide frame
const LM = 120;
const PH = { cx: 600, cy: 590, w: 450, h: 800 };       // the photo
const SH = { x: 940, y: 236, w: 600, h: 720 };        // the sheet beside it
const U = 1.5;
const FILTERS = { Vivid: 'saturate(1.55) contrast(1.12)', Mono: 'grayscale(1) contrast(1.08)', Warm: 'sepia(0.32) saturate(1.25) hue-rotate(-8deg)' };

// the photo as it is at t: the original, its edit wiping in, then the editor's filter, sticker and words
function photo(g, c, t, x, y, w, h, { r = 24, filter = 'none', layers = true } = {}) {
  const { M, media: md } = c;
  const wipe = E.inOutCubic(prog(t, M.editWipe, M.editWipe + 0.45));
  shadow(g, x, y, w, h, { r, blur: 48, alpha: 0.75, dy: 26 });
  g.save();
  g.filter = filter;
  media(g, md.pic('nova-cafe'), x, y, w, h, { r, focus: [0.5, 0.42] });
  if (wipe > 0) {
    g.save();
    g.beginPath(); g.rect(x, y, w * wipe, h); g.clip();
    media(g, md.pic('nova-cafe-edit-red'), x, y, w, h, { r, focus: [0.5, 0.42] });
    g.restore();
  }
  g.restore();
  if (wipe > 0 && wipe < 1) {
    const lx = x + w * wipe;
    g.save();
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(lx - 2, y, 4, h);
    glow(g, lx, y + h / 2, 160, 'rgba(232,121,249,0.55)', 1);
    g.restore();
  }
  if (!layers) return;
  // the sticker and the words
  const st = popK(t, M.sticker, 0.45);
  if (st > 0) around(g, x + w * 0.78, y + h * 0.16, { sc: st, rot: 0.12 }, () => text(g, EDIT.sticker, { x: 0, y: 0, font: { f: 'sans', w: 400, s: w * 0.2 }, align: 'center', base: 'middle' }));
  const tx = popK(t, M.editText, 0.45);
  if (tx > 0) {
    around(g, x + w / 2, y + h * 0.82, { sc: tx, rot: -0.03 }, () => {
      const s = w * 0.095;
      const font = { f: 'sans', w: 800, s };
      g.save();
      g.font = `800 ${s}px 'Geist'`;
      const tw = g.measureText(EDIT.text).width;
      g.restore();
      rr(g, -tw / 2 - s * 0.45, -s * 0.85, tw + s * 0.9, s * 1.5, s * 0.35);
      g.fillStyle = 'rgba(255,255,255,0.94)'; g.fill();
      text(g, EDIT.text, { x: 0, y: s * 0.02, font, color: '#1b1032', align: 'center', base: 'middle' });
    });
  }
}

export default {
  draw(g, t, c) {
    const { W, H, M, media: md } = c;
    backdrop(g, W, H, t, { a: 0.7, b: 0.75, ax: 0.3, ay: 0.4, bx: 0.9, by: 0.2 });
    headline(g, EDIT.head, t, M.typeEdit - 0.25, { x: LM, y: 140, size: 88, out: M.editor - 0.32 });
    headline(g, EDIT.editor, t, M.editor, { x: LM, y: 140, size: 88, out: M.move - 0.32 });
    headline(g, EDIT.move, t, M.move, { x: LM, y: 140, size: 88 });

    // the filter the editor has on now
    let filter = 'none', fname = null;
    EDIT.filters.forEach((f, k) => { if (t >= M.filters[k]) { filter = FILTERS[f]; fname = f; } });

    // where the photo is: beside the sheet, then in the middle (make it move)
    const mv = E.inOutCubic(prog(t, M.move - 0.05, M.move + 0.5));
    const cx = mix(PH.cx, W / 2, mv), cy = mix(PH.cy, 600, mv);
    const w = mix(PH.w, 430, mv), h = mix(PH.h, 764, mv);
    const inP = E.outQuart(prog(t, M.typeEdit - 0.25, M.typeEdit + 0.25));
    g.save();
    g.globalAlpha = clamp(inP * 1.4);
    g.translate(0, (1 - inP) * 60);
    if (mv > 0) glow(g, cx, cy, 520, 'rgba(139,92,246,0.35)', mv);
    photo(g, c, t, cx - w / 2, cy - h / 2, w, h, { filter });
    g.restore();
    // only that changes
    const only = popK(t, M.onlyThat, 0.45) * (1 - E.inCubic(prog(t, M.editor - 0.1, M.editor + 0.2)));
    if (only > 0) around(g, PH.cx, PH.cy + PH.h / 2 + 4, { sc: only, alpha: clamp(only) }, () => pill(g, EDIT.only, 0, 0, { size: 28, align: 'center', ic: 'wand', icColor: S.fuchsia, bg: 'rgba(14,14,17,0.92)', line: 'rgba(232,121,249,0.6)' }));

    // ---- the sheet: Edit with words, then Edit photo ----
    const shIn = E.outQuart(prog(t, M.typeEdit - 0.2, M.typeEdit + 0.3));
    const shOut = E.inCubic(prog(t, M.move - 0.1, M.move + 0.3));
    if (shIn > 0 && shOut < 1) {
      g.save();
      g.globalAlpha = clamp(shIn) * (1 - shOut);
      g.translate((1 - shIn) * 80 + shOut * 140, 0);
      panel(g, SH.x, SH.y, SH.w, SH.h, { r: 26, fill: S.panel });
      const words = 1 - E.inCubic(prog(t, M.editor - 0.15, M.editor + 0.1));
      const tools = E.outCubic(prog(t, M.editor + 0.05, M.editor + 0.35));
      if (words > 0) {
        g.save(); g.globalAlpha *= words;
        icon(g, 'wand', SH.x + 46, SH.y + 54, 30, S.fuchsia);
        text(g, 'Edit with words', { x: SH.x + 76, y: SH.y + 64, font: { f: 'sans', w: 750, s: 20 * U }, color: S.text });
        text(g, 'Type what should change: a new photo', { x: SH.x + 30, y: SH.y + 116, font: { f: 'sans', w: 500, s: 13 * U }, color: S.text2 });
        text(g, 'is made from this one, next to it.', { x: SH.x + 30, y: SH.y + 146, font: { f: 'sans', w: 500, s: 13 * U }, color: S.text2 });
        media(g, md.pic('nova-cafe'), SH.x + 30, SH.y + 180, 120, 160, { r: 12, focus: [0.5, 0.35] });
        text(g, 'Only that changes: the same', { x: SH.x + 170, y: SH.y + 230, font: { f: 'sans', w: 500, s: 12.5 * U }, color: S.text3 });
        text(g, 'character, place and framing.', { x: SH.x + 170, y: SH.y + 260, font: { f: 'sans', w: 500, s: 12.5 * U }, color: S.text3 });
        label(g, 'What should change?', SH.x + 30, SH.y + 392, { u: U });
        inputBox(g, SH.x + 30, SH.y + 410, SH.w - 60, 72, typedAt(EDIT.idea, t, M.typeEdit + 0.05, 30), { u: U, t, focus: 1, size: 17, caret: t < M.editClick });
        ['Make it night, with soft city lights', 'Add gently falling snow'].forEach((idea, k) => pill(g, idea, SH.x + 30, SH.y + 526 + k * 54, { size: 19, bg: S.raised, line: S.line2, color: S.text2 }));
        const press = clamp(1 - Math.abs(t - M.editClick) / 0.12);
        goButton(g, EDIT.button, SH.x + 30, SH.y + SH.h - 96, SH.w - 60, { u: U, cost: EDIT.cost, press, ic: 'wand', align: 'center', size: 16 });
        g.restore();
      }
      if (tools > 0) {
        g.save(); g.globalAlpha *= tools;
        icon(g, 'filter', SH.x + 46, SH.y + 54, 30, S.accent);
        text(g, 'Edit photo', { x: SH.x + 76, y: SH.y + 64, font: { f: 'sans', w: 750, s: 20 * U }, color: S.text });
        pill(g, 'Free', SH.x + SH.w - 30, SH.y + 54, { size: 20, align: 'right', bg: 'rgba(52,211,153,0.16)', line: 'rgba(52,211,153,0.5)', color: S.good });
        // its tools
        const toolIcons = ['crop', 'sun', 'filter', 'type', 'sticker'];
        EDIT.tools.forEach((tn, k) => {
          const x = SH.x + 30 + k * ((SH.w - 60) / 5), cw = (SH.w - 60) / 5 - 8;
          const on = (k === 2 && t < M.sticker) || (k === 4 && t >= M.sticker && t < M.editText) || (k === 3 && t >= M.editText);
          rr(g, x, SH.y + 100, cw, 92, 14);
          g.fillStyle = on ? 'rgba(139,92,246,0.2)' : S.surface; g.fill();
          g.lineWidth = 1.5; g.strokeStyle = on ? S.accent : S.line2; g.stroke();
          icon(g, toolIcons[k], x + cw / 2, SH.y + 134, 30, on ? '#fff' : S.text2);
          text(g, tn, { x: x + cw / 2, y: SH.y + 176, font: { f: 'sans', w: 600, s: 18 }, color: on ? '#fff' : S.text2, align: 'center' });
        });
        // its filters, each a small copy of the photo
        label(g, 'Filters', SH.x + 30, SH.y + 244, { u: U });
        EDIT.filters.forEach((f, k) => {
          const x = SH.x + 30 + k * 184, y = SH.y + 262, fw = 168, fh = 214;
          const on = fname === f ? E.outBack(prog(t, M.filters[k], M.filters[k] + 0.3)) : 0;
          g.save(); g.filter = FILTERS[f];
          media(g, md.pic('nova-cafe-edit-red'), x, y, fw, fh, { r: 14, focus: [0.5, 0.3] });
          g.restore();
          if (on > 0) { rr(g, x - 3, y - 3, fw + 6, fh + 6, 16); g.lineWidth = 4; g.strokeStyle = S.accent; g.stroke(); }
          text(g, f, { x: x + fw / 2, y: y + fh + 36, font: { f: 'sans', w: 650, s: 22 }, color: fname === f ? '#fff' : S.text2, align: 'center' });
        });
        // stickers and words
        label(g, 'Stickers', SH.x + 30, SH.y + 590, { u: U });
        ['💜', '✨', '🔥', '😎', '⭐', '🌸'].forEach((e, k) => {
          const x = SH.x + 54 + k * 84, y = SH.y + 640;
          const on = k === 0 && t >= M.sticker - 0.1 ? 1 - E.outCubic(prog(t, M.sticker, M.sticker + 0.35)) : 0;
          if (on > 0) { g.beginPath(); g.arc(x, y, 34, 0, Math.PI * 2); g.fillStyle = `rgba(139,92,246,${0.35 * on})`; g.fill(); }
          text(g, e, { x, y: y + 2, font: { f: 'sans', w: 400, s: 42 }, align: 'center', base: 'middle' });
        });
        g.restore();
      }
      g.restore();
    }

    // the pointer: Edit, then the filters, the sticker, the words
    const bx = SH.x + SH.w / 2 + 40, by = SH.y + SH.h - 96 + 33;
    const keys = [
      [M.typeEdit + 0.3, bx + 260, by + 200],
      [M.editClick, bx, by, true],
      [M.filters[0], SH.x + 30 + 84, SH.y + 370, true],
      [M.filters[1], SH.x + 30 + 184 + 84, SH.y + 370, true],
      [M.filters[2], SH.x + 30 + 368 + 84, SH.y + 370, true],
      [M.sticker, SH.x + 54, SH.y + 640, true],
      [M.editText, SH.x + 30 + 3 * ((SH.w - 60) / 5) + 50, SH.y + 146, true],
      [M.move - 0.15, SH.x + SH.w + 120, SH.y + 400],
    ];
    const pt = keysAt(keys, t);
    for (const k of keys) if (k[3]) ripple(g, k[1], k[2], t, k[0], { r: 50 });
    pointer(g, pt.x, pt.y, { s: 1.7, press: pt.press, alpha: clamp(prog(t, M.typeEdit + 0.4, M.typeEdit + 0.6)) * (1 - shOut) });

    // make it move: a play ring that pulses on the beat
    if (t >= M.move + 0.2) {
      const p = popK(t, M.move + 0.25, 0.5);
      const beat = c.pulse(t, c.BEAT, 6);
      around(g, cx, cy, { sc: p * (1 + beat * 0.06), alpha: clamp(p) }, () => {
        g.beginPath(); g.arc(0, 0, 74, 0, Math.PI * 2); g.fillStyle = 'rgba(9,9,11,0.55)'; g.fill();
        g.lineWidth = 4; g.strokeStyle = 'rgba(255,255,255,0.9)'; g.stroke();
        icon(g, 'play', 6, 0, 60, '#fff', { fill: true });
      });
      for (let k = 0; k < 3; k++) {
        const ph = ((t - M.move) * 0.9 + k / 3) % 1;
        g.beginPath(); g.arc(cx, cy, 74 + ph * 160, 0, Math.PI * 2);
        g.lineWidth = 3; g.strokeStyle = `rgba(232,121,249,${0.5 * (1 - ph) * clamp(p)})`; g.stroke();
      }
    }
  },
};

function keysAt(keys, t) {
  let x = keys[0][1], y = keys[0][2], press = 0;
  for (let i = 0; i < keys.length; i++) {
    const [ti, xi, yi] = keys[i];
    if (t >= ti) { x = xi; y = yi; }
    const nx = keys[i + 1];
    if (nx && t >= ti && t < nx[0]) {
      const travel = Math.min(0.32, nx[0] - ti);
      const p = E.inOutCubic(prog(t, nx[0] - travel, nx[0]));
      x = mix(xi, nx[1], p); y = mix(yi, nx[2], p) - Math.sin(p * Math.PI) * 24;
    }
    if (keys[i][3]) { const d = t - ti; if (d >= -0.06 && d < 0.16) press = d < 0 ? 1 + d / 0.06 : 1 - d / 0.16; }
  }
  return { x, y, press: clamp(press) };
}
