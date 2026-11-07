// AGI arcade kit: taps, drags, swipes and keys, the same on a phone, a tablet and a computer.
//
//   const off = pointer(canvas, {
//     down(p) {}, move(p) {}, up(p) {},          p: { id, x, y (CSS px in the element), dx, dy (since down), t (s since down), type }
//     tap(p) {},                                 a short press that didn't travel
//     swipe(p, dir) {},                          'left' | 'right' | 'up' | 'down' (quick and far enough)
//   });
//   const keys = keyboard({ ArrowLeft: 'left', a: 'left', ' ': 'action' }, { down(name, e) {}, up(name, e) {} });
//   keys.held('left')
//
// The element gets `touch-action: none` from kit.css (.ak-stage canvas), so a drag never scrolls or zooms the page.
const SWIPE_MIN = 28, SWIPE_MS = 450, TAP_MOVE = 12, TAP_MS = 350;

export function pointer(el, handlers = {}) {
  const live = new Map();
  const at = (e) => {
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const info = (e, s) => {
    const p = at(e);
    return { id: e.pointerId, x: p.x, y: p.y, dx: p.x - s.x0, dy: p.y - s.y0, t: (performance.now() - s.t0) / 1000, type: e.pointerType, primary: e.isPrimary, event: e };
  };
  const onDown = (e) => {
    if (e.button !== undefined && e.button > 0 && e.pointerType === 'mouse') return;
    const p = at(e);
    const s = { x0: p.x, y0: p.y, t0: performance.now(), moved: 0 };
    live.set(e.pointerId, s);
    try { el.setPointerCapture(e.pointerId); } catch { /* fine */ }
    handlers.down?.(info(e, s));
    if (e.cancelable) e.preventDefault();
  };
  const onMove = (e) => {
    const s = live.get(e.pointerId);
    if (!s) { handlers.hover?.({ ...at(e), type: e.pointerType, event: e }); return; }
    const i = info(e, s);
    s.moved = Math.max(s.moved, Math.hypot(i.dx, i.dy));
    handlers.move?.(i);
  };
  const onUp = (e) => {
    const s = live.get(e.pointerId);
    if (!s) return;
    live.delete(e.pointerId);
    const i = info(e, s);
    handlers.up?.(i);
    if (e.type === 'pointercancel') return;
    const d = Math.hypot(i.dx, i.dy);
    if (s.moved <= TAP_MOVE && i.t * 1000 <= TAP_MS) handlers.tap?.(i);
    else if (d >= SWIPE_MIN && i.t * 1000 <= SWIPE_MS && handlers.swipe) {
      const dir = Math.abs(i.dx) > Math.abs(i.dy) ? (i.dx > 0 ? 'right' : 'left') : (i.dy > 0 ? 'down' : 'up');
      handlers.swipe(i, dir);
    }
  };
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);
  el.addEventListener('lostpointercapture', onUp);
  // no long-press menu or text selection on the playfield
  const stop = (e) => e.preventDefault();
  el.addEventListener('contextmenu', stop);
  return {
    get count() { return live.size; },
    off() {
      el.removeEventListener('pointerdown', onDown); el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp); el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('lostpointercapture', onUp); el.removeEventListener('contextmenu', stop);
    },
  };
}

// Keys by name: `map` is { key (e.key, case-insensitive for letters) or code (e.code): name }. Repeats are ignored for
// `down`. Keys pressed while a text field has focus or a menu is open (`blocked()`) are left alone.
export function keyboard(map, { down, up, blocked = () => false } = {}) {
  const held = new Set();
  const nameOf = (e) => map[e.code] ?? map[e.key] ?? map[e.key?.toLowerCase?.()];
  const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '') || e.target?.isContentEditable;
  const onDown = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || typing(e)) return;
    const name = nameOf(e);
    if (!name || blocked()) return;
    e.preventDefault();
    if (e.repeat || held.has(name)) return;
    held.add(name);
    down?.(name, e);
  };
  const onUp = (e) => {
    const name = nameOf(e);
    if (!name || !held.has(name)) return;
    held.delete(name);
    up?.(name, e);
  };
  const clear = () => held.clear();
  addEventListener('keydown', onDown);
  addEventListener('keyup', onUp);
  addEventListener('blur', clear);
  return {
    held: (name) => held.has(name),
    clear,
    off() { removeEventListener('keydown', onDown); removeEventListener('keyup', onUp); removeEventListener('blur', clear); },
  };
}

// A light buzz on phones that have one (Android; iPhones have none for the web), when the player has it on
export function vibrate(pattern, enabled = true) {
  if (!enabled) return;
  try { navigator.vibrate?.(pattern); } catch { /* not allowed */ }
}
