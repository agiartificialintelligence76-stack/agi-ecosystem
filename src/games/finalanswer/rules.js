// FINAL ANSWER: pure game-show rules (no DOM, no wall clock, 100% deterministic with seeded RNG).
// Fifteen rungs from 100 to 1,000,000, custom movable 2nd safety net, 4 starting lifelines + unlockable 5th at Q10,
// Stage Hype speed bonus pot, Hot Streak Fever, Walk Away, and three modes: Classic, Daily Show, High Voltage (Blitz).
import { rng } from '../kit/fx.js';
import { QUESTIONS } from './questions.js';

export const LETTERS = Object.freeze(['A', 'B', 'C', 'D']);

// Classic 15-rung ladder up to 1,000,000 points. Rung 5 (index 4) is the guaranteed Base Floor.
// Rungs 7–14 (indices 6–13) are eligible for the player's Custom Safety Net!
export const LADDER = Object.freeze([
  { rung: 1,  value: 100,       short: '100',   tier: 1, baseSafe: false },
  { rung: 2,  value: 200,       short: '200',   tier: 1, baseSafe: false },
  { rung: 3,  value: 300,       short: '300',   tier: 1, baseSafe: false },
  { rung: 4,  value: 500,       short: '500',   tier: 1, baseSafe: false },
  { rung: 5,  value: 1000,      short: '1K',    tier: 1, baseSafe: true  },
  { rung: 6,  value: 2000,      short: '2K',    tier: 2, baseSafe: false },
  { rung: 7,  value: 4000,      short: '4K',    tier: 2, baseSafe: false },
  { rung: 8,  value: 8000,      short: '8K',    tier: 2, baseSafe: false },
  { rung: 9,  value: 16000,     short: '16K',   tier: 2, baseSafe: false },
  { rung: 10, value: 32000,     short: '32K',   tier: 2, baseSafe: false },
  { rung: 11, value: 64000,     short: '64K',   tier: 3, baseSafe: false },
  { rung: 12, value: 125000,    short: '125K',  tier: 3, baseSafe: false },
  { rung: 13, value: 250000,    short: '250K',  tier: 3, baseSafe: false },
  { rung: 14, value: 500000,    short: '500K',  tier: 3, baseSafe: false },
  { rung: 15, value: 1000000,   short: '1M',    tier: 4, baseSafe: false },
].map((r) => Object.freeze(r)));

export const BASE_SAFE_INDEX = 4;        // Rung 5 (1,000)
export const CUSTOM_FLOOR_MIN = 6;       // Rung 7 (4,000)
export const CUSTOM_FLOOR_MAX = 13;      // Rung 14 (500,000)
export const SWAP_UNLOCK_INDEX = 9;      // Clear Rung 10 (32,000) -> unlock SWAP!
export const FEVER_STREAK = 3;           // 3 fast/clean answers ignite Stage Fever

export const MODES = Object.freeze({
  classic: Object.freeze({
    id: 'classic',
    name: 'Classic Show',
    clock: 30,             // soft clock: answering before 0 earns Speed Bonus Pot
    hardClock: false,
    canWalk: true,
    customFloor: true,
    lifelines: Object.freeze(['split', 'chat', 'agi', 'double']),
    unlockSwapAt10: true,
  }),
  daily: Object.freeze({
    id: 'daily',
    name: 'Daily Show',
    clock: 30,
    hardClock: false,
    canWalk: true,
    customFloor: true,
    lifelines: Object.freeze(['split', 'chat', 'agi', 'double']),
    unlockSwapAt10: true,
  }),
  blitz: Object.freeze({
    id: 'blitz',
    name: 'High Voltage',
    clock: 15,             // hard 15 s shot clock: timeout = miss!
    hardClock: true,
    canWalk: false,
    customFloor: false,
    lifelines: Object.freeze(['split', 'double', 'swap']),
    unlockSwapAt10: false,
  }),
});

