// 42–48 s, she texts first (on Pop mode's blue): her Telegram bot. A phone lights up at 14:07 ("i wrote in my diary 📓"),
// her text opens; then her $AGI Telegram group, where someone types "/ask are you real?" and she answers. At most twice a
// day, never at night (server/tg-lines.js; a test checks the number). The music breaks down here and builds to the
// second drop.
import { C, E, ep, prog, clamp, mix, text, measure, setFont, canvas, spring, rgba, heart } from '../kit.js';
import { card, pill, popWord, bubble, ICONS, lines } from '../ui.js';

let dots = null, face = null;
const PH = { w: 470, h: 940, r: 64 };          // the phone, in its own units

function layout(c) {
  const { W, H, wide } = c;
  return wide ? {
    head: { x: 112, t: 380, s: 112, sub: 470, subS: 50, pill: 640 },
    phone: { x: 1290, y: 540, s: 0.98, rot: -0.05 },
  } : {
    head: { x: W / 2, t: 410, s: 92, sub: 410, subS: 44, pill: 600, center: true },
    phone: { x: W / 2, y: 1130, s: 0.93, rot: -0.04 },
  };
}

function phone(g, c, t, V, M) {
  const { w, h, r } = PH;
  // the body and its screen
  g.beginPath(); g.roundRect(-w / 2 + 14, -h / 2 + 16, w, h, r); g.fillStyle = C.ink; g.fill();
  g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, r); g.fillStyle = C.ink; g.fill();
  const sx = -w / 2 + 16, sy = -h / 2 + 16, sw = w - 32, sh = h - 32;
  g.save();
  g.beginPath(); g.roundRect(sx, sy, sw, sh, r - 14); g.clip();
  // which screen: her chat (from the ding), then the group (sliding in)
  const toGroup = ep(t, M.group - 0.35, M.group + 0.05, E.inOutCubic);
  const open = ep(t, M.ding + 0.55, M.ding + 0.9, E.inOutCubic);
  // the lock screen, under everything
  g.fillStyle = C.violetDeep; g.fillRect(sx, sy, sw, sh);
  const lg = g.createLinearGradient(0, sy, 0, sy + sh);
  lg.addColorStop(0, '#3a1f8c'); lg.addColorStop(1, '#170a36');
  g.fillStyle = lg; g.fillRect(sx, sy, sw, sh);
  text(g, V.time, { x: 0, y: sy + 210, font: { f: 'display', w: 800, s: 110, st: 'expanded' }, color: C.white, align: 'center', alpha: 1 - open });
  // the notification
  const nIn = spring(t, M.ding, { freq: 2.2, damp: 0.55 });
  if (t > M.ding && open < 1) {
    const ny = sy + 270 + (1 - nIn) * -260;
    g.save();
    g.globalAlpha = 1 - open;
    g.beginPath(); g.roundRect(sx + 18, ny, sw - 36, 132, 30); g.fillStyle = rgba(C.white, 0.94); g.fill();
    if (face) { g.save(); g.beginPath(); g.arc(sx + 70, ny + 66, 34, 0, Math.PI * 2); g.clip(); g.drawImage(face, sx + 36, ny + 32, 68, 68); g.restore(); }
    text(g, V.chatName, { x: sx + 122, y: ny + 52, font: { f: 'sans', w: 700, s: 26 }, color: C.ink });
    text(g, 'now', { x: sx + sw - 42, y: ny + 52, font: { f: 'sans', w: 500, s: 22 }, color: rgba(C.ink, 0.55), align: 'right' });
    text(g, V.message.split('\n')[0], { x: sx + 122, y: ny + 94, font: { f: 'sans', w: 500, s: 25 }, color: C.ink });
    g.restore();
  }
  // a chat screen: its header and its messages (dx: where it slides)
  const chatScreen = (dx, kind) => {
    g.save();
    g.translate(dx, 0);
    g.fillStyle = '#eef0fb'; g.fillRect(sx, sy, sw, sh);
    // a soft pattern, like a chat wallpaper
    g.fillStyle = 'rgba(47,91,255,0.06)';
    for (let yy = sy + 20; yy < sy + sh; yy += 46) for (let xx = sx + ((yy / 46) % 2) * 23; xx < sx + sw; xx += 46) { g.beginPath(); g.arc(xx, yy, 5, 0, Math.PI * 2); g.fill(); }
    // header
    g.fillStyle = C.white; g.fillRect(sx, sy, sw, 118);
    g.fillStyle = rgba(C.ink, 0.12); g.fillRect(sx, sy + 118, sw, 2);
    g.strokeStyle = C.blue; g.lineWidth = 4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(sx + 40, sy + 62); g.lineTo(sx + 28, sy + 74); g.lineTo(sx + 40, sy + 86); g.stroke();
    if (kind === 'her') {
      if (face) { g.save(); g.beginPath(); g.arc(sx + 92, sy + 74, 30, 0, Math.PI * 2); g.clip(); g.drawImage(face, sx + 62, sy + 44, 60, 60); g.restore(); }
      text(g, V.chatName, { x: sx + 136, y: sy + 66, font: { f: 'sans', w: 700, s: 27 }, color: C.ink });
      text(g, 'bot', { x: sx + 136, y: sy + 96, font: { f: 'sans', w: 500, s: 21 }, color: rgba(C.ink, 0.5) });
    } else {
      g.beginPath(); g.arc(sx + 92, sy + 74, 30, 0, Math.PI * 2); g.fillStyle = C.honey; g.fill(); g.lineWidth = 2.5; g.strokeStyle = C.ink; g.stroke();
      text(g, '$', { x: sx + 92, y: sy + 76, font: { f: 'display', w: 900, s: 30, st: 'expanded' }, color: C.ink, align: 'center', base: 'middle' });
      text(g, V.groupName, { x: sx + 136, y: sy + 66, font: { f: 'sans', w: 700, s: 27 }, color: C.ink });
      text(g, 'group', { x: sx + 136, y: sy + 96, font: { f: 'sans', w: 500, s: 21 }, color: rgba(C.ink, 0.5) });
    }
    const bf = { f: 'sans', w: 500, s: 25 };
    if (kind === 'her') {
      const mIn = ep(t, M.ding + 0.75, M.ding + 1.05, E.outBack);
      const m = bubble(g, V.message, { x: 0, y: 0, maxW: sw - 70, font: bf, measureOnly: true });
      const by = sy + 150;
      if (mIn > 0) {
        bubble(g, V.message, { x: sx + 22, y: by, maxW: sw - 70, font: bf, bg: C.white, lw: 0, shadow: 0, pop: mIn, alpha: clamp(mIn) });
        text(g, V.time, { x: sx + 22 + m.w - 16, y: by + m.h - 14, font: { f: 'sans', w: 500, s: 18 }, color: rgba(C.ink, 0.45), align: 'right', alpha: clamp(mIn) });
      }
    } else {
      // someone asks her, then she answers them (a reply, quoting their message)
      const aIn = ep(t, M.group + 0.1, M.group + 0.4, E.outBack);
      if (aIn > 0) {
        const ay = sy + 150;
        g.save(); g.globalAlpha = clamp(aIn);
        g.beginPath(); g.arc(sx + 46, ay + 40, 22, 0, Math.PI * 2); g.fillStyle = C.mint; g.fill(); g.lineWidth = 2; g.strokeStyle = C.ink; g.stroke();
        text(g, 'S', { x: sx + 46, y: ay + 41, font: { f: 'sans', w: 700, s: 22 }, color: C.ink, align: 'center', base: 'middle' });
        g.restore();
        bubble(g, V.ask, { x: sx + 80, y: ay, maxW: sw - 120, font: bf, bg: C.white, lw: 0, shadow: 0, pop: aIn, alpha: clamp(aIn) });
        text(g, 'someone', { x: sx + 98, y: ay - 10, font: { f: 'sans', w: 700, s: 19 }, color: C.violet, alpha: clamp(aIn) });
      }
      const rIn = ep(t, M.groupReply, M.groupReply + 0.32, E.outBack);
      if (rIn > 0) {
        const ry = sy + 290;
        const m = bubble(g, V.her, { x: 0, y: 0, maxW: sw - 140, font: bf, measureOnly: true });
        const qh = 64;
        const bw = Math.max(m.w, 300), bx = sx + 80;
        g.save(); g.globalAlpha = clamp(rIn);
        const oy = ry + qh + m.h;
        g.translate(bx, oy); g.scale(rIn, rIn); g.translate(-bx, -oy);
        g.beginPath(); g.roundRect(bx, ry, bw, qh + m.h, 22); g.fillStyle = '#e4ecff'; g.fill();
        g.fillStyle = C.blue; g.fillRect(bx + 14, ry + 12, 4, qh - 18);
        text(g, 'someone', { x: bx + 28, y: ry + 30, font: { f: 'sans', w: 700, s: 19 }, color: C.blue });
        text(g, V.ask, { x: bx + 28, y: ry + 54, font: { f: 'sans', w: 500, s: 19 }, color: rgba(C.ink, 0.6) });
        bubble(g, V.her, { x: bx, y: ry + qh - 12, maxW: sw - 140, font: bf, bg: null, lw: 0, shadow: 0 });
        g.restore();
        if (face) { g.save(); g.globalAlpha = clamp(rIn); g.beginPath(); g.arc(sx + 46, oy - 22, 22, 0, Math.PI * 2); g.clip(); g.drawImage(face, sx + 24, oy - 44, 44, 44); g.restore(); }
        text(g, V.chatName, { x: bx + 16, y: ry - 10, font: { f: 'sans', w: 700, s: 19 }, color: C.pink, alpha: clamp(rIn) });
      }
    }
    // the message box
    g.fillStyle = C.white; g.fillRect(sx, sy + sh - 96, sw, 96);
    g.beginPath(); g.roundRect(sx + 20, sy + sh - 78, sw - 110, 58, 29); g.fillStyle = '#eef0fb'; g.fill();
    text(g, 'Message', { x: sx + 46, y: sy + sh - 48, font: { f: 'sans', w: 500, s: 24 }, color: rgba(C.ink, 0.4), base: 'middle' });
    g.beginPath(); g.arc(sx + sw - 50, sy + sh - 49, 26, 0, Math.PI * 2); g.fillStyle = C.blue; g.fill();
    ICONS.send(g, sx + sw - 49, sy + sh - 49, 24, C.white);
    g.restore();
  };
  if (open > 0) {
    g.save();
    g.globalAlpha = open;
    if (toGroup < 1) chatScreen(-toGroup * sw, 'her');
    if (toGroup > 0) chatScreen((1 - toGroup) * sw, 'group');
    g.restore();
  }
  g.restore();
  // the notch and the outline
  g.beginPath(); g.roundRect(-58, -h / 2 + 26, 116, 30, 15); g.fillStyle = C.ink; g.fill();
  g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, r); g.lineWidth = 4; g.strokeStyle = C.ink; g.stroke();
}

