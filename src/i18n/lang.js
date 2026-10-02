// Which language AGI-1 speaks with this visitor (2026-09-29, the owner's request). The chat's language menu
// (src/chat/languages.js) sets it, remembered in this browser (agi1_lang); English until one is picked (the owner: "default
// is english"). Only the picked language's lines are downloaded (a small file each: Vite splits src/i18n/lines/*.js).
// 'agi1:lang' { code, picked } tells the page when it changes (the chat, the risk check, the level-up): picked = the visitor
// just chose it (not a saved choice coming back on a new visit).
// She also follows the visitor: whatever language they write in, she answers in (her prompt, server/agi1-prompt.js).
import { isLang, DEFAULT_LANG } from './langs.js';
import { EN, say, lineAt } from './text.js';

const KEY = 'agi1_lang';
let code = DEFAULT_LANG, lines = EN, serial = 0;

export const currentLang = () => code;
export const currentLines = () => lines;
// her line at `path` in the current language, with its {placeholders} filled ("notes.busy", "greet.crush" + { name })
export const t = (path, vars) => say(lines, path, vars);
// …or as it is (a list, e.g. "pets")
export const tl = (path) => lineAt(lines, path);

const saved = () => { try { const v = localStorage.getItem(KEY); return isLang(v) ? v : null; } catch { return null; } };
const load = async (next) => (next === DEFAULT_LANG ? EN : (await import(`./lines/${next}.js`)).default);

// → true once she speaks `next` (false: not one of hers, or its file couldn't be downloaded: she stays as she was)
export async function setLang(next, { remember = true, picked = true } = {}) {
  if (!isLang(next)) return false;
  const my = ++serial;
  let got;
  try { got = await load(next); } catch { return false; }
  if (my !== serial || !got || typeof got !== 'object') return false;      // (a newer choice won)
  code = next;
  lines = got;
  if (remember) { try { localStorage.setItem(KEY, next); } catch { /* this visit only */ } }
  try { dispatchEvent(new CustomEvent('agi1:lang', { detail: { code: next, picked } })); } catch { /* (tests without a window) */ }
  return true;
}

// At page start: the language this visitor picked on an earlier visit (English needs nothing). A pick in another tab of
// this browser, or in her pop-out window's page (2026-10-02), is followed here too, quietly
export function startLang() {
  try {
    addEventListener('storage', (e) => {
      if (e.key !== KEY) return;
      const next = saved() || DEFAULT_LANG;
      if (next !== code) setLang(next, { remember: false, picked: false });
    });
  } catch { /* (tests without a window) */ }
  const was = saved();
  return was && was !== DEFAULT_LANG ? setLang(was, { remember: false, picked: false }) : Promise.resolve(false);
}
