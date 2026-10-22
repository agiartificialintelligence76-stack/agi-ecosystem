# Phomo fidelity correction — 2026-10-22

The owner rejected the published Phomo implementation as visually and functionally incomplete relative to
Fomo and asked for **literally everything in fomo.family**. This is active implementation work, not completed
parity. The earlier passing tests and deployment check establish that the release worked; they do not establish
that it matched Fomo. Do not repeat that claim.

## Reference method

Inspected the owner's signed-in Fomo web UI through the browser, then opened a separate reference tab using the
same browser session to avoid disrupting the owner's browsing. Reference pages: `/discover`, a Solana token
page, the Position modal, Swap settings, own profile and Edit profile, Feed and its filters. Screenshots are in
the session visualization directory, named `fomo-token-reference.png`, `fomo-position-reference.png`,
`fomo-discovery-reference.png`, and `fomo-profile-reference.png`. No private API, source bundle, account
credential, copied stylesheet, artwork or Fomo account mutation is part of this work.

## Observed screen structure and gaps

| Area | Observed web behavior | Correction owner / status |
|---|---|---|
| Global frame | 64px top bar, near-black purple surface, compact search and cash/profile controls, 26px footer | Shell/discovery rewrite in progress; game HUD must be compact |
| Token workspace | Persistent 280px discovery list, resize divider, central token/chart/activity column, one ~312px trade/About/positions sidebar | Layout and coin agents rebuilding; published version incorrectly removed discovery and duplicated sidebars |
| Compact discovery | Horizontal Alerts/Watchlist/Tokens/Perps/Leaderboard/Feed tabs, category chips, 48px token rows, split controls at bottom | In progress |
| Discover page | Collapsed side toggle, watched-token cards, dense token table, positions pane with collapse; 56px rows and small avatars | In progress |
| Table controls | 25/50/100 rows, 5m/1h/4h/24h, separate anchored filters, numeric sort, hidden tokens, resizable token-name column | In progress; previous generic modal was not a match |
| Token rows | Watch, identity/chain/source, copy and social actions, contextual quick buy, cap/change/volume/holder counts/thesis | In progress; missing live figures remain unknown |
| Chart | Interval/style/indicators, Price/MCap, settings, fullscreen, snapshot, drawings; bottom ranges, timezone, percentage/log/auto | Isolated chart extension in progress using public Lightweight Charts APIs |
| Trade and About | Buy/Sell tabs, settings, large dollar field, four presets, available balance; interval changes and paired activity bars | Coin agent implementing with existing practice order path |
| Swap settings | Four editable buy and sell presets, reset, automatic/custom slippage, save | Existing behavior retained and layout revised |
| Position dialog | Trader header; chart/ranges/markers on left, position value/PnL/entry/invested and paginated transactions on right | Social/position module in progress |
| Profile | Banner/avatar, name/handle, following/followers, hold time/trades/joined, period portfolio chart, positions and swaps tables | Social module in progress; only observed game history is shown |
| Profile editor | Avatar/banner, username, display name, bio capped at 160, linked account control | Local profile customization; external account linking requires an actual integration |
| Feed | Trader/time/event cards, trades and closed PnL, theses/likes, pinned recap and event filters | Social module in progress |
| Feed filters | Trades, closed positions, theses, multi-user trades, new listings, price spikes, profit milestones, new traders | Only supported observed/simulated events may be represented |
| Replay | Owner separately requires replay | Preserve recorded playback; root extending saved-run access |

## Implementation and verification update

The screen corrections above are now implemented locally. The initial status column records the original gaps;
it is not a claim that every proprietary Fomo feature has been recreated. Additional inspected references include
public trader profiles, trader alert filters, the clan detail page, and the live perpetual-market page. Fomo's
current web perpetual page itself says trading is not yet available, so Phomo retains view-only public markets.

Implemented: persistent compact discovery and resizable workspaces; separate numeric/network/source filters;
token and trader search; shared positions dock; chart styles, indicators, settings, native annotations with
undo/redo/lock/hide/delete, scale/range controls, fullscreen and image export; richer profiles and position dialogs;
editable local theses and replies; trader and price alert management; original simulated clan views derived from
existing NPC positions; and a bounded local replay library with export and reload support.

Browser checks found and fixed initial chart fitting, the quick-buy amount field width, drawings in blank chart
space, the extra positions pane on profiles, and automatic discovery collapse on phone token selection. A real
practice buy and sell completed in the browser. The 48.8-second recorded run survived a full page reload, retained
both fills, and its final replay balance was $5,227.36 with +$1.36 profit, matching the original result. Profile
editing and position-to-Sell navigation were also exercised. The 360px discovery screen had no document overflow;
the token screen remains scrollable vertically, with wide data tables scrollable inside their own regions.

## Boundaries that cannot be hidden by visual similarity

Phomo remains the owner's practice-money game with original parody branding. Real deposits/withdrawals,
custody, real execution, external account linking, private social data and Fomo's proprietary backend are not
available merely because the owner can view their account. Their absence must be explicit, not disguised with
fake controls, fabricated holders, pretend followers, or invented history. Public charts use the installed
Lightweight Charts library; Fomo's full licensed Advanced Charts package is not bundled. Implemented drawings
belong to the current open chart and are not cloud-saved. Profile images use original local avatar/banner choices.
Clans contain the existing fictional traders, not Fomo's real communities. Social views operate on this game's
recorded activity and local notes; unavailable event types are not represented by decorative controls. Public
spot quotes appear only when the existing feed supplies them, otherwise they show unavailable. No service purchase,
database change, account link, real trade, social post, deposit or withdrawal occurred during the reference audit.

Before reporting this correction complete, verify the actual revised screens beside the reference at the same
viewport, exercise new controls, run meaningful regressions, and update this checklist with remaining gaps.

Final local validation: `npm run build` passed on Node 24.21.0: **1,111 passed, 0 failed, 6 skipped**.
The browser build, share-page generation and secret check passed. The existing mixed static/dynamic English
translation import warning remains. No Node 20/22 executables were available locally for this follow-up.
The final built output also ran with the unchanged production CSP: chart styles, a drawing in blank chart space,
undo/redo and full-width profile layout worked, with no browser warnings or errors. The hosted relay correctly
rejects the temporary localhost origin; live integration was subsequently verified on the production origin.

## Published result

Published commit: `4c214cbed78b7d6030746075ec74004b9fc1e3c8`, on main and the working branch.
Vercel production `GzKNs5dWeUaEmxAz5hz66H2diXjG` is Ready, completed 2026-10-22 11:57:23 UTC,
assigned to `www.agi1.app`. Candidate URL: `https://agi-ecosystem-n6m652g0c-agi25.vercel.app`.

Production browser verification: exact contract `0xFa31d04462746aAA24bC7E5626403E09E4B106ec` resolves to
Artificial Girlfriend Intelligence, $10 practice buy filled, observed live chart loaded with the buy marker,
public Perps returned 178 markets and 180 BTC candles in the new docked layout. ETH/SOL/HYPE footer spot quotes
appeared from the existing public feed; unsupported BTC spot remained unavailable. No browser warnings/errors.
Screenshots: `phomo-fidelity-published.png` and `phomo-fidelity-published-perps.png` in the session visualization folder.

Hetzner `/opt/agi1-live/site` clean checkout fast-forwarded to the release. `tools/trench-relay` was unchanged;
running relay and Caddy start times were preserved, with no restart. Public health 200/no problems, all nine
chains configured, exact AGI lookup/watched update and public perps/candles passed. Evidence:
`phomo-fidelity-relay.log`. No database migration was required.
