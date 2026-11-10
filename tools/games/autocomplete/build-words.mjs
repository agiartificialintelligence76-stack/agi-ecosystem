#!/usr/bin/env node
// AUTOCOMPLETE (2026-11-09): builds the game's dictionary from permissively licensed sources (see ./README.md).
//
//   public/games/autocomplete/words.bin   every word the game accepts, as a packed DAWG (a minimal word graph)
//   public/games/autocomplete/common.txt  AGI-1's vocabulary (what she predicts and hints), most likely first
//
// node tools/games/autocomplete/build-words.mjs --enable <enable1.txt> --scowl <wordlist-english package dir>
//   --ldnoobw <naughty-words en.json> --badwords <badwords-list dist/array.js> --profane <profane-words words.json>
//   --gutenberg <dir of NLTK's gutenberg .txt files> [--out public/games/autocomplete] [--check]
//
// Words: a–z only, 3 to 15 letters (capitalized entries, proper nouns and abbreviations, are left out). Then the rules in
// ./blocked.rot13.txt (never accepted, predicted or hinted) and ./quiet.txt (accepted, never suggested). Every word the
// three block lists name that's in the accept list must be blocked by those rules or listed in ./allowed.txt (reviewed
// and kept): the build stops otherwise, so a new version of a list is always reviewed.
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const need = (name) => { const v = arg(name); if (!v) { console.error(`missing --${name}`); process.exit(1); } return v; };
const OUT = arg('out', join(HERE, '../../../public/games/autocomplete'));
const WORD = /^[a-z]{3,15}$/;
const sha = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 16);

// ---------- the sources ----------
const enableRaw = readFileSync(need('enable'));
const enable = enableRaw.toString('utf8').split(/\r?\n/).map((w) => w.trim()).filter((w) => WORD.test(w));
const scowlDir = need('scowl');
const scowl = new Map();            // word → { level (lowest), dialects }
for (const f of readdirSync(scowlDir)) {
  const m = /^(english|american|british|canadian|australian)-words-(\d+)\.json$/.exec(f);
  if (!m) continue;
  const level = Number(m[2]);
  for (const w of JSON.parse(readFileSync(join(scowlDir, f), 'utf8'))) {
    if (!WORD.test(w)) continue;
    const e = scowl.get(w) || { level: 99, common: 99 };
    e.level = Math.min(e.level, level);
    if (m[1] === 'english' || m[1] === 'american') e.common = Math.min(e.common, level);
    scowl.set(w, e);
  }
}
const SCOWL_MAX = 60;               // the accept list: ENABLE and SCOWL up to size 60 (every dialect)
const COMMON_MAX = 40;              // her vocabulary: SCOWL English and American up to size 40
const candidates = new Set(enable);
for (const [w, e] of scowl) if (e.level <= SCOWL_MAX) candidates.add(w);

