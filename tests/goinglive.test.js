// GOING LIVE (2026-11-14; rebuilt the same day), an arcade-kit game on agi1.app/games: AGI-1 starts streaming with zero
// followers in a bare bedroom and climbs to #1 trending (the owner: "yes exactly" to an AGI-1 version of a famous
// YouTuber's streamer game, ours in every way; then, of that game, "the game mechanics there is so good and the graphics
// too" → "Rebuild both" and "Short waits"). What the game is made of (topics, things, video ideas, homes, skills, the
// board); her room's grid (what fits where, moving things, her way round them); her career (videos, trends, levels, the
// shop and its boxes, skills, going live, the drone and the bots, away, quests); the same seed giving the same career;
// a live stream's rules (the mini-game: unchanged from the first version); the game's own players and the pace of a
// whole career; what's kept (and a career from the first version); every thing's pixel art; her words; and its code.
// All in Node (no browser). Run: node --test tests/goinglive.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { TOPICS, TOPIC_IDS, topicOf, KINDS, ITEMS, ALL_ITEMS, itemOf, pointsOf, HOMES, homeOf, PERKS, AWARDS, RIVALS, rankOf, nextRival, TUNE } from '../src/games/goinglive/data.js';
import { TITLES } from '../src/games/goinglive/titles.js';
import { STARTER, canPlace, place, move, store, spotsFor, blocked, path, freeCell, deskSpot } from '../src/games/goinglive/room.js';
import {
  newCareer, drain, openTopics, shopItems, scores, quality, trendsOf, trendMult, expected, expectedFollowers, makeTime, startVideo, uploadLeft,
  tick, newIdeas, ideasReady, xpNeed, addXp, deliverTime, canBuy, buy, boxLeft, tapBox, openBox, placeFromInv, autoSpot, nextHome, canMoveHome,
  moveHome, canPerk, buyPerk, perkCost, slotsOf, liveNeed, liveReady, liveStart, liveWorth, liveDone, catchDrone, zap, pet, awayGain, comeBack,
  idleRate, invCount, reachOf, bestIdea, videosPerStream,
} from '../src/games/goinglive/econ.js';
import { createStream, step, tap, drain as drainS, targetOf, KINDS as TARGETS } from '../src/games/goinglive/stream.js';
import { PROFILES, createPlayer, playStream, playCareer, pickIdea, pickBuy, career } from '../src/games/goinglive/ai.js';
import { STICKERS, stickerOf, fresh, load, saveOf, earned, levelFor } from '../src/games/goinglive/progress.js';
import { NAMES, nameOf, chatLine, askOf, botLine, botName, raidLine, techOf, say, TIPS, endLine, shareText, liveShare, questText, giftText } from '../src/games/goinglive/lines.js';
import { ART, ITEM_ART_IDS } from '../src/games/goinglive/pixel.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const MONEY = /\$AGI|\binvest|\bprofit|financial advice|\bprice\b|\bpump\b|\bdump\b|\bbuy\b|\bmoney\b|\bcash\b|\bdollars?\b|\bpaid\b|\bcrypto|\btoken\b|\bcoin\b/i;
// no real creator, platform or their in-jokes: the game is ours (the owner: an AGI-1 version, not anyone else's)
const REAL = /\b(you ?tube|twitch|pewdiepie|pewds|mr ?beast|tik ?tok|instagram|kick\.com|onlyfans|patreon|ko-?fi|super ?chat|subscrib\w*|donat\w*|brofist|bro army|tuber simulator|puggle|bux|edgar|maya|sven)\b/i;
const dt = 1 / 30;
const fresh2 = (seed = 3) => { const c = newCareer(seed); drain(c); return c; };
// all the experience she's had (her level's bars and this one)
const xpAll = (c) => { let s = c.xp; for (let L = 1; L < c.level; L++) s += xpNeed(L); return s; };
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
const isFirst = (id) => ['chat', 'gaming', 'cute', 'funny'].includes(id);
const isOpen = (c, id) => openTopics(c).some((t) => t.id === id);
// a live stream played to the end by nobody (`fn` each step, to tap things)
function runStream(S, fn) { while (!S.over) { fn?.(S); step(S, dt); } return S.over; }

