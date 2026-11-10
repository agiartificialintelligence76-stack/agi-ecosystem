// AUTOCOMPLETE (2026-11-09): the playfield, drawn on a canvas. "A phone keyboard from the future": a deep ink-violet
// night, the keys chunky cream keycaps with ink outlines that stand up off a keyboard deck (pressed: they sink), letters
// in heavy 'AK Display' and their points small in 'AK Mono'; a swipe lights its keys honey with a thick pink path;
// tokens are violet pills; glitch keys run red static. Over the board, AGI-1's suggestion strip like a phone's (her guess
// in 'AK Serif' italics, her pick highlighted) with her face beside it, reacting; over all that, the context window.
//
// Keys are drawn once per size into small canvases (sprites) and stamped each frame; nothing is allocated per frame in
// the hot paths but what a path needs.
import { roundRect, star, clamp, ease, TAU } from '../kit/fx.js';
import { COLS, ROWS, SIZE } from './solver.js';
import { cellCenter } from './layout.js';

export const COLOR = Object.freeze({
  night: '#15102c', deck: '#1f1745', deckRim: '#30265f', deckEdge: '#0a0618', dots: 'rgba(205,184,255,0.07)',
  ink: '#170a36', ink2: '#4a3d6e', cream: '#fff7e3', creamTop: '#fffcf3', creamSide: '#d6c08e',
  honey: '#ffc933', honeyTop: '#ffd96b', honeySide: '#c58a10', pink: '#ff4da6', violet: '#6b3bff', violet2: '#8b66ff',
  lav: '#e4d9ff', lav2: '#cdb8ff', mint: '#3ff0c3', red: '#ff5a5f', grey: '#b7aecb', greySide: '#7d7396', paper: '#fffaf0',
});
const DISPLAY = "'AK Display', 'Arial Black', system-ui, sans-serif";
const MONO = "'AK Mono', ui-monospace, monospace";
const SERIF = "'AK Serif', Georgia, serif";
const SANS = "'AK Sans', system-ui, sans-serif";

const offscreen = (w, h) => {
  const c = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
  return c;
};

// text that fits a width: the largest size from `size` down to `min`
function fitFont(g, text, weight, family, size, min, maxW) {
  let s = size;
  g.font = `${weight} ${s}px ${family}`;
  while (s > min && g.measureText(text).width > maxW) { s -= 1; g.font = `${weight} ${s}px ${family}`; }
  return s;
}

