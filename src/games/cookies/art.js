// ACCEPT ALL COOKIES: the look. "A cozy browser on a lavender desktop": each level is a page in a sticker-style
// browser window (three dots, a tab, a made-up address on cookies.agi1.app, never a real site) on the arcade's deep
// violet; every object an ink-outlined sticker with a hard shadow to the bottom right; ropes are honey cables with an
// ink edge; the cookie a sugar cookie with pink sprinkles (no chocolate: it's for a cat); the pixels mint squares.
// Page units throughout (the page is 600 × 900); the static parts are drawn once into offscreen canvases.
import { roundRect, star } from '../kit/fx.js';
import { POP_R, BUG_R, TAB_R, COOKIE_R, PIXEL_R } from './physics.js';

export const C = {
  ink: '#170a36', ink2: '#4a3d6e', paper: '#fffaf0', page: '#f3ecff', lav: '#e4d9ff', lav2: '#cdb8ff', lav3: '#ddd0fa',
  violet: '#6b3bff', violet2: '#8b66ff', deep: '#1e1240', deep2: '#2a1a5c', pink: '#ff4da6', pink2: '#ff9bcb',
  honey: '#ffc933', honey2: '#ffe08a', honeyDark: '#c98f00', mint: '#3ff0c3', mint2: '#b5ffe9', red: '#ff5a5f', sky: '#59c8ff',
  doodle: '#e2d6fb', doodle2: '#d7c8f7', shadow: 'rgba(23,10,54,0.22)',
};
export const FONT = { display: "'AK Display', 'Arial Black', system-ui, sans-serif", mono: "'AK Mono', ui-monospace, monospace", sans: "'AK Sans', system-ui, sans-serif" };
const TAU = Math.PI * 2;

// the window around the page (page units): the chrome on top, a thin frame on the other sides
export const WIN = { l: -16, r: 616, t: -84, b: 916, chrome: 84 };
export const WIN_W = WIN.r - WIN.l, WIN_H = WIN.b - WIN.t;

const make = (w, h) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  return c;
};

// ---------- the cookie: drawn once, as big as it shows ----------
export function cookieSprite(px) {
  const pad = 6, R = px / 2;
  const c = make(px + pad * 2, px + pad * 2);
  const g = c.getContext('2d');
  const k = px / (COOKIE_R * 2);
  g.translate(pad + R, pad + R);
  g.scale(k, k);
  const r = COOKIE_R;
  // a little wavy edge (a baked cookie is never a perfect circle)
  const edge = (rad) => {
    g.beginPath();
    for (let i = 0; i <= 28; i++) {
      const a = (i / 28) * TAU, w = rad + Math.sin(a * 5) * 0.9 + Math.sin(a * 3 + 1) * 0.6;
      g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * w, Math.sin(a) * w);
    }
    g.closePath();
  };
  edge(r);
  const grd = g.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
  grd.addColorStop(0, '#fbe3b0'); grd.addColorStop(0.65, '#f2c780'); grd.addColorStop(1, '#de9f55');
  g.fillStyle = grd; g.fill();
  g.lineWidth = 3.4; g.strokeStyle = C.ink; g.stroke();
  // a sugar glaze circle
  edge(r * 0.72);
  g.fillStyle = 'rgba(255,248,236,0.55)'; g.fill();
  // pink sprinkles
  const spr = [[-9, -10, 0.6, C.pink], [6, -13, -0.4, C.pink2], [12, -1, 1.1, C.pink], [-2, 2, 2.2, '#ffffff'], [-13, 4, -0.9, C.pink2],
    [3, 12, 0.3, C.pink], [-7, 13, 1.6, '#ffffff'], [14, 10, -1.2, C.pink2], [-1, -4, -0.2, C.pink], [8, 4, 0.8, C.lav2]];
  for (const [x, y, a, col] of spr) {
    g.save(); g.translate(x, y); g.rotate(a);
    roundRect(g, -3.6, -1.5, 7.2, 3, 1.5); g.fillStyle = col; g.fill();
    g.lineWidth = 0.9; g.strokeStyle = 'rgba(23,10,54,0.55)'; g.stroke();
    g.restore();
  }
  // a shine
  g.beginPath(); g.arc(0, 0, r - 5, Math.PI * 1.08, Math.PI * 1.42); g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineCap = 'round'; g.stroke();
  return { canvas: c, size: px + pad * 2, pad };
}

// ---------- small stickers ----------
export function shadowed(g, fn, dx = 3, dy = 4) {
  g.save(); g.translate(dx, dy); g.globalAlpha *= 1; fn(true); g.restore();
  fn(false);
}

