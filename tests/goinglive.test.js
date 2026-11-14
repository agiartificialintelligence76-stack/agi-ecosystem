// GOING LIVE (2026-11-14), an arcade-kit game on agi1.app/games: AGI-1 starts streaming with zero followers in a bare
// bedroom and climbs to #1 trending (the owner, after asking about a famous YouTuber's streamer sim: "yes exactly" to an
// AGI-1 version, ours in every way). What she can stream, her room's things and homes, the board of made-up streamers;
// her career's rules (what a stream draws, what's trending, chat getting tired, upgrades, moving, what her room earns while
// you're away, what a stream brings); a stream's rules (what turns up, taps and misses, the hype and the viewers, the big
// moment, the same seed giving the same stream); the game's own streamers and the pace of a whole career; what's kept; her
// words and her chat's (made up, never money, no real creator or platform); and its code. All in Node (no browser).
// Run: node --test tests/goinglive.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { CATS, CAT_IDS, catOf, SLOTS, SLOT_IDS, slotOf, ROOMS, roomOf, AWARDS, RIVALS, rankOf, nextRival, TUNE } from '../src/games/goinglive/data.js';
import {
  newCareer, unlocked, isOpen, nextUnlock, trendOf, trendLeft, pointsFor, freshMult, appeal, reachOf, startViewers, busyOf,
  tierOf, nextTier, upgrade, fullRoom, nextRoom, canMove, moveRoom, bestUpgrades, idleRate, awayGain, applyStream,
} from '../src/games/goinglive/econ.js';
import { createStream, step, tap, drain, targetOf, KINDS } from '../src/games/goinglive/stream.js';
import { PROFILES, createPlayer, playStep, playStream, chooseCat, shop, career } from '../src/games/goinglive/ai.js';
import { STICKERS, stickerOf, fresh, load, earned } from '../src/games/goinglive/progress.js';
import { NAMES, nameOf, chatLine, askOf, botLine, botName, raidLine, techOf, say, TIPS, endLine, shareText } from '../src/games/goinglive/lines.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const MONEY = /\$AGI|\binvest|\bprofit|financial advice|\bprice\b|\bpump\b|\bdump\b|\bbuy\b|\bmoney\b|\bcash\b|\bdollars?\b|\bpaid\b|\bcrypto|\btoken\b|\bcoin\b/i;
// no real creator, platform or their in-jokes: the game is ours (the owner: an AGI-1 version, not anyone else's)
const REAL = /\b(you ?tube|twitch|pewdiepie|pewds|mr ?beast|tik ?tok|instagram|kick\.com|onlyfans|patreon|ko-?fi|super ?chat|subscrib\w*|donat\w*|brofist|bro army|tuber simulator)\b/i;
const dt = 1 / 30;
// a stream played to the end by nobody (`fn` each step, to tap things)
function runStream(S, fn) { while (!S.over) { fn?.(S); step(S, dt); } return S.over; }

