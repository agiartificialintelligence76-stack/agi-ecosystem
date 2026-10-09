// The small wallets our server holds, and Robinhood Chain's node (moved here from server/launch.js on 2026-10-09, so her
// games' prizes can use them without loading everything a launch needs):
//   • LAUNCH_GAS_KEY, the owner's gas wallet: pays each launch's network fee back (server/launch.js, 2026-10-01);
//   • PRIZE_WALLET_KEY, the owner's prize wallet: sends her games' prizes in $AGI (server/game-prizes.js, 2026-10-09).
// Each is a wallet made only for that job, holding only what that job needs (a hack could take at most what's in it).
// chain() asks the node one question; sendPlanned() signs a planned transaction, records it before it goes out (so it's
// never sent twice: whatever happens, a later check can find it on the chain) and sends it.
import { keccak256 } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { rpcUrl, CHAIN_ID } from './chain.js';
import { readLimited } from './coins.js';

// One JSON-RPC question to the chain's public node. → its result · throws "chain:" errors: err.rpc = true when the node
// answered with an error (err.revert = its data for "execution reverted"), err.http = the status when it answered with an
// HTTP error, neither when it didn't answer clearly (no answer, odd answer)
export async function chain(method, params, env, timeoutMs = 6000) {
  let res, data;
  try {
    res = await fetch(rpcUrl(env), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(Math.max(500, timeoutMs)),
    });
  } catch (err) {
    throw new Error(`chain: ${err?.name === 'TimeoutError' || err?.name === 'AbortError' ? 'no answer in time' : 'unreachable'}`);
  }
  if (!res.ok) {
    res.body?.cancel().catch(() => {});
    const err = new Error(`chain: HTTP ${res.status}`);
    err.http = res.status;
    throw err;
  }
  try {
    data = await readLimited(res, 1_000_000);
  } catch (err) {
    throw new Error(`chain: ${err?.name === 'TimeoutError' || err?.name === 'AbortError' ? 'no answer in time' : 'the answer broke off'}`);
  }
  if (!data) throw new Error('chain: answer too big');
  let answer;
  try { answer = JSON.parse(data.toString('utf8')); } catch { throw new Error('chain: answer is not JSON'); }
  if (answer?.error) {
    const err = new Error(`chain: ${String(answer.error.message || 'error').slice(0, 160)}`);
    err.rpc = true;
    const raw = typeof answer.error.data === 'string' ? answer.error.data : answer.error.data?.data;
    if (answer.error.code === 3 || /revert/i.test(String(answer.error.message))) {
      err.revert = typeof raw === 'string' && /^0x[0-9a-fA-F]*$/.test(raw) ? raw.toLowerCase() : '0x';
    }
    throw err;
  }
  if (!answer || typeof answer !== 'object' || !('result' in answer)) throw new Error('chain: unexpected answer');
  return answer.result;
}

export const SEND_MS = 12_000;        // what's needed after a plan: the claim, marking it, the send, once more with the next nonce
export const TXHASH = /^0x[0-9a-f]{64}$/;
// the node's clear "no" to a transaction (nothing went out). Anything else after it was handed over counts as sent.
const REFUSED = /nonce too low|replacement transaction underpriced|transaction underpriced|insufficient funds|intrinsic gas too low|max fee per gas less than block base fee|fee cap less than block base fee|exceeds block gas limit|gas limit reached|invalid sender|exceeds the configured cap|invalid chain id/i;
// its nonce is taken (by another payment, or by one of this payment's own transactions: a node that lost its own answer)
const NONCE_TAKEN = /nonce too low|replacement transaction underpriced/i;

// Signs and sends a planned transaction ({ to, value, nonce, gas, maxFee, data? }) by `deadline` (ms); mark(hash) records
// each transaction before it goes out (anything but true: it isn't sent). → { ok: true, tx } (sent, or handed over without a
// clear "no": never sent again) · { ok: false, why: 'empty' | 'failed' } (the chain clearly refused it: nothing went out) ·
// { ok: false, why: 'unsure' } (whether one went out can't be told: it stays "sending") · { ok: false, why: 'unmarked' }
// (nothing was sent: it couldn't be recorded first)
export async function sendPlanned(key, plan, env, { deadline = Date.now() + SEND_MS, mark = async () => true } = {}) {
  const account = privateKeyToAccount(key);
  let { nonce } = plan;
  const signed = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await account.signTransaction({
      chainId: CHAIN_ID, type: 'eip1559', to: plan.to, value: plan.value, nonce, gas: plan.gas, maxFeePerGas: plan.maxFee, maxPriorityFeePerGas: 0n,
      ...(plan.data ? { data: plan.data } : {}),
    });
    const hash = keccak256(raw);
    let marked = false;
    try { marked = (await mark(hash)) === true; } catch { marked = false; }
    if (!marked) return attempt === 0 ? { ok: false, why: 'unmarked' } : { ok: false, why: 'failed' };
    signed.push(hash);
    try {
      const sent = await chain('eth_sendRawTransaction', [raw], env, Math.max(1000, Math.min(6000, deadline - Date.now() - 1000)));
      return { ok: true, tx: typeof sent === 'string' && /^0x[0-9a-fA-F]{64}$/.test(sent) ? sent.toLowerCase() : hash };
    } catch (err) {
      if (err.rpc && /already known|known transaction/i.test(err.message)) return { ok: true, tx: hash };
      const refused = (err.rpc && REFUSED.test(err.message)) || (err.http >= 400 && err.http < 500);
      // no clear "no" (it may be on its way): counted as sent, never sent again
      if (!refused) return { ok: true, tx: hash };
      if (!NONCE_TAKEN.test(err.message)) return { ok: false, why: /insufficient funds/i.test(err.message) ? 'empty' : 'failed' };
      // its nonce is taken: first ask the chain about every transaction signed for this payment
      let known, next;
      try {
        [known, next] = await Promise.all([
          Promise.all(signed.map((h) => chain('eth_getTransactionByHash', [h], env, 2500))),
          chain('eth_getTransactionCount', [account.address, 'pending'], env, 2500),
        ]);
      } catch {
        return { ok: false, why: 'unsure' };
      }
      const found = signed.find((h, i) => known[i]);
      if (found) return { ok: true, tx: found };
      // none of them went out (their nonce is someone else's now): once more with the next nonce, while there's time
      if (attempt === 0 && deadline - Date.now() > 5000) {
        try { nonce = Number(BigInt(next)); } catch { return { ok: false, why: 'failed' }; }
        if (Number.isSafeInteger(nonce) && nonce >= 0) continue;
      }
      return { ok: false, why: 'failed' };
    }
  }
  return { ok: false, why: 'failed' };
}
