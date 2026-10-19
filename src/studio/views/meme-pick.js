// (2026-10-19, meme templates) the template picker of the Photo tool's Meme kind: every template of src/studio/memes.js as a
// tile in its group (TEMPLATE_CATS), each with its sketch (memes.js templateSketch: its picture's place, its panels and where
// its words go, drawn as SVG with presentation attributes only: the page's CSP allows no style attributes) and its name.
// One radio group across the groups (the arrow keys move through every template, as in any radio group); a polite live
// region says which one is picked. → { node, value, set(id) }
import { h, nextId } from '../ui.js';
import { TEMPLATES, TEMPLATE_IDS, TEMPLATE_CATS, templateSketch } from '../memes.js';

const SVG = 'http://www.w3.org/2000/svg';

// a template's sketch: its canvas, its picture's place (or its panels), and a bar where each of its words goes
export function sketchOf(tpl) {
  const k = templateSketch(tpl);
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', `0 0 ${Math.round(k.w)} ${Math.round(k.h)}`);
  svg.setAttribute('class', 'sa-tpl-sketch');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const rect = (b, cls, fill = null) => {
    const r = document.createElementNS(SVG, 'rect');
    for (const [a, v] of [['x', b.x], ['y', b.y], ['width', b.w], ['height', b.h]]) r.setAttribute(a, String(Math.round(v)));
    r.setAttribute('class', cls);
    if (fill) r.setAttribute('fill', fill);
    svg.append(r);
  };
  rect({ x: 0, y: 0, w: k.w, h: k.h }, 'sa-tpl-canvas', /^#[0-9a-f]{6}$/i.test(k.bg || '') ? k.bg : '#111111');
  for (const p of k.panels.length ? k.panels : [k.pic]) rect(p, 'sa-tpl-pic');
  for (const b of k.boxes) rect(b, `sa-tpl-box${b.tag ? ' is-tag' : b.dark ? ' is-dark' : ''}`);
  return svg;
}

export function templatePicker({ value = TEMPLATE_IDS[0], onchange = null } = {}) {
  const groupName = nextId('tpl');
  const live = h('span', { class: 'sa-sr', 'aria-live': 'polite' });
  const node = h('div', { class: 'sa-tpl-pick', dataset: { guide: 'templates' } });
  for (const [cat, catName] of Object.entries(TEMPLATE_CATS)) {
    const ids = TEMPLATE_IDS.filter((id) => TEMPLATES[id].cat === cat);
    if (!ids.length) continue;
    const row = h('div', { class: 'sa-tpl-row' });
    for (const id of ids) {
      const tpl = TEMPLATES[id];
      const fid = nextId('tp');
      const input = h('input', { type: 'radio', class: 'sa-tpl-input', name: groupName, id: fid, value: id, checked: id === value });
      input.addEventListener('change', () => {
        if (!input.checked) return;
        live.textContent = `${tpl.name} picked`;
        onchange?.(id);
      });
      row.append(h('span', { class: 'sa-tpl-opt' }, input,
        h('label', { for: fid, title: tpl.about }, sketchOf(tpl), h('span', { class: 'sa-tpl-name', text: tpl.name }))));
    }
    node.append(h('fieldset', { class: 'sa-tpl-group' }, h('legend', { class: 'sa-tpl-cat', text: catName }), row));
  }
  node.append(live);
  return {
    node,
    get value() { return node.querySelector('input:checked')?.value ?? null; },
    set(v) { for (const i of node.querySelectorAll('input')) i.checked = i.value === v; },
  };
}
