// SKYBREAK on agi1.app (2026-10-31): AGI-1's 3D chart climb, from the city rooftops to the Moon.
//
// The AGI GAMES intro first, like every AGI game (its styles before the game's, and its key and tap listeners before the
// game's own, so a key or a tap that skips the intro never reaches the game). Then the run counter: each run the game
// starts (its `skybreak:run` event) is one more play on agi1.app/games, and nothing else is sent: never who, how high or
// how fast. Then the game itself, loaded after them so the intro plays while its 3D engine and physics arrive.
//
// The game's modules, styles and markup are written by tools/games/import-skybreak.mjs from its own project: a change to
// the game goes there (a patch, or a new version of the game), never into those files by hand.
import '../intro.js';
import { Site } from './site.js';

document.addEventListener('skybreak:run', () => Site.play());

try {
  await import('./main.js');
} catch (error) {
  // its code didn't arrive (a dropped connection): say so where the game shows its own errors
  console.error(error);
  const box = document.getElementById('error');
  if (box) {
    box.textContent = 'SKYBREAK couldn\'t load. Check your connection and reload the page.';
    box.classList.remove('hidden');
  }
}
