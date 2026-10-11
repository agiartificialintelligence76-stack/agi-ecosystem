// AGI Studio's guide videos (2026-10-11, the owner: "theres should be a video guide on the site on every step … put vosials
// and video on the guidses"; the owner's choice: a short video for each step, recorded from the real app). Not part of the
// website: it makes src/studio/guide/ (each video twice: a computer's and a phone's, a small soundless MP4 and its WebP poster)
// and src/studio/guide-media.js (the list the guide and Learn read).
//   • Each clip is the real app (studio.html as Vite builds it) in Chromium, at a computer's size (1280 × 800) and a phone's
//     (390 × 844, touch), with our own server's code answering it (api/launch.js), its outside services faked exactly as
//     tests/influencer.test.js fakes them (read from that file as this runs: no second copy to keep up to date).
//   • A demo studio: made-up people painted in 2D (the live show's paintings, tools/live/page/art: never anyone real, never the
//     3D model or anything rendered from it), their photos made from those paintings on their painted places, their videos a
//     slow zoom on one (made here with ffmpeg); a demo wallet (a made-up address) with demo credits.
//   • What happens on screen is scripted (tools/studio/guide-scripts.mjs: one scene for each video), with a cursor (a
//     computer's) or a touch (a phone's) drawn on top, and a camera that follows what happens (a 16:10 part of the screen),
//     a little faster where the app waits; frames from Chromium's own screencast, put together here (sharp) and encoded with
//     ffmpeg (H.264, every browser plays it).
// Usage (Chromium, ffmpeg and `npm install --no-save playwright-core`, like the other tools; about half a minute a video):
//   node tools/studio/guide-record.mjs                       every video, both sizes
//   node tools/studio/guide-record.mjs --only create-look,make-go --layout p
//   node tools/studio/guide-record.mjs --stills              pictures of each scene's moments instead (a quick look)
//   … --sheet       each video's contact sheet too (a frame every half second: node_modules/.cache/agi1-guide/sheets/)
//   … --director    the whole screen with the camera's part outlined, instead of the video (a scene's camera, looked at)
//   … --no-build    the app as it was last built here (quicker, while a scene is being written)
//   GUIDE_DEBUG=1   where each run is, with the time;  PLAYWRIGHT_CORE=<…/playwright-core/index.mjs>  one installed elsewhere
// A scene that fails leaves a picture of the screen at that moment: node_modules/.cache/agi1-guide/failed/<id>-<d|p>.png
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import sharp from 'sharp';
import { CLIP_IDS } from '../../src/studio/guide-steps.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const CACHE = join(ROOT, 'node_modules', '.cache', 'agi1-guide');
const OUT = join(ROOT, 'src', 'studio', 'guide');
const ART = join(ROOT, 'tools', 'live', 'page', 'art');
const ORIGIN = 'https://studio.agi1.app';
const FPS = 24;
// the two sizes: a computer's screen and a phone's; each video 16:10 (a part of the screen the camera follows). A computer's
// pixel ratio is 1.5 (its frames 1920 × 1200: the camera's narrowest view, 460 px, is still 690 pixels for a 672-pixel video,
// and it paints about half again as many frames a second as at 2)
export const LAYOUTS = {
  d: { view: { width: 1280, height: 800 }, dpr: 1.5, mobile: false, out: { w: 672, h: 420 }, cam: { min: 460, max: 1280 } },
  p: { view: { width: 390, height: 844 }, dpr: 2, mobile: true, out: { w: 624, h: 390 }, cam: { min: 300, max: 390 } },
};
// the browser and ffmpeg never get a secret (the demo's are made up anyway)
export const withoutSecrets = (env = process.env) => Object.fromEntries(Object.entries(env).filter(([k]) => !/KEY|SECRET|TOKEN|PASS/i.test(k)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// (GUIDE_DEBUG=1: where a run is, with the time, for a scene being written)
const T0 = Date.now();
const dbg = (...a) => { if (process.env.GUIDE_DEBUG) process.stdout.write(`  [${((Date.now() - T0) / 1000).toFixed(1)} s] ${a.join(' ')}\n`); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);

// ---------- the app, as Vite builds it ----------
async function buildApp() {
  const { build } = await import('vite');
  const outDir = join(CACHE, 'dist');
  // (the test site key of Cloudflare's human check: the demo's pass is already in the browser, so it never shows)
  process.env.VITE_TURNSTILE_SITE_KEY = '1x00000000000000000000BB';
  process.env.VITE_TELEGRAM_BOT = 'agi1_appbot';
  // the guide's own videos are left out of the app being filmed (a guide card in a clip shows its words and arrows only, the
  // same every time this runs, and the build doesn't carry the videos it's making)
  const noClips = { name: 'agi1-guide-without-clips', enforce: 'pre', load(id) { return /[\\/]src[\\/]studio[\\/]guide-media\.js$/.test(id) ? 'export const CLIPS = {};\n' : null; } };
  await build({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), logLevel: 'warn', plugins: [noClips], build: { outDir, emptyOutDir: true } });
  return outDir;
}

// ---------- our own server, with tests/influencer.test.js's fake services (read from that file, as it is now) ----------
async function demoBackend() {
  const src = readFileSync(join(ROOT, 'tests', 'influencer.test.js'), 'utf8');
  const lines = src.split('\n');
  const at = (re, from = 0) => {
    const i = lines.findIndex((l, k) => k >= from && re.test(l));
    if (i < 0) throw new Error(`tests/influencer.test.js changed (no ${re}): tools/studio/guide-record.mjs reads its fakes from it`);
    return i;
  };
  const root = `${pathToFileURL(ROOT).href}/`;
  const imports = lines.slice(at(/^import \{ readFileSync/), at(/^const DAY = /)).join('\n').replace(/from '\.\.\//g, `from '${root}`);
  const consts = lines.slice(at(/^const DAY = /), at(/^let fake, calls, logs;/)).join('\n').replace(/^let PNG, JPEG_EXIF, BIG_PNG;$/m, 'export let PNG, JPEG_EXIF, BIG_PNG;');
  const b0 = at(/^beforeEach\(async \(\) => \{$/), b1 = at(/^\}\);$/, b0);
  const setup = lines.slice(b0 + 1, b1).filter((l) => !/^\s*console\.(error|warn|log) = /.test(l)).join('\n');
  if (!/globalThis\.fetch = fakeFetch;/.test(setup)) throw new Error('tests/influencer.test.js changed: its set-up has no fakeFetch');
  const fetchPart = lines.slice(at(/^\/\/ the verdicts Gemini gives/), at(/^const read = /)).join('\n');
  const out = `// (made by tools/studio/guide-record.mjs from tests/influencer.test.js as it ran: don't edit)
${imports}
${consts}
export let fake, calls, logs;
export async function init() {
${setup}
}
${fetchPart}
export { SECRET, IP, WALLET, OTHER, BOSS, OWNER, codeOf, idOf, sessionFor, readyInf, doneJob, keptTrend, picPath, makeSession, launchGet, launchPost, giveCredits, R };
`;
  mkdirSync(CACHE, { recursive: true });
  const file = join(CACHE, 'demo-backend.mjs');
  writeFileSync(file, out);
  return import(`${pathToFileURL(file).href}?v=${Date.now()}`);
}

// ---------- the demo's pictures: made-up people painted in 2D, on their painted places ----------
const PEOPLE = {
  mira: 'minji', yui: 'yui', giulia: 'giulia', bia: 'bia', sofia: 'sofia', layla: 'layla', mika: 'mika', lan: 'lan', rosa: 'rosa',
  nok: 'nok', arjun: 'arjun', lukas: 'lukas',
};
const BACKDROPS = { mira: '#2b2440', yui: '#3a2a4a', mika: '#2a3a3a', lan: '#2a2f45', giulia: '#3a2f2a', bia: '#2f3a2a', sofia: '#3a2a35', layla: '#36302a' };
const PLACE_FILES = (name) => (existsSync(join(ART, 'places', `${name}.webp`)) ? join(ART, 'places', `${name}.webp`) : join(ART, 'rooms', `${name}.webp`));
const ART_CACHE = new Map();
// a made-up person, painted for the live show (tools/live/page/art/people: cut out, waist up)
async function cutout(who) {
  const file = join(ART, 'people', `${PEOPLE[who] || who}.webp`);
  if (!existsSync(file)) throw new Error(`no painting for ${who}`);
  return file;
}
// a scene: a painted place, the person in front of it (tall 9:16, wide 16:9, square 1:1, or an X banner's 4:1)
export async function scene(who, place, shape = 'tall') {
  const key = `scene:${who}:${place}:${shape}`;
  if (ART_CACHE.has(key)) return ART_CACHE.get(key);
  const size = { tall: [576, 1024], wide: [1024, 576], square: [1024, 1024], banner: [2048, 512] }[shape];
  const [W, H] = size;
  const bg = await sharp(PLACE_FILES(place)).resize(W, H, { fit: 'cover', position: shape === 'tall' ? 'left' : 'centre' }).modulate({ brightness: 0.92 }).toBuffer();
  const ph = Math.round(H * (shape === 'tall' ? 0.74 : shape === 'banner' ? 0.94 : 0.86));
  const person = await sharp(await cutout(who)).resize({ width: W - 16, height: ph, fit: 'inside' }).toBuffer();
  const pm = await sharp(person).metadata();
  const pw = pm.width;
  const left = clamp(Math.round(shape === 'banner' ? W * 0.66 - pw / 2 : shape === 'wide' ? W * 0.62 - pw / 2 : (W - pw) / 2), 0, W - pw);
  // (a soft shadow under them, so they stand in the place)
  const shadow = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><radialGradient id="g"><stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs><ellipse cx="${left + pw / 2}" cy="${H - 8}" rx="${pw * 0.55}" ry="${H * 0.06}" fill="url(#g)"/></svg>`)).png().toBuffer();
  const out = await sharp(bg).composite([{ input: shadow }, { input: person, left, top: H - pm.height }]).jpeg({ quality: 88 }).toBuffer();
  ART_CACHE.set(key, out);
  return out;
}
// a look: head and shoulders on a soft studio color
export async function look(who) {
  const key = `look:${who}`;
  if (ART_CACHE.has(key)) return ART_CACHE.get(key);
  const file = await cutout(who);
  const m = await sharp(file).metadata();
  const top = await sharp(file).extract({ left: 0, top: 0, width: m.width, height: Math.round(m.height * 0.62) }).resize({ width: 820, height: 900, fit: 'inside' }).toBuffer();
  const tm = await sharp(top).metadata();
  const c = BACKDROPS[who] || '#2b2b3a';
  const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><defs><radialGradient id="g" cx=".5" cy=".35" r=".8"><stop offset="0" stop-color="#d9d4ea"/><stop offset="1" stop-color="${c}"/></radialGradient></defs><rect width="1024" height="1024" fill="url(#g)"/></svg>`);
  const out = await sharp(bg).composite([{ input: top, left: Math.round((1024 - tm.width) / 2), top: 1024 - tm.height }]).jpeg({ quality: 88 }).toBuffer();
  ART_CACHE.set(key, out);
  return out;
}
// its full body: the whole painting on a plain light grey
export async function body(who) {
  const key = `body:${who}`;
  if (ART_CACHE.has(key)) return ART_CACHE.get(key);
  // (as tall as fits, never wider than the picture: some paintings are wide)
  const person = await sharp(await cutout(who)).resize({ width: 556, height: 900, fit: 'inside' }).toBuffer();
  const pm = await sharp(person).metadata();
  const out = await sharp({ create: { width: 576, height: 1024, channels: 3, background: '#e6e6ea' } })
    .composite([{ input: person, left: Math.round((576 - pm.width) / 2), top: 1024 - pm.height }]).jpeg({ quality: 88 }).toBuffer();
  ART_CACHE.set(key, out);
  return out;
}
// a picture of one of those for a tile (the app's own small WebP)
export const tile = async (jpeg) => sharp(jpeg).resize({ width: 384 }).webp({ quality: 74 }).toBuffer();
// a video: a slow zoom on a scene (4 s, 24 frames a second), VP9 in an MP4 (the Chromium this records with plays VP9; the
// guide's own videos are H.264)
export async function sceneVideo(who, place, { shape = 'tall', seconds = 4, pan = 'in' } = {}) {
  const key = `video:${who}:${place}:${shape}:${seconds}:${pan}`;
  if (ART_CACHE.has(key)) return ART_CACHE.get(key);
  // (made once and kept in the cache folder: VP9 takes a few seconds a video)
  const kept = join(CACHE, 'art', `${key.replace(/[^a-z0-9]+/gi, '-')}.mp4`);
  if (existsSync(kept)) { const b = readFileSync(kept); ART_CACHE.set(key, b); return b; }
  const still = await scene(who, place, shape);
  const [W, H] = shape === 'wide' ? [640, 360] : shape === 'square' ? [480, 480] : [360, 640];
  mkdirSync(join(CACHE, 'art'), { recursive: true });
  const inFile = join(CACHE, `still-${process.pid}.jpg`), outFile = join(CACHE, `clip-${process.pid}.mp4`);
  writeFileSync(inFile, still);
  const frames = seconds * 24;
  const z = pan === 'in' ? `'1+0.12*on/${frames}'` : `'1.12-0.12*on/${frames}'`;
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-loop', '1', '-i', inFile, '-vf',
    `scale=${W * 2}:${H * 2},zoompan=z=${z}:d=1:x='iw/2-(iw/zoom/2)':y='ih/3-(ih/zoom/3)':s=${W}x${H}:fps=24`,
    '-frames:v', String(frames), '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '42', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '5',
    '-pix_fmt', 'yuv420p', '-an', '-f', 'mp4', outFile], { env: withoutSecrets(), stdio: ['ignore', 'ignore', 'pipe'] });
  if (r.status !== 0) throw new Error(`ffmpeg (a demo video): ${r.stderr}`);
  const out = readFileSync(outFile);
  rmSync(inFile, { force: true }); rmSync(outFile, { force: true });
  writeFileSync(kept, out);
  ART_CACHE.set(key, out);
  return out;
}

// ---------- the demo studio: what each scene starts from ----------
// (B: the demo backend; its fake services answered with the demo's pictures: an AI picture or video asked for gets the
// painting its words fit)
const PLACE_WORDS = [
  [/tokyo|night market|neon/i, 'tokyo'], [/caf[eé]|coffee|latte/i, 'cafe'], [/rooftop|skyline|city/i, 'rooftop'], [/beach|sunset|sea\b|ocean|boardwalk/i, 'beach'],
  [/paris|front row|runway/i, 'paris'], [/snow/i, 'beijing'], [/rain/i, 'london'], [/firework|confetti/i, 'rio'], [/bedroom|fairy lights|living room/i, 'bedroom'],
  [/festival|stage|concert/i, 'stage'], [/game|gaming/i, 'gaming'], [/seoul/i, 'seoul'], [/night drive|car|taxi/i, 'newyork'],
  [/flower|spring|garden/i, 'bali'], [/studio portrait|gradient/i, 'studio'],
];
const placeFor = (words) => PLACE_WORDS.find(([re]) => re.test(words || ''))?.[1] || 'rooftop';
// the made-up people of an influencer's 4 looks (a scene may ask for the second set: 4 new looks)
export const LOOKS = ['mira', 'yui', 'mika', 'lan'];
export const LOOKS2 = ['giulia', 'sofia', 'layla', 'bia'];
// the example pictures of Create's choices (the owner makes them once with AI; the demo's are its painted people): a painting
// for each choice that's about a person (its look, age, hair style, outfit, vibe). A style's is left out (a painting can't show
// "Realistic"), so its tiles show the app's own mark
const EXAMPLE_ART = {
  'look-feminine': 'sofia', 'look-masculine': 'arjun', 'look-androgynous': 'lukas',
  'age-20s': 'yui', 'age-30s': 'emre', 'age-40s': 'oliver', 'age-50s': 'wei',
  'cut-short': 'emre', 'cut-bob': 'nok', 'cut-long': 'mira', 'cut-curly': 'bia', 'cut-wavy': 'sofia', 'cut-braids': 'lan', 'cut-ponytail': 'layla', 'cut-buzz': 'arjun',
  'outfit-street': 'jo', 'outfit-cozy': 'mira', 'outfit-sporty': 'wayan', 'outfit-smart': 'arjun', 'outfit-y2k': 'yui', 'outfit-cyber': 'lukas', 'outfit-gamer': 'yui', 'outfit-elegant': 'sofia',
  'vibe-cheerful': 'bia', 'vibe-cool': 'lukas', 'vibe-calm': 'wei', 'vibe-confident': 'layla', 'vibe-playful': 'nok', 'vibe-mysterious': 'mira',
};
// the trend clips the owner kept, in the demo: each a made-up person on a painted place that fits it
const TREND_ART = {
  'golden-flip': ['giulia', 'beach'], paparazzi: ['layla', 'newyork'], 'rooftop-orbit': ['sofia', 'rooftop'], 'neon-zoom': ['yui', 'tokyo'],
  'confetti-freeze': ['bia', 'stage'], 'neon-runway': ['mika', 'seoul'], 'night-drive': ['lan', 'newyork'], 'rain-twirl': ['rosa', 'london'],
  'sunset-run': ['nok', 'bali'], 'front-row': ['giulia', 'paris'], 'first-snow': ['sofia', 'beijing'], fireworks: ['bia', 'rio'],
};
// an action on our server as the demo wallet (before the browser opens)
const demoAct = (B, action, body = {}, level = 2) => B.launchPost(new Request(`${ORIGIN}/api/launch`, {
  method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': B.IP }, body: JSON.stringify({ action, session: B.sessionFor(B.WALLET, level), ...body }),
}));
export async function demo(B, { signedIn = true } = {}) {
  await B.init();
  // its 3D models and coins switched on (their tabs show; nothing is made with them here): stand-in settings, never real keys
  process.env.MESHY_API_KEY = 'msy_demo_key_for_the_guide_videos_only';
  process.env.PINATA_JWT = 'demo.guide.videos';
  const real = globalThis.fetch;
  const st = { looks: LOOKS, trendJobs: new Map() };
  // the AI's pictures and videos: the painting its request fits (its looks: four made-up people; its full body; a scene; a
  // trend video: the trend clip's place)
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    const png = /^https:\/\/(?:[a-z0-9-]+\.)?fal\.media\/files\/[a-z]+\/([^/]+)-(\d+)\.png$/.exec(u);
    const mp4 = png ? null : /^https:\/\/(?:[a-z0-9-]+\.)?fal\.media\/files\/[a-z]+\/([^/]+)\.mp4$/.exec(u);
    if (png || mp4) {
      const r = B.fake.fal.requests.get((png || mp4)[1]);
      const prompt = String(r?.input?.prompt || '');
      if (mp4) {
        const inputs = JSON.stringify(r?.input || {});
        const trend = [...st.trendJobs].find(([job]) => inputs.includes(job))?.[1];
        const place = trend ? (TREND_ART[trend] || [])[1] || 'tokyo' : placeFor(prompt);
        return new Response(await sceneVideo('mira', place, { shape: 'tall', seconds: 4, pan: trend ? 'out' : 'in' }), { headers: { 'Content-Type': 'video/mp4' } });
      }
      const k = Number(png[2] || 0);
      let pic;
      if (/Head and shoulders/i.test(prompt)) pic = await look(st.looks[k % 4]);
      else if (/whole body visible/i.test(prompt)) pic = await body('mira');
      else if (/header banner/i.test(prompt)) pic = await scene('mira', placeFor(prompt), 'banner');
      else pic = await scene('mira', placeFor(prompt), r?.input?.aspect_ratio === '16:9' ? 'wide' : r?.input?.aspect_ratio === '1:1' ? 'square' : 'tall');
      return new Response(await sharp(pic).png().toBuffer(), { headers: { 'Content-Type': 'image/png' } });
    }
    return real(url, init);
  };
  const putPic = async (path, jpeg) => {
    B.fake.storage.set(path, { bytes: jpeg, type: 'image/jpeg' });
    B.fake.storage.set(path.replace(/\.jpg$/, '.webp'), { bytes: await tile(jpeg), type: 'image/webp' });
  };
  // an influencer, ready: its looks, its full body, its photos and videos (its pictures the paintings)
  async function influencer({ who, name, wallet = B.WALLET, style = 'anime', photos = [], videos = [] }) {
    const inf = await B.readyInf({ wallet, name, style });
    // (its 4 looks: the one it picked is its own painting, the other 3 made-up people)
    const pick = B.fake.db.infs.get(inf.id)?.pick ?? 1;
    const set = [...LOOKS, ...LOOKS2].filter((x) => x !== who).slice(0, 3);
    set.splice(pick, 0, who);
    for (let k = 0; k < 4; k++) await putPic(B.picPath(inf.id, inf.looks, k), await look(set[k]));
    await putPic(B.picPath(inf.id, inf.body, 0), await body(who));
    const jobs = [];
    let at = Date.now() - 3600e3;
    for (const p of photos) {
      const id = await B.doneJob(inf.id, 'photo', { wallet, shape: p.shape || 'tall', done: (at += 60e3) });
      const j = B.fake.db.jobs.get(id);
      j.scene = p.scene;
      await putPic(B.picPath(inf.id, id, 0), await scene(who, placeFor(p.scene), p.shape || 'tall'));
      jobs.push(id);
    }
    for (const v of videos) {
      const bytes = await sceneVideo(who, placeFor(v.scene), { pan: v.pan || 'in' });
      const id = await B.doneJob(inf.id, v.kind || 'video', { wallet, video: bytes, poster: true, done: (at += 60e3) });
      const j = B.fake.db.jobs.get(id);
      j.scene = v.kind === 'trend' ? null : v.scene;
      if (v.trend) j.trend = v.trend;
      B.fake.storage.set(`inf/${inf.id}/${id}.mp4`, { bytes, type: 'video/mp4' });
      B.fake.storage.set(`inf/${inf.id}/${id}.poster.webp`, { bytes: await tile(await scene(who, placeFor(v.scene), 'tall')), type: 'image/webp' });
      jobs.push(id);
    }
    return { ...inf, jobs };
  }
  // the trend clips the owner kept (each a made-up person on a place that fits it)
  for (const t of B.R.TRENDS) {
    const job = B.keptTrend(t.id);
    st.trendJobs.set(job, t.id);
    const [who, place] = TREND_ART[t.id] || ['yui', 'tokyo'];
    B.fake.storage.set(`trends/${job}.mp4`, { bytes: await sceneVideo(who, place, { pan: 'out' }), type: 'video/mp4' });
    B.fake.storage.set(`trends/${job}.poster.webp`, { bytes: await tile(await scene(who, place, 'tall')), type: 'image/webp' });
  }
  // the example pictures of Create's choices
  const { examplePath } = await import(pathToFileURL(join(ROOT, 'server', 'inf-jobs.js')).href);
  for (const [key, who] of Object.entries(EXAMPLE_ART)) {
    const job = B.idOf(`ex${key.replace(/[^a-z0-9]/g, '')}`);
    B.fake.db.addJob({ id: job, inf_id: null, wallet_code: null, kind: 'example', example: key, shape: 'square', cost: 0, status: 'done', files: 1, bytes: 9000, done: Date.now() - 86_400e3 });
    B.fake.storage.set(examplePath(job), { bytes: await sharp(await look(who)).resize(384, 384).webp({ quality: 78 }).toBuffer(), type: 'image/webp' });
  }
  // other people's public influencers, with a few photos each (Explore's)
  const others = [];
  for (const [who, name, scenes] of [
    ['yui', 'Yui', ['at a neon night market in Tokyo', 'in a cozy gaming room']], ['giulia', 'Giulia', ['at a café by the window', 'on a beach at sunset']],
    ['bia', 'Bia', ['at a music festival stage', 'at the fireworks over the bay']], ['sofia', 'Sofia', ['on a rooftop at golden hour', 'in Paris by the river']],
  ]) {
    others.push(await influencer({ who, name, wallet: `0x${String(others.length + 4).repeat(40)}`, photos: scenes.map((s) => ({ scene: s })) }));
  }
  // the demo wallet's own: Mira (her photos, a video, a trend video)
  const mira = await influencer({
    who: 'mira', name: 'Mira',
    photos: [{ scene: 'on a rooftop at golden hour, city behind' }, { scene: 'sipping coffee in a cozy café, morning light' }, { scene: 'at a neon night market in Tokyo' }],
    videos: [{ scene: 'walking on the beach at sunset', pan: 'in' }, { kind: 'trend', trend: 'neon-zoom', scene: 'neon Tokyo street', pan: 'out' }],
  });
  // Explore's fresh photos and videos, newest first: everyone's, mixed (not all of one influencer's), with a few likes each
  const lists = [mira, ...others].map((inf) => [...inf.jobs]);
  const order = [];
  while (lists.some((l) => l.length)) for (const l of lists) if (l.length) order.push(l.shift());
  const HEARTS = [12, 7, 23, 4, 16, 9, 31, 5, 14, 8, 19, 6, 11, 3, 17];
  order.forEach((id, k) => {
    const j = B.fake.db.jobs.get(id);
    j.done = Date.now() - (k + 1) * 7 * 60e3;
    j.created = j.done - 90e3;
    j.likes = HEARTS[k % HEARTS.length];
  });
  B.giveCredits(5000);
  // its Crush perk this month asked for once already (else the first page of every video would toast it)
  await demoAct(B, 'inf-me');
  // what a scene may change: st.looks (the people of the next 4 looks); what it may use: putPic (a picture in the bucket, with
  // its tile), influencer (one more, ready)
  return Object.assign(st, { mira, others, signedIn, putPic, influencer, act: (action, body) => demoAct(B, action, body) });
}

// ---------- a scene being filmed: what the camera looks at, the cursor or the touch, how fast ----------
export class Film {
  constructor(page, L) {
    this.page = page; this.L = L; this.lay = LAYOUTS[L]; this.phone = this.lay.mobile;
    this.t0 = null; this.t1 = null; this.cams = []; this.path = []; this.taps = []; this.speeds = []; this.posterAt = null; this.stills = [];
    this.pos = { x: this.lay.view.width * 0.62, y: this.lay.view.height * 0.55 };
  }
  now() { return Date.now() / 1000; }
  // the part of the screen around a box (a 16:10 rectangle, inside the screen); zoom: how much room around it
  frame(box, { room = 1.9, min = this.lay.cam.min, max = this.lay.cam.max, y = 0.5 } = {}) {
    const V = this.lay.view;
    let w = clamp(Math.max(box.width * room, box.height * room * 1.6), min, Math.min(max, V.width));
    let h = w / 1.6;
    if (h > V.height) { h = V.height; w = h * 1.6; }
    const cx = box.x + box.width / 2, cy = box.y + box.height * y;
    return { x: clamp(cx - w / 2, 0, V.width - w), y: clamp(cy - h / 2, 0, V.height - h), w, h };
  }
  async box(target) {
    if (!target) return null;
    if (typeof target.boundingBox === 'function') return target.boundingBox();
    return target;
  }
  // the camera on something (a locator or a box), easing there
  async cam(target, opts = {}) {
    const b = await this.box(target);
    if (!b) return;
    const r = opts.full ? { x: 0, y: 0, w: this.lay.view.width, h: this.lay.view.width / 1.6 } : this.frame(b, opts);
    if (opts.full && this.phone) r.y = clamp(b.y + b.height / 2 - r.h / 2, 0, this.lay.view.height - r.h);
    this.cams.push({ t: this.now(), r, dur: opts.dur ?? 0.65 });
  }
  // the clip starts now (its first look: the camera on what's given)
  async start(target, opts = {}) {
    this.t0 = this.now();
    if (target) { await this.cam(target, { ...opts, dur: 0 }); this.cams.at(-1).t = this.t0 - 1; }
    this.path.push({ t: this.t0, ...this.pos, show: !this.phone });
  }
  async wait(ms) { await sleep(ms); }
  fast(speed = 3) { this.speeds.push({ t: this.now(), speed }); }
  normal() { this.speeds.push({ t: this.now(), speed: 1 }); }
  poster() { this.posterAt = this.now(); }
  async still(name) { if (this.stills) this.stills.push({ name, png: await this.page.screenshot() }); }
  // the cursor to a point, along a gentle curve (the page's own mouse too, so hovers show)
  async moveTo(x, y, { ms = null } = {}) {
    const from = { ...this.pos };
    const dist = Math.hypot(x - from.x, y - from.y);
    const dur = ms ?? clamp(260 + dist * 0.75, 320, 900);
    const t = this.now();
    const steps = Math.max(6, Math.round(dur / 40));
    const bend = { x: (from.y - y) * 0.12, y: (x - from.x) * 0.12 };
    for (let i = 1; i <= steps; i++) {
      const k = ease(i / steps);
      const arc = Math.sin(Math.PI * k);
      const p = { x: from.x + (x - from.x) * k + bend.x * arc, y: from.y + (y - from.y) * k + bend.y * arc };
      this.path.push({ t: t + (dur / 1000) * (i / steps), ...p, show: !this.phone });
      if (!this.phone) await this.page.mouse.move(p.x, p.y);
      await sleep(dur / steps);
    }
    this.pos = { x, y };
  }
  // the camera now (where its newest move goes)
  get view() { return this.cams.at(-1)?.r || null; }
  // something kept in the picture: the camera stays if it's well inside, else it moves just enough (the same size: no zoom);
  // a box bigger than the picture keeps its middle in. Says whether the camera moved
  async follow(target, { margin = 0.1, dur = 0.55 } = {}) {
    const r = this.view, b = await this.box(target);
    if (!r || !b) return false;
    const V = this.lay.view;
    const mx = r.w * margin, my = r.h * margin;
    const fitsX = b.width <= r.w - 2 * mx, fitsY = b.height <= r.h - 2 * my;
    const x0 = fitsX ? b.x : b.x + b.width / 2, x1 = fitsX ? b.x + b.width : x0;
    const y0 = fitsY ? b.y : b.y + b.height / 2, y1 = fitsY ? b.y + b.height : y0;
    let x = r.x, y = r.y;
    if (x0 < x + mx) x = x0 - mx; else if (x1 > x + r.w - mx) x = x1 - r.w + mx;
    if (y0 < y + my) y = y0 - my; else if (y1 > y + r.h - my) y = y1 - r.h + my;
    x = clamp(x, 0, V.width - r.w); y = clamp(y, 0, V.height - r.h);
    if (Math.abs(x - r.x) < 1 && Math.abs(y - r.y) < 1) return false;
    this.cams.push({ t: this.now(), r: { ...r, x, y }, dur });
    return true;
  }
  // where the camera goes for an action: 'follow' (the default: it keeps the target in the picture, see follow()), a new
  // framing around it (room: how much room around it), or nowhere (cam: false)
  async aim(b, { cam = 'follow', room } = {}) {
    if (cam === false) return false;
    if (room != null || cam === true) { await this.cam(b, { room: room ?? 2.4 }); return true; }
    return this.follow(b);
  }
  // something in view and really under the point to press (not under a bar, a toast or a sheet in front of it: a phone's tab
  // bar covers the bottom of the screen): else it's scrolled to the middle of the screen. Its box, or null
  async reach(loc, dx = 0.5, dy = 0.5) {
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    let b = await loc.boundingBox();
    if (!b) return null;
    const free = await loc.evaluate((el, [x, y]) => { const t = document.elementFromPoint(x, y); return Boolean(t) && (t === el || el.contains(t)); }, [b.x + b.width * dx, b.y + b.height * dy]).catch(() => true);
    if (!free) {
      await loc.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'smooth' }));
      await sleep(650);
      b = await loc.boundingBox();
    }
    return b;
  }
  // a click (a computer: the cursor goes there and presses; a phone: a touch there)
  async click(target, { cam = 'follow', room, dx = 0.5, dy = 0.5, hold = 260, after = 420 } = {}) {
    const loc = typeof target === 'string' ? this.page.locator(target).first() : target;
    const b = await this.reach(loc, dx, dy);
    if (!b) throw new Error(`nothing to click: ${target}`);
    const moved = await this.aim(b, { cam, room });
    const x = b.x + b.width * dx, y = b.y + b.height * dy;
    if (this.phone) {
      await sleep(moved ? 480 : 160);
      this.pos = { x, y };
      this.taps.push({ t: this.now(), x, y });
      await this.page.touchscreen.tap(x, y);
    } else {
      await this.moveTo(x, y);
      await sleep(hold);
      this.taps.push({ t: this.now(), x, y });
      await this.page.mouse.down();
      await sleep(70);
      await this.page.mouse.up();
    }
    await sleep(after);
  }
  // the cursor resting on something (a computer: what shows under a mouse, like a trend clip playing; a phone: a look at it)
  async hover(target, { cam = 'follow', room, dx = 0.5, dy = 0.5, after = 700 } = {}) {
    const loc = typeof target === 'string' ? this.page.locator(target).first() : target;
    const b = await this.reach(loc, dx, dy);
    if (!b) throw new Error(`nothing to point at: ${target}`);
    await this.aim(b, { cam, room });
    if (!this.phone) await this.moveTo(b.x + b.width * dx, b.y + b.height * dy);
    await sleep(after);
  }
  // typing, a letter at a time
  async type(target, text, { delay = 75 } = {}) {
    const loc = typeof target === 'string' ? this.page.locator(target).first() : target;
    await this.click(loc, { after: 200 });
    await loc.pressSequentially(text, { delay });
    await sleep(300);
  }
  // the page scrolled (gently) so that something is in view
  async scrollTo(target, { block = 'center', within = null } = {}) {
    const loc = typeof target === 'string' ? this.page.locator(target).first() : target;
    await loc.evaluate((el, [block, within]) => {
      const sc = within ? el.closest(within) : null;
      const r = el.getBoundingClientRect();
      if (sc) {
        const s = sc.getBoundingClientRect();
        sc.scrollBy({ top: r.top - s.top - (block === 'start' ? 16 : (s.height - r.height) / 2), behavior: 'smooth' });
      } else {
        const bar = document.querySelector('.sa-bar')?.getBoundingClientRect().bottom || 0;
        scrollBy({ top: r.top - (block === 'start' ? bar + 16 : (innerHeight - r.height) / 2), behavior: 'smooth' });
      }
    }, [block, within]);
    await sleep(900);
  }
  async end(hold = 900) {
    await sleep(hold);
    this.t1 = this.now();
  }
}

// ---------- the frames, put together: the camera's part of each, the cursor or the touch on top ----------
const CURSOR = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 22 22"><path d="M3 2l14 10.2-6.1.9 3.6 6.6-2.4 1.3-3.6-6.7L3.6 18.2z" fill="#fff" stroke="#111" stroke-width="1.3" stroke-linejoin="round"/></svg>`);
const ring = (r, a, color) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${2 * r + 8}" height="${2 * r + 8}"><circle cx="${r + 4}" cy="${r + 4}" r="${r}" fill="${color}" fill-opacity="${(a * 0.28).toFixed(3)}" stroke="${color}" stroke-opacity="${a.toFixed(3)}" stroke-width="3"/></svg>`);
const dot = (r, a) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${2 * r + 4}" height="${2 * r + 4}"><circle cx="${r + 2}" cy="${r + 2}" r="${r}" fill="#fff" fill-opacity="${(a * 0.55).toFixed(3)}" stroke="#fff" stroke-opacity="${(a * 0.9).toFixed(3)}" stroke-width="2"/></svg>`);

// the camera at a moment: each move eases from where the camera was when it started (a move cut short by the next one
// leaves it part of the way)
function camAt(film, t) {
  const cams = film.cams;
  if (!cams.length) return { x: 0, y: 0, w: film.lay.view.width, h: film.lay.view.width / 1.6 };
  const mix = (a, b, k) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, w: a.w + (b.w - a.w) * k, h: a.h + (b.h - a.h) * k });
  let cur = cams[0].r;
  for (let i = 0; i < cams.length && cams[i].t <= t; i++) {
    const c = cams[i], next = cams[i + 1];
    const until = next && next.t <= t ? next.t : t;
    cur = mix(cur, c.r, c.dur ? ease(clamp((until - c.t) / c.dur, 0, 1)) : 1);
  }
  return cur;
}
function cursorAt(film, t) {
  const p = film.path;
  if (!p.length) return null;
  let i = 0;
  while (i + 1 < p.length && p[i + 1].t <= t) i++;
  const a = p[i], b = p[i + 1];
  if (!b || t <= a.t) return a;
  const k = clamp((t - a.t) / (b.t - a.t), 0, 1);
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, show: a.show };
}
// the clip's own time (out) → the recording's (in): faster where the scene said so
function timeline(film) {
  const segs = [];
  let t = film.t0, speed = 1;
  for (const s of [...film.speeds].sort((a, b) => a.t - b.t)) {
    if (s.t > t) { segs.push({ from: t, to: s.t, speed }); t = s.t; }
    speed = s.speed;
  }
  if (film.t1 > t) segs.push({ from: t, to: film.t1, speed });
  const total = segs.reduce((a, s) => a + (s.to - s.from) / s.speed, 0);
  const at = (u) => {
    let left = u;
    for (const s of segs) {
      const len = (s.to - s.from) / s.speed;
      if (left <= len) return s.from + left * s.speed;
      left -= len;
    }
    return film.t1;
  };
  return { total, at };
}

