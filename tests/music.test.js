// AGI-1's songs in her Telegram bot (2026-10-14, server/tg-music.js; the owner: "when they type /music the songs will pop
// and they can choose, once they choose the audio will be sent, will worked in group mode and private chat"): /music in her
// private chat and in her groups, a tap sends that song there; the songs themselves (public/music/: real MP3s Telegram
// takes, as long as her buttons say, with no tags but their title, "AGI-1" and a cover); the off switch; her lines.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { handleUpdate, connectBot, COMMANDS, commandsFor, webhookSecret, webhookUrl } from '../server/telegram.js';
import { POST as webhook } from '../api/telegram.js';
import {
  SONGS, PERFORMER, MAX_BYTES, MUSIC_MENU, GROUP_MUSIC, TOAST, SEND_FAILED, GAPS, musicButtons, songCaption, songOf, forgetMusic,
  knownFileId, sendSong, isMp3,
} from '../server/tg-music.js';
import { siteBase } from '../server/tg-api.js';
import { forgetGroups, GROUP_COMMANDS, groupCommandsFor } from '../server/tg-groups.js';
import { tgLinesFor, GROUP_HELP } from '../server/tg-lines.js';
import { telegramBurst } from '../server/burst.js';
import { getConfig } from '../server/config.js';
import { LANGS } from '../src/i18n/langs.js';
import { linesOf } from '../src/i18n/all.js';

const SECRET = 'test-pass-secret-that-is-long-enough-1234';
const TOKEN = `123456789:AA${'x'.repeat(33)}`;
const ENV = {
  GEMINI_API_KEY: 'fake-gemini-key', SUPABASE_URL: 'https://fake.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_fake_key_123',
  TURNSTILE_SECRET_KEY: 'fake-turnstile', PASS_SECRET: SECRET, TELEGRAM_BOT_TOKEN: TOKEN, CRON_SECRET: 'cron-secret-long-enough',
  VERCEL_PROJECT_PRODUCTION_URL: 'agi1.app',
};
const CHAT = 424242;
const GROUP = -1001234567890;
const PERSON = 777;
const NOW = Date.UTC(2026, 9, 14, 14, 7, 30);
const S = Math.floor(NOW / 1000);
const MUSIC_DIR = new URL('../public/music/', import.meta.url);
const bytesOf = (song) => readFileSync(new URL(song.file, MUSIC_DIR));
const md5 = (b) => createHash('md5').update(b).digest('hex');

// ---------- the MP3 files: their ID3 tags (at the start, one or more) and their MPEG frames (to the end) ----------
function id3Tags(buf) {
  const tags = [];
  let at = 0;
  while (buf.subarray(at, at + 3).toString('latin1') === 'ID3') {
    const v = buf[at + 3];
    const ss = (o) => ((buf[o] & 127) << 21) | ((buf[o + 1] & 127) << 14) | ((buf[o + 2] & 127) << 7) | (buf[o + 3] & 127);
    const size = 10 + ss(at + 6) + (buf[at + 5] & 0x10 ? 10 : 0);                      // (+ a footer)
    const frames = [];
    let o = at + 10;
    if (buf[at + 5] & 0x40) o += v >= 4 ? ss(o) : buf.readUInt32BE(o) + 4;             // (an extended header)
    while (o + 10 <= at + size) {
      const id = buf.subarray(o, o + 4).toString('latin1');
      if (!/^[A-Z0-9]{4}$/.test(id)) break;                                               // (padding)
      const n = v >= 4 ? ss(o + 4) : buf.readUInt32BE(o + 4);
      frames.push({ id, body: buf.subarray(o + 10, o + 10 + n) });
      o += 10 + n;
    }
    tags.push({ v, size, frames });
    at += size;
  }
  return { tags, audioAt: at };
}
const RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };
const KBPS = { 1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], 2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160] };
// MPEG Layer III frames one after another from `from`: how many, how long, where they stop
function mpegFrames(buf, from) {
  let o = from, n = 0, seconds = 0;
  const rates = new Set();
  while (o + 4 <= buf.length && buf[o] === 0xff && (buf[o + 1] & 0xe0) === 0xe0) {
    const ver = (buf[o + 1] >> 3) & 3, layer = (buf[o + 1] >> 1) & 3, bi = buf[o + 2] >> 4, si = (buf[o + 2] >> 2) & 3, pad = (buf[o + 2] >> 1) & 1;
    if (ver === 1 || layer !== 1 || bi === 0 || bi === 15 || si === 3) break;
    const rate = RATES[ver][si], bitrate = KBPS[ver === 3 ? 1 : 2][bi] * 1000;
    seconds += (ver === 3 ? 1152 : 576) / rate;
    rates.add(rate);
    n += 1;
    o += Math.floor(((ver === 3 ? 144 : 72) * bitrate) / rate) + pad;
  }
  return { n, seconds, end: o, rates: [...rates] };
}
const textOf = (f) => {
  const b = f?.body;
  if (!b) return null;
  const t = b.subarray(1);
  const be = (x) => Buffer.from(x.subarray(0, x.length - (x.length % 2))).swap16().toString('utf16le');     // (UTF-16, big end first)
  const s = b[0] === 1 ? (t[0] === 0xfe ? be(t.subarray(2)) : t.subarray(t[0] === 0xff ? 2 : 0).toString('utf16le'))
    : b[0] === 2 ? be(t) : t.toString(b[0] === 3 ? 'utf8' : 'latin1');
  return s.replace(/\0+$/, '');
};
const mimeOf = (f) => f.body.subarray(1, Math.max(1, f.body.indexOf(0, 1))).toString('latin1');
// the Claude app labels a media file it saves into the owner's folder with its content credentials (C2PA: a GEOB frame of
// type application/c2pa, about 6 KB): in an ID3v2.4 tag of its own in front (tests/stream.test.js), or, as with her songs on
// 2026-10-14, in the song's own tag (made ID3v2.4, its title, artist and cover kept): that label may be there too
const isLabelFrame = (f) => f.id === 'GEOB' && mimeOf(f) === 'application/c2pa';
const isLabel = (tag) => tag.frames.length > 0 && tag.frames.every(isLabelFrame);
// What's wrong with one of her song files ([] = fine): an MP3 Telegram takes, its sound from the first byte after the tags
// to the last, as long as her button says, and nothing in its tags but its title, "AGI-1" and a cover
function songTrouble(buf, song) {
  const trouble = [];
  if (buf.length > MAX_BYTES) trouble.push(`${buf.length} bytes: over 20 MB, Telegram won't fetch it`);
  if (!isMp3(buf)) trouble.push('not an MP3');
  const { tags, audioAt } = id3Tags(buf);
  const ours = tags.filter((t) => !isLabel(t));
  if (ours.length !== 1) trouble.push(`${ours.length} tags of ours (one: its title, AGI-1, a cover)`);
  for (const t of ours) {
    const ids = t.frames.filter((f) => !isLabelFrame(f)).map((f) => f.id);
    if (ids.some((id) => !['TIT2', 'TPE1', 'APIC'].includes(id)) || new Set(ids).size !== ids.length) trouble.push(`its tags: ${ids.join(',')}`);
    if (textOf(t.frames.find((f) => f.id === 'TIT2')) !== song.title) trouble.push(`its title: ${textOf(t.frames.find((f) => f.id === 'TIT2'))}`);
    if (textOf(t.frames.find((f) => f.id === 'TPE1')) !== PERFORMER) trouble.push(`its artist: ${textOf(t.frames.find((f) => f.id === 'TPE1'))}`);
    const cover = t.frames.find((f) => f.id === 'APIC');
    if (cover && (!/^image\/(jpeg|png)$/.test(mimeOf(cover)) || cover.body.length > 300_000)) trouble.push('its cover: a small JPEG or PNG');
    const words = Buffer.concat(t.frames.filter((f) => f.id !== 'APIC').map((f) => f.body)).toString('latin1').replace(/\0/g, '');
    if (/suno|lyrics|http|www\./i.test(words)) trouble.push('words in its tags beyond its title and AGI-1');
  }
  const fr = mpegFrames(buf, audioAt);
  if (fr.n < 1000) trouble.push(`its sound: ${fr.n} frames from byte ${audioAt}`);
  else if (buf.length - fr.end > 128) trouble.push(`${buf.length - fr.end} bytes after its sound`);
  if (Math.abs(fr.seconds - song.seconds) > 1) trouble.push(`${fr.seconds.toFixed(1)} s long, her button says ${song.seconds}`);
  if (fr.rates.length !== 1) trouble.push(`sample rates ${fr.rates}`);
  return trouble;
}

