// 9. Videos (58–64 s): "Videos from a photo." Nova's café photo and the Video tool: Standard, 5 s, Make video ⚡ 76.
// A few minutes later it plays. Then four of them side by side, all playing, the four video models, and sound.
import { S, backdrop, headline, say, pill, glow, seg, goButton, pointer, ripple, icon, progressBar } from '../look.js';
import { clipCard, card, popK, around, E, prog, clamp, mix, text, rr, panel, label } from '../parts.js';
import { VIDEOS } from '../../words.js';

// 16:9 (the photo at 450, the tool at 770 and the row 320 apart in 4:3)
const LM = 120;
const PH = { cx: 560, cy: 600, w: 430, h: 764 };                    // the photo, then its video
const P = { x: 960, y: 236, w: 590, h: 600 };                       // the Video tool
const U = 1.5;
const ROW = [['nova-cafe-video'], ['kai-neon-video'], ['mika-video'], ['juno-video']];
const RW = 300, RH = 533, RY = 232;
const slotX = (k) => 960 + (k - 1.5) * 370;

// a small on/off switch
function toggle(g, x, y, on, { u = 1.5, alpha = 1 } = {}) {
  const w = 44 * u, h = 26 * u;
  g.save(); g.globalAlpha *= alpha;
  rr(g, x, y - h / 2, w, h, h / 2);
  g.fillStyle = on > 0.5 ? 'rgba(139,92,246,0.9)' : S.raised2; g.fill();
  g.beginPath(); g.arc(x + mix(h / 2, w - h / 2, on), y, h / 2 - 3 * u, 0, Math.PI * 2);
  g.fillStyle = '#fff'; g.fill();
  g.restore();
}

