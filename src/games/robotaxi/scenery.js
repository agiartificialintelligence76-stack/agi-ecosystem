// ROBOTAXI RUSH: the sky behind the road, per zone: its colors, the sun (striped at dusk, rising on the coast), the moon
// and stars at night, clouds in the rain, and two rows of skyline that slide sideways with the road's curves. Each row is
// drawn once onto a strip (redrawn when the screen changes size) and tiled.
import { makeCanvas } from './sprites.js';
import { LOOKS, INK, PAPER, HONEY, PINK } from './zones.js';

function die(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// a row of buildings with lit windows (px: the strip's size in device pixels, k: device pixels per CSS pixel)
function cityStrip(w, h, k, look, seed, { tall = 1, antennas = false } = {}) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  const r = die(seed);
  let x = -10 * k;
  const winW = Math.max(2, Math.round(2.6 * k)), winH = Math.max(2, Math.round(3.2 * k)), gapX = Math.round(5 * k), gapY = Math.round(6.5 * k);
  while (x < w) {
    const bw = Math.round((18 + r() * 46) * k * (0.8 + 0.4 * tall));
    const bh = Math.round(h * (0.25 + r() * 0.72) * Math.min(1, tall));
    const top = h - bh;
    g.fillStyle = look.color;
    g.fillRect(x, top, bw, bh);
    if (r() < 0.35) g.fillRect(x + bw * 0.25, top - 8 * k, bw * 0.5, 8 * k);
    if (antennas && r() < 0.4) {
      g.fillRect(x + bw * 0.5 - k, top - 26 * k, 2 * k, 26 * k);
      g.fillStyle = PINK; g.fillRect(x + bw * 0.5 - 1.5 * k, top - 28 * k, 3 * k, 3 * k);
    }
    for (let yy = top + gapY; yy < h - gapY; yy += gapY) {
      for (let xx = x + gapX * 0.6; xx < x + bw - winW - gapX * 0.4; xx += gapX) {
        if (r() < look.lit) { g.fillStyle = look.windows[Math.floor(r() * look.windows.length)]; g.fillRect(Math.round(xx), Math.round(yy), winW, winH); }
      }
    }
    x += bw + Math.round(r() * 6 * k);
  }
  return c;
}

function mountainStrip(w, h, k, look, seed) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  const r = die(seed);
  const pts = [];
  const n = 9;
  for (let i = 0; i <= n; i++) pts.push([(i / n) * w, h * (0.2 + r() * 0.62)]);
  pts[n][1] = pts[0][1];
  // peaks between the points (a ridge that wraps around the strip's ends)
  const ridge = [];
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    ridge.push([x0, y0]);
    ridge.push([(x0 + x1) / 2 + (r() - 0.5) * w * 0.03, Math.max(h * 0.05, Math.min(y0, y1) - h * (0.12 + r() * 0.3))]);
  }
  ridge.push(pts[n]);
  g.beginPath(); g.moveTo(0, h);
  for (const [x, y] of ridge) g.lineTo(x, y);
  g.lineTo(w, h); g.closePath();
  g.fillStyle = look.color; g.fill();
  // its edge lit pink, and a few lines down its slopes
  g.lineJoin = 'round';
  g.beginPath(); for (let i = 0; i < ridge.length; i++) { const [x, y] = ridge[i]; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
  g.strokeStyle = look.rim; g.lineWidth = 2.2 * k; g.stroke();
  g.globalAlpha = 0.35;
  for (let i = 1; i < ridge.length - 1; i += 2) { const [x, y] = ridge[i]; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * w * 0.04, h); g.lineWidth = 1.4 * k; g.stroke(); }
  g.globalAlpha = 1;
  return c;
}

function islesStrip(w, h, k, look, seed) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  const r = die(seed);
  for (let i = 0; i < 3; i++) {
    const cx = (0.12 + i * 0.33 + r() * 0.12) * w, iw = (0.1 + r() * 0.14) * w, ih = h * (0.28 + r() * 0.5);
    g.beginPath(); g.moveTo(cx - iw / 2, h);
    g.bezierCurveTo(cx - iw * 0.35, h - ih, cx + iw * 0.2, h - ih * 1.1, cx + iw / 2, h);
    g.closePath(); g.fillStyle = look.color; g.fill();
    g.strokeStyle = look.rim; g.lineWidth = 1.6 * k; g.stroke();
    if (i === 1) {
      const lx = cx + iw * 0.05, ly = h - ih * 0.95;
      g.fillStyle = PAPER; g.fillRect(lx - 3 * k, ly - 20 * k, 6 * k, 20 * k);
      g.fillStyle = PINK; g.fillRect(lx - 3 * k, ly - 13 * k, 6 * k, 4 * k);
      g.fillStyle = HONEY; g.beginPath(); g.arc(lx, ly - 22 * k, 3 * k, 0, 7); g.fill();
    }
  }
  return c;
}

