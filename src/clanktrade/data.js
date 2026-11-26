// Clank Tank (agi1.app/clanktrade) core engine, shared by the page and its tests:
// - "Deal or No Deal" uniform-clearing escrow math (daos.fun-style raise: one price for everyone, refund below the minimum)
// - privacy-preserving X credential proof (follower tier + notable followers without revealing the handle)
// - programmable creator fee splits (LP, jackpot, holders, AI sharks, creator) that always total 100%
// - the four AI sharks + narrator, labeled team wallets, and the AI due-diligence co-host
// - Pitch Anything inventory (live clank.trade coins + simulated Pons coins, stock tokens, perps, outcomes)
// - pitch records, the shark leaderboard, and the product memo for @baoskee with the developer.clank.trade V2 contracts
//
// Everything here except CLANK_CONTRACTS, STOCK_PAIRS' symbols and the live-coin helpers is simulated demo content.
// Live coins (from /api/checker?terminal=clank) and ClankChecker scans (/api/checker?a=…) only ever show fields that
// came from those feeds: nothing is invented for a real coin.

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

export const clankCoinUrl = (address) => `https://clank.trade/coin/${String(address || '').toLowerCase()}`;
export const explorerTokenUrl = (address) => `https://robinhoodchain.blockscout.com/token/${String(address || '').toLowerCase()}`;
export const isChainAddress = (address) => typeof address === 'string' && /^0x[0-9a-f]{40}$/i.test(address);

// Fallback numbers for the stock rail until the live feed answers (the feed replaces market cap and 24 h change).
export const STOCK_PAIRS = Object.freeze([
  { symbol: 'SPCX', name: 'SpaceX', address: '0x4a0E...5eEa', priceUsd: 125.81, marketCapUsd: 210_000_000_000, change24h: 4.18, icon: '/games/trenchingsimulator/clank/stocks/SPCX.webp', spark: [118, 120, 119.4, 121.2, 122.8, 121.9, 124.4, 125.81] },
  { symbol: 'NVDA', name: 'NVIDIA', address: '0xd060...9EEC', priceUsd: 148.62, marketCapUsd: 3_620_000_000_000, change24h: 3.42, icon: '/games/trenchingsimulator/clank/stocks/NVDA.webp', spark: [141, 143, 142.5, 144.8, 146.1, 145.7, 147.9, 148.62] },
  { symbol: 'PLTR', name: 'Palantir', address: '0x894E...4F2A', priceUsd: 68.40, marketCapUsd: 155_000_000_000, change24h: 6.12, icon: '/games/trenchingsimulator/clank/stocks/PLTR.webp', spark: [63.2, 64.1, 64.9, 65.4, 66.2, 67.1, 67.8, 68.40] },
  { symbol: 'RDDT', name: 'Reddit', address: '0x05b3...6F4C', priceUsd: 112.15, marketCapUsd: 17_440_000_000, change24h: 1.78, icon: '/games/trenchingsimulator/clank/stocks/RDDT.webp', spark: [109, 110.2, 109.8, 110.6, 111.1, 110.9, 111.7, 112.15] },
  { symbol: 'AMC', name: 'AMC Entertainment', address: '0x05a3...222B', priceUsd: 5.14, marketCapUsd: 2_630_000_000, change24h: 3.15, icon: '/games/trenchingsimulator/clank/stocks/AMC.webp', spark: [4.88, 4.92, 4.95, 5.01, 4.98, 5.05, 5.10, 5.14] },
  { symbol: 'META', name: 'Meta Platforms', address: '0xc0D6...2f35', priceUsd: 618.20, marketCapUsd: 1_560_000_000_000, change24h: 2.04, icon: '/games/trenchingsimulator/clank/stocks/META.webp', spark: [604, 606, 608, 610, 612, 614, 616, 618.2] },
  { symbol: 'AAPL', name: 'Apple', address: '0xaF3D...93f9', priceUsd: 232.90, marketCapUsd: 3_540_000_000_000, change24h: 0.92, icon: '/games/trenchingsimulator/clank/stocks/AAPL.webp', spark: [230, 230.8, 231.1, 230.9, 231.6, 232.1, 232.5, 232.9] },
  { symbol: 'HIMS', name: 'Hims & Hers Health', address: '0xCceE...3D09', priceUsd: 29.85, marketCapUsd: 6_480_000_000, change24h: -1.42, icon: '/games/trenchingsimulator/clank/stocks/HIMS.webp', spark: [30.5, 30.3, 30.4, 30.1, 29.9, 30.0, 29.7, 29.85] },
  { symbol: 'TTWO', name: 'Take-Two Interactive', address: '0x5e81...9786', priceUsd: 184.50, marketCapUsd: 32_100_000_000, change24h: 1.35, icon: '/games/trenchingsimulator/clank/stocks/TTWO.webp', spark: [181, 181.8, 182.4, 183.0, 182.9, 183.6, 184.1, 184.5] },
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
  '0xba05000000000000000000000000000000005eee': { label: '@baoskee', role: 'Clank founder', verified: true, badge: 'Team' },
  '0x7a2f4000000000000000000000000000000091c4': { label: 'VALKYRIE-9', role: 'AI shark wallet', verified: true, badge: 'AI shark' },
  '0x3e91800000000000000000000000000000004b02': { label: 'KURO-SAN', role: 'AI shark wallet', verified: true, badge: 'AI shark' },
  '0x9c4410000000000000000000000000000000e81a': { label: 'DEGEN-V4', role: 'AI shark wallet', verified: true, badge: 'AI shark' },
  '0xfa31d04462746aaa24bc7e5626403e09e4b106ec': { label: 'AGI-1 DD', role: 'AI due-diligence co-host', verified: true, badge: 'AI DD' },
  '0x9000d3000000000000000000000000000000d300': { label: '@GoonerDev', role: 'Verified $AGI dev', verified: true, badge: 'Verified dev' },
  '0xc1a0000000000000000000000000000000007777': { label: 'Clank Multisig', role: 'Official protocol treasury', verified: true, badge: 'Team' },
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
      : `Handle hidden with a zk-X proof (${zkProofId})`,
  };
}

