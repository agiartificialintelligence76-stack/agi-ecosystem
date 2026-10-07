// Her live show's trips (2026-10-07, the owner: "add more outfits and rooms, (real places in real life) like new york, famous
// landmarks around the world … she can also change outfit based on that place, you can put vehicles also like robotaxi … she
// can ride the vehicles as well and go to places. and meet random people talk to them what the chat said … she can eat food
// in the stream, alot of types of food. go to moon, mars. and add more emotions", then "you remember the 16 languages she can
// speak she also speaks that in the stream, with places connected it also", "can you add weathers also", and "on the
// beginning of the stream … make it interactive already … and background sounds can also be changed based on the event"):
// her places and their lists against the site's, her vehicles, the people she meets and their voices, her food, the
// weather, her emotions, her lines for all of it (her greetings in the language people speak there), her trips' choices, the
// sounds around her (made in code) and the stream's mixer, the start of her show, her set's page. No network, no browser,
// no ffmpeg here: the real show was recorded end to end on Claude's computer (CLAUDE.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DESTINATIONS, DESTINATION_IDS, FOODS, FOOD_IDS, WEATHERS, WEATHER_IDS, PEOPLE, PEOPLE_IDS, LOCAL, EMOTIONS, EMOTION_IDS, FEEL_IDS, OUTFITS,
  ACT_IDS, COOLDOWN, actOf, actsPrompt } from '../server/live-acts.js';
import { sceneOf, meetAnswer, SCENE_CHAT } from '../server/live.js';
import { PLACES, PLACE_IDS, TRAVEL } from '../tools/live/page/places.js';
import { VEHICLES, VEHICLE_IDS, rideMotion } from '../tools/live/page/vehicles.js';
import { PEOPLE as NPC, PEOPLE_IDS as NPC_IDS } from '../tools/live/page/people.js';
import { FOODS as FOOD_DEFS, FOOD_IDS as FOOD_DEF_IDS, FOOD_SCALE } from '../tools/live/page/food.js';
import { WEATHERS as WX, WEATHER_IDS as WX_IDS } from '../tools/live/page/weather.js';
import { ACTIONS, createMoves } from '../tools/live/page/moves.js';
import { OUTFITS as LOOKS, OUTFIT_IDS, PLACE_OUTFITS, SHOW_OUTFITS, EMOTES } from '../tools/live/page/outfits.js';
import * as T from '../tools/live/trips.js';
import * as L from '../tools/live/lines.js';
import { LANGS } from '../src/i18n/langs.js';
import { loop, shot, LOOP_IDS, SHOT_IDS, LOOP_GAIN, RATE as AMB_RATE } from '../tools/live/ambience.js';
import { Mixer, OUT_RATE, parseArgs } from '../tools/live/run.mjs';
import { createActs, DOES } from '../tools/live/acts.js';
import { EXTRA_IDS } from '../tools/live/show.js';
import { createVoice, promptFor } from '../tools/live/voice.js';
import { liveSite, demoSite, DEMO_QA } from '../tools/live/site.js';
import { isCrude } from '../server/coins.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const CODES = LANGS.map((x) => x.code);

// ---------- her places, vehicles, people, food, weather: the site's lists and her set's ----------
test('her places: the site\'s list and her set\'s the same; each with its outfit, its vehicle, its foods, its weather, someone to meet, the language people speak there', () => {
  assert.deepEqual([...PLACE_IDS].sort(), [...DESTINATION_IDS].sort());
  for (const want of ['newyork', 'paris', 'tokyo', 'moon', 'mars']) assert.ok(PLACES[want], want);
  for (const id of PLACE_IDS) {
    const p = PLACES[id];
    assert.ok(p.name && p.country && typeof p.draw === 'function' && Array.isArray(p.ambient), id);
    assert.ok(LOOKS[p.outfit] && PLACE_OUTFITS.includes(p.outfit), `${id}: its outfit`);
    assert.ok(VEHICLES[p.vehicle], `${id}: its vehicle`);
    assert.ok(p.foods.length && p.foods.every((f) => FOODS[f]), `${id}: its foods`);
    assert.ok(p.weather.length && p.weather.every((w) => WEATHERS[w]), `${id}: its weather`);
    assert.ok(PEOPLE[p.person]?.at === id, `${id}: someone to meet there`);
    // the language people speak there: one of her 16 (null: none of hers, like Italian in Rome)
    assert.ok(p.lang === null || CODES.includes(p.lang), `${id}: ${p.lang}`);
    if (LOCAL[id]) assert.ok(p.lang === null || LANGS.find((x) => x.code === p.lang).name.startsWith(LOCAL[id]) || id === 'rome', `${id}: ${LOCAL[id]}`);
    // her prompt's words for it: PG-13, only $AGI, no money words
    assert.ok(!isCrude(DESTINATIONS[id]));
    assert.doesNotMatch(DESTINATIONS[id], /\$(?!AGI)\w|\b(buy|sell|pump)\b/i);
  }
  // the Moon and Mars: by rocket, in her space suit
  for (const id of ['moon', 'mars']) assert.deepEqual([PLACES[id].vehicle, PLACES[id].outfit], ['rocket', 'space']);
  // her outfits: her show's and her places', the same on both sides, a line for each
  assert.deepEqual(Object.keys(OUTFITS).sort(), [...OUTFIT_IDS].sort());
  for (const id of [...SHOW_OUTFITS, ...PLACE_OUTFITS]) assert.ok(L.OUTFIT_LINES[id], `a line for ${id}`);
  // only colors and an accessory: never less of her clothes (PG-13)
  for (const id of PLACE_OUTFITS) for (const k of Object.keys(LOOKS[id])) assert.ok(['name', 'shirt', 'shorts', 'shoes', 'acc', 'colors'].includes(k), `${id}: ${k}`);
});