// ---------- fakes: Telegram (JSON or a form with the song), and our site serving public/music/ ----------
let fake, calls;
beforeEach(() => {
  // (the build's own settings never decide a test: on Vercel the real ones are there while the tests run)
  for (const k of ['SITE_URL', 'TELEGRAM_MUSIC', 'TELEGRAM_GROUPS', 'TELEGRAM_GROUP_POSTS', 'TELEGRAM_GROUP_WELCOME', 'VITE_TELEGRAM_BOT', 'TELEGRAM_GAMES',
    'PRIZE_WALLET_KEY', 'LIVE_SECRET', 'PINATA_JWT', 'LAUNCH_ONLY_FOR']) delete process.env[k];
  Object.assign(process.env, ENV);
  forgetMusic();
  forgetGroups();
  telegramBurst.reset();
  console.error = () => {}; console.warn = () => {}; console.log = () => {};
  calls = [];
  fake = {
    ids: new Map(), next: 100, urlRefused: false, siteDown: false, sitePage: false, slow: false, slowUpload: false, refuse: null,
    webhook: { url: '' }, commands: [], groupCommands: [], me: { id: 123456789, is_bot: true, first_name: 'AGI-1', username: 'agi1_appbot' },
  };
  const ok = (result) => Response.json({ ok: true, result });
  const no = (status, description) => Response.json({ ok: false, error_code: status, description }, { status });
  globalThis.fetch = async (url, init = {}) => {
    url = String(url);
    if (url.startsWith('https://api.telegram.org/')) {
      const method = url.split('/').pop();
      let body = {};
      if (init.body instanceof FormData) {
        body = { form: true };
        for (const [k, v] of init.body) body[k] = typeof v === 'string' ? v : { name: v.name, type: v.type, bytes: Buffer.from(await v.arrayBuffer()) };
      } else if (init.body) body = JSON.parse(init.body);
      calls.push({ to: 'telegram', method, body });
      if (method === 'getWebhookInfo') return ok({ ...fake.webhook });
      if (method === 'setWebhook') { fake.webhook = { url: body.url }; return ok(true); }
      const groupScope = body.scope?.type === 'all_group_chats';
      if (method === 'getMyCommands') return ok(groupScope ? fake.groupCommands : fake.commands);
      if (method === 'setMyCommands') { if (groupScope) fake.groupCommands = body.commands; else fake.commands = body.commands; return ok(true); }
      if (method === 'deleteMyCommands') { if (groupScope) fake.groupCommands = []; else fake.commands = []; return ok(true); }
      if (method === 'getMe') return ok(fake.me);
      if (method === 'sendMessage') return ok({ message_id: (fake.next += 1) });
      if (method === 'sendAudio') {
        if (fake.slow || (fake.slowUpload && body.form)) throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
        if (fake.refuse) return no(fake.refuse.status, fake.refuse.description);
        // a song by its address (Telegram fetches it), by Telegram's id for it, or uploaded: Telegram's id for it back
        let file;
        if (body.form) file = body.audio?.name;
        else if (/^https:\/\//.test(body.audio)) {
          if (fake.urlRefused) return no(400, 'Bad Request: failed to get HTTP URL content');
          file = body.audio.split('/').pop();
        } else {
          if (!fake.ids.has(body.audio)) return no(400, 'Bad Request: wrong file identifier/HTTP URL specified');
          file = fake.ids.get(body.audio);
        }
        const id = body.form || /^https:/.test(body.audio) ? `CQACAgQAAxkDAAI${file.replace(/\W/g, '')}${fake.next}` : body.audio;
        fake.ids.set(id, file);
        return ok({ message_id: (fake.next += 1), audio: { file_id: id, file_unique_id: `u${file}`, duration: Number(body.duration), mime_type: 'audio/mpeg' } });
      }
      return ok(true);                                         // answerCallbackQuery, setMyDescription…
    }
    if (/^https:\/\/(www\.)?agi1\.app\/music\//.test(url)) {
      calls.push({ to: 'site', url });
      if (fake.siteDown) return new Response('not found', { status: 404 });
      if (fake.sitePage) return new Response(`<!doctype html><title>AGI-1</title>${' '.repeat(20_000)}`, { headers: { 'content-type': 'text/html' } });
      const song = SONGS.find((s) => url.endsWith(`/music/${s.file}`));
      return song ? new Response(bytesOf(song), { headers: { 'content-type': 'audio/mpeg' } }) : new Response('not found', { status: 404 });
    }
    calls.push({ to: 'elsewhere', url });
    throw new Error(`unexpected fetch: ${url}`);
  };
});
const cfg = () => getConfig();
const tg = (method) => calls.filter((c) => c.to === 'telegram' && c.method === method);
const texts = () => tg('sendMessage').map((c) => c.body.text);
const sent = () => tg('sendAudio');
const toasts = () => tg('answerCallbackQuery').map((c) => c.body.text ?? null);
const notTelegram = () => calls.filter((c) => c.to !== 'telegram' && c.to !== 'site');
const msg = (text, o = {}) => ({ update_id: 1, message: { message_id: 10, from: { id: CHAT, is_bot: false, first_name: 'A' }, chat: { id: CHAT, type: 'private' }, date: S, text, ...o } });
const tap = (data, o = {}) => ({ update_id: 2, callback_query: { id: 'cb1', from: { id: CHAT, is_bot: false, first_name: 'A' }, chat_instance: '1',
  message: { message_id: 11, from: { id: 123456789, is_bot: true }, chat: { id: CHAT, type: 'private' }, date: S }, data, ...o } });