// ---------- the rules ----------
const rot13 = (s) => s.replace(/[a-z]/gi, (c) => String.fromCharCode(((c.toLowerCase().charCodeAt(0) - 97 + 13) % 26) + 97));
const tokensOf = (text) => text.split(/\r?\n/).filter((l) => !l.startsWith('#')).join(' ').split(/\s+/).filter(Boolean);
// word and its regular forms
function forms(w) {
  const out = new Set([w]);
  const add = (...xs) => xs.forEach((x) => out.add(x));
  add(`${w}s`, `${w}es`, `${w}ed`, `${w}d`, `${w}ing`, `${w}er`, `${w}ers`, `${w}est`, `${w}y`, `${w}ly`, `${w}ish`, `${w}ness`, `${w}ier`, `${w}iest`);
  if (w.endsWith('e')) { const b = w.slice(0, -1); add(`${b}ing`, `${b}ed`, `${b}er`, `${b}ers`, `${b}est`, `${b}y`, `${b}ish`); }
  if (w.endsWith('y')) { const b = w.slice(0, -1); add(`${b}ies`, `${b}ied`, `${b}ier`, `${b}iest`, `${b}ily`, `${b}iness`); }
  if (/[^aeiou][aeiou][bdgklmnprt]$/.test(w)) { const d = w + w.at(-1); add(`${d}ed`, `${d}ing`, `${d}er`, `${d}ers`, `${d}y`, `${d}ies`, `${d}ish`); }
  return out;
}
// a rule starting with ! is an exception: the words it names are never caught by the others ("!word", "!word*")
function ruleSet(tokens, words) {
  const hit = new Set(), unused = [];
  const except = tokens.filter((t) => t.startsWith('!')).map((t) => t.slice(1));
  const excepted = (w) => except.some((x) => (x.endsWith('*') ? w.startsWith(x.slice(0, -1)) : w === x));
  for (const t of tokens.filter((x) => !x.startsWith('!'))) {
    let n = 0;
    if (t.startsWith('*') && t.endsWith('*')) { const s = t.slice(1, -1); for (const w of words) if (w.includes(s)) { hit.add(w); n++; } }
    else if (t.endsWith('*')) { const s = t.slice(0, -1); for (const w of words) if (w.startsWith(s)) { hit.add(w); n++; } }
    else if (t.endsWith('+')) { for (const f of forms(t.slice(0, -1))) if (words.has(f)) { hit.add(f); n++; } }
    else if (words.has(t)) { hit.add(t); n++; }
    if (!n) unused.push(t);
  }
  for (const w of [...hit]) if (excepted(w)) hit.delete(w);
  return { hit, unused };
}
const blockedRules = tokensOf(readFileSync(join(HERE, 'blocked.rot13.txt'), 'utf8')).map(rot13);
const quietRules = tokensOf(readFileSync(join(HERE, 'quiet.txt'), 'utf8'));
const allowed = new Set(tokensOf(readFileSync(join(HERE, 'allowed.txt'), 'utf8')));
const blocked = ruleSet(blockedRules, candidates);
const accept = [...candidates].filter((w) => !blocked.hit.has(w)).sort();
const acceptSet = new Set(accept);

// every word an outside block list names (single words), in the accept list: blocked by our rules, or reviewed and kept
const external = new Set();
const single = (w) => (typeof w === 'string' && /^[a-z]+$/i.test(w) ? w.toLowerCase() : null);
for (const w of JSON.parse(readFileSync(need('ldnoobw'), 'utf8'))) { const s = single(w); if (s) external.add(s); }
for (const w of JSON.parse(readFileSync(need('profane'), 'utf8'))) { const s = single(w); if (s) external.add(s); }
for (const m of readFileSync(need('badwords'), 'utf8').matchAll(/'([^']*)'/g)) { const s = single(m[1]); if (s) external.add(s); }
const unreviewed = [...external].filter((w) => acceptSet.has(w) && !allowed.has(w)).sort();
const staleAllowed = [...allowed].filter((w) => !external.has(w) || !acceptSet.has(w));

// ---------- her vocabulary, most likely first ----------
// SCOWL's size is the main signal (10 the most common words, then 20, 35, 40); inside a size, how often the word
// appears in NLTK's selection of public-domain Project Gutenberg books (the King James Bible counted at a third,
// so its old words don't crowd out everyday ones); then shorter words, then a to z.
const freq = new Map();
const gdir = need('gutenberg');
for (const f of readdirSync(gdir).filter((x) => x.endsWith('.txt')).sort()) {
  const weight = /bible/.test(f) ? 1 / 3 : 1;
  for (const w of readFileSync(join(gdir, f), 'utf8').toLowerCase().split(/[^a-z]+/)) if (w) freq.set(w, (freq.get(w) || 0) + weight);
}
const quiet = ruleSet(quietRules, acceptSet);
const common = [...scowl].filter(([w, e]) => e.common <= COMMON_MAX && acceptSet.has(w) && !quiet.hit.has(w)).map(([w, e]) => ({ w, tier: e.common, f: freq.get(w) || 0 }));
common.sort((a, b) => a.tier - b.tier || b.f - a.f || a.w.length - b.w.length || (a.w < b.w ? -1 : 1));

