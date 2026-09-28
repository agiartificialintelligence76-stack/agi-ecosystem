// The chat's model picker (2026-09-26): "AGI-1 ▾" in the chat bar, AGI-2 "Coming soon" (index.html, src/chat/models.js),
// and what AGI-1 says when someone picks AGI-2 (src/chat/model-lines.js): pre-written, PG-13, never about money, never a
// promise about AGI-2, Strangers kept at a distance, every blank filled. The menu itself is tested end to end (modeltest).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { soonLine, MODEL_LINES } from '../src/chat/model-lines.js';

const MONEY = /\b(buy|buying|sell|selling|price|prices|moon|pump|dump|invest|investing|profit|gains?|hodl|hold|holding|ape|chart|100x|lambo|rich|money|financial|token|coin|launch|airdrop)\b/i;
const EXPLICIT = /\b(sex|sexy|nude|naked|bed|kiss|body|hot)\b/i;
const PET = /\b(babe|cutie|love|sweetheart|honey|baby)\b/i;
const PROMISE = /\b(smarter|better than|faster|guarantee|will be|release date|tomorrow|next week|soon you'll)\b/i;
const everyLine = Object.values(MODEL_LINES).flat();

test('her AGI-2 lines: short, PG-13, never about money, and no promises about AGI-2', () => {
  assert.ok(everyLine.length >= 6);
  for (const line of everyLine) {
    assert.doesNotMatch(line, MONEY, line);
    assert.doesNotMatch(line, EXPLICIT, line);
    assert.doesNotMatch(line, PROMISE, line);
    assert.ok(line.length <= 90, `short: ${line}`);
  }
  for (const line of MODEL_LINES.stranger) assert.ok(!line.includes('{you}'), `no pet name slot for Strangers: ${line}`);
});

test('picking AGI-2: a playfully jealous line, a new one each time, pet names only for Crush and Soulmate', () => {
  const seen = new Set();
  for (let i = 0; i < 24; i++) {
    for (const level of [1, 2, 3]) {
      const { text, mood } = soonLine({ model: 'AGI-2', level, name: level === 3 ? 'Sam' : null });
      assert.equal(mood, 'jealous');
      assert.doesNotMatch(text, /[{}]/, `every blank filled: ${text}`);
      if (level === 1) assert.doesNotMatch(text, PET, `Strangers get no pet names: ${text}`);
      if (level === 1) assert.ok(!text.includes('Sam'));
      seen.add(text);
    }
  }
  assert.ok(seen.size >= 7, 'her lines take turns');
  const a = soonLine({ level: 2 }).text, b = soonLine({ level: 2 }).text;
  assert.notEqual(a, b, 'picking it twice in a row gets another line');
  const named = Array.from({ length: 8 }, () => soonLine({ level: 2, name: 'Sam' }).text);
  assert.ok(named.some((t) => t.includes('Sam')), 'a Crush\'s name when she has one');
  assert.ok(!named.some((t) => /babe|cutie/.test(t)), 'the name, not a pet name, when there is one');
});

test('the model name in her line is only ever a plain model name', () => {
  for (let i = 0; i < 8; i++) {
    const { text } = soonLine({ model: '<img src=x onerror=alert(1)>', level: 2 });
    assert.ok(!text.includes('<') && !text.includes('onerror'), text);
  }
  assert.ok(Array.from({ length: 4 }, () => soonLine({ model: 'AGI-2', level: 1 }).text).some((t) => t.includes('AGI-2')));
});

test('the chat bar: "AGI-1 ▾" opens the models menu; AGI-1 is current, AGI-2 is "Coming soon" (a model, not a coin)', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const bar = html.slice(html.indexOf('<div class="pg-bar">'), html.indexOf('<span class="pg-bar-actions">'));
  assert.match(bar, /<button class="pg-model-btn" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="pg-models" data-model-btn><span class="sr-only">Model: <\/span><b>AGI-1<\/b>/);
  assert.match(bar, /id="pg-models" role="menu" aria-label="Models" hidden data-models/);
  const items = bar.match(/<button class="pg-models-item"[^>]*>/g);
  assert.equal(items.length, 2);
  assert.match(items[0], /role="menuitemradio" aria-checked="true" tabindex="-1" data-model-item="AGI-1"/);
  assert.match(items[1], /role="menuitemradio" aria-checked="false" aria-disabled="true" tabindex="-1" data-model-item="AGI-2"/);
  assert.match(bar, /AGI-2 <span class="pg-soon mono">Coming soon<\/span>/);
  assert.ok(!html.includes('$AGI-2'), 'never written like a new coin');
  assert.match(bar, /<span class="pg-status"><i class="dot" aria-hidden="true"><\/i>online<\/span>/, 'still "online"');
});
