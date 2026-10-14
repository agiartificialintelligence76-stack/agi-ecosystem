// AGI Studio's launch video: gets its pictures and video clips ready for the renderer, once. They're the example
// creations made for it with the same kinds of AI models AGI Studio uses (made-up people, AI-generated): photos, looks, full bodies, styles, memes, an X banner,
// trend clips, the influencers put into them, and videos. Not part of the website, and never in git (they're big: git
// ignores tools/studio-promo/media/).
//
//   node tools/studio-promo/media.mjs --from <folder>[,<folder>…] [--out tools/studio-promo/media] [--force] [--only …]
//
// Each file is looked for by its name in those folders (and the folders inside them). Pictures are made at most 1600 px
// on their longer side (JPEG). A video becomes two runs of JPEG frames, a sharp one (720 × 1280) and a small one
// (360 × 640) for when it's shown small: Chromium on Claude's computer can't play H.264, and a frame read from a file is
// the same on every render anyway. Juno's 3D model (made for it the way AGI Studio makes one: from her full-body
// picture, given bones and taught a move, its Wave) is made ready for three.js: four bones a vertex (three.js draws
// four, and the file has up to sixteen), its pictures smaller. Since 2026-10-13 AGI-1's voice too: her takes (her own
// voice, the site's, made in Google AI Studio with the owner's account: agi1-vo-01-meet.wav…) made ready by voice.js
// (readyLine: 48 kHz, trimmed around her words, a long pause shortened, her loudness set), one mono WAV each.
// index.json lists what's there, with each picture's size, each clip's frame rate, the model's move and where her words
// are in each line. Needs ffmpeg, sharp and gltf-transform (the site's own packages).
//   --only voice   just that kind (pics, vids, models, voice: separated by commas); the others stay as they were
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readyLine, wav16, LINE } from './voice.js';

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
// its 3D model: [its name in the video, the file names it may have]
export const MODELS = [['juno-3d', ['juno-3d.glb']]];
// her voice: [her line (words.js VOICE), the file names her take may have]
export const VOICES = [
  ['meet', ['agi1-vo-01-meet.wav']], ['not-real', ['agi1-vo-02-not-real.wav']], ['you-made', ['agi1-vo-03-you-made.wav']],
  ['studio', ['agi1-vo-04-studio.wav']], ['design', ['agi1-vo-05-design.wav']], ['styles', ['agi1-vo-06-styles.wav']],
  ['edit', ['agi1-vo-07-edit.wav']], ['move', ['agi1-vo-08-move.wav']], ['model', ['agi1-vo-09-model.wav']],
  ['share', ['agi1-vo-10-share.wav']], ['live', ['agi1-vo-11-live.wav']], ['url', ['agi1-vo-12-url.wav']],
];
// how her takes are made ready: a change to it makes them again
export const VOICE_SIG = `v1-${createHash('sha256').update(JSON.stringify(LINE)).digest('hex').slice(0, 8)}`;
const KINDS = ['pics', 'vids', 'models', 'voice'];
export const FULL = [720, 1280];
export const SMALL = [360, 640];
const PIC_MAX = 1600;
// the model's pictures: its colors sharp (it's seen big), its bumps and its shine smaller
const MODEL_TEX = { base: [2048, 'jpeg', 92], normal: [1024, 'png', null], mr: [1024, 'jpeg', 90] };
const MODEL_SIG = 'm1';

// A vertex's bones, at most four (the biggest, their weights adding up to one): three.js reads only a model's first set
// (JOINTS_0 and WEIGHTS_0), and a vertex whose weights don't add up to one is drawn shrunk toward the model's middle.
export function fourBones(prim) {
  const sets = [];
  for (let k = 0; ; k++) {
    const j = prim.getAttribute(`JOINTS_${k}`), w = prim.getAttribute(`WEIGHTS_${k}`);
    if (!j || !w) break;
    sets.push([j, w]);
  }
  if (!sets.length) return 0;
  const n = sets[0][0].getCount();
  const J = new Uint16Array(n * 4), W = new Float32Array(n * 4);
  const jj = [], ww = [];
  let changed = 0;
  for (let i = 0; i < n; i++) {
    const pairs = [];
    for (const [ja, wa] of sets) {
      ja.getElement(i, jj); wa.getElement(i, ww);
      for (let c = 0; c < 4; c++) if (ww[c] > 0) pairs.push([jj[c], ww[c]]);
    }
    pairs.sort((a, b) => b[1] - a[1]);
    const top = pairs.slice(0, 4);
    const sum = top.reduce((s, p) => s + p[1], 0);
    if (pairs.length > 4 || Math.abs(sum - 1) > 1e-3) changed++;
    top.forEach(([j, w], c) => { J[i * 4 + c] = j; W[i * 4 + c] = sum > 0 ? w / sum : (c === 0 ? 1 : 0); });
  }
  sets[0][0].setArray(J);
  sets[0][1].setNormalized(false).setArray(W);
  for (let k = 1; k < sets.length; k++) { prim.setAttribute(`JOINTS_${k}`, null); prim.setAttribute(`WEIGHTS_${k}`, null); }
  return changed;
}

