// I'M NOT A ROBOT: which check comes next. A fair shuffle bag (every check once before any comes again), never the same
// one twice in a row (not even across two bags), the same order for the same seed. Pure: no DOM.
export function createBag(ids, r, first = null) {
  let pool = [];
  let last = null;
  const queue = first ? first.filter((id) => ids.includes(id)) : [];
  const refill = () => {
    pool = r.shuffle(ids.slice());
    // the new bag never starts with the one just played
    if (pool.length > 1 && pool[0] === last) {
      const j = 1 + Math.floor(r.next() * (pool.length - 1));
      [pool[0], pool[j]] = [pool[j], pool[0]];
    }
  };
  return {
    // the next id; `ok(id)` filters (a boss only takes some checks); `avoid` ids are skipped when there's another choice
    next(ok = null, avoid = null) {
      if (queue.length) {
        const id = queue.shift();
        if (id !== last && (!ok || ok(id))) { pool = pool.filter((x) => x !== id); last = id; return id; }
      }
      for (let tries = 0; tries < 3; tries++) {
        if (!pool.length) refill();
        const i = pool.findIndex((id) => id !== last && (!ok || ok(id)) && !(avoid && avoid.includes(id)));
        if (i >= 0) { const [id] = pool.splice(i, 1); last = id; return id; }
        // nothing left in this bag that fits: a fresh bag
        pool = [];
      }
      // (only with a filter that almost nothing passes)
      const any = ids.find((id) => id !== last && (!ok || ok(id))) ?? ids[0];
      last = any;
      return any;
    },
    get last() { return last; },
  };
}
