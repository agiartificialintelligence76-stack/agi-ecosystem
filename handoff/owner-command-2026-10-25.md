# Website owner command — 2026-10-25

The requested website content manager lives at `/owner`, backed by `owner-command.html` so the existing Studio host's `/owner` route keeps working. It uses the exact signed wallet session and `isVoteOwner` check used by `/vote/owner` (`STUDIO_OWNER`, with the existing fallback).

## Controls

- Select a built-in page and pick sections, text, links, or images from its same-origin preview.
- Edit Her world names, descriptions and destinations; hide existing rows or add new ones. Related orbit links and the visible count follow changes.
- Add text/image/link sections at the start/end or beside a selected section. Reorder added sections.
- Add content pages at `/p/<slug>`, with titles, descriptions and sections.
- Hide/restore pages and existing elements. Built-in content is hidden using presentation overrides, preserving app nodes and behavior; this does not delete source files, underlying app records or protect private information. Vote and Studio record managers remain linked separately.
- Select `/memes` and open **Meme library** to upload images/videos into the actual gallery, edit titles and captions, move videos between Videos and Slopcore, hide/restore items, remove uploaded items, or reset built-in items to their original details.
- Preview drafts in memory, publish changes, reject stale saves, and restore any of the most recent 30 saved revisions.

## Storage and access

`api/wallet.js` handles `GET ?site-content` and signed `site-owner`, `site-save`, `site-history`, `site-restore`, `site-media-start` and `site-media-finish` actions. New isolated tables `agi_site_content` and `agi_site_content_history` store only the `agi1.app` row. Public responses omit hidden custom content, upload proofs and audit history. All writes use server validation, RLS tables without browser grants, service-role-only RPCs and row-locked revision checks. No HTML or executable content is accepted.

`supabase/site-content.sql` was applied to project `vujaxukucukjxzhcxlea` (`agi2`), confirmed against agi1.app's public Ride 'Em AGI counters (129 plays, 29 players, 1 rating, sum 5) and the prior release record. A rolled-back service-role transaction verified save, stale-save rejection and restore. Final database inspection: revision 0, zero page changes, one original snapshot, both tables have RLS, no browser table access. Security advisors report the expected informational “RLS without policies” because browser access is intentionally denied.

## Meme uploads

The `agi1_owner_meme_media` migration from `supabase/site-media.sql` was applied to the same verified `agi2` project. It creates the isolated public bucket `agi1-owner-media`, with a 50,000,000-byte bucket limit and an exact MIME allowlist. It does not change the plan or global upload limits. The project uses the Free plan; gallery images are limited to **20 MB** (20,000,000 bytes), and videos to **50 MB** (50,000,000 bytes). Accepted formats are JPEG, PNG, WebP, GIF, MP4 and WebM; SVG, HTML and other file types are rejected. The live `storage.objects` policy inspection returned no policies granting browser writes.

The owner server signs a fresh UUID destination with overwrite disabled. The browser uploads directly to that signed Storage URL, with progress shown; the file does not pass through Vercel and the browser receives no service key. A separate owner-bound ticket expires after two hours. Completion requires the owner's signed session, matching authoritative Storage object size/MIME, and a matching image/video header from a bounded 4 KB read. Missing authoritative metadata is rejected rather than replaced with caller-controlled user metadata. Server-issued proofs bind each confirmed path, MIME and byte count; new gallery sources and video covers cannot be published without valid proofs. Existing confirmed items remain editable after signing-key rotation. Public content strips proofs and omits hidden custom entries.

Choose a file, title, caption and video category, then click **Upload to draft**. A verified upload is added to the editor's draft and preview. Click **Publish changes** to update the public `/memes` gallery. Uploading alone does not add a public gallery entry; the file itself is public at its unguessable UUID Storage address. Video cover frames are generated locally and uploaded through the same verified flow; if cover generation fails, the video can still be published. Hiding/removing gallery entries does not delete their stored files, so saved revisions remain restorable. Visitors can view and download published uploads through the existing gallery.

The CSP retains every existing directive and adds only these exact source prefixes:

- `img-src` and `media-src`: `https://vujaxukucukjxzhcxlea.supabase.co/storage/v1/object/public/agi1-owner-media/`
- `connect-src`: `https://vujaxukucukjxzhcxlea.supabase.co/storage/v1/object/upload/sign/agi1-owner-media/`

There is no wildcard Supabase origin permission. Cross-origin downloads use Storage's `?download=<filename>` response option; they do not fetch media through an expanded `connect-src` permission.

## Verification

- Final production build with media: 1,271 passed, 0 failed, 6 pre-existing skips; Vite, share pages and secret check passed.
- 24 focused owner API/runtime tests cover owner authorization, persistence errors, conflict handling, history, safe rendering, selector stability, navigation, protected recovery routes and preview message origin/source checks.
- Media extension: 27 owner API/media API/security checks passed, and 28 media UI/runtime/gallery/security checks passed (the five security checks appear in both runs). New tests cover direct PUT followed by server confirmation, rejected/aborted uploads, owner/ticket expiry, size and format mismatch, proof forgery, unchanged files after key rotation, hidden-entry redaction, immutable built-in files, canonical URL/ID binding, inherited/coerced MIME values, untrusted metadata rejection, bounded range reads and the exact CSP additions.
- Independent review verified the signed-upload and object-info protocol against the current Supabase SDK and Storage service source. Corrections include sending new secret keys only in `apikey`, rejecting malformed MIME values before signing, refusing missing authoritative object metadata, and preventing an old upload from releasing a new wallet operation's busy state.
- Real Chromium checks using a made-up wallet and in-memory API fixture: signed-out and wrong-wallet gates; Her world edit/remove/add/publish; public reload; new page/section; image upload; mobile width; history restore; no editor page errors.
- Media Chromium checks: verified image/video/automatic-cover uploads, draft isolation, publish, actual gallery rendering/playback, deep links, download URLs, caption/category edits, built-in hide/restore and mobile width; no page errors. Test uploads remained in simulated loopback storage, with original Blob bytes retained by the test proxy. No media was uploaded to production for QA.
- Desktop, 390px phone, media and custom-page screenshots reviewed in ignored `tools/owner-qa/`.

Run local QA with `node tools/owner-preview.mjs`, then open its loopback `/__owner-test` page. This helper skips `.env.local`, uses only fake server settings, blocks upstream API requests and is outside the Vite build. `tools/owner-ui-check.mjs` and `tools/owner-media-ui-check.mjs` use Playwright; optional `OWNER_PLAYWRIGHT_MODULE` and `OWNER_BROWSER_PATH` select an already installed runtime/browser.

Images added directly to page sections accept PNG/JPEG/WebP and are compressed in-browser; these are separate from the gallery's Storage uploads. Document limits are 300 KB, 150 page settings, 1,500 element edits and 500 added sections; the gallery permits up to 500 item overrides/uploads. Existing native app controls, game behavior and database records use their existing managers/code.

## Release status

The core implementation and media extension are complete locally, and the isolated database/bucket migrations are applied. Final release QA passed. Production deployment of this combined change has not yet been confirmed.
