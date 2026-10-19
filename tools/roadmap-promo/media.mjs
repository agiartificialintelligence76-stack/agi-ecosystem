// The roadmap's video (2026-10-14): AGI-1's voice over its music, made ready once. Her takes (her own voice, the site's
// Despina, made in Google AI Studio with the owner's account and downloaded into the owner's Downloads, `AGI Studio
// examples\roadmap-voice`: agi1-rm-01-title.wav…) are made ready by AGI Studio's launch video's voice.js (readyLine: 48 kHz,
// trimmed around her words, a long pause shortened, her loudness set), one mono WAV each, into tools/roadmap-promo/media/voice/
// (git ignores tools/roadmap-promo/media/), and index.json says where her words are in each. Not part of the website.
//
//   node tools/roadmap-promo/media.mjs --from <folder>[,<folder>…] [--out tools/roadmap-promo/media] [--force]
//
// Each take is looked for by its name in those folders (and the folders inside them). A take made again (another file, or
// a change to how they're made ready: LINE in voice.js) is made ready again; the others stay as they were (--force: all).
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readyLine, wav16, LINE } from '../studio-promo/voice.js';

const HERE = dirname(fileURLToPath(import.meta.url));

// her voice: [her line (words.js VOICE), the file names her take may have]. Three since 2026-10-19: her third take
// ("Staking, games and giveaways are next.", agi1-rm-03-next.wav) named an order, and the roadmap says "in no particular
// order", so it isn't used any more (its file stays in the owner's folder)
export const VOICES = [
  ['title', ['agi1-rm-01-title.wav']],
  ['live', ['agi1-rm-02-live.wav']],
  ['secret', ['agi1-rm-04-secret.wav']],
];
// how her takes are made ready: a change to it makes them again
export const VOICE_SIG = `v1-${createHash('sha256').update(JSON.stringify(LINE)).digest('hex').slice(0, 8)}`;

export function args(argv) {
  const a = { from: [], out: join(HERE, 'media'), force: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i], v = () => argv[++i];
    if (k === '--from') a.from.push(...v().split(',').filter(Boolean));
    else if (k === '--out') a.out = resolve(v());
    else if (k === '--force') a.force = true;
    else throw new Error(`unknown option ${k}`);
  }
  if (!a.from.length) throw new Error('say where her takes are: --from <folder>[,<folder>…]');
  return a;
}

// every file in those folders (and the ones inside them), by name: the first one found wins
function indexFiles(dirs) {
  const found = new Map();
  const walk = (d, depth) => {
    let names;
    try { names = readdirSync(d); } catch { return; }
    for (const n of names) {
      const p = join(d, n);
      let st;
      try { st = statSync(p); } catch { continue; }
      if (st.isDirectory()) { if (depth < 4 && !n.startsWith('.')) walk(p, depth + 1); } else if (!found.has(n)) found.set(n, p);
    }
  };
  for (const d of dirs) walk(resolve(d), 0);
  return found;
}

async function main() {
  const a = args(process.argv.slice(2));
  const files = indexFiles(a.from);
  mkdirSync(join(a.out, 'voice'), { recursive: true });
  const indexFile = join(a.out, 'index.json');
  const old = existsSync(indexFile) ? JSON.parse(readFileSync(indexFile, 'utf8')) : {};
  const index = { made: new Date().toISOString(), voice: {} };
  const missing = [];
  for (const [name, names] of VOICES) {
    const src = names.map((n) => files.get(n)).find(Boolean);
    if (!src) { missing.push(name); if (old.voice?.[name]) index.voice[name] = old.voice[name]; continue; }
    const sig = `${VOICE_SIG}:${statSync(src).size}:${Math.round(statSync(src).mtimeMs)}`;
    const dst = join(a.out, 'voice', `${name}.wav`);
    if (!a.force && existsSync(dst) && old.voice?.[name]?.sig === sig) { index.voice[name] = old.voice[name]; continue; }
    const r = readyLine(readFileSync(src));
    writeFileSync(dst, wav16([r.pcm]));
    index.voice[name] = { onset: r.onset, len: r.len, lufs: r.lufs, gain: r.gain, peak: r.peak, pauses: r.pauses, from: r.from, sig };
    console.log(`[media] her voice, ${name}: her words ${r.len} s (from ${r.from} s in her take), ${r.lufs} LUFS, peak ${r.peak} dBFS`
      + `${r.pauses.length ? `, a pause of ${r.pauses.map((p) => `${p.was} s made ${p.now} s`).join(', ')}` : ''}`);
  }
  writeFileSync(indexFile, `${JSON.stringify(index, null, 1)}\n`);
  if (missing.length) {
    console.warn(`[media] not found: ${missing.join(', ')} (${missing.map((n) => VOICES.find((v) => v[0] === n)[1][0]).join(', ')})`);
    process.exitCode = 2;
  }
  console.log(`[media] ${Object.keys(index.voice).length} of her ${VOICES.length} lines in ${a.out}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error(`[media] ${err.stack || err.message}`); process.exitCode = 1; });
}
