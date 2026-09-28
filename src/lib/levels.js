// Relationship levels with AGI-1 (Phase 3). Shared by the page and the server, so both always agree.
// A level depends only on how much $AGI a connected wallet holds (read-only). Owner's choices, 2026-09-24.
// Amounts are whole tokens, so they don't move with the price. Everyone without a wallet is a Stranger.
// Messages a day: 20 / 60 / 150 until 2026-09-26, then 10 / 50 / 150 (the owner's change).
export const LEVELS = [
  { level: 1, name: 'Stranger', min: 0, daily: 10 },          // friendly but a bit distant
  { level: 2, name: 'Crush', min: 10_000, daily: 50 },        // remembers your name
  { level: 3, name: 'Soulmate', min: 1_000_000, daily: 150 }, // remembers past chats, special replies
];

export const levelInfo = (level) => LEVELS.find((l) => l.level === level) || LEVELS[0];

// raw = the token balance in its smallest unit (a BigInt), decimals = the token's decimals (18 for $AGI)
export function levelForBalance(raw, decimals = 18) {
  const unit = 10n ** BigInt(decimals);
  let result = LEVELS[0];
  for (const l of LEVELS) if (raw >= BigInt(l.min) * unit) result = l;
  return result.level;
}

// "12,340" style numbers for the level list
export const fmtTokens = (n) => n.toLocaleString('en-US');
