// AGI Studio's launch video (2026-10-13, tools/studio-promo/: the owner's "go make a promotional marketing launch video of
// AGI studio. all the features there, do it with top notch motion design and easy to understand and visible make it 4:3
// video", then the same day "i just decided can you make the launch video 16:9": 1920 × 1080). Its words hold the site's
// rules (never an AI service's name, never "buy": credits are topped up, PG-13, only $AGI, "not financial advice"
// wherever money comes up, AI-generated said on every frame from the hook's reveal to the end card), its words and
// numbers are AGI Studio's own (imported from src/studio, and checked here against it), AGI-1 is never in 3D (its 3D
// model scene shows Juno's own 3D model, made for it, labeled "AI-generated"), and the picture and the music keep one
// clock.
// Since 2026-10-13 AGI-1's voice over its music (the owner: "will it be good if you add voice over to the launch video",
// then "Short, AGI-1's voice"): her lines, where they go, and the mix (voice.js), checked with stand-in takes and music.
// No browser here, and never its pictures, clips or her takes (tools/studio-promo/media: big, made once, never in git);
// ffmpeg only where it's there (the sound put on a video: its pictures copied). STUDIO_PROMO_RENDER=1 also renders the
// whole music (about 15 s), with stand-in takes over it.
// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { request } from 'node:http';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as W from '../tools/studio-promo/words.js';
import { SCENES, TOTAL, MOMENTS as M, BAR, BEAT, at, sceneAt, sceneOf, VOICE as PLACES } from '../tools/studio-promo/timeline.js';
import { musicPlan, renderMusic, RATE, SECTIONS, sectionAt, letterTimes, countTicks, BREATHS } from '../tools/studio-promo/music.js';
import { TRANSITIONS } from '../tools/studio-promo/page/cuts.js';
import { withoutSecrets, serve, args, COVER_AT, voiceLines, LEN_SLACK, soundOnly } from '../tools/studio-promo/make.mjs';
import * as V from '../tools/studio-promo/voice.js';
import {
  PRICES, TRENDS, STYLE_GROUPS, INF_STYLES, OPTIONS, VIDEO_MODELS, MEMES, BANNER, DISCOUNT, FREE_CREDITS, WAYS, MODES,
  EDITOR_FILTERS, VIDEO_EDITOR, LONG, STYLE_ANY, TOPUPS, MOVE_NAMES, REF_CODE, photoCredits, videoCredits, creditPrice,
  inviteLink,
} from '../src/studio/rules.js';
import { HOLDER_LINE, EDIT_IDEAS, LEVEL_NAMES } from '../src/studio/app-words.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
// its code, never its media (git-ignored) or its build
const files = (dir) => readdirSync(new URL(`../${dir}`, import.meta.url)).flatMap((f) => {
  const p = `${dir}/${f}`;
  if (f === 'dist' || f === 'media') return [];
  return statSync(new URL(`../${p}`, import.meta.url)).isDirectory() ? files(p) : [p];
});
const CODE = files('tools/studio-promo').filter((f) => /\.(m?js|html|css)$/.test(f));
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const words = W.allWords();
const all = [...words, W.POST];

// ---------- the site's rules ----------
test('its words: never an AI service by name, never "buy", PG-13, only $AGI, "investment" only as "not an investment"', () => {
  assert.ok(words.length > 300, 'every word on screen is listed');
  const AI = /\b(fal(\.ai)?|kling|seedance|nano ?banana|gemini|google|meshy|dreamina|higgsfield|genjutsu|bytedance|kuaishou|openai|chat ?gpt|sora|veo|runwayml|midjourney|stable diffusion|flux|pika|luma|hailuo|minimax|suno|eleven ?labs|capcut)\b/i;
  for (const w of all) {
    assert.doesNotMatch(w, AI, `never an AI service's name: "${w}"`);
    // $AGI only; "$TICKER" is a coin's own ticker, a placeholder (the coin is its maker's)
    for (const m of w.matchAll(/\$([A-Za-z][A-Za-z0-9]*)/g)) assert.ok(['AGI', 'TICKER'].includes(m[1]), `only $AGI: "${w}"`);
    assert.doesNotMatch(w, /\b(buy|buying|bought|sell|selling|hodl|moon\w*|pump\w*|profit\w*|gains?|lambo|100x|guarantee\w*|number go up|airdrop|cheap)\b/i, `never money talk: "${w}"`);
    assert.doesNotMatch(w, /\bsafe\b|\bscam\w*|\brug\w*/i, `never "safe", "scam" or "rug": "${w}"`);
    assert.doesNotMatch(w, /\b(babe|baby|cutie|honey|darling|sweetie)\b|sex|nude|naked|horny|lingerie|bikini|nsfw|onlyfans/i, `PG-13: "${w}"`);
    if (/invest/i.test(w)) assert.match(w, /not an investment/i, w);
    assert.doesNotMatch(w, /cloak ?mesh|inference\.agi1/i, w);
  }
  // credits are topped up, never bought
  assert.match(W.PAY.topup, /^Top up/);
  // what it shows was made for it, with the same kinds of AI models: never "made in AGI Studio"
  for (const w of all) assert.doesNotMatch(w, /made (in|with) AGI Studio/i, w);
  // and its code says no AI service's name anywhere a viewer could see it
  for (const f of CODE.filter((x) => x.includes('/page/') || x.endsWith('words.js'))) {
    assert.doesNotMatch(noComments(read(f)), AI, `${f}: no AI service's name in its code`);
  }
});

test('"not financial advice" wherever money comes up, 18+ where it applies, and AI-generated on every frame from the reveal on', () => {
  const nfa = /not financial advice/i;
  assert.match(W.MODEL.fine, nfa);
  assert.match(W.MODEL.fine, /18\+/);
  assert.match(W.MODEL.fine, /can go to zero/i);
  assert.match(W.MODEL.coinNote, /your own wallet/i);
  assert.match(W.PAY.holderFine, nfa);
  assert.match(W.PAY.holderFine, /not an investment/i);
  assert.match(W.PAY.fine, /no cash value/i);
  assert.match(W.PAY.fine, /gives its credits back/i);
  assert.match(W.END.fine[0], /18\+/);
  assert.match(W.END.fine[0], /AI-generated/);
  assert.match(W.END.fine[0], /PG-13/);
  assert.match(W.END.fine[1], nfa);
  assert.match(W.END.fine[1], /no cash value/i);
  assert.match(W.POST, nfa);
  assert.match(W.POST, /AI-generated/);
  assert.equal(W.HOOK.ai, 'AI-generated');
  // the corner note, from the hook's reveal to the end card (which says it in its own words)
  assert.equal(W.OVERLAY, 'Examples · AI-generated');
  const main = read('tools/studio-promo/page/main.js');
  assert.match(main, /prog\(t, M\.aiPill \+ 0\.2, M\.aiPill \+ 0\.7\)/);
  assert.match(main, /1 - prog\(t, M\.end - 0\.6, M\.end - 0\.2\)/);
  assert.match(main, /WORDS\.OVERLAY/);
  assert.ok(M.aiPill < M.drop && M.end < TOTAL);
  // its four influencers are made up, and the one real-looking face is never a famous person's: just names
  assert.deepEqual(Object.values(W.CAST).map((c) => c.name), ['Nova', 'Kai', 'Mika', 'Juno']);
  for (const c of Object.values(W.CAST)) assert.ok(Object.values(INF_STYLES).includes(c.style), c.name);
  // the post fits X (X counts a link as 23 characters)
  const xLen = [...W.POST.replace(/https?:\/\/\S+/g, 'x'.repeat(23))].length;
  assert.ok(xLen <= 280, `the post fits a post on X (${xLen})`);
  assert.match(W.POST, /https:\/\/agi1\.app\/studio/);
});