// Juno's 3D model, made ready: → { bytes, clips: [{ name, duration }], triangles, height, changed (vertices given four bones) }
export async function readyModel(src, dst, { sharp } = {}) {
  const [{ NodeIO, Logger, getBounds }, { ALL_EXTENSIONS }, { dedup, prune, resample, compressTexture }] = await Promise.all([
    import('@gltf-transform/core'), import('@gltf-transform/extensions'), import('@gltf-transform/functions'),
  ]);
  const encoder = sharp || (await import('sharp')).default;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(src);
  doc.setLogger(new Logger(Logger.Verbosity.WARN));
  const root = doc.getRoot();
  if (!root.listSkins().length) throw new Error(`${src}: the model has no bones`);
  if (!root.listAnimations().length) throw new Error(`${src}: the model has no move`);
  let changed = 0, triangles = 0;
  for (const mesh of root.listMeshes()) {
    for (const p of mesh.listPrimitives()) {
      changed += fourBones(p);
      const idx = p.getIndices(), pos = p.getAttribute('POSITION');
      triangles += Math.floor((idx ? idx.getCount() : pos ? pos.getCount() : 0) / 3);
    }
  }
  await doc.transform(dedup(), resample(), prune({ keepAttributes: false }));
  for (const mat of root.listMaterials()) {
    for (const [kind, tex] of [['base', mat.getBaseColorTexture()], ['normal', mat.getNormalTexture()], ['mr', mat.getMetallicRoughnessTexture()]]) {
      if (!tex || !tex.getImage()) continue;
      const [size, targetFormat, quality] = MODEL_TEX[kind];
      await compressTexture(tex, { encoder, targetFormat, resize: [size, size], quality, chromaSubsampling: '4:4:4' });
    }
  }
  const height = +getBounds(root.listScenes()[0]).max[1].toFixed(3);
  const clips = root.listAnimations().map((a) => ({
    name: a.getName(),
    duration: +Math.max(...a.listSamplers().map((s) => { const t = s.getInput().getArray(); return t[t.length - 1]; })).toFixed(3),
  }));
  await io.write(dst, doc);
  return { bytes: statSync(dst).size, clips, triangles, height, changed };
}

export function args(argv) {
  const a = { from: [], out: join(HERE, 'media'), force: false, only: KINDS };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i], v = () => argv[++i];
    if (k === '--from') a.from.push(...v().split(',').filter(Boolean));
    else if (k === '--out') a.out = resolve(v());
    else if (k === '--force') a.force = true;
    else if (k === '--only') {
      a.only = v().split(',').filter(Boolean);
      const bad = a.only.find((x) => !KINDS.includes(x));
      if (bad || !a.only.length) throw new Error(`--only: ${KINDS.join(', ')}`);
    } else throw new Error(`unknown option ${k}`);
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
  mkdirSync(join(a.out, 'model'), { recursive: true });
  mkdirSync(join(a.out, 'voice'), { recursive: true });
  const indexFile = join(a.out, 'index.json');
  const old = existsSync(indexFile) ? JSON.parse(readFileSync(indexFile, 'utf8')) : {};
  const index = { made: new Date().toISOString(), pics: {}, vids: {}, models: {}, voice: {} };
  // the kinds not made this time stay as they were
  for (const k of KINDS) if (!a.only.includes(k)) index[k] = old[k] || {};
  const missing = [];
  const doing = (k) => a.only.includes(k);

  for (const [name, names] of doing('pics') ? PICS : []) {
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

  for (const [name, names] of doing('vids') ? VIDS : []) {
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

  for (const [name, names] of doing('models') ? MODELS : []) {
    const src = names.map((n) => files.get(n)).find(Boolean);
    if (!src) { missing.push(name); continue; }
    // its version first: a change to how it's made ready makes it again
    const sig = `${MODEL_SIG}:${statSync(src).size}:${Math.round(statSync(src).mtimeMs)}`;
    const dst = join(a.out, 'model', `${name}.glb`);
    if (!a.force && existsSync(dst) && old.models?.[name]?.sig === sig) { index.models[name] = old.models[name]; continue; }
    const info = await readyModel(src, dst, { sharp });
    index.models[name] = { ...info, sig };
    console.log(`[media] ${name}: ${(info.bytes / 1e6).toFixed(1)} MB, ${info.triangles} triangles, ${info.height} m tall, `
      + `${info.clips.map((c) => `${c.name} ${c.duration} s`).join(', ')}; ${info.changed} vertices given four bones`);
  }

  for (const [name, names] of doing('voice') ? VOICES : []) {
    const src = names.map((n) => files.get(n)).find(Boolean);
    if (!src) { missing.push(name); continue; }
    const sig = `${VOICE_SIG}:${statSync(src).size}:${Math.round(statSync(src).mtimeMs)}`;
    const dst = join(a.out, 'voice', `${name}.wav`);
    if (!a.force && existsSync(dst) && old.voice?.[name]?.sig === sig) { index.voice[name] = old.voice[name]; continue; }
    const r = readyLine(readFileSync(src));
    writeFileSync(dst, wav16([r.pcm]));
    index.voice[name] = { onset: r.onset, len: r.len, lufs: r.lufs, gain: r.gain, peak: r.peak, pauses: r.pauses, from: r.from, sig };
    console.log(`[media] her voice, ${name}: her words ${r.len} s (from ${r.from} s in her take), ${r.lufs} LUFS, peak ${r.peak} dBFS`
      + `${r.pauses.length ? `, a pause of ${r.pauses.map((p) => `${p.was} s made ${p.now} s`).join(', ')}` : ''}`);
  }

  writeFileSync(indexFile, `${JSON.stringify(index, null, 1)}\n`);
  if (missing.length) {
    console.warn(`[media] not found (the video shows a stand-in for each): ${missing.join(', ')}`);
    process.exitCode = 2;
  }
  const nModels = Object.keys(index.models).length;
  console.log(`[media] ${Object.keys(index.pics).length} pictures, ${Object.keys(index.vids).length} clips, `
    + `${nModels} 3D model${nModels === 1 ? '' : 's'} and ${Object.keys(index.voice).length} of her lines in ${a.out}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error(`[media] ${err.stack || err.message}`); process.exitCode = 1; });
}
