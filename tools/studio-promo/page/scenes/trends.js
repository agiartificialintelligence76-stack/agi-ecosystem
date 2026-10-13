// 8. Trend videos (46–58 s), the second drop: "Trend videos." over a carousel of trending clips, all playing. Golden
// hour is picked, and it becomes the first of four: the trend clip, the influencer, and the influencer in it (Nova,
// Kai, Juno, Mika), a bar each. Then the four results side by side: or bring your own clip.
import { S, backdrop, headline, say, pill, glow, costChip, icon } from '../look.js';
import { clipCard, frameOf, popK, around, nameTag, E, prog, clamp, mix, text, rr, media, grad, GRAD } from '../parts.js';
import { TRENDS_SCENE, CAST } from '../../words.js';

// 16:9 (the middle at 720 in 4:3; the pairs 390 apart, the four results 320)
// the carousel: its cards and their speed; the picked one starts at PICK
const CW = 292, CH = 520, CG = 24, SPEED = 110, PICK = 1125;
// a pair: the clip on the left, the influencer in the middle, the result on the right
const PW = 360, PH = 640, PY = 215, MX = 960, LX = MX - 500, RX = MX + 500, MY = 470;
// the four results at the end
const FW = 320, FH = 569, FY = 236, FS = 380;
const fourX = (k) => MX + (k - 1.5) * FS;
const LOOKS = { Nova: 'nova-look-1', Kai: 'kai-look-1', Juno: 'juno-look-1', Mika: 'mika-look-1' };

// an arrow from (x0, y) to (x1, y), drawn to p
function arrow(g, x0, x1, y, p, alpha = 1) {
  if (p <= 0 || alpha <= 0) return;
  const xe = mix(x0, x1, clamp(p));
  g.save();
  g.globalAlpha *= alpha;
  g.lineCap = 'round';
  g.lineWidth = 5;
  g.strokeStyle = grad(g, x0, y - 3, x1 - x0, 6, GRAD.light, 90);
  g.beginPath(); g.moveTo(x0, y); g.lineTo(xe, y); g.stroke();
  if (p >= 0.98) {
    g.beginPath(); g.moveTo(xe - 16, y - 13); g.lineTo(xe + 1, y); g.lineTo(xe - 16, y + 13);
    g.lineJoin = 'round'; g.stroke();
  }
  g.restore();
}

// where a result is being made: a dark card, its dashed edge and a light moving over it
function waiting(g, x, y, w, h, t, alpha) {
  if (alpha <= 0) return;
  g.save();
  g.globalAlpha *= alpha;
  rr(g, x, y, w, h, 22); g.fillStyle = 'rgba(20,18,30,0.92)'; g.fill();
  g.setLineDash([14, 10]); g.lineWidth = 2.5; g.strokeStyle = 'rgba(167,139,250,0.55)'; g.stroke(); g.setLineDash([]);
  g.save(); rr(g, x, y, w, h, 22); g.clip();
  const sy = y + ((t * 1.3) % 1.4 - 0.2) * h;
  const lg = g.createLinearGradient(0, sy - 120, 0, sy + 120);
  lg.addColorStop(0, 'rgba(167,139,250,0)'); lg.addColorStop(0.5, 'rgba(167,139,250,0.18)'); lg.addColorStop(1, 'rgba(167,139,250,0)');
  g.fillStyle = lg; g.fillRect(x, y, w, h);
  g.restore();
  icon(g, 'spark', x + w / 2, y + h / 2, 54, 'rgba(232,121,249,0.85)', { fill: true });
  g.restore();
}

