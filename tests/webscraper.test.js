// WEB SCRAPER (2026-11-24): its rules in Node (no browser): the city (the same from the same seed, inside its edges, a
// bit of everything), what falls in (smaller than the portal and over it) and how it grows, portals swallowing smaller
// portals and coming back, a round's clock and standings, Scrape it all's share and stars, the rivals' minds playing
// whole rounds, and AGI-1's lines.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as WS from '../src/games/webscraper/rules.js';
import { playRound, createBrain, think } from '../src/games/webscraper/ai.js';
import { LINES, shareText } from '../src/games/webscraper/lines.js';
import { checkLines } from './helpers/agi1-lines.js';

const { makeCity, createRound, update, drain, canEat, ranking, rankOf, share, stars, TUNE, TYPES, TYPE_IDS, valueOf } = WS;
const still = () => ({ x: 0, y: 0 });

test('the city: the same from the same seed, inside its edges, with small things and big ones', () => {
  const a = makeCity(5), b = makeCity(5), c = makeCity(6);
  assert.deepEqual(a.items, b.items);
  assert.notDeepEqual(a.items, c.items);
  for (const it of a.items) { assert.ok(it.x >= 1 && it.y >= 1 && it.x <= a.size - 1 && it.y <= a.size - 1); assert.ok(TYPES[it.type]); }
  const kinds = new Set(a.items.map((it) => it.type));
  assert.ok(kinds.size >= 16, `${kinds.size} kinds of things`);
  assert.ok(a.items.filter((it) => it.r < TUNE.start * TUNE.eat).length > 100, 'plenty a new portal can eat');
  assert.ok(valueOf('tower') > valueOf('car') && valueOf('car') > valueOf('cone'));
  assert.equal(a.total, a.items.reduce((s, it) => s + it.value, 0));
});

test('only what’s smaller than the portal, and over it, falls in; the portal grows by what it eats', () => {
  const S = createRound({ mode: 'solo', seed: 2 });
  const me = S.me;
  for (const it of S.items) it.gone = true;
  const cone = { id: 1, type: 'cone', x: me.x + 0.1, y: me.y, a: 0, r: TYPES.cone.r, value: valueOf('cone'), gone: false };
  const car = { id: 2, type: 'car', x: me.x - 0.1, y: me.y, a: 0, r: TYPES.car.r, value: valueOf('car'), gone: false };
  S.items.push(cone, car);
  S.grid = { n: 1, cells: [[cone, car]] };
  const r0 = me.r;
  update(S, 1 / 30, still);
  assert.equal(cone.gone, true, 'the cone fell in');
  assert.equal(car.gone, false, 'the car is too big for a new portal');
  assert.equal(canEat(me, TYPES.car.r), false);
  assert.ok(me.r > r0, 'it grew');
  assert.ok(drain(S).some((e) => e.type === 'eat' && e.you && e.first && e.thing === 'cone'), 'a first for her scrapbook');
});

test('a clearly bigger portal swallows a smaller one, which comes back small a moment later', () => {
  const S = createRound({ mode: 'battle', seed: 3 });
  const [me, rival] = S.holes;
  me.r = 3; me.area = Math.PI * 9;
  rival.x = me.x + 0.5; rival.y = me.y; rival.r = 1; rival.area = Math.PI;
  update(S, 1 / 30, still);
  assert.ok(rival.dead > 0, 'swallowed');
  assert.equal(me.kills, 1);
  assert.ok(drain(S).some((e) => e.type === 'swallow' && e.you));
  for (let t = 0; t < TUNE.respawn + 0.2; t += 1 / 30) update(S, 1 / 30, still);
  assert.equal(rival.dead, 0, 'back');
  assert.ok(rival.r >= TUNE.start && rival.r < 1, 'and small');
});

test('a round lasts two minutes; standings by score; Scrape it all scores the share of the city', () => {
  const S = createRound({ mode: 'battle', seed: 4 });
  for (let t = 0; t < TUNE.round + 1 && !S.over; t += 1 / 30) update(S, 1 / 30, still);
  assert.equal(S.over, true);
  assert.equal(ranking(S).length, 4);
  assert.ok(rankOf(S, S.me) >= 1 && rankOf(S, S.me) <= 4);
  const solo = createRound({ mode: 'solo', seed: 4 });
  assert.equal(solo.holes.length, 1);
  solo.scraped = solo.city.total * 0.81; assert.equal(stars(solo), 3);
  solo.scraped = solo.city.total * 0.5; assert.equal(stars(solo), 1);
  assert.equal(share(solo), 50);
});

test('the rivals’ minds play whole rounds; a sharper mind usually wins; the same seed, the same round', async () => {
  let wins = 0;
  for (let s = 1; s <= 6; s++) if ((await playRound({ seed: s * 17, profile: 'expert', rivals: 'newbie' })).rank === 1) wins++;
  assert.ok(wins >= 4, `expert beat newbie rivals ${wins}/6`);
  assert.deepEqual(await playRound({ seed: 9 }), await playRound({ seed: 9 }));
  const solo = await playRound({ mode: 'solo', seed: 5, profile: 'steady' });
  assert.ok(solo.share > 30, `scraped ${solo.share}%`);
  void createBrain; void think;
});

test('her lines', () => {
  checkLines(LINES);
  assert.match(shareText({ mode: 'battle', rank: 1, score: 5000 }), /#1 in WEB SCRAPER with 5,000 data on agi1\.app/);
  assert.ok(TYPE_IDS.length >= 20);
});