export function createRenderer() {
  let L = null, dpr = 1;
  const sprites = new Map();
  let bg = null, bgKey = '';
  let face = null;
  if (typeof Image === 'function') {
    face = new Image();
    face.decoding = 'async';
    face.src = '/images/landing/agi1-face.webp';
  }

  function setLayout(layout, ratio) {
    L = layout; dpr = ratio;
    sprites.clear();
  }

  // ---------- a key's face (its top, the label, its points), drawn once a size ----------
  // variant: 'n' a key, 's' a key in a swipe, 'g' a glitch key, 'x' a key once the run is over; label-only sprites
  // ('L…') are the letters drawn again over the pink path
  function capSprite(tile, variant) {
    const key = `${tile.s}|${variant}`;
    let c = sprites.get(key);
    if (c) return c;
    const s = Math.round(L.cap * dpr);
    const pad = Math.ceil(4 * dpr);
    c = offscreen(s + pad * 2, s + pad * 2);
    const g = c.getContext('2d');
    g.translate(pad, pad);
    const lw = Math.max(2 * dpr, s * 0.045);
    const rad = s * 0.2;
    const pal = variant === 's' ? [COLOR.honey, COLOR.honeyTop] : variant === 'x' ? ['#cfc7de', '#ddd6ea'] : variant === 'g' ? ['#ffe3e0', '#fff0ee'] : [COLOR.cream, COLOR.creamTop];
    if (!variant.startsWith('L')) {
      roundRect(g, lw / 2, lw / 2, s - lw, s - lw, rad);
      g.fillStyle = pal[0]; g.fill();
      // a soft light from above: the top third a little brighter
      g.save(); g.clip();
      g.fillStyle = pal[1];
      roundRect(g, lw, lw, s - lw * 2, s * 0.42, rad * 0.8); g.fill();
      g.restore();
      roundRect(g, lw / 2, lw / 2, s - lw, s - lw, rad);
      g.lineWidth = lw; g.strokeStyle = COLOR.ink; g.stroke();
    }
    drawLabel(g, tile, s, variant);
    // its points, small in a corner (not over the pink path)
    if (!variant.startsWith('L')) {
      g.font = `700 ${Math.round(s * 0.16)}px ${MONO}`;
      g.textAlign = 'right'; g.textBaseline = 'alphabetic';
      g.fillStyle = variant === 'x' ? 'rgba(74,61,110,0.5)' : 'rgba(74,61,110,0.78)';
      g.fillText(String(tile.value), s - s * 0.12, s - s * 0.1);
    }
    sprites.set(key, c);
    return c;
  }
  function drawLabel(g, tile, s, variant) {
    const text = tile.s.toUpperCase();
    const over = variant.startsWith('L');
    const ink = variant === 'x' || variant === 'Lx' ? COLOR.ink2 : COLOR.ink;
    if (tile.token) {
      // a tokenizer's pill
      const n = text.length;
      const pw = s * (n <= 2 ? 0.7 : n === 3 ? 0.8 : 0.86), ph = s * 0.4;
      const px = (s - pw) / 2, py = s * 0.47 - ph / 2;
      roundRect(g, px, py, pw, ph, ph / 2);
      g.fillStyle = variant === 'x' || variant === 'Lx' ? '#8f86a8' : COLOR.violet; g.fill();
      g.lineWidth = Math.max(1.5 * dpr, s * 0.03); g.strokeStyle = COLOR.ink; g.stroke();
      const size = fitFont(g, text, 900, DISPLAY, Math.round(s * (n <= 2 ? 0.27 : 0.23)), Math.round(s * 0.14), pw - s * 0.12);
      g.font = `900 ${size}px ${DISPLAY}`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = COLOR.paper;
      g.fillText(text, s / 2, py + ph / 2 + size * 0.04);
      return;
    }
    const size = Math.round(s * 0.5);
    g.font = `900 ${size}px ${DISPLAY}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (over) {
      g.lineJoin = 'round'; g.lineWidth = s * 0.09; g.strokeStyle = COLOR.honey;
      g.strokeText(text, s / 2, s * 0.47 + size * 0.04);
    }
    g.fillStyle = ink;
    g.fillText(text, s / 2, s * 0.47 + size * 0.04);
  }

  // ---------- the background: the night, a faint dot grid, the keyboard deck ----------
  function background(g, w, h) {
    const key = `${w}x${h}@${dpr}|${L.board.x},${L.board.y},${L.pitch}`;
    if (!bg || bgKey !== key) {
      bgKey = key;
      bg = offscreen(Math.max(1, Math.round(w * dpr)), Math.max(1, Math.round(h * dpr)));
      const b = bg.getContext('2d');
      b.scale(dpr, dpr);
      b.fillStyle = COLOR.night; b.fillRect(0, 0, w, h);
      // a soft glow behind the board, then the dots
      const gr = b.createRadialGradient(L.board.x + L.board.w / 2, L.board.y + L.board.h * 0.45, L.pitch, L.board.x + L.board.w / 2, L.board.y + L.board.h * 0.45, Math.max(w, h) * 0.7);
      gr.addColorStop(0, '#221a4a'); gr.addColorStop(1, COLOR.night);
      b.fillStyle = gr; b.fillRect(0, 0, w, h);
      const step = Math.max(18, L.pitch * 0.34);
      b.fillStyle = COLOR.dots;
      for (let y = step / 2; y < h; y += step) for (let x = step / 2; x < w; x += step) b.fillRect(x - 1, y - 1, 2, 2);
      // the deck: a tray the keys sit in
      const m = L.pitch * 0.12;
      const dx = L.board.x - m, dy = L.board.y - m, dw = L.board.w + m * 2, dh = L.board.h + m * 2 + L.depth;
      roundRect(b, dx, dy + 6, dw, dh, L.pitch * 0.28); b.fillStyle = 'rgba(5,2,14,0.55)'; b.fill();
      roundRect(b, dx, dy, dw, dh, L.pitch * 0.28); b.fillStyle = COLOR.deck; b.fill();
      b.lineWidth = 2; b.strokeStyle = COLOR.deckEdge; b.stroke();
      roundRect(b, dx + 2, dy + 2, dw - 4, dh - 4, L.pitch * 0.26); b.strokeStyle = COLOR.deckRim; b.lineWidth = 1.5; b.stroke();
    }
    g.drawImage(bg, 0, 0, w, h);
  }

  // ---------- the board ----------
  // st: { tiles, vis (id → { y, scale, wobble, flash }), sel (cells), selSet, over (0..1: the run ended), ghost
  //       ({ path, from }), hint ({ path, t }), finger ({ x, y, down }), t, glitchT, fade (a path fading out) }
  function drawBoard(g, st) {
    const cap = L.cap, d = L.depth, half = cap / 2, sel = st.selSet;
    // the keys, top row first (a key falling into a row below never hides under it)
    for (let i = 0; i < SIZE; i++) {
      const tile = st.tiles[i];
      if (!tile) continue;
      const v = st.vis.get(tile.id);
      const c = cellCenter(L, i);
      let x = c.x, y = c.y + (v ? v.y * L.pitch : 0);
      const sc = v ? v.scale : 1;
      if (sc <= 0.01) continue;
      if (v && v.wobble > 0) x += Math.sin(st.t * 60 + i) * v.wobble * L.pitch * 0.06;
      const inSel = sel.has(i);
      const press = inSel ? 1 : (v ? v.press : 0);
      const variant = st.over > 0.5 ? 'x' : inSel ? 's' : tile.glitch ? 'g' : 'n';
      const lift = d * (1 - press * 0.7);
      g.save();
      if (sc !== 1) { g.translate(x, y); g.scale(sc, sc); g.translate(-x, -y); }
      // its sides (the key stands up), then its face
      roundRect(g, x - half, y - half + lift, cap, cap, cap * 0.2);
      g.fillStyle = variant === 's' ? COLOR.honeySide : variant === 'x' ? COLOR.greySide : variant === 'g' ? '#c9434b' : COLOR.creamSide;
      g.fill(); g.lineWidth = Math.max(2, cap * 0.045); g.strokeStyle = COLOR.ink; g.stroke();
      const spr = capSprite(tile, variant);
      const pad = (spr.width / dpr - cap) / 2;
      g.drawImage(spr, x - half - pad, y - half + d * press * 0.7 - pad, spr.width / dpr, spr.height / dpr);
      if (tile.glitch && variant !== 'x') glitchOverlay(g, x, y + d * press * 0.7, tile, st);
      if (v && v.flash > 0) {
        roundRect(g, x - half, y - half + d * press * 0.7, cap, cap, cap * 0.2);
        g.fillStyle = `rgba(255,255,255,${(v.flash * 0.7).toFixed(3)})`; g.fill();
      }
      g.restore();
    }
    if (st.hint) drawHint(g, st);
    if (st.ghost) drawGhost(g, st);
    if (st.fade) drawPath(g, st, st.fade.path, null, st.fade.a, true);
    if (st.sel.length) drawPath(g, st, st.sel, st.finger && st.finger.down ? st.finger : null, 1, false);
    if (st.finger && st.finger.show) drawFinger(g, st.finger);
  }

  function centerOf(st, i) {
    const c = cellCenter(L, i);
    const tile = st.tiles[i];
    const v = tile && st.vis.get(tile.id);
    return { x: c.x, y: c.y + (v ? v.y * L.pitch : 0) + L.depth * 0.7 };
  }

  // the swipe: a thick pink line with an ink edge through its keys' centres, and their letters drawn again on top
  function drawPath(g, st, path, finger, alpha, faded) {
    if (!path.length) return;
    g.save();
    g.globalAlpha = alpha;
    g.lineCap = 'round'; g.lineJoin = 'round';
    const pts = path.map((i) => centerOf(st, i));
    const trace = () => {
      g.beginPath();
      g.moveTo(pts[0].x, pts[0].y);
      for (let k = 1; k < pts.length; k++) g.lineTo(pts[k].x, pts[k].y);
      if (finger) g.lineTo(finger.x, finger.y);
    };
    const w = L.pitch * 0.17;
    if (pts.length > 1 || finger) {
      trace(); g.strokeStyle = COLOR.ink; g.lineWidth = w + Math.max(5, L.pitch * 0.08); g.stroke();
      trace(); g.strokeStyle = faded ? '#9c8fbf' : COLOR.pink; g.lineWidth = w; g.stroke();
    }
    // a dot on each key the path goes through
    for (const p of pts) {
      g.beginPath(); g.arc(p.x, p.y, w * 0.95, 0, TAU);
      g.fillStyle = faded ? '#9c8fbf' : COLOR.pink; g.fill();
      g.lineWidth = Math.max(2.5, L.pitch * 0.04); g.strokeStyle = COLOR.ink; g.stroke();
    }
    // the letters over the path
    for (let k = 0; k < path.length; k++) {
      const tile = st.tiles[path[k]];
      if (!tile) continue;
      const spr = capSprite(tile, faded ? 'Lx' : 'L');
      const pad = (spr.width / dpr - L.cap) / 2;
      const c = centerOf(st, path[k]);
      g.drawImage(spr, c.x - L.cap / 2 - pad, c.y - L.depth * 0.7 + L.depth * 0.7 - L.cap / 2 - pad, spr.width / dpr, spr.height / dpr);
    }
    g.restore();
  }

  // her guess, very faint: where its path would go next
  function drawGhost(g, st) {
    const { path, from } = st.ghost;
    if (!path || path.length <= from) return;
    const pts = path.slice(Math.max(0, from - 1)).map((i) => centerOf(st, i));
    g.save();
    g.globalAlpha = st.ghost.a ?? 0.85;
    g.setLineDash([L.pitch * 0.07, L.pitch * 0.11]);
    g.lineDashOffset = -st.t * L.pitch * 0.6;
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
    for (let k = 1; k < pts.length; k++) g.lineTo(pts[k].x, pts[k].y);
    g.strokeStyle = 'rgba(205,184,255,0.55)'; g.lineWidth = L.pitch * 0.07; g.stroke();
    g.setLineDash([]);
    for (let k = 1; k < pts.length; k++) {
      const p = pts[k];
      g.beginPath(); g.arc(p.x, p.y, L.cap * 0.42, 0, TAU);
      g.strokeStyle = 'rgba(205,184,255,0.5)'; g.lineWidth = Math.max(2, L.pitch * 0.035); g.stroke();
    }
    g.restore();
  }

  // the word she completes for you: its path in honey, its keys numbered
  function drawHint(g, st) {
    const pts = st.hint.path.map((i) => centerOf(st, i));
    const pulse = 0.75 + 0.25 * Math.sin(st.t * 6);
    g.save();
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.setLineDash([L.pitch * 0.12, L.pitch * 0.1]);
    g.lineDashOffset = -st.t * L.pitch * 0.8;
    g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
    for (let k = 1; k < pts.length; k++) g.lineTo(pts[k].x, pts[k].y);
    g.strokeStyle = `rgba(255,201,51,${(0.85 * pulse).toFixed(3)})`; g.lineWidth = L.pitch * 0.1; g.stroke();
    g.setLineDash([]);
    const r = L.pitch * 0.15;
    pts.forEach((p, k) => {
      const bx = p.x - L.cap * 0.32, by = p.y - L.cap * 0.32 - L.depth * 0.7;
      g.beginPath(); g.arc(bx, by, r, 0, TAU);
      g.fillStyle = COLOR.honey; g.fill(); g.lineWidth = 2; g.strokeStyle = COLOR.ink; g.stroke();
      g.font = `900 ${Math.round(r * 1.2)}px ${DISPLAY}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = COLOR.ink; g.fillText(String(k + 1), bx, by + r * 0.06);
    });
    g.restore();
  }

  // a glitch key: red static, its letter split in two colours, the words it has left
  function glitchOverlay(g, x, y, tile, st) {
    const cap = L.cap, half = cap / 2;
    g.save();
    roundRect(g, x - half, y - half, cap, cap, cap * 0.2); g.clip();
    const t = st.t;
    for (let k = 0; k < 5; k++) {
      const yy = y - half + ((Math.sin(t * (7 + k * 3.1) + k * 9.7) * 0.5 + 0.5) * cap);
      g.fillStyle = k % 2 ? 'rgba(255,90,95,0.35)' : 'rgba(63,240,195,0.22)';
      g.fillRect(x - half, yy, cap, Math.max(1.5, cap * (0.03 + 0.03 * ((k * 7) % 3))));
    }
    const text = tile.s.toUpperCase();
    const size = Math.round(cap * (tile.token ? 0.27 : 0.5));
    g.font = `900 ${size}px ${DISPLAY}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const j = 1.5 + Math.abs(Math.sin(t * 13)) * 2;
    g.globalAlpha = 0.85;
    g.fillStyle = 'rgba(255,90,95,0.9)'; g.fillText(text, x - j, y - cap * 0.03 + size * 0.04);
    g.fillStyle = 'rgba(63,240,195,0.8)'; g.fillText(text, x + j, y - cap * 0.03 + size * 0.04);
    g.globalAlpha = 1;
    g.restore();
    // the countdown
    const r = cap * 0.17, bx = x + half - r * 0.55, by = y - half + r * 0.55;
    g.beginPath(); g.arc(bx, by, r, 0, TAU);
    g.fillStyle = COLOR.red; g.fill(); g.lineWidth = 2.5; g.strokeStyle = COLOR.ink; g.stroke();
    g.font = `900 ${Math.round(r * 1.25)}px ${DISPLAY}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = COLOR.paper; g.fillText(String(tile.glitch), bx, by + r * 0.08);
  }

  // a finger (the demo's, the lesson's)
  function drawFinger(g, f) {
    const r = L.pitch * (f.down ? 0.2 : 0.24);
    g.save();
    g.globalAlpha = f.alpha ?? 0.9;
    g.beginPath(); g.arc(f.x + 3, f.y + 5, r, 0, TAU); g.fillStyle = 'rgba(10,5,24,0.35)'; g.fill();
    g.beginPath(); g.arc(f.x, f.y, r, 0, TAU);
    g.fillStyle = 'rgba(255,250,240,0.92)'; g.fill();
    g.lineWidth = 3; g.strokeStyle = COLOR.ink; g.stroke();
    if (f.down) { g.beginPath(); g.arc(f.x, f.y, r * 1.55, 0, TAU); g.lineWidth = 2; g.strokeStyle = 'rgba(255,250,240,0.5)'; g.stroke(); }
    g.restore();
  }

  // ---------- her suggestion strip ----------
  // s: { word (your letters so far, upper case), valid, partial, guesses ([{ word }]), following, passed, hidden,
  //      result ({ kind, line, points, t }), invalid ({ t }), t, idle }
  function drawStrip(g, s) {
    const R = L.strip;
    const r = Math.min(16, R.h * 0.3);
    const shake = s.invalid ? Math.sin(s.invalid.t * 70) * Math.max(0, 1 - s.invalid.t / 0.35) * 6 : 0;
    const x = R.x + shake, y = R.y, w = R.w, h = R.h;
    // the panel: a cream key, standing up like the others
    roundRect(g, x, y + 4, w, h, r); g.fillStyle = COLOR.creamSide; g.fill(); g.lineWidth = 2.5; g.strokeStyle = COLOR.ink; g.stroke();
    roundRect(g, x, y, w, h, r); g.fillStyle = COLOR.cream; g.fill(); g.stroke();
    g.save();
    roundRect(g, x + 1.5, y + 1.5, w - 3, h - 3, r - 1); g.clip();
    if (s.result) drawResult(g, s, x, y, w, h);
    else drawSlots(g, s, x, y, w, h);
    g.restore();
  }
  function drawSlots(g, s, x, y, w, h) {
    const wl = w * 0.33, wm = w * 0.37, wr = w - wl - wm;
    const mx = x + wl, rx = mx + wm;
    const cy = y + h / 2;
    // her pick's slot: highlighted
    const pick = s.guesses && s.guesses[0];
    if (pick || s.hidden) {
      roundRect(g, mx + 3, y + 5, wm - 6, h - 10, Math.min(12, h * 0.24));
      g.fillStyle = s.hint ? COLOR.honey : s.following === false ? '#efe6cf' : '#ffe08a';
      g.fill();
    }
    // the dividers
    g.fillStyle = 'rgba(23,10,54,0.18)';
    g.fillRect(mx, y + h * 0.22, 1.5, h * 0.56); g.fillRect(rx, y + h * 0.22, 1.5, h * 0.56);
    // your letters
    if (s.word) {
      const size = fitFont(g, s.word, 900, DISPLAY, Math.round(h * 0.36), 10, wl - 18);
      g.font = `900 ${size}px ${DISPLAY}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = s.valid ? COLOR.ink : COLOR.ink2;
      g.fillText(s.word, x + wl / 2, cy + size * 0.05);
      if (s.valid) {
        const tw = g.measureText(s.word).width;
        const dx = Math.min(x + wl - 7, x + wl / 2 + tw / 2 + 7);
        g.beginPath(); g.arc(dx, cy - size * 0.32, Math.max(3.5, h * 0.07), 0, TAU); g.fillStyle = '#12b886'; g.fill();
      }
    } else {
      g.font = `600 ${Math.round(h * 0.24)}px ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = 'rgba(74,61,110,0.55)';
      g.fillText(s.idleLeft || 'swipe', x + wl / 2, cy);
    }
    // her pick and her next guess, in her voice
    const serif = (text, cx, maxW, size, color, alpha = 1) => {
      const sz = fitFont(g, text, 'italic 400', SERIF, size, 10, maxW);
      g.font = `italic 400 ${sz}px ${SERIF}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.globalAlpha = alpha; g.fillStyle = color; g.fillText(text, cx, cy + sz * 0.06); g.globalAlpha = 1;
      return sz;
    };
    if (s.hidden && (s.word || '').length >= 2) {
      serif('? ? ?', mx + wm / 2, wm - 16, Math.round(h * 0.42), COLOR.ink2);
    } else if (pick) {
      const sz = Math.round(h * 0.46);
      const word = pick.word;
      if (s.following !== false && s.word && word.startsWith(s.word.toLowerCase())) {
        // the letters you have in ink, hers in violet (like a phone finishing your word)
        const have = s.word.toLowerCase().length;
        const size = fitFont(g, word, 'italic 400', SERIF, sz, 10, wm - 16);
        g.font = `italic 400 ${size}px ${SERIF}`; g.textBaseline = 'middle'; g.textAlign = 'left';
        const tw = g.measureText(word).width;
        const x0 = mx + wm / 2 - tw / 2;
        g.fillStyle = COLOR.ink; g.fillText(word.slice(0, have), x0, cy + size * 0.06);
        g.fillStyle = COLOR.violet; g.fillText(word.slice(have), x0 + g.measureText(word.slice(0, have)).width, cy + size * 0.06);
      } else {
        const size = serif(word, mx + wm / 2, wm - 16, sz, COLOR.ink2, 0.55);
        // crossed out: you left her guess behind
        g.font = `italic 400 ${size}px ${SERIF}`;
        const tw = g.measureText(word).width;
        g.strokeStyle = 'rgba(255,77,166,0.85)'; g.lineWidth = 2.5; g.lineCap = 'round';
        g.beginPath(); g.moveTo(mx + wm / 2 - tw / 2 - 3, cy + 1); g.lineTo(mx + wm / 2 + tw / 2 + 3, cy - 1); g.stroke();
      }
      if (s.hint) {
        g.font = `900 ${Math.round(h * 0.15)}px ${DISPLAY}`; g.textAlign = 'center'; g.textBaseline = 'top';
        g.fillStyle = COLOR.ink; g.fillText('HER HINT', mx + wm / 2, y + h * 0.1);
      }
    } else if ((s.word || '').length >= 2) {
      serif('no idea…', mx + wm / 2, wm - 16, Math.round(h * 0.38), COLOR.ink2, 0.7);
    } else {
      // listening: three dots breathing
      for (let k = 0; k < 3; k++) {
        const a = 0.35 + 0.45 * Math.max(0, Math.sin(s.t * 4 - k * 0.7));
        g.beginPath(); g.arc(mx + wm / 2 + (k - 1) * h * 0.18, cy, h * 0.055, 0, TAU);
        g.fillStyle = `rgba(74,61,110,${a.toFixed(3)})`; g.fill();
      }
    }
    const second = s.guesses && !s.hidden && s.guesses[1];
    if (second) serif(second.word, rx + wr / 2, wr - 14, Math.round(h * 0.38), COLOR.ink2, 0.85);
  }
  // after a word: her line across the strip, and how it did, as a sticker
  function drawResult(g, s, x, y, w, h) {
    const res = s.result;
    const k = Math.min(1, res.t / 0.18);
    const tone = res.kind === 'longer' ? COLOR.mint : res.kind === 'surprise' ? COLOR.pink : res.kind === 'invalid' ? '#ffd0d6' : res.kind === 'predictable' ? COLOR.lav : COLOR.honey;
    g.fillStyle = tone;
    g.globalAlpha = 0.28 * k;
    g.fillRect(x, y, w, h);
    g.globalAlpha = 1;
    // the badge on the left
    const label = res.badge;
    let left = x + 12;
    if (label) {
      g.font = `900 ${Math.round(h * 0.26)}px ${DISPLAY}`;
      const bw = Math.min(w * 0.42, g.measureText(label).width + h * 0.4), bh = h * 0.5;
      const bx = x + 10, by = y + (h - bh) / 2;
      const sc = ease.outBack(k);
      g.save();
      g.translate(bx + bw / 2, by + bh / 2); g.rotate(-0.06); g.scale(sc, sc); g.translate(-(bx + bw / 2), -(by + bh / 2));
      roundRect(g, bx, by, bw, bh, bh / 2);
      g.fillStyle = tone; g.fill(); g.lineWidth = 2.5; g.strokeStyle = COLOR.ink; g.stroke();
      const size = fitFont(g, label, 900, DISPLAY, Math.round(h * 0.26), 9, bw - h * 0.3);
      g.font = `900 ${size}px ${DISPLAY}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = COLOR.ink; g.fillText(label, bx + bw / 2, by + bh / 2 + size * 0.06);
      g.restore();
      left = bx + bw + 10;
    }
    // her line
    const maxW = x + w - 12 - left;
    const line = res.line || '';
    let size = fitFont(g, line, 'italic 400', SERIF, Math.round(h * 0.36), Math.round(h * 0.26), maxW);
    g.font = `italic 400 ${size}px ${SERIF}`; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillStyle = COLOR.ink;
    g.globalAlpha = k;
    if (g.measureText(line).width <= maxW) g.fillText(line, left, y + h / 2 + size * 0.06);
    else {
      // two lines
      size = Math.round(h * 0.27);
      g.font = `italic 400 ${size}px ${SERIF}`;
      const words = line.split(' ');
      let a = '', b = '';
      for (const wd of words) { if (!b && g.measureText(`${a} ${wd}`.trim()).width <= maxW) a = `${a} ${wd}`.trim(); else b = `${b} ${wd}`.trim(); }
      g.fillText(a, left, y + h / 2 - size * 0.52);
      g.fillText(b, left, y + h / 2 + size * 0.62);
    }
    g.globalAlpha = 1;
  }

  // ---------- her face ----------
  // f: { mood: 'idle' | 'watch' | 'smug' | 'nervous' | 'shock' | 'happy' | 'sad' | 'think' | 'worried', t (s in the mood), T (clock) }
  function drawFace(g, f) {
    const F = L.face;
    let x = F.x, y = F.y, r = F.r, rot = 0, sc = 1;
    const T = f.T;
    y += Math.sin(T * 2.1) * 1.2;
    const mt = f.t;
    if (f.mood === 'shock') { const k = Math.min(1, mt / 0.35); sc = 1 + 0.28 * Math.sin(Math.PI * Math.min(1, mt / 0.5)) ; y -= Math.sin(Math.PI * Math.min(1, mt / 0.4)) * r * 0.35; rot = Math.sin(mt * 30) * 0.08 * (1 - k); }
    else if (f.mood === 'smug') rot = -0.12 * Math.min(1, mt / 0.2);
    else if (f.mood === 'nervous' || f.mood === 'worried') { x += Math.sin(T * 38) * 1.1; rot = 0.05; }
    else if (f.mood === 'happy') { y -= Math.abs(Math.sin(mt * 9)) * r * 0.16 * Math.max(0, 1 - mt / 0.9); }
    else if (f.mood === 'sad') { y += r * 0.06; rot = 0.1; }
    else if (f.mood === 'watch') rot = 0.06;
    else if (f.mood === 'think') rot = Math.sin(T * 3) * 0.05;
    g.save();
    g.translate(x, y); g.rotate(rot); g.scale(sc, sc);
    // its sticker: a hard shadow, a lavender disc, her face, an ink ring
    g.beginPath(); g.arc(0, 4, r, 0, TAU); g.fillStyle = COLOR.ink; g.fill();
    g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fillStyle = COLOR.lav; g.fill();
    if (face && face.complete && face.naturalWidth) {
      g.save(); g.beginPath(); g.arc(0, 0, r - 1, 0, TAU); g.clip();
      g.drawImage(face, -r, -r, r * 2, r * 2);
      g.restore();
    }
    g.beginPath(); g.arc(0, 0, r, 0, TAU); g.lineWidth = Math.max(2.5, r * 0.09); g.strokeStyle = COLOR.ink; g.stroke();
    // what she feels, drawn over
    if (f.mood === 'shock' || f.mood === 'happy' || f.mood === 'smug') blush(g, r, f.mood === 'shock' ? 0.55 : 0.35);
    g.restore();
    if (f.mood === 'shock') marks(g, x, y, r, mt, '!');
    else if (f.mood === 'sad' || f.mood === 'think') marks(g, x, y, r, mt, '?');
    else if (f.mood === 'nervous' || f.mood === 'worried') sweat(g, x, y, r, T);
    else if (f.mood === 'smug') sparkle(g, x, y, r, T);
    else if (f.mood === 'happy') heart(g, x + r * 0.95, y - r * 0.85 - Math.min(1, mt * 2) * r * 0.3, r * 0.32, Math.max(0, 1 - mt / 1.2));
  }
  function blush(g, r, a) {
    g.fillStyle = `rgba(255,105,150,${a})`;
    for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(sx * r * 0.42, r * 0.3, r * 0.17, r * 0.09, 0, 0, TAU); g.fill(); }
  }
  function marks(g, x, y, r, t, ch) {
    const k = Math.min(1, t / 0.25);
    g.save();
    g.font = `900 ${Math.round(r * 0.8)}px ${DISPLAY}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.lineWidth = Math.max(3, r * 0.14); g.strokeStyle = COLOR.ink;
    const n = ch === '!' ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const px = x + r * (0.95 + i * 0.42), py = y - r * (0.8 - i * 0.12) - (1 - k) * r * 0.4;
      g.save(); g.translate(px, py); g.rotate(0.18 + i * 0.12); g.scale(ease.outBack(k), ease.outBack(k));
      g.strokeText(ch, 0, 0); g.fillStyle = ch === '!' ? COLOR.pink : COLOR.lav; g.fillText(ch, 0, 0);
      g.restore();
    }
    g.restore();
  }
  function sweat(g, x, y, r, T) {
    const px = x + r * 0.82, py = y - r * 0.55 + (T * 30 % 10) * 0.2;
    g.save();
    g.beginPath();
    g.moveTo(px, py - r * 0.28);
    g.quadraticCurveTo(px + r * 0.2, py, px, py + r * 0.12);
    g.quadraticCurveTo(px - r * 0.2, py, px, py - r * 0.28);
    g.fillStyle = '#9fdcff'; g.fill(); g.lineWidth = 2; g.strokeStyle = COLOR.ink; g.stroke();
    g.restore();
  }
  function sparkle(g, x, y, r, T) {
    const s = r * (0.26 + 0.05 * Math.sin(T * 7));
    star(g, x + r * 0.95, y - r * 0.8, s, s * 0.38, 4, T * 0.8);
    g.fillStyle = COLOR.honey; g.fill(); g.lineWidth = 2; g.strokeStyle = COLOR.ink; g.stroke();
  }
  function heart(g, x, y, s, a) {
    if (a <= 0) return;
    g.save(); g.globalAlpha = a;
    g.beginPath();
    g.moveTo(x, y + s * 0.35);
    g.bezierCurveTo(x - s * 0.9, y - s * 0.25, x - s * 0.35, y - s * 0.9, x, y - s * 0.35);
    g.bezierCurveTo(x + s * 0.35, y - s * 0.9, x + s * 0.9, y - s * 0.25, x, y + s * 0.35);
    g.fillStyle = COLOR.pink; g.fill(); g.lineWidth = 2; g.strokeStyle = COLOR.ink; g.stroke();
    g.restore();
  }

  // ---------- the context window (Endless), the clock (Daily), Zen's calm ----------
  // c: { label, value (0..1), low, glow (0..1), t, score (a demo shows it here) }
  function drawContext(g, c) {
    const R = L.ctx;
    g.save();
    g.font = `850 ${Math.round(Math.min(11, R.h * 0.8))}px ${DISPLAY}`;
    g.textAlign = 'left'; g.textBaseline = 'middle';
    const label = c.label;
    const lw = g.measureText(label).width + 10;
    g.fillStyle = c.low ? COLOR.pink : COLOR.lav2;
    g.fillText(label, R.x, R.y + R.h / 2 + 1);
    let right = R.x + R.w;
    if (c.score != null) {
      g.font = `750 ${Math.round(R.h * 1.15)}px ${MONO}`;
      g.textAlign = 'right';
      g.fillStyle = COLOR.paper;
      g.fillText(c.score, right, R.y + R.h / 2 + 1);
      right -= g.measureText(c.score).width + 12;
    }
    const bx = R.x + lw, bw = Math.max(20, right - bx), by = R.y, bh = R.h;
    roundRect(g, bx, by, bw, bh, bh / 2); g.fillStyle = '#0c0820'; g.fill();
    g.lineWidth = 2; g.strokeStyle = '#3a2f6b'; g.stroke();
    const v = clamp(c.value, 0, 1);
    if (v > 0) {
      const fw = Math.max(bh, (bw - 4) * v);
      const pulse = c.low ? 0.65 + 0.35 * Math.sin(c.t * 9) : 1;
      roundRect(g, bx + 2, by + 2, fw, bh - 4, (bh - 4) / 2);
      g.fillStyle = c.color || (v > 0.5 ? COLOR.mint : v > 0.22 ? COLOR.honey : COLOR.red);
      g.globalAlpha = pulse; g.fill(); g.globalAlpha = 1;
      if (c.glow > 0) {
        roundRect(g, bx + 2, by + 2, fw, bh - 4, (bh - 4) / 2);
        g.fillStyle = `rgba(255,255,255,${(c.glow * 0.65).toFixed(3)})`; g.fill();
        roundRect(g, bx - 2, by - 2, bw + 4, bh + 4, bh / 2 + 2);
        g.strokeStyle = `rgba(63,240,195,${(c.glow * 0.8).toFixed(3)})`; g.lineWidth = 2; g.stroke();
      }
    }
    g.restore();
  }

  // ---------- big words over the board: SIX! SEVEN!! ----------
  function drawStamp(g, st) {
    const k = st.t / st.dur;
    if (k >= 1) return;
    const sIn = ease.outBack(Math.min(1, st.t / 0.22), 2.2);
    const a = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
    const size = L.pitch * st.size;
    g.save();
    g.globalAlpha = a;
    g.translate(st.x, st.y); g.rotate(st.rot); g.scale(sIn * (1 + (2 - sIn) * 0), sIn);
    g.font = `900 ${Math.round(size)}px ${DISPLAY}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = size * 0.2; g.strokeStyle = COLOR.ink; g.strokeText(st.text, 0, size * 0.1);
    g.fillStyle = COLOR.ink; g.fillText(st.text, 0, size * 0.1);
    g.lineWidth = size * 0.14; g.strokeText(st.text, 0, 0);
    g.fillStyle = st.color; g.fillText(st.text, 0, 0);
    g.restore();
  }

  // a word flying up to the score: a sticker pill
  function drawFlyer(g, f) {
    const k = clamp(f.t / f.dur, 0, 1);
    const e = ease.inOutCubic(k);
    const x = f.x0 + (f.x1 - f.x0) * e;
    const y = f.y0 + (f.y1 - f.y0) * e - Math.sin(Math.PI * e) * L.pitch * 0.8;
    const sc = k < 0.15 ? ease.outBack(k / 0.15) : 1 - 0.55 * e;
    const text = f.text;
    const size = Math.round(L.pitch * 0.32);
    g.save();
    g.translate(x, y); g.scale(sc, sc);
    g.font = `900 ${size}px ${DISPLAY}`;
    const tw = g.measureText(text).width;
    const w = tw + size * 1.1, h = size * 1.6;
    roundRect(g, -w / 2, -h / 2 + 3, w, h, h / 2); g.fillStyle = COLOR.ink; g.fill();
    roundRect(g, -w / 2, -h / 2, w, h, h / 2); g.fillStyle = f.color; g.fill(); g.lineWidth = 2.5; g.strokeStyle = COLOR.ink; g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = COLOR.ink;
    g.fillText(text, 0, size * 0.06);
    g.restore();
  }

  return {
    setLayout, background, drawBoard, drawStrip, drawFace, drawContext, drawStamp, drawFlyer, drawFinger, centerOf,
    get layout() { return L; },
  };
}
