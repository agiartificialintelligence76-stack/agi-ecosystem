// FINAL ANSWER: Web Audio game-show soundtrack (4 escalating tension tiers + Final Answer heartbeat) and tactile SFX.
// Built strictly on the arcade kit's audio engine so mute, focus-suspend, and ?demo silence work automatically.

const midi = (n) => 440 * 2 ** ((n - 69) / 12);

// Four escalating musical tension beds (tier 1 -> 4), in D minor / A minor dramatic game-show harmony
const BEDS = {
  1: {
    bpm: 94,
    bass: [50, null, 50, null, 53, null, 55, null, 50, null, 50, null, 48, null, 50, null],
    pulse: [62, 65, 69, 65, 62, 65, 72, 69, 62, 65, 69, 65, 60, 64, 67, 64],
    kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    hat:  [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
    filter: 900,
  },
  2: {
    bpm: 104,
    bass: [45, null, 45, 45, 48, null, 50, null, 45, null, 45, 45, 43, null, 45, null],
    pulse: [69, null, 72, 69, 76, null, 72, 69, 69, null, 72, 69, 67, null, 71, 69],
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    hat:  [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
    filter: 1150,
  },
  3: {
    bpm: 114,
    bass: [43, null, 43, null, 43, 46, 48, null, 41, null, 41, null, 43, null, 46, 48],
    pulse: [67, 70, 74, 70, 67, 70, 77, 74, 65, 69, 72, 69, 67, 70, 74, 79],
    kick: [1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0],
    hat:  [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1],
    filter: 1400,
  },
  4: {
    bpm: 124,
    bass: [40, null, 40, null, 40, null, 43, 45, 40, null, 40, null, 47, null, 45, 43],
    pulse: [64, 71, 76, 71, 64, 71, 79, 76, 64, 71, 76, 83, 79, 76, 71, 67],
    kick: [1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0],
    hat:  [1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1],
    filter: 1800,
  },
};

export function createSound(audio) {
  let timer = 0;
  let playing = false;
  let tier = 1;
  let suspense = false;
  let fever = false;
  let step = 0;
  let nextTime = 0;

  function schedule() {
    if (!playing) return;
    const c = audio.ctx;
    if (!c) { timer = setTimeout(schedule, 120); return; }
    if (!audio.running) { nextTime = c.currentTime + 0.08; timer = setTimeout(schedule, 120); return; }

    const bed = BEDS[tier] || BEDS[1];
    const bpm = bed.bpm + (fever ? 8 : 0);
    const stepDur = 60 / bpm / 4;

    while (nextTime < c.currentTime + 0.14) {
      const at = Math.max(0, nextTime - c.currentTime);
      if (suspense) {
        // Dramatic lub-dub heartbeat during Final Answer lock-in
        const beatPos = step % 8;
        if (beatPos === 0) {
          audio.tone({ freq: 86, slide: 42, type: 'sine', dur: 0.18, vol: 0.34, at, bus: 'music', attack: 0.004 });
        } else if (beatPos === 2) {
          audio.tone({ freq: 74, slide: 38, type: 'sine', dur: 0.16, vol: 0.25, at, bus: 'music', attack: 0.004 });
        }
        if (beatPos === 0) {
          audio.tone({ freq: midi(62 + tier * 2), type: 'triangle', dur: stepDur * 7, vol: 0.032, at, filter: 750, bus: 'music', attack: 0.04 });
        }
      } else {
        const i = step % 16;
        const b = bed.bass[i];
        const p = bed.pulse[i];
        if (b != null) {
          audio.tone({ freq: midi(b), type: 'triangle', dur: stepDur * 1.6, vol: 0.075, at, filter: 420, bus: 'music', attack: 0.006 });
        }
        if (p != null) {
          audio.tone({ freq: midi(p), type: fever ? 'sawtooth' : 'sine', dur: stepDur * 0.8, vol: fever ? 0.032 : 0.042, at, filter: bed.filter, bus: 'music', attack: 0.004 });
        }
        if (bed.kick[i]) {
          audio.tone({ freq: 118, slide: 44, type: 'sine', dur: 0.14, vol: 0.22, at, bus: 'music', attack: 0.002 });
        }
        if (bed.hat[i]) {
          audio.noise({ dur: 0.025, vol: 0.032, filter: 6500, type: 'highpass', at, bus: 'music' });
        }
      }
      nextTime += stepDur;
      step = (step + 1) % 16;
    }
    timer = setTimeout(schedule, 30);
  }

  function startMusic(t = 1) {
    tier = Math.max(1, Math.min(4, t | 0));
    suspense = false;
    if (playing) return;
    playing = true;
    step = 0;
    nextTime = (audio.ctx?.currentTime || 0) + 0.05;
    schedule();
  }

  function stopMusic() {
    playing = false;
    clearTimeout(timer);
  }

  return {
    startMusic,
    stopMusic,
    setTier(t) { tier = Math.max(1, Math.min(4, t | 0)); },
    setSuspense(on) { suspense = Boolean(on); },
    setFever(on) { fever = Boolean(on); },

    // Question enters the stage
    unveil(t = 1) {
      const root = [262, 294, 330, 392][(t - 1) % 4];
      audio.tone({ freq: root, slide: root * 1.5, type: 'triangle', dur: 0.22, vol: 0.14, filter: 1800 });
      audio.tone({ freq: root * 2, type: 'sine', dur: 0.18, vol: 0.08, at: 0.08 });
    },

    // Option highlighted (1st tap)
    arm(idx = 0) {
      const freqs = [440, 494, 554, 622];
      audio.tone({ freq: freqs[idx % 4], type: 'triangle', dur: 0.08, vol: 0.16 });
      audio.tone({ freq: freqs[idx % 4] * 1.5, type: 'sine', dur: 0.1, vol: 0.09, at: 0.035 });
    },

    // Final Answer locked in!
    lockIn(t = 1) {
      const base = 110 + t * 18;
      audio.tone({ freq: base, slide: base * 0.75, type: 'sine', dur: 0.42, vol: 0.28, attack: 0.01 });
      audio.chord([base * 2, base * 3, base * 3.75], { type: 'triangle', dur: 0.55, vol: 0.08, filter: 1200, strum: 0.03 });
    },

    // Correct answer reveal (richer & brighter as tier climbs!)
    correct(t = 1) {
      const notes = t >= 3
        ? [523, 659, 784, 1047, 1319]
        : t === 2
          ? [494, 622, 740, 988]
          : [440, 554, 659, 880];
      notes.forEach((f, i) => {
        audio.tone({ freq: f, type: 'triangle', dur: 0.22, vol: 0.16, at: i * 0.055 });
        audio.tone({ freq: f * 2, type: 'sine', dur: 0.14, vol: 0.06, at: i * 0.055 + 0.02 });
      });
    },

    // Milestone / Safety Net locked!
    milestone() {
      [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => {
        audio.tone({ freq: f, type: 'triangle', dur: 0.28, vol: 0.16, at: i * 0.065 });
      });
      audio.noise({ dur: 0.22, vol: 0.08, filter: 4200, type: 'highpass', at: 0.18 });
    },

    // 1,000,000 GRAND VICTORY FANFARE!
    million() {
      const fanfare = [523, 659, 784, 1047, 988, 1047, 1319, 1568];
      fanfare.forEach((f, i) => {
        audio.tone({ freq: f, type: 'triangle', dur: i === fanfare.length - 1 ? 0.7 : 0.22, vol: 0.18, at: i * 0.095 });
        audio.tone({ freq: f * 0.5, type: 'sawtooth', dur: 0.24, vol: 0.05, filter: 1100, at: i * 0.095 });
      });
    },

    // Wrong answer
    wrong() {
      audio.tone({ freq: 260, slide: 115, type: 'sawtooth', dur: 0.42, vol: 0.17, filter: 850 });
      audio.tone({ freq: 196, slide: 92, type: 'triangle', dur: 0.5, vol: 0.2, at: 0.09 });
      audio.noise({ dur: 0.24, vol: 0.14, filter: 700, type: 'lowpass' });
    },

    // Double Dip shield took the 1st hit!
    doubleCrack() {
      audio.noise({ dur: 0.14, vol: 0.2, filter: 2800, type: 'bandpass', q: 1.5 });
      audio.tone({ freq: 380, slide: 210, type: 'square', dur: 0.16, vol: 0.11, filter: 1600 });
      audio.tone({ freq: 520, type: 'triangle', dur: 0.18, vol: 0.13, at: 0.14 });
    },

    // 50:50 laser slice
    split() {
      audio.noise({ dur: 0.18, vol: 0.2, filter: 4600, type: 'highpass', slideFilter: 900 });
      audio.tone({ freq: 1120, slide: 280, type: 'sawtooth', dur: 0.16, vol: 0.11, filter: 2400 });
      audio.tone({ freq: 940, slide: 220, type: 'sawtooth', dur: 0.16, vol: 0.11, filter: 2400, at: 0.12 });
    },

    // Ask Chat poll rising chimes
    chatPoll() {
      [520, 620, 740, 880, 1047].forEach((f, i) => {
        audio.tone({ freq: f, type: 'sine', dur: 0.09, vol: 0.11, at: i * 0.055 });
      });
    },

    // Ask AGI-1 sparkle
    askAgi() {
      [784, 988, 1175, 1568].forEach((f, i) => {
        audio.tone({ freq: f, type: 'triangle', dur: 0.16, vol: 0.12, at: i * 0.05 });
      });
    },

    // Switch question whoosh
    swap() {
      audio.noise({ dur: 0.22, vol: 0.16, filter: 700, slideFilter: 3200, type: 'bandpass' });
      audio.tone({ freq: 360, slide: 720, type: 'triangle', dur: 0.18, vol: 0.14, at: 0.06 });
    },

    // Plant safety floor shield
    floorLock() {
      audio.chord([440, 554, 659], { type: 'triangle', dur: 0.2, vol: 0.12, strum: 0.03 });
      audio.tone({ freq: 880, type: 'sine', dur: 0.24, vol: 0.13, at: 0.1 });
    },

    // Walk away bank chime
    walkAway() {
      [587, 740, 880].forEach((f, i) => {
        audio.tone({ freq: f, type: 'triangle', dur: 0.22, vol: 0.15, at: i * 0.09 });
      });
    },

    // Stage Fever ignite
    fever() {
      [523, 659, 784, 1047, 1319].forEach((f, i) => {
        audio.tone({ freq: f, type: 'sawtooth', dur: 0.12, vol: 0.07, filter: 2600, at: i * 0.04 });
      });
    },

    // Countdown urgency tick
    tick(urgent = false) {
      audio.tone({ freq: urgent ? 1320 : 920, type: 'square', dur: 0.025, vol: urgent ? 0.08 : 0.045 });
    },
  };
}