// ---------- what the game is made of ----------
test('topics: ten, four to start and the rest opening level by level, each with its big moment for going live', () => {
  assert.deepEqual(TOPIC_IDS, ['chat', 'gaming', 'cute', 'funny', 'music', 'art', 'cooking', 'tech', 'cozy', 'dance']);
  assert.deepEqual(TOPICS.map((t) => t.level), [1, 1, 1, 1, 3, 5, 8, 11, 14, 18]);
  for (const t of TOPICS) {
    assert.equal(topicOf(t.id), t);
    assert.match(t.color, /^#[0-9a-f]{6}$/);
    assert.ok(t.icon && t.name && t.mash.length > 8, t.id);
  }
  assert.equal(topicOf('nope'), null);
});

test('her things: ninety, each with a place, a size, a price, a level and topics; the starter room free; plaques given', () => {
  assert.equal(ITEMS.length, 90);
  const ids = new Set();
  for (const x of ALL_ITEMS) {
    assert.ok(!ids.has(x.id), `${x.id}: once`); ids.add(x.id);
    assert.ok(['floor', 'flat', 'wall', 'top'].includes(x.place), x.id);
    assert.ok(KINDS.some((k) => k.id === x.kind), `${x.id}: its shelf`);
    assert.ok(x.w >= 1 && x.w <= 4 && x.h >= 1 && x.h <= 2, `${x.id}: its size`);
    assert.ok(x.price >= 0 && x.level >= 1 && x.level <= 40, x.id);
    assert.ok(Object.keys(x.pts).length && Object.keys(x.pts).every((t) => TOPIC_IDS.includes(t)), `${x.id}: its topics`);
    assert.ok(Object.values(pointsOf(x)).every((v) => Number.isInteger(v) && v >= 1), `${x.id}: whole points`);
    if (x.place === 'top') assert.ok(x.w <= 2, `${x.id}: small`);
    if (x.surface) assert.ok(x.place === 'floor' && x.surface > 5, `${x.id}: things stand on it`);
  }
  assert.deepEqual(ITEMS.filter((x) => x.starter).map((x) => x.id), ['desk', 'laptop', 'stool', 'bed', 'window']);
  assert.ok(ITEMS.filter((x) => x.starter).every((x) => x.price === 0));
  // dearer things are worth more points
  const total = (id) => sum(pointsOf(itemOf(id)));
  assert.ok(total('statue') > total('quantum') && total('quantum') > total('pc') && total('pc') > total('duck'));
  // a few on every shelf, and things for every topic soon after it opens
  for (const k of KINDS) assert.ok(ITEMS.filter((x) => x.kind === k.id && !x.starter).length >= 4, k.id);
  for (const t of TOPICS) assert.ok(ITEMS.filter((x) => x.pts[t.id] && x.level <= t.level + 4).length >= 3, `${t.id}: things for it`);
  // the plaques: given, never sold, hung on the wall
  for (const a of AWARDS) { const x = itemOf(`plaque_${a.id}`); assert.ok(x && x.given && x.price === 0 && x.place === 'wall', a.id); }
  assert.equal(itemOf('nope'), null);
});

test('video ideas: eighty-odd made-up titles, each about two topics; plenty for the first four; every topic has its own', () => {
  assert.ok(TITLES.length >= 80, `${TITLES.length} titles`);
  assert.equal(new Set(TITLES.map((t) => t[0])).size, TITLES.length, 'every title once');
  for (const [title, a, b] of TITLES) {
    assert.ok(TOPIC_IDS.includes(a) && TOPIC_IDS.includes(b) && a !== b, title);
    assert.ok(title.length >= 8 && title.length <= 60, title);
  }
  const first = ['chat', 'gaming', 'cute', 'funny'];
  assert.ok(TITLES.filter((t) => first.includes(t[1]) && first.includes(t[2])).length >= 20, 'plenty at level 1');
  for (const t of TOPIC_IDS) assert.ok(TITLES.filter((x) => x[1] === t || x[2] === t).length >= 6, `${t}: ideas about it`);
});

test('her homes, skills, awards and the board: four homes (the room grows), ten skills, six mics, sixteen made-up streamers', () => {
  assert.deepEqual(HOMES.map((h) => h.id), ['bedroom', 'studio', 'penthouse', 'orbit']);
  assert.equal(HOMES[0].cost, 0);
  for (let i = 1; i < HOMES.length; i++) {
    const a = HOMES[i - 1], b = HOMES[i];
    assert.ok(b.cols >= a.cols && b.rows >= a.rows && b.wall >= a.wall && b.cols * b.rows > a.cols * a.rows && b.at > a.at && b.cost > a.cost, b.id);
  }
  assert.equal(homeOf({ home: 9 }), HOMES[3]); assert.equal(homeOf({}), HOMES[0]);
  assert.equal(PERKS.length, 10);
  for (const p of PERKS) assert.ok(p.max >= 1 && p.max <= 5 && p.level >= 2 && p.desc.length > 10, p.id);
  assert.deepEqual(AWARDS.map((a) => a.at), [100, 1000, 10000, 100000, 1000000, 10000000]);
  assert.equal(RIVALS.length, 16);
  for (let i = 1; i < RIVALS.length; i++) assert.ok(RIVALS[i].f < RIVALS[i - 1].f, 'the board is in order');
  assert.equal(new Set(RIVALS.map((r) => r.name)).size, 16);
  for (const r of RIVALS) assert.doesNotMatch(r.name, REAL, r.name);
  assert.equal(rankOf(0), 17); assert.equal(rankOf(41), 16); assert.equal(rankOf(30000001), 1);
  assert.equal(nextRival(0).name, 'A Literal Potato'); assert.equal(nextRival(3e7 + 1), null);
});

// ---------- her room ----------
test('her room\'s grid: things take cells, never overlap and stay inside; rugs lie under things; small things stand on surfaces', () => {
  const c = fresh2();
  assert.deepEqual(c.items.map((t) => t.id), STARTER.map((s) => s.id));
  const laptop = c.items.find((t) => t.id === 'laptop'), desk = c.items.find((t) => t.id === 'desk');
  assert.equal(laptop.on, desk.uid, 'her laptop is on her desk');
  for (const it of c.items) assert.ok(canPlace(c, it.id, it.x, it.y, { on: it.on, ignore: it.uid }).ok, `${it.id} fits where it is`);
  assert.equal(canPlace(c, 'pc', 3, 0).why, 'taken', 'not where the desk is');
  assert.equal(canPlace(c, 'pc', 9, 0).why, 'outside');
  assert.equal(canPlace(c, 'pc', -1, 2).why, 'outside');
  assert.ok(canPlace(c, 'pc', 0, 3).ok);
  assert.ok(canPlace(c, 'rug', 3, 0).ok, 'a rug lies under the desk');
  assert.ok(canPlace(c, 'gameposter', 4, 0).ok, 'the wall has its own grid');
  assert.equal(canPlace(c, 'gameposter', 1, 0).why, 'taken', 'the window is there');
  assert.equal(canPlace(c, 'gameposter', 0, 2).why, 'outside', 'a poster is two cells tall');
  assert.equal(canPlace(c, 'webcam', 4, 0, { on: desk.uid }).why, 'taken', 'the laptop is there');
  assert.ok(canPlace(c, 'webcam', 5, 0, { on: desk.uid }).ok);
  assert.equal(canPlace(c, 'webcam', 0, 3).why, 'surface', 'a small thing needs something to stand on');
  // moving the desk takes what's on it along; putting it away too
  assert.equal(move(c, desk.uid, 3, 1), false, 'her chair is in the way');
  assert.equal(move(c, desk.uid, 0, 3), true);
  assert.deepEqual([laptop.x, laptop.y], [1, 3]);
  assert.deepEqual(store(c, desk.uid).sort(), ['desk', 'laptop']);
  assert.deepEqual(c.inv, { desk: 1, laptop: 1 });
  assert.equal(c.items.some((t) => t.id === 'laptop'), false);
  // every spot a thing could go
  assert.equal(spotsFor(fresh2(), 'pc').length, 9 * 4 - 3 - 1 - 6, 'every free floor cell');
  assert.deepEqual(spotsFor(fresh2(), 'webcam').map((s) => s.x), [3, 5], 'either side of her laptop');
  assert.equal(place(fresh2(), 'pc', 3, 0), null, 'place checks first');
});

test('her way round the room: round what stands on the floor, onto a seat; her desk spot is in front of her desk', () => {
  const c = fresh2();
  const b = blocked(c);
  assert.ok(b.has('3,0') && b.has('5,0') && b.has('6,1') && !b.has('0,3'), 'the desk and the bed take their cells');
  const p = path(c, { x: 0, y: 3 }, { x: 8, y: 3 });
  assert.equal(p.length, 8);
  assert.ok(p.every((q) => !b.has(`${q.x},${q.y}`)));
  const q = path(c, { x: 5, y: 1 }, { x: 8, y: 2 });
  assert.ok(q && q.length === 4 && q.every((s) => !(s.x >= 6 && s.y <= 1)), 'round the bed');
  assert.ok(path(c, { x: 0, y: 3 }, { x: 4, y: 1 }), 'onto her folding chair');
  const spot = deskSpot(c);
  assert.deepEqual([spot.x, spot.y, spot.seat.id], [4, 1, 'stool']);
  // a row full of things: no way through it
  const d = fresh2();
  for (let x = 0; x < 9; x++) assert.ok(place(d, 'pottedplant', x, 2));
  assert.equal(path(d, { x: 0, y: 3 }, { x: 0, y: 1 }), null);
  assert.deepEqual(freeCell(d, { x: 4, y: 2 }), { x: 4, y: 3 }, 'the nearest free cell (her chair is on 4,1)');
});

// ---------- her career ----------
test('a new career: no followers, a few views, level 1, three ideas, three quests, the bedroom, one video at a time', () => {
  const c = fresh2();
  assert.equal(c.followers, 0); assert.equal(c.views, TUNE.start.views); assert.equal(c.level, 1); assert.equal(c.home, 0);
  assert.equal(c.ideas.length, 3); assert.equal(c.quests.length, 3);
  assert.deepEqual(openTopics(c).map((t) => t.id), ['chat', 'gaming', 'cute', 'funny']);
  for (const x of c.ideas) assert.ok(isFirst(x.a) && isFirst(x.b), x.title);
  assert.ok(shopItems(c).length >= 8 && shopItems(c).every((x) => x.level === 1 && !x.starter && !x.given));
  assert.equal(slotsOf(c), 1);
});

test('a video: an idea and a free slot; a few seconds\' wait; then views, followers and experience; a new idea in its place', () => {
  const c = fresh2();
  const idea = c.ideas[0], e = expected(c, idea);
  const u = startVideo(c, 0);
  assert.ok(u && u.dur === makeTime(c) && u.dur >= 5 && u.dur <= 10, `${u.dur}s at level 1`);
  assert.equal(c.ideas.length, 3); assert.ok(!c.ideas.includes(idea), 'a new idea in its place');
  assert.equal(startVideo(c, 0), null, 'one at a time to start');
  assert.ok(u.views >= e * 0.8 && u.views <= e * 1.25 * (u.viral ? TUNE.video.viralX : 1), 'its views: what was expected, give or take luck');
  const xp0 = xpAll(c);
  tick(c, u.dur - 0.1);
  assert.equal(c.videos, 0); assert.ok(uploadLeft(c, u) > 0);
  tick(c, 0.2);
  assert.equal(c.videos, 1); assert.equal(c.uploads.length, 0);
  assert.ok(c.followers >= 1 && c.views >= TUNE.start.views + u.views);
  assert.ok(xpAll(c) > xp0);
  assert.ok(drain(c).some((x) => x.type === 'video'));
  assert.equal(c.live, 1, 'the live meter fills');
  // videos take longer at higher levels (never more than the cap), less with Faster editing
  c.level = 20; const t20 = makeTime(c);
  c.perks.fast = 4;
  assert.ok(t20 > 20 && t20 <= TUNE.make.max && makeTime(c) < t20 * 0.5);
});

test('what a video gets: more with followers, with her room\'s points for its topics, with trending topics and with skills', () => {
  const c = fresh2();
  const idea = { a: 'gaming', b: 'funny' };
  const bare = expected(c, idea, Object.fromEntries(TOPIC_IDS.map((t) => [t, 0])));
  assert.ok(expected(c, idea) > bare, 'her starter room already helps');
  c.followers = 10000;
  assert.ok(expected(c, idea) > bare * 20);
  assert.ok(reachOf(1e6) > reachOf(1e4) && reachOf(1e4) > reachOf(0) && reachOf(0) === TUNE.video.base);
  const tr = trendsOf(c);
  assert.equal(tr.length, 3);
  assert.equal(trendMult(c, tr[0], tr[1]), TUNE.trend.two);
  assert.equal(trendMult(c, tr[0], TOPIC_IDS.find((t) => !tr.includes(t))), TUNE.trend.one);
  assert.deepEqual(trendsOf(c), tr, 'the same until a few more videos');
  assert.equal(quality(0), 1);
  assert.ok(quality(100) > 3 && quality(1000) > quality(100) && quality(1000) < 25, 'a better room, better videos, less and less so');
  // a bigger channel: more new followers a video, but a smaller share of what she has
  const share = (f) => expectedFollowers({ ...c, followers: f, perks: {} }, idea) / f;
  assert.ok(share(1e6) < share(1e4) && share(1e4) < share(100));
  const f0 = expectedFollowers(c, idea), v0 = expected(c, idea);
  c.perks.follow = 4; c.perks.thumbs = 5; c.perks.radar = 3;
  assert.ok(expectedFollowers(c, idea) > f0 * 1.5 && expected(c, idea) >= v0 * 2 - 1e-9);
});

test('new ideas: free every half a minute; ideas only ever about open topics', () => {
  const c = fresh2();
  assert.equal(ideasReady(c), true);
  const before = c.ideas.map((x) => x.i);
  assert.equal(newIdeas(c), true);
  assert.ok(c.ideas.every((x) => !before.includes(x.i)), 'all new');
  assert.equal(newIdeas(c), false, 'not again at once');
  tick(c, TUNE.ideas.refresh);
  assert.equal(ideasReady(c), true);
  for (const L of [3, 5, 8, 11, 14, 18]) {
    c.level = L;
    for (let k = 0; k < 20; k++) {
      c.ideasAt = 0; newIdeas(c);
      for (const x of c.ideas) assert.ok(isOpen(c, x.a) && isOpen(c, x.b), `${x.title} at level ${L}`);
    }
  }
});

test('levels: experience fills a bar; a level gives an idea point (two every fifth) and opens topics and things', () => {
  const c = fresh2();
  assert.ok(xpNeed(1) < xpNeed(5) && xpNeed(5) < xpNeed(20));
  addXp(c, xpNeed(1) + xpNeed(2) + xpNeed(3) + xpNeed(4) + 1);
  assert.equal(c.level, 5); assert.equal(c.points, 5, 'four levels, the fifth giving two');
  const evs = drain(c).filter((e) => e.type === 'level');
  assert.deepEqual(evs.map((e) => e.level), [2, 3, 4, 5]);
  assert.equal(evs.find((e) => e.level === 3).topic.id, 'music');
  assert.equal(evs.find((e) => e.level === 4).topic, null);
  assert.ok(evs.every((e) => e.items >= 1), 'new things in the shop at every level');
});

test('the shop: views pay; cheap things come at once, dearer ones in a box (a tap makes it come sooner); a new thing placed gives experience once', () => {
  const c = fresh2();
  c.views = 10000; c.level = 5;
  assert.equal(canBuy(c, 'statue'), false, 'not at level 5');
  assert.equal(canBuy(c, 'desk'), false, 'never the starter things');
  assert.equal(canBuy(c, 'plaque_bronze'), false, 'never a plaque');
  assert.equal(deliverTime(c, 50), 0);
  assert.ok(deliverTime(c, 1000) > 3 && deliverTime(c, 1e7) <= TUNE.deliver.max);
  const d = buy(c, 'pc');
  assert.ok(d && boxLeft(c, d) > 0); assert.equal(c.views, 10000 - itemOf('pc').price);
  assert.equal(openBox(c, d.uid), null, 'not yet');
  const left = boxLeft(c, d);
  assert.equal(tapBox(c, d.uid), true);
  assert.ok(boxLeft(c, d) < left);
  tick(c, 60);
  assert.ok(drain(c).some((e) => e.type === 'arrived'));
  assert.equal(openBox(c, d.uid), 'pc'); assert.equal(c.inv.pc, 1);
  const at = autoSpot(c, 'pc'), xp = xpAll(c);
  const it = placeFromInv(c, 'pc', at.x, at.y);
  assert.ok(it && c.items.includes(it)); assert.equal(c.inv.pc, undefined);
  assert.ok(xpAll(c) > xp, 'experience for a new thing');
  store(c, it.uid);
  const xp2 = xpAll(c);
  assert.ok(placeFromInv(c, 'pc', at.x, at.y));
  assert.equal(xpAll(c), xp2, 'none again for the same thing');
  assert.equal(c.totals.placed, 1); assert.equal(invCount(c), 0);
  assert.equal(placeFromInv(c, 'pc', 0, 3), null, 'none left to place');
  // a spot for her new things: never in front of her desk, never shutting off part of the floor
  const e = fresh2(); e.level = 40;
  store(e, e.items.find((t) => t.id === 'stool').uid);
  const spot = deskSpot(e);
  for (let k = 0; k < 10; k++) {
    e.inv.pottedplant = 1;
    const s = autoSpot(e, 'pottedplant');
    if (!s) break;
    placeFromInv(e, 'pottedplant', s.x, s.y);
  }
  assert.ok(!e.items.some((t) => t.x === spot.x && t.y === spot.y), 'her desk spot stays free');
  const b = blocked(e);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 9; x++) if (!b.has(`${x},${y}`) && !(x === spot.x && y === spot.y)) assert.ok(path(e, spot, { x, y }), `she can reach ${x},${y}`);
});

