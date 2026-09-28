// The Arena's latest champion on the stage (Phase 6): a card floating above the floor dial with the coin's logo,
// ticker, name and round. Drawn on a canvas in the site's own colors (read from tokens.css, so both themes match), in the
// lab style: hairlines, Geist, one accent dot. The "Buy on clank.trade" link and the "not financial advice" note are
// plain HTML over the stage (index.html), so they work with the keyboard and screen readers.
import * as THREE from 'three';

const W = 512, H = 640;                       // texture size (px); the card is 1.12 × 1.4 units on the stage
const SANS = 'Geist, ui-sans-serif, system-ui, sans-serif';
const MONO = '"Geist Mono", ui-monospace, monospace';
const css = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

const loadImage = (src) => new Promise((resolve) => {
  if (!src) { resolve(null); return; }
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = src;                              // same address as the page (/images/… or /api/logo), so WebGL may use it
});

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
// the biggest size (from `px` down) at which `text` fits in `width`
function fitFont(ctx, text, width, px, weight, family, min = 22) {
  for (; px > min; px -= 2) {
    ctx.font = `${weight} ${px}px ${family}`;
    if (ctx.measureText(text).width <= width) return px;
  }
  ctx.font = `${weight} ${min}px ${family}`;
  return min;
}
// cut `text` with "…" so it fits in `width` with the current font
function ellipsize(ctx, text, width) {
  if (ctx.measureText(text).width <= width) return text;
  const chars = [...text];
  while (chars.length > 1 && ctx.measureText(`${chars.join('')}…`).width > width) chars.pop();
  return `${chars.join('').trimEnd()}…`;
}

export function createChampionCard({ maxAnisotropy = 1 } = {}) {
  const front = document.createElement('canvas');
  const back = document.createElement('canvas');
  front.width = back.width = W;
  front.height = back.height = H;
  const texture = (canvas) => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(4, maxAnisotropy);
    return t;
  };
  const frontTexture = texture(front), backTexture = texture(back);
  const geometry = new THREE.PlaneGeometry(1.12, 1.4);
  const material = (map) => new THREE.MeshBasicMaterial({ map, transparent: true, toneMapped: false });
  const frontMesh = new THREE.Mesh(geometry, material(frontTexture));
  const backMesh = new THREE.Mesh(geometry, material(backTexture));
  backMesh.rotation.y = Math.PI;              // readable (not mirrored) from behind
  const group = new THREE.Group();
  group.add(frontMesh, backMesh);

  let data = null, logo = null, token = 0;

  function frame(ctx, c) {
    ctx.clearRect(0, 0, W, H);
    roundRect(ctx, 4, 4, W - 8, H - 8, 34);
    ctx.fillStyle = c.bg;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = c.line;
    ctx.stroke();
  }
  function draw() {
    const c = { bg: css('--bg', '#fafaf8'), panel: css('--bg-2', '#f1f1ee'), line: css('--line', '#e3e3de'), fg: css('--fg', '#111111'), fg2: css('--fg-2', '#5c5c57'), fg3: css('--fg-3', '#6a6a64'), accent: css('--accent', '#c7285f') };
    const sym = data ? `$${data.coin}` : '';
    // ---- front ----
    let ctx = front.getContext('2d');
    frame(ctx, c);
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = c.accent;
    ctx.beginPath();
    ctx.arc(52, 66, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `500 23px ${MONO}`;
    ctx.fillStyle = c.fg2;
    ctx.textAlign = 'left';
    ctx.fillText('Arena champion', 70, 74);
    ctx.textAlign = 'right';
    ctx.fillStyle = c.fg3;
    ctx.fillText(data ? `#${data.number}` : '', W - 40, 74);
    // the logo in a circle (the ticker's first letter when there's no picture)
    const cx = W / 2, cy = 250, r = 124;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = c.panel;
    ctx.fill();
    ctx.clip();
    if (logo) {
      const s = Math.max((2 * r) / logo.naturalWidth, (2 * r) / logo.naturalHeight);   // cover the circle
      const w = logo.naturalWidth * s, h = logo.naturalHeight * s;
      ctx.drawImage(logo, cx - w / 2, cy - h / 2, w, h);
    } else if (data) {
      ctx.fillStyle = c.fg2;
      ctx.textAlign = 'center';
      ctx.font = `600 120px ${SANS}`;
      ctx.fillText(data.coin.slice(0, 1), cx, cy + 42);
    }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = c.line;
    ctx.stroke();
    // ticker and name
    ctx.textAlign = 'center';
    ctx.fillStyle = c.fg;
    fitFont(ctx, sym, W - 90, 66, 600, SANS, 30);
    ctx.fillText(sym, cx, 458);
    ctx.fillStyle = c.fg2;
    ctx.font = `400 27px ${SANS}`;
    ctx.fillText(ellipsize(ctx, data?.name || '', W - 100), cx, 502);
    ctx.fillStyle = c.line;
    ctx.fillRect(40, 546, W - 80, 2);
    ctx.fillStyle = c.fg3;
    ctx.font = `400 22px ${MONO}`;
    ctx.fillText(data ? `${data.votes} vote${data.votes === 1 ? '' : 's'} · one per human` : '', cx, 594);
    frontTexture.needsUpdate = true;
    // ---- back ----
    ctx = back.getContext('2d');
    frame(ctx, c);
    ctx.textAlign = 'center';
    ctx.fillStyle = c.fg;
    fitFont(ctx, sym, W - 90, 72, 600, SANS, 30);
    ctx.fillText(sym, W / 2, 300);
    ctx.fillStyle = c.fg2;
    ctx.font = `500 24px ${MONO}`;
    ctx.fillText('Arena champion', W / 2, 356);
    ctx.fillStyle = c.fg3;
    ctx.font = `400 22px ${MONO}`;
    ctx.fillText('AGI', W / 2, H - 56);
    backTexture.needsUpdate = true;
  }

  return {
    group,
    hit: frontMesh,
    get data() { return data; },
    // new champion (or the same one with new numbers): redraw, with its logo once it has loaded
    async set(next) {
      const my = ++token;
      const sameLogo = data && next && data.logoLarge === next.logoLarge;
      data = next;
      if (!sameLogo) logo = null;
      draw();
      try { await Promise.all([document.fonts.load(`600 66px ${SANS}`), document.fonts.load(`500 23px ${MONO}`)]); } catch { /* system fonts */ }
      const img = !sameLogo && next?.logoLarge ? await loadImage(next.logoLarge) : logo;
      if (my !== token) return;                   // a newer champion arrived meanwhile
      logo = img;
      draw();                                     // again, with the site's fonts and the logo
    },
    redraw: draw,                                 // the theme changed
    dispose() {
      geometry.dispose();
      for (const m of [frontMesh.material, backMesh.material]) m.dispose();
      frontTexture.dispose();
      backTexture.dispose();
    },
  };
}
