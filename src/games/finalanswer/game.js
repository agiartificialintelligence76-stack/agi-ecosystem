// FINAL ANSWER: AGI-1's late-night game show on agi1.app/games/finalanswer.
// Built on the arcade kit (src/games/kit/): top bar, title, pause, how-to, end card, local saves, sound & play counter.
// All timers run inside createLoop(update) so pausing and ?demo capture stay 100% deterministic.
import './style.css';
import { createShell, el } from '../kit/shell.js';
import { createLoop } from '../kit/loop.js';
import { keyboard } from '../kit/input.js';
import { DEMO, SEED, REDUCED } from '../kit/env.js';
import { fmt, rng } from '../kit/fx.js';
import {
  LADDER, LETTERS,
  createRun, currentQuestion, currentRung, armOption, lockAnswer, advanceRung,
  useLifeline, setCustomFloor, walkAway, timeoutQuestion,
  summary, shareText, shareGrid, cleanStats, recordRunStats, dateKey, shortDate,
} from './rules.js';
import { LINES, pickLine, endLineFor } from './lines.js';
import { createSound } from './sound.js';
import { createStudioRenderer } from './render.js';
import { createUI, titleStatsNode } from './ui.js';
import { createDemoBot } from './ai.js';

const root = document.getElementById('ak-root');
const shell = createShell({
  game: 'finalanswer',
  name: 'FINAL ANSWER',
  root,
  howTo: {
    intro: 'Climb fifteen trivia rungs from 100 to 1,000,000 with AGI-1 hosting from the hot seat.',
    steps: [
      ['Lock your Final Answer', 'Tap an option once to highlight it, then tap it again (or press Final Answer) to lock it in.'],
      ['Plant your 2nd Safety Net', 'Rung 5 (1,000) is your built-in floor. From Rung 7 to 14, plant your custom shield anywhere on the ladder — clear that rung to lock it forever.'],
      ['Use 4+ Lifelines', '50:50 slices two decoys, Ask Chat polls AGI-1’s live audience, Ask AGI-1 gives her personal clue, and Double Dip gives you two shots. Clear Rung 10 to unlock Switch!'],
      ['Beat the Clock for Stage Fever', 'Quick answers fill your Speed Bonus Pot (kept even if you walk away). Nail 3 in a row to ignite Stage Fever (×1.5 speed bonus).'],
      ['Walk Away or Go All-In', 'Bank your cleared haul anytime before locking in (except during Double Dip or High Voltage mode).'],
    ],
    touch: [['Tap once', 'Highlight option'], ['Tap again', 'Lock Final Answer'], ['Ladder button', 'Peek ladder & plant floor']],
    keys: [['A–D or 1–4', 'Highlight / lock option'], ['Enter · Space', 'Lock in / Next rung'], ['5 · 6 · 7 · 8 · 9', 'Use lifelines'], ['F · W · L', 'Set floor · Walk · Ladder'], ['Esc · P', 'Pause']],
  },
  onPause: () => { sound.stopMusic(); },
  onResume: () => { if (phase === 'ask' || phase === 'lock') sound.startMusic(currentRung(run)?.tier || 1); },
  onRestart: () => startShow(mode),
  onQuit: () => toTitle(),
});

// ---------- STUDIO CANVAS & UI ----------
const canvas = el('canvas', { class: 'fa-canvas', 'aria-hidden': 'true' });
shell.stage.append(canvas);
const studio = createStudioRenderer(canvas);
const sound = createSound(shell.audio);

const rungChip = shell.chip('Rung', '1/15');
const haulChip = shell.chip('Haul', 0, { accent: true });
const streakChip = shell.chip('Streak', 0);

let stats = cleanStats(shell.store.read().stats);
let mode = 'classic';
let run = null;
let phase = 'title';        // title | ask | lock | reveal | over
let elapsed = 0;            // seconds spent on current question
let lockTimer = 0;          // countdown during Final Answer suspense
let lockDur = 1.0;
let pendingPick = null;
let revealData = null;
let revealTimer = 0;
let lastTickSec = 99;
let demoRuns = 0;
let demoBot = null;
let demoPlan = null;

const lineDice = DEMO ? rng(((SEED || 7) * 97 + 13) >>> 0) : null;
const say = (list) => pickLine(list, lineDice);

