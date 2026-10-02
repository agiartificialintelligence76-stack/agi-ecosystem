// A small notification card under the top bar (2026-09-25): AGI-1's market moments ($AGI reached a new market cap step, or
// had a -20% day), so they're seen wherever you are on the page, not only in her chat. One at a time: a new one replaces the
// old. It stays about 12 s (paused while the pointer or keyboard focus is on it); ✕ or Escape closes it. It never takes the
// focus. Screen readers aren't told about it a second time: the same words arrive in her chat, which is a live log they
// already read out. All text goes in with textContent.
// `avoid`: something the card must never cover (AGI-1's live view in the chat, where she's reacting): if it would, there's no
// card (the chat already shows the moment right there, e.g. on phones, where her live view sits under the top bar).
const SHOW_MS = 12_000;
let current = null;

const el = (tag, className, text) => {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined) n.textContent = text;
  return n;
};

// on screen, and overlapping (two boxes)
function covers(a, b) {
  const r = a.getBoundingClientRect(), s = b.getBoundingClientRect();
  if (!s.width || !s.height || s.bottom <= 0 || s.top >= innerHeight) return false;
  return r.left < s.right && r.right > s.left && r.top < s.bottom && r.bottom > s.top;
}

// tone: 'up' | 'down' · title: the short headline (the number) · text: her words
// actions: [{ label, onClick, icon?: 'play', ariaLabel?, warm? }] (each closes the card when clicked, unless it returns false;
// warm() runs when the pointer or focus arrives on it, to get something ready before the click)
// → { box, close } or null (not shown: it would cover `avoid`)
export function notify({ tone = 'up', title, text, actions = [], avoid = null }) {
  // full-screen talk (2026-10-02): she's right there, reacting in her big live view, and the moment is in her chat: no card
  if (document.documentElement.classList.contains('is-talk')) return null;
  const box = el('div', `notice notice-${tone === 'down' ? 'down' : 'up'}`);
  box.setAttribute('role', 'group');
  box.setAttribute('aria-label', 'Notification from AGI-1');
  const ava = el('img', 'notice-ava');
  ava.src = '/images/agi1-avatar.webp';
  ava.alt = '';
  ava.width = ava.height = 36;
  ava.addEventListener('error', () => ava.remove());
  const body = el('div', 'notice-body');
  const head = el('p', 'notice-title');
  head.append(el('i', 'notice-dot'), el('span', '', title));
  body.append(head, el('p', 'notice-text', text));
  const row = el('div', 'notice-actions');
  for (const a of actions) {
    const b = el('button', 'notice-btn');
    b.type = 'button';
    if (a.icon === 'play') {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 16 16');
      svg.setAttribute('aria-hidden', 'true');
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', 'M5 3.2v9.6a.6.6 0 0 0 .9.5l7.4-4.8a.6.6 0 0 0 0-1L5.9 2.7a.6.6 0 0 0-.9.5Z');
      svg.append(p);
      b.append(svg);
    }
    b.append(el('span', '', a.label));
    if (a.ariaLabel) b.setAttribute('aria-label', a.ariaLabel);
    if (a.warm) for (const type of ['pointerenter', 'focus', 'touchstart']) b.addEventListener(type, a.warm, { passive: true });
    b.addEventListener('click', () => { if (a.onClick?.() !== false) close(); });
    row.append(b);
  }
  if (actions.length) body.append(row);
  const x = el('button', 'notice-close');
  x.type = 'button';
  x.setAttribute('aria-label', 'Close this notification');
  x.textContent = '×';
  x.addEventListener('click', () => close());
  box.append(ava, body, x);
  document.body.append(box);                      // (still invisible: it fades in at the next frame)
  if (avoid && covers(box, avoid)) { box.remove(); return null; }
  current?.close({ now: true });                  // a new one replaces the old at once: no two cards fading over each other

  // it stays while the pointer is over it or the keyboard focus is in it, and gets its 12 s again when both have left
  let timer = 0, hovered = false, focused = false, cameFrom = null;
  const arm = () => { clearTimeout(timer); timer = setTimeout(() => { if (!hovered && !focused) close(); }, SHOW_MS); };
  box.addEventListener('pointerenter', () => { hovered = true; });
  box.addEventListener('pointerleave', () => { hovered = false; arm(); });
  box.addEventListener('focusin', (e) => { if (!focused && !box.contains(e.relatedTarget)) cameFrom = e.relatedTarget; focused = true; });
  box.addEventListener('focusout', (e) => { if (!box.contains(e.relatedTarget)) { focused = false; arm(); } });
  box.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  function close({ now = false } = {}) {
    if (!box.isConnected) return;
    clearTimeout(timer);
    // the keyboard focus was in it (✕, Escape, an action): back to where it was, instead of lost at the top of the page
    if (box.contains(document.activeElement) && cameFrom?.isConnected) cameFrom.focus({ preventScroll: true });
    box.classList.add('is-leaving');
    const done = () => box.remove();
    if (now || matchMedia('(prefers-reduced-motion: reduce)').matches) done(); else setTimeout(done, 200);
    if (current?.box === box) current = null;
  }
  requestAnimationFrame(() => box.classList.add('is-in'));
  arm();
  current = { box, close };
  return current;
}