test('her vehicles: what each is called and how it travels (its sounds and lines on the way, the scene drawn on the way until its inside is painted), and how a ride moves: small and smooth', () => {
  assert.ok(VEHICLE_IDS.includes('robotaxi'), 'the owner\'s robotaxi');
  for (const id of VEHICLE_IDS) {
    const v = VEHICLES[id];
    assert.ok(v.name && TRAVEL[v.kind], `${id}: a name, and its scene on the way (${v.kind})`);
    assert.ok(T.ICON[id], id);
  }
  // (2026-10-07, her painted set) she rides inside it: the picture behind her and her move together, like a camera riding
  // along: never more than a few pixels or a degree, and smooth (a train's rail joints the only small knock)
  for (const kind of Object.keys(TRAVEL)) {
    let last = rideMotion(kind, 0), most = 0;
    for (let t = 1 / 30; t < 20; t += 1 / 30) {
      const m = rideMotion(kind, t);
      assert.ok(Math.abs(m.x) <= 6 && Math.abs(m.y) <= 6 && Math.abs(m.r) <= 1, `${kind} at ${t.toFixed(2)} s: ${JSON.stringify(m)}`);
      most = Math.max(most, Math.hypot(m.x - last.x, m.y - last.y));
      last = m;
    }
    assert.ok(most <= (kind === 'space' ? 3 : 2.5), `${kind}: ${most.toFixed(2)} px from one frame to the next at most`);
    assert.ok(Object.values(rideMotion(kind, 3.3)).some((x) => Math.abs(x) > 0.05), `${kind}: it moves`);
  }
  // no brands or logos
  const src = read('tools/live/page/vehicles.js');
  assert.doesNotMatch(src, /\b(uber|lyft|waymo|tesla|boeing|airbus|spacex|nasa)\b/i);
});

test('the people she meets: made-up characters of her show (never real people), the same on both sides, each where a place is, a voice of their own (never hers)', () => {
  assert.deepEqual([...NPC_IDS].sort(), [...PEOPLE_IDS].sort());
  const voices = new Set();
  for (const id of PEOPLE_IDS) {
    assert.ok(DESTINATIONS[PEOPLE[id].at] || PEOPLE[id].at === 'cafe', `${id}: ${PEOPLE[id].at}`);
    assert.match(PEOPLE[id].who, /^[A-Z]/);
    const v = NPC[id].voice;
    assert.match(v.name, /^[A-Z][a-z]+$/, `${id}: one of Google's ready-made voices`);
    assert.notEqual(v.name, 'Despina', `${id}: never hers`);
    assert.ok(v.who && v.style, id);
    voices.add(v.name);
  }
  assert.ok(voices.size >= PEOPLE_IDS.length - 1, 'nearly everyone sounds different');
  assert.equal(T.personAt('cafe'), 'mika');
  for (const id of PLACE_IDS) assert.equal(T.personAt(id), PLACES[id].person);
});

test('her food and the weather: the same on both sides; drinks sipped, the rest bitten; her umbrella in the rain', () => {
  assert.deepEqual([...FOOD_DEF_IDS].sort(), [...FOOD_IDS].sort());
  assert.ok(FOOD_IDS.length >= 30, 'a lot of types of food (the owner)');
  for (const id of FOOD_IDS) assert.equal(typeof FOOD_DEFS[id].draw, 'function', id);
  assert.deepEqual(FOOD_IDS.filter((id) => FOOD_DEFS[id].drink).sort(), ['boba', 'coconut']);
  assert.deepEqual([...WX_IDS].sort(), [...WEATHER_IDS].sort());
  assert.deepEqual(WX_IDS.filter((id) => WX[id].umbrella).sort(), ['rain', 'storm']);
  for (const id of WEATHER_IDS) assert.ok(T.WEATHER_LINES[id], id);
  // outside: the rooftop, or the beach for sunshine and a rainbow
  assert.equal(T.roomForWeather('snow'), 'rooftop');
  assert.equal(T.roomForWeather('rainbow'), 'beach');
  // (her first trip recording: three dates as big as her palm) small things smaller in her hand, never bigger than drawn
  for (const [id, k] of Object.entries(FOOD_SCALE)) assert.ok(FOOD_DEFS[id] && k > 0.5 && k < 1, `${id}: ${k}`);
  for (const id of ['dates', 'strawberry', 'macaron', 'sushi']) assert.ok(FOOD_SCALE[id] <= 0.75, id);
  assert.match(read('tools/live/page/outfits.js'), /S = len \* 1\.55 \* \(FOOD_SCALE\[fid\] \|\| 1\)/);
});