const ui = createUI(shell.stage, {
  onOption: (idx) => handleOptionTap(idx),
  onConfirm: () => handleConfirmLock(),
  onLifeline: (id) => handleLifeline(id),
  onSetFloor: () => handleSetFloor(run?.index),
  onLadderPick: (idx) => handleSetFloor(idx),
  onWalk: () => handleWalkAway(),
  onNext: () => handleNext(),
});

// ---------- HUD ----------
function syncChips() {
  if (!run) return;
  const r = currentRung(run);
  rungChip.set(`${r.rung}/15`);
  const banked = run.over ? run.finalScore : (run.cleared > 0 ? LADDER[run.cleared - 1].value : 0) + run.speedPot;
  haulChip.set(banked);
  streakChip.set(run.streak);
  streakChip.hide(run.streak <= 0 && !run.fever);
}

// ---------- TITLE SCREEN ----------
function toTitle() {
  phase = 'title';
  run = null;
  revealData = null;
  pendingPick = null;
  sound.stopMusic();
  studio.setMood('idle');
  studio.setTier(2);
  studio.setFever(false);
  ui.show(false);

  stats = cleanStats(shell.store.read().stats);
  const today = dateKey();
  const dailyDone = stats.daily?.[today];
  const best = shell.store.best('best');

  shell.title({
    logo: ['FINAL', { text: 'ANSWER', tone: 'accent' }],
    tagline: 'Fifteen rungs to a million. Plant your safety net, trust AGI-1, and lock it in.',
    hidePlay: true,
    modes: [
      {
        label: 'Classic Show',
        sub: best ? `15 rungs · best ${fmt(best)}` : '15 rungs · 4 lifelines · custom floor',
        onClick: () => startShow('classic'),
      },
      {
        label: 'Daily Show',
        sub: dailyDone ? `${shortDate(today)} · best ${fmt(dailyDone.score)}` : `${shortDate(today)} · same 15 for all`,
        onClick: () => startShow('daily'),
      },
      {
        label: 'High Voltage',
        sub: '15s clock · streak ×3 · no walk',
        onClick: () => startShow('blitz'),
      },
    ],
    onPlay: () => startShow('classic'),
    best: null,
    extra: titleStatsNode(stats),
  });
}

// ---------- START A SHOW ----------
function startShow(nextMode = 'classic') {
  mode = nextMode;
  const seed = DEMO
    ? (((SEED || 7) * 7919 + demoRuns * 211) >>> 0)
    : ((Math.random() * 2 ** 31) >>> 0);
  run = createRun({
    mode: DEMO ? 'classic' : mode,
    seed,
    date: dateKey(),
    seen: DEMO ? [] : stats.seen,
    startRung: DEMO ? 6 : 0,   // ?demo opens mid-ladder on Q7 (4,000) with rich studio lights!
  });
  if (DEMO) {
    run.streak = 2;
    run.bestStreak = 2;
    run.speedPot = 840;
    run.baseSafeReached = true;
    demoBot = createDemoBot((SEED || 7) + demoRuns * 17);
  }

  studio.clear();
  shell.started();
  ui.show(true);
  beginQuestion({ intro: true });
}

function beginQuestion({ intro = false } = {}) {
  phase = 'ask';
  elapsed = 0;
  lockTimer = 0;
  pendingPick = null;
  revealData = null;
  revealTimer = 0;
  lastTickSec = 99;

  const rung = currentRung(run);
  studio.setTier(rung.tier);
  studio.setMood('play');
  studio.setFever(run.fever);
  sound.setTier(rung.tier);
  sound.setFever(run.fever);
  sound.setSuspense(false);
  if (!DEMO) {
    sound.startMusic(rung.tier);
    sound.unveil(rung.tier);
  }

  if (intro) {
    ui.setHost(run.mode === 'blitz' ? say(LINES.blitzWelcome) : say(LINES.welcome), 'idle');
  } else if (rung.rung === 15) {
    ui.setHost('question fifteen... ONE MILLION POINTS on the board!! 👑', 'suspense');
  } else if (rung.rung === 11) {
    ui.setHost('top five territory now! spotlights are blazing ✨', 'idle');
  } else {
    ui.setHost(`rung ${rung.rung} for ${fmt(rung.value)} points — take your time 💜`, 'idle');
  }

  ui.setClock(1, run.cfg.clock, false, !run.cfg.hardClock);
  ui.renderRun(run, phase);
  syncChips();

  if (DEMO && demoBot) {
    demoPlan = demoBot.plan(run);
  }
}

