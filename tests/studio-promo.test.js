// AGI Studio's launch video (2026-10-13, tools/studio-promo/: the owner's "go make a promotional marketing launch video of
// AGI studio. all the features there, do it with top notch motion design and easy to understand and visible make it 4:3
// video", then the same day "i just decided can you make the launch video 16:9": 1920 × 1080). Its words hold the site's
// rules (never an AI service's name, never "buy": credits are topped up, PG-13, only $AGI, "not financial advice"
// wherever money comes up, AI-generated said on every frame from the hook's reveal to the end card), its words and
// numbers are AGI Studio's own (imported from src/studio, and checked here against it), AGI-1 is never in 3D (its 3D
// model scene shows Juno's own 3D model, made for it, labeled "AI-generated"), and the picture and the music keep one
// clock.
// No browser or ffmpeg here, and never its pictures and clips (tools/studio-promo/media: big, made once, never in git).
// STUDIO_PROMO_RENDER=1 also renders the whole music (about 15 s).
// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { request } from 'node:http';
import * as W from '../tools/studio-promo/words.js';
import { SCENES, TOTAL, MOMENTS as M, BAR, BEAT, at, sceneAt, sceneOf } from '../tools/studio-promo/timeline.js';
import { musicPlan, renderMusic, RATE, SECTIONS, sectionAt, letterTimes, countTicks, BREATHS } from '../tools/studio-promo/music.js';
import { TRANSITIONS } from '../tools/studio-promo/page/cuts.js';
import { withoutSecrets, serve, args, COVER_AT } from '../tools/studio-promo/make.mjs';
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
  assert.deepEqual(args([]), { out: 'studio-promo', fps: 60, scale: 1, from: 0, to: TOTAL, stills: null, sheet: null, music: true, crf: 18, name: 'agi-studio-launch', quality: 0.95, light: 0 });
  assert.equal(args(['--light', '27', '--scale', '0.5']).light, 27);
  assert.throws(() => args(['--nope']), /unknown option/);
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
