// AGI-1's talking level (src/lib/talk.js, 2026-09-25): what moves her 3D mouth. Checks the made-up rhythm (for the
// browser's own voice, and for "saying" replies silently when her voice is off) and the sound meter hook.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rhythm, talkLevel, pretendTalk, stopTalk, setMeter } from '../src/lib/talk.js';

test('the rhythm: about 5 syllables a second, never louder than 1, with pauses between words', () => {
  let peaks = 0, quiet = 0, max = 0;
  for (let ms = 0; ms < 10_000; ms += 5) {
    const v = rhythm(ms / 1000);
    assert.ok(v >= 0 && v <= 1, `0..1 at ${ms} ms`);
    max = Math.max(max, v);
  }
  for (let i = 0; i < 52; i++) {                      // the middle of each syllable slot in 10 s
    if (rhythm((i + 0.5) / 5.2) > 0.2) peaks += 1; else quiet += 1;
  }
  assert.ok(max > 0.8, 'some syllables open her mouth wide');
  assert.ok(peaks > 30 && peaks < 52, `syllables in 10 s: ${peaks}`);
  assert.ok(quiet >= 3, `pauses in 10 s: ${quiet}`);
  assert.equal(rhythm(-1), 0);
  assert.equal(rhythm(NaN), 0);
  assert.equal(rhythm(0), 0, 'each syllable starts closed');
});

test('pretending: starts and ends softly, lasts as long as asked, and can be stopped', () => {
  setMeter(null);
  pretendTalk(2, 1, 1000);
  assert.equal(talkLevel(999), 0, 'not before it starts');
  let loud = 0;
  for (let t = 1000; t < 3000; t += 7) loud = Math.max(loud, talkLevel(t));
  assert.ok(loud > 0.8, `she talks (${loud})`);
  assert.ok(talkLevel(1010) <= 0.125 + 1e-9, 'fades in over the first 80 ms');
  assert.equal(talkLevel(3000), 0, 'over after 2 s');
  pretendTalk(2, 0.5, 5000);
  let half = 0;
  for (let t = 5000; t < 7000; t += 7) half = Math.max(half, talkLevel(t));
  assert.ok(half > 0.3 && half <= 0.5, `strength 0.5 → at most half open (${half})`);
  pretendTalk(2, 1, 8000);
  stopTalk();
  for (let t = 8000; t < 10_000; t += 50) assert.equal(talkLevel(t), 0, 'stopped');
  pretendTalk(0, 1, 11_000);
  pretendTalk(-3, 1, 11_000);
  pretendTalk('x', 1, 11_000);
  assert.equal(talkLevel(11_500), 0, 'nonsense durations are ignored');
});

test('the sound meter: its reading is used, kept within 0..1, and a broken meter reads as quiet', () => {
  stopTalk();
  setMeter(() => 0.7);
  assert.equal(talkLevel(), 0.7);
  setMeter(() => 3);
  assert.equal(talkLevel(), 1);
  setMeter(() => -2);
  assert.equal(talkLevel(), 0);
  setMeter(() => { throw new Error('closed'); });
  assert.equal(talkLevel(), 0);
  setMeter(() => 0.2);
  pretendTalk(5, 1, 20_000);
  let both = 0;
  for (let t = 20_000; t < 21_000; t += 7) both = Math.max(both, talkLevel(t));
  assert.ok(both > 0.8, 'whichever is louder wins');
  setMeter('not a function');
  stopTalk();
  assert.equal(talkLevel(), 0);
});
