// AGI Studio's launch video: pieces its scenes share (cards that pop and tilt, a clip in a card, the app's window, a
// name tag, a stamp). Built on look.js; every one a pure function of time.
import { E, prog, clamp, mix, spring, text, rr, measure } from '../../promo/page/kit.js';
import { S, GRAD, grad, media, shadow, panel, logo, creditsPill, icon, pill, captionFade, glow } from './look.js';

export { E, prog, clamp, mix, spring };

// 0 → 1 with a little overshoot, starting at t0 (a pop)
export const popK = (t, t0, d = 0.5) => (t < t0 ? 0 : E.outBack(prog(t, t0, t0 + d), 1.9));
// in at a, out at b (0..1..0), eased
export function life(t, a, b, inD = 0.4, outD = 0.35) {
  if (t < a || t > b) return 0;
  return Math.min(E.outCubic(prog(t, a, a + inD)), 1 - E.inCubic(prog(t, b - outD, b)));
}

// draws fn around a center, turned and scaled
export function around(g, cx, cy, { rot = 0, sc = 1, alpha = 1 } = {}, fn) {
  if (alpha <= 0 || sc <= 0.001) return;
  g.save();
  g.globalAlpha *= alpha;
  g.translate(cx, cy);
  if (rot) g.rotate(rot);
  if (sc !== 1) g.scale(sc, sc);
  fn();
  g.restore();
}

// a picture card centered at cx, cy (o: media()'s options + rot, sc, alpha, flash (0..1: a camera flash on it))
export function card(g, img, cx, cy, w, h, o = {}) {
  const { rot = 0, sc = 1, alpha = 1, flash = 0, r = 22, sh = 0.7, ...rest } = o;
  around(g, cx, cy, { rot, sc, alpha }, () => {
    media(g, img, -w / 2, -h / 2, w, h, { r, sh, blur: 46, dy: 26, ...rest });
    if (flash > 0) {
      g.save();
      rr(g, -w / 2, -h / 2, w, h, r);
      g.clip();
      g.fillStyle = `rgba(255,255,255,${clamp(flash)})`;
      g.fillRect(-w / 2, -h / 2, w, h);
      g.restore();
    }
  });
}

// a clip's frame for a box h tall (null until it's loaded: the renderer waits for it)
export const frameOf = (c, name, t, h, o) => c.media.vid(name, t, h, o);

// a clip in a card at its own place (x, y = its top left), playing from t0
export function clipCard(g, c, name, t, t0, x, y, w, h, o = {}) {
  const { loop = true, rate = 1, ...rest } = o;
  const bm = frameOf(c, name, (t - t0), h, { loop, rate });
  media(g, bm, x, y, w, h, { r: 22, ...rest });
}

// a name tag under or on a card: a dark pill with the name (and a small label)
export function nameTag(g, name, x, y, { alpha = 1, size = 20, sub = null, align = 'center' } = {}) {
  if (alpha <= 0) return;
  const p = pill(g, sub ? `${name} · ${sub}` : name, x, y, { size, align, alpha, bg: 'rgba(12,12,15,0.86)', line: S.line3, weight: 650 });
  return p;
}

// a stamp that slams on (rotated), its words in the gradient
export function stamp(g, str, cx, cy, t, t0, { size = 64, rot = -0.08, alpha = 1 } = {}) {
  if (t < t0) return;
  const k = spring(t, t0, { freq: 3.2, damp: 0.42 });
  const sc = mix(2.4, 1, clamp(k)) * (k > 1 ? 1 + (k - 1) * 0.5 : 1);
  const a = clamp(prog(t, t0, t0 + 0.12)) * alpha;
  const font = { f: 'sans', w: 850, s: size };
  const tw = measure(g, str, font, -0.03 * size);
  const w = tw + size * 0.9, h = size * 1.42;
  around(g, cx, cy, { rot, sc, alpha: a }, () => {
    shadow(g, -w / 2, -h / 2, w, h, { r: h / 2, blur: 30, alpha: 0.6, dy: 12 });
    rr(g, -w / 2, -h / 2, w, h, h * 0.3);
    g.fillStyle = 'rgba(12,10,20,0.92)';
    g.fill();
    g.lineWidth = 4;
    g.strokeStyle = grad(g, -w / 2, -h / 2, w, h, GRAD.light, 100);
    g.stroke();
    text(g, str, { x: 0, y: size * 0.02, font, color: grad(g, -tw / 2, -size / 2, tw, size, GRAD.light, 100), align: 'center', base: 'middle', spacing: -0.03 * size });
  });
}

// the app's window: a panel with its top bar (the logo, the credits pill, a wallet chip); returns the content box
export function appWindow(g, x, y, w, h, { u = 1.6, credits = 1240, alpha = 1, title = null, sh = 0.75 } = {}) {
  if (alpha <= 0) return { x, y, w, h };
  panel(g, x, y, w, h, { r: 18 * u, fill: S.bg, line: S.line2, sh, blur: 60, dy: 30, alpha });
  g.save();
  g.globalAlpha *= alpha;
  const bh = 54 * u;
  g.fillStyle = 'rgba(255,255,255,0.025)';
  g.beginPath(); g.roundRect(x, y, w, bh, [18 * u, 18 * u, 0, 0]);
  g.fill();
  g.fillStyle = S.line;
  g.fillRect(x, y + bh, w, 1.2);
  logo(g, x + 18 * u, y + bh / 2, 15 * u);
  if (title) text(g, title, { x: x + w / 2, y: y + bh / 2 + 1, font: { f: 'sans', w: 600, s: 13 * u }, color: S.text2, align: 'center', base: 'middle' });
  if (credits != null) {
    const pw = creditsPill(g, credits, x + w - 16 * u - 84 * u, y + bh / 2, { u, align: 'right' });
    // the wallet chip
    rr(g, x + w - 16 * u - 76 * u, y + bh / 2 - 16 * u, 76 * u, 32 * u, 9 * u);
    g.fillStyle = S.surface; g.fill();
    g.lineWidth = u; g.strokeStyle = S.line2; g.stroke();
    g.beginPath(); g.arc(x + w - 16 * u - 60 * u, y + bh / 2, 8 * u, 0, Math.PI * 2);
    g.fillStyle = grad(g, x + w - 16 * u - 68 * u, y + bh / 2 - 8 * u, 16 * u, 16 * u, GRAD.light, 120); g.fill();
    text(g, '0x2b…f9', { x: x + w - 16 * u - 46 * u, y: y + bh / 2 + 0.5, font: { f: 'mono', w: 500, s: 11 * u }, color: S.text2, base: 'middle' });
    void pw;
  }
  g.restore();
  return { x: x + 1, y: y + bh + 1, w: w - 2, h: h - bh - 2 };
}

// a section label inside a panel (the app's small uppercase labels)
export function label(g, str, x, y, { u = 1.6, alpha = 1, color = S.text3 } = {}) {
  text(g, str.toUpperCase(), { x, y, font: { f: 'sans', w: 650, s: 11 * u }, color, spacing: 0.9 * u, alpha });
}

// a soft colored light behind something
export const halo = (g, x, y, r, color = 'rgba(139,92,246,0.45)', a = 1) => glow(g, x, y, r, color, a);

export { captionFade, icon, pill, media, shadow, panel, grad, GRAD, S, rr, text, measure };