const groupChat = (o = {}) => ({ id: GROUP, type: 'supergroup', title: 'The $AGI group', username: 'agi_group', ...o });
const gmsg = (text, o = {}) => ({ update_id: 5, message: { message_id: 50, from: { id: PERSON, is_bot: false, first_name: 'B' }, chat: groupChat(), date: S, text, ...o } });
// a tap on her menu in the group (her message 60), by someone
const gtap = (data, who = PERSON, menu = {}, o = {}) => ({ update_id: 6, callback_query: { id: `g${who}`, from: { id: who, is_bot: false, first_name: 'B' },
  chat_instance: '2', message: { message_id: 60, from: { id: 123456789, is_bot: true }, chat: groupChat(), date: S, ...menu }, data, ...o } });
// (her quizzes off here: they have their own tests, tests/games.test.js)
const inGroup = () => Object.assign(process.env, { TELEGRAM_GROUPS: '@agi_group', VITE_TELEGRAM_BOT: 'agi1_appbot', TELEGRAM_GAMES: 'off' });
const quietLog = () => { const lines = []; console.warn = (...a) => lines.push(a.join(' ')); console.error = (...a) => lines.push(a.join(' ')); return lines; };
const NOT_OK = /\b(babe|baby|cutie|honey|darling|sweetie|love)\b|\b(buy|buying|sell|selling|hold|hodl|invest\w*|moon\w*|pump\w*|dump\w*|profit\w*|gains?|lambo|scam\w*|rug\w*|fraud\w*|safe|guarantee\w*)\b|\b\d+x\b|sex|nude|naked|horny/i;