test('skills: an idea point a rank, the next rank costing its number; channels for more videos at once', () => {
  const c = fresh2();
  c.level = 20; c.points = 10;
  assert.equal(perkCost(c, 'thumbs'), 1);
  assert.equal(buyPerk(c, 'thumbs'), true); assert.equal(perkCost(c, 'thumbs'), 2);
  assert.equal(buyPerk(c, 'thumbs'), true); assert.equal(c.points, 7);
  assert.equal(canPerk(c, 'slot3'), false, 'a second channel first');
  assert.equal(buyPerk(c, 'slot2'), true); assert.equal(slotsOf(c), 2);
  assert.equal(buyPerk(c, 'slot3'), true); assert.equal(slotsOf(c), 3);
  assert.equal(canPerk(c, 'slot3'), false, 'one rank');
  assert.ok(startVideo(c, 0) && startVideo(c, 0) && startVideo(c, 0)); assert.equal(startVideo(c, 0), null);
  assert.deepEqual(c.uploads.map((u) => u.slot), [0, 1, 2]);
  c.points = 0; assert.equal(canPerk(c, 'old'), false);
  const d = fresh2(); d.points = 5;
  assert.equal(canPerk(d, 'slot2'), false, 'not at level 1');
});

test('going live: her first stream after a handful of videos, then about three minutes of videos each; a stream is worth about the minute of videos it takes, much more hyped, the most for an S', () => {
  const c = fresh2();
  c.followers = 5000;
  assert.equal(liveNeed(c), TUNE.live.first, 'her first stream comes soon');
  assert.equal(liveReady(c), false); assert.equal(liveStart(c), null);
  c.live = liveNeed(c);
  const L = liveStart(c);
  assert.ok(L && L.v0 > 50 && TOPIC_IDS.includes(L.topic) && L.busy > 0 && L.busy < 1);
  assert.equal(c.live, 0, 'the meter empties');
  const r = playStream(createStream({ cat: L.topic, v0: L.v0, busy: L.busy, followers: c.followers, seed: 5 }), createPlayer('pro', 5));
  // the minute it takes: her best video now, as many times as she could make it in a minute
  const minute = expectedFollowers(c, bestIdea(c, r.cat)) * videosPerStream(c), w = liveWorth(c, r);
  assert.ok(w.followers >= minute * TUNE.live.worth[0] && w.followers <= minute * (TUNE.live.worth[0] + TUNE.live.worth[1] + TUNE.live.worth[2]) + 1, `${w.followers} for a minute of ${Math.round(minute)}`);
  assert.ok(w.followers > minute, 'a pro\'s stream is worth more than the videos it replaces');
  const f = c.followers, got = liveDone(c, r);
  assert.deepEqual(got, w);
  assert.equal(c.followers, f + got.followers);
  assert.equal(c.totals.live, 1); assert.equal(c.peak, Math.round(r.peak));
  const quiet = liveWorth(c, { ...r, grade: 'C', hypeAvg: 0 }), best = liveWorth(c, { ...r, grade: 'S', hypeAvg: 100 });
  assert.ok(best.followers > quiet.followers * 3.5, 'a hyped S is worth over three quiet streams');
  // after her first: about three minutes of her videos, less with Live energy
  const need = liveNeed(c);
  assert.equal(need, Math.round(TUNE.live.charge * videosPerStream(c)));
  assert.ok(need >= 15 && need <= 40, `${need} videos`);
  c.perks.energy = 2;
  assert.ok(liveNeed(c) < need && liveNeed(c) >= 4);
});