export async function compose(frames, film, { mp4, poster, director = false }) {
  const { out } = film.lay;
  // (director: the whole screen instead, the camera's part of it outlined: a look at what the camera does, never a guide video)
  const W = out.w, H = director ? Math.round((out.w * film.lay.view.height) / film.lay.view.width / 2) * 2 : out.h;
  const tl = timeline(film);
  const n = Math.max(2, Math.round(tl.total * FPS));
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-crf', '27',
    '-profile:v', 'high', '-level:v', '4.0', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
    '-movflags', '+faststart', '-an', mp4], { stdio: ['pipe', 'ignore', 'pipe'], env: withoutSecrets() });
  let err = '';
  ff.stderr.on('data', (d) => { err += d; });
  const done = new Promise((res) => ff.on('close', res));
  let decoded = { i: -1 }, posterRaw = null;
  const posterT = film.posterAt ?? film.t1 - 0.5;
  let bestPoster = Infinity;
  const cursorPng = await sharp(CURSOR).resize(30, 30).png().toBuffer();
  dbg(`composing ${n} frames from ${frames.length}`);
  for (let f = 0; f < n; f++) {
    if (f % 48 === 0) dbg(`  frame ${f} of ${n}`);
    const u = f / FPS;
    const t = tl.at(u);
    // the frame on screen then (the newest one painted by then)
    let i = 0;
    while (i + 1 < frames.length && frames[i + 1].t <= t) i++;
    if (decoded.i !== i) {
      const { data, info } = await sharp(frames[i].buf).raw().toBuffer({ resolveWithObject: true });
      decoded = { i, data, info };
    }
    const c = camAt(film, t);
    const cur = cursorAt(film, t);
    const iw = decoded.info.width, ih = decoded.info.height, sx = iw / film.lay.view.width;
    const left = clamp(Math.round(c.x * sx), 0, iw - 2), top = clamp(Math.round(c.y * sx), 0, ih - 2);
    const width = clamp(Math.round(c.w * sx), 2, iw - left), height = clamp(Math.round(c.h * sx), 2, ih - top);
    const scale = W / (c.w);
    const layers = [];
    // a touch (a phone) or a click (a computer): a ring growing where it happened
    for (const tap of film.taps) {
      const age = t - tap.t;
      if (age < -0.18 || age > 0.6) continue;
      const x = (tap.x - c.x) * scale, y = (tap.y - c.y) * scale;
      if (film.phone && age < 0.12) {
        const r = 15; layers.push({ input: dot(r, 1), left: Math.round(x - r - 2), top: Math.round(y - r - 2) });
      }
      if (age >= 0) {
        const r = Math.round(10 + age * 46), a = clamp(1 - age / 0.6, 0, 1);
        layers.push({ input: ring(r, a, film.phone ? '#ffffff' : '#a78bfa'), left: Math.round(x - r - 4), top: Math.round(y - r - 4) });
      }
    }
    if (cur && cur.show) {
      const pressed = film.taps.some((tap) => t - tap.t >= 0 && t - tap.t < 0.14);
      const s = pressed ? 26 : 30;
      layers.push({ input: pressed ? await sharp(CURSOR).resize(s, s).png().toBuffer() : cursorPng, left: Math.round((cur.x - c.x) * scale - 4), top: Math.round((cur.y - c.y) * scale - 2) });
    }
    if (director) {
      const k = W / film.lay.view.width;
      const box = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect x="${(c.x * k).toFixed(1)}" y="${(c.y * k).toFixed(1)}" width="${(c.w * k).toFixed(1)}" height="${(c.h * k).toFixed(1)}" fill="none" stroke="#ff3b3b" stroke-width="3"/>${cur ? `<circle cx="${(cur.x * k).toFixed(1)}" cy="${(cur.y * k).toFixed(1)}" r="5" fill="#ffe14d"/>` : ''}</svg>`;
      const raw = await sharp(decoded.data, { raw: { width: iw, height: ih, channels: decoded.info.channels } }).resize(W, H).composite([{ input: Buffer.from(box) }]).removeAlpha().raw().toBuffer();
      if (!ff.stdin.write(raw)) await new Promise((r) => ff.stdin.once('drain', r));
      posterRaw ||= raw;
      continue;
    }
    let img = sharp(decoded.data, { raw: { width: iw, height: ih, channels: decoded.info.channels } })
      .extract({ left, top, width, height }).resize(W, H, { kernel: 'lanczos3' });
    const layered = layers.filter((l) => l.left > -60 && l.top > -60 && l.left < W + 60 && l.top < H + 60);
    let raw = await img.removeAlpha().raw().toBuffer();
    if (layered.length) raw = await sharp(raw, { raw: { width: W, height: H, channels: 3 } }).composite(layered.map((l) => ({ ...l, left: clamp(l.left, -40, W - 1), top: clamp(l.top, -40, H - 1) }))).removeAlpha().raw().toBuffer();
    // a soft dip at its ends (it loops)
    const fadeIn = clamp(u / 0.25, 0, 1), fadeOut = clamp((tl.total - u) / 0.35, 0, 1);
    const k = 0.35 + 0.65 * Math.min(fadeIn, fadeOut);
    if (k < 0.999) for (let p = 0; p < raw.length; p++) raw[p] = Math.round(raw[p] * k);
    if (Math.abs(t - posterT) < bestPoster && k > 0.99) { bestPoster = Math.abs(t - posterT); posterRaw = Buffer.from(raw); }
    if (!ff.stdin.write(raw)) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  const code = await done;
  if (code !== 0) throw new Error(`ffmpeg: ${err}`);
  await sharp(posterRaw, { raw: { width: W, height: H, channels: 3 } }).webp({ quality: 74 }).toFile(poster);
  return { w: W, h: H, s: Math.round((n / FPS) * 100) / 100 };
}

// ---------- the browser, the app served as Vercel serves it (its headers), our server behind it ----------
// (the screencast sends frames at the page's own CSS size unless the browser itself has the pixel ratio: so each layout's
// browser is started with it, and frames come at the full ratio)
async function chromium(dpr = 2) {
  let pw;
  try { pw = await import(process.env.PLAYWRIGHT_CORE || 'playwright-core'); } catch { throw new Error('playwright-core is missing: npm install --no-save playwright-core'); }
  const paths = [process.env.PW_CHROMIUM, process.env.CHROME_PATH, '/opt/pw-browsers/chromium', '/usr/bin/chromium', '/usr/bin/google-chrome'].filter((p) => p && existsSync(p));
  if (!paths.length) throw new Error('no Chrome or Chromium found (PW_CHROMIUM)');
  return pw.chromium.launch({ executablePath: paths[0], env: withoutSecrets(), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars', '--font-render-hinting=none', `--force-device-scale-factor=${dpr}`,
    // (the window put together in software: on a computer without a graphics card it paints about half again as many frames
    // a second as SwiftShader's, 2026-10-11: 15 a second instead of 5 at a computer's size)
    '--disable-gpu-compositing'] });
}
// the demo wallet's picture: a plain wallet, drawn here (never a real wallet's logo)
const WALLET_ICON = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#7c3aed"/><rect x="6" y="9" width="20" height="15" rx="3.5" fill="none" stroke="#fff" stroke-width="2.2"/><path d="M19 14.5h7v5h-7a2.5 2.5 0 0 1 0-5Z" fill="#fff"/><circle cx="20.6" cy="17" r="1.1" fill="#7c3aed"/></svg>').toString('base64')}`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.woff2': 'font/woff2', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webmanifest': 'application/manifest+json', '.jpg': 'image/jpeg' };
const HEADERS = () => {
  const v = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8'));
  return Object.fromEntries(v.headers.find((h) => h.source === '/(.*)').headers.map((h) => [h.key.toLowerCase(), h.value]));
};
async function openPage(browser, dist, B, L, { signedIn = true, store = {} } = {}) {
  const lay = LAYOUTS[L];
  const ctx = await browser.newContext({
    viewport: lay.view, deviceScaleFactor: lay.dpr, isMobile: lay.mobile, hasTouch: lay.mobile, colorScheme: 'dark', locale: 'en-US', timezoneId: 'UTC',
    reducedMotion: 'no-preference', serviceWorkers: 'block',
  });
  const head = HEADERS();
  // (its Copy buttons copy, as in a person's browser)
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGIN });
  const profile = () => ({ session: B.sessionFor(B.WALLET, 2), wallet: B.WALLET, level: 2, name: null, notes: [] });
  await ctx.route('**/*', async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    if (u.origin !== ORIGIN) return route.abort();
    // the site's wallet sign-in (api/wallet.js and its database aren't part of the demo): the demo wallet signs in as a Crush,
    // the same session our server's own checks take
    if (u.pathname === '/api/wallet' && req.method() === 'POST') {
      let body = {};
      try { body = JSON.parse(req.postData() || '{}'); } catch { /* not JSON */ }
      const answer = body.action === 'start' ? { message: `studio.agi1.app wants you to sign in with your wallet:\n${B.WALLET}\n\nA free signature: not a transaction.`, ticket: 'demo' }
        : body.action === 'finish' || body.action === 'profile' ? profile() : null;
      return route.fulfill({ status: answer ? 200 : 400, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(answer || { error: 'bad_request' }) });
    }
    if (u.pathname === '/api/launch') {
      const headers = Object.fromEntries(Object.entries(req.headers()).filter(([k]) => !/^(host|content-length|connection)$/i.test(k)));
      headers['x-real-ip'] = B.IP;
      const bytes = req.method() === 'POST' ? req.postDataBuffer() : null;
      const request = new Request(`${ORIGIN}${u.pathname}${u.search}`, { method: req.method(), headers, ...(bytes ? { body: bytes } : {}) });
      const res = req.method() === 'GET' ? await B.launchGet(request) : await B.launchPost(request);
      return route.fulfill({ status: res.status, headers: Object.fromEntries(res.headers), body: Buffer.from(await res.arrayBuffer()) });
    }
    if (u.pathname.startsWith('/api/')) return route.fulfill({ status: 404, body: '' });
    const file = join(dist, decodeURIComponent(u.pathname));
    if (extname(u.pathname) && file.startsWith(dist) && existsSync(file)) {
      return route.fulfill({ status: 200, headers: { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }, body: readFileSync(file) });
    }
    return route.fulfill({ status: 200, headers: { ...head, 'content-type': 'text/html; charset=utf-8' }, body: readFileSync(join(dist, 'studio.html')) });
  });
  const { makePass, visitorCode } = await import(pathToFileURL(join(ROOT, 'server', 'security.js')).href);
  const session = signedIn ? JSON.stringify({ session: B.sessionFor(B.WALLET, 2), wallet: B.WALLET, level: 2, name: null, notes: [] }) : null;
  const preset = {
    agi1_pass: JSON.stringify(makePass(B.SECRET, visitorCode(B.SECRET, B.IP))), agi1_18plus: 'true',
    agi_guide: JSON.stringify({ seen: ['explore', 'create', 'pick', 'make', 'me'], off: true }), agi_instant_seen: '1', ...(session ? { agi_wallet: session } : {}), ...store,
  };
  await ctx.addInitScript((preset) => {
    if (sessionStorage.getItem('__demo')) return;
    sessionStorage.setItem('__demo', '1');
    for (const [k, v] of Object.entries(preset)) if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
  }, preset);
  // a wallet in this browser (the standard way wallets introduce themselves, EIP-6963): the demo's own, "Your wallet", which
  // shares the demo address and signs the sign-in message (a made-up signature: the demo's sign-in is answered above)
  await ctx.addInitScript(({ wallet, icon }) => {
    const pause = (ms) => new Promise((r) => setTimeout(r, ms));
    const provider = {
      async request({ method }) {
        await pause(350);
        if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [wallet];
        if (method === 'eth_chainId') return '0x1237';
        if (method === 'personal_sign') { await pause(900); return `0x${'5a'.repeat(65)}`; }
        throw Object.assign(new Error('Not in the demo wallet'), { code: 4200 });
      },
      on() {}, removeListener() {},
    };
    const info = Object.freeze({ uuid: '9f3c2b8e-1d4a-4c6b-9e2f-7a5d3c1b0e88', name: 'Your wallet', icon, rdns: 'app.agi1.demo' });
    const announce = () => dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: Object.freeze({ info, provider }) }));
    addEventListener('eip6963:requestProvider', announce);
  }, { wallet: B.WALLET, icon: WALLET_ICON });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_ABORTED|ERR_FAILED/.test(m.text())) errors.push(m.text()); });
  return { ctx, page, errors };
}

