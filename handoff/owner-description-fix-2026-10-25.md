# Empty Her world description — 2026-10-25

ClankChecker's original homepage entry had no description element, so the owner editor correctly found no field but could not add one. It now has a stable empty `#lp-checker-description` slot before the existing arrow. Every built-in Her world entry has exactly one description slot.

The runtime permits writing to an empty description only inside a Her world link, creates an empty text node when needed and restores it to blank on reset. Empty descriptions stay visually hidden and retain the original arrow alignment. The All content text editor also accepts approved blank `small` elements. Existing name/link/arrow selectors, saved content format and access checks remain unchanged.

Validation: 1,273 tests passed, zero failures and six existing skips; production build and secret scan passed. The dedicated browser regression `tools/owner-description-ui-check.mjs` seeds the existing ClankChecker name override, verifies the blank field, adds/publishes a caption, reloads a visitor page, clears/publishes/refills it, and restores the original blank entry. Its name, link, arrow and other rows remain correct; no page errors. Test writes use only fake local storage, with no production content changes or database migration.