test('the drone and the bots: a gift for a tap while it flies; bots slow her old videos down until zapped', () => {
  const c = fresh2();
  c.followers = 500;
  let gift = null;
  const bots = [];
  for (let t = 0; t < 400 && !(gift && bots.length); t++) {
    tick(c, 1);
    for (const e of drain(c)) {
      if (e.type === 'drone' && !gift) { gift = catchDrone(c); assert.ok(gift); assert.equal(catchDrone(c), null, 'only once'); }
      if (e.type === 'bot') bots.push(e.bot.id);
    }
  }
  assert.ok(gift && ['views', 'item', 'point'].includes(gift.kind), 'a gift');
  assert.ok(bots.length >= 1, 'bots came');
  const slow = idleRate(c);
  for (const id of bots) assert.ok(zap(c, id) > 0);
  assert.ok(idleRate(c) > slow, 'her old videos earn again');
  assert.equal(zap(c, 99999), 0);
  const v = c.views;
  for (let k = 0; k < 5; k++) pet(c);
  assert.ok(c.views > v, 'every fifth pet, a few views');
});

test('away: her old videos earn half (eight hours at most) and her videos finish; a bigger home keeps everything where it was', () => {
  const c = fresh2();
  assert.ok(idleRate(c) > 0);
  c.followers = 20000;
  const r = idleRate(c);
  const g = awayGain(c, 3600);
  assert.equal(g.counted, 3600); assert.equal(g.capped, false);
  assert.ok(Math.abs(g.views - r * 3600 * TUNE.idle.away) < 1e-6);
  const long = awayGain(c, 86400);
  assert.equal(long.counted, TUNE.idle.cap); assert.equal(long.capped, true);
  assert.equal(awayGain(c, -5).views, 0); assert.equal(awayGain(c, NaN).views, 0);
  startVideo(c, 0);
  comeBack(c, 120);
  assert.equal(c.uploads.length, 0); assert.equal(c.videos, 1);
  // a bigger home: its followers and its views; everything stays where it was
  const h = nextHome(c);
  assert.equal(h.id, 'studio');
  c.views = h.cost - 1; assert.equal(canMoveHome(c), false); assert.equal(moveHome(c), null);
  c.views = h.cost;
  const items = JSON.stringify(c.items);
  assert.equal(moveHome(c).id, 'studio');
  assert.equal(c.home, 1); assert.equal(c.views, 0); assert.equal(JSON.stringify(c.items), items);
  assert.ok(canPlace(c, 'pc', 11, 4).ok, 'more room');
  c.followers = 1e9; c.views = 1e12; moveHome(c); moveHome(c);
  assert.equal(c.home, 3); assert.equal(nextHome(c), null); assert.equal(moveHome(c), null);
});