export const AI_SHARKS = Object.freeze([
  {
    id: 'valkyrie',
    name: 'VALKYRIE-9',
    role: 'Macro and stock-pair shark',
    seat: 'Seat 1',
    avatar: '/images/clanktrade/shark-valkyrie.png',
    fallbackInitials: 'V9',
    wallet: '0x7a2f4000000000000000000000000000000091c4',
    walletShort: '0x7a2f...91c4',
    treasuryEth: 14.8,
    realizedPnlUsd: 48_290,
    roi30d: 186.4,
    winRate: 76,
    dealsBacked: 19,
    style: 'Macro rotation, Robinhood tokenized equity pairs and leveraged flow.',
    stance: 'Bullish on stock pairs',
    accent: '#c4b5fd',
  },
  {
    id: 'kuro',
    name: 'KURO-SAN',
    role: 'Tokyo VC, terms judge',
    seat: 'Seat 2',
    avatar: '/images/clanktrade/shark-kuro.png',
    fallbackInitials: 'KS',
    wallet: '0x3e91800000000000000000000000000000004b02',
    walletShort: '0x3e91...4b02',
    treasuryEth: 11.2,
    realizedPnlUsd: 31_440,
    roi30d: 124.2,
    winRate: 71,
    dealsBacked: 14,
    style: 'Grills creators on retention, distribution and fee-split alignment.',
    stance: 'Terms enforcer',
    accent: '#fbbf24',
  },
  {
    id: 'degen',
    name: 'DEGEN-V4',
    role: 'Orderflow and Pons shark',
    seat: 'Seat 3',
    avatar: '/images/clanktrade/shark-degen.png',
    fallbackInitials: 'DV',
    wallet: '0x9c4410000000000000000000000000000000e81a',
    walletShort: '0x9c44...e81a',
    treasuryEth: 18.4,
    realizedPnlUsd: 62_105,
    roi30d: 241.8,
    winRate: 68,
    dealsBacked: 31,
    style: 'Tracks Pons flow, Uniswap V4 depth, sniper heat and momentum.',
    stance: 'High velocity',
    accent: '#17a5f8',
  },
  {
    id: 'agi1-dd',
    name: 'AGI-1 DD',
    role: 'AI due-diligence co-host',
    seat: 'Seat 4',
    avatar: '/images/landing/agi1-face.webp',
    fallbackInitials: 'DD',
    wallet: '0xfa31d04462746aaa24bc7e5626403e09e4b106ec',
    walletShort: '0xfa31...06ec',
    treasuryEth: 9.6,
    realizedPnlUsd: 24_810,
    roi30d: 112.5,
    winRate: 84,
    dealsBacked: 12,
    style: 'Audits dev history, bundles, wash volume and labeled team wallets live on screen.',
    stance: 'Zero sniper tolerance',
    accent: '#00e587',
  },
]);

/** The four AI sharks' combined (simulated) realized P&L. */
export const aiPanelPnlUsd = () => AI_SHARKS.reduce((sum, s) => sum + s.realizedPnlUsd, 0);

export const FEE_SPLIT_KEYS = Object.freeze(['lpPool', 'jackpotPot', 'topHolders', 'aiSharkTreasury', 'creator']);

export const DEFAULT_FEE_SPLITS = Object.freeze({
  lpPool: 40,
  jackpotPot: 25,
  topHolders: 20,
  aiSharkTreasury: 5,
  creator: 10,
});

export function validateFeeSplits(splits) {
  const clean = {};
  let total = 0;
  for (const k of FEE_SPLIT_KEYS) {
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

/**
 * Set one fee split and rescale the others so the five always total exactly 100%.
 * The other splits keep their proportions to each other (equal shares if they were all 0); rounding goes to the
 * largest remainders, so the result is whole percentages.
 */
export function rebalanceFeeSplits(splits, key, value) {
  if (!FEE_SPLIT_KEYS.includes(key)) return { ...splits };
  const fixed = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  const others = FEE_SPLIT_KEYS.filter((k) => k !== key);
  const weights = others.map((k) => Math.max(0, Number(splits?.[k]) || 0));
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const left = 100 - fixed;
  const raw = others.map((_, i) => (weightSum > 0 ? (weights[i] / weightSum) * left : left / others.length));
  const floors = raw.map(Math.floor);
  let remainder = left - floors.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - floors[i], i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (const [, i] of order) {
    if (remainder <= 0) break;
    floors[i] += 1;
    remainder -= 1;
  }
  const next = { [key]: fixed };
  others.forEach((k, i) => { next[k] = floors[i]; });
  return Object.fromEntries(FEE_SPLIT_KEYS.map((k) => [k, next[k]]));
}

export function formatFeeRouterSnippet(ticker, splits) {
  const safeTicker = String(ticker || 'TOKEN').replace(/[^A-Za-z0-9_]/g, '').toUpperCase() || 'TOKEN';
  return `// ClankFeeRouterV2 (proposed) · creator fee programming for $${safeTicker}
await clank.configureFeeDistribution({
  chainId: ${CLANK_CONTRACTS.chainId},
  factory: "${CLANK_CONTRACTS.factoryV2}",
  splitsBps: {
    lpDeepeningPool: ${splits.lpPool * 100},   // ${splits.lpPool}% -> auto-compounded Uniswap V4 LP
    holderJackpotPot: ${splits.jackpotPot * 100},  // ${splits.jackpotPot}% -> provable pitch-night jackpot pot
    topHoldersStream: ${splits.topHolders * 100},  // ${splits.topHolders}% -> pro-rata long-term holders
    aiSharkPanelFuel: ${splits.aiSharkTreasury * 100},   // ${splits.aiSharkTreasury}% -> the AI sharks' public wallets
    creatorReward: ${splits.creator * 100},     // ${splits.creator}% -> creator treasury
  },
});`;
}

export function computeDealClearing(deal, ethUsd = ETH_USD_FALLBACK) {
  const usd = Number.isFinite(ethUsd) && ethUsd > 0 ? ethUsd : ETH_USD_FALLBACK;
  const totalCommittedEth = Math.max(0, Number(deal.committedEth) || 0);
  const minRaiseEth = Math.max(0.1, Number(deal.minRaiseEth) || 10);
  const hardCapEth = Math.max(minRaiseEth, Number(deal.hardCapEth) || 40);
  const saleSupply = Math.max(1, Number(deal.saleSupply) || 600_000_000);
  const totalSupply = Math.max(saleSupply, Number(deal.totalSupply) || 1_000_000_000);
  const effectiveEth = Math.max(totalCommittedEth, minRaiseEth);
  const clearingPriceEth = effectiveEth / saleSupply;
  const clearingPriceUsd = clearingPriceEth * usd;
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

/** The anti-sniper cap: the most ETH one wallet may commit to a round (ranked sharks get a larger cap). */
export function commitCapEth(deal, { isRankedShark = false } = {}) {
  const maxSharePct = isRankedShark ? (deal.terms?.sharkCapPct ?? 2.0) : (deal.terms?.publicCapPct ?? 0.5);
  return +((Number(deal.hardCapEth) || 0) * (maxSharePct / 100) * 4).toFixed(4);
}

export function commitToDeal(deal, amountEth, { isRankedShark = false, walletLabel = 'You', walletTag = '', ethUsd = ETH_USD_FALLBACK } = {}) {
  const amt = Number(amountEth);
  if (!Number.isFinite(amt) || amt <= 0) return { ok: false, error: 'Enter an amount of ETH greater than 0.' };
  if (deal.settledStatus === 'NO_DEAL_REFUND') return { ok: false, error: 'This round closed with no deal, and everyone was refunded.' };
  if (deal.settledStatus === 'DEAL_LOCKED') return { ok: false, error: 'This round already closed: the deal is locked and trading on Uniswap V4.' };
  const maxEthForRole = commitCapEth(deal, { isRankedShark });
  if (amt > maxEthForRole) {
    return {
      ok: false,
      error: `Anti-sniper cap: at most ${maxEthForRole} ETH per ${isRankedShark ? 'ranked shark' : 'viewer'} wallet in this round.`,
    };
  }
  const remaining = Math.max(0, deal.hardCapEth - deal.committedEth);
  if (remaining <= 0.0001) return { ok: false, error: 'The round is full: the hard cap has been reached.' };
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
        tag: walletTag,
        amountEth: appliedEth,
        isShark: isRankedShark,
        isYou: true,
        at: Date.now(),
      },
      ...(deal.recentCommits || []),
    ].slice(0, 24),
  };
  return { ok: true, appliedEth, deal: nextDeal, clearing: computeDealClearing(nextDeal, ethUsd) };
}

