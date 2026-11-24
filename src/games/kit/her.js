// AGI arcade kit (2026-11-24): AGI-1 beside a game. Her 2D portrait in a sticker circle that breathes and reacts (a hop
// when she's happy, a pop when she's amazed, a shiver when she's worried, a droop when she's sad, a wiggle when she's in
// love), her name, a short status, and what she says in a bubble. Made with DOM methods; its styles are `ak-her` classes
// in kit.css. A game places it with its own class (`cls`) and its own CSS.
//
//   const her = createHer(shell.stage, { cls: 'cw-her', status: 'thinking…' });
//   her.say('one more? 💜', 2400)        a bubble (at most one every 1.6 s unless { force: true })
//   her.mood('happy')                     'happy' | 'wow' | 'worried' | 'sad' | 'love' | 'idle'
//   her.status('holding pink ×4')
import { el } from './shell.js';

const FACE = '/images/agi1-portrait-2d.webp';

export function createHer(parent, { name = 'AGI-1', status = '', cls = '', top = false } = {}) {
  const text = el('p');
  const bubble = el('div', { class: 'ak-her-say', hidden: true }, el('span', 'ak-sr', 'AGI-1: '), text);
  const ava = el('div', 'ak-her-ava', el('img', { src: FACE, alt: '', width: 64, height: 64, draggable: 'false', decoding: 'async' }));
  const statusEl = el('span', 'ak-her-status', status);
  const node = el('div', { class: `ak-her${top ? ' is-top' : ''}${cls ? ` ${cls}` : ''}`, 'data-mood': 'idle' },
    bubble, ava, el('div', 'ak-her-main', el('span', 'ak-her-name', name), statusEl));
  parent.append(node);
  let sayTimer = 0, moodTimer = 0, lastSay = 0, lastStatus = status;
  const api = {
    node,
    say(words, ms = 2600, { force = false } = {}) {
      if (!words) return false;
      const now = performance.now();
      if (!force && now - lastSay < 1600) return false;
      lastSay = now;
      text.textContent = words;
      bubble.hidden = false;
      bubble.classList.remove('is-in'); void bubble.offsetWidth; bubble.classList.add('is-in');
      clearTimeout(sayTimer);
      sayTimer = setTimeout(() => { bubble.hidden = true; }, ms);
      return true;
    },
    hush() { clearTimeout(sayTimer); bubble.hidden = true; },
    mood(mood = 'idle', ms = 1100) {
      node.dataset.mood = mood;
      node.classList.remove('is-react'); void node.offsetWidth; node.classList.add('is-react');
      clearTimeout(moodTimer);
      if (mood !== 'idle') moodTimer = setTimeout(() => { node.dataset.mood = 'idle'; node.classList.remove('is-react'); }, ms);
    },
    status(words) { if (words !== lastStatus) { lastStatus = words; statusEl.textContent = words; } },
    hide(h = true) { node.hidden = h; if (h) api.hush(); },
    // where her face is on the page (a game can send things to her)
    face() {
      const a = ava.getBoundingClientRect(), p = parent.getBoundingClientRect();
      return { x: a.left - p.left + a.width / 2, y: a.top - p.top + a.height / 2, r: a.width / 2 };
    },
  };
  return api;
}