// ---------- the packed word graph (DAWG) ----------
// Built from the sorted list with the incremental minimization of Daciuk et al. (2000). Stored as 32-bit edges, a
// node's edges side by side in letter order: bits 0–4 the letter (a = 0), bit 5 a word ends here, bit 6 the node's
// last edge, bits 7–31 where the next node's edges start (0: none). Words 0–3 are the header: magic, word count, the
// root's first edge, the length.
function buildDawg(sorted) {
  let nextId = 0;
  const node = () => ({ final: false, edges: [], id: -1 });
  const root = node();
  const register = new Map();
  const stack = [];                 // [parent, child] along the last word
  const sig = (n) => `${n.final ? 1 : 0}${n.edges.map(([l, c]) => `,${l}.${c.id}`).join('')}`;
  const minimize = (down) => {
    while (stack.length > down) {
      const [parent, child] = stack.pop();
      const s = sig(child);
      const found = register.get(s);
      if (found) parent.edges[parent.edges.length - 1][1] = found;
      else { child.id = nextId++; register.set(s, child); }
    }
  };
  let prev = '';
  for (const w of sorted) {
    if (w <= prev) throw new Error(`not sorted: ${prev} ${w}`);
    let k = 0;
    while (k < w.length && k < prev.length && w[k] === prev[k]) k++;
    minimize(k);
    let at = stack.length ? stack[stack.length - 1][1] : root;
    for (let i = k; i < w.length; i++) {
      const child = node();
      at.edges.push([w.charCodeAt(i) - 97, child]);
      stack.push([at, child]);
      at = child;
    }
    at.final = true;
    prev = w;
  }
  minimize(0);
  // lay the nodes out depth first from the root (its children's blocks after it: good locality for the solver)
  const ref = new Map();
  const order = [];
  let size = 4;
  const place = (n) => {
    if (!n.edges.length || ref.has(n)) return;
    ref.set(n, size); size += n.edges.length; order.push(n);
    for (const [, c] of n.edges) place(c);
  };
  place(root);
  const E = new Uint32Array(size);
  E[0] = 0x41435731; E[1] = sorted.length; E[2] = ref.get(root); E[3] = size;
  for (const n of order) {
    const at = ref.get(n);
    n.edges.forEach(([l, c], i) => {
      const target = c.edges.length ? ref.get(c) : 0;
      if (target >= 2 ** 25) throw new Error('too big');
      E[at + i] = (l | (c.final ? 32 : 0) | (i === n.edges.length - 1 ? 64 : 0) | (target << 7)) >>> 0;
    });
  }
  return { E, nodes: register.size };
}

const { E, nodes } = buildDawg(accept);
const bin = Buffer.from(E.buffer, E.byteOffset, E.byteLength);
const commonTxt = `${common.map((c) => c.w).join('\n')}\n`;

// ---------- report ----------
console.log(`sources: ENABLE ${enable.length} words (sha ${sha(enableRaw)}), SCOWL ${scowl.size} words`);
console.log(`accept: ${accept.length} words (${blocked.hit.size} blocked), DAWG ${nodes} nodes, ${E.length} edges`);
console.log(`words.bin ${bin.length} B (gzip ${gzipSync(bin, { level: 9 }).length} B), sha ${sha(bin)}`);
console.log(`common: ${common.length} words (${quiet.hit.size} quiet), common.txt ${commonTxt.length} B (gzip ${gzipSync(commonTxt, { level: 9 }).length} B), sha ${sha(commonTxt)}`);
console.log(`her top 40: ${common.slice(0, 40).map((c) => c.w).join(' ')}`);
if (blocked.unused.length) console.log(`(block rules matching nothing here, kept for safety: ${blocked.unused.length})`);
if (staleAllowed.length) console.log(`allowed.txt words no list names any more (can go): ${staleAllowed.join(' ')}`);
if (unreviewed.length) {
  console.error(`\n${unreviewed.length} words a block list names are neither blocked nor reviewed (allowed.txt). ROT13:\n${unreviewed.map(rot13).join(' ')}`);
  process.exit(2);
}
if (!args.includes('--check')) {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'words.bin'), bin);
  writeFileSync(join(OUT, 'common.txt'), commonTxt);
  console.log(`wrote ${join(OUT, 'words.bin')} and common.txt`);
}
