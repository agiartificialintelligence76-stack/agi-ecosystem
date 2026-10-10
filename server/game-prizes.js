// Her games' prizes (2026-10-09, server/games.js): claimed in her private chat (the owner's choice: "Private chat with her
// bot"; 18+, the owner's: "Yes, 18+ to claim", her private chat's own check, done by server/telegram.js first), sent in $AGI
// by her prize wallet (PRIZE_WALLET_KEY: the owner's, a wallet made only for this, holding only the $AGI for prizes and a
// little ETH for the network fee; never the launch gas wallet).
//   /claim → "send me your wallet address" → their address (checked: a real address, its capital letters right, not a
//   contract or ours) → "send 250 $AGI to 0x…?" with two buttons → "yes, send it": claimed in the database first (once),
//   then signed, recorded and sent (server/hot-wallet.js: never twice), then its transaction, linked.
// She only ever asks for an address: never a seed phrase, a private key, a signature or a link to connect a wallet. (And a
// private key or a seed phrase sent to her by mistake is never passed on: server/secrets.js.)
import { encodeFunctionData, parseAbi, isAddress, getAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { chain, sendPlanned, SEND_MS, TXHASH } from './hot-wallet.js';
import { AGI_CONTRACT, agiDecimals } from './chain.js';
import { gameDb, prizesOn } from './games.js';
import { say, tgCall } from './tg-api.js';
import * as G from './game-lines.js';

const TRANSFER = parseAbi(['function transfer(address to, uint256 amount) returns (bool)']);
const BALANCE_OF = '0x70a08231';
export const BURN = '0x000000000000000000000000000000000000dead';
export const ZERO = `0x${'0'.repeat(40)}`;
// an EIP-7702 wallet: a normal wallet with a delegation (MetaMask's "smart account", say): it can hold $AGI like any other
const DELEGATED = /^0xef0100[0-9a-f]{40}$/i;
const PLAN_MS = 4000;
const GAS_CAP = 1_500_000n;        // an ERC-20 transfer needs far less, even with Robinhood Chain's data fee in its gas
const buttons = (rows) => ({ reply_markup: { inline_keyboard: rows } });

// ---------- the prize wallet ----------
let wallet = { key: null, address: null };
export function prizeWallet(cfg) {
  if (!cfg?.prizeKey) return null;
  if (wallet.key !== cfg.prizeKey) wallet = { key: cfg.prizeKey, address: privateKeyToAccount(cfg.prizeKey).address.toLowerCase() };
  return wallet.address;
}
const amountOf = (n) => {
  const a = Number(n);
  return Number.isInteger(a) && a > 0 && a <= 1_000_000 ? BigInt(a) : null;
};
const unitsOf = async (amount, env) => amount * 10n ** BigInt(await agiDecimals(env));
const balanceCall = (address) => `${BALANCE_OF}${address.slice(2).padStart(64, '0')}`;

// Can it pay `amount` whole $AGI now (and the network fee)? → { ok: true } · { ok: false, why: 'agi' | 'eth' } (said in the
// log, with its address, for the owner to top it up) · throws "chain:" when the chain can't say
export async function prizeReady(cfg, amount, env) {
  const from = prizeWallet(cfg);
  const a = amountOf(amount);
  if (!from || a === null) return { ok: false, why: 'agi' };
  const [eth, agi, units] = await Promise.all([
    chain('eth_getBalance', [from, 'latest'], env, 3000), chain('eth_call', [{ to: AGI_CONTRACT, data: balanceCall(from) }, 'latest'], env, 3000), unitsOf(a, env),
  ]);
  let held, gas;
  try { held = BigInt(agi === '0x' ? 0 : agi); gas = BigInt(eth); } catch { throw new Error('chain: odd balances'); }
  if (held < units) { emptyNote(from, 'agi'); return { ok: false, why: 'agi' }; }
  if (gas === 0n) { emptyNote(from, 'eth'); return { ok: false, why: 'eth' }; }
  return { ok: true };
}
const noted = new Map();
export function forgetPrizes() { wallet = { key: null, address: null }; noted.clear(); }   // (for the tests: a fresh server copy)
function emptyNote(from, what) {
  const now = Date.now();
  if (now - (noted.get(what) ?? -Infinity) < 30 * 60_000) return;
  noted.set(what, now);
  console.warn(`[games] the prize wallet ${from} is out of ${what === 'agi' ? '$AGI' : 'ETH (for the network fee)'}: top it up, or her quizzes are just for fun and claims wait`);
}

// The prize as a transaction: $AGI's own transfer(to, amount) from the prize wallet, with the wallet's numbers. → { ok:
// true, plan } · { ok: false, why: 'empty' } (not enough $AGI, or ETH for the fee) · throws "chain:"
export async function prizePlan(cfg, to, amount, env, timeoutMs = PLAN_MS) {
  const from = prizeWallet(cfg);
  const a = amountOf(amount);
  if (!from || a === null || !/^0x[0-9a-f]{40}$/.test(to)) throw new Error('chain: not a prize to send');
  const units = await unitsOf(a, env);
  const data = encodeFunctionData({ abi: TRANSFER, functionName: 'transfer', args: [to, units] });
  const asked = await Promise.allSettled([
    chain('eth_getBalance', [from, 'latest'], env, timeoutMs),
    chain('eth_gasPrice', [], env, timeoutMs),
    chain('eth_getTransactionCount', [from, 'pending'], env, timeoutMs),
    chain('eth_call', [{ to: AGI_CONTRACT, data: balanceCall(from) }, 'latest'], env, timeoutMs),
    chain('eth_estimateGas', [{ from, to: AGI_CONTRACT, data, value: '0x0' }], env, timeoutMs),
  ]);
  const [ethA, priceA, nonceA, agiA, gasA] = asked;
  let held = null;
  if (agiA.status === 'fulfilled') { try { held = BigInt(agiA.value === '0x' ? 0 : agiA.value); } catch { /* odd */ } }
  if (held !== null && held < units) { emptyNote(from, 'agi'); return { ok: false, why: 'empty' }; }
  const failed = asked.find((x) => x.status === 'rejected');
  if (failed) {
    if (failed.reason?.rpc && /insufficient funds/i.test(failed.reason.message)) { emptyNote(from, 'eth'); return { ok: false, why: 'empty' }; }
    throw failed.reason;
  }
  let balance, maxFee, nonce, gas;
  try {
    balance = BigInt(ethA.value);
    maxFee = BigInt(priceA.value) * 2n;                 // room for the price to rise before it's in a block
    nonce = Number(BigInt(nonceA.value));
    gas = (BigInt(gasA.value) * 12n) / 10n;
  } catch {
    throw new Error('chain: odd numbers for the prize');
  }
  if (held === null || maxFee <= 0n || gas <= 0n || !Number.isSafeInteger(nonce) || nonce < 0) throw new Error('chain: odd numbers for the prize');
  if (gas > GAS_CAP) throw new Error(`chain: the prize would need ${gas} gas (at most ${GAS_CAP})`);
  if (balance < gas * maxFee) { emptyNote(from, 'eth'); return { ok: false, why: 'empty' }; }
  return { ok: true, plan: { to: AGI_CONTRACT, value: 0n, data, nonce, gas, maxFee } };
}

// A prize claimed (game_claim: { id, address, amount }) is sent: its plan, then signed, recorded ("sending", with its
// transaction) and sent; kept as sent, or given back when nothing went out (they can tap send again); a transfer the
// chain says failed is given back too (nothing moved). → { ok: true, tx } · { ok: false, why: 'empty' | 'failed' | 'busy'
// | 'pending' (whether it went out can't be told: it stays "sending", never sent again) }
export async function sendPrize(cfg, prize, env, { deadline = Date.now() + PLAN_MS + SEND_MS + 2000 } = {}) {
  const giveBack = (tx = null) => gameDb.sent(cfg, prize.id, tx, false)
    .catch((err) => console.error(`[games] giving a prize back failed (it's given back by itself in 2 minutes): ${err.message}`));
  const forPlan = Math.min(PLAN_MS, deadline - Date.now() - SEND_MS);
  let plan;
  try {
    if (forPlan < 1500) throw new Error('no time left');
    plan = await prizePlan(cfg, prize.address, prize.amount, env, forPlan);
  } catch (err) {
    console.warn(`[games] sending a prize: couldn't get it ready (${err.message}); nothing went out`);
    await giveBack();
    return { ok: false, why: 'busy' };
  }
  if (!plan.ok) { await giveBack(); return { ok: false, why: 'empty' }; }
  const sent = await sendPlanned(cfg.prizeKey, plan.plan, env, {
    deadline, mark: async (tx) => (await gameDb.sending(cfg, prize.id, tx)) === true,
  });
  if (sent.ok) {
    try { await gameDb.sent(cfg, prize.id, sent.tx, true); } catch (err) { console.error(`[games] keeping a sent prize failed (sent: ${sent.tx}): ${err.message}`); }
    // Robinhood Chain is quick: its receipt is usually there within a second. A transfer that failed moved nothing.
    if (await failedOnChain(sent.tx, env, Math.min(3000, deadline - Date.now()))) {
      await giveBack(sent.tx);
      console.warn(`[games] a prize's transfer failed on the chain (${sent.tx}): nothing moved, it can be sent again`);
      return { ok: false, why: 'failed' };
    }
    return { ok: true, tx: sent.tx };
  }
  if (['empty', 'failed', 'unmarked'].includes(sent.why)) await giveBack();
  if (sent.why === 'unsure') {
    console.warn('[games] a prize\'s nonce was taken and the chain couldn\'t say by what: it stays "sending" (never sent again)');
    return { ok: false, why: 'pending' };
  }
  if (sent.why === 'empty') emptyNote(prizeWallet(cfg), 'eth');
  return { ok: false, why: sent.why === 'unmarked' ? 'busy' : sent.why === 'empty' ? 'empty' : 'failed' };
}
// → true when the chain says this transaction failed; false when it went through, or nothing is known (yet) (since round 2
// of AGI Studio, 2026-10-10, its weekly spotlight's prize uses these two too: server/inf-week.js)
export async function failedOnChain(tx, env, waitMs) {
  const until = Date.now() + Math.max(0, waitMs);
  for (;;) {
    let receipt = null;
    try { receipt = await chain('eth_getTransactionReceipt', [tx], env, 1500); } catch { return false; }
    if (receipt && typeof receipt === 'object') {
      try { return BigInt(receipt.status) === 0n; } catch { return false; }
    }
    if (Date.now() + 700 > until) return false;
    await new Promise((r) => setTimeout(r, 600));
  }
}
// what the chain says about a prize's transaction → 'ok' | 'failed' | null (not known yet) · never throws
export async function txState(tx, env) {
  try {
    const receipt = await chain('eth_getTransactionReceipt', [tx], env, 2500);
    if (!receipt || typeof receipt !== 'object') return null;
    return BigInt(receipt.status) === 1n ? 'ok' : 'failed';
  } catch { return null; }
}

// ---------- the address they send ----------
// The one address in a short message (they may paste it with a word or two), or null
export function addressIn(text) {
  const s = String(text ?? '');
  if (s.length > 160) return null;
  const all = s.match(/0x[0-9a-fA-F]{40}(?![0-9a-fA-F])/g) || [];
  return all.length === 1 && !/0x[0-9a-fA-F]{41,}/.test(s) ? all[0] : null;
}
// → { ok: true, address (lowercase) } · { ok: false, why: 'bad' | 'checksum' | 'zero' | 'burn' | 'agi' | 'ours' | 'contract' |
// 'chain' }
export async function checkAddress(cfg, raw, env) {
  const a = String(raw ?? '');
  if (!/^0x[0-9a-fA-F]{40}$/.test(a)) return { ok: false, why: 'bad' };
  const hex = a.slice(2);
  if (/[a-f]/.test(hex) && /[A-F]/.test(hex) && !isAddress(a, { strict: true })) return { ok: false, why: 'checksum' };
  const address = a.toLowerCase();
  if (address === ZERO) return { ok: false, why: 'zero' };
  if (address === BURN) return { ok: false, why: 'burn' };
  if (address === AGI_CONTRACT) return { ok: false, why: 'agi' };
  if (address === prizeWallet(cfg)) return { ok: false, why: 'ours' };
  let code;
  try { code = await chain('eth_getCode', [address, 'latest'], env, 4000); } catch { return { ok: false, why: 'chain' }; }
  if (typeof code !== 'string' || !/^0x[0-9a-fA-F]*$/.test(code)) return { ok: false, why: 'chain' };
  if (code !== '0x' && !DELEGATED.test(code)) return { ok: false, why: 'contract' };
  return { ok: true, address };
}

// ---------- the conversation (server/telegram.js, after her 18+ check) ----------
// person: their Telegram id (a private chat's id is its person's). → a short word for the log and the tests
const short = (a) => getAddress(a);
async function sayLine(token, chat, line, extra = {}) {
  if (typeof line === 'string') return say(token, chat, line, extra, { timeoutMs: 4000 });
  return say(token, chat, line.text, { ...extra, ...(line.entities?.length ? { entities: line.entities } : {}) }, { timeoutMs: 4000 });
}

// /claim (and "/start claim", from the winner's button): where their prize is, and the next step
export async function claimFlow(cfg, token, person, { env } = {}) {
  let p;
  try { p = await gameDb.pending(cfg, person); } catch (err) {
    if (err.code === 'PGRST202') { await say(token, person, G.CLAIM_NONE); return 'claim_none'; }
    console.error('[games] the prizes are unavailable:', err.message);
    await say(token, person, G.CLAIM_BUSY);
    return 'busy';
  }
  if (!p) { await say(token, person, G.CLAIM_NONE); return 'claim_none'; }
  if (p.state === 'won' || (p.state === 'confirming' && !p.address)) { await say(token, person, G.claimAsk(p.amount)); return 'claim_ask'; }
  if (p.state === 'confirming') {
    await say(token, person, G.claimConfirm(p.amount, short(p.address)), buttons(G.confirmButtons(p.id)));
    return 'claim_confirm';
  }
  if (p.state === 'expired') { await say(token, person, G.CLAIM_EXPIRED); return 'claim_expired'; }
  if (p.state === 'claimed') {
    // being sent right now; or a claim that never got as far as sending (2 minutes ago or more): "send it?" again
    if (new Date(p.claimed).getTime() < Date.now() - 120_000) {
      await say(token, person, G.claimConfirm(p.amount, short(p.address)), buttons(G.confirmButtons(p.id)));
      return 'claim_confirm';
    }
    await say(token, person, G.CLAIM_SENDING);
    return 'claim_sending';
  }
  // sending (or sent): what the chain says about its transaction
  const tx = TXHASH.test(String(p.tx)) ? p.tx : null;
  const state = tx ? await txState(tx, env) : null;
  if (state === 'failed') {
    // its transfer failed: nothing moved, so it can be sent again
    await gameDb.sent(cfg, p.id, tx, false).catch((err) => console.error(`[games] giving a failed prize back failed: ${err.message}`));
    await say(token, person, `${G.CLAIM_FAILED}\n\n${G.claimConfirm(p.amount, short(p.address))}`, buttons(G.confirmButtons(p.id)));
    return 'claim_failed';
  }
  if (p.state === 'sending' && state === 'ok') {
    await gameDb.sent(cfg, p.id, tx, true).catch((err) => console.error(`[games] keeping a sent prize failed: ${err.message}`));
  }
  if (p.state === 'sent' || state === 'ok') { await sayLine(token, person, G.claimAlreadySent(p.amount, tx)); return 'claim_sent'; }
  await sayLine(token, person, G.claimOnItsWay(tx));
  return 'claim_pending';
}

// A message with an address in it, while a prize waits for one → checked, kept, then "send it?" · null (no prize is
// waiting for an address: her chat goes on as usual)
export async function addressFlow(cfg, token, person, raw, { env } = {}) {
  let p;
  try { p = await gameDb.pending(cfg, person); } catch (err) {
    if (err.code !== 'PGRST202') console.error('[games] the prizes are unavailable:', err.message);
    return null;
  }
  if (!p || !['won', 'confirming'].includes(p.state)) return null;
  const checked = await checkAddress(cfg, raw, env);
  if (!checked.ok) { await say(token, person, G.ADDRESS_REFUSE[checked.why]); return `prize_address_${checked.why}`; }
  let kept = false;
  try { kept = (await gameDb.address(cfg, p.id, person, checked.address)) === true; } catch (err) {
    console.error('[games] keeping a prize\'s address failed:', err.message);
    await say(token, person, G.CLAIM_BUSY);
    return 'busy';
  }
  if (!kept) { await say(token, person, G.CLAIM_EXPIRED); return 'claim_expired'; }
  await say(token, person, G.claimConfirm(p.amount, short(checked.address)), buttons(G.confirmButtons(p.id)));
  return 'prize_confirm';
}

// Their tap on "yes, send it" or "change it" (callback data "prize:<id>:send" / "prize:<id>:change") → a short word · null
// (not a prize button)
export async function prizeButton(cfg, token, person, data, { env, deadline = Date.now() + 20_000 } = {}) {
  const m = /^prize:(\d{1,15}):(send|change)$/.exec(String(data ?? ''));
  if (!m) return null;
  const id = Number(m[1]);
  if (m[2] === 'change') { await say(token, person, G.CLAIM_CHANGE); return 'prize_change'; }
  if (!prizesOn(cfg)) { await say(token, person, G.PRIZES_OFF); return 'prizes_off'; }
  let c;
  try { c = await gameDb.claim(cfg, id, person); } catch (err) {
    console.error('[games] claiming a prize failed:', err.message);
    await say(token, person, G.CLAIM_BUSY);
    return 'busy';
  }
  if (c?.ok !== true) {
    const why = String(c?.why || 'unknown');
    if (why === 'won') { await say(token, person, G.CLAIM_CHANGE); return 'prize_need_address'; }
    if (why === 'expired') { await say(token, person, G.CLAIM_EXPIRED); return 'claim_expired'; }
    if (why === 'claimed') { await say(token, person, G.CLAIM_SENDING); return 'claim_sending'; }
    if (why === 'sent') { await sayLine(token, person, G.claimAlreadySent(c.amount ?? '', TXHASH.test(String(c.tx)) ? c.tx : null)); return 'claim_sent'; }
    if (why === 'sending') { await sayLine(token, person, G.claimOnItsWay(TXHASH.test(String(c.tx)) ? c.tx : null)); return 'claim_pending'; }
    await say(token, person, G.CLAIM_NONE);
    return 'claim_none';
  }
  tgCall(token, 'sendChatAction', { chat_id: person, action: 'typing' }).catch(() => {});
  const r = await sendPrize(cfg, { id, address: c.address, amount: c.amount }, env, { deadline });
  if (r.ok) { await sayLine(token, person, G.claimSent(c.amount, r.tx)); return 'prize_sent'; }
  if (r.why === 'empty') { await say(token, person, G.CLAIM_EMPTY); return 'prize_empty'; }
  if (r.why === 'pending') { await sayLine(token, person, G.claimOnItsWay(null)); return 'claim_pending'; }
  if (r.why === 'failed') {
    await say(token, person, `${G.CLAIM_FAILED}\n\n${G.claimConfirm(c.amount, short(c.address))}`, buttons(G.confirmButtons(id)));
    return 'prize_failed';
  }
  await say(token, person, G.CLAIM_BUSY);
  return 'busy';
}

// Right after someone confirms they're 18+: a prize waiting for them? (a winner who came from the group's button) → true
export async function prizeWaiting(cfg, person) {
  try {
    const p = await gameDb.pending(cfg, person);
    return Boolean(p && ['won', 'confirming'].includes(p.state));
  } catch { return false; }
}
