// AGI-1's 3D character studio (2026-10-10): a character's payment, read on Robinhood Chain. The site never asks a wallet
// for a transaction (hard rule 9): the person sends it from their OWN wallet app, then the page asks our server to look.
// This file only READS: a transaction's receipt and its block's time from the chain's public node, and the block explorer's
// list of the wallet's transfers (only to find which transactions to read: nothing counts until the chain itself says so).
// Two ways to pay (the owner's: "Burn $AGI or USDG"):
//   • USDG (Paxos' Global Dollar on Robinhood Chain: docs.robinhood.com/chain/contracts, docs.paxos.com) sent to the owner's
//     own wallet (STUDIO_PAY_TO, an address, not a secret);
//   • $AGI burned: sent to 0x…dEaD (or the coin's own burn(), 0x0), as for messages (server/burn.js).
// A payment counts when, read from the chain: the transaction succeeded; it moved the one official token (its contract's
// Transfer events, never a look-alike) from the connected wallet to where it should go; it happened after the character's
// quote was made (a minute's leeway for clocks) and in the last 7 days. Each counts once (supabase/studio.sql), and a burn
// shares burns.sql's ledger: it counts for messages or for a character, never both.
import { AGI_CONTRACT, rpcUrl, agiDecimals } from './chain.js';
import { UA, readLimited } from './coins.js';
import { BURN_ADDRESS } from '../src/lib/burns.js';

export const USDG = '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168';
const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';   // Transfer(address,address,uint256)
const DEAD = BURN_ADDRESS.toLowerCase();
const ZERO = `0x${'0'.repeat(40)}`;
const AGI = AGI_CONTRACT.toLowerCase();
const USDG_LC = USDG.toLowerCase();
const EXPLORER = 'https://robinhoodchain.blockscout.com/api/v2/addresses/';
export const PAY_WINDOW_MS = 7 * 864e5;
const LEEWAY_MS = 60_000;

