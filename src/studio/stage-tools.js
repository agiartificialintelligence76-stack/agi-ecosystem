// AGI Studio: a 3D model's page's tools (2026-10-13, the owner: "i wish theres more tools to customize the 3d like in meshy,
// please fixx and make it better"; the owner's choice: "3D page tools (Recommended)": free, in the visitor's own browser): its
// backgrounds, its lights, how it's drawn (its colors, clay, a wireframe), a turntable spin, a zoom, its moves' speed and a
// frozen pose, a picture and a short clip. Nothing here is sent anywhere. Pure (read in Node too): what the page
// (views/model3d.js) and the 3D view (viewer.js) share, and what a picture or a clip's frames get under the model (drawn on a
// 2D canvas: the browser's, or a stand-in in the tests).

// Its backgrounds: on the page, the stage's own CSS background (its value from backdropCss, set through the CSS object model:
// the page's CSP takes no style attributes); in a picture or a clip, the same drawn under it (paintBackdrop). radial: an
// ellipse at `at` (fractions of the width and the height), `size` its radii (fractions of the width and the height), its stops
// along it, as CSS's radial-gradient(90% 70% at 50% 30%, …) draws it. linear: top to bottom. clear: nothing under it (a
// picture keeps its see-through background; a video has none, so a clip gets Studio's)
export const BACKDROPS = {
  studio: { name: 'Studio', radial: { at: [0.5, 0.3], size: [0.9, 0.7], stops: [[0, '#241a45'], [0.75, '#0b0b0f']] } },
  dark: { name: 'Dark', color: '#111116' },
  light: { name: 'Light', radial: { at: [0.5, 0.35], size: [0.95, 0.8], stops: [[0, '#ffffff'], [1, '#d6d0e6']] } },
  violet: { name: 'Violet', linear: [[0, '#7c4dff'], [1, '#2e1478']] },
  sunset: { name: 'Sunset', linear: [[0, '#ffb36b'], [0.55, '#ff5f8f'], [1, '#2a1650']] },
  green: { name: 'Green screen', color: '#00b140' },
  clear: { name: 'Clear', clear: true },
};
export const BACKDROP_DEFAULT = 'studio';
// what a clip gets under it for Clear (a video has no see-through background)
export const CLIP_CLEAR = 'studio';

// Its lights (the 3D view's light rigs: viewer.js RIGS), its looks, its moves' speeds
export const LIGHTS = { studio: 'Studio', soft: 'Soft', golden: 'Golden hour', neon: 'Neon', moon: 'Moonlight' };
export const LIGHT_DEFAULT = 'studio';
export const LOOKS = { color: 'Its colors', clay: 'Clay', wire: 'Wireframe' };
export const LOOK_DEFAULT = 'color';
export const SPEEDS = [0.25, 0.5, 1, 1.5, 2];
export const speedText = (s) => `${s}×`;
// its zoom (1×: its whole body, as before; 3×: its head and shoulders), and a spin's one whole turn (seconds: a 10-second clip
// with Spin on is one turn)
export const ZOOM = { MIN: 1, MAX: 3, STEP: 0.1 };
export const zoomText = (z) => `${(Math.round(Number(z) * 10) / 10).toFixed(1)}×`;
export const SPIN_TURN_S = 10;