// ---------- what the game is made of ----------
test('what she can stream: eight kinds, opening one after another as she grows, each with its big moment', () => {
  assert.deepEqual(CAT_IDS, ['talk', 'game', 'sing', 'art', 'cook', 'code', 'cozy', 'dance']);
  assert.deepEqual(CATS.map((k) => k.unlock), [0, 0, 60, 400, 2500, 15000, 90000, 600000]);
  for (let i = 1; i < CATS.length; i++) assert.ok(CATS[i].base >= CATS[i - 1].base, 'a later kind draws at least as much');
  for (const k of CATS) {
    assert.equal(catOf(k.id), k);
    assert.ok(k.base >= 1 && k.base <= 1.3, k.id);
    assert.match(k.color, /^#[0-9a-f]{6}$/);
    assert.ok(k.name && k.short && k.short.length <= 9, `${k.id}: a short name for its card`);
    assert.ok(k.mash.length > 8 && k.blurb.length > 8);
  }
  assert.equal(catOf('nope'), null);
});

test('her room: twelve things, four tiers each (the first free), every tier dearer and better, every kind helped', () => {
  assert.deepEqual(SLOT_IDS, ['mic', 'pc', 'cam', 'chair', 'lights', 'wall', 'shelf', 'window', 'plant', 'art', 'kitchen', 'pet']);
  const helped = Object.fromEntries(CAT_IDS.map((id) => [id, 0]));
  const ids = new Set();
  for (const s of SLOTS) {
    assert.equal(slotOf(s.id), s);
    assert.equal(s.tiers.length, 4, s.id);
    assert.equal(s.tiers[0].cost, 0, `${s.id}: she starts with its first tier`);
    for (let i = 1; i < 4; i++) {
      assert.ok(s.tiers[i].cost > s.tiers[i - 1].cost * 8, `${s.id}: tier ${i} costs much more than the last`);
      const sum = (t) => Object.values(t.stats).reduce((a, b) => a + b, 0);
      assert.ok(sum(s.tiers[i]) > sum(s.tiers[i - 1]), `${s.id}: tier ${i} helps more`);
    }
    for (const t of s.tiers) {
      assert.ok(!ids.has(t.id), `${t.id}: one of a kind`); ids.add(t.id);
      assert.ok(t.name.length > 2);
      for (const [k, v] of Object.entries(t.stats)) { assert.ok(CAT_IDS.includes(k), `${t.id}: ${k}`); assert.ok(v > 0 && v <= 80); }
    }
    for (const k of Object.keys(s.tiers[3].stats)) helped[k]++;
  }
  for (const [k, n] of Object.entries(helped)) assert.ok(n >= 4, `${k}: helped by ${n} things`);
});

test('her homes, her awards and the board: four homes up to a space station, six mics, sixteen made-up streamers', () => {
  assert.deepEqual(ROOMS.map((r) => r.id), ['bedroom', 'studio', 'penthouse', 'orbit']);
  for (let i = 1; i < ROOMS.length; i++) {
    assert.ok(ROOMS[i].at > ROOMS[i - 1].at && ROOMS[i].cost > ROOMS[i - 1].cost && ROOMS[i].mult > ROOMS[i - 1].mult, ROOMS[i].id);
  }
  assert.equal(ROOMS[0].cost, 0);
  assert.equal(roomOf({ room: 9 }), ROOMS[3]); assert.equal(roomOf({}), ROOMS[0]);
  assert.deepEqual(AWARDS.map((a) => a.at), [100, 1000, 10000, 100000, 1000000, 10000000]);
  assert.equal(RIVALS.length, 16);
  for (let i = 1; i < RIVALS.length; i++) assert.ok(RIVALS[i].f < RIVALS[i - 1].f, 'the board is in order');
  assert.equal(new Set(RIVALS.map((r) => r.name)).size, 16);
  for (const r of RIVALS) assert.doesNotMatch(r.name, REAL, r.name);
  assert.equal(RIVALS[RIVALS.length - 1].name, 'A Literal Potato');
  assert.equal(rankOf(0), 17); assert.equal(rankOf(41), 16); assert.equal(rankOf(30000001), 1);
  assert.equal(nextRival(0).name, 'A Literal Potato'); assert.equal(nextRival(3e7 + 1), null);
});

// ---------- her career ----------
test('a new career: zero followers, a few views, a bare bedroom; chatting and gaming open, the rest at their followers', () => {
  const c = newCareer();
  assert.equal(c.followers, 0); assert.equal(c.views, TUNE.start.views); assert.equal(c.room, 0); assert.equal(c.streams, 0);
  assert.ok(Object.values(c.owned).every((t) => t === 0));
  assert.deepEqual(unlocked(c).map((k) => k.id), ['talk', 'game']);
  assert.equal(isOpen(c, 'sing'), false); assert.equal(isOpen(c, 'nope'), false);
  assert.equal(nextUnlock(c).id, 'sing');
  assert.equal(trendOf(c), trendOf(c), 'the same career, the same trend');
  c.followers = 60;
  assert.equal(isOpen(c, 'sing'), true);
  c.followers = 1e9;
  assert.equal(unlocked(c).length, 8); assert.equal(nextUnlock(c), null);
});

test('what a stream draws: her room\'s things for that kind, her home, what\'s trending, and how tired chat is of it', () => {
  const c = newCareer();
  c.followers = 3000;
  const tr = trendOf(c);
  const other = unlocked(c).find((k) => k.id !== tr).id;
  const plain = appeal(c, other, { trend: null });
  assert.ok(Math.abs(appeal(c, other, { trend: other }) - plain * TUNE.trend.mult) < 1e-9, 'trending: ×1.35');
  // a thing that helps singing helps a karaoke stream, not an art one as much
  const sing0 = appeal(c, 'sing', { trend: null }), art0 = appeal(c, 'art', { trend: null });
  c.owned.mic = 2;
  assert.ok(appeal(c, 'sing', { trend: null }) > sing0 * 1.5);
  assert.ok(appeal(c, 'art', { trend: null }) === art0, 'a mic does nothing for drawing');
  assert.equal(pointsFor(c, 'sing'), Object.values(SLOTS).reduce((n, s) => n + (s.tiers[c.owned[s.id]].stats.sing || 0), 0));
  // a bigger home: every kind more
  const a = appeal(c, 'talk', { trend: null });
  c.room = 1;
  assert.ok(Math.abs(appeal(c, 'talk', { trend: null }) - a * ROOMS[1].mult) < 1e-9);
  // chat gets tired of the same thing, and comes back to it
  const r = { cat: 'talk', views: 10, followers: 1, peak: 5, clips: 0, clipViews: 0, combo: 0, stats: {} };
  const t0 = freshMult(c, 'talk');
  applyStream(c, r); applyStream(c, r);
  assert.ok(Math.abs(c.fresh.talk - TUNE.fresh.use ** 2) < 1e-9);
  assert.ok(freshMult(c, 'talk') < t0 && freshMult(c, 'talk') >= TUNE.fresh.floor);
  applyStream(c, { ...r, cat: 'game' });
  assert.ok(c.fresh.talk > TUNE.fresh.use ** 2, 'a stream of something else brings it back');
  assert.equal(c.fresh.game, TUNE.fresh.use);
  assert.ok(trendLeft(c) >= 1 && trendLeft(c) <= TUNE.trend.every);
  // more followers: more viewers at the start, and a busier stream
  assert.ok(reachOf(1e6) > reachOf(1e4) && reachOf(1e4) > reachOf(0) && reachOf(0) === TUNE.base);
  assert.ok(startViewers(c, 'talk') > 0);
  assert.equal(busyOf(0), 0); assert.ok(busyOf(1e5) > 0.3 && busyOf(1e5) < 1); assert.equal(busyOf(1e12), 1);
});

test('her room\'s shop and moving up: views pay for the next tier, the next home needs its followers and its views', () => {
  const c = newCareer();
  assert.equal(tierOf(c, 'mic').id, 'earbuds');
  assert.equal(nextTier(c, 'mic').id, 'usbmic');
  assert.equal(upgrade(c, 'mic'), null, 'not enough views');
  c.views = 150;
  assert.equal(upgrade(c, 'mic').id, 'usbmic');
  assert.equal(c.views, 50); assert.equal(c.owned.mic, 1);
  const best = bestUpgrades(c, 'sing');
  assert.ok(best.length === SLOTS.length && best.every((u, i) => i === 0 || u.per <= best[i - 1].per), 'the best for the views first');
  c.views = 1e12;
  for (const s of SLOTS) while (upgrade(c, s.id));
  assert.equal(fullRoom(c), true);
  assert.equal(nextTier(c, 'mic'), null); assert.equal(upgrade(c, 'mic'), null);
  // homes
  const d = newCareer();
  d.views = 1e9;
  assert.equal(nextRoom(d).id, 'studio');
  assert.equal(canMove(d), false); assert.equal(moveRoom(d), null, 'not enough followers yet');
  d.followers = ROOMS[1].at;
  assert.equal(canMove(d), true);
  assert.equal(moveRoom(d).id, 'studio');
  assert.equal(d.room, 1); assert.equal(d.views, 1e9 - ROOMS[1].cost);
  d.followers = 1e9; moveRoom(d); moveRoom(d);
  assert.equal(d.room, 3); assert.equal(nextRoom(d), null); assert.equal(moveRoom(d), null);
});

test('away: her old streams earn half their views for at most eight hours; clips add to it', () => {
  const c = newCareer();
  assert.equal(idleRate(c), 0);
  c.followers = 10000;
  const rate = idleRate(c);
  assert.ok(Math.abs(rate - 10000 * TUNE.idle.perFollower) < 1e-9);
  const g = awayGain(c, 3600);
  assert.equal(g.counted, 3600); assert.equal(g.capped, false);
  assert.ok(Math.abs(g.views - rate * 3600 * TUNE.idle.away) < 1e-6);
  const long = awayGain(c, 3 * 86400);
  assert.equal(long.counted, 8 * 3600); assert.equal(long.capped, true);
  assert.equal(awayGain(c, -5).views, 0); assert.equal(awayGain(c, NaN).views, 0);
  applyStream(c, { cat: 'talk', views: 0, followers: 0, peak: 1, clips: 2, clipViews: 1000, combo: 0, stats: {} });
  assert.ok(idleRate(c) > rate, 'clips keep getting watched');
});

test('after a stream: followers and views added, records kept, and what changed (awards, kinds opened, rivals passed, rank)', () => {
  const c = newCareer();
  c.followers = 90;
  const r = { cat: 'game', views: 500, followers: 920, peak: 333.6, clips: 1, clipViews: 0, combo: 17, stats: { banned: 3, raids: 1, answered: 9, hearts: 4, clips: 1, fixed: 1, bigs: 1 } };
  const got = applyStream(c, r);
  assert.equal(c.streams, 1); assert.equal(c.followers, 1010); assert.equal(c.views, TUNE.start.views + 500);
  assert.equal(c.peak, 334); assert.equal(c.bestCombo, 17);
  assert.deepEqual(got.awards.map((a) => a.id), ['bronze', 'silver']);
  assert.deepEqual(got.opened.map((k) => k.id), ['art']);
  assert.deepEqual(got.passed.map((x) => x.name), ['Noob Toaster', 'Grandma Gamer']);
  assert.deepEqual(got.rank, [16, 14]);
  assert.equal(got.room, null);
  assert.deepEqual(c.last, { cat: 'game', peak: 334, views: 500, followers: 920 });
  assert.equal(c.totals.banned, 3); assert.equal(c.totals.byCat.game, 1);
  c.followers = 9990;
  assert.equal(applyStream(c, { ...r, followers: 20 }).room.id, 'studio', 'the next home is ready');
});

// ---------- a stream ----------
test('a stream: a minute long, things turn up and wait for a tap; nobody tapping is a bad stream, still a follower', () => {
  const S = createStream({ cat: 'talk', v0: 10, busy: 0, followers: 0, seed: 3 });
  assert.equal(S.dur, TUNE.dur);
  const seen = new Set();
  let most = 0;
  const out = runStream(S, (s) => {
    for (const e of drain(s)) if (e.type === 'spawn') seen.add(e.target.kind);
    most = Math.max(most, s.targets.filter((x) => !['heart', 'big', 'clip'].includes(x.kind)).length);
  });
  assert.equal(S.t, TUNE.dur);
  assert.ok(most <= 4, 'never more than four things waiting (a phone has room for that)');
  for (const k of ['ask', 'bot', 'heart', 'big']) assert.ok(seen.has(k), k);
  assert.equal(out.stats.answered, 0); assert.ok(out.stats.misses > 5);
  assert.equal(out.grade, 'C');
  assert.ok(out.followers >= 1);
  assert.equal(S.targets.length, 0, 'nothing left waiting');
  assert.deepEqual(KINDS, ['ask', 'bot', 'raid', 'tech', 'heart', 'clip', 'big']);
  // and a stream that's over takes no more taps or steps
  assert.equal(tap(S, 1), null);
  step(S, 1); assert.equal(S.t, TUNE.dur);
});

test('taps: a question answered and a bot banned raise the hype; a miss breaks the combo; a raid brings its viewers', () => {
  const S = createStream({ cat: 'game', v0: 50, busy: 0.6, followers: 20000, seed: 11 });
  let asked = null, bot = null, raid = null;
  // everything tapped as it turns up (the big moment's taps too), until a question, a bot and a raid have come
  for (let i = 0; i < 60 * 30 && !(asked && bot && raid); i++) {
    step(S, dt);
    for (const x of [...S.targets]) {
      const h = S.hype, v = S.viewers;
      const r = tap(S, x.id);
      if (x.kind === 'ask' && !asked) { assert.equal(r.kind, 'ask'); assert.ok(S.hype > h || S.hype === TUNE.hype.max); asked = x; }
      if (x.kind === 'bot' && !bot) { assert.ok(S.hype > h || S.hype === TUNE.hype.max); bot = x; }
      if (x.kind === 'raid' && !raid) { assert.equal(r.gain, x.size); assert.ok(S.viewers >= v + x.size - 1e-9); assert.ok(RIVALS.some((y) => y.name === x.who)); raid = x; }
    }
  }
  assert.ok(asked && bot && raid, 'all three turned up');
  assert.equal(S.stats.misses, 0);
  assert.ok(S.combo >= 3);
  // let the next thing that needs a tap go by
  const comboBefore = S.combo;
  while (!S.out.some((e) => e.type === 'miss')) step(S, dt);
  assert.ok(S.combo < comboBefore || S.combo === 0);
  assert.equal(tap(S, 9999), null, 'a tap on nothing does nothing');
});

test('her big moment: once a stream, between 30 and 42 seconds; eleven quick taps win it', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const S = createStream({ cat: 'sing', v0: 20, seed });
    let big = null;
    while (!big) { step(S, dt); big = S.targets.find((x) => x.kind === 'big'); }
    assert.ok(S.t >= TUNE.big.at[0] && S.t <= TUNE.big.at[1] + dt, `${seed}: at ${S.t}`);
    for (let k = 1; k < TUNE.big.taps; k++) assert.deepEqual(tap(S, big.id), { kind: 'big', taps: k, need: TUNE.big.taps });
    const v = S.viewers, h = S.hype;
    assert.equal(tap(S, big.id).kind, 'big');
    assert.ok(S.viewers > v && S.hype > h);
    assert.equal(S.stats.bigs, 1);
    runStream(S);
    assert.equal(S.stats.bigs, 1, 'only one');
  }
});

