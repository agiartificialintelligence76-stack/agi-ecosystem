// 13. The community (84–90 s): "Share it. Get liked." Explore's wall of everyone's influencers, photos and videos,
// scrolling; hearts land on six of them (no numbers). Then the most liked lifts out of the wall into a gold frame:
// "Spotlight of the week". Then "Gifts & invites.": a gift card claimed, an invite link. No prize, no money words.
import { S, backdrop, headline, say, pill, glow, icon, goButton, pointer, ripple, heartPop, bolt } from '../look.js';
import { popK, around, E, prog, clamp, mix, text, rr, panel, grad, GRAD, media, captionFade, clipCard, measure } from '../parts.js';
import { COMMUNITY, CAST } from '../../words.js';

// Explore's wall: four columns, each a little lower than the one before, scrolling up slowly
const COLS = [
  ['nova-beach', 'kai-neon-video', 'mika-flowers', 'juno-meme', 'nova-look-3'],
  ['nova-golden-trend', 'juno-gaming', 'kai-meme', 'mika-video', 'nova-cafe'],
  ['mika-snow', 'nova-cafe-video', 'kai-look-2', 'juno-confetti-trend', 'mika-look-2'],
  ['kai-gaming', 'mika-rain-trend', 'nova-look-2', 'juno-look-2', 'kai-body'],
];
const CLIPS = new Set(['kai-neon-video', 'nova-golden-trend', 'mika-video', 'nova-cafe-video', 'juno-confetti-trend', 'mika-rain-trend']);
const TW = 302, TH = 380, GAP = 24, X0 = 80, Y0 = 262;
const PHASE = [0, 120, 46, 170];
const SPEED = 30;                                              // px a second
const LIKED = [[1, 0], [0, 0], [2, 0], [3, 0], [0, 1], [2, 1]]; // [column, row]: a heart at each of the hearts' moments
const SPOT = [1, 0];                                           // the most liked: Nova's golden hour trend video
const whoOf = (name) => name.split('-')[0];
const LOOK = { nova: 'nova-look-1', kai: 'kai-look-1', mika: 'mika-look-1', juno: 'juno-look-1' };

const tileAt = (t, M, col, row) => ({
  x: X0 + col * (TW + GAP),
  y: Y0 + row * (TH + GAP) + PHASE[col] - (t - M.likesWall) * SPEED,
  w: TW, h: TH,
});

function tile(g, c, t, M, name, x, y, w, h, { liked = null, sc = 1 } = {}) {
  if (CLIPS.has(name)) clipCard(g, c, name, t, M.likesWall - 0.3, x, y, w, h, { r: 18 * sc, lw: 1.2, line: S.line2 });
  else media(g, c.media.pic(name), x, y, w, h, { r: 18 * sc, focus: [0.5, 0.32], lw: 1.2 });
  captionFade(g, x, y, w, h, 18 * sc, 0.3, 0.75);
  // who made it
  const who = whoOf(name), ax = x + 16 * sc + 15 * sc, ay = y + h - 30 * sc;
  g.save(); g.beginPath(); g.arc(ax, ay, 15 * sc, 0, Math.PI * 2); g.clip();
  media(g, c.media.pic(LOOK[who]), ax - 15 * sc, ay - 15 * sc, 30 * sc, 30 * sc, { r: 0, lw: 0, focus: [0.5, 0.3] });
  g.restore();
  g.beginPath(); g.arc(ax, ay, 15 * sc, 0, Math.PI * 2); g.lineWidth = 1.5; g.strokeStyle = 'rgba(255,255,255,0.6)'; g.stroke();
  text(g, CAST[who].name, { x: ax + 24 * sc, y: ay + 7 * sc, font: { f: 'sans', w: 650, s: 19 * sc }, color: '#fff' });
  // its heart
  const hx = x + w - 30 * sc, hy = y + h - 30 * sc;
  g.beginPath(); g.arc(hx, hy, 21 * sc, 0, Math.PI * 2); g.fillStyle = 'rgba(0,0,0,0.42)'; g.fill();
  if (liked == null || t < liked) icon(g, 'heart', hx, hy + sc, 24 * sc, 'rgba(255,255,255,0.92)', { lw: 2 });
  else {
    heartPop(g, hx, hy + sc, t, liked, { size: 24 * sc });
    // a few more float up from it
    for (let i = 0; i < 3; i++) {
      const q = prog(t, liked + 0.06 + i * 0.12, liked + 0.95 + i * 0.12);
      if (q <= 0 || q >= 1) continue;
      icon(g, 'heart', hx + Math.sin(i * 2.3 + q * 4) * 18 * sc, hy - 150 * sc * E.outCubic(q), (20 - 8 * q) * sc, i % 2 ? S.fuchsia : S.pink, { fill: true, lw: 1, alpha: 1 - E.inQuad(q) });
    }
  }
}

