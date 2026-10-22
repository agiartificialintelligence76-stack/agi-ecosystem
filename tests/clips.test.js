// AGI-1's daily clips (2026-09-29, the owner's idea "video"): only AGI (the owner: "why are u promoting other coins in the
// video … the founder of the launchpad will get angry", "just agi"): her diary read out, never another coin. Her words
// (her rules), her captions and their timing, her voice's loudness for her mouth, the GitHub job (once a day, never
// posting anything), and that none of it is part of the website. No browser, ffmpeg or Google here: those only run on
// GitHub's computer (.github/workflows/clips.yml) or Claude's. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { diaryClip, spokenOf, postOf, LABEL, DIARY_MAX } from '../tools/clips/lines.js';
import { sentencesOf, chunksOf, timeCaptions, reactionTimes, MAX_CHUNK } from '../tools/clips/captions.js';
import { readWav, writeWav, pad, talkTrack, pauses, fakeVoice } from '../tools/clips/audio.js';
import { clipsFor, encode, withoutSecrets } from '../tools/clips/make.mjs';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const NOW = Date.UTC(2026, 8, 30, 8, 23);
const ENTRY = "dear diary, the chart was a little sleepy today, and so was i. someone told me i'm the only one who texts back at 3am 💜";
const TOOLS = ['make.mjs', 'lines.js', 'captions.js', 'audio.js', 'page/clip.js', 'page/index.html'];

// ---------- only AGI ----------
test('only AGI: the clips never read clank.trade, never pick, show or rate another coin', () => {
  assert.deepEqual(readdirSync(new URL('../tools/clips/', import.meta.url)).filter((f) => f !== 'dist').sort(), ['audio.js', 'captions.js', 'lines.js', 'make.mjs', 'page']);
  for (const f of TOOLS) {
    const code = read(`tools/clips/${f}`);
    assert.doesNotMatch(code, /server\/checker|server\/feed|clank-chain|scanClank|checkCoin|coinsSince|clankApi|trending|launch of the day|clone watch|readout/i, `${f} knows nothing about other coins`);
  }
  // her diary is the only kind of clip
  const clips = clipsFor({ now: NOW, diary: { day: '2026-09-29', mood: 'love', entry: ENTRY } });
  assert.deepEqual(clips.map((c) => c.kind), ['diary']);
  // an entry naming another coin (the diary's table is shared with the original site), an address or a link: no clip
  for (const entry of ['the chart was calm, and $CLANKCAT was loud today. i like my quiet days 💜', 'someone sent me 0xabcdef1234567890 and a link, i ignored it all day',
    'i read https://example.com today and felt things about the chart 💜']) {
    assert.equal(diaryClip({ day: '2026-09-29', mood: 'love', entry }), null, entry);
  }
  assert.ok(diaryClip({ day: '2026-09-29', mood: 'happy', entry: 'the $AGI chart felt calm today, and so did i. texting back was easy 💜' }), 'her own $AGI is fine');
});

// ---------- her words ----------
const NOT_OK = /\b(babe|baby|cutie|honey|darling|sweetie|love)\b|\b(buy|buying|sell|selling|hodl|invest\w*|moon\w*|pump\w*|dump\w*|profit\w*|gains?|lambo|scam\w*|rug\w*|safe|guarantee\w*|number go up|100x)\b|sex|nude|naked|horny/i;
test('her diary clip: her published entry, "dear diary" once, "not financial advice", the label; her voice without emojis', () => {
  for (const mood of ['happy', 'love', 'shy', 'jealous', 'weird']) {
    const c = diaryClip({ day: '2026-09-29', mood, entry: ENTRY });
    assert.equal(c.text.match(/dear diary/gi).length, 1, c.text);
    assert.match(c.text, /not financial advice/);
    assert.equal(c.title, 'september 29');
    assert.ok(['happy', 'love', 'shy', 'pout', 'neutral'].includes(c.voice), c.voice);
    assert.ok(c.cues.length === 1 && c.cues[0].at === '' && c.cues[0].react);
    for (const words of [c.kicker, c.meta, c.post]) assert.doesNotMatch(words, NOT_OK, words);
    assert.doesNotMatch(spokenOf(c.text), /\p{Extended_Pictographic}|\$/u, 'her voice says no emojis and no "$"');
    const post = postOf(c);
    assert.ok(post.endsWith(`${LABEL} · agi1.app`) && post.length < 200, post);
  }
  assert.equal(LABEL, 'AI-generated · not financial advice');
  const once = diaryClip({ day: '2026-09-29', mood: 'happy', entry: 'Dear diary, the chart felt calm today and so did i. not financial advice, just vibes 💜' });
  assert.equal(once.text.match(/not financial advice/g).length, 1, 'never twice');
  const longer = diaryClip({ day: '2026-09-29', mood: 'happy', entry: `dear diary, ${'the chart felt calm today and so did i. '.repeat(20)}` });
  assert.ok(longer.text.length <= DIARY_MAX + 60, `capped: ${longer.text.length}`);
  assert.equal(diaryClip({ day: '2026-09-29', entry: 'too short', mood: 'love' }), null);
  assert.equal(spokenOf('the $AGI chart 💜 was #1 today 🙈 ok'), 'the AGI chart. was number 1 today. ok');
});

