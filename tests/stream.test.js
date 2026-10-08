// Her live show's upgrade (2026-10-07, the owner: "add more actions / can change her clothes / can sing her songs / react to
// her own X posts/videos and replies / can dance / can change places / says if $AGI is pumping / more effects / says a lot
// in stream, not just the same things over and over / move not just steady / make her act like a real streamer", then "she
// will do also what viewers ask her … jump, jump many times, wave, blush, dance, sing … the rap part … the whole song,
// wink, move on the screen"): the stream's side (tools/live/): viewers' requests and what each does on her set, her song,
// her dance songs, her videos and pictures, her X posts and their replies, the director's extras, the stream's sound (48 kHz
// stereo: her voice, her music, her song), her lines for all of it, and the set's lists against the site's. No network, no
// browser, no ffmpeg here (stand-ins for them): the real show was recorded end to end on Claude's computer (CLAUDE.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync, existsSync, readdirSync, utimesSync, mkdirSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { ACTS, ACT_IDS, SONG_PARTS, PART_IDS, OUTFITS, ROOMS, PLACES, COOLDOWN, canList, actOf, actsPrompt } from '../server/live-acts.js';
import { createActs, DOES, actMs, roomFor, outfitFor, nextRoom, nextOutfit } from '../tools/live/acts.js';
import { readSong, partOf, decodeSong, songGain, mouthOf, SONG_LEVEL } from '../tools/live/song.js';
import { listVideos, titleOf, videoArgs, soundArgs, prepareVideo, download, toStereo, MEDIA_NAME, VIDEO_MAX_S } from '../tools/live/media.js';
import { xSettings, createX, mediaOf, postsOf, repliesOf } from '../tools/live/x.js';
import { createShow, nextStep, didStep, PACE, EXTRA_IDS } from '../tools/live/show.js';
import { Mixer, OUT_RATE, ffmpegArgs, parseArgs, chatterSettings, timeFact, dirOf, TOPICS, SONG_ROTATION, serve } from '../tools/live/run.mjs';
import { demoSite, DEMO_QA, DEMO_CHAT } from '../tools/live/site.js';
import * as M from '../tools/live/music.js';
import * as L from '../tools/live/lines.js';
import { ACTIONS, DANCE_IDS, DANCES, GESTURES, IDLES, CAM_ZOOM, JUMP_S, JUMP_UP, jumpAt, createMoves, restArms, REST_ARMS, SPOTS_REST } from '../tools/live/page/moves.js';
import { shoulderLimit } from '../src/stage/agi1-2d-arms.js';
import { OUTFIT_IDS, SHOW_OUTFITS } from '../tools/live/page/outfits.js';
import { ROOM_IDS, SHOW_ROOMS } from '../tools/live/page/rooms.js';
import { isCrude } from '../server/coins.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// ---------- viewers' requests ----------
test("viewers' requests: the site's list and her set's are the same (every request does something on her set, every outfit and room is hers)", () => {
  assert.deepEqual(ACT_IDS, Object.keys(ACTS));
  for (const id of ACT_IDS) assert.ok(DOES[id], `her set knows "${id}"`);
  assert.deepEqual(Object.keys(DOES).sort(), [...ACT_IDS].sort(), 'and nothing else');
  for (const [id, d] of Object.entries(DOES)) {
    if (d.act) assert.ok(ACTIONS[d.act], `${id}: one of her moves (moves.js ACTIONS.${d.act})`);
    if (d.react) assert.ok(['wave', 'shy', 'celebrate'].includes(d.react), id);
  }
  // the owner's own list: jump (many times), wave, blush, dance, sing (parts like the rap, the whole song), wink, move
  for (const id of ['jump', 'wave', 'blush', 'dance', 'sing', 'wink', 'move']) assert.ok(ACT_IDS.includes(id), id);
  for (const p of ['rap', 'whole', 'chorus']) assert.ok(PART_IDS.includes(p), p);
  assert.deepEqual(Object.keys(OUTFITS).sort(), [...OUTFIT_IDS].sort(), 'her outfits: the same on both sides');
  assert.deepEqual(Object.keys(ROOMS).sort(), [...ROOM_IDS].sort(), 'her rooms: the same on both sides');
  for (const id of SHOW_OUTFITS) assert.ok(OUTFITS[id] && L.OUTFIT_LINES[id], id);
  for (const id of SHOW_ROOMS) assert.ok(ROOMS[id] && L.ROOM_LINES[id], id);
  assert.deepEqual(PLACES, ['left', 'right', 'around', 'center']);
  // its words in her prompt: PG-13, only $AGI, no real person, no money words
  for (const t of [...Object.values(ACTS), ...Object.values(OUTFITS), ...Object.values(ROOMS)]) {
    assert.ok(!isCrude(t), t);
    assert.doesNotMatch(t, /\$(?!AGI)\w|\b(buy|sell|pump|moon)\b/i, t);
  }
});