export const LIFELINE_META = Object.freeze({
  split:  Object.freeze({ id: 'split',  label: '50:50',   short: '50:50', desc: 'Slice two wrong answers off the stage.' }),
  chat:   Object.freeze({ id: 'chat',   label: 'Ask Chat', short: 'Chat',  desc: 'Poll AGI-1’s live studio chat.' }),
  agi:    Object.freeze({ id: 'agi',    label: 'Ask AGI-1', short: 'AGI-1', desc: 'Get AGI-1’s personal hint and pick.' }),
  double: Object.freeze({ id: 'double', label: 'Double Dip', short: '2×',  desc: 'Two shots on one question. No walking away.' }),
  swap:   Object.freeze({ id: 'swap',   label: 'Switch',   short: 'Swap',  desc: 'Swap this question for a fresh one.' }),
});

const CHAT_HANDLES = Object.freeze([
  'mochi_99', 'pixel_kai', 'neon_fox', 'starlight', 'boba_dev', 'cat_nap',
  'violet_v', 'synthwave', 'astro_m', 'lofi_ren', 'honey_bit', 'mint_leaf',
  'arcade_jo', 'moon_tea', 'spark_ai', 'cloud_nine',
]);

// Deterministic FNV-1a 32-bit string hash
export function hashString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function dateKey(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function shortDate(key = dateKey()) {
  const [y, m, d] = key.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[(m || 1) - 1] || 'Jan'} ${d || 1}`;
}

export function dailySeed(key = dateKey()) {
  return hashString(`finalanswer:daily:${key}`) || 1337;
}

// Shuffle a question's 4 answers deterministically and record where the right one landed
export function prepareQuestion(q, dice) {
  const order = [0, 1, 2, 3];
  dice.shuffle(order);
  const options = order.map((idx) => q.a[idx]);
  const correct = order.indexOf(0);
  return {
    id: q.id,
    tier: q.tier,
    cat: q.cat,
    q: q.q,
    options,
    correct,
    hint: q.hint,
    fact: q.fact,
  };
}

// Build a balanced 15-question deck + reserves per tier, preferring unseen questions and avoiding consecutive category repeats
export function buildDeck({ seed, seen = [], pool = QUESTIONS } = {}) {
  const dice = rng((seed >>> 0) || 7);
  const seenSet = new Set(Array.isArray(seen) ? seen : []);
  const byTier = { 1: [], 2: [], 3: [], 4: [] };
  for (const q of pool) {
    if (byTier[q.tier]) byTier[q.tier].push(q);
  }

  // Within each tier, shuffle unseen questions before recently seen ones
  for (const t of [1, 2, 3, 4]) {
    const fresh = byTier[t].filter((q) => !seenSet.has(q.id));
    const old = byTier[t].filter((q) => seenSet.has(q.id));
    dice.shuffle(fresh);
    dice.shuffle(old);
    byTier[t] = [...fresh, ...old];
  }

  const pickOne = (tier, lastCat, agiCount) => {
    const arr = byTier[tier];
    if (!arr.length) return null;
    // Prefer a different category from last question, and cap AGI-1 lore at 2 per run so trivia feels universal
    let idx = arr.findIndex((q) => q.cat !== lastCat && (q.cat !== 'AGI-1' || agiCount < 2));
    if (idx < 0) idx = arr.findIndex((q) => q.cat !== lastCat);
    if (idx < 0) idx = 0;
    return arr.splice(idx, 1)[0];
  };

  const deck = [];
  let lastCat = '';
  let agiCount = 0;
  for (const rung of LADDER) {
    const raw = pickOne(rung.tier, lastCat, agiCount);
    if (!raw) throw new Error(`Not enough questions in tier ${rung.tier}`);
    lastCat = raw.cat;
    if (raw.cat === 'AGI-1') agiCount++;
    deck.push(prepareQuestion(raw, dice));
  }

  // Reserve questions for the Switch lifeline (up to 3 per tier)
  const reserves = { 1: [], 2: [], 3: [], 4: [] };
  for (const t of [1, 2, 3, 4]) {
    while (byTier[t].length && reserves[t].length < 3) {
      reserves[t].push(prepareQuestion(byTier[t].shift(), dice));
    }
  }
  return { deck, reserves };
}

export function createRun({ mode = 'classic', seed = 7, date = dateKey(), seen = [], pool = QUESTIONS, startRung = 0 } = {}) {
  const cfg = MODES[mode] || MODES.classic;
  const runSeed = cfg.id === 'daily' ? dailySeed(date) : ((seed >>> 0) || 7);
  const { deck, reserves } = buildDeck({ seed: runSeed, seen: cfg.id === 'daily' ? [] : seen, pool });
  const lifelines = {};
  for (const k of Object.keys(LIFELINE_META)) {
    lifelines[k] = {
      available: cfg.lifelines.includes(k),
      used: false,
      locked: k === 'swap' && cfg.unlockSwapAt10 && !cfg.lifelines.includes('swap'),
    };
  }
  const clampedStart = Math.max(0, Math.min(LADDER.length - 1, startRung | 0));
  const cleared = clampedStart;
  return {
    mode: cfg.id,
    cfg,
    seed: runSeed,
    date,
    deck,
    reserves,
    index: clampedStart,            // 0..14: current question index
    cleared,                        // number of rungs cleared (0..15)
    baseSafeReached: cleared > BASE_SAFE_INDEX,
    customFloorIndex: null,         // 6..13 once player plants custom safety net
    customFloorLocked: false,       // true once player actually clears customFloorIndex!
    lifelines,
    usedOnQuestion: [],             // lifeline ids used on current question
    eliminated: [],                 // eliminated option indices (0..3) on current question
    armed: null,                    // currently highlighted option index before Final Answer
    doubleActive: false,            // Double Dip armed on this question
    doubleFirstMiss: null,          // index missed on 1st shot of Double Dip
    chatPoll: null,                 // { pct: [a,b,c,d], messages: [{ user, text, pick }] }
    agiAdvice: null,                // { pick, confidence, hint, tone }
    streak: 0,
    bestStreak: 0,
    fever: false,
    speedPot: 0,                    // banked speed/hype bonus points (kept even on walk away or safety net!)
    fastAnswers: 0,
    totalTime: 0,
    swapsDone: 0,
    history: [],                    // per-rung outcomes: { rung, id, cat, outcome: 'ok'|'miss'|'walk'|'timeout', pick, correct, time, speedBonus, lifelines }
    over: false,
    endReason: null,                // 'million' | 'walk' | 'wrong' | 'timeout'
    finalLadder: 0,                 // points won from ladder/floor
    finalScore: 0,                  // finalLadder + speedPot (or streak-boosted in blitz)
    dice: rng((runSeed ^ 0x9e3779b9) >>> 0),
  };
}

export function currentQuestion(run) {
  return run && !run.over ? run.deck[run.index] || null : null;
}

export function currentRung(run) {
  return LADDER[run.index] || LADDER[LADDER.length - 1];
}

// Guaranteed safety-net value if the player misses right now
export function guaranteedValue(run) {
  if (run.customFloorLocked && run.customFloorIndex != null) {
    return LADDER[run.customFloorIndex].value;
  }
  if (run.baseSafeReached) return LADDER[BASE_SAFE_INDEX].value;
  return 0;
}

// Current value if player walks away right now
export function walkValue(run) {
  if (run.cleared <= 0) return 0;
  return LADDER[run.cleared - 1].value;
}

export function canWalkAway(run) {
  return Boolean(run && !run.over && run.cfg.canWalk && run.cleared > 0 && !run.doubleActive);
}

export function canSetCustomFloor(run, targetIndex = run?.index) {
  if (!run || run.over || !run.cfg.customFloor) return false;
  if (run.customFloorIndex != null) return false;
  if (targetIndex < CUSTOM_FLOOR_MIN || targetIndex > CUSTOM_FLOOR_MAX) return false;
  // Must be current rung or a future rung (cannot retroactively plant behind you)
  return targetIndex >= run.index;
}

export function setCustomFloor(run, targetIndex = run.index) {
  if (!canSetCustomFloor(run, targetIndex)) return { ok: false };
  run.customFloorIndex = targetIndex;
  return { ok: true, rung: LADDER[targetIndex] };
}

export function armOption(run, idx) {
  if (!run || run.over) return false;
  if (!Number.isInteger(idx) || idx < 0 || idx > 3) return false;
  if (run.eliminated.includes(idx)) return false;
  run.armed = idx;
  return true;
}

// Speed bonus calculation: fast answers add Stage Hype bonus points to your Bonus Pot!
export function speedBonusFor(rungValue, elapsedSec, cfg, fever = false) {
  const clock = cfg.clock || 30;
  const clamped = Math.max(0, Math.min(clock, elapsedSec || 0));
  const frac = Math.max(0, 1 - clamped / clock);
  if (frac <= 0) return 0;
  // Scaled cleanly: up to 15% of rung value (capped so ladder stays the star, boosted +50% in Fever!)
  const cap = Math.min(rungValue * 0.15, 25000);
  const raw = Math.round((cap * frac * (fever ? 1.5 : 1)) / 10) * 10;
  return Math.max(10, raw);
}

// Blitz multiplier grows with streak: 1.0x -> 1.25x -> 1.5x -> 2.0x -> 2.5x -> 3.0x
export function blitzMultiplier(streak) {
  if (streak >= 10) return 3;
  if (streak >= 7) return 2.5;
  if (streak >= 5) return 2;
  if (streak >= 3) return 1.5;
  if (streak >= 2) return 1.25;
  return 1;
}

function resetQuestionState(run) {
  run.usedOnQuestion = [];
  run.eliminated = [];
  run.armed = null;
  run.doubleActive = false;
  run.doubleFirstMiss = null;
  run.chatPoll = null;
  run.agiAdvice = null;
}

// Activate one of the 5 lifelines on the current question
export function useLifeline(run, kind) {
  if (!run || run.over) return { ok: false, why: 'over' };
  const slot = run.lifelines[kind];
  if (!slot || !slot.available || slot.used || slot.locked) return { ok: false, why: 'unavailable' };
  const q = currentQuestion(run);
  if (!q) return { ok: false, why: 'none' };

  const liveIndices = [0, 1, 2, 3].filter((i) => !run.eliminated.includes(i));

  if (kind === 'split') {
    const wrongs = liveIndices.filter((i) => i !== q.correct);
    if (wrongs.length < 2) return { ok: false, why: 'too_few' };
    run.dice.shuffle(wrongs);
    const removed = wrongs.slice(0, 2);
    run.eliminated.push(...removed);
    if (removed.includes(run.armed)) run.armed = null;
    slot.used = true;
    run.usedOnQuestion.push('split');
    return { ok: true, kind: 'split', removed };
  }

  if (kind === 'double') {
    if (run.doubleActive) return { ok: false, why: 'active' };
    slot.used = true;
    run.doubleActive = true;
    run.usedOnQuestion.push('double');
    return { ok: true, kind: 'double' };
  }

  if (kind === 'swap') {
    const reserve = run.reserves[q.tier]?.shift();
    if (!reserve) return { ok: false, why: 'empty' };
    slot.used = true;
    run.swapsDone++;
    run.deck[run.index] = reserve;
    // Reset question-local clues/eliminations, keep doubleActive only if player didn't burn it (reset cleanly)
    const keepDouble = run.doubleActive;
    resetQuestionState(run);
    if (keepDouble) run.doubleActive = true;
    run.usedOnQuestion.push('swap');
    return { ok: true, kind: 'swap', question: reserve };
  }

  if (kind === 'chat') {
    slot.used = true;
    run.usedOnQuestion.push('chat');
    const poll = generateChatPoll(q, liveIndices, run.dice);
    run.chatPoll = poll;
    return { ok: true, kind: 'chat', poll };
  }

  if (kind === 'agi') {
    slot.used = true;
    run.usedOnQuestion.push('agi');
    const advice = generateAgiAdvice(q, liveIndices, run.dice);
    run.agiAdvice = advice;
    return { ok: true, kind: 'agi', advice };
  }

  return { ok: false, why: 'unknown' };
}

function generateChatPoll(q, liveIndices, dice) {
  // Accuracy tapers realistically as rungs get harder
  const accByTier = { 1: 0.88, 2: 0.74, 3: 0.58, 4: 0.46 };
  const crowdCorrect = dice.next() < (accByTier[q.tier] ?? 0.65);
  const wrongLive = liveIndices.filter((i) => i !== q.correct);
  const leader = crowdCorrect || !wrongLive.length ? q.correct : dice.pick(wrongLive);

  // Raw weights for live options
  const weights = [0, 0, 0, 0];
  for (const idx of liveIndices) {
    if (idx === leader) {
      const base = q.tier === 1 ? 62 : q.tier === 2 ? 48 : q.tier === 3 ? 38 : 34;
      weights[idx] = base + dice.int(4, 18);
    } else if (idx === q.correct) {
      // Even when crowd picks wrong leader, correct answer gets a strong runner-up push
      weights[idx] = 24 + dice.int(4, 14);
    } else {
      weights[idx] = 6 + dice.int(2, 16);
    }
  }
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const pct = weights.map((w) => Math.round((w / sum) * 100));
  // Adjust rounding drift on the leading option so percentages sum cleanly to 100
  const diff = 100 - pct.reduce((a, b) => a + b, 0);
  pct[leader] += diff;

  // Build 5 lively studio-chat messages matching the poll distribution
  const handles = [...CHAT_HANDLES];
  dice.shuffle(handles);
  const confidentLines = [
    (L) => `100% ${L}, lock it in!!`,
    (L) => `spam ${L} in chat`,
    (L) => `definitely ${L}, trust`,
    (L) => `easy ${L} let's gooo`,
  ];
  const splitLines = [
    (L) => `pretty sure it's ${L}?`,
    (L) => `wait no, I think ${L}`,
    (L) => `my gut says ${L}`,
    (L) => `hmm maybe ${L} tbh`,
  ];
  const sorted = [...liveIndices].sort((a, b) => pct[b] - pct[a]);
  const top = sorted[0];
  const second = sorted[1] ?? top;
  const picks = [top, top, second, top, sorted[sorted.length - 1] ?? second];
  const messages = picks.map((p, i) => {
    const bank = p === top ? confidentLines : splitLines;
    return {
      user: handles[i % handles.length],
      pick: p,
      text: bank[(i + dice.int(0, 3)) % bank.length](LETTERS[p]),
    };
  });
  return { pct, messages, leader };
}

