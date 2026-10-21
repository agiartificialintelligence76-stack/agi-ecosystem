// AGI-1 in the game's corner (2026-10-20): her 8-bit face (the AGI GAMES intro's own frames, from her 2D art: never the
// 3D model), a little mark for her mood (a heart, a sweat drop, a tear, a sparkle, a "?"), her eyes smiling or sad, a
// blink now and then, and her words in a bubble for as long as they take to read (talkMs: 2.4 s to 5.2 s). Drawn pixel
// by pixel on a 25 × 25 canvas that CSS shows big and sharp (image-rendering: pixelated). "Reduce motion": no blinks.
// Her bubble is its own node (`bubble`): the game may move it elsewhere (the HUD's goal cell on a computer), and it goes
// with her when she's destroyed.
import { FRAMES, PALETTE } from '../intro-sprite.js';
import { el, setText } from './ui.js';

export const FACE = Object.freeze({ x: 3, y: 3, size: 25, eyes: [[14, 9], [16, 9]] }); // her eyes, in the frame's pixels
const SKIN = '6';
const EYE = 'e';

// the marks, 5 × 5, drawn at the face's top right ('x' = the mark's color)
const MARKS = {
  love: { color: '#ff5c8a', rows: ['.x.x.', 'xxxxx', 'xxxxx', '.xxx.', '..x..'] },
  worried: { color: '#7cc4ff', rows: ['..x..', '..x..', '.xxx.', '.xxx.', '..x..'] },
  sad: { color: '#7cc4ff', rows: ['.....', '..x..', '.xxx.', '.xxx.', '..x..'] },
  celebrate: { color: '#ffd23f', rows: ['..x..', '..x..', 'xxxxx', '..x..', '..x..'] },
  hmm: { color: '#ffffff', rows: ['.xxx.', '...x.', '..x..', '.....', '..x..'] },
  shy: { color: '#ff9db6', rows: ['.....', 'x.x.x', '.....', '.....', '.....'] },
};
const SMILE = new Set(['happy', 'love', 'celebrate', 'wave']);
const DOWN = new Set(['sad', 'worried']);

// the face's pixels for a mood: [[x, y, color], …] in the 25 × 25 crop (pure: read in Node too)
export function facePixels(mood = 'neutral', { blink = false } = {}) {
  const rows = FRAMES.stand;
  const out = [];
  const eyes = new Set(FACE.eyes.map(([x, y]) => `${x},${y}`));
  for (let y = 0; y < FACE.size; y++) {
    const row = rows[FACE.y + y] || '';
    for (let x = 0; x < FACE.size; x++) {
      let k = row[FACE.x + x];
      if (!k || k === '.') continue;
      const at = `${FACE.x + x},${FACE.y + y}`;
      if (eyes.has(at) && (blink || SMILE.has(mood))) k = SKIN;
      out.push([x, y, PALETTE[k]]);
    }
  }
  for (const [ex, ey] of FACE.eyes) {
    const x = ex - FACE.x;
    const y = ey - FACE.y;
    if (blink) out.push([x, y, PALETTE[SKIN]]);
    else if (SMILE.has(mood)) out.push([x, y - 1, PALETTE[EYE]]); // smiling eyes: up a pixel, curved by the skin under
    else if (DOWN.has(mood)) out.push([x, y + 1, PALETTE[SKIN]]);
  }
  const m = MARKS[mood];
  if (m) {
    m.rows.forEach((r, y) => [...r].forEach((c, x) => c === 'x' && out.push([19 + x, 1 + y, m.color])));
  }
  return out;
}

// how long a line stays up: about a second, and 60 ms a character to read it, never under 2.4 s or over 5.2 s
export const TALK = Object.freeze({ min: 2400, max: 5200, base: 1000, perChar: 60 });
export function talkMs(text) {
  const n = [...String(text == null ? '' : text)].length;
  return Math.max(TALK.min, Math.min(TALK.max, TALK.base + TALK.perChar * n));
}

export function createAgi(host, { reduceMotion = false, ms = null } = {}) {
  const canvas = el('canvas', { class: 'ts-agi-face', width: FACE.size, height: FACE.size, 'aria-hidden': 'true' });
  const bubble = el('div', { class: 'ts-agi-bubble', role: 'status', 'aria-live': 'polite' });
  const node = el('div', { class: 'ts-agi' }, canvas, bubble);
  host.append(node);
  const g = canvas.getContext('2d');
  let mood = 'neutral';
  let blink = false;
  let blinkT = 0;
  let blinkOffT = 0;
  let hideT = 0;
  function paint() {
    if (!g) return;
    g.clearRect(0, 0, FACE.size, FACE.size);
    for (const [x, y, c] of facePixels(mood, { blink })) {
      g.fillStyle = c;
      g.fillRect(x, y, 1, 1);
    }
  }
  function blinkLater() {
    if (reduceMotion) return;
    blinkT = setTimeout(() => {
      blink = true;
      paint();
      blinkOffT = setTimeout(() => {
        blink = false;
        paint();
        blinkLater();
      }, 130);
    }, 2500 + Math.random() * 3500);
  }
  function quiet() {
    clearTimeout(hideT);
    hideT = 0;
    node.classList.remove('is-talking');
    bubble.classList.remove('is-on');
  }
  paint();
  blinkLater();
  return {
    el: node,
    bubble,
    get mood() {
      return mood;
    },
    get talking() {
      return bubble.classList.contains('is-on');
    },
    setMood(m) {
      mood = m || 'neutral';
      paint();
    },
    // her words, in her mood, for as long as they take to read (or `ms`); a new line takes the place of the last one
    say(text, m = 'neutral') {
      mood = m || 'neutral';
      paint();
      setText(bubble, text);
      node.classList.add('is-talking');
      bubble.classList.add('is-on');
      clearTimeout(hideT);
      hideT = setTimeout(() => {
        quiet();
        mood = 'neutral';
        paint();
      }, ms == null ? talkMs(text) : ms);
    },
    quiet,
    destroy() {
      clearTimeout(blinkT);
      clearTimeout(blinkOffT);
      clearTimeout(hideT);
      node.remove();
      bubble.remove();
    },
  };
}