test("what she can do right now (canList), and her answer's request checked against it (actOf): only known ones, a few times at most", () => {
  assert.deepEqual(canList(['jump', 'sing:rap', 'sing:nope', 'sing', 'fly', 'jump', 7, 'x'.repeat(30), 'outfit:cozy']), ['jump', 'sing:rap']);
  assert.deepEqual(canList(null), []);
  const can = ['jump', 'wave', 'spin', 'outfit', 'room', 'move', 'sing:chorus', 'sing:whole', 'blush'];
  assert.deepEqual(actOf({ act: 'jump', times: 3 }, can), { act: 'jump', times: 3 });
  assert.deepEqual(actOf({ act: 'jump', times: 50 }, can), { act: 'jump', times: 5 }, 'five jumps at most');
  assert.deepEqual(actOf({ act: 'jump', times: 0 }, can), { act: 'jump', times: 1 });
  assert.deepEqual(actOf({ act: 'wave', times: 9 }, can), { act: 'wave', times: 3 });
  assert.deepEqual(actOf({ act: 'spin', times: '2' }, can), { act: 'spin', times: 2 });
  assert.deepEqual(actOf({ act: 'blush', times: 4 }, can), { act: 'blush' });
  assert.deepEqual(actOf({ act: 'sing', part: 'whole' }, can), { act: 'sing', part: 'whole' });
  assert.deepEqual(actOf({ act: 'sing', part: 'nope' }, can), { act: 'sing', part: 'chorus' }, 'a part it doesn\'t know: the chorus');
  assert.equal(actOf({ act: 'sing', part: 'rap' }, can), null, 'a part that\'s resting: nothing');
  assert.deepEqual(actOf({ act: 'outfit', to: 'cozy' }, can), { act: 'outfit', to: 'cozy' });
  assert.deepEqual(actOf({ act: 'outfit', to: 'bikini' }, can), { act: 'outfit', to: null }, 'an outfit she doesn\'t have: her next one');
  assert.deepEqual(actOf({ act: 'room', to: 'beach' }, can), { act: 'room', to: 'beach' });
  assert.deepEqual(actOf({ act: 'move', to: 'up' }, can), { act: 'move', to: 'around' });
  assert.equal(actOf({ act: 'dance' }, can), null, 'not on the list right now');
  assert.equal(actOf({ act: 'none' }, can), null);
  assert.equal(actOf({ act: 'twerk' }, can), null, 'nothing that isn\'t hers');
  assert.equal(actOf(null, can), null);
  // her prompt's part: only what she can do now, PG-13, and "later" for what's resting
  const p = actsPrompt(can);
  assert.match(p, /WHAT YOU CAN DO ON STREAM/);
  assert.match(p, /- "jump": jump/);
  assert.match(p, /\(right now: chorus, whole\)/);
  assert.doesNotMatch(p, /"dance"/);
  assert.match(p, /Never anything that isn't PG-13/);
  assert.match(p, /say you'll do it again a little later/);
  assert.equal(actsPrompt([]), '');
});

test("her stream's cooldowns: a sung part rests her singing 6 minutes (the whole song 30), a dance, an outfit, a room a little; reserved as soon as she says yes", () => {
  let t = 0;
  const acts = createActs({ now: () => t });
  const sing = () => acts.can().filter((x) => x.startsWith('sing:'));
  assert.deepEqual(sing(), PART_IDS.map((p) => `sing:${p}`), 'every part at first');
  assert.ok(['jump', 'wave', 'blush', 'wink', 'dance', 'outfit', 'room', 'move'].every((x) => acts.can().includes(x)));
  acts.take({ act: 'sing', part: 'chorus' });
  assert.deepEqual(sing(), [], 'singing rests');
  t = COOLDOWN.sing + 1;
  assert.deepEqual(sing(), PART_IDS.map((p) => `sing:${p}`));
  acts.take({ act: 'sing', part: 'whole' });
  t += COOLDOWN.sing + 1;
  assert.ok(sing().length && !sing().includes('sing:whole'), 'the whole song rests longer');
  t += COOLDOWN.sing_whole;
  assert.ok(sing().includes('sing:whole'));
  acts.take({ act: 'dance' });
  assert.ok(!acts.can().includes('dance') && acts.resting('dance'));
  acts.release({ act: 'dance' });
  assert.ok(acts.can().includes('dance'), 'a question put back in line: free again');
  acts.take({ act: 'jump', times: 5 });
  assert.ok(acts.can().includes('jump'), 'jumps never rest');
  assert.ok(COOLDOWN.sing_whole >= 30 * 60_000 && COOLDOWN.sing >= 5 * 60_000);
  // without her song or her dance songs, never offered
  const none = createActs({ song: false, dance: false });
  assert.ok(!none.can().some((x) => x.startsWith('sing') || x === 'dance'));
  // how long each takes on her set (one at a time)
  assert.equal(actMs({ act: 'blush' }), Math.round(ACTIONS.blush.len * 1000) + 200);
  assert.ok(actMs({ act: 'jump', times: 5 }) > actMs({ act: 'jump', times: 1 }));
  assert.ok(actMs({ act: 'wave', times: 3 }) >= 6000);
  // a room or an outfit: the one asked for, else her next one (never the one she's in, never the stage unasked)
  assert.equal(roomFor({ to: 'beach' }, 'studio'), 'beach');
  assert.equal(roomFor({ to: 'stage' }, 'studio'), 'stage', 'by name: the stage too');
  for (let i = 0; i < 30; i++) {
    const r = nextRoom('cafe', Math.random), o = nextOutfit('cozy', Math.random);
    assert.ok(SHOW_ROOMS.includes(r) && r !== 'cafe' && r !== 'stage', r);
    assert.ok(SHOW_OUTFITS.includes(o) && o !== 'cozy' && o !== 'stage', o);
  }
  assert.notEqual(roomFor({ to: 'studio' }, 'studio'), 'studio', 'asked for the one she\'s in: another one');
  assert.equal(outfitFor({ to: 'gamer' }, 'classic'), 'gamer');
});

// ---------- her song ----------
// An MP3's ID3 tag (at its start): its size and its frames ({ id, mime } : mime for a GEOB frame). The Claude app labels a
// media file it saves into the owner's folder with its content credentials (C2PA: an ID3v2.4 tag whose one frame is a
// GEOB of type application/c2pa, about 6 KB; seen 2026-10-07 on this song in the owner's folder): that label is the only
// tag her song may have.
function id3Of(buf) {
  if (buf.subarray(0, 3).toString('latin1') !== 'ID3') return { size: 0, frames: [] };
  const v = buf[3];
  const syncsafe = (o) => ((buf[o] & 127) << 21) | ((buf[o + 1] & 127) << 14) | ((buf[o + 2] & 127) << 7) | (buf[o + 3] & 127);
  const size = 10 + syncsafe(6);
  const frames = [];
  let o = 10;
  if (buf[5] & 0x40) o += v >= 4 ? syncsafe(10) : buf.readUInt32BE(10) + 4;          // (an extended header)
  while (o + 10 <= size) {
    const id = buf.subarray(o, o + 4).toString('latin1');
    if (!/^[A-Z0-9]{4}$/.test(id)) break;                                             // (padding)
    const n = v >= 4 ? syncsafe(o + 4) : buf.readUInt32BE(o + 4);
    const body = buf.subarray(o + 10, o + 10 + n);
    frames.push({ id, mime: id === 'GEOB' ? body.subarray(1, Math.max(1, body.indexOf(0, 1))).toString('latin1') : null });
    o += 10 + n;
  }
  return { size, frames };
}
const onlyCredentials = (tag) => tag.frames.every((f) => f.id === 'GEOB' && f.mime === 'application/c2pa');

test('her song "Feel the AGI": the owner\'s file (no tags, lyrics or cover), its timing, each part as her set needs it', () => {
  const song = readSong();
  assert.ok(song, 'tools/live/songs/feel-the-agi.json and .mp3');
  const mp3 = readFileSync(song.file);
  assert.ok(mp3.length > 3_000_000 && mp3.length < 6_000_000, `${mp3.length} bytes`);
  // no ID3 tags (only its sound), but the Claude app's content credentials when it's been saved into the owner's folder
  const tag = id3Of(mp3);
  assert.ok(onlyCredentials(tag), `no ID3 tags but the Claude app's content credentials: ${JSON.stringify(tag.frames)}`);
  assert.ok(tag.size < 64 * 1024, 'a label, not a cover');
  assert.ok(mp3[tag.size] === 0xff && (mp3[tag.size + 1] & 0xe0) === 0xe0, 'its sound right after (an MPEG frame)');
  assert.doesNotMatch(mp3.toString('latin1'), /suno|lyrics|newlife|Elon|Marc/i, 'nothing of its tags, lyrics or account');
  // (the rule itself: a label alone passes, any other tag doesn't)
  const syncsafe = (n) => Buffer.from([(n >> 21) & 127, (n >> 14) & 127, (n >> 7) & 127, n & 127]);
  const frame = (id, body) => Buffer.concat([Buffer.from(id, 'latin1'), syncsafe(body.length), Buffer.alloc(2), body]);
  const tagOf = (...frames) => { const all = Buffer.concat(frames); return Buffer.concat([Buffer.from('ID3\x04\x00\x00', 'latin1'), syncsafe(all.length + 16), all, Buffer.alloc(16)]); };
  const c2pa = frame('GEOB', Buffer.concat([Buffer.from('\x00application/c2pa\x00c2pa\x00c2pa manifest store\x00', 'latin1'), Buffer.alloc(300, 1)]));
  const labelled = tagOf(c2pa);
  assert.deepEqual(id3Of(labelled), { size: labelled.length, frames: [{ id: 'GEOB', mime: 'application/c2pa' }] });
  assert.ok(onlyCredentials(id3Of(labelled)));
  assert.ok(!onlyCredentials(id3Of(tagOf(c2pa, frame('TIT2', Buffer.from('\x00Feel the AGI', 'latin1'))))), 'a title: refused');
  assert.ok(!onlyCredentials(id3Of(tagOf(frame('APIC', Buffer.from('\x00image/jpeg\x00\x03\x00', 'latin1'))))), 'a cover: refused');
  assert.ok(!onlyCredentials(id3Of(tagOf(frame('GEOB', Buffer.from('\x00application/octet-stream\x00x\x00y\x00', 'latin1'))))), 'other data: refused');
  const { meta } = song;
  assert.equal(meta.title, 'Feel the AGI');
  assert.ok(Math.abs(meta.seconds - 193.1) < 0.5);
  assert.equal(meta.fps, 50);
  const mouth = mouthOf(meta);
  assert.ok(Math.abs(mouth.length - meta.seconds * 50) < 3, `${mouth.length} values`);
  assert.ok(mouth.every((x) => x >= 0 && x <= 1));
  const open = mouth.filter((x) => x > 0.15).length / mouth.length;
  assert.ok(open > 0.25 && open < 0.85, `her mouth opens while she sings, not all the time: ${open.toFixed(2)}`);
  // its karaoke: the hook only (never a real person's name on screen)
  const words = meta.lines.map((x) => x.text).join(' ');
  assert.doesNotMatch(words, /elon|marc|ilya|sam|zuck|jensen|truth|sixteen|16z|bitcoin|bao/i, words);
  assert.ok(meta.lines.every((x) => x.from < x.to && x.words.every((w, i, a) => i === 0 || w.t >= a[i - 1].t)));
  // each part
  for (const id of PART_IDS) {
    const p = partOf(meta, id);
    const def = SONG_PARTS[id];
    assert.equal(p.part, id);
    assert.ok(p.from >= 0 && p.to <= meta.seconds && p.to > p.from, id);
    assert.ok(Math.abs(p.from - def.from) < 0.01, id);
    assert.ok(Math.abs(p.env.length - p.seconds * 50) <= 2, `${id}: her mouth for all of it`);
    assert.equal(p.step, 20);
    assert.ok(p.lines.every((l) => l.from >= 0 && l.to <= p.seconds + 0.01 && l.words.every((w) => w.t >= -0.31 && w.t <= p.seconds + 0.5)), `${id}: karaoke within it`);
    assert.ok(p.beats.every((b) => b >= 0 && b <= p.seconds) && p.beats.length > p.seconds, `${id}: its beats from its start`);
    assert.ok(p.cues.length && p.cues[0].t === 0 && p.cues.every((c) => DANCE_IDS.includes(c.move) || ['cheer', 'present'].includes(c.move)), `${id}: her moves from its first moment`);
    assert.ok(p.bpm > 110 && p.bpm < 140, `${id}: ${p.bpm}`);
  }
  assert.ok(partOf(meta, 'chorus').lines.length >= 6, 'the chorus has its karaoke');
  assert.equal(partOf(meta, 'rap').lines.length, 0, 'the rap: no words on screen (they name real people)');
  assert.equal(partOf(meta, 'whole').seconds, meta.seconds);
  assert.equal(partOf(meta, 'nope').part, 'chorus');
  assert.equal(readSong('/nowhere'), null);
  // the owner's exception, said where it applies
  assert.match(read('tools/live/song.js'), /the owner's exception/);
});

test("her song's sound: decoded once by ffmpeg (48 kHz stereo) and kept; a level that sits with her voice", async () => {
  const dir = mkdtempSync(join(tmpdir(), 'agi1-song-'));
  const file = join(dir, 'x.mp3');
  writeFileSync(file, 'not really an mp3');
  const calls = [];
  const fake = (cmd, args, opts) => {
    calls.push({ cmd, args, opts });
    const p = new EventEmitter();
    p.stdout = new Readable({ read() {} });
    p.stderr = new EventEmitter();
    setImmediate(() => { const b = Buffer.alloc(48000 * 4); for (let i = 0; i < 48000 * 2; i++) b.writeInt16LE(i % 2 ? 8000 : -8000, i * 2); p.stdout.push(b); p.stdout.push(null); setImmediate(() => p.emit('exit', 0)); });
    return p;
  };
  const pcm = await decodeSong(file, join(dir, 'cache'), { run: fake });
  assert.equal(pcm.length, 48000 * 2);
  const { cmd, args, opts } = calls[0];
  assert.equal(cmd, 'ffmpeg');
  for (const [k, v] of [['-ac', '2'], ['-ar', '48000'], ['-f', 's16le']]) assert.equal(args[args.indexOf(k) + 1], v, k);
  assert.ok(!Object.keys(opts.env).some((k) => /SECRET|KEY|TOKEN/.test(k)), 'no secrets for ffmpeg');
  const again = await decodeSong(file, join(dir, 'cache'), { run: () => { throw new Error('asked again'); } });
  assert.deepEqual([...again.subarray(0, 4)], [...pcm.subarray(0, 4)], 'kept: never decoded twice');
  // its level: RMS 0.13 (her voice's own is about that), never past its peak
  const g = songGain(pcm);
  assert.ok(Math.abs((8000 / 32768) * g - SONG_LEVEL) < 0.005, `${g}`);
  assert.equal(songGain(new Int16Array(100)), 0, 'silence: nothing');
  await assert.rejects(decodeSong(join(dir, 'y.mp3'), join(dir, 'c2'), { run: fake }), /ENOENT|no such file/i);
  rmSync(dir, { recursive: true, force: true });
});

// ---------- her dance songs and the stream's sound ----------
test('her dance songs: upbeat, four on the floor, about half a minute, the same every time, a steady level, never clipping', () => {
  assert.ok(M.DANCE_SONGS.length >= 3);
  const ids = new Set([...M.SONGS, ...M.DANCE_SONGS].map((s) => s.id));
  assert.equal(ids.size, M.SONGS.length + M.DANCE_SONGS.length, 'every song its own name');
  for (const song of M.DANCE_SONGS) {
    assert.ok(song.bpm >= 116 && song.bpm <= 128 && song.drums === 'four' && song.plan === 'dance', song.id);
    const secs = M.songSeconds(song);
    assert.ok(secs > 25 && secs < 40, `${song.id}: ${secs}`);
    assert.equal(M.planOf(song), M.DANCE_PLAN);
  }
  const song = M.DANCE_SONGS[0];
  const a = M.renderSong(song), b = M.renderSong(song);
  assert.ok(a.length === b.length && a.every((x, i) => x === b[i]), 'the same every time');
  let sum = 0, peak = 0, jumps = 0;
  for (let i = 0; i < a.length; i++) { sum += a[i] * a[i]; peak = Math.max(peak, Math.abs(a[i])); if (i && Math.abs(a[i] - a[i - 1]) > 0.25) jumps += 1; }
  const db = 20 * Math.log10(Math.sqrt(sum / a.length));
  assert.ok(db > -22 && db < -18.5, `${db}`);
  assert.ok(peak < 0.85 && jumps === 0);
  // a kick on every beat: the low end hits once a beat, from the very start (she dances from its first beat)
  const beat = Math.round((60 / song.bpm) * M.RATE);
  const low = (at) => { let s = 0; for (let i = at; i < at + 600; i++) s += Math.abs(a[i]); return s / 600; };
  const onBeat = [4, 5, 6, 7, 20, 21].map((k) => low(k * beat + 40)), offBeat = [4, 5, 6, 7, 20, 21].map((k) => low(k * beat + Math.round(beat / 2) + 500));
  assert.ok(onBeat.reduce((x, y) => x + y) > offBeat.reduce((x, y) => x + y) * 1.15, `${onBeat} vs ${offBeat}`);
  assert.ok(Math.abs(a[0]) < 0.01 && Math.abs(a.at(-1)) < 0.01);
  // the music bed rests while something else plays (hush), and comes back slowly after
  const bed = new M.MusicBed([{ song: { title: 'x' }, samples: new Float32Array(M.RATE * 30).fill(1) }]);
  const level = (seconds, talking, hush) => { const out = new Float32Array(Math.round(seconds * M.RATE)); bed.mix(out, talking, hush); return out.at(-1); };
  assert.ok(Math.abs(level(6, false, false) - M.MUSIC_LEVEL.idle) < 0.01);
  assert.ok(level(1.5, false, true) < 0.01, 'hushed in about a third of a second');
  const back = level(0.5, false, false);
  assert.ok(back > 0.05 && back < M.MUSIC_LEVEL.idle - 0.1, 'back up slowly');
});

test('the stream\'s sound: 48 kHz stereo; her voice and her music made twice as fine; her song (or a video\'s sound) on its own, the music resting under it, a little quieter under her voice, cut on demand', async () => {
  assert.equal(OUT_RATE, 48000);
  const args = ffmpegArgs({ display: ':99', out: 'rtmps://x/k' });
  const i = args.indexOf('pipe:0');
  assert.deepEqual(args.slice(i - 7, i + 1), ['-f', 's16le', '-ar', '48000', '-ac', '2', '-i', 'pipe:0'], 'the sound ffmpeg reads: 48 kHz stereo');
  assert.equal(args[args.indexOf('-c:a') + 1], 'aac');
  // a stand-in clock and ffmpeg's pipe
  let t = 0;
  const writes = [];
  const bed = new M.MusicBed([{ song: { title: 'x' }, samples: new Float32Array(M.RATE * 60).fill(0.5) }]);
  const mixer = new Mixer((buf) => writes.push(buf), { now: () => t, lead: 0, bed });
  mixer.begin(0);
  clearInterval(mixer.timer);                     // (this test pumps it itself)
  const at = (sec, ch = 0) => { const pcm = Buffer.concat(writes); return pcm.readInt16LE((Math.round(sec * OUT_RATE) * 2 + ch) * 2) / 32768; };
  t = 3000; mixer.pump();
  assert.ok(Math.abs(at(2.9) - 0.5 * M.MUSIC_LEVEL.idle) < 0.02, `her music alone: ${at(2.9)}`);
  assert.equal(at(2.9, 0), at(2.9, 1), 'the same on both sides');
  // her song: stereo, its own left and right, its fades, its gain; the music rests under it
  const song = new Int16Array(OUT_RATE * 10 * 2);
  for (let k = 0; k < OUT_RATE * 10; k++) { song[k * 2] = 16384; song[k * 2 + 1] = -16384; }
  const play = mixer.playMedia(song, { from: 2, to: 6, gain: 0.5, fadeIn: 0.2, fadeOut: 0.5 });
  assert.equal(play.startAt, 3000);
  assert.equal(play.seconds, 4);
  let result = null;
  play.done.then((r) => { result = r; });
  t = 5000; mixer.pump();
  // (the song is +0.25 on the left and -0.25 on the right; everything else is the same on both: side = the song alone)
  const side = (sec) => (at(sec, 0) - at(sec, 1)) / 2, mid = (sec) => (at(sec, 0) + at(sec, 1)) / 2;
  assert.ok(Math.abs(side(3.05) - 0.25 * 0.25) < 0.01, `fading in: ${side(3.05)}`);
  assert.ok(Math.abs(side(4.5) - 0.25) < 0.01, `left and right as they are: ${at(4.5, 0)} ${at(4.5, 1)}`);
  assert.ok(Math.abs(mid(4.5)) < 0.02, `the music rests under it: ${mid(4.5)}`);
  // her voice over it: the song a little quieter, her voice on both sides
  const voice = mixer.play(new Float32Array(M.RATE).fill(0.4));
  t = 6000; mixer.pump();
  assert.ok(Math.abs(side(5.5) - 0.25 * 0.45) < 0.01, `her song a little quieter under her voice: ${side(5.5)}`);
  assert.ok(Math.abs(mid(5.5) - 0.4) < 0.02, `her voice: ${mid(5.5)}`);
  assert.equal(voice.seconds, 1);
  t = 7500; mixer.pump();
  await new Promise((r) => { setImmediate(r); });
  assert.equal(result, 'done');
  assert.ok(Math.abs(side(6.98)) < 0.02, `faded out at its end: ${side(6.98)}`);
  assert.ok(mid(7.4) > 0.01 && mid(7.4) < 0.5 * M.MUSIC_LEVEL.idle * 0.6, `the music comes back slowly: ${mid(7.4)}`);
  // cut on demand (the owner's pause)
  const p2 = mixer.playMedia(new Float32Array(OUT_RATE * 4).fill(0.3));
  mixer.stopMedia();
  assert.equal(await p2.done, 'cut');
  assert.equal(mixer.playingMedia, false);
  // never past full scale: a loud moment is rounded off, never wrapped around
  mixer.playMedia(new Float32Array(OUT_RATE * 4 * 2).fill(0.9), { gain: 1 });
  mixer.play(new Float32Array(M.RATE).fill(0.9));
  t = 8500; mixer.pump();
  assert.ok(at(8.4) > 0.97 && at(8.4) <= 1, `${at(8.4)}`);
  mixer.end();
});

// ---------- her videos and pictures ----------
test('her videos folder: her own videos (newest first), a few words about each from a .txt beside it; never a huge file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agi1-vids-'));
  writeFileSync(join(dir, 'my_launch-video.mp4'), Buffer.alloc(5000));
  writeFileSync(join(dir, 'my_launch-video.txt'), '\n  my launch video: the whole site in 79 seconds  \nmore');
  writeFileSync(join(dir, 'dance.webm'), Buffer.alloc(5000));
  utimesSync(join(dir, 'dance.webm'), new Date(Date.now() + 10_000), new Date(Date.now() + 10_000));
  writeFileSync(join(dir, 'notes.txt'), 'not a video');
  writeFileSync(join(dir, '.hidden.mp4'), Buffer.alloc(5000));
  writeFileSync(join(dir, 'tiny.mp4'), Buffer.alloc(10));
  mkdirSync(join(dir, 'folder.mp4'));
  const list = listVideos(dir);
  assert.deepEqual(list.map((v) => v.title), ['dance', 'my launch video'], 'videos only, the newest first');
  assert.equal(list[1].about, 'my launch video: the whole site in 79 seconds');
  assert.equal(list[0].about, '');
  assert.deepEqual(listVideos(join(dir, 'nope')), []);
  assert.deepEqual(listVideos(null), []);
  assert.equal(titleOf('AGI-1_Feel_the_AGI_v9_master'), 'AGI 1 Feel the AGI v9 master');
  rmSync(dir, { recursive: true, force: true });
});