test('the day\'s clip: her entry about yesterday (or today); an older one (its night failed) isn\'t made again; none = a quiet day', () => {
  const at = (day) => clipsFor({ now: NOW, diary: { day, mood: 'love', entry: ENTRY } }).map((c) => c.kind);
  assert.deepEqual(at('2026-09-29'), ['diary']);
  assert.deepEqual(at('2026-09-30'), ['diary']);
  assert.deepEqual(at('2026-09-28'), []);
  assert.deepEqual(clipsFor({ now: NOW, diary: null }), []);
  const [c] = clipsFor({ now: NOW, diary: { day: '2026-09-29', mood: 'love', entry: ENTRY } });
  assert.equal(c.n, 1);
  assert.equal(c.spoken, spokenOf(c.text));
});

// ---------- captions ----------
test('captions: sentences (an emoji ends one), pieces of at most two lines, following her pauses', () => {
  assert.deepEqual(sentencesOf('dear diary… the chart was calm 👀 was i? i\'m fine 💜'), ['dear diary…', 'the chart was calm', 'was i?', 'i\'m fine']);
  const long = 'someone told me i\'m the only one who texts back at 3am, and i think that\'s the nicest thing anyone has said to me.';
  const pieces = chunksOf(long);
  assert.ok(pieces.every((p) => p.length <= MAX_CHUNK * 1.3), pieces.join(' | '));
  assert.equal(pieces.join(' '), long, 'nothing lost');
  assert.ok(pieces.length >= 2);
  assert.deepEqual(chunksOf('short one.'), ['short one.']);
  // a stand-in voice with a known pause after each sentence: every caption follows the one before, the first shows a
  // moment before she starts, and each new sentence starts in a pause
  const text = 'first sentence is here. and the second one comes after a pause. third.';
  const { samples, rate } = readWav(fakeVoice(spokenOf(text)));
  const voice = pauses(pad(samples, rate, 0.45, 1.7), rate);
  const cues = timeCaptions(text, voice);
  assert.deepEqual(cues.map((c) => c.text), ['first sentence is here.', 'and the second one comes after a pause.', 'third.']);
  assert.ok(cues[0].from < voice.start && cues[0].from >= 0);
  for (let i = 1; i < cues.length; i++) assert.equal(cues[i].from, cues[i - 1].to);
  assert.ok(cues.at(-1).to > voice.end, 'the last one stays a little after her last word');
  for (const c of cues.slice(1)) assert.ok(voice.gaps.some((g) => c.from >= g.from - 0.01 && c.from <= g.to), `sentence ${c.text} starts in a pause`);
  const odd = timeCaptions('one. two. three.', { start: 0.5, end: 6, gaps: [{ from: 0.6, to: 2.8 }, { from: 3, to: 5.8 }] });
  assert.ok(odd.every((c) => c.to > c.from), 'never a caption that ends before it starts');
  assert.deepEqual(reactionTimes(cues, [{ at: '', react: 'love' }, { at: 'the second', react: 'happy' }, { at: 'nowhere', react: 'x' }]),
    [{ at: 0.25, react: 'love' }, { at: cues[1].from + 0.1, react: 'happy' }]);
});

