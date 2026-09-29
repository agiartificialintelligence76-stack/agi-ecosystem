// What AGI-1 says when someone picks AGI-2 in the chat's model picker (2026-09-26): it's "Coming soon", and she's playfully
// jealous about it. Pre-written (no AI cost), shown in her chat but not saved to it. Always PG-13, never about prices,
// buying or selling, never a promise about AGI-2, and never guilt: the jealousy is a joke, not pressure. Strangers get the
// lines without pet names, like the rest of her chat. tests/models.test.js checks all of this.
// In her languages (2026-09-29): `soon` and `pets` in src/i18n/lines/<code>.js (English: en.js).
import { EN, fill } from '../i18n/text.js';

// {model} = "AGI-2", {you} = the visitor's name or a pet name (Crush and Soulmate)
const LINES = EN.soon;
const turns = { close: 0, stranger: 0 };        // her lines take turns, so picking AGI-2 again gets a new one

// → { text, mood, lang } level 1 = Stranger, 2 = Crush, 3 = Soulmate; lines/lang: the language she speaks (English if not given)
export function soonLine({ model = 'AGI-2', level = 1, name = null, lines = EN, lang = 'en' } = {}) {
  const set = level >= 2 ? 'close' : 'stranger';
  const list = Array.isArray(lines?.soon?.[set]) && lines.soon[set].length ? lines.soon[set] : EN.soon[set];
  const pets = Array.isArray(lines?.pets) && lines.pets.length ? lines.pets : EN.pets;
  const turn = turns[set]++;
  const pick = list[turn % list.length];
  const you = (set === 'close' && typeof name === 'string' && name.trim()) || pets[turn % pets.length];
  const safeModel = /^[A-Za-z0-9 .-]{1,16}$/.test(String(model)) ? String(model) : 'AGI-2';
  return { text: fill(pick, { model: safeModel, you }), mood: 'jealous', lang };
}

export const MODEL_LINES = LINES;                 // (for tests)
