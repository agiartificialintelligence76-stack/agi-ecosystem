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
  PITCH_ANYTHING_EXTRA,
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
  commitCapEth,
  rebalanceFeeSplits,
  liveCoinToInventory,
  buildDeskRoomForCoin,
  flashEventsFor,
  aiPanelPnlUsd,
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
  assert.equal(baoskee?.badge, 'Team');
  assert.equal(lookupLabeledWallet('0x000000000000000000000000000000000000dead'), null);

  // A scan in the shape /api/checker?a=0x… really answers (server/checker.js analyze()): level low|some|high,
  // flags { id, sev, text }, facts { label, value }, links.
  const coin = { address: '0xfa31d04462746aaa24bc7e5626403e09e4b106ec', creator: '0x9000d3000000000000000000000000000000d300' };
  const liveDd = buildDueDiligenceReport(coin, {
    address: coin.address,
    level: 'low',
    graduated: true,
    flags: [
      { id: 'spread', sev: 'ok', text: 'Spread out: the biggest wallet holds 3.1%, the 10 biggest 24% together.' },
      { id: 'age', sev: 'info', text: 'Launched 71 days ago.' },
    ],
    facts: [
      { label: 'Stage', value: 'Graduated' },
      { label: 'Market cap', value: '$61.8K' },
      { label: 'Top 10 wallets', value: '24%' },
      { label: 'Contract', value: '0xfa31…06ec' },
    ],
    links: { clank: `https://clank.trade/coin/${coin.address}`, explorer: `https://robinhoodchain.blockscout.com/token/${coin.address}` },
  });
  assert.equal(liveDd.source, 'live-clankchecker');
  assert.equal(liveDd.verdict, 'Lower risk');
  assert.equal(liveDd.verdictTone, 'good');
  assert.deepEqual(liveDd.notes.map((n) => n.text), ['Spread out: the biggest wallet holds 3.1%, the 10 biggest 24% together.', 'Launched 71 days ago.']);
  assert.ok(liveDd.notes.every((n) => !/object Object/.test(n.text)), 'flag objects are read by their text');
  assert.deepEqual(liveDd.rows.map((r) => r.label), ['Stage', 'Market cap', 'Top 10 wallets'], 'only facts the scan gave');
  assert.equal(liveDd.links.clank, `https://clank.trade/coin/${coin.address}`);
  assert.equal(liveDd.labeledTeam?.label, '@GoonerDev');

  // Levels map to ClankChecker's own words; nothing is invented when a scan has no facts
  assert.equal(buildDueDiligenceReport({}, { level: 'high', flags: [{ sev: 'high', text: 'Copycat ticker.' }] }).verdict, 'High risk');
  assert.equal(buildDueDiligenceReport({}, { level: 'some', flags: [] }).rows.length, 0);
  assert.equal(buildDueDiligenceReport({}, { error: 'not_clank' }).source, 'tank-dd-engine');
});

test('Live clank.trade coins only show what the feed supplied: no invented X credentials, follows or raise numbers', () => {
  const feedCoin = {
    address: '0xcf5b720f33febdc1c9d4880b8317203b63fdf368', name: 'Cabo', ticker: 'CABO', image: true, holderCount: 812,
    marketCapUsd: 16520, priceChange: -0.031, progress: 1, phase: 'pool', quoteAsset: 'ETH', creator: '0x1111111111111111111111111111111111111111', creatorUsername: null,
  };
  const card = liveCoinToInventory(feedCoin);
  assert.equal(card.isLiveClank, true);
  assert.equal(card.holders, 812);
  assert.equal(Math.round(card.change24h * 10) / 10, -3.1);
  assert.equal(card.image, `/api/checker?terminal=clank&image=${feedCoin.address}`);
  assert.equal(card.xProof, undefined, 'no X proof for a real coin');
  assert.ok(!JSON.stringify(card).includes('@elonmusk') && !JSON.stringify(card).includes('followers'));

  const room = buildDeskRoomForCoin(card);
  assert.equal(room.kind, 'review');
  assert.equal(room.isLiveCoin, true);
  assert.equal(room.xProof, undefined);
  for (const k of ['minRaiseEth', 'hardCapEth', 'committedEth', 'contributors', 'timeLeftSec']) assert.equal(room[k], undefined, `no simulated ${k}`);
  assert.equal(room.script.length, 5);
  assert.match(room.script[1].line, /Running a ClankChecker scan on \$CABO/);

  const scanned = buildDynamicSceneForCoin(card, buildDueDiligenceReport(card, { level: 'some', flags: [{ sev: 'some', text: 'The pool holds about $19.7K.' }] }));
  assert.match(scanned[1].line, /ClankChecker says some risk for \$CABO\. The pool holds about \$19\.7K\./);

  // a simulated inventory item put on the desk stays simulated (no live label, its own picture)
  const pons = PITCH_ANYTHING_EXTRA.find((x) => x.category === 'stocks');
  const simRoom = buildDeskRoomForCoin(pons);
  assert.equal(simRoom.isLiveCoin, false);
  assert.equal(simRoom.coin, pons);
  assert.equal(simRoom.avatar, pons.image);
});

test('The page stays light: the 3D stage (three.js) loads only when it is shown', () => {
  const page = read('src/clanktrade/page.js');
  assert.ok(!/^import[^;]*stage3d/m.test(page), 'no static import of stage3d.js');
  assert.match(page, /import\('\.\/stage3d\.js'\)/);
  assert.ok(!/^import[^;]*from 'three'/m.test(page), 'page.js never imports three directly');
});

test('Commit caps, live ETH price in the clearing, fee splits that always total 100%, and flashes tied to their coin', () => {
  const room = INITIAL_LIVE_ROOMS[0];
  assert.equal(commitCapEth(room, { isRankedShark: false }), 0.8);
  assert.equal(commitCapEth(room, { isRankedShark: true }), 3.2);
  const at1700 = commitToDeal(room, 0.5, { isRankedShark: true, ethUsd: 1700 });
  assert.equal(at1700.ok, true);
  assert.equal(Math.round(at1700.clearing.clearingMcapUsd), Math.round((20 / 600_000_000) * 1700 * 1_000_000_000));

  for (const [key, value] of [['lpPool', 70], ['creator', 0], ['jackpotPot', 100], ['topHolders', 33], ['aiSharkTreasury', 7]]) {
    const next = rebalanceFeeSplits(DEFAULT_FEE_SPLITS, key, value);
    assert.equal(next[key], value);
    assert.equal(validateFeeSplits(next).ok, true, `${key}=${value} still totals 100`);
  }
  const zeros = rebalanceFeeSplits({ lpPool: 100, jackpotPot: 0, topHolders: 0, aiSharkTreasury: 0, creator: 0 }, 'lpPool', 60);
  assert.deepEqual(zeros, { lpPool: 60, jackpotPot: 10, topHolders: 10, aiSharkTreasury: 10, creator: 10 });
  const kept = rebalanceFeeSplits(DEFAULT_FEE_SPLITS, 'creator', 30); // the others keep 40:25:20:5
  assert.deepEqual(kept, { lpPool: 31, jackpotPot: 19, topHolders: 16, aiSharkTreasury: 4, creator: 30 });

  assert.ok(flashEventsFor('AAGII').length >= 3);
  assert.ok(flashEventsFor('AAGII').every((e) => e.ticker === 'AAGII'));
  assert.equal(flashEventsFor('DESK').length, 0);
  assert.equal(aiPanelPnlUsd(), AI_SHARKS.reduce((s, x) => s + x.realizedPnlUsd, 0));
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
