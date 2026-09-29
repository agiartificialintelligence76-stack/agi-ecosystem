// The chat's language menu (2026-09-29, the owner: "add different languages on agi-1 so she can speak on them … but default
// is english"). "🌐 English ▾" next to "AGI-1 ▾" in the chat bar opens her 16 languages (src/i18n/langs.js), each in its
// own words; the one she speaks is checked. Picking one: her replies, her voice, the mic and her pre-written lines follow it
// (src/i18n/lang.js), and it's remembered in this browser. She also answers in whatever language you write in (her prompt).
// A real menu, like the model picker (src/chat/models.js): Enter / Space / ↓ open it on the current language, ↑ ↓ Home End
// move, Escape closes it and goes back to the button, Tab leaves it; a click or tap outside closes it.
import { LANGS, langOf } from '../i18n/langs.js';
import { currentLang, setLang } from '../i18n/lang.js';

const el = (tag, className, text) => {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined) n.textContent = text;
  return n;
};
const CHECK = 'm3.5 8.5 3 3 6-7';

// onPick(code) runs once she speaks the picked language (its words downloaded)
export function startLanguageMenu(root, { onPick } = {}) {
  const btn = root?.querySelector('[data-lang-btn]');
  const menu = root?.querySelector('[data-langs]');
  if (!btn || !menu) return { close() {}, isOpen: () => false, draw() {} };
  const nameEl = btn.querySelector('[data-lang-name]'), codeEl = btn.querySelector('[data-lang-code]');
  const param = document.querySelector('[data-lang-param]');

  // her languages, made from the one list the page and the server share
  const list = el('span', 'pg-langs-list');
  const items = LANGS.map((l) => {
    const item = el('button', 'pg-models-item pg-langs-item');
    item.type = 'button';
    item.setAttribute('role', 'menuitemradio');
    item.tabIndex = -1;
    item.dataset.langItem = l.code;
    const native = el('span', 'pg-langs-native', l.native);
    native.lang = l.code;
    native.dir = l.rtl ? 'rtl' : 'ltr';
    const english = el('span', 'pg-langs-en', l.code === 'en' ? 'Default' : l.name.replace(/ \(.*\)$/, ''));
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'pg-models-check');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('aria-hidden', 'true');
    const tick = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tick.setAttribute('d', CHECK);
    tick.setAttribute('stroke', 'currentColor');
    tick.setAttribute('stroke-width', '1.7');
    tick.setAttribute('stroke-linecap', 'round');
    tick.setAttribute('stroke-linejoin', 'round');
    svg.append(tick);
    item.append(native, english, svg);
    list.append(item);
    return item;
  });
  menu.append(list);

  const isOpen = () => !menu.hidden;
  const current = () => Math.max(0, items.findIndex((i) => i.dataset.langItem === currentLang()));
  const outside = (e) => { if (!root.contains(e.target)) close(false); };
  // the button, the checked item and the Parameters row show the language she speaks now
  function draw() {
    const l = langOf(currentLang());
    if (nameEl) { nameEl.textContent = l.native; nameEl.lang = l.code; }
    if (codeEl) codeEl.textContent = l.code.toUpperCase();
    btn.setAttribute('aria-label', `Language: ${l.name}. She also answers in the language you write in.`);
    for (const i of items) i.setAttribute('aria-checked', String(i.dataset.langItem === l.code));
    if (param) { param.textContent = `${l.native} · matches you`; param.lang = l.code; }
  }
  function open(at = current()) {
    menu.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    items[at]?.focus();
    items[at]?.scrollIntoView?.({ block: 'nearest' });
    addEventListener('pointerdown', outside, true);
  }
  function close(backToButton) {
    if (!isOpen()) return;
    menu.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    removeEventListener('pointerdown', outside, true);
    if (backToButton) btn.focus();
  }

  btn.addEventListener('click', () => (isOpen() ? close(true) : open()));
  btn.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    open(e.key === 'ArrowUp' ? items.length - 1 : current());
  });
  menu.addEventListener('keydown', (e) => {
    const at = items.indexOf(document.activeElement);
    const go = (i) => items[(i + items.length) % items.length].focus();
    if (e.key === 'ArrowDown') go(at + 1);
    else if (e.key === 'ArrowUp') go(at - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(items.length - 1);
    else if (e.key === 'Escape') close(true);
    else if (e.key === 'Tab') { close(false); return; }
    else return;
    e.preventDefault();
    e.stopPropagation();                        // (Escape here is only for the menu, not the chat's mic)
  });
  for (const item of items) {
    item.addEventListener('click', async () => {
      const code = item.dataset.langItem;
      close(true);
      if (code === currentLang()) return;
      if (await setLang(code)) onPick?.(code);
    });
  }
  addEventListener('agi1:lang', draw);           // (a saved choice arriving at page start, or a pick)
  draw();
  return { close: () => close(false), isOpen, draw };
}
