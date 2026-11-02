import { el, keyed, setText } from '../ui.js';
import { pic, samePic } from './common.js';

// A cell is text or { text, tone, action, className, token }. Event listeners read the
// latest descriptor, so changing values never replaces a focused trade/cancel button.
function paintCell(cell, value) {
  const data = value && typeof value === 'object' ? value : { text: value };
  const kind = data.action ? 'button' : 'span';
  let node = cell.firstChild;
  if (!node || cell.$kind !== kind) {
    node = el(kind, kind === 'button' ? { type: 'button', on: { click: () => node.$data.action?.() } } : {});
    node.$label = el('span'); node.append(node.$label); cell.replaceChildren(node); cell.$kind = kind;
  }
  node.$data = data;
  const cls = `${kind === 'button' ? 'tbb-btn ' : ''}${data.className || ''} ${data.tone || ''}`.trim();
  if (node.className !== cls) node.className = cls;
  setText(node.$label, data.text ?? '—');
  if (data.token) {
    if (!node.$pic || !samePic(node.$pic, data.token)) {
      const image = pic(data.token, '', 'tbb');
      if (node.$pic) node.$pic.replaceWith(image); else node.insertBefore(image, node.$label);
      node.$pic = image;
    }
  } else if (node.$pic) { node.$pic.remove(); node.$pic = null; }
}

export function paintBasedTable(host, key, labels, rows, emptyText = 'No data yet.') {
  let view = host.$basedTable;
  if (!view || view.key !== key || view.wrap.parentNode !== host) {
    const body = el('tbody'), message = el('p', { class: 'tbb-empty' });
    const table = el('table', { class: 'tbb-data-table' }, el('thead', {}, el('tr', {}, labels.map(label => el('th', { scope: 'col' }, label)))), body);
    const wrap = el('div', { class: 'tbb-data-scroll' }, table, message);
    view = { key, wrap, body, table, message }; host.$basedTable = view; host.replaceChildren(wrap);
  }
  view.table.hidden = !rows.length; view.message.hidden = Boolean(rows.length); setText(view.message, emptyText);
  const occurrences = new Map();
  const items = rows.map(row => {
    const id = String(row.id), duplicate = occurrences.get(id) || 0; occurrences.set(id, duplicate + 1);
    return { ...row, key: `${id}:${duplicate}` };
  });
  keyed(view.body, items, row => row.key, row => el('tr', {}, row.cells.map(() => el('td'))), (node, row) => {
    row.cells.forEach((value, index) => paintCell(node.children[index], value));
  });
}

export function paintBasedInfo(host, key, title, rows) {
  let view = host.$basedInfo;
  if (!view || view.key !== key || view.list.parentNode !== host) {
    const list = el('dl', { class: 'tbb-info-rows' });
    view = { key, list }; host.$basedInfo = view; host.replaceChildren(...(title ? [el('h3', {}, title), list] : [list]));
  }
  keyed(view.list, rows, row => row[0], row => el('div', {}, el('dt', {}, row[0]), el('dd')), (node, row) => setText(node.lastChild, row[1]));
}
