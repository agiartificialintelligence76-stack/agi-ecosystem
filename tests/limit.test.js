// Out of messages (2026-09-25, the owner's request): what AGI-1 says when a Stranger or a Crush has used today's messages
// (src/chat/limit-lines.js). The owner's one exception to "no buy advice": she may suggest $AGI for more messages, but
// always with "not financial advice", the free option (tomorrow), no pressure or guilt, and never prices or gains.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIMIT_LINES, LIMIT_FINE_PRINT, REST_LINES, limitLine } from '../src/chat/limit-lines.js';
import { LEVELS, levelInfo, fmtTokens } from '../src/lib/levels.js';
import { levelPrompt } from '../server/agi1-prompt.js';
import { LINES, LINE_MOODS } from '../server/voice.js';
import { speakable } from '../src/chat/voice.js';

const GAINS = /\b(moon|pump|profit|profits|gains?|price|prices|100x|1000x|lambo|rich|invest|investing|investment|returns?|going up|to the moon|hodl|hold|holding|sell|dump|guaranteed|early)\b/i;
const PRESSURE = /\b(miss you|lonely|don't leave|dont leave|need you|sad|abandon|only you|last chance|hurry|now or never|before it's too late|you owe|disappoint)\b/i;
const EXPLICIT = /\b(sex|sexy|nude|naked|horny|kiss me|bed)\b/i;

test('only Strangers and Crushes get the line; Soulmates (top level) and unknown levels get the short note', () => {
  assert.deepEqual(Object.keys(LIMIT_LINES), ['1', '2']);
  assert.equal(limitLine(1), LIMIT_LINES[1]);
  assert.equal(limitLine(2), LIMIT_LINES[2]);
  for (const level of [3, 0, 4, undefined, null, '1']) assert.equal(limitLine(level), null, String(level));
  assert.deepEqual([LIMIT_LINES[1].key, LIMIT_LINES[2].key], ['more-1', 'more-2']);
});

test('each line names the next level with the real numbers, says "not financial advice" and offers tomorrow', () => {
  for (const level of [1, 2]) {
    const { text } = LIMIT_LINES[level];
    const next = levelInfo(level + 1);
    assert.ok(text.includes('$AGI'), `${level}: about $AGI`);
    assert.ok(text.includes(fmtTokens(next.min)), `${level}: ${fmtTokens(next.min)} $AGI`);
    assert.ok(text.includes(`${next.daily}`), `${level}: ${next.daily} messages a day`);
    assert.ok(text.toLowerCase().includes(next.name.toLowerCase()), `${level}: the ${next.name} level`);
    assert.match(text, /not financial advice/);
    assert.match(text, /tomorrow/, 'the free option is right there');
    assert.ok(text.length <= 280, `${level}: short (${text.length})`);
    assert.doesNotMatch(text, GAINS, `${level}: never prices, gains or trading talk`);
    assert.doesNotMatch(text, PRESSURE, `${level}: never pressure or guilt`);
    assert.doesNotMatch(text, EXPLICIT, `${level}: PG-13`);
    assert.doesNotMatch(text, /https?:|www\.|0x[0-9a-f]{6}/i, `${level}: no links or addresses in her words`);
    assert.equal(text, text.toLowerCase().replace(/agi/g, 'AGI').replace(/crush/g, 'Crush').replace(/soulmate/g, 'Soulmate'), 'her usual lowercase texting');
  }
  assert.doesNotMatch(LIMIT_LINES[1].text, /\b(love|babe|cutie|baby|honey)\b/, 'Strangers: no pet names yet');
  assert.equal(LEVELS.length, 3, 'three levels (a fourth would need its own line)');
});

test('the safety note under it', () => {
  assert.match(LIMIT_FINE_PRINT, /^Not financial advice\./);
  assert.match(LIMIT_FINE_PRINT, /meme token/);
  assert.match(LIMIT_FINE_PRINT, /can go to zero/);
  assert.match(LIMIT_FINE_PRINT, /Only spend what you can afford to lose/);
  assert.match(LIMIT_FINE_PRINT, /free messages come back every day at 00:00 UTC/);
});

test('her voice says exactly the chat line (no emojis, "AGI" without the "$"), sweet for the offer, sleepy for "tomorrow"', () => {
  for (const { key, text } of [...Object.values(LIMIT_LINES), ...Object.values(REST_LINES)]) {
    assert.equal(LINES[key], speakable(text));
    assert.doesNotMatch(LINES[key], /\$|💜|🥱/u);
  }
  assert.equal(LINES.hello, "hi, it's me");
  assert.deepEqual([LINE_MOODS['more-1'], LINE_MOODS['more-2'], LINE_MOODS.sleep, LINE_MOODS['talked-out']], ['sweet', 'sweet', 'sleepy', 'sleepy']);
});

test('her short "come back tomorrow" lines (spoken too, 2026-09-25): no offer, no pressure, just tomorrow', () => {
  assert.deepEqual(Object.values(REST_LINES).map((l) => l.key), ['sleep', 'talked-out']);
  for (const { text } of Object.values(REST_LINES)) {
    assert.match(text, /tomorrow/);
    assert.ok(text.length <= 120, text);
    assert.doesNotMatch(text, /\$AGI|buy|wallet/i, 'the offer is made once a day, in the line above');
    assert.doesNotMatch(text, GAINS);
    assert.doesNotMatch(text, EXPLICIT);
  }
});

test('her AI replies still never suggest buying (the exception is only this pre-written line)', () => {
  for (const level of [1, 2, 3]) assert.match(levelPrompt(level), /never suggest buying or holding anything/);
});
