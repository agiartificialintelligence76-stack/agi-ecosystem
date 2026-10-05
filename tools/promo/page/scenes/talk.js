// 22–28 s, the Playground (Pop mode's lavender): "Talk to her". You type "do you actually text back?", she thinks, and
// answers "instantly 💜 it's kind of my whole thing" (her mood: happy), while her live view (her Live2D model, framed like
// a video call, as on the site) listens, thinks, hops with hearts and talks. Then three things she does: her natural
// voice, voice calls, she reacts to every reply.
import { C, E, ep, prog, clamp, mix, text, measure, setFont, canvas, spring, focusLines, rgba, typed, graphemes } from '../kit.js';
import { card, eyebrow, pill, bubble, typingDots, ICONS, popWord } from '../ui.js';

let dots = null, face = null, shot = null;

function layout(c) {
  const { W, H, wide } = c;
  return wide ? {
    head: { x: 112, eb: 186, title: 300, s: 104 },
    chat: { x: 112, y: 380, w: 880, h: 500 },
    cam: { x: 1070, y: 120, w: 738, h: 840 },
    pills: { x: 112, y: 950, row: true },
  } : {
    head: { x: 70, eb: 300, title: 400, s: 96 },
    cam: { x: 70, y: 450, w: W - 140, h: 560 },
    pills: { x: W / 2, y: 1062, row: true, center: true },
    chat: { x: 70, y: 1120, w: W - 140, h: 400 },
  };
}