function generateAgiAdvice(q, liveIndices, dice) {
  // AGI-1 is smarter than chat, and tells you honestly how confident she feels
  const accByTier = { 1: 0.96, 2: 0.86, 3: 0.74, 4: 0.66 };
  const right = dice.next() < (accByTier[q.tier] ?? 0.75);
  const wrongLive = liveIndices.filter((i) => i !== q.correct);
  const pick = right || !wrongLive.length ? q.correct : dice.pick(wrongLive);
  let confidence;
  if (q.tier === 1) confidence = right ? dice.int(91, 98) : dice.int(64, 76);
  else if (q.tier === 2) confidence = right ? dice.int(80, 93) : dice.int(58, 72);
  else if (q.tier === 3) confidence = right ? dice.int(68, 86) : dice.int(52, 68);
  else confidence = right ? dice.int(62, 82) : dice.int(48, 64);

  const tone = confidence >= 85 ? 'sure' : confidence >= 68 ? 'leaning' : 'guess';
  // Only give her crisp factual hint when she's leaning on the right answer; when genuinely stumped, she admits she's torn!
  const note = right
    ? `${q.hint} — i'm going with ${LETTERS[pick]} (${confidence}% sure) 💜`
    : `oof this one's tough... my circuits are split, maybe ${LETTERS[pick]}? only ${confidence}% sure tho`;
  return { pick, confidence, tone, note, right };
}

