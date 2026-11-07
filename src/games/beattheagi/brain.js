// BEAT THE AGI (2026-11-08): where AGI-1's thinking happens, from the game's side.
//   - the three small models (1B, 7B, 13B) think in an instant: here, on the main thread
//   - 70B, 400B and AGI think in a Web Worker (./worker.js), streaming each depth as it finishes
//   - with no worker (an old browser, a blocked script), the same search runs here in small chunks (one depth at a
//     time, each inside a slice of time), so the page never freezes for long
//   - `sync: true` (the ?demo and the title's quiet game): computed at once, here, deterministic for a seed
// think({ cells, color, level, seed, budget, onDepth, onDone, sync }) → id;  cancel(id);  newGame()
import { createSearcher } from './engine.js';
import { decide, TOP } from './levels.js';

export function createBrain() {
  let local = null;
  const searcher = () => (local ||= createSearcher({ bits: 18 }));
  let worker = null, broken = false, seq = 0;
  const jobs = new Map();

  function startWorker() {
    if (worker || broken || typeof Worker !== 'function') { broken = broken || typeof Worker !== 'function'; return; }
    try {
      worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    } catch { broken = true; worker = null; return; }
    worker.onmessage = (e) => {
      const m = e.data || {};
      const job = jobs.get(m.id);
      if (!job) return;
      job.heard = true;
      if (m.type === 'depth') job.onDepth?.(m);
      else if (m.type === 'done') { jobs.delete(m.id); clearTimeout(job.watch); job.onDone?.(m); }
    };
    const fail = (e) => {
      e?.preventDefault?.();
      broken = true;
      try { worker?.terminate(); } catch { /* gone */ }
      worker = null;
      // whatever was waiting on it thinks here instead
      for (const job of [...jobs.values()]) { clearTimeout(job.watch); runLocal(job); }
    };
    worker.onerror = fail;
    worker.onmessageerror = fail;
  }

  // the chunked fallback: one depth per slice of time, then a breath for the page
  function runLocal(job) {
    const s = searcher();
    if (job.fresh) s.clear();
    const t0 = performance.now();
    let d = 1, last = null;
    const max = job.level === TOP ? 42 : [1, 1, 4, 7, 10][job.level] ?? 1;
    const step = () => {
      if (!jobs.has(job.id)) return;
      const left = (job.budget || 700) - (performance.now() - t0);
      let shown = null;
      const res = decide(s, job.cells, job.color, job.level, {
        seed: job.seed, maxDepth: d, now: () => performance.now(),
        budget: job.level === TOP ? Math.max(25, Math.min(110, left)) : 0,
        onDepth: (x) => { shown = x; },
      });
      if (shown && (!last || shown.depth > last.depth)) job.onDepth?.({ ...shown, id: job.id });
      const finished = res.depth < d || res.book || job.level <= 1 || res.exact || d >= max || (job.level === TOP && left <= 0);
      last = res;
      if (finished) { jobs.delete(job.id); job.onDone?.({ ...res, id: job.id, ms: performance.now() - t0 }); return; }
      d++;
      setTimeout(step, 0);
    };
    setTimeout(step, 0);
  }

  return {
    get usingWorker() { return Boolean(worker) && !broken; },
    warm() { startWorker(); },
    newGame() {
      jobs.clear();
      local?.clear();
      if (worker) worker.postMessage({ type: 'clear' });
    },
    think({ cells, color, level, seed, budget = 700, onDepth, onDone, sync = false }) {
      const id = ++seq;
      const job = { id, cells: cells.slice(), color, level, seed, budget, onDepth, onDone };
      if (sync || level <= 2) {
        // here and now (the caller reveals the depths over time)
        const res = decide(searcher(), job.cells, color, level, { seed, budget, now: () => performance.now(), onDepth: (x) => onDepth?.({ ...x, id }) });
        onDone?.({ ...res, id });
        return id;
      }
      jobs.set(id, job);
      startWorker();
      if (worker && !broken) {
        worker.postMessage({ type: 'think', id, cells: job.cells, color, level, seed, budget });
        // a worker that never answers (it failed to load without saying so): think here after a while
        job.watch = setTimeout(() => { if (jobs.has(id) && !job.heard) { broken = true; runLocal(job); } }, budget + 4000);
      } else runLocal(job);
      return id;
    },
    cancel(id) { jobs.delete(id); },
  };
}