test('never AGI-1 in 3D, never CloakMesh, never another coin\'s data in the code that draws it; its 3D model is Juno\'s, labeled "AI-generated"', () => {
  // a 3D model file only where Juno's is made ready (media.mjs) and shown (page/model3d.js)
  const modelCode = new Set(['tools/studio-promo/media.mjs', 'tools/studio-promo/page/model3d.js']);
  for (const f of CODE) {
    const code = read(f);
    assert.doesNotMatch(noComments(code), /cloak ?mesh|inference\.agi1/i, `${f}: no CloakMesh`);
    assert.doesNotMatch(code, /src\/stage\/|agi1[\w-]*\.glb|models\/agi1|public\/models|agi1-portrait|agi1-avatar|agi1-live|agi1-cutout|loadAgi1_2D|live2d/i, `${f}: never AGI-1 (in 3D or her model files)`);
    if (!modelCode.has(f)) assert.doesNotMatch(code, /\.glb\b|\.gltf\b|GLTFLoader/i, `${f}: no 3D model file`);
    assert.doesNotMatch(code, /server\/checker|clank-chain|coinsSince|clank\.trade\/v1|mypinata|dexscreener/i, `${f}: never another coin's data`);
  }
  // the 3D model scene shows Juno's own 3D model (made ready by media.mjs, never in git), and says it's AI-generated
  const m3d = read('tools/studio-promo/page/model3d.js');
  assert.match(m3d, /from 'three'/);
  assert.match(m3d, /GLTFLoader/);
  const files = [...noComments(m3d).matchAll(/['"`]([^'"`]*\.(?:glb|gltf))['"`]/gi)].map((m) => m[1]);
  assert.deepEqual(files, ['/media/model/juno-3d.glb'], 'only Juno\'s model, from its media');
  assert.match(read('tools/studio-promo/media.mjs'), /export const MODELS = \[\['juno-3d', \['juno-3d\.glb'\]\]\];/);
  const scene = read('tools/studio-promo/page/scenes/model.js');
  assert.match(scene, /pill\(g, 'AI-generated'/);
  assert.doesNotMatch(scene, /Illustration/);
});

test('Juno\'s 3D model: four bones a vertex (three.js draws four), its move over its turntable, its bones shown', async () => {
  const { Document, NodeIO } = await import('@gltf-transform/core');
  const { fourBones, readyModel, MODELS } = await import('../tools/studio-promo/media.mjs');
  assert.deepEqual(MODELS, [['juno-3d', ['juno-3d.glb']]]);
  // a vertex with more than four bones keeps its four biggest, their weights adding up to one; the rest go
  const doc = new Document();
  const buf = doc.createBuffer();
  const acc = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buf);
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', acc('VEC3', new Float32Array([0, 0, 0, 0, 1, 0, 1, 0, 0])))
    .setAttribute('JOINTS_0', acc('VEC4', new Uint8Array([0, 1, 2, 3, 0, 1, 0, 0, 1, 0, 0, 0])))
    .setAttribute('WEIGHTS_0', acc('VEC4', new Float32Array([0.1, 0.1, 0.1, 0.1, 0.5, 0.5, 0, 0, 0.6, 0, 0, 0])))
    .setAttribute('JOINTS_1', acc('VEC4', new Uint8Array([4, 5, 6, 7, 0, 0, 0, 0, 0, 0, 0, 0])))
    .setAttribute('WEIGHTS_1', acc('VEC4', new Float32Array([0.3, 0.2, 0.05, 0.05, 0, 0, 0, 0, 0, 0, 0, 0])));
  assert.equal(fourBones(prim), 2, 'the vertex with eight bones, and the one whose weights added up to 0.6');
  assert.deepEqual(prim.listSemantics().sort(), ['JOINTS_0', 'POSITION', 'WEIGHTS_0']);
  const J = prim.getAttribute('JOINTS_0').getArray(), Wt = prim.getAttribute('WEIGHTS_0').getArray();
  assert.ok(J instanceof Uint16Array);
  assert.deepEqual([...J], [4, 5, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0]);
  const near = (a, b) => a.every((x, i) => Math.abs(x - b[i]) < 1e-6);
  assert.ok(near([...Wt], [0.3 / 0.7, 0.2 / 0.7, 0.1 / 0.7, 0.1 / 0.7, 0.5, 0.5, 0, 0, 1, 0, 0, 0]), String([...Wt]));
  // made ready: a tiny skinned model with a move, through the same steps as Juno's
  const tmp = mkdtempSync(join(tmpdir(), 'studio-promo-model-'));
  try {
    const d = new Document();
    const b = d.createBuffer();
    const a = (type, array) => d.createAccessor().setType(type).setArray(array).setBuffer(b);
    const hips = d.createNode('Hips').setTranslation([0, 0.9, 0]);
    const head = d.createNode('Head').setTranslation([0, 0.8, 0]);
    hips.addChild(head);
    const skin = d.createSkin().addJoint(hips).addJoint(head)
      .setInverseBindMatrices(a('MAT4', new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -0.9, 0, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -1.7, 0, 1])));
    const p = d.createPrimitive()
      .setAttribute('POSITION', a('VEC3', new Float32Array([-0.2, 0, 0, 0.2, 0, 0, 0, 1.7, 0])))
      .setAttribute('JOINTS_0', a('VEC4', new Uint8Array([0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0])))
      .setAttribute('WEIGHTS_0', a('VEC4', new Float32Array([0.5, 0.25, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0])))
      .setAttribute('JOINTS_1', a('VEC4', new Uint8Array(12)))
      .setAttribute('WEIGHTS_1', a('VEC4', new Float32Array(12)));
    const body = d.createNode('Body').setMesh(d.createMesh().addPrimitive(p)).setSkin(skin);
    d.createScene().addChild(hips).addChild(body);
    const anim = d.createAnimation('Wave');
    const sampler = d.createAnimationSampler().setInput(a('SCALAR', new Float32Array([0, 1, 2]))).setOutput(a('VEC3', new Float32Array([0.2, 0.9, 0, 0.3, 0.92, 0, 0.2, 0.9, 0])));
    anim.addSampler(sampler).addChannel(d.createAnimationChannel().setTargetNode(hips).setTargetPath('translation').setSampler(sampler));
    await new NodeIO().write(join(tmp, 'in.glb'), d);
    const info = await readyModel(join(tmp, 'in.glb'), join(tmp, 'out.glb'));
    assert.equal(info.triangles, 1);
    assert.equal(info.height, 1.7);
    assert.equal(info.changed, 1);
    assert.deepEqual(info.clips, [{ name: 'Wave', duration: 2 }]);
    const out = await new NodeIO().read(join(tmp, 'out.glb'));
    const op = out.getRoot().listMeshes()[0].listPrimitives()[0];
    assert.deepEqual(op.listSemantics().sort(), ['JOINTS_0', 'POSITION', 'WEIGHTS_0']);
    assert.equal(out.getRoot().listAnimations()[0].getName(), 'Wave');
    assert.equal(info.bytes, statSync(join(tmp, 'out.glb')).size);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
  // in the page: its move's hips put back over the turntable and lifted (its feet on the floor), the move itself the same
  const THREE = await import('three');
  const { centerHips, BONES, JOINTS, MODEL_URL } = await import('../tools/studio-promo/page/model3d.js');
  assert.equal(MODEL_URL, '/media/model/juno-3d.glb');
  const bone = new THREE.Bone(); bone.name = 'mixamorigHips'; bone.position.set(0.0033, 0.9146, 0.0168);
  const track = new THREE.VectorKeyframeTrack('mixamorigHips.position', [0, 1], [0.2477, 0.8843, -0.1829, 0.3477, 0.9, -0.0829]);
  const moved = centerHips(new THREE.AnimationClip('Big_Wave_Hello', 1, [track]), bone);
  assert.ok(Math.abs(moved - Math.hypot(0.2444, 0.1997)) < 1e-4, String(moved));
  const v = [...track.values];
  assert.ok(near(v, [0.0033, 0.9063, 0.0168, 0.1033, 0.922, 0.1168]), String(v));
  assert.equal(centerHips(new THREE.AnimationClip('x', 1, []), bone), 0, 'no hips track: nothing to move');
  // the bones shown are its own skeleton's joints
  for (const [x, y] of BONES) assert.ok(JOINTS[x] && JOINTS[y], `${x}-${y}`);
  for (const n of Object.values(JOINTS)) assert.match(n, /^(Hips|Spine\d?|Neck|Head(Top_End)?|(Left|Right)(Shoulder|Arm|ForeArm|Hand|UpLeg|Leg|Foot|ToeBase))$/);
});

// ---------- AGI Studio's own words and numbers ----------
test('its words and numbers are AGI Studio\'s own', () => {
  const vals = (o) => Object.values(o);
  // the brand: Explore's own moving heading
  const explore = read('src/studio/views/explore.js');
  const hero = JSON.parse(explore.match(/export const HERO_WORDS = (\[[^\]]+\])/)[1].replace(/'/g, '"'));
  const still = +explore.match(/export const HERO_STILL = (\d+)/)[1];
  assert.equal(W.BRAND.lead, 'Create your own');
  assert.deepEqual([...W.BRAND.rotate].sort(), hero.map((x) => `${x}.`).sort(), "Explore's words after \"own\"");
  assert.equal(W.BRAND.rotate[0], `${hero[still]}.`, 'its first word is the one Explore stands still on');
  assert.equal(W.FINALE.word, `${hero[still]}.`);
  assert.equal(W.FINALE.lead, W.BRAND.lead);
  // creating one
  assert.equal(W.CREATE.goCost, PRICES.influencer);
  assert.match(W.CREATE.sub, new RegExp(`^${PRICES.influencer} credits`));
  assert.equal(W.CREATE.newLooks, `4 new looks · ${PRICES.looks} credits`);
  assert.deepEqual(W.CREATE.modes, [MODES.design.name, MODES.picture.name]);
  assert.deepEqual(W.CREATE.ways.map((w) => [w.name, w.cost]), [[WAYS.looks.name, PRICES.influencer], [WAYS.body.name, PRICES.body], [WAYS.asis.name, PRICES.asis]]);
  const keys = ['look', 'age', 'cut', 'outfit', 'vibe'];
  W.CREATE.rows.forEach((r, k) => {
    assert.equal(r.label, OPTIONS[keys[k]].label);
    for (const c of r.choices) assert.ok(vals(OPTIONS[keys[k]].choices).includes(c), `${r.label}: "${c}" is one of the app's`);
    assert.ok(r.choices.includes(r.pick), `${r.label}: Nova's pick is shown`);
  });
  for (const s of W.CREATE.styles) assert.ok(vals(INF_STYLES).includes(s), s);
  // its styles
  assert.equal(W.STYLES.count, Object.keys(INF_STYLES).length);
  assert.equal(W.STYLES.stamp, `${Object.keys(INF_STYLES).length} styles`);
  assert.deepEqual(W.STYLES.groups, STYLE_GROUPS.map((g) => g.name));
  for (const [, name] of W.STYLES.tiles) assert.ok(vals(INF_STYLES).includes(name), name);
  assert.match(W.STYLES.any, new RegExp(STYLE_ANY));
  // photos, memes, X banners, edits
  assert.equal(W.PHOTOS.makeCost, PRICES.photo);
  assert.equal(W.PHOTOS.models.at(-1), `From ${photoCredits({ model: 'crisp' }, 1)} credits`);
  assert.deepEqual(W.MEMES_SCENE.formats, vals(MEMES).map((m) => m.name));
  assert.equal(W.MEMES_SCENE.bannerSize, `${BANNER.W} × ${BANNER.H}`);
  assert.deepEqual([BANNER.W, BANNER.H], [1500, 500], "X's own header size");
  assert.equal(W.MEMES_SCENE.bannerCost, PRICES.banner);
  assert.equal(W.EDIT.idea, EDIT_IDEAS[0]);
  assert.equal(W.EDIT.cost, PRICES.photo);
  for (const f of W.EDIT.filters) assert.ok(vals(EDITOR_FILTERS).includes(f), f);
  // trend videos: the app's own trend clips
  const ids = TRENDS.map((t) => t.id);
  for (const [, tr] of [...W.TRENDS_SCENE.carousel, ...W.TRENDS_SCENE.pairs.map((p) => [p[0], p[3]])]) assert.ok(tr && ids.includes(tr.id), 'one of the app\'s trends');
  assert.equal(new Set(W.TRENDS_SCENE.carousel.map((c) => c[1].id)).size, W.TRENDS_SCENE.carousel.length, 'each trend once');
  for (const p of W.TRENDS_SCENE.pairs) assert.ok(Object.values(W.CAST).some((c) => c.name === p[2]), p[2]);
  assert.equal(W.TRENDS_SCENE.cost, PRICES.trend);
  // videos and the tools
  assert.deepEqual(W.VIDEOS.models, vals(VIDEO_MODELS).map((m) => m.name));
  assert.equal(W.VIDEOS.makeCost, videoCredits({}, 1));
  assert.match(W.VIDEOS.modelNotes.at(-1), new RegExp(`up to ${LONG.MAX_S} s`));
  assert.equal(W.VIDEOS.seconds, `${VIDEO_MODELS.standard.seconds.join(', ')} s`);
  assert.match(W.TOOLS.cards[0].note, new RegExp(`${VIDEO_EDITOR.MIN_S}–${VIDEO_EDITOR.MAX_S} s`));
  assert.equal(W.TOOLS.cards.length, M.tools.length, 'a card for each beat');
  // a 3D model and a coin
  assert.equal(W.MODEL.cost, PRICES.model);
  for (const mv of W.MODEL.moves) assert.ok(MOVE_NAMES.includes(mv.toLowerCase()), mv);
  // paying: the app's prices at each level, its top-ups, its holder perks
  for (const [what, , p, from] of W.PAY.prices) {
    assert.equal(p.length, 3, what);
    assert.ok(p[0] >= p[1] && p[1] >= p[2], `${what}: holders pay less`);
    if (!from) assert.ok(vals(PRICES).includes(p[0]), `${what}: a Stranger's price is the app's`);
  }
  assert.deepEqual(W.PAY.prices[0][2], [1, 2, 3].map((l) => creditPrice('influencer', l)));
  assert.deepEqual(W.PAY.prices.find((r) => r[0] === 'A photo')[2], [1, 2, 3].map((l) => photoCredits({ model: 'crisp' }, l)), 'a photo from its cheapest model');
  assert.deepEqual(W.PAY.levels, [LEVEL_NAMES[1], LEVEL_NAMES[2], LEVEL_NAMES[3]]);
  assert.deepEqual(W.PAY.amounts, TOPUPS);
  assert.deepEqual(W.PAY.off, [Math.round(DISCOUNT[2] * 100), Math.round(DISCOUNT[3] * 100)]);
  assert.deepEqual(W.PAY.free, [FREE_CREDITS[2], FREE_CREDITS[3]]);
  assert.deepEqual(W.PAY.perks.map((p) => [p[0], p[1]]), HOLDER_LINE.rows.map((r) => [r[0], r[1]]));
  assert.ok(W.PAY.holderFine.startsWith(HOLDER_LINE.fine));
  assert.equal(W.PAY.holderTitle, HOLDER_LINE.title);
  assert.match(W.POST, new RegExp(`${W.PAY.off[0]}–${W.PAY.off[1]}% off`));
  // the community, the end
  assert.equal(W.COMMUNITY.inviteLink, inviteLink('agi1.app', '/studio', 'k7pq3mwd'), "the app's own invite link, shown without its https://");
  assert.match('k7pq3mwd', REF_CODE, 'a made-up code, the shape of a real one');
  assert.equal(W.COMMUNITY.claimed, `${W.COMMUNITY.gift} credits are yours`);
  assert.equal(W.SITE, 'agi1.app/studio');
  assert.equal(W.HANDLE, '@agi1dotapp');
  assert.equal(W.NAME, 'AGI Studio');
});

// ---------- the clock ----------
test('the scenes: one after the other on bars of the music, 103 s in all, every moment in its own scene', () => {
  assert.equal(BEAT, 0.5);
  assert.equal(BAR, 4 * BEAT);
  assert.equal(SCENES[0].from, 0);
  assert.equal(TOTAL, 103);
  SCENES.forEach((s, k) => {
    assert.ok(s.to > s.from, s.id);
    if (k) assert.equal(s.from, SCENES[k - 1].to, `${s.id} starts where ${SCENES[k - 1].id} ends`);
    assert.equal(s.from % BAR, 0, `${s.id} starts on a bar`);
  });
  assert.deepEqual(SCENES.map((s) => s.id), ['hook', 'brand', 'create', 'styles', 'photos', 'memes', 'edit', 'trends', 'videos', 'tools', 'model', 'pay', 'community', 'finale', 'end']);
  assert.equal(sceneOf('end').to, TOTAL);
  assert.equal(at(4), 8);
  // every moment is inside the video, and in the scene it belongs to
  const flat = Object.entries(M).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : [[k, v]]));
  for (const [k, t] of flat) assert.ok(t >= 0 && t < TOTAL, `${k} ${t}`);
  const home = {
    hook: ['shots', 'meet', 'feed', 'grid', 'likes', 'zoom', 'notReal', 'aiPill', 'youMade', 'createClick', 'squad', 'breath'],
    brand: ['drop', 'headline', 'rotate', 'sub', 'url'],
    create: ['appIn', 'taps', 'typeName', 'create', 'looks', 'pickLook', 'useLook', 'body', 'ready', 'photoMode', 'photoDrop', 'consent', 'ways', 'pickWay'],
    styles: ['lineup', 'styleTiles', 'stamp26', 'anyStyle'],
    photos: ['typeScene', 'makePhoto', 'developed', 'montage', 'photoModels'],
    memes: ['memes', 'formats', 'banner', 'bannerSize'],
    edit: ['typeEdit', 'editClick', 'editWipe', 'onlyThat', 'editor', 'filters', 'sticker', 'editText', 'move', 'breath2'],
    trends: ['drop2', 'pickTrend', 'pairs', 'swaps', 'ownClip', 'four'],
    videos: ['videoIn', 'videoClick', 'alive', 'row', 'videoModels', 'sound'],
    tools: ['tools', 'toolsRead'],
    model: ['model', 'modelSteps', 'wave', 'coin', 'coinFlip', 'coinLand'],
    pay: ['pay', 'count', 'prices', 'holders', 'holderRows'],
    community: ['likesWall', 'hearts', 'spotlight', 'gifts', 'claim', 'invite', 'breath3'],
    finale: ['finale', 'logo', 'line', 'cta', 'live'],
    end: ['end', 'lastHits'],
  };
  const listed = Object.values(home).flat();
  assert.deepEqual([...listed].sort(), Object.keys(M).sort(), 'every moment has its scene');
  for (const [id, ks] of Object.entries(home)) for (const k of ks) for (const t of [M[k]].flat()) assert.equal(sceneAt(t).id, id, `${k} at ${t}`);
  // a sequence of moments goes forward in time
  for (const [k, v] of Object.entries(M)) if (Array.isArray(v)) v.forEach((t, i) => i && assert.ok(t > v[i - 1], `${k} in order`));
  // the drops are on the scenes' first beats, each after a breath
  assert.equal(M.drop, sceneOf('brand').from);
  assert.equal(M.drop2, sceneOf('trends').from);
  assert.equal(M.finale, sceneOf('finale').from);
  assert.equal(M.end, sceneOf('end').from);
  // the cover is the finale with its button and its address in
  assert.equal(sceneAt(COVER_AT).id, 'finale');
  assert.ok(COVER_AT > M.live);
});

