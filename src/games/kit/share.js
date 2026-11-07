// AGI arcade kit: "Share on X" opens X's own post box with words filled in. The player posts it themselves, or doesn't:
// the site never posts anything (CLAUDE.md, hard rule 6). The words never talk about money, prices or buying (hard
// rule 8): a score, the game's name and its address.
const SITE = 'https://agi1.app';

export function shareUrl({ text, path }) {
  const url = `${SITE}${path}`;
  const q = new URLSearchParams({ text, url });
  return `https://x.com/intent/post?${q.toString()}`;
}

// open it in a new tab (a real link is better: shell.js uses an <a target="_blank">; this is for buttons)
export function openShare(opts) {
  try { window.open(shareUrl(opts), '_blank', 'noopener,noreferrer'); } catch { /* blocked */ }
}
