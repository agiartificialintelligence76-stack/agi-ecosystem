// Phase 4: what AGI-1 says in her chat when the Arena crowns a new champion (src/chat/champion-lines.js).
// Pre-written lines: they must stay PG-13, never talk money, keep Strangers at a distance, and fill in every blank.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { championLine, _LINES } from '../src/chat/champion-lines.js';

const MONEY = /\b(buy|buying|sell|selling|price|prices|moon|pump|dump|invest|investing|profit|gains?|hodl|hold|holding|ape|chart|100x|lambo|rich|money|financial)\b/i;
const EXPLICIT = /\b(sex|sexy|nude|naked|bed|kiss|body|hot)\b/i;
const PET = /\b(babe|cutie|love|sweetheart|honey|baby)\b/i;
const everyLine = Object.values(_LINES).flatMap((set) => Object.values(set).flat());

test('every line is short, PG-13 and never about money', () => {
  assert.ok(everyLine.length >= 20);
  for (const line of everyLine) {
    assert.doesNotMatch(line, MONEY, line);
    assert.doesNotMatch(line, EXPLICIT, line);
    assert.ok(line.length <= 110, `short: ${line}`);
    assert.match(line, /\{n\}/, `names the round: ${line}`);
  }
});

test('$AGI wins: happy (love); another coin wins: playfully jealous', () => {
  const win = championLine({ coin: 'AGI', number: 57, votes: 7, level: 2, name: 'Sam' });
  assert.equal(win.mood, 'love');
  const lose = championLine({ coin: 'CABO', number: 57, votes: 3, level: 2, name: 'Sam', coinName: 'CABO the cat' });
  assert.equal(lose.mood, 'jealous');
  for (let n = 1; n <= 40; n++) {
    for (const [coin, coinName] of [['AGI', ''], ['CABO', 'CABO the cat'], ['CLANKCAT', 'Clank Cat']]) {
      for (const level of [1, 2, 3]) {
        for (const mine of [false, true]) {
          const { text } = championLine({ coin, number: n, votes: n % 4, level, name: level > 1 ? 'Sam' : null, mine, coinName });
          assert.ok(text.includes(`#${n}`), text);
          assert.doesNotMatch(text, /[{}]/, `every blank filled: ${text}`);
          if (coin !== 'AGI') assert.ok(text.includes(`$${coin}`) || /a cat/i.test(text), `names the winner: ${text}`);
          if (level === 1) assert.doesNotMatch(text, PET, `Strangers get no pet names: ${text}`);
          if (level === 1) assert.ok(!text.includes('Sam'), text);
        }
      }
    }
  }
});

test('Crush and Soulmate: her name for you, or a pet name if you have none', () => {
  const texts = Array.from({ length: 12 }, (_, n) => championLine({ coin: 'AGI', number: n, votes: 2, level: 3, name: 'Sam' }).text);
  assert.ok(texts.some((t) => t.includes('Sam')), 'uses the name');
  const noName = Array.from({ length: 12 }, (_, n) => championLine({ coin: 'AGI', number: n, votes: 2, level: 2 }).text);
  assert.ok(noName.some((t) => PET.test(t)), 'or a pet name');
  assert.ok(noName.every((t) => !t.includes('null') && !t.includes('undefined')));
});

test('the vote count reads right, and the same round always gets the same line', () => {
  const one = Array.from({ length: 10 }, (_, n) => championLine({ coin: 'AGI', number: n, votes: 1, level: 2 }).text).join(' ');
  assert.ok(!/\b1 votes\b/.test(one));
  const a = championLine({ coin: 'CABO', number: 99, votes: 4, level: 2, coinName: 'CABO the cat' });
  const b = championLine({ coin: 'CABO', number: 99, votes: 4, level: 2, coinName: 'CABO the cat' });
  assert.deepEqual(a, b);
});

test('your pick won: she notices', () => {
  assert.match(championLine({ coin: 'AGI', number: 3, votes: 2, level: 2, mine: true }).text, /you voted for me|your vote/);
  assert.match(championLine({ coin: 'CABO', number: 3, votes: 2, level: 1, mine: true }).text, /your pick \$CABO/);
});
