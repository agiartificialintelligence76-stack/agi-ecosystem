// Wallet-Native Stance controller for Clank Tank (agi1.app/clanktrade).
// External & Hardware Wallets FIRST (Ledger, Trezor, Rabby, MetaMask, Frame, Coinbase Wallet) —
// contrasting directly against custodial/embedded-first shifts (Pump.fun Nov 30 positioning gift).
// Also includes a transparent zero-risk Tank Simulator Wallet (25.00 ETH play balance) so visitors can
// test Deal or No Deal commits, capped Shark Follows, and fee routing immediately without risking funds.

const STORAGE_KEY = 'clanktrade:wallet:v2';

export const EXTERNAL_WALLETS = Object.freeze([
  { id: 'rabby', name: 'Rabby Wallet', kind: 'External · Recommended', badge: 'SELF-CUSTODY', hardware: false },
  { id: 'ledger', name: 'Ledger Hardware', kind: 'Cold Hardware Signer', badge: 'HARDWARE FIRST', hardware: true },
  { id: 'trezor', name: 'Trezor Safe', kind: 'Cold Hardware Signer', badge: 'HARDWARE FIRST', hardware: true },
  { id: 'metamask', name: 'MetaMask', kind: 'Browser Extension', badge: 'EVM 4663', hardware: false },
  { id: 'frame', name: 'Frame Native', kind: 'System Hardware Bridge', badge: 'HARDWARE', hardware: true },
  { id: 'phantom', name: 'Phantom EVM', kind: 'Multi-Chain External', badge: 'EXTERNAL', hardware: false },
]);

export function shortAddress(addr) {
  if (!addr || typeof addr !== 'string') return '—';
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function createTankWallet() {
  const listeners = new Set();
  const state = {
    connected: false,
    mode: 'simulator', // 'external' | 'simulator'
    providerName: 'Tank Simulator',
    address: '0x71e29400000000000000000000000000000094a0',
    chainId: 4663,
    isHardware: false,
    isRankedShark: true,
    playBalanceEth: 25.0,
    commits: [],
    trades: [],
  };

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && typeof saved === 'object') {
      if (typeof saved.playBalanceEth === 'number' && Number.isFinite(saved.playBalanceEth)) {
        state.playBalanceEth = Math.max(0, Math.min(1000, saved.playBalanceEth));
      }
      if (typeof saved.connected === 'boolean') state.connected = saved.connected;
      if (typeof saved.providerName === 'string') state.providerName = saved.providerName.slice(0, 40);
      if (typeof saved.address === 'string' && /^0x[0-9a-fA-F]{40}$/.test(saved.address)) state.address = saved.address;
      if (typeof saved.isHardware === 'boolean') state.isHardware = saved.isHardware;
      if (saved.mode === 'external' || saved.mode === 'simulator') state.mode = saved.mode;
    }
  } catch { /* localStorage unavailable */ }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        connected: state.connected,
        mode: state.mode,
        providerName: state.providerName,
        address: state.address,
        isHardware: state.isHardware,
        playBalanceEth: state.playBalanceEth,
      }));
    } catch { /* ignore */ }
  }

  function emit() {
    persist();
    for (const fn of listeners) {
      try { fn(snapshot()); } catch { /* isolate */ }
    }
  }

  function snapshot() {
    return {
      ...state,
      short: shortAddress(state.address),
      hasInjected: typeof window !== 'undefined' && Boolean(window.ethereum),
    };
  }

  async function connectExternal(walletMeta) {
    const label = walletMeta?.name || 'External Wallet';
    const isHardware = Boolean(walletMeta?.hardware);
    if (typeof window !== 'undefined' && window.ethereum && typeof window.ethereum.request === 'function') {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const acc = Array.isArray(accounts) && accounts[0] ? String(accounts[0]) : null;
        if (acc && /^0x[0-9a-fA-F]{40}$/.test(acc)) {
          state.connected = true;
          state.mode = 'external';
          state.providerName = label;
          state.address = acc;
          state.isHardware = isHardware;
          emit();
          return { ok: true, mode: 'external', message: `Connected ${label} (${shortAddress(acc)}) · Signatures only, zero surprise approvals.` };
        }
      } catch (err) {
        return { ok: false, error: err?.message || 'Wallet connection cancelled.' };
      }
    }
    // No browser extension detected — transparently activate self-custody Tank Simulator with chosen hardware/external profile
    const suffix = (walletMeta?.id || 'hw').slice(0, 4).split('').map((c) => c.charCodeAt(0).toString(16).slice(-1)).join('').padEnd(4, 'a');
    state.connected = true;
    state.mode = 'simulator';
    state.providerName = `${label} (Sim)`;
    state.address = `0x71e294000000000000000000000000000000${suffix}`;
    state.isHardware = isHardware;
    emit();
    return {
      ok: true,
      mode: 'simulator',
      message: `${label} not detected in browser — activated interactive Tank Simulator (${state.playBalanceEth.toFixed(2)} play ETH, zero real funds at risk).`,
    };
  }

  function connectSimulator() {
    state.connected = true;
    state.mode = 'simulator';
    state.providerName = 'Tank Simulator';
    state.isHardware = false;
    emit();
    return { ok: true, mode: 'simulator', message: `Tank Simulator ready with ${state.playBalanceEth.toFixed(2)} play ETH.` };
  }

  function disconnect() {
    state.connected = false;
    emit();
  }

  function spendPlayEth(amountEth, meta = {}) {
    const amt = Number(amountEth);
    if (!Number.isFinite(amt) || amt <= 0) return { ok: false, error: 'Invalid ETH amount.' };
    if (!state.connected) connectSimulator();
    if (amt > state.playBalanceEth) return { ok: false, error: `Insufficient play ETH (${state.playBalanceEth.toFixed(2)} ETH available).` };
    state.playBalanceEth = +(state.playBalanceEth - amt).toFixed(4);
    state.trades.unshift({ ...meta, amountEth: amt, at: Date.now() });
    if (state.trades.length > 50) state.trades.length = 50;
    emit();
    return { ok: true, balance: state.playBalanceEth };
  }

  function refundPlayEth(amountEth) {
    const amt = Number(amountEth);
    if (!Number.isFinite(amt) || amt <= 0) return;
    state.playBalanceEth = +(state.playBalanceEth + amt).toFixed(4);
    emit();
  }

  return {
    get: snapshot,
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    connectExternal,
    connectSimulator,
    disconnect,
    spendPlayEth,
    refundPlayEth,
  };
}
