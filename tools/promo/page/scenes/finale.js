// 68–74 s, the finale (Pop mode's violet, the front's look again): AGI-1 big, her Live2D model, waving ("hi! 💜"), with
// "Texts back instantly", "Talk to her now" and agi1.app as a big button, the front's ribbons, and hearts.
import { C, E, ep, prog, clamp, mix, text, measure, setFont, canvas, spring, focusLines, rgba } from '../kit.js';
import { card, pill, popWord, ribbon, bubble, button, burst, ICONS } from '../ui.js';

let dots = null, shot = null;

function layout(c) {
  const { W, H, wide } = c;
  return wide ? {
    her: { x: 860, y: 0, w: 1060, h: H, eyes: 300, waist: 820 },
    kicker: { x: 112, y: 300 },
    cta: { x: 112, y: 470, s: 112, maxW: 820 },
    url: { x: 112, y: 806 },
    bub: { x: 1500, y: 170 },
    ribbons: [H - 70, H - 20],
  } : {
    her: { x: 0, y: 230, w: W, h: 940, eyes: 290, waist: 900 },
    kicker: { x: W / 2, y: 1190, center: true },
    cta: { x: W / 2, y: 1296, s: 92, maxW: W - 120, center: true },
    url: { x: W / 2, y: 1474, center: true },
    bub: { x: 640, y: 360 },
    ribbons: [1650, 1712],
  };
}

