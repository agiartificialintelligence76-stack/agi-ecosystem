// CloakMesh's page (inference.agi1.app, 2026-10-03): everything the page says that isn't in cloakmesh.html: the waitlist's
// answers (from /api/cloakmesh) in plain words, leaving the list, and the demo's line.

export const JOIN_WORDS = {
  email: "That email address doesn't look right. Check it and try again.",
  human_check: "We couldn't confirm you're human. Try again in a moment.",
  too_fast: 'Too many tries at once. Wait a minute, then try again.',
  person_cap: "That's the most sign-ups from one connection today. Try again tomorrow.",
  site_cap: 'The waitlist is very busy today. Try again tomorrow.',
  not_ready: 'The waitlist opens soon. Try again a little later.',
  not_configured: 'The waitlist opens soon. Try again a little later.',
  offline: 'You seem to be offline. Check your connection and try again.',
  busy: 'Something went wrong on our side. Try again in a moment.',
};
export const joinWords = (error) => JOIN_WORDS[error] || JOIN_WORDS.busy;

export const WORDS = {
  closed: 'The waitlist opens soon. Check back in a little while.',
  sending: 'Joining…',
  emailHint: 'Enter your email address, like you@company.com.',
  leaving: 'Leaving…',
  left: 'Done. Your email address is deleted from the list.',
  alreadyGone: "Done. That address isn't on the list (it may have left already).",
  leaveBad: "That leave link isn't complete. Copy the whole link and open it again.",
  leaveFailed: (error) => (error === 'offline' ? JOIN_WORDS.offline : error === 'too_fast' ? JOIN_WORDS.too_fast
    : error === 'not_ready' || error === 'not_configured' ? 'The waitlist isn\'t open yet, so there\'s nothing to leave.'
      : 'Something went wrong on our side. Try your link again in a moment.'),
  stay: 'Good to have you. Nothing changed.',
  themeTo: (theme) => (theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'),
};

// the demo's line under its two panes: "Replaced: a name, a card number and 2 email addresses. Nothing was sent."
export function demoLine(phrases) {
  if (!phrases.length) return 'Nothing to hide in this one, so it leaves as you wrote it (still encrypted). Nothing was sent.';
  const list = phrases.length === 1 ? phrases[0] : `${phrases.slice(0, -1).join(', ')} and ${phrases.at(-1)}`;
  return `Replaced: ${list}. Nothing was sent.`;
}