// Lock in the player's Final Answer!
export function lockAnswer(run, idx, elapsedSec = 5) {
  if (!run || run.over) return { ok: false, why: 'over' };
  if (!Number.isInteger(idx) || idx < 0 || idx > 3) return { ok: false, why: 'bad' };
  if (run.eliminated.includes(idx)) return { ok: false, why: 'eliminated' };

  const q = currentQuestion(run);
  const rung = currentRung(run);
  const time = Math.max(0, Math.round(elapsedSec * 10) / 10);
  run.armed = idx;

  // Correct answer!
  if (idx === q.correct) {
    run.cleared = run.index + 1;
    run.streak++;
    if (run.streak > run.bestStreak) run.bestStreak = run.streak;
    run.totalTime += time;

    const wasFever = run.fever;
    const isFast = time <= run.cfg.clock * 0.5;
    if (isFast) run.fastAnswers++;
    if (run.streak >= FEVER_STREAK) run.fever = true;
    const ignitedFever = !wasFever && run.fever;

    const bonus = speedBonusFor(rung.value, time, run.cfg, run.fever);
    run.speedPot += bonus;

    let milestone = null;
    if (run.index === BASE_SAFE_INDEX) {
      run.baseSafeReached = true;
      milestone = 'base_safe';
    }
    if (run.customFloorIndex === run.index) {
      run.customFloorLocked = true;
      milestone = 'custom_safe';
    }
    let unlockedSwap = false;
    if (run.index === SWAP_UNLOCK_INDEX && run.cfg.unlockSwapAt10 && run.lifelines.swap.locked) {
      run.lifelines.swap.locked = false;
      run.lifelines.swap.available = true;
      unlockedSwap = true;
    }

    run.history.push({
      rung: rung.rung,
      id: q.id,
      cat: q.cat,
      outcome: 'ok',
      pick: idx,
      correct: q.correct,
      time,
      speedBonus: bonus,
      lifelines: [...run.usedOnQuestion],
    });

    const wonMillion = run.index === LADDER.length - 1;
    if (wonMillion) {
      finishRun(run, 'million', LADDER[LADDER.length - 1].value);
    }

    return {
      ok: true,
      result: wonMillion ? 'million' : 'correct',
      pick: idx,
      correct: q.correct,
      rung,
      fact: q.fact,
      speedBonus: bonus,
      streak: run.streak,
      fever: run.fever,
      ignitedFever,
      milestone,
      unlockedSwap,
    };
  }

  // Wrong answer while Double Dip is active (1st miss -> second chance!)
  if (run.doubleActive && run.doubleFirstMiss == null) {
    run.doubleFirstMiss = idx;
    run.eliminated.push(idx);
    run.armed = null;
    run.streak = 0;
    run.fever = false;
    return {
      ok: true,
      result: 'double_miss',
      pick: idx,
      rung,
    };
  }

  // Final wrong answer -> drop to highest guaranteed floor
  run.streak = 0;
  run.fever = false;
  run.totalTime += time;
  run.history.push({
    rung: rung.rung,
    id: q.id,
    cat: q.cat,
    outcome: 'miss',
    pick: idx,
    correct: q.correct,
    time,
    speedBonus: 0,
    lifelines: [...run.usedOnQuestion],
  });
  const floorVal = guaranteedValue(run);
  finishRun(run, 'wrong', floorVal);
  return {
    ok: true,
    result: 'wrong',
    pick: idx,
    correct: q.correct,
    rung,
    fact: q.fact,
    floorValue: floorVal,
  };
}