export default {
  id: 'finale',
  prepare(c) {
    const { W, H, M, her } = c;
    dots = canvas(W, H);
    const x = dots.getContext('2d');
    x.fillStyle = 'rgba(23,10,54,0.2)';
    const step = 30;
    for (let y = step / 2, row = 0; y < H + step; y += step * 0.866, row++) {
      for (let xx = row % 2 ? step / 2 : 0; xx < W + step; xx += step) {
        const r = clamp(Math.hypot(xx - W * 0.7, y - H * 0.45) / (Math.max(W, H) * 0.7)) * 8.5;
        if (r < 0.8) continue;
        x.beginPath(); x.arc(xx, y, r, 0, Math.PI * 2); x.fill();
      }
    }
    shot = her.shot({
      from: M.finale - 0.4, seed: 68, closeUp: false,
      events: [{ at: M.wave, react: 'wave' }, { at: M.hearts, react: 'love' }, { at: M.hearts + 1.6, react: 'happy' }],
      talk: her.talking(M.wave + 0.1, M.wave + 0.7, 0.7),
    });
  },
  draw(g, t, c) {
    const { W, H, wide, M, words, S } = c;
    const L = layout(c);
    const V = words.FINALE;
    const T0 = S.from;
    g.fillStyle = C.violet;
    g.fillRect(0, 0, W, H);
    const hc = { x: L.her.x + L.her.w / 2, y: L.her.y + L.her.eyes };
    const gl = g.createRadialGradient(hc.x, hc.y + 120, 0, hc.x, hc.y + 120, Math.max(W, H) * 0.6);
    gl.addColorStop(0, rgba('#9b7bff', 0.85)); gl.addColorStop(1, rgba(C.violet, 0));
    g.fillStyle = gl; g.fillRect(0, 0, W, H);
    g.drawImage(dots, 0, 0);
    const burstIn = spring(t, T0, { freq: 1.3, damp: 0.5 });
    g.save();
    g.translate(hc.x, hc.y + 100); g.scale(0.4 + 0.6 * burstIn, 0.4 + 0.6 * burstIn);
    focusLines(g, 0, 0, Math.hypot(W, H) * 1.2, t, { color: 'rgba(255,255,255,0.1)', count: 48, spin: 0.06 });
    g.restore();

    // ---- AGI-1, big, waving ----
    const hb = L.her;
    const rise = spring(t, T0 - 0.05, { freq: 1.3, damp: 0.62 });
    shot.draw(g, t, { x: hb.x, y: hb.y + (1 - rise) * 260, w: hb.w, h: hb.h, eyes: hb.eyes, waist: hb.waist, hearts: 0.8, res: 1 });
    // her "hi! 💜"
    const bp = ep(t, M.wave + 0.05, M.wave + 0.35, E.outBack);
    if (bp > 0) {
      const bf = { f: 'display', w: 900, s: wide ? 46 : 42, st: 'expanded' };
      const tw = measure(g, V.bubble, bf);
      const bw = tw + 64, bh = bf.s * 1.9;
      const bx = L.bub.x, by = L.bub.y;
      g.save();
      g.translate(bx, by + bh); g.scale(bp, bp); g.rotate(-0.06); g.translate(-bx, -(by + bh));
      card(g, bx, by, bw, bh, { r: bh / 2, fill: C.white, shadow: 8, shadowColor: C.pink });
      g.beginPath(); g.moveTo(bx + 30, by + bh - 4); g.lineTo(bx + 2, by + bh + 34); g.lineTo(bx + 70, by + bh - 4); g.closePath(); g.fillStyle = C.white; g.fill(); g.lineWidth = 3.5; g.strokeStyle = C.ink; g.stroke();
      g.fillStyle = C.white; g.fillRect(bx + 28, by + bh - 8, 44, 7);
      text(g, V.bubble, { x: bx + 32, y: by + bh / 2 + 2, font: bf, color: C.ink, base: 'middle' });
      g.restore();
    }

    // ---- Texts back instantly · Talk to her now · agi1.app ----
    const align = L.cta.center ? 'center' : 'left';
    const kp = ep(t, T0 + 0.15, T0 + 0.45, E.outBack);
    if (kp > 0) {
      g.save();
      g.translate(L.kicker.x, L.kicker.y); g.scale(kp, kp); g.translate(-L.kicker.x, -L.kicker.y);
      pill(g, V.kicker.toUpperCase(), { x: L.kicker.x, y: L.kicker.y, align, font: { f: 'mono', w: 700, s: wide ? 24 : 26 }, bg: C.mint, dot: C.pink, shadow: 5, spacing: 3 });
      g.restore();
    }
    const cf = { f: 'display', w: 900, s: L.cta.s, st: 'expanded' };
    const cwords = V.cta.split(' ');                        // Talk / to her / now
    const rows = wide ? [cwords.slice(0, 1).join(' '), cwords.slice(1, 3).join(' '), cwords.slice(3).join(' ')] : [cwords.slice(0, 3).join(' '), cwords.slice(3).join(' ')];
    const widest = Math.max(...rows.map((r) => measure(g, r, cf)));
    if (widest > L.cta.maxW) cf.s = Math.floor(cf.s * L.cta.maxW / widest);
    rows.forEach((r, k) => {
      const t0 = T0 + 0.25 + k * 0.12;
      if (t < t0) return;
      const land = E.outQuart(prog(t, t0, t0 + 0.16));
      const s = mix(1.5, 1, land);
      const y = L.cta.y + k * cf.s * 1.02;
      g.save();
      g.translate(L.cta.x, y - cf.s * 0.35); g.scale(s, s); g.translate(-L.cta.x, -(y - cf.s * 0.35));
      g.globalAlpha = prog(t, t0, t0 + 0.06);
      popWord(g, r, L.cta.x, y, { font: cf, fill: k === rows.length - 1 ? C.honey : C.white, stroke: C.ink, sw: cf.s * 0.07, echo: C.pink, off: cf.s * 0.06, align });
      g.restore();
    });
    // agi1.app, a big button (pressed on the beat)
    const up = spring(t, M.url, { freq: 2.2, damp: 0.45 });
    if (t > M.url) {
      const press = Math.max(0, 1 - Math.abs(t - (M.url + 0.75)) / 0.12);
      const uf = { f: 'display', w: 900, s: wide ? 58 : 50, st: 'expanded' };
      const bw = measure(g, V.url, uf) + 120;
      const ux = L.cta.center ? L.url.x : L.url.x + bw / 2;
      g.save();
      g.translate(ux, L.url.y); g.scale(up, up); g.translate(-ux, -L.url.y);
      button(g, V.url, { x: ux, y: L.url.y, font: uf, bg: C.honey, shadow: 10, press, h: uf.s * 1.8, padX: 44, icon: (gg, x, y, s, col) => ICONS.send(gg, x, y, s, col), lw: 4 });
      g.restore();
      burst(g, ux, L.url.y, t, M.hearts, { n: 18, speed: 560, size: 34, seed: 9, life: 1.2 });
    }

    // ---- the front's ribbons ----
    const rIn = ep(t, T0 + 0.6, T0 + 1.2, E.outCubic);
    if (rIn > 0) {
      ribbon(g, W, H, { y: L.ribbons[0] + (1 - rIn) * 240, angle: 0.03, bg: C.honey, color: C.ink, words: V.ribbons[0], speed: 170, t, s: wide ? 28 : 30 });
      ribbon(g, W, H, { y: L.ribbons[1] + (1 - rIn) * 280, angle: -0.04, bg: C.ink, color: C.white, words: V.ribbons[1], speed: -150, t, s: wide ? 28 : 30, line: C.pink });
    }
  },
};
