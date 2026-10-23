# VLAD RUNNER 2049 interface preview — 2026-10-23

**Publication update:** The owner subsequently requested "publish the new one now". Commit
`37a3a698db952dfcceff8885df4f4c4d3dcedba5` is now on `main`; production deployment
`4j5c1j4DzLiJMCWF7BEtFazDkyQw` is Ready after 3m 34s at
https://www.agi1.app/games/vladrunner2049 . Public selection, artwork, game start, movement/combo and pause
passed without browser warnings/errors. The preview-only statements below are historical.

The owner rejected the interface and typography as far below Fist Punch. This revision follows the combat,
animation and audio preview at `9a284394664a1a86491a7396e1666ee99ead00d2`. It remains on the working branch,
`claude/blissful-davinci-bnr01m`; production is still `6f2f5a25fe15850832be40218128bed3eff0913e`.
Do not describe this preview as a production release or as matching the whole reference game's quality.

**Verified hosted preview:** commit `5ad6f8cd797b281ff687e8ee3d370b78402c4271`, deployment
`4r4bLg2xvUxnRN57PWEewH6Q3vT4`, status **Ready** after 3m 24s.
https://agi-ecosystem-oq5il0kwx-agi25.vercel.app/games/vladrunner2049
Vercel protection remains enabled; the owner's signed-in Chrome can open it. Hosted title/selection/artwork,
font, game start, movement, HUD and pause were checked. No game console errors; existing wallet-extension
warnings are unrelated. Screenshot: local ignored `node_modules/.cache/vlad-interface-preview.png`.

## Changes

- Separate illustrated title screen and fighter selection; three large cards for VLAD, AGI-1 and local duo.
- Original brush-lettered logo, sunset city backdrop and character portraits. Cream panels, irregular ink borders,
  Amatic SC headings and Comic Neue supporting text replace the previous website-like treatment.
- Mode selection and assist options are kept on setup, leaving the title with Play, help and records.
- Compact portrait health capsules, small score/objective group, matching pause/options/results/upgrades,
  touch controls and illustrated help. Complete keyboard/gamepad controls expand from a disclosure.
- Keyboard focus returns correctly; the modal trap includes the disclosure and excludes hidden controls.
  Escape works from settings inputs. Loading retries cannot overlap and optional menu art does not block combat.
- Existing gameplay, audio lifecycle, save records and local co-op remain connected to the revised interface.

## Artwork and reference

Four new WebP assets are in `public/images/vladrunner2049/`: `menu-backdrop`, `title-logo`, `vlad-portrait`,
and `agi-portrait`. Their exact art directions are in [the prompt record](vlad-interface-prompts-2026-10-23.md).
Total game image payload is 7,108,614 bytes, inside the existing 8 MiB check.

The reference was inspected through visible gameplay footage, including title, selection, controls and HUD:
https://www.youtube.com/watch?v=c5TfoZUoUZg . No original game assets were copied.
The reference's exact font was not identified; Amatic SC is an original licensed alternative.
Font source: https://github.com/google/fonts/blob/main/ofl/amaticsc/METADATA.pb .
The bundled font license is `public/fonts/games/AmaticSC-OFL.txt`.

## Verification

- Node 24.21.0 full `npm run build`: **1,169 passed, 0 failed, 6 skipped**; Vite, share pages and secret check pass.
  Local ignored log: `vlad-interface-build.log`. Existing dynamic-import bundling warning remains unrelated.
- Browser title/setup/HUD at 1280×720; selection at 390×844 and 844×390; help at 896×884; landscape touch controls.
  Narrow layout has no horizontal document overflow. Phone dimensions used development viewport emulation,
  not a physical phone.
- Actual title/setup flow, game start, pause/options, Escape from Music, and help focus wrapping were exercised.
  Earlier checks covered solo/duo exclusivity, daily solo restrictions, two-player HUD and paused game clock.
- Local browser warnings/errors: none. Separate final source review found no significant new regression.
- The earlier combat preview is Ready at https://agi-ecosystem-9y69grrgd-agi25.vercel.app/games/vladrunner2049
  (deployment `CN1JqHi1kbjg62n1iUyXi5MnpU53`). The verified UI preview above supersedes it.

## Remaining quality limits

The UI is a substantial visual correction, not proof that the full Fist Punch quality gap is closed.
Our arenas remain flatter, without the reference's tables/chandeliers/platform traversal. Some enemies and bosses
still use limited poses; physical gamepad and phone hardware have not been tested. Audio was checked technically
for clipping and lifecycle, not presented as a subjective listening verdict. See the combat preview handoff
for the implemented animation, timing, sound and remaining limitations.
