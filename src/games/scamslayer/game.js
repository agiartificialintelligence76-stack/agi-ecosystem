// temporary: a sprite sheet for checking the art
import './style.css';
import { createShell } from '../kit/shell.js';
import { fitCanvas } from '../kit/canvas.js';
import { buildSprites, createHalves } from './art.js';
import { KINDS } from './kinds.js';
import { buildScene } from './scene.js';

const shell = createShell({ game: 'scamslayer', name: 'SCAM SLAYER', root: document.getElementById('ak-root') });
const canvas = document.createElement('canvas');
shell.stage.append(canvas);
const view = fitCanvas(canvas, { maxDpr: 2 });
shell.started({ count: false });
(async () => {
  try { await Promise.all([document.fonts.load("900 40px 'AK Display'"), document.fonts.load("italic 20px 'AK Serif'")]); } catch { /* fine */ }
  const ctx = view.begin();
  ctx.fillStyle = '#1b0f38'; ctx.fillRect(0, 0, view.w, view.h);
  if (new URLSearchParams(location.search).has('scene')) {
    const sc = buildScene(view.w, view.h);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(sc.back, -sc.m, -sc.m, view.w + sc.m * 2, view.h + sc.m * 2);
    ctx.drawImage(sc.room, -sc.m, -sc.m, view.w + sc.m * 2, view.h + sc.m * 2);
    return;
  }
  const px = Number(new URLSearchParams(location.search).get('px') || 1.2);
  const sprites = buildSprites(px * view.dpr);
  const halves = createHalves();
  const kinds = Object.keys(KINDS);
  const cols = Math.max(3, Math.floor(view.w / (px * 150)));
  kinds.forEach((k, i) => {
    const sp = sprites[k];
    const x = 20 + (i % cols) * px * 150, y = 80 + Math.floor(i / cols) * px * 150;
    const s = sp.S / view.dpr;
    ctx.globalAlpha = 0.5; ctx.drawImage(sp.shadow, x + 4, y + 6, s, s); ctx.globalAlpha = 1;
    ctx.drawImage(sp.canvas, x, y, s, s);
  });
  // halves of a few
  const y0 = 80 + Math.ceil(kinds.length / cols) * px * 150;
  ['airdrop', 'seed', 'rug', 'heart'].forEach((k, i) => {
    const sp = sprites[k];
    const s = sp.S / view.dpr;
    for (const side of [1, -1]) {
      const cv = halves.make(sp, 0.6, 6, side, KINDS[k].inner, px * view.dpr);
      ctx.drawImage(cv, 20 + i * px * 170 + (side > 0 ? 18 : 0), y0 + (side > 0 ? 14 : 0), s, s);
    }
  });
})();
