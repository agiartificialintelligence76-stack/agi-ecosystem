// 12. Paying (78–84 s): "Pay as you go." A top-up: $10 picked, its credits counting up to 1,000 (1 credit = 1 cent,
// USDG from your own wallet), and what things cost, a row each. Then "$AGI holders get more.": Crush, then Soulmate,
// and the prices fall to theirs as each comes (the old price struck through beside the new one). Never "buy": credits
// are topped up; "not financial advice" where holding comes up.
import { S, backdrop, headline, say, pill, glow, icon, seg, costChip, bolt } from '../look.js';
import { popK, around, E, prog, clamp, mix, text, rr, panel, grad, GRAD, label, measure } from '../parts.js';
import { PAY } from '../../words.js';

const TOP = { x: 80, y: 220, w: 560, h: 620 };          // the top-up card (then the holders' cards)
const LIST = { x: 690, y: 220, w: 670, h: 620 };        // what things cost
const U = 1.5;
const usd = (cents) => `$${Math.round(cents / 100)}`;
const n = (x) => Math.round(x).toLocaleString('en-US');

// the level the prices are at now: 0 (Stranger), then 1 (Crush), then 2 (Soulmate)
const levelAt = (t, M) => E.inOutCubic(prog(t, M.holderRows[0], M.holderRows[0] + 0.32)) + E.inOutCubic(prog(t, M.holderRows[1], M.holderRows[1] + 0.32));
const priceAt = (v, l) => (l <= 1 ? mix(v[0], v[1], l) : mix(v[1], v[2], l - 1));

function topUp(g, t, M, out) {
  // in place as the iris opens from the coin (the scene is never drawn before M.pay), so the iris shows it
  const p = E.outCubic(prog(t, M.pay - 0.5, M.pay - 0.05));
  if (p <= 0 || out >= 1) return;
  const { x, y, w, h } = TOP;
  g.save();
  g.globalAlpha *= p * (1 - out);
  g.translate(-out * 70 + (1 - p) * -30, 0);
  panel(g, x, y, w, h, { r: 26, fill: S.panel });
  // its head: the wallet, "Top up", USDG
  rr(g, x + 28, y + 30, 52, 52, 15); g.fillStyle = grad(g, x + 28, y + 30, 52, 52, GRAD.brand, 135); g.fill();
  icon(g, 'wallet', x + 54, y + 56, 30, '#fff', { lw: 2 });
  text(g, 'Top up', { x: x + 98, y: y + 67, font: { f: 'sans', w: 750, s: 32 }, color: S.text });
  pill(g, 'USDG', x + w - 28, y + 56, { size: 17, mono: true, align: 'right', bg: 'rgba(255,255,255,0.05)', line: S.line2, color: S.text2 });
  // the amounts, $10 picked
  label(g, 'Amount', x + 28, y + 128, { u: U });
  const aw = (w - 56 - 28) / 3;
  const pick = E.outCubic(prog(t, M.count - 0.12, M.count + 0.08));
  PAY.amounts.forEach((cents, k) => {
    const ax = x + 28 + k * (aw + 14), ay = y + 146, ah = 92;
    const on = k === 1 ? pick : 0;
    rr(g, ax, ay, aw, ah, 16);
    g.fillStyle = on > 0.5 ? 'rgba(139,92,246,0.16)' : S.surface; g.fill();
    g.lineWidth = on > 0.5 ? 3 : 1.5; g.strokeStyle = on > 0.5 ? grad(g, ax, ay, aw, ah, GRAD.light, 120) : S.line2; g.stroke();
    text(g, usd(cents), { x: ax + aw / 2, y: ay + 46, font: { f: 'sans', w: 800, s: 36 }, color: S.text, align: 'center' });
    text(g, `${n(cents)} credits`, { x: ax + aw / 2, y: ay + 74, font: { f: 'sans', w: 550, s: 16 }, color: on > 0.5 ? S.accent : S.text3, align: 'center' });
  });
  // the credits counting up, and the bolts flying in from $10
  const cp = E.outCubic(prog(t, M.count + 0.05, M.count + 0.95));
  const cy = y + 352;
  const land = clamp(1 - Math.abs(t - (M.count + 0.95)) / 0.25);
  around(g, x + 62, cy - 30, { sc: 1 + 0.18 * land }, () => {
    glow(g, 0, 0, 90, 'rgba(251,191,36,0.45)', 0.4 + 0.6 * land);
    bolt(g, 0, 0, 62, S.honey);
  });
  text(g, n(PAY.topped * cp), { x: x + 108, y: cy, font: { f: 'sans', w: 850, s: 104 }, color: S.text, spacing: -3 });
  text(g, 'credits', { x: x + 110, y: cy + 46, font: { f: 'sans', w: 600, s: 26 }, color: S.text2 });
  for (let i = 0; i < 6; i++) {
    const t0 = M.count + 0.05 + i * 0.1, q = prog(t, t0, t0 + 0.42);
    if (q <= 0 || q >= 1) continue;
    const e = E.inOutCubic(q);
    const sx = x + 28 + aw + 14 + aw / 2, sy = y + 160, ex = x + 62, ey = cy - 30;
    const bx = mix(sx, ex, e), by = mix(sy, ey, e) - Math.sin(Math.PI * e) * 70;
    bolt(g, bx, by, 26 - 8 * e, S.honey, 1 - E.inQuad(clamp((q - 0.8) / 0.2)));
  }
  // what a credit is, and how it's paid
  const rp = E.outCubic(prog(t, M.count + 0.6, M.count + 1.0));
  pill(g, PAY.rate, x + 28, y + 470, { size: 24, weight: 650, bg: 'rgba(251,191,36,0.1)', line: 'rgba(251,191,36,0.45)', color: S.gold, alpha: rp, ic: 'bolt', icColor: S.honey });
  say(g, PAY.topup, { x: x + 28, y: y + 552 + (1 - rp) * 10, size: 24, weight: 500, color: S.text2, alpha: rp });
  g.restore();
}

