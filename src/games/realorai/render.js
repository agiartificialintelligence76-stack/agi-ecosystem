// REAL OR AI? (2026-11-08): what the photo lab looks like, drawn on two canvases: the table (its ink-violet top, film
// grain, the safelight's red-violet glow in the corners, strips of film along wide screens' edges), the stack of prints
// face down, the print in play (its white border, the photo, its stamp, its ✓ / ✗, the clues circled in grease pencil),
// and over everything the loupe. Static layers are drawn once into offscreen canvases; a frame only puts them together.
import {
  INK, PAPER, TABLE, HONEY, VIOLET, DISPLAY, MONO, SERIF, PRINT,
  canvasOf, rrect, makeStamp, makeBadge, makeGrain, makePaper, makeBack, makeTape, loopPath,
} from './art.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const outBack = (t, s = 1.7) => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2;
const outCubic = (t) => 1 - (1 - t) ** 3;
const inQuad = (t) => t * t;

export function createRenderer({ reduced = false } = {}) {
  const sprites = {
    ai: makeStamp('ai'), real: makeStamp('real'), ok: makeBadge(true), bad: makeBadge(false),
    grain: makeGrain(), paper: makePaper(), back: makeBack(420), tape: makeTape(),
  };
  let bg = null, bgW = 0, bgH = 0, bgDpr = 1, bgStrips = false;
  let grainPat = null, paperPat = null, patCtx = null;
  const loops = new Map();          // a clue's pencil loop, by picture and clue

  function patterns(ctx) {
    if (patCtx === ctx && grainPat) return;
    patCtx = ctx;
    grainPat = ctx.createPattern(sprites.grain, 'repeat');
    paperPat = ctx.createPattern(sprites.paper, 'repeat');
  }

  // ---------- the table ----------
  function buildTable(w, h, dpr, { strips = false } = {}) {
    bgW = w; bgH = h; bgDpr = dpr; bgStrips = strips;
    bg = canvasOf(w * dpr, h * dpr);
    const g = bg.getContext('2d');
    g.scale(dpr, dpr);
    g.fillStyle = TABLE;
    g.fillRect(0, 0, w, h);
    const m = Math.max(w, h);
    // the safelight: warm red-violet from the top-left, cooler violet from the bottom-right
    let rg = g.createRadialGradient(0, 0, 0, 0, 0, m * 0.75);
    rg.addColorStop(0, 'rgba(255, 64, 120, 0.2)');
    rg.addColorStop(0.45, 'rgba(255, 64, 120, 0.07)');
    rg.addColorStop(1, 'rgba(255, 64, 120, 0)');
    g.fillStyle = rg; g.fillRect(0, 0, w, h);
    rg = g.createRadialGradient(w, h, 0, w, h, m * 0.7);
    rg.addColorStop(0, 'rgba(139, 70, 255, 0.17)');
    rg.addColorStop(0.5, 'rgba(139, 70, 255, 0.05)');
    rg.addColorStop(1, 'rgba(139, 70, 255, 0)');
    g.fillStyle = rg; g.fillRect(0, 0, w, h);
    // the edges a little darker
    rg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, m * 0.78);
    rg.addColorStop(0, 'rgba(6, 4, 18, 0)');
    rg.addColorStop(1, 'rgba(6, 4, 18, 0.42)');
    g.fillStyle = rg; g.fillRect(0, 0, w, h);
    // strips of film along the sides (wide screens, where the margins are empty)
    if (strips) for (const x of [16, w - 16 - 40]) filmStrip(g, x, h);
  }
  function filmStrip(g, x, h) {
    const sw = 40;
    g.save();
    g.fillStyle = 'rgba(4, 3, 12, 0.5)';
    g.fillRect(x, -10, sw, h + 20);
    g.fillStyle = 'rgba(255, 250, 240, 0.055)';
    for (let y = 8; y < h; y += 22) {
      rrect(g, x + 5, y, 7, 11, 2); g.fill();
      rrect(g, x + sw - 12, y, 7, 11, 2); g.fill();
    }
    g.fillStyle = 'rgba(255, 201, 51, 0.12)';
    g.font = `600 9px ${MONO}`;
    g.translate(x + sw / 2 + 3, 0);
    g.rotate(Math.PI / 2);
    for (let y = 40, n = 1; y < h; y += 150, n++) g.fillText(`${String(n).padStart(2, '0')}A  ▸`, y, 0);
    g.restore();
  }

  function drawTable(ctx, w, h, t, { strips = false } = {}) {
    const dpr = ctx.getTransform().a;
    if (!bg || bgW !== w || bgH !== h || bgDpr !== dpr || bgStrips !== strips) buildTable(w, h, dpr, { strips });
    ctx.drawImage(bg, 0, 0, w, h);
    patterns(ctx);
    // film grain, its specks moving 12 times a second (still with "reduce motion")
    const step = reduced ? 0 : Math.floor(t * 12);
    const ox = (step * 73) % 192, oy = (step * 131) % 192;
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.translate(-ox, -oy);
    ctx.fillStyle = grainPat;
    ctx.fillRect(0, 0, w + 192, h + 192);
    ctx.restore();
  }
  function invalidate() { bg = null; }

  // an edge of the screen tinted the way a swipe is heading (AI pink-violet on the left, REAL mint on the right)
  function drawEdge(ctx, w, h, side, a) {
    if (a <= 0.01) return;
    const x0 = side < 0 ? 0 : w, x1 = side < 0 ? w * 0.32 : w * 0.68;
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    const c = side < 0 ? '255, 77, 166' : '63, 240, 195';
    g.addColorStop(0, `rgba(${c}, ${0.26 * a})`);
    g.addColorStop(1, `rgba(${c}, 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(Math.min(x0, x1), 0, Math.abs(x1 - x0), h);
  }

  // ---------- a print ----------
  // geometry of a print `W` wide, its middle at 0,0: { W, H, px, py, ps } (the photo's square)
  function printGeo(W) {
    const H = W * PRINT.ratio;
    return { W, H, px: -W / 2 + PRINT.side * W, py: -H / 2 + PRINT.side * W, ps: PRINT.pic * W };
  }

  function shadowAndPaper(ctx, W, H, lift = 0) {
    const off = Math.max(4, W * 0.018) * (1 + lift * 1.8);
    ctx.fillStyle = 'rgba(6, 3, 18, 0.92)';
    ctx.fillRect(-W / 2 + off * 0.8, -H / 2 + off, W, H);
    ctx.fillStyle = PAPER;
    ctx.fillRect(-W / 2, -H / 2, W, H);
    ctx.save();
    ctx.translate(-W / 2, -H / 2);
    ctx.fillStyle = paperPat;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  function outline(ctx, W, H) {
    ctx.lineWidth = Math.max(2, W * 0.007);
    ctx.strokeStyle = INK;
    ctx.strokeRect(-W / 2, -H / 2, W, H);
  }

  // The print's face: the photo (or its shimmer while it loads), the stamp, the badge, the clues, the caption.
  // card: { img, flip, frame, stamp: { kind, t, x, y, rot }, badge: { ok, t }, clues: [...], clueT, caption, captionA,
  //         label: { kind, a }, held, picId }
  function drawFace(ctx, card, g, t) {
    const { W, H, px, py, ps } = g;
    const ia = card.imgA ?? 1;
    if (card.img && ia >= 1) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(card.img, px, py, ps, ps);
    } else {
      ctx.fillStyle = '#d8d0c2';
      ctx.fillRect(px, py, ps, ps);
      // the shimmer: a light band sweeping across while the photo loads
      const k = reduced ? 0.5 : (t * 0.8) % 1.4 - 0.2;
      const sg = ctx.createLinearGradient(px + ps * (k - 0.3), py, px + ps * (k + 0.3), py + ps * 0.4);
      sg.addColorStop(0, 'rgba(255,255,255,0)');
      sg.addColorStop(0.5, 'rgba(255,255,255,0.55)');
      sg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(px, py, ps, ps);
      ctx.fillStyle = 'rgba(23, 10, 54, 0.32)';
      ctx.font = `800 ${Math.round(W * 0.035)}px ${DISPLAY}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('DEVELOPING…', 0, py + ps / 2);
      // decoded: it fades in over the shimmer
      if (card.img && ia > 0) {
        ctx.globalAlpha = ia;
        ctx.drawImage(card.img, px, py, ps, ps);
        ctx.globalAlpha = 1;
      }
    }
    // the photo's edge
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(23, 10, 54, 0.35)';
    ctx.strokeRect(px + 0.5, py + 0.5, ps - 1, ps - 1);

    // the bottom margin: the frame's number and the lab, then the photo's title in pencil after the reveal
    const by = H / 2 - (PRINT.bottom * W) / 2;
    const ca = card.captionA || 0;
    if (ca < 1) {
      ctx.globalAlpha = 1 - ca;
      ctx.fillStyle = 'rgba(23, 10, 54, 0.42)';
      ctx.font = `700 ${Math.max(8, W * 0.027)}px ${MONO}`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText(`№ ${String(card.frame || 1).padStart(2, '0')}`, px, by);
      ctx.textAlign = 'right';
      ctx.fillText('AGI-1 LAB', px + ps, by);
      ctx.globalAlpha = 1;
    }
    if (ca > 0 && card.caption) {
      ctx.globalAlpha = ca;
      ctx.fillStyle = 'rgba(23, 10, 54, 0.82)';
      let fs = Math.max(11, W * 0.05);
      ctx.font = `italic ${fs}px ${SERIF}`;
      const maxW = ps * 0.96;
      const tw = ctx.measureText(card.caption).width;
      if (tw > maxW) { fs *= maxW / tw; ctx.font = `italic ${fs}px ${SERIF}`; }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(card.caption, 0, by + 1);
      ctx.globalAlpha = 1;
    }

    // the clues, circled in grease pencil, numbered
    if (card.clues?.length && card.clueT > 0) drawClues(ctx, card, g);

    // the guess label while the card is dragged (a ghost of the stamp on the side that stays on the screen)
    if (card.label && card.label.a > 0.02) {
      const sp = sprites[card.label.kind];
      const sc = (ps * (card.label.kind === 'ai' ? 0.34 : 0.5)) / sp.w;
      ctx.save();
      const right = card.label.kind === 'ai';
      ctx.translate(right ? px + ps - sp.w * sc * 0.55 : px + sp.w * sc * 0.55, py + sp.h * sc * 0.75);
      ctx.rotate(right ? 0.2 : -0.2);
      const k = 0.85 + 0.15 * card.label.a;
      ctx.scale(sc * k, sc * k);
      ctx.globalAlpha = clamp(card.label.a, 0, 1) * 0.95;
      ctx.drawImage(sp.canvas, -sp.ax, -sp.ay);
      ctx.restore();
    }

    // the stamp: it falls fast, slams, squashes and settles
    if (card.stamp && card.stamp.t >= 0) drawStamp(ctx, card.stamp, g);
    if (card.badge && card.badge.t >= 0) drawBadge(ctx, card.badge, g);
  }

  function drawStamp(ctx, st, g) {
    const sp = sprites[st.kind];
    const want = g.ps * (st.kind === 'ai' ? 0.3 : 0.44);
    const base = want / sp.w;
    const t = st.t;
    const FALL = 0.11;
    let s = 1, sx = 1, sy = 1, a = 1;
    if (reduced) { a = clamp(t / 0.12, 0, 1); }
    else if (t < FALL) { const k = t / FALL; s = 1.85 - 0.85 * inQuad(k); a = clamp(k * 3, 0, 1); }
    else if (t < FALL + 0.1) { const k = (t - FALL) / 0.1; sx = 1 + 0.06 * Math.sin(k * Math.PI); sy = 1 - 0.07 * Math.sin(k * Math.PI); }
    ctx.save();
    ctx.translate(g.px + st.x * g.ps, g.py + st.y * g.ps);
    ctx.rotate(st.rot);
    ctx.scale(base * s * sx, base * s * sy);
    ctx.globalAlpha = a;
    ctx.drawImage(sp.canvas, -sp.ax, -sp.ay);
    ctx.restore();
  }

  function drawBadge(ctx, b, g) {
    const sp = b.ok ? sprites.ok : sprites.bad;
    const k = reduced ? clamp(b.t / 0.15, 0, 1) : clamp(b.t / 0.26, 0, 1);
    if (k <= 0) return;
    const s = reduced ? 1 : outBack(k, 2.4);
    const size = g.ps * 0.16;
    ctx.save();
    ctx.translate(g.px + b.x * g.ps, g.py + b.y * g.ps);
    ctx.rotate(b.rot * (reduced ? 1 : k));
    ctx.scale((size / (sp.r * 2)) * s, (size / (sp.r * 2)) * s);
    ctx.globalAlpha = reduced ? k : 1;
    ctx.drawImage(sp.canvas, -sp.ax, -sp.ay);
    ctx.restore();
  }

  function loopOf(card, i) {
    const key = `${card.picId}:${i}`;
    let p = loops.get(key);
    if (!p) { p = loopPath(hash(key)); loops.set(key, p); }
    return p;
  }
  function drawClues(ctx, card, g) {
    const { px, py, ps, W } = g;
    const lwInk = Math.max(5, W * 0.02), lwPen = Math.max(2.8, W * 0.011);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const clues = card.clues;
    for (let i = 0; i < clues.length; i++) {
      const c = clues[i];
      const p = clamp((card.clueT - i * 0.2) / 0.45, 0, 1);
      if (p <= 0) continue;
      const pts = loopOf(card, i);
      const cx = px + c.x * ps, cy = py + c.y * ps, rr = Math.max(c.r * ps, 12);
      const n = pts.length - 1, end = outCubic(p) * n;
      const hot = card.flash ? 0.5 + 0.5 * Math.sin(card.flash * 14) : 0;
      // the pencil: an ink line, then the honey one on top of it (it reads on a light photo and a dark one)
      for (let pass = 0; pass < 2; pass++) {
        ctx.lineWidth = pass ? lwPen : lwInk;
        ctx.strokeStyle = pass ? (hot > 0.5 ? '#fff6c8' : HONEY) : INK;
        ctx.beginPath();
        ctx.moveTo(cx + pts[0][0] * rr, cy + pts[0][1] * rr);
        const whole = Math.floor(end);
        for (let k = 1; k <= whole; k++) ctx.lineTo(cx + pts[k][0] * rr, cy + pts[k][1] * rr);
        if (whole < n) {
          const f = end - whole, a = pts[whole], b = pts[whole + 1];
          ctx.lineTo(cx + (a[0] + (b[0] - a[0]) * f) * rr, cy + (a[1] + (b[1] - a[1]) * f) * rr);
        }
        ctx.stroke();
      }
      // its number, on a round sticker at the loop's edge
      const pk = clamp((p - 0.55) / 0.3, 0, 1);
      if (pk > 0) {
        const pin = pinAt(c, ps, rr);
        const R = Math.max(10, W * 0.034);
        const s = reduced ? 1 : outBack(pk, 2.2);
        const x = px + pin.x, y = py + pin.y;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(s, s);
        ctx.fillStyle = INK;
        ctx.beginPath(); ctx.arc(1.5, 2, R, 0, TAU); ctx.fill();
        ctx.fillStyle = HONEY;
        ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
        ctx.lineWidth = Math.max(1.8, R * 0.16); ctx.strokeStyle = INK; ctx.stroke();
        ctx.fillStyle = INK;
        ctx.font = `900 ${Math.round(R * 1.15)}px ${DISPLAY}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), 0, R * 0.08);
        ctx.restore();
      }
    }
  }

  // the back of a print (face down)
  function drawBack(ctx, g) {
    ctx.drawImage(sprites.back, -g.W / 2, -g.H / 2, g.W, g.H);
  }

  // The print in play. `pose`: { x, y, rot (rad), scale, lift } in screen pixels; `flip` 0 (back) → 1 (face).
  function drawCard(ctx, card, cx, cy, W, pose, t) {
    patterns(ctx);
    const g = printGeo(W);
    const flip = card.flip ?? 1;
    const fx = Math.abs(Math.cos(flip * Math.PI));
    ctx.save();
    ctx.translate(cx + pose.x, cy + pose.y);
    ctx.rotate(pose.rot);
    const s = pose.scale * (1 + (pose.lift || 0) * 0.04);
    ctx.scale(s * Math.max(0.0001, fx), s);
    shadowAndPaper(ctx, g.W, g.H, pose.lift || 0);
    if (flip < 0.5) drawBack(ctx, g); else drawFace(ctx, card, g, t);
    outline(ctx, g.W, g.H);
    ctx.restore();
  }

  // the prints still face down under the one in play (their number: how many are left, at most 2)
  function drawStack(ctx, cx, cy, W, n, t, seed = 0) {
    if (n <= 0) return;
    const g = printGeo(W);
    const poses = [[W * 0.024, W * 0.03, 0.045], [-W * 0.02, W * 0.05, -0.035]];
    for (let i = Math.min(n, 2) - 1; i >= 0; i--) {
      const [ox, oy, r] = poses[(i + seed) % 2];
      ctx.save();
      ctx.translate(cx + ox, cy + oy);
      ctx.rotate(r);
      patterns(ctx);
      shadowAndPaper(ctx, g.W, g.H, 0);
      drawBack(ctx, g);
      outline(ctx, g.W, g.H);
      ctx.restore();
    }
  }

  // The loupe: a round lens magnifying (`zoom`×) what's under the point px, py (the card drawn again, bigger, inside
  // it), a paper rim outlined in ink, a glint, and for a finger a handle reaching down to it.
  function drawLoupe(ctx, L, drawScene) {
    const { lx, ly, R, px, py, zoom, a, handle } = L;
    if (a <= 0.01) return;
    const k = reduced ? 1 : outBack(clamp(a, 0, 1), 1.6);
    const r = R * (0.4 + 0.6 * k);
    ctx.save();
    ctx.globalAlpha = clamp(a * 1.4, 0, 1);
    // its handle (a finger holds it from below or above)
    if (handle) {
      const dx = px - lx, dy = py - ly, d = Math.hypot(dx, dy) || 1;
      const ux = dx / d, uy = dy / d;
      const hx0 = lx + ux * (r + 2), hy0 = ly + uy * (r + 2), len = Math.min(d - r - 10, r * 0.55);
      if (len > 6) {
        ctx.lineCap = 'round';
        ctx.strokeStyle = INK; ctx.lineWidth = r * 0.26 + 5;
        ctx.beginPath(); ctx.moveTo(hx0, hy0); ctx.lineTo(hx0 + ux * len, hy0 + uy * len); ctx.stroke();
        ctx.strokeStyle = VIOLET; ctx.lineWidth = r * 0.26;
        ctx.beginPath(); ctx.moveTo(hx0, hy0); ctx.lineTo(hx0 + ux * len, hy0 + uy * len); ctx.stroke();
      }
    }
    // its shadow
    ctx.fillStyle = 'rgba(6, 3, 18, 0.85)';
    ctx.beginPath(); ctx.arc(lx + 4, ly + 6, r + 8, 0, TAU); ctx.fill();
    // the magnified view
    ctx.save();
    ctx.beginPath(); ctx.arc(lx, ly, r, 0, TAU); ctx.clip();
    ctx.fillStyle = TABLE;
    ctx.fillRect(lx - r, ly - r, r * 2, r * 2);
    ctx.translate(lx, ly);
    ctx.scale(zoom, zoom);
    ctx.translate(-px, -py);
    drawScene(ctx);
    ctx.restore();
    // the glass: a soft glint
    const gl = ctx.createLinearGradient(lx - r, ly - r, lx + r * 0.2, ly + r * 0.2);
    gl.addColorStop(0, 'rgba(255,255,255,0.28)');
    gl.addColorStop(0.45, 'rgba(255,255,255,0.04)');
    gl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gl;
    ctx.beginPath(); ctx.arc(lx, ly, r, 0, TAU); ctx.fill();
    // the aim: a small cross in the middle
    ctx.strokeStyle = 'rgba(255, 250, 240, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(lx - 7, ly); ctx.lineTo(lx - 3, ly); ctx.moveTo(lx + 3, ly); ctx.lineTo(lx + 7, ly);
    ctx.moveTo(lx, ly - 7); ctx.lineTo(lx, ly - 3); ctx.moveTo(lx, ly + 3); ctx.lineTo(lx, ly + 7);
    ctx.stroke();
    // the rim: ink, paper, ink
    ctx.lineWidth = 9; ctx.strokeStyle = INK;
    ctx.beginPath(); ctx.arc(lx, ly, r + 4, 0, TAU); ctx.stroke();
    ctx.lineWidth = 5; ctx.strokeStyle = PAPER;
    ctx.beginPath(); ctx.arc(lx, ly, r + 4, 0, TAU); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = INK;
    ctx.beginPath(); ctx.arc(lx, ly, r + 0.5, 0, TAU); ctx.stroke();
    // its magnification, small, on the rim
    if (r > 50) {
      const bx = lx + Math.cos(-0.75) * (r + 4), by = ly + Math.sin(-0.75) * (r + 4);
      ctx.fillStyle = HONEY;
      rrect(ctx, bx - 17, by - 10, 34, 20, 10); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
      ctx.fillStyle = INK;
      ctx.font = `800 11px ${MONO}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`${zoom}×`, bx, by + 0.5);
    }
    ctx.restore();
  }

  // a few words drawn like a sticker (the hints, the streak's banner)
  function sticker(ctx, text, x, y, { size = 20, fill = HONEY, color = INK, rot = 0, a = 1, scale = 1, pad = 0.55 } = {}) {
    if (a <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(scale, scale);
    ctx.font = `900 ${size}px ${DISPLAY}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + size * pad * 2, h = size * 1.55;
    ctx.fillStyle = INK;
    rrect(ctx, -w / 2 + 3, -h / 2 + 4, w, h, h / 2); ctx.fill();
    ctx.fillStyle = fill;
    rrect(ctx, -w / 2, -h / 2, w, h, h / 2); ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = color;
    ctx.fillText(text, 0, size * 0.06);
    ctx.restore();
  }

  // a pulsing ring with a word: "hold here" for a first-time player
  function holdHint(ctx, x, y, t, a) {
    if (a <= 0.01) return;
    const k = (t % 1.3) / 1.3;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.lineWidth = 3;
    ctx.strokeStyle = PAPER;
    ctx.beginPath(); ctx.arc(x, y, 16 + k * 26, 0, TAU);
    ctx.globalAlpha = a * (1 - k);
    ctx.stroke();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(255, 250, 240, 0.92)';
    ctx.beginPath(); ctx.arc(x, y, 12, 0, TAU); ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.restore();
  }

  // ---------- the title's fan: three prints that flip over one by one ----------
  // prints: [{ img, flip, stamp, kind }]
  function drawFan(ctx, w, h, prints, t) {
    patterns(ctx);
    const W = Math.min(w * 0.34, h * 0.78);
    const pivotX = w / 2, pivotY = h + W * 1.15;
    const angles = [-0.3, 0.3, 0];
    const order = [0, 1, 2];        // the middle one drawn last (on top)
    for (const i of order) {
      const p = prints[i];
      const a = angles[i] + (reduced ? 0 : Math.sin(t * 0.9 + i * 2) * 0.012);
      const R = pivotY - h * 0.52;
      const cx = pivotX + Math.sin(a) * R, cy = pivotY - Math.cos(a) * R;
      const card = { img: p.img, flip: p.flip, frame: i + 1, stamp: p.stamp, clues: null, picId: '' };
      const lift = Math.sin(clamp(p.flip, 0, 1) * Math.PI) * 0.6;
      drawCard(ctx, card, cx, cy, W, { x: 0, y: -lift * 6, rot: a, scale: 1, lift }, t);
      // tape on a print that's face up
      if (p.flip > 0.5) {
        const g = printGeo(W);
        ctx.save();
        ctx.translate(cx, cy - lift * 6);
        ctx.rotate(a);
        const tw = W * 0.32, th = tw * 0.28;
        for (const [sx, r] of [[-1, -0.6], [1, 0.55]]) {
          ctx.save();
          ctx.translate(sx * (g.W / 2 - tw * 0.18), -g.H / 2 + th * 0.2);
          ctx.rotate(r);
          ctx.drawImage(sprites.tape, -tw / 2, -th / 2, tw, th);
          ctx.restore();
        }
        ctx.restore();
      }
    }
  }

  return { sprites, printGeo, drawTable, drawEdge, drawCard, drawStack, drawLoupe, sticker, holdHint, drawFan, invalidate };
}

// where a clue's number sits: on its loop's edge, up and to the right unless that's off the photo
export function pinAt(c, ps, rr) {
  const cx = c.x * ps, cy = c.y * ps;
  const m = Math.max(12, ps * 0.04);
  for (const a of [-0.85, -2.3, 0.85, 2.3]) {
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    if (x > m && x < ps - m && y > m && y < ps - m) return { x, y };
  }
  return { x: clamp(cx + rr * 0.7, m, ps - m), y: clamp(cy - rr * 0.7, m, ps - m) };
}

function hash(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}

// where the stamp lands: the corner of the photo with the fewest clues near it
export function stampSpot(pic, kind, dice) {
  const corners = [[0.24, 0.8], [0.76, 0.8], [0.24, 0.2], [0.76, 0.2]];
  if (kind === 'ai') for (const c of corners) c[0] = c[0] < 0.5 ? 0.19 : 0.81;
  let best = corners[0], bestScore = -Infinity;
  for (const c of corners) {
    let s = 0;
    for (const q of pic.clues || []) s += Math.min(1, Math.hypot(q.x - c[0], q.y - c[1]) / 0.5);
    s += dice() * 0.15 + (c[1] > 0.5 ? 0.12 : 0);      // a little preference for the lower corners
    if (!(pic.clues || []).length) s = dice() + (c[1] > 0.5 ? 0.5 : 0);
    if (s > bestScore) { bestScore = s; best = c; }
  }
  const rot = (best[0] < 0.5 ? -1 : 1) * (0.1 + dice() * 0.12);
  return { x: best[0], y: best[1], rot };
}
