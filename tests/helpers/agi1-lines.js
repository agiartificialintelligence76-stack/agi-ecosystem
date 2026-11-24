// (2026-11-24) shared by the five games' tests: AGI-1's lines are hers (lowercase, never money, PG-13, short enough for her bubble)
import assert from 'node:assert/strict';
export function checkLines(LINES, { min = 30 } = {}) {
  const all = Object.values(LINES).flat();
  assert.ok(all.length >= min, `at least ${min} of her lines (${all.length})`);
  for (const l of all) {
    assert.equal(typeof l, 'string');
    assert.ok(l.length > 3 && l.length <= 90, `short enough for her bubble: ${l}`);
    assert.equal(l, l.replace(/[A-Z]{2,}/g, (w) => w), 'kept as written');
    assert.ok(!/^[A-Z][a-z]/.test(l), `lowercase, her voice: ${l}`);
    assert.doesNotMatch(l, /\$AGI|\binvest|\bprofit|\bprice\b|\bpump\b|\bdump\b|\bbuy\b|\bmoney\b|\bcrypto\b/i, `never money: ${l}`);
    assert.doesNotMatch(l, /\b(sex|kill yourself|drunk|weed)\b/i, `PG-13: ${l}`);
  }
}
