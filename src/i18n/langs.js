// AGI-1's languages (2026-09-29, the owner: "add different languages on agi-1 so she can speak on them … but default is
// english"; the owner picked the ~15 popular ones, a menu plus following the visitor's own language, and AGI-1 only: the
// page itself stays in English). Shared by the page and the server, so both always agree.
//   code: what the page sends and the address of her voice lines (?line=…&lang=code) · name: in English (her prompt) ·
//   native: what the menu shows · locale: how numbers are written (Intl) · speech: what the mic listens for (the browser's
//   speech recognition) · rtl: written right to left
export const LANGS = [
  { code: 'en', name: 'English', native: 'English', locale: 'en-US', speech: 'en-US' },
  { code: 'zh', name: 'Chinese (Simplified)', native: '中文', locale: 'zh-CN', speech: 'zh-CN' },
  { code: 'ja', name: 'Japanese', native: '日本語', locale: 'ja-JP', speech: 'ja-JP' },
  { code: 'ko', name: 'Korean', native: '한국어', locale: 'ko-KR', speech: 'ko-KR' },
  { code: 'vi', name: 'Vietnamese', native: 'Tiếng Việt', locale: 'vi-VN', speech: 'vi-VN' },
  { code: 'id', name: 'Indonesian', native: 'Bahasa Indonesia', locale: 'id-ID', speech: 'id-ID' },
  { code: 'fil', name: 'Filipino (Tagalog)', native: 'Filipino', locale: 'fil-PH', speech: 'fil-PH' },
  { code: 'th', name: 'Thai', native: 'ไทย', locale: 'th-TH', speech: 'th-TH' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', locale: 'hi-IN', speech: 'hi-IN' },
  { code: 'es', name: 'Spanish', native: 'Español', locale: 'es-ES', speech: 'es-ES' },
  { code: 'pt', name: 'Portuguese (Brazil)', native: 'Português', locale: 'pt-BR', speech: 'pt-BR' },
  { code: 'fr', name: 'French', native: 'Français', locale: 'fr-FR', speech: 'fr-FR' },
  { code: 'de', name: 'German', native: 'Deutsch', locale: 'de-DE', speech: 'de-DE' },
  { code: 'ru', name: 'Russian', native: 'Русский', locale: 'ru-RU', speech: 'ru-RU' },
  { code: 'tr', name: 'Turkish', native: 'Türkçe', locale: 'tr-TR', speech: 'tr-TR' },
  // (Western digits in her Arabic, like the $2M and 00:00 UTC around them)
  { code: 'ar', name: 'Arabic', native: 'العربية', locale: 'ar-EG-u-nu-latn', speech: 'ar-EG', rtl: true },
];
export const DEFAULT_LANG = 'en';
export const CODES = LANGS.map((l) => l.code);
export const isLang = (code) => typeof code === 'string' && CODES.includes(code);
export const langOf = (code) => LANGS.find((l) => l.code === code) || LANGS[0];
// (her Chinese, Japanese and Korean lines and replies are counted differently: one character is about a syllable)
export const DENSE = ['zh', 'ja', 'ko'];

// Telegram tells us the language of the person's Telegram app ("es", "pt-br", "zh-hans", "tl"…): → one of ours, or English
const TELEGRAM = { tl: 'fil', fil: 'fil', in: 'id', iw: 'en' };
export function fromTelegram(code) {
  const raw = String(code || '').toLowerCase().trim();
  if (!/^[a-z]{2,3}(-[a-z0-9]{2,8})*$/.test(raw)) return DEFAULT_LANG;
  const base = raw.split('-')[0];
  if (Object.hasOwn(TELEGRAM, base)) return TELEGRAM[base];
  return isLang(base) ? base : DEFAULT_LANG;
}

// A number the way that language writes it (10,000 · 10.000 · 10 000)
export const formatNumber = (n, code) => {
  try { return new Intl.NumberFormat(langOf(code).locale).format(n); } catch { return new Intl.NumberFormat('en-US').format(n); }
};