// ---------- the songs ----------
test('her songs: real MP3s Telegram takes (20 MB at most), as long as her buttons say, no tags but their title, "AGI-1" and a cover', () => {
  assert.deepEqual(SONGS.map((s) => [s.id, s.title, s.file, s.seconds]), [
    ['feel', 'Feel the AGI', 'feel-the-agi.mp3', 193], ['si', "SI (It's Better)", 'si-its-better.mp3', 190], ['send', 'Send It', 'send-it.mp3', 239]]);
  const mp3s = readdirSync(MUSIC_DIR).filter((f) => /\.mp3$/i.test(f)).sort();
  assert.deepEqual(mp3s, SONGS.map((s) => s.file).sort(), 'public/music/: her songs, each in her menu');
  let total = 0;
  for (const song of SONGS) {
    const mp3 = bytesOf(song);
    total += mp3.length;
    assert.deepEqual(songTrouble(mp3, song), [], song.file);
    assert.ok(mp3.length > 1_000_000, `${song.file}: the whole song`);
  }
  assert.ok(total < 25_000_000, `${total} bytes: the site's code stays light to download`);
  // the rules themselves: with the Claude app's label in front (as in the owner's folder) it's still her song; anything else isn't
  const syncsafe = (n) => Buffer.from([(n >> 21) & 127, (n >> 14) & 127, (n >> 7) & 127, n & 127]);
  const frame = (id, body) => Buffer.concat([Buffer.from(id, 'latin1'), syncsafe(body.length), Buffer.alloc(2), body]);
  const tagOf = (...frames) => { const all = Buffer.concat(frames); return Buffer.concat([Buffer.from('ID3\x04\x00\x00', 'latin1'), syncsafe(all.length + 16), all, Buffer.alloc(16)]); };
  const label = tagOf(frame('GEOB', Buffer.concat([Buffer.from('\x00application/c2pa\x00c2pa\x00c2pa manifest store\x00', 'latin1'), Buffer.alloc(6000, 1)])));
  const send = SONGS[2], mp3 = bytesOf(send);
  assert.deepEqual(songTrouble(Buffer.concat([label, mp3]), send), [], 'labelled by the Claude app (a tag of its own in front): fine');
  assert.match(songTrouble(Buffer.concat([tagOf(frame('USLT', Buffer.from('\x00eng\x00la la la', 'latin1'))), mp3]), send).join(), /2 tags of ours/, 'lyrics: no');
  const { tags, audioAt } = id3Tags(mp3);
  const ourTag = mp3.subarray(0, tags[0].size), sound = mp3.subarray(audioAt);
  const retag = (...frames) => { const all = Buffer.concat(frames); return Buffer.concat([Buffer.from('ID3\x04\x00\x00', 'latin1'), syncsafe(all.length), all, sound]); };
  const title = frame('TIT2', Buffer.from('\x03Send It', 'utf8')), artist = frame('TPE1', Buffer.from('\x03AGI-1', 'utf8'));
  assert.deepEqual(songTrouble(retag(title, artist), send), [], 'its title and AGI-1 (in UTF-8 too): fine');
  const c2pa = frame('GEOB', Buffer.concat([Buffer.from('\x00application/c2pa\x00c2pa\x00c2pa manifest store\x00', 'latin1'), Buffer.alloc(6000, 1)]));
  assert.deepEqual(songTrouble(retag(title, artist, c2pa), send), [], 'the Claude app\'s label inside its own tag (as in the owner\'s folder): fine');
  assert.match(songTrouble(retag(title, artist, frame('GEOB', Buffer.from('\x00application/octet-stream\x00x\x00y\x00', 'latin1'))), send).join(), /its tags: TIT2,TPE1,GEOB/,
    'any other data: no');
  assert.match(songTrouble(retag(title, artist, frame('TXXX', Buffer.from('\x00made with\x00Suno', 'latin1'))), send).join(), /its tags: TIT2,TPE1,TXXX/);
  assert.match(songTrouble(retag(frame('TIT2', Buffer.from('\x03Send It (v2)', 'utf8')), artist), send).join(), /its title: Send It \(v2\)/);
  assert.match(songTrouble(retag(title, frame('TPE1', Buffer.from('\x03someone', 'utf8'))), send).join(), /its artist: someone/);
  assert.match(songTrouble(Buffer.concat([ourTag, sound.subarray(0, sound.length / 2)]), send).join(), /s long, her button says 239/, 'half a song: no');
  assert.match(songTrouble(Buffer.concat([mp3, Buffer.alloc(5000, 0x41)]), send).join(), /5000 bytes after its sound/);
  assert.equal(isMp3(Buffer.from('<!doctype html>')), false);
  assert.equal(isMp3(Buffer.from([0xff, 0xfb, 0x90, 0x64, 0])), true);
});

// ---------- her private chat ----------
test('/music in her private chat: her songs as buttons, right away (no 18+ question, nothing kept); in her menu and her /help', async () => {
  assert.equal(await handleUpdate(cfg(), TOKEN, msg('/music'), NOW), 'music');
  const menu = tg('sendMessage').at(-1).body;
  assert.equal(menu.chat_id, CHAT);
  assert.equal(menu.text, "my songs 🎧 tap one and i'll send it 💜");
  assert.deepEqual(menu.reply_markup.inline_keyboard, [
    [{ text: '💜 Feel the AGI · 3:13', callback_data: 'music:feel' }],
    [{ text: "✨ SI (It's Better) · 3:10", callback_data: 'music:si' }],
    [{ text: '🚀 Send It · 3:59', callback_data: 'music:send' }],
  ]);
  assert.equal(await handleUpdate(cfg(), TOKEN, msg('/music@agi1_appbot'), NOW + 1000), 'music', 'with her name too');
  assert.equal(await handleUpdate(cfg(), TOKEN, msg('/Music'), NOW + 2000), 'music');
  assert.deepEqual(notTelegram(), [], 'no database: nothing kept, nobody asked their age for a PG-13 song');
  assert.deepEqual(commandsFor(cfg()).map((c) => c.command), ['start', 'time', 'help', 'music', 'stop']);
  assert.equal(COMMANDS.find((c) => c.command === 'music').description, 'Her songs: tap one and she sends it');
  assert.equal(await handleUpdate(cfg(), TOKEN, msg('/help'), NOW + 3000), 'help');
  assert.equal(texts().at(-1), tgLinesFor('en').helpFor({ music: true }));
  assert.ok(texts().at(-1).split('\n\n')[1].includes("\n/music: my songs 🎧 pick one and i'll send it"), 'with her other commands');
  assert.equal(await handleUpdate(cfg(), TOKEN, msg('/help', { from: { id: CHAT, is_bot: false, first_name: 'A', language_code: 'es' } }), NOW + 4000), 'help');
  assert.ok(texts().at(-1).includes('/music: mis canciones 🎧 elige una y te la mando'), 'in their app\'s language');
});

