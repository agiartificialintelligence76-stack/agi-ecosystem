// 5. Photos (30–36 s): "Photos in any scene." The scene typed, Make photo ⚡ 15, and it develops: Nova at the beach at
// sunset. Then six more, a shutter each, with the words they were made from; halfway through, the pile glides right and
// its photo models build beside it: Classic or Crisp, Standard · HD · Ultra (4K), up to 4 reference pictures, from 8
// credits (all four in with more than a second left to read them).
import { S, backdrop, headline, goButton, inputBox, typedAt, pointer, ripple, pill, icon, glow, progressBar } from '../look.js';
import { panel, card, popK, around, E, prog, clamp, mix, text, rr, label } from '../parts.js';
import { PHOTOS } from '../../words.js';

// 16:9: the tool on the left (from LM), the photo in the middle of the room right of it (RX)
const LM = 120, RX = 1300;
const PANEL = { x: LM, y: 222, w: 560, h: 560 };
const U = 1.5;
// where each photo lands on the pile, and where it comes from (from: left −1 / right 1; fromY: below 1): the ones that
// land once the photo models are on the left come from the right or from below, never across them
const PILE = [
  { dx: -18, dy: 8, rot: -0.06, from: -1 }, { dx: 22, dy: -6, rot: 0.05, from: 1 }, { dx: -6, dy: 12, rot: -0.025, from: -1 },
  { dx: 16, dy: -10, rot: 0.07, from: 1 }, { dx: -20, dy: 4, rot: -0.045, from: 0, fromY: 1 }, { dx: 6, dy: -4, rot: 0.02, from: 1 },
];
const MODEL_ICONS = ['image', 'spark', 'upload', 'bolt'];

