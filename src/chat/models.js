// The model picker in the chat bar (2026-09-26, the owner's request: "a button … when they click it there will be more
// models, AGI-2, and it will say COMING SOON"). "AGI-1 ▾" opens a small menu, like an AI lab's playground: AGI-1 is the one
// you're talking to (checked); AGI-2 is "Coming soon" (aria-disabled). Picking it doesn't switch anything: onSoon(name)
// lets the chat make AGI-1 playfully jealous (src/chat/model-lines.js).
// A real menu for keyboards and screen readers: Enter / Space / ↓ open it on the current model, ↑ ↓ Home End move, Escape
// closes it and goes back to the button, Tab leaves it; a click or tap outside closes it.
export function startModelMenu(root, { onSoon } = {}) {
  const btn = root?.querySelector('[data-model-btn]');
  const menu = root?.querySelector('[data-models]');
  if (!btn || !menu) return { close() {}, isOpen: () => false };
  const items = [...menu.querySelectorAll('[role="menuitemradio"]')];
  const isOpen = () => !menu.hidden;
  const current = () => Math.max(0, items.findIndex((i) => i.getAttribute('aria-checked') === 'true'));
  const outside = (e) => { if (!root.contains(e.target)) close(false); };

  function open(at = current()) {
    menu.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    items[at]?.focus();
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
    item.addEventListener('click', () => {
      const soon = item.getAttribute('aria-disabled') === 'true';
      close(true);
      if (soon) onSoon?.(item.dataset.modelItem);
    });
  }
  return { close: () => close(false), isOpen };
}