test('the cuts: one at each scene\'s first moment, short, and never overlapping', () => {
  assert.deepEqual(TRANSITIONS.map((x) => x.id), SCENES.slice(1).map((s) => s.id));
  TRANSITIONS.forEach((x, k) => {
    assert.equal(x.at, SCENES[k + 1].from, x.id);
    assert.equal(x.i, k);
    assert.ok(x.pre > 0 && x.pre <= 0.5 && x.post > 0 && x.post <= 0.5, `${x.id}: a quick cut`);
    if (k) assert.ok(TRANSITIONS[k - 1].at + TRANSITIONS[k - 1].post <= x.at - x.pre, `${x.id}: after the cut before it`);
    assert.equal(typeof x.draw, 'function');
  });
});

// ---------- the music on the picture ----------
test('the music lands on the picture: a sound on every moment that has one, the drops after their breaths', () => {
  const plan = musicPlan();
  const near = (name, t, tol = 0.002) => plan.some((e) => e.name === name && Math.abs(e.t - t) <= tol);
  // a shutter for each of Nova's photos and for each one made
  for (const t of [...M.shots, M.developed, ...M.montage]) assert.ok(near('shutter', t), `a shutter at ${t}`);
  // a tap and a note for each choice, a tick for each letter typed
  for (const t of M.taps) assert.ok(near('click', t), `a tap at ${t}`);
  for (const t of letterTimes(W.CREATE.name, M.typeName + 0.12, 9)) assert.ok(near('click', t), `"${W.CREATE.name}": a letter at ${t}`);
  for (const t of letterTimes(W.EDIT.idea, M.typeEdit + 0.05, 30)) assert.ok(near('click', t), `"${W.EDIT.idea}": a letter at ${t}`);
  const scene = letterTimes(W.PHOTOS.typed, M.typeScene + 0.12, 72);
  scene.forEach((t, k) => { if (k % 2 === 0) assert.ok(near('click', t), `the scene typed: a letter at ${t}`); });
  // the credits counting up: a tick every 100 of them, never going back
  const ticks = countTicks();
  assert.equal(ticks.length, 10);
  ticks.forEach((t, k) => { assert.ok(near('click', t), `a tick at ${t}`); if (k) assert.ok(t > ticks[k - 1]); });
  assert.ok(ticks.at(-1) <= M.count + 0.95 + 1e-9);
  // the hits
  for (const t of [M.drop, M.drop2, M.finale, M.end, ...M.lastHits, M.youMade, M.stamp26, M.coinLand, M.holders, M.spotlight, M.logo, M.cta, ...M.swaps]) assert.ok(near('impact', t), `a hit at ${t}`);
  for (const t of [M.drop, M.drop2, M.finale, M.end, M.coinLand]) assert.ok(near('crash', t), `a crash at ${t}`);
  // a riser up to each breath, and the breaths silent
  for (const [a] of BREATHS.slice(0, 3)) assert.ok(plan.some((e) => e.name === 'riser' && Math.abs(e.t - a) < 0.001), `a riser up to ${a}`);
  assert.deepEqual(BREATHS.map((b) => b[1]), [M.drop, M.drop2, M.finale, M.end]);
  for (const [a, b] of BREATHS) assert.ok(!plan.some((e) => e.t > a + 1e-6 && e.t < b - 1e-6), `nothing starts in the breath before ${b}`);
  // the swaps: a glitch just before the influencer appears in its clip, and its sparkle
  for (const t of M.swaps) { assert.ok(near('glitch', t - 0.17, 0.01)); assert.ok(near('sparkle', t + 0.02, 0.01)); }
  // pops and notes for what pops in
  for (const t of [...M.looks, ...M.lineup, ...M.memes, ...M.row, ...M.tools, ...M.hearts, ...M.squad, ...M.likes]) assert.ok(near('pop', t), `a pop at ${t}`);
  for (const t of [...M.rotate, ...M.formats, ...M.photoModels, ...M.videoModels, ...M.modelSteps]) assert.ok(near('blip', t), `a blip at ${t}`);
  // every cut has its sound right on it: a hit, a crash, or a whoosh going through it
  for (const s of SCENES.slice(1)) {
    const t = s.from;
    const ok = plan.some((e) => (['impact', 'crash'].includes(e.name) && Math.abs(e.t - t) <= 0.01)
      || (e.name === 'sweep' && (Math.abs(e.t - t) <= 0.1 || (e.t <= t && t <= e.t + e.dur))));
    assert.ok(ok, `the cut into ${s.id}`);
  }
  // nothing outside the video, and the same plan every time
  for (const e of plan) assert.ok(e.t >= 0 && e.t < TOTAL, `${e.name} at ${e.t}`);
  assert.deepEqual(musicPlan(), plan);
});