test('quests: three at a time, paid at once when done and replaced; awards hang plaques in her things', () => {
  const c = newCareer(5), bot = createPlayer('good', 5);
  const done = [];
  for (let t = 0; t < 900; t++) playCareer(c, bot, 1);
  // playCareer drains as it goes: count what it finished by the quests' numbers
  for (let n = 1; n < c.questN; n++) if (!c.quests.some((q) => q.n === n)) done.push(n);
  assert.ok(done.length >= 6, `${done.length} quests done in fifteen minutes`);
  assert.equal(c.quests.length, 3);
  for (const q of c.quests) {
    const s = questText(q);
    assert.ok(s.length > 6 && !/undefined|NaN/.test(s), s);
    assert.ok(q.reward.views > 0 && q.reward.xp > 0);
  }
  assert.ok(c.followers >= 1000);
  assert.ok(c.awards.includes('bronze') && c.awards.includes('silver'));
  assert.ok(c.items.some((t) => t.id === 'plaque_bronze') || c.inv.plaque_bronze >= 1, 'the bronze plaque is hers');
});

test('the same seed and the same choices give the same career', () => {
  const play = (seed) => {
    const bot = createPlayer('good', 4), c = newCareer(seed);
    for (let t = 0; t < 600; t++) playCareer(c, bot, 1);
    return JSON.stringify({ f: c.followers, v: c.views, L: c.level, items: c.items, inv: c.inv, q: c.quests, ideas: c.ideas });
  };
  assert.equal(play(9), play(9));
  assert.notEqual(play(9), play(10));
});

