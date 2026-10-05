// 38–42 s, burning $AGI for more messages (on ink): "Out of messages? Burn $AGI for more". The site's burn monitor's
// flame (its own icon), $AGI coins dropping in and burning up, and the true lines: from your own wallet, read on Robinhood
// Chain, gone for good. No numbers (the burn monitor's are live on the site, and a video's would go stale), and the fine
// print every time: it pays for messages, it's not an investment, not financial advice.
import { C, E, ep, prog, clamp, mix, text, measure, setFont, canvas, spring, rgba, noise1, hash } from '../kit.js';
import { card, pill, eyebrow, popWord, burst, flame, ICONS } from '../ui.js';

function layout(c) {
  const { W, H, wide } = c;
  return wide ? {
    head: { x: 112, eb: 250, t1: 400, t2: 530, s: 128 },
    lines: { x: 112, y: 650, gap: 70, s: 34 },
    fine: { x: 112, y: 960 },
    mon: { x: 1060, y: 150, w: 750, h: 780 },
  } : {
    head: { x: 70, eb: 300, t1: 430, t2: 540, s: 104 },
    mon: { x: 70, y: 620, w: W - 140, h: 560 },
    lines: { x: 90, y: 1270, gap: 66, s: 32 },
    fine: { x: W / 2, y: 1500, center: true },
  };
}
const flameAt = (L) => ({ x: L.mon.x + L.mon.w / 2, y: L.mon.y + L.mon.h * 0.58 });