export default {
  draw(g, t, c) {
    const { W, H, M } = c;
    backdrop(g, W, H, t, { a: 0.75, b: 0.85, ax: 0.85, ay: 0.15, bx: 0.1, by: 0.95 });
    headline(g, VIDEOS.head, t, M.videoIn, { x: LM, y: 140, size: 88 });

    // ---- the photo, the tool, Make video ----
    const toRow = E.inOutCubic(prog(t, M.row[0] - 0.4, M.row[0] + 0.15));     // the photo becomes the row's first
    const alive = t >= M.alive;
    {
      const cx = mix(PH.cx, slotX(0), toRow), cy = mix(PH.cy, RY + RH / 2, toRow);
      const w = mix(PH.w, RW, toRow), h = mix(PH.h, RH, toRow);
      const inP = E.outCubic(prog(t, M.videoIn + 0.05, M.videoIn + 0.45));
      glow(g, cx, cy, 380, 'rgba(139,92,246,0.28)', inP * (1 - toRow * 0.5));
      around(g, cx, cy + (1 - inP) * 60, { alpha: inP }, () => {
        if (!alive) card(g, c.media.pic('nova-cafe'), 0, 0, w, h, { r: 22, sh: 0.8, focus: [0.5, 0.45] });
        else {
          const a = E.outCubic(prog(t, M.alive, M.alive + 0.35));
          if (a < 1) card(g, c.media.pic('nova-cafe'), 0, 0, w, h, { r: 22, sh: 0.8, focus: [0.5, 0.45] });
          g.save(); g.globalAlpha *= a;
          clipCard(g, c, 'nova-cafe-video', t, M.alive, -w / 2, -h / 2, w, h, { sh: 0.8 });
          g.restore();
        }
        // making it: a bar on the photo, then it plays
        const mk = prog(t, M.videoClick + 0.05, M.alive - 0.05);
        if (t > M.videoClick && t < M.alive + 0.2) {
          const a = clamp(prog(t, M.videoClick, M.videoClick + 0.12)) * (1 - E.inCubic(prog(t, M.alive, M.alive + 0.2)));
          g.save(); g.globalAlpha *= a;
          rr(g, -w / 2, -h / 2, w, h, 22); g.fillStyle = 'rgba(9,9,11,0.55)'; g.fill();
          g.restore();
          progressBar(g, -w / 2 + 34, 0, w - 68, E.inOutCubic(mk), { u: 1.35, t, label: 'Making its video', left: 'a few min', alpha: a });
        }
        // the play ring as it comes alive
        const pr = E.outCubic(prog(t, M.alive, M.alive + 0.6));
        if (pr > 0 && pr < 1) {
          g.save(); g.globalAlpha *= 1 - pr;
          g.beginPath(); g.arc(0, 0, 40 + pr * 160, 0, Math.PI * 2);
          g.lineWidth = 5; g.strokeStyle = 'rgba(232,121,249,0.9)'; g.stroke();
          g.restore();
        }
      });
      // "a few minutes later"
      const lp = popK(t, M.alive, 0.45) * (1 - E.inCubic(prog(t, M.alive + 0.75, M.alive + 1.0)));
      if (lp > 0) around(g, cx, cy - h / 2 - 30, { sc: lp, alpha: clamp(lp) }, () => {
        pill(g, 'a few minutes later', 0, 0, { size: 22, align: 'center', ic: 'ff', icColor: S.mint, bg: 'rgba(12,12,15,0.9)', line: 'rgba(63,240,195,0.5)' });
      });
    }

    // the Video tool
    const toolOut = E.inCubic(prog(t, M.alive + 0.45, M.alive + 0.85));
    if (toolOut < 1) {
      const inP = E.outQuart(prog(t, M.videoIn + 0.15, M.videoIn + 0.6));
      g.save();
      g.globalAlpha = clamp(inP) * (1 - toolOut);
      g.translate((1 - inP) * 80 + toolOut * 120, 0);
      panel(g, P.x, P.y, P.w, P.h, { r: 24, fill: S.panel });
      icon(g, 'film', P.x + 42, P.y + 50, 30, S.accent);
      text(g, 'Video', { x: P.x + 66, y: P.y + 61, font: { f: 'sans', w: 750, s: 30 }, color: S.text });
      label(g, 'Starts from', P.x + 28, P.y + 112, { u: U });
      pill(g, 'Nova · café photo', P.x + 28, P.y + 148, { size: 20, ic: 'image', icColor: S.accent, bg: S.raised, line: S.line2 });
      label(g, 'Model', P.x + 28, P.y + 210, { u: U });
      seg(g, ['Standard', 'Pro', 'Anime', 'Long'], P.x + 28, P.y + 226, P.w - 56, { u: U, on: 0 });
      label(g, 'Length', P.x + 28, P.y + 324, { u: U });
      seg(g, ['5 s', '10 s', '15 s'], P.x + 28, P.y + 340, 330, { u: U, on: 0 });
      label(g, 'Sound', P.x + 400, P.y + 324, { u: U });
      toggle(g, P.x + 400, P.y + 370, E.inOutCubic(prog(t, M.videoIn + 0.7, M.videoIn + 0.9)), { u: U });
      const press = clamp(1 - Math.abs(t - M.videoClick) / 0.12);
      goButton(g, VIDEOS.make, P.x + 28, P.y + P.h - 104, P.w - 56, { u: U, cost: VIDEOS.makeCost, press, ic: 'film', align: 'center', size: 16 });
      g.restore();
      const bx = P.x + P.w / 2 + 40, by = P.y + P.h - 104 + 33;
      const pp = E.inOutCubic(prog(t, M.videoClick - 0.4, M.videoClick));
      ripple(g, bx, by, t, M.videoClick, { r: 56 });
      pointer(g, mix(bx + 220, bx, pp), mix(by + 200, by, pp), { s: 1.7, press, alpha: clamp(prog(t, M.videoClick - 0.55, M.videoClick - 0.35)) * (1 - toolOut) });
    }

    // ---- four videos, side by side, all playing ----
    ROW.forEach(([name], k) => {
      if (k === 0) return;                                                     // Nova's is the photo that came alive
      const p = popK(t, M.row[k - 1], 0.5);
      if (p <= 0) return;
      const cx = slotX(k);
      glow(g, cx, RY + RH / 2, 220, k % 2 ? 'rgba(219,39,119,0.2)' : 'rgba(124,58,237,0.24)', clamp(p));
      around(g, cx, RY + RH / 2 + (1 - clamp(p)) * 90, { sc: p, alpha: clamp(p) }, () => {
        clipCard(g, c, name, t, M.row[k - 1], -RW / 2, -RH / 2, RW, RH, { sh: 0.8 });
      });
    });

    // ---- its models ----
    const notes = VIDEOS.modelNotes;
    notes.forEach((m, k) => {
      const p = popK(t, M.videoModels[k], 0.45);
      if (p <= 0) return;
      const col = k % 2, row = Math.floor(k / 2);
      const x = col ? W / 2 + 12 : W / 2 - 12, y = 838 + row * 62;
      around(g, x, y, { sc: clamp(p) * 0.15 + 0.85 * p, alpha: clamp(p) }, () => {
        pill(g, m, 0, 0, { size: 24, align: col ? 'left' : 'right', ic: ['film', 'spark', 'smile', 'ff'][k], icColor: k === 3 ? S.mint : S.accent, bg: 'rgba(16,16,20,0.92)', line: S.line2 });
      });
    });
    // and sound
    const sp = E.outCubic(prog(t, M.sound, M.sound + 0.4));
    if (sp > 0) {
      const y = 990;
      g.save(); g.globalAlpha *= sp;
      // a little equalizer
      const ex = W / 2 - 236;
      for (let i = 0; i < 5; i++) {
        const h = 10 + 22 * Math.abs(Math.sin(t * 7 + i * 1.3)) * sp;
        rr(g, ex + i * 9, y - h / 2 - 8, 6, h, 3);
        g.fillStyle = i % 2 ? S.pink : S.accent; g.fill();
      }
      say(g, `${VIDEOS.sound} · ${VIDEOS.seconds}`, { x: ex + 56, y: y + (1 - sp) * 10, size: 28, weight: 600, color: S.text2 });
      g.restore();
    }
  },
};
