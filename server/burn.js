// Messages paid for by burning $AGI (2026-09-30, the owner's idea: "every chat $AGI is burned … make this better").
// Her free messages stay (10 / 50 / 150 a day by level, src/lib/levels.js). After them, a visitor with a connected wallet
// can burn $AGI for more: they send it from their OWN wallet app to the burn address (0x…dEaD, nobody has its key), then
// press "Check my burn". This file reads that burn on Robinhood Chain and counts it once (supabase/burns.sql); the chat
// then takes one burned message per reply (api/chat.js). Burning once buys a pack (1,000 $AGI = 100 messages at the default
// price), not a burn per message: a transaction per message would mean a wallet pop-up and a network fee every time.
//
// The site never asks a wallet for a transaction (hard rule 9): nothing here signs or sends anything. It only READS: a
// transaction's receipt and its block's time from the chain's public node (the same one as the wallet levels,
// ROBINHOOD_RPC_URL can point elsewhere), and the block explorer's list of the wallet's transfers (only to find which
// transactions to read: nothing counts until the chain itself says so).
//
// A burn counts when all of this is true, read from the chain (never from the visitor):
//   - the transaction succeeded and moved the one official $AGI (Transfer events of its contract, not a look-alike);
//   - from the connected wallet (proved with its free sign-in signature) to 0x…dEaD, or to 0x0 (the coin's own burn());
//   - in the last 7 days (its block's time), and this wallet's part of it wasn't counted before (burns.sql).
// Its messages: the whole $AGI this wallet burned in it ÷ the price (BURN_PER_MESSAGE, 10 $AGI by default), rounded down.
//
// The database never holds a transaction's hash or a wallet's address: both are scrambled first, with the database's own
// random key (burn_key(), made once by burns.sql). Not PASS_SECRET: changing that would otherwise let every burn of the last
// 7 days count again and lose everyone's burned messages; and these codes differ from the wallet codes of the name and notes
// (server/session.js), so burns can't be matched to them.
import { createHmac } from 'node:crypto';
import { AGI_CONTRACT, rpcUrl, agiDecimals } from './chain.js';
import { rpc } from './limits.js';
import { UA, readLimited } from './coins.js';
import { BURN_ADDRESS } from '../src/lib/burns.js';

export { BURN_ADDRESS };                                                       // (the page shows it: src/lib/burns.js)
const DEAD = BURN_ADDRESS.toLowerCase();
const ZERO = `0x${'0'.repeat(40)}`;                                            // where the coin's own burn(amount) sends it
const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';   // Transfer(address,address,uint256)
const AGI = AGI_CONTRACT.toLowerCase();
const EXPLORER = 'https://robinhoodchain.blockscout.com/api/v2/addresses/';
export const BURN_WINDOW_MS = 7 * 864e5;     // a burn counts for 7 days after it happened
export const BURN_PER_DAY = 300;             // burned messages one wallet may take in a day (the site: BURN_DAILY_CAP)
const MAX_CHECKS = 3;                        // transactions read from the chain per "Check my burn"

// The transaction in whatever was pasted: its hash, a block explorer's link (…/tx/0x…), or the 64 characters alone.
// → '0x…' (lowercase) or null
export function txFrom(text) {
  const s = String(text ?? '').slice(0, 400);
  const m = s.match(/0x[0-9a-fA-F]{64}(?![0-9a-fA-F])/) || s.match(/(?<![0-9a-fA-Fx])[0-9a-fA-F]{64}(?![0-9a-fA-F])/);
  return m ? `0x${m[0].toLowerCase().replace(/^0x/, '')}` : null;
}