// ---------- PLAYER ACTIONS ----------
function handleOptionTap(idx) {
  if (phase !== 'ask' || !run || run.eliminated.includes(idx)) return;
  if (run.armed === idx) {
    handleConfirmLock();
    return;
  }
  if (armOption(run, idx)) {
    sound.arm(idx);
    shell.haptic(8);
    ui.setHost(say(LINES.arm), 'idle');
    ui.renderRun(run, phase);
  }
}

function handleConfirmLock() {
  if (phase !== 'ask' || !run || run.armed == null) return;
  pendingPick = run.armed;
  phase = 'lock';
  const rung = currentRung(run);
  lockDur = DEMO ? 0.55 : REDUCED ? 0.35 : (rung.tier === 4 ? 1.85 : rung.tier === 3 ? 1.45 : rung.tier === 2 ? 1.15 : 0.85);
  lockTimer = lockDur;

  studio.setMood('suspense');
  studio.pulseRing('#ff9f1c');
  sound.setSuspense(true);
  sound.lockIn(rung.tier);
  shell.haptic(14);

  const line = rung.tier === 4 ? say(LINES.millionSuspense) : rung.tier === 3 ? say(LINES.highSuspense) : say(LINES.suspense);
  ui.setHost(line, 'suspense');
  ui.renderRun(run, phase);
}

function resolveLock() {
  if (phase !== 'lock' || pendingPick == null || !run) return;
  const idx = pendingPick;
  pendingPick = null;
  const res = lockAnswer(run, idx, elapsed);
  sound.setSuspense(false);

  if (!res.ok) { phase = 'ask'; ui.renderRun(run, phase); return; }

  // Double Dip saved the player on their first miss!
  if (res.result === 'double_miss') {
    phase = 'ask';
    studio.setMood('play');
    studio.pulseRing('#ff4da6');
    sound.doubleCrack();
    shell.haptic([18, 30, 18]);
    shell.toast('SHIELD SAVED YOU — 1 SHOT LEFT!', 'warn', 1900);
    ui.setHost(say(LINES.doubleMiss), 'bad');
    ui.renderRun(run, phase);
    syncChips();
    return;
  }

  phase = 'reveal';
  revealData = res;
  revealTimer = 0;

  if (res.result === 'million') {
    studio.burstCorrect(true);
    sound.stopMusic();
    sound.million();
    shell.haptic([24, 40, 24, 40, 40]);
    shell.toast('1,000,000 CROWN!! 👑', 'good', 2600);
    ui.setHost(say(LINES.millionWin), 'million');
  } else if (res.result === 'correct') {
    const isMilestone = Boolean(res.milestone || res.unlockedSwap);
    studio.burstCorrect(isMilestone);
    studio.setFever(run.fever);
    sound.setFever(run.fever);
    if (isMilestone) sound.milestone(); else sound.correct(res.rung.tier);
    shell.haptic(isMilestone ? [14, 28, 16] : 12);

    if (res.milestone === 'custom_safe') {
      shell.toast(`CUSTOM FLOOR LOCKED: ${fmt(res.rung.value)} 🛡️`, 'good', 2200);
      ui.setHost(say(LINES.customSafe), 'good');
    } else if (res.milestone === 'base_safe') {
      shell.toast('1,000 SAFETY FLOOR LOCKED ★', 'good', 2000);
      ui.setHost(say(LINES.baseSafe), 'good');
    } else if (res.unlockedSwap) {
      shell.toast('SWITCH LIFELINE UNLOCKED ⚡', 'good', 2200);
      ui.setHost(say(LINES.swapUnlocked), 'good');
    } else if (res.ignitedFever) {
      sound.fever();
      shell.toast('STAGE FEVER ×1.5 🔥', 'good', 1800);
      ui.setHost(say(LINES.fever), 'good');
    } else {
      const bank = res.rung.tier >= 3 ? LINES.correctHigh : res.rung.tier === 2 ? LINES.correctMid : LINES.correctLow;
      ui.setHost(say(bank), 'good');
    }
  } else {
    studio.burstWrong();
    sound.stopMusic();
    sound.wrong();
    shell.haptic([30, 40, 30]);
    ui.setHost(say(LINES.wrong), 'bad');
  }

  ui.renderRun(run, phase, revealData);
  syncChips();
  haulChip.set(haulChip.value, { pop: res.result === 'correct' || res.result === 'million' });
}