function holderCard(g, t, t0, k, x, y, w, h) {
  const p = popK(t, t0, 0.5);
  if (p <= 0) return;
  const [name, min, perks] = PAY.perks[k];
  around(g, x + w / 2, y + h / 2 + (1 - clamp(p)) * 40, { sc: 0.94 + 0.06 * p, alpha: clamp(p) }, () => {
    const ox = -w / 2, oy = -h / 2;
    glow(g, 0, 0, w * 0.6, k ? 'rgba(219,39,119,0.24)' : 'rgba(139,92,246,0.24)', 1);
    panel(g, ox, oy, w, h, { r: 26, fill: S.panel, line: k ? 'rgba(244,114,182,0.45)' : 'rgba(167,139,250,0.4)', lw: 2 });
    // its badge and name
    g.beginPath(); g.arc(ox + 60, oy + 62, 32, 0, Math.PI * 2);
    g.fillStyle = grad(g, ox + 28, oy + 30, 64, 64, k ? GRAD.brand : GRAD.light, 135); g.fill();
    icon(g, 'heart', ox + 60, oy + 64, 32, '#fff', { fill: true, lw: 1.5 });
    if (k) icon(g, 'spark', ox + 84, oy + 38, 20, S.gold, { fill: true, lw: 1 });
    text(g, name, { x: ox + 112, y: oy + 76, font: { f: 'sans', w: 850, s: 42 }, color: S.text, spacing: -1 });
    pill(g, min, ox + w - 28, oy + 62, { size: 17, mono: true, align: 'right', bg: 'rgba(255,255,255,0.05)', line: S.line2, color: S.text2 });
    // its perks
    perks.forEach((s, i) => {
      const py = oy + 142 + i * 58;
      const q = E.outCubic(prog(t, t0 + 0.12 + i * 0.07, t0 + 0.45 + i * 0.07));
      g.save(); g.globalAlpha *= q; g.translate((1 - q) * 18, 0);
      g.beginPath(); g.arc(ox + 46, py - 9, 15, 0, Math.PI * 2); g.fillStyle = 'rgba(63,240,195,0.14)'; g.fill();
      icon(g, 'check', ox + 46, py - 9, 20, S.mint, { lw: 3 });
      const big = i === 0;
      text(g, s, { x: ox + 76, y: py, font: { f: 'sans', w: big ? 750 : 600, s: big ? 30 : 27 }, color: big ? grad(g, ox + 76, py - 30, measure(g, s, { f: 'sans', w: 750, s: 30 }), 36, GRAD.light, 100) : S.text });
      g.restore();
    });
  });
}