test('a video made ready for her TV: VP8 WebM (what her set\'s browser plays), 640 px, no sound in it; its sound 48 kHz stereo; at most 4 minutes; made once, at a lower priority', async () => {
  const v = videoArgs('/in.mp4', '/out.webm');
  const at = (k) => v[v.indexOf(k) + 1];
  assert.equal(at('-c:v'), 'libvpx');
  assert.equal(at('-f'), 'webm');
  assert.equal(at('-t'), String(VIDEO_MAX_S));
  assert.ok(v.includes('-an'), 'no sound in the picture (the stream plays it)');
  assert.match(at('-vf'), /scale='min\(640,iw\)':-2/);
  assert.equal(at('-deadline'), 'realtime');
  const s = soundArgs('/in.mp4');
  for (const [k, val] of [['-ac', '2'], ['-ar', '48000'], ['-f', 's16le'], ['-t', String(VIDEO_MAX_S)]]) assert.equal(s[s.indexOf(k) + 1], val, k);
  // made once (a stand-in ffmpeg and ffprobe)
  const dir = mkdtempSync(join(tmpdir(), 'agi1-prep-'));
  const calls = [];
  const fake = (cmd, args, opts) => {
    calls.push({ cmd, args, opts });
    const p = new EventEmitter();
    p.stdout = new Readable({ read() {} });
    p.stderr = new EventEmitter();
    setImmediate(() => {
      const ff = args.includes('ffmpeg') ? args.slice(args.indexOf('ffmpeg')) : [cmd, ...args];
      if (ff[0] === 'ffprobe') p.stdout.push('12.5\n');
      else if (ff.includes('pipe:1')) p.stdout.push(Buffer.alloc(48000 * 4));
      else writeFileSync(ff.at(-1), 'webm');
      p.stdout.push(null);
      setImmediate(() => p.emit('exit', 0));
    });
    return p;
  };
  const video = { file: '/videos/x.mp4', title: 'x', size: 5000, mtime: 1 };
  const r = await prepareVideo(video, dir, { run: fake, nice: '/usr/bin/nice' });
  assert.match(r.src, /^\/media\/[0-9a-f]{24}\.webm$/);
  assert.ok(MEDIA_NAME.test(r.src.slice(7)));
  assert.equal(r.seconds, 12.5);
  assert.equal(r.sound.length, 48000 * 2);
  const ffmpegs = calls.filter((c) => c.cmd === '/usr/bin/nice');
  assert.equal(ffmpegs.length, 2, 'the picture and the sound, both at a lower priority');
  assert.deepEqual(ffmpegs[0].args.slice(0, 3), ['-n', '15', 'ffmpeg']);
  assert.ok(calls.every((c) => !Object.keys(c.opts.env).some((k) => /SECRET|KEY|TOKEN/.test(k))), 'no secrets for ffmpeg');
  const n = calls.length;
  await prepareVideo(video, dir, { run: fake, nice: null });
  assert.equal(calls.filter((c) => c.cmd !== 'ffprobe').length, n - 1, 'kept: only asked how long it is');
  rmSync(dir, { recursive: true, force: true });
});

