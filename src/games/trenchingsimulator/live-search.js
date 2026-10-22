// A contract search can ask the live relay for a coin outside its recent list. Debounced screens may redraw often;
// each address gets one request, and the result message explains a real miss separately from an unavailable feed.
const CONTRACT = /^(?:0x[0-9a-fA-F]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})$/;
export function createAddressSearch(market, changed) {
  const results = new Map();
  return (query, found = false) => {
    if (found || typeof market.lookup !== 'function' || !CONTRACT.test(query)) return null;
    const key = query.startsWith('0x') ? query.toLowerCase() : query;
    if (!results.has(key) || results.get(key).until < Date.now()) {
      results.set(key, { note: 'Looking up this coin…', until: Infinity });
      while (results.size > 30) results.delete(results.keys().next().value);
      market.lookup(query).then((id) => {
        results.set(key, { note: id === null ? 'No supported market found for this address on this chain.' : null, until: Date.now() + 30_000 });
        changed();
      }).catch((err) => {
        results.set(key, { note: err && err.message === 'busy' ? 'Search is busy. Try again in a moment.' : 'Live search is unavailable. Try again shortly.',
          until: Date.now() + 5000 });
        changed();
      });
    }
    return results.get(key).note;
  };
}