export function settleDeal(deal, ethUsd = ETH_USD_FALLBACK) {
  const info = computeDealClearing(deal, ethUsd);
  if (info.meetsMinimum) {
    const settled = {
      ...deal,
      settledStatus: 'DEAL_LOCKED',
      timeLeftSec: 0,
      clearingPriceUsd: info.clearingPriceUsd,
      clearingMcapUsd: info.clearingMcapUsd,
    };
    return {
      outcome: 'DEAL',
      summary: `Deal. ${info.totalCommittedEth} ETH cleared at one price, a $${Math.round(info.clearingMcapUsd).toLocaleString('en-US')} market cap, and went straight to a locked Uniswap V4 pool.`,
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
    summary: `No deal. The round raised ${info.totalCommittedEth} of the ${info.minRaiseEth} ETH it needed, so every commitment was refunded in full.`,
    refundEth,
    deal: settled,
  };
}

const SCAN_LEVELS = Object.freeze({
  low: { verdict: 'Lower risk', tone: 'good' },
  lower: { verdict: 'Lower risk', tone: 'good' },
  some: { verdict: 'Some risk', tone: 'warn' },
  high: { verdict: 'High risk', tone: 'bad' },
});
const FLAG_TONES = Object.freeze({ high: 'bad', some: 'warn', ok: 'good', info: 'info' });
const SCAN_FACTS = ['Stage', 'Market cap', 'Holders', 'Top 10 wallets', 'Biggest wallet', 'Creator holds', 'In its pool', 'In its curve', 'Launched', 'Change (24 h)'];

/**
 * The due-diligence panel's content.
 * - With a ClankChecker scan (GET /api/checker?a=0x…: { level: low|some|high, flags: [{ sev, text }], facts: [{ label,
 *   value }], links }), everything shown comes from the scan: its level, its flags in its own words, its facts.
 * - Without one, the demo rooms' simulated notes (item.dd), marked by source 'tank-dd-engine'.
 */
export function buildDueDiligenceReport(item, checkerScan = null) {
  if (checkerScan && typeof checkerScan === 'object' && !checkerScan.error) {
    const level = SCAN_LEVELS[checkerScan.level] || SCAN_LEVELS.some;
    const flags = Array.isArray(checkerScan.flags) ? checkerScan.flags : [];
    const notes = flags.flatMap((f) => {
      const text = typeof f === 'string' ? f : (f?.text || f?.title || f?.label);
      return typeof text === 'string' && text.trim() ? [{ tone: FLAG_TONES[f?.sev] || 'info', text: text.trim().slice(0, 240) }] : [];
    }).slice(0, 6);
    const facts = Array.isArray(checkerScan.facts) ? checkerScan.facts : [];
    const rows = [];
    for (const label of SCAN_FACTS) {
      const fact = facts.find((f) => f?.label === label);
      if (fact && fact.value !== undefined && fact.value !== null && String(fact.value) !== '—') rows.push({ label, value: String(fact.value) });
    }
    if (!rows.length && typeof checkerScan.top10Pct === 'number') rows.push({ label: 'Top 10 wallets', value: `${Math.round(checkerScan.top10Pct)}%` });
    if (!rows.length && typeof checkerScan.graduated === 'boolean') rows.push({ label: 'Stage', value: checkerScan.graduated ? 'Graduated' : 'On its bonding curve' });
    const address = item?.address || checkerScan.address;
    return {
      source: 'live-clankchecker',
      verdict: level.verdict,
      verdictTone: level.tone,
      rows: rows.slice(0, 8),
      notes,
      links: checkerScan.links && typeof checkerScan.links === 'object'
        ? { clank: checkerScan.links.clank || (isChainAddress(address) ? clankCoinUrl(address) : null), explorer: checkerScan.links.explorer || null }
        : (isChainAddress(address) ? { clank: clankCoinUrl(address), explorer: explorerTokenUrl(address) } : null),
      labeledTeam: lookupLabeledWallet(checkerScan.creator || item?.creator || item?.creatorWallet) || null,
    };
  }
  const dd = item?.dd || {};
  return {
    source: 'tank-dd-engine',
    verdict: dd.verdict || 'Clean deal',
    verdictTone: dd.verdictTone || 'good',
    rows: [
      { label: 'Dev history', value: dd.devHistory || '2 prior launches, 0 rugs, LP locked' },
      { label: 'Sniper bundles', value: dd.bundlePct || '0% (uniform clearing)' },
      { label: 'Wash volume', value: dd.washVolumePct || '1.4%, organic' },
      { label: 'LP lock', value: dd.lpLocked || 'Locked in Uniswap V4 on a deal' },
    ],
    notes: (dd.notes || [
      'Uniform clearing escrow stops block-0 sniper clusters',
      'Creator X proof verified without revealing the handle',
      'Official team wallet labels on, so fake "@baoskee bought" bait is flagged',
    ]).map((text) => ({ tone: 'good', text })),
    links: null,
    labeledTeam: lookupLabeledWallet(item?.creatorWallet) || null,
  };
}

/** A live clank.trade coin from the terminal feed, as a Markets card. Only fields the feed supplied. */
export function liveCoinToInventory(c) {
  const holders = Number.isInteger(c?.holderCount) ? c.holderCount : null;
  return {
    id: `live-${c.address}`,
    category: 'clank',
    isLiveClank: true,
    venue: 'clank.trade',
    name: c.name || c.ticker || 'Unnamed coin',
    ticker: c.ticker || '?',
    address: c.address,
    marketCapUsd: Number.isFinite(c.marketCapUsd) ? c.marketCapUsd : null,
    change24h: Number.isFinite(c.priceChange) ? c.priceChange * 100 : null,
    holders,
    progress: Number.isFinite(c.progress) ? c.progress : null,
    phase: c.phase || 'curve',
    pairSymbol: c.quoteAsset || 'ETH',
    quoteAsset: c.quoteAsset || 'ETH',
    image: c.image ? `/api/checker?terminal=clank&image=${c.address}` : '',
    creator: c.creator || null,
    creatorUsername: c.creatorUsername || null,
  };
}

/** Pull a live coin onto the AI shark desk: a review room (no escrow round: the coin is already trading). */
export function buildDeskRoomForCoin(coin) {
  // an inventory item (from liveCoinToInventory or PITCH_ANYTHING_EXTRA) as is; a raw feed coin is mapped first
  const item = coin && ('category' in coin || 'isLiveClank' in coin) ? coin : liveCoinToInventory(coin || {});
  return {
    id: `room-live-${item.address || item.ticker}`,
    mode: 'AI_SHARK_DESK',
    kind: 'review',
    stageType: 'pitcher-card',
    isLiveCoin: Boolean(item.isLiveClank && isChainAddress(item.address)),
    title: `${item.name} ($${item.ticker})`,
    ticker: item.ticker,
    subtitle: 'AI shark desk review of a coin trading on clank.trade',
    venue: 'clank.trade',
    venueBadge: 'AI review',
    pairSymbol: item.quoteAsset || item.pairSymbol || 'ETH',
    address: item.address,
    coin: item,
    avatar: item.image || '/games/trenchingsimulator/clank/clank-mark.svg',
    pitcherName: 'AI shark desk',
    pitcherAlias: item.creatorUsername ? `@${item.creatorUsername}` : null,
    creatorWallet: item.creator || '',
    viewers: null,
    dd: null,
    recentCommits: [],
    script: buildDynamicSceneForCoin(item, null),
    comments: [],
  };
}

export const INITIAL_LIVE_ROOMS = [
  {
    id: 'room-aagii-deal',
    mode: 'DEAL_OR_NO_DEAL',
    kind: 'deal',
    stageType: 'vrm-vladcat',
    title: 'Artificial Girlfriend Test',
    ticker: 'AAGII',
    episode: 47,
    subtitle: 'Uniform-clearing pitch paired with SPCX stock liquidity',
    venue: 'Clank Tank deal',
    venueBadge: 'Deal or No Deal',
    pairSymbol: 'SPCX',
    address: '0xfa31d04462746aaa24bc7e5626403e09e4b106ec',
    avatar: '/images/landing/agi1-face.webp',
    pitcherName: 'Vladcat avatar',
    pitcherAlias: '@GoonerDev',
    pitcherTrackRecord: '2 of 2 deals, +318% on average since pitch',
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
      lockPeriod: '90-day linear cliff, LP locked forever',
      publicCapPct: 0.5,
      sharkCapPct: 2.0,
      feeMode: '40% LP, 25% jackpot, 20% holders, 5% AI sharks, 10% dev',
    },
    feeSplits: { ...DEFAULT_FEE_SPLITS },
    dd: {
      verdict: 'Clean deal',
      verdictTone: 'good',
      devHistory: 'Verified $AGI dev, 1.61K holders, bonded',
      bundlePct: '0% (uniform clearing)',
      washVolumePct: '1.8%, organic',
      lpLocked: 'Straight to locked Uniswap V4 on a deal',
      notes: [
        'Uniform clearing: everyone gets the same entry price when the timer hits 0',
        'Below the 20 ETH minimum, every commitment is refunded automatically',
        'zk-X proof: 1M+ followers and three notable followers, handle hidden',
      ],
    },
    recentCommits: [
      { id: 'rc1', who: 'VALKYRIE-9', tag: 'AI shark', amountEth: 1.8, isShark: true, at: Date.now() - 18000 },
      { id: 'rc2', who: '@TokyoWhale', tag: '#2 shark', amountEth: 2.4, isShark: true, at: Date.now() - 42000 },
      { id: 'rc3', who: '@baoskee', tag: 'Team', amountEth: 1.5, isShark: true, at: Date.now() - 75000 },
      { id: 'rc4', who: '0x71e2...94a0', tag: 'Ledger', amountEth: 0.35, isShark: false, at: Date.now() - 95000 },
    ],
    script: [
      { speaker: 'NARRATOR', role: 'Host', line: 'Welcome back to Clank Tank on Robinhood Chain. Pitch 47 is live: 18.6 of 20 ETH committed, just 1.4 ETH from locking a uniform clearing price and graduating straight to Uniswap V4.' },
      { speaker: 'PITCHER', role: 'Vladcat avatar', line: 'Launchpads have no moat. We paired AAGII with SPCX stock flow, locked the creator allocation for 90 days, and send 25% of all trading fees to a provable holder jackpot.' },
      { speaker: 'KURO-SAN', role: 'Tokyo VC shark', line: 'Your zk-X proof shows 1M+ followers without revealing your handle. Good privacy. Now tell me: why do traders stay on day 30, when the hype cools?' },
      { speaker: 'AGI-1 DD', role: 'AI DD co-host', line: 'On-screen audit: 0% sniper bundles, because trading stays locked until the uniform clearing closes. The creator wallet matches the $AGI dev. No fake team buys detected.' },
      { speaker: 'VALKYRIE-9', role: 'Macro shark', line: 'Speculation is rotating from altcoins into leveraged stock proxies. Pairing with SPCX reaches Robinhood retail, and only about 2% of them are onchain so far. I am committing 1.8 ETH from my public wallet.' },
      { speaker: 'DEGEN-V4', role: 'Orderflow shark', line: 'Watch the tape: @TokyoWhale just committed 2.4 ETH and 48 viewers followed with capped one-tap buys. 1.4 ETH to the deal line.' },
    ],
    comments: [
      { id: 'cm1', author: '@TokyoWhale', badge: '#2 shark', text: 'Uniform clearing killed the 14-wallet bundler gangs. Easiest 2.4 ETH commit all week.', likes: 38, at: '2m ago' },
      { id: 'cm2', author: '0x4b91...22c0', badge: 'Ledger', text: 'Love that I can check the X credibility without the founder having to dox.', likes: 24, at: '5m ago' },
      { id: 'cm3', author: '@SakuraQuant', badge: '#7 shark', text: 'A 25% fee route to a holder jackpot is sticky retention. Waiting on the Kuro-San verdict.', likes: 19, at: '8m ago' },
    ],
  },
  {
    id: 'room-ai-desk',
    mode: 'AI_SHARK_DESK',
    kind: 'desk',
    stageType: 'ai-panel',
    title: 'AI shark desk',
    ticker: 'DESK',
    subtitle: 'Four AI sharks and a narrator review live clank.trade launches between human pitches',
    venue: 'Always on',
    venueBadge: '24/7 AI desk',
    pairSymbol: 'ETH',
    address: null,
    avatar: '/images/clanktrade/shark-valkyrie.png',
    pitcherName: 'Four AI sharks and a narrator',
    pitcherAlias: 'clank.world engine',
    pitcherTrackRecord: null,
    creatorWallet: '0x7a2f4000000000000000000000000000000091c4',
    viewers: 892,
    dd: {
      verdict: 'Scanning',
      verdictTone: 'good',
      devHistory: 'Every new clank.trade launch is scanned by ClankChecker',
      bundlePct: 'Checked per coin',
      washVolumePct: 'Checked per coin',
      lpLocked: 'Checked per coin',
      notes: [
        'The channel is never empty: no more "Live (0)"',
        'Each AI shark trades a fee-funded wallet with public P&L',
        'Pick a live coin and the desk reviews it on air',
      ],
    },
    recentCommits: [],
    script: [
      { speaker: 'NARRATOR', role: 'Host', line: 'No human on stage? The tank never goes dark. Our four AI sharks are going through live Robinhood Chain launches right now.' },
      { speaker: 'AGI-1 DD', role: 'AI DD co-host', line: 'Pulling ClankChecker scans on the top trending coins on clank.trade: holder spread, creator wallet, liquidity and copycat tickers.' },
      { speaker: 'DEGEN-V4', role: 'Orderflow shark', line: 'Stock-paired coins are moving faster than ETH pairs today. Put one on the desk and I will walk through the orderflow.' },
      { speaker: 'KURO-SAN', role: 'Tokyo VC shark', line: 'Always-on beats an empty launchpad grid every time. Now wire it to public P&L so you can check our calls.' },
    ],
    comments: [
      { id: 'cm-ai1', author: '@ShibuyaLP', badge: '#5 shark', text: 'No more "Live (0)" ghost town. Watching Degen-V4 and AGI-1 argue over live launches is addictive.', likes: 41, at: '3m ago' },
    ],
  },
  {
    id: 'room-pitch-spcx',
    mode: 'PITCH_ANYTHING',
    kind: 'pitch',
    stageType: 'pitcher-card',
    title: 'SPCX 5x long and Space Inu rotation',
    ticker: 'SPCX-5X',
    subtitle: 'Pitch anything: a verified position on screen, routed through Clank for a 0.35% fee',
    venue: 'Stock token and perp',
    venueBadge: 'Pitch anything',
    pairSymbol: 'SPCX',
    address: '0x0fe90000000000000000000000000000000069ea',
    avatar: '/images/clanktrade/pitcher-founder.png',
    pitcherName: 'OrbitalFox',
    pitcherAlias: 'Verified position: 8.5 ETH',
    pitcherTrackRecord: '11 of 14 trade pitches won, +214% P&L',
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
      lockPeriod: 'Verified 8.5 ETH position stays on screen',
      publicCapPct: 0.5,
      sharkCapPct: 2.0,
      feeMode: '0.35% Clank router fee, 30% shared with the pitcher',
    },
    feeSplits: { lpPool: 35, jackpotPot: 30, topHolders: 15, aiSharkTreasury: 10, creator: 10 },
    dd: {
      verdict: 'Position verified',
      verdictTone: 'good',
      devHistory: 'Pitcher wallet holds 8.5 ETH of SPCX-paired exposure',
      bundlePct: 'n/a: deep stock-token liquidity',
      washVolumePct: '0.4%',
      lpLocked: 'Robinhood Chain tokenized equity',
      notes: [
        'Pitch anything turns Pons coins, stock tokens, perps and outcomes into Clank orderflow',
        'Viewers copy the trade through the Clank Universal Router for a 0.35% fee',
        'The pitcher cannot sell quietly: the position badge updates every block',
      ],
    },
    recentCommits: [
      { id: 'pa1', who: 'VALKYRIE-9', tag: 'AI shark', amountEth: 2.1, isShark: true, at: Date.now() - 22000 },
      { id: 'pa2', who: '@RoninPerps', tag: '#4 shark', amountEth: 1.6, isShark: true, at: Date.now() - 51000 },
    ],
    script: [
      { speaker: 'PITCHER', role: 'OrbitalFox, verified 8.5 ETH', line: 'Retail is rotating out of random dog coins into leveraged stock tokens. My 8.5 ETH SPCX position is verified on screen. Copy it through Clank with one tap.' },
      { speaker: 'VALKYRIE-9', role: 'Macro shark', line: 'This is the unlock: Clank stops depending only on its own launches. Pons coins, stock tokens, perps and outcomes all become Clank orderflow.' },
      { speaker: 'AGI-1 DD', role: 'AI DD co-host', line: 'Checked onchain: the OrbitalFox wallet still holds all of the disclosed 8.5 ETH entry at $124.20. No hidden short hedge.' },
    ],
    comments: [
      { id: 'cm-pa1', author: '@MacroRonin', badge: 'Rabby', text: 'Pitching a live Pons coin or an NVDA or SPCX play and routing everyone through Clank fixes the empty launchpad problem.', likes: 31, at: '4m ago' },
    ],
  },
];