export function drawPin(g, x, y, { r = 11, color = C.violet2, ring = false } = {}) {
  g.beginPath(); g.arc(x + 2.5, y + 3.5, r, 0, TAU); g.fillStyle = C.shadow; g.fill();
  g.beginPath(); g.arc(x, y, r, 0, TAU);
  g.fillStyle = ring ? C.paper : color; g.fill();
  g.lineWidth = 3.5; g.strokeStyle = C.ink; g.stroke();
  if (ring) { g.beginPath(); g.arc(x, y, r * 0.45, 0, TAU); g.fillStyle = color; g.fill(); g.lineWidth = 2.5; g.stroke(); }
  else { g.beginPath(); g.arc(x - r * 0.32, y - r * 0.34, r * 0.28, 0, TAU); g.fillStyle = 'rgba(255,255,255,0.8)'; g.fill(); }
}

// a hook: its dashed reach (turning slowly) and its ring pin
export function drawHook(g, h, t, fade = 1) {
  if (!h.used || fade > 0.01) {
    g.save();
    g.globalAlpha *= h.used ? fade : 1;
    g.beginPath(); g.arc(h.x, h.y, h.r, 0, TAU);
    g.fillStyle = 'rgba(139,102,255,0.07)'; g.fill();
    g.setLineDash([11, 9]); g.lineDashOffset = -t * 18;
    g.lineWidth = 3; g.strokeStyle = 'rgba(107,59,255,0.62)'; g.stroke();
    g.setLineDash([]);
    g.restore();
  }
  drawPin(g, h.x, h.y, { r: 10, color: C.violet, ring: true });
}

// a sliding pin's track
export function drawTrack(g, p) {
  const { x0, y0, x1, y1 } = p.track;
  g.lineCap = 'round';
  g.beginPath(); g.moveTo(x0 + 2, y0 + 3); g.lineTo(x1 + 2, y1 + 3); g.lineWidth = 24; g.strokeStyle = C.shadow; g.stroke();
  g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineWidth = 24; g.strokeStyle = C.ink; g.stroke();
  g.lineWidth = 17; g.strokeStyle = C.lav; g.stroke();
  g.lineWidth = 4; g.strokeStyle = C.lav2; g.stroke();
}
export function drawKnob(g, x, y, hot = 0) {
  const r = 15 + hot * 2;
  g.beginPath(); g.arc(x + 2.5, y + 3.5, r, 0, TAU); g.fillStyle = C.shadow; g.fill();
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = C.honey; g.fill(); g.lineWidth = 3.5; g.strokeStyle = C.ink; g.stroke();
  g.lineWidth = 2.5; g.lineCap = 'round';
  for (const d of [-5, 0, 5]) { g.beginPath(); g.moveTo(x + d, y - 6); g.lineTo(x + d, y + 6); g.stroke(); }
}

