// Every language's lines, for the server (its voice lines, her Telegram replies, her deflections). The page never
// imports this file: it loads only the language a visitor picked (src/i18n/lang.js).
import { LANGS } from './langs.js';
import en from './lines/en.js';
import zh from './lines/zh.js';
import ja from './lines/ja.js';
import ko from './lines/ko.js';
import vi from './lines/vi.js';
import id from './lines/id.js';
import fil from './lines/fil.js';
import th from './lines/th.js';
import hi from './lines/hi.js';
import es from './lines/es.js';
import pt from './lines/pt.js';
import fr from './lines/fr.js';
import de from './lines/de.js';
import ru from './lines/ru.js';
import tr from './lines/tr.js';
import ar from './lines/ar.js';

export const ALL = { en, zh, ja, ko, vi, id, fil, th, hi, es, pt, fr, de, ru, tr, ar };
export const linesOf = (code) => ALL[code] || ALL.en;
// (every language in LANGS has its lines: tests/i18n.test.js)
export const MISSING = LANGS.filter((l) => !ALL[l.code]).map((l) => l.code);