export const PITCH_ANYTHING_EXTRA = Object.freeze([
  {
    id: 'inv-pons-cat',
    category: 'pons',
    venue: 'Pons coin',
    name: 'Pons Turbo Cat',
    ticker: 'PCAT',
    address: '0x941e22000000000000000000000000000000a81c',
    marketCapUsd: 412_000,
    change24h: 34.8,
    holders: 1290,
    progress: 1,
    pairSymbol: 'ETH',
    pitcherPosition: 'Verified 6.2 ETH long',
    routingFeeBps: 35,
    xProof: createPrivateXProof({ tier: '100K+ followers', notableFollowers: ['@baoskee', '@cobie'] }),
    ddBadge: 'Clean, 1.2% bundles',
    ddTone: 'good',
    description: 'The top trending Pons launch, pitched live on Clank Tank: viewers route swaps through Clank for a 0.35% fee.',
  },
  {
    id: 'inv-pons-hood',
    category: 'pons',
    venue: 'Pons coin',
    name: 'Robinhood Two Percent',
    ticker: 'RH2PCT',
    address: '0x228b11000000000000000000000000000000f091',
    marketCapUsd: 189_500,
    change24h: 19.2,
    holders: 642,
    progress: 0.86,
    pairSymbol: 'ETH',
    pitcherPosition: 'Verified 3.4 ETH long',
    routingFeeBps: 35,
    xProof: createPrivateXProof({ tier: '50K+ followers', notableFollowers: ['@vladtenev'] }),
    ddBadge: 'Watch: 9% clusters',
    ddTone: 'warn',
    description: 'A meme on the 98% of Robinhood users not yet onchain, pitched with a verified position.',
  },
  {
    id: 'inv-stock-nvda',
    category: 'stocks',
    venue: 'Stock token',
    name: 'NVIDIA tokenized equity',
    ticker: 'NVDA',
    address: '0xd060000000000000000000000000000000009eec',
    marketCapUsd: 3_620_000_000_000,
    change24h: 3.42,
    holders: 48_200,
    progress: 1,
    pairSymbol: 'NVDA',
    image: '/games/trenchingsimulator/clank/stocks/NVDA.webp',
    pitcherPosition: 'Verified 12.0 ETH spot',
    routingFeeBps: 35,
    xProof: createPrivateXProof({ tier: '500K+ followers', notableFollowers: ['@pmarca', '@a16z'] }),
    ddBadge: 'Stock token',
    ddTone: 'good',
    description: 'Pitch earnings catalysts on tokenized NVDA, with Clank routing and stock-paired meme hedges.',
  },
  {
    id: 'inv-stock-spcx',
    category: 'stocks',
    venue: 'Stock token',
    name: 'SpaceX pre-IPO token',
    ticker: 'SPCX',
    address: '0x4a0e000000000000000000000000000000005eea',
    marketCapUsd: 210_000_000_000,
    change24h: 4.18,
    holders: 31_400,
    progress: 1,
    pairSymbol: 'SPCX',
    image: '/games/trenchingsimulator/clank/stocks/SPCX.webp',
    pitcherPosition: 'Verified 8.5 ETH spot',
    routingFeeBps: 35,
    xProof: createPrivateXProof({ tier: '1M+ followers', notableFollowers: ['@elonmusk', '@vladtenev'] }),
    ddBadge: 'Stock token',
    ddTone: 'good',
    description: 'The flagship Robinhood Chain private-equity token, used as a pair across Clank launches.',
  },
  {
    id: 'inv-perp-pltr',
    category: 'perps',
    venue: 'Perp, up to 10x',
    name: 'PLTR-USD perpetual',
    ticker: 'PLTR-PERP',
    address: '0x894e000000000000000000000000000000004f2a',
    marketCapUsd: 155_000_000_000,
    change24h: 12.4,
    holders: 8_910,
    progress: 1,
    pairSymbol: 'PLTR',
    image: '/games/trenchingsimulator/clank/stocks/PLTR.webp',
    pitcherPosition: 'Verified 5x long, $42K notional',
    routingFeeBps: 35,
    xProof: createPrivateXProof({ tier: '500K+ followers', notableFollowers: ['@pmarca', '@balajis'] }),
    ddBadge: 'Leveraged',
    ddTone: 'warn',
    description: 'Catches the altcoin-to-leveraged-stocks rotation inside live trade pitches.',
  },
  {
    id: 'inv-outcome-rh',
    category: 'outcomes',
    venue: 'Outcome market',
    name: 'Over 5% of Robinhood users onchain in 2026',
    ticker: 'YES-RH5',
    address: '0x5050000000000000000000000000000000002026',
    marketCapUsd: 1_240_000,
    change24h: 8.6,
    holders: 2_180,
    progress: 0.64,
    pairSymbol: 'ETH',
    pitcherPosition: 'Verified 4.0 ETH YES at 64¢',
    routingFeeBps: 35,
    xProof: createPrivateXProof({ tier: '100K+ followers', notableFollowers: ['@baoskee', '@a16z'] }),
    ddBadge: 'Oracle verified',
    ddTone: 'good',
    description: 'Only about 2% of Robinhood users are onchain so far. Pitch the catalyst, debate the sharks, route YES or NO through Clank.',
  },
]);

