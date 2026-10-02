// Reads a wallet's $AGI balance on Robinhood Chain. Read-only: it only asks a public node "how much does this
// address hold?" (an eth_call to the token's balanceOf). It can't sign, send or move anything.
import { TOKENS } from '../src/prices/parse.js';
import { levelForBalance } from '../src/lib/levels.js';

export const CHAIN_ID = 4663;                                   // Robinhood Chain mainnet
export const AGI_CONTRACT = TOKENS[0].ca;                        // the one official $AGI contract
// Robinhood's free public node. It's rate-limited; ROBINHOOD_RPC_URL can point to another node (e.g. a free
// Alchemy key) without code changes, if it's ever needed. Ask the owner first.
export const rpcUrl = (env = process.env) => env.ROBINHOOD_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com';

const SELECTOR = { balanceOf: '0x70a08231', decimals: '0x313ce567' };
let decimalsCache = null;

async function call(to, data, env) {
  const res = await fetch(rpcUrl(env), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`chain: HTTP ${res.status}`);
  const answer = await res.json();
  if (answer.error) throw new Error(`chain: ${String(answer.error.message || 'error').slice(0, 120)}`);
  if (typeof answer.result !== 'string' || !/^0x[0-9a-fA-F]*$/.test(answer.result)) throw new Error('chain: unexpected answer');
  return answer.result;
}

export async function agiDecimals(env) {
  if (decimalsCache === null) {
    const d = Number(BigInt(await call(AGI_CONTRACT, SELECTOR.decimals, env)));
    if (!Number.isInteger(d) || d < 0 || d > 36) throw new Error('chain: odd decimals');
    decimalsCache = d;
  }
  return decimalsCache;
}

// → { raw: BigInt (smallest units), decimals }
export async function agiBalance(address, env) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error('chain: bad address');
  const data = SELECTOR.balanceOf + address.slice(2).toLowerCase().padStart(64, '0');
  const [hex, decimals] = await Promise.all([call(AGI_CONTRACT, data, env), agiDecimals(env)]);
  return { raw: hex === '0x' ? 0n : BigInt(hex), decimals };
}

// The wallet's relationship level from its balance. Never throws: if the chain can't be reached, the level stays as
// it was (or Stranger) and { checked: false } tells the caller to try again soon.
// burned (2026-09-30): the whole $AGI this wallet burned for messages (server/burn.js) counts too, so burning for more
// messages never drops a level (and can lift one: 9,000 held + 1,000 burned = Crush)
export async function checkLevel(address, fallbackLevel = 1, env, burned = 0) {
  const h = await checkHolding(address, env, burned);
  return h.checked ? { level: h.level, checked: true } : { level: fallbackLevel, checked: false };
}

// The same read, with the amount too (2026-10-02, "Launch with AGI-1": the coins a wallet may launch a day follow it):
// → { level, agi (whole $AGI held plus burned for messages, rounded down), checked: true } · { checked: false } when the
// chain can't be reached (never throws)
export async function checkHolding(address, env, burned = 0) {
  try {
    const { raw, decimals } = await agiBalance(address, env);
    const unit = 10n ** BigInt(decimals);
    const total = raw + (Number.isSafeInteger(burned) && burned > 0 ? BigInt(burned) * unit : 0n);
    return { level: levelForBalance(total, decimals), agi: Number(total / unit), checked: true };
  } catch (err) {
    console.error('[wallet] balance check failed:', err.message);
    return { level: 1, agi: 0, checked: false };
  }
}

export const _resetChainCache = () => { decimalsCache = null; };   // for tests
