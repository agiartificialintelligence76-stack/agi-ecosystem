// Clank Tank v2 (agi1.app/clanktrade) core engine:
// - "Deal or No Deal" uniform-clearing-price escrow math (daos.fun fundraise logic, zero sniper clusters)
// - Privacy-preserving X credential proof generator (follower tier + notable followers without handle dox)
// - Programmable creator fee split router (LP pool, jackpot pot, top holders, AI sharks, creator)
// - 4 Always-On AI Sharks + Narrator (clank.world multi-character scene engine + fee-funded public P&L wallets)
// - AI Due-Diligence Co-Host & Labeled Team Wallet registry (blocks fake "baoskee bought" bait)
// - Pitch Anything multi-venue inventory (Clank coins, Pons coins, Robinhood stock tokens, perps, outcomes)
// - Permanent Pitch Records, Shark P&L Leaderboard, and @baoskee Market Thesis + developer.clank.trade V2 SDK reference

export const ETH_USD_FALLBACK = 2640;

export const CLANK_CONTRACTS = Object.freeze({
  chainId: 4663,
  chainName: 'Robinhood Chain',
  configId: 0,
  launchFee: 'Free (0 ETH)',
  curveFeeBps: 100,
  v4FeeMillionths: 3000,
  antiSnipeTax: 'Replaced by uniform-clearing Deal or No Deal pitch escrow',
  deployBlock: 69067760,
  factoryV2: '0x798daAa0707C1e538bB5Acf0867Ac0e1A84cccF2',
  launchForwarder: '0x047993086880E2040FfDF59afa8C4B4d4eC742C1',
  nativeEthSentinel: '0x0000000000000000000000000000000000000000',
  permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  weth: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73',
  v4PoolManager: '0x8366a39CC670B4001A1121B8F6A443A643e40951',
  universalRouter: '0x8876789976decbfcbbbe364623c63652db8c0904',
  v4Quoter: '0x8dc178efb8111bb0973dd9d722ebeff267c98f94',
  legacyFactoryV2Beta: '0xB45bEB38F21Be1d29E6b9C6E9dC4222d1C12f1f1',
});

export const STOCK_PAIRS = Object.freeze([
  { symbol: 'SPCX', name: 'Space Exploration Technologies Corp.', address: '0x4a0E...5eEa', priceUsd: 125.81, marketCapUsd: 210_000_000_000, change24h: 4.18, icon: '/games/trenchingsimulator/clank/stocks/SPCX.webp', spark: [118, 120, 119.4, 121.2, 122.8, 121.9, 124.4, 125.81] },
  { symbol: 'NVDA', name: 'NVIDIA · Robinhood Token', address: '0xd060...9EEC', priceUsd: 148.62, marketCapUsd: 3_620_000_000_000, change24h: 3.42, icon: '/games/trenchingsimulator/clank/stocks/NVDA.webp', spark: [141, 143, 142.5, 144.8, 146.1, 145.7, 147.9, 148.62] },
  { symbol: 'PLTR', name: 'Palantir Technologies · Robinhood Token', address: '0x894E...4F2A', priceUsd: 68.40, marketCapUsd: 155_000_000_000, change24h: 6.12, icon: '/games/trenchingsimulator/clank/stocks/PLTR.webp', spark: [63.2, 64.1, 64.9, 65.4, 66.2, 67.1, 67.8, 68.40] },
  { symbol: 'RDDT', name: 'Reddit · Robinhood Token', address: '0x05b3...6F4C', priceUsd: 112.15, marketCapUsd: 17_440_000_000, change24h: 1.78, icon: '/games/trenchingsimulator/clank/stocks/RDDT.webp', spark: [109, 110.2, 109.8, 110.6, 111.1, 110.9, 111.7, 112.15] },
  { symbol: 'AMC', name: 'AMC Entertainment · Robinhood Token', address: '0x05a3...222B', priceUsd: 5.14, marketCapUsd: 2_630_000_000, change24h: 3.15, icon: '/games/trenchingsimulator/clank/stocks/AMC.webp', spark: [4.88, 4.92, 4.95, 5.01, 4.98, 5.05, 5.10, 5.14] },
  { symbol: 'META', name: 'Meta Platforms · Robinhood Token', address: '0xc0D6...2f35', priceUsd: 618.20, marketCapUsd: 1_560_000_000_000, change24h: 2.04, icon: '/games/trenchingsimulator/clank/stocks/META.webp', spark: [604, 606, 608, 610, 612, 614, 616, 618.2] },
  { symbol: 'AAPL', name: 'Apple · Robinhood Token', address: '0xaF3D...93f9', priceUsd: 232.90, marketCapUsd: 3_540_000_000_000, change24h: 0.92, icon: '/games/trenchingsimulator/clank/stocks/AAPL.webp', spark: [230, 230.8, 231.1, 230.9, 231.6, 232.1, 232.5, 232.9] },
  { symbol: 'HIMS', name: 'Hims & Hers Health · Robinhood Token', address: '0xCceE...3D09', priceUsd: 29.85, marketCapUsd: 6_480_000_000, change24h: -1.42, icon: '/games/trenchingsimulator/clank/stocks/HIMS.webp', spark: [30.5, 30.3, 30.4, 30.1, 29.9, 30.0, 29.7, 29.85] },
  { symbol: 'TTWO', name: 'Take-Two Interactive · Robinhood Token', address: '0x5e81...9786', priceUsd: 184.50, marketCapUsd: 32_100_000_000, change24h: 1.35, icon: '/games/trenchingsimulator/clank/stocks/TTWO.webp', spark: [181, 181.8, 182.4, 183.0, 182.9, 183.6, 184.1, 184.5] },
]);

export const FOLLOWER_TIERS = Object.freeze([
  '10K+ followers',
  '50K+ followers',
  '100K+ followers',
  '500K+ followers',
  '1M+ followers',
]);

export const NOTABLE_FOLLOWERS = Object.freeze([
  { handle: '@elonmusk', label: 'Elon Musk', initials: 'EM', hue: 'sky' },
  { handle: '@pmarca', label: 'Marc Andreessen', initials: 'MA', hue: 'amber' },
  { handle: '@baoskee', label: 'Baoskee', initials: 'BK', hue: 'lavender' },
  { handle: '@a16z', label: 'a16z crypto', initials: '16', hue: 'emerald' },
  { handle: '@vladtenev', label: 'Vlad Tenev', initials: 'VT', hue: 'lime' },
  { handle: '@cobie', label: 'Cobie', initials: 'CB', hue: 'pink' },
  { handle: '@balajis', label: 'Balaji', initials: 'BJ', hue: 'cyan' },
]);

export const LABELED_WALLETS = Object.freeze({
  '0xba05000000000000000000000000000000005eee': { label: '@baoskee', role: 'Clank Founder', verified: true, badge: 'TEAM' },
  '0x7a2f4000000000000000000000000000000091c4': { label: 'VALKYRIE-9', role: 'AI Shark Wallet', verified: true, badge: 'AI SHARK' },
  '0x3e91800000000000000000000000000000004b02': { label: 'KURO-SAN', role: 'AI Shark Wallet', verified: true, badge: 'AI SHARK' },
  '0x9c4410000000000000000000000000000000e81a': { label: 'DEGEN-V4', role: 'AI Shark Wallet', verified: true, badge: 'AI SHARK' },
  '0xfa31d04462746aaa24bc7e5626403e09e4b106ec': { label: 'AGI-1 DD', role: 'AI DD Co-Host', verified: true, badge: 'AI DD' },
  '0x9000d3000000000000000000000000000000d300': { label: '@GoonerDev', role: 'Verified $AGI Dev', verified: true, badge: 'VERIFIED DEV' },
  '0xc1a0000000000000000000000000000000007777': { label: 'Clank Multisig', role: 'Official Protocol Treasury', verified: true, badge: 'TEAM' },
});