// ---------- the codes in the database ----------
let keyCache = null;                          // { url, key }: read once per server copy
export const _resetBurnKey = () => { keyCache = null; };
export async function burnKey(cfg) {
  if (keyCache?.url === cfg.supabaseUrl) return keyCache.key;
  const key = await rpc(cfg, 'burn_key', {}, 'burns');
  if (typeof key !== 'string' || !/^[0-9a-f]{64}$/.test(key)) throw new Error('burns: no key (run supabase/burns.sql)');
  keyCache = { url: cfg.supabaseUrl, key };
  return key;
}
const code = (key, text) => createHmac('sha256', key).update(text).digest('base64url').slice(0, 32);
// a wallet's code for its burned messages · a burn's code: this transaction for this wallet (so a transaction with several
// wallets' burns counts each wallet's part once, and pasting someone else's transaction says nothing about it)
export const burnWallet = (key, wallet) => code(key, `wallet:${String(wallet).toLowerCase()}`);
export const txCode = (key, tx, wallet) => code(key, `tx:${String(tx).toLowerCase()}:${String(wallet).toLowerCase()}`);

// ---------- reading the chain ----------
// One JSON-RPC question to the chain's public node (read-only methods only). Anything that goes wrong on the way is a
// "chain:" error (then nothing is counted, and it can be checked again later).
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

// An address inside an event's topic (32 bytes, the address in the last 20)
const topicAddress = (t) => (typeof t === 'string' && /^0x0{24}[0-9a-fA-F]{40}$/.test(t) ? `0x${t.slice(26).toLowerCase()}` : null);

// The $AGI a transaction burned: its receipt's Transfer events of the official contract to 0x…dEaD or 0x0.
// → { burned: from this wallet, others: from any other wallet } (smallest units, BigInt)
export function burnedIn(receipt, wallet) {
  let burned = 0n, others = 0n;
  for (const log of Array.isArray(receipt?.logs) ? receipt.logs : []) {
    if (!log || log.removed === true || String(log.address || '').toLowerCase() !== AGI) continue;
    const t = log.topics;
    if (!Array.isArray(t) || t.length !== 3 || String(t[0]).toLowerCase() !== TRANSFER) continue;
    const from = topicAddress(t[1]), to = topicAddress(t[2]);
    if (!from || from === ZERO || (to !== DEAD && to !== ZERO)) continue;
    if (typeof log.data !== 'string' || !/^0x[0-9a-fA-F]{1,64}$/.test(log.data)) continue;
    if (from === wallet) burned += BigInt(log.data); else others += BigInt(log.data);
  }
  return { burned, others };
}

// One transaction, read from the chain. → { ok: true, raw, at } or { ok: false, why }:
//   'pending' (not on the chain yet: try again in a moment) · 'failed' (the transaction failed) · 'not_agi' (it burned no
//   official $AGI) · 'other_wallet' (it burned another wallet's $AGI) · 'too_old' (more than 7 days ago)
// Throws a "chain:" error when the chain can't say.
export async function readBurn(tx, wallet, { env, now = Date.now() } = {}) {
  const receipt = await chain('eth_getTransactionReceipt', [tx], env);
  if (receipt === null) return { ok: false, why: 'pending' };
  if (!receipt || typeof receipt !== 'object') throw new Error('chain: unexpected receipt');
  if (String(receipt.transactionHash || '').toLowerCase() !== tx) throw new Error('chain: a receipt for another transaction');
  let status;
  try { status = BigInt(receipt.status); } catch { throw new Error('chain: a receipt without its status'); }
  if (status !== 1n) return { ok: false, why: 'failed' };
  const { burned, others } = burnedIn(receipt, wallet);
  if (burned === 0n) return { ok: false, why: others > 0n ? 'other_wallet' : 'not_agi' };
  if (typeof receipt.blockNumber !== 'string' || !/^0x[0-9a-fA-F]{1,16}$/.test(receipt.blockNumber)) throw new Error('chain: a receipt without its block');
  const block = await chain('eth_getBlockByNumber', [receipt.blockNumber, false], env);
  let at;
  try { at = Number(BigInt(block?.timestamp)) * 1000; } catch { throw new Error('chain: a block without its time'); }
  if (!Number.isFinite(at) || at <= 0 || at > now + 3600_000) throw new Error('chain: an odd block time');
  if (now - at > BURN_WINDOW_MS) return { ok: false, why: 'too_old' };
  return { ok: true, raw: burned, at };
}