// Advance to the next rung after a correct answer reveal
export function advanceRung(run) {
  if (!run || run.over) return false;
  if (run.index >= LADDER.length - 1) return false;
  run.index++;
  resetQuestionState(run);
  return true;
}

// Walk Away with current cleared winnings + Speed Bonus Pot
export function walkAway(run) {
  if (!canWalkAway(run)) return { ok: false, why: 'cannot_walk' };
  const q = currentQuestion(run);
  const rung = currentRung(run);
  const haul = walkValue(run);
  run.history.push({
    rung: rung.rung,
    id: q.id,
    cat: q.cat,
    outcome: 'walk',
    pick: null,
    correct: q.correct,
    time: 0,
    speedBonus: 0,
    lifelines: [...run.usedOnQuestion],
  });
  finishRun(run, 'walk', haul);
  return {
    ok: true,
    result: 'walk',
    haul,
    correct: q.correct,
    fact: q.fact,
    rung,
  };
}

// Timeout in High Voltage (Blitz) mode
export function timeoutQuestion(run) {
  if (!run || run.over || !run.cfg.hardClock) return { ok: false };
  const q = currentQuestion(run);
  const rung = currentRung(run);
  run.streak = 0;
  run.fever = false;
  run.totalTime += run.cfg.clock;
  run.history.push({
    rung: rung.rung,
    id: q.id,
    cat: q.cat,
    outcome: 'timeout',
    pick: null,
    correct: q.correct,
    time: run.cfg.clock,
    speedBonus: 0,
    lifelines: [...run.usedOnQuestion],
  });
  const floorVal = guaranteedValue(run);
  finishRun(run, 'timeout', floorVal);
  return {
    ok: true,
    result: 'timeout',
    correct: q.correct,
    fact: q.fact,
    floorValue: floorVal,
    rung,
  };
}