// One read-only question to the chain's public node. Anything that goes wrong is a "chain:" error (then nothing counts,
// and it can be checked again later).
async function chain(method, params, env, timeoutMs = 5000) {
  let res, bytes;
  try {
    res = await fetch(rpcUrl(env), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    bytes = await readLimited(res, 2_000_000);
  } catch (err) {
    throw new Error(`chain: ${err.name === 'TimeoutError' || err.name === 'AbortError' ? 'no answer in time' : String(err.message || 'unreachable').slice(0, 80)}`);
  }
  if (!bytes) throw new Error('chain: answer too big');
  let answer;
  try { answer = JSON.parse(bytes.toString('utf8')); } catch { throw new Error('chain: answer is not JSON'); }
  if (answer?.error) throw new Error(`chain: ${String(answer.error.message || 'error').slice(0, 120)}`);
  if (!answer || typeof answer !== 'object' || !('result' in answer)) throw new Error('chain: unexpected answer');
  return answer.result;
}

let usdgDecimalsCache = null;
export const _resetStudioChain = () => { usdgDecimalsCache = null; };
export async function usdgDecimals(env) {
  if (usdgDecimalsCache === null) {
    const hex = await chain('eth_call', [{ to: USDG, data: '0x313ce567' }, 'latest'], env);
    if (typeof hex !== 'string' || !/^0x[0-9a-fA-F]{1,64}$/.test(hex)) throw new Error('chain: odd decimals');
    const d = Number(BigInt(hex));
    if (!Number.isInteger(d) || d < 0 || d > 36) throw new Error('chain: odd decimals');
    usdgDecimalsCache = d;
  }
  return usdgDecimalsCache;
}

const topicAddress = (t) => (typeof t === 'string' && /^0x0{24}[0-9a-fA-F]{40}$/.test(t) ? `0x${t.slice(26).toLowerCase()}` : null);

// What a transaction paid: its receipt's Transfer events of the token (USDG to payTo, or $AGI to 0x…dEaD / 0x0).
// → { paid: from this wallet, others: from any other wallet } (smallest units, BigInt)
export function paidIn(receipt, { kind, wallet, payTo }) {
  const token = kind === 'usdg' ? USDG_LC : AGI;
  const to = kind === 'usdg' ? String(payTo || '').toLowerCase() : null;
  let paid = 0n, others = 0n;
  for (const log of Array.isArray(receipt?.logs) ? receipt.logs : []) {
    if (!log || log.removed === true || String(log.address || '').toLowerCase() !== token) continue;
    const t = log.topics;
    if (!Array.isArray(t) || t.length !== 3 || String(t[0]).toLowerCase() !== TRANSFER) continue;
    const from = topicAddress(t[1]), dest = topicAddress(t[2]);
    if (!from || from === ZERO) continue;
    if (kind === 'usdg' ? dest !== to : dest !== DEAD && dest !== ZERO) continue;
    if (typeof log.data !== 'string' || !/^0x[0-9a-fA-F]{1,64}$/.test(log.data)) continue;
    if (from === wallet) paid += BigInt(log.data); else others += BigInt(log.data);
  }
  return { paid, others };
}

// One transaction, read from the chain. → { ok: true, raw, at } or { ok: false, why }: 'pending' (not on the chain yet) ·
// 'failed' (the transaction failed) · 'nothing' (it paid nothing for this: another token, or somewhere else) ·
// 'other_wallet' (another wallet's) · 'too_old' (before the quote, or more than 7 days ago). Throws "chain:" errors.
export async function readPayment(tx, { kind, wallet, payTo, after, env, now = Date.now() }) {
  const receipt = await chain('eth_getTransactionReceipt', [tx], env);
  if (receipt === null) return { ok: false, why: 'pending' };
  if (!receipt || typeof receipt !== 'object') throw new Error('chain: unexpected receipt');
  if (String(receipt.transactionHash || '').toLowerCase() !== tx) throw new Error('chain: a receipt for another transaction');
  let status;
  try { status = BigInt(receipt.status); } catch { throw new Error('chain: a receipt without its status'); }
  if (status !== 1n) return { ok: false, why: 'failed' };
  const { paid, others } = paidIn(receipt, { kind, wallet, payTo });
  if (paid === 0n) return { ok: false, why: others > 0n ? 'other_wallet' : 'nothing' };
  if (typeof receipt.blockNumber !== 'string' || !/^0x[0-9a-fA-F]{1,16}$/.test(receipt.blockNumber)) throw new Error('chain: a receipt without its block');
  const block = await chain('eth_getBlockByNumber', [receipt.blockNumber, false], env);
  let at;
  try { at = Number(BigInt(block?.timestamp)) * 1000; } catch { throw new Error('chain: a block without its time'); }
  if (!Number.isFinite(at) || at <= 0 || at > now + 3600_000) throw new Error('chain: an odd block time');
  if (at < after - LEEWAY_MS || now - at > PAY_WINDOW_MS) return { ok: false, why: 'too_old' };
  return { ok: true, raw: paid, at };
}

// Smallest units → what it pays toward a character: USDG in cents, $AGI in whole tokens (rounded down)
export async function amountOf(kind, raw, env) {
  const decimals = kind === 'usdg' ? await usdgDecimals(env) : await agiDecimals(env).catch((err) => { throw /^chain:/.test(err.message) ? err : new Error(`chain: ${err.message}`); });
  const unit = 10n ** BigInt(decimals);
  return Number(kind === 'usdg' ? (BigInt(raw) * 100n) / unit : BigInt(raw) / unit);
}

// The wallet's payments since the quote, as the block explorer lists them (newest first, at most 5): only which
// transactions to read. → [{ tx, at }]. Throws when the explorer can't say.
export async function recentPayments(wallet, { kind, payTo, after, now = Date.now(), timeoutMs = 6000 }) {
  const token = kind === 'usdg' ? USDG_LC : AGI;
  const to = kind === 'usdg' ? String(payTo || '').toLowerCase() : null;
  const res = await fetch(`${EXPLORER}${wallet}/token-transfers?type=ERC-20&filter=from&token=${token}`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`explorer HTTP ${res.status}`);
  const bytes = await readLimited(res, 1_500_000);
  if (!bytes) throw new Error('explorer answer too big');
  let body;
  try { body = JSON.parse(bytes.toString('utf8')); } catch { throw new Error('explorer answer is not JSON'); }
  if (!Array.isArray(body?.items)) throw new Error('explorer answer has an unexpected shape');
  const found = new Map();
  for (const it of body.items) {
    const tx = String(it?.transaction_hash ?? it?.tx_hash ?? '').toLowerCase();
    const from = String(it?.from?.hash ?? '').toLowerCase(), dest = String(it?.to?.hash ?? '').toLowerCase();
    const tok = String(it?.token?.address_hash ?? it?.token?.address ?? '').toLowerCase();
    const at = Date.parse(it?.timestamp ?? '');
    if (!/^0x[0-9a-f]{64}$/.test(tx) || from !== wallet || (tok && tok !== token)) continue;
    if (kind === 'usdg' ? dest !== to : dest !== DEAD && dest !== ZERO) continue;
    if (Number.isFinite(at) && (at < after - LEEWAY_MS || now - at > PAY_WINDOW_MS)) continue;
    if (!found.has(tx)) found.set(tx, { tx, at: Number.isFinite(at) ? at : null });
  }
  return [...found.values()].sort((a, b) => (b.at ?? 0) - (a.at ?? 0)).slice(0, 5);
}
