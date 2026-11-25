// Clank Tank v2 (agi1.app/clanktrade) verification suite:
// Deal or No Deal uniform-clearing math & refund guarantee, privacy-preserving zk-X credentials,
// programmable creator fee split validation, labeled team wallets, AI DD co-host, Shark leaderboard
// filtering/sorting, verified Robinhood Chain 4663 V2 contract registry, and strict CSP/security guards.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import {
  CLANK_CONTRACTS,
  AI_SHARKS,
  DEFAULT_FEE_SPLITS,
  INITIAL_LIVE_ROOMS,
  SHARK_LEADERBOARD,
  MARKET_THESIS_FOR_BAOSKEE,
  createPrivateXProof,
  lookupLabeledWallet,
  validateFeeSplits,
  formatFeeRouterSnippet,
  computeDealClearing,
  commitToDeal,
  settleDeal,
  buildDueDiligenceReport,
  filterAndSortSharks,
  buildDynamicSceneForCoin,
} from '../src/clanktrade/data.js';
import { shortAddress } from '../src/clanktrade/wallet.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('Deal or No Deal escrow: uniform clearing, anti-sniper caps, DEAL graduation and 100% NO DEAL refund', () => {
  const baseDeal = { ...INITIAL_LIVE_ROOMS[0], committedEth: 18.0, minRaiseEth: 20.0, hardCapEth: 40.0, userCommittedEth: 0 };
  const c0 = computeDealClearing(baseDeal, 2600);
  assert.equal(c0.meetsMinimum, false);
  assert.equal(c0.status, 'FUNDING');
  assert.equal(c0.remainingToMinEth, 2.0);

  // Viewer anti-sniper cap rejects oversized public commit (> 0.8 ETH on 40 ETH hardCap * 0.5% * 4)
  const tooBig = commitToDeal(baseDeal, 1.5, { isRankedShark: false });
  assert.equal(tooBig.ok, false);
  assert.match(tooBig.error, /Anti-sniper cap/i);

  // Ranked Shark board member can commit 2.0 ETH and push pitch over 20.0 ETH min -> DEAL_READY
  const committed = commitToDeal(baseDeal, 2.0, { isRankedShark: true, walletLabel: 'Shark #1' });
  assert.equal(committed.ok, true);
  assert.equal(committed.clearing.meetsMinimum, true);
  assert.equal(committed.clearing.status, 'DEAL_READY');

  // Settle DEAL -> locks uniform clearing price, zero refund
  const dealWin = settleDeal(committed.deal, 2600);
  assert.equal(dealWin.outcome, 'DEAL');
  assert.equal(dealWin.refundEth, 0);
  assert.equal(dealWin.deal.settledStatus, 'DEAL_LOCKED');

  // Settle below minimum -> NO DEAL with 100% refund of user's committed ETH
  const partial = commitToDeal(baseDeal, 0.5, { isRankedShark: false });
  assert.equal(partial.ok, true);
  const noDeal = settleDeal(partial.deal, 2600);
  assert.equal(noDeal.outcome, 'NO_DEAL');
  assert.equal(noDeal.refundEth, 0.5);
  assert.equal(noDeal.deal.settledStatus, 'NO_DEAL_REFUND');
  assert.equal(noDeal.deal.userCommittedEth, 0);
});

test('Privacy-preserving X credentials hide handle by default while proving follower tier & notable followers', () => {
  const priv = createPrivateXProof({
    handle: '@SecretFounder',
    tier: '1M+ followers',
    notableFollowers: ['@elonmusk', '@pmarca', '@baoskee', '@invalid_spoof'],
    revealHandle: false,
  });
  assert.equal(priv.verified, true);
  assert.equal(priv.handleVisible, false);
  assert.equal(priv.revealedHandle, null);
  assert.equal(priv.tier, '1M+ followers');
  assert.deepEqual(priv.notableFollowers, ['@elonmusk', '@pmarca', '@baoskee']);
  assert.match(priv.zkProofId, /^zkX:0x[0-9a-f]{8}$/);

  const revealed = createPrivateXProof({
    handle: 'SecretFounder',
    tier: '500K+ followers',
    notableFollowers: ['@a16z'],
    revealHandle: true,
  });
  assert.equal(revealed.handleVisible, true);
  assert.equal(revealed.revealedHandle, '@SecretFounder');
});

test('Programmable creator fee distribution requires exact 100% split and formats valid calldata preview', () => {
  assert.equal(validateFeeSplits(DEFAULT_FEE_SPLITS).ok, true);
  assert.equal(validateFeeSplits({ ...DEFAULT_FEE_SPLITS, creator: 50 }).ok, false);
  assert.equal(validateFeeSplits({ ...DEFAULT_FEE_SPLITS, lpPool: -10 }).ok, false);
  const code = formatFeeRouterSnippet('AAGII', DEFAULT_FEE_SPLITS);
  assert.match(code, /ClankFeeRouterV2/);
  assert.match(code, /holderJackpotPot: 2500/);
  assert.match(code, new RegExp(CLANK_CONTRACTS.factoryV2));
});

