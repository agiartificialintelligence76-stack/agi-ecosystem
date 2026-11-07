// HEARTBEAT (2026-11-08): a song's chart file, as the game uses it (pure: tests/heartbeat.test.js reads it in Node).
// The files are made once from the songs by tools/games/heartbeat/chart.py: { id, title, bpm, offset, duration,
// preview: [start, end], beats: [s…], bar (the first downbeat's beat), energy ('0'–'9' a beat), charts: { easy, normal,
// hard: [[t, lane, hold?]…] } }.

export const DIFFS = Object.freeze(['easy', 'normal', 'hard']);
export const DIFF_NAMES = Object.freeze({ easy: 'Easy', normal: 'Normal', hard: 'Hard' });

// [[t, lane, hold?]…] → [{ t, lane, hold }], in time order
export function notesOf(rows) {
  return rows.map(([t, lane, hold = 0]) => ({ t, lane, hold })).sort((a, b) => a.t - b.t || a.lane - b.lane);
}

// the sync offset (ms) moves the whole chart against the song: + means the player hears (or taps) late, so every
// note is due that much later
export const applyOffset = (t, offsetMs) => t + offsetMs / 1000;

// notes a second between the first and the last note (holds count once)
export function densityOf(notes) {
  const heads = [...new Set(notes.map((n) => n.t))].sort((a, b) => a - b);
  if (heads.length < 2) return 0;
  return heads.length / (heads[heads.length - 1] - heads[0]);
}

// how hard a chart feels, 1–12, from its average and its busiest 8 seconds
export function levelOf(notes) {
  const heads = [...new Set(notes.map((n) => n.t))].sort((a, b) => a - b);
  if (!heads.length) return 1;
  let peak = 0;
  for (let i = 0, j = 0; i < heads.length; i++) {
    while (heads[j] < heads[i] - 8) j++;
    peak = Math.max(peak, (i - j + 1) / 8);
  }
  const avg = densityOf(notes);
  const chords = notes.length - heads.length;
  const holds = notes.filter((n) => n.hold > 0).length;
  const v = 1.6 * avg + 0.35 * peak + (chords + holds) / Math.max(1, heads.length) * 6 - 1;
  return Math.max(1, Math.min(12, Math.round(v)));
}

// where a moment sits on the song's beats: { beat: index + fraction, bar: beats since the first downbeat ÷ 4 }
export function beatAt(beats, t) {
  const n = beats.length;
  if (!n) return 0;
  if (t <= beats[0]) {
    const p = n > 1 ? beats[1] - beats[0] : 0.5;
    return (t - beats[0]) / p;
  }
  if (t >= beats[n - 1]) {
    const p = n > 1 ? beats[n - 1] - beats[n - 2] : 0.5;
    return n - 1 + (t - beats[n - 1]) / p;
  }
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (beats[mid] <= t) lo = mid; else hi = mid;
  }
  return lo + (t - beats[lo]) / (beats[hi] - beats[lo]);
}

// the song's energy (0..1) at a beat, from its one-digit-a-beat string
export function energyAt(energy, beat) {
  if (!energy) return 0.5;
  const i = Math.max(0, Math.min(energy.length - 1, Math.floor(beat)));
  const j = Math.min(energy.length - 1, i + 1);
  const f = Math.min(1, Math.max(0, beat - i));
  return ((+energy[i]) * (1 - f) + (+energy[j]) * f) / 9;
}

// beats that start bars (for the highway's bar lines)
export const isDownbeat = (k, bar) => ((k - bar) % 4 + 4) % 4 === 0;

// "3:13"
export const clock = (sec) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