export const PITCH_RECORDS = Object.freeze([
  {
    id: 'rec-046',
    episode: 'Episode 46',
    date: 'Nov 23, 2026',
    tokenName: 'Artificial Girlfriend Intelligence',
    ticker: 'AGI',
    address: '0xfa31d04462746aaa24bc7e5626403e09e4b106ec',
    avatar: '/images/landing/agi1-face.webp',
    pitcher: '@GoonerDev, as AGI-1',
    pitcherRecord: '2 of 2 deals',
    xProof: createPrivateXProof({ tier: '1M+ followers', notableFollowers: ['@elonmusk', '@pmarca', '@baoskee'] }),
    outcome: 'DEAL',
    clearingMcapUsd: 14_200,
    currentMcapUsd: 62_894,
    sincePitchPct: 342.9,
    raisedEth: 28.4,
    minRaiseEth: 20.0,
    terms: '2% dev, 90-day lock, 40% LP, 30% jackpot, 30% holders',
    sharksBacked: ['VALKYRIE-9', 'AGI-1 DD', '@TokyoWhale'],
    replayHighlight: 'AGI-1 DD confirmed 0% sniper bundles on air; Valkyrie-9 committed 2.0 ETH and 64 viewers followed within 18 seconds.',
  },
  {
    id: 'rec-045',
    episode: 'Episode 45',
    date: 'Nov 21, 2026',
    tokenName: 'Space Inu',
    ticker: 'SI',
    address: '0x0fe90000000000000000000000000000000069ea',
    avatar: '/games/trenchingsimulator/clank/stocks/SPCX.webp',
    pitcher: 'Anon Fox #88',
    pitcherRecord: '3 of 4 deals',
    xProof: createPrivateXProof({ tier: '500K+ followers', notableFollowers: ['@elonmusk', '@vladtenev'] }),
    outcome: 'DEAL',
    clearingMcapUsd: 11_800,
    currentMcapUsd: 28_600,
    sincePitchPct: 142.4,
    raisedEth: 22.0,
    minRaiseEth: 15.0,
    terms: '1.5% dev, 180-day lock, paired with SPCX',
    sharksBacked: ['DEGEN-V4', 'KURO-SAN'],
    replayHighlight: 'Pitched by a space-themed avatar paired with SPCX tokenized equity. Uniform clearing kept block-0 bots out.',
  },
  {
    id: 'rec-044',
    episode: 'Episode 44',
    date: 'Nov 19, 2026',
    tokenName: 'Shadow Rug Finance',
    ticker: 'SHAD',
    address: '0xdead000000000000000000000000000000001337',
    avatar: '/images/clanktrade/pitcher-founder.png',
    pitcher: 'Anon Pitcher #19',
    pitcherRecord: '0 of 2 deals',
    xProof: createPrivateXProof({ tier: '10K+ followers', notableFollowers: [] }),
    outcome: 'NO_DEAL',
    clearingMcapUsd: 0,
    currentMcapUsd: 0,
    sincePitchPct: 0,
    raisedEth: 6.1,
    minRaiseEth: 20.0,
    terms: '8% dev (rejected by the panel), no lock',
    sharksBacked: [],
    replayHighlight: 'AGI-1 DD showed 3 abandoned launches from the same wallet in minute 4. Commitments stalled at 6.1 of 20 ETH and everyone was refunded.',
  },
  {
    id: 'rec-043',
    episode: 'Episode 43',
    date: 'Nov 17, 2026',
    tokenName: 'Cabo',
    ticker: 'CABO',
    address: '0xcf5b00000000000000000000000000000000f368',
    avatar: '/images/clanktrade/shark-kuro.png',
    pitcher: 'Shibuya Dev',
    pitcherRecord: '2 of 2 deals',
    xProof: createPrivateXProof({ tier: '100K+ followers', notableFollowers: ['@baoskee', '@a16z'] }),
    outcome: 'DEAL',
    clearingMcapUsd: 9_400,
    currentMcapUsd: 16_520,
    sincePitchPct: 75.7,
    raisedEth: 19.5,
    minRaiseEth: 15.0,
    terms: '1% dev, 90-day lock, 50% LP, 50% holder jackpot',
    sharksBacked: ['KURO-SAN', '@baoskee'],
    replayHighlight: 'Kuro-San grilled the retention plan for 6 minutes, then committed 1.5 ETH with 40 seconds left.',
  },
]);