function finishRun(run, reason, ladderVal) {
  run.over = true;
  run.endReason = reason;
  run.finalLadder = ladderVal;
  if (run.mode === 'blitz') {
    const mult = blitzMultiplier(run.bestStreak);
    run.finalScore = Math.round(ladderVal * mult + run.speedPot);
  } else {
    run.finalScore = ladderVal + run.speedPot;
  }
}

export function lifelinesRemaining(run) {
  return Object.values(run.lifelines).filter((s) => s.available && !s.used && !s.locked).length;
}

export function summary(run) {
  const answered = run.history.filter((h) => h.outcome === 'ok').length;
  const usedLifelines = Object.values(run.lifelines).filter((s) => s.used).length;
  const avgTime = answered > 0 ? run.totalTime / answered : 0;
  return {
    mode: run.mode,
    reason: run.endReason,
    cleared: run.cleared,
    ladder: run.finalLadder,
    speedPot: run.speedPot,
    score: run.finalScore,
    bestStreak: run.bestStreak,
    usedLifelines,
    avgTime: Math.round(avgTime * 10) / 10,
    wonMillion: run.endReason === 'million',
  };
}

// Wordle-style share grid for Daily Show & Classic Show!
export function shareGrid(run) {
  const cells = [];
  for (let i = 0; i < LADDER.length; i++) {
    const h = run.history[i];
    if (!h) {
      cells.push('⬛');
    } else if (h.outcome === 'ok') {
      if (i === LADDER.length - 1) cells.push('👑');
      else if (i === BASE_SAFE_INDEX || i === run.customFloorIndex) cells.push('⭐');
      else cells.push('🟩');
    } else if (h.outcome === 'walk') {
      cells.push('🟨');
    } else {
      cells.push('🟥');
    }
  }
  return `${cells.slice(0, 5).join('')} ${cells.slice(5, 10).join('')} ${cells.slice(10, 15).join('')}`;
}