// ---------- one video: its scene filmed, then put together ----------
async function film1(browser, dist, B, id, L, scenes, { stills = false } = {}) {
  const sc = scenes[id];
  if (!sc) throw new Error(`no scene for ${id}`);
  dbg(id, L, 'the demo studio…');
  const state = await demo(B);
  dbg(id, L, 'the demo studio is ready');
  // what this scene starts from, besides the demo studio (an influencer whose looks are ready to pick…)
  if (sc.setup) await sc.setup({ B, state, L });
  const { ctx, page, errors } = await openPage(browser, dist, B, L, { signedIn: sc.signedIn !== false, store: sc.store || {} });
  const film = new Film(page, L);
  if (!stills) film.stills = null;
  // its first page, ready before the camera rolls
  await page.goto(`${ORIGIN}${typeof sc.path === 'function' ? sc.path(state) : sc.path}`, { waitUntil: 'load' });
  await page.waitForSelector('#sa-main .sa-page, #sa-main .sa-ws, #sa-main .sa-inf', { timeout: 15000 }).catch(() => {});
  await sleep(1600);
  if (sc.before) await sc.before({ page, film, B, state, L, phone: film.phone });
  const cdp = await ctx.newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', (f) => {
    frames.push({ t: f.metadata.timestamp, buf: Buffer.from(f.data, 'base64') });
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  const lay = LAYOUTS[L];
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: lay.view.width * lay.dpr, maxHeight: lay.view.height * lay.dpr, everyNthFrame: 1 });
  // (a first frame, whatever moves)
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await sleep(400);
  dbg(id, L, 'filming');
  try {
    await sc.run({ page, film, B, state, L, phone: film.phone });
  } catch (err) {
    // (a scene that fails leaves a picture of the screen at that moment: node_modules/.cache/agi1-guide/failed/)
    const shot = join(CACHE, 'failed', `${id}-${L}.png`);
    mkdirSync(dirname(shot), { recursive: true });
    await page.screenshot({ path: shot }).catch(() => {});
    err.message += ` (the screen then: ${shot})`;
    throw err;
  } finally {
    dbg(id, L, `filmed: ${frames.length} frames`);
    await sleep(200);
    await cdp.send('Page.stopScreencast').catch(() => {});
  }
  if (!film.t0 || !film.t1) throw new Error(`${id}: its scene never said start() and end()`);
  // the frames before the clip starts: only the newest one (what's on screen as it starts)
  const first = frames.filter((f) => f.t <= film.t0).at(-1);
  const used = [...(first ? [{ ...first, t: film.t0 }] : []), ...frames.filter((f) => f.t > film.t0 && f.t <= film.t1 + 0.2)];
  if (used.length < 2) throw new Error(`${id}/${L}: only ${used.length} frames`);
  if (errors.length) console.warn(`  ${id}/${L}: the page said ${JSON.stringify(errors.slice(0, 3))}`);
  await ctx.close();
  return { film, frames: used };
}