export default {
  draw(g, t, c) {
    const { W, H, M, media: md } = c;
    backdrop(g, W, H, t, { a: 0.65, b: 0.85, ax: 0.1, ay: 0.3, bx: 0.95, by: 0.6, hueB: 'rgba(219,39,119,0.3)' });
    headline(g, PHOTOS.head, t, M.typeScene - 0.02, { x: LM, y: 140, size: 88 });

    // ---- the photo tool: its scene typed, Make photo ----
    const toolOut = E.inCubic(prog(t, M.montage[0] - 0.35, M.montage[0] + 0.05));
    if (toolOut < 1) {
      const inP = E.outQuart(prog(t, M.typeScene, M.typeScene + 0.45));
      g.save();
      g.globalAlpha = clamp(inP) * (1 - toolOut);
      g.translate(-toolOut * 120 + (1 - inP) * -60, 0);
      panel(g, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 24, fill: S.panel });
      text(g, 'Photo', { x: PANEL.x + 28, y: PANEL.y + 56, font: { f: 'sans', w: 750, s: 20 * U }, color: S.text });
      // its kinds
      const kinds = ['Photo', 'Meme', 'X banner'];
      let kx = PANEL.x + 28;
      kinds.forEach((k, i) => {
        const w = pill(g, k, 0, 0, { size: 13 * U, measureOnly: true }).w;
        pill(g, k, kx, PANEL.y + 102, { size: 13 * U, bg: i === 0 ? 'rgba(139,92,246,0.22)' : S.raised, line: i === 0 ? S.accent : S.line2, color: i === 0 ? '#fff' : S.text2 });
        kx += w + 10;
      });
      label(g, 'Its scene', PANEL.x + 28, PANEL.y + 168, { u: U });
      const typed = typedAt(PHOTOS.typed, t, M.typeScene + 0.12, 72);
      inputBox(g, PANEL.x + 28, PANEL.y + 184, PANEL.w - 56, 150, typed, { u: U, t, lines: 3, size: 15.5, focus: 1, caret: t < M.makePhoto });
      label(g, 'Shape', PANEL.x + 28, PANEL.y + 372, { u: U });
      let sx = PANEL.x + 28;
      ['Vertical', 'Wide', 'Square'].forEach((s, i) => {
        const w = pill(g, s, 0, 0, { size: 12.5 * U, measureOnly: true }).w;
        pill(g, s, sx, PANEL.y + 406, { size: 12.5 * U, bg: i === 0 ? 'rgba(139,92,246,0.22)' : S.raised, line: i === 0 ? S.accent : S.line2, color: i === 0 ? '#fff' : S.text2 });
        sx += w + 10;
      });
      const press = clamp(1 - Math.abs(t - M.makePhoto) / 0.12);
      goButton(g, PHOTOS.make, PANEL.x + 28, PANEL.y + PANEL.h - 100, PANEL.w - 56, { u: U, cost: PHOTOS.makeCost, press, ic: 'camera', align: 'center', size: 16 });
      g.restore();
      // the pointer: Make photo
      const bx = PANEL.x + PANEL.w / 2 + 30, by = PANEL.y + PANEL.h - 100 + 33;
      const pp = prog(t, M.makePhoto - 0.45, M.makePhoto);
      const px = mix(bx + 240, bx, E.inOutCubic(pp)), py = mix(by + 220, by, E.inOutCubic(pp));
      ripple(g, bx, by, t, M.makePhoto, { r: 56 });
      const pr = clamp(1 - Math.abs(t - M.makePhoto) / 0.12);
      pointer(g, px, py, { s: 1.7, press: pr, alpha: clamp(prog(t, M.makePhoto - 0.6, M.makePhoto - 0.4)) * (1 - toolOut) });
    }

    // ---- it develops: Nova at the beach at sunset ----
    const devOut = E.inCubic(prog(t, M.montage[0] - 0.3, M.montage[0] + 0.1));
    if (t >= M.makePhoto && devOut < 1) {
      const cx = RX, cy = 560, w = 520, h = 650;
      const inP = E.outCubic(prog(t, M.makePhoto, M.makePhoto + 0.3));
      g.save();
      g.globalAlpha = inP * (1 - devOut);
      glow(g, cx, cy, 480, 'rgba(244,114,182,0.22)', 1);
      if (t < M.developed + 0.4) {
        // its place, shimmering, and a bar
        card(g, null, cx, cy, w, h, { r: 24, sh: 0.6 });
        progressBar(g, cx - 200, cy + 10, 400, E.inOutCubic(prog(t, M.makePhoto + 0.1, M.developed)), { u: 1.6, t, label: 'Making its photo', left: 'about 30 s' });
      }
      const dev = E.inOutCubic(prog(t, M.developed, M.developed + 0.45));
      if (dev > 0) {
        card(g, md.soft('nova-beach'), cx, cy, w, h, { r: 24, sh: 0.7, alpha: dev * (1 - dev), focus: [0.5, 0.4] });
        card(g, md.pic('nova-beach'), cx, cy, w, h, { r: 24, sh: 0.8, alpha: dev, flash: (1 - dev) * 0.7, focus: [0.5, 0.4], sc: mix(1.04, 1, dev) });
      }
      g.restore();
    }

    // ---- six more, a shutter each, with their words ----
    PHOTOS.montage.forEach(([pic, words], k) => {
      const t0 = M.montage[k];
      if (t < t0 - 0.15) return;
      const p = E.outCubic(prog(t, t0 - 0.15, t0 + 0.12));
      const s = PILE[k];
      const depth = M.montage.filter((m) => m > t0 && t >= m).length;      // how many came after it
      // the pile glides right (a little smaller) as the photo models come in on the left
      const glide = E.inOutCubic(prog(t, M.photoModels[0] - 0.5, M.photoModels[0] + 0.1));
      const baseX = mix(c.W / 2, RX, glide), baseY = mix(560, 552, glide);
      const sc = (1 - depth * 0.035) * mix(1, 0.88, glide);
      const cx = baseX + s.dx + (1 - p) * s.from * 900, cy = baseY + s.dy - depth * 6 + (1 - p) * (s.fromY || 0) * 560;
      // a camera's flash: one bright frame, gone in a sixth of a second (never a strobe)
      const flash = 0.7 * (1 - E.outCubic(prog(t, t0 - 0.02, t0 + 0.16)));
      card(g, md.pic(pic), cx, cy, 500, 625, { rot: s.rot * (1 + (1 - p) * 2), sc, alpha: clamp(p * 2), flash, r: 22, sh: 0.8, focus: [0.5, 0.42], dim: depth * 0.12 });
      // its words, under the newest (they glide with the pile)
      if (depth === 0) {
        const wp = E.outBack(prog(t, t0 + 0.05, t0 + 0.35));
        around(g, baseX, mix(948, 902, glide), { sc: clamp(wp), alpha: clamp(wp) }, () => pill(g, `“${words}”`, 0, 0, { size: 30, align: 'center', bg: 'rgba(12,12,15,0.9)', line: 'rgba(167,139,250,0.55)', weight: 600 }));
      }
    });

    // ---- its photo models ----
    PHOTOS.models.forEach((m, k) => {
      const t0 = M.photoModels[k];
      if (t < t0) return;
      const p = E.outCubic(prog(t, t0, t0 + 0.35));
      const y = 360 + k * 112;
      g.save();
      g.globalAlpha = p;
      g.translate((1 - p) * -50, 0);
      rr(g, LM, y - 40, 560, 80, 20);
      g.fillStyle = 'rgba(20,20,24,0.88)'; g.fill();
      g.lineWidth = 1.5; g.strokeStyle = S.line2; g.stroke();
      rr(g, LM + 18, y - 26, 52, 52, 14);
      g.fillStyle = 'rgba(139,92,246,0.2)'; g.fill();
      icon(g, MODEL_ICONS[k], LM + 44, y, 30, MODEL_ICONS[k] === 'bolt' ? S.honey : S.accent, { fill: MODEL_ICONS[k] === 'bolt' });
      text(g, m, { x: LM + 90, y: y + 10, font: { f: 'sans', w: 650, s: 28 }, color: S.text });
      g.restore();
    });
  },
};
void popK;
