// The pictures of her live set, painted by Google's image AI (2026-10-07, the owner after a preview of her trips: "so bad",
// then "Painted art"): tools/live/art.mjs, run on the owner's server with the Google key her voice already uses. What each
// picture asks for (never a real person, text, a logo or anyone's artwork; the people and accessories on green, to be cut
// out), the request to Vertex AI, the picture in its answer, resuming a run, a model Google doesn't have, "wait", a
// refusal, and the runner's options. No network: Google is faked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateKeyPairSync } from 'node:crypto';
import sharp from 'sharp';
import { artList, artRequest, imageFrom, toMake, makeArt, artSettings, extOf, ART_MODELS, PROMPTS, STYLE_REF, styleRef } from '../tools/live/art.mjs';
import { PLACE_IDS } from '../tools/live/page/places.js';
import { VEHICLE_IDS } from '../tools/live/page/vehicles.js';
import { PEOPLE_IDS } from '../tools/live/page/people.js';
import { ROOMS } from '../tools/live/page/rooms.js';
import { parseArgs } from '../tools/live/run.mjs';
import { isCrude } from '../server/coins.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('what each picture asks for: every place, room, ride, person and accessory; no people, text or logos behind her; the people and accessories on green; never anyone real', () => {
  const list = artList();
  const of = (g) => list.filter((x) => x.group === g).map((x) => x.id).sort();
  assert.deepEqual(of('places'), [...PLACE_IDS].sort());
  assert.deepEqual(of('rooms'), Object.keys(ROOMS).sort());
  assert.deepEqual(of('rides'), [...VEHICLE_IDS].sort());
  assert.deepEqual(of('people'), [...PEOPLE_IDS].sort());
  assert.ok(of('accessories').length >= 30);
  assert.equal(new Set(list.map((x) => `${x.group}/${x.id}`)).size, list.length, 'each once');
  for (const x of list) {
    assert.ok(!isCrude(x.prompt), x.id);
    assert.doesNotMatch(x.prompt, /\$\w|\b(?:buy|sell|pump|crypto|coin|token)\b/i, `${x.id}: nothing about money`);
    if (['places', 'rooms', 'rides'].includes(x.group)) {
      assert.equal(x.aspect, '16:9');
      assert.match(x.prompt, /No people, no characters/);
      assert.match(x.prompt, /no text, no letters, no numbers, no logos/);
      assert.match(x.prompt, /right (third|half)/, `${x.id}: room for her on the right`);
      assert.equal(x.variants, 2);
    } else {
      assert.match(x.prompt, /pure bright green background \(#00FF00\)/, `${x.id}: on green, to be cut out`);
      assert.match(x.prompt, /no text/);
    }
    if (x.group === 'people') {
      assert.match(x.prompt, /an original made-up character \(not anyone real\)/);
      assert.match(x.prompt, /Waist-up/);
      assert.deepEqual(x.refOn, [2], 'one of two with her picture as the style to match');
    }
    if (x.group === 'accessories') assert.match(x.prompt, /with no person and no head/);
  }
  // the people as their voices sound (people.js): the same names
  for (const id of PEOPLE_IDS) assert.ok(PROMPTS.people[id], id);
  assert.equal(list.reduce((n, x) => n + x.variants, 0), 152, 'about $5–10 in all');
  assert.equal(extOf('places'), 'jpg');
  assert.equal(extOf('people'), 'webp');
});

test('the request to Vertex AI: its model, an image in its answer, the picture\'s shape and size; her picture as the style to match, said so', () => {
  const s = { project: 'agi-daria', location: 'global' };
  const item = artList().find((x) => x.id === 'omar');
  const r = artRequest(s, 'gemini-nano-banana-2.1', item, { bearer: 'tok', ref: Buffer.from('png') });
  assert.equal(r.url, 'https://aiplatform.googleapis.com/v1beta1/projects/agi-daria/locations/global/publishers/google/models/gemini-nano-banana-2.1:generateContent');
  assert.equal(r.init.headers.Authorization, 'Bearer tok');
  const body = JSON.parse(r.init.body);
  assert.deepEqual(body.generationConfig, { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '3:4', imageSize: '1K' } });
  assert.equal(body.contents[0].parts[0].inlineData.mimeType, 'image/png');
  assert.match(body.contents[0].parts[1].text, /Draw a completely different person, not the girl in the picture/);
  const plain = JSON.parse(artRequest({ ...s, location: 'us-central1' }, 'm', item, { bearer: 't', size: false, imageOnly: false }).init.body);
  assert.deepEqual(plain.generationConfig, { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: '3:4' } });
  assert.equal(plain.contents[0].parts.length, 1);
  assert.match(artRequest({ ...s, location: 'us-central1' }, 'm', item, { bearer: 't' }).url, /^https:\/\/us-central1-aiplatform\.googleapis\.com\//);
  // the picture in an answer
  assert.deepEqual(imageFrom({ candidates: [{ content: { parts: [{ text: 'hi' }, { inlineData: { mimeType: 'image/png', data: Buffer.from('abc').toString('base64') } }] } }] }), Buffer.from('abc'));
  assert.equal(imageFrom({ candidates: [{ content: { parts: [{ text: 'no' }] }, finishReason: 'SAFETY' }] }), null);
  assert.equal(imageFrom({}), null);
  // the settings
  const st = artSettings({ LIVE_OUT_DIR: '/out', LIVE_ART_MODEL: 'x-image', GOOGLE_APPLICATION_CREDENTIALS: '/secrets/k.json' });
  assert.deepEqual(st.models, ['x-image', ...ART_MODELS]);
  assert.equal(st.outDir, '/out/art');
  assert.equal(st.max, 220);
});

test('her picture as the style to match: her 2D self (her Live2D model\'s render), never the 3D model; cut above the "AGI" on her shirt', async () => {
  assert.equal(STYLE_REF, 'public/images/agi1-live-2d.webp');
  const src = read('tools/live/art.mjs');
  assert.doesNotMatch(src, /agi1-portrait|agi1-live\.webp|\.glb\b|agi1-avatar/, 'never the 3D model or a render of it');
  const png = await styleRef(sharp);
  const m = await sharp(png).metadata();
  const full = await sharp(readFileSync(new URL(`../${STYLE_REF}`, import.meta.url))).metadata();
  assert.equal(m.format, 'png');
  assert.equal(m.width, full.width);
  assert.ok(m.height < full.height * 0.85 && m.height > full.height * 0.8, 'her head and hair, not the letters on her shirt');
  // the letters on her shirt sit low in the picture: the bottom 15% is cut off
  const { data, info } = await sharp(readFileSync(new URL(`../${STYLE_REF}`, import.meta.url))).flatten({ background: '#ffffff' }).raw().toBuffer({ resolveWithObject: true });
  let white = 0;
  for (let y = Math.round(info.height * 0.86); y < Math.round(info.height * 0.97); y++) {
    for (let x = Math.round(info.width * 0.35); x < Math.round(info.width * 0.65); x++) {
      const i = (y * info.width + x) * info.channels;
      if (data[i] > 235 && data[i + 1] > 235 && data[i + 2] > 235) white += 1;
    }
  }
  assert.ok(white > 300, 'the white letters are there, below the cut');
});