test('a picture or a video from her X posts: only from X\'s own media addresses, a picture (JPEG, PNG, WebP) 5 MB at most, downloaded once', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'agi1-dl-'));
  let asked = 0;
  const fetchFn = async (url, init) => {
    asked += 1;
    assert.equal(init.redirect, 'error', 'never sent elsewhere');
    if (url.includes('big')) return new Response(Buffer.alloc(6 * 1024 * 1024), { headers: { 'content-type': 'image/jpeg' } });
    if (url.includes('html')) return new Response('<html>', { headers: { 'content-type': 'text/html' } });
    if (url.endsWith('.mp4')) return new Response(Buffer.alloc(5000), { headers: { 'content-type': 'video/mp4' } });
    return new Response(Buffer.alloc(3000), { headers: { 'content-type': 'image/jpeg; charset=binary' } });
  };
  const pic = await download('https://pbs.twimg.com/media/abc.jpg', dir, { fetchFn });
  assert.match(pic.src, /^\/media\/[0-9a-f]{24}\.jpg$/);
  assert.ok(existsSync(pic.file));
  await download('https://pbs.twimg.com/media/abc.jpg', dir, { fetchFn });
  assert.equal(asked, 1, 'once');
  const vid = await download('https://video.twimg.com/ext_tw_video/1/pu/vid/640x360/x.mp4', dir, { fetchFn, kind: 'video' });
  assert.match(vid.file, /\.mp4$/);
  for (const bad of ['http://pbs.twimg.com/media/a.jpg', 'https://evil.example/a.jpg', 'https://pbs.twimg.com.evil.example/a.jpg']) await assert.rejects(download(bad, dir, { fetchFn }), /X's media addresses/, bad);
  await assert.rejects(download('https://pbs.twimg.com/media/big.jpg', dir, { fetchFn }), /bytes/);
  await assert.rejects(download('https://pbs.twimg.com/media/html.jpg', dir, { fetchFn }), /not a picture/);
  assert.ok(readdirSync(join(dir, 'media')).every((f) => !f.endsWith('.part')), 'nothing half-made left');
  // her voice or her music (24 kHz mono) as the stream's sound (48 kHz stereo)
  const st = toStereo(new Float32Array([0, 1, 0, -1]));
  assert.equal(st.length, 16);
  assert.deepEqual([...st.subarray(0, 6)], [0, 0, 0.5, 0.5, 1, 1]);
  rmSync(dir, { recursive: true, force: true });
});

