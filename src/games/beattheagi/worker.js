// BEAT THE AGI (2026-11-08): AGI-1's thinking, off the main thread (a same-origin module worker: the site's CSP allows
// `worker-src 'self'`), so the board keeps moving while she looks a dozen moves deep. It keeps its transposition table
// between her moves of one game ('clear' starts a new one) and streams each finished depth back as it goes.
//   → { type: 'think', id, cells, color, level, seed, budget }   ← { type: 'depth', id, … } … { type: 'done', id, … }
import { createSearcher } from './engine.js';
import { decide } from './levels.js';

const searcher = createSearcher({ bits: 20 });
// a short search on a made-up board as the worker starts, so her first real one runs at full speed (a cold JIT is
// many times slower), then a clean table
{
  const warm = new Array(42).fill(0);
  [3, 3, 2, 4, 2, 4].forEach((c, i) => { let r = 0; while (warm[r * 7 + c]) r++; warm[r * 7 + c] = i % 2 ? 2 : 1; });
  searcher.think(warm, 1, { budget: 70, now: () => performance.now() });
  searcher.clear();
}

self.onmessage = (e) => {
  const m = e.data || {};
  if (m.type === 'clear') { searcher.clear(); return; }
  if (m.type !== 'think') return;
  const t0 = performance.now();
  const res = decide(searcher, m.cells, m.color, m.level, {
    seed: m.seed, budget: m.budget, now: () => performance.now(),
    onDepth: (s) => self.postMessage({ type: 'depth', id: m.id, depth: s.depth, scores: s.scores, best: s.best, score: s.score, nodes: s.nodes }),
  });
  self.postMessage({ type: 'done', id: m.id, ...res, ms: performance.now() - t0 });
};
self.postMessage({ type: 'ready' });
