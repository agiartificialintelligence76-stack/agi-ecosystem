import { mergeMemes } from '../memes/list.js';

// Before cards had stable IDs, the page editor saved their positions. Keep those
// edits on the original item when newest-first ordering or later uploads move it.
const LEGACY_RELEASE = Date.parse('2026-10-27T09:53:00Z');
const normalized = (text) => String(text || '').replace(/\s+/g, ' ').trim();
export function memeEditSelector(edit, document) {
  const match = /^#mm-grid-(image|video|slopcore) > li:nth-of-type\(([1-9][0-9]*)\)(.*)$/.exec(edit.selector);
  if (!match) return edit.selector;
  const all = mergeMemes(document?.memes, { sort: false });
  const field = /^ > div:nth-of-type\(1\) > div:nth-of-type\(1\) > p:nth-of-type\(([12])\)$/.exec(match[3]);
  const sameText = field && typeof edit.text === 'string' && normalized(edit.text)
    ? all.filter(m => m.kind === match[1] && normalized(m[field[1] === '1' ? 'title' : 'note']) === normalized(edit.text)) : [];
  const legacy = all.filter(m => m.kind === match[1] && (!m.addedAt || m.addedAt <= LEGACY_RELEASE));
  const item = sameText.length === 1 ? sameText[0] : legacy[Number(match[2]) - 1];
  return item ? `#meme-${item.id}${match[3]}` : '';
}
