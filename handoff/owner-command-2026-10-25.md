# Website owner command — 2026-10-25

The requested website content manager lives at `/owner`, backed by `owner-command.html` so the existing Studio host's `/owner` route keeps working. It uses the exact signed wallet session and `isVoteOwner` check used by `/vote/owner` (`STUDIO_OWNER`, with the existing fallback).

## Controls

- Select a built-in page and pick sections, text, links, or images from its same-origin preview.
- Edit Her world names, descriptions and destinations; hide existing rows or add new ones. Related orbit links and the visible count follow changes.
- Add text/image/link sections at the start/end or beside a selected section. Reorder added sections.
- Add content pages at `/p/<slug>`, with titles, descriptions and sections.
- Hide/restore pages and existing elements. Built-in content is hidden using presentation overrides, preserving app nodes and behavior; this does not delete source files, underlying app records or protect private information. Vote and Studio record managers remain linked separately.
- Preview drafts in memory, publish changes, reject stale saves, and restore any of the most recent 30 saved revisions.

## Storage and access

`api/wallet.js` handles `GET ?site-content` and signed `site-owner`, `site-save`, `site-history`, `site-restore` actions. New isolated tables `agi_site_content` and `agi_site_content_history` store only the `agi1.app` row. Public responses omit hidden custom content and audit history. All writes use server validation, RLS tables without browser grants, service-role-only RPCs and row-locked revision checks. No HTML or executable content is accepted.

`supabase/site-content.sql` was applied to project `vujaxukucukjxzhcxlea` (`agi2`), confirmed against agi1.app's public Ride 'Em AGI counters (129 plays, 29 players, 1 rating, sum 5) and the prior release record. A rolled-back service-role transaction verified save, stale-save rejection and restore. Final database inspection: revision 0, zero page changes, one original snapshot, both tables have RLS, no browser table access. Security advisors report the expected informational “RLS without policies” because browser access is intentionally denied.

## Verification

- Full production build: 1,247 passed, 0 failed, 6 pre-existing skips; Vite, share pages and secret check passed.
- 24 focused owner API/runtime tests cover owner authorization, persistence errors, conflict handling, history, safe rendering, selector stability, navigation, protected recovery routes and preview message origin/source checks.
- Real Chromium checks using a made-up wallet and in-memory API fixture: signed-out and wrong-wallet gates; Her world edit/remove/add/publish; public reload; new page/section; image upload; mobile width; history restore; no editor page errors.
- Desktop, 390px phone and custom-page screenshots reviewed in ignored `tools/owner-qa/`.

Run local QA with `node tools/owner-preview.mjs`, then open its loopback `/__owner-test` page. This helper skips `.env.local`, uses only fake server settings, blocks upstream API requests and is outside the Vite build. `tools/owner-ui-check.mjs` uses Playwright; optional `OWNER_PLAYWRIGHT_MODULE` and `OWNER_BROWSER_PATH` select an already installed runtime/browser.

New image uploads accept PNG/JPEG/WebP and are compressed in-browser; document limits are 300 KB, 150 page settings, 1,500 element edits and 500 added sections. Existing native app controls, game behavior and database records use their existing managers/code.
