// AGI arcade kit: a canvas that fills its box, sharp on every screen (its pixels × the device's pixel ratio, at most
// `maxDpr`), resized when the box changes (a phone turned, a window resized, the address bar sliding away).
//
//   const view = fitCanvas(canvas, { maxDpr: 2, onResize: (v) => layout(v) });
//   view.ctx, view.w, view.h (CSS pixels), view.dpr
//   each frame: view.begin() (clears and sets the transform so you draw in CSS pixels) …draw…
//
// A game with a fixed playfield (say 400 × 720) uses `view.fit(400, 720)` → { scale, x, y } to draw it centred, as big
// as fits ("contain"); `view.toWorld(px, py, fit)` turns a pointer's CSS pixels into playfield units.
export function fitCanvas(canvas, { maxDpr = 2, alpha = true, onResize = null, context = '2d' } = {}) {
  const ctx = context === '2d' ? canvas.getContext('2d', { alpha }) : null;
  const view = {
    canvas, ctx, w: 1, h: 1, dpr: 1,
    resize() {
      const box = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(box.width)), h = Math.max(1, Math.round(box.height));
      const dpr = Math.min(maxDpr, Math.max(1, window.devicePixelRatio || 1));
      if (w === view.w && h === view.h && dpr === view.dpr && canvas.width === Math.round(w * dpr)) return false;
      view.w = w; view.h = h; view.dpr = dpr;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      onResize?.(view);
      return true;
    },
    begin(clear = true) {
      if (!ctx) return null;
      ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      if (clear) ctx.clearRect(0, 0, view.w, view.h);
      return ctx;
    },
    // the playfield (lw × lh) as big as fits, centred; `pad` CSS pixels around it (e.g. the top bar: { top: 64 })
    fit(lw, lh, { top = 0, right = 0, bottom = 0, left = 0, maxScale = Infinity } = {}) {
      const aw = Math.max(1, view.w - left - right), ah = Math.max(1, view.h - top - bottom);
      const scale = Math.min(aw / lw, ah / lh, maxScale);
      return { scale, x: left + (aw - lw * scale) / 2, y: top + (ah - lh * scale) / 2, w: lw * scale, h: lh * scale };
    },
    toWorld(px, py, f) { return { x: (px - f.x) / f.scale, y: (py - f.y) / f.scale }; },
  };
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => view.resize()) : null;
  ro?.observe(canvas);
  addEventListener('resize', () => view.resize());
  addEventListener('orientationchange', () => setTimeout(() => view.resize(), 120));
  view.resize();
  view.dispose = () => ro?.disconnect();
  return view;
}
