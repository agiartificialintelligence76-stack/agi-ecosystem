// AGI-1's buy GIF (2026-10-06, the owner: "a very simple buybot … with a gif of her"): the page that draws it, one frame at
// a time. Her 2D self (her Live2D model, as on the site: src/stage/agi1-2d.js, through the launch video's renderer,
// tools/promo/page/her.js) cheering for a buy: her "celebrate" reaction (a hop, both hands up in a little "yay!", hearts),
// on Pop mode's violet with the front's comic rays and halftone dots, and a "$AGI BUY!" sticker. PG-13 like everything of
// hers in a group (a public place where nobody's age is checked): her chest only moves the subtle, natural way it does on
// the site. 480 × 480, 2.5 s, made to loop: the background only moves with the loop, she starts and ends at rest.
import { createHer } from '../../promo/page/her.js';
import { C, FONTS, canvas, halftone, focusLines, popCard, text, measure, clamp, rgba } from '../../promo/page/kit.js';

export const W = 480, H = 480, T = 2.5;          // pixels, seconds (one loop)
let cv = null, g = null, shot = null, rays = null, dots = null;

async function loadFonts() {
  const faces = [
    new FontFace('Geist', 'url(/fonts/Geist-Variable.woff2)', { weight: '100 900' }),
    new FontFace('Anybody', 'url(/fonts/Anybody-Variable.woff2)', { weight: '100 900', stretch: '50% 150%' }),
  ];
  for (const f of faces) document.fonts.add(await f.load());
}

async function load() {
  await loadFonts();
  cv = canvas(W, H);
  g = cv.getContext('2d', { alpha: false });
  document.body.append(cv);
  const her = await createHer({ scale: 1 });
  // at rest, then her cheer (the site's "celebrate": the hop lands at 0.8 s, the cheer and the hearts are done by 2.3 s)
  shot = her.shot({ from: 0, seed: 7, closeUp: true, events: [{ at: 0.12, react: 'celebrate' }] });
  // the background's rays and dots, drawn once (they only pulse with the loop, so its first and last frames meet)
  rays = canvas(W, H);
  focusLines(rays.getContext('2d'), W / 2, H * 0.42, W * 1.2, 0, { color: 'rgba(255,255,255,0.11)', count: 40, spin: 0, seed: 5 });
  // the dots, fading out toward the middle (where she is)
  dots = canvas(W, H);
  const d = dots.getContext('2d');
  d.drawImage(halftone(W, H, 17, 'rgba(23,10,54,0.22)', 0.21), 0, 0);
  d.globalCompositeOperation = 'destination-in';
  const mask = d.createRadialGradient(W / 2, H * 0.45, W * 0.2, W / 2, H * 0.45, W * 0.72);
  mask.addColorStop(0, 'rgba(0,0,0,0)'); mask.addColorStop(1, 'rgba(0,0,0,1)');
  d.fillStyle = mask; d.fillRect(0, 0, W, H);
  return { W, H, T };
}

// the loop's own beat: 0 at its start and end, a soft bump in the middle (the rays and the sticker breathe with it)
const loopPulse = (t) => 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / T);

function draw(t) {
  // Pop mode's violet, a glow behind her, the rays, the dots fading toward the middle
  g.fillStyle = C.violet;
  g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W / 2, H * 0.42, 0, W / 2, H * 0.42, W * 0.75);
  glow.addColorStop(0, rgba('#9b7bff', 0.9)); glow.addColorStop(1, rgba(C.violet, 0));
  g.fillStyle = glow; g.fillRect(0, 0, W, H);
  const z = 1 + 0.035 * loopPulse(t);
  g.save();
  g.translate(W / 2, H * 0.42); g.scale(z, z); g.translate(-W / 2, -H * 0.42);
  g.drawImage(rays, 0, 0);
  g.restore();
  g.drawImage(dots, 0, 0);

  // AGI-1, waist up (her eyes at 176 px, her waist at the frame's bottom: room above her head for her hop), cheering
  shot.draw(g, t, { x: 0, y: 0, w: W, h: H, eyes: 176, waist: 470, hearts: 0.9, res: 1 });

  // the sticker: "$AGI BUY!", Pop mode style (honey, an ink outline, a hard shadow), tilted, breathing with the loop
  const big = { f: 'display', w: 900, s: 44, st: 'expanded' }, small = { f: 'display', w: 800, s: 24, st: 'expanded' };
  const wBig = measure(g, 'BUY!', big), wSmall = measure(g, '$AGI', small);
  const pad = 18, gap = 10, bw = pad * 2 + wSmall + gap + wBig, bh = 62;
  const s = 1 + 0.04 * loopPulse(t);
  g.save();
  g.translate(W / 2, H - 58);
  g.rotate(-0.05);
  g.scale(s, s);
  popCard(g, -bw / 2, -bh / 2, bw, bh, { r: bh / 2, fill: C.honey, line: C.ink, lw: 3.5, shadow: 6, shadowColor: C.ink });
  text(g, '$AGI', { x: -bw / 2 + pad, y: 2, font: small, color: C.ink, base: 'middle' });
  text(g, 'BUY!', { x: -bw / 2 + pad + wSmall + gap, y: 3, font: big, color: C.ink, base: 'middle' });
  g.restore();
  return clamp(t / T);
}

// a frame as a JPEG (base64), and a still as a PNG (base64)
function frame(t, quality = 0.95) {
  draw(t);
  return cv.toDataURL('image/jpeg', quality).split(',')[1];
}
function still(t) {
  draw(t);
  return cv.toDataURL('image/png').split(',')[1];
}

window.gif = { load, frame, still, T, W, H, FONTS };
