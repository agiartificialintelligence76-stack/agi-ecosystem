// Talks to the visitor's wallet: a browser extension (MetaMask, Phantom, Rabby, Coinbase Wallet…) or a wallet app's
// built-in browser (Robinhood Wallet, MetaMask, Phantom, Coinbase Wallet). It only ever asks the wallet for:
//   1. its address                          (eth_requestAccounts)
//   2. which network it's on, read-only     (eth_chainId: the sign-in message names it, see server/signin.js)
//   3. a signature on a plain-text message  (personal_sign): free, not a transaction, no gas
// It never asks for transactions, token approvals or network changes. tests/wallet.test.js fails the build if it does.
import { postJson } from './human.js';

const announced = new Map();           // wallets that introduced themselves (the EIP-6963 standard), by id
addEventListener('eip6963:announceProvider', (e) => {
  const d = e.detail;
  if (d?.info?.uuid && d.provider && typeof d.provider.request === 'function') announced.set(d.info.uuid, d);
});

const usable = (p) => !!p && typeof p.request === 'function';
const isPhantom = (w) => w.rdns === 'app.phantom' || /phantom/i.test(w.name) || w.provider?.isPhantom === true;
// A wallet's own logo, as it introduced itself: any data:image picture (2026-09-26: Phantom's wasn't shown because only a
// few picture types were accepted). Pictures only (in an <img>, where they can't run anything); never web addresses.
export function walletIcon(v) {
  const icon = typeof v === 'string' ? v.trim() : '';
  return /^data:image\/[a-z0-9.+-]{2,40}[;,]/i.test(icon) && icon.length <= 300_000 ? icon : null;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// The wallets in this browser: [{ id, name, icon, rdns, provider }]. Waits a moment for wallets to answer.
export async function findWallets() {
  dispatchEvent(new Event('eip6963:requestProvider'));
  await wait(350);
  const phantom = window.phantom?.ethereum;
  const phantomAnnounced = () => [...announced.values()].some((d) => isPhantom({ rdns: d.info.rdns, name: String(d.info.name || ''), provider: d.provider }));
  // Phantom is there but hasn't introduced itself yet (with its name and logo): give it up to a second more
  for (let t = 0; usable(phantom) && !phantomAnnounced() && t < 5; t++) await wait(200);
  const list = [...announced.values()].map((d) => ({
    id: d.info.uuid,
    name: String(d.info.name || 'Wallet').slice(0, 40),
    icon: walletIcon(d.info.icon),
    rdns: typeof d.info.rdns === 'string' ? d.info.rdns : '',
    provider: d.provider,
  }));
  // Phantom's own address for its Ethereum side, in case it didn't introduce itself (older versions, some settings)
  if (usable(phantom) && !list.some((w) => w.provider === phantom || isPhantom(w))) {
    list.push({ id: 'phantom', name: 'Phantom', icon: null, rdns: 'app.phantom', provider: phantom });
  }
  // Older wallets and in-app browsers only offer window.ethereum
  const injected = window.ethereum;
  if (!list.length && usable(injected)) {
    const name = injected.isPhantom ? 'Phantom' : injected.isCoinbaseWallet ? 'Coinbase Wallet' : injected.isMetaMask ? 'MetaMask' : 'Browser wallet';
    list.push({ id: 'injected', name, icon: null, rdns: '', provider: injected });
  }
  return list;
}

const toHex = (text) => `0x${[...new TextEncoder().encode(text)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;

// The network the wallet is on (read-only). Some wallets answer in hex ("0x1"), some with a number. null = unknown.
async function readChain(provider) {
  try {
    const id = await provider.request({ method: 'eth_chainId' });
    const n = typeof id === 'number' ? id : typeof id === 'string' && /^0x[0-9a-f]+$/i.test(id) ? parseInt(id, 16) : NaN;
    return Number.isSafeInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

// If the wallet hasn't answered after a while, its window may be hidden: onSlow() lets the page say where to look.
const SLOW_MS = 15000;
async function patiently(promise, onSlow) {
  const timer = setTimeout(onSlow, SLOW_MS);
  try { return await promise; } finally { clearTimeout(timer); }
}

// The whole sign-in. onStep('connect' | 'sign' | 'check' | 'slow') lets the page say what's happening.
// Resolves to the server's profile ({ session, wallet, level, levelName, daily, name, notes, checked }).
export async function signInWithWallet(provider, onStep = () => {}) {
  const slow = () => onStep('slow');
  onStep('connect');
  const accounts = await patiently(provider.request({ method: 'eth_requestAccounts' }), slow);
  const address = Array.isArray(accounts) ? accounts[0] : null;
  if (typeof address !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error('no_account');
  const chainId = await readChain(provider);

  const start = await postJson('/api/wallet', { action: 'start', address, chainId });
  if (!start.ok) throw new Error(start.data.error || 'error');

  onStep('sign');
  const signature = await patiently(provider.request({ method: 'personal_sign', params: [toHex(start.data.message), address] }), slow);

  onStep('check');
  const done = await postJson('/api/wallet', { action: 'finish', message: start.data.message, ticket: start.data.ticket, signature });
  if (!done.ok) throw new Error(done.data.error || 'error');
  return done.data;
}

// A wallet said "the user said no" (EIP-1193 code 4001)
export const userRejected = (err) => err?.code === 4001 || /reject|denied|cancel/i.test(String(err?.message || ''));

// Our own short error codes (from this file and /api/wallet). Anything else came from the wallet itself.
const OURS = new Set(['offline', 'expired', 'no_account', 'bad_address', 'bad_signature', 'wrong_signer', 'bad_request', 'not_configured', 'error']);

// What to tell the visitor when a sign-in fails. Always plain text (the page shows it with textContent).
export function explainWalletError(err) {
  const msg = String(err?.message || '');
  if (userRejected(err)) return 'You cancelled in your wallet. Nothing happened.';
  if (err?.code === -32002 || /already (pending|processing)/i.test(msg)) {
    return 'Your wallet already has a request open. Open the wallet (its icon in the browser toolbar) to finish or cancel it, then try again.';
  }
  if (msg === 'offline') return 'You seem to be offline.';
  if (msg === 'expired') return 'That took too long. Try again.';
  if (msg === 'no_account') return "Your wallet didn't share an address. Unlock it and try again.";
  if (msg === 'wrong_signer' || msg === 'bad_signature') return "That signature didn't match this wallet. Try again.";
  if (msg === 'not_configured') return "Wallet sign-in isn't switched on yet. Try again later.";
  if (msg && !OURS.has(msg)) {
    const said = msg.replace(/\s+/g, ' ').trim().slice(0, 140);
    return `Couldn't sign you in. Your wallet said: "${said}"`;
  }
  return "Couldn't sign you in. Try again.";
}
