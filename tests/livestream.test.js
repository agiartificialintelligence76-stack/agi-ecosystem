// Her live show (2026-10-02): the stream's side, which runs on the owner's own server (tools/live/): what she says between
// questions (her rules for every line), the director (a whole show in a moment, with a pretend clock), her voice (Google
// Cloud's sign-in and requests, the backups, the lines kept on disk), the runner's pure parts (options, X's address and its
// key never in a log, ffmpeg's settings as X asks, her voice's clock, the lip-sync measurement), her set's page, the Docker
// image. No network, no browser, no ffmpeg here: the real show was run end to end on Claude's computer (see CLAUDE.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, existsSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateKeyPairSync, createVerify } from 'node:crypto';
import * as L from '../tools/live/lines.js';
import { createShow, nextStep, didStep, PACE, chatLine, pickupLine, tipsFor, pairsFor, seeded } from '../tools/live/show.js';
import {
  voiceSettings, serviceAccount, tokenRequest, accessToken, forgetToken, vertexRequest, cloudRequest, vertexAudio, createVoice, promptFor,
  pcmToSamples, samplesToPcm, resample, RATE,
} from '../tools/live/voice.js';
import { parseArgs, timeAt, startProblem, rtmpTarget, maskUrl, ffmpegArgs, Mixer, reactFor, avShift, outPath, warmUp, beep, audioOnsets, videoOnsets, syncOffset,
  WARM_GAP_MS, PROBE_SHOW, secretAccepted } from '../tools/live/run.mjs';
