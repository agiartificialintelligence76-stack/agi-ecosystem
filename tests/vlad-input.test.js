import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInput } from '../src/games/vladrunner2049/input.js';

function surface() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
    emit(type, extra = {}) {
      const event = { target: { tagName: 'DIV' }, prevented: false, preventDefault() { this.prevented = true; }, ...extra };
      for (const fn of listeners.get(type) || []) fn(event);
      return event;
    },
    listenerCount() { return [...listeners.values()].reduce((n, set) => n + set.size, 0); },
  };
}
function setup() {
  const target = surface(), document = surface(); let devices = [], polls = 0;
  target.document = document; document.activeElement = { tagName: 'BODY' }; document.hidden = false;
  target.navigator = { getGamepads() { polls++; if (devices instanceof Error) throw devices; return devices; } };
  const input = createInput(target);
  return { target, document, input, setPads(value) { devices = value; }, polls: () => polls,
    down(code, extra) { return target.emit('keydown', { code, ...extra }); },
    up(code, extra) { return target.emit('keyup', { code, ...extra }); } };
}
const idle = (value) => Object.values(value).every((v) => v === 0 || v === false);
const pad = (index, { axes = [0, 0], down = [], mapping = 'standard' } = {}) => ({ index, connected: true, mapping, axes,
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: down.includes(i), value: down.includes(i) ? 1 : 0 })) });

test('gameplay is opt-in; held keys, release, repeat and quick taps produce stable engine inputs', () => {
  const s = setup();
  assert.equal(s.down('Space').prevented, false); assert.ok(idle(s.input.sample()[0])); assert.equal(s.polls(), 0);
  s.input.setEnabled(true);
  assert.equal(s.down('KeyJ').prevented, true);
  assert.equal(s.input.sample()[0].attack, true);
  s.down('KeyJ', { repeat: true }); assert.equal(s.input.sample()[0].attack, true);
  s.up('KeyJ'); assert.equal(s.input.sample()[0].attack, false);
  s.down('KeyK'); s.up('KeyK');
  assert.equal(s.input.sample()[0].heavy, true, 'a tap between animation frames is preserved');
  assert.equal(s.input.sample()[0].heavy, false, 'the released tap lasts one sample');
  s.down('KeyK', { repeat: true }); assert.equal(s.input.sample()[0].heavy, false, 'repeat cannot resurrect a cleared key');
  for (const [key, action] of [['KeyL', 'special'], ['Space', 'jump'], ['ShiftLeft', 'dodge'], ['KeyQ', 'tag'], ['KeyE', 'duo']]) {
    s.down(key); assert.equal(s.input.sample()[0][action], true, key);
    s.up(key); assert.equal(s.input.sample()[0][action], false, key);
  }
  assert.equal(s.down('Escape').prevented, false, 'the adapter never consumes pause controls');
  s.input.destroy();
});

test('solo arrows join player one; co-op splits keyboard movement and all second-player actions', () => {
  const s = setup(); s.input.setEnabled(true);
  s.down('ArrowRight'); assert.equal(s.input.sample()[0].x, 1);
  const split = s.input.sample(true); assert.equal(split.length, 2); assert.equal(split[0].x, 0); assert.equal(split[1].x, 1);
  s.down('KeyW'); const both = s.input.sample(true); assert.equal(both[0].y, -1); assert.equal(both[1].y, 0);
  s.up('KeyW'); s.up('ArrowRight');
  for (const [key, action] of [['KeyN', 'attack'], ['KeyM', 'heavy'], ['Comma', 'special'], ['Period', 'jump'], ['Slash', 'dodge'], ['Enter', 'duo']]) {
    s.down(key); const players = s.input.sample(true);
    assert.equal(players[0][action], false, `${key} does not control player one`); assert.equal(players[1][action], true, key);
    s.up(key); assert.equal(s.input.sample(true)[1][action], false, key);
  }
  s.down('KeyD'); s.down('KeyS');
  assert.ok(Math.abs(Math.hypot(s.input.sample()[0].x, s.input.sample()[0].y) - 1) < 1e-12, 'diagonal movement is normalized');
  s.up('KeyD'); s.up('KeyS'); s.down('ShiftLeft'); s.down('ShiftRight'); s.input.sample(); s.up('ShiftLeft');
  assert.equal(s.input.sample()[0].dodge, true, 'either shift key can hold dodge'); s.up('ShiftRight');
  assert.equal(s.input.sample()[0].dodge, false); s.input.destroy();
});

test('forms, editable content, composition and browser shortcuts never become combat controls', () => {
  const s = setup(); s.input.setEnabled(true);
  for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) {
    s.down('KeyD'); s.document.activeElement = { tagName };
    assert.equal(s.down('KeyJ', { target: s.document.activeElement }).prevented, false);
    assert.ok(idle(s.input.sample()[0])); s.document.activeElement = { tagName: 'BODY' };
    assert.ok(idle(s.input.sample()[0]), 'leaving a field does not revive a held key');
  }
  const rich = { tagName: 'SPAN', isContentEditable: true };
  assert.equal(s.down('Space', { target: rich }).prevented, false);
  assert.equal(s.down('Space', { composedPath: () => [rich] }).prevented, false);
  for (const modifier of ['ctrlKey', 'metaKey', 'altKey', 'isComposing']) {
    s.down('KeyD'); assert.equal(s.down('KeyJ', { [modifier]: true }).prevented, false); assert.ok(idle(s.input.sample()[0]));
  }
  s.down('KeyJ'); s.document.activeElement = { tagName: 'INPUT' }; s.target.emit('focusin', { target: s.document.activeElement });
  s.document.activeElement = { tagName: 'BODY' }; assert.ok(idle(s.input.sample()[0])); s.input.destroy();
});

