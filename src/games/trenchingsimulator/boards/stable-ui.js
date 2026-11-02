import { el, keyed, setText } from '../ui.js';

// Price updates change text, not the layout's node tree. Keep labels and value nodes alive.
export function updateStats(host, rows, valueTag = 'strong', wrapperClass = '') {
  keyed(host, rows, row => row[0], row => el('div', {}, el('span', {}, row[0]), el(valueTag)), (node, row) => {
    const value = node.children[1];
    setText(value, row[1]);
    const tone = row[2] || '';
    if (wrapperClass && node.className !== `${wrapperClass} ${tone}`) node.className = `${wrapperClass} ${tone}`;
    if (value.className !== tone) value.className = tone;
  });
}

export function updateLabels(host, words) {
  keyed(host, words.map((text, id) => ({ text, id })), row => row.id, () => el('span'), (node, row) => setText(node, row.text));
}
