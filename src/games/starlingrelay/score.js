import { atomicInk, deck, playCue, lighting } from './productions.js';

export const VERSION = 1;
export const MAX_BEATS = 96;
const cap = 128;
export function ink(program) {
  const count = (strip) =>
    strip.reduce((n, c) => n + (c === '(' ? 0 : c === '2' || c === '3' ? 2 : atomicInk(c)), 0);
  return count(program.main) + count(program.dance) + (program.dance.length ? 2 : 0);
}
// Closures cost only the encore opcode and its explicit count. The opening
// bracket is free notation. A dance declaration costs two (name and definition).
export function compile(scene, program) {
  const palette = new Set(deck(scene));
  const result = { beats: [], error: '', where: null };
  if (!program || !Array.isArray(program.main) || !Array.isArray(program.dance))
    return { ...result, error: 'Missing score' };
  if (program.main.length + program.dance.length > cap) return { ...result, error: 'The cue rack is full' };
  function sequence(strip, track, routine) {
    const stack = [[]];
    for (let i = 0; i < strip.length; i++) {
      const code = strip[i],
        here = { track, index: i },
        out = stack.at(-1);
      function fail(message) {
        result.error = message;
        result.where = here;
        return null;
      }
      if (!palette.has(code)) return fail('That card belongs to a different act');
      if (code === '(') {
        if (stack.length >= 7) return fail('Six nested encores fill the rack');
        stack.push([]);
      } else if (code === '2' || code === '3') {
        if (stack.length === 1) return fail('Open a phrase before closing its encore');
        const inside = stack.pop();
        if (!inside.length) return fail('An encore needs a card inside');
        const expanded = stack.at(-1);
        if (expanded.length + inside.length * Number(code) > MAX_BEATS)
          return fail('This show is longer than 96 beats');
        for (let n = 0; n < Number(code); n++) expanded.push(...inside.map((v) => ({ ...v, encore: i })));
      } else if (code === '@') {
        if (track === 'dance') return fail('Dance A cannot call itself');
        if (!routine?.length) return fail('Write Dance A before calling it');
        out.push(...routine.map((v) => ({ ...v, call: i })));
      } else out.push({ code, ...here });
      if (stack.at(-1).length > MAX_BEATS) return fail('This show is longer than 96 beats');
    }
    if (stack.length !== 1) {
      result.error = 'Close the open phrase with ×2 or ×3';
      return null;
    }
    return stack[0];
  }
  const routine = sequence(program.dance, 'dance', null);
  if (!result.error) result.beats = sequence(program.main, 'main', routine) || [];
  return result;
}
export function check(scene, program) {
  const run = compile(scene, program);
  if (run.error) return { ...run, ok: false, beat: 0, plot: 0 };
  for (let plot = 0; plot < scene.plots; plot++) {
    for (let beat = 0; beat < Math.max(run.beats.length, scene.beats.length); beat++) {
      const want = scene.beats[beat],
        card = run.beats[beat],
        sun = lighting(scene, beat, plot);
      if (!want || !card || playCue(want, sun) !== playCue(card.code, sun)) {
        return {
          ...run,
          ok: false,
          beat,
          plot,
          expected: want ? playCue(want, sun) : null,
          actual: card ? playCue(card.code, sun) : null,
        };
      }
    }
  }
  return { ...run, ok: true, beat: run.beats.length, plot: scene.plots - 1 };
}
export const stars = (count, par) => (count <= par ? 3 : count <= par + 2 ? 2 : 1);

// Weighted grammar chart. Every legal phrase is one atom, one call, a
// concatenation, or a two/three-fold repeat. Inspect each possible last rule on
// each interval. A useful named dance appears as a contiguous interval of the
// final performance. Enumerating those expansions covers every possible body.
// Each nonconstant light cue is observed in both lamp states on its beat.
function phraseTable(beats, encores, definition) {
  const n = beats.length;
  const table = Array.from({ length: n }, () => Array(n + 1));
  const equal = (a, b, len) => {
    for (let k = 0; k < len; k++) if (beats[a + k] !== beats[b + k]) return false;
    return true;
  };
  for (let len = 1; len <= n; len++)
    for (let start = 0; start + len <= n; start++) {
      const end = start + len;
      let best = { cost: Infinity, cards: [] };
      const offer = (cost, cards) => {
        if (cost < best.cost) best = { cost, cards };
      };
      if (len === 1) offer(atomicInk(beats[start]), [beats[start]]);
      if (definition?.length === len && definition.every((c, k) => c === beats[start + k])) offer(1, ['@']);
      for (let split = start + 1; split < end; split++) {
        const left = table[start][split],
          right = table[split][end],
          cost = left.cost + right.cost;
        if (cost < best.cost) offer(cost, [...left.cards, ...right.cards]);
      }
      if (encores)
        for (const count of [2, 3]) {
          const unit = len / count;
          if (!Number.isInteger(unit) || !equal(start, start + unit, len - unit)) continue;
          const middle = table[start][start + unit];
          offer(middle.cost + 2, ['(', ...middle.cards, String(count)]);
        }
      table[start][end] = best;
    }
  return table;
}
const cache = new WeakMap();
export function prove(scene) {
  if (cache.has(scene)) return cache.get(scene);
  const beats = scene.beats,
    base = phraseTable(beats, scene.act >= 1, null);
  let winner = { par: base[0][beats.length].cost, main: base[0][beats.length].cards, dance: [] };
  let definitions = 0;
  if (scene.act >= 2) {
    const seen = new Set();
    for (let i = 0; i < beats.length; i++)
      for (let j = i + 1; j <= beats.length; j++) {
        const body = beats.slice(i, j),
          key = body.join('|');
        if (seen.has(key) || base[i][j].cost + 3 >= winner.par) continue;
        seen.add(key);
        if (!beats.slice(j).some((_, k) => body.every((c, d) => beats[j + k + d] === c))) continue;
        definitions++;
        const main = phraseTable(beats, true, body)[0][beats.length];
        const cost = main.cost + 2 + base[i][j].cost;
        if (cost < winner.par) winner = { par: cost, main: main.cards, dance: base[i][j].cards };
      }
  }
  const result = { ...winner, definitions };
  if (!check(scene, result).ok || ink(result) !== result.par) throw new Error('Invalid proof for ' + scene.name);
  cache.set(scene, result);
  return result;
}