test('the viewers follow the hype; a tech problem halves where they\'re heading until it\'s fixed', () => {
  const S = createStream({ cat: 'talk', v0: 100, seed: 5 });
  const low = targetOf(S);
  S.hype = 90;
  assert.ok(targetOf(S) > low * 2);
  S.targets.push({ id: 999, kind: 'tech', born: 0, life: 6, age: 0 });
  const t = targetOf(S);
  S.targets.pop();
  assert.ok(Math.abs(t - targetOf(S) * 0.55) < 1e-9);
});

test('the same seed and the same taps give the same stream, to the last number', () => {
  const play = (seed) => { const S = createStream({ cat: 'art', v0: 300, busy: 0.4, followers: 5000, seed }); return playStream(S, createPlayer('good', 9)); };
  assert.deepEqual(play(42), play(42));
  assert.notDeepEqual(play(42), play(43));
});

// ---------- the game's own streamers ----------
test('the game\'s own streamers: a better player has better streams; the tile\'s player streams well', () => {
  const avg = (profile) => {
    let f = 0, s = 0;
    for (let seed = 1; seed <= 6; seed++) { const out = playStream(createStream({ cat: 'game', v0: 200, busy: 0.4, followers: 8000, seed }), createPlayer(profile, seed)); f += out.followers; if (out.grade === 'S' || out.grade === 'A') s++; }
    return { f, s };
  };
  const newbie = avg('newbie'), good = avg('good'), pro = avg('pro');
  const none = runStream(createStream({ cat: 'game', v0: 200, busy: 0.4, followers: 8000, seed: 1 })).followers;
  assert.ok(newbie.f / 6 > none, 'even a newbie beats not playing');
  assert.ok(good.f > newbie.f && pro.f > good.f * 0.98);
  assert.ok(good.s >= 4, 'a good player mostly has A or S streams');
  assert.ok(Object.keys(PROFILES).includes('demo'));
  // choosing: a careful player takes the best draw
  const c = newCareer(); c.followers = 5000;
  const best = unlocked(c).map((k) => [k.id, appeal(c, k.id)]).sort((a, b) => b[1] - a[1])[0][0];
  assert.equal(chooseCat(c, createPlayer('pro', 1)), best);
  // shopping never spends views that aren't there
  c.views = 1000; shop(c, createPlayer('good', 2));
  assert.ok(c.views >= 0 && c.views < 1000);
});