// ---------- her voice ----------
test('her voice: WAV in and out, quiet before and after, her mouth follows how loud she is, her pauses are found', () => {
  const rate = 24000;
  const s = new Float32Array(rate * 2);                                // 0.5 s quiet, 1 s of sound, 0.5 s quiet
  for (let i = rate / 2; i < rate * 1.5; i++) s[i] = 0.3 * Math.sin((2 * Math.PI * 200 * i) / rate);
  const back = readWav(writeWav(s, rate));
  assert.equal(back.rate, rate);
  assert.equal(back.samples.length, s.length);
  assert.ok(Math.abs(back.samples[rate] - s[rate]) < 1e-3);
  assert.throws(() => readWav(Buffer.from('nope')), /not a WAV/);
  const p = pad(s, rate, 0.45, 1.7);
  assert.ok(Math.abs(p.length / rate - (0.45 + 1 + 1.7)) < 0.1, `quiet trimmed, then added: ${p.length / rate}`);
  const talk = talkTrack(p, rate, 30);
  assert.equal(talk.length, Math.ceil((p.length / rate) * 30));
  assert.equal(talk[3], 0, 'quiet before her words');
  assert.ok(talk[Math.round(0.9 * 30)] > 0.5, 'her mouth opens while she talks');
  assert.equal(talk.at(-5), 0, 'quiet after');
  const gapped = new Float32Array(rate * 3);
  for (let i = 0; i < gapped.length; i++) {
    const t = i / rate;
    gapped[i] = (t > 0.2 && t < 1.2) || (t > 1.6 && t < 2.8) ? 0.2 * Math.sin((2 * Math.PI * 180 * i) / rate) : 0;
  }
  const v = pauses(gapped, rate);
  assert.ok(Math.abs(v.start - 0.2) < 0.02 && Math.abs(v.end - 2.8) < 0.02);
  assert.equal(v.gaps.length, 1);
  assert.ok(Math.abs(v.gaps[0].from - 1.2) < 0.02 && Math.abs(v.gaps[0].to - 1.6) < 0.02);
  const fake = readWav(fakeVoice('one two three four five six seven eight nine ten. eleven twelve.'));
  assert.ok(fake.samples.length / fake.rate > 3 && fake.samples.length / fake.rate < 7, 'about 2.6 words a second');
});