export default {
  id: 'talk',
  async prepare(c) {
    const { W, H, M, her } = c;
    dots = canvas(W, H);
    const x = dots.getContext('2d');
    x.fillStyle = 'rgba(107,59,255,0.13)';
    for (let y = 14, row = 0; y < H; y += 28, row++) for (let xx = row % 2 ? 14 : 0; xx < W + 28; xx += 28) { x.beginPath(); x.arc(xx, y, 2.6, 0, Math.PI * 2); x.fill(); }
    face = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = '/images/landing/agi1-face.webp'; });
    const T0 = c.at(11);
    shot = her.shot({
      from: T0 - 0.4, seed: 22, closeUp: true,
      events: [
        { at: T0 - 0.3, hello: true },
        { at: M.send - 0.55, attention: 'listening' },
        { at: M.typing - 0.1, attention: 'thinking' },
        { at: M.reply, attention: 'idle' },
        { at: M.reply, react: 'happy' },
      ],
      talk: her.talking(M.reply + 0.05, M.reply + 1.9),
    });
  },
  draw(g, t, c) {
    const { W, H, wide, M, words, S } = c;
    const L = layout(c);
    const V = words.TALK;
    const T0 = S.from;
    g.fillStyle = C.lav;
    g.fillRect(0, 0, W, H);
    g.drawImage(dots, 0, 0);

    // ---- heading ----
    const hd = L.head;
    eyebrow(g, V.eyebrow, hd.x, hd.eb, { color: C.ink, dot: C.violet, s: wide ? 22 : 26, alpha: ep(t, T0 + 0.05, T0 + 0.3) });
    const tp = ep(t, T0 + 0.1, T0 + 0.6, E.outQuart);
    if (tp > 0) {
      g.save();
      g.beginPath(); g.rect(0, hd.title - hd.s * 1.05, W, hd.s * 1.4); g.clip();
      popWord(g, V.title, hd.x, hd.title + (1 - tp) * hd.s * 1.2, { font: { f: 'display', w: 900, s: hd.s, st: 'expanded' }, fill: C.ink, stroke: null, sw: 0, echo: C.pink, off: hd.s * 0.06, align: 'left' });
      g.restore();
    }

    // ---- her live view: a pink comic panel with her in it ----
    const cm = L.cam;
    const camIn = spring(t, T0 + 0.05, { freq: 1.5, damp: 0.6 });
    g.save();
    g.translate((1 - camIn) * (wide ? 700 : 0), (1 - camIn) * (wide ? 0 : -500));
    card(g, cm.x, cm.y, cm.w, cm.h, { r: 34, fill: C.pink, shadow: 12 });
    g.save();
    g.beginPath(); g.roundRect(cm.x + 2, cm.y + 2, cm.w - 4, cm.h - 4, 32); g.clip();
    focusLines(g, cm.x + cm.w / 2, cm.y + cm.h * 0.38, Math.hypot(cm.w, cm.h), t, { color: 'rgba(255,255,255,0.16)', count: 34, spin: 0.03 });
    shot.draw(g, t, { x: cm.x, y: cm.y, w: cm.w, h: cm.h, eyes: cm.h * (wide ? 0.38 : 0.42), waist: cm.h * (wide ? 1.72 : 1.62), hearts: 0.4 });
    g.restore();
    g.lineWidth = 3.5; g.strokeStyle = C.ink;
    g.beginPath(); g.roundRect(cm.x, cm.y, cm.w, cm.h, 34); g.stroke();
    // its label: live · listening · thinking · speaking
    const state = t >= M.reply && t < M.reply + 1.95 ? V.speaking : t >= M.typing - 0.1 && t < M.reply ? 'thinking' : t >= M.send - 0.55 && t < M.typing ? 'listening' : V.live;
    pill(g, state, { x: cm.x + 24, y: cm.y + 40, align: 'left', font: { f: 'mono', w: 700, s: wide ? 20 : 22 }, bg: C.white, dot: state === V.live ? C.pink : state === V.speaking ? C.mint : C.honey, spacing: 1, shadow: 4, upper: true });
    // Call
    pill(g, 'Call', { x: cm.x + cm.w - 24, y: cm.y + cm.h - 42, align: 'right', font: { f: 'sans', w: 700, s: wide ? 22 : 24 }, bg: C.white, icon: ICONS.call, spacing: 0, shadow: 4 });
    g.restore();

    // ---- the chat ----
    const ch = L.chat;
    const chatIn = spring(t, T0 + 0.12, { freq: 1.5, damp: 0.62 });
    g.save();
    g.translate(0, (1 - chatIn) * (wide ? 700 : 600));
    card(g, ch.x, ch.y, ch.w, ch.h, { r: 30, shadow: 12 });
    // its bar
    const barH = wide ? 76 : 80;
    g.fillStyle = 'rgba(23,10,54,0.12)'; g.fillRect(ch.x + 3, ch.y + barH, ch.w - 6, 2.5);
    const av = barH * 0.62;
    if (face) {
      g.save(); g.beginPath(); g.arc(ch.x + 26 + av / 2, ch.y + barH / 2, av / 2, 0, Math.PI * 2); g.clip();
      g.drawImage(face, ch.x + 26, ch.y + barH / 2 - av / 2, av, av); g.restore();
      g.beginPath(); g.arc(ch.x + 26 + av / 2, ch.y + barH / 2, av / 2, 0, Math.PI * 2); g.lineWidth = 2.5; g.strokeStyle = C.ink; g.stroke();
    }
    const nw = text(g, 'AGI-1 ▾', { x: ch.x + 40 + av, y: ch.y + barH / 2 + 1, font: { f: 'sans', w: 700, s: wide ? 26 : 28 }, color: C.ink, base: 'middle' });
    g.beginPath(); g.arc(ch.x + 62 + av + nw, ch.y + barH / 2, 6, 0, Math.PI * 2); g.fillStyle = C.up; g.fill();
    text(g, 'online', { x: ch.x + 74 + av + nw, y: ch.y + barH / 2 + 1, font: { f: 'sans', w: 500, s: wide ? 20 : 22 }, color: 'rgba(23,10,54,0.6)', base: 'middle' });
    ICONS.speaker(g, ch.x + ch.w - 40, ch.y + barH / 2, wide ? 26 : 28, C.ink);
    // the message box at the bottom: your words typed, then sent
    const boxH = wide ? 72 : 76, boxY = ch.y + ch.h - boxH - 18;
    g.beginPath(); g.roundRect(ch.x + 20, boxY, ch.w - 40, boxH, boxH / 2); g.fillStyle = C.paper; g.fill(); g.lineWidth = 2.5; g.strokeStyle = C.ink; g.stroke();
    const mine = V.chat[0].text, hers = V.chat[1].text;
    const tStart = M.send - 0.62, tEnd = M.send - 0.12;
    const nTyped = Math.floor(clamp((t - tStart) / (tEnd - tStart)) * graphemes(mine).length);
    const sent = t >= M.send;
    const mf = { f: 'sans', w: 500, s: wide ? 26 : 28 };
    if (!sent && nTyped > 0) {
      const tw = text(g, typed(mine, nTyped), { x: ch.x + 50, y: boxY + boxH / 2 + 1, font: mf, color: C.ink, base: 'middle' });
      if (Math.floor(t * 4) % 2 === 0) { g.fillStyle = C.violet; g.fillRect(ch.x + 52 + tw, boxY + 18, 3, boxH - 36); }
    } else text(g, 'Message AGI-1…', { x: ch.x + 50, y: boxY + boxH / 2 + 1, font: mf, color: 'rgba(23,10,54,0.4)', base: 'middle' });
    // send button
    const press = Math.max(0, 1 - Math.abs(t - M.send) / 0.1);
    const sbx = ch.x + ch.w - 20 - boxH / 2 - 6, sby = boxY + boxH / 2;
    g.beginPath(); g.arc(sbx, sby, boxH / 2 - 8 - press * 3, 0, Math.PI * 2); g.fillStyle = nTyped > 0 || sent ? C.violet : 'rgba(23,10,54,0.25)'; g.fill();
    ICONS.send(g, sbx + 1, sby, wide ? 24 : 26, C.white);
    // the messages, newest at the bottom (older ones move up)
    g.save();
    g.beginPath(); g.rect(ch.x, ch.y + barH + 3, ch.w, boxY - ch.y - barH - 6); g.clip();
    const bf = { f: 'sans', w: 500, s: wide ? 28 : 30 };
    const maxW = ch.w * 0.72;
    const bottom = boxY - 22;
    const items = [];
    if (sent) items.push({ kind: 'mine', at: M.send, h: bubble(g, mine, { x: 0, y: 0, maxW, font: bf, measureOnly: true }).h });
    if (t >= M.typing && t < M.reply) items.push({ kind: 'dots', at: M.typing, h: 54 });
    if (t >= M.reply) items.push({ kind: 'hers', at: M.reply, h: bubble(g, hers, { x: 0, y: 0, maxW, font: bf, measureOnly: true }).h + 46 });
    let y = bottom;
    for (let k = items.length - 1; k >= 0; k--) {
      const it = items[k];
      const rise = E.outCubic(prog(t, it.at, it.at + 0.28));
      y -= it.h * rise;
      const yy = y + (1 - rise) * 40;
      if (it.kind === 'mine') bubble(g, mine, { x: ch.x + ch.w - 28, y: yy, maxW, font: bf, side: 'right', bg: C.violet, color: C.white, pop: 0.9 + 0.1 * rise, alpha: rise });
      else if (it.kind === 'dots') typingDots(g, ch.x + 28, yy, t, { s: wide ? 1 : 1.05, alpha: rise });
      else {
        bubble(g, hers, { x: ch.x + 28, y: yy, maxW, font: bf, side: 'left', bg: C.white, pop: 0.9 + 0.1 * rise, alpha: rise });
        const hh = bubble(g, hers, { x: 0, y: 0, maxW, font: bf, measureOnly: true }).h;
        pill(g, 'mood: happy', { x: ch.x + 30, y: yy + hh + 26, align: 'left', font: { f: 'mono', w: 600, s: wide ? 17 : 19 }, bg: C.paper, color: 'rgba(23,10,54,0.75)', lw: 1.5, spacing: 0.5, alpha: ep(t, M.reply + 0.25, M.reply + 0.5) });
      }
      y -= 22;
    }
    g.restore();
    g.restore();

    // ---- what she does: her natural voice, voice calls, she reacts to every reply ----
    const P = L.pills;
    const icons = [ICONS.speaker, ICONS.call, ICONS.heart];
    const colors = [C.white, C.honey, C.mint];
    const pf = { f: 'sans', w: 700, s: wide ? 25 : 24 };
    const widths = V.pills.map((s) => measure(g, s, pf) + pf.s * 1.9 + pf.s * 1.35);
    const gap = wide ? 18 : 12;
    const total = widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1);
    let px = P.center ? P.x - total / 2 : P.x;
    V.pills.forEach((s, k) => {
      const t0 = M.pills[k];
      const sp = spring(t, t0, { freq: 2.6, damp: 0.45 });
      if (t > t0) {
        g.save();
        const mx = px + widths[k] / 2;
        g.translate(mx, P.y); g.scale(sp, sp); g.translate(-mx, -P.y);
        pill(g, s, { x: px, y: P.y, align: 'left', font: pf, bg: colors[k], icon: icons[k], shadow: 5, spacing: 0, h: pf.s * 2.3 });
        g.restore();
      }
      px += widths[k] + gap;
    });
  },
};
