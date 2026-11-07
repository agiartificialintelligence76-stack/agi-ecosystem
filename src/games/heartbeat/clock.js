// HEARTBEAT (2026-11-08): the song's clock (pure: a test drives it with made-up times).
//
// The audio clock (AudioContext) is the truth: it says which sample is playing. But it moves in steps (a block of
// audio at a time, up to tens of ms on some phones), so notes drawn straight from it would stutter. This clock runs on
// the page's own smooth time (performance.now) and is pulled gently toward the audio clock each frame: smooth motion,
// and on time on average. A big gap (the song starting, a rewind) jumps at once.
//
//   const clock = createSongClock();
//   clock.tick(perfMs, songTimeFromAudio)    each frame (songTimeFromAudio null: no audio, keep going)
//   clock.now                                where the song is (s)
//   clock.at(event.timeStamp)                where the song was when a key or a finger went down
//   clock.jump(songTime, perfMs)             set it (a start, a rewind); clock.hold(true) freezes it (a pause)
export const SNAP = 0.035;      // further off than this: jump
export const PULL = 0.12;       // else, how much of the gap closes each frame

export function createSongClock() {
  let anchorPerf = 0, anchorSong = 0, frozen = false, started = false;
  const api = {
    tick(perfMs, target) {
      if (frozen) { anchorPerf = perfMs; return anchorSong; }
      const predicted = anchorSong + (perfMs - anchorPerf) / 1000;
      let next = predicted;
      if (target != null && Number.isFinite(target)) {
        const gap = target - predicted;
        if (!started || Math.abs(gap) > SNAP) next = target;
        else next = predicted + gap * PULL;
        started = true;
      }
      anchorPerf = perfMs;
      anchorSong = next;
      return next;
    },
    at(perfMs) { return frozen ? anchorSong : anchorSong + (perfMs - anchorPerf) / 1000; },
    jump(songTime, perfMs) { anchorSong = songTime; anchorPerf = perfMs; started = true; },
    hold(on) { frozen = on; },
    get now() { return anchorSong; },
    get frozen() { return frozen; },
  };
  return api;
}

// a key's or a finger's time (event.timeStamp, on performance.now's clock in today's browsers) → performance.now() time;
// an old browser's epoch timestamp (or none) → now
export function eventPerf(stamp, nowMs) {
  if (typeof stamp !== 'number' || !Number.isFinite(stamp) || stamp <= 0) return nowMs;
  if (Math.abs(stamp - nowMs) > 1000) return nowMs;
  return Math.min(stamp, nowMs);
}