import { liveSite, demoSite, DEMO_QA } from '../tools/live/site.js';
import * as M from '../tools/live/music.js';
import { isCrude } from '../server/coins.js';
import { styleFor, spokenText } from '../server/voice.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// ---------- her lines ----------
// (every line she can say: the module's own list, which --warm makes her voice for; checked against its parts here)
const allLines = () => {
  const out = L.allLines();
  const seg = L.SEGMENTS;
  for (const x of [...L.INTRO, ...L.OUTRO, L.BRB.start, L.BRB.back, ...L.READING, ...L.LAG, ...L.PICKUP, ...L.CHAT, ...seg.agi101.lines, ...seg.safety.lines,
    seg.tips.intro, seg.wyr.intro, seg.diary.intro, seg.diary.outro, L.tipLine(seg.tips.tips[5], 2), ...L.wyrLines(seg.wyr.pairs[3])]) {
    assert.ok(out.some((y) => y.text === x.text), `in allLines(): ${x.text}`);
  }
  return out;
};
const REAL_PEOPLE = /\b(vlad|tenev|elon|musk|trump|biden|vitalik|buterin|saylor|sbf|bankman|cz|changpeng|satoshi|nakamoto|zuckerberg|bezos|altman|gensler|powell|obama|kanye|taylor swift|drake)\b/i;
test('her lines on stream: PG-13, no pet names, only $AGI, never a real person, never advice, links only to agi1.app', () => {
  const lines = allLines();
  assert.ok(lines.length > 80, `${lines.length} lines`);
  const cards = Object.values(L.SEGMENTS).flatMap((s) => [s.card?.title, s.card?.kicker, ...(s.card?.list || [])]).filter(Boolean);
  for (const line of lines) {
    for (const t of [line.text, line.say].filter(Boolean)) {
      assert.ok(!isCrude(t), `PG-13: ${t}`);
      assert.doesNotMatch(t, /\b(babe|baby|cutie|honey|sweetie|darling)\b/i, `no pet names (everyone's watching): ${t}`);
      assert.doesNotMatch(t, REAL_PEOPLE, `never a real person: ${t}`);
      assert.doesNotMatch(t, /\b(buy|sell|hold|moon|pump|profit|gains?|guaranteed|100x|ape in|financial freedom|get rich)\b/i, `no advice words: ${t}`);
      for (const m of t.matchAll(/\$([A-Za-z]+)/g)) assert.equal(m[1].toUpperCase(), 'AGI', `only $AGI: ${t}`);
      for (const link of t.match(/\b[\w-]+\.(?:app|com|io|xyz|me|trade)\b[^\s,]*/g) || []) assert.match(link, /^(agi1\.app|clank\.trade)/, `links: ${t}`);
      assert.doesNotMatch(t, /https?:\/\//, t);
    }
    assert.ok(line.text.length <= 300, `short enough to say in one go: ${line.text}`);
    assert.ok(Object.hasOwn({ neutral: 1, happy: 1, love: 1, shy: 1, wave: 1, sweet: 1, careful: 1, sad: 1, pout: 1, celebrate: 1, worried: 1 }, line.mood), `a mood her voice knows: ${line.mood}`);
    if (line.say) assert.doesNotMatch(line.say, /\$|agi1\.app|💜|👋|🙈|😤/, `said out loud without symbols: ${line.say}`);
  }
  for (const t of cards) {
    assert.ok(!isCrude(t));
    for (const m of t.matchAll(/\$([A-Za-z]+)/g)) assert.equal(m[1].toUpperCase(), 'AGI', t);
    assert.doesNotMatch(t, REAL_PEOPLE, t);
  }
  // "not financial advice" wherever money or $AGI comes up
  for (const id of ['agi101', 'clank101', 'chain101']) assert.ok(L.SEGMENTS[id].lines.some((x) => /not financial advice/i.test(x.text)), id);
  assert.ok(L.INTRO.some((x) => /financial advice/i.test(x.text)) && L.OUTRO.some((x) => /financial advice/i.test(x.text)));
  assert.ok(L.INTRO.some((x) => /i'm an AI/i.test(x.text) && /AI-generated/.test(x.text)), 'she says she\'s an AI, and it\'s all AI-generated');
  assert.ok(L.SEGMENTS.chain101.lines.some((x) => /not affiliated with Robinhood/.test(x.text)), 'not affiliated with Robinhood');
  assert.ok(L.SEGMENTS.agi101.card.list.some((x) => /0xfa31…06ec/.test(x)) && L.SEGMENTS.agi101.lines.some((x) => /copy it from agi1\.app/.test(x.text)), 'the contract: its ends, copied only from agi1.app');
  assert.ok(L.SEGMENTS.safety.lines.some((x) => /never ask for your seed phrase/.test(x.text)));
  assert.deepEqual(L.SEGMENT_IDS, ['agi101', 'clank101', 'chain101', 'safety', 'tips', 'wyr', 'diary']);
  for (const [a, b, pick, why] of L.SEGMENTS.wyr.pairs) assert.ok(a && b && [0, 1].includes(pick) && why.length > 3);
  assert.equal(L.wyrLines(L.SEGMENTS.wyr.pairs[0])[1].pick, 0);
});

test('her diary on stream: her published entry, all of it said out loud (300 characters at most, cut after a sentence), only a fresh one', () => {
  const now = Date.UTC(2026, 9, 2, 20, 0);
  assert.equal(L.diaryLines(null, now), null);
  assert.equal(L.diaryLines({ day: '2026-10-01', entry: 'too short' }, now), null);
  const d = L.diaryLines({ day: '2026-10-01', mood: 'love', entry: 'dear diary, today was soft and slow. the chart was calm and so was i 💜' }, now);
  assert.equal(d.lines.length, 3);
  assert.equal(d.lines[1].mood, 'love');
  assert.match(d.lines[0].text, /my newest entry/, 'never "yesterday": the newest one may be older');
  assert.match(d.lines[2].text, /not financial advice, just feelings/);
  const long = L.diaryLines({ day: '2026-10-01', mood: 'jealous', entry: `${'a sentence about my day. '.repeat(30)}` }, now);
  assert.ok(long.entry.length <= L.DIARY_MAX && /\.$/.test(long.entry), long.entry.length);
  assert.equal(spokenText(long.lines[1].text), long.lines[1].text, 'her voice says all of it (her captions show nothing she doesn\'t say)');
  assert.equal(long.lines[1].mood, 'pout');
  // an entry more than two days old (her diary's nightly job failed): no diary segment
  assert.ok(L.diaryLines({ day: '2026-09-30', entry: 'dear diary, a calm and quiet day.' }, now));
  assert.equal(L.diaryLines({ day: '2026-09-29', entry: 'dear diary, a calm and quiet day.' }, now), null);
  assert.equal(L.diaryLines({ day: 'someday', entry: 'dear diary, a calm and quiet day.' }, now), null);
  // written for the site, it may name what her show never does: then no diary segment that day
  for (const entry of ['dear diary, everyone talked about bitcoin today.', 'dear diary, $PEPE was everywhere.', 'dear diary, i read about it on example.com today.',
    'dear diary, someone said ElonMusk liked me.']) assert.equal(L.diaryLines({ day: '2026-10-01', entry }, now), null, entry);
  assert.ok(L.diaryLines({ day: '2026-10-01', entry: 'dear diary, $AGI felt calm today, and so did i.' }, now));
});

// ---------- the director ----------
// A whole show with a pretend clock: each step "takes" a few seconds
function simulate({ minutes = 60, questionsEvery = 0, pauseAt = null, endAt = null, diary = true, seed = 7 } = {}) {
  const start = 1_000_000;
  const show = createShow({ start, minutes, diary, seed });
  const took = { intro: 18_000, question: 25_000, segment: 70_000, pickup: 6000, chat: 5000, outro: 15_000, brb: 20_000 };
  let now = start, arrived = 0, answered = 0, paused = false;
  const steps = [];
  for (let i = 0; i < 2000; i++) {
    if (questionsEvery) arrived = Math.floor((now - start) / questionsEvery);
    paused = pauseAt !== null && now >= start + pauseAt && now < start + pauseAt + 60_000;
    const step = nextStep(show, { now, waiting: arrived - answered, paused, end: endAt !== null && now >= start + endAt });
    steps.push({ ...step, at: now - start });
    if (step.kind === 'end') break;
    now += step.kind === 'wait' ? step.ms : took[step.kind];
    if (step.kind === 'question') answered += 1;
    if (step.kind !== 'brb' && step.kind !== 'wait') didStep(show, step, now);
  }
  return { steps, show };
}
test('the director: intro first, questions first (up to 4 in a row), a segment every 6 minutes (2.5 when nobody asks), the outro, the end', () => {
  const busy = simulate({ questionsEvery: 20_000 });
  assert.equal(busy.steps[0].kind, 'intro');
  assert.equal(busy.steps.at(-1).kind, 'end');
  assert.equal(busy.steps.at(-2).kind, 'outro');
  const outro = busy.steps.find((s) => s.kind === 'outro');
  assert.ok(outro.at >= 60 * 60_000 - PACE.OUTRO_MS - 70_000 && outro.at <= 60 * 60_000 - PACE.OUTRO_MS + 70_000, `the outro near the end: ${outro.at / 60_000} min`);
  const segs = busy.steps.filter((s) => s.kind === 'segment');
  assert.ok(segs.length >= 6 && segs.length <= 12, `${segs.length} segments in a busy hour`);
  for (let i = 1; i < segs.length; i++) assert.ok(segs[i].at - segs[i - 1].at >= PACE.SEGMENT_EVERY - 1, 'a segment at most every 6 minutes while people ask');
  let row = 0, most = 0;
  for (const s of busy.steps) { if (s.kind === 'question') { row += 1; most = Math.max(most, row); } else if (s.kind === 'segment') row = 0; }
  assert.ok(busy.steps.filter((s) => s.kind === 'question').length > 60, 'questions get answered');
  assert.equal(busy.steps.filter((s) => s.kind === 'pickup').length, 0, 'no "ask me" nudges while people are asking');
  // nobody asking: segments every 2.5 minutes, nudges every 75 s, a chat line when quiet
  const quiet = simulate({ questionsEvery: 0 });
  const qsegs = quiet.steps.filter((s) => s.kind === 'segment');
  assert.ok(qsegs.length >= 14, `${qsegs.length} segments in a quiet hour`);
  const pickups = quiet.steps.filter((s) => s.kind === 'pickup');
  assert.ok(pickups.length >= 10);
  for (let i = 1; i < pickups.length; i++) assert.ok(pickups[i].at - pickups[i - 1].at >= PACE.PICKUP_EVERY - 1);
  assert.ok(quiet.steps.some((s) => s.kind === 'chat'));
  // never more than ~25 s of silence: something is said, or a short quiet moment
  const said = quiet.steps.filter((s) => s.kind !== 'wait');
  for (let i = 1; i < said.length; i++) assert.ok(said[i].at - said[i - 1].at < 95_000, `never quiet long (${(said[i].at - said[i - 1].at) / 1000} s)`);
  // every segment once before any comes again, never twice in a row; no diary without an entry
  const order = qsegs.map((s) => s.id);
  const n = L.SEGMENT_IDS.length;
  assert.deepEqual([...new Set(order.slice(0, n))].sort(), [...L.SEGMENT_IDS].sort());
  for (let i = 1; i < order.length; i++) assert.notEqual(order[i], order[i - 1]);
  assert.ok(!simulate({ diary: false }).steps.some((s) => s.id === 'diary'));
  // the same seed, the same show
  assert.deepEqual(simulate({ seed: 3 }).steps.map((s) => s.id || s.kind), simulate({ seed: 3 }).steps.map((s) => s.id || s.kind));
});

test('the director: the owner\'s pause is "be right back" at once; "end" goes to the outro; a short show still has its outro', () => {
  const p = simulate({ questionsEvery: 30_000, pauseAt: 10 * 60_000 });
  const brb = p.steps.filter((s) => s.kind === 'brb');
  assert.ok(brb.length >= 1 && brb[0].at >= 10 * 60_000 && brb[0].at < 10 * 60_000 + 75_000);
  assert.ok(p.steps.some((s) => s.kind !== 'brb' && s.at > 11 * 60_000), 'back after the pause');
  const e = simulate({ questionsEvery: 30_000, endAt: 15 * 60_000 });
  const outro = e.steps.find((s) => s.kind === 'outro');
  assert.ok(outro.at >= 15 * 60_000 && outro.at < 15 * 60_000 + 75_000);
  const short = simulate({ minutes: 3 });
  assert.deepEqual([short.steps[0].kind, short.steps.at(-2).kind, short.steps.at(-1).kind], ['intro', 'outro', 'end']);
  // a paused show still ends: the owner's "end" while she's on "be right back", or its time running out
  const show = createShow({ start: 0, minutes: 60 });
  didStep(show, { kind: 'intro' }, 1000);
  assert.equal(nextStep(show, { now: 10 * 60_000, paused: true }).kind, 'brb');
  assert.equal(nextStep(show, { now: 10 * 60_000, paused: true, end: true }).kind, 'outro');
  assert.equal(nextStep(show, { now: 60 * 60_000, paused: true }).kind, 'outro');
  assert.equal(nextStep(show, { now: 3 * 3_600_000, paused: true }).kind, 'outro', 'hours later: still the outro, never brb forever');
  // her answers stuck (questions waiting, none can be answered for a while): no "my line is empty, ask me" nudges
  const quiet = createShow({ start: 0, minutes: 60 });
  didStep(quiet, { kind: 'intro' }, 1000);
  didStep(quiet, { kind: 'segment', id: quiet.segments[0] }, 5000);
  assert.equal(nextStep(quiet, { now: 80_000, waiting: 0 }).kind, 'pickup');
  assert.notEqual(nextStep(quiet, { now: 80_000, waiting: 0, holding: true }).kind, 'pickup');
});

test('the director picks lines she hasn\'t said yet this show (tips, would you rather, chat, nudges)', () => {
  const show = createShow({ start: 0, seed: 5 });
  const chats = Array.from({ length: L.CHAT.length }, () => chatLine(show).text);
  assert.equal(new Set(chats).size, L.CHAT.length, 'every chat line once before any again');
  const pickups = Array.from({ length: L.PICKUP.length }, () => pickupLine(show).text);
  assert.equal(new Set(pickups).size, L.PICKUP.length);
  const tips = [...tipsFor(show, 3), ...tipsFor(show, 3), ...tipsFor(show, 3), ...tipsFor(show, 3)];
  assert.equal(new Set(tips).size, 12);
  const pairs = [...pairsFor(show), ...pairsFor(show), ...pairsFor(show)];
  assert.equal(new Set(pairs.map((x) => x[0])).size, 6);
  const r = seeded(9);
  assert.ok(r() !== r());
});

// ---------- her voice ----------
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const KEYFILE = JSON.stringify({ type: 'service_account', project_id: 'agi1-live', private_key_id: 'kid123', client_email: 'agi1-live@agi1-live.iam.gserviceaccount.com',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }), token_uri: 'https://oauth2.googleapis.com/token' });
test('her voice\'s settings: Google Cloud first when it\'s set up, the site\'s key as a backup, the stand-in for trying', () => {
  assert.deepEqual(voiceSettings({}).order, []);
  assert.deepEqual(voiceSettings({ GOOGLE_APPLICATION_CREDENTIALS: '/k.json', GEMINI_API_KEY: 'x' }).order, ['vertex', 'gemini']);
  assert.deepEqual(voiceSettings({ LIVE_GCP_API_KEY: 'k' }).order, ['vertex']);
  assert.deepEqual(voiceSettings({ LIVE_VOICES: 'cloud, gemini, nonsense, cloud' }).order, ['cloud', 'gemini']);
  assert.deepEqual(voiceSettings({ GOOGLE_APPLICATION_CREDENTIALS: '/k.json' }, { fake: true }).order, ['fake']);
  const s = voiceSettings({});
  assert.deepEqual([s.voice, s.location, s.vertexModel, s.cloudModel], ['Despina', 'global', 'gemini-3.8-flash-lite-tts', 'gemini-2.5-flash-tts']);
});