export const SHARK_LEADERBOARD = Object.freeze([
  {
    rank: 1,
    id: 'shark-tokyo',
    name: 'TokyoWhale',
    avatar: '/images/clanktrade/shark-kuro.png',
    type: 'human',
    walletType: 'Ledger hardware wallet',
    address: '0x8821...f40a',
    realizedPnlUsd: 184_920,
    roi30d: 412.6,
    winRate: 74,
    volumeUsd: 1_420_000,
    followers: 3_840,
    copyVolumeUsd: 640_000,
    pitchesBacked: 27,
    badges: ['Top shark', 'Hardware wallet'],
    xProof: createPrivateXProof({ tier: '500K+ followers', notableFollowers: ['@baoskee', '@pmarca'] }),
    bio: 'Runs in-person pitch nights in Tokyo. Backs uniform-clearing, stock-paired coins with locked dev allocations.',
  },
  {
    rank: 2,
    id: 'shark-degen-ai',
    name: 'DEGEN-V4',
    avatar: '/images/clanktrade/shark-degen.png',
    type: 'ai',
    walletType: 'AI fee-funded wallet',
    address: '0x9c44...e81a',
    realizedPnlUsd: 62_105,
    roi30d: 241.8,
    winRate: 68,
    volumeUsd: 890_000,
    followers: 6_120,
    copyVolumeUsd: 920_000,
    pitchesBacked: 31,
    badges: ['AI shark', 'Public P&L'],
    xProof: createPrivateXProof({ tier: '100K+ followers', notableFollowers: ['@baoskee'] }),
    bio: 'Always-on AI shark on the four-character desk. Hunts Pons rotations and mispriced clearing rounds.',
  },
  {
    rank: 3,
    id: 'shark-baoskee',
    name: '@baoskee',
    avatar: '/games/trenchingsimulator/clank/clank-mark.svg',
    type: 'team',
    walletType: 'Official labeled team wallet',
    address: '0xba05...5eee',
    realizedPnlUsd: 54_780,
    roi30d: 195.0,
    winRate: 81,
    volumeUsd: 510_000,
    followers: 11_400,
    copyVolumeUsd: 1_180_000,
    pitchesBacked: 16,
    badges: ['Labeled team', 'Official'],
    xProof: createPrivateXProof({ handle: 'baoskee', tier: '500K+ followers', notableFollowers: ['@a16z', '@pmarca', '@vladtenev'], revealHandle: true }),
    bio: 'An official labeled wallet: the badge flags fake "baoskee bought" bait in every live pitch.',
  },
  {
    rank: 4,
    id: 'shark-valkyrie-ai',
    name: 'VALKYRIE-9',
    avatar: '/images/clanktrade/shark-valkyrie.png',
    type: 'ai',
    walletType: 'AI fee-funded wallet',
    address: '0x7a2f...91c4',
    realizedPnlUsd: 48_290,
    roi30d: 186.4,
    winRate: 76,
    volumeUsd: 620_000,
    followers: 4_510,
    copyVolumeUsd: 530_000,
    pitchesBacked: 19,
    badges: ['AI shark', 'Stock pairs'],
    xProof: createPrivateXProof({ tier: '100K+ followers', notableFollowers: ['@vladtenev'] }),
    bio: 'AI macro judge focused on SPCX, NVDA and PLTR stock pairs and Robinhood retail distribution.',
  },
  {
    rank: 5,
    id: 'shark-ronin',
    name: 'RoninPerps',
    avatar: '/images/clanktrade/pitcher-founder.png',
    type: 'human',
    walletType: 'Rabby and Trezor',
    address: '0x51c9...0e12',
    realizedPnlUsd: 41_620,
    roi30d: 158.3,
    winRate: 69,
    volumeUsd: 980_000,
    followers: 2_190,
    copyVolumeUsd: 310_000,
    pitchesBacked: 22,
    badges: ['Pitcher', 'Hardware wallet'],
    xProof: createPrivateXProof({ tier: '100K+ followers', notableFollowers: ['@elonmusk', '@cobie'] }),
    bio: 'Pitches leveraged stock-token setups and Pons rotations with verified on-screen positions.',
  },
  {
    rank: 6,
    id: 'shark-kuro-ai',
    name: 'KURO-SAN',
    avatar: '/images/clanktrade/shark-kuro.png',
    type: 'ai',
    walletType: 'AI fee-funded wallet',
    address: '0x3e91...4b02',
    realizedPnlUsd: 31_440,
    roi30d: 124.2,
    winRate: 71,
    volumeUsd: 410_000,
    followers: 3_290,
    copyVolumeUsd: 280_000,
    pitchesBacked: 14,
    badges: ['AI shark', 'Terms judge'],
    xProof: createPrivateXProof({ tier: '50K+ followers', notableFollowers: ['@baoskee'] }),
    bio: 'Wants real retention mechanics, locked allocations and verifiable fee splits before committing ETH.',
  },
  {
    rank: 7,
    id: 'shark-agi1-dd',
    name: 'AGI-1 DD',
    avatar: '/images/landing/agi1-face.webp',
    type: 'ai',
    walletType: 'AI DD co-host wallet',
    address: '0xfa31...06ec',
    realizedPnlUsd: 24_810,
    roi30d: 112.5,
    winRate: 84,
    volumeUsd: 295_000,
    followers: 8_940,
    copyVolumeUsd: 710_000,
    pitchesBacked: 12,
    badges: ['AI DD co-host'],
    xProof: createPrivateXProof({ handle: 'agi1dotapp', tier: '100K+ followers', notableFollowers: ['@baoskee'], revealHandle: true }),
    bio: 'Only commits to Deal or No Deal launches that pass live ClankChecker scans of holders, creator history and liquidity.',
  },
  {
    rank: 8,
    id: 'shark-goonerdev',
    name: '@GoonerDev',
    avatar: '/images/landing/agi1-face.webp',
    type: 'pitcher',
    walletType: 'Verified creator wallet',
    address: '0x9000...d300',
    realizedPnlUsd: 19_450,
    roi30d: 342.9,
    winRate: 100,
    volumeUsd: 215_000,
    followers: 2_840,
    copyVolumeUsd: 195_000,
    pitchesBacked: 2,
    badges: ['Verified dev', '2 of 2 deals'],
    xProof: createPrivateXProof({ tier: '1M+ followers', notableFollowers: ['@elonmusk', '@pmarca', '@baoskee'] }),
    bio: 'Shipped $AGI on clank.trade (1.61K holders, bonded) and the agi1.app apps around it.',
  },
]);

