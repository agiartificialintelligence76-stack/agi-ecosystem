# VLAD RUNNER 2049 illustrated story revision

The owner asked for full illustrated scenes like their supplied story-page references, with new character actions and compositions instead of reused portrait overlays. They explicitly requested immediate publication after completion.

## Delivered

- Fifteen distinct illustrations: diner opening, blackout, raid, three stage cards, three boss encounters, memory-vault discovery, the heroes' refusal, restoration, city reunion and diner epilogue.
- Both heroes are drawn within each scene, with varied poses, expressions, camera angles and environments. The supplied game screenshots informed the page treatment; no reference-game artwork ships in the game.
- A cream paper story layout with handwritten captions, framed level titles and Play buttons. Scenes use contained images, preserving the full composition at desktop and phone sizes.
- Player-paced Next/Skip controls, descriptive image alternatives and the existing pause/focus/held-key safeguards. These are illustrated still panels with a brief fade, not animated cutscenes.
- Sequential image loading: first opening image preloads, then current and next scenes. A three-entry promise cache avoids loading all story art up front. The fifteen WebP files total 3,164,062 bytes.

This revision changes story art, captions and presentation. Combat, world geometry and audio are unchanged from the preceding release.

## Verification

- Full `npm run build`: 1,193 passed, 0 failed, 6 skipped; production bundle, share pages and secret scan passed on the installed Node 24 runtime. Other Node versions and date shifts were not repeated for this presentation-only revision.
- Focused UI/asset suite: 11 passed. The new check verifies every story image exists, has distinct content, retains its 3:2 composition and fits the separate story download budget.
- Local browser: all four opening pages, held Enter advancing once, the level Play transition, and paused gameplay at the start of the run. Desktop 1280×720, portrait 390×844 and landscape 844×390 layouts were checked without clipped art or off-screen continuation buttons.
- All fifteen final illustrations were visually inspected. The complete campaign was not manually replayed for this revision.
- Local browser warnings/errors: none. Existing optional audio choices are preserved.

## Art and exact final prompts

Final illustrations are in [`public/images/vladrunner2049/story/`](../public/images/vladrunner2049/story/). They were created with the built-in image tool, then resized/compressed to WebP for the game.

- [Panels 01–05](vlad-story-prompts-a.md)
- [Panels 06–08](vlad-story-prompts-b.md)
- [Panels 09–10](vlad-story-prompts-d.md)
- [Panels 11–15 and the final skyline correction](vlad-story-prompts-c.md)

## Publication

Publication is authorized. The production deployment and public browser evidence will be recorded here once verified.
