// AGI Studio's launch video: gets its pictures and video clips ready for the renderer, once. They're the example
// creations made for it with the same kinds of AI models AGI Studio uses (made-up people, AI-generated): photos, looks, full bodies, styles, memes, an X banner,
// trend clips, the influencers put into them, and videos. Not part of the website, and never in git (they're big: git
// ignores tools/studio-promo/media/).
//
//   node tools/studio-promo/media.mjs --from <folder>[,<folder>…] [--out tools/studio-promo/media] [--force]
//
// Each file is looked for by its name in those folders (and the folders inside them). Pictures are made at most 1600 px
// on their longer side (JPEG). A video becomes two runs of JPEG frames, a sharp one (720 × 1280) and a small one
// (360 × 640) for when it's shown small: Chromium on Claude's computer can't play H.264, and a frame read from a file is
// the same on every render anyway. index.json lists what's there, with each picture's size and each clip's frame rate.
// Needs ffmpeg and sharp (the site's own package).
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

// the pictures it shows: [its name in the video, the file names it may have]
export const PICS = [
  'nova-look-1', 'nova-look-2', 'nova-look-3', 'nova-look-4', 'nova-body', 'nova-beach', 'nova-cafe', 'nova-cafe-edit-red',
  'nova-golden', 'nova-x-banner', 'kai-look-1', 'kai-look-2', 'kai-body', 'kai-neon', 'kai-gaming', 'kai-meme',
  'mika-look-1', 'mika-look-2', 'mika-body', 'mika-flowers', 'mika-snow', 'juno-look-1', 'juno-look-2', 'juno-body',
  'juno-gaming', 'juno-meme', 'style-anime', 'style-storybook', 'style-watercolor', 'style-clay', 'style-toy',
  'style-pixel', 'style-popart', 'style-cyberpunk',
].map((name) => [name, [`${name}.jpg`, `${name}.png`, `${name}.webp`, `agiex-${name}.jpg`]]);

// the clips: [its name in the video, the file names it may have (the first found wins)]
export const VIDS = [
  // the trend clips (made for these examples: made-up people)
  ['tpl-golden', ['tpl-golden-src.mp4', 'agiex-golden-hour-trend.mp4']],
  ['tpl-neon', ['agiex-neon-runway-trend.mp4']],
  ['tpl-paparazzi', ['agiex-paparazzi-trend.mp4']],
  ['tpl-confetti', ['agiex-confetti-trend.mp4']],
  ['tpl-rain', ['agiex-rain-trend.mp4']],
  ['tpl-rooftop', ['agiex-rooftop-trend.mp4']],
  ['tpl-sunset', ['agiex-sunset-run-trend.mp4']],
  ['tpl-snow', ['agiex-first-snow-trend.mp4']],
  ['tpl-fireworks', ['agiex-fireworks-trend.mp4']],
  // the influencers put into them
  ['nova-golden-trend', ['nova-golden-trend.mp4']],
  ['kai-neon-runway-trend', ['kai-neon-runway-trend.mp4']],
  ['juno-confetti-trend', ['juno-confetti-trend.mp4']],
  ['mika-rain-trend', ['mika-rain-trend.mp4']],
  // videos made from a photo or a full body
  ['nova-cafe-video', ['nova-cafe-video.mp4']],
  ['kai-neon-video', ['kai-neon-video.mp4']],
  ['mika-video', ['agiex-mika-video.mp4', 'mika-video.mp4']],
  ['juno-video', ['agiex-juno-video.mp4', 'juno-video.mp4']],
];
export const FULL = [720, 1280];
export const SMALL = [360, 640];
const PIC_MAX = 1600;

function args(argv) {
  const a = { from: [], out: join(HERE, 'media'), force: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i], v = () => argv[++i];
    if (k === '--from') a.from.push(...v().split(',').filter(Boolean));
    else if (k === '--out') a.out = resolve(v());
    else if (k === '--force') a.force = true;
    else throw new Error(`unknown option ${k}`);
  }
  if (!a.from.length) throw new Error('say where the files are: --from <folder>[,<folder>…]');
  return a;
}

// every file in those folders (and the ones inside them), by name: the first one found wins
function indexFiles(dirs) {
  const found = new Map();
  const walk = (d, depth) => {
    let names;
    try { names = readdirSync(d); } catch { return; }
    for (const n of names) {
      const p = join(d, n);
      let st;
      try { st = statSync(p); } catch { continue; }
      if (st.isDirectory()) { if (depth < 4 && !n.startsWith('.')) walk(p, depth + 1); } else if (!found.has(n)) found.set(n, p);
    }
  };
  for (const d of dirs) walk(resolve(d), 0);
  return found;
}