test('the pace of a career: a good player is #1 trending in about an hour (40 to 75 streams), never in a few minutes', () => {
  const at = (log, f) => log.find((l) => l.followers >= f)?.i ?? Infinity;
  const ones = [];
  for (const seed of [1, 2, 3]) {
    const { c, log } = career('good', { streams: 90, seed });
    const n = at(log, RIVALS[0].f + 1);
    ones.push(n);
    assert.ok(at(log, 60) <= 8, `${seed}: karaoke within a few streams`);
    assert.ok(at(log, ROOMS[1].at) >= 10 && at(log, ROOMS[1].at) <= 30, `${seed}: the studio flat after a while (${at(log, ROOMS[1].at)})`);
    assert.equal(c.room, 3, `${seed}: she streams from space by the end`);
    assert.ok(log.every((l, i) => i === 0 || l.followers >= log[i - 1].followers), 'followers never go down');
  }
  ones.sort((a, b) => a - b);
  assert.ok(ones[1] >= 40 && ones[1] <= 75, `#1 at stream ${ones[1]}`);
  const pro = career('pro', { streams: 34, seed: 1 });
  assert.ok(pro.c.followers < RIVALS[0].f, 'even a pro needs more than half an hour');
  const newbie = career('newbie', { streams: 26, seed: 2 });
  assert.ok(isOpen(newbie.c, 'sing') && isOpen(newbie.c, 'art'), 'a newbie gets somewhere too');
});