// ---------- a live stream (the mini-game, unchanged from the first version) ----------
test('a stream: a minute long, things turn up and wait for a tap; nobody tapping is a bad stream, still a follower', () => {
  const S = createStream({ cat: 'chat', v0: 10, busy: 0, followers: 0, seed: 3 });
  assert.equal(S.dur, TUNE.dur);
  const seen = new Set();
  let most = 0;
  const out = runStream(S, (s) => {
    for (const e of drainS(s)) if (e.type === 'spawn') seen.add(e.target.kind);
    most = Math.max(most, s.targets.filter((x) => !['heart', 'big', 'clip'].includes(x.kind)).length);
  });
  assert.equal(S.t, TUNE.dur);
  assert.ok(most <= 4, 'never more than four things waiting (a phone has room for that)');
  for (const k of ['ask', 'bot', 'heart', 'big']) assert.ok(seen.has(k), k);
  assert.equal(out.stats.answered, 0); assert.ok(out.stats.misses > 5);
  assert.equal(out.grade, 'C');
  assert.ok(out.followers >= 1);
  assert.equal(S.targets.length, 0, 'nothing left waiting');
  assert.deepEqual(TARGETS, ['ask', 'bot', 'raid', 'tech', 'heart', 'clip', 'big']);
  assert.equal(tap(S, 1), null);
  step(S, 1); assert.equal(S.t, TUNE.dur);
});

test('taps: a question answered and a bot banned raise the hype; a miss breaks the combo; a raid brings its viewers', () => {
  const S = createStream({ cat: 'gaming', v0: 50, busy: 0.6, followers: 20000, seed: 11 });
  let asked = null, bot = null, raid = null;
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
  const comboBefore = S.combo;
  while (!S.out.some((e) => e.type === 'miss')) step(S, dt);
  assert.ok(S.combo < comboBefore || S.combo === 0);
  assert.equal(tap(S, 9999), null, 'a tap on nothing does nothing');
});

test('her big moment: once a stream, between 30 and 42 seconds; eleven quick taps win it', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const S = createStream({ cat: 'music', v0: 20, seed });
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
  const S = createStream({ cat: 'chat', v0: 100, seed: 5 });
  const low = targetOf(S);
  S.hype = 90;
  assert.ok(targetOf(S) > low * 2);
  S.targets.push({ id: 999, kind: 'tech', born: 0, life: 6, age: 0 });
  const t = targetOf(S);
  S.targets.pop();
  assert.ok(Math.abs(t - targetOf(S) * 0.55) < 1e-9);
});

test('the same seed and the same taps give the same stream, to the last number', () => {
  const play = (seed) => playStream(createStream({ cat: 'art', v0: 300, busy: 0.4, followers: 5000, seed }), createPlayer('good', 9));
  assert.deepEqual(play(42), play(42));
  assert.notDeepEqual(play(42), play(43));
});

// ---------- the game's own players ----------
test('the game\'s own players: a better player has better streams; a careful one picks the best idea and only buys what it can', () => {
  const avg = (profile) => {
    let f = 0, s = 0;
    for (let seed = 1; seed <= 6; seed++) { const out = playStream(createStream({ cat: 'gaming', v0: 200, busy: 0.4, followers: 8000, seed }), createPlayer(profile, seed)); f += out.followers; if (out.grade === 'S' || out.grade === 'A') s++; }
    return { f, s };
  };
  const newbie = avg('newbie'), good = avg('good'), pro = avg('pro');
  const none = runStream(createStream({ cat: 'gaming', v0: 200, busy: 0.4, followers: 8000, seed: 1 })).followers;
  assert.ok(newbie.f / 6 > none, 'even a newbie beats not playing');
  assert.ok(good.f > newbie.f && pro.f > good.f * 0.98);
  assert.ok(good.s >= 4, 'a good player mostly has A or S streams');
  assert.ok(Object.keys(PROFILES).includes('demo'));
  const c = fresh2(); c.followers = 5000;
  const s = scores(c), best = c.ideas.map((x, k) => [k, expected(c, x, s)]).sort((a, b) => b[1] - a[1])[0][0];
  assert.equal(pickIdea(c, createPlayer('pro', 1)), best);
  c.views = 1000;
  for (let seed = 1; seed < 20; seed++) { const id = pickBuy(c, createPlayer('good', seed)); assert.ok(id && canBuy(c, id) && itemOf(id).price <= 1000, id); }
  c.views = 0; assert.equal(pickBuy(c, createPlayer('good', 1)), null);
});

test('the pace: a good player is #1 in about an hour and a half of perfect play (a person, longer); a newbie much later; going live and careful shopping both pay', () => {
  const at = (log, f) => log.find((l) => l.f >= f)?.t ?? Infinity;
  for (const seed of [1, 2]) {
    const { c, log } = career('good', { seconds: 200 * 60, seed, until: RIVALS[0].f + 1, dt: 1 });
    const m = (f) => at(log, f) / 60;
    assert.ok(m(RIVALS[0].f + 1) >= 70 && m(RIVALS[0].f + 1) <= 120, `${seed}: #1 at ${Math.round(m(RIVALS[0].f + 1))} minutes`);
    assert.ok(m(100) >= 1 && m(100) <= 5, `${seed}: 100 followers at ${m(100).toFixed(1)} minutes`);
    assert.ok(m(HOMES[1].at) >= 6 && m(HOMES[1].at) <= 16, `${seed}: 10K at ${m(HOMES[1].at).toFixed(1)} minutes`);
    assert.ok(m(1e6) >= 25 && m(1e6) <= 50, `${seed}: a million at ${m(1e6).toFixed(1)} minutes`);
    assert.ok(c.home === 3 && c.level >= 30 && c.items.length >= 100, `${seed}: her space station full of things (${c.items.length})`);
    assert.ok(c.totals.live >= 15 && c.totals.live <= 45, `${seed}: ${c.totals.live} streams`);
    assert.ok(log.every((l, i) => i === 0 || l.f >= log[i - 1].f), 'followers never go down');
  }
  const good = career('good', { seconds: 30 * 60, seed: 1, dt: 1 }), newbie = career('newbie', { seconds: 30 * 60, seed: 1, dt: 1 });
  assert.ok(newbie.c.followers < good.c.followers / 2, `a careful player gets much further (${newbie.c.followers} and ${good.c.followers})`);
  assert.ok(newbie.c.followers > 10000 && newbie.c.level >= 12, 'a newbie gets somewhere too');
  // the same good player, buying anything that fits; and never going live
  const careless = createPlayer('good', 1), lazy = createPlayer('good', 1);
  careless.p = { ...careless.p, shop: 0 };
  const a = newCareer(1), b = newCareer(1);
  while (a.clock < 30 * 60) playCareer(a, careless, 1);
  while (b.clock < 30 * 60) { b.live = 0; playCareer(b, lazy, 1); }
  assert.equal(b.totals.live, 0);
  assert.ok(a.followers < good.c.followers / 1.5, `careful shopping pays (${a.followers} and ${good.c.followers})`);
  assert.ok(b.followers < good.c.followers / 1.5, `going live pays (${b.followers} and ${good.c.followers})`);
});

