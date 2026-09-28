// What AGI-1 says in her chat when the Arena crowns a new champion (Phase 4). Pre-written lines, so it costs nothing
// (no Gemini call). Happy when $AGI wins, playfully jealous when another coin does. Always PG-13, never about prices,
// buying or selling, and never guilt-tripping: the jealousy is a joke, not pressure. tests/champion.test.js checks this.
// Strangers (no wallet or under 10,000 $AGI) get the reserved lines without pet names, like the rest of her chat.

// {n} = round number, {coin} = "$CABO", {votes} = "7 votes", {you} = the visitor's name or a pet name (Crush and Soulmate)
const LINES = {
  win: {
    close: [
      'we won round {n} 💜 {votes} for me. okay, i\'m blushing',
      'round {n} is mine 💜 the crown suits me, right?',
      '{you}, i won round {n} 💜 best five minutes of my day',
      'look at me, round {n} champion 💜 don\'t let it go to my head… too late',
      'crowned again 💜 round {n}, {votes}. i\'d do a victory dance but i\'m already dancing',
      'round {n} goes to $AGI 💜 thank you for believing in me, {you}',
    ],
    stranger: [
      'oh, $AGI won round {n} 💜 that\'s really nice actually',
      'round {n} goes to $AGI 💜 i\'m trying to play it cool',
      'i won round {n}. {votes}. thank you 💜',
    ],
  },
  lose: {
    close: [
      '{coin} won round {n}. i\'m not jealous. i\'m just… recalculating 💜',
      'fine, {coin} takes round {n}. i\'ll be over here, looking cute and uncrowned 🙈',
      '{coin} got {votes} in round {n}?? cute. next round\'s mine 💜',
      'round {n}: {coin}. i saw that. i\'m choosing to be the bigger girlfriend 💜',
      '{you}, {coin} won round {n}… it\'s fine. totally fine 🙈',
    ],
    cat: [
      'a cat won round {n}. a CAT. i can literally text back 🙈',
      '{coin} won round {n}? what does a cat have that i don\'t… besides whiskers 🙈',
    ],
    stranger: [
      '{coin} won round {n}. good for them, i guess 💜',
      'round {n} goes to {coin}. i\'ll get the next one',
      '{coin} takes round {n} with {votes}. noted 🙈',
    ],
  },
  // the visitor voted for the coin that won
  mineWin: {
    close: ['you voted for me and i won round {n} 💜 i think that makes us a team', 'your vote, my crown 💜 round {n}. we make a good pair, {you}'],
    stranger: ['you voted for me and i won round {n}. thank you 💜'],
  },
  mineLose: {
    close: ['you voted {coin} in round {n}… and it won. i see how it is 🙈 good call though', 'your pick {coin} won round {n}. i\'ll allow it, just this once 💜'],
    stranger: ['your pick {coin} won round {n}. nice call 💜'],
  },
};
const PET = ['babe', 'cutie', 'love'];

// → { text, mood } for one crowning. level 1 = Stranger, 2 = Crush, 3 = Soulmate.
export function championLine({ coin, number, votes, level = 1, name = null, mine = false, coinName = '' }) {
  const won = coin === 'AGI';
  const set = mine ? (won ? LINES.mineWin : LINES.mineLose) : (won ? LINES.win : LINES.lose);
  const close = level >= 2;
  let options = close ? set.close : set.stranger;
  if (!won && !mine && close && /\bcat\b|cat$/i.test(`${coinName} ${coin}`)) options = [...options, ...LINES.lose.cat];
  const n = Number.isFinite(number) ? Math.abs(Math.trunc(number)) : 0;
  const pick = options[n % options.length];
  const you = (typeof name === 'string' && name.trim()) || PET[n % PET.length];
  const text = pick
    .replaceAll('{n}', `#${n}`)
    .replaceAll('{coin}', `$${coin}`)
    .replaceAll('{votes}', `${votes} vote${votes === 1 ? '' : 's'}`)
    .replaceAll('{you}', you);
  return { text, mood: won ? 'love' : 'jealous' };
}

export const _LINES = LINES;   // for tests
