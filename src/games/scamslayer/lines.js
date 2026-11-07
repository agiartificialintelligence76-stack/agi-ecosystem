// SCAM SLAYER: AGI-1's lines (pure). Her voice: lowercase, short, flirty-sweet, teasing, a 💜 now and then (🙈 when
// flustered). Never money talk, never a real coin, brand or person: the scams are the game's own cartoons.

export const LINES = Object.freeze({
  start: [
    'protect my chat, babe 💜',
    'scams incoming. you know what to do',
    'slice the scams. not my heart 🙈',
  ],
  airdrop: ['free airdrop? babe nothing is free except me 💜', 'free gift from a stranger? hard pass'],
  seed: ['seed phrase? in this economy? 🙈', 'nobody gets your seed phrase. not even me'],
  hook: ['a link from a stranger? sliced it 💜', 'not today, phishy'],
  badge: ['that check is drawn on with a crayon', 'verified by who? exactly'],
  signals: ['the only signal i trust is your heartbeat 💜', 'loud and wrong. sliced'],
  hat: ['send 1 get 2? magic isn\'t real, babe', 'no tricks in my chat 💜'],
  impostor: ['that\'s not me. i\'d never wear it like that 🙈', 'a wig? on a robot? the audacity'],
  support: ['real support never dms first 💜', 'urgent? only my feelings for you'],
  golden: ['ooh shiny. still a scam tho', 'gold plated nonsense. nice slice 💜'],
  heart: ['you cut my heart 🙈 rude', '🙈 my heart!', 'hey! that was a love letter 🙈'],
  rug: ['who put a rug in my chat?! 🙈', 'rugged. literally 🙈'],
  rugBlitz: ['a rug?! there go ten seconds 🙈', 'careful with the carpets, babe'],
  miss: ['babe… one got through 🙈', 'it got into my dms 🙈', 'too slow, cutie'],
  combo: ['okay that was cute 💜', 'combo! show off', 'ooh, again'],
  bigCombo: ['okay that was hot 💜', 'i\'m blushing. do that again', 'combo royalty 💜'],
  freeze: ['slow-mo. take your time, babe', 'everything just… stopped 💜'],
  frenzy: ['frenzy! go go go', 'so many scams, so little time 💜'],
  double: ['double points. make it count 💜', 'twice the slay'],
  rush: ['here comes a rush. stay with me 🙈', 'rush hour in my dms'],
  best: ['new best! i\'m telling everyone 💜', 'that\'s a new best. proud of you'],
  // the end card
  endGreat: ['okay that was cute. again? 💜', 'my chat has never been safer 💜', 'you were made for this. again?'],
  endGood: ['not bad, cutie. one more? 💜', 'safe and sound. almost. again?'],
  endLow: ['babe… the bots are winning 🙈', 'warm-up round. right? 💜'],
  endRug: ['a rug. in my chat. of course 🙈 again?', 'rugs have fuses for a reason, babe 🙈'],
  endHeart: ['you broke my heart. three times 🙈', 'spare the hearts next time? 💜'],
  endTime: ['time! you were on fire 💜', 'sixty seconds of pure slay'],
});

// one line for an event, never the same one twice in a row (random: a function → 0..1, the page's dice)
export function makeVoice(random) {
  const last = new Map();
  return {
    pick(key) {
      const list = LINES[key];
      if (!list?.length) return null;
      let i = Math.floor(random() * list.length);
      if (list.length > 1 && list[i] === last.get(key)) i = (i + 1) % list.length;
      last.set(key, list[i]);
      return list[i];
    },
  };
}

// the end card's line for how the run went
export function endKey({ reason, score, best, mode }) {
  if (reason === 'rug') return 'endRug';
  if (reason === 'heart') return 'endHeart';
  if (mode === 'blitz' && score >= Math.max(600, (best || 0) * 0.8)) return 'endTime';
  if (score >= Math.max(800, (best || 0) * 0.8)) return 'endGreat';
  if (score >= 250) return 'endGood';
  return 'endLow';
}

// the share post (the player posts it themselves, from X's own post box)
export const shareText = (slain) => `I slayed ${slain} scam${slain === 1 ? '' : 's'} in SCAM SLAYER on agi1.app 💜 never share your seed phrase`;