export default {
  draw(g, t, c) {
    const { W, H, M } = c;
    backdrop(g, W, H, t, { a: 0.7, b: 0.75, ax: 0.15, ay: 0.3, bx: 0.85, by: 0.85, hueB: t >= M.holders ? 'rgba(219,39,119,0.28)' : 'rgba(245,158,11,0.16)' });
    headline(g, PAY.head, t, M.pay, { x: 80, y: 140, size: 88, out: M.holders - 0.35, outDur: 0.3 });
    headline(g, PAY.holders, t, M.holders, { x: 80, y: 140, size: 88 });

    // ---- the top-up, then the holders ----
    const out = E.inCubic(prog(t, M.holders - 0.35, M.holders));
    topUp(g, t, M, out);
    holderCard(g, t, M.holderRows[0], 0, TOP.x, TOP.y, TOP.w, 270);
    holderCard(g, t, M.holderRows[1], 1, TOP.x, TOP.y + 290, TOP.w, 330);

    // ---- what things cost ----
    const lp = E.outCubic(prog(t, M.pay - 0.45, M.pay));
    if (lp > 0) {
      const { x, y, w, h } = LIST;
      g.save();
      g.globalAlpha *= lp;
      g.translate((1 - lp) * 40, 0);
      panel(g, x, y, w, h, { r: 26, fill: S.panel });
      label(g, PAY.costTitle, x + 28, y + 52, { u: U });
      // the levels' switch, from the holders on
      const l = levelAt(t, M);
      const sp = E.outCubic(prog(t, M.holders + 0.1, M.holders + 0.4));
      if (sp > 0) {
        g.save(); g.globalAlpha *= sp;
        seg(g, PAY.levels, x + w - 28 - 360, y + 26, 360, { u: 1.25, on: l, h: 40 });
        g.restore();
      }
      PAY.prices.forEach(([name, ic, vals, from, note], k) => {
        const t0 = M.prices[k];
        const q = E.outCubic(prog(t, t0, t0 + 0.35));
        if (q <= 0) return;
        const ry = y + 132 + k * 78;
        g.save();
        g.globalAlpha *= q;
        g.translate((1 - q) * 50, 0);
        if (k) { g.fillStyle = S.line; g.fillRect(x + 28, ry - 42, w - 56, 1.2); }
        rr(g, x + 28, ry - 26, 52, 52, 14); g.fillStyle = grad(g, x + 28, ry - 26, 52, 52, GRAD.bar, 135); g.fill();
        icon(g, ic, x + 54, ry, 28, '#fff', { lw: 2 });
        text(g, name, { x: x + 100, y: ry + (note ? -2 : 10), font: { f: 'sans', w: 650, s: 28 }, color: S.text });
        if (note) text(g, note, { x: x + 100, y: ry + 24, font: { f: 'sans', w: 500, s: 17 }, color: S.text3 });
        // its price at the level now; the first price struck through once it's lower
        const v = Math.round(priceAt(vals, l));
        const flash = Math.max(0, ...M.holderRows.map((h0) => clamp(1 - Math.abs(t - (h0 + 0.16)) / 0.22)));
        if (flash > 0) glow(g, x + w - 80, ry, 90, 'rgba(244,114,182,0.5)', flash);
        const cw = costChip(g, n(v), x + w - 28, ry, { u: 1.9, align: 'right', bg: l > 0.02 ? 'rgba(139,92,246,0.28)' : 'rgba(255,255,255,0.08)', size: 13 });
        let lx = x + w - 28 - cw - 12;
        if (l > 0.02) {
          const old = n(vals[0]), f = { f: 'sans', w: 600, s: 22 };
          const ow = measure(g, old, f);
          g.save(); g.globalAlpha *= clamp(l * 3);
          text(g, old, { x: lx - ow, y: ry + 8, font: f, color: S.text3 });
          g.fillStyle = S.text3; g.fillRect(lx - ow - 2, ry, ow + 4, 2);
          g.restore();
          lx -= ow + 12;
        }
        if (from) text(g, 'from', { x: lx, y: ry + 7, font: { f: 'sans', w: 500, s: 19 }, color: S.text3, align: 'right' });
        g.restore();
      });
      g.restore();
    }

    // ---- the fine print ----
    const fp = E.outCubic(prog(t, M.prices[5] + 0.45, M.prices[5] + 0.85)) * (1 - E.inCubic(prog(t, M.holders - 0.3, M.holders)));
    say(g, PAY.fine, { x: 80, y: 902, size: 22, weight: 500, color: S.text3, alpha: fp });
    const hf = E.outCubic(prog(t, M.holderRows[1] + 0.4, M.holderRows[1] + 0.8));
    say(g, PAY.holderFine, { x: 80, y: 902 + (1 - hf) * 8, size: 21, weight: 500, color: S.text3, alpha: hf });
  },
};
