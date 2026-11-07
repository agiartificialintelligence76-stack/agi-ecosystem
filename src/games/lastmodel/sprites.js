// LAST MODEL STANDING: the pixel art, drawn by hand as rows of characters (one a pixel, "." empty), every colour from
// PAL: the arcade's palette, AGI-1's own colours (from her 8-bit frames, src/games/intro-sprite.js) and a few shades.
// ./art.js turns them into canvases; tools/games/lastmodel/preview.py draws a contact sheet of them.
export const PAL = {
  // ink
  h: '#170a36', H: '#3a2a66', z: '#5d5185',
  // AGI-1: hair, skin, lavender, white, eyes, blush, mouth
  0: '#fde3b0', 1: '#f5c98f', 2: '#e2ad74', 3: '#bb8352', 4: '#8c5a36',
  5: '#ffd9c0', 6: '#fcc3a6', 7: '#e9a48a',
  8: '#e6c9ff', 9: '#cfa7f4', a: '#b08ae0', b: '#8a66b8',
  c: '#ffffff', d: '#f1e8fa', e: '#2a1630', f: '#ff9db6', g: '#d8606f',
  // paper and greys
  w: '#fffaf0', q: '#d9cfee', r: '#a79bc6', x: '#7a6fa0',
  // pink
  P: '#ff4da6', Q: '#c22f80', K: '#ffa6d2',
  // honey
  Y: '#ffc933', y: '#e0951c', u: '#fff1a8', o: '#a8600f',
  // mint
  M: '#3ff0c3', m: '#1fa888', n: '#c2fbec',
  // violet
  V: '#8b66ff', v: '#6b3bff', j: '#4a1fd6', J: '#c9b6ff',
  // red
  R: '#ff5a5f', k: '#b3303b', l: '#ffb3b5',
  // green
  G: '#2fd27a', F: '#1a8a50', E: '#aef5cc',
  // sky
  S: '#59c8ff', s: '#2a80bf', T: '#cdeeff',
  // metal (bosses, crates)
  A: '#2b3160', B: '#414a85', C: '#5e69ad', D: '#1d2146', I: '#8a95d6',
};

export const SPRITES = {
  // ---------- AGI-1 (17 × 26): front and back, standing and two steps ----------
  agiF: [
    '......hhhhh......',
    '....hh00111hh....',
    '...h001111122h...',
    '..h00111111122h..',
    '..h01121121123h..',
    '..h12255266223h..',
    '..h125e566e623h..',
    '..h125e666e723h..',
    '..h12f66g66f23h..',
    '..h12266667223h..',
    '..h12227772223h..',
    '...h2899999a3h...',
    '..h62899999a37h..',
    '..h628cdcdca37h..',
    '..h62899999a37h..',
    '..h689999999a7h..',
    '..h589999999a6h..',
    '...h9aaaaaaabh...',
    '...hcddchcddch...',
    '....h66h.h67h....',
    '....h66h.h67h....',
    '....h66h.h77h....',
    '....h66h.h67h....',
    '....h89h.h9ah....',
    '...h8c9h.h9cah...',
    '...hhhhh.hhhhh...',
  ],
};
