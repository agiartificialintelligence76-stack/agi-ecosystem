// "Launch with AGI-1" (2026-10-01): the ONE place on agi1.app that asks a wallet for a transaction, hard rule 9's launch
// exception. On the launch page only (agi1.app/launch/<id>), and only when the person presses the button:
//   • switching their wallet to Robinhood Chain (wallet_switchEthereumChain; wallet_addEthereumChain if the wallet doesn't
//     know it yet: its official public node and block explorer);
//   • sending ONE call: clank.trade's own factory, launchToken(…), with no ETH. Our server builds it and tries it on the
//     chain first (api/launch.js); this file refuses anything else before the wallet ever sees it: another address,
//     another function, any ETH, another network.
// Never a token approval, a signature on typed data, a buy, or a transfer. tests/wallet.test.js fails the build if any
// other file asks a wallet for a transaction or a network change, and tests/launch.test.js checks this one.

export const ROBINHOOD = {
  chainId: 4663,
  hex: '0x1237',
  add: {
    chainId: '0x1237',
    chainName: 'Robinhood Chain',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://rpc.mainnet.chain.robinhood.com'],
    blockExplorerUrls: ['https://robinhoodchain.blockscout.com'],
  },
};
export const FACTORY = '0x798daaa0707c1e538bb5acf0867ac0e1a84cccf2';   // clank.trade's factory (server/clank-chain.js)
export const LAUNCH_SELECTOR = '0xf35abbcf';                          // launchToken(…) (server/launch.js)
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

// The network the wallet is on (read-only), or null when it won't say
export async function walletChain(provider) {
  try {
    const id = await provider.request({ method: 'eth_chainId' });
    const n = typeof id === 'number' ? id : typeof id === 'string' && /^0x[0-9a-f]+$/i.test(id) ? parseInt(id, 16) : NaN;
    return Number.isSafeInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

// Asks the wallet to switch to Robinhood Chain (and to add it first if it doesn't know it). Throws the wallet's own error
// (a "no" from the person, or a wallet that can't use Robinhood Chain).
export async function switchToRobinhood(provider) {
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: ROBINHOOD.hex }] });
  } catch (err) {
    const unknown = err?.code === 4902 || err?.data?.originalError?.code === 4902 || /unrecognized chain|not been added|unknown chain/i.test(String(err?.message || ''));
    if (!unknown) throw err;
    await provider.request({ method: 'wallet_addEthereumChain', params: [ROBINHOOD.add] });
  }
}

// What the server sent, checked: clank.trade's factory, its launchToken, no ETH, Robinhood Chain. → the transaction for the
// wallet · throws Error('not_a_launch') for anything else
export function launchTx(from, prepared) {
  const to = String(prepared?.to || '').toLowerCase();
  const data = String(prepared?.data || '');
  const value = String(prepared?.value ?? '');
  if (!ADDRESS.test(String(from)) || to !== FACTORY || prepared?.chainId !== ROBINHOOD.chainId
    || !/^0x[0-9a-fA-F]+$/.test(data) || data.length > 20_000 || data.slice(0, 10).toLowerCase() !== LAUNCH_SELECTOR
    || !/^0x0*$/.test(value)) {
    throw new Error('not_a_launch');
  }
  return { from, to: FACTORY, data: data.toLowerCase(), value: '0x0', chainId: ROBINHOOD.hex };
}

// The launch, sent from their wallet (they see it and approve or reject it there). → the transaction's hash (lowercase)
export async function sendLaunch(provider, from, prepared) {
  const tx = launchTx(from, prepared);
  if (await walletChain(provider) !== ROBINHOOD.chainId) throw new Error('wrong_chain');
  const hash = await provider.request({ method: 'eth_sendTransaction', params: [tx] });
  if (typeof hash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error('no_hash');
  return hash.toLowerCase();
}
