// ROBOTAXI RUSH: every sprite on one page, for looking at them (a QA tool: never shipped, never linked).
// Open /tools/games/robotaxi/sheet.html on the dev server.
import '../../../src/games/kit/kit.css';
import { buildSprites, playerSprite } from '../../../src/games/robotaxi/sprites.js';

const portrait = new Image();
portrait.src = '/images/agi1-portrait.webp';
await Promise.all([document.fonts.load("900 40px 'AK Display'"), portrait.decode().catch(() => {})]);
const S = buildSprites(portrait);
const c = document.getElementById('sheet');
const W = 1400, H = 1500;
c.width = W; c.height = H; c.style.width = `${W}px`;
const g = c.getContext('2d');
g.fillStyle = '#3a2a6a'; g.fillRect(0, 0, W, H);
let x = 10, y = 10, row = 0;
const put = (sp, w) => {
  const img = sp.levels ? sp.levels[0] : sp.canvas;
  const h = (img.height / img.width) * w;
  if (x + w > W - 10) { x = 10; y += row + 14; row = 0; }
  g.drawImage(img, x, y, w, h);
  x += w + 14; row = Math.max(row, h);
};
for (const t of Object.keys(S.cars)) for (const v of S.cars[t]) put(v, 150);
for (const l of [-1, -0.5, 0, 0.5, 1]) put(playerSprite(220, l), 180);
put(S.palm.dusk, 120); put(S.palm.coast, 120); put(S.lampL, 80); put(S.lampR, 80);
for (const n of S.neon) put(n, 140);
for (const b of S.billboard) put(b, 260);
put(S.chevronL, 70); put(S.chevronR, 70); put(S.post, 24);
for (const gt of S.gantry) put(gt, 330);
put(S.gate, 420); put(S.umbrella, 120); put(S.tower, 120);
for (const b of S.building) put(b, 70);
put(S.fare, 80); put(S.shield, 80);
for (const k of Object.keys(S.glow)) { g.drawImage(S.glow[k], x, y, 60, 60); x += 70; }
g.drawImage(S.shadow, x, y + 20, 160, 40);
