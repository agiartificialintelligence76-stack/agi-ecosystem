import { KEEP } from '../engine.js';

// The engine returns defensive copies. Keep one chart-owned array and request only its open
// candle and newer rows. A replacement array signals older-history changes to chart-stream.
export function createCandleReader(market, { maxEntries = 8, limit = Infinity } = {}) {
  const entries = new Map();
  const cap = Math.max(1, Math.floor(maxEntries) || 8);
  const count = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : Infinity;
  const trim = (rows) => count < rows.length ? rows.slice(-count) : rows;
  return {
    read(id, revision) {
      const now = Number.isFinite(market.t) ? market.t : 0;
      let entry = entries.get(id);
      const last = entry?.rows.at(-1)?.t;
      // Dormant simulated coins are compacted to minute candles after an hour. Their
      // public API has no revision counter, so check only at the engine's minute boundary.
      const compactCheck = last != null && now - last > 3700 && Math.floor(now / 60) !== Math.floor(entry.time / 60);
      const reload = !entry || entry.revision !== revision || now < entry.time || compactCheck;
      if (reload) {
        const rows = trim(market.candles(id) || []);
        // An unchanged dormant snapshot should not reset a user's chart pan/zoom.
        const same = compactCheck && entry.revision === revision && now >= entry.time
          && rows.length === entry.rows.length && rows.every((r, i) => {
            const old = entry.rows[i];
            return ['t', 'o', 'h', 'l', 'c', 'v', 'b', 's'].every((key) => r[key] === old[key]);
          });
        entry = { rows: same ? entry.rows : rows, revision, time: now };
      } else {
        const more = market.candles(id, last) || [];
        if (last != null && (!more.length || more[0].t !== last)) {
          // Retention or compaction removed the previously open candle while this view
          // was inactive. Re-read the source instead of retaining a disconnected prefix.
          entry.rows = trim(market.candles(id) || []);
        } else {
          if (last != null && more.length) entry.rows.pop();
          for (const row of more) entry.rows.push(row);
          if (count < entry.rows.length) entry.rows.splice(0, entry.rows.length - count);
          else if (more.length > 1 && entry.rows.length > KEEP.candles + 64) {
            entry.rows.splice(0, entry.rows.length - KEEP.candles);
          }
        }
        entry.time = now;
      }
      entries.delete(id); entries.set(id, entry);
      while (entries.size > cap) entries.delete(entries.keys().next().value);
      return entry.rows;
    },
    delete(id) { entries.delete(id); },
    clear() { entries.clear(); },
  };
}