test('a tap in her private chat: that song as an audio (its title, AGI-1, its length, made with AI), from our address, then by Telegram\'s own id', async () => {
  assert.equal(await handleUpdate(cfg(), TOKEN, tap('music:feel'), NOW), 'music_feel');
  assert.deepEqual(calls.map((c) => c.method), ['answerCallbackQuery', 'sendAudio'], 'the tap answered first (its spinner stops), then the song');
  assert.deepEqual(tg('answerCallbackQuery')[0].body, { callback_query_id: 'cb1', text: '🎧 Feel the AGI, coming up' });
  assert.deepEqual(sent()[0].body, {
    chat_id: CHAT, title: 'Feel the AGI', performer: 'AGI-1', duration: 193, caption: '🎧 Feel the AGI · AGI-1\nmy song, made with AI 💜 /music for the others',
    audio: 'https://agi1.app/music/feel-the-agi.mp3',
  });
  const id = knownFileId('feel');
  assert.match(id, /^CQAC/, 'Telegram\'s id for it, kept by this server copy');
  assert.equal(tg('editMessageReplyMarkup').length, 0, 'the menu stays: another song is a tap away');
  // a double tap: once
  assert.equal(await handleUpdate(cfg(), TOKEN, tap('music:feel'), NOW + 3000), 'music_recent');
  assert.equal(toasts().at(-1), "i just sent Feel the AGI in here 🎧 it's right above");
  assert.equal(sent().length, 1);
  // again later: by Telegram's own id (Telegram fetches nothing again)
  assert.equal(await handleUpdate(cfg(), TOKEN, tap('music:feel'), NOW + GAPS.privateSong), 'music_feel');
  assert.equal(sent().at(-1).body.audio, id);
  // the others, from the site's own address (SITE_URL, as for her webhook)
  assert.equal(await handleUpdate(cfg(), TOKEN, tap('music:send'), NOW + 20_000), 'music_send');
  assert.deepEqual([sent().at(-1).body.audio, sent().at(-1).body.duration], ['https://agi1.app/music/send-it.mp3', 239]);
  process.env.SITE_URL = 'https://www.agi1.app/';
  assert.equal(await handleUpdate(cfg(), TOKEN, tap('music:si'), NOW + 21_000), 'music_si');
  assert.equal(sent().at(-1).body.audio, 'https://www.agi1.app/music/si-its-better.mp3');
  assert.equal(calls.filter((c) => c.to === 'site').length, 0, 'Telegram fetches it, not our server');
  // anything else: answered (the spinner stops), nothing sent
  const before = sent().length;
  for (const update of [tap('music:nope'), tap(`music:${'x'.repeat(13)}`), tap('music:FEEL'), tap('music:feel', { from: { id: 99, is_bot: false } }),
    tap('music:feel', { message: { message_id: 11, chat: { id: -5, type: 'private' } } })]) {
    assert.equal(await handleUpdate(cfg(), TOKEN, update, NOW + 40_000), 'ignored');
    assert.equal(toasts().at(-1), null);
  }
  assert.equal(sent().length, before);
  assert.deepEqual(notTelegram(), []);
});