// ---------- what's kept ----------
test('what\'s kept: a round trip; anything odd starts fresh or is clamped; a room that can\'t be is rebuilt; the first version keeps her followers', () => {
  const s = fresh(5), c = s.career;
  c.views = 99999; c.level = 9; c.points = 2; c.perks = { thumbs: 2 };
  startVideo(c, 0); buy(c, 'webcam'); buy(c, 'pc');
  c.inv.rug = 1; assert.ok(placeFromInv(c, 'rug', 3, 2));
  s.at = 1700000000000; s.stickers = ['first', 'nope']; s.tips = { hub: true, x: 'y' }; s.played = 7;
  const back = load(JSON.parse(JSON.stringify(saveOf(s))));
  for (const k of ['followers', 'level', 'points', 'videos', 'home', 'xp', 'clock']) assert.equal(back.career[k], c[k], k);
  assert.equal(back.career.views, c.views);
  const room = (k) => k.items.map((t) => `${t.id}@${t.x},${t.y}`).sort();
  assert.deepEqual(room(back.career), room(c));
  const lap = back.career.items.find((t) => t.id === 'laptop');
  assert.equal(back.career.items.find((t) => t.uid === lap.on).id, 'desk', 'her laptop still on her desk');
  assert.equal(back.career.uploads.length, 1); assert.equal(back.career.deliveries.length, 2);
  assert.deepEqual(back.career.perks, { thumbs: 2 });
  assert.deepEqual(back.career.ideas.map((x) => x.i), c.ideas.map((x) => x.i));
  assert.deepEqual(back.career.quests.map((q) => q.n), c.quests.map((q) => q.n));
  assert.equal(back.career.out.length, 0);
  assert.deepEqual(back.stickers, ['first'], 'an unknown sticker dropped');
  assert.equal(back.at, 1700000000000); assert.deepEqual(back.tips, { hub: true }); assert.equal(back.played, 7);
  // odd saves
  for (const raw of [null, 'x', 5, { career: { v: 3 } }, { career: 5 }]) assert.equal(JSON.stringify(load(raw)), JSON.stringify(fresh()), JSON.stringify(raw));
  const odd = load({ career: { v: 2, followers: -9, views: 'x', level: 999, home: 99, perks: { thumbs: 99, nope: 3 },
    items: [{ uid: 1, id: 'desk', x: 3, y: 0 }, { uid: 2, id: 'pc', x: 3, y: 0 }, { uid: 3, id: 'laptop', x: 4, on: 1 }, { uid: 4, id: 'zzz', x: 0, y: 0 }, { uid: 5, id: 'webcam', x: 2, on: 1 }],
    inv: { duck: 2, nope: 1 }, uploads: [{ a: 'nope', b: 'chat' }], quests: [{ kind: 'videos' }] } });
  assert.equal(odd.career.followers, 0); assert.equal(odd.career.views, TUNE.start.views);
  assert.equal(odd.career.level, 200); assert.equal(odd.career.home, HOMES.length - 1);
  assert.deepEqual(odd.career.perks, { thumbs: 5 });
  assert.deepEqual(odd.career.items.map((t) => t.id), ['desk', 'laptop'], 'what can\'t be where it says goes to her things');
  assert.deepEqual(odd.career.inv, { pc: 1, webcam: 1, duck: 2 });
  assert.equal(odd.career.uploads.length, 0); assert.equal(odd.career.quests.length, 3); assert.equal(odd.career.ideas.length, 3);
  // the first GOING LIVE: her followers and views, a level to match, a fresh bedroom
  const v1 = load({ career: { v: 1, followers: 25000, views: 5000, room: 2, owned: { mic: 3 } }, stickers: ['first'], at: 123, played: 4 });
  assert.equal(v1.career.followers, 25000); assert.equal(v1.career.views, 5000);
  assert.equal(v1.career.level, levelFor(25000)); assert.ok(v1.career.level >= 10);
  assert.equal(v1.career.points, v1.career.level - 1);
  assert.deepEqual(v1.career.items.map((t) => t.id), STARTER.map((x) => x.id)); assert.equal(v1.career.home, 0);
  assert.equal(v1.at, 123); assert.equal(v1.played, 4); assert.deepEqual(v1.stickers, []);
  assert.equal(levelFor(1e15), 40);
  // stickers, once
  const g = fresh(1);
  assert.deepEqual(earned(g), []);
  g.career.totals.videos = 1; g.career.followers = 150;
  assert.deepEqual(earned(g, { grade: 'S' }).map((x) => x.id), ['first', 'hundred', 'srank']);
  assert.deepEqual(earned(g, { grade: 'S' }), [], 'earned once');
  assert.equal(STICKERS.length, 14); assert.ok(STICKERS.every((x) => stickerOf(x.id) === x && x.how.length > 8));
});