// A picture: about PICTURE_LONG px on its longest side (its pixels drawn again for it, at most MAX_RATIO of the screen's), a
// PNG (see-through with Clear). A clip: CLIP_SECONDS long, at most CLIP_LONG px on its longest side, CLIP_FPS frames a second
export const PICTURE_LONG = 1600;
export const CLIP_LONG = 1280;
export const CLIP_SECONDS = [5, 10];
export const CLIP_SECONDS_DEFAULT = 10;
export const CLIP_FPS = 30;
export const CLIP_BITS = 6_000_000;
export const MAX_RATIO = 3;
// what a browser records a clip as: an MP4 where it can (Safari, Chrome and Edge: it says inside that it's AI-made, like every
// video downloaded from AGI Studio: src/studio/ai-tag.js), else a WebM (Firefox) → its kinds, in order
export const CLIP_TYPES = [
  ['video/mp4;codecs=avc1.42E01F', 'mp4'], ['video/mp4;codecs=avc1', 'mp4'], ['video/mp4', 'mp4'],
  ['video/webm;codecs=vp9', 'webm'], ['video/webm;codecs=vp8', 'webm'], ['video/webm', 'webm'],
];
// the first one this browser records (supported: MediaRecorder.isTypeSupported) → { mime, ext } | null
export function clipType(supported) {
  if (typeof supported !== 'function') return null;
  for (const [mime, ext] of CLIP_TYPES) {
    try { if (supported(mime)) return { mime, ext }; } catch { /* a browser that throws for one: the next */ }
  }
  return null;
}
// a size of the same shape at most `long` px on its longest side, both sides even (video encoders want them so) → { w, h }
export function evenFit(w, h, long) {
  const W = Math.max(2, Number(w) || 0), H = Math.max(2, Number(h) || 0);
  const k = Math.min(1, long / Math.max(W, H));
  const even = (v) => Math.max(2, 2 * Math.round((v * k) / 2));
  return { w: even(W), h: even(H) };
}
// a picture's pixel ratio: enough for about `long` px on the longest side of a box w × h (never less than the screen's own,
// never more than MAX_RATIO)
export const ratioFor = (w, h, long, own = 1) => Math.min(MAX_RATIO, Math.max(Number(own) || 1, long / Math.max(1, Number(w) || 0, Number(h) || 0)));

// ---------- its backgrounds ----------
const pct = (v) => `${Math.round(v * 1000) / 10}%`;
// its CSS background (the stage's, or a chip's swatch: checker, Clear's squares' size in px) → a CSS value
export function backdropCss(key, { checker = 24 } = {}) {
  const b = BACKDROPS[key] || BACKDROPS[BACKDROP_DEFAULT];
  if (b.clear) return `conic-gradient(#2e2e38 25%, #1d1d25 0 50%, #2e2e38 0 75%, #1d1d25 0) 0 0 / ${checker}px ${checker}px`;
  if (b.color) return b.color;
  if (b.linear) return `linear-gradient(180deg, ${b.linear.map(([at, c]) => `${c} ${pct(at)}`).join(', ')})`;
  const { at, size, stops } = b.radial;
  return `radial-gradient(${pct(size[0])} ${pct(size[1])} at ${pct(at[0])} ${pct(at[1])}, ${stops.map(([s, c]) => `${c} ${pct(s)}`).join(', ')})`;
}
// its background drawn on a 2D canvas's context g (w × h), as the stage's CSS draws it → true, or false (Clear: nothing)
export function paintBackdrop(g, key, w, h) {
  const b = BACKDROPS[key];
  if (!b || b.clear) return false;
  if (b.color) {
    g.fillStyle = b.color;
    g.fillRect(0, 0, w, h);
    return true;
  }
  if (b.linear) {
    const grad = g.createLinearGradient(0, 0, 0, h);
    for (const [at, c] of b.linear) grad.addColorStop(at, c);
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    return true;
  }
  // an ellipse: a circle of radius 1 scaled to its radii (canvas gradients are circles)
  const { at, size, stops } = b.radial;
  const cx = at[0] * w, cy = at[1] * h, rx = Math.max(1e-6, size[0] * w), ry = Math.max(1e-6, size[1] * h);
  g.save();
  g.translate(cx, cy);
  g.scale(rx, ry);
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, 1);
  for (const [s, c] of stops) grad.addColorStop(s, c);
  g.fillStyle = grad;
  g.fillRect(-cx / rx, -cy / ry, w / rx, h / ry);
  g.restore();
  return true;
}

// a picture's or a clip's file name: its name, then what it is ("Nova-3D-picture.png", "Nova-3D-clip.mp4")
export function captureName(name, kind, ext) {
  const base = String(name ?? '').normalize('NFKD').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'AGI-Studio';
  return `${base}-3D-${kind === 'clip' ? 'clip' : 'picture'}.${ext}`;
}