// ---------- what's kept ----------
test('what\'s kept: her career loaded with care (anything odd starts fresh or is clamped), stickers earned once', () => {
  assert.deepEqual(load(null), fresh());
  assert.deepEqual(load({ career: { v: 2 } }), fresh());
  assert.deepEqual(load('nope'), fresh());
  const s = fresh();
  s.career.followers = 1234; s.career.views = 99.5; s.career.room = 2; s.career.owned.mic = 3; s.career.fresh.talk = 0.5;
  s.career.streams = 7; s.career.totals.banned = 12; s.career.totals.byCat.talk = 4; s.career.last = { cat: 'talk', peak: 9, views: 30, followers: 2 };
  s.at = 1700000000000; s.stickers = ['first', 'nope']; s.tips = { hub: true }; s.played = 7;
  const back = load(JSON.parse(JSON.stringify(s)));
  assert.equal(back.career.followers, 1234); assert.equal(back.career.views, 99.5); assert.equal(back.career.room, 2);
  assert.equal(back.career.owned.mic, 3); assert.equal(back.career.fresh.talk, 0.5); assert.equal(back.career.totals.byCat.talk, 4);
  assert.deepEqual(back.stickers, ['first'], 'an unknown sticker dropped');
  assert.equal(back.at, 1700000000000); assert.deepEqual(back.tips, { hub: true }); assert.equal(back.played, 7);
  const odd = load({ career: { v: 1, followers: -5, views: 'x', room: 99, owned: { mic: 42, pc: -1 }, fresh: { talk: 7 }, last: { cat: 'nope' } }, at: 'then' });
  assert.equal(odd.career.followers, 0); assert.equal(odd.career.views, TUNE.start.views); assert.equal(odd.career.room, ROOMS.length - 1);
  assert.equal(odd.career.owned.mic, 3); assert.equal(odd.career.owned.pc, 0); assert.equal(odd.career.fresh.talk, 1);
  assert.equal(odd.career.last, null); assert.equal(odd.at, null);
  // stickers
  const g = fresh();
  assert.deepEqual(earned(g), []);
  g.career.streams = 1; g.career.followers = 150;
  assert.deepEqual(earned(g, { grade: 'S', combo: 31 }).map((x) => x.id), ['first', 'hundred', 'combo', 'srank']);
  assert.deepEqual(earned(g, { grade: 'S', combo: 31 }), [], 'earned once');
  assert.equal(STICKERS.length, 14); assert.ok(STICKERS.every((x) => stickerOf(x.id) === x && x.how.length > 8));
});