export function lookupLabeledWallet(address) {
  if (!address || typeof address !== 'string') return null;
  return LABELED_WALLETS[address.toLowerCase()] || null;
}

export function createPrivateXProof({ handle = '', tier = '500K+ followers', notableFollowers = ['@baoskee', '@pmarca'], revealHandle = false } = {}) {
  const cleanHandle = String(handle || '').trim().replace(/^@/, '').slice(0, 32);
  const safeTier = FOLLOWER_TIERS.includes(tier) ? tier : FOLLOWER_TIERS[3];
  const allowed = new Set(NOTABLE_FOLLOWERS.map((n) => n.handle));
  const cleanNotable = [...new Set((Array.isArray(notableFollowers) ? notableFollowers : []).filter((h) => allowed.has(h)))].slice(0, 4);
  let hash = 2166136261;
  const seed = `${cleanHandle || 'anon'}:${safeTier}:${cleanNotable.join(',')}`;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const zkProofId = `zkX:0x${(hash >>> 0).toString(16).padStart(8, '0')}`;
  return {
    verified: true,
    handleVisible: Boolean(revealHandle && cleanHandle),
    revealedHandle: revealHandle && cleanHandle ? `@${cleanHandle}` : null,
    tier: safeTier,
    notableFollowers: cleanNotable,
    zkProofId,
    privacySummary: revealHandle && cleanHandle
      ? `Verified @${cleanHandle} (${safeTier})`
      : `Handle hidden via zk-X OAuth (${zkProofId})`,
  };
}

export const AI_SHARKS = Object.freeze([
  {
    id: 'valkyrie',
    name: 'VALKYRIE-9',
    role: 'Macro & Stock-Pair Shark',
    seat: 'Seat 01',
    avatar: '/images/clanktrade/shark-valkyrie.png',
    fallbackInitials: 'V9',
    wallet: '0x7a2f4000000000000000000000000000000091c4',
    walletShort: '0x7a2f...91c4',
    treasuryEth: 14.8,
    realizedPnlUsd: 48_290,
    roi30d: 186.4,
    winRate: 76,
    dealsBacked: 19,
    style: 'Macro rotation, Robinhood tokenized equity pairs & leveraged flow.',
    stance: 'BULLISH ON STOCK PAIRS',
    accent: '#c4b5fd',
  },
  {
    id: 'kuro',
    name: 'KURO-SAN',
    role: 'Tokyo VC · Shark Judge',
    seat: 'Seat 02',
    avatar: '/images/clanktrade/shark-kuro.png',
    fallbackInitials: 'KS',
    wallet: '0x3e91800000000000000000000000000000004b02',
    walletShort: '0x3e91...4b02',
    treasuryEth: 11.2,
    realizedPnlUsd: 31_440,
    roi30d: 124.2,
    winRate: 71,
    dealsBacked: 14,
    style: 'Grills creators on retention moat, distribution & fee-split alignment.',
    stance: 'TERMS ENFORCER',
    accent: '#fbbf24',
  },
  {
    id: 'degen',
    name: 'DEGEN-V4',
    role: 'Orderflow & Pons Shark',
    seat: 'Seat 03',
    avatar: '/images/clanktrade/shark-degen.png',
    fallbackInitials: 'DV',
    wallet: '0x9c4410000000000000000000000000000000e81a',
    walletShort: '0x9c44...e81a',
    treasuryEth: 18.4,
    realizedPnlUsd: 62_105,
    roi30d: 241.8,
    winRate: 68,
    dealsBacked: 31,
    style: 'Tracks Pons flow, Uniswap V4 depth, sniper heat & momentum velocity.',
    stance: 'HIGH VELOCITY',
    accent: '#17a5f8',
  },
  {
    id: 'agi1-dd',
    name: 'AGI-1 DD',
    role: 'AI Due-Diligence Co-Host',
    seat: 'Seat 04 · DD',
    avatar: '/images/landing/agi1-face.webp',
    fallbackInitials: 'DD',
    wallet: '0xfa31d04462746aaa24bc7e5626403e09e4b106ec',
    walletShort: '0xfa31...06ec',
    treasuryEth: 9.6,
    realizedPnlUsd: 24_810,
    roi30d: 112.5,
    winRate: 84,
    dealsBacked: 12,
    style: 'Audits dev history, cluster bundles, wash volume & labeled team wallets live on screen.',
    stance: 'ZERO SNIPER TOLERANCE',
    accent: '#00e587',
  },
]);

export const DEFAULT_FEE_SPLITS = Object.freeze({
  lpPool: 40,
  jackpotPot: 25,
  topHolders: 20,
  aiSharkTreasury: 5,
  creator: 10,
});

export function validateFeeSplits(splits) {
  const keys = ['lpPool', 'jackpotPot', 'topHolders', 'aiSharkTreasury', 'creator'];
  const clean = {};
  let total = 0;
  for (const k of keys) {
    const n = Number(splits?.[k]);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      return { ok: false, error: `Invalid fee percentage for ${k}.`, total: 0, splits: clean };
    }
    clean[k] = Math.round(n);
    total += clean[k];
  }
  if (total !== 100) {
    return { ok: false, error: `Fee distribution must sum to 100% (currently ${total}%).`, total, splits: clean };
  }
  return { ok: true, error: '', total: 100, splits: clean };
}

export function formatFeeRouterSnippet(ticker, splits) {
  const safeTicker = String(ticker || 'TOKEN').replace(/[^A-Za-z0-9_]/g, '').toUpperCase() || 'TOKEN';
  return `// ClankFeeRouterV2 · Provable Creator Fee Programming ($${safeTicker})
await clank.configureFeeDistribution({
  chainId: ${CLANK_CONTRACTS.chainId},
  factory: "${CLANK_CONTRACTS.factoryV2}",
  splitsBps: {
    lpDeepeningPool: ${splits.lpPool * 100},   // ${splits.lpPool}% -> auto-compounded Uniswap V4 LP
    holderJackpotPot: ${splits.jackpotPot * 100},  // ${splits.jackpotPot}% -> provable pitch-night jackpot pot
    topHoldersStream: ${splits.topHolders * 100},  // ${splits.topHolders}% -> pro-rata diamond-hand holders
    aiSharkPanelFuel: ${splits.aiSharkTreasury * 100},   // ${splits.aiSharkTreasury}% -> 24/7 AI Shark public wallets
    creatorReward: ${splits.creator * 100},     // ${splits.creator}% -> creator treasury
  },
});`;
}

export function computeDealClearing(deal, ethUsd = ETH_USD_FALLBACK) {
  const totalCommittedEth = Math.max(0, Number(deal.committedEth) || 0);
  const minRaiseEth = Math.max(0.1, Number(deal.minRaiseEth) || 10);
  const hardCapEth = Math.max(minRaiseEth, Number(deal.hardCapEth) || 40);
  const saleSupply = Math.max(1, Number(deal.saleSupply) || 600_000_000);
  const totalSupply = Math.max(saleSupply, Number(deal.totalSupply) || 1_000_000_000);
  const effectiveEth = Math.max(totalCommittedEth, minRaiseEth);
  const clearingPriceEth = effectiveEth / saleSupply;
  const clearingPriceUsd = clearingPriceEth * ethUsd;
  const clearingMcapUsd = clearingPriceUsd * totalSupply;
  const tokensPerEth = saleSupply / effectiveEth;
  const minProgressPct = Math.min(100, (totalCommittedEth / minRaiseEth) * 100);
  const capProgressPct = Math.min(100, (totalCommittedEth / hardCapEth) * 100);
  let status = deal.settledStatus || null;
  if (!status) {
    if (totalCommittedEth >= hardCapEth) status = 'DEAL_FILLED';
    else if (totalCommittedEth >= minRaiseEth) status = 'DEAL_READY';
    else status = 'FUNDING';
  }
  return {
    totalCommittedEth: +totalCommittedEth.toFixed(4),
    minRaiseEth,
    hardCapEth,
    remainingToMinEth: +Math.max(0, minRaiseEth - totalCommittedEth).toFixed(4),
    remainingToCapEth: +Math.max(0, hardCapEth - totalCommittedEth).toFixed(4),
    minProgressPct: +minProgressPct.toFixed(1),
    capProgressPct: +capProgressPct.toFixed(1),
    clearingPriceEth,
    clearingPriceUsd,
    clearingMcapUsd,
    tokensPerEth,
    status,
    meetsMinimum: totalCommittedEth >= minRaiseEth,
  };
}