// ---------- her emotions ----------
test('her emotions: each one of her moves with a cartoon mark (on her face or the set), the site\'s list and hers the same, cute and PG-13', () => {
  for (const id of EMOTION_IDS) {
    assert.ok(ACTIONS[id], `her set does "${id}"`);
    assert.deepEqual(DOES[id], { act: id }, id);
    assert.ok(!isCrude(EMOTIONS[id]), id);
    assert.doesNotMatch(EMOTIONS[id], /\b(sexy|seductive|kiss)\b/i, `cute, not suggestive: ${EMOTIONS[id]}`);
  }
  assert.ok(EMOTION_IDS.length >= 15, 'more emotions (the owner)');
  for (const id of FEEL_IDS) assert.ok(ACTIONS[id], `how she can feel saying an answer: ${id}`);
  // each mark one outfits.js draws
  for (const [id, a] of Object.entries(ACTIONS)) if (a.emote) assert.ok(EMOTES.includes(a.emote), `${id}: ${a.emote}`);
  for (const k of EMOTES) assert.ok(Object.values(ACTIONS).some((a) => a.emote === k), `${k} is used`);
  // her mark comes and goes with her move; tears end before her smile
  let t = 0;
  const m = createMoves({ clock: () => t, rnd: () => 0.5 });
  const tg = () => ({ shR: 0, elR: 0, wrR: 0, shL: 0, elL: 0, wrL: 0, ax: 0, ay: 0, az: 0, ex: 0, ey: 0, bx: 0, by: 0, bz: 0, hip: 0 });
  const now = { talking: 0, level: 0 };
  m.act('lovestruck');
  for (let i = 0; i < 30; i++) m.apply(1 / 30, tg(), now);
  assert.equal(m.emote.kind, 'hearts');
  assert.ok(m.emote.w > 0.9);
  for (let i = 0; i < 90; i++) m.apply(1 / 30, tg(), now);
  assert.equal(m.emote, null, 'gone with her move');
  m.act('cry');
  for (let i = 0; i < 90; i++) m.apply(1 / 30, tg(), now);       // 3 s in: her smile
  assert.ok(m.emote.w < 0.05, `her tears dried: ${m.emote.w}`);
});

test('eating: her hand to her mouth twice (a bite each time), chewing, then a happy "mmm"; a drink, two sips; her umbrella keeps her right hand up', () => {
  const fx = [], props = [];
  let t = 0;
  const m = createMoves({ clock: () => t, rnd: () => 0.5, onFx: (k) => fx.push(k), onProp: (p) => props.push(p) });
  const tg = () => ({ shR: 0, elR: 0, wrR: 0, shL: 0, elL: 0, wrL: 0, ax: 0, ay: 0, az: 0, ex: 0, ey: 0, bx: 0, by: 0, bz: 0, hip: 0 });
  const now = { talking: 0, level: 0 };
  m.act('eat');
  assert.equal(props.at(-1), 'food');
  let mouth = 0;
  for (let i = 0; i < 30 * 6; i++) { const face = m.apply(1 / 30, tg(), now); mouth = Math.max(mouth, face.mouth || 0); }
  assert.deepEqual(fx.filter((k) => k === 'bite').length, 2, 'two bites');
  assert.ok(fx.includes('mmm'), 'then "mmm"');
  assert.ok(mouth > 0.3, `her mouth opens for a bite: ${mouth}`);
  assert.equal(props.at(-1), null, 'nothing in her hand after');
  fx.length = 0;
  m.act('drink');
  for (let i = 0; i < 30 * 5; i++) m.apply(1 / 30, tg(), now);
  assert.equal(fx.filter((k) => k === 'bite').length, 2, 'two sips');
  // her umbrella: her right hand up holding it, and it stays through a move that isn't about her hands
  m.carry('umbrella');
  assert.equal(props.at(-1), 'umbrella');
  let pose = null;
  for (let i = 0; i < 20; i++) { pose = tg(); m.apply(1 / 30, pose, now); }
  assert.ok(pose.elR > 140, `her forearm up: ${pose.elR}`);
  m.act('wink');
  for (let i = 0; i < 20; i++) m.apply(1 / 30, tg(), now);
  assert.equal(m.carrying, 'umbrella');
  for (let i = 0; i < 60; i++) m.apply(1 / 30, tg(), now);
  assert.equal(props.at(-1), 'umbrella', 'still in her hand after the wink');
  m.carry(null);
  assert.equal(props.at(-1), null);
  // (her first trip recording: in a plane's window her "think" idle put a "?" by her head, which flew off with the plane)
  // nothing by herself while she rides: no idle move, no wandering; and as soon as she's out, her idles again
  let riding = true;
  const quietMoves = createMoves({ clock: () => t, rnd: () => 0.5, still: () => riding });
  const started = [];
  for (let i = 0; i < 30 * 60; i++) { t += 1000 / 30; quietMoves.apply(1 / 30, tg(), now); if (quietMoves.action) started.push(quietMoves.action); }
  assert.deepEqual(started, [], 'a minute in her seat: nothing by herself');
  assert.equal(quietMoves.figure.x, 0, 'and she stays in her seat');
  riding = false;
  for (let i = 0; i < 30 * 40 && !quietMoves.action; i++) { t += 1000 / 30; quietMoves.apply(1 / 30, tg(), now); }
  assert.ok(quietMoves.action, 'out of it: her idles again');
  assert.match(read('tools/live/page/stage.js'), /still: \(\) => Boolean\(ride \|\| trip\),/);
});

