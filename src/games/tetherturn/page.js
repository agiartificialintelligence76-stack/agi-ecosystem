import '../intro.js';
import { createShell } from '../kit/shell.js';
import { mountRemaster } from '../kit/remaster.js';
import game from './game.js';
mountRemaster('tetherturn', game, options => createShell({
  game: 'tetherturn',
  ...options
}), new URL('./pilot.webp', import.meta.url).href);
