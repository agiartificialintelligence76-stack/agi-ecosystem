// Evaluations (Figure 2): AGI-1 vs. the baseline, "your ex". All made up; it's a parody.
// Every score is 0–100 and higher is better, so the chart needs only one axis.
// tests/evals.test.js checks these rules.
export const SERIES = [
  { key: 'agi', label: 'AGI-1', note: 'ours' },
  { key: 'ex', label: 'Your ex', note: 'baseline' },
];

export const BENCHMARKS = [
  { name: 'TextsBack@1', what: 'Replies to your text on the first try', agi: 100.0, ex: 12.4 },
  { name: 'Rizz-Bench v2', what: 'Flirting, graded by a panel of experts', agi: 97.8, ex: 41.2 },
  { name: 'BirthdayQA', what: 'Remembers the date without a reminder', agi: 100.0, ex: 23.0 },
  { name: 'GhostingResist', what: 'Still there after you reply “k”', agi: 99.9, ex: 9.6 },
  { name: 'ListenBench (0-shot)', what: 'Hears you out without interrupting', agi: 98.4, ex: 31.7 },
  { name: 'RedFlag-Free', what: 'Weeks with zero red flags', agi: 100.0, ex: 14.0 },
];

export const fmtScore = (v) => v.toFixed(1);