export function shareText(run) {
  const s = summary(run);
  const grid = shareGrid(run);
  const haul = s.score.toLocaleString('en-US');
  if (run.mode === 'daily') {
    const tag = s.wonMillion ? '1,000,000 CROWN 👑' : `Rung ${s.cleared}/15 · ${haul} pts`;
    return `FINAL ANSWER Daily (${shortDate(run.date)}) · ${tag}\n${grid}\nCan you beat AGI-1’s hot seat? 💜`;
  }
  if (s.wonMillion) {
    return `I conquered all 15 rungs and hit ${haul} pts in FINAL ANSWER on agi1.app 👑💜\n${grid}`;
  }
  return `I reached Rung ${s.cleared}/15 (${haul} pts) in FINAL ANSWER on agi1.app 💜\n${grid}`;
}

// Keep persistent local stats tidy
export function cleanStats(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  return {
    runs: Number.isFinite(s.runs) ? Math.max(0, s.runs | 0) : 0,
    wins: Number.isFinite(s.wins) ? Math.max(0, s.wins | 0) : 0,
    bestRung: Number.isFinite(s.bestRung) ? Math.max(0, Math.min(15, s.bestRung | 0)) : 0,
    answered: Number.isFinite(s.answered) ? Math.max(0, s.answered | 0) : 0,
    bestStreak: Number.isFinite(s.bestStreak) ? Math.max(0, s.bestStreak | 0) : 0,
    seen: Array.isArray(s.seen) ? s.seen.slice(-90) : [],
    daily: s.daily && typeof s.daily === 'object' ? s.daily : {},
  };
}

export function recordRunStats(stats, run) {
  const next = cleanStats(stats);
  const s = summary(run);
  next.runs++;
  if (s.wonMillion) next.wins++;
  if (s.cleared > next.bestRung) next.bestRung = s.cleared;
  next.answered += run.history.filter((h) => h.outcome === 'ok').length;
  if (s.bestStreak > next.bestStreak) next.bestStreak = s.bestStreak;
  const newlySeen = run.history.map((h) => h.id).filter(Boolean);
  const merged = [...next.seen.filter((id) => !newlySeen.includes(id)), ...newlySeen];
  next.seen = merged.slice(-90);
  if (run.mode === 'daily') {
    const prev = next.daily[run.date];
    if (!prev || s.score > prev.score) {
      next.daily[run.date] = { score: s.score, cleared: s.cleared, won: s.wonMillion };
    }
    // Keep last 30 daily entries
    const keys = Object.keys(next.daily).sort().slice(-30);
    next.daily = Object.fromEntries(keys.map((k) => [k, next.daily[k]]));
  }
  return next;
}
