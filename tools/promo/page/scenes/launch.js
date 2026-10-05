// 54–60 s, "Launch with AGI-1" (on Pop mode's pink): in her bot, a photo captioned "/launch Name | TICKER | one line" (her
// own example's shape: never a real coin's name), her "let's launch a coin together 💜", then the launch page's three steps
// (your wallet, Robinhood Chain, Launch) lighting up, and the launch. The coin is theirs: "the coin is yours, and i never
// touch your keys or your money." From their own wallet, on clank.trade's own contracts. And its fine print: 18+, she
// never promotes it, meme coins can go to zero, not financial advice.
import { C, E, ep, prog, clamp, mix, text, measure, setFont, canvas, spring, rgba, hash, heart, spark } from '../kit.js';
import { card, pill, eyebrow, popWord, bubble, button, ICONS, burst, lines } from '../ui.js';

let dots = null, face = null;

function layout(c) {
  const { W, H, wide } = c;
  return wide ? {
    head: { x: 112, eb: 150, t: 250, s: 86, maxW: 1100 },
    chat: { x: 112, y: 400, w: 640, h: 400 },
    page: { x: 836, y: 400, w: 972, h: 420 },
    yours: { x: 112, y: 846, maxW: 900 },
    where: { x: 1808, y: 878 },
    fine: { x: 112, y: 1024 },
  } : {
    head: { x: 70, eb: 290, t: 384, s: 70, maxW: W - 140 },
    chat: { x: 70, y: 500, w: W - 140, h: 330 },
    page: { x: 70, y: 866, w: W - 140, h: 400 },
    yours: { x: 70, y: 1300, maxW: W - 140 },
    where: { x: W / 2, y: 1472, center: true },
    fine: { x: W / 2, y: 1516, center: true },
  };
}

