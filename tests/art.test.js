// The pictures of her live set, painted by Google's image AI (2026-10-07, the owner after a preview of her trips: "so bad",
// then "Painted art"): tools/live/art.mjs, run on the owner's server with the Google key her voice already uses. What each
// picture asks for (never a real person, text, a logo or anyone's artwork; the people and accessories on green, to be cut
// out), the request to Vertex AI, the picture in its answer, resuming a run, a model Google doesn't have, "wait", a
// refusal, and the runner's options. No network: Google is faked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
