// AGI-1's holder roles in her Discord server (2026-10-29): agi1.app/discord/verify's words (verify.html,
// src/discord/verify.js), kept apart from the page so tests/holders.test.js can check them without a browser. Always plain
// text (the page shows them with textContent). Never "buy", a price or a promise: a role is a thank-you for holding.
import { agiText } from '../vote/words.js';

export const ROLE = Object.freeze({
  crush: { name: '💘 Crush', emoji: '💘', min: 10_000 },
  soulmate: { name: '💞 Soulmate', emoji: '💞', min: 1_000_000 },
});

// The private link's code, from the page's address: "#t=<code>" (after the "#", so it never reaches a server's log).
// → the code, or null
export function linkFrom(hash) {
  const m = /^#t=([A-Za-z0-9_-]{20,200}\.[A-Za-z0-9_-]{20,80})$/.exec(String(hash ?? ''));
  return m ? m[1] : null;
}
// When the link ends, from its own words (the page only uses it to say how long is left: our server checks it again)
// → ms, or null
export function linkEnds(code) {
  try {
    const [payload] = String(code).split('.');
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const d = JSON.parse(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)));
    return Number.isFinite(d?.e) ? d.e : null;
  } catch {
    return null;
  }
}
export function minutesLeft(ends, now) {
  return ends === null ? null : Math.max(0, Math.ceil((ends - now) / 60_000));
}

export const NO_LINK = {
  title: 'Open this page from AGI-1\'s button',
  note: 'In her Discord server, tap Verify my $AGI in the ✅┃verify channel: she gives you a private link to this page, only for you.',
};
export const EXPIRED = {
  title: 'This link has expired',
  note: 'Links work for 15 minutes. In the Discord server, tap Verify my $AGI in ✅┃verify again for a new one.',
};
export const leftText = (m) => (m === null ? 'Your private link from AGI-1. Don\'t share it.'
  : `Your private link from AGI-1 works for ${m} more ${m === 1 ? 'minute' : 'minutes'}. Don't share it.`);

// The answer (/api/wallet 'dc-verify': server/dc-holders.js) → { title, note, emoji, done }
export function resultText(d = {}) {
  if (d.role === 'crush' || d.role === 'soulmate') {
    const r = ROLE[d.role];
    return {
      done: true, emoji: r.emoji,
      title: `You're a ${r.name} in the server`,
      note: `This wallet has ${agiText(d.agi)} $AGI (held, plus burned for messages). Your role and the 💎┃holders channel are there now: go back to Discord. AGI-1 checks again a few times a day, and the role follows your $AGI.`,
    };
  }
  const kept = d.kept === 'crush' || d.kept === 'soulmate' ? ROLE[d.kept] : null;
  return {
    done: false, emoji: '💜',
    title: `This wallet has ${agiText(d.agi)} $AGI`,
    note: `The roles start at ${agiText(ROLE.crush.min)} $AGI (held, plus burned for messages on agi1.app).${kept ? ` Your ${kept.name} role from the wallet you verified before stays.` : ' Try another wallet, or come back any time.'}`,
  };
}

// What to say when it didn't go through (/api/wallet's errors)
export function verifyError(d = {}) {
  switch (d.error) {
    case 'expired': return EXPIRED.note;
    case 'bad': case 'bad_request': return 'This link isn\'t complete or isn\'t from AGI-1. In the Discord server, tap Verify my $AGI in ✅┃verify again.';
    case 'not_member': return 'You\'re not in AGI-1\'s Discord server any more. Join it again, then tap Verify my $AGI.';
    case 'chain': return 'Couldn\'t read your $AGI on Robinhood Chain just now. Try again in a minute.';
    case 'discord': return 'Discord didn\'t let AGI-1 give the role just now. Try again in a minute, or open a ticket in the server.';
    case 'off': return 'Holder roles are taking a little break. Try again later.';
    case 'not_set_up': return 'Holder roles aren\'t switched on yet. Try again later.';
    case 'signed_out': return 'Your sign-in ended. Connect your wallet again.';
    case 'too_fast': return 'That was fast. Wait a moment and try again.';
    default: return 'Something went wrong. Try again in a minute.';
  }
}

// the sign-in's steps (src/lib/wallet.js)
export const WALLET_STEPS = {
  connect: 'Open your wallet and allow agi1.app to see your address.',
  sign: 'Now sign the message in your wallet. It\'s free: not a transaction.',
  check: 'Checking your signature…',
  slow: 'Still waiting for your wallet. Its window may be behind this one: open the wallet from the browser toolbar.',
};
export const CHECKING = 'Reading your $AGI on Robinhood Chain and giving your role…';
export const NO_WALLET = {
  phone: 'No wallet in this browser. Tap Copy this link, then open it in your wallet app\'s browser (Robinhood Wallet, MetaMask, Phantom, Coinbase Wallet).',
  computer: 'No wallet found in this browser. Add a wallet extension (MetaMask, Phantom, Rabby, Coinbase Wallet) and reload this page, or open the link in your wallet app.',
};
export const COPIED = 'Copied. Open it in your wallet app\'s browser. It\'s only for you: don\'t share it.';
