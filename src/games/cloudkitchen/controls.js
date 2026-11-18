export const keys = {
  KeyQ: 'tea',
  KeyW: 'milk',
  KeyG: 'latch',
  KeyF: 'switch',
  KeyT: 'ticket',
  KeyL: 'label',
  KeyK: 'batch',
  KeyB: 'leaf',
  KeyA: 'pearl',
  KeyS: 'star',
  KeyI: 'ice',
  KeyE: 'shaker',
  KeyZ: 'left',
  KeyC: 'right',
  Space: 'seal',
  KeyR: 'remake',
  KeyX: 'file'
};
export const keyFor = Object.fromEntries(Object.entries(keys).map(([key, id]) => [id, key]));
export const panelFor = id => ['pearl', 'star', 'ice', 'shaker', 'left', 'right', 'seal'].includes(id) ? 'finish' : ['ticket', 'label', 'batch', 'remake'].includes(id) ? 'orders' : ['tea', 'milk', 'leaf', 'latch'].includes(id) ? 'mix' : null;