const run = (cmd, argv) => new Promise((ok, fail) => {
  const p = spawn(cmd, argv, { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '', err = '';
  p.stdout.on('data', (b) => { out += b; });
  p.stderr.on('data', (b) => { err += b; });
  p.on('error', fail);
  p.on('close', (code) => (code === 0 ? ok(out) : fail(new Error(`${cmd} exit ${code}: ${err.slice(-400)}`))));
});

async function probe(file) {
  const out = await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=avg_frame_rate,width,height:format=duration', '-of', 'json', file]);
  const j = JSON.parse(out);
  const [a, b] = String(j.streams[0].avg_frame_rate).split('/').map(Number);
  return { fps: b ? a / b : a, w: j.streams[0].width, h: j.streams[0].height, duration: +j.format.duration };
}

async function main() {
  const a = args(process.argv.slice(2));
  const files = indexFiles(a.from);
  const sharp = (await import('sharp')).default;
  mkdirSync(join(a.out, 'pic'), { recursive: true });
  mkdirSync(join(a.out, 'vid'), { recursive: true });
  const indexFile = join(a.out, 'index.json');
  const old = existsSync(indexFile) ? JSON.parse(readFileSync(indexFile, 'utf8')) : { pics: {}, vids: {} };
  const index = { made: new Date().toISOString(), pics: {}, vids: {} };
  const missing = [];

  for (const [name, names] of PICS) {
    const src = names.map((n) => files.get(n)).find(Boolean);
    if (!src) { missing.push(name); continue; }
    const dst = join(a.out, 'pic', `${name}.jpg`);
    const sig = `${statSync(src).size}:${Math.round(statSync(src).mtimeMs)}`;
    if (!a.force && existsSync(dst) && old.pics?.[name]?.sig === sig) { index.pics[name] = old.pics[name]; continue; }
    const info = await sharp(src).rotate().resize({ width: PIC_MAX, height: PIC_MAX, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 90, mozjpeg: true }).toFile(dst);
    index.pics[name] = { w: info.width, h: info.height, sig };
    console.log(`[media] ${name}: ${info.width} × ${info.height}`);
  }

  for (const [name, names] of VIDS) {
    const src = names.map((n) => files.get(n)).find(Boolean);
    if (!src) { missing.push(name); continue; }
    const sig = `${statSync(src).size}:${Math.round(statSync(src).mtimeMs)}`;
    const dir = join(a.out, 'vid', name);
    if (!a.force && old.vids?.[name]?.sig === sig && existsSync(join(dir, 's', '0001.jpg'))) { index.vids[name] = old.vids[name]; continue; }
    rmSync(dir, { recursive: true, force: true });
    const p = await probe(src);
    // a 60-frame clip at 30 (each of its frames shown twice in a 60-frame video), a 24-frame one as it is
    const fps = p.fps > 40 ? 30 : Math.round(p.fps) || 24;
    for (const [sub, [w, h], q] of [['f', FULL, 2], ['s', SMALL, 4]]) {
      mkdirSync(join(dir, sub), { recursive: true });
      await run('ffmpeg', ['-v', 'error', '-y', '-i', src, '-vf',
        `fps=${fps},scale=${w}:${h}:force_original_aspect_ratio=increase:flags=lanczos,crop=${w}:${h},format=yuvj420p`,
        '-q:v', String(q), join(dir, sub, '%04d.jpg')]);
    }
    const n = readdirSync(join(dir, 's')).filter((f) => f.endsWith('.jpg')).length;
    index.vids[name] = { fps, n, w: FULL[0], h: FULL[1], sig };
    console.log(`[media] ${name}: ${n} frames at ${fps} fps (${(n / fps).toFixed(2)} s)`);
  }

  writeFileSync(indexFile, `${JSON.stringify(index, null, 1)}\n`);
  if (missing.length) {
    console.warn(`[media] not found (the video shows a stand-in for each): ${missing.join(', ')}`);
    process.exitCode = 2;
  }
  console.log(`[media] ${Object.keys(index.pics).length} pictures and ${Object.keys(index.vids).length} clips in ${a.out}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error(`[media] ${err.stack || err.message}`); process.exitCode = 1; });
}
