// While translating AGI-1's lines: checks src/i18n/lines/<code>.js against the English (src/i18n/check.js).
// Run: node tools/i18n/check.mjs es pt fr   (no codes = every language)
import { LANGS } from '../../src/i18n/langs.js';
import { checkLines } from '../../src/i18n/check.js';
import en from '../../src/i18n/lines/en.js';

const codes = process.argv.slice(2).length ? process.argv.slice(2) : LANGS.map((l) => l.code);
let failed = 0;
for (const code of codes) {
  let lines;
  try { lines = (await import(`../../src/i18n/lines/${code}.js`)).default; } catch (err) { console.log(`${code}: can't load (${err.message})`); failed += 1; continue; }
  const problems = checkLines(lines, en, code);
  console.log(problems.length ? problems.join('\n') : `${code}: ok`);
  if (problems.length) failed += 1;
}
process.exit(failed ? 1 : 0);