export default {
  draw(g, t, c) {
    const { W, H, M } = c;
    backdrop(g, W, H, t, { a: 0.75, b: 0.8, ax: 0.8, ay: 0.1, bx: 0.15, by: 0.9 });
    const lift = E.inOutCubic(prog(t, M.spotlight, M.spotlight + 0.55));       // the spotlight lifts out of the wall
    const away = E.inCubic(prog(t, M.gifts - 0.35, M.gifts + 0.05));            // and leaves for the gifts

    // ---- Explore's wall ----
    COLS.forEach((col, ci) => col.forEach((name, ri) => {
      const r = tileAt(t, M, ci, ri);
      if (r.y > H || r.y + r.h < 180) return;
      if (ci === SPOT[0] && ri === SPOT[1] && lift > 0) return;
      const li = LIKED.findIndex(([a, b]) => a === ci && b === ri);
      // the wall is there as the push brings it in (the scene is never drawn before M.likesWall); its words come after
      tile(g, c, t, M, name, r.x, r.y, r.w, r.h, { liked: li >= 0 ? M.hearts[li] : null });
    }));
    // what's above the wall stays clear for the words; the wall dims for the spotlight and the gifts
    const top = g.createLinearGradient(0, 160, 0, 290);
    top.addColorStop(0, 'rgba(9,9,11,1)'); top.addColorStop(1, 'rgba(9,9,11,0)');
    g.fillStyle = top; g.fillRect(0, 0, W, 290);
    g.fillStyle = 'rgba(9,9,11,1)'; g.fillRect(0, 0, W, 160);
    const dim = 0.8 * E.inOutCubic(prog(t, M.spotlight, M.spotlight + 0.45)) + 0.1 * E.inOutCubic(prog(t, M.gifts - 0.3, M.gifts));
    if (dim > 0) { g.fillStyle = `rgba(9,9,11,${dim})`; g.fillRect(0, 0, W, H); }

    headline(g, COMMUNITY.head, t, M.likesWall, { x: 80, y: 140, size: 88, out: M.spotlight - 0.3, outDur: 0.3 });
    const sp = E.outCubic(prog(t, M.likesWall + 0.3, M.likesWall + 0.7)) * (1 - E.inCubic(prog(t, M.spotlight - 0.3, M.spotlight)));
    say(g, COMMUNITY.sub, { x: 80, y: 206 + (1 - sp) * 10, size: 28, weight: 500, color: S.text2, alpha: sp });

    // ---- the spotlight of the week ----
    if (lift > 0 && away < 1) {
      const from = tileAt(t, M, SPOT[0], SPOT[1]);
      const w = mix(from.w, 420, lift), h = mix(from.h, 528, lift);
      const cx = mix(from.x + from.w / 2, W / 2, lift), cy = mix(from.y + from.h / 2, 588, lift) - away * 40;
      const k = 1 - away;
      g.save();
      g.globalAlpha *= k;
      const gl = E.outCubic(prog(t, M.spotlight + 0.3, M.spotlight + 0.8));
      glow(g, cx, cy, 520, 'rgba(251,191,36,0.32)', gl);
      // rays behind it
      if (gl > 0) {
        g.save(); g.translate(cx, cy); g.rotate(t * 0.25);
        for (let i = 0; i < 14; i++) {
          g.rotate(Math.PI / 7);
          g.beginPath(); g.moveTo(0, 0); g.lineTo(-28, -560); g.lineTo(28, -560); g.closePath();
          g.fillStyle = `rgba(253,230,138,${0.05 * gl})`; g.fill();
        }
        g.restore();
      }
      const sc = mix(1, 420 / 302, lift);
      tile(g, c, t, M, COLS[SPOT[0]][SPOT[1]], cx - w / 2, cy - h / 2, w, h, { liked: M.hearts[0], sc });
      // its gold frame
      rr(g, cx - w / 2 - 6, cy - h / 2 - 6, w + 12, h + 12, 24);
      g.lineWidth = 7 * gl; g.strokeStyle = grad(g, cx - w / 2, cy - h / 2, w, h, GRAD.gold, 135);
      if (gl > 0) g.stroke();
      // its trophy
      const tp = popK(t, M.spotlight + 0.35, 0.5);
      if (tp > 0) around(g, cx, cy - h / 2 - 6, { sc: tp }, () => {
        g.beginPath(); g.arc(0, 0, 38, 0, Math.PI * 2);
        g.fillStyle = grad(g, -38, -38, 76, 76, GRAD.gold, 135); g.fill();
        g.lineWidth = 4; g.strokeStyle = '#1a1206'; g.stroke();
        icon(g, 'trophy', 0, 1, 40, '#3b2a06', { lw: 2.4 });
      });
      // sparkles as it lands
      const sk = prog(t, M.spotlight + 0.45, M.spotlight + 1.15);
      if (sk > 0 && sk < 1) for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + 0.4, d = 280 + E.outCubic(sk) * (60 + (i % 3) * 40);
        around(g, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 1.15, { alpha: 1 - sk, sc: 1 - sk * 0.4 }, () => icon(g, 'spark', 0, 0, 26, i % 2 ? S.gold : S.honey, { fill: true }));
      }
      // hearts keep coming
      for (let i = 0; i < 7; i++) {
        const t0 = M.spotlight + 0.5 + i * 0.19, q = prog(t, t0, t0 + 1.1);
        if (q <= 0 || q >= 1) continue;
        const side = i % 2 ? 1 : -1;
        icon(g, 'heart', cx + side * (w / 2 + 40 + (i % 3) * 22) + Math.sin(q * 5 + i) * 10, cy + h / 2 - 60 - 260 * E.outCubic(q), 30 - 10 * q, i % 3 ? S.pink : S.fuchsia, { fill: true, lw: 1, alpha: 1 - E.inQuad(q) });
      }
      g.restore();
    }
    if (t >= M.spotlight - 0.05) {
      headline(g, COMMUNITY.spotlight, t, M.spotlight + 0.05, { x: W / 2, y: 150, size: 76, align: 'center', out: M.gifts - 0.4, outDur: 0.3 });
      const np = E.outCubic(prog(t, M.spotlight + 0.55, M.spotlight + 0.95)) * (1 - away);
      say(g, COMMUNITY.spotNote, { x: W / 2, y: 924 + (1 - np) * 10, size: 30, weight: 500, color: S.text2, align: 'center', alpha: np });
    }

    // ---- gifts and invites ----
    if (t >= M.gifts - 0.05) {
      headline(g, COMMUNITY.gifts, t, M.gifts, { x: 80, y: 140, size: 88 });
      // a gift card, claimed
      const gp = popK(t, M.gifts + 0.08, 0.5);
      const G = { x: 80, y: 250, w: 600, h: 560 };
      if (gp > 0) around(g, G.x + G.w / 2, G.y + G.h / 2 + (1 - clamp(gp)) * 50, { sc: 0.94 + 0.06 * gp, alpha: clamp(gp) }, () => {
        const ox = -G.w / 2, oy = -G.h / 2;
        glow(g, 0, -60, 380, 'rgba(251,191,36,0.2)', 1);
        panel(g, ox, oy, G.w, G.h, { r: 28, fill: S.panel, line: 'rgba(251,191,36,0.4)', lw: 2 });
        const bob = Math.sin((t - M.gifts) * 6) * 4 * Math.exp(-(t - M.gifts) * 1.5);
        rr(g, ox + 40, oy + 40 + bob, 92, 92, 26); g.fillStyle = grad(g, ox + 40, oy + 40, 92, 92, GRAD.gold, 135); g.fill();
        icon(g, 'gift', ox + 86, oy + 86 + bob, 52, '#3b2a06', { lw: 2.2 });
        text(g, COMMUNITY.giftCard, { x: ox + 40, y: oy + 196, font: { f: 'sans', w: 800, s: 40 }, color: S.text, spacing: -0.8 });
        text(g, COMMUNITY.giftFrom, { x: ox + 40, y: oy + 236, font: { f: 'sans', w: 550, s: 22 }, color: S.text3 });
        bolt(g, ox + 72, oy + 318, 54, S.honey);
        text(g, String(COMMUNITY.gift), { x: ox + 108, y: oy + 352, font: { f: 'sans', w: 850, s: 92 }, color: S.text, spacing: -2.5 });
        const nw = measure(g, String(COMMUNITY.gift), { f: 'sans', w: 850, s: 92 }, -2.5);
        text(g, 'credits', { x: ox + 120 + nw, y: oy + 350, font: { f: 'sans', w: 600, s: 28 }, color: S.text2 });
        // Claim, then claimed
        const done = E.outCubic(prog(t, M.claim + 0.12, M.claim + 0.4));
        const press = clamp(1 - Math.abs(t - M.claim) / 0.12);
        if (done < 1) goButton(g, COMMUNITY.claim, ox + 40, oy + 420, G.w - 80, { u: 1.6, ic: 'gift', align: 'center', press, alpha: 1 - done, size: 15 });
        if (done > 0) {
          around(g, 0, oy + 456, { sc: 0.9 + 0.1 * done, alpha: done }, () => {
            pill(g, COMMUNITY.claimed, 0, 0, { size: 26, align: 'center', ic: 'check', icColor: S.mint, bg: 'rgba(63,240,195,0.12)', line: 'rgba(63,240,195,0.55)', color: S.text, weight: 650, h: 66, padX: 26 });
          });
        }
      });
      // the pointer taps Claim
      const bx = G.x + G.w / 2 + 40, by = G.y + 420 + 35;
      const pp = E.inOutCubic(prog(t, M.claim - 0.35, M.claim));
      ripple(g, bx, by, t, M.claim, { r: 50, color: '251,191,36' });
      pointer(g, mix(bx + 150, bx, pp), mix(by + 170, by, pp), { s: 1.6, press: clamp(1 - Math.abs(t - M.claim) / 0.12), alpha: clamp(prog(t, M.claim - 0.45, M.claim - 0.3)) * (1 - clamp(prog(t, M.claim + 0.4, M.claim + 0.6))) });

      // an invite link
      const ip = popK(t, M.invite, 0.5);
      const I = { x: 760, y: 250, w: 600, h: 560 };
      if (ip > 0) around(g, I.x + I.w / 2, I.y + I.h / 2 + (1 - clamp(ip)) * 50, { sc: 0.94 + 0.06 * ip, alpha: clamp(ip) }, () => {
        const ox = -I.w / 2, oy = -I.h / 2;
        glow(g, 0, -60, 380, 'rgba(139,92,246,0.24)', 1);
        panel(g, ox, oy, I.w, I.h, { r: 28, fill: S.panel, line: 'rgba(167,139,250,0.45)', lw: 2 });
        rr(g, ox + 40, oy + 40, 92, 92, 26); g.fillStyle = grad(g, ox + 40, oy + 40, 92, 92, GRAD.brand, 135); g.fill();
        icon(g, 'invite', ox + 86, oy + 86, 50, '#fff', { lw: 2.2 });
        text(g, COMMUNITY.invite, { x: ox + 40, y: oy + 196, font: { f: 'sans', w: 800, s: 40 }, color: S.text, spacing: -0.8 });
        text(g, COMMUNITY.inviteNote, { x: ox + 40, y: oy + 236, font: { f: 'sans', w: 550, s: 22 }, color: S.text2 });
        // the link and Copy
        rr(g, ox + 40, oy + 300, I.w - 80, 70, 16); g.fillStyle = S.surface; g.fill(); g.lineWidth = 1.5; g.strokeStyle = S.line2; g.stroke();
        text(g, COMMUNITY.inviteLink, { x: ox + 62, y: oy + 342, font: { f: 'mono', w: 500, s: 19 }, color: S.text2 });
        // the two of you: bonus credits each
        const bp = E.outCubic(prog(t, M.invite + 0.3, M.invite + 0.65));
        COMMUNITY.both.forEach((who, k) => {
          const px = ox + 40 + k * 262;
          g.save(); g.globalAlpha *= bp; g.translate(0, (1 - bp) * 14);
          rr(g, px, oy + 410, 242, 96, 18); g.fillStyle = 'rgba(251,191,36,0.08)'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = 'rgba(251,191,36,0.35)'; g.stroke();
          text(g, who, { x: px + 22, y: oy + 448, font: { f: 'sans', w: 650, s: 21 }, color: S.text2 });
          bolt(g, px + 32, oy + 478, 22, S.honey);
          text(g, COMMUNITY.bonus, { x: px + 50, y: oy + 486, font: { f: 'sans', w: 700, s: 22 }, color: S.gold });
          g.restore();
        });
      });
      const np = E.outCubic(prog(t, M.invite + 0.35, M.invite + 0.75));
      say(g, COMMUNITY.giftNote, { x: W / 2, y: 900 + (1 - np) * 10, size: 28, weight: 500, color: S.text2, align: 'center', alpha: np });
    }
  },
};
