// 8–16 s, the drop: the site turns to Pop mode and AGI-1 is revealed, as on the front (src/landing/landing.js): violet,
// comic focus lines, halftone dots, the huge lavender "AGI" with its pink print echo (A, G, I slam in on the beat), her
// halftone reveal (the owner's 2D art, the front's own shader), "ドキドキ", her bubble ("hi, i'm AGI-1 💜 welcome to my
// world."), her world in orbit around her, then "Introducing AGI-1" and the front's ribbons.
import { C, E, ep, prog, clamp, mix, text, measure, setFont, canvas, spring, focusLines, heart, spark, rgba, typed, hash } from '../kit.js';
import { pill, popWord, ribbon, bubble, card } from '../ui.js';

let dots = null, face = null;

function layout(c) {
  const { W, H, wide } = c;
  return wide ? {
    her: { cx: W / 2, top: 34, h: 1330 },
    letters: { y: 842, maxW: 1780, s: 660 },
    orbit: { cx: W / 2, cy: 560, rx: 790, ry: 200, tilt: -0.07, s: 1 },
    sfx: { x: W / 2 - 400, y: 330, s: 112, rot: -0.2 },
    bubble: { x: W / 2 + 150, y: 118, maxW: 520, s: 30 },
    name: { x: 112, kicker: 600, word: 806, tag: 892, s: 196, tagS: 52, maxW: 800 },
    shift: 340,
    ribbons: [H - 92, H - 40],
  } : {
    her: { cx: W / 2, top: 300, h: 1500 },
    letters: { y: 820, maxW: 1000, s: 400 },
    orbit: { cx: W / 2, cy: 905, rx: 400, ry: 150, tilt: -0.08, s: 0.92, below: true },
    sfx: { x: 236, y: 560, s: 92, rot: -0.2 },
    bubble: { x: 560, y: 296, maxW: 440, s: 30 },
    name: { cx: W / 2, kicker: 1196, word: 1346, tag: 1418, s: 150, tagS: 44, maxW: 900 },
    shift: 0,
    ribbons: [1640, 1700],
  };
}