// ---------- src/studio/guide-media.js ----------
function writeMedia(all) {
  const ids = CLIP_IDS.filter((id) => all[id]);
  const line = (id, k) => {
    const c = all[id][k];
    return `    ${k}: { mp4: new URL('./guide/${id}-${k}.mp4', import.meta.url).href, poster: new URL('./guide/${id}-${k}.webp', import.meta.url).href, w: ${c.w}, h: ${c.h}, s: ${c.s} },`;
  };
  const body = ids.map((id) => `  '${id}': {\n${['d', 'p'].filter((k) => all[id][k]).map((k) => line(id, k)).join('\n')}\n  },`).join('\n');
  const src = `// AGI Studio's guide videos (made by tools/studio/guide-record.mjs from the real app: don't edit; run it again after the app
// changes). Each step's video twice: a computer's (d) and a phone's (p), a soundless MP4 (H.264) and its WebP poster, in
// src/studio/guide/ (Vite gives each its own address, kept a year by browsers). The guide (src/studio/guide.js) shows the one
// for the screen it's on; Learn (src/studio/views/learn.js) plays a lesson's one after the other.
export const CLIPS = {
${body}
};
`;
  writeFileSync(join(ROOT, 'src', 'studio', 'guide-media.js'), src);
}

// ---------- a clip's contact sheet (a look at it without playing it: a frame every half second) ----------
async function sheet(mp4, png, { every = 0.5, cols = 5, w = 336 } = {}) {
  const dir = join(CACHE, 'sheet-frames');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const r = spawnSync('ffmpeg', ['-loglevel', 'error', '-i', mp4, '-vf', `fps=${1 / every},scale=${w}:-2`, join(dir, 'f%03d.png')], { env: withoutSecrets() });
  if (r.status !== 0) throw new Error(`ffmpeg (a sheet): ${r.stderr}`);
  const files = (await import('node:fs')).readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
  const first = await sharp(join(dir, files[0])).metadata();
  const h = first.height, pad = 6, label = 18;
  const rows = Math.ceil(files.length / cols);
  const layers = [];
  for (const [i, f] of files.entries()) {
    const x = pad + (i % cols) * (w + pad), y = pad + Math.floor(i / cols) * (h + pad + label);
    layers.push({ input: join(dir, f), left: x, top: y + label });
    layers.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${label}"><text x="2" y="13" font-family="monospace" font-size="12" fill="#ddd">${(i * every).toFixed(1)} s</text></svg>`), left: x, top: y });
  }
  mkdirSync(dirname(png), { recursive: true });
  await sharp({ create: { width: pad + cols * (w + pad), height: pad + rows * (h + pad + label), channels: 3, background: '#1b1b1f' } }).composite(layers).png().toFile(png);
  rmSync(dir, { recursive: true, force: true });
  return png;
}