// a cookie banner (solid): a bar with a tiny cookie, two lines of "words" and an OK pill
export function drawBanner(g, w) {
  const len = Math.hypot(w.bx - w.ax, w.by - w.ay);
  const ang = Math.atan2(w.by - w.ay, w.bx - w.ax);
  g.save(); g.translate(w.ax, w.ay); g.rotate(ang);
  const r = w.r;
  roundRect(g, -r + 2.5, -r + 3.5, len + r * 2, r * 2, r); g.fillStyle = C.shadow; g.fill();
  roundRect(g, -r, -r, len + r * 2, r * 2, r); g.fillStyle = C.paper; g.fill(); g.lineWidth = 3.5; g.strokeStyle = C.ink; g.stroke();
  // the tiny cookie
  if (len > 60) {
    g.beginPath(); g.arc(4, 0, 6.5, 0, TAU); g.fillStyle = '#f2c780'; g.fill(); g.lineWidth = 2; g.stroke();
    g.fillStyle = C.pink; g.fillRect(2, -3, 2.4, 2.4); g.fillRect(5, 1, 2.4, 2.4);
    g.fillStyle = C.lav2;
    const words = Math.max(0, len - 70);
    if (words > 20) { roundRect(g, 18, -4.5, words * 0.8, 3.5, 1.7); g.fill(); roundRect(g, 18, 1.5, words * 0.55, 3.5, 1.7); g.fill(); }
    if (len > 110) { roundRect(g, len - 34, -7, 34, 14, 7); g.fillStyle = C.lav; g.fill(); g.lineWidth = 2; g.stroke(); }
  }
  g.restore();
}
// a bouncy button: "ACCEPT ALL" (squashes when the cookie bounces on it)
export function drawPad(g, w, squash = 0) {
  const len = Math.hypot(w.bx - w.ax, w.by - w.ay);
  const ang = Math.atan2(w.by - w.ay, w.bx - w.ax);
  g.save(); g.translate((w.ax + w.bx) / 2, (w.ay + w.by) / 2); g.rotate(ang);
  const r = w.r, h = r * 2 * (1 - squash * 0.35);
  const half = len / 2 + r;
  roundRect(g, -half + 2.5, -h / 2 + 3.5 + squash * 4, half * 2, h, h / 2); g.fillStyle = C.shadow; g.fill();
  roundRect(g, -half, -h / 2 + squash * 4, half * 2, h, h / 2); g.fillStyle = C.pink; g.fill(); g.lineWidth = 3.5; g.strokeStyle = C.ink; g.stroke();
  g.fillStyle = C.paper; g.font = `900 ${Math.min(13, h * 0.62)}px ${FONT.display}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(len > 70 ? 'ACCEPT ALL' : 'OK', 0, squash * 4 + 1);
  g.restore();
}

// a cooling fan: its blades turn (fast for a moment after a puff); its nozzle faces where it blows
export function drawFan(g, f, spin, puff = 0) {
  const ang = Math.atan2(f.dy, f.dx);
  g.save(); g.translate(f.x, f.y);
  // the air it pushes (a soft cone while it puffs)
  if (puff > 0) {
    g.save(); g.rotate(ang);
    const a = puff;
    const grd = g.createLinearGradient(20, 0, 220, 0);
    grd.addColorStop(0, `rgba(89,200,255,${0.32 * a})`); grd.addColorStop(1, 'rgba(89,200,255,0)');
    g.beginPath(); g.moveTo(22, -16); g.lineTo(230, -100); g.lineTo(230, 100); g.lineTo(22, 16); g.closePath();
    g.fillStyle = grd; g.fill();
    g.restore();
  }
  g.save(); g.rotate(ang);
  // the nozzle
  g.beginPath(); g.moveTo(14, -20); g.lineTo(38, -26); g.lineTo(38, 26); g.lineTo(14, 20); g.closePath();
  g.fillStyle = C.sky; g.fill(); g.lineWidth = 3.5; g.strokeStyle = C.ink; g.lineJoin = 'round'; g.stroke();
  g.lineWidth = 2.5; for (const y of [-12, 0, 12]) { g.beginPath(); g.moveTo(26, y); g.lineTo(36, y * 1.15); g.stroke(); }
  g.restore();
  // the housing
  roundRect(g, -26 + 2.5, -26 + 3.5, 52, 52, 12); g.fillStyle = C.shadow; g.fill();
  roundRect(g, -26, -26, 52, 52, 12); g.fillStyle = '#efe8ff'; g.fill(); g.lineWidth = 3.5; g.strokeStyle = C.ink; g.stroke();
  g.beginPath(); g.arc(0, 0, 20, 0, TAU); g.fillStyle = C.ink2; g.fill();
  g.save(); g.rotate(spin);
  g.fillStyle = C.lav;
  for (let i = 0; i < 5; i++) {
    g.save(); g.rotate((i / 5) * TAU);
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(10, -6, 17, -3); g.quadraticCurveTo(13, 4, 0, 0); g.fill();
    g.restore();
  }
  g.restore();
  g.beginPath(); g.arc(0, 0, 5.5, 0, TAU); g.fillStyle = C.honey; g.fill(); g.lineWidth = 2.5; g.strokeStyle = C.ink; g.stroke();
  for (const [x, y] of [[-19, -19], [19, -19], [-19, 19], [19, 19]]) { g.beginPath(); g.arc(x, y, 2.2, 0, TAU); g.fillStyle = C.ink; g.fill(); }
  g.restore();
}

// a pop-up window: an alert when it waits, a see-through bubble of a window around the cookie when it holds it
export function drawPopup(g, u, t, holding, close = 0) {
  const bob = holding ? Math.sin(t * 3.2) * 2 : Math.sin(t * 2 + u.hx * 0.01) * 2.5;
  const w = 96, h = 86;
  const x = u.x - w / 2, y = u.y - h / 2 + 6 + bob;
  g.save();
  if (close > 0) { const k = 1 + close * 0.25; g.translate(u.x, u.y); g.scale(k, k); g.translate(-u.x, -u.y); g.globalAlpha *= 1 - close; }
  roundRect(g, x + 3, y + 4, w, h, 12); g.fillStyle = C.shadow; g.fill();
  roundRect(g, x, y, w, h, 12);
  g.fillStyle = holding ? 'rgba(255,250,240,0.38)' : C.paper; g.fill();
  g.lineWidth = 3.5; g.strokeStyle = C.ink; g.stroke();
  // the title bar
  g.save(); roundRect(g, x, y, w, h, 12); g.clip();
  g.fillStyle = C.violet; g.fillRect(x, y, w, 22);
  g.fillStyle = 'rgba(255,255,255,0.85)';
  roundRect(g, x + 8, y + 8, 34, 5, 2.5); g.fill();
  g.restore();
  g.beginPath(); g.moveTo(x, y + 22); g.lineTo(x + w, y + 22); g.lineWidth = 3; g.strokeStyle = C.ink; g.stroke();
  // ✕
  const cx = x + w - 13, cy = y + 11;
  g.beginPath(); g.arc(cx, cy, 8.5, 0, TAU); g.fillStyle = C.pink; g.fill(); g.lineWidth = 2.5; g.strokeStyle = C.ink; g.stroke();
  g.lineWidth = 2.6; g.lineCap = 'round';
  g.beginPath(); g.moveTo(cx - 3.4, cy - 3.4); g.lineTo(cx + 3.4, cy + 3.4); g.moveTo(cx + 3.4, cy - 3.4); g.lineTo(cx - 3.4, cy + 3.4); g.stroke();
  if (!holding) {
    // "!": it wants your attention
    g.beginPath(); g.arc(u.x, y + 52, 17, 0, TAU); g.fillStyle = C.honey; g.fill(); g.lineWidth = 3; g.strokeStyle = C.ink; g.stroke();
    g.fillStyle = C.ink; g.font = `900 22px ${FONT.display}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('!', u.x, y + 53);
  }
  g.restore();
}