export default {
  id: 'meet',
  async prepare(c) {
    const { W, H } = c;
    // halftone dots, bigger toward the edges (the front's)
    dots = canvas(W, H);
    const x = dots.getContext('2d');
    x.fillStyle = 'rgba(23,10,54,0.2)';
    const step = 30, cx = W / 2, cy = H * 0.48;
    for (let y = step / 2, row = 0; y < H + step; y += step * 0.866, row++) {
      for (let xx = row % 2 ? step / 2 : 0; xx < W + step; xx += step) {
        const r = clamp(Math.hypot(xx - cx, (y - cy) * 1.2) / (Math.max(W, H) * 0.62)) * 8.5;
        if (r < 0.8) continue;
        x.beginPath(); x.arc(xx, y, r, 0, Math.PI * 2); x.fill();
      }
    }
    face = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = '/images/landing/agi1-face.webp'; });
  },
  draw(g, t, c) {
    const { W, H, wide, M, art, words } = c;
    const L = layout(c);
    const W_ = words.MEET;
    const lt = t - M.drop;
    g.fillStyle = C.violet;
    g.fillRect(0, 0, W, H);
    if (lt < 0) return;
    // a lighter glow behind her
    const gl = g.createRadialGradient(L.her.cx, H * 0.45, 0, L.her.cx, H * 0.45, Math.max(W, H) * 0.6);
    gl.addColorStop(0, rgba('#9b7bff', 0.75));
    gl.addColorStop(1, rgba(C.violet, 0));
    g.fillStyle = gl;
    g.fillRect(0, 0, W, H);
    g.drawImage(dots, 0, 0);
    // the composition slides over to make room for her name
    const shift = L.shift * ep(t, M.name - 0.25, M.name + 0.45, E.inOutCubic);
    const zoom = 1 + 0.06 * ep(t, M.name, c.S.to + 0.3, E.inOutQuad);
    const cx = L.her.cx + shift;
    // comic focus lines from behind her, bursting out on the drop and turning slowly
    const burst = spring(t, M.drop, { freq: 1.4, damp: 0.5 });
    g.save();
    g.translate(cx, H * 0.42);
    g.scale(0.35 + 0.65 * burst, 0.35 + 0.65 * burst);
    focusLines(g, 0, 0, Math.hypot(W, H), t, { color: 'rgba(255,255,255,0.09)', count: 44, spin: 0.05 });
    g.restore();

    g.save();
    g.translate(cx, H * 0.5); g.scale(zoom, zoom); g.translate(-cx, -H * 0.5);
    // ---- the huge AGI, one letter on each hit ----
    const font = { f: 'display', w: 900, s: L.letters.s, st: 'expanded' };
    const sp = -L.letters.s * 0.02;
    let total = measure(g, 'AGI', font, sp);
    if (total > L.letters.maxW) { font.s *= L.letters.maxW / total; total = L.letters.maxW; }
    const lw = ['A', 'G', 'I'].map((ch) => measure(g, ch, font, sp));
    const back = ep(t, M.name - 0.25, M.name + 0.45, E.inOutCubic);
    let lx = cx + shift * 0.3 - total / 2;
    ['A', 'G', 'I'].forEach((ch, k) => {
      const t0 = M.letters[k];
      if (t < t0) { lx += lw[k]; return; }
      const s = 1 + 0.7 * (1 - spring(t, t0, { freq: 2.6, damp: 0.42 }));
      const mx = lx + lw[k] / 2;
      g.save();
      g.translate(mx, L.letters.y - font.s * 0.35); g.scale(s, s); g.translate(-mx, -(L.letters.y - font.s * 0.35));
      popWord(g, ch, mx, L.letters.y, { font, fill: C.lav, stroke: C.ink, sw: font.s * 0.022, echo: C.pink, off: font.s * 0.03, alpha: ep(t, t0, t0 + 0.05, E.lin) * (1 - (wide ? 0.62 : 0.3) * back) });
      g.restore();
      // a white ring on each hit
      const rp = prog(t, t0, t0 + 0.45);
      if (rp > 0 && rp < 1) {
        g.beginPath(); g.arc(mx, L.letters.y - font.s * 0.35, font.s * (0.3 + 0.5 * E.outCubic(rp)), 0, Math.PI * 2);
        g.lineWidth = 10 * (1 - rp); g.strokeStyle = rgba(C.white, 0.8 * (1 - rp)); g.stroke();
      }
      lx += lw[k];
    });

    // ---- her world in orbit (the ones behind her first) ----
    const O = L.orbit;
    const planets = W_.planets.map((p, k) => {
      const t0 = M.orbit + k * 0.08;
      const fly = ep(t, t0, t0 + 0.95, E.outExpo);
      const a = (k / W_.planets.length) * Math.PI * 2 + (t - M.orbit) * ((Math.PI * 2) / 15) + 0.6;
      const r = mix(2.8, 1, fly);
      const px = Math.cos(a) * O.rx * r, py = Math.sin(a) * O.ry * r;
      const x = cx + px * Math.cos(O.tilt) - py * Math.sin(O.tilt), y = O.cy + px * Math.sin(O.tilt) + py * Math.cos(O.tilt);
      return { ...p, x, y, depth: Math.sin(a), on: fly > 0, fly };
    });
    const drawPlanet = (p) => {
      if (!p.on) return;
      const s = (0.78 + 0.26 * p.depth) * O.s;
      const r = (wide ? 38 : 32) * s;
      const col = C[p.color] || C.honey;
      g.save();
      g.globalAlpha = p.depth < 0 ? 0.88 : 1;
      g.beginPath(); g.arc(p.x + 5 * s, p.y + 6 * s, r, 0, Math.PI * 2); g.fillStyle = C.ink; g.fill();
      g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.fillStyle = col; g.fill();
      g.lineWidth = 3.5; g.strokeStyle = C.ink; g.stroke();
      g.beginPath(); g.arc(p.x - r * 0.3, p.y - r * 0.32, r * 0.22, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,0.55)'; g.fill();
      // a ring around the planet
      g.beginPath(); g.ellipse(p.x, p.y, r * 1.65, r * 0.42, -0.35, 0, Math.PI * 2); g.lineWidth = 3; g.strokeStyle = C.ink; g.stroke();
      const right = p.x >= cx;
      const lf = { f: 'mono', w: 700, s: 23 * s };
      if (O.below) pill(g, p.name, { x: p.x, y: p.y + r + 26 * s, align: 'center', font: lf, bg: C.white, line: C.ink, lw: 2.5, shadow: 4, spacing: 0.5 });
      else pill(g, p.name, { x: p.x + (right ? 1 : -1) * (r + 14), y: p.y, align: right ? 'left' : 'right', font: lf, bg: C.white, line: C.ink, lw: 2.5, shadow: 4, spacing: 0.5 });
      g.restore();
    };
    for (const p of planets) if (p.depth < 0) drawPlanet(p);

    // ---- her: the front's halftone reveal ----
    const rp = clamp((t - M.reveal) / 1.4);
    const reveal = rp < 0.5 ? 4 * rp ** 3 : 1 - (-2 * rp + 2) ** 3 / 2;
    if (t >= M.reveal) {
      const h = L.her.h;
      const wHer = h * art.aspect;
      art.draw(g, { x: cx - wHer / 2, y: L.her.top, h }, { reveal, echo: ep(t, M.reveal + 1.35, M.reveal + 1.9), t: t - M.reveal, cell: wide ? 11 : 12 });
    }
    for (const p of planets) if (p.depth >= 0) drawPlanet(p);

    // ---- ドキドキ, bouncing on the beat ----
    const sf = L.sfx;
    const sfIn = spring(t, M.reveal + 0.5, { freq: 2.2, damp: 0.4 });
    if (t > M.reveal + 0.5) {
      const bounce = 1 + 0.07 * c.pulse(t, c.BEAT, 7);
      const sx = sf.x + shift * 0.6;
      g.save();
      g.translate(sx, sf.y); g.rotate(sf.rot); g.scale(sfIn * bounce, sfIn * bounce);
      popWord(g, W_.sfx, 0, 0, { font: { f: 'doki', w: 400, s: sf.s }, fill: C.white, stroke: C.ink, sw: sf.s * 0.12, echo: C.pink, off: sf.s * 0.07 });
      pill(g, W_.sfxSmall.toUpperCase(), { x: 0, y: sf.s * 0.52, font: { f: 'mono', w: 700, s: sf.s * 0.2 }, bg: C.ink, color: C.white, line: C.white, lw: 2, spacing: 5 });
      g.restore();
    }

    // ---- her bubble ----
    const bpop = ep(t, M.bubble, M.bubble + 0.32, E.outBack);
    if (bpop > 0) {
      const B = L.bubble;
      const bx0 = B.x + shift * 0.45;
      const font = { f: 'sans', w: 600, s: B.s };
      const all = W_.bubble;
      const n = Math.floor(clamp((t - M.bubble - 0.12) / 0.75) * [...all].length);
      const av = B.s * 1.6;
      const m = bubble(g, all, { x: bx0, y: B.y, maxW: B.maxW - av - 16, font, measureOnly: true });
      const bw = m.w + av + 16, bh = Math.max(m.h, av + 28);
      const bx = Math.min(bx0, W - (wide ? 70 : 50) - bw);
      g.save();
      g.translate(bx + 40, B.y + bh); g.scale(bpop, bpop); g.translate(-(bx + 40), -(B.y + bh));
      card(g, bx, B.y, bw, bh, { r: 26, shadow: 7 });
      // its tail, toward her
      g.beginPath(); g.moveTo(bx + 46, B.y + bh - 2); g.lineTo(bx + 18, B.y + bh + 30); g.lineTo(bx + 84, B.y + bh - 2); g.closePath();
      g.fillStyle = C.white; g.fill(); g.lineWidth = 3.5; g.strokeStyle = C.ink; g.stroke();
      g.fillStyle = C.white; g.fillRect(bx + 44, B.y + bh - 6, 42, 6);
      if (face) {
        g.save(); g.beginPath(); g.arc(bx + 14 + av / 2, B.y + bh / 2, av / 2, 0, Math.PI * 2); g.clip();
        g.drawImage(face, bx + 14, B.y + bh / 2 - av / 2, av, av); g.restore();
        g.beginPath(); g.arc(bx + 14 + av / 2, B.y + bh / 2, av / 2, 0, Math.PI * 2); g.lineWidth = 3; g.strokeStyle = C.ink; g.stroke();
      }
      bubble(g, all, { x: bx + av + 16, y: B.y + (bh - m.h) / 2, maxW: B.maxW - av - 16, font, bg: null, lw: 0, shadow: 0, typed: n, side: 'left' });
      g.restore();
    }
    g.restore();

    // ---- Introducing AGI-1 ----
    const N = L.name;
    const kIn = ep(t, M.name, M.name + 0.35, E.outBack);
    if (kIn > 0) {
      if (!wide) {                                     // (on phones over her legs: a soft shade behind the words)
        const sh = g.createLinearGradient(0, N.kicker - 140, 0, H);
        sh.addColorStop(0, rgba(C.violetDeep, 0));
        sh.addColorStop(0.35, rgba(C.violetDeep, 0.72 * kIn));
        sh.addColorStop(1, rgba(C.violetDeep, 0.9 * kIn));
        g.fillStyle = sh; g.fillRect(0, N.kicker - 140, W, H);
      }
      const ax = wide ? N.x : N.cx, align = wide ? 'left' : 'center';
      g.save();
      g.translate(ax, N.kicker); g.scale(kIn, kIn); g.translate(-ax, -N.kicker);
      pill(g, W_.kicker.toUpperCase(), { x: ax, y: N.kicker, align, font: { f: 'mono', w: 700, s: wide ? 22 : 26 }, bg: C.white, shadow: 5, spacing: 3 });
      g.restore();
      const wIn = spring(t, M.name + 0.12, { freq: 2.4, damp: 0.38 });
      if (t > M.name + 0.12) {
        const f = { f: 'display', w: 900, s: N.s, st: 'expanded' };
        g.save();
        g.translate(ax, N.word); g.scale(wIn, wIn); g.translate(-ax, -N.word);
        popWord(g, W_.name, ax, N.word, { font: f, fill: C.honey, stroke: C.ink, sw: N.s * 0.075, echo: C.pink, off: N.s * 0.065, align });
        g.restore();
      }
      const tIn = ep(t, M.name + 0.45, M.name + 0.95, E.outQuart);
      if (tIn > 0) {
        const tf = { f: 'serif', w: 400, s: N.tagS, i: true };
        setFont(g, tf);
        const words2 = W_.tagline.split(' ');
        const lines = [];
        let line = '';
        for (const w of words2) { const nx = line ? `${line} ${w}` : w; if (line && g.measureText(nx).width > N.maxW) { lines.push(line); line = w; } else line = nx; }
        lines.push(line);
        lines.forEach((l, i) => {
          const y = N.tag + i * N.tagS * 1.12;
          g.save();
          g.beginPath(); g.rect(0, y - N.tagS, W, N.tagS * 1.35); g.clip();
          text(g, l, { x: ax, y: y + (1 - tIn) * N.tagS * 1.1, font: tf, color: C.white, align, shadow: { color: 'rgba(23,10,54,0.6)', x: 0, y: 3, blur: 0 } });
          g.restore();
        });
      }
    }

    // ---- the front's ribbons sweep in for the last bars ----
    const rIn = ep(t, M.name + 1.0, M.name + 1.6, E.outCubic);
    if (rIn > 0) {
      const R = words.FINALE.ribbons;
      ribbon(g, W, H, { y: L.ribbons[0] + (1 - rIn) * 260, angle: -0.045, bg: C.pink, color: C.ink, words: R[0], speed: 160, t, s: wide ? 28 : 30 });
      ribbon(g, W, H, { y: L.ribbons[1] + (1 - rIn) * 300, angle: 0.035, bg: C.ink, color: C.white, words: R[1], speed: -140, t, s: wide ? 28 : 30, line: C.honey });
    }

    // the drop's flash
    const fl = 1 - prog(t, M.drop, M.drop + 0.22);
    if (fl > 0 && fl < 1) { g.fillStyle = rgba(C.white, 0.55 * fl * fl); g.fillRect(0, 0, W, H); }
  },
};