test('Labeled team wallets and AI DD Co-Host verify official accounts and reject fake impersonators', () => {
  const baoskee = lookupLabeledWallet('0xba05000000000000000000000000000000005eee');
  assert.equal(baoskee?.label, '@baoskee');
  assert.equal(baoskee?.badge, 'TEAM');
  assert.equal(lookupLabeledWallet('0x000000000000000000000000000000000000dead'), null);

  const liveDd = buildDueDiligenceReport({}, {
    level: 'lower',
    creatorCoins: 1,
    top10Pct: 12,
    graduated: true,
    creator: '0x9000d3000000000000000000000000000000d300',
    flags: [],
  });
  assert.equal(liveDd.source, 'live-clankchecker');
  assert.equal(liveDd.verdict, 'CLEAN DEAL');
  assert.equal(liveDd.labeledTeam?.label, '@GoonerDev');
});

test('Always-on 4 AI Sharks + Shark P&L Leaderboard sorting, filtering, and search', () => {
  assert.equal(AI_SHARKS.length, 4);
  for (const s of AI_SHARKS) {
    assert.ok(s.realizedPnlUsd > 0 && s.treasuryEth > 0);
    assert.ok(existsSync(new URL(`../public${s.avatar}`, import.meta.url)), `avatar exists: ${s.avatar}`);
  }

  const aiOnly = filterAndSortSharks(SHARK_LEADERBOARD, { filter: 'ai', sort: 'pnl' });
  assert.equal(aiOnly.length, 4);
  assert.ok(aiOnly[0].realizedPnlUsd >= aiOnly[1].realizedPnlUsd);

  const byWin = filterAndSortSharks(SHARK_LEADERBOARD, { filter: 'all', sort: 'winRate' });
  assert.ok(byWin[0].winRate >= byWin[1].winRate);

  const teamHit = filterAndSortSharks(SHARK_LEADERBOARD, { filter: 'team', query: 'baoskee' });
  assert.equal(teamHit.length, 1);
  assert.equal(teamHit[0].name, '@baoskee');

  const scene = buildDynamicSceneForCoin({ name: 'TestCoin', ticker: 'TST', marketCapUsd: 55000, quoteAsset: 'SPCX' }, buildDueDiligenceReport({}));
  assert.equal(scene.length, 5);
  assert.equal(shortAddress('0x798daAa0707C1e538bB5Acf0867Ac0e1A84cccF2'), '0x798d...ccF2');
});

test('Verified developer.clank.trade V2 contracts, @baoskee market thesis, page CSP, assets and 12-function cap', () => {
  assert.equal(CLANK_CONTRACTS.chainId, 4663);
  assert.equal(CLANK_CONTRACTS.factoryV2, '0x798daAa0707C1e538bB5Acf0867Ac0e1A84cccF2');
  assert.equal(MARKET_THESIS_FOR_BAOSKEE.marketState.length, 5);
  assert.equal(MARKET_THESIS_FOR_BAOSKEE.pillars.length, 6);

  const html = read('clanktrade.html');
  assert.match(html, /<html lang="en" data-page="clanktrade">/);
  assert.match(html, /__SITE__\/cards\/clanktrade\.jpg/);
  assert.match(html, /__SITE__\/clanktrade/);
  assert.match(html, /not financial advice/i);
  assert.ok(!/<script>|style="/.test(html), 'clanktrade.html has zero inline scripts or styles (strict CSP)');

  for (const mod of ['data.js', 'wallet.js', 'stage3d.js', 'chart.js', 'page.js']) {
    const src = read(`src/clanktrade/${mod}`);
    assert.ok(!/innerHTML|insertAdjacentHTML|document\.write/.test(src), `${mod} never uses unsafe HTML sinks`);
  }

  assert.match(read('vite.config.js'), /clanktrade: 'clanktrade\.html'/);
  assert.match(read('scripts/share-pages.js'), /'clanktrade\.jpg'/);
  assert.match(read('scripts/share-pages.js'), /'dist\/clanktrade\.html'/);
  assert.ok(existsSync(new URL('../public/cards/clanktrade.jpg', import.meta.url)), 'public/cards/clanktrade.jpg exists');

  const apiFiles = readdirSync(new URL('../api', import.meta.url)).filter((f) => f.endsWith('.js'));
  assert.ok(apiFiles.length <= 12, `Vercel 12-function cap respected (${apiFiles.length})`);
});