// the influencer: its round look, a gradient ring, its name
function who(g, c, name, t, t0, alpha) {
  const p = popK(t, t0, 0.5);
  if (p <= 0 || alpha <= 0) return;
  around(g, MX, MY, { sc: p, alpha: clamp(p) * alpha }, () => {
    glow(g, 0, 0, 170, 'rgba(232,121,249,0.35)', 1);
    g.beginPath(); g.arc(0, 0, 84, 0, Math.PI * 2);
    g.fillStyle = grad(g, -84, -84, 168, 168, GRAD.light, 135); g.fill();
    g.save(); g.beginPath(); g.arc(0, 0, 77, 0, Math.PI * 2); g.clip();
    media(g, c.media.pic(LOOKS[name]), -77, -77, 154, 154, { r: 0, lw: 0, focus: [0.5, 0.4] });
    g.restore();
    text(g, name, { x: 0, y: 138, font: { f: 'sans', w: 800, s: 38 }, color: S.text, align: 'center' });
    pill(g, 'in the clip', 0, 186, { size: 20, align: 'center', bg: 'rgba(12,12,15,0.8)', line: S.line2, color: S.text2 });
  });
}

export default {
  draw(g, t, c) {
    const { W, H, M } = c;
    backdrop(g, W, H, t, { a: 0.85, b: 0.9, ax: 0.2, ay: 0.95, bx: 0.85, by: 0.05, hueA: 'rgba(219,39,119,0.32)' });

    // the headline: big over the carousel, then up at the top for the pairs
    const up = E.inOutCubic(prog(t, M.pickTrend + 0.1, M.pickTrend + 0.55));
    const hy = mix(232, 128, up), hs = mix(1, 0.62, up);
    g.save();
    g.translate(W / 2, hy); g.scale(hs, hs);
    headline(g, TRENDS_SCENE.head, t, M.drop2, { x: 0, y: 0, size: 150, align: 'center', stagger: 0.07 });
    g.restore();
    const subA = E.outCubic(prog(t, M.drop2 + 0.45, M.drop2 + 0.85)) * (1 - E.inCubic(prog(t, M.pickTrend - 0.1, M.pickTrend + 0.2)));
    say(g, TRENDS_SCENE.sub, { x: W / 2, y: 312 + (1 - subA) * 14, size: 33, weight: 600, color: S.text2, align: 'center', alpha: subA });

    // ---- the carousel: nine trending clips, playing, gliding left ----
    const pickP = E.outCubic(prog(t, M.pickTrend, M.pickTrend + 0.35));
    const goP = E.inOutCubic(prog(t, M.pickTrend + 0.25, M.pairs[0] + 0.15));      // the picked one to its place
    if (t < M.pairs[0] + 0.15) {
      const shift = (Math.min(t, M.pickTrend) - M.drop2) * SPEED;
      const n = TRENDS_SCENE.carousel.length;
      for (let k = -5; k <= 6; k++) {
        const [name, tr] = TRENDS_SCENE.carousel[((k % n) + n) % n];
        const pos = k * (CW + CG) + PICK - shift;
        if (pos < -CW || pos > W + CW) continue;
        const inP = E.outCubic(prog(t, M.drop2 + 0.05 + Math.abs(k) * 0.05, M.drop2 + 0.5 + Math.abs(k) * 0.05));
        const picked = k === 0;
        if (picked) continue;                                                 // drawn last, on top
        const away = E.inCubic(prog(t, M.pickTrend + 0.05, M.pickTrend + 0.45));
        const a = inP * (1 - pickP * 0.65) * (1 - away);
        if (a <= 0.01) continue;
        const cy = 655 + (1 - inP) * 120 + away * 90;
        around(g, pos, cy, { alpha: a, sc: 1 - pickP * 0.06 }, () => {
          clipCard(g, c, name, t, M.drop2 - Math.abs(k) * 0.7, -CW / 2, -CH / 2, CW, CH, { sh: 0.6, dim: pickP * 0.25 });
          pill(g, `${tr.emoji} ${tr.name}`, 0, CH / 2 - 34, { size: 19, align: 'center', bg: 'rgba(10,10,13,0.78)', line: S.line2 });
        });
      }
      // the picked one: Golden hour
      const [name, tr] = TRENDS_SCENE.carousel[0];
      const pos0 = PICK - shift;
      const inP = E.outCubic(prog(t, M.drop2 + 0.05, M.drop2 + 0.5));
      const cx = mix(pos0, LX, goP), cy = mix(655 + (1 - inP) * 120, PY + PH / 2, goP);
      const w = mix(CW, PW, goP), h = mix(CH, PH, goP);
      const sc = 1 + pickP * 0.08 * (1 - goP);
      around(g, cx, cy, { alpha: inP, sc }, () => {
        if (pickP > 0) glow(g, 0, 0, 340, 'rgba(232,121,249,0.4)', pickP);
        clipCard(g, c, name, t, M.drop2, -w / 2, -h / 2, w, h, { sh: 0.8 });
        if (pickP > 0) {
          g.save(); g.globalAlpha *= pickP * (1 - goP);
          rr(g, -w / 2 - 7, -h / 2 - 7, w + 14, h + 14, 27);
          g.lineWidth = 5; g.strokeStyle = grad(g, -w / 2, -h / 2, w, h, GRAD.light, 120); g.stroke();
          g.restore();
          const ck = popK(t, M.pickTrend + 0.05, 0.4);
          around(g, w / 2 - 26, -h / 2 + 26, { sc: ck * (1 - goP), alpha: clamp(ck) }, () => {
            g.beginPath(); g.arc(0, 0, 24, 0, Math.PI * 2); g.fillStyle = grad(g, -24, -24, 48, 48, GRAD.light, 135); g.fill();
            icon(g, 'check', 0, 0, 26, '#fff', { lw: 3.4 });
          });
        }
        pill(g, `${tr.emoji} ${tr.name}`, 0, h / 2 - 34, { size: 19, align: 'center', bg: 'rgba(10,10,13,0.78)', line: S.line2, alpha: 1 - goP });
      });
    }

    // ---- four times: the trend clip, the influencer, the influencer in it ----
    TRENDS_SCENE.pairs.forEach(([clip, result, name, tr], k) => {
      const t0 = M.pairs[k], sw = M.swaps[k];
      if (t < t0 - 0.32) return;
      const last = k === TRENDS_SCENE.pairs.length - 1;
      if (!last && t > t0 + 2.3) return;
      // the group slides in from the right (the first is already here), and out to the left (the last stays)
      // one smooth pan from a pair to the next (both move together, so the frame is never empty)
      const pan = (b) => E.inOutCubic(prog(t, b - 0.3, b + 0.25));
      const inX = k === 0 ? 0 : (1 - pan(t0)) * W;
      const outX = last ? 0 : -pan(t0 + 2) * W;
      const gather = last ? E.inOutCubic(prog(t, M.ownClip - 0.25, M.ownClip + 0.35)) : 0;  // the last one joins the four
      g.save();
      g.translate(inX + outX, 0);
      // the clip (for the first, the picked card is drawn above until it lands)
      if (k > 0 || t >= M.pairs[0] + 0.15) {
        around(g, LX, PY + PH / 2, { alpha: 1 - gather }, () => {
          clipCard(g, c, clip, t, k === 0 ? M.drop2 : t0, -PW / 2, -PH / 2, PW, PH, { sh: 0.8 });
        });
      }
      const la = E.outCubic(prog(t, t0 + 0.1, t0 + 0.4)) * (1 - gather);
      pill(g, `${TRENDS_SCENE.clip} · ${tr.emoji} ${tr.name}`, LX, PY + PH + 50, { size: 22, align: 'center', bg: 'rgba(12,12,15,0.86)', line: S.line2, alpha: la });
      // the influencer, and the arrows
      who(g, c, name, t, t0 + 0.05, 1 - gather);
      const ar = E.inOutCubic(prog(t, t0 + 0.12, t0 + 0.42));
      arrow(g, LX + PW / 2 + 18, MX - 104, MY, ar, 1 - gather);
      arrow(g, MX + 104, RX - PW / 2 - 18, MY, E.inOutCubic(prog(t, t0 + 0.3, sw + 0.02)), 1 - gather);
      // the result: waiting, then wiped in on the beat
      const rxL = mix(RX - PW / 2, fourX(3) - FW / 2, gather), ryT = mix(PY, FY, gather);
      const rw = mix(PW, FW, gather), rh = mix(PH, FH, gather);
      const wp = E.inOutCubic(prog(t, sw, sw + 0.28));
      const wa = E.outCubic(prog(t, t0, t0 + 0.3));
      if (wp < 1) waiting(g, rxL, ryT, rw, rh, t, wa * (1 - wp * 0.4));
      if (wp > 0) {
        glow(g, rxL + rw / 2, ryT + rh / 2, 360, 'rgba(232,121,249,0.32)', wp * (1 - gather));
        g.save();
        g.beginPath(); g.rect(rxL - 20, ryT - 20, (rw + 40) * wp, rh + 40); g.clip();
        clipCard(g, c, result, t, sw, rxL, ryT, rw, rh, { sh: 0.85 });
        g.restore();
        if (wp < 1) {
          const ex = rxL + rw * wp;
          g.save();
          g.fillStyle = 'rgba(255,255,255,0.95)'; g.fillRect(ex - 2.5, ryT, 5, rh);
          glow(g, ex, ryT + rh / 2, 160, 'rgba(232,121,249,0.6)', 1);
          g.restore();
        }
        // a quick light as it lands (once)
        const fl = 0.45 * (1 - E.outCubic(prog(t, sw + 0.26, sw + 0.5)));
        if (fl > 0 && t > sw + 0.26) {
          g.save(); rr(g, rxL, ryT, rw, rh, 22); g.clip();
          g.fillStyle = `rgba(255,255,255,${fl})`; g.fillRect(rxL, ryT, rw, rh); g.restore();
        }
      }
      const ra = E.outCubic(prog(t, sw + 0.2, sw + 0.5));
      const tagY = mix(PY + PH + 50, FY + FH + 44, gather), tagX = rxL + rw / 2;
      if (gather > 0) nameTag(g, name, tagX, tagY, { size: 24, alpha: ra });
      else pill(g, `${name} · ${tr.name}`, tagX, tagY, { size: 22, align: 'center', bg: 'rgba(139,92,246,0.24)', line: S.accent, alpha: ra, ic: 'spark' });
      g.restore();
    });

    // ---- the four, side by side, all playing; or bring your own clip ----
    if (t >= M.ownClip - 0.1) {
      TRENDS_SCENE.pairs.slice(0, -1).forEach(([, result, name], k) => {
        const p = popK(t, M.ownClip - 0.05 + k * 0.08, 0.5);
        if (p <= 0) return;
        const cx = fourX(k);
        glow(g, cx, FY + FH / 2, 220, 'rgba(139,92,246,0.22)', clamp(p));
        around(g, cx, FY + FH / 2 + (1 - clamp(p)) * 80, { sc: p, alpha: clamp(p) }, () => {
          clipCard(g, c, result, t, M.swaps[k], -FW / 2, -FH / 2, FW, FH, { sh: 0.8 });
        });
        nameTag(g, name, cx, FY + FH + 44, { size: 24, alpha: clamp(p) });
      });
      const oa = E.outCubic(prog(t, M.ownClip + 0.1, M.ownClip + 0.5));
      headline(g, TRENDS_SCENE.own, t, M.ownClip + 0.1, { x: W / 2, y: 930, size: 56, align: 'center', stagger: 0.05 });
      around(g, W / 2, 985, { alpha: oa }, () => {
        say(g, TRENDS_SCENE.ownNote, { x: 0, y: 0, size: 26, weight: 500, color: S.text2, align: 'center' });
      });
      const cp = popK(t, M.four + 0.4, 0.45);
      if (cp > 0) {
        around(g, W / 2, 208, { sc: cp, alpha: clamp(cp) }, () => {
          pill(g, 'A trend video', -10, 0, { size: 22, align: 'right', bg: 'rgba(12,12,15,0.86)', line: S.line2 });
          costChip(g, TRENDS_SCENE.cost, 10, 0, { u: 1.8, align: 'left', bg: 'rgba(255,255,255,0.08)' });
        });
      }
    }
    void frameOf; void CAST;
  },
};
