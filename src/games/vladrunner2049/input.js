// Input stays local and reports held controls; the engine detects action edges.
const ACTIONS = ['attack', 'heavy', 'jump', 'dodge', 'special', 'tag', 'duo'];
const DIRECTIONS = ['left', 'right', 'up', 'down'];
const P1 = { KeyW: 'up', KeyA: 'left', KeyS: 'down', KeyD: 'right', KeyJ: 'attack', KeyK: 'heavy',
  KeyL: 'special', Space: 'jump', ShiftLeft: 'dodge', ShiftRight: 'dodge', KeyQ: 'tag', KeyE: 'duo' };
const P2 = { ArrowUp: 'up', ArrowLeft: 'left', ArrowDown: 'down', ArrowRight: 'right', KeyN: 'attack',
  KeyM: 'heavy', Comma: 'special', Period: 'jump', Slash: 'dodge', Enter: 'duo' };
const PAD_ACTIONS = { jump: 0, dodge: 1, attack: 2, heavy: 3, tag: 4, special: 5, duo: 7 };
const KEYS = new Set([...Object.keys(P1), ...Object.keys(P2)]);
const P1_KEYS = Object.entries(P1), P2_KEYS = Object.entries(P2), ARROWS = P2_KEYS.filter(([code]) => code.startsWith('Arrow'));
const clamp = (value) => Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
const empty = () => ({ x: 0, y: 0, attack: false, heavy: false, jump: false, dodge: false, special: false, tag: false, duo: false });
const editable = (node) => Boolean(node && (node.isContentEditable || /^(INPUT|TEXTAREA|SELECT|OPTION)$/i.test(node.tagName || '')
  || node.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]')));
const pressed = (pad, index) => {
  const button = pad?.buttons?.[index];
  return Boolean(button && (button.pressed === true || Number.isFinite(button.value) && button.value > .5));
};
const axis = (value) => {
  const n = clamp(value), dead = .18;
  return Math.abs(n) <= dead ? 0 : Math.sign(n) * (Math.abs(n) - dead) / (1 - dead);
};

export function createInput(target = globalThis.window) {
  const keys = new Set(), taps = new Set(), touch = new Set(), touchTaps = new Set();
  const slots = [null, null];
  let enabled = false, destroyed = false, focused = true, stickX = 0, stickY = 0;
  const doc = target?.document;
  const clear = () => { keys.clear(); taps.clear(); touch.clear(); touchTaps.clear(); stickX = 0; stickY = 0; };
  const inField = (event) => editable(event?.target) || editable(doc?.activeElement)
    || Boolean(event?.composedPath?.().some(editable));
  const usable = (event) => enabled && !destroyed && focused && !doc?.hidden && !inField(event)
    && !event?.altKey && !event?.ctrlKey && !event?.metaKey && !event?.isComposing;
  const keydown = (event) => {
    if (!usable(event)) { clear(); return; }
    const code = event.code;
    if (!KEYS.has(code)) return;
    event.preventDefault?.();
    if (event.repeat) return;
    if (!keys.has(code)) taps.add(code);
    keys.add(code);
  };
  const keyup = (event) => {
    keys.delete(event.code);
    if (!usable(event)) { clear(); return; }
    if (KEYS.has(event.code)) event.preventDefault?.();
  };
  const blur = () => { focused = false; clear(); };
  const focus = () => { focused = true; clear(); };
  const focusin = (event) => { if (inField(event)) clear(); };
  const visibility = () => { if (doc?.hidden) clear(); };
  target?.addEventListener?.('keydown', keydown);
  target?.addEventListener?.('keyup', keyup);
  target?.addEventListener?.('blur', blur);
  target?.addEventListener?.('focus', focus);
  target?.addEventListener?.('focusin', focusin);
  doc?.addEventListener?.('visibilitychange', visibility);

  function pads() {
    let current = [];
    try { current = Array.from(target?.navigator?.getGamepads?.() || []); } catch { /* Controller access may be unavailable. */ }
    const available = current.filter((pad) => pad && pad.connected !== false && pad.mapping === 'standard' && Number.isInteger(pad.index));
    for (let i = 0; i < slots.length; i++) if (!available.some((pad) => pad.index === slots[i])) slots[i] = null;
    for (const pad of available) if (!slots.includes(pad.index)) {
      const free = slots.indexOf(null); if (free >= 0) slots[free] = pad.index;
    }
    return slots.map((index) => available.find((pad) => pad.index === index));
  }
  function keyboard(out, map, includeArrows = false) {
    const held = (action) => map.some(([code, value]) => value === action && keys.has(code))
      || includeArrows && ARROWS.some(([code, value]) => value === action && keys.has(code));
    out.x += Number(held('right')) - Number(held('left'));
    out.y += Number(held('down')) - Number(held('up'));
    for (const action of ACTIONS) out[action] = map.some(([code, value]) => value === action && (keys.has(code) || taps.has(code)));
  }
  function controller(out, pad) {
    if (!pad) return;
    out.x += clamp(axis(pad.axes?.[0]) + Number(pressed(pad, 15)) - Number(pressed(pad, 14)));
    out.y += clamp(axis(pad.axes?.[1]) + Number(pressed(pad, 13)) - Number(pressed(pad, 12)));
    for (const action of ACTIONS) out[action] ||= pressed(pad, PAD_ACTIONS[action]);
  }
  return {
    sample(coop = false) {
      const result = Array.from({ length: coop ? 2 : 1 }, empty);
      if (!usable()) { clear(); return result; }
      keyboard(result[0], P1_KEYS, !coop);
      if (coop) keyboard(result[1], P2_KEYS);
      const p = result[0];
      p.x += stickX + Number(touch.has('right')) - Number(touch.has('left'));
      p.y += stickY + Number(touch.has('down')) - Number(touch.has('up'));
      for (const action of ACTIONS) p[action] ||= touch.has(action) || touchTaps.has(action);
      const devices = pads();
      result.forEach((out, i) => {
        controller(out, devices[i]); out.x = clamp(out.x); out.y = clamp(out.y);
        const length = Math.hypot(out.x, out.y);
        if (length > 1) { out.x /= length; out.y /= length; }
      });
      taps.clear(); touchTaps.clear();
      return result;
    },
    setEnabled(value) { const next = Boolean(value) && !destroyed; if (enabled !== next) clear(); enabled = next; },
    setTouch(action, held) {
      if (!ACTIONS.includes(action) && !DIRECTIONS.includes(action)) return;
      if (!held) { touch.delete(action); return; }
      if (!usable()) return;
      if (!touch.has(action) && ACTIONS.includes(action)) touchTaps.add(action);
      touch.add(action);
    },
    setStick(x, y) { if (!usable()) { stickX = 0; stickY = 0; return; } stickX = clamp(x); stickY = clamp(y); },
    clear,
    destroy() {
      if (destroyed) return;
      destroyed = true; enabled = false; clear(); slots.fill(null);
      target?.removeEventListener?.('keydown', keydown);
      target?.removeEventListener?.('keyup', keyup);
      target?.removeEventListener?.('blur', blur);
      target?.removeEventListener?.('focus', focus);
      target?.removeEventListener?.('focusin', focusin);
      doc?.removeEventListener?.('visibilitychange', visibility);
    },
  };
}