test('touch holds, quick taps, stick bounds and mixed controls release independently', () => {
  const s = setup(); s.input.setEnabled(true);
  s.input.setTouch('attack', true); assert.equal(s.input.sample()[0].attack, true); assert.equal(s.input.sample()[0].attack, true);
  s.down('KeyJ'); s.input.setTouch('attack', false); assert.equal(s.input.sample()[0].attack, true);
  s.up('KeyJ'); assert.equal(s.input.sample()[0].attack, false);
  s.input.setTouch('special', true); s.input.setTouch('special', false);
  assert.equal(s.input.sample()[0].special, true); assert.equal(s.input.sample()[0].special, false);
  s.input.setStick(9, -9); const vector = s.input.sample()[0]; assert.ok(Math.abs(Math.hypot(vector.x, vector.y) - 1) < 1e-12);
  assert.ok(vector.x > 0 && vector.y < 0);
  s.input.setStick(NaN, Infinity); assert.equal(s.input.sample()[0].x, 0); assert.equal(s.input.sample()[0].y, 0);
  s.input.setTouch('left', true); assert.equal(s.input.sample()[0].x, -1); s.input.setTouch('left', false);
  s.input.setTouch('__proto__', true); assert.ok(idle(s.input.sample()[0]));
  s.input.setTouch('duo', true); s.input.setStick(1, 0); s.input.clear(); assert.ok(idle(s.input.sample()[0]));
  s.input.setEnabled(false); s.input.setTouch('attack', true); s.input.setStick(1, 0); s.input.setEnabled(true);
  assert.ok(idle(s.input.sample()[0])); s.input.destroy();
});

test('blur, hidden pages and disable clear local controls; repeated enabling does not interrupt a held attack', () => {
  const s = setup(); s.input.setEnabled(true); s.down('KeyJ'); s.input.sample();
  s.input.setEnabled(true); assert.equal(s.input.sample()[0].attack, true);
  s.input.setTouch('heavy', true); s.input.setStick(1, 0); s.target.emit('blur');
  assert.ok(idle(s.input.sample()[0])); assert.equal(s.down('Space').prevented, false);
  s.target.emit('focus'); assert.ok(idle(s.input.sample()[0]));
  s.down('KeyJ'); s.document.hidden = true; s.document.emit('visibilitychange'); assert.ok(idle(s.input.sample()[0]));
  s.document.hidden = false; s.document.emit('visibilitychange'); assert.ok(idle(s.input.sample()[0]));
  s.down('KeyJ'); s.input.setEnabled(false); s.input.setEnabled(true); assert.ok(idle(s.input.sample()[0])); s.input.destroy();
});

test('standard controllers have a dead zone, mapped actions and stable player slots on disconnect', () => {
  const s = setup(); s.input.setEnabled(true);
  s.setPads([pad(0, { axes: [.15, -.12] })]); assert.ok(idle(s.input.sample()[0]), 'stick drift is ignored');
  s.setPads([pad(0, { axes: [1, 0], down: [0, 2, 3, 1, 5, 4, 7] }), pad(3, { down: [14, 2] })]);
  const players = s.input.sample(true); assert.equal(players[0].x, 1); assert.equal(players[1].x, -1);
  for (const action of ['jump', 'attack', 'heavy', 'dodge', 'special', 'tag', 'duo']) assert.equal(players[0][action], true, action);
  assert.equal(players[1].attack, true);
  s.setPads([null, pad(3, { down: [14, 2] })]); const disconnected = s.input.sample(true);
  assert.ok(idle(disconnected[0]), 'disconnected controller leaves no held controls');
  assert.equal(disconnected[1].attack, true, 'player two does not unexpectedly become player one');
  s.setPads([pad(0), pad(3)]); assert.ok(s.input.sample(true).every(idle));
  s.setPads([pad(0, { mapping: '', down: [2] })]); assert.ok(idle(s.input.sample()[0]), 'unsupported layouts are not guessed');
  s.setPads(new Error('unavailable')); assert.ok(s.input.sample(true).every(idle));
  s.input.destroy();
});

test('disabled or blurred controls do not poll gamepads; destroy removes every listener and cannot be reactivated', () => {
  const s = setup(); s.setPads([pad(0, { down: [2] })]);
  s.input.sample(); assert.equal(s.polls(), 0); s.input.setEnabled(true); assert.equal(s.input.sample()[0].attack, true);
  s.target.emit('blur'); const before = s.polls(); assert.ok(idle(s.input.sample()[0])); assert.equal(s.polls(), before);
  s.target.emit('focus'); assert.equal(s.input.sample()[0].attack, true);
  assert.ok(s.target.listenerCount() > 0 && s.document.listenerCount() > 0);
  s.input.destroy(); s.input.destroy(); assert.equal(s.target.listenerCount(), 0); assert.equal(s.document.listenerCount(), 0);
  s.input.setEnabled(true); s.down('KeyJ'); s.input.setTouch('attack', true); s.input.setStick(1, 1);
  const after = s.polls(); assert.ok(s.input.sample(true).every(idle)); assert.equal(s.polls(), after);
});