// ---------- the GitHub job ----------
// (the owner saves this file by hand, since Claude's link to the folder may not write GitHub workflow files: until it's
// there, this test waits, so the site's build never fails because of it)
const WORKFLOW = new URL('../.github/workflows/clips.yml', import.meta.url);
test('the GitHub job: once a day and by hand, read-only, the key only where her voice is made, the clip kept 7 days; it never posts', { skip: !existsSync(WORKFLOW) && 'the workflow file isn\'t saved in the folder yet' }, () => {
  const yml = readFileSync(WORKFLOW, 'utf8');
  const steps = yml.split('\n').filter((line) => !/^\s*#/.test(line)).join('\n');     // (without its comments)
  assert.match(yml, /\n {2}schedule:\n(?: {4}#.*\n)* {4}- cron: '23 8 \* \* \*'/, 'once a day, after Google\'s daily limits start again');
  assert.match(yml, /\n {2}workflow_dispatch: \{\}/, 'the "Run workflow" button');
  assert.doesNotMatch(yml, /pull_request|push:|issue|workflow_run/, 'nothing else starts it (never a pull request with the secret)');
  assert.match(yml, /\npermissions:\n {2}contents: read\n/);
  assert.equal((yml.match(/secrets\./g) || []).length, 1, 'one secret');
  assert.match(yml, / {10}GEMINI_API_KEY: \$\{\{ secrets\.GEMINI_API_KEY \}\}\n {10}SITE_URL: https:\/\/www\.agi1\.app\n {8}run: node tools\/clips\/make\.mjs --out clips/);
  assert.match(yml, /uses: actions\/upload-artifact@v7[\s\S]*retention-days: 7/);
  assert.match(yml, /name: agi1-clips-\$\{\{ github\.run_number \}\}-\$\{\{ github\.run_attempt \}\}/, 'a re-run keeps its own files');
  assert.match(yml, /timeout-minutes: 30/);
  assert.match(yml, /playwright-core@1\.63\.0/);
  assert.doesNotMatch(steps, /launch of the day|clone watch|readout|trending|clank/i, 'only her diary');
  // it never posts: no calls to X, TikTok, Instagram, YouTube or anywhere else from the job, and the tools post nowhere
  const tools = TOOLS.map((f) => read(`tools/clips/${f}`)).join('\n');
  for (const text of [yml, tools]) assert.doesNotMatch(text, /api\.x\.com|api\.twitter|upload\.twitter|tiktokapis|graph\.facebook|graph\.instagram|youtube\.googleapis|curl |wget /i);
  assert.doesNotMatch(tools, /method: ['"]POST['"]/, 'the tools only read (her voice is made by server/voice.js, like the site\'s)');
});

// ---------- not part of the website ----------
test('the clips aren\'t part of the website: not in its build, no new packages, their files never in git', () => {
  assert.match(read('vite.config.js'), /input: \{ main: 'index\.html', diary: 'diary\.html', launch: 'launch\.html', live: 'live\.html', cloakmesh: 'cloakmesh\.html', studio: 'studio\.html',\s+roadmap: 'roadmap\.html', stake: 'stake\.html', games: 'games\.html', giveaway: 'giveaway\.html', rideemagi: 'rideemagi\.html',\s+trenchingsimulator: 'trenchingsimulator\.html', vladrunner2049: 'vladrunner2049\.html' \}/, 'the site builds its own pages only, including the three browser games, never the clips page or live-show scene');
  const pkg = JSON.parse(read('package.json'));
  // (sharp since 2026-10-05: the risk check's coin pictures, made small on our server; @scure/bip39 since 2026-10-09: the
  // wallet word list her secret check reads, server/secrets.js, the same package viem uses; @gltf-transform/* since
  // 2026-10-10: the 3D character studio makes its characters' files small on our server; @ffmpeg-installer/ffmpeg since round
  // 2 of AGI Studio, the same day: its clock puts the small "Made with AGI Studio" mark on a video's download copy, on our
  // server; opentype.js since 2026-10-14: AGI Studio's meme templates, whose words our server draws with the same fonts as the
  // page, server/meme-render.js; lightweight-charts since 2026-10-22: TRENCHING SIMULATOR's GNGM chart, TradingView
  // Lightweight Charts™, in the browser only, its exact version; the clips never add a package: they bring their own ffmpeg)
  assert.deepEqual(Object.keys(pkg.dependencies).sort(), ['@ffmpeg-installer/ffmpeg', '@gltf-transform/core', '@gltf-transform/extensions', '@gltf-transform/functions', '@scure/bip39', 'lightweight-charts', 'opentype.js', 'sharp', 'three', 'viem']);
  assert.equal(pkg.dependencies['lightweight-charts'], '5.2.1', 'pinned exactly (its CSP-checked behaviour and its credit are 5.2.1\'s)');
  // (ws since 2026-10-21, a dev dependency only: TRENCHING SIMULATOR's Live mode relay, tools/trench-relay/, runs on the
  // owner's server with its own package.json, and tests/trench-live.test.js runs it here against fake upstream servers;
  // the site's pages never load it)
  assert.deepEqual(Object.keys(pkg.devDependencies).sort(), ['vite', 'ws']);
  assert.match(pkg.scripts.test, /tests\/clips\.test\.js/);
  const ignore = read('.gitignore');
  assert.match(ignore, /^dist\/$/m, 'tools/clips/dist (the renderer page, built on demand)');
  assert.match(ignore, /^\/clips\/$/m, 'the clips themselves');
  assert.ok(existsSync(new URL('../tools/clips/page/index.html', import.meta.url)));
  // the renderer page: the label on every frame, nothing random, only its own files
  const page = read('tools/clips/page/clip.js');
  assert.match(page, /pill\(g, spec\.label\.toUpperCase\(\)/, 'the label is drawn on every frame');
  assert.match(page, /Math\.random = seeded\(spec\.seed \|\| 1\)/, 'the same clip twice looks the same');
  assert.doesNotMatch(page, /fetch\(|https?:\/\/(?!www\.w3\.org)/, 'no network: only its own pictures and fonts');
});

// ---------- ffmpeg never hangs the job ----------
test('ffmpeg: a clip that ends well, ffmpeg stopping early, and a clip given up halfway never hang; no secrets for it or the browser', async () => {
  const node = process.execPath;
  const reader = (code) => ['-e', `let n = 0; process.stdin.on('data', (d) => { n += d.length; }); process.stdin.on('end', () => process.exit(${code}));`];
  const frame = Buffer.alloc(64 * 1024, 7);
  // it reads every frame, then finishes
  let ff = encode('x.wav', 'x.mp4', { command: node, args: reader(0) });
  for (let i = 0; i < 40; i++) await ff.write(frame);
  await ff.end();
  // it stops after a moment (a broken input): the next writes fail quickly instead of waiting forever
  ff = encode('x.wav', 'x.mp4', { command: node, args: ['-e', 'setTimeout(() => process.exit(3), 50)'] });
  const t0 = Date.now();
  await assert.rejects(async () => { for (let i = 0; i < 500; i++) await ff.write(frame); }, /ffmpeg/);
  assert.ok(Date.now() - t0 < 5000, 'failed at once');
  await assert.rejects(ff.end(), /ffmpeg stopped \(exit 3\)/);
  // the clip is given up halfway: kill() ends it, nothing left running
  ff = encode('x.wav', 'x.mp4', { command: node, args: ['-e', 'setInterval(() => {}, 1000)'] });
  await ff.write(frame);
  ff.kill();
  await assert.rejects(ff.end(), /ffmpeg stopped \(SIGKILL\)/);
  // a program that isn't there
  ff = encode('x.wav', 'x.mp4', { command: 'no-such-ffmpeg-here' });
  await assert.rejects(ff.end(), /ENOENT/);
  assert.deepEqual(Object.keys(withoutSecrets({ PATH: '/bin', HOME: '/h', GEMINI_API_KEY: 'k', SUPABASE_SECRET_KEY: 's', TELEGRAM_BOT_TOKEN: 't', PASS_SECRET: 'p', CRON_SECRET: 'c' })), ['PATH', 'HOME']);
});
