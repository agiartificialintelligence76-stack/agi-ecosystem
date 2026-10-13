// 11. A 3D model and a coin (72–78 s): "A 3D model that moves." From Juno's full body: shaped (a wireframe builds up,
// then its colors sweep up), given bones (its joints light up), taught moves (it eases from the pose it was made in into
// its move's stance); Wave is tapped and it waves. The figure is Juno's own 3D model, made for the video the way AGI
// Studio makes one (labeled "AI-generated" on it); if its file isn't there, her full body shows instead. Then "Launch a
// coin with its face.": a gold coin with her face flips and lands. The cut into paying opens from the coin.
import { S, backdrop, headline, say, pill, glow, icon, chip, pointer, ripple, costChip } from '../look.js';
import { card, popK, around, E, prog, clamp, mix, text, rr, media, grad, GRAD, panel } from '../parts.js';
import { MODEL } from '../../words.js';
import { loadModel3D } from '../model3d.js';

// 16:9 (the body at 205, the view at 410, its steps at 1062 and the coin at 720 in 4:3)
const LM = 120;
const BODY = { cx: LM + 125, cy: 590, w: 250, h: 448 };
const VP = { x: 560, y: 215, w: 620, h: 720 };                    // the 3D view
const COL = { x: 1290, y: 236, w: 380 };                           // its steps and moves
const COIN = { cx: 960, cy: 560, r: 205 };
const AR = { x0: BODY.cx + BODY.w / 2 + 14, x1: VP.x - 16 };       // the arrow from the body into the view
// its wave: its move's second at the tap on Wave, and how fast it plays (a little quicker than as it was made)
const WAVE_AT = 0.45, WAVE_SPEED = 1.25;
let fig = null;

function coin(g, c, t, M) {
  const inP = popK(t, M.coin + 0.05, 0.55);
  if (inP <= 0) return;
  // two full turns between the flip and the landing
  const fp = E.inOutCubic(prog(t, M.coinFlip, M.coinLand));
  const ang = fp * Math.PI * 4;
  const sx = Math.cos(ang);
  const land = t >= M.coinLand ? Math.exp(-(t - M.coinLand) * 7) * Math.sin((t - M.coinLand) * 26) : 0;
  const hop = Math.sin(Math.PI * fp) * 90;
  const { cx, cy, r } = COIN;
  glow(g, cx, cy, 420, 'rgba(251,191,36,0.28)', clamp(inP));
  // its shadow on the floor
  g.save(); g.globalAlpha = 0.45 * clamp(inP);
  g.beginPath(); g.ellipse(cx, cy + r + 46, r * (0.75 - hop / 900), 20, 0, 0, Math.PI * 2);
  g.fillStyle = 'rgba(0,0,0,0.5)'; g.fill(); g.restore();
  around(g, cx, cy - hop - land * 14, { sc: inP }, () => {
    g.save();
    g.scale(Math.max(0.02, Math.abs(sx)), 1 + land * 0.04);
    // its rim
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2);
    g.fillStyle = grad(g, -r, -r, r * 2, r * 2, GRAD.gold, 135); g.fill();
    g.beginPath(); g.arc(0, 0, r - 16, 0, Math.PI * 2);
    g.fillStyle = grad(g, -r, -r, r * 2, r * 2, [[0, '#b45309'], [0.5, '#f59e0b'], [1, '#92400e']], 300); g.fill();
    if (sx >= 0) {
      // the face: her look
      g.save(); g.beginPath(); g.arc(0, 0, r - 26, 0, Math.PI * 2); g.clip();
      media(g, c.media.pic('juno-look-1'), -(r - 26), -(r - 26), (r - 26) * 2, (r - 26) * 2, { r: 0, lw: 0, focus: [0.5, 0.42] });
      g.restore();
    } else {
      // the back: its ticker
      g.beginPath(); g.arc(0, 0, r - 26, 0, Math.PI * 2);
      g.fillStyle = grad(g, -r, -r, r * 2, r * 2, GRAD.gold, 45); g.fill();
      text(g, '$', { x: 0, y: 6, font: { f: 'sans', w: 900, s: 190 }, color: 'rgba(146,64,14,0.85)', align: 'center', base: 'middle' });
    }
    // a shine sweeping across as it lands
    const sh = prog(t, M.coinLand + 0.05, M.coinLand + 0.6);
    if (sh > 0 && sh < 1 && sx > 0) {
      g.save(); g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.clip();
      const xs = mix(-r * 1.6, r * 1.6, sh);
      const lg = g.createLinearGradient(xs - 70, -r, xs + 70, r);
      lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,255,255,0.5)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = lg; g.fillRect(-r, -r, r * 2, r * 2);
      g.restore();
    }
    g.restore();
  });
  // sparkles as it lands
  const sp = prog(t, M.coinLand, M.coinLand + 0.7);
  if (sp > 0 && sp < 1) {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + 0.3;
      const d = r + 30 + E.outCubic(sp) * (90 + (i % 3) * 30);
      around(g, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.9, { alpha: 1 - sp, sc: 1 - sp * 0.5 }, () => icon(g, 'spark', 0, 0, 26, i % 2 ? S.gold : S.honey, { fill: true }));
    }
  }
  // its ticker under it
  const tp = popK(t, M.coinLand + 0.1, 0.45);
  if (tp > 0) around(g, cx, cy + r + 50, { sc: tp, alpha: clamp(tp) }, () => pill(g, MODEL.ticker, 0, 0, { size: 30, mono: true, align: 'center', bg: 'rgba(24,18,8,0.92)', line: 'rgba(251,191,36,0.7)', color: S.gold, weight: 700 }));
}