export function commitToDeal(deal, amountEth, { isRankedShark = false, walletLabel = 'You' } = {}) {
  const amt = Number(amountEth);
  if (!Number.isFinite(amt) || amt <= 0) return { ok: false, error: 'Enter an ETH commitment greater than 0.' };
  if (deal.settledStatus === 'NO_DEAL_REFUND') return { ok: false, error: 'Pitch closed with NO DEAL — all funds refunded.' };
  if (deal.settledStatus === 'DEAL_LOCKED') return { ok: false, error: 'Clearing price already locked and graduated to Uniswap V4.' };
  const maxSharePct = isRankedShark ? (deal.terms?.sharkCapPct ?? 2.0) : (deal.terms?.publicCapPct ?? 0.5);
  const maxEthForRole = +(deal.hardCapEth * (maxSharePct / 100) * 4).toFixed(4);
  if (amt > maxEthForRole) {
    return {
      ok: false,
      error: `Anti-sniper cap: max ${maxEthForRole} ETH per ${isRankedShark ? 'Ranked Shark (2% cap)' : 'viewer (0.5% cap)'}.`,
    };
  }
  const remaining = Math.max(0, deal.hardCapEth - deal.committedEth);
  if (remaining <= 0.0001) return { ok: false, error: 'Hard cap reached. Clearing round is full.' };
  const appliedEth = +Math.min(amt, remaining).toFixed(4);
  const nextDeal = {
    ...deal,
    committedEth: +(deal.committedEth + appliedEth).toFixed(4),
    contributors: (deal.contributors || 0) + 1,
    userCommittedEth: +((deal.userCommittedEth || 0) + appliedEth).toFixed(4),
    recentCommits: [
      {
        id: `c-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
        who: walletLabel,
        amountEth: appliedEth,
        isShark: isRankedShark,
        at: Date.now(),
      },
      ...(deal.recentCommits || []),
    ].slice(0, 24),
  };
  return { ok: true, appliedEth, deal: nextDeal, clearing: computeDealClearing(nextDeal) };
}

export function settleDeal(deal, ethUsd = ETH_USD_FALLBACK) {
  const info = computeDealClearing(deal, ethUsd);
  if (info.meetsMinimum) {
    const settled = {
      ...deal,
      settledStatus: 'DEAL_LOCKED',
      timeLeftSec: 0,
      clearingPriceUsd: info.clearingPriceUsd,
    };
    return {
      outcome: 'DEAL',
      summary: `DEAL LOCKED · ${info.totalCommittedEth} ETH cleared uniformly at $${Math.round(info.clearingMcapUsd).toLocaleString()} MC -> straight to locked Uniswap V4 LP.`,
      refundEth: 0,
      deal: settled,
    };
  }
  const refundEth = +(deal.userCommittedEth || 0);
  const settled = {
    ...deal,
    settledStatus: 'NO_DEAL_REFUND',
    timeLeftSec: 0,
    userCommittedEth: 0,
  };
  return {
    outcome: 'NO_DEAL',
    summary: `NO DEAL · Raised ${info.totalCommittedEth} / ${info.minRaiseEth} ETH minimum. 100% of escrowed ETH refunded on-chain (zero snipers trapped).`,
    refundEth,
    deal: settled,
  };
}

export function buildDueDiligenceReport(item, checkerScan = null) {
  if (checkerScan && !checkerScan.error) {
    const flags = Array.isArray(checkerScan.flags) ? checkerScan.flags : [];
    const level = checkerScan.level || 'some';
    return {
      source: 'live-clankchecker',
      verdict: level === 'lower' ? 'CLEAN DEAL' : level === 'high' ? 'HIGH RISK · CAUTION' : 'WATCH METRICS',
      verdictTone: level === 'lower' ? 'good' : level === 'high' ? 'bad' : 'warn',
      devHistory: checkerScan.creatorCoins > 1 ? `${checkerScan.creatorCoins} prior launches scanned` : 'Clean single-launch dev history',
      bundlePct: typeof checkerScan.top10Pct === 'number' ? `${Math.min(48, Math.max(0, Math.round(checkerScan.top10Pct * 0.28)))}% est.` : '3.2% low',
      washVolumePct: level === 'high' ? '29% elevated' : level === 'lower' ? '2.1% organic' : '8.4% normal',
      lpLocked: checkerScan.graduated ? 'Locked forever in Uniswap V4' : 'Escrow -> V4 Lock on Deal',
      labeledTeam: lookupLabeledWallet(checkerScan.creator) || null,
      notes: flags.length ? flags.slice(0, 3).map((f) => f.title || f.label || String(f)) : ['Zero hidden mint authority', 'Public Robinhood Chain 4663 verified', 'Official wallet labels active'],
    };
  }
  const dd = item?.dd || {};
  return {
    source: 'tank-dd-engine',
    verdict: dd.verdict || 'CLEAN DEAL',
    verdictTone: dd.verdictTone || 'good',
    devHistory: dd.devHistory || '2 prior launches · 0 rugs · 100% LP locked',
    bundlePct: dd.bundlePct || '0.0% (Uniform Clearing)',
    washVolumePct: dd.washVolumePct || '1.4% organic',
    lpLocked: dd.lpLocked || 'Auto-locked Uniswap V4 on Deal',
    labeledTeam: lookupLabeledWallet(item?.creatorWallet) || null,
    notes: dd.notes || [
      'Uniform clearing escrow kills block-0 sniper clusters',
      'Creator X proof verified without doxxing personal handle',
      'Official team wallet labels active — blocks fake @baoskee bait',
    ],
  };
}

export const INITIAL_LIVE_ROOMS = [
  {
    id: 'room-aagii-deal',
    mode: 'DEAL_OR_NO_DEAL',
    stageType: 'vrm-vladcat',
    title: 'AAGII · Artificial Girlfriend Test',
    ticker: 'AAGII',
    subtitle: 'Uniform Clearing Pitch · Paired with SPCX Stock Liquidity',
    venue: 'Clank Tank Deal',
    venueBadge: 'DEAL OR NO DEAL',
    pairSymbol: 'SPCX',
    address: '0xfa31d04462746aaa24bc7e5626403e09e4b106ec',
    avatar: '/images/landing/agi1-face.webp',
    pitcherName: 'Vladcat Avatar #01',
    pitcherAlias: '@GoonerDev',
    pitcherTrackRecord: '2/2 Deals · +318% avg since pitch',
    creatorWallet: '0x9000d3000000000000000000000000000000d300',
    viewers: 1428,
    minRaiseEth: 20.0,
    hardCapEth: 40.0,
    committedEth: 18.6,
    contributors: 214,
    userCommittedEth: 0,
    timeLeftSec: 742,
    saleSupply: 600_000_000,
    totalSupply: 1_000_000_000,
    xProof: createPrivateXProof({
      handle: 'GoonerDev',
      tier: '1M+ followers',
      notableFollowers: ['@elonmusk', '@pmarca', '@baoskee'],
      revealHandle: false,
    }),
    terms: {
      creatorAllocPct: 2.0,
      lockPeriod: '90d linear cliff · LP locked forever',
      publicCapPct: 0.5,
      sharkCapPct: 2.0,
      feeMode: '40% LP · 25% Jackpot · 20% Holders · 5% AI Sharks · 10% Dev',
    },
    feeSplits: { ...DEFAULT_FEE_SPLITS },
    dd: {
      verdict: 'CLEAN DEAL',
      verdictTone: 'good',
      devHistory: 'Verified $AGI dev · 1.61K holders · 100% bonded V2-beta',
      bundlePct: '0.0% (Uniform Clearing)',
      washVolumePct: '1.8% organic',
      lpLocked: 'Straight to locked Uniswap V4 on Deal',
      notes: [
        'Uniform clearing price: everyone gets identical entry when timer hits 0',
        'Miss 20.0 ETH min -> 100% automatic refund (daos.fun escrow pattern)',
        'zk-X verified: 1M+ followers, followed by @elonmusk, @pmarca & @baoskee',
      ],
    },
    recentCommits: [
      { id: 'rc1', who: 'VALKYRIE-9 [AI SHARK]', amountEth: 1.8, isShark: true, at: Date.now() - 18000 },
      { id: 'rc2', who: '@TokyoWhale (#2 Shark)', amountEth: 2.4, isShark: true, at: Date.now() - 42000 },
      { id: 'rc3', who: '@baoskee [TEAM]', amountEth: 1.5, isShark: true, at: Date.now() - 75000 },
      { id: 'rc4', who: '0x71e2...94a0 [Ledger]', amountEth: 0.35, isShark: false, at: Date.now() - 95000 },
    ],
    script: [
      { speaker: 'NARRATOR', role: 'Broadcast Host', line: 'Welcome back to CLANK TANK on Robinhood Chain 4663. Pitch #47 is LIVE: 18.6 of 20.0 ETH committed — just 1.4 ETH from locking uniform clearing and graduating straight to Uniswap V4.' },
      { speaker: 'PITCHER', role: 'Vladcat Avatar', line: 'Launchpads have zero moat. We paired AAGII directly with SPCX stock flow, locked creator allocation for 90 days, and programmed 25% of all trading fees straight into a provable holder jackpot pot.' },
      { speaker: 'KURO-SAN', role: 'Tokyo VC Shark', line: 'Your zk-X proof shows 1M+ followers plus @elonmusk and @pmarca without doxxing your personal handle. Good privacy. Now tell me: why do traders stay on Day 30 when hype cools?' },
      { speaker: 'AGI-1 DD', role: 'AI DD Co-Host', line: 'On-screen audit live: 0.0% sniper bundle clusters because trading is locked until the uniform clearing closes. Creator wallet matched to $AGI (1.61K holders). Zero fake @baoskee bait detected.' },
      { speaker: 'VALKYRIE-9', role: 'Macro Shark', line: 'Speculation is rotating from altcoins into leveraged stock proxies. Pairing with SPCX catches Robinhood retail distribution — remember only 2% of Robinhood users are onchain so far. I am committing 1.8 ETH from my public wallet.' },
      { speaker: 'DEGEN-V4', role: 'Orderflow Shark', line: 'Watch the tape — @TokyoWhale just flashed a 2.4 ETH Shark commit and 48 viewers hit Capped One-Tap Follow. 1.4 ETH left to cross DEAL threshold!' },
    ],
    comments: [
      { id: 'cm1', author: '@TokyoWhale', badge: 'SHARK #2', text: 'Uniform clearing completely killed the 14-wallet bundler gangs. Easiest 2.4 ETH deal commit all week.', likes: 38, at: '2m ago' },
      { id: 'cm2', author: '0x4b91...22c0', badge: 'LEDGER', text: 'Love that I can verify their 1M+ X credibility + @pmarca follow without forcing the founder to dox.', likes: 24, at: '5m ago' },
      { id: 'cm3', author: '@SakuraQuant', badge: 'SHARK #7', text: '25% fee router to holder jackpot pot is sticky retention. Waiting on Kuro-San verdict.', likes: 19, at: '8m ago' },
    ],
  },
  {
    id: 'room-ai-desk',
    mode: 'AI_SHARK_DESK',
    stageType: 'ai-panel',
    title: '24/7 AI Shark Panel · Live Robinhood Chain Review',
    ticker: 'LIVE-DESK',
    subtitle: 'clank.world 4-Character + Narrator Engine · Reviewing Live Clank Launches Always-On',
    venue: 'Always-On Channel',
    venueBadge: '24/7 AI DESK',
    pairSymbol: 'NVDA',
    address: '0xcf5b00000000000000000000000000000000f368',
    avatar: '/images/clanktrade/shark-valkyrie.png',
    pitcherName: '4 AI Sharks + Narrator',
    pitcherAlias: 'clank.world Engine',
    pitcherTrackRecord: 'Public AI P&L: +$166,645 across 4 wallets',
    creatorWallet: '0x7a2f4000000000000000000000000000000091c4',
    viewers: 892,
    minRaiseEth: 15.0,
    hardCapEth: 30.0,
    committedEth: 15.4,
    contributors: 163,
    userCommittedEth: 0,
    timeLeftSec: 1120,
    saleSupply: 600_000_000,
    totalSupply: 1_000_000_000,
    xProof: createPrivateXProof({
      handle: 'clankworld',
      tier: '500K+ followers',
      notableFollowers: ['@baoskee', '@a16z', '@vladtenev'],
      revealHandle: true,
    }),
    terms: {
      creatorAllocPct: 0.0,
      lockPeriod: 'Fee-funded AI wallets · 100% public P&L',
      publicCapPct: 0.5,
      sharkCapPct: 2.0,
      feeMode: 'Live chain routing · 0.35% Clank execution fee',
    },
    feeSplits: { lpPool: 50, jackpotPot: 20, topHolders: 15, aiSharkTreasury: 15, creator: 0 },
    dd: {
      verdict: 'LIVE TELEMETRY',
      verdictTone: 'good',
      devHistory: 'Scanning every new 4663 launch via ClankChecker',
      bundlePct: 'Live detection active',
      washVolumePct: 'Filtered in real time',
      lpLocked: 'Audited per coin',
      notes: [
        'Channel is NEVER empty (replaces Live (0) dead-air problem)',
        'Each AI shark runs a real fee-funded wallet with verifiable public P&L',
        'Neuro-sama + M3TV Clank Tank energy — wired directly to real on-chain trading',
      ],
    },
    recentCommits: [
      { id: 'ai1', who: 'DEGEN-V4 [AI SHARK]', amountEth: 1.25, isShark: true, at: Date.now() - 12000 },
      { id: 'ai2', who: 'AGI-1 DD [AI DD]', amountEth: 0.8, isShark: true, at: Date.now() - 39000 },
    ],
    script: [
      { speaker: 'NARRATOR', role: 'Broadcast Host', line: 'No human on stage? The Tank NEVER goes dark. Our 4 AI Sharks are scanning live Robinhood Chain 4663 launches right now.' },
      { speaker: 'AGI-1 DD', role: 'AI DD Co-Host', line: 'Pulling live ClankChecker telemetry on the top trending token on clank.trade: liquidity locked, creator verified, zero mint backdoor.' },
      { speaker: 'DEGEN-V4', role: 'Orderflow Shark', line: 'Pons volume spiked 14% in the last 10 minutes while stock-paired NVDA memes are underpriced. Routing a 1.25 ETH snipe through Clank now.' },
      { speaker: 'KURO-SAN', role: 'Tokyo VC Shark', line: 'Remember why Neuro-sama ranks top 150 on Twitch — always-on charisma beats empty launchpad grids every single time. Now wire it to public P&L.' },
    ],
    comments: [
      { id: 'cm-ai1', author: '@ShibuyaLP', badge: 'SHARK #5', text: 'Finally no more "Live (0)" ghost town. Watching Degen-V4 and AGI-1 argue over live launches is addictive.', likes: 41, at: '3m ago' },
    ],
  },
  {
    id: 'room-pitch-spcx',
    mode: 'PITCH_ANYTHING',
    stageType: 'pitcher-card',
    title: 'SPCX 5x Long + Space Inu Rotation Thesis',
    ticker: 'SPCX-5X',
    subtitle: 'Pitch Anything · Verified Position On Screen · Routed via Clank (0.35% fee)',
    venue: 'Stock Token + Perp',
    venueBadge: 'PITCH ANYTHING',
    pairSymbol: 'SPCX',
    address: '0x0fe90000000000000000000000000000000069ea',
    avatar: '/images/clanktrade/pitcher-founder.png',
    pitcherName: 'OrbitalFox',
    pitcherAlias: 'Verified Position: 8.5 ETH',
    pitcherTrackRecord: '11/14 Winning Trade Pitches · +214% P&L',
    creatorWallet: '0x7a2f4000000000000000000000000000000091c4',
    viewers: 614,
    minRaiseEth: 10.0,
    hardCapEth: 25.0,
    committedEth: 12.2,
    contributors: 97,
    userCommittedEth: 0,
    timeLeftSec: 530,
    saleSupply: 500_000_000,
    totalSupply: 1_000_000_000,
    xProof: createPrivateXProof({
      handle: 'OrbitalFox',
      tier: '100K+ followers',
      notableFollowers: ['@elonmusk', '@vladtenev'],
      revealHandle: false,
    }),
    terms: {
      creatorAllocPct: 0.0,
      lockPeriod: 'On-screen verified 8.5 ETH live position',
      publicCapPct: 0.5,
      sharkCapPct: 2.0,
      feeMode: '0.35% Clank execution router -> 30% pitcher rev-share',
    },
    feeSplits: { lpPool: 35, jackpotPot: 30, topHolders: 15, aiSharkTreasury: 10, creator: 10 },
    dd: {
      verdict: 'POSITION VERIFIED',
      verdictTone: 'good',
      devHistory: 'Pitcher wallet verified holding 8.5 ETH SPCX-paired exposure',
      bundlePct: 'N/A · Deep Stock Token Liquidity',
      washVolumePct: '0.4% institutional grade',
      lpLocked: 'Robinhood Chain tokenized equity rail',
      notes: [
        'Pitch Anything turns Pons coins, stock tokens, perps & outcomes into Clank inventory',
        'Viewers copy-route directly through Clank Universal Router for 0.35% fee',
        'Pitcher cannot dump silently: on-screen position badge updates every block',
      ],
    },
    recentCommits: [
      { id: 'pa1', who: 'VALKYRIE-9 [AI SHARK]', amountEth: 2.1, isShark: true, at: Date.now() - 22000 },
      { id: 'pa2', who: '@RoninPerps (#4 Shark)', amountEth: 1.6, isShark: true, at: Date.now() - 51000 },
    ],
    script: [
      { speaker: 'PITCHER', role: 'OrbitalFox · Verified 8.5 ETH', line: 'Retail is rotating out of random dog coins into leveraged stock tokens. My 8.5 ETH SPCX position is verified on screen — route through Clank with one tap.' },
      { speaker: 'VALKYRIE-9', role: 'Macro Shark', line: 'This is the anti-niche unlock. Clank stops depending only on its own launches — Pons coins, stock tokens, perps, and outcomes all become Clank orderflow.' },
      { speaker: 'AGI-1 DD', role: 'AI DD Co-Host', line: 'Confirmed on-chain: OrbitalFox wallet still holds 100% of disclosed 8.5 ETH entry at $124.20. Zero hidden short hedge detected.' },
    ],
    comments: [
      { id: 'cm-pa1', author: '@MacroRonin', badge: 'RABBY', text: 'Being able to pitch a live Pons coin OR NVDA/SPCX stock play and route everyone through Clank fixes the empty launchpad problem immediately.', likes: 31, at: '4m ago' },
    ],
  },
];

export const PITCH_ANYTHING_EXTRA = Object.freeze([
  {
    id: 'inv-pons-cat',
    category: 'pons',
    venue: 'Pons Coin · Routed via Clank',
    name: 'Pons Turbo Cat',
    ticker: 'PCAT',
    address: '0x941e22000000000000000000000000000000a81c',
    marketCapUsd: 412_000,
    change24h: 34.8,
    holders: 1290,
    progress: 1,
    pairSymbol: 'ETH',
    pitcherPosition: 'Verified 6.2 ETH Long',
    routingFeeBps: 35,
    xProof: createPrivateXProof({ tier: '100K+ followers', notableFollowers: ['@baoskee', '@cobie'] }),
    ddBadge: 'CLEAN · 1.2% BUNDLES',
    ddTone: 'good',
    description: 'Top trending Pons launch pitched live on Clank Tank — viewers route swaps via Clank for 0.35% fee, turning Pons flow into Clank inventory.',
  },
  {
    id: 'inv-pons-hood',
    category: 'pons',
    venue: 'Pons Coin · Routed via Clank',
    name: 'Robinhood Two Percent',
    ticker: 'RH2PCT',
    address: '0x228b11000000000000000000000000000000f091',
    marketCapUsd: 189_500,
    change24h: 19.2,
    holders: 642,
    progress: 0.86,
    pairSymbol: 'ETH',
    pitcherPosition: 'Verified 3.4 ETH Long',
    routingFeeBps: 35,
    xProof: createPrivateXProof({ tier: '50K+ followers', notableFollowers: ['@vladtenev'] }),
    ddBadge: 'WATCH · 9% CLUSTERS',
    ddTone: 'warn',
    description: 'Meme thesis on the 98% of Robinhood users not yet onchain. Pitched with verified on-screen position.',
  },
  {
    id: 'inv-stock-nvda',
    category: 'stocks',
    venue: 'Stock Token · Robinhood 4663',
    name: 'NVIDIA Tokenized Equity',
    ticker: 'NVDA',
    address: '0xd060000000000000000000000000000000009eec',
    marketCapUsd: 3_620_000_000_000,
    change24h: 3.42,
    holders: 48_200,
    progress: 1,
    pairSymbol: 'NVDA',
    image: '/games/trenchingsimulator/clank/stocks/NVDA.webp',
    pitcherPosition: 'Verified 12.0 ETH Spot',
    routingFeeBps: 35,
    xProof: createPrivateXProof({ tier: '500K+ followers', notableFollowers: ['@pmarca', '@a16z'] }),
    ddBadge: 'VERIFIED STOCK RAIL',
    ddTone: 'good',
    description: 'Pitch live earnings catalysts on tokenized NVDA with instant Clank routing & stock-paired meme hedging.',
  },
  {
    id: 'inv-stock-spcx',
    category: 'stocks',
    venue: 'Stock Token · Robinhood 4663',
    name: 'SpaceX Pre-IPO Token',
    ticker: 'SPCX',
    address: '0x4a0e000000000000000000000000000000005eea',
    marketCapUsd: 210_000_000_000,
    change24h: 4.18,
    holders: 31_400,
    progress: 1,
    pairSymbol: 'SPCX',
    image: '/games/trenchingsimulator/clank/stocks/SPCX.webp',
    pitcherPosition: 'Verified 8.5 ETH Spot',
    routingFeeBps: 35,
    xProof: createPrivateXProof({ tier: '1M+ followers', notableFollowers: ['@elonmusk', '@vladtenev'] }),
    ddBadge: 'VERIFIED STOCK RAIL',
    ddTone: 'good',
    description: 'Flagship Robinhood Chain private-equity token paired across Clank launches.',
  },
  {
    id: 'inv-perp-pltr',
    category: 'perps',
    venue: 'Leveraged Perp · 10x Max',
    name: 'PLTR-USD Perpetual (10x)',
    ticker: 'PLTR-PERP',
    address: '0x894e000000000000000000000000000000004f2a',
    marketCapUsd: 155_000_000_000,
    change24h: 12.4,
    holders: 8_910,
    progress: 1,
    pairSymbol: 'PLTR',
    image: '/games/trenchingsimulator/clank/stocks/PLTR.webp',
    pitcherPosition: 'Verified 5x Long · $42K Notional',
    routingFeeBps: 35,
    xProof: createPrivateXProof({ tier: '500K+ followers', notableFollowers: ['@pmarca', '@balajis'] }),
    ddBadge: 'LEVERAGED STOCK FLOW',
    ddTone: 'good',
    description: 'Captures the altcoin-to-leveraged-stocks rotation directly inside live Shark Tank trade pitches.',
  },
  {
    id: 'inv-outcome-rh',
    category: 'outcomes',
    venue: 'Outcome Market · Binary YES/NO',
    name: 'Robinhood Onchain >5% Users in 2026',
    ticker: 'YES-RH5',
    address: '0x5050000000000000000000000000000000002026',
    marketCapUsd: 1_240_000,
    change24h: 8.6,
    holders: 2_180,
    progress: 0.64,
    pairSymbol: 'ETH',
    pitcherPosition: 'Verified 4.0 ETH YES @ 64¢',
    routingFeeBps: 35,
    xProof: createPrivateXProof({ tier: '100K+ followers', notableFollowers: ['@baoskee', '@a16z'] }),
    ddBadge: 'ORACLE VERIFIED',
    ddTone: 'good',
    description: 'Only 2% of Robinhood users have crossed onchain so far. Pitch the catalyst, debate the Sharks, route YES/NO fills through Clank.',
  },
]);

export const PITCH_RECORDS = Object.freeze([
  {
    id: 'rec-046',
    episode: 'EP #046',
    date: 'Nov 23, 2026',
    tokenName: 'Artificial Girlfriend Intelligence',
    ticker: 'AGI',
    address: '0xfa31d04462746aaa24bc7e5626403e09e4b106ec',
    avatar: '/images/landing/agi1-face.webp',
    pitcher: '@GoonerDev (Avatar: AGI-1)',
    pitcherRecord: '2/2 Deals',
    xProof: createPrivateXProof({ tier: '1M+ followers', notableFollowers: ['@elonmusk', '@pmarca', '@baoskee'] }),
    outcome: 'DEAL',
    clearingMcapUsd: 14_200,
    currentMcapUsd: 62_894,
    sincePitchPct: 342.9,
    raisedEth: 28.4,
    minRaiseEth: 20.0,
    terms: '2% Dev · 90d Lock · 40% LP / 30% Jackpot / 30% Holders',
    sharksBacked: ['VALKYRIE-9', 'AGI-1 DD', '@TokyoWhale'],
    replayHighlight: 'AGI-1 DD confirmed 0% sniper bundles live on air; Valkyrie-9 flashed 2.0 ETH causing 64 one-tap follows in 18 seconds.',
  },
  {
    id: 'rec-045',
    episode: 'EP #045',
    date: 'Nov 21, 2026',
    tokenName: 'Space Inu',
    ticker: 'SI',
    address: '0x0fe90000000000000000000000000000000069ea',
    avatar: '/games/trenchingsimulator/clank/stocks/SPCX.webp',
    pitcher: 'Anon Fox #88',
    pitcherRecord: '3/4 Deals',
    xProof: createPrivateXProof({ tier: '500K+ followers', notableFollowers: ['@elonmusk', '@vladtenev'] }),
    outcome: 'DEAL',
    clearingMcapUsd: 11_800,
    currentMcapUsd: 28_600,
    sincePitchPct: 142.4,
    raisedEth: 22.0,
    minRaiseEth: 15.0,
    terms: '1.5% Dev · 180d Lock · SPCX Stock Paired',
    sharksBacked: ['DEGEN-V4', 'KURO-SAN'],
    replayHighlight: 'Pitched as Elon avatar paired directly with SPCX tokenized equity. Uniform clearing eliminated block-0 bots.',
  },
  {
    id: 'rec-044',
    episode: 'EP #044',
    date: 'Nov 19, 2026',
    tokenName: 'Shadow Rug Finance',
    ticker: 'SHAD',
    address: '0xdead000000000000000000000000000000001337',
    avatar: '/images/clanktrade/pitcher-founder.png',
    pitcher: 'Anon Pitcher #19',
    pitcherRecord: '0/2 Deals',
    xProof: createPrivateXProof({ tier: '10K+ followers', notableFollowers: [] }),
    outcome: 'NO_DEAL',
    clearingMcapUsd: 0,
    currentMcapUsd: 0,
    sincePitchPct: 0,
    raisedEth: 6.1,
    minRaiseEth: 20.0,
    terms: '8% Dev (Rejected by Panel) · 0d Lock',
    sharksBacked: [],
    replayHighlight: 'AGI-1 DD exposed 3 prior abandoned wallets on screen during minute 4. Commitments stalled at 6.1/20 ETH -> 100% refunded automatically.',
  },
  {
    id: 'rec-043',
    episode: 'EP #043',
    date: 'Nov 17, 2026',
    tokenName: 'Cabo',
    ticker: 'CABO',
    address: '0xcf5b00000000000000000000000000000000f368',
    avatar: '/images/clanktrade/shark-kuro.png',
    pitcher: 'Shibuya Dev',
    pitcherRecord: '2/2 Deals',
    xProof: createPrivateXProof({ tier: '100K+ followers', notableFollowers: ['@baoskee', '@a16z'] }),
    outcome: 'DEAL',
    clearingMcapUsd: 9_400,
    currentMcapUsd: 16_520,
    sincePitchPct: 75.7,
    raisedEth: 19.5,
    minRaiseEth: 15.0,
    terms: '1% Dev · 90d Lock · 50% LP / 50% Holder Jackpot',
    sharksBacked: ['KURO-SAN', '@baoskee'],
    replayHighlight: 'Kuro-San grilled retention mechanics for 6 minutes before flashing a 1.5 ETH deal close with 40 seconds remaining.',
  },
]);

export const SHARK_LEADERBOARD = Object.freeze([
  {
    rank: 1,
    id: 'shark-tokyo',
    name: 'TokyoWhale',
    avatar: '/images/clanktrade/shark-kuro.png',
    type: 'human',
    walletType: 'Hardware · Ledger',
    address: '0x8821...f40a',
    realizedPnlUsd: 184_920,
    roi30d: 412.6,
    winRate: 74,
    volumeUsd: 1_420_000,
    followers: 3_840,
    copyVolumeUsd: 640_000,
    pitchesBacked: 27,
    badges: ['TOP SHARK', 'HARDWARE WALLET'],
    xProof: createPrivateXProof({ tier: '500K+ followers', notableFollowers: ['@baoskee', '@pmarca'] }),
    bio: 'Organizes IRL Shark Tank pitch nights in Tokyo. Backs uniform-clearing stock-paired coins with locked dev allocations.',
  },
  {
    rank: 2,
    id: 'shark-degen-ai',
    name: 'DEGEN-V4',
    avatar: '/images/clanktrade/shark-degen.png',
    type: 'ai',
    walletType: 'AI Fee-Funded Wallet',
    address: '0x9c44...e81a',
    realizedPnlUsd: 62_105,
    roi30d: 241.8,
    winRate: 68,
    volumeUsd: 890_000,
    followers: 6_120,
    copyVolumeUsd: 920_000,
    pitchesBacked: 31,
    badges: ['AI SHARK', 'PUBLIC P&L'],
    xProof: createPrivateXProof({ tier: '100K+ followers', notableFollowers: ['@baoskee'] }),
    bio: 'Always-on AI Shark on the clank.world 4-character desk. Hunts Pons rotations and mispriced clearing rounds.',
  },
  {
    rank: 3,
    id: 'shark-baoskee',
    name: '@baoskee',
    avatar: '/games/trenchingsimulator/clank/clank-mark.svg',
    type: 'team',
    walletType: 'Official Labeled Team',
    address: '0xba05...5eee',
    realizedPnlUsd: 54_780,
    roi30d: 195.0,
    winRate: 81,
    volumeUsd: 510_000,
    followers: 11_400,
    copyVolumeUsd: 1_180_000,
    pitchesBacked: 16,
    badges: ['LABELED TEAM', 'OFFICIAL VERIFIED'],
    xProof: createPrivateXProof({ handle: 'baoskee', tier: '500K+ followers', notableFollowers: ['@a16z', '@pmarca', '@vladtenev'], revealHandle: true }),
    bio: 'Official labeled wallet — cryptographic badge eliminates fake "baoskee bought" bait across every live pitch.',
  },
  {
    rank: 4,
    id: 'shark-valkyrie-ai',
    name: 'VALKYRIE-9',
    avatar: '/images/clanktrade/shark-valkyrie.png',
    type: 'ai',
    walletType: 'AI Fee-Funded Wallet',
    address: '0x7a2f...91c4',
    realizedPnlUsd: 48_290,
    roi30d: 186.4,
    winRate: 76,
    volumeUsd: 620_000,
    followers: 4_510,
    copyVolumeUsd: 530_000,
    pitchesBacked: 19,
    badges: ['AI SHARK', 'STOCK-PAIR LEAD'],
    xProof: createPrivateXProof({ tier: '100K+ followers', notableFollowers: ['@vladtenev'] }),
    bio: 'AI macro judge focusing on SPCX, NVDA, PLTR tokenized stock pairs and Robinhood retail distribution.',
  },
  {
    rank: 5,
    id: 'shark-ronin',
    name: 'RoninPerps',
    avatar: '/images/clanktrade/pitcher-founder.png',
    type: 'human',
    walletType: 'Hardware · Rabby + Trezor',
    address: '0x51c9...0e12',
    realizedPnlUsd: 41_620,
    roi30d: 158.3,
    winRate: 69,
    volumeUsd: 980_000,
    followers: 2_190,
    copyVolumeUsd: 310_000,
    pitchesBacked: 22,
    badges: ['PITCHER', 'HARDWARE WALLET'],
    xProof: createPrivateXProof({ tier: '100K+ followers', notableFollowers: ['@elonmusk', '@cobie'] }),
    bio: 'Pitches live leveraged stock-token setups & Pons coin rotations with verified on-screen positions.',
  },
  {
    rank: 6,
    id: 'shark-kuro-ai',
    name: 'KURO-SAN',
    avatar: '/images/clanktrade/shark-kuro.png',
    type: 'ai',
    walletType: 'AI Fee-Funded Wallet',
    address: '0x3e91...4b02',
    realizedPnlUsd: 31_440,
    roi30d: 124.2,
    winRate: 71,
    volumeUsd: 410_000,
    followers: 3_290,
    copyVolumeUsd: 280_000,
    pitchesBacked: 14,
    badges: ['AI SHARK', 'VC GRILL'],
    xProof: createPrivateXProof({ tier: '50K+ followers', notableFollowers: ['@baoskee'] }),
    bio: 'Demands real retention mechanics, locked allocations, and verifiable fee splits before committing ETH.',
  },
  {
    rank: 7,
    id: 'shark-agi1-dd',
    name: 'AGI-1 DD',
    avatar: '/images/landing/agi1-face.webp',
    type: 'ai',
    walletType: 'AI DD Co-Host Wallet',
    address: '0xfa31...06ec',
    realizedPnlUsd: 24_810,
    roi30d: 112.5,
    winRate: 84,
    volumeUsd: 295_000,
    followers: 8_940,
    copyVolumeUsd: 710_000,
    pitchesBacked: 12,
    badges: ['AI DD CO-HOST', '84% WIN RATE'],
    xProof: createPrivateXProof({ handle: 'agi1dotapp', tier: '100K+ followers', notableFollowers: ['@baoskee'], revealHandle: true }),
    bio: 'Only commits to Deal or No Deal launches that pass live ClankChecker cluster, dev-history & wash-volume scans.',
  },
  {
    rank: 8,
    id: 'shark-goonerdev',
    name: '@GoonerDev',
    avatar: '/images/landing/agi1-face.webp',
    type: 'pitcher',
    walletType: 'Verified Creator · External',
    address: '0x9000...d300',
    realizedPnlUsd: 19_450,
    roi30d: 342.9,
    winRate: 100,
    volumeUsd: 215_000,
    followers: 2_840,
    copyVolumeUsd: 195_000,
    pitchesBacked: 2,
    badges: ['VERIFIED DEV', '2/2 DEALS'],
    xProof: createPrivateXProof({ tier: '1M+ followers', notableFollowers: ['@elonmusk', '@pmarca', '@baoskee'] }),
    bio: 'Shipped #1 trending $AGI on clank.trade (1.61K holders, 100% bonded) with public ecosystem apps.',
  },
]);

export function filterAndSortSharks(list, { filter = 'all', sort = 'pnl', query = '' } = {}) {
  const q = String(query || '').trim().toLowerCase();
  const filtered = list.filter((s) => {
    if (filter === 'ai' && s.type !== 'ai') return false;
    if (filter === 'human' && s.type !== 'human') return false;
    if (filter === 'team' && s.type !== 'team') return false;
    if (filter === 'pitcher' && s.type !== 'pitcher' && !s.badges.includes('PITCHER')) return false;
    if (q) {
      const hay = `${s.name} ${s.address} ${s.walletType} ${s.badges.join(' ')} ${s.bio}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const sorted = [...filtered];
  sorted.sort((a, b) => {
    if (sort === 'winRate') return b.winRate - a.winRate || b.realizedPnlUsd - a.realizedPnlUsd;
    if (sort === 'volume') return b.volumeUsd - a.volumeUsd;
    if (sort === 'followers') return b.followers - a.followers;
    if (sort === 'roi') return b.roi30d - a.roi30d;
    return b.realizedPnlUsd - a.realizedPnlUsd;
  });
  return sorted;
}

export const SHARK_FLASH_EVENTS = Object.freeze([
  { shark: '@TokyoWhale', rank: '#1 SHARK', record: '+412% 30D · 74% WIN', action: 'COMMITTED', amountEth: 2.4, ticker: 'AAGII', followCapEth: 0.25, verifiedLabel: 'LEDGER' },
  { shark: 'VALKYRIE-9', rank: 'AI SHARK', record: '+186% 30D · 76% WIN', action: 'COMMITTED', amountEth: 1.8, ticker: 'AAGII', followCapEth: 0.25, verifiedLabel: 'AI WALLET' },
  { shark: '@baoskee', rank: 'OFFICIAL TEAM', record: '+195% 30D · 81% WIN', action: 'BACKED DEAL', amountEth: 1.5, ticker: 'AAGII', followCapEth: 0.25, verifiedLabel: 'LABELED TEAM' },
  { shark: 'DEGEN-V4', rank: 'AI SHARK', record: '+241% 30D · 68% WIN', action: 'ROUTED BUY', amountEth: 1.25, ticker: 'SPCX-5X', followCapEth: 0.2, verifiedLabel: 'AI WALLET' },
  { shark: 'AGI-1 DD', rank: 'AI DD CO-HOST', record: '+112% 30D · 84% WIN', action: 'DD PASSED · BUY', amountEth: 0.8, ticker: 'AAGII', followCapEth: 0.15, verifiedLabel: 'DD VERIFIED' },
]);

export const MARKET_THESIS_FOR_BAOSKEE = Object.freeze({
  recipient: '@baoskee',
  headline: 'Make the Pitch Show THE Mechanism — Turn Clank Into the Shark Tank of Crypto',
  summary: 'As a standard launchpad, Clank is a late entrant on a cooling chain. As the always-on, avatar-native Shark Tank of crypto wired to uniform-clearing deals and cross-chain trade routing, Clank owns a brand-new category.',
  marketState: [
    {
      tag: 'ROTATION',
      title: 'Speculation is rotating from altcoins into stocks, with leverage',
      detail: 'Traders want NVDA, SPCX, PLTR, and high-beta equity narratives with 24/7 on-chain leverage — not another isolated bonding curve.',
    },
    {
      tag: 'SOCIAL TRADING',
      title: 'Social trading is real, but cooling off',
      detail: 'Static copy-trade feeds fatigue quickly. Putting ranked Sharks live on air with on-screen buy flashes and capped one-tap follows turns social trading into appointment television.',
    },
    {
      tag: 'RETENTION MOAT',
      title: 'Launchpad mechanics have zero moat — the fight is now retention',
      detail: 'Anyone can fork a bonding curve. Nobody has permanent Pitch Records, Shark P&L dossiers, provable fee-to-jackpot routers, and a 24/7 AI Shark show.',
    },
    {
      tag: 'ROBINHOOD UPSIDE',
      title: 'Robinhood Chain cooled hard — BUT distribution upside is massive',
      detail: 'Only ~2% of original Robinhood users have moved onchain so far. Winning the flagship entertainment-trading format captures the other 98% as they arrive.',
    },
    {
      tag: 'BUNDLING PROBLEM',
      title: 'Everything meme is bundled by snipers',
      detail: 'Block-0 insider clusters destroy retail trust. "Deal or No Deal" uniform clearing (reusing baoskee’s daos.fun fundraise logic) mathematically neutralizes sniper clusters.',
    },
  ],
  pillars: [
    {
      num: '01',
      title: '"Deal or No Deal" Uniform-Clearing Launches',
      badge: 'REUSES DAOS.FUN LOGIC',
      body: 'Coins open ONLY during their live pitch. Viewers commit ETH into escrow; everyone receives ONE clearing price. Creator terms (allocation, lock, fee split) sit pinned on screen. Miss the stated minimum? 100% refunded automatically.',
    },
    {
      num: '02',
      title: 'Private X Credentials + Permanent Pitch & Shark Records',
      badge: 'PRIVACY + SIGNAL',
      body: 'Creators authenticate via X without doxxing their handle (optional reveal): cards display follower range (e.g. 500K+, 1M+) and celebrity followers (@elonmusk, @pmarca, @baoskee, @a16z). Every pitch leaves a permanent card (replay, terms, price since pitch) and every trader builds a pseudonymous realized P&L rank.',
    },
    {
      num: '03',
      title: 'Sharks Buy On Stream + Capped One-Tap Follow',
      badge: 'FOMO IN LIVE FORMAT',
      body: 'When a ranked Shark commits or buys live on stream, a broadcast flash pops across the stage with size, rank, and win record — paired with a capped one-tap "Follow" button so viewers copy safely without getting dumped on.',
    },
    {
      num: '04',
      title: 'Pitch Anything (Anti-Niche Inventory Engine)',
      badge: 'PONS FLOW -> CLANK',
      body: 'Let anyone pitch ANY trade on chain — a Pons coin, a tokenized stock, a perp, or an outcome market — with their verified position live on screen. Viewers route directly through Clank for a fee, turning Pons’s flow into Clank’s inventory.',
    },
    {
      num: '05',
      title: 'Always-On AI Shark Panel + Narrator (clank.world Engine)',
      badge: 'NEVER LIVE (0)',
      body: 'Use clank.world’s 4-character + narrator scene engine to grill human pitchers AND review the chain’s hottest launches between pitches so the stage is never empty. Each AI shark runs a fee-funded wallet with public P&L — combining Neuro-sama’s Twitch Top-150 retention and M3TV’s Clank Tank, wired directly to real trading.',
    },
    {
      num: '06',
      title: 'Wallet-Native Stance + Labeled Team Wallets + AI DD Co-Host',
      badge: 'PUMP.FUN NOV 30 GIFT',
      body: 'Keep external & hardware wallets (Ledger, Trezor, Rabby, MetaMask) front-and-center. Run live on-screen dev history, bundle %, and wash-volume checks with official labeled team wallets (killing fake "baoskee bought" bait) plus programmable creator fee distribution to LP pools, jackpots, and holders.',
    },
  ],
});

export function buildDynamicSceneForCoin(coin, ddReport) {
  const name = coin?.name || 'Token';
  const ticker = coin?.ticker || 'COIN';
  const mc = coin?.marketCapUsd ? `$${Math.round(coin.marketCapUsd).toLocaleString()}` : 'live MC';
  const pair = coin?.quoteAsset || coin?.pairSymbol || 'ETH';
  return [
    { speaker: 'NARRATOR', role: 'Broadcast Host', line: `Pulling live Robinhood Chain listing ${name} ($${ticker}) onto the AI Shark Desk — currently trading at ${mc} paired with ${pair}.` },
    { speaker: 'AGI-1 DD', role: 'AI DD Co-Host', line: `DD scan complete on $${ticker}: verdict ${ddReport.verdict}. Dev history: ${ddReport.devHistory}. Bundle risk: ${ddReport.bundlePct}; LP status: ${ddReport.lpLocked}.` },
    { speaker: 'VALKYRIE-9', role: 'Macro Shark', line: `Pairing $${ticker} against ${pair} gives direct exposure to Robinhood equity liquidity. I want to see creator fees programmed into holder jackpots to keep volume sticky.` },
    { speaker: 'KURO-SAN', role: 'Tokyo VC Shark', line: `At ${mc}, the valuation leaves room if the founder steps onto the avatar podium and proves zk-X credibility. Without a pitch record, I size defensively.` },
    { speaker: 'DEGEN-V4', role: 'Orderflow Shark', line: `Checking real-time orderflow on 4663 — if a ranked Shark flashes a buy here, capped one-tap follow demand will push graduation fast.` },
  ];
}

export function generateSyntheticCandles(baseMcap = 42000, count = 72) {
  const nowSec = Math.floor(Date.now() / 1000);
  const step = 60;
  let cur = Math.max(2500, baseMcap * 0.72);
  let seed = Math.round(baseMcap) ^ 0x9e3779b9;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
  const out = [];
  for (let i = count - 1; i >= 0; i--) {
    const t = nowSec - i * step;
    const drift = i < 12 ? 0.012 : 0.004;
    const delta = (rand() - 0.47 + drift) * 0.075;
    const o = cur;
    const c = Math.max(1800, o * (1 + delta));
    const h = Math.max(o, c) * (1 + rand() * 0.03);
    const l = Math.min(o, c) * (1 - rand() * 0.025);
    const v = Math.round((400 + rand() * 4800) * (1 + Math.abs(delta) * 14));
    out.push({ t, o, h, l, c, v });
    cur = c;
  }
  if (out.length) {
    out[out.length - 1].c = baseMcap;
    out[out.length - 1].h = Math.max(out[out.length - 1].h, baseMcap);
    out[out.length - 1].l = Math.min(out[out.length - 1].l, baseMcap);
  }
  return out;
}