test('Google Cloud sign-in: a service account\'s key file, a signed token request (RS256), the token kept until it\'s nearly old', async () => {
  for (const bad of ['{', '{}', JSON.stringify({ type: 'authorized_user' }), JSON.stringify({ type: 'service_account', client_email: 'a@b', private_key: 'nope' })]) {
    assert.throws(() => serviceAccount(bad), /key file/);
  }
  const sa = serviceAccount(KEYFILE);
  assert.equal(sa.project, 'agi1-live');
  const now = Date.UTC(2026, 9, 2, 20);
  const jwt = tokenRequest(sa, now);
  const [h, c, sig] = jwt.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(h, 'base64url')), { alg: 'RS256', typ: 'JWT', kid: 'kid123' });
  const claims = JSON.parse(Buffer.from(c, 'base64url'));
  assert.deepEqual(claims, { iss: sa.email, scope: 'https://www.googleapis.com/auth/cloud-platform', aud: 'https://oauth2.googleapis.com/token', iat: now / 1000, exp: now / 1000 + 3600 });
  const v = createVerify('RSA-SHA256');
  v.update(`${h}.${c}`);
  assert.ok(v.verify(publicKey, Buffer.from(sig, 'base64url')), 'signed with the key file\'s key');
  forgetToken();
  const calls = [];
  const fetchFn = async (url, init) => { calls.push({ url, init }); return Response.json({ access_token: 'ya29.fake-token', expires_in: 3599 }); };
  assert.equal(await accessToken(sa, { fetchFn, now }), 'ya29.fake-token');
  assert.equal(await accessToken(sa, { fetchFn, now: now + 50 * 60_000 }), 'ya29.fake-token', 'kept');
  assert.equal(calls.length, 1);
  await accessToken(sa, { fetchFn, now: now + 59 * 60_000 });
  assert.equal(calls.length, 2, 'a new one just before it gets old');
  const body = new URLSearchParams(calls[0].init.body);
  assert.equal(body.get('grant_type'), 'urn:ietf:params:oauth:grant-type:jwt-bearer');
  assert.equal(body.get('assertion').split('.').length, 3);
  forgetToken();
  const refused = async () => Response.json({ error: 'invalid_grant', error_description: 'Invalid JWT Signature.' }, { status: 400 });
  await assert.rejects(accessToken(sa, { fetchFn: refused, now }), /google sign-in: HTTP 400 invalid_grant.*"Agent Platform User" role, formerly "Vertex AI User"/);
  forgetToken();
});