// the photo they send: a made-up coin picture (a little sun), nobody's real coin
function photo(g, x, y, s) {
  g.save();
  g.beginPath(); g.roundRect(x, y, s, s, 18); g.fillStyle = C.honey; g.fill(); g.lineWidth = 3; g.strokeStyle = C.ink; g.stroke();
  g.beginPath(); g.roundRect(x, y, s, s, 18); g.clip();
  g.fillStyle = rgba(C.white, 0.35);
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; g.beginPath(); g.moveTo(x + s / 2, y + s / 2); g.arc(x + s / 2, y + s / 2, s, a, a + 0.22); g.fill(); }
  g.beginPath(); g.arc(x + s / 2, y + s / 2, s * 0.26, 0, Math.PI * 2); g.fillStyle = '#ff9a3c'; g.fill(); g.lineWidth = 3; g.strokeStyle = C.ink; g.stroke();
  g.fillStyle = C.ink;
  g.beginPath(); g.arc(x + s * 0.44, y + s * 0.47, s * 0.025, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(x + s * 0.56, y + s * 0.47, s * 0.025, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(x + s / 2, y + s * 0.53, s * 0.07, 0.2, Math.PI - 0.2); g.lineWidth = 2.5; g.stroke();
  g.restore();
}

export default {
  id: 'launch',
  async prepare(c) {
    const { W, H } = c;
    dots = canvas(W, H);
    const x = dots.getContext('2d');
    x.fillStyle = 'rgba(255,255,255,0.16)';
    for (let y = 14, row = 0; y < H; y += 30, row++) for (let xx = row % 2 ? 15 : 0; xx < W + 30; xx += 30) { x.beginPath(); x.arc(xx, y, 2.6, 0, Math.PI * 2); x.fill(); }
    face = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = '/images/landing/agi1-face.webp'; });
  },
  draw(g, t, c) {
    const { W, H, wide, M, words, S } = c;
    const L = layout(c);
    const V = words.LAUNCH;
    const T0 = S.from;
    g.fillStyle = C.pink;
    g.fillRect(0, 0, W, H);
    g.drawImage(dots, 0, 0);
    // speed stripes once it's launched
    const go = ep(t, M.launched - 0.05, M.launched + 0.4);
    if (go > 0) {
      g.save();
      g.globalAlpha = 0.18 * go;
      g.fillStyle = C.white;
      for (let k = 0; k < 18; k++) {
        const x = (hash(k) * W * 1.2) - 100, len = 200 + hash(k + 4) * 500;
        const y = ((H + len) - (((t - M.launched) * (900 + hash(k + 2) * 900) + hash(k + 6) * H) % (H + len)));
        g.fillRect(x, y - len, 6 + hash(k + 8) * 8, len);
      }
      g.restore();
    }

    // ---- heading ----
    const hd = L.head;
    eyebrow(g, V.eyebrow, hd.x, hd.eb, { color: C.white, dot: C.honey, s: wide ? 22 : 25, alpha: ep(t, T0 + 0.05, T0 + 0.3), spacing: 3 });
    const tf = { f: 'display', w: 900, s: hd.s, st: 'expanded' };
    const widest = Math.max(...V.title.map((l) => measure(g, l, tf, -1)));
    if (widest > hd.maxW) tf.s = Math.floor(tf.s * hd.maxW / widest);
    V.title.forEach((line, k) => {
      const p = ep(t, T0 + 0.1 + k * 0.1, T0 + 0.6 + k * 0.1, E.outQuart);
      if (p <= 0) return;
      const y = hd.t + k * tf.s * 1.08;
      g.save();
      g.beginPath(); g.rect(0, y - tf.s * 1.05, W, tf.s * 1.4); g.clip();
      popWord(g, line, hd.x, y + (1 - p) * tf.s * 1.2, { font: tf, fill: k ? C.honey : C.white, stroke: C.ink, sw: tf.s * 0.07, echo: C.ink, off: tf.s * 0.06, align: 'left', spacing: -1 });
      g.restore();
    });

    // ---- in her bot: the photo and its caption, then her answer ----
    const ch = L.chat;
    const cIn = spring(t, T0 + 0.15, { freq: 1.6, damp: 0.6 });
    g.save();
    g.translate((1 - cIn) * -(wide ? 800 : 0), (1 - cIn) * (wide ? 0 : 700));
    card(g, ch.x, ch.y, ch.w, ch.h, { r: 30, fill: '#eef0fb', shadow: 12 });
    g.fillStyle = C.white; g.beginPath(); g.roundRect(ch.x + 2, ch.y + 2, ch.w - 4, 66, [28, 28, 0, 0]); g.fill();
    g.fillStyle = rgba(C.ink, 0.12); g.fillRect(ch.x + 2, ch.y + 68, ch.w - 4, 2);
    if (face) { g.save(); g.beginPath(); g.arc(ch.x + 44, ch.y + 35, 22, 0, Math.PI * 2); g.clip(); g.drawImage(face, ch.x + 22, ch.y + 13, 44, 44); g.restore(); }
    text(g, 'AGI-1', { x: ch.x + 78, y: ch.y + 36, font: { f: 'sans', w: 700, s: 22 }, color: C.ink, base: 'middle' });
    pill(g, 'on Telegram', { x: ch.x + ch.w - 20, y: ch.y + 35, align: 'right', font: { f: 'sans', w: 600, s: 16 }, bg: C.paper, icon: ICONS.send, lw: 1.5, spacing: 0 });
    g.save();
    g.beginPath(); g.rect(ch.x + 2, ch.y + 70, ch.w - 4, ch.h - 72); g.clip();
    // yours: the photo with its caption
    const yIn = ep(t, M.launchCmd, M.launchCmd + 0.3, E.outBack);
    const ps = wide ? 120 : 110;
    const capF = { f: 'mono', w: 600, s: wide ? 19 : 20 };
    if (yIn > 0) {
      const bx = ch.x + ch.w - 24, by = ch.y + 92;
      const capW = measure(g, V.command, capF) + 30;
      const bw = Math.max(ps + 24, capW), bh = ps + 70;
      g.save();
      g.translate(bx, by + bh); g.scale(yIn, yIn); g.translate(-bx, -(by + bh));
      g.beginPath(); g.roundRect(bx - bw + 5, by + 6, bw, bh, 22); g.fillStyle = C.ink; g.fill();
      g.beginPath(); g.roundRect(bx - bw, by, bw, bh, 22); g.fillStyle = C.violet; g.fill(); g.lineWidth = 2.5; g.strokeStyle = C.ink; g.stroke();
      photo(g, bx - bw + 12, by + 12, ps);
      const shown = Math.floor(clamp((t - M.launchCmd - 0.15) / 0.4) * V.command.length);
      text(g, V.command.slice(0, shown), { x: bx - bw + 15, y: by + ps + 46, font: capF, color: C.white });
      g.restore();
    }
    // hers
    const hIn = ep(t, M.launchCmd + 0.62, M.launchCmd + 0.92, E.outBack);
    if (hIn > 0) {
      const hf = { f: 'sans', w: 600, s: wide ? 24 : 25 };
      const hy = ch.y + 92 + ps + 70 + 18;
      const m = bubble(g, V.her, { x: 0, y: 0, maxW: ch.w - 80, font: hf, measureOnly: true });
      bubble(g, V.her, { x: ch.x + 24, y: hy, maxW: ch.w - 80, font: hf, bg: C.white, pop: hIn, lw: 2.5, shadow: 4 });
      const bt = ep(t, M.launchCmd + 0.85, M.launchCmd + 1.1, E.outBack);
      if (bt > 0) pill(g, 'Open on agi1.app ↗', { x: ch.x + 24 + m.w + 14, y: hy + m.h / 2, align: 'left', font: { f: 'sans', w: 700, s: wide ? 20 : 20 }, bg: C.honey, spacing: 0, shadow: 4, alpha: bt });
    }
    g.restore();
    g.restore();

    // ---- the launch page: your wallet, Robinhood Chain, Launch ----
    const pg = L.page;
    const pIn = spring(t, T0 + 0.25, { freq: 1.6, damp: 0.6 });
    g.save();
    g.translate((1 - pIn) * (wide ? 900 : 0), (1 - pIn) * (wide ? 0 : 900));
    card(g, pg.x, pg.y, pg.w, pg.h, { r: 32, fill: C.paper, shadow: 12 });
    text(g, 'agi1.app/launch', { x: pg.x + 34, y: pg.y + 50, font: { f: 'mono', w: 600, s: wide ? 19 : 20 }, color: rgba(C.ink, 0.55) });
    text(g, 'Launch your coin on clank.trade', { x: pg.x + 34, y: pg.y + 104, font: { f: 'display', w: 900, s: wide ? 36 : 32, st: 'expanded' }, color: C.ink });
    const icons = [ICONS.wallet, ICONS.chain, ICONS.rocket];
    const stepW = (pg.w - 68 - 2 * 18) / 3;
    V.steps.forEach((st, k) => {
      const x = pg.x + 34 + k * (stepW + 18), y = pg.y + 150;
      const on = t >= M.launchSteps[k];
      const pop = on ? spring(t, M.launchSteps[k], { freq: 2.6, damp: 0.45 }) : 0;
      const isLaunch = k === 2;
      g.save();
      const cx = x + stepW / 2, cy = y + 110;
      g.translate(cx, cy); g.scale(1 + 0.06 * Math.sin(Math.min(1, pop) * Math.PI), 1 + 0.06 * Math.sin(Math.min(1, pop) * Math.PI)); g.translate(-cx, -cy);
      card(g, x, y, stepW, 220, { r: 24, fill: on ? (isLaunch ? C.honey : C.white) : '#efeaff', shadow: on ? 7 : 0, lw: 3 });
      g.beginPath(); g.arc(x + 40, y + 42, 22, 0, Math.PI * 2); g.fillStyle = on ? C.mint : C.white; g.fill(); g.lineWidth = 2.5; g.strokeStyle = C.ink; g.stroke();
      if (on) ICONS.check(g, x + 40, y + 42, 22, C.ink); else text(g, String(k + 1), { x: x + 40, y: y + 43, font: { f: 'mono', w: 700, s: 20 }, color: C.ink, align: 'center', base: 'middle' });
      icons[k](g, x + stepW - 44, y + 44, 34, C.ink);
      text(g, st, { x: x + 24, y: y + 130, font: { f: 'sans', w: 700, s: wide ? 28 : 24 }, color: C.ink });
      const sub = k === 0 ? 'Your own wallet app' : k === 1 ? 'Switch to it, if asked' : 'Free, plus a small network fee';
      text(g, sub, { x: x + 24, y: y + 168, font: { f: 'sans', w: 500, s: wide ? 18 : 17 }, color: rgba(C.ink, 0.65) });
      g.restore();
    });
    g.restore();
    // it's launched: a rocket off the Launch step, and sparks
    if (t > M.launched - 0.1) {
      const k = t - M.launched;
      const x0 = pg.x + 34 + 2 * (stepW + 18) + stepW / 2, y0 = pg.y + 260;
      const rx = x0 + k * 260, ry = y0 - k * 900 - k * k * 300;
      if (ry > -120) {
        g.save();
        g.translate(rx, ry); g.rotate(0.28);
        // its trail
        for (let i = 0; i < 10; i++) { g.globalAlpha = 0.7 * (1 - i / 10); spark(g, -6 - i * 4, 60 + i * 26, 16 - i, i % 2 ? C.honey : C.white); }
        g.globalAlpha = 1;
        g.beginPath(); g.arc(0, 0, 54, 0, Math.PI * 2); g.fillStyle = C.white; g.fill(); g.lineWidth = 3.5; g.strokeStyle = C.ink; g.stroke();
        ICONS.rocket(g, 0, 0, 60, C.ink);
        g.restore();
      }
      burst(g, x0, y0, t, M.launched, { n: 20, speed: 640, size: 30, kind: 'spark', colors: [C.honey, C.white, C.mint, C.violet], seed: 7, life: 0.9 });
    }

    // ---- it's yours ----
    const yo = ep(t, M.launched + 0.25, M.launched + 0.6, E.outBack);
    if (yo > 0) {
      const Y = L.yours;
      const yf = { f: 'sans', w: 600, s: wide ? 30 : 30 };
      const av = 58;
      const m = bubble(g, V.yours, { x: 0, y: 0, maxW: Y.maxW - av - 18, font: yf, measureOnly: true });
      g.save();
      g.translate(Y.x, Y.y + m.h); g.scale(yo, yo); g.translate(-Y.x, -(Y.y + m.h));
      if (face) {
        g.save(); g.beginPath(); g.arc(Y.x + av / 2, Y.y + m.h - av / 2, av / 2, 0, Math.PI * 2); g.clip(); g.drawImage(face, Y.x, Y.y + m.h - av, av, av); g.restore();
        g.beginPath(); g.arc(Y.x + av / 2, Y.y + m.h - av / 2, av / 2, 0, Math.PI * 2); g.lineWidth = 3; g.strokeStyle = C.ink; g.stroke();
      }
      bubble(g, V.yours, { x: Y.x + av + 16, y: Y.y, maxW: Y.maxW - av - 18, font: yf, bg: C.white, shadow: 7 });
      g.restore();
    }
    const wp = ep(t, M.launched + 0.7, M.launched + 1.05);
    if (wp > 0) {
      if (wide) text(g, V.where, { x: L.where.x, y: L.where.y, font: { f: 'serif', w: 400, s: 40, i: true }, color: C.white, align: 'right', alpha: wp, shadow: { color: 'rgba(23,10,54,0.5)', x: 0, y: 3, blur: 0 } });
      else text(g, V.where, { x: L.where.x, y: L.where.y, font: { f: 'serif', w: 400, s: 32, i: true }, color: C.white, align: 'center', alpha: wp, shadow: { color: 'rgba(23,10,54,0.5)', x: 0, y: 3, blur: 0 } });
    }
    // the fine print, from the moment it's about launching coins
    const fp = ep(t, M.launchCmd + 0.4, M.launchCmd + 0.8);
    if (fp > 0) {
      const ff = { f: 'mono', w: 700, s: wide ? 19 : 17 };
      if (L.fine.center) pill(g, V.fine, { x: L.fine.x, y: L.fine.y, font: ff, bg: C.ink, color: C.white, line: null, spacing: 0.3, alpha: fp });
      else pill(g, V.fine, { x: L.fine.x, y: L.fine.y, align: 'left', font: ff, bg: C.ink, color: C.white, line: null, spacing: 0.3, alpha: fp });
    }
  },
};
