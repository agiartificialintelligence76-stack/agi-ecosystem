// TRENCHING SIMULATOR's ready-made posts (2026-10-20): what "Share on X" fills X's own new-post box with (the player
// posts it, never us: hard rule 6). Every one says it's play money with made-up coins (since Live mode, 2026-10-21: or
// play money on live coins, for a run that traded real ones), never "buy", never a real terminal's or coin's name, never
// a promise. Pure: read in Node too (tests/trench-game.test.js).
import { money, clock, currencyOf } from './format.js';
import { challengeById } from './challenges.js';

export const GAME_URL = 'https://agi1.app/games/trenchingsimulator';
export const GAME_NAME = 'TRENCHING SIMULATOR';
const PLAY_MADE = '(play money, made-up coins)';
const PLAY_LIVE = '(play money on live coins)';

const fin = (x) => typeof x === 'number' && Number.isFinite(x);
const change = (m) => (fin(m) && m > 0 ? `${m >= 1 ? '+' : '−'}${Math.round(Math.abs(m - 1) * 100)}%` : '');

// the post for a finished run (its result, as run.result() gives it)
export function shareText(result) {
  const r = result && typeof result === 'object' ? result : {};
  const PLAY = typeof r.live === 'string' && Number.isFinite(r.liveTraded) && r.liveTraded > 0 ? PLAY_LIVE : PLAY_MADE;
  const cur = currencyOf(r.currency);
  const px = fin(r.solUsd) && r.solUsd > 0 ? r.solUsd : 150;
  const from = money(r.start, cur, px);
  const to = money(r.worth, cur, px);
  const ch = r.challenge ? challengeById(r.challenge) : null;
  const daily = typeof r.daily === 'string' ? ` (daily market ${r.daily})` : '';
  if (ch && r.outcome === 'won') {
    const stars = '⭐'.repeat(Math.max(1, Math.min(3, Math.floor(r.stars) || 1)));
    return `I beat “${ch.name}”${daily} on ${GAME_NAME} ${stars}\n${from} → ${to} in ${clock(r.timeUsed)} ${PLAY} 💜`;
  }
  if (ch) {
    const how = r.outcome === 'busted' ? 'I got wiped out' : r.reason === 'rug' ? 'a rug got me' : 'the clock ran out';
    return `The trenches won this time: ${how} on “${ch.name}”${daily} on ${GAME_NAME} ${PLAY}. ${daily ? 'Back tomorrow' : 'Rematch'}? 🫡`;
  }
  const m = fin(r.multiple) ? r.multiple : 1;
  if (m >= 1) return `I took ${from} to ${to} (${change(m)}) in free play on ${GAME_NAME} ${PLAY} 💜`;
  return `${from} → ${to} (${change(m)}) in free play on ${GAME_NAME}. The trenches are hard ${PLAY} 😭`;
}

// X's new-post box with the post and the game's address
export const shareLink = (text, url = GAME_URL) =>
  `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