test('the requests: Vertex AI (her model, Despina, her style apart from her words) and Cloud Text-to-Speech', () => {
  const s = { ...voiceSettings({}), project: 'agi1-live', apiKey: 'AIzaFAKE' };
  const words = 'hi everyone', style = styleFor('wave');
  let r = vertexRequest(s, words, style, { bearer: 'ya29.x' });
  assert.equal(r.url, 'https://aiplatform.googleapis.com/v1beta1/projects/agi1-live/locations/global/publishers/google/models/gemini-3.8-flash-lite-tts:generateContent');
  assert.equal(r.init.headers.Authorization, 'Bearer ya29.x');
  const body = JSON.parse(r.init.body);
  assert.deepEqual(body.generationConfig, { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Despina' } } } });
  assert.equal(body.contents[0].parts[0].text, promptFor(words, style));
  assert.match(promptFor(words, style), /## DIRECTOR'S NOTES[\s\S]*Style: Bright and friendly[\s\S]*## TRANSCRIPT\nhi everyone$/);
  r = vertexRequest({ ...s, location: 'us-central1' }, words, style, { bearer: 'x' });
  assert.match(r.url, /^https:\/\/us-central1-aiplatform\.googleapis\.com\/v1beta1\/projects\/agi1-live\/locations\/us-central1\//);
  r = vertexRequest({ ...s, project: '' }, words, style);
  assert.equal(r.url, 'https://aiplatform.googleapis.com/v1beta1/publishers/google/models/gemini-3.8-flash-lite-tts:generateContent');
  assert.equal(r.init.headers['x-goog-api-key'], 'AIzaFAKE', 'an API key: in a header, never in the address');
  const c = cloudRequest(s, words, style);
  assert.equal(c.url, 'https://texttospeech.googleapis.com/v1/text:synthesize');
  assert.deepEqual(JSON.parse(c.init.body), { input: { prompt: style, text: words }, voice: { languageCode: 'en-US', name: 'Despina', modelName: 'gemini-2.5-flash-tts' }, audioConfig: { audioEncoding: 'LINEAR16', sampleRateHertz: 24000 } });
  // Vertex's answer: raw 16-bit sound (its rate in its type)
  const pcm = samplesToPcm(Float32Array.from({ length: 4800 }, (_, i) => Math.sin(i / 10) * 0.5));
  const a = vertexAudio({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=24000', data: pcm.toString('base64') } }] } }] });
  assert.equal(a.rate, 24000);
  assert.equal(a.samples.length, 4800);
  assert.ok(Math.abs(a.samples[100] - Math.sin(10) * 0.5) < 0.001);
  assert.equal(vertexAudio({ candidates: [{ content: { parts: [{ text: 'no' }] } }] }), null);
  assert.equal(resample(Float32Array.from([0, 1]), 12000, 24000).length, 4);
  assert.deepEqual([...pcmToSamples(samplesToPcm(Float32Array.from([0.5, -0.5])))].map((x) => Math.round(x * 100) / 100), [0.5, -0.5]);
});

test('her voice: each way in order (a refusal → the next), her pre-written lines kept on disk (asked once), a busy way rests', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'agi1-voice-'));
  const keyPath = join(dir, 'key.json');
  writeFileSync(keyPath, KEYFILE);
  const calls = [];
  let vertexStatus = 200;
  const pcm = samplesToPcm(Float32Array.from({ length: 24000 }, (_, i) => Math.sin(i / 7) * 0.4)).toString('base64');
  const fetchFn = async (url, init) => {
    calls.push(String(url));
    if (String(url).startsWith('https://oauth2.googleapis.com/')) return Response.json({ access_token: 'ya29.t', expires_in: 3600 });
    if (String(url).includes('aiplatform')) {
      if (vertexStatus !== 200) return new Response('{"error":{"message":"busy"}}', { status: vertexStatus });
      return Response.json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=24000', data: pcm } }] } }] });
    }
    if (String(url).includes('texttospeech')) {
      const { writeWav } = await import('../tools/clips/audio.js');
      return Response.json({ audioContent: writeWav(Float32Array.from({ length: 24000 }, () => 0.1), 24000).toString('base64') });
    }
    throw new Error(`unexpected ${url}`);
  };
  const quiet = { warn: () => {} };
  forgetToken();
  let v = createVoice({ ...voiceSettings({ GOOGLE_APPLICATION_CREDENTIALS: keyPath, LIVE_VOICES: 'vertex,cloud' }), cacheDir: join(dir, 'cache') }, { fetchFn, log: quiet });
  let r = await v.speak('hi everyone 💜', { mood: 'wave', keep: true });
  assert.equal(r.by, 'vertex');
  assert.equal(r.samples.length, 24000);
  assert.ok(calls.some((u) => u.includes('/projects/agi1-live/locations/global/')), 'its project from the key file');
  assert.equal(readdirSync(join(dir, 'cache')).length, 1, 'kept on disk');
  calls.length = 0;
  r = await v.speak('hi everyone 💜', { mood: 'wave', keep: true });
  assert.equal(r.by, 'vertex (kept)');
  assert.equal(calls.length, 0, 'the second time: no Google at all');
  r = await v.speak('an answer to a question', { mood: 'happy', keep: false });
  assert.equal(readdirSync(join(dir, 'cache')).length, 1, 'answers aren\'t kept');
  // Vertex refuses: the next way speaks; busy (429): it rests a minute
  vertexStatus = 403;
  calls.length = 0;
  r = await v.speak('something else', { mood: 'neutral' });
  assert.equal(r.by, 'cloud');
  vertexStatus = 429;
  let t = 1_000_000;
  calls.length = 0;
  r = await v.speak('busy one', { now: () => t });
  assert.equal(r.by, 'cloud');
  assert.equal(calls.filter((u) => u.includes('aiplatform')).length, 2, 'a busy way is tried twice…');
  calls.length = 0;
  t += 30_000;
  r = await v.speak('busy two', { now: () => t });
  assert.equal(calls.filter((u) => u.includes('aiplatform')).length, 0, '…then rests a minute');
  // the key file's place in live.env but no file there: an API key works instead (Google's own header, no sign-in);
  // without one, the warning says where the file goes
  vertexStatus = 200;
  const headers = [];
  v = createVoice({ ...voiceSettings({ GOOGLE_APPLICATION_CREDENTIALS: join(dir, 'none.json'), LIVE_GCP_API_KEY: 'k-123', LIVE_VOICES: 'vertex' }), cacheDir: join(dir, 'c4') },
    { fetchFn: async (url, init) => { headers.push(init.headers); return fetchFn(url, init); }, log: quiet });
  r = await v.speak('with an api key', { mood: 'neutral' });
  assert.equal(r.by, 'vertex');
  assert.equal(headers.at(-1)['x-goog-api-key'], 'k-123');
  assert.equal(headers.at(-1).Authorization, undefined);
  const heard = [];
  v = createVoice({ ...voiceSettings({ GOOGLE_APPLICATION_CREDENTIALS: join(dir, 'none.json'), LIVE_VOICES: 'vertex' }), cacheDir: join(dir, 'c5') }, { fetchFn, log: { warn: (m) => heard.push(m) } });
  assert.equal(await v.speak('no key at all'), null);
  assert.match(heard.join('\n'), /ENOENT\): no file there \(put it at \/opt\/agi1-live\/google-key\.json/);
  // nothing works: null (she says it silently, captions only)
  v = createVoice({ ...voiceSettings({ LIVE_VOICES: 'vertex' }), cacheDir: join(dir, 'c2') }, { fetchFn, log: quiet });
  assert.equal(await v.speak('no way to say this'), null);
  // a way that doesn't answer in time rests a minute (she says the next lines silently instead of waiting each time)
  assert.equal(voiceSettings({}).timeoutMs, 15_000);
  assert.equal(voiceSettings({ LIVE_VOICE_TIMEOUT_S: '1' }).timeoutMs, 5000, 'at least 5 s');
  const slowFetch = async (url, init) => {
    if (String(url).includes('aiplatform')) { const e = new Error('The operation was aborted due to timeout'); e.name = 'TimeoutError'; throw e; }
    return fetchFn(url, init);
  };
  const said = [];
  v = createVoice({ ...voiceSettings({ GOOGLE_APPLICATION_CREDENTIALS: keyPath, LIVE_VOICES: 'vertex' }), cacheDir: join(dir, 'cache') }, { fetchFn: slowFetch, log: { warn: (m) => said.push(m) } });
  t = 2_000_000;
  calls.length = 0;
  assert.equal(await v.speak('too slow', { now: () => t }), null);
  assert.match(said.join('\n'), /no answer within 15 s \(it rests a minute\)/);
  const before = said.length;
  t += 20_000;
  assert.equal(await v.speak('still resting', { now: () => t }), null);
  assert.equal(said.length, before, 'resting: not asked again');
  assert.equal((await v.speak('hi everyone 💜', { mood: 'wave', keep: true, now: () => t }))?.by, 'vertex (kept)', '…but a line kept on disk still plays');
  // her pre-written lines made ahead (kept), and no new one after "until"
  v = createVoice({ ...voiceSettings({ GOOGLE_APPLICATION_CREDENTIALS: keyPath, LIVE_VOICES: 'vertex' }), cacheDir: join(dir, 'c7') }, { fetchFn, log: quiet });
  vertexStatus = 200;
  const ready = await warmUp(v, L.INTRO);
  assert.equal(ready, L.INTRO.length);
  assert.equal(readdirSync(join(dir, 'c7')).length, L.INTRO.length, 'each one kept');
  assert.equal(await warmUp(v, L.OUTRO, { until: Date.now() - 1 }), 0, 'past "until": nothing new started');
  // the stand-in hum
  v = createVoice({ ...voiceSettings({}, { fake: true }), cacheDir: join(dir, 'c3') }, { fetchFn, log: quiet });
  r = await v.speak('hello there, this is a test');
  assert.equal(r.by, 'fake');
  assert.equal(r.rate, RATE);
  assert.equal(await v.speak('💜'), null, 'nothing to say out loud: nothing');
  rmSync(dir, { recursive: true, force: true });
  forgetToken();
});

// ---------- her music ----------
const SHORT = [{ bars: 2, pad: 1, keys: 1, bass: 1, drums: 1, lead: 1 }, { bars: 2, pad: 1, keys: 0.7, end: true }];
const QUALITIES = { maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], dom9: [0, 4, 10, 14], sus: [0, 5, 7, 10], add9: [0, 4, 7, 14], six: [0, 4, 7, 9], m9: [0, 3, 10, 14] };
test('her music: original songs made in code, the same every time, about two minutes each, a steady level, never clipping, no clicks', () => {
  assert.ok(M.SONGS.length >= 4);
  assert.equal(new Set(M.SONGS.map((x) => x.id)).size, M.SONGS.length);
  for (const song of M.SONGS) {
    assert.ok(song.chords.length === 4 && song.chords.every(([d, q]) => Number.isInteger(d) && QUALITIES[q]), song.id);
    assert.ok(song.bpm >= 60 && song.bpm <= 110 && song.swing >= 0.5 && song.swing <= 0.67, song.id);
    const secs = M.songSeconds(song);
    assert.ok(secs > 100 && secs < 160, `${song.id}: ${secs} s`);
    // its chords: the right notes, close together, between E3 and E5, near the last chord's
    let prev = null;
    for (const [deg, q] of song.chords) {
      const pcs = QUALITIES[q].map((i) => (song.key + deg + i) % 12);
      const v = M.voicing(pcs, prev);
      assert.deepEqual([...new Set(v.map((m) => m % 12))].sort(), [...new Set(pcs)].sort(), `${song.id}: the chord's own notes`);
      assert.ok(v.every((m) => m >= 52 && m <= 76) && v.at(-1) - v[0] <= 14, `${song.id}: ${v}`);
      prev = v;
    }
    // its melody: in the song's key (major pentatonic), coming home at the end
    const pcsAll = song.chords.map(([deg, q]) => QUALITIES[q].map((i) => (song.key + deg + i) % 12));
    const tune = M.melody(song, seeded(song.seed), pcsAll);
    assert.ok(tune.length >= 8 && tune.every((n) => [0, 2, 4, 7, 9].includes(((n.midi - song.key) % 12 + 12) % 12)), song.id);
    assert.equal((tune.at(-1).midi - song.key) % 12, 0, `${song.id}: ends on its home note`);
  }
  // a short take: the same every time
  const a = M.renderSong(M.SONGS[1], M.RATE, { plan: SHORT }), b = M.renderSong(M.SONGS[1], M.RATE, { plan: SHORT });
  assert.ok(a.length === b.length && a.every((x, i) => x === b[i]), 'the same song, the same sound');
  // a whole song: its length, its level, no clipping, no clicks
  const song = M.SONGS[1];
  const mix = M.renderSong(song);
  assert.ok(Math.abs(mix.length / M.RATE - M.songSeconds(song)) < 2.5, `${mix.length / M.RATE} s`);
  let sum = 0, peak = 0, jumps = 0;
  for (let i = 0; i < mix.length; i++) {
    assert.ok(Number.isFinite(mix[i]));
    sum += mix[i] * mix[i]; peak = Math.max(peak, Math.abs(mix[i]));
    if (i && Math.abs(mix[i] - mix[i - 1]) > 0.25) jumps += 1;
  }
  const db = 20 * Math.log10(Math.sqrt(sum / mix.length));
  assert.ok(db > -22 && db < -18.5, `a steady level: ${db.toFixed(1)} dB`);
  assert.ok(peak < 0.85, `never clipping: ${peak}`);
  assert.equal(jumps, 0, 'no clicks');
  assert.ok(Math.abs(mix[0]) < 0.01 && Math.abs(mix.at(-1)) < 0.01, 'it fades in and out');
});

test('her music under her voice: on a loop (never the same song twice in a row), quieter while she talks, fading out at the end; kept on disk', () => {
  assert.deepEqual(M.musicSettings({}), { on: true, volume: 1 });
  assert.deepEqual(M.musicSettings({ LIVE_MUSIC: 'off' }).on, false);
  assert.deepEqual(M.musicSettings({ LIVE_MUSIC_VOLUME: '50' }).volume, 0.5);
  assert.deepEqual(M.musicSettings({ LIVE_MUSIC_VOLUME: '900' }).volume, 2);
  assert.deepEqual(M.musicSettings({ LIVE_MUSIC_VOLUME: '' }).volume, 1);
  // three "songs" of a steady 1.0: the level the bed adds is its gain
  const tracks = ['a', 'b', 'c'].map((title) => ({ song: { title }, samples: new Float32Array(M.RATE * 30).fill(1) }));
  const bed = new M.MusicBed(tracks, { seed: 5 });
  const level = (talking, seconds) => { const out = new Float32Array(Math.round(seconds * M.RATE)); bed.mix(out, talking); return out.at(-1); };
  assert.ok(Math.abs(level(false, 8) - M.MUSIC_LEVEL.idle) < 0.01, 'quiet');
  assert.ok(Math.abs(level(true, 0.6) - M.MUSIC_LEVEL.talk) < 0.02, 'down quickly when she talks');
  const back = level(false, 0.5);
  assert.ok(back > M.MUSIC_LEVEL.talk + 0.03 && back < M.MUSIC_LEVEL.idle - 0.05, 'back up slowly after');
  bed.fadeOut();
  assert.ok(level(false, 6) < 0.01, 'fades out at the end');
  // the loop: every song, never the same one twice in a row
  const tiny = ['a', 'b', 'c'].map((title) => ({ song: { title }, samples: new Float32Array(10).fill(0.5) }));
  const loop = new M.MusicBed(tiny, { seed: 9 });
  const played = [];
  const pick = loop.next.bind(loop);
  loop.next = () => { const t = pick(); played.push(loop.last); return t; };
  for (let i = 0; i < 60; i++) loop.mix(new Float32Array(10));
  assert.ok(played.length >= 40 && played.every((x, i) => i === 0 || x !== played[i - 1]), played.join(''));
  assert.deepEqual([...new Set(played)].sort(), [0, 1, 2]);
  // the next song starts while the last one fades out: never a gap
  const two = new M.MusicBed([0.2, 0.3].map((v, k) => ({ song: { title: `s${k}` }, samples: new Float32Array(M.RATE * 4).fill(v) })), { seed: 3 });
  const long = new Float32Array(M.RATE * 30);
  two.mix(long);
  const tail = long.subarray(M.RATE * 5);
  assert.ok(tail.every((x) => x > 0.05), 'no silent moment between songs');
  // under her voice in the stream's sound: added together, never past full scale
  const writes = [];
  let t = 0;
  const mixer = new Mixer((buf) => writes.push(buf), { now: () => t, lead: 0, bed: new M.MusicBed([{ song: { title: 'x' }, samples: new Float32Array(M.RATE * 10).fill(1) }]) });
  mixer.begin(0);
  t = 4000;
  mixer.pump();
  mixer.play(new Float32Array(M.RATE).fill(0.9));
  t = 4500;
  mixer.pump();
  mixer.end();
  const pcm = Buffer.concat(writes);
  const v = (sec) => pcm.readInt16LE(Math.round(sec * M.RATE) * 2) / 32768;
  assert.ok(v(0.2) < 0.15, `the music fades in at the start: ${v(0.2)}`);
  assert.ok(v(3.9) > 0.5 && v(3.9) < 0.56, `music alone: ${v(3.9)}`);
  assert.ok(v(4.4) > 0.99, 'her voice and the music together: kept at full scale, never wrapped around');
  // kept on disk: made once, then read back
  const dir = mkdtempSync(join(tmpdir(), 'agi1-music-'));
  let made = 0;
  const render = () => { made += 1; return Float32Array.from({ length: 2400 }, (_, i) => Math.sin(i / 9) * 0.5); };
  const first = M.loadSongs(dir, { songs: [M.SONGS[0]], render });
  const again = M.loadSongs(dir, { songs: [M.SONGS[0]], render });
  assert.equal(made, 1, 'made once');
  assert.ok(again[0].samples.every((x, i) => Math.abs(x - first[0].samples[i]) < 1 / 16000), 'read back the same');
  assert.ok(readdirSync(dir).every((f) => /^music-[0-9a-f]{24}\.pcm$/.test(f)));
  rmSync(dir, { recursive: true, force: true });
});

// ---------- the runner ----------
test('the runner\'s options, her show\'s time, X\'s address (its stream key never in a log)', () => {
  assert.deepEqual(parseArgs([], {}).minutes, 60);
  const a = parseArgs(['--record', 'x.mp4', '--minutes', '90', '--start-at', '20:00', '--fake-voice', '--demo'], {});
  assert.deepEqual([a.record, a.minutes, a.startAt, a.fake, a.demo], ['x.mp4', 90, '20:00', true, true]);
  // a recording uses made-up questions (agi1.app's real ones would be "answered" into a file) unless --with-site
  assert.equal(parseArgs(['--record', 'x.mp4'], {}).demo, true);
  assert.equal(parseArgs(['--record', 'x.mp4', '--with-site'], {}).demo, false);
  assert.equal(parseArgs([], {}).demo, false, 'a show to X: the real site');
  assert.equal(parseArgs(['--warm'], {}).warm, true);
  // a start more than 30 minutes away is a mistake (a late start, or LIVE_DAILY_AT and the cron line apart): refused
  const at = Date.UTC(2026, 9, 2, 20, 15);
  assert.match(startProblem('20:00', timeAt('20:00', at), at), /20:00 is 23 h 45 min away \(it's 20:15 UTC now\)/);
  assert.equal(startProblem('20:00', timeAt('20:00', Date.UTC(2026, 9, 2, 19, 58)), Date.UTC(2026, 9, 2, 19, 58)), null, '2 minutes ahead: fine');
  assert.equal(startProblem('20:00', timeAt('20:00', Date.UTC(2026, 9, 2, 20, 5)), Date.UTC(2026, 9, 2, 20, 5)), null, '5 minutes late: now');
  assert.match(startProblem('8pm', null), /a time like 20:00/);
  assert.equal(startProblem(null, null), null);
  assert.throws(() => parseArgs(['--minutes', '0'], {}));
  assert.throws(() => parseArgs(['--nope'], {}));
  assert.equal(parseArgs([], { LIVE_MINUTES: '45', LIVE_DAILY_AT: '21:30' }).minutes, 45);
  const now = Date.UTC(2026, 9, 2, 19, 57);
  assert.equal(timeAt('20:00', now), Date.UTC(2026, 9, 2, 20, 0));
  assert.equal(timeAt('19:50', now), Date.UTC(2026, 9, 2, 19, 50), 'a few minutes ago: still today (start now)');
  assert.equal(timeAt('08:00', now), Date.UTC(2026, 9, 3, 8, 0), 'earlier today: tomorrow');
  assert.equal(timeAt('2026-10-05T20:00:00Z', now), Date.UTC(2026, 9, 5, 20, 0));
  assert.equal(timeAt('25:00', now), null);
  assert.equal(timeAt('', now), null);
  assert.equal(rtmpTarget({ LIVE_RTMP_URL: 'rtmps://live.example.x.com:443/x', LIVE_STREAM_KEY: 'abc123' }), 'rtmps://live.example.x.com:443/x/abc123');
  assert.equal(rtmpTarget({ LIVE_RTMP_URL: 'rtmp://a.example/x/', LIVE_STREAM_KEY: 'k' }), 'rtmp://a.example/x/k');
  for (const env of [{}, { LIVE_RTMP_URL: 'https://a', LIVE_STREAM_KEY: 'k' }, { LIVE_RTMP_URL: 'rtmp://a', LIVE_STREAM_KEY: 'a b' }]) assert.equal(rtmpTarget(env), null);
  const target = 'rtmps://a.example/x/secretkey';
  assert.equal(maskUrl(`[flv @ 1] connection to ${target} refused`, target), '[flv @ 1] connection to rtmp://[X Live Studio]/[stream key] refused');
  assert.equal(avShift({}), 170);
  assert.equal(avShift({ LIVE_AV_MS: '0' }), 0);
  assert.equal(avShift({ LIVE_AV_MS: '-40' }), -40);
  // files the owner opens: the mounted folder in Docker (LIVE_OUT_DIR), else where it's run; a full path stays as it is
  assert.equal(outPath('live-check.wav', { LIVE_OUT_DIR: '/out' }), '/out/live-check.wav');
  assert.equal(outPath('try.mp4', { LIVE_OUT_DIR: '/out' }), '/out/try.mp4');
  assert.equal(outPath('/srv/x.mp4', { LIVE_OUT_DIR: '/out' }), '/srv/x.mp4');
  assert.equal(outPath('try.mp4', {}), join(process.cwd(), 'try.mp4'));
});

test('ffmpeg\'s settings, as X Live Studio asks: 1280×720 at 30, H.264, a keyframe every 3 s, AAC; to X (FLV) or a file', () => {
  const args = ffmpegArgs({ display: ':99', out: 'rtmps://x/k' });
  const at = (k) => args[args.indexOf(k) + 1];
  assert.equal(at('-f'), 'x11grab');
  assert.equal(at('-video_size'), '1280x720');
  assert.equal(at('-framerate'), '30');
  assert.equal(at('-draw_mouse'), '0');
  assert.ok(args.includes('pipe:0') && args.includes('s16le') && args.includes('24000'), 'her voice: raw sound on a pipe');
  for (const [k, v] of [['-c:v', 'libx264'], ['-preset', 'veryfast'], ['-tune', 'zerolatency'], ['-pix_fmt', 'yuv420p'], ['-b:v', '3000k'], ['-g', '90'], ['-keyint_min', '90'], ['-c:a', 'aac'], ['-b:a', '128k']]) assert.equal(at(k), v, k);
  assert.deepEqual(args.slice(-5), ['-rw_timeout', '15000000', '-f', 'flv', 'rtmps://x/k'], 'a network that stops answering for 15 s ends it (and it starts again)');
  const file = ffmpegArgs({ display: ':99', out: '/tmp/x.mp4', file: true });
  assert.equal(file.at(-1), '/tmp/x.mp4');
  assert.ok(!file.includes('-rw_timeout'));
  assert.ok(file.includes('+frag_keyframe+empty_moov+default_base_moof'), 'a recording that plays even if it\'s stopped hard');
});

test('her voice\'s clock: written in real time a little ahead, a line\'s first sample has a time her mouth follows, cut on demand', async () => {
  let now = 1_000_000;
  const written = [];
  const m = new Mixer((buf) => written.push(buf.length / 2), { rate: 1000, lead: 200, now: () => now });
  m.t0 = now;
  m.pump();
  assert.equal(written.reduce((s, x) => s + x, 0), 200, 'silence, 200 ms ahead');
  now += 500;
  m.pump();
  assert.equal(m.written, 700);
  const clip = Float32Array.from({ length: 300 }, () => 0.5);
  const play = m.play(clip);
  assert.equal(play.startAt, 1_000_000 + 700, 'heard when its first sample is: t0 + what was written');
  assert.equal(play.seconds, 0.3);
  let done = null;
  play.done.then((x) => { done = x; });
  now += 300;
  m.pump();
  await new Promise((r) => { setImmediate(r); });
  assert.equal(done, 'done');
  const p2 = m.play(clip);
  m.stop();
  assert.equal(await p2.done, 'cut');
  // ffmpeg's first picture came later than the sound started: the sound waits until it lines up
  now = 2_000_000;
  const n = new Mixer(() => {}, { rate: 1000, lead: 0, now: () => now });
  n.t0 = now - 1000;
  n.pump();
  assert.equal(n.written, 1000);
  n.align(now - 400);
  now += 100;
  n.pump();
  assert.equal(n.written, 1000, 'ahead by 600 samples: nothing more written until it lines up');
  now += 600;
  n.pump();
  assert.equal(n.written, 1100);
  // her body: answers react fully, pre-written lines mostly with her face
  assert.equal(reactFor('happy', { answer: true }), 'happy');
  assert.equal(reactFor('happy'), 'neutral');
  assert.equal(reactFor('wave'), 'wave');
  assert.equal(reactFor('careful'), 'okay');
  assert.equal(reactFor('pout'), 'jealous');
});

test('the lip-sync check: beeps found in the sound, squares in the pictures, the difference between them', () => {
  const rate = 8000;
  const sound = new Float32Array(rate * 10);
  const beeps = [2, 3.6, 5.2, 6.8];
  for (const t of beeps) sound.set(beep(0.12, rate), Math.round((t + 0.05) * rate));        // heard 50 ms after the square
  const a = audioOnsets(sound, rate);
  assert.equal(a.length, 4);
  const levels = new Array(300).fill(20);
  for (const t of beeps) for (let f = Math.round(t * 30); f < Math.round(t * 30) + 6; f++) levels[f] = 255;
  const v = videoOnsets(levels, 30);
  assert.equal(v.length, 4);
  const r = syncOffset(a, v);
  assert.equal(r.pairs, 4);
  assert.ok(Math.abs(r.ms - 50) <= 20, `about 50 ms: ${r.ms}`);
  assert.deepEqual(syncOffset([], [1]), { ms: null, pairs: 0 });
});

test('the runner\'s side of agi1.app/api/live: LIVE_SECRET on every call; --demo needs no site at all', async () => {
  assert.throws(() => liveSite({ site: 'https://agi1.app', secret: 'short' }), /LIVE_SECRET/);
  assert.throws(() => liveSite({ site: 'not an address', secret: 'x'.repeat(40) }), /SITE_URL/);
  const calls = [];
  const fetchFn = async (url, init) => { calls.push({ url, init }); return Response.json(JSON.parse(init.body).action === 'next' ? { none: true } : { ok: true, show: 4 }); };
  const site = liveSite({ site: 'https://agi1.app/', secret: 'x'.repeat(40), fetchFn });
  assert.equal((await site.start('live')).show, 4);
  await site.beat(4, 'live', 'intro', null);
  await site.done(4, 9, 'skipped', 'owner');
  await site.stop(4, Date.UTC(2026, 9, 3, 20));
  await site.back(4, 10);
  for (const c of calls) {
    assert.equal(c.url, 'https://agi1.app/api/live');
    assert.equal(c.init.headers.Authorization, `Bearer ${'x'.repeat(40)}`);
  }
  assert.deepEqual(JSON.parse(calls[2].init.body), { action: 'done', show: 4, id: 9, status: 'skipped', why: 'owner' });
  assert.equal(JSON.parse(calls[3].init.body).next, '2026-10-03T20:00:00.000Z');
  assert.deepEqual(JSON.parse(calls[4].init.body), { action: 'back', show: 4, id: 10 }, 'a question back in line (she was paused)');
  const refused = liveSite({ site: 'https://agi1.app', secret: 'x'.repeat(40), fetchFn: async () => Response.json({ error: 'unauthorized' }, { status: 401 }) });
  await assert.rejects(refused.start('live'), (e) => e.status === 401 && /start: HTTP 401 unauthorized/.test(e.message));
  // a site address that redirects (another host would drop LIVE_SECRET on the way): never followed, said plainly
  assert.ok(calls.every((c) => c.init.redirect === 'manual'));
  const moved = liveSite({ site: 'https://agi1.app', secret: 'x'.repeat(40), fetchFn: async () => new Response(null, { status: 308, headers: { location: 'https://www.agi1.app/api/live' } }) });
  await assert.rejects(moved.beat(4, 'live'), /redirects to https:\/\/www\.agi1\.app\/api\/live: set SITE_URL in live\.env/);
  let t = 0;
  const demo = demoSite({ every: 10_000, now: () => t });
  assert.equal((await demo.start()).show, 1);
  assert.equal((await demo.beat()).waiting, 1);
  const first = await demo.next();
  assert.equal(first.question.text, DEMO_QA[0].text);
  assert.deepEqual(await demo.next(), { none: true }, 'the next one comes later');
  t = 10_000;
  const second = await demo.next();
  assert.ok(second.question);
  await demo.back(1, second.question.id);
  assert.equal((await demo.next()).question.text, second.question.text, 'put back: the same one again');
  for (const qa of DEMO_QA) assert.ok(!isCrude(qa.reply) && !/\b(babe|cutie)\b/.test(qa.reply));
});

// (2026-10-06, the owner's first real setup on the server: --check said NO for a right LIVE_SECRET, and agi1.app redirects)
test("--check: the site takes this server's LIVE_SECRET (a beat for a show that can never be on); www.agi1.app by default", async () => {
  const calls = [];
  const site = (answer) => ({ beat: async (...a) => { calls.push(a); if (answer instanceof Error) throw answer; return answer; } });
  const err = (status, message) => Object.assign(new Error(message), { status });
  assert.deepEqual(await secretAccepted(site({ ok: false, why: 'old_show' })), { ok: true, why: 'old_show' });
  assert.deepEqual(calls[0], [PROBE_SHOW, 'live', null, null], 'a show that can never be on: the site changes nothing');
  assert.ok(Number.isSafeInteger(PROBE_SHOW) && PROBE_SHOW > 0, "the site's own id rule takes it (show 0 was a bad request)");
  assert.equal((await secretAccepted(site(err(401, 'beat: HTTP 401 unauthorized')))).ok, false, 'a wrong key');
  assert.match((await secretAccepted(site(err(401, 'beat: HTTP 401 unauthorized')))).why, /401/);
  assert.equal((await secretAccepted(site(err(400, 'beat: HTTP 400 bad_request')))).ok, true, 'a 400 only comes after the key was taken');
  assert.equal((await secretAccepted(site(err(503, 'beat: HTTP 503 busy')))).ok, false);
  // agi1.app redirects to www (and the show never follows a redirect with its key): www is the default everywhere
  assert.equal(parseArgs([], {}).site, 'https://www.agi1.app');
  assert.equal(liveSite({ secret: 'x'.repeat(40) }).base, 'https://www.agi1.app');
  assert.match(read('tools/live/live.env.example'), /^SITE_URL=https:\/\/www\.agi1\.app$/m);
});

test("--warm goes at Google's pace: a pause after each line it made, and a line that got \"wait\" waits and is tried again (the first --warm made 11 of 121)", async () => {
  // Google with a limit a minute: "wait" (429) past it, and her voice then rests a minute (like createVoice)
  const fakeGoogle = (perMinute) => {
    const g = { t: 0, asked: [], rest: 0, made: new Set(), refused: 0 };
    g.voice = {
      restingUntil: (x) => (g.rest > x ? g.rest : 0),
      async speak(text, { now }) {
        assert.equal(typeof now, 'function', 'the warm-up hands its clock on');
        if (g.made.has(text)) return { by: 'vertex (kept)' };
        if (g.rest > g.t) return null;
        const minute = Math.floor(g.t / 60_000);
        g.asked.push(minute);
        if (g.asked.filter((m) => m === minute).length > perMinute) { g.refused += 1; g.rest = g.t + 60_000; return null; }
        g.t += 2000;                                   // Google takes 2 s a line
        g.made.add(text);
        return { by: 'vertex' };
      },
    };
    g.opts = (extra = {}) => ({ now: () => g.t, sleep: async (ms) => { g.t += ms; }, ...extra });
    return g;
  };
  const lines = Array.from({ length: 30 }, (_, i) => ({ text: `line ${i}`, mood: 'neutral' }));
  // at the pace --warm uses: Google never says "wait" (10 a minute), and every line is made
  let g = fakeGoogle(10);
  assert.equal(await warmUp(g.voice, lines, g.opts({ gapMs: WARM_GAP_MS })), 30);
  assert.equal(g.refused, 0, 'never more than Google takes');
  assert.ok(Math.max(...[...new Set(g.asked)].map((m) => g.asked.filter((x) => x === m).length)) <= 8, 'about 8 a minute');
  // kept lines: nothing asked, no pause
  const t0 = g.t;
  assert.equal(await warmUp(g.voice, lines, g.opts({ gapMs: WARM_GAP_MS })), 30);
  assert.equal(g.t, t0, 'kept: no waiting at all');
  // a stricter Google (3 a minute) and no pause: "wait" happens, and each line waits and is tried again, none skipped
  g = fakeGoogle(3);
  const said = [];
  assert.equal(await warmUp(g.voice, lines, g.opts({ log: (m) => said.push(m) })), 30, 'every line, not 3 of them');
  assert.ok(g.refused > 0 && said.some((m) => /waiting \d+ s: Google takes about 10 a minute/.test(m)));
  // the way it was (no retries): only the lines before the first "wait"
  g = fakeGoogle(3);
  assert.ok(await warmUp(g.voice, lines, g.opts({ tries: 1 })) < 30);
  // never past `until`: a rest that ends after it stops the warm-up, nothing more is asked
  g = fakeGoogle(3);
  assert.ok(await warmUp(g.voice, lines, g.opts({ until: 40_000 })) < 30);
  assert.ok(g.t <= 60_000, 'it didn\'t wait out a rest past "until"');
  // the real voice: after Google's "wait" she rests a minute, and says until when (0 while another way can speak)
  const fetchFn = async (url) => (String(url).includes('aiplatform')
    ? new Response('{"error":{"code":429,"message":"Resource exhausted. Please try again later.","status":"RESOURCE_EXHAUSTED"}}', { status: 429 })
    : new Response('{}', { status: 500 }));
  const dir = mkdtempSync(join(tmpdir(), 'agi1-rest-'));
  const v = createVoice({ ...voiceSettings({ LIVE_GCP_API_KEY: 'k'.repeat(39), LIVE_VOICES: 'vertex' }), cacheDir: dir }, { fetchFn, log: { warn() {} } });
  assert.equal(v.restingUntil(1_000), 0, 'nothing asked yet: she can be asked');
  assert.equal(await v.speak('hello there, a line for the show', { keep: true, now: () => 1_000_000 }), null);
  assert.equal(v.restingUntil(1_000_000), 1_060_000, 'a minute after "wait"');
  assert.equal(v.restingUntil(1_060_001), 0);
  rmSync(dir, { recursive: true, force: true });
});

// ---------- her set's page, the image ----------
test('her set: "AI-generated · not financial advice" and "Ask me at agi1.app/live" always on screen, text only, no network', () => {
  const html = read('tools/live/page/index.html');
  assert.match(html, /<span class="label">AI-generated · not financial advice<\/span>/);
  assert.match(html, /Ask me at <b>agi1\.app\/live<\/b>/);
  assert.match(html, /18\+ · PG-13 · I'm an AI · only \$AGI here/);
  const js = read('tools/live/page/stage.js');
  assert.doesNotMatch(js, /innerHTML|insertAdjacentHTML|document\.write|fetch\(|XMLHttpRequest|WebSocket/);
  assert.doesNotMatch(js.replace(/\/\/.*$/gm, ''), /https?:\/\//, 'no outside address');
  assert.match(js, /textContent/);
  const css = read('tools/live/page/stage.css');
  assert.match(css, /\.label[\s\S]*text-transform: uppercase/);
  assert.doesNotMatch(css, /url\((?!'\/fonts\/)/, 'only its own fonts');
  // not part of the website
  assert.doesNotMatch(read('vite.config.js'), /tools\/live/);
  assert.match(read('.gitignore'), /^tools\/live\/cache\/$/m);
  assert.match(read('.gitignore'), /^tools\/live\/live\.env$/m);
});

test('the Docker image: Playwright\'s Chromium with ffmpeg and Xvfb, never root, no secrets copied in', () => {
  const docker = read('tools/live/Dockerfile');
  const version = /playwright:v(\d+\.\d+\.\d+)-noble/.exec(docker)?.[1];
  assert.ok(version, 'a pinned Playwright image');
  assert.match(docker, new RegExp(`playwright-core@${version.replace(/\./g, '\\.')}`), 'playwright-core: the image\'s own version');
  assert.match(docker, /apt-get install -y --no-install-recommends ffmpeg xvfb/);
  assert.match(docker, /^USER pwuser$/m);
  assert.match(docker, /ENTRYPOINT \["node", "tools\/live\/run\.mjs"\]/);
  assert.match(docker, /run\.mjs --build/);
  assert.match(docker, /^ENV LIVE_OUT_DIR=\/out$/m, 'the owner\'s files go to a mounted folder (the app\'s own folder is read-only for its user)');
  assert.match(docker, /chown -R pwuser:pwuser tools\/live\/cache \/out/);
  const ignore = read('.dockerignore').split('\n');
  for (const must of ['node_modules', '.git', '.env', '.env.*', 'tools/live/live.env', '*-gcp-key.json', 'google-key.json', 'telegram memories']) assert.ok(ignore.includes(must), must);
  const example = read('tools/live/live.env.example');
  for (const k of ['SITE_URL', 'LIVE_SECRET', 'LIVE_RTMP_URL', 'LIVE_STREAM_KEY', 'GOOGLE_APPLICATION_CREDENTIALS', 'LIVE_MINUTES', 'LIVE_DAILY_AT', 'LIVE_AV_MS']) assert.match(example, new RegExp(`^#? ?${k}=`, 'm'), k);
  assert.match(example, /^LIVE_SECRET=$/m, 'the template has no secret in it');
  assert.match(example, /^LIVE_STREAM_KEY=$/m);
});