export default {
  id: 'burn',
  exit(c) { return flameAt(layout(c)); },
  draw(g, t, c) {
    const { W, H, wide, M, words, S } = c;
    const L = layout(c);
    const V = words.BURN;
    const T0 = S.from;
    g.fillStyle = C.ink;
    g.fillRect(0, 0, W, H);
    const F = flameAt(L);
    const heat = 0.3 + 0.12 * Math.sin(t * 7) + 0.25 * ep(t, M.burn - 0.3, M.burn + 0.3);
    const rg = g.createRadialGradient(F.x, F.y, 0, F.x, F.y, Math.max(W, H) * 0.7);
    rg.addColorStop(0, rgba(C.pink, 0.45 * heat));
    rg.addColorStop(0.4, rgba(C.violet, 0.22 * heat));
    rg.addColorStop(1, rgba(C.ink, 0));
    g.fillStyle = rg; g.fillRect(0, 0, W, H);

    // ---- the heading ----
    const hd = L.head;
    const eb = V.eyebrow;
    const n = Math.floor(clamp((t - T0 - 0.05) / 0.4) * eb.length);
    if (n > 0) eyebrow(g, eb.slice(0, n), hd.x, hd.eb, { color: C.white, dot: C.honey, s: wide ? 24 : 28, spacing: 3 });
    const tf = { f: 'display', w: 900, s: hd.s, st: 'expanded' };
    [[V.title[0], hd.t1, T0 + 0.18], [V.title[1], hd.t2, T0 + 0.34]].forEach(([line, y, t0], k) => {
      if (t < t0) return;
      const land = E.outQuart(prog(t, t0, t0 + 0.16));
      const s = mix(1.7, 1, land);
      g.save();
      g.translate(hd.x, y - hd.s * 0.35); g.scale(s, s); g.translate(-hd.x, -(y - hd.s * 0.35));
      g.globalAlpha = prog(t, t0, t0 + 0.06);
      if (k === 0) {
        const w1 = measure(g, 'Burn ', tf);
        text(g, 'Burn ', { x: hd.x, y, font: tf, color: C.white });
        popWord(g, '$AGI', hd.x + w1, y, { font: tf, fill: C.honey, stroke: C.ink, sw: hd.s * 0.06, echo: C.pink, off: hd.s * 0.06, align: 'left' });
      } else text(g, line, { x: hd.x, y, font: tf, color: C.white });
      g.restore();
    });

    // ---- the burn monitor ----
    const mn = L.mon;
    const mIn = spring(t, T0 + 0.1, { freq: 1.6, damp: 0.6 });
    g.save();
    g.translate((1 - mIn) * (wide ? 800 : 0), (1 - mIn) * (wide ? 0 : 700));
    card(g, mn.x, mn.y, mn.w, mn.h, { r: 36, fill: '#241252', line: C.honey, lw: 3.5, shadow: 12, shadowColor: C.pink });
    pill(g, V.monitor.toUpperCase(), { x: mn.x + mn.w / 2, y: mn.y + 52, font: { f: 'mono', w: 700, s: wide ? 17 : 19 }, bg: C.ink, color: C.white, line: rgba(C.white, 0.35), lw: 1.5, spacing: 2 });
    pill(g, V.live.toUpperCase(), { x: mn.x + mn.w / 2, y: mn.y + 104, font: { f: 'mono', w: 700, s: wide ? 16 : 18 }, bg: null, color: C.mint, line: null, dot: (Math.floor(t * 2) % 2) ? C.mint : rgba(C.mint, 0.35), spacing: 3 });
    g.save();
    g.beginPath(); g.roundRect(mn.x + 2, mn.y + 2, mn.w - 4, mn.h - 4, 34); g.clip();
    // embers rising from the flame
    for (let i = 0; i < 46; i++) {
      const per = 1.4 + hash(i) * 0.9;
      const ph = ((t + hash(i + 3) * per) % per) / per;
      const ex = F.x + (hash(i + 7) - 0.5) * 220 + Math.sin(t * 3 + i) * 24 * ph;
      const ey = F.y - 60 - ph * (mn.h * 0.62);
      const a = (1 - ph) * clamp(ph * 6) * (0.5 + 0.5 * heat);
      g.beginPath(); g.arc(ex, ey, 2 + hash(i + 11) * 3.2, 0, Math.PI * 2);
      g.fillStyle = rgba(i % 3 ? C.honey : C.pink, a); g.fill();
    }
    // the flame, flickering (the site's own flame), with a bright heart
    const fs = (wide ? 360 : 300) * (1 + 0.04 * Math.sin(t * 11) + 0.03 * noise1(t * 6));
    const ignite = spring(t, T0 + 0.35, { freq: 1.6, damp: 0.5 });
    const glow = g.createRadialGradient(F.x, F.y, 0, F.x, F.y, fs * 0.9);
    glow.addColorStop(0, rgba(C.honey, 0.55 * heat)); glow.addColorStop(1, rgba(C.honey, 0));
    g.fillStyle = glow; g.fillRect(F.x - fs, F.y - fs, fs * 2, fs * 2);
    g.save();
    g.translate(F.x, F.y + fs * 0.42); g.scale(ignite, ignite); g.transform(1, 0, 0.04 * Math.sin(t * 5), 1, 0, 0); g.translate(-F.x, -(F.y + fs * 0.42));
    flame(g, F.x + 9, F.y + 11, fs, C.ink);
    flame(g, F.x, F.y, fs, C.pink, { line: C.ink, lw: 5 });
    flame(g, F.x, F.y + fs * 0.16, fs * 0.66, C.honey);
    flame(g, F.x, F.y + fs * 0.27, fs * 0.36, C.white);
    g.restore();
    // $AGI coins drop in and burn up
    for (let i = 0; i < 7; i++) {
      const ts = M.burn - 0.25 + i * 0.3;
      const fall = prog(t, ts, ts + 0.55);
      if (fall <= 0) continue;
      const done = fall >= 1;
      const cx = F.x + (hash(i + 21) - 0.5) * 160 * (1 - fall), cy = mn.y + 150 + E.inQuad(fall) * (F.y - mn.y - 150);
      if (!done) {
        const r = (wide ? 44 : 40) * (1 - 0.4 * E.inQuad(fall));
        g.save();
        g.translate(cx, cy); g.rotate((hash(i) - 0.5) * 1.6 + t * 2 * (hash(i + 2) - 0.5));
        g.beginPath(); g.arc(4, 6, r, 0, Math.PI * 2); g.fillStyle = C.ink; g.fill();
        g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fillStyle = C.honey; g.fill(); g.lineWidth = 3.5; g.strokeStyle = C.ink; g.stroke();
        g.beginPath(); g.arc(0, 0, r * 0.74, 0, Math.PI * 2); g.lineWidth = 2; g.stroke();
        text(g, '$AGI', { x: 0, y: 1, font: { f: 'display', w: 900, s: r * 0.5, st: 'expanded' }, color: C.ink, align: 'center', base: 'middle' });
        g.restore();
      }
      burst(g, F.x, F.y - fs * 0.1, t, ts + 0.55, { n: 9, speed: 300, size: 26, kind: 'spark', colors: [C.honey, C.white, C.pink], seed: i + 3, gravity: -200, life: 0.7, up: 1 });
    }
    g.restore();
    // the burn address, as on the site
    pill(g, 'to 0x…dEaD', { x: mn.x + mn.w / 2, y: mn.y + mn.h - 54, font: { f: 'mono', w: 700, s: wide ? 22 : 24 }, bg: C.white, color: C.ink, shadow: 5, shadowColor: C.pink, spacing: 1, icon: ICONS.flame });
    g.restore();

    // ---- the true lines ----
    const ln = L.lines;
    V.lines.forEach((s, k) => {
      const t0 = M.burn + 0.15 + k * 0.32;
      const p = ep(t, t0, t0 + 0.35, E.outBack);
      if (p <= 0) return;
      const y = ln.y + k * ln.gap;
      g.save();
      g.translate(ln.x, y); g.scale(p, p); g.translate(-ln.x, -y);
      g.beginPath(); g.arc(ln.x + 20, y - ln.s * 0.33, 20, 0, Math.PI * 2); g.fillStyle = C.mint; g.fill(); g.lineWidth = 2.5; g.strokeStyle = C.ink; g.stroke();
      ICONS.check(g, ln.x + 20, y - ln.s * 0.33, 22, C.ink);
      text(g, s, { x: ln.x + 58, y, font: { f: 'sans', w: 700, s: ln.s }, color: C.white });
      g.restore();
    });
    // the fine print
    const fp = ep(t, M.burn + 0.9, M.burn + 1.3);
    if (fp > 0) text(g, V.fine, { x: L.fine.x, y: L.fine.y, font: { f: 'mono', w: 600, s: wide ? 19 : 20 }, color: C.white, alpha: 0.72 * fp, spacing: 0.5, align: L.fine.center ? 'center' : 'left' });
  },
};
