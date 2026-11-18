import { atomicInk } from './productions.js';
import { ink, check, prove } from './score.js';
import { rng } from '../kit/fx.js';
export const trayLimit = (scene, par) => {
  const uncut = scene.beats.reduce((n, c) => n + atomicInk(c), 0);
  return scene.act && uncut - par >= 3 ? Math.min(uncut - 1, par + 4) : par + 4;
};
function fold(cues) {
  const strip = [];
  for (let i = 0; i < cues.length; ) {
    let best = null;
    for (let unit = 1; unit <= Math.floor((cues.length - i) / 2); unit++)
      for (const times of [2, 3]) {
        if (i + unit * times > cues.length) continue;
        const phrase = cues.slice(i, i + unit),
          valid = cues.slice(i, i + unit * times).every((c, k) => c === phrase[k % unit]);
        if (!valid) continue;
        const saving = phrase.reduce((a, c) => a + atomicInk(c), 0) * (times - 1) - 2;
        if (saving > 0 && (!best || saving > best.saving)) best = { saving, phrase, times };
      }
    if (best) {
      strip.push('(', ...best.phrase, String(best.times));
      i += best.phrase.length * best.times;
    } else strip.push(cues[i++]);
  }
  return strip;
}
function motifs(scene) {
  let best = { main: scene.act ? fold(scene.beats) : [...scene.beats], dance: [] };
  if (scene.act < 2) return best;
  for (let i = 0; i < scene.beats.length; i++)
    for (let len = 2; len <= 6 && i + len <= scene.beats.length; len++) {
      const phrase = scene.beats.slice(i, i + len),
        main = [];
      let calls = 0;
      for (let j = 0; j < scene.beats.length; ) {
        if (phrase.every((c, k) => scene.beats[j + k] === c)) {
          main.push('@');
          calls++;
          j += len;
        } else main.push(scene.beats[j++]);
      }
      if (calls < 2) continue;
      const candidate = { main: fold(main), dance: fold(phrase) };
      if (ink(candidate) < ink(best)) best = candidate;
    }
  return best;
}
export function rehearse(scene, persona, seed) {
  const dice = rng(seed + scene.id * 701),
    certificate = prove(scene),
    limit = trayLimit(scene, certificate.par);
  const exact = { main: certificate.main, dance: certificate.dance };
  let attempts = 0,
    wrong = 0,
    over = 0,
    seconds = 0,
    last = null;
  const flat = { main: [...scene.beats], dance: [] },
    limits = { newcomer: 3, regular: 3, expert: 1 };
  for (let i = 0; i < limits[persona]; i++) {
    attempts++;
    let candidate;
    if (persona === 'expert') candidate = exact;
    else if (persona === 'newcomer')
      candidate = i < 2 ? flat : { main: scene.act ? fold(scene.beats) : [...scene.beats], dance: [] };
    else
      candidate = i === 0 ? { main: scene.act ? fold(scene.beats) : [...scene.beats], dance: [] } : motifs(scene);
    candidate = { main: [...candidate.main], dance: [...candidate.dance] };
    if (i === 0 && persona !== 'expert' && dice.next() < (persona === 'newcomer' ? 0.62 : 0.18)) {
      const choices = candidate.main.map((c, j) => ('SLRBWKP'.includes(c) ? j : -1)).filter((j) => j >= 0);
      const pos = choices[Math.floor(dice.next() * choices.length)];
      if (pos != null) candidate.main.splice(pos, 1);
    }
    seconds +=
      i === 0
        ? 7 + scene.beats.length * (persona === 'newcomer' ? 3.7 : persona === 'regular' ? 2.75 : 1.38)
        : 5 + (scene.act + 1) * 2.5;
    last = candidate;
    const result = check(scene, candidate);
    if (ink(candidate) > limit) {
      over++;
      continue;
    }
    seconds += (result.beat + 1) * 0.49 * (result.ok ? scene.plots : 1);
    if (result.ok)
      return {
        solved: true,
        attempts,
        wrong,
        over,
        seconds,
        ink: ink(candidate),
        par: certificate.par,
        score:
          (ink(candidate) <= certificate.par ? 3 : ink(candidate) <= certificate.par + 2 ? 2 : 1) * 300 +
          scene.beats.length * 10,
      };
    wrong++;
  }
  return { solved: false, attempts, wrong, over, seconds, ink: ink(last), par: certificate.par, score: 0 };
}
