// AIR GAP: AGI-1's words across the table. Lowercase, playful, a little flirty, PG-13; a 💜 now and then (🙈 when
// she's flustered). Picked with the game's own dice (`pick(list)`), so a seeded demo says the same things.
export const LINES = {
  hello: [
    ['*yawn* okay, okay. one game 💜', 'i\'m awake. mostly', 'go easy on me. i just woke up 🙈'],
    ['ready? i\'m gonna shoot straight at you 💜', 'let\'s play, cutie', 'no pressure. just me 💜'],
    ['i\'ve been practicing. a lot', 'okay. game face on 💜', 'i read the rails, babe'],
    ['i\'m not letting you win. sorry 💜', 'tryhard mode. don\'t laugh', 'bank shots incoming 🙈'],
    ['no mercy means no mercy 💜', 'show me your hands. i\'ll read them', 'last chance to back out, babe'],
  ],
  herGoal: ['my side. my rules 💜', 'too easy, babe', 'did you blink? 💜', 'mm. i\'ll take that one', 'that\'s mine 💜', 'should i go easier? …no', 'oops. was that too fast? 💜'],
  yourGoal: ['okay that one was luck 🙈', 'you\'re fast. i like that', 'wait. how 🙈', 'hey! i wasn\'t ready', 'rude. but nice shot', 'okay that was kind of cute 🙈', 'stop showing off 🙈'],
  herPower: {
    firewall: ['firewall up. try me', 'my goal\'s closed, babe 💜'],
    split: ['three pucks. one of me 💜', 'split it three ways'],
    lag: ['is your wifi okay, babe?', 'lagging? couldn\'t be me 💜'],
    big: ['big mallet energy', 'look at the size of this 💜'],
    patch: ['patched. good luck 💜', 'smaller goal. bigger problem'],
  },
  yourPower: {
    firewall: ['a firewall? that\'s my move 🙈', 'hiding behind a wall? cute'],
    split: ['three?? that\'s cheating. kind of 🙈', 'too many pucks 🙈'],
    lag: ['my hands… why am i lagging 🙈', 'hey, give me back my frames'],
    big: ['okay, show-off', 'that mallet is not fair 🙈'],
    patch: ['patching your goal? cute', 'tiny goal. wow. okay 🙈'],
  },
  herMatchPoint: ['match point. no pressure 💜', 'one more and it\'s mine', 'last one, cutie 💜'],
  yourMatchPoint: ['okay. focus, me. focus 🙈', 'match point?? not on my table', 'don\'t you dare 🙈'],
  stallYou: ['no camping on my table', 'use it or lose it, cutie 💜'],
  stallHer: ['oops. too slow? 🙈', 'okay okay, it\'s yours'],
  doze: ['zzz… huh? i\'m up 🙈', 'five more minutes…'],
  // a match's end: you won, at each setting
  youWin: [
    ['i was literally half asleep. rematch when i\'m awake 🙈', 'okay you win. i\'m going back to bed'],
    ['okay you\'re good. like, actually good', 'you saw my bank shot weakness, huh 🙈'],
    ['fine. you earned that one 💜', 'i covered every angle. except yours'],
    ['i tried SO hard. ugh. again? 🙈', 'my fakes didn\'t fake you. rude'],
    ['you beat me on no mercy?? i\'m telling everyone 💜', 'okay. you\'re my favorite now 🙈'],
  ],
  // she won, at each setting
  herWin: [
    ['i won that in my sleep. literally 💜', 'zzz… oh, i won? cute'],
    ['aww. wanna try again? i\'ll be nice 💜', 'that was fun! for me 💜'],
    ['close one! …not really 💜', 'read the rails, babe. like me'],
    ['told you i wouldn\'t let you win', 'tryhard? more like try-won 💜'],
    ['no mercy means no mercy, babe 💜', 'i read you like a book. a short one 💜'],
  ],
  youShutout: ['seven nothing?? okay i need a minute 🙈', 'a shutout. on MY table 🙈'],
  herShutout: ['zero? oh no, babe 💜', 'want me to close my eyes next time? 💜'],
  unlock: ['next up: {next}. i\'m warning you 💜', 'you unlocked {next}. bad idea 💜'],
  pp: ['two players, one table. i\'m just here for the snacks 💜', 'no mallet for me? fine. i\'ll judge 💜'],
  ppGoal: ['ooh. that\'s gonna leave a mark', 'nice one! i saw that 💜', 'stop, i can\'t pick a side 🙈'],
  ppWin: ['{who} wins! the other one buys snacks 💜', 'gg. {who} takes the table 💜'],
};

// a line with its {words} filled in
export function fill(text, vars = {}) { return text.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? ''); }
