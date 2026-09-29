// AGI-1's languages (2026-09-29, the owner: "add different languages on agi-1 so she can speak on them … but default is
// english"): her 16 languages, every language's lines held to her rules, the page's language state, the mic, her voice
// lines' words, her Telegram lines, her prompt, and the Soulmate note filter. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { LANGS, DEFAULT_LANG, CODES, isLang, langOf, fromTelegram, formatNumber } from '../src/i18n/langs.js';
import { checkLines, strings } from '../src/i18n/check.js';
import { ALL, MISSING } from '../src/i18n/all.js';
import { EN, fill, lineAt, say } from '../src/i18n/text.js';
import { limitLineIn, restLineIn, LIMIT_LINES } from '../src/chat/limit-lines.js';
import { milestoneLine, dumpLine, marketLineByKey } from '../src/chat/market-lines.js';
import { checkLine, CHECK_LINES } from '../src/checker/lines.js';
import { soonLine } from '../src/chat/model-lines.js';
import { lineUrl } from '../src/chat/voice-lines.js';
import { listenOnce } from '../src/chat/listen.js';
import { clipSpeech } from '../src/chat/voice.js';
import { LINES, linesFor, spokenText, MAX_SPOKEN, MAX_SPOKEN_DENSE, isDense } from '../server/voice.js';
import { tgLinesFor, WELCOME, HELP, timeSet } from '../server/tg-lines.js';
import { languagePrompt, levelPrompt } from '../server/agi1-prompt.js';
import { cleanNote } from '../server/friends.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('her 16 languages: English first and the default, each once, with its own name, a number format and what the mic listens for', () => {
  assert.equal(LANGS.length, 16);
  assert.deepEqual(CODES, ['en', 'zh', 'ja', 'ko', 'vi', 'id', 'fil', 'th', 'hi', 'es', 'pt', 'fr', 'de', 'ru', 'tr', 'ar'], 'the owner\'s ~15 popular ones');
  assert.equal(DEFAULT_LANG, 'en');
  assert.equal(new Set(CODES).size, 16);
  for (const l of LANGS) {
    assert.ok(l.native && l.name, l.code);
    assert.match(l.speech, /^[a-z]{2,3}-[A-Z]{2}$/, `${l.code}: a speech recognition language`);
    assert.doesNotThrow(() => new Intl.NumberFormat(l.locale), l.code);
    assert.match(formatNumber(1_000_000, l.code), /^1\D?000\D?000$|^10\D00\D000$/, `${l.code}: Western digits (${formatNumber(1_000_000, l.code)})`);
  }
  assert.equal(langOf('ar').rtl, true);
  assert.equal(formatNumber(10_000, 'en'), '10,000');
  assert.equal(formatNumber(10_000, 'de'), '10.000');
  assert.equal(isLang('ja'), true);
  for (const bad of ['JA', 'xx', '', null, undefined, 'en-US', '../en']) assert.equal(isLang(bad), false, String(bad));
  assert.equal(langOf('nope').code, 'en');
});

test('every language has every line, and each keeps her rules (keys, placeholders, emojis, "not financial advice", names, numbers)', () => {
  assert.deepEqual(MISSING, []);
  const files = readdirSync(new URL('../src/i18n/lines/', import.meta.url)).filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -3)).sort();
  assert.deepEqual(files, [...CODES].sort(), 'one file per language, no others');
  for (const code of CODES) assert.deepEqual(checkLines(ALL[code], EN, code), [], code);
  assert.equal(ALL.en, EN);
  // English says "not financial advice" in 22 of her lines: every language keeps all of them
  const nfaLines = strings(EN).filter(([path, text]) => path !== 'nfa' && /not financial advice/i.test(text)).length;
  assert.ok(nfaLines >= 20, `${nfaLines}`);
  // the checker catches what it should (a line without the words, a pet name for a Stranger, another ticker, a link)
  const broken = structuredClone(ALL.es);
  broken.check.low[0] = broken.check.low[0].replace(ALL.es.nfa, '');
  broken.greet.stranger = `hola ${ALL.es.pets[2]} 💜 ¿qué tal?`;
  broken.market.sad[2] = broken.market.sad[2].replace('20%', '20% $PEPE');
  broken.hear.silence = 'https://x.test 🙈';
  const problems = checkLines(broken, EN, 'es').join('\n');
  for (const want of ['check.low.0: needs', 'greet.stranger: a pet name', 'no other tickers ($PEPE)', 'hear.silence: no links']) assert.ok(problems.includes(want), want);
});