function hillStrip(w, h, k, look, seed) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  const r = die(seed);
  g.fillStyle = look.color;
  for (let i = 0; i < 2; i++) {
    const cx = (0.2 + i * 0.5 + r() * 0.1) * w, hw = (0.12 + r() * 0.08) * w, hh = h * (0.35 + r() * 0.4);
    g.beginPath(); g.moveTo(cx - hw, h); g.quadraticCurveTo(cx, h - hh * 2, cx + hw, h); g.closePath(); g.fill();
  }
  return c;
}

function stars(w, h, k, seed, density) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  const r = die(seed);
  const n = Math.round((w * h) / (k * k) / 2600 * density);
  for (let i = 0; i < n; i++) {
    const y = Math.pow(r(), 1.6) * h;
    g.globalAlpha = 0.25 + r() * 0.7 * (1 - y / h);
    g.fillStyle = r() < 0.15 ? HONEY : r() < 0.3 ? '#cdb8ff' : PAPER;
    const s = (r() < 0.08 ? 2.2 : 1.2) * k;
    g.fillRect(r() * w, y, s, s);
  }
  g.globalAlpha = 1;
  return c;
}

function clouds(w, h, k, seed) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  const r = die(seed);
  for (let band = 0; band < 3; band++) {
    const y0 = h * (0.15 + band * 0.26);
    g.fillStyle = ['#1a2740', '#22324f', '#2b3d5e'][band];
    for (let i = 0; i < 9; i++) {
      const cx = r() * w, rx = (60 + r() * 120) * k, ry = (12 + r() * 20) * k;
      for (const dx of [-w, 0, w]) { g.beginPath(); g.ellipse(cx + dx, y0 + r() * 20 * k, rx, ry, 0, 0, 7); g.fill(); }
    }
  }
  return c;
}

// the sun: striped at dusk, a soft big one rising on the coast; the moon at night
function sun(kind, d) {
  const c = makeCanvas(d * 1.6, d * 1.6);
  const g = c.getContext('2d');
  const cx = c.width / 2, cy = c.height / 2, r = d / 2;
  if (kind === 'striped') {
    const halo = g.createRadialGradient(cx, cy, r * 0.8, cx, cy, r * 1.6);
    halo.addColorStop(0, 'rgba(255,120,150,.35)'); halo.addColorStop(1, 'rgba(255,120,150,0)');
    g.fillStyle = halo; g.fillRect(0, 0, c.width, c.height);
    const gr = g.createLinearGradient(0, cy - r, 0, cy + r);
    gr.addColorStop(0, '#ffe066'); gr.addColorStop(0.45, '#ffb347'); gr.addColorStop(1, '#ff4da6');
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 7; i++) {
      const y = cy + r * (0.02 + i * 0.15), hh = r * (0.022 + i * 0.016);
      g.fillRect(cx - r - 2, y, r * 2 + 4, hh);
    }
    g.globalCompositeOperation = 'source-over';
  } else if (kind === 'sunrise') {
    for (let i = 4; i >= 1; i--) { g.fillStyle = `rgba(255,236,190,${0.13 + (4 - i) * 0.05})`; g.beginPath(); g.arc(cx, cy, r * (1 + i * 0.16), 0, 7); g.fill(); }
    const gr = g.createRadialGradient(cx, cy - r * 0.2, r * 0.1, cx, cy, r);
    gr.addColorStop(0, '#fffbe8'); gr.addColorStop(1, '#ffd98a');
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  } else if (kind === 'moon') {
    const halo = g.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 1.7);
    halo.addColorStop(0, 'rgba(205,184,255,.25)'); halo.addColorStop(1, 'rgba(205,184,255,0)');
    g.fillStyle = halo; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = PAPER; g.beginPath(); g.arc(cx, cy, r * 0.62, 0, 7); g.fill();
    g.globalCompositeOperation = 'destination-out';
    g.beginPath(); g.arc(cx + r * 0.3, cy - r * 0.18, r * 0.56, 0, 7); g.fill();
    g.globalCompositeOperation = 'source-over';
  }
  return c;
}