// ---------- the whole run ----------
async function main() {
  const args = process.argv.slice(2);
  const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const only = opt('--only') ? opt('--only').split(',') : null;
  const layouts = opt('--layout') ? opt('--layout').split(',') : ['d', 'p'];
  const stills = args.includes('--stills');
  for (const id of only || []) if (!CLIP_IDS.includes(id)) throw new Error(`no such video: ${id} (${CLIP_IDS.join(', ')})`);
  if (spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status !== 0) throw new Error('ffmpeg is missing');
  const { SCENES } = await import(pathToFileURL(join(HERE, 'guide-scripts.mjs')).href);
  // (--no-build: the app as it was last built here, when it's there: a quicker look while a scene is being written)
  const built = join(CACHE, 'dist', 'studio.html');
  let dist;
  if (args.includes('--no-build') && existsSync(built)) dist = join(CACHE, 'dist');
  else { console.log('building the app…'); dist = await buildApp(); }
  const B = await demoBackend();
  // (our server's log lines: quiet, unless something goes wrong)
  const said = [];
  console.error = (...a) => said.push(a.join(' '));
  console.warn = (...a) => process.stdout.write(`${a.join(' ')}\n`);
  // (a browser for each layout: its pixel ratio is the browser's own, see chromium())
  const browsers = {};
  const browserFor = async (L) => (browsers[L] ||= await chromium(LAYOUTS[L].dpr));
  mkdirSync(OUT, { recursive: true });
  let all = {};
  try { all = JSON.parse(JSON.stringify((await import(`${pathToFileURL(join(ROOT, 'src', 'studio', 'guide-media.js')).href}?v=${Date.now()}`)).CLIPS)); } catch { all = {}; }
  const stillDir = join(CACHE, 'stills');
  if (stills) mkdirSync(stillDir, { recursive: true });
  const todo = only || CLIP_IDS;
  for (const id of todo) {
    for (const L of layouts) {
      const t = Date.now();
      try {
        const { film, frames } = await film1(await browserFor(L), dist, B, id, L, SCENES, { stills });
        if (stills) {
          for (const s of film.stills) writeFileSync(join(stillDir, `${id}-${L}-${s.name}.png`), s.png);
          console.log(`${id}/${L}: ${film.stills.length} stills`);
          continue;
        }
        if (args.includes('--director')) {
          mkdirSync(join(CACHE, 'director'), { recursive: true });
          const mp4 = join(CACHE, 'director', `${id}-${L}.mp4`);
          await compose(frames, film, { mp4, poster: join(CACHE, 'director', `${id}-${L}.webp`), director: true });
          console.log(`${id}/${L}: the director's view, ${await sheet(mp4, join(CACHE, 'sheets', `${id}-${L}-director.png`), { cols: 4, w: 420 })}`);
          continue;
        }
        const info = await compose(frames, film, { mp4: join(OUT, `${id}-${L}.mp4`), poster: join(OUT, `${id}-${L}.webp`) });
        all[id] = { ...(all[id] || {}), [L]: info };
        const kb = Math.round(readFileSync(join(OUT, `${id}-${L}.mp4`)).length / 1024);
        console.log(`${id}/${L}: ${info.s} s, ${kb} KB, ${frames.length} frames (${Math.round((Date.now() - t) / 1000)} s)`);
        if (args.includes('--sheet')) console.log(`  its sheet: ${await sheet(join(OUT, `${id}-${L}.mp4`), join(CACHE, 'sheets', `${id}-${L}.png`))}`);
      } catch (err) {
        console.log(`${id}/${L}: FAILED: ${err.message}`);
        if (said.length) console.log(`  our server said: ${said.slice(-4).join(' | ')}`);
        process.exitCode = 1;
      }
      said.length = 0;
    }
    if (!stills) writeMedia(all);
  }
  for (const b of Object.values(browsers)) await b.close();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => { console.log(err.stack || err.message); process.exit(1); });
}