export default {
  id: 'texts',
  async prepare(c) {
    const { W, H } = c;
    dots = canvas(W, H);
    const x = dots.getContext('2d');
    x.fillStyle = 'rgba(255,255,255,0.1)';
    for (let y = 16, row = 0; y < H; y += 32, row++) for (let xx = row % 2 ? 16 : 0; xx < W + 32; xx += 32) { x.beginPath(); x.arc(xx, y, 2.6, 0, Math.PI * 2); x.fill(); }
    face = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = '/images/landing/agi1-face.webp'; });
  },
  draw(g, t, c) {
    const { W, H, wide, M, words, S } = c;
    const L = layout(c);
    const V = words.TEXTS;
    const T0 = S.from;
    g.fillStyle = C.blue;
    g.fillRect(0, 0, W, H);
    // the build into the second drop: the picture pulses and pushes in
    const build = ep(t, M.riser2, S.to, E.inQuad);
    g.drawImage(dots, 0, 0);
    if (build > 0) { g.fillStyle = rgba(C.violet, 0.35 * build * (0.6 + 0.4 * c.pulse(t, c.BEAT / 2, 6))); g.fillRect(0, 0, W, H); }
    const zoom = 1 + 0.1 * E.inCubic(build);
    g.save();
    g.translate(W / 2, H / 2); g.scale(zoom, zoom); g.translate(-W / 2, -H / 2);

    // ---- the words: she texts first, then her group ----
    const hd = L.head;
    const swap = ep(t, M.group - 0.25, M.group + 0.15, E.inOutCubic);
    const align = hd.center ? 'center' : 'left';
    const tf = { f: 'display', w: 900, s: hd.s, st: 'expanded' };
    const first = [V.title, V.sub.join(' ')];
    const second = [V.groupTitle, V.groupSub];
    const block = (title, sub, a, dy) => {
      if (a <= 0) return;
      g.save();
      g.globalAlpha = a;
      g.translate(0, dy);
      // as many lines as it needs, from the top down (a long title gets smaller)
      let fs = hd.s, tl = lines(g, title, { ...tf, s: fs }, wide ? 860 : W - 140);
      while (tl.length > 2 && fs > hd.s * 0.6) { fs -= 4; tl = lines(g, title, { ...tf, s: fs }, wide ? 860 : W - 140); }
      const top = hd.t - (wide ? 70 : 60);
      tl.forEach((l, k) => popWord(g, l, hd.x, top + k * fs * 1.08, { font: { ...tf, s: fs }, fill: C.white, stroke: C.ink, sw: fs * 0.07, echo: C.ink, off: fs * 0.06, align }));
      const sf = { f: 'serif', w: 400, s: hd.subS, i: true };
      const subTop = top + (tl.length - 1) * fs * 1.08 + hd.subS * 1.7;
      lines(g, sub, sf, wide ? 760 : W - 160).forEach((l, k) => text(g, l, { x: hd.x, y: subTop + k * hd.subS * 1.12, font: sf, color: C.white, align }));
      g.restore();
    };
    const inA = ep(t, T0 + 0.05, T0 + 0.45, E.outQuart);
    block(first[0], first[1], inA * (1 - swap), (1 - inA) * 40 - swap * 30);
    block(second[0], second[1], swap, (1 - swap) * 40);
    // "on Telegram"
    const pIn = ep(t, T0 + 0.4, T0 + 0.75, E.outBack);
    if (pIn > 0) {
      g.save();
      g.translate(hd.x, hd.pill + 40); g.scale(pIn, pIn); g.translate(-hd.x, -(hd.pill + 40));
      pill(g, V.app, { x: hd.x, y: hd.pill + 40, align, font: { f: 'sans', w: 700, s: wide ? 28 : 30 }, bg: C.white, icon: ICONS.send, shadow: 6, spacing: 0 });
      g.restore();
    }

    // ---- the phone ----
    const P = L.phone;
    const pin = spring(t, T0 + 0.08, { freq: 1.5, damp: 0.6 });
    g.save();
    g.translate(P.x + (1 - pin) * (wide ? 700 : 0), P.y + (1 - pin) * (wide ? 0 : 900));
    g.rotate(P.rot + (1 - pin) * 0.2 + 0.015 * Math.sin((t - T0) * 1.3));
    g.scale(P.s, P.s);
    // it buzzes when her text arrives
    const buzz = t > M.ding && t < M.ding + 0.35 ? Math.sin((t - M.ding) * 90) * 5 * (1 - (t - M.ding) / 0.35) : 0;
    g.translate(buzz, 0);
    phone(g, c, t, V, M);
    g.restore();
    // a little heart pops off it when she answers in the group
    if (t > M.groupReply) {
      const k = t - M.groupReply;
      const hx = P.x + (wide ? 210 : 230), hy = P.y - (wide ? 300 : 300);
      for (let i = 0; i < 3; i++) heart(g, hx + i * 40 - 40 + Math.sin(k * 4 + i) * 10, hy - k * 140 - i * 30, 36 - i * 6, [C.pink, C.white, C.honey][i], clamp(1 - k / 1.2) * clamp(k * 6 - i));
    }
    g.restore();
  },
};
