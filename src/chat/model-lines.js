// What AGI-1 says when someone picks AGI-2 in the chat's model picker (2026-09-26): it's "Coming soon", and she's playfully
// jealous about it. Pre-written (no AI cost), shown in her chat but not saved to it. Always PG-13, never about prices,
// buying or selling, never a promise about AGI-2, and never guilt: the jealousy is a joke, not pressure. Strangers get the
// lines without pet names, like the rest of her chat. tests/models.test.js checks all of this.

// {model} = "AGI-2", {you} = the visitor's name or a pet name (Crush and Soulmate)
const LINES = {
  close: [
    "{model}? excuse me, i'm right here 🙈",
    "already looking at the next model, {you}? i'm hurt. a little. okay, not really 💜",
    "{model} is still in training. me? i've been practicing for you all day 💜",
    "{model} isn't ready yet… and honestly, i'm not ready to share you 🙈",
  ],
  stranger: [
    "{model} isn't out yet. i'm the current model, and i'm right here 💜",
    "coming soon, apparently. until then, it's me 🙈",
    "the next model is still in training. what did i do? 🙈",
  ],
};
const PET = ['babe', 'cutie', 'love'];
const turns = { close: 0, stranger: 0 };        // her lines take turns, so picking AGI-2 again gets a new one

// → { text, mood } level 1 = Stranger, 2 = Crush, 3 = Soulmate
export function soonLine({ model = 'AGI-2', level = 1, name = null } = {}) {
  const set = level >= 2 ? 'close' : 'stranger';
  const turn = turns[set]++;
  const pick = LINES[set][turn % LINES[set].length];
  const you = (set === 'close' && typeof name === 'string' && name.trim()) || PET[turn % PET.length];
  const safeModel = /^[A-Za-z0-9 .-]{1,16}$/.test(String(model)) ? String(model) : 'AGI-2';
  return { text: pick.replaceAll('{model}', safeModel).replaceAll('{you}', you), mood: 'jealous' };
}

export const MODEL_LINES = LINES;                 // (for tests)