test('the music: its sections on the scenes, the drops on Bm, four kicks a bar on the beat where it\'s full', () => {
  // a section of the music changes with the picture: each starts with a scene, or is the build into a drop (photos and
  // memes share the groove)
  assert.equal(SECTIONS[0][0], 0);
  SECTIONS.forEach(([bar, name], k) => {
    if (k) assert.ok(bar > SECTIONS[k - 1][0], 'in order');
    assert.ok(SCENES.some((s) => s.from === at(bar)) || (name === 'build' && SCENES.some((s) => s.from === at(bar + 1))), `${name} at bar ${bar}`);
  });
  for (const s of SCENES.filter((x) => x.id !== 'memes')) assert.ok(SECTIONS.some(([bar]) => at(bar) === s.from), `the music changes with ${s.id}`);
  // the drops on the first chord (Bm), the builds on the last (A)
  for (const t of [M.drop, M.drop2, M.finale]) assert.equal(sectionAt(t / BAR).chord, 0, `the drop at ${t} on Bm`);
  for (const t of [M.breath2, M.breath3]) assert.equal(sectionAt(Math.floor(t / BAR)).name, 'build');
  for (const t of [M.breath2, M.breath3]) assert.equal(sectionAt(Math.floor(t / BAR)).chord, 3);
  // where the music is full, four kicks a bar, each on its beat
  const plan = musicPlan();
  const kicks = plan.filter((e) => e.name === 'kick').map((e) => e.t);
  let full = 0;
  for (let bar = 4; bar < 49; bar++) {
    if (!['dropA', 'dropB', 'groove', 'more', 'finale'].includes(sectionAt(bar).name)) continue;
    full++;
    const inBar = kicks.filter((t) => t >= at(bar) - 1e-6 && t < at(bar + 1) - 1e-6);
    assert.equal(inBar.length, 4, `four kicks in bar ${bar}`);
    for (const t of inBar) assert.ok(Math.abs(t / BEAT - Math.round(t / BEAT)) < 1e-6, `on the beat (${t})`);
  }
  assert.ok(full >= 25, 'most of it dances');
});

test('the music, rendered: the video\'s length, stereo, loud enough, never clipping, silent breaths, a fade (STUDIO_PROMO_RENDER=1)', { skip: !process.env.STUDIO_PROMO_RENDER }, () => {
  const wav = renderMusic();
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.readUInt16LE(22), 2);
  assert.equal(wav.readUInt32LE(24), RATE);
  assert.equal(RATE, 48000);
  const n = wav.readUInt32LE(40) / 4;
  assert.equal(n, Math.round(TOTAL * RATE));
  const sample = (i, ch) => wav.readInt16LE(44 + i * 4 + ch * 2) / 32768;
  const rms = (a, b) => { let s = 0, c = 0; for (let i = Math.round(a * RATE); i < Math.round(b * RATE); i++) { const v = (sample(i, 0) + sample(i, 1)) / 2; s += v * v; c++; } return Math.sqrt(s / c); };
  let peak = 0;
  for (let i = 0; i < n; i += 3) peak = Math.max(peak, Math.abs(sample(i, 0)), Math.abs(sample(i, 1)));
  assert.ok(peak < 0.9, `never clipping (${peak})`);
  assert.ok(peak > 0.5, `not quiet (${peak})`);
  assert.ok(rms(8.5, 13.5) > rms(0.5, 3.5) * 1.3, 'the drop is bigger than the opening');
  assert.ok(rms(46.5, 55.5) > rms(14.5, 25.5), 'the second drop is bigger than creating');
  for (const [a, b] of BREATHS) assert.ok(rms(a + 0.012, b - 0.006) < 0.01, `a breath before ${b}`);
  assert.ok(rms(TOTAL - 0.04, TOTAL) < 0.01, 'it fades out');
});

