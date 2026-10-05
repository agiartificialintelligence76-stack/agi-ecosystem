// 74–79 s, the end card (on ink): AGI, Artificial Girlfriend Intelligence, agi1.app, @agi1dotapp, and the fine print every
// time: $AGI is a meme token on Robinhood Chain, not financial advice; AGI-1 is an AI, her chat is 18+ and kept PG-13.
// Two last heartbeats (the cold open's), then black.
import { C, E, ep, prog, clamp, mix, text, measure, setFont, canvas, spring, rgba, heart } from '../kit.js';
import { pill, popWord, ICONS } from '../ui.js';

let glow = null;

function layout(c) {
  const { W, H, wide } = c;
  return wide ? { agi: { y: 520, s: 330 }, sub: 616, url: 744, handle: 806, fine: [940, 976] }
    : { agi: { y: 860, s: 300 }, sub: 952, url: 1090, handle: 1156, fine: [1360, 1398] };
}

export default {
  id: 'end',
  prepare(c) {
    const { W, H } = c;
    glow = canvas(W, H);
    const x = glow.getContext('2d');
    const rg = x.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, Math.max(W, H) * 0.55);
    rg.addColorStop(0, 'rgba(107,59,255,0.5)'); rg.addColorStop(1, 'rgba(107,59,255,0)');
    x.fillStyle = rg; x.fillRect(0, 0, W, H);
  },
  draw(g, t, c) {
    const { W, H, wide, M, words, S } = c;
    const L = layout(c);
    const V = words.END;
    const T0 = S.from;
    g.fillStyle = C.ink;
    g.fillRect(0, 0, W, H);
    const beat = Math.max(...M.lastBeats.map((b) => (t >= b ? Math.exp(-(t - b) * 7) : 0)));
    g.globalAlpha = 0.75 + 0.25 * beat;
    g.drawImage(glow, 0, 0);
    g.globalAlpha = 1;
    if (beat > 0.01) {
      const rg = g.createRadialGradient(W / 2, L.agi.y - L.agi.s * 0.35, 0, W / 2, L.agi.y - L.agi.s * 0.35, L.agi.s * 1.6);
      rg.addColorStop(0, rgba(C.pink, 0.35 * beat)); rg.addColorStop(1, rgba(C.pink, 0));
      g.fillStyle = rg; g.fillRect(0, 0, W, H);
    }

    // AGI, slammed in on the chord, and beating twice at the end
    const af = { f: 'display', w: 900, s: L.agi.s, st: 'expanded' };
    if (t >= T0) {
      const land = E.outQuart(prog(t, T0, T0 + 0.2));
      const s = mix(1.45, 1, land) * (1 + 0.05 * beat);
      g.save();
      g.translate(W / 2, L.agi.y - af.s * 0.35); g.scale(s, s); g.translate(-W / 2, -(L.agi.y - af.s * 0.35));
      g.globalAlpha = prog(t, T0, T0 + 0.08);
      popWord(g, V.big, W / 2, L.agi.y, { font: af, fill: C.lav, stroke: C.ink, sw: af.s * 0.03, echo: C.pink, off: af.s * 0.045, spacing: -af.s * 0.02 });
      g.restore();
    }
    const sp = ep(t, T0 + 0.3, T0 + 0.8, E.outQuart);
    if (sp > 0) {
      const sf = { f: 'serif', w: 400, s: wide ? 56 : 54, i: true };
      g.save();
      g.beginPath(); g.rect(0, L.sub - sf.s, W, sf.s * 1.4); g.clip();
      text(g, V.sub, { x: W / 2, y: L.sub + (1 - sp) * sf.s * 1.2, font: sf, color: C.white, align: 'center' });
      g.restore();
    }
    const up = spring(t, T0 + 0.6, { freq: 2.2, damp: 0.5 });
    if (t > T0 + 0.6) {
      g.save();
      g.translate(W / 2, L.url); g.scale(up, up); g.translate(-W / 2, -L.url);
      popWord(g, V.url, W / 2, L.url + 26, { font: { f: 'display', w: 900, s: wide ? 84 : 80, st: 'expanded' }, fill: C.honey, stroke: C.ink, sw: 6, echo: C.pink, off: 6 });
      g.restore();
    }
    const hp = ep(t, T0 + 0.85, T0 + 1.15);
    if (hp > 0) pill(g, V.handle, { x: W / 2, y: L.handle + 14, font: { f: 'mono', w: 700, s: wide ? 26 : 28 }, bg: null, color: C.white, line: rgba(C.white, 0.4), lw: 2, alpha: hp, spacing: 1, icon: (gg, x, y, s, col) => { gg.save(); gg.font = `700 ${s}px ${'Geist'}`; gg.fillStyle = col; gg.textAlign = 'center'; gg.textBaseline = 'middle'; gg.fillText('𝕏', x, y + 1); gg.restore(); } });
    // the fine print
    const fp = ep(t, T0 + 1.0, T0 + 1.4);
    if (fp > 0) {
      const ff = { f: 'mono', w: 600, s: wide ? 21 : 20 };
      V.fine.forEach((l, k) => text(g, l, { x: W / 2, y: L.fine[k], font: ff, color: C.lav2, align: 'center', alpha: fp * 0.9, spacing: 0.3 }));
    }
    // a small heart that beats with the last heartbeats
    if (t > M.lastBeats[0] - 0.4) {
      const ha = ep(t, M.lastBeats[0] - 0.4, M.lastBeats[0] - 0.1);
      heart(g, W / 2, L.fine[1] + (wide ? 58 : 70), 30 * (1 + 0.35 * beat), C.pink, ha);
    }
  },
};