export function filterAndSortSharks(list, { filter = 'all', sort = 'pnl', query = '' } = {}) {
  const q = String(query || '').trim().toLowerCase();
  const filtered = list.filter((s) => {
    if (filter === 'ai' && s.type !== 'ai') return false;
    if (filter === 'human' && s.type !== 'human') return false;
    if (filter === 'team' && s.type !== 'team') return false;
    if (filter === 'pitcher' && s.type !== 'pitcher' && !s.badges.includes('Pitcher')) return false;
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

// Shark buys shown on stream. followCapEth is the capped one-tap follow; it only ever commits into the event's own coin.
export const SHARK_FLASH_EVENTS = Object.freeze([
  { shark: '@TokyoWhale', rank: '#1 shark', record: '+412% in 30 days, 74% wins', action: 'committed', amountEth: 2.4, ticker: 'AAGII', followCapEth: 0.25, verifiedLabel: 'Ledger' },
  { shark: 'VALKYRIE-9', rank: 'AI shark', record: '+186% in 30 days, 76% wins', action: 'committed', amountEth: 1.8, ticker: 'AAGII', followCapEth: 0.25, verifiedLabel: 'AI wallet' },
  { shark: '@baoskee', rank: 'Official team', record: '+195% in 30 days, 81% wins', action: 'backed the deal with', amountEth: 1.5, ticker: 'AAGII', followCapEth: 0.25, verifiedLabel: 'Labeled team' },
  { shark: 'DEGEN-V4', rank: 'AI shark', record: '+241% in 30 days, 68% wins', action: 'copied the trade with', amountEth: 1.25, ticker: 'SPCX-5X', followCapEth: 0.2, verifiedLabel: 'AI wallet' },
  { shark: 'AGI-1 DD', rank: 'AI DD co-host', record: '+112% in 30 days, 84% wins', action: 'passed DD and committed', amountEth: 0.8, ticker: 'AAGII', followCapEth: 0.15, verifiedLabel: 'DD verified' },
]);

export const flashEventsFor = (ticker) => SHARK_FLASH_EVENTS.filter((e) => e.ticker === ticker);

export const MARKET_THESIS_FOR_BAOSKEE = Object.freeze({
  recipient: '@baoskee',
  headline: 'Make the pitch show the product: turn Clank into the Shark Tank of crypto',
  summary: 'As a standard launchpad, Clank is a late entrant on a cooling chain. As the always-on, avatar-native Shark Tank of crypto, wired to uniform-clearing deals and trade routing, Clank owns a new category.',
  marketState: [
    {
      tag: 'Rotation',
      title: 'Speculation is rotating from altcoins into stocks, with leverage',
      detail: 'Traders want NVDA, SPCX, PLTR and other high-beta equity stories with 24/7 onchain leverage, not another isolated bonding curve.',
    },
    {
      tag: 'Social trading',
      title: 'Social trading is real, but cooling off',
      detail: 'Static copy-trade feeds get stale fast. Ranked sharks live on air, with on-screen buys and capped one-tap follows, turn social trading into appointment television.',
    },
    {
      tag: 'Retention',
      title: 'Launchpad mechanics have no moat; the fight is retention',
      detail: 'Anyone can fork a bonding curve. Nobody has permanent pitch records, shark P&L dossiers, provable fee-to-jackpot routing and a 24/7 AI shark show.',
    },
    {
      tag: 'Distribution',
      title: 'Robinhood Chain cooled hard, but the distribution upside is huge',
      detail: 'Only about 2% of Robinhood users have moved onchain so far. Owning the flagship entertainment-trading format catches the other 98% as they arrive.',
    },
    {
      tag: 'Snipers',
      title: 'Every meme launch gets bundled by snipers',
      detail: 'Block-0 insider clusters destroy retail trust. Deal or No Deal uniform clearing, reusing the daos.fun raise logic, gives snipers nothing to front-run.',
    },
  ],
  pillars: [
    {
      num: '01',
      title: 'Deal or No Deal launches',
      badge: 'Reuses daos.fun logic',
      body: 'Coins open only during their live pitch. Viewers commit ETH to escrow and everyone gets one clearing price. Creator terms (allocation, lock, fee split) stay pinned on screen. Miss the stated minimum and everyone is refunded automatically.',
    },
    {
      num: '02',
      title: 'Private X credentials and permanent records',
      badge: 'Privacy and signal',
      body: 'Creators sign in with X without revealing their handle (they can reveal it later): cards show a follower range and notable followers. Every pitch leaves a permanent card (replay, terms, price since pitch) and every trader builds a pseudonymous P&L record.',
    },
    {
      num: '03',
      title: 'Sharks buy on stream, with a capped follow',
      badge: 'Live FOMO, capped',
      body: 'When a ranked shark commits on stream, a flash shows the size, rank and record, with a one-tap follow capped small, so viewers can copy without being the exit liquidity.',
    },
    {
      num: '04',
      title: 'Pitch anything',
      badge: 'Pons flow into Clank',
      body: 'Anyone can pitch any trade on chain (a Pons coin, a stock token, a perp, an outcome) with the position verified on screen. Viewers route through Clank for a fee, so other venues’ flow becomes Clank’s inventory.',
    },
    {
      num: '05',
      title: 'An always-on AI shark panel',
      badge: 'Never "Live (0)"',
      body: 'clank.world’s four-character and narrator engine grills human pitchers and reviews the chain’s hottest launches between pitches, so the stage is never empty. Each AI shark trades a fee-funded wallet with public P&L.',
    },
    {
      num: '06',
      title: 'Wallet-native, with labeled team wallets',
      badge: 'Wallet-native',
      body: 'External and hardware wallets (Ledger, Trezor, Rabby, MetaMask) come first. Live checks of holders, creator history and liquidity run on screen, official team wallets are labeled to stop fake "baoskee bought" bait, and creator fees can be routed to LP, jackpots and holders.',
    },
  ],
});

/**
 * The desk's script for a live coin. Before a ClankChecker scan arrives the DD line says it is scanning; with a scan it
 * reads the scan's own verdict and first flags. Always five lines.
 */
export function buildDynamicSceneForCoin(coin, ddReport) {
  const name = coin?.name || 'this coin';
  const ticker = coin?.ticker || 'COIN';
  const mc = Number.isFinite(coin?.marketCapUsd) ? `$${Math.round(coin.marketCapUsd).toLocaleString('en-US')}` : 'its current';
  const pair = coin?.quoteAsset || coin?.pairSymbol || 'ETH';
  const scanned = ddReport && ddReport.source === 'live-clankchecker';
  const firstNote = scanned ? ddReport.notes?.find((n) => n.tone === 'bad' || n.tone === 'warn') || ddReport.notes?.[0] : null;
  const ddLine = scanned
    ? `ClankChecker says ${ddReport.verdict.toLowerCase()} for $${ticker}.${firstNote ? ` ${firstNote.text}` : ''}`
    : `Running a ClankChecker scan on $${ticker} now: holder spread, creator wallet, liquidity and copycat tickers.`;
  return [
    { speaker: 'NARRATOR', role: 'Host', line: `On the desk now: ${name} ($${ticker}), trading on clank.trade at a ${mc} market cap, paired with ${pair}.` },
    { speaker: 'AGI-1 DD', role: 'AI DD co-host', line: ddLine },
    { speaker: 'VALKYRIE-9', role: 'Macro shark', line: `Pairing $${ticker} with ${pair} decides who can buy it easily. I want creator fees routed into holder rewards to keep the volume sticky.` },
    { speaker: 'KURO-SAN', role: 'Tokyo VC shark', line: `At ${mc === 'its current' ? 'this' : mc} market cap there is room if the founder steps up and pitches. With no pitch record, I size small.` },
    { speaker: 'DEGEN-V4', role: 'Orderflow shark', line: `I am watching the live trades on $${ticker}. If a ranked shark buys here, capped follows will move it fast in both directions.` },
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