function handleLifeline(id) {
  if (phase !== 'ask' || !run) return;
  const res = useLifeline(run, id);
  if (!res.ok) return;

  shell.haptic(12);
  if (id === 'split') {
    sound.split();
    studio.fireLasers();
    ui.setHost(say(LINES.split), 'good');
  } else if (id === 'chat') {
    sound.chatPoll();
    studio.pulseRing('#3ff0c3');
    ui.setHost(say(LINES.chat), 'idle');
  } else if (id === 'agi') {
    sound.askAgi();
    studio.pulseRing('#e4d9ff');
    ui.setHost(res.advice.note, 'good');
  } else if (id === 'double') {
    sound.floorLock();
    studio.pulseRing('#3ff0c3');
    shell.toast('DOUBLE DIP ACTIVE · 2 SHOTS', 'good', 1700);
    ui.setHost(say(LINES.doubleOn), 'suspense');
  } else if (id === 'swap') {
    sound.swap();
    studio.pulseRing('#8b66ff');
    elapsed = 0;
    lastTickSec = 99;
    ui.setHost(say(LINES.swap), 'idle');
    shell.toast('QUESTION SWITCHED ✨', 'good', 1400);
  }
  ui.renderRun(run, phase);
}

function handleSetFloor(targetIndex) {
  if (phase !== 'ask' || !run) return;
  const res = setCustomFloor(run, targetIndex);
  if (!res.ok) return;
  sound.floorLock();
  studio.pulseRing('#3ff0c3');
  shell.haptic(14);
  shell.toast(`2ND FLOOR ARMED AT ${fmt(res.rung.value)} 🛡️`, 'good', 2000);
  ui.setHost(say(LINES.floorPlanted), 'good');
  ui.renderRun(run, phase);
}

function handleWalkAway() {
  if (phase !== 'ask' || !run) return;
  const res = walkAway(run);
  if (!res.ok) return;
  phase = 'reveal';
  revealData = res;
  revealTimer = 0;
  sound.stopMusic();
  sound.walkAway();
  studio.pulseRing('#ffc933');
  shell.haptic(14);
  ui.setHost(say(LINES.walk), 'good');
  ui.renderRun(run, phase, revealData);
  syncChips();
}

function handleTimeout() {
  if (phase !== 'ask' || !run) return;
  const res = timeoutQuestion(run);
  if (!res.ok) return;
  phase = 'reveal';
  revealData = res;
  revealTimer = 0;
  sound.stopMusic();
  sound.wrong();
  studio.burstWrong();
  shell.haptic([30, 40, 30]);
  ui.setHost(say(LINES.timeout), 'bad');
  ui.renderRun(run, phase, revealData);
  syncChips();
}

function handleNext() {
  if (phase !== 'reveal' || !run) return;
  if (run.over) {
    finishShow();
    return;
  }
  advanceRung(run);
  beginQuestion();
}

function finishShow() {
  if (phase === 'over') return;
  if (DEMO) {
    demoRuns++;
    startShow('classic');
    return;
  }
  phase = 'over';
  sound.stopMusic();

  const sum = summary(run);
  stats = recordRunStats(stats, run);
  shell.store.update((s) => { s.stats = stats; });

  const title = sum.wonMillion
    ? '1,000,000 CROWN 👑'
    : sum.reason === 'walk'
      ? 'BANKED THE HAUL'
      : sum.reason === 'timeout'
        ? 'BUZZER BEATER'
        : `RUNG ${sum.cleared} OF 15`;

  const ladderEl = el('p', 'ak-fine', shareGrid(run));

  shell.over({
    score: sum.score,
    label: run.mode === 'daily' ? `Daily (${shortDate(run.date)})` : run.mode === 'blitz' ? 'High Voltage Score' : 'Final Haul',
    bestKey: run.mode === 'blitz' ? 'blitzBest' : 'best',
    title,
    stats: [
      ['Rung Reached', `${sum.cleared} / 15`],
      ['Ladder Haul', fmt(sum.ladder)],
      ['Speed Bonus', `+${fmt(sum.speedPot)}`],
      ['Best Streak', String(sum.bestStreak)],
    ],
    line: endLineFor(sum, lineDice),
    extra: ladderEl,
    share: shareText(run),
    again: run.mode === 'daily' ? 'Play Classic' : 'Play again',
    onAgain: () => startShow(run.mode === 'daily' ? 'classic' : run.mode),
    onMenu: () => toTitle(),
  });
}

