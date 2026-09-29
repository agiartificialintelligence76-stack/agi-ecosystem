// Checks one language's lines against the English source (src/i18n/lines/en.js), so a translation can't break her rules:
// the same keys, the same {placeholders}, the same emojis (her signature), the numbers kept, "not financial advice" (the
// language's own words, `nfa`) wherever the English says it, $AGI / AGI-1 / clank.trade / the commands kept as they are,
// no links the English doesn't have, no other $TICKERS, no pet names in a line a Stranger can get, sane lengths.
// Used by tests/i18n.test.js and by `node tools/i18n/check.mjs <code>` while translating. → a list of problems ([] = fine)

const EMOJI = /\p{Extended_Pictographic}/gu;
const IS_EMOJI = /\p{Extended_Pictographic}/u;
const KEEP = ['$AGI', 'AGI-1', 'clank.trade', 'DexScreener', 'PG-13', 'UTC', '/start', '/stop', '/time', '/help', '18+'];
// lines anyone can get, Strangers too (no pet names in them unless the English has one: limit.talkedOut and deflect do)
const FOR_ANYONE = [/^greet\.stranger$/, /^fresh$/, /^langSet$/, /^notes\./, /^hear\./, /^voiceRest\./, /^soon\.stranger\./, /^limit\.(more1|sleep|finePrint)$/,
  /^hello$/, /^market\./, /^check\./, /^tg\./];
// ("firstInEnglish" is empty in English: every other language says that her texts first are still in English)
const OPTIONAL_IN_ENGLISH = ['tg.firstInEnglish'];

const placeholders = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const emojis = (s) => (String(s).match(EMOJI) || []).sort();
const digits = (s) => String(s).match(/\d+/g) || [];
const fold = (s) => String(s).normalize('NFKC').toLocaleLowerCase();
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// every string in the lines, with its path ("limit.more1", "soon.close.2")
export function strings(obj, path = '') {
  if (typeof obj === 'string') return [[path, obj]];
  if (Array.isArray(obj)) return obj.flatMap((v, i) => strings(v, `${path}.${i}`));
  if (obj && typeof obj === 'object') return Object.entries(obj).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k));
  return [];
}
function shape(obj) {
  if (typeof obj === 'string') return 's';
  if (Array.isArray(obj)) return `[${obj.map(shape).join(',')}]`;
  if (obj && typeof obj === 'object') return `{${Object.keys(obj).sort().map((k) => `${k}:${shape(obj[k])}`).join(',')}}`;
  return typeof obj;
}
// a pet name in a line: a whole word in scripts with spaces, anywhere in the others
function hasPet(text, pets) {
  const t = fold(text);
  return pets.some((p) => {
    const w = fold(p).trim();
    if (!w) return false;
    if (/^[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Greek}\s'-]+$/u.test(w)) {
      return new RegExp(`(^|[^\\p{L}])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}])`, 'u').test(t);
    }
    return t.includes(w);
  });
}

export function checkLines(lines, en, code = '?') {
  const problems = [];
  const bad = (where, what) => problems.push(`${code} ${where}: ${what}`);
  if (!lines || typeof lines !== 'object') return [`${code}: no lines`];
  if (shape(lines) !== shape(en)) {
    const mine = new Map(strings(lines)), theirs = new Map(strings(en));
    for (const k of theirs.keys()) if (!mine.has(k)) bad(k, 'missing');
    for (const k of mine.keys()) if (!theirs.has(k)) bad(k, 'not in the English');
    if (!problems.length) bad('(shape)', 'the keys or lists differ from the English');
    return problems;
  }
  const nfa = typeof lines.nfa === 'string' ? lines.nfa.trim() : '';
  if (!nfa) bad('nfa', 'missing: the words for "not financial advice"');
  const pets = Array.isArray(lines.pets) ? lines.pets : [];
  if (pets.length !== 3 || pets.some((p) => typeof p !== 'string' || !p.trim() || IS_EMOJI.test(p))) bad('pets', 'three pet names, no emojis');
  const english = new Map(strings(en));
  for (const [path, text] of strings(lines)) {
    if (path === 'nfa' || path.startsWith('pets.')) continue;
    const src = english.get(path);
    if (OPTIONAL_IN_ENGLISH.includes(path) && !src) {
      if (code !== 'en' && !text.trim()) bad(path, 'empty (say that her texts first are still in English)');
      if (/\{\w+\}|https?:/i.test(text)) bad(path, 'no placeholders or links here');
      continue;
    }
    if (!text.trim()) { bad(path, 'empty'); continue; }
    if (!same(placeholders(text), placeholders(src))) bad(path, `placeholders ${placeholders(text).join(',') || '(none)'} ≠ ${placeholders(src).join(',') || '(none)'}`);
    if (!same(emojis(text), emojis(src))) bad(path, `emojis ${emojis(text).join('') || '(none)'} ≠ ${emojis(src).join('') || '(none)'}`);
    if (/not financial advice/i.test(src) && !fold(text).includes(fold(nfa))) bad(path, `needs "${nfa}"`);
    for (const k of KEEP) if (src.includes(k) && !text.includes(k)) bad(path, `keep "${k}" as it is`);
    for (const d of digits(src)) if (!digits(text).includes(d)) bad(path, `keep the number ${d} (Western digits)`);
    if ((text.match(/\n/g) || []).length !== (src.match(/\n/g) || []).length) bad(path, 'the same line breaks as the English');
    if (/https?:|www\./i.test(text) && !/https?:|www\./i.test(src)) bad(path, 'no links');
    for (const t of text.match(/\$[A-Za-z][A-Za-z0-9]*/g) || []) if (t !== '$AGI') bad(path, `no other tickers (${t})`);
    if (text.length > Math.max(src.length * 2.5, src.length + 80)) bad(path, `too long (${text.length} characters, the English has ${src.length})`);
    if (FOR_ANYONE.some((r) => r.test(path)) && !hasPet(src, en.pets) && hasPet(text, pets)) bad(path, 'a pet name in a line a Stranger can get');
  }
  return problems;
}
