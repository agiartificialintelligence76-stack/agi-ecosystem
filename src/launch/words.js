// "Launch with AGI-1" (2026-10-01): what the launch page says, and which draft it's about. Pure (no page), so tests can
// read it. Plain words; always shown with textContent.

// The draft in this page's address: agi1.app/launch/<id> (her link), or ?d=<id>. → the id (22 characters) or null
export function draftIdFrom(loc) {
  const path = /^\/launch\/([A-Za-z0-9_-]{22})\/?$/.exec(String(loc?.pathname ?? ''));
  if (path) return path[1];
  const q = new URLSearchParams(String(loc?.search ?? '')).get('d');
  return q && /^[A-Za-z0-9_-]{22}$/.test(q) ? q : null;
}

export const LEVEL_NAME = { 1: 'Stranger', 2: 'Crush', 3: 'Soulmate' };
export const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

// The page's own words, and /api/launch's answers in plain words (its `error` codes)
export const WORDS = {
  start: 'Launch with AGI-1 starts in her Telegram bot: send her /launch with your coin\'s picture, and she sends you a private link to this page.',
  offline: 'You seem to be offline.',
  gone: "This launch link doesn't exist (links are tidied away after 7 days). Send /launch to her Telegram bot to start again.",
  expired: 'This link expired (they last 2 hours). Send /launch to her Telegram bot again.',
  not_ready: "Launching with AGI-1 isn't open yet.",
  error: 'Something went wrong. Try again in a moment.',
  level: "This wallet isn't at Crush yet: launching with AGI-1 needs 10,000+ $AGI held, or burned for messages, in the wallet you launch from. Not financial advice.",
  taken: 'Someone launched a coin with this ticker in the meantime. Send her /launch again with another ticker.',
  common: "So many coins on clank.trade look like this ticker that it can't be checked. Send her /launch again with a more unusual one.",
  launched: 'This coin is already launched.',
  other_wallet: 'This link was already used with another wallet: only that wallet can launch this coin.',
  wallet_cap: "That's enough coins from this wallet for today. Try again tomorrow.",
  site_cap: 'AGI-1 has helped with a lot of coins today. Try again tomorrow.',
  picture: "Couldn't use the picture. Send her /launch again with another photo.",
  telegram: "Couldn't get the picture from Telegram just now. Try again in a minute.",
  pinata: "Couldn't put the picture on IPFS just now. Try again in a minute.",
  chain: "Couldn't reach Robinhood Chain just now. Try again in a minute.",
  clank: "Couldn't check clank.trade just now. Try again in a minute.",
  fee: 'clank.trade charges a launch fee now, and this page never sends ETH, so launches wait for an update of the site.',
  closed: "clank.trade isn't taking new launches from this wallet right now (its own switch), so your wallet wasn't asked. Try again later.",
  uploading: 'Its picture is on its way to IPFS. Try again in a moment.',
  config: "clank.trade changed its launch settings, so launches wait for an update of the site. Your wallet wasn't asked.",
  exists: 'This coin was already launched from this wallet.',
  economics: 'clank.trade changed its launch terms a moment ago. Try again.',
  metadata: "clank.trade didn't accept the coin's details. Send her /launch again.",
  reverted: "clank.trade's dry run of this launch failed, so your wallet wasn't asked. Try again later.",
  too_fast: 'Slow down a little, then try again.',
  signed_out: 'Your wallet signed out. Connect it again.',
  signed_out_waiting: "Your wallet's sign-in ended while waiting. Connect it again to see your coin.",
  not_a_launch: "This page only ever sends clank.trade's launch, and what came back wasn't one, so your wallet wasn't asked. Try again.",
  wrong_chain: 'Switch your wallet to Robinhood Chain first.',
  no_hash: "Your wallet didn't say it sent the launch. Check your wallet's activity before you try again.",
  cancelled: 'You cancelled in your wallet. Nothing was launched.',
  no_switch: "Your wallet couldn't switch to Robinhood Chain. Use MetaMask, Coinbase Wallet or Robinhood Wallet.",
  preparing: 'Getting it ready: checking the ticker on clank.trade, putting the picture on IPFS and trying the launch on Robinhood Chain…',
  approve: 'Approve the launch in your wallet. It sends no ETH; your wallet pays a small network fee.',
  waiting: 'Sent from your wallet. Waiting for Robinhood Chain…',
  slow: "Still waiting for Robinhood Chain. Check your wallet's activity, and reload this page in a minute.",
  // the coin's links (optional, 2026-10-01: src/launch/links.js; the server's checkLinks says the same)
  links: 'Check the links above: one of them needs fixing (or leave it empty).',
  link_twitter: "Use your coin's X account: @yourcoin or x.com/yourcoin.",
  link_telegram: 'Use a Telegram group or channel: t.me/yourgroup, or an invite link (t.me/+…).',
  link_website: 'Use a website address that starts with https://, like https://yourcoin.com.',
  link_agi: "Links can't point to AGI-1, $AGI or agi1.app: your coin is yours, not hers.",
  link_crude: 'Keep the links PG-13, please.',
};
// what's under a link box: what it will be saved as, or what's wrong with it (why: 'format' | 'agi' | 'crude')
export function linkNote(field, saved, why = 'format') {
  if (saved) return `Saved as ${saved}`;
  if (saved === '') return '';
  return why === 'agi' ? WORDS.link_agi : why === 'crude' ? WORDS.link_crude : WORDS[`link_${field}`] || WORDS.links;
}
// wei (a string or a BigInt) → "0.00012 ETH" (at most 6 decimals, never "0 ETH" for a tiny amount)
export function ethText(wei) {
  let w;
  try { w = BigInt(wei); } catch { return ''; }
  if (w <= 0n) return '0 ETH';
  const micro = (w + 999_999_999_999n) / 1_000_000_000_000n;            // millionths of an ETH, rounded up
  const whole = micro / 1_000_000n, frac = String(micro % 1_000_000n).padStart(6, '0').replace(/0+$/, '');
  return `${whole}${frac ? `.${frac}` : ''} ETH`;
}
// her gas wallet paying the network fee back (/api/launch "check": gas; server/launch.js payGasBack says why not)
export function gasText(gas) {
  if (!gas) return '';
  if (gas.paid) return `AGI-1's gas wallet paid your network fee back: ${ethText(gas.wei)}.`;
  return {
    unpaid: 'Paying your network fee back…',
    busy: 'Paying your network fee back…',
    pending: 'Paying your network fee back…',
    contract: "Your wallet is a smart account, so its network fee can't be paid back to it.",
    wallet_cap: 'A network fee was already paid back to this wallet today (one launch a day per wallet), so this one stays yours.',
    site_cap: "Her gas wallet has paid back all it can for today, so this fee wasn't paid back.",
    empty: "Her gas wallet is out of ETH right now, so this fee wasn't paid back yet. Open this page again later to try again.",
    failed: "Her gas wallet couldn't send your fee back just now. Open this page again later to try again.",
    stuck: "Her gas wallet started paying your fee back but never heard how it went. Check your wallet's activity in a few minutes.",
    not_sender: 'Your network fee is paid back only to the wallet that sent the launch.',
  }[gas.why] || '';
}
// a payback the page asks for again in a moment (opening the page again asks once more for the others that can still
// happen: 'empty', 'failed')
export const GAS_AGAIN = ['unpaid', 'busy', 'pending'];
export const gasNote = (maxWei) => `Your wallet shows clank.trade's launch for you to approve: no ETH sent, only a small network fee, which AGI-1's gas wallet pays back once your coin is live (up to ${ethText(maxWei)}; one launch a day per wallet, while it lasts).`;

// her launch, read back from the chain (/api/launch "check")
export const CHECK = {
  failed: 'The launch failed on the chain, so nothing was created (your wallet paid only the network fee). Try again.',
  not_launch: "That transaction didn't launch this coin.",
  other_wallet: 'This coin was launched with another wallet.',
};
// a wallet's sign-in steps (src/lib/wallet.js)
export const STEP = {
  connect: 'Open your wallet to connect…',
  sign: 'Sign the message in your wallet: free, not a transaction.',
  check: 'Checking your $AGI…',
  slow: "Your wallet hasn't answered. Open it (its icon in the browser toolbar, or the app) to finish, or pick another wallet.",
};