// Smallest units → messages at `price` whole $AGI each (rounded down; parts of a token don't count), and the whole $AGI
// they stand for (in steps of the price: what the database keeps, and what counts toward the level)
export function messagesFor(raw, decimals, price) {
  const whole = BigInt(raw) / 10n ** BigInt(decimals);
  const messages = whole / BigInt(price);
  return { messages: Number(messages), agi: Number(messages * BigInt(price)) };
}

// Count one burn for this wallet, after reading it from the chain. → { ok: true, messages, agi, left } or { ok: false, why }
// (readBurn's reasons, and 'too_small': under the price of one message · 'used': counted before)
export async function claimBurn(cfg, { tx, wallet, env, now = Date.now(), seen = null }) {
  const key = await burnKey(cfg);
  const id = txCode(key, tx, wallet);
  const counted = seen ?? await rpc(cfg, 'burn_seen', { p_txs: [id] }, 'burns');
  if (Array.isArray(counted) && counted.includes(id)) return { ok: false, why: 'used' };
  const r = await readBurn(tx, wallet, { env, now });
  if (!r.ok) return r;
  const decimals = await agiDecimals(env).catch((err) => { throw /^chain:/.test(err.message) ? err : new Error(`chain: ${err.message}`); });
  const { messages, agi } = messagesFor(r.raw, decimals, cfg.burnPrice);
  if (messages < 1) return { ok: false, why: 'too_small' };
  const saved = await rpc(cfg, 'burn_claim', { p_tx: id, p_wallet: burnWallet(key, wallet), p_messages: messages, p_agi: agi }, 'burns');
  if (!saved || saved.ok !== true) {
    if (saved?.why === 'used') return { ok: false, why: 'used' };
    throw new Error('burns: the database refused a burn');
  }
  return { ok: true, messages, agi, left: Number(saved.left) };
}

