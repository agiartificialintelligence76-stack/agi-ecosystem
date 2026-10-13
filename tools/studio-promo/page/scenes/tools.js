// 10. The tools around them (64–72 s): "Everything to post it." Eight cards, one a beat: the video editor, captions,
// Make another, Instant, progress, profile pictures, downloads, guides and help, each with a small loop of what it
// does. Then a light reads them one by one.
import { S, backdrop, headline, pill, glow, icon, progressBar, typedAt } from '../look.js';
import { popK, around, E, prog, clamp, mix, text, rr, media, grad, GRAD, panel, measure } from '../parts.js';
import { TOOLS } from '../../words.js';

// 16:9: four cards a row across the wide frame (300 wide in 4:3), lined up with the headline
const LM = 120;
const CW = 400, CH = 336, GAP = 28;
const GX = 960 - (CW * 4 + GAP * 3) / 2, GY = 222;
const pos = (k) => ({ x: GX + (k % 4) * (CW + GAP), y: GY + Math.floor(k / 4) * (CH + GAP) });

// each card's little loop, in its lower part (x, y: the area's top left; w, h: its size; s: seconds since it came)
const DEMOS = [
  // the video editor: a filmstrip, its trim handles moving in
  (g, c, x, y, w, h, s) => {
    const fy = y + 22, fh = 64, n = 6, fw = (w - 20) / n;
    for (let i = 0; i < n; i++) media(g, c.media.pic(['nova-cafe', 'nova-golden', 'nova-beach'][i % 3]), x + 10 + i * fw, fy, fw - 3, fh, { r: 4, lw: 0, focus: [0.5, 0.35] });
    const a = 0.08 + 0.14 * E.inOutCubic(clamp(((s * 0.6) % 2) < 1 ? (s * 0.6) % 1 : 1 - (s * 0.6) % 1));
    const l = x + 10 + (w - 20) * a, r = x + 10 + (w - 20) * (1 - a * 0.8);
    g.fillStyle = 'rgba(9,9,11,0.62)';
    g.fillRect(x + 10, fy, l - x - 10, fh); g.fillRect(r, fy, x + w - 10 - r, fh);
    g.lineWidth = 4; g.strokeStyle = S.honey;
    rr(g, l, fy - 3, r - l, fh + 6, 6); g.stroke();
    text(g, `${(1 + (1 - a * 1.8) * 9).toFixed(1)} s`, { x: x + w / 2, y: fy + fh + 30, font: { f: 'mono', w: 600, s: 18 }, color: S.text2, align: 'center' });
  },
  // captions: one being typed
  (g, c, x, y, w, h, s) => {
    rr(g, x + 10, y + 14, w - 20, h - 30, 12); g.fillStyle = S.surface; g.fill(); g.lineWidth = 1.5; g.strokeStyle = S.line2; g.stroke();
    const str = typedAt(TOOLS.caption, s, 0.1, 26);
    const words = str.split(' '), lines = [''];
    const f17 = { f: 'sans', w: 500, s: 17 };
    for (const wd of words) {
      const tryL = lines[lines.length - 1] ? `${lines[lines.length - 1]} ${wd}` : wd;
      if (measure(g, tryL, f17) > w - 48 && lines[lines.length - 1]) lines.push(wd); else lines[lines.length - 1] = tryL;
    }
    lines.slice(0, 3).forEach((ln, i) => text(g, ln, { x: x + 24, y: y + 44 + i * 24, font: { f: 'sans', w: 500, s: 17 }, color: ln.includes('#') ? S.accent : S.text }));
  },
  // make another: a tile and another one coming next to it, the arrows turning
  (g, c, x, y, w, h, s) => {
    const k = E.outBack(clamp((s % 2.4) / 0.6), 1.6);
    media(g, c.media.pic('kai-neon'), x + w / 2 - 92, y + 16, 76, 96, { r: 10, lw: 0, focus: [0.5, 0.3] });
    around(g, x + w / 2 + 54, y + 64, { sc: k, alpha: clamp(k) }, () => media(g, c.media.pic('kai-body'), -38, -48, 76, 96, { r: 10, lw: 0, focus: [0.5, 0.2] }));
    around(g, x + w / 2 - 2, y + 64, { rot: s * 3 }, () => icon(g, 'refresh', 0, 0, 30, S.accent, { lw: 2.6 }));
  },
  // Instant: the mint switch going on
  (g, c, x, y, w, h, s) => {
    const on = E.inOutCubic(clamp(((s % 2.6) - 0.5) / 0.3));
    const sw = 96, sh = 50, sx = x + w / 2 - sw / 2, sy = y + 30;
    rr(g, sx, sy, sw, sh, sh / 2);
    g.fillStyle = on > 0.5 ? grad(g, sx, sy, sw, sh, GRAD.instant, 90) : S.raised2; g.fill();
    g.beginPath(); g.arc(sx + mix(sh / 2, sw - sh / 2, on), sy + sh / 2, sh / 2 - 5, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
    text(g, on > 0.5 ? 'Instant on' : 'Instant', { x: x + w / 2, y: sy + sh + 34, font: { f: 'sans', w: 700, s: 20 }, color: on > 0.5 ? S.mint : S.text3, align: 'center' });
  },
  // progress: a bar with its percentage and the time left
  (g, c, x, y, w, h, s) => {
    const p = clamp((s % 3.2) / 2.8);
    progressBar(g, x + 18, y + 64, w - 36, E.inOutCubic(p), { u: 1.25, t: s, label: '3D model', left: `${Math.max(1, Math.round(6 * (1 - p)))} min` });
  },
  // a profile picture: a round frame moving over its picture
  (g, c, x, y, w, h, s) => {
    const bw = 150, bh = 108, bx = x + w / 2 - bw / 2, by = y + 14;
    media(g, c.media.pic('nova-golden'), bx, by, bw, bh, { r: 10, lw: 0, focus: [0.5, 0.25], dim: 0.35 });
    const fx = bx + bw / 2 + Math.sin(s * 1.6) * 30, fy = by + 50 + Math.cos(s * 1.3) * 10, fr = 40;
    g.save(); g.beginPath(); g.arc(fx, fy, fr, 0, Math.PI * 2); g.clip();
    media(g, c.media.pic('nova-golden'), bx, by, bw, bh, { r: 0, lw: 0, focus: [0.5, 0.25] });
    g.restore();
    g.beginPath(); g.arc(fx, fy, fr, 0, Math.PI * 2); g.lineWidth = 3; g.strokeStyle = '#fff'; g.stroke();
  },
  // downloads: an arrow dropping into a tray, the file's AI tag
  (g, c, x, y, w, h, s) => {
    const k = (s % 1.4) / 1.4, cx = x + w / 2;
    rr(g, cx - 60, y + 62, 120, 10, 5); g.fillStyle = S.raised2; g.fill();
    around(g, cx, y + 18 + E.inCubic(clamp(k * 1.3)) * 30, { alpha: 1 - clamp((k - 0.75) * 4) }, () => icon(g, 'download', 0, 0, 36, S.accent, { lw: 2.6 }));
    pill(g, 'AI-generated · in the file', cx, y + 100, { size: 16, align: 'center', bg: 'rgba(16,16,20,0.9)', line: S.line2, color: S.text2 });
  },
  // guides: an arrow pointing at a button, its ring pulsing
  (g, c, x, y, w, h, s) => {
    const bx = x + w / 2 - 70, by = y + 64;
    rr(g, bx, by - 22, 140, 44, 22); g.fillStyle = grad(g, bx, by - 22, 140, 44, GRAD.bar, 90); g.fill();
    text(g, 'Create', { x: bx + 70, y: by + 1, font: { f: 'sans', w: 700, s: 18 }, color: '#fff', align: 'center', base: 'middle' });
    const r = (s % 1.2) / 1.2;
    g.save(); g.globalAlpha = 1 - r;
    rr(g, bx - 6 - r * 12, by - 28 - r * 12, 152 + r * 24, 56 + r * 24, 28 + r * 12); g.lineWidth = 3; g.strokeStyle = S.honey; g.stroke();
    g.restore();
    const ay = by - 52 - Math.sin(s * 5) * 6;
    g.beginPath(); g.moveTo(bx + 70, ay + 18); g.lineTo(bx + 58, ay); g.lineTo(bx + 82, ay); g.closePath(); g.fillStyle = S.honey; g.fill();
  },
];

export default {
  draw(g, t, c) {
    const { W, H, M } = c;
    backdrop(g, W, H, t, { a: 0.7, b: 0.75, ax: 0.5, ay: 0.05, bx: 0.5, by: 1.05, grid: 0.4 });
    headline(g, TOOLS.head, t, M.tools[0] - 0.05, { x: LM, y: 140, size: 88 });
    // a light reads them, one after another
    const readT = t - M.toolsRead[0];
    const reading = readT >= 0 ? Math.floor(readT / 0.48) : -1;
    const push = 1 + 0.035 * E.inOutCubic(prog(t, M.toolsRead[0], M.toolsRead[1] + 1.8));
    g.save();
    g.translate(W / 2, 600); g.scale(push, push); g.translate(-W / 2, -600);
    TOOLS.cards.forEach((cd, k) => {
      const t0 = M.tools[k];
      const p = popK(t, t0, 0.5);
      if (p <= 0) return;
      const { x, y } = pos(k);
      const lit = reading === k ? 1 - clamp((readT - k * 0.48 - 0.36) / 0.12) : 0;
      const hl = reading === k ? clamp((readT - k * 0.48) / 0.12) * lit : 0;
      around(g, x + CW / 2, y + CH / 2 + (1 - clamp(p)) * 70, { sc: p * (1 + hl * 0.04), alpha: clamp(p) }, () => {
        const ox = -CW / 2, oy = -CH / 2;
        if (hl > 0) glow(g, 0, 0, 260, 'rgba(232,121,249,0.35)', hl);
        panel(g, ox, oy, CW, CH, { r: 22, fill: S.panel, line: hl > 0.3 ? 'rgba(232,121,249,0.8)' : S.line2, lw: hl > 0.3 ? 2.5 : 1.5, sh: 0.6 });
        // its icon in a gradient square
        rr(g, ox + 22, oy + 22, 58, 58, 16);
        g.fillStyle = grad(g, ox + 22, oy + 22, 58, 58, k === 3 ? GRAD.instant : GRAD.bar, 135); g.fill();
        icon(g, cd.icon, ox + 51, oy + 51, 30, k === 3 ? '#08201b' : '#fff', { lw: 2.4 });
        text(g, cd.title, { x: ox + 22, y: oy + 118, font: { f: 'sans', w: 750, s: 29 }, color: S.text });
        // its note, two lines at most
        const words = cd.note.split(' '), lines = [''];
        const f20 = { f: 'sans', w: 500, s: 20 };
        for (const wd of words) {
          const tryL = lines[lines.length - 1] ? `${lines[lines.length - 1]} ${wd}` : wd;
          if (measure(g, tryL, f20) > CW - 44 && lines[lines.length - 1]) lines.push(wd); else lines[lines.length - 1] = tryL;
        }
        lines.slice(0, 2).forEach((ln, i) => text(g, ln, { x: ox + 22, y: oy + 152 + i * 26, font: { f: 'sans', w: 500, s: 20 }, color: S.text2 }));
        // its loop
        g.save();
        rr(g, ox + 12, oy + 196, CW - 24, CH - 208, 14); g.clip();
        g.fillStyle = 'rgba(255,255,255,0.025)'; g.fillRect(ox + 12, oy + 196, CW - 24, CH - 208);
        DEMOS[k](g, c, ox + 12, oy + 196, CW - 24, CH - 208, Math.max(0, t - t0));
        g.restore();
      });
    });
    g.restore();
    void pill; void H;
  },
};
