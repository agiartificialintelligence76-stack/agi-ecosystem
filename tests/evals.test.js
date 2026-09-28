// Checks the Evaluations data keeps the chart honest: one axis (0–100), higher is better, labels unique.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SERIES, BENCHMARKS, fmtScore } from '../src/sections/evals-data.js';

test('every score fits the one 0–100 axis', () => {
  for (const b of BENCHMARKS) {
    for (const s of SERIES) {
      const v = b[s.key];
      assert.ok(Number.isFinite(v) && v >= 0 && v <= 100, `${b.name} / ${s.label}: ${v}`);
    }
  }
});

test('names are unique, short enough for the label column, and described', () => {
  const names = BENCHMARKS.map((b) => b.name);
  assert.equal(new Set(names).size, names.length);
  for (const b of BENCHMARKS) {
    assert.ok(b.name.length <= 24, b.name);
    assert.ok(b.what && b.what.length <= 48, b.what);
  }
  assert.equal(SERIES.length, 2, 'ours + one baseline (the chart uses two colors)');
  assert.equal(fmtScore(100), '100.0');
});