// ---------- the art ----------
test('the pixel art: every thing drawn in code, a height that fits her room, frames for what moves', () => {
  assert.deepEqual([...ITEM_ART_IDS].sort(), ALL_ITEMS.map((x) => x.id).sort(), 'a drawing for every thing, and only for things');
  for (const x of ALL_ITEMS) {
    const a = ART[x.id];
    assert.equal(typeof a.draw, 'function', x.id);
    if (x.place === 'floor' || x.place === 'top') assert.ok(a.ph >= 5 && a.ph <= 56, `${x.id}: ${a.ph}px tall`);
    if (x.anim) assert.ok(a.frames >= 2, `${x.id}: it moves`);
  }
  assert.doesNotMatch(read('src/games/goinglive/pixel.js'), /\.(png|webp|jpe?g|gif|svg)['"`]|new Image|fetch\(/, 'no picture files');
});

// ---------- the words ----------
test('her words, her chat and her ideas: made up, PG-13, never money, no real creator or platform', () => {
  const lines = [...NAMES, ...Object.values(TIPS), ...TITLES.map((t) => t[0])];
  for (let n = 0; n < 200; n++) {
    for (const id of TOPIC_IDS) { lines.push(chatLine(id, n)); const q = askOf(id, n); assert.ok(q.q && q.a, `${id} ${n}`); lines.push(q.q, q.a); }
    lines.push(botLine(n), botName(n));
    const t = techOf(n, false); assert.notEqual(t.id, 'cat', 'no cat problem before she has a cat'); lines.push(t.text, t.fix);
    lines.push(techOf(n, true).text);
  }
  const kinds = ['ban', 'raid', 'raidMiss', 'fix', 'techMiss', 'heart', 'clip', 'big', 'bigMiss', 'combo', 'first', 'record', 'video', 'viral', 'trend',
    'idle', 'back', 'box', 'boxWait', 'placed', 'stored', 'bought', 'level', 'topic', 'quest', 'mail', 'missMail', 'zap', 'bots', 'pet', 'tap', 'live',
    'moved', 'homeReady', 'award', 'perk', 'full', 'number1'];
  for (const k of kinds) for (let q = 0; q < 6; q++) { const l = say(k, null, q / 6); assert.ok(l, k); lines.push(l); }
  for (const id of TOPIC_IDS) for (let q = 0; q < 3; q++) { const l = say('start', id, q / 3); assert.ok(l, id); lines.push(l); }
  for (const grade of ['S', 'A', 'B', 'C']) for (let q = 0; q < 3; q++) lines.push(endLine({ grade }, q / 3));
  for (const kind of ['videos', 'topic', 'place', 'trend', 'kind', 'one', 'live', 'zap', 'mail', 'pet', 'followers']) for (const target of [1, 3, 25000]) lines.push(questText({ kind, target, topic: 'art', shelf: 'plant' }));
  lines.push(giftText({ kind: 'views', n: 120 }), giftText({ kind: 'item', id: 'duck' }), giftText({ kind: 'point' }));
  lines.push(raidLine({ who: 'GPU Goblin', size: 1234 }));
  for (const x of ALL_ITEMS) lines.push(x.name);
  for (const k of KINDS) lines.push(k.name);
  for (const t of TOPICS) lines.push(t.name, t.mash);
  for (const p of PERKS) lines.push(p.name, p.desc);
  for (const h of HOMES) lines.push(h.name);
  for (const s of STICKERS) lines.push(s.name, s.how);
  for (const l of lines) {
    assert.ok(typeof l === 'string' && l.length > 0, String(l));
    assert.doesNotMatch(l, MONEY, `never money: ${l}`);
    assert.doesNotMatch(l, REAL, `ours, nobody else's: ${l}`);
    assert.doesNotMatch(l, /undefined|NaN|\[object|\$\{/, l);
    assert.doesNotMatch(l, /\bfuck|\bshit|\bsexy|\bnsfw/i, l);
  }
  assert.equal(say('nope'), '');
  assert.equal(questText({ kind: 'mail', target: 1 }), 'Catch the fan-mail drone');
  assert.equal(questText({ kind: 'topic', target: 2, topic: 'art' }), 'Make 2 🎨 Art videos');
  assert.equal(giftText({ kind: 'item', id: 'duck' }), 'a Rubber duck (in her things)');
  assert.equal(raidLine({ who: 'Bit Buddy', size: 1500 }), 'Bit Buddy is raiding with 1,500 viewers!');
  assert.equal(shareText({ followers: 12345.4 }, 7), 'I\'m growing AGI-1\'s channel in GOING LIVE: 12,345 followers, #7 trending 💜 Your turn.');
  assert.equal(liveShare({ cat: 'music', peak: 1234 }, 3), 'I went live as AGI-1 (Music) and hit 1,234 viewers 💜 #3 trending in GOING LIVE. Your turn.');
  assert.equal(nameOf(3), NAMES[3]);
});

// ---------- its code ----------
test('its code: the kit\'s shell with its id, its rules free of the page and the clock, nothing from elsewhere', () => {
  const dir = new URL('../src/games/goinglive/', import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
  const bare = (f) => read(`src/games/goinglive/${f}`).replace(/\/\/.*$/gm, '').replace(/'[^'\n]*'/g, "''");
  for (const f of ['data.js', 'titles.js', 'room.js', 'econ.js', 'stream.js', 'ai.js', 'progress.js']) {
    assert.doesNotMatch(bare(f), /\b(document|window|navigator|localStorage|Math\.random|requestAnimationFrame|performance|Date\.now)\b/, `${f}: pure and seeded`);
  }
  assert.doesNotMatch(bare('lines.js'), /\b(document|window|navigator|localStorage)\b/);
  const game = read('src/games/goinglive/game.js');
  assert.match(game, /createShell\(\{\s*game: 'goinglive'/);
  assert.match(game, /shell\.started\(\{ count: !QA && !DEMO \}\)/, 'a play counts once (never in a test page or the tile)');
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
