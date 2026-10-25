# Owner preview and Her world editing fix — 2026-10-25

The owner's screenshots showed Her world descriptions on the live desktop page but not inside `/owner`. The preview inherited the remaining editor column width, which could be 761–1100px; the public homepage intentionally hides descriptions at that intermediate breakpoint. Clicking an entry name also selected its anchor rather than the complete row, so the editor omitted its description field.

The owner editor now uses explicit Desktop (1440 × 900) and Phone (390 × 844) viewports, scaled to fit its panel. Actual size allows contained scrolling. These controls retain the iframe and draft when changing mode, zoom or window size. Public page styles are unchanged.

Picking any part of a Her world or orbit entry selects its complete row. The editor shows name, description (where present) and link together. Row headings use the entry name without joining it to the caption or arrow. Reset to original clears all related overrides, and refreshed inventory updates the selected record without replacing an active text input.

Validation:

- Production build: 1,272 passed, 0 failed, 6 existing skips; Vite, share pages and secret scan passed.
- New runtime regression verifies row/name/dot/description/arrow/text-node picking and intact child elements after editing.
- `tools/owner-preview-ui-check.mjs` checks 1600/1760px editor widths, desktop/phone modes, Actual size scrolling and hit testing, draft retention, public rendering after publish, composite reset, phone overflow and page errors using only the loopback fixture.
- Core authenticated owner browser checks also pass. Screenshots are in ignored `tools/owner-qa/`.
- Independent review found no new access-control or CSP relaxation. Direct style property assignments keep the existing strict CSP.

This is a code-only fix. No database migrations or production content writes are required; the owner's published edits remain in the existing content row. Public content was observed at revision 24 during diagnosis. Production verification is recorded separately in the ignored local release log after deployment.
