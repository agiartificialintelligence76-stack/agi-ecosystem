// TRENCHING SIMULATOR's sounds (2026-10-20): short blips made in the browser with Web Audio (no files, nobody else's
// sounds), started only after the player's first tap or key (browsers block sound before one), quiet (a master volume
// of 0.18), and switched off with the mute button (kept in the save).
const NOTES = {
  buy: [[660, 0, 0.07, 'square'], [990, 0.06, 0.09, 'square']],
  sell: [[880, 0, 0.07, 'triangle'], [587, 0.06, 0.1, 'triangle']],
  win: [[523, 0, 0.08, 'triangle'], [659, 0.07, 0.08, 'triangle'], [784, 0.14, 0.14, 'triangle']],
  loss: [[392, 0, 0.1, 'sawtooth'], [330, 0.09, 0.16, 'sawtooth']],
  fail: [[220, 0, 0.12, 'square']],
  rug: [[300, 0, 0.12, 'sawtooth'], [200, 0.1, 0.14, 'sawtooth'], [130, 0.22, 0.24, 'sawtooth']],
  milestone: [[784, 0, 0.07, 'triangle'], [988, 0.06, 0.07, 'triangle'], [1319, 0.12, 0.16, 'triangle']],
  tick: [[1200, 0, 0.03, 'square']],
  go: [[523, 0, 0.09, 'square'], [1047, 0.09, 0.18, 'square']],
  won: [[523, 0, 0.1, 'triangle'], [659, 0.1, 0.1, 'triangle'], [784, 0.2, 0.1, 'triangle'], [1047, 0.3, 0.32, 'triangle']],
  lost: [[392, 0, 0.16, 'triangle'], [349, 0.16, 0.16, 'triangle'], [262, 0.32, 0.36, 'triangle']],
};

export const SOUNDS = Object.freeze(Object.keys(NOTES));

export function createSound({ muted = false, volume = 0.18 } = {}) {
  let ctx = null;
  let master = null;
  let off = Boolean(muted);
  function start() {
    if (ctx || typeof window === 'undefined') return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
    }
  }
  return {
    // call from the player's tap or key
    unlock() {
      start();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    get muted() {
      return off;
    },
    setMuted(m) {
      off = Boolean(m);
    },
    play(name) {
      if (off || !ctx || ctx.state !== 'running' || !NOTES[name]) return;
      const t0 = ctx.currentTime + 0.01;
      for (const [f, at, len, type] of NOTES[name]) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = type;
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0 + at);
        g.gain.exponentialRampToValueAtTime(0.5, t0 + at + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + len);
        o.connect(g);
        g.connect(master);
        o.start(t0 + at);
        o.stop(t0 + at + len + 0.02);
      }
    },
  };
}
