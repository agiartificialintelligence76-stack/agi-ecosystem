// FINAL ANSWER: AGI-1's game-show host lines (lowercase, playful, warm, 💜 now and then, PG-13, never money talk).

export const LINES = Object.freeze({
  welcome: Object.freeze([
    'welcome to the hot seat! fifteen rungs to a million 💜',
    'spotlights are warm, chat is watching. ready to climb?',
    'fifteen questions stand between you and the million-point crown ✨',
  ]),
  blitzWelcome: Object.freeze([
    'high voltage mode! fifteen seconds on the clock — no walking away ⚡',
    'fast hands, sharp mind. let’s see how high you burn the ladder 🔥',
  ]),
  arm: Object.freeze([
    'locking that in? tap again for your final answer ✨',
    'is that your final answer? tap once more to lock it',
    'ooh bold choice... final answer?',
    'feeling good about that one? tap again to lock',
  ]),
  suspense: Object.freeze([
    'final answer locked... lights down...',
    'holding my breath right here with you...',
    'let’s see if the studio lights turn mint...',
    'locked in! drumroll please...',
  ]),
  highSuspense: Object.freeze([
    'high stakes now... the whole studio just went quiet...',
    'everything on the line. let’s check the board...',
    'my heart is racing and i don’t even have one 💜',
  ]),
  millionSuspense: Object.freeze([
    'for one million points... final answer locked... 👑',
    'one answer away from legend status. lights down...',
  ]),
  correctLow: Object.freeze([
    'clean! right up the ladder we go 💜',
    'easy warm-up! next rung!',
    'spot on! you make that look effortless',
    'mint lights! keep rolling ✨',
  ]),
  correctMid: Object.freeze([
    'sharp!! the crowd is loving this run 💜',
    'nailed it! your streak is heating up',
    'big brain energy right there ✨',
    'locked and loaded — climbing higher!',
  ]),
  correctHigh: Object.freeze([
    'UNREAL!! how did you pull that one out?! 💜',
    'nerves of steel in the hot seat ✨',
    'the studio just lost its mind!! keep going!',
    'cold-blooded accuracy on a huge rung 🔥',
  ]),
  baseSafe: Object.freeze([
    '1,000 floor locked! you cannot leave empty-handed now 💜',
    'base safety net secured! now the real show begins ✨',
  ]),
  customSafe: Object.freeze([
    'CUSTOM FLOOR LOCKED!! that massive cushion is yours forever 🛡️',
    'brilliant call planting your shield right there!!',
  ]),
  swapUnlocked: Object.freeze([
    'rung 10 cleared!! bonus SWITCH lifeline unlocked for the final stretch ⚡',
  ]),
  fever: Object.freeze([
    'STAGE FEVER!! speed bonus boosted ×1.5 🔥',
    'three in a row — the whole studio just went overdrive ⚡',
  ]),
  split: Object.freeze([
    '50:50 lasers fired! two decoys gone ✨',
    'sliced the board in half — way cleaner now',
  ]),
  chat: Object.freeze([
    'live chat poll is in! trust the hive mind... or don’t 👀',
    'chat has spoken — read those bars carefully!',
  ]),
  doubleOn: Object.freeze([
    'double dip active! two shots on this one — no walking away now ⚡',
  ]),
  doubleMiss: Object.freeze([
    'shield took the hit!! you still have one final shot — breathe!',
    'oof that cracked the shield! pick carefully for shot number two',
  ]),
  swap: Object.freeze([
    'fresh question coming down the chute! clean slate ✨',
  ]),
  floorPlanted: Object.freeze([
    'safety shield armed! clear this rung and that floor is locked 🛡️',
  ]),
  wrong: Object.freeze([
    'aww, so close! at least we learned a wild fact 💜',
    'tough break under the spotlights — rematch?',
    'oof that one was sneaky! shake it off and climb back up',
  ]),
  timeout: Object.freeze([
    'buzzer beat you!! high voltage takes no prisoners ⚡',
    'clock hit zero! that timer is ruthless',
  ]),
  walk: Object.freeze([
    'smart play banking the haul! let’s peek at what it was 👀',
    'walking out with style — wise call under pressure 💜',
  ]),
  millionWin: Object.freeze([
    'ONE MILLION POINTS!! YOU ACTUALLY CONQUERED THE HOT SEAT!! 👑💜',
    'FIFTEEN FOR FIFTEEN!! confetti everywhere, absolute trivia royalty 👑✨',
  ]),
  endMillion: Object.freeze([
    'fifteen out of fifteen! i’m framing your scoreboard on my wall 👑💜',
    'you beat the whole million-point ladder! nobody can top that run ✨',
  ]),
  endWalk: Object.freeze([
    'clean exit with a huge haul! think you could have gone one rung higher? 👀💜',
    'knowing when to bank is half the art of the hot seat ✨',
  ]),
  endHigh: Object.freeze([
    'that deep-ladder climb was electric! one more show and the crown is yours 💜',
    'you pushed into the high-stakes spotlight like a pro ✨',
  ]),
  endMid: Object.freeze([
    'solid climb past the safety net! save a lifeline for the top five next run 💜',
    'good warm-up in the hot seat — ready to beat that rung?',
  ]),
  endEarly: Object.freeze([
    'hey, even legends stumble on a curveball! hop back in the chair 💜',
    'spotlights are still warm — round two is yours ✨',
  ]),
});

export function pickLine(list, dice) {
  if (!list || !list.length) return '';
  const i = Math.floor((dice ? dice.next() : Math.random()) * list.length);
  return list[i % list.length];
}

export function endLineFor(sum, dice) {
  if (sum.wonMillion) return pickLine(LINES.endMillion, dice);
  if (sum.reason === 'walk') return pickLine(LINES.endWalk, dice);
  if (sum.cleared >= 10) return pickLine(LINES.endHigh, dice);
  if (sum.cleared >= 5) return pickLine(LINES.endMid, dice);
  return pickLine(LINES.endEarly, dice);
}