// ---------- KEYBOARD CONTROLS ----------
keyboard({
  a: 'o0', '1': 'o0',
  b: 'o1', '2': 'o1',
  c: 'o2', '3': 'o2',
  d: 'o3', '4': 'o3',
  Enter: 'go', ' ': 'go',
  '5': 'll_split', '6': 'll_chat', '7': 'll_agi', '8': 'll_double', '9': 'll_swap',
  f: 'floor', w: 'walk', l: 'ladder',
}, {
  blocked: () => shell.state !== 'play' || DEMO,
  down(act) {
    if (act === 'ladder') { ui.toggleDrawer(!ui.isDrawerOpen()); return; }
    if (ui.isDrawerOpen()) return;
    if (act.startsWith('o')) { handleOptionTap(Number(act[1])); return; }
    if (act === 'go') {
      if (phase === 'ask' && run?.armed != null) handleConfirmLock();
      else if (phase === 'reveal' && revealTimer > 0.25) handleNext();
      return;
    }
    if (act.startsWith('ll_')) { handleLifeline(act.slice(3)); return; }
    if (act === 'floor') { handleSetFloor(run?.index); return; }
    if (act === 'walk') { handleWalkAway(); }
  },
});

// ---------- MAIN FIXED-STEP LOOP ----------
function stepDemo(dt) {
  if (!demoPlan || !run) return;
  if (phase === 'ask') {
    demoPlan.t += dt;
    if (demoPlan.lifeline && !demoPlan.lifelineDone && demoPlan.t >= demoPlan.lifelineAt) {
      demoPlan.lifelineDone = true;
      handleLifeline(demoPlan.lifeline);
    }
    if (demoPlan.wiggleAt > 0 && !demoPlan.wiggleDone && demoPlan.t >= demoPlan.wiggleAt) {
      demoPlan.wiggleDone = true;
      if (!run.eliminated.includes(demoPlan.wigglePick)) handleOptionTap(demoPlan.wigglePick);
    }
    if (!demoPlan.armDone && demoPlan.t >= demoPlan.armAt) {
      demoPlan.armDone = true;
      handleOptionTap(demoPlan.pick);
    }
    if (!demoPlan.lockDone && demoPlan.t >= demoPlan.lockAt) {
      demoPlan.lockDone = true;
      handleConfirmLock();
    }
  } else if (phase === 'reveal' && revealTimer >= demoPlan.nextAfterReveal) {
    handleNext();
  }
}

const loop = createLoop({
  paused: () => shell.state === 'pause',
  update(dt) {
    studio.update(dt);
    if (!run || shell.state !== 'play') return;

    if (phase === 'ask') {
      elapsed += dt;
      const clock = run.cfg.clock;
      const left = Math.max(0, clock - elapsed);
      const sec = Math.ceil(left);
      const urgent = run.cfg.hardClock && sec <= 5;
      ui.setClock(left / clock, sec, urgent, !run.cfg.hardClock);
      if (urgent && sec !== lastTickSec && sec > 0) {
        lastTickSec = sec;
        sound.tick(sec <= 3);
      }
      if (run.cfg.hardClock && left <= 0 && !DEMO) {
        handleTimeout();
      }
    } else if (phase === 'lock') {
      lockTimer -= dt;
      if (lockTimer <= 0) resolveLock();
    } else if (phase === 'reveal') {
      revealTimer += dt;
    }

    if (DEMO) stepDemo(dt);
  },
  render() {
    studio.draw();
  },
});

loop.start();
if (DEMO) startShow('classic'); else toTitle();