// ---------- the words ----------
test('her words and her chat: made up, PG-13, never money, no real creator or platform', () => {
  const lines = [...NAMES, ...Object.values(TIPS)];
  for (let n = 0; n < 200; n++) {
    for (const id of CAT_IDS) { lines.push(chatLine(id, n)); const q = askOf(id, n); lines.push(q.q, q.a); assert.ok(q.q && q.a, `${id} ${n}`); }
    lines.push(botLine(n), botName(n));
    const t = techOf(n, false); assert.notEqual(t.id, 'cat', 'no cat problem before she has a cat'); lines.push(t.text, t.fix);
    lines.push(techOf(n, true).text);
  }
  for (const k of ['ban', 'raid', 'raidMiss', 'fix', 'techMiss', 'heart', 'clip', 'big', 'bigMiss', 'combo', 'idle', 'back', 'first', 'bought', 'moved', 'award', 'number1']) for (let q = 0; q < 6; q++) lines.push(say(k, null, q / 6));
  for (const id of CAT_IDS) for (let q = 0; q < 3; q++) lines.push(say('start', id, q / 3));
  for (const grade of ['S', 'A', 'B', 'C']) for (let q = 0; q < 3; q++) lines.push(endLine({ grade }, q / 3));
  lines.push(raidLine({ who: 'GPU Goblin', size: 1234 }));
  for (const k of CATS) lines.push(k.name, k.blurb, k.mash);
  for (const s of SLOTS) for (const t of s.tiers) lines.push(t.name);
  for (const s of STICKERS) lines.push(s.name, s.how);
  for (const l of lines) {
    assert.ok(typeof l === 'string' && l.length > 0, String(l));
    assert.doesNotMatch(l, MONEY, `never money: ${l}`);
    assert.doesNotMatch(l, REAL, `ours, nobody else's: ${l}`);
    assert.doesNotMatch(l, /undefined|NaN|\$\{|\bfuck|\bshit|\bsexy|\bnsfw/i, l);
  }
  assert.equal(say('nope'), '');
  assert.equal(raidLine({ who: 'Bit Buddy', size: 1500 }), 'Bit Buddy is raiding with 1,500 viewers!');
  assert.equal(shareText({ cat: 'sing', peak: 1234 }, 7), 'I went live as AGI-1 (Karaoke) and hit 1,234 viewers 💜 #7 trending in GOING LIVE. Your turn.');
  assert.equal(nameOf(3), NAMES[3]);
});

// ---------- its code ----------
test('its code: the kit\'s shell with its id, its rules free of the page and the clock, nothing from elsewhere', () => {
  const dir = new URL('../src/games/goinglive/', import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
  const bare = (f) => read(`src/games/goinglive/${f}`).replace(/\/\/.*$/gm, '').replace(/'[^'\n]*'/g, "''");
  for (const f of ['data.js', 'econ.js', 'stream.js', 'ai.js', 'progress.js']) {
    assert.doesNotMatch(bare(f), /\b(document|window|navigator|localStorage|Math\.random|requestAnimationFrame|performance|Date\.now)\b/, `${f}: pure and seeded`);
  }
  assert.doesNotMatch(bare('lines.js'), /\b(document|window|navigator|localStorage)\b/);
  const game = read('src/games/goinglive/game.js');
  assert.match(game, /createShell\(\{\s*game: 'goinglive'/);
  assert.match(game, /shell\.started\(\{ count: !QA && !DEMO \}\)/, 'a stream counts one play (never in a test page or the tile)');
  assert.match(game, /const persist = \(\) => QA \|\| DEMO \|\| shell\.store\.update/, 'a test page and the tile keep nothing');
  assert.match(game, /fine: 'Made-up streamers, chat and numbers/, 'the title says it\'s all made up');
  for (const f of files) {
    const code = read(`src/games/goinglive/${f}`);
    assert.doesNotMatch(code, /fetch\(|XMLHttpRequest|sendBeacon|WebSocket|eval\(|new Function|\.innerHTML\s*=|setAttribute\(\s*['"]style/, f);
    assert.doesNotMatch(code, /https?:\/\/(?!www\.w3\.org)/, f);
  }
  assert.match(read('src/games/goinglive/page.js').replace(/\/\/.*$/gm, ''), /^\s*import '\.\.\/intro\.js';\s*import '\.\/game\.js';/);
  const css = read('src/games/goinglive/style.css').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of css.matchAll(/(^|[\s,>+~(])\.([a-zA-Z][\w-]*)/g)) assert.match(m[2], /^(gl-|ak\b|ak-|is-)/, `style.css: .${m[2]}`);
  assert.doesNotMatch(css, /url\(\s*['"]?https?:|@import/);
  const html = read('goinglive.html');
  assert.match(html, /<div class="gi" id="agi-intro" aria-hidden="true"><\/div>\s*<main id="ak-root">/);
  assert.match(html, /No wallet needed\./);
  assert.match(html, /Every streamer and number is made up\./, 'its description says so');
  assert.doesNotMatch(html, /\bbuy\b|style=|<style|onclick/i);
  assert.doesNotMatch(html, REAL);
  assert.match(html, /__SITE__\/cards\/games\/goinglive\.jpg/);
});
