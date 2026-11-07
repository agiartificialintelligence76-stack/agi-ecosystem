// JAYWALK (2026-11-08): a quick look at the characters without a browser: each voxel model drawn by the game's own
// software rasterizer (src/games/jaywalk/thumb.js) from the game's camera (high, behind her) and from the front, as a
// raw RGBA file per model; tools/games/jaywalk/look.py turns them into one contact sheet (PNG).
//   node tools/games/jaywalk/look.mjs <out-dir>  &&  python3 tools/games/jaywalk/look.py <out-dir>
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { rasterize } from '../../../src/games/jaywalk/thumb.js';
import { CHARACTER_MODELS } from '../../../src/games/jaywalk/models.js';

const out = process.argv[2] || 'jaywalk-look';
mkdirSync(out, { recursive: true });
const S = 200;
const views = { back: { yaw: Math.PI + 0.33, pitch: 0.84 }, front: { yaw: -0.62, pitch: 0.32 } };
for (const id of Object.keys(CHARACTER_MODELS)) {
  for (const [name, v] of Object.entries(views)) {
    const px = rasterize(CHARACTER_MODELS[id](), S, { ...v, outline: 3, pad: 0.08 });
    writeFileSync(join(out, `${id}-${name}.rgba`), Buffer.from(px.buffer));
  }
}
console.log('done', out, S);