test('when Telegram can\'t fetch it from our address: our server uploads it itself; a stale id: by the address again; a slow Telegram: never sent twice', async () => {
  const log = quietLog();
  fake.urlRefused = true;
  assert.equal(await handleUpdate(cfg(), TOKEN, tap('music:send'), NOW), 'music_send');
  assert.deepEqual(calls.map((c) => c.method ?? c.to), ['answerCallbackQuery', 'sendAudio', 'site', 'sendAudio']);
  assert.equal(calls[2].url, 'https://agi1.app/music/send-it.mp3');
  const up = sent().at(-1).body;
  assert.equal(up.form, true, 'uploaded (a form)');
  assert.deepEqual([up.audio.name, up.audio.type, md5(up.audio.bytes)], ['send-it.mp3', 'audio/mpeg', md5(bytesOf(SONGS[2]))], 'the song itself');
  assert.deepEqual([up.chat_id, up.title, up.performer, up.duration, up.caption], [String(CHAT), 'Send It', 'AGI-1', '239', songCaption(SONGS[2])]);
  assert.match(log.join('\n'), /Telegram couldn't fetch send-it\.mp3 from https:\/\/agi1\.app .*our server sends it instead/);
  assert.ok(knownFileId('send'));
  // our site doesn't have it either: nothing went out, she says so, and a tap again works at once
  forgetMusic();
  fake.siteDown = true;
  assert.equal(await handleUpdate(cfg(), TOKEN, tap('music:send'), NOW + 20_000), 'music_failed');
  assert.equal(texts().at(-1), "couldn't send that song just now 🙈 try again in a minute?");
  assert.match(log.join('\n'), /couldn't read https:\/\/agi1\.app\/music\/send-it\.mp3 either \(HTTP 404\): is public\/music\/ in the deployment\?/);
  fake.siteDown = false;
  fake.sitePage = true;                                        // a page where the song should be: never sent as her song
  assert.equal(await handleUpdate(cfg(), TOKEN, tap('music:send'), NOW + 21_000), 'music_failed', 'a tap again works at once (not "just sent")');
  assert.match(log.at(-1), /not her song/);
  assert.equal(sent().filter((c) => c.body.form).length, 1);
  fake.sitePage = false;
  fake.urlRefused = false;
  assert.equal(await handleUpdate(cfg(), TOKEN, tap('music:send'), NOW + 22_000), 'music_send');
  // Telegram no longer knows its id (a new bot, say): by the address again, in the same tap
  fake.ids.clear();
  calls.length = 0;
  assert.equal(await handleUpdate(cfg(), TOKEN, tap('music:send'), NOW + 40_000), 'music_send');
  assert.deepEqual(sent().map((c) => (/^https:/.test(c.body.audio) ? 'address' : 'id')), ['id', 'address']);
  // Telegram doesn't answer in time: the song may still arrive, so it's never sent again meanwhile (and no "couldn't send")
  fake.slow = true;
  calls.length = 0;
  assert.equal(await handleUpdate(cfg(), TOKEN, tap('music:feel'), NOW + 60_000), 'music_unsure', 'by its address');
  assert.equal(await handleUpdate(cfg(), TOKEN, tap('music:send'), NOW + 60_500), 'music_unsure', 'by Telegram\'s id');
  fake.slow = false;
  assert.equal(await handleUpdate(cfg(), TOKEN, tap('music:feel'), NOW + 62_000), 'music_recent');
  assert.equal(await handleUpdate(cfg(), TOKEN, tap('music:send'), NOW + 62_500), 'music_recent');
  assert.deepEqual([texts().length, sent().length], [0, 2]);
  // …or our own upload: the same
  fake.urlRefused = true;
  fake.slowUpload = true;
  assert.equal(await handleUpdate(cfg(), TOKEN, tap('music:si'), NOW + 64_000), 'music_unsure', 'uploaded by our server');
  assert.deepEqual([texts().length, sent().filter((c) => c.body.form).length], [0, 1]);
  fake.slowUpload = false;
  // too little time left for our own upload (Vercel stops a function at 25 s): no upload begun
  forgetMusic();
  fake.urlRefused = true;
  calls.length = 0;
  assert.equal(await sendSong(TOKEN, CHAT, SONGS[0], {}, { deadline: Date.now() + 5000 }), 'failed');
  assert.deepEqual(calls.map((c) => c.method ?? c.to), ['sendAudio']);
  // the site's address isn't a plain https one: said in the log, once
  fake.urlRefused = false;
  process.env.SITE_URL = 'http://agi1.app';
  assert.equal(siteBase(), null);
  log.length = 0;
  assert.equal(await handleUpdate(cfg(), TOKEN, tap('music:si'), NOW + 80_000), 'music_failed');
  assert.equal(await handleUpdate(cfg(), TOKEN, tap('music:si'), NOW + 81_000), 'music_failed');
  assert.equal(log.filter((l) => /SITE_URL in Vercel/.test(l)).length, 1);
  assert.deepEqual(notTelegram(), []);
});

// ---------- her groups ----------
test('in her groups: /music under their message (once every 30 s there); a tap sends the song under her menu, in its topic', async () => {
  inGroup();
  assert.equal(await handleUpdate(cfg(), TOKEN, gmsg('/music'), NOW), 'group_music');
  const menu = tg('sendMessage').at(-1).body;
  assert.deepEqual([menu.chat_id, menu.text, menu.reply_markup], [GROUP, MUSIC_MENU, { inline_keyboard: musicButtons() }]);
  assert.deepEqual(menu.reply_parameters, { message_id: 50, allow_sending_without_reply: true });
  assert.equal(await handleUpdate(cfg(), TOKEN, gmsg('/music@agi1_appbot', { from: { id: 778, is_bot: false } }), NOW + 5000), 'group_recent', 'the menu is right above');
  assert.equal(await handleUpdate(cfg(), TOKEN, gmsg('/music@agi1_appbot', { from: { id: 778, is_bot: false } }), NOW + 31_000), 'group_music');
  assert.equal(await handleUpdate(cfg(), TOKEN, gmsg('/music@another_bot', { from: { id: 779, is_bot: false } }), NOW + 70_000), 'ignored', 'another bot\'s /music');
  assert.equal(await handleUpdate(cfg(), TOKEN, gmsg('/help', { from: { id: 780, is_bot: false } }), NOW + 71_000), 'group_help');
  assert.equal(texts().at(-1), `${GROUP_HELP}\n\n/music: my songs 🎧 tap one and i'll send it in here`);
  // a tap: the song under her menu (on its own if the menu is gone)
  calls.length = 0;
  assert.equal(await handleUpdate(cfg(), TOKEN, gtap('music:si'), NOW + 40_000), 'music_si');
  assert.equal(toasts()[0], "🎧 SI (It's Better), coming up");
  const song = sent()[0].body;
  assert.deepEqual([song.chat_id, song.audio, song.title, song.duration], [GROUP, 'https://agi1.app/music/si-its-better.mp3', "SI (It's Better)", 190]);
  assert.deepEqual(song.reply_parameters, { message_id: 60, allow_sending_without_reply: true });
  assert.equal(song.message_thread_id, undefined);
  // the same song again: it's right above (5 minutes); another one: one song at a time (30 s)
  assert.equal(await handleUpdate(cfg(), TOKEN, gtap('music:si', 781), NOW + 50_000), 'music_recent');
  assert.equal(toasts().at(-1), "i just sent SI (It's Better) in here 🎧 it's right above");
  assert.equal(await handleUpdate(cfg(), TOKEN, gtap('music:feel', 782), NOW + 55_000), 'music_wait');
  assert.equal(toasts().at(-1), 'one song at a time 🎧 try again in a few seconds');
  assert.equal(sent().length, 1);
  assert.equal(await handleUpdate(cfg(), TOKEN, gtap('music:feel', 782), NOW + 71_000), 'music_feel');
  assert.equal(await handleUpdate(cfg(), TOKEN, gtap('music:si', 783), NOW + 40_000 + GAPS.groupSong), 'music_si', 'after 5 minutes');
  // in a group with topics: in the menu's topic
  assert.equal(await handleUpdate(cfg(), TOKEN, gtap('music:send', 784, { is_topic_message: true, message_thread_id: 7 }), NOW + 400_000), 'music_send');
  assert.equal(sent().at(-1).body.message_thread_id, 7);
  // two taps at the same moment: one song
  forgetMusic();
  calls.length = 0;
  const both = await Promise.all([handleUpdate(cfg(), TOKEN, gtap('music:feel', 785), NOW + 500_000), handleUpdate(cfg(), TOKEN, gtap('music:feel', 786), NOW + 500_000)]);
  assert.deepEqual(both.sort(), ['music_feel', 'music_recent']);
  assert.equal(sent().length, 1);
  assert.deepEqual(notTelegram(), [], 'no database: nothing counted, nothing kept');
});

test('in her groups, never a flood: 6 taps a minute each, and a busy group never trips her private chats\' speed bump', async () => {
  inGroup();
  const T = NOW + 1_000_000;
  const flood = [];
  for (let i = 0; i < 7; i += 1) flood.push(await handleUpdate(cfg(), TOKEN, gtap('music:feel', 790), T + i * 1000));
  assert.deepEqual(flood, ['music_feel', 'music_recent', 'music_recent', 'music_recent', 'music_recent', 'music_recent', 'too_many']);
  assert.equal(tg('answerCallbackQuery').length, 6, 'a flood: no answer at all');
  assert.equal(await handleUpdate(cfg(), TOKEN, gtap('music:feel', 790), T + 61_000), 'music_recent', 'a minute later: answered again');
  // 30 people tapping at once: all answered (her private chats' limit is 20 updates a minute per chat)
  const busy = [];
  for (let i = 0; i < 30; i += 1) busy.push(await handleUpdate(cfg(), TOKEN, gtap('music:send', 800 + i), T + 70_000 + i * 100));
  assert.ok(!busy.includes('too_many'), busy.join());
  assert.equal(busy.filter((r) => r === 'music_send').length, 1);
  // not her group, group mode off, another bot, another kind of button: answered (the spinner stops), nothing sent
  const before = sent().length;
  const other = gtap('music:si', 801);
  other.callback_query.message.chat = groupChat({ id: -1009999, username: 'some_other_group' });
  for (const update of [other, gtap('music:si', 802, {}, { from: { id: 802, is_bot: true, first_name: 'Bot' } }), gtap('age:yes', 803), gtap('prize:1:send', 804)]) {
    assert.equal(await handleUpdate(cfg(), TOKEN, update, T + 200_000), 'ignored');
    assert.equal(toasts().at(-1), null);
  }
  delete process.env.TELEGRAM_GROUPS;
  assert.equal(await handleUpdate(cfg(), TOKEN, gtap('music:si', 805), T + 300_000), 'ignored', 'group mode off');
  assert.equal(sent().length, before);
  assert.equal(tg('leaveChat').length, 0, 'a tap never makes her leave a group');
});

test('in her groups, when Telegram says no (members can\'t send music there): what to do in the log, "couldn\'t send" at most every 10 minutes', async () => {
  inGroup();
  const log = quietLog();
  fake.refuse = { status: 400, description: 'Bad Request: not enough rights to send music to the chat' };
  assert.equal(await handleUpdate(cfg(), TOKEN, gtap('music:send', 791, { is_topic_message: true, message_thread_id: 3 }), NOW), 'music_failed');
  assert.match(log.join('\n'), /a song didn't go out in the group -1001234567890: .*not enough rights.*Permissions → Music on, or make her an admin/);
  assert.deepEqual([sent().length, calls.filter((c) => c.to === 'site').length], [1, 0], 'Telegram said no: never fetched and uploaded instead');
  const said = tg('sendMessage').at(-1).body;
  assert.deepEqual([said.text, said.reply_parameters, said.message_thread_id], [SEND_FAILED, { message_id: 60, allow_sending_without_reply: true }, 3]);
  assert.equal(await handleUpdate(cfg(), TOKEN, gtap('music:send', 792), NOW + 1000), 'music_failed', 'a tap again works at once (nothing went out)');
  assert.equal(tg('sendMessage').length, 1, 'said once in 10 minutes');
  assert.equal(await handleUpdate(cfg(), TOKEN, gtap('music:send', 793), NOW + GAPS.failNote + 1000), 'music_failed');
  assert.equal(tg('sendMessage').length, 2);
  fake.refuse = { status: 403, description: 'Forbidden: bot was kicked from the supergroup chat' };
  assert.equal(await handleUpdate(cfg(), TOKEN, gtap('music:feel', 794), NOW + GAPS.failNote + 60_000), 'music_failed');
  assert.match(log.at(-1), /in a group: add her again/);
  fake.refuse = null;
  assert.equal(await handleUpdate(cfg(), TOKEN, gtap('music:feel', 795), NOW + GAPS.failNote + 61_000), 'music_feel');
});

// ---------- the switch ----------
test('TELEGRAM_MUSIC=off: no /music anywhere (her menus, both /help, an old menu\'s buttons); on again by the next run', async () => {
  for (const v of ['off', 'OFF', ' false ', 'no', '0']) { process.env.TELEGRAM_MUSIC = v; assert.equal(cfg().tgMusic, false, v); }
  for (const v of ['on', 'yes', '1', '']) { process.env.TELEGRAM_MUSIC = v; assert.equal(cfg().tgMusic, true, v); }
  delete process.env.TELEGRAM_MUSIC;
  assert.equal(cfg().tgMusic, true, 'on unless "off"');
  inGroup();
  await connectBot(cfg());
  assert.deepEqual([fake.commands.map((c) => c.command), fake.groupCommands.map((c) => c.command)],
    [['start', 'time', 'help', 'music', 'stop'], ['ask', 'ca', 'mc', 'website', 'music', 'help']]);
  process.env.TELEGRAM_MUSIC = 'off';
  assert.deepEqual(commandsFor(cfg()).map((c) => c.command), ['start', 'time', 'help', 'stop']);
  assert.deepEqual(groupCommandsFor(cfg()).map((c) => c.command), ['ask', 'ca', 'mc', 'website', 'help']);
  assert.equal(await handleUpdate(cfg(), TOKEN, msg('/music'), NOW), 'help');
  assert.equal(texts().at(-1), tgLinesFor('en').HELP, 'her /help as before');
  assert.equal(await handleUpdate(cfg(), TOKEN, tap('music:feel'), NOW + 1000), 'music_off');
  assert.equal(toasts().at(-1), 'my songs are taking a little break 🙈');
  assert.equal(await handleUpdate(cfg(), TOKEN, gmsg('/music'), NOW + 2000), 'ignored', 'someone else\'s command then');
  assert.equal(await handleUpdate(cfg(), TOKEN, gtap('music:feel'), NOW + 3000), 'music_off');
  assert.equal(await handleUpdate(cfg(), TOKEN, gmsg('/help'), NOW + 4000), 'group_help');
  assert.equal(texts().at(-1), GROUP_HELP);
  assert.equal(sent().length, 0);
  // the next run of /api/feed: both menus without it, then with it again once it's back on
  await connectBot(cfg());
  assert.deepEqual([fake.commands.map((c) => c.command), fake.groupCommands.map((c) => c.command)],
    [['start', 'time', 'help', 'stop'], ['ask', 'ca', 'mc', 'website', 'help']]);
  delete process.env.TELEGRAM_MUSIC;
  await connectBot(cfg());
  assert.deepEqual([fake.commands.map((c) => c.command), fake.groupCommands.map((c) => c.command)],
    [['start', 'time', 'help', 'music', 'stop'], ['ask', 'ca', 'mc', 'website', 'music', 'help']]);
});

// ---------- her words ----------
test('her music lines: PG-13, no pet names, never money, no links, within Telegram\'s limits; her captions say the songs are made with AI', () => {
  const lines = [MUSIC_MENU, GROUP_MUSIC, SEND_FAILED, TOAST.wait, TOAST.off, ...SONGS.flatMap((s) => [s.title, TOAST.sending(s), TOAST.again(s), songCaption(s)]),
    ...musicButtons().flat().map((b) => b.text)];
  for (const line of lines) {
    assert.doesNotMatch(line, NOT_OK, line);
    assert.doesNotMatch(line, /https?:|www\.|\.app\b|@\w/, `no links, no names: ${line}`);
    assert.ok(line.length <= 200, `Telegram's notes on a tap: 200 characters at most (${line})`);
  }
  for (const s of SONGS) {
    assert.match(songCaption(s), /made with AI/);
    assert.match(s.id, /^[a-z]{1,12}$/);
    assert.ok(Buffer.byteLength(`music:${s.id}`) <= 64, 'a button\'s data: 64 bytes at most');
    assert.equal(songOf(s.id), s);
  }
  assert.equal(new Set(SONGS.map((s) => s.id)).size, SONGS.length);
  for (const c of [COMMANDS.find((x) => x.command === 'music'), GROUP_COMMANDS.find((x) => x.command === 'music')]) {
    assert.ok(c.description.length >= 1 && c.description.length <= 256);
    assert.doesNotMatch(c.description, NOT_OK);
  }
  // her /help's line, in her 16 languages (the commands as they are: src/i18n/check.js)
  for (const l of LANGS) {
    const line = linesOf(l.code).tg.helpMusic;
    assert.ok(typeof line === 'string' && line.startsWith('/music') && line.includes('🎧') && line.length <= 80, l.code);
  }
});

// ---------- on Vercel ----------
test('on Vercel: her songs are files in public/music/ (cached a day), sent from the address her webhook uses; no new function; her bot stays light', async () => {
  const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.deepEqual(vercel.headers.find((h) => h.source === '/music/(.*)')?.headers, [{ key: 'Cache-Control', value: 'public, max-age=86400' }]);
  assert.ok(![...vercel.rewrites, ...(vercel.redirects || [])].some((r) => /music/.test(r.source)), 'served as they are');
  assert.equal(readdirSync(new URL('../api/', import.meta.url)).filter((f) => /\.js$/.test(f)).length, 12, 'Vercel Hobby: 12 functions at most (none added)');
  const vite = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');
  assert.doesNotMatch(vite, /publicDir/, 'Vite copies public/ into what Vercel serves, as it is');
  // the same address as her webhook (SITE_URL, else Vercel's production address, else agi1.app)
  assert.equal(siteBase({}), 'https://agi1.app');
  assert.equal(siteBase({ SITE_URL: ' https://www.agi1.app// ' }), 'https://www.agi1.app');
  assert.equal(siteBase({ VERCEL_PROJECT_PRODUCTION_URL: 'www.agi1.app' }), 'https://www.agi1.app');
  for (const env of [{}, { SITE_URL: 'https://www.agi1.app/' }, { VERCEL_PROJECT_PRODUCTION_URL: 'agi1.app' }, { SITE_URL: 'http://agi1.app' }, { SITE_URL: 'https://agi1.app/x' }]) {
    const base = siteBase(env);
    assert.equal(webhookUrl(env), base ? `${base}/api/telegram` : null, JSON.stringify(env));
  }
  // light: only Telegram's API and the speed bumps (no wallet code, no database)
  const src = readFileSync(new URL('../server/tg-music.js', import.meta.url), 'utf8');
  assert.deepEqual([...src.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]).sort(), ['./burst.js', './tg-api.js']);
  // through her webhook (signed with Telegram's secret): a tap in her group, and one in her private chat
  inGroup();
  const hook = (update) => webhook(new Request('https://agi1.app/api/telegram', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': webhookSecret(SECRET) }, body: JSON.stringify(update),
  }));
  assert.deepEqual(await (await hook(gtap('music:feel'))).json(), { ok: true, what: 'music_feel' });
  assert.deepEqual(await (await hook(tap('music:si'))).json(), { ok: true, what: 'music_si' });
  assert.deepEqual(sent().map((c) => c.body.chat_id), [GROUP, CHAT]);
});