export default {
  async prepare(c) {
    c.irisFrom.model = [COIN.cx, COIN.cy];
    fig = await loadModel3D(720).catch((e) => { console.warn('[studio-promo] no 3D model (her full body instead):', e.message); return null; });
  },
  draw(g, t, c) {
    const { W, H, M } = c;
    backdrop(g, W, H, t, { a: 0.7, b: 0.75, ax: 0.62, ay: 0.4, bx: 0.1, by: 0.9, hueB: t >= M.coin ? 'rgba(245,158,11,0.18)' : 'rgba(219,39,119,0.26)' });
    const leave = E.inCubic(prog(t, M.coin - 0.35, M.coin + 0.05));          // the 3D part leaves for the coin
    headline(g, MODEL.head, t, M.model, { x: LM, y: 140, size: 88, out: M.coin - 0.35, outDur: 0.3 });

    if (leave < 1) {
      g.save();
      g.globalAlpha = 1 - leave;
      g.translate(0, leave * 60);
      // ---- from its full body ----
      const bp = E.outCubic(prog(t, M.model + 0.05, M.model + 0.45));
      card(g, c.media.pic('juno-body'), BODY.cx, BODY.cy + (1 - bp) * 50, BODY.w, BODY.h, { r: 20, sh: 0.7, alpha: bp, focus: [0.5, 0.5] });
      pill(g, 'From its full body', BODY.cx, BODY.cy + BODY.h / 2 + 40, { size: 20, align: 'center', bg: 'rgba(12,12,15,0.86)', line: S.line2, alpha: bp, ic: 'image', icColor: S.accent });
      // its arrow into the 3D view
      const ap = E.inOutCubic(prog(t, M.model + 0.25, M.model + 0.5));
      if (ap > 0) {
        g.save(); g.lineWidth = 5; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = grad(g, AR.x0, BODY.cy - 3, AR.x1 - AR.x0, 6, GRAD.light, 90);
        g.beginPath(); g.moveTo(AR.x0, BODY.cy); g.lineTo(mix(AR.x0, AR.x1, ap), BODY.cy); g.stroke();
        if (ap > 0.95) { g.beginPath(); g.moveTo(AR.x1 - 14, BODY.cy - 13); g.lineTo(AR.x1 + 1, BODY.cy); g.lineTo(AR.x1 - 14, BODY.cy + 13); g.stroke(); }
        g.restore();
      }
      // ---- the 3D view ----
      const vp = E.outQuart(prog(t, M.model + 0.15, M.model + 0.6));
      around(g, VP.x + VP.w / 2, VP.y + VP.h / 2, { sc: mix(0.94, 1, vp), alpha: clamp(vp * 1.4) }, () => {
        const x = -VP.w / 2, y = -VP.h / 2;
        panel(g, x, y, VP.w, VP.h, { r: 26, fill: '#0c0b12', sh: 0.7 });
        // a soft light behind the figure
        g.save(); rr(g, x, y, VP.w, VP.h, 26); g.clip();
        glow(g, 0, -40, 380, 'rgba(139,92,246,0.3)', 1);
        // the figure
        const dw = VP.w, dh = VP.w;                                   // the render, square, at the top
        const dx = x, dy = y + 10;
        if (fig && t >= M.model) {
          const rotY = t < 73.6 ? -0.95 + (t - 72) * 0.9 : mix(0.49, 0.18, E.inOutCubic(prog(t, 73.6, 74.05))) + Math.sin((t - 74) * 1.2) * 0.04 * (t > 74 ? 1 : 0);
          const st = {
            rotY,
            reveal: E.inOutCubic(prog(t, M.modelSteps[0], M.modelSteps[0] + 0.42)),
            sweep: E.inOutCubic(prog(t, M.modelSteps[0] + 0.36, M.modelSteps[1] + 0.12)),
            // taught moves: from the pose it was made in to its move's stance, which plays on into the wave at the tap
            pose: E.inOutCubic(prog(t, M.modelSteps[2], M.modelSteps[2] + 0.45)),
            clip: Math.max(0, WAVE_AT + (t - M.wave) * WAVE_SPEED),
          };
          g.drawImage(fig.render(st), dx, dy, dw, dh);
          // its bones, lit up while it's given them
          const ba = E.outCubic(prog(t, M.modelSteps[1], M.modelSteps[1] + 0.2)) * (1 - E.inCubic(prog(t, M.modelSteps[2] + 0.05, M.modelSteps[2] + 0.35)));
          if (ba > 0) {
            const js = fig.jointsOnScreen(), k = dw / fig.size;
            const P = (n) => [dx + js[n][0] * k, dy + js[n][1] * k];
            g.save(); g.globalAlpha *= ba;
            g.lineWidth = 3.5; g.strokeStyle = 'rgba(63,240,195,0.9)'; g.lineCap = 'round';
            for (const [a, b] of fig.bones) { const [x0, y0] = P(a), [x1, y1] = P(b); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
            for (const n of Object.keys(js)) { const [px, py] = P(n); g.beginPath(); g.arc(px, py, 6, 0, Math.PI * 2); g.fillStyle = '#eafff8'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = S.mint; g.stroke(); }
            g.restore();
          }
        } else if (t >= M.modelSteps[1]) {
          media(g, c.media.pic('juno-body'), dx + dw / 2 - 170, dy + 40, 340, dh - 80, { r: 18, focus: [0.5, 0.5] });
        }
        g.restore();
        // its footer: the name and "AI-generated"
        g.fillStyle = S.line; g.fillRect(x, y + VP.h - 70, VP.w, 1.2);
        icon(g, 'cube', x + 34, y + VP.h - 35, 26, S.accent);
        text(g, 'Juno · 3D model', { x: x + 58, y: y + VP.h - 26, font: { f: 'sans', w: 700, s: 24 }, color: S.text });
        pill(g, 'AI-generated', x + VP.w - 24, y + VP.h - 35, { size: 15, align: 'right', mono: true, bg: 'rgba(255,255,255,0.06)', line: S.line2, color: S.text3 });
      });

      // ---- its steps, then its moves ----
      MODEL.steps.forEach((s, k) => {
        const t0 = M.modelSteps[k], done = k < 2 ? M.modelSteps[k + 1] : M.wave - 0.1;
        const p = E.outCubic(prog(t, t0 - 0.05, t0 + 0.25));
        if (p <= 0) return;
        const y = COL.y + 30 + k * 66;
        g.save(); g.globalAlpha *= p; g.translate((1 - p) * 30, 0);
        const fin = t >= done;
        g.beginPath(); g.arc(COL.x + 18, y, 17, 0, Math.PI * 2);
        if (fin) { g.fillStyle = grad(g, COL.x, y - 17, 36, 34, GRAD.light, 135); g.fill(); icon(g, 'check', COL.x + 18, y, 20, '#fff', { lw: 3 }); }
        else {
          g.lineWidth = 3; g.strokeStyle = S.line3; g.stroke();
          g.beginPath(); g.arc(COL.x + 18, y, 17, t * 7, t * 7 + 1.7); g.strokeStyle = S.accent; g.stroke();
        }
        text(g, s, { x: COL.x + 48, y: y + 9, font: { f: 'sans', w: 650, s: 26 }, color: fin ? S.text : S.text2 });
        g.restore();
      });
      // its moves
      const mp = E.outCubic(prog(t, M.modelSteps[2] + 0.1, M.modelSteps[2] + 0.4));
      if (mp > 0) {
        g.save(); g.globalAlpha *= mp;
        text(g, 'TYPE A MOVE', { x: COL.x, y: COL.y + 268, font: { f: 'sans', w: 650, s: 16 }, color: S.text3, spacing: 1.4 });
        let x = COL.x, y = COL.y + 312;
        MODEL.moves.forEach((m, i) => {
          const w = chip(g, m, 0, 0, { u: 1.5, measureOnly: true, size: 15 }).w;
          if (x + w > COL.x + COL.w) { x = COL.x; y += 58; }
          const on = i === 0 ? E.outCubic(prog(t, M.wave, M.wave + 0.15)) : 0;
          chip(g, m, x, y - 24, { u: 1.5, on, size: 15 });
          x += w + 10;
        });
        g.restore();
        // the pointer taps Wave
        const wx = COL.x + 40, wy = COL.y + 312;
        const pp = E.inOutCubic(prog(t, M.wave - 0.4, M.wave));
        ripple(g, wx, wy, t, M.wave, { r: 44 });
        pointer(g, mix(wx + 160, wx, pp), mix(wy + 170, wy, pp), { s: 1.6, press: clamp(1 - Math.abs(t - M.wave) / 0.12), alpha: clamp(prog(t, M.wave - 0.55, M.wave - 0.35)) });
        // what it costs, and its file
        const cp = popK(t, M.wave + 0.3, 0.45);
        if (cp > 0) {
          around(g, COL.x, COL.y + 480, { sc: cp, alpha: clamp(cp) }, () => {
            pill(g, 'A 3D model', 0, 0, { size: 21, bg: 'rgba(12,12,15,0.86)', line: S.line2 });
            costChip(g, MODEL.cost, 158, 0, { u: 1.7, align: 'left', bg: 'rgba(255,255,255,0.08)' });
          });
          around(g, COL.x, COL.y + 540, { sc: cp, alpha: clamp(cp) }, () => {
            pill(g, 'GLB · to download', 0, 0, { size: 19, ic: 'download', icColor: S.accent, bg: 'rgba(12,12,15,0.86)', line: S.line2, color: S.text2 });
          });
        }
      }
      g.restore();
    }

    // ---- a coin with its face ----
    if (t >= M.coin - 0.05) {
      headline(g, MODEL.coin, t, M.coin, { x: W / 2, y: 140, size: 84, align: 'center' });
      coin(g, c, t, M);
      const np = E.outCubic(prog(t, M.coinLand + 0.25, M.coinLand + 0.65));
      say(g, MODEL.coinNote, { x: W / 2, y: 908 + (1 - np) * 12, size: 30, weight: 600, color: S.text, align: 'center', alpha: np });
      say(g, MODEL.fine, { x: W / 2, y: 958, size: 21, weight: 500, color: S.text3, align: 'center', alpha: np });
    }
  },
};