// a bug: a cute malware beetle (pink shell, ink head, wiggly legs and antennae)
export function drawBug(g, b, t, i = 0) {
  g.save(); g.translate(b.x, b.y);
  if (b.dir < 0) g.scale(-1, 1);
  const wig = Math.sin(t * 14 + i) * 0.25;
  g.lineCap = 'round'; g.lineJoin = 'round';
  // legs
  g.strokeStyle = C.ink; g.lineWidth = 3;
  for (const [k, s] of [[-9, 1], [0, -1], [9, 1]]) {
    g.beginPath(); g.moveTo(k, -14); g.lineTo(k + 4 * Math.sin(t * 14 + k) , -23); g.stroke();
    g.beginPath(); g.moveTo(k, 14); g.lineTo(k - 4 * Math.sin(t * 14 + k) * s, 23); g.stroke();
  }
  // shell
  g.beginPath(); g.ellipse(2.5, 3.5, 20, 17, 0, 0, TAU); g.fillStyle = C.shadow; g.fill();
  g.beginPath(); g.ellipse(-2, 0, 20, 17, 0, 0, TAU); g.fillStyle = C.red; g.fill(); g.lineWidth = 3.5; g.stroke();
  g.beginPath(); g.moveTo(-22, 0); g.lineTo(14, 0); g.lineWidth = 2.5; g.stroke();
  g.fillStyle = C.ink;
  for (const [x, y, r] of [[-10, -8, 3.5], [-4, 8, 3], [5, -7, 2.6], [-13, 6, 2.4]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
  // head
  g.beginPath(); g.arc(18, 0, 10.5, 0, TAU); g.fillStyle = C.ink; g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(21, -4, 3.6, 0, TAU); g.fill(); g.beginPath(); g.arc(21, 4, 3.6, 0, TAU); g.fill();
  g.fillStyle = C.ink; g.beginPath(); g.arc(22.5, -4, 1.7, 0, TAU); g.fill(); g.beginPath(); g.arc(22.5, 4, 1.7, 0, TAU); g.fill();
  // antennae
  g.strokeStyle = C.ink; g.lineWidth = 2.5;
  for (const s of [-1, 1]) {
    g.beginPath(); g.moveTo(25, s * 5); g.quadraticCurveTo(32, s * (10 + wig * 6), 35, s * (14 + wig * 8)); g.stroke();
    g.beginPath(); g.arc(35, s * (14 + wig * 8), 2.6, 0, TAU); g.fillStyle = C.pink; g.fill();
  }
  g.restore();
}

// a browser tab used as a portal: the tab's opening faces (dx, dy); a swirl inside; a pair shares a color
export const TAB_COLORS = [C.honey, C.mint, C.sky];
export function drawTab(g, e, t, color, active = 0) {
  const ang = Math.atan2(e.dy, e.dx) + Math.PI / 2;     // the tab is drawn opening "up" (toward -y), then turned
  g.save(); g.translate(e.x, e.y); g.rotate(ang);
  const w = TAB_R * 2.1, h = TAB_R * 1.55;
  const path = () => {
    g.beginPath();
    g.moveTo(-w / 2 - 6, h / 2);
    g.quadraticCurveTo(-w / 2 + 2, h / 2, -w / 2 + 4, h / 2 - 8);
    g.lineTo(-w / 2 + 8, -h / 2 + 10);
    g.quadraticCurveTo(-w / 2 + 10, -h / 2, -w / 2 + 20, -h / 2);
    g.lineTo(w / 2 - 20, -h / 2);
    g.quadraticCurveTo(w / 2 - 10, -h / 2, w / 2 - 8, -h / 2 + 10);
    g.lineTo(w / 2 - 4, h / 2 - 8);
    g.quadraticCurveTo(w / 2 - 2, h / 2, w / 2 + 6, h / 2);
    g.closePath();
  };
  g.save(); g.translate(2.5, 3.5); path(); g.fillStyle = C.shadow; g.fill(); g.restore();
  path(); g.fillStyle = color; g.fill(); g.lineWidth = 3.5; g.strokeStyle = C.ink; g.stroke();
  // the swirl: a hole into the other tab
  g.save(); path(); g.clip();
  g.beginPath(); g.ellipse(0, 4, w * 0.3, h * 0.33, 0, 0, TAU); g.fillStyle = C.deep; g.fill();
  g.strokeStyle = color; g.lineWidth = 3; g.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const a0 = t * 4 + (i * TAU) / 3;
    g.beginPath(); g.ellipse(0, 4, w * 0.22 - i * 3, h * 0.24 - i * 2.4, 0, a0, a0 + 2.2); g.stroke();
  }
  g.restore();
  // a little "x" like a real tab
  g.lineWidth = 2.2; g.strokeStyle = C.ink; g.lineCap = 'round';
  g.beginPath(); g.moveTo(w / 2 - 22, -h / 2 + 8); g.lineTo(w / 2 - 16, -h / 2 + 14); g.moveTo(w / 2 - 16, -h / 2 + 8); g.lineTo(w / 2 - 22, -h / 2 + 14); g.stroke();
  if (active > 0) { g.beginPath(); g.ellipse(0, 4, w * 0.3 + 6 * active, h * 0.33 + 6 * active, 0, 0, TAU); g.lineWidth = 3; g.strokeStyle = `rgba(255,255,255,${active})`; g.stroke(); }
  g.restore();
}

// a tracker pixel: a mint square that wobbles, with a sparkle
export function drawPixel(g, p, t, i) {
  const wob = Math.sin(t * 3 + i * 2.1) * 0.16, bob = Math.sin(t * 2.2 + i) * 3;
  const s = 23;
  g.save(); g.translate(p.x, p.y + bob);
  const glow = g.createRadialGradient(0, 0, 4, 0, 0, 30);
  glow.addColorStop(0, 'rgba(63,240,195,0.35)'); glow.addColorStop(1, 'rgba(63,240,195,0)');
  g.fillStyle = glow; g.fillRect(-30, -30, 60, 60);
  g.rotate(wob);
  g.fillStyle = C.shadow; g.fillRect(-s / 2 + 2.5, -s / 2 + 3.5, s, s);
  g.fillStyle = C.mint; g.fillRect(-s / 2, -s / 2, s, s);
  g.lineWidth = 3.2; g.strokeStyle = C.ink; g.strokeRect(-s / 2, -s / 2, s, s);
  g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(-s / 2 + 4, -s / 2 + 4, 6, 6);
  g.restore();
  const tw = (Math.sin(t * 4.2 + i * 1.7) + 1) / 2;
  if (tw > 0.45) {
    g.save(); g.translate(p.x + 13, p.y - 13 + bob);
    star(g, 0, 0, 3 + tw * 5, 1.3, 4, 0); g.fillStyle = '#ffffff'; g.fill();
    g.restore();
  }
}

// a rope: a honey cable with an ink edge, smoothed through its points (`n` segments of chain `p`, x y px py each)
export function strokeRope(g, p, n, alpha = 1, offX = null) {
  if (n < 1) return;
  g.save();
  g.globalAlpha *= alpha;
  g.lineCap = 'round'; g.lineJoin = 'round';
  const path = () => {
    g.beginPath();
    g.moveTo(p[0], p[1]);
    for (let i = 1; i < n; i++) {
      const o = i * 4;
      const mx = (p[o] + p[o + 4]) / 2, my = (p[o + 1] + p[o + 5]) / 2;
      g.quadraticCurveTo(p[o], p[o + 1], mx, my);
    }
    const o = n * 4;
    if (offX) g.lineTo(offX[0], offX[1]); else g.lineTo(p[o], p[o + 1]);
  };
  path(); g.lineWidth = 8.5; g.strokeStyle = C.ink; g.stroke();
  g.lineWidth = 4.6; g.strokeStyle = C.honey; g.stroke();
  g.save(); g.translate(-0.8, -1); g.lineWidth = 1.6; g.strokeStyle = C.honey2; g.stroke(); g.restore();
  g.restore();
}

// ---------- the window and its page, drawn once a level (and size) ----------
const SITE_TAB = { recipes: 'Sugar cookies (+ my life story)', news: 'BREAKING: cat wants cookie', feed: 'your feed · 99+ new' };
export function windowLayer(site, scale, dpr) {
  const k = scale * dpr;
  const pad = 14;
  const c = make((WIN_W + pad * 2) * k, (WIN_H + pad * 2) * k);
  const g = c.getContext('2d');
  g.scale(k, k);
  g.translate(pad - WIN.l, pad - WIN.t);
  g.lineJoin = 'round'; g.lineCap = 'round';
  // the frame and its hard shadow
  roundRect(g, WIN.l + 9, WIN.t + 11, WIN_W, WIN_H, 28); g.fillStyle = 'rgba(8,3,24,0.55)'; g.fill();
  roundRect(g, WIN.l, WIN.t, WIN_W, WIN_H, 28); g.fillStyle = C.lav; g.fill();
  // the address row
  g.save(); roundRect(g, WIN.l, WIN.t, WIN_W, WIN_H, 28); g.clip();
  g.fillStyle = C.paper; g.fillRect(WIN.l, -46, WIN_W, 46);
  g.restore();
  // the page
  roundRect(g, 0, 0, 600, 900, 12);
  g.fillStyle = C.page; g.fill();
  g.save(); roundRect(g, 0, 0, 600, 900, 12); g.clip(); doodles(g, site.key); g.restore();
  // ink lines
  g.lineWidth = 3; g.strokeStyle = C.ink;
  roundRect(g, 0, 0, 600, 900, 12); g.stroke();
  g.beginPath(); g.moveTo(WIN.l, -46); g.lineTo(WIN.r, -46); g.stroke();
  g.lineWidth = 5;
  roundRect(g, WIN.l, WIN.t, WIN_W, WIN_H, 28); g.stroke();
  // three dots
  [[C.pink, 6], [C.honey, 30], [C.mint, 54]].forEach(([col, x]) => {
    g.beginPath(); g.arc(x, -65, 8, 0, TAU); g.fillStyle = col; g.fill(); g.lineWidth = 3; g.strokeStyle = C.ink; g.stroke();
  });
  // the tab
  const tx0 = 80, tx1 = 404;
  g.beginPath();
  g.moveTo(tx0 - 10, -46); g.quadraticCurveTo(tx0, -46, tx0, -56); g.lineTo(tx0, -68); g.quadraticCurveTo(tx0, -78, tx0 + 10, -78);
  g.lineTo(tx1 - 10, -78); g.quadraticCurveTo(tx1, -78, tx1, -68); g.lineTo(tx1, -56); g.quadraticCurveTo(tx1, -46, tx1 + 10, -46);
  g.fillStyle = C.paper; g.fill(); g.lineWidth = 3; g.strokeStyle = C.ink; g.stroke();
  g.fillStyle = C.paper; g.fillRect(tx0 + 1.5, -48, tx1 - tx0 - 3, 4);
  // favicon: a tiny cookie
  g.beginPath(); g.arc(tx0 + 18, -62, 8, 0, TAU); g.fillStyle = '#f2c780'; g.fill(); g.lineWidth = 2.2; g.stroke();
  g.fillStyle = C.pink; g.fillRect(tx0 + 14, -66, 3, 3); g.fillRect(tx0 + 19, -61, 3, 3);
  g.save();
  g.beginPath(); g.rect(tx0 + 32, -78, tx1 - tx0 - 60, 32); g.clip();
  g.fillStyle = C.ink; g.font = `800 15px ${FONT.sans}`; g.textBaseline = 'middle'; g.textAlign = 'left';
  g.fillText(SITE_TAB[site.key] || site.title, tx0 + 34, -61);
  g.restore();
  g.lineWidth = 2.2; g.strokeStyle = C.ink2;
  g.beginPath(); g.moveTo(tx1 - 22, -66); g.lineTo(tx1 - 14, -58); g.moveTo(tx1 - 14, -66); g.lineTo(tx1 - 22, -58); g.stroke();
  // + new tab
  g.lineWidth = 3; g.strokeStyle = C.ink2;
  g.beginPath(); g.moveTo(tx1 + 26, -68); g.lineTo(tx1 + 26, -56); g.moveTo(tx1 + 20, -62); g.lineTo(tx1 + 32, -62); g.stroke();
  // back, forward
  g.lineWidth = 3; g.strokeStyle = C.ink2;
  g.beginPath(); g.moveTo(14, -23); g.lineTo(6, -23); g.moveTo(10, -28); g.lineTo(5, -23); g.lineTo(10, -18); g.stroke();
  g.globalAlpha = 0.4;
  g.beginPath(); g.moveTo(30, -23); g.lineTo(38, -23); g.moveTo(34, -28); g.lineTo(39, -23); g.lineTo(34, -18); g.stroke();
  g.globalAlpha = 1;
  return { canvas: c, pad, k };
}
// the address bar's pill and the reload button (they change: the level, the pixels found)
export const ADDR = { x0: 84, x1: 478, y0: -38, y1: -8, reload: [60, -23] };
export function drawAddress(g, site, levelId, got, flash = 0, reloadHot = 0) {
  // reload ↻ (it retries the level)
  const [rx, ry] = ADDR.reload;
  g.save();
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (reloadHot > 0) { g.beginPath(); g.arc(rx, ry, 14, 0, TAU); g.fillStyle = `rgba(255,201,51,${0.5 * reloadHot})`; g.fill(); }
  g.lineWidth = 3; g.strokeStyle = C.ink2;
  g.beginPath(); g.arc(rx, ry, 7.5, -Math.PI * 0.15, Math.PI * 1.5); g.stroke();
  g.beginPath(); g.moveTo(rx + 1, ry - 11.5); g.lineTo(rx + 5.5, ry - 7.5); g.lineTo(rx + 0.5, ry - 4); g.stroke();
  // the pill
  roundRect(g, ADDR.x0, ADDR.y0, ADDR.x1 - ADDR.x0, ADDR.y1 - ADDR.y0, 15);
  g.fillStyle = '#f6f1ff'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = C.ink; g.stroke();
  // a little shield
  const sx = ADDR.x0 + 18, sy = -23;
  g.beginPath(); g.moveTo(sx, sy - 8); g.lineTo(sx + 7, sy - 5); g.lineTo(sx + 6, sy + 3); g.quadraticCurveTo(sx, sy + 9, sx, sy + 9); g.quadraticCurveTo(sx, sy + 9, sx - 6, sy + 3); g.lineTo(sx - 7, sy - 5); g.closePath();
  g.fillStyle = C.mint; g.fill(); g.lineWidth = 2; g.strokeStyle = C.ink; g.stroke();
  g.font = `600 15px ${FONT.mono}`; g.textBaseline = 'middle'; g.textAlign = 'left';
  g.fillStyle = C.ink2; g.fillText('cookies.agi1.app/', ADDR.x0 + 34, -22.5);
  const w = g.measureText('cookies.agi1.app/').width;
  g.fillStyle = C.ink; g.font = `700 15px ${FONT.mono}`;
  g.fillText(`${site.key}/${levelId}`, ADDR.x0 + 34 + w, -22.5);
  g.restore();
  // the three pixel slots
  for (let i = 0; i < 3; i++) {
    const x = 504 + i * 30, y = -23, s = 18;
    const on = i < got;
    const pop = on && flash > 0 && i === got - 1 ? 1 + flash * 0.5 : 1;
    g.save(); g.translate(x, y); g.scale(pop, pop);
    g.fillStyle = on ? C.mint : '#ebe3fb'; g.fillRect(-s / 2, -s / 2, s, s);
    g.lineWidth = 2.5; g.strokeStyle = on ? C.ink : 'rgba(23,10,54,0.35)'; g.strokeRect(-s / 2, -s / 2, s, s);
    if (on) { g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(-s / 2 + 3, -s / 2 + 3, 4.5, 4.5); }
    g.restore();
  }
}

// soft site doodles behind the game (low contrast: the stickers stay the stars)
function doodles(g, key) {
  const D = C.doodle, D2 = C.doodle2;
  const bar = (x, y, w, h = 9) => { roundRect(g, x, y, w, h, h / 2); g.fill(); };
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (key === 'recipes') {
    // a recipe blog: its title, a hero photo with a whisk and a rolling pin, the life story, the ingredients, "jump to recipe"
    g.fillStyle = D2; g.font = `900 46px ${FONT.display}`; g.textBaseline = 'top'; g.textAlign = 'left';
    g.globalAlpha = 0.55; g.fillText('SUGAR COOKIES', 34, 28); g.globalAlpha = 1;
    g.fillStyle = D; bar(36, 88, 230); bar(36, 104, 170);
    roundRect(g, 36, 136, 528, 210, 18); g.fillStyle = '#ebe2fc'; g.fill();
    g.strokeStyle = D2; g.lineWidth = 5;
    // whisk
    g.beginPath(); g.moveTo(410, 312); g.lineTo(470, 230); g.stroke();
    for (const s of [-1, 0, 1]) { g.beginPath(); g.ellipse(486 + s * 2, 206, 14 + Math.abs(s) * 6, 34, 0.6, 0, TAU); g.stroke(); }
    // rolling pin
    roundRect(g, 120, 262, 190, 34, 17); g.stroke(); g.beginPath(); g.moveTo(90, 279); g.lineTo(120, 279); g.moveTo(310, 279); g.lineTo(340, 279); g.stroke();
    // little stars of sugar
    g.fillStyle = D2; for (const [x, y] of [[90, 180], [180, 200], [260, 168], [340, 214], [540, 300]]) { star(g, x, y, 7, 2.6, 4); g.fill(); }
    g.fillStyle = D;
    for (let i = 0; i < 9; i++) bar(36, 378 + i * 22, 300 + ((i * 97) % 220));
    roundRect(g, 36, 590, 250, 210, 16); g.lineWidth = 4; g.strokeStyle = D; g.stroke();
    g.fillStyle = D2; g.font = `900 20px ${FONT.display}`; g.globalAlpha = 0.6; g.fillText('INGREDIENTS', 54, 606); g.globalAlpha = 1;
    for (let i = 0; i < 6; i++) { g.strokeStyle = D2; g.lineWidth = 3; g.strokeRect(56, 644 + i * 24, 12, 12); g.fillStyle = D; bar(78, 646 + i * 24, 120 + ((i * 53) % 70), 8); }
    roundRect(g, 330, 610, 220, 46, 23); g.fillStyle = '#e8ddfc'; g.fill();
    g.fillStyle = D2; g.font = `900 16px ${FONT.display}`; g.globalAlpha = 0.7; g.fillText('JUMP TO RECIPE ↓', 352, 624); g.globalAlpha = 1;
    g.fillStyle = D; for (let i = 0; i < 4; i++) bar(330, 690 + i * 22, 200 - i * 30);
  } else if (key === 'news') {
    // a news site: the masthead, column rules, headlines, a photo, a ticker
    g.fillStyle = D2; g.font = `900 40px ${FONT.display}`; g.textBaseline = 'top'; g.textAlign = 'center';
    g.globalAlpha = 0.55; g.fillText('THE DAILY CRUMB', 300, 26); g.globalAlpha = 1;
    g.strokeStyle = D2; g.lineWidth = 3;
    g.beginPath(); g.moveTo(30, 80); g.lineTo(570, 80); g.moveTo(30, 88); g.lineTo(570, 88); g.stroke();
    g.fillStyle = D; g.textAlign = 'left';
    roundRect(g, 30, 104, 120, 26, 13); g.fillStyle = '#f7d9ea'; g.fill();
    g.fillStyle = '#eab6d2'; g.font = `900 14px ${FONT.display}`; g.fillText('BREAKING', 46, 110);
    g.fillStyle = D; bar(30, 146, 520, 16); bar(30, 172, 380, 16);
    g.beginPath(); g.moveTo(300, 210); g.lineTo(300, 860); g.strokeStyle = D; g.lineWidth = 3; g.stroke();
    roundRect(g, 30, 214, 254, 170, 14); g.fillStyle = '#ebe2fc'; g.fill();
    g.strokeStyle = D2; g.lineWidth = 4; g.beginPath(); g.moveTo(44, 370); g.lineTo(110, 300); g.lineTo(160, 340); g.lineTo(210, 280); g.lineTo(270, 370); g.stroke();
    g.beginPath(); g.arc(230, 250, 16, 0, TAU); g.stroke();
    g.fillStyle = D;
    for (let i = 0; i < 18; i++) bar(30, 404 + i * 22, 180 + ((i * 71) % 74));
    for (let i = 0; i < 6; i++) bar(316, 214 + i * 22, 190 + ((i * 41) % 60));
    roundRect(g, 316, 360, 254, 150, 14); g.fillStyle = '#ebe2fc'; g.fill();
    g.fillStyle = D; for (let i = 0; i < 14; i++) bar(316, 530 + i * 22, 170 + ((i * 59) % 80));
  } else {
    // a social feed: post cards with avatars, hearts and comments
    for (const [y, h] of [[24, 250], [296, 280], [598, 290]]) {
      roundRect(g, 30, y, 540, h, 20); g.fillStyle = '#efe7fd'; g.fill(); g.lineWidth = 3; g.strokeStyle = D; g.stroke();
      g.beginPath(); g.arc(70, y + 40, 22, 0, TAU); g.fillStyle = D2; g.fill();
      g.fillStyle = D; bar(104, y + 26, 140, 10); bar(104, y + 44, 90, 8);
      roundRect(g, 50, y + 80, 500, h - 140, 14); g.fillStyle = '#e8defc'; g.fill();
      g.strokeStyle = D2; g.lineWidth = 4;
      const hy = y + h - 34;
      g.beginPath(); g.moveTo(66, hy + 4); g.bezierCurveTo(56, hy - 8, 74, hy - 14, 76, hy - 2); g.bezierCurveTo(78, hy - 14, 96, hy - 8, 86, hy + 4); g.lineTo(76, hy + 12); g.closePath(); g.stroke();
      roundRect(g, 112, hy - 12, 28, 22, 8); g.stroke();
      g.fillStyle = D; bar(160, hy - 4, 70, 8);
    }
  }
}

// the desktop behind the window: deep violet with a soft lavender glow and a scatter of tiny stars
export function desktopLayer(w, h, dpr) {
  const c = make(w * dpr, h * dpr);
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  g.fillStyle = C.deep; g.fillRect(0, 0, w, h);
  const grd = g.createRadialGradient(w / 2, h * 0.45, 10, w / 2, h * 0.5, Math.max(w, h) * 0.7);
  grd.addColorStop(0, 'rgba(107,59,255,0.28)'); grd.addColorStop(1, 'rgba(107,59,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  // a dotted desktop grid
  g.fillStyle = 'rgba(205,184,255,0.10)';
  const step = 26;
  for (let y = step / 2; y < h; y += step) for (let x = step / 2; x < w; x += step) { g.beginPath(); g.arc(x, y, 1.3, 0, TAU); g.fill(); }
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  g.fillStyle = 'rgba(255,250,240,0.55)';
  for (let i = 0; i < Math.round((w * h) / 26000); i++) { const x = rnd() * w, y = rnd() * h; star(g, x, y, 2 + rnd() * 3, 0.8, 4); g.fill(); }
  return c;
}

export { POP_R, BUG_R, TAB_R, COOKIE_R, PIXEL_R };
