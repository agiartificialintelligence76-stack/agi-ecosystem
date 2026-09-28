// Phase 5: the "Share on X" links and "Save image" buttons.
// "Share on X" is a plain link to X's new-post box, filled in with a ready-made post and a link: the visitor reads it and
// presses Post themselves (or closes it). Nothing is ever posted automatically, and no data goes to X until they do.
import { intentUrl } from './texts.js';
import { saveCard } from './card.js';

export function setShareLink(link, text, url) {
  if (link) link.href = intentUrl(text, url);
}

// get() → { card, filename, text } for the current picture, or null
export function onSaveImage(button, get) {
  if (!button) return;
  const label = button.textContent;
  let timer = null;
  button.addEventListener('click', async () => {
    const what = get();
    if (!what || button.disabled) return;
    clearTimeout(timer);
    button.disabled = true;
    button.textContent = 'Making it…';
    try {
      const done = await saveCard(what.card, what.filename, what.text);
      button.textContent = done === 'saved' ? 'Saved ✓' : done === 'shared' ? 'Shared ✓' : label;
    } catch {
      button.textContent = "Couldn't make it";
    } finally {
      button.disabled = false;
      timer = setTimeout(() => { button.textContent = label; }, 2500);
    }
  });
}