// ---------- the renderer ----------
test('the renderer: its 15 scenes in order, its own server, no secrets for the browser or ffmpeg, never in the site', async () => {
  const main = read('tools/studio-promo/page/main.js');
  const ids = SCENES.map((s) => s.id);
  for (const id of ids) assert.match(main, new RegExp(`import ${id} from './scenes/${id}\\.js'`), id);
  assert.match(main, new RegExp(`const MODULES = \\{ ${ids.join(', ')} \\}`));
  assert.match(main, /SIZE = \{ W: 1920, H: 1080 \}/, '16:9 (the owner: "i just decided can you make the launch video 16:9")');
  assert.deepEqual(withoutSecrets({ PATH: '/bin', GEMINI_API_KEY: 'x', FAL_KEY: 'k', LIVE_SECRET: 'y', TELEGRAM_BOT_TOKEN: 'z', PASS_SECRET: 'p', HOME: '/h' }), { PATH: '/bin', HOME: '/h' });
  // its options
  assert.deepEqual(args([]), { out: 'studio-promo', fps: 60, scale: 1, from: 0, to: TOTAL, stills: null, sheet: null, music: true, voice: true, crf: 18, name: 'agi-studio-launch', quality: 0.95, light: 0, soundOnly: false });
  assert.equal(args(['--light', '27', '--scale', '0.5']).light, 27);
  assert.equal(args(['--no-voice']).voice, false);
  assert.equal(args(['--sound-only']).soundOnly, true);
  assert.throws(() => args(['--nope']), /unknown option/);
  // ffmpeg and ffprobe never get a secret
  const calls = read('tools/studio-promo/make.mjs').split('\n').filter((x) => /\b(spawn|execFileSync)\(/.test(x));
  assert.equal(calls.length, 3, 'the frames\' encoder, ffmpeg and ffprobe');
  for (const line of calls) assert.match(line, /env: withoutSecrets\(\)/, line.trim());
  // its own server: this computer only, its page and its media, nothing else
  const dir = mkdtempSync(join(tmpdir(), 'studio-promo-'));
  try {
    mkdirSync(join(dir, 'page')); mkdirSync(join(dir, 'media'));
    writeFileSync(join(dir, 'page', 'index.html'), '<p>hi</p>');
    writeFileSync(join(dir, 'media', 'a.jpg'), 'jpg');
    writeFileSync(join(dir, 'secret.txt'), 'never');
    const { server, url } = await serve(join(dir, 'page'), join(dir, 'media'));
    try {
      assert.match(url, /^http:\/\/127\.0\.0\.1:\d+\/$/);
      const get = (p) => new Promise((ok, fail) => {
        const r = request(`${url}${p.replace(/^\//, '')}`, (res) => { let b = ''; res.on('data', (d) => (b += d)); res.on('end', () => ok([res.statusCode, b])); });
        r.on('error', fail); r.end();
      });
      assert.deepEqual(await get('/'), [200, '<p>hi</p>']);
      assert.deepEqual(await get('/media/a.jpg'), [200, 'jpg']);
      for (const p of ['/../secret.txt', '/..%2fsecret.txt', '/media/..%2fsecret.txt', '/media/..%2f..%2fsecret.txt', '/%2e%2e/secret.txt', '/nope.js']) {
        assert.equal((await get(p))[0], 404, p);
      }
    } finally { server.close(); }
  } finally { rmSync(dir, { recursive: true, force: true }); }
  // not part of the website: nothing of it in the site's build, and its media and videos never in git
  assert.doesNotMatch(read('vite.config.js'), /studio-promo/);
  const ignore = read('.gitignore');
  assert.match(ignore, /^\/studio-promo\/$/m);
  assert.match(ignore, /^tools\/studio-promo\/media\/$/m);
  assert.match(ignore, /^dist\/$/m, 'its build (tools/studio-promo/dist) too');
  assert.match(read('package.json'), /tests\/studio-promo\.test\.js/);
});

// ---------- her voice (2026-10-13, the owner: "will it be good if you add voice over to the launch video", then "Short,
// AGI-1's voice": about ten short lines at the big moments, the music dipping under her, the words on screen as they were)
const SR = V.RATE;
const sine = (n, f, amp, rate = SR) => Float32Array.from({ length: n }, (_, i) => amp * Math.sin((2 * Math.PI * f * i) / rate));
// a tone's amplitude in a stretch of samples (a Hann window: a pure tone read exactly, its neighbours left out)
function toneAmp(x, f, a, b, rate = SR) {
  let re = 0, im = 0, ws = 0;
  for (let i = a; i < b; i++) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * (i - a)) / (b - a - 1)), ph = (2 * Math.PI * f * i) / rate;
    re += x[i] * w * Math.cos(ph); im += x[i] * w * Math.sin(ph); ws += w;
  }
  return (2 * Math.hypot(re, im)) / ws;
}
// the same noise every run
const noise = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32) * 2 - 1; };
// a biquad's response at a frequency (complex): the mixer splits the music with one of each (12 dB an octave)
function response(f, type, fc) {
  const q = V.biquad(type, fc), w = (2 * Math.PI * f) / SR;
  const c1 = Math.cos(w), s1 = -Math.sin(w), c2 = Math.cos(2 * w), s2 = -Math.sin(2 * w);
  const nr = q.b0 + q.b1 * c1 + q.b2 * c2, ni = q.b1 * s1 + q.b2 * s2, dr = 1 + q.a1 * c1 + q.a2 * c2, di = q.a1 * s1 + q.a2 * s2;
  const d = dr * dr + di * di;
  return [(nr * dr + ni * di) / d, (ni * dr - nr * di) / d];
}

test('her voice: her twelve lines and where they go (never over a drop, the trend videos or a breath; every hit at full level)', async () => {
  const { VOICES, VOICE_SIG, args: mediaArgs } = await import('../tools/studio-promo/media.mjs');
  const ids = W.VOICE.map((l) => l.id);
  assert.equal(ids.length, 12);
  assert.deepEqual(PLACES.map((l) => l.id), ids, 'timeline.js places each of her lines (words.js), in the same order');
  assert.deepEqual(VOICES.map(([id]) => id).sort(), [...ids].sort(), 'media.mjs makes each of her takes ready');
  for (const [, names] of VOICES) assert.match(names[0], /^agi1-vo-\d\d-[a-z-]+\.wav$/);
  assert.match(VOICE_SIG, /^v1-[0-9a-f]{8}$/, 'a change to how her takes are made ready makes them again');
  assert.deepEqual(mediaArgs(['--from', 'x', '--only', 'voice']).only, ['voice']);
  assert.deepEqual(mediaArgs(['--from', 'x']).only, ['pics', 'vids', 'models', 'voice']);
  assert.throws(() => mediaArgs(['--from', 'x', '--only', 'voice,nope']), /--only: pics, vids, models, voice/);
  // her words: short, among the video's words (its rules hold for them), and said as written but its address
  for (const l of W.VOICE) {
    assert.ok(l.text.length <= 30, `a short line: "${l.text}"`);
    assert.ok(words.includes(l.text), l.text);
    if (l.said) assert.ok(words.includes(l.said), l.said);
  }
  const url = W.VOICE.find((l) => l.id === 'url');
  assert.equal(url.text, W.SITE);
  assert.equal(url.said, 'A G I one dot app slash studio.');
  assert.equal(W.VOICE.find((l) => l.id === 'meet').text, W.HOOK.meet, 'her first line is the hook\'s own words');
  // in time order, each in its own scene, short, and before the end fades
  const scene = { meet: 'hook', 'not-real': 'hook', 'you-made': 'hook', studio: 'brand', design: 'create', styles: 'styles', edit: 'edit', move: 'edit', model: 'model', share: 'community', url: 'finale', live: 'end' };
  PLACES.forEach((l, k) => {
    if (k) assert.ok(l.at > PLACES[k - 1].at + PLACES[k - 1].len, `${l.id} after ${PLACES[k - 1].id}`);
    const s = sceneOf(scene[l.id]);
    assert.ok(l.at >= s.from && l.at + l.len <= s.to, `${l.id} in its scene (${s.id})`);
    assert.ok(l.len > 0.8 && l.len < 3.2, `${l.id}: a short line (${l.len} s)`);
  });
  assert.ok(PLACES.at(-1).at + PLACES.at(-1).len < TOTAL - 1.6, 'all of her words before the end fades');
  const spoken = PLACES.reduce((s, l) => s + l.len, 0);
  assert.ok(spoken < TOTAL * 0.25, `short lines, never a narration (${spoken.toFixed(1)} s of ${TOTAL})`);
  // never over the trend videos (their drop and all of their scene), never on a drop's first second
  const trends = sceneOf('trends');
  for (const l of PLACES) {
    assert.ok(l.at + l.len <= trends.from || l.at >= trends.to, `${l.id}: never over the trend videos`);
    for (const d of [M.drop, M.drop2, M.finale]) assert.ok(l.at + l.len < d || l.at >= d + 1, `${l.id}: never on the drop at ${d}`);
  }
  // the music dips for each with every hit at full level and every breath silent: nothing wrong with any place
  const hits = V.hitsOf(musicPlan());
  assert.ok(hits.length > 15 && hits.includes(M.drop) && hits.includes(M.drop2), 'the music\'s hits, its drops among them');
  for (const p of V.planDucks(PLACES, { hits, breaths: BREATHS })) assert.deepEqual(p.problems, [], p.id);
  // the one hit she speaks over ("She's | not real.") is the music's own
  for (const l of PLACES) for (const h of l.over || []) assert.ok(hits.includes(h), `${l.id} over ${h}`);
  assert.deepEqual(PLACES.find((l) => l.id === 'not-real').over, [M.notReal]);
  assert.deepEqual(PLACES.filter((l) => l.over).map((l) => l.id), ['not-real']);
});

