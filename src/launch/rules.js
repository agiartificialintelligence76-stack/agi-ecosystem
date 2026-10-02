// "Launch with AGI-1": the launch rules the launch page, her bot and our server share (2026-10-02). Pure.
import { levelInfo, fmtTokens } from '../lib/levels.js';

// The coins a wallet may launch a day (the owner's rule, 2026-10-02: "the more they hold agi", then "if they hold 10,000
// $agi they can launch 5 tokens per wallet and if more more token to launch"): 5 for every 10,000 $AGI it holds or burned
// for messages, 50 at most (100,000+). 10,000 is the chat's Crush (src/lib/levels.js): the least a wallet needs to launch.
// A day is a UTC day; a coin counts once it's got ready, launched or not (supabase/launch.sql).
export const AGI_PER_STEP = levelInfo(2).min;
export const COINS_PER_STEP = 5;
export const LAUNCHES_MAX = 50;
export const launchesADay = (agi) => Math.min(LAUNCHES_MAX, COINS_PER_STEP * Math.floor(Math.max(0, Number(agi) || 0) / AGI_PER_STEP));
export const NEEDED = fmtTokens(AGI_PER_STEP);                                       // "10,000"
const MOST = fmtTokens((AGI_PER_STEP * LAUNCHES_MAX) / COINS_PER_STEP);              // "100,000"
// the rule in words: her bot (server/launch-lines.js) and the page (src/launch/words.js, launch.html) say it the same way
export const PER_DAY = `${COINS_PER_STEP} coins a day for every ${NEEDED} $AGI, up to ${LAUNCHES_MAX} a day with ${MOST}+`;
