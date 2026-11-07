# The AGI arcade kit (`src/games/kit/`)

Since 2026-11-08 the twenty newer AGI games (MERGE TO AGI, BLOCKCHAIN, HEARTBEAT, SCAM SLAYER, LAST MODEL STANDING,
SINGULARITY, JAILBREAK, STACKED, JAYWALK, ROBOTAXI RUSH, and from the second night REAL OR AI?, I'M NOT A ROBOT, ALIGNMENT,
GRADIENT DESCENT, EPOCHS, SYNAPSE, OVERCLOCK, BEAT THE AGI, HALLUCINATION, GUARDRAILS) share this kit, so every game has
the same frame: the top bar
(back to the arcade, the game's numbers, sound, full screen, pause), the title screen, pause, how to play, the end-of-run
card with the player's best and Share on X, toasts, settings that follow the player from game to game, local bests,
and the play counter for agi1.app/games. The games draw their own playfields.

The look is the site's Pop mode as stickers: ink outlines (`#170a36`), hard offset shadows, honey / pink / violet / mint
blocks, wide heavy **Anybody** (`'AK Display'`), **Geist** (`'AK Sans'`), **Geist Mono** for numbers (`'AK Mono'`),
**Instrument Serif** italics for AGI-1's voice (`'AK Serif'`). All self-hosted, declared in `kit.css`.

## A game's files

```
<id>.html                     its page: the AGI GAMES intro's cover right after <body>, <main id="ak-root">, its entry
src/games/<id>/page.js        its entry: import '../intro.js' FIRST (tests/intro.test.js), then the game
src/games/<id>/…              the game: keep rules in pure modules (no DOM) so tests/<id>.test.js can run them in Node
public/games/<id>/…           big files it loads at runtime (optional)
tests/<id>.test.js            node:test, pure logic
```

## The shell (`shell.js`)

```js
import { createShell, el, icon } from '../kit/shell.js';
const shell = createShell({
  game: 'mergeagi', name: 'MERGE TO AGI',            // its id in src/games/list.js and its name
  root: document.getElementById('ak-root'),
  howTo: { intro: 'optional sentence', steps: [['Title', 'what to do'], …], touch: [['Tap', 'Drop']], keys: [['Space', 'Drop']] },
  onPause() {}, onResume() {}, onRestart() {}, onQuit() {},  // the pause card's buttons and Esc / P
  pausable: true,                                      // false: no pause (an idle game)
});
shell.stage                 // put your <canvas> (or DOM) in here: it fills the screen under the bar
shell.chip('Score', 0)      // a number in the top bar → { set(v, { pop }), hide(), node }
shell.title({ logo: ['MERGE', { text: 'TO AGI', tone: 'accent' }], tagline, art: node, onPlay, modes: [{ label, sub, onClick, locked }], best, extra })
shell.started()             // a run began: counts one play (never in a demo), shows the pause button
shell.over({ score, label, stats: [['Merges', '42'], …], line: "AGI-1's words", share: 'post text', onAgain, onMenu, title, format })
shell.toast('PERFECT', 'good' | 'warn')
shell.card(node) / shell.closeCard()                   // your own card over the game (level up, level select…): use .ak-card
shell.audio.sfx('pop', { pitch })                      // see audio.js PRESETS; .tone(), .noise(), .chord(), .load(), .playBuffer()
shell.haptic(12)            // a light buzz (Android; the player's setting)
shell.store                 // this game's save: read(), write(), update(fn), best(), recordBest(), bump()
shell.state                 // 'title' | 'play' | 'pause' | 'over'
shell.demo / shell.touch    // the page is a recorded demo / a touchscreen
```

`over()` records the best for you (`bestKey`, `lower` for times) and counts the score up. Enter / Space / R plays again.

## Everything else

- `canvas.js` `fitCanvas(canvas, { maxDpr })` → `view.begin()` each frame (draw in CSS pixels), `view.fit(lw, lh, { top })`
  for a fixed playfield, `view.toWorld()`.
- `loop.js` `createLoop({ update(dt), render(alpha, frameDt), paused: () => shell.state !== 'play' })`: fixed 120 Hz steps.
- `input.js` `pointer(el, { down, move, up, tap, swipe })`, `keyboard(map, { down, up, blocked })`, `vibrate()`.
- `fx.js` `Particles`, `Shake`, `FloatText`, `Tweens`, `ease`, `rng(seed)`, `fmt()`, `fmtTime()`, `roundRect()`, `star()`,
  `mix()`, `shade()`, `rgba()`, `PALETTE`, `clamp/lerp/approach/remap`.
- `store.js` `gameStore(id)`, `settings` (sound, music, haptics: the arcade's, the same in every game).
- `audio.js` `createAudio()` (the shell makes one), `createLoopMusic(pattern)` for a small looping soundtrack.
- `env.js` `DEMO` (`?demo`), `SEED` (`?seed=n`), `REDUCED` ("reduce motion"), `TOUCH`, `IOS`.
- `site.js` the play counter (the shell calls it). `share.js` X's post box (the player posts; never us).

## Rules every game keeps

- **The site's CSP** (`vercel.json`): no inline `<script>` or `<style>`, no `style="…"` (in HTML or `setAttribute`),
  no `eval` / `new Function`, nothing from another site (fonts, pictures, sound: our own files only). Setting
  `node.style.foo = …` or `style.setProperty('--x', …)` from code is fine (the CSS object model).
- **`?demo`**: the game plays itself (its own AI), at once, forever (a new run after each end), silent, nothing saved or
  counted. `?seed=n` repeats it exactly. This records the gameplay previews on agi1.app/games
  (`tools/games/capture-previews.mjs`, `?demo&seed=7` in a 480 × 480 window): its clock starts with the page, the
  intro takes 3.2 s, then 2.5 s more, then 6 s are recorded, so a demo's best moments belong about **5.7 to 11.7 s**
  after the page opens. Its particles may use `Math.random` (the pictures differ a little from run to run; the game and
  its AI must not).
- **Hard rules** (CLAUDE.md): PG-13; AGI-1's lines in her voice (lowercase, playful, 💜 now and then); no money, prices or
  "buy" anywhere; no real coins, people or brands; Share on X only opens X's own post box.
- Phones first, computers too: touch, mouse and keyboard; any size from 360 px wide to 4K; sideways phones; the notch
  (`--ak-safe-*`); pause when the tab is hidden (the shell does it); "reduce motion" (no shake or flashes).