test('her voice, mixed: the music dips under her by loudness (8 to 12 dB; its lows and highs less), and everywhere else it\'s exactly the music', () => {
  const n = 6 * SR;
  const mk = () => Float32Array.from({ length: n }, (_, i) => 0.12 * Math.sin((2 * Math.PI * 50 * i) / SR) + 0.12 * Math.sin((2 * Math.PI * 1000 * i) / SR) + 0.06 * Math.sin((2 * Math.PI * 16000 * i) / SR));
  const music = { L: mk(), R: mk() };
  // her lines: a 300 Hz voice, a breath in its take before her first word (never heard where the music isn't dipped)
  const line = (id, at, len, amp, extra = {}) => {
    const onset = 0.15, pcm = new Float32Array(Math.round((onset + len + 0.2) * SR));
    const rnd = noise(id.length);
    for (let i = 0; i < Math.round(onset * SR); i++) pcm[i] = 0.02 * rnd();
    for (let i = Math.round(onset * SR); i < Math.round((onset + len) * SR); i++) pcm[i] = amp * Math.sin((2 * Math.PI * 300 * i) / SR);
    return { id, at, len, onset, pcm, ...extra };
  };
  // quiet under the music (it dips its most), loud over it (its least), and one with its own dip
  const lines = [line('quiet', 0.6, 0.8, 0.02), line('loud', 2.2, 0.8, 0.3), line('own', 4.2, 0.8, 0.1, { duck: 10 })];
  const hits = [2.0, 3.3];          // one just before 'loud' (its dip waits 60 ms for it), one after it (the music back up by then)
  const breaths = [[5.3, 5.6]];     // after 'own': the music back up by its silence
  const mix = V.mixVoice(music, lines, { hits, breaths });
  const [q, l, o] = mix.report;
  assert.equal(q.duck, 12, `the music far louder than her: its most (${q.music} vs ${q.her})`);
  assert.equal(l.duck, 8, `her louder than the music: its least (${l.music} vs ${l.her})`);
  assert.equal(o.duck, 10, 'a line\'s own dip');
  for (const r of [q, l]) assert.equal(r.duck, +Math.min(12, Math.max(8, r.music - r.her + V.DUCK.margin)).toFixed(2));
  // her loudness and the music's over her words, as the report says
  const seg =(x, a, b) => x.subarray(Math.round(a * SR), Math.round(b * SR));
  const vl = lines[1].pcm.subarray(Math.round(0.15 * SR), Math.round(0.95 * SR));
  assert.ok(Math.abs(l.her - V.loudness([vl, vl])) < 0.05, `${l.her}`);
  assert.ok(Math.abs(l.music - V.loudness([seg(music.L, 2.2, 3.0), seg(music.R, 2.2, 3.0)])) < 0.01);
  // where each dip starts and ends: after the hit just before 'loud', and back up before the next hit or the breath
  assert.ok(Math.abs(l.a0 - 2.06) < 1e-9 && Math.abs(l.a1 - 2.16) < 1e-9, `${l.a0}, ${l.a1}`);
  assert.ok(Math.abs(l.r1 - 3.29) < 1e-9 && Math.abs(l.r0 - 3.06) < 1e-9, `${l.r0}, ${l.r1}`);
  assert.ok(Math.abs(o.r1 - 5.31) < 1e-9, `${o.r1}`);
  assert.ok(Math.abs(q.a0 - 0.4) < 1e-9 && Math.abs(q.r1 - 1.96) < 1e-9, `${q.a0}, ${q.r1}`);
  // everywhere else, exactly the music (her take's breath before her first word included: never where the music isn't dipped)
  const inDip = (t) => mix.report.some((r) => t >= r.a0 - 1 / SR && t < r.r1 + 1 / SR);
  let changed = 0, outside = 0;
  for (let i = 0; i < n; i++) {
    const same = mix.L[i] === music.L[i] && mix.R[i] === music.R[i];
    if (!same) changed++;
    if (!same && !inDip(i / SR)) outside++;
  }
  assert.equal(outside, 0, 'nothing changed outside her dips');
  assert.equal(changed, mix.changed);
  for (const h of hits) for (let i = Math.round(h * SR); i < Math.round((h + 0.06) * SR); i++) assert.ok(mix.L[i] === music.L[i] && mix.R[i] === music.R[i], `the hit at ${h}`);
  for (let i = Math.round(5.31 * SR); i < Math.round(5.6 * SR); i++) assert.ok(mix.L[i] === music.L[i], 'the breath');
  assert.equal(mix.limiter.under, 0, 'nothing near the ceiling here');
  // in the middle of each dip: the music's middle band (her voice's) down by its dip, its lows and highs by their share of
  // it (each band from its own crossover: what the three bands make, exactly), and her voice on top
  for (const r of mix.report) {
    const a = Math.round((r.a1 + 0.05) * SR), b = Math.round((r.r0 - 0.05) * SR);
    const gm = 10 ** (-r.duck / 20), gl = gm ** V.DUCK.lows, gh = gm ** V.DUCK.highs;
    const dips = {};
    for (const f of [50, 1000, 16000]) {
      const [lr, li] = response(f, 'lp', V.DUCK.split[0]), [hr, hi] = response(f, 'hp', V.DUCK.split[1]);
      const want = 20 * Math.log10(Math.hypot(gm + (gl - gm) * lr + (gh - gm) * hr, (gl - gm) * li + (gh - gm) * hi));
      const got = 20 * Math.log10(toneAmp(mix.L, f, a, b) / toneAmp(music.L, f, a, b));
      assert.ok(Math.abs(got - want) < 0.1, `${r.id} at ${f} Hz: ${got.toFixed(2)} dB, ${want.toFixed(2)} wanted`);
      dips[f] = -got;
    }
    // her band dips by its dip (the other bands' gentle slopes reach into it: at most half a dB more)
    assert.ok(dips[1000] > r.duck - 0.1 && dips[1000] < r.duck + 0.5, `${r.id}: her band dips ${dips[1000].toFixed(2)} dB (${r.duck})`);
    assert.ok(dips[50] < dips[1000] - 2 && dips[50] > r.duck * V.DUCK.lows - 0.3, `${r.id}: the lows dip about half as much (${dips[50].toFixed(2)})`);
    assert.ok(dips[16000] < dips[1000] - 0.5 && dips[16000] > r.duck * V.DUCK.highs - 0.3, `${r.id}: the highs a little less (${dips[16000].toFixed(2)})`);
    const amp = { quiet: 0.02, loud: 0.3, own: 0.1 }[r.id];
    assert.ok(Math.abs(toneAmp(mix.L, 300, a, b) / amp - 1) < 0.01, `${r.id}: her voice on top`);
  }
  // the same takes and music always make the same soundtrack
  const again = V.mixVoice(music, lines, { hits, breaths });
  assert.ok(again.L.every((x, i) => x === mix.L[i]) && again.R.every((x, i) => x === mix.R[i]), 'the same soundtrack');
  // two of her lines with one id, or a line that doesn't fit (a hit under her words): never mixed
  assert.throws(() => V.mixVoice(music, [line('a', 0.6, 0.8, 0.1), line('a', 3.0, 0.8, 0.1)], { hits: [], breaths: [] }), /same id/);
  assert.throws(() => V.mixVoice(music, [line('a', 0.6, 0.8, 0.1)], { hits: [1.0], breaths: [] }), /her lines don't fit: a: a hit under her words \(1\)/);
  assert.equal(V.mixVoice(music, [line('a', 0.6, 0.8, 0.1)], { hits: [1.0], breaths: [], anyway: true }).report[0].problems.length, 1);
});

test('her voice, mixed: never over the ceiling where she is, and where the music alone is louder, the music as it was', () => {
  const n = 3 * SR;
  const L = sine(n, 1000, 0.5), R = sine(n, 1000, 0.5);
  L[Math.round(0.3 * SR)] = 0.95; R[Math.round(0.3 * SR)] = -0.95;   // the music's own peaks: one far from her,
  L[Math.round(1.5 * SR)] = 0.95;                                      // one under her words
  const pcm = new Float32Array(Math.round(1.15 * SR));
  for (let i = Math.round(0.15 * SR); i < pcm.length; i++) pcm[i] = 0.8 * Math.sin((2 * Math.PI * 300 * i) / SR);
  const mix = V.mixVoice({ L, R }, [{ id: 'x', at: 1.0, len: 0.8, onset: 0.15, pcm }], { hits: [], breaths: [] });
  assert.ok(mix.limiter.under > 0, 'her loud voice over loud music: the limiter at work');
  for (let i = 0; i < n; i++) {
    for (const [out, src] of [[mix.L, L], [mix.R, R]]) {
      assert.ok(Math.abs(out[i]) <= Math.max(V.DUCK.ceiling, Math.abs(src[i])) + 1e-6, `${i}: ${out[i]}`);
    }
  }
  assert.equal(mix.L[Math.round(0.3 * SR)], Math.fround(0.95), 'the music\'s own peak as it was');
  assert.equal(mix.R[Math.round(0.3 * SR)], Math.fround(-0.95));
  assert.ok(V.DUCK.ceiling < 0.89, 'under the music\'s own ceiling (music.js: 0.89)');
});

test('her voice, mixed with truePeak (the roadmap\'s video): its true peak under the ceiling where she is, between the samples too; off by default', () => {
  // a true-peak meter of the test's own (8× oversampled, a windowed sinc 32 samples each side): the biggest |value| on and
  // between the samples from a to b
  const truePeak = (x, a, b) => {
    let m = 0;
    for (let j = a; j < b; j++) {
      m = Math.max(m, Math.abs(x[j]));
      for (let q = 1; q < 8; q++) {
        let s = 0, sum = 0;
        for (let k = -31; k <= 32; k++) {
          const d = q / 8 - k, i = j + k;
          const w = (Math.sin(Math.PI * d) / (Math.PI * d)) * 0.5 * (1 + Math.cos((Math.PI * d) / 32.5));
          sum += w;
          if (i >= 0 && i < x.length) s += x[i] * w;
        }
        m = Math.max(m, Math.abs(s / sum));
      }
    }
    return m;
  };
  // between the samples (the limiter's look): a tone at a quarter of the rate, an eighth of a turn off its peaks, shows its
  // samples at 0.707 of its height; between them it reaches its full height. A steady level stays that level
  for (const w of V.TP_KERNELS) assert.ok(Math.abs(w.reduce((s, v) => s + v, 0) - 1) < 1e-12);
  const q = Float32Array.from({ length: 4800 }, (_, i) => Math.sin((Math.PI / 2) * i + Math.PI / 4));
  const bq = V.betweenPeaks(q);
  assert.ok(Math.max(...q.subarray(100, 4700).map(Math.abs)) < 0.708, 'its samples: 0.707');
  assert.ok(Math.abs(Math.max(...bq.subarray(100, 4700)) - 1) < 0.01, `between them: ${Math.max(...bq.subarray(100, 4700))}`);
  assert.ok(V.betweenPeaks(new Float32Array(400).fill(0.5)).subarray(20, 380).every((v) => Math.abs(v - 0.5) < 1e-6));
  // her line: that tone at 1.15 (its samples at 0.81, under the ceiling; its true peak 1.15, far over it) over quiet music,
  // for her words' 0.8 s (then her take's quiet), the music's own peak far from her
  const n = 3 * SR;
  const L = sine(n, 1000, 0.05), R = sine(n, 1000, 0.05);
  L[Math.round(0.3 * SR)] = 0.95;
  const pcm = new Float32Array(Math.round(1.15 * SR));
  for (let i = Math.round(0.15 * SR); i < Math.round(0.95 * SR); i++) pcm[i] = 1.15 * Math.sin((Math.PI / 2) * i + Math.PI / 4);
  const line = [{ id: 'x', at: 1.0, len: 0.8, onset: 0.15, pcm }];
  const her = [Math.round(0.8 * SR), Math.round(2.4 * SR)];
  // off by default (AGI Studio's launch video stays exactly as it is): its samples under the ceiling, nothing held, its
  // true peak over it
  assert.equal(V.DUCK.truePeak, false);
  const plain = V.mixVoice({ L, R }, line, { hits: [], breaths: [] });
  assert.equal(plain.limiter.under, 0, 'no sample over the ceiling');
  assert.ok(truePeak(plain.L, ...her) > V.DUCK.ceiling + 0.1, `its true peak, without: ${truePeak(plain.L, ...her)}`);
  // with truePeak: held, its true peak under the ceiling (as a true-peak meter reads it), the music exactly as it was
  // before her dip and after it, and the music's own peak as it was
  const mix = V.mixVoice({ L, R }, line, { hits: [], breaths: [], truePeak: true });
  assert.ok(mix.limiter.under > 0, 'the limiter at work');
  for (const ch of [mix.L, mix.R]) {
    const tp = truePeak(ch, ...her);
    assert.ok(tp <= V.DUCK.ceiling * 1.003, `its true peak, with: ${tp} (${V.DUCK.ceiling})`);
  }
  const plan = V.planDucks([{ id: 'x', at: 1.0, len: 0.8 }], { hits: [], breaths: [] })[0];
  const a0 = Math.floor(plan.a0 * SR) - 1, r1 = Math.ceil(plan.r1 * SR) + 1;
  for (let i = 0; i < n; i++) {
    if (i >= a0 && i <= r1) continue;
    assert.equal(mix.L[i], L[i], `${i}: the music as it was`);
    assert.equal(mix.R[i], R[i]);
  }
  assert.equal(mix.L[Math.round(0.3 * SR)], Math.fround(0.95), 'the music\'s own peak as it was');
  // the same every time
  const again = V.mixVoice({ L, R }, line, { hits: [], breaths: [], truePeak: true });
  assert.ok(again.L.every((x, i) => x === mix.L[i]) && again.R.every((x, i) => x === mix.R[i]));
});

test('her voice, planned: a hit under her words, a breath, a hit too close or two lines too close are said', () => {
  const plan = (lines, hits = [], breaths = []) => V.planDucks(lines, { hits, breaths });
  const one = { id: 'a', at: 2, len: 1 };
  assert.deepEqual(plan([one])[0].problems, []);
  const p = plan([one])[0];
  assert.ok(Math.abs(p.a0 - 1.8) < 1e-9 && Math.abs(p.a1 - 1.96) < 1e-9 && Math.abs(p.r0 - 3.06) < 1e-9 && Math.abs(p.r1 - 3.56) < 1e-9);
  assert.match(plan([one], [2.5])[0].problems.join(), /a hit under her words \(2\.5\)/);
  assert.match(plan([one], [], [[2.8, 3.2]])[0].problems.join(), /her words in a breath \(2\.8\)/);
  assert.match(plan([one], [1.93])[0].problems.join(), /a hit too close before her first word/);
  assert.match(plan([one], [3.02])[0].problems.join(), /a hit or a breath too close after her last word/);
  assert.match(plan([one, { id: 'b', at: 3.05, len: 1 }])[1].problems.join(), /too close after "a"/);
  assert.match(plan([{ ...one, over: [3.5] }], [3.5])[0].problems.join(), /a hit she speaks over isn't under her words \(3\.5\)/);
  assert.deepEqual(plan([{ ...one, over: [2.5] }], [2.5])[0].problems, [], 'a hit she speaks over');
  // a hit just after her last word: the music back up 10 ms before it
  const after = plan([one], [3.4])[0];
  assert.deepEqual(after.problems, []);
  assert.ok(Math.abs(after.r1 - 3.39) < 1e-9);
  assert.deepEqual(V.hitsOf([{ name: 'impact', t: 2 }, { name: 'kick', t: 1 }, { name: 'crash', t: 2 }, { name: 'crash', t: 0.5 }]), [0.5, 2]);
});

test('her takes, made ready: trimmed around her words (a soft first sound kept), a long pause shortened, her loudness set, her peaks held', () => {
  const R24 = 24000;
  const take = new Float32Array(Math.round(2.6 * R24));
  const rnd = noise(3);
  for (let i = 0; i < take.length; i++) take[i] = 1e-4 * rnd();   // the room's quiet
  const put = (t0, t1, fn) => { for (let i = Math.round(t0 * R24); i < Math.round(t1 * R24); i++) take[i] += fn(i / R24); };
  put(0.42, 0.5, () => 0.004 * rnd());                            // a soft "sh" before her first word
  const voiced = (t) => 0.3 * (0.25 * Math.sin(2 * Math.PI * 220 * t) + 0.1 * Math.sin(2 * Math.PI * 440 * t) + 0.05 * Math.sin(2 * Math.PI * 660 * t));
  put(0.5, 1.1, voiced);                                           // her words…
  put(1.7, 2.1, voiced);                                           // …after a long pause (0.6 s)
  put(0.8, 0.8005, () => 0.6);                                     // a click, far louder than her words
  const r = V.readyLine(V.wav16([take], R24));
  assert.equal(r.rate, SR);
  assert.ok(Math.abs(r.from - 0.42) < 0.011, `its first sound, the "sh" (${r.from})`);
  assert.ok(Math.abs(r.soft[0] - 0.08) < 0.011, `${r.soft}`);
  assert.ok(Math.abs(r.onset - 0.15) < 1e-4, `kept before it: ${r.onset}`);
  assert.equal(r.pauses.length, 1);
  assert.ok(r.pauses[0].was > 0.56 && r.pauses[0].was < 0.61 && r.pauses[0].now === V.LINE.maxPause, JSON.stringify(r.pauses));
  assert.ok(Math.abs(r.len - (2.1 - 0.42 - (r.pauses[0].was - V.LINE.maxPause))) < 0.025, `her words last ${r.len} s`);
  assert.ok(Math.abs(r.pcm.length / SR - (r.len + V.LINE.pre + V.LINE.post)) < 0.001, 'kept after her last word too');
  assert.ok(Math.abs(r.lufs - V.LINE.lufs) < 0.06 && Math.abs(V.loudness([r.pcm, r.pcm]) - V.LINE.lufs) < 0.06, `${r.lufs} LUFS`);
  assert.ok(r.gain > 5, `louder: ${r.gain} dB`);
  assert.ok(r.peak <= V.LINE.peak + 0.01, `her peaks held: ${r.peak} dBFS`);
  // without holding her peaks, the click would be over full scale
  const free = V.readyLine(V.wav16([take], R24), { peak: null });
  assert.ok(free.peak > 0, `${free.peak}`);
  assert.ok(Math.abs(free.len - r.len) < 1e-9 && Math.abs(free.lufs - V.LINE.lufs) < 0.06);
  // a take in two channels: the same line
  const st = V.readyLine(V.wav16([take, take], R24));
  assert.ok(Math.abs(st.len - r.len) < 1e-9 && Math.abs(st.lufs - r.lufs) < 0.02 && Math.abs(st.from - r.from) < 1e-9);
  // a take with no voice in it
  assert.throws(() => V.readyLine(V.wav16([Float32Array.from({ length: SR }, () => 1e-4 * rnd())])), /no voice in this take/);
});

test('her voice\'s maths: loudness (BS.1770: a full-scale 997 Hz sine in one channel is -3.01 LUFS), another rate, WAV files', () => {
  const n = 3 * SR;
  const s = sine(n, 997, 1), zero = new Float32Array(n);
  assert.ok(Math.abs(V.loudness([s, zero]) + 3.01) < 0.03, `${V.loudness([s, zero])}`);
  assert.ok(Math.abs(V.loudness([s, s])) < 0.03);
  const quiet = sine(n, 997, 0.1);
  assert.ok(Math.abs(V.loudness([quiet, quiet]) + 20) < 0.03);
  assert.equal(V.loudness([zero, zero]), -Infinity);
  assert.throws(() => V.loudness([s], 44100), /48 kHz/);
  // another rate: a 1 kHz sine stays one, at its level
  for (const from of [24000, 44100]) {
    const x = sine(from, 1000, 0.5, from);
    const y = V.resample(x, from, SR);
    assert.equal(y.length, Math.floor(x.length / (from / SR)));
    let worst = 0;
    for (let k = Math.round(0.1 * SR); k < Math.round(0.9 * SR); k++) worst = Math.max(worst, Math.abs(y[k] - 0.5 * Math.sin((2 * Math.PI * 1000 * k) / SR)));
    assert.ok(worst < 2e-3, `${from}: ${worst}`);
  }
  assert.deepEqual(V.resample(Float32Array.from([0.1, 0.2]), SR, SR), Float32Array.from([0.1, 0.2]));
  // WAV files: 16-bit samples come back exactly (the music's, outside her dips, never changed), 24-bit and float read
  const vals = Float32Array.from([0, 1, -1, 0.5, -0.25, 12345 / 32767]);
  const back = V.readWav(V.wav16([vals, vals], 22050));
  assert.equal(back.rate, 22050);
  assert.equal(back.channels.length, 2);
  assert.deepEqual(V.wav16(back.channels, 22050), V.wav16([vals, vals], 22050));
  const wavOf = (format, bits, values) => {
    const bytes = bits / 8, data = Buffer.alloc(values.length * bytes);
    values.forEach((v, i) => {
      if (format === 3) data.writeFloatLE(v, i * 4);
      else data.writeIntLE(Math.round(v * 8388607), i * 3, 3);
    });
    const h = Buffer.alloc(44);
    h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16);
    h.writeUInt16LE(format, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * bytes, 28);
    h.writeUInt16LE(bytes, 32); h.writeUInt16LE(bits, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
    return Buffer.concat([h, data]);
  };
  assert.deepEqual([...V.readWav(wavOf(3, 32, [0.5, -0.75])).channels[0]], [0.5, -0.75]);
  const t24 = V.readWav(wavOf(1, 24, [0.5, -0.25])).channels[0];
  assert.ok(Math.abs(t24[0] - 0.5) < 1e-6 && Math.abs(t24[1] + 0.25) < 1e-6);
  assert.throws(() => V.readWav(Buffer.from('not a wav file at all')), /not a WAV file/);
});

test('make.mjs: her lines as media.mjs made them ready, where timeline.js puts them; a take that doesn\'t fit its place is said', () => {
  assert.equal(LEN_SLACK, 0.15);
  const dir = mkdtempSync(join(tmpdir(), 'studio-promo-voice-'));
  try {
    assert.throws(() => voiceLines(dir), /her line "meet" isn't made ready: node tools\/studio-promo\/media\.mjs --only voice/);
    mkdirSync(join(dir, 'voice'));
    const index = { voice: {} };
    const save = () => writeFileSync(join(dir, 'index.json'), JSON.stringify(index));
    for (const l of PLACES) {
      writeFileSync(join(dir, 'voice', `${l.id}.wav`), V.wav16([sine(Math.round((l.len + 0.35) * SR), 300, 0.1)]));
      index.voice[l.id] = { onset: 0.15, len: l.len };
    }
    save();
    const lines = voiceLines(dir);
    assert.deepEqual(lines.map((l) => l.id), PLACES.map((l) => l.id));
    lines.forEach((l, k) => {
      assert.equal(l.at, PLACES[k].at);
      assert.equal(l.len, PLACES[k].len);
      assert.equal(l.onset, 0.15);
      assert.deepEqual(l.over, PLACES[k].over);
      assert.ok(l.pcm instanceof Float32Array && l.pcm.length === Math.round((PLACES[k].len + 0.35) * SR));
    });
    // a take's words a little longer: mixed as long as they last; much longer: its place is checked again first
    const move = PLACES.find((l) => l.id === 'move');
    index.voice.move.len = +(move.len + 0.1).toFixed(2); save();
    assert.equal(voiceLines(dir).find((l) => l.id === 'move').len, index.voice.move.len);
    index.voice.move.len = +(move.len + LEN_SLACK + 0.05).toFixed(2); save();
    assert.throws(() => voiceLines(dir), /her take of "move" lasts [\d.]+ s, and its place in timeline\.js \(VOICE\) was made for [\d.]+ s: check where it goes/);
    index.voice.move.len = move.len; save();
    // not as media.mjs makes it: two channels, or another rate
    writeFileSync(join(dir, 'voice', 'meet.wav'), V.wav16([sine(SR, 300, 0.1), sine(SR, 300, 0.1)]));
    assert.throws(() => voiceLines(dir), /her line "meet" isn't as media\.mjs makes it/);
    writeFileSync(join(dir, 'voice', 'meet.wav'), V.wav16([sine(SR, 300, 0.1)], 44100));
    assert.throws(() => voiceLines(dir), /her line "meet" isn't as media\.mjs makes it/);
    writeFileSync(join(dir, 'voice', 'meet.wav'), V.wav16([sine(SR, 300, 0.1)]));
    rmSync(join(dir, 'voice', 'live.wav'));
    assert.throws(() => voiceLines(dir), /her line "live" isn't made ready/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0 && spawnSync('ffprobe', ['-version']).status === 0;
test('make.mjs --sound-only: each video keeps its pictures exactly (copied), gets the soundtrack, and the first time keeps its music-only copy (ffmpeg, where it\'s there)', { skip: !hasFfmpeg }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'studio-promo-sound-'));
  const empty = mkdtempSync(join(tmpdir(), 'studio-promo-none-'));
  try {
    const make = (f) => spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=64x36:rate=30:duration=1', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=1', '-c:v', 'mpeg4', '-q:v', '5', '-c:a', 'aac', '-shortest', join(dir, f)]).status;
    assert.equal(make('agi-studio-launch.mp4'), 0);
    assert.equal(make('agi-studio-launch-light.mp4'), 0);
    const orig = readFileSync(join(dir, 'agi-studio-launch.mp4')), origLight = readFileSync(join(dir, 'agi-studio-launch-light.mp4'));
    const sha = (b) => createHash('sha256').update(b).digest('hex');
    const hash = (f) => spawnSync('ffmpeg', ['-v', 'error', '-i', join(dir, f), '-map', '0:v', '-c', 'copy', '-f', 'streamhash', '-hash', 'sha256', '-']).stdout.toString().trim();
    const sound = (f) => { const b = spawnSync('ffmpeg', ['-v', 'error', '-i', join(dir, f), '-map', '0:a', '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1e8 }).stdout; return new Float32Array(b.buffer, b.byteOffset, b.length / 4); };
    const probe = (f) => JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', join(dir, f)]).stdout.toString());
    const track = join(dir, 'soundtrack.wav');
    const a = { name: 'agi-studio-launch', outDir: dir };
    for (const hz of [880, 660]) {
      // a soundtrack longer than the videos: each stays as long as its pictures
      writeFileSync(track, V.wav16([sine(1.5 * SR, hz, 0.3), sine(1.5 * SR, hz, 0.3)]));
      await soundOnly(a, { file: track });
      // the videos as they were, kept (the first time; never again after it). By their hashes: a failed deepEqual of two
      // videos would try to print both
      assert.equal(sha(readFileSync(join(dir, 'agi-studio-launch-music-only.mp4'))), sha(orig), 'the video as it was');
      assert.equal(sha(readFileSync(join(dir, 'agi-studio-launch-light-music-only.mp4'))), sha(origLight), 'its light copy as it was');
      for (const base of ['agi-studio-launch', 'agi-studio-launch-light']) {
        const h = hash(`${base}.mp4`);
        assert.match(h, /SHA256=[0-9a-f]{64}/);
        assert.equal(h, hash(`${base}-music-only.mp4`), `${base}: its pictures exactly as they were`);
        const p = probe(`${base}.mp4`), au = p.streams.find((s) => s.codec_type === 'audio');
        assert.equal(au.codec_name, 'aac');
        assert.equal(+au.sample_rate, SR);
        assert.equal(au.channels, 2);
        assert.ok(Math.abs(+p.format.duration - 1) < 0.05, p.format.duration);
        const x = sound(`${base}.mp4`), A = Math.round(0.2 * SR), B = Math.round(0.8 * SR);
        assert.ok(toneAmp(x, hz, A, B) > 0.25 && toneAmp(x, 440, A, B) < 0.01, `${base}: its sound the soundtrack's (${hz} Hz)`);
      }
    }
    await assert.rejects(soundOnly({ name: 'agi-studio-launch', outDir: empty }, { file: track }), /no video in .* to give its sound to: make it first/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(empty, { recursive: true, force: true });
  }
});

test('her voice over the music, rendered (STUDIO_PROMO_RENDER=1): every line where it goes, the music exactly as it was everywhere else, never over its ceiling', { skip: !process.env.STUDIO_PROMO_RENDER }, () => {
  const wav = renderMusic();
  const { channels: [L, R] } = V.readWav(wav);
  // stand-in takes: each line's words as long as its place, a little quiet before and after them
  const lines = PLACES.map((l, k) => {
    const pcm = new Float32Array(Math.round((0.15 + l.len + 0.2) * SR));
    for (let i = Math.round(0.15 * SR); i < Math.round((0.15 + l.len) * SR); i++) pcm[i] = 0.25 * Math.sin((2 * Math.PI * (200 + 10 * k) * i) / SR);
    return { id: l.id, at: l.at, len: l.len, onset: 0.15, pcm, over: l.over };
  });
  const mix = V.mixVoice({ L, R }, lines, { hits: V.hitsOf(musicPlan()), breaths: BREATHS });
  for (const r of mix.report) assert.ok(r.duck >= V.DUCK.min && r.duck <= V.DUCK.max, `${r.id}: ${r.duck}`);
  const back = V.readWav(V.wav16([mix.L, mix.R]));
  let outside = 0, over = 0;
  for (let i = 0; i < L.length; i++) {
    const t = i / SR;
    const same = back.channels[0][i] === L[i] && back.channels[1][i] === R[i];
    if (!same && !mix.report.some((r) => t >= r.a0 - 1 / SR && t < r.r1 + 1 / SR)) outside++;
    if (Math.abs(mix.L[i]) > Math.max(V.DUCK.ceiling, Math.abs(L[i])) + 1e-6 || Math.abs(mix.R[i]) > Math.max(V.DUCK.ceiling, Math.abs(R[i])) + 1e-6) over++;
  }
  assert.equal(outside, 0, 'the music exactly as it was outside her dips (as the WAV file keeps it)');
  assert.equal(over, 0, 'never over the ceiling');
});