// The wallet's recent burns of $AGI, as the block explorer lists them (newest first, at most 5): only which transactions
// to read, since each is checked on the chain before it counts. → [{ tx, at }]. Throws when the explorer can't say.
export async function recentBurns(wallet, { now = Date.now(), timeoutMs = 6000 } = {}) {
  const res = await fetch(`${EXPLORER}${wallet}/token-transfers?type=ERC-20&filter=from&token=${AGI}`, {
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
    // (Blockscout named the transaction's field tx_hash before transaction_hash, and the token's address address before address_hash)
    const tx = String(it?.transaction_hash ?? it?.tx_hash ?? '').toLowerCase();
    const from = String(it?.from?.hash ?? '').toLowerCase(), to = String(it?.to?.hash ?? '').toLowerCase();
    const token = String(it?.token?.address_hash ?? it?.token?.address ?? '').toLowerCase();
    const at = Date.parse(it?.timestamp ?? '');
    if (!/^0x[0-9a-f]{64}$/.test(tx) || from !== wallet || (to !== DEAD && to !== ZERO) || (token && token !== AGI)) continue;
    if (Number.isFinite(at) && now - at > BURN_WINDOW_MS) continue;
    if (!found.has(tx)) found.set(tx, { tx, at: Number.isFinite(at) ? at : null });
  }
  return [...found.values()].sort((a, b) => (b.at ?? 0) - (a.at ?? 0)).slice(0, 5);
}

// "Check my burn": the one transaction pasted, or else the wallet's recent burns from the explorer, each read from the chain
// and counted once. → { source: 'pasted' | 'explorer', results: [claimBurn's answers], counted: burns the explorer listed
// that were counted before, more: new ones left for the next check }. Throws when the chain (pasted) or the explorer can't
// say: err.why = 'chain' | 'explorer'.
export async function checkBurns(cfg, { wallet, tx = null, env, now = Date.now() }) {
  if (tx) {
    try {
      return { source: 'pasted', results: [await claimBurn(cfg, { tx, wallet, env, now })], counted: 0, more: 0 };
    } catch (err) {
      if (!/^chain:/.test(err.message)) throw err;                 // (the database: the caller answers "busy")
      throw Object.assign(new Error(err.message), { why: 'chain' });
    }
  }
  let list;
  try { list = await recentBurns(wallet, { now }); } catch (err) { throw Object.assign(new Error(err.message), { why: 'explorer' }); }
  if (!list.length) return { source: 'explorer', results: [], counted: 0, more: 0 };
  const key = await burnKey(cfg);
  const ids = list.map((b) => txCode(key, b.tx, wallet));
  const seen = new Set(await rpc(cfg, 'burn_seen', { p_txs: ids }, 'burns') || []);
  const unseen = list.filter((b, i) => !seen.has(ids[i]));
  const results = [];
  for (const b of unseen.slice(0, MAX_CHECKS)) {
    try {
      results.push(await claimBurn(cfg, { tx: b.tx, wallet, env, now, seen: [] }));
    } catch (err) {
      if (!/^chain:/.test(err.message)) throw err;
      results.push({ ok: false, why: 'chain' });
    }
  }
  return { source: 'explorer', results, counted: list.length - unseen.length, more: Math.max(0, unseen.length - MAX_CHECKS) };
}

// ---------- using them ----------
// One burned message for a reply, after the free ones (api/chat.js). take: this one's id (so a failed reply gives back
// exactly this one). → { ok: true, left, today } or { ok: false, why: 'none' | 'day_cap' | 'site_cap' | 'too_fast', left }
export async function takeBurned(cfg, wallet, take) {
  const r = await rpc(cfg, 'burn_take', {
    p_wallet: burnWallet(await burnKey(cfg), wallet), p_per_day: BURN_PER_DAY, p_site_daily: cfg.burnDailyCap,
    p_min_gap_ms: cfg.minGapMs, p_take: take,
  }, 'burns');
  if (!r || typeof r.ok !== 'boolean') throw new Error('burns: unexpected answer');
  return r;
}
// Her reply failed after that burned message was taken: it's given back (the attempt still counts toward the daily caps)
export const refundBurned = async (cfg, wallet, take) => rpc(cfg, 'burn_refund', { p_wallet: burnWallet(await burnKey(cfg), wallet), p_take: take }, 'burns');

const count = (x) => (Number.isFinite(Number(x)) && Number(x) > 0 ? Number(x) : 0);
// A wallet's burned messages → { left, bought, agi, today }. Throws (err.code PGRST202) when burns.sql isn't run.
export async function burnStatus(cfg, wallet) {
  const r = await rpc(cfg, 'burn_status', { p_wallet: burnWallet(await burnKey(cfg), wallet) }, 'burns');
  return { left: count(r?.left), bought: count(r?.bought), agi: count(r?.agi), today: count(r?.today) };
}
// The whole $AGI a wallet burned for messages (it counts toward the level): 0 when it can't be read
export async function burnedAgi(cfg, wallet) {
  if (!cfg.supabaseUrl || !cfg.supabaseKey || cfg.passSecret.length < 32) return 0;
  try {
    return (await burnStatus(cfg, wallet)).agi;
  } catch (err) {
    if (err.code !== 'PGRST202') console.error('[burn] couldn\'t read what this wallet burned:', err.message);
    return 0;
  }
}
// The burn monitor above the chat → { agi, messages, burns, today, lastAt }: $AGI burned for messages so far by everyone, the
// messages it bought, how many burns, the $AGI burned today (UTC), and when the latest burn was counted (ms, or null).
// Throws (err.code PGRST202) when burns.sql isn't run.
export async function burnTotal(cfg) {
  const r = await rpc(cfg, 'burn_total', {}, 'burns');
  const last = Date.parse(r?.last_at ?? '');
  return { agi: count(r?.agi), messages: count(r?.messages), burns: count(r?.burns), today: count(r?.today), lastAt: Number.isFinite(last) ? last : null };
}