// ---------- her lines ----------
test('her trips\' lines: at every place a greeting in the language people speak there (and what it means), a line for every vehicle, the way, each food, each weather, each person', () => {
  assert.deepEqual(Object.keys(T.PLACE_LINES).sort(), [...PLACE_IDS].sort());
  for (const id of PLACE_IDS) {
    const p = T.PLACE_LINES[id], lang = PLACES[id].lang;
    if (lang && lang !== 'en') {
      assert.equal(p.hello.lang, lang, `${id}: her hello in ${lang}`);
      assert.ok(p.means && !p.means.lang && /that's|means/.test(p.means.text), `${id}: what it means, in English`);
      assert.ok(p.means.text.includes(T.placeLangName(id)), `${id}: ${p.means.text}`);
    } else assert.ok(!p.hello.lang, id);
    assert.ok(p.lines.length >= 2, id);
    assert.ok(T.GO_LINES[id], `${id}: her line as she leaves`);
  }
  // her 16 languages on stream: 14 of them at her places
  assert.ok(new Set(Object.values(T.PLACE_LINES).map((p) => p.hello.lang).filter(Boolean)).size >= 12);
  for (const kind of Object.keys(TRAVEL)) assert.ok(T.TRAVEL_LINES[kind]?.length >= 2, kind);
  for (const id of FOOD_IDS) assert.ok(T.EAT_LINES[id] && T.foodEmoji(id), id);
  for (const id of PEOPLE_IDS) {
    const d = T.MEET_FALLBACK[id];
    assert.ok(d.length >= 3 && d[0].who === 'them', `${id}: them first`);
    for (const x of d) { assert.ok(['them', 'you'].includes(x.who)); assert.ok(!isCrude(x.text)); assert.doesNotMatch(x.text, /\$|\b(buy|sell|price)\b/i, x.text); }
  }
  // every line of hers here is in allLines() (its voice made once and kept: --warm), and held to her rules there
  const all = L.allLines().map((x) => x.text);
  for (const x of T.tripLines()) assert.ok(all.includes(x.text), x.text);
  // the start of her show: what she does, and what to try
  for (const s of T.SHOWCASE) if (s.do) assert.ok(s.do.act === 'jump' || s.do.act === 'eat' || ACTIONS[s.do.act], JSON.stringify(s.do));
  assert.ok(T.SHOWCASE.some((s) => s.card));
  for (const x of [T.TRY_CARD.title, T.TRY_CARD.kicker, ...T.TRY_CARD.list]) assert.ok(x.length <= 60, x);
  assert.ok(T.HINTS.length >= 10);
  for (const h of T.HINTS) { assert.ok(h.length <= 48, `fits the bar: ${h}`); assert.doesNotMatch(h, /\$(?!AGI)|\b(buy|sell|pump)\b/i, h); }
});

test('her trips by herself: a place she hasn\'t been to lately (the Moon and Mars less often), its own vehicle, its food and weather', () => {
  let s = 1;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const visited = [];
  const counts = {};
  for (let i = 0; i < 400; i++) {
    const next = T.nextPlace(visited, visited.at(-1) || null, rnd);
    assert.ok(PLACES[next]);
    assert.ok(!visited.slice(-8).includes(next), `not one of her last 8: ${next}`);
    visited.push(next);
    counts[next] = (counts[next] || 0) + 1;
  }
  assert.ok((counts.moon || 0) < (counts.paris || 0) && (counts.mars || 0) < (counts.tokyo || 0), JSON.stringify(counts));
  for (const id of PLACE_IDS) {
    assert.equal(T.vehicleFor(id), PLACES[id].vehicle);
    assert.ok(PLACES[id].foods.includes(T.foodAt(id, () => 0.5)));
    assert.ok(PLACES[id].weather.includes(T.weatherAt(id, () => 0.5)));
  }
  assert.equal(T.kindFor('rocket'), 'space');
});

// ---------- the sounds around her ----------
test('the sounds around her: a loop for every place, trip and weather that has one, made in code, never loud, kept once made; short sounds for thunder, a whoosh, a pop, a bite, a ding', () => {
  assert.equal(AMB_RATE, OUT_RATE, 'at the stream\'s own rate');
  for (const k of [...Object.values(T.PLACE_SOUND), ...Object.values(T.TRAVEL_SOUND), ...Object.values(T.WEATHER_SOUND)]) assert.ok(LOOP_IDS.includes(k), k);
  for (const kind of Object.keys(TRAVEL)) assert.ok(T.TRAVEL_SOUND[kind], kind);
  for (const id of LOOP_IDS) {
    const b = loop(id);
    assert.ok(b instanceof Float32Array && b.length > OUT_RATE * 5, `${id}: a few seconds`);
    let peak = 0;
    for (const x of b) { assert.ok(Number.isFinite(x)); peak = Math.max(peak, Math.abs(x)); }
    assert.ok(peak <= 0.51 && peak > 0.2, `${id}: ${peak}`);
    assert.ok(LOOP_GAIN[id] > 0 && LOOP_GAIN[id] <= 0.25, `${id}: under her voice and music`);
    assert.equal(loop(id), b, 'made once');
  }
  for (const id of ['thunder', 'whoosh', 'pop', 'crunch', 'ding']) assert.ok(SHOT_IDS.includes(id) && shot(id).length > 1000, id);
  assert.equal(loop('nope'), null);
  // no sound files anywhere: all of it in code
  assert.doesNotMatch(read('tools/live/ambience.js'), /readFile|\.(?:wav|mp3|ogg)\b|fetch\(/);
});

test('the stream\'s mixer with the sounds around her: a loop fades in, crossfades to the next, a little quieter while she talks; a short sound at its time; never past full scale', () => {
  let t = 0;
  const writes = [];
  const mixer = new Mixer((buf) => writes.push(buf), { now: () => t, lead: 0, bed: null });
  mixer.begin(0);
  clearInterval(mixer.timer);
  const pcm = () => Buffer.concat(writes);
  const rms = (s0, s1, ch = 0) => { const b = pcm(); let sum = 0, n = 0; for (let i = Math.round(s0 * OUT_RATE); i < Math.round(s1 * OUT_RATE); i++) { const v = b.readInt16LE((i * 2 + ch) * 2) / 32768; sum += v * v; n++; } return Math.sqrt(sum / n); };
  const a = new Float32Array(OUT_RATE * 2).fill(0.5), b = new Float32Array(OUT_RATE * 2).fill(-0.5);
  mixer.setAmbience('place', a, { gain: 0.2, fade: 1 });
  t = 3000; mixer.pump();
  assert.ok(rms(0, 0.1) < 0.02, `fading in: ${rms(0, 0.1)}`);
  assert.ok(Math.abs(rms(1.5, 2.5) - 0.1) < 0.005, `at its level: ${rms(1.5, 2.5)}`);
  // the next place: a crossfade (the old one out, the new one in)
  mixer.setAmbience('place', b, { gain: 0.2, fade: 1 });
  t = 6000; mixer.pump();
  assert.ok(rms(3.45, 3.55) < 0.03, `crossing: ${rms(3.45, 3.55)}`);
  assert.ok(Math.abs(rms(5, 5.9) - 0.1) < 0.005, `the new one: ${rms(5, 5.9)}`);
  assert.equal(mixer.amb.place.length, 1, 'the old one gone');
  // the same loop again: nothing changes
  mixer.setAmbience('place', b, { gain: 0.2 });
  assert.equal(mixer.amb.place.length, 1);
  // a little quieter while she talks
  mixer.play(new Float32Array(24000 * 3));
  t = 9000; mixer.pump();
  assert.ok(rms(8.5, 8.9) < 0.07 && rms(8.5, 8.9) > 0.05, `under her voice: ${rms(8.5, 8.9)}`);
  // a short sound at its time; silence: the weather layer off
  mixer.setAmbience('place', null, { fade: 0.2 });
  mixer.sfx(new Float32Array(4800).fill(0.4), { at: 10_000 });
  t = 11_000; mixer.pump();
  assert.ok(rms(9.8, 9.95) < 0.01, `nothing before it: ${rms(9.8, 9.95)}`);
  assert.ok(rms(10.0, 10.09) > 0.3, `at its time: ${rms(10.0, 10.09)}`);
  // never past full scale
  mixer.setAmbience('weather', new Float32Array(OUT_RATE).fill(0.9), { gain: 1, fade: 0.01 });
  mixer.play(new Float32Array(24000).fill(0.9));
  t = 12_000; mixer.pump();
  const peak = pcm().readInt16LE(Math.round(11.5 * OUT_RATE) * 4) / 32768;
  assert.ok(peak > 0.9 && peak <= 1, `${peak}`);
  assert.equal(mixer.setAmbience('nope', a), false);
  mixer.end();
});

// ---------- the people she meets: their voices and their conversation ----------
test('their voices: Google\'s ready-made voice and who they are in the request, their own style; kept apart from hers (her kept lines stay kept)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'npcvoice-'));
  const bodies = [];
  const pcm = Buffer.alloc(24000 * 2);
  const fetchFn = async (url, init) => { bodies.push(JSON.parse(init.body)); return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/l16;rate=24000', data: pcm.toString('base64') } }] } }] }) }; };
  try {
    const voice = createVoice({ order: ['vertex'], apiKey: 'k', project: 'p', location: 'global', vertexModel: 'm', voice: 'Despina', cacheDir: dir, timeoutMs: 1000 }, { fetchFn, log: { warn() {} } });
    const rosa = NPC.rosa.voice;
    assert.ok(await voice.speak('want a hot dog?', { voice: rosa, keep: true }));
    let body = bodies.at(-1);
    assert.equal(body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, rosa.name);
    assert.match(body.contents[0].parts[0].text, new RegExp(`Voice: ${rosa.who}, the same voice every time\\. Style: ${rosa.style.replace(/[.()]/g, '\\$&')}`));
    assert.ok(await voice.speak('hi everyone', { mood: 'happy', keep: true }));
    body = bodies.at(-1);
    assert.equal(body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, 'Despina', 'hers');
    assert.match(body.contents[0].parts[0].text, /Voice: a young woman, the same voice every time/);
    // the same words in another voice: another file
    assert.ok(await voice.speak('hi everyone', { voice: rosa, keep: true }));
    assert.equal(readdirSync(dir).filter((f) => f.endsWith('.pcm')).length, 3);
    // a made-up voice name never reaches Google: hers instead
    await voice.speak('hello', { voice: { name: 'x"; drop', who: 'someone' } });
    assert.equal(bodies.at(-1).generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, 'Despina');
    assert.equal(promptFor('a', 'b'), "## DIRECTOR'S NOTES\nVoice: a young woman, the same voice every time. Style: b\n\n## TRANSCRIPT\na", 'her own prompt as it was');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('meeting someone: the site writes their conversation about what her chat asked (checked again, her live rules, every line checked like her answers); the runner\'s call; the demo', async () => {
  assert.equal(sceneOf({ person: 'nobody' }), null);
  const sc = sceneOf({ person: 'yui', chat: ['what is your favorite color?', 'is pepe going to pump?', 'check https://x.y', 'do you like cats?', 'what is up', 'hello there friend'] });
  assert.equal(sc.place, DESTINATIONS.tokyo);
  assert.equal(sc.lang, 'Japanese');
  assert.ok(sc.chat.length <= SCENE_CHAT && !sc.chat.some((q) => /pepe|https/.test(q)), JSON.stringify(sc.chat));
  assert.equal(sceneOf({ person: 'mika' }).place, 'the little café you stream from');
  // their lines: checked like her answers (another coin: never on stream)
  const ok = await meetAnswer({}, { person: 'rosa', chat: [] }, { scene: async () => ({ lines: [{ who: 'them', text: 'hot dog?' }, { who: 'you', text: 'yes please 🌭' }], mood: 'happy' }) });
  assert.deepEqual(ok.lines.length, 2);
  const bad = await meetAnswer({}, { person: 'rosa' }, { scene: async () => ({ lines: [{ who: 'them', text: 'buy some bitcoin' }, { who: 'you', text: 'no' }], mood: 'happy' }) });
  assert.deepEqual(bad, { skip: 'rules' });
  assert.deepEqual(await meetAnswer({}, { person: 'rosa' }, { scene: async () => { throw new Error('down'); } }), { none: true, trouble: 'ai' });
  assert.deepEqual(await meetAnswer({}, { person: 'who?' }), { skip: 'bad' });
  // the runner's call
  const calls = [];
  const site = liveSite({ site: 'https://www.agi1.app', secret: 's'.repeat(40), fetchFn: async (url, init) => { calls.push(JSON.parse(init.body)); return { ok: true, status: 200, json: async () => ({ lines: [] }) }; } });
  await site.meet(7, { person: 'rosa', chat: ['hi there friend'] });
  assert.deepEqual(calls.at(-1), { action: 'meet', show: 7, meet: { person: 'rosa', chat: ['hi there friend'] } });
  await site.next(7, ['trip'], 'paris');
  assert.deepEqual(calls.at(-1), { action: 'next', show: 7, can: ['trip'], place: 'paris' });
  assert.deepEqual(await demoSite().meet(), { none: true }, 'the demo: their own few words');
});

// ---------- her requests, her extras, the runner ----------
test('viewers\' requests for her trips: a place, a snack, the weather, someone to meet (only where she\'s visiting), each resting a while after', () => {
  for (const id of ['trip', 'eat', 'weather', 'meet']) { assert.ok(ACT_IDS.includes(id), id); assert.ok(COOLDOWN[id] > 0, id); }
  const can = ['trip', 'eat', 'weather', 'meet'];
  assert.deepEqual(actOf({ act: 'trip', to: 'mars' }, can), { act: 'trip', to: 'mars' });
  assert.deepEqual(actOf({ act: 'trip', to: 'atlantis' }, can), { act: 'trip', to: null }, 'a place that isn\'t hers: her stream picks one');
  assert.deepEqual(actOf({ act: 'eat', to: 'sushi' }, can), { act: 'eat', to: 'sushi' });
  assert.deepEqual(actOf({ act: 'weather', to: 'snow' }, can), { act: 'weather', to: 'snow' });
  assert.deepEqual(actOf({ act: 'meet' }, can), { act: 'meet' });
  assert.deepEqual(actOf({ act: 'lovestruck' }, ['lovestruck']), { act: 'lovestruck' });
  const p = actsPrompt(can);
  for (const must of [/The places \("to"\): newyork, london/, /moon, mars/, /Your foods \("to"\): cookie/, /The weathers \("to"\): rain/]) assert.match(p, must);
  // someone to meet: only where she's visiting
  let there = false;
  const acts = createActs({ meet: () => there });
  assert.ok(!acts.can().includes('meet'));
  there = true;
  assert.ok(acts.can().includes('meet'));
  acts.take({ act: 'meet' });
  assert.ok(!acts.can().includes('meet'), 'rests after');
  // her extras: a snack, the weather, someone she meets; her trips on their own clock (--try trip on a recording)
  for (const id of ['eat', 'weather', 'meet']) assert.ok(EXTRA_IDS.includes(id), id);
  assert.deepEqual(parseArgs(['--try', 'trip,eat,weather,meet', '--record', 'x.mp4']).tryExtras, ['trip', 'eat', 'weather', 'meet']);
  assert.throws(() => parseArgs(['--try', 'fly']), /--try/);
  // the demo asks for them too (and once in another language)
  for (const want of ['trip', 'eat', 'weather', 'lovestruck']) assert.ok(DEMO_QA.some((q) => q.act?.act === want), want);
  assert.ok(DEMO_QA.some((q) => q.lang === 'es' && /[¿¡]/.test(q.text)));
});

test('the runner: her trips (a vehicle, the way, her hello in the language there, her outfit for it), someone she meets in their own voice, her snacks with a crunch, the weather outside with its sound, her answers in the question\'s language, the start of her show', () => {
  const src = read('tools/live/run.mjs');
  for (const must of [
    /await studio\('tripGo', \{ vehicle, kind, from, to: PLACES\[to\]\.name/, /await studio\('tripArrive', \{ to \}\)/, /await say\(p\.hello, \{ react: 'wave' \}\)/,
    /if \(p\.means\) await say\(p\.means\)/, /await goOutfit\(PLACES\[to\]\.outfit\)/, /site\.meet\(showId, \{ person, chat: aired\.slice\(-3\) \}\)/,
    /voice\.speak\(ln\.text, \{ voice: v,/, /await studio\('npcSay'/, /sfx\('crunch'/, /await studio\('weather', id\)/, /sfx\('thunder'/,
    /mixer\?\.setAmbience\('weather'/, /surround\(to\)/, /lang\.native/, /act: qa\.feel && !qa\.act \? qa\.feel : null/, /site\.next\(showId, acts\.can\(\), where\.place\)/,
    /for \(const sc of T\.SHOWCASE\)/, /await studio\('card', T\.TRY_CARD\)/, /await studio\('hint', T\.HINTS\)/, /nextTripAt = Date\.now\(\) \+ \(15 \+ Math\.random\(\) \* 5\) \* 60_000/,
  ]) assert.match(src, must);
  // her lines carry their language to her captions
  assert.match(src, /\.\.\.\(line\.lang \? \{ lang: line\.lang \} : \{\}\)/);
  // (her first trip recording: her song from the pyramids left her on the concert stage, then "up to the rooftop" for the
  // rain) her song from a place she's visiting takes her back there, not to a room
  assert.match(src, /const back = \{ room: look\.room, outfit: look\.outfit, place: where\.place, since: where\.since \};/);
  assert.match(src, /if \(back\.place\) await backTo\(back\.place, back\.since\);\s*else await goRoom\(back\.room, \{ line: false \}\);/);
  assert.match(src, /const backTo = async \(id, since = Date\.now\(\)\) => \{[\s\S]*?await studio\('place', id\);\s*where\.place = id; where\.since = since;\s*look\.room = null;\s*surround\(id\);/);
  // (the painted set's first recording: rain on the rooftop, then her song, and she sang on the concert stage holding her
  // umbrella) the weather stops whenever she changes rooms, not only when she leaves a place
  assert.match(src, /const goRoom = async \(id, \{ line = true \} = \{\}\) => \{[\s\S]*?where\.place = null;\s*await stopWeather\(\);\s*sfx\('whoosh'/);
});

// ---------- her set's page ----------
test('her set\'s page: her trips, the people she meets, her food, the weather and what to try on window.studio; nothing new plain and opaque over her picture', () => {
  const js = read('tools/live/page/stage.js');
  for (const fn of ['tripGo', 'tripArrive', 'meet', 'npcSay', 'bye', 'eat', 'weather', 'hint']) assert.match(js, new RegExp(`\\b${fn}\\b[,:]`), fn);
  assert.match(js, /lightning: \(\) => wx\.lightning\(\)/);
  // back at a place (after her song): a wipe, its chip, never while she rides
  assert.match(js, /place: async \(id, o = \{\}\) => \{\s*if \(!PLACES\[id\] \|\| ride\) return false;\s*const draw = await placeDrawer\(id\);[\s\S]*?if \(o\.instant \|\| !fx\) go\(\); else fx\.wipe\(go\);/);
  // (her first trip recording: "Ask me at agi1.app/live" wrapped onto two lines next to the questions waiting) the bar never
  // wraps: the hint gives way, hidden when it doesn't fit (never cut off), checked again when the questions waiting change
  assert.match(js, /function fitHint\(\) \{\s*ui\.hint\.classList\.toggle\('is-cut', Boolean\(ui\.hint\.textContent\) && ui\.hint\.scrollWidth > ui\.hint\.clientWidth \+ 1\);/);
  assert.match(js, /if \(ui\.queue\.textContent !== text\) \{ ui\.queue\.textContent = text; fitHint\(\); \}/);
  // (2026-10-07, her painted set) riding: a wipe into the painting of its inside (loaded and decoded first, so a wipe never
  // uncovers the old picture), the route card; she and the picture behind her move with the ride; a wipe, and she's there
  assert.match(js, /const draw = await rideDrawer\(vehicle, k\);\s*await fx\.wipe\(\(\) => \{[\s\S]*?draw\(\);\s*ride = \{ vehicle, kind: k, t: 0 \};/);
  assert.match(js, /const draw = await placeDrawer\(to\);\s*await fx\.wipe\(\(\) => \{[\s\S]*?ride = null;[\s\S]*?ui\.bg\.style\.transform = '';\s*draw\(\);/);
  assert.match(js, /const m = rideMotion\(ride\.kind, ride\.t\);[\s\S]*?ui\.bg\.style\.transform = `translate\(/);
  assert.match(js, /model\.holder\.position\.set\(f\.x \+ rx \/ perMetre, f\.y - ry \/ perMetre, 0\);/, 'she moves with the picture behind her');
  assert.doesNotMatch(js, /setScissor|createVehicles/, 'no vehicle drawn in code any more, no cut at its sill');
  assert.match(js, /if \(ride \|\| trip\) camState\.tz = 1;/, 'no camera push-ins while she rides');
  // her captions and her card say which language
  assert.match(js, /ui\.caption\.lang = /);
  assert.match(js, /ui\.card\.lang = /);
  const html = read('tools/live/page/index.html');
  // behind her: the weather's sky, the people she meets; over her: the rain
  const at = (k) => html.indexOf(k);
  assert.ok(at('data-wx-back') < at('data-pic') && at('data-npc') < at('data-pic'));
  assert.ok(at('data-wx-front') > at('data-pic'));
  assert.doesNotMatch(html, /data-veh/);
  const css = read('tools/live/page/stage.css');
  assert.match(css, /\n\.wx-front \{[^}]*opacity: 0\.99;/, 'the rain over her: a little see-through');
  assert.match(css, /\n\.flash \{[^}]*background: rgba\(255, 255, 255, 0\.8\)/, 'lightning: never plain white');
  for (const sel of ['.npc-bubble', '.place-chip', '.route']) assert.match(css, new RegExp(`\\n${sel.replace(/\./g, '\\.')} \\{[^}]*background: rgba\\(`), sel);
  assert.match(css, /\n\.ask-cta, \.ask-queue, \.ask-rules \{ flex-shrink: 0; white-space: nowrap; \}/);
  assert.match(css, /\n\.ask-hint \{[^}]*flex: 0 1 auto; min-width: 0; overflow: hidden; \}/);
  assert.match(css, /\n\.ask-hint\.is-cut \{ visibility: hidden; \}/);
  // every moving bit a place or a trip uses is drawn
  for (const list of [...PLACE_IDS.map((id) => PLACES[id].ambient), ...Object.values(TRAVEL).map((t) => t.ambient)]) {
    for (const a of list) for (const cls of a.cls.split(' ')) if (!/^c\d$|^big$|^slow$/.test(cls)) assert.match(css, new RegExp(`\\.amb \\.${cls}\\b`), cls);
  }
});