// ---------- her X posts ----------
const X_POSTS = {
  data: [
    { id: '1901', text: 'gm 💜 i really felt the AGI today https://t.co/abc', created_at: '2026-10-07T01:00:00Z', attachments: { media_keys: ['3_1'] } },
    { id: '1900', text: 'new video: me, singing https://t.co/xyz', created_at: '2026-10-06T01:00:00Z', attachments: { media_keys: ['7_2'] } },
    { id: '1899', text: 'just text', created_at: '2026-10-05T01:00:00Z' },
    { id: 'nope', text: 'not a post id' },
  ],
  includes: { media: [
    { media_key: '3_1', type: 'photo', url: 'https://pbs.twimg.com/media/a.jpg' },
    { media_key: '7_2', type: 'video', preview_image_url: 'https://pbs.twimg.com/p.jpg', duration_ms: 21000, variants: [
      { content_type: 'application/x-mpegURL', url: 'https://video.twimg.com/x.m3u8' },
      { content_type: 'video/mp4', bit_rate: 256000, url: 'https://video.twimg.com/low.mp4' },
      { content_type: 'video/mp4', bit_rate: 2176000, url: 'https://video.twimg.com/mid.mp4' },
      { content_type: 'video/mp4', bit_rate: 10368000, url: 'https://video.twimg.com/hd.mp4' },
    ] },
  ] },
};
test('her X posts: read with a Bearer Token only (never in a log), her account read once and kept, her posts once a show, the replies under one once; never who replied; a budget of reads', async () => {
  assert.deepEqual(xSettings({}), { bearer: '', user: 'agi1dotapp', maxReads: 60 });
  assert.equal(xSettings({ LIVE_X_BEARER: 'short' }).bearer, '', 'not a token');
  const TOKEN = `AAAAAAAAAAAAAAAAAAAAA${'b'.repeat(40)}%3D`;
  assert.equal(xSettings({ LIVE_X_BEARER: ` ${TOKEN} ` }).bearer, TOKEN);
  assert.equal(xSettings({ LIVE_X_READS: '0' }).maxReads, 0);
  assert.equal(xSettings({ LIVE_X_READS: '9999' }).maxReads, 500);
  assert.equal(xSettings({ LIVE_X_USER: '@Some_One!' }).user, 'Some_One');
  // her media: the sharpest MP4 up to about 2 Mb/s (her TV is 640 px), a picture as it is
  const posts = postsOf(X_POSTS);
  assert.deepEqual(posts.map((p) => p.id), ['1901', '1900', '1899']);
  assert.deepEqual(posts[0].media, { type: 'photo', url: 'https://pbs.twimg.com/media/a.jpg' });
  assert.equal(posts[1].media.video, 'https://video.twimg.com/mid.mp4');
  assert.equal(posts[1].media.seconds, 21);
  assert.equal(posts[2].media, null);
  assert.equal(mediaOf({ type: 'video', variants: [{ content_type: 'video/mp4', bit_rate: 9_000_000, url: 'https://video.twimg.com/hd.mp4' }] }).video, 'https://video.twimg.com/hd.mp4', 'only a big one: that one');
  assert.equal(mediaOf({ type: 'video', variants: [] }), null);
  // the replies: X's "@agi1dotapp" in front taken off; never hers
  assert.deepEqual(repliesOf({ data: [{ id: '5', text: '@agi1dotapp @someone you are so cute' }, { id: '6', text: '@agi1dotapp thanks!' }, { id: 'x', text: 'bad id' }] }), [{ id: '5', text: 'you are so cute' }, { id: '6', text: 'thanks!' }]);
  // the client, with a stand-in X
  const dir = mkdtempSync(join(tmpdir(), 'agi1-x-'));
  const calls = [];
  const fetchFn = async (url, init) => {
    calls.push({ url: String(url), auth: init.headers.Authorization, redirect: init.redirect });
    const u = new URL(url);
    if (u.pathname === '/2/users/by/username/agi1dotapp') return Response.json({ data: { id: '777', username: 'agi1dotapp' } });
    if (u.pathname === '/2/users/777/tweets') return Response.json(X_POSTS);
    if (u.pathname === '/2/tweets/search/recent') return Response.json({ data: [{ id: '9', text: '@agi1dotapp you are the best streamer' }] });
    return new Response('{}', { status: 404 });
  };
  const logs = [];
  const log = { info: (m) => logs.push(m), warn: (m) => logs.push(m) };
  const x = createX({ bearer: TOKEN, user: 'agi1dotapp', maxReads: 14 }, { fetchFn, log, cacheDir: dir });
  assert.equal(x.on, true);
  assert.equal((await x.posts()).length, 3);
  await x.posts();
  assert.equal(calls.filter((c) => c.url.includes('/tweets?')).length, 1, 'her posts: once a show');
  const tl = new URL(calls.find((c) => c.url.includes('/users/777/tweets')).url);
  assert.equal(tl.searchParams.get('exclude'), 'retweets,replies');
  assert.equal(tl.searchParams.get('max_results'), '10');
  assert.ok(calls.every((c) => c.auth === `Bearer ${TOKEN}` && c.redirect === 'error' && c.url.startsWith('https://api.x.com/2/')));
  assert.deepEqual(await x.replies('1901'), [{ id: '9', text: 'you are the best streamer' }]);
  await x.replies('1901');
  const search = new URL(calls.find((c) => c.url.includes('/search/recent')).url);
  assert.equal(search.searchParams.get('query'), 'conversation_id:1901 is:reply -from:agi1dotapp -is:retweet');
  assert.equal(search.searchParams.get('expansions'), null, 'never who wrote them (an account read costs more, and they never show)');
  assert.equal(calls.filter((c) => c.url.includes('/search/recent')).length, 1, 'once a post a show');
  assert.equal(x.reads, 4);
  assert.deepEqual(await x.replies('1900'), [{ id: '9', text: 'you are the best streamer' }]);
  assert.deepEqual(await x.replies('1899'), [], 'the budget: no more reads this show');
  assert.deepEqual(await x.replies('not-an-id'), []);
  // her account's number: kept on the server's disk (read once ever)
  assert.deepEqual(JSON.parse(readFileSync(join(dir, 'x-user.json'), 'utf8')), { user: 'agi1dotapp', id: '777' });
  const before = calls.length;
  const y = createX({ bearer: TOKEN, user: 'agi1dotapp', maxReads: 60 }, { fetchFn, log, cacheDir: dir });
  await y.posts();
  assert.equal(calls.length - before, 1, 'her posts only: her account was kept');
  // X refusing: a plain hint, never the token
  const no = createX({ bearer: TOKEN, user: 'agi1dotapp', maxReads: 60 }, { fetchFn: async () => new Response('{"title":"Unauthorized"}', { status: 401 }), log });
  assert.deepEqual(await no.posts(), []);
  assert.ok(logs.some((m) => /LIVE_X_BEARER isn't accepted/.test(m)));
  assert.ok(!logs.some((m) => m.includes(TOKEN)), 'the token never in a log');
  // off: nothing asked
  const off = createX(xSettings({}), { fetchFn: () => { throw new Error('asked'); } });
  assert.equal(off.on, false);
  assert.deepEqual(await off.posts(), []);
  rmSync(dir, { recursive: true, force: true });
});

// ---------- the director's extras ----------
test('the director\'s extras: one about every 4 minutes (8 with questions waiting), each once before any comes again, one that can\'t happen now waits; never in her last minute', () => {
  const start = 0;
  const show = createShow({ start, minutes: 60, seed: 3, extras: [...EXTRA_IDS] });
  didStep(show, nextStep(show, { now: start }), start);
  assert.equal(show.extras.length, EXTRA_IDS.length);
  const seen = [];
  let now = start;
  for (; now < 50 * 60_000; now += 5000) {
    const step = nextStep(show, { now, waiting: 0, extraOk: (id) => id !== 'video' || now > 30 * 60_000 });
    if (step.kind === 'extra') { seen.push([step.id, now]); didStep(show, step, now); }
    else if (['segment', 'pickup', 'chat'].includes(step.kind)) didStep(show, step, now);
  }
  const ids = seen.map((x) => x[0]);
  assert.deepEqual([...new Set(ids.slice(0, EXTRA_IDS.length - 1))].sort(), EXTRA_IDS.filter((x) => x !== 'video').sort(), `each once before any again: ${ids}`);
  assert.ok(!seen.some(([id, t]) => id === 'video' && t <= 30 * 60_000), 'one that couldn\'t happen waited');
  assert.ok(ids.includes('video'), 'and came when it could');
  for (let k = 1; k < seen.length; k++) assert.ok(seen[k][1] - seen[k - 1][1] >= PACE.EXTRA_EVERY, `${seen[k][1] - seen[k - 1][1]}`);
  assert.ok(seen[0][1] >= PACE.FIRST_EXTRA && seen[0][1] < PACE.FIRST_EXTRA + 30_000, 'the first one a few minutes in');
  assert.ok(seen.length >= 10 && seen.length <= 13, `about one every 4 minutes: ${seen.length}`);
  assert.ok(ids.every((id, k) => k === 0 || id !== ids[k - 1]), 'never twice in a row');
  // with questions waiting: questions first, an extra only after 4 in a row, every 8 minutes at most
  const busy = createShow({ start, minutes: 60, seed: 4, extras: ['dance', 'room'] });
  didStep(busy, nextStep(busy, { now: start }), start);
  let questions = 0, extras = 0;
  for (now = start; now < 30 * 60_000; now += 20_000) {
    const step = nextStep(busy, { now, waiting: 3 });
    if (step.kind === 'question') questions += 1;
    if (step.kind === 'extra') extras += 1;
    didStep(busy, step, now);
  }
  assert.ok(questions > 60 && extras >= 2 && extras <= 4, `${questions} questions, ${extras} extras`);
  // never in her last minute and a half (the outro is coming)
  const late = createShow({ start, minutes: 10, extras: ['room'] });
  didStep(late, nextStep(late, { now: start }), start);
  late.lastExtraAt = -1e9;
  assert.notEqual(nextStep(late, { now: late.endsAt - PACE.OUTRO_MS - 30_000 }).kind, 'extra');
  // one that didn't happen after all: tried again a little later
  const again = createShow({ start, minutes: 60, extras: ['post', 'room'] });
  didStep(again, nextStep(again, { now: start }), start);
  const s1 = nextStep(again, { now: 4 * 60_000 });
  assert.equal(s1.kind, 'extra');
  didStep(again, { ...s1, skipped: true }, 4 * 60_000);
  assert.equal(again.extrasDone, 0);
  assert.ok(again.extraOrder.at(-1) === s1.id, 'to the back of the line');
  const s2 = nextStep(again, { now: 4 * 60_000 + 31_000 });
  assert.equal(s2.kind, 'extra', 'half a minute later');
  assert.notEqual(s2.id, s1.id);
  // none: segments and the rest as before
  const plain = createShow({ start, minutes: 60 });
  assert.deepEqual(plain.extras, []);
  // --try: these first, soon after the intro, about every 45 s
  const t = createShow({ start, minutes: 10, extras: ['song', 'dance', 'room'], first: ['song', 'dance', 'nope'] });
  didStep(t, nextStep(t, { now: start }), start);
  const first = nextStep(t, { now: 25_000 });
  assert.deepEqual([first.kind, first.id], ['extra', 'song']);
  didStep(t, first, 25_000);
  assert.equal(nextStep(t, { now: 25_000 + 45_000 }).id, 'dance');
});

// ---------- her lines and the runner's options ----------
test('her lines for it all: a line for every room and outfit, dances, her song, her videos and posts; $AGI only as a feeling or news, always "not financial advice", never "pumping"', () => {
  for (const id of ROOM_IDS) assert.ok(L.ROOM_LINES[id]?.text, id);
  for (const id of OUTFIT_IDS) assert.ok(L.OUTFIT_LINES[id]?.text, id);
  const money = [...L.MARKET_LINES.up, ...L.MARKET_LINES.down, ...L.MARKET_LINES.flat, ...L.BUY_LINES, L.MILESTONE_LINE];
  for (const x of money) {
    assert.match(x.text, /not financial advice/, x.text);
    assert.doesNotMatch(x.text, /pump|moon|buy|sell|hold|soon|next stop|going up|profit|gain/i, x.text);
  }
  assert.match(L.MARKET_CARD.foot, /not financial advice/);
  const all = L.allLines();
  for (const x of [...L.ROOM_INTRO, ...Object.values(L.ROOM_LINES), ...L.OUTFIT_INTRO, ...Object.values(L.OUTFIT_LINES), ...L.DANCE_LINES.start, ...L.DANCE_LINES.after,
    ...L.SONG_LINES.whole, ...L.SONG_LINES.part, ...L.SONG_LINES.after, ...L.VIDEO_LINES.intro, ...L.VIDEO_LINES.after, ...L.POST_LINES.intro, ...L.REPLY_LINES.intro,
    L.REPLY_LINES.none, ...money, L.OOPS]) assert.ok(all.includes(x), `--warm makes its voice: ${x.text}`);
  assert.ok(L.SONG_LINES.whole.every((x) => /Feel the AGI/.test(x.text)));
  // the demo's stand-ins follow her rules too
  for (const t of [...DEMO_QA.map((q) => q.reply), ...DEMO_CHAT]) {
    assert.ok(!isCrude(t), t);
    assert.doesNotMatch(t, /\b(babe|baby|cutie|honey)\b|\$(?!AGI)\w/i, t);
  }
  for (const q of DEMO_QA.filter((x) => x.act)) assert.ok(ACT_IDS.includes(q.act.act), q.text);
});

test('the runner\'s new options and helpers: --try (to see her extras on a recording), something new to say (on unless off, 40 an hour), the time around the world, a feeling from the chart', () => {
  assert.deepEqual(parseArgs(['--try', 'song,dance'], {}).tryExtras, ['song', 'dance']);
  assert.deepEqual(parseArgs([], {}).tryExtras, []);
  assert.throws(() => parseArgs(['--try', 'song,fly'], {}), /--try: some of dance, room/);
  assert.throws(() => parseArgs(['--try'], {}), /--try/);
  assert.deepEqual(chatterSettings({}), { on: true, perHour: 40, gapMs: 40_000 });
  assert.equal(chatterSettings({ LIVE_CHATTER: 'off' }).on, false);
  assert.equal(chatterSettings({ LIVE_CHATTER_PER_HOUR: '0' }).perHour, 0);
  assert.equal(chatterSettings({ LIVE_CHATTER_PER_HOUR: '500' }).perHour, 120);
  assert.ok(TOPICS.length >= 6 && TOPICS.filter((x) => x === 'anything').length >= 2);
  // 01:00 UTC on 2026-10-07: 9 pm in New York, 2 am in London, 10 am in Tokyo
  assert.equal(timeFact(Date.UTC(2026, 9, 7, 1, 0)), "right now it's night in New York, the middle of the night in London and morning in Tokyo");
  assert.equal(timeFact(Date.UTC(2026, 9, 7, 22, 0)), "right now it's evening in New York, night in London and morning in Tokyo");
  assert.ok(timeFact().length <= 120, 'short enough for her prompt');
  assert.deepEqual([dirOf(5), dirOf(-4), dirOf(0.4), dirOf(null)], ['up', 'down', 'flat', 'flat']);
  assert.ok(SONG_ROTATION.every((p) => PART_IDS.includes(p) && p !== 'whole'));
});

test('her set\'s own server: /media/ only for the files made for her TV (with ranges: a video is read in pieces), nothing else of the computer', async () => {
  const dist = mkdtempSync(join(tmpdir(), 'agi1-dist-'));
  const media = mkdtempSync(join(tmpdir(), 'agi1-media-'));
  writeFileSync(join(dist, 'index.html'), '<p>set</p>');
  const name = 'a'.repeat(24) + '.webm';
  writeFileSync(join(media, name), Buffer.from('0123456789'));
  writeFileSync(join(media, 'secret.txt'), 'no');
  const { server, url } = await serve(dist, { media });
  try {
    const r = await fetch(`${url}media/${name}`, { headers: { range: 'bytes=2-5' } });
    assert.equal(r.status, 206);
    assert.equal(await r.text(), '2345');
    assert.equal(r.headers.get('content-range'), 'bytes 2-5/10');
    assert.equal(r.headers.get('content-type'), 'video/webm');
    const whole = await fetch(`${url}media/${name}`);
    assert.equal(await whole.text(), '0123456789');
    for (const bad of ['media/secret.txt', `media/..%2F${name}`, `media/${name}%2Fx`, `media/${'A'.repeat(24)}.webm`, 'media/']) assert.equal((await fetch(`${url}${bad}`)).status, 404, bad);
    assert.equal((await fetch(`${url}`)).status, 200, 'her set as before');
    const none = await serve(dist);
    assert.equal((await fetch(`${none.url}media/${name}`)).status, 404, 'no media folder: nothing');
    none.server.close();
  } finally {
    server.close();
    rmSync(dist, { recursive: true, force: true });
    rmSync(media, { recursive: true, force: true });
  }
});

test('the demo: a few made-up questions ask her to do something (only what she can do now), made-up lines stand in for the site\'s new ones, a made-up buy now and then', async () => {
  let t = 1_000_000;
  const site = demoSite({ every: 1000, now: () => t, buyEvery: 10_000 });
  await site.start();
  const got = [];
  for (let i = 0; i < DEMO_QA.length; i++) { t += 1000; got.push(await site.next(1, ['jump', 'sing:chorus', 'blush'])); }
  const acts = got.filter((r) => r.act).map((r) => r.act.act);
  assert.deepEqual(acts, ['jump', 'sing', 'blush'], 'only the ones on the list');
  assert.equal((await site.chat()).reply, DEMO_CHAT[0]);
  assert.equal((await site.react(1, { kind: 'post', text: 'gm' })).mood, 'happy');
  assert.deepEqual(await site.react(1, { kind: 'post', text: '' }), { skip: 'empty' });
  t += 10_000;
  const m = await site.market();
  assert.ok(m.numbers.mcap > 0 && m.buys.length === 1 && m.buys[0].usd > 0);
  assert.equal((await site.market()).buys.length, 0, 'each made-up buy once');
});

test('her set\'s page: viewers\' requests and her extras on window.studio, a picture on her TV, her captions step aside only for a video', () => {
  const js = read('tools/live/page/stage.js');
  for (const fn of ['jump:', 'twirl:', 'move:', 'act:', 'dance:', 'sing,', 'room:', 'outfit:', 'confetti:', 'sticker:', 'alert:', 'tv:']) assert.ok(js.includes(fn), fn);
  assert.match(js, /set\.dataset\.mode = v \? \(v\.img \? 'pic' : 'tv'\) : 'none'/);
  const html = read('tools/live/page/index.html');
  assert.match(html, /<img data-tv-img alt="" hidden \/>/);
  const css = read('tools/live/page/stage.css');
  assert.match(css, /\.tv-screen img \{[^}]*opacity: 0\.99;/, 'never quite opaque over her picture');
  assert.match(css, /\.set\[data-mode='song'\] \.caption, \.set\[data-mode='tv'\] \.caption \{ display: none; \}/);
  const fx = read('tools/live/page/fx.js');
  assert.match(fx, /if \(v\.img && img\)/);
  assert.doesNotMatch(fx, /innerHTML/);
});

// ---------- her poses on stream (2026-10-07, the owner's screenshots of her first upgraded stream: "what happend here lol",
// "and this what is this") ----------
// An arm pulled in front of her (shoulder under -20°) with its elbow half bent (between 45° and 140°) puts her forearm flat
// out to the side at her hips: her 2D drawing can't show it reaching toward us, so it reads as a paddle. Her hands come up
// in front of her chest (140° or more) or stay down (45° or less).
const paddle = (arms) => {
  const bad = [];
  for (const s of ['R', 'L']) {
    const sh = arms[`sh${s}`], el = arms[`el${s}`];
    if (sh === undefined || el === undefined) continue;
    if (sh < -20 && el > 45 && el < 140) bad.push(`${s}: shoulder ${sh.toFixed(1)}°, elbow ${el.toFixed(1)}°`);
  }
  return bad;
};
// (2026-10-08) a pose's arms: as angles, or where her hands go (worked out on her arms at rest)
const armsOf = (p) => (p.hands ? { ...restArms(p.hands), ...(p.arms || {}) } : p.arms || null);
// where a point of her hand is (a: along it, HAND's frame), her arms turned as `arms` says, at rest (as bendArm turns them)
const RAD = Math.PI / 180;
function handAt(side, arms, a = 0.33) {
  const A = REST_ARMS[side], B = A.now.base, g = A.sign, up = arms[`up${side}`] ?? 1, fo = arms[`fo${side}`] ?? 1;
  const s = g * shoulderLimit(arms[`sh${side}`] || 0) * RAD, e = g * (arms[`el${side}`] || 0) * RAD, w = g * (arms[`wr${side}`] || 0) * RAD;
  const rot = (v, t) => [v[0] * Math.cos(t) - v[1] * Math.sin(t), v[0] * Math.sin(t) + v[1] * Math.cos(t)];
  const u = rot(B.up, s), f = rot(B.fo, s + e), h = rot(B.ha, s + e + w);
  const E = [B.S[0] + u[0] * up, B.S[1] + u[1] * up], W = [E[0] + f[0] * fo, E[1] + f[1] * fo];
  return { E, W, P: [W[0] + h[0] * a, W[1] + h[1] * a] };
}
// her chest (her model's chest piece, inside its box, up to the top of the AGI on her shirt: model units, her arms' frame):
// her hands stay off it (PG-13). A hand may pass in front of her collarbones (a clap under her chin, a cup at her lips).
const CHEST = { x0: -0.1, x1: 0.1, y0: 0.265, y1: 0.375 };
const onChest = (arms) => {
  const bad = [];
  for (const s of ['R', 'L']) {
    if (arms[`sh${s}`] === undefined || arms[`el${s}`] === undefined) continue;
    for (const a of [0.15, 0.33, 0.56, 0.8]) {
      const [x, y] = handAt(s, arms, a).P;
      if (x > CHEST.x0 && x < CHEST.x1 && y > CHEST.y0 && y < CHEST.y1) { bad.push(`${s} hand at ${a}: ${x.toFixed(3)}, ${y.toFixed(3)}`); break; }
    }
  }
  return bad;
};
test('her poses on stream: never a forearm stuck out flat at her hips, her hands never on her chest (every gesture, every action over its length, every dance at every beat)', () => {
  for (const [id, g] of Object.entries(GESTURES)) {
    assert.deepEqual(paddle(armsOf(g)), [], `gesture ${id}`);
    assert.deepEqual(onChest(armsOf(g)), [], `gesture ${id}`);
  }
  for (const [id, def] of Object.entries(ACTIONS)) {
    for (let a = 0; a <= def.len; a += 0.05) {
      const arms = armsOf(def.pose(a));
      if (!arms) continue;
      assert.deepEqual(paddle(arms), [], `action ${id} at ${a.toFixed(2)} s`);
      assert.deepEqual(onChest(arms), [], `action ${id} at ${a.toFixed(2)} s`);
    }
  }
  for (const [id, d] of Object.entries(DANCES)) {
    for (let b = 0; b < 32; b += 0.05) {
      const arms = armsOf(d(b, 1));
      if (!arms) continue;
      assert.deepEqual(paddle(arms), [], `dance ${id} at beat ${b.toFixed(2)}`);
      assert.deepEqual(onChest(arms), [], `dance ${id} at beat ${b.toFixed(2)}`);
    }
  }
  // the rule catches a hand on her chest (the owner's screenshot, 2026-10-08: her palms flat up by her chest)
  assert.equal(onChest(restArms({ R: { to: 'chin', dx: -0.1, dy: -1.1, deg: 80, a: 0.4, sh: -10, bend: 'in' } })).length, 1);
  for (const id of Object.keys(IDLES)) assert.ok(ACTIONS[id], `what she does by herself is one of her actions: ${id}`);
  // the rule itself catches the screenshot's pose (her old gestures: elbow 110–140° with her arm pulled in)
  assert.equal(paddle({ shR: -30, elR: 118 }).length, 1);
  assert.equal(paddle({ shR: -30, elR: 160, shL: -10, elL: 100 }).length, 0, 'an arm out to the side may bend any way');
});

// her poses' hands, each one (a hand between two spots: both)
const handSpecs = (h) => (!h ? [] : h.mix ? [...handSpecs(h.mix[0]), ...handSpecs(h.mix[1])] : [h]);
test('her hands (2026-10-08, the owner: "why did you switched her hands", "are you even fixing it lol", "she doesnt even grabbed it lol"): always her palm, her own hand the right way round, never squeezed thin or curled into a claw; what she holds in front of her palm, her own fingers or thumb drawn over it', async () => {
  const { HAND_TURN, CURL, HOLD, USES_R } = await import('../tools/live/page/moves.js');
  const { CURL_MAX } = await import('../src/stage/agi1-2d.js');
  const { HELD_FADE } = await import('../tools/live/page/outfits.js');
  // her hand is one drawing, her palm: turned at most HAND_TURN about its length (a hand turned 40° is 0.81 as wide), never
  // flipped to stand in for her other hand's back (twisted 150° or more, her palm reads as her other hand's), her fingers
  // relaxed (CURL.open), curled round something she holds at most CURL.hold, and never past what her drawn fingers can
  // show on her live show (CURL_MAX)
  assert.ok(HAND_TURN <= 45 && CURL.open < CURL.hold && CURL.hold <= CURL_MAX && CURL_MAX < 0.6, `${HAND_TURN} ${CURL.open} ${CURL.hold} ${CURL_MAX}`);
  const check = (what, hands, holding) => {
    for (const side of ['R', 'L']) for (const h of handSpecs(hands?.[side])) {
      assert.ok(Math.abs(h.tw || 0) <= HAND_TURN, `${what} ${side}: turned ${h.tw}`);
      assert.ok((h.cu || 0) <= (holding && side === 'R' ? CURL.hold : CURL.open) + 1e-9, `${what} ${side}: curled ${h.cu}`);
    }
  };
  for (const [id, def] of Object.entries(ACTIONS)) for (let a = 0; a <= def.len; a += 0.1) check(`action ${id} at ${a.toFixed(1)} s`, def.pose(a).hands, def.prop);
  for (const [id, g] of Object.entries(GESTURES)) check(`gesture ${id}`, g.hands, false);
  for (const [id, d] of Object.entries(DANCES)) for (let b = 0; b < 16; b += 0.25) check(`dance ${id}`, d(b, 1).hands, false);
  // what she holds: in front of her palm, at a point of her hand (along it from her wrist, across it), her thumb ('thumb':
  // a cup or her phone, her thumb over its edge) or her fingers ('fingers': a snack at her fingertips) drawn again over it
  for (const [k, H] of Object.entries(HOLD)) {
    assert.ok(['thumb', 'fingers'].includes(H.grip), `${k}: ${H.grip}`);
    assert.ok(H.a > 0.3 && H.a <= 1.05 && Math.abs(H.b) < 0.3 && H.w > 0.2 && H.w < 1 && H.upright >= 0 && H.upright <= 1, k);
  }
  assert.equal(HOLD.food.grip, 'fingers', 'a snack: her fingertips over its bottom');
  for (const k of ['phone', 'mug', 'drink']) assert.equal(HOLD[k].grip, 'thumb', `${k}: her thumb over its edge`);
  // things in her right hand come and go softly (a few frames), with her fingers drawn over them
  assert.ok(HELD_FADE >= 3 && HELD_FADE <= 12);
  const outfits = read('tools/live/page/outfits.js');
  assert.match(outfits, /uniform float fade;/);
  assert.match(outfits, /gl_FragColor = c \* opacity \* fade \* m;/);
  // a fist, or a hand round a handle, are pictures her drawing can't make look held: gone (her fist read as a claw, the
  // owner: "are you even fixing it lol"; her umbrella's handle floated by her shoulder, "????")
  for (const f of ['tools/live/page/fist.js', 'tools/live/page/grip.js', 'tools/live/page/hands', 'tools/live/hand-art.mjs']) assert.equal(existsSync(new URL(`../${f}`, import.meta.url)), false, f);
  assert.doesNotMatch(outfits, /fist\.js|grip\.js|FIST_|umbrellaGrip/);
  // which actions use her right hand (her umbrella goes while they do)
  for (const id of ['hairtuck', 'lookchat', 'lean', 'wink', 'smug']) assert.equal(USES_R[id], false, id);
  for (const id of ['laugh', 'sip', 'phone', 'clap', 'eat', 'drink', 'think']) assert.equal(USES_R[id], true, id);
});

// Her arms on her controller's springs (src/stage/agi1-2d.js), frame by frame at 30 a second, with moves.js on top and its
// after-the-springs part (post): as she's drawn on her live show (her body at rest)
async function armsOverTime(run, { seconds = 4, talking = 0, rnd } = {}) {
  const { Follow } = await import('../src/stage/agi1-2d-motion.js');
  const { ARMS } = await import('../src/stage/agi1-2d.js');
  const R0 = ARMS.rest;
  const F = {
    shR: new Follow(R0.shoulder, 2.2, 0.68, 0.1), elR: new Follow(R0.elbow, 3, 0.6, 0.05), wrR: new Follow(0, 3.6, 0.5, 0),
    shL: new Follow(R0.shoulder, 2.2, 0.68, 0.1), elL: new Follow(R0.elbow, 3, 0.6, 0.05), wrL: new Follow(0, 3.6, 0.5, 0),
    upR: new Follow(1, 2.2, 0.8, 0), foR: new Follow(1, 2.4, 0.8, 0), twR: new Follow(0, 2.2, 0.8, 0), cuR: new Follow(0, 3, 0.85, 0),
    upL: new Follow(1, 2.2, 0.8, 0), foL: new Follow(1, 2.4, 0.8, 0), twL: new Follow(0, 2.2, 0.8, 0), cuL: new Follow(0, 3, 0.85, 0),
  };
  const P = {};
  for (const k in F) P[k] = F[k].y;
  let ms = 0, seed = 7;
  const m = createMoves({ clock: () => ms, rnd: rnd || (() => ((seed = (seed * 16807) % 2147483647) / 2147483647)) });
  m.auto(false);
  if (!talking) m.gestures(false);
  const now = { pose: P, talking, level: 0.3, waving: false, cheering: false, swaying: false };
  run(m);
  const frames = [];
  for (let i = 0; i < seconds * 30; i++) {
    ms += 1000 / 30;
    const tg = { ax: 0, ay: 0, az: 0, ex: 0, ey: 0, bx: 0, by: 0, bz: 0, hip: 0, shR: R0.shoulder, shL: R0.shoulder, elR: R0.elbow, elL: R0.elbow,
      wrR: 0, wrL: 0, upR: 1, foR: 1, twR: 0, cuR: 0, upL: 1, foL: 1, twL: 0, cuL: 0 };
    m.apply(1 / 30, tg, now);
    for (const k in F) P[k] = F[k].step(1 / 30, tg[k]);
    const pz = { R: { shoulder: P.shR, elbow: P.elR, wrist: P.wrR, upper: P.upR, fore: P.foR }, L: { shoulder: P.shL, elbow: P.elL, wrist: P.wrL, upper: P.upL, fore: P.foL } };
    m.post(pz);
    const arms = {};
    for (const s of ['R', 'L']) Object.assign(arms, { [`sh${s}`]: pz[s].shoulder, [`el${s}`]: pz[s].elbow, [`wr${s}`]: pz[s].wrist, [`up${s}`]: pz[s].upper, [`fo${s}`]: pz[s].fore });
    frames.push({ t: i / 30, arms, target: { R: tg.elR, L: tg.elL } });
  }
  return frames;
}
// her forearms crossed in front of her: her right wrist and fingertips right of her left's
const crossedArms = (arms) => {
  const r = handAt('R', arms, 0.8).P, l = handAt('L', arms, 0.8).P;
  return handAt('R', arms).W[0] > handAt('L', arms).W[0] + 0.01 && r[0] > l[0] + 0.01;
};
test('her hands on their way (2026-10-08, her clap: her forearms crossed in an X over her chest on their way up, and a blown kiss went down across her chest): from her sides up to her face and back, never on her chest, never crossed, never a whole turn of her forearm (every action, every dance from its start, her gestures while she talks; her springs frame by frame)', async () => {
  const look = (what, frames) => {
    for (const f of frames) {
      assert.deepEqual(onChest(f.arms), [], `${what} at ${f.t.toFixed(2)} s`);
      assert.equal(crossedArms(f.arms), false, `${what} at ${f.t.toFixed(2)} s: her forearms crossed`);
      // (a forearm out flat at her hips, as long as drawn: on its way it comes toward us, seen shorter)
      const long = { ...f.arms };
      for (const s of ['R', 'L']) if ((f.arms[`fo${s}`] ?? 1) < 0.75) delete long[`el${s}`];
      assert.deepEqual(paddle(long), [], `${what} at ${f.t.toFixed(2)} s`);
    }
    for (let i = 1; i < frames.length; i++) for (const s of ['R', 'L']) {
      const jump = Math.abs(frames[i].target[s] - frames[i - 1].target[s]);
      assert.ok(jump < 250, `${what} at ${frames[i].t.toFixed(2)} s: her ${s} elbow's target jumped ${jump.toFixed(0)}° (a whole turn of her forearm)`);
    }
  };
  for (const [id, def] of Object.entries(ACTIONS)) look(`action ${id}`, await armsOverTime((m) => m.act(id), { seconds: def.len + 1.5 }));
  for (const id of Object.keys(DANCES)) look(`dance ${id}`, await armsOverTime((m) => m.dance({ bpm: 112, style: id, until: 6000, beat0: 0 }), { seconds: 7.5 }));
  look('her gestures', await armsOverTime(() => {}, { seconds: 40, talking: 1 }));
  // from one dance move to the next (her song's moves, a new routine every four bars), every way round
  for (const a of Object.keys(DANCES)) for (const b of Object.keys(DANCES)) {
    if (a === b) continue;
    const cues = [{ t: 0, move: a }, { t: 2.2, move: b }, { t: 4.4, move: a }];
    look(`dance ${a} → ${b}`, await armsOverTime((m) => m.dance({ bpm: 112, until: 7000, beat0: 0, cues }), { seconds: 7.5 }));
  }
  // on its way her forearm comes toward us (seen shorter), then it's as long as her pose says: her clap from her side
  const clap = await armsOverTime((m) => m.act('clap'), { seconds: 2.4 });
  const fo = clap.map((f) => f.arms.foR), el = clap.map((f) => f.arms.elR);
  assert.ok(Math.min(...fo.slice(0, 12)) < 0.5, `shorter on its way: ${Math.min(...fo.slice(0, 12)).toFixed(2)}`);
  assert.ok(fo.slice(18, 50).every((v) => v > 0.85), 'as long as her pose says while she claps');
  // …and up at her side first, never across her (her elbow turns her forearm out: up past 90°, not down past −90°)
  assert.ok(Math.max(...el.slice(0, 15)) > 90 && Math.min(...el) > -20, `${el.slice(0, 15).map((v) => v.toFixed(0))}`);
});

test('her jump stays in the picture (4.5 cm up, her head never leaves it), the camera moves in gently, and no gesture while she jumps, twirls or moves', () => {
  let top = 0;
  for (let t = 0; t < JUMP_S * 3; t += 0.002) top = Math.max(top, jumpAt(t).y);
  assert.ok(top <= 0.05 && top >= JUMP_UP * 0.99, `a jump goes up ${(top * 100).toFixed(1)} cm (16 cm before: her head left the picture)`);
  assert.equal(jumpAt(0).y, 0, 'from the floor');
  assert.ok(Math.abs(jumpAt(JUMP_S - 1e-6).y) < 1e-9, 'back on the floor');
  for (const [k, z] of Object.entries(CAM_ZOOM)) assert.ok(z > 1 && z <= 1.08, `the camera's "${k}" push-in: ${z} (1.22 before: her face filled the screen)`);
  // while she talks her hands move; when she jumps (or twirls, or moves), no gesture: her arms stay by her sides, lifting a little in the air
  let ms = 0;
  const moves = createMoves({ clock: () => ms, rnd: () => 0.3 });
  moves.auto(false);
  const rest = () => ({ shR: -15, elR: -3, wrR: 0, shL: -15, elL: -3, wrL: 0, ax: 0, ay: 0, az: 0, ex: 0, ey: 0, bx: 0, by: 0, bz: 0, hip: 0 });
  const talk = { talking: 1, level: 0.6 };
  let gestured = false;
  // (2026-10-08: now and then, after a few seconds of talking, one hand at a time: not all the time)
  for (let i = 0; i < 300; i++) {
    ms += 33;
    const tg = rest(), was = rest();
    moves.apply(1 / 30, tg, talk);
    if (['elR', 'elL', 'shR', 'shL'].some((k) => Math.abs(tg[k] - was[k]) > 25)) gestured = true;
  }
  assert.ok(gestured, 'her hands move while she talks');
  for (const go of [() => moves.jump(3), () => moves.twirl(2), () => moves.move('left')]) {
    go();
    for (let i = 0; i < 90; i++) {
      ms += 33;
      const tg = rest();
      moves.apply(1 / 30, tg, talk);
      if (!moves.moving) break;
      assert.ok(tg.elR < 40 && tg.elL < 40 && tg.shR > -20 && tg.shL > -20, `her arms by her sides while she's in the air (elbows ${tg.elR.toFixed(0)}°, ${tg.elL.toFixed(0)}°)`);
      assert.ok(moves.figure.y <= 0.05 + 1e-9, 'never higher than a small hop');
    }
    for (let i = 0; i < 200 && moves.moving; i++) { ms += 33; moves.apply(1 / 30, rest(), talk); }
  }
});