export function createScenery() {
  const cache = new Map();
  let sizeKey = '';

  function build(zone, W, skyH, dpr) {
    const look = LOOKS[zone];
    const k = dpr;
    const tileW = Math.round(Math.max(W, 700) * 1.3 * k);
    const nearH = Math.round(Math.min(skyH * 0.42, 170) * k);
    const farH = Math.round(Math.min(skyH * 0.3, 120) * k);
    const seed = zone.length * 977;
    const strip = (spec, h, s) => {
      if (spec.kind === 'city') return cityStrip(tileW, h, k, spec, s, spec);
      if (spec.kind === 'mountains') return mountainStrip(tileW, h, k, spec, s);
      if (spec.kind === 'isles') return islesStrip(tileW, h, k, spec, s);
      return hillStrip(tileW, h, k, spec, s);
    };
    const sunD = Math.round(Math.min(W * 0.46, skyH * 0.9, 380) * k);
    return {
      look, k, tileW,
      far: strip(look.far, farH, seed + 1),
      near: strip(look.near, nearH, seed + 2),
      stars: look.stars ? stars(tileW, Math.round(skyH * k), k, seed + 3, look.stars) : null,
      clouds: look.sun === 'clouds' ? clouds(tileW, Math.round(skyH * 0.6 * k), k, seed + 4) : null,
      sun: look.sun === 'striped' || look.sun === 'sunrise' || look.sun === 'moon' ? sun(look.sun, look.sun === 'moon' ? Math.round(sunD * 0.32) : sunD) : null,
      grad: null, gradKey: '',
    };
  }

  function get(zone, W, skyH, dpr) {
    const key = `${W}|${Math.round(skyH)}|${dpr}`;
    if (key !== sizeKey) { cache.clear(); sizeKey = key; }
    let s = cache.get(zone);
    if (!s) { s = build(zone, W, skyH, dpr); cache.set(zone, s); }
    return s;
  }

  const tile = (g, img, x, y, w, h) => {
    // draw a strip tiled across the screen, starting at x (CSS px; any value)
    let sx = ((x % w) + w) % w - w;
    for (; sx < tileEnd; sx += w) if (sx + w > 0) g.drawImage(img, sx, y, w, h);
  };

  // draw a zone's sky into ctx (CSS pixels), `pan` (0..1 of a strip) from the curves, `lift` from the hills
  let tileEnd = 0;
  function draw(g, zone, view, { pan = 0, lift = 0, time = 0, alpha = 1, flash = 0 } = {}) {
    const W = view.w, hz = view.horizon, skyH = Math.max(40, hz);
    tileEnd = W;
    const s = get(zone, W, skyH, view.dpr);
    const look = s.look;
    g.globalAlpha = alpha;
    // the sky's colors
    if (!s.grad || s.gradKey !== `${hz}`) {
      s.grad = g.createLinearGradient(0, 0, 0, hz);
      for (const [at, col] of look.sky) s.grad.addColorStop(at, col);
      s.gradKey = `${hz}`;
    }
    g.fillStyle = s.grad;
    g.fillRect(0, 0, W, hz + 2);
    const tw = s.tileW / s.k;
    if (s.stars) tile(g, s.stars, -pan * tw * 0.05, 0, tw, skyH);
    if (s.sun) {
      const d = s.sun.width / s.k;
      const moon = look.sun === 'moon';
      const x = W * (moon ? 0.78 : 0.5) - pan * tw * 0.06;
      const y = moon ? hz * 0.28 : look.sun === 'sunrise' ? hz - d * 0.08 + lift * 0.3 : hz - d * 0.34 + lift * 0.3;
      g.drawImage(s.sun, x - d / 2, y - d / 2, d, d);
    }
    if (s.clouds) {
      const ch = s.clouds.height / s.k;
      tile(g, s.clouds, -pan * tw * 0.12 - time * 6, hz * 0.04, tw, ch);
      if (flash > 0) { g.fillStyle = `rgba(200,220,255,${flash * 0.35})`; g.fillRect(0, 0, W, hz); }
    }
    const fh = s.far.height / s.k, nh = s.near.height / s.k;
    tile(g, s.far, -pan * tw * 0.3, hz - fh + 1 + lift * 0.5, tw, fh);
    tile(g, s.near, -pan * tw * 0.6 + tw * 0.37, hz - nh + 2 + lift, tw, nh);
    // the haze along the horizon
    const hh = Math.min(60, hz * 0.25);
    if (!s.haze || s.hazeKey !== `${hz}`) {
      s.haze = g.createLinearGradient(0, hz - hh, 0, hz + 2);
      s.haze.addColorStop(0, look.fog + '00'); s.haze.addColorStop(1, look.fog + 'cc');
      s.hazeKey = `${hz}`;
    }
    g.fillStyle = s.haze;
    g.fillRect(0, hz - hh, W, hh + 2);
    g.globalAlpha = 1;
  }

  return { draw, clear: () => cache.clear() };
}

export { INK };
