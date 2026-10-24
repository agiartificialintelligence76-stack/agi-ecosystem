// Community votes (agi1.app/vote, 2026-10-24): the page's words, kept apart from the page so tests/vote.test.js can check
// them without a browser. Always plain text (the page shows them with textContent).

// 12,500 · 1.25M · 3.4B (whole $AGI)
export function agiText(n) {
  const v = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  const cut = (x, unit) => `${(Math.floor(x * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}${unit}`;
  if (v >= 1e9) return cut(v / 1e9, 'B');
  if (v >= 1e6) return cut(v / 1e6, 'M');
  return v.toLocaleString('en-US');
}

export const shortWallet = (w) => `${String(w).slice(0, 6)}…${String(w).slice(-4)}`;

// "2 days 4 hours" · "5 hours 12 minutes" · "8 minutes" · "less than a minute"
export function whenText(ms) {
  const m = Math.max(0, Math.floor(ms / 60_000));
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), min = m % 60;
  const n = (x, one) => `${x} ${one}${x === 1 ? '' : 's'}`;
  if (d) return h ? `${n(d, 'day')} ${n(h, 'hour')}` : n(d, 'day');
  if (h) return min ? `${n(h, 'hour')} ${n(min, 'minute')}` : n(h, 'hour');
  return min ? n(min, 'minute') : 'less than a minute';
}

const dateText = (iso) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

// the line above a poll's question
export function stateText(p, now) {
  if (p.state === 'soon') return `Opens ${dateText(p.opens)} · in ${whenText(Date.parse(p.opens) - now)}`;
  if (p.state === 'open') return `Open · closes in ${whenText(Date.parse(p.closes) - now)}`;
  if (p.state === 'counting') return `Closed ${dateText(p.closes)} · final count in progress (${p.left} ${p.left === 1 ? 'wallet' : 'wallets'} to check again)`;
  return `Final result · closed ${dateText(p.closes)}`;
}

// what to say when a vote didn't go through (/api/wallet's errors: server/vote.js)
export function voteError(d = {}) {
  switch (d.error) {
    case 'too_few': return `This wallet holds ${agiText(d.agi)} $AGI. Voting needs ${agiText(d.min)} or more.`;
    case 'closed': return 'This vote has closed.';
    case 'soon': return 'This vote hasn\'t opened yet.';
    case 'counted': return 'This vote has closed and been counted.';
    case 'chain': return 'Couldn\'t read your $AGI on Robinhood Chain just now. Try again in a minute.';
    case 'signed_out': return 'Your sign-in ended. Connect your wallet again.';
    case 'too_fast': return 'That was fast. Wait a moment and try again.';
    case 'not_ready': return 'Voting isn\'t switched on yet. Try again later.';
    default: return 'Something went wrong. Try again.';
  }
}

// the sign-in's steps (src/lib/wallet.js), as the games' page says them
export const WALLET_STEPS = {
  connect: 'Open your wallet and allow agi1.app to see your address.',
  sign: 'Now sign the message in your wallet. It\'s free: not a transaction.',
  check: 'Checking your signature and your $AGI…',
  slow: 'Still waiting for your wallet. Its window may be behind this one: open the wallet from the browser toolbar.',
};
export const NO_WALLET = {
  phone: 'No wallet found here. Open agi1.app/vote in your wallet app\'s browser (Robinhood Wallet, MetaMask, Phantom, Coinbase Wallet).',
  computer: 'No wallet found in this browser. Add a wallet extension (MetaMask, Phantom, Rabby, Coinbase Wallet) and reload this page.',
};