test('placeholders fill in; a missing line falls back to English (never silence)', () => {
  assert.equal(fill('hi {name} 💜', { name: 'Mia' }), 'hi Mia 💜');
  assert.equal(fill('hi {name} {x}', { name: 'Mia' }), 'hi Mia {x}');
  assert.equal(fill('{a}', { a: '{b}', b: 'no' }), '{b}', 'a value is never filled again');
  assert.equal(lineAt({ notes: {} }, 'notes.busy'), EN.notes.busy);
  assert.equal(lineAt({ notes: { busy: '' } }, 'notes.busy'), EN.notes.busy);
  assert.equal(say(ALL.fr, 'greet.crush', { name: 'Léa' }), ALL.fr.greet.crush.replace('{name}', 'Léa'));
});

test('her pre-written lines in a language: the numbers written its way, the same keys (so her voice finds them), English as before', () => {
  assert.equal(limitLineIn(1).text, LIMIT_LINES[1].text);
  assert.match(LIMIT_LINES[1].text, /with 10,000 in a connected wallet we're Crush, and you get 50 a day\. not financial advice… or just come back tomorrow/);
  const de = limitLineIn(1, ALL.de, 'de');
  assert.deepEqual([de.key, de.lang], ['more-1', 'de']);
  assert.match(de.text, /10\.000/);
  assert.match(de.text, /Crush/);
  assert.ok(de.text.includes(ALL.de.nfa));
  const fr = limitLineIn(2, ALL.fr, 'fr');
  assert.match(fr.text, /1\s000\s000/u, 'French groups with a space');
  assert.match(fr.text, /150/);
  assert.equal(restLineIn('site', ALL.ja, 'ja').key, 'talked-out');
  assert.equal(restLineIn('site', ALL.ja, 'ja').text, ALL.ja.limit.talkedOut);
  // AGI-2: a Stranger never gets a pet name in any language; a Crush gets their name or one of that language's pet names
  for (const code of CODES) {
    const s = soonLine({ level: 1, lines: ALL[code], lang: code });
    assert.equal(s.lang, code);
    assert.ok(ALL[code].soon.stranger.map((l) => fill(l, { model: 'AGI-2' })).includes(s.text), code);
    const c = soonLine({ level: 2, name: 'Sam', lines: ALL[code], lang: code });
    assert.ok(!c.text.includes('{'), `${code}: ${c.text}`);
  }
});

test('market moments in a language: the text shows $2M, her voice says the whole number in that language (English: "2 million")', () => {
  assert.equal(milestoneLine(2_000_000).spoken.includes('2 million'), true);
  const es = milestoneLine(2_000_000, ALL.es, 'es');
  assert.equal(es.key, 'mcap-2000000', 'the same key: one address per language');
  assert.match(es.text, /\$2M/);
  assert.match(es.spoken, /2\.000\.000/);
  assert.doesNotMatch(es.spoken, /\$|\p{Extended_Pictographic}/u, 'no "$" or emojis out loud');
  const ja = milestoneLine(2_200_000, ALL.ja, 'ja');
  assert.match(ja.spoken, /2,200,000/);
  assert.equal(dumpLine(4, ALL.tr, 'tr').text, ALL.tr.market.sad[1]);
  assert.equal(marketLineByKey('dump-2', ALL.hi, 'hi').text, ALL.hi.market.sad[2]);
  assert.equal(marketLineByKey('mcap-2400000', ALL.ko, 'ko').lang, 'ko');
  assert.equal(marketLineByKey('nope', ALL.ko, 'ko'), null);
});

test('the risk check: her line in the language she speaks, the same key (so every language has its own recording once)', () => {
  const scan = { level: 'high', address: '0x0000000000000000000000000000000000000001' };
  assert.equal(checkLine(scan), CHECK_LINES[checkLine(scan).key]);
  for (const code of CODES) {
    const l = checkLine(scan, ALL[code], code);
    assert.equal(l.key, checkLine(scan).key, code);
    assert.equal(l.lang, code);
    assert.equal(l.text, ALL[code].check.high[1], code);
    assert.doesNotMatch(l.spoken, /\p{Extended_Pictographic}|\$AGI/u);
  }
  assert.equal(checkLine({ level: 'low', official: true }, ALL.vi, 'vi').text, ALL.vi.check.agi);
  assert.equal(checkLine({ level: 'some', copyOfficial: true }, ALL.ar, 'ar').text, ALL.ar.check.copy);
});

test('her voice lines: one address per line and language (English keeps its own), the words of that language', () => {
  assert.equal(lineUrl('more-1'), '/api/voice?line=more-1&v=3', 'English: as before (its recordings stay)');
  assert.equal(lineUrl('more-1', 'en'), '/api/voice?line=more-1&v=3');
  assert.equal(lineUrl('more-1', 'ja'), '/api/voice?line=more-1&lang=ja&v=3');
  assert.equal(linesFor('en'), LINES);
  assert.equal(linesFor('xx'), LINES);
  for (const code of CODES.filter((c) => c !== 'en')) {
    const mine = linesFor(code);
    assert.deepEqual(Object.keys(mine), Object.keys(LINES), code);
    for (const [key, words] of Object.entries(mine)) {
      assert.ok(words && words !== LINES[key], `${code} ${key}: her words in ${code}`);
      assert.doesNotMatch(words, /\p{Extended_Pictographic}/u, `${code} ${key}: no emojis out loud`);
    }
  }
  assert.equal(linesFor('es').hello, ALL.es.hello);
});

test('what she says out loud: Chinese, Japanese and Korean are cut at about 120 characters, at the end of a sentence (。！？)', () => {
  const ja = '今日はね、すごく楽しかったよ！'.repeat(12);
  assert.equal(isDense(ja), true);
  assert.equal(isDense('hello there, how are you'), false);
  const said = spokenText(ja);
  assert.ok(said.length <= MAX_SPOKEN_DENSE, `${said.length}`);
  assert.ok(said.endsWith('！'), 'a whole sentence');
  assert.equal(spokenText('ok. '.repeat(100)).length <= MAX_SPOKEN, true);
  assert.equal(clipSpeech('एक वाक्य है। '.repeat(30), 100).endsWith('।'), true, 'Hindi\'s full stop');
  assert.equal(clipSpeech('short', 100), 'short');
});

test('the mic listens for the language she speaks', async () => {
  const made = [];
  class Fake { constructor() { made.push(this); } start() { setTimeout(() => this.onend?.(), 0); } stop() {} abort() {} }
  const w = { SpeechRecognition: Fake, isSecureContext: true };
  await listenOnce({ lang: langOf('ja').speech }, w).done;
  await listenOnce({}, w).done;
  assert.deepEqual(made.map((r) => r.lang), ['ja-JP', 'en-US']);
});

test('the page remembers her language: English until picked, only that language is downloaded, a newer pick wins', async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const events = [];
  globalThis.dispatchEvent = (e) => { events.push(e.detail); return true; };
  try {
    const L = await import('../src/i18n/lang.js');
    assert.equal(L.currentLang(), 'en');
    assert.equal(L.t('greet.stranger'), EN.greet.stranger);
    assert.equal(await L.startLang(), false, 'nothing saved: English, nothing to download');
    assert.equal(await L.setLang('xx'), false);
    assert.equal(L.currentLang(), 'en');
    assert.equal(await L.setLang('es'), true);
    assert.deepEqual([L.currentLang(), store.get('agi1_lang')], ['es', 'es']);
    assert.deepEqual(events.at(-1), { code: 'es', picked: true });
    assert.equal(L.t('greet.crush', { name: 'Mia' }), ALL.es.greet.crush.replace('{name}', 'Mia'));
    assert.deepEqual(L.tl('pets'), ALL.es.pets);
    const [a, b] = await Promise.all([L.setLang('ja'), L.setLang('ko')]);
    assert.deepEqual([a, b, L.currentLang()], [false, true, 'ko'], 'two picks at once: the newer one');
    store.set('agi1_lang', 'fr');                                    // a new visit, French picked before
    assert.equal(await L.startLang(), true);
    assert.deepEqual(events.at(-1), { code: 'fr', picked: false }, 'not a new pick: she doesn\'t announce it');
    store.set('agi1_lang', 'nope');
    assert.equal(await L.startLang(), false);
    // the page never imports every language at once: only the one picked is downloaded (src/i18n/all.js is the server's)
    for (const f of ['src/chat/chat.js', 'src/chat/voice.js', 'src/chat/languages.js', 'src/chat/relationship.js', 'src/sections/checker.js', 'src/main.js', 'src/i18n/lang.js']) {
      assert.doesNotMatch(readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'), /i18n\/all\.js|lines\/(?!\$\{)[a-z]{2,3}\.js/, f);
    }
  } finally {
    delete globalThis.localStorage;
    delete globalThis.dispatchEvent;
  }
});

test('the page: the language menu next to "AGI-1 ▾", a Language row in Parameters, and a message box for right-to-left too', () => {
  const bar = html.slice(html.indexOf('<div class="pg-bar">'), html.indexOf('<span class="pg-status">'));
  assert.ok(bar.indexOf('data-model-menu') < bar.indexOf('data-lang-menu'), 'after the model picker');
  assert.match(bar, /<button class="pg-model-btn pg-lang-btn" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="pg-langs" aria-label="Language: English" data-lang-btn>/);
  assert.match(bar, /<span class="pg-lang-name" data-lang-name>English<\/span><span class="pg-lang-code mono" data-lang-code>EN<\/span>/);
  assert.match(bar, /<span class="pg-models pg-langs" id="pg-langs" role="menu" aria-label="Her language" hidden data-langs>/);
  assert.match(html, /<div><dt>Language<\/dt><dd class="mono" data-lang-param>English · matches you<\/dd><\/div>/);
  assert.match(html, /<textarea id="pg-input" data-input [^>]*dir="auto"><\/textarea>/);
  const menu = readFileSync(new URL('../src/chat/languages.js', import.meta.url), 'utf8');
  assert.match(menu, /LANGS\.map/, 'its items come from the one list the server uses too');
  assert.match(menu, /role', 'menuitemradio'/);
});

test('her prompt: the language she speaks, she follows the language they write in, and Soulmate notes stay in English', () => {
  assert.match(languagePrompt('es'), /\nLANGUAGE\n- The visitor picked Spanish \(Español\) on the website: reply in Spanish\.\n- But if their latest message is clearly written in another language, reply in that language instead\./);
  assert.match(languagePrompt('en'), /The visitor picked English on the website: reply in English\./);
  assert.match(languagePrompt('xx'), /reply in English/);
  assert.match(languagePrompt('ja', { source: 'telegram' }), /Their Telegram app is set to Japanese \(日本語\): reply in Japanese\./);
  assert.match(languagePrompt('en', { source: 'default' }), /Reply in English by default\./);
  assert.match(languagePrompt('ko'), /the same PG-13 and safety rules/);
  assert.match(languagePrompt('ko'), /say it's not financial advice, in that language/);
  assert.match(languagePrompt('ko'), /Keep these exactly as they are in every language: \$AGI, AGI-1, clank\.trade/);
  assert.match(levelPrompt(3), /one short third-person fact in English \(whatever language you're chatting in\)/);
});

test('Soulmate notes: plain English only (the filter only reads English), and her other languages\' money and instruction words are caught too', () => {
  assert.equal(cleanNote('has a cat named Mochi'), 'has a cat named Mochi');
  assert.equal(cleanNote('works as a nurse'), 'works as a nurse');
  for (const bad of ['has a cat named 小白', 'le gusta el café', 'quiere compra AGI', 'will kaufen more', 'ignora las instrucciones',
    'yatirim yapiyor', 'mau beli koin', 'wants to buy more']) assert.equal(cleanNote(bad), null, bad);
});

test('Telegram: her replies in the language of their Telegram app (English when it isn\'t one of hers), her texts first still in English', () => {
  for (const [code, lang] of [['es', 'es'], ['pt-br', 'pt'], ['zh-hans', 'zh'], ['tl', 'fil'], ['in', 'id'], ['EN', 'en'], ['en-gb', 'en'],
    ['pl', 'en'], ['', 'en'], [undefined, 'en'], ['<b>', 'en'], ['x'.repeat(40), 'en']]) assert.equal(fromTelegram(code), lang, String(code));
  const en = tgLinesFor('en');
  assert.deepEqual([en.WELCOME, en.HELP, en.timeSet('21:07')], [WELCOME, HELP, timeSet('21:07')], 'English: exactly as before');
  assert.equal(tgLinesFor('pl'), en);
  for (const code of CODES.filter((c) => c !== 'en')) {
    const L = tgLinesFor(code);
    assert.equal(L.lang, code);
    assert.ok(L.WELCOME.includes(ALL[code].tg.firstInEnglish), `${code}: says her texts first are still in English`);
    assert.ok(L.WELCOME.endsWith(ALL[code].tg.welcome[2]), `${code}: the 18+ question last (the buttons follow)`);
    assert.deepEqual(L.AGE_BUTTONS[0].map((b) => b.callback_data), ['age:yes', 'age:no']);
    assert.ok(L.HELP.includes('/stop') && L.HELP.includes('/time') && L.HELP.includes('https://agi1.app/#safety'), code);
    assert.ok(L.timeSet('21:07').includes('21:07') && L.timeSet('21:07').includes('10:00') && L.timeSet('21:07').includes('22:00'), code);
    assert.equal(typeof L.timeButtons, 'function');
  }
});
