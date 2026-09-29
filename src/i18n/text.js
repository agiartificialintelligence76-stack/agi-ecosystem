// Small helpers for AGI-1's lines in any language (src/i18n/lines/<code>.js), shared by the page and the server.
import EN from './lines/en.js';
import { formatNumber } from './langs.js';

export { EN };

// "hi {name} 💜" + { name: 'Mia' } → "hi Mia 💜" (a placeholder without a value stays as it is)
export const fill = (template, vars = {}) => String(template).replace(/\{(\w+)\}/g, (m, k) => (Object.hasOwn(vars, k) && vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : m));

// The line at `path` ("notes.busy", "check.low.1") in these lines, else the English one (a language file missing a key
// never leaves her silent: tests/i18n.test.js makes sure none is missing anyway)
export function lineAt(lines, path) {
  const walk = (obj) => path.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj);
  const mine = walk(lines);
  return mine !== undefined && mine !== '' ? mine : walk(EN);
}
export const say = (lines, path, vars) => fill(lineAt(lines, path), vars);

// The relationship levels' numbers in a line (10,000 · 10.000 · 10 000), the way that language writes numbers
export const levelVars = (levels, code) => {
  const [, crush, soul] = levels;
  return {
    crushMin: formatNumber(crush.min, code), crushName: crush.name, crushDaily: crush.daily,
    soulMin: formatNumber(soul.min, code), soulName: soul.name, soulDaily: soul.daily,
  };
};