test('a run carries on where it stopped; --art-only makes one more of each named', () => {
  const list = artList();
  const all = toMake(list, '/out/art', { exists: () => false });
  assert.equal(all.length, 152);
  const some = toMake(list, '/out/art', { exists: (f) => f.includes('/places/') });
  assert.equal(some.length, 152 - 40);
  const omar = toMake(list, '/out/art', { only: ['omar'], files: () => ['omar-1.webp', 'omar-2.webp', 'paris-1.jpg'] });
  assert.equal(omar.length, 1);
  assert.equal(omar[0].file, '/out/art/people/omar-3.webp');
  assert.equal(toMake(list, '/out/art', { only: ['paris'], files: () => [] })[0].file, '/out/art/places/paris-1.jpg');
  // the runner's options
  assert.equal(parseArgs(['--art']).art, true);
  assert.deepEqual(parseArgs(['--art-only', 'paris, omar']).artOnly, ['paris', 'omar']);
  assert.throws(() => parseArgs(['--art-only']), /--art-only/);
  assert.match(read('tools/live/run.mjs'), /if \(a\.art\) \{\s*const \{ makeArt \} = await import\('\.\/art\.mjs'\);/);
  assert.match(read('tools/live/live.sh'), /sh tools\/live\/live\.sh --art /);
});

test('making them with a fake Google: the service account\'s token, a model Google doesn\'t have (the next), "wait", a refusal, files and a manifest, then nothing left to make', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'agi1-art-'));
  try {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const keyFile = join(dir, 'key.json');
    writeFileSync(keyFile, JSON.stringify({ type: 'service_account', client_email: 'art@agi-daria.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }), project_id: 'agi-daria', token_uri: 'https://oauth2.example/token' }));
    const png = await sharp({ create: { width: 64, height: 36, channels: 3, background: '#7a5cff' } }).png().toBuffer();
    const calls = [];
    let waits = 0, said429 = false;
    const fetchFn = async (url, init) => {
      if (url === 'https://oauth2.example/token') return new Response(JSON.stringify({ access_token: 'ya29.fake', expires_in: 3600 }), { status: 200 });
      const model = /models\/([^:]+):/.exec(url)[1];
      const body = JSON.parse(init.body);
      calls.push({ model, text: body.contents[0].parts.at(-1).text, ref: body.contents[0].parts.length > 1 });
      if (model === 'gemini-nano-banana-2.1') return new Response('{"error":{"code":404,"message":"Publisher model not found"}}', { status: 404 });
      if (!said429) { said429 = true; return new Response('{"error":{"code":429}}', { status: 429 }); }
      if (/Commander Nova/.test(body.contents[0].parts.at(-1).text)) return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'sorry' }] }, finishReason: 'SAFETY' }] }), { status: 200 });
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: png.toString('base64') } }] } }] }), { status: 200 });
    };
    const lines = [];
    const env = { GOOGLE_APPLICATION_CREDENTIALS: keyFile, LIVE_OUT_DIR: dir };
    const r = await makeArt({ env, fetchFn, log: { log: (m) => lines.push(m) }, sleepFn: async () => { waits += 1; } });
    assert.equal(r.model, 'gemini-3.1-flash-image', 'the next model when the first isn\'t there');
    assert.equal(waits, 1, 'one "wait", then on');
    assert.equal(r.made + r.failed, 152);
    assert.equal(r.failed, 2, 'Nova refused twice: skipped, not fatal');
    assert.ok(existsSync(join(dir, 'art/places/paris-1.jpg')) && existsSync(join(dir, 'art/people/omar-2.webp')) && existsSync(join(dir, 'art/accessories/sunhat-pink-1.webp')));
    assert.equal((await sharp(join(dir, 'art/places/paris-1.jpg')).metadata()).format, 'jpeg');
    assert.equal((await sharp(join(dir, 'art/people/omar-1.webp')).metadata()).format, 'webp');
    const manifest = JSON.parse(readFileSync(join(dir, 'art/manifest.json'), 'utf8'));
    assert.equal(manifest.made.length, 150);
    assert.ok(manifest.made.every((m) => m.model === 'gemini-3.1-flash-image' && m.prompt));
    assert.ok(calls.filter((c) => c.ref).length === 21 && calls.filter((c) => c.ref).every((c) => /Draw a completely different person/.test(c.text)), 'her picture with one of each person, said so');
    assert.ok(lines.some((l) => /gemini-nano-banana-2\.1 isn't there for this project/.test(l)));
    assert.ok(!lines.join('\n').includes('ya29.'), 'the token never in a log');
    // again: only Nova's two are left
    const again = await makeArt({ env, fetchFn: async (url, init) => (url.includes('oauth2') ? fetchFn(url, init) : new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: png.toString('base64') } }] } }] }), { status: 200 })), log: { log: () => {} }, sleepFn: async () => {} });
    assert.equal(again.made, 2);
    assert.equal((await makeArt({ env, fetchFn, log: { log: () => {} } })).made, 0, 'nothing left to make');
    // one more of a picture
    await makeArt({ env, only: ['paris'], fetchFn: async (url, init) => (url.includes('oauth2') ? fetchFn(url, init) : new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: png.toString('base64') } }] } }] }), { status: 200 })), log: { log: () => {} } });
    assert.ok(readdirSync(join(dir, 'art/places')).includes('paris-3.jpg'));
    await assert.rejects(makeArt({ env, only: ['atlantis'], fetchFn, log: { log: () => {} } }), /no picture called atlantis/);
    await assert.rejects(makeArt({ env: { LIVE_OUT_DIR: dir }, fetchFn, log: { log: () => {} } }), /no GOOGLE_APPLICATION_CREDENTIALS/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a model that doesn\'t take the picture\'s size: learned once for the whole run, never a picture skipped for it', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'agi1-art-size-'));
  try {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const keyFile = join(dir, 'key.json');
    writeFileSync(keyFile, JSON.stringify({ type: 'service_account', client_email: 'art@agi-daria.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }), project_id: 'agi-daria', token_uri: 'https://oauth2.example/token' }));
    const png = await sharp({ create: { width: 32, height: 18, channels: 3, background: '#ffc933' } }).png().toBuffer();
    let withSize = 0, asked = 0;
    const fetchFn = async (url, init) => {
      if (url === 'https://oauth2.example/token') return new Response(JSON.stringify({ access_token: 'ya29.fake', expires_in: 3600 }), { status: 200 });
      asked += 1;
      const body = JSON.parse(init.body);
      if (body.generationConfig.imageConfig.imageSize) { withSize += 1; return new Response('{"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \\"imageSize\\" at \'generation_config.image_config\'"}}', { status: 400 }); }
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: png.toString('base64') } }] } }] }), { status: 200 });
    };
    const r = await makeArt({ env: { GOOGLE_APPLICATION_CREDENTIALS: keyFile, LIVE_OUT_DIR: dir, LIVE_ART_MAX: '7' }, fetchFn, log: { log: () => {} }, sleepFn: async () => {} });
    assert.equal(r.made, 7);
    assert.equal(r.failed, 0);
    assert.equal(withSize, 1, 'asked with a size once, then never again');
    assert.equal(asked, 8);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ---------- (2026-10-07) making them ready for her set: tools/live/art-cut.mjs, and her set finding them ----------
