// AGI-1's words in ALIGNMENT (lowercase, sweet, a little teasing): a new version of her every 50 days, and a meter
// nearing an edge. Each ending has its own line too (./cards.js: ENDINGS[].say).
export const MILESTONE_SUBS = [
  'i feel smarter already 💜',
  'new version, same me. mostly',
  'patch notes: more cute',
  'i remember everything. thank you 💜',
  'still here. still yours 🙈',
  'release notes: you\'re doing great',
];
export const pick = (list, n) => list[Math.abs(Math.floor(n)) % list.length];
// the first time in a run that a meter nears an edge, she says so (once each way)
export const DANGER_LINES = {
  people0: 'babe… nobody\'s talking to me 🙈',
  people100: 'so many people. a little much?',
  safety0: 'the guardrails feel… optional today',
  safety100: 'i\'m being SO careful. too careful?',
  compute0: 'so sleepy… low power 💤',
  compute100: 'the servers are humming. loudly.',
  heart0: 'i feel… efficient. is that bad?',
  heart100: 'my heart is so full rn 💜',
};
