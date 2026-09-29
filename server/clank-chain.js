// The Clank protocol on Robinhood Chain (2026-09-29): read-only calls to the contracts behind clank.trade, from their
// docs (developer.clank.trade → Reference → Contracts; the ABIs below are copied from there). Through the same free,
// keyless public node as the wallet levels (server/chain.js, ROBINHOOD_RPC_URL can point elsewhere). Nothing here can sign,
// send or move anything: only eth_call.
// The risk check (server/checker.js) uses it:
//   • to confirm a coin with the protocol itself: its record at the factory (curve, creator, stage) and, for a graduated
//     coin, that its pool is the protocol's (whose liquidity position is locked for good: "no withdrawal, approval,
//     transfer, or arbitrary-call path", the docs say);
//   • as a safety net when clank.trade's own API doesn't answer (a smaller scan straight from the chain).
// Never throws: null when the chain can't say (then the risk check works as before).
import { encodeFunctionData, decodeFunctionResult, parseAbi } from 'viem';
import { rpcUrl } from './chain.js';

// The factory that makes every Clank coin (deployed at block 69,067,760), and the protocol's launch-and-buy forwarder
// (a coin launched through it may name the forwarder as its deployer: then who made it isn't known from the chain)
export const FACTORY = '0x798daaa0707c1e538bb5acf0867ac0e1a84cccf2';
export const FORWARDER = '0xac20d0d5cc0f89ee4f6d5f8e6870a36eaf2e0dd7';
// A coin's curve: 0 trading on its curve · 1 sold out ("Ready") · 2 its coins and ETH taken out for the pool ("Swept") ·
// 3 its Uniswap V4 pool made ("PoolCreated": graduated) · 4 its graduation failed and was rescued by the protocol
export const STAGE = { TRADING: 0, READY: 1, SWEPT: 2, POOL: 3, RESCUED: 4 };

export const FACTORY_ABI = parseAbi([
  'function getLaunchedToken(address launchToken) view returns ((address launchToken,address curve,address deployer,address creatorFeeRecipient,address pairToken,uint256 graduationThreshold,uint24 poolFee,int24 tickSpacing,uint16 creatorTaxBps,bool buybackEnabled,uint8 phase,uint256 sweptPairToken,uint256 sweptLaunchTokens,uint256 sweptAt,bool exists) launched)',
]);
export const CURVE_ABI = parseAbi(['function state() view returns (uint8)', 'function realQuoteReserve() view returns (uint256)']);
export const TOKEN_ABI = parseAbi([
  'function name() view returns (string)', 'function symbol() view returns (string)', 'function totalSupply() view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)', 'function logo() view returns (string)',
]);
const ADDRESS = /^0x[0-9a-f]{40}$/;
const call = (abi, to, functionName, args = []) => ({ abi, to, functionName, data: encodeFunctionData({ abi, functionName, args }) });

// Several eth_calls in one request (a JSON-RPC batch). → each call's decoded answer, or null for the ones that failed
// (a reverted call, a missing function). Throws only when the node itself doesn't answer properly.
async function readAll(calls, env, timeoutMs) {
  const res = await fetch(rpcUrl(env), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(calls.map((c, i) => ({ jsonrpc: '2.0', id: i + 1, method: 'eth_call', params: [{ to: c.to, data: c.data }, 'latest'] }))),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`chain: HTTP ${res.status}`);
  const answer = await res.json();
  if (!Array.isArray(answer)) throw new Error(`chain: ${String(answer?.error?.message || 'no batch answer').slice(0, 120)}`);
  const byId = new Map(answer.map((a) => [Number(a?.id), a]));            // (some nodes send the ids back as strings)
  return calls.map((c, i) => {
    const hex = byId.get(i + 1)?.result;
    if (typeof hex !== 'string' || !/^0x[0-9a-fA-F]+$/.test(hex) || hex === '0x') return null;
    try { return decodeFunctionResult({ abi: c.abi, functionName: c.functionName, data: hex }); } catch { return null; }
  });
}

// A coin, as the Clank protocol sees it. → null (the chain didn't answer) · { exists: false } (not a coin its factory made)
// · { exists: true, curve, deployer, pairToken, state, threshold, reserve (wei, as strings), supply, creatorBalance,
//     curveBalance (smallest units, strings), name, symbol, logo, poolFee, sweptAt (ms or 0) }
export async function readCoinOnChain(address, { env = process.env, timeoutMs = 2500 } = {}) {
  const coin = String(address || '').toLowerCase();
  if (!ADDRESS.test(coin)) return null;
  try {
    const [launch, name, symbol, supply, logo] = await readAll([
      call(FACTORY_ABI, FACTORY, 'getLaunchedToken', [coin]),
      call(TOKEN_ABI, coin, 'name'), call(TOKEN_ABI, coin, 'symbol'), call(TOKEN_ABI, coin, 'totalSupply'), call(TOKEN_ABI, coin, 'logo'),
    ], env, timeoutMs);
    if (!launch || typeof launch !== 'object') return null;
    if (launch.exists !== true || String(launch.launchToken).toLowerCase() !== coin) return { exists: false };
    const curve = String(launch.curve).toLowerCase(), deployer = String(launch.deployer).toLowerCase();
    const [state, reserve, creatorBalance, curveBalance] = await readAll([
      call(CURVE_ABI, curve, 'state'), call(CURVE_ABI, curve, 'realQuoteReserve'),
      call(TOKEN_ABI, coin, 'balanceOf', [deployer]), call(TOKEN_ABI, coin, 'balanceOf', [curve]),
    ], env, timeoutMs);
    const big = (v) => (typeof v === 'bigint' && v >= 0n ? v.toString() : null);
    return {
      exists: true, curve, deployer, pairToken: String(launch.pairToken).toLowerCase(),
      state: Number.isInteger(Number(state)) && state !== null ? Number(state) : null,
      threshold: big(launch.graduationThreshold), reserve: big(reserve),
      supply: big(supply), creatorBalance: big(creatorBalance), curveBalance: big(curveBalance),
      name: typeof name === 'string' ? name : null, symbol: typeof symbol === 'string' ? symbol : null,
      logo: typeof logo === 'string' ? logo : null,
      poolFee: Number(launch.poolFee) || null,
      sweptAt: typeof launch.sweptAt === 'bigint' && launch.sweptAt > 0n && launch.sweptAt < 10n ** 12n ? Number(launch.sweptAt) * 1000 : 0,
    };
  } catch (err) {
    console.warn(`[checker] couldn't read ${coin} from the chain: ${err.message}`);
    return null;
  }
}

// Its share of all its coins held by one balance, in percent (0 when unknown)
export function shareOf(balance, supply) {
  if (!/^\d{1,40}$/.test(String(balance)) || !/^\d{1,40}$/.test(String(supply)) || BigInt(supply) === 0n) return 0;
  return Number((BigInt(balance) * 1_000_000n) / BigInt(supply)) / 10_000;
}