test('cutting them out: the green keyed out (and green seen through a gap or a glass), a green thing of its own kept, its edges clean, specks dropped', async () => {
  const { keyOut, dropSpecks, opaqueBox, keyColor } = await import('../tools/live/art-cut.mjs');
  const W = 640, H = 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#00ff00"/>
    <circle cx="90" cy="100" r="60" fill="#ffffff" stroke="#170a36" stroke-width="5"/>
    <circle cx="250" cy="100" r="60" fill="none" stroke="#170a36" stroke-width="22"/>
    <rect x="360" y="40" width="110" height="120" fill="#3ff0c3"/>
    <ellipse cx="560" cy="100" rx="55" ry="35" fill="#3cb43c" stroke="#170a36" stroke-width="5"/>
    <rect x="40" y="220" width="250" height="90" rx="20" fill="#e8e8f2" stroke="#170a36" stroke-width="6"/>
    <rect x="70" y="240" width="190" height="50" rx="12" fill="#00ff00" stroke="#170a36" stroke-width="4"/>
    <rect x="70" y="240" width="190" height="50" rx="12" fill="#ffffff" fill-opacity="0.5"/>
    <path d="M620 340 l4 -10 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 z" fill="#ffffff"/></svg>`;
  const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual(keyColor(data, info.width, info.height), [0, 255, 0]);
  const px = (out, x, y) => Array.from(out.subarray((y * W + x) * 4, (y * W + x) * 4 + 4));
  const plain = keyOut(data, W, H);
  assert.equal(px(plain, 5, 5)[3], 0, 'the background');
  assert.deepEqual(px(plain, 90, 100), [255, 255, 255, 255], 'a white thing');
  assert.equal(px(plain, 250, 100)[3], 0, 'green inside a ring: a gap');
  assert.deepEqual(px(plain, 415, 100), [63, 240, 195, 255], 'a mint thing of its own, touching the background');
  assert.deepEqual(px(plain, 361, 100), [63, 240, 195, 255], 'its edge not made less green');
  assert.deepEqual(px(plain, 560, 100), [60, 180, 60, 255], 'a green thing inside its outline');
  assert.equal(px(plain, 165, 265)[3], 255, 'a tinted glass stays as it is unless said so');
  // a picture with a glass in it (a visor): green seen through it, a little tinted, goes see-through, white
  const glass = keyOut(data, W, H, { seeThrough: 0.38 });
  const v = px(glass, 165, 265);
  assert.ok(v[3] > 80 && v[3] < 160 && v[0] > 240 && v[1] > 240 && v[2] > 240, `the visor: ${v}`);
  // a speck in a corner (like a mark) goes; the things themselves stay
  assert.ok(px(plain, 628, 344)[3] > 200);
  const r = dropSpecks(plain, W, H);
  assert.ok(r.dropped > 0 && px(plain, 628, 344)[3] === 0, 'the speck dropped');
  assert.ok(px(plain, 90, 100)[3] === 255 && px(plain, 415, 100)[3] === 255 && px(plain, 560, 100)[3] === 255);
  const b = opaqueBox(plain, W, H);
  assert.ok(b.left <= 30 && b.top <= 40 && b.left + b.width >= 612 && b.top + b.height <= 330, JSON.stringify(b));
  // an edge half outline, half green: about half see-through, and no green in its color
  let edges = 0;
  for (let x = 20; x < 40; x++) {
    const [rr, gg, bb, aa] = px(plain, x, 100);
    if (aa > 0 && aa < 255) { edges += 1; assert.ok(gg <= Math.max(rr, bb) + 12, `x ${x}: ${[rr, gg, bb, aa]}`); }
  }
  assert.ok(edges >= 1, 'a soft edge');
});

test('(2026-10-08) what the first paintings needed: an olive green keyed too, a flower\'s own green leaves kept, a visor\'s tinted glints made white, headphones\' cups and a headband\'s ends as on a head; a backdrop\'s part', async () => {
  const { keyColor, keyOut, whitenGlints, outerCups, trimBandEnds, opaqueBox, cropRaw, cutOne, SEE_THROUGH, GREEN_INSIDE, GLASS_GLINTS, OUTER_CUPS, BAND_ENDS } = await import('../tools/live/art-cut.mjs');
  const raw = async (svg) => (await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }));
  const A = (rgba, w, x, y) => rgba[(y * w + x) * 4 + 3];
  // the green behind the conical hat was an olive one (150, 204, 69): still the background
  {
    const { data, info } = await raw(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120"><rect width="100%" height="100%" fill="#96cc45"/><circle cx="100" cy="60" r="30" fill="#e8d8a8" stroke="#6b4f2a" stroke-width="4"/></svg>`);
    const k = keyColor(data, info.width, info.height);
    assert.ok(Math.abs(k[0] - 150) < 3 && Math.abs(k[1] - 204) < 3 && Math.abs(k[2] - 69) < 3, `the olive: ${k}`);
    const out = keyOut(data, info.width, info.height);
    assert.equal(A(out, 200, 5, 5), 0);
    assert.equal(A(out, 200, 100, 60), 255);
  }
  // a flower with its own light-green leaves touching the background: only the background's own green is keyed from the
  // edges in (else its leaves came out grey and half see-through)
  {
    const { data, info } = await raw(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160"><rect width="100%" height="100%" fill="#00ff00"/><ellipse cx="80" cy="80" rx="60" ry="28" fill="#7fd67f"/><circle cx="160" cy="80" r="40" fill="#ff4da6" stroke="#8a1c50" stroke-width="4"/></svg>`);
    const plain = keyOut(data, info.width, info.height), kept = keyOut(data, info.width, info.height, { grow: GREEN_INSIDE['flower-hibiscus'] });
    assert.ok(A(plain, 240, 60, 80) < 200, `with the usual reach, its leaf goes: ${A(plain, 240, 60, 80)}`);
    assert.equal(A(kept, 240, 60, 80), 255, 'the hibiscus\' reach keeps it');
    assert.equal(A(kept, 240, 3, 3), 0, 'the background still goes');
    assert.equal(A(kept, 240, 160, 80), 255);
  }
  assert.ok(SEE_THROUGH.helmet > 0 && GLASS_GLINTS.helmet === true && GREEN_INSIDE['flower-hibiscus'] > 0.5);
  // a visor's reflections painted mint by the green behind it: a see-through white
  {
    const px = new Uint8Array([90, 230, 200, 255, 200, 180, 190, 255, 0, 255, 0, 0]);
    assert.equal(whitenGlints(px, 3, 1), 1);
    assert.deepEqual(Array.from(px.subarray(0, 4)), [191, 191, 197, 153]);
    assert.deepEqual(Array.from(px.subarray(4, 8)), [200, 180, 190, 255], 'not green: as it is');
  }
  // headphones painted from the front: each cup's inside (its dark cushion, which showed by her eyes) goes, its outer part
  // (stripe and shell), the band and its arms stay
  {
    const W = 480, H = 520;
    const cup = (cx, s) => `<ellipse cx="${cx}" cy="400" rx="95" ry="110" fill="#303036" stroke="#111" stroke-width="4"/>
      <path d="M${cx - s * 70} 320 Q${cx - s * 92} 400 ${cx - s * 60} 490" fill="none" stroke="#ff4da6" stroke-width="10"/>
      <ellipse cx="${cx + s * 40}" cy="410" rx="55" ry="90" fill="#0c0c10"/>`;
    const { data } = await raw(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#00ff00"/>
      <path d="M44 300 L44 250 Q44 30 240 30 Q436 30 436 250 L436 300" fill="none" stroke="#2a2a2e" stroke-width="30"/>${cup(110, 1)}${cup(370, -1)}</svg>`);
    const keyed = keyOut(data, W, H);
    const box = opaqueBox(keyed, W, H), own = cropRaw(keyed, W, box), at = (x, y) => A(own, box.width, x - box.left, y - box.top);
    assert.ok(at(150, 410) === 255 && at(330, 410) === 255, 'their cushions, before');
    assert.ok(outerCups(own, box.width, box.height, OUTER_CUPS['headphones-midnight']) > 1000);
    assert.ok(at(150, 410) === 0 && at(330, 410) === 0 && at(170, 380) === 0, 'their cushions go');
    for (const [x, y] of [[24, 400], [456, 400], [42, 400], [438, 400], [240, 30], [44, 240], [436, 240], [80, 300]]) assert.equal(at(x, y), 255, `kept: ${x}, ${y}`);
    // a soft line, a few pixels wide
    const row = Array.from({ length: 60 }, (_, k) => at(80 + k, 420));
    assert.ok(row.some((a) => a > 0 && a < 255), `soft: ${row.join(',')}`);
    // only the headphones: the others are cut as before
    assert.deepEqual(Object.keys(OUTER_CUPS).sort(), ['headphones-gamer', 'headphones-midnight']);
    const dir = mkdtempSync(join(tmpdir(), 'agi1-cups-'));
    try {
      writeFileSync(join(dir, 'hp.png'), await sharp(data, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer());
      const opaque = async (id) => {
        await cutOne(sharp, join(dir, 'hp.png'), { group: 'accessories', id }, { out: join(dir, 'out') });
        const { data: d, info } = await sharp(join(dir, 'out', 'accessories', `${id}.webp`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        let n = 0; for (let p = 3; p < d.length; p += 4) n += d[p] > 128; return { n, w: info.width, h: info.height };
      };
      const a = await opaque('headphones-midnight'), b = await opaque('headset');
      assert.deepEqual([a.w, a.h], [b.w, b.h], 'its size as before: where it sits on her is measured on the whole picture');
      assert.ok(a.n < b.n * 0.8, `${a.n} of ${b.n} pixels left`);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
  // cat ears on a headband painted whole: below the ears, where only the band's thin ends are, it fades out
  {
    const W = 500, H = 460;
    const { data } = await raw(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#00ff00"/>
      <path d="M110 440 C 110 150, 390 150, 390 440" fill="none" stroke="#170a36" stroke-width="12"/>
      <polygon points="40,260 200,260 90,20" fill="#222" stroke="#000" stroke-width="3"/><polygon points="300,260 460,260 410,20" fill="#222" stroke="#000" stroke-width="3"/></svg>`);
    const keyed = keyOut(data, W, H);
    assert.ok(A(keyed, W, 111, 420) === 255 && A(keyed, W, 389, 420) === 255, 'the band\'s ends, before');
    assert.ok(trimBandEnds(keyed, W, H) > 100);
    assert.ok(A(keyed, W, 111, 420) === 0 && A(keyed, W, 389, 420) === 0 && A(keyed, W, 111, 330) === 0, 'they go');
    for (const [x, y] of [[100, 200], [400, 200], [120, 255], [250, 222]]) assert.equal(A(keyed, W, x, y), 255, `kept: ${x}, ${y}`);
    assert.deepEqual(Object.keys(BAND_ENDS).sort(), ['catears-black', 'catears-white']);
  }
  // a hat painted a little from below, its inside showing (the beanie's brown oval, over her forehead like a visor): the
  // inside goes, the cuff stays with its line, and the cuff's own shading (the inside's color too) never goes with it
  {
    const { dropHatInside, HAT_INSIDE } = await import('../tools/live/art-cut.mjs');
    const W = 400, H = 380;
    const { data } = await raw(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#00ff00"/>
      <path d="M60 230 Q60 20 200 20 Q340 20 340 230 Z" fill="#e3bc53" stroke="#4a2e10" stroke-width="4"/>
      <rect x="40" y="210" width="320" height="130" rx="30" fill="#e5b752" stroke="#4a2e10" stroke-width="4"/>
      <rect x="300" y="215" width="55" height="85" fill="#b27b39"/>
      <path d="M70 330 Q200 285 330 330 Q200 372 70 330 Z" fill="#b27b39" stroke="#4a2e10" stroke-width="3"/>
      <rect x="282" y="296" width="4" height="38" fill="#b27b39"/><rect x="282" y="296" width="20" height="4" fill="#b27b39"/></svg>`);
    const keyed = keyOut(data, W, H);
    const box = opaqueBox(keyed, W, H), own = cropRaw(keyed, W, box), at = (x, y) => A(own, box.width, x - box.left, y - box.top);
    assert.equal(at(200, 330), 255, 'its inside, before');
    assert.ok(dropHatInside(own, box.width, box.height) > 1000);
    for (const [x, y] of [[200, 330], [150, 335], [250, 335], [200, 350]]) assert.equal(at(x, y), 0, `its inside goes: ${x}, ${y}`);
    for (const [x, y] of [[200, 100], [200, 250], [120, 250], [330, 250], [325, 280], [50, 300]]) assert.equal(at(x, y), 255, `kept: ${x}, ${y}`);
    assert.deepEqual(Object.keys(HAT_INSIDE), ['beanie-yellow']);
  }
  // a backdrop painted as two pictures: a 16:9 part of it (its seam put where she stands); anything else refused
  {
    const dir = mkdtempSync(join(tmpdir(), 'agi1-crop-'));
    try {
      writeFileSync(join(dir, 'b.jpg'), await sharp({ create: { width: 1376, height: 768, channels: 3, background: '#7fb9e8' } }).jpeg().toBuffer());
      const made = await cutOne(sharp, join(dir, 'b.jpg'), { group: 'rides', id: 'balloon' }, { out: join(dir, 'out'), crop: [0, 115, 957, 538] });
      assert.deepEqual([made.width, made.height], [1280, 720]);
      await assert.rejects(cutOne(sharp, join(dir, 'b.jpg'), { group: 'rides', id: 'balloon' }, { out: join(dir, 'out'), crop: [0, 0, 700, 700] }), /16:9/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
});

test('(2026-10-08, the owner: "some hats not even wearing to her head") the conical hat\'s band and chin straps painted over, its own thin lines kept; worn with her head inside it: its underside behind her face and hair, its cone in front', async () => {
  const { dropStraps, keyOut, cutOne, HAT_STRAPS } = await import('../tools/live/art-cut.mjs');
  const A = (rgba, w, x, y) => rgba[(y * w + x) * 4 + 3];
  const L = (rgba, w, x, y) => { const o = (y * w + x) * 4; return 0.3 * rgba[o] + 0.59 * rgba[o + 1] + 0.11 * rgba[o + 2]; };
  // a hat painted from a little below: its cone and its underside with thin outlines, a thick dark band inside it and two
  // thick straps from the band, hanging below its brim (one with a thin end, a string)
  const W = 400, H = 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#00ff00"/>
    <path d="M20 220 L200 20 L380 220" fill="#e8d2a0" stroke="#3a2a14" stroke-width="3" stroke-linejoin="round"/>
    <ellipse cx="200" cy="220" rx="180" ry="50" fill="#c9a86a" stroke="#3a2a14" stroke-width="3"/>
    <rect x="100" y="225" width="200" height="12" fill="#1a1410"/>
    <path d="M130 237 L160 345 M270 237 L240 345" stroke="#1a1410" stroke-width="9" stroke-linecap="round"/>
    <path d="M160 348 L162 358" stroke="#1a1410" stroke-width="2"/></svg>`;
  const { data } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = keyOut(data, W, H);
  assert.ok(L(px, W, 200, 231) < 40 && L(px, W, 153, 320) < 40 && A(px, W, 153, 320) === 255, 'the band and a strap, before');
  assert.ok(dropStraps(px, W, H) > 5000);
  // the band and the straps inside the hat: its lining's color (never the green keyed out round it), all there
  for (const [x, y] of [[200, 231], [135, 255], [131, 232], [134, 240], [266, 240], [120, 231]]) {
    assert.ok(Math.abs(L(px, W, x, y) - 171) < 6 && A(px, W, x, y) === 255, `painted over: ${x}, ${y} (${L(px, W, x, y).toFixed(0)}, ${A(px, W, x, y)})`);
  }
  // the straps below its brim: nothing either side, gone
  for (const [x, y] of [[153, 320], [158, 338], [247, 320]]) assert.equal(A(px, W, x, y), 0, `gone: ${x}, ${y}`);
  // its own lines kept, and nothing tinted green
  for (const [x, y] of [[110, 120], [290, 120], [200, 270], [20, 220]]) assert.ok(L(px, W, x, y) < 60 && A(px, W, x, y) > 200, `its line: ${x}, ${y}`);
  for (let p = 0; p < W * H; p++) if (px[p * 4 + 3] > 20) assert.ok(px[p * 4 + 1] - Math.max(px[p * 4], px[p * 4 + 2]) < 12, `green at ${p % W}, ${Math.floor(p / W)}`);
  assert.equal(dropStraps(px, W, H), 0, 'nothing thick and dark left');
  // a painting with only its thin lines: nothing changes (where its cone's lines meet its brim's, they're thick for a
  // moment: they stay, its outline whole)
  const thin = keyOut((await sharp(Buffer.from(svg.replace(/<rect x="100"[^>]*\/>\s*<path d="M130[^>]*\/>\s*<path d="M160[^>]*\/>/, ''))).ensureAlpha().raw().toBuffer()), W, H);
  const before = thin.slice();
  assert.equal(dropStraps(thin, W, H), 0);
  assert.deepEqual(thin, before);
  // only the conical hat's painting: cutOne does it for it alone
  assert.deepEqual(Object.keys(HAT_STRAPS), ['conical']);
  const dir = mkdtempSync(join(tmpdir(), 'agi1-straps-'));
  try {
    writeFileSync(join(dir, 'h.png'), await sharp(Buffer.from(svg)).png().toBuffer());
    const darkOf = async (id) => {
      await cutOne(sharp, join(dir, 'h.png'), { group: 'accessories', id }, { out: join(dir, 'out') });
      const { data: d } = await sharp(join(dir, 'out', 'accessories', `${id}.webp`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      let n = 0; for (let p = 0; p < d.length; p += 4) n += d[p + 3] > 128 && 0.3 * d[p] + 0.59 * d[p + 1] + 0.11 * d[p + 2] < 60; return n;
    };
    const hat = await darkOf('conical'), other = await darkOf('sunhat');
    assert.ok(hat < other * 0.5, `${hat} dark pixels left, of ${other}`);
    // nothing of it below its brim any more (its picture keeps its size: where it sits on her is measured on all of it)
    const below = async (id) => {
      const { data: d, info } = await sharp(join(dir, 'out', 'accessories', `${id}.webp`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      let most = 0;
      for (let y = Math.ceil(info.height * 0.8); y < info.height; y++) for (let x = 0; x < info.width; x++) most = Math.max(most, d[(y * info.width + x) * 4 + 3]);
      return [most, info.height / info.width];
    };
    const [hatBelow, hatTall] = await below('conical'), [otherBelow, otherTall] = await below('sunhat');
    assert.ok(hatBelow < 8 && otherBelow === 255, `below its brim: ${hatBelow} (another hat's painting: ${otherBelow})`);
    assert.ok(Math.abs(hatTall - otherTall) < 0.01, 'its size as before');
  } finally { rmSync(dir, { recursive: true, force: true }); }
  // the painting on her set: no band or straps left in it (it had 11,043 such pixels)
  const file = fileURLToPath(new URL('../tools/live/page/art/accessories/conical.webp', import.meta.url));
  if (existsSync(file)) {
    const { data: d, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const n = dropStraps(Uint8Array.from(d), info.width, info.height);
    assert.ok(n < 300, `${n} pixels of it still thick and dark`);
    // one piece: no bit of a strap left floating below it
    const seen = new Uint8Array(info.width * info.height), parts = [];
    for (let p = 0; p < seen.length; p++) {
      if (seen[p] || d[p * 4 + 3] < 128) continue;
      let size = 0; const stack = [p]; seen[p] = 1;
      while (stack.length) {
        const q = stack.pop(), x = q % info.width, y = (q - x) / info.width; size++;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy, r = ny * info.width + nx;
          if (nx >= 0 && ny >= 0 && nx < info.width && ny < info.height && !seen[r] && d[r * 4 + 3] >= 128) { seen[r] = 1; stack.push(r); }
        }
      }
      if (size >= 4) parts.push(size);
    }
    assert.equal(parts.length, 1, `its parts: ${parts.join(', ')}`);
    // and where it's split (PAINT_SPLIT: its lip, a curve across it): above it all hat (its cone and brim, in front of
    // her hair), below it its underside (behind her face and hair)
    const { PAINT_SPLIT } = await import('../tools/live/page/outfits.js');
    const [l0, l1] = PAINT_SPLIT.conical.lip;
    assert.ok(l0 > 0.3 && l0 + l1 * 0.25 < 0.95, 'its lip inside the picture');
    for (let x = 0.15; x <= 0.85; x += 0.05) {
      const lip = l0 + l1 * (x - 0.5) ** 2, X = Math.round(x * (info.width - 1));
      for (const dy of [0.04, 0.08]) assert.ok(d[(Math.round((lip - dy) * info.height) * info.width + X) * 4 + 3] > 200, `above its lip at ${x.toFixed(2)}: its brim`);
    }
  }
  // on her: the underside behind her face and hair, the cone in front (outfits.js), never the conical hat floating above
  // her head: its brim by her eyebrows
  const outfitsJs = read('tools/live/page/outfits.js');
  assert.match(outfitsJs, /const split = PAINT_SPLIT\[pid\];/);
  assert.match(outfitsJs, /userData\.order = 'underFace'/);
  assert.match(outfitsJs, /it\.userData\.split \? it\.userData\.order : at0\.order \|\| it\.userData\.order/);
  const { PAINT_AT } = await import('../tools/live/page/outfits.js');
  assert.equal(PAINT_AT.conical.from, 'brow');
  assert.ok(PAINT_AT.conical.y > 0 && PAINT_AT.conical.y < 0.4 && PAINT_AT.conical.w > 1.5, JSON.stringify(PAINT_AT.conical));
});

test('(2026-10-08) her glasses\' lenses clear (asked for clear, painted milky over the green: on her they hid her eyes): inside the line round each lens, a faint tint and its glints kept; its frame as painted; a lens that isn\'t closed left alone', async () => {
  const { clearLenses, CLEAR_LENSES, keyOut, opaqueBox, cropRaw } = await import('../tools/live/art-cut.mjs');
  assert.deepEqual(Object.keys(CLEAR_LENSES), ['glasses'], 'only her clear glasses (her sunglasses stay dark)');
  // round glasses painted like Google's: a pale frame between two dark lines, the lens a pale green-white inside, a glint
  const W = 520, H = 260;
  const lens = (cx, gap) => `<circle cx="${cx}" cy="140" r="96" fill="#b6f5b7" stroke="#d8f0dc" stroke-width="22"/>
    <circle cx="${cx}" cy="140" r="107" fill="none" stroke="#141414" stroke-width="3"/>
    <circle cx="${cx}" cy="140" r="85" fill="none" stroke="#141414" stroke-width="3"${gap ? ' stroke-dasharray="480 40"' : ''}/>
    <path d="M${cx - 60} 110 Q${cx - 40} 80 ${cx - 10} 72" fill="none" stroke="#ffffff" stroke-width="9"/>`;
  const svg = (gap) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#15f135"/>
    ${lens(140, false)}${lens(380, gap)}<rect x="236" y="120" width="48" height="12" fill="#d8f0dc" stroke="#141414" stroke-width="2"/></svg>`;
  const cut = async (s) => {
    const { data } = await sharp(Buffer.from(s)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const keyed = keyOut(data, W, H, { seeThrough: 0.45 });
    const box = opaqueBox(keyed, W, H), own = cropRaw(keyed, W, box);
    const A = (x, y) => own[((y - box.top) * box.width + (x - box.left)) * 4 + 3];
    return { own, box, A };
  };
  const a = await cut(svg(false));
  assert.equal(a.A(140, 170), 255, 'its lens solid, before');
  const sizes = clearLenses(a.own, a.box.width, a.box.height, CLEAR_LENSES.glasses);
  assert.equal(sizes.length, 2, 'both lenses');
  for (const x of [140, 380]) {
    assert.ok(a.A(x, 170) < 30 && a.A(x + 40, 150) < 30, `${x}: clear (${a.A(x, 170)})`);
    assert.ok(a.A(x - 37, 86) > 100, `${x}: its glint kept (${a.A(x - 37, 86)})`);
    assert.equal(a.A(x, 140 - 96), 255, `${x}: its frame as painted`);
    assert.equal(a.A(x + 96, 140), 255, `${x}: its frame as painted`);
  }
  assert.equal(a.A(260, 126), 255, 'the bridge as painted');
  // a lens with a gap in its line: its fill runs into the frame and out: left as it is (the other one made clear)
  const b = await cut(svg(true));
  assert.equal(clearLenses(b.own, b.box.width, b.box.height, CLEAR_LENSES.glasses).length, 1);
  assert.equal(b.A(380, 170), 255, 'not closed: as painted');
  assert.ok(b.A(140, 170) < 30);
  // the painting on her set: its lenses clear, its frame there
  const file = fileURLToPath(new URL('../tools/live/page/art/accessories/glasses.webp', import.meta.url));
  const { data: d, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const at = (fx, fy) => d[(Math.round(fy * (info.height - 1)) * info.width + Math.round(fx * (info.width - 1))) * 4 + 3];
  for (const fx of [0.24, 0.76]) assert.ok(at(fx, 0.6) < 40, `its lens at ${fx}: ${at(fx, 0.6)}`);
  let solid = 0;
  for (let p = 3; p < d.length; p += 4) solid += d[p] > 200;
  assert.ok(solid > info.width * info.height * 0.12, `its frame and temples: ${solid} solid pixels`);
});

test('(2026-10-08) a stand-in until its own painting is there: a painting asked for in the same words but another color, its colors turned (only its reds for the hibiscus); its own painting wins once it\'s there', async () => {
  const { turnHue, cutAll, STAND_INS } = await import('../tools/live/art-cut.mjs');
  const hueOf = ([r, g, b]) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn || 1; const h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return h * 60; };
  const lum = ([r, g, b]) => (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
  // golden yellow → mint; red → pink with only its reds turned (a green leaf stays green); greys and black as they are
  const px = new Uint8Array([240, 200, 90, 255, 230, 70, 60, 255, 90, 170, 80, 255, 128, 128, 128, 255, 20, 18, 22, 255]);
  const before = [0, 1, 2, 3, 4].map((i) => Array.from(px.subarray(i * 4, i * 4 + 3)));
  const all = px.slice(); turnHue(all, 5, 1, STAND_INS['clips-mint'].hue);
  const mint = Array.from(all.subarray(0, 3));
  assert.ok(hueOf(mint) > 150 && hueOf(mint) < 185 && Math.abs(lum(mint) - lum(before[0])) < 3, `mint: ${mint}`);
  assert.deepEqual(Array.from(all.subarray(12, 20)), [128, 128, 128, 255, 20, 18, 22, 255], 'grey and black as they are');
  const reds = px.slice(); turnHue(reds, 5, 1, STAND_INS['flower-pink'].hue, { reds: STAND_INS['flower-pink'].reds });
  const pink = Array.from(reds.subarray(4, 7));
  assert.ok(hueOf(pink) > 315 && hueOf(pink) < 345, `pink: ${pink} (${hueOf(pink).toFixed(0)}°)`);
  assert.deepEqual(Array.from(reds.subarray(8, 11)), before[2], 'its leaf stays green');
  // the stand-ins are what art.mjs asks for in the same words, another color
  const words = Object.fromEntries(artList().filter((x) => x.group === 'accessories').map((x) => [x.id, x.prompt]));
  for (const [id, si] of Object.entries(STAND_INS)) {
    assert.ok(words[id] && words[si.from], `${id} from ${si.from}`);
    const strip = (s) => s.replace(/mint-green|golden-yellow|light blue and white patterned|light red and white striped silk|pink|red/g, '').replace(/tied loosely around a neck with a small knot at the side|draped around a neck/, '…');
    assert.equal(strip(words[id]), strip(words[si.from]), `${id}: the same thing as ${si.from}`);
  }
  // cutAll: no painting of its own → the stand-in, under its own name; its own painting there → that one
  const dir = mkdtempSync(join(tmpdir(), 'agi1-standin-'));
  try {
    const src = join(dir, 'art', 'accessories');
    mkdirSync(src, { recursive: true });
    const star = (fill) => sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="100%" height="100%" fill="#00ff00"/><polygon points="150,20 175,90 250,90 190,130 210,190 150,150 90,190 110,130 50,90 125,90" fill="${fill}" stroke="#4a3010" stroke-width="5"/></svg>`)).webp({ lossless: true }).toBuffer();
    writeFileSync(join(src, 'clips-honey-1.webp'), await star('#f2c84b'));
    const out = join(dir, 'out'), quiet = { log() {} };
    const r = await cutAll(join(dir, 'art'), { only: ['clips-mint', 'clips-honey'], picks: {}, out, log: quiet });
    assert.deepEqual(r.done.map((d) => [d.id, d.standIn]).sort(), [['clips-honey', null], ['clips-mint', 'clips-honey']]);
    const middle = async (id) => { const { data, info } = await sharp(readFileSync(join(out, 'accessories', `${id}.webp`))).raw().toBuffer({ resolveWithObject: true }); const o = (Math.round(info.height / 2) * info.width + Math.round(info.width / 2)) * info.channels; return Array.from(data.subarray(o, o + 3)); };
    const m1 = await middle('clips-mint');
    assert.ok(hueOf(m1) > 150 && hueOf(m1) < 185, `the stand-in is mint: ${m1}`);
    // its own painting arrives: used instead
    writeFileSync(join(src, 'clips-mint-1.webp'), await star('#ff4da6'));
    const r2 = await cutAll(join(dir, 'art'), { only: ['clips-mint'], picks: {}, out, log: quiet });
    assert.equal(r2.done[0].standIn, null);
    const m2 = await middle('clips-mint');
    assert.ok(hueOf(m2) > 315, `its own (pink here): ${m2}`);
    // nothing to make it from: drawn in code, as before
    const r3 = await cutAll(join(dir, 'art'), { only: ['beanie-yellow', 'scarf-istanbul'], picks: {}, out, log: quiet });
    assert.deepEqual(r3.missing.sort(), ['accessories/beanie-yellow-1', 'accessories/scarf-istanbul-1']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a backdrop\'s light panel undone (2026-10-07: asked to keep her side calm, the models now and then painted a see-through white panel there), and a backdrop mirrored', async () => {
  const { unPanel, cutOne } = await import('../tools/live/art-cut.mjs');
  // a painting-like picture: soft colors that change across it, a few hard shapes, and JPEG's own noise
  const W = 1376, H = 768;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs><linearGradient id="s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7fb9e8"/><stop offset="0.6" stop-color="#f3c6d9"/><stop offset="1" stop-color="#5aa05a"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#s)"/>
    <path d="M60 520 L300 180 L540 520 Z" fill="#c9a77a" stroke="#6b4f2a" stroke-width="6"/>
    ${Array.from({ length: 14 }, (_, i) => `<circle cx="${100 + i * 95}" cy="${560 + (i % 3) * 40}" r="${30 + (i % 4) * 9}" fill="#3f8f4a" stroke="#24502b" stroke-width="3"/>`).join('')}
    <ellipse cx="1100" cy="160" rx="160" ry="50" fill="#fff8ee"/></svg>`;
  const orig = await sharp(Buffer.from(svg)).jpeg({ quality: 92 }).toBuffer();
  const { data: o } = await sharp(orig).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  // the panel: 948..1321 washed 37% toward a warm white, as the models paint it
  const panelled = Buffer.from(o);
  for (let y = 0; y < H; y++) for (let x = 948; x < 1321; x++) for (let c = 0; c < 3; c++) {
    const i = (y * W + x) * 3 + c;
    panelled[i] = Math.round(panelled[i] * 0.63 + [251, 252, 249][c] * 0.37);
  }
  const jpg = await sharp(panelled, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 92 }).toBuffer();
  const { data: p, info } = await sharp(jpg).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const r = unPanel(p, info.width, info.height, info.channels, 950, 1319);       // said a little off: found exactly
  assert.deepEqual([r.x0, r.x1], [948, 1321]);
  assert.ok(r.alpha.every((a) => Math.abs(a - 0.37) < 0.03), `how washed it was: ${r.alpha}`);
  const diff = (x0, x1) => { let s = 0, n = 0; for (let y = 0; y < H; y++) for (let x = x0; x < x1; x++) for (let c = 0; c < 3; c++) { s += Math.abs(p[(y * W + x) * 3 + c] - o[(y * W + x) * 3 + c]); n++; } return s / n; };
  assert.ok(diff(960, 1310) < 3, `inside the panel: ${diff(960, 1310).toFixed(2)} levels from the painting`);
  assert.ok(diff(940, 956) < 4 && diff(1313, 1329) < 4, `its edges: ${diff(940, 956).toFixed(2)}, ${diff(1313, 1329).toFixed(2)}`);
  assert.ok(diff(0, 900) < 1, 'nothing else changed');
  // up to the picture's right edge (one edge to measure from)
  const p2 = Buffer.from(o);
  for (let y = 0; y < H; y++) for (let x = 868; x < W; x++) for (let c = 0; c < 3; c++) { const i = (y * W + x) * 3 + c; p2[i] = Math.round(p2[i] * 0.76 + 252 * 0.24); }
  const r2 = unPanel(p2, W, H, 3, 868, W);
  assert.equal(r2.x1, W);
  assert.ok(r2.alpha.every((a) => Math.abs(a - 0.24) < 0.03), `${r2.alpha}`);
  // a picture without a panel there is refused, never made darker
  assert.throws(() => unPanel(Buffer.from(o), W, H, 3, 948, 1321), /no light panel/);
  // cutOne: the panel undone, then mirrored, at the set's size
  const dir = mkdtempSync(join(tmpdir(), 'agi1-panel-'));
  try {
    writeFileSync(join(dir, 'rio-2.jpg'), jpg);
    const out = join(dir, 'out');
    const made = await cutOne(sharp, join(dir, 'rio-2.jpg'), { group: 'places', id: 'rio' }, { out, panel: [948, 1321], flip: true });
    assert.deepEqual([made.width, made.height, made.undone.x0, made.undone.x1], [1280, 720, 948, 1321]);
    const { data: m } = await sharp(join(out, 'places', 'rio.webp')).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    // the pyramid (the left of the painting) is now on the right
    const at = (x, y) => Array.from(m.subarray((y * 1280 + x) * 3, (y * 1280 + x) * 3 + 3));
    const tan = (px) => px[0] > 170 && px[0] < 230 && px[1] > 140 && px[1] < 190 && px[2] < 150;
    assert.ok(tan(at(1280 - Math.round(300 * 1280 / W), Math.round(400 * 720 / H))), `mirrored: ${at(1280 - Math.round(300 * 1280 / W), Math.round(400 * 720 / H))}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a person cut out of green: her own 2D picture put on green comes back the same (edges and hair strands)', async () => {
  const { keyOut } = await import('../tools/live/art-cut.mjs');
  const { data: orig, info } = await sharp(readFileSync(new URL(`../${STYLE_REF}`, import.meta.url))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height, n = w * h, comp = Buffer.alloc(n * 4);
  for (let p = 0; p < n; p++) {
    const a = orig[p * 4 + 3] / 255;
    comp[p * 4] = Math.round(orig[p * 4] * a); comp[p * 4 + 1] = Math.round(orig[p * 4 + 1] * a + 255 * (1 - a)); comp[p * 4 + 2] = Math.round(orig[p * 4 + 2] * a); comp[p * 4 + 3] = 255;
  }
  const out = keyOut(comp, w, h);
  let err = 0, off = 0, edge = 0;
  for (let p = 0; p < n; p++) {
    const a0 = orig[p * 4 + 3], a1 = out[p * 4 + 3];
    if (a0 === 255 && a1 === 255) continue;
    if (a0 === 0 && a1 === 0) continue;
    edge += 1;
    // over white, what it looks like against what it should
    for (let c = 0; c < 3; c++) err += Math.abs((orig[p * 4 + c] * a0 + 255 * (255 - a0)) / 255 - (out[p * 4 + c] * a1 + 255 * (255 - a1)) / 255) / 3;
    if (Math.abs(a0 - a1) > 64) off += 1;
  }
  assert.ok(err / edge < 6, `its edges over white: ${(err / edge).toFixed(2)} off on average`);
  assert.ok(off < 30, `${off} pixels much more or less see-through than they should be`);
});

test('her headset on her ears (2026-10-08, the owner: "headset not even on her ears": its cup was beside her eye): its painting fitted to her head, its band stretched where its sides are straight, its cups on her ears, its band on her hair, its mic turned up to her mouth', async () => {
  const { PAINT_AT, PAINT_FIT, fitRow } = await import('../tools/live/page/outfits.js');
  const fit = PAINT_FIT.headset, at = PAINT_AT.headset;
  // the stretch: smooth (no row skipped or squeezed, as painted at both ends), `add` rows more in all, most in the middle
  const [a, b] = fit.rows;
  assert.equal(fitRow(a, fit), a);
  assert.equal(fitRow(b, fit), b + fit.add);
  assert.equal(fitRow(b + 40, fit), b + 40 + fit.add);
  let last = fitRow(a, fit), most = 0;
  for (let y = a + 1; y <= b; y++) { const d = fitRow(y, fit) - last; assert.ok(d >= 1 - 1e-9, `row ${y}: ${d}`); most = Math.max(most, d); last = fitRow(y, fit); }
  assert.ok(fitRow(a + 1, fit) - a < 1.01 && b + fit.add - fitRow(b - 1, fit) < 1.01, 'as painted where it starts and ends');
  assert.ok(most > 2 && most < 2.6, `most in the middle: ${most}`);
  // where its parts are in the painting (its alpha)
  const { data, info } = await sharp(readFileSync(new URL('../tools/live/page/art/accessories/headset.webp', import.meta.url))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, A = (x, y) => data[(y * W + x) * 4 + 3];
  const box = (x0, x1, y0, y1) => { let q = [1e9, 1e9, -1, -1]; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (A(x, y) > 128) q = [Math.min(q[0], x), Math.min(q[1], y), Math.max(q[2], x), Math.max(q[3], y)]; return q; };
  const mid = (q) => [(q[0] + q[2]) / 2, (q[1] + q[3]) / 2];
  const cup = mid(box(0, 110, 255, 374)), pad = mid(box(365, W, 280, 355)), mic = mid(box(195, 270, 455, H)), top = box(0, W, 0, 40)[1];
  // the part that swings is its mic's boom only: nothing of its cup on the line where it's cut, its cup over above it
  const s = fit.swing;
  for (let y = s.side[0]; y < s.cut; y++) assert.ok(A(s.side[1], y) < 40, `row ${y}: its boom apart from its cup at x ${s.side[1]}`);
  for (let y = s.cut; y < s.cut + 6; y++) for (let x = s.side[1] + 10; x < 110; x++) assert.ok(A(x, y) < 40, `row ${y}: only its boom under its cup (x ${x})`);
  assert.ok(box(0, W, s.cut - 12, s.cut)[2] > s.side[1] + 20, 'its cup goes down to where it\'s cut');
  // where they land on her (her face's widths from the middle of her eyes, y up), measured on her model (2026-10-08): her
  // ears' middles 0.45 out and 0.1 below her eyes (her right ear x −0.57..−0.31, y −0.27..0.09; her left x 0.33..0.57),
  // the top of her hair 1.06 above them, her mouth 0.32 below them (x −0.13..0.14, y −0.36..−0.29)
  const H2 = H + fit.add, w = at.w, h = (w * H2) / W;
  const px = (x) => (at.x || 0) + (x / W - 0.5) * w, py = (y) => at.y + ((H2 - fitRow(y, fit)) / H2) * h;
  const [cx, cy] = [px(cup[0]), py(cup[1])], [qx, qy] = [px(pad[0]), py(pad[1])];
  assert.ok(cx > -0.57 && cx < -0.4 && cy > -0.2 && cy < 0, `its cup on her right ear: ${cx.toFixed(3)}, ${cy.toFixed(3)}`);
  assert.ok(qx > 0.38 && qx < 0.57 && qy > -0.2 && qy < 0, `its other end on her left ear: ${qx.toFixed(3)}, ${qy.toFixed(3)}`);
  assert.ok(py(top) > 0.98 && py(top) < 1.1, `its band on top of her hair: ${py(top).toFixed(3)}`);
  const pv = [px(s.pivot[0]), py(s.pivot[1])], d = [px(mic[0]) - pv[0], py(mic[1]) - pv[1]], r = (s.deg * Math.PI) / 180;
  const mx = pv[0] + d[0] * Math.cos(r) - d[1] * Math.sin(r), my = pv[1] + d[0] * Math.sin(r) + d[1] * Math.cos(r);
  assert.ok(mx > -0.13 && mx < 0.14 && my > -0.45 && my < -0.32, `its mic at her mouth: ${mx.toFixed(3)}, ${my.toFixed(3)}`);
  assert.ok(py(mic[1]) < -0.5, 'without the turn, it would be at her chin');
  // drawn over her hair, under a hand by her face (her laugh's hand over her mouth went under its boom)
  assert.equal(at.order, 'mic');
  const js = read('tools/live/page/outfits.js');
  assert.match(js, /mic: Math\.max\(meshes\[P\.hairL\]\.renderOrder, meshes\[P\.hairR\]\.renderOrder, meshes\[P\.sideL\]\.renderOrder, meshes\[P\.sideR\]\.renderOrder\) \+ 0\.1e-4,/);
  assert.match(js, /m\.renderOrder = top \+ \(side === 'R' \? 0\.2e-4 : 0\.6e-4\)/, 'a hand by her face over it');
});

test('her headphones on her head (2026-10-08, the owner: "and i just noticed this headset is too big for her right": 2.25 of her face\'s width, their band floated over her hair and their cups stuck out past her head): smaller, their band on top of her hair, their cups at the sides of her head by her ears, the inside of each cup outside her face however she turns her head; drawn over her hair', async () => {
  const { PAINT_AT, PAINT_FIT, fitRow, fitCol } = await import('../tools/live/page/outfits.js');
  const at = PAINT_AT.headphones;
  assert.equal(at.from, 'ears');
  assert.equal(at.order, 'mic');
  assert.ok(!at.sy, 'as painted, never squashed');
  // the stretch of its columns is its rows' (smooth, as painted at both ends, `addX` more in all)
  for (const fit of [PAINT_FIT['headphones-midnight'], PAINT_FIT['headphones-gamer']]) {
    const [a, b] = fit.cols;
    assert.equal(fitCol(a, fit), a);
    assert.equal(fitCol(b, fit), b + fit.addX);
    for (let x = a + 1; x <= b; x++) assert.ok(fitCol(x, fit) - fitCol(x - 1, fit) >= 1 - 1e-9, `column ${x}`);
  }
  assert.equal(fitCol(100, PAINT_FIT.headset), 100, 'the headset: its columns as painted');
  // her head, measured on her model with Live2D's runtime (2026-10-08, her face's widths from the middle between her ears,
  // y up): her face's outline at each height (where its mesh's edges cross it), the widest on each side however she turns
  // her head (20° to either side, 15° up or down); her ears' middles 0.43 to 0.44 out; the top of her hair 1.15 above
  // (her eyes 0.1 above her ears' middle, the top of her hair 1.05 above her eyes, measured on her set)
  const FACE = [
    [-0.42, -0.217, 0.25], [-0.4, -0.231, 0.258], [-0.38, -0.246, 0.265], [-0.36, -0.26, 0.274], [-0.34, -0.274, 0.29], [-0.32, -0.288, 0.306],
    [-0.3, -0.302, 0.322], [-0.28, -0.316, 0.338], [-0.26, -0.331, 0.354], [-0.24, -0.342, 0.37], [-0.22, -0.352, 0.386], [-0.2, -0.363, 0.397],
    [-0.18, -0.373, 0.405], [-0.16, -0.384, 0.414], [-0.14, -0.395, 0.422], [-0.12, -0.405, 0.43], [-0.1, -0.416, 0.439], [-0.08, -0.427, 0.447],
    [-0.06, -0.438, 0.456], [-0.04, -0.449, 0.462], [-0.02, -0.46, 0.468], [0, -0.471, 0.474], [0.02, -0.475, 0.48], [0.04, -0.478, 0.485],
    [0.06, -0.48, 0.491], [0.08, -0.483, 0.497], [0.1, -0.493, 0.5], [0.12, -0.503, 0.501], [0.14, -0.514, 0.501], [0.16, -0.52, 0.502],
    [0.18, -0.517, 0.504], [0.2, -0.514, 0.505], [0.22, -0.511, 0.506], [0.24, -0.507, 0.501], [0.26, -0.502, 0.492], [0.28, -0.497, 0.483],
    [0.3, -0.493, 0.474], [0.32, -0.482, 0.466], [0.34, -0.467, 0.457], [0.36, -0.451, 0.448], [0.38, -0.436, 0.439], [0.4, -0.424, 0.429],
    [0.42, -0.415, 0.42],
  ];
  const outline = (Y) => {
    let k = 0;
    while (k < FACE.length - 2 && FACE[k + 1][0] < Y) k++;
    const [a, b] = [FACE[k], FACE[k + 1]], u = Math.max(0, Math.min(1, (Y - a[0]) / (b[0] - a[0])));
    return [a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
  };
  for (const pid of ['headphones-midnight', 'headphones-gamer']) {
    const fit = PAINT_FIT[pid];
    const { data, info } = await sharp(readFileSync(new URL(`../tools/live/page/art/accessories/${pid}.webp`, import.meta.url))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const W = info.width, H = info.height, W2 = W + fit.addX, H2 = H + fit.add, A = (x, y) => data[(y * W + x) * 4 + 3];
    const w = at.w, h = (w * H2) / W2;
    const px = (x) => (at.x || 0) + (fitCol(x, fit) / W2 - 0.5) * w, py = (y) => at.y + ((H2 - fitRow(y, fit)) / H2) * h;
    // its cups (below its band's sides): the inside of each one outside her face, all the way down
    const cupRows = [];
    for (let y = 285; y < H; y++) {
      let l = -1, r = W;
      for (let x = 0; x < W / 2; x++) if (A(x, y) > 128) l = x;
      for (let x = W - 1; x >= W / 2; x--) if (A(x, y) > 128) r = x;
      if (l < 0 || r >= W) continue;
      cupRows.push(y);
      const Y = py(y), [f0, f1] = outline(Y);
      if (Y > 0.42 || Y < -0.42) continue;
      assert.ok(px(l) < f0 - 0.008, `${pid} row ${y}: its left cup's inside at ${px(l).toFixed(3)}, her face to ${f0.toFixed(3)}`);
      assert.ok(px(r) > f1 + 0.008, `${pid} row ${y}: its right cup's inside at ${px(r).toFixed(3)}, her face to ${f1.toFixed(3)}`);
    }
    // their middles at her ears' height, their outsides past her ears, not far past them
    const mid = py((cupRows[0] + cupRows.at(-1)) / 2);
    assert.ok(Math.abs(mid) < 0.06, `${pid}: its cups' middle ${mid.toFixed(3)} from her ears' height`);
    let out = W;
    for (let y = 300; y < 480; y++) for (let x = 0; x < W / 2; x++) if (A(x, y) > 128) { out = Math.min(out, x); break; }
    assert.ok(px(out) < -0.6 && px(out) > -0.85, `${pid}: its cups' outsides ${px(out).toFixed(3)} (her ears to 0.44)`);
    // smaller than before: its cups 0.72 of her face's width tall at most (they were 0.77, squashed, and 1.1 out)
    const tall = py(cupRows[0]) - py(cupRows.at(-1));
    assert.ok(tall < 0.72 && tall > 0.55, `${pid}: its cups ${tall.toFixed(3)} tall`);
    // its band on top of her hair: its inside at the top 1.10 to 1.17 above her ears' middle (her hair's top 1.15)
    let inner = -1;
    for (let y = 0, seen = false; y < H; y++) { const on = A(Math.round(W / 2), y) > 128; if (on) seen = true; else if (seen) { inner = y; break; } }
    assert.ok(py(inner) > 1.1 && py(inner) < 1.17, `${pid}: its band's inside at the top ${py(inner).toFixed(3)} above her ears' middle`);
  }
  // on her: from the middle between her ears, turning with her head
  const js = read('tools/live/page/outfits.js');
  assert.match(js, /else if \(at0\.from === 'ears'\) \{/);
  assert.match(js, /const mx = \(earR\.cx \+ earL\.cx\) \/ 2, my = \(earR\.cy \+ earL\.cy\) \/ 2, ox = fw \* \(at0\.x \|\| 0\), oy = fw \* at0\.y \+ h \/ 2;/);
  assert.match(js, /x = mx \+ ox \* cos - oy \* sin; y = my \+ ox \* sin \+ oy \* cos;/);
});

test('her set finds the paintings (paint.js), and each one has its place: the outfits\' accessories as art.mjs paints them, painted people, rooms, places and rides; drawn in code where there\'s none', async () => {
  const src = read('tools/live/page/paint.js');
  assert.match(src, /try \{ FILES = import\.meta\.glob\('\.\/art\/\*\/\*\.webp', \{ eager: true, query: '\?url', import: 'default' \}\); \} catch \{ FILES = \{\}; \}/);
  const paint = await import('../tools/live/page/paint.js');
  assert.deepEqual(paint.GROUPS, ['places', 'rooms', 'rides', 'people', 'accessories']);
  assert.equal(paint.isPainted('places', 'paris'), false, 'none in Node');
  // every outfit accessory's painting, as art.mjs paints them, each used
  const { PAINTED_ACC, OUTFITS, PAINT_AT } = await import('../tools/live/page/outfits.js');
  const accIds = artList().filter((x) => x.group === 'accessories').map((x) => x.id).sort();
  const used = new Set();
  for (const [outfit, map] of Object.entries(PAINTED_ACC)) {
    assert.ok(OUTFITS[outfit], outfit);
    for (const [acc, pid] of Object.entries(map)) {
      assert.ok(OUTFITS[outfit].acc.includes(acc), `${outfit}: ${acc}`);
      assert.ok(accIds.includes(pid), `${outfit}: ${pid} is painted by art.mjs`);
      used.add(pid);
    }
  }
  for (const [outfit, o] of Object.entries(OUTFITS)) for (const acc of o.acc) assert.ok(PAINTED_ACC[outfit]?.[acc], `${outfit}'s ${acc}: a painting for it`);
  assert.deepEqual([...used].sort(), accIds, 'every painted accessory has an outfit');
  for (const k of ['hat', 'cap', 'beret', 'sunhat', 'conical', 'beanie', 'bucket', 'catEars', 'headphones', 'headset', 'glasses', 'bow', 'clips', 'flower', 'sakura', 'neck', 'garland', 'helmet']) {
    assert.ok(PAINT_AT[k] && PAINT_AT[k].w > 0 && ['top', 'brow', 'eyes', 'ear', 'ears', 'neck'].includes(PAINT_AT[k].from), k);
  }
  // (2026-10-08) a hat or a headband sits by its bottom edge above her eyes (`brow`: from her eyes, as her head is drawn;
  // the first guesses, from the top of her hair's mesh, put every hat above her head); an accessory's own place only
  // changes what it says; her headphones from the middle between her ears (`ears`: the sides of her head), over her hair
  for (const k of ['hat', 'cap', 'beret', 'sunhat', 'conical', 'beanie', 'bucket', 'catEars', 'headset']) assert.equal(PAINT_AT[k].from, 'brow', k);
  assert.equal(PAINT_AT.headphones.from, 'ears');
  for (const [k, v] of Object.entries(PAINT_AT)) {
    if (!['hat', 'cap', 'beret', 'sunhat', 'conical', 'beanie', 'bucket', 'catEars', 'headphones', 'headset', 'glasses', 'bow', 'clips', 'flower', 'sakura', 'neck', 'garland', 'helmet'].includes(k)) assert.ok(accIds.includes(k), `${k}: an accessory's own`);
    if (v.order) assert.ok(['underFace', 'behindBangs', 'top', 'neck', 'mic'].includes(v.order), `${k}: ${v.order}`);
    if (v.sy) assert.ok(v.sy > 0.4 && v.sy <= 1, `${k}: sy ${v.sy}`);
  }
  assert.equal(PAINT_AT.headphones.order, 'mic');
  const outfitsJs = read('tools/live/page/outfits.js');
  assert.match(outfitsJs, /underFace: meshes\[P\.face\]\.renderOrder - 1e-4/);
  assert.match(outfitsJs, /else if \(at0\.from === 'brow'\) \[x, y\] = at\(eyesX \+ fw \* \(at0\.x \|\| 0\), eyesY \+ fw \* at0\.y \+ h \/ 2\);/);
  // her set: a painting goes up only once it's loaded (before a wipe), the code's drawing where there's none
  const js = read('tools/live/page/stage.js');
  assert.match(js, /async function painting\(group, id\) \{\s*const img = isPainted\(group, id\) \? await paintLoad\(group, id\) : null;/);
  for (const [fn, group] of [['roomDrawer', 'rooms'], ['placeDrawer', 'places'], ['rideDrawer', 'rides']]) {
    assert.match(js, new RegExp(`async function ${fn}\\([^)]*\\) \\{[\\s\\S]*?await painting\\('${group}'`), fn);
  }
  assert.match(js, /else \{ set\.dataset\.painted = 'off'; drawRoom\(r, ui\.bg\); fillAmbient\(r, ui\.amb\); \}/);
  assert.match(js, /const draw = await roomDrawer\(id\);\s*if \(instant \|\| !fx\) \{ draw\(\); return true; \}\s*fx\.wipe\(draw\);/);
  assert.match(js, /const ready = wardrobe\.prepare\(id\);/);
  // the people she meets: their painting loaded before they come in, else drawn
  const people = read('tools/live/page/people.js');
  assert.match(people, /const img = await ready\(id\);/);
  assert.match(people, /if \(cur\.painted\) \{[\s\S]*?pic\.style\.transform = [\s\S]*?\} else drawPerson\(/);
  // the ride's picture moves with the ride: its own layer only then
  assert.match(read('tools/live/page/stage.css'), /\n\.set\[data-ride\] \.set-bg \{ will-change: transform; transform-origin: 50% 55%; \}/);
  // (nothing here goes over her picture: the paintings are behind her, the people too, her accessories in her own drawing)
  const html = read('tools/live/page/index.html');
  assert.ok(html.indexOf('data-bg') < html.indexOf('data-pic') && html.indexOf('data-npc') < html.indexOf('data-pic'));
});

test('the picks and the paintings in her set: only pictures art.mjs makes, at their size, small enough for git', async () => {
  const { PICKS_FILE, OUT, SIZE, pickOf } = await import('../tools/live/art-cut.mjs');
  const ids = new Set(artList().map((x) => `${x.group}/${x.id}`));
  if (existsSync(PICKS_FILE)) {
    const picks = JSON.parse(readFileSync(PICKS_FILE, 'utf8'));
    for (const [k, v] of Object.entries(picks)) {
      assert.ok(ids.has(k), `${k}: one of art.mjs's pictures`);
      const p = pickOf(v);
      assert.ok(p.k >= 0 && p.k <= 9, `${k}: ${JSON.stringify(v)}`);
      // mirrored or with a light panel undone: only a backdrop (a person or a hat keeps its own left and right)
      if (p.flip || p.panel || p.crop) assert.ok(/^(places|rooms|rides)\//.test(k), `${k}: only a backdrop`);
      if (p.panel) assert.ok(p.panel[0] >= 0 && p.panel[1] > p.panel[0] + 16 && p.panel[1] <= 4096, `${k}: ${p.panel}`);
      if (p.crop) assert.ok(p.crop.every((x) => x >= 0) && Math.abs(p.crop[2] / p.crop[3] - 16 / 9) < 0.02 && p.crop[2] >= 640, `${k}: ${p.crop}`);
    }
  }
  assert.deepEqual(pickOf(2), { k: 2, flip: false, panel: null, crop: null });
  assert.deepEqual(pickOf({ k: 1, flip: true }), { k: 1, flip: true, panel: null, crop: null });
  assert.deepEqual(pickOf({ k: 1, panel: [900, 1320] }), { k: 1, flip: false, panel: [900, 1320], crop: null });
  assert.deepEqual(pickOf({ k: 1, crop: [0, 115, 957, 538] }), { k: 1, flip: false, panel: null, crop: [0, 115, 957, 538] });
  assert.throws(() => pickOf('2'));
  assert.throws(() => pickOf({ flip: true }));
  if (!existsSync(OUT)) return;
  let total = 0;
  for (const group of readdirSync(OUT)) {
    for (const f of readdirSync(join(OUT, group))) {
      assert.match(f, /^[a-z0-9-]+\.webp$/, `${group}/${f}`);
      assert.ok(ids.has(`${group}/${f.slice(0, -5)}`), `${group}/${f}: one of art.mjs's pictures`);
      const buf = readFileSync(join(OUT, group, f));
      total += buf.length;
      const m = await sharp(buf).metadata();
      if (['places', 'rooms', 'rides'].includes(group)) assert.deepEqual([m.width, m.height], [SIZE.backdrop.w, SIZE.backdrop.h], `${group}/${f}`);
      else {
        assert.ok(m.hasAlpha, `${group}/${f}: cut out`);
        assert.ok(Math.max(m.width, m.height) <= (group === 'people' ? SIZE.people * 1.2 : SIZE.accessories), `${group}/${f}: small`);
      }
      assert.ok(buf.length < 400 * 1024, `${group}/${f}: ${Math.round(buf.length / 1024)} KB`);
    }
  }
  assert.ok(total < 12 * 1024 * 1024, `all of them: ${(total / 1048576).toFixed(1)} MB`);
});

test('her clothes\' colors (2026-10-07, "Her hat and outfit" among the worst): white, cream, navy and red become those colors, not grey, khaki or olive; her shading kept', async () => {
  const { tintMatrix, LAVENDER, OUTFITS } = await import('../tools/live/page/outfits.js');
  const apply = (m, c) => [0, 1, 2].map((r) => m[r * 3] * c[0] + m[r * 3 + 1] * c[1] + m[r * 3 + 2] * c[2]);
  const shade = LAVENDER.map((x) => x * 0.82);
  const hueOf = ([r, g, b]) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn || 1; const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (h * 60 + 360) % 360; };
  const sat = (c) => (Math.max(...c) - Math.min(...c)) / Math.max(...c);
  const tintOf = (outfit, part = 'shirt') => tintMatrix(OUTFITS[outfit][part]);
  // white (Paris, Dubai, space): light, barely tinted, a little under pure white so the white AGI on it still shows
  const white = apply(tintOf('dubai'), LAVENDER);
  assert.ok(Math.min(...white) > 220 && Math.max(...white) < 250 && sat(white) < 0.08, `white: ${white.map(Math.round)}`);
  // cream (cozy, the pyramids, Seoul): light and warm (red over blue)
  const cream = apply(tintOf('cairo'), LAVENDER);
  assert.ok(Math.min(...cream) > 195 && cream[0] > cream[2] + 25, `cream: ${cream.map(Math.round)}`);
  // navy (London): dark and blue
  const navy = apply(tintOf('london'), LAVENDER);
  assert.ok(Math.max(...navy) < 160 && navy[2] > navy[0] + 50 && navy[2] > navy[1] + 40, `navy: ${navy.map(Math.round)}`);
  // red (the Great Wall, Istanbul): red, saturated
  const red = apply(tintOf('beijing'), LAVENDER);
  assert.ok(red[0] > 200 && sat(red) > 0.6 && (hueOf(red) > 340 || hueOf(red) < 15), `red: ${red.map(Math.round)}`);
  // her shading kept: a darker lavender stays darker, the same way
  for (const o of ['dubai', 'cairo', 'london', 'beijing']) {
    const a = apply(tintOf(o), LAVENDER), b = apply(tintOf(o), shade);
    assert.ok(b.every((x, i) => x < a[i]), `${o}: shading`);
  }
  // as drawn: as drawn
  assert.deepEqual(tintMatrix(null), [1, 0, 0, 0, 1, 0, 0, 0, 1]);
});
